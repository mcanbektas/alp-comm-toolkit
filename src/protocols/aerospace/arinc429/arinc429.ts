/**
 * ARINC 429 — 32-bit word çözümü. Faz 10, dalga 15f; `avionics-data-buses`
 * ailesinin İLK kaydı.
 *
 * ── GİRDİ: 32-BİT WORD'LERİN BAYT DİZİSİ, BİPOLAR RZ DALGASI DEĞİL ──────────
 * (`psi5.ts`/`dali.ts`in "GİRDİ HAM BAYT, MANCHESTER DEĞİL" kararının aynısı.)
 * Katalog `live` sekmesini BİLEREK dışarıda bıraktı ve gerekçesini yazdı
 * (`aerospace-uav.ts`): *"ilk sürümde analog waveform yakalama hedeflenmiyor,
 * girdi 32-bit raw word / HEX / CSV / adapter log dosyasıdır"*. Spec özeti
 * aynısını söylüyor (`06-havacilik-uav.md:290`). Fiziksel katman (bipolar RZ,
 * 12.5/100 kbit/s) bu motora HİÇ girmez.
 *
 * Girdi 4 baytın KATI olmalıdır; birden çok word gelirse hepsi tek bir
 * yakalama bloğu olarak çözülür (`canFrame.ts`in konteyner mantığının daha
 * basit hâli). Bu yüzden HER alan id'si word İNDEKSİNİ taşır
 * (`arinc429-word-3-label`) — yoksa ikinci word'ün alanları birincininkiyle
 * çakışırdı (`ftp.ts`/`rtcp.ts` vakalarının doğrudan mirasçısı).
 *
 * ── KAYNAKLAR — SPEC ÜCRETLİ, İKİ-BAĞIMSIZ-KAYNAK KURALI SIKI UYGULANDI ─────
 * ARINC Specification 429 SAE ITC tarafından SATILIYOR (aviation-ia.sae-itc.com),
 * depoda YOKTUR — `flexray`ın ISO 17458 durumuyla aynı sınıf (14e). Aşağıdaki
 * her yapısal iddia EN AZ İKİ BAĞIMSIZ kaynakla çaprazlandı:
 *
 *   1. **Wikipedia "ARINC 429"**, "Word format" + "Bit numbering, transmission
 *      order, and bit significance" bölümleri (kendi kaynağı: ARINC
 *      Specification 429 Part 1-17, Ballard Technology "ARINC 429 Programming
 *      Manual", Holt HI-8783/HI-3584 veri sayfaları).
 *   2. **`aeroneous/PyARINC429`** (Python, GitHub) — `arinc429/arinc429.py`:
 *      `LABEL_BITS = (1,8)`, `SDI_BITS = (9,10)`, `DATA_BITS = (11,29)`,
 *      `SSM_BITS = (30,31)`, `PARITY_BIT = 32`; `LABELS = {label:
 *      int(format(label,"08b")[::-1], 2)}` ("Mapping of labels to bit-reversed
 *      labels") ve `Word.label` → *"Extract the label, and return its
 *      bit-reversed counterpart."*
 *   3. **`musashin/Py429`** (Python, GitHub) — `ARINC429/Label.py`: *"located
 *      in the bits 1 to 8 with LSB at bit 8"*, `pack()` içinde
 *      `int('{:08b}'.format(label)[::-1], 2)`. YAYIMLANMIŞ TEST VEKTÖRLERİ
 *      (`UnitTests/LabelFieldTest.py`) bu dosyanın fixture'larına GİRDİ.
 *   4. **`RossWorks/ARINC429`** (Python, GitHub) — `Decode()`: 32 karakterlik
 *      bit dizisinde `Frame[24:32][::-1]` → oktal Label, `Frame[22:24]` → SDI,
 *      `Frame[3:22]` → payload, `Frame[1:3]` → SSM, tek parite kontrolü.
 *   5. **`ccxtechnologies/driver-avionics`** (C, Linux sürücüsü) —
 *      `driver/devices/hi3593.c`: **Holt HI-3593**, yani spec'in KENDİ
 *      referans verdiği (`06-havacilik-uav.md:290`) üreticinin ARINC 429
 *      alıcı-vericisi. Bu dosya iki `decodeOptions` kararının DOĞRUDAN kanıtı
 *      (aşağı bak).
 *
 * ── BİT NUMARALANDIRMASI: TEK KURAL, İKİ DAVRANIŞ ──────────────────────────
 * Brif tersliği *"Label alanı AYRICA terstir"* diye AYRI bir tuhaflık gibi
 * anlatıyordu. Kaynak (1) nedenini veriyor ve terslik bir tuhaflık DEĞİL, iki
 * alanın ZIT bit endianness'ının doğrudan sonucu:
 *
 *   *"Like CAN Protocol Identifier Fields, ARINC 429 label fields are
 *   transmitted most significant bit first. However, like UART Protocol,
 *   Binary-coded decimal numbers and binary numbers in the ARINC 429 data
 *   fields are generally transmitted least significant bit first. This
 *   renumbering highlights the relative reversal of "bit endianness" between
 *   the Label representation and numeric data representations."*
 *
 * Standardın bit 1'i İLK iletilir, yani 32-bit register'ın EN DÜŞÜK bitidir:
 *
 *   | Alan   | Bitler | İlk iletilen bit ne?     | Register'dan nasıl okunur   |
 *   |--------|--------|--------------------------|-----------------------------|
 *   | Label  | 1–8    | bit 1 = Label'ın **MSB** | oktet TERSLENİR             |
 *   | SDI    | 9–10   | —                        | doğal                       |
 *   | Data   | 11–29  | bit 11 = Data'nın **LSB**| doğal, terslemeYOK          |
 *   | SSM    | 30–31  | —                        | doğal                       |
 *   | Parity | 32     | —                        | doğal                       |
 *
 * Sayısal doğrulama (kaynak (1)in KENDİ vektörü): *"to transmit a Label 213₈
 * [or 8B₁₆] the bit-reversed value D1₁₆ is written to the Label octet"* —
 * `reverseOctet(0xD1) = 0x8B = 213₈`. ✓ Kaynak (2) aynı vektörü uygular
 * (`LABELS[0xD1] = 0x8B`), kaynak (3) YAYIMLANMIŞ fixture'larla çaprazlar
 * (041₈↔0x84, 107₈↔0xE2, 206₈↔0x61, 350₈↔0x17, 377₈↔0xFF), kaynak (4) aynı
 * dilimlemeyi bağımsız olarak yapar. **Dört bağımsız kaynak, sıfır çelişki.**
 *
 * **Dönüşüm TEK YERDE:** `arincBitPosition()` (ARINC bit numarası → `bitCursor`
 * konumu) ve `reverseOctet()`. Hiçbir alan okuması bu dönüşümü tekrarlamaz;
 * `arinc429.test.ts` ters sıranın FARKLI sonuç verdiğini ayrıca kanıtlar
 * (15c'nin `packedChannels.test.ts` BitOrder disiplini).
 *
 * ── `labelBitOrder` AÇILDI — TERSLİK BİR ADAPTER DEĞİŞKENİDİR ───────────────
 * Brifin `decodeOptions` tablosunda YOKTU. Kaynak (1): *"Newer or 'enhanced'
 * transceivers may be configured to reverse the Label field bit order 'in
 * hardware'"*; *"The suppliers that use this representation have in effect
 * renumbered the bits in the Label field"*. Kaynak (5) bunu KODDA kanıtlıyor:
 * `avionics.h` `AVIONICS_ARINC429RX_FLIP_LABEL_BITS (1<<7)` — Holt HI-3593
 * sürücüsünün ÇALIŞMA ZAMANI bayrağı, `avionics_arinc429rx_default` içinde
 * AÇIK. Yani **aynı yakalama, adapter'a göre iki türlü gelir.**
 *
 * → `labelBitOrder` (`standard` / `pre-reversed`) bir `decodeOptions` kanalı
 * olarak açıldı. Varsayılan UYDURULMAZ: seçilmezse Label **HAM 8 bit** basılır,
 * oktal gösterim BASILMAZ, `labelBitOrderNotSelected` uyarısı çıkar.
 * `wordByteOrder`ın gerekçesiyle BİREBİR aynı sınıf; `ioLink.ts`in
 * `messageSide`i gibi alan YERLEŞİMİNİ değil ama alan ANLAMINI değiştirir.
 *
 * ── `parityMode` AÇILDI — BRİF "AÇMA" DİYORDU, KAYNAK TURU ÇÜRÜTTÜ ─────────
 * Brif: *"`parityMode` seçeneği açılmaz (aşırı mühendislik) … Kaynak turu ters
 * bir kanal biçimi bulursa seçenek eklenir."* Kaynak turu BULDU: kaynak (5)
 * `AVIONICS_ARINC429RX_EVEN_PARITY (1<<0)` bayrağını taşıyor ve alıcı döngüsü
 * (`hi3593.c`) parite kontrolünü bu bayrağa göre TERSİNE çeviriyor; kaynak (2)
 * `Word(parity_type=EVEN_PARITY|ODD_PARITY)` ile aynı seçimi sunuyor. İki
 * bağımsız uygulama → seçenek eklendi. Varsayılan `odd`, çünkü kaynak (1)
 * *"Every ARINC 429 channel typically uses 'odd' parity"* diyor ve kaynak (5)in
 * varsayılan yapılandırmasında EVEN_PARITY biti KAPALI — ama "typically" bir
 * garanti değildir, o yüzden `odd` seçiliyken `parityModeAssumedOdd` uyarısı
 * KOŞULSUZ basılır.
 *
 * ── SSM: İKİ BİT HER ZAMAN BASILIR, SAYISAL DURUM ADI ASLA ─────────────────
 * Spec `:301` ve katalog yorumu SSM'in anlamının data encoding'e bağlı
 * olduğunu söylüyor. ÇAPRAZLAMA SONUCU BUNDAN DAHA SERT ÇIKTI: iki bağımsız
 * uygulama SSM'in SAYISAL tablosunda ÇELİŞİYOR —
 *
 *   kaynak (2) `BNR`: 0=Failure Warning · 1=No Computed Data · 2=Functional
 *                     Test · 3=Normal Operation
 *   kaynak (4) (tek tablo, encoding'den BAĞIMSIZ uyguluyor — spec'in AÇIKÇA
 *     yanlış dediği şey): 0=Failure Warning · **1=Functional Test** ·
 *     **2=Not Computed Data** · 3=Normal Operation
 *
 * Kaynak (1) dört durumun ADINI veriyor ama SAYISAL karşılıklarını VERMİYOR.
 * Üçüncü bir kaynak tie-break etmiyor. Depo kuralı nettir (dalga 13 dersi 5):
 * **iki kaynak örtüşmezse alan ADLANDIRILMAZ.** → SSM'in iki biti HER ZAMAN
 * ham basılır, sayısal durum adı (NO/FT/FW/NCD) HİÇBİR ZAMAN basılmaz,
 * `ssmStatusCodeNotCrossVerified` uyarısı çıkar.
 *
 * Encoding'e göre DEĞİŞEN ve gerçekten çaprazlanmış olan şey SSM'in ROLÜ'dür
 * (kaynak (1) + kaynak (2) örtüşüyor) ve bu alan ADINDA taşınır:
 *   • BNR    → SSM yalnız durum taşır, işaret bit 29'a DEVREDİLMİŞTİR
 *   • BCD    → SSM işaret de taşıyabilir (+/−, N/S, E/W)
 *   • Discrete → SSM'in işaretsiz, ayrı bir kodlaması vardır
 * `dataEncoding` seçilmediğinde alan adı nötrdür + `ssmMeaningRequiresEncoding`.
 * `ioLink.ts`in `messageSide` biçimi.
 *
 * ── LABEL ANLAMI ADLANDIRILMAZ ─────────────────────────────────────────────
 * Spec `:295`: *"Anlamı equipment ICD'sine bağlıdır — global olarak aynı
 * anlamı taşıdığı varsayılmamalıdır."* → Label SAYI/OKTAL basılır; "Altitude"
 * gibi bir ad ASLA. `mavlink.ts`in *"MESSAGE ID ADLANDIRILMAZ"* kararının
 * birebir aynısı. Aynı gerekçeyle SDI'nin semantik adı (spec `:296` "configured
 * equipment mapping VARSA") ve Discrete bit anlamları (spec `:300`) de
 * verilmez; katalog `definitions: ['vendor-map','custom-schema']` bildiriyor
 * ama **panel BOŞ kalır** (`snmp.ts:46` / `bleGatt.ts:34` / 14'ün `a2l`/`ldf`
 * emsali) — ICD veritabanı bu dalganın kapsamı DIŞINDA.
 *
 * ── GÖMÜLMEYECEKLER (`kLine.ts` disiplini) ─────────────────────────────────
 * `resolution` KODA GÖMÜLMEZ: spec `:298`in `0.1 ft` örneği bir ÖRNEKTİR,
 * evrensel bir sabit değil. Verilmezse fiziksel değer BASILMAZ. Türetilmiş BNR
 * alanı `unit` de ALMAZ: birim ICD'den gelir, `DecodeOption.kind` yalnız
 * `'select' | 'number'` olduğu için birim metnini çağırandan alacak bir kanal
 * YOKTUR — uydurmak yerine birimsiz basılır (`types.ts:46` "unit yalnız gerçek
 * fiziksel değere"). Label/SDI/SSM/ham Data zaten BİRİMSİZ.
 *
 * ── CRC YOK, PARİTE VAR ────────────────────────────────────────────────────
 * `crcEngine.ts`/`crcBits()` ÇAĞRILMAZ ve `checksums/` altına yeni dosya
 * AÇILMAZ (ana brifin "❌ crcBits" bölümü). Parite 32 bitin tamamı üzerinde
 * tek bir XOR-popcount'tur; tek satırlık bir hesap için modül açmak
 * `berReader.ts` dersinin tersidir. Parite GERÇEKTEN doğrulanır (dalga 13
 * dersi 3'ün pozitif yönü) ve başarısızlık `checksum-mismatch` hatası basar.
 *
 * ── `canParse` ZAYIF, VE BU ÖLÇÜLDÜ ────────────────────────────────────────
 * 32-bit word'ün ayırt edici bir imzası YOKTUR — herhangi 4 bayt geçerli bir
 * ARINC word'ü gibi görünür; `sbus`ın 25 bayt + `0x0F`ından bile zayıf.
 * `ProtocolParser.canParse(data: Uint8Array)` imzası `decodeOptions`a ASLA
 * ulaşamaz, yani `wordByteOrder` bilinmeden karar verilir. Şans eseri PARİTE
 * BAYT SIRASINDAN BAĞIMSIZDIR (popcount baytların sırasına bakmaz), o yüzden
 * tek elde kalan kanıt yine de kullanılabilir:
 *   1. uzunluk 4'ün katı ve ≥ 4,
 *   2. TÜM word'lerde tek (odd) parite.
 * Parite tek başına rastgele 1/2 geçer; N word'de 2⁻ᴺ.
 * `arinc429CanParseRegistry.test.ts` bunu VARSAYMAZ, ÖLÇER. 2026-08-25'te
 * ölçülen sayılar:
 *
 *   • registry ileri yön: 832 örnek çerçeveden 375'i uzunluk elemesini geçiyor,
 *     **42'si (%11) yanlış pozitif** — word sayısına göre N=1→17, N=2→14,
 *     N=3→2, N=4→8, N=5→1. (Sıfır DEĞİL ve olması da beklenmiyor.)
 *   • ters yön: kendi 8 örneğinden 6'sı kabul, 2'si (parite hatası + word
 *     hizasız) reddediliyor.
 *   • **EN ZAYIF HALKA** (15d/15e'nin dersi — registry'nin sonucu imzayı
 *     KANITLAMAZ, kalıbı sına): paritesi KASTEN doğru ayarlanmış rastgele
 *     word'lerde kabul oranı **N=1'de %100, N=8'de de %100**. Yani 2⁻ᴺ
 *     koruması yalnız pariteyi ayarlamayan girdilere karşı çalışır; ölçülen
 *     ayarlanmamış oranlar N=1→0.5007, N=2→0.2519, N=4→0.0614, N=8→0.0041
 *     (teorik 0.5 / 0.25 / 0.0625 / 0.0039) ile birebir örtüşüyor.
 *
 * ── KARAR: `canParse` YAPISAL OLARAK `false` DÖNER ────────────────────────
 * Yukarıdaki ölçüm bir gözlem değil, bu kararın GEREKÇESİDİR. Parite bir imza
 * değil bir elektir: paritesi doğru olan girdide 2⁻ᴺ koruması HİÇ çalışmıyor
 * (N=8'de bile %100 kabul), ve registry'de 42 yabancı çerçeve yanlış pozitif
 * veriyor.
 *
 * Belirleyici olan ASİMETRİ: bu kayıt `wordByteOrder`, `labelBitOrder` ve
 * `dataEncoding` seçilmeden anlamlı bir çözüm ÜRETEMEZ — üçünün de varsayılanı
 * YOK. Yani otomatik algılama DOĞRU çalışsa bile kullanıcıya kullanabileceği
 * bir şey vermez; kullanıcı zaten sayfaya gelip kalibrasyonu girmek
 * zorundadır. Yanlış negatifin bedeli (katalogdan elle seçmek) ölçülmüş yanlış
 * pozitifin bedelinden (42 alakasız protokolün algılamasını kirletmek) küçük.
 * Bu yüzden kayıt otomatik algılamaya HİÇ girmez.
 *
 * `uavcanCompatibility.ts` (15b, "asıl kayıtların çerçevesini çalmasın") ve
 * `ppm.ts`/`pwmServo.ts` (15e, "kalibrasyonsuz false") ile AYNI sınıf ve aynı
 * gerekçe. `parse()` ETKİLENMEZ — kullanıcı kaydı seçtiğinde çerçeve tam
 * çözülür, parite gerçekten doğrulanır.
 *
 * ── STATUS: 'ready' — GEREKÇE ──────────────────────────────────────────────
 * Word'ün BEŞ alanının hepsi (sınırları, bit yönü, parite kuralı) dört bağımsız
 * kaynakla çaprazlandı ve gerçekten çözülüyor; parite gerçekten doğrulanıyor.
 * Çözülmeyen tek şey Label/SDI/Discrete-bit ANLAMI, ve o çerçevede DEĞİL
 * ICD'dedir — `mavlink.ts`in payload'ı gibi, bir kapsam daraltması değil
 * girdinin kendisinde olmayan bir bilgi. `partial` olsaydı yanlış olurdu.
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'arinc-429';
const PROTOCOL_DISPLAY_NAME = 'ARINC 429';

/** Bir ARINC 429 word'ü 32 bittir ve tam 4 bayta oturur. */
const WORD_BIT_COUNT = 32;
const WORD_BYTE_LENGTH = 4;
const BITS_PER_BYTE = 8;

