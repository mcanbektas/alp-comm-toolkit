/**
 * Spec §11 "CRC Finder" aracı: bilinen veri + gözlenen checksum çiftinden hangi
 * algoritmanın kullanıldığını bulmaya çalışır. Denenen: 18 standart CRC
 * (`crcCatalogue`) + 9 basit checksum (§43), HER İKİSİ de gözlenen değerin
 * normal VE bayt sırası TERSİNE ÇEVRİLMİŞ hâliyle karşılaştırılır — çerçeveden
 * okunan çok baytlı bir checksum yanlış endianness'la yorumlanmış olabilir.
 *
 * BİLEREK YAPILMAYAN — spec'in "coverage alanını tahmin etsin" maddesi:
 * hangi bayt aralığının hesaba katıldığını (checksum'un kendisi dahil mi,
 * baştan mı başlıyor) denemek kapsam dışı bırakıldı; kullanıcının `dataHex`e
 * checksum baytları HARİÇ doğru aralığı zaten verdiği kabul edilir. Eşleşme
 * ikili (var/yok) raporlanır — bir "yüzde" üretilmez, checksum aritmetiği
 * kesindir, bulanık bir güven skoru uydurmak yanıltıcı olurdu.
 */

import { hexToBytes } from '../buffers/representation';
import { adler32 } from './adler32';
import { CRC_ALGORITHM_IDS, CRC_CATALOGUE, computeNamedCrc } from './crcCatalogue';
import { fletcher16, fletcher32 } from './fletcher';
import { lrcChecksum } from './lrc';
import { onesComplementChecksum, sum16Checksum, sum8Checksum, twosComplementChecksum, xor8Checksum } from './simpleChecksums';

export interface ChecksumFinderInput {
  dataHex: string;
  expectedHex: string;
}

export type ChecksumAlgorithmKind = 'crc' | 'simple';
export type ChecksumByteOrder = 'normal' | 'swapped';

export interface ChecksumMatch {
  id: string;
  kind: ChecksumAlgorithmKind;
  widthBits: number;
  computedHex: string;
  matchedByteOrder: ChecksumByteOrder;
}

interface SimpleAlgorithmDef {
  id: string;
  widthBits: 8 | 16 | 32;
  compute: (bytes: Uint8Array) => number;
}

/** NMEA XOR burada bilerek YOK — o payload string üzerinde çalışır (`$…*hh`), bu aracın "ham bayt + değer" sözleşmesine uymuyor. */
const SIMPLE_ALGORITHMS: readonly SimpleAlgorithmDef[] = [
  { id: 'XOR8', widthBits: 8, compute: xor8Checksum },
  { id: 'SUM8', widthBits: 8, compute: sum8Checksum },
  { id: 'SUM16', widthBits: 16, compute: sum16Checksum },
  { id: 'TWOS_COMPLEMENT', widthBits: 8, compute: twosComplementChecksum },
  { id: 'ONES_COMPLEMENT', widthBits: 8, compute: onesComplementChecksum },
  { id: 'LRC', widthBits: 8, compute: lrcChecksum },
  { id: 'FLETCHER16', widthBits: 16, compute: fletcher16 },
  { id: 'FLETCHER32', widthBits: 32, compute: fletcher32 },
  { id: 'ADLER32', widthBits: 32, compute: adler32 },
];

function toHex(value: bigint, widthBits: number): string {
  const hexLength = Math.ceil(widthBits / 4);
  return value.toString(16).toUpperCase().padStart(hexLength, '0');
}

function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

/** `widthBits` genişliğindeki değerin bayt sırasını çevirir (CRC64'e kadar güvenli — bigint, taşma yok). */
function byteSwapWithinWidth(value: bigint, widthBits: number): bigint {
  const byteCount = widthBits / 8;
  let swapped = 0n;
  let remaining = value;
  for (let i = 0; i < byteCount; i += 1) {
    swapped = (swapped << 8n) | (remaining & 0xffn);
    remaining >>= 8n;
  }
  return swapped;
}

export function findChecksumMatches({ dataHex, expectedHex }: ChecksumFinderInput): ChecksumMatch[] {
  const data = hexToBytes(dataHex);
  const expectedBytes = hexToBytes(expectedHex);
  const expectedWidthBits = expectedBytes.length * 8;

  const expectedNormal = bytesToBigIntBE(expectedBytes);
  const expectedSwapped = byteSwapWithinWidth(expectedNormal, expectedWidthBits);
  const hasDistinctSwap = expectedSwapped !== expectedNormal;

  const matches: ChecksumMatch[] = [];

  // CRC4/5/6/7 gibi bayta bölünmeyen genişlikler `expectedWidthBits` (her zaman 8'in katı)
  // ile asla eşleşmez — bir checksum hex string'i zaten yarım bayt (nibble) taşıyamaz.
  for (const id of CRC_ALGORITHM_IDS) {
    const params = CRC_CATALOGUE[id];
    if (params.width !== expectedWidthBits) continue;
    const computed = computeNamedCrc(data, id);
    if (computed === expectedNormal) {
      matches.push({ id, kind: 'crc', widthBits: params.width, computedHex: toHex(computed, params.width), matchedByteOrder: 'normal' });
    } else if (hasDistinctSwap && computed === expectedSwapped) {
      matches.push({ id, kind: 'crc', widthBits: params.width, computedHex: toHex(computed, params.width), matchedByteOrder: 'swapped' });
    }
  }

  for (const algorithm of SIMPLE_ALGORITHMS) {
    if (algorithm.widthBits !== expectedWidthBits) continue;
    const computed = BigInt(algorithm.compute(data));
    if (computed === expectedNormal) {
      matches.push({
        id: algorithm.id,
        kind: 'simple',
        widthBits: algorithm.widthBits,
        computedHex: toHex(computed, algorithm.widthBits),
        matchedByteOrder: 'normal',
      });
    } else if (hasDistinctSwap && computed === expectedSwapped) {
      matches.push({
        id: algorithm.id,
        kind: 'simple',
        widthBits: algorithm.widthBits,
        computedHex: toHex(computed, algorithm.widthBits),
        matchedByteOrder: 'swapped',
      });
    }
  }

  return matches;
}
