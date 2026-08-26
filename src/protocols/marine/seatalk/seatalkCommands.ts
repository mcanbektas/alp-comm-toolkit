/**
 * SeaTalk 1 komut tablosu ve çift-kaynaklı komutların yük çözücüleri
 * (Faz 10, dalga 16b).
 *
 * Ayrı modül olmasının gerekçesi `nmeaSentences.ts`in `nmea0183.ts`ten
 * ayrılmasıyla AYNIDIR (`nmea0183.ts:1-8`: *"Cümle çözümü BURADA YOKTUR…
 * tek yerde yaşar"*): `seatalk.ts` ZARFI (komut baytı, attribute nibble'ı,
 * uzunluk formülü, tümleyen çifti) çözer, komut SEMANTİĞİ burada yaşar.
 *
 * ── KOMUT ADLARI VERİDİR, ÇEVİRİYE GİRMEZ ──────────────────────────────────
 * CLAUDE.md: *"Protokol ve araç adları veridir, çeviriye girmez."* Aşağıdaki
 * 59 ad Knauf'un Part 2 başlıklarından birebir alınmıştır. Çeviriye giren tek
 * şey uyarı/seçenek metinleridir (`seatalk.ts`).
 *
 * ── KAÇ KOMUT TANINIR, KAÇI ÇÖZÜLÜR ────────────────────────────────────────
 * TANINIR (adı basılır): **59** — Knauf Part 2'nin belgelediği her komut baytı.
 * ÇÖZÜLÜR (payload alan alan): **22** — yalnız İKİNCİ bağımsız bir uygulamada
 * da teyitli olanlar (SignalK `nmea0183-signalk/src/hooks/seatalk/*` 21 hook +
 * canboat `126720-seatalk1Keystroke.yaml`ın `seatalk1Command match: 134`
 * = 0x86). Geri kalan 37 komutta payload HAM kalır ve
 * `commandPayloadNeedsVendorMap` uyarısı basılır. Bu, `ads-b`nin Type Code
 * kararının (15h) birebir biçimidir: *"TC 5–8/28/29/31 TANINIR ama payload
 * ÇÖZÜLMEZ"*. **Tek kaynaklı komutun alan tablosu YAYINLANMAZ.**
 *
 * ── BRİFİN "60 KOMUT" SAYISI ÇÜRÜDÜ: GERÇEK SAYI 59 ────────────────────────
 * Brif (`docs/brief-faz10-dalga16b.md`) altmış komut baytı sayıyor ve listenin
 * sonuna `C7` koyuyor. Knauf Part 2'nin TAM metninde `C7` yalnız TEK bir yerde
 * geçiyor ve orası `A1 XD 49 49 GG HH II JJ C1 C2 C3 C4 C5 C6 C7 C8` satırının
 * sarmalanmış devamıdır — `C1…C8` waypoint adının SEKİZ KARAKTER yer tutucusu,
 * bir komut baytı DEĞİL. Fantom bir komut yayımlamak "uydurma kaynak" hatasının
 * (dalga 13 dersi 5) tam kendisi olurdu; tablo 59 gerçek komutla kapanır.
 *
 * ── İKİ KAYNAK ÇELİŞTİĞİNDE NE YAPILDI — ÜÇ VAKA ───────────────────────────
 * Kaynak turunda SignalK'in Knauf'tan SAPTIĞI üç yer bulundu. Üçünde de
 * Knauf'un KENDİ İÇİNDE ARİTMETİK OLARAK DOĞRULANAN metni esas alındı:
 *
 * 1) **0x85 XTE nibble sırası.** SignalK `XXX = (X << 8) | XX` hesaplıyor
 *    (`0x85.ts`). Knauf'un kendi örneği bunu ÇÜRÜTÜYOR: *"X-track error
 *    2.61nm => 261 dec => 0x105 => X6XX=5_10"* — yani X=5, XX=0x10 ve
 *    XXX = (XX << 4) | X = 0x105. Aynı datagramdaki menzil alanını SignalK
 *    zaten `(ZZ << 4) | Z_high` diye okuyor; XTE'yi farklı okuması kendi
 *    içinde de tutarsız. **`(XX << 4) | X` alındı** — Knauf'un örneği bir
 *    ARİTMETİK KANITTIR, tercih değil.
 * 2) **0x20 Speed Through Water.** SignalK `(parts[2] + parts[3]) / 10` diye
 *    iki baytı TOPLUYOR. Knauf Part 1 §Data Coding: *"Numerical values are
 *    transmitted binary coded and with least significant data first. Example:
 *    0x13 0x57 means 0x5713"* ve aynı deponun 0x52/0x27/0x22 hook'ları da
 *    `parts[2] + 256*parts[3]` yapıyor. **Little-endian 16 bit alındı.**
 * 3) **0x84/0x9C başlık düzeltme terimi.** Knauf'un İNGİLİZCE metni
 *    *"number of bits set in the two higher bits of U"* diyor (popcount →
 *    0/1/1/2). Hemen altındaki sözde-C ifadesinde (`U & 0xC == 0xC`) bir
 *    ÖNCELİK HATASI var ve SignalK o hatayı BİLEREK koruyor (`0x84.ts`
 *    yorumu: *"Preserved verbatim to keep the existing test suite green"*),
 *    bu da `U & 1 ? 2 : 1` demeye geliyor. **İngilizce metin (popcount)
 *    alındı**, AMA iki okuma AYRIŞTIĞINDA (ör. U=0x5) başlık alanına
 *    `headingCorrectionAmbiguous` uyarısı basılır — fark en fazla 1°'dir ama
 *    "gösterilir ≠ doğrulanır" (dalga 13 dersi 3) burada da geçerlidir.
 *
 * ── BAŞLIK FORMÜLÜ SADELEŞTİRİLEMEZ ────────────────────────────────────────
 * Knauf, Part 2, komut 84/9C — birebir:
 *   (U & 0x3)* 90 + (VW & 0x3F)* 2 + <two higher bits of U'da SET olan bit sayısı>
 * ve komut 53/89 için FARKLI bir üçüncü terim:
 *   (U & 0x3) * 90 + (VW & 0x3F) * 2 + (U & 0xC) / 8
 * İkisi AYNI DEĞİLDİR (`(U&0xC)/8` ∈ {0, 0.5, 1, 1.5}; popcount ∈ {0,1,1,2}).
 * `(U & 0x3)*90 + VW/2` gibi "makul" bir sadeleştirme HATA VERMEDEN yanlış açı
 * üretir — `arinc-429`in bit sırası tuzağıyla (15f) aynı sınıf. İkisi de
 * `seatalkCommands.test.ts`te Knauf'un örnek değerleriyle bekçilenir.
 *
 * ── `unit` YALNIZ GERÇEK FİZİKSEL DEĞERE ───────────────────────────────────
 * `types.ts:46`. Derinlik `ft` (Knauf açıkça *"XXXX/10 feet"* diyor; `Y&4`
 * metrik bayrağı EKRANIN gösterim tercihidir, TELDEKİ ölçeği DEĞİŞTİRMEZ —
 * SignalK de 0x00'ı koşulsuz `0.3048 * XXXX/10` ile metreye çeviriyor, yani
 * bayrağa BAKMIYOR). Başlık/kurs `°`, hız `kn`, mesafe `nm`, sıcaklık `°C`.
 * Ham nibble'lar, bayrak bitleri, komut baytı ve tuş kodu BİRİMSİZDİR.
 */

