/**
 * UDP (RFC 768) — 8 baytlık sabit başlık, taşıyıcı bağımsız (girdi TEK bir UDP
 * datagramıdır, IPv4/IPv6 sarmalayıcısı YOK — karar 1, motorlar zincir kurmaz).
 *
 * ── CHECKSUM: PSEUDO-HEADER OLMADAN DOĞRULANAMAZ (karar 2) ──────────────────
 * UDP checksum'ı IP başlığından gelen bir "pseudo-header" (kaynak/hedef adres +
 * protokol + uzunluk) İSTER (spec 26728-26734, 31052-31074). Tek segmentlik
 * girdide bu bilgi HİÇ YOK — doğrulama matematiksel olarak İMKÂNSIZ, IPv4'ün
 * başlık checksum'ından (pseudo-header istemez, tam doğrulanır — `ipv4.ts`)
 * FARKLI. MAVLink'in `crcNeedsDialect` deseninin birebir emsali: checksum ham
 * gösterilir, `valid:true` (varlığı doğrulanır, doğruluğu değil), `checksum-
 * mismatch` HİÇ basılmaz. `status: 'ready'` — eksik olan motor değil girdinin
 * doğası (karar 2'nin gerekçesi, brief-faz10-dalga4.md).
 *
 * ── ÖZEL DURUM: CHECKSUM 0x0000 = "KULLANILMIYOR" (yalnız IPv4 taşıyıcısında) ─
 * RFC 768: IPv4 üzerinde checksum hesaplanmadıysa alan 0x0000 yazılır (IPv6'da
 * checksum ZORUNLUDUR, bu kısayol geçerli değildir). Bu motor taşıyıcıyı
 * BİLMEDİĞİ için ikisini de anlatan bir bilgi notu basar — hata DEĞİL.
 *
 * ── LENGTH: KENDİSİ DAHİL (spec 26709-26726) ────────────────────────────────
 * `Length` alanı 8 baytlık başlık DAHİL toplam datagram uzunluğudur; payload =
 * length − 8. 8'den küçük bir değer yapısal olarak imkânsızdır (başlığın
 * kendisinden küçük olamaz). Tampon deklare edilenden UZUNSA fazlası ayrı bir
 * "trailing data" alanına düşer (mavlink.ts'teki trailing-bytes deseninin emsali) —
 * hata değil, kayıttaki sonraki datagramın parçası olabilir.
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

const PROTOCOL_ID = 'udp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'UDP';

/** Source Port(2B) + Destination Port(2B) + Length(2B) + Checksum(2B). */
const HEADER_LENGTH = 8;

const SOURCE_PORT_OFFSET = 0;
const DESTINATION_PORT_OFFSET = 2;
const LENGTH_OFFSET = 4;
const CHECKSUM_OFFSET = 6;
const WORD_LENGTH = 2;

const ERROR_FRAME_TOO_SHORT = 'protocol.udp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.udp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.udp.error.aborted';
const ERROR_LENGTH_TOO_SMALL = 'protocol.udp.error.lengthTooSmall';
const ERROR_DECLARED_LENGTH_EXCEEDS_BUFFER = 'protocol.udp.error.declaredLengthExceedsBuffer';

const WARN_CHECKSUM_NEEDS_PSEUDO_HEADER = 'protocol.udp.warning.checksumNeedsPseudoHeader';
const WARN_CHECKSUM_ZERO_MEANS_DISABLED = 'protocol.udp.warning.checksumZeroMeansDisabledOverIpv4';
const WARN_TRAILING_BYTES = 'protocol.udp.warning.trailingBytes';

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

interface UdpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseUdpFrame(data: Uint8Array, options: UdpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < HEADER_LENGTH) {
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

