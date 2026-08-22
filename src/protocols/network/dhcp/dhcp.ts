/**
 * DHCP (RFC 2131) — BOOTP mesaj yapısı üstüne kurulu host konfigürasyon
 * protokolü. Girdi TEK bir DHCP mesajıdır (UDP sarmalayıcısı YOK —
 * `icmp.ts`teki karar 1'in aynısı, motorlar zincir KURMAZ).
 *
 * ── OPTIONS KLASİK TLV8'DİR, LLDP'NİN 7+9 BİT PAKETLİ BAŞLIĞIYLA AYNI DEĞİL ──
 * `Code(1B)+Length(1B)+Value(Length B)` — iki özel kod hariç: `0`(Pad, tek
 * bayt, hizalama) ve `255`(End, tek bayt, listeyi bitirir). Bu yürüyücü
 * BİLEREK `lldp.ts`teki yürüyücüden AYRI yazıldı (12b'nin düzeltmesi) — ikisi
 * de "TLV" ama bit düzeni farklı, paylaşılan bir motor YANLIŞ soyutlama olurdu.
 *
 * ── OPTION KÜMESİ DAR TUTULDU, TAM REGISTRY AYRI İŞ (spec:282) ──────────────
 * Spec'in kendi notu: "Tam IANA DHCP option registry ayrı güncellenebilir
 * veri kaynağı olmalıdır." Yalnız spec'in adlandırdığı yedi kod (1/3/6/50/
 * 51/53/54) anlamlandırılır; kalanı Code/Length/Value ham gösterilir — HATA
 * da UYARI da BASILMAZ, çünkü DHCP'de 100'den fazla standart seçenek vardır
 * ve dar kümenin dışı "anomali" değil "henüz adlandırılmadı" demektir
 * (LLDP'nin tanınmayan TLV uyarısından FARKLI bir karar, dosya başı).
 *
 * ── DORA/LEASE/MULTI-SERVER ÇOK-PAKET İŞİDİR ────────────────────────────────
 * Spec bunları "Toolkit ... oluşturur/izler" diye tarif eder (spec:284-290) —
 * tek çerçeve çözücüsünün değil, bir analyzer'ın işi (`icmp.ts`teki RTT/
 * eşleştirme sınırının aynısı).
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

const PROTOCOL_ID = 'dhcp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DHCP';

const OP_OFFSET = 0;
const HTYPE_OFFSET = 1;
const HLEN_OFFSET = 2;
const HOPS_OFFSET = 3;
const XID_OFFSET = 4;
const SECS_OFFSET = 8;
const FLAGS_OFFSET = 10;
const CIADDR_OFFSET = 12;
const YIADDR_OFFSET = 16;
const SIADDR_OFFSET = 20;
const GIADDR_OFFSET = 24;
const CHADDR_OFFSET = 28;
const CHADDR_LENGTH = 16;
const SNAME_OFFSET = 44;
const SNAME_LENGTH = 64;
const FILE_OFFSET = 108;
const FILE_LENGTH = 128;
const MAGIC_COOKIE_OFFSET = 236;
const MAGIC_COOKIE_LENGTH = 4;
const OPTIONS_OFFSET = 240;

/** BOOTP sabit gövde uzunluğu (magic cookie/options HARİÇ) — RFC 951 + RFC 1531. */
const FIXED_HEADER_LENGTH = 236;
const MAGIC_COOKIE = 0x63825363;

const WORD_LENGTH = 2;
const DOUBLE_WORD_LENGTH = 4;
const IPV4_ADDRESS_LENGTH = 4;
const ETHERNET_MAC_LENGTH = 6;
const ETHERNET_HTYPE = 1;

const BROADCAST_FLAG_BIT = 15;

const OP_BOOTREQUEST = 1;
const OP_BOOTREPLY = 2;
const OP_NAMES: ReadonlyMap<number, string> = new Map([
  [OP_BOOTREQUEST, 'BOOTREQUEST'],
  [OP_BOOTREPLY, 'BOOTREPLY'],
]);

const OPTION_PAD = 0;
const OPTION_SUBNET_MASK = 1;
const OPTION_ROUTER = 3;
const OPTION_DNS_SERVERS = 6;
const OPTION_REQUESTED_IP = 50;
const OPTION_LEASE_TIME = 51;
const OPTION_MESSAGE_TYPE = 53;
const OPTION_SERVER_IDENTIFIER = 54;
const OPTION_END = 255;

