/**
 * CiA 301 CANopen — COB-ID mesaj tipi çözümü.
 *
 * Girdi J1939/ISO-TP ile AYNI SocketCAN `struct can_frame` kaydıdır (bkz.
 * `canFrame.ts` dosya başı). CANopen'ın Predefined Connection Set'i yalnız
 * BASE (11-bit) identifier kullanır — extended çerçeve hata olarak işlenir
 * (J1939'un tersi: J1939 extended ister, CANopen base ister).
 *
 * ── COB-ID KIRILIMI (KAYNAK UYARISI) ─────────────────────────────────────────
 * Spec özet 10-uygulama-spec.md:655'in tek cümlesi "CANopen COB-ID çözümleme
 * aracı oluşturulmalı" — bit ayrımı ve taban ID'ler VERİLMİYOR (grep sıfır).
 * Aşağıdaki tablo CiA 301'in Predefined Connection Set'idir; CAN FD DLC
 * tablosuyla (`canFrame.ts`) aynı gerekçeyle dış kaynaktan, açıkça belirtilerek
 * alındı — bu, her genel CANopen kaynağında (CiA 301, python-canopen, vb.)
 * bulunan bir ÇERÇEVELEME kuralıdır, J1939DA gibi lisanslı bir içerik tablosu
 * DEĞİLDİR:
 *
 *   bit10        7 6            0
 *   +-------------+--------------+
 *   | Function    | Node-ID      |
 *   +-------------+--------------+
 *
 *   0x0 NMT (COB-ID sabit 0x000) · 0x1 SYNC (node=0) / EMCY (node≠0) ·
 *   0x2 TIME (0x100) · 0x3-0xA PDO1-4 Tx/Rx (0x180+n … 0x500+n) ·
 *   0xB SDO Tx (server→client, 0x580+n) · 0xC SDO Rx (client→server, 0x600+n) ·
 *   0xE NMT Error Control / Heartbeat (0x700+n) · 0xD/0xF ayrılmış.
 *
 * ── İÇERİK vs ÇERÇEVE AYRIMI (J1939/DBC ile AYNI SINIR) ──────────────────────
 * Mesaj TİPİNİ (NMT/SYNC/EMCY/PDOn/SDO/Heartbeat) tanımak ÇERÇEVELEMEDİR ve
 * burada yapılır. Payload'ın ANLAMI (PDO mapping'in hangi baytı hangi Object
 * Dictionary girdisine karşılık geldiği, EMCY error code tablosu, NMT komut
 * baytının anlamı) EDS/Object Dictionary'ye bağlıdır — J1939'un SPN'i DBC'ye
 * bırakmasıyla birebir aynı gerekçe. Bu içerik dalga 1c'nin (EDS) işi; burada
 * payload HAM gösterilir ve "EDS gerekir" uyarısı basılır.
 *
 * ── SDO KOMUT BAYTI (KAYNAK UYARISI, aynı gerekçe) ───────────────────────────
 * Expedited/Segmented/Block ayrımı ve Abort (0x80) sabiti de CiA 301'dendir,
 * spec vermiyor. Index/Sub-index'in SDO gövdesindeki bayt konumu (offset 1-2 /
 * 3) protokolün kendi taşıma yapısıdır — İÇERİK değil, ÇERÇEVEDİR, bu yüzden
 * çözülür; VERİ baytlarının (offset 4+) anlamı yine EDS'e muhtaçtır, ham kalır.
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

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../../automotive/can/canFrame';

const PROTOCOL_ID = 'canopen';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CANopen';

const DLC_OFFSET = 4;
const NODE_ID_MASK = 0x7f;
const FUNCTION_CODE_SHIFT = 7;
const FUNCTION_CODE_MASK = 0xf;

const FC_NMT = 0x0;
const FC_SYNC_OR_EMCY = 0x1;
const FC_TIME = 0x2;
const FC_PDO1_TX = 0x3;
const FC_PDO1_RX = 0x4;
const FC_PDO2_TX = 0x5;
const FC_PDO2_RX = 0x6;
const FC_PDO3_TX = 0x7;
const FC_PDO3_RX = 0x8;
const FC_PDO4_TX = 0x9;
const FC_PDO4_RX = 0xa;
const FC_SDO_TX = 0xb;
const FC_SDO_RX = 0xc;
const FC_NMT_ERROR_CONTROL = 0xe;

export type CanopenMessageKind =
  | 'nmt'
  | 'sync'
  | 'emcy'
  | 'time'
  | 'pdo1-tx'
  | 'pdo1-rx'
  | 'pdo2-tx'
  | 'pdo2-rx'
  | 'pdo3-tx'
  | 'pdo3-rx'
  | 'pdo4-tx'
  | 'pdo4-rx'
  | 'sdo-tx'
  | 'sdo-rx'
  | 'heartbeat'
  | 'unknown';

/** Protokol terimleri — veridir, çevrilmez (CLAUDE.md). */
const MESSAGE_KIND_LABELS: Readonly<Record<CanopenMessageKind, string>> = {
  nmt: 'NMT',
  sync: 'SYNC',
  emcy: 'EMCY',
  time: 'TIME',
  'pdo1-tx': 'PDO1 (Tx)',
  'pdo1-rx': 'PDO1 (Rx)',
  'pdo2-tx': 'PDO2 (Tx)',
  'pdo2-rx': 'PDO2 (Rx)',
  'pdo3-tx': 'PDO3 (Tx)',
  'pdo3-rx': 'PDO3 (Rx)',
  'pdo4-tx': 'PDO4 (Tx)',
  'pdo4-rx': 'PDO4 (Rx)',
  'sdo-tx': 'SDO (Tx)',
  'sdo-rx': 'SDO (Rx)',
  heartbeat: 'Heartbeat',
  unknown: 'Reserved',
};

