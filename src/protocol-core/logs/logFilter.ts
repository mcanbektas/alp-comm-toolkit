/**
 * Kayıt filtresi (spec §34 "Error filtering" ve genel filtreleme).
 *
 * Saf ve TEK GEÇİŞLİDİR: 200 bin kayıtta her ölçüt için ayrı `filter` zinciri
 * kurmak diziyi ölçüt sayısı kadar kopyalardı. Tanımsız alanlar "bu ölçüt
 * yok" demektir; bir ölçüt verildiyse ve kayıtta o alan `undefined` ise kayıt
 * ELENİR — "bilinmiyor"u eşleşme saymak, yön filtresini işe yaramaz kılardı.
 */

import { bytesToHex } from '../buffers/representation';
import type { FrameDirection } from '../types';
import type { LogRecord, LogRecordFlag } from './types';

export interface LogFilter {
  readonly channel?: string;
  readonly frameId?: string;
  readonly direction?: FrameDirection;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly fromMs?: number;
  readonly toMs?: number;
  readonly flag?: LogRecordFlag;
  /** Veride aranan onaltılık dizi; ayraçlar yok sayılır, büyük/küçük harf ayrımı yok. */
  readonly hexContains?: string;
}

const HEX_CLEAN_PATTERN = /[^0-9a-fA-F]/g;

export function normalizeHexQuery(query: string): string {
  return query.replace(HEX_CLEAN_PATTERN, '').toUpperCase();
}

export function isFilterEmpty(filter: LogFilter): boolean {
  return (
    filter.channel === undefined &&
    filter.frameId === undefined &&
    filter.direction === undefined &&
    filter.minLength === undefined &&
    filter.maxLength === undefined &&
    filter.fromMs === undefined &&
    filter.toMs === undefined &&
    filter.flag === undefined &&
    (filter.hexContains === undefined || normalizeHexQuery(filter.hexContains).length === 0)
  );
}

export function applyLogFilter(records: readonly LogRecord[], filter: LogFilter): LogRecord[] {
  if (isFilterEmpty(filter)) return [...records];
  const hexQuery = filter.hexContains === undefined ? '' : normalizeHexQuery(filter.hexContains);

  return records.filter((record) => {
    if (filter.channel !== undefined && record.channel !== filter.channel) return false;
    if (filter.frameId !== undefined && record.frameId !== filter.frameId) return false;
    if (filter.direction !== undefined && record.direction !== filter.direction) return false;
    if (filter.flag !== undefined && !record.flags.includes(filter.flag)) return false;
    if (filter.minLength !== undefined && record.originalLength < filter.minLength) return false;
    if (filter.maxLength !== undefined && record.originalLength > filter.maxLength) return false;
    if (filter.fromMs !== undefined && (record.timestamp === undefined || record.timestamp < filter.fromMs)) return false;
    if (filter.toMs !== undefined && (record.timestamp === undefined || record.timestamp > filter.toMs)) return false;
    if (hexQuery.length > 0 && !bytesToHex(record.data).includes(hexQuery)) return false;
    return true;
  });
}
