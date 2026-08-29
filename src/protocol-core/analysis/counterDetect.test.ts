import { describe, expect, it } from 'vitest';

import { detectCounters } from './counterDetect';
import type { AnalysisFrame } from './types';

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

/** Ana spec'in "Unknown RF Protocol Analyzer" yakalama seti. */
const RF_CAPTURE: readonly AnalysisFrame[] = [
  frame([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]),
];

describe('detectCounters', () => {
  it('spec RF setinde 4. baytı adım 1 sayaç bulur', () => {
    const candidates = detectCounters(RF_CAPTURE);
    const byteFour = candidates.find((candidate) => candidate.offset === 4 && candidate.width === 1);
    expect(byteFour?.step).toBe(1);
    expect(byteFour?.firstValue).toBe(1);
    expect(byteFour?.lastValue).toBe(3);
  });

  it('checksum baytlarını sayaç saymaz', () => {
    const candidates = detectCounters(RF_CAPTURE);
    expect(candidates.some((candidate) => candidate.offset === 5 && candidate.width === 1)).toBe(false);
    expect(candidates.some((candidate) => candidate.offset === 6 && candidate.width === 1)).toBe(false);
  });

  it('8 bitlik sayacın sarmasını adım kaybı saymaz', () => {
    const wrapping = [frame([0xfe]), frame([0xff]), frame([0x00]), frame([0x01])];
    const candidates = detectCounters(wrapping);
    expect(candidates[0]?.step).toBe(1);
    expect(candidates[0]?.wrapCount).toBe(1);
  });

  it('sabit alanı sayaç saymaz', () => {
    expect(detectCounters([frame([7]), frame([7]), frame([7])])).toEqual([]);
  });

  it('iki çerçeveyle sayaç iddia etmez', () => {
    expect(detectCounters([frame([1]), frame([2])])).toEqual([]);
  });

  it('küçük uçlu 16 bit sayacı bulur', () => {
    const frames = [frame([0xfe, 0x00]), frame([0xff, 0x00]), frame([0x00, 0x01])];
    const little = detectCounters(frames).find(
      (candidate) => candidate.width === 2 && candidate.endianness === 'little',
    );
    expect(little?.step).toBe(1);
  });

  it('tek baytlık alanı iki kez raporlamaz', () => {
    const candidates = detectCounters([frame([1]), frame([2]), frame([3])]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.endianness).toBe('big');
  });

  it('değişken adım yalnız açıkça istenince aday olur', () => {
    const frames = [frame([1]), frame([3]), frame([10])];
    expect(detectCounters(frames)).toEqual([]);
    const relaxed = detectCounters(frames, { allowVariableStep: true });
    expect(relaxed[0]?.step).toBeUndefined();
  });
});
