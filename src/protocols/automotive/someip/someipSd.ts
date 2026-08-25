/**
 * SOME/IP-SD — AUTOSAR Foundation "SOME/IP Service Discovery Protocol
 * Specification" (Doc ID 802), R23-11.
 *
 * Faz 10, dalga 14d. `someip.ts`in payload çözücüsü — AYRI KAYIT DEĞİL,
 * AYRI MODÜL (brief açık soru 5 kararı). Emsal ikili: `dnsWire.ts` (12c,
 * `dns.ts`+`mdns.ts` aynı teli okur) ve `iec104Asdu.ts` (dalga 5, ASDU
 * çekirdeği ayrı dosyada). SD kendi tel biçimi değildir; SOME/IP başlığını
 * kullanan bir PAYLOAD'dır, bu yüzden katalogda yeni `ProtocolRecord`
 * AÇILMADI (172 kaydı etkileyen taksonomi kararı, bu dalganın kapsamı değil).
 *
 * ── AYRIM KRİTERİ: ÜÇ KAYNAKLA SAYISAL OLARAK DOĞRULANDI (2026-08-25) ───────
 * Brief "sayısal değeri doğrulanamazsa bu dosya YAZILMAZ" diyordu. Doğrulandı:
 *
 *   1. AUTOSAR FO R23-11 PRS_SOMEIPSD_00151/00152 (§5.1.2.1): "Service Discovery
 *      messages shall use the Service-ID (16 Bits) of 0xFFFF" ve "… the
 *      Method-ID (16 Bits) of 0x8100".
 *   2. Wireshark `epan/dissectors/packet-someip-sd.c:34`:
 *      `#define SOMEIP_SD_MESSAGEID 0xffff8100`.
 *   3. Scapy `contrib/automotive/someip.py`, `class SD`:
 *      `SOMEIP_MSGID_SRVID = 0xffff`, `SOMEIP_MSGID_SUBID = 0x8100`.
 *
 * Ayrım ÇERÇEVEDEN çıktığı için `decodeOptions` GEREKMEZ (`someip.ts` dosya
 * başı kararı). Spec ayrıca Protocol/Interface Version 0x01, Message Type 0x02,
 * Return Code 0x00 ve Client ID 0x0000 SABİTLERİNİ de şart koşuyor
 * (PRS_SOMEIPSD_00154/00161/00162/00163/00164) — ama ayrım YALNIZ Message ID
 * üzerinden yapılır (Wireshark'ın davranışı), sapmalar `sdHeaderConstant…`
 * uyarılarıyla bildirilir. Sebep: sapan bir mesajı sessizce ham payload'a
 * düşürmek, kullanıcıya "SD değil" demek olurdu; oysa mesaj SD'dir ve BOZUKtur.
 *
 * ── AĞAÇ GÖRÜNÜMÜ YOK — ALAN ADLARINA TAŞINDI ──────────────────────────────
 * `ParsedFrame` DÜZ, `children` yok (CLAUDE.md kilitli kararı; spec'in istediği
 * "Service Browser tree view" ŞEMA DEĞİŞİKLİĞİ gerektirir ve YAPILMAZ). 12g'de
 * RTCP aynı durumu alan ADLARINA taşıyarak çözmüştü (`RTCP Packet 1 Packet
 * Type`) — burada da `SD Entry 1 Service ID` / `SD Option 1 IPv4 Address`.
 * `ParsedField.id` her zaman KENDİ offset'ini taşır, girdi/opsiyon dizininin
 * base offset'ini DEĞİL (`ftp.ts`/`rtcp.ts` tuzağı).
 *
 * ── UZUNLUK TABANLARI — İKİ KAYNAKLA ÇAPRAZ DOĞRULANDI ─────────────────────
 * SD'de İKİ ayrı uzunluk tabanı var ve ikisi FARKLI:
 *
 *   • Entries/Options Array Length (uint32): PRS_SOMEIPSD_00265 "counts the
 *     number of bytes of the following data" — SAF içerik, kendi baytını
 *     saymaz. Wireshark aynı okuma.
 *   • Option Length (uint16): PRS_SOMEIPSD_00276 "excluding the 16 bit length
 *     field and the 8 bit type flag" — yani opsiyonun TOPLAM boyu
 *     `Length + 3`. Wireshark `packet-someip-sd.c:518`:
 *     `real_length = tvb_get_ntohs(tvb, offset) + 3;` ve sabitleri
 *     `SD_OPTION_IPV4_LENGTH 12` (= 0x0009 + 3), `SD_OPTION_IPV6_LENGTH 24`
 *     (= 0x0015 + 3) bunu doğruluyor.
 *
 * İki tabanı karıştırmak opsiyon başına 3 bayt kaydırır (12f MQTT-SN vakasının
 * SD'deki karşılığı) — bu yüzden ayrı sabitlerle ve ayrı yorumlarla yazıldı.
 *
 * ── ADLANDIRILMAYAN BİT ────────────────────────────────────────────────────
 * Eventgroup girdisinin 13. baytındaki 0x80 bitini Wireshark "Initial Event
 * Request" olarak ayırıyor (`SD_ENTRY_INIT_EVENT_REQ_MASK 0x80`), AMA AUTOSAR
 * R23-11 PRS_SOMEIPSD_00270 o 12 biti topluca "Reserved [uint12]: Shall be set
 * to 0x000" ilan ediyor. İki kaynak ÖRTÜŞMEDİĞİ için bu bit ADLANDIRILMADI:
 * 12 bit tek bir `Reserved` alanı olarak gösterilir (brief `:52-54` kuralı,
 * 14c'nin XCP LEN/CTR emsali). Counter'ın düşük nibble olduğunda ise iki
 * kaynak örtüşüyor (Wireshark `SD_EVENTGROUP_ENTRY_COUNTER_MASK 0x0f`).
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

/** PRS_SOMEIPSD_00151 + 00152: Service-ID 0xFFFF | Method-ID 0x8100. */
export const SOMEIP_SD_MESSAGE_ID = 0xffff8100;

