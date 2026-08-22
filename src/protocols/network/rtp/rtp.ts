/**
 * RTP (Real-time Transport Protocol, RFC 3550 §5) — audio/video/simülasyon
 * verisi için payload-type kimliği, sıra numarası, zaman damgası ve SSRC.
 * Girdi TEK bir RTP paketidir; UDP sarmalayıcısı YOK (dosya boyunca tekrar
 * eden karar: motorlar zincir kurmaz, `icmpv6.ts`/`coap.ts` ile aynı çizgi).
 *
 * ── PAYLOAD TYPE: STATİK TABLO, SDP TAHMİNİ YOK ──────────────────────────────
 * RFC 3551 §6 sabit PT ataması (0-95 arası bilinenler) doğrudan gösterilir.
 * Brief (`docs/brief-faz10-dalga12.md:122`) "SDP dışarıda kalır, tabloda yok"
 * diyor — 96-127 dinamik aralığı VE 0-95 arasının atanmamış/rezerve kalanı
 * (1,2,19-24,27,29,30,35-95) codec ADI TAHMİN EDİLMEDEN uyarıyla bırakılır.
 * Spec'in kendi örneği birebir uygulanıyor (`08-ag-ethernet.md:566`):
 * "Payload Type:96 → Mapping: Unknown unless SDP/profile supplied".
 * Bu yüzden `decodeOptions` kanalı AÇILMADI: kullanıcıdan codec sorup
 * yanıtı tabloya yazmak spec'in yasakladığı tahmini dolaylı yoldan yapmak
 * olurdu (brief'teki kanal adayı bilerek kullanılmadı).
 *
 * ── TIMESTAMP/SSRC: TEK PAKETTEN ÖTESİ HESAPLANMAZ ───────────────────────────
 * RTP Timestamp wall-clock DEĞİLDİR (payload clock domain'i, ClockRate SDP'den
 * gelir) — ham gösterilir, saniyeye ÇEVRİLMEZ. Sequence Number Gap / Packet
 * Loss / Jitter Estimator (katalogdaki `tools` listesi) çok paketlik korelasyon
 * ister ve PARSER'IN değil, ileride yazılacak bir calculator'ın işidir — aynı
 * gerekçe PTP'nin BMCA'sını (`ptp.ts`) ve DNS'in Transaction Matching'ini
 * (`dns.ts`) da parser dışında bırakmıştı (dalga 12c/12d kararı).
 *
 * ── HEADER EXTENSION: RFC 8285 ELEMANLARI ÇÖZÜLMEZ ───────────────────────────
 * X=1 ise 16-bit "defined by profile" + 16-bit uzunluk (32-bit kelime) + veri
 * okunur ama profil ALANI YORUMLANMAZ (RFC 8285'in one-byte/two-byte header
 * eleman biçimleri spec dokümanında YOK, uydurulmadı) — ham bayt olarak kalır.
 *
 * ── PADDING: SON BAYT KENDİNİ DE SAYAR ───────────────────────────────────────
 * P=1 ise son bayt "kaç dolgu baytı (kendisi dâhil) yok sayılmalı" der
 * (RFC 3550 §5.1) — RTCP'nin aynı kuralı (`rtcp.ts`) burada da geçerli.
 * Sayı 0 ya da kalan alandan büyükse `value-out-of-range`: uydurma bir payload
 * sınırı çizmek yerine hata basılır.
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

const PROTOCOL_ID = 'rtp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RTP';

const FIXED_HEADER_LENGTH = 12;
const CSRC_ITEM_LENGTH = 4;
const EXTENSION_HEADER_LENGTH = 4;
const EXTENSION_WORD_LENGTH = 4;

const VERSION_BIT_POSITION = 0;
const VERSION_BIT_LENGTH = 2;
const PADDING_BIT_POSITION = 2;
const PADDING_BIT_LENGTH = 1;
const EXTENSION_BIT_POSITION = 3;
const EXTENSION_BIT_LENGTH = 1;
const CSRC_COUNT_BIT_POSITION = 4;
const CSRC_COUNT_BIT_LENGTH = 4;
const MARKER_BIT_POSITION = 8;
const MARKER_BIT_LENGTH = 1;
const PAYLOAD_TYPE_BIT_POSITION = 9;
const PAYLOAD_TYPE_BIT_LENGTH = 7;

const SEQUENCE_NUMBER_OFFSET = 2;
const SEQUENCE_NUMBER_LENGTH = 2;
const TIMESTAMP_OFFSET = 4;
const TIMESTAMP_LENGTH = 4;
const SSRC_OFFSET = 8;
const SSRC_LENGTH = 4;

const EXPECTED_VERSION = 2;

const ERROR_HEADER_TRUNCATED = 'protocol.rtp.error.headerTruncated';
const ERROR_CSRC_TRUNCATED = 'protocol.rtp.error.csrcTruncated';
const ERROR_EXTENSION_TRUNCATED = 'protocol.rtp.error.extensionTruncated';
const ERROR_PADDING_INVALID = 'protocol.rtp.error.paddingInvalid';
const ERROR_FRAME_TOO_LONG = 'protocol.rtp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.rtp.error.aborted';

const WARN_VERSION_UNEXPECTED = 'protocol.rtp.warning.versionUnexpected';
const WARN_PAYLOAD_TYPE_UNRESOLVED = 'protocol.rtp.warning.payloadTypeUnresolved';

/**
 * RFC 3551 §6 sabit atama tablosu. Yalnız GERÇEKTEN atanmış numaralar var —
 * rezerve/atanmamış (1,2,19-24,27,29,30,35-95) ve dinamik (96-127) aralık
 * bilinçli olarak DIŞARIDA, dosya başındaki karar gereği.
 */
