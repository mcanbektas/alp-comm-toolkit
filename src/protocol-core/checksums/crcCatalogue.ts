/**
 * reveng.sourceforge.io "Catalogue of parametrised CRC algorithms" kaynağından
 * BİREBİR alınan 19 standart CRC tanımı (18'i dalga 1'den, `CRC24_Q` dalga
 * 10/3c'de RTCM için eklendi). `poly`/`init`/`xorout` değerleri UYDURULMADI ya
 * da yuvarlanmadı — değiştirilirse `crcEngine.test.ts`'teki `check` fixture'ları
 * (ASCII "123456789" girdisinin beklenen CRC'si) tutmaz. Bu yüzden burada elle
 * "sadeleştirme" ya da "iyileştirme" yapılmaz.
 */

import { crc } from './crcEngine';
import type { CrcParams } from './crcEngine';

export const CRC_ALGORITHM_IDS = [
  'CRC4_ITU',
  'CRC5_USB',
  'CRC6_ITU',
  'CRC7_MMC',
  'CRC8',
  'CRC8_SAE_J1850',
  'CRC8_AUTOSAR',
  'CRC8_MAXIM',
  'CRC8_BACNET_MSTP',
  'CRC16_ARC',
  'CRC16_MODBUS',
  'CRC16_CCITT_FALSE',
  'CRC16_XMODEM',
  'CRC16_X25',
  'CRC16_DNP',
  'CRC16_KERMIT',
  'CRC24',
  'CRC24_Q',
  'CRC32',
  'CRC32C',
  'CRC64',
] as const;

export type CrcAlgorithmId = (typeof CRC_ALGORITHM_IDS)[number];

