/**
 * PN-IO Alarm (RTA — Real-Time Acyclic) PDU çözücüsü.
 *
 * Faz 10, dalga 13e. `profinet.ts` FrameID 0xFC01 (yüksek öncelik) ya da
 * 0xFE01 (düşük öncelik) görünce BU dosyayı çağırır. Desen `cipCore.ts` ile
 * aynı: çağıranın `fields` dizisine doğrudan basar, `Summary` döner.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * PI'nin IEC 61158-6-10 metni bu depoda YOK. Alan yerleşimi İKİ bağımsız,
 * kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı (KOD KOPYALANMADI):
 *   W = **Wireshark** `plugins/epan/profinet/packet-dcerpc-pn-io.c` (GPL-2.0):
 *       `dissect_PNIO_RTA()` sabit başlığı AlarmDstEndpoint(2) →
 *       AlarmSrcEndpoint(2) → PDUType(1) → AddFlags(1) → SendSeqNum(2) →
 *       AckSeqNum(2) → VarPartLen(2) sırasıyla okur; maskeler
 *       `hf_pn_io_pdu_type_type 0x0F` / `_version 0xF0` /
 *       `hf_pn_io_window_size 0x0F` / `hf_pn_io_tack 0xF0`.
 *       `dissect_AlarmNotification_block()` gövdeyi AlarmType(2) + API(4) +
 *       SlotNumber(2) + SubslotNumber(2) + ModuleIdentNumber(4) +
 *       SubmoduleIdentNumber(4) + AlarmSpecifier(2) = 20 bayt olarak verir
 *       (`body_length -= 20` bunu aritmetikle doğrular).
 *   P = **p-net** (RT-Labs AB) `src/pf_types.h`:
 *       `pf_alarm_fixed_t { uint16_t dst_ref; uint16_t src_ref;
 *       pf_alarm_pdu_type_t pdu_type; pf_alarm_add_flags_t add_flags;
 *       uint16_t send_seq_num; uint16_t ack_seq_nbr; }` ve yorumu
 *       "followed by: uint16_t var_part_len" — aynı 12 baytlık sabit başlık.
 *       `PF_RTA_PDU_TYPE_DATA=1 / NACK=2 / ACK=3 / ERR=4`;
 *       `PF_BT_ALARM_NOTIFICATION_HIGH=0x0001 / _LOW=0x0002 /
 *       PF_BT_ALARM_ACK_HIGH=0x8001 / _LOW=0x8002`;
 *       `src/common/pf_alarm.c` `PF_FRAME_ID_ALARM_HIGH 0xfc01 / _LOW 0xfe01`.
 *       `include/pnet_api.h` `pnet_pnio_status_t { error_code, error_decode,
 *       error_code_1, error_code_2 }` = PNIOStatus 4 bayt.
 *
 * ── ENDIANNESS ──────────────────────────────────────────────────────────────
 * W bu alanları DCE/RPC yardımcılarıyla okur ama `dissect_PNIO_heur()`
 * `drep_data = 0` ile çağırır — DCE/RPC'de drep[0]'ın üst yarısı 0 BIG-ENDIAN
 * demektir; `dissect_block()` ayrıca `drep[0] &= ~DREP_LITTLE_ENDIAN` ile
 * bunu blok içinde de zorlar. Yani PROFINET'in TAMAMI network order'dır;
 * EtherCAT'in aksine bir little-endian geçişi YOKTUR.
 *
 * ── ÇAKIŞAN KAYNAK → ADLANDIRILMADI ─────────────────────────────────────────
 * AlarmType tablosunda iki değer İKİ KAYNAKTA FARKLI adla geçiyor, bu yüzden
 * (cipCore.ts'in "yalnız aynı adla geçenler adlandırılır" ölçütüyle) HAM
 * bırakıldı: 0x0007 (W "Redundancy" / P `MEDIA_REDUNDANCY`) ve 0x000A
 * (W "Plug wrong submodule" / P `PLUG_WRONG_MODULE` — biri submodule diyor,
 * öteki module). 0x0014-0x001D bandını YALNIZ P adlandırıyor (MRPD problem,
 * multiple interface mismatch), W "reserved" diyor → tek kaynak, ham.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ──────────────────────────────────────
 * AlarmNotification'ın AlarmSpecifier'dan SONRAKİ isteğe bağlı bölgesi
 * (UserStructureIdentifier + MaintenanceItem/AlarmItem/ChannelDiagnosis) tek
 * başına bir blok ailesidir ve doğru çözümü AR (Application Relation)
 * bağlamına dayanır; bu motor tek çerçeve çözer. USI ADLANDIRILIR, ardındaki
 * yük HAM bırakılır ve uyarı basılır. Aynı şekilde PN-IO acyclic servisleri
 * (Connect/Release/Read/Write) DCE/RPC üzerinden UDP'de taşınır — bu motorun
 * girdisi ham Ethernet çerçevesidir, o yol bu dalganın kapsamı DEĞİLDİR.
 */

