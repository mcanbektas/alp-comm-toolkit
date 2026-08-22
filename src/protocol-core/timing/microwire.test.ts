import { describe, expect, it } from 'vitest';

import {
  MICROWIRE_PROFILE_PRESETS,
  calculateMicrowireTransferTime,
  decodeMicrowire,
  microwireClockCycles,
  microwireCommandHasAddress,
  microwireCommandHasData,
} from './microwire';
import type { MicrowireCommand, MicrowireProfile } from './microwire';

function presetById(id: string): MicrowireProfile {
  const preset = MICROWIRE_PROFILE_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) throw new Error(`bilinmeyen preset: ${id}`);
  return preset;
}

/**
 * Bitleri MSB-first paketler ve bayta tamamlar — datasheet çerçeveleri bayta
 * bölünmez (25/18/27/20 clock), kalan bitler sıfırla doldurulur.
 */
function packBits(bits: readonly number[]): Uint8Array {
  const byteLength = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteLength);
  bits.forEach((bit, index) => {
    if (bit === 1) bytes[index >> 3] = (bytes[index >> 3] ?? 0) | (0x80 >> (index % 8));
  });
  return bytes;
}

function numberToBits(value: number, length: number): number[] {
  const bits: number[] = [];
  for (let index = length - 1; index >= 0; index -= 1) bits.push((value >> index) & 1);
  return bits;
}

describe('microwire — datasheet clock cycle tablosu', () => {
  /**
   * Bu tablo motordan TÜRETİLMEDİ, iki datasheet'in "Req. CLK Cycles"
   * sütunundan birebir kopyalandı (DS20001749K Tablo 1-3/1-4, DS21794F Tablo
   * 1-3/1-4). Formül değişirse burası kırılır — kastedilen budur.
   */
  const CASES: readonly {
    profileId: string;
    command: MicrowireCommand;
    expectedCycles: number;
  }[] = [
    { profileId: '93xx46-x16', command: 'READ', expectedCycles: 25 },
    { profileId: '93xx46-x16', command: 'WRITE', expectedCycles: 25 },
    { profileId: '93xx46-x16', command: 'WRAL', expectedCycles: 25 },
    { profileId: '93xx46-x16', command: 'ERASE', expectedCycles: 9 },
    { profileId: '93xx46-x16', command: 'ERAL', expectedCycles: 9 },
    { profileId: '93xx46-x16', command: 'EWEN', expectedCycles: 9 },
    { profileId: '93xx46-x16', command: 'EWDS', expectedCycles: 9 },

    { profileId: '93xx46-x8', command: 'READ', expectedCycles: 18 },
    { profileId: '93xx46-x8', command: 'WRITE', expectedCycles: 18 },
    { profileId: '93xx46-x8', command: 'WRAL', expectedCycles: 18 },
    { profileId: '93xx46-x8', command: 'ERASE', expectedCycles: 10 },
    { profileId: '93xx46-x8', command: 'ERAL', expectedCycles: 10 },
    { profileId: '93xx46-x8', command: 'EWEN', expectedCycles: 10 },
    { profileId: '93xx46-x8', command: 'EWDS', expectedCycles: 10 },

    { profileId: '93xx56-x16', command: 'READ', expectedCycles: 27 },
    { profileId: '93xx56-x16', command: 'WRITE', expectedCycles: 27 },
    { profileId: '93xx56-x16', command: 'WRAL', expectedCycles: 27 },
    { profileId: '93xx56-x16', command: 'ERASE', expectedCycles: 11 },
    { profileId: '93xx56-x16', command: 'ERAL', expectedCycles: 11 },
    { profileId: '93xx56-x16', command: 'EWEN', expectedCycles: 11 },
    { profileId: '93xx56-x16', command: 'EWDS', expectedCycles: 11 },

    { profileId: '93xx56-x8', command: 'READ', expectedCycles: 20 },
    { profileId: '93xx56-x8', command: 'WRITE', expectedCycles: 20 },
    { profileId: '93xx56-x8', command: 'WRAL', expectedCycles: 20 },
    { profileId: '93xx56-x8', command: 'ERASE', expectedCycles: 12 },
    { profileId: '93xx56-x8', command: 'ERAL', expectedCycles: 12 },
    { profileId: '93xx56-x8', command: 'EWEN', expectedCycles: 12 },
    { profileId: '93xx56-x8', command: 'EWDS', expectedCycles: 12 },
  ];

  it.each(CASES)(
    '$profileId $command → $expectedCycles clock',
    ({ profileId, command, expectedCycles }) => {
      expect(microwireClockCycles(presetById(profileId), command)).toBe(expectedCycles);
    },
  );

  it('her preset kaynak belgesini taşır — kaynaksız preset eklenmez', () => {
    for (const preset of MICROWIRE_PROFILE_PRESETS) {
      expect(preset.source).toMatch(/^Microchip DS\d+[A-Z] Table 1-[34]$/);
    }
  });

  it('93xx66 preset olarak GÖNDERİLMEZ — komut tablosu doğrulanmadı', () => {
    expect(MICROWIRE_PROFILE_PRESETS.map((preset) => preset.id)).not.toContain('93xx66-x16');
    expect(MICROWIRE_PROFILE_PRESETS.map((preset) => preset.id)).not.toContain('93xx66-x8');
  });
});