/** Flags(1) + Reserved(3) + Entries Array Length(4) + Options Array Length(4). */
const SD_MIN_PAYLOAD_LENGTH = 12;
/** PRS_SOMEIPSD_00268/00270: her iki girdi tipi de tam 16 bayttır. */
const SD_ENTRY_LENGTH = 16;
/** Opsiyonun kendi başlığı: Length(2) + Type(1). `Length` bunları SAYMAZ. */
const SD_OPTION_HEADER_LENGTH = 3;
/** Length + Type + flags baytı — en kısa opsiyonun taban boyu. */
const SD_OPTION_MIN_TOTAL_LENGTH = 4;

const SD_FLAG_REBOOT = 0x80;
const SD_FLAG_UNICAST = 0x40;
const SD_FLAG_EXPLICIT_INITIAL_DATA_CONTROL = 0x20;

const ENTRY_TYPE_FIND_SERVICE = 0x00;
const ENTRY_TYPE_OFFER_SERVICE = 0x01;
const ENTRY_TYPE_SUBSCRIBE_EVENTGROUP = 0x06;
const ENTRY_TYPE_SUBSCRIBE_EVENTGROUP_ACK = 0x07;

/**
 * PRS_SOMEIPSD_00268/00270 + Wireshark `sd_entry_type_positive[]`:
 * AYNI tip kodu TTL'e göre FARKLI anlam taşır (0x01 = Offer / TTL=0 ise
 * Stop Offer). Bu yüzden ad TTL okunmadan verilemez.
 */
const ENTRY_NAMES_TTL_POSITIVE = new Map<number, string>([
  [ENTRY_TYPE_FIND_SERVICE, 'Find Service'],
  [ENTRY_TYPE_OFFER_SERVICE, 'Offer Service'],
  [ENTRY_TYPE_SUBSCRIBE_EVENTGROUP, 'Subscribe Eventgroup'],
  [ENTRY_TYPE_SUBSCRIBE_EVENTGROUP_ACK, 'Subscribe Eventgroup Ack'],
]);

/** Wireshark `sd_entry_type_negative[]` — 0x00'ın TTL=0 karşılığı YOKTUR. */
const ENTRY_NAMES_TTL_ZERO = new Map<number, string>([
  [ENTRY_TYPE_OFFER_SERVICE, 'Stop Offer Service'],
  [ENTRY_TYPE_SUBSCRIBE_EVENTGROUP, 'Stop Subscribe Eventgroup'],
  [ENTRY_TYPE_SUBSCRIBE_EVENTGROUP_ACK, 'Subscribe Eventgroup Negative Ack'],
]);

const OPTION_TYPE_CONFIGURATION = 0x01;
const OPTION_TYPE_LOAD_BALANCING = 0x02;
const OPTION_TYPE_IPV4_ENDPOINT = 0x04;
const OPTION_TYPE_IPV6_ENDPOINT = 0x06;
const OPTION_TYPE_IPV4_MULTICAST = 0x14;
const OPTION_TYPE_IPV6_MULTICAST = 0x16;
const OPTION_TYPE_IPV4_SD_ENDPOINT = 0x24;
const OPTION_TYPE_IPV6_SD_ENDPOINT = 0x26;

/** AUTOSAR §5.1.2.4.1-4.8 ile Wireshark `sd_option_type[]` birebir örtüşüyor. */
const OPTION_TYPE_NAMES = new Map<number, string>([
  [OPTION_TYPE_CONFIGURATION, 'Configuration'],
  [OPTION_TYPE_LOAD_BALANCING, 'Load Balancing'],
  [OPTION_TYPE_IPV4_ENDPOINT, 'IPv4 Endpoint'],
  [OPTION_TYPE_IPV6_ENDPOINT, 'IPv6 Endpoint'],
  [OPTION_TYPE_IPV4_MULTICAST, 'IPv4 Multicast'],
  [OPTION_TYPE_IPV6_MULTICAST, 'IPv6 Multicast'],
  [OPTION_TYPE_IPV4_SD_ENDPOINT, 'IPv4 SD Endpoint'],
  [OPTION_TYPE_IPV6_SD_ENDPOINT, 'IPv6 SD Endpoint'],
]);

