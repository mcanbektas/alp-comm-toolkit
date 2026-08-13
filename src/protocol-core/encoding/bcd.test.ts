import { describe, expect, it } from 'vitest';

import { decodeBcd, encodeBcd } from './bcd';

describe('encodeBcd', () => {
  it('encodes 1234 to the canonical two-byte example', () => {
    expect(Array.from(encodeBcd(1234))).toEqual([0x12, 0x34]);
  });

  it('pads an odd digit count with a leading zero nibble', () => {
    expect(Array.from(encodeBcd(5))).toEqual([0x05]);
    expect(Array.from(encodeBcd(123))).toEqual([0x01, 0x23]);
  });

  it('encodes zero as a single zero byte', () => {
    expect(Array.from(encodeBcd(0))).toEqual([0x00]);
  });

  it('rejects negative and non-integer input', () => {
    expect(() => encodeBcd(-1)).toThrow();
    expect(() => encodeBcd(1.5)).toThrow();
  });
});

describe('decodeBcd', () => {
  it('decodes the canonical two-byte example back to 1234', () => {
    expect(decodeBcd(Uint8Array.of(0x12, 0x34))).toBe(1234);
  });

  it('rejects a nibble outside the 0-9 digit range', () => {
    expect(() => decodeBcd(Uint8Array.of(0x1a))).toThrow(/nibble/);
    expect(() => decodeBcd(Uint8Array.of(0xf3))).toThrow(/nibble/);
  });

  it('returns 0 for an empty byte array', () => {
    expect(decodeBcd(Uint8Array.of())).toBe(0);
  });
});

describe('BCD round-trip', () => {
  it('recovers the original value for a range of magnitudes', () => {
    for (const value of [0, 7, 42, 999, 1234, 987654]) {
      expect(decodeBcd(encodeBcd(value))).toBe(value);
    }
  });
});