const STATIC_PAYLOAD_TYPES: ReadonlyMap<number, string> = new Map([
  [0, 'PCMU (8000 Hz, mono)'],
  [3, 'GSM (8000 Hz, mono)'],
  [4, 'G723 (8000 Hz, mono)'],
  [5, 'DVI4 (8000 Hz, mono)'],
  [6, 'DVI4 (16000 Hz, mono)'],
  [7, 'LPC (8000 Hz, mono)'],
  [8, 'PCMA (8000 Hz, mono)'],
  [9, 'G722 (8000 Hz, mono)'],
  [10, 'L16 (44100 Hz, stereo)'],
  [11, 'L16 (44100 Hz, mono)'],
  [12, 'QCELP (8000 Hz, mono)'],
  [13, 'CN (8000 Hz, mono)'],
  [14, 'MPA (90000 Hz)'],
  [15, 'G728 (8000 Hz, mono)'],
  [16, 'DVI4 (11025 Hz, mono)'],
  [17, 'DVI4 (22050 Hz, mono)'],
  [18, 'G729 (8000 Hz, mono)'],
  [25, 'CelB (90000 Hz)'],
  [26, 'JPEG (90000 Hz)'],
  [28, 'nv (90000 Hz)'],
  [31, 'H261 (90000 Hz)'],
  [32, 'MPV (90000 Hz)'],
  [33, 'MP2T (90000 Hz)'],
  [34, 'H263 (90000 Hz)'],
]);

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

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

