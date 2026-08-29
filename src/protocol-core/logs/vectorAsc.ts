/**
 * Vector CANalyzer/CANoe ASCII (`.asc`) log ayrıştırıcısı (spec §34 "ASC").
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────
 * Deponun `docs/spec/` dosyası ASC satır düzenini vermez. Aşağıdaki gramer
 * Vector'ün ASC dosyalarının kendi başlığından (`base`/`timestamps`
 * satırları) ve yaygın CANalyzer çıktısından çıkarıldı:
 *
 *   date Tue Sep 21 10:00:00 2021
 *   base hex  timestamps absolute
 *   Begin Triggerblock Tue Sep 21 10:00:00 2021
 *      0.011557 1  100             Rx   d 8 01 02 03 04 05 06 07 08
 *      0.021557 1  18F00401x       Rx   d 8 01 02 03 04 05 06 07 08
 *      0.031557 CANFD   1 Rx  100  Msg1  0 0 8 8 01 02 03 04 05 06 07 08
 *   End TriggerBlock
 *
 * ── ANLAMI KODDAN OKUNMAYAN AYRINTILAR ────────────────────────────────────
 * · `base hex` / `base dec` BAŞLIK SATIRIDIR ve kimliklerin TABANINI belirler.
 *   Yok sayılırsa `base dec` dosyasındaki "100" kimliği 0x100 sanılır — sessiz
 *   ve fark edilmesi zor bir hata. Varsayılan `hex`tir (CANalyzer varsayılanı).
 * · Kimliğin sonundaki `x` genişletilmiş (29 bit) çerçeve demektir; kimliğin
 *   PARÇASI değildir, ayrılmadan taban çevrimi yapılamaz.
 * · `timestamps absolute|relative` ASC'de EPOCH ile İLGİLİ DEĞİLDİR — ikisi de
 *   ölçüm başlangıcına göreli sayar. Fark şudur: `absolute` her satıra ölçüm
 *   başından geçen süreyi yazar, `relative` ise BİR ÖNCEKİ OLAYDAN geçen
 *   süreyi (delta) yazar. Bu ayrım okunmazsa `relative` bir dosyanın tüm
 *   damgaları milisaniyelik değerlerde toplanır ve zaman çizgisi düzleşir;
 *   burada deltalar birikimli toplanarak ölçüm başına çevrilir.
 * · Epoch'a çevirmenin TEK yolu `date …` başlık satırıdır. Ayrıştırılabilirse
 *   damgalar mutlak epoch ms olur; ayrıştırılamazsa (yerelleştirilmiş gün adı,
 *   ör. Almanca "Die") tarih UYDURULMAZ, damgalar göreli kalır.
 * · Klasik satırda `d` veri, `r` uzaktan çerçevedir; `r`de DLC yazar ama veri
 *   baytı YOKTUR.
 * · Zaman saniye cinsindendir, milisaniyeye çevrilir.
 */

import type { LogParseOptions, LogParseResult, LogRecord, LogRecordFlag } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { readDirection, readHexBytes, splitLines } from './textTokens';
import { createWarningCollector } from './warnings';

const SECONDS_TO_MILLISECONDS = 1000;
const DECIMAL_RADIX = 10;
const HEX_RADIX = 16;

/** Çerçeve OLMAYAN, bilinen ve sessizce atlanan satır başlangıçları. */
const IGNORED_PREFIXES = [
  '//',
  'date',
  'base',
  'internal',
  'begin triggerblock',
  'end triggerblock',
  'measurement',
  'statistic',
  'version',
] as const;

/** Çerçeve olmayan ama satır ortasında geçen Vector olay adları. */
const IGNORED_EVENT_TOKENS = new Set([
  'errorframe',
  'busmapping',
  'j1939tp',
  'statistic:',
  'start',
  'end',
  'trigger',
]);

interface AscHeader {
  readonly idRadix: 10 | 16;
  /** `timestamps relative`: satırdaki değer bir ÖNCEKİ olaydan geçen süredir. */
  readonly deltaTimestamps: boolean;
  /** `date …` satırından okunan ölçüm başlangıcı, epoch ms; okunamazsa `undefined`. */
  readonly measurementStartMs: number | undefined;
}