/** Katalogdaki her algoritmanın `crc()`'ye doğrudan verilebilecek parametre kümesi. */
export const CRC_CATALOGUE: Record<CrcAlgorithmId, CrcParams> = {
  CRC4_ITU: { width: 4, poly: 0x3n, init: 0x0n, refin: true, refout: true, xorout: 0x0n },
  CRC5_USB: { width: 5, poly: 0x05n, init: 0x1fn, refin: true, refout: true, xorout: 0x1fn },
  CRC6_ITU: { width: 6, poly: 0x03n, init: 0x00n, refin: true, refout: true, xorout: 0x00n },
  CRC7_MMC: { width: 7, poly: 0x09n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
  CRC8: { width: 8, poly: 0x07n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
  CRC8_SAE_J1850: {
    width: 8,
    poly: 0x1dn,
    init: 0xffn,
    refin: false,
    refout: false,
    xorout: 0xffn,
  },
  CRC8_AUTOSAR: {
    width: 8,
    poly: 0x2fn,
    init: 0xffn,
    refin: false,
    refout: false,
    xorout: 0xffn,
  },
  CRC8_MAXIM: { width: 8, poly: 0x31n, init: 0x00n, refin: true, refout: true, xorout: 0x00n },
  /**
   * BACnet MS/TP Header CRC-8 (ANSI/ASHRAE 135 Annex G) — resmi metin bu
   * depoda YOK (brief-faz10-dalga6.md Karar 2). Mevcut dört CRC8 girdisinden
   * (yukarıda) HİÇBİRİ değil — parametreler İKİ bağımsız kamuya açık
   * kaynaktan ÇAPRAZ TEYİTLE alındı, KOD KOPYALANMADI:
   *   1. bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT): `src/crc.c`
   *      `CRC_Calc_Header()` aritmetiği ve `src/mstp.c`nin birim testi
   *      (yorumu "HeaderCRC==0x73, per Annex G example" diyen assert). poly/
   *      init/refin/refout/xorout bu testin geçmesi için TERS mühendislikle (256 aday
   *      polinom, hem reflected hem non-reflected model, 400+ rastgele
   *      deneme) tek bir eşleşme (poly=0x81) bulunarak elde edildi.
   *   2. Wireshark BACnet MS/TP dissector (github.com/wireshark/wireshark,
   *      epan/dissectors/packet-mstp.c) — AYNI algoritmayı bağımsızca gömer
   *      (`crc8` init 0xFF, `crc8=~crc8` finalize) ve gerçek yakalanmış
   *      trafiği bununla doğrular.
   * Üçüncü destekleyici kaynak (kod içermez): Steve Karg, "Understanding
   * BACnet MSTP Encoding" — init=0xFF ve iyi-çerçeve residue'sunun 0x55
   * olduğunu bağımsızca doğruluyor.
   * `check` değeri ("123456789") HİÇBİR kaynakta YOK — bu depodaki `crc()`
   * motorunun kendisiyle üretildi (crcEngine.test.ts `CHECK_VALUES`); Annex G
   * örneğinin (5 baytlık NPDU header → ham 0x73 / gönderilen 0x8C / residue
   * 0x55) bu motorla BAĞIMSIZCA yeniden üretilmesiyle ayrıca doğrulandı
   * (poly/init/xorout parametrelerinin kendisi, katalog dışı ikinci bir
   * uygulamayla — UBX 3c emsali).
   */
  CRC8_BACNET_MSTP: { width: 8, poly: 0x81n, init: 0xffn, refin: true, refout: true, xorout: 0xffn },
  CRC16_ARC: {
    width: 16,
    poly: 0x8005n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  CRC16_MODBUS: {
    width: 16,
    poly: 0x8005n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  CRC16_CCITT_FALSE: {
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  CRC16_XMODEM: {
    width: 16,
    poly: 0x1021n,
    init: 0x0000n,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  CRC16_X25: {
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0xffffn,
  },
  CRC16_DNP: {
    width: 16,
    poly: 0x3d65n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0xffffn,
  },
  /**
   * IEEE 802.15.4 FCS (dalga 7c, Zigbee MAC katmanı) — dosya başındaki reveng.
   * sourceforge.io kataloğunun "CRC-16/KERMIT" (a.k.a. CRC-16/CCITT-TRUE,
   * V.41-LSB) girdisiyle BİREBİR aynı: poly/init/xorout `CRC16_XMODEM`ın
   * (aynı poly, aynı init) TERSİ yönde yansıtılmış hâli — `refin`/`refout`
   * true olması dışında XMODEM'den ayrılır, `CRC16_CCITT_FALSE`/`CRC16_X25`
   * ile de (farklı init/xorout) KARIŞTIRILMAZ (dosya başı "değerler
   * UYDURULMAZ" kuralı, brief-faz10-dalga7.md tuzak notu).
   */
  CRC16_KERMIT: {
    width: 16,
    poly: 0x1021n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  CRC24: {
    width: 24,
    poly: 0x864cfbn,
    init: 0xb704cen,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  /**
   * CRC-24/Q ("CRC-24Q", RTCM SC-104 / ITU-T H.224 / Qualcomm) — RTCM 3.x çerçeve
   * bütünlüğünde kullanılır (brief-faz10-dalga3.md). Görev tarifi bunu CRC24'ten
   * "farklı polinom" diye tanımlıyordu ama bu YANLIŞ: polinom (0x864CFB) CRC24
   * (OpenPGP) ile BİREBİR AYNI — x^24+x^23+x^18+x^17+x^14+x^11+x^10+x^7+x^6+x^5+
   * x^4+x^3+x+1 açılımı da 0x1864CFB'ye (üst bit örtük) sadeleşiyor. TEK FARK
   * `init`: CRC24/OpenPGP 0xB704CE ile başlar, CRC-24/Q 0x000000 ile. `check`
   * değeri ("123456789" ASCII) bu motorla üretilip 0xB704CE'lik OpenPGP
   * fixture'ıyla (0x21CF02, üstte) çapraz doğrulandı — ikisi aynı `crc()`
   * çağrısından geçiyor, yalnız `init` değişiyor.
   */
  CRC24_Q: {
    width: 24,
    poly: 0x864cfbn,
    init: 0x000000n,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  CRC32: {
    width: 32,
    poly: 0x04c11db7n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  CRC32C: {
    width: 32,
    poly: 0x1edc6f41n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  CRC64: {
    width: 64,
    poly: 0x42f0e1eba9ea3693n,
    init: 0xffffffffffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffffffffffn,
  },
};

/** Katalogdan parametreleri alıp `crc()`'yi çağıran kolaylık fonksiyonu. */
export function computeNamedCrc(bytes: Uint8Array, id: CrcAlgorithmId): bigint {
  return crc(bytes, CRC_CATALOGUE[id]);
}
