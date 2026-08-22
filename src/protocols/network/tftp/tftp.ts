/**
 * TFTP (Trivial File Transfer Protocol, RFC 1350) — UDP üzerinde lock-step
 * dosya aktarımı: her DATA bloğu ayrı bir ACK ister. Girdi TEK bir TFTP
 * paketidir; UDP sarmalayıcısı YOK (dosya boyunca tekrar eden karar —
 * `rtp.ts`/`icmpv6.ts` ile aynı çizgi, motorlar zincir kurmaz).
 *
 * ── OPTION EXTENSION: RRQ/WRQ VE OACK AYNI TEKRAR EDEN ÇİFTİ PAYLAŞIR ────────
 * RFC 2347 option extension'ı RRQ/WRQ'nun Filename+Mode'undan SONRA, OACK'ın
 * İSE baştan itibaren aynı "isim(null) değer(null) …" tekrarını taşır — bu
 * GERÇEK bir paylaşım (dnsWire.ts/ntpTimestamp.ts'nin aynı cinsi), tek bir
 * `pushOptionPairs` yardımcısı ikisine de hizmet eder.
 *
 * ── BLOCK SIZE: TEK PAKETTEN BİLİNEMEZ, KLASİK 512 VARSAYIMI UYARIYLA ────────
 * "Final Block" kararı negotiated block size'a bakar (RFC 2348), ama o
 * pazarlık RRQ/WRQ'nun OACK yanıtında geçer — DATA paketi TEK BAŞINA hangi
 * block size'ın negotiate edildiğini BİLEMEZ. Spec'in kendi örneği (`:630`)
 * klasik 512 baytlık varsayılan üzerinden "Continue"/"Final Block" veriyor;
 * bu dosya aynı varsayımı uygular ama 512 baytı DOLDURAN bloklarda (OACK
 * farklı bir boyut negotiate etmiş OLABİLİR) açık bir uyarıyla işaretler —
 * yalnız 512'den KISA bloklar (her block size'da "bitti" demektir) kesin.
 *
 * ── HATA KODLARI: RFC 1350 §5 KAPALI KÜME, ÖTESİ TANIMSIZDIR ─────────────────
 * 0-7 dışı bir Error Code RFC'nin kendisinde tanımsızdır — uydurma anlam
 * verilmez, ham gösterilip uyarılır (coap'ın "tanınmayan option" kararının
 * aynı cinsi).
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

const PROTOCOL_ID = 'tftp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'TFTP';

const OPCODE_LENGTH = 2;
const OPCODE_RRQ = 1;
const OPCODE_WRQ = 2;
const OPCODE_DATA = 3;
const OPCODE_ACK = 4;
const OPCODE_ERROR = 5;
const OPCODE_OACK = 6;

const OPCODE_NAMES: ReadonlyMap<number, string> = new Map([
  [OPCODE_RRQ, 'RRQ (Read Request)'],
  [OPCODE_WRQ, 'WRQ (Write Request)'],
  [OPCODE_DATA, 'DATA'],
  [OPCODE_ACK, 'ACK'],
  [OPCODE_ERROR, 'ERROR'],
  [OPCODE_OACK, 'OACK (Option Acknowledgment)'],
]);

const BLOCK_NUMBER_LENGTH = 2;
const ERROR_CODE_LENGTH = 2;
const CLASSIC_DEFAULT_BLOCK_SIZE = 512;
const NUL = 0x00;

const KNOWN_MODES = new Set(['netascii', 'octet', 'mail']);

/** RFC 1350 §5 — kapalı küme, 0-7 dışı tanımsızdır (dosya başı). */
const ERROR_CODE_MEANINGS: ReadonlyMap<number, string> = new Map([
  [0, 'Not defined, see error message'],
  [1, 'File not found'],
  [2, 'Access violation'],
  [3, 'Disk full or allocation exceeded'],
  [4, 'Illegal TFTP operation'],
  [5, 'Unknown transfer ID'],
  [6, 'File already exists'],
  [7, 'No such user'],
]);

const ERROR_HEADER_TRUNCATED = 'protocol.tftp.error.headerTruncated';
const ERROR_UNSUPPORTED_OPCODE = 'protocol.tftp.error.unsupportedOpcode';
const ERROR_STRING_UNTERMINATED = 'protocol.tftp.error.stringUnterminated';
const ERROR_FRAME_TOO_LONG = 'protocol.tftp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.tftp.error.aborted';

