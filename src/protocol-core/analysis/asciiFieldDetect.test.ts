import { describe, expect, it } from 'vitest';

import { detectAsciiFields } from './asciiFieldDetect';
import type { AnalysisFrame } from './types';

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

/** "ALP1" ve "ALP2" — dört harflik metin alanı, önünde ve arkasında ikili veri. */
const TEXT_FRAMES: readonly AnalysisFrame[] = [
  frame([0x01, 0x41, 0x4c, 0x50, 0x31, 0xff]),
  frame([0x02, 0x41, 0x4c, 0x50, 0x32, 0xfe]),
];

describe('detectAsciiFields', () => {
  it('ardışık yazdırılabilir sütunları tek alan olarak verir', () => {
    const fields = detectAsciiFields(TEXT_FRAMES);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.offset).toBe(1);
    expect(fields[0]?.length).toBe(4);
  });

  it('kısa yazdırılabilir dizileri metin saymaz', () => {
    // Üç harf rastgele ikili veride sık görülür; en az uzunluk 4.
    expect(detectAsciiFields([frame([0x41, 0x42, 0x43, 0x00])])).toEqual([]);
  });

  it('eşik altındaki sütun alanı böler', () => {
    const frames = [frame([0x41, 0x42, 0x00, 0x43, 0x44, 0x45, 0x46])];
    const fields = detectAsciiFields(frames);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.offset).toBe(3);
  });

  it('eşik ve en az uzunluk ayarlanabilir', () => {
    const fields = detectAsciiFields([frame([0x41, 0x42, 0x43])], { minRunLength: 3 });
    expect(fields[0]?.length).toBe(3);
  });

  it('ikili gövdeyi metin ilan etmez', () => {
    expect(detectAsciiFields([frame([0x00, 0x01, 0x02, 0x80, 0xff])])).toEqual([]);
  });
});
