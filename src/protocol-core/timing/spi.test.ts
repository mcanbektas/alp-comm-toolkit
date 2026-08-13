import { describe, expect, it } from 'vitest';

import {
  calculateSpiTransactionTiming,
  calculateSpiTransferTime,
  ospiThroughput,
  qspiThroughput,
  resolveSpiMode,
} from './spi';

describe('resolveSpiMode', () => {
  it.each([
    [0, 0, 'mode0'],
    [0, 1, 'mode1'],
    [1, 0, 'mode2'],
    [1, 1, 'mode3'],
  ] as const)('CPOL=%s CPHA=%s → %s', (cpol, cpha, expected) => {
    expect(resolveSpiMode(cpol, cpha)).toBe(expected);
  });
});

describe('calculateSpiTransferTime', () => {
  it('ZORUNLU fixture: 32 clock bit, 10 MHz → 3.2 µs', () => {
    const result = calculateSpiTransferTime({ totalClockBits: 32, clockFrequencyHz: 10_000_000 });

    expect(result.transferTimeSeconds).toBeCloseTo(3.2e-6, 12);
  });

  it('clockFrequencyHz sıfır ya da negatifse hata fırlatır', () => {
    expect(() => calculateSpiTransferTime({ totalClockBits: 8, clockFrequencyHz: 0 })).toThrow(
      RangeError,
    );
  });
});

describe('calculateSpiTransactionTiming', () => {
  it('verilen tüm fazları toplar, verilmeyenleri 0 kabul eder', () => {
    const result = calculateSpiTransactionTiming({
      setupSeconds: 1e-6,
      commandSeconds: 0.8e-6,
      addressSeconds: 2.4e-6,
      payloadSeconds: 25.6e-6,
      // dummySeconds, crcSeconds, holdSeconds verilmedi → 0 kabul edilir.
    });

    expect(result.totalSeconds).toBeCloseTo(1e-6 + 0.8e-6 + 2.4e-6 + 25.6e-6, 12);
  });

  it('hiç faz verilmezse toplam 0 olur', () => {
    expect(calculateSpiTransactionTiming({}).totalSeconds).toBe(0);
  });
});

describe('qspiThroughput', () => {
  it('SDR Quad: 100 MHz → 400 Mbit/s', () => {
    const result = qspiThroughput({ clockFrequencyHz: 100_000_000 });

    expect(result.throughputBitsPerSecond).toBe(400_000_000);
  });
});

describe('ospiThroughput', () => {
  it('SDR: 100 MHz → 800 Mbit/s (8f)', () => {
    const result = ospiThroughput({ clockFrequencyHz: 100_000_000, dataRateMode: 'sdr' });

    expect(result.throughputBitsPerSecond).toBe(800_000_000);
  });

  it('ZORUNLU doğrulama: DDR 100 MHz → 1.6 Gbit/s (16f)', () => {
    const result = ospiThroughput({ clockFrequencyHz: 100_000_000, dataRateMode: 'ddr' });

    expect(result.throughputBitsPerSecond).toBe(1_600_000_000);
  });
});
