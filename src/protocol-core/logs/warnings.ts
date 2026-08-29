/**
 * Uyarı toplayıcı. 100 bin satırlık bir logda bozuk satır da 100 bin tane
 * olabilir; her biri için ayrı bir uyarı nesnesi üretmek hem belleği hem
 * arayüzü boğar. Toplayıcı uyarıyı KOD BAŞINA teker: ilk görülen satır
 * numarası ve örnek mesaj saklanır, sonrası yalnız sayaç artırır.
 */

import type { LogWarning, LogWarningCode } from './types';

export interface WarningCollector {
  add(code: LogWarningCode, message: string, line?: number): void;
  /** Toplam olay sayısı (tekilleştirilmemiş) — atlanan satır sayacı buradan okunur. */
  countOf(code: LogWarningCode): number;
  list(): LogWarning[];
}

export function createWarningCollector(): WarningCollector {
  const byCode = new Map<LogWarningCode, { message: string; line: number | undefined; count: number }>();

  return {
    add(code, message, line) {
      const existing = byCode.get(code);
      if (existing === undefined) {
        byCode.set(code, { message, line, count: 1 });
        return;
      }
      existing.count += 1;
    },
    countOf(code) {
      return byCode.get(code)?.count ?? 0;
    },
    list() {
      return Array.from(byCode, ([code, entry]) => {
        const warning: LogWarning = entry.line === undefined
          ? { code, message: entry.message, count: entry.count }
          : { code, message: entry.message, line: entry.line, count: entry.count };
        return warning;
      });
    },
  };
}
