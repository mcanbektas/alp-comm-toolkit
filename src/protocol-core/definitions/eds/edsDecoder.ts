/**
 * EDS veri tipi çözücüsü — ham baytlar + CiA 301 DataType kodu → tipli değer.
 *
 * `dbcDecoder.ts`in `Physical = Raw × Factor + Offset` formülünün EDS
 * karşılığı YOKTUR: CiA 301 Object Dictionary girdileri ölçek/offset taşımaz,
 * yalnız bir VERİ TİPİ taşır. Bu yüzden burada "fiziksel değer" değil, tipine
 * göre doğru okunmuş HAM değer üretilir.
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────
 * DataType kodları (0x0001-0x000A) spec'te YOK; CiA 301'in temel veri tipi
 * tablosudur — CAN FD DLC tablosuyla (`canFrame.ts`) aynı gerekçeyle dış
 * kaynaktan, açıkça belirtilerek alındı. Yalnız EN SIK görülen on tip
 * kapsanır; CiA 301'in geri kalanı (INTEGER24, UNSIGNED24, REAL64,
 * TIME_OF_DAY, DOMAIN, …) bilinçli DIŞARIDA — `dataType` bu tabloda yoksa
 * çözüm `undefined` döner, uydurulmaz.
 *
 * Sayılar KÜÇÜK-UÇLU (little-endian) okunur: CANopen'ın SDO expedited
 * transferindeki 4 veri baytı bu sırayı kullanır (bkz. `canopen.ts`).
 */

import type { EdsDecodedValue } from './edsTypes';

interface EdsDataTypeInfo {
  /** Protokol terimi — veridir, çevrilmez (CLAUDE.md). */
  readonly name: string;
  /** `undefined` = değişken uzunluklu (string/octet). */
  readonly byteLength: number | undefined;
}

/** CiA 301 Object Dictionary DataType kodları — dosya başı KAYNAK UYARISI. */
export const EDS_DATA_TYPES: ReadonlyMap<number, EdsDataTypeInfo> = new Map([
  [0x0001, { name: 'BOOLEAN', byteLength: 1 }],
  [0x0002, { name: 'INTEGER8', byteLength: 1 }],
  [0x0003, { name: 'INTEGER16', byteLength: 2 }],
  [0x0004, { name: 'INTEGER32', byteLength: 4 }],
  [0x0005, { name: 'UNSIGNED8', byteLength: 1 }],
  [0x0006, { name: 'UNSIGNED16', byteLength: 2 }],
  [0x0007, { name: 'UNSIGNED32', byteLength: 4 }],
  [0x0008, { name: 'REAL32', byteLength: 4 }],
  [0x0009, { name: 'VISIBLE_STRING', byteLength: undefined }],
  [0x000a, { name: 'OCTET_STRING', byteLength: undefined }],
]);

export function getEdsDataTypeInfo(dataType: number): EdsDataTypeInfo | undefined {
  return EDS_DATA_TYPES.get(dataType);
}

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

function decodeAscii(data: Uint8Array): string {
  return Array.from(data, (byte) => String.fromCharCode(byte)).join('');
}

function decodeOctetString(data: Uint8Array): string {
  return Array.from(data, (byte) => byte.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, '0')).join(' ');
}

/**
 * `data`yı `dataType`ın CiA 301 kodlamasına göre okur. `undefined` iki
 * durumda döner: tip tabloda yok (dosya başı uyarısı) ya da sabit uzunluklu
 * bir tip için bayt yetersiz — ikisi de "gösterilecek bir şey yok" demektir,
 * fırlatmaz (spec §47).
 */
export function decodeEdsValue(data: Uint8Array, dataType: number): EdsDecodedValue | undefined {
  const info = EDS_DATA_TYPES.get(dataType);
  if (info === undefined) return undefined;

  if (info.name === 'VISIBLE_STRING') {
    return { dataTypeName: info.name, value: decodeAscii(data) };
  }
  if (info.name === 'OCTET_STRING') {
    return { dataTypeName: info.name, value: decodeOctetString(data) };
  }

  const byteLength = info.byteLength;
  if (byteLength === undefined || data.length < byteLength) return undefined;

  const view = new DataView(data.buffer, data.byteOffset, byteLength);
  const LITTLE_ENDIAN = true;
  let value: number;
  switch (info.name) {
    case 'BOOLEAN':
    case 'UNSIGNED8':
      value = view.getUint8(0);
      break;
    case 'INTEGER8':
      value = view.getInt8(0);
      break;
    case 'UNSIGNED16':
      value = view.getUint16(0, LITTLE_ENDIAN);
      break;
    case 'INTEGER16':
      value = view.getInt16(0, LITTLE_ENDIAN);
      break;
    case 'UNSIGNED32':
      value = view.getUint32(0, LITTLE_ENDIAN);
      break;
    case 'INTEGER32':
      value = view.getInt32(0, LITTLE_ENDIAN);
      break;
    case 'REAL32':
      value = view.getFloat32(0, LITTLE_ENDIAN);
      break;
    default:
      return undefined;
  }
  return { dataTypeName: info.name, value };
}
