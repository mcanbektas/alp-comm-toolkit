import { describe, expect, it } from 'vitest';

import { buildRegionMap } from './layout';
import {
  collectSchemaBitRanges,
  parsedFieldsToRegions,
  parsedFrameToRegions,
  toRootFieldId,
} from './parsedFieldAdapter';
import { parseWithSchema } from '@/protocol-core/decoding/schemaParser';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import { createRawFrame } from '@/protocol-core/types';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

/**
 * İç içe yapı + dizi + bit alanı içeren ikinci şema. Spec fixture'ı DÜZ:
 * kimlik ad uzayı, dizi tekrarı ve bit penceresi yalnız burada sınanabiliyor.
 *
 * Çerçeve: 01 1F 02 0A 00C8 0B 012C
 *   01     header.version
 *   1F     header.flags [b0..b3] + header.ready [b4]  (AYNI bayt)
 *   02     count = 2 → samples iki kez tekrarlar
 *   0A     samples[0].id
 *   00 C8  samples[0].value
 *   0B     samples[1].id
 *   01 2C  samples[1].value
 *   —      pad: uzunluğu 0, bölge üretmemeli
 */
const TELEMETRY_SCHEMA: ProtocolSchema = {
  name: 'Telemetry',
  version: '1.0',
  framing: { type: 'none', maximumFrameLength: 64 },
  fields: [
    {
      id: 'header',
      name: 'Header',
      type: 'structure',
      fields: [
        { id: 'version', name: 'Version', type: 'uint8', offset: 0, length: 1 },
        { id: 'flags', name: 'Flags', type: 'bitField', offset: 1, bitOffset: 0, bitLength: 4 },
        { id: 'ready', name: 'Ready', type: 'bitField', offset: 1, bitOffset: 4, bitLength: 1 },
      ],
    },
    { id: 'count', name: 'Sample Count', type: 'uint8', offset: 2, length: 1 },
    {
      id: 'samples',
      name: 'Samples',
      type: 'array',
      repeatCount: { fromField: 'count' },
      fields: [
        { id: 'id', name: 'Sample Id', type: 'uint8', length: 1 },
        { id: 'value', name: 'Sample Value', type: 'uint16', length: 2 },
      ],
    },
    { id: 'pad', name: 'Padding', type: 'padding', length: 0 },
  ],
};

const TELEMETRY_FRAME = Uint8Array.from([0x01, 0x1f, 0x02, 0x0a, 0x00, 0xc8, 0x0b, 0x01, 0x2c]);

/** Checksum baytı bozulmuş spec çerçevesi: 0x4F yerine 0x00. */
const SPEC_FRAME_BAD_CHECKSUM = Uint8Array.from([
  0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x00, 0x55,
]);

function parseOrThrow(schema: ProtocolSchema, bytes: Uint8Array): ParsedFrame {
  const result = parseWithSchema(schema, bytes);
  if (!result.success) {
    throw new Error(`Fixture ayrıştırılamadı: ${result.error.message}`);
  }
  return result.frame;
}

function makeField(
  id: string,
  offset: number,
  length: number,
  overrides: Partial<ParsedField> = {},
): ParsedField {
  return {
    id,
    name: id,
    offset,
    length,
    rawBytes: new Uint8Array(length > 0 ? length : 0),
    valid: true,
    warnings: [],
    ...overrides,
  };
}

describe('parsedFieldsToRegions — spec fixture', () => {
  it('maps every parsed field to a region with the same byte geometry', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const regions = parsedFieldsToRegions(frame.fields);

    expect(regions.map((region) => region.id)).toEqual([
      'address',
      'command',
      'payloadLength',
      'payload',
      'checksum',
    ]);
    expect(regions.map((region) => [region.offset, region.length])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 3],
      [7, 1],
    ]);
  });

  it('uses the human readable field name, not the id', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const regions = parsedFieldsToRegions(frame.fields);

    expect(regions.map((region) => region.name)).toEqual([
      'Device Address',
      'Command',
      'Payload Length',
      'Payload',
      'Checksum',
    ]);
  });

  it('cycles leaf colours through 0..3 and wraps on the fifth field', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const regions = parsedFieldsToRegions(frame.fields);

    expect(regions.map((region) => region.colorIndex)).toEqual([0, 1, 2, 3, 0]);
  });

  it('shifts the cycle by colorSeed and wraps a seed above the palette size', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);

    expect(parsedFieldsToRegions(frame.fields, { colorSeed: 2 }).map((r) => r.colorIndex)).toEqual([
      2, 3, 0, 1, 2,
    ]);
    // 6 ≡ 2 (mod 4): tur sayısı değil, kalan önemli.
    expect(parsedFieldsToRegions(frame.fields, { colorSeed: 6 }).map((r) => r.colorIndex)).toEqual([
      2, 3, 0, 1, 2,
    ]);
  });

  it('leaves valid fields unmarked', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const regions = parsedFieldsToRegions(frame.fields);

    expect(regions.every((region) => region.invalid === undefined)).toBe(true);
  });

  it('marks a field that failed validation as invalid', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_FRAME_BAD_CHECKSUM);
    const regions = parsedFieldsToRegions(frame.fields);
    const checksum = regions.find((region) => region.id === 'checksum');

    expect(checksum?.invalid).toBe(true);
    // Geçersiz alan renk sırasını yine de tüketir: renk kimliğe bağlıdır,
    // çerçevenin geçerliliğine değil.
    expect(checksum?.colorIndex).toBe(0);
    expect(regions.filter((region) => region.invalid === true)).toHaveLength(1);
  });
});

