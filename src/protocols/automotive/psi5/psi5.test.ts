import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';
import { buildPsi5Frame, parsePsi5, psi5Crc3, psi5EvenParity, psi5Parser, psi5Plugin } from './psi5';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function parseOrThrow(bytes: Uint8Array, options?: Record<string, unknown>): ReturnType<typeof parsePsi5> {
  const result = parsePsi5(bytes, options);
  if (!isParseSuccess(result)) throw new Error(`beklenmedik hata: ${result.error.message}`);
  return result;
}

describe('psi5Crc3 — İKİ BAĞIMSIZ SATICININ YAYIMLADIĞI test vektörleri', () => {
  /**
   * NXP MMA51xxKW veri sayfası §4.3.3.2 Table 7'nin dokuz 10-bit vektörü.
   * Bu tablo, PSI5 Technical Specification V2.1 §3.2.2'nin tarifiyle
   * BAĞIMSIZ olarak aynı algoritmayı tanımlıyor — çakışmaları, polinomun
   * ve seed'in doğru okunduğunun kanıtı.
   */
  const NXP_VECTORS: readonly [number, number][] = [
    [0x000, 0b110],
    [0x0cc, 0b011],
    [0x151, 0b000],
    [0x1e0, 0b011],
    [0x1f4, 0b010],
    [0x220, 0b100],
    [0x275, 0b111],
    [0x333, 0b001],
    [0x3ff, 0b100],
  ];

  it.each(NXP_VECTORS)('NXP MMA51xxKW: 10 bit 0x%s → CRC', (payload, expected) => {
    expect(psi5Crc3(payload, 10)).toBe(expected);
  });

  it('Infineon KP405 datasheet Rev. 1.00 Figure 11: 16 bit yük 0xAD2C → CRC 0b100', () => {
    expect(psi5Crc3(0xad2c, 16)).toBe(0b100);
  });

  /**
   * SAHTE DOST BEKÇİSİ (dalga 13 dersi 2). Aynı polinom + aynı seed, FARKLI
   * kaydırma yazmacı topolojisi = sessizce yanlış CRC. Klasik "direct"
   * (augmentation'sız) döngü seed=111 ile 1024 olası 10-bit yükün HİÇBİRİNDE
   * doğru sonucu vermiyor; doğru direct karşılığı seed=010'dur. Bu ölçüm
   * `crcEngine.ts`in neden KULLANILMADIĞINI kanıtlar.
   */
  it('"direct" CRC döngüsü seed=111 ile HİÇBİR yükte tutmaz, seed=010 ile HEPSİNDE tutar', () => {
    const direct = (value: number, bitCount: number, seed: number): number => {
      let register = seed;
      for (let index = 0; index < bitCount; index += 1) {
        const feedback = ((register >>> 2) & 1) ^ ((value >>> index) & 1);
        register = (register << 1) & 0x7;
        if (feedback === 1) register ^= 0x3;
      }
      return register;
    };

    let matchesWithSeed111 = 0;
    let matchesWithSeed010 = 0;
    for (let payload = 0; payload < 1024; payload += 1) {
      const reference = psi5Crc3(payload, 10);
      if (direct(payload, 10, 0b111) === reference) matchesWithSeed111 += 1;
      if (direct(payload, 10, 0b010) === reference) matchesWithSeed010 += 1;
    }
    expect(matchesWithSeed111).toBe(0);
    expect(matchesWithSeed010).toBe(1024);
  });
});

describe('psi5EvenParity — Infineon AURIX kod örneğinin çalışılmış fixture’ı', () => {
  /**
   * `iLLD_TC375_ADS_PSI5_SensorEmulator` README: *"first two bits are Start
   * bits S0 and S1 followed by 10 bits data '0001110000' and last bit is
   * parity bit 1"*, ve AYNI belge alıcı yazmacında `RD = 0x38` okunduğunu
   * söylüyor. İkisi birlikte hem LSB-first okumayı hem çift pariteyi
   * doğruluyor — tek fixture, iki iddia.
   */
  it('tel bitleri 0001110000 → yük 0x038 (LSB first) ve çift parite 1', () => {
    const wireBits = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0];
    let payload = 0;
    wireBits.forEach((bit, index) => {
      payload |= bit << index;
    });
    expect(payload).toBe(0x038);
    expect(psi5EvenParity(payload, 10)).toBe(1);
  });

  it('parite bitleri sayar, yük genişliğini değil', () => {
    expect(psi5EvenParity(0b0000000000, 10)).toBe(0);
    expect(psi5EvenParity(0b0000000001, 10)).toBe(1);
    expect(psi5EvenParity(0b1111111111, 10)).toBe(0);
    expect(psi5EvenParity(0b1111111110, 10)).toBe(1);
  });
});

