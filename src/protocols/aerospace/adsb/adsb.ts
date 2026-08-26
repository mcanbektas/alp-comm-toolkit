/**
 * ADS-B 1090ES — DF17/DF18 extended squitter'ının **ME alanının yorumu**.
 * Faz 10, dalga 15h; `surveillance` ailesinin İKİNCİ ve SON kaydı (aile bu
 * kayıtla, `aerospace-uav` DOMAIN'İ de bu kayıtla KAPANIR).
 *
 * ── NEDEN `modeS.ts`i TÜKETİYOR, KOPYALAMIYOR ─────────────────────────────
 * ADS-B ayrı bir tel biçimi DEĞİLDİR: Mode S'in DF17 (ve DF18) çerçevesinin 56
 * bitlik ME alanıdır. Katalog bunu zaten yazmış (`aerospace-uav.ts`: *"whose
 * DF17 extended squitter is what ADS-B 1090ES rides on"*, araç listesinde
 * *"DF17 → ADS-B Handoff"*), spec de (`06-havacilik-uav.md:361`): *"ADS-B
 * 1090ES → Mode S Extended Squitter'ı kullanır."*
 *
 * Bu, `xcpPacket.ts`/`dnsWire.ts` sınıfı GERÇEK bir paylaşımdır — `ccp.ts`in
 * "benzer görünen iki protokolü birleştirme" tuzağı DEĞİL: çekirdek (çerçeve
 * ayrıştırma) gerçekten ORTAK ve sınır spec tarafından çizilmiş. Bu yüzden:
 *
 *   • Çerçeve ayrıştırma `modeS.ts`in `parseModeSFrameLayout()`undan gelir.
 *     **Tek satır bile KOPYALANMADI** — 12d'nin `networkTimestamp` vakası
 *     iki kopyanın sessizce ayrıştığını ölçmüştü.
 *   • Bağımlılık TEK YÖNLÜDÜR: `modeS.ts` bu dosyayı BİLMEZ. Ters yön bir
 *     çember kurardı ve `mode-s` kaydını ADS-B'ye bağımlı hâle getirirdi;
 *     oysa Mode S ADS-B'siz de tam çözülüyor.
 *   • İki AYRI kayıt, iki AYRI `pluginId`, iki AYRI sayfa. 14d'nin SOME/IP +
 *     SD kararı ("tek kayıt, iki modül") burada bir adım ileri gidiyor:
 *     iki kayıt, iki modül, tek yönlü tüketim.
 *
 * ── GİRDİ: TAM 14 BAYTLIK DF17/DF18 MESAJI ────────────────────────────────
 * Bu parser 56 bitlik çıplak ME alanını DEĞİL, tam mesajı alır — çünkü DF ve
 * CRC olmadan bir ME'nin ADS-B olduğu SÖYLENEMEZ. DF ∈ {17, 18} değilse çerçeve
 * `unsupported-encoding` ile REDDEDİLİR ve bu titizlik boşuna değil: bir DF20
 * Comm-B yanıtının MB alanı (`A000083E202CC371C31DE0AA1CCF`) DF17'nin ME'siyle
 * BİREBİR AYNI GÖRÜNÜR ve ilk baytı 0x20'dir — Type Code sanılırsa "TC 4,
 * uçak kimliği" diye çözülür, oysa o bir BDS 2,0 yanıtıdır. Sessiz yanlış çözüm
 * tam olarak buradan girerdi.
 *
 * ── [DUR-SOR kararı] 1090ES-only, rozet `partial` ─────────────────────────
 * Katalog iki veri bağlantısı vadediyor (*"over 1090ES or 978 MHz UAT"*,
 * araç listesinde `1090ES / UAT Source`). **978 MHz UAT bu kayıtta KAPSAM
 * DIŞIDIR** ve bu bir tembellik değil: UAT tamamen ayrı bir tel biçimidir —
 * farklı çerçeveleme, farklı FEC, ayrı bir kaynak turu. Spec kapsam
 * daraltmasına AÇIKÇA izin veriyor (`:346`): *"Toolkit bu ikisini ayrı parser
 * olarak ele almalı; ilk kapsam olarak 1090ES/Mode S'e odaklanılabilir."*
 * Emsal: `cc-link-ie` 0x890F-only, `iec-61850` GOOSE-only,
 * `foundation-fieldbus` HSE-only. Kapsam katalog `summary`sinde, yani SAYFA
 * METNİNDE açıkça yazılıdır ve e2e bunu bekçiler.
 *
 * Kaynak turu bu kararın GEREKÇESİNİ de değiştirdi: dump1090'ın kendi notu
 * (*"other modes have the CRC xored with the sender address … a casual listener
 * can't split the address from the checksum"*) DF17/18 dışındaki her şeyin
 * pasif dinleyici için doğrulanamaz olduğunu söylüyor. DF17/18-only olmak bir
 * tercih değil, pasif yakalamanın matematiksel sınırıdır.
 *
 * ── TUZAK: CPR GLOBAL POZİSYONA ÇEVRİLMEZ ─────────────────────────────────
 * Compact Position Reporting **İKİ mesaj** ister: bir Even (F=0) ve bir Odd
 * (F=1) çerçevesi. Tek çerçeveden global enlem/boylam ÜRETİLEMEZ. Spec zaten
 * ara veriyi istiyor (`:376`): *"CPR kullanıldığında ara veri de gösterilebilir:
 * CPR Format (Even/Odd), Raw Latitude/Longitude, Reference/Pair."*
 *
 *   BASILAN    : CPR Format biti, ham 17-bit LAT-CPR, ham 17-bit LON-CPR, altitude
 *   BASILMAYAN : global lat/lon
 *
 * Gerekçe `mavlink.ts`in kararının birebir aynısı (*"SEQ-LOSS HESABI PARSER'A
 * GİRMEZ… ÇERÇEVELER ARASI durum"*): bir çerçeveden üretilemeyen bir sayıyı
 * üretmek bu depoda REDDEDİLMİŞ bir davranıştır. Aynı gerekçeyle **Aircraft
 * Table** ve **Message Age** de parser'a girmez; spec `:379`un *"Position/
 * Velocity/Callsign yaşları AYRI tutulmalı"* kuralı doğrudur ama ANALYZER
 * katmanının kuralıdır.
 *
 * **Ham CPR alanına `unit` VERİLMEZ** (`types.ts:46`): CPR değeri derece değil,
 * kodlanmış bir tam sayıdır. `physicalValue` de verilmez — bir sayıyı "fiziksel"
 * diye basmak onu derece sanmaya davettir.
 *
 * ── TYPE CODE KAPSAMI ─────────────────────────────────────────────────────
 * TC, ME'nin ilk 5 bitidir (mesaj biti 33:37). Kaynak: mode-s.org "ADS-B message
 * types" + spec `:367` (aynı yapı) + `pyModeS`in BDS modülleri (`bds08.py`
 * "TC=1-4", `bds05.py` "TC 9-18 barometric / TC 20-22 GNSS", `bds09.py`
 * "TC=19", `bds06.py` yüzey konumu).
 *
 *   ÇÖZÜLEN     : 1–4 (identification) · 9–18 + 20–22 (airborne position)
 *                 · 19 (airborne velocity)
 *   TANINIR AMA
 *   ÇÖZÜLMEZ    : 5–8 (surface position) · 23–27 (reserved) · 28 (aircraft
 *                 status) · 29 (target state and status) · 31 (aircraft
 *                 operation status) → ME HAM kalır + `typeCodeNotDecoded`
 *
 * Spec bir KISIT da koyuyor (`:367`): *"Exact type-code alan tahsisi
 * ICAO/DO-260 revizyon veritabanına bağlı tutulmalıdır."* Bu yüzden çözülmeyen
 * TC'lerde payload YAKIŞTIRILMAZ (`crsf`in 15d'deki çerçeve tipi kararının aynı
 * biçimi) ve çözülen TC'lerde bile revizyona bağlı olan alanlar (uçak
 * kategorisinin METNİ, NIC Supplement-B'nin anlamı) SAYI olarak basılıp
 * uyarılır.
 *
 * ── ALTITUDE: YALNIZ Q=1 DALI ÇÖZÜLÜR ─────────────────────────────────────
 * 12 bitlik AC alanı 13 bitlik altitude code'a M biti sıfır olarak yeniden
 * yerleştirilir. Q biti 1 ise kodlama 25 ft'lik LİNEER kodlamadır ve
 * `alt = N * 25 − 1000` ft ile çözülür — **bu dal yayımlanmış bir değerle
 * doğrulandı**: mode-s.org'un `8D40621D58C382D690C8AC2863A7` örneği için
 * yayımladığı 38 000 ft, bu motorun ürettiği sayıyla birebir (`adsb.test.ts`).
 *
 * Q = 0 ise kodlama 100 ft'lik **Gillham (Gray) kodudur** ve BU MOTOR ONU
 * ÇÖZMEZ: elde yayımlanmış bir test vektörü YOK, tek kaynak var ve yanlış bir
 * bit yeniden sıralaması hata VERMEZ, yalnız yanlış bir irtifa basar — deponun
 * en pahalı hata sınıfı. Ham 12 bit basılır + `altitudeGillhamNotDecoded`.
 * TC 20–22'nin GNSS yüksekliği de aynı gerekçeyle HAM kalır (tek kaynak,
 * DO-260 revizyonuna bağlı).
 *
 * ── `decodeOptions` AÇILMAZ ───────────────────────────────────────────────
 * ME'nin Type Code'u kendini anlatır; profil seçimi gerekmiyor. `mode-s`in
 * `attemptCrcCorrection`ı da yazılmadı (bkz. `modeS.ts`, [Karar 15h-1]),
 * dolayısıyla bu dosyada da bir kanal açılmadı.
 *
 * ── CRC FAIL'DE NE OLUR ───────────────────────────────────────────────────
 * ME yine çözülür (spec §47: *"hatalı veride uygulamayı çökertme"*, kısmi
 * çözüm gösterilir) ama çerçeve `valid: false` olur, `crc-mismatch` hatası
 * düşer ve KOŞULSUZ bir `messageDecodedOnFailedCrc` uyarısı basılır. Düzeltme
 * ADAYI ÜRETİLMEZ ve düzeltilmiş bayt bu yoruma HİÇ girmez — spec'in kendi
 * tasarım kısıtı (`:373`, `:541`): *"Corrected mesaj hiçbir zaman native-valid
 * frame ile aynı confidence seviyesinde gösterilmemelidir."*
 *
 * ── STATUS: 'partial' — GEREKÇE ───────────────────────────────────────────
 * Kapsam BİLİNÇLİ olarak daraltıldı (978 MHz UAT dışarıda, TC 5–8/23–29/31
 * çözülmüyor, CPR global pozisyona çevrilmiyor) ve daraltmanın her parçası
 * sayfada yazılı. `partial` rozetli kayıtların çoğu gibi bu da bir eksik iş
 * değil, sınırı SÖYLENMİŞ bir kapsam kararıdır.
 */