describe('parsedFieldsToRegions — containment order', () => {
  it('puts the container before its leaves even when the input is leaf-first', () => {
    const fields = [
      makeField('payload.tail', 6, 2),
      makeField('payload.head', 4, 1),
      makeField('payload', 4, 4),
    ];

    expect(parsedFieldsToRegions(fields).map((region) => region.id)).toEqual([
      'payload',
      'payload.head',
      'payload.tail',
    ]);
  });

  it('gives colours to leaves only, so the container never steals a slot', () => {
    const fields = [
      makeField('payload', 4, 4),
      makeField('payload.head', 4, 1),
      makeField('payload.tail', 6, 2),
      makeField('trailer', 8, 1),
    ];
    const regions = parsedFieldsToRegions(fields);

    expect(regions.map((region) => [region.id, region.colorIndex])).toEqual([
      ['payload', undefined],
      ['payload.head', 0],
      ['payload.tail', 1],
      ['trailer', 2],
    ]);
  });

  it('treats an equal range with a deeper id as a leaf that overrides its parent', () => {
    const fields = [makeField('body.only', 2, 2), makeField('body', 2, 2)];
    const regions = parsedFieldsToRegions(fields);

    expect(regions.map((region) => region.id)).toEqual(['body', 'body.only']);
    expect(regions[0]?.colorIndex).toBeUndefined();
    expect(regions[1]?.colorIndex).toBe(0);
  });

  it('lets the leaf win in the byte map layout builds from these regions', () => {
    const fields = [
      makeField('payload', 4, 4),
      makeField('payload.head', 4, 1),
      makeField('payload.tail', 6, 2),
    ];
    const map = buildRegionMap(parsedFieldsToRegions(fields), 9);

    expect(map[4]?.region.id).toBe('payload.head');
    // 5. bayt hiçbir yaprağa ait değil: kapsayıcı orada görünür kalır.
    expect(map[5]?.region.id).toBe('payload');
    expect(map[6]?.region.id).toBe('payload.tail');
  });
});

describe('parsedFieldsToRegions — nested and repeated schema', () => {
  it('emits one region per parsed leaf in byte order', () => {
    const frame = parseOrThrow(TELEMETRY_SCHEMA, TELEMETRY_FRAME);
    const regions = parsedFieldsToRegions(frame.fields);

    expect(regions.map((region) => region.id)).toEqual([
      'header.version',
      'header.flags',
      'header.ready',
      'count',
      'samples[0].id',
      'samples[0].value',
      'samples[1].id',
      'samples[1].value',
    ]);
  });

  it('drops the zero length field without spending a colour slot', () => {
    const frame = parseOrThrow(TELEMETRY_SCHEMA, TELEMETRY_FRAME);
    // Şema gerçekten sıfır uzunluklu bir alan üretiyor; test onu elemeyi ölçüyor.
    expect(frame.fields.some((field) => field.id === 'pad' && field.length === 0)).toBe(true);

    const regions = parsedFieldsToRegions(frame.fields);
    expect(regions.some((region) => region.id === 'pad')).toBe(false);
    expect(regions.map((region) => region.colorIndex)).toEqual([0, 1, 2, 3, 0, 1, 0, 1]);
  });

  it('paints repeated array elements of the same schema field with one colour', () => {
    const frame = parseOrThrow(TELEMETRY_SCHEMA, TELEMETRY_FRAME);
    const byId = new Map(parsedFieldsToRegions(frame.fields).map((r) => [r.id, r] as const));

    expect(byId.get('samples[0].id')?.colorIndex).toBe(byId.get('samples[1].id')?.colorIndex);
    expect(byId.get('samples[0].value')?.colorIndex).toBe(byId.get('samples[1].value')?.colorIndex);
    // Aynı elemanın iki ayrı alanı yine de birbirinden ayrılır.
    expect(byId.get('samples[0].id')?.colorIndex).not.toBe(byId.get('samples[0].value')?.colorIndex);
  });

  it('appends the bit range to bit fields sharing a single byte', () => {
    const frame = parseOrThrow(TELEMETRY_SCHEMA, TELEMETRY_FRAME);
    const regions = parsedFieldsToRegions(frame.fields, {
      bitRanges: collectSchemaBitRanges(TELEMETRY_SCHEMA),
    });
    const flags = regions.find((region) => region.id === 'header.flags');
    const ready = regions.find((region) => region.id === 'header.ready');

    expect(flags?.name).toBe('Flags [b0..b3]');
    expect(ready?.name).toBe('Ready [b4]');
    // Bayt çözünürlüğü: iki alan da aynı aralığı gösterir, ayıran tek şey addır.
    expect([flags?.offset, flags?.length]).toEqual([1, 1]);
    expect([ready?.offset, ready?.length]).toEqual([1, 1]);
    expect(flags?.colorIndex).not.toBe(ready?.colorIndex);
  });

  it('drops the bit range suffix when showBitRange is false', () => {
    const frame = parseOrThrow(TELEMETRY_SCHEMA, TELEMETRY_FRAME);
    const regions = parsedFieldsToRegions(frame.fields, {
      bitRanges: collectSchemaBitRanges(TELEMETRY_SCHEMA),
      showBitRange: false,
    });

    expect(regions.find((region) => region.id === 'header.flags')?.name).toBe('Flags');
  });

  it('collects schema bit ranges under index free keys', () => {
    const ranges = collectSchemaBitRanges({
      ...TELEMETRY_SCHEMA,
      fields: [
        {
          id: 'samples',
          name: 'Samples',
          type: 'array',
          repeatCount: 2,
          fields: [{ id: 'flag', name: 'Flag', type: 'bitField', bitOffset: 3, bitLength: 1 }],
        },
      ],
    });

    expect(ranges.get('samples.flag')).toEqual({ bitOffset: 3, bitLength: 1 });
    // Ad uzayı kökü üzerinden her elemana uygulanır.
    expect(toRootFieldId('samples[7].flag')).toBe('samples.flag');
  });
});