/** CiA 301 NMT durum kodları (Heartbeat baytı) — dış kaynak, dosya başı. */
const NMT_STATE_LABELS: ReadonlyMap<number, string> = new Map([
  [0x00, 'Boot-up'],
  [0x04, 'Stopped'],
  [0x05, 'Operational'],
  [0x7f, 'Pre-operational'],
]);

const SDO_ABORT_COMMAND = 0x80;
const SDO_BLOCK_DOWNLOAD_INITIATE = 0x6;
const SDO_BLOCK_UPLOAD_INITIATE = 0x5;
const SDO_COMMAND_SPECIFIER_SHIFT = 5;
const SDO_COMMAND_SPECIFIER_MASK = 0x7;
const SDO_EXPEDITED_BIT = 0x02;

function resolveMessageKind(functionCode: number, nodeId: number): CanopenMessageKind {
  switch (functionCode) {
    case FC_NMT:
      return 'nmt';
    case FC_SYNC_OR_EMCY:
      return nodeId === 0 ? 'sync' : 'emcy';
    case FC_TIME:
      return 'time';
    case FC_PDO1_TX:
      return 'pdo1-tx';
    case FC_PDO1_RX:
      return 'pdo1-rx';
    case FC_PDO2_TX:
      return 'pdo2-tx';
    case FC_PDO2_RX:
      return 'pdo2-rx';
    case FC_PDO3_TX:
      return 'pdo3-tx';
    case FC_PDO3_RX:
      return 'pdo3-rx';
    case FC_PDO4_TX:
      return 'pdo4-tx';
    case FC_PDO4_RX:
      return 'pdo4-rx';
    case FC_SDO_TX:
      return 'sdo-tx';
    case FC_SDO_RX:
      return 'sdo-rx';
    case FC_NMT_ERROR_CONTROL:
      return 'heartbeat';
    default:
      return 'unknown';
  }
}

function isPdoKind(kind: CanopenMessageKind): boolean {
  return kind.startsWith('pdo');
}

