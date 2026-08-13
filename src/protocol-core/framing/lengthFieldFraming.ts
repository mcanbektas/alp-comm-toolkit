/**
 * Uzunluk alanlı (length-field) çerçeveleme — spec §8.4 satır 93-108. Frame
 * şekli: [opsiyonel START] [HEADER (address/command vb.)] [LENGTH alanı]
 * [LENGTH kadar PAYLOAD] [TRAILER (checksum/EOF vb.)]. Spec'in kendi kanonik
 * örneği (`10-uygulama-spec.md` §43, ayrıca `ProtocolPage.tsx`teki örnek
 * çerçeve): `AA 05 10 03 34 12 7F 4F 55` — START=0xAA, HEADER=2 bayt
 * (Address=05, Command=10), LENGTH=1 bayt (03), PAYLOAD=3 bayt (34 12 7F),
 * TRAILER=2 bayt (Checksum=4F, EOF=55).
 *
 * **Uzunluk alanı bozuksa GÜVENLİ resync** (spec satır 108): `LENGTH`
 * doğrudan güvenilmez — `declaredTotal > maxFrameLength` ise `invalid-length`
 * ile döner ve yalnız START+HEADER+LENGTH kadar (bir sonraki olası başlığı
 * aramak için asgari ilerleme) tüketilir, asla o kadar bellek AYRILMAZ
 * (spec'in "declared length exceeds maximum" uyarısı — bkz. `types.ts`)
 */

import { bytesToNumber } from '../buffers/endianness';
import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions } from './types';

export interface LengthFieldConfig {
  /** Tek baytlık, opsiyonel senkron baytı — verilmezse çerçeve doğrudan header'la başlar. */
  readonly startByte?: number;
  /** LENGTH alanından ÖNCE gelen sabit uzunluklu alanların (address/command…) toplam bayt sayısı. */
  readonly headerBytesBeforeLength: number;
  readonly lengthFieldWidth: 1 | 2 | 3 | 4;
  readonly lengthFieldEndianness: 'big' | 'little';
  /** PAYLOAD'dan SONRA gelen sabit uzunluklu alanların (checksum, EOF…) toplam bayt sayısı. */
  readonly trailerLength: number;
}

export function createLengthFieldExtractor(config: LengthFieldConfig): FrameExtractor {
  const startSize = config.startByte === undefined ? 0 : 1;
  const headerSize = startSize + config.headerBytesBeforeLength + config.lengthFieldWidth;

  return {
    method: 'length-field',
    extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
      if (config.startByte !== undefined && buffer.length > 0 && buffer[0] !== config.startByte) {
        // Yanlış bayta senkron olunmuş — tek bayt atlayıp yeniden dene. Bir
        // arama (indexOf) yerine tek-bayt-ilerlet tercih edildi: header'ın
        // kendisi tek bir sabit değer olmayabilir (address/command DEĞİŞKEN),
        // "bir sonraki senkron baytı ara" `nextSync`i header içeriğiyle
        // yanlışlıkla karıştırabilirdi.
        return {
          status: 'error',
          error: { code: 'no-sync', offset: 0, message: `Beklenen başlangıç baytı (0x${config.startByte.toString(16)}) yerine 0x${(buffer[0] ?? 0).toString(16)}` },
          consumedBytes: 1,
          recoverable: true,
        };
      }

      if (buffer.length < headerSize) {
        return { status: 'incomplete', consumedBytes: 0, phase: buffer.length < startSize + config.headerBytesBeforeLength ? 'header' : 'length' };
      }

      const lengthFieldOffset = startSize + config.headerBytesBeforeLength;
      const lengthBytes = buffer.subarray(lengthFieldOffset, lengthFieldOffset + config.lengthFieldWidth);
      const payloadLength = bytesToNumber(lengthBytes, config.lengthFieldEndianness);
      const totalFrameLength = headerSize + payloadLength + config.trailerLength;

      if (totalFrameLength > options.maxFrameLength) {
        return {
          status: 'error',
          error: {
            code: 'invalid-length',
            offset: lengthFieldOffset,
            message: `Bildirilen uzunluk (${payloadLength}) çerçeveyi ${totalFrameLength} bayta çıkarıyor, azami ${options.maxFrameLength}`,
          },
          // Yalnız header kadar tüket — declaredTotal kadar DEĞİL: bu, tam da
          // spec satır 108'in "sonraki olası header'ı ara" resync'i.
          consumedBytes: headerSize,
          recoverable: true,
        };
      }

      if (buffer.length < totalFrameLength) {
        return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };
      }

      return { status: 'complete', frame: buffer.subarray(0, totalFrameLength), consumedBytes: totalFrameLength };
    },
  };
}
