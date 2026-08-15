/**
 * ISO 13400-2 DoIP (Diagnostics over IP) — generic header + payload tipi zarfının çözümü.
 *
 * GİRDİ HAM DoIP MESAJ BAYTIDIR (TCP/UDP payload'ı): generic header (8 bayt) +
 * payload tipine özgü gövde. UDS/ISO-TP zinciri parser seviyesinde KURULMAZ
 * (karar turu, brief-faz10-dalga1.md) — Diagnostic Message payload'ının içindeki
 * UDS kısmı HAM bırakılır, "UDS sayfasında çözülür" uyarısıyla. Bağlantı/oturum
 * durumu (TCP Connected/Routing Active/Diagnostic Active/Idle/Disconnected)
 * parser'da TUTULMAZ — bu BAĞLANTI durumudur, analyzer katmanının işi
 * (J1939 TP oturumu emsali, brief-faz10-dalga2.md).
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * Bu deponun `docs/spec/` dosyası DoIP için bayt düzeyinde SIFIR veri içeriyor
 * (brief-faz10-dalga2.md: "0x geçen tek satır bile yok"). Aşağıdaki payload tipi
 * tablosu, alan düzenleri ve enum kodları DIŞ KAYNAKTIR: ISO 13400-2, üç bağımsız
 * açık kaynakla çapraz kontrol edildi (Wireshark packet-doip.c, python-doipclient,
 * scapy contrib/automotive/doip.py — brief-faz10-dalga2a.md doğrulama turu).
 * Central Security activation type'ında kaynaklar 0xE0/0xE1 diye ayrıştı; 0xE0 iki
 * kaynakla çoğunlukta, o kullanıldı. Routing Activation'ın v1 (ISO 13400-2:2010,
 * 2 baytlık Activation Type) varyantı BİLEREK uygulanmadı — yalnız güncel (v2/2019)
 * 1 baytlık düzen var. VIN/GID Sync Status alanı v2019'da eklendi, isteğe bağlı.
 *
 * ── PAYLOAD TİPİ SINIFLANDIRMASI (karar turu, brief-faz10-dalga2a.md) ─────────
 * "Hangi tipler alan alan çözülür" sahte bir kapsam sorusuydu — DoIP'in payload
 * tipi listesi küçük (16 kayıt) ve neredeyse tamamı 0-17 baytlık sabit düzen.
 * Gerçek ayrım tip sayısı değil SINIF: yapısal alan düzeni (ISO 13400-2'nin sabit
 * offset'leri, küçük enum kodları) HER ZAMAN çözülür; DoIP'te lisanslı kod→anlam
 * lookup'ı (J1939 SPN/UDS NRC emsali) YOK, hiç gündeme gelmiyor. VIN/EID/GID gibi
 * alanlar da bu yüzden çözülür — bayt aralığını alan adına ayırmak lookup değil,
 * yapısal bölme (CiA 301 COB-ID emsali). Tek istisna: Diagnostic Message
 * içindeki UDS payload'ı — o HAM kalır (dalga 1 kararı, yukarı bak).
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────────
 * • TLS/güvenlik durumu: bağlantı katmanı, parser'a girmez.
 * • NACK/response-code TABLOLARININ ötesinde bağlantı state machine'i: 5 durumlu
 *   model (ana dok. 12763-12775) BAĞLANTI durumudur, tek mesajlık parser'a girmez.
 */

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

const PROTOCOL_ID = 'doip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DoIP';

const GENERIC_HEADER_LENGTH = 8;
const PROTOCOL_VERSION_OFFSET = 0;
const INVERSE_VERSION_OFFSET = 1;
const PAYLOAD_TYPE_OFFSET = 2;
const PAYLOAD_TYPE_LENGTH = 2;
const PAYLOAD_LENGTH_OFFSET = 4;
const PAYLOAD_LENGTH_FIELD_LENGTH = 4;
const VERSION_XOR_MASK = 0xff;

const ADDRESS_LENGTH = 2;
const EID_LENGTH = 6;
const GID_LENGTH = 6;
const VIN_LENGTH = 17;
const RESERVED_ISO_LENGTH = 4;
const RESERVED_OEM_LENGTH = 4;

const HEX_RADIX = 16;
const HEX_DIGITS_BYTE = 2;
const HEX_DIGITS_UINT16 = 4;

const ERROR_HEADER_TRUNCATED = 'protocol.doip.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.doip.error.frameTooLong';
const ERROR_ABORTED = 'protocol.doip.error.aborted';
const ERROR_INVERSE_VERSION_MISMATCH = 'protocol.doip.error.inverseVersionMismatch';
const ERROR_PAYLOAD_TRUNCATED = 'protocol.doip.error.payloadTruncated';

const WARN_UNKNOWN_PAYLOAD_TYPE = 'protocol.doip.warning.unknownPayloadType';
const WARN_PAYLOAD_LENGTH_MISMATCH = 'protocol.doip.warning.payloadLengthMismatch';
const WARN_UDS_PAYLOAD_NEEDS_UDS_PAGE = 'protocol.doip.warning.udsPayloadNeedsUdsPage';
const WARN_TRAILING_BYTES = 'protocol.doip.warning.trailingBytes';
const WARN_UNKNOWN_NACK_CODE = 'protocol.doip.warning.unknownNackCode';
const WARN_UNKNOWN_ACTIVATION_TYPE = 'protocol.doip.warning.unknownActivationType';
const WARN_UNKNOWN_ROUTING_ACTIVATION_RESPONSE_CODE =
  'protocol.doip.warning.unknownRoutingActivationResponseCode';