describe('parsedFieldsToRegions — degenerate input', () => {
  it('falls back to the id when the name is blank', () => {
    const regions = parsedFieldsToRegions([makeField('crc16', 0, 2, { name: '   ' })]);

    expect(regions[0]?.name).toBe('crc16');
  });

  it('skips undrawable geometry without disturbing the colour cycle', () => {
    const fields = [
      makeField('ghost.negative', -1, 2),
      makeField('first', 0, 1),
      makeField('ghost.fractional', 1.5, 1),
      makeField('second', 1, 1),
    ];
    const regions = parsedFieldsToRegions(fields);

    expect(regions.map((region) => [region.id, region.colorIndex])).toEqual([
      ['first', 0],
      ['second', 1],
    ]);
  });

  it('returns an empty list for an empty field list', () => {
    expect(parsedFieldsToRegions([])).toEqual([]);
  });
});

describe('parsedFrameToRegions', () => {
  it('matches the field adapter when the frame carries no errors', () => {
    const frame = parseOrThrow(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);

    expect(parsedFrameToRegions(frame)).toEqual(parsedFieldsToRegions(frame.fields));
  });

  it('marks a still-valid field that a frame level error points at', () => {
    const bytes = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
    const frame: ParsedFrame = {
      protocol: 'Manual',
      timestamp: 0,
      rawFrame: createRawFrame(bytes),
      fields: [makeField('head', 0, 2), makeField('tail', 2, 2)],
      valid: false,
      errors: [{ code: 'length-mismatch', message: 'Uzunluk tutmuyor', offset: 2, length: 2 }],
      warnings: [],
    };
    const regions = parsedFrameToRegions(frame);

    expect(regions.find((region) => region.id === 'head')?.invalid).toBeUndefined();
    expect(regions.find((region) => region.id === 'tail')?.invalid).toBe(true);
  });

  it('ignores frame errors that carry no offset', () => {
    const bytes = Uint8Array.from([0x01, 0x02]);
    const frame: ParsedFrame = {
      protocol: 'Manual',
      timestamp: 0,
      rawFrame: createRawFrame(bytes),
      fields: [makeField('head', 0, 2)],
      valid: false,
      errors: [{ code: 'parser-timeout', message: 'İptal edildi' }],
      warnings: [],
    };

    expect(parsedFrameToRegions(frame)[0]?.invalid).toBeUndefined();
  });

  it('marks the region an offset-only error lands in, one byte wide', () => {
    const bytes = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
    const frame: ParsedFrame = {
      protocol: 'Manual',
      timestamp: 0,
      rawFrame: createRawFrame(bytes),
      fields: [makeField('head', 0, 2), makeField('tail', 2, 2)],
      valid: false,
      errors: [{ code: 'checksum-mismatch', message: 'Bozuk', offset: 1 }],
      warnings: [],
    };
    const regions = parsedFrameToRegions(frame);

    expect(regions.find((region) => region.id === 'head')?.invalid).toBe(true);
    expect(regions.find((region) => region.id === 'tail')?.invalid).toBeUndefined();
  });
});
