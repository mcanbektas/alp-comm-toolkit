/**
 * Kayıt biçimleme ve dışa aktarma — spec §8.2 görüntüleme kipleri, §8.3 mesaj
 * alanları, §5 "JSON/CSV/TXT dışa aktarma".
 *
 * Saf fonksiyonlar: bileşenler yalnız çağırır. Böylece "HEX kipinde ne
 * görünüyor" sorusu tarayıcı açmadan sınanabiliyor.
 */

import type { MonitorRecord, DisplayMode, TimestampResolution } from './types';
import { isFrameRecord } from './types';
import type { SignalTap } from './signalTaps';

const HEX_DIGITS = 2;
const BINARY_DIGITS = 8;
const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;
/** Yazdırılamayan baytın yerine konan simge — hex dökümlerinin evrensel kuralı. */
const NON_PRINTABLE = '.';

function toHex(byte: number): string {
  return byte.toString(16).padStart(HEX_DIGITS, '0').toUpperCase();
}

function toPrintableAscii(byte: number): string {
  return byte >= PRINTABLE_MIN && byte <= PRINTABLE_MAX ? String.fromCharCode(byte) : NON_PRINTABLE;
}

export function formatBytesForDisplay(bytes: Uint8Array, mode: DisplayMode): string {
  switch (mode) {
    case 'hex':
      return Array.from(bytes, toHex).join(' ');
    case 'ascii':
      return Array.from(bytes, toPrintableAscii).join('');
    case 'utf8':
      return decodeUtf8(bytes);
    case 'decimal':
      return Array.from(bytes, (byte) => String(byte)).join(' ');
    case 'binary':
      return Array.from(bytes, (byte) => byte.toString(2).padStart(BINARY_DIGITS, '0')).join(' ');
    case 'mixed':
      // Spec §8.2 "Mixed HEX and ASCII" — klasik hex dump düzeni.
      return `${Array.from(bytes, toHex).join(' ')}  |${Array.from(bytes, toPrintableAscii).join('')}|`;
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  // `fatal: false`: canlı akışta çerçeve ortasından bölünmüş çok baytlı dizi
  // olağandır; çözücünün atması bütün satırı kaybettirirdi. Geçersiz dizi
  // U+FFFD olur, kontrol karakterleri okunabilirlik için nokta.
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return Array.from(decoded, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < PRINTABLE_MIN || code === 0x7f ? NON_PRINTABLE : character;
  }).join('');
}

/**
 * Spec §8.3'ün `09:42:15.102` biçimi. Girdi EPOCH milisaniyesidir
 * (`performance.timeOrigin + performance.now()`), yani akışın her yerinde
 * kullanılan tek zaman tabanı — bkz. `connection/types.ts`.
 */
export function formatTimestamp(epochMs: number, resolution: TimestampResolution): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (resolution === 'us') {
    // `performance.now()` kesirli milisaniye taşır; mikrosaniye çözünürlüğü o
    // kesirden gelir, Date nesnesi bu bilgiyi zaten kaybetmiştir.
    const microseconds = Math.floor((epochMs - Math.floor(epochMs / 1000) * 1000) * 1000);
    return `${hours}:${minutes}:${seconds}.${String(microseconds).padStart(6, '0')}`;
  }

  return `${hours}:${minutes}:${seconds}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export interface ExportOptions {
  readonly displayMode: DisplayMode;
  readonly timestampResolution: TimestampResolution;
  readonly taps: readonly SignalTap[];
}

function escapeCsvField(value: string): string {
  // RFC 4180: tırnak, virgül ya da satır sonu içeren alan tırnaklanır, iç
  // tırnaklar ikilenir. Excel'in Türkçe yerelinde ayraç noktalı virgül olsa da
  // dosya standart CSV kalmalı.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatRecordsAsCsv(
  records: readonly MonitorRecord[],
  options: ExportOptions,
): string {
  const header = [
    'index',
    'timestamp',
    'kind',
    'direction',
    'length',
    'validation',
    'bytes',
    'error',
    ...options.taps.map((tap) => (tap.unit === '' ? tap.label : `${tap.label} (${tap.unit})`)),
  ];

  const lines = [header.map(escapeCsvField).join(',')];

  for (const record of records) {
    const timestamp = formatTimestamp(record.timestamp, options.timestampResolution);

    if (isFrameRecord(record)) {
      lines.push(
        [
          String(record.index),
          timestamp,
          'frame',
          record.direction.toUpperCase(),
          String(record.bytes.length),
          record.validity,
          formatBytesForDisplay(record.bytes, options.displayMode),
          '',
          ...record.signals.map((value) => (value === undefined ? '' : String(value))),
        ]
          .map(escapeCsvField)
          .join(','),
      );
    } else {
      lines.push(
        [
          String(record.index),
          timestamp,
          'error',
          '',
          '',
          record.code,
          '',
          record.message,
          ...options.taps.map(() => ''),
        ]
          .map(escapeCsvField)
          .join(','),
      );
    }
  }

  return lines.join('\n');
}

export function formatRecordsAsText(
  records: readonly MonitorRecord[],
  options: ExportOptions,
): string {
  return records
    .map((record) => {
      const timestamp = formatTimestamp(record.timestamp, options.timestampResolution);
      if (isFrameRecord(record)) {
        return `${timestamp}  ${record.direction.toUpperCase()}  ${formatBytesForDisplay(record.bytes, options.displayMode)}  ${record.validity}`;
      }
      return `${timestamp}  --  ${record.code}: ${record.message}`;
    })
    .join('\n');
}

export function formatRecordsAsJson(
  records: readonly MonitorRecord[],
  options: ExportOptions,
): string {
  return JSON.stringify(
    records.map((record) => {
      const timestamp = formatTimestamp(record.timestamp, options.timestampResolution);
      if (isFrameRecord(record)) {
        return {
          index: record.index,
          timestamp,
          kind: 'frame',
          direction: record.direction,
          length: record.bytes.length,
          validation: record.validity,
          bytes: formatBytesForDisplay(record.bytes, 'hex'),
          signals: Object.fromEntries(
            options.taps.map((tap, tapIndex) => [tap.id, record.signals[tapIndex] ?? null]),
          ),
        };
      }
      return {
        index: record.index,
        timestamp,
        kind: 'error',
        code: record.code,
        message: record.message,
        recoverable: record.recoverable,
      };
    }),
    undefined,
    2,
  );
}