const WARN_UNKNOWN_FURTHER_ACTION = 'protocol.doip.warning.unknownFurtherAction';
const WARN_UNKNOWN_SYNC_STATUS = 'protocol.doip.warning.unknownSyncStatus';
const WARN_UNKNOWN_NODE_TYPE = 'protocol.doip.warning.unknownNodeType';
const WARN_UNKNOWN_POWER_MODE = 'protocol.doip.warning.unknownPowerMode';
const WARN_UNKNOWN_DIAGNOSTIC_ACK_CODE = 'protocol.doip.warning.unknownDiagnosticAckCode';
const WARN_UNKNOWN_DIAGNOSTIC_NACK_CODE = 'protocol.doip.warning.unknownDiagnosticNackCode';

const SUMMARY_GENERIC_NACK = 'protocol.doip.summary.genericNack';
const SUMMARY_VEHICLE_IDENTIFICATION_REQUEST = 'protocol.doip.summary.vehicleIdentificationRequest';
const SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_EID =
  'protocol.doip.summary.vehicleIdentificationRequestEid';
const SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_VIN =
  'protocol.doip.summary.vehicleIdentificationRequestVin';
const SUMMARY_VEHICLE_ANNOUNCEMENT = 'protocol.doip.summary.vehicleAnnouncement';
const SUMMARY_ROUTING_ACTIVATION_REQUEST = 'protocol.doip.summary.routingActivationRequest';
const SUMMARY_ROUTING_ACTIVATION_RESPONSE = 'protocol.doip.summary.routingActivationResponse';
const SUMMARY_ALIVE_CHECK_REQUEST = 'protocol.doip.summary.aliveCheckRequest';
const SUMMARY_ALIVE_CHECK_RESPONSE = 'protocol.doip.summary.aliveCheckResponse';
const SUMMARY_ENTITY_STATUS_REQUEST = 'protocol.doip.summary.entityStatusRequest';
const SUMMARY_ENTITY_STATUS_RESPONSE = 'protocol.doip.summary.entityStatusResponse';
const SUMMARY_POWER_MODE_REQUEST = 'protocol.doip.summary.powerModeRequest';
const SUMMARY_POWER_MODE_RESPONSE = 'protocol.doip.summary.powerModeResponse';
const SUMMARY_DIAGNOSTIC_MESSAGE = 'protocol.doip.summary.diagnosticMessage';
const SUMMARY_DIAGNOSTIC_MESSAGE_ACK = 'protocol.doip.summary.diagnosticMessageAck';
const SUMMARY_DIAGNOSTIC_MESSAGE_NACK = 'protocol.doip.summary.diagnosticMessageNack';
const SUMMARY_UNKNOWN_PAYLOAD_TYPE = 'protocol.doip.summary.unknownPayloadType';

/** Generic header'ın payload type alanı — spec kaynağı dosya başında. */
export const DOIP_PAYLOAD_TYPE = {
  GENERIC_NACK: 0x0000,
  VEHICLE_IDENTIFICATION_REQUEST: 0x0001,
  VEHICLE_IDENTIFICATION_REQUEST_EID: 0x0002,
  VEHICLE_IDENTIFICATION_REQUEST_VIN: 0x0003,
  VEHICLE_ANNOUNCEMENT: 0x0004,
  ROUTING_ACTIVATION_REQUEST: 0x0005,
  ROUTING_ACTIVATION_RESPONSE: 0x0006,
  ALIVE_CHECK_REQUEST: 0x0007,
  ALIVE_CHECK_RESPONSE: 0x0008,
  ENTITY_STATUS_REQUEST: 0x4001,
  ENTITY_STATUS_RESPONSE: 0x4002,
  POWER_MODE_REQUEST: 0x4003,
  POWER_MODE_RESPONSE: 0x4004,
  DIAGNOSTIC_MESSAGE: 0x8001,
  DIAGNOSTIC_MESSAGE_ACK: 0x8002,
  DIAGNOSTIC_MESSAGE_NACK: 0x8003,
} as const;

/** Küçük yapısal enum tabloları — protokol terimi, veridir, çevrilmez (CLAUDE.md). */
const GENERIC_NACK_CODES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Incorrect Pattern Format'],
  [0x01, 'Unknown Payload Type'],
  [0x02, 'Message Too Large'],
  [0x03, 'Out Of Memory'],
  [0x04, 'Invalid Payload Length'],
]);

const ACTIVATION_TYPES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Default'],
  [0x01, 'WWH-OBD'],
  [0xe0, 'Central Security'],
]);

const ROUTING_ACTIVATION_RESPONSE_CODES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Denied — Unknown Source Address'],
  [0x01, 'Denied — All Concurrent Sockets Registered'],
  [0x02, 'Denied — Source Address Mismatch'],
  [0x03, 'Denied — Source Address Already Active'],
  [0x04, 'Denied — Missing Authentication'],
  [0x05, 'Denied — Rejected Confirmation'],
  [0x06, 'Denied — Unsupported Activation Type'],
  [0x07, 'Denied — Requires TLS'],
  [0x10, 'Activated'],
  [0x11, 'Activated — Confirmation Required'],
]);

const FURTHER_ACTION_VALUES: ReadonlyMap<number, string> = new Map([
  [0x00, 'No Further Action Required'],
  [0x10, 'Routing Activation Required'],
]);

const SYNC_STATUS_VALUES: ReadonlyMap<number, string> = new Map([
  [0x00, 'VIN/GID Synchronized'],
  [0x10, 'VIN/GID Not Synchronized'],
]);

const NODE_TYPES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Gateway'],
  [0x01, 'Node'],
]);

const POWER_MODES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Not Ready'],
  [0x01, 'Ready'],
  [0x02, 'Not Supported'],
]);

const DIAGNOSTIC_ACK_CODES: ReadonlyMap<number, string> = new Map([[0x00, 'ACK']]);

const DIAGNOSTIC_NACK_CODES: ReadonlyMap<number, string> = new Map([
  [0x02, 'Invalid Source Address'],
  [0x03, 'Unknown Target Address'],
  [0x04, 'Diagnostic Message Too Large'],
  [0x05, 'Out Of Memory'],
  [0x06, 'Target Unreachable'],
  [0x07, 'Unknown Network'],
  [0x08, 'Transport Protocol Error'],
]);