describe('microwireCommandHasAddress / HasData', () => {
  it('adres yalnız READ/WRITE/ERASE komutlarında anlamlı', () => {
    expect(microwireCommandHasAddress('READ')).toBe(true);
    expect(microwireCommandHasAddress('WRITE')).toBe(true);
    expect(microwireCommandHasAddress('ERASE')).toBe(true);
    expect(microwireCommandHasAddress('EWEN')).toBe(false);
    expect(microwireCommandHasAddress('EWDS')).toBe(false);
    expect(microwireCommandHasAddress('ERAL')).toBe(false);
    expect(microwireCommandHasAddress('WRAL')).toBe(false);
  });

  it('veri sözcüğü yalnız READ/WRITE/WRAL taşır', () => {
    expect(microwireCommandHasData('READ')).toBe(true);
    expect(microwireCommandHasData('WRITE')).toBe(true);
    expect(microwireCommandHasData('WRAL')).toBe(true);
    expect(microwireCommandHasData('ERASE')).toBe(false);
    expect(microwireCommandHasData('ERAL')).toBe(false);
    expect(microwireCommandHasData('EWEN')).toBe(false);
    expect(microwireCommandHasData('EWDS')).toBe(false);
  });
});

describe('decodeMicrowire — 93xx46 x16 (DS20001749K Tablo 1-3)', () => {
  const profile = presetById('93xx46-x16');

  it('READ adres 0x0A → SB=1, opcode=10, adres 6 bit, veri 16 bit', () => {
    const bits = [1, 1, 0, ...numberToBits(0x0a, 6), ...numberToBits(0xbeef, 16)];
    const outcome = decodeMicrowire(packBits(bits), profile);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.command).toBe('READ');
    expect(outcome.result.address).toBe(0x0a);
    expect(outcome.result.data).toBe(0xbeef);
    expect(outcome.result.totalBits).toBe(25);
    expect(outcome.result.leadingIdleBits).toBe(0);
  });

  it('WRITE opcode 01', () => {
    const bits = [1, 0, 1, ...numberToBits(0x3f, 6), ...numberToBits(0x1234, 16)];
    const outcome = decodeMicrowire(packBits(bits), profile);
    expect(outcome.ok && outcome.result.command).toBe('WRITE');
    expect(outcome.ok && outcome.result.address).toBe(0x3f);
    expect(outcome.ok && outcome.result.data).toBe(0x1234);
  });

  it('ERASE opcode 11, veri alanı YOK', () => {
    const bits = [1, 1, 1, ...numberToBits(0x05, 6)];
    const outcome = decodeMicrowire(packBits(bits), profile);
    expect(outcome.ok && outcome.result.command).toBe('ERASE');
    expect(outcome.ok && outcome.result.address).toBe(0x05);
    expect(outcome.ok && outcome.result.data).toBeUndefined();
    expect(outcome.ok && outcome.result.totalBits).toBe(9);
  });

  /** Genişletilmiş dörtlü: opcode 00, seçici adres alanının üst iki biti. */
  it.each([
    { selector: 0b00, expected: 'EWDS' },
    { selector: 0b01, expected: 'WRAL' },
    { selector: 0b10, expected: 'ERAL' },
    { selector: 0b11, expected: 'EWEN' },
  ])('opcode 00 + seçici $selector → $expected', ({ selector, expected }) => {
    const addressField = selector << 4; // üst iki bit seçici, alt dördü don't-care
    const dataBits = expected === 'WRAL' ? numberToBits(0xa5a5, 16) : [];
    const bits = [1, 0, 0, ...numberToBits(addressField, 6), ...dataBits];
    const outcome = decodeMicrowire(packBits(bits), profile);

    expect(outcome.ok && outcome.result.command).toBe(expected);
    // Adres taşımayan komutta adres BASILMAZ — don't-care biti adres diye yazmak yalan olurdu.
    expect(outcome.ok && outcome.result.address).toBeUndefined();
  });

  it('start bitinden önceki boşta bitler atlanır ve SAYILIR', () => {
    const bits = [0, 0, 0, 1, 1, 0, ...numberToBits(0x0a, 6), ...numberToBits(0x0001, 16)];
    const outcome = decodeMicrowire(packBits(bits), profile);
    expect(outcome.ok && outcome.result.leadingIdleBits).toBe(3);
    expect(outcome.ok && outcome.result.command).toBe('READ');
    expect(outcome.ok && outcome.result.data).toBe(0x0001);
  });

  it('hiç 1 biti yoksa start bulunamaz', () => {
    const outcome = decodeMicrowire(new Uint8Array([0x00, 0x00]), profile);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.failure.kind).toBe('no-start-bit');
  });

  it('veri alanı eksikse truncated — yarım okunan sözcük BASILMAZ', () => {
    const bits = [1, 1, 0, ...numberToBits(0x0a, 6), 1, 0, 1, 0];
    const outcome = decodeMicrowire(packBits(bits), profile);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.failure.kind).toBe('truncated');
  });
});

