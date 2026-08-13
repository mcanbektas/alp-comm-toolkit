/**
 * Adler-32 (zlib'in checksum'ı). Fletcher'a benzer iki toplayıcılı yapı ama iki
 * kritik farkla: `A` 0 değil 1'den başlar (böylece tamamı sıfır bir veri, boş
 * veriden farklı bir checksum üretir — Fletcher'ın boş/sıfır-blok zaafına karşı
 * Adler'in düzeltmesi budur) ve mod 65521'dir (16 bite sığan en büyük asal,
 * 65535/65536 DEĞİL).
 */

/** 16 bite sığan en büyük asal sayı — Adler-32'nin mod'u, Fletcher'ın 65535'inden farklı. */
const ADLER_MODULUS = 65521;
/** Sonucu birleştirirken B'yi üst 16 bite taşıma çarpanı. `<<` yerine çarpma: B 65520'ye
 * kadar çıkabilir ve `<<` JS'te 32-bit işaretli tamsayıya çevirip negatif sonuç üretebilir. */
const ADLER_B_SCALE = 0x10000;

/**
 * Bilinen gerçek test vektörü: Adler-32("Wikipedia") = 0x11E60398 — bu dosyanın
 * testinde ASCII byte'ları üzerinde doğrulanır.
 */
export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % ADLER_MODULUS;
    b = (b + a) % ADLER_MODULUS;
  }
  return b * ADLER_B_SCALE + a;
}
