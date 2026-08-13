/**
 * Sabit uzunluklu çerçeveleme — spec §8.4 satır 29-30. En basit yöntem, ama
 * spec'in kendi uyarısı burada da geçerli: akış başlangıcı bilinmiyorsa TEK
 * BAŞINA yetmez — aradaki bir gürültü baytı (§8.4 örneğindeki `4F`) sonraki
 * her çerçeveyi bir bayt kaydırıp bozar. Bu yüzden `startByte` opsiyonel
 * ama VARSA senkron için kullanılır; header/checksum doğrulaması yine de
 * protokol katmanının işi kalır (bu katman yalnız "N bayt hazır mı" sorar).
 */

import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions } from './types';

export interface FixedLengthConfig {
  readonly frameLength: number;
  readonly startByte?: number;
}

export function createFixedLengthExtractor(config: FixedLengthConfig): FrameExtractor {
  return {
    method: 'fixed-length',
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      if (config.frameLength > options.maxFrameLength) {
        throw new RangeError('fixedLengthFraming: frameLength azami çerçeve uzunluğunu aşıyor — bu bir yapılandırma hatası, akış verisiyle ilgisi yok');
      }

      if (config.startByte !== undefined && buffer.length > 0 && buffer[0] !== config.startByte) {
        return {
          status: 'error',
          error: { code: 'no-sync', offset: 0, message: `Beklenen başlangıç baytı (0x${config.startByte.toString(16)}) yerine 0x${(buffer[0] ?? 0).toString(16)}` },
          consumedBytes: 1,
          recoverable: true,
        };
      }

      if (buffer.length < config.frameLength) {
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      return { status: 'complete', frame: buffer.subarray(0, config.frameLength), consumedBytes: config.frameLength };
    },
  };
}
