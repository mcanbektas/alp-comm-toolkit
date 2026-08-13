import { describe, expect, it } from 'vitest';

import {
  calculateRs485Bias,
  calculateRs485Propagation,
  calculateRs485Termination,
  calculateRs485UnitLoad,
  RS485_MAX_UNIT_LOADS,
} from './rs485';

describe('calculateRs485Propagation', () => {
  it('ZORUNLU fixture: 500 m / 2×10⁸ m/s → T_prop=2.5 µs, T_RT=5 µs', () => {
    const result = calculateRs485Propagation({
      cableLengthMeters: 500,
      propagationVelocityMetersPerSecond: 2e8,
    });

    expect(result.propagationDelaySeconds).toBeCloseTo(2.5e-6, 12);
    expect(result.roundTripDelaySeconds).toBeCloseTo(5e-6, 12);
  });

  it('negatif/sıfır yayılma hızında hata fırlatır', () => {
    expect(() =>
      calculateRs485Propagation({ cableLengthMeters: 100, propagationVelocityMetersPerSecond: 0 }),
    ).toThrow(RangeError);
  });
});

describe('calculateRs485Termination', () => {
  it('120 Ω × 120 Ω paralel sonlandırma 60 Ω verir (varsayılan termination)', () => {
    // Elle doğrulama: 1/(1/120+1/120) = 60; I = V/R = 5/60 = 0.08333...
    const result = calculateRs485Termination({ differentialVoltage: 5 });

    expect(result.effectiveResistanceOhms).toBe(60);
    expect(result.driverCurrentAmps).toBeCloseTo(5 / 60, 9);
  });

  it('açıkça verilen terminationOhms varsayılanı ezer', () => {
    // 60 Ω × 60 Ω paralel = 30 Ω.
    const result = calculateRs485Termination({ differentialVoltage: 3, terminationOhms: 60 });

    expect(result.effectiveResistanceOhms).toBe(30);
    expect(result.driverCurrentAmps).toBeCloseTo(0.1, 9);
  });
});

describe('calculateRs485Bias', () => {
  it('V_CC=5V, R_T=120Ω, R_B=560Ω için V_AB ve I_bias hesabı', () => {
    // Elle doğrulama: denom = 2×560+120 = 1240
    // V_AB = 5×120/1240 = 600/1240 = 0.483870967741935...
    // I_bias = 5/1240 = 0.004032258064516129...
    const result = calculateRs485Bias({
      supplyVoltage: 5,
      terminationOhms: 120,
      biasResistorOhms: 560,
    });

    expect(result.differentialBiasVoltage).toBeCloseTo(0.4838709677419355, 9);
    expect(result.biasCurrentAmps).toBeCloseTo(0.004032258064516129, 9);
  });
});

describe('calculateRs485UnitLoad', () => {
  it('32 UL sınırının altındayken withinLimit=true döner', () => {
    // 16 node × 1/8 UL = 2 UL toplam, sınırın çok altında.
    const nodes = Array.from({ length: 16 }, (_, index) => ({
      id: `node-${index}`,
      unitLoad: 0.125,
    }));

    const result = calculateRs485UnitLoad(nodes);

    expect(result.totalUnitLoad).toBeCloseTo(2, 9);
    expect(result.maximumAllowed).toBe(RS485_MAX_UNIT_LOADS);
    expect(result.withinLimit).toBe(true);
    expect(result.nodeCount).toBe(16);
  });

  it('32 UL sınırını aşınca withinLimit=false döner', () => {
    // 40 standart node × 1 UL = 40 UL, 32 sınırını aşar.
    const nodes = Array.from({ length: 40 }, (_, index) => ({
      id: `node-${index}`,
      unitLoad: 1,
    }));

    const result = calculateRs485UnitLoad(nodes);

    expect(result.totalUnitLoad).toBe(40);
    expect(result.withinLimit).toBe(false);
  });

  it('tam sınırda (32 UL) withinLimit=true döner (dahil eşik)', () => {
    const nodes = Array.from({ length: 32 }, (_, index) => ({ id: `node-${index}`, unitLoad: 1 }));

    const result = calculateRs485UnitLoad(nodes);

    expect(result.totalUnitLoad).toBe(32);
    expect(result.withinLimit).toBe(true);
  });
});
