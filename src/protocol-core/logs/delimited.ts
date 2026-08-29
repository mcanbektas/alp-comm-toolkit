/**
 * Ayraçlı log ayrıştırıcısı — spec §34'ün "CSV/TXT", "Otomatik delimiter
 * tespiti" ve "Timestamp/Direction/Data/ID sütunu seçme" maddeleri.
 *
 * Üç adım: (1) ayracı bul, (2) sütun rollerini tahmin et, (3) satırları
 * kayda çevir. Her adım AYRI ve saf bir fonksiyondur, çünkü arayüz ikisinin
 * de tahminini kullanıcıya gösterip ELLE değiştirtmek zorunda: otomatik
 * tahmin bir kolaylıktır, doğruluk garantisi değildir.
 *
 * ── KARARLAR ──────────────────────────────────────────────────────────────
 * · Ayraç adayları `,` `;` sekme ve `|`. Seçim "en çok görülen" ile DEĞİL,
 *   "satırlar arasında en TUTARLI sütun sayısını üreten" ile yapılır: veri
 *   alanının içindeki bir virgül tek satırda çok virgül gösterebilir, ama
 *   dosyanın tamamında sütun sayısını oynatır. Tutarlılık yanıltıcı sayıdan
 *   güvenlidir.
 * · Veri BİRDEN ÇOK sütuna yayılmış olabilir (CAN dışa aktarımlarında
 *   `D0…D7` ya da `Byte0…Byte7`). Bu yüzden eşleme tek bir `data` sütunu
 *   değil `dataColumns` DİZİSİ tutar; tek sütunlu hâl bunun özel durumudur.
 * · Başlık satırı yoksa roller DEĞERLERE bakarak tahmin edilir; hiçbir sütun
 *   veri gibi görünmüyorsa ayrıştırma `missing-column` uyarısıyla boş döner —
 *   rastgele bir sütunu veri ilan etmek sessiz çöp üretirdi.
 */

import type { LogParseOptions, LogParseResult, LogRecord } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { ALL_ROLE_KEYWORDS, INDEXED_DATA_PATTERN, ROLE_KEYWORDS, matchesRole } from './columnRoles';
import { inferTimestampKind, readDirection, readHexBytes, readNumber, readTimestampMs, splitLines } from './textTokens';
import { createWarningCollector } from './warnings';

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;
const DELIMITER_SAMPLE_LINES = 20;
const MIN_DATA_BYTES = 1;

export type LogDelimiter = (typeof DELIMITER_CANDIDATES)[number];

export interface LogColumnMapping {
  readonly timestamp: number | undefined;
  readonly direction: number | undefined;
  readonly frameId: number | undefined;
  readonly channel: number | undefined;
  readonly length: number | undefined;
  /** Veri baytlarını taşıyan sütunlar, soldan sağa; boşsa kayıt üretilemez. */
  readonly dataColumns: readonly number[];
}

export interface DelimitedParseOptions extends LogParseOptions {
  readonly delimiter?: LogDelimiter;
  readonly hasHeader?: boolean;
  readonly mapping?: LogColumnMapping;
  /** Kimlik sütununun tabanı; varsayılan 16 (CAN dışa aktarımlarında yaygın). */
  readonly idRadix?: 10 | 16;
}

/**
 * Tırnak bilen satır bölücü. RFC 4180'in tek kuralı uygulanır: çift tırnak
 * içinde ayraç veri sayılır, `""` tek tırnağa kaçırılır. Satır içi yeni satır
 * DESTEKLENMEZ — log dosyalarında görülmez ve desteklemek satır numarasını
 * anlamsız kılardı (kullanıcının hatayı bulmasının tek yolu o numara).
 */
export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char ?? '';
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char ?? '';
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Ayracı seçer: her aday için ilk satırlarda üretilen sütun sayılarının
 * MODU alınır; puan = (modu paylaşan satır sayısı) × (mod − 1). Sütun sayısı
 * 1 olan aday hiç puan almaz (o karakter dosyada yok demektir).
 */
