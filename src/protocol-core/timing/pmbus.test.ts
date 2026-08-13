import { describe, expect, it } from 'vitest';

import {
  decodeLinear11,
  decodeLinear11Parts,
  decodeLinear16,
  encodeLinear11,
  encodeLinear16,
} from './pmbus';

describe('decodeLinear11', () => {
  it('elle kurulmuş word (exponent=-3, mantissa=100) → 12.5', () => {
    // Bit yerleşimi: üst 5 bit exponent (2's complement), alt 11 bit mantissa (2's complement).
    // exponent=-3 → 5-bit alan 0b11101=0x1D; mantissa=100 → 11-bit alan 0b00001100100=0x064.
    // word = (0x1D << 11) | 0x064 = 0xE864.
    const word = 0xe864;

    expect(decodeLinear11Parts(word)).toEqual({ exponent: -3, mantissa: 100 });
    expect(decodeLinear11(word)).toBeCloseTo(12.5, 12);
  });

  it('pozitif exponent ve pozitif mantissa (exponent=2, mantissa=5 → 20)', () => {
    const word = encodeLinear11(20, 2);

    expect(decodeLinear11Parts(word)).toEqual({ exponent: 2, mantissa: 5 });
    expect(decodeLinear11(word)).toBeCloseTo(20, 12);
  });
});

describe('encodeLinear11 / decodeLinear11 round-trip', () => {
  it('exponent verilmezse en hassas (en negatif sığan) exponent otomatik seçilir', () => {
    const word = encodeLinear11(12.5);

    expect(decodeLinear11(word)).toBeCloseTo(12.5, 9);
  });

  it('negatif değer için round-trip', () => {
    const word = encodeLinear11(-3.25);

    expect(decodeLinear11(word)).toBeCloseTo(-3.25, 9);
  });

  it('mantissa 11-bit aralığını aşarsa RangeError fırlatır', () => {
    // exponent=-16 (en küçük) ile bile mantissa 1023'ü aşan bir değer sığmaz.
    expect(() => encodeLinear11(1024, -16)).toThrow(RangeError);
  });
});

describe('decodeLinear16 / encodeLinear16', () => {
  it('sabit exponent ile round-trip (VOUT_MODE exponent=-8 tipik örneği)', () => {
    // Elle doğrulama: mantissa=3082, exponent=-8 → 3082 × 2^-8 = 12.0390625.
    const decoded = decodeLinear16(3082, -8);
    expect(decoded).toBeCloseTo(12.0390625, 12);

    const reEncoded = encodeLinear16(decoded, -8);
    expect(reEncoded).toBe(3082);
  });

  it('mantissa işaretsiz aralığı aşarsa RangeError fırlatır', () => {
    expect(() => encodeLinear16(-1, 0)).toThrow(RangeError);
    expect(() => encodeLinear16(0x10000, 0)).toThrow(RangeError);
  });
});
