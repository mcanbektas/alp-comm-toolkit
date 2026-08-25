import { describe, expect, it } from 'vitest';

import {
  MAX_PULSE_DURATION_US,
  RESERVED_REGISTER_VALUE,
  decodePulseLog,
  encodePulseLog,
  isWithinPulseBand,
  pulseByteSpan,
} from './pulseLog';

/**
 * Faz 10 dalga 14g — bu testler `j1850/j1850Pulse.test.ts`ten TAŞINDI (yalnız
 * konteynerin KENDİSİNE ait olanlar). `isShortPulse`/`deriveAlternatingLevels`/
 * `packBitsToBytes` testleri J1850'ye özel kaldıkları için orada kalır.
 */
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

describe('isWithinPulseBand — rezerve + MUTLAK/ORANLI bant kontrolü tek yerde', () => {
  it('rezerve nabız bandın içinde olsa bile false döner', () => {
    const outcome = decodePulseLog(encodePulseLog([0]));
    if (!outcome.ok) throw new Error('expected ok');
    // encodePulseLog(0) rezerveyle çakışmamak için 1 kayda (0.1 µs) yükseltiyor,
    // bu yüzden gerçek rezerve durumunu ELLE kuruyoruz.
    const reservedPulse = { rawRegister: 0, durationUs: 0, reserved: true };
    expect(isWithinPulseBand(reservedPulse, 0, 1000)).toBe(false);
  });

  it('süre bandın İÇİNDEYSE (uçlar dahil) true döner', () => {
    const pulse = { rawRegister: 100, durationUs: 10, reserved: false };
    expect(isWithinPulseBand(pulse, 10, 20)).toBe(true);
    expect(isWithinPulseBand(pulse, 5, 10)).toBe(true);
  });

  it('süre bandın DIŞINDAYSA false döner', () => {
    const pulse = { rawRegister: 100, durationUs: 10, reserved: false };
    expect(isWithinPulseBand(pulse, 11, 20)).toBe(false);
    expect(isWithinPulseBand(pulse, 1, 9)).toBe(false);
  });
});
