/**
 * Çözümleme tanılarının ARAYÜZ karşılığı: hata kodu → çeviri anahtarı, ve
 * motorun ürettiği metnin çevrilip çevrilmeyeceği kararı.
 *
 * Bu tablo üç ekranda birden gerekiyor (`DecodePanel`, Studio'nun
 * `OutputPanel`ı, `SchemaPanel`) ve ilk ikisinde AYNEN kopyalanmıştı. Üçüncü
 * kopya yazılmadı: kopyaların zamanla ayrışması, aynı `ProtocolErrorCode`un
 * iki ekranda iki farklı cümleyle açıklanması demekti — kullanıcı da hatanın
 * aynı hata olduğunu göremezdi.
 *
 * Anahtarlar `studio.*` ad uzayından BİLEREK yeniden kullanılıyor: bunlar
 * Studio'nun arayüz metni değil, `protocol-core`daki `ProtocolErrorCode`
 * birleşiminin tek çevirisi.
 */

import type { ProtocolErrorCode } from '@/protocol-core/types';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';

/** Hata KODU çevrilir, `message` çevrilmez: mesaj çözümleyicinin ürettiği veridir. */
export const PARSE_ERROR_LABEL_KEYS: Record<ProtocolErrorCode, TranslationKey> = {
  'invalid-hex-input': 'studio.output.parseError.code.invalidHexInput',
  'length-mismatch': 'studio.output.parseError.code.lengthMismatch',
  'checksum-mismatch': 'studio.output.parseError.code.checksumMismatch',
  'crc-mismatch': 'studio.output.parseError.code.crcMismatch',
  'unsupported-function-code': 'studio.output.parseError.code.unsupportedFunctionCode',
  'start-delimiter-not-found': 'studio.output.parseError.code.startDelimiterNotFound',
  'value-out-of-range': 'studio.output.parseError.code.valueOutOfRange',
  'unsupported-encoding': 'studio.output.parseError.code.unsupportedEncoding',
  'frame-too-long': 'studio.output.parseError.code.frameTooLong',
  'truncated-frame': 'studio.output.parseError.code.truncatedFrame',
  'circular-length-reference': 'studio.output.parseError.code.circularLengthReference',
  'parser-timeout': 'studio.output.parseError.code.parserTimeout',
};

/**
 * Eklentiler tanı metnini ya düz cümle ya da çeviri anahtarı olarak verir
 * (spec §7 ikisini de serbest bırakıyor). Ayrım tek yerde yapılır: sözlükte
 * karşılığı olan metin çevrilir, olmayan olduğu gibi basılır — aksi hâlde biri
 * ekranda ham anahtar, diğeri boşluk görürdü.
 */
export function translateDiagnostic(text: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(text) ? t(text) : text;
}
