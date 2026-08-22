/**
 * Syslog (RFC 5424) — taşıyıcıdan bağımsız olay mesajı biçimi.
 * Girdi TEK bir syslog mesajıdır (UDP/514 ya da TCP octet-counting çerçevesi
 * YOK — `snmp.ts`/`ntp.ts` kararının aynısı).
 *
 * Biçim:
 *   `<PRI>VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME SP PROCID SP MSGID
 *    SP STRUCTURED-DATA [SP MSG]`
 *
 * ── PRI'DA BAŞTA SIFIR YASAKTIR ─────────────────────────────────────────────
 * RFC 5424 §6.2.1: PRIVAL "1-3 basamak, başta sıfır OLMADAN" (tek istisna `<0>`
 * kendisidir). `<034>` geçersizdir. Sayıyı `Number()`la okuyup geçmek bunu
 * sessizce kabul eder; ayrıca `Number('')` sıfır verdiği için `<>` de kazara
 * geçerli görünürdü. İkisi de açıkça reddedilir.
 *
 * ── PRI'NIN TAVANI 191'DİR ──────────────────────────────────────────────────
 * Facility 0-23, Severity 0-7 → azami `23 × 8 + 7 = 191`. Üstü tanımsızdır;
 * bölme yine çalışır ama "Facility 31" diye bir şey yoktur.
 *
 * ── RFC 3164 (BSD) MESAJI BU BİÇİM DEĞİLDİR ─────────────────────────────────
 * Eski biçimde VERSION basamağı YOKTUR ve zaman damgası `Mmm dd hh:mm:ss`tir:
 * `<34>Oct 11 22:14:15 host app: mesaj`. RFC 5424 ayrıştırıcısıyla okununca
 * "VERSION=Oct" gibi çıktılar üretir. Spec yalnız 5424'ü adlandırdığı için
 * eski biçim ÇÖZÜLMEZ; tanınır ve uyarıyla bildirilir (`ptp.ts`in PTPv1
 * kararının aynısı).
 *
 * ── STRUCTURED-DATA'DA `]` KAÇIŞLI OLABİLİR ─────────────────────────────────
 * RFC 5424 §6.3.3: PARAM-VALUE içinde `"`, `\` ve `]` ters bölü ile kaçırılır.
 * `[ex@1 note="a\]b"]` tek bir SD-ELEMENT'tir. `indexOf(']')` ile bölmek onu
 * ortadan ikiye keser ve kalanını mesaj sanır — sessiz ve klasik.
 *
 * ── NILVALUE `-` "BOŞ METİN" DEĞİLDİR ───────────────────────────────────────
 * Başlıktaki her alan `-` olabilir ve bu "değer YOK" demektir (§6.2.1). Metin
 * olarak `-` basmak alanı "tire adlı bir host" gibi gösterir.
 *
 * ── MSG BAŞINDAKİ BOM UTF-8 BİLDİRİMİDİR ────────────────────────────────────
 * §6.4: MSG `EF BB BF` ile başlıyorsa gövde UTF-8'dir; başlamıyorsa kodlaması
 * BİLİNMEZ. BOM'u mesajın ilk karakteri sanmak görünmez bir karakter sızdırır.
 *
 * ── SEVERITY DASHBOARD ÇOK-MESAJ İŞİDİR ─────────────────────────────────────
 * Spec `:691` sayım ve "errors/minute" trendi istiyor; ikisi de bir mesaj
 * kümesinin işi (12c'nin DNS Transaction Matching, 12d'nin PTP sequence gap
 * kararının aynısı). Tek mesaj çözücüsü Facility/Severity'yi adlandırır.
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

const PROTOCOL_ID = 'syslog';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Syslog';

/** `<0>1 ` — en kısa geçerli başlangıç. */
const MIN_FRAME_LENGTH = 4;

const PRI_START = '<';
const PRI_END = '>';
const NILVALUE = '-';
const SEVERITY_DIVISOR = 8;
const MAX_PRI = 191;
const MAX_PRI_DIGITS = 3;
const SUPPORTED_VERSION = 1;

