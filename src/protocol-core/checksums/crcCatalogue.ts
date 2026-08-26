/**
 * reveng.sourceforge.io "Catalogue of parametrised CRC algorithms" kaynağından
 * BİREBİR alınan standart CRC tanımları (18'i dalga 1'den; sonraki dalgalar —
 * 3c RTCM `CRC24_Q`, 7c Zigbee `CRC16_KERMIT`, 11j USB `CRC16_USB`, 13a
 * Wireless M-Bus `CRC16_EN13757`, 14e FlexRay `CRC11_FLEXRAY`+
 * `CRC24_FLEXRAY_A/B`, 6 BACnet `CRC8_BACNET_MSTP`, 15d CRSF `CRC8_DVB_S2`+
 * `CRC8_CRSF_COMMAND` — kendi girişlerinde ayrıca kaynaklanır) ekledikçe
 * `CRC_ALGORITHM_IDS`in uzunluğu büyüdü; güncel sayı `CRC_ALGORITHM_IDS.length`
 * ile okunur, burada elle sabitlenmez. `poly`/`init`/`xorout` değerleri
 * UYDURULMADI ya da yuvarlanmadı — değiştirilirse `crcEngine.test.ts`'teki
 * `check` fixture'ları (ASCII "123456789" girdisinin beklenen CRC'si) tutmaz.
 * Bu yüzden burada elle "sadeleştirme" ya da "iyileştirme" yapılmaz.
 */

