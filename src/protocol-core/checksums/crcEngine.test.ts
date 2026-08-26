import { describe, expect, it } from 'vitest';

import { crc, crcBits } from './crcEngine';
import type { CrcParams } from './crcEngine';
import { computeNamedCrc, computeNamedCrcBits, CRC_ALGORITHM_IDS, CRC_CATALOGUE } from './crcCatalogue';
import type { CrcAlgorithmId } from './crcCatalogue';

/**
 * reveng.sourceforge.io kataloğundaki "check" değerleri: ASCII `"123456789"` (9
 * byte) girdisinin beklenen CRC'sidir, her kanonik CRC tanımının doğrulama
 * fixture'ıdır. Bu tabloya DOKUNULMAZ — dış kaynaktan doğrulanmış gerçek
 * değerlerdir, motor bunlara uymalı, tersi değil (bkz. crcCatalogue.ts başlığı).
 */
const CHECK_VALUES: Record<CrcAlgorithmId, bigint> = {
  CRC4_ITU: 0x7n,
  CRC5_USB: 0x19n,
  CRC6_ITU: 0x06n,
  CRC7_MMC: 0x75n,
  CRC8: 0xf4n,
  CRC8_SAE_J1850: 0x4bn,
  CRC8_AUTOSAR: 0xdfn,
  CRC8_MAXIM: 0xa1n,
  // BACnet MS/TP Header CRC-8 — reveng kataloğunda YOK (bu depoya özgü yeni
  // girdi, crcCatalogue.ts başlığına bak); "123456789" için değer bu motorla
  // üretildi, ayrıca Annex G test vektörüyle (5 bayt → 0x73/0x8C/residue 0x55)
  // bağımsızca doğrulandı.
  CRC8_BACNET_MSTP: 0x89n,
  // CRC-11/FLEXRAY (FlexRay header CRC, dalga 14e) — reveng kataloğunun yayımlı
  // check değeri. Bu CRC telde 20 BİT üzerinden koşar ama check değeri katalog
  // kuralı gereği "123456789"un 72 biti üzerindendir (crcCatalogue.ts notu).
  CRC11_FLEXRAY: 0x5a3n,
  CRC16_ARC: 0xbb3dn,
  CRC16_MODBUS: 0x4b37n,
  CRC16_CCITT_FALSE: 0x29b1n,
  // CRC-16/GENIBUS (LonTalk NPDU CRC, dalga 17) — reveng kataloğunun yayımlı
  // check değeri. `CRC16_CCITT_FALSE`tan YALNIZ `xorout`ta ayrıldığı hâlde
  // check tamamen farklı; ayrıca Echelon'un `LtCRC16` tablo döngüsü bağımsızca
  // yeniden kurulup aynı 0xD64E üretildi (crcCatalogue.ts'teki girdinin notu).
  CRC16_GENIBUS: 0xd64en,
  CRC16_XMODEM: 0x31c3n,
  CRC16_X25: 0x906en,
  CRC16_DNP: 0xea82n,
  // CRC-16/EN-13757 (Wireless M-Bus link-layer block CRC, dalga 13a) — reveng
  // kataloğunun yayımlı check değeri; Kamstrup meter-system + rtl_433 m_bus.c
  // ile bağımsızca çapraz doğrulandı (crcCatalogue.ts'teki CRC16_EN13757 notu).
  CRC16_EN13757: 0xc2b7n,
  // IEEE 802.15.4 FCS (dalga 7c) — reveng kataloğunun "CRC-16/KERMIT" girdisi;
  // bu motorla üretilip reveng'in yayımlı check değeriyle çapraz doğrulandı
  // (crcCatalogue.ts'teki CRC16_KERMIT girdisinin dosya başı notuna bak).
  CRC16_KERMIT: 0x2189n,
  // CRC-16/USB (dalga 11j) — reveng kataloğunun yayımlı check değeri; ayrıca
  // USB 2.0 §8.3.5'in metnine sadık bit-serial referans uygulamayla bağımsızca
  // üretildi (crcCatalogue.ts'teki CRC16_USB girdisinin notuna bak).
  CRC16_USB: 0xb4c8n,
  CRC24: 0x21cf02n,
  // CRC-24/Q (RTCM SC-104 / ITU-T H.224): CRC24 (OpenPGP) ile AYNI polinom
  // (0x864CFB), yalnız init 0x000000 — bu yüzden check değeri de farklı
  // (crcCatalogue.ts'teki CRC24_Q girdisinin dosya başı notuna bak).
  CRC24_Q: 0xcde703n,
  // CRC-24/FLEXRAY-A ve -B (FlexRay frame CRC, dalga 14e) — reveng kataloğunun
  // yayımlı check değerleri. AYNI polinom, farklı init: kanal A 0xFEDCBA,
  // kanal B 0xABCDEF (reveng: "Channels A and B have different initial vectors
  // to prevent frames crossing channels").
  CRC24_FLEXRAY_A: 0x7979bdn,
  CRC24_FLEXRAY_B: 0x1f23b8n,
  // CRC-24/MODE-S (Mode S / ADS-B 1090ES parity, dalga 15h) — reveng
  // kataloğunda AYRI bir girdisi yok, ad bu depoya özgü. Değer bu motorla
  // üretildi ve İKİ bağımsız yoldan bağlandı: (1) motorun topolojisi aynı
  // çağrıdan geçen CRC24/OpenPGP'nin YAYIMLANMIŞ check değeriyle (0x21CF02)
  // doğrulanmış durumda, (2) gerçek bir DF17 mesajının
  // (8D4840D6202CC371C32CE0576098) ilk 11 baytı üzerinde AYNI parametrelerle
  // hesaplanan CRC, mesajın kendi PI alanına (0x576098) birebir oturuyor
  // (crcCatalogue.ts'teki CRC24_MODE_S girdisinin dosya başı notuna bak).
  CRC24_MODE_S: 0x054268n,
  // CRC-8/DVB-S2 (CRSF frame CRC, dalga 15d) — reveng kataloğunun yayımlı
  // check değeri; Betaflight `common/crc.h:33` + TBS'in resmî CRSF spec'i
  // ("CRC" bölümü) bağımsızca örtüşüyor (crcCatalogue.ts'teki CRC8_DVB_S2
  // girdisinin dosya başı notuna bak).
  CRC8_DVB_S2: 0xbcn,
  // CRC-8/CRSF-COMMAND (CRSF komut çerçevesi — 0x32 — CRC'si, dalga 15d) —
  // reveng kataloğunda AYRI bir girdisi yok, bu depoya özgü ad; TBS spec'i +
  // Betaflight `common/crc.h:36` bağımsızca örtüşüyor (crcCatalogue.ts'teki
  // CRC8_CRSF_COMMAND girdisinin dosya başı notuna bak).
  CRC8_CRSF_COMMAND: 0x20n,
  CRC32: 0xcbf43926n,
  CRC32C: 0xe3069283n,
  CRC64: 0x995dc9bbdf1939fan,
};

