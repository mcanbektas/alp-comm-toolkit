/**
 * DSDL alanının ham baytlardan çözülmesi.
 *
 * ── BİT SIRASI: LSB-FIRST, KÜÇÜK ENDIAN ─────────────────────────────────────
 * Cyphal Specification §3.7.1: serileştirme küçük endian'dır ve alanlar bit
 * düzeyinde, en düşük anlamlı bitten başlayarak paketlenir. Yani bayt hizalı
 * bir `uint16` telde `34 12` olarak durur ve değeri 0x1234'tür.
 *
 * `msb-first` okumak çökme üretmez, SAYIYI DEĞİŞTİRİR (0x3412) — bu yüzden
 * sıra sabit ve seçenek olarak açılmadı: dilin tanımında tek sıra var,
 * seçenek koymak olmayan bir belirsizlik uydurmak olurdu.
 *
 * ── HANGİ ALAN ÇÖZÜLÜR ──────────────────────────────────────────────────────
 * Yalnız konumu ve genişliği BİLİNENLER. `dsdlParser.ts` değişken uzunluklu
 * dizi ya da bileşik tip geçtikten sonra konum vermiyor; o alanlarda çözüm
 * denemek, telin içeriğine bağlı bir hizalamayı sabit sanmak demek.
 */

import { readBits, toSignedBits } from '../../decoding/bitCursor';

import type { DsdlField } from './dsdlTypes';

const BITS_PER_BYTE = 8;

export type DsdlDecodeResult =
  | {
      readonly success: true;
      readonly rawValue: bigint | number | boolean;
      readonly displayValue: string;
    }
  | { readonly success: false; readonly messageKey: string; readonly requiredBytes?: number };

/** Panelin "çözüm göster" kararı. */
export function isDecodableField(field: DsdlField): boolean {
  return (
    field.bitOffset !== undefined &&
    field.bitLength !== undefined &&
    field.primitive !== undefined &&
    field.primitive.kind !== 'void' &&
    field.array === undefined
  );
}

export function decodeDsdlField(field: DsdlField, bytes: Uint8Array): DsdlDecodeResult {
  if (!isDecodableField(field) || field.bitOffset === undefined || field.bitLength === undefined) {
    return { success: false, messageKey: 'definition.dsdl.decode.noLayout' };
  }

  const endBit = field.bitOffset + field.bitLength;
  if (endBit > bytes.length * BITS_PER_BYTE) {
    return {
      success: false,
      messageKey: 'definition.dsdl.decode.tooShort',
      requiredBytes: Math.ceil(endBit / BITS_PER_BYTE),
    };
  }

  const raw = readBits(bytes, field.bitOffset, field.bitLength, 'lsb-first');
  const kind = field.primitive?.kind;

  if (kind === 'bool') {
    const value = raw !== 0n;
    return { success: true, rawValue: value, displayValue: value ? 'true' : 'false' };
  }
  if (kind === 'signed') {
    const value = toSignedBits(raw, field.bitLength);
    return { success: true, rawValue: value, displayValue: String(value) };
  }
  if (kind === 'float') {
    const value = decodeFloatBits(raw, field.bitLength);
    return { success: true, rawValue: value, displayValue: String(Number(value.toPrecision(9))) };
  }
  return { success: true, rawValue: raw, displayValue: String(raw) };
}

/**
 * IEEE 754 bit desenini sayıya çevirir. `float16` için `DataView` doğrudan
 * okumaz; yarı duyarlık elle açılır (üs kaydırması 15, mantis 10 bit).
 */
function decodeFloatBits(raw: bigint, bitLength: number): number {
  if (bitLength === 64) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, raw, false);
    return new DataView(buffer).getFloat64(0, false);
  }
  if (bitLength === 32) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, Number(raw), false);
    return new DataView(buffer).getFloat32(0, false);
  }

  const value = Number(raw);
  const sign = (value & 0x80_00) === 0 ? 1 : -1;
  const exponent = (value >> 10) & 0x1f;
  const mantissa = value & 0x03_ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa === 0 ? sign * Infinity : Number.NaN;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}
