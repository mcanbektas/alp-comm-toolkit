/**
 * LLDP (IEEE 802.1AB) — komşu cihazların kimlik/topoloji bilgisini TLV
 * dizisi olarak duyurduğu protokol. Girdi TEK bir LLDPDU'dur (Ethernet
 * sarmalayıcısı YOK — `arp.ts`teki karar 1'in aynısı; EtherType 0x88CC
 * `ethernetFrame.ts`teki "üst katmanı şu sayfada çöz" uyarısıyla buraya
 * işaret eder).
 *
 * ── TLV BAŞLIĞI 7+9 BİT PAKETLİDİR, DHCP OPTION'LARIYLA AYNI DEĞİL ───────────
 * LLDP TLV başlığı `Type(7 bit)+Length(9 bit)` tek 2 baytta paketlenir — bu
 * yürüyücü DHCP/TFTP gibi klasik TLV8 (`Type(1B)+Length(1B)`) protokollerine
 * DOĞRUDAN taşınamaz (dalga 12 briefinin "12c'nin DHCP option'ları aynısını
 * ister" varsayımı bit düzeyinde YANLIŞ çıktı — düzeltme burada not edildi).
 * Bu yüzden yürüyücü LLDP'ye özel, paylaşılan bir `protocol-core/decoding`
 * modülü DEĞİL.
 *
 * ── ZORUNLU TLV'LER ALAN ALANA ÇÖZÜLÜR, ORGANİZASYONA ÖZGÜ OLANLAR OUI/SUBTYPE
 *    DÜZEYİNDE BIRAKILIR ────────────────────────────────────────────────────
 * Chassis ID/Port ID (subtype+ID), TTL, Port/System Description, System Name,
 * System Capabilities ve Management Address alan alana çözülür (spec
 * 08-ag-ethernet.md:698-712). Organizationally Specific TLV'ler (OUI+subtype
 * ile dış veritabanından çözülür, spec:704) yalnız OUI/Subtype/Data'ya
 * ayrıştırılır — vendor adı çözümü katalogdaki `definitions:['vendor-map']`
 * kanalının işi, bu motorun değil.
 *
 * ── AYNI TLV TÜRÜ TEKRARLARSA ALAN ID'LERİ NUMARALANIR ──────────────────────
 * Management Address ve Organizationally Specific TLV'ler spec gereği birden
 * çok kez görünebilir (802.1AB) — ikinci ve sonraki geçişte alan id'lerine
 * `-2`, `-3`… eklenir, aksi hâlde `ParsedField.id` çakışırdı.
 *
 * ── NEIGHBOR TABLE, TOPOLOGY BUILDER, NEIGHBOR AGE ÇOK-PAKET İŞİDİR ─────────
 * Spec bunları "Toolkit ... oluşturur" diye tarif eder (spec:701-712) — tek
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

const PROTOCOL_ID = 'lldp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'LLDP';

const TLV_HEADER_LENGTH = 2;

const TLV_TYPE_END = 0;
const TLV_TYPE_CHASSIS_ID = 1;
const TLV_TYPE_PORT_ID = 2;
const TLV_TYPE_TTL = 3;
const TLV_TYPE_PORT_DESCRIPTION = 4;
const TLV_TYPE_SYSTEM_NAME = 5;
const TLV_TYPE_SYSTEM_DESCRIPTION = 6;
const TLV_TYPE_SYSTEM_CAPABILITIES = 7;
const TLV_TYPE_MANAGEMENT_ADDRESS = 8;
const TLV_TYPE_ORGANIZATIONALLY_SPECIFIC = 127;

const MAC_SUBTYPE_CHASSIS = 4;
const MAC_SUBTYPE_PORT = 3;
const ETHERNET_MAC_LENGTH = 6;

/** 802.1AB Table 8-2 — Chassis ID subtype adları. */
const CHASSIS_ID_SUBTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Chassis Component'],
  [2, 'Interface Alias'],
  [3, 'Port Component'],
  [4, 'MAC Address'],
  [5, 'Network Address'],
  [6, 'Interface Name'],
  [7, 'Locally Assigned'],
]);

/** 802.1AB Table 8-3 — Port ID subtype adları. */
const PORT_ID_SUBTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Interface Alias'],
  [2, 'Port Component'],
  [3, 'MAC Address'],
  [4, 'Network Address'],
  [5, 'Interface Name'],
  [6, 'Agent Circuit ID'],
  [7, 'Locally Assigned'],
]);

