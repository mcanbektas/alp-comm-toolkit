import { describe, expect, it } from 'vitest';

import { bytesToHex } from '@/protocol-core/buffers/representation';
import type { ParseResult, ParsedField } from '@/protocol-core/types';

import {
  encodeRfTelemetryFrame,
  hasPreambleOnlySignature,
  hasRfTelemetrySignature,
  hasSyncWordScanSignature,
  rfTelemetryParser,
  rfTelemetryPlugin,
} from './rfTelemetry';

function example(id: string): Uint8Array {
  const frame = rfTelemetryPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (frame === undefined) throw new Error(`örnek yok: ${id}`);
  return frame.bytes;
}

function parse(bytes: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return rfTelemetryParser.parse(bytes, options === undefined ? undefined : { options });
}

function fieldOf(result: ParseResult, id: string): ParsedField {
  if (!result.success) throw new Error(`çözüm başarısız: ${result.error.code} ${result.error.message}`);
  const field = result.frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

const hex = (bytes: Uint8Array): string => bytesToHex(bytes).toLowerCase();

/**
 * "Çerçeve geçerli mi" tek bir sorudur ama İKİ yolla `hayır` çıkar: ya
 * `parse` hiç tamamlanmaz (bozuk `Length` çerçeveyi aşar), ya da tamamlanır ve
 * CRC tutmaz. Yanlış yapılandırmayı sınayan testler ikisini de kabul eder —
 * hangisinin çıkacağı çöp baytların değerine bağlıdır, bir kapsam kararına değil.
 */
function decodesToValidFrame(result: ParseResult): boolean {
  return result.success && result.frame.valid;
}

describe('rfTelemetry — örnek 1: varsayılan profil', () => {
  it('çerçeve BAYT BAYT beklenen değerdir — CRC motordan geldi, spec\'in `C9 21`inden DEĞİL', () => {
    // Bağımsız hesap: CRC-16/CCITT-FALSE(01 14 04 34 12 78 56) = 0xAC54.
    // Aynı hesaplayıcı `"123456789"` için yayımlanmış beş `check` değerini de
    // birebir üretiyor (`crcEngine.test.ts`), yani topoloji de doğrulanmış.
    expect(hex(example('default-profile'))).toBe('aaaaaa2dd401140434127856ac54');
  });

  it('yedi alanı çözer ve CRC PASS verir', () => {
    const result = parse(example('default-profile'));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields.map((field) => field.id)).toEqual([
      'preamble',
      'syncWord',
      'deviceId',
      'packetType',
      'length',
      'data',
      'crc',
    ]);
    expect(fieldOf(result, 'deviceId').rawValue).toBe(0x01);
    expect(fieldOf(result, 'packetType').rawValue).toBe(0x14);
    expect(fieldOf(result, 'length').rawValue).toBe(4);
    expect(hex(fieldOf(result, 'data').rawBytes)).toBe('34127856');
    expect(fieldOf(result, 'crc').valid).toBe(true);
    expect(fieldOf(result, 'crc').rawValue).toBe(0xac54n);
  });

  it('ofsetler ve uzunluklar BAYTTIR ve `ParsedFrame` DÜZDÜR', () => {
    const result = parse(example('default-profile'));
    if (!result.success) throw new Error('çözülemedi');
    expect(fieldOf(result, 'preamble').offset).toBe(0);
    expect(fieldOf(result, 'syncWord').offset).toBe(3);
    expect(fieldOf(result, 'data').offset).toBe(8);
    expect(fieldOf(result, 'crc').offset).toBe(12);
    expect(fieldOf(result, 'crc').length).toBe(2);
    // Hiçbir alanın çocuk alanı yok — `ParsedField` sözleşmesi.
    for (const field of result.frame.fields) {
      expect(Object.hasOwn(field, 'fields')).toBe(false);
      // `unit` yalnız gerçek fiziksel değere verilir; bu kayıtta hiçbir alan
      // mühendislik birimi taşımaz (Device ID bir adres, Length bir sayaç).
      expect(field.unit).toBeUndefined();
    }
  });
});

