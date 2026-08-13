/**
 * En basit checksum aileleri: tek geçişte, taşıma olmadan hesaplanan byte
 * toplamları/XOR'ları. CRC ailesi (polinom bölme) burada YOK — ayrı bir
 * motorun işi, bu dosya yalnız spec §43'teki "basit checksum" grubunu kapsar.
 *
 * Hepsi `for...of` ile Uint8Array üzerinde dolaşır: `noUncheckedIndexedAccess`
 * yalnız İNDEKSLİ erişimi (`bytes[i]`) `number | undefined` yapar, `for...of`
 * elemanı doğrudan `number` verir — burada indeks gerekmediği için guard'a
 * gerek yok (Fletcher-32'de kelime eşleşmesi indeks istediği için orada var).
 */

/** SUM-8/SUM-16 ve tümleyen checksum'ların ortak modülüsü — bir byte'ın alabileceği üst sınır. */
const BYTE_MODULUS = 256;
/** SUM-16'nın modülüsü — iki byte'lık toplayıcının üst sınırı. */
const WORD_MODULUS = 65536;
/** One's complement: 8 bitin tamamı 1 olduğu değer, tümleyen bundan çıkarılır. */
const BYTE_ALL_ONES = 0xff;

/** Tüm byte'ların XOR'u — tek byte'lık en basit checksum, sıra bağımsızdır. */
export function xor8Checksum(bytes: Uint8Array): number {
  let result = 0;
  for (const byte of bytes) {
    result ^= byte;
  }
  return result;
}

/** Tüm byte'ların toplamı, 8 bite taşarsa mod 256 ile kırpılır. */
export function sum8Checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (const byte of bytes) {
    sum += byte;
  }
  return sum % BYTE_MODULUS;
}

/** SUM-8 ile aynı toplama, yalnız 16 bite kadar taşımaya izin verir (mod 65536). */
export function sum16Checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (const byte of bytes) {
    sum += byte;
  }
  return sum % WORD_MODULUS;
}

/**
 * SUM-8'in 8-bit two's complement'i: `256 − (sum mod 256)`. Tuzak, sum mod 256
 * tam 0 çıktığında `256 − 0 = 256` olması — 8 bite sığmayan bir değer. `% BYTE_MODULUS`
 * ikinci kez uygulanarak bu durum ayrı bir dala gerek kalmadan 0'a katlanır
 * (256 mod 256 = 0), böylece "veri + checksum" toplamı her zaman mod 256 sıfırdır.
 */
export function twosComplementChecksum(bytes: Uint8Array): number {
  const sum = sum8Checksum(bytes);
  return (BYTE_MODULUS - sum) % BYTE_MODULUS;
}

/**
 * SUM-8'in 8-bit one's complement'i: `0xFF − (sum mod 256)`. `sum8Checksum` zaten
 * [0, 255] aralığında döndüğü için burada taşma/mod ikinci kez gerekmez —
 * two's complement'teki 256 sınırı tuzağı burada yok.
 */
export function onesComplementChecksum(bytes: Uint8Array): number {
  const sum = sum8Checksum(bytes);
  return BYTE_ALL_ONES - sum;
}
