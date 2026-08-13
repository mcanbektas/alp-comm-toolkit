import { describe, expect, it } from 'vitest';

import { createRateMeter } from './rateMeter';

describe('createRateMeter', () => {
  it('geçersiz yapılandırmayı reddeder', () => {
    expect(() => createRateMeter(1000, 0)).toThrow(RangeError);
    expect(() => createRateMeter(1000, 2.5)).toThrow(RangeError);
    expect(() => createRateMeter(0, 10)).toThrow(RangeError);
  });

  it('hiç olay yokken hız sıfırdır', () => {
    expect(createRateMeter(1000, 10).rate(0)).toBe(0);
  });

  it('1 saniyelik pencerede 100 olay saniyede 100 verir', () => {
    const meter = createRateMeter(1000, 10);
    for (let index = 0; index < 100; index += 1) {
      meter.record(index * 10);
    }

    expect(meter.rate(990)).toBeCloseTo(100, 6);
  });

  it('miktar verilirse bayt hızı gibi ölçülebilir', () => {
    const meter = createRateMeter(1000, 10);
    for (let index = 0; index < 10; index += 1) {
      meter.record(index * 100, 50);
    }

    expect(meter.rate(900)).toBeCloseTo(500, 6);
  });

  it('pencereden çıkan olaylar hıza katılmaz', () => {
    const meter = createRateMeter(1000, 10);
    for (let index = 0; index < 50; index += 1) {
      meter.record(index * 10);
    }

    // 3 saniye sonra pencere tamamen boşalmış olmalı.
    expect(meter.rate(3000)).toBe(0);
  });

  it('kısmi yaşlanmada yalnız pencereye düşen kısım sayılır', () => {
    const meter = createRateMeter(1000, 10);
    // 0..999 arası saniyede 100 olay
    for (let index = 0; index < 100; index += 1) {
      meter.record(index * 10);
    }
    // 1500'de yalnız 500..999 aralığındaki ~50 olay pencerede kalır.
    const rate = meter.rate(1500);

    expect(rate).toBeGreaterThan(30);
    expect(rate).toBeLessThan(70);
  });

  it('okuma yan etkisiz değildir ama tekrarlanabilir', () => {
    const meter = createRateMeter(1000, 10);
    for (let index = 0; index < 20; index += 1) {
      meter.record(index * 10);
    }

    expect(meter.rate(500)).toBe(meter.rate(500));
  });

  it('reset() sayaçları sıfırlar', () => {
    const meter = createRateMeter(1000, 10);
    meter.record(0);
    meter.record(10);
    meter.reset();

    expect(meter.rate(20)).toBe(0);
  });

  it('uzun boşluktan sonra gelen olay eski kovaya karışmaz', () => {
    const meter = createRateMeter(1000, 10);
    for (let index = 0; index < 10; index += 1) {
      meter.record(index * 10);
    }
    // Tam bir tur sonra (10 kova × 100 ms = 1000 ms) aynı kova indeksine düşer.
    meter.record(10_000);

    expect(meter.rate(10_000)).toBeCloseTo(1, 6);
  });
});