/** Alan sınırları — ARINC bit numaralandırması (1 tabanlı, bit 1 İLK iletilir). */
const LABEL_LOW_BIT = 1;
const LABEL_HIGH_BIT = 8;
const SDI_LOW_BIT = 9;
const SDI_HIGH_BIT = 10;
const DATA_LOW_BIT = 11;
const DATA_HIGH_BIT = 29;
const SSM_LOW_BIT = 30;
const SSM_HIGH_BIT = 31;
const PARITY_BIT = 32;

/** BCD basamağı 4 bittir; 19 bitlik Data alanı 4×4 + 3 bite bölünür (en anlamlı basamak 3 bit). */
const BCD_DIGIT_BITS = 4;
const BCD_MAX_DIGIT = 9;

const OPTION_WORD_BYTE_ORDER = 'wordByteOrder';
const OPTION_LABEL_BIT_ORDER = 'labelBitOrder';
const OPTION_DATA_ENCODING = 'dataEncoding';
const OPTION_PARITY_MODE = 'parityMode';
const OPTION_RESOLUTION = 'resolution';
const OPTION_DATA_LOW_BIT = 'dataLowBit';
const OPTION_DATA_HIGH_BIT = 'dataHighBit';

const UNSET = 'unset';
const BYTE_ORDER_LITTLE_ENDIAN = 'little-endian';
const BYTE_ORDER_BIG_ENDIAN = 'big-endian';
const LABEL_ORDER_STANDARD = 'standard';
const LABEL_ORDER_PRE_REVERSED = 'pre-reversed';
const ENCODING_RAW = 'raw';
const ENCODING_BNR = 'bnr';
const ENCODING_BCD = 'bcd';
const ENCODING_DISCRETE = 'discrete';
const PARITY_ODD = 'odd';
const PARITY_EVEN = 'even';

