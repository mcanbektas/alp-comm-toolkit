import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import type { ParseSuccess, ParsedField } from '@/protocol-core/types';
import {
  canParseModeS,
  computeModeSCrc,
  EXAMPLE_DF17_IDENTIFICATION,
  EXAMPLE_DF17_IDENTIFICATION_EZY,
  EXAMPLE_DF17_POSITION_EVEN,
  EXAMPLE_DF17_POSITION_ODD,
  EXAMPLE_DF17_VELOCITY,
  EXAMPLE_DF20_COMM_B,
  expectedByteLengthForDownlinkFormat,
  modeSBytesFromHex,
  modeSParser,
  modeSPlugin,
  parseModeS,
  resolveDownlinkFormat,
} from './modeS';

/**
 * Faz 10 dalga 15h — `mode-s` çerçeve düzeyi motoru.
 *
 * Bu dosyanın bekçilediği DÖRT sessiz-yanlış-çözüm noktası (alt dalga brifinin
 * "devralınan tuzaklar" listesi):
 *   1. Katalogdaki DÖRT 24-bit CRC'nin hiçbiri Mode S'inki DEĞİL — dördü de
 *      ayrı ayrı SINANIR ve hepsinin YANLIŞ sonuç verdiği kanıtlanır.
 *   2. DF24 ilk İKİ bitten tanınır; 256 olası ilk baytın hepsinde sınanır.
 *   3. Parite semantiği DF'e göre değişir — üç sınıf ayrı ayrı kanıtlanır ve
 *      AP sınıfında CRC PASS/FAIL alanının HİÇ BASILMADIĞI gösterilir.
 *   4. `crcBits()` çağrılmaz (56/112 bit tam bayt) — CRC kapsamı test edilir.
 */

function success(hex: string): ParseSuccess {
  const result = parseModeS(modeSBytesFromHex(hex));
  if (!result.success) throw new Error(`beklenmedik başarısızlık: ${result.error.message}`);
  return result;
}

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

function hasField(fields: readonly ParsedField[], id: string): boolean {
  return fields.some((candidate) => candidate.id === id);
}

function warningCodes(frame: ParseSuccess['frame']): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/** mode-s.org'un yayımlı dört örneği + pyModeS doctest'inin mesajı. */
const REAL_DF17_MESSAGES = [
  EXAMPLE_DF17_IDENTIFICATION,
  EXAMPLE_DF17_POSITION_EVEN,
  EXAMPLE_DF17_POSITION_ODD,
  EXAMPLE_DF17_VELOCITY,
  EXAMPLE_DF17_IDENTIFICATION_EZY,
];

describe('Mode S — CRC-24 ve dört sahte dost', () => {
  it('gerçek DF17 mesajlarının hepsinde hesaplanan CRC PI alanına birebir oturur', () => {
    for (const hex of REAL_DF17_MESSAGES) {
      const data = modeSBytesFromHex(hex);
      const parityValue = readBitsAsNumber(data, (data.length - 3) * 8, 24, 'msb-first');
      expect(computeModeSCrc(data), hex).toBe(parityValue);
    }
  });

  it('geçerli bir mesajın TAMAMI üzerinde hesaplanan kalan SIFIRDIR', () => {
    // pyModeS'in kendi notu: *"a valid message has a remainder of 0"*. Bu,
    // parametre kümesinin bağımsız ikinci bir sağlamasıdır: yanlış bir init ya
    // da xorout burada sıfır ÜRETMEZDİ.
    for (const hex of REAL_DF17_MESSAGES) {
      const data = modeSBytesFromHex(hex);
      expect(Number(computeNamedCrc(data, 'CRC24_MODE_S')), hex).toBe(0);
    }
  });

  it('katalogdaki DİĞER dört 24-bit CRC girdisinin HİÇBİRİ doğru sonucu vermez', () => {
    // "Aynı bit genişliği aynı CRC algoritması DEĞİLDİR" (dalga 13 dersi 2).
    // Bu test bir gözlem değil bir BEKÇİ: biri gün gelip tutarsa, ya katalog
    // bozulmuştur ya da bu kayıt yanlış girdiden hesaplıyordur.
    const data = modeSBytesFromHex(EXAMPLE_DF17_IDENTIFICATION);
    const covered = data.subarray(0, data.length - 3);
    const parityValue = readBitsAsNumber(data, (data.length - 3) * 8, 24, 'msb-first');
    for (const id of ['CRC24', 'CRC24_Q', 'CRC24_FLEXRAY_A', 'CRC24_FLEXRAY_B'] as const) {
      expect(Number(computeNamedCrc(covered, id)), id).not.toBe(parityValue);
    }
    // …ve doğru girdi gerçekten tutuyor (testin kendi sağlık kontrolü).
    expect(Number(computeNamedCrc(covered, 'CRC24_MODE_S'))).toBe(parityValue);
  });

  it('CRC kapsamı parite baytlarını DIŞARIDA bırakır — 11 (uzun) / 4 (kısa) bayt', () => {
    const long = modeSBytesFromHex(EXAMPLE_DF17_IDENTIFICATION);
    expect(computeModeSCrc(long)).toBe(Number(computeNamedCrc(long.subarray(0, 11), 'CRC24_MODE_S')));
    const short = modeSBytesFromHex('5D4840D6F8740F');
    expect(computeModeSCrc(short)).toBe(Number(computeNamedCrc(short.subarray(0, 4), 'CRC24_MODE_S')));
  });
});