const IPV4_OPTION_TYPES = new Set<number>([
  OPTION_TYPE_IPV4_ENDPOINT,
  OPTION_TYPE_IPV4_MULTICAST,
  OPTION_TYPE_IPV4_SD_ENDPOINT,
]);
const IPV6_OPTION_TYPES = new Set<number>([
  OPTION_TYPE_IPV6_ENDPOINT,
  OPTION_TYPE_IPV6_MULTICAST,
  OPTION_TYPE_IPV6_SD_ENDPOINT,
]);

/** PRS_SOMEIPSD_00307: IANA/IETF tipleri (Wireshark `sd_option_l4protos[]`). */
const L4_PROTOCOL_NAMES = new Map<number, string>([
  [0x06, 'TCP'],
  [0x11, 'UDP'],
]);

/** Toplam boy = `Length + 3`; AUTOSAR 0x0009 / Wireshark 12 ile doğrulandı. */
const IPV4_OPTION_TOTAL_LENGTH = 12;
/** AUTOSAR 0x0015 / Wireshark `SD_OPTION_IPV6_LENGTH 24`. */
const IPV6_OPTION_TOTAL_LENGTH = 24;
/** AUTOSAR PRS_SOMEIPSD_00544: Length 0x0005 → toplam 8. */
const LOAD_BALANCING_OPTION_TOTAL_LENGTH = 8;

const ERROR_SD_PAYLOAD_TOO_SHORT = 'protocol.someip.error.sdPayloadTooShort';
const ERROR_SD_ENTRIES_OVERFLOW = 'protocol.someip.error.sdEntriesOverflow';
const ERROR_SD_OPTIONS_OVERFLOW = 'protocol.someip.error.sdOptionsOverflow';

const WARN_SD_ENTRIES_NOT_MULTIPLE = 'protocol.someip.warning.sdEntriesLengthNotMultiple';
const WARN_SD_UNKNOWN_ENTRY_TYPE = 'protocol.someip.warning.sdUnknownEntryType';
const WARN_SD_UNKNOWN_OPTION_TYPE = 'protocol.someip.warning.sdUnknownOptionType';
const WARN_SD_OPTION_LENGTH_MISMATCH = 'protocol.someip.warning.sdOptionLengthMismatch';
const WARN_SD_OPTION_TRUNCATED = 'protocol.someip.warning.sdOptionTruncated';
const WARN_SD_UNKNOWN_L4_PROTOCOL = 'protocol.someip.warning.sdUnknownL4Protocol';
const WARN_SD_TRAILING_BYTES = 'protocol.someip.warning.sdTrailingBytes';
const WARN_SD_CONFIG_STRING_TRUNCATED = 'protocol.someip.warning.sdConfigStringTruncated';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint24BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 16) | (byteAt(data, offset + 1) << 8) | byteAt(data, offset + 2);
}

/** `>>> 0`: en yüksek bit set olduğunda `<<` işaretli sayı üretir. */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function toHex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/** `lldp.ts`/`snmp.ts` ile aynı yerel yardımcı deseni — paylaşılan bir modül yok. */
function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

