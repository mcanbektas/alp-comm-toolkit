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

import { adler32 } from './adler32';
import { CRC_CATALOGUE } from './crcCatalogue';
import { crc } from './crcEngine';
import { fletcher16, fletcher32 } from './fletcher';
import { lrcChecksum } from './lrc';
import { nmeaXorChecksum } from './nmeaChecksum';
import { sum8Checksum, xor8Checksum } from './simpleChecksums';

/**
 * Motorun hesaplayabildiği HER algoritma: `CRC_CATALOGUE`nun 18 CRC'si ve spec
 * §11'in basit checksum'ları, eksiksiz.
 *
 * Liste eskiden "seri/alan hatlarında fiilen görülenler" diye 11 kayda
 * daraltılmıştı. Daraltma kasıtlıydı ama bedeli seçiciyi kısaltmak değil,
 * PROTOKOL TANIMLANAMAZ kılmaktı: CRC-8/AUTOSAR ya da CRC-16/DNP kullanan bir
 * cihaz için Studio'da şema yazılamıyordu, üstelik motor o CRC'yi zaten
 * hesaplayabildiği hâlde. Bir algoritmayı listeden çıkarmak onu "nadir"
 * yapmıyor, yalnız erişilemez yapıyordu. Bu yüzden ölçüt artık tek ve
 * denetlenebilir: `computeChecksum` hesaplayabiliyorsa liste onu taşır —
 * `checksumWidthBytes`in ve `computeChecksum`ın son dalları katalogda olmayan
 * bir kayıt kalırsa DERLENMEZ, yani liste bir daha sessizce ayrışamaz.
 *
 * Sıra anlamlıdır ve arayüzdeki seçicinin sırasıdır: `none`, sonra basit
 * algoritmalar, sonra CRC'ler; her grup genişliğe göre artan, aynı genişlikte
 * alfabetik.
 */
export const CHECKSUM_ALGORITHMS = [
  'none',
  // Basit (CRC olmayan) — 1 bayt
  'lrc',
  'nmeaXor',
  'sum8',
  'xor8',
  // Basit — 2 bayt
  'fletcher16',
  // Basit — 4 bayt
  'adler32',
  'fletcher32',
  // CRC — 1 bayt (4–8 bit)
  'CRC4_ITU',
  'CRC5_USB',
  'CRC6_ITU',
  'CRC7_MMC',
  'CRC8',
  'CRC8_AUTOSAR',
  'CRC8_MAXIM',
  'CRC8_SAE_J1850',
  // CRC — 2 bayt
  'CRC16_ARC',
  'CRC16_CCITT_FALSE',
  'CRC16_DNP',
  'CRC16_MODBUS',
  'CRC16_USB',
  'CRC16_X25',
  'CRC16_XMODEM',
  // CRC — 3 bayt
  'CRC24',
  // CRC — 4 bayt
  'CRC32',
  'CRC32C',
  // CRC — 8 bayt
  'CRC64',
] as const;

export type ChecksumAlgorithm = (typeof CHECKSUM_ALGORITHMS)[number];

/**
 * CRC olmayan algoritmaların bayt genişliği.
 *
 * Tablo ŞART: bu grup eskiden "hepsi 1 bayt" varsayılıyordu ve varsayım
 * XOR8/SUM8/LRC için doğru olduğundan fark edilmiyordu. Fletcher-16 iki,
 * Fletcher-32 ve Adler-32 dört bayt yazar; varsayım kalsaydı
 * `checksumWidthBytes` çağıranına yalan söyler, çerçevede checksum yanlış
 * yerden okunur ve alan hizası bir daha tutmazdı.
 *
 * `satisfies` anahtarları `ChecksumAlgorithm` ile sınırlar: burada olup listede
 * olmayan bir ad yazılamaz.
 */
const SIMPLE_ALGORITHM_WIDTH_BYTES = {
  lrc: 1,
  nmeaXor: 1,
  sum8: 1,
  xor8: 1,
  fletcher16: 2,
  adler32: 4,
  fletcher32: 4,
} as const satisfies Partial<Record<ChecksumAlgorithm, number>>;