import {
  byteSpan,
  EXTENDED_SQUITTER_FORMATS,
  MODE_S_LONG_BYTE_LENGTH,
  parseModeSFrameLayout,
  readBitRange,
  rejectInvalidModeSLength,
  modeSBytesFromHex,
} from '../modeS/modeS';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'ads-b';
const PROTOCOL_DISPLAY_NAME = 'ADS-B';

// ─── ME ALANININ BİT HARİTASI (1 tabanlı, MESAJ biti) ────────────────────────
// ME bit 0 = mesaj biti 33. Bütün sabitler MESAJ bitidir; ME'ye göre kayma
// aritmetiği HİÇBİR YERDE tekrarlanmaz.

const TYPE_CODE_FIRST_BIT = 33;
const TYPE_CODE_LAST_BIT = 37;

/** TC 1–4 · identification */
const CATEGORY_FIRST_BIT = 38;
const CATEGORY_LAST_BIT = 40;
const CALLSIGN_FIRST_BIT = 41;
const CALLSIGN_LAST_BIT = 88;
const CALLSIGN_CHARACTER_COUNT = 8;
const CALLSIGN_CHARACTER_BITS = 6;

/** TC 9–18 / 20–22 · airborne position */
const SURVEILLANCE_STATUS_FIRST_BIT = 38;
const SURVEILLANCE_STATUS_LAST_BIT = 39;
const NIC_SUPPLEMENT_B_BIT = 40;
const ALTITUDE_FIRST_BIT = 41;
const ALTITUDE_LAST_BIT = 52;
const TIME_BIT = 53;
const CPR_FORMAT_BIT = 54;
const CPR_LATITUDE_FIRST_BIT = 55;
const CPR_LATITUDE_LAST_BIT = 71;
const CPR_LONGITUDE_FIRST_BIT = 72;
const CPR_LONGITUDE_LAST_BIT = 88;

