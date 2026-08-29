/**
 * JSON log ayrıştırıcısı (spec §34 "JSON"). İki yazım tanınır:
 *
 *   · Tek bir JSON dizisi:      [ { "ts": 0.1, "id": "123", "data": "DEADBEEF" }, … ]
 *   · Satır başına bir nesne (NDJSON / JSON Lines).
 *
 * Bir NESNE de kabul edilir; içindeki ilk dizi alanı kayıt listesi sayılır
 * (`{"frames": [...]}` gibi sarmalayıcılar yaygındır).
 *
 * ── KARARLAR ──────────────────────────────────────────────────────────────
 * · Anahtar adları serbesttir; roller `columnRoles.ts` sözlüğüyle eşlenir —
 *   CSV başlıklarıyla aynı sözlük, çünkü aynı adlandırma alışkanlığı.
 * · Veri alanı hem hex METİN ("DEADBEEF", "DE AD BE EF") hem SAYI DİZİSİ
 *   ([222, 173, 190, 239]) olabilir. Sayı dizisinde 0-255 dışına çıkan
 *   eleman kaydı bozuk sayar — sessizce maskelemek (`& 0xff`) telde olmayan
 *   bir bayt uydururdu.
 * · Sayısal zaman damgasının BİRİMİ dosyada yazmaz. Eşik: 1e11'den büyük
 *   değer zaten milisaniyedir (1973 sonrası epoch ms), küçük değer saniyedir
 *   ve 1000 ile çarpılır. Bu eşik olmadan "1637856000" (epoch saniye) ile
 *   "1637856000123" (epoch ms) ayırt edilemezdi.
 */

import type { LogParseOptions, LogParseResult, LogRecord } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { ROLE_KEYWORDS, matchesRole } from './columnRoles';
import { inferTimestampKind, readDirection, readHexBytes, readNumber, readTimestampMs, splitLines } from './textTokens';
import { createWarningCollector } from './warnings';

const SECONDS_TO_MILLISECONDS = 1000;
/** Bunun üstündeki sayısal damga zaten milisaniyedir (bkz. dosya başı). */
const MILLISECOND_TIMESTAMP_THRESHOLD = 100_000_000_000;
const MAX_BYTE_VALUE = 255;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rolü karşılayan İLK anahtarın değerini döner; anahtar sırası nesnedeki sıradır. */
function pick(object: JsonObject, keywords: readonly string[]): JsonValue | undefined {
  for (const key of Object.keys(object)) {
    if (matchesRole(key, keywords)) return object[key];
  }
  return undefined;
}

function readJsonTimestamp(value: JsonValue | undefined): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return Math.abs(value) >= MILLISECOND_TIMESTAMP_THRESHOLD ? value : value * SECONDS_TO_MILLISECONDS;
  }
  if (typeof value === 'string') return readTimestampMs(value);
  return undefined;
}

function readJsonData(value: JsonValue | undefined): Uint8Array | undefined {
  if (typeof value === 'string') return readHexBytes(value);
  if (!Array.isArray(value)) return undefined;

  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const element = value[i];
    if (typeof element !== 'number' || !Number.isInteger(element) || element < 0 || element > MAX_BYTE_VALUE) {
      return undefined;
    }
    bytes[i] = element;
  }
  return bytes;
}

function readJsonText(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value.length === 0 ? undefined : value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/** Kaynak metinden kayıt nesnelerini çıkarır; iki yazım da denenir. */
function readEntries(text: string): JsonObject[] | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;

  try {
    const parsed: JsonValue = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter(isJsonObject);
    if (isJsonObject(parsed)) {
      for (const key of Object.keys(parsed)) {
        const value = parsed[key];
        if (Array.isArray(value)) return value.filter(isJsonObject);
      }
      return [parsed];
    }
    return undefined;
  } catch {
    // Tek gövde JSON değilse NDJSON denenir — satır satır ayrıştırma bir
    // sonraki adımda, satır numarası korunarak yapılır.
  }

  const entries: JsonObject[] = [];
  for (const line of splitLines(text)) {
    if (line.trim().length === 0) continue;
    try {
      const parsed: JsonValue = JSON.parse(line);
      if (isJsonObject(parsed)) entries.push(parsed);
    } catch {
      // NDJSON'da bozuk satır atlanır; sayımı çağıran yapar.
      entries.push({});
    }
  }
  return entries.length === 0 ? undefined : entries;
}

export function parseJsonLog(text: string, options: LogParseOptions = {}): LogParseResult {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const entries = readEntries(text);
  if (entries === undefined) {
    return { status: 'error', code: 'empty-input', message: 'Dosya JSON dizisi ya da JSON Lines olarak okunamadı.' };
  }

  const warnings = createWarningCollector();
  const records: LogRecord[] = [];
  let limitReached = false;

  for (let i = 0; i < entries.length; i++) {
    if (records.length >= maxRecords) {
      limitReached = true;
      warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`, i + 1);
      break;
    }
    const entry = entries[i] ?? {};
    const data = readJsonData(pick(entry, ROLE_KEYWORDS.data));
    if (data === undefined || data.length === 0) {
      warnings.add('bad-hex', `Kaydın veri alanı okunamadı (${i + 1}. kayıt).`, i + 1);
      continue;
    }

    const idText = readJsonText(pick(entry, ROLE_KEYWORDS.frameId));
    const lengthText = readJsonText(pick(entry, ROLE_KEYWORDS.length));

    records.push({
      index: records.length,
      line: i + 1,
      timestamp: readJsonTimestamp(pick(entry, ROLE_KEYWORDS.timestamp)),
      direction: readDirection(readJsonText(pick(entry, ROLE_KEYWORDS.direction)) ?? ''),
      channel: readJsonText(pick(entry, ROLE_KEYWORDS.channel)),
      frameId: idText,
      frameIdValue: idText === undefined ? undefined : readNumber(idText, 16),
      data,
      originalLength: lengthText === undefined ? data.length : (readNumber(lengthText, 10) ?? data.length),
      flags: [],
    });
  }

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'JSON kayıtlarının hiçbirinde okunabilir veri alanı yok.' };
  }

  return {
    status: 'ok',
    summary: {
      format: 'json',
      timestampKind: inferTimestampKind(records[0]?.timestamp),
      recordCount: records.length,
      totalLines: undefined,
      skippedLines: warnings.countOf('bad-hex'),
      limitReached,
      detail: undefined,
    },
    records,
    warnings: warnings.list(),
  };
}
