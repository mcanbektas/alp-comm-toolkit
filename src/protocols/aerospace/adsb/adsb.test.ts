import { describe, expect, it } from 'vitest';

import type { ParseSuccess, ParsedField } from '@/protocol-core/types';
import { modeSBytesFromHex, modeSParser } from '../modeS/modeS';
import {
  adsbParser,
  adsbPlugin,
  canParseAdsb,
  EXAMPLE_CRC_FAIL,
  EXAMPLE_DF18_IDENTIFICATION,
  EXAMPLE_IDENTIFICATION,
  EXAMPLE_IDENTIFICATION_EZY,
  EXAMPLE_NOT_EXTENDED_SQUITTER,
  EXAMPLE_POSITION_EVEN,
  EXAMPLE_POSITION_ODD,
  EXAMPLE_TYPE_CODE_31,
  EXAMPLE_TYPE_CODE_7,
  EXAMPLE_VELOCITY_AIRSPEED,
  EXAMPLE_VELOCITY_GROUND_SPEED,
  parseAdsb,
} from './adsb';

/**
 * Faz 10 dalga 15h — `ads-b`, DF17/18'in ME alanının yorumu.
 *
 * Bu dosyanın bekçilediği kararlar:
 *   1. **CPR global pozisyona ÇEVRİLMEZ** — ham 17 bit basılır, `unit` ve
 *      `physicalValue` VERİLMEZ; iki çerçeve elde olsa BİLE hesap yapılmaz.
 *   2. **DF17/18 dışı REDDEDİLİR** — gerçek bir DF20'nin MB alanı ME gibi
 *      görünür ve kabul edilseydi "TC 4, uçak kimliği" diye çözülürdü.
 *   3. **Çözülmeyen TC'ler TANINIR ama YAKIŞTIRILMAZ.**
 *   4. **`modeS.ts` KOPYALANMADI** — aynı çerçeve alanları iki motorda BİREBİR
 *      aynı çıkıyor (12d'nin `networkTimestamp` vakasının bekçisi).
 *   5. Çözülen sayılar yayımlanmış değerlerle doğrulandı (38 000 ft, 159 kt,
 *      182,88°, −832 ft/dk, 243,98°, 375 kt TAS, −2304 ft/dk).
 */