const CHECK_INPUT = new TextEncoder().encode('123456789');

describe('computeNamedCrc — kanonik katalog fixture doğrulaması', () => {
  // Katalogdaki algoritmaların HER BİRİ tek tek doğrulanır: biri bile tutmazsa motorda
  // (özellikle refin/refout ya da width < 8 kaydırma mantığında) hata var demektir.
  it.each(CRC_ALGORITHM_IDS)('"123456789" için %s check değerini üretir', (id) => {
    expect(computeNamedCrc(CHECK_INPUT, id)).toBe(CHECK_VALUES[id]);
  });
});

describe('crc — custom (katalog dışı elle verilmiş) parametrelerle çağrı', () => {
  it('katalogdaki CRC-32 parametreleri elle geçirildiğinde computeNamedCrc ile aynı sonucu verir', () => {
    // "Custom CRC" için ayrı kod GEREKMEZ: motor zaten parametrik, kullanıcı kendi
    // CrcParams'ını doğrudan crc()'ye verebilir. Burada katalogdaki CRC-32'yi
    // "kullanıcı elle girdi" gibi kuruyoruz ve aynı sonucu aldığımızı doğruluyoruz.
    const customCrc32: CrcParams = {
      width: 32,
      poly: 0x04c11db7n,
      init: 0xffffffffn,
      refin: true,
      refout: true,
      xorout: 0xffffffffn,
    };

    expect(crc(CHECK_INPUT, customCrc32)).toBe(computeNamedCrc(CHECK_INPUT, 'CRC32'));
  });
});

