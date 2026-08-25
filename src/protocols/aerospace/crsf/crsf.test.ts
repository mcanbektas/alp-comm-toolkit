import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { parseCrsf, crsfParser, crsfPlugin } from './crsf';
import type { ParsedField } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15d — CRSF. `packedChannels.test.ts`/`sbus.ts` `BitOrder`ı
 * İZOLE kanıtladı; burada motorun 15c'nin yardımcısını `'lsb-first'` ile
 * GERÇEKTEN çağırdığı, İKİ AYRI CRC-8'in AYRI doğrulandığı (dosya başı "brif
 * madde 7"), CRC kapsamının Type'tan başladığı (zorunlu disiplin) ve
 * `payload`ın yalnız `0x16` için çözüldüğü sınanır.
 */

function field(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`alan bulunamadı: ${id}`);
  return found;
}

function hasField(fields: readonly ParsedField[], id: string): boolean {
  return fields.some((candidate) => candidate.id === id);
}

function example(id: string): Uint8Array {
  const found = crsfPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`örnek bulunamadı: ${id}`);
  return found.bytes;
}

// `packedChannels.test.ts`teki `BitOrder` kanıt fixture'ıyla (`sbus.ts`in de
// kullandığı) AYNI değerler — çapraz doğrulanmış, dosya başı notuyla aynı gerekçe.
const EXPECTED_RAW_CHANNELS = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
];
// `TICKS_TO_US(x) = (x-992)*5/8+1500`, C'nin sıfıra-doğru bölmesiyle (bkz.
// crsf.ts dosya başı, "Tam sayı bölmesi C yarısıdır") — Node'da bağımsızca
// `Math.trunc` kullanılarak üretildi (bu dosyanın YAZIMI sırasında, motorun
// GÖVDESİNE bakılmadan).
const EXPECTED_US_CHANNELS = [
  880, 943, 1005, 1068, 1130, 1193, 1255, 1318, 1380, 1443, 1505, 1567, 1630, 1692, 1755, 1817,
];

