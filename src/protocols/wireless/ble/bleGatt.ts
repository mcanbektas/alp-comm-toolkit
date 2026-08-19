/**
 * BLE GATT (Bluetooth Core Specification 6.3, [Vol 3] Part F "ATT" + Part G
 * "GATT" + Assigned Numbers — 2026-08-17 tarihli resmi PDF) — bağlantılı ATT
 * PDU'su: 1 baytlık Opcode + PDU tipine göre değişen gövde.
 *
 * ── GİRDİ MODELİ: ÇIPLAK ATT PDU, OPSİYONEL L2CAP ÖNEKİ TANINIR (karar 2) ───
 * Web Bluetooth'un `characteristicvaluechanged` olayı çıplak ATT değeri verir
 * (L2CAP/ATT CID ayıklanmış), Wireshark dökümü ise L2CAP Basic çerçevesiyle
 * (Length(2,LE)+CID(2,LE)+ATT PDU) başlar. Girdinin ilk 4 baytı geçerli bir
 * L2CAP başlığı GİBİ görünüyorsa (Length kalan baytla TAM eşleşir VE
 * CID==0x0004 VE soyulduktan sonra en az 1 bayt ATT PDU kalır) başlık
 * algılanır, soyulur, uyarı basılır; üçü birden sağlanmazsa tüm girdi çıplak
 * ATT PDU sayılır. Tek girdi kutusu iki kaynağı da yer.
 *
 * ── OPCODE BİT ALANLARI: LSB-FIRST ──────────────────────────────────────────
 * Method[5:0] + Command Flag[6] + Authentication Signature Flag[7] (Part F
 * §3.3.1) — bitCursor `lsb-first` (bleAdvertisement.ts'in header-byte0
 * deseniyle aynı sıra). Opcode'un TAMAMI (byte değeri) PDU tipini belirler;
 * ör. Write Request 0x12 ile Write Command 0x52 aynı Method'u (0x12) taşır,
 * ayrım yalnız Command Flag bitindedir.
 *
 * ── PDU TİPİNE GÖRE GÖVDE: DAR KÜME, KALANI HAM ─────────────────────────────
 * Yalnız brief 8a adım 2'deki onyedi opcode adlandırılır ve gövdesi çözülür
 * (Error/Exchange MTU/Find Information/Read (By Type/By Group Type)/Write/
 * Write Command/Handle Value Notification-Indication-Confirmation). Diğer
 * opcode'lar (Find By Type Value, Read Blob, Prepare/Execute Write, Signed
 * Write Command …) ham + "PDU şeması çözülmüyor" uyarısı — yanlış şemayla
 * Handle/UUID okumak sessiz-yanlış decode olurdu (bleAdvertisement.ts'in
 * payload şeması emsali).
 *
 * ── DEĞER (ATT VALUE) ŞEMASIZ: HAM KALIR ────────────────────────────────────
 * Read/Write/Notification/Indication'ın taşıdığı characteristic DEĞERİ hiçbir
 * GATT şeması olmadan anlamlandırılamaz (Custom GATT Schema Import — katalog
 * `definitions: ['custom-schema']` — bu dalganın kapsamı DIŞINDA, brief 8d).
 * Value alanı her zaman ham bayt olarak gösterilir.
 *
 * ── CCCD (0x2902) BİT ÇÖZÜMÜ: AYRI, OTOMATİK BAĞLANMAZ ──────────────────────
 * `decodeCccdValue` bilinçli olarak genel Value alanına KABLOLANMAZ: bu
 * parser tek bir ATT PDU'yu SAF çözer (ProtocolParser sözleşmesi, spec §47 —
 * "parse çağrısı içeride durum biriktirmez"). Bir Handle'ın CCCD olduğunu
 * bilmek GATT keşif geçmişini (Discover All Characteristic Descriptors)
 * gerektirir; bu oturum durumu tek-PDU'luk bu fonksiyonda YOK. Handle'ın
 * UUID'sini kendi ağacından bilen çağıran (GATT ağacını izleyen dalga 8c
 * katmanı) bu fonksiyonu doğrudan çağırır — tahmin değil, kanıtlı bağlam.
 *
 * ── GÖSTERİM: HANDLE 4 HANE BÜYÜK HARF, 128-BIT UUID TERS ───────────────────
 * Handle teldeyken little-endian; ekranda `0x` + 4 hane büyük harf (dosya
 * başı). 128-bit UUID teldeyken little-endian; ekranda standart tire
 * gösterimi baytları TERS sırada okur (bleAdvertisement.ts'in AdvA/UUID128
 * gösterim kararıyla aynı — Core Spec'in TÜM çok-oktetli alanları için tek
 * bit sırası kuralı).
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'ble-gatt';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'BLE GATT';
/** Çeviri anahtarı segmentlerinde tire olamaz (bleAdvertisement.ts TRANSLATION_KEY_PREFIX emsali). */
const TRANSLATION_KEY_PREFIX = 'protocol.bleGatt';