/** Çeviri anahtarı öneki — `seatalk.ts` ile paylaşılır. */
export const SEATALK_TRANSLATION_KEY_PREFIX = 'protocol.seatalk';

/** Başlık düzeltme teriminin iki okuması ayrıştığında alana basılan uyarı. */
export const FIELD_WARN_HEADING_CORRECTION_AMBIGUOUS = `${SEATALK_TRANSLATION_KEY_PREFIX}.field.headingCorrectionAmbiguous`;
/** Tuş kodu yalnız Knauf'ta var, canboat'ın `SEATALK_KEYSTROKE` tablosunda teyitli DEĞİL. */
export const FIELD_WARN_KEY_CODE_SINGLE_SOURCE = `${SEATALK_TRANSLATION_KEY_PREFIX}.field.keyCodeSingleSource`;
/** Alan tel üzerinde var ama "veri mevcut" bayrağı düşük — Knauf 0x85 §F. */
export const FIELD_WARN_VALUE_NOT_PRESENT = `${SEATALK_TRANSLATION_KEY_PREFIX}.field.valueNotPresent`;

/** `noUncheckedIndexedAccess` guard'ı — bayt dizisi okumaları tek yerden geçer. */
export function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

export function hexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function hexNibble(value: number): string {
  return `0x${(value & 0x0f).toString(16).toUpperCase()}`;
}

export function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** İki baytlık little-endian okuma — Knauf Part 1 §Data Coding'in varsayılanı. */
function littleEndian16(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) + byteAt(bytes, offset + 1) * 256;
}

function signedByte(value: number): number {
  return value > 127 ? value - 256 : value;
}

function highNibble(value: number): number {
  return (value & 0xf0) >> 4;
}

function lowNibble(value: number): number {
  return value & 0x0f;
}

/**
 * Çözücülerin ürettiği ara biçim. `ParsedField`e `seatalk.ts` çevirir; burada
 * `rawBytes` YOKTUR çünkü onu offset/length'ten türetmek çağıranın işidir
 * (aynı dilimleme mantığı iki yerde yaşamasın).
 */
export interface SeatalkDecodedField {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
  readonly length: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: number | string;
  readonly unit?: string;
  readonly warnings?: readonly string[];
}

export interface SeatalkCommandDefinition {
  /** Komut baytı (`data[0]`). */
  readonly command: number;
  /** Knauf Part 2 başlığı — VERİDİR, çeviriye girmez. */
  readonly name: string;
  /** Beklenen toplam datagram uzunluğu, biliniyorsa (`3 + n`). Değişkense `undefined`. */
  readonly fixedLength?: number;
  /**
   * Knauf'un küçük harf gösteriminin (`ZZ zz`) belgelediği tümleyen çiftleri —
   * bayt indeksi ikilileri. Toplamları DAİMA 0xFF olmalıdır (Part 1 §Data
   * Coding). Tanımlı olmayan komutta alan HİÇ BASILMAZ.
   */
  readonly complementPairs?: readonly (readonly [number, number])[];
  /**
   * Yalnız İKİ bağımsız kaynakta teyitli komutlarda vardır. Yoksa payload HAM
   * kalır + `commandPayloadNeedsVendorMap`.
   */
  readonly decodePayload?: (data: Uint8Array) => SeatalkDecodedField[];
}

// ── Başlık (heading) matematiği — iki AYRI formül ───────────────────────────