/** UTF-8 metin olarak yorumlanması BEKLENEN subtype'lar (dosya başı) —
 * MAC/Network Address hariç geri kalanı. */
const TEXT_LIKE_SUBTYPES: ReadonlySet<number> = new Set([1, 2, 5, 6, 7]);

/** IANA Address Family Numbers'ın Management Address'te sık görülen dar alt
 * kümesi (802.1AB spec bunu sabit bir katalog olarak vermez, saha gerçeği). */
const MANAGEMENT_ADDRESS_SUBTYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'IPv4'],
  [2, 'IPv6'],
]);

/** 802.1AB Table 8-4'ün ilk 8 biti (dar tutuldu — C-VLAN/S-VLAN/Two-port MAC
 * Relay gibi daha yeni/nadir bitler dışarıda, dosya başı). */
const CAPABILITY_BIT_NAMES: readonly (readonly [number, string])[] = [
  [0, 'Other'],
  [1, 'Repeater'],
  [2, 'Bridge'],
  [3, 'WLAN Access Point'],
  [4, 'Router'],
  [5, 'Telephone'],
  [6, 'DOCSIS Cable Device'],
  [7, 'Station Only'],
];

const ERROR_FRAME_TOO_SHORT = 'protocol.lldp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.lldp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.lldp.error.aborted';
const ERROR_TLV_TRUNCATED = 'protocol.lldp.error.tlvTruncated';

const WARN_MISSING_END_TLV = 'protocol.lldp.warning.missingEndTlv';
const WARN_END_TLV_LENGTH_NOT_ZERO = 'protocol.lldp.warning.endTlvLengthNotZero';
const WARN_UNRECOGNIZED_TLV_TYPE = 'protocol.lldp.warning.unrecognizedTlvType';

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

function formatIpv6Address(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    groups.push(((byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1)).toString(16));
  }
  return groups.join(':');
}

function formatOui(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(':');
}

const UTF8_DECODER = new TextDecoder('utf-8');

/** Metin-benzeri subtype'larda UTF-8 dener; MAC subtype'ında `formatMac`
 * kullanır; aksi hâlde ham bırakır (rawValue verilmez, dosya başı). */
function formatIdentifier(subtype: number, id: Uint8Array, macSubtype: number): string | undefined {
  if (subtype === macSubtype && id.length === ETHERNET_MAC_LENGTH) return formatMac(id);
  if (TEXT_LIKE_SUBTYPES.has(subtype)) return UTF8_DECODER.decode(id);
  return undefined;
}

interface LldpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** Aynı TLV türü birden çok kez görünürse (Management Address, Organizationally
 * Specific — dosya başı) ikinci ve sonraki geçişte id'lere `-n` ekler. */
function createIdSuffixer(): (type: number) => string {
  const occurrenceByType = new Map<number, number>();
  return (type: number): string => {
    const occurrence = (occurrenceByType.get(type) ?? 0) + 1;
    occurrenceByType.set(type, occurrence);
    return occurrence === 1 ? '' : `-${String(occurrence)}`;
  };
}

