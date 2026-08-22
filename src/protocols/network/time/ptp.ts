/**
 * PTP (IEEE 1588-2019, PTPv2.1) — donanım destekli saat senkronizasyonu.
 * Girdi TEK bir PTP mesajıdır; taşıyıcı (UDP/319-320 ya da doğrudan Ethernet
 * 0x88F7) çözülmez — `arp.ts`/`ntp.ts` kararının aynısı.
 *
 * ── messageType BAYT 0'IN **ALT** YARISIDIR ─────────────────────────────────
 * Bayt 0: üst dört bit `majorSdoId` (eski adıyla `transportSpecific`), alt dört
 * bit `messageType`. Ters okumak Sync'i Announce sanmak demektir ve tel geçerli
 * göründüğü için hata hiçbir yerde patlamaz — sessizce yanlış çözüm üretir.
 * Aynı asimetri bayt 1'de de var: üst yarı `minorVersionPTP`, alt yarı
 * `versionPTP` (2 beklenir).
 *
 * ── `correctionField` DÜZ NANOSANİYE DEĞİL ──────────────────────────────────
 * İşaretli 64 bit, birimi **nanosaniye × 2^16** (`ptpTimestamp.ts`). Transparent
 * clock'ların biriktirdiği residence time buraya yazılır ve NEGATİF olabilir.
 * Ölçeklemeden basmak 65536 kat büyük, işaretsiz okumak ise astronomik bir sayı
 * verir; ikisi de "geçerli" görünür.
 *
 * ── twoStepFlag YALNIZ EVENT MESAJINDA ANLAMLIDIR ───────────────────────────
 * Bayrak bayt 6'nın 0x02 bitidir (bayt 7'nin değil). IEEE 1588-2019 §13.3.2.6
 * bayrağı Sync ve Pdelay_Resp için tanımlar; Announce/Follow_Up/Delay_Resp gibi
 * general mesajlarda değeri ANLAMSIZDIR. Her mesajda "Clock Mode: Two-Step"
 * basmak (spec `:592`) genel mesajlarda uydurma olur — bu yüzden türetilmiş
 * `clock-mode` alanı yalnız event mesajlarında üretilir.
 *
 * ── E2E DELAY VE BMCA ÇOK-MESAJ İŞİDİR ──────────────────────────────────────
 * Spec `:594-604` MeanPathDelay = [(t2-t1)+(t4-t3)]/2 ve OffsetFromMaster
 * istiyor; dördü de AYRI mesajlarda gelir (t1 Sync/Follow_Up, t2 slave'in yerel
 * saati, t3 slave'in Delay_Req anı, t4 Delay_Resp). Tek çerçeveden çıkmaz —
 * `ntp.ts`teki T4 kararının, 12a'daki ICMP RTT'sinin, 12c'deki DNS Transaction
 * Matching'in aynısı. BMCA (`:614`) de öyle: Announce'un TAŞIDIĞI altı veri
 * (Priority1/ClockClass/ClockAccuracy/Variance/Priority2/ClockIdentity) burada
 * ALAN ALAN ÇÖZÜLÜR, ama "Selected Grandmaster" kararı Announce'ları
 * KARŞILAŞTIRMAK demektir. Sequence gap (`:611`) aynı sınıf.
 *
 * Kayıt yine de `ready`: 12c'de DNS "Transaction Matching / Response Time /
 * TTL Simulation" araçları aynı gerekçeyle analyzer'a bırakılmışken `ready`
 * verildi. LoRa'nın `partial`ı (`wireless-iot.ts:169-187`) farklı bir duruma
 * aitti — orada parser HİÇ YOKTU ve kaydın bütün değeri hesap aracındaydı.
 *
 * ── PTP TLV'Sİ **ÜÇÜNCÜ** TLV LEHÇESİDİR ────────────────────────────────────
 * 12b LLDP'nin TLV'sini (7 bit tip + 9 bit uzunluk, bayta hizasız) ayrı yazdı;
 * 12c DHCP'nin klasik TLV8'ini (1B tip + 1B uzunluk) yine ayrı yazdı. PTP'ninki
 * TLV16'dır: 2 bayt `tlvType` + 2 bayt `lengthField` + gövde, ve `lengthField`
 * ÇİFT olmak zorundadır (§14.1.1). Üçü de "TLV" adını taşır, üçü de farklı bit
 * düzenindedir. Paylaşılan yürüyücü AÇILMADI — üç kez üst üste doğrulanmış bir
 * karar. Burada yalnız TLV BAŞLIKLARI yürünür ve tip adlandırılır; gövdeler ham
 * bırakılır (PATH_TRACE / L1_SYNC / unicast anlaşması ayrı iş).
 */

import {
  CORRECTION_FIELD_SCALE,
  PTP_TIMESTAMP_LENGTH,
  formatClockIdentity,
  readCorrectionFieldNanoseconds,
  readPtpTimestamp,
  type PtpTimestamp,
} from './ptpTimestamp';
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

const PROTOCOL_ID = 'ptp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PTP';

/** IEEE 1588-2019 §13.3: her PTP mesajının ortak başlığı 34 bayttır. */
const HEADER_LENGTH = 34;

const SDO_MESSAGE_TYPE_OFFSET = 0;
const VERSION_OFFSET = 1;
const MESSAGE_LENGTH_OFFSET = 2;
const DOMAIN_NUMBER_OFFSET = 4;
const MINOR_SDO_ID_OFFSET = 5;
const FLAGS_OFFSET = 6;
const CORRECTION_FIELD_OFFSET = 8;
const MESSAGE_TYPE_SPECIFIC_OFFSET = 16;
const CLOCK_IDENTITY_OFFSET = 20;
const SEQUENCE_ID_OFFSET = 30;
const CONTROL_FIELD_OFFSET = 32;
const LOG_MESSAGE_INTERVAL_OFFSET = 33;

const CLOCK_IDENTITY_LENGTH = 8;
const PORT_IDENTITY_LENGTH = 10;
const CORRECTION_FIELD_LENGTH = 8;
const WORD_LENGTH = 2;
const DWORD_LENGTH = 4;

const NIBBLE_SHIFT = 4;
const NIBBLE_MASK = 0x0f;
const HEX_RADIX = 16;

const PTP_VERSION_2 = 2;

const MESSAGE_TYPE_SYNC = 0x0;
const MESSAGE_TYPE_DELAY_REQ = 0x1;
const MESSAGE_TYPE_PDELAY_REQ = 0x2;
const MESSAGE_TYPE_PDELAY_RESP = 0x3;
const MESSAGE_TYPE_FOLLOW_UP = 0x8;
const MESSAGE_TYPE_DELAY_RESP = 0x9;
const MESSAGE_TYPE_PDELAY_RESP_FOLLOW_UP = 0xa;
const MESSAGE_TYPE_ANNOUNCE = 0xb;
const MESSAGE_TYPE_SIGNALING = 0xc;
const MESSAGE_TYPE_MANAGEMENT = 0xd;