type WordByteOrder = typeof BYTE_ORDER_LITTLE_ENDIAN | typeof BYTE_ORDER_BIG_ENDIAN;
type LabelBitOrder = typeof LABEL_ORDER_STANDARD | typeof LABEL_ORDER_PRE_REVERSED;
type DataEncoding =
  | typeof ENCODING_RAW
  | typeof ENCODING_BNR
  | typeof ENCODING_BCD
  | typeof ENCODING_DISCRETE;
type ParityMode = typeof PARITY_ODD | typeof PARITY_EVEN;

const ERROR_EMPTY = 'protocol.arinc429.error.empty';
const ERROR_NOT_WORD_ALIGNED = 'protocol.arinc429.error.notWordAligned';
const ERROR_ABORTED = 'protocol.arinc429.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.arinc429.error.frameTooLong';
const ERROR_PARITY = 'protocol.arinc429.error.parity';

const WARN_WORD_BYTE_ORDER_NOT_SELECTED = 'protocol.arinc429.warning.wordByteOrderNotSelected';
const WARN_LABEL_BIT_ORDER_NOT_SELECTED = 'protocol.arinc429.warning.labelBitOrderNotSelected';
const WARN_PARITY_MODE_ASSUMED_ODD = 'protocol.arinc429.warning.parityModeAssumedOdd';
const WARN_DATA_BIT_RANGE_INVALID = 'protocol.arinc429.warning.dataBitRangeInvalid';

