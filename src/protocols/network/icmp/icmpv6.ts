/**
 * ICMPv6 (RFC 4443) — IPv6'nın control/error protokolü, `ipv6.ts`teki Next
 * Header 58'in karşılığı. Girdi TEK bir ICMPv6 mesajıdır (IPv6 sarmalayıcısı
 * YOK — `icmp.ts`teki karar 1'in aynısı, motorlar zincir KURMAZ).
 *
 * ── TİP KÜMESİ: RFC 4443 ÇEKİRDEĞİ + ND ADI TANINIR AMA GÖVDESİ ÇÖZÜLMEZ ─────
 * Spec (08-ag-ethernet.md:173-178) RFC 4443'ün altı temel tipini (1/2/3/4/128/
 * 129) ayrıntılı anlatır; Neighbor Discovery ailesini (133/134/135/136/137,
 * RFC 4861) ise AÇIKÇA ERTELER: "ileride ayrı decoder modülleri" diyor ve
 * "birebir ARP for IPv6 sadeleştirmesi YAPMA" uyarısı ekliyor. Bu dosya o
 * kararı birebir uygular: ND tipleri Type alanında ADLANDIRILIR (kullanıcı
 * "Router Solicitation" görür, "tanınmayan tip" değil) ama gövdesi
 * decompose edilmez — `WARN_NEIGHBOR_DISCOVERY_DEFERRED` ile ham bırakılır.
 * Gerçek ND alan çözümü (Target Address, Flags, Options TLV zinciri) ayrı bir
 * dalga/iş.
 *
 * ── CHECKSUM: PSEUDO-HEADER OLMADAN DOĞRULANAMAZ, IPv4/UDP KISAYOLU YOK ──────
 * ICMPv6 checksum'ı IPv6 pseudo-header (kaynak/hedef adres + upper-layer
 * length + Next Header=58) ister — `udp.ts`teki "PSEUDO-HEADER OLMADAN
 * DOĞRULANAMAZ" durumunun aynısı: ham gösterilir, `valid:true` (varlığı
 * doğrulanır, doğruluğu değil), `checksum-mismatch` HİÇ basılmaz. TEK FARK:
 * UDP'nin IPv4 taşıyıcısındaki "checksum 0x0000 = kullanılmıyor" kısayolu
 * BURADA YOK — IPv6'da checksum her zaman ZORUNLUDUR (`ipv6.ts` ve
 * `udp.ts` dosya başı notlarının ikisi de bunu vurgular). Kaynak/hedef adres
 * ileride `decodeOptions` kanalıyla (dalga 11'de açıldı, `protocol-core/
 * types.ts:308`) kullanıcıdan alınabilir — bu dalgada YAPILMADI.
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

const PROTOCOL_ID = 'icmpv6';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ICMPv6';

/** Type(1B) + Code(1B) + Checksum(2B) + tip-özel 4 bayt (Echo'da Identifier+
 * Sequence, hata mesajlarında Unused/MTU/Pointer) — HER tip için ortak asgari. */
const MIN_HEADER_LENGTH = 8;

const TYPE_OFFSET = 0;
const CODE_OFFSET = 1;
const CHECKSUM_OFFSET = 2;
const REST_OFFSET = 4;
const IDENTIFIER_OFFSET = 4;
const SEQUENCE_OFFSET = 6;
const DATA_OFFSET = 8;

const WORD_LENGTH = 2;
const DOUBLE_WORD_LENGTH = 4;

const TYPE_DESTINATION_UNREACHABLE = 1;
const TYPE_PACKET_TOO_BIG = 2;
const TYPE_TIME_EXCEEDED = 3;
const TYPE_PARAMETER_PROBLEM = 4;
const TYPE_ECHO_REQUEST = 128;
const TYPE_ECHO_REPLY = 129;
const TYPE_ROUTER_SOLICITATION = 133;
const TYPE_ROUTER_ADVERTISEMENT = 134;
const TYPE_NEIGHBOR_SOLICITATION = 135;
const TYPE_NEIGHBOR_ADVERTISEMENT = 136;
const TYPE_REDIRECT = 137;

/** RFC 4443 çekirdek altı tip + RFC 4861 ND ailesinin adları (dosya başı —
 * ND'nin gövdesi çözülmez, yalnız adlandırılır). */
const TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [TYPE_DESTINATION_UNREACHABLE, 'Destination Unreachable'],
  [TYPE_PACKET_TOO_BIG, 'Packet Too Big'],
  [TYPE_TIME_EXCEEDED, 'Time Exceeded'],
  [TYPE_PARAMETER_PROBLEM, 'Parameter Problem'],
  [TYPE_ECHO_REQUEST, 'Echo Request'],
  [TYPE_ECHO_REPLY, 'Echo Reply'],
  [TYPE_ROUTER_SOLICITATION, 'Router Solicitation'],
  [TYPE_ROUTER_ADVERTISEMENT, 'Router Advertisement'],
  [TYPE_NEIGHBOR_SOLICITATION, 'Neighbor Solicitation'],
  [TYPE_NEIGHBOR_ADVERTISEMENT, 'Neighbor Advertisement'],
  [TYPE_REDIRECT, 'Redirect'],
]);

const NEIGHBOR_DISCOVERY_TYPES: ReadonlySet<number> = new Set([
  TYPE_ROUTER_SOLICITATION,
  TYPE_ROUTER_ADVERTISEMENT,
  TYPE_NEIGHBOR_SOLICITATION,
  TYPE_NEIGHBOR_ADVERTISEMENT,
  TYPE_REDIRECT,
]);

/** RFC 4443 §3.1 — Destination Unreachable Code alanı. */
const UNREACHABLE_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'No Route to Destination'],
  [1, 'Communication with Destination Administratively Prohibited'],
  [2, 'Beyond Scope of Source Address'],
  [3, 'Address Unreachable'],
  [4, 'Port Unreachable'],
  [5, 'Source Address Failed Ingress/Egress Policy'],
  [6, 'Reject Route to Destination'],
]);

/** RFC 4443 §3.3 — Time Exceeded Code alanı. */
const TIME_EXCEEDED_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Hop Limit Exceeded in Transit'],
  [1, 'Fragment Reassembly Time Exceeded'],
]);

/** RFC 4443 §3.4 — Parameter Problem Code alanı. */
const PARAMETER_PROBLEM_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Erroneous Header Field Encountered'],
  [1, 'Unrecognized Next Header Type Encountered'],
  [2, 'Unrecognized IPv6 Option Encountered'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.icmpv6.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.icmpv6.error.frameTooLong';
const ERROR_ABORTED = 'protocol.icmpv6.error.aborted';

const WARN_UNKNOWN_TYPE = 'protocol.icmpv6.warning.unknownType';
const WARN_UNKNOWN_CODE = 'protocol.icmpv6.warning.unknownCode';
const WARN_NEIGHBOR_DISCOVERY_DEFERRED = 'protocol.icmpv6.warning.neighborDiscoveryDeferred';
const WARN_CHECKSUM_NEEDS_PSEUDO_HEADER = 'protocol.icmpv6.warning.checksumNeedsPseudoHeader';

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
    (byteAt(data, offset) * 0x1000000) +
    (byteAt(data, offset + 1) << 16) +
    (byteAt(data, offset + 2) << 8) +
    byteAt(data, offset + 3)
  );
}