/**
 * `date` satırının kabul edilen tek yazımı: İngilizce üç harfli gün ve ay
 * adları (`date Tue Sep 21 10:00:00 2021`, saniyede kesir ve `am/pm` eki
 * serbest).
 *
 * TUZAK — neden `Date.parse` tek başına yetmiyor: V8'in yedek tarih
 * ayrıştırıcısı TANIMADIĞI sözcükleri sessizce ATLAR. `Date.parse('Die Sep 21
 * 10:00:00 2021')` (Almanca gün adı) NaN dönmez, geçerli bir tarih döner. Tek
 * başına ona güvenmek, yerelleştirilmiş bir dosyada uydurulmuş bir ölçüm
 * başlangıcı üretirdi. Bu yüzden önce kalıp doğrulanır, sonra `Date.parse`
 * yalnız SAYIYA çevirmek için çağrılır.
 */
const DATE_HEADER_PATTERN =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:\s+[ap]m)?\s+\d{4}$/i;

function readMeasurementStart(line: string): number | undefined {
  const value = line.trim().replace(/^date\s+/i, '');
  if (!DATE_HEADER_PATTERN.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readHeader(lines: readonly string[]): AscHeader {
  let idRadix: 10 | 16 = HEX_RADIX;
  let deltaTimestamps = false;
  let measurementStartMs: number | undefined;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('date ')) measurementStartMs = readMeasurementStart(line);
    if (lower.includes('base dec')) idRadix = DECIMAL_RADIX;
    if (lower.includes('base hex')) idRadix = HEX_RADIX;
    if (lower.includes('timestamps absolute')) deltaTimestamps = false;
    if (lower.includes('timestamps relative')) deltaTimestamps = true;
    // Başlık dosyanın ilk satırlarındadır; ilk çerçeve satırından sonra aranmaz.
    if (/^\s*[\d.]+\s/.test(line)) break;
  }
  return { idRadix, deltaTimestamps, measurementStartMs };
}

