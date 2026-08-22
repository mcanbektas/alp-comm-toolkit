import { describe, expect, it } from 'vitest';

import {
  LOOP_MAX_MILLIAMPS,
  LOOP_MIN_MILLIAMPS,
  LOOP_SPAN_MILLIAMPS,
  calculateLoopCompliance,
  classifyLoopCurrent,
  currentFromEngineeringValue,
  engineeringValueFromCurrent,
  normalizedFromCurrent,
  shuntVoltage,
} from './currentLoop';

describe('sabitler — canlı sıfır', () => {
  it('4 mA ile 20 mA arası 16 mA açıklık', () => {
    expect(LOOP_MIN_MILLIAMPS).toBe(4);
    expect(LOOP_MAX_MILLIAMPS).toBe(20);
    expect(LOOP_SPAN_MILLIAMPS).toBe(16);
  });
});

describe('ölçekleme — spec fixture (0–250 bar, 13.6 mA → 150 bar)', () => {
  const range = { minValue: 0, maxValue: 250 };

  /** `docs/spec/ozet/01-fiziksel-arayuzler.md`: 250 × (13.6−4)/16 = 150 bar. */
  it('13.6 mA 150 bar verir', () => {
    expect(engineeringValueFromCurrent(13.6, range)).toBeCloseTo(150, 10);
  });

  it('aynı fixture normalize %60 demektir', () => {
    expect(normalizedFromCurrent(13.6)).toBeCloseTo(0.6, 10);
  });

  it('ters yön aynı noktaya döner', () => {
    expect(currentFromEngineeringValue(150, range)).toBeCloseTo(13.6, 10);
  });

  it('aralık uçları 4 mA ve 20 mA’ya oturur', () => {
    expect(currentFromEngineeringValue(0, range)).toBe(4);
    expect(currentFromEngineeringValue(250, range)).toBe(20);
    expect(engineeringValueFromCurrent(4, range)).toBe(0);
    expect(engineeringValueFromCurrent(20, range)).toBe(250);
  });

  /** Aralık dışı BİLEREK kırpılmaz: under/over-range durumunun kendisi budur. */
  it('aralık dışındaki akım aralık dışı mühendislik değeri verir', () => {
    expect(engineeringValueFromCurrent(3.5, range)).toBeCloseTo(-7.8125, 10);
    expect(normalizedFromCurrent(3.5)).toBeLessThan(0);
    expect(normalizedFromCurrent(21)).toBeGreaterThan(1);
  });

  it('sıfır genişlikli aralık RangeError verir', () => {
    expect(() => engineeringValueFromCurrent(12, { minValue: 5, maxValue: 5 })).toThrow(RangeError);
    expect(() => currentFromEngineeringValue(5, { minValue: 5, maxValue: 5 })).toThrow(RangeError);
  });

  it('ters (azalan) aralıkta da çalışır', () => {
    // 4 mA = 100 °C, 20 mA = 0 °C gibi ters ölçekli sensörler gerçektir.
    const inverted = { minValue: 100, maxValue: 0 };
    expect(engineeringValueFromCurrent(12, inverted)).toBeCloseTo(50, 10);
    expect(currentFromEngineeringValue(100, inverted)).toBe(4);
  });
});

describe('shuntVoltage — Ohm kanunu', () => {
  /** Spec'in Current Loop örneği: 20 mA, 100 Ω → 2 V. */
  it('20 mA 100 ohm üzerinde 2 V düşürür', () => {
    expect(shuntVoltage(20, 100)).toBeCloseTo(2, 10);
  });

  /** Spec'in 250 Ω shunt örneği: 4–20 mA ↔ 1–5 V. */
  it('250 ohm shunt 4–20 mA aralığını 1–5 V yapar', () => {
    expect(shuntVoltage(4, 250)).toBeCloseTo(1, 10);
    expect(shuntVoltage(20, 250)).toBeCloseTo(5, 10);
  });

  it('negatif direnç RangeError verir', () => {
    expect(() => shuntVoltage(20, -1)).toThrow(RangeError);
  });
});

describe('calculateLoopCompliance — spec fixture (24 V / 10 V / 100 Ω / 250 Ω / 20 mA)', () => {
  const input = {
    supplyVolts: 24,
    transmitterMinVolts: 10,
    cableOhms: 100,
    loadOhms: 250,
    loopCurrentMilliamps: 20,
  };

  it('kablo ve yük düşümlerini ayrı ayrı verir', () => {
    const result = calculateLoopCompliance(input);
    expect(result.cableDropVolts).toBeCloseTo(2, 10);
    expect(result.loadDropVolts).toBeCloseTo(5, 10);
  });

  it('gereken gerilim 17 V, kalan compliance 7 V', () => {
    const result = calculateLoopCompliance(input);
    expect(result.requiredVolts).toBeCloseTo(17, 10);
    expect(result.remainingComplianceVolts).toBeCloseTo(7, 10);
    expect(result.sufficient).toBe(true);
  });

  /** `V_margin` kaynakta formülde var ama SAYI yok — çağıran verir, varsayılan 0. */
  it('marj verilirse gereken gerilime eklenir', () => {
    const result = calculateLoopCompliance({ ...input, marginVolts: 3 });
    expect(result.requiredVolts).toBeCloseTo(20, 10);
    expect(result.remainingComplianceVolts).toBeCloseTo(4, 10);
  });

  it('besleme yetmezse sufficient false olur', () => {
    const result = calculateLoopCompliance({ ...input, supplyVolts: 15 });
    expect(result.remainingComplianceVolts).toBeCloseTo(-2, 10);
    expect(result.sufficient).toBe(false);
  });

  it('uzun kablo (600 ohm) 24 V beslemeyi yetersiz bırakır', () => {
    const result = calculateLoopCompliance({ ...input, cableOhms: 600 });
    expect(result.cableDropVolts).toBeCloseTo(12, 10);
    expect(result.sufficient).toBe(false);
  });

  it('negatif akım RangeError verir', () => {
    expect(() => calculateLoopCompliance({ ...input, loopCurrentMilliamps: -1 })).toThrow(
      RangeError,
    );
  });
});

describe('classifyLoopCurrent', () => {
  it('4–20 mA arası normal', () => {
    expect(classifyLoopCurrent(4)).toBe('normal');
    expect(classifyLoopCurrent(13.6)).toBe('normal');
    expect(classifyLoopCurrent(20)).toBe('normal');
  });

  it('sınırların dışı under/over-range', () => {
    expect(classifyLoopCurrent(3.8)).toBe('under-range');
    expect(classifyLoopCurrent(21.5)).toBe('over-range');
  });

  /** Kaynak bu iki durum için SAYI vermiyor: eşik yoksa durum da üretilmez. */
  it('eşik verilmezse open-loop ve short hiç raporlanmaz', () => {
    expect(classifyLoopCurrent(0)).toBe('under-range');
    expect(classifyLoopCurrent(50)).toBe('over-range');
  });

  it('eşik verilirse kopuk döngü ve kısa devre ayrılır', () => {
    const thresholds = { openLoopBelowMilliamps: 3.6, shortAboveMilliamps: 21 };
    expect(classifyLoopCurrent(0.2, thresholds)).toBe('open-loop');
    expect(classifyLoopCurrent(3.8, thresholds)).toBe('under-range');
    expect(classifyLoopCurrent(22, thresholds)).toBe('short-suspected');
    expect(classifyLoopCurrent(20.5, thresholds)).toBe('over-range');
  });
});
