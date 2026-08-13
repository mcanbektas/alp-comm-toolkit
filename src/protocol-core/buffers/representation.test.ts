import { describe, expect, it } from 'vitest';

import {
  asciiToHex,
  binaryToHex,
  bytesToHex,
  convertRadix,
  hexToAscii,
  hexToBinary,
  hexToBytes,
  numberToRadix,
  radixToNumber,
} from './representation';

describe('bytesToHex / hexToBytes', () => {
  it('converts bytes to an uppercase hex string', () => {
    expect(bytesToHex(Uint8Array.of(0x01, 0x0a, 0xff))).toBe('010AFF');
  });

  it('round-trips the CLAUDE.md Modbus RTU fixture through hex', () => {
    const bytes = Uint8Array.of(0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b);
    expect(bytesToHex(bytes)).toBe('010300000002C40B');
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it('accepts whitespace-separated hex byte pairs', () => {
    expect(hexToBytes('01 03 00 02')).toEqual(Uint8Array.of(0x01, 0x03, 0x00, 0x02));
  });

  it('rejects an odd number of hex digits', () => {
    expect(() => hexToBytes('ABC')).toThrow();
  });

  it('rejects non-hex characters', () => {
    expect(() => hexToBytes('ZZ')).toThrow();
  });
});

describe('hexToAscii / asciiToHex', () => {
  it('decodes a hex string to ASCII text', () => {
    expect(hexToAscii('48656C6C6F')).toBe('Hello');
  });

  it('encodes ASCII text to an uppercase hex string', () => {
    expect(asciiToHex('Hello')).toBe('48656C6C6F');
  });

  it('round-trips ASCII text through hex', () => {
    const text = 'Modbus RTU';
    expect(hexToAscii(asciiToHex(text))).toBe(text);
  });

  it('rejects a character that cannot be represented as a single byte', () => {
    // 'İ' (U+0130) 0xff sınırının üstünde bir kod noktası taşır.
    expect(() => asciiToHex('İ')).toThrow();
  });
});

describe('hexToBinary / binaryToHex', () => {
  it('converts a hex string to a bit string', () => {
    expect(hexToBinary('FF')).toBe('11111111');
  });

  it('converts a bit string back to a hex string', () => {
    expect(binaryToHex('11111111')).toBe('FF');
  });

  it('round-trips an arbitrary hex value through binary', () => {
    expect(binaryToHex(hexToBinary('A5'))).toBe('A5');
  });

  it('pads an unaligned bit string up to the next nibble boundary', () => {
    // 5 bit '10110' -> baştan 0 ile 8 bite tamamlanır: '00010110' -> nibble'lar '0001'=0x1, '0110'=0x6 -> "16"
    expect(binaryToHex('10110')).toBe('16');
  });
});

describe('numberToRadix / radixToNumber / convertRadix', () => {
  it('converts a decimal number to hex, binary and octal', () => {
    expect(numberToRadix(255, 16)).toBe('FF');
    expect(numberToRadix(255, 2)).toBe('11111111');
    expect(numberToRadix(255, 8)).toBe('377');
  });

  it('parses a number back from any supported radix', () => {
    expect(radixToNumber('FF', 16)).toBe(255);
    expect(radixToNumber('11111111', 2)).toBe(255);
    expect(radixToNumber('377', 8)).toBe(255);
  });

  it('converts directly between two non-decimal radixes', () => {
    expect(convertRadix('FF', 16, 2)).toBe('11111111');
    expect(convertRadix('11111111', 2, 8)).toBe('377');
  });

  it('rejects digits that are invalid for the given radix', () => {
    expect(() => radixToNumber('129', 8)).toThrow();
    expect(() => radixToNumber('12', 2)).toThrow();
  });

  it('rejects a negative or non-integer value', () => {
    expect(() => numberToRadix(-1, 16)).toThrow();
    expect(() => numberToRadix(1.5, 16)).toThrow();
  });
});
