/**
 * SNVT (Standard Network Variable Type) ÖLÇEK TABLOSU — saf veri (Faz 10,
 * dalga 17).
 *
 * ── NEDEN AYRI MODÜL ──────────────────────────────────────────────────────
 * Bu dosyada tek satır protokol mantığı yoktur: `lonTalk.ts` teli çözer, bu
 * dosya kullanıcının BİLDİRDİĞİ tipe göre ham sayıyı mühendislik değerine
 * çevirir. İkisi ayrı yaşar çünkü tel ile tip arasında hiçbir bağ YOKTUR
 * (aşağıdaki uyarı) ve tablo kaynağı bambaşkadır.
 *
 * ── ÇIKARMA TURU (2026-08-26) ─────────────────────────────────────────────
 * Kaynak: LonMark International'ın kendi çevrimiçi kaynak dosyası gezgini,
 * `https://www.lonmark.org/nvs/` — 221 tipin HER BİRİNİN kendi sayfası bu
 * dalgada indirildi (`.?id=<SNVT adı>`) ve şu alanlar ayrıştırıldı: `Index`,
 * `Obsolete`, `Size`, `Neuron C Type`, `Minimum`, `Maximum`,
 * `Scaling (A,B,C)`, `Resolution`. Tablo ELLE YAZILMADI, çıkarıldı.
 *
 * Aşağıdaki liste 221 tipten **75'idir**. Süzgeç (dalga 16b'nin *"yalnız
 * ikinci bağımsız kaynakta teyitli komutlar çözülür"* disiplininin aynısı):
 *   · `Neuron C Type` SKALER olmalı — `signed/unsigned long|short`.
 *     `Structure` (88 tip) ve `float` (28 tip) ve enum tipleri ALINMADI:
 *     alan kırılımı ayrı bir iştir, ölçek üçlüsü onlarda anlamsızdır.
 *   · `Scaling (A,B,C)` ÜÇÜ DE DOLU ve sayısal olmalı.
 *   · `Obsolete: no` olmalı (7 tip bu yüzden düştü).
 *
 * ── 🚨 ÖLÇEK FORMÜLÜ: `A × 10^B × (ham + C)` ──────────────────────────────
 * LonMark'ın kendi ifadesi (her tip sayfasında *"Scaled value"* satırı):
 * `A *10^B *(Raw+C)`. **`(A × 10^B) × ham + C` DEĞİLDİR** ve bu ayrım
 * `SNVT_temp`te (A=1, B=−1, C=−2740) sonucu **~2466 °C** kaydırır:
 * doğru okuma `0.1 × (202 − 2740) = −253.8 °C`, yanlış okuma
 * `0.1 × 202 − 2740 = −2719.8 °C`. **Hata VERMEZ, yanlış sıcaklık basar** —
 * `arinc-429`in bit sırası tuzağıyla (15f) aynı sınıf. `snvtTypes.test.ts`
 * iki formülü de hesaplayıp AYRIŞTIKLARINI assert eder.
 *
 * ── ⚠ TİP TELDE YOKTUR ────────────────────────────────────────────────────
 * Bu tablonun varlığı bir tipin ÇIKARILABİLDİĞİ anlamına GELMEZ. LonTalk NV
 * mesajı yalnız 14 bitlik bir **selector** taşır; selector cihazın bağlama
 * tablosundaki bir indekstir ve hangi SNVT'ye karşılık geldiği cihazın XIF'i
 * ya da ağ yönetim aracındadır. Aynı iki bayt (`00 CA`) bu tabloyla beş ayrı
 * mühendislik değeri verir: `SNVT_temp` −253.8 °C · `SNVT_temp_p` 2.02 °C ·
 * `SNVT_lev_percent` 1.01 % · `SNVT_amp` 20.2 A · `SNVT_count` 202.
 * **Tipi tahmin etmek bu beşi arasında seçim yapmaktır.** Bu yüzden tip
 * `decodeOptions` kanalıdır, seçilmediğinde değer HAM kalır ve seçilse bile
 * `nvTypeNotOnWire` uyarısı KOŞULSUZ basılır. Deponun kendi spec'inin KNX
 * ilkesi birebir aynıdır (`docs/spec/ozet/07-bina-otomasyonu.md:446`).
 *
 * ── BAYT SIRASI: BIG-ENDIAN ───────────────────────────────────────────────
 * İki kaynak: `izot/lon-stack-dx` `include/izot/lon_types.h`
 * (`IZOT_GET_UNSIGNED_WORD(n) = ((n).msb << 8) + (n).lsb`) ve normatif
 * LonTalk Protocol Specification v3.0 §10.4 (*"Any long or quad quantities
 * stored in the APDU are stored with the most significant bit on the left"*).
 * Aynı spec'in Appendix A §13.1'indeki *"least significant first"* ifadesi
 * BAYT SIRASI DEĞİL, fiziksel katmanın bit/bayt iletim çizim kuralıdır —
 * little-endian yazmak hata VERMEDEN ters sayı basar.
 */