function success(hex: string): ParseSuccess {
  const result = parseAdsb(modeSBytesFromHex(hex));
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

describe('ADS-B — `modeS.ts` TÜKETİLİR, kopyalanmaz', () => {
  it('çerçeve alanları iki motorda BİREBİR aynı — tek bir kaynak var', () => {
    const bytes = modeSBytesFromHex(EXAMPLE_IDENTIFICATION);
    const modeS = modeSParser.parse(bytes);
    const adsb = adsbParser.parse(bytes);
    if (!modeS.success || !adsb.success) throw new Error('ikisi de başarılı olmalıydı');

    for (const modeSField of modeS.frame.fields) {
      const twin = fieldById(adsb.frame.fields, modeSField.id);
      expect(twin.name, modeSField.id).toBe(modeSField.name);
      expect(twin.offset, modeSField.id).toBe(modeSField.offset);
      expect(twin.length, modeSField.id).toBe(modeSField.length);
      expect(twin.rawValue, modeSField.id).toBe(modeSField.rawValue);
      expect(twin.physicalValue, modeSField.id).toBe(modeSField.physicalValue);
    }
    // ADS-B alanları ÜSTÜNE eklenir, çerçeve alanlarının yerine geçmez.
    expect(adsb.frame.fields.length).toBeGreaterThan(modeS.frame.fields.length);
  });

  it('CRC doğrulaması `modeS.ts`ten devralınır — DF17 PASS, DF18 de PASS', () => {
    for (const hex of [EXAMPLE_IDENTIFICATION, EXAMPLE_DF18_IDENTIFICATION]) {
      const { frame } = success(hex);
      expect(fieldById(frame.fields, 'modes-crc-check').physicalValue, hex).toBe('CRC PASS');
      expect(frame.valid, hex).toBe(true);
    }
  });
});

describe('ADS-B — DF17/18 dışı REDDEDİLİR', () => {
  it('gerçek bir DF20 Comm-B yanıtı kabul EDİLMEZ (MB alanı ME gibi görünse de)', () => {
    const result = parseAdsb(modeSBytesFromHex(EXAMPLE_NOT_EXTENDED_SQUITTER));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('unsupported-encoding');
    expect(result.error.details?.['downlinkFormat']).toBe(20);
  });

  it('DF20’nin MB alanı gerçekten TC 4 gibi okunurdu — reddin bedeli ölçüldü', () => {
    // MB'nin ilk baytı 0x20; naif bir `>>> 3` okuması 4 verir, yani "uçak
    // kimliği". Bu test kabul edilseydi ne olacağını SAYIYLA gösteriyor.
    const bytes = modeSBytesFromHex(EXAMPLE_NOT_EXTENDED_SQUITTER);
    expect((bytes[4] ?? 0) >>> 3).toBe(4);
  });

  it('kısa çerçeve ve DF11 de reddedilir', () => {
    for (const hex of ['5D4840D6F8740F', '20001030219677']) {
      const result = parseAdsb(modeSBytesFromHex(hex));
      expect(result.success, hex).toBe(false);
    }
  });
});

describe('ADS-B — TC 1–4 identification', () => {
  it('callsign 8 × 6 bitlik ICAO alfabesinden çözülür ve kategori SAYI kalır', () => {
    const cases: readonly { hex: string; callsign: string }[] = [
      { hex: EXAMPLE_IDENTIFICATION, callsign: 'KLM1023' },
      { hex: EXAMPLE_IDENTIFICATION_EZY, callsign: 'EZY85MH' },
      { hex: EXAMPLE_DF18_IDENTIFICATION, callsign: 'KLM1023' },
    ];
    for (const testCase of cases) {
      const { frame } = success(testCase.hex);
      const typeCode = fieldById(frame.fields, 'adsb-type-code');
      expect(typeCode.rawValue, testCase.hex).toBe(4);
      expect(typeCode.physicalValue).toBe('Aircraft identification and category');
      expect(typeCode.warnings).toEqual([]);

      const callsign = fieldById(frame.fields, 'adsb-callsign');
      expect(callsign.physicalValue, testCase.hex).toBe(testCase.callsign);
      expect(callsign.offset).toBe(5);
      expect(callsign.length).toBe(6);
      expect(callsign.valid).toBe(true);
      // Callsign bir METİNDİR; `unit` yazılmaz.
      expect(callsign.unit).toBeUndefined();

      // Kategorinin METNİ revizyona bağlı — sayı basılır, ad basılmaz.
      const category = fieldById(frame.fields, 'adsb-aircraft-category');
      expect(category.physicalValue).toBeUndefined();
      expect(category.warnings).toContain('protocol.adsb.field.categoryRequiresRevision');
    }
  });
});

describe('ADS-B — TC 9–18 airborne position', () => {
  it('barometrik irtifa Q=1 dalıyla çözülür ve YAYIMLANMIŞ değere oturur', () => {
    // mode-s.org bu mesaj için 38 000 ft yayımlıyor — bağımsız doğrulama.
    for (const hex of [EXAMPLE_POSITION_EVEN, EXAMPLE_POSITION_ODD]) {
      const altitude = fieldById(success(hex).frame.fields, 'adsb-altitude');
      expect(altitude.physicalValue, hex).toBe(38000);
      expect(altitude.unit).toBe('ft');
      expect(altitude.warnings).toEqual([]);
    }
  });

  it('CPR HAM basılır: `physicalValue` YOK, `unit` YOK, global pozisyon YOK', () => {
    const even = success(EXAMPLE_POSITION_EVEN).frame;
    expect(fieldById(even.fields, 'adsb-cpr-format').physicalValue).toBe('Even (F=0)');

    const latitude = fieldById(even.fields, 'adsb-cpr-latitude');
    const longitude = fieldById(even.fields, 'adsb-cpr-longitude');
    expect(latitude.rawValue).toBe(93000);
    expect(longitude.rawValue).toBe(51372);
    for (const field of [latitude, longitude]) {
      // EN ÖNEMLİ BEKÇİ: ham CPR bir derece DEĞİLDİR.
      expect(field.physicalValue, field.id).toBeUndefined();
      expect(field.unit, field.id).toBeUndefined();
      expect(field.warnings).toContain('protocol.adsb.field.cprRawNotDegrees');
    }

    // Hiçbir alan enlem/boylam ADIYLA basılmaz — "latitude" geçen tek alan
    // adında "CPR" ve "raw" da geçer.
    for (const field of even.fields) {
      if (/latitude|longitude/i.test(field.name)) expect(field.name).toContain('raw 17 bit');
    }
    expect(warningCodes(even)).toContain('cprNotConvertedToGlobalPosition');
  });

  it('Even + Odd çifti elde OLSA BİLE hiçbir global sayı üretilmez', () => {
    const even = success(EXAMPLE_POSITION_EVEN).frame;
    const odd = success(EXAMPLE_POSITION_ODD).frame;
    expect(fieldById(odd.fields, 'adsb-cpr-format').physicalValue).toBe('Odd (F=1)');
    // İki çerçevenin alan KÜMESİ birebir aynı — ikincisi birincisinden hiçbir
    // şey türetmiyor (`mavlink.ts`in çerçeveler-arası sınırı).
    expect(odd.fields.map((field) => field.id)).toEqual(even.fields.map((field) => field.id));
  });

  it('NIC Supplement-B bitinin anlamı sürüme bağlı olduğu için ADLANDIRILMAZ', () => {
    const field = fieldById(success(EXAMPLE_POSITION_EVEN).frame.fields, 'adsb-nic-supplement-b');
    expect(field.physicalValue).toBeUndefined();
    expect(field.warnings).toContain('protocol.adsb.field.nicSupplementRequiresVersion');
  });
});

describe('ADS-B — TC 19 airborne velocity', () => {
  it('yer hızı alt tipi: GS, iz açısı ve dikey hız YAYIMLANMIŞ değerlere oturur', () => {
    const { frame } = success(EXAMPLE_VELOCITY_GROUND_SPEED);
    expect(fieldById(frame.fields, 'adsb-velocity-subtype').physicalValue).toBe(
      'Ground speed, subsonic',
    );
    expect(fieldById(frame.fields, 'adsb-ground-speed').physicalValue).toBe(159.2);
    expect(fieldById(frame.fields, 'adsb-ground-speed').unit).toBe('kt');
    expect(fieldById(frame.fields, 'adsb-track-angle').physicalValue).toBe(182.88);
    expect(fieldById(frame.fields, 'adsb-track-angle').unit).toBe('°');
    expect(fieldById(frame.fields, 'adsb-vertical-rate').physicalValue).toBe(-832);
    expect(fieldById(frame.fields, 'adsb-vertical-rate').unit).toBe('ft/min');
    expect(fieldById(frame.fields, 'adsb-vertical-rate-source').physicalValue).toBe('GNSS');
    expect(fieldById(frame.fields, 'adsb-ew-direction').physicalValue).toBe('West');
    expect(fieldById(frame.fields, 'adsb-gnss-baro-difference').physicalValue).toBe(550);
  });

  it('hava hızı alt tipi FARKLI alanlar üretir — aynı bitler, başka anlam', () => {
    const { frame } = success(EXAMPLE_VELOCITY_AIRSPEED);
    expect(fieldById(frame.fields, 'adsb-velocity-subtype').physicalValue).toBe(
      'Airspeed, subsonic',
    );
    expect(fieldById(frame.fields, 'adsb-heading').physicalValue).toBe(243.98);
    expect(fieldById(frame.fields, 'adsb-airspeed').physicalValue).toBe(375);
    expect(fieldById(frame.fields, 'adsb-airspeed-type').physicalValue).toBe('TAS');
    expect(fieldById(frame.fields, 'adsb-vertical-rate').physicalValue).toBe(-2304);
    expect(fieldById(frame.fields, 'adsb-vertical-rate-source').physicalValue).toBe('Barometric');
    // Yer hızı alt tipinin alanları BURADA YOK — aksi hâlde aynı bitler iki
    // ayrı adla basılırdı (sessiz yanlış çözüm).
    expect(hasField(frame.fields, 'adsb-ground-speed')).toBe(false);
    expect(hasField(frame.fields, 'adsb-ew-velocity')).toBe(false);
    // GNSS − baro farkı bu çerçevede "mevcut değil" kodunu taşıyor.
    const difference = fieldById(frame.fields, 'adsb-gnss-baro-difference');
    expect(difference.physicalValue).toBeUndefined();
    expect(difference.warnings).toContain('protocol.adsb.field.valueUnavailable');
  });

  it('AYNI 22 bit iki alt tipte İKİ FARKLI alan tablosu üretir', () => {
    const ground = success(EXAMPLE_VELOCITY_GROUND_SPEED).frame.fields.map((field) => field.id);
    const air = success(EXAMPLE_VELOCITY_AIRSPEED).frame.fields.map((field) => field.id);
    expect(ground).not.toEqual(air);
    expect(air).toContain('adsb-heading');
    expect(ground).toContain('adsb-ns-velocity');
  });
});

describe('ADS-B — çözülmeyen Type Code’lar TANINIR ama YAKIŞTIRILMAZ', () => {
  it('TC 7 (yüzey konumu) ve TC 31 adlandırılır, payload HAM kalır', () => {
    const cases: readonly { hex: string; typeCode: number; name: string }[] = [
      { hex: EXAMPLE_TYPE_CODE_7, typeCode: 7, name: 'Surface position' },
      { hex: EXAMPLE_TYPE_CODE_31, typeCode: 31, name: 'Aircraft operation status' },
    ];
    for (const testCase of cases) {
      const { frame } = success(testCase.hex);
      const typeCode = fieldById(frame.fields, 'adsb-type-code');
      expect(typeCode.rawValue, testCase.hex).toBe(testCase.typeCode);
      expect(typeCode.physicalValue).toBe(testCase.name);
      expect(typeCode.warnings).toContain('protocol.adsb.field.typeCodeNotDecoded');
      expect(warningCodes(frame)).toContain('typeCodeNotDecoded');
      // ME HAM kalır: hiçbir `adsb-` alt alanı üretilmez (TC alanı hariç).
      const decodedSubfields = frame.fields.filter(
        (field) => field.id.startsWith('adsb-') && field.id !== 'adsb-type-code',
      );
      expect(decodedSubfields, testCase.hex).toEqual([]);
      // …ama ham ME `modeS.ts`ten geldiği için hâlâ görünür.
      expect(hasField(frame.fields, 'modes-me')).toBe(true);
    }
  });
});

describe('ADS-B — kapsam ve CRC', () => {
  it('UAT kapsam-dışı uyarısı KOŞULSUZ basılır', () => {
    for (const example of adsbPlugin.exampleFrames) {
      const result = adsbParser.parse(example.bytes);
      if (!result.success) continue;
      expect(warningCodes(result.frame), example.id).toContain('uatOutOfScope');
    }
  });

  it('CRC FAIL: ME çözülür ama çerçeve geçersiz ve uyarı KOŞULSUZ', () => {
    const { frame } = success(EXAMPLE_CRC_FAIL);
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((error) => error.code)).toEqual(['crc-mismatch']);
    expect(warningCodes(frame)).toContain('messageDecodedOnFailedCrc');
    // Kısmi çözüm GÖSTERİLİR (spec §47) …
    expect(hasField(frame.fields, 'adsb-callsign')).toBe(true);
    // … ama düzeltme adayı ÜRETİLMEZ.
    expect(frame.fields.some((field) => field.id.includes('correct'))).toBe(false);
  });
});

