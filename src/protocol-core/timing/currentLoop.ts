/**
 * Akım döngüsü (Current Loop / 4–20 mA) hesap motoru. Faz 10 dalga 11g.
 *
 * Dosya `timing/` altında: `rs485.ts` ve `logicLevels.ts` emsali — termination,
 * bias, unit load ve logic eşikleri de zamanlama değil ELEKTRİKSEL hesap ve
 * burada yaşıyor. Ayrı bir `electrical/` klasörü spec §6'nın klasör listesinden
 * sapmak olurdu (CLAUDE.md).
 *
 * ── Bu iki kaydın decode'u YOK, olmayacak da ───────────────────────────────
 * Current Loop ve 4–20 mA bilgiyi hat GERİLİMİ değil hat AKIMI üzerinden
 * taşır (`docs/spec/ozet/01-fiziksel-arayuzler.md:167`); ortada bayt akışı
 * yoktur. Katalogdaki emsal `wireless-iot.ts`in lora kaydıdır: `status:'partial'`,
 * `pluginId` YOK, motor `calculatorIds` üzerinden hesap aracı olarak bağlanır.
 * "Ready" demek bu iki sayfada da yalan olurdu — çözülecek çerçeve yok.
 *
 * ── Formüller kaynaktan birebir ────────────────────────────────────────────
 * - Ohm kanunu: `V = I × R` (örnek: 20 mA, 100 Ω → 2 V)
 * - Ölçekleme: `I = 4mA + 16mA × (x − x_min)/(x_max − x_min)`
 * - Tersi: `x = x_min + (x_max − x_min) × (I − 4mA)/16mA`
 *   (örnek: 0–250 bar aralığında 13.6 mA → 150 bar, normalize %60)
 * - 250 Ω shunt: 4 mA → 1 V, 20 mA → 5 V (yani 4–20 mA ↔ 1–5 V)
 * - Loop compliance: `V_supply ≥ V_transmitter + I×(R_wire + R_load) + V_margin`
 *   (örnek: 24 V besleme, transmitter min 10 V, kablo 100 Ω, giriş 250 Ω, 20 mA)
 *
 * ── Uydurulmayan şey: arıza eşikleri ───────────────────────────────────────
 * Kaynak arıza durumlarını sayıyor (Under-range, Normal, Over-range, Open Loop,
 * Short suspected, Sensor fault) ama **"yapılandırılabilir eşiklerle"** diyor ve
 * SAYI VERMİYOR. Bu yüzden `classifyLoopCurrent` yalnız 4 mA / 20 mA
 * sınırlarından türeyen üç durumu kendiliğinden verir; open-loop ve short
 * durumları için eşik ÇAĞIRANDAN gelir — verilmezse o durumlar hiç raporlanmaz.
 * (1-Wire'da Serial Number endianness'ının, RS-232'de gerilim aralığının
 * bırakıldığı disiplinin aynısı.)
 */

/** Canlı sıfır: 4 mA gerçek bir minimum ölçümdür, kopuk döngü değil. */
export const LOOP_MIN_MILLIAMPS = 4;
export const LOOP_MAX_MILLIAMPS = 20;
/** `20 − 4` — ölçekleme formülünün 16 mA'lik açıklığı. */
export const LOOP_SPAN_MILLIAMPS = LOOP_MAX_MILLIAMPS - LOOP_MIN_MILLIAMPS;

const MILLIAMPS_PER_AMP = 1000;

export interface LoopScalingRange {
  /** 4 mA'ya karşılık gelen mühendislik değeri (ör. 0 bar). */
  minValue: number;
  /** 20 mA'ya karşılık gelen mühendislik değeri (ör. 250 bar). */
  maxValue: number;
}

function assertRange(range: LoopScalingRange): void {
  if (range.maxValue === range.minValue) {
    throw new RangeError('ölçek aralığı sıfır olamaz: maxValue minValue ile aynı');
  }
}

/** `I = 4mA + 16mA × (x − x_min)/(x_max − x_min)`. Aralık dışındaki değer aralık dışı akım verir. */
export function currentFromEngineeringValue(value: number, range: LoopScalingRange): number {
  assertRange(range);
  const normalized = (value - range.minValue) / (range.maxValue - range.minValue);
  return LOOP_MIN_MILLIAMPS + LOOP_SPAN_MILLIAMPS * normalized;
}

