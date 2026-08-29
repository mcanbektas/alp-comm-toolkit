/**
 * Linux SocketCAN `candump` log ayrıştırıcısı (spec §34 "Candump").
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────
 * Deponun `docs/spec/` dosyası candump satır düzenini vermiyor (yalnız biçim
 * adı geçer). Aşağıdaki iki yazım can-utils'in kendi çıktısından alındı ve
 * `candump.1` man sayfasıyla çapraz doğrulandı:
 *
 *   LOG biçimi (`candump -l`, `canplayer`in okuduğu biçim):
 *     (1637856000.123456) can0 123#DEADBEEF
 *   İNSAN OKUR biçimi (ekrana basılan):
 *       can0  123   [4]  DE AD BE EF
 *
 * ── AYIRT EDİCİ AYRINTILAR ────────────────────────────────────────────────
 * · Kimlik hane sayısı ÇERÇEVE TİPİNİ söyler: 3 hane standart (11 bit),
 *   8 hane genişletilmiş (29 bit). candump bunu sıfır dolgusuyla garanti eder,
 *   bu yüzden `frameId` METİN olarak saklanır — sayıya çevirmek "0x00000123"
 *   ile "0x123" farkını, yani çerçeve tipini SİLER.
 * · `#` tek ise klasik CAN, `##` ise CAN FD'dir ve `##`den SONRAKİ TEK hane
 *   FD bayraklarıdır (BRS/ESI), veri ondan sonra başlar.
 * · `#R` uzaktan çerçeve isteğidir (RTR): veri YOKTUR, `#R8` yazımında 8
 *   istenen veri uzunluğudur — sekiz bayt veri DEĞİL.
 * · Hata çerçevesi log biçiminde SIRADAN bir genişletilmiş çerçeveden
 *   ayırt edilemez (ikisi de 8 haneli kimlik yazar); bu yüzden `error-frame`
 *   bayrağı yalnız insan-okur biçimindeki açık `ERRORFRAME` sözcüğüne
 *   bakarak konur — kimlikteki bitlerden TAHMİN EDİLMEZ.
 */

import type { LogParseOptions, LogParseResult, LogRecord, LogRecordFlag } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { inferTimestampKind, readHexBytes, readHexNumber, readTimestampMs, splitLines } from './textTokens';
import { createWarningCollector } from './warnings';

