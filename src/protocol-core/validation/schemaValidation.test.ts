import { describe, expect, it } from 'vitest';

import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '../schemas/specFixture';
import { staticFieldLength, validateProtocolSchema } from './schemaValidation';

function schemaWith(fields: readonly ProtocolFieldSchema[], maximumFrameLength = 256): ProtocolSchema {
  return {
    name: 'test',
    version: '1',
    framing: { type: 'none', maximumFrameLength },
    fields,
  };
}

function codes(schema: ProtocolSchema): string[] {
  return validateProtocolSchema(schema).issues.map((issue) => issue.code);
}

describe('validateProtocolSchema — spec şeması', () => {
  it('spec §9.6 şeması geçerlidir', () => {
    const result = validateProtocolSchema(SPEC_SENSOR_PROTOCOL);

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('validateProtocolSchema — referanslar', () => {
  it('var olmayan uzunluk kaynağını bildirir', () => {
    const issues = codes(
      schemaWith([
        { id: 'a', name: 'A', type: 'uint8', offset: 0 },
        { id: 'b', name: 'B', type: 'rawBytes', offset: 1, lengthFrom: 'yok' },
      ]),
    );

    expect(issues).toContain('unknown-length-reference');
  });

  it('kendi kendine bağımlı alanı çevrim olarak bildirir', () => {
    const result = validateProtocolSchema(
      schemaWith([{ id: 'a', name: 'A', type: 'rawBytes', offset: 0, lengthFrom: 'a' }]),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('circular-length-reference');
    // Spec §42'nin istediği metin kullanıcıya ulaşmalı.
    expect(result.issues.some((issue) => issue.message.includes('circular length references'))).toBe(true);
  });

  it('karşılıklı bağımlılığı çevrim olarak bildirir', () => {
    const result = validateProtocolSchema(
      schemaWith([
        { id: 'a', name: 'A', type: 'rawBytes', lengthFrom: 'b' },
        { id: 'b', name: 'B', type: 'rawBytes', lengthFrom: 'a' },
      ]),
    );

    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === 'circular-length-reference' && issue.message.includes('circular length references'),
      ),
    ).toBe(true);
  });

  it('üç halkalı çevrimi de bulur', () => {
    const result = validateProtocolSchema(
      schemaWith([
        { id: 'a', name: 'A', type: 'rawBytes', lengthFrom: 'b' },
        { id: 'b', name: 'B', type: 'rawBytes', lengthFrom: 'c' },
        { id: 'c', name: 'C', type: 'rawBytes', lengthFrom: 'a' },
      ]),
    );

    expect(result.issues.some((issue) => issue.code === 'circular-length-reference')).toBe(true);
  });

  it('ileriye bakan referansı ayrı kodla bildirir — çevrim değil ama çözümlenemez', () => {
    const result = validateProtocolSchema(
      schemaWith([
        { id: 'payload', name: 'Payload', type: 'rawBytes', lengthFrom: 'len' },
        { id: 'len', name: 'Length', type: 'uint8' },
      ]),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('forward-reference');
  });

  it('geriye bakan referans geçerlidir', () => {
    const result = validateProtocolSchema(
      schemaWith([
        { id: 'len', name: 'Length', type: 'uint8' },
        { id: 'payload', name: 'Payload', type: 'rawBytes', lengthFrom: 'len' },
      ]),
    );

    expect(result.valid).toBe(true);
  });

  it('koşul ve tekrar referansları da denetlenir', () => {
    const issues = codes(
      schemaWith([
        { id: 'a', name: 'A', type: 'uint8' },
        { id: 'b', name: 'B', type: 'uint8', condition: { field: 'yok', equals: 1 } },
        {
          id: 'c',
          name: 'C',
          type: 'array',
          repeatCount: { fromField: 'yok2' },
          fields: [{ id: 'inner', name: 'Inner', type: 'uint8' }],
        },
      ]),
    );

    expect(issues).toContain('unknown-condition-field');
    expect(issues).toContain('unknown-repeat-reference');
  });
});

describe('validateProtocolSchema — uzunluk ve tip', () => {
  it('aynı kimliği iki kez kullanmayı reddeder', () => {
    expect(
      codes(
        schemaWith([
          { id: 'a', name: 'A', type: 'uint8' },
          { id: 'a', name: 'A again', type: 'uint8' },
        ]),
      ),
    ).toContain('duplicate-field-id');
  });

  it('uzunluk isteyen tipte uzunluk yoksa bildirir', () => {
    expect(codes(schemaWith([{ id: 'a', name: 'A', type: 'ascii' }]))).toContain('missing-length');
  });

  it('hem sabit hem dinamik uzunluk verilmesini reddeder', () => {
    expect(
      codes(
        schemaWith([
          { id: 'len', name: 'L', type: 'uint8' },
          { id: 'a', name: 'A', type: 'rawBytes', length: 4, lengthFrom: 'len' },
        ]),
      ),
    ).toContain('conflicting-length');
  });

  it('tipin kendi genişliğiyle çelişen uzunluğu uyarı olarak bildirir, hata değil', () => {
    const result = validateProtocolSchema(
      schemaWith([{ id: 'a', name: 'A', type: 'uint16', length: 4 }]),
    );

    expect(result.valid).toBe(true);
    expect(result.issues[0]).toMatchObject({ code: 'conflicting-length', severity: 'warning' });
  });

  it('bit alanında bitLength zorunludur', () => {
    expect(codes(schemaWith([{ id: 'a', name: 'A', type: 'bitField' }]))).toContain(
      'missing-bit-geometry',
    );
  });

  it('checksum alanında algoritma zorunludur', () => {
    expect(codes(schemaWith([{ id: 'a', name: 'A', type: 'checksum' }]))).toContain(
      'missing-algorithm',
    );
  });

  it('boş yapı ve tekrar sayısız dizi reddedilir', () => {
    const issues = codes(
      schemaWith([
        { id: 's', name: 'S', type: 'structure', fields: [] },
        { id: 'r', name: 'R', type: 'array', fields: [{ id: 'i', name: 'I', type: 'uint8' }] },
      ]),
    );

    expect(issues).toContain('empty-composite');
    expect(issues).toContain('missing-repeat-count');
  });
});

describe('validateProtocolSchema — checksum kapsamı', () => {
  it('var olmayan kapsam alanını bildirir', () => {
    expect(
      codes(
        schemaWith([
          { id: 'a', name: 'A', type: 'uint8' },
          {
            id: 'ck',
            name: 'CK',
            type: 'checksum',
            algorithm: 'xor8',
            coverage: { startField: 'a', endField: 'yok' },
          },
        ]),
      ),
    ).toContain('unknown-coverage-field');
  });

  it('ters kapsamı bildirir', () => {
    expect(
      codes(
        schemaWith([
          { id: 'a', name: 'A', type: 'uint8' },
          { id: 'b', name: 'B', type: 'uint8' },
          {
            id: 'ck',
            name: 'CK',
            type: 'checksum',
            algorithm: 'xor8',
            coverage: { startField: 'b', endField: 'a' },
          },
        ]),
      ),
    ).toContain('invalid-coverage-order');
  });
});

describe('validateProtocolSchema — yerleşim', () => {
  it('çakışan açık ofsetleri bildirir', () => {
    expect(
      codes(
        schemaWith([
          { id: 'a', name: 'A', type: 'uint32', offset: 0 },
          { id: 'b', name: 'B', type: 'uint8', offset: 2 },
        ]),
      ),
    ).toContain('overlapping-fields');
  });

  it('bitişik alanlar çakışma sayılmaz', () => {
    const result = validateProtocolSchema(
      schemaWith([
        { id: 'a', name: 'A', type: 'uint16', offset: 0 },
        { id: 'b', name: 'B', type: 'uint8', offset: 2 },
      ]),
    );

    expect(result.valid).toBe(true);
  });

  it('azami çerçeve uzunluğunu aşan yerleşimi bildirir', () => {
    expect(
      codes(schemaWith([{ id: 'a', name: 'A', type: 'uint32', offset: 62 }], 64)),
    ).toContain('exceeds-maximum-frame-length');
  });
});

describe('staticFieldLength', () => {
  it('tipin kendi genişliğini verir', () => {
    expect(staticFieldLength({ id: 'a', name: 'A', type: 'uint24' })).toBe(3);
    expect(staticFieldLength({ id: 'a', name: 'A', type: 'float64' })).toBe(8);
  });

  it('şemadaki uzunluğu kullanır', () => {
    expect(staticFieldLength({ id: 'a', name: 'A', type: 'ascii', length: 12 })).toBe(12);
  });

  it('dinamik uzunlukta bilinemez', () => {
    expect(
      staticFieldLength({ id: 'a', name: 'A', type: 'rawBytes', lengthFrom: 'len' }),
    ).toBeUndefined();
  });

  it('checksum genişliğini algoritmadan türetir', () => {
    expect(staticFieldLength({ id: 'c', name: 'C', type: 'checksum', algorithm: 'xor8' })).toBe(1);
    expect(staticFieldLength({ id: 'c', name: 'C', type: 'crc', algorithm: 'CRC32' })).toBe(4);
  });

  it('bit alanını yukarı yuvarlar', () => {
    expect(staticFieldLength({ id: 'b', name: 'B', type: 'bitField', bitLength: 12 })).toBe(2);
  });
});
