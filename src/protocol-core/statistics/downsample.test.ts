import { describe, expect, it } from 'vitest';

import { downsampleLttb, type SamplePoint } from './downsample';

function ramp(count: number): SamplePoint[] {
  return Array.from({ length: count }, (_unused, index) => ({ x: index, y: index }));
}

describe('downsampleLttb', () => {
  it('eşik nokta sayısından büyükse veri değişmeden döner', () => {
    const points = ramp(10);

    expect(downsampleLttb(points, 50)).toEqual(points);
    expect(downsampleLttb(points, 10)).toEqual(points);
  });

  it('boş girdide boş döner', () => {
    expect(downsampleLttb([], 100)).toEqual([]);
  });

  it('eşik 0 veya negatifse veri değişmeden döner', () => {
    const points = ramp(5);

    expect(downsampleLttb(points, 0)).toEqual(points);
    expect(downsampleLttb(points, -3)).toEqual(points);
  });

  it('eşik 1 ise yalnız son nokta kalır', () => {
    expect(downsampleLttb(ramp(10), 1)).toEqual([{ x: 9, y: 9 }]);
  });

  it('eşik 2 ise yalnız ilk ve son nokta kalır', () => {
    expect(downsampleLttb(ramp(10), 2)).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 9 },
    ]);
  });

  it('tam olarak eşik kadar nokta üretir', () => {
    for (const threshold of [3, 5, 20, 100]) {
      expect(downsampleLttb(ramp(5000), threshold)).toHaveLength(threshold);
    }
  });

  it('ilk ve son noktayı daima korur', () => {
    const points = ramp(1000);
    const sampled = downsampleLttb(points, 50);

    expect(sampled[0]).toEqual({ x: 0, y: 0 });
    expect(sampled[sampled.length - 1]).toEqual({ x: 999, y: 999 });
  });

  it('x sırasını bozmaz', () => {
    const sampled = downsampleLttb(ramp(2000), 77);

    for (let index = 1; index < sampled.length; index += 1) {
      expect(sampled[index]?.x).toBeGreaterThan(sampled[index - 1]?.x ?? Number.NEGATIVE_INFINITY);
    }
  });

  it('tekil tepe noktasını korur — sabit adımlı örneklemenin kaçırdığı bilgi', () => {
    // Düz taban üzerinde tek bir sivri uç; 500. noktada 1000'e fırlıyor.
    const points: SamplePoint[] = Array.from({ length: 1001 }, (_unused, index) => ({
      x: index,
      y: index === 500 ? 1000 : 0,
    }));

    const sampled = downsampleLttb(points, 50);

    expect(sampled.some((point) => point.y === 1000)).toBe(true);
  });

  it('tepe ve dip birlikte korunur', () => {
    const points: SamplePoint[] = Array.from({ length: 1001 }, (_unused, index) => {
      if (index === 300) {
        return { x: index, y: 500 };
      }
      if (index === 700) {
        return { x: index, y: -500 };
      }
      return { x: index, y: 0 };
    });

    const sampled = downsampleLttb(points, 40);

    expect(sampled.some((point) => point.y === 500)).toBe(true);
    expect(sampled.some((point) => point.y === -500)).toBe(true);
  });

  it('aynı girdi için aynı çıktıyı verir', () => {
    const points = ramp(3000);

    expect(downsampleLttb(points, 60)).toEqual(downsampleLttb(points, 60));
  });

  it('100 bin noktayı 2000 noktaya indirir', () => {
    const points: SamplePoint[] = Array.from({ length: 100_000 }, (_unused, index) => ({
      x: index,
      y: Math.sin(index / 500) * 100,
    }));

    const sampled = downsampleLttb(points, 2000);

    expect(sampled).toHaveLength(2000);
    // Sinüsün genliği korunmalı: seyreltme tepe değerini ezmemeli.
    const maxY = Math.max(...sampled.map((point) => point.y));
    expect(maxY).toBeGreaterThan(99);
  });
});
