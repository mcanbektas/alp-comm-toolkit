/**
 * Base64 (RFC 4648, standart alfabe + `=` dolgu). `btoa`/`atob` KULLANILMIYOR:
 * bunlar DOM'a bağlı global'lerdir ve motor bir Web Worker içinde de
 * çalışabilmeli (spec §44). Bit tamponlu klasik akış algoritması: 6 bitlik
 * gruplar biriktirilip 8 bitlik baytlara bölünür (decode) ya da tersi (encode).
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PAD_CHAR = '=';
const BITS_PER_BASE64_CHAR = 6;
const BITS_PER_BYTE = 8;
const BASE64_GROUP_BYTE_LENGTH = 3;
const SIX_BIT_MASK = 0x3f;
const EIGHT_BIT_MASK = 0xff;

const BASE64_CHAR_TO_VALUE: ReadonlyMap<string, number> = new Map(
  Array.from(BASE64_ALPHABET, (char, index) => [char, index] as const),
);

export function base64Encode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;

  for (; i + BASE64_GROUP_BYTE_LENGTH <= bytes.length; i += BASE64_GROUP_BYTE_LENGTH) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += BASE64_ALPHABET.charAt(b0 >> 2);
    result += BASE64_ALPHABET.charAt(((b0 & 0x03) << 4) | (b1 >> 4));
    result += BASE64_ALPHABET.charAt(((b1 & 0x0f) << 2) | (b2 >> 6));
    result += BASE64_ALPHABET.charAt(b2 & SIX_BIT_MASK);
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const b0 = bytes[i] ?? 0;
    result += BASE64_ALPHABET.charAt(b0 >> 2);
    result += BASE64_ALPHABET.charAt((b0 & 0x03) << 4);
    result += BASE64_PAD_CHAR + BASE64_PAD_CHAR;
  } else if (remaining === 2) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    result += BASE64_ALPHABET.charAt(b0 >> 2);
    result += BASE64_ALPHABET.charAt(((b0 & 0x03) << 4) | (b1 >> 4));
    result += BASE64_ALPHABET.charAt((b1 & 0x0f) << 2);
    result += BASE64_PAD_CHAR;
  }

  return result;
}

export function base64Decode(base64: string): Uint8Array {
  // Sondaki '=' dolgusu bit sayımı için gereksiz: kalan bitler zaten 8'in altında
  // kalıp döngü sonunda atılıyor, dolgu karakterini ayrıca işlemeye gerek yok.
  const clean = base64.replace(/=+$/u, '');
  if (clean.length === 0) {
    return new Uint8Array(0);
  }

  const bytesOut: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of clean) {
    const value = BASE64_CHAR_TO_VALUE.get(char);
    if (value === undefined) {
      throw new Error(`Geçersiz Base64 karakteri: '${char}'`);
    }
    buffer = (buffer << BITS_PER_BASE64_CHAR) | value;
    bitsCollected += BITS_PER_BASE64_CHAR;
    if (bitsCollected >= BITS_PER_BYTE) {
      bitsCollected -= BITS_PER_BYTE;
      bytesOut.push((buffer >> bitsCollected) & EIGHT_BIT_MASK);
    }
  }

  return Uint8Array.from(bytesOut);
}