const OPCODE_LENGTH = 1;

const METHOD_BIT_POSITION = 0;
const METHOD_BIT_LENGTH = 6;
const COMMAND_FLAG_BIT_POSITION = 6;
const AUTH_SIG_FLAG_BIT_POSITION = 7;

const L2CAP_HEADER_LENGTH = 4;
/** L2CAP Fixed Channel — ATT'nin sabit CID'i (Core Spec [Vol 3] Part A §2.1). */
const ATT_CID = 0x0004;

type AttPduKind =
  | 'error-response'
  | 'exchange-mtu-request'
  | 'exchange-mtu-response'
  | 'find-information-request'
  | 'find-information-response'
  | 'read-by-type-request'
  | 'read-by-type-response'
  | 'read-request'
  | 'read-response'
  | 'read-by-group-type-request'
  | 'read-by-group-type-response'
  | 'write-request'
  | 'write-response'
  | 'write-command'
  | 'handle-value-notification'
  | 'handle-value-indication'
  | 'handle-value-confirmation';

interface AttOpcodeInfo {
  readonly name: string;
  readonly kind: AttPduKind;
}

/** Core Spec [Vol 3] Part F §3.4 (dosya başı dar küme) — Wireshark packet-btatt.c + Zephyr att.h ile çapraz doğrulandı. */
const ATT_OPCODES: ReadonlyMap<number, AttOpcodeInfo> = new Map([
  [0x01, { name: 'Error Response', kind: 'error-response' }],
  [0x02, { name: 'Exchange MTU Request', kind: 'exchange-mtu-request' }],
  [0x03, { name: 'Exchange MTU Response', kind: 'exchange-mtu-response' }],
  [0x04, { name: 'Find Information Request', kind: 'find-information-request' }],
  [0x05, { name: 'Find Information Response', kind: 'find-information-response' }],
  [0x08, { name: 'Read By Type Request', kind: 'read-by-type-request' }],
  [0x09, { name: 'Read By Type Response', kind: 'read-by-type-response' }],
  [0x0a, { name: 'Read Request', kind: 'read-request' }],
  [0x0b, { name: 'Read Response', kind: 'read-response' }],
  [0x10, { name: 'Read By Group Type Request', kind: 'read-by-group-type-request' }],
  [0x11, { name: 'Read By Group Type Response', kind: 'read-by-group-type-response' }],
  [0x12, { name: 'Write Request', kind: 'write-request' }],
  [0x13, { name: 'Write Response', kind: 'write-response' }],
  [0x1b, { name: 'Handle Value Notification', kind: 'handle-value-notification' }],
  [0x1d, { name: 'Handle Value Indication', kind: 'handle-value-indication' }],
  [0x1e, { name: 'Handle Value Confirmation', kind: 'handle-value-confirmation' }],
  [0x52, { name: 'Write Command', kind: 'write-command' }],
]);

