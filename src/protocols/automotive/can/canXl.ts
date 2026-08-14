/**
 * CAN XL çerçeve İNCELEYİCİSİ — `struct canxl_frame` (SocketCAN).
 *
 * KAPSAM BİLİNÇLİ OLARAK DAR: spec ilk sürüm için tam stack yerine yalnız
 * "frame-level inspection" istiyor ve katalog kaydı da bunu yansıtıyor
 * (`can-xl` sekmelerinde `build`/`timing`/`diagnostics` YOK). Bu dosya o sınırın
 * içinde kalır: alanlar okunur ve gösterilir, protokol davranışı modellenmez.
 *
 * CAN XL'in klasik CAN'den KAVRAMSAL farkı, alan listesinden daha önemlidir:
 * klasik CAN'de identifier hem önceliği hem içeriği taşırdı; CAN XL bunu ikiye
 * ayırır — 11-bit Priority ID yalnız arbitrasyon içindir, içerik/adres bilgisi
 * 32-bit Acceptance Field'a taşınır. İkisini tek "CAN ID" satırında birleştirmek
 * bu ayrımı görünmez kılardı, bu yüzden ayrı alanlar olarak basılır.
 *
 * ── BAYT DÜZENİ ─────────────────────────────────────────────────────────────
 *   prio(4, little-endian) | flags(1) | sdt(1) | len(2, little-endian) |
 *   af(4, little-endian)   | data[len]                    → 12 bayt başlık
 *
 * `prio` alanı iki şey taşır: düşük 11 bit Priority ID, 16-23. bitler VCID
 * (Virtual CAN Network ID). Maskelenmezse priority 65536'ları aşan sayılar
 * olarak okunur.
 *
 * TUZAK — SPEC BİT GENİŞLİKLERİNİ VERMİYOR: FTYP ve SEC alanları spec'te yalnız
 * İSİM olarak geçiyor, bit genişlikleri ve konumları yok. Bu yüzden `flags`
 * baytı ham olarak gösterilir ve yalnız SocketCAN'in belgelediği iki bit
 * (XLF, SEC) adlandırılır; kalanı uydurulmaz.
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

import { formatHex, readUint16Le, readUint32Le } from './canFrame';

const PROTOCOL_ID = 'can-xl';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CAN XL';

/** `struct canxl_frame` başlığı: prio + flags + sdt + len + af. */
export const CAN_XL_HEADER_LENGTH = 12;
/** Spec: veri alanı 1–2048 bayt. Sıfır uzunluklu CAN XL çerçevesi yoktur. */
export const CAN_XL_MIN_PAYLOAD = 1;
export const CAN_XL_MAX_PAYLOAD = 2048;

const PRIO_OFFSET = 0;
const FLAGS_OFFSET = 4;
const SDT_OFFSET = 5;
const LEN_OFFSET = 6;
const AF_OFFSET = 8;

/** Priority ID `prio`nun düşük 11 bitinde; VCID 16-23. bitlerde. */
const CAN_XL_PRIO_MASK = 0x7ff;
const CAN_XL_VCID_SHIFT = 16;
const CAN_XL_VCID_MASK = 0xff;

/** SocketCAN'in belgelediği iki bayrak biti. */
const CANXL_XLF_FLAG = 0x80;
const CANXL_SEC_FLAG = 0x01;

const HEX_DIGITS_BYTE = 2;
const HEX_DIGITS_WORD = 4;
const HEX_DIGITS_DWORD = 8;

const ERROR_FRAME_TOO_SHORT = 'protocol.can.xl.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.can.xl.error.frameTooLong';
const ERROR_LENGTH_OUT_OF_RANGE = 'protocol.can.xl.error.lengthOutOfRange';
const ERROR_ABORTED = 'protocol.can.xl.error.aborted';

const WARN_MISSING_XLF_FLAG = 'protocol.can.xl.warning.missingXlfFlag';
const WARN_TRUNCATED_PAYLOAD = 'protocol.can.xl.warning.truncatedPayload';
const WARN_TRAILING_BYTES = 'protocol.can.xl.warning.trailingBytes';

const SUMMARY_FRAME = 'protocol.can.xl.summary.frame';