/** Spec'in dar tuttuğu yedi option (dosya başı). */
const OPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [OPTION_SUBNET_MASK, 'Subnet Mask'],
  [OPTION_ROUTER, 'Router'],
  [OPTION_DNS_SERVERS, 'DNS Servers'],
  [OPTION_REQUESTED_IP, 'Requested IP Address'],
  [OPTION_LEASE_TIME, 'Lease Time'],
  [OPTION_MESSAGE_TYPE, 'DHCP Message Type'],
  [OPTION_SERVER_IDENTIFIER, 'Server Identifier'],
]);

/** RFC 2131 §3.1 — DORA akışının temeli (spec:271). */
const MESSAGE_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'DHCPDISCOVER'],
  [2, 'DHCPOFFER'],
  [3, 'DHCPREQUEST'],
  [4, 'DHCPDECLINE'],
  [5, 'DHCPACK'],
  [6, 'DHCPNAK'],
  [7, 'DHCPRELEASE'],
  [8, 'DHCPINFORM'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.dhcp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.dhcp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.dhcp.error.aborted';
const ERROR_MAGIC_COOKIE_MISMATCH = 'protocol.dhcp.error.magicCookieMismatch';
const ERROR_OPTION_TRUNCATED = 'protocol.dhcp.error.optionTruncated';

const WARN_UNKNOWN_OP = 'protocol.dhcp.warning.unknownOp';
const WARN_MISSING_END_OPTION = 'protocol.dhcp.warning.missingEndOption';
const WARN_UNKNOWN_MESSAGE_TYPE = 'protocol.dhcp.warning.unknownMessageType';

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
    byteAt(data, offset) * 0x1000000 +
    (byteAt(data, offset + 1) << 16) +
    (byteAt(data, offset + 2) << 8) +
    byteAt(data, offset + 3)
  );
}

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

/** Birden çok IPv4 adresi taşıyabilen seçenekler (Router/DNS Servers) —
 * uzunluk 4'ün katı değilse ham bırakılır. */
function formatIpv4List(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0 || bytes.length % IPV4_ADDRESS_LENGTH !== 0) return undefined;
  const addresses: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += IPV4_ADDRESS_LENGTH) {
    addresses.push(formatIpv4Address(bytes.slice(offset, offset + IPV4_ADDRESS_LENGTH)));
  }
  return addresses.join(', ');
}

const UTF8_DECODER = new TextDecoder('utf-8');

/** `sname`/`file` genelde sıfırla dolu, sonuna kadar okunur — ilk NUL'den
 * sonrasını atar. Tamamı sıfırsa `undefined` (boş alan, ham bırakılır). */
function formatNullPaddedText(bytes: Uint8Array): string | undefined {
  const nulIndex = bytes.indexOf(0);
  const meaningful = nulIndex === -1 ? bytes : bytes.slice(0, nulIndex);
  return meaningful.length === 0 ? undefined : UTF8_DECODER.decode(meaningful);
}

interface DhcpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDhcpFrame(data: Uint8Array, options: DhcpParseOptions): ParseResult {
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

