/**
 * Periyot analizi — spec §35 "Periyot analizi". Çerçevelerin YAKALAMA
 * damgaları arasındaki farklar incelenir; alan içeriğine bakılmaz.
 *
 * Düzenlilik ölçütü DEĞİŞİM KATSAYISIDIR (sapma / ortalama), ham sapma değil:
 * 1 ms sapma 10 ms'lik bir periyotta düzensizlik, 10 s'lik bir periyotta
 * mükemmel düzenliliktir. Mutlak bir eşik yalnız bir hız aralığında doğru
 * olurdu.
 */

import { computeSignalStatistics } from '../statistics/signalStatistics';
import type { SignalStatistics } from '../statistics/signalStatistics';
import type { AnalysisFrame } from './types';

/** Bunun altındaki değişim katsayısı "periyodik" sayılır. */
export const PERIODIC_COEFFICIENT_THRESHOLD = 0.1;
const MIN_INTERVALS = 2;

export interface PeriodAnalysis {
  /** Ardışık çerçeveler arası süre istatistiği (ms). */
  readonly interval: SignalStatistics;
  /** Sapma / ortalama; ortalama 0 ya da örnek yetersizse `undefined`. */
  readonly coefficientOfVariation: number | undefined;
  /** Eşiğin altındaysa `true`; karar verilemiyorsa `undefined` — `false` DEĞİL. */
  readonly periodic: boolean | undefined;
  /** Damgası olan çerçeve sayısı. */
  readonly timedFrameCount: number;
}

export function analyzePeriod(frames: readonly AnalysisFrame[]): PeriodAnalysis {
  const times = frames
    .map((frame) => frame.timestamp)
    .filter((timestamp): timestamp is number => timestamp !== undefined);

  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push((times[i] ?? 0) - (times[i - 1] ?? 0));
  }

  const interval = computeSignalStatistics(intervals);
  const average = interval.average;
  const coefficientOfVariation =
    intervals.length < MIN_INTERVALS || average === undefined || average === 0
      ? undefined
      : (interval.stdDev ?? 0) / Math.abs(average);

  return {
    interval,
    coefficientOfVariation,
    periodic:
      coefficientOfVariation === undefined ? undefined : coefficientOfVariation < PERIODIC_COEFFICIENT_THRESHOLD,
    timedFrameCount: times.length,
  };
}
