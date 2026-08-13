/**
 * Bayt sınırı tanımayan bit okuyucu/yazıcı — spec §9.4 (bit field) ve §9.1'in
 * `bitField` tipi için.
 *
 * Neden `buffers/bitOps.ts` yetmiyor: orası TEK BİR sayı üzerinde çalışır ve
 * 32 bitle sınırlıdır (`validateBitWidthAndShift` 32 üstünü reddeder). Şemadaki
 * bir bit alanı ise bayt dizisinin herhangi bir bitinden başlayıp bayt
 * sınırlarını aşabilir ve 64 bit olabilir. İkisi farklı iş yapıyor, bu yüzden
 * ayrı modül — bitOps sayı düzeyinde, bitCursor akış düzeyinde.
 *
 * Değerler `bigint` döner: 53 bitten geniş alanlarda `number` sessizce yuvarlar
 * ve hata vermez (spec §47 "BigInt gereken yerlerde BigInt kullan").
 *
 * ## Bit sırası
 *
 * `msb-first` (varsayılan): bit 0, ilk baytın EN YÜKSEK bitidir. Ağ/telekom
 * protokollerinin ve çoğu veri sayfasının bit numaralandırması budur.
 *
 * `lsb-first`: bit 0, ilk baytın EN DÜŞÜK bitidir. CAN sinyal tanımları (DBC)
 * ve bazı gömülü protokoller böyle sayar.
 *
 * Sıra yanlış seçilirse hata OLUŞMAZ, yalnız değer yanlış çıkar — bu yüzden
 * varsayılan açıkça belgelendi.
 */

export type BitOrder = 'msb-first' | 'lsb-first';

export const BITS_PER_BYTE = 8;

function bitAt(bytes: Uint8Array, absoluteBit: number, bitOrder: BitOrder): number {
  const byteIndex = Math.floor(absoluteBit / BITS_PER_BYTE);
  const byte = bytes[byteIndex];
  if (byte === undefined) {
    throw new RangeError(`Bit ${absoluteBit} arabellek dışında (${bytes.length} bayt)`);
  }
  const bitInByte = absoluteBit % BITS_PER_BYTE;
  const shift = bitOrder === 'msb-first' ? BITS_PER_BYTE - 1 - bitInByte : bitInByte;
  return (byte >> shift) & 1;
}

/**
 * `bitPosition`den başlayarak `bitLength` bit okur.
 *
 * `msb-first`te ilk okunan bit sonucun EN YÜKSEK biti olur; `lsb-first`te en
 * düşük biti. İki sıra yalnız numaralandırmada değil, bitlerin sayıya
 * dizilişinde de farklıdır.
 */
export function readBits(
  bytes: Uint8Array,
  bitPosition: number,
  bitLength: number,
  bitOrder: BitOrder = 'msb-first',
): bigint {
  if (!Number.isInteger(bitPosition) || bitPosition < 0) {
    throw new RangeError(`Bit konumu negatif olmayan tam sayı olmalı: ${bitPosition}`);
  }
  if (!Number.isInteger(bitLength) || bitLength < 0) {
    throw new RangeError(`Bit uzunluğu negatif olmayan tam sayı olmalı: ${bitLength}`);
  }
  if (bitLength === 0) {
    return 0n;
  }
  if (bitPosition + bitLength > bytes.length * BITS_PER_BYTE) {
    throw new RangeError(
      `Bit aralığı [${bitPosition}, ${bitPosition + bitLength}) ${bytes.length} baytlık arabelleği aşıyor`,
    );
  }

  let value = 0n;
  for (let index = 0; index < bitLength; index += 1) {
    const bit = BigInt(bitAt(bytes, bitPosition + index, bitOrder));
    if (bitOrder === 'msb-first') {
      value = (value << 1n) | bit;
    } else {
      value |= bit << BigInt(index);
    }
  }
  return value;
}

/**
 * `readBits`in sayı döndüren biçimi. 53 bitten geniş istenirse ATAR — sessizce
 * yuvarlanmış bir ölçüm, hata vermeyen bir hatadır.
 */
export function readBitsAsNumber(
  bytes: Uint8Array,
  bitPosition: number,
  bitLength: number,
  bitOrder: BitOrder = 'msb-first',
): number {
  if (bitLength > 53) {
    throw new RangeError(
      `${bitLength} bit Number'a güvenle sığmaz (azami 53); readBits kullanın`,
    );
  }
  return Number(readBits(bytes, bitPosition, bitLength, bitOrder));
}

/** `bitLength` bitlik iki tümleyen değeri işaretli sayıya çevirir. */
export function toSignedBits(value: bigint, bitLength: number): bigint {
  if (bitLength <= 0) {
    return 0n;
  }
  const signBit = 1n << BigInt(bitLength - 1);
  return (value & signBit) === 0n ? value : value - (1n << BigInt(bitLength));
}

/**
 * `value`nun alt `bitLength` bitini arabelleğe yazar. Hedefteki diğer bitlere
 * dokunmaz — bit alanları aynı baytı paylaşabilir.
 */
export function writeBits(
  target: Uint8Array,
  bitPosition: number,
  bitLength: number,
  value: bigint,
  bitOrder: BitOrder = 'msb-first',
): void {
  if (bitLength === 0) {
    return;
  }
  if (bitPosition < 0 || bitPosition + bitLength > target.length * BITS_PER_BYTE) {
    throw new RangeError(
      `Bit aralığı [${bitPosition}, ${bitPosition + bitLength}) ${target.length} baytlık arabelleği aşıyor`,
    );
  }

  for (let index = 0; index < bitLength; index += 1) {
    // msb-first: değerin en yüksek biti önce yazılır.
    const sourceShift = bitOrder === 'msb-first' ? BigInt(bitLength - 1 - index) : BigInt(index);
    const bit = Number((value >> sourceShift) & 1n);

    const absoluteBit = bitPosition + index;
    const byteIndex = Math.floor(absoluteBit / BITS_PER_BYTE);
    const bitInByte = absoluteBit % BITS_PER_BYTE;
    const targetShift = bitOrder === 'msb-first' ? BITS_PER_BYTE - 1 - bitInByte : bitInByte;

    const current = target[byteIndex] ?? 0;
    const cleared = current & ~(1 << targetShift);
    target[byteIndex] = (cleared | (bit << targetShift)) & 0xff;
  }
}

/** Bit konumunu bir sonraki bayt sınırına yuvarlar. */
export function alignToByte(bitPosition: number): number {
  const remainder = bitPosition % BITS_PER_BYTE;
  return remainder === 0 ? bitPosition : bitPosition + (BITS_PER_BYTE - remainder);
}
