import { describe, expect, it } from 'vitest';

import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '../schemas/specFixture';
import { isParseSuccess } from '../types';
import { createSchemaParser, parseWithSchema } from './schemaParser';

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

function fieldById(result: ReturnType<typeof parseWithSchema>, id: string) {
  if (!isParseSuccess(result)) {
    throw new Error(`Ayrıştırma başarısız: ${result.error.message}`);
  }
  return result.frame.fields.find((field) => field.id === id);
}

describe('parseWithSchema — spec §43 kabul fixture\'ı', () => {
  it('AA 05 10 03 34 12 7F 4F 55 çerçevesini spec\'in şemasıyla çözer', () => {
    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
    expect(result.consumedBytes).toBe(9);

    expect(fieldById(result, 'address')).toMatchObject({ rawValue: 5, offset: 1, length: 1 });
    // Enum ham değeri korur, fiziksel değer olarak ADI verir.
    expect(fieldById(result, 'command')).toMatchObject({
      rawValue: 0x10,
      physicalValue: 'Sensor Data',
    });
    expect(fieldById(result, 'payloadLength')).toMatchObject({ rawValue: 3 });
  });

  it('dinamik uzunluklu payload\'ı uzunluk alanından okur', () => {
    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const payload = fieldById(result, 'payload');

    expect(payload).toMatchObject({ offset: 4, length: 3 });
    expect(Array.from(payload?.rawBytes ?? [])).toEqual([0x34, 0x12, 0x7f]);
  });

  it('checksum\'ı alan kimliği kapsamından hesaplayıp doğrular', () => {
    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, SPEC_SENSOR_FRAME);
    const checksum = fieldById(result, 'checksum');

    // XOR8(05 10 03 34 12 7F) = 0x4F — konumu şemada YOK, imleçten türetildi.
    expect(checksum).toMatchObject({ offset: 7, length: 1, rawValue: 0x4fn, valid: true });
    expect(checksum?.physicalValue).toBe('valid');
  });

  it('bozuk checksum çerçeveyi geçersiz kılar ama ayrıştırma sürer', () => {
    const corrupted = Uint8Array.from(SPEC_SENSOR_FRAME);
    corrupted[7] = 0x00;

    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, corrupted);

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('checksum-mismatch');
    // Diğer alanlar yine çözülmüş olmalı — tek bozuk alan her şeyi düşürmez.
    expect(fieldById(result, 'address')?.rawValue).toBe(5);
  });

  it('payload uzunluğu değişince checksum konumu da kayar', () => {
    // payloadLength = 1, payload = 34, checksum = XOR8(05 10 01 34)
    const checksum = 0x05 ^ 0x10 ^ 0x01 ^ 0x34;
    const frame = Uint8Array.from([0xaa, 0x05, 0x10, 0x01, 0x34, checksum, 0x55]);

    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, frame);

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.valid).toBe(true);
    expect(fieldById(result, 'checksum')).toMatchObject({ offset: 5, valid: true });
  });
});

