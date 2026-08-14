import { describe, expect, it } from 'vitest';

import type { FieldType } from '@/protocol-core/schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import {
  bannerFor,
  cDeclaration,
  cTypeFor,
  fieldByteLength,
  flattenLeafFields,
  indentLines,
  isAggregateField,
  pythonTypeFor,
  toIdentifier,
  toUniqueIdentifiers,
  typeScriptTypeFor,
} from './codegenSupport';

function makeField(
  overrides: Partial<ProtocolFieldSchema> & { readonly type: FieldType },
): ProtocolFieldSchema {
  return { id: 'sample', name: 'Sample', ...overrides };
}

/** İç içe yapı + dizi: düzleştirme yolunu tek şemada sınamak için. */
const NESTED_SCHEMA: ProtocolSchema = {
  name: 'Nested Telemetry',
  version: '1.0',
  framing: { type: 'lengthField', maximumFrameLength: 512 },
  fields: [
    {
      id: 'header',
      name: 'Header',
      type: 'structure',
      fields: [
        { id: 'deviceAddress', name: 'Device Address', type: 'uint8' },
        { id: 'itemCount', name: 'Item Count', type: 'uint8' },
      ],
    },
    {
      id: 'items',
      name: 'Items',
      type: 'array',
      repeatCount: { fromField: 'itemCount' },
      fields: [
        { id: 'value', name: 'Value', type: 'uint16' },
        {
          id: 'flags',
          name: 'Flags',
          type: 'structure',
          fields: [{ id: 'alarm', name: 'Alarm', type: 'boolean' }],
        },
      ],
    },
    { id: 'crc', name: 'CRC', type: 'crc', algorithm: 'CRC16_MODBUS' },
  ],
};

describe('toIdentifier', () => {
  it('renders the three styles from a spaced name', () => {
    expect(toIdentifier('Device Address', 'snake')).toBe('device_address');
    expect(toIdentifier('Device Address', 'camel')).toBe('deviceAddress');
    expect(toIdentifier('Device Address', 'pascal')).toBe('DeviceAddress');
  });

  it('treats camel case boundaries as word boundaries', () => {
    expect(toIdentifier('payloadLength', 'snake')).toBe('payload_length');
    expect(toIdentifier('payloadLength', 'pascal')).toBe('PayloadLength');
    expect(toIdentifier('CRC16Value', 'snake')).toBe('crc16_value');
    expect(toIdentifier('CRC16Value', 'camel')).toBe('crc16Value');
  });

  it('transliterates Turkish letters to ASCII', () => {
    expect(toIdentifier('Sıcaklık Ölçümü', 'snake')).toBe('sicaklik_olcumu');
    expect(toIdentifier('ÇÖĞÜŞ İĞNE', 'snake')).toBe('cogus_igne');
    expect(toIdentifier('Güç Değeri', 'pascal')).toBe('GucDegeri');
  });

  it('prefixes an underscore when the name starts with a digit', () => {
    expect(toIdentifier('3D Position', 'snake')).toBe('_3d_position');
    expect(toIdentifier('16 bit', 'camel')).toBe('_16Bit');
  });

  it('falls back to "field" when no alphanumeric character survives', () => {
    expect(toIdentifier('---', 'snake')).toBe('field');
    expect(toIdentifier('', 'pascal')).toBe('field');
    expect(toIdentifier('  ?? ', 'camel')).toBe('field');
  });

  it('collapses punctuation into separators', () => {
    // Açık ayırıcı ("-") kelime sınırıdır: `CRC-16` iki kelimedir, `crc16Value`
    // ise tek — ayrımı yapan girdideki noktalama.
    expect(toIdentifier('Payload/CRC-16 (raw)', 'snake')).toBe('payload_crc_16_raw');
    expect(toIdentifier('Payload/CRC-16 (raw)', 'camel')).toBe('payloadCrc16Raw');
  });
});

describe('toUniqueIdentifiers', () => {
  it('keeps distinct names untouched and preserves order', () => {
    expect(toUniqueIdentifiers(['Device Address', 'Command', 'Payload'], 'snake')).toEqual([
      'device_address',
      'command',
      'payload',
    ]);
  });

  it('suffixes colliding identifiers with _2, _3', () => {
    expect(toUniqueIdentifiers(['Value', 'value', 'VALUE'], 'snake')).toEqual([
      'value',
      'value_2',
      'value_3',
    ]);
  });

  it('skips a suffix that the schema already claimed', () => {
    // "Value 2" kendiliğinden `value_2` üretir; sonraki çakışma `value_3` olmalı.
    expect(toUniqueIdentifiers(['Value', 'Value 2', 'Value'], 'snake')).toEqual([
      'value',
      'value_2',
      'value_3',
    ]);
  });
});