interface RtpParseOptions {
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
  options: RtpParseOptions,
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

function parseRtpFrame(data: Uint8Array, options: RtpParseOptions): ParseResult {
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

  if (data.length < FIXED_HEADER_LENGTH) {
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const version = readBitsAsNumber(data, VERSION_BIT_POSITION, VERSION_BIT_LENGTH);
  const versionValid = version === EXPECTED_VERSION;
  const versionField: ParsedField = {
    id: 'version',
    name: 'Version',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: version,
    valid: versionValid,
    warnings: [],
  };
  if (!versionValid) {
    versionField.warnings.push(WARN_VERSION_UNEXPECTED);
    warnings.push(toProtocolWarning(WARN_VERSION_UNEXPECTED));
  }
  fields.push(versionField);

  const padding = readBitsAsNumber(data, PADDING_BIT_POSITION, PADDING_BIT_LENGTH);
  fields.push({
    id: 'padding',
    name: 'Padding',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: padding,
    physicalValue: padding === 1 ? 'Present' : 'Absent',
    valid: true,
    warnings: [],
  });

  const extension = readBitsAsNumber(data, EXTENSION_BIT_POSITION, EXTENSION_BIT_LENGTH);
  fields.push({
    id: 'extension',
    name: 'Extension',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: extension,
    physicalValue: extension === 1 ? 'Present' : 'Absent',
    valid: true,
    warnings: [],
  });

  const csrcCount = readBitsAsNumber(data, CSRC_COUNT_BIT_POSITION, CSRC_COUNT_BIT_LENGTH);
  fields.push({
    id: 'csrc-count',
    name: 'CSRC Count',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: csrcCount,
    valid: true,
    warnings: [],
  });

  const marker = readBitsAsNumber(data, MARKER_BIT_POSITION, MARKER_BIT_LENGTH);
  fields.push({
    id: 'marker',
    name: 'Marker',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: marker,
    physicalValue: marker === 1 ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });

  const payloadType = readBitsAsNumber(data, PAYLOAD_TYPE_BIT_POSITION, PAYLOAD_TYPE_BIT_LENGTH);
  const codecName = STATIC_PAYLOAD_TYPES.get(payloadType);
  const payloadTypeField: ParsedField = {
    id: 'payload-type',
    name: 'Payload Type',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: payloadType,
    valid: true,
    warnings: [],
  };
  if (codecName !== undefined) {
    payloadTypeField.physicalValue = codecName;
  } else {
    payloadTypeField.warnings.push(WARN_PAYLOAD_TYPE_UNRESOLVED);
    warnings.push(toProtocolWarning(WARN_PAYLOAD_TYPE_UNRESOLVED));
  }
  fields.push(payloadTypeField);

  const sequenceNumber = readUint16BE(data, SEQUENCE_NUMBER_OFFSET);
  fields.push({
    id: 'sequence-number',
    name: 'Sequence Number',
    offset: SEQUENCE_NUMBER_OFFSET,
    length: SEQUENCE_NUMBER_LENGTH,
    rawBytes: data.slice(SEQUENCE_NUMBER_OFFSET, SEQUENCE_NUMBER_OFFSET + SEQUENCE_NUMBER_LENGTH),
    rawValue: sequenceNumber,
    valid: true,
    warnings: [],
  });

  const timestamp = readUint32BE(data, TIMESTAMP_OFFSET);
  fields.push({
    id: 'timestamp',
    name: 'Timestamp',
    offset: TIMESTAMP_OFFSET,
    length: TIMESTAMP_LENGTH,
    rawBytes: data.slice(TIMESTAMP_OFFSET, TIMESTAMP_OFFSET + TIMESTAMP_LENGTH),
    rawValue: timestamp,
    valid: true,
    warnings: [],
  });

  const ssrc = readUint32BE(data, SSRC_OFFSET);
  fields.push({
    id: 'ssrc',
    name: 'SSRC',
    offset: SSRC_OFFSET,
    length: SSRC_LENGTH,
    rawBytes: data.slice(SSRC_OFFSET, SSRC_OFFSET + SSRC_LENGTH),
    rawValue: ssrc,
    valid: true,
    warnings: [],
  });

  let pos = FIXED_HEADER_LENGTH;
  const csrcListEnd = pos + csrcCount * CSRC_ITEM_LENGTH;
  if (csrcListEnd > data.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CSRC_TRUNCATED,
      offset: pos,
      length: data.length - pos,
      details: { csrcCount },
    });
    return finishFrame(data, fields, warnings, errors, options);
  }
  for (let i = 0; i < csrcCount; i += 1) {
    const csrcOffset = pos + i * CSRC_ITEM_LENGTH;
    fields.push({
      id: `csrc-${String(i)}`,
      name: `CSRC[${String(i)}]`,
      offset: csrcOffset,
      length: CSRC_ITEM_LENGTH,
      rawBytes: data.slice(csrcOffset, csrcOffset + CSRC_ITEM_LENGTH),
      rawValue: readUint32BE(data, csrcOffset),
      valid: true,
      warnings: [],
    });
  }
  pos = csrcListEnd;