describe('rfTelemetry — örnek 2: PN9 beyazlatma bir KANALDIR', () => {
  it('telde beyazlatılmış gövde taşır', () => {
    expect(hex(example('whitened'))).toBe('aaaaaa2dd4fef519aefffd6588be');
  });

  it('beyazlatma KAPALIYKEN çerçeve ÇÖZÜLEMEZ', () => {
    const result = parse(example('whitened'));
    expect(decodesToValidFrame(result)).toBe(false);
    // Beyazlatılmış gövdede `Length` baytı 0x19 (25) okunur ve çerçeveyi aşar:
    // yanlış yapılandırma burada CRC'ye bile varmadan yakalanıyor.
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });

  it('PN9 AÇIKKEN örnek 1 ile AYNI alanları verir ve CRC PASS olur', () => {
    const result = parse(example('whitened'), { whitening: 'pn9', whiteningSeed: 0x1ff });
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(true);
    expect(hex(fieldOf(result, 'data').rawBytes)).toBe('34127856');
    expect(fieldOf(result, 'crc').rawValue).toBe(0xac54n);
    // Önbelleme ve sync BEYAZLATILMAZ — alıcı senkronizasyonu onlara dayanır.
    expect(hex(fieldOf(result, 'preamble').rawBytes)).toBe('aaaaaa');
    expect(hex(fieldOf(result, 'syncWord').rawBytes)).toBe('2dd4');
  });

  it('YANLIŞ tohumla çözülünce PASS olmaz — tohum gerçek bir kanaldır', () => {
    const result = parse(example('whitened'), { whitening: 'pn9', whiteningSeed: 0x0ff });
    expect(decodesToValidFrame(result)).toBe(false);
  });
});

describe('rfTelemetry — örnek 3: Manchester', () => {
  it('tel örnek 1\'in İKİ KATIDIR ve sync sözcüğü `A6 59 59 9A` olarak çıkar', () => {
    const wire = example('manchester');
    expect(wire.length).toBe(example('default-profile').length * 2);
    // Sync sözcüğü telde 6..10 baytlarında; brifin fixture'ı burada YENİDEN
    // görünüyor (`manchester.test.ts` onu modül düzeyinde de ASSERT ediyor).
    expect(hex(wire.subarray(6, 10))).toBe('a659599a');
  });

  it('IEEE 802.3 polaritesiyle çözülür, CRC PASS verir ve ofsetler TELE göre ölçeklenir', () => {
    const result = parse(example('manchester'), { manchesterPolarity: 'ieee802.3' });
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(true);
    // Ofsetler kullanıcının yapıştırdığı TEL baytlarını gösterir: her çözülmüş
    // bayt tam iki tel baytıdır.
    expect(fieldOf(result, 'preamble').offset).toBe(0);
    expect(fieldOf(result, 'preamble').length).toBe(6);
    expect(fieldOf(result, 'data').offset).toBe(16);
    expect(fieldOf(result, 'data').length).toBe(8);
    expect(fieldOf(result, 'crc').offset).toBe(24);
    expect(fieldOf(result, 'crc').length).toBe(4);
    // `rawBytes` tel dilimidir; ÇÖZÜLMÜŞ değer `rawValue`da durur.
    expect(fieldOf(result, 'crc').rawBytes.length).toBe(4);
    expect(fieldOf(result, 'crc').rawValue).toBe(0xac54n);
    expect(result.frame.rawFrame.bytes.length).toBe(28);
  });

  it('TERS polarite hat kodlaması düzeyinde HATA VERMEZ, sessizce tersler', () => {
    const result = parse(example('manchester'), { manchesterPolarity: 'thomas' });
    expect(decodesToValidFrame(result)).toBe(false);
    // 🚨 Kaydedilmiş OLGU: Manchester çözücüsü HİÇ şikâyet etmedi — her çift
    // hâlâ geçerliydi, yalnız her bit terslendi (`manchester.test.ts` bunu
    // modül düzeyinde ASSERT ediyor). Hata ancak terslenmiş `Length` baytı
    // (0x04 → 0xFB) çerçeveyi aşınca, yani ÇOK SONRA görünüyor.
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).not.toBe('unsupported-encoding');
      expect(result.error.code).toBe('truncated-frame');
    }
  });

  it('geçersiz Manchester çifti `unsupported-encoding` ile konumuyla bildirilir', () => {
    // Ham (kodlanmamış) çerçeve Manchester olarak okunmaya çalışılırsa:
    // 0xAA = 1010 1010 → ilk çift `10` geçerli, ama `AA AA` dizisi ilerleyince
    // `00`/`11` çiftine düşer. Kesin bir vaka için sıfırdan bir tel verelim.
    const result = parse(Uint8Array.from([0x00, 0x00, 0x00, 0x00]), {
      manchesterPolarity: 'ieee802.3',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('unsupported-encoding');
    expect(result.error.offset).toBe(0);
  });

  it('tek sayıda tel baytı reddedilir', () => {
    const result = parse(Uint8Array.from([0xa6, 0x59, 0x59]), { manchesterPolarity: 'ieee802.3' });
    expect(result.success).toBe(false);
  });

  it('`canParse` Manchester telinde FALSE döner — ham telde önbelleme YOKTUR', () => {
    expect(hasRfTelemetrySignature(example('manchester'))).toBe(false);
  });
});