const WARN_UNSUPPORTED_MODE = 'protocol.tftp.warning.unsupportedMode';
const WARN_UNKNOWN_ERROR_CODE = 'protocol.tftp.warning.unknownErrorCode';
const WARN_BLOCK_SIZE_ASSUMED = 'protocol.tftp.warning.blockSizeAssumed';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

/** Sonraki NUL baytına kadarki metni döner; bulunamazsa `undefined`. */
function readNulTerminatedString(
  data: Uint8Array,
  offset: number,
): { text: string; nextOffset: number; length: number } | undefined {
  const nulIndex = data.indexOf(NUL, offset);
  if (nulIndex === -1) return undefined;
  return {
    text: textDecoder.decode(data.slice(offset, nulIndex)),
    nextOffset: nulIndex + 1,
    length: nulIndex - offset,
  };
}

/**
 * RRQ/WRQ'nun Filename+Mode SONRASI ve OACK'ın BAŞTAN İTİBAREN paylaştığı
 * tekrar eden "isim(NUL) değer(NUL) …" dizisi (dosya başı — RFC 2347).
 */
function pushOptionPairs(
  data: Uint8Array,
  startPos: number,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  let pos = startPos;
  let pairIndex = 0;
  while (pos < data.length) {
    const name = readNulTerminatedString(data, pos);
    if (name === undefined) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_STRING_UNTERMINATED,
        offset: pos,
        length: data.length - pos,
        details: { field: 'option-name', pairIndex },
      });
      return;
    }
    fields.push({
      id: `option-name-${String(pos)}`,
      name: 'Option Name',
      offset: pos,
      length: name.length,
      rawBytes: data.slice(pos, pos + name.length),
      physicalValue: name.text,
      valid: true,
      warnings: [],
    });

    const value = readNulTerminatedString(data, name.nextOffset);
    if (value === undefined) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_STRING_UNTERMINATED,
        offset: name.nextOffset,
        length: data.length - name.nextOffset,
        details: { field: 'option-value', pairIndex },
      });
      return;
    }
    fields.push({
      id: `option-value-${String(name.nextOffset)}`,
      name: 'Option Value',
      offset: name.nextOffset,
      length: value.length,
      rawBytes: data.slice(name.nextOffset, name.nextOffset + value.length),
      physicalValue: value.text,
      valid: true,
      warnings: [],
    });

    pos = value.nextOffset;
    pairIndex += 1;
  }
}

function pushReadOrWriteRequest(
  data: Uint8Array,
  fields: ParsedField[],
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
): void {
  const filename = readNulTerminatedString(data, OPCODE_LENGTH);
  if (filename === undefined) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_STRING_UNTERMINATED,
      offset: OPCODE_LENGTH,
      length: data.length - OPCODE_LENGTH,
      details: { field: 'filename' },
    });
    return;
  }
  fields.push({
    id: 'filename',
    name: 'Filename',
    offset: OPCODE_LENGTH,
    length: filename.length,
    rawBytes: data.slice(OPCODE_LENGTH, OPCODE_LENGTH + filename.length),
    physicalValue: filename.text,
    valid: true,
    warnings: [],
  });

  const mode = readNulTerminatedString(data, filename.nextOffset);
  if (mode === undefined) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_STRING_UNTERMINATED,
      offset: filename.nextOffset,
      length: data.length - filename.nextOffset,
      details: { field: 'mode' },
    });
    return;
  }
  const modeRecognized = KNOWN_MODES.has(mode.text.toLowerCase());
  const modeField: ParsedField = {
    id: 'mode',
    name: 'Mode',
    offset: filename.nextOffset,
    length: mode.length,
    rawBytes: data.slice(filename.nextOffset, filename.nextOffset + mode.length),
    physicalValue: mode.text,
    valid: modeRecognized,
    warnings: [],
  };
  if (!modeRecognized) {
    modeField.warnings.push(WARN_UNSUPPORTED_MODE);
    warnings.push(toProtocolWarning(WARN_UNSUPPORTED_MODE));
  }
  fields.push(modeField);

  pushOptionPairs(data, mode.nextOffset, fields, errors);
}