/** Knauf'un İNGİLİZCE metni: "number of bits set in the two higher bits of U". */
export function headingCorrectionByBitCount(u: number): number {
  const bits = (u & 0x0c) >> 2;
  return (bits & 0x01) + ((bits >> 1) & 0x01);
}

/**
 * SignalK'in koruduğu okuma (`0x84.ts`): sözde-C'deki `U & 0xC == 0xC` önceliği
 * `U & 1`e çöküyor. Yalnız KARŞILAŞTIRMAK için var — motor bunu KULLANMAZ.
 */
export function headingCorrectionBySignalKQuirk(u: number): number {
  if ((u & 0x0c) === 0) return 0;
  return (u & 0x01) === 1 ? 2 : 1;
}

export interface SeatalkHeading {
  readonly degrees: number;
  /** İki okuma ayrışıyorsa `true` — alan uyarısı bunun üzerinden basılır. */
  readonly ambiguous: boolean;
}

/** 0x84 / 0x9C başlığı. Üç terimli, sadeleştirilemez (dosya başı). */
export function decodeSeatalkHeading(u: number, vw: number): SeatalkHeading {
  const correction = headingCorrectionByBitCount(u);
  const base = (u & 0x03) * 90 + (vw & 0x3f) * 2;
  return {
    degrees: base + correction,
    ambiguous: correction !== headingCorrectionBySignalKQuirk(u),
  };
}

/** 0x53 (COG) / 0x89 başlığı — üçüncü terim FARKLIDIR: `(U & 0xC) / 8`. */
export function decodeSeatalkCourse(u: number, vw: number): number {
  return (u & 0x03) * 90 + (vw & 0x3f) * 2 + (u & 0x0c) / 8;
}

// ── 0x86 tuş kodları — YALNIZ İKİ KAYNAKTA ÖRTÜŞENLER ADLANDIRILIR ──────────
/**
 * canboat `database/lookups/SEATALK_KEYSTROKE.yaml` ile Knauf Part 2'nin
 * `86` tablosu KARŞILAŞTIRILDI. Örtüşen sekiz kod aşağıdadır. **İki kod
 * ÇELİŞİYOR ve bu yüzden ADLANDIRILMADI:** canboat `3: Wind` derken Knauf
 * `X1 03 FC → Track` diyor; canboat `35: Track` derken Knauf
 * `X1 23 DC → Standby & Auto (wind mode)` diyor. Çelişen kodda ad basmak
 * "iki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ" kuralını (dalga 13
 * dersi 5) çiğnemek olurdu; ham kod + `keyCodeSingleSource` uyarısı basılır.
 */
const CROSS_CONFIRMED_KEY_CODES: ReadonlyMap<number, string> = new Map([
  [0x01, 'Auto'],
  [0x02, 'Standby'],
  [0x05, '-1'],
  [0x06, '-10'],
  [0x07, '+1'],
  [0x08, '+10'],
  [0x21, '-1 and -10'],
  [0x22, '+1 and +10'],
]);

export function crossConfirmedKeyName(code: number): string | undefined {
  return CROSS_CONFIRMED_KEY_CODES.get(code);
}

function flagField(
  id: string,
  name: string,
  offset: number,
  isSet: boolean,
): SeatalkDecodedField {
  return { id, name, offset, length: 1, rawValue: isSet ? 1 : 0 };
}

// ── Çözücüler — 22 çift-kaynaklı komut ──────────────────────────────────────

/** `00 02 YZ XX XX` — Depth below transducer. */
function decodeDepth(data: Uint8Array): SeatalkDecodedField[] {
  const flags = byteAt(data, 2);
  const y = highNibble(flags);
  const z = lowNibble(flags);
  const raw = littleEndian16(data, 3);
  return [
    { id: 'depth-flags', name: 'Depth · Flags (YZ)', offset: 2, length: 1, rawValue: hexByte(flags) },
    flagField('depth-anchor-alarm', 'Depth · Anchor Alarm (Y&8)', 2, (y & 0x8) === 0x8),
    flagField('depth-metric-display', 'Depth · Metric Display Units (Y&4)', 2, (y & 0x4) === 0x4),
    flagField('depth-transducer-defective', 'Depth · Transducer Defective (Z&4)', 2, (z & 0x4) === 0x4),
    flagField('depth-deep-alarm', 'Depth · Deep Alarm (Z&2)', 2, (z & 0x2) === 0x2),
    flagField('depth-shallow-alarm', 'Depth · Shallow Alarm (Z&1)', 2, (z & 0x1) === 0x1),
    {
      id: 'depth-below-transducer',
      name: 'Depth Below Transducer',
      offset: 3,
      length: 2,
      rawValue: raw,
      physicalValue: raw / 10,
      // Tel DAİMA feet taşır; Y&4 EKRANIN tercihidir (dosya başı).
      unit: 'ft',
    },
  ];
}

/** `10 01 XX YY` — Apparent Wind Angle. Knauf `XXYY` yazıyor: BÜYÜK-endian. */
function decodeApparentWindAngle(data: Uint8Array): SeatalkDecodedField[] {
  const raw = byteAt(data, 2) * 256 + byteAt(data, 3);
  return [
    {
      id: 'apparent-wind-angle',
      name: 'Apparent Wind Angle (right of bow)',
      offset: 2,
      length: 2,
      rawValue: raw,
      physicalValue: raw / 2,
      unit: '°',
    },
  ];
}

