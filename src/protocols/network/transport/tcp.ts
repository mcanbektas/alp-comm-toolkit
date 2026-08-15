/**
 * TCP (RFC 9293) — en az 20 baytlık başlık, taşıyıcı bağımsız (girdi TEK bir TCP
 * SEGMENTİdir, IPv4/IPv6 sarmalayıcısı YOK — karar 1, motorlar zincir kurmaz;
 * `network-ethernet` katalog ailesinin kendi notu: TCP paket değil BYTE STREAM
 * verir, ama bu motor akış birleştirme YAPMAZ — MQTT/HTTP gibi üst katman
 * parser'ları reassembled stream'i tüketir, bu sayfa yalnız TEK segmenti çözer).
 *
 * ── CHECKSUM: PSEUDO-HEADER OLMADAN DOĞRULANAMAZ (karar 2) ──────────────────
 * UDP'yle BİREBİR aynı gerekçe (bkz. `udp.ts` dosya başı) — pseudo-header IP
 * başlığından gelir, tek segmentte yok. MAVLink'in `crcNeedsDialect` deseni:
 * checksum ham, `valid:true`, `checksum-mismatch` HİÇ basılmaz. `status: 'ready'`.
 *
 * ── SEQ/ACK İLİŞKİSİ KURULMAZ ────────────────────────────────────────────────
 * Three-way handshake, retransmission, stream reassembly (spec 26908-27155)
 * ÇOK SEGMENT ister — analyzer'ın işi (MAVLink'in seq-loss hesabını parser'a
 * koymama kararıyla aynı sınır). Sequence/Acknowledgment Number burada yalnız
 * DEĞER olarak okunur, 32-bit oldukları için `>>> 0` ile işaretsize çevrilir.
 *
 * ── DATA OFFSET < 5 VE TAMPONDA EKSİK OPTIONS AYNI SINIF PROBLEMDİR ──────────
 * IPv4'ün IHL<5 kararıyla simetrik (`ipv4.ts`): Data Offset yapısal olarak
 * imkânsızsa (`value-out-of-range`) ya da tampon deklare edilen başlık +
 * options'a yetmiyorsa (`truncated-frame`), Options/Payload'ın sınırı
 * belirsizleştiği için üretilmez — ama Port/Seq/Ack/Flags/Window/Checksum/
 * Urgent Pointer gibi SABİT ofsetli alanlar yine gösterilir (kısmi çözüm).
 *
 * ── OPTIONS HAM, KIND ADLANDIRMASI YOK (bilinçli, brief'te OPSİYONEL) ────────
 * MSS/Window Scale/SACK Permitted gibi TLV kind'lerini çözmek brief'te açıkça
 * opsiyonel bırakıldı; kapsam dar tutuldu — options tek bir ham blok.
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

const PROTOCOL_ID = 'tcp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'TCP';

/** Ports(4B) + Seq(4B) + Ack(4B) + DataOffset/Reserved/Flags(2B) + Window(2B)
 * + Checksum(2B) + Urgent(2B) — options'sız asgari. */
const MIN_HEADER_LENGTH = 20;
/** Data Offset 32-bit KELİME sayar; 20 bayt = 5 kelime altı yapısal imkânsız. */
const MIN_DATA_OFFSET_WORDS = 5;
const DATA_OFFSET_TO_BYTES = 4;

const SOURCE_PORT_OFFSET = 0;
const DESTINATION_PORT_OFFSET = 2;
const SEQUENCE_NUMBER_OFFSET = 4;
const ACKNOWLEDGMENT_NUMBER_OFFSET = 8;
const DATA_OFFSET_RESERVED_OFFSET = 12;
const FLAGS_OFFSET = 13;
const WINDOW_SIZE_OFFSET = 14;
const CHECKSUM_OFFSET = 16;
const URGENT_POINTER_OFFSET = 18;

const WORD_LENGTH = 2;
const DWORD_LENGTH = 4;

/** Flags baytı (offset 13), MSB'den LSB'ye: CWR/ECE/URG/ACK/PSH/RST/SYN/FIN
 * (spec 26890-26906). Her biri ayrı ParsedField — "Flag Panel" aracının verisi. */