  if (extension === 1) {
    if (pos + EXTENSION_HEADER_LENGTH > data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_EXTENSION_TRUNCATED,
        offset: pos,
        length: data.length - pos,
      });
      return finishFrame(data, fields, warnings, errors, options);
    }
    const extensionProfile = readUint16BE(data, pos);
    fields.push({
      id: 'extension-profile',
      name: 'Header Extension Profile',
      offset: pos,
      length: 2,
      rawBytes: data.slice(pos, pos + 2),
      rawValue: extensionProfile,
      valid: true,
      warnings: [],
    });
    const extensionWordLength = readUint16BE(data, pos + 2);
    fields.push({
      id: 'extension-length',
      name: 'Header Extension Length',
      offset: pos + 2,
      length: 2,
      rawBytes: data.slice(pos + 2, pos + 4),
      rawValue: extensionWordLength,
      unit: 'words',
      valid: true,
      warnings: [],
    });
    const extensionDataOffset = pos + EXTENSION_HEADER_LENGTH;
    const extensionDataLength = extensionWordLength * EXTENSION_WORD_LENGTH;
    const extensionDataEnd = extensionDataOffset + extensionDataLength;
    if (extensionDataEnd > data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_EXTENSION_TRUNCATED,
        offset: extensionDataOffset,
        length: data.length - extensionDataOffset,
        details: { extensionWordLength },
      });
      return finishFrame(data, fields, warnings, errors, options);
    }
    if (extensionDataLength > 0) {
      fields.push({
        id: 'extension-data',
        name: 'Header Extension Data',
        offset: extensionDataOffset,
        length: extensionDataLength,
        rawBytes: data.slice(extensionDataOffset, extensionDataEnd),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
    pos = extensionDataEnd;
  }

  const bodyStart = pos;
  if (padding === 1) {
    if (bodyStart >= data.length) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_PADDING_INVALID,
        offset: bodyStart,
        length: 0,
      });
      return finishFrame(data, fields, warnings, errors, options);
    }
    const padCount = byteAt(data, data.length - 1);
    const remaining = data.length - bodyStart;
    if (padCount === 0 || padCount > remaining) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_PADDING_INVALID,
        offset: data.length - 1,
        length: 1,
        details: { padCount, remaining },
      });
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: bodyStart,
        length: remaining,
        rawBytes: data.slice(bodyStart, data.length),
        unit: 'B',
        valid: false,
        warnings: [ERROR_PADDING_INVALID],
      });
      return finishFrame(data, fields, warnings, errors, options);
    }
    const payloadLength = remaining - padCount;
    if (payloadLength > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: bodyStart,
        length: payloadLength,
        rawBytes: data.slice(bodyStart, bodyStart + payloadLength),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
    fields.push({
      id: 'padding-bytes',
      name: 'Padding Bytes',
      offset: bodyStart + payloadLength,
      length: padCount,
      rawBytes: data.slice(bodyStart + payloadLength, data.length),
      rawValue: padCount,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  } else if (data.length > bodyStart) {
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: bodyStart,
      length: data.length - bodyStart,
      rawBytes: data.slice(bodyStart, data.length),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  return finishFrame(data, fields, warnings, errors, options);
}

export function parseRtp(data: Uint8Array): ParseResult {
  return parseRtpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): RtpParseOptions {
  const options: RtpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const rtpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari sabit başlık uzunluğu + versiyon 2. */
  canParse(data: Uint8Array): boolean {
    if (data.length < FIXED_HEADER_LENGTH) return false;
    return readBitsAsNumber(data, VERSION_BIT_POSITION, VERSION_BIT_LENGTH) === EXPECTED_VERSION;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseRtpFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'basic-audio',
    name: 'protocol.rtp.example.basicAudio.name',
    // V2, P0, X0, CC0, M0, PT0 (PCMU), Seq 0x1234, TS 3000, SSRC 0x12345678.
    bytes: Uint8Array.from([
      0x80, 0x00, 0x12, 0x34, 0x00, 0x00, 0x0b, 0xb8, 0x12, 0x34, 0x56, 0x78, 0xff, 0xff, 0xff, 0xff,
    ]),
    description: 'protocol.rtp.example.basicAudio.description',
    expectedValid: true,
  },
  {
    id: 'video-marker-csrc',
    name: 'protocol.rtp.example.videoMarkerCsrc.name',
    // V2, M1 (frame sonu), PT96 (dinamik — codec adı ÇÖZÜLMEZ), CC2 (mixer).
    bytes: Uint8Array.from([
      0x82, 0xe0, 0x00, 0x01, 0x00, 0x01, 0x5f, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x11, 0x11, 0x11,
      0x22, 0x22, 0x22, 0x22, 0x01, 0x02, 0x03,
    ]),
    description: 'protocol.rtp.example.videoMarkerCsrc.description',
    expectedValid: true,
  },
  {
    id: 'extension-and-padding',
    name: 'protocol.rtp.example.extensionAndPadding.name',
    // V2, P1, X1, PT8 (PCMA), RFC 8285 profil 0xBEDE + 1 kelime veri, 2 baytlık
    // payload + 3 baytlık dolgu (son bayt kendini de sayar).
    bytes: Uint8Array.from([
      0xb0, 0x08, 0x00, 0x02, 0x00, 0x00, 0x0f, 0xa0, 0x87, 0x65, 0x43, 0x21, 0xbe, 0xde, 0x00, 0x01,
      0x10, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0x00, 0x00, 0x03,
    ]),
    description: 'protocol.rtp.example.extensionAndPadding.description',
    expectedValid: true,
  },
  {
    id: 'invalid-padding-count',
    name: 'protocol.rtp.example.invalidPaddingCount.name',
    // P1 ama son bayt 5 diyor, gövdede yalnız 1 bayt var — dolgu sayısı kalan
    // alandan büyük, RFC 3550 §5.1 ihlali.
    bytes: Uint8Array.from([
      0xa0, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05,
    ]),
    description: 'protocol.rtp.example.invalidPaddingCount.description',
    expectedValid: false,
  },
];

export const rtpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: rtpParser,
  documentation: {
    summary: 'protocol.rtp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
