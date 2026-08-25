import { describe, expect, it } from 'vitest';

import {
  MAX_PULSE_DURATION_US,
  RESERVED_REGISTER_VALUE,
  decodePulseLog,
  deriveAlternatingLevels,
  encodePulseLog,
  isShortPulse,
  packBitsToBytes,
  pulseByteSpan,
  unpackBytesToBits,
} from './j1850Pulse';

describe('decodePulseLog — konteyner sözleşmesi', () => {
  it('boş girdide "empty" ile başarısız olur', () => {
    const outcome = decodePulseLog(new Uint8Array());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.kind).toBe('empty');
  });

  it('tek uzunlukta "odd-length" ile başarısız olur — madde 2', () => {
    const outcome = decodePulseLog(new Uint8Array(3));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.kind).toBe('odd-length');
      if (outcome.failure.kind === 'odd-length') expect(outcome.failure.length).toBe(3);
    }
  });

  it('0 değerini REZERVE olarak işaretler, süreye ÇEVİRMEZ — madde 3', () => {
    const outcome = decodePulseLog(new Uint8Array([0x00, 0x00, 0x50, 0x00]));
    if (!outcome.ok) throw new Error('expected ok');
    expect(outcome.result.pulses[0]?.reserved).toBe(true);
    expect(outcome.result.pulses[1]?.reserved).toBe(false);
  });

  it('Uint16LE kaydını 0.1 µs biriminde süreye çevirir — madde 1', () => {
    // 8.1 µs → 81 → 0x51, 0x00 (little-endian).
    const outcome = decodePulseLog(new Uint8Array([0x51, 0x00]));
    if (!outcome.ok) throw new Error('expected ok');
    // 0.1 kayan noktada tam temsil edilmez; toBeCloseTo epsilon'u tolere eder.
    expect(outcome.result.pulses[0]?.durationUs).toBeCloseTo(8.1, 6);
    expect(outcome.result.pulses[0]?.rawRegister).toBe(81);
  });

  it('en uzun temsil edilebilir süre 6553.5 µs’dir — üst sınır', () => {
    const outcome = decodePulseLog(new Uint8Array([0xff, 0xff]));
    if (!outcome.ok) throw new Error('expected ok');
    expect(outcome.result.pulses[0]?.durationUs).toBeCloseTo(MAX_PULSE_DURATION_US, 6);
  });

  it('nabızlar KESİN SIRAYLA ardışık okunur — madde 4', () => {
    const outcome = decodePulseLog(encodePulseLog([8, 16, 8]));
    if (!outcome.ok) throw new Error('expected ok');
    expect(outcome.result.pulses.map((p) => p.durationUs)).toEqual([
      expect.closeTo(8, 6),
      expect.closeTo(16, 6),
      expect.closeTo(8, 6),
    ]);
  });
});

describe('encodePulseLog — decodePulseLog’un tersi, örnek/test üretimi için', () => {
  it('RESERVED_REGISTER_VALUE ile çakışmaması için sıfıra yuvarlanan süreyi 1 kayda yükseltir', () => {
    const bytes = encodePulseLog([0]);
    const outcome = decodePulseLog(bytes);
    if (!outcome.ok) throw new Error('expected ok');
    expect(outcome.result.pulses[0]?.reserved).toBe(false);
    expect(outcome.result.pulses[0]?.rawRegister).toBe(RESERVED_REGISTER_VALUE + 1);
  });

  it('encode → decode round-trip süreleri korur', () => {
    const durations = [40, 8, 16, 8, 8, 16, 16, 8, 200.5];
    const outcome = decodePulseLog(encodePulseLog(durations));
    if (!outcome.ok) throw new Error('expected ok');
    outcome.result.pulses.forEach((pulse, index) => {
      expect(pulse.durationUs).toBeCloseTo(durations[index] ?? -1, 1);
    });
  });
});

describe('pulseByteSpan — nabız aralığından KAPSAYAN bayt aralığına', () => {
  it('nabız 0 konteynerin ilk 2 baytıdır', () => {
    expect(pulseByteSpan(0, 1)).toEqual({ offset: 0, length: 2 });
  });

  it('8 nabızlık bir bayt (ör. Header), 1. nabızdan başlarsa 2-18 bayt aralığını kapsar', () => {
    expect(pulseByteSpan(1, 8)).toEqual({ offset: 2, length: 16 });
  });
});

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
