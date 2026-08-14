import { describe, expect, it } from 'vitest';

import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import { generateMarkdownDoc } from './markdownDoc';

/**
 * İç içe yapıyı sınamak için: `structure` + `array` + iç `structure`.
 * `codegenSupport.test.ts`teki şemayla aynı biçim — iki testin aynı iskeleti
 * görmesi, düzleştirme davranışındaki bir değişikliği ikisinde birden yakalar.
 */
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

/** Her alanı sabit genişlikte: bayt haritası çizilebilen tek durum. */
const FIXED_SCHEMA: ProtocolSchema = {
  name: 'Fixed Frame',
  version: '2.0',
  description: 'Fixed layout example.',
  framing: { type: 'startEnd', startBytes: [0x02], endBytes: [0x03], maximumFrameLength: 16 },
  fields: [
    { id: 'address', name: 'Address', type: 'uint8', offset: 1, length: 1 },
    {
      id: 'value',
      name: 'Value',
      type: 'uint16',
      offset: 2,
      endianness: 'little',
      scale: 0.1,
      calibrationOffset: -40,
      unit: 'V',
    },
    { id: 'crc', name: 'CRC', type: 'crc', algorithm: 'CRC16_MODBUS' },
  ],
};

describe('generateMarkdownDoc artifact', () => {
  it('describes itself as a markdown artifact with a snake_case file name', () => {
    const artifact = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL);
    expect(artifact.id).toBe('markdown-doc');
    expect(artifact.language).toBe('markdown');
    expect(artifact.fileName).toBe('alp_sensor_protocol.md');
    expect(artifact.code.endsWith('\n')).toBe(true);
  });

  it('transliterates a Turkish protocol name into the file name', () => {
    const artifact = generateMarkdownDoc({ ...SPEC_SENSOR_PROTOCOL, name: 'Sıcaklık Ölçümü' });
    expect(artifact.fileName).toBe('sicaklik_olcumu.md');
  });

  it('writes an HTML comment banner by default and drops it on request', () => {
    const withBanner = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(withBanner.startsWith('<!--')).toBe(true);
    expect(withBanner).toContain('ALP Sensor Protocol');

    const without = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL, { banner: false }).code;
    expect(without.startsWith('# ALP Sensor Protocol')).toBe(true);
    expect(without).not.toContain('<!--');
  });

  it('is deterministic: the same schema yields byte-identical text', () => {
    const first = generateMarkdownDoc(NESTED_SCHEMA).code;
    const second = generateMarkdownDoc(NESTED_SCHEMA).code;
    expect(first).toBe(second);
    // Tarih damgası kaçağının en kolay işareti: dört haneli yıl.
    expect(/20\d\d-\d\d-\d\d/.test(first)).toBe(false);
  });
});

describe('generateMarkdownDoc header and framing', () => {
  it('prints the title, version and description', () => {
    const code = generateMarkdownDoc(FIXED_SCHEMA, { banner: false }).code;
    expect(code).toContain('# Fixed Frame');
    expect(code).toContain('**Version:** 2.0');
    expect(code).toContain('Fixed layout example.');
  });

  it('renders framing bytes as hex and the maximum frame length', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('## Framing');
    expect(code).toContain('| Type | `startEnd` |');
    expect(code).toContain('| Start bytes | `0xAA` |');
    expect(code).toContain('| End bytes | `0x55` |');
    expect(code).toContain('| Maximum frame length | 256 bytes |');
  });

  it('marks missing framing bytes instead of leaving empty cells', () => {
    const code = generateMarkdownDoc(NESTED_SCHEMA).code;
    expect(code).toContain('| Start bytes | - |');
    expect(code).toContain('| End bytes | - |');
  });
});