describe('crsf — çerçeve uzunluğu / arabellek', () => {
  it('3 bayttan kısa girdi (Type okunamaz) truncated-frame ile success:false döner', () => {
    const result = parseCrsf(new Uint8Array([0xc8, 0x18]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('truncated-frame');
  });

  it('Frame Length asgarinin (broadcast: 2) altındaysa length-mismatch — yalnız address/length/type gösterilir', () => {
    // Type=0x16 (broadcast) ama Frame Length=1 — Type+CRC bile sığmaz.
    const result = parseCrsf(Uint8Array.from([0xc8, 0x01, 0x16]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.map((error) => error.code)).toEqual(['length-mismatch']);
    expect(hasField(result.frame.fields, 'address')).toBe(true);
    expect(hasField(result.frame.fields, 'frame-length')).toBe(true);
    expect(hasField(result.frame.fields, 'type')).toBe(true);
    expect(hasField(result.frame.fields, 'frame-crc')).toBe(false);
  });

  it('genişletilmiş bir tip (0x28) Frame Length asgarisinin (4) altındaysa length-mismatch verir', () => {
    const result = parseCrsf(Uint8Array.from([0xc8, 0x03, 0x28, 0x00, 0x00]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors.map((error) => error.code)).toEqual(['length-mismatch']);
  });

  it('Command (0x32) Frame Length asgarisinin (6) altındaysa length-mismatch verir', () => {
    const result = parseCrsf(Uint8Array.from([0xc8, 0x05, 0x32, 0xec, 0xea, 0x01, 0x02]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors.map((error) => error.code)).toEqual(['length-mismatch']);
  });

  it('Frame Length 62yi (MAX_LENGTH_BYTE) aşarsa frame-too-long verir', () => {
    const result = parseCrsf(Uint8Array.from([0xc8, 0x3f, 0x16]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors.map((error) => error.code)).toEqual(['frame-too-long']);
  });

  it('bildirilen uzunluk için arabellek yetersizse truncated-frame verir (address/length/type yine gösterilir)', () => {
    // Frame Length=24 (rc-channels-packed ile aynı) ama yalnız 5 bayt geldi.
    const result = parseCrsf(Uint8Array.from([0xc8, 0x18, 0x16, 0x00, 0x20]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors.map((error) => error.code)).toEqual(['truncated-frame']);
    expect(field(result.frame.fields, 'type').rawValue).toBe(0x16);
  });

  it('AbortSignal zaten tetiklenmişse parser-timeout ile success:false döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = crsfParser.parse(example('rc-channels-packed'), { signal: controller.signal });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('parser-timeout');
  });
});

describe('crsf — 0x16 RC Channels Packed: packedChannels lsb-first ile GERÇEKTEN çağrılıyor', () => {
  it('16 kanalın ham (paketli) değeri de BEKLENEN sayılara çözülür', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    expect(result.success).toBe(true);
    if (!result.success) return;

    EXPECTED_RAW_CHANNELS.forEach((expectedValue, index) => {
      const raw = field(result.frame.fields, `crsf-channel-${String(index)}`);
      expect(raw.rawValue).toBe(expectedValue);
      // Ham paketli değer — `unit` BİLEREK yok (dosya başı, types.ts:46).
      expect(raw.unit).toBeUndefined();
    });
  });

  it('16 kanalın TÜRETİLMİŞ µs değeri protokolce tanımlı TICKS_TO_US formülüyle eşleşir (unit YALNIZ burada)', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    EXPECTED_US_CHANNELS.forEach((expectedUs, index) => {
      const us = field(result.frame.fields, `crsf-channel-${String(index)}-us`);
      expect(us.physicalValue).toBe(expectedUs);
      expect(us.unit).toBe('µs');
      expect(us.rawValue).toBeUndefined();
    });
  });

  it('C tam sayı bölmesi SIFIRA DOĞRU keser — Math.floor KULLANILSAYDI farklı (yanlış) sonuç çıkardı', () => {
    // ticks=100: (100-992)*5/8 = -557.5. trunc → -557 → us=943. floor → -558 → us=942.
    // Bu test yalnız "yeşil" değil, YÖNÜ gerçekten sınıyor (dosya başı disiplini).
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const channel1Us = field(result.frame.fields, 'crsf-channel-1-us').physicalValue;
    expect(channel1Us).toBe(943);
    expect(channel1Us).not.toBe(942);
  });

  it('CH1 alanı bayt 3–4 aralığını (payload offset 3) kapsar ve adı yerel bit aralığı taşır', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const ch1 = field(result.frame.fields, 'crsf-channel-0');
    expect(ch1.offset).toBe(3);
    expect(ch1.length).toBe(2);
    expect(ch1.name).toBe('CH1 (bit 0:10)');
  });

  it('ardışık kanal 0/1 AYNI baytı paylaşır ama id ÇAKIŞMAZ (kanal İNDEKSİ id’de, offset’te DEĞİL)', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const ch1 = field(result.frame.fields, 'crsf-channel-0');
    const ch2 = field(result.frame.fields, 'crsf-channel-1');
    expect(ch1.offset + ch1.length - 1).toBe(ch2.offset);
    expect(ch1.id).not.toBe(ch2.id);
  });

  it('Frame CRC PASS eder, hata YOK, çerçeve geçerli', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const frameCrc = field(result.frame.fields, 'frame-crc');
    expect(frameCrc.physicalValue).toBe('PASS');
    expect(frameCrc.valid).toBe(true);
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
    // 0x32 DEĞİL — command CRC alanı bu çerçevede HİÇ YOK.
    expect(hasField(result.frame.fields, 'command-crc')).toBe(false);
  });

  it('Adres alanı Flight Controller olarak adlandırılır (ADDRESS_NAMES sözlüğü)', () => {
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const address = field(result.frame.fields, 'address');
    expect(address.rawValue).toBe(0xc8);
    expect(address.physicalValue).toBe('Flight Controller');
    expect(address.valid).toBe(true);
  });
});

describe('crsf — CRC KAPSAMI: Type\'tan başlar, Address/Frame Length HESABA GİRMEZ (zorunlu disiplin)', () => {
  it('YANLIŞ kapsamla (Address+Length+Type+Payload) hesaplanan CRC, doğru (Type+Payload) kapsamdan FARKLI çıkar', () => {
    const bytes = example('rc-channels-packed');
    // Doğru kapsam: Type (offset 2) .. son payload baytı (frameCrcOffset-1).
    const frameCrcOffset = bytes.length - 1;
    const correctScope = bytes.slice(2, frameCrcOffset);
    // YANLIŞ kapsam: Address+Length'i de İÇİNE alan tüm baştan.
    const wrongScope = bytes.slice(0, frameCrcOffset);

    const correctCrc = computeNamedCrc(correctScope, 'CRC8_DVB_S2');
    const wrongCrc = computeNamedCrc(wrongScope, 'CRC8_DVB_S2');

    expect(correctCrc).not.toBe(wrongCrc);
    // Motorun GERÇEKTEN doğru kapsamı kullandığının kanıtı: yayınlanan CRC
    // baytı yalnız DOĞRU kapsamla eşleşiyor.
    const transmitted = BigInt(bytes[frameCrcOffset] ?? 0);
    expect(correctCrc).toBe(transmitted);
    expect(wrongCrc).not.toBe(transmitted);
  });

  it('yanlış kapsamla hesaplanan CRC bu motora verilseydi PASS eden bir çerçeve FAIL gösterirdi', () => {
    // Yukarıdaki testin tersinden kanıtı: motorun kendi `frame-crc` alanı
    // GERÇEK (doğru kapsamlı) hesaba göre PASS diyor — bu, "CRC'yi çerçevenin
    // TAMAMINA uygula" varsayımının BU çerçevede sessizce YANLIŞ FAIL
    // üreteceğini (yukarıdaki `wrongCrc !== transmitted` sonucuyla) gösterir.
    const result = parseCrsf(example('rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');
    expect(field(result.frame.fields, 'frame-crc').physicalValue).toBe('PASS');
  });
});

describe('crsf — 0x17/0x18 satıcı tarafından ÖNERİLMİYOR, payload ÇÖZÜLMEZ', () => {
  it('subset-rc-channels-packed: tip adlandırılır, payload HAM, İKİ uyarı da basılır, Frame CRC yine PASS eder', () => {
    const result = parseCrsf(example('subset-rc-channels-packed'));
    if (!result.success) throw new Error('parse başarısız');

    const type = field(result.frame.fields, 'type');
    expect(type.rawValue).toBe(0x17);
    expect(type.physicalValue).toBe('Subset RC Channels Packed');

    const payload = field(result.frame.fields, 'payload');
    expect(payload.rawBytes).toEqual(Uint8Array.from([0x11, 0x22, 0x33, 0x44]));
    expect(payload.warnings).toContain('protocol.crsf.warning.payloadNotDecodedForFrameType');
    expect(payload.warnings).toContain('protocol.crsf.warning.frameTypeDiscouragedByVendor');

    const frameWarningCodes = result.frame.warnings.map((warning) => warning.code);
    expect(frameWarningCodes).toContain('protocol.crsf.warning.payloadNotDecodedForFrameType');
    expect(frameWarningCodes).toContain('protocol.crsf.warning.frameTypeDiscouragedByVendor');

    expect(field(result.frame.fields, 'frame-crc').physicalValue).toBe('PASS');
    expect(result.frame.valid).toBe(true);
    // `0x17` bir RC kanal payload'u OLARAK çözülmedi — kanal alanı YOK.
    expect(hasField(result.frame.fields, 'crsf-channel-0')).toBe(false);
  });
});

describe('crsf — 0x16/0x17/0x18 DIŞINDAKİ tipler: adlandırılır ama payload ÇÖZÜLMEZ (kapsam daraltması DEĞİL)', () => {
  it('battery-sensor (0x08): tip adı basılır, payload HAM + tek uyarı (vendor-discouraged YOK)', () => {
    const result = parseCrsf(example('battery-sensor'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'type').physicalValue).toBe('Battery');
    const payload = field(result.frame.fields, 'payload');
    expect(payload.rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03, 0x04]));
    expect(payload.warnings).toEqual(['protocol.crsf.warning.payloadNotDecodedForFrameType']);
    expect(result.frame.valid).toBe(true);
  });
});

