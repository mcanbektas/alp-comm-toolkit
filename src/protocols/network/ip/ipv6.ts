/**
 * IPv6 (RFC 8200) — internet katmanı, sabit 40 baytlık taban başlık + opsiyonel
 * uzantı başlığı (extension header) zinciri. Girdi bir IPv6 DATAGRAMIdır
 * (Ethernet çerçevesi DEĞİL) — ethernetFrame.ts'in EtherType 0x86DD adlandırdığı
 * payload'ı buraya elle taşımak kullanıcının işi (karar 1, motorlar zincir
 * KURMAZ).
 *
 * ── NEXT HEADER: ADLANDIRILIR, ZİNCİR DAR TUTULUR ───────────────────────────
 * Taban başlığın Next Header'ı (offset 6) VE her uzantı başlığının kendi Next
 * Header baytı aynı dar kümeyle sınıflandırılır: BİLİNEN bir uzantı başlığıysa
 * (Hop-by-Hop=0, Routing=43, Fragment=44, Destination Options=60 — spec
 * 26397'nin yaygın listesi) uzunluk alanıyla ATLANIR ve zincir bir adım ilerler;
 * üst katman protokolüyse (6=TCP, 17=UDP, 58=ICMPv6) ADLANDIRILIR + "şu sayfada
 * çöz" uyarısı (karar 1, ethernetFrame.ts'teki EtherType deseninin emsali);
 * BİLİNMEYENSE zincir DURUR + uyarı — sonsuz döngü koruması budur (spec
 * "bilinmeyen next header'da devam etme" şartı). `MAX_EXTENSION_HEADERS` ek bir
 * güvenlik tavanıdır (ethernet.ts'teki `MAX_VLAN_TAGS`in emsali): her adım en az
 * 8 bayt tükettiği için matematiksel olarak sonsuz döngü zaten imkânsızdır, ama
 * aşırı uzun bir zincirde de bir yerde durmak gerekir.
 *
 * ── CHECKSUM ALANI YOK ────────────────────────────────────────────────────
 * IPv4'ün aksine IPv6 başlığında checksum alanı YOKTUR (spec 26427: "N/A
 * göster") — bütünlük TCP/UDP'nin (pseudo-header'lı) kendi checksum'larına
 * bırakılmıştır. Burada `checksum` alanı bilgi amaçlı, bayt TÜKETMEZ (offset/
 * length=0), ethernetFrame.ts'teki "FCS not captured" bilgi alanının emsali.
 *
 * ── FRAGMENTATION ─────────────────────────────────────────────────────────
 * Fragment uzantı başlığı (Next Header 44) sabit 8 bayt olarak TANINIR ve
 * atlanır (zincire devam edilir) ama İÇİ (Fragment Offset/M flag/Identification)
 * çözülmez — reassembly çok paket ister, analyzer'ın işi (spec 26181-26277,
 * IPv4'ün aynı kararıyla simetrik).
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

const PROTOCOL_ID = 'ipv6';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IPv6';

/** Version(4b)+TrafficClass(8b)+FlowLabel(20b) + PayloadLength(2B) + NextHeader(1B)
 * + HopLimit(1B) + Source(16B) + Destination(16B) — HER ZAMAN sabit, options yok. */
const BASE_HEADER_LENGTH = 40;

const PAYLOAD_LENGTH_OFFSET = 4;
const NEXT_HEADER_OFFSET = 6;
const HOP_LIMIT_OFFSET = 7;
const SOURCE_ADDRESS_OFFSET = 8;
const DESTINATION_ADDRESS_OFFSET = 24;

const WORD_LENGTH = 2;
const ADDRESS_LENGTH = 16;
const EXPECTED_VERSION = 6;

const FRAGMENT_HEADER_TYPE = 44;
const FRAGMENT_HEADER_LENGTH = 8;
const EXT_HEADER_LENGTH_UNIT = 8;
/** Spec 26397'nin yaygın listesi — dar tutulur, tam liste değildir (dosya başı). */
const EXT_HEADER_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Hop-by-Hop Options'],
  [43, 'Routing'],
  [FRAGMENT_HEADER_TYPE, 'Fragment'],
  [60, 'Destination Options'],
]);
/** Karar 1'in dar kümesi (Ethernet'in EtherType'ıyla aynı disiplin). */
const UPPER_LAYER_NAMES: ReadonlyMap<number, string> = new Map([
  [6, 'TCP'],
  [17, 'UDP'],
  [58, 'ICMPv6'],
]);
/** Her adım en az 8 bayt tükettiği için matematiksel taşma imkânsız (dosya başı) —
 * bu yalnız aşırı uzun zincirlerde bir güvenlik tavanı (ethernet.ts MAX_VLAN_TAGS emsali). */