describe('cTypeFor', () => {
  it('maps fixed-width integers, widening 24 bit to the next C width', () => {
    expect(cTypeFor(makeField({ type: 'uint8' }))).toBe('uint8_t');
    expect(cTypeFor(makeField({ type: 'int8' }))).toBe('int8_t');
    expect(cTypeFor(makeField({ type: 'uint16' }))).toBe('uint16_t');
    expect(cTypeFor(makeField({ type: 'int16' }))).toBe('int16_t');
    expect(cTypeFor(makeField({ type: 'uint24' }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'int24' }))).toBe('int32_t');
    expect(cTypeFor(makeField({ type: 'uint32' }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'int64' }))).toBe('int64_t');
  });

  it('maps floats and booleans, keeping float16 raw', () => {
    expect(cTypeFor(makeField({ type: 'float16' }))).toBe('uint16_t');
    expect(cTypeFor(makeField({ type: 'float32' }))).toBe('float');
    expect(cTypeFor(makeField({ type: 'float64' }))).toBe('double');
    expect(cTypeFor(makeField({ type: 'boolean' }))).toBe('bool');
  });

  it('maps timestamps to their storage width', () => {
    expect(cTypeFor(makeField({ type: 'unixTimestamp' }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'dateTime' }))).toBe('uint64_t');
  });

  it('maps text and byte families to arrays of their declared length', () => {
    expect(cTypeFor(makeField({ type: 'ascii', length: 8 }))).toBe('char[8]');
    expect(cTypeFor(makeField({ type: 'utf8', length: 16 }))).toBe('char[16]');
    expect(cTypeFor(makeField({ type: 'rawBytes', length: 3 }))).toBe('uint8_t[3]');
    expect(cTypeFor(makeField({ type: 'padding', length: 2 }))).toBe('uint8_t[2]');
    expect(cTypeFor(makeField({ type: 'reserved', length: 4 }))).toBe('uint8_t[4]');
    expect(cTypeFor(makeField({ type: 'delimiter', length: 1 }))).toBe('uint8_t[1]');
    expect(cTypeFor(makeField({ type: 'bcd', length: 4 }))).toBe('uint8_t[4]');
  });

  it('emits a pointer when the length is only known at runtime', () => {
    expect(cTypeFor(makeField({ type: 'rawBytes', lengthFrom: 'payloadLength' }))).toBe('uint8_t*');
    expect(cTypeFor(makeField({ type: 'ascii', lengthFrom: 'nameLength' }))).toBe('char*');
  });

  it('sizes semantic integers from the schema length', () => {
    expect(cTypeFor(makeField({ type: 'enum', length: 1 }))).toBe('uint8_t');
    expect(cTypeFor(makeField({ type: 'address', length: 2 }))).toBe('uint16_t');
    expect(cTypeFor(makeField({ type: 'length', length: 3 }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'command', length: 4 }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'sequenceCounter', length: 8 }))).toBe('uint64_t');
    // 8 bayttan geniş bir "adres" tamsayı değil, bayt dizisidir.
    expect(cTypeFor(makeField({ type: 'address', length: 16 }))).toBe('uint8_t[16]');
  });

  it('sizes derived fields from their checksum algorithm', () => {
    expect(cTypeFor(makeField({ type: 'checksum', algorithm: 'xor8' }))).toBe('uint8_t');
    expect(cTypeFor(makeField({ type: 'crc', algorithm: 'CRC16_MODBUS' }))).toBe('uint16_t');
    expect(cTypeFor(makeField({ type: 'crc', algorithm: 'CRC32' }))).toBe('uint32_t');
  });

  it('fits a bit field into the smallest unsigned type', () => {
    expect(cTypeFor(makeField({ type: 'bitField', bitLength: 3 }))).toBe('uint8_t');
    expect(cTypeFor(makeField({ type: 'bitField', bitLength: 12 }))).toBe('uint16_t');
    expect(cTypeFor(makeField({ type: 'bitField', bitLength: 24 }))).toBe('uint32_t');
    expect(cTypeFor(makeField({ type: 'bitField', bitLength: 40 }))).toBe('uint64_t');
  });

  it('rejects aggregate fields instead of guessing a type', () => {
    const array = makeField({ id: 'items', type: 'array', repeatCount: 2 });
    const structure = makeField({ id: 'header', type: 'structure' });
    expect(() => cTypeFor(array)).toThrow(/items/);
    expect(() => cTypeFor(structure)).toThrow(/isAggregateField/);
  });
});