/**
 * `crcBits` — bit uzunluğu alan kardeş (Faz 10 dalga 14e, açık soru 4).
 *
 * `crc()` artık BUNA DELEGE EDİYOR, bu yüzden yukarıdaki katalog fixture'larının
 * tamamı zaten delegasyonun bekçisi. Buradaki testler ek olarak KISMİ BAYT
 * yolunu kanıtlıyor — `crc()` o yolu hiç kullanmaz.
 */
describe('crcBits — bayt hizasız CRC', () => {
  const bytes = new TextEncoder().encode('123456789');

  it.each(CRC_ALGORITHM_IDS)(
    '%s için bitLength = 8 × bayt sayısı iken crc() ile BİREBİR aynı sonucu verir',
    (id) => {
      expect(crcBits(bytes, bytes.length * 8, CRC_CATALOGUE[id])).toBe(
        computeNamedCrc(bytes, id),
      );
    },
  );

  it('bitLength baytın katıysa sondaki baytları yok sayar', () => {
    // İlk 4 baytı 32 bit olarak işlemek, o 4 baytı crc()'ye vermekle aynıdır.
    expect(crcBits(bytes, 32, CRC_CATALOGUE.CRC32)).toBe(
      crc(bytes.slice(0, 4), CRC_CATALOGUE.CRC32),
    );
  });

  it('kısmi baytın ALT bitleri sonucu DEĞİŞTİRMEZ (yalnız üst bitLength%8 bit girer)', () => {
    // 20 bit istendiğinde üçüncü baytın yalnız üst 4 biti işlenir; alt 4 bit ne
    // olursa olsun sonuç aynı kalmalı. Yanlış bir dolgu kuralı tam burada
    // yakalanır — (b) şıkkının reddedilme gerekçesi bu.
    const a = Uint8Array.from([0xc0, 0x01, 0x00]);
    const b = Uint8Array.from([0xc0, 0x01, 0x0f]);
    expect(crcBits(a, 20, CRC_CATALOGUE.CRC11_FLEXRAY)).toBe(
      crcBits(b, 20, CRC_CATALOGUE.CRC11_FLEXRAY),
    );
    // Ama ÜST bit değişirse sonuç da değişmeli — testin boş yere geçmediğinin kanıtı.
    const c = Uint8Array.from([0xc0, 0x01, 0x80]);
    expect(crcBits(c, 20, CRC_CATALOGUE.CRC11_FLEXRAY)).not.toBe(
      crcBits(a, 20, CRC_CATALOGUE.CRC11_FLEXRAY),
    );
  });

  it('bitLength 0 iken init ile xorout birleşimini döner', () => {
    expect(crcBits(bytes, 0, CRC_CATALOGUE.CRC11_FLEXRAY)).toBe(
      CRC_CATALOGUE.CRC11_FLEXRAY.init ^ CRC_CATALOGUE.CRC11_FLEXRAY.xorout,
    );
  });

  it('arabelleği aşan bitLength RangeError atar', () => {
    expect(() => crcBits(bytes, bytes.length * 8 + 1, CRC_CATALOGUE.CRC32)).toThrow(RangeError);
  });

  it('negatif ya da tam sayı olmayan bitLength RangeError atar', () => {
    expect(() => crcBits(bytes, -1, CRC_CATALOGUE.CRC32)).toThrow(RangeError);
    expect(() => crcBits(bytes, 20.5, CRC_CATALOGUE.CRC32)).toThrow(RangeError);
  });

  it('refin + KISMİ bayt RangeError atar (tanımsız bileşim, sessizce yorumlanmaz)', () => {
    // CRC32 refin:true — 20 bit istemek son baytı yarım bırakır, "5 bitlik bir
    // baytı kendi içinde ters çevir" tanımsızdır.
    expect(() => crcBits(bytes, 20, CRC_CATALOGUE.CRC32)).toThrow(RangeError);
    // Ama bayt hizalıysa refin sorunsuz çalışır.
    expect(() => crcBits(bytes, 24, CRC_CATALOGUE.CRC32)).not.toThrow();
  });
});

