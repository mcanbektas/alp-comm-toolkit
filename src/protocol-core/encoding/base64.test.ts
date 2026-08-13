import { describe, expect, it } from 'vitest';

import { base64Decode, base64Encode } from './base64';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const ascii = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('base64Encode', () => {
  // RFC 4648 §10 test vektörleri.
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
    ['Man', 'TWFu'],
  ])('encodes %j to %j', (input, expected) => {
    expect(base64Encode(utf8(input))).toBe(expected);
  });
});

describe('base64Decode', () => {
  it.each([
    ['', ''],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYg==', 'foob'],
    ['Zm9vYmE=', 'fooba'],
    ['Zm9vYmFy', 'foobar'],
    ['TWFu', 'Man'],
  ])('decodes %j to %j', (input, expected) => {
    expect(ascii(base64Decode(input))).toBe(expected);
  });

  it('throws on a character outside the alphabet', () => {
    expect(() => base64Decode('not_base64!')).toThrow();
  });
});

describe('Base64 round-trip', () => {
  it('recovers arbitrary binary content, including all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base64Decode(base64Encode(bytes))).toEqual(bytes);
  });
});
