import { describe, expect, it } from 'vitest';

import { parseWithSchema } from '../decoding/schemaParser';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import { SPEC_BUILDER_FRAME, SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '../schemas/specFixture';
import { isParseSuccess } from '../types';
import { encodeWithSchema } from './schemaEncoder';

function schemaWith(
  fields: readonly ProtocolFieldSchema[],
  overrides: Partial<ProtocolSchema> = {},
): ProtocolSchema {
  return {
    name: 'test',
    version: '1',
    framing: { type: 'none', maximumFrameLength: 256 },
    fields,
    ...overrides,
  };
}

function bytesOf(result: ReturnType<typeof encodeWithSchema>): number[] {
  if (!result.success) {
    throw new Error(`Kodlama başarısız: ${result.issues.map((issue) => issue.message).join('; ')}`);
  }
  return Array.from(result.bytes);
}

describe('encodeWithSchema — spec §10 Packet Builder örneği', () => {
  it('Set Output paketini üretir; uzunluk ve checksum HESAPLANIR', () => {
    const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 0x20,
      payload: Uint8Array.from([0x02, 0x4b]),
    });

    // Spec §10 `6C` yazıyor ama XOR8(05 20 02 02 4B) = 0x6E; spec dizgi hatası,
    // fixture yorumunda gerekçesiyle birlikte belgelendi.
    expect(bytesOf(result)).toEqual(Array.from(SPEC_BUILDER_FRAME));
  });

  it('uzunluk alanı kullanıcıdan alınmaz — verilen değer yok sayılır', () => {
    const withWrongLength = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 0x20,
      payloadLength: 99,
      payload: Uint8Array.from([0x02, 0x4b]),
    });

    // 99 değil, gerçek payload uzunluğu olan 2 yazılmalı.
    expect(bytesOf(withWrongLength)[3]).toBe(2);
  });

  it('checksum alanı kullanıcıdan alınmaz — üzerine yazılır', () => {
    const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 0x20,
      payload: Uint8Array.from([0x02, 0x4b]),
      checksum: 0x00,
    });

    expect(bytesOf(result)[6]).toBe(0x6e);
  });

  it('payload uzunluğu değişince uzunluk ve checksum birlikte güncellenir', () => {
    const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 0x10,
      payload: Uint8Array.from([0x34, 0x12, 0x7f]),
    });

    expect(bytesOf(result)).toEqual(Array.from(SPEC_SENSOR_FRAME));
  });

  it('enum alanı ADIYLA verilebilir', () => {
    const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 'Set Output',
      payload: Uint8Array.from([0x02, 0x4b]),
    });

    expect(bytesOf(result)[2]).toBe(0x20);
  });

  it('bilinmeyen enum adını bildirir', () => {
    const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 5,
      command: 'Böyle Bir Komut Yok',
      payload: new Uint8Array(0),
    });

    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('unknown-enum-label');
  });
});

describe('encodeWithSchema ↔ parseWithSchema turu', () => {
  it('üretilen paket kendi şemasıyla geri çözülür', () => {
    const encoded = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 42,
      command: 0x30,
      payload: Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
    });
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    const parsed = parseWithSchema(SPEC_SENSOR_PROTOCOL, encoded.bytes);

    expect(isParseSuccess(parsed)).toBe(true);
    if (!isParseSuccess(parsed)) return;
    expect(parsed.frame.valid).toBe(true);
    expect(parsed.frame.fields.find((field) => field.id === 'address')?.rawValue).toBe(42);
    expect(parsed.frame.fields.find((field) => field.id === 'payloadLength')?.rawValue).toBe(4);
  });

  it('boş payload ile de tur tamamlanır', () => {
    const encoded = encodeWithSchema(SPEC_SENSOR_PROTOCOL, {
      address: 1,
      command: 0x10,
      payload: new Uint8Array(0),
    });
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    expect(parseWithSchema(SPEC_SENSOR_PROTOCOL, encoded.bytes).success).toBe(true);
  });
});

describe('encodeWithSchema — aralık denetimi', () => {
  it('spec §42 metniyle taşmayı bildirir: "Value exceeds uint16 range"', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'uint16' }]);

    const result = encodeWithSchema(schema, { v: 70_000 });

    expect(result.success).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'value-out-of-range',
      message: 'Value exceeds uint16 range',
    });
  });

  it('işaretli alanın sınırlarını ayrı uygular', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'int8' }]);

    expect(encodeWithSchema(schema, { v: 127 }).success).toBe(true);
    expect(encodeWithSchema(schema, { v: 128 }).success).toBe(false);
    expect(encodeWithSchema(schema, { v: -128 }).success).toBe(true);
    expect(encodeWithSchema(schema, { v: -129 }).success).toBe(false);
  });

  it('işaretli negatif değeri iki tümleyen olarak yazar', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'int8' }]);

    expect(bytesOf(encodeWithSchema(schema, { v: -10 }))).toEqual([0xf6]);
  });

  it('azami çerçeve uzunluğu aşılırsa bildirir', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'rawBytes', length: 8 }], {
      framing: { type: 'none', maximumFrameLength: 4 },
    });

    const result = encodeWithSchema(schema, { v: new Uint8Array(8) });

    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('exceeds-maximum-frame-length');
  });
});