interface Icmpv6ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIcmpv6Frame(data: Uint8Array, options: Icmpv6ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
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

  const typeValue = byteAt(data, TYPE_OFFSET);
  const typeName = TYPE_NAMES.get(typeValue);
  const isNeighborDiscovery = NEIGHBOR_DISCOVERY_TYPES.has(typeValue);
  const typeField: ParsedField = {
    id: 'type',
    name: 'Type',
    offset: TYPE_OFFSET,
    length: 1,
    rawBytes: data.slice(TYPE_OFFSET, TYPE_OFFSET + 1),
    rawValue: typeValue,
    valid: typeName !== undefined,
    warnings: [],
  };
  if (typeName !== undefined) typeField.physicalValue = typeName;
  if (typeName === undefined) {
    typeField.warnings = [WARN_UNKNOWN_TYPE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_TYPE));
  } else if (isNeighborDiscovery) {
    typeField.warnings = [WARN_NEIGHBOR_DISCOVERY_DEFERRED];
    warnings.push(toProtocolWarning(WARN_NEIGHBOR_DISCOVERY_DEFERRED));
  }
  fields.push(typeField);

  const codeValue = byteAt(data, CODE_OFFSET);
  const codeNames =
    typeValue === TYPE_DESTINATION_UNREACHABLE
      ? UNREACHABLE_CODE_NAMES
      : typeValue === TYPE_TIME_EXCEEDED
        ? TIME_EXCEEDED_CODE_NAMES
        : typeValue === TYPE_PARAMETER_PROBLEM
          ? PARAMETER_PROBLEM_CODE_NAMES
          : undefined;
  const codeName = codeNames?.get(codeValue);
  const codeField: ParsedField = {
    id: 'code',
    name: 'Code',
    offset: CODE_OFFSET,
    length: 1,
    rawBytes: data.slice(CODE_OFFSET, CODE_OFFSET + 1),
    rawValue: codeValue,
    valid: true,
    warnings: [],
  };
  if (codeName !== undefined) {
    codeField.physicalValue = codeName;
  } else if (codeNames !== undefined) {
    codeField.warnings = [WARN_UNKNOWN_CODE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CODE));
  }
  fields.push(codeField);

  // Pseudo-header olmadan doğrulanamaz (dosya başı, udp.ts emsali) — ham
  // gösterilir, varlığı doğrulanır doğruluğu değil.
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: CHECKSUM_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + WORD_LENGTH),
    rawValue: readUint16BE(data, CHECKSUM_OFFSET),
    valid: true,
    warnings: [WARN_CHECKSUM_NEEDS_PSEUDO_HEADER],
  });
  warnings.push(toProtocolWarning(WARN_CHECKSUM_NEEDS_PSEUDO_HEADER));

  if (typeValue === TYPE_ECHO_REQUEST || typeValue === TYPE_ECHO_REPLY) {
    fields.push({
      id: 'identifier',
      name: 'Identifier',
      offset: IDENTIFIER_OFFSET,
      length: WORD_LENGTH,
      rawBytes: data.slice(IDENTIFIER_OFFSET, IDENTIFIER_OFFSET + WORD_LENGTH),
      rawValue: readUint16BE(data, IDENTIFIER_OFFSET),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'sequence-number',
      name: 'Sequence Number',
      offset: SEQUENCE_OFFSET,
      length: WORD_LENGTH,
      rawBytes: data.slice(SEQUENCE_OFFSET, SEQUENCE_OFFSET + WORD_LENGTH),
      rawValue: readUint16BE(data, SEQUENCE_OFFSET),
      valid: true,
      warnings: [],
    });
    const echoData = data.slice(DATA_OFFSET);
    if (echoData.length > 0) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: DATA_OFFSET,
        length: echoData.length,
        rawBytes: echoData,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else if (
    typeValue === TYPE_DESTINATION_UNREACHABLE ||
    typeValue === TYPE_PACKET_TOO_BIG ||
    typeValue === TYPE_TIME_EXCEEDED ||
    typeValue === TYPE_PARAMETER_PROBLEM
  ) {
    if (typeValue === TYPE_PACKET_TOO_BIG) {
      // RFC 4443 §3.2 — Path MTU Discovery'nin kaynağı: yolun bildirdiği MTU.
      fields.push({
        id: 'mtu',
        name: 'MTU',
        offset: REST_OFFSET,
        length: DOUBLE_WORD_LENGTH,
        rawBytes: data.slice(REST_OFFSET, REST_OFFSET + DOUBLE_WORD_LENGTH),
        rawValue: readUint32BE(data, REST_OFFSET),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    } else if (typeValue === TYPE_PARAMETER_PROBLEM) {
      // RFC 4443 §3.4 — ICMPv4'ün 1 baytlık Pointer'ının aksine burası TAM
      // 32-bit (IPv6 başlığı+uzantıları ICMPv4'ün 255 baytlık sınırını aşabilir).
      fields.push({
        id: 'pointer',
        name: 'Pointer',
        offset: REST_OFFSET,
        length: DOUBLE_WORD_LENGTH,
        rawBytes: data.slice(REST_OFFSET, REST_OFFSET + DOUBLE_WORD_LENGTH),
        rawValue: readUint32BE(data, REST_OFFSET),
        valid: true,
        warnings: [],
      });
    } else {
      fields.push({
        id: 'unused',
        name: 'Unused',
        offset: REST_OFFSET,
        length: DOUBLE_WORD_LENGTH,
        rawBytes: data.slice(REST_OFFSET, REST_OFFSET + DOUBLE_WORD_LENGTH),
        valid: true,
        warnings: [],
      });
    }
    const invokingPacket = data.slice(DATA_OFFSET);
    if (invokingPacket.length > 0) {
      fields.push({
        id: 'invoking-packet',
        name: 'Invoking Packet',
        offset: DATA_OFFSET,
        length: invokingPacket.length,
        rawBytes: invokingPacket,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else {
    // Neighbor Discovery (adlandırıldı, ertelendi) ve gerçekten tanınmayan
    // tipler aynı yolu paylaşır: gövde ham bırakılır (dosya başı).
    const messageBody = data.slice(REST_OFFSET);
    if (messageBody.length > 0) {
      fields.push({
        id: 'message-body',
        name: 'Message Body',
        offset: REST_OFFSET,
        length: messageBody.length,
        rawBytes: messageBody,
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

export function parseIcmpv6(data: Uint8Array): ParseResult {
  return parseIcmpv6Frame(data, {});
}

function readContextOptions(context: ParseContext | undefined): Icmpv6ParseOptions {
  const options: Icmpv6ParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const icmpv6Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk. ICMPv6'nın ayırt edici bir magic byte'ı
   * yok (icmp.ts/udp.ts'in aynı sınırı) — auto-detection uzunluğa dayanır. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIcmpv6Frame(data, readContextOptions(context));
  },
};

function icmpv6Header(fields: {
  type: number;
  code: number;
  checksum: number;
  restOfHeader: readonly [number, number, number, number];
}): number[] {
  return [
    fields.type,
    fields.code,
    (fields.checksum >>> 8) & 0xff,
    fields.checksum & 0xff,
    ...fields.restOfHeader,
  ];
}

/**
 * Örnek çerçeveler. Checksum pseudo-header istediği için (dosya başı) BU
 * MOTOR ONU DOĞRULAMAZ — örneklerdeki değerler yalnız gösterim amaçlı,
 * `ipv4.ts`teki gibi "bağımsız hesaplandı, testte doğrulandı" iddiası YOK.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'echo-request',
    name: 'protocol.icmpv6.example.echoRequest.name',
    bytes: Uint8Array.from([
      ...icmpv6Header({ type: 128, code: 0, checksum: 0x1234, restOfHeader: [0x00, 0x01, 0x00, 0x01] }),
      0xde, 0xad, 0xbe, 0xef,
    ]),
    description: 'protocol.icmpv6.example.echoRequest.description',
    expectedValid: true,
  },
  {
    id: 'packet-too-big',
    name: 'protocol.icmpv6.example.packetTooBig.name',
    // MTU=1280 (0x00000500) — IPv6'nın asgari zorunlu MTU'su, PMTUD'nin klasik örneği.
    bytes: Uint8Array.from([
      ...icmpv6Header({ type: 2, code: 0, checksum: 0x5678, restOfHeader: [0x00, 0x00, 0x05, 0x00] }),
      0x60, 0x00, 0x00, 0x00, 0x00, 0x08, 0x11, 0x40,
    ]),
    description: 'protocol.icmpv6.example.packetTooBig.description',
    expectedValid: true,
  },
  {
    id: 'destination-unreachable-port',
    name: 'protocol.icmpv6.example.destinationUnreachablePort.name',
    bytes: Uint8Array.from([
      ...icmpv6Header({ type: 1, code: 4, checksum: 0x9abc, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
      0x60, 0x00, 0x00, 0x00, 0x00, 0x08, 0x11, 0x40,
    ]),
    description: 'protocol.icmpv6.example.destinationUnreachablePort.description',
    expectedValid: true,
  },
  {
    id: 'router-solicitation-deferred',
    name: 'protocol.icmpv6.example.routerSolicitationDeferred.name',
    // Neighbor Discovery: adlandırılır ama gövdesi çözülmez (dosya başı).
    bytes: Uint8Array.from(
      icmpv6Header({ type: 133, code: 0, checksum: 0xdef0, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
    ),
    description: 'protocol.icmpv6.example.routerSolicitationDeferred.description',
    expectedValid: true,
  },
  {
    id: 'unknown-type',
    name: 'protocol.icmpv6.example.unknownType.name',
    // Type=200 IANA'nın "deneysel/gelecek kullanım" aralığında — dar kümenin dışında.
    bytes: Uint8Array.from(
      icmpv6Header({ type: 200, code: 0, checksum: 0x1111, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
    ),
    description: 'protocol.icmpv6.example.unknownType.description',
    expectedValid: true,
  },
];

export const icmpv6Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: icmpv6Parser,
  documentation: {
    summary: 'protocol.icmpv6.documentation.summary',
    layer: 'network',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
