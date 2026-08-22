/**
 * USB 2.0 paket çekirdeği — Faz 10 dalga 11j (sıralama önerisi #9,
 * `brief-faz10-dalga11.md:127`). PID çözümü, token/SOF/veri/handshake paket
 * iskeleti, CRC5 ve CRC16 doğrulaması burada; alan tablosuna çeviren katman
 * `usb.ts`, tanımlayıcı/istek ağacı `usbDescriptors.ts`.
 *
 * **Kapsam sınırı — TEK paket.** Yakalama bir NRZI/bit-stuffing çözülmüş paket
 * gövdesidir: PID baytı + ona ait alanlar. SYNC ve EOP KAPSAM DIŞI (spec §8.2:
 * "SYNC ... is not shown in the following packet diagrams"; ikisi de bit
 * seviyesinde, bayt akışında izleri yok). Transaction (token+data+handshake
 * üçlüsü) ve transfer seviyeleri de KAPSAM DIŞI: bayt akışında paket sınırını
 * veren tek şey SYNC/EOP olduğu için art arda yapıştırılmış paketler
 * BÖLÜNEMEZ — bölmeye çalışmak, olmayan bir bilgiyi uydurmak olurdu. Spec
 * özetinin istediği "Packet / Transaction / Transfer üç seviyesi"nin yalnız
 * ilki gerçekleşiyor, kalan ikisi canlı yakalama katmanı gelince anlamlı olur.
 *
 * **Bit sırası (spec §8.1):** bitler hatta LSb-first gider. Bu dosyadaki her
 * "hat baytı" dönüşümü bunu esas alır; ADDR/ENDP/CRC5'in bayt içi yerleşimi
 * (aşağıdaki `splitToken`) bu kuraldan TÜRETİLDİ, bir tablodan kopyalanmadı ve
 * spec'in kendi residual değerleriyle testte doğrulandı.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';

const HEX_RADIX = 16;
const BITS_PER_BYTE = 8;

/** Token/SOF alanı: ADDR<6:0>+ENDP<3:0> ya da 11 bitlik frame number. */
const TOKEN_FIELD_BITS = 11;
const TOKEN_CRC_BITS = 5;
const TOKEN_CRC_POLY = 0x05;
const TOKEN_PACKET_LENGTH = 3;
const HANDSHAKE_PACKET_LENGTH = 1;
const DATA_CRC_LENGTH = 2;
const MIN_DATA_PACKET_LENGTH = 1 + DATA_CRC_LENGTH;

const ADDRESS_MASK = 0x7f;
const ENDPOINT_MASK = 0x0f;
const FRAME_NUMBER_MASK = 0x7ff;

/**
 * Spec §8.3.5.1'in yayımladığı token residual'ı (01100B) ve §8.3.5.2'nin veri
 * residual'ı (1000000000001101B) — doğrulama testinin fixture'ları, koda
 * gömülü sabit olarak DEĞİL, testte kullanılır. Burada yalnız belgelenir.
 */
export const USB_TOKEN_CRC_RESIDUAL = 0b01100;
export const USB_DATA_CRC_RESIDUAL = 0x800d;

export type UsbPidGroup = 'token' | 'data' | 'handshake' | 'special';

export type UsbPidName =
  | 'OUT'
  | 'IN'
  | 'SOF'
  | 'SETUP'
  | 'DATA0'
  | 'DATA1'
  | 'DATA2'
  | 'MDATA'
  | 'ACK'
  | 'NAK'
  | 'STALL'
  | 'NYET'
  | 'PRE/ERR'
  | 'SPLIT'
  | 'PING'
  | 'Reserved';

/**
 * Spec Table 8-1 (PID Types) BİREBİR. PID<3:0> değerleri tablodaki MSb sırasıyla
 * yazılıdır; PRE ve ERR AYNI kodu (1100B) paylaşır — spec'in kendi notu, biri
 * token biri handshake bağlamında geçerli, tek paketten ayrılamaz.
 */