describe('generateMarkdownDoc field table', () => {
  it('emits the fixed eight-column header', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain(
      '| Offset | Name | Type | Length | Endianness | Scale | Unit | Description |',
    );
    expect(code).toContain('| --- | --- | --- | --- | --- | --- | --- | --- |');
  });

  it('fills a simple row from the spec schema', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('| 1 | `address` | `uint8` | 1 byte | - | - | - | Device Address |');
  });

  it('shows a dynamic length as a reference to the source field', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain(
      '| 4 | `payload` | `rawBytes` | from `payloadLength` | - | - | - | Payload |',
    );
  });

  it('leaves the offset empty once it can no longer be computed', () => {
    // `payload` dinamik uzunlukta, dolayısıyla ondan sonraki checksum'ın bayt
    // konumu bilinemez — uydurulmuş bir sayı yazılmamalı.
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('| - | `checksum` | `checksum` | 1 byte |');
  });

  it('continues the offset cursor when a field omits its offset', () => {
    // FIXED_SCHEMA'da `crc` ofset taşımıyor: 2 + 2 = 4'ten başlar, genişliği
    // CRC16_MODBUS'tan 2 bayt gelir.
    const code = generateMarkdownDoc(FIXED_SCHEMA).code;
    expect(code).toContain('| 4 | `crc` | `crc` | 2 bytes |');
  });

  it('lists nested leaf fields by path and notes the repeating array scope', () => {
    const code = generateMarkdownDoc(NESTED_SCHEMA).code;
    expect(code).toContain('| 0 | `header.deviceAddress` |');
    expect(code).toContain('| 1 | `header.itemCount` |');
    expect(code).toContain('| - | `items[].value` |');
    expect(code).toContain('| - | `items[].flags.alarm` |');
    // Bileşik alanların KENDİSİ tabloya girmez.
    expect(code).not.toContain('| `header` |');
    expect(code).toContain('Paths containing `[]`');
  });

  it('prints endianness only for multi-byte numeric fields', () => {
    const code = generateMarkdownDoc(FIXED_SCHEMA).code;
    expect(code).toContain('| 2 | `value` | `uint16` | 2 bytes | little | 0.1 (offset -40) | V |');
    // Tek baytlık `address` için bayt sırası anlamsız.
    expect(code).toContain('| 1 | `address` | `uint8` | 1 byte | - |');
  });

  it('falls back to the schema default endianness', () => {
    const code = generateMarkdownDoc({ ...FIXED_SCHEMA, defaultEndianness: 'big' }, { banner: false })
      .code;
    // Alanın kendi ayarı (little) şema varsayılanını yener.
    expect(code).toContain('| 2 | `value` | `uint16` | 2 bytes | little |');
    const withoutFieldSetting = generateMarkdownDoc({
      ...NESTED_SCHEMA,
      defaultEndianness: 'little',
    }).code;
    expect(withoutFieldSetting).toContain('| - | `items[].value` | `uint16` | 2 bytes | little |');
  });

  it('escapes pipe characters so the table survives', () => {
    const schema: ProtocolSchema = {
      ...FIXED_SCHEMA,
      fields: [
        {
          id: 'flags',
          name: 'Flags',
          type: 'uint8',
          offset: 1,
          length: 1,
          description: 'bit0 | bit1 set',
          unit: 'a|b',
        },
      ],
    };
    const code = generateMarkdownDoc(schema).code;
    expect(code).toContain('bit0 \\| bit1 set');
    expect(code).toContain('a\\|b');
    expect(code).not.toContain('bit0 | bit1');
  });

  it('describes a bit field in bits, not rounded bytes', () => {
    const schema: ProtocolSchema = {
      ...NESTED_SCHEMA,
      fields: [{ id: 'alarm', name: 'Alarm', type: 'bitField', bitOffset: 3, bitLength: 5 }],
    };
    const code = generateMarkdownDoc(schema).code;
    expect(code).toContain('| `bitField` | 5 bits |');
  });
});

describe('generateMarkdownDoc enum sections', () => {
  it('writes one value table per enum field, sorted numerically with hex', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('### `command` values');
    expect(code).toContain('| Value | Name |');
    const table = code.slice(code.indexOf('### `command` values'));
    expect(table).toContain('| 16 (0x10) | Sensor Data |');
    expect(table).toContain('| 32 (0x20) | Set Output |');
    expect(table).toContain('| 48 (0x30) | Status Request |');
    expect(table.indexOf('| 16 (0x10)')).toBeLessThan(table.indexOf('| 32 (0x20)'));
  });

  it('sorts enum keys numerically even when the schema lists them out of order', () => {
    const schema: ProtocolSchema = {
      ...SPEC_SENSOR_PROTOCOL,
      fields: [
        {
          id: 'mode',
          name: 'Mode',
          type: 'enum',
          offset: 1,
          length: 1,
          enumValues: { '10': 'Ten', '2': 'Two', '1': 'One' },
        },
      ],
    };
    const code = generateMarkdownDoc(schema).code;
    expect(code.indexOf('| 1 (0x1) | One |')).toBeLessThan(code.indexOf('| 2 (0x2) | Two |'));
    expect(code.indexOf('| 2 (0x2) | Two |')).toBeLessThan(code.indexOf('| 10 (0xA) | Ten |'));
  });

  it('omits the value section for fields without an enum table', () => {
    const code = generateMarkdownDoc(FIXED_SCHEMA).code;
    expect(code).not.toContain(' values');
  });
});

