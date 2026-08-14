import { describe, expect, it } from 'vitest';

import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { generateTypeScriptParser } from './typeScriptParser';

/** İç içe yapı + dizi + CRC: düz spec fixture'ının sınamadığı yollar. */
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
        {
          id: 'value',
          name: 'Value',
          type: 'uint16',
          scale: 0.1,
          calibrationOffset: -40,
          unit: '°C',
        },
        {
          id: 'flags',
          name: 'Flags',
          type: 'structure',
          fields: [{ id: 'alarm', name: 'Alarm', type: 'boolean' }],
        },
      ],
    },
    {
      id: 'crc',
      name: 'CRC',
      type: 'crc',
      algorithm: 'CRC16_MODBUS',
      coverage: { startField: 'header', endField: 'items' },
    },
  ],
};

/** Geniş tipler, bit alanı, koşul ve little-endian varsayılanı. */
const WIDE_SCHEMA: ProtocolSchema = {
  name: 'Wide Types',
  version: '2.0',
  defaultEndianness: 'little',
  framing: { type: 'none', maximumFrameLength: 64 },
  fields: [
    { id: 'serial', name: 'Serial', type: 'uint64' },
    { id: 'stamp', name: 'Stamp', type: 'dateTime' },
    { id: 'temperature', name: 'Temperature', type: 'float16', scale: 2, unit: 'C' },
    { id: 'flags', name: 'Flags', type: 'bitField', bitOffset: 3, bitLength: 5 },
    { id: 'label', name: 'Label', type: 'ascii', length: 4 },
    { id: 'trail', name: 'Trail', type: 'utf8', lengthFrom: 'flags' },
    {
      id: 'optional',
      name: 'Optional Thing',
      type: 'int24',
      condition: { field: 'flags', equals: 1 },
    },
  ],
};

/**
 * Üretilen metnin geçerli TypeScript olduğunu `eval`/`new Function` ile
 * SINAMAK YASAK (spec §41). Onun yerine yapısal bir değişmez doğrulanır:
 * dizeler ve yorumlar atlanarak parantez/süslü/köşeli sayımı denkleşmeli.
 * Dengesiz bir sayım, üreticinin bir bloğu kapatmayı unuttuğunun kanıtıdır.
 */
function delimiterBalance(source: string): Readonly<Record<string, number>> {
  const counts = { round: 0, curly: 0, square: 0 };
  let index = 0;
  while (index < source.length) {
    const character = source.charAt(index);
    const pair = source.slice(index, index + 2);
    if (pair === '//') {
      const newline = source.indexOf('\n', index);
      index = newline === -1 ? source.length : newline;
      continue;
    }
    if (pair === '/*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      index += 1;
      while (index < source.length && source.charAt(index) !== character) {
        index += source.charAt(index) === '\\' ? 2 : 1;
      }
      index += 1;
      continue;
    }
    if (character === '(') {
      counts.round += 1;
    } else if (character === ')') {
      counts.round -= 1;
    } else if (character === '{') {
      counts.curly += 1;
    } else if (character === '}') {
      counts.curly -= 1;
    } else if (character === '[') {
      counts.square += 1;
    } else if (character === ']') {
      counts.square -= 1;
    }
    index += 1;
  }
  return counts;
}

describe('generateTypeScriptParser artifact', () => {
  it('reports the artifact identity from the schema name', () => {
    const artifact = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL);
    expect(artifact.id).toBe('typescript-parser');
    expect(artifact.language).toBe('typescript');
    expect(artifact.fileName).toBe('alpSensorProtocolParser.ts');
    // Dosya adı dizin yolu taşımaz.
    expect(artifact.fileName).not.toContain('/');
  });

  it('writes the banner by default and drops it on request', () => {
    const withBanner = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    const withoutBanner = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL, {
      banner: false,
    }).code;
    expect(withBanner).toContain('elle düzenlemeyin');
    expect(withBanner).toContain('Protokol: ALP Sensor Protocol');
    expect(withoutBanner).not.toContain('elle düzenlemeyin');
    // Başlık dışındaki her şey aynı kalmalı.
    expect(withoutBanner).toContain('export function parseAlpSensorProtocol');
  });

  it('produces byte-identical output for the same schema', () => {
    const first = generateTypeScriptParser(NESTED_SCHEMA).code;
    const second = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(first).toBe(second);
    // Tarih damgası determinizmi bozardı.
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('honours the indent option', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL, { indent: '    ' }).code;
    expect(code).toContain('\n    readonly payload: Uint8Array;');
    expect(code).toContain('\n    let cursor = 0;');
  });
});