const ERROR_FRAME_TOO_SHORT = 'protocol.canopen.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.canopen.error.frameTooLong';
const ERROR_ABORTED = 'protocol.canopen.error.aborted';
const ERROR_EXTENDED_NOT_SUPPORTED = 'protocol.canopen.error.extendedNotSupported';
const ERROR_UNKNOWN_FUNCTION_CODE = 'protocol.canopen.error.unknownFunctionCode';

const WARN_REMOTE_FRAME = 'protocol.canopen.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.canopen.warning.truncatedPayload';
const WARN_PDO_NEEDS_MAPPING = 'protocol.canopen.warning.pdoNeedsMapping';
const WARN_EMCY_NEEDS_DATABASE = 'protocol.canopen.warning.emcyNeedsDatabase';
const WARN_SDO_DATA_NEEDS_SCHEMA = 'protocol.canopen.warning.sdoDataNeedsSchema';
const WARN_SDO_ABORT_NEEDS_TABLE = 'protocol.canopen.warning.sdoAbortNeedsTable';
const WARN_UNKNOWN_NMT_STATE = 'protocol.canopen.warning.unknownNmtState';

const SUMMARY_PREFIX = 'protocol.canopen.summary.';

/**
 * Çeviri anahtarı SEGMENTLERİNDE tire OLAMAZ (repo genelinde `[a-zA-Z0-9]+`
 * deseni bekleniyor — bkz. e2e ham-anahtar sızıntı taraması). `messageKind`
 * değerleri (`'pdo1-tx'` gibi) doğrudan anahtara YAZILAMAZ, camelCase'e çevrilir.
 */
const SUMMARY_KEY_SUFFIXES: Readonly<Record<CanopenMessageKind, string>> = {
  nmt: 'nmt',
  sync: 'sync',
  emcy: 'emcy',
  time: 'time',
  'pdo1-tx': 'pdo1Tx',
  'pdo1-rx': 'pdo1Rx',
  'pdo2-tx': 'pdo2Tx',
  'pdo2-rx': 'pdo2Rx',
  'pdo3-tx': 'pdo3Tx',
  'pdo3-rx': 'pdo3Rx',
  'pdo4-tx': 'pdo4Tx',
  'pdo4-rx': 'pdo4Rx',
  'sdo-tx': 'sdoTx',
  'sdo-rx': 'sdoRx',
  heartbeat: 'heartbeat',
  unknown: 'unknown',
};