function isIgnorable(line: string): boolean {
  const lower = line.trim().toLowerCase();
  if (lower.length === 0) return true;
  return IGNORED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** `18F00401x` → kimlik metni + genişletilmiş bayrağı. */
function splitIdToken(token: string): { readonly text: string; readonly extended: boolean } {
  const extended = /[xX]$/.test(token);
  return { text: extended ? token.slice(0, -1) : token, extended };
}

function readIdValue(text: string, radix: 10 | 16): number | undefined {
  const value = Number.parseInt(text, radix);
  return Number.isFinite(value) ? value : undefined;
}

function isDecimalToken(token: string): boolean {
  return /^\d+$/.test(token);
}

/** Belirtilen sayıda baytı token dizisinden toplar; eksikse toplayabildiğini döner. */
function collectBytes(tokens: readonly string[], start: number, count: number): Uint8Array {
  const slice = tokens.slice(start, start + count).join('');
  return readHexBytes(slice) ?? new Uint8Array(0);
}

interface FrameLine {
  readonly timestampMs: number;
  readonly channel: string;
  readonly frameId: string;
  readonly frameIdValue: number | undefined;
  readonly direction: 'rx' | 'tx' | undefined;
  readonly data: Uint8Array;
  readonly declaredLength: number;
  readonly flags: LogRecordFlag[];
}

/** Klasik CAN satırı: `<t> <ch> <id>[x] <Rx|Tx> <d|r> <dlc> <bytes…>`. */
function readClassicLine(tokens: readonly string[], header: AscHeader): FrameLine | undefined {
  const timeSeconds = Number.parseFloat(tokens[0] ?? '');
  const channel = tokens[1] ?? '';
  const idToken = tokens[2] ?? '';
  const direction = readDirection(tokens[3] ?? '');
  const kind = (tokens[4] ?? '').toLowerCase();
  const dlc = Number.parseInt(tokens[5] ?? '', DECIMAL_RADIX);

  if (!Number.isFinite(timeSeconds) || direction === undefined || !Number.isFinite(dlc)) return undefined;
  if (kind !== 'd' && kind !== 'r') return undefined;

  const { text, extended } = splitIdToken(idToken);
  const flags: LogRecordFlag[] = extended ? ['extended-id'] : [];
  if (kind === 'r') flags.push('remote-frame');

  return {
    timestampMs: timeSeconds * SECONDS_TO_MILLISECONDS,
    channel,
    frameId: text,
    frameIdValue: readIdValue(text, header.idRadix),
    direction,
    data: kind === 'r' ? new Uint8Array(0) : collectBytes(tokens, 6, dlc),
    declaredLength: dlc,
    flags,
  };
}

/**
 * CAN FD satırı: `<t> CANFD <ch> <dir> <id>[x] [ad] <BRS> <ESI> <DLC> <uzunluk> <bytes…>`.
 * Mesaj ADI opsiyoneldir; sayısal OLMAYAN ilk token ad sayılır — BRS/ESI/DLC
 * ve uzunluk alanlarının hepsi sayı olduğu için bu ayrım güvenlidir.
 */
function readFdLine(tokens: readonly string[], header: AscHeader): FrameLine | undefined {
  const timeSeconds = Number.parseFloat(tokens[0] ?? '');
  const channel = tokens[2] ?? '';
  const direction = readDirection(tokens[3] ?? '');
  const idToken = tokens[4] ?? '';
  if (!Number.isFinite(timeSeconds) || direction === undefined || idToken.length === 0) return undefined;

  let cursor = 5;
  if (!isDecimalToken(tokens[cursor] ?? '')) cursor += 1; // mesaj adı
  const dataLength = Number.parseInt(tokens[cursor + 3] ?? '', DECIMAL_RADIX);
  if (!Number.isFinite(dataLength)) return undefined;

  const { text, extended } = splitIdToken(idToken);
  const flags: LogRecordFlag[] = ['flexible-data-rate'];
  if (extended) flags.push('extended-id');

  return {
    timestampMs: timeSeconds * SECONDS_TO_MILLISECONDS,
    channel,
    frameId: text,
    frameIdValue: readIdValue(text, header.idRadix),
    direction,
    data: collectBytes(tokens, cursor + 4, dataLength),
    declaredLength: dataLength,
    flags,
  };
}

export function parseVectorAscLog(text: string, options: LogParseOptions = {}): LogParseResult {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const lines = splitLines(text);
  if (lines.length === 0) {
    return { status: 'error', code: 'empty-input', message: 'Dosya boş.' };
  }

  const header = readHeader(lines);
  const warnings = createWarningCollector();
  const records: LogRecord[] = [];
  let limitReached = false;
  /** `timestamps relative` dosyada deltalar birikimli toplanır. */
  let elapsedMs = 0;

  for (let i = 0; i < lines.length; i++) {
    if (records.length >= maxRecords) {
      limitReached = true;
      warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`, i + 1);
      break;
    }
    const line = lines[i] ?? '';
    if (isIgnorable(line)) continue;

    const tokens = line.trim().split(/\s+/);
    const secondToken = (tokens[1] ?? '').toLowerCase();
    if (IGNORED_EVENT_TOKENS.has(secondToken) || IGNORED_EVENT_TOKENS.has((tokens[2] ?? '').toLowerCase())) continue;

    const frame = secondToken === 'canfd' ? readFdLine(tokens, header) : readClassicLine(tokens, header);
    if (frame === undefined) {
      warnings.add('unparsed-line', `Satır ASC kalıbına uymadı: "${line.trim().slice(0, 80)}"`, i + 1);
      continue;
    }

    elapsedMs = header.deltaTimestamps ? elapsedMs + frame.timestampMs : frame.timestampMs;
    records.push({
      index: records.length,
      line: i + 1,
      timestamp: header.measurementStartMs === undefined ? elapsedMs : header.measurementStartMs + elapsedMs,
      direction: frame.direction,
      channel: frame.channel,
      frameId: frame.frameId,
      frameIdValue: frame.frameIdValue,
      data: frame.data,
      originalLength: frame.declaredLength,
      flags: frame.flags,
    });
  }

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'Dosyada ASC biçiminde okunabilen çerçeve satırı yok.' };
  }

  return {
    status: 'ok',
    summary: {
      format: 'vector-asc',
      timestampKind: header.measurementStartMs === undefined ? 'relative' : 'absolute',
      recordCount: records.length,
      totalLines: lines.length,
      skippedLines: warnings.countOf('unparsed-line'),
      limitReached,
      detail: `base ${header.idRadix === HEX_RADIX ? 'hex' : 'dec'}`,
    },
    records,
    warnings: warnings.list(),
  };
}
