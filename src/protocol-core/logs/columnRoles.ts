/**
 * Sütun/anahtar ADI → rol sözlüğü. Hem ayraçlı dosyaların başlık satırı hem
 * de JSON nesnelerinin anahtarları aynı adlandırma alışkanlıklarını taşır
 * ("Timestamp", "CAN ID", "Veri"); sözlüğü tek yerde tutmak, bir eş anlamlı
 * eklenince iki ayrıştırıcının birden kazanmasını sağlar.
 */

export const ROLE_KEYWORDS = {
  timestamp: ['timestamp', 'time', 'zaman', 'tarih', 'date', 'ts'],
  direction: ['direction', 'dir', 'yon', 'yön', 'io', 'rx/tx'],
  frameId: ['id', 'canid', 'can id', 'can_id', 'msgid', 'msg id', 'arbitration', 'kimlik', 'pgn'],
  channel: ['channel', 'kanal', 'bus', 'interface', 'iface', 'port', 'device'],
  length: ['length', 'len', 'dlc', 'uzunluk', 'size', 'boyut'],
  data: ['data', 'veri', 'payload', 'bytes', 'byte', 'hex', 'frame', 'message'],
} as const;

export const ALL_ROLE_KEYWORDS: readonly string[] = Object.values(ROLE_KEYWORDS).flat();

/** `D0`, `Byte3`, `data[2]` gibi numaralı veri sütunları. */
export const INDEXED_DATA_PATTERN = /^(?:d|b|byte|data)\s*[[_]?(\d+)\]?$/i;

export function matchesRole(name: string, keywords: readonly string[]): boolean {
  const normalized = name.trim().toLowerCase();
  return keywords.some(
    (keyword) => normalized === keyword || normalized.startsWith(`${keyword} `) || normalized.includes(keyword),
  );
}
