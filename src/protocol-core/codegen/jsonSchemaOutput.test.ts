import { describe, expect, it } from 'vitest';

import { parseProtocolSchemaJson } from '@/protocol-core/schemas/protocolSchema';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

import { generateJsonSchemaOutput } from './jsonSchemaOutput';

/**
 * §9.6'da söz dizimi olmayan yetenekleri (iç içe yapı, dizi, koşul, bit alanı,
 * kalibrasyon) taşıyan şema: düz fixture bu yolları hiç gezmiyor.
 */
const NESTED_SCHEMA: ProtocolSchema = {
  name: 'Nested Telemetry',
  version: '2.1',
  description: 'İç içe yapı ve dizi taşıyan sınama şeması.',
  defaultEndianness: 'little',
  framing: { type: 'lengthField', maximumFrameLength: 512 },
  fields: [
    {
      id: 'header',
      name: 'Header',
      type: 'structure',
      offset: 0,
      fields: [
        { id: 'deviceAddress', name: 'Device Address', type: 'uint8', length: 1 },
        { id: 'itemCount', name: 'Item Count', type: 'uint8', length: 1 },
      ],
    },
    {
      id: 'items',
      name: 'Items',
      type: 'array',
      repeatCount: { fromField: 'itemCount' },
      fields: [
        { id: 'value', name: 'Value', type: 'int16', length: 2, scale: 0.1, unit: '°C' },
        {
          id: 'flags',
          name: 'Flags',
          type: 'structure',
          length: 1,
          fields: [
            { id: 'alarm', name: 'Alarm', type: 'bitField', bitOffset: 0, bitLength: 1 },
            { id: 'stale', name: 'Stale', type: 'bitField', bitOffset: 1, bitLength: 1 },
          ],
        },
      ],
    },
    {
      id: 'trailer',
      name: 'Trailer',
      type: 'uint8',
      length: 1,
      condition: { field: 'deviceAddress', equals: 5 },
      defaultValue: 0,
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

/** Bir JSON nesnesinin anahtar sırasını okur — sıra bu üreticinin sözleşmesi. */
function keysAt(code: string, pick: (root: Record<string, unknown>) => unknown): readonly string[] {
  const parsed: unknown = JSON.parse(code);
  const picked = pick(parsed as Record<string, unknown>);
  return Object.keys(picked as Record<string, unknown>);
}

describe('generateJsonSchemaOutput', () => {
  it('describes the artifact as downloadable JSON', () => {
    const artifact = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL);

    expect(artifact.id).toBe('json-schema');
    expect(artifact.language).toBe('json');
    expect(artifact.fileName).toBe('alp_sensor_protocol.protocol.json');
  });

  it('reproduces the spec §9.6 document byte for byte', () => {
    // §9.6 "AYNEN" işaretli: metin fixture'ı spec'in kendisi, üreticinin
    // keyfî bir çıktısı değil. Bu yüzden burada tam eşitlik kırılgan değil,
    // asıl sözleşme — girinti, tek satırlık bayt dizisi ve anahtar sırası
    // birlikte doğrulanıyor.
    expect(generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL).code).toBe(SPEC_SENSOR_PROTOCOL_JSON);
  });

  it('round-trips through parseProtocolSchemaJson without loss', () => {
    const result = parseProtocolSchemaJson(generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL).code);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schema).toEqual(SPEC_SENSOR_PROTOCOL);
    }
  });

  it('keeps the spec key order at the document root', () => {
    const { code } = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL);

    expect(keysAt(code, (root) => root)).toEqual(['name', 'version', 'framing', 'fields']);
  });

  it('writes framing keys in spec order and byte arrays on one line', () => {
    const { code } = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL);

    expect(keysAt(code, (root) => root.framing)).toEqual([
      'type',
      'startBytes',
      'endBytes',
      'maximumFrameLength',
    ]);
    expect(code).toContain('"startBytes": [170]');
    expect(code).toContain('"endBytes": [85]');
  });

  it('omits keys the field does not define', () => {
    const { code } = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL);

    // Checksum alanının ofseti YOK (dinamik uzunluktan sonra gelir) — yazılan
    // `"offset": undefined` ya da `null` gidiş-dönüşü bozardı.
    expect(keysAt(code, (root) => (root.fields as readonly unknown[])[4])).toEqual([
      'id',
      'name',
      'type',
      'algorithm',
      'coverage',
    ]);
    expect(code).not.toContain('null');
  });

  it('sorts enumValues numerically regardless of insertion order', () => {
    const schema: ProtocolSchema = {
      ...SPEC_SENSOR_PROTOCOL,
      fields: [
        {
          id: 'mode',
          name: 'Mode',
          type: 'enum',
          offset: 0,
          length: 1,
          // JS nesne gezinme sırası burada ['4', '16', '-8'] verir: tam sayı
          // benzeri anahtarlar öne alınır, negatif olan ekleme sırasında kalır.
          enumValues: { '16': 'Sixteen', '-8': 'Minus Eight', '4': 'Four' },
        },
      ],
    };

    const { code } = generateJsonSchemaOutput(schema);

    // Sıra METİNde aranmalı: `JSON.parse` tam sayı benzeri anahtarları kendi
    // kuralıyla yeniden dizer, yani ayrıştırılmış nesne yazılan sırayı gizler.
    expect(code.indexOf('"-8"')).toBeLessThan(code.indexOf('"4"'));
    expect(code.indexOf('"4"')).toBeLessThan(code.indexOf('"16"'));
  });

  it('produces identical text on repeated runs', () => {
    const first = generateJsonSchemaOutput(NESTED_SCHEMA).code;
    const second = generateJsonSchemaOutput(NESTED_SCHEMA).code;

    expect(second).toBe(first);
    // Tarih/sürüm damgası sızmadığının kaba ama etkili sınaması.
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('honours a custom indent and ignores the banner option', () => {
    const wide = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL, { indent: '    ' });
    const bannered = generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL, { banner: true });

    expect(wide.code).toContain('\n    "name": "ALP Sensor Protocol"');
    expect(parseProtocolSchemaJson(wide.code).success).toBe(true);
    // JSON'da yorum yok: banner istense de çıktı değişmemeli.
    expect(bannered.code).toBe(generateJsonSchemaOutput(SPEC_SENSOR_PROTOCOL).code);
  });

  it('round-trips nested structures, arrays, conditions and bit fields', () => {
    const result = parseProtocolSchemaJson(generateJsonSchemaOutput(NESTED_SCHEMA).code);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schema).toEqual(NESTED_SCHEMA);
    }
  });

  it('indents nested fields one level deeper per composite', () => {
    const { code } = generateJsonSchemaOutput(NESTED_SCHEMA);

    // items[] → flags → alarm: üç bileşik kademe, her biri bir girinti.
    expect(code).toContain(`\n${' '.repeat(14)}"id": "alarm"`);
    expect(code).toContain(`\n${' '.repeat(10)}"id": "flags"`);
  });

  it('writes extension keys after the spec keys of the same object', () => {
    const { code } = generateJsonSchemaOutput(NESTED_SCHEMA);
    const items = (JSON.parse(code) as { fields: readonly Record<string, unknown>[] }).fields[1];
    const value = (items?.fields as readonly Record<string, unknown>[] | undefined)?.[0];

    expect(Object.keys(value ?? {})).toEqual(['id', 'name', 'type', 'length', 'scale', 'unit']);
    expect(Object.keys(items ?? {})).toEqual(['id', 'name', 'type', 'repeatCount', 'fields']);
    // Kök seviyede de aynı kural: §9.6 dörtlüsü önce, genişletmeler sonra.
    expect(keysAt(code, (root) => root)).toEqual([
      'name',
      'version',
      'framing',
      'fields',
      'description',
      'defaultEndianness',
    ]);
  });

  it('transliterates the schema name into a snake_case file name', () => {
    const turkish = generateJsonSchemaOutput({ ...SPEC_SENSOR_PROTOCOL, name: 'Sıcaklık Ölçer v2' });
    const symbols = generateJsonSchemaOutput({ ...SPEC_SENSOR_PROTOCOL, name: '???' });

    expect(turkish.fileName).toBe('sicaklik_olcer_v2.protocol.json');
    // Adında harf kalmayan şemada bile indirilebilir bir dosya adı çıkmalı.
    expect(symbols.fileName).toBe('field.protocol.json');
  });

  it('escapes characters that would break the JSON document', () => {
    const schema: ProtocolSchema = {
      ...SPEC_SENSOR_PROTOCOL,
      name: 'Quote " and \\ and\nnewline',
    };

    const result = parseProtocolSchemaJson(generateJsonSchemaOutput(schema).code);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schema.name).toBe('Quote " and \\ and\nnewline');
    }
  });
});