/** Ölçek üçlüsü DOLU, skaler, güncel bir SNVT tipi. */
export interface SnvtScalarType {
  /** LonMark programmatic name; VERİDİR, çeviriye girmez. */
  readonly name: string;
  /** SNVT indeksi — self-identification'da kullanılan sayı. */
  readonly index: number;
  /** Tel üzerindeki bayt sayısı (1 ya da 2). */
  readonly size: 1 | 2;
  readonly signed: boolean;
  /** `A × 10^B × (ham + C)` üçlüsü. */
  readonly a: number;
  readonly b: number;
  readonly c: number;
  /**
   * Fiziksel birim — YALNIZ gerçekten boyutlu tiplerde vardır
   * (`types.ts:46`: `unit` yalnız gerçek fiziksel değere). `SNVT_count`,
   * `SNVT_address`, `SNVT_multiplier`, `SNVT_pwr_fact`, `SNVT_sched_val`,
   * `SNVT_log_request`, `SNVT_lux_2` gibi boyutsuz tiplerde YOKTUR.
   */
  readonly unit?: string;
}

/** `nvPayloadType` seçilmediğinde: ham sayı basılır, ölçek uygulanmaz. */
export const SNVT_RAW = 'raw';

/**
 * 75 skaler tip, SNVT indeksine göre sıralı. Doğrudan `lonmark.org/nvs/`den
 * çıkarıldı (dosya başı) — elle "sadeleştirme" yapılmaz, bir değer
 * değiştirilirse `snvtTypes.test.ts`in fixture'ları tutmaz.
 */