function pushData(data: Uint8Array, fields: ParsedField[], warnings: ProtocolWarning[]): void {
  const blockNumber = readUint16BE(data, OPCODE_LENGTH);
  fields.push({
    id: 'block-number',
    name: 'Block Number',
    offset: OPCODE_LENGTH,
    length: BLOCK_NUMBER_LENGTH,
    rawBytes: data.slice(OPCODE_LENGTH, OPCODE_LENGTH + BLOCK_NUMBER_LENGTH),
    rawValue: blockNumber,
    valid: true,
    warnings: [],
  });

  const payloadOffset = OPCODE_LENGTH + BLOCK_NUMBER_LENGTH;
  const payload = data.slice(payloadOffset);
  if (payload.length > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: payloadOffset,
      length: payload.length,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const isFinal = payload.length < CLASSIC_DEFAULT_BLOCK_SIZE;
  const transferStateField: ParsedField = {
    id: 'transfer-state',
    name: 'Transfer State',
    offset: payloadOffset,
    length: payload.length,
    rawBytes: new Uint8Array(0),
    physicalValue: isFinal ? 'Final Block' : 'Continue',
    valid: true,
    warnings: [],
  };
  if (!isFinal) {
    transferStateField.warnings.push(WARN_BLOCK_SIZE_ASSUMED);
    warnings.push(toProtocolWarning(WARN_BLOCK_SIZE_ASSUMED));
  }
  fields.push(transferStateField);
}

function pushAck(data: Uint8Array, fields: ParsedField[]): void {
  fields.push({
    id: 'block-number',
    name: 'Block Number',
    offset: OPCODE_LENGTH,
    length: BLOCK_NUMBER_LENGTH,
    rawBytes: data.slice(OPCODE_LENGTH, OPCODE_LENGTH + BLOCK_NUMBER_LENGTH),
    rawValue: readUint16BE(data, OPCODE_LENGTH),
    valid: true,
    warnings: [],
  });
}

function pushError(
  data: Uint8Array,
  fields: ParsedField[],
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
): void {
  const errorCode = readUint16BE(data, OPCODE_LENGTH);
  const meaning = ERROR_CODE_MEANINGS.get(errorCode);
  const errorCodeField: ParsedField = {
    id: 'error-code',
    name: 'Error Code',
    offset: OPCODE_LENGTH,
    length: ERROR_CODE_LENGTH,
    rawBytes: data.slice(OPCODE_LENGTH, OPCODE_LENGTH + ERROR_CODE_LENGTH),
    rawValue: errorCode,
    valid: true,
    warnings: [],
  };
  if (meaning !== undefined) {
    errorCodeField.physicalValue = meaning;
  } else {
    errorCodeField.warnings.push(WARN_UNKNOWN_ERROR_CODE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_ERROR_CODE));
  }
  fields.push(errorCodeField);

  const messageOffset = OPCODE_LENGTH + ERROR_CODE_LENGTH;
  const message = readNulTerminatedString(data, messageOffset);
  if (message === undefined) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_STRING_UNTERMINATED,
      offset: messageOffset,
      length: data.length - messageOffset,
      details: { field: 'error-message' },
    });
    return;
  }
  fields.push({
    id: 'error-message',
    name: 'Error Message',
    offset: messageOffset,
    length: message.length,
    rawBytes: data.slice(messageOffset, messageOffset + message.length),
    physicalValue: message.text,
    valid: true,
    warnings: [],
  });
}

