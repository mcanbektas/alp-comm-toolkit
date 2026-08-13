/**
 * Çerçeve doğrulamada ve paket üretiminde kullanılabilen checksum/CRC
 * algoritmalarının ortak kataloğu — spec §11.
 *
 * Neden burada: hem canlı monitör (çerçeve doğrulama) hem Custom Protocol
 * Studio (şemadaki `checksum`/`crc` alanları) hem Packet Builder (otomatik
 * checksum) aynı listeyi kullanıyor. Liste bir özellik klasöründe kalsaydı
 * diğer ikisi ya ona bağımlı olur ya da kopyasını taşırdı; ikisi de yanlış.
 *
 * Genişlik algoritmadan TÜRETİLİR, ayrıca sorulmaz — "CRC32 seçip 1 bayt
 * genişlik yazmak" gibi sessizce yanlış çalışan bir yapılandırma kurulamasın.
 */

import { bytesToNumber } from '../buffers/endianness';
import { CRC_CATALOGUE, type CrcAlgorithmId } from './crcCatalogue';
import { crc } from './crcEngine';
import { lrcChecksum } from './lrc';
import { sum8Checksum, xor8Checksum } from './simpleChecksums';

/** Katalogun tamamı değil — seri/alan hatlarında fiilen görülenler. */
export const CHECKSUM_ALGORITHMS = [
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

export type ChecksumAlgorithm = (typeof CHECKSUM_ALGORITHMS)[number];

/** Tek baytlık, CRC olmayan algoritmalar — spec §39 bunları ayrı sayaçta tutuyor. */
const SIMPLE_ALGORITHMS = new Set<ChecksumAlgorithm>(['xor8', 'sum8', 'lrc']);

export function isSimpleChecksumAlgorithm(algorithm: ChecksumAlgorithm): boolean {
  return SIMPLE_ALGORITHMS.has(algorithm);
}

export function isChecksumAlgorithm(value: string): value is ChecksumAlgorithm {
  return (CHECKSUM_ALGORITHMS as readonly string[]).includes(value);
}

export function checksumWidthBytes(algorithm: ChecksumAlgorithm): number {
  if (algorithm === 'none') {
    return 0;
  }
  if (SIMPLE_ALGORITHMS.has(algorithm)) {
    return 1;
  }
  // 4 bitlik bir CRC de bir bayt kaplar; genişlik yukarı yuvarlanır.
  return Math.ceil(CRC_CATALOGUE[algorithm as CrcAlgorithmId].width / 8);
}

/** Kapsanan baytların checksum'ını hesaplar. `none` için `undefined`. */
export function computeChecksum(
  bytes: Uint8Array,
  algorithm: ChecksumAlgorithm,
): bigint | undefined {
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

/** Çerçevede saklanan checksum baytlarını sayıya çevirir. */
export function readStoredChecksum(
  bytes: Uint8Array,
  endianness: 'big' | 'little',
): bigint {
  return BigInt(bytesToNumber(bytes, endianness));
}

/** Hesaplanan checksum'ı `width` bayta yazar. */
export function checksumToBytes(
  value: bigint,
  width: number,
  endianness: 'big' | 'little',
): Uint8Array {
  const result = new Uint8Array(width);
  for (let index = 0; index < width; index += 1) {
    // En düşük anlamlı bayttan başla; yerleşim endianness'e göre seçilir.
    const shift = BigInt(8 * index);
    const byte = Number((value >> shift) & 0xffn);
    result[endianness === 'little' ? index : width - 1 - index] = byte;
  }
  return result;
}