/** TC 19 · airborne velocity */
const VELOCITY_SUBTYPE_FIRST_BIT = 38;
const VELOCITY_SUBTYPE_LAST_BIT = 40;
const INTENT_CHANGE_BIT = 41;
const IFR_CAPABILITY_BIT = 42;
const NAC_V_FIRST_BIT = 43;
const NAC_V_LAST_BIT = 45;
const VELOCITY_A_SIGN_BIT = 46;
const VELOCITY_A_FIRST_BIT = 47;
const VELOCITY_A_LAST_BIT = 56;
const VELOCITY_B_SIGN_BIT = 57;
const VELOCITY_B_FIRST_BIT = 58;
const VELOCITY_B_LAST_BIT = 67;
const VERTICAL_RATE_SOURCE_BIT = 68;
const VERTICAL_RATE_SIGN_BIT = 69;
const VERTICAL_RATE_FIRST_BIT = 70;
const VERTICAL_RATE_LAST_BIT = 78;
const VELOCITY_RESERVED_FIRST_BIT = 79;
const VELOCITY_RESERVED_LAST_BIT = 80;
const GNSS_BARO_SIGN_BIT = 81;
const GNSS_BARO_FIRST_BIT = 82;
const GNSS_BARO_LAST_BIT = 88;

/** Altitude kodlaması — 12 bitlik AC, M biti sıfır olarak 13 bite açılır. */
const ALTITUDE_Q_BIT_MASK = 0x10;
const ALTITUDE_STEP_FEET = 25;
const ALTITUDE_OFFSET_FEET = 1000;

/** Dikey hız: (mag − 1) × 64 ft/min; 0 "mevcut değil" demektir. */
const VERTICAL_RATE_STEP_FT_PER_MIN = 64;
/** GNSS − baro farkı: (mag − 1) × 25 ft; 0 ve 127 "mevcut değil". */
const GNSS_BARO_STEP_FEET = 25;
const GNSS_BARO_UNAVAILABLE_MAGNITUDE = 127;
/** Süpersonik alt tipler (2 ve 4) hızları 4 katına ölçekler. */
const SUPERSONIC_SCALE = 4;
const HEADING_RESOLUTION = 1024;
const DEGREES_IN_CIRCLE = 360;

const UNIT_KNOT = 'kt';
const UNIT_DEGREE = '°';
const UNIT_FOOT = 'ft';
const UNIT_FOOT_PER_MINUTE = 'ft/min';

const ERROR_EMPTY = 'protocol.adsb.error.empty';
const ERROR_INVALID_LENGTH = 'protocol.adsb.error.invalidLength';
const ERROR_ABORTED = 'protocol.adsb.error.aborted';
const ERROR_FRAME_TOO_LONG = 'protocol.adsb.error.frameTooLong';
const ERROR_NOT_EXTENDED_SQUITTER = 'protocol.adsb.error.notExtendedSquitter';
const ERROR_PARITY_MISMATCH = 'protocol.adsb.error.parityMismatch';

const WARN_TYPE_CODE_NOT_DECODED = 'protocol.adsb.warning.typeCodeNotDecoded';
const WARN_CPR_NOT_GLOBAL = 'protocol.adsb.warning.cprNotConvertedToGlobalPosition';
const WARN_UAT_OUT_OF_SCOPE = 'protocol.adsb.warning.uatOutOfScope';
const WARN_DECODED_ON_FAILED_CRC = 'protocol.adsb.warning.messageDecodedOnFailedCrc';

const FIELD_WARN_TYPE_CODE_NOT_DECODED = 'protocol.adsb.field.typeCodeNotDecoded';
const FIELD_WARN_CATEGORY_REQUIRES_REVISION = 'protocol.adsb.field.categoryRequiresRevision';
const FIELD_WARN_NIC_SUPPLEMENT_REQUIRES_VERSION = 'protocol.adsb.field.nicSupplementRequiresVersion';
const FIELD_WARN_ALTITUDE_GILLHAM = 'protocol.adsb.field.altitudeGillhamNotDecoded';
const FIELD_WARN_ALTITUDE_GNSS = 'protocol.adsb.field.altitudeGnssNotDecoded';
const FIELD_WARN_ALTITUDE_UNAVAILABLE = 'protocol.adsb.field.altitudeUnavailable';
const FIELD_WARN_CPR_RAW = 'protocol.adsb.field.cprRawNotDegrees';
const FIELD_WARN_CALLSIGN_INVALID_CHARACTER = 'protocol.adsb.field.callsignInvalidCharacter';
const FIELD_WARN_VALUE_UNAVAILABLE = 'protocol.adsb.field.valueUnavailable';
const FIELD_WARN_VELOCITY_SUBTYPE_UNKNOWN = 'protocol.adsb.field.velocitySubtypeUnknown';

// ─── TYPE CODE SÖZLÜĞÜ ───────────────────────────────────────────────────────

const TYPE_CODE_IDENTIFICATION_MIN = 1;
const TYPE_CODE_IDENTIFICATION_MAX = 4;
const TYPE_CODE_SURFACE_MIN = 5;
const TYPE_CODE_SURFACE_MAX = 8;
const TYPE_CODE_AIRBORNE_BARO_MIN = 9;
const TYPE_CODE_AIRBORNE_BARO_MAX = 18;
const TYPE_CODE_VELOCITY = 19;
const TYPE_CODE_AIRBORNE_GNSS_MIN = 20;
const TYPE_CODE_AIRBORNE_GNSS_MAX = 22;

/**
 * Type Code'un ADI — mode-s.org'un tablosu, spec `:367` ve `pyModeS`in BDS
 * modül başlıkları örtüşüyor. TC 0 ve 30 hiçbir kaynakta adlandırılmıyor:
 * ADLANDIRILMAZ, ham kalır (dalga 13 dersi 5).
 */
function typeCodeName(typeCode: number): string | undefined {
  if (typeCode >= TYPE_CODE_IDENTIFICATION_MIN && typeCode <= TYPE_CODE_IDENTIFICATION_MAX) {
    return 'Aircraft identification and category';
  }
  if (typeCode >= TYPE_CODE_SURFACE_MIN && typeCode <= TYPE_CODE_SURFACE_MAX) {
    return 'Surface position';
  }
  if (typeCode >= TYPE_CODE_AIRBORNE_BARO_MIN && typeCode <= TYPE_CODE_AIRBORNE_BARO_MAX) {
    return 'Airborne position (barometric altitude)';
  }
  if (typeCode === TYPE_CODE_VELOCITY) return 'Airborne velocity';
  if (typeCode >= TYPE_CODE_AIRBORNE_GNSS_MIN && typeCode <= TYPE_CODE_AIRBORNE_GNSS_MAX) {
    return 'Airborne position (GNSS height)';
  }
  if (typeCode >= 23 && typeCode <= 27) return 'Reserved';
  if (typeCode === 28) return 'Aircraft status';
  if (typeCode === 29) return 'Target state and status';
  if (typeCode === 31) return 'Aircraft operation status';
  return undefined;
}