const PID_TYPES: Record<number, { name: UsbPidName; group: UsbPidGroup }> = {
  0b0001: { name: 'OUT', group: 'token' },
  0b1001: { name: 'IN', group: 'token' },
  0b0101: { name: 'SOF', group: 'token' },
  0b1101: { name: 'SETUP', group: 'token' },
  0b0011: { name: 'DATA0', group: 'data' },
  0b1011: { name: 'DATA1', group: 'data' },
  0b0111: { name: 'DATA2', group: 'data' },
  0b1111: { name: 'MDATA', group: 'data' },
  0b0010: { name: 'ACK', group: 'handshake' },
  0b1010: { name: 'NAK', group: 'handshake' },
  0b1110: { name: 'STALL', group: 'handshake' },
  0b0110: { name: 'NYET', group: 'handshake' },
  0b1100: { name: 'PRE/ERR', group: 'special' },
  0b1000: { name: 'SPLIT', group: 'special' },
  0b0100: { name: 'PING', group: 'special' },
  0b0000: { name: 'Reserved', group: 'special' },
};

export interface UsbPid {
  /** Hattaki tam bayt (tip + check alanı). */
  byte: number;
  /** PID<3:0> — paket türü. */
  type: number;
  /** PID<7:4> — tip alanının bire tümleyeni (spec §8.3.1). */
  check: number;
  name: UsbPidName;
  group: UsbPidGroup;
  /** Check alanı tip alanının tümleyeni mi (spec §8.3.1: değilse paket yok sayılır). */
  checkValid: boolean;
}

export interface UsbTokenStructure {
  address: number;
  endpoint: number;
  /** Hattan okunan CRC5. */
  crc5: number;
  /** Alanlardan bağımsızca hesaplanan CRC5. */
  crc5Calculated: number;
  crc5Valid: boolean;
}

export interface UsbSofStructure {
  frameNumber: number;
  crc5: number;
  crc5Calculated: number;
  crc5Valid: boolean;
}

export interface UsbDataStructure {
  payload: Uint8Array;
  /** Hattan okunan CRC16 (little-endian iki bayt, spec §8.1 bit sırasının sonucu). */
  crc16: number;
  crc16Calculated: number;
  crc16Valid: boolean;
}

export type UsbPacketKind = 'token' | 'sof' | 'data' | 'handshake' | 'special' | 'unknown';

export interface UsbPacketStructure {
  pid: UsbPid;
  kind: UsbPacketKind;
  token?: UsbTokenStructure;
  sof?: UsbSofStructure;
  data?: UsbDataStructure;
  /** Beklenen uzunluğa göre eksik/fazla bayt sayısı (0 ise tam). */
  lengthMismatch: number;
  /** Paketin gövdesinden arta kalan, hiçbir alana düşmeyen baytlar. */
  trailingBytes: Uint8Array;
}

