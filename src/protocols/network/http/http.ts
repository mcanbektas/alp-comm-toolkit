/**
 * HTTP/1.1 (RFC 9110 semantik · RFC 9112 sözdizimi) — metin çerçeveli
 * istek/yanıt. Girdi TEK bir HTTP mesajıdır (TCP akışı YOK — `snmp.ts`/`ntp.ts`
 * kararının aynısı; boru hattı ve bağlantı yeniden kullanımı analyzer işidir).
 *
 * HTTP/2 ve HTTP/3'ün ikili çerçevelemesi KAPSAM DIŞIDIR (spec `:379`:
 * "ayrı ileri modül"). `HTTP/2` yazan bir başlangıç satırı tanınır ve uyarılır.
 *
 * ── GÖVDE ÇERÇEVELEME: BU DOSYANIN ASIL İŞİ ─────────────────────────────────
 * RFC 9112 §6.3 bir sıra tanımlar ve sırayı bozmak sessizce yanlış gövde
 * uzunluğu verir:
 *   1. Yanıt 1xx / 204 / 304 ise gövde YOKTUR — `Content-Length` yazsa bile.
 *   2. İstek HEAD idiyse yanıtın gövdesi YOKTUR; `Content-Length` yalnız
 *      "olsaydı şu kadar olurdu" bilgisidir. **Bu, YANITTAN ÇIKARILAMAZ** —
 *      dalga 11'in `decodeOptions` kanalı tam da bunun için var (aşağıda).
 *   3. `Transfer-Encoding` varsa çerçeveleme ONDAN gelir, `Content-Length`tan
 *      DEĞİL.
 *   4. Yoksa `Content-Length`.
 *   5. O da yoksa: istekte gövde yok, yanıtta gövde bağlantı kapanana kadar.
 *
 * ── İKİSİ BİRDEN VARSA BU BİR GÜVENLİK BULGUSUDUR ───────────────────────────
 * `Content-Length` ve `Transfer-Encoding` aynı mesajda ise RFC 9112 §6.1 alıcının
 * mesajı REDDETMESİNİ ister: ara sunucular ikisini farklı önceliklendirdiğinde
 * tek TCP akışı iki farklı mesaj dizisi gibi okunur (request smuggling). Bir
 * görüntüleyici bunu "iki başlık" diye sıradan göstermemelidir — çerçeve hatası
 * basılır. Aynısı çelişen ÇOKLU `Content-Length` için de geçerlidir.
 *
 * ── BAŞLIK ADIYLA `:` ARASINDA BOŞLUK OLAMAZ ────────────────────────────────
 * RFC 9112 §5.1: `Foo : bar` reddedilmelidir; kabul eden aracılar smuggling'in
 * ikinci yaygın vektörüdür. Normal bir başlıkmış gibi göstermek saldırıyı
 * gizlemek olur, bu yüzden çerçeve hatası basılır.
 *
 * ── CHUNK BOYUTU ONALTILIKTIR ───────────────────────────────────────────────
 * `4\r\nWiki\r\n` — buradaki `4` ONALTILIKTIR (RFC 9112 §7.1). Ondalık okumak
 * `10`u 16 yerine 10 sayar ve 10'dan büyük her chunk'ta gövdeyi kaydırır;
 * küçük örneklerde doğru çalıştığı için geç fark edilir. Ayrıca boyutun
 * ardından `;` ile chunk-ext gelebilir ve YOK SAYILMALIDIR (ama okunmalıdır).
 *
 * ── obs-fold ARTIK GEÇERLİ DEĞİL ────────────────────────────────────────────
 * Boşlukla başlayan devam satırı (RFC 9112 §5.2) kullanımdan kaldırıldı;
 * tanınır ve uyarılır, birleştirilmez.
 *
 * ── TRANSACTION MATCHING / TIMING ÇOK-MESAJ İŞİDİR ──────────────────────────
 * Spec `:396` aynı TCP bağlantısındaki istek/yanıt eşleştirmesini istiyor;
 * 12c'deki DNS, 12d'deki PTP, 12e'deki syslog kararlarının aynısı.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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

const PROTOCOL_ID = 'http';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'HTTP';

/** `GET / HTTP/1.1\r\n\r\n` — en kısa anlamlı mesajın altı. */
const MIN_FRAME_LENGTH = 16;

