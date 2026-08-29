import { describe, expect, it } from 'vitest';

import { pearsonCorrelation } from './correlation';

describe('pearsonCorrelation', () => {
  it('doğrusal artan seride 1 verir', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
  });

  it('ters doğrusal seride −1 verir', () => {
    expect(pearsonCorrelation([1, 2, 3], [9, 6, 3])).toBeCloseTo(-1, 12);
  });

  /**
   * Ana spec'in gyro örneği: heading 90° iken gövdede `23 28` (0x2328 = 9000),
   * 100° iken `27 10` (0x2710 = 10000). Ölçek 0.01'dir ve ilişki tam doğrusal.
   */
  it('spec gyro örneğinde tam korelasyon bulur', () => {
    expect(pearsonCorrelation([90, 100], [0x2328, 0x2710])).toBeCloseTo(1, 12);
  });

  it('sabit seride sıfır DEĞİL bilinmeyen döner', () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeUndefined();
  });

  it('uzunluk uyuşmazlığında ve tek örnekte bilinmeyen döner', () => {
    expect(pearsonCorrelation([1, 2], [1, 2, 3])).toBeUndefined();
    expect(pearsonCorrelation([1], [1])).toBeUndefined();
  });
});