describe("decodeMicrowire — 93xx56 x16 don't-care adres biti (DS21794F Tablo 1-3)", () => {
  const profile = presetById('93xx56-x16');

  it('adres ALANI 8 bit ama anlamlı adres 7 bit — üst bit maskelenir', () => {
    // Üst don't-care bit 1, altındaki gerçek adres 0x2A.
    const addressField = (1 << 7) | 0x2a;
    const bits = [1, 1, 0, ...numberToBits(addressField, 8), ...numberToBits(0xcafe, 16)];
    const outcome = decodeMicrowire(packBits(bits), profile);

    expect(outcome.ok && outcome.result.command).toBe('READ');
    expect(outcome.ok && outcome.result.address).toBe(0x2a);
    expect(outcome.ok && outcome.result.totalBits).toBe(27);
  });
});

describe('calculateMicrowireTransferTime', () => {
  it('1 MHz SK ile 93xx46 x16 READ = 25 µs', () => {
    const result = calculateMicrowireTransferTime({
      profile: presetById('93xx46-x16'),
      command: 'READ',
      clockHz: 1_000_000,
    });
    expect(result.clockCycles).toBe(25);
    expect(result.transferSeconds).toBeCloseTo(25e-6, 12);
  });

  it('clock sıfır ya da negatifse süre sonsuz — sıfıra bölme sessizce NaN üretmez', () => {
    const result = calculateMicrowireTransferTime({
      profile: presetById('93xx46-x8'),
      command: 'ERASE',
      clockHz: 0,
    });
    expect(result.transferSeconds).toBe(Number.POSITIVE_INFINITY);
  });
});
