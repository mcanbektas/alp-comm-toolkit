/**
 * Unix timestamp dönüşümleri: epoch (saniye/milisaniye) ↔ ISO 8601 metin, ve
 * epoch ↔ frame'lerde sık görülen 32-bit/64-bit ham bayt temsili. Bir frame'de
 * timestamp alanı genelde ya 4 baytlık imzasız epoch-saniye (2106'da taşar) ya
 * da 8 baytlık epoch-milisaniye'dir; ikisi de burada ayrı fonksiyon çifti.
 */

import type { Endianness } from './ieee754';

export type TimestampUnit = 'seconds' | 'milliseconds';

const MS_PER_SECOND = 1000;
const UINT32_BYTE_LENGTH = 4;
const UINT32_MAX = 0xffffffff;
const UINT64_BYTE_LENGTH = 8;

export function epochToIso(epoch: number, unit: TimestampUnit): string {
  const milliseconds = unit === 'seconds' ? epoch * MS_PER_SECOND : epoch;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Geçersiz epoch değeri: ${epoch}`);
  }
  return date.toISOString();
}

export function isoToEpoch(iso: string, unit: TimestampUnit): number {
  const milliseconds = Date.parse(iso);
  if (Number.isNaN(milliseconds)) {
    throw new Error(`Geçersiz ISO 8601 tarih dizesi: '${iso}'`);
  }
  return unit === 'seconds' ? Math.trunc(milliseconds / MS_PER_SECOND) : milliseconds;
}

/** Epoch-saniyeyi imzasız 32-bit ham bayt dizisine çevirir (spec: en yaygın frame alanı boyutu). */
export function epochToBytes32(epochSeconds: number, endianness: Endianness): Uint8Array {
  if (!Number.isInteger(epochSeconds) || epochSeconds < 0 || epochSeconds > UINT32_MAX) {
    throw new Error(`32-bit imzasız epoch aralığı dışında: ${epochSeconds}`);
  }
  const view = new DataView(new ArrayBuffer(UINT32_BYTE_LENGTH));
  view.setUint32(0, epochSeconds, endianness === 'little');
  return new Uint8Array(view.buffer);
}

export function bytesToEpoch32(bytes: Uint8Array, endianness: Endianness): number {
  if (bytes.length !== UINT32_BYTE_LENGTH) {
    throw new Error(`32-bit epoch için ${UINT32_BYTE_LENGTH} bayt gerekir, ${bytes.length} verildi`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, endianness === 'little');
}

/**
 * Epoch-milisaniyeyi imzasız 64-bit ham bayt dizisine çevirir. `bigint` alır:
 * epoch-milisaniye değerleri `Number.MAX_SAFE_INTEGER`e (2^53) uzak olsa da,
 * 64-bit tam genişlikte kayıpsız bit deseni için `DataView.setBigUint64` şart.
 */
export function epochToBytes64(epochMilliseconds: bigint, endianness: Endianness): Uint8Array {
  const view = new DataView(new ArrayBuffer(UINT64_BYTE_LENGTH));
  view.setBigUint64(0, epochMilliseconds, endianness === 'little');
  return new Uint8Array(view.buffer);
}

export function bytesToEpoch64(bytes: Uint8Array, endianness: Endianness): bigint {
  if (bytes.length !== UINT64_BYTE_LENGTH) {
    throw new Error(`64-bit epoch için ${UINT64_BYTE_LENGTH} bayt gerekir, ${bytes.length} verildi`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, endianness === 'little');
}
