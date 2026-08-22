/**
 * NTP (RFC 5905, NTPv4) — dört damgalı istemci/sunucu zaman protokolü.
 * Girdi TEK bir NTP mesajıdır (UDP/123 sarmalayıcısı YOK — `arp.ts`/`icmp.ts`
 * kararının aynısı, motorlar zincir kurmaz).
 *
 * ── DÖRT DAMGA MODELİ TEK ÇERÇEVEDEN ÇIKMAZ ─────────────────────────────────
 * Spec (`08-ag-ethernet.md:324-340`) δ = (T4-T1)-(T3-T2) ve θ = [(T2-T1)+(T3-T4)]/2
 * formüllerini istiyor. Telde T1 (Origin), T2 (Receive), T3 (Transmit) VARDIR;
 * **T4 YOKTUR** — T4 istemcinin yanıtı aldığı ANDAKİ KENDİ saatidir, pakete hiç
 * yazılmaz. Dolayısıyla δ ve θ tek çerçeve çözücüsünün üretebileceği şeyler
 * değildir (12a'da ICMP RTT'si, 12c'de DNS Transaction Matching için verilen
 * kararın aynısı: çok-paket işi analyzer'ındır).
 *
 * Tek çerçeveden ÇIKAN şey sunucunun kendi içinde geçirdiği süredir:
 * **T3 - T2**. Bu türetilmiş alan olarak basılır; δ/θ basılmaz, çünkü eksik
 * bir girdiyle hesaplanmış sayı yanlış sayıdır ve kullanıcı onu doğru sanır.
 *
 * `decodeOptions` kanalı da bu boşluğu KAPATMAZ: kanal (`protocol-core/types.ts:294`)
 * "çerçeveden çıkarılamayan ama kullanıcının BİLDİĞİ parametre" içindir
 * (yön, sürüm, kip). T4 kullanıcının bildiği bir ayar değil, yakalama ANINDA
 * ölçülen bir değerdir — elle yazdırmak ölçümü uydurmaktır.
 *
 * ── REFERENCE ID'NİN ANLAMI STRATUM'A BAĞLIDIR ──────────────────────────────
 * Aynı 4 bayt üç ayrı şey demektir (RFC 5905 §7.3):
 *   stratum 0  → "kiss code": 4 ASCII harf (DENY/RATE/RSTR…), İSTEK REDDİ
 *   stratum 1  → referans saatin ASCII kimliği (GPS/PPS/DCF…)
 *   stratum ≥2 → yukarı akış sunucusunun IPv4 adresi
 * Bunu her zaman IPv4 diye basmak stratum 0/1'de anlamsız adresler üretir.
 * IPv6 kurulumlarında stratum ≥2 bile adres DEĞİLDİR (RFC 5905 §7.3: adresin
 * MD5 özetinin ilk 4 baytı) — bu yüzden adres yorumu UYARIYLA verilir.
 *
 * ── STRATUM YORUMU DAR TUTULDU ──────────────────────────────────────────────
 * Spec (`:322`) açıkça uyarıyor: "daha küçük stratum = otomatik olarak daha
 * doğru clock" denmemeli. Alan adlandırılır (Primary / Secondary / Unsynchronized),
 * KALİTE YARGISI ÜRETİLMEZ.
 *
 * ── DRIFT TRENDİ KAPSAM DIŞI ────────────────────────────────────────────────
 * Spec `:345` zaman serisi offset tablosu istiyor; seri, tanımı gereği çok
 * çerçevedir. Katalogdaki "Clock Drift Trend" aracı analyzer'a kalır — DNS'in
 * "TTL / Cache Simulation"ıyla aynı sınır (12c, `ready` yine de verildi).
 */

import {
  NTP_TIMESTAMP_LENGTH,
  ntpDeltaMilliseconds,
  readNtpShortMilliseconds,
  readNtpTimestamp,
  readSignedByte,
  type NtpTimestamp,
} from './ntpTimestamp';
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

const PROTOCOL_ID = 'ntp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'NTP';

