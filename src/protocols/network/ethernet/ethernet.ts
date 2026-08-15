/**
 * Ethernet II / IEEE 802.3 / VLAN 802.1Q — ÜÇ PLUGIN, TEK PARSER.
 *
 * canClassic.ts'in CAN 2.0A/2.0B emsali: üç sayfanın tel biçimi aynıdır, ayrım
 * yalnız MAC çiftinden sonraki 2 baytlık alanın (ve varsa VLAN TCI'ının)
 * YORUMUNDADIR. Ortak çözüm `ethernetFrame.ts`teki `decodeEthernetFrame`de
 * yaşar; burada yalnız üç `ProtocolParser`/`ProtocolPlugin` kaydı ve örnek
 * çerçeveler var.
 *
 * Sayfanın beklediği yorum ile çerçevenin gerçek yorumu uyuşmazsa HATA
 * ÜRETİLMEZ, uyarı basılır (CAN'ın "extended çerçeve base sayfasında" deseni):
 * IEEE 802.3 sayfasına EtherType'lı bir çerçeve yapıştıran kullanıcı "çözülemedi"
 * değil, "bu Ethernet II gibi görünüyor" cevabını hak eder.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  ETHERTYPE_MIN,
  LENGTH_MAX,
  MIN_HEADER_LENGTH,
  VLAN_TPID,
  decodeEthernetFrame,
  peekTypeOrLengthField,
} from './ethernetFrame';
import type { EthernetPageKind } from './ethernetFrame';

/** Kayıt defterindeki ve katalogdaki kimliklerle AYNI olmak zorunda: bağ bu string. */
const ETHERNET_II_ID = 'ethernet-ii';
const IEEE_802_3_ID = 'ieee-802-3';
const VLAN_802_1Q_ID = 'vlan-802-1q';
/** Protokol adları veridir, çeviriye girmez (CLAUDE.md). */
const ETHERNET_II_NAME = 'Ethernet II';
const IEEE_802_3_NAME = 'IEEE 802.3';
const VLAN_802_1Q_NAME = 'VLAN 802.1Q';

const ERROR_FRAME_TOO_SHORT = 'protocol.ethernet.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ethernet.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ethernet.error.aborted';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

interface EthernetParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseEthernetFrameInternal(
  data: Uint8Array,
  protocolId: string,
  expectedKind: EthernetPageKind,
  options: EthernetParseOptions,
): ParseResult {
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
    // `consumedBytes: 0` + `recoverable: true` = "daha çok veri bekle".
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

  const decoded = decodeEthernetFrame(data, { expectedKind });
  const warnings: ProtocolWarning[] = decoded.warnings.map(toProtocolWarning);
  const errors: ProtocolError[] = [...decoded.errors];

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata: decoded.metadata,
  });

  const frame: ParsedFrame = {
    protocol: protocolId,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: [...decoded.fields],
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/** Tek bir Ethernet çerçevesini çözer — `data` DST/SRC MAC + tip/uzunluk alanını
 * (+ varsa VLAN tag'i + payload'ı) taşıyan ham baytlardır. */
export function parseEthernetFrame(data: Uint8Array, expectedKind: EthernetPageKind): ParseResult {
  return parseEthernetFrameInternal(data, expectedKind, expectedKind, {});
}

function readContextOptions(context: ParseContext | undefined): EthernetParseOptions {
  const options: EthernetParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ethernetIiParser: ProtocolParser = {
  protocolId: ETHERNET_II_ID,
  displayName: ETHERNET_II_NAME,
  canParse(data: Uint8Array): boolean {
    const value = peekTypeOrLengthField(data);
    return value !== undefined && value >= ETHERTYPE_MIN && value !== VLAN_TPID;
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseEthernetFrameInternal(data, ETHERNET_II_ID, 'ethernet-ii', readContextOptions(context));
  },
};

export const ieee8023Parser: ProtocolParser = {
  protocolId: IEEE_802_3_ID,
  displayName: IEEE_802_3_NAME,
  canParse(data: Uint8Array): boolean {
    const value = peekTypeOrLengthField(data);
    return value !== undefined && value <= LENGTH_MAX;
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseEthernetFrameInternal(data, IEEE_802_3_ID, 'ieee-802-3', readContextOptions(context));
  },
};

export const vlan8021qParser: ProtocolParser = {
  protocolId: VLAN_802_1Q_ID,
  displayName: VLAN_802_1Q_NAME,
  canParse(data: Uint8Array): boolean {
    return peekTypeOrLengthField(data) === VLAN_TPID;
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseEthernetFrameInternal(data, VLAN_802_1Q_ID, 'vlan-802-1q', readContextOptions(context));
  },
};

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Küçük yapı taşları — örnek çerçeveler elle bayt bayt yazmak yerine buradan
 * kurulur, `canClassic.ts`teki `buildCanClassicFrame` gerekçesiyle aynı. */
function mac(bytes: readonly number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

function uint16be(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 8) & 0xff, value & 0xff]);
}