const FLAG_BITS: ReadonlyArray<{ readonly id: string; readonly name: string; readonly mask: number }> = [
  { id: 'flag-cwr', name: 'CWR', mask: 0x80 },
  { id: 'flag-ece', name: 'ECE', mask: 0x40 },
  { id: 'flag-urg', name: 'URG', mask: 0x20 },
  { id: 'flag-ack', name: 'ACK', mask: 0x10 },
  { id: 'flag-psh', name: 'PSH', mask: 0x08 },
  { id: 'flag-rst', name: 'RST', mask: 0x04 },
  { id: 'flag-syn', name: 'SYN', mask: 0x02 },
  { id: 'flag-fin', name: 'FIN', mask: 0x01 },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.tcp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.tcp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.tcp.error.aborted';
const ERROR_DATA_OFFSET_TOO_SMALL = 'protocol.tcp.error.dataOffsetTooSmall';
const ERROR_DECLARED_HEADER_EXCEEDS_BUFFER = 'protocol.tcp.error.declaredHeaderExceedsBuffer';

const WARN_CHECKSUM_NEEDS_PSEUDO_HEADER = 'protocol.tcp.warning.checksumNeedsPseudoHeader';

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

/** 32-bit alan: Seq/Ack. Sol kaydırma işaretli taşabileceği için `>>> 0` ile
 * işaretsize çevrilir (dosya başı tuzak notu, brief-faz10-dalga4.md). */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

interface TcpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseTcpFrame(data: Uint8Array, options: TcpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_HEADER_LENGTH) {
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

  const sourcePort = readUint16BE(data, SOURCE_PORT_OFFSET);
  fields.push({
    id: 'source-port',
    name: 'Source Port',
    offset: SOURCE_PORT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(SOURCE_PORT_OFFSET, SOURCE_PORT_OFFSET + WORD_LENGTH),
    rawValue: sourcePort,
    valid: true,
    warnings: [],
  });

  const destinationPort = readUint16BE(data, DESTINATION_PORT_OFFSET);
  fields.push({
    id: 'destination-port',
    name: 'Destination Port',
    offset: DESTINATION_PORT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(DESTINATION_PORT_OFFSET, DESTINATION_PORT_OFFSET + WORD_LENGTH),
    rawValue: destinationPort,
    valid: true,
    warnings: [],
  });

  // 32-bit: Seq/Ack İLİŞKİSİ KURULMAZ (dosya başı) — yalnız değer taşınır.
  const sequenceNumber = readUint32BE(data, SEQUENCE_NUMBER_OFFSET);
  fields.push({
    id: 'sequence-number',
    name: 'Sequence Number',
    offset: SEQUENCE_NUMBER_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: data.slice(SEQUENCE_NUMBER_OFFSET, SEQUENCE_NUMBER_OFFSET + DWORD_LENGTH),
    rawValue: sequenceNumber,
    valid: true,
    warnings: [],
  });

  const acknowledgmentNumber = readUint32BE(data, ACKNOWLEDGMENT_NUMBER_OFFSET);
  fields.push({
    id: 'acknowledgment-number',
    name: 'Acknowledgment Number',
    offset: ACKNOWLEDGMENT_NUMBER_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: data.slice(ACKNOWLEDGMENT_NUMBER_OFFSET, ACKNOWLEDGMENT_NUMBER_OFFSET + DWORD_LENGTH),
    rawValue: acknowledgmentNumber,
    valid: true,
    warnings: [],
  });

  const dataOffsetReservedByte = byteAt(data, DATA_OFFSET_RESERVED_OFFSET);
  const dataOffset = dataOffsetReservedByte >>> 4;
  const reserved = dataOffsetReservedByte & 0x0f;
  const declaredHeaderLength = dataOffset * DATA_OFFSET_TO_BYTES;
  const dataOffsetValid = dataOffset >= MIN_DATA_OFFSET_WORDS;

  const dataOffsetField: ParsedField = {
    id: 'data-offset',
    name: 'Data Offset',
    offset: DATA_OFFSET_RESERVED_OFFSET,
    length: 1,
    rawBytes: data.slice(DATA_OFFSET_RESERVED_OFFSET, DATA_OFFSET_RESERVED_OFFSET + 1),
    rawValue: dataOffset,
    physicalValue: `${String(declaredHeaderLength)} bytes`,
    valid: dataOffsetValid,
    warnings: [],
  };
  fields.push(dataOffsetField);
  if (!dataOffsetValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_DATA_OFFSET_TOO_SMALL,
      offset: DATA_OFFSET_RESERVED_OFFSET,
      length: 1,
      details: { dataOffset, minimumDataOffset: MIN_DATA_OFFSET_WORDS },
    });
  }

  fields.push({
    id: 'reserved',
    name: 'Reserved',
    offset: DATA_OFFSET_RESERVED_OFFSET,
    length: 1,
    rawBytes: data.slice(DATA_OFFSET_RESERVED_OFFSET, DATA_OFFSET_RESERVED_OFFSET + 1),
    rawValue: reserved,
    valid: true,
    warnings: [],
  });

  const flagsByte = byteAt(data, FLAGS_OFFSET);
  const flagsBytes = data.slice(FLAGS_OFFSET, FLAGS_OFFSET + 1);
  for (const flag of FLAG_BITS) {
    fields.push({
      id: flag.id,
      name: flag.name,
      offset: FLAGS_OFFSET,
      length: 1,
      rawBytes: flagsBytes,
      rawValue: (flagsByte & flag.mask) === 0 ? 0 : 1,
      valid: true,
      warnings: [],
    });
  }

  const windowSize = readUint16BE(data, WINDOW_SIZE_OFFSET);
  fields.push({
    id: 'window-size',
    name: 'Window Size',
    offset: WINDOW_SIZE_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(WINDOW_SIZE_OFFSET, WINDOW_SIZE_OFFSET + WORD_LENGTH),
    rawValue: windowSize,
    valid: true,
    warnings: [],
  });

  const checksumValue = readUint16BE(data, CHECKSUM_OFFSET);
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: CHECKSUM_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + WORD_LENGTH),
    rawValue: checksumValue,
    // Doğrulanamayan bir şey "yanlış" ilan edilmez (dosya başı, MAVLink emsali).
    valid: true,
    warnings: [WARN_CHECKSUM_NEEDS_PSEUDO_HEADER],
  });
  warnings.push(toProtocolWarning(WARN_CHECKSUM_NEEDS_PSEUDO_HEADER));

  const urgentPointer = readUint16BE(data, URGENT_POINTER_OFFSET);
  fields.push({
    id: 'urgent-pointer',
    name: 'Urgent Pointer',
    offset: URGENT_POINTER_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(URGENT_POINTER_OFFSET, URGENT_POINTER_OFFSET + WORD_LENGTH),
    rawValue: urgentPointer,
    valid: true,
    warnings: [],
  });

  // Options/Payload: yalnız Data Offset yapısal olarak geçerli VE tamponda
  // başlığın TAMAMI (options dahil) varsa üretilir (dosya başı, IHL<5 emsali).
  if (dataOffsetValid) {
    if (data.length < declaredHeaderLength) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_DECLARED_HEADER_EXCEEDS_BUFFER,
        offset: MIN_HEADER_LENGTH,
        length: declaredHeaderLength - data.length,
        details: { declaredHeaderLength, availableBytes: data.length },
      });
    } else {
      if (declaredHeaderLength > MIN_HEADER_LENGTH) {
        const optionsBytes = data.slice(MIN_HEADER_LENGTH, declaredHeaderLength);
        fields.push({
          id: 'options',
          name: 'Options',
          offset: MIN_HEADER_LENGTH,
          length: optionsBytes.length,
          rawBytes: optionsBytes,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }

      const payload = data.slice(declaredHeaderLength);
      if (payload.length > 0) {
        fields.push({
          id: 'payload',
          name: 'Payload',
          offset: declaredHeaderLength,
          length: payload.length,
          rawBytes: payload,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
    }
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

export function parseTcp(data: Uint8Array): ParseResult {
  return parseTcpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): TcpParseOptions {
  const options: TcpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const tcpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: TCP'nin ayırt edici bir sabiti YOK, yalnız asgari uzunluk. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseTcpFrame(data, readContextOptions(context));
  },
};

function tcpSegment(fields: {
  sourcePort: number;
  destinationPort: number;
  sequenceNumber: number;
  acknowledgmentNumber: number;
  dataOffsetReserved: number;
  flags: number;
  windowSize: number;
  checksum: number;
  urgentPointer: number;
  rest?: readonly number[];
}): number[] {
  return [
    (fields.sourcePort >>> 8) & 0xff,
    fields.sourcePort & 0xff,
    (fields.destinationPort >>> 8) & 0xff,
    fields.destinationPort & 0xff,
    (fields.sequenceNumber >>> 24) & 0xff,
    (fields.sequenceNumber >>> 16) & 0xff,
    (fields.sequenceNumber >>> 8) & 0xff,
    fields.sequenceNumber & 0xff,
    (fields.acknowledgmentNumber >>> 24) & 0xff,
    (fields.acknowledgmentNumber >>> 16) & 0xff,
    (fields.acknowledgmentNumber >>> 8) & 0xff,
    fields.acknowledgmentNumber & 0xff,
    fields.dataOffsetReserved,
    fields.flags,
    (fields.windowSize >>> 8) & 0xff,
    fields.windowSize & 0xff,
    (fields.checksum >>> 8) & 0xff,
    fields.checksum & 0xff,
    (fields.urgentPointer >>> 8) & 0xff,
    fields.urgentPointer & 0xff,
    ...(fields.rest ?? []),
  ];
}

const FLAG_SYN = 0x02;
const FLAG_ACK = 0x10;
const FLAG_PSH = 0x08;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'syn-basic',
    name: 'protocol.tcp.example.synBasic.name',
    // Data Offset=5 (options yok), yalnız SYN bayrağı — bağlantı açılışı.
    bytes: Uint8Array.from(
      tcpSegment({
        sourcePort: 51234,
        destinationPort: 443,
        sequenceNumber: 0x00000001,
        acknowledgmentNumber: 0,
        dataOffsetReserved: 0x50,
        flags: FLAG_SYN,
        windowSize: 65535,
        checksum: 0x1234,
        urgentPointer: 0,
      }),
    ),
    description: 'protocol.tcp.example.synBasic.description',
    expectedValid: true,
  },
  {
    id: 'psh-ack-with-options',
    name: 'protocol.tcp.example.pshAckWithOptions.name',
    // Data Offset=6 (24 bayt: 20 + 4 bayt options), PSH+ACK.
    bytes: Uint8Array.from(
      tcpSegment({
        sourcePort: 443,
        destinationPort: 51234,
        sequenceNumber: 0x0000012c,
        acknowledgmentNumber: 0x00000002,
        dataOffsetReserved: 0x60,
        flags: FLAG_PSH | FLAG_ACK,
        windowSize: 4096,
        checksum: 0xabcd,
        urgentPointer: 0,
        rest: [0x01, 0x01, 0x01, 0x00, 0xde, 0xad, 0xbe, 0xef],
      }),
    ),
    description: 'protocol.tcp.example.pshAckWithOptions.description',
    expectedValid: true,
  },
  {
    id: 'data-offset-too-small',
    name: 'protocol.tcp.example.dataOffsetTooSmall.name',
    // Data Offset nibble = 4 (16 bayt), minimum 5 (20 bayt) altında.
    bytes: Uint8Array.from(
      tcpSegment({
        sourcePort: 1,
        destinationPort: 2,
        sequenceNumber: 0,
        acknowledgmentNumber: 0,
        dataOffsetReserved: 0x40,
        flags: FLAG_SYN,
        windowSize: 1024,
        checksum: 0,
        urgentPointer: 0,
      }),
    ),
    description: 'protocol.tcp.example.dataOffsetTooSmall.description',
    expectedValid: false,
  },
  {
    id: 'truncated-options',
    name: 'protocol.tcp.example.truncatedOptions.name',
    // Data Offset=8 (32 bayt bildiriyor) ama tamponda yalnız 20+4=24 bayt var.
    bytes: Uint8Array.from(
      tcpSegment({
        sourcePort: 1,
        destinationPort: 2,
        sequenceNumber: 0,
        acknowledgmentNumber: 0,
        dataOffsetReserved: 0x80,
        flags: FLAG_ACK,
        windowSize: 1024,
        checksum: 0,
        urgentPointer: 0,
        rest: [0x01, 0x01, 0x01, 0x00],
      }),
    ),
    description: 'protocol.tcp.example.truncatedOptions.description',
    expectedValid: false,
  },
];

export const tcpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: tcpParser,
  documentation: {
    summary: 'protocol.tcp.documentation.summary',
    layer: 'transport',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