/** `x = x_min + (x_max − x_min) × (I − 4mA)/16mA`. */
export function engineeringValueFromCurrent(
  milliamps: number,
  range: LoopScalingRange,
): number {
  assertRange(range);
  const normalized = (milliamps - LOOP_MIN_MILLIAMPS) / LOOP_SPAN_MILLIAMPS;
  return range.minValue + (range.maxValue - range.minValue) * normalized;
}

/**
 * Akımın 4–20 mA açıklığındaki oranı (0…1). Aralık dışında bilerek kırpılmaz:
 * %-6 ya da %104 sonucu, under/over-range durumunun kendisidir.
 */
export function normalizedFromCurrent(milliamps: number): number {
  return (milliamps - LOOP_MIN_MILLIAMPS) / LOOP_SPAN_MILLIAMPS;
}

/** Ohm kanunu, mA girdisiyle: `V = I × R`. Shunt/burden direnci ve kablo düşümü aynı formül. */
export function shuntVoltage(milliamps: number, ohms: number): number {
  if (ohms < 0) throw new RangeError('direnç negatif olamaz');
  return (milliamps / MILLIAMPS_PER_AMP) * ohms;
}

export interface LoopComplianceInput {
  supplyVolts: number;
  /** Transmitter'ın çalışabilmesi için üzerinde kalması gereken en düşük gerilim. */
  transmitterMinVolts: number;
  cableOhms: number;
  /** Alıcı/shunt direnci (ör. 250 Ω). */
  loadOhms: number;
  loopCurrentMilliamps: number;
  /** Kaynağın formülündeki `V_margin`; SAYI VERMİYOR, çağıran belirler (varsayılan 0). */
  marginVolts?: number;
}

export interface LoopComplianceResult {
  cableDropVolts: number;
  loadDropVolts: number;
  /** `V_transmitter + I×(R_wire + R_load) + V_margin`. */
  requiredVolts: number;
  /** `V_supply − requiredVolts`; negatifse döngü kapanmaz. */
  remainingComplianceVolts: number;
  sufficient: boolean;
}

/** Spec fixture: 24 V, transmitter 10 V, 100 Ω kablo, 250 Ω giriş, 20 mA → 17 V gerekir, 7 V artar. */
export function calculateLoopCompliance(input: LoopComplianceInput): LoopComplianceResult {
  if (input.loopCurrentMilliamps < 0) throw new RangeError('döngü akımı negatif olamaz');

  const cableDropVolts = shuntVoltage(input.loopCurrentMilliamps, input.cableOhms);
  const loadDropVolts = shuntVoltage(input.loopCurrentMilliamps, input.loadOhms);
  const requiredVolts =
    input.transmitterMinVolts + cableDropVolts + loadDropVolts + (input.marginVolts ?? 0);
  const remainingComplianceVolts = input.supplyVolts - requiredVolts;

  return {
    cableDropVolts,
    loadDropVolts,
    requiredVolts,
    remainingComplianceVolts,
    sufficient: remainingComplianceVolts >= 0,
  };
}

export type LoopCurrentState =
  | 'open-loop'
  | 'under-range'
  | 'normal'
  | 'over-range'
  | 'short-suspected';

export interface LoopFaultThresholds {
  /** Bu değerin ALTI kopuk döngü sayılır. Verilmezse `open-loop` HİÇ raporlanmaz. */
  openLoopBelowMilliamps?: number;
  /** Bu değerin ÜSTÜ kısa devre şüphesi sayılır. Verilmezse `short-suspected` HİÇ raporlanmaz. */
  shortAboveMilliamps?: number;
}

/**
 * Akımı duruma çevirir. Under/normal/over ayrımı 4 mA ve 20 mA sınırlarından
 * gelir (kaynağın verdiği tek sayılar); kopuk döngü ve kısa devre eşikleri
 * çağırandan gelmezse o durumlar üretilmez — kaynak sayı vermiyor, uydurulmuyor.
 */
export function classifyLoopCurrent(
  milliamps: number,
  thresholds: LoopFaultThresholds = {},
): LoopCurrentState {
  const { openLoopBelowMilliamps, shortAboveMilliamps } = thresholds;

  if (openLoopBelowMilliamps !== undefined && milliamps < openLoopBelowMilliamps) {
    return 'open-loop';
  }
  if (shortAboveMilliamps !== undefined && milliamps > shortAboveMilliamps) {
    return 'short-suspected';
  }
  if (milliamps < LOOP_MIN_MILLIAMPS) return 'under-range';
  if (milliamps > LOOP_MAX_MILLIAMPS) return 'over-range';
  return 'normal';
}