describe('buildPsi5Frame — bit paketleme', () => {
  it('AURIX örneği tam olarak 0x07 0x08 üretir (13 bit + 3 bit sıfır dolgu)', () => {
    expect([...buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false })]).toEqual([
      0x07, 0x08,
    ]);
  });

  it('KP405 örneği tam olarak 0x0D 0x2D 0x60 üretir (21 bit + 3 bit sıfır dolgu)', () => {
    expect([...buildPsi5Frame({ payloadValue: 0xad2c, payloadBits: 16, usesCrc: true })]).toEqual([
      0x0d, 0x2d, 0x60,
    ]);
  });
});

describe('parsePsi5 — varsayılan yapılandırma (10 bit yük + parite)', () => {
  const frameBytes = buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false });

  it('start bitlerini, yükü ve pariteyi çözer ve çerçeve geçerlidir', () => {
    const result = parseOrThrow(frameBytes);
    if (!isParseSuccess(result)) throw new Error('unreachable');
    const { frame } = result;

    expect(frame.protocol).toBe('psi5');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);

    const startBits = fieldById(frame.fields, 'startBits');
    expect(startBits?.rawValue).toBe('0b00');
    expect(startBits?.valid).toBe(true);

    const payload = fieldById(frame.fields, 'payload');
    expect(payload?.physicalValue).toBe('0x038');
    // `offset`/`length` BAYT cinsindendir (types.ts kilitli sözleşmesi):
    // 2. bitten 11. bite kadar olan yük iki baytı KAPSAR.
    expect(payload?.offset).toBe(0);
    expect(payload?.length).toBe(2);

    const parity = fieldById(frame.fields, 'parity');
    expect(parity?.rawValue).toBe('0b1');
    expect(parity?.physicalValue).toBe('Valid');
    expect(fieldById(frame.fields, 'crc')).toBeUndefined();
  });

  it('İLK SATIR yürürlükteki profildir ve kaynağını basar (microwire.ts kararı)', () => {
    const result = parseOrThrow(frameBytes);
    if (!isParseSuccess(result)) throw new Error('unreachable');
    const first = result.frame.fields[0];

    expect(first?.id).toBe('profile');
    expect(String(first?.rawValue)).toContain('V2.1');
    expect(String(first?.rawValue)).toContain('10 bit payload');
    expect(String(first?.rawValue)).toContain('Parity');
    expect(String(first?.physicalValue)).toContain('psi5.org');
    // Slot zaman çizelgesinin ÇÖZÜLMEDİĞİ sessiz geçilmez.
    expect(first?.warnings).toContain('protocol.psi5.warning.slotTimelineNotResolved');
  });

  it('varsayılan görünümde sıfır genişlikli alt alanlar BASILMAZ, Region A tüm yüktür', () => {
    const result = parseOrThrow(frameBytes);
    if (!isParseSuccess(result)) throw new Error('unreachable');
    const ids = result.frame.fields.map((field) => field.id);

    expect(ids).not.toContain('messaging');
    expect(ids).not.toContain('frameControl');
    expect(ids).not.toContain('status');
    expect(ids).not.toContain('regionB');
    expect(fieldById(result.frame.fields, 'regionA')?.physicalValue).toBe('0x038');
  });

  it('bozuk parite çerçeveyi geçersiz kılar ve hesaplananı gösterir', () => {
    const broken = buildPsi5Frame({
      payloadValue: 0x038,
      payloadBits: 10,
      usesCrc: false,
      overrideCheck: 0,
    });
    const result = parseOrThrow(broken);
    if (!isParseSuccess(result)) throw new Error('unreachable');

    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(result.frame.fields, 'parity')?.physicalValue).toBe('Invalid (computed 0b1)');
  });

  it('start bitleri sıfır değilse çerçeve geçersizdir ve alan işaretlenir', () => {
    const broken = buildPsi5Frame({
      payloadValue: 0x038,
      payloadBits: 10,
      usesCrc: false,
      startBits: 0b01,
    });
    const result = parseOrThrow(broken);
    if (!isParseSuccess(result)) throw new Error('unreachable');

    expect(result.frame.valid).toBe(false);
    const startBits = fieldById(result.frame.fields, 'startBits');
    expect(startBits?.valid).toBe(false);
    expect(startBits?.warnings).toContain('protocol.psi5.warning.startBitsNotZero');
  });
});