describe('crsf — genişletilmiş başlık (0x28 ve üzeri): Destination/Origin AYRI alanlar', () => {
  it('device-ping (0x28): Destination=Broadcast, Origin=Radio Transmitter, boş payload → payload alanı YOK', () => {
    const result = parseCrsf(example('device-ping'));
    if (!result.success) throw new Error('parse başarısız');

    const destination = field(result.frame.fields, 'destination');
    expect(destination.rawValue).toBe(0x00);
    expect(destination.physicalValue).toBe('Broadcast');

    const origin = field(result.frame.fields, 'origin');
    expect(origin.rawValue).toBe(0xea);
    expect(origin.physicalValue).toBe('Radio Transmitter');

    expect(hasField(result.frame.fields, 'payload')).toBe(false);
    expect(field(result.frame.fields, 'frame-crc').physicalValue).toBe('PASS');
    expect(result.frame.valid).toBe(true);
  });
});

describe('crsf — Command (0x32): Frame CRC ve Command CRC AYRI alanlar, AYRI doğrulanır (brif madde 7)', () => {
  it('command: Destination/Origin/Command CRC/Frame CRC hepsi ayrı alan, ikisi de PASS eder', () => {
    const result = parseCrsf(example('command'));
    if (!result.success) throw new Error('parse başarısız');

    expect(field(result.frame.fields, 'destination').physicalValue).toBe('CRSF Receiver');
    expect(field(result.frame.fields, 'origin').physicalValue).toBe('Radio Transmitter');

    const commandCrc = field(result.frame.fields, 'command-crc');
    const frameCrc = field(result.frame.fields, 'frame-crc');
    expect(commandCrc.physicalValue).toBe('PASS');
    expect(frameCrc.physicalValue).toBe('PASS');
    // Bayt sırası: Command CRC, Frame CRC'den ÖNCE gelir (offset küçük→büyük).
    expect(commandCrc.offset).toBeLessThan(frameCrc.offset);
    expect(commandCrc.id).not.toBe(frameCrc.id);

    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
  });

  it('command-crc-mismatch: Command CRC FAIL eder ama Frame CRC YİNE DE PASS eder — İKİ CRC BAĞIMSIZ', () => {
    const result = parseCrsf(example('command-crc-mismatch'));
    if (!result.success) throw new Error('parse başarısız');

    const commandCrc = field(result.frame.fields, 'command-crc');
    const frameCrc = field(result.frame.fields, 'frame-crc');
    expect(commandCrc.physicalValue).toBe('FAIL');
    expect(commandCrc.valid).toBe(false);
    expect(frameCrc.physicalValue).toBe('PASS');
    expect(frameCrc.valid).toBe(true);

    // Tek bir "CRC PASS" göstergesine İNDİRGENMEDİĞİNİN kanıtı: çerçeve
    // geçersiz (command CRC yüzünden) ama frame-crc alanı hâlâ PASS diyor —
    // ikisi AYNI şey DEĞİL.
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors).toHaveLength(1);
    expect(result.frame.errors[0]?.code).toBe('crc-mismatch');
    expect(result.frame.errors[0]?.message).toBe('protocol.crsf.error.commandCrcMismatch');
  });
});