function buildEthernetFrame(
  destination: Uint8Array,
  source: Uint8Array,
  ...rest: readonly Uint8Array[]
): Uint8Array {
  return concatBytes(destination, source, ...rest);
}

function buildVlanTag(pcp: number, dei: number, vid: number): Uint8Array {
  const tci = ((pcp & 0x7) << 13) | ((dei & 0x1) << 12) | (vid & 0x0fff);
  return concatBytes(uint16be(VLAN_TPID), uint16be(tci));
}

const DST_UNICAST_A = mac([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);
const DST_UNICAST_B = mac([0x00, 0x12, 0x34, 0x56, 0x78, 0x9a]);
// Spec "Frame örneği" (25430-25460) bu adresi doğrudan veriyor.
const SRC_SPEC_EXAMPLE = mac([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
const BROADCAST_MAC = mac([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

/**
 * ARP request payload'ı — spec'in "ARP Request Decoder" örneğiyle (08-ag-ethernet.md)
 * aynı IP çifti: Sender 192.168.1.10, Target 192.168.1.20. Ethernet motoru bu
 * payload'ı ÇÖZMEZ (katman zinciri istisnası), yalnız gerçekçi bir ARP çerçevesi
 * göstermek için elle kuruldu.
 */
const ARP_REQUEST_PAYLOAD = Uint8Array.from([
  0x00, 0x01, // HTYPE: Ethernet
  0x08, 0x00, // PTYPE: IPv4
  0x06, // HLEN
  0x04, // PLEN
  0x00, 0x01, // OPER: request
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, // SHA
  0xc0, 0xa8, 0x01, 0x0a, // SPA: 192.168.1.10
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // THA
  0xc0, 0xa8, 0x01, 0x14, // TPA: 192.168.1.20
]);

const ETHERNET_II_EXAMPLES: ExampleFrame[] = [
  {
    id: 'broadcast-arp',
    name: 'protocol.ethernet.ethernetII.example.broadcastArp.name',
    // Spec "Frame örneği" (25430-25460): FF..FF / 00:11:22:33:44:55 / 08 06 / ...
    bytes: buildEthernetFrame(BROADCAST_MAC, SRC_SPEC_EXAMPLE, uint16be(0x0806), ARP_REQUEST_PAYLOAD),
    description: 'protocol.ethernet.ethernetII.example.broadcastArp.description',
    expectedValid: true,
  },
  {
    id: 'ipv4-unicast',
    name: 'protocol.ethernet.ethernetII.example.ipv4Unicast.name',
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      uint16be(0x0800),
      Uint8Array.from({ length: 20 }, (_unused, index) => index),
    ),
    description: 'protocol.ethernet.ethernetII.example.ipv4Unicast.description',
    expectedValid: true,
  },
  {
    id: 'unknown-ethertype',
    name: 'protocol.ethernet.ethernetII.example.unknownEtherType.name',
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      uint16be(0x9000),
      Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
    ),
    description: 'protocol.ethernet.ethernetII.example.unknownEtherType.description',
    expectedValid: true,
  },
  {
    id: 'fcs-opportunistic-match',
    name: 'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.name',
    // Son 4 bayt bağımsız hesaplandı (Python `zlib.crc32`, dosya başı kaynak
    // uyarısı değil ama motor testinde ayrıca doğrulanır): DST/SRC/TYPE/PAYLOAD
    // baytlarının CRC-32'si `0x29134A3D`, little-endian yazımı `3D 4A 13 29`.
    bytes: buildEthernetFrame(
      DST_UNICAST_B,
      SRC_SPEC_EXAMPLE,
      uint16be(0x0800),
      Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x3d, 0x4a, 0x13, 0x29]),
    ),
    description: 'protocol.ethernet.ethernetII.example.fcsOpportunisticMatch.description',
    expectedValid: true,
  },
];

const IEEE_802_3_EXAMPLES: ExampleFrame[] = [
  {
    id: 'snap-length-frame',
    name: 'protocol.ethernet.ieee8023.example.snapLengthFrame.name',
    // Spec'in kendi örneği (25601 civarı): "Field: 0x002E → Interpretation:
    // IEEE 802.3 Payload Length = 46 bytes".
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      uint16be(0x002e),
      new Uint8Array(46),
    ),
    description: 'protocol.ethernet.ieee8023.example.snapLengthFrame.description',
    expectedValid: true,
  },
  {
    id: 'undefined-range',
    name: 'protocol.ethernet.ieee8023.example.undefinedRange.name',
    // 1520 (0x05F0): 1501-1535 tanımsız aralık — uyarı, hata değil.
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      uint16be(0x05f0),
      Uint8Array.from([0x00, 0x01, 0x02, 0x03]),
    ),
    description: 'protocol.ethernet.ieee8023.example.undefinedRange.description',
    expectedValid: true,
  },
];