const CRLF = '\r\n';
const HEADER_TERMINATOR = '\r\n\r\n';
const HEX_RADIX = 16;
const MAX_HEADERS = 256;
/** Bozuk chunk boyutu sonsuz döngü üretmesin (spec §41). */
const MAX_CHUNKS = 512;

/** Spec `:387`in "en az" listesi; kayıtlı ek metotlar tabloyu genişletir. */
const METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'CONNECT',
  'TRACE',
  'PATCH',
]);

const STATUS_REASONS: ReadonlyMap<number, string> = new Map([
  [100, 'Continue'],
  [101, 'Switching Protocols'],
  [200, 'OK'],
  [201, 'Created'],
  [204, 'No Content'],
  [206, 'Partial Content'],
  [301, 'Moved Permanently'],
  [302, 'Found'],
  [304, 'Not Modified'],
  [400, 'Bad Request'],
  [401, 'Unauthorized'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [408, 'Request Timeout'],
  [409, 'Conflict'],
  [413, 'Content Too Large'],
  [415, 'Unsupported Media Type'],
  [429, 'Too Many Requests'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
  [504, 'Gateway Timeout'],
]);

const OPTION_REQUEST_METHOD = 'requestMethod';
const REQUEST_METHOD_UNKNOWN = 'unknown';
const REQUEST_METHOD_HEAD = 'HEAD';

/**
 * Dalga 11'de açılan kanal (`protocol-core/types.ts:294`). Brief bu kaydı
 * "gövde çerçeveleme kipi sorulmalı" diye işaretlemişti; **kip aslında
 * yanıtın KENDİ başlıklarından çıkar** (`Transfer-Encoding`/`Content-Length`).
 * Çerçeveden ÇIKARILAMAYAN tek şey isteğin HEAD olup olmadığıdır: HEAD yanıtı
 * `Content-Length: 1234` taşır ama gövde TAŞIMAZ (RFC 9110 §9.3.2). Kanal bu
 * tek soruya indirgendi — kullanıcının gerçekten BİLDİĞİ bir bağlam.
 */
const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_REQUEST_METHOD,
    label: 'protocol.http.option.requestMethod',
    kind: 'select',
    defaultValue: REQUEST_METHOD_UNKNOWN,
    description: 'protocol.http.option.requestMethod.description',
    choices: [
      { value: REQUEST_METHOD_UNKNOWN, label: 'protocol.http.option.requestMethod.unknown' },
      { value: REQUEST_METHOD_HEAD, label: 'protocol.http.option.requestMethod.head' },
    ],
  },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.http.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.http.error.frameTooLong';
const ERROR_ABORTED = 'protocol.http.error.aborted';
const ERROR_HEADERS_UNTERMINATED = 'protocol.http.error.headersUnterminated';
const ERROR_START_LINE_MALFORMED = 'protocol.http.error.startLineMalformed';
const ERROR_SMUGGLING_CONFLICT = 'protocol.http.error.smugglingConflict';
const ERROR_CONTENT_LENGTH_CONFLICT = 'protocol.http.error.contentLengthConflict';
const ERROR_CONTENT_LENGTH_MALFORMED = 'protocol.http.error.contentLengthMalformed';
const ERROR_HEADER_NAME_WHITESPACE = 'protocol.http.error.headerNameWhitespace';
const ERROR_BODY_TRUNCATED = 'protocol.http.error.bodyTruncated';
const ERROR_CHUNK_SIZE_MALFORMED = 'protocol.http.error.chunkSizeMalformed';
const ERROR_CHUNK_TRUNCATED = 'protocol.http.error.chunkTruncated';

const WARN_UNKNOWN_METHOD = 'protocol.http.warning.unknownMethod';
const WARN_UNKNOWN_STATUS = 'protocol.http.warning.unknownStatus';
const WARN_REASON_MISMATCH = 'protocol.http.warning.reasonMismatch';
const WARN_BINARY_FRAMING_VERSION = 'protocol.http.warning.binaryFramingVersion';
const WARN_UNEXPECTED_VERSION = 'protocol.http.warning.unexpectedVersion';
const WARN_OBS_FOLD = 'protocol.http.warning.obsFold';
const WARN_BARE_LF = 'protocol.http.warning.bareLf';
const WARN_BODY_LONGER_THAN_DECLARED = 'protocol.http.warning.bodyLongerThanDeclared';
const WARN_BODY_UNTIL_CLOSE = 'protocol.http.warning.bodyUntilClose';
const WARN_BODY_FORBIDDEN_BUT_PRESENT = 'protocol.http.warning.bodyForbiddenButPresent';
const WARN_HEAD_RESPONSE_ASSUMED = 'protocol.http.warning.headResponseAssumed';
const WARN_TRANSFER_ENCODING_NOT_CHUNKED = 'protocol.http.warning.transferEncodingNotChunked';
const WARN_CHUNK_EXTENSION_IGNORED = 'protocol.http.warning.chunkExtensionIgnored';
const WARN_TRAILER_PRESENT = 'protocol.http.warning.trailerPresent';
const WARN_HEADER_LIMIT = 'protocol.http.warning.headerLimit';
const WARN_TRANSACTION_MATCHING_NEEDS_STREAM = 'protocol.http.warning.transactionMatchingNeedsStream';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * Baytları karakterlere birebir açar (latin1). UTF-8 ÇÖZÜLMEZ: `ParsedField`
 * ofsetleri BAYT cinsindendir ve çok baytlı karakterleri tek karaktere
 * indirgemek bütün ofsetleri kaydırırdı (`syslog.ts`teki aynı karar).
 */
function toLatin1(data: Uint8Array): string {
  let text = '';
  for (const octet of data) text += String.fromCharCode(octet);
  return text;
}

interface HttpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

interface Sink {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function pushWarning(sink: Sink, key: string): void {
  sink.warnings.push(toProtocolWarning(key));
}

function pushTextField(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  text: string,
  sink: Sink,
): ParsedField {
  const field: ParsedField = {
    id,
    name,
    offset,
    length: text.length,
    rawBytes: data.slice(offset, offset + text.length),
    rawValue: text,
    valid: true,
    warnings: [],
  };
  sink.fields.push(field);
  return field;
}

interface HeaderEntry {
  readonly name: string;
  readonly lowerName: string;
  readonly value: string;
  readonly valueOffset: number;
}

/** `Transfer-Encoding` / `Content-Length` kararının sonucu. */
type BodyFraming = 'none' | 'content-length' | 'chunked' | 'until-close';

const FRAMING_LABELS: Readonly<Record<BodyFraming, string>> = {
  none: 'No body',
  'content-length': 'Content-Length',
  chunked: 'Transfer-Encoding: chunked',
  'until-close': 'Until connection close',
};

function readRequestMethodOption(options: Record<string, unknown> | undefined): string {
  const requested = options?.[OPTION_REQUEST_METHOD];
  return typeof requested === 'string' ? requested : REQUEST_METHOD_UNKNOWN;
}

/** İstek satırı: `METHOD SP request-target SP HTTP-version`. */
function parseRequestLine(data: Uint8Array, line: string, sink: Sink): boolean {
  const firstSpace = line.indexOf(' ');
  const lastSpace = line.lastIndexOf(' ');
  if (firstSpace <= 0 || lastSpace <= firstSpace) return false;

  const method = line.slice(0, firstSpace);
  const target = line.slice(firstSpace + 1, lastSpace);
  const version = line.slice(lastSpace + 1);

  const methodField = pushTextField(data, 'method', 'Method', 0, method, sink);
  if (!METHODS.has(method)) {
    // Kayıtlı ek metotlar var (spec `:387`); tanınmayan değer hata DEĞİL.
    methodField.warnings = [WARN_UNKNOWN_METHOD];
    pushWarning(sink, WARN_UNKNOWN_METHOD);
  }

  pushTextField(data, 'request-target', 'Request Target', firstSpace + 1, target, sink);
  pushVersionField(data, lastSpace + 1, version, sink);
  return true;
}

/** Durum satırı: `HTTP-version SP status-code SP [reason-phrase]`. */
function parseStatusLine(data: Uint8Array, line: string, sink: Sink): number | undefined {
  const firstSpace = line.indexOf(' ');
  if (firstSpace <= 0) return undefined;

  pushVersionField(data, 0, line.slice(0, firstSpace), sink);

  const afterVersion = firstSpace + 1;
  const secondSpace = line.indexOf(' ', afterVersion);
  const codeText = secondSpace < 0 ? line.slice(afterVersion) : line.slice(afterVersion, secondSpace);
  if (!/^\d{3}$/.test(codeText)) return undefined;

  const statusCode = Number(codeText);
  const knownReason = STATUS_REASONS.get(statusCode);
  const statusField: ParsedField = {
    id: 'status-code',
    name: 'Status Code',
    offset: afterVersion,
    length: codeText.length,
    rawBytes: data.slice(afterVersion, afterVersion + codeText.length),
    rawValue: statusCode,
    valid: statusCode >= 100 && statusCode < 600,
    warnings: [],
  };
  if (knownReason !== undefined) statusField.physicalValue = knownReason;
  else {
    statusField.warnings = [WARN_UNKNOWN_STATUS];
    pushWarning(sink, WARN_UNKNOWN_STATUS);
  }
  sink.fields.push(statusField);

  if (secondSpace >= 0) {
    const reason = line.slice(secondSpace + 1);
    const reasonField = pushTextField(data, 'reason-phrase', 'Reason Phrase', secondSpace + 1, reason, sink);
    if (knownReason !== undefined && reason.length > 0 && reason !== knownReason) {
      // Reason phrase İSTEĞE BAĞLIDIR ve anlam taşımaz (RFC 9112 §4);
      // yine de kayıtlı metinden sapması not edilir.
      reasonField.warnings = [WARN_REASON_MISMATCH];
      pushWarning(sink, WARN_REASON_MISMATCH);
    }
  }

  return statusCode;
}

function pushVersionField(data: Uint8Array, offset: number, version: string, sink: Sink): void {
  const field = pushTextField(data, 'http-version', 'HTTP Version', offset, version, sink);
  if (version === 'HTTP/1.1' || version === 'HTTP/1.0') return;

  if (version.startsWith('HTTP/2') || version.startsWith('HTTP/3')) {
    // İkili çerçeveleme bu motorun işi değil (dosya başı).
    field.valid = false;
    field.warnings = [WARN_BINARY_FRAMING_VERSION];
    pushWarning(sink, WARN_BINARY_FRAMING_VERSION);
    return;
  }

  field.valid = false;
  field.warnings = [WARN_UNEXPECTED_VERSION];
  pushWarning(sink, WARN_UNEXPECTED_VERSION);
}

/** Başlık bölümünü satır satır çözer; `name: value` çiftlerini döner. */
function parseHeaders(
  data: Uint8Array,
  text: string,
  startOffset: number,
  headerSectionEnd: number,
  sink: Sink,
): HeaderEntry[] {
  const entries: HeaderEntry[] = [];
  let cursor = startOffset;
  let index = 0;

  while (cursor < headerSectionEnd) {
    if (index >= MAX_HEADERS) {
      pushWarning(sink, WARN_HEADER_LIMIT);
      return entries;
    }

    let lineEnd = text.indexOf(CRLF, cursor);
    if (lineEnd < 0 || lineEnd > headerSectionEnd) lineEnd = headerSectionEnd;
    const line = text.slice(cursor, lineEnd);
    if (line.length === 0) break;

    if (line.startsWith(' ') || line.startsWith('\t')) {
      // obs-fold: tanınır, BİRLEŞTİRİLMEZ (dosya başı).
      pushWarning(sink, WARN_OBS_FOLD);
      cursor = lineEnd + CRLF.length;
      continue;
    }

    const colon = line.indexOf(':');
    if (colon <= 0) {
      cursor = lineEnd + CRLF.length;
      index += 1;
      continue;
    }

    const name = line.slice(0, colon);
    if (/[ \t]$/.test(name)) {
      // RFC 9112 §5.1: ad ile `:` arasında boşluk smuggling vektörüdür.
      sink.errors.push({
        code: 'value-out-of-range',
        message: ERROR_HEADER_NAME_WHITESPACE,
        offset: cursor,
        length: name.length,
        details: { headerName: name },
      });
    }

    // Değerin başındaki/sonundaki OWS anlam taşımaz (RFC 9112 §5).
    const rawValue = line.slice(colon + 1);
    const leadingWhitespace = rawValue.length - rawValue.trimStart().length;
    const value = rawValue.trim();
    const valueOffset = cursor + colon + 1 + leadingWhitespace;

    sink.fields.push({
      id: `header-${index}-name`,
      name: `Header ${index} Name`,
      offset: cursor,
      length: name.length,
      rawBytes: data.slice(cursor, cursor + name.length),
      rawValue: name,
      valid: !/[ \t]$/.test(name),
      warnings: [],
    });
    sink.fields.push({
      id: `header-${index}-value`,
      name: `Header ${index} — ${name.trim()}`,
      offset: valueOffset,
      length: value.length,
      rawBytes: data.slice(valueOffset, valueOffset + value.length),
      rawValue: value,
      valid: true,
      warnings: [],
    });

    entries.push({ name: name.trim(), lowerName: name.trim().toLowerCase(), value, valueOffset });
    cursor = lineEnd + CRLF.length;
    index += 1;
  }

  return entries;
}

/**
 * RFC 9112 §6.3'ün sırası (dosya başı). `contentLength` yalnız
 * `content-length` çerçevelemesinde anlamlıdır.
 */
function decideFraming(
  entries: readonly HeaderEntry[],
  statusCode: number | undefined,
  isResponse: boolean,
  headMethodAssumed: boolean,
  sink: Sink,
): { framing: BodyFraming; contentLength?: number } {
  const contentLengths = entries.filter((entry) => entry.lowerName === 'content-length');
  const transferEncodings = entries.filter((entry) => entry.lowerName === 'transfer-encoding');

  if (contentLengths.length > 0 && transferEncodings.length > 0) {
    // Request smuggling vektörü — sıradan gösterilmez (dosya başı).
    sink.errors.push({
      code: 'length-mismatch',
      message: ERROR_SMUGGLING_CONFLICT,
      offset: contentLengths[0]?.valueOffset ?? 0,
      length: contentLengths[0]?.value.length ?? 0,
      details: {
        contentLength: contentLengths[0]?.value ?? '',
        transferEncoding: transferEncodings[0]?.value ?? '',
      },
    });
  }

  const distinctLengths = new Set(contentLengths.map((entry) => entry.value.trim()));
  if (distinctLengths.size > 1) {
    sink.errors.push({
      code: 'length-mismatch',
      message: ERROR_CONTENT_LENGTH_CONFLICT,
      offset: contentLengths[0]?.valueOffset ?? 0,
      length: contentLengths[0]?.value.length ?? 0,
      details: { values: [...distinctLengths] },
    });
  }

  // 1xx / 204 / 304 gövde TAŞIMAZ — Content-Length yazsa bile (RFC 9110 §6.4.1).
  if (isResponse && statusCode !== undefined) {
    if (statusCode < 200 || statusCode === 204 || statusCode === 304) return { framing: 'none' };
  }

  // HEAD yanıtı: gövde yok, Content-Length yalnız bilgi (dosya başı).
  if (isResponse && headMethodAssumed) {
    pushWarning(sink, WARN_HEAD_RESPONSE_ASSUMED);
    return { framing: 'none' };
  }

  if (transferEncodings.length > 0) {
    const codings = transferEncodings
      .flatMap((entry) => entry.value.split(','))
      .map((coding) => coding.trim().toLowerCase())
      .filter((coding) => coding.length > 0);
    const last = codings[codings.length - 1];
    if (last === 'chunked') return { framing: 'chunked' };
    // Son kodlama `chunked` değilse uzunluk bilinemez (RFC 9112 §6.3 madde 3).
    pushWarning(sink, WARN_TRANSFER_ENCODING_NOT_CHUNKED);
    return { framing: isResponse ? 'until-close' : 'none' };
  }

  const contentLengthEntry = contentLengths[0];
  if (contentLengthEntry !== undefined) {
    const text = contentLengthEntry.value.trim();
    if (!/^\d+$/.test(text)) {
      sink.errors.push({
        code: 'length-mismatch',
        message: ERROR_CONTENT_LENGTH_MALFORMED,
        offset: contentLengthEntry.valueOffset,
        length: contentLengthEntry.value.length,
        details: { value: contentLengthEntry.value },
      });
      return { framing: 'none' };
    }
    return { framing: 'content-length', contentLength: Number(text) };
  }

  if (isResponse) {
    pushWarning(sink, WARN_BODY_UNTIL_CLOSE);
    return { framing: 'until-close' };
  }
  return { framing: 'none' };
}

/** `size[;ext]CRLF data CRLF … 0CRLF [trailer] CRLF` (RFC 9112 §7.1). */
function parseChunkedBody(data: Uint8Array, text: string, startOffset: number, sink: Sink): number {
  let cursor = startOffset;
  let index = 0;
  let reassembledLength = 0;

  while (index < MAX_CHUNKS) {
    const lineEnd = text.indexOf(CRLF, cursor);
    if (lineEnd < 0) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_CHUNK_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
      });
      return reassembledLength;
    }

    const sizeLine = text.slice(cursor, lineEnd);
    const semicolon = sizeLine.indexOf(';');
    const sizeText = (semicolon < 0 ? sizeLine : sizeLine.slice(0, semicolon)).trim();
    if (semicolon >= 0) {
      // chunk-ext okunur ama YOK SAYILIR (dosya başı).
      pushWarning(sink, WARN_CHUNK_EXTENSION_IGNORED);
    }

    // ONALTILIK — ondalık okumak 0x10'u 10 sayardı (dosya başı).
    if (!/^[0-9a-fA-F]+$/.test(sizeText)) {
      sink.errors.push({
        code: 'invalid-hex-input',
        message: ERROR_CHUNK_SIZE_MALFORMED,
        offset: cursor,
        length: sizeLine.length,
        details: { sizeText },
      });
      return reassembledLength;
    }
    const size = Number.parseInt(sizeText, HEX_RADIX);

    sink.fields.push({
      id: `chunk-${index}-size`,
      name: `Chunk ${index} Size`,
      offset: cursor,
      length: sizeText.length,
      rawBytes: data.slice(cursor, cursor + sizeText.length),
      rawValue: sizeText,
      physicalValue: size,
      unit: 'B',
      valid: true,
      warnings: [],
    });

    const dataOffset = lineEnd + CRLF.length;
    if (size === 0) {
      // Son chunk: ardından trailer bölümü gelebilir.
      const trailerEnd = text.indexOf(HEADER_TERMINATOR, lineEnd);
      const hasTrailer = dataOffset < data.length && !text.startsWith(CRLF, dataOffset);
      if (hasTrailer && trailerEnd >= 0) {
        pushWarning(sink, WARN_TRAILER_PRESENT);
        sink.fields.push({
          id: 'chunk-trailer',
          name: 'Trailer Section',
          offset: dataOffset,
          length: Math.max(trailerEnd + CRLF.length - dataOffset, 0),
          rawBytes: data.slice(dataOffset, trailerEnd + CRLF.length),
          rawValue: text.slice(dataOffset, trailerEnd + CRLF.length),
          valid: true,
          warnings: [],
        });
      }
      return reassembledLength;
    }

    if (dataOffset + size > data.length) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_CHUNK_TRUNCATED,
        offset: dataOffset,
        length: dataOffset + size - data.length,
        details: { declaredSize: size, availableBytes: Math.max(data.length - dataOffset, 0) },
      });
      return reassembledLength;
    }

    sink.fields.push({
      id: `chunk-${index}-data`,
      name: `Chunk ${index} Data`,
      offset: dataOffset,
      length: size,
      rawBytes: data.slice(dataOffset, dataOffset + size),
      rawValue: text.slice(dataOffset, dataOffset + size),
      valid: true,
      warnings: [],
    });

    reassembledLength += size;
    cursor = dataOffset + size + CRLF.length;
    index += 1;
  }

  return reassembledLength;
}