const FIELD_WARN_LABEL_MEANING = 'protocol.arinc429.field.labelMeaningRequiresIcd';
const FIELD_WARN_LABEL_BIT_ORDER = 'protocol.arinc429.field.labelBitOrderNotSelected';
const FIELD_WARN_SDI_SEMANTIC = 'protocol.arinc429.field.sdiSemanticNameRequiresIcd';
const FIELD_WARN_SSM_NEEDS_ENCODING = 'protocol.arinc429.field.ssmMeaningRequiresEncoding';
const FIELD_WARN_SSM_STATUS_NOT_VERIFIED = 'protocol.arinc429.field.ssmStatusCodeNotCrossVerified';
const FIELD_WARN_DATA_ENCODING_NOT_SELECTED = 'protocol.arinc429.field.dataEncodingNotSelected';
const FIELD_WARN_RESOLUTION_REQUIRED = 'protocol.arinc429.field.resolutionRequiredForPhysicalValue';
const FIELD_WARN_DISCRETE_BIT_MEANING = 'protocol.arinc429.field.discreteBitMeaningRequiresIcd';
const FIELD_WARN_BCD_DIGIT_OUT_OF_RANGE = 'protocol.arinc429.field.bcdDigitOutOfRange';
const FIELD_WARN_PARITY_FAILED = 'protocol.arinc429.field.parityFailed';
const FIELD_WARN_WORD_BYTE_ORDER = 'protocol.arinc429.field.wordByteOrderNotSelected';

// ─── BİT NUMARALANDIRMA DÖNÜŞÜMÜ — TEK YER ───────────────────────────────────

/**
 * ARINC bit numarasını (1..32) NORMALİZE EDİLMİŞ word'ün `bitCursor`
 * konumuna çevirir. **Bu dosyada bit numarasını konuma çeviren TEK yer budur**
 * (brif madde 3); hiçbir alan okuması bu aritmetiği tekrarlamaz.
 *
 * Normalize edilmiş word: 4 bayt, big-endian, yani bayt 0'ın en yüksek biti
 * ARINC bit 32'dir ve bayt 3'ün en düşük biti ARINC bit 1'dir. `msb-first`
 * okumada konum 0 = ARINC bit 32 olduğu için dönüşüm `32 − N`dir.
 */
function arincBitPosition(arincBitNumber: number): number {
  return WORD_BIT_COUNT - arincBitNumber;
}

/**
 * `[lowBit..highBit]` ARINC bit aralığını okur. Sonucun EN YÜKSEK biti
 * `highBit`, EN DÜŞÜK biti `lowBit`tir — yani Data alanında bit 11 LSB, bit 29
 * MSB olur (dosya başı tablosu, "Data doğal okunur").
 */
function readArincField(normalizedWord: Uint8Array, lowBit: number, highBit: number): number {
  return readBitsAsNumber(
    normalizedWord,
    arincBitPosition(highBit),
    highBit - lowBit + 1,
    'msb-first',
  );
}

/**
 * 8 bitlik okteti bit-tersler. Holt HI-3593 sürücüsündeki `reverse(__u8 b)`
 * ile BİREBİR aynı üçlü maske (kaynak (5)) — Label'in ZIT bit endianness'ını
 * çözen tek dönüşüm.
 */
function reverseOctet(byte: number): number {
  let value = byte & 0xff;
  value = ((value & 0xf0) >>> 4) | ((value & 0x0f) << 4);
  value = ((value & 0xcc) >>> 2) | ((value & 0x33) << 2);
  value = ((value & 0xaa) >>> 1) | ((value & 0x55) << 1);
  return value & 0xff;
}

/**
 * Girdideki 4 baytı NORMALİZE edilmiş (big-endian) word'e çevirir.
 *
 * `big-endian`: bayt 0 ARINC bit 32..25'i taşır — kaynak (5)in düzeni
 * (`hi3593.c` pariteyi `0x80 & buffer[0]` ile, Label oktetini `buffer[3]` ile
 * okuyor). `little-endian`: bayt 0 Label oktetidir, dizi ters çevrilir.
 */
function normalizeWord(data: Uint8Array, wordOffset: number, byteOrder: WordByteOrder): Uint8Array {
  const slice = data.slice(wordOffset, wordOffset + WORD_BYTE_LENGTH);
  return byteOrder === BYTE_ORDER_BIG_ENDIAN ? slice : slice.reverse();
}

/**
 * Bir bit alanını KAPSAYAN girdi baytı aralığı. `ParsedField.offset`/`length`
 * BAYT cinsindendir (`types.ts:41-42`, kilitli sözleşme) ve bit ayrıntısı alan
 * ADINDA taşınır (`rtp.ts`/`rtcp.ts` emsali) — ama kapsam yine de mümkün olan
 * en dar aralık olmalı ki byte-viewer doğru yeri vurgulasın. Register baytı
 * (LSB-0) girdi baytına byte order'a göre eşlenir.
 */
function arincFieldByteSpan(
  wordOffset: number,
  lowBit: number,
  highBit: number,
  byteOrder: WordByteOrder,
): { offset: number; length: number } {
  const lowRegisterByte = Math.floor((lowBit - 1) / BITS_PER_BYTE);
  const highRegisterByte = Math.floor((highBit - 1) / BITS_PER_BYTE);
  const first =
    byteOrder === BYTE_ORDER_LITTLE_ENDIAN
      ? lowRegisterByte
      : WORD_BYTE_LENGTH - 1 - highRegisterByte;
  const last =
    byteOrder === BYTE_ORDER_LITTLE_ENDIAN
      ? highRegisterByte
      : WORD_BYTE_LENGTH - 1 - lowRegisterByte;
  return { offset: wordOffset + first, length: last - first + 1 };
}

/** Word'deki 1 bitlerinin sayısı. Bayt SIRASINDAN bağımsızdır (dosya başı, `canParse`). */
function wordPopcount(data: Uint8Array, wordOffset: number): number {
  let count = 0;
  for (let index = 0; index < WORD_BYTE_LENGTH; index += 1) {
    let byte = data[wordOffset + index] ?? 0;
    while (byte !== 0) {
      count += byte & 1;
      byte >>>= 1;
    }
  }
  return count;
}

/** Parite kuralı: `odd`da 1 bitlerinin toplamı TEK, `even`da ÇİFT olmalıdır. */
function parityPasses(data: Uint8Array, wordOffset: number, mode: ParityMode): boolean {
  const isOdd = wordPopcount(data, wordOffset) % 2 === 1;
  return mode === PARITY_ODD ? isOdd : !isOdd;
}

/** `bitLength` bitlik iki tümleyen değeri işaretli sayıya çevirir (`bitCursor.toSignedBits`in number karşılığı). */
function toSigned(value: number, bitLength: number): number {
  const signBit = 2 ** (bitLength - 1);
  return value < signBit ? value : value - 2 ** bitLength;
}

// ─── SEÇENEKLER ──────────────────────────────────────────────────────────────

interface Arinc429Settings {
  readonly byteOrder: WordByteOrder | null;
  readonly labelBitOrder: LabelBitOrder | null;
  readonly dataEncoding: DataEncoding;
  readonly parityMode: ParityMode;
  /** 0 = VERİLMEDİ sentinel'i — gerçek bir çözünürlük hiçbir zaman 0 olamaz. */
  readonly resolution: number;
  readonly dataLowBit: number;
  readonly dataHighBit: number;
  readonly dataBitRangeInvalid: boolean;
}

