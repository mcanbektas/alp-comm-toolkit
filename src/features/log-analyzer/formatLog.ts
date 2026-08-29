/**
 * Log Analyzer'ın gösterim biçimlendiricileri. Saf fonksiyonlardır ve
 * bileşenlerden AYRI durur, çünkü "damga nasıl yazılır" kararı testi olan bir
 * karardır: göreli bir damgayı saat gibi basmak (1970) bu ekranda görülen en
 * kolay hatadır.
 */

import type { LogTimestampKind } from '@/protocol-core/logs/types';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const BYTES_PER_KIB = 1024;
const DECIMALS = 3;

export const UNKNOWN_PLACEHOLDER = '—';

/**
 * Damgayı kaynağın anlamına göre yazar:
 *  · `absolute` → yerel saat (`HH:MM:SS.mmm`) — epoch ms'dir, tarih gerçektir.
 *  · `relative` → dosya başından geçen süre (`s.mmm`) — saate ÇEVRİLMEZ.
 *  · `none`     → damga yok.
 */
export function formatRecordTimestamp(timestamp: number | undefined, kind: LogTimestampKind): string {
  if (timestamp === undefined || kind === 'none') return UNKNOWN_PLACEHOLDER;
  if (kind === 'relative') return `${(timestamp / MILLISECONDS_PER_SECOND).toFixed(DECIMALS)} s`;

  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) return UNKNOWN_PLACEHOLDER;
  if (durationMs < MILLISECONDS_PER_SECOND) return `${durationMs.toFixed(1)} ms`;
  const totalSeconds = durationMs / MILLISECONDS_PER_SECOND;
  if (totalSeconds < SECONDS_PER_MINUTE) return `${totalSeconds.toFixed(2)} s`;
  // Dakika ve üstü `m:ss.s` yazılır — sözcük kullanılmaz, çünkü görünen her
  // metnin çeviriden geçmesi gerekir ve bu bir SAYI biçimidir, cümle değil.
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds - minutes * SECONDS_PER_MINUTE;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function formatByteSize(bytes: number | undefined): string {
  if (bytes === undefined) return UNKNOWN_PLACEHOLDER;
  if (bytes < BYTES_PER_KIB) return `${bytes} B`;
  const kib = bytes / BYTES_PER_KIB;
  if (kib < BYTES_PER_KIB) return `${kib.toFixed(1)} KB`;
  return `${(kib / BYTES_PER_KIB).toFixed(2)} MB`;
}

export function formatRate(perSecond: number | undefined): string {
  if (perSecond === undefined) return UNKNOWN_PLACEHOLDER;
  return `${perSecond.toFixed(perSecond < 10 ? 2 : 0)} /s`;
}

export function formatMilliseconds(value: number | undefined): string {
  if (value === undefined) return UNKNOWN_PLACEHOLDER;
  return `${value.toFixed(DECIMALS)} ms`;
}

export function formatCount(value: number | undefined): string {
  return value === undefined ? UNKNOWN_PLACEHOLDER : String(value);
}