export type CanopenFrameMetadata = {
  functionCode: number;
  nodeId: number;
  messageKind: CanopenMessageKind;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

interface CanopenParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function pushRawBlock(
  fields: ParsedField[],
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  length: number,
): void {
  if (length <= 0) return;
  fields.push({
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    unit: 'B',
    valid: true,
    warnings: [],
  });
}

function decodeNmtPayload(data: Uint8Array, payloadLength: number, fields: ParsedField[]): void {
  const base = CAN_HEADER_LENGTH;
  if (payloadLength >= 1) {
    fields.push({
      id: 'command',
      name: 'Command',
      offset: base,
      length: 1,
      rawBytes: data.slice(base, base + 1),
      rawValue: byteAt(data, base),
      valid: true,
      warnings: [],
    });
  }
  if (payloadLength >= 2) {
    fields.push({
      id: 'target-node-id',
      name: 'Target Node-ID',
      offset: base + 1,
      length: 1,
      rawBytes: data.slice(base + 1, base + 2),
      rawValue: byteAt(data, base + 1),
      valid: true,
      warnings: [],
    });
  }
}

function decodeEmcyPayload(
  data: Uint8Array,
  payloadLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const base = CAN_HEADER_LENGTH;
  if (payloadLength < 3) return;
  fields.push({
    id: 'error-code',
    name: 'Error Code',
    offset: base,
    length: 2,
    rawBytes: data.slice(base, base + 2),
    rawValue: readUint16Le(data, base),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'error-register',
    name: 'Error Register',
    offset: base + 2,
    length: 1,
    rawBytes: data.slice(base + 2, base + 3),
    rawValue: byteAt(data, base + 2),
    valid: true,
    warnings: [],
  });
  pushRawBlock(
    fields,
    data,
    'manufacturer-data',
    'Manufacturer Data',
    base + 3,
    Math.max(0, payloadLength - 3),
  );
  warnings.push(toProtocolWarning(WARN_EMCY_NEEDS_DATABASE));
}

function decodePdoPayload(
  data: Uint8Array,
  payloadLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  pushRawBlock(fields, data, 'data', 'Data', CAN_HEADER_LENGTH, payloadLength);
  if (payloadLength > 0) {
    warnings.push(toProtocolWarning(WARN_PDO_NEEDS_MAPPING));
  }
}

function decodeSdoPayload(
  data: Uint8Array,
  payloadLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const base = CAN_HEADER_LENGTH;
  if (payloadLength < 1) return;

  const commandByte = byteAt(data, base);
  const commandField: ParsedField = {
    id: 'command-byte',
    name: 'Command Byte',
    offset: base,
    length: 1,
    rawBytes: data.slice(base, base + 1),
    rawValue: commandByte,
    valid: true,
    warnings: [],
  };

  const commandSpecifier = (commandByte >>> SDO_COMMAND_SPECIFIER_SHIFT) & SDO_COMMAND_SPECIFIER_MASK;
  const isAbort = commandByte === SDO_ABORT_COMMAND;
  if (isAbort) {
    commandField.physicalValue = 'Abort Transfer';
  } else if (commandSpecifier === SDO_BLOCK_DOWNLOAD_INITIATE) {
    commandField.physicalValue = 'Block Download';
  } else if (commandSpecifier === SDO_BLOCK_UPLOAD_INITIATE) {
    commandField.physicalValue = 'Block Upload';
  } else if ((commandByte & SDO_EXPEDITED_BIT) !== 0) {
    commandField.physicalValue = 'Expedited';
  } else {
    commandField.physicalValue = 'Segmented';
  }
  fields.push(commandField);

  if (payloadLength < 4) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
    return;
  }

  fields.push({
    id: 'index',
    name: 'Index',
    offset: base + 1,
    length: 2,
    rawBytes: data.slice(base + 1, base + 3),
    rawValue: readUint16Le(data, base + 1),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'sub-index',
    name: 'Sub-Index',
    offset: base + 3,
    length: 1,
    rawBytes: data.slice(base + 3, base + 4),
    rawValue: byteAt(data, base + 3),
    valid: true,
    warnings: [],
  });

  const dataLength = Math.max(0, payloadLength - 4);
  if (isAbort) {
    pushRawBlock(fields, data, 'abort-code', 'Abort Code', base + 4, dataLength);
    if (dataLength > 0) {
      warnings.push(toProtocolWarning(WARN_SDO_ABORT_NEEDS_TABLE));
    }
  } else {
    pushRawBlock(fields, data, 'data', 'Data', base + 4, dataLength);
    if (dataLength > 0) {
      warnings.push(toProtocolWarning(WARN_SDO_DATA_NEEDS_SCHEMA));
    }
  }
}

function decodeHeartbeatPayload(
  data: Uint8Array,
  payloadLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  if (payloadLength < 1) return;
  const base = CAN_HEADER_LENGTH;
  const stateByte = byteAt(data, base);
  const stateLabel = NMT_STATE_LABELS.get(stateByte);
  const stateField: ParsedField = {
    id: 'nmt-state',
    name: 'NMT State',
    offset: base,
    length: 1,
    rawBytes: data.slice(base, base + 1),
    rawValue: stateByte,
    valid: stateLabel !== undefined,
    warnings: [],
  };
  if (stateLabel !== undefined) {
    stateField.physicalValue = stateLabel;
  } else {
    stateField.warnings.push(WARN_UNKNOWN_NMT_STATE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_NMT_STATE));
  }
  fields.push(stateField);
}