function readPositiveNumberOption(options: Record<string, unknown> | undefined, id: string): number {
  const raw = options?.[id];
  // `0` ve altı SENTİNEL'dir — "verilmedi". `DecodeOption.defaultValue` zorunlu
  // olduğu için "varsayılan yok"u ancak böyle ifade edebiliyoruz (`ppm.ts` emsali).
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function resolveSettings(options: Record<string, unknown> | undefined): Arinc429Settings {
  const byteOrderRaw = options?.[OPTION_WORD_BYTE_ORDER];
  const labelOrderRaw = options?.[OPTION_LABEL_BIT_ORDER];
  const encodingRaw = options?.[OPTION_DATA_ENCODING];
  const parityRaw = options?.[OPTION_PARITY_MODE];

  let byteOrder: WordByteOrder | null = null;
  if (byteOrderRaw === BYTE_ORDER_LITTLE_ENDIAN) byteOrder = BYTE_ORDER_LITTLE_ENDIAN;
  else if (byteOrderRaw === BYTE_ORDER_BIG_ENDIAN) byteOrder = BYTE_ORDER_BIG_ENDIAN;

  let labelBitOrder: LabelBitOrder | null = null;
  if (labelOrderRaw === LABEL_ORDER_STANDARD) labelBitOrder = LABEL_ORDER_STANDARD;
  else if (labelOrderRaw === LABEL_ORDER_PRE_REVERSED) labelBitOrder = LABEL_ORDER_PRE_REVERSED;

  let dataEncoding: DataEncoding = ENCODING_RAW;
  if (encodingRaw === ENCODING_BNR) dataEncoding = ENCODING_BNR;
  else if (encodingRaw === ENCODING_BCD) dataEncoding = ENCODING_BCD;
  else if (encodingRaw === ENCODING_DISCRETE) dataEncoding = ENCODING_DISCRETE;

  const lowRaw = readPositiveNumberOption(options, OPTION_DATA_LOW_BIT);
  const highRaw = readPositiveNumberOption(options, OPTION_DATA_HIGH_BIT);
  // Kısmi girdi (yalnız biri) ve sınır dışı aralık SESSİZCE kabul edilmez:
  // varsayılan 11–29'a düşülür ve uyarı basılır.
  const bothGiven = lowRaw > 0 && highRaw > 0;
  const anyGiven = lowRaw > 0 || highRaw > 0;
  const withinWord =
    bothGiven && lowRaw >= DATA_LOW_BIT && highRaw <= DATA_HIGH_BIT && lowRaw <= highRaw;

  return {
    byteOrder,
    labelBitOrder,
    dataEncoding,
    parityMode: parityRaw === PARITY_EVEN ? PARITY_EVEN : PARITY_ODD,
    resolution: readPositiveNumberOption(options, OPTION_RESOLUTION),
    dataLowBit: withinWord ? lowRaw : DATA_LOW_BIT,
    dataHighBit: withinWord ? highRaw : DATA_HIGH_BIT,
    dataBitRangeInvalid: anyGiven && !withinWord,
  };
}

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_WORD_BYTE_ORDER,
    label: 'protocol.arinc429.option.wordByteOrder',
    kind: 'select',
    // Varsayılan UYDURULMAZ: adapter'a bağlı ve yanlış tahmin Label'i tamamen
    // kaydırır. Seçilmezse yalnız ham 4 bayt + parite basılır.
    defaultValue: UNSET,
    description: 'protocol.arinc429.option.wordByteOrder.description',
    choices: [
      { value: UNSET, label: 'protocol.arinc429.option.wordByteOrder.unset' },
      { value: BYTE_ORDER_LITTLE_ENDIAN, label: 'protocol.arinc429.option.wordByteOrder.littleEndian' },
      { value: BYTE_ORDER_BIG_ENDIAN, label: 'protocol.arinc429.option.wordByteOrder.bigEndian' },
    ],
  },
  {
    id: OPTION_LABEL_BIT_ORDER,
    label: 'protocol.arinc429.option.labelBitOrder',
    kind: 'select',
    // Dosya başı "`labelBitOrder` AÇILDI" — Holt HI-3593'ün
    // `FLIP_LABEL_BITS` bayrağının doğrudan karşılığı. Varsayılan YOK.
    defaultValue: UNSET,
    description: 'protocol.arinc429.option.labelBitOrder.description',
    choices: [
      { value: UNSET, label: 'protocol.arinc429.option.labelBitOrder.unset' },
      { value: LABEL_ORDER_STANDARD, label: 'protocol.arinc429.option.labelBitOrder.standard' },
      { value: LABEL_ORDER_PRE_REVERSED, label: 'protocol.arinc429.option.labelBitOrder.preReversed' },
    ],
  },
  {
    id: OPTION_DATA_ENCODING,
    label: 'protocol.arinc429.option.dataEncoding',
    kind: 'select',
    defaultValue: ENCODING_RAW,
    description: 'protocol.arinc429.option.dataEncoding.description',
    choices: [
      { value: ENCODING_RAW, label: 'protocol.arinc429.option.dataEncoding.raw' },
      { value: ENCODING_BNR, label: 'protocol.arinc429.option.dataEncoding.bnr' },
      { value: ENCODING_BCD, label: 'protocol.arinc429.option.dataEncoding.bcd' },
      { value: ENCODING_DISCRETE, label: 'protocol.arinc429.option.dataEncoding.discrete' },
    ],
  },
  {
    id: OPTION_PARITY_MODE,
    label: 'protocol.arinc429.option.parityMode',
    kind: 'select',
    defaultValue: PARITY_ODD,
    description: 'protocol.arinc429.option.parityMode.description',
    choices: [
      { value: PARITY_ODD, label: 'protocol.arinc429.option.parityMode.odd' },
      { value: PARITY_EVEN, label: 'protocol.arinc429.option.parityMode.even' },
    ],
  },
  {
    id: OPTION_RESOLUTION,
    label: 'protocol.arinc429.option.resolution',
    kind: 'number',
    // 0 = VERİLMEDİ. Üst sınır BİLEREK YOK: çözünürlük ICD'den gelir, 1e-6 de
    // 1e6 da gerçek bir değerdir; bir `max` UYDURMAK 15e'nin tarayıcı turunda
    // ölçtüğü sessiz kırpmayı geri getirirdi.
    defaultValue: 0,
    min: 0,
    description: 'protocol.arinc429.option.resolution.description',
  },
  {
    id: OPTION_DATA_LOW_BIT,
    label: 'protocol.arinc429.option.dataLowBit',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: DATA_HIGH_BIT,
    description: 'protocol.arinc429.option.dataLowBit.description',
  },
  {
    id: OPTION_DATA_HIGH_BIT,
    label: 'protocol.arinc429.option.dataHighBit',
    kind: 'number',
    defaultValue: 0,
    min: 0,
    max: DATA_HIGH_BIT,
    description: 'protocol.arinc429.option.dataHighBit.description',
  },
];

// ─── ALAN ÜRETİMİ ────────────────────────────────────────────────────────────

/** Alan id'si word İNDEKSİNİ taşır — çok word'lü girdide alanlar çakışmasın diye (dosya başı). */
function fieldId(wordIndex: number, suffix: string): string {
  return `arinc429-word-${String(wordIndex)}-${suffix}`;
}

/** `bitLength` bitlik değeri sabit genişlikli ikilik metne çevirir (Discrete/SSM gösterimi). */
function toBinaryText(value: number, bitLength: number): string {
  return value.toString(2).padStart(bitLength, '0');
}

/**
 * SSM alan ADI encoding'e göre DEĞİŞİR — sayısal durum adı BASILMAZ (dosya
 * başı, "iki bağımsız uygulama SSM'in SAYISAL tablosunda ÇELİŞİYOR"). Değişen
 * şey yalnız çaprazlanmış olan ROL'dür.
 */
function ssmFieldName(encoding: DataEncoding): string {
  if (encoding === ENCODING_BNR) return 'SSM (bit 31:30, BNR status — sign is bit 29)';
  if (encoding === ENCODING_BCD) return 'SSM (bit 31:30, BCD status/sign)';
  if (encoding === ENCODING_DISCRETE) return 'SSM (bit 31:30, discrete signless status)';
  return 'SSM (bit 31:30)';
}

interface BcdDecodeResult {
  readonly digits: string;
  readonly valid: boolean;
}