import type { ParsedField, ProtocolError } from '@/protocol-core/types';

/** RTA sabit başlığı: 2+2+1+1+2+2+2. */
export const RTA_FIXED_HEADER_LENGTH = 12;
/** Blok başlığı: BlockType(2)+BlockLength(2)+VersionHigh(1)+VersionLow(1). */
export const RTA_BLOCK_HEADER_LENGTH = 6;
/** AlarmType..AlarmSpecifier arası — W'nin `body_length -= 20`'si. */
const ALARM_NOTIFICATION_BODY_LENGTH = 20;
/** AlarmAck gövdesi: Alarm header (10) + AlarmSpecifier (2) + PNIOStatus (4). */
const ALARM_ACK_BODY_LENGTH = 16;
const PNIO_STATUS_LENGTH = 4;

const HEX_RADIX = 16;

export const ERROR_ALARM_HEADER_TRUNCATED = 'protocol.profinet.error.alarmHeaderTruncated';
export const ERROR_ALARM_BLOCK_TRUNCATED = 'protocol.profinet.error.alarmBlockTruncated';

export const WARN_ALARM_UNKNOWN_PDU_TYPE = 'protocol.profinet.warning.alarmUnknownPduType';
export const WARN_ALARM_UNKNOWN_TYPE = 'protocol.profinet.warning.alarmUnknownType';
export const WARN_ALARM_UNKNOWN_BLOCK_TYPE = 'protocol.profinet.warning.alarmUnknownBlockType';
export const WARN_ALARM_VAR_PART_MISMATCH = 'protocol.profinet.warning.alarmVarPartMismatch';
export const WARN_ALARM_PAYLOAD_NEEDS_CONTEXT = 'protocol.profinet.warning.alarmPayloadNeedsContext';
export const WARN_ALARM_RESERVED_BIT_SET = 'protocol.profinet.warning.alarmReservedBitSet';

const PDU_TYPE_DATA = 1;
const PDU_TYPE_NACK = 2;
const PDU_TYPE_ACK = 3;
const PDU_TYPE_ERR = 4;

const PDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [PDU_TYPE_DATA, 'Data-RTA-PDU'],
  [PDU_TYPE_NACK, 'NACK-RTA-PDU'],
  [PDU_TYPE_ACK, 'ACK-RTA-PDU'],
  [PDU_TYPE_ERR, 'ERR-RTA-PDU'],
]);

const BLOCK_TYPE_ALARM_NOTIFICATION_HIGH = 0x0001;
const BLOCK_TYPE_ALARM_NOTIFICATION_LOW = 0x0002;
const BLOCK_TYPE_ALARM_ACK_HIGH = 0x8001;
const BLOCK_TYPE_ALARM_ACK_LOW = 0x8002;

const BLOCK_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [BLOCK_TYPE_ALARM_NOTIFICATION_HIGH, 'Alarm Notification High'],
  [BLOCK_TYPE_ALARM_NOTIFICATION_LOW, 'Alarm Notification Low'],
  [BLOCK_TYPE_ALARM_ACK_HIGH, 'Alarm Ack High'],
  [BLOCK_TYPE_ALARM_ACK_LOW, 'Alarm Ack Low'],
]);

