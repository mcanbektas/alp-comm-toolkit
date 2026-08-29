import { describe, expect, it } from 'vitest';

import { detectTimestampFields } from './timestampDetect';
import type { AnalysisFrame } from './types';

/** 2021-11-25T16:00:00Z = 1637856000 = 0x619F5A00. */
const BASE_SECONDS = 1_637_856_000;

function withTimestampField(seconds: number, captureMs: number | undefined): AnalysisFrame {
  const bytes = new Uint8Array(6);
  bytes[0] = 0xaa;
  bytes[1] = (seconds >>> 24) & 0xff;
  bytes[2] = (seconds >>> 16) & 0xff;
  bytes[3] = (seconds >>> 8) & 0xff;
  bytes[4] = seconds & 0xff;
  bytes[5] = 0x55;
  return { bytes, timestamp: captureMs };
}

describe('detectTimestampFields', () => {
  it('büyük uçlu Unix saniye alanını bulur', () => {
    const frames = [
      withTimestampField(BASE_SECONDS, undefined),
      withTimestampField(BASE_SECONDS + 1, undefined),
      withTimestampField(BASE_SECONDS + 2, undefined),
    ];
    const candidate = detectTimestampFields(frames).find((item) => item.offset === 1);
    expect(candidate?.endianness).toBe('big');
    expect(candidate?.firstValue).toBe(BASE_SECONDS);
  });

  it('makul aralık dışındaki sayıyı zaman damgası saymaz', () => {
    const frames = [
      { bytes: new Uint8Array([0x00, 0x00, 0x00, 0x01]), timestamp: undefined },
      { bytes: new Uint8Array([0x00, 0x00, 0x00, 0x02]), timestamp: undefined },
    ];
    expect(detectTimestampFields(frames)).toEqual([]);
  });

  it('geriye giden alanı zaman damgası saymaz', () => {
    const frames = [
      withTimestampField(BASE_SECONDS + 10, undefined),
      withTimestampField(BASE_SECONDS, undefined),
    ];
    expect(detectTimestampFields(frames).some((item) => item.offset === 1)).toBe(false);
  });

  it('yakalama damgalarıyla korelasyonu raporlar', () => {
    const frames = [
      withTimestampField(BASE_SECONDS, 1000),
      withTimestampField(BASE_SECONDS + 1, 2000),
      withTimestampField(BASE_SECONDS + 2, 3000),
    ];
    const candidate = detectTimestampFields(frames).find((item) => item.offset === 1);
    expect(candidate?.frameTimeCorrelation).toBeCloseTo(1, 9);
  });

  it('damga yoksa korelasyonu sıfır değil bilinmeyen bırakır', () => {
    const frames = [
      withTimestampField(BASE_SECONDS, undefined),
      withTimestampField(BASE_SECONDS + 1, undefined),
    ];
    expect(detectTimestampFields(frames)[0]?.frameTimeCorrelation).toBeUndefined();
  });
});