/** UTF-8 bayt sırası imi (§6.4). */
const BOM = [0xef, 0xbb, 0xbf] as const;

/** RFC 5424 Tablo 1. */
const FACILITY_NAMES: readonly string[] = [
  'kernel messages',
  'user-level messages',
  'mail system',
  'system daemons',
  'security/authorization messages',
  'messages generated internally by syslogd',
  'line printer subsystem',
  'network news subsystem',
  'UUCP subsystem',
  'clock daemon',
  'security/authorization messages',
  'FTP daemon',
  'NTP subsystem',
  'log audit',
  'log alert',
  'clock daemon',
  'local use 0 (local0)',
  'local use 1 (local1)',
  'local use 2 (local2)',
  'local use 3 (local3)',
  'local use 4 (local4)',
  'local use 5 (local5)',
  'local use 6 (local6)',
  'local use 7 (local7)',
];

/** RFC 5424 Tablo 2 — spec `:691`in "Severity Dashboard" sözcükleri. */
const SEVERITY_NAMES: readonly string[] = [
  'Emergency',
  'Alert',
  'Critical',
  'Error',
  'Warning',
  'Notice',
  'Informational',
  'Debug',
];

const ERROR_FRAME_TOO_SHORT = 'protocol.syslog.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.syslog.error.frameTooLong';
const ERROR_ABORTED = 'protocol.syslog.error.aborted';
const ERROR_PRI_MISSING = 'protocol.syslog.error.priMissing';
const ERROR_PRI_MALFORMED = 'protocol.syslog.error.priMalformed';
const ERROR_HEADER_TRUNCATED = 'protocol.syslog.error.headerTruncated';
const ERROR_STRUCTURED_DATA_UNTERMINATED = 'protocol.syslog.error.structuredDataUnterminated';

const WARN_PRI_OUT_OF_RANGE = 'protocol.syslog.warning.priOutOfRange';
const WARN_LEGACY_BSD_FORMAT = 'protocol.syslog.warning.legacyBsdFormat';
const WARN_UNEXPECTED_VERSION = 'protocol.syslog.warning.unexpectedVersion';
const WARN_NIL_VALUE = 'protocol.syslog.warning.nilValue';
const WARN_TIMESTAMP_NOT_RFC3339 = 'protocol.syslog.warning.timestampNotRfc3339';
const WARN_MSG_WITHOUT_BOM = 'protocol.syslog.warning.msgWithoutBom';
const WARN_SEVERITY_DASHBOARD_NEEDS_STREAM = 'protocol.syslog.warning.severityDashboardNeedsStream';
const WARN_STRUCTURED_DATA_MALFORMED = 'protocol.syslog.warning.structuredDataMalformed';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/**
 * Baytları karakterlere birebir açar (latin1). UTF-8 ÇÖZÜLMEZ: ofsetler BAYT
 * cinsindendir (`ParsedField` sözleşmesi) ve çok baytlı karakterleri tek
 * karaktere indirgemek alan ofsetlerini kaydırırdı. Gösterilecek metin
 * ayrıca `decodeUtf8` ile üretilir.
 */
function toLatin1(data: Uint8Array): string {
  let text = '';
  for (const octet of data) text += String.fromCharCode(octet);
  return text;
}

/** Yalnız MSG gövdesi için: BOM varsa gerçek UTF-8 metni üretilir. */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** RFC 3339 kabası — tam doğrulama değil, "bu alan tarih mi" ayrımı. */
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
/** RFC 3164'ün `Mmm dd hh:mm:ss` damgası — eski biçimi tanımak için. */
const BSD_TIMESTAMP_PATTERN = /^[A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2}/;