/**
 * Data alanını BCD basamaklarına ayırır: LSB'den başlayarak 4 bitlik gruplar,
 * artan bitler (aralık 4'ün katı değilse) EN ANLAMLI basamağı oluşturur.
 * Standart 11–29 aralığında bu KENDİLİĞİNDEN ARINC'in bilinen düzenini verir:
 * 19 = 4×4 + 3, yani dört tam basamak + 3 bitlik (azami 7) en anlamlı basamak.
 * Düzen KODA GÖMÜLMEDİ, aritmetikten çıkıyor.
 */
function decodeBcdDigits(value: number, bitLength: number): BcdDecodeResult {
  const digits: number[] = [];
  let remaining = value;
  let remainingBits = bitLength;
  while (remainingBits > 0) {
    const width = Math.min(BCD_DIGIT_BITS, remainingBits);
    digits.unshift(remaining & ((1 << width) - 1));
    remaining >>>= width;
    remainingBits -= width;
  }
  return {
    digits: digits.map((digit) => String(digit)).join(''),
    valid: digits.every((digit) => digit <= BCD_MAX_DIGIT),
  };
}

interface WordFieldsInput {
  readonly data: Uint8Array;
  readonly wordIndex: number;
  readonly wordOffset: number;
  readonly settings: Arinc429Settings;
  readonly byteOrder: WordByteOrder;
}