/** Core Spec [Vol 3] Part F §3.4.1.1 — dar küme (dosya başı), 0x01-0x11 temel ATT hata uzayının TAMAMI. */
const ATT_ERROR_CODES: ReadonlyMap<number, string> = new Map([
  [0x01, 'Invalid Handle'],
  [0x02, 'Read Not Permitted'],
  [0x03, 'Write Not Permitted'],
  [0x04, 'Invalid PDU'],
  [0x05, 'Insufficient Authentication'],
  [0x06, 'Request Not Supported'],
  [0x07, 'Invalid Offset'],
  [0x08, 'Insufficient Authorization'],
  [0x09, 'Prepare Queue Full'],
  [0x0a, 'Attribute Not Found'],
  [0x0b, 'Attribute Not Long'],
  [0x0c, 'Insufficient Encryption Key Size'],
  [0x0d, 'Invalid Attribute Value Length'],
  [0x0e, 'Unlikely Error'],
  [0x0f, 'Insufficient Encryption'],
  [0x10, 'Unsupported Group Type'],
  [0x11, 'Insufficient Resources'],
]);

/**
 * Assigned Numbers (2026-08-17) — karar 3: GATT yapısal UUID'ler (Declarations
 * + Descriptors) TAM, yaygın profillerden en çok 15. Yapısal olmadan ağaç hiç
 * okunamaz (zorunlu); profil isimleri konfordur, tam kütüphane ayrı/ucuz bir
 * turun işi (Zigbee ZCL borcuyla aynı sınıf, brief 8a dışı).
 */
const UUID_NAMES: ReadonlyMap<number, string> = new Map([
  // GATT yapısal — TAM.
  [0x2800, 'Primary Service'],
  [0x2801, 'Secondary Service'],
  [0x2802, 'Include'],
  [0x2803, 'Characteristic'],
  [0x2900, 'Characteristic Extended Properties'],
  [0x2901, 'Characteristic User Description'],
  [0x2902, 'Client Characteristic Configuration'],
  [0x2903, 'Server Characteristic Configuration'],
  [0x2904, 'Characteristic Presentation Format'],
  [0x2905, 'Characteristic Aggregate Format'],
  // Yaygın profiller — en çok 15.
  [0x1800, 'Generic Access'],
  [0x1801, 'Generic Attribute'],
  [0x180a, 'Device Information'],
  [0x180d, 'Heart Rate'],
  [0x180f, 'Battery Service'],
  [0x181a, 'Environmental Sensing'],
  [0x2a00, 'Device Name'],
  [0x2a01, 'Appearance'],
  [0x2a19, 'Battery Level'],
  [0x2a24, 'Model Number String'],
  [0x2a25, 'Serial Number String'],
  [0x2a26, 'Firmware Revision String'],
  [0x2a29, 'Manufacturer Name String'],
  [0x2a37, 'Heart Rate Measurement'],
  [0x2a6e, 'Temperature'],
]);

const ERROR_FRAME_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.frameTooShort`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_PDU_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.pduTooShort`;
const ERROR_UUID_LENGTH_INVALID = `${TRANSLATION_KEY_PREFIX}.error.uuidLengthInvalid`;