describe('parseWithSchema — çerçeveleme', () => {
  it('yanlış başlangıç baytını bildirir', () => {
    const frame = Uint8Array.from(SPEC_SENSOR_FRAME);
    frame[0] = 0xbb;

    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, frame);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('start-delimiter-not-found');
    expect(result.recoverable).toBe(true);
  });

  it('yanlış bitiş baytını bildirir', () => {
    const frame = Uint8Array.from(SPEC_SENSOR_FRAME);
    frame[8] = 0x00;

    const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, frame);

    expect(result.success).toBe(false);
  });

  it('azami uzunluğu aşan çerçeve kurtarılamaz sayılır', () => {
    const schema = schemaWith([{ id: 'a', name: 'A', type: 'uint8', offset: 0 }], {
      framing: { type: 'none', maximumFrameLength: 4 },
    });

    const result = parseWithSchema(schema, new Uint8Array(8));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('frame-too-long');
    // Akış bu protokol için terk edilmeli.
    expect(result.recoverable).toBe(false);
  });

  it('çerçeveyi aşan alanı truncated-frame olarak bildirir', () => {
    const schema = schemaWith([{ id: 'a', name: 'A', type: 'uint32', offset: 0 }]);

    const result = parseWithSchema(schema, Uint8Array.from([0x01, 0x02]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('parseWithSchema — sayısal dönüşüm', () => {
  it('spec §9.2 örneği: ham 653, scale 0.1, ofset -40 → 25.3', () => {
    const schema = schemaWith([
      {
        id: 'temp',
        name: 'Temperature',
        type: 'uint16',
        offset: 0,
        scale: 0.1,
        calibrationOffset: -40,
        unit: '°C',
      },
    ]);

    const result = parseWithSchema(schema, Uint8Array.from([0x02, 0x8d]));
    const field = fieldById(result, 'temp');

    expect(field?.rawValue).toBe(653);
    expect(Number(field?.physicalValue)).toBeCloseTo(25.3, 10);
    expect(field?.unit).toBe('°C');
  });

  it('spec §9.3 örneği: 0xF6 int8 olarak -10', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'int8', offset: 0 }]);

    expect(fieldById(parseWithSchema(schema, Uint8Array.from([0xf6])), 'v')?.rawValue).toBe(-10);
  });

  it('bayt sırasını alan başına uygular', () => {
    const schema = schemaWith([
      { id: 'big', name: 'Big', type: 'uint16', offset: 0, endianness: 'big' },
      { id: 'little', name: 'Little', type: 'uint16', offset: 2, endianness: 'little' },
    ]);

    const result = parseWithSchema(schema, Uint8Array.from([0x01, 0x02, 0x01, 0x02]));

    expect(fieldById(result, 'big')?.rawValue).toBe(0x0102);
    expect(fieldById(result, 'little')?.rawValue).toBe(0x0201);
  });

  it('şema varsayılanı alan belirtmediğinde geçerlidir', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'uint16', offset: 0 }], {
      defaultEndianness: 'little',
    });

    expect(fieldById(parseWithSchema(schema, Uint8Array.from([0x01, 0x02])), 'v')?.rawValue).toBe(
      0x0201,
    );
  });

  it('64 bitlik alanı BigInt olarak okur — Number yuvarlardı', () => {
    const schema = schemaWith([{ id: 'v', name: 'V', type: 'uint64', offset: 0 }]);
    const bytes = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]);

    expect(fieldById(parseWithSchema(schema, bytes), 'v')?.rawValue).toBe(0xffff_ffff_ffff_fffen);
  });

  it('float32 çözer', () => {
    // 25.75 → 41 CE 00 00 (spec §43 fixture'ı)
    const schema = schemaWith([{ id: 'f', name: 'F', type: 'float32', offset: 0 }]);
    const bytes = Uint8Array.from([0x41, 0xce, 0x00, 0x00]);

    expect(Number(fieldById(parseWithSchema(schema, bytes), 'f')?.rawValue)).toBeCloseTo(25.75, 6);
  });

  it('bit maskesini uygular ve kaydırır — spec §9.4', () => {
    // 0xF0 & 0xF0 >> 4 = 0x0F
    const schema = schemaWith([
      { id: 'v', name: 'V', type: 'uint8', offset: 0, bitMask: 0xf0 },
    ]);

    expect(fieldById(parseWithSchema(schema, Uint8Array.from([0xa5])), 'v')?.rawValue).toBe(0x0a);
  });

  it('bit alanını bayt sınırı aşarak okur', () => {
    const schema = schemaWith([
      { id: 'b', name: 'B', type: 'bitField', offset: 0, bitOffset: 4, bitLength: 8 },
    ]);

    expect(fieldById(parseWithSchema(schema, Uint8Array.from([0x0f, 0xf0])), 'b')?.rawValue).toBe(
      0xff,
    );
  });

  it('aralık dışı değeri uyarır ama alanı geçersiz kılmaz', () => {
    const schema = schemaWith([
      { id: 'v', name: 'V', type: 'uint8', offset: 0, minimum: 0, maximum: 100 },
    ]);

    const result = parseWithSchema(schema, Uint8Array.from([200]));

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.warnings).toHaveLength(1);
    expect(result.frame.valid).toBe(true);
  });
});

