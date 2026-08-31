/**
 * LIN (Local Interconnect Network) — Sync + PID + Data + Checksum çözümü.
 *
 * GİRDİ CAN ÇERÇEVESİ DEĞİLDİR: LIN kendi tel biçimine sahiptir, SocketCAN
 * `struct can_frame` burada uygulanmaz (dosya başı gerekçesi ISO-TP/UDS/OBD-II
 * ile aynı: bağımsız protokol, bağımsız bayt sözleşmesi).
 *
 * ── NEDEN BREAK BİR BAYT DEĞİL ───────────────────────────────────────────────
 * LIN çerçevesi fiziksel olarak Sync Break (en az 13 bitlik dominant seviye +
 * delimiter) ile başlar, ama bu bir UART baytı DEĞİLDİR — baud hızının dışında,
 * bit-genişliği ölçümüyle algılanan bir sinyaldir. Hiçbir LIN alıcısı Break'i
 * uygulamaya "bayt" olarak vermez (CAN'in SOF/CRC-15/ACK'ini `canFrame.ts`nin
 * modellememesiyle AYNI gerekçe). Bu yüzden modellenen bayt dizisi SYNC'ten
 * (0x55) başlar: `[Sync, PID, Data(0-8), Checksum]`.
 *
 * ── PID PARİTESİ (spec özet 10:667-668, BİREBİR) ─────────────────────────────
 *   P0 = ID0 ⊕ ID1 ⊕ ID2 ⊕ ID4
 *   P1 = ¬(ID1 ⊕ ID3 ⊕ ID4 ⊕ ID5)
 *
 * ── CHECKSUM (KAYNAK UYARISI) ────────────────────────────────────────────────
 * Klasik/geliştirilmiş checksum ALGORİTMASI spec'te YOK (yalnız isim var,
 * özet 04:121-124 / 10:671) — LIN 2.1'den dış kaynaklı, CAN FD DLC
 * tablosuyla (`canFrame.ts`) aynı gerekçeyle açıkça belirtilerek alındı:
 * 8-bit toplam + end-around carry, sonra birin tümleyeni. Hangi KONVANSİYONUN
 * (klasik: yalnız veri / geliştirilmiş: PID+veri) kullanıldığı telden
 * OKUNAMAZ — gönderenin yapılandırmasıdır. Bu yüzden motor İKİSİNİ DE hesaplar
 * ve checksum baytının hangisiyle/hangileriyle tutarlı olduğunu söyler; tek
 * birini "doğru" varsaymaz.
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

const PROTOCOL_ID = 'lin';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'LIN';

const SYNC_BYTE = 0x55;
const ID_MASK = 0x3f;
const PARITY_SHIFT = 6;
const PARITY_MASK = 0x3;
const CHECKSUM_MASK = 0xff;
/** Sync + PID + Checksum — sıfır veri baytıyla bile bu üçü zorunludur. */
const MIN_FRAME_LENGTH = 3;
const MAX_DATA_LENGTH = 8;
const MAX_FRAME_LENGTH = MIN_FRAME_LENGTH + MAX_DATA_LENGTH;

const ERROR_FRAME_TOO_SHORT = 'protocol.lin.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.lin.error.frameTooLong';
const ERROR_ABORTED = 'protocol.lin.error.aborted';
const ERROR_INVALID_SYNC = 'protocol.lin.error.invalidSync';
const ERROR_CHECKSUM_MISMATCH = 'protocol.lin.error.checksumMismatch';

const WARN_PARITY_MISMATCH = 'protocol.lin.warning.parityMismatch';

const SUMMARY_FRAME = 'protocol.lin.summary.frame';

export type LinFrameMetadata = {
  id: number;
  checksumConvention: 'classic' | 'enhanced' | 'both' | 'none';
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/**
 * Spec özet 10:667-668'in P0/P1 formülü — bit numaraları ID'nin kendi 6 bitidir.
 *
 * DIŞA AÇIK, çünkü `LdfPanel` çerçeve tablosunda korumalı kimliği (PID) de
 * gösteriyor: LDF çerçeveleri 0-59 arası KİMLİKLE tanımlar ama telde taşınan
 * PID'dir. Formülü panelde YENİDEN YAZMAK ikinci bir bildirim yeri açardı;
 * tek kaynak burasıdır. `features/` katmanının `protocols/`ten içe aktarması
 * yerleşik desen (`CellularInitializationDashboard` → `lteModemAt`).
 */
export function computeLinParity(id: number): number {
  const bit = (n: number): number => (id >>> n) & 1;
  const p0 = bit(0) ^ bit(1) ^ bit(2) ^ bit(4);
  const p1 = 1 ^ (bit(1) ^ bit(3) ^ bit(4) ^ bit(5));
  return p0 | (p1 << 1);
}

/**
 * LIN 2.1 checksum algoritması (dosya başı KAYNAK UYARISI): 8-bit toplam +
 * end-around carry, sonra birin tümleyeni. `bytes` klasikte yalnız veri,
 * geliştirilmişte PID+veridir — ayrım çağıranın işi.
 */
function computeLinChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const value of bytes) {
    sum += value;
    if (sum > CHECKSUM_MASK) sum -= CHECKSUM_MASK;
  }
  return ~sum & CHECKSUM_MASK;
}