describe('encodeWithSchema — dönüşümler', () => {
  it('scale ve kalibrasyon ofsetini TERS çevirir', () => {
    // 25.3 °C, scale 0.1, ofset -40 → ham 653 = 0x028D
    const schema = schemaWith([
      { id: 't', name: 'T', type: 'uint16', scale: 0.1, calibrationOffset: -40 },
    ]);

    expect(bytesOf(encodeWithSchema(schema, { t: 25.3 }))).toEqual([0x02, 0x8d]);
  });

  it('bayt sırasını uygular', () => {
    const schema = schemaWith([
      { id: 'b', name: 'B', type: 'uint16', endianness: 'big' },
      { id: 'l', name: 'L', type: 'uint16', endianness: 'little' },
    ]);

    expect(bytesOf(encodeWithSchema(schema, { b: 0x0102, l: 0x0102 }))).toEqual([
      0x01, 0x02, 0x02, 0x01,
    ]);
  });

  it('64 bitlik değeri BigInt olarak kabul eder', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'uint64' }]);

    expect(bytesOf(encodeWithSchema(schema, { v: 0xffff_ffff_ffff_fffen }))).toEqual([
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    ]);
  });

  it('float32 yazar', () => {
    const schema = schemaWith([{ id: 'f', name: 'F', type: 'float32' }]);

    expect(bytesOf(encodeWithSchema(schema, { f: 25.75 }))).toEqual([0x41, 0xce, 0x00, 0x00]);
  });

  it('sabit uzunluklu metni sıfırla doldurur', () => {
    const schema = schemaWith([{ id: 's', name: 'S', type: 'ascii', length: 5 }]);

    expect(bytesOf(encodeWithSchema(schema, { s: 'AB' }))).toEqual([0x41, 0x42, 0x00, 0x00, 0x00]);
  });

  it('padding alanı kullanıcıdan istenmez, sıfır yazılır', () => {
    const schema = schemaWith([{ id: 'p', name: 'P', type: 'padding', length: 3 }]);

    expect(bytesOf(encodeWithSchema(schema, {}))).toEqual([0, 0, 0]);
  });

  it('bit alanını yazar', () => {
    const schema = schemaWith([
      { id: 'b', name: 'B', type: 'bitField', bitOffset: 0, bitLength: 4 },
    ]);

    expect(bytesOf(encodeWithSchema(schema, { b: 0xa }))).toEqual([0xa0]);
  });
});

describe('encodeWithSchema — koşul ve tekrar', () => {
  it('koşulu sağlanmayan alanı pakete koymaz', () => {
    const schema = schemaWith([
      { id: 'kind', name: 'Kind', type: 'uint8' },
      { id: 'extra', name: 'Extra', type: 'uint8', condition: { field: 'kind', equals: 1 } },
    ]);

    expect(bytesOf(encodeWithSchema(schema, { kind: 2, extra: 9 }))).toEqual([2]);
    expect(bytesOf(encodeWithSchema(schema, { kind: 1, extra: 9 }))).toEqual([1, 9]);
  });

  it('diziyi sayaç değerine göre tekrarlar', () => {
    const schema = schemaWith([
      { id: 'count', name: 'Count', type: 'uint8' },
      {
        id: 'items',
        name: 'Items',
        type: 'array',
        repeatCount: { fromField: 'count' },
        fields: [{ id: 'v', name: 'V', type: 'uint8' }],
      },
    ]);

    const result = encodeWithSchema(schema, {
      count: 3,
      'items[0].v': 10,
      'items[1].v': 20,
      'items[2].v': 30,
    });

    expect(bytesOf(result)).toEqual([3, 10, 20, 30]);
  });

  it('iç içe yapı alanları ad uzayıyla verilir', () => {
    const schema = schemaWith([
      {
        id: 'header',
        name: 'Header',
        type: 'structure',
        fields: [
          { id: 'a', name: 'A', type: 'uint8' },
          { id: 'b', name: 'B', type: 'uint8' },
        ],
      },
    ]);

    expect(bytesOf(encodeWithSchema(schema, { 'header.a': 1, 'header.b': 2 }))).toEqual([1, 2]);
  });
});