export const SNVT_SCALAR_TYPES: readonly SnvtScalarType[] = [
  { name: 'SNVT_amp', index: 1, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'A' },
  { name: 'SNVT_amp_mil', index: 2, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'mA' },
  { name: 'SNVT_angle', index: 3, size: 2, signed: false, a: 1, b: -3, c: 0, unit: 'rad' },
  { name: 'SNVT_angle_vel', index: 4, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'rad/s' },
  { name: 'SNVT_btu_kilo', index: 5, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'kBtu' },
  { name: 'SNVT_btu_mega', index: 6, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'MBtu' },
  { name: 'SNVT_count', index: 8, size: 2, signed: false, a: 1, b: 0, c: 0 },
  { name: 'SNVT_count_inc', index: 9, size: 2, signed: true, a: 1, b: 0, c: 0 },
  { name: 'SNVT_elec_kwh', index: 13, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'kWh' },
  { name: 'SNVT_elec_whr', index: 14, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'Wh' },
  { name: 'SNVT_flow', index: 15, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'l/s' },
  { name: 'SNVT_flow_mil', index: 16, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'ml/s' },
  { name: 'SNVT_length', index: 17, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'm' },
  { name: 'SNVT_length_kilo', index: 18, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'km' },
  { name: 'SNVT_length_micr', index: 19, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'µm' },
  { name: 'SNVT_length_mil', index: 20, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'mm' },
  { name: 'SNVT_lev_cont', index: 21, size: 1, signed: false, a: 5, b: -1, c: 0, unit: '%' },
  { name: 'SNVT_mass', index: 23, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'g' },
  { name: 'SNVT_mass_kilo', index: 24, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'kg' },
  { name: 'SNVT_mass_mega', index: 25, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 't' },
  { name: 'SNVT_mass_mil', index: 26, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'mg' },
  { name: 'SNVT_power', index: 27, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'W' },
  { name: 'SNVT_power_kilo', index: 28, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'kW' },
  { name: 'SNVT_ppm', index: 29, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'ppm' },
  { name: 'SNVT_press', index: 30, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'kPa' },
  { name: 'SNVT_res', index: 31, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'Ω' },
  { name: 'SNVT_res_kilo', index: 32, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'kΩ' },
  { name: 'SNVT_sound_db', index: 33, size: 2, signed: true, a: 1, b: -2, c: 0, unit: 'dB' },
  { name: 'SNVT_speed', index: 34, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'm/s' },
  { name: 'SNVT_speed_mil', index: 35, size: 2, signed: false, a: 1, b: -3, c: 0, unit: 'm/s' },
  { name: 'SNVT_temp', index: 39, size: 2, signed: false, a: 1, b: -1, c: -2740, unit: '°C' },
  { name: 'SNVT_vol', index: 41, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'l' },
  { name: 'SNVT_vol_kilo', index: 42, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'kl' },
  { name: 'SNVT_vol_mil', index: 43, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'ml' },
  { name: 'SNVT_volt', index: 44, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'V' },
  { name: 'SNVT_volt_dbmv', index: 45, size: 2, signed: true, a: 1, b: -2, c: 0, unit: 'dBµV' },
  { name: 'SNVT_volt_kilo', index: 46, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'kV' },
  { name: 'SNVT_volt_mil', index: 47, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'mV' },
  { name: 'SNVT_grammage', index: 71, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'g/m²' },
  { name: 'SNVT_freq_hz', index: 76, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'Hz' },
  { name: 'SNVT_freq_kilohz', index: 77, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 'kHz' },
  { name: 'SNVT_freq_milhz', index: 78, size: 2, signed: false, a: 1, b: -4, c: 0, unit: 'Hz' },
  { name: 'SNVT_lux', index: 79, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'lx' },
  { name: 'SNVT_lev_percent', index: 81, size: 2, signed: true, a: 5, b: -3, c: 0, unit: '%' },
  { name: 'SNVT_multiplier', index: 82, size: 2, signed: false, a: 5, b: -4, c: 0 },
  { name: 'SNVT_pwr_fact', index: 98, size: 2, signed: true, a: 5, b: -5, c: 0 },
  { name: 'SNVT_density', index: 100, size: 2, signed: false, a: 5, b: -1, c: 0, unit: 'kg/m³' },
  { name: 'SNVT_rpm', index: 102, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'rpm' },
  { name: 'SNVT_angle_deg', index: 104, size: 2, signed: true, a: 2, b: -2, c: 0, unit: '°' },
  { name: 'SNVT_temp_p', index: 105, size: 2, signed: true, a: 1, b: -2, c: 0, unit: '°C' },
  { name: 'SNVT_time_sec', index: 107, size: 2, signed: false, a: 1, b: -1, c: 0, unit: 's' },
  { name: 'SNVT_area', index: 110, size: 2, signed: false, a: 2, b: -4, c: 0, unit: 'm²' },
  { name: 'SNVT_press_p', index: 113, size: 2, signed: true, a: 1, b: 0, c: 0, unit: 'Pa' },
  { name: 'SNVT_address', index: 114, size: 2, signed: false, a: 1, b: 0, c: 0 },
  { name: 'SNVT_time_min', index: 123, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'min' },
  { name: 'SNVT_time_hour', index: 124, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'h' },
  { name: 'SNVT_ph', index: 125, size: 2, signed: true, a: 1, b: -3, c: 0, unit: 'pH' },
  { name: 'SNVT_smo_obscur', index: 129, size: 2, signed: false, a: 1, b: -3, c: 0, unit: '%' },
  { name: 'SNVT_temp_ror', index: 131, size: 2, signed: true, a: 5, b: -1, c: 0, unit: '°C/min' },
  { name: 'SNVT_volt_ac', index: 138, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'V' },
  { name: 'SNVT_amp_ac', index: 139, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'A' },
  { name: 'SNVT_turbidity', index: 143, size: 2, signed: false, a: 1, b: -3, c: 0, unit: 'NTU' },
  { name: 'SNVT_temp_diff_p', index: 147, size: 2, signed: true, a: 1, b: -2, c: 0, unit: '°C' },
  { name: 'SNVT_enthalpy', index: 153, size: 2, signed: true, a: 1, b: -2, c: 0, unit: 'kJ/kg' },
  { name: 'SNVT_abs_humid', index: 160, size: 2, signed: false, a: 1, b: -2, c: 0, unit: 'g/kg' },
  { name: 'SNVT_flow_p', index: 161, size: 2, signed: false, a: 1, b: -2, c: 0, unit: 'm³/h' },
  { name: 'SNVT_sched_val', index: 177, size: 1, signed: false, a: 1, b: 0, c: 0 },
  { name: 'SNVT_multiplier_s', index: 188, size: 1, signed: false, a: 1, b: -2, c: 0 },
  { name: 'SNVT_log_request', index: 195, size: 2, signed: false, a: 1, b: 0, c: 0 },
  { name: 'SNVT_enthalpy_d', index: 196, size: 2, signed: true, a: 1, b: -2, c: 0, unit: 'kJ/kg' },
  { name: 'SNVT_amp_ac_mil', index: 197, size: 2, signed: false, a: 1, b: 0, c: 0, unit: 'mA' },
  { name: 'SNVT_Wm2_p', index: 204, size: 2, signed: false, a: 5, b: -2, c: 0, unit: 'W/m²' },
  { name: 'SNVT_time_offset', index: 210, size: 2, signed: true, a: 1, b: 0, c: 0, unit: 's' },
  { name: 'SNVT_mass_flow', index: 213, size: 2, signed: true, a: 1, b: -1, c: 0, unit: 'kg/h' },
  { name: 'SNVT_lux_2', index: 224, size: 2, signed: false, a: 5, b: 0, c: 0 },];

