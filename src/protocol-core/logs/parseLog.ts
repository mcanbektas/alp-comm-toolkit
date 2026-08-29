/**
 * Log Analyzer'ın GİRİŞ NOKTASI: bir dosyanın baytlarını alır, biçimini
 * saptar ve doğru ayrıştırıcıya verir (spec §34).
 *
 * ── BİÇİM SAPTAMA SIRASI VE NEDENİ ────────────────────────────────────────
 *  1. İKİLİ İMZA (magic). Dosyanın kendi söylediği şey uzantıdan da
 *     içerikten de üstündür; `.txt` adlı bir pcap dosyası pcap'tir.
 *  2. İÇERİK. Uzantı kullanıcı tarafından değiştirilmiş olabilir ve log
 *     dosyalarında `.log`/`.txt` her şeye verilen genel bir addır — bu
 *     yüzden içerik uzantıdan ÖNCE gelir.
 *  3. UZANTI. Yalnız içerik hiçbir kalıba uymadığında son çare.
 *
 * PCAPNG ayrı bir dosya formatıdır ve `capture/pcap.ts` onu bilerek
 * ayrıştırmaz; burada TANINIR ve açık bir mesajla reddedilir — "tanınmayan
 * dosya" demek, kullanıcıyı yanlış yere baktırırdı.
 */

import { parseBinaryLog } from './binaryLog';
import type { BinaryLogOptions } from './binaryLog';
import { parseCandumpLog } from './candump';
import { detectDelimiter, parseDelimitedLog, splitDelimitedLine } from './delimited';
import type { DelimitedParseOptions } from './delimited';
import { parseHexTextLog } from './hexTextLog';
import { parseJsonLog } from './jsonLog';
import { parsePcapLog } from './pcapSource';
import { splitLines } from './textTokens';
import type { LogParseResult, LogSourceFormat } from './types';
import { parseVectorAscLog } from './vectorAsc';

/**
 * 64 MiB. Spec §41 "dosya boyutu sınırı uygula" maddesinin bu katmandaki
 * karşılığı: tarayıcı sekmesinin belleği tek dosyayla tükenmemeli. Sınır
 * KAYIT sınırından ayrıdır — bir dosya az kayıtla da devasa olabilir.
 */
export const MAX_LOG_FILE_BYTES = 64 * 1024 * 1024;

/** Biçim sezgisi için okunacak baş kısım; tüm dosyayı metne çevirmeye gerek yok. */
const SNIFF_BYTES = 64 * 1024;
const SNIFF_LINES = 50;
const MIN_DELIMITED_COLUMNS = 2;
const DELIMITED_CONSISTENCY_RATIO = 0.6;

/** Klasik libpcap magic'lerinin dört varyantı (bkz. `capture/pcap.ts` başlığı). */
const PCAP_MAGICS = [0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1] as const;
/** PCAPNG Section Header Block imzası — ayrı format, desteklenmiyor. */
const PCAPNG_MAGIC = 0x0a0d0d0a;

const CANDUMP_LOG_PATTERN = /^\(-?[\d.]+\)\s+\S+\s+[0-9A-Fa-f]+#/;
const CANDUMP_HUMAN_PATTERN = /^\s*\S+\s+[0-9A-Fa-f]+\s+\[\d+\]/;
const ASC_HEADER_PATTERN = /^(?:base\s+(?:hex|dec)|date\s|internal events logged|Begin Triggerblock)/i;
const ASC_FRAME_PATTERN = /^\s*[\d.]+\s+(?:CANFD\s+)?\S+\s+\S+\s+(?:Rx|Tx|TxRq)\b/i;

export type DetectedLogFormat = LogSourceFormat | 'pcapng';

export interface ParseLogOptions extends DelimitedParseOptions, BinaryLogOptions {
  /** Verilirse saptama atlanır — kullanıcı biçimi elle seçtiğinde kullanılır. */
  readonly format?: LogSourceFormat;
  readonly maxBytes?: number;
}

export interface LogFileInput {
  readonly fileName?: string;
  readonly bytes: Uint8Array;
}

function readMagicBigEndian(bytes: Uint8Array): number | undefined {
  if (bytes.length < 4) return undefined;
  const b0 = bytes[0] ?? 0;
  const b1 = bytes[1] ?? 0;
  const b2 = bytes[2] ?? 0;
  const b3 = bytes[3] ?? 0;
  return (b0 * 0x1000000 + (b1 << 16) + (b2 << 8) + b3) >>> 0;
}