describe('Mode S — DF24 iki-bit istisnası', () => {
  it('ilk İKİ bit 11 olan HER ilk bayt DF24 verir, diğerlerinde ilk beş bit geçerlidir', () => {
    for (let firstByte = 0; firstByte < 256; firstByte += 1) {
      const naive = (firstByte >>> 3) & 0b11111;
      const expected = (firstByte >>> 6) === 0b11 ? 24 : naive;
      expect(resolveDownlinkFormat(firstByte), `0x${firstByte.toString(16)}`).toBe(expected);
    }
  });

  it('naif beş-bit okuması 24…31 arası SEKİZ farklı değer üretirdi — istisna bunu kapatıyor', () => {
    const naiveValues = new Set<number>();
    const resolvedValues = new Set<number>();
    for (let firstByte = 0xc0; firstByte <= 0xff; firstByte += 1) {
      naiveValues.add((firstByte >>> 3) & 0b11111);
      resolvedValues.add(resolveDownlinkFormat(firstByte));
    }
    expect(naiveValues.size).toBe(8);
    expect([...resolvedValues]).toEqual([24]);
  });

  it('DF24 çerçevesinde DF alanı bit 1:2 olarak adlandırılır ve uyarı basılır', () => {
    const { frame } = success('E7123456789ABCDEF01122E38FB8');
    const df = fieldById(frame.fields, 'modes-downlink-format');
    expect(df.name).toContain('bit 1:2');
    expect(df.rawValue).toBe(0b11);
    expect(df.physicalValue).toContain('DF24');
    expect(warningCodes(frame)).toContain('downlinkFormat24TwoBitException');
    // DF24'te adres ÇIKARILMAZ (pyModeS DF24 için `None` döner, dosya başı).
    expect(hasField(frame.fields, 'modes-icao-recovered')).toBe(false);
    expect(hasField(frame.fields, 'modes-crc-check')).toBe(false);
  });
});