const MAX_EXTENSION_HEADERS = 8;

const ERROR_FRAME_TOO_SHORT = 'protocol.ipv6.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ipv6.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ipv6.error.aborted';
const ERROR_EXTENSION_HEADER_TRUNCATED = 'protocol.ipv6.error.extensionHeaderTruncated';

const WARN_UNEXPECTED_VERSION = 'protocol.ipv6.warning.unexpectedVersion';
const WARN_NEXT_HEADER_HIGHER_LAYER = 'protocol.ipv6.warning.nextHeaderHigherLayer';
const WARN_UNKNOWN_NEXT_HEADER = 'protocol.ipv6.warning.unknownNextHeader';
const WARN_TOO_MANY_EXTENSION_HEADERS = 'protocol.ipv6.warning.tooManyExtensionHeaders';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** 8 grup × 4 hex hane, ':' ile ayrılır. RFC 5952'nin "::" kısaltması BİLEREK
 * uygulanmadı (brief: "basit string format yeterli, abartma") — önde-sıfır
 * bastırma `toString(16)`in kendisiyle zaten gelir. */
function formatIpv6Address(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += WORD_LENGTH) {
    const value = (byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1);
    groups.push(value.toString(16));
  }
  return groups.join(':');
}

type NextHeaderKind = 'extension' | 'upper-layer' | 'unknown';

interface NextHeaderClassification {
  readonly kind: NextHeaderKind;
  readonly name: string | undefined;
}

function classifyNextHeader(value: number): NextHeaderClassification {
  const extensionName = EXT_HEADER_NAMES.get(value);
  if (extensionName !== undefined) return { kind: 'extension', name: extensionName };
  const upperLayerName = UPPER_LAYER_NAMES.get(value);
  if (upperLayerName !== undefined) return { kind: 'upper-layer', name: upperLayerName };
  return { kind: 'unknown', name: undefined };
}

/** Bir "next header" taşıyan alana (taban başlık ya da bir uzantı başlığı) sınıflandırmaya
 * göre uyarı ekler — bilinen bir uzantı türü zincire devam eder, hiçbir uyarı basmaz. */
function applyNextHeaderWarning(
  field: ParsedField,
  classification: NextHeaderClassification,
  warnings: ProtocolWarning[],
): void {
  if (classification.kind === 'upper-layer') {
    field.warnings.push(WARN_NEXT_HEADER_HIGHER_LAYER);
    warnings.push(toProtocolWarning(WARN_NEXT_HEADER_HIGHER_LAYER));
  } else if (classification.kind === 'unknown') {
    field.warnings.push(WARN_UNKNOWN_NEXT_HEADER);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_NEXT_HEADER));
  }
}

interface Ipv6ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIpv6Frame(data: Uint8Array, options: Ipv6ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < BASE_HEADER_LENGTH) {
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

  const b0 = byteAt(data, 0);
  const b1 = byteAt(data, 1);
  const b2 = byteAt(data, 2);
  const b3 = byteAt(data, 3);
  const firstWordBytes = data.slice(0, 4);
  const version = b0 >>> 4;
  const trafficClass = ((b0 & 0x0f) << 4) | (b1 >>> 4);
  const flowLabel = ((b1 & 0x0f) << 16) | (b2 << 8) | b3;