const MESSAGE_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [MESSAGE_TYPE_SYNC, 'Sync'],
  [MESSAGE_TYPE_DELAY_REQ, 'Delay_Req'],
  [MESSAGE_TYPE_PDELAY_REQ, 'Pdelay_Req'],
  [MESSAGE_TYPE_PDELAY_RESP, 'Pdelay_Resp'],
  [MESSAGE_TYPE_FOLLOW_UP, 'Follow_Up'],
  [MESSAGE_TYPE_DELAY_RESP, 'Delay_Resp'],
  [MESSAGE_TYPE_PDELAY_RESP_FOLLOW_UP, 'Pdelay_Resp_Follow_Up'],
  [MESSAGE_TYPE_ANNOUNCE, 'Announce'],
  [MESSAGE_TYPE_SIGNALING, 'Signaling'],
  [MESSAGE_TYPE_MANAGEMENT, 'Management'],
]);

/** `twoStepFlag`ın davranışı yalnız Sync ve Pdelay_Resp için TANIMLIDIR. */
const TWO_STEP_RELEVANT_TYPES: ReadonlySet<number> = new Set([
  MESSAGE_TYPE_SYNC,
  MESSAGE_TYPE_PDELAY_RESP,
]);

/** flagField bayt 0 (§13.3.2.6 Tablo 37, üst yarı). */
const FLAG0_ALTERNATE_MASTER = 0x01;
const FLAG0_TWO_STEP = 0x02;
const FLAG0_UNICAST = 0x04;
const FLAG0_PROFILE_SPECIFIC_1 = 0x20;
const FLAG0_PROFILE_SPECIFIC_2 = 0x40;

/** flagField bayt 1 — zaman ölçeği bayrakları burada, bayt 0'da DEĞİL. */
const FLAG1_LEAP_61 = 0x01;
const FLAG1_LEAP_59 = 0x02;
const FLAG1_UTC_OFFSET_VALID = 0x04;
const FLAG1_PTP_TIMESCALE = 0x08;
const FLAG1_TIME_TRACEABLE = 0x10;
const FLAG1_FREQUENCY_TRACEABLE = 0x20;
const FLAG1_SYNCHRONIZATION_UNCERTAIN = 0x40;

interface FlagSpec {
  readonly mask: number;
  readonly name: string;
}

const FLAGS_BYTE0: readonly FlagSpec[] = [
  { mask: FLAG0_ALTERNATE_MASTER, name: 'alternateMasterFlag' },
  { mask: FLAG0_TWO_STEP, name: 'twoStepFlag' },
  { mask: FLAG0_UNICAST, name: 'unicastFlag' },
  { mask: FLAG0_PROFILE_SPECIFIC_1, name: 'profileSpecific1' },
  { mask: FLAG0_PROFILE_SPECIFIC_2, name: 'profileSpecific2' },
];

const FLAGS_BYTE1: readonly FlagSpec[] = [
  { mask: FLAG1_LEAP_61, name: 'leap61' },
  { mask: FLAG1_LEAP_59, name: 'leap59' },
  { mask: FLAG1_UTC_OFFSET_VALID, name: 'currentUtcOffsetValid' },
  { mask: FLAG1_PTP_TIMESCALE, name: 'ptpTimescale' },
  { mask: FLAG1_TIME_TRACEABLE, name: 'timeTraceable' },
  { mask: FLAG1_FREQUENCY_TRACEABLE, name: 'frequencyTraceable' },
  { mask: FLAG1_SYNCHRONIZATION_UNCERTAIN, name: 'synchronizationUncertain' },
];

/**
 * `controlField` v2'de KULLANIM DIŞIDIR (§13.3.2.10: "reserved for backward
 * compatibility with v1"), ama tel üzerinde hâlâ doldurulur ve messageType ile
 * ÇELİŞEBİLİR. Çelişki gerçek sahada bozuk üretici işaretidir; uyarılır.
 */
const CONTROL_FIELD_EXPECTATION: ReadonlyMap<number, number> = new Map([
  [MESSAGE_TYPE_SYNC, 0x00],
  [MESSAGE_TYPE_DELAY_REQ, 0x01],
  [MESSAGE_TYPE_FOLLOW_UP, 0x02],
  [MESSAGE_TYPE_DELAY_RESP, 0x03],
  [MESSAGE_TYPE_MANAGEMENT, 0x04],
]);

/** Spec `:614` BMCA'nın okuduğu veri kümesinden `clockClass`. Dar tutuldu:
 * yalnız IEEE 1588-2019 Tablo 4'ün ADLANDIRDIĞI değerler. */
const CLOCK_CLASS_NAMES: ReadonlyMap<number, string> = new Map([
  [6, 'Primary reference, PTP timescale'],
  [7, 'Primary reference holdover, PTP timescale'],
  [13, 'Application-specific time'],
  [14, 'Application-specific holdover'],
  [52, 'Degraded reference A (PTP timescale)'],
  [58, 'Degraded reference B (PTP timescale)'],
  [187, 'Degraded reference A (ARB timescale)'],
  [193, 'Degraded reference B (ARB timescale)'],
  [248, 'Default'],
  [255, 'Slave-only clock'],
]);

/** §7.6.2.5 Tablo 5 — enumerasyon, ham sayı değil. */
const CLOCK_ACCURACY_NAMES: ReadonlyMap<number, string> = new Map([
  [0x20, '25 ns'],
  [0x21, '100 ns'],
  [0x22, '250 ns'],
  [0x23, '1 µs'],
  [0x24, '2.5 µs'],
  [0x25, '10 µs'],
  [0x26, '25 µs'],
  [0x27, '100 µs'],
  [0x28, '250 µs'],
  [0x29, '1 ms'],
  [0x2a, '2.5 ms'],
  [0x2b, '10 ms'],
  [0x2c, '25 ms'],
  [0x2d, '100 ms'],
  [0x2e, '250 ms'],
  [0x2f, '1 s'],
  [0x30, '10 s'],
  [0x31, 'Greater than 10 s'],
  [0xfe, 'Unknown'],
]);

/** §7.6.2.8 Tablo 6. */
const TIME_SOURCE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x10, 'ATOMIC_CLOCK'],
  [0x20, 'GNSS'],
  [0x30, 'TERRESTRIAL_RADIO'],
  [0x39, 'SERIAL_TIME_CODE'],
  [0x40, 'PTP'],
  [0x50, 'NTP'],
  [0x60, 'HAND_SET'],
  [0x90, 'OTHER'],
  [0xa0, 'INTERNAL_OSCILLATOR'],
]);