type TypeCodeBranch = 'identification' | 'airborne-position' | 'velocity' | 'not-decoded';

function typeCodeBranch(typeCode: number): TypeCodeBranch {
  if (typeCode >= TYPE_CODE_IDENTIFICATION_MIN && typeCode <= TYPE_CODE_IDENTIFICATION_MAX) {
    return 'identification';
  }
  if (
    (typeCode >= TYPE_CODE_AIRBORNE_BARO_MIN && typeCode <= TYPE_CODE_AIRBORNE_BARO_MAX) ||
    (typeCode >= TYPE_CODE_AIRBORNE_GNSS_MIN && typeCode <= TYPE_CODE_AIRBORNE_GNSS_MAX)
  ) {
    return 'airborne-position';
  }
  if (typeCode === TYPE_CODE_VELOCITY) return 'velocity';
  return 'not-decoded';
}

// ─── CALLSIGN — 6 BİTLİK ICAO ALFABESİ ───────────────────────────────────────

/**
 * Tablo ASCII kurallarından TÜRETİLİR, elle yazılmaz — elle yazılmış bir dizge
 * doğrulayıcının geçerlilik anlayışından sessizce kayabilir (`pyModeS`
 * `_callsign.py` aynı gerekçeyi yazıyor):
 *   1..26 → 'A'..'Z' · 32 → boşluk · 48..57 → '0'..'9' · gerisi geçersiz.
 */
const CALLSIGN_INVALID_CHARACTER = '#';
const CALLSIGN_ALPHABET: readonly string[] = Array.from({ length: 64 }, (_unused, index) => {
  if (index >= 1 && index <= 26) return String.fromCharCode(index | 0x40);
  if (index === 32 || (index >= 48 && index <= 57)) return String.fromCharCode(index);
  return CALLSIGN_INVALID_CHARACTER;
});

interface CallsignResult {
  readonly text: string;
  readonly hasInvalidCharacter: boolean;
}

function decodeCallsign(data: Uint8Array): CallsignResult {
  let text = '';
  let hasInvalidCharacter = false;
  for (let index = 0; index < CALLSIGN_CHARACTER_COUNT; index += 1) {
    const firstBit = CALLSIGN_FIRST_BIT + index * CALLSIGN_CHARACTER_BITS;
    const code = readBitRange(data, firstBit, firstBit + CALLSIGN_CHARACTER_BITS - 1);
    const character = CALLSIGN_ALPHABET[code] ?? CALLSIGN_INVALID_CHARACTER;
    if (character === CALLSIGN_INVALID_CHARACTER) hasInvalidCharacter = true;
    text += character;
  }
  // Gerçek callsign'lar sola dayalı ve boşlukla doldurulmuştur; iç boşluk
  // (nadir ama mümkün) KORUNUR, yalnız uçlar kırpılır.
  return { text: text.trim(), hasInvalidCharacter };
}

// ─── ALAN KURUCU ─────────────────────────────────────────────────────────────

interface FieldInput {
  readonly data: Uint8Array;
  readonly id: string;
  readonly name: string;
  readonly firstBit: number;
  readonly lastBit: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: number | string;
  readonly unit?: string;
  readonly valid?: boolean;
  readonly warnings?: string[];
}

function buildField(input: FieldInput): ParsedField {
  const span = byteSpan(input.firstBit, input.lastBit);
  return {
    id: input.id,
    name: input.name,
    offset: span.offset,
    length: span.length,
    rawBytes: input.data.slice(span.offset, span.offset + span.length),
    ...(input.rawValue === undefined ? {} : { rawValue: input.rawValue }),
    ...(input.physicalValue === undefined ? {} : { physicalValue: input.physicalValue }),
    // `unit` YALNIZ gerçek fiziksel değere (`types.ts:46`): TC, kategori, CPR
    // ham değeri ve bayraklar BİRİMSİZ.
    ...(input.unit === undefined ? {} : { unit: input.unit }),
    valid: input.valid ?? true,
    warnings: input.warnings ?? [],
  };
}

/** İki ondalığa yuvarlar — kayan nokta gürültüsü alan tablosuna girmesin. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── TC 1–4: IDENTIFICATION ──────────────────────────────────────────────────

function buildIdentificationFields(data: Uint8Array): ParsedField[] {
  const callsign = decodeCallsign(data);
  return [
    buildField({
      data,
      id: 'adsb-aircraft-category',
      name: 'ME · Aircraft Category (bit 38:40)',
      firstBit: CATEGORY_FIRST_BIT,
      lastBit: CATEGORY_LAST_BIT,
      rawValue: readBitRange(data, CATEGORY_FIRST_BIT, CATEGORY_LAST_BIT),
      // Kategorinin METNİ (Light/Heavy/UAV…) TC ile birlikte okunur ve ICAO
      // Doc 9871 / DO-260B revizyonuna bağlıdır (spec `:367`). SAYI basılır.
      warnings: [FIELD_WARN_CATEGORY_REQUIRES_REVISION],
    }),
    buildField({
      data,
      id: 'adsb-callsign',
      name: 'ME · Callsign (bit 41:88, 8 × 6 bit)',
      firstBit: CALLSIGN_FIRST_BIT,
      lastBit: CALLSIGN_LAST_BIT,
      physicalValue: callsign.text,
      valid: !callsign.hasInvalidCharacter,
      warnings: callsign.hasInvalidCharacter ? [FIELD_WARN_CALLSIGN_INVALID_CHARACTER] : [],
    }),
  ];
}

// ─── TC 9–18 / 20–22: AIRBORNE POSITION ──────────────────────────────────────

interface AltitudeResult {
  readonly physicalValue: number | undefined;
  readonly unit: string | undefined;
  readonly warnings: string[];
}

/**
 * 12 bitlik AC alanı → irtifa. YALNIZ Q=1 (25 ft, lineer) dalı çözülür;
 * gerekçe dosya başında. M biti ADS-B'nin 12 bitlik alanında YOKTUR, 13 bitlik
 * koda sıfır olarak yeniden yerleştirilir.
 */