interface TftpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: TftpParseOptions,
): ParseResult {
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

function parseTftpFrame(data: Uint8Array, options: TftpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
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

  if (data.length < OPCODE_LENGTH) {
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

  const opcode = readUint16BE(data, 0);
  const opcodeName = OPCODE_NAMES.get(opcode);
  if (opcodeName === undefined) {
    return {
      success: false,
      error: {
        code: 'unsupported-function-code',
        message: ERROR_UNSUPPORTED_OPCODE,
        offset: 0,
        length: OPCODE_LENGTH,
        details: { opcode },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'opcode',
    name: 'Opcode',
    offset: 0,
    length: OPCODE_LENGTH,
    rawBytes: data.slice(0, OPCODE_LENGTH),
    rawValue: opcode,
    physicalValue: opcodeName,
    valid: true,
    warnings: [],
  });

  switch (opcode) {
    case OPCODE_RRQ:
    case OPCODE_WRQ:
      pushReadOrWriteRequest(data, fields, errors, warnings);
      break;
    case OPCODE_DATA:
      pushData(data, fields, warnings);
      break;
    case OPCODE_ACK:
      pushAck(data, fields);
      break;
    case OPCODE_ERROR:
      pushError(data, fields, errors, warnings);
      break;
    case OPCODE_OACK:
      pushOptionPairs(data, OPCODE_LENGTH, fields, errors);
      break;
    default:
      break;
  }

  return finishFrame(data, fields, warnings, errors, options);
}

export function parseTftp(data: Uint8Array): ParseResult {
  return parseTftpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): TftpParseOptions {
  const options: TftpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const tftpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari 2 bayt + tanınan bir Opcode (1-6). */
  canParse(data: Uint8Array): boolean {
    if (data.length < OPCODE_LENGTH) return false;
    return OPCODE_NAMES.has(readUint16BE(data, 0));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseTftpFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-request',
    name: 'protocol.tftp.example.readRequest.name',
    // RRQ "firmware.bin" octet — pazarlıksız klasik RRQ.
    bytes: Uint8Array.from([
      0x00, 0x01, 0x66, 0x69, 0x72, 0x6d, 0x77, 0x61, 0x72, 0x65, 0x2e, 0x62, 0x69, 0x6e, 0x00, 0x6f,
      0x63, 0x74, 0x65, 0x74, 0x00,
    ]),
    description: 'protocol.tftp.example.readRequest.description',
    expectedValid: true,
  },
  {
    id: 'read-request-with-options',
    name: 'protocol.tftp.example.readRequestWithOptions.name',
    // RRQ "boot.img" octet + blksize=1024 option extension (RFC 2347/2348).
    bytes: Uint8Array.from([
      0x00, 0x01, 0x62, 0x6f, 0x6f, 0x74, 0x2e, 0x69, 0x6d, 0x67, 0x00, 0x6f, 0x63, 0x74, 0x65, 0x74,
      0x00, 0x62, 0x6c, 0x6b, 0x73, 0x69, 0x7a, 0x65, 0x00, 0x31, 0x30, 0x32, 0x34, 0x00,
    ]),
    description: 'protocol.tftp.example.readRequestWithOptions.description',
    expectedValid: true,
  },
  {
    id: 'data-continue',
    name: 'protocol.tftp.example.dataContinue.name',
    // DATA block 1, 512 baytlık tam blok — klasik varsayımla "Continue" (uyarılı).
    bytes: Uint8Array.from([0x00, 0x03, 0x00, 0x01, ...new Array<number>(512).fill(0xaa)]),
    description: 'protocol.tftp.example.dataContinue.description',
    expectedValid: true,
  },
  {
    id: 'data-final-block',
    name: 'protocol.tftp.example.dataFinalBlock.name',
    // DATA block 2, 3 baytlık kısa blok — her block size'da "bitti" demektir.
    bytes: Uint8Array.from([0x00, 0x03, 0x00, 0x02, 0x61, 0x62, 0x63]),
    description: 'protocol.tftp.example.dataFinalBlock.description',
    expectedValid: true,
  },
  {
    id: 'ack',
    name: 'protocol.tftp.example.ack.name',
    bytes: Uint8Array.from([0x00, 0x04, 0x00, 0x01]),
    description: 'protocol.tftp.example.ack.description',
    expectedValid: true,
  },
  {
    id: 'error-file-not-found',
    name: 'protocol.tftp.example.errorFileNotFound.name',
    bytes: Uint8Array.from([
      0x00, 0x05, 0x00, 0x01, 0x46, 0x69, 0x6c, 0x65, 0x20, 0x6e, 0x6f, 0x74, 0x20, 0x66, 0x6f, 0x75,
      0x6e, 0x64, 0x00,
    ]),
    description: 'protocol.tftp.example.errorFileNotFound.description',
    expectedValid: true,
  },
];

export const tftpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: tftpParser,
  documentation: {
    summary: 'protocol.tftp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