export function detectDelimiter(lines: readonly string[]): LogDelimiter {
  const sample = lines.filter((line) => line.trim().length > 0).slice(0, DELIMITER_SAMPLE_LINES);
  let best: LogDelimiter = ',';
  let bestScore = -1;

  for (const candidate of DELIMITER_CANDIDATES) {
    const counts = new Map<number, number>();
    for (const line of sample) {
      const count = splitDelimitedLine(line, candidate).length;
      counts.set(count, (counts.get(count) ?? 0) + 1);
    }
    let modeCount = 0;
    let modeFrequency = 0;
    for (const [count, frequency] of counts) {
      if (frequency > modeFrequency || (frequency === modeFrequency && count > modeCount)) {
        modeCount = count;
        modeFrequency = frequency;
      }
    }
    const score = modeCount <= 1 ? 0 : modeFrequency * (modeCount - 1);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Başlık satırından rolleri tahmin eder. Aynı rol iki kez eşleşirse İLKİ kazanır. */
export function guessColumnMapping(header: readonly string[]): LogColumnMapping {
  let timestamp: number | undefined;
  let direction: number | undefined;
  let frameId: number | undefined;
  let channel: number | undefined;
  let length: number | undefined;
  const indexedData: number[] = [];
  let plainData: number | undefined;

  header.forEach((name, index) => {
    if (INDEXED_DATA_PATTERN.test(name.trim())) {
      indexedData.push(index);
      return;
    }
    // Sıra önemli: "can id" hem `frameId` hem `channel` sözlüğüne uyabilir,
    // kimlik önce denenir çünkü daha dar bir eşleşmedir.
    if (timestamp === undefined && matchesRole(name, ROLE_KEYWORDS.timestamp)) {
      timestamp = index;
      return;
    }
    if (frameId === undefined && matchesRole(name, ROLE_KEYWORDS.frameId)) {
      frameId = index;
      return;
    }
    if (direction === undefined && matchesRole(name, ROLE_KEYWORDS.direction)) {
      direction = index;
      return;
    }
    if (channel === undefined && matchesRole(name, ROLE_KEYWORDS.channel)) {
      channel = index;
      return;
    }
    if (length === undefined && matchesRole(name, ROLE_KEYWORDS.length)) {
      length = index;
      return;
    }
    if (plainData === undefined && matchesRole(name, ROLE_KEYWORDS.data)) {
      plainData = index;
    }
  });

  const dataColumns = indexedData.length > 0 ? indexedData : plainData === undefined ? [] : [plainData];
  return { timestamp, direction, frameId, channel, length, dataColumns };
}

/**
 * Başlıksız dosyada rolleri DEĞERLERDEN tahmin eder: ilk veri satırında hex
 * bayt dizisi gibi duran EN UZUN sütun veri, zaman damgası okunabilen ilk
 * sütun zaman sayılır.
 */
export function guessMappingFromValues(row: readonly string[]): LogColumnMapping {
  let timestamp: number | undefined;
  let direction: number | undefined;
  let dataColumn: number | undefined;
  let dataBytes = 0;

  row.forEach((cell, index) => {
    if (timestamp === undefined && /[.:]/.test(cell) && readTimestampMs(cell) !== undefined) {
      timestamp = index;
      return;
    }
    if (direction === undefined && readDirection(cell) !== undefined) {
      direction = index;
      return;
    }
    const bytes = readHexBytes(cell);
    if (bytes !== undefined && bytes.length > dataBytes && bytes.length >= MIN_DATA_BYTES) {
      dataBytes = bytes.length;
      dataColumn = index;
    }
  });

  return {
    timestamp,
    direction,
    frameId: undefined,
    channel: undefined,
    length: undefined,
    dataColumns: dataColumn === undefined ? [] : [dataColumn],
  };
}

/** Hücre VERİ gibi mi duruyor: sayı ya da geçerli bir hex bayt dizisi. */
function looksLikeData(cell: string): boolean {
  const trimmed = cell.trim();
  if (trimmed.length === 0) return false;
  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return true;
  return readHexBytes(trimmed) !== undefined;
}

/**
 * Başlık satırı mı? İki ölçüt SIRAYLA denenir:
 *
 *  1. Hücrelerden biri BİLİNEN bir rol adı ya da numaralı bayt sütunu adı mı
 *     (`Time`, `ID`, `D0`)? Öyleyse satır başlıktır.
 *  2. Değilse: hiçbir hücre veri gibi durmuyorsa başlıktır.
 *
 * Birinci ölçüt olmadan `Time;ID;D0;D1` başlığı VERİ sanılırdı — "D0" geçerli
 * bir hex bayttır ve ikinci ölçüt onu veri sayar. Bu, sütun adlarının veri
 * alfabesiyle çakışabildiği her CAN dışa aktarımında sessiz bir kaymaya yol
 * açardı (ilk satır kaybolmaz, sütun adları bayt olarak okunurdu).
 */
function looksLikeHeader(cells: readonly string[]): boolean {
  if (cells.some((cell) => INDEXED_DATA_PATTERN.test(cell.trim()) || matchesRole(cell, ALL_ROLE_KEYWORDS))) {
    return true;
  }
  return cells.some((cell) => cell.trim().length > 0) && !cells.some(looksLikeData);
}

function cellAt(cells: readonly string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const value = cells[index];
  return value === undefined || value.length === 0 ? undefined : value;
}

export function parseDelimitedLog(text: string, options: DelimitedParseOptions = {}): LogParseResult {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const idRadix = options.idRadix ?? 16;
  const lines = splitLines(text).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { status: 'error', code: 'empty-input', message: 'Dosya boş.' };
  }

  const delimiter = options.delimiter ?? detectDelimiter(lines);
  const rows = lines.map((line) => splitDelimitedLine(line, delimiter));
  const firstRow = rows[0] ?? [];
  const hasHeader = options.hasHeader ?? looksLikeHeader(firstRow);
  const bodyStart = hasHeader ? 1 : 0;
  const mapping =
    options.mapping ?? (hasHeader ? guessColumnMapping(firstRow) : guessMappingFromValues(rows[0] ?? []));

  if (mapping.dataColumns.length === 0) {
    return {
      status: 'error',
      code: 'missing-data-column',
      message: 'Veri sütunu bulunamadı — sütun eşlemesini elle seçin.',
    };
  }

  const warnings = createWarningCollector();
  const records: LogRecord[] = [];
  let limitReached = false;

  for (let i = bodyStart; i < rows.length; i++) {
    if (records.length >= maxRecords) {
      limitReached = true;
      warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`, i + 1);
      break;
    }
    const cells = rows[i] ?? [];
    const dataText = mapping.dataColumns
      .map((column) => cells[column] ?? '')
      .join(' ')
      .trim();
    const data = readHexBytes(dataText);
    if (data === undefined || data.length === 0) {
      warnings.add('bad-hex', `Veri sütunu onaltılık okunamadı: "${dataText.slice(0, 80)}"`, i + 1);
      continue;
    }

    const idText = cellAt(cells, mapping.frameId);
    const lengthText = cellAt(cells, mapping.length);
    const declaredLength = lengthText === undefined ? undefined : readNumber(lengthText, 10);

    records.push({
      index: records.length,
      line: i + 1,
      timestamp: readTimestampMs(cellAt(cells, mapping.timestamp) ?? ''),
      direction: readDirection(cellAt(cells, mapping.direction) ?? ''),
      channel: cellAt(cells, mapping.channel),
      frameId: idText,
      frameIdValue: idText === undefined ? undefined : readNumber(idText, idRadix),
      data,
      originalLength: declaredLength ?? data.length,
      flags: [],
    });
  }

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'Seçili sütun eşlemesiyle okunabilen satır yok.' };
  }

  const delimiterLabel = delimiter === '\t' ? 'sekme' : delimiter;
  return {
    status: 'ok',
    summary: {
      format: 'delimited',
      timestampKind: inferTimestampKind(records[0]?.timestamp),
      recordCount: records.length,
      totalLines: lines.length,
      skippedLines: warnings.countOf('bad-hex'),
      limitReached,
      detail: `ayraç "${delimiterLabel}"${hasHeader ? ' · başlık satırı var' : ''}`,
    },
    records,
    warnings: warnings.list(),
  };
}
