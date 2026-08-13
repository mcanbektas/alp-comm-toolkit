import { describe, expect, it } from 'vitest';

import { createFixedLengthExtractor } from './fixedLengthFraming';

const OPTIONS = { maxFrameLength: 1024 };

describe('fixed-length framing', () => {
  it('tam N bayt geldiğinde çerçeveyi tamamlar', () => {
    const extractor = createFixedLengthExtractor({ frameLength: 4 });
    const result = extractor.extract(Uint8Array.from([1, 2, 3, 4, 5]), OPTIONS);
    expect(result).toMatchObject({ status: 'complete', consumedBytes: 4 });
    if (result.status === 'complete') expect(Array.from(result.frame)).toEqual([1, 2, 3, 4]);
  });

  it('yetersiz bayt varsa incomplete döner', () => {
    const extractor = createFixedLengthExtractor({ frameLength: 4 });
    expect(extractor.extract(Uint8Array.from([1, 2]), OPTIONS)).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('start byte verilip uymazsa tek bayt atlayarak kurtarır', () => {
    const extractor = createFixedLengthExtractor({ frameLength: 3, startByte: 0xaa });
    const result = extractor.extract(Uint8Array.from([0x00, 0xaa, 0x01, 0x02]), OPTIONS);
    expect(result).toMatchObject({ status: 'error', error: { code: 'no-sync' }, consumedBytes: 1, recoverable: true });
  });

  it('yapılandırma frameLength > maxFrameLength ise fırlatır (veri hatası değil)', () => {
    const extractor = createFixedLengthExtractor({ frameLength: 2000 });
    expect(() => extractor.extract(new Uint8Array(0), OPTIONS)).toThrow(RangeError);
  });
});