describe('isAggregateField', () => {
  it('is true only for array and structure', () => {
    expect(isAggregateField(makeField({ type: 'array' }))).toBe(true);
    expect(isAggregateField(makeField({ type: 'structure' }))).toBe(true);
    expect(isAggregateField(makeField({ type: 'uint8' }))).toBe(false);
    expect(isAggregateField(makeField({ type: 'rawBytes', length: 2 }))).toBe(false);
  });
});

describe('cDeclaration', () => {
  it('moves the array suffix behind the identifier', () => {
    expect(cDeclaration('uint8_t[3]', 'payload')).toBe('uint8_t payload[3]');
    expect(cDeclaration('char[16]', 'name')).toBe('char name[16]');
    expect(cDeclaration('uint16_t', 'value')).toBe('uint16_t value');
    expect(cDeclaration('uint8_t*', 'payload')).toBe('uint8_t* payload');
  });
});

describe('pythonTypeFor', () => {
  it('maps every field family to a Python type hint', () => {
    expect(pythonTypeFor(makeField({ type: 'uint32' }))).toBe('int');
    expect(pythonTypeFor(makeField({ type: 'bcd', length: 2 }))).toBe('int');
    expect(pythonTypeFor(makeField({ type: 'enum', length: 1 }))).toBe('int');
    expect(pythonTypeFor(makeField({ type: 'bitField', bitLength: 4 }))).toBe('int');
    expect(pythonTypeFor(makeField({ type: 'unixTimestamp' }))).toBe('int');
    expect(pythonTypeFor(makeField({ type: 'crc', algorithm: 'CRC32' }))).toBe('int');
    // C'de ham uint16, Python'da gerçek kayan nokta: `struct` 'e' biçimi var.
    expect(pythonTypeFor(makeField({ type: 'float16' }))).toBe('float');
    expect(pythonTypeFor(makeField({ type: 'float64' }))).toBe('float');
    expect(pythonTypeFor(makeField({ type: 'boolean' }))).toBe('bool');
    expect(pythonTypeFor(makeField({ type: 'ascii', length: 4 }))).toBe('str');
    expect(pythonTypeFor(makeField({ type: 'utf8', length: 4 }))).toBe('str');
    expect(pythonTypeFor(makeField({ type: 'rawBytes', length: 4 }))).toBe('bytes');
    expect(pythonTypeFor(makeField({ type: 'padding', length: 1 }))).toBe('bytes');
  });

  it('rejects aggregate fields', () => {
    expect(() => pythonTypeFor(makeField({ type: 'structure' }))).toThrow();
  });
});

describe('typeScriptTypeFor', () => {
  it('maps every field family to a TypeScript type', () => {
    expect(typeScriptTypeFor(makeField({ type: 'uint32' }))).toBe('number');
    expect(typeScriptTypeFor(makeField({ type: 'float32' }))).toBe('number');
    expect(typeScriptTypeFor(makeField({ type: 'unixTimestamp' }))).toBe('number');
    expect(typeScriptTypeFor(makeField({ type: 'enum', length: 1 }))).toBe('number');
    expect(typeScriptTypeFor(makeField({ type: 'checksum', algorithm: 'xor8' }))).toBe('number');
    expect(typeScriptTypeFor(makeField({ type: 'boolean' }))).toBe('boolean');
    expect(typeScriptTypeFor(makeField({ type: 'ascii', length: 4 }))).toBe('string');
    expect(typeScriptTypeFor(makeField({ type: 'rawBytes', length: 4 }))).toBe('Uint8Array');
    expect(typeScriptTypeFor(makeField({ type: 'delimiter', length: 1 }))).toBe('Uint8Array');
  });

  it('uses bigint for types wider than 53 bits', () => {
    expect(typeScriptTypeFor(makeField({ type: 'uint64' }))).toBe('bigint');
    expect(typeScriptTypeFor(makeField({ type: 'int64' }))).toBe('bigint');
    expect(typeScriptTypeFor(makeField({ type: 'dateTime' }))).toBe('bigint');
  });

  it('rejects aggregate fields', () => {
    expect(() => typeScriptTypeFor(makeField({ type: 'array', repeatCount: 1 }))).toThrow();
  });
});