interface LinParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseLinFrame(data: Uint8Array, options: LinParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
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

  const maxFrameLength = options.maxFrameLength ?? MAX_FRAME_LENGTH;
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const syncByte = byteAt(data, 0);
  fields.push({
    id: 'sync',
    name: 'Sync',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: syncByte,
    valid: syncByte === SYNC_BYTE,
    warnings: [],
  });
  if (syncByte !== SYNC_BYTE) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_SYNC,
      offset: 0,
      length: 1,
      details: { syncByte },
    });
  }

  const pidByte = byteAt(data, 1);
  const id = pidByte & ID_MASK;
  const parityBits = (pidByte >>> PARITY_SHIFT) & PARITY_MASK;
  const expectedParity = computeLinParity(id);
  const parityValid = parityBits === expectedParity;

  fields.push({
    id: 'pid',
    name: 'PID',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: pidByte,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'id',
    name: 'ID',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: id,
    valid: true,
    warnings: [],
  });
  const parityField: ParsedField = {
    id: 'parity',
    name: 'Parity',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: parityBits,
    valid: parityValid,
    warnings: [],
  };
  if (parityValid) {
    parityField.physicalValue = 'Valid';
  } else {
    parityField.warnings.push(WARN_PARITY_MISMATCH);
    warnings.push(toProtocolWarning(WARN_PARITY_MISMATCH));
  }
  fields.push(parityField);

  const dataLength = Math.max(0, data.length - MIN_FRAME_LENGTH);
  const dataBytes = Array.from(data.slice(2, 2 + dataLength));
  if (dataLength > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: 2,
      length: dataLength,
      rawBytes: data.slice(2, 2 + dataLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const checksumOffset = data.length - 1;
  const checksumByte = byteAt(data, checksumOffset);
  const classicChecksum = computeLinChecksum(dataBytes);
  const enhancedChecksum = computeLinChecksum([pidByte, ...dataBytes]);
  const classicMatches = classicChecksum === checksumByte;
  const enhancedMatches = enhancedChecksum === checksumByte;

  const checksumField: ParsedField = {
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: 1,
    rawBytes: data.slice(checksumOffset, checksumOffset + 1),
    rawValue: checksumByte,
    valid: classicMatches || enhancedMatches,
    warnings: [],
  };
  let checksumConvention: LinFrameMetadata['checksumConvention'];
  if (classicMatches && enhancedMatches) {
    checksumField.physicalValue = 'Classic & Enhanced';
    checksumConvention = 'both';
  } else if (classicMatches) {
    checksumField.physicalValue = 'Classic';
    checksumConvention = 'classic';
  } else if (enhancedMatches) {
    checksumField.physicalValue = 'Enhanced';
    checksumConvention = 'enhanced';
  } else {
    checksumConvention = 'none';
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: 1,
      details: { classicChecksum, enhancedChecksum, checksumByte },
    });
  }
  fields.push(checksumField);

  const summaryParams: Record<string, string> = {
    id: String(id),
    dataLength: String(dataLength),
  };

  const metadata: LinFrameMetadata = {
    id,
    checksumConvention,
    summaryKey: SUMMARY_FRAME,
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

export function parseLin(data: Uint8Array): ParseResult {
  return parseLinFrame(data, {});
}

export const linParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: uzunluk aralığı + Sync baytının 0x55 olması. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH || data.length > MAX_FRAME_LENGTH) {
      return false;
    }
    return byteAt(data, 0) === SYNC_BYTE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: LinParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseLinFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. Spec §43 LIN için doğrulanmış fixture VERMİYOR (dosya
 * başı) — baytlar gerçek motorla (parity/checksum formülleriyle) hesaplandı,
 * uydurulmadı.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-classic-checksum',
    name: 'protocol.lin.example.validClassicChecksum.name',
    // ID 0x01 → PID 0xC1 (P0=1,P1=1). Veri 12 34, klasik checksum 0xB9.
    bytes: new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xb9]),
    description: 'protocol.lin.example.validClassicChecksum.description',
    expectedValid: true,
  },
  {
    id: 'valid-enhanced-checksum',
    name: 'protocol.lin.example.validEnhancedChecksum.name',
    // Aynı PID/veri, checksum 0xF7 (PID dahil) — yalnız geliştirilmişle eşleşir.
    bytes: new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xf7]),
    description: 'protocol.lin.example.validEnhancedChecksum.description',
    expectedValid: true,
  },
  {
    id: 'zero-data',
    name: 'protocol.lin.example.zeroData.name',
    // Veri baytı yok: klasik checksum boş toplam üzerinden 0xFF'dir.
    bytes: new Uint8Array([0x55, 0xc1, 0xff]),
    description: 'protocol.lin.example.zeroData.description',
    expectedValid: true,
  },
  {
    id: 'parity-mismatch',
    name: 'protocol.lin.example.parityMismatch.name',
    // Aynı ID (0x01) ama parity bitleri sıfırlanmış — PID 0x01.
    bytes: new Uint8Array([0x55, 0x01, 0x12, 0x34, 0xb9]),
    description: 'protocol.lin.example.parityMismatch.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch-rejected',
    name: 'protocol.lin.example.checksumMismatchRejected.name',
    bytes: new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0x00]),
    description: 'protocol.lin.example.checksumMismatchRejected.description',
    expectedValid: false,
  },
  {
    id: 'invalid-sync-rejected',
    name: 'protocol.lin.example.invalidSyncRejected.name',
    bytes: new Uint8Array([0x00, 0xc1, 0x12, 0x34, 0xb9]),
    description: 'protocol.lin.example.invalidSyncRejected.description',
    expectedValid: false,
  },
];

export const linPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: linParser,
  documentation: {
    summary: 'protocol.lin.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
