/**
 * Zaman tabanlı çerçeveleme — spec §8.4'ün üç yöntemi: `inter-character-timeout`,
 * `inter-frame-timeout`, `modbus-silent-interval`. Diğer 12 yöntemden temel
 * farkı: çerçeve sınırı bayt İÇERİĞİNDEN değil, bayt ARALARINDAKİ SESSİZLİKTEN
 * belirlenir. Spec bu üçü İSİMLENDİRİR (§8.4 satır 262) ama SAYISAL bir eşik
 * ya da formül VERMEZ — tek istisna Modbus'un endüstri standardı 3.5 karakter
 * süresi kuralı (spec metninde yok, gerçek Modbus RTU spesifikasyonundan;
 * `modbusSilentIntervalMs` bunu uygular).
 *
 * Saf fonksiyon kuralı gereği burada GERÇEK bir saat/`setTimeout` YOK —
 * `extract()` yalnız `options.elapsedSinceLastByteMs`i okur. Bu değer sadece
 * `../streams/streamBuffer.ts`teki `tick(nowMs)` çağrısıyla dolar: yeni bayt
 * gelişiyle (push) tetiklenen normal çağrılarda `undefined`dır, çünkü "süre
 * doldu mu" sorusunun anlamı olması için veri akışının GERÇEKTEN durmuş
 * olması gerekir — bunu ölçmek çağıranın (worker/UI zamanlayıcısı) işi.
 */

import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions, FramingMethodId } from './types';

export interface TimeoutFramingConfig {
  readonly method: Extract<FramingMethodId, 'inter-character-timeout' | 'inter-frame-timeout' | 'modbus-silent-interval'>;
  readonly timeoutMs: number;
}

export function createTimeoutExtractor(config: TimeoutFramingConfig): FrameExtractor {
  if (config.timeoutMs <= 0) throw new RangeError('timeoutFraming: timeoutMs pozitif olmalı');

  return {
    method: config.method,
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      if (buffer.length === 0) return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };

      if (options.elapsedSinceLastByteMs === undefined || options.elapsedSinceLastByteMs < config.timeoutMs) {
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      if (buffer.length > options.maxFrameLength) {
        return {
          status: 'error',
          error: { code: 'frame-too-long', offset: options.maxFrameLength, message: `Sessizlik sona erdiğinde arabellek azami ${options.maxFrameLength} baytı aşmıştı` },
          consumedBytes: buffer.length,
          recoverable: true,
        };
      }

      // Süre dolduğunda arabellekte NE VARSA çerçeve odur — sınırı belirleyen
      // içerik değil, zamandır.
      return { status: 'complete', frame: buffer.slice(), consumedBytes: buffer.length };
    },
  };
}

const RTU_BITS_PER_CHARACTER = 11; // 1 start + 8 data + 1 parity + 1 stop (Modbus RTU varsayılan çerçeve)
const RTU_SILENT_CHARACTERS = 3.5;
/** ≥19200 baud'da modern cihazlar (Modbus spesifikasyonunun kendi notu) 3.5 karaktere değil sabit bu tabana düşer. */
const HIGH_BAUD_FIXED_SILENT_MS = 1.75;
const HIGH_BAUD_THRESHOLD = 19200;

/** Modbus RTU t3.5 sessizlik aralığı (ms) — endüstri standardı, spec metninde sayı verilmez. */
export function modbusSilentIntervalMs(baudRate: number): number {
  if (baudRate <= 0) throw new RangeError('modbusSilentIntervalMs: baudRate pozitif olmalı');
  if (baudRate >= HIGH_BAUD_THRESHOLD) return HIGH_BAUD_FIXED_SILENT_MS;
  const characterTimeMs = (RTU_BITS_PER_CHARACTER / baudRate) * 1000;
  return RTU_SILENT_CHARACTERS * characterTimeMs;
}