/**
 * YALNIZ iki kaynakta AYNI adla geçen AlarmType'lar. 0x0007 ve 0x000A kasten
 * YOK (dosya başı: çakışan adlandırma), 0x0014-0x001D de yok (tek kaynak).
 */
const ALARM_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0001, 'Diagnosis'],
  [0x0002, 'Process'],
  [0x0003, 'Pull'],
  [0x0004, 'Plug'],
  [0x0005, 'Status'],
  [0x0006, 'Update'],
  [0x0008, 'Controlled by supervisor'],
  [0x0009, 'Released'],
  [0x000b, 'Return of submodule'],
  [0x000c, 'Diagnosis disappears'],
  [0x000d, 'Multicast communication mismatch notification'],
  [0x000e, 'Port data change notification'],
  [0x000f, 'Sync data changed notification'],
  [0x0010, 'Isochronous mode problem notification'],
  [0x0011, 'Network component problem notification'],
  [0x0012, 'Time data changed notification'],
  [0x0013, 'Dynamic Frame Packing problem notification'],
  [0x001e, 'Upload and retrieval notification'],
  [0x001f, 'Pull module'],
]);

/** AlarmSpecifier bit alanları (W `hf_pn_io_alarm_specifier_*`). */
const ALARM_SPECIFIER_SEQUENCE_MASK = 0x07ff;
const ALARM_SPECIFIER_CHANNEL_MASK = 0x0800;
const ALARM_SPECIFIER_MANUFACTURER_MASK = 0x1000;
const ALARM_SPECIFIER_SUBMODULE_MASK = 0x2000;
const ALARM_SPECIFIER_RESERVED_MASK = 0x4000;
const ALARM_SPECIFIER_AR_MASK = 0x8000;

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

export interface AlarmDecodeSummary {
  readonly pduType: number;
  readonly pduTypeLabel: string;
  readonly alarmType: number | undefined;
  readonly alarmTypeLabel: string | undefined;
  readonly slotNumber: number | undefined;
  readonly subslotNumber: number | undefined;
  readonly consumedBytes: number;
}

interface PushInit {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
  readonly length: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: string;
  readonly unit?: string;
  readonly valid?: boolean;
  readonly warnings?: string[];
}

function push(data: Uint8Array, fields: ParsedField[], init: PushInit): void {
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    valid: init.valid ?? true,
    warnings: init.warnings ?? [],
  };
  if (init.rawValue !== undefined) field.rawValue = init.rawValue;
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  if (init.unit !== undefined) field.unit = init.unit;
  fields.push(field);
}

/** AlarmType(2)+API(4)+SlotNumber(2)+SubslotNumber(2) — 10 bayt ortak başlık. */
function decodeAlarmHeader(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: string[],
): { alarmType: number; slotNumber: number; subslotNumber: number } {
  const alarmType = readUint16BE(data, offset);
  const alarmName = ALARM_TYPE_NAMES.get(alarmType);
  push(data, fields, {
    id: 'alarm-type',
    name: 'AlarmType',
    offset,
    length: 2,
    rawValue: alarmType,
    ...(alarmName === undefined ? {} : { physicalValue: alarmName }),
    valid: alarmName !== undefined,
    ...(alarmName === undefined ? { warnings: [WARN_ALARM_UNKNOWN_TYPE] } : {}),
  });
  if (alarmName === undefined) warnings.push(WARN_ALARM_UNKNOWN_TYPE);

  const api = readUint32BE(data, offset + 2);
  push(data, fields, {
    id: 'alarm-api',
    name: 'API',
    offset: offset + 2,
    length: 4,
    rawValue: api,
  });

  const slotNumber = readUint16BE(data, offset + 6);
  push(data, fields, {
    id: 'alarm-slot-number',
    name: 'SlotNumber',
    offset: offset + 6,
    length: 2,
    rawValue: slotNumber,
    physicalValue: formatHex(slotNumber, 4),
  });

  const subslotNumber = readUint16BE(data, offset + 8);
  push(data, fields, {
    id: 'alarm-subslot-number',
    name: 'SubslotNumber',
    offset: offset + 8,
    length: 2,
    rawValue: subslotNumber,
    physicalValue: formatHex(subslotNumber, 4),
  });

  return { alarmType, slotNumber, subslotNumber };
}

