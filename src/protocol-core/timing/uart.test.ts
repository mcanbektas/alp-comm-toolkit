import { describe, expect, it } from 'vitest';

import { calculateUartTiming } from './uart';

describe('calculateUartTiming', () => {
  it('ZORUNLU fixture: 115200 baud 8N1, 20 baytlık paket ≈ 1.736 ms', () => {
    const result = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      packetBytes: 20,
    });

    expect(result.bitsPerCharacter).toBe(10);
    // Spec: 20 × 10 / 115200 = 1.7361 ms, ±0.001 ms tolerans.
    expect(Math.abs(result.packetTimeSeconds! - 1.736e-3)).toBeLessThanOrEqual(1e-6);
  });

  it('115200 baud için karakter süresi ve azami byte hızı', () => {
    const result = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    // 10/115200 ≈ 86.806 µs
    expect(Math.abs(result.characterTimeSeconds - 86.806e-6)).toBeLessThanOrEqual(1e-9);
    expect(result.maxByteRate).toBeCloseTo(11520, 5);
    expect(result.packetTimeSeconds).toBeUndefined();
    expect(result.maxPacketRate).toBeUndefined();
  });

  it('parity biti karakter uzunluğuna 1 bit ekler (8E1 → 11 bit)', () => {
    const result = calculateUartTiming({
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'even',
    });

    expect(result.bitsPerCharacter).toBe(11);
  });

  it('maxPacketRate paket süresinin tersidir', () => {
    const result = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      packetBytes: 20,
    });

    expect(result.maxPacketRate).toBeCloseTo(1 / result.packetTimeSeconds!, 6);
  });

  it('efficiency yalnız payloadBytes VE packetBytes birlikte verildiğinde hesaplanır', () => {
    const withEfficiency = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      packetBytes: 20,
      payloadBytes: 16,
    });
    expect(withEfficiency.efficiencyPercent).toBeCloseTo(80, 6);

    const withoutPayload = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      packetBytes: 20,
    });
    expect(withoutPayload.efficiencyPercent).toBeUndefined();
  });

  it('baud error ve yüzdesini hedeften sapmaya göre hesaplar', () => {
    // Spec örneği: hedef 115200, gerçek 115107 → Error=-93, Error%≈-0.0807%.
    const result = calculateUartTiming({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      actualBaud: 115107,
    });

    expect(result.baudError).toBe(-93);
    expect(result.baudErrorPercent).toBeCloseTo(-0.0807, 3);
  });

  it('baudRate sıfır ya da negatifse hata fırlatır', () => {
    expect(() =>
      calculateUartTiming({ baudRate: 0, dataBits: 8, stopBits: 1, parity: 'none' }),
    ).toThrow(RangeError);
  });
});
