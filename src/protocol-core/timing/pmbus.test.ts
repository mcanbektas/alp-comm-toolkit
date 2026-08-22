import { describe, expect, it } from 'vitest';

import {
  decodeDirect,
  decodeLinear11,
  decodeLinear11Parts,
  decodeLinear16,
  decodeVoutMode,
  encodeDirect,
  encodeLinear11,
  encodeLinear16,
  parseDirectCoefficients,
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

/**
 * DIRECT format fixture'ları İKİ BAĞIMSIZ birincil kaynaktan:
 * (1) PMBus Spec Part II Rev 1.3.1 §7.4 — denklemlerin kendisi,
 * (2) SMIF'in APEC 2017 sunumu "Direct Format Examples" — m=1, b=0 sadeleştirmesi
 *     ve ondan türeyen SAYISAL iddialar ("R=3 → 1 mV LSB, 32.7 V aralık";
 *     "R=2 → 10 mV LSB, 327 V aralık"). Bu iddialar aşağıda kodla sınanıyor.
 */
describe('decodeDirect / encodeDirect', () => {
  it('SMIF APEC 2017 sadeleştirmesi: m=1, b=0, R=3 → X = Y × 10^-3', () => {
    const coefficients = { m: 1, b: 0, r: 3 };

    expect(decodeDirect(12000, coefficients)).toBeCloseTo(12, 12);
    // Sunumun "1 mV LSB" iddiası: bir sayım farkı tam 0.001 V.
    expect(decodeDirect(12001, coefficients) - decodeDirect(12000, coefficients)).toBeCloseTo(0.001, 12);
    // Sunumun "32.7 V aralık" iddiası: Y'nin 16-bit two's complement tavanı 32767.
    expect(decodeDirect(32767, coefficients)).toBeCloseTo(32.767, 12);
  });

  it('SMIF APEC 2017: R=2 → 10 mV LSB, 327 V aralık', () => {
    const coefficients = { m: 1, b: 0, r: 2 };

    expect(decodeDirect(1, coefficients)).toBeCloseTo(0.01, 12);
    expect(decodeDirect(32767, coefficients)).toBeCloseTo(327.67, 12);
  });

  it('m ve b sıfırdan farklıyken §7.4.1 denklemi: X = (1/m)(Y × 10^-R − b)', () => {
    // Elle kurulmuş, kaynak denklemden bağımsızca hesaplanmış:
    // Y=2000, m=2, b=-100, R=1 → (2000×10^-1 − (−100))/2 = (200+100)/2 = 150.
    expect(decodeDirect(2000, { m: 2, b: -100, r: 1 })).toBeCloseTo(150, 12);
  });

  it('Y iki tümleyen okunur — negatif ham word negatif X verir', () => {
    // 0xFFFF = −1 → (−1 × 10^0 − 0)/1 = −1.
    expect(decodeDirect(0xffff, { m: 1, b: 0, r: 0 })).toBeCloseTo(-1, 12);
  });

  it('encodeDirect §7.4.2 ile decodeDirect §7.4.1 birbirinin tersi', () => {
    const coefficients = { m: 3, b: 250, r: 2 };
    const word = encodeDirect(12.5, coefficients);

    expect(decodeDirect(word, coefficients)).toBeCloseTo(12.5, 6);
  });

  it('m = 0 reddedilir (denklemde bölen)', () => {
    expect(() => decodeDirect(1, { m: 0, b: 0, r: 0 })).toThrow(RangeError);
    expect(() => encodeDirect(1, { m: 0, b: 0, r: 0 })).toThrow(RangeError);
  });

  it('katsayı genişlikleri zorlanır: m/b 2 bayt, R 1 bayt (§7.4.1)', () => {
    expect(() => decodeDirect(1, { m: 32768, b: 0, r: 0 })).toThrow(RangeError);
    expect(() => decodeDirect(1, { m: 1, b: -32769, r: 0 })).toThrow(RangeError);
    expect(() => decodeDirect(1, { m: 1, b: 0, r: 128 })).toThrow(RangeError);
  });

  it('Y 16-bit aralığını aşan kodlama sessizce kırpılmaz, RangeError fırlatır', () => {
    expect(() => encodeDirect(100, { m: 1, b: 0, r: 3 })).toThrow(RangeError);
  });
});

describe('parseDirectCoefficients', () => {
  it('§14.1 bayt sırası: m alt, m üst, b alt, b üst, R', () => {
    // m = 0x0001 = 1, b = 0xFF9C = −100, R = 0x03 = 3.
    const bytes = Uint8Array.from([0x01, 0x00, 0x9c, 0xff, 0x03]);

    expect(parseDirectCoefficients(bytes)).toEqual({ m: 1, b: -100, r: 3 });
  });

  it('R tek bayt iki tümleyendir — 0xFE → −2', () => {
    expect(parseDirectCoefficients(Uint8Array.from([0x02, 0x00, 0x00, 0x00, 0xfe])).r).toBe(-2);
  });

  it('5 bayttan farklı uzunluk reddedilir (byte count çağıranda ayıklanır)', () => {
    expect(() => parseDirectCoefficients(Uint8Array.from([0x01, 0x00, 0x00, 0x00]))).toThrow(RangeError);
  });
});

describe('decodeVoutMode', () => {
  it('Table 2: bit[6:5] mode seçer', () => {
    expect(decodeVoutMode(0b0000_0000).mode).toBe('ulinear16');
    expect(decodeVoutMode(0b0010_0000).mode).toBe('vid');
    expect(decodeVoutMode(0b0100_0000).mode).toBe('direct');
    expect(decodeVoutMode(0b0110_0000).mode).toBe('ieee-half');
  });

  it('ULINEAR16 parametresi 5-bit iki tümleyen exponent (Note 1)', () => {
    // 0b10111 = −9, PmbusLinearTool'un varsayılan Linear16 üssüyle aynı.
    expect(decodeVoutMode(0b0001_0111).exponent).toBe(-9);
    expect(decodeVoutMode(0b0000_0001).exponent).toBe(1);
  });

  it('Direct/VID/IEEE modlarında exponent ÜRETİLMEZ (uydurma üs yok)', () => {
    expect(decodeVoutMode(0b0100_0000).exponent).toBeUndefined();
    expect(decodeVoutMode(0b0010_0011).exponent).toBeUndefined();
    expect(decodeVoutMode(0b0110_0000).exponent).toBeUndefined();
  });

  it('bit[7] mode seçiminden bağımsız Absolute/Relative ayrımıdır', () => {
    expect(decodeVoutMode(0b0000_0000).relative).toBe(false);
    expect(decodeVoutMode(0b1000_0000).relative).toBe(true);
    // Relative bayrağı mode çözümünü değiştirmez.
    expect(decodeVoutMode(0b1110_0000).mode).toBe('ieee-half');
    expect(decodeVoutMode(0b1110_0000).relative).toBe(true);
  });
});
