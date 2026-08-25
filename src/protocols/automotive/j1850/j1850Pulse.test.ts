import { describe, expect, it } from 'vitest';

/**
 * Faz 10 dalga 14g karar 1 — `decodePulseLog`/`encodePulseLog`/`pulseByteSpan`
 * testleri `@/protocol-core/decoding/pulseLog.test.ts`e TAŞINDI (konteynerin
 * KENDİSİ oraya taşındı). Burada YALNIZ J1850'ye özel kalan parçalar test
 * edilir.
 */
import { deriveAlternatingLevels, isShortPulse, packBitsToBytes, unpackBytesToBits } from './j1850Pulse';

describe('isShortPulse — spec’in çalışılmış örnekleri (ozet 04-otomotiv.md)', () => {
  // PWM varsayılan eşiği 12 µs (8/16 µs örneklerinin ORTA NOKTASI — bkz. j1850Pwm.ts).
  const PWM_DEFAULT_THRESHOLD_US = 12;

  it('8.1 µs kısa sayılır — PWM bunu Bit 1 okur (`:397`)', () => {
    expect(isShortPulse(8.1, PWM_DEFAULT_THRESHOLD_US)).toBe(true);
  });

  it('15.9 µs uzun sayılır — PWM bunu Bit 0 okur (`:397`)', () => {
    expect(isShortPulse(15.9, PWM_DEFAULT_THRESHOLD_US)).toBe(false);
  });

  it('8.0 µs kısa sayılır — PWM bunu Bit 1 okur (`:397`)', () => {
    expect(isShortPulse(8.0, PWM_DEFAULT_THRESHOLD_US)).toBe(true);
  });

  // VPW varsayılan eşiği 96 µs (64/128 µs örneklerinin ORTA NOKTASI — bkz. j1850Vpw.ts).
  const VPW_DEFAULT_THRESHOLD_US = 96;

  it('Active 64 µs kısa sayılır (`:411`)', () => {
    expect(isShortPulse(64, VPW_DEFAULT_THRESHOLD_US)).toBe(true);
  });

  it('Passive 128 µs uzun sayılır (`:411`)', () => {
    expect(isShortPulse(128, VPW_DEFAULT_THRESHOLD_US)).toBe(false);
  });
});

describe('deriveAlternatingLevels — VPW’nin "tek bilinmeyen ilk seviye" kararı', () => {
  it('Active 64 / Passive 128 / Active 64 dizisinin seviyeleri active’ten alterne eder (`:411`)', () => {
    expect(deriveAlternatingLevels(3, 'active')).toEqual(['active', 'passive', 'active']);
  });

  it('initialLevel=passive ile TERS sırada alterne eder', () => {
    expect(deriveAlternatingLevels(3, 'passive')).toEqual(['passive', 'active', 'passive']);
  });
});

describe('packBitsToBytes / unpackBytesToBits — bit sırası KANITI', () => {
  // 0x61 = 0110 0001 → MSB-first bit7..bit0 sırayla: 0,1,1,0,0,0,0,1.
  // Bu dizi ELLE, packBitsToBytes'ın gövdesine BAKMADAN türetildi (bağımsız kanıt).
  const BITS_OF_0X61: readonly (0 | 1)[] = [0, 1, 1, 0, 0, 0, 0, 1];

  it('MSB-first: elle türetilmiş bit dizisi 0x61’i üretir', () => {
    expect(packBitsToBytes(BITS_OF_0X61, 'msb-first')).toEqual(new Uint8Array([0x61]));
  });

  it('LSB-first: AYNI dizi FARKLI bir bayt üretir — sıra gerçekten sonucu değiştiriyor', () => {
    // LSB-first: ilk bit EN DÜŞÜK konuma gider → 1000 0110 = 0x86.
    expect(packBitsToBytes(BITS_OF_0X61, 'lsb-first')).toEqual(new Uint8Array([0x86]));
  });

  it('unpackBytesToBits, packBitsToBytes’ın MSB-first’te tam tersidir', () => {
    expect(unpackBytesToBits(new Uint8Array([0x61]), 'msb-first')).toEqual(BITS_OF_0X61);
  });

  it('çok baytlı bir dizide sıra korunur (bayt sınırı bit akışını bölmez)', () => {
    const bytes = new Uint8Array([0xa5, 0x3c]);
    const bits = unpackBytesToBits(bytes, 'msb-first');
    expect(packBitsToBytes(bits, 'msb-first')).toEqual(bytes);
  });
});