/** §14.1.1 Tablo 52'nin adlandırdığı, sahada görülen dar küme. */
const TLV_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0001, 'MANAGEMENT'],
  [0x0002, 'MANAGEMENT_ERROR_STATUS'],
  [0x0003, 'ORGANIZATION_EXTENSION'],
  [0x0004, 'REQUEST_UNICAST_TRANSMISSION'],
  [0x0005, 'GRANT_UNICAST_TRANSMISSION'],
  [0x0006, 'CANCEL_UNICAST_TRANSMISSION'],
  [0x0007, 'ACKNOWLEDGE_CANCEL_UNICAST_TRANSMISSION'],
  [0x0008, 'PATH_TRACE'],
  [0x0009, 'ALTERNATE_TIME_OFFSET_INDICATOR'],
  [0x4000, 'ORGANIZATION_EXTENSION_PROPAGATE'],
  [0x8000, 'ORGANIZATION_EXTENSION_DO_NOT_PROPAGATE'],
  [0x8001, 'L1_SYNC'],
  [0x8002, 'PORT_COMMUNICATION_AVAILABILITY'],
  [0x8003, 'PROTOCOL_ADDRESS'],
  [0x8004, 'SLAVE_RX_SYNC_TIMING_DATA'],
]);

const TLV_HEADER_LENGTH = 4;
/** Bozuk `lengthField` sonsuz döngü üretmesin diye üst sınır (spec §41). */
const MAX_TLV_COUNT = 64;

const ERROR_FRAME_TOO_SHORT = 'protocol.ptp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ptp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ptp.error.aborted';
const ERROR_BODY_TRUNCATED = 'protocol.ptp.error.bodyTruncated';

const WARN_UNKNOWN_MESSAGE_TYPE = 'protocol.ptp.warning.unknownMessageType';
const WARN_UNEXPECTED_VERSION = 'protocol.ptp.warning.unexpectedVersion';
const WARN_MESSAGE_LENGTH_MISMATCH = 'protocol.ptp.warning.messageLengthMismatch';
const WARN_CONTROL_FIELD_MISMATCH = 'protocol.ptp.warning.controlFieldMismatch';
const WARN_TWO_STEP_IGNORED = 'protocol.ptp.warning.twoStepIgnored';
const WARN_TIMESTAMP_UNSET = 'protocol.ptp.warning.timestampUnset';
const WARN_TIMESTAMP_TAI = 'protocol.ptp.warning.timestampTai';
const WARN_NANOSECONDS_OUT_OF_RANGE = 'protocol.ptp.warning.nanosecondsOutOfRange';
const WARN_UNKNOWN_CLOCK_CLASS = 'protocol.ptp.warning.unknownClockClass';
const WARN_UNKNOWN_CLOCK_ACCURACY = 'protocol.ptp.warning.unknownClockAccuracy';
const WARN_UNKNOWN_TIME_SOURCE = 'protocol.ptp.warning.unknownTimeSource';
const WARN_UNKNOWN_TLV_TYPE = 'protocol.ptp.warning.unknownTlvType';
const WARN_TLV_ODD_LENGTH = 'protocol.ptp.warning.tlvOddLength';
const WARN_TLV_TRUNCATED = 'protocol.ptp.warning.tlvTruncated';
const WARN_TLV_LIMIT = 'protocol.ptp.warning.tlvLimit';
const WARN_BMCA_NEEDS_MULTIPLE_ANNOUNCE = 'protocol.ptp.warning.bmcaNeedsMultipleAnnounce';
const WARN_PATH_DELAY_NEEDS_EXCHANGE = 'protocol.ptp.warning.pathDelayNeedsExchange';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readInt16BE(data: Uint8Array, offset: number): number {
  const value = readUint16BE(data, offset);
  return value > 0x7fff ? value - 0x10000 : value;
}

function readSignedByte(data: Uint8Array, offset: number): number {
  const value = byteAt(data, offset);
  return value > 0x7f ? value - 0x100 : value;
}

function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

function formatFlagList(value: number, specs: readonly FlagSpec[]): string {
  const set = specs.filter((spec) => (value & spec.mask) !== 0).map((spec) => spec.name);
  return set.length === 0 ? 'none' : set.join(', ');
}

function roundNanoseconds(value: number): number {
  return Math.round(value * 1e3) / 1e3;
}

interface PtpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** Bir mesaj tipinin başlıktan sonra beklediği gövde uzunluğu ve TLV'ye açık
 * olup olmadığı. `undefined` gövde uzunluğu "tanınmayan tip" demektir. */
interface BodyShape {
  readonly length: number;
  readonly allowsTlv: boolean;
}