describe('parsePsi5 — 16 bit yük + 3 bit CRC (KP405 yapılandırması)', () => {
  const options = { payloadBitCount: 16, errorCheck: 'crc3' };
  const frameBytes = buildPsi5Frame({ payloadValue: 0xad2c, payloadBits: 16, usesCrc: true });

  it('yükü ve CRC’yi çözer, PASS/FAIL BASAR (sent.ts’in tersi — gerekçe dosya başında)', () => {
    const result = parseOrThrow(frameBytes, options);
    if (!isParseSuccess(result)) throw new Error('unreachable');

    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame.fields, 'payload')?.physicalValue).toBe('0xAD2C');
    const crc = fieldById(result.frame.fields, 'crc');
    expect(crc?.rawValue).toBe('0b100');
    expect(crc?.physicalValue).toBe('Valid');
    expect(fieldById(result.frame.fields, 'parity')).toBeUndefined();
  });

  it('CRC uyuşmazlığı `crc-mismatch` hatası üretir', () => {
    const broken = buildPsi5Frame({
      payloadValue: 0xad2c,
      payloadBits: 16,
      usesCrc: true,
      overrideCheck: 0b011,
    });
    const result = parseOrThrow(broken, options);
    if (!isParseSuccess(result)) throw new Error('unreachable');

    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('crc-mismatch');
  });
});

describe('parsePsi5 — yük alt alanları (V2.1 §3.2.3 sırası)', () => {
  /**
   * Chassis & Safety substandard'ının önerdiği 20 bitlik varyant: 3 bit Frame
   * Control + 1 bit Status + 16 bit Region A. Alan SIRASI iki bağımsız
   * kaynakta aynı (V2.1 §3.2.3 ve Infineon KP405'in M0/M1'i yükün EN DÜŞÜK
   * iki bitine koyması); GENİŞLİKLER yapılandırmadan gelir, uydurulmaz.
   */
  it('alt alanlar yükün EN DÜŞÜK bitinden başlayarak M → F → E → B → A sırasıyla çıkar', () => {
    // Region A = 0xBEEF (16 bit), Status = 1 (1 bit), Frame Control = 5 (3 bit).
    const payloadValue = 5 | (1 << 3) | (0xbeef << 4);
    const bytes = buildPsi5Frame({ payloadValue, payloadBits: 20, usesCrc: true });
    const result = parseOrThrow(bytes, {
      payloadBitCount: 20,
      errorCheck: 'crc3',
      frameControlBits: 3,
      statusBits: 1,
    });
    if (!isParseSuccess(result)) throw new Error('unreachable');

    const ids = result.frame.fields.map((field) => field.id);
    expect(ids.indexOf('frameControl')).toBeLessThan(ids.indexOf('status'));
    expect(ids.indexOf('status')).toBeLessThan(ids.indexOf('regionA'));

    expect(fieldById(result.frame.fields, 'frameControl')?.physicalValue).toBe('0x5');
    expect(fieldById(result.frame.fields, 'status')?.physicalValue).toBe('0x1');
    expect(fieldById(result.frame.fields, 'regionA')?.physicalValue).toBe('0xBEEF');
    // Bit ayrıntısı ALAN ADINDA taşınır (`offset`/`length` bayt cinsinden).
    expect(fieldById(result.frame.fields, 'frameControl')?.name).toContain('wire bit 2–4');
    expect(fieldById(result.frame.fields, 'regionA')?.name).toContain('wire bit 6–21');
  });

  it('alt alanların toplamı yükü aşarsa `value-out-of-range` döner', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false });
    const result = parsePsi5(bytes, { regionBBits: 12 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.code).toBe('value-out-of-range');
  });

  it('Region A revizyonun alt sınırının altına düşerse UYARI verir ama çözüm sürer', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0x2aa, payloadBits: 10, usesCrc: false });
    const result = parseOrThrow(bytes, { frameControlBits: 4 });
    if (!isParseSuccess(result)) throw new Error('unreachable');

    expect(fieldById(result.frame.fields, 'regionA')?.warnings).toContain(
      'protocol.psi5.warning.regionABelowMinimum',
    );
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('region-a-below-minimum');
  });
});

