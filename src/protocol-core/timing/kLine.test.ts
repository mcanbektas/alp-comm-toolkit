import { describe, expect, it } from 'vitest';

import {
  calculateFastInitPulse,
  calculateFiveBaudInit,
  evaluateTimingWindow,
} from './kLine';

const MILLISECOND = 1e-3;

describe('calculateFiveBaudInit', () => {
  it('varsayılan 8N1 karakter 10 bit, 5 bit/s’de 2 saniye sürer', () => {
    const result = calculateFiveBaudInit();
    expect(result.bitsPerCharacter).toBe(10);
    expect(result.addressByteDurationSeconds).toBeCloseTo(2, 12);
  });

  /** 5 baud'un tanımı `1/5` s — `calculateUartTiming`den bağımsız ikinci hesap. */
  it('bit süresi 1/5 saniyedir', () => {
    const result = calculateFiveBaudInit();
    expect(result.bitTimeSeconds).toBeCloseTo(0.2, 12);
    expect(result.bitTimeSeconds * result.bitsPerCharacter).toBeCloseTo(
      result.addressByteDurationSeconds,
      12,
    );
  });

  it('parity biti eklenince karakter süresi uzar (11 bit)', () => {
    const result = calculateFiveBaudInit({ parity: 'even' });
    expect(result.bitsPerCharacter).toBe(11);
    expect(result.addressByteDurationSeconds).toBeCloseTo(2.2, 12);
  });

  it('7 veri biti + 2 stop biti gibi alternatif çerçeveler de kabul edilir', () => {
    const result = calculateFiveBaudInit({ dataBits: 7, stopBits: 2 });
    // 1 start + 7 data + 0 parity + 2 stop = 10 bit — aynı toplam, farklı dağılım.
    expect(result.bitsPerCharacter).toBe(10);
  });
});

describe('calculateFastInitPulse', () => {
  it('iki darbenin toplamını verir (25 ms + 25 ms örneği)', () => {
    const result = calculateFastInitPulse({
      lowPulseSeconds: 25 * MILLISECOND,
      highPulseSeconds: 25 * MILLISECOND,
    });
    expect(result.totalDurationSeconds).toBeCloseTo(50 * MILLISECOND, 12);
  });

  it('asimetrik darbeler de toplanır', () => {
    const result = calculateFastInitPulse({
      lowPulseSeconds: 25 * MILLISECOND,
      highPulseSeconds: 25 * MILLISECOND,
    });
    const asymmetric = calculateFastInitPulse({
      lowPulseSeconds: 60 * MILLISECOND,
      highPulseSeconds: 30 * MILLISECOND,
    });
    expect(asymmetric.totalDurationSeconds).toBeCloseTo(90 * MILLISECOND, 12);
    expect(asymmetric.totalDurationSeconds).not.toBeCloseTo(result.totalDurationSeconds, 12);
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() => calculateFastInitPulse({ lowPulseSeconds: 0, highPulseSeconds: 0.01 })).toThrow(
      RangeError,
    );
    expect(() => calculateFastInitPulse({ lowPulseSeconds: 0.01, highPulseSeconds: -1 })).toThrow(
      RangeError,
    );
  });
});

describe('evaluateTimingWindow', () => {
  it('pencere içindeyse withinWindow true döner', () => {
    const result = evaluateTimingWindow({
      measuredSeconds: 3 * MILLISECOND,
      minSeconds: 1 * MILLISECOND,
      maxSeconds: 5 * MILLISECOND,
    });
    expect(result).toMatchObject({ belowMinimum: false, aboveMaximum: false, withinWindow: true });
  });

  it('asgarinin altı belowMinimum işaretler', () => {
    const result = evaluateTimingWindow({
      measuredSeconds: 0.5 * MILLISECOND,
      minSeconds: 1 * MILLISECOND,
      maxSeconds: 5 * MILLISECOND,
    });
    expect(result.belowMinimum).toBe(true);
    expect(result.withinWindow).toBe(false);
  });

  it('azaminin üstü aboveMaximum işaretler', () => {
    const result = evaluateTimingWindow({
      measuredSeconds: 6 * MILLISECOND,
      minSeconds: 1 * MILLISECOND,
      maxSeconds: 5 * MILLISECOND,
    });
    expect(result.aboveMaximum).toBe(true);
    expect(result.withinWindow).toBe(false);
  });

  it('sınır değerler (min ve max) pencere içi sayılır', () => {
    expect(
      evaluateTimingWindow({ measuredSeconds: 1 * MILLISECOND, minSeconds: 1 * MILLISECOND, maxSeconds: 5 * MILLISECOND })
        .withinWindow,
    ).toBe(true);
    expect(
      evaluateTimingWindow({ measuredSeconds: 5 * MILLISECOND, minSeconds: 1 * MILLISECOND, maxSeconds: 5 * MILLISECOND })
        .withinWindow,
    ).toBe(true);
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() =>
      evaluateTimingWindow({ measuredSeconds: -1, minSeconds: 0, maxSeconds: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      evaluateTimingWindow({ measuredSeconds: 0, minSeconds: 5, maxSeconds: 1 }),
    ).toThrow(RangeError);
  });
});