describe('generateTypeScriptParser declarations', () => {
  it('exports the error class, the interface and the parse function', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('export class AlpSensorProtocolParseError extends Error {');
    expect(code).toContain("this.name = 'AlpSensorProtocolParseError';");
    expect(code).toContain('export interface AlpSensorProtocol {');
    expect(code).toContain(
      'export function parseAlpSensorProtocol(data: Uint8Array): AlpSensorProtocol {',
    );
  });

  it('maps field types through typeScriptTypeFor', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('readonly deviceAddress: number;');
    expect(code).toContain('readonly payload: Uint8Array;');
    expect(code).toContain('readonly checksum: number;');
  });

  it('reads 64 bit fields as bigint with DataView', () => {
    const code = generateTypeScriptParser(WIDE_SCHEMA).code;
    expect(code).toContain('readonly serial: bigint;');
    expect(code).toContain('readonly stamp: bigint;');
    expect(code).toContain('const serial = view.getBigUint64(cursor, true);');
  });

  it('emits a sorted, quoted enum table with a label lookup', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('export const CommandValues = {');
    // Anahtarlar tırnaklı: negatif değerler tırnaksız yazılamaz.
    expect(code).toContain("'16': 'Sensor Data',");
    expect(code.indexOf("'16'")).toBeLessThan(code.indexOf("'48'"));
    expect(code).toContain(
      'export type CommandValue = (typeof CommandValues)[keyof typeof CommandValues];',
    );
    expect(code).toContain('export function commandLabel(value: number): string | undefined {');
  });

  it('generates one interface per composite field', () => {
    const code = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(code).toContain('export interface NestedTelemetryHeader {');
    expect(code).toContain('export interface NestedTelemetryItemsItem {');
    expect(code).toContain('export interface NestedTelemetryFlags {');
    expect(code).toContain('readonly items: readonly NestedTelemetryItemsItem[];');
    // İç arayüzler kökten ÖNCE gelmeli ki dosya içten dışa okunsun.
    expect(code.indexOf('interface NestedTelemetryHeader')).toBeLessThan(
      code.indexOf('export interface NestedTelemetry {'),
    );
  });
});