export function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export function formatHexWord(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

export function formatBinary(value: number, width: number): string {
  return `0b${value.toString(2).padStart(width, '0')}`;
}

/**
 * Spec §8.3.5'in metnine BİREBİR sadık bit-serial CRC: register all-ones ile
 * tohumlanır, her veri biti için register'ın en yüksek biti bitle XOR'lanır,
 * register sola kayar, XOR sonucu 1 ise polinomla XOR'lanır. Gönderilen değer
 * kalanın tümleyenidir.
 *
 * Bayt seviyeli `crc()` motoru burada KULLANILAMAZ: token alanı 11 bit, bayt
 * sınırına oturmuyor. Veri CRC16'sı ise bayt hizalı olduğu için katalog
 * girdisiyle (`CRC16_USB`) hesaplanır — bu iki yolun aynı sonucu verdiği
 * testte sabitlenmiştir.
 */
function specCrcOverBits(bits: readonly number[], width: number, poly: number): number {
  const mask = (1 << width) - 1;
  let remainder = mask;
  for (const bit of bits) {
    const xor = ((remainder >> (width - 1)) & 1) ^ bit;
    remainder = (remainder << 1) & mask;
    if (xor === 1) remainder ^= poly;
  }
  return remainder;
}

function bitsOfValue(value: number, count: number): number[] {
  const bits: number[] = [];
  for (let index = 0; index < count; index += 1) bits.push((value >> index) & 1);
  return bits;
}

/**
 * 11 bitlik token/SOF alanının CRC5'i. `value` alan bitlerini LSb-first
 * taşıyan tamsayıdır (token için `ADDR | ENDP<<7`, SOF için frame number).
 */
export function computeUsbTokenCrc5(value: number): number {
  const remainder = specCrcOverBits(bitsOfValue(value, TOKEN_FIELD_BITS), TOKEN_CRC_BITS, TOKEN_CRC_POLY);
  return ~remainder & ((1 << TOKEN_CRC_BITS) - 1);
}

/** Veri paketinin yükü üzerinden CRC16 (spec §8.3.5.2 → katalog `CRC16_USB`). */
export function computeUsbDataCrc16(payload: Uint8Array): number {
  return Number(computeNamedCrc(payload, 'CRC16_USB'));
}

/**
 * 11 bitlik alan + 5 bitlik CRC'yi hat baytlarına paketler. CRC MSb-first
 * gönderilir (spec §8.3.5), bitler bayta LSb-first yerleşir (spec §8.1) — bu
 * yüzden CRC ikinci baytın 3..7 bitlerinde TERS sırada durur. Bu yerleşim
 * `2D 00 10` (SETUP, adres 0, endpoint 0) hat dizisiyle testte doğrulanmıştır.
 */
export function packTokenBytes(fieldValue: number, crc5: number): Uint8Array {
  const wireBits = [...bitsOfValue(fieldValue, TOKEN_FIELD_BITS)];
  for (let index = TOKEN_CRC_BITS - 1; index >= 0; index -= 1) wireBits.push((crc5 >> index) & 1);
  const bytes = new Uint8Array(2);
  wireBits.forEach((bit, index) => {
    if (bit === 1) {
      const byteIndex = Math.floor(index / BITS_PER_BYTE);
      bytes[byteIndex] = (bytes[byteIndex] ?? 0) | (1 << index % BITS_PER_BYTE);
    }
  });
  return bytes;
}

/** `packTokenBytes`in tersi: iki hat baytından 11 bitlik alanı ve CRC5'i ayırır. */
function unpackTokenBytes(first: number, second: number): { fieldValue: number; crc5: number } {
  const fieldValue = (first | (second << BITS_PER_BYTE)) & FRAME_NUMBER_MASK;
  let crc5 = 0;
  for (let index = 0; index < TOKEN_CRC_BITS; index += 1) {
    const bit = (second >> (3 + index)) & 1;
    // Hatta MSb-first gittiği için ilk okunan bit CRC'nin en yüksek biti.
    crc5 |= bit << (TOKEN_CRC_BITS - 1 - index);
  }
  return { fieldValue, crc5 };
}

export function decodeUsbPid(byte: number): UsbPid {
  const type = byte & 0x0f;
  const check = (byte >> 4) & 0x0f;
  const entry = PID_TYPES[type] ?? { name: 'Reserved' as UsbPidName, group: 'special' as UsbPidGroup };
  return {
    byte,
    type,
    check,
    name: entry.name,
    group: entry.group,
    checkValid: check === (~type & 0x0f),
  };
}

function splitToken(pid: UsbPid, data: Uint8Array): Pick<UsbPacketStructure, 'token' | 'sof'> {
  const { fieldValue, crc5 } = unpackTokenBytes(data[1] ?? 0, data[2] ?? 0);
  const crc5Calculated = computeUsbTokenCrc5(fieldValue);
  const crc5Valid = crc5 === crc5Calculated;

  if (pid.name === 'SOF') {
    return {
      sof: { frameNumber: fieldValue & FRAME_NUMBER_MASK, crc5, crc5Calculated, crc5Valid },
    };
  }

  return {
    token: {
      address: fieldValue & ADDRESS_MASK,
      endpoint: (fieldValue >> 7) & ENDPOINT_MASK,
      crc5,
      crc5Calculated,
      crc5Valid,
    },
  };
}

function splitData(data: Uint8Array): UsbDataStructure {
  const payload = data.slice(1, Math.max(1, data.length - DATA_CRC_LENGTH));
  const crcLow = data[data.length - DATA_CRC_LENGTH] ?? 0;
  const crcHigh = data[data.length - 1] ?? 0;
  const crc16 = crcLow | (crcHigh << BITS_PER_BYTE);
  const crc16Calculated = computeUsbDataCrc16(payload);
  return { payload, crc16, crc16Calculated, crc16Valid: crc16 === crc16Calculated };
}

/**
 * Bir USB paketini iskelete ayırır. Uzunluk beklentiyi tutmuyorsa alanlar YİNE
 * doldurulur (kısmi çözüm gösterilir) ve fark `lengthMismatch`e yazılır; artan
 * baytlar `trailingBytes`e düşer — 11a/11b'nin "veri sessizce kayboluyor"
 * hata sınıfına karşı bu dosyada da aynı bekçi.
 */
export function splitUsbPacket(data: Uint8Array): UsbPacketStructure {
  const pid = decodeUsbPid(data[0] ?? 0);
  const empty = new Uint8Array(0);

  if (pid.group === 'token' && pid.name !== 'SOF') {
    const parts = splitToken(pid, data);
    return {
      pid,
      kind: 'token',
      ...parts,
      lengthMismatch: data.length - TOKEN_PACKET_LENGTH,
      trailingBytes: data.slice(TOKEN_PACKET_LENGTH),
    };
  }

  if (pid.name === 'SOF') {
    const parts = splitToken(pid, data);
    return {
      pid,
      kind: 'sof',
      ...parts,
      lengthMismatch: data.length - TOKEN_PACKET_LENGTH,
      trailingBytes: data.slice(TOKEN_PACKET_LENGTH),
    };
  }

  if (pid.group === 'data') {
    if (data.length < MIN_DATA_PACKET_LENGTH) {
      // CRC16 için yeterli bayt yok: yük boş sayılır, eldeki baytlar kaybolmaz.
      return {
        pid,
        kind: 'data',
        lengthMismatch: data.length - MIN_DATA_PACKET_LENGTH,
        trailingBytes: data.slice(1),
      };
    }
    return {
      pid,
      kind: 'data',
      data: splitData(data),
      lengthMismatch: 0,
      trailingBytes: empty,
    };
  }

  if (pid.group === 'handshake') {
    return {
      pid,
      kind: 'handshake',
      lengthMismatch: data.length - HANDSHAKE_PACKET_LENGTH,
      trailingBytes: data.slice(HANDSHAKE_PACKET_LENGTH),
    };
  }

  return {
    pid,
    kind: pid.name === 'Reserved' ? 'unknown' : 'special',
    lengthMismatch: 0,
    trailingBytes: data.slice(1),
  };
}

/** Token paketinin hat baytlarını üretir (örnek çerçeveler ve testler için). */
export function buildTokenPacket(pidByte: number, address: number, endpoint: number): Uint8Array {
  const fieldValue = (address & ADDRESS_MASK) | ((endpoint & ENDPOINT_MASK) << 7);
  return Uint8Array.from([pidByte, ...packTokenBytes(fieldValue, computeUsbTokenCrc5(fieldValue))]);
}

/** SOF paketinin hat baytlarını üretir. */
export function buildSofPacket(pidByte: number, frameNumber: number): Uint8Array {
  const fieldValue = frameNumber & FRAME_NUMBER_MASK;
  return Uint8Array.from([pidByte, ...packTokenBytes(fieldValue, computeUsbTokenCrc5(fieldValue))]);
}

/** Veri paketinin hat baytlarını üretir (CRC16 bağımsızca hesaplanır). */
export function buildDataPacket(pidByte: number, payload: Uint8Array): Uint8Array {
  const crc16 = computeUsbDataCrc16(payload);
  return Uint8Array.from([pidByte, ...payload, crc16 & 0xff, (crc16 >> BITS_PER_BYTE) & 0xff]);
}

/** Spec Table 8-1'deki PID bayt değerleri (tip + tümleyen check alanı). */
export const USB_PID_BYTES = {
  OUT: 0xe1,
  IN: 0x69,
  SOF: 0xa5,
  SETUP: 0x2d,
  DATA0: 0xc3,
  DATA1: 0x4b,
  DATA2: 0x87,
  MDATA: 0x0f,
  ACK: 0xd2,
  NAK: 0x5a,
  STALL: 0x1e,
  NYET: 0x96,
  PING: 0xb4,
  SPLIT: 0x78,
} as const;