function decodeAltitude(altitudeCode: number, typeCode: number): AltitudeResult {
  if (altitudeCode === 0) {
    return { physicalValue: undefined, unit: undefined, warnings: [FIELD_WARN_ALTITUDE_UNAVAILABLE] };
  }
  if (typeCode >= TYPE_CODE_AIRBORNE_GNSS_MIN && typeCode <= TYPE_CODE_AIRBORNE_GNSS_MAX) {
    return { physicalValue: undefined, unit: undefined, warnings: [FIELD_WARN_ALTITUDE_GNSS] };
  }
  const thirteenBitCode = ((altitudeCode >>> 6) << 7) | (altitudeCode & 0x3f);
  if ((thirteenBitCode & ALTITUDE_Q_BIT_MASK) === 0) {
    return { physicalValue: undefined, unit: undefined, warnings: [FIELD_WARN_ALTITUDE_GILLHAM] };
  }
  // Q ve M bitleri düşürülür; kalan 11 bit lineer sayacı verir.
  const linear =
    ((thirteenBitCode >>> 2) & 0x7e0) | ((thirteenBitCode >>> 1) & 0x10) | (thirteenBitCode & 0x0f);
  return {
    physicalValue: linear * ALTITUDE_STEP_FEET - ALTITUDE_OFFSET_FEET,
    unit: UNIT_FOOT,
    warnings: [],
  };
}

function buildAirbornePositionFields(data: Uint8Array, typeCode: number): ParsedField[] {
  const altitudeCode = readBitRange(data, ALTITUDE_FIRST_BIT, ALTITUDE_LAST_BIT);
  const altitude = decodeAltitude(altitudeCode, typeCode);
  const cprFormat = readBitRange(data, CPR_FORMAT_BIT, CPR_FORMAT_BIT);

  return [
    buildField({
      data,
      id: 'adsb-surveillance-status',
      name: 'ME · Surveillance Status (bit 38:39)',
      firstBit: SURVEILLANCE_STATUS_FIRST_BIT,
      lastBit: SURVEILLANCE_STATUS_LAST_BIT,
      rawValue: readBitRange(data, SURVEILLANCE_STATUS_FIRST_BIT, SURVEILLANCE_STATUS_LAST_BIT),
    }),
    buildField({
      data,
      id: 'adsb-nic-supplement-b',
      name: 'ME · NIC Supplement-B / Single Antenna Flag (bit 40)',
      firstBit: NIC_SUPPLEMENT_B_BIT,
      lastBit: NIC_SUPPLEMENT_B_BIT,
      rawValue: readBitRange(data, NIC_SUPPLEMENT_B_BIT, NIC_SUPPLEMENT_B_BIT),
      // Bitin ANLAMI ADS-B sürümüne göre değişir (v0 SAF, v1/v2 NIC_B) ve sürüm
      // BU ÇERÇEVEDE YOKTUR — TC 31'in operation status'undadır.
      warnings: [FIELD_WARN_NIC_SUPPLEMENT_REQUIRES_VERSION],
    }),
    buildField({
      data,
      id: 'adsb-altitude',
      name: 'ME · Altitude Code (bit 41:52)',
      firstBit: ALTITUDE_FIRST_BIT,
      lastBit: ALTITUDE_LAST_BIT,
      rawValue: altitudeCode,
      ...(altitude.physicalValue === undefined ? {} : { physicalValue: altitude.physicalValue }),
      ...(altitude.unit === undefined ? {} : { unit: altitude.unit }),
      warnings: altitude.warnings,
    }),
    buildField({
      data,
      id: 'adsb-time-synchronization',
      name: 'ME · Time Synchronization (bit 53)',
      firstBit: TIME_BIT,
      lastBit: TIME_BIT,
      rawValue: readBitRange(data, TIME_BIT, TIME_BIT),
    }),
    buildField({
      data,
      id: 'adsb-cpr-format',
      name: 'ME · CPR Format (bit 54)',
      firstBit: CPR_FORMAT_BIT,
      lastBit: CPR_FORMAT_BIT,
      rawValue: cprFormat,
      physicalValue: cprFormat === 0 ? 'Even (F=0)' : 'Odd (F=1)',
    }),
    // CPR ham değerleri: `physicalValue` YOK, `unit` YOK. Bir sayı basmak onu
    // derece sanmaya davettir; global pozisyon ÇİFT çerçeve ister (dosya başı).
    buildField({
      data,
      id: 'adsb-cpr-latitude',
      name: 'ME · CPR Latitude, raw 17 bit (bit 55:71)',
      firstBit: CPR_LATITUDE_FIRST_BIT,
      lastBit: CPR_LATITUDE_LAST_BIT,
      rawValue: readBitRange(data, CPR_LATITUDE_FIRST_BIT, CPR_LATITUDE_LAST_BIT),
      warnings: [FIELD_WARN_CPR_RAW],
    }),
    buildField({
      data,
      id: 'adsb-cpr-longitude',
      name: 'ME · CPR Longitude, raw 17 bit (bit 72:88)',
      firstBit: CPR_LONGITUDE_FIRST_BIT,
      lastBit: CPR_LONGITUDE_LAST_BIT,
      rawValue: readBitRange(data, CPR_LONGITUDE_FIRST_BIT, CPR_LONGITUDE_LAST_BIT),
      warnings: [FIELD_WARN_CPR_RAW],
    }),
  ];
}

// ─── TC 19: AIRBORNE VELOCITY ────────────────────────────────────────────────

const VELOCITY_SUBTYPE_NAMES: Readonly<Record<number, string>> = {
  1: 'Ground speed, subsonic',
  2: 'Ground speed, supersonic',
  3: 'Airspeed, subsonic',
  4: 'Airspeed, supersonic',
};

const GROUND_SPEED_SUBTYPES: readonly number[] = [1, 2];
const AIR_SPEED_SUBTYPES: readonly number[] = [3, 4];