const BODY_SHAPES: ReadonlyMap<number, BodyShape> = new Map([
  [MESSAGE_TYPE_SYNC, { length: PTP_TIMESTAMP_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_DELAY_REQ, { length: PTP_TIMESTAMP_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_FOLLOW_UP, { length: PTP_TIMESTAMP_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_PDELAY_REQ, { length: PTP_TIMESTAMP_LENGTH + PORT_IDENTITY_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_PDELAY_RESP, { length: PTP_TIMESTAMP_LENGTH + PORT_IDENTITY_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_PDELAY_RESP_FOLLOW_UP, { length: PTP_TIMESTAMP_LENGTH + PORT_IDENTITY_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_DELAY_RESP, { length: PTP_TIMESTAMP_LENGTH + PORT_IDENTITY_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_ANNOUNCE, { length: 30, allowsTlv: true }],
  [MESSAGE_TYPE_SIGNALING, { length: PORT_IDENTITY_LENGTH, allowsTlv: true }],
  [MESSAGE_TYPE_MANAGEMENT, { length: PORT_IDENTITY_LENGTH + 4, allowsTlv: true }],
]);

function pushTimestampField(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): PtpTimestamp {
  const parsed = readPtpTimestamp(data, offset);
  const field: ParsedField = {
    id,
    name,
    offset,
    length: PTP_TIMESTAMP_LENGTH,
    rawBytes: data.slice(offset, offset + PTP_TIMESTAMP_LENGTH),
    valid: !parsed.nanosecondsOutOfRange,
    warnings: [],
  };

  if (parsed.unset) {
    // Two-step Sync'in originTimestamp'ı tipik olarak sıfırdır (ptpTimestamp.ts).
    field.warnings = [WARN_TIMESTAMP_UNSET];
  } else {
    field.physicalValue = parsed.taiIso ?? '';
    // TAI ölçeği: UTC'ye çevirmek Announce'un currentUtcOffset'ini ister.
    field.warnings = [WARN_TIMESTAMP_TAI];
    if (parsed.nanosecondsOutOfRange) {
      field.warnings = [...field.warnings, WARN_NANOSECONDS_OUT_OF_RANGE];
      warnings.push(toProtocolWarning(WARN_NANOSECONDS_OUT_OF_RANGE));
    }
  }

  fields.push(field);
  return parsed;
}

function pushPortIdentityFields(
  data: Uint8Array,
  idPrefix: string,
  namePrefix: string,
  offset: number,
  fields: ParsedField[],
): void {
  const identityBytes = data.slice(offset, offset + CLOCK_IDENTITY_LENGTH);
  fields.push({
    id: `${idPrefix}-clock-identity`,
    name: `${namePrefix} Clock Identity`,
    offset,
    length: CLOCK_IDENTITY_LENGTH,
    rawBytes: identityBytes,
    rawValue: formatClockIdentity(identityBytes),
    valid: true,
    warnings: [],
  });

  const portOffset = offset + CLOCK_IDENTITY_LENGTH;
  fields.push({
    id: `${idPrefix}-port-number`,
    name: `${namePrefix} Port Number`,
    offset: portOffset,
    length: WORD_LENGTH,
    rawBytes: data.slice(portOffset, portOffset + WORD_LENGTH),
    rawValue: readUint16BE(data, portOffset),
    valid: true,
    warnings: [],
  });
}

/** Announce gövdesi (§13.5): BMCA'nın okuduğu veri kümesi buradadır. */
function parseAnnounceBody(
  data: Uint8Array,
  bodyOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  pushTimestampField(data, 'origin-timestamp', 'Origin Timestamp', bodyOffset, fields, warnings);

  let cursor = bodyOffset + PTP_TIMESTAMP_LENGTH;

  const currentUtcOffset = readInt16BE(data, cursor);
  fields.push({
    id: 'current-utc-offset',
    name: 'Current UTC Offset',
    offset: cursor,
    length: WORD_LENGTH,
    rawBytes: data.slice(cursor, cursor + WORD_LENGTH),
    rawValue: currentUtcOffset,
    unit: 's',
    valid: true,
    warnings: [],
  });
  cursor += WORD_LENGTH;

  // Bayt: reserved. Atlanır ama offset ilerler — sessiz kayma buradan başlar.
  cursor += 1;

  const priority1 = byteAt(data, cursor);
  fields.push({
    id: 'grandmaster-priority1',
    name: 'Grandmaster Priority1',
    offset: cursor,
    length: 1,
    rawBytes: data.slice(cursor, cursor + 1),
    rawValue: priority1,
    valid: true,
    warnings: [],
  });
  cursor += 1;

  const clockClass = byteAt(data, cursor);
  const clockClassName = CLOCK_CLASS_NAMES.get(clockClass);
  const clockClassField: ParsedField = {
    id: 'grandmaster-clock-class',
    name: 'Grandmaster Clock Class',
    offset: cursor,
    length: 1,
    rawBytes: data.slice(cursor, cursor + 1),
    rawValue: clockClass,
    valid: true,
    warnings: [],
  };
  if (clockClassName !== undefined) clockClassField.physicalValue = clockClassName;
  else {
    clockClassField.warnings = [WARN_UNKNOWN_CLOCK_CLASS];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CLOCK_CLASS));
  }
  fields.push(clockClassField);
  cursor += 1;

  const clockAccuracy = byteAt(data, cursor);
  const clockAccuracyName = CLOCK_ACCURACY_NAMES.get(clockAccuracy);
  const clockAccuracyField: ParsedField = {
    id: 'grandmaster-clock-accuracy',
    name: 'Grandmaster Clock Accuracy',
    offset: cursor,
    length: 1,
    rawBytes: data.slice(cursor, cursor + 1),
    rawValue: clockAccuracy,
    valid: true,
    warnings: [],
  };
  if (clockAccuracyName !== undefined) clockAccuracyField.physicalValue = clockAccuracyName;
  else {
    clockAccuracyField.warnings = [WARN_UNKNOWN_CLOCK_ACCURACY];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CLOCK_ACCURACY));
  }
  fields.push(clockAccuracyField);
  cursor += 1;

  fields.push({
    id: 'grandmaster-offset-scaled-log-variance',
    name: 'Grandmaster Offset Scaled Log Variance',
    offset: cursor,
    length: WORD_LENGTH,
    rawBytes: data.slice(cursor, cursor + WORD_LENGTH),
    rawValue: readUint16BE(data, cursor),
    valid: true,
    warnings: [],
  });
  cursor += WORD_LENGTH;

  fields.push({
    id: 'grandmaster-priority2',
    name: 'Grandmaster Priority2',
    offset: cursor,
    length: 1,
    rawBytes: data.slice(cursor, cursor + 1),
    rawValue: byteAt(data, cursor),
    valid: true,
    warnings: [],
  });
  cursor += 1;

  const grandmasterIdentity = data.slice(cursor, cursor + CLOCK_IDENTITY_LENGTH);
  fields.push({
    id: 'grandmaster-identity',
    name: 'Grandmaster Identity',
    offset: cursor,
    length: CLOCK_IDENTITY_LENGTH,
    rawBytes: grandmasterIdentity,
    rawValue: formatClockIdentity(grandmasterIdentity),
    valid: true,
    warnings: [],
  });
  cursor += CLOCK_IDENTITY_LENGTH;

  fields.push({
    id: 'steps-removed',
    name: 'Steps Removed',
    offset: cursor,
    length: WORD_LENGTH,
    rawBytes: data.slice(cursor, cursor + WORD_LENGTH),
    rawValue: readUint16BE(data, cursor),
    valid: true,
    warnings: [],
  });
  cursor += WORD_LENGTH;

  const timeSource = byteAt(data, cursor);
  const timeSourceName = TIME_SOURCE_NAMES.get(timeSource);
  const timeSourceField: ParsedField = {
    id: 'time-source',
    name: 'Time Source',
    offset: cursor,
    length: 1,
    rawBytes: data.slice(cursor, cursor + 1),
    rawValue: timeSource,
    valid: true,
    warnings: [],
  };
  if (timeSourceName !== undefined) timeSourceField.physicalValue = timeSourceName;
  else {
    timeSourceField.warnings = [WARN_UNKNOWN_TIME_SOURCE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_TIME_SOURCE));
  }
  fields.push(timeSourceField);

  // Altı BMCA verisi çözüldü ama KARAR verilemez: karşılaştıracak ikinci bir
  // Announce yok (dosya başı).
  warnings.push(toProtocolWarning(WARN_BMCA_NEEDS_MULTIPLE_ANNOUNCE));
}

/** TLV16 zinciri: yalnız BAŞLIKLAR yürünür, gövdeler ham kalır (dosya başı). */
function parseTlvChain(
  data: Uint8Array,
  startOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  let cursor = startOffset;
  let index = 0;

  while (cursor + TLV_HEADER_LENGTH <= data.length) {
    if (index >= MAX_TLV_COUNT) {
      warnings.push(toProtocolWarning(WARN_TLV_LIMIT));
      return;
    }

    const tlvType = readUint16BE(data, cursor);
    const lengthField = readUint16BE(data, cursor + WORD_LENGTH);
    const typeName = TLV_TYPE_NAMES.get(tlvType);

    const typeField: ParsedField = {
      id: `tlv-${index}-type`,
      name: `TLV ${index} Type`,
      offset: cursor,
      length: WORD_LENGTH,
      rawBytes: data.slice(cursor, cursor + WORD_LENGTH),
      rawValue: tlvType,
      valid: true,
      warnings: [],
    };
    if (typeName !== undefined) typeField.physicalValue = typeName;
    else {
      typeField.warnings = [WARN_UNKNOWN_TLV_TYPE];
      warnings.push(toProtocolWarning(WARN_UNKNOWN_TLV_TYPE));
    }
    fields.push(typeField);

    const lengthFieldOffset = cursor + WORD_LENGTH;
    const lengthFieldEntry: ParsedField = {
      id: `tlv-${index}-length`,
      name: `TLV ${index} Length`,
      offset: lengthFieldOffset,
      length: WORD_LENGTH,
      rawBytes: data.slice(lengthFieldOffset, lengthFieldOffset + WORD_LENGTH),
      rawValue: lengthField,
      unit: 'B',
      valid: lengthField % 2 === 0,
      warnings: [],
    };
    if (lengthField % 2 !== 0) {
      // §14.1.1: lengthField ÇİFT olmak zorunda. Tek gelirse zincir hizası
      // bozulur; okumaya devam edilir ama kullanıcı bilmelidir.
      lengthFieldEntry.warnings = [WARN_TLV_ODD_LENGTH];
      warnings.push(toProtocolWarning(WARN_TLV_ODD_LENGTH));
    }
    fields.push(lengthFieldEntry);

    const valueOffset = cursor + TLV_HEADER_LENGTH;
    const available = data.length - valueOffset;
    const valueLength = Math.min(lengthField, Math.max(available, 0));

    if (valueLength > 0) {
      fields.push({
        id: `tlv-${index}-value`,
        name: `TLV ${index} Value`,
        offset: valueOffset,
        length: valueLength,
        rawBytes: data.slice(valueOffset, valueOffset + valueLength),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }

    if (lengthField > available) {
      warnings.push(toProtocolWarning(WARN_TLV_TRUNCATED));
      return;
    }

    // lengthField 0 ise imleç yalnız başlık kadar ilerler; sonsuz döngü yok.
    cursor = valueOffset + lengthField;
    index += 1;
  }
}

function parsePtpFrame(data: Uint8Array, options: PtpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
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
        details: { requiredBytes: HEADER_LENGTH, availableBytes: data.length },
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

  // ── Bayt 0: majorSdoId ÜST, messageType ALT yarı (dosya başı).
  const sdoMessageTypeByte = byteAt(data, SDO_MESSAGE_TYPE_OFFSET);
  const sdoMessageTypeBytes = data.slice(SDO_MESSAGE_TYPE_OFFSET, SDO_MESSAGE_TYPE_OFFSET + 1);

  fields.push({
    id: 'major-sdo-id',
    name: 'majorSdoId',
    offset: SDO_MESSAGE_TYPE_OFFSET,
    length: 1,
    rawBytes: sdoMessageTypeBytes,
    rawValue: (sdoMessageTypeByte >>> NIBBLE_SHIFT) & NIBBLE_MASK,
    valid: true,
    warnings: [],
  });

  const messageType = sdoMessageTypeByte & NIBBLE_MASK;
  const messageTypeName = MESSAGE_TYPE_NAMES.get(messageType);
  const messageTypeField: ParsedField = {
    id: 'message-type',
    name: 'Message Type',
    offset: SDO_MESSAGE_TYPE_OFFSET,
    length: 1,
    rawBytes: sdoMessageTypeBytes,
    rawValue: messageType,
    valid: messageTypeName !== undefined,
    warnings: [],
  };
  if (messageTypeName !== undefined) messageTypeField.physicalValue = messageTypeName;
  else {
    messageTypeField.warnings = [WARN_UNKNOWN_MESSAGE_TYPE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_MESSAGE_TYPE));
  }
  fields.push(messageTypeField);

  // ── Bayt 1: minorVersionPTP ÜST, versionPTP ALT yarı.
  const versionByte = byteAt(data, VERSION_OFFSET);
  const versionBytes = data.slice(VERSION_OFFSET, VERSION_OFFSET + 1);

  const versionPtp = versionByte & NIBBLE_MASK;
  const versionField: ParsedField = {
    id: 'version-ptp',
    name: 'versionPTP',
    offset: VERSION_OFFSET,
    length: 1,
    rawBytes: versionBytes,
    rawValue: versionPtp,
    valid: true,
    warnings: [],
  };
  if (versionPtp !== PTP_VERSION_2) {
    // v1 başlık düzeni TAMAMEN farklıdır; bu motor onu çözemez.
    versionField.valid = false;
    versionField.warnings = [WARN_UNEXPECTED_VERSION];
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_VERSION));
  }
  fields.push(versionField);

  fields.push({
    id: 'minor-version-ptp',
    name: 'minorVersionPTP',
    offset: VERSION_OFFSET,
    length: 1,
    rawBytes: versionBytes,
    rawValue: (versionByte >>> NIBBLE_SHIFT) & NIBBLE_MASK,
    valid: true,
    warnings: [],
  });

  // ── messageLength: BAŞLIK DAHİL toplam uzunluk (§13.3.2.3).
  const messageLength = readUint16BE(data, MESSAGE_LENGTH_OFFSET);
  const messageLengthField: ParsedField = {
    id: 'message-length',
    name: 'Message Length',
    offset: MESSAGE_LENGTH_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(MESSAGE_LENGTH_OFFSET, MESSAGE_LENGTH_OFFSET + WORD_LENGTH),
    rawValue: messageLength,
    unit: 'B',
    valid: messageLength === data.length,
    warnings: [],
  };
  if (messageLength !== data.length) {
    // Taşıyıcı dolgusu (Ethernet 64 baytlık asgari) fazlalık üretebilir; eksiklik
    // ise gerçek kesilmedir. İkisi de aynı uyarıyla bildirilir, hata BASILMAZ.
    messageLengthField.warnings = [WARN_MESSAGE_LENGTH_MISMATCH];
    warnings.push(toProtocolWarning(WARN_MESSAGE_LENGTH_MISMATCH));
  }
  fields.push(messageLengthField);

  fields.push({
    id: 'domain-number',
    name: 'Domain Number',
    offset: DOMAIN_NUMBER_OFFSET,
    length: 1,
    rawBytes: data.slice(DOMAIN_NUMBER_OFFSET, DOMAIN_NUMBER_OFFSET + 1),
    rawValue: byteAt(data, DOMAIN_NUMBER_OFFSET),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'minor-sdo-id',
    name: 'minorSdoId',
    offset: MINOR_SDO_ID_OFFSET,
    length: 1,
    rawBytes: data.slice(MINOR_SDO_ID_OFFSET, MINOR_SDO_ID_OFFSET + 1),
    rawValue: byteAt(data, MINOR_SDO_ID_OFFSET),
    valid: true,
    warnings: [],
  });

  // ── flagField: iki bayt AYRI anlam kümesi taşır (dosya başı).
  const flags0 = byteAt(data, FLAGS_OFFSET);
  const flags1 = byteAt(data, FLAGS_OFFSET + 1);
  fields.push({
    id: 'flags',
    name: 'Flag Field',
    offset: FLAGS_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(FLAGS_OFFSET, FLAGS_OFFSET + WORD_LENGTH),
    rawValue: readUint16BE(data, FLAGS_OFFSET),
    physicalValue: `${formatFlagList(flags0, FLAGS_BYTE0)} | ${formatFlagList(flags1, FLAGS_BYTE1)}`,
    valid: true,
    warnings: [],
  });

  // ── Türetilmiş Clock Mode — YALNIZ Sync/Pdelay_Resp'te (dosya başı).
  const twoStep = (flags0 & FLAG0_TWO_STEP) !== 0;
  if (TWO_STEP_RELEVANT_TYPES.has(messageType)) {
    fields.push({
      id: 'clock-mode',
      name: 'Clock Mode',
      offset: FLAGS_OFFSET,
      length: 1,
      rawBytes: data.slice(FLAGS_OFFSET, FLAGS_OFFSET + 1),
      physicalValue: twoStep ? 'Two-Step' : 'One-Step',
      valid: true,
      warnings: [],
    });
  } else if (twoStep) {
    // Bayrak set ama bu mesaj tipinde tanımsız — üretici alışkanlığı olabilir,
    // "Two-Step" diye yorumlamak yanlış olur.
    warnings.push(toProtocolWarning(WARN_TWO_STEP_IGNORED));
  }

  // ── correctionField: işaretli, nanosaniye × 2^16 (dosya başı).
  const correctionNs = readCorrectionFieldNanoseconds(data, CORRECTION_FIELD_OFFSET);
  fields.push({
    id: 'correction-field',
    name: 'Correction Field',
    offset: CORRECTION_FIELD_OFFSET,
    length: CORRECTION_FIELD_LENGTH,
    rawBytes: data.slice(CORRECTION_FIELD_OFFSET, CORRECTION_FIELD_OFFSET + CORRECTION_FIELD_LENGTH),
    physicalValue: roundNanoseconds(correctionNs),
    unit: 'ns',
    valid: true,
    warnings: [],
  });

  const messageTypeSpecific = data.slice(MESSAGE_TYPE_SPECIFIC_OFFSET, MESSAGE_TYPE_SPECIFIC_OFFSET + DWORD_LENGTH);
  fields.push({
    id: 'message-type-specific',
    name: 'messageTypeSpecific',
    offset: MESSAGE_TYPE_SPECIFIC_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: messageTypeSpecific,
    rawValue: `0x${formatHex(messageTypeSpecific)}`,
    valid: true,
    warnings: [],
  });

  pushPortIdentityFields(data, 'source-port-identity', 'Source Port Identity', CLOCK_IDENTITY_OFFSET, fields);

  fields.push({
    id: 'sequence-id',
    name: 'Sequence ID',
    offset: SEQUENCE_ID_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(SEQUENCE_ID_OFFSET, SEQUENCE_ID_OFFSET + WORD_LENGTH),
    rawValue: readUint16BE(data, SEQUENCE_ID_OFFSET),
    valid: true,
    warnings: [],
  });

  // ── controlField: v2'de kullanım dışı ama messageType ile çelişebilir.
  const controlField = byteAt(data, CONTROL_FIELD_OFFSET);
  const expectedControl = CONTROL_FIELD_EXPECTATION.get(messageType);
  const controlFieldEntry: ParsedField = {
    id: 'control-field',
    name: 'Control Field (v1 legacy)',
    offset: CONTROL_FIELD_OFFSET,
    length: 1,
    rawBytes: data.slice(CONTROL_FIELD_OFFSET, CONTROL_FIELD_OFFSET + 1),
    rawValue: controlField,
    valid: true,
    warnings: [],
  };
  if (expectedControl !== undefined && controlField !== expectedControl) {
    controlFieldEntry.warnings = [WARN_CONTROL_FIELD_MISMATCH];
    warnings.push(toProtocolWarning(WARN_CONTROL_FIELD_MISMATCH));
  }
  fields.push(controlFieldEntry);

  const logMessageInterval = readSignedByte(data, LOG_MESSAGE_INTERVAL_OFFSET);
  fields.push({
    id: 'log-message-interval',
    name: 'Log Message Interval',
    offset: LOG_MESSAGE_INTERVAL_OFFSET,
    length: 1,
    rawBytes: data.slice(LOG_MESSAGE_INTERVAL_OFFSET, LOG_MESSAGE_INTERVAL_OFFSET + 1),
    rawValue: logMessageInterval,
    // İŞARETLİ log2 saniye — `ntp.ts`teki Poll/Precision ile aynı biçim.
    physicalValue: `2^${logMessageInterval} s`,
    valid: true,
    warnings: [],
  });

  // ── Gövde.
  const shape = BODY_SHAPES.get(messageType);
  if (shape === undefined) {
    // Tanınmayan mesaj tipi: gövde ham gösterilir, uydurulmaz.
    const bodyBytes = data.slice(HEADER_LENGTH);
    if (bodyBytes.length > 0) {
      fields.push({
        id: 'unparsed-body',
        name: 'Unparsed Body',
        offset: HEADER_LENGTH,
        length: bodyBytes.length,
        rawBytes: bodyBytes,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else if (data.length < HEADER_LENGTH + shape.length) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: HEADER_LENGTH,
      length: HEADER_LENGTH + shape.length - data.length,
      details: {
        messageType,
        requiredBodyBytes: shape.length,
        availableBodyBytes: Math.max(data.length - HEADER_LENGTH, 0),
      },
    });
  } else {
    parseBody(data, messageType, fields, warnings);
    if (shape.allowsTlv) parseTlvChain(data, HEADER_LENGTH + shape.length, fields, warnings);
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

function parseBody(
  data: Uint8Array,
  messageType: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const bodyOffset = HEADER_LENGTH;

  switch (messageType) {
    case MESSAGE_TYPE_SYNC:
      pushTimestampField(data, 'origin-timestamp', 'Origin Timestamp (t1)', bodyOffset, fields, warnings);
      // t1 tek başına gecikme vermez; alışverişin diğer üç anı ayrı mesajlarda.
      warnings.push(toProtocolWarning(WARN_PATH_DELAY_NEEDS_EXCHANGE));
      return;

    case MESSAGE_TYPE_DELAY_REQ:
      pushTimestampField(data, 'origin-timestamp', 'Origin Timestamp (t3)', bodyOffset, fields, warnings);
      warnings.push(toProtocolWarning(WARN_PATH_DELAY_NEEDS_EXCHANGE));
      return;

    case MESSAGE_TYPE_FOLLOW_UP:
      // Two-step'te asıl t1 BURADADIR, Sync'te değil (dosya başı).
      pushTimestampField(data, 'precise-origin-timestamp', 'Precise Origin Timestamp (t1)', bodyOffset, fields, warnings);
      warnings.push(toProtocolWarning(WARN_PATH_DELAY_NEEDS_EXCHANGE));
      return;

    case MESSAGE_TYPE_DELAY_RESP:
      pushTimestampField(data, 'receive-timestamp', 'Receive Timestamp (t4)', bodyOffset, fields, warnings);
      pushPortIdentityFields(
        data,
        'requesting-port-identity',
        'Requesting Port Identity',
        bodyOffset + PTP_TIMESTAMP_LENGTH,
        fields,
      );
      warnings.push(toProtocolWarning(WARN_PATH_DELAY_NEEDS_EXCHANGE));
      return;

    case MESSAGE_TYPE_PDELAY_REQ:
      pushTimestampField(data, 'origin-timestamp', 'Origin Timestamp', bodyOffset, fields, warnings);
      // Gövdenin ikinci yarısı §13.9'da RESERVED'dır; ham gösterilir.
      fields.push({
        id: 'reserved',
        name: 'Reserved',
        offset: bodyOffset + PTP_TIMESTAMP_LENGTH,
        length: PORT_IDENTITY_LENGTH,
        rawBytes: data.slice(bodyOffset + PTP_TIMESTAMP_LENGTH, bodyOffset + PTP_TIMESTAMP_LENGTH + PORT_IDENTITY_LENGTH),
        unit: 'B',
        valid: true,
        warnings: [],
      });
      return;

    case MESSAGE_TYPE_PDELAY_RESP:
      pushTimestampField(data, 'request-receipt-timestamp', 'Request Receipt Timestamp', bodyOffset, fields, warnings);
      pushPortIdentityFields(
        data,
        'requesting-port-identity',
        'Requesting Port Identity',
        bodyOffset + PTP_TIMESTAMP_LENGTH,
        fields,
      );
      return;

    case MESSAGE_TYPE_PDELAY_RESP_FOLLOW_UP:
      pushTimestampField(data, 'response-origin-timestamp', 'Response Origin Timestamp', bodyOffset, fields, warnings);
      pushPortIdentityFields(
        data,
        'requesting-port-identity',
        'Requesting Port Identity',
        bodyOffset + PTP_TIMESTAMP_LENGTH,
        fields,
      );
      return;

    case MESSAGE_TYPE_ANNOUNCE:
      parseAnnounceBody(data, bodyOffset, fields, warnings);
      return;

    case MESSAGE_TYPE_SIGNALING:
      pushPortIdentityFields(data, 'target-port-identity', 'Target Port Identity', bodyOffset, fields);
      return;

    case MESSAGE_TYPE_MANAGEMENT: {
      pushPortIdentityFields(data, 'target-port-identity', 'Target Port Identity', bodyOffset, fields);
      let cursor = bodyOffset + PORT_IDENTITY_LENGTH;
      fields.push({
        id: 'starting-boundary-hops',
        name: 'Starting Boundary Hops',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: byteAt(data, cursor),
        valid: true,
        warnings: [],
      });
      cursor += 1;
      fields.push({
        id: 'boundary-hops',
        name: 'Boundary Hops',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: byteAt(data, cursor),
        valid: true,
        warnings: [],
      });
      cursor += 1;
      fields.push({
        id: 'action-field',
        name: 'Action Field',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        // Üst dört bit reserved; anlam ALT dörtte (§15.4.1.5).
        rawValue: byteAt(data, cursor) & NIBBLE_MASK,
        valid: true,
        warnings: [],
      });
      return;
    }

    default:
      return;
  }
}

export function parsePtp(data: Uint8Array): ParseResult {
  return parsePtpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): PtpParseOptions {
  const options: PtpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ptpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: ortak başlık uzunluğu + versionPTP alt yarısı 2.
   * messageType YOKLANMAZ — tanınmayan tip `parse`de uyarıyla geçer. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    return (byteAt(data, VERSION_OFFSET) & NIBBLE_MASK) === PTP_VERSION_2;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parsePtpFrame(data, readContextOptions(context));
  },
};

/** Örnek üreticisi — testler ve UI aynı baytları görsün (spec §42/§43). */
function ptpHeader(input: {
  messageType: number;
  majorSdoId?: number;
  messageLength: number;
  domainNumber: number;
  flags: readonly [number, number];
  correctionScaledNs: number;
  clockIdentity: readonly number[];
  portNumber: number;
  sequenceId: number;
  controlField: number;
  logMessageInterval: number;
}): number[] {
  const word = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff];
  const correction: number[] = [];
  let remaining = BigInt(input.correctionScaledNs);
  if (remaining < 0n) remaining += 1n << 64n;
  for (let index = 7; index >= 0; index -= 1) {
    correction[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return [
    (((input.majorSdoId ?? 0) & NIBBLE_MASK) << NIBBLE_SHIFT) | (input.messageType & NIBBLE_MASK),
    PTP_VERSION_2,
    ...word(input.messageLength),
    input.domainNumber,
    0x00,
    input.flags[0],
    input.flags[1],
    ...correction,
    0x00,
    0x00,
    0x00,
    0x00,
    ...input.clockIdentity,
    ...word(input.portNumber),
    ...word(input.sequenceId),
    input.controlField,
    input.logMessageInterval & 0xff,
  ];
}

/** 80-bit damga: 48 bit saniye + 32 bit nanosaniye. */
function ptpTimestampBytes(seconds: number, nanoseconds: number): number[] {
  const high = Math.floor(seconds / 2 ** 32);
  const low = seconds >>> 0;
  return [
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
    (nanoseconds >>> 24) & 0xff,
    (nanoseconds >>> 16) & 0xff,
    (nanoseconds >>> 8) & 0xff,
    nanoseconds & 0xff,
  ];
}

/** 2026-08-22T12:00:00 TAI (PTP epoch 1970-01-01 TAI). */
const EXAMPLE_SECONDS = 1_787_400_000;
const EXAMPLE_CLOCK_IDENTITY = [0x00, 0x1b, 0x19, 0xff, 0xfe, 0x00, 0x00, 0x01];

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'sync-two-step',
    name: 'protocol.ptp.example.syncTwoStep.name',
    // twoStepFlag set: originTimestamp SIFIR, asıl t1 Follow_Up'ta gelir.
    bytes: Uint8Array.from([
      ...ptpHeader({
        messageType: MESSAGE_TYPE_SYNC,
        messageLength: 44,
        domainNumber: 0,
        flags: [FLAG0_TWO_STEP, FLAG1_PTP_TIMESCALE | FLAG1_UTC_OFFSET_VALID],
        correctionScaledNs: 0,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 100,
        controlField: 0x00,
        logMessageInterval: -3,
      }),
      ...ptpTimestampBytes(0, 0),
    ]),
    description: 'protocol.ptp.example.syncTwoStep.description',
    expectedValid: true,
  },
  {
    id: 'follow-up',
    name: 'protocol.ptp.example.followUp.name',
    // Follow_Up: preciseOriginTimestamp dolu, correctionField transparent
    // clock'un biriktirdiği 1250.5 ns (= 1250.5 × 65536 ölçekli).
    bytes: Uint8Array.from([
      ...ptpHeader({
        messageType: MESSAGE_TYPE_FOLLOW_UP,
        messageLength: 44,
        domainNumber: 0,
        flags: [0x00, FLAG1_PTP_TIMESCALE | FLAG1_UTC_OFFSET_VALID],
        correctionScaledNs: 81_952_768,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 100,
        controlField: 0x02,
        logMessageInterval: -3,
      }),
      ...ptpTimestampBytes(EXAMPLE_SECONDS, 123_456_789),
    ]),
    description: 'protocol.ptp.example.followUp.description',
    expectedValid: true,
  },
  {
    id: 'announce',
    name: 'protocol.ptp.example.announce.name',
    // BMCA verisi: Priority1=128, ClockClass=6 (GNSS'e kilitli), Priority2=128.
    bytes: Uint8Array.from([
      ...ptpHeader({
        messageType: MESSAGE_TYPE_ANNOUNCE,
        messageLength: 64,
        domainNumber: 0,
        flags: [0x00, FLAG1_PTP_TIMESCALE | FLAG1_UTC_OFFSET_VALID | FLAG1_TIME_TRACEABLE],
        correctionScaledNs: 0,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 42,
        controlField: 0x05,
        logMessageInterval: 1,
      }),
      ...ptpTimestampBytes(0, 0),
      0x00,
      0x25, // currentUtcOffset = 37 s (2026)
      0x00, // reserved
      128, // grandmasterPriority1
      6, // clockClass
      0x21, // clockAccuracy = 100 ns
      0x00,
      0x80, // offsetScaledLogVariance
      128, // grandmasterPriority2
      ...EXAMPLE_CLOCK_IDENTITY,
      0x00,
      0x00, // stepsRemoved
      0x20, // timeSource = GNSS
    ]),
    description: 'protocol.ptp.example.announce.description',
    expectedValid: true,
  },
  {
    id: 'delay-resp-negative-correction',
    name: 'protocol.ptp.example.delayRespNegativeCorrection.name',
    // NEGATİF correctionField (-500 ns): işaretsiz okunursa astronomik çıkar.
    bytes: Uint8Array.from([
      ...ptpHeader({
        messageType: MESSAGE_TYPE_DELAY_RESP,
        messageLength: 54,
        domainNumber: 0,
        flags: [0x00, FLAG1_PTP_TIMESCALE],
        correctionScaledNs: -32_768_000,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 7,
        controlField: 0x03,
        logMessageInterval: 0x7f,
      }),
      ...ptpTimestampBytes(EXAMPLE_SECONDS, 500_000_000),
      0x00,
      0x1b,
      0x19,
      0xff,
      0xfe,
      0x00,
      0x00,
      0x02,
      0x00,
      0x01,
    ]),
    description: 'protocol.ptp.example.delayRespNegativeCorrection.description',
    expectedValid: true,
  },
  {
    id: 'signaling-with-tlv',
    name: 'protocol.ptp.example.signalingWithTlv.name',
    // TLV16 zinciri: REQUEST_UNICAST_TRANSMISSION (tip 0x0004, 6 baytlık gövde).
    bytes: Uint8Array.from([
      ...ptpHeader({
        messageType: MESSAGE_TYPE_SIGNALING,
        messageLength: 54,
        domainNumber: 0,
        flags: [FLAG0_UNICAST, 0x00],
        correctionScaledNs: 0,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 3,
        controlField: 0x05,
        logMessageInterval: 0x7f,
      }),
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0x00,
      0x04, // tlvType = REQUEST_UNICAST_TRANSMISSION
      0x00,
      0x06, // lengthField = 6
      0x00, // messageType nibble
      0x00, // logInterMessagePeriod
      0x00,
      0x00,
      0x00,
      0x3c, // durationField = 60 s
    ]),
    description: 'protocol.ptp.example.signalingWithTlv.description',
    expectedValid: true,
  },
  {
    id: 'truncated-body',
    name: 'protocol.ptp.example.truncatedBody.name',
    // Announce başlığı var, gövdesi eksik — hata yolu.
    bytes: Uint8Array.from(
      ptpHeader({
        messageType: MESSAGE_TYPE_ANNOUNCE,
        messageLength: 64,
        domainNumber: 0,
        flags: [0x00, FLAG1_PTP_TIMESCALE],
        correctionScaledNs: 0,
        clockIdentity: EXAMPLE_CLOCK_IDENTITY,
        portNumber: 1,
        sequenceId: 43,
        controlField: 0x05,
        logMessageInterval: 1,
      }),
    ),
    description: 'protocol.ptp.example.truncatedBody.description',
    expectedValid: false,
  },
];

export const ptpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: ptpParser,
  documentation: {
    summary: 'protocol.ptp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};

/** `CORRECTION_FIELD_SCALE` testlerde beklenen değeri türetmek için dışa
 * verilir — sabiti test dosyasında yeniden yazmak ikinci bir doğruluk kaynağı
 * yaratırdı. */
export { CORRECTION_FIELD_SCALE };