describe('rfTelemetry — hata yolları', () => {
  it('örnek 4: bozuk CRC baytı FAIL basar ama alanlar YİNE DE çözülür', () => {
    const result = parse(example('crc-mismatch'));
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(false);
    expect(fieldOf(result, 'crc').valid).toBe(false);
    expect(result.frame.errors.map((error) => error.code)).toContain('checksum-mismatch');
    // Kısmi çözüm gösterilir (spec §47).
    expect(hex(fieldOf(result, 'data').rawBytes)).toBe('34127856');
  });

  it('örnek 5: `Length = 0xFF` çerçeveyi aşar', () => {
    const result = parse(example('length-overflow'));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('truncated-frame');
  });

  it('`includes-header` yorumunda negatif yük uzunluğu `length-mismatch` verir', () => {
    // `Length = 0` + `includes-header` ⇒ 0 − 3 = −3.
    const result = parse(example('zero-length-payload'), { lengthFieldSemantics: 'includes-header' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('length-mismatch');
  });

  it('boş girdi çözülmez', () => {
    const result = parse(new Uint8Array(0));
    expect(result.success).toBe(false);
  });
});

describe('rfTelemetry — örnek 6: sıfır uzunluklu yük', () => {
  it('`Length = 0` sınır durumunda CRC hemen gelir ve PASS eder', () => {
    expect(hex(example('zero-length-payload'))).toBe('aaaaaa2dd4011400341b');
    const result = parse(example('zero-length-payload'));
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(true);
    expect(fieldOf(result, 'data').length).toBe(0);
    expect(fieldOf(result, 'crc').offset).toBe(8);
    expect(fieldOf(result, 'crc').rawValue).toBe(0x341bn);
  });
});

describe('rfTelemetry — örnek 7: AYNI gövde, FARKLI algoritma', () => {
  it('varsayılan CRC-16/CCITT-FALSE ile FAIL, CRC-16/MODBUS + little-endian ile PASS', () => {
    // 🚨 CLAUDE.md kuralının kullanıcıya GÖSTERİLEN hâli: aynı bit genişliği
    // aynı algoritma değildir. Gövde birebir örnek 1'inki; yalnız CRC farklı.
    expect(hex(example('modbus-crc'))).toBe('aaaaaa2dd401140434127856f51f');
    expect(hex(example('modbus-crc').subarray(0, 12))).toBe(
      hex(example('default-profile').subarray(0, 12)),
    );

    const withDefault = parse(example('modbus-crc'));
    if (!withDefault.success) throw new Error('çözülemedi');
    expect(withDefault.frame.valid).toBe(false);

    const withModbus = parse(example('modbus-crc'), {
      crcAlgorithm: 'CRC16_MODBUS',
      crcByteOrder: 'little',
    });
    if (!withModbus.success) throw new Error('çözülemedi');
    expect(withModbus.frame.valid).toBe(true);
    expect(fieldOf(withModbus, 'crc').rawValue).toBe(0x1ff5n);
  });

  it('doğru algoritma ama YANLIŞ bayt sırası hâlâ FAIL — bayt sırası ayrı bir kanaldır', () => {
    const result = parse(example('modbus-crc'), { crcAlgorithm: 'CRC16_MODBUS' });
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(false);
  });
});

describe('rfTelemetry — örnek 8: `Length` neyi sayıyor', () => {
  it('AYNI baytlar iki farklı yorumda iki farklı çerçevedir', () => {
    expect(hex(example('length-includes-crc'))).toBe('aaaaaa2dd401140634127856e8d7');

    // Varsayılan (`payload-only`): Data 6 bayt sayılır, CRC alanı çerçeveyi aşar.
    const withDefault = parse(example('length-includes-crc'));
    expect(withDefault.success).toBe(false);
    if (!withDefault.success) expect(withDefault.error.code).toBe('truncated-frame');

    // `includes-crc`: Data 4 bayt, CRC yerinde ve PASS.
    const withSemantics = parse(example('length-includes-crc'), {
      lengthFieldSemantics: 'includes-crc',
    });
    if (!withSemantics.success) throw new Error('çözülemedi');
    expect(withSemantics.frame.valid).toBe(true);
    expect(hex(fieldOf(withSemantics, 'data').rawBytes)).toBe('34127856');
  });
});

describe('rfTelemetry — kalan kanallar çıktıyı BAYT DÜZEYİNDE değiştirir', () => {
  it('`crcCoverage` kapsanan bayt aralığını gerçekten kaydırır', () => {
    const covered = parse(example('default-profile'), { crcCoverage: 'deviceId' });
    const narrower = parse(example('default-profile'), { crcCoverage: 'data' });
    if (!covered.success || !narrower.success) throw new Error('çözülemedi');
    expect(covered.frame.valid).toBe(true);
    // Kapsam yalnız `Data`ya daralınca aynı saklı CRC artık tutmaz.
    expect(narrower.frame.valid).toBe(false);
  });

  it('`preambleLength` / `syncWordLength` alan SINIRLARINI kaydırır', () => {
    // 4 + 1, varsayılan 3 + 2 ile AYNI toplamı verir: header aynı yerden
    // başlar, CRC kapsamı aynı baytları görür ve çerçeve GEÇERLİ kalır —
    // ama sync sözcüğü artık tek bayttır. Aynı tel, başka bir bildirim.
    const shifted = parse(example('default-profile'), { preambleLength: 4, syncWordLength: 1 });
    if (!shifted.success) throw new Error('çözülemedi');
    expect(fieldOf(shifted, 'preamble').length).toBe(4);
    expect(hex(fieldOf(shifted, 'preamble').rawBytes)).toBe('aaaaaa2d');
    expect(fieldOf(shifted, 'syncWord').offset).toBe(4);
    expect(fieldOf(shifted, 'syncWord').length).toBe(1);
    expect(fieldOf(shifted, 'deviceId').offset).toBe(5);
    expect(shifted.frame.valid).toBe(true);

    // Toplam DEĞİŞİNCE header kayar ve çerçeve çözülemez hâle gelir.
    const broken = parse(example('default-profile'), { preambleLength: 2, syncWordLength: 2 });
    expect(decodesToValidFrame(broken)).toBe(false);
  });

  it('önbellemesiz / senkronsuz tel de çözülür — alanlar hiç basılmaz', () => {
    // Bazı alıcılar preamble ve sync sözcüğünü tüketip yalnız gövdeyi verir.
    // Örnek 1'in ilk beş baytı atılınca kalan dizi bu profilde GEÇERLİDİR.
    const bare = example('default-profile').subarray(5);
    const result = parse(bare, { preambleLength: 0, syncWordLength: 0 });
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.fields.map((field) => field.id)).toEqual([
      'deviceId',
      'packetType',
      'length',
      'data',
      'crc',
    ]);
    expect(result.frame.valid).toBe(true);
    expect(fieldOf(result, 'deviceId').offset).toBe(0);
  });

  it('`crcAlgorithm = none` CRC alanını hiç basmaz', () => {
    const result = parse(example('default-profile'), { crcAlgorithm: 'none' });
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.fields.map((field) => field.id)).not.toContain('crc');
    expect(result.frame.valid).toBe(true);
  });

  it('`manchesterBitOrder` çözülen baytları değiştirir', () => {
    const msb = parse(example('manchester'), {
      manchesterPolarity: 'ieee802.3',
      manchesterBitOrder: 'msb-first',
    });
    const lsb = parse(example('manchester'), {
      manchesterPolarity: 'ieee802.3',
      manchesterBitOrder: 'lsb-first',
    });
    expect(decodesToValidFrame(msb)).toBe(true);
    expect(decodesToValidFrame(lsb)).toBe(false);
  });

  it('varsayılan profilden SAPMA hata değil UYARIDIR', () => {
    const altered = Uint8Array.from(example('default-profile'));
    altered[0] = 0x55;
    altered[3] = 0x99;
    const result = parse(altered);
    if (!result.success) throw new Error('çözülemedi');
    const codes = result.frame.warnings.map((warning) => warning.code);
    expect(codes).toContain('protocol.rfTelemetry.warning.preambleMismatch');
    expect(codes).toContain('protocol.rfTelemetry.warning.syncWordMismatch');
  });

  it('ON kanal bildirilir ve hepsinin varsayılanı geçerli bir şıktır', () => {
    const options = rfTelemetryPlugin.decodeOptions ?? [];
    expect(options).toHaveLength(10);
    for (const option of options) {
      if (option.kind === 'select') {
        expect(option.choices?.some((choice) => choice.value === option.defaultValue)).toBe(true);
      } else {
        expect(typeof option.defaultValue).toBe('number');
      }
    }
  });
});

