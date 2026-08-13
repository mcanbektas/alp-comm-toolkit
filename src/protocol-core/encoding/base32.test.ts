import { describe, expect, it } from 'vitest';

import { base32Decode, base32Encode } from './base32';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const ascii = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('base32Encode', () => {
  // RFC 4648 §10 test vektörleri.
  it.each([
    ['', ''],
    ['f', 'MY======'],
    ['fo', 'MZXQ===='],
    ['foo', 'MZXW6==='],
    ['foob', 'MZXW6YQ='],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI======'],
  ])('encodes %j to %j', (input, expected) => {
    expect(base32Encode(utf8(input))).toBe(expected);
  });
});

describe('base32Decode', () => {
  it.each([
    ['', ''],
    ['MY======', 'f'],
    ['MZXQ====', 'fo'],
    ['MZXW6===', 'foo'],
    ['MZXW6YQ=', 'foob'],
    ['MZXW6YTB', 'fooba'],
    ['MZXW6YTBOI======', 'foobar'],
  ])('decodes %j to %j', (input, expected) => {
    expect(ascii(base32Decode(input))).toBe(expected);
  });

  it('accepts lowercase input as a convenience', () => {
    expect(ascii(base32Decode('mzxw6ytboi======'))).toBe('foobar');
  });

  it('throws on a character outside the alphabet', () => {
    expect(() => base32Decode('01189')).toThrow(); // 0/1/8/9 Base32 alfabesinde yok
  });
});

describe('Base32 round-trip', () => {
  it('recovers arbitrary binary content, including all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });
});