describe('indentLines', () => {
  it('indents every non-empty line and leaves blank lines bare', () => {
    expect(indentLines('a\n\nb', '  ')).toBe('  a\n\n  b');
    expect(indentLines('a\nb', '  ', 2)).toBe('    a\n    b');
    expect(indentLines('a\nb', '\t')).toBe('\ta\n\tb');
  });

  it('returns the text unchanged for zero or negative repetitions', () => {
    expect(indentLines('a\nb', '  ', 0)).toBe('a\nb');
    expect(indentLines('a\nb', '  ', -1)).toBe('a\nb');
  });
});

describe('bannerFor', () => {
  it('renders the comment syntax of each target language', () => {
    expect(bannerFor('c', 'Sensor').startsWith('/*\n')).toBe(true);
    expect(bannerFor('c', 'Sensor').endsWith('\n */')).toBe(true);
    expect(bannerFor('hash', 'Sensor').split('\n').every((line) => line.startsWith('# '))).toBe(
      true,
    );
    expect(bannerFor('markdown', 'Sensor').startsWith('<!--')).toBe(true);
    expect(bannerFor('markdown', 'Sensor').endsWith('-->')).toBe(true);
  });

  it('names the protocol and stays deterministic', () => {
    const first = bannerFor('c', 'ALP Sensor');
    const second = bannerFor('c', 'ALP Sensor');
    expect(first).toBe(second);
    expect(first).toContain('ALP Sensor');
    // Tarih damgası yok: dört haneli bir yıl çıktıyı her üretimde değiştirirdi.
    expect(/\d{4}/.test(first)).toBe(false);
  });
});

describe('fieldByteLength', () => {
  it('reports the static width of fixed fields', () => {
    expect(fieldByteLength(makeField({ type: 'uint16' }))).toBe(2);
    expect(fieldByteLength(makeField({ type: 'ascii', length: 8 }))).toBe(8);
    expect(fieldByteLength(makeField({ type: 'checksum', algorithm: 'xor8' }))).toBe(1);
    // bitOffset 4'ten başlayan 8 bitlik alan iki bayta yayılır.
    expect(fieldByteLength(makeField({ type: 'bitField', bitOffset: 4, bitLength: 8 }))).toBe(2);
  });

  it('returns null when the length comes from another field', () => {
    expect(fieldByteLength(makeField({ type: 'rawBytes', lengthFrom: 'payloadLength' }))).toBeNull();
    // Algoritması verilmemiş checksum'ın genişliği de bilinemez.
    expect(fieldByteLength(makeField({ type: 'checksum' }))).toBeNull();
  });
});

describe('flattenLeafFields', () => {
  it('keeps flat schemas flat and in frame order', () => {
    const flat = flattenLeafFields(SPEC_SENSOR_PROTOCOL);
    expect(flat.map((entry) => entry.path)).toEqual([
      'address',
      'command',
      'payloadLength',
      'payload',
      'checksum',
    ]);
    expect(flat.every((entry) => entry.depth === 0)).toBe(true);
    expect(flat.every((entry) => entry.parentIds.length === 0)).toBe(true);
  });

  it('expands nested structures and arrays into leaf paths', () => {
    const flat = flattenLeafFields(NESTED_SCHEMA);
    expect(flat.map((entry) => entry.path)).toEqual([
      'header.deviceAddress',
      'header.itemCount',
      'items[].value',
      'items[].flags.alarm',
      'crc',
    ]);
    expect(flat.map((entry) => entry.depth)).toEqual([1, 1, 1, 2, 0]);
    expect(flat.map((entry) => entry.parentIds)).toEqual([
      ['header'],
      ['header'],
      ['items'],
      ['items', 'flags'],
      [],
    ]);
  });

  it('drops the composite fields themselves', () => {
    const flat = flattenLeafFields(NESTED_SCHEMA);
    expect(flat.some((entry) => isAggregateField(entry.field))).toBe(false);
    expect(flat).toHaveLength(5);
  });
});
