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

import { crc } from '../../protocol-core/checksums/crcEngine';
import { CRC_CATALOGUE, type CrcAlgorithmId } from '../../protocol-core/checksums/crcCatalogue';
import { sum8Checksum, xor8Checksum } from '../../protocol-core/checksums/simpleChecksums';
import { lrcChecksum } from '../../protocol-core/checksums/lrc';
import { bytesToNumber } from '../../protocol-core/buffers/endianness';
import type { FrameValidity } from '../../protocol-core/statistics/commStatistics';

/** Ekrandaki seçim listesi — katalogun tamamı değil, seri hatta gerçekten görülenler. */
export const FRAME_CHECKSUM_ALGORITHMS = [
  'none',
  'xor8',
  'sum8',
  'lrc',
  'CRC8',
  'CRC8_MAXIM',
  'CRC16_MODBUS',
  'CRC16_CCITT_FALSE',
  'CRC16_XMODEM',
  'CRC16_X25',
  'CRC32',
] as const;

export type FrameChecksumAlgorithm = (typeof FRAME_CHECKSUM_ALGORITHMS)[number];

const SIMPLE_ALGORITHMS = new Set<FrameChecksumAlgorithm>(['xor8', 'sum8', 'lrc']);

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

export function checksumWidthBytes(algorithm: FrameChecksumAlgorithm): number {
  if (algorithm === 'none') {
    return 0;
  }
  if (SIMPLE_ALGORITHMS.has(algorithm)) {
    return 1;
  }
  const params = CRC_CATALOGUE[algorithm as CrcAlgorithmId];
  // 4 bitlik CRC de bir bayt kaplar; genişlik yukarı yuvarlanır.
  return Math.ceil(params.width / 8);
}

function computeChecksum(bytes: Uint8Array, algorithm: FrameChecksumAlgorithm): bigint | undefined {
  switch (algorithm) {
    case 'none':
      return undefined;
    case 'xor8':
      return BigInt(xor8Checksum(bytes));
    case 'sum8':
      return BigInt(sum8Checksum(bytes));
    case 'lrc':
      return BigInt(lrcChecksum(bytes));
    default:
      return crc(bytes, CRC_CATALOGUE[algorithm]);
  }
}

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

  const storedBytes = bytes.subarray(checksumStart, checksumEnd);
  const stored = BigInt(bytesToNumber(storedBytes, config.endianness));

  if (stored === computed) {
    return 'valid';
  }
  // Spec §39 CRC hatalarını basit checksum hatalarından ayrı sayıyor.
  return SIMPLE_ALGORITHMS.has(config.algorithm) ? 'checksum-error' : 'crc-error';
}
