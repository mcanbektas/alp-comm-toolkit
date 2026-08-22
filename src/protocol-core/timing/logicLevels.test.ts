import { describe, expect, it } from 'vitest';

import { evaluateLogicLevelDirection, evaluateLogicLevelLink } from './logicLevels';
import type { LogicLevelDevice } from './logicLevels';

/** 3.3V sınıfı bir cihazın tipik eşikleri (datasheet değeri değil, test fixture'ı). */
const DEVICE_3V3: LogicLevelDevice = {
  vohMinVolts: 3.0,
  volMaxVolts: 0.4,
  vihMinVolts: 2.0,
  vilMaxVolts: 0.8,
};

/** Spec'in CMOS örneğindeki 1.8V taraf: V_OH = 1.8 V (`01-fiziksel-arayuzler.md:189`). */
const DEVICE_1V8: LogicLevelDevice = {
  vohMinVolts: 1.8,
  volMaxVolts: 0.45,
  vihMinVolts: 1.17,
  vilMaxVolts: 0.63,
};

describe('evaluateLogicLevelDirection — spec eşitsizlikleri', () => {
  it('VOH_min > VIH_min ve VOL_max < VIL_max sağlanınca uyumlu sayar', () => {
    const result = evaluateLogicLevelDirection(DEVICE_3V3, DEVICE_1V8);
    expect(result.highCompatible).toBe(true);
    expect(result.lowCompatible).toBe(true);
    expect(result.compatible).toBe(true);
  });

  it('gürültü payları eşitsizliklerin farkıdır', () => {
    const result = evaluateLogicLevelDirection(DEVICE_3V3, DEVICE_1V8);
    // 3.0 − 1.17 = 1.83 ; 0.63 − 0.4 = 0.23
    expect(result.highMarginVolts).toBeCloseTo(1.83, 10);
    expect(result.lowMarginVolts).toBeCloseTo(0.23, 10);
  });

  /**
   * Spec'in KENDİ örneği (`:189`): `B→A: FAIL (Reason: B VOH=1.8V, A VIH=2.0V)`.
   * 1.8 < 2.0 olduğu için HIGH seviyesi tanınmaz.
   */
  it('spec örneği: 1.8V sürücü 2.0V eşikli girişte HIGH sağlayamaz', () => {
    const result = evaluateLogicLevelDirection(DEVICE_1V8, DEVICE_3V3);
    expect(result.highMarginVolts).toBeCloseTo(-0.2, 10);
    expect(result.highCompatible).toBe(false);
    // LOW tarafı sorunsuz: 0.8 − 0.45 = 0.35
    expect(result.lowCompatible).toBe(true);
    expect(result.compatible).toBe(false);
  });

  it('sınır durumu (tam eşitlik) uyumlu SAYILMAZ — pay sıfır, gürültü payı yok', () => {
    const driver: LogicLevelDevice = { ...DEVICE_3V3, vohMinVolts: 2.0 };
    const result = evaluateLogicLevelDirection(driver, DEVICE_3V3);
    expect(result.highMarginVolts).toBe(0);
    expect(result.highCompatible).toBe(false);
  });

  it('LOW tarafı da tek başına uyumsuzluk sebebi olabilir', () => {
    const sloppyDriver: LogicLevelDevice = { ...DEVICE_3V3, volMaxVolts: 1.2 };
    const result = evaluateLogicLevelDirection(sloppyDriver, DEVICE_3V3);
    expect(result.highCompatible).toBe(true);
    expect(result.lowCompatible).toBe(false);
    expect(result.compatible).toBe(false);
  });
});

describe('evaluateLogicLevelDirection — mutlak maksimum', () => {
  it('değer verilmezse aşırı gerilim bayrağı hiç kalkmaz', () => {
    expect(evaluateLogicLevelDirection(DEVICE_3V3, DEVICE_1V8).overvoltage).toBe(false);
  });

  /** Seviyeler "uyumlu" görünürken alıcının fiziksel olarak zarar görebildiği durum. */
  it('sürücünün HIGH çıkışı alıcının mutlak maksimumunu aşarsa işaretlenir', () => {
    const fragileReceiver: LogicLevelDevice = { ...DEVICE_1V8, absoluteMaxInputVolts: 2.0 };
    const result = evaluateLogicLevelDirection(DEVICE_3V3, fragileReceiver);
    expect(result.compatible).toBe(true);
    expect(result.overvoltage).toBe(true);
  });

  it('5V toleranslı giriş aynı sürücüde işaretlenmez', () => {
    const tolerantReceiver: LogicLevelDevice = { ...DEVICE_1V8, absoluteMaxInputVolts: 5.5 };
    expect(evaluateLogicLevelDirection(DEVICE_3V3, tolerantReceiver).overvoltage).toBe(false);
  });
});

describe('evaluateLogicLevelLink — iki yön ayrı', () => {
  /** Spec'in CMOS örneği: A→B PASS, B→A FAIL — tek cevap bu asimetriyi gizlerdi. */
  it('asimetrik bağlantıda yalnız bir yön geçer', () => {
    const link = evaluateLogicLevelLink(DEVICE_3V3, DEVICE_1V8);
    expect(link.aToB.compatible).toBe(true);
    expect(link.bToA.compatible).toBe(false);
    expect(link.compatible).toBe(false);
  });

  it('iki yön de geçerse bağlantı uyumlu', () => {
    const link = evaluateLogicLevelLink(DEVICE_3V3, DEVICE_3V3);
    expect(link.compatible).toBe(true);
  });
});

describe('evaluateLogicLevelDirection — girdi doğrulaması', () => {
  it('V_OH(min) V_OL(max) altındaysa RangeError', () => {
    const broken: LogicLevelDevice = { ...DEVICE_3V3, vohMinVolts: 0.2 };
    expect(() => evaluateLogicLevelDirection(broken, DEVICE_3V3)).toThrow(RangeError);
  });

  it('V_IH(min) V_IL(max) altındaysa RangeError', () => {
    const broken: LogicLevelDevice = { ...DEVICE_3V3, vihMinVolts: 0.5 };
    expect(() => evaluateLogicLevelDirection(DEVICE_3V3, broken)).toThrow(RangeError);
  });
});