interface SyslogParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface Sink {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function pushWarning(sink: Sink, key: string): void {
  sink.warnings.push(toProtocolWarning(key));
}

/**
 * Başlık alanı basar. NILVALUE (`-`) "değer yok" demektir; metin olarak
 * basılmaz, uyarı alanın KENDİ üzerinde kalır (dosya başı).
 */
function pushHeaderField(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  text: string,
  sink: Sink,
): void {
  const field: ParsedField = {
    id,
    name,
    offset,
    length: text.length,
    rawBytes: data.slice(offset, offset + text.length),
    valid: true,
    warnings: [],
  };
  if (text === NILVALUE) {
    // Ne `rawValue` ne `physicalValue` verilir: panel iki sütunu da boş glif
    // basar ve "değer yok" bilgisini uyarı taşır. `-` yazmak alanı "tire adlı
    // bir host" gibi gösterirdi.
    field.warnings = [WARN_NIL_VALUE];
  } else {
    field.rawValue = text;
  }
  sink.fields.push(field);
}

/**
 * STRUCTURED-DATA'yı SD-ELEMENT'lere böler. Kaçış farkındadır: `\]` bir
 * eleman sonu DEĞİLDİR ve tırnak içinde `\"` metnin parçasıdır (dosya başı).
 * Dönen değer her elemanın [başlangıç, bitiş) bayt aralığıdır.
 */
function splitStructuredData(text: string, start: number): { ranges: [number, number][]; end: number; ok: boolean } {
  const ranges: [number, number][] = [];
  let cursor = start;

  while (cursor < text.length && text[cursor] === '[') {
    const elementStart = cursor;
    cursor += 1;
    let inQuotes = false;
    let closed = false;

    while (cursor < text.length) {
      const character = text[cursor];
      if (character === '\\') {
        // Kaçış BİR SONRAKİ karakteri yutar — `\]` eleman sonu değildir.
        cursor += 2;
        continue;
      }
      if (character === '"') inQuotes = !inQuotes;
      else if (character === ']' && !inQuotes) {
        cursor += 1;
        closed = true;
        break;
      }
      cursor += 1;
    }

    if (!closed) return { ranges, end: cursor, ok: false };
    ranges.push([elementStart, cursor]);
  }

  return { ranges, end: cursor, ok: true };
}

/** SD-ELEMENT içindeki `AD-ID` ve `PARAM-NAME="VALUE"` çiftlerini alan basar. */
function pushStructuredElement(
  data: Uint8Array,
  text: string,
  start: number,
  end: number,
  index: number,
  sink: Sink,
): void {
  // `[` sonrası ilk boşluğa (ya da `]`e) kadar SD-ID.
  let cursor = start + 1;
  while (cursor < end && text[cursor] !== ' ' && text[cursor] !== ']') cursor += 1;

  sink.fields.push({
    id: `sd-${index}-id`,
    name: `Structured Data ${index} — SD-ID`,
    offset: start + 1,
    length: cursor - (start + 1),
    rawBytes: data.slice(start + 1, cursor),
    rawValue: text.slice(start + 1, cursor),
    valid: true,
    warnings: [],
  });

  let parameterIndex = 0;
  while (cursor < end) {
    while (cursor < end && text[cursor] === ' ') cursor += 1;
    if (cursor >= end || text[cursor] === ']') break;

    const nameStart = cursor;
    while (cursor < end && text[cursor] !== '=' && text[cursor] !== ']') cursor += 1;
    const parameterName = text.slice(nameStart, cursor);

    if (text[cursor] !== '=' || text[cursor + 1] !== '"') {
      // `NAME="VALUE"` dışında bir şey: ham bırakılır, uydurulmaz.
      pushWarning(sink, WARN_STRUCTURED_DATA_MALFORMED);
      return;
    }
    cursor += 2;

    const valueStart = cursor;
    let value = '';
    while (cursor < end) {
      const character = text[cursor];
      if (character === '\\') {
        // Kaçırılan karakter değere KAÇIŞSIZ girer (`\]` → `]`).
        value += text[cursor + 1] ?? '';
        cursor += 2;
        continue;
      }
      if (character === '"') break;
      value += character ?? '';
      cursor += 1;
    }
    const valueEnd = cursor;
    cursor += 1;

    sink.fields.push({
      id: `sd-${index}-param-${parameterIndex}`,
      name: `Structured Data ${index} — ${parameterName}`,
      offset: valueStart,
      length: valueEnd - valueStart,
      rawBytes: data.slice(valueStart, valueEnd),
      rawValue: value,
      valid: true,
      warnings: [],
    });
    parameterIndex += 1;
  }
}

function parseSyslogFrame(data: Uint8Array, options: SyslogParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
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

  const text = toLatin1(data);

  if (text[0] !== PRI_START) {
    return {
      success: false,
      error: { code: 'start-delimiter-not-found', message: ERROR_PRI_MISSING, offset: 0, length: 1 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const priEnd = text.indexOf(PRI_END);
  const priDigits = priEnd < 0 ? '' : text.slice(1, priEnd);
  const priMalformed =
    priEnd < 0 ||
    priDigits.length === 0 ||
    priDigits.length > MAX_PRI_DIGITS ||
    !/^\d+$/.test(priDigits) ||
    // Başta sıfır yalnız `<0>`da geçerli (dosya başı).
    (priDigits.length > 1 && priDigits.startsWith('0'));

  if (priMalformed) {
    return {
      success: false,
      error: {
        code: 'invalid-hex-input',
        message: ERROR_PRI_MALFORMED,
        offset: 0,
        length: priEnd < 0 ? data.length : priEnd + 1,
        details: { priDigits },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sink: Sink = { fields: [], warnings: [], errors: [] };
  const pri = Number(priDigits);
  const facility = Math.floor(pri / SEVERITY_DIVISOR);
  const severity = pri % SEVERITY_DIVISOR;
  const priValid = pri <= MAX_PRI;

  const priField: ParsedField = {
    id: 'pri',
    name: 'PRI',
    offset: 0,
    length: priEnd + 1,
    rawBytes: data.slice(0, priEnd + 1),
    rawValue: pri,
    valid: priValid,
    warnings: [],
  };
  if (!priValid) {
    priField.warnings = [WARN_PRI_OUT_OF_RANGE];
    pushWarning(sink, WARN_PRI_OUT_OF_RANGE);
  }
  sink.fields.push(priField);

  // Facility ve Severity PRI'nin İÇİNDEDİR — kapsayan bayt aralığı verilir.
  const facilityField: ParsedField = {
    id: 'facility',
    name: 'Facility',
    offset: 0,
    length: priEnd + 1,
    rawBytes: data.slice(0, priEnd + 1),
    rawValue: facility,
    valid: priValid,
    warnings: [],
  };
  const facilityName = FACILITY_NAMES[facility];
  if (facilityName !== undefined) facilityField.physicalValue = facilityName;
  sink.fields.push(facilityField);

  sink.fields.push({
    id: 'severity',
    name: 'Severity',
    offset: 0,
    length: priEnd + 1,
    rawBytes: data.slice(0, priEnd + 1),
    rawValue: severity,
    physicalValue: SEVERITY_NAMES[severity] ?? '',
    valid: true,
    warnings: [],
  });

  // Sayım ve trend bir mesaj KÜMESİNİN işi (dosya başı).
  pushWarning(sink, WARN_SEVERITY_DASHBOARD_NEEDS_STREAM);

  const afterPri = priEnd + 1;
  const rest = text.slice(afterPri);

  // RFC 3164 tanıma: PRI'dan hemen sonra `Mmm dd hh:mm:ss` geliyorsa eski biçim.
  if (BSD_TIMESTAMP_PATTERN.test(rest)) {
    pushWarning(sink, WARN_LEGACY_BSD_FORMAT);
    sink.fields.push({
      id: 'legacy-body',
      name: 'Legacy (RFC 3164) Body',
      offset: afterPri,
      length: data.length - afterPri,
      rawBytes: data.slice(afterPri),
      rawValue: rest,
      // Çözülmüyor: 5424 şeması buraya UYMAZ (dosya başı).
      valid: false,
      warnings: [WARN_LEGACY_BSD_FORMAT],
    });
    return finish(data, sink, options);
  }

  // VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME SP PROCID SP MSGID
  const headerNames: readonly { id: string; name: string }[] = [
    { id: 'version', name: 'Version' },
    { id: 'timestamp', name: 'Timestamp' },
    { id: 'hostname', name: 'Hostname' },
    { id: 'app-name', name: 'App-Name' },
    { id: 'proc-id', name: 'ProcID' },
    { id: 'msg-id', name: 'MsgID' },
  ];

  let cursor = afterPri;
  const tokens: { text: string; offset: number }[] = [];
  for (let index = 0; index < headerNames.length; index += 1) {
    const spaceIndex = text.indexOf(' ', cursor);
    if (spaceIndex < 0) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
        details: { missingField: headerNames[index]?.id ?? '' },
      });
      return finish(data, sink, options);
    }
    tokens.push({ text: text.slice(cursor, spaceIndex), offset: cursor });
    cursor = spaceIndex + 1;
  }

  for (let index = 0; index < headerNames.length; index += 1) {
    const spec = headerNames[index];
    const token = tokens[index];
    if (spec === undefined || token === undefined) continue;

    if (spec.id === 'version') {
      const version = Number(token.text);
      const versionField: ParsedField = {
        id: 'version',
        name: 'Version',
        offset: token.offset,
        length: token.text.length,
        rawBytes: data.slice(token.offset, token.offset + token.text.length),
        rawValue: token.text,
        valid: version === SUPPORTED_VERSION,
        warnings: [],
      };
      if (version !== SUPPORTED_VERSION) {
        versionField.warnings = [WARN_UNEXPECTED_VERSION];
        pushWarning(sink, WARN_UNEXPECTED_VERSION);
      }
      sink.fields.push(versionField);
      continue;
    }

    pushHeaderField(data, spec.id, spec.name, token.offset, token.text, sink);

    if (spec.id === 'timestamp' && token.text !== NILVALUE && !RFC3339_PATTERN.test(token.text)) {
      pushWarning(sink, WARN_TIMESTAMP_NOT_RFC3339);
    }
  }

  // STRUCTURED-DATA: ya `-` ya bir veya daha çok `[SD-ELEMENT]`.
  if (text[cursor] === NILVALUE && (cursor + 1 >= text.length || text[cursor + 1] === ' ')) {
    pushHeaderField(data, 'structured-data', 'Structured Data', cursor, NILVALUE, sink);
    cursor += 1;
  } else if (text[cursor] === '[') {
    const split = splitStructuredData(text, cursor);
    if (!split.ok) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_STRUCTURED_DATA_UNTERMINATED,
        offset: cursor,
        length: data.length - cursor,
      });
      return finish(data, sink, options);
    }
    split.ranges.forEach(([start, end], index) => {
      pushStructuredElement(data, text, start, end, index, sink);
    });
    cursor = split.end;
  } else {
    // Ne NILVALUE ne `[`: alan biçimsiz. Mesajı yine göstermeyi sürdürürüz.
    pushWarning(sink, WARN_STRUCTURED_DATA_MALFORMED);
  }

  if (cursor < text.length && text[cursor] === ' ') cursor += 1;

  if (cursor < data.length) {
    const hasBom =
      byteAt(data, cursor) === BOM[0] && byteAt(data, cursor + 1) === BOM[1] && byteAt(data, cursor + 2) === BOM[2];
    const bodyOffset = hasBom ? cursor + BOM.length : cursor;
    const bodyBytes = data.slice(bodyOffset);

    const messageField: ParsedField = {
      id: 'msg',
      name: 'Message',
      offset: bodyOffset,
      length: bodyBytes.length,
      rawBytes: bodyBytes,
      // BOM varsa UTF-8, yoksa kodlama BİLİNMEZ (dosya başı) — latin1 basılır.
      rawValue: hasBom ? decodeUtf8(bodyBytes) : toLatin1(bodyBytes),
      valid: true,
      warnings: [],
    };
    if (!hasBom) messageField.warnings = [WARN_MSG_WITHOUT_BOM];
    sink.fields.push(messageField);

    if (hasBom) {
      sink.fields.push({
        id: 'msg-bom',
        name: 'UTF-8 BOM',
        offset: cursor,
        length: BOM.length,
        rawBytes: data.slice(cursor, cursor + BOM.length),
        physicalValue: 'UTF-8',
        valid: true,
        warnings: [],
      });
    }
  }

  return finish(data, sink, options);
}

function finish(data: Uint8Array, sink: Sink, options: SyslogParseOptions): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: sink.errors.length === 0,
    errors: sink.errors,
    warnings: sink.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseSyslog(data: Uint8Array): ParseResult {
  return parseSyslogFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): SyslogParseOptions {
  const options: SyslogParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const syslogParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: `<` ile başlayıp üç basamak içinde `>` gelmeli. PRI'nin
   * DEĞERİ yoklanmaz — 191 üstü `parse`de uyarıyla geçer. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH || byteAt(data, 0) !== PRI_START.charCodeAt(0)) return false;
    for (let index = 1; index <= MAX_PRI_DIGITS + 1 && index < data.length; index += 1) {
      if (byteAt(data, index) === PRI_END.charCodeAt(0)) return index > 1;
    }
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSyslogFrame(data, readContextOptions(context));
  },
};