/** `11 01 XX 0Y` — Apparent Wind Speed. */
function decodeApparentWindSpeed(data: Uint8Array): SeatalkDecodedField[] {
  const xx = byteAt(data, 2);
  const y = lowNibble(byteAt(data, 3));
  return [
    {
      id: 'apparent-wind-speed',
      name: 'Apparent Wind Speed',
      offset: 2,
      length: 2,
      rawValue: (xx & 0x7f) * 10 + y,
      physicalValue: (xx & 0x7f) + y / 10,
      unit: 'kn',
    },
    {
      id: 'apparent-wind-speed-display-unit',
      name: 'Apparent Wind Speed · Display Unit Flag (XX&0x80)',
      offset: 2,
      length: 1,
      rawValue: (xx & 0x80) === 0x80 ? 1 : 0,
      physicalValue: (xx & 0x80) === 0x80 ? 'm/s' : 'kn',
    },
  ];
}

/** `20 01 XX XX` — Speed through water (little-endian; SignalK burada hatalı, dosya başı). */
function decodeSpeedThroughWater(data: Uint8Array): SeatalkDecodedField[] {
  const raw = littleEndian16(data, 2);
  return [
    {
      id: 'speed-through-water',
      name: 'Speed Through Water',
      offset: 2,
      length: 2,
      rawValue: raw,
      physicalValue: raw / 10,
      unit: 'kn',
    },
  ];
}

/** `21 02 XX XX 0X` — Trip Mileage. */
function decodeTripMileage(data: Uint8Array): SeatalkDecodedField[] {
  const raw = littleEndian16(data, 2) + lowNibble(byteAt(data, 4)) * 65536;
  return [
    {
      id: 'trip-mileage',
      name: 'Trip Mileage',
      offset: 2,
      length: 3,
      rawValue: raw,
      physicalValue: raw / 100,
      unit: 'nm',
    },
  ];
}

/** `22 02 XX XX 00` — Total Mileage. */
function decodeTotalMileage(data: Uint8Array): SeatalkDecodedField[] {
  const raw = littleEndian16(data, 2);
  return [
    {
      id: 'total-mileage',
      name: 'Total Mileage',
      offset: 2,
      length: 2,
      rawValue: raw,
      physicalValue: raw / 10,
      unit: 'nm',
    },
  ];
}

/** `25 Z4 XX YY UU VV AW` — Total & Trip Log. */
function decodeTotalAndTripLog(data: Uint8Array): SeatalkDecodedField[] {
  const z = highNibble(byteAt(data, 1));
  const total = littleEndian16(data, 2) + z * 65536;
  const w = lowNibble(byteAt(data, 6));
  const trip = littleEndian16(data, 4) + w * 65536;
  return [
    {
      id: 'total-log',
      // Attribute'ın YÜKSEK nibble'ı VERİDİR (dolgu değil) — alan attribute'tan başlar.
      name: 'Total Log (Z nibble + XX YY)',
      offset: 1,
      length: 3,
      rawValue: total,
      physicalValue: total / 10,
      unit: 'nm',
    },
    {
      id: 'trip-log',
      name: 'Trip Log (UU VV + W nibble)',
      offset: 4,
      length: 3,
      rawValue: trip,
      physicalValue: trip / 100,
      unit: 'nm',
    },
  ];
}

/** `26 04 XX XX YY YY DE` — Speed through water, yüksek çözünürlük. */
function decodeSpeedHighResolution(data: Uint8Array): SeatalkDecodedField[] {
  const de = byteAt(data, 6);
  const d = highNibble(de);
  const e = lowNibble(de);
  const sensor1 = littleEndian16(data, 2);
  const second = littleEndian16(data, 4);
  const secondIsSensor2 = (d & 0x8) === 0x8;
  return [
    {
      id: 'speed-sensor-1',
      name: 'Speed Through Water · Sensor 1',
      offset: 2,
      length: 2,
      rawValue: sensor1,
      physicalValue: sensor1 / 100,
      unit: 'kn',
      warnings: (d & 0x4) === 0x4 ? [] : [FIELD_WARN_VALUE_NOT_PRESENT],
    },
    {
      id: 'speed-second-value',
      name: secondIsSensor2 ? 'Speed Through Water · Sensor 2' : 'Speed Through Water · Average (trip/time)',
      offset: 4,
      length: 2,
      rawValue: second,
      physicalValue: second / 100,
      unit: 'kn',
    },
    flagField('speed-sensor-1-valid', 'Speed · Sensor 1 Valid (D&4)', 6, (d & 0x4) === 0x4),
    flagField('speed-average-stopped', 'Speed · Average Calculation Stopped (E&1)', 6, (e & 0x1) === 0x1),
    flagField('speed-display-mph', 'Speed · Display in MPH (E&2)', 6, (e & 0x2) === 0x2),
  ];
}

/** `27 01 XX XX` — Water temperature. */
function decodeWaterTemperature(data: Uint8Array): SeatalkDecodedField[] {
  const raw = littleEndian16(data, 2);
  return [
    {
      id: 'water-temperature',
      name: 'Water Temperature',
      offset: 2,
      length: 2,
      rawValue: raw,
      physicalValue: (raw - 100) / 10,
      unit: '°C',
    },
  ];
}

