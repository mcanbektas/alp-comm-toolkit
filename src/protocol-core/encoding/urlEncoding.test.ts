import { describe, expect, it } from 'vitest';

import { bytesToPercentEncoded, percentEncodedToBytes, urlDecode, urlEncode } from './urlEncoding';

describe('urlEncode / urlDecode', () => {
  it('percent-encodes reserved and space characters', () => {
    expect(urlEncode('a b?c=d')).toBe('a%20b%3Fc%3Dd');
  });

  it('round-trips UTF-8 text', () => {
    const text = 'ölçüm değeri: 25.75';
    expect(urlDecode(urlEncode(text))).toBe(text);
  });
});

describe('bytesToPercentEncoded / percentEncodedToBytes', () => {
  it('encodes each byte as an uppercase %XX group', () => {
    expect(bytesToPercentEncoded(Uint8Array.of(0x00, 0x01, 0xff))).toBe('%00%01%FF');
  });

  it('decodes a %XX sequence back to raw bytes', () => {
    expect(percentEncodedToBytes('%00%01%FF')).toEqual(Uint8Array.of(0x00, 0x01, 0xff));
  });

  it('passes through non-percent ASCII characters as their code point byte', () => {
    expect(percentEncodedToBytes('AB%2E')).toEqual(Uint8Array.of(0x41, 0x42, 0x2e));
  });

  it('throws on a truncated or malformed %XX group', () => {
    expect(() => percentEncodedToBytes('%A')).toThrow();
    expect(() => percentEncodedToBytes('%ZZ')).toThrow();
  });

  it('round-trips arbitrary binary content', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(percentEncodedToBytes(bytesToPercentEncoded(bytes))).toEqual(bytes);
  });
});