describe('crsf — tanınmayan adres: HAM basılır + hata, ama kalan alanlar YİNE DE çözülür (spec §47)', () => {
  it('unrecognized-address: address valid:false + start-delimiter-not-found, kanallar yine doğru', () => {
    const result = parseCrsf(example('unrecognized-address'));
    if (!result.success) throw new Error('parse başarısız');

    const address = field(result.frame.fields, 'address');
    expect(address.rawValue).toBe(0x42);
    expect(address.physicalValue).toBeUndefined();
    expect(address.valid).toBe(false);

    expect(result.frame.errors.map((error) => error.code)).toEqual(['start-delimiter-not-found']);
    expect(result.frame.valid).toBe(false);

    // CRC adrese bakmadığı için (dosya başı) kanallar VE Frame CRC ETKİLENMEZ.
    expect(field(result.frame.fields, 'crsf-channel-0').rawValue).toBe(0);
    expect(field(result.frame.fields, 'crsf-channel-15').rawValue).toBe(1500);
    expect(field(result.frame.fields, 'frame-crc').physicalValue).toBe('PASS');
  });
});

describe('crsf — Frame CRC uyuşmazlığı', () => {
  it('frame-crc-mismatch: frame-crc valid:false + FAIL, crc-mismatch hatası, çerçeve geçersiz', () => {
    const result = parseCrsf(example('frame-crc-mismatch'));
    if (!result.success) throw new Error('parse başarısız');

    const frameCrc = field(result.frame.fields, 'frame-crc');
    expect(frameCrc.physicalValue).toBe('FAIL');
    expect(frameCrc.valid).toBe(false);
    expect(result.frame.errors.map((error) => error.code)).toEqual(['crc-mismatch']);
    expect(result.frame.errors[0]?.message).toBe('protocol.crsf.error.frameCrcMismatch');
    expect(result.frame.valid).toBe(false);
  });
});