function parseCanopenFrame(data: Uint8Array, options: CanopenParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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

  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: 0,
    length: 4,
    rawBytes: data.slice(0, 4),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: !identity.extended,
    warnings: [],
  });

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, 8, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (identity.remote) {
    warnings.push(toProtocolWarning(WARN_REMOTE_FRAME));
  }
  if (payloadLength < Math.min(declaredLength, 8)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  let messageKind: CanopenMessageKind = 'unknown';
  let functionCode = -1;
  let nodeId = -1;

  if (identity.extended) {
    // Predefined Connection Set yalnız BASE identifier tanımlar.
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_EXTENDED_NOT_SUPPORTED,
      offset: 0,
      length: 4,
      details: { canId: identity.id },
    });
  } else {
    functionCode = (identity.id >>> FUNCTION_CODE_SHIFT) & FUNCTION_CODE_MASK;
    nodeId = identity.id & NODE_ID_MASK;
    messageKind = resolveMessageKind(functionCode, nodeId);

    const functionCodeField: ParsedField = {
      id: 'function-code',
      name: 'Function Code',
      // 4 bit'lik alan byte0'ın MSB'si + byte1'in alt 3 bitine yayılır —
      // "bit alanına gerçekten yaşadığı baytı ver" kuralı burada İKİ bayta
      // işaret eder (J1939'un PGN'i gibi türetilmiş, çok baytlı bir alan).
      offset: 0,
      length: 2,
      rawBytes: data.slice(0, 2),
      rawValue: functionCode,
      valid: messageKind !== 'unknown',
      warnings: [],
    };
    if (messageKind !== 'unknown') {
      functionCodeField.physicalValue = MESSAGE_KIND_LABELS[messageKind];
    } else {
      functionCodeField.warnings.push(ERROR_UNKNOWN_FUNCTION_CODE);
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_UNKNOWN_FUNCTION_CODE,
        offset: 0,
        length: 2,
        details: { functionCode },
      });
    }
    fields.push(functionCodeField);

    fields.push({
      id: 'node-id',
      name: 'Node-ID',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: nodeId,
      valid: true,
      warnings: [],
    });

    switch (messageKind) {
      case 'nmt':
        decodeNmtPayload(data, payloadLength, fields);
        break;
      case 'emcy':
        decodeEmcyPayload(data, payloadLength, fields, warnings);
        break;
      default:
        if (isPdoKind(messageKind)) {
          decodePdoPayload(data, payloadLength, fields, warnings);
        } else if (messageKind === 'sdo-tx' || messageKind === 'sdo-rx') {
          decodeSdoPayload(data, payloadLength, fields, warnings);
        } else if (messageKind === 'heartbeat') {
          decodeHeartbeatPayload(data, payloadLength, fields, warnings);
        }
        break;
    }
  }

  const summaryParams: Record<string, string> = {
    canId: identity.id.toString(16).toUpperCase(),
    payloadLength: String(payloadLength),
  };
  if (messageKind !== 'unknown') {
    summaryParams.nodeId = String(nodeId);
  }

  const metadata: CanopenFrameMetadata = {
    functionCode,
    nodeId,
    messageKind,
    summaryKey: `${SUMMARY_PREFIX}${SUMMARY_KEY_SUFFIXES[messageKind]}`,
    summaryParams,
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

export function parseCanopen(data: Uint8Array): ParseResult {
  return parseCanopenFrame(data, {});
}

export const canopenParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: uzunluk aralığı + base identifier + tanınan function code. */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
      return false;
    }
    const identity = decodeCanId(readUint32Le(data, 0));
    if (identity.extended) return false;
    const functionCode = (identity.id >>> FUNCTION_CODE_SHIFT) & FUNCTION_CODE_MASK;
    return resolveMessageKind(functionCode, identity.id & NODE_ID_MASK) !== 'unknown';
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CanopenParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseCanopenFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. `pdoStatuswordVelocity` spec'in BİREBİR verdiği örnektir
 * (özet 04:102: CAN ID 0x181, `37 12 DC 05` → Statusword 0x1237, Velocity
 * 1500 rpm) — PAYLOAD burada HAM kalır, spec'in kendi çözümü EDS/mapping
 * gerektirir (dosya başı). `sdoWriteControlword` spec'in verdiği ikinci
 * örnektir (özet 03:87: Index 6040 Sub 00 Write `000F`).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'nmt-start-remote-node',
    name: 'protocol.canopen.example.nmtStartRemoteNode.name',
    // COB-ID 0x000: NMT. Command 0x01, hedef node 0x00 (yayın).
    bytes: buildCanClassicFrame(0x000, [0x01, 0x00]),
    description: 'protocol.canopen.example.nmtStartRemoteNode.description',
    expectedValid: true,
  },
  {
    id: 'sync',
    name: 'protocol.canopen.example.sync.name',
    // COB-ID 0x080, function 0x1 + node 0 → SYNC, payload yok.
    bytes: buildCanClassicFrame(0x080, []),
    description: 'protocol.canopen.example.sync.description',
    expectedValid: true,
  },
  {
    id: 'emcy-node-5',
    name: 'protocol.canopen.example.emcyNode5.name',
    // COB-ID 0x085 = 0x080 + 5 → EMCY, node 5.
    bytes: buildCanClassicFrame(0x085, [0x10, 0x81, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]),
    description: 'protocol.canopen.example.emcyNode5.description',
    expectedValid: true,
  },
  {
    id: 'pdo-statusword-velocity',
    name: 'protocol.canopen.example.pdoStatuswordVelocity.name',
    // Spec özet 04:102: CAN ID 0x181 (TPDO1, node 1) → 37 12 DC 05.
    bytes: buildCanClassicFrame(0x181, [0x37, 0x12, 0xdc, 0x05]),
    description: 'protocol.canopen.example.pdoStatuswordVelocity.description',
    expectedValid: true,
  },
  {
    id: 'sdo-write-controlword',
    name: 'protocol.canopen.example.sdoWriteControlword.name',
    // Spec özet 03:87: Index 6040 Sub 00 Write 000F. Command 0x2B: expedited
    // download, n=2 (2 bayt kullanılmıyor), e=1, s=1.
    bytes: buildCanClassicFrame(0x601, [0x2b, 0x40, 0x60, 0x00, 0x0f, 0x00, 0x00, 0x00]),
    description: 'protocol.canopen.example.sdoWriteControlword.description',
    expectedValid: true,
  },
  {
    id: 'sdo-abort',
    name: 'protocol.canopen.example.sdoAbort.name',
    bytes: buildCanClassicFrame(0x581, [0x80, 0x40, 0x60, 0x00, 0x06, 0x02, 0x00, 0x00]),
    description: 'protocol.canopen.example.sdoAbort.description',
    expectedValid: true,
  },
  {
    id: 'heartbeat-operational',
    name: 'protocol.canopen.example.heartbeatOperational.name',
    // COB-ID 0x702 = 0x700 + 2 → Heartbeat, node 2, durum 0x05 Operational.
    bytes: buildCanClassicFrame(0x702, [0x05]),
    description: 'protocol.canopen.example.heartbeatOperational.description',
    expectedValid: true,
  },
  {
    id: 'reserved-function-code-rejected',
    name: 'protocol.canopen.example.reservedFunctionCodeRejected.name',
    // Function code 0xD (0x680 = 0xD << 7): CiA 301'in on beş kodundan biri değil.
    bytes: buildCanClassicFrame(0x680, [0x00]),
    description: 'protocol.canopen.example.reservedFunctionCodeRejected.description',
    expectedValid: false,
  },
];

export const canopenPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: canopenParser,
  documentation: {
    summary: 'protocol.canopen.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
