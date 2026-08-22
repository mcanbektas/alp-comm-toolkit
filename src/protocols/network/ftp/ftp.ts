/**
 * FTP kontrol bağlantısı (RFC 959) — TCP üstünde satır tabanlı ASCII komut/
 * yanıt değişimi. Brief kapsamı **control-message analysis**tır ("full file
 * reconstruction opsiyonel ileri özellik", `08-ag-ethernet.md:640`), bu
 * yüzden data connection'ın kendisi (`RETR`in taşıdığı dosya) ÇÖZÜLMEZ.
 *
 * ── GİRDİ: TEK SATIR DEĞİL, YAPIŞTIRILAN TÜM CONTROL OTURUMU ─────────────────
 * FTP kontrol bağlantısı TCP'dir — UDP'nin aksine doğal mesaj sınırı YOK.
 * `tftp.ts`/`rtp.ts`nin "girdi tek paket" kararı burada UYMAZ: katalogdaki
 * "Control Session Viewer" ve "Transaction Tree" araçları birden çok satırlık
 * bir yapıştırmayı bekler. Bu dosya bu yüzden `rtcp.ts`nin compound-paket
 * döngüsüne benzer şekilde CRLF (ya da yalnız LF, tolerans) ile ayrılan HER
 * satırı kendi başına sınıflandırır — ama satırlar ARASI korelasyon (çok
 * satırlı 'nnn-...' yanıtını TEK mantıksal yanıta birleştirmek, ya da bir
 * `RETR`i sonraki `226`ya bağlamak) YAPILMAZ; bu, DNS Transaction Matching /
 * PTP BMCA / RTP Jitter'ın izlediği "çok-paketli korelasyon parser'ın değil
 * analyzer'ın işi" çizgisinin aynısıdır.
 *
 * ── SINIFLANDIRMA: TELDEN ÇIKAR, TAHMİN DEĞİL ────────────────────────────────
 * Yanıt satırı 3 haneli koddan (+ ` `/`-` ayırıcı) BAŞLAR (RFC 959 §4.2);
 * komut satırı ALPHA bir fiil TOKEN'ıyla başlar. İkisine de uymayan satır
 * "Unclassified Line" olarak ham gösterilir — uydurma sınıf YOK. Uyarı
 * BASILMAZ: çok satırlı yanıtın devam satırları (RFC 959 §4.2 "yyz-metin…")
 * girintili serbest metindir ve normalde de üçüncü bir kalıba uymaz — bunu
 * "şüpheli" işaretlemek her çok satırlı yanıtta yanlış alarm üretirdi.
 *
 * ── PASS REDAKSİYONU: PHYSICALVALUE'DA, RAWBYTES'TA DEĞİL ────────────────────
 * Spec `:401` "Credentials varsayılan olarak redakte edilir: PASS ********"
 * der. `physicalValue` (varsayılan ekran görünümü) maskelenir; `rawBytes`
 * gerçek baytları KORUR — kullanıcı verisi zaten yerelde kalıyor (CLAUDE.md),
 * ham bayt incelemesi bu aracın temel özelliği, maskelemek şifreyi göstermek
 * değil omuz sörfüne karşı varsayılan ekranı temkinli tutmaktır.
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

const PROTOCOL_ID = 'ftp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'FTP';

const CR = 0x0d;
const LF = 0x0a;
const RESPONSE_CODE_LENGTH = 3;
const REDACTED = '********';

/** Spec `08-ag-ethernet.md:398-401,404-406`de birebir adı geçen fiiller. */
const KNOWN_COMMAND_MEANINGS: ReadonlyMap<string, string> = new Map([
  ['USER', 'Provide username'],
  ['PASS', 'Provide password'],
  ['SYST', 'Query system type'],
  ['PWD', 'Print working directory'],
  ['TYPE', 'Set transfer type (e.g. I=binary, A=ASCII)'],
  ['PASV', 'Request passive mode (server picks the data port)'],
  ['EPSV', 'Request passive mode (extended, protocol-independent address)'],
  ['PORT', 'Request active mode (client-specified data port, IPv4)'],
  ['EPRT', 'Request active mode (extended, protocol-independent address)'],
  ['RETR', 'Retrieve (download) a file'],
  ['QUIT', 'End the session'],
]);