function decodePositionHalf(
  data: Uint8Array,
  axis: 'Latitude' | 'Longitude',
): SeatalkDecodedField[] {
  const degrees = byteAt(data, 2);
  const minutesRaw = littleEndian16(data, 3);
  const signBitSet = (byteAt(data, 4) & 0x80) === 0x80;
  const hemisphere =
    axis === 'Latitude' ? (signBitSet ? 'South' : 'North') : signBitSet ? 'East' : 'West';
  const prefix = axis === 'Latitude' ? 'lat' : 'lon';
  return [
    {
      id: `${prefix}-degrees`,
      name: `${axis} · Degrees`,
      offset: 2,
      length: 1,
      rawValue: degrees,
      unit: '°',
    },
    {
      id: `${prefix}-minutes`,
      name: `${axis} · Minutes (YYYY & 0x7FFF)`,
      offset: 3,
      length: 2,
      rawValue: minutesRaw,
      physicalValue: (minutesRaw & 0x7fff) / 100,
      unit: "'",
    },
    {
      id: `${prefix}-hemisphere`,
      name: `${axis} · Hemisphere (YYYY & 0x8000)`,
      offset: 4,
      length: 1,
      rawValue: signBitSet ? 1 : 0,
      physicalValue: hemisphere,
    },
  ];
}

/** `50 Z2 XX YY YY` — LAT position (süzülmüş). */
function decodeLatitude(data: Uint8Array): SeatalkDecodedField[] {
  return decodePositionHalf(data, 'Latitude');
}

/** `51 Z2 XX YY YY` — LON position (süzülmüş). */
function decodeLongitude(data: Uint8Array): SeatalkDecodedField[] {
  return decodePositionHalf(data, 'Longitude');
}

/** `52 01 XX XX` — Speed over ground. */
function decodeSpeedOverGround(data: Uint8Array): SeatalkDecodedField[] {
  const raw = littleEndian16(data, 2);
  return [
    {
      id: 'speed-over-ground',
      name: 'Speed Over Ground',
      offset: 2,
      length: 2,
      rawValue: raw,
      physicalValue: raw / 10,
      unit: 'kn',
    },
  ];
}

/** `53 U0 VW` — Course over ground. ÜÇÜNCÜ TERİM 84/9C'DEN FARKLIDIR. */
function decodeCourseOverGround(data: Uint8Array): SeatalkDecodedField[] {
  const u = highNibble(byteAt(data, 1));
  const vw = byteAt(data, 2);
  return [
    {
      id: 'course-over-ground',
      name: 'Course Over Ground (magnetic)',
      offset: 1,
      length: 2,
      rawValue: (u << 8) | vw,
      physicalValue: decodeSeatalkCourse(u, vw),
      unit: '°',
    },
  ];
}

/** `54 T1 RS HH` — GMT time. Saniye nibble'ları attribute ile byte 2'ye YAYILIR. */
function decodeGmtTime(data: Uint8Array): SeatalkDecodedField[] {
  const t = highNibble(byteAt(data, 1));
  const rs = byteAt(data, 2);
  const st = (lowNibble(rs) << 4) | t;
  return [
    { id: 'gmt-hours', name: 'GMT · Hours (HH)', offset: 3, length: 1, rawValue: byteAt(data, 3), unit: 'h' },
    {
      id: 'gmt-minutes',
      name: 'GMT · Minutes ((RS & 0xFC) / 4)',
      offset: 2,
      length: 1,
      rawValue: (rs & 0xfc) / 4,
      unit: 'min',
    },
    {
      id: 'gmt-seconds',
      name: 'GMT · Seconds (ST & 0x3F)',
      offset: 1,
      length: 2,
      rawValue: st & 0x3f,
      unit: 's',
    },
  ];
}

/** `56 M1 DD YY` — Date. Yüzyıl Knauf'ta YAZMIYOR: ham YY basılır, 20YY VARSAYILMAZ. */
function decodeDate(data: Uint8Array): SeatalkDecodedField[] {
  return [
    { id: 'date-month', name: 'Date · Month (M)', offset: 1, length: 1, rawValue: highNibble(byteAt(data, 1)) },
    { id: 'date-day', name: 'Date · Day (DD)', offset: 2, length: 1, rawValue: byteAt(data, 2) },
    { id: 'date-year', name: 'Date · Year (YY, century not on the wire)', offset: 3, length: 1, rawValue: byteAt(data, 3) },
  ];
}

/** `57 S0 DD` — Satellite info. */
function decodeSatelliteInfo(data: Uint8Array): SeatalkDecodedField[] {
  return [
    {
      id: 'satellite-count',
      name: 'Satellite Info · Number of Satellites (S)',
      offset: 1,
      length: 1,
      rawValue: highNibble(byteAt(data, 1)),
    },
    {
      id: 'horizontal-dilution',
      name: 'Satellite Info · Horizontal Dilution of Position (DD)',
      offset: 2,
      length: 1,
      rawValue: byteAt(data, 2),
    },
  ];
}

/** `82 05 XX xx YY yy ZZ zz` — Target waypoint name (son 4 karakter). */
function decodeTargetWaypointName(data: Uint8Array): SeatalkDecodedField[] {
  const xx = byteAt(data, 2);
  const yy = byteAt(data, 4);
  const zz = byteAt(data, 6);
  const chars = [
    (xx & 0x3f) + 0x30,
    (yy & 0x0f) * 4 + (xx & 0xc0) / 64 + 0x30,
    (zz & 0x03) * 16 + (yy & 0xf0) / 16 + 0x30,
    (zz & 0xfc) / 4 + 0x30,
  ];
  return [
    {
      id: 'target-waypoint-name',
      name: 'Target Waypoint Name (last 4 characters)',
      offset: 2,
      length: 6,
      rawValue: hexString(data.slice(2, 8)),
      physicalValue: String.fromCharCode(...chars),
    },
  ];
}

