/**
 * `protocol-core/framing`in `FramingErrorCode`si ile `protocol-core/types`in
 * `ProtocolErrorCode`u BİLEREK AYRI iki union (framing/types.ts'in kendi
 * gerekçesi: biri yapısal çerçeveleme hatası, öbürü protokol alan hatası).
 * Bir `ProtocolParser.parse()` içeriden bir `FrameExtractor.extract()`
 * çağırdığında ikisi arasında köprü gerekiyor — bu dosya o köprü, yalnız
 * SLIP/COBS/KISS/PPP/HDLC/SDLC'nin üretebildiği kodlarla sınırlı (SDLC
 * kendi bir framing motoru YOK, HDLC'ninkini paylaşıyor — bkz. hdlcCore.ts;
 * XMODEM/YMODEM/ZMODEM gelince genişler, şimdiden tüm 9 kodu kapsayan bir
 * tablo UYDURULMADI).
 */

import type { FramingError, FramingErrorCode } from '@/protocol-core/framing/types';
import type { ProtocolErrorCode } from '@/protocol-core/types';

const FRAMING_TO_PROTOCOL_ERROR_CODE: Readonly<Partial<Record<FramingErrorCode, ProtocolErrorCode>>> = {
  'frame-too-long': 'frame-too-long',
  'frame-too-short': 'truncated-frame',
  'truncated-frame': 'truncated-frame',
  // Kaçış/stuffing kuralı ihlali: alan DEĞERİ değil, KODLAMA BİÇİMİ reddediliyor
  // — `unsupported-encoding`in kendi tanımıyla aynı ayrım.
  'invalid-escape': 'unsupported-encoding',
  'invalid-stuffing': 'unsupported-encoding',
  // hdlcCore.ts'in `createBoundedDelimiterExtractor`ü (dalga 10c) — başlangıç
  // flag'i (0x7E) bulunamadığında ya da öncesinde gürültü varsa üretir.
  'no-sync': 'start-delimiter-not-found',
};

export function mapFramingError(error: FramingError): { code: ProtocolErrorCode; message: string; offset: number } {
  return {
    code: FRAMING_TO_PROTOCOL_ERROR_CODE[error.code] ?? 'unsupported-encoding',
    message: error.message,
    offset: error.offset,
  };
}
