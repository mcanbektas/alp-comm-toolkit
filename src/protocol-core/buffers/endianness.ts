/**
 * Bayt sırası (endianness) ve N-bit two's complement dönüşümleri (spec §9.3, §9.5).
 *
 * `number` ile güvenli aritmetik sınırı: `Number.MAX_SAFE_INTEGER` = 2^53-1,
 * 256^6 = 2^48 bunun altında ama 256^7 = 2^56 üstündedir. Bu yüzden bayt dizisi
 * uzunluğu 6 ile sınırlanır — daha uzunu bigint ister (spec'teki 172 protokolün
 * hiçbiri 48 bit'i aşan tek bir sayısal alan tanımlamıyor).
 */

const BYTE_RADIX = 256;
const BYTES_PER_WORD = 2;
const WORD_RADIX = BYTE_RADIX ** BYTES_PER_WORD;
const MAX_SAFE_BYTE_LENGTH = 6;

export type ByteOrder = 'little' | 'big' | 'mixed';

function assertUnreachable(value: never): never {
  throw new Error(`Unhandled ByteOrder: ${String(value)}`);
}

function validateByteLength(length: number): void {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`byte length must be a positive integer, got ${length}`);
  }
  if (length > MAX_SAFE_BYTE_LENGTH) {
    throw new RangeError(
      `byte length ${length} exceeds ${MAX_SAFE_BYTE_LENGTH}: result would not fit a safe number, use bigint instead`,
    );
  }
}

function validateEvenByteLength(length: number, order: 'mixed'): void {
  if (length % BYTES_PER_WORD !== 0) {
    throw new Error(`${order}-endian conversion requires an even byte length (16-bit words), got ${length}`);
  }
}

function validateUnsignedValue(value: number, byteLength: number): void {
  const maxValue = BYTE_RADIX ** byteLength - 1;
  if (!Number.isInteger(value) || value < 0 || value > maxValue) {
    throw new RangeError(`value must be within [0, ${maxValue}] for a ${byteLength}-byte value, got ${value}`);
  }
}

function bytesToNumberLittleEndian(bytes: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value += (bytes[i] ?? 0) * BYTE_RADIX ** i;
  }
  return value;
}

function bytesToNumberBigEndian(bytes: Uint8Array): number {
  const lastIndex = bytes.length - 1;
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value += (bytes[i] ?? 0) * BYTE_RADIX ** (lastIndex - i);
  }
  return value;
}

/**
 * PDP-endian / orta-endian: bayt dizisi 16-bit word'lere bölünür, her word
 * KENDİ İÇİNDE little-endian okunur, ama word'lerin kendisi big-endian sırada
 * (en anlamlı word önce) dizilmiştir. Örnek referans: 0x12345678 → bayt sırası
 * `34 12 78 56` (word0=0x1234 → "34 12", word1=0x5678 → "78 56", word0 önde).
 */
function bytesToNumberMixedEndian(bytes: Uint8Array): number {
  validateEvenByteLength(bytes.length, 'mixed');
  const wordCount = bytes.length / BYTES_PER_WORD;
  let value = 0;
  for (let w = 0; w < wordCount; w++) {
    const lowByte = bytes[w * BYTES_PER_WORD] ?? 0;
    const highByte = bytes[w * BYTES_PER_WORD + 1] ?? 0;
    const wordValue = lowByte + highByte * BYTE_RADIX;
    const wordWeight = wordCount - 1 - w;
    value += wordValue * WORD_RADIX ** wordWeight;
  }
  return value;
}

export function bytesToNumber(bytes: Uint8Array, order: ByteOrder): number {
  validateByteLength(bytes.length);
  switch (order) {
    case 'little':
      return bytesToNumberLittleEndian(bytes);
    case 'big':
      return bytesToNumberBigEndian(bytes);
    case 'mixed':
      return bytesToNumberMixedEndian(bytes);
    default:
      return assertUnreachable(order);
  }
}