/** Spec `08-ag-ethernet.md:399`de birebir adı geçen yanıt kodları. */
const KNOWN_RESPONSE_MEANINGS: ReadonlyMap<number, string> = new Map([
  [220, 'Service ready for new user'],
  [331, 'Username OK, password required'],
  [230, 'User logged in'],
  [227, 'Entering Passive Mode'],
  [150, 'File status okay, about to open data connection'],
  [226, 'Closing data connection, transfer complete'],
]);

/** RFC 959 §4.2.1 — yanıt kodunun ilk hanesi, kapalı/genel küme (tahmin değil). */
const RESPONSE_CLASS_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Positive Preliminary Reply'],
  [2, 'Positive Completion Reply'],
  [3, 'Positive Intermediate Reply'],
  [4, 'Transient Negative Completion Reply'],
  [5, 'Permanent Negative Completion Reply'],
]);

const RESPONSE_LINE_PATTERN = /^(\d{3})([ -]?)(.*)$/;
const COMMAND_LINE_PATTERN = /^([A-Za-z]+)(?:( )(.*))?$/;

const ERROR_EMPTY_FRAME = 'protocol.ftp.error.emptyFrame';
const ERROR_FRAME_TOO_LONG = 'protocol.ftp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ftp.error.aborted';

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

interface LineSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * CRLF (ya da yalın LF, tolerans) ile ayrılan satırları bulur. Sonu
 * sonlandırıcısız kalan son satır da (yapıştırmada CRLF unutulmuş olabilir)
 * bir satır sayılır — akış katmanı değil, tek seferlik bir yapıştırma kutusu
 * bu (dosya başı).
 */
function splitLines(data: Uint8Array): LineSpan[] {
  const lines: LineSpan[] = [];
  let pos = 0;
  while (pos < data.length) {
    let end = pos;
    while (end < data.length && byteAt(data, end) !== CR && byteAt(data, end) !== LF) {
      end += 1;
    }
    lines.push({ start: pos, end });
    if (end >= data.length) {
      pos = end;
      break;
    }
    pos = byteAt(data, end) === CR && byteAt(data, end + 1) === LF ? end + 2 : end + 1;
  }
  return lines;
}

function pushResponseLine(data: Uint8Array, line: LineSpan, text: string, fields: ParsedField[]): void {
  const match = RESPONSE_LINE_PATTERN.exec(text);
  if (match === null) return;
  const codeText = match[1] as string;
  const separator = match[2] ?? '';
  const code = Number.parseInt(codeText, 10);
  const codeOffset = line.start;

  const meaning = KNOWN_RESPONSE_MEANINGS.get(code) ?? RESPONSE_CLASS_NAMES.get(Math.trunc(code / 100));
  fields.push({
    id: `response-code-${String(codeOffset)}`,
    name: 'Response Code',
    offset: codeOffset,
    length: RESPONSE_CODE_LENGTH,
    rawBytes: data.slice(codeOffset, codeOffset + RESPONSE_CODE_LENGTH),
    rawValue: code,
    ...(meaning === undefined ? {} : { physicalValue: meaning }),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `response-multiline-${String(codeOffset)}`,
    name: 'Multi-line Marker',
    offset: codeOffset + RESPONSE_CODE_LENGTH,
    length: separator.length,
    rawBytes: data.slice(codeOffset + RESPONSE_CODE_LENGTH, codeOffset + RESPONSE_CODE_LENGTH + separator.length),
    physicalValue: separator === '-' ? 'Continues' : 'Final Line',
    valid: true,
    warnings: [],
  });

  const textOffset = codeOffset + RESPONSE_CODE_LENGTH + separator.length;
  if (textOffset < line.end) {
    fields.push({
      id: `response-text-${String(textOffset)}`,
      name: 'Response Text',
      offset: textOffset,
      length: line.end - textOffset,
      rawBytes: data.slice(textOffset, line.end),
      physicalValue: text.slice(RESPONSE_CODE_LENGTH + separator.length),
      valid: true,
      warnings: [],
    });
  }
}