describe('crsf — trailing bytes: bildirilen uzunluktan fazlası reddedilmez ama SESSİZ de geçilmez', () => {
  it('fazla bayt trailing-data alanı + uyarı üretir, ama çözüm yine başarılı olur', () => {
    const withExtra = Uint8Array.from([...example('rc-channels-packed'), 0xde, 0xad]);
    const result = parseCrsf(withExtra);
    if (!result.success) throw new Error('parse başarısız');

    const trailing = field(result.frame.fields, 'trailing-data');
    expect(trailing.rawBytes).toEqual(Uint8Array.from([0xde, 0xad]));
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('protocol.crsf.warning.trailingBytes');
    // Ana çözüm (kanallar, Frame CRC) fazla bayttan ETKİLENMEZ.
    expect(field(result.frame.fields, 'frame-crc').physicalValue).toBe('PASS');
  });
});

describe('crsf — decodeOptions.baudProfile: ÇERÇEVEYİ ETKİLEMEZ (dosya başı, bilerek)', () => {
  it('crsfPlugin.decodeOptions tek seçenek: baudProfile, üç şık, varsayılan standard', () => {
    expect(crsfPlugin.decodeOptions).toHaveLength(1);
    const option = crsfPlugin.decodeOptions?.[0];
    expect(option?.id).toBe('baudProfile');
    expect(option?.defaultValue).toBe('standard');
    expect(option?.choices?.map((choice) => choice.value)).toEqual(['standard', 'fcCompatibility', 'negotiated']);
  });

  it('baudProfile değişse de çözülen ALANLAR birebir AYNI kalır — yalnız metadata değişir', () => {
    const bytes = example('rc-channels-packed');
    const standard = parseCrsf(bytes, { baudProfile: 'standard' });
    const fcCompat = parseCrsf(bytes, { baudProfile: 'fcCompatibility' });
    if (!standard.success || !fcCompat.success) throw new Error('parse başarısız');

    expect(fcCompat.frame.fields).toEqual(standard.frame.fields);
    expect(standard.frame.rawFrame.metadata).toEqual({ baudProfile: 'standard' });
    expect(fcCompat.frame.rawFrame.metadata).toEqual({ baudProfile: 'fcCompatibility' });
  });

  it('bilinmeyen/eksik baudProfile değeri varsayılana (standard) düşer', () => {
    const result = parseCrsf(example('rc-channels-packed'), { baudProfile: 'garbage' });
    if (!result.success) throw new Error('parse başarısız');
    expect(result.frame.rawFrame.metadata).toEqual({ baudProfile: 'standard' });
  });
});

describe('crsfParser.canParse', () => {
  it('rc-channels-packed örneğini kabul eder', () => {
    expect(crsfParser.canParse(example('rc-channels-packed'))).toBe(true);
  });

  it('bilinmeyen adresi reddeder (uzunluk ve CRC doğru olsa bile)', () => {
    expect(crsfParser.canParse(example('unrecognized-address'))).toBe(false);
  });

  it('yanlış Frame CRC’yi reddeder (adres ve uzunluk doğru olsa bile)', () => {
    expect(crsfParser.canParse(example('frame-crc-mismatch'))).toBe(false);
  });

  it('yalnız Command CRC bozuksa YİNE DE kabul eder — canParse Command CRC’ye BAKMAZ', () => {
    expect(crsfParser.canParse(example('command-crc-mismatch'))).toBe(true);
  });

  it('çok kısa girdiyi reddeder', () => {
    expect(crsfParser.canParse(new Uint8Array([0xc8, 0x18]))).toBe(false);
  });
});

describe('crsfPlugin.exampleFrames — expectedValid gerçek parse sonucuyla TUTARLI', () => {
  it.each(crsfPlugin.exampleFrames.map((exampleFrame) => [exampleFrame.id, exampleFrame] as const))(
    '%s',
    (_id, exampleFrame) => {
      const result = parseCrsf(exampleFrame.bytes);
      if (exampleFrame.expectedValid === false) {
        const actuallyValid = result.success && result.frame.valid;
        expect(actuallyValid).toBe(false);
      } else {
        expect(result.success).toBe(true);
        if (result.success) expect(result.frame.valid).toBe(true);
      }
    },
  );
});