describe('ADS-B — sözleşme bekçileri ve canParse', () => {
  it('alan id’leri tekil, offset/length BAYT cinsinden ve sınır içinde', () => {
    for (const example of adsbPlugin.exampleFrames) {
      const result = adsbParser.parse(example.bytes);
      if (!result.success) continue;
      const ids = result.frame.fields.map((field) => field.id);
      expect(new Set(ids).size, example.id).toBe(ids.length);
      for (const field of result.frame.fields) {
        expect(field.offset + field.length, `${example.id}/${field.id}`).toBeLessThanOrEqual(
          example.bytes.length,
        );
        expect(Array.from(field.rawBytes)).toEqual(
          Array.from(example.bytes.slice(field.offset, field.offset + field.length)),
        );
      }
    }
  });

  it('`unit` YALNIZ gerçek fiziksel değerlerde — TC, kategori, CPR ve bayraklar BİRİMSİZ', () => {
    const unitless = [
      'adsb-type-code',
      'adsb-aircraft-category',
      'adsb-callsign',
      'adsb-cpr-format',
      'adsb-cpr-latitude',
      'adsb-cpr-longitude',
      'adsb-surveillance-status',
      'adsb-nic-supplement-b',
      'adsb-velocity-subtype',
      'adsb-intent-change',
      'adsb-nac-v',
    ];
    const seen = new Set<string>();
    for (const example of adsbPlugin.exampleFrames) {
      const result = adsbParser.parse(example.bytes);
      if (!result.success) continue;
      for (const field of result.frame.fields) {
        seen.add(field.id);
        if (unitless.includes(field.id)) expect(field.unit, field.id).toBeUndefined();
      }
    }
    // Sağlık kontrolü: liste gerçekten sınandı, boş küme üzerinde değil.
    for (const id of unitless) expect(seen.has(id), id).toBe(true);
  });

  it('`decodeOptions` AÇILMADI — Type Code kendini anlatıyor', () => {
    expect(adsbPlugin.decodeOptions).toBeUndefined();
  });

  it('örnek çerçevelerin `expectedValid` beyanı gerçek sonuçla örtüşüyor', () => {
    for (const example of adsbPlugin.exampleFrames) {
      const result = adsbParser.parse(example.bytes);
      const actual = result.success && result.frame.valid;
      expect(actual, example.id).toBe(example.expectedValid);
    }
  });

  it('canParse `mode-s`inkinden DAHA DARDIR: 14 bayt + DF ∈ {17,18} + CRC PASS', () => {
    expect(canParseAdsb(modeSBytesFromHex(EXAMPLE_IDENTIFICATION))).toBe(true);
    expect(canParseAdsb(modeSBytesFromHex(EXAMPLE_DF18_IDENTIFICATION))).toBe(true);
    // CRC bozuk → hayır (adres-açık sınıfında üçüncü kanıt VAR).
    expect(canParseAdsb(modeSBytesFromHex(EXAMPLE_CRC_FAIL))).toBe(false);
    // DF20 → hayır; DF11 kısa çerçeve → hayır.
    expect(canParseAdsb(modeSBytesFromHex(EXAMPLE_NOT_EXTENDED_SQUITTER))).toBe(false);
    expect(canParseAdsb(modeSBytesFromHex('5D4840D6F8740F'))).toBe(false);
    expect(canParseAdsb(new Uint8Array())).toBe(false);
  });
});
