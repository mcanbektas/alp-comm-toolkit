/**
 * Log istatistiği ve zaman çizgisi (spec §34 "Statistics", "Timeline").
 *
 * `statistics/commStatistics.ts` BİLEREK kullanılmıyor: o modül CANLI akış
 * için yazıldı — `FrameObservation.direction` ZORUNLU ve saat `performance.now()`
 * tabanlı. Logda yön çoğu zaman yoktur ve damga epoch ms'dir. Yönü doldurmak
 * için `'rx'` uydurmak gerekirdi ki bu tam da `types.ts`te reddedilen şey.
 * Sayısal özetler yine ortak motordan (`computeSignalStatistics`) gelir;
 * tekrar yazılan tek şey sayımlardır.
 */

import { computeSignalStatistics } from '../statistics/signalStatistics';
import type { SignalStatistics } from '../statistics/signalStatistics';
import type { LogRecord, LogRecordFlag } from './types';

const MILLISECONDS_PER_SECOND = 1000;
/** Kanal/kimlik dağılımında gösterilecek en çok satır; kalanı "diğer" sayılır. */
export const TOP_GROUP_LIMIT = 12;

export interface LogGroupCount {
  readonly key: string;
  readonly count: number;
  readonly bytes: number;
}

export interface LogStatistics {
  readonly recordCount: number;
  /** Telde geçen toplam bayt (`originalLength` toplamı). */
  readonly totalBytes: number;
  /** Dosyada gerçekten bulunan bayt — kesilmiş yakalamada toplamdan küçüktür. */
  readonly capturedBytes: number;
  readonly rxCount: number;
  readonly txCount: number;
  readonly unknownDirectionCount: number;
  readonly truncatedCount: number;
  readonly flagCounts: Readonly<Partial<Record<LogRecordFlag, number>>>;
  readonly length: SignalStatistics;
  /** Ardışık kayıtlar arası süre (ms); ortalama = ortalama periyot, sapma = seğirme. */
  readonly interval: SignalStatistics;
  readonly firstTimestamp: number | undefined;
  readonly lastTimestamp: number | undefined;
  readonly durationMs: number | undefined;
  /** Kayıt/saniye; süre sıfır ya da bilinmiyorsa `undefined` — sıfıra bölme uydurulmaz. */
  readonly averageRate: number | undefined;
  readonly channels: readonly LogGroupCount[];
  readonly frameIds: readonly LogGroupCount[];
  /** Gruplanan farklı anahtar sayısı; listeler `TOP_GROUP_LIMIT` ile kırpılmış olabilir. */
  readonly channelCount: number;
  readonly frameIdCount: number;
}

function topGroups(counts: Map<string, { count: number; bytes: number }>): LogGroupCount[] {
  return Array.from(counts, ([key, value]) => ({ key, count: value.count, bytes: value.bytes }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, TOP_GROUP_LIMIT);
}

export function computeLogStatistics(records: readonly LogRecord[]): LogStatistics {
  const lengths: number[] = [];
  const intervals: number[] = [];
  const channels = new Map<string, { count: number; bytes: number }>();
  const frameIds = new Map<string, { count: number; bytes: number }>();
  const flagCounts: Partial<Record<LogRecordFlag, number>> = {};

  let totalBytes = 0;
  let capturedBytes = 0;
  let rxCount = 0;
  let txCount = 0;
  let truncatedCount = 0;
  let firstTimestamp: number | undefined;
  let lastTimestamp: number | undefined;
  let previousTimestamp: number | undefined;

  for (const record of records) {
    totalBytes += record.originalLength;
    capturedBytes += record.data.length;
    lengths.push(record.originalLength);

    if (record.direction === 'rx') rxCount += 1;
    else if (record.direction === 'tx') txCount += 1;

    for (const flag of record.flags) {
      flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
      if (flag === 'truncated') truncatedCount += 1;
    }

    if (record.channel !== undefined) {
      const entry = channels.get(record.channel) ?? { count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += record.originalLength;
      channels.set(record.channel, entry);
    }
    if (record.frameId !== undefined) {
      const entry = frameIds.get(record.frameId) ?? { count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += record.originalLength;
      frameIds.set(record.frameId, entry);
    }

    if (record.timestamp !== undefined) {
      firstTimestamp ??= record.timestamp;
      lastTimestamp = record.timestamp;
      if (previousTimestamp !== undefined) intervals.push(record.timestamp - previousTimestamp);
      previousTimestamp = record.timestamp;
    }
  }

  const durationMs =
    firstTimestamp === undefined || lastTimestamp === undefined ? undefined : lastTimestamp - firstTimestamp;
  const averageRate =
    durationMs === undefined || durationMs <= 0
      ? undefined
      : (records.length / durationMs) * MILLISECONDS_PER_SECOND;

  return {
    recordCount: records.length,
    totalBytes,
    capturedBytes,
    rxCount,
    txCount,
    unknownDirectionCount: records.length - rxCount - txCount,
    truncatedCount,
    flagCounts,
    length: computeSignalStatistics(lengths),
    interval: computeSignalStatistics(intervals),
    firstTimestamp,
    lastTimestamp,
    durationMs,
    averageRate,
    channels: topGroups(channels),
    frameIds: topGroups(frameIds),
    channelCount: channels.size,
    frameIdCount: frameIds.size,
  };
}

export interface TimelineBucket {
  readonly startMs: number;
  readonly endMs: number;
  readonly count: number;
  readonly bytes: number;
}

/**
 * Zaman çizgisi kovaları. Damgası olmayan kayıtlar SAYILMAZ — onları ilk
 * kovaya doldurmak, olmayan bir yığılma gösterirdi. Tüm kayıtlar aynı ana
 * düşüyorsa tek kova döner (sıfır genişlikli aralığa bölme yapılmaz).
 */
export function buildTimeline(records: readonly LogRecord[], bucketCount: number): TimelineBucket[] {
  const stamped = records.filter((record) => record.timestamp !== undefined);
  if (stamped.length === 0 || bucketCount <= 0) return [];

  const timestamps = stamped.map((record) => record.timestamp ?? 0);
  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);
  if (end === start) {
    return [{ startMs: start, endMs: start, count: stamped.length, bytes: stamped.reduce((sum, r) => sum + r.originalLength, 0) }];
  }

  const width = (end - start) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_unused, index) => ({
    startMs: start + index * width,
    endMs: start + (index + 1) * width,
    count: 0,
    bytes: 0,
  }));

  for (const record of stamped) {
    const offset = (record.timestamp ?? start) - start;
    // Son kaydın kendisi üst sınırdadır; taşmasın diye son kovaya sabitlenir.
    const index = Math.min(bucketCount - 1, Math.floor(offset / width));
    const bucket = buckets[index];
    if (bucket === undefined) continue;
    bucket.count += 1;
    bucket.bytes += record.originalLength;
  }

  return buckets;
}
