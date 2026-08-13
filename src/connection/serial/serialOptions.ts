/**
 * Seri port ayarları ve doğrulaması — spec §8.1'in "Bağlantı ayarları" ve
 * "Desteklenecek baud rate değerleri" listelerinin birebir karşılığı.
 *
 * Bu modül saf veri + doğrulamadır; hiçbir tarayıcı API'sine dokunmaz, böylece
 * jsdom'da da sınanabilir.
 */

import { calculateUartTiming } from '../../protocol-core/timing/uart';

/** Spec §8.1 listesi; "Custom" değeri liste dışı serbest giriştir (bkz. `validateSerialOptions`). */
export const SERIAL_BAUD_RATES = [
  300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000,
  2000000,
] as const;

/** Web Serial yalnız 7 ve 8'i kabul eder — spec'in daha geniş listesi tarayıcıda karşılıksız. */
export const SERIAL_DATA_BITS = [7, 8] as const;
export const SERIAL_STOP_BITS = [1, 2] as const;
export const SERIAL_PARITIES = ['none', 'even', 'odd'] as const;
export const SERIAL_FLOW_CONTROLS = ['none', 'hardware'] as const;

export type SerialDataBits = (typeof SERIAL_DATA_BITS)[number];
export type SerialStopBits = (typeof SERIAL_STOP_BITS)[number];
export type SerialParity = (typeof SERIAL_PARITIES)[number];
export type SerialFlowControl = (typeof SERIAL_FLOW_CONTROLS)[number];

export interface SerialConnectionOptions {
  readonly baudRate: number;
  readonly dataBits: SerialDataBits;
  readonly stopBits: SerialStopBits;
  readonly parity: SerialParity;
  readonly flowControl: SerialFlowControl;
  /** Tarayıcının okuma arabelleği (bayt) — spec §8.1 "Buffer size". */
  readonly bufferSize: number;
}

export const DEFAULT_SERIAL_OPTIONS: SerialConnectionOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
  bufferSize: 4096,
};

/** Web Serial'in `bufferSize` için pratik tavanı; üstü çoğu tarayıcıda reddedilir. */
const MAX_BUFFER_SIZE = 1024 * 1024;
const MIN_BUFFER_SIZE = 64;
/** 2 Mbaud üstü değerler standart listede yok ama Custom girişte serbest — üst sınır sürücü kaynaklı. */
const MAX_BAUD_RATE = 20_000_000;

export type SerialOptionsField = keyof SerialConnectionOptions;

export interface SerialOptionsIssue {
  readonly field: SerialOptionsField;
  readonly code: 'not-integer' | 'out-of-range' | 'not-allowed';
}

/**
 * Ayarları doğrular. Baud rate listede olmak ZORUNDA DEĞİL — spec §8.1 "Custom"
 * seçeneğini açıkça sayıyor; yalnız pozitif tam sayı ve makul aralıkta olmalı.
 */
export function validateSerialOptions(options: SerialConnectionOptions): SerialOptionsIssue[] {
  const issues: SerialOptionsIssue[] = [];

  if (!Number.isInteger(options.baudRate)) {
    issues.push({ field: 'baudRate', code: 'not-integer' });
  } else if (options.baudRate <= 0 || options.baudRate > MAX_BAUD_RATE) {
    issues.push({ field: 'baudRate', code: 'out-of-range' });
  }

  if (!SERIAL_DATA_BITS.includes(options.dataBits)) {
    issues.push({ field: 'dataBits', code: 'not-allowed' });
  }
  if (!SERIAL_STOP_BITS.includes(options.stopBits)) {
    issues.push({ field: 'stopBits', code: 'not-allowed' });
  }
  if (!SERIAL_PARITIES.includes(options.parity)) {
    issues.push({ field: 'parity', code: 'not-allowed' });
  }
  if (!SERIAL_FLOW_CONTROLS.includes(options.flowControl)) {
    issues.push({ field: 'flowControl', code: 'not-allowed' });
  }

  if (!Number.isInteger(options.bufferSize)) {
    issues.push({ field: 'bufferSize', code: 'not-integer' });
  } else if (options.bufferSize < MIN_BUFFER_SIZE || options.bufferSize > MAX_BUFFER_SIZE) {
    issues.push({ field: 'bufferSize', code: 'out-of-range' });
  }

  return issues;
}

/**
 * Bir karakterin hat üzerinde kapladığı bit sayısı (start + data + parity +
 * stop). Bus load hesabı bunu kullanır; formül Faz 5'in UART timing motorundan
 * gelir, burada yeniden türetilmez.
 */
export function serialBitsPerByte(options: SerialConnectionOptions): number {
  return calculateUartTiming({
    baudRate: options.baudRate,
    dataBits: options.dataBits,
    stopBits: options.stopBits,
    parity: options.parity,
  }).bitsPerCharacter;
}