export type CanXlFrameMetadata = {
  priorityId: number;
  vcid: number;
  acceptanceField: number;
  sdt: number;
  simpleExtendedContent: boolean;
  payloadLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** `noUncheckedIndexedAccess`: sınır kontrolü yapılmış olsa da eleman `number | undefined`. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

interface CanXlParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseXlFrame(data: Uint8Array, options: CanXlParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_XL_HEADER_LENGTH) {
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

  const maxFrameLength = options.maxFrameLength ?? CAN_XL_HEADER_LENGTH + CAN_XL_MAX_PAYLOAD;
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

  const prio = readUint32Le(data, PRIO_OFFSET);
  const priorityId = prio & CAN_XL_PRIO_MASK;
  const vcid = (prio >>> CAN_XL_VCID_SHIFT) & CAN_XL_VCID_MASK;
  const flags = byteAt(data, FLAGS_OFFSET);
  const sdt = byteAt(data, SDT_OFFSET);
  const declaredLength = readUint16Le(data, LEN_OFFSET);
  const acceptanceField = readUint32Le(data, AF_OFFSET);

  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const fields: ParsedField[] = [];

  // Priority ve VCID AYNI `prio` alanını paylaşır ama AYRI bit aralıklarını:
  // priority düşük 11 bit (bayt 0-1), VCID 16-23. bitler (bayt 2). Her birine
  // `prio`nun dört baytını verseydik byte-viewer'da biri ötekini tamamen örter
  // ve tıklandığında hiçbir bayt vurgulanmazdı (spec §7: bit alanı kapsayan
  // bayt aralığıyla gösterilir).
  fields.push({
    id: 'priority-id',
    name: 'Priority ID',
    offset: PRIO_OFFSET,
    length: 2,
    rawBytes: data.slice(PRIO_OFFSET, PRIO_OFFSET + 2),
    rawValue: priorityId,
    physicalValue: formatHex(priorityId, HEX_DIGITS_WORD - 1),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'vcid',
    name: 'VCID',
    offset: PRIO_OFFSET + 2,
    length: 1,
    rawBytes: data.slice(PRIO_OFFSET + 2, PRIO_OFFSET + 3),
    rawValue: vcid,
    physicalValue: formatHex(vcid, HEX_DIGITS_BYTE),
    valid: true,
    warnings: [],
  });

  const flagsField: ParsedField = {
    id: 'flags',
    name: 'Flags',
    offset: FLAGS_OFFSET,
    length: 1,
    rawBytes: data.slice(FLAGS_OFFSET, FLAGS_OFFSET + 1),
    rawValue: flags,
    // Yalnız SocketCAN'in belgelediği iki bit adlandırılır; spec FTYP/SEC'in
    // bit genişliklerini vermediği için kalanı yorumlanmaz.
    physicalValue: (flags & CANXL_SEC_FLAG) === 0 ? 'XLF' : 'XLF | SEC',
    valid: true,
    warnings: [],
  };
  if ((flags & CANXL_XLF_FLAG) === 0) {
    // XLF bayrağı CAN XL çerçevesinin tanımıdır; yoksa kayıt CAN XL değildir.
    flagsField.valid = false;
    flagsField.warnings.push(WARN_MISSING_XLF_FLAG);
    warnings.push(toProtocolWarning(WARN_MISSING_XLF_FLAG));
    flagsField.physicalValue = formatHex(flags, HEX_DIGITS_BYTE);
  }
  fields.push(flagsField);

  fields.push({
    id: 'sdt',
    name: 'SDT',
    offset: SDT_OFFSET,
    length: 1,
    rawBytes: data.slice(SDT_OFFSET, SDT_OFFSET + 1),
    rawValue: sdt,
    physicalValue: formatHex(sdt, HEX_DIGITS_BYTE),
    valid: true,
    warnings: [],
  });

  const lengthField: ParsedField = {
    id: 'payload-length',
    name: 'Payload Length',
    offset: LEN_OFFSET,
    length: 2,
    rawBytes: data.slice(LEN_OFFSET, LEN_OFFSET + 2),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  const lengthInRange =
    declaredLength >= CAN_XL_MIN_PAYLOAD && declaredLength <= CAN_XL_MAX_PAYLOAD;
  if (!lengthInRange) {
    // Aralık dışı uzunluk HATA'dır ama çerçeve yine alan alan gösterilir
    // (spec §47): kullanıcı neyin bozulduğunu ancak alanları görürse anlar.
    lengthField.valid = false;
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_LENGTH_OUT_OF_RANGE,
      offset: LEN_OFFSET,
      length: 2,
      details: {
        declaredLength,
        minPayload: CAN_XL_MIN_PAYLOAD,
        maxPayload: CAN_XL_MAX_PAYLOAD,
      },
    });
  }
  fields.push(lengthField);

  fields.push({
    id: 'acceptance-field',
    name: 'Acceptance Field',
    offset: AF_OFFSET,
    length: 4,
    rawBytes: data.slice(AF_OFFSET, AF_OFFSET + 4),
    rawValue: acceptanceField,
    physicalValue: formatHex(acceptanceField, HEX_DIGITS_DWORD),
    valid: true,
    warnings: [],
  });

  const availableAfterHeader = Math.max(0, data.length - CAN_XL_HEADER_LENGTH);
  const cappedLength = Math.min(declaredLength, CAN_XL_MAX_PAYLOAD);
  const payloadLength = Math.min(cappedLength, availableAfterHeader);
  if (payloadLength < cappedLength) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }
  if (availableAfterHeader > cappedLength) {
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  if (payloadLength > 0) {
    fields.push({
      id: 'data',
      name: 'LLC Data',
      offset: CAN_XL_HEADER_LENGTH,
      length: payloadLength,
      rawBytes: data.slice(CAN_XL_HEADER_LENGTH, CAN_XL_HEADER_LENGTH + payloadLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const metadata: CanXlFrameMetadata = {
    priorityId,
    vcid,
    acceptanceField,
    sdt,
    simpleExtendedContent: (flags & CANXL_SEC_FLAG) !== 0,
    payloadLength,
    summaryKey: SUMMARY_FRAME,
    summaryParams: {
      priorityId: formatHex(priorityId, HEX_DIGITS_WORD - 1),
      vcid: formatHex(vcid, HEX_DIGITS_BYTE),
      payloadLength: String(payloadLength),
    },
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

export function parseCanXl(data: Uint8Array): ParseResult {
  return parseXlFrame(data, {});
}

export const canXlParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** UCUZ ön eleme (spec §7): yalnız uzunluk aralığı ve XLF bayrağı okunur. */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_XL_HEADER_LENGTH) return false;
    if (data.length > CAN_XL_HEADER_LENGTH + CAN_XL_MAX_PAYLOAD) return false;
    return (byteAt(data, FLAGS_OFFSET) & CANXL_XLF_FLAG) !== 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CanXlParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseXlFrame(data, options);
  },
};

/** `struct canxl_frame` üretir — little-endian sıralar tek yerde yaşasın diye. */
export function buildCanXlFrame(
  priorityId: number,
  vcid: number,
  sdt: number,
  acceptanceField: number,
  payload: readonly number[],
  flags: { simpleExtendedContent?: boolean; omitXlf?: boolean } = {},
): Uint8Array {
  const frame = new Uint8Array(CAN_XL_HEADER_LENGTH + payload.length);
  const prio = ((priorityId & CAN_XL_PRIO_MASK) | ((vcid & CAN_XL_VCID_MASK) << CAN_XL_VCID_SHIFT)) >>> 0;
  frame[0] = prio & 0xff;
  frame[1] = (prio >>> 8) & 0xff;
  frame[2] = (prio >>> 16) & 0xff;
  frame[3] = (prio >>> 24) & 0xff;
  let flagByte = flags.omitXlf === true ? 0 : CANXL_XLF_FLAG;
  if (flags.simpleExtendedContent === true) flagByte |= CANXL_SEC_FLAG;
  frame[4] = flagByte;
  frame[5] = sdt & 0xff;
  frame[6] = payload.length & 0xff;
  frame[7] = (payload.length >>> 8) & 0xff;
  const af = acceptanceField >>> 0;
  frame[8] = af & 0xff;
  frame[9] = (af >>> 8) & 0xff;
  frame[10] = (af >>> 16) & 0xff;
  frame[11] = (af >>> 24) & 0xff;
  for (let index = 0; index < payload.length; index += 1) {
    frame[CAN_XL_HEADER_LENGTH + index] = payload[index] ?? 0;
  }
  return frame;
}

function rampPayload(length: number): number[] {
  return Array.from({ length }, (_unused, index) => index & 0xff);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'xl-short-frame',
    name: 'protocol.can.xl.example.xlShortFrame.name',
    bytes: buildCanXlFrame(0x123, 0x01, 0x03, 0xdeadbeef, rampPayload(16)),
    description: 'protocol.can.xl.example.xlShortFrame.description',
    expectedValid: true,
  },
  {
    id: 'xl-large-payload',
    name: 'protocol.can.xl.example.xlLargePayload.name',
    // Klasik CAN'in 8 baytıyla kıyaslanamayacak boyut: hex tablo yerine
    // görüntüleyicinin kaydırmasını gerektiren gerçek bir CAN XL yükü.
    bytes: buildCanXlFrame(0x7ff, 0x2a, 0x01, 0x00000001, rampPayload(256)),
    description: 'protocol.can.xl.example.xlLargePayload.description',
    expectedValid: true,
  },
  {
    id: 'xl-secure-frame',
    name: 'protocol.can.xl.example.xlSecureFrame.name',
    bytes: buildCanXlFrame(0x010, 0x00, 0x05, 0xcafebabe, rampPayload(32), {
      simpleExtendedContent: true,
    }),
    description: 'protocol.can.xl.example.xlSecureFrame.description',
    expectedValid: true,
  },
];

export const canXlPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: canXlParser,
  documentation: {
    summary: 'protocol.can.xl.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