export type DoipFrameMetadata = {
  payloadType: number;
  payloadTypeName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface ShapeResult {
  summaryKey: string;
  summaryParams: Record<string, string>;
}

type PayloadDecoder = (
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
) => ShapeResult;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_BYTE, '0')}`;
}

function formatHexUint16(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_UINT16, '0')}`;
}

function formatByteString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_BYTE, '0'),
  ).join(':');
}

function decodeAsciiString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** 4 baytlık büyük-uçlu okuma: en üst bayt çarpımla taşınır, JS'in işaretli 32-bit
 * sol kaydırma tuzağına düşülmez (`>>> 0` ile son adımda işaretsize sabitlenir). */
function readUint32BE(data: Uint8Array, offset: number): number {
  const value =
    byteAt(data, offset) * 0x1000000 +
    (byteAt(data, offset + 1) << 16) +
    (byteAt(data, offset + 2) << 8) +
    byteAt(data, offset + 3);
  return value >>> 0;
}

function payloadOffset(localOffset: number): number {
  return GENERIC_HEADER_LENGTH + localOffset;
}

function requireBytes(
  payload: Uint8Array,
  cursor: number,
  needed: number,
  errors: ProtocolError[],
): boolean {
  if (payload.length - cursor < needed) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_PAYLOAD_TRUNCATED,
      offset: payloadOffset(cursor),
      length: 0,
    });
    return false;
  }
  return true;
}

function enumField(
  id: string,
  name: string,
  offset: number,
  rawByte: number,
  rawBytes: Uint8Array,
  table: ReadonlyMap<number, string>,
  warnKey: string,
  warnings: ProtocolWarning[],
): ParsedField {
  const label = table.get(rawByte);
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 1,
    rawBytes,
    rawValue: rawByte,
    valid: label !== undefined,
    warnings: [],
  };
  if (label !== undefined) {
    field.physicalValue = label;
  } else {
    field.warnings.push(warnKey);
    warnings.push(toProtocolWarning(warnKey));
  }
  return field;
}

function pushTrailingField(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  fields.push({
    id: 'trailing-data',
    name: 'Trailing Data',
    offset: payloadOffset(0),
    length: payload.length,
    rawBytes: payload,
    valid: false,
    warnings: [WARN_TRAILING_BYTES],
  });
  warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
}

function decodeEmptyPayload(summaryKey: string): PayloadDecoder {
  return (payload, fields, warnings) => {
    if (payload.length > 0) {
      pushTrailingField(payload, fields, warnings);
    }
    return { summaryKey, summaryParams: {} };
  };
}

function decodeGenericNack(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (!requireBytes(payload, 0, 1, errors)) {
    return { summaryKey: SUMMARY_GENERIC_NACK, summaryParams: {} };
  }
  const code = byteAt(payload, 0);
  fields.push(
    enumField(
      'nack-code',
      'NACK Code',
      payloadOffset(0),
      code,
      payload.slice(0, 1),
      GENERIC_NACK_CODES,
      WARN_UNKNOWN_NACK_CODE,
      warnings,
    ),
  );
  return { summaryKey: SUMMARY_GENERIC_NACK, summaryParams: { nackCode: formatHexByte(code) } };
}

function decodeVehicleIdentificationRequestEid(
  payload: Uint8Array,
  fields: ParsedField[],
  _warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (!requireBytes(payload, 0, EID_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_EID, summaryParams: {} };
  }
  const eidBytes = payload.slice(0, EID_LENGTH);
  fields.push({
    id: 'eid',
    name: 'EID',
    offset: payloadOffset(0),
    length: EID_LENGTH,
    rawBytes: eidBytes,
    rawValue: formatByteString(eidBytes),
    valid: true,
    warnings: [],
  });
  return {
    summaryKey: SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_EID,
    summaryParams: { eid: formatByteString(eidBytes) },
  };
}

function decodeVehicleIdentificationRequestVin(
  payload: Uint8Array,
  fields: ParsedField[],
  _warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (!requireBytes(payload, 0, VIN_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_VIN, summaryParams: {} };
  }
  const vin = decodeAsciiString(payload.slice(0, VIN_LENGTH));
  fields.push({
    id: 'vin',
    name: 'VIN',
    offset: payloadOffset(0),
    length: VIN_LENGTH,
    rawBytes: payload.slice(0, VIN_LENGTH),
    rawValue: vin,
    valid: true,
    warnings: [],
  });
  return { summaryKey: SUMMARY_VEHICLE_IDENTIFICATION_REQUEST_VIN, summaryParams: { vin } };
}