  const versionField: ParsedField = {
    id: 'version',
    name: 'Version',
    offset: 0,
    length: 4,
    rawBytes: firstWordBytes,
    rawValue: version,
    valid: true,
    warnings: [],
  };
  if (version !== EXPECTED_VERSION) {
    versionField.warnings = [WARN_UNEXPECTED_VERSION];
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_VERSION));
  }
  fields.push(versionField);

  fields.push({
    id: 'traffic-class',
    name: 'Traffic Class',
    offset: 0,
    length: 4,
    rawBytes: firstWordBytes,
    rawValue: trafficClass,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'flow-label',
    name: 'Flow Label',
    offset: 0,
    length: 4,
    rawBytes: firstWordBytes,
    rawValue: flowLabel,
    valid: true,
    warnings: [],
  });

  const payloadLength = (byteAt(data, PAYLOAD_LENGTH_OFFSET) << 8) | byteAt(data, PAYLOAD_LENGTH_OFFSET + 1);
  fields.push({
    id: 'payload-length',
    name: 'Payload Length',
    offset: PAYLOAD_LENGTH_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(PAYLOAD_LENGTH_OFFSET, PAYLOAD_LENGTH_OFFSET + WORD_LENGTH),
    rawValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const baseNextHeaderValue = byteAt(data, NEXT_HEADER_OFFSET);
  const baseClassification = classifyNextHeader(baseNextHeaderValue);
  const nextHeaderField: ParsedField = {
    id: 'next-header',
    name: 'Next Header',
    offset: NEXT_HEADER_OFFSET,
    length: 1,
    rawBytes: data.slice(NEXT_HEADER_OFFSET, NEXT_HEADER_OFFSET + 1),
    rawValue: baseNextHeaderValue,
    valid: baseClassification.kind !== 'unknown',
    warnings: [],
  };
  if (baseClassification.name !== undefined) nextHeaderField.physicalValue = baseClassification.name;
  applyNextHeaderWarning(nextHeaderField, baseClassification, warnings);
  fields.push(nextHeaderField);

  const hopLimit = byteAt(data, HOP_LIMIT_OFFSET);
  fields.push({
    id: 'hop-limit',
    name: 'Hop Limit',
    offset: HOP_LIMIT_OFFSET,
    length: 1,
    rawBytes: data.slice(HOP_LIMIT_OFFSET, HOP_LIMIT_OFFSET + 1),
    rawValue: hopLimit,
    valid: true,
    warnings: [],
  });

  const sourceBytes = data.slice(SOURCE_ADDRESS_OFFSET, SOURCE_ADDRESS_OFFSET + ADDRESS_LENGTH);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: SOURCE_ADDRESS_OFFSET,
    length: ADDRESS_LENGTH,
    rawBytes: sourceBytes,
    rawValue: formatIpv6Address(sourceBytes),
    valid: true,
    warnings: [],
  });

  const destinationBytes = data.slice(DESTINATION_ADDRESS_OFFSET, DESTINATION_ADDRESS_OFFSET + ADDRESS_LENGTH);
  fields.push({
    id: 'destination-address',
    name: 'Destination Address',
    offset: DESTINATION_ADDRESS_OFFSET,
    length: ADDRESS_LENGTH,
    rawBytes: destinationBytes,
    rawValue: formatIpv6Address(destinationBytes),
    valid: true,
    warnings: [],
  });

  // Checksum alanı YOK (dosya başı) — bilgi amaçlı, bayt TÜKETMEZ (ethernetFrame.ts
  // "FCS not captured" deseninin emsali).
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: BASE_HEADER_LENGTH,
    length: 0,
    rawBytes: new Uint8Array(0),
    physicalValue: 'N/A',
    valid: true,
    warnings: [],
  });

  // Next Header zinciri: yalnız BİLİNEN uzantı başlıklarında yürünür (dosya başı).
  let cursor = BASE_HEADER_LENGTH;
  let currentType = baseNextHeaderValue;
  let currentClassification = baseClassification;
  let index = 0;

  while (currentClassification.kind === 'extension') {
    if (index >= MAX_EXTENSION_HEADERS) {
      warnings.push(toProtocolWarning(WARN_TOO_MANY_EXTENSION_HEADERS));
      break;
    }
    if (data.length - cursor < WORD_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_EXTENSION_HEADER_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
        details: { extensionHeaderType: currentType },
      });
      break;
    }

    const isFragment = currentType === FRAGMENT_HEADER_TYPE;
    const declaredNextType = byteAt(data, cursor);
    // Fragment sabit 8 bayttır (Reserved+FragOffset+M+Identification, dosya başı);
    // diğerlerinde HdrExtLen 8 baytlık BİRİMLERİ sayar, ilk 8 bayt HARİÇ (RFC 8200 §4.3).
    const extLength = isFragment ? FRAGMENT_HEADER_LENGTH : (byteAt(data, cursor + 1) + 1) * EXT_HEADER_LENGTH_UNIT;

    if (data.length - cursor < extLength) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_EXTENSION_HEADER_TRUNCATED,
        offset: cursor,
        length: extLength - (data.length - cursor),
        details: { extensionHeaderType: currentType, declaredLength: extLength, availableBytes: data.length - cursor },
      });
      break;
    }

    index += 1;
    const nextClassification = classifyNextHeader(declaredNextType);
    const extensionField: ParsedField = {
      id: `ext-header-${String(index)}`,
      name: `Extension Header #${String(index)} — ${EXT_HEADER_NAMES.get(currentType) ?? 'Unknown'}`,
      offset: cursor,
      length: extLength,
      rawBytes: data.slice(cursor, cursor + extLength),
      rawValue: declaredNextType,
      valid: nextClassification.kind !== 'unknown',
      warnings: [],
    };
    if (nextClassification.name !== undefined) extensionField.physicalValue = nextClassification.name;
    applyNextHeaderWarning(extensionField, nextClassification, warnings);
    fields.push(extensionField);

    cursor += extLength;
    currentType = declaredNextType;
    currentClassification = nextClassification;
  }

  const payload = data.slice(cursor);
  if (payload.length > 0) {
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: cursor,
      length: payload.length,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [],
    });
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