  const op = byteAt(data, OP_OFFSET);
  const opName = OP_NAMES.get(op);
  const opField: ParsedField = {
    id: 'op',
    name: 'op',
    offset: OP_OFFSET,
    length: 1,
    rawBytes: data.slice(OP_OFFSET, OP_OFFSET + 1),
    rawValue: op,
    valid: opName !== undefined,
    warnings: [],
  };
  if (opName !== undefined) opField.physicalValue = opName;
  else {
    opField.warnings = [WARN_UNKNOWN_OP];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_OP));
  }
  fields.push(opField);

  const htype = byteAt(data, HTYPE_OFFSET);
  fields.push({
    id: 'htype',
    name: 'htype',
    offset: HTYPE_OFFSET,
    length: 1,
    rawBytes: data.slice(HTYPE_OFFSET, HTYPE_OFFSET + 1),
    rawValue: htype,
    ...(htype === ETHERNET_HTYPE ? { physicalValue: 'Ethernet' } : {}),
    valid: true,
    warnings: [],
  });

  const hlen = byteAt(data, HLEN_OFFSET);
  fields.push({
    id: 'hlen',
    name: 'hlen',
    offset: HLEN_OFFSET,
    length: 1,
    rawBytes: data.slice(HLEN_OFFSET, HLEN_OFFSET + 1),
    rawValue: hlen,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'hops',
    name: 'hops',
    offset: HOPS_OFFSET,
    length: 1,
    rawBytes: data.slice(HOPS_OFFSET, HOPS_OFFSET + 1),
    rawValue: byteAt(data, HOPS_OFFSET),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'xid',
    name: 'xid',
    offset: XID_OFFSET,
    length: DOUBLE_WORD_LENGTH,
    rawBytes: data.slice(XID_OFFSET, XID_OFFSET + DOUBLE_WORD_LENGTH),
    rawValue: readUint32BE(data, XID_OFFSET),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'secs',
    name: 'secs',
    offset: SECS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(SECS_OFFSET, SECS_OFFSET + WORD_LENGTH),
    rawValue: readUint16BE(data, SECS_OFFSET),
    unit: 's',
    valid: true,
    warnings: [],
  });

  const flagsValue = readUint16BE(data, FLAGS_OFFSET);
  const flagsBytes = data.slice(FLAGS_OFFSET, FLAGS_OFFSET + WORD_LENGTH);
  fields.push({
    id: 'flags-broadcast',
    name: 'Broadcast Flag',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsBytes,
    rawValue: (flagsValue >>> BROADCAST_FLAG_BIT) & 0x1,
    valid: true,
    warnings: [],
  });

  const addressFields: readonly [string, string, number][] = [
    ['ciaddr', 'ciaddr (Client IP)', CIADDR_OFFSET],
    ['yiaddr', 'yiaddr (Your IP)', YIADDR_OFFSET],
    ['siaddr', 'siaddr (Server IP)', SIADDR_OFFSET],
    ['giaddr', 'giaddr (Relay Agent IP)', GIADDR_OFFSET],
  ];
  for (const [id, name, offset] of addressFields) {
    const addressBytes = data.slice(offset, offset + IPV4_ADDRESS_LENGTH);
    fields.push({
      id,
      name,
      offset,
      length: IPV4_ADDRESS_LENGTH,
      rawBytes: addressBytes,
      rawValue: formatIpv4Address(addressBytes),
      valid: true,
      warnings: [],
    });
  }

  const chaddrFull = data.slice(CHADDR_OFFSET, CHADDR_OFFSET + CHADDR_LENGTH);
  const chaddrMeaningful = chaddrFull.slice(0, hlen);
  fields.push({
    id: 'chaddr',
    name: 'chaddr (Client Hardware Address)',
    offset: CHADDR_OFFSET,
    length: CHADDR_LENGTH,
    rawBytes: chaddrFull,
    ...(htype === ETHERNET_HTYPE && hlen === ETHERNET_MAC_LENGTH
      ? { rawValue: formatMac(chaddrMeaningful) }
      : {}),
    valid: true,
    warnings: [],
  });

  const snameBytes = data.slice(SNAME_OFFSET, SNAME_OFFSET + SNAME_LENGTH);
  const snameText = formatNullPaddedText(snameBytes);
  fields.push({
    id: 'sname',
    name: 'sname (Server Host Name)',
    offset: SNAME_OFFSET,
    length: SNAME_LENGTH,
    rawBytes: snameBytes,
    ...(snameText === undefined ? {} : { rawValue: snameText }),
    valid: true,
    warnings: [],
  });

  const fileBytes = data.slice(FILE_OFFSET, FILE_OFFSET + FILE_LENGTH);
  const fileText = formatNullPaddedText(fileBytes);
  fields.push({
    id: 'file',
    name: 'file (Boot File Name)',
    offset: FILE_OFFSET,
    length: FILE_LENGTH,
    rawBytes: fileBytes,
    ...(fileText === undefined ? {} : { rawValue: fileText }),
    valid: true,
    warnings: [],
  });

  // Magic cookie + options yalnız tamponda gerçekten varsa değerlendirilir —
  // klasik BOOTP'nin (cookie'siz) yapısal olarak geçerli kalması için
  // (dosya başı, ipv4.ts'teki "canVerifyChecksum" kapılamasının emsali).
  if (data.length >= OPTIONS_OFFSET) {
    const cookieValue = readUint32BE(data, MAGIC_COOKIE_OFFSET);
    const cookieField: ParsedField = {
      id: 'magic-cookie',
      name: 'Magic Cookie',
      offset: MAGIC_COOKIE_OFFSET,
      length: MAGIC_COOKIE_LENGTH,
      rawBytes: data.slice(MAGIC_COOKIE_OFFSET, MAGIC_COOKIE_OFFSET + MAGIC_COOKIE_LENGTH),
      rawValue: cookieValue,
      valid: cookieValue === MAGIC_COOKIE,
      warnings: [],
    };
    fields.push(cookieField);

    if (cookieValue !== MAGIC_COOKIE) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_MAGIC_COOKIE_MISMATCH,
        offset: MAGIC_COOKIE_OFFSET,
        length: MAGIC_COOKIE_LENGTH,
        details: { expected: MAGIC_COOKIE, received: cookieValue },
      });
    } else {
      const occurrenceByCode = new Map<number, number>();
      let cursor = OPTIONS_OFFSET;
      let sawEnd = false;

      while (cursor < data.length) {
        const code = byteAt(data, cursor);
        if (code === OPTION_PAD) {
          cursor += 1;
          continue;
        }
        if (code === OPTION_END) {
          sawEnd = true;
          break;
        }
        if (cursor + 1 >= data.length) {
          errors.push({
            code: 'truncated-frame',
            message: ERROR_OPTION_TRUNCATED,
            offset: cursor,
            length: data.length - cursor,
            details: { reason: 'option-header' },
          });
          break;
        }
        const length = byteAt(data, cursor + 1);
        const valueOffset = cursor + 2;
        const valueEnd = valueOffset + length;
        if (valueEnd > data.length) {
          errors.push({
            code: 'truncated-frame',
            message: ERROR_OPTION_TRUNCATED,
            offset: valueOffset,
            length: valueEnd - data.length,
            details: { code, declaredLength: length },
          });
          break;
        }

        const value = data.slice(valueOffset, valueEnd);
        const occurrence = (occurrenceByCode.get(code) ?? 0) + 1;
        occurrenceByCode.set(code, occurrence);
        const suffix = occurrence === 1 ? '' : `-${String(occurrence)}`;
        const optionName = OPTION_NAMES.get(code);

        const optionField: ParsedField = {
          id: `option-${String(code)}${suffix}`,
          name: optionName ?? `Option ${String(code)}`,
          offset: valueOffset,
          length: value.length,
          rawBytes: value,
          valid: true,
          warnings: [],
        };

        if (code === OPTION_MESSAGE_TYPE && value.length === 1) {
          const messageTypeValue = byteAt(value, 0);
          const messageTypeName = MESSAGE_TYPE_NAMES.get(messageTypeValue);
          optionField.rawValue = messageTypeValue;
          if (messageTypeName === undefined) {
            optionField.warnings = [WARN_UNKNOWN_MESSAGE_TYPE];
            optionField.valid = false;
            warnings.push(toProtocolWarning(WARN_UNKNOWN_MESSAGE_TYPE));
          } else {
            optionField.physicalValue = messageTypeName;
          }
        } else if (
          (code === OPTION_SUBNET_MASK || code === OPTION_REQUESTED_IP || code === OPTION_SERVER_IDENTIFIER) &&
          value.length === IPV4_ADDRESS_LENGTH
        ) {
          optionField.rawValue = formatIpv4Address(value);
        } else if (code === OPTION_ROUTER || code === OPTION_DNS_SERVERS) {
          const formatted = formatIpv4List(value);
          if (formatted !== undefined) optionField.rawValue = formatted;
        } else if (code === OPTION_LEASE_TIME && value.length === DOUBLE_WORD_LENGTH) {
          optionField.rawValue = readUint32BE(value, 0);
          optionField.unit = 's';
        } else if (value.length > 0) {
          optionField.unit = 'B';
        }

        fields.push(optionField);
        cursor = valueEnd;
      }

      if (!sawEnd && errors.length === 0) {
        warnings.push(toProtocolWarning(WARN_MISSING_END_OPTION));
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

export function parseDhcp(data: Uint8Array): ParseResult {
  return parseDhcpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): DhcpParseOptions {
  const options: DhcpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const dhcpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk. DHCP'nin ayırt edici bir magic byte'ı
   * fixed header'dan önce yok (cookie 236. baytta) — auto-detection
   * uzunluğa dayanır (icmp.ts/udp.ts'in aynı sınırı). */
  canParse(data: Uint8Array): boolean {
    return data.length >= FIXED_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseDhcpFrame(data, readContextOptions(context));
  },
};

function dhcpMessage(fields: {
  op: number;
  xid: number;
  ciaddr?: readonly [number, number, number, number];
  yiaddr?: readonly [number, number, number, number];
  siaddr?: readonly [number, number, number, number];
  chaddr?: readonly number[];
  options: readonly number[];
}): number[] {
  const zeros = (count: number): number[] => new Array<number>(count).fill(0);
  const ip = (address?: readonly [number, number, number, number]): number[] =>
    address === undefined ? zeros(4) : [...address];
  const chaddr = fields.chaddr ?? [];
  return [
    fields.op,
    1, // htype = Ethernet
    6, // hlen
    0, // hops
    (fields.xid >>> 24) & 0xff,
    (fields.xid >>> 16) & 0xff,
    (fields.xid >>> 8) & 0xff,
    fields.xid & 0xff,
    ...zeros(2), // secs
    ...zeros(2), // flags
    ...ip(fields.ciaddr),
    ...ip(fields.yiaddr),
    ...ip(fields.siaddr),
    ...zeros(4), // giaddr
    ...chaddr,
    ...zeros(CHADDR_LENGTH - chaddr.length),
    ...zeros(SNAME_LENGTH),
    ...zeros(FILE_LENGTH),
    0x63,
    0x82,
    0x53,
    0x63, // magic cookie
    ...fields.options,
    OPTION_END,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'discover',
    name: 'protocol.dhcp.example.discover.name',
    bytes: Uint8Array.from(
      dhcpMessage({
        op: OP_BOOTREQUEST,
        xid: 0x12345678,
        chaddr: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        options: [OPTION_MESSAGE_TYPE, 1, 1], // DHCPDISCOVER
      }),
    ),
    description: 'protocol.dhcp.example.discover.description',
    expectedValid: true,
  },
  {
    id: 'offer',
    name: 'protocol.dhcp.example.offer.name',
    bytes: Uint8Array.from(
      dhcpMessage({
        op: OP_BOOTREPLY,
        xid: 0x12345678,
        yiaddr: [192, 168, 1, 100],
        siaddr: [192, 168, 1, 1],
        chaddr: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
        options: [
          OPTION_MESSAGE_TYPE, 1, 2, // DHCPOFFER
          OPTION_SUBNET_MASK, 4, 255, 255, 255, 0,
          OPTION_ROUTER, 4, 192, 168, 1, 1,
          OPTION_LEASE_TIME, 4, 0x00, 0x00, 0x0e, 0x10, // 3600s
          OPTION_SERVER_IDENTIFIER, 4, 192, 168, 1, 1,
        ],
      }),
    ),
    description: 'protocol.dhcp.example.offer.description',
    expectedValid: true,
  },
  {
    id: 'unknown-message-type',
    name: 'protocol.dhcp.example.unknownMessageType.name',
    bytes: Uint8Array.from(
      dhcpMessage({
        op: OP_BOOTREPLY,
        xid: 0x0001,
        options: [OPTION_MESSAGE_TYPE, 1, 99],
      }),
    ),
    description: 'protocol.dhcp.example.unknownMessageType.description',
    expectedValid: true,
  },
  {
    id: 'bad-magic-cookie',
    name: 'protocol.dhcp.example.badMagicCookie.name',
    bytes: Uint8Array.from(
      (() => {
        const bytes = dhcpMessage({ op: OP_BOOTREQUEST, xid: 0x0002, options: [] });
        bytes[MAGIC_COOKIE_OFFSET] = 0x00;
        return bytes;
      })(),
    ),
    description: 'protocol.dhcp.example.badMagicCookie.description',
    expectedValid: false,
  },
];

export const dhcpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: dhcpParser,
  documentation: {
    summary: 'protocol.dhcp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