function parseHttpFrame(data: Uint8Array, options: HttpParseOptions): ParseResult {
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
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
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
  const terminator = text.indexOf(HEADER_TERMINATOR);
  if (terminator < 0) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADERS_UNTERMINATED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const startLineEnd = text.indexOf(CRLF);
  if (startLineEnd < 0 || startLineEnd > terminator) {
    return {
      success: false,
      error: { code: 'start-delimiter-not-found', message: ERROR_START_LINE_MALFORMED, offset: 0, length: 1 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sink: Sink = { fields: [], warnings: [], errors: [] };
  const startLine = text.slice(0, startLineEnd);
  const isResponse = startLine.startsWith('HTTP/');

  pushTextField(data, 'message-kind', 'Message Kind', 0, startLine, sink).physicalValue = isResponse
    ? 'Response'
    : 'Request';

  let statusCode: number | undefined;
  if (isResponse) {
    statusCode = parseStatusLine(data, startLine, sink);
    if (statusCode === undefined) {
      return {
        success: false,
        error: { code: 'start-delimiter-not-found', message: ERROR_START_LINE_MALFORMED, offset: 0, length: startLine.length },
        consumedBytes: 0,
        recoverable: true,
      };
    }
  } else if (!parseRequestLine(data, startLine, sink)) {
    return {
      success: false,
      error: { code: 'start-delimiter-not-found', message: ERROR_START_LINE_MALFORMED, offset: 0, length: startLine.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  // Çıplak LF (CRLF olmadan) smuggling'in üçüncü vektörü; taranır, uyarılır.
  if (/[^\r]\n/.test(text.slice(0, terminator))) pushWarning(sink, WARN_BARE_LF);

  const entries = parseHeaders(data, text, startLineEnd + CRLF.length, terminator, sink);

  const headMethodAssumed = readRequestMethodOption(options.options) === REQUEST_METHOD_HEAD;
  const { framing, contentLength } = decideFraming(entries, statusCode, isResponse, headMethodAssumed, sink);

  const bodyOffset = terminator + HEADER_TERMINATOR.length;
  const availableBody = Math.max(data.length - bodyOffset, 0);

  sink.fields.push({
    id: 'body-framing',
    name: 'Body Framing',
    offset: bodyOffset,
    length: 0,
    rawBytes: data.slice(bodyOffset, bodyOffset),
    physicalValue: FRAMING_LABELS[framing],
    valid: true,
    warnings: [],
  });

  if (framing === 'chunked') {
    const reassembled = parseChunkedBody(data, text, bodyOffset, sink);
    sink.fields.push({
      id: 'reassembled-body-length',
      name: 'Reassembled Body Length',
      offset: bodyOffset,
      length: availableBody,
      rawBytes: data.slice(bodyOffset),
      physicalValue: reassembled,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  } else if (framing === 'content-length' && contentLength !== undefined) {
    if (availableBody < contentLength) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_BODY_TRUNCATED,
        offset: bodyOffset,
        length: contentLength - availableBody,
        details: { declaredLength: contentLength, availableBytes: availableBody },
      });
    } else if (availableBody > contentLength) {
      // Fazlalık büyük olasılıkla boru hattındaki BİR SONRAKİ mesaj.
      pushWarning(sink, WARN_BODY_LONGER_THAN_DECLARED);
    }
    const bodyLength = Math.min(contentLength, availableBody);
    sink.fields.push({
      id: 'body',
      name: 'Body',
      offset: bodyOffset,
      length: bodyLength,
      rawBytes: data.slice(bodyOffset, bodyOffset + bodyLength),
      rawValue: text.slice(bodyOffset, bodyOffset + bodyLength),
      valid: true,
      warnings: [],
    });
  } else if (framing === 'until-close' && availableBody > 0) {
    sink.fields.push({
      id: 'body',
      name: 'Body',
      offset: bodyOffset,
      length: availableBody,
      rawBytes: data.slice(bodyOffset),
      rawValue: text.slice(bodyOffset),
      valid: true,
      warnings: [],
    });
  } else if (framing === 'none' && availableBody > 0) {
    // Gövde YASAK ama bayt var: kesilmiş yakalama ya da bozuk gönderici.
    pushWarning(sink, WARN_BODY_FORBIDDEN_BUT_PRESENT);
    sink.fields.push({
      id: 'unexpected-body',
      name: 'Unexpected Body',
      offset: bodyOffset,
      length: availableBody,
      rawBytes: data.slice(bodyOffset),
      unit: 'B',
      valid: false,
      warnings: [WARN_BODY_FORBIDDEN_BUT_PRESENT],
    });
  }

  // İstek/yanıt eşleştirmesi ve süresi bir AKIŞIN işi (dosya başı).
  pushWarning(sink, WARN_TRANSACTION_MATCHING_NEEDS_STREAM);

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

export function parseHttp(data: Uint8Array): ParseResult {
  return parseHttpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): HttpParseOptions {
  const options: HttpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  if (context?.options !== undefined) options.options = context.options;
  return options;
}

export const httpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: başlangıç satırı ya `HTTP/` ile başlar ya da bilinen bir
   * metotla. Başlık sonlandırıcısı BURADA aranmaz — tam tarama `parse`nin işi. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    const head = toLatin1(data.slice(0, 24));
    if (head.startsWith('HTTP/')) return true;
    const space = head.indexOf(' ');
    return space > 0 && METHODS.has(head.slice(0, space));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseHttpFrame(data, readContextOptions(context));
  },
};

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'get-request',
    name: 'protocol.http.example.getRequest.name',
    // Spec `:382`in örneği.
    bytes: bytesOf('GET /api/status HTTP/1.1\r\nHost: 192.168.1.20\r\nAccept: application/json\r\n\r\n'),
    description: 'protocol.http.example.getRequest.description',
    expectedValid: true,
  },
  {
    id: 'json-response',
    name: 'protocol.http.example.jsonResponse.name',
    bytes: bytesOf(
      'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 27\r\n\r\n{"state":"ok","uptime":42}\n',
    ),
    description: 'protocol.http.example.jsonResponse.description',
    expectedValid: true,
  },
  {
    id: 'chunked-response',
    name: 'protocol.http.example.chunkedResponse.name',
    // Spec `:394`in örneği: `4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n` → "Wikipedia".
    bytes: bytesOf(
      'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n',
    ),
    description: 'protocol.http.example.chunkedResponse.description',
    expectedValid: true,
  },
  {
    id: 'chunked-hex-size',
    name: 'protocol.http.example.chunkedHexSize.name',
    // Boyut ONALTILIK: `10` = 16 bayt. Ondalık okuyan çözücü burada kayar.
    bytes: bytesOf(
      'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n10\r\n0123456789abcdef\r\n0\r\n\r\n',
    ),
    description: 'protocol.http.example.chunkedHexSize.description',
    expectedValid: true,
  },
  {
    id: 'no-content',
    name: 'protocol.http.example.noContent.name',
    // 204 gövde TAŞIMAZ — Content-Length yazsa bile.
    bytes: bytesOf('HTTP/1.1 204 No Content\r\nContent-Length: 12\r\n\r\n'),
    description: 'protocol.http.example.noContent.description',
    expectedValid: true,
  },
  {
    id: 'smuggling-conflict',
    name: 'protocol.http.example.smugglingConflict.name',
    // Content-Length + Transfer-Encoding birlikte: hata yolu.
    bytes: bytesOf(
      'POST /upload HTTP/1.1\r\nHost: gw\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
    ),
    description: 'protocol.http.example.smugglingConflict.description',
    expectedValid: false,
  },
  {
    id: 'header-name-whitespace',
    name: 'protocol.http.example.headerNameWhitespace.name',
    // `Content-Length : 5` — ad ile `:` arasında boşluk, hata yolu.
    bytes: bytesOf('POST /x HTTP/1.1\r\nHost: gw\r\nContent-Length : 5\r\n\r\nhello'),
    description: 'protocol.http.example.headerNameWhitespace.description',
    expectedValid: false,
  },
];

export const httpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: httpParser,
  documentation: {
    summary: 'protocol.http.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
