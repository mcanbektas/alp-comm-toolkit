import { describe, expect, it } from 'vitest';

import { changingOffsets, constantOffsets, profileByteColumns } from './byteColumns';
import type { AnalysisFrame } from './types';

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

/**
 * Ana spec'in "Unknown RF Protocol Analyzer" yakalama seti — üç paket.
 * Spec metni "Bytes 0–1: Constant" der ama AYNI üç pakette 2. ve 3. baytlar da
 * sabittir; motor metne değil VERİYE bakar ve dördünü birden sabit sayar.
 * Metnin kısaltması bir kural değil, örneğin özeti.
 */
const RF_CAPTURE: readonly AnalysisFrame[] = [
  frame([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]),
];

describe('profileByteColumns', () => {
  it('spec RF setinde sabit sütunları bulur', () => {
    const profiles = profileByteColumns(RF_CAPTURE);
    expect(constantOffsets(profiles)).toEqual([0, 1, 2, 3]);
    expect(profiles[0]?.value).toBe(0xaa);
    expect(profiles[0]?.changeRate).toBe(0);
  });

  it('değişen sütunları değişim oranıyla verir', () => {
    const profiles = profileByteColumns(RF_CAPTURE);
    // 4, 5 ve 6 her çerçevede değişiyor: oran (N−1)/(N−1) = 1.
    expect(changingOffsets(profiles)).toEqual([4, 5, 6]);
    expect(profiles[4]?.changeRate).toBe(1);
  });

  it('sabit sütunun entropisi sıfır, değişenin sıfırdan büyüktür', () => {
    const profiles = profileByteColumns(RF_CAPTURE);
    expect(profiles[0]?.entropyBits).toBe(0);
    expect(profiles[4]?.entropyBits).toBeGreaterThan(0);
  });

  it('tek çerçevede değişim oranı sıfır DEĞİL bilinmeyendir', () => {
    const profiles = profileByteColumns([frame([1, 2, 3])]);
    expect(profiles[0]?.changeRate).toBeUndefined();
    expect(profiles[0]?.constant).toBe(false);
  });

  it('değişken uzunlukta eksik baytı sıfırla doldurmaz', () => {
    const profiles = profileByteColumns([frame([1, 2, 3]), frame([1, 2])]);
    expect(profiles[2]?.presentCount).toBe(1);
    expect(profiles[2]?.min).toBe(3);
    expect(profiles[1]?.presentCount).toBe(2);
  });

  it('yazdırılabilir ASCII oranını ölçer', () => {
    const profiles = profileByteColumns([frame([0x41, 0x00]), frame([0x42, 0x01])]);
    expect(profiles[0]?.printableRatio).toBe(1);
    expect(profiles[1]?.printableRatio).toBe(0);
  });

  it('boş girdide boş profil döner', () => {
    expect(profileByteColumns([])).toEqual([]);
  });
});