describe('parsePsi5 — revizyon aralığı, dolgu ve hata yolları', () => {
  it('V2.x’te 8 bitlik yük UYARI üretir, V1.3’te ÜRETMEZ (aralık revizyona bağlı)', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0x55, payloadBits: 8, usesCrc: false });

    const v21 = parseOrThrow(bytes, { payloadBitCount: 8 });
    if (!isParseSuccess(v21)) throw new Error('unreachable');
    expect(v21.frame.warnings.map((warning) => warning.code)).toContain('payload-out-of-revision-range');

    const v13 = parseOrThrow(bytes, { payloadBitCount: 8, psi5Revision: 'v1-3' });
    if (!isParseSuccess(v13)) throw new Error('unreachable');
    expect(v13.frame.warnings.map((warning) => warning.code)).not.toContain(
      'payload-out-of-revision-range',
    );
  });

  it('bayt sınırına kadarki dolgu bitleri alan olarak basılır ve sıfır değilse uyarır', () => {
    const clean = buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false });
    const cleanResult = parseOrThrow(clean);
    if (!isParseSuccess(cleanResult)) throw new Error('unreachable');
    expect(fieldById(cleanResult.frame.fields, 'padding')?.valid).toBe(true);

    const dirty = Uint8Array.from(clean);
    dirty[1] = (dirty[1] ?? 0) | 0b0000_0001;
    const dirtyResult = parseOrThrow(dirty);
    if (!isParseSuccess(dirtyResult)) throw new Error('unreachable');
    expect(dirtyResult.frame.warnings.map((warning) => warning.code)).toContain('padding-not-zero');
  });

  it('bir baytı aşan artık, ayrı bir "trailing bits" uyarısı verir (yanlış ayar sinyali)', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0xad2c, payloadBits: 16, usesCrc: true });
    // Varsayılan (10 bit + parite) yapılandırmasıyla 3 baytlık yakalama: 11 bit artıyor.
    const result = parseOrThrow(bytes);
    if (!isParseSuccess(result)) throw new Error('unreachable');
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('trailing-bits');
  });

  it('boş girdi ve eksik çerçeve HATA döner, çökmez', () => {
    const empty = parsePsi5(new Uint8Array());
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.code).toBe('truncated-frame');

    const short = parsePsi5(Uint8Array.from([0x07]));
    expect(short.success).toBe(false);
    if (!short.success) expect(short.error.code).toBe('truncated-frame');
  });

  it('tanınmayan seçenek değerleri varsayılana düşer — panel yarım girdide kör bırakmaz', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false });
    const result = parseOrThrow(bytes, {
      payloadBitCount: 'onbir',
      errorCheck: 'md5',
      psi5Revision: 'v9-9',
      applicationProfile: 'uydurma',
      communicationMode: 'Z',
      frameControlBits: -3,
    });
    if (!isParseSuccess(result)) throw new Error('unreachable');
    expect(result.frame.valid).toBe(true);
    expect(String(result.frame.fields[0]?.rawValue)).toContain('V2.1');
    expect(fieldById(result.frame.fields, 'parity')?.physicalValue).toBe('Valid');
  });

  it('application profile YALNIZ METADATA: bit genişliklerine dokunmaz, uyarısını basar', () => {
    const bytes = buildPsi5Frame({ payloadValue: 0x038, payloadBits: 10, usesCrc: false });
    const neutral = parseOrThrow(bytes);
    const airbag = parseOrThrow(bytes, { applicationProfile: 'airbag' });
    if (!isParseSuccess(neutral) || !isParseSuccess(airbag)) throw new Error('unreachable');

    expect(airbag.frame.fields.map((field) => field.id)).toEqual(
      neutral.frame.fields.map((field) => field.id),
    );
    expect(String(airbag.frame.fields[0]?.rawValue)).toContain('Airbag');
    expect(airbag.frame.fields[0]?.warnings).toContain('protocol.psi5.warning.profileMetadataOnly');
    expect(neutral.frame.fields[0]?.warnings).not.toContain('protocol.psi5.warning.profileMetadataOnly');
  });
});

describe('psi5Plugin — eklenti sözleşmesi', () => {
  it('kimlik, kategori ve seçenek kanalı yerinde', () => {
    expect(psi5Plugin.id).toBe('psi5');
    expect(psi5Plugin.category).toBe('automotive');
    expect(psi5Plugin.parser).toBe(psi5Parser);
    expect(psi5Plugin.decodeOptions?.map((option) => option.id)).toEqual([
      'applicationProfile',
      'psi5Revision',
      'communicationMode',
      'payloadBitCount',
      'errorCheck',
      'messagingBits',
      'frameControlBits',
      'statusBits',
      'regionBBits',
    ]);
  });

  it('her `select` seçeneğinin varsayılanı kendi şıkları arasında', () => {
    for (const option of psi5Plugin.decodeOptions ?? []) {
      if (option.kind !== 'select') continue;
      expect(option.choices?.map((choice) => choice.value)).toContain(String(option.defaultValue));
    }
  });

  it('örnek çerçeveler beklenen geçerlilikle çözülür', () => {
    for (const example of psi5Plugin.exampleFrames) {
      const options =
        example.id === 'airbag-16-crc' ? { payloadBitCount: 16, errorCheck: 'crc3' } : undefined;
      const result = parsePsi5(example.bytes, options);
      if (example.expectedValid === true) {
        expect(isParseSuccess(result) && result.frame.valid, example.id).toBe(true);
      } else {
        expect(!isParseSuccess(result) || !result.frame.valid, example.id).toBe(true);
      }
    }
  });
});
