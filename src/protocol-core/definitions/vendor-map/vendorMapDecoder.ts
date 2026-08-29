/**
 * Kayıt haritası girdisine göre ham baytların çözülmesi.
 *
 * Modbus teli register (2 bayt) hizalıdır ve bayt sırası içeride HER ZAMAN
 * big-endian'dır (MODBUS Application Protocol V1.1b3 §4.2). Değişken olan tek
 * şey 32-bit değerlerin İKİ REGISTER'A hangi sırayla dağıldığı: üretici
 * "AB CD" (yüksek register önce) ya da "CD AB" (düşük register önce) seçebilir
 * ve standart bunu söylemez. Yanlış seçim çökme üretmez, ANLAMSIZ SAYI üretir
 * — bu yüzden sıra haritadan gelir ve panelde de görünür.
 *
 * `float32` için de aynı: kelime sırası uygulandıktan sonra bayt sırası
 * big-endian okunur (`decodeFloat32`).
 */

import { decodeFloat32 } from '../../encoding/ieee754';

import type { VendorMapEntry, VendorMapWordOrder } from './vendorMapTypes';

const BYTES_PER_REGISTER = 2;
const BITS_PER_BYTE = 8;
const UINT16_SPAN = 0x1_00_00;
const INT16_LIMIT = 0x80_00;
const UINT32_SPAN = 0x1_00_00_00_00;
const INT32_LIMIT = 0x80_00_00_00;

/** Tipin istediği bayt sayısı; `ascii`/`raw` uzunluğu girdiden alır. */
export function requiredByteLength(entry: VendorMapEntry): number {
  switch (entry.type) {
    case 'uint16':
    case 'int16':
    case 'enum':
    case 'bitfield':
      return BYTES_PER_REGISTER;
    case 'uint32':
    case 'int32':
    case 'float32':
      return BYTES_PER_REGISTER * 2;
    case 'bool':
      return 1;
    case 'ascii':
    case 'raw':
      return (entry.length ?? 1) * BYTES_PER_REGISTER;
  }
}

export interface DecodedBit {
  readonly bit: number;
  /** Bit adı VERİDİR (haritadan gelir), çevrilmez. */
  readonly name: string;
  readonly value: boolean;
}

export type VendorMapDecodeResult =
  | {
      readonly success: true;
      readonly rawValue: number | string;
      /** Ölçek/ofset uygulanmış değer; sayısal olmayan tiplerde ham ile aynı. */
      readonly physicalValue: number | string;
      readonly unit?: string;
      readonly bits?: readonly DecodedBit[];
      /** `enum` girdisinde sözlükte karşılığı yoksa `undefined` — uydurulmaz. */
      readonly enumLabel?: string;
    }
  | {
      readonly success: false;
      /** Çeviri anahtarı; `VendorMapIssue.messageKey` ile aynı sözleşme. */
      readonly messageKey: string;
      readonly requiredBytes: number;
    };

function readUint16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << BITS_PER_BYTE) | (bytes[offset + 1] ?? 0);
}

/**
 * İki register'ı `wordOrder`a göre birleştirir. `>>> 0` şart: 32-bit birleşim
 * `<<` ile yapılınca JavaScript işaretli 32-bit döndürür ve 0x8000_0000 üstü
 * değerler negatife düşerdi.
 */
function combineWords(high: number, low: number, order: VendorMapWordOrder): number {
  const [first, second] = order === 'high-first' ? [high, low] : [low, high];
  return ((first * UINT16_SPAN) >>> 0) + second;
}

function applyScale(entry: VendorMapEntry, raw: number): number {
  const scaled = raw * (entry.scale ?? 1) + (entry.offset ?? 0);
  // Kayan nokta artığı temizlenir: 0.1 ölçekli bir tamsayı 23.400000000000002
  // basıyordu ve tabloda bu bir "cihaz hatası" gibi okunuyor.
  return Number(scaled.toPrecision(12));
}

