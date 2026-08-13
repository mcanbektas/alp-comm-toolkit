import { describe, expect, it } from 'vitest';

import { buildSimulatedFrame } from '../../connection/mock/simulatedProtocol';
import { readSignalValue, readSignalValues, SIMULATED_SIGNAL_TAPS, type SignalTap } from './signalTaps';

const TEMPERATURE_TAP: SignalTap = {
  id: 'temperature',
  label: 'Temperature',
  byteOffset: 0,
  byteLength: 2,
  endianness: 'big',
  signed: true,
  scale: 0.1,
  offset: 0,
  unit: '°C',
  colorToken: '--series-1',
};

describe('readSignalValue', () => {
  it('ölçek uygulayarak fiziksel değeri verir', () => {
    // 0x00FA = 250 → 25.0 °C
    const bytes = Uint8Array.from([0x00, 0xfa]);

    expect(readSignalValue(bytes, TEMPERATURE_TAP)).toBeCloseTo(25, 10);
  });

  it('işaretli alanı iki tümleyen olarak çözer', () => {
    // 0xFF88 = -120 → -12.0 °C
    const bytes = Uint8Array.from([0xff, 0x88]);

    expect(readSignalValue(bytes, TEMPERATURE_TAP)).toBeCloseTo(-12, 10);
  });

  it('signed kapalıyken aynı baytlar büyük pozitif okunur', () => {
    const bytes = Uint8Array.from([0xff, 0x88]);

    // 0xFF88 = 65416 → ×0.1 = 6541.6
    expect(readSignalValue(bytes, { ...TEMPERATURE_TAP, signed: false })).toBeCloseTo(6541.6, 6);
  });

  it('küçük endian bayt sırasına uyar', () => {
    const bytes = Uint8Array.from([0xfa, 0x00]);

    expect(readSignalValue(bytes, { ...TEMPERATURE_TAP, endianness: 'little' })).toBeCloseTo(25, 10);
  });

  it('ofset uygulanır', () => {
    const bytes = Uint8Array.from([0x00, 0x00]);

    expect(readSignalValue(bytes, { ...TEMPERATURE_TAP, offset: -40 })).toBeCloseTo(-40, 10);
  });

  it('çerçeve kısaysa undefined verir — hata değil, "bu çerçevede yok"', () => {
    expect(readSignalValue(Uint8Array.from([0x00]), TEMPERATURE_TAP)).toBeUndefined();
    expect(readSignalValue(new Uint8Array(0), TEMPERATURE_TAP)).toBeUndefined();
  });

  it('negatif konum undefined verir', () => {
    const bytes = Uint8Array.from([0x00, 0xfa]);

    expect(readSignalValue(bytes, { ...TEMPERATURE_TAP, byteOffset: -1 })).toBeUndefined();
  });
});

describe('SIMULATED_SIGNAL_TAPS', () => {
  it('simülasyon çerçevesinden yazılan telemetriyi geri okur', () => {
    const frame = buildSimulatedFrame({
      temperatureDeciC: -125,
      voltageMilliV: 12_345,
      rpm: 1780,
    });

    const [temperature, voltage, rpm] = readSignalValues(frame, SIMULATED_SIGNAL_TAPS);

    expect(temperature).toBeCloseTo(-12.5, 10);
    expect(voltage).toBeCloseTo(12.345, 10);
    expect(rpm).toBe(1780);
  });

  it('üç musluk da tanımlıdır ve ayrı renk tokenı kullanır', () => {
    const tokens = SIMULATED_SIGNAL_TAPS.map((tap) => tap.colorToken);

    expect(SIMULATED_SIGNAL_TAPS).toHaveLength(3);
    expect(new Set(tokens).size).toBe(3);
  });
});