/** `(1637856000.123456) can0 123#DEADBEEF` — parantezli damga + arayüz + gövde. */
const LOG_LINE_PATTERN = /^\((-?[\d.]+)\)\s+(\S+)\s+(\S+)\s*$/;
/** `  can0  123   [4]  DE AD BE EF  'text'` — damgasız, köşeli parantezli uzunluk. */
const HUMAN_LINE_PATTERN = /^(\S+)\s+([0-9A-Fa-f]+)\s+\[(\d+)\]\s*(.*)$/;
/** `123#DEADBEEF`, `123##1DEADBEEF`, `123#R`, `123#R8`. */
const BODY_PATTERN = /^([0-9A-Fa-f]+)(#{1,2})(.*)$/;

const EXTENDED_ID_DIGITS = 8;
const REMOTE_LENGTH_RADIX = 10;

interface CandumpBody {
  readonly data: Uint8Array;
  readonly declaredLength: number;
  readonly flags: LogRecordFlag[];
}

/** Gövdeyi (`ID#…` kısmının `#`ten sonrası) çözer; okunamazsa `undefined`. */
function readBody(separator: string, payload: string): CandumpBody | undefined {
  const flags: LogRecordFlag[] = [];

  if (payload.startsWith('R') || payload.startsWith('r')) {
    // RTR: `R` tek başına 0 uzunluk, `R8` sekiz bayt İSTENDİĞİ anlamına gelir.
    const requested = payload.slice(1);
    const declaredLength = requested.length === 0 ? 0 : Number.parseInt(requested, REMOTE_LENGTH_RADIX);
    if (!Number.isFinite(declaredLength)) return undefined;
    return { data: new Uint8Array(0), declaredLength, flags: ['remote-frame'] };
  }

  let hex = payload;
  if (separator === '##') {
    // `##`den sonraki TEK hane FD bayrak baytıdır, veri değil.
    if (hex.length === 0) return undefined;
    hex = hex.slice(1);
    flags.push('flexible-data-rate');
  }

  const data = readHexBytes(hex);
  if (data === undefined) return undefined;
  return { data, declaredLength: data.length, flags };
}

function idFlags(frameId: string): LogRecordFlag[] {
  return frameId.length === EXTENDED_ID_DIGITS ? ['extended-id'] : [];
}

/**
 * Bir satırı kayda çevirir. İki yazım da denenir; hiçbiri tutmazsa `undefined`
 * döner ve çağıran satırı atlar (tek bozuk satır 100 bin satırlık logu
 * düşüremez).
 */
function parseLine(line: string, index: number, lineNumber: number): LogRecord | undefined {
  const logMatch = LOG_LINE_PATTERN.exec(line);
  if (logMatch !== null) {
    const bodyMatch = BODY_PATTERN.exec(logMatch[3] ?? '');
    if (bodyMatch === null) return undefined;
    const frameId = bodyMatch[1] ?? '';
    const body = readBody(bodyMatch[2] ?? '#', bodyMatch[3] ?? '');
    if (body === undefined) return undefined;
    return {
      index,
      line: lineNumber,
      timestamp: readTimestampMs(logMatch[1] ?? ''),
      direction: undefined,
      channel: logMatch[2],
      frameId,
      frameIdValue: readHexNumber(frameId),
      data: body.data,
      originalLength: body.declaredLength,
      flags: [...idFlags(frameId), ...body.flags],
    };
  }

  const humanMatch = HUMAN_LINE_PATTERN.exec(line.trim());
  if (humanMatch === null) return undefined;
  const frameId = humanMatch[2] ?? '';
  const declaredLength = Number.parseInt(humanMatch[3] ?? '', REMOTE_LENGTH_RADIX);
  const rest = humanMatch[4] ?? '';
  // `-a` seçeneği bayt listesinden sonra tırnaklı ASCII gösterimi ekler; veri değildir.
  const hexPart = rest.split("'")[0] ?? '';
  const data = readHexBytes(hexPart.trim());
  if (data === undefined || !Number.isFinite(declaredLength)) return undefined;
  const flags: LogRecordFlag[] = idFlags(frameId);
  if (/ERRORFRAME/i.test(rest)) flags.push('error-frame');

  return {
    index,
    line: lineNumber,
    timestamp: undefined,
    direction: undefined,
    channel: humanMatch[1],
    frameId,
    frameIdValue: readHexNumber(frameId),
    data,
    originalLength: declaredLength,
    flags,
  };
}

export function parseCandumpLog(text: string, options: LogParseOptions = {}): LogParseResult {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const lines = splitLines(text);
  if (lines.length === 0) {
    return { status: 'error', code: 'empty-input', message: 'Dosya boş.' };
  }

  const warnings = createWarningCollector();
  const records: LogRecord[] = [];
  let limitReached = false;

  for (let i = 0; i < lines.length; i++) {
    if (records.length >= maxRecords) {
      limitReached = true;
      warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`, i + 1);
      break;
    }
    const line = lines[i] ?? '';
    if (line.trim().length === 0) continue;

    const record = parseLine(line, records.length, i + 1);
    if (record === undefined) {
      warnings.add('unparsed-line', `Satır candump kalıplarının hiçbirine uymadı: "${line.trim().slice(0, 80)}"`, i + 1);
      continue;
    }
    records.push(record);
  }

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'Dosyada candump biçiminde okunabilen satır yok.' };
  }

  return {
    status: 'ok',
    summary: {
      format: 'candump',
      timestampKind: inferTimestampKind(records[0]?.timestamp),
      recordCount: records.length,
      totalLines: lines.length,
      skippedLines: warnings.countOf('unparsed-line'),
      limitReached,
      detail: undefined,
    },
    records,
    warnings: warnings.list(),
  };
}