function buildVelocityFields(data: Uint8Array): ParsedField[] {
  const subtype = readBitRange(data, VELOCITY_SUBTYPE_FIRST_BIT, VELOCITY_SUBTYPE_LAST_BIT);
  const scale = subtype === 2 || subtype === 4 ? SUPERSONIC_SCALE : 1;
  const subtypeName = VELOCITY_SUBTYPE_NAMES[subtype];

  const fields: ParsedField[] = [
    buildField({
      data,
      id: 'adsb-velocity-subtype',
      name: 'ME · Velocity Subtype (bit 38:40)',
      firstBit: VELOCITY_SUBTYPE_FIRST_BIT,
      lastBit: VELOCITY_SUBTYPE_LAST_BIT,
      rawValue: subtype,
      ...(subtypeName === undefined ? {} : { physicalValue: subtypeName }),
      valid: subtypeName !== undefined,
      warnings: subtypeName === undefined ? [FIELD_WARN_VELOCITY_SUBTYPE_UNKNOWN] : [],
    }),
    buildField({
      data,
      id: 'adsb-intent-change',
      name: 'ME · Intent Change Flag (bit 41)',
      firstBit: INTENT_CHANGE_BIT,
      lastBit: INTENT_CHANGE_BIT,
      rawValue: readBitRange(data, INTENT_CHANGE_BIT, INTENT_CHANGE_BIT),
    }),
    buildField({
      data,
      id: 'adsb-ifr-capability',
      name: 'ME · IFR Capability Flag (bit 42)',
      firstBit: IFR_CAPABILITY_BIT,
      lastBit: IFR_CAPABILITY_BIT,
      rawValue: readBitRange(data, IFR_CAPABILITY_BIT, IFR_CAPABILITY_BIT),
    }),
    buildField({
      data,
      id: 'adsb-nac-v',
      name: 'ME · Navigation Accuracy Category, velocity (bit 43:45)',
      firstBit: NAC_V_FIRST_BIT,
      lastBit: NAC_V_LAST_BIT,
      rawValue: readBitRange(data, NAC_V_FIRST_BIT, NAC_V_LAST_BIT),
    }),
  ];

  const signA = readBitRange(data, VELOCITY_A_SIGN_BIT, VELOCITY_A_SIGN_BIT);
  const rawA = readBitRange(data, VELOCITY_A_FIRST_BIT, VELOCITY_A_LAST_BIT);
  const signB = readBitRange(data, VELOCITY_B_SIGN_BIT, VELOCITY_B_SIGN_BIT);
  const rawB = readBitRange(data, VELOCITY_B_FIRST_BIT, VELOCITY_B_LAST_BIT);

  if (GROUND_SPEED_SUBTYPES.includes(subtype)) {
    // Bileşenlerde 0 "mevcut değil" demektir; kodlanan değer (mag − 1)'dir.
    const available = rawA !== 0 && rawB !== 0;
    const westEast = (rawA - 1) * scale * (signA === 1 ? -1 : 1);
    const southNorth = (rawB - 1) * scale * (signB === 1 ? -1 : 1);

    fields.push(
      buildField({
        data,
        id: 'adsb-ew-direction',
        name: 'ME · East/West Direction (bit 46)',
        firstBit: VELOCITY_A_SIGN_BIT,
        lastBit: VELOCITY_A_SIGN_BIT,
        rawValue: signA,
        physicalValue: signA === 1 ? 'West' : 'East',
      }),
      buildField({
        data,
        id: 'adsb-ew-velocity',
        name: 'ME · East/West Velocity (bit 47:56)',
        firstBit: VELOCITY_A_FIRST_BIT,
        lastBit: VELOCITY_A_LAST_BIT,
        rawValue: rawA,
        ...(rawA === 0 ? {} : { physicalValue: Math.abs(westEast), unit: UNIT_KNOT }),
        warnings: rawA === 0 ? [FIELD_WARN_VALUE_UNAVAILABLE] : [],
      }),
      buildField({
        data,
        id: 'adsb-ns-direction',
        name: 'ME · North/South Direction (bit 57)',
        firstBit: VELOCITY_B_SIGN_BIT,
        lastBit: VELOCITY_B_SIGN_BIT,
        rawValue: signB,
        physicalValue: signB === 1 ? 'South' : 'North',
      }),
      buildField({
        data,
        id: 'adsb-ns-velocity',
        name: 'ME · North/South Velocity (bit 58:67)',
        firstBit: VELOCITY_B_FIRST_BIT,
        lastBit: VELOCITY_B_LAST_BIT,
        rawValue: rawB,
        ...(rawB === 0 ? {} : { physicalValue: Math.abs(southNorth), unit: UNIT_KNOT }),
        warnings: rawB === 0 ? [FIELD_WARN_VALUE_UNAVAILABLE] : [],
      }),
    );

    if (available) {
      // TÜRETİLMİŞ iki alan: ikisi de AYNI çerçevenin iki bileşeninden çıkıyor,
      // ÇERÇEVELER ARASI hiçbir şey kullanılmıyor — `mavlink.ts` sınırı korunur.
      const groundSpeed = Math.sqrt(westEast * westEast + southNorth * southNorth);
      let track = (Math.atan2(westEast, southNorth) * DEGREES_IN_CIRCLE) / (2 * Math.PI);
      if (track < 0) track += DEGREES_IN_CIRCLE;
      fields.push(
        buildField({
          data,
          id: 'adsb-ground-speed',
          name: 'ME · Ground Speed (bit 46:67, türetilmiş)',
          firstBit: VELOCITY_A_SIGN_BIT,
          lastBit: VELOCITY_B_LAST_BIT,
          physicalValue: round2(groundSpeed),
          unit: UNIT_KNOT,
        }),
        buildField({
          data,
          id: 'adsb-track-angle',
          name: 'ME · Track Angle (bit 46:67, türetilmiş)',
          firstBit: VELOCITY_A_SIGN_BIT,
          lastBit: VELOCITY_B_LAST_BIT,
          physicalValue: round2(track),
          unit: UNIT_DEGREE,
        }),
      );
    }
  } else if (AIR_SPEED_SUBTYPES.includes(subtype)) {
    fields.push(
      buildField({
        data,
        id: 'adsb-heading-status',
        name: 'ME · Heading Status (bit 46)',
        firstBit: VELOCITY_A_SIGN_BIT,
        lastBit: VELOCITY_A_SIGN_BIT,
        rawValue: signA,
      }),
      buildField({
        data,
        id: 'adsb-heading',
        name: 'ME · Heading (bit 47:56)',
        firstBit: VELOCITY_A_FIRST_BIT,
        lastBit: VELOCITY_A_LAST_BIT,
        rawValue: rawA,
        ...(signA === 0
          ? {}
          : {
              physicalValue: round2((rawA / HEADING_RESOLUTION) * DEGREES_IN_CIRCLE),
              unit: UNIT_DEGREE,
            }),
        warnings: signA === 0 ? [FIELD_WARN_VALUE_UNAVAILABLE] : [],
      }),
      buildField({
        data,
        id: 'adsb-airspeed-type',
        name: 'ME · Airspeed Type (bit 57)',
        firstBit: VELOCITY_B_SIGN_BIT,
        lastBit: VELOCITY_B_SIGN_BIT,
        rawValue: signB,
        physicalValue: signB === 1 ? 'TAS' : 'IAS',
      }),
      buildField({
        data,
        id: 'adsb-airspeed',
        name: 'ME · Airspeed (bit 58:67)',
        firstBit: VELOCITY_B_FIRST_BIT,
        lastBit: VELOCITY_B_LAST_BIT,
        rawValue: rawB,
        ...(rawB === 0 ? {} : { physicalValue: (rawB - 1) * scale, unit: UNIT_KNOT }),
        warnings: rawB === 0 ? [FIELD_WARN_VALUE_UNAVAILABLE] : [],
      }),
    );
  }

  // Ortak kuyruk — dört alt tipte de AYNI.
  const verticalRateSource = readBitRange(data, VERTICAL_RATE_SOURCE_BIT, VERTICAL_RATE_SOURCE_BIT);
  const verticalRateSign = readBitRange(data, VERTICAL_RATE_SIGN_BIT, VERTICAL_RATE_SIGN_BIT);
  const verticalRateRaw = readBitRange(data, VERTICAL_RATE_FIRST_BIT, VERTICAL_RATE_LAST_BIT);
  const gnssBaroSign = readBitRange(data, GNSS_BARO_SIGN_BIT, GNSS_BARO_SIGN_BIT);
  const gnssBaroRaw = readBitRange(data, GNSS_BARO_FIRST_BIT, GNSS_BARO_LAST_BIT);
  const gnssBaroAvailable = gnssBaroRaw !== 0 && gnssBaroRaw !== GNSS_BARO_UNAVAILABLE_MAGNITUDE;

  fields.push(
    buildField({
      data,
      id: 'adsb-vertical-rate-source',
      name: 'ME · Vertical Rate Source (bit 68)',
      firstBit: VERTICAL_RATE_SOURCE_BIT,
      lastBit: VERTICAL_RATE_SOURCE_BIT,
      rawValue: verticalRateSource,
      physicalValue: verticalRateSource === 1 ? 'Barometric' : 'GNSS',
    }),
    buildField({
      data,
      id: 'adsb-vertical-rate',
      name: 'ME · Vertical Rate (bit 69:78)',
      firstBit: VERTICAL_RATE_SIGN_BIT,
      lastBit: VERTICAL_RATE_LAST_BIT,
      rawValue: verticalRateRaw,
      ...(verticalRateRaw === 0
        ? {}
        : {
            physicalValue:
              (verticalRateSign === 1 ? -1 : 1) *
              (verticalRateRaw - 1) *
              VERTICAL_RATE_STEP_FT_PER_MIN,
            unit: UNIT_FOOT_PER_MINUTE,
          }),
      warnings: verticalRateRaw === 0 ? [FIELD_WARN_VALUE_UNAVAILABLE] : [],
    }),
    buildField({
      data,
      id: 'adsb-velocity-reserved',
      name: 'ME · Reserved (bit 79:80)',
      firstBit: VELOCITY_RESERVED_FIRST_BIT,
      lastBit: VELOCITY_RESERVED_LAST_BIT,
      rawValue: readBitRange(data, VELOCITY_RESERVED_FIRST_BIT, VELOCITY_RESERVED_LAST_BIT),
    }),
    buildField({
      data,
      id: 'adsb-gnss-baro-difference',
      name: 'ME · GNSS − Barometric Altitude Difference (bit 81:88)',
      firstBit: GNSS_BARO_SIGN_BIT,
      lastBit: GNSS_BARO_LAST_BIT,
      rawValue: gnssBaroRaw,
      ...(gnssBaroAvailable
        ? {
            physicalValue:
              (gnssBaroSign === 1 ? -1 : 1) * (gnssBaroRaw - 1) * GNSS_BARO_STEP_FEET,
            unit: UNIT_FOOT,
          }
        : {}),
      warnings: gnssBaroAvailable ? [] : [FIELD_WARN_VALUE_UNAVAILABLE],
    }),
  );

  return fields;
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

interface AdsbParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseAdsbFrame(data: Uint8Array, parseOptions: AdsbParseOptions): ParseResult {
  const rejection = rejectInvalidModeSLength(data, parseOptions, {
    empty: ERROR_EMPTY,
    invalidLength: ERROR_INVALID_LENGTH,
    aborted: ERROR_ABORTED,
    frameTooLong: ERROR_FRAME_TOO_LONG,
  });
  if (rejection !== undefined) return rejection;

  // ÇERÇEVE `modeS.ts`ten gelir — bir satır bile kopyalanmadı (dosya başı).
  const layout = parseModeSFrameLayout(data);

  if (
    data.length !== MODE_S_LONG_BYTE_LENGTH ||
    !EXTENDED_SQUITTER_FORMATS.includes(layout.downlinkFormat)
  ) {
    // DF20'nin MB alanı DF17'nin ME'siyle AYNI görünür; kabul etmek sessiz
    // yanlış çözümün kapısıdır (dosya başı).
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_NOT_EXTENDED_SQUITTER,
        offset: 0,
        length: 1,
        details: { downlinkFormat: layout.downlinkFormat, supported: [...EXTENDED_SQUITTER_FORMATS] },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [...layout.fields];
  const warnings: ProtocolWarning[] = [...layout.warnings];

  const typeCode = readBitRange(data, TYPE_CODE_FIRST_BIT, TYPE_CODE_LAST_BIT);
  const name = typeCodeName(typeCode);
  const branch = typeCodeBranch(typeCode);

  fields.push(
    buildField({
      data,
      id: 'adsb-type-code',
      name: 'ME · Type Code (bit 33:37)',
      firstBit: TYPE_CODE_FIRST_BIT,
      lastBit: TYPE_CODE_LAST_BIT,
      rawValue: typeCode,
      ...(name === undefined ? {} : { physicalValue: name }),
      warnings: branch === 'not-decoded' ? [FIELD_WARN_TYPE_CODE_NOT_DECODED] : [],
    }),
  );

  if (branch === 'identification') {
    fields.push(...buildIdentificationFields(data));
  } else if (branch === 'airborne-position') {
    fields.push(...buildAirbornePositionFields(data, typeCode));
    // Bir çerçeveden üretilemeyen bir sayı üretilmez — KOŞULSUZ uyarı.
    warnings.push({
      code: 'cprNotConvertedToGlobalPosition',
      message: WARN_CPR_NOT_GLOBAL,
      offset: byteSpan(CPR_LATITUDE_FIRST_BIT, CPR_LONGITUDE_LAST_BIT).offset,
      length: byteSpan(CPR_LATITUDE_FIRST_BIT, CPR_LONGITUDE_LAST_BIT).length,
    });
  } else if (branch === 'velocity') {
    fields.push(...buildVelocityFields(data));
  } else {
    warnings.push({
      code: 'typeCodeNotDecoded',
      message: WARN_TYPE_CODE_NOT_DECODED,
      offset: byteSpan(TYPE_CODE_FIRST_BIT, TYPE_CODE_LAST_BIT).offset,
      length: 1,
    });
  }

  // Kapsam KOŞULSUZ söylenir: 1090ES-only, UAT ayrı bir tel (dosya başı).
  warnings.push({ code: 'uatOutOfScope', message: WARN_UAT_OUT_OF_SCOPE });

  const errors = layout.errors.map((error) =>
    error.code === 'crc-mismatch' ? { ...error, message: ERROR_PARITY_MISMATCH } : error,
  );
  if (layout.crcValid === false) {
    // ME çözülür ama çerçeve BOZUKTUR ve bu koşulsuz söylenir; düzeltme adayı
    // ÜRETİLMEZ (spec `:373` tasarım kısıtı).
    warnings.push({ code: 'messageDecodedOnFailedCrc', message: WARN_DECODED_ON_FAILED_CRC });
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

export function parseAdsb(data: Uint8Array): ParseResult {
  return parseAdsbFrame(data, {});
}

/**
 * `mode-s`in kabul ettiği ÇERÇEVELERİN DAR bir alt kümesi: 14 bayt · DF ∈
 * {17,18} · CRC PASS. `mode-s` ile ÇAKIŞMASI beklenen davranıştır — aynı
 * çerçeveyi iki sayfa da açar, biri çerçeveyi biri ME'yi gösterir
 * (`surveillanceCanParseRegistry.test.ts` bunu beklenen olarak yazar).
 */
export function canParseAdsb(data: Uint8Array): boolean {
  if (data.length !== MODE_S_LONG_BYTE_LENGTH) return false;
  const layout = parseModeSFrameLayout(data);
  if (!EXTENDED_SQUITTER_FORMATS.includes(layout.downlinkFormat)) return false;
  return layout.crcValid === true;
}

export const adsbParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,
  canParse: canParseAdsb,
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: AdsbParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseAdsbFrame(data, options);
  },
};

// ─── ÖRNEK ÇERÇEVELER ────────────────────────────────────────────────────────

/** mode-s.org'un yayımlı örnekleri — hepsi gerçek yakalama, hepsinin CRC'si PASS. */
export const EXAMPLE_IDENTIFICATION = '8D4840D6202CC371C32CE0576098';
export const EXAMPLE_IDENTIFICATION_EZY = '8D406B902015A678D4D220AA4BDA';
export const EXAMPLE_POSITION_EVEN = '8D40621D58C382D690C8AC2863A7';
export const EXAMPLE_POSITION_ODD = '8D40621D58C386435CC412692AD6';
export const EXAMPLE_VELOCITY_GROUND_SPEED = '8D485020994409940838175B284F';
export const EXAMPLE_VELOCITY_AIRSPEED = '8DA05F219B06B6AF189400CBC33F';
/** DF18 (non-transponder) — DF17'nin ME'siyle aynı yük, CF=0. KURULDU. */
export const EXAMPLE_DF18_IDENTIFICATION = '904840D6202CC371C32CE02A6C6D';
/** TC 31 (aircraft operation status) — TANINIR ama çözülmez. KURULDU. */
export const EXAMPLE_TYPE_CODE_31 = '8D4840D6F8112233445566B06F74';
/** TC 7 (surface position) — kapsam dışı, ME ham kalır. KURULDU. */
export const EXAMPLE_TYPE_CODE_7 = '8D4840D6381122334455666F4EE9';
/** ADS-B DEĞİL: gerçek bir DF20 Comm-B yanıtı. MB alanı ME gibi GÖRÜNÜR. */
export const EXAMPLE_NOT_EXTENDED_SQUITTER = 'A000083E202CC371C31DE0AA1CCF';
/** İlk örneğin bir ME baytı bozuldu — ME çözülür, çerçeve `valid:false`. */
export const EXAMPLE_CRC_FAIL = '8D4840D6202CC271C32CE0576098';

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'identification-klm1023',
    name: 'protocol.adsb.example.identificationKlm.name',
    bytes: modeSBytesFromHex(EXAMPLE_IDENTIFICATION),
    description: 'protocol.adsb.example.identificationKlm.description',
    expectedValid: true,
  },
  {
    id: 'identification-ezy85mh',
    name: 'protocol.adsb.example.identificationEzy.name',
    bytes: modeSBytesFromHex(EXAMPLE_IDENTIFICATION_EZY),
    description: 'protocol.adsb.example.identificationEzy.description',
    expectedValid: true,
  },
  {
    id: 'airborne-position-even',
    name: 'protocol.adsb.example.positionEven.name',
    bytes: modeSBytesFromHex(EXAMPLE_POSITION_EVEN),
    description: 'protocol.adsb.example.positionEven.description',
    expectedValid: true,
  },
  {
    id: 'airborne-position-odd',
    name: 'protocol.adsb.example.positionOdd.name',
    bytes: modeSBytesFromHex(EXAMPLE_POSITION_ODD),
    description: 'protocol.adsb.example.positionOdd.description',
    expectedValid: true,
  },
  {
    id: 'velocity-ground-speed',
    name: 'protocol.adsb.example.velocityGroundSpeed.name',
    bytes: modeSBytesFromHex(EXAMPLE_VELOCITY_GROUND_SPEED),
    description: 'protocol.adsb.example.velocityGroundSpeed.description',
    expectedValid: true,
  },
  {
    id: 'velocity-airspeed',
    name: 'protocol.adsb.example.velocityAirspeed.name',
    bytes: modeSBytesFromHex(EXAMPLE_VELOCITY_AIRSPEED),
    description: 'protocol.adsb.example.velocityAirspeed.description',
    expectedValid: true,
  },
  {
    id: 'df18-identification',
    name: 'protocol.adsb.example.df18Identification.name',
    bytes: modeSBytesFromHex(EXAMPLE_DF18_IDENTIFICATION),
    description: 'protocol.adsb.example.df18Identification.description',
    expectedValid: true,
  },
  {
    id: 'surface-position-not-decoded',
    name: 'protocol.adsb.example.surfacePosition.name',
    bytes: modeSBytesFromHex(EXAMPLE_TYPE_CODE_7),
    description: 'protocol.adsb.example.surfacePosition.description',
    expectedValid: true,
  },
  {
    id: 'operation-status-not-decoded',
    name: 'protocol.adsb.example.operationStatus.name',
    bytes: modeSBytesFromHex(EXAMPLE_TYPE_CODE_31),
    description: 'protocol.adsb.example.operationStatus.description',
    expectedValid: true,
  },
  {
    id: 'crc-fail',
    name: 'protocol.adsb.example.crcFail.name',
    bytes: modeSBytesFromHex(EXAMPLE_CRC_FAIL),
    description: 'protocol.adsb.example.crcFail.description',
    expectedValid: false,
  },
  {
    id: 'not-extended-squitter',
    name: 'protocol.adsb.example.notExtendedSquitter.name',
    bytes: modeSBytesFromHex(EXAMPLE_NOT_EXTENDED_SQUITTER),
    description: 'protocol.adsb.example.notExtendedSquitter.description',
    expectedValid: false,
  },
];

export const adsbPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: adsbParser,
  documentation: {
    summary: 'protocol.adsb.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
  // `decodeOptions` YOK — Type Code kendini anlatır (dosya başı).
};