import { crc, crcBits } from './crcEngine';
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
  'CRC11_FLEXRAY',
  'CRC16_ARC',
  'CRC16_MODBUS',
  'CRC16_CCITT_FALSE',
  'CRC16_GENIBUS',
  'CRC16_XMODEM',
  'CRC16_X25',
  'CRC16_DNP',
  'CRC16_EN13757',
  'CRC16_KERMIT',
  'CRC16_USB',
  'CRC24',
  'CRC24_Q',
  'CRC24_FLEXRAY_A',
  'CRC24_FLEXRAY_B',
  'CRC24_MODE_S',
  'CRC8_DVB_S2',
  'CRC8_CRSF_COMMAND',
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
  /**
   * CRC-11/FLEXRAY — FlexRay header CRC'si (dalga 14e). reveng kataloğunda
   * "CRC-11/FLEXRAY" adıyla ATTESTED sınıfında duruyor; kaynağı FlexRay
   * Communications System Protocol Specification v3.0.1 §4.2.8 (poly/init/width)
   * + §4.5 (sözde kod).
   *
   * BAYT HİZASIZ KULLANILIR: bu CRC başlığın tam 20 biti üzerinden koşar, bu
   * yüzden `crc()` DEĞİL `crcBits(bytes, 20, ...)` ile çağrılır (gerekçe
   * `crcEngine.ts` dosya başında). `check` değeri yine de "123456789" ASCII'si
   * üzerinden, yani 72 bit üzerinden verilir — katalog kuralı bozulmasın diye.
   *
   * İkinci bağımsız kaynak: `dynm/pico-flexray` `utils/crc11_generator.c`
   * (`#define FLEXRAY_CRC11_POLY 0x385`, tablo üretimi init 0x1A ile) ve
   * `src/flexray_frame.c:29` `calculate_flexray_header_crc`. O tablo-tabanlı
   * uygulamayla bu bit-serial motor 20000 rastgele başlıkta BİREBİR aynı
   * sonucu verdi.
   */
  CRC11_FLEXRAY: {
    width: 11,
    poly: 0x385n,
    init: 0x01an,
    refin: false,
    refout: false,
    xorout: 0x000n,
  },
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
  /**
   * CRC-16/GENIBUS — LonTalk / ISO/IEC 14908-1'in NPDU CRC'si (dalga 17).
   *
   * **DEPONUN EN KESKİN SAHTE DOSTU BURADA.** `CRC16_CCITT_FALSE`tan YALNIZ
   * `xorout`ta ayrılır: aynı polinom (0x1021), aynı init (0xFFFF), aynı
   * yansıma (yok). Check değerleri buna rağmen bambaşkadır — 0xD64E vs
   * 0x29B1. 16a'nın dersi *"aynı POLİNOM aynı algoritma değildir"* idi; bu
   * vaka onu *"aynı polinom + aynı init + aynı yansıma bile aynı algoritma
   * değildir"*e indiriyor. `CRC16_X25` de aday gibi görünür (o da tümleyen
   * alır) ama YANSITIR — LonTalk yansıtmaz.
   *
   * Parametrelerin kaynağı: normatif LonTalk Protocol Specification v3.0
   * yalnız polinomu veriyor (*"X16 + X12 + X5 + 1, the CCITT CRC-16
   * standard"*); init/yansıma/xorout'u veren tek kaynak Echelon'un kendi
   * yığınıdır (`izot/lon-stack-ex`, `LtCUtil.c`in `LtCRC16`i, MIT):
   * `crc = USHRT_MAX` (init 0xFFFF), tablo üretimi `if (r & 0x8000U) r =
   * (r << 1) ^ 0x1021U` (MSB-first, yansıma YOK), `crc = ~crc` (xorout
   * 0xFFFF), sonuç BÜYÜK ENDIAN yazılıyor. O uygulama bu depoda bağımsızca
   * yeniden kuruldu ve "123456789" için reveng'in yayımlı 0xD64E değerini
   * üretti — `crcEngine.test.ts`teki fixture o değerdir.
   */
  CRC16_GENIBUS: {
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: false,
    refout: false,
    xorout: 0xffffn,
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
   * EN 13757-4 (Wireless M-Bus link-layer block CRC, dalga 13a) — reveng
   * kataloğunun "CRC-16/EN-13757" girdisi. **`CRC16_DNP` DEĞİL:** ikisi AYNI
   * polinomu (0x3D65) ve AYNI init'i (0x0000) paylaşır ama YANSITMA farklı —
   * DNP `refin`/`refout` true, EN-13757 FALSE (reveng: "width=16 poly=0x3d65
   * init=0x0000 refin=false refout=false xorout=0xffff check=0xc2b7
   * residue=0xa366 name=\"CRC-16/EN-13757\""). Bu ayrımı KAÇIRMAK sessizce
   * yanlış CRC üretirdi (aynı poly çakışması CRC16_USB'nin ARC ile
   * karıştırılmaması notuyla aynı tuzak sınıfı, yukarı bakınız).
   * Bağımsız ikinci kaynak: Kamstrup `meter-system` (`utils/crc16_wmbus.py`)
   * ve `rtl_433`nin `src/devices/m_bus.c`si (`CRC_POLY=0x3D65`,
   * `crc_calc = ~crc16(bytes, crc_offset, CRC_POLY, 0)` — init 0, sonuç
   * bitwise-NOT = xorout 0xFFFF, refin/refout false) — üçü de birebir aynı
   * parametrelerde buluşuyor (brief-faz10-dalga13.md wire-format araştırması).
   */
  CRC16_EN13757: {
    width: 16,
    poly: 0x3d65n,
    init: 0x0000n,
    refin: false,
    refout: false,
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
  /**
   * USB 2.0 veri paketi CRC'si (dalga 11j) — reveng kataloğunun "CRC-16/USB"
   * girdisi. **`CRC16_ARC` DEĞİL:** brief-faz10-dalga11.md:88 bunu "aday ama
   * doğrulanmadı" diye işaretlemişti, doğrulama sonucu ARC'nin TUTMADIĞI
   * çıktı — aynı polinom (0x8005), aynı yansıtma, ama `init`/`xorout`
   * farklı; check değerleri de ayrışıyor (ARC 0xBB3D ↔ USB 0xB4C8).
   *
   * Birincil kaynak: **USB 2.0 Specification Revision 2.0 §8.3.5 + §8.3.5.2**
   * (usb.org'un kendi `usb_20.zip` yayını, `usb_20.pdf`):
   *   - §8.3.5: "the shift registers in the generator and checker are seeded
   *     with an all-ones pattern" → `init: 0xFFFF`
   *   - §8.3.5: "the CRC in the generator is inverted and sent to the checker
   *     MSb first" → `xorout: 0xFFFF`
   *   - §8.3.5.2: "G(X) = X^16 + X^15 + X^2 + 1 … 1000000000000101B"
   *     → `poly: 0x8005`
   *   - §8.1: "Bits are sent out onto the bus least-significant bit (LSb)
   *     first" → `refin`/`refout` true
   * Bağımsız doğrulama (1-Wire/PEC turlarındaki disiplin): spec metnine
   * BİREBİR sadık bit-serial referans uygulama yazıldı ve §8.3.5.2'nin
   * yayımladığı alıcı residual'ı (1000000000001101B = 0x800D) birebir
   * üretti; aynı uygulamanın hat baytları (0xC8 0xB4) buradaki parametrik
   * modelin little-endian çıktısıyla (check 0xB4C8) örtüştü. Yani parametre
   * kümesi spec'ten TÜRETİLDİ, bir tablodan kopyalanmadı.
   */
  CRC16_USB: {
    width: 16,
    poly: 0x8005n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0xffffn,
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
  /**
   * CRC-24/FLEXRAY-A ve -B — FlexRay frame (trailer) CRC'si (dalga 14e).
   * Polinom AYNI (0x5D6DCB), TEK FARK `init`: kanal A 0xFEDCBA, kanal B
   * 0xABCDEF. Bu bir tuhaflık değil, KASITLI tasarım — reveng kataloğunun
   * kendi notu: "Channels A and B have different initial vectors to prevent
   * frames crossing channels." Kaynak: FlexRay Protocol Specification v3.0.1
   * §4.4 (tanım) + §4.5 (sözde kod), reveng'de ATTESTED.
   *
   * Bu yüzden `flexray.ts` bir `channel` decodeOptions kanalı AÇAR: doğrulama
   * hangi init'in kullanılacağına bağlıdır ve kanal çerçevenin İÇİNDE YOKTUR.
   *
   * `CRC24` (OpenPGP, poly 0x864CFB) ve `CRC24_Q` ile KARIŞTIRMA — üçünün
   * polinomu da farklı; FlexRay'inki yalnız burada.
   *
   * İkinci bağımsız kaynak: `dynm/pico-flexray` `utils/crc24_generator.c`
   * (`#define FLEXRAY_CRC24_POLYNOMIAL 0x5D6DCB`, "Initial: 0xABCDEF"). Ayrıca
   * FlexRay Protocol Conformance Test Specification v3.0.1 §2.7.5'in 5+5
   * codeword'ünün ONU DA bu motorla yeniden ürettik (crcEngine.test.ts).
   */
  CRC24_FLEXRAY_A: {
    width: 24,
    poly: 0x5d6dcbn,
    init: 0xfedcban,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  CRC24_FLEXRAY_B: {
    width: 24,
    poly: 0x5d6dcbn,
    init: 0xabcdefn,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  /**
   * CRC-24/MODE-S (Faz 10 dalga 15h, Mode S / ADS-B 1090ES parity) — width 24,
   * poly 0xFFF409, init 0x000000, refin/refout false, xorout 0x000000.
   *
   * ── KATALOGDAKİ DÖRT 24-BİT CRC'NİN HİÇBİRİ BU DEĞİL ──────────────────────
   * "Aynı bit genişliği aynı CRC algoritması DEĞİLDİR" kuralının (dalga 13
   * dersi 2; 14g `CRC4_ITU`, 14h PSI5, 15d `CRC8_DVB_S2`/`CRC8_CRSF_COMMAND`)
   * YEDİNCİ vakası ve bu kez DÖRT sahte dost birden var:
   *   `CRC24` (OpenPGP)     poly 0x864CFB · init 0xB704CE → HAYIR
   *   `CRC24_Q`             poly 0x864CFB · init 0x000000 → HAYIR
   *   `CRC24_FLEXRAY_A`     poly 0x5D6DCB · init 0xFEDCBA → HAYIR
   *   `CRC24_FLEXRAY_B`     poly 0x5D6DCB · init 0xABCDEF → HAYIR
   * Dördü de 24 bit, dördü de bu protokolde SESSİZCE yanlış sonuç verirdi.
   *
   * ── POLİNOM ÜÇ BAĞIMSIZ YOLDAN DOĞRULANDI ────────────────────────────────
   *   1. **Belgeli üreteç** (ICAO Annex 10 Vol IV §3.1.2.6):
   *      G(x) = x²⁴+x²³+x²²+x²¹+x²⁰+x¹⁹+x¹⁸+x¹⁷+x¹⁶+x¹⁵+x¹⁴+x¹³+x¹²+x¹⁰+x³+1
   *      → üsler [23,22,21,20,19,18,17,16,15,14,13,12,10,3,0] → **0xFFF409**.
   *      Bu türetme ana thread'çe bağımsızca yapıldı, bir tablodan kopyalanmadı.
   *   2. **`antirez/dump1090`** — `modes_checksum_table` son sıfır olmayan
   *      girdisi 0xFFF409. DİKKAT: dump1090 polinom DÖNGÜSÜ kullanmaz, 112
   *      girişlik ÖNCEDEN HESAPLANMIŞ tablo kullanır; 0xFFF409 orada "polinom
   *      sabiti" diye durmaz, son veri bitinin katkısı olarak durur. Aynı dosya
   *      `return crc & 0x00FFFFFF;` → init 0, yansıtma yok, xorout yok.
   *   3. **`junzis/pyModeS`** `src/pyModeS/_bits.py:70`:
   *      `_CRC_POLY = 0xFFF409`, yorumu *"Per ICAO Annex 10 Vol IV §3.1.2.6.
   *      Two equivalent representations: 25-bit with implicit top bit 0x1FFF409
   *      … 24-bit with the top bit dropped 0x00FFF409"* — ve kendi tablosunu
   *      dump1090'ınkiyle 256 girdi boyunca çaprazladığını da yazıyor.
   *
   * ── TOPOLOJİ: DIRECT (NON-AUGMENTED), ŞANSA BIRAKILMADI ──────────────────
   * Mode S'te `init = 0` olduğu için augmented ve direct döngü AYNI sonucu
   * verir — ama bu bir ŞANS, bir kanıt değil. Kaynak turunda önce augmented
   * denendi ve kontrol amaçlı hesaplanan CRC-24/OPENPGP 0xEC4877 verdi
   * (yayımlanmış check 0x21CF02 DEĞİL); direct döngüye geçilince OpenPGP
   * 0x21CF02'ye oturdu. Yani buradaki `check` değeri, motorun YAYIMLANMIŞ bir
   * fixture'la doğrulanmış topolojisinden geçmiştir (dalga 14h PSI5 dersi).
   *
   * ── `check` VE GERÇEK MESAJ ──────────────────────────────────────────────
   * `check("123456789") = 0x054268` (`crcEngine.test.ts`). Ayrıca protokolün
   * KENDİ telinden bağımsız bir fixture var: gerçek bir DF17 extended
   * squitter'ın (`8D4840D6202CC371C32CE0576098`) ilk 11 baytı üzerinde
   * hesaplanan CRC son 3 bayta (PI = 0x576098) BİREBİR eşit. Aynı mesajın
   * 14 baytının TAMAMI üzerinde hesaplanınca kalan 0 çıkar — pyModeS'in
   * *"a valid message has a remainder of 0"* notuyla örtüşür.
   *
   * `crcBits()` ÇAĞRILMAZ: Mode S mesajları 56 ve 112 bittir, ikisi de tam
   * bayt (7 ve 14).
   */
  CRC24_MODE_S: {
    width: 24,
    poly: 0xfff409n,
    init: 0x000000n,
    refin: false,
    refout: false,
    xorout: 0x000000n,
  },
  /**
   * CRC-8/DVB-S2 (Faz 10 dalga 15d, CRSF frame CRC) — width 8, poly 0xD5,
   * init 0x00, refin/refout false, xorout 0x00. Katalogdaki beş CRC8'in
   * (`CRC8` 0x07, `CRC8_SAE_J1850` 0x1D, `CRC8_AUTOSAR` 0x2F, `CRC8_MAXIM`
   * 0x31, `CRC8_BACNET_MSTP` 0x81) HİÇBİRİ bu polinomla AYNI DEĞİL — "aynı
   * bit genişliği aynı CRC algoritması değildir" kuralının altıncı vakası
   * (dalga 13 dersi 2, 14g/14h'te iki kez uygulanmıştı).
   *
   * İki bağımsız kaynak, ana thread'in 2026-08-25 kaynak turunda örtüştü:
   *   1. Betaflight `common/crc.h:33`: `#define crc8_dvb_s2(crc, a)
   *      crc8_calc(crc, a, 0xD5)`; kullanımı `rx/crsf.c:334-336`
   *      (`crc = crc8_dvb_s2(0, crsfFrame.frame.type)` sonra payload).
   *   2. TBS'in resmî CRSF spec'i (`tbs-fpv/tbs-crsf-spec/crsf.md`, "CRC"
   *      bölümü): *"CRC8 implementation with polynom = x7+x6+x4+x2+x0
   *      (0xD5)"*; kapsam notu AYRICA örtüşüyor — *"CRC includes Type and
   *      Payload of each frame (doesn't include sync byte and frame
   *      length)"* (`crsf.ts` dosya başında bu kapsam kararı işlenir).
   * Ad reveng.sourceforge.io kataloğunun "CRC-8/DVB-S2" (DVB uydu yayını)
   * girdisiyle BİREBİR örtüşüyor — bu bir tesadüf değil, aynı standart
   * polinomun (x^8+x^7+x^5+x^3+x^1, 0xD5 üstte) farklı alanlarda yeniden
   * kullanılmasıdır. `check` değeri ("123456789" ASCII) bu motorla üretildi
   * VE reveng'in yayımlı "CRC-8/DVB-S2" check değeriyle (0xBC) örtüşüyor.
   */
  CRC8_DVB_S2: { width: 8, poly: 0xd5n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
  /**
   * CRC-8/CRSF-COMMAND (Faz 10 dalga 15d) — CRSF'in "Command Frame"
   * (`0x32`) çerçevelerine özel, frame CRC'den (`CRC8_DVB_S2`, yukarıda)
   * TAMAMEN AYRI bir İKİNCİ CRC-8: width 8, poly 0xBA, init 0x00, refin/
   * refout false, xorout 0x00. Katalogdaki ALTI CRC8'in (beş orijinal +
   * `CRC8_DVB_S2`) hiçbiriyle AYNI değil. `CRC8_BACNET_MSTP` girişindeki
   * gibi (dosya başı notu, yukarı bakınız) bu da reveng kataloğunda AYRI bir
   * "CRC-8/CRSF-COMMAND" adıyla listelenmiyor — bu yüzden ad bu depoya özgü,
   * protokolün kendi adından türetildi (`CRC8_DVB_S2` örneğindeki gibi).
   *
   * İki bağımsız kaynak:
   *   1. TBS'in resmî CRSF spec'i (`crsf.md`, "0x32 Direct Commands"):
   *      *"Command_CRC8 implementation with polynom = x7+x5+x4+x3+x1
   *      (0xBA)"*. KAPSAM AYRICA verilir: *"The CRC includes frame type
   *      (byte 0x32), Destination, Origin, Command ID and Payload of each
   *      Command Frame"* — yani Command CRC, çerçevenin sonundaki Frame
   *      CRC'nin YERİNE değil ONA EK olarak hesaplanır; spec kendi notuyla
   *      uyarıyor: *"Command CRC doesn't exclude CRC at the end of each
   *      CRSF frame. You will also need to include CRC at the end for the
   *      full frame."* (`crsf.ts` dosya başında iki CRC'nin kapsamı ayrı
   *      ayrı işlenir.)
   *   2. Betaflight `common/crc.h:36`: `#define crc8_poly_0xba(crc, a)
   *      crc8_calc(crc, a, 0xBA)`.
   * `check` değeri ("123456789" ASCII) bu motorla üretildi: 0x20 — aynı
   * motorun `CRC8` (poly 0x07) için ürettiği, bu depoda zaten belgeli
   * referans değerle (0xF4) birebir aynı topolojiden geçtiği için güven
   * ölçütü olarak kullanıldı (`crcEngine.test.ts` fixture'ı, dosya başı).
   */
  CRC8_CRSF_COMMAND: {
    width: 8,
    poly: 0xban,
    init: 0x00n,
    refin: false,
    refout: false,
    xorout: 0x00n,
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

/**
 * `computeNamedCrc`in bit uzunluğu alan kardeşi — bayt sınırına oturmayan
 * katalog girişleri için (bugün yalnız `CRC11_FLEXRAY`, 20 bit). Gerekçe
 * `crcEngine.ts` dosya başındaki "açık soru 4" notunda.
 */
export function computeNamedCrcBits(
  bytes: Uint8Array,
  bitLength: number,
  id: CrcAlgorithmId,
): bigint {
  return crcBits(bytes, bitLength, CRC_CATALOGUE[id]);
}
