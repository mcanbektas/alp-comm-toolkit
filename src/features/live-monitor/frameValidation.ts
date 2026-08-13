/**
 * Çerçeve doğrulama — spec §8.3'ün "Validation state / CRC state" alanları ve
 * §39'un "CRC errors" / "Checksum errors" ayrı sayaçları.
 *
 * Çerçeveleme doğrulama YAPMAZ: stream buffer yalnız sınırları bulur, içeriğin
 * doğru olup olmadığına bakmaz. Bu yüzden doğrulama ayrı bir adımdır.
 *
 * Checksum genişliği algoritmadan TÜRETİLİR, kullanıcıdan ayrıca sorulmaz —
 * "CRC32 seçip 1 bayt genişlik yazmak" gibi sessizce yanlış çalışan bir
 * yapılandırma mümkün olmasın diye.
 */

import {
  CHECKSUM_ALGORITHMS,
  checksumWidthBytes,
  computeChecksum,
  isSimpleChecksumAlgorithm,
  readStoredChecksum,
  type ChecksumAlgorithm,
} from '../../protocol-core/checksums/algorithmCatalogue';
import type { FrameValidity } from '../../protocol-core/statistics/commStatistics';

/**
 * Algoritma listesi ve hesabı `protocol-core/checksums/algorithmCatalogue`de
 * yaşar: Protocol Studio ve Packet Builder de aynı listeyi kullanıyor, kopya
 * tutmak üçünün sessizce ayrışması demekti. Buradaki adlar geriye dönük
 * uyumluluk için korunuyor.
 */
export const FRAME_CHECKSUM_ALGORITHMS = CHECKSUM_ALGORITHMS;
export type FrameChecksumAlgorithm = ChecksumAlgorithm;
export { checksumWidthBytes };

export interface FrameValidationConfig {
  readonly algorithm: FrameChecksumAlgorithm;
  /** Çok baytlı checksum'ın çerçevedeki bayt sırası. */
  readonly endianness: 'big' | 'little';
  /** Checksum'dan SONRA gelen bayt sayısı (EOF, LF vb.). 0 = checksum son bayt. */
  readonly trailingBytesAfterChecksum: number;
  /** Hesaba katılmayan baş bayt sayısı (bazı protokollerde START checksum'a girmez). */
  readonly skipLeadingBytes: number;
}

export const DEFAULT_FRAME_VALIDATION: FrameValidationConfig = {
  algorithm: 'none',
  endianness: 'big',
  trailingBytesAfterChecksum: 0,
  skipLeadingBytes: 0,
};

/** Simülasyon protokolü: XOR8, checksum'dan sonra bir EOF baytı var. */
export const SIMULATED_FRAME_VALIDATION: FrameValidationConfig = {
  algorithm: 'xor8',
  endianness: 'big',
  trailingBytesAfterChecksum: 1,
  skipLeadingBytes: 0,
};

/**
 * Çerçeveyi doğrular.
 *
 * `unchecked` bilerek ayrı bir sonuç: doğrulama kapalıysa ya da çerçeve
 * checksum'ı taşıyamayacak kadar kısaysa çerçeve GEÇERSİZ SAYILMAZ. Kapalı
 * doğrulamayı "hepsi geçerli" saymak istatistiği yalancı biçimde temiz
 * gösterirdi.
 */
export function validateFrame(bytes: Uint8Array, config: FrameValidationConfig): FrameValidity {
  const width = checksumWidthBytes(config.algorithm);
  if (width === 0) {
    return 'unchecked';
  }

  const checksumEnd = bytes.length - config.trailingBytesAfterChecksum;
  const checksumStart = checksumEnd - width;
  if (checksumStart <= config.skipLeadingBytes || checksumEnd > bytes.length) {
    return 'unchecked';
  }

  const covered = bytes.subarray(config.skipLeadingBytes, checksumStart);
  const computed = computeChecksum(covered, config.algorithm);
  if (computed === undefined) {
    return 'unchecked';
  }

  const stored = readStoredChecksum(bytes.subarray(checksumStart, checksumEnd), config.endianness);

  if (stored === computed) {
    return 'valid';
  }
  // Spec §39 CRC hatalarını basit checksum hatalarından ayrı sayıyor.
  return isSimpleChecksumAlgorithm(config.algorithm) ? 'checksum-error' : 'crc-error';
}