/** LI/VN/Mode(1) + Stratum(1) + Poll(1) + Precision(1) + Root Delay(4) +
 * Root Dispersion(4) + Reference ID(4) + dört damga(4 × 8) = 48. */
const HEADER_LENGTH = 48;

const FLAGS_OFFSET = 0;
const STRATUM_OFFSET = 1;
const POLL_OFFSET = 2;
const PRECISION_OFFSET = 3;
const ROOT_DELAY_OFFSET = 4;
const ROOT_DISPERSION_OFFSET = 8;
const REFERENCE_ID_OFFSET = 12;
const REFERENCE_TIMESTAMP_OFFSET = 16;
const ORIGIN_TIMESTAMP_OFFSET = 24;
const RECEIVE_TIMESTAMP_OFFSET = 32;
const TRANSMIT_TIMESTAMP_OFFSET = 40;

const DWORD_LENGTH = 4;

const LEAP_SHIFT = 6;
const LEAP_MASK = 0x03;
const VERSION_SHIFT = 3;
const VERSION_MASK = 0x07;
const MODE_MASK = 0x07;

const VERSION_NTPV4 = 4;

const STRATUM_KISS_O_DEATH = 0;
const STRATUM_PRIMARY = 1;
const STRATUM_SECONDARY_MAX = 15;
const STRATUM_UNSYNCHRONIZED = 16;

const MODE_SERVER = 4;
const MODE_SYMMETRIC_PASSIVE = 2;
const MODE_BROADCAST = 5;

/** Authenticator biçimleri (RFC 5905 §7.5, RFC 8573): yok · yalnız Key ID
 * (crypto-NAK) · Key ID + 128 bit özet · Key ID + 160 bit özet. */
const AUTHENTICATOR_NONE = 0;
const AUTHENTICATOR_CRYPTO_NAK = 4;
const AUTHENTICATOR_MD5 = 20;
const AUTHENTICATOR_SHA1 = 24;
const KEY_IDENTIFIER_LENGTH = 4;

const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;
const HEX_RADIX = 16;

const LEAP_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'No warning'],
  [1, 'Last minute has 61 seconds'],
  [2, 'Last minute has 59 seconds'],
  [3, 'Unsynchronized (alarm)'],
]);

const MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Symmetric active'],
  [2, 'Symmetric passive'],
  [3, 'Client'],
  [4, 'Server'],
  [5, 'Broadcast'],
  [6, 'NTP control message'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.ntp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ntp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ntp.error.aborted';

const WARN_LEAP_ALARM = 'protocol.ntp.warning.leapAlarm';
const WARN_UNKNOWN_MODE = 'protocol.ntp.warning.unknownMode';
const WARN_UNEXPECTED_VERSION = 'protocol.ntp.warning.unexpectedVersion';
const WARN_KISS_O_DEATH = 'protocol.ntp.warning.kissOfDeath';
const WARN_STRATUM_UNSYNCHRONIZED = 'protocol.ntp.warning.stratumUnsynchronized';
const WARN_STRATUM_RESERVED = 'protocol.ntp.warning.stratumReserved';
const WARN_REFERENCE_ID_MAY_NOT_BE_ADDRESS = 'protocol.ntp.warning.referenceIdMayNotBeAddress';
const WARN_TIMESTAMP_ERA1 = 'protocol.ntp.warning.timestampEra1';
const WARN_TIMESTAMP_UNSET = 'protocol.ntp.warning.timestampUnset';
const WARN_UNKNOWN_AUTHENTICATOR = 'protocol.ntp.warning.unknownAuthenticator';
const WARN_SERVER_TIME_NEGATIVE = 'protocol.ntp.warning.serverTimeNegative';
const WARN_FOUR_TIMESTAMP_NEEDS_T4 = 'protocol.ntp.warning.fourTimestampNeedsT4';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

/** Kiss code / referans saat kimliği yalnız BASILABİLİR ASCII ise metne
 * çevrilir; değilse `undefined` döner ve alan ham kalır. */
function readAsciiIdentifier(bytes: Uint8Array): string | undefined {
  let text = '';
  for (const byte of bytes) {
    if (byte === 0) break;
    if (byte < ASCII_PRINTABLE_MIN || byte > ASCII_PRINTABLE_MAX) return undefined;
    text += String.fromCharCode(byte);
  }
  const trimmed = text.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

/** Ondalık basamağı sabitler; `physicalValue` sayı olarak taşınırsa arayüz
 * 0.30000000000000004 gibi kayan nokta gürültüsü basıyor. */
function roundValue(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

interface NtpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface TimestampFieldSpec {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
}

const TIMESTAMP_FIELDS: readonly TimestampFieldSpec[] = [
  { id: 'reference-timestamp', name: 'Reference Timestamp', offset: REFERENCE_TIMESTAMP_OFFSET },
  { id: 'origin-timestamp', name: 'Origin Timestamp (T1)', offset: ORIGIN_TIMESTAMP_OFFSET },
  { id: 'receive-timestamp', name: 'Receive Timestamp (T2)', offset: RECEIVE_TIMESTAMP_OFFSET },
  { id: 'transmit-timestamp', name: 'Transmit Timestamp (T3)', offset: TRANSMIT_TIMESTAMP_OFFSET },
];

function pushTimestampField(
  data: Uint8Array,
  spec: TimestampFieldSpec,
  parsed: NtpTimestamp,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const field: ParsedField = {
    id: spec.id,
    name: spec.name,
    offset: spec.offset,
    length: NTP_TIMESTAMP_LENGTH,
    rawBytes: data.slice(spec.offset, spec.offset + NTP_TIMESTAMP_LENGTH),
    rawValue: parsed.raw,
    valid: true,
    warnings: [],
  };

  if (parsed.unset) {
    // Sıfır damga "1900" değil, "ayarlanmamış"tır (ntpTimestamp.ts dosya başı).
    field.warnings = [WARN_TIMESTAMP_UNSET];
  } else {
    field.physicalValue = parsed.iso ?? '';
    if (parsed.era === 1) {
      // Era kuralı bir VARSAYIM; kanıtı çerçevede yok, kullanıcı görmeli.
      field.warnings = [WARN_TIMESTAMP_ERA1];
      warnings.push(toProtocolWarning(WARN_TIMESTAMP_ERA1));
    }
  }

  fields.push(field);
}

function parseNtpFrame(data: Uint8Array, options: NtpParseOptions): ParseResult {
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

  // ── Byte 0: üç bit alanı, hepsi aynı baytı kapsar (ParsedField sözleşmesi:
  // bit ayrıntısı alan ADINDA taşınır, offset kapsayan baytı gösterir).
  const flagsByte = byteAt(data, FLAGS_OFFSET);
  const flagsBytes = data.slice(FLAGS_OFFSET, FLAGS_OFFSET + 1);

  const leapIndicator = (flagsByte >>> LEAP_SHIFT) & LEAP_MASK;
  const leapField: ParsedField = {
    id: 'leap-indicator',
    name: 'Leap Indicator',
    offset: FLAGS_OFFSET,
    length: 1,
    rawBytes: flagsBytes,
    rawValue: leapIndicator,
    physicalValue: LEAP_NAMES.get(leapIndicator) ?? '',
    valid: true,
    warnings: [],
  };
  if (leapIndicator === LEAP_MASK) {
    leapField.warnings = [WARN_LEAP_ALARM];
    warnings.push(toProtocolWarning(WARN_LEAP_ALARM));
  }
  fields.push(leapField);

  const version = (flagsByte >>> VERSION_SHIFT) & VERSION_MASK;
  const versionField: ParsedField = {
    id: 'version',
    name: 'Version Number',
    offset: FLAGS_OFFSET,
    length: 1,
    rawBytes: flagsBytes,
    rawValue: version,
    valid: true,
    warnings: [],
  };
  if (version !== VERSION_NTPV4) {
    // v3 (RFC 1305) başlık düzeni v4 ile AYNIDIR; çözüme devam edilir, yalnız
    // kullanıcı bu motorun v4'e göre adlandırdığını bilsin diye uyarılır.
    versionField.warnings = [WARN_UNEXPECTED_VERSION];
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_VERSION));
  }
  fields.push(versionField);

  const mode = flagsByte & MODE_MASK;
  const modeName = MODE_NAMES.get(mode);
  const modeField: ParsedField = {
    id: 'mode',
    name: 'Mode',
    offset: FLAGS_OFFSET,
    length: 1,
    rawBytes: flagsBytes,
    rawValue: mode,
    valid: modeName !== undefined,
    warnings: [],
  };
  if (modeName !== undefined) modeField.physicalValue = modeName;
  else {
    // 0 = reserved, 7 = private/implementation-specific — ikisi de adlandırılamaz.
    modeField.warnings = [WARN_UNKNOWN_MODE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_MODE));
  }
  fields.push(modeField);

  // ── Stratum: adlandırılır, kalite yargısı ÜRETİLMEZ (dosya başı).
  const stratum = byteAt(data, STRATUM_OFFSET);
  const stratumField: ParsedField = {
    id: 'stratum',
    name: 'Stratum',
    offset: STRATUM_OFFSET,
    length: 1,
    rawBytes: data.slice(STRATUM_OFFSET, STRATUM_OFFSET + 1),
    rawValue: stratum,
    valid: true,
    warnings: [],
  };
  if (stratum === STRATUM_KISS_O_DEATH) {
    stratumField.physicalValue = 'Unspecified / Kiss-o’-Death';
    stratumField.warnings = [WARN_KISS_O_DEATH];
    warnings.push(toProtocolWarning(WARN_KISS_O_DEATH));
  } else if (stratum === STRATUM_PRIMARY) {
    stratumField.physicalValue = 'Primary reference';
  } else if (stratum <= STRATUM_SECONDARY_MAX) {
    stratumField.physicalValue = 'Secondary reference';
  } else if (stratum === STRATUM_UNSYNCHRONIZED) {
    stratumField.physicalValue = 'Unsynchronized';
    stratumField.warnings = [WARN_STRATUM_UNSYNCHRONIZED];
    warnings.push(toProtocolWarning(WARN_STRATUM_UNSYNCHRONIZED));
  } else {
    stratumField.valid = false;
    stratumField.warnings = [WARN_STRATUM_RESERVED];
    warnings.push(toProtocolWarning(WARN_STRATUM_RESERVED));
  }
  fields.push(stratumField);

  // ── Poll ve Precision: İŞARETLİ log2 saniye (ntpTimestamp.ts).
  const poll = readSignedByte(data, POLL_OFFSET);
  fields.push({
    id: 'poll',
    name: 'Poll Interval',
    offset: POLL_OFFSET,
    length: 1,
    rawBytes: data.slice(POLL_OFFSET, POLL_OFFSET + 1),
    rawValue: poll,
    physicalValue: roundValue(2 ** poll),
    unit: 's',
    valid: true,
    warnings: [],
  });

  const precision = readSignedByte(data, PRECISION_OFFSET);
  fields.push({
    id: 'precision',
    name: 'Precision',
    offset: PRECISION_OFFSET,
    length: 1,
    rawBytes: data.slice(PRECISION_OFFSET, PRECISION_OFFSET + 1),
    rawValue: precision,
    physicalValue: `2^${precision} s`,
    valid: true,
    warnings: [],
  });

  // ── Root Delay / Root Dispersion: NTP Short Format (16.16), tam sayı DEĞİL.
  fields.push({
    id: 'root-delay',
    name: 'Root Delay',
    offset: ROOT_DELAY_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: data.slice(ROOT_DELAY_OFFSET, ROOT_DELAY_OFFSET + DWORD_LENGTH),
    physicalValue: roundValue(readNtpShortMilliseconds(data, ROOT_DELAY_OFFSET)),
    unit: 'ms',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'root-dispersion',
    name: 'Root Dispersion',
    offset: ROOT_DISPERSION_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: data.slice(ROOT_DISPERSION_OFFSET, ROOT_DISPERSION_OFFSET + DWORD_LENGTH),
    physicalValue: roundValue(readNtpShortMilliseconds(data, ROOT_DISPERSION_OFFSET)),
    unit: 'ms',
    valid: true,
    warnings: [],
  });

  // ── Reference ID: anlamı stratum'a bağlı (dosya başı).
  const referenceIdBytes = data.slice(REFERENCE_ID_OFFSET, REFERENCE_ID_OFFSET + DWORD_LENGTH);
  const referenceIdField: ParsedField = {
    id: 'reference-id',
    name: 'Reference ID',
    offset: REFERENCE_ID_OFFSET,
    length: DWORD_LENGTH,
    rawBytes: referenceIdBytes,
    rawValue: `0x${formatHex(referenceIdBytes)}`,
    valid: true,
    warnings: [],
  };
  if (stratum <= STRATUM_PRIMARY) {
    const identifier = readAsciiIdentifier(referenceIdBytes);
    if (identifier !== undefined) referenceIdField.physicalValue = identifier;
  } else {
    referenceIdField.physicalValue = formatIpv4Address(referenceIdBytes);
    referenceIdField.warnings = [WARN_REFERENCE_ID_MAY_NOT_BE_ADDRESS];
    warnings.push(toProtocolWarning(WARN_REFERENCE_ID_MAY_NOT_BE_ADDRESS));
  }
  fields.push(referenceIdField);

  // ── Dört damga.
  const parsedTimestamps = new Map<string, NtpTimestamp>();
  for (const spec of TIMESTAMP_FIELDS) {
    const parsed = readNtpTimestamp(data, spec.offset);
    parsedTimestamps.set(spec.id, parsed);
    pushTimestampField(data, spec, parsed, fields, warnings);
  }

  // ── Türetilmiş: T3 - T2. Tek çerçeveden ÇIKAN tek zaman farkı (dosya başı).
  const receive = parsedTimestamps.get('receive-timestamp');
  const transmit = parsedTimestamps.get('transmit-timestamp');
  const isResponse = mode === MODE_SERVER || mode === MODE_SYMMETRIC_PASSIVE || mode === MODE_BROADCAST;
  if (isResponse && receive !== undefined && transmit !== undefined) {
    const serverTimeMs = ntpDeltaMilliseconds(receive, transmit);
    if (serverTimeMs !== undefined) {
      const serverTimeField: ParsedField = {
        id: 'server-processing-time',
        name: 'Server Processing Time (T3 − T2)',
        offset: RECEIVE_TIMESTAMP_OFFSET,
        length: NTP_TIMESTAMP_LENGTH * 2,
        rawBytes: data.slice(RECEIVE_TIMESTAMP_OFFSET, TRANSMIT_TIMESTAMP_OFFSET + NTP_TIMESTAMP_LENGTH),
        physicalValue: roundValue(serverTimeMs),
        unit: 'ms',
        valid: serverTimeMs >= 0,
        warnings: [],
      };
      if (serverTimeMs < 0) {
        // T3 < T2: sunucu saati geri gitmiş ya da bu bir yanıt değil.
        serverTimeField.warnings = [WARN_SERVER_TIME_NEGATIVE];
        warnings.push(toProtocolWarning(WARN_SERVER_TIME_NEGATIVE));
      }
      fields.push(serverTimeField);
    }
    // δ/θ burada BASILMAZ; T4 telde yok (dosya başı). Kullanıcı formülü
    // katalogda gördüğü için eksikliğin GEREKÇESİ uyarı olarak veriliyor.
    warnings.push(toProtocolWarning(WARN_FOUR_TIMESTAMP_NEEDS_T4));
  }

  // ── Authenticator (opsiyonel): Key ID + özet. Uzunluk kümesi dar tutuldu.
  const trailingLength = data.length - HEADER_LENGTH;
  if (trailingLength > AUTHENTICATOR_NONE) {
    const known =
      trailingLength === AUTHENTICATOR_CRYPTO_NAK ||
      trailingLength === AUTHENTICATOR_MD5 ||
      trailingLength === AUTHENTICATOR_SHA1;

    const keyIdLength = Math.min(KEY_IDENTIFIER_LENGTH, trailingLength);
    const keyIdBytes = data.slice(HEADER_LENGTH, HEADER_LENGTH + keyIdLength);
    fields.push({
      id: 'key-identifier',
      name: 'Key Identifier',
      offset: HEADER_LENGTH,
      length: keyIdLength,
      rawBytes: keyIdBytes,
      rawValue: `0x${formatHex(keyIdBytes)}`,
      valid: true,
      warnings: [],
    });

    const digestOffset = HEADER_LENGTH + keyIdLength;
    const digestBytes = data.slice(digestOffset);
    if (digestBytes.length > 0) {
      const digestField: ParsedField = {
        id: 'message-digest',
        name: 'Message Digest',
        offset: digestOffset,
        length: digestBytes.length,
        rawBytes: digestBytes,
        // Özet DOĞRULANMAZ: paylaşılan anahtar bu araçta yok, "geçerli" demek
        // yalan olurdu (icmpv6'nın pseudo-header kararının aynı cinsi).
        physicalValue: trailingLength === AUTHENTICATOR_MD5 ? 'MD5 (128-bit)' : trailingLength === AUTHENTICATOR_SHA1 ? 'SHA-1 (160-bit)' : '',
        unit: 'B',
        valid: true,
        warnings: [],
      };
      fields.push(digestField);
    }

    if (!known) {
      warnings.push(toProtocolWarning(WARN_UNKNOWN_AUTHENTICATOR));
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

export function parseNtp(data: Uint8Array): ParseResult {
  return parseNtpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): NtpParseOptions {
  const options: NtpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ntpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: NTP'nin sabit uzunluğu + tanınan sürüm kümesi. Mode ve
   * stratum burada YOKLANMAZ — ikisi de `parse`de uyarıyla geçen değerler
   * alabilir, ön elemede reddetmek kısmi çözümü engellerdi. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    const version = (byteAt(data, FLAGS_OFFSET) >>> VERSION_SHIFT) & VERSION_MASK;
    return version >= 1 && version <= VERSION_NTPV4;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseNtpFrame(data, readContextOptions(context));
  },
};

/** Örnek üreticisi: 48 baytlık başlığı alan alan kurar, testler ve UI aynı
 * baytları görsün diye (spec §42/§43 tek kaynak kuralı). */
function ntpFrame(input: {
  leap: number;
  version: number;
  mode: number;
  stratum: number;
  poll: number;
  precision: number;
  rootDelay: number;
  rootDispersion: number;
  referenceId: readonly number[];
  referenceTimestamp: readonly [number, number];
  originTimestamp: readonly [number, number];
  receiveTimestamp: readonly [number, number];
  transmitTimestamp: readonly [number, number];
}): number[] {
  const dword = (value: number): number[] => [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
  const stamp = (pair: readonly [number, number]): number[] => [...dword(pair[0]), ...dword(pair[1])];

  return [
    ((input.leap & LEAP_MASK) << LEAP_SHIFT) | ((input.version & VERSION_MASK) << VERSION_SHIFT) | (input.mode & MODE_MASK),
    input.stratum,
    input.poll & 0xff,
    input.precision & 0xff,
    ...dword(input.rootDelay),
    ...dword(input.rootDispersion),
    ...input.referenceId,
    ...stamp(input.referenceTimestamp),
    ...stamp(input.originTimestamp),
    ...stamp(input.receiveTimestamp),
    ...stamp(input.transmitTimestamp),
  ];
}

/** 2026-08-22T12:00:00Z'nin NTP era-0 saniyesi (Unix 1 787 400 000 + 2 208 988 800). */
const EXAMPLE_SECONDS = 3_996_388_800;
const HALF_SECOND_FRACTION = 0x80000000;
/** 16.16 biçiminde 11.0 ms — `0.011 * 65536 ≈ 721`. */
const EXAMPLE_ROOT_DELAY = 721;
const EXAMPLE_ROOT_DISPERSION = 190;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'client-request',
    name: 'protocol.ntp.example.clientRequest.name',
    // İstemci isteği: Origin/Receive damgaları SIFIR — "ayarlanmamış" yolu.
    bytes: Uint8Array.from(
      ntpFrame({
        leap: 0,
        version: 4,
        mode: 3,
        stratum: 0,
        poll: 6,
        precision: -20,
        rootDelay: 0,
        rootDispersion: 0,
        referenceId: [0x00, 0x00, 0x00, 0x00],
        referenceTimestamp: [0, 0],
        originTimestamp: [0, 0],
        receiveTimestamp: [0, 0],
        transmitTimestamp: [EXAMPLE_SECONDS, HALF_SECOND_FRACTION],
      }),
    ),
    description: 'protocol.ntp.example.clientRequest.description',
    expectedValid: true,
  },
  {
    id: 'server-response',
    name: 'protocol.ntp.example.serverResponse.name',
    // Sunucu yanıtı, stratum 2: Reference ID yukarı akış IPv4 adresi.
    // T3 - T2 = 2 ms (kesir farkı 2^32 * 0.002 ≈ 8 589 935).
    bytes: Uint8Array.from(
      ntpFrame({
        leap: 0,
        version: 4,
        mode: 4,
        stratum: 2,
        poll: 6,
        precision: -23,
        rootDelay: EXAMPLE_ROOT_DELAY,
        rootDispersion: EXAMPLE_ROOT_DISPERSION,
        referenceId: [192, 168, 1, 1],
        referenceTimestamp: [EXAMPLE_SECONDS - 64, 0],
        originTimestamp: [EXAMPLE_SECONDS, HALF_SECOND_FRACTION],
        receiveTimestamp: [EXAMPLE_SECONDS, HALF_SECOND_FRACTION + 42_949_673],
        transmitTimestamp: [EXAMPLE_SECONDS, HALF_SECOND_FRACTION + 51_539_608],
      }),
    ),
    description: 'protocol.ntp.example.serverResponse.description',
    expectedValid: true,
  },
  {
    id: 'stratum-1-gps',
    name: 'protocol.ntp.example.stratum1Gps.name',
    // Stratum 1: Reference ID ASCII referans saat kimliği ("GPS"), adres DEĞİL.
    bytes: Uint8Array.from(
      ntpFrame({
        leap: 0,
        version: 4,
        mode: 4,
        stratum: 1,
        poll: 4,
        precision: -29,
        rootDelay: 0,
        rootDispersion: 12,
        referenceId: [0x47, 0x50, 0x53, 0x00],
        referenceTimestamp: [EXAMPLE_SECONDS - 4, 0],
        originTimestamp: [EXAMPLE_SECONDS, 0],
        receiveTimestamp: [EXAMPLE_SECONDS, 4_294_967],
        transmitTimestamp: [EXAMPLE_SECONDS, 8_589_934],
      }),
    ),
    description: 'protocol.ntp.example.stratum1Gps.description',
    expectedValid: true,
  },
  {
    id: 'kiss-of-death',
    name: 'protocol.ntp.example.kissOfDeath.name',
    // Stratum 0 + "RATE" kiss code: sunucu istemciyi yavaşlamaya zorluyor.
    bytes: Uint8Array.from(
      ntpFrame({
        leap: 3,
        version: 4,
        mode: 4,
        stratum: 0,
        poll: 10,
        precision: -20,
        rootDelay: 0,
        rootDispersion: 0,
        referenceId: [0x52, 0x41, 0x54, 0x45],
        referenceTimestamp: [0, 0],
        originTimestamp: [EXAMPLE_SECONDS, 0],
        receiveTimestamp: [EXAMPLE_SECONDS, 0],
        transmitTimestamp: [EXAMPLE_SECONDS, 0],
      }),
    ),
    description: 'protocol.ntp.example.kissOfDeath.description',
    expectedValid: true,
  },
  {
    id: 'truncated',
    name: 'protocol.ntp.example.truncated.name',
    // 48 baytın altı: hata yolu (arp.ts'in "hata yolu da örnektir" deseni).
    bytes: Uint8Array.from([0x23, 0x02, 0x06, 0xe9, 0x00, 0x00, 0x02, 0xd1]),
    description: 'protocol.ntp.example.truncated.description',
    expectedValid: false,
  },
];

export const ntpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: ntpParser,
  documentation: {
    summary: 'protocol.ntp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