describe('parseWithSchema — enum, metin, zaman', () => {
  it('bilinmeyen enum değeri uyarı üretir, çerçeveyi düşürmez', () => {
    const schema = schemaWith([
      { id: 'e', name: 'E', type: 'enum', offset: 0, length: 1, enumValues: { '1': 'One' } },
    ]);

    const result = parseWithSchema(schema, Uint8Array.from([9]));

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.valid).toBe(true);
    expect(result.frame.warnings[0]?.message).toContain('Bilinmeyen enum');
    expect(fieldById(result, 'e')?.rawValue).toBe(9);
  });

  it('ascii ve utf8 alanlarını çözer', () => {
    const schema = schemaWith([
      { id: 'a', name: 'A', type: 'ascii', offset: 0, length: 3 },
      { id: 'u', name: 'U', type: 'utf8', offset: 3, length: 2 },
    ]);
    const bytes = Uint8Array.from([0x41, 0x42, 0x43, 0xc3, 0xb6]);

    const result = parseWithSchema(schema, bytes);

    expect(fieldById(result, 'a')?.physicalValue).toBe('ABC');
    expect(fieldById(result, 'u')?.physicalValue).toBe('ö');
  });

  it('unixTimestamp alanını ISO metnine çevirir', () => {
    const schema = schemaWith([{ id: 't', name: 'T', type: 'unixTimestamp', offset: 0 }]);
    // 2020-01-01T00:00:00Z = 1577836800
    const bytes = Uint8Array.from([0x5e, 0x0b, 0xe1, 0x00]);

    expect(fieldById(parseWithSchema(schema, bytes), 't')?.physicalValue).toBe(
      '2020-01-01T00:00:00.000Z',
    );
  });
});

