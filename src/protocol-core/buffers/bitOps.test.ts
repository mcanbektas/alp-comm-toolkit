import { describe, expect, it } from 'vitest';

import {
  applyBitMask,
  createBitMask,
  extractBit,
  extractField,
  reverseByteBits,
  setBit,
  setField,
  swapByteOrder,
  swapNibbles,
  swapNumberByteOrder,
} from './bitOps';

describe('extractBit / setBit', () => {
  it('extracts the bit at a given position: (RawValue >> BitPosition) & 1', () => {
    expect(extractBit(0b1010, 1)).toBe(1);
    expect(extractBit(0b1010, 0)).toBe(0);
  });

  it('sets a bit to 1 without disturbing other bits', () => {
    expect(setBit(0b0000, 3, 1)).toBe(0b1000);
  });

  it('clears a bit to 0 without disturbing other bits', () => {
    expect(setBit(0b1111, 1, 0)).toBe(0b1101);
  });
});

describe('extractField / setField', () => {
  it('extracts a masked field: (RawValue & Mask) >> Shift', () => {
    // 0b11010110 içinden bit4-6 (mask 0b01110000, shift 4) -> 0b101 = 5
    expect(extractField(0b11010110, 0b01110000, 4)).toBe(0b101);
  });

  it('sets a masked field without disturbing bits outside the mask', () => {
    const raw = 0b10000001;
    const mask = 0b01110000;
    expect(setField(raw, 0b101, mask, 4)).toBe(0b11010001);
  });
});

describe('createBitMask / applyBitMask', () => {
  it('creates a mask with N ones shifted into position', () => {
    expect(createBitMask(3, 2)).toBe(0b00011100);
  });

  it('creates a full 32-bit mask as a special case', () => {
    expect(createBitMask(32)).toBe(0xffffffff);
  });

  it('applies a mask to isolate bits', () => {
    expect(applyBitMask(0b11110000, 0b00001111)).toBe(0);
    expect(applyBitMask(0b11110000, 0b11110000)).toBe(0b11110000);
  });
});

describe('swapByteOrder / swapNumberByteOrder', () => {
  it('reverses the byte order of an array without mutating the input', () => {
    const bytes = Uint8Array.of(0x01, 0x02, 0x03, 0x04);
    expect(swapByteOrder(bytes)).toEqual(Uint8Array.of(0x04, 0x03, 0x02, 0x01));
    expect(bytes).toEqual(Uint8Array.of(0x01, 0x02, 0x03, 0x04));
  });

  it('swaps the byte order of a number between big- and little-endian representations', () => {
    expect(swapNumberByteOrder(0x12345678, 4)).toBe(0x78563412);
  });
});

describe('reverseByteBits', () => {
  it('reverses 0b10110000 to 0b00001101', () => {
    expect(reverseByteBits(0b10110000)).toBe(0b00001101);
  });

  it('round-trips: reversing twice returns the original byte', () => {
    expect(reverseByteBits(reverseByteBits(0xa5))).toBe(0xa5);
  });
});

describe('swapNibbles', () => {
  it('swaps 0xAB to 0xBA', () => {
    expect(swapNibbles(0xab)).toBe(0xba);
  });

  it('round-trips: swapping twice returns the original byte', () => {
    expect(swapNibbles(swapNibbles(0x3c))).toBe(0x3c);
  });
});