describe('rfTelemetry — `build` sekmesi: encoder', () => {
  it('varsayılan profilde örnek 1\'i BİREBİR üretir — Length ve CRC hesaplanır', () => {
    const built = encodeRfTelemetryFrame({
      deviceId: 0x01,
      packetType: 0x14,
      data: Uint8Array.from([0x34, 0x12, 0x78, 0x56]),
    });
    expect(hex(built)).toBe(hex(example('default-profile')));
  });

  it('üretilen çerçeve `parse` ile geri okunur (round-trip)', () => {
    const built = encodeRfTelemetryFrame({
      deviceId: 0x2a,
      packetType: 0x07,
      data: Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x00]),
    });
    const result = parse(built);
    if (!result.success) throw new Error('çözülemedi');
    expect(result.frame.valid).toBe(true);
    expect(fieldOf(result, 'deviceId').rawValue).toBe(0x2a);
    expect(fieldOf(result, 'length').rawValue).toBe(5);
    expect(hex(fieldOf(result, 'data').rawBytes)).toBe('deadbeef00');
  });
});

describe('rfTelemetry — canParse imzası', () => {
  it('varsayılan profilin önbellemesi VE sync sözcüğü birlikte aranır', () => {
    expect(hasRfTelemetrySignature(example('default-profile'))).toBe(true);
    expect(hasRfTelemetrySignature(example('whitened'))).toBe(true);
    expect(hasRfTelemetrySignature(example('zero-length-payload'))).toBe(true);
  });

  it('sync sözcüğü tutmazsa reddeder — önbelleme TEK BAŞINA yetmez', () => {
    const onlyPreamble = Uint8Array.from([
      0xaa, 0xaa, 0xaa, 0x00, 0x00, 0x01, 0x14, 0x04, 0x34, 0x12, 0x78, 0x56, 0xac, 0x54,
    ]);
    expect(hasRfTelemetrySignature(onlyPreamble)).toBe(false);
    expect(hasPreambleOnlySignature(onlyPreamble)).toBe(true);
  });

  it('10 bayttan kısa çerçeveyi reddeder', () => {
    expect(hasRfTelemetrySignature(Uint8Array.from([0xaa, 0xaa, 0xaa, 0x2d, 0xd4]))).toBe(false);
  });

  it('REDDEDİLEN gevşek imza (sync\'i ilk 12 baytta ARAMAK) daha geniştir', () => {
    const syncLater = Uint8Array.from([
      0x00, 0x11, 0x22, 0x33, 0x2d, 0xd4, 0x01, 0x14, 0x04, 0x34, 0x12, 0x78,
    ]);
    expect(hasSyncWordScanSignature(syncLater)).toBe(true);
    expect(hasRfTelemetrySignature(syncLater)).toBe(false);
  });
});
