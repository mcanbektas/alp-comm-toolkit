import { describe, expect, it } from 'vitest';

import { detectLengthFields } from './lengthFieldDetect';
import type { AnalysisFrame } from './types';

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

describe('detectLengthFields', () => {
  it('gövde uzunluğunu sayan alanı sabit farkla bulur', () => {
    // [başlık][uzunluk][gövde…]: uzunluk yalnız gövdeyi sayıyor, fark 2.
    const frames = [frame([0xaa, 0x02, 0x01, 0x02]), frame([0xaa, 0x04, 1, 2, 3, 4])];
    const candidates = detectLengthFields(frames);
    const found = candidates.find((candidate) => candidate.offset === 1 && candidate.width === 1);
    expect(found?.lengthOffset).toBe(2);
  });

  it('çerçevenin tamamını sayan alanda fark sıfırdır', () => {
    const frames = [frame([0x03, 0xaa, 0xbb]), frame([0x05, 1, 2, 3, 4])];
    expect(detectLengthFields(frames)[0]?.lengthOffset).toBe(0);
  });

  it('bütün çerçeveler aynı uzunluktaysa iddia etmez', () => {
    // Sabit uzunlukta HER sabit bayt bu testi geçerdi; motor boş döner.
    const frames = [frame([0xaa, 0x02, 1, 2]), frame([0xaa, 0x02, 3, 4])];
    expect(detectLengthFields(frames)).toEqual([]);
  });

  it('uzunlukla ilişkisiz sabit baytı tek başına aday saymaz', () => {
    const frames = [frame([0x77, 0x02, 1, 2]), frame([0x77, 0x04, 1, 2, 3, 4])];
    const candidates = detectLengthFields(frames);
    expect(candidates.some((candidate) => candidate.offset === 0 && candidate.width === 1)).toBe(false);
  });

  it('uzunluk baytını kapsayan geniş okumayı da aday verir ve dar olanı öne alır', () => {
    // Sabit bir üst bayt farkı değiştirmez: 0x7702/0x7704 okuması da uzunluğu
    // izler. Veri hangisinin doğru olduğunu söylemediği için ikisi de listede.
    const frames = [frame([0x77, 0x02, 1, 2]), frame([0x77, 0x04, 1, 2, 3, 4])];
    const candidates = detectLengthFields(frames);
    const wide = candidates.find((candidate) => candidate.offset === 0 && candidate.width === 2);
    expect(wide).toBeDefined();
    expect(candidates[0]?.offset).toBe(0);
    const narrow = candidates.find((candidate) => candidate.offset === 1 && candidate.width === 1);
    expect(narrow?.lengthOffset).toBe(2);
  });

  it('küçük uçlu 16 bit uzunluk alanını bulur', () => {
    const frames = [frame([0x02, 0x00, 1, 2]), frame([0x04, 0x00, 1, 2, 3, 4])];
    const little = detectLengthFields(frames).find(
      (candidate) => candidate.width === 2 && candidate.endianness === 'little',
    );
    expect(little?.lengthOffset).toBe(2);
  });

  it('tek çerçevede boş döner', () => {
    expect(detectLengthFields([frame([1, 2, 3])])).toEqual([]);
  });
});