/** AlarmSpecifier: 11 bit sıra numarası + 4 tanı biti (bit 14 ayrılmış). */
function decodeAlarmSpecifier(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: string[],
): void {
  const specifier = readUint16BE(data, offset);
  push(data, fields, {
    id: 'alarm-specifier-sequence',
    name: 'AlarmSpecifier — SequenceNumber (bit 0-10)',
    offset,
    length: 2,
    rawValue: specifier & ALARM_SPECIFIER_SEQUENCE_MASK,
  });
  push(data, fields, {
    id: 'alarm-specifier-channel',
    name: 'AlarmSpecifier — ChannelDiagnosis (bit 11)',
    offset,
    length: 2,
    rawValue: (specifier & ALARM_SPECIFIER_CHANNEL_MASK) === 0 ? 0 : 1,
    physicalValue: (specifier & ALARM_SPECIFIER_CHANNEL_MASK) === 0 ? 'No' : 'Yes',
  });
  push(data, fields, {
    id: 'alarm-specifier-manufacturer',
    name: 'AlarmSpecifier — ManufacturerSpecificDiagnosis (bit 12)',
    offset,
    length: 2,
    rawValue: (specifier & ALARM_SPECIFIER_MANUFACTURER_MASK) === 0 ? 0 : 1,
    physicalValue: (specifier & ALARM_SPECIFIER_MANUFACTURER_MASK) === 0 ? 'No' : 'Yes',
  });
  push(data, fields, {
    id: 'alarm-specifier-submodule',
    name: 'AlarmSpecifier — SubmoduleDiagnosisState (bit 13)',
    offset,
    length: 2,
    rawValue: (specifier & ALARM_SPECIFIER_SUBMODULE_MASK) === 0 ? 0 : 1,
    physicalValue: (specifier & ALARM_SPECIFIER_SUBMODULE_MASK) === 0 ? 'No' : 'Yes',
  });
  const reservedSet = (specifier & ALARM_SPECIFIER_RESERVED_MASK) !== 0;
  push(data, fields, {
    id: 'alarm-specifier-reserved',
    name: 'AlarmSpecifier — Reserved (bit 14)',
    offset,
    length: 2,
    rawValue: reservedSet ? 1 : 0,
    valid: !reservedSet,
    ...(reservedSet ? { warnings: [WARN_ALARM_RESERVED_BIT_SET] } : {}),
  });
  if (reservedSet) warnings.push(WARN_ALARM_RESERVED_BIT_SET);
  push(data, fields, {
    id: 'alarm-specifier-ar-diagnosis',
    name: 'AlarmSpecifier — ARDiagnosisState (bit 15)',
    offset,
    length: 2,
    rawValue: (specifier & ALARM_SPECIFIER_AR_MASK) === 0 ? 0 : 1,
    physicalValue: (specifier & ALARM_SPECIFIER_AR_MASK) === 0 ? 'No' : 'Yes',
  });
}

/** PNIOStatus: ErrorCode + ErrorDecode + ErrorCode1 + ErrorCode2, hepsi 1 bayt. */
function decodePnioStatus(data: Uint8Array, offset: number, fields: ParsedField[]): void {
  const names = ['ErrorCode', 'ErrorDecode', 'ErrorCode1', 'ErrorCode2'];
  names.forEach((name, index) => {
    const fieldOffset = offset + index;
    push(data, fields, {
      // Her alanın id'si KENDİ ofsetini taşır (12g/12h dersi).
      id: `alarm-pnio-status-${String(index)}`,
      name: `PNIOStatus — ${name}`,
      offset: fieldOffset,
      length: 1,
      rawValue: byteAt(data, fieldOffset),
      physicalValue: formatHex(byteAt(data, fieldOffset), 2),
    });
  });
}

/**
 * Alarm PDU'sunu çözer. `offset` AlarmDstEndpoint'in ilk baytı, `limit`
 * çerçevenin (dolgu dışındaki) sonu. Sabit başlık kesikse `undefined` döner.
 */
