import { describe, expect, it } from 'vitest';

import {
  UART_CHARACTER_BIT_TIMES,
  calculateCanBitBudget,
  calculateFlexrayChannels,
  calculateLinBreak,
  calculateParallelTermination,
  estimateBaudFromSyncSpan,
} from './vehiclePhy';

const MICROSECOND = 1e-6;
const NANOSECOND = 1e-9;

describe('calculateParallelTermination — spec CAN örneği', () => {
  /** Kaynağın kendi sayısı: iki uçta 120 Ω, enerjisiz bus'ta `120‖120 = 60 Ω`. */
  it('iki adet 120 ohm 60 ohm eşdeğer verir', () => {
    expect(calculateParallelTermination(120, 2)).toBe(60);
  });

  it('tek terminasyon direncin kendisidir', () => {
    expect(calculateParallelTermination(120, 1)).toBe(120);
  });

  /** Kaynağın "3 adet termination" entegrasyon hatasının ölçülebilir izi. */
  it('üçüncü direnç eşdeğeri 40 ohm’a düşürür', () => {
    expect(calculateParallelTermination(120, 3)).toBeCloseTo(40, 10);
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() => calculateParallelTermination(0, 2)).toThrow(RangeError);
    expect(() => calculateParallelTermination(120, 0)).toThrow(RangeError);
    expect(() => calculateParallelTermination(120, 1.5)).toThrow(RangeError);
  });
});

describe('calculateCanBitBudget', () => {
  const input = {
    // Spec'in CAN FD örneğindeki arbitrasyon hızı.
    bitrateBps: 500_000,
    samplePointPercent: 80,
    cableLengthMeters: 40,
    propagationVelocityMetersPerSecond: 2e8,
    transceiverDelaySeconds: 120 * NANOSECOND,
  };

  it('500 kbit/s bit süresi 2 µs, %80 sample point 1.6 µs', () => {
    const result = calculateCanBitBudget(input);
    expect(result.bitTimeSeconds).toBeCloseTo(2 * MICROSECOND, 12);
    expect(result.sampleTimeSeconds).toBeCloseTo(1.6 * MICROSECOND, 12);
  });

  it('kablo gecikmesi rs485 motorundan gelir (40 m / 2e8 = 200 ns)', () => {
    const result = calculateCanBitBudget(input);
    expect(result.cableDelaySeconds).toBeCloseTo(200 * NANOSECOND, 15);
  });

  it('round-trip kablo + transceiver + node gecikmesinin iki katıdır', () => {
    const result = calculateCanBitBudget({ ...input, nodeDelaySeconds: 30 * NANOSECOND });
    // 2 × (200 + 120 + 30) ns = 700 ns
    expect(result.roundTripDelaySeconds).toBeCloseTo(700 * NANOSECOND, 15);
  });

  it('bütçe yeterliyse pozitif marj bırakır', () => {
    const result = calculateCanBitBudget(input);
    // 1.6 µs − 2 × 320 ns = 960 ns
    expect(result.marginSeconds).toBeCloseTo(960 * NANOSECOND, 15);
    expect(result.withinBudget).toBe(true);
  });

  /** Spec'in CAN FD veri fazı hızı: aynı kabloda 2 Mbit/s bütçeyi bitirir. */
  it('2 Mbit/s veri fazında aynı kablo bütçeyi aşar', () => {
    const result = calculateCanBitBudget({ ...input, bitrateBps: 2_000_000 });
    expect(result.bitTimeSeconds).toBeCloseTo(0.5 * MICROSECOND, 12);
    expect(result.marginSeconds).toBeLessThan(0);
    expect(result.withinBudget).toBe(false);
  });

  it('uzun kablo aynı hızda bütçeyi aşar', () => {
    const result = calculateCanBitBudget({ ...input, cableLengthMeters: 500 });
    expect(result.cableDelaySeconds).toBeCloseTo(2.5 * MICROSECOND, 12);
    expect(result.withinBudget).toBe(false);
  });

  it('geçersiz bit hızı ve sample point RangeError verir', () => {
    expect(() => calculateCanBitBudget({ ...input, bitrateBps: 0 })).toThrow(RangeError);
    expect(() => calculateCanBitBudget({ ...input, samplePointPercent: 100 })).toThrow(RangeError);
    expect(() => calculateCanBitBudget({ ...input, samplePointPercent: 0 })).toThrow(RangeError);
  });
});

