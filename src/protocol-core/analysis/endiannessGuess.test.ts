import { describe, expect, it } from 'vitest';

import { guessFieldEndianness } from './endiannessGuess';
import type { AnalysisFrame } from './types';

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

describe('guessFieldEndianness', () => {
  it('üst bayt sabit kalıyorsa büyük uçlu der', () => {
    // 0x0101, 0x0102, 0x0103 — sol bayt hiç değişmiyor.
    const frames = [frame([0x01, 0x01]), frame([0x01, 0x02]), frame([0x01, 0x03])];
    expect(guessFieldEndianness(frames, 0, 2).endianness).toBe('big');
  });

  it('alt bayt soldaysa küçük uçlu der', () => {
    const frames = [frame([0x01, 0x01]), frame([0x02, 0x01]), frame([0x03, 0x01])];
    expect(guessFieldEndianness(frames, 0, 2).endianness).toBe('little');
  });

  it('iki bayt da aynı sıklıkta değişiyorsa karar vermez', () => {
    const frames = [frame([0x01, 0x01]), frame([0x02, 0x02]), frame([0x03, 0x03])];
    expect(guessFieldEndianness(frames, 0, 2).endianness).toBeUndefined();
  });

  it('sabit alanda karar vermez', () => {
    const frames = [frame([0x01, 0x02]), frame([0x01, 0x02])];
    expect(guessFieldEndianness(frames, 0, 2).endianness).toBeUndefined();
  });

  it('tek baytta soruyu anlamsız sayar', () => {
    const frames = [frame([0x01]), frame([0x02])];
    expect(guessFieldEndianness(frames, 0, 1).endianness).toBeUndefined();
  });
});