function buildDecodedWordFields(input: WordFieldsInput): ParsedField[] {
  const { data, wordIndex, wordOffset, settings, byteOrder } = input;
  const normalized = normalizeWord(data, wordOffset, byteOrder);
  const fields: ParsedField[] = [];

  const span = (lowBit: number, highBit: number): { offset: number; length: number } =>
    arincFieldByteSpan(wordOffset, lowBit, highBit, byteOrder);
  const slice = (region: { offset: number; length: number }): Uint8Array =>
    data.slice(region.offset, region.offset + region.length);

  // ── Label ──────────────────────────────────────────────────────────────────
  // `rawValue` HER ZAMAN telin/adapter'ın oktetidir; oktal gösterim yalnız
  // `labelBitOrder` seçilince `physicalValue`ya yazılır (dosya başı).
  const labelSpan = span(LABEL_LOW_BIT, LABEL_HIGH_BIT);
  const labelOctet = readArincField(normalized, LABEL_LOW_BIT, LABEL_HIGH_BIT);
  const labelWarnings: string[] = [FIELD_WARN_LABEL_MEANING];
  let labelPhysical: string | undefined;
  if (settings.labelBitOrder === null) {
    labelWarnings.unshift(FIELD_WARN_LABEL_BIT_ORDER);
  } else {
    const labelNumber =
      settings.labelBitOrder === LABEL_ORDER_STANDARD ? reverseOctet(labelOctet) : labelOctet;
    labelPhysical = `${labelNumber.toString(8).padStart(3, '0')}₈`;
  }
  fields.push({
    id: fieldId(wordIndex, 'label'),
    name: 'Label (bit 8:1)',
    offset: labelSpan.offset,
    length: labelSpan.length,
    rawBytes: slice(labelSpan),
    rawValue: labelOctet,
    ...(labelPhysical === undefined ? {} : { physicalValue: labelPhysical }),
    valid: true,
    warnings: labelWarnings,
  });

  // ── SDI ────────────────────────────────────────────────────────────────────
  const sdiSpan = span(SDI_LOW_BIT, SDI_HIGH_BIT);
  const sdi = readArincField(normalized, SDI_LOW_BIT, SDI_HIGH_BIT);
  fields.push({
    id: fieldId(wordIndex, 'sdi'),
    name: 'SDI (bit 10:9)',
    offset: sdiSpan.offset,
    length: sdiSpan.length,
    rawBytes: slice(sdiSpan),
    rawValue: sdi,
    physicalValue: toBinaryText(sdi, SDI_HIGH_BIT - SDI_LOW_BIT + 1),
    valid: true,
    // Semantik ad (örn. "IRS #1") yalnız configured equipment mapping VARSA
    // verilebilir (spec `:296`) — ICD veritabanı kapsam dışı.
    warnings: [FIELD_WARN_SDI_SEMANTIC],
  });

  // ── Data (ham, HER ZAMAN 11–29) ────────────────────────────────────────────
  const dataSpan = span(DATA_LOW_BIT, DATA_HIGH_BIT);
  const dataRaw = readArincField(normalized, DATA_LOW_BIT, DATA_HIGH_BIT);
  const dataWarnings: string[] = [];
  if (settings.dataEncoding === ENCODING_RAW) dataWarnings.push(FIELD_WARN_DATA_ENCODING_NOT_SELECTED);
  fields.push({
    id: fieldId(wordIndex, 'data'),
    name: 'Data (bit 29:11)',
    offset: dataSpan.offset,
    length: dataSpan.length,
    rawBytes: slice(dataSpan),
    // Ham paketli değer — `unit` BİLEREK yok (dosya başı "GÖMÜLMEYECEKLER").
    rawValue: dataRaw,
    valid: true,
    warnings: dataWarnings,
  });

  // ── Data'nın yorumu — YALNIZ `dataEncoding` seçilince ───────────────────────
  const lowBit = settings.dataLowBit;
  const highBit = settings.dataHighBit;
  const width = highBit - lowBit + 1;
  const selectedSpan = span(lowBit, highBit);
  const selectedRaw = readArincField(normalized, lowBit, highBit);

  if (settings.dataEncoding === ENCODING_BNR) {
    const signed = toSigned(selectedRaw, width);
    const bnrWarnings: string[] = [];
    let physical: number | string | undefined;
    if (settings.resolution > 0) {
      physical = signed * settings.resolution;
    } else {
      bnrWarnings.push(FIELD_WARN_RESOLUTION_REQUIRED);
      physical = signed;
    }
    fields.push({
      id: fieldId(wordIndex, 'bnr'),
      name: `BNR Value (bit ${String(highBit)}:${String(lowBit)}, two's complement)`,
      offset: selectedSpan.offset,
      length: selectedSpan.length,
      rawBytes: slice(selectedSpan),
      rawValue: selectedRaw,
      // `unit` YOK — birim ICD'den gelir, uydurulmaz (dosya başı).
      physicalValue: physical,
      valid: true,
      warnings: bnrWarnings,
    });
    // İşaret bitinin ADLANDIRILMASI çaprazlandı: kaynak (1)in "Sign Matrix for
    // BNR Data" tablosu ile kaynak (2)nin `BNR` sınıf sabitleri KELİMESİ
    // KELİMESİNE aynı. Sayısal SSM durum tablosunun aksine bu güvenli.
    const signSpan = span(highBit, highBit);
    fields.push({
      id: fieldId(wordIndex, 'bnr-sign'),
      name: `BNR Sign (bit ${String(highBit)})`,
      offset: signSpan.offset,
      length: signSpan.length,
      rawBytes: slice(signSpan),
      rawValue: signed < 0 ? 1 : 0,
      physicalValue:
        signed < 0 ? 'Minus, South, West, Left, From, Below' : 'Plus, North, East, Right, To, Above',
      valid: true,
      warnings: [],
    });
  } else if (settings.dataEncoding === ENCODING_BCD) {
    const bcd = decodeBcdDigits(selectedRaw, width);
    const bcdWarnings: string[] = [];
    if (!bcd.valid) bcdWarnings.push(FIELD_WARN_BCD_DIGIT_OUT_OF_RANGE);
    let physical: number | string = bcd.digits;
    if (bcd.valid && settings.resolution > 0) {
      physical = Number(bcd.digits) * settings.resolution;
    } else if (bcd.valid) {
      bcdWarnings.push(FIELD_WARN_RESOLUTION_REQUIRED);
    }
    fields.push({
      id: fieldId(wordIndex, 'bcd'),
      name: `BCD Digits (bit ${String(highBit)}:${String(lowBit)})`,
      offset: selectedSpan.offset,
      length: selectedSpan.length,
      rawBytes: slice(selectedSpan),
      rawValue: selectedRaw,
      physicalValue: physical,
      valid: bcd.valid,
      warnings: bcdWarnings,
    });
  } else if (settings.dataEncoding === ENCODING_DISCRETE) {
    fields.push({
      id: fieldId(wordIndex, 'discrete'),
      name: `Discrete Bits (bit ${String(highBit)}:${String(lowBit)})`,
      offset: selectedSpan.offset,
      length: selectedSpan.length,
      rawBytes: slice(selectedSpan),
      rawValue: selectedRaw,
      physicalValue: toBinaryText(selectedRaw, width),
      valid: true,
      // Bit-bazlı ICD eşlemesi (spec `:300`, örn. "Bit11 = Landing Gear Down")
      // GÖMÜLMEZ — `mavlink.ts`in payload kararının aynısı.
      warnings: [FIELD_WARN_DISCRETE_BIT_MEANING],
    });
  }

  // ── SSM ────────────────────────────────────────────────────────────────────
  const ssmSpan = span(SSM_LOW_BIT, SSM_HIGH_BIT);
  const ssm = readArincField(normalized, SSM_LOW_BIT, SSM_HIGH_BIT);
  fields.push({
    id: fieldId(wordIndex, 'ssm'),
    name: ssmFieldName(settings.dataEncoding),
    offset: ssmSpan.offset,
    length: ssmSpan.length,
    rawBytes: slice(ssmSpan),
    rawValue: ssm,
    // İki bit HER ZAMAN basılır; sayısal durum ADI hiçbir encoding'de basılmaz.
    physicalValue: toBinaryText(ssm, SSM_HIGH_BIT - SSM_LOW_BIT + 1),
    valid: true,
    warnings:
      settings.dataEncoding === ENCODING_RAW
        ? [FIELD_WARN_SSM_NEEDS_ENCODING]
        : [FIELD_WARN_SSM_STATUS_NOT_VERIFIED],
  });

  return fields;
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

interface Arinc429ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function parseArinc429Frame(data: Uint8Array, parseOptions: Arinc429ParseOptions): ParseResult {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (parseOptions.maxFrameLength !== undefined && data.length > parseOptions.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: parseOptions.maxFrameLength,
        length: data.length - parseOptions.maxFrameLength,
        details: { maxFrameLength: parseOptions.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length % WORD_BYTE_LENGTH !== 0) {
    // Girdi 32-bit word'lerin BLOĞUDUR; artık bayt eksik word demektir.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_NOT_WORD_ALIGNED,
        offset: data.length - (data.length % WORD_BYTE_LENGTH),
        length: data.length % WORD_BYTE_LENGTH,
        details: { wordByteLength: WORD_BYTE_LENGTH, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const settings = resolveSettings(parseOptions.options);
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];

  if (settings.byteOrder === null) {
    warnings.push({ code: 'wordByteOrderNotSelected', message: WARN_WORD_BYTE_ORDER_NOT_SELECTED });
  } else if (settings.labelBitOrder === null) {
    warnings.push({ code: 'labelBitOrderNotSelected', message: WARN_LABEL_BIT_ORDER_NOT_SELECTED });
  }
  if (settings.parityMode === PARITY_ODD) {
    // "typically odd" bir varsayılandır, garanti değil (dosya başı, `parityMode`).
    warnings.push({ code: 'parityModeAssumedOdd', message: WARN_PARITY_MODE_ASSUMED_ODD });
  }
  if (settings.dataBitRangeInvalid) {
    warnings.push({ code: 'dataBitRangeInvalid', message: WARN_DATA_BIT_RANGE_INVALID });
  }

  const wordCount = data.length / WORD_BYTE_LENGTH;
  for (let wordIndex = 0; wordIndex < wordCount; wordIndex += 1) {
    const wordOffset = wordIndex * WORD_BYTE_LENGTH;

    if (settings.byteOrder === null) {
      // Bayt sırası bilinmeden alan sınırları YERİNDEN OYNAR — ham 4 bayt basılır.
      fields.push({
        id: fieldId(wordIndex, 'raw'),
        name: 'Raw Word (32 bit)',
        offset: wordOffset,
        length: WORD_BYTE_LENGTH,
        rawBytes: data.slice(wordOffset, wordOffset + WORD_BYTE_LENGTH),
        valid: true,
        warnings: [FIELD_WARN_WORD_BYTE_ORDER],
      });
    } else {
      fields.push(
        ...buildDecodedWordFields({
          data,
          wordIndex,
          wordOffset,
          settings,
          byteOrder: settings.byteOrder,
        }),
      );
    }

    // ── Parite — bayt sırasından BAĞIMSIZ, o yüzden HER İKİ yolda da doğrulanır.
    const parityOk = parityPasses(data, wordOffset, settings.parityMode);
    const paritySpan =
      settings.byteOrder === null
        ? { offset: wordOffset, length: WORD_BYTE_LENGTH }
        : arincFieldByteSpan(wordOffset, PARITY_BIT, PARITY_BIT, settings.byteOrder);
    const parityBit =
      settings.byteOrder === null
        ? undefined
        : readArincField(normalizeWord(data, wordOffset, settings.byteOrder), PARITY_BIT, PARITY_BIT);
    fields.push({
      id: fieldId(wordIndex, 'parity'),
      name: 'Parity (bit 32)',
      offset: paritySpan.offset,
      length: paritySpan.length,
      rawBytes: data.slice(paritySpan.offset, paritySpan.offset + paritySpan.length),
      ...(parityBit === undefined ? {} : { rawValue: parityBit }),
      physicalValue: parityOk ? 'PASS' : 'FAIL',
      valid: parityOk,
      warnings: parityOk ? [] : [FIELD_WARN_PARITY_FAILED],
    });
    if (!parityOk) {
      errors.push({
        code: 'checksum-mismatch',
        message: ERROR_PARITY,
        offset: wordOffset,
        length: WORD_BYTE_LENGTH,
        details: { wordIndex, parityMode: settings.parityMode, oneBits: wordPopcount(data, wordOffset) },
      });
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseArinc429(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseArinc429Frame(data, options === undefined ? {} : { options });
}

export const arinc429Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * ZAYIF ve bu ÖLÇÜLDÜ (dosya başı + `arinc429CanParseRegistry.test.ts`).
   * `canParse` `decodeOptions`a ulaşamaz; elde kalan tek bayt-sırası-bağımsız
   * kanıt paritedir ve tek word'de rastgele 1/2 geçer.
   */
  canParse(): boolean {
    // YAPISAL `false` — gerekçe dosya başındaki "canParse ZAYIF" bölümünde
    // ÖLÇÜLMÜŞ sayılarla yazılı. `uavcanCompatibility.ts` (15b) ve
    // `ppm.ts`/`pwmServo.ts` (15e) ile AYNI sınıf.
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Arinc429ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseArinc429Frame(data, options);
  },
};

// ─── ÖRNEK ÇERÇEVE KURUCUSU ──────────────────────────────────────────────────

export interface Arinc429WordInit {
  /** Telin/adapter'ın Label okteti — ARINC bit 1 bu baytın EN DÜŞÜK biti. */
  readonly labelOctet: number;
  /** ARINC bit 10:9. */
  readonly sdi: number;
  /** ARINC bit 29:11. */
  readonly data: number;
  /** ARINC bit 31:30. */
  readonly ssm: number;
  /**
   * Parite biti HER ZAMAN hesaplanır; bu bayrak sonucu TERS çevirir (bozuk
   * örnek üretmek için). Sabit bir bit değeri KABUL EDİLMEZ: ilk yazımda
   * `parityBit: 0` verilmişti ve o word'ün hesaplanan paritesi de 0 olduğu
   * için "bozuk" örnek aslında GEÇERLİ çıkmıştı — birim test yakaladı.
   */
  readonly flipParity?: boolean;
  readonly parityMode?: ParityMode;
}

/**
 * Bir ARINC 429 word'ünü baytlara çevirir. Register düzeni: bit 1 = register
 * biti 0 (dosya başı tablosu). Örnek çerçeveler ve birim testler AYNI
 * kurucuyu kullanır (spec §42/§43 disiplini).
 */
export function buildArinc429Word(init: Arinc429WordInit, byteOrder: WordByteOrder): Uint8Array {
  const base =
    ((init.labelOctet & 0xff) |
      ((init.sdi & 0x3) << 8) |
      ((init.data & 0x7ffff) << 10) |
      ((init.ssm & 0x3) << 29)) >>>
    0;
  let onesInBase = 0;
  for (let bit = 0; bit < WORD_BIT_COUNT - 1; bit += 1) onesInBase += (base >>> bit) & 1;
  const mode = init.parityMode ?? PARITY_ODD;
  const computed = mode === PARITY_ODD ? (onesInBase % 2 === 0 ? 1 : 0) : onesInBase % 2;
  const parity = init.flipParity === true ? computed ^ 1 : computed;
  const word = (base | ((parity & 1) << 31)) >>> 0;

  const bytes = new Uint8Array(WORD_BYTE_LENGTH);
  for (let index = 0; index < WORD_BYTE_LENGTH; index += 1) {
    const shift = byteOrder === BYTE_ORDER_LITTLE_ENDIAN ? index : WORD_BYTE_LENGTH - 1 - index;
    bytes[index] = (word >>> (shift * BITS_PER_BYTE)) & 0xff;
  }
  return bytes;
}

function concatWords(words: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(words.length * WORD_BYTE_LENGTH);
  words.forEach((word, index) => {
    out.set(word, index * WORD_BYTE_LENGTH);
  });
  return out;
}

// Kaynak (1)in KENDİ sayısal vektörü: Label 213₈ (=0x8B) için oktete 0xD1 yazılır.
const LABEL_OCTET_213 = 0xd1;
// Kaynak (3)ün YAYIMLANMIŞ fixture'ları (`LabelFieldTest.py` `refValues`).
const LABEL_OCTET_041 = 0x84;
const LABEL_OCTET_107 = 0xe2;
const LABEL_OCTET_206 = 0x61;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'label-213-bnr-worked-example',
    name: 'protocol.arinc429.example.label213Bnr.name',
    // Kaynak (1)in Label vektörü + spec `:298`in BNR çalışılmış örneği
    // (Raw=12345, Resolution=0.1 → 1234.5). Bayt sırası little-endian.
    bytes: buildArinc429Word({ labelOctet: LABEL_OCTET_213, sdi: 1, data: 12345, ssm: 3 }, BYTE_ORDER_LITTLE_ENDIAN),
    description: 'protocol.arinc429.example.label213Bnr.description',
    expectedValid: true,
  },
  {
    id: 'label-041-negative-bnr',
    name: 'protocol.arinc429.example.label041NegativeBnr.name',
    // Kaynak (3)ün fixture'ı 041₈ ↔ 0x84 + NEGATİF BNR: 19 bit iki tümleyende
    // −12345 = 0x7CFC7 (bit 29 = 1 → "Minus, South, West, Left, From, Below").
    bytes: buildArinc429Word({ labelOctet: LABEL_OCTET_041, sdi: 2, data: 0x7cfc7, ssm: 3 }, BYTE_ORDER_LITTLE_ENDIAN),
    description: 'protocol.arinc429.example.label041NegativeBnr.description',
    expectedValid: true,
  },
  {
    id: 'label-107-bcd-five-digits',
    name: 'protocol.arinc429.example.label107Bcd.name',
    // Kaynak (3)ün fixture'ı 107₈ ↔ 0xE2. Data = 0x12345 → basamaklar 1 2 3 4 5
    // (19 bit = 4×4 + 3, en anlamlı basamak 3 bitte "1").
    bytes: buildArinc429Word({ labelOctet: LABEL_OCTET_107, sdi: 0, data: 0x12345, ssm: 0 }, BYTE_ORDER_LITTLE_ENDIAN),
    description: 'protocol.arinc429.example.label107Bcd.description',
    expectedValid: true,
  },
  {
    id: 'label-206-discrete-bits',
    name: 'protocol.arinc429.example.label206Discrete.name',
    // Kaynak (3)ün fixture'ı 206₈ ↔ 0x61. Discrete bit anlamları ICD'ye bağlı,
    // BASILMAZ — yalnız 19 bitin ikilik gösterimi.
    bytes: buildArinc429Word({ labelOctet: LABEL_OCTET_206, sdi: 3, data: 0x15, ssm: 0 }, BYTE_ORDER_LITTLE_ENDIAN),
    description: 'protocol.arinc429.example.label206Discrete.description',
    expectedValid: true,
  },
  {
    id: 'big-endian-adapter-word',
    name: 'protocol.arinc429.example.bigEndianAdapter.name',
    // İlk örneğin MANTIKSAL olarak AYNISI, big-endian yazılmış: kaynak (5)in
    // düzeni (parite `buffer[0] & 0x80`, Label okteti `buffer[3]`).
    bytes: buildArinc429Word({ labelOctet: LABEL_OCTET_213, sdi: 1, data: 12345, ssm: 3 }, BYTE_ORDER_BIG_ENDIAN),
    description: 'protocol.arinc429.example.bigEndianAdapter.description',
    expectedValid: true,
  },
  {
    id: 'two-word-capture',
    name: 'protocol.arinc429.example.twoWordCapture.name',
    // İki word tek bir yakalama bloğunda — alan id'lerinin word indeksi taşıdığını
    // gösterir (`arinc429-word-0-label` / `arinc429-word-1-label`).
    bytes: concatWords([
      buildArinc429Word({ labelOctet: LABEL_OCTET_213, sdi: 1, data: 12345, ssm: 3 }, BYTE_ORDER_LITTLE_ENDIAN),
      buildArinc429Word({ labelOctet: LABEL_OCTET_107, sdi: 0, data: 0x12345, ssm: 0 }, BYTE_ORDER_LITTLE_ENDIAN),
    ]),
    description: 'protocol.arinc429.example.twoWordCapture.description',
    expectedValid: true,
  },
  {
    id: 'parity-error',
    name: 'protocol.arinc429.example.parityError.name',
    // Parite biti KASTEN ters çevrildi — `checksum-mismatch` yolunu gösterir.
    bytes: buildArinc429Word(
      { labelOctet: LABEL_OCTET_213, sdi: 1, data: 12345, ssm: 3, flipParity: true },
      BYTE_ORDER_LITTLE_ENDIAN,
    ),
    description: 'protocol.arinc429.example.parityError.description',
    expectedValid: false,
  },
  {
    id: 'not-word-aligned',
    name: 'protocol.arinc429.example.notWordAligned.name',
    // 3 bayt — 4'ün katı değil, `truncated-frame`.
    bytes: new Uint8Array([0xd1, 0x64, 0x30]),
    description: 'protocol.arinc429.example.notWordAligned.description',
    expectedValid: false,
  },
];

export const arinc429Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: arinc429Parser,
  documentation: {
    summary: 'protocol.arinc429.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
