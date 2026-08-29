/**
 * Serbest metin hex log ayrıştırıcısı — spec §34'ün "Serial terminal logs" ve
 * "Custom timestamped logs" maddeleri. candump/ASC gibi TEK bir üreticiden
 * çıkmadığı için sabit bir gramer yok; tanınan satır ŞU sırayla okunur:
 *
 *   [zaman]  [yön]  <hex baytlar…>
 *
 * Örnekler (hepsi tanınır):
 *   [00:00:01.234] TX: 41 54 0D 0A
 *   12:34:56.789 RX 0A 0B 0C
 *   0.001500 -> DEADBEEF
 *   AA 55 01 02 03
 *
 * ── AYRIM KURALLARI (koddan okunmayan kısım) ──────────────────────────────
 * · ÇIPLAK TAM SAYI ASLA zaman damgası sayılmaz. "01" hem bir bayt hem de bir
 *   saniye değeri gibi okunabilir; ikisinden birini seçmek zorunda kalınca
 *   BAYT seçilir, çünkü verisiz bir log satırının anlamı yoktur. Zaman
 *   damgası sayılabilmesi için ya köşeli parantez içinde olmalı, ya kesir
 *   ayracı (`0.0015`) ya da saat iki noktası (`12:34:56`) taşımalıdır.
 * · Yön işaretçisi opsiyoneldir ve BULUNAMAZSA `undefined` bırakılır — hiçbir
 *   satırda yön yoksa istatistik rx/tx dağılımını "bilinmiyor" gösterir,
 *   hepsini `rx` sayıp uydurmaz.
 * · Bayt dizisi hem ayraçlı (`41 54 0D`) hem bitişik (`41540D`) yazılabilir;
 *   bitişik yazımda TEK haneli kalıntı satırı bozuk sayar (yarım bayt).
 * · Hiç hex baytı olmayan satır (banner, komut yankısı, boş satır) atlanır.
 */

import type { LogParseOptions, LogParseResult, LogRecord } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { inferTimestampKind, readDirection, readHexBytes, readTimestampMs, splitLines } from './textTokens';
import { createWarningCollector } from './warnings';

/** Köşeli parantezli önek: `[00:00:01.234]`, `[RX]`, `[can0]`. */
const BRACKET_PATTERN = /^\[([^\]]*)\]\s*/;
/** Zaman damgası sayılabilmesi için gereken en az bir kesir/saat işareti. */
const TIMESTAMP_SHAPE_PATTERN = /^-?\d+[.,:]\d/;
/** Tek bir hex bayt ya da bitişik hex dizisi (çift hane). */
const HEX_TOKEN_PATTERN = /^(?:0[xX])?[0-9a-fA-F]+$/;

const MIN_HEX_TOKEN_LENGTH = 2;

interface ScannedLine {
  readonly timestamp: number | undefined;
  readonly direction: 'rx' | 'tx' | undefined;
  readonly channel: string | undefined;
  readonly data: Uint8Array | undefined;
  /** Satırda hiç veri yoksa `true` — uyarı ÜRETİLMEZ, sessizce atlanır. */
  readonly empty: boolean;
}

function isTimestampToken(token: string): boolean {
  return TIMESTAMP_SHAPE_PATTERN.test(token) || /^\d{1,2}:\d{2}:\d{2}/.test(token) || /^\d{4}-\d{2}-\d{2}/.test(token);
}

function isHexToken(token: string): boolean {
  const stripped = token.replace(/^0[xX]/, '');
  return stripped.length >= MIN_HEX_TOKEN_LENGTH && HEX_TOKEN_PATTERN.test(stripped);
}

/** Köşeli parantez içeriğini zaman/yön/kanal olarak dener; hiçbiri değilse kanal sayar. */
function applyBracket(content: string, scanned: { timestamp?: number; direction?: 'rx' | 'tx'; channel?: string }): void {
  const trimmed = content.trim();
  if (trimmed.length === 0) return;
  const direction = readDirection(trimmed);
  if (direction !== undefined) {
    scanned.direction ??= direction;
    return;
  }
  const timestamp = readTimestampMs(trimmed);
  if (timestamp !== undefined) {
    scanned.timestamp ??= timestamp;
    return;
  }
  scanned.channel ??= trimmed;
}

function scanLine(rawLine: string): ScannedLine {
  const scanned: { timestamp?: number; direction?: 'rx' | 'tx'; channel?: string } = {};

  let rest = rawLine.trim();
  let bracket = BRACKET_PATTERN.exec(rest);
  while (bracket !== null) {
    applyBracket(bracket[1] ?? '', scanned);
    rest = rest.slice(bracket[0].length);
    bracket = BRACKET_PATTERN.exec(rest);
  }

  const tokens = rest.split(/\s+/).filter((token) => token.length > 0);
  let cursor = 0;
  while (cursor < tokens.length) {
    const token = tokens[cursor] ?? '';
    if (scanned.timestamp === undefined && isTimestampToken(token)) {
      scanned.timestamp = readTimestampMs(token);
      cursor += 1;
      continue;
    }
    const direction = readDirection(token);
    if (direction !== undefined && scanned.direction === undefined) {
      scanned.direction = direction;
      cursor += 1;
      continue;
    }
    break;
  }

  const dataTokens = tokens.slice(cursor);
  const hexTokenCount = dataTokens.filter(isHexToken).length;
  // Hiçbir token hex değilse satır düz metindir (banner, komut yankısı,
  // yardım çıktısı): sessizce atlanır. UYARI yalnız hex OLMAYA ÇALIŞIP
  // başaramayan satırlarda üretilir — aksi hâlde 100 bin satırlık bir
  // terminal dökümünde uyarı listesi metnin kendisi olurdu.
  if (hexTokenCount === 0) {
    return { timestamp: scanned.timestamp, direction: scanned.direction, channel: scanned.channel, data: undefined, empty: true };
  }
  const data = hexTokenCount === dataTokens.length ? readHexBytes(dataTokens.join(' ')) : undefined;

  return {
    timestamp: scanned.timestamp,
    direction: scanned.direction,
    channel: scanned.channel,
    data,
    empty: false,
  };
}

export function parseHexTextLog(text: string, options: LogParseOptions = {}): LogParseResult {
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

    const scanned = scanLine(line);
    if (scanned.data === undefined) {
      // Veri taşımayan satır (banner, komut yankısı) hata değildir; yalnız
      // hex GİBİ görünüp okunamayan satır uyarı üretir.
      if (!scanned.empty) {
        warnings.add('bad-hex', `Satırdaki veri onaltılık okunamadı: "${line.trim().slice(0, 80)}"`, i + 1);
      }
      continue;
    }
    if (scanned.data.length === 0) continue;

    records.push({
      index: records.length,
      line: i + 1,
      timestamp: scanned.timestamp,
      direction: scanned.direction,
      channel: scanned.channel,
      frameId: undefined,
      frameIdValue: undefined,
      data: scanned.data,
      originalLength: scanned.data.length,
      flags: [],
    });
  }

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'Dosyada onaltılık veri taşıyan satır bulunamadı.' };
  }

  return {
    status: 'ok',
    summary: {
      format: 'hex-text',
      timestampKind: inferTimestampKind(records[0]?.timestamp),
      recordCount: records.length,
      totalLines: lines.length,
      skippedLines: warnings.countOf('bad-hex'),
      limitReached,
      detail: undefined,
    },
    records,
    warnings: warnings.list(),
  };
}