/** `84 U6 VW XY 0Z 0M RR SS TT` — Compass heading, autopilot course, rudder. */
function decodeAutopilot(data: Uint8Array): SeatalkDecodedField[] {
  const u = highNibble(byteAt(data, 1));
  const vw = byteAt(data, 2);
  const heading = decodeSeatalkHeading(u, vw);
  const v = highNibble(vw);
  const xy = byteAt(data, 3);
  const z = lowNibble(byteAt(data, 4));
  const m = lowNibble(byteAt(data, 5));
  const rudder = byteAt(data, 6);
  return [
    {
      id: 'compass-heading',
      name: 'Compass Heading',
      offset: 1,
      length: 2,
      rawValue: (u << 8) | vw,
      physicalValue: heading.degrees,
      unit: '°',
      warnings: heading.ambiguous ? [FIELD_WARN_HEADING_CORRECTION_AMBIGUOUS] : [],
    },
    {
      id: 'turning-direction',
      name: 'Turning Direction (MSB of U)',
      offset: 1,
      length: 1,
      rawValue: (u & 0x8) === 0x8 ? 1 : 0,
      physicalValue: (u & 0x8) === 0x8 ? 'right (heading increasing)' : 'left (heading decreasing)',
    },
    {
      id: 'autopilot-course',
      name: 'Autopilot Course',
      offset: 2,
      length: 2,
      rawValue: (v << 8) | xy,
      physicalValue: ((v & 0x0c) >> 2) * 90 + xy / 2,
      unit: '°',
    },
    flagField('autopilot-auto-mode', 'Autopilot · Auto Mode (Z&2)', 4, (z & 0x2) === 0x2),
    flagField('autopilot-vane-mode', 'Autopilot · Vane Mode / WindTrim (Z&4)', 4, (z & 0x4) === 0x4),
    flagField('autopilot-track-mode', 'Autopilot · Track Mode (Z&8)', 4, (z & 0x8) === 0x8),
    flagField('autopilot-alarm-off-course', 'Autopilot · Off Course Alarm (M&4)', 5, (m & 0x4) === 0x4),
    flagField('autopilot-alarm-wind-shift', 'Autopilot · Wind Shift Alarm (M&8)', 5, (m & 0x8) === 0x8),
    {
      id: 'rudder-position',
      name: 'Rudder Position (positive steers right)',
      offset: 6,
      length: 1,
      rawValue: rudder,
      physicalValue: signedByte(rudder),
      unit: '°',
    },
    // SS ve TT'nin bit anlamları YALNIZ Knauf'ta — ham basılır, adlandırılmaz.
    {
      id: 'autopilot-display-flags',
      name: 'Autopilot · Display Flags (SS, raw)',
      offset: 7,
      length: 1,
      rawValue: hexByte(byteAt(data, 7)),
    },
    {
      id: 'autopilot-computer-type',
      name: 'Autopilot · Course Computer Type Byte (TT, raw)',
      offset: 8,
      length: 1,
      rawValue: hexByte(byteAt(data, 8)),
    },
  ];
}

/** `85 X6 XX VU ZW ZZ YF 00 yf` — Navigation to waypoint. Nibble sırası TUZAKLI. */
function decodeNavigationToWaypoint(data: Uint8Array): SeatalkDecodedField[] {
  const x = highNibble(byteAt(data, 1));
  const xx = byteAt(data, 2);
  const vu = byteAt(data, 3);
  const v = highNibble(vu);
  const u = lowNibble(vu);
  const zw = byteAt(data, 4);
  const zHigh = highNibble(zw);
  const w = lowNibble(zw);
  const zz = byteAt(data, 5);
  const yf = byteAt(data, 6);
  const y = highNibble(yf);
  const f = lowNibble(yf);

  // Knauf'un ÖRNEĞİYLE kanıtlanmış nibble sıraları (dosya başı): XTE ve menzil
  // düşük nibble'ı SONDA taşır, bearing ise WV = (W << 4) | V.
  const xte = (xx << 4) | x;
  const wv = (w << 4) | v;
  const range = (zz << 4) | zHigh;

  const fields: SeatalkDecodedField[] = [
    { id: 'navigation-present-flags', name: 'Navigation · Data Present Flags (F)', offset: 6, length: 1, rawValue: hexNibble(f) },
    {
      id: 'cross-track-error',
      name: 'Cross Track Error',
      offset: 1,
      length: 2,
      rawValue: xte,
      physicalValue: xte / 100,
      unit: 'nm',
      warnings: (f & 0x1) === 0x1 ? [] : [FIELD_WARN_VALUE_NOT_PRESENT],
    },
    {
      id: 'steer-direction',
      name: 'Direction to Steer (Y&4)',
      offset: 6,
      length: 1,
      rawValue: (y & 0x4) === 0x4 ? 1 : 0,
      physicalValue: (y & 0x4) === 0x4 ? 'right' : 'left',
    },
    {
      id: 'bearing-to-destination',
      name: 'Bearing to Destination',
      offset: 3,
      length: 2,
      rawValue: wv,
      physicalValue: (u & 0x3) * 90 + wv / 2,
      unit: '°',
      warnings: (f & 0x2) === 0x2 ? [] : [FIELD_WARN_VALUE_NOT_PRESENT],
    },
    {
      id: 'bearing-reference',
      name: 'Bearing Reference (U&8)',
      offset: 3,
      length: 1,
      rawValue: (u & 0x8) === 0x8 ? 1 : 0,
      physicalValue: (u & 0x8) === 0x8 ? 'true' : 'magnetic',
    },
    {
      id: 'range-to-destination',
      name: 'Range to Destination',
      offset: 4,
      length: 2,
      rawValue: range,
      physicalValue: (y & 0x1) === 0x1 ? range / 100 : range / 10,
      unit: 'nm',
      warnings: (f & 0x4) === 0x4 ? [] : [FIELD_WARN_VALUE_NOT_PRESENT],
    },
    flagField('xte-over-threshold', 'Navigation · XTE ≥ 0.3 nm (F&8)', 6, (f & 0x8) === 0x8),
  ];
  return fields;
}