function pushCommandLine(data: Uint8Array, line: LineSpan, text: string, fields: ParsedField[]): void {
  const match = COMMAND_LINE_PATTERN.exec(text);
  if (match === null) return;
  const verbText = match[1] as string;
  const verbUpper = verbText.toUpperCase();
  const verbOffset = line.start;

  const meaning = KNOWN_COMMAND_MEANINGS.get(verbUpper);
  fields.push({
    id: `command-verb-${String(verbOffset)}`,
    name: 'Command',
    offset: verbOffset,
    length: verbText.length,
    rawBytes: data.slice(verbOffset, verbOffset + verbText.length),
    ...(meaning === undefined ? {} : { physicalValue: meaning }),
    valid: true,
    warnings: [],
  });

  const argumentText = match[3];
  if (argumentText !== undefined && argumentText.length > 0) {
    const argumentOffset = verbOffset + verbText.length + 1;
    const redacted = verbUpper === 'PASS';
    fields.push({
      id: `command-argument-${String(argumentOffset)}`,
      name: 'Argument',
      offset: argumentOffset,
      length: argumentText.length,
      rawBytes: data.slice(argumentOffset, argumentOffset + argumentText.length),
      physicalValue: redacted ? REDACTED : argumentText,
      valid: true,
      warnings: [],
    });
  }
}

function pushLine(data: Uint8Array, line: LineSpan, fields: ParsedField[]): void {
  if (line.end === line.start) return; // boş satır — biçimsel, anlamlı değil.

  const text = textDecoder.decode(data.slice(line.start, line.end));

  if (/^\d{3}[ -]/.test(text)) {
    pushResponseLine(data, line, text, fields);
    return;
  }
  if (/^[A-Za-z]+(\s|$)/.test(text)) {
    pushCommandLine(data, line, text, fields);
    return;
  }

  fields.push({
    id: `unclassified-line-${String(line.start)}`,
    name: 'Unclassified Line',
    offset: line.start,
    length: line.end - line.start,
    rawBytes: data.slice(line.start, line.end),
    physicalValue: text,
    valid: true,
    warnings: [],
  });
}

interface FtpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: FtpParseOptions,
): ParseResult {
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

function parseFtpFrame(data: Uint8Array, options: FtpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  for (const line of splitLines(data)) {
    pushLine(data, line, fields);
  }

  return finishFrame(data, fields, warnings, errors, options);
}

export function parseFtp(data: Uint8Array): ParseResult {
  return parseFtpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): FtpParseOptions {
  const options: FtpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ftpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: en az 1 bayt — metin protokolünde bundan fazlası spekülasyon olur. */
  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseFtpFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'login-and-retrieve',
    name: 'protocol.ftp.example.loginAndRetrieve.name',
    // Tam bir oturum dilimi: karşılama, USER/PASS, PWD, PASV, RETR, transfer tamam.
    bytes: new TextEncoder().encode(
      '220 Service ready for new user\r\n' +
        'USER anonymous\r\n' +
        '331 Username OK, password required\r\n' +
        'PASS secret123\r\n' +
        '230 User logged in\r\n' +
        'PASV\r\n' +
        '227 Entering Passive Mode (127,0,0,1,200,50)\r\n' +
        'RETR firmware.bin\r\n' +
        '150 File status okay, about to open data connection\r\n' +
        '226 Closing data connection, transfer complete\r\n' +
        'QUIT\r\n',
    ),
    description: 'protocol.ftp.example.loginAndRetrieve.description',
    expectedValid: true,
  },
  {
    id: 'multiline-response',
    name: 'protocol.ftp.example.multilineResponse.name',
    // RFC 959 çok satırlı yanıt biçimi: ara satırlar '-', son satır ' '.
    bytes: new TextEncoder().encode(
      '211-Extensions supported\r\n' + ' MDTM\r\n' + ' SIZE\r\n' + '211 End\r\n',
    ),
    description: 'protocol.ftp.example.multilineResponse.description',
    expectedValid: true,
  },
  {
    id: 'unclassified-line',
    name: 'protocol.ftp.example.unclassifiedLine.name',
    // Ne 3 haneli koda ne fiil dizisine uyan bir satır — uyarısız ham gösterilir.
    bytes: new TextEncoder().encode('12ab not a response or a command\r\n'),
    description: 'protocol.ftp.example.unclassifiedLine.description',
    expectedValid: true,
  },
];

export const ftpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: ftpParser,
  documentation: {
    summary: 'protocol.ftp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