describe('calculateLinBreak', () => {
  it('19200 baud bit süresi ~52.08 µs', () => {
    const result = calculateLinBreak({ baudRate: 19200, breakBits: 13 });
    expect(result.bitTimeSeconds).toBeCloseTo(52.0833 * MICROSECOND, 9);
  });

  it('13 bitlik break 8N1 karakterden uzundur', () => {
    const result = calculateLinBreak({ baudRate: 19200, breakBits: 13 });
    expect(result.breakDurationSeconds).toBeCloseTo(13 / 19200, 12);
    expect(result.uartCharacterBitTimes).toBe(UART_CHARACTER_BIT_TIMES);
    expect(result.longerThanUartCharacter).toBe(true);
  });

  /**
   * Kaynak asgari bit sayısı VERMİYOR (LIN 2.x'in 13'ü koda gömülmedi) —
   * çağıran 10 bit derse motor bunu "karakterden uzun değil" diye işaretler.
   */
  it('10 bit ya da altı break karakterden ayırt edilemez', () => {
    expect(calculateLinBreak({ baudRate: 19200, breakBits: 10 }).longerThanUartCharacter).toBe(
      false,
    );
    expect(calculateLinBreak({ baudRate: 19200, breakBits: 9 }).longerThanUartCharacter).toBe(false);
  });

  it('LIN sınıfının uçları (1 kBd ve 20 kBd) hesaplanır', () => {
    expect(calculateLinBreak({ baudRate: 1000, breakBits: 13 }).bitTimeSeconds).toBeCloseTo(
      1e-3,
      12,
    );
    expect(calculateLinBreak({ baudRate: 20000, breakBits: 13 }).bitTimeSeconds).toBeCloseTo(
      50 * MICROSECOND,
      12,
    );
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() => calculateLinBreak({ baudRate: 0, breakBits: 13 })).toThrow(RangeError);
    expect(() => calculateLinBreak({ baudRate: 19200, breakBits: 0 })).toThrow(RangeError);
  });
});

describe('estimateBaudFromSyncSpan', () => {
  /** 19200 baud'da sekiz bitlik sync açıklığı 416.67 µs sürer; ölçüm oradan geri döner. */
  it('sekiz bitlik ölçümden baud’u geri verir', () => {
    expect(estimateBaudFromSyncSpan({ spanSeconds: 8 / 19200 })).toBeCloseTo(19200, 6);
  });

  it('bit sayısı dışarıdan verilebilir', () => {
    expect(estimateBaudFromSyncSpan({ spanSeconds: 10 / 9600, bitCount: 10 })).toBeCloseTo(9600, 6);
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() => estimateBaudFromSyncSpan({ spanSeconds: 0 })).toThrow(RangeError);
    expect(() => estimateBaudFromSyncSpan({ spanSeconds: 1e-3, bitCount: 0 })).toThrow(RangeError);
  });
});

describe('calculateFlexrayChannels', () => {
  const input = {
    // Kaynağın verdiği sınıf: 2.5–10 Mbit/s.
    bitrateBps: 10_000_000,
    frameBits: 200,
    channelADelaySeconds: 250 * NANOSECOND,
    channelBDelaySeconds: 400 * NANOSECOND,
  };

  it('10 Mbit/s bit süresi 100 ns, 200 bitlik çerçeve 20 µs', () => {
    const result = calculateFlexrayChannels(input);
    expect(result.bitTimeSeconds).toBeCloseTo(100 * NANOSECOND, 15);
    expect(result.frameDurationSeconds).toBeCloseTo(20 * MICROSECOND, 12);
  });

  it('skew iki kanal gecikmesinin mutlak farkıdır ve bit süresine çevrilir', () => {
    const result = calculateFlexrayChannels(input);
    expect(result.skewSeconds).toBeCloseTo(150 * NANOSECOND, 15);
    expect(result.skewBitTimes).toBeCloseTo(1.5, 10);
  });

  it('kanal sırası skew’i değiştirmez', () => {
    const swapped = calculateFlexrayChannels({
      ...input,
      channelADelaySeconds: input.channelBDelaySeconds,
      channelBDelaySeconds: input.channelADelaySeconds,
    });
    expect(swapped.skewSeconds).toBeCloseTo(150 * NANOSECOND, 15);
  });

  it('2.5 Mbit/s alt sınırında bit süresi 400 ns', () => {
    const result = calculateFlexrayChannels({ ...input, bitrateBps: 2_500_000 });
    expect(result.bitTimeSeconds).toBeCloseTo(400 * NANOSECOND, 15);
  });

  it('geçersiz girdi RangeError verir', () => {
    expect(() => calculateFlexrayChannels({ ...input, bitrateBps: 0 })).toThrow(RangeError);
    expect(() => calculateFlexrayChannels({ ...input, frameBits: 0 })).toThrow(RangeError);
  });
});