export function decodeAlarmPdu(
  data: Uint8Array,
  offset: number,
  limit: number,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): AlarmDecodeSummary | undefined {
  if (limit - offset < RTA_FIXED_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ALARM_HEADER_TRUNCATED,
      offset,
      length: Math.max(0, limit - offset),
      details: {
        availableBytes: Math.max(0, limit - offset),
        requiredBytes: RTA_FIXED_HEADER_LENGTH,
      },
    });
    return undefined;
  }

  push(data, fields, {
    id: 'alarm-dst-endpoint',
    name: 'AlarmDstEndpoint',
    offset,
    length: 2,
    rawValue: readUint16BE(data, offset),
    physicalValue: formatHex(readUint16BE(data, offset), 4),
  });
  push(data, fields, {
    id: 'alarm-src-endpoint',
    name: 'AlarmSrcEndpoint',
    offset: offset + 2,
    length: 2,
    rawValue: readUint16BE(data, offset + 2),
    physicalValue: formatHex(readUint16BE(data, offset + 2), 4),
  });

  const pduTypeOffset = offset + 4;
  const pduTypeByte = byteAt(data, pduTypeOffset);
  const pduType = pduTypeByte & 0x0f;
  const pduVersion = (pduTypeByte & 0xf0) >>> 4;
  const pduTypeName = PDU_TYPE_NAMES.get(pduType);
  push(data, fields, {
    id: 'alarm-pdu-type',
    name: 'PDUType — Type (bit 0-3)',
    offset: pduTypeOffset,
    length: 1,
    rawValue: pduType,
    ...(pduTypeName === undefined ? {} : { physicalValue: pduTypeName }),
    valid: pduTypeName !== undefined,
    ...(pduTypeName === undefined ? { warnings: [WARN_ALARM_UNKNOWN_PDU_TYPE] } : {}),
  });
  if (pduTypeName === undefined) warnings.push(WARN_ALARM_UNKNOWN_PDU_TYPE);
  push(data, fields, {
    id: 'alarm-pdu-version',
    name: 'PDUType — Version (bit 4-7)',
    offset: pduTypeOffset,
    length: 1,
    rawValue: pduVersion,
  });

  const addFlagsOffset = offset + 5;
  const addFlags = byteAt(data, addFlagsOffset);
  push(data, fields, {
    id: 'alarm-window-size',
    name: 'AddFlags — WindowSize (bit 0-3)',
    offset: addFlagsOffset,
    length: 1,
    rawValue: addFlags & 0x0f,
  });
  push(data, fields, {
    id: 'alarm-tack',
    name: 'AddFlags — TACK (bit 4-7)',
    offset: addFlagsOffset,
    length: 1,
    rawValue: (addFlags & 0xf0) >>> 4,
  });

  push(data, fields, {
    id: 'alarm-send-seq-num',
    name: 'SendSeqNum',
    offset: offset + 6,
    length: 2,
    rawValue: readUint16BE(data, offset + 6),
  });
  push(data, fields, {
    id: 'alarm-ack-seq-num',
    name: 'AckSeqNum',
    offset: offset + 8,
    length: 2,
    rawValue: readUint16BE(data, offset + 8),
  });

  const varPartOffset = offset + 10;
  const varPartLen = readUint16BE(data, varPartOffset);
  push(data, fields, {
    id: 'alarm-var-part-len',
    name: 'VarPartLen',
    offset: varPartOffset,
    length: 2,
    rawValue: varPartLen,
    unit: 'B',
  });

  const bodyStart = offset + RTA_FIXED_HEADER_LENGTH;
  const available = Math.max(0, limit - bodyStart);
  if (varPartLen > available) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_ALARM_BLOCK_TRUNCATED,
      offset: bodyStart,
      length: available,
      details: { varPartLen, availableBytes: available },
    });
  }
  const bodyLimit = bodyStart + Math.min(varPartLen, available);

  const summaryBase = {
    pduType,
    pduTypeLabel: pduTypeName ?? formatHex(pduType, 1),
  };

  // ACK/NACK'in ek verisi YOKTUR (iki kaynak da böyle diyor).
  if (pduType === PDU_TYPE_ACK || pduType === PDU_TYPE_NACK) {
    if (bodyLimit > bodyStart) warnings.push(WARN_ALARM_VAR_PART_MISMATCH);
    return {
      ...summaryBase,
      alarmType: undefined,
      alarmTypeLabel: undefined,
      slotNumber: undefined,
      subslotNumber: undefined,
      consumedBytes: bodyLimit - offset,
    };
  }

  if (pduType === PDU_TYPE_ERR) {
    if (bodyLimit - bodyStart < PNIO_STATUS_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ALARM_BLOCK_TRUNCATED,
        offset: bodyStart,
        length: Math.max(0, bodyLimit - bodyStart),
      });
      return { ...summaryBase, alarmType: undefined, alarmTypeLabel: undefined, slotNumber: undefined, subslotNumber: undefined, consumedBytes: Math.max(0, bodyLimit - offset) };
    }
    decodePnioStatus(data, bodyStart, fields);
    return {
      ...summaryBase,
      alarmType: undefined,
      alarmTypeLabel: undefined,
      slotNumber: undefined,
      subslotNumber: undefined,
      consumedBytes: bodyLimit - offset,
    };
  }

  // Data-RTA (ve teyit edilmemiş tipler): gövde bir blokla başlar.
  if (bodyLimit - bodyStart < RTA_BLOCK_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ALARM_BLOCK_TRUNCATED,
      offset: bodyStart,
      length: Math.max(0, bodyLimit - bodyStart),
    });
    return {
      ...summaryBase,
      alarmType: undefined,
      alarmTypeLabel: undefined,
      slotNumber: undefined,
      subslotNumber: undefined,
      consumedBytes: Math.max(0, bodyLimit - offset),
    };
  }

  const blockType = readUint16BE(data, bodyStart);
  const blockTypeName = BLOCK_TYPE_NAMES.get(blockType);
  push(data, fields, {
    id: 'alarm-block-type',
    name: 'BlockHeader — BlockType',
    offset: bodyStart,
    length: 2,
    rawValue: blockType,
    ...(blockTypeName === undefined ? {} : { physicalValue: blockTypeName }),
    valid: blockTypeName !== undefined,
    ...(blockTypeName === undefined ? { warnings: [WARN_ALARM_UNKNOWN_BLOCK_TYPE] } : {}),
  });
  if (blockTypeName === undefined) warnings.push(WARN_ALARM_UNKNOWN_BLOCK_TYPE);

  const blockLength = readUint16BE(data, bodyStart + 2);
  push(data, fields, {
    id: 'alarm-block-length',
    name: 'BlockHeader — BlockLength',
    offset: bodyStart + 2,
    length: 2,
    rawValue: blockLength,
    unit: 'B',
  });
  push(data, fields, {
    id: 'alarm-block-version-high',
    name: 'BlockHeader — BlockVersionHigh',
    offset: bodyStart + 4,
    length: 1,
    rawValue: byteAt(data, bodyStart + 4),
  });
  push(data, fields, {
    id: 'alarm-block-version-low',
    name: 'BlockHeader — BlockVersionLow',
    offset: bodyStart + 5,
    length: 1,
    rawValue: byteAt(data, bodyStart + 5),
  });

  const isNotification =
    blockType === BLOCK_TYPE_ALARM_NOTIFICATION_HIGH ||
    blockType === BLOCK_TYPE_ALARM_NOTIFICATION_LOW;
  const isAck =
    blockType === BLOCK_TYPE_ALARM_ACK_HIGH || blockType === BLOCK_TYPE_ALARM_ACK_LOW;

  const contentStart = bodyStart + RTA_BLOCK_HEADER_LENGTH;
  const requiredBody = isNotification
    ? ALARM_NOTIFICATION_BODY_LENGTH
    : isAck
      ? ALARM_ACK_BODY_LENGTH
      : 0;

  if (!isNotification && !isAck) {
    // Teyit edilmemiş blok tipi: gövdenin yerleşimi bilinmiyor → HAM.
    if (bodyLimit > contentStart) {
      push(data, fields, {
        id: 'alarm-block-payload',
        name: 'Block Payload',
        offset: contentStart,
        length: bodyLimit - contentStart,
        unit: 'B',
        warnings: [WARN_ALARM_UNKNOWN_BLOCK_TYPE],
      });
    }
    return {
      ...summaryBase,
      alarmType: undefined,
      alarmTypeLabel: undefined,
      slotNumber: undefined,
      subslotNumber: undefined,
      consumedBytes: bodyLimit - offset,
    };
  }

  if (bodyLimit - contentStart < requiredBody) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ALARM_BLOCK_TRUNCATED,
      offset: contentStart,
      length: Math.max(0, bodyLimit - contentStart),
      details: { requiredBytes: requiredBody, availableBytes: Math.max(0, bodyLimit - contentStart) },
    });
    return {
      ...summaryBase,
      alarmType: undefined,
      alarmTypeLabel: undefined,
      slotNumber: undefined,
      subslotNumber: undefined,
      consumedBytes: Math.max(0, bodyLimit - offset),
    };
  }

  const header = decodeAlarmHeader(data, contentStart, fields, warnings);
  let cursor = contentStart + 10;

  if (isNotification) {
    const moduleIdent = readUint32BE(data, cursor);
    push(data, fields, {
      id: 'alarm-module-ident',
      name: 'ModuleIdentNumber',
      offset: cursor,
      length: 4,
      rawValue: moduleIdent,
      physicalValue: formatHex(moduleIdent, 8),
    });
    const submoduleIdent = readUint32BE(data, cursor + 4);
    push(data, fields, {
      id: 'alarm-submodule-ident',
      name: 'SubmoduleIdentNumber',
      offset: cursor + 4,
      length: 4,
      rawValue: submoduleIdent,
      physicalValue: formatHex(submoduleIdent, 8),
    });
    cursor += 8;
  }

  decodeAlarmSpecifier(data, cursor, fields, warnings);
  cursor += 2;

  if (isAck) {
    decodePnioStatus(data, cursor, fields);
    cursor += PNIO_STATUS_LENGTH;
  }

  // AlarmSpecifier'dan sonrası isteğe bağlı UserStructureIdentifier + yük.
  // USI adlandırılır, ardındaki yük AR bağlamı istediği için HAM (dosya başı).
  if (bodyLimit - cursor >= 2) {
    const usi = readUint16BE(data, cursor);
    push(data, fields, {
      id: 'alarm-user-structure-identifier',
      name: 'UserStructureIdentifier',
      offset: cursor,
      length: 2,
      rawValue: usi,
      physicalValue: formatHex(usi, 4),
      warnings: [WARN_ALARM_PAYLOAD_NEEDS_CONTEXT],
    });
    warnings.push(WARN_ALARM_PAYLOAD_NEEDS_CONTEXT);
    cursor += 2;
    if (bodyLimit > cursor) {
      push(data, fields, {
        id: 'alarm-user-payload',
        name: 'Alarm Payload',
        offset: cursor,
        length: bodyLimit - cursor,
        unit: 'B',
        warnings: [WARN_ALARM_PAYLOAD_NEEDS_CONTEXT],
      });
      cursor = bodyLimit;
    }
  } else if (bodyLimit > cursor) {
    push(data, fields, {
      id: 'alarm-user-payload',
      name: 'Alarm Payload',
      offset: cursor,
      length: bodyLimit - cursor,
      unit: 'B',
      warnings: [WARN_ALARM_PAYLOAD_NEEDS_CONTEXT],
    });
    warnings.push(WARN_ALARM_PAYLOAD_NEEDS_CONTEXT);
    cursor = bodyLimit;
  }

  if (cursor !== bodyLimit) warnings.push(WARN_ALARM_VAR_PART_MISMATCH);

  const alarmLabel = ALARM_TYPE_NAMES.get(header.alarmType);
  return {
    ...summaryBase,
    alarmType: header.alarmType,
    ...(alarmLabel === undefined ? { alarmTypeLabel: undefined } : { alarmTypeLabel: alarmLabel }),
    slotNumber: header.slotNumber,
    subslotNumber: header.subslotNumber,
    consumedBytes: bodyLimit - offset,
  };
}