const WARN_UNKNOWN_OPCODE = `${TRANSLATION_KEY_PREFIX}.warning.unknownOpcode`;
const WARN_PDU_SCHEMA_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.pduSchemaNotDecoded`;
const WARN_UNKNOWN_ERROR_CODE = `${TRANSLATION_KEY_PREFIX}.warning.unknownErrorCode`;
const WARN_UNKNOWN_FORMAT = `${TRANSLATION_KEY_PREFIX}.warning.unknownFormat`;
const WARN_INVALID_ENTRY_LENGTH = `${TRANSLATION_KEY_PREFIX}.warning.invalidEntryLength`;
const WARN_L2CAP_HEADER_DETECTED = `${TRANSLATION_KEY_PREFIX}.warning.l2capHeaderDetected`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) | (byteAt(bytes, offset + 1) << 8);
}

/** Wire LE; ekranda 0x + 4 hane büyük harf (dosya başı gösterim notu). */
function formatHandle(value: number): string {
  return toHex(value, 2);
}

/** Wire LE; standart 128-bit UUID gösterimi baytları TERS sırada okur (bleAdvertisement.ts formatUuid128 emsali). */
function formatUuid128(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * L2CAP Basic çerçeve öneki algılama — üç koşul birden sağlanmalı (dosya
 * başı karar 2): Length kalan baytla TAM eşleşir, CID==0x0004, VE
 * `data.length > L2CAP_HEADER_LENGTH` olduğu için soyulduktan sonra en az 1
 * bayt ATT PDU kalır. Sağlanmazsa 0 döner — tüm girdi çıplak ATT PDU sayılır.
 */
function detectL2capHeaderLength(data: Uint8Array): number {
  if (data.length <= L2CAP_HEADER_LENGTH) return 0;
  const declaredLength = readUint16Le(data, 0);
  const cid = readUint16Le(data, 2);
  const remaining = data.length - L2CAP_HEADER_LENGTH;
  return cid === ATT_CID && declaredLength === remaining ? L2CAP_HEADER_LENGTH : 0;
}

export type CccdState = 'none' | 'notification' | 'indication' | 'notification-and-indication';

/**
 * CCCD (0x2902) 2 baytlık değerinin bit çözümü — bit0 Notification, bit1
 * Indication (Core Spec [Vol 3] Part G §3.3.3.3). Genel Value alanına
 * KASTEN bağlanmaz (dosya başı) — çağıran, Handle'ın CCCD olduğunu kendi
 * GATT keşfinden bildiğinde doğrudan çağırır.
 */
export function decodeCccdValue(value: Uint8Array): CccdState {
  const bits = value.length >= 2 ? readUint16Le(value, 0) : byteAt(value, 0);
  const notification = (bits & 0b01) !== 0;
  const indication = (bits & 0b10) !== 0;
  if (notification && indication) return 'notification-and-indication';
  if (notification) return 'notification';
  if (indication) return 'indication';
  return 'none';
}

function pushHandleField(
  fields: ParsedField[],
  id: string,
  name: string,
  baseOffset: number,
  attPdu: Uint8Array,
  localOffset: number,
): void {
  const handle = readUint16Le(attPdu, localOffset);
  fields.push({
    id,
    name,
    offset: baseOffset + localOffset,
    length: 2,
    rawBytes: attPdu.slice(localOffset, localOffset + 2),
    rawValue: formatHandle(handle),
    valid: true,
    warnings: [],
  });
}

/** Value şeması bilinmez (Custom GATT Schema Import 8a kapsamı dışı, dosya başı) — ham gösterilir. */
function pushValueField(fields: ParsedField[], baseOffset: number, attPdu: Uint8Array, localOffset: number): void {
  if (attPdu.length <= localOffset) return;
  const value = attPdu.slice(localOffset);
  fields.push({
    id: 'value',
    name: 'Value',
    offset: baseOffset + localOffset,
    length: value.length,
    rawBytes: value,
    unit: 'B',
    valid: true,
    warnings: [],
  });
}

function pushUuidField(
  fields: ParsedField[],
  id: string,
  name: string,
  baseOffset: number,
  localOffset: number,
  uuidBytes: Uint8Array,
): void {
  if (uuidBytes.length === 2) {
    const uuid16 = readUint16Le(uuidBytes, 0);
    const field: ParsedField = {
      id,
      name,
      offset: baseOffset + localOffset,
      length: 2,
      rawBytes: uuidBytes,
      rawValue: uuid16,
      valid: true,
      warnings: [],
    };
    const knownName = UUID_NAMES.get(uuid16);
    if (knownName !== undefined) field.physicalValue = knownName;
    fields.push(field);
  } else {
    fields.push({
      id,
      name,
      offset: baseOffset + localOffset,
      length: 16,
      rawBytes: uuidBytes,
      rawValue: formatUuid128(uuidBytes),
      valid: true,
      warnings: [],
    });
  }
}

function pushTruncatedError(errors: ProtocolError[], offset: number, length: number): void {
  errors.push({ code: 'truncated-frame', message: ERROR_PDU_TOO_SHORT, offset, length });
}

/**
 * Opcode'a göre gövde dispatch'i (brief 8a adım 2-7). `attPdu` L2CAP önekinden
 * soyulmuş hâldedir; `baseOffset` gösterim için orijinal `data` içindeki
 * kaymayı taşır (L2CAP algılandıysa 4, aksi hâlde 0).
 */
function decodeAttPduBody(
  kind: AttPduKind,
  attPdu: Uint8Array,
  baseOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  switch (kind) {
    case 'error-response': {
      if (attPdu.length < 5) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      const requestOpcodeInError = byteAt(attPdu, 1);
      const requestOpcodeInfo = ATT_OPCODES.get(requestOpcodeInError);
      fields.push({
        id: 'request-opcode-in-error',
        name: 'Request Opcode In Error',
        offset: baseOffset + 1,
        length: 1,
        rawBytes: attPdu.slice(1, 2),
        rawValue: requestOpcodeInError,
        physicalValue: requestOpcodeInfo?.name ?? toHex(requestOpcodeInError, 1),
        valid: true,
        warnings: [],
      });
      pushHandleField(fields, 'attribute-handle-in-error', 'Attribute Handle In Error', baseOffset, attPdu, 2);
      const errorCode = byteAt(attPdu, 4);
      const errorCodeName = ATT_ERROR_CODES.get(errorCode);
      const errorCodeField: ParsedField = {
        id: 'error-code',
        name: 'Error Code',
        offset: baseOffset + 4,
        length: 1,
        rawBytes: attPdu.slice(4, 5),
        rawValue: errorCode,
        valid: errorCodeName !== undefined,
        warnings: [],
      };
      if (errorCodeName !== undefined) {
        errorCodeField.physicalValue = errorCodeName;
      } else {
        errorCodeField.warnings = [WARN_UNKNOWN_ERROR_CODE];
        warnings.push(toProtocolWarning(WARN_UNKNOWN_ERROR_CODE));
      }
      fields.push(errorCodeField);
      return;
    }

    case 'exchange-mtu-request':
    case 'exchange-mtu-response': {
      if (attPdu.length < 3) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      const mtu = readUint16Le(attPdu, 1);
      fields.push({
        id: 'mtu',
        name: kind === 'exchange-mtu-request' ? 'Client Rx MTU' : 'Server Rx MTU',
        offset: baseOffset + 1,
        length: 2,
        rawBytes: attPdu.slice(1, 3),
        rawValue: mtu,
        unit: 'B',
        valid: true,
        warnings: [],
      });
      return;
    }

    case 'find-information-request': {
      if (attPdu.length < 5) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      pushHandleField(fields, 'starting-handle', 'Starting Handle', baseOffset, attPdu, 1);
      pushHandleField(fields, 'ending-handle', 'Ending Handle', baseOffset, attPdu, 3);
      return;
    }

    case 'find-information-response': {
      if (attPdu.length < 2) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      const format = byteAt(attPdu, 1);
      const formatField: ParsedField = {
        id: 'format',
        name: 'Format',
        offset: baseOffset + 1,
        length: 1,
        rawBytes: attPdu.slice(1, 2),
        rawValue: format,
        valid: format === 0x01 || format === 0x02,
        warnings: [],
      };
      if (format === 0x01) formatField.physicalValue = 'UUID 16-bit';
      else if (format === 0x02) formatField.physicalValue = 'UUID 128-bit';
      fields.push(formatField);

      if (format !== 0x01 && format !== 0x02) {
        formatField.warnings = [WARN_UNKNOWN_FORMAT];
        warnings.push(toProtocolWarning(WARN_UNKNOWN_FORMAT));
        // Format bilinmeden Information Data'nın birim uzunluğu belirlenemez — ham bırak (dosya başı payload emsali).
        if (attPdu.length > 2) {
          fields.push({
            id: 'information-data',
            name: 'Information Data',
            offset: baseOffset + 2,
            length: attPdu.length - 2,
            rawBytes: attPdu.slice(2),
            valid: true,
            warnings: [WARN_PDU_SCHEMA_NOT_DECODED],
          });
          warnings.push(toProtocolWarning(WARN_PDU_SCHEMA_NOT_DECODED));
        }
        return;
      }

      const unitLength = format === 0x01 ? 4 : 18;
      const infoData = attPdu.slice(2);
      if (infoData.length === 0 || infoData.length % unitLength !== 0) {
        pushTruncatedError(errors, baseOffset + 2, infoData.length);
        return;
      }

      let index = 0;
      for (let offset = 0; offset < infoData.length; offset += unitLength) {
        index += 1;
        const handle = readUint16Le(infoData, offset);
        const uuidBytes = infoData.slice(offset + 2, offset + unitLength);
        const entryField: ParsedField = {
          id: `entry-${String(index)}`,
          name: `Entry #${String(index)} — Handle ${formatHandle(handle)}`,
          offset: baseOffset + 2 + offset,
          length: unitLength,
          rawBytes: infoData.slice(offset, offset + unitLength),
          valid: true,
          warnings: [],
        };
        if (format === 0x01) {
          const uuid16 = readUint16Le(uuidBytes, 0);
          entryField.rawValue = uuid16;
          const knownName = UUID_NAMES.get(uuid16);
          entryField.physicalValue = knownName ?? toHex(uuid16, 2);
        } else {
          entryField.rawValue = formatUuid128(uuidBytes);
        }
        fields.push(entryField);
      }
      return;
    }

    case 'read-by-type-request':
    case 'read-by-group-type-request': {
      if (attPdu.length < 5) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      pushHandleField(fields, 'starting-handle', 'Starting Handle', baseOffset, attPdu, 1);
      pushHandleField(fields, 'ending-handle', 'Ending Handle', baseOffset, attPdu, 3);
      const uuidBytes = attPdu.slice(5);
      const fieldId = kind === 'read-by-type-request' ? 'attribute-type' : 'group-type';
      const fieldName = kind === 'read-by-type-request' ? 'Attribute Type' : 'Group Type';
      if (uuidBytes.length === 2 || uuidBytes.length === 16) {
        pushUuidField(fields, fieldId, fieldName, baseOffset, 5, uuidBytes);
      } else {
        errors.push({
          code: 'value-out-of-range',
          message: ERROR_UUID_LENGTH_INVALID,
          offset: baseOffset + 5,
          length: uuidBytes.length,
        });
      }
      return;
    }

    case 'read-request': {
      if (attPdu.length < 3) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      pushHandleField(fields, 'handle', 'Handle', baseOffset, attPdu, 1);
      return;
    }

    case 'read-response': {
      pushValueField(fields, baseOffset, attPdu, 1);
      return;
    }

    case 'read-by-type-response':
    case 'read-by-group-type-response': {
      if (attPdu.length < 2) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      const entryLength = byteAt(attPdu, 1);
      // Read By Type: Handle(2)+en az 1 bayt değer. Read By Group Type: Handle(2)+End Group Handle(2)+en az 0 bayt değer.
      const minEntryLength = kind === 'read-by-type-response' ? 3 : 4;
      const validLength = entryLength >= minEntryLength;
      fields.push({
        id: 'entry-length',
        name: 'Length',
        offset: baseOffset + 1,
        length: 1,
        rawBytes: attPdu.slice(1, 2),
        rawValue: entryLength,
        unit: 'B',
        valid: validLength,
        warnings: validLength ? [] : [WARN_INVALID_ENTRY_LENGTH],
      });
      if (!validLength) {
        warnings.push(toProtocolWarning(WARN_INVALID_ENTRY_LENGTH));
        return;
      }

      const list = attPdu.slice(2);
      let index = 0;
      let cursor = 0;
      while (cursor < list.length) {
        if (cursor + entryLength > list.length) {
          pushTruncatedError(errors, baseOffset + 2 + cursor, list.length - cursor);
          break;
        }
        index += 1;
        const handle = readUint16Le(list, cursor);
        const name =
          kind === 'read-by-type-response'
            ? `Entry #${String(index)} — Handle ${formatHandle(handle)}`
            : `Entry #${String(index)} — Handle ${formatHandle(handle)} … ${formatHandle(readUint16Le(list, cursor + 2))}`;
        fields.push({
          id: `entry-${String(index)}`,
          name,
          offset: baseOffset + 2 + cursor,
          length: entryLength,
          rawBytes: list.slice(cursor, cursor + entryLength),
          valid: true,
          warnings: [],
        });
        cursor += entryLength;
      }
      return;
    }

    case 'write-request':
    case 'write-command':
    case 'handle-value-notification':
    case 'handle-value-indication': {
      if (attPdu.length < 3) {
        pushTruncatedError(errors, baseOffset + attPdu.length, 0);
        return;
      }
      pushHandleField(fields, 'handle', 'Handle', baseOffset, attPdu, 1);
      pushValueField(fields, baseOffset, attPdu, 3);
      return;
    }

    case 'write-response':
    case 'handle-value-confirmation':
      // Opcode dışında gövde yok (dosya başı).
      return;
  }
}

