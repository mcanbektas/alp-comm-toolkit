/**
 * ARP (RFC 826) — IPv4 adresini yerel bağlantıdaki MAC adresine çözer. Girdi
 * TEK bir ARP mesajıdır (Ethernet sarmalayıcısı YOK — `icmp.ts`teki karar 1'in
 * aynısı, motorlar zincir KURMAZ; `ethernetFrame.ts`teki EtherType 0x0806
 * zaten "üst katmanı şu sayfada çöz" uyarısıyla buraya işaret eder).
 *
 * ── ADRES UZUNLUKLARI TELDEN OKUNUR, SABİTLENMEZ ────────────────────────────
 * Hardware Length/Protocol Length alanları donanım/protokol adreslerinin kaç
 * bayt olduğunu BİLDİRİR (RFC 826 §Packet Format) — bu motor onları SABİT
 * (6/4) VARSAYMAZ, telden okuyup adresleri o uzunlukla diliml er. Ethernet/
 * IPv4 dışı bir kombinasyon (ör. Hardware Type≠1 ya da Protocol Length≠4)
 * geldiğinde adres alanları yine dilimlenir, yalnız MAC/dotted-decimal
 * BİÇİMLENDİRMESİ uygulanmaz — ham bayt olarak gösterilir.
 *
 * ── OPERATION DAR TUTULDU (spec 08-ag-ethernet.md:80-93) ────────────────────
 * Spec yalnız Request(1)/Reply(2)'yi anlatır — `icmp.ts`teki Type deseninin
 * aynısı: kümede olmayan bir değer `valid:false` + "tanınmayan" uyarısıyla
 * gösterilir, hata BASILMAZ.
 *
 * ── IP↔MAC TABLOSU, CONFLICT DETECTOR ÇOK-PAKET İŞİDİR ──────────────────────
 * Spec bunları "Toolkit ... oluşturur" diye tarif eder (spec:88-93) — tek
 * çerçeve çözücüsünün değil, bir analyzer'ın işi (`icmp.ts`teki RTT/eşleştirme
 * sınırının aynısı).
 */

import { formatMac } from '@/protocols/network/ethernet/ethernetFrame';
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

const PROTOCOL_ID = 'arp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ARP';

/** Hardware Type(2B) + Protocol Type(2B) + Hardware Length(1B) + Protocol
 * Length(1B) + Operation(2B) — dört adres alanının uzunluğunu bilmeden önce
 * okunması gereken sabit kısım. */
const FIXED_HEADER_LENGTH = 8;

const HARDWARE_TYPE_OFFSET = 0;
const PROTOCOL_TYPE_OFFSET = 2;
const HARDWARE_LENGTH_OFFSET = 4;
const PROTOCOL_LENGTH_OFFSET = 5;
const OPERATION_OFFSET = 6;

const WORD_LENGTH = 2;

const HARDWARE_TYPE_ETHERNET = 1;
const PROTOCOL_TYPE_IPV4 = 0x0800;
const ETHERNET_MAC_LENGTH = 6;
const IPV4_ADDRESS_LENGTH = 4;

const OPERATION_REQUEST = 1;
const OPERATION_REPLY = 2;