function bytesOf(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'header-only',
    name: 'protocol.syslog.example.headerOnly.name',
    // Spec `:685`in örneği: PRI 34 → Facility 4, Severity 2 (Critical).
    bytes: Uint8Array.from(bytesOf('<34>1 2026-08-08T15:00:00Z device1 app 123 ID47 - Motor fault')),
    description: 'protocol.syslog.example.headerOnly.description',
    expectedValid: true,
  },
  {
    id: 'structured-data',
    name: 'protocol.syslog.example.structuredData.name',
    // Spec `:688`in örneği: `[temperature sensor="1" value="85.2"]`.
    bytes: Uint8Array.from(
      bytesOf('<165>1 2026-08-22T12:00:00.123Z gateway sensord 42 ID9 [temperature sensor="1" value="85.2"] Over limit'),
    ),
    description: 'protocol.syslog.example.structuredData.description',
    expectedValid: true,
  },
  {
    id: 'escaped-bracket',
    name: 'protocol.syslog.example.escapedBracket.name',
    // PARAM-VALUE içinde kaçırılmış `]` — naif bölme burada mesajı keserdi.
    bytes: Uint8Array.from(
      bytesOf('<13>1 2026-08-22T12:00:00Z host app - - [ex@32473 note="a\\]b" q="say \\"hi\\""] tail'),
    ),
    description: 'protocol.syslog.example.escapedBracket.description',
    expectedValid: true,
  },
  {
    id: 'nil-values',
    name: 'protocol.syslog.example.nilValues.name',
    // Başlığın dört alanı NILVALUE — "tire adlı host" diye gösterilmemeli.
    bytes: Uint8Array.from(bytesOf('<0>1 - - - - - - Emergency, no metadata')),
    description: 'protocol.syslog.example.nilValues.description',
    expectedValid: true,
  },
  {
    id: 'utf8-bom',
    name: 'protocol.syslog.example.utf8Bom.name',
    // MSG BOM'la başlıyor: gövde UTF-8 ilan edilmiş (§6.4).
    bytes: Uint8Array.from([
      ...bytesOf('<14>1 2026-08-22T12:00:00Z host app - - '),
      ...BOM,
      ...bytesOf('Sıcaklık aşıldı'),
    ]),
    description: 'protocol.syslog.example.utf8Bom.description',
    expectedValid: true,
  },
  {
    id: 'legacy-bsd',
    name: 'protocol.syslog.example.legacyBsd.name',
    // RFC 3164: VERSION yok, damga `Mmm dd hh:mm:ss`. Çözülmez, tanınır.
    bytes: Uint8Array.from(bytesOf('<34>Oct 11 22:14:15 mymachine su: failed for lonvick')),
    description: 'protocol.syslog.example.legacyBsd.description',
    expectedValid: true,
  },
  {
    id: 'leading-zero-pri',
    name: 'protocol.syslog.example.leadingZeroPri.name',
    // `<034>` — RFC 5424 §6.2.1 başta sıfırı yasaklar. Hata yolu.
    bytes: Uint8Array.from(bytesOf('<034>1 2026-08-22T12:00:00Z host app - - test')),
    description: 'protocol.syslog.example.leadingZeroPri.description',
    expectedValid: false,
  },
];

export const syslogPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: syslogParser,
  documentation: {
    summary: 'protocol.syslog.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
