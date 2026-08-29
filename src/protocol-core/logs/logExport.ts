/**
 * Filtrelenmiş kayıtların CSV'ye aktarımı (spec §34 "Export"). Dışa aktarma
 * TARAYICIDA yapılır ve dosya kullanıcının makinesinden çıkmaz (spec §41).
 *
 * Alıntılama kuralı RFC 4180: ayraç, çift tırnak ya da satır sonu içeren
 * hücre tırnaklanır, içerideki tırnak ikilenir. Bu olmadan veri alanındaki
 * tek bir virgül dışa aktarılan dosyanın sütun düzenini kaydırırdı.
 */

import { bytesToHex } from '../buffers/representation';
import type { LogRecord, LogTimestampKind } from './types';

const CSV_DELIMITER = ',';
const CSV_HEADER = ['index', 'line', 'timestamp', 'direction', 'channel', 'id', 'length', 'captured', 'flags', 'data'];
const NEEDS_QUOTE_PATTERN = /[",\r\n]/;

function quote(value: string): string {
  return NEEDS_QUOTE_PATTERN.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Damgayı metne çevirir. MUTLAK damga ISO 8601 yazılır (elektronik tabloda
 * tarih olarak okunur), göreli damga ham milisaniye kalır — göreli bir değeri
 * tarihe çevirmek 1970'i gösterirdi.
 */
function formatTimestamp(timestamp: number | undefined, kind: LogTimestampKind): string {
  if (timestamp === undefined) return '';
  if (kind !== 'absolute') return String(timestamp);
  return new Date(timestamp).toISOString();
}

export function recordsToCsv(records: readonly LogRecord[], timestampKind: LogTimestampKind): string {
  const lines = [CSV_HEADER.join(CSV_DELIMITER)];
  for (const record of records) {
    lines.push(
      [
        String(record.index),
        record.line === undefined ? '' : String(record.line),
        formatTimestamp(record.timestamp, timestampKind),
        record.direction ?? '',
        record.channel ?? '',
        record.frameId ?? '',
        String(record.originalLength),
        String(record.data.length),
        record.flags.join(' '),
        bytesToHex(record.data),
      ]
        .map(quote)
        .join(CSV_DELIMITER),
    );
  }
  return lines.join('\n');
}
