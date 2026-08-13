/**
 * Delimiter + escape motoru — `escaping.ts`teki kaçış dönüşümünü bir bayt
 * dizisinden ÇERÇEVE ÇIKARMAYA (nerede başlıyor/bitiyor) genişletir. Hem
 * spec'in genel "Escape-based framing" maddesini (kullanıcı tanımlı kural,
 * spec satır 85-86: "toolkit kullanıcı tanımlı escape rule tanımlamaya izin
 * vermeli") HEM `slip.ts`nin sabit parametreli SLIP örneğini besler.
 *
 * Arama kolaylığı: kodlama (`escapeBytes`) delimiter baytını HER ZAMAN
 * `specialBytes` üzerinden kaçışlar, bu yüzden çözülmüş içerikte ham
 * delimiter değeri asla belirmez — arabellekte delimiter'ı bulmak için
 * kaçışa duyarlı bir tarama GEREKMEZ, düz `indexOf` yeterli ve doğrudur.
 */

import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions, FramingMethodId } from './types';
import type { EscapeRule } from './escaping';
import { escapeBytes, toFramingError, unescapeBytes } from './escaping';

export interface EscapedDelimiterConfig {
  readonly method: FramingMethodId;
  readonly delimiterByte: number;
  readonly rule: EscapeRule;
}

export function encodeEscapedDelimiterFrame(payload: Uint8Array, config: EscapedDelimiterConfig): Uint8Array {
  const escaped = escapeBytes(payload, config.rule);
  const framed = new Uint8Array(escaped.length + 1);
  framed.set(escaped, 0);
  framed[escaped.length] = config.delimiterByte;
  return framed;
}

export function createEscapedDelimiterExtractor(config: EscapedDelimiterConfig): FrameExtractor {
  return {
    method: config.method,
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      if (buffer.length === 0) return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };

      // Baştaki tek bir delimiter, önceki hattaki gürültüyü temizleyen OPSİYONEL
      // bir işaretleyicidir (RFC 1055 SLIP) — çerçeve arayışı ondan sonra başlar.
      const searchStart = buffer[0] === config.delimiterByte ? 1 : 0;

      let delimiterIndex = -1;
      for (let i = searchStart; i < buffer.length; i += 1) {
        if (buffer[i] === config.delimiterByte) {
          delimiterIndex = i;
          break;
        }
      }

      if (delimiterIndex === -1) {
        if (buffer.length > options.maxFrameLength) {
          return {
            status: 'error',
            error: { code: 'frame-too-long', offset: options.maxFrameLength, message: `Delimiter ${options.maxFrameLength} bayt içinde bulunamadı` },
            consumedBytes: buffer.length,
            recoverable: true,
          };
        }
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      const consumedBytes = delimiterIndex + 1;
      const wireContent = buffer.subarray(searchStart, delimiterIndex);

      if (wireContent.length === 0) {
        // İki delimiter art arda — RFC 1055'te sessizce atlanan boş çerçeve;
        // burada YİNE DE hata olarak işaretlenir (recoverable=true) ki stream
        // buffer bunu görünür bir istatistik olarak sayabilsin, sessizce yutmaz.
        return {
          status: 'error',
          error: { code: 'frame-too-short', offset: searchStart, message: 'Boş çerçeve (art arda iki delimiter)' },
          consumedBytes,
          recoverable: true,
        };
      }

      const unescaped = unescapeBytes(wireContent, config.rule);
      if (!unescaped.ok) {
        return {
          status: 'error',
          error: toFramingError(unescaped.code, searchStart + unescaped.offset),
          consumedBytes,
          recoverable: true,
        };
      }

      return { status: 'complete', frame: unescaped.data, consumedBytes };
    },
  };
}