describe('Mode S — uzunluk kuralı (DF & 0x10)', () => {
  it('DF < 16 kısa, DF ≥ 16 uzun çerçevedir', () => {
    for (const df of [0, 4, 5, 11, 15]) expect(expectedByteLengthForDownlinkFormat(df)).toBe(7);
    for (const df of [16, 17, 18, 19, 20, 21, 24]) {
      expect(expectedByteLengthForDownlinkFormat(df)).toBe(14);
    }
  });

  it('uzunluk DF ile çelişirse çerçeve REDDEDİLMEZ ama parite doğrulanmaz', () => {
    // 7 bayt, ama ilk bayt DF17.
    const { frame } = success('8D4840D6202CC3');
    expect(warningCodes(frame)).toContain('lengthDoesNotMatchDownlinkFormat');
    expect(warningCodes(frame)).toContain('paritySemanticsUnknown');
    expect(hasField(frame.fields, 'modes-crc-check')).toBe(false);
    expect(hasField(frame.fields, 'modes-icao-address')).toBe(false);
    expect(frame.valid).toBe(true);
  });

  it('7 ve 14 dışındaki uzunluk truncated-frame ile reddedilir', () => {
    for (const hex of ['8D4840D6202CC371C32C', '8D4840D6', '8D4840D6202CC371C32CE05760']) {
      const result = parseModeS(modeSBytesFromHex(hex));
      expect(result.success, hex).toBe(false);
      if (result.success) continue;
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('boş girdi, azami uzunluk ve iptal ayrı ayrı raporlanır', () => {
    const empty = parseModeS(new Uint8Array());
    expect(empty.success).toBe(false);

    const tooLong = modeSParser.parse(modeSBytesFromHex(EXAMPLE_DF17_IDENTIFICATION), {
      maxFrameLength: 8,
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) expect(tooLong.error.code).toBe('frame-too-long');

    const controller = new AbortController();
    controller.abort();
    const aborted = modeSParser.parse(modeSBytesFromHex(EXAMPLE_DF17_IDENTIFICATION), {
      signal: controller.signal,
    });
    expect(aborted.success).toBe(false);
    if (!aborted.success) expect(aborted.error.code).toBe('parser-timeout');
  });
});

describe('Mode S — parite semantiği DF sınıfına göre DEĞİŞİR', () => {
  it('DF17 (adres-açık): ICAO bit 9:32’den okunur, CRC PASS alanı BASILIR', () => {
    const { frame } = success(EXAMPLE_DF17_IDENTIFICATION);

    const df = fieldById(frame.fields, 'modes-downlink-format');
    expect(df.rawValue).toBe(17);
    expect(df.name).toContain('bit 1:5');

    expect(fieldById(frame.fields, 'modes-capability').rawValue).toBe(5);

    const icao = fieldById(frame.fields, 'modes-icao-address');
    expect(icao.name).toBe('ICAO Address (bit 9:32)');
    expect(icao.offset).toBe(1);
    expect(icao.length).toBe(3);
    expect(icao.physicalValue).toBe('4840D6');

    const me = fieldById(frame.fields, 'modes-me');
    expect(me.offset).toBe(4);
    expect(me.length).toBe(7);
    expect(me.physicalValue).toBe('202CC371C32CE0');

    expect(fieldById(frame.fields, 'modes-parity').physicalValue).toBe('576098');
    const check = fieldById(frame.fields, 'modes-crc-check');
    expect(check.physicalValue).toBe('CRC PASS');
    expect(check.valid).toBe(true);

    // Adres-açık sınıfında ÇIKARILAN adres alanı BASILMAZ — çıkarım gerekmiyor.
    expect(hasField(frame.fields, 'modes-icao-recovered')).toBe(false);
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('DF11 (adres-açık, kısa çerçeve): ME alanı YOK, CRC yine doğrulanır', () => {
    const { frame } = success('5D4840D6F8740F');
    expect(fieldById(frame.fields, 'modes-downlink-format').rawValue).toBe(11);
    expect(fieldById(frame.fields, 'modes-icao-address').physicalValue).toBe('4840D6');
    expect(hasField(frame.fields, 'modes-me')).toBe(false);
    expect(fieldById(frame.fields, 'modes-crc-check').physicalValue).toBe('CRC PASS');
    const parity = fieldById(frame.fields, 'modes-parity');
    expect(parity.name).toContain('bit 33:56');
  });

  it('DF17 bozulunca CRC FAIL basılır ve crc-mismatch hatası düşer', () => {
    const { frame } = success('8D4840D6202CC271C32CE0576098');
    const check = fieldById(frame.fields, 'modes-crc-check');
    expect(check.valid).toBe(false);
    expect(String(check.physicalValue)).toContain('CRC FAIL');
    expect(fieldById(frame.fields, 'modes-parity').valid).toBe(false);
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toEqual(['crc-mismatch']);
    // Düzeltme adayı ÜRETİLMEZ — [Karar 15h-1], sahte kesinliğin kapısı.
    expect(frame.fields.some((field) => field.id.includes('correct'))).toBe(false);
  });

  it('DF4/DF5 (AP sınıfı): adres ÇIKARILIR, CRC PASS/FAIL alanı HİÇ BASILMAZ', () => {
    const cases: readonly { hex: string; downlinkFormat: number; icao: string }[] = [
      { hex: '20001030219677', downlinkFormat: 4, icao: '400940' },
      { hex: '280005A258D8F3', downlinkFormat: 5, icao: '4840D6' },
    ];
    for (const testCase of cases) {
      const { frame } = success(testCase.hex);
      expect(fieldById(frame.fields, 'modes-downlink-format').rawValue).toBe(
        testCase.downlinkFormat,
      );
      // FS adlandırılır (iki kaynakta aynı), gövde HAM kalır.
      expect(hasField(frame.fields, 'modes-flight-status')).toBe(true);
      expect(fieldById(frame.fields, 'modes-body').warnings).toContain(
        'protocol.modeS.field.bodySubfieldsNotDecoded',
      );

      const parity = fieldById(frame.fields, 'modes-parity');
      expect(parity.name).toContain('AP · Address / Parity');
      expect(parity.warnings).toContain('protocol.modeS.field.parityNotVerifiable');

      const recovered = fieldById(frame.fields, 'modes-icao-recovered');
      expect(recovered.physicalValue).toBe(testCase.icao);
      expect(recovered.warnings).toContain('protocol.modeS.field.icaoRecoveredNotVerified');

      // EN ÖNEMLİ BEKÇİ: doğrulanamayan bir şey "doğrulandı" gibi BASILMAZ.
      expect(hasField(frame.fields, 'modes-crc-check')).toBe(false);
      expect(hasField(frame.fields, 'modes-icao-address')).toBe(false);
      expect(warningCodes(frame)).toEqual(
        expect.arrayContaining(['parityIsAddressXorCrc', 'icaoRecoveredNotVerified']),
      );
      expect(frame.valid).toBe(true);
    }
  });

  it('AP sınıfında adres çıkarımı ÇÜRÜTÜLEMEZ — bozulmuş çerçeve de bir adres üretir', () => {
    // Gerekçenin kanıtı: tek bir bayt değiştirildiğinde hata VERİLMEZ, yalnız
    // BAŞKA bir "geçerli" adres çıkar. Doğrulanabilirlik yok, çünkü çürütme yok.
    const original = fieldById(success('20001030219677').frame.fields, 'modes-icao-recovered');
    const mutated = fieldById(success('20001031219677').frame.fields, 'modes-icao-recovered');
    expect(mutated.physicalValue).not.toBe(original.physicalValue);
    expect(String(mutated.physicalValue)).toMatch(/^[0-9A-F]{6}$/);
  });

  it('DF20 (Comm-B): MB alanı basılır ama BDS olarak YORUMLANMAZ', () => {
    const { frame } = success(EXAMPLE_DF20_COMM_B);
    expect(fieldById(frame.fields, 'modes-downlink-format').rawValue).toBe(20);
    const mb = fieldById(frame.fields, 'modes-mb');
    expect(mb.offset).toBe(4);
    expect(mb.length).toBe(7);
    expect(mb.warnings).toContain('protocol.modeS.field.commBMessageNotDecoded');
    expect(fieldById(frame.fields, 'modes-icao-recovered').physicalValue).toBe('484163');
    expect(hasField(frame.fields, 'modes-crc-check')).toBe(false);
  });

  it('DF19 ve atanmamış DF: hiçbir şey türetilmez, parite HAM kalır', () => {
    const military = success('98112233445566778899AA0B9969').frame;
    expect(fieldById(military.fields, 'modes-downlink-format').rawValue).toBe(19);
    expect(warningCodes(military)).toContain('paritySemanticsUnknown');
    expect(hasField(military.fields, 'modes-icao-recovered')).toBe(false);

    const unassigned = success('0A112233B3A2C3').frame;
    expect(warningCodes(unassigned)).toContain('downlinkFormatUnassigned');
    expect(fieldById(unassigned.fields, 'modes-downlink-format').valid).toBe(false);
  });
});

describe('Mode S — sözleşme bekçileri (`types.ts`)', () => {
  it('alan id’leri tekil, offset/length BAYT cinsinden ve sınır içinde', () => {
    for (const example of modeSPlugin.exampleFrames) {
      const result = modeSParser.parse(example.bytes);
      if (!result.success) continue;
      const ids = result.frame.fields.map((field) => field.id);
      expect(new Set(ids).size, example.id).toBe(ids.length);
      for (const field of result.frame.fields) {
        expect(field.offset, `${example.id}/${field.id}`).toBeGreaterThanOrEqual(0);
        expect(field.offset + field.length).toBeLessThanOrEqual(example.bytes.length);
        expect(Array.from(field.rawBytes)).toEqual(
          Array.from(example.bytes.slice(field.offset, field.offset + field.length)),
        );
      }
    }
  });

  it('`unit` HİÇBİR alanda yok — DF, ICAO, parite hepsi kimlik/sayaç', () => {
    for (const example of modeSPlugin.exampleFrames) {
      const result = modeSParser.parse(example.bytes);
      if (!result.success) continue;
      for (const field of result.frame.fields) {
        expect(field.unit, `${example.id}/${field.id}`).toBeUndefined();
      }
    }
  });

  it('`ParsedFrame` DÜZ — hiçbir alanda `children` yok', () => {
    const { frame } = success(EXAMPLE_DF17_IDENTIFICATION);
    for (const field of frame.fields) {
      expect(Object.hasOwn(field, 'children')).toBe(false);
    }
  });

  it('örnek çerçevelerin `expectedValid` beyanı gerçek sonuçla örtüşüyor', () => {
    for (const example of modeSPlugin.exampleFrames) {
      const result = modeSParser.parse(example.bytes);
      const actual = result.success && result.frame.valid;
      expect(actual, example.id).toBe(example.expectedValid);
    }
  });

  it('`decodeOptions` AÇILMADI — `attemptCrcCorrection` bu dalgada yazılmadı', () => {
    expect(modeSPlugin.decodeOptions).toBeUndefined();
  });
});

describe('Mode S — canParse', () => {
  it('gerçek DF17/DF11 mesajlarını kabul eder (CRC doğrulanarak)', () => {
    for (const hex of REAL_DF17_MESSAGES) expect(canParseModeS(modeSBytesFromHex(hex)), hex).toBe(true);
    expect(canParseModeS(modeSBytesFromHex('5D4840D6F8740F'))).toBe(true);
  });

  it('CRC’si bozuk bir DF17’yi REDDEDER — adres-açık sınıfında üçüncü kanıt var', () => {
    expect(canParseModeS(modeSBytesFromHex('8D4840D6202CC271C32CE0576098'))).toBe(false);
  });

  it('AP sınıfında CRC kanıtı YOK — yalnız uzunluk + DF tutarlılığı kalıyor', () => {
    // Bu bir eksiklik değil pasif yakalamanın sınırı; bozulmuş bir DF4 de kabul
    // edilir ve bu KASITLIDIR (ölçümü surveillanceCanParseRegistry.test.ts'te).
    expect(canParseModeS(modeSBytesFromHex('20001030219677'))).toBe(true);
    expect(canParseModeS(modeSBytesFromHex('20001031219677'))).toBe(true);
  });

  it('atanmamış DF, uzunluk-DF çelişkisi ve ara uzunluk reddedilir', () => {
    expect(canParseModeS(modeSBytesFromHex('0A112233B3A2C3'))).toBe(false);
    expect(canParseModeS(modeSBytesFromHex('8D4840D6202CC3'))).toBe(false);
    expect(canParseModeS(modeSBytesFromHex('20001030219677AA'))).toBe(false);
    expect(canParseModeS(new Uint8Array())).toBe(false);
  });

  it('DF24 kabul edilir (uzun çerçeve, atanmış format) ama CRC iddiası taşımaz', () => {
    expect(canParseModeS(modeSBytesFromHex('E7123456789ABCDEF01122E38FB8'))).toBe(true);
  });
});