/**
 * FlexRay CRC'lerinin ASIL kanıtı: FlexRay Protocol Conformance Test
 * Specification v3.0.1 §2.7.5'in codeword'leri (reveng kataloğu üzerinden).
 * Bir codeword = mesaj + CRC; motor mesajı işleyince CRC'yi YENİDEN üretmeli.
 *
 * Bu, "123456789" check değerinden DAHA GÜÇLÜ bir kanıttır: check değeri
 * parametrelerin doğru kopyalandığını gösterir, codeword ise parametrelerin
 * GERÇEK FlexRay çerçevelerinde doğru sonucu verdiğini gösterir.
 */
describe('FlexRay CRC — conformance test codeword doğrulaması', () => {
  /** 31 bitlik header codeword'leri: 20 bit mesaj + 11 bit CRC. */
  const HEADER_CODEWORDS = [
    '1100000000010000000100000100110',
    '1100000000001000100000100011011',
    '1100000000010000100001100000100',
    '0000000000011000100010111010010',
  ] as const;

  it.each(HEADER_CODEWORDS)('header codeword %s: ilk 20 bitten son 11 bit üretilir', (codeword) => {
    // 20 biti sola dayalı 3 bayta paketle — crcBits'in beklediği msb-first düzen.
    const message = codeword.slice(0, 20).padEnd(24, '0');
    const packed = Uint8Array.from([
      Number.parseInt(message.slice(0, 8), 2),
      Number.parseInt(message.slice(8, 16), 2),
      Number.parseInt(message.slice(16, 24), 2),
    ]);
    const expected = BigInt(Number.parseInt(codeword.slice(20), 2));
    expect(computeNamedCrcBits(packed, 20, 'CRC11_FLEXRAY')).toBe(expected);
  });

  /** Frame codeword'leri: başlık(5B) + payload, ardından 3 baytlık CRC. */
  const FRAME_CODEWORDS = [
    { hex: '18020209880000F339C1', id: 'CRC24_FLEXRAY_A' },
    { hex: '600A0248C80102646D70', id: 'CRC24_FLEXRAY_A' },
    { hex: '205606C848102030405060474380', id: 'CRC24_FLEXRAY_A' },
    { hex: '202E06C84810203040506096C9D1', id: 'CRC24_FLEXRAY_A' },
    { hex: '201A06C848102030405060B072EB', id: 'CRC24_FLEXRAY_A' },
    { hex: '18020209880000D5B910', id: 'CRC24_FLEXRAY_B' },
    { hex: '600A0248C8010242EDA1', id: 'CRC24_FLEXRAY_B' },
    { hex: '205606C848102030405060E6D9BE', id: 'CRC24_FLEXRAY_B' },
    { hex: '202E06C8481020304050603753EF', id: 'CRC24_FLEXRAY_B' },
    { hex: '201A06C84810203040506011E8D5', id: 'CRC24_FLEXRAY_B' },
  ] as const;

  it.each(FRAME_CODEWORDS)('frame codeword $hex ($id) yeniden üretilir', ({ hex, id }) => {
    const all = Uint8Array.from(
      hex.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
    );
    const message = all.slice(0, all.length - 3);
    const expected =
      (BigInt(all[all.length - 3] ?? 0) << 16n) |
      (BigInt(all[all.length - 2] ?? 0) << 8n) |
      BigInt(all[all.length - 1] ?? 0);
    expect(computeNamedCrc(message, id)).toBe(expected);
  });

  it('AYNI mesaj kanal A ve B için FARKLI CRC üretir (init kanala göre değişir)', () => {
    // Bu, `flexray.ts`in `channel` decodeOptions kanalını açmasının gerekçesi.
    const message = Uint8Array.from([0x18, 0x02, 0x02, 0x09, 0x88, 0x00, 0x00]);
    expect(computeNamedCrc(message, 'CRC24_FLEXRAY_A')).toBe(0xf339c1n);
    expect(computeNamedCrc(message, 'CRC24_FLEXRAY_B')).toBe(0xd5b910n);
  });
});