/** İlk baytlarda NUL varsa dosya metin değildir (UTF-8 metninde NUL bulunmaz). */
function looksBinary(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, SNIFF_BYTES);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

function sniffText(text: string): LogSourceFormat {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';

  const lines = splitLines(text)
    .filter((line) => line.trim().length > 0)
    .slice(0, SNIFF_LINES);

  if (lines.some((line) => CANDUMP_LOG_PATTERN.test(line.trim()) || CANDUMP_HUMAN_PATTERN.test(line))) {
    return 'candump';
  }
  if (lines.some((line) => ASC_HEADER_PATTERN.test(line.trim())) && lines.some((line) => ASC_FRAME_PATTERN.test(line))) {
    return 'vector-asc';
  }

  const delimiter = detectDelimiter(lines);
  const columnCounts = lines.map((line) => splitDelimitedLine(line, delimiter).length);
  const consistent = columnCounts.filter((count) => count >= MIN_DELIMITED_COLUMNS && count === columnCounts[0]).length;
  if (lines.length > 0 && consistent / lines.length >= DELIMITED_CONSISTENCY_RATIO && (columnCounts[0] ?? 0) >= MIN_DELIMITED_COLUMNS) {
    return 'delimited';
  }

  return 'hex-text';
}

const EXTENSION_FORMATS: Readonly<Record<string, LogSourceFormat>> = {
  pcap: 'pcap',
  cap: 'pcap',
  asc: 'vector-asc',
  csv: 'delimited',
  tsv: 'delimited',
  json: 'json',
  ndjson: 'json',
  bin: 'binary',
};

function formatFromExtension(fileName: string | undefined): LogSourceFormat | undefined {
  if (fileName === undefined) return undefined;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_FORMATS[extension];
}

export function detectLogFormat(bytes: Uint8Array, fileName?: string): DetectedLogFormat {
  const magic = readMagicBigEndian(bytes);
  if (magic === PCAPNG_MAGIC) return 'pcapng';
  if (magic !== undefined && PCAP_MAGICS.includes(magic as (typeof PCAP_MAGICS)[number])) return 'pcap';
  if (looksBinary(bytes)) return 'binary';

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const sniffText_ = decoder.decode(bytes.subarray(0, SNIFF_BYTES));
  const sniffed = sniffText(sniffText_);
  // İçerik "genel amaçlı" iki kalıba düştüyse (hex metin / ayraçlı) uzantı
  // hâlâ daha iyi bir bilgi taşıyor olabilir: `.csv` uzantılı bir dosyada
  // tek sütun varsa yine ayraçlı okumak kullanıcının beklentisidir.
  const byExtension = formatFromExtension(fileName);
  if (byExtension !== undefined && (sniffed === 'hex-text' || sniffed === 'delimited')) {
    return byExtension === 'pcap' || byExtension === 'binary' ? sniffed : byExtension;
  }
  return sniffed;
}

export function parseLogFile(input: LogFileInput, options: ParseLogOptions = {}): LogParseResult {
  const maxBytes = options.maxBytes ?? MAX_LOG_FILE_BYTES;
  if (input.bytes.length === 0) {
    return { status: 'error', code: 'empty-input', message: 'Dosya boş.' };
  }
  if (input.bytes.length > maxBytes) {
    return {
      status: 'error',
      code: 'file-too-large',
      message: `Dosya ${Math.round(input.bytes.length / 1024 / 1024)} MB; sınır ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    };
  }

  const format = options.format ?? detectLogFormat(input.bytes, input.fileName);
  if (format === 'pcapng') {
    return {
      status: 'error',
      code: 'unsupported-format',
      message:
        'Bu bir PCAPNG dosyası — klasik pcap savefile\'dan farklı bir format ve henüz desteklenmiyor. Wireshark ile "Wireshark/tcpdump/… - pcap" olarak dışa aktarabilirsiniz.',
    };
  }
  if (format === 'pcap') return parsePcapLog(input.bytes, options);
  if (format === 'binary') return parseBinaryLog(input.bytes, options);

  const text = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes);
  switch (format) {
    case 'candump':
      return parseCandumpLog(text, options);
    case 'vector-asc':
      return parseVectorAscLog(text, options);
    case 'delimited':
      return parseDelimitedLog(text, options);
    case 'json':
      return parseJsonLog(text, options);
    case 'hex-text':
      return parseHexTextLog(text, options);
    default:
      return { status: 'error', code: 'unsupported-format', message: `Bilinmeyen biçim: ${String(format)}` };
  }
}