describe('parseWithSchema — koşullu ve tekrarlı yapı', () => {
  it('koşul sağlanmayan alanı ATLAR', () => {
    const schema = schemaWith([
      { id: 'kind', name: 'Kind', type: 'uint8', offset: 0 },
      { id: 'extra', name: 'Extra', type: 'uint8', condition: { field: 'kind', equals: 1 } },
    ]);

    const present = parseWithSchema(schema, Uint8Array.from([1, 42]));
    expect(fieldById(present, 'extra')?.rawValue).toBe(42);

    const absent = parseWithSchema(schema, Uint8Array.from([2]));
    expect(isParseSuccess(absent)).toBe(true);
    if (!isParseSuccess(absent)) return;
    expect(absent.frame.fields.map((field) => field.id)).toEqual(['kind']);
  });

  it('diziyi sayaç alanından tekrarlar ve alanları ad uzayıyla düzler', () => {
    const schema = schemaWith([
      { id: 'count', name: 'Count', type: 'uint8', offset: 0 },
      {
        id: 'samples',
        name: 'Samples',
        type: 'array',
        repeatCount: { fromField: 'count' },
        fields: [{ id: 'value', name: 'Value', type: 'uint8' }],
      },
    ]);

    const result = parseWithSchema(schema, Uint8Array.from([3, 10, 20, 30]));

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.fields.map((field) => field.id)).toEqual([
      'count',
      'samples[0].value',
      'samples[1].value',
      'samples[2].value',
    ]);
    expect(result.frame.fields[3]?.rawValue).toBe(30);
  });

  it('iç içe yapı alanlarını ad uzayıyla düzler', () => {
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

    const result = parseWithSchema(schema, Uint8Array.from([1, 2]));

    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;
    expect(result.frame.fields.map((field) => field.id)).toEqual(['header.a', 'header.b']);
  });

  it('spec §41: bozuk sayaç sonsuz yinelemeye yol açmaz', () => {
    const schema = schemaWith([
      { id: 'count', name: 'Count', type: 'uint16', offset: 0 },
      {
        id: 'items',
        name: 'Items',
        type: 'array',
        repeatCount: { fromField: 'count' },
        fields: [{ id: 'v', name: 'V', type: 'uint8' }],
      },
    ], { framing: { type: 'none', maximumFrameLength: 65_535 } });

    // 65535 yineleme istiyor; tavan devreye girmeli.
    const result = parseWithSchema(schema, Uint8Array.from([0xff, 0xff, 0x00]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('value-out-of-range');
  });
});

describe('parseWithSchema — iptal', () => {
  it('iptal edilmiş sinyalde ayrıştırma durur', () => {
    const controller = new AbortController();
    controller.abort();
    const schema = schemaWith([{ id: 'a', name: 'A', type: 'uint8', offset: 0 }]);

    const result = parseWithSchema(schema, Uint8Array.from([1]), {
      context: { signal: controller.signal },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('createSchemaParser', () => {
  it('spec §7 ProtocolParser sözleşmesine uyar', () => {
    const parser = createSchemaParser(SPEC_SENSOR_PROTOCOL);

    expect(parser.protocolId).toBe('ALP Sensor Protocol');
    expect(parser.displayName).toBe('ALP Sensor Protocol');
    expect(parser.parse(SPEC_SENSOR_FRAME).success).toBe(true);
  });

  it('canParse başlangıç baytına ucuz ön eleme yapar', () => {
    const parser = createSchemaParser(SPEC_SENSOR_PROTOCOL);

    expect(parser.canParse(SPEC_SENSOR_FRAME)).toBe(true);
    expect(parser.canParse(Uint8Array.from([0xbb, 0x05]))).toBe(false);
    expect(parser.canParse(new Uint8Array(0))).toBe(false);
  });
});

/**
 * MAYIN BEKÇİSİ — boş `startBytes` bir daha HER ŞEYİ sahiplenemez.
 *
 * Kapatılan hata: gövde `startBytes.every((byte, index) => data[index] === byte)`
 * idi ve `[].every(...)` boş dizide `true` döner. `startBytes`i olmayan bir şema
 * SIFIR bayt karşılaştırıp DAİMA `true` diyordu; ölçüldü, kayıt defterinin
 * 937 örneğinin 937'sini sahipleniyordu (%100 yanlış pozitif).
 *
 * Bu blok mayını `framing.type`ın BEŞİNDE de doğrudan sınar. Ortak sözleşme:
 * **hiçbir koşul denetlenemiyorsa cevap `true` DEĞİL `false`tur.** Yanlış
 * negatif kabul edilebilir (kayıt yalnız otomatik seçilmez), yanlış pozitif
 * değildir (auto-detection'ı zehirler).
 */
describe('createSchemaParser.canParse — boş `startBytes` mayını', () => {
  const oneByte = Uint8Array.from([0x01]);
  const fourBytes = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);

  it("'none': ayırt edici sinyali OLMAYAN şema hiçbir çerçeveyi sahiplenmez", () => {
    // Tek alanın boyu `lengthFrom` ile başka bir alandan gelir ama o alan
    // şemada YOK: çerçeve boyu türetilemez, denetlenecek koşul kalmaz.
    const parser = createSchemaParser(
      schemaWith([{ id: 'body', name: 'Body', type: 'rawBytes', lengthFrom: 'missing' }]),
    );

    expect(parser.canParse(oneByte)).toBe(false);
    expect(parser.canParse(fourBytes)).toBe(false);
    expect(parser.canParse(new Uint8Array(64))).toBe(false);
  });

  it("'none': şemadan türeyen boy teldeki boya EŞİTSE sahiplenir, değilse sahiplenmez", () => {
    const parser = createSchemaParser(
      schemaWith([
        { id: 'a', name: 'A', type: 'uint8', offset: 0, length: 1 },
        { id: 'b', name: 'B', type: 'uint16', offset: 1, length: 2 },
      ]),
    );

    expect(parser.canParse(Uint8Array.from([0x01, 0x02, 0x03]))).toBe(true);
    // Bir bayt eksik ve bir bayt fazla: ikisi de bu şemanın çerçevesi DEĞİL.
    expect(parser.canParse(Uint8Array.from([0x01, 0x02]))).toBe(false);
    expect(parser.canParse(Uint8Array.from([0x01, 0x02, 0x03, 0x04]))).toBe(false);
  });

  it("'none': `ascii` alanına ikili çöp gelirse sahiplenmez", () => {
    const parser = createSchemaParser(
      schemaWith([{ id: 'text', name: 'Text', type: 'ascii', offset: 0, length: 4 }]),
    );

    expect(parser.canParse(Uint8Array.from([0x54, 0x45, 0x4d, 0x50]))).toBe(true);
    expect(parser.canParse(Uint8Array.from([0x00, 0xff, 0x80, 0x01]))).toBe(false);
  });

  it("'lengthField': uzunluk ALANI olmayan şema hiçbir çerçeveyi sahiplenmez", () => {
    // Mayının tam olarak tetiklendiği yapılandırma: çerçeveleme bir uzunluk
    // alanı VAAT EDİYOR, şemada yok. Vaat boşsa denetlenecek de bir şey yoktur.
    const parser = createSchemaParser(
      schemaWith([{ id: 'first', name: 'First', type: 'uint8', offset: 0, length: 1 }], {
        framing: { type: 'lengthField', maximumFrameLength: 64 },
      }),
    );

    expect(parser.canParse(oneByte)).toBe(false);
    expect(parser.canParse(fourBytes)).toBe(false);
  });

  it("'lengthField': bildirilen uzunluk telle TUTARLIYSA sahiplenir", () => {
    const parser = createSchemaParser(
      schemaWith(
        [
          { id: 'length', name: 'Length', type: 'length', offset: 0, length: 2, endianness: 'big' },
          { id: 'payload', name: 'Payload', type: 'rawBytes', lengthFrom: 'length' },
        ],
        { framing: { type: 'lengthField', maximumFrameLength: 64 } },
      ),
    );

    // LENGTH=2 (BE) + 2 bayt yük = 4 bayt, tel de 4 bayt.
    expect(parser.canParse(Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]))).toBe(true);
    // Aynı tel, LENGTH=3 diyor: bildirim telle tutarsız.
    expect(parser.canParse(Uint8Array.from([0x00, 0x03, 0xaa, 0xbb]))).toBe(false);
    // Bildirilen uzunluk azami çerçeve boyunu aşıyor.
    expect(parser.canParse(Uint8Array.from([0x03, 0xe8, 0xaa]))).toBe(false);
  });

  it("'fixedLength': alanlardan türeyen boy teldeki boyla ÖLÇÜLÜR", () => {
    const parser = createSchemaParser(
      schemaWith(
        [
          { id: 'a', name: 'A', type: 'uint8', offset: 0, length: 1 },
          { id: 'b', name: 'B', type: 'uint8', offset: 1, length: 1 },
        ],
        { framing: { type: 'fixedLength', maximumFrameLength: 8 } },
      ),
    );

    expect(parser.canParse(Uint8Array.from([0x01, 0x02]))).toBe(true);
    expect(parser.canParse(oneByte)).toBe(false);
    expect(parser.canParse(Uint8Array.from([0x01, 0x02, 0x03]))).toBe(false);
  });

  it("'startOnly': `startBytes` boşsa çerçeveleme sinyali YOKTUR", () => {
    // Boyu türetilemeyen şema: `startOnly` adı bir başlangıç deseni vaat eder,
    // dizi boştur, geriye doğrulanacak hiçbir şey kalmaz.
    const parser = createSchemaParser(
      schemaWith([{ id: 'body', name: 'Body', type: 'rawBytes', lengthFrom: 'missing' }], {
        framing: { type: 'startOnly', maximumFrameLength: 64 },
      }),
    );

    expect(parser.canParse(oneByte)).toBe(false);
    expect(parser.canParse(fourBytes)).toBe(false);
  });

  it("'startEnd': `startBytes` boşsa BİTİŞ baytları denetlenir", () => {
    const parser = createSchemaParser(
      schemaWith([{ id: 'body', name: 'Body', type: 'rawBytes', lengthFrom: 'missing' }], {
        framing: { type: 'startEnd', endBytes: [0x55], maximumFrameLength: 64 },
      }),
    );

    // Boy türetilemiyor ama bitiş baytı GERÇEK bir koşuldur ve `verifyFraming`
    // de yalnız `startEnd`te ona bakar — `canParse` `parse`ın ötesine geçmez.
    expect(parser.canParse(Uint8Array.from([0x01, 0x02, 0x55]))).toBe(true);
    expect(parser.canParse(Uint8Array.from([0x01, 0x02, 0x54]))).toBe(false);
  });

  it("'startEnd': ne `startBytes` ne `endBytes` varsa sahiplenmez", () => {
    const parser = createSchemaParser(
      schemaWith([{ id: 'body', name: 'Body', type: 'rawBytes', lengthFrom: 'missing' }], {
        framing: { type: 'startEnd', maximumFrameLength: 64 },
      }),
    );

    expect(parser.canParse(oneByte)).toBe(false);
    expect(parser.canParse(fourBytes)).toBe(false);
  });

  it('koşullu/tekrarlı/bileşik alan varsa boy türetilemez ve sahiplenmez', () => {
    // Bu alanların çerçevedeki yeri ancak AYRIŞTIRMA sırasında belli olur ve
    // `canParse` ayrıştırma yapmaz (`parseWithSchema` sıcak yolda çağrılamaz).
    const conditional = createSchemaParser(
      schemaWith([
        { id: 'kind', name: 'Kind', type: 'uint8', offset: 0, length: 1 },
        {
          id: 'extra',
          name: 'Extra',
          type: 'uint8',
          length: 1,
          condition: { field: 'kind', equals: 1 },
        },
      ]),
    );
    const repeated = createSchemaParser(
      schemaWith([
        { id: 'items', name: 'Items', type: 'array', repeatCount: 2, fields: [] },
      ]),
    );

    expect(conditional.canParse(Uint8Array.from([0x01, 0x02]))).toBe(false);
    expect(repeated.canParse(Uint8Array.from([0x01, 0x02]))).toBe(false);
  });

  it('boş girdi her yapılandırmada `false`tur', () => {
    const parser = createSchemaParser(
      schemaWith([{ id: 'a', name: 'A', type: 'uint8', offset: 0, length: 1 }]),
    );

    expect(parser.canParse(new Uint8Array(0))).toBe(false);
  });
});