function numberToBytesLittleEndian(value: number, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let remaining = value;
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = remaining % BYTE_RADIX;
    remaining = Math.floor(remaining / BYTE_RADIX);
  }
  return bytes;
}

function numberToBytesBigEndian(value: number, byteLength: number): Uint8Array {
  // Little-endian üretip çevirmek, aynı döngüyü iki kez ayrı yazmaktan daha az hataya açık.
  return numberToBytesLittleEndian(value, byteLength).reverse();
}

function numberToBytesMixedEndian(value: number, byteLength: number): Uint8Array {
  validateEvenByteLength(byteLength, 'mixed');
  const wordCount = byteLength / BYTES_PER_WORD;
  const bytes = new Uint8Array(byteLength);
  // En az anlamlı word'den başlayarak tabana bölerek çıkarılır (words[0] = en az anlamlı).
  const words: number[] = [];
  let remaining = value;
  for (let w = 0; w < wordCount; w++) {
    words.push(remaining % WORD_RADIX);
    remaining = Math.floor(remaining / WORD_RADIX);
  }
  // Word'lerin kendisi big-endian sırada yazılır: en anlamlı word en başa.
  for (let w = 0; w < wordCount; w++) {
    const wordValue = words[wordCount - 1 - w] ?? 0;
    bytes[w * BYTES_PER_WORD] = wordValue % BYTE_RADIX;
    bytes[w * BYTES_PER_WORD + 1] = Math.floor(wordValue / BYTE_RADIX);
  }
  return bytes;
}

export function numberToBytes(value: number, byteLength: number, order: ByteOrder): Uint8Array {
  validateByteLength(byteLength);
  validateUnsignedValue(value, byteLength);
  switch (order) {
    case 'little':
      return numberToBytesLittleEndian(value, byteLength);
    case 'big':
      return numberToBytesBigEndian(value, byteLength);
    case 'mixed':
      return numberToBytesMixedEndian(value, byteLength);
    default:
      return assertUnreachable(order);
  }
}

/** JS number aritmetiği bu genişliğe kadar güvenli (2^32 < 2^53); ötesi bigint ister. */
const MAX_BIT_WIDTH = 32;

function validateBitWidth(bitWidth: number): void {
  if (!Number.isInteger(bitWidth) || bitWidth < 1 || bitWidth > MAX_BIT_WIDTH) {
    throw new RangeError(`bitWidth must be an integer between 1 and ${MAX_BIT_WIDTH}, got ${bitWidth}`);
  }
}

/** Raw < 2^(N-1) → Signed = Raw; Raw ≥ 2^(N-1) → Signed = Raw − 2^N (spec §9.3). */
export function toSignedInt(rawValue: number, bitWidth: number): number {
  validateBitWidth(bitWidth);
  const modulus = 2 ** bitWidth;
  if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue >= modulus) {
    throw new RangeError(`rawValue must be within [0, ${modulus - 1}] for a ${bitWidth}-bit value, got ${rawValue}`);
  }
  const signBoundary = 2 ** (bitWidth - 1);
  return rawValue < signBoundary ? rawValue : rawValue - modulus;
}

/** `toSignedInt`'in tersi: negatifse 2^N eklenerek ham (unsigned) temsile döner. */
export function toUnsignedRaw(signedValue: number, bitWidth: number): number {
  validateBitWidth(bitWidth);
  const modulus = 2 ** bitWidth;
  const signBoundary = 2 ** (bitWidth - 1);
  if (!Number.isInteger(signedValue) || signedValue < -signBoundary || signedValue >= signBoundary) {
    throw new RangeError(
      `signedValue must be within [${-signBoundary}, ${signBoundary - 1}] for a ${bitWidth}-bit value, got ${signedValue}`,
    );
  }
  return signedValue < 0 ? signedValue + modulus : signedValue;
}
