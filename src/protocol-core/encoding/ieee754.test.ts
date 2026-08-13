import { describe, expect, it } from 'vitest';

import {
  decodeFloat16,
  decodeFloat32,
  decodeFloat64,
  encodeFloat16,
  encodeFloat32,
  encodeFloat64,
} from './ieee754';

describe('Float32', () => {
  it('encodes 25.75 to the known spec fixture (big-endian)', () => {
    // Spec §43 fixture'ı: 25.75 → 41 CE 00 00 (büyük-uçlu).
    expect(Array.from(encodeFloat32(25.75, 'big'))).toEqual([0x41, 0xce, 0x00, 0x00]);
  });

  it('encodes 25.75 to the known spec fixture (little-endian)', () => {
    expect(Array.from(encodeFloat32(25.75, 'little'))).toEqual([0x00, 0x00, 0xce, 0x41]);
  });

  it('decodes both endianness fixtures back to 25.75', () => {
    expect(decodeFloat32(Uint8Array.of(0x41, 0xce, 0x00, 0x00), 'big')).toBe(25.75);
    expect(decodeFloat32(Uint8Array.of(0x00, 0x00, 0xce, 0x41), 'little')).toBe(25.75);
  });

  it('throws on wrong byte length', () => {
    expect(() => decodeFloat32(Uint8Array.of(0x00, 0x00), 'big')).toThrow();
  });

  it('round-trips negative and fractional values', () => {
    for (const value of [-1.5, 0, -0, 3.1415927, 1e10]) {
      const bytes = encodeFloat32(value, 'little');
      expect(decodeFloat32(bytes, 'little')).toBeCloseTo(value, 5);
    }
  });
});

describe('Float64', () => {
  it('round-trips through both endianness', () => {
    const value = 25.75;
    expect(decodeFloat64(encodeFloat64(value, 'big'), 'big')).toBe(value);
    expect(decodeFloat64(encodeFloat64(value, 'little'), 'little')).toBe(value);
  });

  it('preserves full double precision', () => {
    const value = Math.PI;
    expect(decodeFloat64(encodeFloat64(value, 'big'), 'big')).toBe(value);
  });

  it('throws on wrong byte length', () => {
    expect(() => decodeFloat64(Uint8Array.of(0x00), 'big')).toThrow();
  });
});

describe('Float16', () => {
  // Wikipedia "Half-precision floating-point format" bilinen örnekleri.
  it.each([
    [1, 0x3c00],
    [-2, 0xc000],
    [0, 0x0000],
    [65504, 0x7bff], // en büyük normal half değeri
    [0.00006103515625, 0x0400], // en küçük pozitif normal half değeri (2^-14)
  ])('encodes %f to bit pattern 0x%s (big-endian)', (value, expectedBits) => {
    const bytes = encodeFloat16(value, 'big');
    const bits = (bytes[0]! << 8) | bytes[1]!;
    expect(bits).toBe(expectedBits);
  });

  it('encodes negative zero with the sign bit set', () => {
    const bytes = encodeFloat16(-0, 'big');
    expect(((bytes[0]! << 8) | bytes[1]!)).toBe(0x8000);
  });

  it('encodes +Infinity and -Infinity', () => {
    expect(Array.from(encodeFloat16(Infinity, 'big'))).toEqual([0x7c, 0x00]);
    expect(Array.from(encodeFloat16(-Infinity, 'big'))).toEqual([0xfc, 0x00]);
  });

  it('round-trips through little-endian byte order', () => {
    const bytesBig = encodeFloat16(1, 'big');
    const bytesLittle = encodeFloat16(1, 'little');
    expect(Array.from(bytesLittle)).toEqual([bytesBig[1], bytesBig[0]]);
    expect(decodeFloat16(bytesLittle, 'little')).toBe(1);
  });

  it('round-trips representable half values', () => {
    for (const value of [1, -1, 0.5, -0.5, 2, 100, -100]) {
      expect(decodeFloat16(encodeFloat16(value, 'big'), 'big')).toBeCloseTo(value, 2);
    }
  });

  it('decodes NaN bit pattern back to NaN', () => {
    const bytes = encodeFloat16(NaN, 'big');
    expect(Number.isNaN(decodeFloat16(bytes, 'big'))).toBe(true);
  });

  it('throws on wrong byte length', () => {
    expect(() => decodeFloat16(Uint8Array.of(0x00), 'big')).toThrow();
  });
});