function parseLldpFrame(data: Uint8Array, options: LldpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < TLV_HEADER_LENGTH) {
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
  const suffixFor = createIdSuffixer();

  let cursor = 0;
  let sawEnd = false;

  while (cursor < data.length) {
    if (data.length - cursor < TLV_HEADER_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TLV_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
        details: { reason: 'tlv-header' },
      });
      break;
    }

    const header0 = byteAt(data, cursor);
    const header1 = byteAt(data, cursor + 1);
    const tlvType = (header0 >>> 1) & 0x7f;
    const tlvLength = ((header0 & 0x01) << 8) | header1;
    const valueOffset = cursor + TLV_HEADER_LENGTH;
    const valueEnd = valueOffset + tlvLength;

    if (valueEnd > data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TLV_TRUNCATED,
        offset: valueOffset,
        length: valueEnd - data.length,
        details: { tlvType, declaredLength: tlvLength, availableBytes: data.length - valueOffset },
      });
      break;
    }

    const value = data.slice(valueOffset, valueEnd);
    const suffix = suffixFor(tlvType);

    if (tlvType === TLV_TYPE_END) {
      if (tlvLength !== 0) {
        warnings.push(toProtocolWarning(WARN_END_TLV_LENGTH_NOT_ZERO));
      }
      sawEnd = true;
      cursor = valueEnd;
      break;
    } else if (tlvType === TLV_TYPE_CHASSIS_ID || tlvType === TLV_TYPE_PORT_ID) {
      const isChassis = tlvType === TLV_TYPE_CHASSIS_ID;
      const subtypeNames = isChassis ? CHASSIS_ID_SUBTYPE_NAMES : PORT_ID_SUBTYPE_NAMES;
      const macSubtype = isChassis ? MAC_SUBTYPE_CHASSIS : MAC_SUBTYPE_PORT;
      const baseName = isChassis ? 'chassis-id' : 'port-id';
      const subtype = byteAt(value, 0);
      const id = value.slice(1);
      const subtypeName = subtypeNames.get(subtype);
      fields.push({
        id: `${baseName}-subtype${suffix}`,
        name: isChassis ? 'Chassis ID Subtype' : 'Port ID Subtype',
        offset: valueOffset,
        length: 1,
        rawBytes: value.slice(0, 1),
        rawValue: subtype,
        ...(subtypeName === undefined ? {} : { physicalValue: subtypeName }),
        valid: true,
        warnings: [],
      });
      const formattedId = formatIdentifier(subtype, id, macSubtype);
      fields.push({
        id: `${baseName}${suffix}`,
        name: isChassis ? 'Chassis ID' : 'Port ID',
        offset: valueOffset + 1,
        length: id.length,
        rawBytes: id,
        ...(formattedId === undefined ? {} : { rawValue: formattedId }),
        valid: true,
        warnings: [],
      });
    } else if (tlvType === TLV_TYPE_TTL) {
      fields.push({
        id: `ttl${suffix}`,
        name: 'TTL',
        offset: valueOffset,
        length: value.length,
        rawBytes: value,
        rawValue: readUint16BE(value, 0),
        unit: 's',
        valid: true,
        warnings: [],
      });
    } else if (
      tlvType === TLV_TYPE_PORT_DESCRIPTION ||
      tlvType === TLV_TYPE_SYSTEM_NAME ||
      tlvType === TLV_TYPE_SYSTEM_DESCRIPTION
    ) {
      const fieldId =
        tlvType === TLV_TYPE_PORT_DESCRIPTION
          ? 'port-description'
          : tlvType === TLV_TYPE_SYSTEM_NAME
            ? 'system-name'
            : 'system-description';
      const fieldName =
        tlvType === TLV_TYPE_PORT_DESCRIPTION
          ? 'Port Description'
          : tlvType === TLV_TYPE_SYSTEM_NAME
            ? 'System Name'
            : 'System Description';
      fields.push({
        id: `${fieldId}${suffix}`,
        name: fieldName,
        offset: valueOffset,
        length: value.length,
        rawBytes: value,
        rawValue: UTF8_DECODER.decode(value),
        valid: true,
        warnings: [],
      });
    } else if (tlvType === TLV_TYPE_SYSTEM_CAPABILITIES) {
      const capabilities = readUint16BE(value, 0);
      const enabled = readUint16BE(value, 2);
      const namesFor = (bitmap: number): string | undefined => {
        const names = CAPABILITY_BIT_NAMES.filter(([bit]) => ((bitmap >>> bit) & 0x1) === 1).map(
          ([, name]) => name,
        );
        return names.length === 0 ? undefined : names.join(', ');
      };
      const capabilityNames = namesFor(capabilities);
      const enabledNames = namesFor(enabled);
      fields.push({
        id: `system-capabilities${suffix}`,
        name: 'System Capabilities',
        offset: valueOffset,
        length: 2,
        rawBytes: value.slice(0, 2),
        rawValue: capabilities,
        ...(capabilityNames === undefined ? {} : { physicalValue: capabilityNames }),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: `system-capabilities-enabled${suffix}`,
        name: 'Enabled Capabilities',
        offset: valueOffset + 2,
        length: 2,
        rawBytes: value.slice(2, 4),
        rawValue: enabled,
        ...(enabledNames === undefined ? {} : { physicalValue: enabledNames }),
        valid: true,
        warnings: [],
      });
    } else if (tlvType === TLV_TYPE_MANAGEMENT_ADDRESS) {
      // 802.1AB §8.5.9: AddrStrLen(1B) + AddrSubtype(1B) + Address((AddrStrLen-1)B)
      // + IfSubtype(1B) + IfNumber(4B) + OidLen(1B) + OID(OidLenB).
      const addressStringLength = byteAt(value, 0);
      const addressSubtype = byteAt(value, 1);
      const addressByteCount = Math.max(0, addressStringLength - 1);
      const address = value.slice(2, 2 + addressByteCount);
      let tail = 2 + addressByteCount;
      const interfaceNumber = readUint32BE(value, tail + 1);
      tail += 1 + 4;
      const oidLength = byteAt(value, tail);
      const oid = value.slice(tail + 1, tail + 1 + oidLength);
      const addressSubtypeName = MANAGEMENT_ADDRESS_SUBTYPE_NAMES.get(addressSubtype);

      fields.push({
        id: `management-address-subtype${suffix}`,
        name: 'Management Address Subtype',
        offset: valueOffset + 1,
        length: 1,
        rawBytes: value.slice(1, 2),
        rawValue: addressSubtype,
        ...(addressSubtypeName === undefined ? {} : { physicalValue: addressSubtypeName }),
        valid: true,
        warnings: [],
      });
      const formattedAddress =
        addressSubtype === 1 && address.length === 4
          ? formatIpv4Address(address)
          : addressSubtype === 2 && address.length === 16
            ? formatIpv6Address(address)
            : addressSubtype === 6 && address.length === ETHERNET_MAC_LENGTH
              ? formatMac(address)
              : undefined;
      fields.push({
        id: `management-address${suffix}`,
        name: 'Management Address',
        offset: valueOffset + 2,
        length: address.length,
        rawBytes: address,
        ...(formattedAddress === undefined ? {} : { rawValue: formattedAddress }),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: `management-address-interface-subtype${suffix}`,
        name: 'Interface Numbering Subtype',
        offset: valueOffset + 2 + addressByteCount,
        length: 1,
        rawBytes: value.slice(2 + addressByteCount, 2 + addressByteCount + 1),
        rawValue: byteAt(value, 2 + addressByteCount),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: `management-address-interface-number${suffix}`,
        name: 'Interface Number',
        offset: valueOffset + 2 + addressByteCount + 1,
        length: 4,
        rawBytes: value.slice(2 + addressByteCount + 1, 2 + addressByteCount + 5),
        rawValue: interfaceNumber,
        valid: true,
        warnings: [],
      });
      if (oid.length > 0) {
        fields.push({
          id: `management-address-oid${suffix}`,
          name: 'OID',
          offset: valueOffset + tail + 1,
          length: oid.length,
          rawBytes: oid,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
    } else if (tlvType === TLV_TYPE_ORGANIZATIONALLY_SPECIFIC) {
      const oui = value.slice(0, 3);
      const orgSubtype = byteAt(value, 3);
      const orgData = value.slice(4);
      fields.push({
        id: `organizationally-specific-oui${suffix}`,
        name: 'Organizationally Specific OUI',
        offset: valueOffset,
        length: 3,
        rawBytes: oui,
        rawValue: formatOui(oui),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: `organizationally-specific-subtype${suffix}`,
        name: 'Organizationally Specific Subtype',
        offset: valueOffset + 3,
        length: 1,
        rawBytes: value.slice(3, 4),
        rawValue: orgSubtype,
        valid: true,
        warnings: [],
      });
      if (orgData.length > 0) {
        fields.push({
          id: `organizationally-specific-data${suffix}`,
          name: 'Organizationally Specific Data',
          offset: valueOffset + 4,
          length: orgData.length,
          rawBytes: orgData,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
    } else {
      // Tanınmayan/ayrılmış TLV türü — ham bırakılır, HATA değil UYARI (dosya başı).
      warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_TLV_TYPE));
      fields.push({
        id: `tlv-${String(tlvType)}${suffix}`,
        name: `TLV ${String(tlvType)}`,
        offset: valueOffset,
        length: value.length,
        rawBytes: value,
        unit: 'B',
        valid: false,
        warnings: [WARN_UNRECOGNIZED_TLV_TYPE],
      });
    }

    cursor = valueEnd;
  }

  if (!sawEnd && errors.length === 0) {
    warnings.push(toProtocolWarning(WARN_MISSING_END_TLV));
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

export function parseLldp(data: Uint8Array): ParseResult {
  return parseLldpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): LldpParseOptions {
  const options: LldpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const lldpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk. LLDPDU'nun ayırt edici bir magic byte'ı
   * yok (icmp.ts/udp.ts'in aynı sınırı) — auto-detection uzunluğa dayanır. */
  canParse(data: Uint8Array): boolean {
    return data.length >= TLV_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseLldpFrame(data, readContextOptions(context));
  },
};

function tlvHeader(type: number, length: number): number[] {
  return [((type & 0x7f) << 1) | ((length >>> 8) & 0x01), length & 0xff];
}

function textBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

const END_TLV = tlvHeader(TLV_TYPE_END, 0);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'switch-neighbor',
    name: 'protocol.lldp.example.switchNeighbor.name',
    // Chassis ID (MAC) + Port ID (interface name) + TTL 120s + System Name +
    // System Capabilities (Bridge, Router aktif) + End — spec:698-703'ün örneği.
    bytes: Uint8Array.from([
      ...tlvHeader(TLV_TYPE_CHASSIS_ID, 7),
      MAC_SUBTYPE_CHASSIS,
      0x00,
      0x1a,
      0x2b,
      0x3c,
      0x4d,
      0x5e,
      ...tlvHeader(TLV_TYPE_PORT_ID, 1 + textBytes('eth0').length),
      5,
      ...textBytes('eth0'),
      ...tlvHeader(TLV_TYPE_TTL, 2),
      0x00,
      0x78,
      ...tlvHeader(TLV_TYPE_SYSTEM_NAME, textBytes('switch01').length),
      ...textBytes('switch01'),
      ...tlvHeader(TLV_TYPE_SYSTEM_CAPABILITIES, 4),
      0x00,
      0x14, // Bridge(bit2) + Router(bit4) = 0b00010100
      0x00,
      0x04, // yalnız Bridge etkin
      ...END_TLV,
    ]),
    description: 'protocol.lldp.example.switchNeighbor.description',
    expectedValid: true,
  },
  {
    id: 'management-address-ipv4',
    name: 'protocol.lldp.example.managementAddressIpv4.name',
    bytes: Uint8Array.from([
      ...tlvHeader(TLV_TYPE_CHASSIS_ID, 7),
      MAC_SUBTYPE_CHASSIS,
      0x00,
      0x1a,
      0x2b,
      0x3c,
      0x4d,
      0x5e,
      ...tlvHeader(TLV_TYPE_MANAGEMENT_ADDRESS, 12),
      5, // AddrStrLen = 1(subtype) + 4(IPv4)
      1, // AddrSubtype = IPv4
      192,
      168,
      1,
      1,
      2, // IfSubtype
      0x00,
      0x00,
      0x00,
      0x01, // IfNumber = 1
      0, // OidLen = 0
      ...END_TLV,
    ]),
    description: 'protocol.lldp.example.managementAddressIpv4.description',
    expectedValid: true,
  },
  {
    id: 'organizationally-specific',
    name: 'protocol.lldp.example.organizationallySpecific.name',
    bytes: Uint8Array.from([
      ...tlvHeader(TLV_TYPE_ORGANIZATIONALLY_SPECIFIC, 6),
      0x00,
      0x80,
      0xc2, // IEEE 802.1 OUI
      0x01, // subtype
      0xde,
      0xad,
      ...END_TLV,
    ]),
    description: 'protocol.lldp.example.organizationallySpecific.description',
    expectedValid: true,
  },
  {
    id: 'missing-end-tlv',
    name: 'protocol.lldp.example.missingEndTlv.name',
    bytes: Uint8Array.from([...tlvHeader(TLV_TYPE_TTL, 2), 0x00, 0x78]),
    description: 'protocol.lldp.example.missingEndTlv.description',
    expectedValid: true,
  },
  {
    id: 'truncated-tlv',
    name: 'protocol.lldp.example.truncatedTlv.name',
    // TTL TLV 2 bayt bildiriyor ama tamponda yalnız 1 bayt var.
    bytes: Uint8Array.from([...tlvHeader(TLV_TYPE_TTL, 2), 0x00]),
    description: 'protocol.lldp.example.truncatedTlv.description',
    expectedValid: false,
  },
];

export const lldpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: lldpParser,
  documentation: {
    summary: 'protocol.lldp.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