/** `86 X1 YY yy` — Keystroke. Tuş ADI yalnız çift teyitli kodlarda basılır. */
function decodeKeystroke(data: Uint8Array): SeatalkDecodedField[] {
  const device = highNibble(byteAt(data, 1));
  const key = byteAt(data, 2);
  const name = crossConfirmedKeyName(key);
  return [
    {
      id: 'keystroke-device',
      name: 'Keystroke · Device (X nibble, raw)',
      offset: 1,
      length: 1,
      rawValue: device,
    },
    {
      id: 'keystroke-key',
      name: 'Keystroke · Key Code',
      offset: 2,
      length: 1,
      rawValue: hexByte(key),
      ...(name === undefined ? {} : { physicalValue: name }),
      warnings: name === undefined ? [FIELD_WARN_KEY_CODE_SINGLE_SOURCE] : [],
    },
  ];
}

/** `99 00 XX` — Compass variation. Knauf: pozitif XX = West. */
function decodeCompassVariation(data: Uint8Array): SeatalkDecodedField[] {
  const xx = byteAt(data, 2);
  return [
    {
      id: 'compass-variation',
      name: 'Compass Variation (positive = East)',
      offset: 2,
      length: 1,
      rawValue: xx,
      physicalValue: -signedByte(xx),
      unit: '°',
    },
  ];
}

/** `9C U1 VW RR` — Compass heading and rudder position. */
function decodeHeadingAndRudder(data: Uint8Array): SeatalkDecodedField[] {
  const u = highNibble(byteAt(data, 1));
  const vw = byteAt(data, 2);
  const heading = decodeSeatalkHeading(u, vw);
  const rudder = byteAt(data, 3);
  return [
    {
      id: 'compass-heading',
      name: 'Compass Heading',
      offset: 1,
      length: 2,
      rawValue: (u << 8) | vw,
      physicalValue: heading.degrees,
      unit: '°',
      warnings: heading.ambiguous ? [FIELD_WARN_HEADING_CORRECTION_AMBIGUOUS] : [],
    },
    {
      id: 'turning-direction',
      name: 'Turning Direction (MSB of U)',
      offset: 1,
      length: 1,
      rawValue: (u & 0x8) === 0x8 ? 1 : 0,
      physicalValue: (u & 0x8) === 0x8 ? 'right (heading increasing)' : 'left (heading decreasing)',
    },
    {
      id: 'rudder-position',
      name: 'Rudder Position (positive steers right)',
      offset: 3,
      length: 1,
      rawValue: rudder,
      physicalValue: signedByte(rudder),
      unit: '°',
    },
  ];
}

/**
 * Knauf Part 2'nin belgelediği 59 komut. Sıra komut baytına göre ARTAN —
 * `seatalkCommands.test.ts` bunu ve benzersizliği bekçiler.
 */
