import { describe, expect, it } from 'vitest';

import { bytesToNumber, numberToBytes, toSignedInt, toUnsignedRaw } from './endianness';

describe('bytesToNumber / numberToBytes — little/big endian', () => {
  it('reads a little-endian byte sequence as Σ Byte[i] × 256^i', () => {
    // 0x12345678 little-endian bayt sırası: 78 56 34 12
    const bytes = Uint8Array.of(0x78, 0x56, 0x34, 0x12);
    expect(bytesToNumber(bytes, 'little')).toBe(0x12345678);
  });

  it('reads a big-endian byte sequence as Σ Byte[i] × 256^(N-1-i)', () => {
    const bytes = Uint8Array.of(0x12, 0x34, 0x56, 0x78);
    expect(bytesToNumber(bytes, 'big')).toBe(0x12345678);
  });

  it('round-trips a value through numberToBytes and bytesToNumber for both orders', () => {
    const value = 0x010203c4;
    expect(bytesToNumber(numberToBytes(value, 4, 'little'), 'little')).toBe(value);
    expect(bytesToNumber(numberToBytes(value, 4, 'big'), 'big')).toBe(value);
  });

  it('rejects a value that cannot fit in the requested byte length', () => {
    expect(() => numberToBytes(256, 1, 'big')).toThrow();
  });

  it('rejects a byte length beyond the safe-integer limit', () => {
    expect(() => bytesToNumber(new Uint8Array(7), 'big')).toThrow();
  });
});

describe('bytesToNumber / numberToBytes — mixed (PDP) endian', () => {
  it('decodes word-swapped bytes: each 16-bit word little-endian, words themselves big-endian', () => {
    // 0x12345678 mixed-endian (PDP) bayt sırası: 34 12 78 56 — bilinen referans örnek
    const bytes = Uint8Array.of(0x34, 0x12, 0x78, 0x56);
    expect(bytesToNumber(bytes, 'mixed')).toBe(0x12345678);
  });

  it('encodes a value into the mixed-endian byte order', () => {
    expect(numberToBytes(0x12345678, 4, 'mixed')).toEqual(Uint8Array.of(0x34, 0x12, 0x78, 0x56));
  });

  it('round-trips a value through mixed-endian encode/decode', () => {
    const value = 0x0badf00d & 0x7fffffff; // 31 bitlik pozitif bir sınama değeri
    const bytes = numberToBytes(value, 4, 'mixed');
    expect(bytesToNumber(bytes, 'mixed')).toBe(value);
  });

  it('rejects an odd byte length, since 16-bit words cannot be split', () => {
    expect(() => numberToBytes(0x123456, 3, 'mixed')).toThrow();
  });
});

describe("toSignedInt / toUnsignedRaw — N-bit two's complement", () => {
  it('returns the raw value unchanged below the sign boundary', () => {
    expect(toSignedInt(100, 8)).toBe(100);
  });

  it('converts 0xF6 (246) as an 8-bit value to -10', () => {
    expect(toSignedInt(0xf6, 8)).toBe(-10);
  });

  it('converts -10 back to the 8-bit unsigned raw representation 0xF6', () => {
    expect(toUnsignedRaw(-10, 8)).toBe(0xf6);
  });

  it('round-trips the full 8-bit range', () => {
    for (let raw = 0; raw < 256; raw++) {
      expect(toUnsignedRaw(toSignedInt(raw, 8), 8)).toBe(raw);
    }
  });

  it('rejects a raw value outside the bit width', () => {
    expect(() => toSignedInt(256, 8)).toThrow();
  });

  it('rejects a signed value outside the representable range', () => {
    expect(() => toUnsignedRaw(128, 8)).toThrow();
    expect(() => toUnsignedRaw(-129, 8)).toThrow();
  });
});
