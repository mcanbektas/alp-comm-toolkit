import { describe, expect, it } from 'vitest';

import { computeWindowRange, type WindowRangeInput } from './windowRange';

function input(overrides: Partial<WindowRangeInput> = {}): WindowRangeInput {
  return {
    scrollTop: 0,
    viewportHeight: 400,
    rowHeight: 20,
    rowCount: 1000,
    overscan: 0,
    ...overrides,
  };
}

describe('computeWindowRange', () => {
  it('satır yoksa boş aralık verir', () => {
    expect(computeWindowRange(input({ rowCount: 0 }))).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 0,
    });
  });

  it('satır yüksekliği sıfır ya da negatifse boş aralık verir — sıfıra bölmeyi engeller', () => {
    expect(computeWindowRange(input({ rowHeight: 0 })).endIndex).toBe(0);
    expect(computeWindowRange(input({ rowHeight: -5 })).endIndex).toBe(0);
  });

  it('en üstteyken ilk satırdan başlar ve görünür alanı bir satır taşırarak doldurur', () => {
    const range = computeWindowRange(input());

    expect(range.startIndex).toBe(0);
    // 400/20 = 20 satır görünür, yarım kalanı için +1
    expect(range.endIndex).toBe(21);
    expect(range.paddingTop).toBe(0);
    expect(range.totalHeight).toBe(20_000);
    expect(range.paddingBottom).toBe(20_000 - 21 * 20);
  });

  it('kaydırıldığında pencere kayar ve üst dolgu konumu korur', () => {
    const range = computeWindowRange(input({ scrollTop: 1000 }));

    expect(range.startIndex).toBe(50);
    expect(range.endIndex).toBe(71);
    expect(range.paddingTop).toBe(1000);
    expect(range.paddingTop + range.paddingBottom + (range.endIndex - range.startIndex) * 20).toBe(
      range.totalHeight,
    );
  });

  it('overscan pencereyi iki yönde genişletir', () => {
    const range = computeWindowRange(input({ scrollTop: 1000, overscan: 5 }));

    expect(range.startIndex).toBe(45);
    expect(range.endIndex).toBe(76);
    expect(range.paddingTop).toBe(45 * 20);
  });

  it('overscan üst sınırda taşmaz', () => {
    const range = computeWindowRange(input({ scrollTop: 0, overscan: 10 }));

    expect(range.startIndex).toBe(0);
    expect(range.paddingTop).toBe(0);
  });

  it('en altta endIndex satır sayısını aşmaz ve alt dolgu sıfırlanır', () => {
    const range = computeWindowRange(input({ scrollTop: 20_000, overscan: 4 }));

    expect(range.endIndex).toBe(1000);
    expect(range.paddingBottom).toBe(0);
  });

  it('negatif scrollTop en üst gibi ele alınır', () => {
    expect(computeWindowRange(input({ scrollTop: -300 })).startIndex).toBe(0);
  });

  it('görünür alan satırdan kısaysa yine en az bir satır çizilir', () => {
    const range = computeWindowRange(input({ viewportHeight: 5, rowHeight: 20 }));

    expect(range.endIndex - range.startIndex).toBeGreaterThanOrEqual(1);
  });

  it('dolgu + çizilen satırlar daima toplam yüksekliğe eşittir', () => {
    for (const scrollTop of [0, 37, 500, 1234, 19_000, 20_000]) {
      const range = computeWindowRange(input({ scrollTop, overscan: 3 }));
      const drawn = (range.endIndex - range.startIndex) * 20;

      expect(range.paddingTop + drawn + range.paddingBottom).toBe(range.totalHeight);
    }
  });

  it('100 bin satırda yalnız pencere kadar satır çizilir', () => {
    const range = computeWindowRange(input({ rowCount: 100_000, scrollTop: 500_000, overscan: 8 }));

    expect(range.totalHeight).toBe(2_000_000);
    // Ekranda 20 satır + 1 taşma + iki uçta 8'er yedek
    expect(range.endIndex - range.startIndex).toBe(37);
  });
});
