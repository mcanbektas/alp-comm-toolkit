import { describe, expect, it } from 'vitest';

import { computeSignalStatistics, EMPTY_SIGNAL_STATISTICS } from './signalStatistics';

describe('computeSignalStatistics', () => {
  it('boş girdide her şey "bilinmiyor" olur', () => {
    expect(computeSignalStatistics([])).toEqual(EMPTY_SIGNAL_STATISTICS);
  });

  it('min, max, ortalama ve son değeri verir', () => {
    const stats = computeSignalStatistics([2, 8, 5]);

    expect(stats.count).toBe(3);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(8);
    expect(stats.average).toBeCloseTo(5, 10);
    expect(stats.last).toBe(5);
  });

  it('RMS ortalamadan farklıdır — işaret gücü ölçer', () => {
    // [3, 4] → ortalama 3.5; RMS = sqrt((9+16)/2) = sqrt(12.5) ≈ 3.5355
    const stats = computeSignalStatistics([3, 4]);

    expect(stats.average).toBeCloseTo(3.5, 10);
    expect(stats.rms).toBeCloseTo(Math.sqrt(12.5), 10);
  });

  it('işaret değişen değerlerde RMS ortalamadan büyüktür', () => {
    // [-5, 5] → ortalama 0, RMS 5
    const stats = computeSignalStatistics([-5, 5]);

    expect(stats.average).toBeCloseTo(0, 10);
    expect(stats.rms).toBeCloseTo(5, 10);
  });

  it('standart sapma anakütle tanımıyla (N) hesaplanır', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → μ = 5, σ = 2 (anakütle); örneklem tanımı 2.138 verirdi
    const stats = computeSignalStatistics([2, 4, 4, 4, 5, 5, 7, 9]);

    expect(stats.average).toBeCloseTo(5, 10);
    expect(stats.stdDev).toBeCloseTo(2, 10);
  });

  it('sabit dizide sapma sıfırdır', () => {
    const stats = computeSignalStatistics([7, 7, 7, 7]);

    expect(stats.stdDev).toBeCloseTo(0, 10);
    expect(stats.rms).toBeCloseTo(7, 10);
  });

  it('NaN ve Infinity değerlerini atar', () => {
    const stats = computeSignalStatistics([1, Number.NaN, 3, Number.POSITIVE_INFINITY]);

    expect(stats.count).toBe(2);
    expect(stats.average).toBeCloseTo(2, 10);
    expect(stats.max).toBe(3);
    expect(stats.last).toBe(3);
  });

  it('tümü geçersizse boş sonuç döner', () => {
    expect(computeSignalStatistics([Number.NaN, Number.NEGATIVE_INFINITY])).toEqual(
      EMPTY_SIGNAL_STATISTICS,
    );
  });

  it('tek elemanlı dizide sapma sıfır, min=max=ortalama', () => {
    const stats = computeSignalStatistics([42]);

    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.average).toBe(42);
    expect(stats.stdDev).toBeCloseTo(0, 10);
  });
});