export const SEATALK_COMMANDS: readonly SeatalkCommandDefinition[] = [
  { command: 0x00, name: 'Depth Below Transducer', fixedLength: 5, decodePayload: decodeDepth },
  { command: 0x01, name: 'Equipment ID', fixedLength: 8 },
  { command: 0x05, name: 'Engine RPM and Pitch', fixedLength: 6 },
  { command: 0x10, name: 'Apparent Wind Angle', fixedLength: 4, decodePayload: decodeApparentWindAngle },
  { command: 0x11, name: 'Apparent Wind Speed', fixedLength: 4, decodePayload: decodeApparentWindSpeed },
  { command: 0x20, name: 'Speed Through Water', fixedLength: 4, decodePayload: decodeSpeedThroughWater },
  { command: 0x21, name: 'Trip Mileage', fixedLength: 5, decodePayload: decodeTripMileage },
  { command: 0x22, name: 'Total Mileage', fixedLength: 5, decodePayload: decodeTotalMileage },
  { command: 0x23, name: 'Water Temperature (ST50)', fixedLength: 4 },
  { command: 0x24, name: 'Display Units for Mileage and Speed', fixedLength: 5 },
  { command: 0x25, name: 'Total and Trip Log', fixedLength: 7, decodePayload: decodeTotalAndTripLog },
  {
    command: 0x26,
    name: 'Speed Through Water (High Resolution)',
    fixedLength: 7,
    decodePayload: decodeSpeedHighResolution,
  },
  { command: 0x27, name: 'Water Temperature', fixedLength: 4, decodePayload: decodeWaterTemperature },
  { command: 0x30, name: 'Set Lamp Intensity', fixedLength: 3 },
  { command: 0x36, name: 'Cancel MOB Condition', fixedLength: 3 },
  { command: 0x38, name: 'Codelock Data', fixedLength: 4, complementPairs: [[2, 3]] },
  { command: 0x50, name: 'LAT Position (filtered)', fixedLength: 5, decodePayload: decodeLatitude },
  { command: 0x51, name: 'LON Position (filtered)', fixedLength: 5, decodePayload: decodeLongitude },
  { command: 0x52, name: 'Speed Over Ground', fixedLength: 4, decodePayload: decodeSpeedOverGround },
  { command: 0x53, name: 'Course Over Ground', fixedLength: 3, decodePayload: decodeCourseOverGround },
  { command: 0x54, name: 'GMT Time', fixedLength: 4, decodePayload: decodeGmtTime },
  { command: 0x55, name: 'TRACK Keystroke on GPS Unit', fixedLength: 4, complementPairs: [[2, 3]] },
  { command: 0x56, name: 'Date', fixedLength: 4, decodePayload: decodeDate },
  { command: 0x57, name: 'Satellite Info', fixedLength: 3, decodePayload: decodeSatelliteInfo },
  { command: 0x58, name: 'LAT/LON Position (raw, unfiltered)', fixedLength: 8 },
  { command: 0x59, name: 'Set Count Down Timer', fixedLength: 5 },
  { command: 0x61, name: 'E-80 Initialization', fixedLength: 6 },
  { command: 0x65, name: 'Select Fathom Display Units', fixedLength: 3 },
  { command: 0x66, name: 'Wind Alarm', fixedLength: 3 },
  { command: 0x68, name: 'Alarm Acknowledgment Keystroke', fixedLength: 4 },
  { command: 0x6c, name: 'Second Equipment ID', fixedLength: 8 },
  { command: 0x6e, name: 'MOB (Man Over Board)', fixedLength: 10 },
  { command: 0x70, name: 'Keystroke on ST60 Maxiview Remote', fixedLength: 3 },
  { command: 0x80, name: 'Set Lamp Intensity (autopilot)', fixedLength: 3 },
  { command: 0x81, name: 'Course Computer Setup (USER CAL)' },
  {
    command: 0x82,
    name: 'Target Waypoint Name',
    fixedLength: 8,
    complementPairs: [
      [2, 3],
      [4, 5],
      [6, 7],
    ],
    decodePayload: decodeTargetWaypointName,
  },
  { command: 0x83, name: 'Course Computer Failure Status', fixedLength: 10 },
  {
    command: 0x84,
    name: 'Compass Heading, Autopilot Course and Rudder Position',
    fixedLength: 9,
    decodePayload: decodeAutopilot,
  },
  {
    command: 0x85,
    name: 'Navigation to Waypoint Information',
    fixedLength: 9,
    complementPairs: [[6, 8]],
    decodePayload: decodeNavigationToWaypoint,
  },
  { command: 0x86, name: 'Keystroke', fixedLength: 4, complementPairs: [[2, 3]], decodePayload: decodeKeystroke },
  { command: 0x87, name: 'Set Response Level', fixedLength: 3 },
  { command: 0x88, name: 'Autopilot Parameter', fixedLength: 6 },
  { command: 0x89, name: 'Compass Heading (ST40)', fixedLength: 5 },
  { command: 0x90, name: 'Device Identification', fixedLength: 3 },
  { command: 0x91, name: 'Set Rudder Gain', fixedLength: 3 },
  { command: 0x92, name: 'Set Autopilot Parameter', fixedLength: 5 },
  { command: 0x93, name: 'Enter Autopilot Setup', fixedLength: 3 },
  { command: 0x95, name: 'Autopilot Value Setting Mode', fixedLength: 9 },
  { command: 0x99, name: 'Compass Variation', fixedLength: 3, decodePayload: decodeCompassVariation },
  { command: 0x9a, name: 'Version String', fixedLength: 12 },
  {
    command: 0x9c,
    name: 'Compass Heading and Rudder Position',
    fixedLength: 4,
    decodePayload: decodeHeadingAndRudder,
  },
  { command: 0x9e, name: 'Waypoint Definition', fixedLength: 15 },
  { command: 0xa1, name: 'Destination Waypoint Info' },
  { command: 0xa2, name: 'Arrival Info', fixedLength: 7 },
  { command: 0xa4, name: 'Device Identification Query / Response' },
  { command: 0xa5, name: 'GPS and DGPS Fix Info' },
  { command: 0xa7, name: 'Unknown Meaning (Raystar 120 GPS)' },
  { command: 0xa8, name: 'Alarm State for Guard #1 / #2' },
  { command: 0xab, name: 'Alarm State for Guard #1 / #2 (second form)' },
];

const COMMANDS_BY_BYTE: ReadonlyMap<number, SeatalkCommandDefinition> = new Map(
  SEATALK_COMMANDS.map((definition) => [definition.command, definition]),
);

export function findSeatalkCommand(command: number): SeatalkCommandDefinition | undefined {
  return COMMANDS_BY_BYTE.get(command);
}

/** Knauf Part 2'nin belgelediği komut sayısı — TANINAN küme. */
export const SEATALK_RECOGNIZED_COMMAND_COUNT = SEATALK_COMMANDS.length;

/** İkinci bağımsız kaynakta da teyitli olan, payload'ı ÇÖZÜLEN küme. */
export const SEATALK_DECODED_COMMAND_COUNT = SEATALK_COMMANDS.filter(
  (definition) => definition.decodePayload !== undefined,
).length;