/** Dar tutulan Operation kümesi (dosya başı) — spec'in ayrıntılı anlattığı iki değer. */
const OPERATION_NAMES: ReadonlyMap<number, string> = new Map([
  [OPERATION_REQUEST, 'Request'],
  [OPERATION_REPLY, 'Reply'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.arp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.arp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.arp.error.aborted';
const ERROR_ADDRESSES_TRUNCATED = 'protocol.arp.error.addressesTruncated';

const WARN_UNKNOWN_OPERATION = 'protocol.arp.warning.unknownOperation';

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

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

/** Yalnız Ethernet(6 bayt)/IPv4(4 bayt) kombinasyonunda okunur biçimlendirme
 * uygular; aksi hâlde ham bırakır (dosya başı). */
function formatAddress(bytes: Uint8Array, kind: 'hardware' | 'protocol', hardwareType: number, protocolLength: number): string | undefined {
  if (kind === 'hardware' && hardwareType === HARDWARE_TYPE_ETHERNET && bytes.length === ETHERNET_MAC_LENGTH) {
    return formatMac(bytes);
  }
  if (kind === 'protocol' && protocolLength === IPV4_ADDRESS_LENGTH && bytes.length === IPV4_ADDRESS_LENGTH) {
    return formatIpv4Address(bytes);
  }
  return undefined;
}

interface ArpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseArpFrame(data: Uint8Array, options: ArpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < FIXED_HEADER_LENGTH) {
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

  const hardwareType = readUint16BE(data, HARDWARE_TYPE_OFFSET);
  fields.push({
    id: 'hardware-type',
    name: 'Hardware Type',
    offset: HARDWARE_TYPE_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(HARDWARE_TYPE_OFFSET, HARDWARE_TYPE_OFFSET + WORD_LENGTH),
    rawValue: hardwareType,
    ...(hardwareType === HARDWARE_TYPE_ETHERNET ? { physicalValue: 'Ethernet' } : {}),
    valid: true,
    warnings: [],
  });

  const protocolType = readUint16BE(data, PROTOCOL_TYPE_OFFSET);
  fields.push({
    id: 'protocol-type',
    name: 'Protocol Type',
    offset: PROTOCOL_TYPE_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(PROTOCOL_TYPE_OFFSET, PROTOCOL_TYPE_OFFSET + WORD_LENGTH),
    rawValue: protocolType,
    ...(protocolType === PROTOCOL_TYPE_IPV4 ? { physicalValue: 'IPv4' } : {}),
    valid: true,
    warnings: [],
  });

  const hardwareLength = byteAt(data, HARDWARE_LENGTH_OFFSET);
  fields.push({
    id: 'hardware-length',
    name: 'Hardware Length',
    offset: HARDWARE_LENGTH_OFFSET,
    length: 1,
    rawBytes: data.slice(HARDWARE_LENGTH_OFFSET, HARDWARE_LENGTH_OFFSET + 1),
    rawValue: hardwareLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const protocolLength = byteAt(data, PROTOCOL_LENGTH_OFFSET);
  fields.push({
    id: 'protocol-length',
    name: 'Protocol Length',
    offset: PROTOCOL_LENGTH_OFFSET,
    length: 1,
    rawBytes: data.slice(PROTOCOL_LENGTH_OFFSET, PROTOCOL_LENGTH_OFFSET + 1),
    rawValue: protocolLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const operationValue = readUint16BE(data, OPERATION_OFFSET);
  const operationName = OPERATION_NAMES.get(operationValue);
  const operationField: ParsedField = {
    id: 'operation',
    name: 'Operation',
    offset: OPERATION_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(OPERATION_OFFSET, OPERATION_OFFSET + WORD_LENGTH),
    rawValue: operationValue,
    valid: operationName !== undefined,
    warnings: [],
  };
  if (operationName !== undefined) operationField.physicalValue = operationName;
  else {
    operationField.warnings = [WARN_UNKNOWN_OPERATION];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_OPERATION));
  }
  fields.push(operationField);

  const totalLength = FIXED_HEADER_LENGTH + 2 * hardwareLength + 2 * protocolLength;
  if (data.length < totalLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ADDRESSES_TRUNCATED,
      offset: FIXED_HEADER_LENGTH,
      length: totalLength - data.length,
      details: { hardwareLength, protocolLength, declaredTotalLength: totalLength, availableBytes: data.length },
    });
  } else {
    let cursor = FIXED_HEADER_LENGTH;

    const senderHardware = data.slice(cursor, cursor + hardwareLength);
    fields.push({
      id: 'sender-hardware-address',
      name: 'Sender Hardware Address',
      offset: cursor,
      length: hardwareLength,
      rawBytes: senderHardware,
      ...(() => {
        const formatted = formatAddress(senderHardware, 'hardware', hardwareType, protocolLength);
        return formatted === undefined ? {} : { rawValue: formatted };
      })(),
      valid: true,
      warnings: [],
    });
    cursor += hardwareLength;

    const senderProtocol = data.slice(cursor, cursor + protocolLength);
    fields.push({
      id: 'sender-protocol-address',
      name: 'Sender Protocol Address',
      offset: cursor,
      length: protocolLength,
      rawBytes: senderProtocol,
      ...(() => {
        const formatted = formatAddress(senderProtocol, 'protocol', hardwareType, protocolLength);
        return formatted === undefined ? {} : { rawValue: formatted };
      })(),
      valid: true,
      warnings: [],
    });
    cursor += protocolLength;

    const targetHardware = data.slice(cursor, cursor + hardwareLength);
    fields.push({
      id: 'target-hardware-address',
      name: 'Target Hardware Address',
      offset: cursor,
      length: hardwareLength,
      rawBytes: targetHardware,
      ...(() => {
        const formatted = formatAddress(targetHardware, 'hardware', hardwareType, protocolLength);
        return formatted === undefined ? {} : { rawValue: formatted };
      })(),
      valid: true,
      warnings: [],
    });
    cursor += hardwareLength;

    const targetProtocol = data.slice(cursor, cursor + protocolLength);
    fields.push({
      id: 'target-protocol-address',
      name: 'Target Protocol Address',
      offset: cursor,
      length: protocolLength,
      rawBytes: targetProtocol,
      ...(() => {
        const formatted = formatAddress(targetProtocol, 'protocol', hardwareType, protocolLength);
        return formatted === undefined ? {} : { rawValue: formatted };
      })(),
      valid: true,
      warnings: [],
    });
    cursor += protocolLength;

    // Ethernet minimum çerçeve boyutu (64 bayt) ARP'ı sık sık doldurur —
    // fazlası hata değil, dolgu (spec'te ayrı bir madde yok, saha gerçeği).
    const padding = data.slice(cursor);
    if (padding.length > 0) {
      fields.push({
        id: 'padding',
        name: 'Padding',
        offset: cursor,
        length: padding.length,
        rawBytes: padding,
        unit: 'B',
        valid: true,
        warnings: [],
      });
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

export function parseArp(data: Uint8Array): ParseResult {
  return parseArpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): ArpParseOptions {
  const options: ArpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const arpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + en yaygın kombinasyon (Ethernet/IPv4, 28
   * bayt). Diğer donanım/protokol kombinasyonları da `parse`de kabul edilir,
   * yalnız ucuz ön elemede aranmaz (udp.ts'in aynı sınırı). */
  canParse(data: Uint8Array): boolean {
    return data.length >= FIXED_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseArpFrame(data, readContextOptions(context));
  },
};

function arpFrame(fields: {
  hardwareType: number;
  protocolType: number;
  hardwareLength: number;
  protocolLength: number;
  operation: number;
  senderHardware: readonly number[];
  senderProtocol: readonly number[];
  targetHardware: readonly number[];
  targetProtocol: readonly number[];
}): number[] {
  return [
    (fields.hardwareType >>> 8) & 0xff,
    fields.hardwareType & 0xff,
    (fields.protocolType >>> 8) & 0xff,
    fields.protocolType & 0xff,
    fields.hardwareLength,
    fields.protocolLength,
    (fields.operation >>> 8) & 0xff,
    fields.operation & 0xff,
    ...fields.senderHardware,
    ...fields.senderProtocol,
    ...fields.targetHardware,
    ...fields.targetProtocol,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'request',
    name: 'protocol.arp.example.request.name',
    // Spec'in "Who has 192.168.1.20? Tell 192.168.1.10" örneği (08-ag-ethernet.md:87).
    bytes: Uint8Array.from(
      arpFrame({
        hardwareType: 1,
        protocolType: 0x0800,
        hardwareLength: 6,
        protocolLength: 4,
        operation: OPERATION_REQUEST,
        senderHardware: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        senderProtocol: [192, 168, 1, 10],
        targetHardware: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        targetProtocol: [192, 168, 1, 20],
      }),
    ),
    description: 'protocol.arp.example.request.description',
    expectedValid: true,
  },
  {
    id: 'reply',
    name: 'protocol.arp.example.reply.name',
    bytes: Uint8Array.from(
      arpFrame({
        hardwareType: 1,
        protocolType: 0x0800,
        hardwareLength: 6,
        protocolLength: 4,
        operation: OPERATION_REPLY,
        senderHardware: [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff],
        senderProtocol: [192, 168, 1, 20],
        targetHardware: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        targetProtocol: [192, 168, 1, 10],
      }),
    ),
    description: 'protocol.arp.example.reply.description',
    expectedValid: true,
  },
  {
    id: 'padded',
    name: 'protocol.arp.example.padded.name',
    // Ethernet asgari 64 baytlık çerçeve — 28 baytlık ARP'a 32 bayt dolgu eklendi.
    bytes: Uint8Array.from([
      ...arpFrame({
        hardwareType: 1,
        protocolType: 0x0800,
        hardwareLength: 6,
        protocolLength: 4,
        operation: OPERATION_REQUEST,
        senderHardware: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        senderProtocol: [10, 0, 0, 1],
        targetHardware: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        targetProtocol: [10, 0, 0, 2],
      }),
      ...new Array<number>(32).fill(0x00),
    ]),
    description: 'protocol.arp.example.padded.description',
    expectedValid: true,
  },
  {
    id: 'unknown-operation',
    name: 'protocol.arp.example.unknownOperation.name',
    bytes: Uint8Array.from(
      arpFrame({
        hardwareType: 1,
        protocolType: 0x0800,
        hardwareLength: 6,
        protocolLength: 4,
        operation: 5,
        senderHardware: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        senderProtocol: [10, 0, 0, 1],
        targetHardware: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        targetProtocol: [10, 0, 0, 2],
      }),
    ),
    description: 'protocol.arp.example.unknownOperation.description',
    expectedValid: true,
  },
];

export const arpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: arpParser,
  documentation: {
    summary: 'protocol.arp.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
