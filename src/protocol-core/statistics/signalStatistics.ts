/**
 * Sinyal istatistikleri — spec §37'nin "Min, Max, Average, RMS, Standard
 * deviation" listesi. Grafiğe bağlanan her sayısal alan için hesaplanır.
 *
 * Standart sapma ANAKÜTLE tanımıyla (N'e bölünür) hesaplanır; spec §39'un
 * σ = sqrt[ Σ(x−μ)² / N ] formülüyle aynı tanım olsun diye. Örneklem tanımı
 * (N−1) kullanılsaydı iki ekran aynı veriye farklı sapma gösterirdi.
 */

export interface SignalStatistics {
  readonly count: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly average: number | undefined;
  /** Karekök ortalama kare — işaret gücü ölçüsü, ortalamadan farklıdır. */
  readonly rms: number | undefined;
  readonly stdDev: number | undefined;
  readonly last: number | undefined;
}

export const EMPTY_SIGNAL_STATISTICS: SignalStatistics = {
  count: 0,
  min: undefined,
  max: undefined,
  average: undefined,
  rms: undefined,
  stdDev: undefined,
  last: undefined,
};

export function computeSignalStatistics(values: readonly number[]): SignalStatistics {
  let count = 0;
  let min: number | undefined;
  let max: number | undefined;
  let sum = 0;
  let sumOfSquares = 0;
  let last: number | undefined;

  for (const value of values) {
    // NaN/Infinity bir ölçüm değil, bozuk çözümlemedir; istatistiği zehirlememeli.
    if (!Number.isFinite(value)) {
      continue;
    }
    count += 1;
    sum += value;
    sumOfSquares += value * value;
    if (min === undefined || value < min) {
      min = value;
    }
    if (max === undefined || value > max) {
      max = value;
    }
    last = value;
  }

  if (count === 0) {
    return EMPTY_SIGNAL_STATISTICS;
  }

  const average = sum / count;
  const meanOfSquares = sumOfSquares / count;
  // σ² = E[x²] − (E[x])²; kayan pencere zaten sınırlı (birkaç bin nokta), bu
  // boyutta iptal hatası ölçülebilir değil ve tek geçiş daha ucuz.
  const variance = Math.max(0, meanOfSquares - average * average);

  return {
    count,
    min,
    max,
    average,
    rms: Math.sqrt(meanOfSquares),
    stdDev: Math.sqrt(variance),
    last,
  };
}