const VLAN_802_1Q_EXAMPLES: ExampleFrame[] = [
  {
    id: 'single-tag',
    name: 'protocol.ethernet.vlan8021q.example.singleTag.name',
    // Spec'in kendi örneği (25696 civarı): PCP 5, VLAN ID 100.
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      buildVlanTag(5, 0, 100),
      uint16be(0x0800),
      Uint8Array.from([0x00, 0x01, 0x02, 0x03]),
    ),
    description: 'protocol.ethernet.vlan8021q.example.singleTag.description',
    expectedValid: true,
  },
  {
    id: 'double-tag-stacked',
    name: 'protocol.ethernet.vlan8021q.example.doubleTagStacked.name',
    // Spec'in kendi VLAN stacking örneği (25812 civarı): Tag#1 VID100, Tag#2 VID20.
    bytes: buildEthernetFrame(
      DST_UNICAST_A,
      SRC_SPEC_EXAMPLE,
      buildVlanTag(0, 0, 100),
      buildVlanTag(0, 0, 20),
      uint16be(0x0800),
      Uint8Array.from([0x00, 0x01]),
    ),
    description: 'protocol.ethernet.vlan8021q.example.doubleTagStacked.description',
    expectedValid: true,
  },
  {
    id: 'truncated-tci',
    name: 'protocol.ethernet.vlan8021q.example.truncatedTci.name',
    // TPID var ama TCI'ın yalnız ilk baytı var — truncated-frame basar, MAC
    // alanları yine görünür.
    bytes: concatBytes(DST_UNICAST_A, SRC_SPEC_EXAMPLE, uint16be(VLAN_TPID), Uint8Array.from([0xa0])),
    description: 'protocol.ethernet.vlan8021q.example.truncatedTci.description',
    expectedValid: false,
  },
];

export const ethernetIiPlugin: ProtocolPlugin = {
  id: ETHERNET_II_ID,
  name: ETHERNET_II_NAME,
  category: 'network-ethernet',
  parser: ethernetIiParser,
  documentation: {
    summary: 'protocol.ethernet.ethernetII.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: ETHERNET_II_EXAMPLES,
};

export const ieee8023Plugin: ProtocolPlugin = {
  id: IEEE_802_3_ID,
  name: IEEE_802_3_NAME,
  category: 'network-ethernet',
  parser: ieee8023Parser,
  documentation: {
    summary: 'protocol.ethernet.ieee8023.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: IEEE_802_3_EXAMPLES,
};

export const vlan8021qPlugin: ProtocolPlugin = {
  id: VLAN_802_1Q_ID,
  name: VLAN_802_1Q_NAME,
  category: 'network-ethernet',
  parser: vlan8021qParser,
  documentation: {
    summary: 'protocol.ethernet.vlan8021q.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: VLAN_802_1Q_EXAMPLES,
};
