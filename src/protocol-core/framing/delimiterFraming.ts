/**
 * Sınırlayıcı (delimiter) tabanlı çerçeveleme — spec §8.4'ün DÖRT yöntemini
 * tek motorla karşılar: `start-byte`, `multiple-start-bytes`,
 * `start-end-delimiter`, `line-ending`. Hepsi aynı iskelet: (opsiyonel) bir
 * BAŞLANGIÇ dizisi ara, sonra bir BİTİŞ koşulu ara, arada kalanı çerçeve say.
 *
 * İki alt-tip var çünkü "bitiş" iki farklı şekilde tanımlanabiliyor:
 * - **Sınırlı (bounded)**: açık bir bitiş dizisi var (STX…ETX, CR/LF) —
 *   `createBoundedDelimiterExtractor`.
 * - **Başlangıç-sınırlı (start-marker)**: açık bitiş yok, çerçeve BİR
 *   SONRAKİ başlangıç dizisine kadar sürer (`start-byte`/`multiple-start-bytes`,
 *   spec kendi başına bitiş tanımlamıyor) — `createStartMarkerExtractor`.
 *   Bunun doğal sonucu: akıştaki EN SON çerçeve, ardından yeni bir başlangıç
 *   gelmediği sürece asla `complete` olmaz — bu yöntemin kendi doğasında var
 *   olan bir sınırlama, motorun eksiği değil (spec'in length-field/end-delimiter
 *   yöntemlerini ayrıca sunmasının sebeplerinden biri de bu).
 */

import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions, FramingMethodId } from './types';

function indexOfSequence(buffer: Uint8Array, sequence: readonly number[], fromIndex: number): number {
  if (sequence.length === 0) return -1;
  const lastPossibleStart = buffer.length - sequence.length;
  outer: for (let i = fromIndex; i <= lastPossibleStart; i += 1) {
    for (let j = 0; j < sequence.length; j += 1) {
      if (buffer[i + j] !== sequence[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export interface BoundedDelimiterConfig {
  readonly method: FramingMethodId;
  readonly startSequence?: readonly number[];
  readonly endSequence: readonly number[];
  /** STX/ETX gibi sınırlayıcıları çıkan çerçeveye dahil et. Varsayılan: hariç (yalnız içerik). */
  readonly includeDelimitersInFrame?: boolean;
}

export function createBoundedDelimiterExtractor(config: BoundedDelimiterConfig): FrameExtractor {
  const hasStart = config.startSequence !== undefined && config.startSequence.length > 0;

  return {
    method: config.method,
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      let contentStart = 0;

      if (hasStart) {
        const startSequence = config.startSequence as readonly number[];
        const startIndex = indexOfSequence(buffer, startSequence, 0);
        if (startIndex === -1) {
          if (buffer.length > options.maxFrameLength) {
            return {
              status: 'error',
              error: { code: 'no-sync', offset: 0, message: 'Başlangıç dizisi bulunamadı' },
              consumedBytes: buffer.length,
              recoverable: true,
            };
          }
          return { status: 'incomplete', consumedBytes: 0, phase: 'header' };
        }
        if (startIndex > 0) {
          // Başlangıç dizisinden önceki gürültü — atlanır, bir sonraki
          // `extract()` çağrısı temiz baştan arar (resync).
          return {
            status: 'error',
            error: { code: 'no-sync', offset: 0, message: `${startIndex} bayt gürültü, başlangıç dizisinden önce atlandı` },
            consumedBytes: startIndex,
            recoverable: true,
          };
        }
        contentStart = startSequence.length;
      }

      const endIndex = indexOfSequence(buffer, config.endSequence, contentStart);
      if (endIndex === -1) {
        if (buffer.length > options.maxFrameLength) {
          return {
            status: 'error',
            error: { code: 'frame-too-long', offset: options.maxFrameLength, message: 'Bitiş dizisi azami çerçeve uzunluğu içinde bulunamadı' },
            consumedBytes: buffer.length,
            recoverable: true,
          };
        }
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      const consumedBytes = endIndex + config.endSequence.length;
      const frame = config.includeDelimitersInFrame === true ? buffer.subarray(0, consumedBytes) : buffer.subarray(contentStart, endIndex);
      return { status: 'complete', frame, consumedBytes };
    },
  };
}

export interface StartMarkerConfig {
  readonly method: FramingMethodId;
  readonly startSequence: readonly number[];
}

export function createStartMarkerExtractor(config: StartMarkerConfig): FrameExtractor {
  return {
    method: config.method,
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      const firstStart = indexOfSequence(buffer, config.startSequence, 0);
      if (firstStart === -1) {
        if (buffer.length > options.maxFrameLength) {
          return {
            status: 'error',
            error: { code: 'no-sync', offset: 0, message: 'Başlangıç dizisi bulunamadı' },
            consumedBytes: buffer.length,
            recoverable: true,
          };
        }
        return { status: 'incomplete', consumedBytes: 0, phase: 'header' };
      }
      if (firstStart > 0) {
        return {
          status: 'error',
          error: { code: 'no-sync', offset: 0, message: `${firstStart} bayt gürültü, başlangıç dizisinden önce atlandı` },
          consumedBytes: firstStart,
          recoverable: true,
        };
      }

      const nextStart = indexOfSequence(buffer, config.startSequence, config.startSequence.length);
      if (nextStart === -1) {
        if (buffer.length > options.maxFrameLength) {
          return {
            status: 'error',
            error: { code: 'frame-too-long', offset: options.maxFrameLength, message: 'Bir sonraki başlangıç dizisi azami çerçeve uzunluğu içinde bulunamadı' },
            consumedBytes: buffer.length,
            recoverable: true,
          };
        }
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      return { status: 'complete', frame: buffer.subarray(0, nextStart), consumedBytes: nextStart };
    },
  };
}