function formatIpv6Address(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let index = 0; index < bytes.length; index += 2) {
    groups.push(readUint16BE(bytes, index).toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

interface SdSink {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
  /** Aynı uyarı onlarca girdide tekrarlanmasın; çerçeve seviyesinde tek kayıt. */
  seenWarnings: Set<string>;
}

function warnOnce(sink: SdSink, key: string): void {
  if (sink.seenWarnings.has(key)) return;
  sink.seenWarnings.add(key);
  sink.warnings.push(toProtocolWarning(key));
}

function pushSdHeaderFields(data: Uint8Array, start: number, sink: SdSink): void {
  const flags = byteAt(data, start);
  const setFlags: string[] = [];
  if ((flags & SD_FLAG_REBOOT) !== 0) setFlags.push('Reboot');
  if ((flags & SD_FLAG_UNICAST) !== 0) setFlags.push('Unicast');
  if ((flags & SD_FLAG_EXPLICIT_INITIAL_DATA_CONTROL) !== 0) {
    setFlags.push('Explicit Initial Data Control');
  }

  sink.fields.push({
    id: `sd-flags-${String(start)}`,
    name: 'SD Flags',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: flags,
    physicalValue: setFlags.length === 0 ? 'none' : setFlags.join(' | '),
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-flag-reboot-${String(start)}`,
    name: 'SD Reboot Flag',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: (flags & SD_FLAG_REBOOT) === 0 ? 0 : 1,
    // PRS_SOMEIPSD_00255: 1 = Session ID yeniden başlamadı (reboot'tan beri).
    physicalValue:
      (flags & SD_FLAG_REBOOT) === 0
        ? 'Session ID rolled over since last reboot'
        : 'Session ID did not roll over since last reboot',
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-flag-unicast-${String(start)}`,
    name: 'SD Unicast Flag',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: (flags & SD_FLAG_UNICAST) === 0 ? 0 : 1,
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-flag-explicit-initial-data-control-${String(start)}`,
    name: 'SD Explicit Initial Data Control Flag',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: (flags & SD_FLAG_EXPLICIT_INITIAL_DATA_CONTROL) === 0 ? 0 : 1,
    valid: true,
    warnings: [],
  });

  sink.fields.push({
    id: `sd-reserved-${String(start + 1)}`,
    name: 'SD Reserved',
    offset: start + 1,
    length: 3,
    rawBytes: data.slice(start + 1, start + 4),
    rawValue: readUint24BE(data, start + 1),
    valid: true,
    warnings: [],
  });
}

function pushEntryFields(
  data: Uint8Array,
  entryStart: number,
  entryIndex: number,
  sink: SdSink,
): void {
  const label = `SD Entry ${String(entryIndex)}`;
  const entryType = byteAt(data, entryStart);
  const ttl = readUint24BE(data, entryStart + 9);
  const nameTable = ttl === 0 ? ENTRY_NAMES_TTL_ZERO : ENTRY_NAMES_TTL_POSITIVE;
  const entryTypeName = nameTable.get(entryType);

  const typeField: ParsedField = {
    id: `sd-entry-type-${String(entryStart)}`,
    name: `${label} Type`,
    offset: entryStart,
    length: 1,
    rawBytes: data.slice(entryStart, entryStart + 1),
    rawValue: entryType,
    valid: entryTypeName !== undefined,
    warnings: [],
  };
  if (entryTypeName === undefined) {
    typeField.warnings.push(WARN_SD_UNKNOWN_ENTRY_TYPE);
    warnOnce(sink, WARN_SD_UNKNOWN_ENTRY_TYPE);
  } else {
    typeField.physicalValue = entryTypeName;
  }
  sink.fields.push(typeField);

  sink.fields.push({
    id: `sd-entry-index1-${String(entryStart + 1)}`,
    name: `${label} Index First Option Run`,
    offset: entryStart + 1,
    length: 1,
    rawBytes: data.slice(entryStart + 1, entryStart + 2),
    rawValue: byteAt(data, entryStart + 1),
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-entry-index2-${String(entryStart + 2)}`,
    name: `${label} Index Second Option Run`,
    offset: entryStart + 2,
    length: 1,
    rawBytes: data.slice(entryStart + 2, entryStart + 3),
    rawValue: byteAt(data, entryStart + 2),
    valid: true,
    warnings: [],
  });

  // PRS_SOMEIPSD_00268: iki uint4 TEK baytı paylaşır; ikisi de aynı ofsette
  // durduğu için id'ler ad ekiyle ayrışır (offset yine KENDİ offset'i).
  const optionCounts = byteAt(data, entryStart + 3);
  sink.fields.push({
    id: `sd-entry-numopt1-${String(entryStart + 3)}`,
    name: `${label} Number of Options 1`,
    offset: entryStart + 3,
    length: 1,
    rawBytes: data.slice(entryStart + 3, entryStart + 4),
    rawValue: (optionCounts & 0xf0) >>> 4,
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-entry-numopt2-${String(entryStart + 3)}`,
    name: `${label} Number of Options 2`,
    offset: entryStart + 3,
    length: 1,
    rawBytes: data.slice(entryStart + 3, entryStart + 4),
    rawValue: optionCounts & 0x0f,
    valid: true,
    warnings: [],
  });

  const serviceId = readUint16BE(data, entryStart + 4);
  sink.fields.push({
    id: `sd-entry-service-id-${String(entryStart + 4)}`,
    name: `${label} Service ID`,
    offset: entryStart + 4,
    length: 2,
    rawBytes: data.slice(entryStart + 4, entryStart + 6),
    rawValue: serviceId,
    physicalValue: serviceId === 0xffff ? 'ANY (0xFFFF)' : toHex(serviceId, 4),
    valid: true,
    warnings: [],
  });

  const instanceId = readUint16BE(data, entryStart + 6);
  sink.fields.push({
    id: `sd-entry-instance-id-${String(entryStart + 6)}`,
    name: `${label} Instance ID`,
    offset: entryStart + 6,
    length: 2,
    rawBytes: data.slice(entryStart + 6, entryStart + 8),
    rawValue: instanceId,
    physicalValue: instanceId === 0xffff ? 'ANY (0xFFFF)' : toHex(instanceId, 4),
    valid: true,
    warnings: [],
  });

  const majorVersion = byteAt(data, entryStart + 8);
  sink.fields.push({
    id: `sd-entry-major-version-${String(entryStart + 8)}`,
    name: `${label} Major Version`,
    offset: entryStart + 8,
    length: 1,
    rawBytes: data.slice(entryStart + 8, entryStart + 9),
    rawValue: majorVersion,
    physicalValue: majorVersion === 0xff ? 'ANY (0xFF)' : String(majorVersion),
    valid: true,
    warnings: [],
  });

  sink.fields.push({
    id: `sd-entry-ttl-${String(entryStart + 9)}`,
    name: `${label} TTL`,
    offset: entryStart + 9,
    length: 3,
    rawBytes: data.slice(entryStart + 9, entryStart + 12),
    rawValue: ttl,
    // PRS_SOMEIPSD_00268: "lifetime of the entry in seconds" — gerçek fiziksel
    // birim, `unit` verilir. 0xFFFFFF sonsuz demek (PRS_SOMEIPSD_00449).
    ...(ttl === 0xffffff ? { physicalValue: 'infinite (0xFFFFFF)' } : { unit: 's' }),
    valid: true,
    warnings: [],
  });

  if (entryType === ENTRY_TYPE_FIND_SERVICE || entryType === ENTRY_TYPE_OFFER_SERVICE) {
    const minorVersion = readUint32BE(data, entryStart + 12);
    sink.fields.push({
      id: `sd-entry-minor-version-${String(entryStart + 12)}`,
      name: `${label} Minor Version`,
      offset: entryStart + 12,
      length: 4,
      rawBytes: data.slice(entryStart + 12, entryStart + 16),
      rawValue: minorVersion,
      physicalValue: minorVersion === 0xffffffff ? 'ANY (0xFFFFFFFF)' : String(minorVersion),
      valid: true,
      warnings: [],
    });
    return;
  }

  if (
    entryType === ENTRY_TYPE_SUBSCRIBE_EVENTGROUP ||
    entryType === ENTRY_TYPE_SUBSCRIBE_EVENTGROUP_ACK
  ) {
    // Reserved[uint12] + Counter[uint4] — Wireshark'ın 0x80'i ayrı bir bayrak
    // sayması AUTOSAR ile ÖRTÜŞMÜYOR, o yüzden 12 bit topluca gösteriliyor
    // (dosya başı "adlandırılmayan bit" notu).
    sink.fields.push({
      id: `sd-entry-reserved-${String(entryStart + 12)}`,
      name: `${label} Reserved (12 bit)`,
      offset: entryStart + 12,
      length: 2,
      rawBytes: data.slice(entryStart + 12, entryStart + 14),
      rawValue: readUint16BE(data, entryStart + 12) >>> 4,
      valid: true,
      warnings: [],
    });
    sink.fields.push({
      id: `sd-entry-counter-${String(entryStart + 13)}`,
      name: `${label} Counter`,
      offset: entryStart + 13,
      length: 1,
      rawBytes: data.slice(entryStart + 13, entryStart + 14),
      rawValue: byteAt(data, entryStart + 13) & 0x0f,
      valid: true,
      warnings: [],
    });
    const eventgroupId = readUint16BE(data, entryStart + 14);
    sink.fields.push({
      id: `sd-entry-eventgroup-id-${String(entryStart + 14)}`,
      name: `${label} Eventgroup ID`,
      offset: entryStart + 14,
      length: 2,
      rawBytes: data.slice(entryStart + 14, entryStart + 16),
      rawValue: eventgroupId,
      physicalValue: eventgroupId === 0xffff ? 'ANY (0xFFFF)' : toHex(eventgroupId, 4),
      valid: true,
      warnings: [],
    });
    return;
  }

  // Tanınmayan girdi tipi: son 4 baytın YAPISI bilinmiyor — UYDURULMAZ, ham.
  sink.fields.push({
    id: `sd-entry-type-specific-${String(entryStart + 12)}`,
    name: `${label} Type-specific Data (raw)`,
    offset: entryStart + 12,
    length: 4,
    rawBytes: data.slice(entryStart + 12, entryStart + 16),
    valid: false,
    warnings: [WARN_SD_UNKNOWN_ENTRY_TYPE],
  });
}

function pushEndpointFields(
  data: Uint8Array,
  optionStart: number,
  label: string,
  addressLength: number,
  sink: SdSink,
): void {
  const addressOffset = optionStart + 4;
  const addressBytes = data.slice(addressOffset, addressOffset + addressLength);
  sink.fields.push({
    id: `sd-option-address-${String(addressOffset)}`,
    name: `${label} ${addressLength === 4 ? 'IPv4' : 'IPv6'} Address`,
    offset: addressOffset,
    length: addressLength,
    rawBytes: addressBytes,
    physicalValue:
      addressLength === 4 ? formatIpv4Address(addressBytes) : formatIpv6Address(addressBytes),
    valid: true,
    warnings: [],
  });

  const reservedOffset = addressOffset + addressLength;
  sink.fields.push({
    id: `sd-option-reserved-${String(reservedOffset)}`,
    name: `${label} Reserved`,
    offset: reservedOffset,
    length: 1,
    rawBytes: data.slice(reservedOffset, reservedOffset + 1),
    rawValue: byteAt(data, reservedOffset),
    valid: true,
    warnings: [],
  });

  const protocolOffset = reservedOffset + 1;
  const l4Protocol = byteAt(data, protocolOffset);
  const l4Name = L4_PROTOCOL_NAMES.get(l4Protocol);
  const protocolField: ParsedField = {
    id: `sd-option-l4-protocol-${String(protocolOffset)}`,
    name: `${label} Transport Protocol`,
    offset: protocolOffset,
    length: 1,
    rawBytes: data.slice(protocolOffset, protocolOffset + 1),
    rawValue: l4Protocol,
    valid: l4Name !== undefined,
    warnings: [],
  };
  if (l4Name === undefined) {
    protocolField.warnings.push(WARN_SD_UNKNOWN_L4_PROTOCOL);
    warnOnce(sink, WARN_SD_UNKNOWN_L4_PROTOCOL);
  } else {
    protocolField.physicalValue = l4Name;
  }
  sink.fields.push(protocolField);

  const portOffset = protocolOffset + 1;
  sink.fields.push({
    id: `sd-option-port-${String(portOffset)}`,
    name: `${label} Port`,
    offset: portOffset,
    length: 2,
    rawBytes: data.slice(portOffset, portOffset + 2),
    rawValue: readUint16BE(data, portOffset),
    valid: true,
    warnings: [],
  });
}

/**
 * PRS_SOMEIPSD_00278-00280: DNS TXT / DNS-SD biçimi — tek baytlık uzunluk +
 * o kadar karakter, 0x00 uzunluğu diziyi bitirir.
 */
function pushConfigurationFields(
  data: Uint8Array,
  optionStart: number,
  optionEnd: number,
  label: string,
  sink: SdSink,
): void {
  let cursor = optionStart + 4;
  let elementIndex = 1;
  while (cursor < optionEnd) {
    const elementLength = byteAt(data, cursor);
    if (elementLength === 0) {
      sink.fields.push({
        id: `sd-option-config-terminator-${String(cursor)}`,
        name: `${label} Configuration String Terminator`,
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: 0,
        valid: true,
        warnings: [],
      });
      return;
    }
    if (cursor + 1 + elementLength > optionEnd) {
      sink.fields.push({
        id: `sd-option-config-truncated-${String(cursor)}`,
        name: `${label} Configuration String (truncated)`,
        offset: cursor,
        length: optionEnd - cursor,
        rawBytes: data.slice(cursor, optionEnd),
        valid: false,
        warnings: [WARN_SD_CONFIG_STRING_TRUNCATED],
      });
      warnOnce(sink, WARN_SD_CONFIG_STRING_TRUNCATED);
      return;
    }
    const textBytes = data.slice(cursor + 1, cursor + 1 + elementLength);
    sink.fields.push({
      id: `sd-option-config-entry-${String(cursor)}`,
      name: `${label} Configuration String ${String(elementIndex)}`,
      offset: cursor,
      length: 1 + elementLength,
      rawBytes: data.slice(cursor, cursor + 1 + elementLength),
      physicalValue: Array.from(textBytes, (byte) => String.fromCharCode(byte)).join(''),
      valid: true,
      warnings: [],
    });
    cursor += 1 + elementLength;
    elementIndex += 1;
  }
}

/** Bir opsiyonu çözer ve TOPLAM bayt boyunu döner (0 = ilerlenemedi). */
function pushOptionFields(
  data: Uint8Array,
  optionStart: number,
  optionsEnd: number,
  optionIndex: number,
  sink: SdSink,
): number {
  const label = `SD Option ${String(optionIndex)}`;
  const declaredLength = readUint16BE(data, optionStart);
  // TOPLAM = Length + 3 (dosya başı, iki kaynakla doğrulandı).
  const totalLength = declaredLength + SD_OPTION_HEADER_LENGTH;
  const optionEnd = Math.min(optionStart + totalLength, optionsEnd);

  sink.fields.push({
    id: `sd-option-length-${String(optionStart)}`,
    name: `${label} Length (excludes Length + Type bytes)`,
    offset: optionStart,
    length: 2,
    rawBytes: data.slice(optionStart, optionStart + 2),
    rawValue: declaredLength,
    physicalValue: totalLength,
    unit: 'B',
    valid: totalLength >= SD_OPTION_MIN_TOTAL_LENGTH,
    warnings: [],
  });

  const optionType = byteAt(data, optionStart + 2);
  const optionTypeName = OPTION_TYPE_NAMES.get(optionType);
  const typeField: ParsedField = {
    id: `sd-option-type-${String(optionStart + 2)}`,
    name: `${label} Type`,
    offset: optionStart + 2,
    length: 1,
    rawBytes: data.slice(optionStart + 2, optionStart + 3),
    rawValue: optionType,
    valid: optionTypeName !== undefined,
    warnings: [],
  };
  if (optionTypeName === undefined) {
    typeField.warnings.push(WARN_SD_UNKNOWN_OPTION_TYPE);
    warnOnce(sink, WARN_SD_UNKNOWN_OPTION_TYPE);
  } else {
    typeField.physicalValue = optionTypeName;
  }
  sink.fields.push(typeField);

  if (totalLength < SD_OPTION_MIN_TOTAL_LENGTH || optionStart + totalLength > optionsEnd) {
    // Bildirilen boy tamponu aşıyor ya da bayrak baytını bile kapsamıyor —
    // kalan baytlar HAM gösterilir ve döngü durur (0 döner).
    sink.fields.push({
      id: `sd-option-data-${String(optionStart + SD_OPTION_HEADER_LENGTH)}`,
      name: `${label} Data (raw, truncated)`,
      offset: optionStart + SD_OPTION_HEADER_LENGTH,
      length: Math.max(0, optionsEnd - optionStart - SD_OPTION_HEADER_LENGTH),
      rawBytes: data.slice(optionStart + SD_OPTION_HEADER_LENGTH, optionsEnd),
      valid: false,
      warnings: [WARN_SD_OPTION_TRUNCATED],
    });
    warnOnce(sink, WARN_SD_OPTION_TRUNCATED);
    return 0;
  }

  const flagsByte = byteAt(data, optionStart + 3);
  sink.fields.push({
    id: `sd-option-discardable-${String(optionStart + 3)}`,
    name: `${label} Discardable Flag`,
    offset: optionStart + 3,
    length: 1,
    rawBytes: data.slice(optionStart + 3, optionStart + 4),
    rawValue: (flagsByte & 0x80) === 0 ? 0 : 1,
    physicalValue: (flagsByte & 0x80) === 0 ? 'Not discardable' : 'Discardable',
    valid: true,
    warnings: [],
  });
  sink.fields.push({
    id: `sd-option-flag-reserved-${String(optionStart + 3)}`,
    name: `${label} Reserved (7 bit)`,
    offset: optionStart + 3,
    length: 1,
    rawBytes: data.slice(optionStart + 3, optionStart + 4),
    rawValue: flagsByte & 0x7f,
    valid: true,
    warnings: [],
  });

  const expectedTotal = IPV4_OPTION_TYPES.has(optionType)
    ? IPV4_OPTION_TOTAL_LENGTH
    : IPV6_OPTION_TYPES.has(optionType)
      ? IPV6_OPTION_TOTAL_LENGTH
      : optionType === OPTION_TYPE_LOAD_BALANCING
        ? LOAD_BALANCING_OPTION_TOTAL_LENGTH
        : undefined;

  if (expectedTotal !== undefined && totalLength !== expectedTotal) {
    // Sabit boylu bir opsiyon beklenenden farklı boy bildiriyor: alan
    // yerleşimine GÜVENİLMEZ, gövde ham bırakılır (uydurma kırılım YOK).
    sink.fields.push({
      id: `sd-option-data-${String(optionStart + SD_OPTION_MIN_TOTAL_LENGTH)}`,
      name: `${label} Data (raw, unexpected length)`,
      offset: optionStart + SD_OPTION_MIN_TOTAL_LENGTH,
      length: optionEnd - optionStart - SD_OPTION_MIN_TOTAL_LENGTH,
      rawBytes: data.slice(optionStart + SD_OPTION_MIN_TOTAL_LENGTH, optionEnd),
      valid: false,
      warnings: [WARN_SD_OPTION_LENGTH_MISMATCH],
    });
    warnOnce(sink, WARN_SD_OPTION_LENGTH_MISMATCH);
    return totalLength;
  }

  if (IPV4_OPTION_TYPES.has(optionType)) {
    pushEndpointFields(data, optionStart, label, 4, sink);
    return totalLength;
  }
  if (IPV6_OPTION_TYPES.has(optionType)) {
    pushEndpointFields(data, optionStart, label, 16, sink);
    return totalLength;
  }
  if (optionType === OPTION_TYPE_LOAD_BALANCING) {
    sink.fields.push({
      id: `sd-option-priority-${String(optionStart + 4)}`,
      name: `${label} Priority`,
      offset: optionStart + 4,
      length: 2,
      rawBytes: data.slice(optionStart + 4, optionStart + 6),
      rawValue: readUint16BE(data, optionStart + 4),
      valid: true,
      warnings: [],
    });
    sink.fields.push({
      id: `sd-option-weight-${String(optionStart + 6)}`,
      name: `${label} Weight`,
      offset: optionStart + 6,
      length: 2,
      rawBytes: data.slice(optionStart + 6, optionStart + 8),
      rawValue: readUint16BE(data, optionStart + 6),
      valid: true,
      warnings: [],
    });
    return totalLength;
  }
  if (optionType === OPTION_TYPE_CONFIGURATION) {
    pushConfigurationFields(data, optionStart, optionEnd, label, sink);
    return totalLength;
  }

  // Tanınmayan opsiyon tipi: gövde HAM (dalga 13 dersi 4).
  if (optionEnd > optionStart + SD_OPTION_MIN_TOTAL_LENGTH) {
    sink.fields.push({
      id: `sd-option-data-${String(optionStart + SD_OPTION_MIN_TOTAL_LENGTH)}`,
      name: `${label} Data (raw)`,
      offset: optionStart + SD_OPTION_MIN_TOTAL_LENGTH,
      length: optionEnd - optionStart - SD_OPTION_MIN_TOTAL_LENGTH,
      rawBytes: data.slice(optionStart + SD_OPTION_MIN_TOTAL_LENGTH, optionEnd),
      valid: false,
      warnings: [WARN_SD_UNKNOWN_OPTION_TYPE],
    });
  }
  return totalLength;
}

/**
 * SOME/IP-SD payload'ını çözer. `start` SOME/IP başlığından SONRAKİ ilk bayt,
 * `end` ise `Length`ten hesaplanan mesaj sınırıdır — bu fonksiyon tampon
 * sınırını KENDİ hesaplamaz, çağıranın verdiği sınıra uyar.
 */
export function decodeSomeIpSdPayload(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  const sink: SdSink = { fields, warnings, errors, seenWarnings: new Set<string>() };

  if (end - start < SD_MIN_PAYLOAD_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_SD_PAYLOAD_TOO_SHORT,
      offset: start,
      length: Math.max(0, end - start),
      details: { minimum: SD_MIN_PAYLOAD_LENGTH, available: Math.max(0, end - start) },
    });
    return;
  }

  pushSdHeaderFields(data, start, sink);

  const entriesLengthOffset = start + 4;
  const entriesLength = readUint32BE(data, entriesLengthOffset);
  const entriesStart = entriesLengthOffset + 4;
  sink.fields.push({
    id: `sd-entries-length-${String(entriesLengthOffset)}`,
    name: 'SD Entries Array Length',
    offset: entriesLengthOffset,
    length: 4,
    rawBytes: data.slice(entriesLengthOffset, entriesLengthOffset + 4),
    rawValue: entriesLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  // Options Array Length için 4 bayt daha gerekiyor — girdi dizisi onu
  // yiyorsa mesaj bozuktur, girdiler çözülmez.
  if (entriesStart + entriesLength + 4 > end) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_SD_ENTRIES_OVERFLOW,
      offset: entriesLengthOffset,
      length: 4,
      details: { entriesLength, available: end - entriesStart },
    });
    return;
  }

  const entryCount = Math.floor(entriesLength / SD_ENTRY_LENGTH);
  if (entriesLength % SD_ENTRY_LENGTH !== 0) {
    warnOnce(sink, WARN_SD_ENTRIES_NOT_MULTIPLE);
  }
  for (let index = 0; index < entryCount; index += 1) {
    pushEntryFields(data, entriesStart + index * SD_ENTRY_LENGTH, index + 1, sink);
  }

  const optionsLengthOffset = entriesStart + entriesLength;
  const optionsLength = readUint32BE(data, optionsLengthOffset);
  const optionsStart = optionsLengthOffset + 4;
  sink.fields.push({
    id: `sd-options-length-${String(optionsLengthOffset)}`,
    name: 'SD Options Array Length',
    offset: optionsLengthOffset,
    length: 4,
    rawBytes: data.slice(optionsLengthOffset, optionsLengthOffset + 4),
    rawValue: optionsLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (optionsStart + optionsLength > end) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_SD_OPTIONS_OVERFLOW,
      offset: optionsLengthOffset,
      length: 4,
      details: { optionsLength, available: end - optionsStart },
    });
    return;
  }

  const optionsEnd = optionsStart + optionsLength;
  let cursor = optionsStart;
  let optionIndex = 1;
  while (cursor + SD_OPTION_HEADER_LENGTH <= optionsEnd) {
    const consumed = pushOptionFields(data, cursor, optionsEnd, optionIndex, sink);
    if (consumed <= 0) break;
    cursor += consumed;
    optionIndex += 1;
  }
  if (cursor < optionsEnd) {
    warnOnce(sink, WARN_SD_TRAILING_BYTES);
  }

  // SOME/IP `Length` ile SD dizilerinin toplamı örtüşmüyorsa artan baytlar var.
  if (optionsEnd < end) {
    warnOnce(sink, WARN_SD_TRAILING_BYTES);
  }
}
