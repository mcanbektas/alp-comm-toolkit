/**
 * BCD (Binary Coded Decimal) dönüşümü: her nibble tek bir ondalık basamak (0-9)
 * taşır. Birçok eski seri protokol (ör. bazı sayaç/POS frame'leri) tarih ve
 * miktar alanlarını ham binary yerine BCD ile taşır çünkü insan-okur hex dump'ta
 * doğrudan ondalık gibi görünür.
 */

const BCD_DIGITS_PER_BYTE = 2;
const BCD_HIGH_NIBBLE_SHIFT = 4;
const BCD_NIBBLE_MASK = 0x0f;
const BCD_MAX_DIGIT = 9;
const DECIMAL_RADIX = 10;
const CHAR_CODE_ZERO = '0'.charCodeAt(0);

/**
 * Negatif olmayan bir tam sayıyı BCD bayt dizisine çevirir. Basamak sayısı tek
 * ise en anlamlı nibble'a sıfır dolgu eklenir — her BCD baytı tam bir nibble
 * çifti taşımak zorunda, yarım bayt yok.
 *
 * Not: JS `number` 2^53 üstünde tam sayı hassasiyetini kaybeder; çok büyük
 * değerler için bu fonksiyon uygun değildir (protokol frame'lerindeki BCD
 * alanları pratikte birkaç bayt uzunluğunda olduğundan kapsam dışı bırakıldı).
 */
export function encodeBcd(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`BCD yalnız negatif olmayan tam sayıları kodlayabilir: ${value}`);
  }

  let digits = value.toString(DECIMAL_RADIX);
  if (digits.length % BCD_DIGITS_PER_BYTE !== 0) {
    digits = `0${digits}`;
  }

  const byteCount = digits.length / BCD_DIGITS_PER_BYTE;
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i += 1) {
    const highDigit = digits.charCodeAt(i * BCD_DIGITS_PER_BYTE) - CHAR_CODE_ZERO;
    const lowDigit = digits.charCodeAt(i * BCD_DIGITS_PER_BYTE + 1) - CHAR_CODE_ZERO;
    bytes[i] = (highDigit << BCD_HIGH_NIBBLE_SHIFT) | lowDigit;
  }
  return bytes;
}

/**
 * BCD bayt dizisini ondalık sayıya çevirir. Bir nibble 0x0A-0x0F aralığındaysa
 * (rakam değilse) hata fırlatır — bozuk/gerçek-olmayan BCD verisini sessizce
 * yanlış sayıya dönüştürmek yerine erken ve gürültülü durmak tercih edildi.
 */
export function decodeBcd(bytes: Uint8Array): number {
  let digits = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) {
      continue; // noUncheckedIndexedAccess: döngü sınırı içinde olsa da tip garantisi yok.
    }
    const highDigit = (byte >> BCD_HIGH_NIBBLE_SHIFT) & BCD_NIBBLE_MASK;
    const lowDigit = byte & BCD_NIBBLE_MASK;
    if (highDigit > BCD_MAX_DIGIT || lowDigit > BCD_MAX_DIGIT) {
      throw new Error(
        `Geçersiz BCD nibble: bayt ${i} (0x${byte.toString(16).padStart(BCD_DIGITS_PER_BYTE, '0')}) rakam değil bit içeriyor`,
      );
    }
    digits += `${highDigit}${lowDigit}`;
  }
  return digits.length === 0 ? 0 : Number(digits);
}
