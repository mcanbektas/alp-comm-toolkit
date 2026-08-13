/**
 * Base32 (RFC 4648, standart alfabe + `=` dolgu). Base64 ile aynı bit-tamponlu
 * akış tekniği, yalnız grup genişliği 5 bit (32 sembol) — 5 bayt (40 bit) tam
 * 8 karaktere böler, o yüzden dolgu tablosu Base64'ten farklıdır.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_PAD_CHAR = '=';
const BITS_PER_BASE32_CHAR = 5;
const BITS_PER_BYTE = 8;
const BASE32_GROUP_CHAR_LENGTH = 8;
const FIVE_BIT_MASK = 0x1f;
const EIGHT_BIT_MASK = 0xff;

const BASE32_CHAR_TO_VALUE: ReadonlyMap<string, number> = new Map(
  Array.from(BASE32_ALPHABET, (char, index) => [char, index] as const),
);

export function base32Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let result = '';
  let buffer = 0;
  let bitsCollected = 0;

  for (const byte of bytes) {
    buffer = (buffer << BITS_PER_BYTE) | byte;
    bitsCollected += BITS_PER_BYTE;
    while (bitsCollected >= BITS_PER_BASE32_CHAR) {
      bitsCollected -= BITS_PER_BASE32_CHAR;
      result += BASE32_ALPHABET.charAt((buffer >> bitsCollected) & FIVE_BIT_MASK);
    }
  }

  if (bitsCollected > 0) {
    // Son gruptan kalan bitler sağdan sıfırla tamamlanıp son karakter üretilir.
    result += BASE32_ALPHABET.charAt((buffer << (BITS_PER_BASE32_CHAR - bitsCollected)) & FIVE_BIT_MASK);
  }

  const paddedLength = Math.ceil(result.length / BASE32_GROUP_CHAR_LENGTH) * BASE32_GROUP_CHAR_LENGTH;
  return result.padEnd(paddedLength, BASE32_PAD_CHAR);
}

export function base32Decode(base32: string): Uint8Array {
  // RFC 4648 alfabesi yalnız büyük harf ama girişte küçük harf kabul etmek
  // (ör. kullanıcı elle yapıştırırken) zararsız bir kolaylık.
  const clean = base32.toUpperCase().replace(/=+$/u, '');
  if (clean.length === 0) {
    return new Uint8Array(0);
  }

  const bytesOut: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of clean) {
    const value = BASE32_CHAR_TO_VALUE.get(char);
    if (value === undefined) {
      throw new Error(`Geçersiz Base32 karakteri: '${char}'`);
    }
    buffer = (buffer << BITS_PER_BASE32_CHAR) | value;
    bitsCollected += BITS_PER_BASE32_CHAR;
    if (bitsCollected >= BITS_PER_BYTE) {
      bitsCollected -= BITS_PER_BYTE;
      bytesOut.push((buffer >> bitsCollected) & EIGHT_BIT_MASK);
    }
  }

  return Uint8Array.from(bytesOut);
}