interface BleGattParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseBleGattFrame(data: Uint8Array, options: BleGattParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < OPCODE_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // L2CAP_HEADER_LENGTH>4 dönerse `data.length>L2CAP_HEADER_LENGTH` şartı yüzünden attPdu.length>=1 garantidir.
  const l2capHeaderLength = detectL2capHeaderLength(data);
  const attPdu = data.slice(l2capHeaderLength);
  if (l2capHeaderLength > 0) {
    fields.push({
      id: 'l2cap-header',
      name: 'L2CAP Header (Length + CID)',
      offset: 0,
      length: L2CAP_HEADER_LENGTH,
      rawBytes: data.slice(0, L2CAP_HEADER_LENGTH),
      rawValue: `Length=${String(readUint16Le(data, 0))}B, CID=${toHex(readUint16Le(data, 2), 2)}`,
      valid: true,
      warnings: [WARN_L2CAP_HEADER_DETECTED],
    });
    warnings.push(toProtocolWarning(WARN_L2CAP_HEADER_DETECTED));
  }

  const opcodeByte = byteAt(attPdu, 0);
  const method = readBitsAsNumber(attPdu, METHOD_BIT_POSITION, METHOD_BIT_LENGTH, 'lsb-first');
  const commandFlag = readBitsAsNumber(attPdu, COMMAND_FLAG_BIT_POSITION, 1, 'lsb-first');
  const authSigFlag = readBitsAsNumber(attPdu, AUTH_SIG_FLAG_BIT_POSITION, 1, 'lsb-first');
  const opcodeInfo = ATT_OPCODES.get(opcodeByte);

  const opcodeField: ParsedField = {
    id: 'opcode',
    name: 'Opcode',
    offset: l2capHeaderLength,
    length: OPCODE_LENGTH,
    rawBytes: attPdu.slice(0, 1),
    rawValue: opcodeByte,
    valid: opcodeInfo !== undefined,
    warnings: [],
  };
  if (opcodeInfo !== undefined) {
    opcodeField.physicalValue = opcodeInfo.name;
  } else {
    opcodeField.warnings = [WARN_UNKNOWN_OPCODE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_OPCODE));
  }
  fields.push(opcodeField);

  fields.push({
    id: 'method',
    name: 'Method',
    offset: l2capHeaderLength,
    length: METHOD_BIT_LENGTH,
    rawBytes: attPdu.slice(0, 1),
    rawValue: method,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'command-flag',
    name: 'Command Flag',
    offset: l2capHeaderLength,
    length: 1,
    rawBytes: attPdu.slice(0, 1),
    rawValue: commandFlag,
    physicalValue: commandFlag === 1 ? 'Command (no response expected)' : 'Request/Response (response expected)',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'auth-sig-flag',
    name: 'Authentication Signature Flag',
    offset: l2capHeaderLength,
    length: 1,
    rawBytes: attPdu.slice(0, 1),
    rawValue: authSigFlag,
    physicalValue: authSigFlag === 1 ? 'Signed (12-byte signature appended to payload)' : 'Unsigned',
    valid: true,
    warnings: [],
  });

  if (opcodeInfo === undefined) {
    // Bilinmeyen opcode: gövde şeması BİLİNMİYOR, kalan bayt ham (dosya başı payload emsali).
    if (attPdu.length > OPCODE_LENGTH) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: l2capHeaderLength + OPCODE_LENGTH,
        length: attPdu.length - OPCODE_LENGTH,
        rawBytes: attPdu.slice(OPCODE_LENGTH),
        unit: 'B',
        valid: true,
        warnings: [WARN_PDU_SCHEMA_NOT_DECODED],
      });
      warnings.push(toProtocolWarning(WARN_PDU_SCHEMA_NOT_DECODED));
    }
  } else {
    decodeAttPduBody(opcodeInfo.kind, attPdu, l2capHeaderLength, fields, warnings, errors);
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseBleGatt(data: Uint8Array): ParseResult {
  return parseBleGattFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): BleGattParseOptions {
  const options: BleGattParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const bleGattParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: (opsiyonel L2CAP önekinden soyulmuş) ilk bayt dar opcode kümesinde mi. */
  canParse(data: Uint8Array): boolean {
    const l2capHeaderLength = detectL2capHeaderLength(data);
    const attPdu = data.slice(l2capHeaderLength);
    if (attPdu.length < OPCODE_LENGTH) return false;
    return ATT_OPCODES.has(byteAt(attPdu, 0));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseBleGattFrame(data, readContextOptions(context));
  },
};

function opcodeFrame(opcode: number, body: readonly number[]): number[] {
  return [opcode, ...body];
}

function le16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

/**
 * Örnek çerçeveler. Handle/UUID değerleri gerçek bir cihazı işaret etmez
 * (bleAdvertisement.ts'in EXAMPLE_ADV_A belgeleme-öneki emsali).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'handle-value-notification',
    name: 'protocol.bleGatt.example.handleValueNotification.name',
    // Battery Level (0x2A19) characteristic'i handle 0x0025 — Notification, değer %90.
    bytes: Uint8Array.from(opcodeFrame(0x1b, [...le16(0x0025), 0x5a])),
    description: 'protocol.bleGatt.example.handleValueNotification.description',
    expectedValid: true,
  },
  {
    id: 'write-request-cccd-enable',
    name: 'protocol.bleGatt.example.writeRequestCccdEnable.name',
    // CCCD (0x2902) handle 0x002B — Notification bitini set eden Write Request.
    bytes: Uint8Array.from(opcodeFrame(0x12, [...le16(0x002b), ...le16(0x0001)])),
    description: 'protocol.bleGatt.example.writeRequestCccdEnable.description',
    expectedValid: true,
  },
  {
    id: 'error-response-invalid-handle',
    name: 'protocol.bleGatt.example.errorResponseInvalidHandle.name',
    // Read Request (0x0A) handle 0x0099'a yanıt: Invalid Handle.
    bytes: Uint8Array.from(opcodeFrame(0x01, [0x0a, ...le16(0x0099), 0x01])),
    description: 'protocol.bleGatt.example.errorResponseInvalidHandle.description',
    expectedValid: true,
  },
  {
    id: 'read-by-group-type-response-primary-services',
    name: 'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.name',
    // "Discover All Primary Services" yanıtı: tek grup, Handle 0x0001..0x0007, Generic Access (0x1800).
    bytes: Uint8Array.from(
      opcodeFrame(0x11, [0x06, ...le16(0x0001), ...le16(0x0007), ...le16(0x1800)]),
    ),
    description: 'protocol.bleGatt.example.readByGroupTypeResponsePrimaryServices.description',
    expectedValid: true,
  },
  {
    id: 'unknown-opcode',
    name: 'protocol.bleGatt.example.unknownOpcode.name',
    // Find By Type Value Request (0x06) — dar kümenin dışında, gövdesi bu dalgada çözülmez.
    bytes: Uint8Array.from(opcodeFrame(0x06, [...le16(0x0001), ...le16(0xffff)])),
    description: 'protocol.bleGatt.example.unknownOpcode.description',
    expectedValid: true,
  },
  {
    id: 'truncated-error-response',
    name: 'protocol.bleGatt.example.truncatedErrorResponse.name',
    // Error Response 5 bayt gerektirir, yalnız 3 bayt var — Error Code eksik.
    bytes: Uint8Array.from(opcodeFrame(0x01, [0x0a, ...le16(0x0099)])),
    description: 'protocol.bleGatt.example.truncatedErrorResponse.description',
    expectedValid: false,
  },
];

export const bleGattPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: bleGattParser,
  documentation: {
    summary: 'protocol.bleGatt.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