const SNVT_TYPES_BY_NAME = new Map(SNVT_SCALAR_TYPES.map((type) => [type.name, type]));

export function findSnvtType(name: string): SnvtScalarType | undefined {
  return SNVT_TYPES_BY_NAME.get(name);
}

/**
 * Ham baytları tipin işaretine ve boyuna göre TAM SAYIYA çevirir.
 * Big-endian (dosya başı). Uzunluk uymuyorsa `undefined` — çağıran uyarı
 * basar, uydurma bir değer üretmez.
 */
export function readSnvtRawValue(bytes: Uint8Array, type: SnvtScalarType): number | undefined {
  if (bytes.length !== type.size) return undefined;
  // noUncheckedIndexedAccess: sabit boylu dizide bile tip `number | undefined`.
  const high = bytes[0];
  if (high === undefined) return undefined;
  if (type.size === 1) {
    return type.signed && high > 0x7f ? high - 0x100 : high;
  }
  const low = bytes[1];
  if (low === undefined) return undefined;
  const raw = (high << 8) | low;
  return type.signed && raw > 0x7fff ? raw - 0x10000 : raw;
}

/**
 * `A × 10^B × (ham + C)` — parantez KRİTİK (dosya başı).
 *
 * Sonuç tipin çözünürlüğüne (`A × 10^B`) yuvarlanır: kayan nokta aritmetiği
 * `0.01 × 202`yi `2.0199999999999996` yapar ve ekranda o basılırdı. Ondalık
 * hane sayısı `B`den gelir; katalogdaki 75 tipin hepsinde `A` tam sayıdır.
 */
export function applySnvtScale(rawValue: number, type: SnvtScalarType): number {
  const scaled = type.a * Math.pow(10, type.b) * (rawValue + type.c);
  const decimals = Math.max(0, -type.b);
  const factor = Math.pow(10, decimals);
  return Math.round(scaled * factor) / factor;
}
