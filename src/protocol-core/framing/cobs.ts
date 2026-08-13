/**
 * COBS (Consistent Overhead Byte Stuffing) — spec §8.4 satır 131-152. Seçili
 * bir bayt değerini (burada, spec'teki gibi 0x00) veriden tamamen kaldırıp
 * geri döndürülebilir biçimde kodlar; en kötü durumda 254 baytta 1 bayt ek
 * yük. Kodlanmış akış `0x00` ile sonlandırılır — COBS'un kendi tanımı gereği
 * kodlanmış içerik ASLA 0x00 taşımaz, bu yüzden delimiter aramak escape
 * farkındalığı gerektirmez (bkz. `escapedDelimiterFraming.ts`teki aynı
 * gerekçe).
 */

import type { FrameExtractionResult, FrameExtractor, FrameExtractorOptions } from './types';

export const COBS_DELIMITER = 0x00;
const MAX_BLOCK_LENGTH = 0xff;

/** Ham veriyi COBS'a kodlar — delimiter (`0x00`) EKLEMEZ, yalnız gövde. */
export function encodeCobs(data: Uint8Array): Uint8Array {
  const output: number[] = [0];
  let codeIndex = 0;
  let code = 1;

  for (const byte of data) {
    if (byte === 0) {
      output[codeIndex] = code;
      codeIndex = output.length;
      output.push(0);
      code = 1;
    } else {
      output.push(byte);
      code += 1;
      if (code === MAX_BLOCK_LENGTH) {
        output[codeIndex] = code;
        codeIndex = output.length;
        output.push(0);
        code = 1;
      }
    }
  }
  output[codeIndex] = code;
  return Uint8Array.from(output);
}

export type CobsDecodeResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; code: 'invalid-stuffing' | 'truncated-frame'; offset: number; message: string };

/** COBS gövdesini (delimiter HARİÇ) ham veriye çözer. */
export function decodeCobs(encoded: Uint8Array): CobsDecodeResult {
  const output: number[] = [];
  let i = 0;

  while (i < encoded.length) {
    const blockCode = encoded[i];
    if (blockCode === undefined) break; // döngü sınırı zaten `encoded.length`
    if (blockCode === 0) {
      return { ok: false, code: 'invalid-stuffing', offset: i, message: `Kodlanmış gövde içinde 0x00 (offset ${i}) — COBS ihlali` };
    }
    i += 1;

    for (let j = 1; j < blockCode; j += 1) {
      const dataByte = encoded[i];
      if (dataByte === undefined) {
        return { ok: false, code: 'truncated-frame', offset: i, message: `Blok kod (${blockCode}) kalan veriden uzun (offset ${i})` };
      }
      // Geçerli bir COBS gövdesinde 0x00 KOD baytı olarak da VERİ baytı olarak
      // da asla belirmez (kodlayıcı her sıfırı bir blok sınırına çevirir) —
      // burada görülmesi girdinin bu fonksiyona doğrudan (extractor'ın
      // delimiter-öncesi ayıklamasından GEÇMEDEN) verilmiş bozuk bir gövde
      // olduğunu gösterir.
      if (dataByte === 0) {
        return { ok: false, code: 'invalid-stuffing', offset: i, message: `Blok içinde 0x00 (offset ${i}) — COBS ihlali` };
      }
      output.push(dataByte);
      i += 1;
    }

    // 0xFF kodu "blok tam doldu, ZERO EKLEME" anlamına gelir (254 bayt üst
    // sınırını aşan bloklar için taşırma önleyici) — spec satır 141-146.
    // Akışın en son bloğunda da zero eklenmez (sondaki 0, gövdenin bir
    // parçası değil, kodlayıcının kendi delimiter'ıdır).
    if (blockCode < MAX_BLOCK_LENGTH && i < encoded.length) {
      output.push(0);
    }
  }

  return { ok: true, data: Uint8Array.from(output) };
}

export const cobsExtractor: FrameExtractor = {
  method: 'cobs',
  extract(buffer: Uint8Array, options: FrameExtractorOptions): FrameExtractionResult {
    if (buffer.length === 0) return { status: 'incomplete', consumedBytes: 0, phase: 'payload' };

    let delimiterIndex = -1;
    for (let i = 0; i < buffer.length; i += 1) {
      if (buffer[i] === COBS_DELIMITER) {
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
    const encoded = buffer.subarray(0, delimiterIndex);

    if (encoded.length === 0) {
      // İki delimiter art arda — SLIP'teki karşılığının aksine COBS'ta "opsiyonel
      // öncü delimiter" sözleşmesi YOK, bu yüzden burada hiç istisna yapılmaz.
      return {
        status: 'error',
        error: { code: 'frame-too-short', offset: 0, message: 'Boş COBS bloğu (art arda iki delimiter)' },
        consumedBytes,
        recoverable: true,
      };
    }

    const decoded = decodeCobs(encoded);
    if (!decoded.ok) {
      return { status: 'error', error: { code: decoded.code, offset: decoded.offset, message: decoded.message }, consumedBytes, recoverable: true };
    }

    return { status: 'complete', frame: decoded.data, consumedBytes };
  },
};

/** Ham veriyi delimiter dahil tam kablo çerçevesine çevirir. */
export function encodeCobsFrame(data: Uint8Array): Uint8Array {
  const encoded = encodeCobs(data);
  const framed = new Uint8Array(encoded.length + 1);
  framed.set(encoded, 0);
  framed[encoded.length] = COBS_DELIMITER;
  return framed;
}