export function parseIpv6(data: Uint8Array): ParseResult {
  return parseIpv6Frame(data, {});
}

function readContextOptions(context: ParseContext | undefined): Ipv6ParseOptions {
  const options: Ipv6ParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ipv6Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + üst nibble 6. */
  canParse(data: Uint8Array): boolean {
    if (data.length < BASE_HEADER_LENGTH) return false;
    return (byteAt(data, 0) >>> 4) === EXPECTED_VERSION;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIpv6Frame(data, readContextOptions(context));
  },
};

function ipv6BaseHeader(fields: {
  payloadLength: number;
  nextHeader: number;
  hopLimit: number;
  source: readonly number[];
  destination: readonly number[];
  versionClassFlow?: readonly [number, number, number, number];
}): number[] {
  const versionClassFlow = fields.versionClassFlow ?? [0x60, 0x00, 0x00, 0x00];
  return [
    ...versionClassFlow,
    (fields.payloadLength >>> 8) & 0xff,
    fields.payloadLength & 0xff,
    fields.nextHeader,
    fields.hopLimit,
    ...fields.source,
    ...fields.destination,
  ];
}

const DOC_SOURCE = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const DOC_DESTINATION = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];

/**
 * Örnek çerçeveler. Adresler RFC 3849'un belgeleme öneki `2001:db8::/32`den
 * (gerçek bir ağı işaret etmez). Ext header içerikleri (Pad seçenekleri)
 * ANLAMSIZDIR — yalnız zincir yürüyüşünü kanıtlamaya yeter, RFC 8200 §4.3'ün
 * dışına çıkmaz.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'tcp-basic',
    name: 'protocol.ipv6.example.tcpBasic.name',
    // Next Header 6 (TCP) — hiç uzantı başlığı yok, doğrudan üst katman uyarısı.
    bytes: Uint8Array.from([
      ...ipv6BaseHeader({
        payloadLength: 4,
        nextHeader: 6,
        hopLimit: 64,
        source: DOC_SOURCE,
        destination: DOC_DESTINATION,
      }),
      0xaa, 0xbb, 0xcc, 0xdd,
    ]),
    description: 'protocol.ipv6.example.tcpBasic.description',
    expectedValid: true,
  },
  {
    id: 'hop-by-hop-then-udp',
    name: 'protocol.ipv6.example.hopByHopThenUdp.name',
    // Next Header 0 (Hop-by-Hop) → zincir yürür → ext header'ın kendi Next
    // Header'ı 17 (UDP), HdrExtLen 0 → 8 baytlık asgari uzantı.
    bytes: Uint8Array.from([
      ...ipv6BaseHeader({
        payloadLength: 8 + 4,
        nextHeader: 0,
        hopLimit: 64,
        source: DOC_SOURCE,
        destination: DOC_DESTINATION,
      }),
      17, 0, 0, 0, 0, 0, 0, 0,
      0x01, 0x02, 0x03, 0x04,
    ]),
    description: 'protocol.ipv6.example.hopByHopThenUdp.description',
    expectedValid: true,
  },
  {
    id: 'unknown-next-header',
    name: 'protocol.ipv6.example.unknownNextHeader.name',
    // Next Header 253 (IANA "deneysel kullanım için ayrılmış") dar kümede yok —
    // zincir hiç başlamaz, HATA değil UYARI.
    bytes: Uint8Array.from([
      ...ipv6BaseHeader({
        payloadLength: 2,
        nextHeader: 253,
        hopLimit: 64,
        source: DOC_SOURCE,
        destination: DOC_DESTINATION,
      }),
      0x11, 0x22,
    ]),
    description: 'protocol.ipv6.example.unknownNextHeader.description',
    expectedValid: true,
  },
  {
    id: 'truncated-extension-header',
    name: 'protocol.ipv6.example.truncatedExtensionHeader.name',
    // Next Header 0 (Hop-by-Hop) ama ext header için yalnız 2 bayt geldi;
    // HdrExtLen=5 → 48 bayt bildiriyor, tamponda o kadar yok → truncated-frame.
    bytes: Uint8Array.from([
      ...ipv6BaseHeader({
        payloadLength: 4,
        nextHeader: 0,
        hopLimit: 64,
        source: DOC_SOURCE,
        destination: DOC_DESTINATION,
      }),
      0x06, 0x05,
    ]),
    description: 'protocol.ipv6.example.truncatedExtensionHeader.description',
    expectedValid: false,
  },
];

export const ipv6Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: ipv6Parser,
  documentation: {
    summary: 'protocol.ipv6.documentation.summary',
    layer: 'network',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