function decodeVehicleAnnouncement(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(payload, 0, VIN_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
  }
  const vin = decodeAsciiString(payload.slice(0, VIN_LENGTH));
  fields.push({
    id: 'vin',
    name: 'VIN',
    offset: payloadOffset(0),
    length: VIN_LENGTH,
    rawBytes: payload.slice(0, VIN_LENGTH),
    rawValue: vin,
    valid: true,
    warnings: [],
  });
  summaryParams.vin = vin;
  let cursor = VIN_LENGTH;

  if (!requireBytes(payload, cursor, ADDRESS_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
  }
  const logicalAddress = readUint16BE(payload, cursor);
  fields.push({
    id: 'logical-address',
    name: 'Logical Address',
    offset: payloadOffset(cursor),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(cursor, cursor + ADDRESS_LENGTH),
    rawValue: logicalAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.logicalAddress = formatHexUint16(logicalAddress);
  cursor += ADDRESS_LENGTH;

  if (!requireBytes(payload, cursor, EID_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
  }
  const eidBytes = payload.slice(cursor, cursor + EID_LENGTH);
  fields.push({
    id: 'eid',
    name: 'EID',
    offset: payloadOffset(cursor),
    length: EID_LENGTH,
    rawBytes: eidBytes,
    rawValue: formatByteString(eidBytes),
    valid: true,
    warnings: [],
  });
  cursor += EID_LENGTH;

  if (!requireBytes(payload, cursor, GID_LENGTH, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
  }
  const gidBytes = payload.slice(cursor, cursor + GID_LENGTH);
  fields.push({
    id: 'gid',
    name: 'GID',
    offset: payloadOffset(cursor),
    length: GID_LENGTH,
    rawBytes: gidBytes,
    rawValue: formatByteString(gidBytes),
    valid: true,
    warnings: [],
  });
  cursor += GID_LENGTH;

  if (!requireBytes(payload, cursor, 1, errors)) {
    return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
  }
  const furtherAction = byteAt(payload, cursor);
  fields.push(
    enumField(
      'further-action',
      'Further Action Required',
      payloadOffset(cursor),
      furtherAction,
      payload.slice(cursor, cursor + 1),
      FURTHER_ACTION_VALUES,
      WARN_UNKNOWN_FURTHER_ACTION,
      warnings,
    ),
  );
  cursor += 1;

  // VIN/GID Sync Status ISO 13400-2:2019'da eklendi, isteğe bağlı — yoksa hata değil.
  if (payload.length - cursor >= 1) {
    const syncStatus = byteAt(payload, cursor);
    fields.push(
      enumField(
        'sync-status',
        'VIN/GID Sync Status',
        payloadOffset(cursor),
        syncStatus,
        payload.slice(cursor, cursor + 1),
        SYNC_STATUS_VALUES,
        WARN_UNKNOWN_SYNC_STATUS,
        warnings,
      ),
    );
  }

  return { summaryKey: SUMMARY_VEHICLE_ANNOUNCEMENT, summaryParams };
}

function decodeRoutingActivationRequest(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(payload, 0, ADDRESS_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_REQUEST, summaryParams };
  }
  const sourceAddress = readUint16BE(payload, 0);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: sourceAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.sourceAddress = formatHexUint16(sourceAddress);

  if (!requireBytes(payload, ADDRESS_LENGTH, 1, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_REQUEST, summaryParams };
  }
  const activationType = byteAt(payload, ADDRESS_LENGTH);
  fields.push(
    enumField(
      'activation-type',
      'Activation Type',
      payloadOffset(ADDRESS_LENGTH),
      activationType,
      payload.slice(ADDRESS_LENGTH, ADDRESS_LENGTH + 1),
      ACTIVATION_TYPES,
      WARN_UNKNOWN_ACTIVATION_TYPE,
      warnings,
    ),
  );

  const reservedIsoOffset = ADDRESS_LENGTH + 1;
  if (!requireBytes(payload, reservedIsoOffset, RESERVED_ISO_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_REQUEST, summaryParams };
  }
  fields.push({
    id: 'reserved-iso',
    name: 'Reserved by ISO',
    offset: payloadOffset(reservedIsoOffset),
    length: RESERVED_ISO_LENGTH,
    rawBytes: payload.slice(reservedIsoOffset, reservedIsoOffset + RESERVED_ISO_LENGTH),
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const reservedOemOffset = reservedIsoOffset + RESERVED_ISO_LENGTH;
  if (payload.length - reservedOemOffset >= RESERVED_OEM_LENGTH) {
    fields.push({
      id: 'reserved-oem',
      name: 'Reserved by OEM',
      offset: payloadOffset(reservedOemOffset),
      length: RESERVED_OEM_LENGTH,
      rawBytes: payload.slice(reservedOemOffset, reservedOemOffset + RESERVED_OEM_LENGTH),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_ROUTING_ACTIVATION_REQUEST, summaryParams };
}

function decodeRoutingActivationResponse(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(payload, 0, ADDRESS_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_RESPONSE, summaryParams };
  }
  const testerLogicalAddress = readUint16BE(payload, 0);
  fields.push({
    id: 'tester-logical-address',
    name: 'Tester Logical Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: testerLogicalAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.testerLogicalAddress = formatHexUint16(testerLogicalAddress);

  if (!requireBytes(payload, ADDRESS_LENGTH, ADDRESS_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_RESPONSE, summaryParams };
  }
  const entityLogicalAddress = readUint16BE(payload, ADDRESS_LENGTH);
  fields.push({
    id: 'entity-logical-address',
    name: 'Entity Logical Address',
    offset: payloadOffset(ADDRESS_LENGTH),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(ADDRESS_LENGTH, ADDRESS_LENGTH * 2),
    rawValue: entityLogicalAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.entityLogicalAddress = formatHexUint16(entityLogicalAddress);

  const responseCodeOffset = ADDRESS_LENGTH * 2;
  if (!requireBytes(payload, responseCodeOffset, 1, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_RESPONSE, summaryParams };
  }
  const responseCode = byteAt(payload, responseCodeOffset);
  fields.push(
    enumField(
      'response-code',
      'Response Code',
      payloadOffset(responseCodeOffset),
      responseCode,
      payload.slice(responseCodeOffset, responseCodeOffset + 1),
      ROUTING_ACTIVATION_RESPONSE_CODES,
      WARN_UNKNOWN_ROUTING_ACTIVATION_RESPONSE_CODE,
      warnings,
    ),
  );

  const reservedIsoOffset = responseCodeOffset + 1;
  if (!requireBytes(payload, reservedIsoOffset, RESERVED_ISO_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ROUTING_ACTIVATION_RESPONSE, summaryParams };
  }
  fields.push({
    id: 'reserved-iso',
    name: 'Reserved by ISO',
    offset: payloadOffset(reservedIsoOffset),
    length: RESERVED_ISO_LENGTH,
    rawBytes: payload.slice(reservedIsoOffset, reservedIsoOffset + RESERVED_ISO_LENGTH),
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const reservedOemOffset = reservedIsoOffset + RESERVED_ISO_LENGTH;
  if (payload.length - reservedOemOffset >= RESERVED_OEM_LENGTH) {
    fields.push({
      id: 'reserved-oem',
      name: 'Reserved by OEM',
      offset: payloadOffset(reservedOemOffset),
      length: RESERVED_OEM_LENGTH,
      rawBytes: payload.slice(reservedOemOffset, reservedOemOffset + RESERVED_OEM_LENGTH),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_ROUTING_ACTIVATION_RESPONSE, summaryParams };
}

function decodeAliveCheckResponse(
  payload: Uint8Array,
  fields: ParsedField[],
  _warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};
  if (!requireBytes(payload, 0, ADDRESS_LENGTH, errors)) {
    return { summaryKey: SUMMARY_ALIVE_CHECK_RESPONSE, summaryParams };
  }
  const sourceAddress = readUint16BE(payload, 0);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: sourceAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.sourceAddress = formatHexUint16(sourceAddress);
  return { summaryKey: SUMMARY_ALIVE_CHECK_RESPONSE, summaryParams };
}

function decodeEntityStatusResponse(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};

  if (!requireBytes(payload, 0, 1, errors)) {
    return { summaryKey: SUMMARY_ENTITY_STATUS_RESPONSE, summaryParams };
  }
  const nodeType = byteAt(payload, 0);
  fields.push(
    enumField(
      'node-type',
      'Node Type',
      payloadOffset(0),
      nodeType,
      payload.slice(0, 1),
      NODE_TYPES,
      WARN_UNKNOWN_NODE_TYPE,
      warnings,
    ),
  );

  if (!requireBytes(payload, 1, 1, errors)) {
    return { summaryKey: SUMMARY_ENTITY_STATUS_RESPONSE, summaryParams };
  }
  const maxSockets = byteAt(payload, 1);
  fields.push({
    id: 'max-concurrent-sockets',
    name: 'Max Concurrent Sockets',
    offset: payloadOffset(1),
    length: 1,
    rawBytes: payload.slice(1, 2),
    rawValue: maxSockets,
    valid: true,
    warnings: [],
  });

  if (!requireBytes(payload, 2, 1, errors)) {
    return { summaryKey: SUMMARY_ENTITY_STATUS_RESPONSE, summaryParams };
  }
  const openSockets = byteAt(payload, 2);
  fields.push({
    id: 'currently-open-sockets',
    name: 'Currently Open Sockets',
    offset: payloadOffset(2),
    length: 1,
    rawBytes: payload.slice(2, 3),
    rawValue: openSockets,
    valid: true,
    warnings: [],
  });

  if (payload.length - 3 >= 4) {
    const maxDataSize = readUint32BE(payload, 3);
    fields.push({
      id: 'max-data-size',
      name: 'Max Data Size',
      offset: payloadOffset(3),
      length: 4,
      rawBytes: payload.slice(3, 7),
      rawValue: maxDataSize,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_ENTITY_STATUS_RESPONSE, summaryParams };
}

function decodePowerModeResponse(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  if (!requireBytes(payload, 0, 1, errors)) {
    return { summaryKey: SUMMARY_POWER_MODE_RESPONSE, summaryParams: {} };
  }
  const powerMode = byteAt(payload, 0);
  fields.push(
    enumField(
      'power-mode',
      'Power Mode',
      payloadOffset(0),
      powerMode,
      payload.slice(0, 1),
      POWER_MODES,
      WARN_UNKNOWN_POWER_MODE,
      warnings,
    ),
  );
  return { summaryKey: SUMMARY_POWER_MODE_RESPONSE, summaryParams: {} };
}

function decodeDiagnosticMessage(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};
  if (!requireBytes(payload, 0, ADDRESS_LENGTH * 2, errors)) {
    return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE, summaryParams };
  }
  const sourceAddress = readUint16BE(payload, 0);
  const targetAddress = readUint16BE(payload, ADDRESS_LENGTH);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: sourceAddress,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'target-address',
    name: 'Target Address',
    offset: payloadOffset(ADDRESS_LENGTH),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(ADDRESS_LENGTH, ADDRESS_LENGTH * 2),
    rawValue: targetAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.sourceAddress = formatHexUint16(sourceAddress);
  summaryParams.targetAddress = formatHexUint16(targetAddress);

  // UDS zinciri parser seviyesinde kurulmaz (dalga 1 kararı, dosya başı) — bu
  // yüzden gövde HAM kalır, UDS sayfasına yönlendiren bir uyarıyla.
  const udsPayload = payload.slice(ADDRESS_LENGTH * 2);
  if (udsPayload.length > 0) {
    fields.push({
      id: 'uds-payload',
      name: 'UDS Payload',
      offset: payloadOffset(ADDRESS_LENGTH * 2),
      length: udsPayload.length,
      rawBytes: udsPayload,
      unit: 'B',
      valid: true,
      warnings: [WARN_UDS_PAYLOAD_NEEDS_UDS_PAGE],
    });
    warnings.push(toProtocolWarning(WARN_UDS_PAYLOAD_NEEDS_UDS_PAGE));
  }

  return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE, summaryParams };
}

function decodeDiagnosticMessageAck(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};
  if (!requireBytes(payload, 0, ADDRESS_LENGTH * 2 + 1, errors)) {
    return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE_ACK, summaryParams };
  }
  const sourceAddress = readUint16BE(payload, 0);
  const targetAddress = readUint16BE(payload, ADDRESS_LENGTH);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: sourceAddress,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'target-address',
    name: 'Target Address',
    offset: payloadOffset(ADDRESS_LENGTH),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(ADDRESS_LENGTH, ADDRESS_LENGTH * 2),
    rawValue: targetAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.sourceAddress = formatHexUint16(sourceAddress);
  summaryParams.targetAddress = formatHexUint16(targetAddress);

  const ackCodeOffset = ADDRESS_LENGTH * 2;
  const ackCode = byteAt(payload, ackCodeOffset);
  fields.push(
    enumField(
      'ack-code',
      'ACK Code',
      payloadOffset(ackCodeOffset),
      ackCode,
      payload.slice(ackCodeOffset, ackCodeOffset + 1),
      DIAGNOSTIC_ACK_CODES,
      WARN_UNKNOWN_DIAGNOSTIC_ACK_CODE,
      warnings,
    ),
  );

  const echo = payload.slice(ackCodeOffset + 1);
  if (echo.length > 0) {
    fields.push({
      id: 'echo',
      name: 'Previous Diagnostic Message (Echo)',
      offset: payloadOffset(ackCodeOffset + 1),
      length: echo.length,
      rawBytes: echo,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE_ACK, summaryParams };
}

function decodeDiagnosticMessageNack(
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const summaryParams: Record<string, string> = {};
  if (!requireBytes(payload, 0, ADDRESS_LENGTH * 2 + 1, errors)) {
    return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE_NACK, summaryParams };
  }
  const sourceAddress = readUint16BE(payload, 0);
  const targetAddress = readUint16BE(payload, ADDRESS_LENGTH);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: payloadOffset(0),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(0, ADDRESS_LENGTH),
    rawValue: sourceAddress,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'target-address',
    name: 'Target Address',
    offset: payloadOffset(ADDRESS_LENGTH),
    length: ADDRESS_LENGTH,
    rawBytes: payload.slice(ADDRESS_LENGTH, ADDRESS_LENGTH * 2),
    rawValue: targetAddress,
    valid: true,
    warnings: [],
  });
  summaryParams.sourceAddress = formatHexUint16(sourceAddress);
  summaryParams.targetAddress = formatHexUint16(targetAddress);

  const nackCodeOffset = ADDRESS_LENGTH * 2;
  const nackCode = byteAt(payload, nackCodeOffset);
  fields.push(
    enumField(
      'diagnostic-nack-code',
      'NACK Code',
      payloadOffset(nackCodeOffset),
      nackCode,
      payload.slice(nackCodeOffset, nackCodeOffset + 1),
      DIAGNOSTIC_NACK_CODES,
      WARN_UNKNOWN_DIAGNOSTIC_NACK_CODE,
      warnings,
    ),
  );

  const echo = payload.slice(nackCodeOffset + 1);
  if (echo.length > 0) {
    fields.push({
      id: 'echo',
      name: 'Previous Diagnostic Message (Echo)',
      offset: payloadOffset(nackCodeOffset + 1),
      length: echo.length,
      rawBytes: echo,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return { summaryKey: SUMMARY_DIAGNOSTIC_MESSAGE_NACK, summaryParams };
}

interface DoipPayloadTypeDefinition {
  readonly code: number;
  /** Protokol terimi — veridir, çevrilmez (CLAUDE.md). */
  readonly name: string;
  readonly decode: PayloadDecoder;
}

/**
 * TEK bildirimsel tablo (karar turu, brief-faz10-dalga2a.md): "hangi tipler
 * çözülür" sorusunun cevabı budur — HEPSİ. Yeni bir payload tipi eklemek bu
 * diziye bir satır + bir `decode` fonksiyonu eklemektir, seçim cetveli yoktur.
 */
export const DOIP_PAYLOAD_TYPES: readonly DoipPayloadTypeDefinition[] = [
  { code: DOIP_PAYLOAD_TYPE.GENERIC_NACK, name: 'Generic NACK', decode: decodeGenericNack },
  {
    code: DOIP_PAYLOAD_TYPE.VEHICLE_IDENTIFICATION_REQUEST,
    name: 'Vehicle Identification Request',
    decode: decodeEmptyPayload(SUMMARY_VEHICLE_IDENTIFICATION_REQUEST),
  },
  {
    code: DOIP_PAYLOAD_TYPE.VEHICLE_IDENTIFICATION_REQUEST_EID,
    name: 'Vehicle Identification Request (EID)',
    decode: decodeVehicleIdentificationRequestEid,
  },
  {
    code: DOIP_PAYLOAD_TYPE.VEHICLE_IDENTIFICATION_REQUEST_VIN,
    name: 'Vehicle Identification Request (VIN)',
    decode: decodeVehicleIdentificationRequestVin,
  },
  {
    code: DOIP_PAYLOAD_TYPE.VEHICLE_ANNOUNCEMENT,
    name: 'Vehicle Announcement / Identification Response',
    decode: decodeVehicleAnnouncement,
  },
  {
    code: DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_REQUEST,
    name: 'Routing Activation Request',
    decode: decodeRoutingActivationRequest,
  },
  {
    code: DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_RESPONSE,
    name: 'Routing Activation Response',
    decode: decodeRoutingActivationResponse,
  },
  {
    code: DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST,
    name: 'Alive Check Request',
    decode: decodeEmptyPayload(SUMMARY_ALIVE_CHECK_REQUEST),
  },
  {
    code: DOIP_PAYLOAD_TYPE.ALIVE_CHECK_RESPONSE,
    name: 'Alive Check Response',
    decode: decodeAliveCheckResponse,
  },
  {
    code: DOIP_PAYLOAD_TYPE.ENTITY_STATUS_REQUEST,
    name: 'DoIP Entity Status Request',
    decode: decodeEmptyPayload(SUMMARY_ENTITY_STATUS_REQUEST),
  },
  {
    code: DOIP_PAYLOAD_TYPE.ENTITY_STATUS_RESPONSE,
    name: 'DoIP Entity Status Response',
    decode: decodeEntityStatusResponse,
  },
  {
    code: DOIP_PAYLOAD_TYPE.POWER_MODE_REQUEST,
    name: 'Diagnostic Power Mode Information Request',
    decode: decodeEmptyPayload(SUMMARY_POWER_MODE_REQUEST),
  },
  {
    code: DOIP_PAYLOAD_TYPE.POWER_MODE_RESPONSE,
    name: 'Diagnostic Power Mode Information Response',
    decode: decodePowerModeResponse,
  },
  {
    code: DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE,
    name: 'Diagnostic Message',
    decode: decodeDiagnosticMessage,
  },
  {
    code: DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE_ACK,
    name: 'Diagnostic Message Positive Acknowledgement',
    decode: decodeDiagnosticMessageAck,
  },
  {
    code: DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE_NACK,
    name: 'Diagnostic Message Negative Acknowledgement',
    decode: decodeDiagnosticMessageNack,
  },
];

const PAYLOAD_TYPE_INDEX: ReadonlyMap<number, DoipPayloadTypeDefinition> = new Map(
  DOIP_PAYLOAD_TYPES.map((info) => [info.code, info]),
);

export function getDoipPayloadTypeInfo(code: number): DoipPayloadTypeDefinition | undefined {
  return PAYLOAD_TYPE_INDEX.get(code);
}

function decodeUnknownPayload(payload: Uint8Array, fields: ParsedField[]): ShapeResult {
  if (payload.length > 0) {
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: payloadOffset(0),
      length: payload.length,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
  return { summaryKey: SUMMARY_UNKNOWN_PAYLOAD_TYPE, summaryParams: {} };
}

function decodePayload(
  code: number,
  payload: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  const definition = PAYLOAD_TYPE_INDEX.get(code);
  if (definition === undefined) {
    return decodeUnknownPayload(payload, fields);
  }
  return definition.decode(payload, fields, warnings, errors);
}

interface DoipParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDoipFrame(data: Uint8Array, options: DoipParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < GENERIC_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const protocolVersion = byteAt(data, PROTOCOL_VERSION_OFFSET);
  fields.push({
    id: 'protocol-version',
    name: 'Protocol Version',
    offset: PROTOCOL_VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(PROTOCOL_VERSION_OFFSET, PROTOCOL_VERSION_OFFSET + 1),
    rawValue: protocolVersion,
    valid: true,
    warnings: [],
  });

  const inverseVersion = byteAt(data, INVERSE_VERSION_OFFSET);
  const expectedInverse = (protocolVersion ^ VERSION_XOR_MASK) & 0xff;
  const inverseValid = inverseVersion === expectedInverse;
  fields.push({
    id: 'inverse-version',
    name: 'Inverse Protocol Version',
    offset: INVERSE_VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(INVERSE_VERSION_OFFSET, INVERSE_VERSION_OFFSET + 1),
    rawValue: inverseVersion,
    valid: inverseValid,
    warnings: [],
  });
  if (!inverseValid) {
    // Sabit gerçeklik testi (version ^ 0xFF) başarısız — bu ya bozulmuş bir
    // başlık ya da hiç DoIP olmayan bir girdi; SID/SPN emsalinin aksine burada
    // "bilinmeyen değer" değil "kendi kendini doğrulayan alan tutarsız" var,
    // bu yüzden UYARI değil HATA (J1939'un "not extended" deseni).
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_INVERSE_VERSION_MISMATCH,
      offset: INVERSE_VERSION_OFFSET,
      length: 1,
      details: {
        protocolVersion: formatHexByte(protocolVersion),
        inverseVersion: formatHexByte(inverseVersion),
        expected: formatHexByte(expectedInverse),
      },
    });
  }

  const payloadTypeCode = readUint16BE(data, PAYLOAD_TYPE_OFFSET);
  const payloadTypeInfo = PAYLOAD_TYPE_INDEX.get(payloadTypeCode);
  const payloadTypeField: ParsedField = {
    id: 'payload-type',
    name: 'Payload Type',
    offset: PAYLOAD_TYPE_OFFSET,
    length: PAYLOAD_TYPE_LENGTH,
    rawBytes: data.slice(PAYLOAD_TYPE_OFFSET, PAYLOAD_TYPE_OFFSET + PAYLOAD_TYPE_LENGTH),
    rawValue: payloadTypeCode,
    valid: payloadTypeInfo !== undefined,
    warnings: [],
  };
  if (payloadTypeInfo !== undefined) {
    payloadTypeField.physicalValue = payloadTypeInfo.name;
  } else {
    payloadTypeField.warnings.push(WARN_UNKNOWN_PAYLOAD_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_PAYLOAD_TYPE));
  }
  fields.push(payloadTypeField);

  const declaredPayloadLength = readUint32BE(data, PAYLOAD_LENGTH_OFFSET);
  const actualPayloadLength = data.length - GENERIC_HEADER_LENGTH;
  fields.push({
    id: 'payload-length',
    name: 'Payload Length',
    offset: PAYLOAD_LENGTH_OFFSET,
    length: PAYLOAD_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(PAYLOAD_LENGTH_OFFSET, PAYLOAD_LENGTH_OFFSET + PAYLOAD_LENGTH_FIELD_LENGTH),
    rawValue: declaredPayloadLength,
    physicalValue: actualPayloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  if (declaredPayloadLength !== actualPayloadLength) {
    warnings.push(toProtocolWarning(WARN_PAYLOAD_LENGTH_MISMATCH));
  }

  const payload = data.slice(GENERIC_HEADER_LENGTH);
  const shape = decodePayload(payloadTypeCode, payload, fields, warnings, errors);

  const metadata: DoipFrameMetadata = {
    payloadType: payloadTypeCode,
    payloadTypeName: payloadTypeInfo?.name,
    summaryKey: shape.summaryKey,
    summaryParams: shape.summaryParams,
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
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

export function parseDoip(data: Uint8Array): ParseResult {
  return parseDoipFrame(data, {});
}

export const doipParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: en az 8 bayt (generic header) + inverse version tutarlılığı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < GENERIC_HEADER_LENGTH) return false;
    const version = byteAt(data, PROTOCOL_VERSION_OFFSET);
    const inverse = byteAt(data, INVERSE_VERSION_OFFSET);
    return (version ^ VERSION_XOR_MASK) === inverse;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: DoipParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseDoipFrame(data, options);
  },
};

function asciiBytes(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Örnek çerçevelerde kullanılan sabit protokol versiyonu — anlamı çözülmez, yalnız
 * inverse-version tutarlılığını göstermeye yeter (bkz. dosya başı kaynak uyarısı). */
const EXAMPLE_PROTOCOL_VERSION = 0x02;

function buildDoipHeader(payloadType: number, payloadLength: number): Uint8Array {
  return new Uint8Array([
    EXAMPLE_PROTOCOL_VERSION,
    EXAMPLE_PROTOCOL_VERSION ^ VERSION_XOR_MASK,
    (payloadType >>> 8) & 0xff,
    payloadType & 0xff,
    (payloadLength >>> 24) & 0xff,
    (payloadLength >>> 16) & 0xff,
    (payloadLength >>> 8) & 0xff,
    payloadLength & 0xff,
  ]);
}

function buildDoipMessage(payloadType: number, payload: Uint8Array): Uint8Array {
  return concatBytes(buildDoipHeader(payloadType, payload.length), payload);
}

const VEHICLE_ANNOUNCEMENT_PAYLOAD = concatBytes(
  asciiBytes('WVWZZZ1JZXW000001'),
  new Uint8Array([0x0e, 0x80]), // logical address
  new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]), // EID
  new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]), // GID
  new Uint8Array([0x00]), // further action: no further action required
);

const ROUTING_ACTIVATION_REQUEST_PAYLOAD = concatBytes(
  new Uint8Array([0x0e, 0x00]), // source address (tester)
  new Uint8Array([0x00]), // activation type: default
  new Uint8Array([0x00, 0x00, 0x00, 0x00]), // reserved by ISO
);

const ROUTING_ACTIVATION_RESPONSE_PAYLOAD = concatBytes(
  new Uint8Array([0x0e, 0x00]), // tester logical address
  new Uint8Array([0x10, 0x01]), // entity logical address
  new Uint8Array([0x10]), // response code: activated
  new Uint8Array([0x00, 0x00, 0x00, 0x00]), // reserved by ISO
);

const DIAGNOSTIC_MESSAGE_PAYLOAD = concatBytes(
  new Uint8Array([0x0e, 0x00]), // source: tester
  new Uint8Array([0x10, 0x01]), // target: ECU
  new Uint8Array([0x22, 0xf1, 0x90]), // UDS: Read Data By Identifier, DID 0xF190
);

/**
 * Örnek DoIP mesajları. Spec bu dalga için hiçbir bayt örneği vermiyor (dosya
 * başı kaynak uyarısı) — hepsi dış kaynaktaki (ISO 13400-2) alan düzenine göre
 * elle inşa edildi, `buildDoipMessage` header'ı otomatik hesaplar. Adlar/
 * açıklamalar çeviri anahtarı, baytlar veridir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'vehicle-announcement',
    name: 'protocol.doip.example.vehicleAnnouncement.name',
    bytes: buildDoipMessage(DOIP_PAYLOAD_TYPE.VEHICLE_ANNOUNCEMENT, VEHICLE_ANNOUNCEMENT_PAYLOAD),
    description: 'protocol.doip.example.vehicleAnnouncement.description',
    expectedValid: true,
  },
  {
    id: 'routing-activation-request',
    name: 'protocol.doip.example.routingActivationRequest.name',
    bytes: buildDoipMessage(
      DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_REQUEST,
      ROUTING_ACTIVATION_REQUEST_PAYLOAD,
    ),
    description: 'protocol.doip.example.routingActivationRequest.description',
    expectedValid: true,
  },
  {
    id: 'routing-activation-response',
    name: 'protocol.doip.example.routingActivationResponse.name',
    bytes: buildDoipMessage(
      DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_RESPONSE,
      ROUTING_ACTIVATION_RESPONSE_PAYLOAD,
    ),
    description: 'protocol.doip.example.routingActivationResponse.description',
    expectedValid: true,
  },
  {
    id: 'diagnostic-message',
    name: 'protocol.doip.example.diagnosticMessage.name',
    bytes: buildDoipMessage(DOIP_PAYLOAD_TYPE.DIAGNOSTIC_MESSAGE, DIAGNOSTIC_MESSAGE_PAYLOAD),
    description: 'protocol.doip.example.diagnosticMessage.description',
    expectedValid: true,
  },
  {
    id: 'generic-nack',
    name: 'protocol.doip.example.genericNack.name',
    // NACK code 0x02: Message Too Large.
    bytes: buildDoipMessage(DOIP_PAYLOAD_TYPE.GENERIC_NACK, new Uint8Array([0x02])),
    description: 'protocol.doip.example.genericNack.description',
    expectedValid: true,
  },
  {
    id: 'alive-check-request',
    name: 'protocol.doip.example.aliveCheckRequest.name',
    bytes: buildDoipMessage(DOIP_PAYLOAD_TYPE.ALIVE_CHECK_REQUEST, new Uint8Array([])),
    description: 'protocol.doip.example.aliveCheckRequest.description',
    expectedValid: true,
  },
  {
    id: 'alive-check-response',
    name: 'protocol.doip.example.aliveCheckResponse.name',
    bytes: buildDoipMessage(DOIP_PAYLOAD_TYPE.ALIVE_CHECK_RESPONSE, new Uint8Array([0x0e, 0x00])),
    description: 'protocol.doip.example.aliveCheckResponse.description',
    expectedValid: true,
  },
  {
    id: 'routing-activation-response-truncated',
    name: 'protocol.doip.example.routingActivationResponseTruncated.name',
    // Tester Logical Address var, ama Entity Logical Address'in ikinci baytı eksik.
    bytes: buildDoipMessage(
      DOIP_PAYLOAD_TYPE.ROUTING_ACTIVATION_RESPONSE,
      new Uint8Array([0x0e, 0x00, 0x10]),
    ),
    description: 'protocol.doip.example.routingActivationResponseTruncated.description',
    expectedValid: false,
  },
];

export const doipPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: doipParser,
  documentation: {
    summary: 'protocol.doip.documentation.summary',
    layer: 'transport',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