function decodeAscii(bytes: Uint8Array): string {
  // Dolgu için kullanılan NUL ve 0xFF baytları metnin parçası değildir.
  return Array.from(bytes)
    .filter((byte) => byte !== 0 && byte !== 0xff)
    .map((byte) => String.fromCharCode(byte))
    .join('')
    .trim();
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/**
 * `bytes` bu girdinin BAYTLARIDIR — çerçevenin tamamı değil. Adresten bayta
 * inmek çağıranın işi: bir Modbus yanıtının gövdesinde hangi register'ın
 * nerede olduğu isteğe (başlangıç adresi + sayı) bağlıdır ve o bilgi haritada
 * yoktur.
 */
export function decodeVendorMapEntry(
  entry: VendorMapEntry,
  bytes: Uint8Array,
  defaultWordOrder: VendorMapWordOrder,
): VendorMapDecodeResult {
  const required = requiredByteLength(entry);
  if (bytes.length < required) {
    return { success: false, messageKey: 'definition.vendorMap.decode.tooShort', requiredBytes: required };
  }

  const order = entry.wordOrder ?? defaultWordOrder;

  switch (entry.type) {
    case 'uint16': {
      const raw = readUint16(bytes, 0);
      return withUnit(entry, raw, applyScale(entry, raw));
    }
    case 'int16': {
      const unsigned = readUint16(bytes, 0);
      const raw = unsigned >= INT16_LIMIT ? unsigned - UINT16_SPAN : unsigned;
      return withUnit(entry, raw, applyScale(entry, raw));
    }
    case 'uint32': {
      const raw = combineWords(readUint16(bytes, 0), readUint16(bytes, 2), order);
      return withUnit(entry, raw, applyScale(entry, raw));
    }
    case 'int32': {
      const unsigned = combineWords(readUint16(bytes, 0), readUint16(bytes, 2), order);
      const raw = unsigned >= INT32_LIMIT ? unsigned - UINT32_SPAN : unsigned;
      return withUnit(entry, raw, applyScale(entry, raw));
    }
    case 'float32': {
      const ordered =
        order === 'high-first'
          ? bytes.slice(0, 4)
          : Uint8Array.from([bytes[2] ?? 0, bytes[3] ?? 0, bytes[0] ?? 0, bytes[1] ?? 0]);
      const raw = decodeFloat32(ordered, 'big');
      return withUnit(entry, raw, applyScale(entry, raw));
    }
    case 'bool': {
      const raw = (bytes[0] ?? 0) === 0 && (bytes[1] ?? 0) === 0 ? 0 : 1;
      return { success: true, rawValue: raw, physicalValue: raw };
    }
    case 'enum': {
      const raw = readUint16(bytes, 0);
      const label = entry.enumValues?.[String(raw)];
      return {
        success: true,
        rawValue: raw,
        physicalValue: label ?? raw,
        ...(label === undefined ? {} : { enumLabel: label }),
      };
    }
    case 'bitfield': {
      const raw = readUint16(bytes, 0);
      const bits = (entry.bits ?? []).map((bit) => ({
        bit: bit.bit,
        name: bit.name,
        value: (raw & (1 << bit.bit)) !== 0,
      }));
      return { success: true, rawValue: raw, physicalValue: raw, bits };
    }
    case 'ascii': {
      const text = decodeAscii(bytes.slice(0, required));
      return { success: true, rawValue: text, physicalValue: text };
    }
    case 'raw': {
      const hex = toHex(bytes.slice(0, required));
      return { success: true, rawValue: hex, physicalValue: hex };
    }
  }
}

function withUnit(entry: VendorMapEntry, raw: number, physical: number): VendorMapDecodeResult {
  return {
    success: true,
    rawValue: raw,
    physicalValue: physical,
    ...(entry.unit === undefined ? {} : { unit: entry.unit }),
  };
}