describe('generateMarkdownDoc checksum section', () => {
  it('reports algorithm, coverage and width as a nested list', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('## Checksum');
    expect(code).toContain('- `checksum`');
    expect(code).toContain('  - Algorithm: `xor8`');
    expect(code).toContain('  - Coverage: `address` .. `payload`');
    expect(code).toContain('  - Width: 1 byte');
  });

  it('honours a custom indent for the nested list', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL, { indent: '    ' }).code;
    expect(code).toContain('    - Algorithm: `xor8`');
  });

  it('marks a missing coverage instead of inventing one', () => {
    const code = generateMarkdownDoc(NESTED_SCHEMA).code;
    expect(code).toContain('- `crc`');
    expect(code).toContain('  - Algorithm: `CRC16_MODBUS`');
    expect(code).toContain('  - Coverage: not specified');
    expect(code).toContain('  - Width: 2 bytes');
  });

  it('states plainly when no checksum field exists', () => {
    const schema: ProtocolSchema = {
      ...FIXED_SCHEMA,
      fields: [{ id: 'address', name: 'Address', type: 'uint8', offset: 1, length: 1 }],
    };
    expect(generateMarkdownDoc(schema).code).toContain(
      'This protocol defines no checksum or CRC field.',
    );
  });
});

describe('generateMarkdownDoc byte layout', () => {
  it('draws an aligned byte map for a fixed length schema', () => {
    const code = generateMarkdownDoc(FIXED_SCHEMA).code;
    expect(code).toContain('## Byte layout');
    expect(code).toContain('Total frame length: 7 bytes.');

    const drawing = code.slice(code.indexOf('```text') + '```text\n'.length);
    const lines = drawing.slice(0, drawing.indexOf('```')).trimEnd().split('\n');
    expect(lines).toHaveLength(5);
    // Kutu çizimi ancak bütün satırlar aynı genişlikteyse hizalı görünür.
    const widths = new Set(lines.map((line) => line.length));
    expect(widths.size).toBe(1);
    expect(lines[0]?.startsWith('+---')).toBe(true);
    expect(drawing).toContain('address');
    expect(drawing).toContain('start');
    expect(drawing).toContain('end');
    // Çok baytlı alan bayt ARALIĞIYLA etiketlenir.
    expect(drawing).toContain('2-3');
    expect(drawing).toContain('4-5');
  });

  it('falls back to a variable length note when a field is sized at run time', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('## Byte layout');
    expect(code).toContain('variable length');
    expect(code).not.toContain('+---');
  });

  it('treats an array scope as variable length as well', () => {
    const code = generateMarkdownDoc(NESTED_SCHEMA).code;
    expect(code).toContain('variable length');
    expect(code).not.toContain('+---');
  });
});

describe('generateMarkdownDoc example frame', () => {
  it('omits the section when no example frame is supplied', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL).code;
    expect(code).not.toContain('## Example frame');
  });

  it('prints the supplied frame as an uppercase hex dump', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL, {
      exampleFrame: SPEC_SENSOR_FRAME,
    }).code;
    expect(code).toContain('## Example frame');
    expect(code).toContain('9 bytes:');
    expect(code).toContain('0000: AA 05 10 03 34 12 7F 4F 55');
  });

  it('wraps a long frame into 16 byte rows', () => {
    const frame = Uint8Array.from({ length: 18 }, (_unused, index) => index);
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL, { exampleFrame: frame }).code;
    expect(code).toContain('0000: 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F');
    expect(code).toContain('0010: 10 11');
  });

  it('skips the section for an empty frame', () => {
    const code = generateMarkdownDoc(SPEC_SENSOR_PROTOCOL, {
      exampleFrame: new Uint8Array(0),
    }).code;
    expect(code).not.toContain('## Example frame');
  });
});
