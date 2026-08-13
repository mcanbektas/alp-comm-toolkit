/**
 * Bit/nibble seviyesi işlemler: tekil bit oku/yaz, maskeli alan oku/yaz, maske
 * üretici/uygulayıcı, bayt/bit sırası ters çevirme, nibble takası (spec §9.4,
 * §50). Tüm bitwise işlemler JS'in 32-bit imzalı tamsayı davranışına tabidir
 * (`|`, `&`, `<<`, `~`); bu yüzden her sonuç `>>> 0` ile işaretsiz 32-bit'e geri
 * çevrilir — aksi hâlde 0x80000000 ve üstü değerler negatif number olarak sızar.
 */

import { bytesToNumber, numberToBytes } from './endianness';

const BITS_PER_UINT32 = 32;
const UINT32_MAX = 0xffffffff;

function validateBitPosition(bitPosition: number, label: string): void {
  if (!Number.isInteger(bitPosition) || bitPosition < 0 || bitPosition >= BITS_PER_UINT32) {
    throw new RangeError(`${label} must be an integer between 0 and ${BITS_PER_UINT32 - 1}, got ${bitPosition}`);
  }
}

export type BitValue = 0 | 1;

/** Bit Value = (RawValue >> BitPosition) & 1 (spec §9.4). */
export function extractBit(rawValue: number, bitPosition: number): BitValue {
  validateBitPosition(bitPosition, 'bitPosition');
  return ((rawValue >>> bitPosition) & 1) as BitValue;
}

export function setBit(rawValue: number, bitPosition: number, bitValue: BitValue): number {
  validateBitPosition(bitPosition, 'bitPosition');
  const mask = 1 << bitPosition;
  const result = bitValue === 1 ? rawValue | mask : rawValue & ~mask;
  return result >>> 0;
}

/** Field Value = (RawValue & Mask) >> Shift (spec §9.4). */
export function extractField(rawValue: number, mask: number, shift: number): number {
  validateBitPosition(shift, 'shift');
  return (rawValue & mask) >>> shift;
}

export function setField(rawValue: number, fieldValue: number, mask: number, shift: number): number {
  validateBitPosition(shift, 'shift');
  return ((rawValue & ~mask) | ((fieldValue << shift) & mask)) >>> 0;
}

function validateBitWidthAndShift(bitWidth: number, shift: number): void {
  if (!Number.isInteger(bitWidth) || bitWidth < 1 || bitWidth > BITS_PER_UINT32) {
    throw new RangeError(`bitWidth must be an integer between 1 and ${BITS_PER_UINT32}, got ${bitWidth}`);
  }
  validateBitPosition(shift, 'shift');
  if (bitWidth + shift > BITS_PER_UINT32) {
    throw new RangeError(`bitWidth (${bitWidth}) + shift (${shift}) exceeds ${BITS_PER_UINT32} bits`);
  }
}

export function createBitMask(bitWidth: number, shift = 0): number {
  validateBitWidthAndShift(bitWidth, shift);
  if (bitWidth === BITS_PER_UINT32) {
    // `1 << 32` JS'te kayma miktarını mod 32 alır ve 1'e sarar (`1 << 0`);
    // tam 32 bitlik maske bu yüzden elle, formülün dışında üretilir.
    return UINT32_MAX >>> 0;
  }
  return (((1 << bitWidth) - 1) << shift) >>> 0;
}

export function applyBitMask(rawValue: number, mask: number): number {
  return (rawValue & mask) >>> 0;
}

export function swapByteOrder(bytes: Uint8Array): Uint8Array {
  // `Uint8Array.prototype.reverse` alıcıyı yerinde çevirir; çağıranın orijinal
  // buffer'ını bozmamak için (bkz. types.ts RawFrame.bytes paylaşım kuralı) önce kopyalanır.
  return Uint8Array.from(bytes).reverse();
}

/** Bir sayının bayt sırasını ters çevirir: big-endian temsilini alıp diziyi ters çevirerek okur. */
export function swapNumberByteOrder(value: number, byteLength: number): number {
  const bigEndianBytes = numberToBytes(value, byteLength, 'big');
  const swapped = swapByteOrder(bigEndianBytes);
  return bytesToNumber(swapped, 'big');
}

const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

function validateByteValue(byte: number): void {
  if (!Number.isInteger(byte) || byte < 0 || byte > BYTE_MASK) {
    throw new RangeError(`byte must be an integer between 0 and ${BYTE_MASK}, got ${byte}`);
  }
}

/** 0b10110000 → 0b00001101: bit7 yeni bit0 olur, bit0 yeni bit7 olur, sıra tamamen döner. */
export function reverseByteBits(byte: number): number {
  validateByteValue(byte);
  let result = 0;
  for (let i = 0; i < BITS_PER_BYTE; i++) {
    result = (result << 1) | ((byte >> i) & 1);
  }
  return result >>> 0;
}

const NIBBLE_BITS = 4;
const LOW_NIBBLE_MASK = 0x0f;
const HIGH_NIBBLE_MASK = 0xf0;

/** 0xAB → 0xBA: üst ve alt 4 bit yer değiştirir. */
export function swapNibbles(byte: number): number {
  validateByteValue(byte);
  return (((byte & LOW_NIBBLE_MASK) << NIBBLE_BITS) | ((byte & HIGH_NIBBLE_MASK) >>> NIBBLE_BITS)) >>> 0;
}
