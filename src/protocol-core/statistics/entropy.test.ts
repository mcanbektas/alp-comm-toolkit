import { describe, expect, it } from 'vitest';

import { MAX_BYTE_ENTROPY_BITS, byteEntropyBits, normalizedByteEntropy, shannonEntropyBits } from './entropy';

describe('shannonEntropyBits', () => {
  it('sabit seride sıfırdır', () => {
    expect(shannonEntropyBits([7, 7, 7, 7])).toBe(0);
  });

  it('iki eşit olasılıklı değerde tam 1 bittir', () => {
    expect(shannonEntropyBits([0, 1, 0, 1])).toBeCloseTo(1, 12);
  });

  it('dört eşit olasılıklı değerde 2 bittir', () => {
    expect(shannonEntropyBits([0, 1, 2, 3])).toBeCloseTo(2, 12);
  });

  it('görülmeyen değerler NaN üretmez', () => {
    // 256 olası bayt değerinin çoğu hiç görülmüyor; p=0 terimi atlanmalı.
    expect(Number.isNaN(shannonEntropyBits([1, 2, 3]))).toBe(false);
  });

  it('boş seride sıfırdır', () => {
    expect(shannonEntropyBits([])).toBe(0);
  });
});

describe('byteEntropyBits', () => {
  it('256 farklı bayt tam 8 bit verir', () => {
    const bytes = new Uint8Array(Array.from({ length: 256 }, (_unused, index) => index));
    expect(byteEntropyBits(bytes)).toBeCloseTo(MAX_BYTE_ENTROPY_BITS, 12);
    expect(normalizedByteEntropy(bytes)).toBeCloseTo(1, 12);
  });
});