/** Spec §39'un ayrı sayaçta tuttuğu grup: CRC olmayan checksum'lar. */
export type SimpleChecksumAlgorithm = keyof typeof SIMPLE_ALGORITHM_WIDTH_BYTES;

const SIMPLE_ALGORITHM_IDS: ReadonlySet<string> = new Set(
  Object.keys(SIMPLE_ALGORITHM_WIDTH_BYTES),
);

/**
 * Tip daraltıcı: `false` dalında geriye yalnız `none` ve CRC kimlikleri kalır.
 * Çağıranların (kod üreticileri) `as CrcAlgorithmId` dönüşümü yazmadan
 * `CRC_CATALOGUE`ya inebilmesinin tek yolu bu.
 */
export function isSimpleChecksumAlgorithm(
  algorithm: ChecksumAlgorithm,
): algorithm is SimpleChecksumAlgorithm {
  return SIMPLE_ALGORITHM_IDS.has(algorithm);
}

export function isChecksumAlgorithm(value: string): value is ChecksumAlgorithm {
  return (CHECKSUM_ALGORITHMS as readonly string[]).includes(value);
}

export function checksumWidthBytes(algorithm: ChecksumAlgorithm): number {
  if (algorithm === 'none') {
    return 0;
  }
  if (isSimpleChecksumAlgorithm(algorithm)) {
    return SIMPLE_ALGORITHM_WIDTH_BYTES[algorithm];
  }
  // 4 bitlik bir CRC de bir bayt kaplar; genişlik yukarı yuvarlanır.
  return Math.ceil(CRC_CATALOGUE[algorithm].width / 8);
}

/**
 * NMEA'nın XOR'u METİN üzerinde tanımlı (`nmeaChecksum.ts` cümlenin `$`/`*`
 * arasındaki gövdesini alır); burada kapsanan BAYTLAR veriliyor. Baytlar
 * Latin-1 olarak karaktere çevrilir: her bayt bire bir aynı kod noktasına
 * gider, `charCodeAt` de aynı sayıyı geri verir, yani XOR bayt dizisininkiyle
 * özdeştir. `TextDecoder('utf-8')` KULLANILAMAZ — çok baytlı diziyi tek kod
 * noktasına katlar ve checksum sessizce değişirdi.
 */
function latin1Text(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return text;
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
    // NMEA'nın XOR'u sayısal olarak XOR8'in aynısıdır; ayrı kayıt olmasının
    // sebebi NİYET: cümle gövdesini kapsayan bir NMEA alanı böyle etiketlenir.
    case 'nmeaXor':
      return BigInt(nmeaXorChecksum(latin1Text(bytes)));
    case 'fletcher16':
      return BigInt(fletcher16(bytes));
    case 'fletcher32':
      return BigInt(fletcher32(bytes));
    case 'adler32':
      return BigInt(adler32(bytes));
    default:
      // Buraya yalnız CRC kimlikleri düşer; listeye katalogda olmayan bir ad
      // eklenirse bu indeksleme derlenmez.
      return crc(bytes, CRC_CATALOGUE[algorithm]);
  }
}

/**
 * Çerçevede saklanan checksum baytlarını sayıya çevirir.
 *
 * Hesap doğrudan `bigint` üzerinde yapılır, `bytesToNumber` üzerinden DEĞİL:
 * o yardımcı 6 bayttan uzun diziyi `RangeError` ile reddediyor (2^53 sınırı) ve
 * CRC64'ün 8 baytı tam oraya düşüyordu. `computeChecksum` da `bigint` döndüğü
 * için karşılaştırma zaten aynı tipte.
 */
export function readStoredChecksum(
  bytes: Uint8Array,
  endianness: 'big' | 'little',
): bigint {
  let value = 0n;
  for (let index = 0; index < bytes.length; index += 1) {
    // Big-endian'da en anlamlı bayt başta, little'da sonda; iki durumda da
    // en anlamlıdan başlanarak kaydırılır.
    const byte = bytes[endianness === 'big' ? index : bytes.length - 1 - index] ?? 0;
    value = (value << 8n) | BigInt(byte);
  }
  return value;
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