describe('generateTypeScriptParser parse body', () => {
  it('jumps to explicit offsets and advances the cursor otherwise', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('cursor = 4;');
    expect(code).toContain('cursor += payloadByteLength;');
  });

  it('resolves lengthFrom to the previously read field', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('const payloadByteLength = payloadLength;');
    expect(code).toContain('const payload = data.slice(cursor, cursor + payloadByteLength);');
  });

  it('falls back to the remaining bytes when lengthFrom points forward', () => {
    const forwardReference: ProtocolSchema = {
      name: 'Forward Reference',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 32 },
      fields: [
        { id: 'body', name: 'Body', type: 'rawBytes', lengthFrom: 'size' },
        { id: 'size', name: 'Size', type: 'uint8' },
      ],
    };
    const code = generateTypeScriptParser(forwardReference).code;
    expect(code).toContain('bu kapsamda görünmüyor');
    expect(code).toContain('const bodyByteLength = data.length - cursor;');
  });

  it('verifies simple checksums over the coverage span', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('const deviceAddressCoverageStart = cursor;');
    expect(code).toContain('const payloadCoverageEnd = cursor;');
    expect(code).toContain(
      'const checksumComputed = computeXor8(data.subarray(deviceAddressCoverageStart, payloadCoverageEnd));',
    );
    expect(code).toContain('if (checksumComputed !== checksum) {');
    expect(code).toContain('throw new AlpSensorProtocolParseError(');
  });

  it('inlines the catalogue CRC parameters and compares as bigint', () => {
    const code = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(code).toContain('poly: 0x8005n,');
    expect(code).toContain('init: 0xffffn,');
    expect(code).toContain('refin: true,');
    expect(code).toContain('xorout: 0x0000n,');
    expect(code).toContain('if (crcComputed !== BigInt(crc)) {');
  });

  it('loops over arrays with the repeat count field', () => {
    const code = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(code).toContain('const items: NestedTelemetryItemsItem[] = [];');
    expect(code).toContain('const itemsCount = itemCount;');
    expect(code).toContain('for (let itemsIndex = 0; itemsIndex < itemsCount; itemsIndex += 1) {');
    expect(code).toContain('items.push({');
  });

  it('adds a physical value next to the raw one when the field is scaled', () => {
    const code = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(code).toContain('readonly physicalValue: number;');
    expect(code).toContain('const physicalValue = value * 0.1 - 40;');
  });

  it('makes conditional fields optional and wraps the read in an if', () => {
    const code = generateTypeScriptParser(WIDE_SCHEMA).code;
    expect(code).toContain('readonly optionalThing?: number;');
    expect(code).toContain('let optionalThing: number | undefined;');
    expect(code).toContain('if (flags === 1) {');
    expect(code).toContain('optionalThing = readInt24(view, cursor, true);');
  });

  it('reads bit fields through the bit helper with the schema offsets', () => {
    const code = generateTypeScriptParser(WIDE_SCHEMA).code;
    expect(code).toContain('const flags = readBits(data, cursor, 3, 5, true);');
    // bitOffset + bitLength = 8 bit → tek bayt ilerler.
    expect(code).toContain('ensureAvailable(data, cursor, 1);');
  });

  it('carries the schema endianness into every DataView call', () => {
    const little = generateTypeScriptParser(WIDE_SCHEMA).code;
    const big = generateTypeScriptParser(NESTED_SCHEMA).code;
    expect(little).toContain('view.getBigUint64(cursor, true)');
    expect(big).toContain('view.getUint16(cursor, false)');
  });

  it('checks the framing bytes with a guarded index access', () => {
    const code = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    expect(code).toContain('const expectedStart = [170];');
    expect(code).toContain('const expectedEnd = [85];');
    // Ham indeksin sonucu doğrudan karşılaştırılır; `undefined` da uyuşmazlıktır.
    expect(code).toContain('const actual = data[index];');
    expect(code).toContain('if (data.length > 256) {');
  });

  it('skips checksum fields whose algorithm is none', () => {
    const noChecksum: ProtocolSchema = {
      name: 'No Checksum',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [
        { id: 'value', name: 'Value', type: 'uint8' },
        { id: 'unused', name: 'Unused', type: 'checksum', algorithm: 'none' },
      ],
    };
    const code = generateTypeScriptParser(noChecksum).code;
    expect(code).not.toContain('unused');
    expect(code).toContain('readonly value: number;');
  });
});

describe('generateTypeScriptParser output hygiene', () => {
  const schemas: readonly ProtocolSchema[] = [
    SPEC_SENSOR_PROTOCOL,
    NESTED_SCHEMA,
    WIDE_SCHEMA,
  ];

  it('keeps every delimiter balanced', () => {
    for (const schema of schemas) {
      expect(delimiterBalance(generateTypeScriptParser(schema).code)).toEqual({
        round: 0,
        curly: 0,
        square: 0,
      });
    }
  });

  it('never emits any, ts-ignore or dynamic code execution', () => {
    for (const schema of schemas) {
      const code = generateTypeScriptParser(schema).code;
      expect(code).not.toMatch(/\bany\b/);
      expect(code).not.toContain('@ts-ignore');
      expect(code).not.toContain('eval(');
      expect(code).not.toContain('new Function');
    }
  });

  it('writes tab-free lines without trailing whitespace and ends with a newline', () => {
    for (const schema of schemas) {
      const code = generateTypeScriptParser(schema).code;
      expect(code).not.toContain('\t');
      expect(code.endsWith('\n')).toBe(true);
      for (const codeLine of code.split('\n')) {
        expect(codeLine).toBe(codeLine.replace(/\s+$/, ''));
      }
    }
  });

  it('emits only the helpers the schema actually needs', () => {
    const spec = generateTypeScriptParser(SPEC_SENSOR_PROTOCOL).code;
    const wide = generateTypeScriptParser(WIDE_SCHEMA).code;
    expect(spec).toContain('function computeXor8(');
    expect(spec).not.toContain('function decodeFloat16(');
    expect(spec).not.toContain('function computeCrc(');
    expect(wide).toContain('function decodeFloat16(');
    expect(wide).not.toContain('function computeXor8(');
    // readInt24 tek başına derlenmez; bağımlılığı da yazılmalı.
    expect(wide).toContain('function readUint24(');
  });
});
