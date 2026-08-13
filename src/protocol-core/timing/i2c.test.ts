import { describe, expect, it } from 'vitest';

import {
  calculateI2cPullUpRange,
  calculateI2cRiseTime,
  calculateI2cTransferTime,
  encodeI2c7BitAddress,
} from './i2c';

describe('calculateI2cTransferTime', () => {
  it('ZORUNLU fixture: 400 kHz, 10 byte (START/STOP hariç) → 225 µs', () => {
    const result = calculateI2cTransferTime({ sclFrequencyHz: 400_000, byteCount: 10 });

    expect(result.totalClockCount).toBe(90);
    expect(result.transferTimeSeconds).toBeCloseTo(225e-6, 12);
  });

  it('sclFrequencyHz sıfır ya da negatifse hata fırlatır', () => {
    expect(() => calculateI2cTransferTime({ sclFrequencyHz: 0, byteCount: 1 })).toThrow(
      RangeError,
    );
  });
});

describe('encodeI2c7BitAddress', () => {
  it('ZORUNLU fixture: address=0x68 → write=0xD0, read=0xD1', () => {
    const result = encodeI2c7BitAddress(0x68);

    expect(result.writeByte).toBe(0xd0);
    expect(result.readByte).toBe(0xd1);
  });

  it('7-bit aralığı dışındaki adres için hata fırlatır', () => {
    expect(() => encodeI2c7BitAddress(0x80)).toThrow(RangeError);
    expect(() => encodeI2c7BitAddress(-1)).toThrow(RangeError);
  });
});

describe('calculateI2cRiseTime', () => {
  it('R=4700 Ω, C=100 pF için rise time hesabı', () => {
    // Elle doğrulama: 0.8473 × 4700 × 100e-12 = 398.231 ns.
    const result = calculateI2cRiseTime({ pullUpOhms: 4700, busCapacitanceFarads: 100e-12 });

    expect(result.riseTimeSeconds).toBeCloseTo(398.231e-9, 14);
  });
});

describe('calculateI2cPullUpRange', () => {
  it('makul Standard-Mode benzeri girdilerle üst/alt pull-up sınırlarını hesaplar', () => {
    // Girdi: maxRiseTime=1000 ns, C_bus=100 pF, V_DD=3.3V, V_OL_max=0.4V, I_OL=3 mA.
    // Elle doğrulama:
    //   R_max = 1000e-9 / (0.8473 × 100e-12) ≈ 11802.195 Ω
    //   R_min = (3.3 − 0.4) / 0.003 = 2.9 / 0.003 ≈ 966.667 Ω
    const result = calculateI2cPullUpRange({
      maxRiseTimeSeconds: 1000e-9,
      busCapacitanceFarads: 100e-12,
      supplyVoltage: 3.3,
      outputLowMaxVoltage: 0.4,
      outputLowMaxCurrentAmps: 3e-3,
    });

    expect(result.maxPullUpOhms).toBeCloseTo(11802.195208308744, 6);
    expect(result.minPullUpOhms).toBeCloseTo(966.6666666666666, 6);
    // Aralık geçerli: alt sınır üst sınırdan küçük, kullanılabilir bir bant var.
    expect(result.minPullUpOhms).toBeLessThan(result.maxPullUpOhms);
  });

  it('geçersiz bus kapasitansı ya da sink akımında hata fırlatır', () => {
    expect(() =>
      calculateI2cPullUpRange({
        maxRiseTimeSeconds: 1000e-9,
        busCapacitanceFarads: 0,
        supplyVoltage: 3.3,
        outputLowMaxVoltage: 0.4,
        outputLowMaxCurrentAmps: 3e-3,
      }),
    ).toThrow(RangeError);
  });
});