  const declaredLength = readUint16BE(data, LENGTH_OFFSET);
  const lengthValid = declaredLength >= HEADER_LENGTH;
  const lengthField: ParsedField = {
    id: 'length',
    name: 'Length',
    offset: LENGTH_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(LENGTH_OFFSET, LENGTH_OFFSET + WORD_LENGTH),
    rawValue: declaredLength,
    unit: 'B',
    valid: lengthValid,
    warnings: [],
  };
  fields.push(lengthField);
  if (!lengthValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_LENGTH_TOO_SMALL,
      offset: LENGTH_OFFSET,
      length: WORD_LENGTH,
      details: { declaredLength, minimumLength: HEADER_LENGTH },
    });
  }

  const checksumValue = readUint16BE(data, CHECKSUM_OFFSET);
  const checksumWarnings = [WARN_CHECKSUM_NEEDS_PSEUDO_HEADER];
  if (checksumValue === 0) {
    checksumWarnings.push(WARN_CHECKSUM_ZERO_MEANS_DISABLED);
  }
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: CHECKSUM_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + WORD_LENGTH),
    rawValue: checksumValue,
    // Doğrulanamayan bir şey "yanlış" ilan edilmez (dosya başı, MAVLink emsali).
    valid: true,
    warnings: checksumWarnings,
  });
  for (const key of checksumWarnings) warnings.push(toProtocolWarning(key));

  // Payload/trailing sınırı yalnız Length yapısal olarak geçerliyse anlamlıdır.
  if (lengthValid) {
    if (data.length < declaredLength) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_DECLARED_LENGTH_EXCEEDS_BUFFER,
        offset: HEADER_LENGTH,
        length: declaredLength - data.length,
        details: { declaredLength, availableBytes: data.length },
      });
      const payload = data.slice(HEADER_LENGTH);
      if (payload.length > 0) {
        fields.push({
          id: 'payload',
          name: 'Payload',
          offset: HEADER_LENGTH,
          length: payload.length,
          rawBytes: payload,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
    } else {
      const payload = data.slice(HEADER_LENGTH, declaredLength);
      if (payload.length > 0) {
        fields.push({
          id: 'payload',
          name: 'Payload',
          offset: HEADER_LENGTH,
          length: payload.length,
          rawBytes: payload,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      if (data.length > declaredLength) {
        const trailing = data.slice(declaredLength);
        fields.push({
          id: 'trailing-data',
          name: 'Trailing Data',
          offset: declaredLength,
          length: trailing.length,
          rawBytes: trailing,
          valid: false,
          warnings: [WARN_TRAILING_BYTES],
        });
        warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
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

export function parseUdp(data: Uint8Array): ParseResult {
  return parseUdpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): UdpParseOptions {
  const options: UdpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const udpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: UDP'nin ayırt edici bir sabiti YOK, yalnız asgari uzunluk. */
  canParse(data: Uint8Array): boolean {
    return data.length >= HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseUdpFrame(data, readContextOptions(context));
  },
};

function udpDatagram(
  sourcePort: number,
  destinationPort: number,
  length: number,
  checksum: number,
  payload: readonly number[],
): number[] {
  return [
    (sourcePort >>> 8) & 0xff,
    sourcePort & 0xff,
    (destinationPort >>> 8) & 0xff,
    destinationPort & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    (checksum >>> 8) & 0xff,
    checksum & 0xff,
    ...payload,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'dns-query',
    name: 'protocol.udp.example.dnsQuery.name',
    // DNS'in klasik kaynak portu 53; checksum ham gösterilir (pseudo-header yok).
    bytes: Uint8Array.from(udpDatagram(53, 0x3039, 12, 0x1234, [0x01, 0x02, 0x03, 0x04])),
    description: 'protocol.udp.example.dnsQuery.description',
    expectedValid: true,
  },
  {
    id: 'checksum-disabled-ipv4',
    name: 'protocol.udp.example.checksumDisabledIpv4.name',
    // Checksum 0x0000 → yalnız IPv4 taşıyıcısında geçerli olan "kullanılmıyor" notu.
    bytes: Uint8Array.from(udpDatagram(0x1000, 0x2000, 10, 0x0000, [0xaa, 0xbb])),
    description: 'protocol.udp.example.checksumDisabledIpv4.description',
    expectedValid: true,
  },
  {
    id: 'length-too-small',
    name: 'protocol.udp.example.lengthTooSmall.name',
    // Length=4 < 8 (başlığın kendisinden küçük) → value-out-of-range.
    bytes: Uint8Array.from(udpDatagram(1, 2, 4, 0xffff, [])),
    description: 'protocol.udp.example.lengthTooSmall.description',
    expectedValid: false,
  },
  {
    id: 'trailing-bytes',
    name: 'protocol.udp.example.trailingBytes.name',
    // Length=10 (8 başlık + 2 payload) ama tamponda 4 fazladan bayt var.
    bytes: Uint8Array.from(udpDatagram(9999, 8080, 10, 0x5678, [0x01, 0x02, 0xee, 0xee, 0xee, 0xee])),
    description: 'protocol.udp.example.trailingBytes.description',
    expectedValid: true,
  },
];

export const udpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: udpParser,
  documentation: {
    summary: 'protocol.udp.documentation.summary',
    layer: 'transport',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
