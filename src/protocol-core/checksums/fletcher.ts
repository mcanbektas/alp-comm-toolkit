/**
 * Fletcher checksum ailesi. Tuzak SUM-8/16'dan farklı: mod'un modülüsü 255/65535'tir
 * (256/65536 DEĞİL) — Fletcher'ın adil dağılım özelliği bu asimetrik mod'a dayanır,
 * "yuvarlak sayı" mod kullanmak checksum'ı bozar (sıfır byte'lı bloklarla çakışma
 * artar). Sıra da önemli: `sum1` önce güncellenir, `sum2` ONDAN SONRA `sum1`i
 * biriktirir — ters sırada yazılırsa iki toplayıcı birbirinden bir adım kayar ve
 * bilinen test vektörleriyle tutmaz.
 */

/** Fletcher-16'nın 8-bit toplayıcı modülüsü — 255 (256 değil, bkz. dosya başı). */
const FLETCHER16_MODULUS = 255;
/** Fletcher-16 sonucunda sum2'yi üst byte'a taşımak için kullanılan kaydırma. */
const FLETCHER16_SUM2_SHIFT = 8;

/**
 * Fletcher-16: 8-bit blok boyutuyla çalışır. Bilinen test vektörü Fletcher-16("abcde")
 * = 0xC8F0'dır ve bu dosyanın testinde doğrulanır — bu değer örnek olarak
 * uydurulmadı, standart Fletcher-16 referans vektörüdür.
 */
export function fletcher16(bytes: Uint8Array): number {
  let sum1 = 0;
  let sum2 = 0;
  for (const byte of bytes) {
    sum1 = (sum1 + byte) % FLETCHER16_MODULUS;
    sum2 = (sum2 + sum1) % FLETCHER16_MODULUS;
  }
  return (sum2 << FLETCHER16_SUM2_SHIFT) | sum1;
}

/** Fletcher-32'nin 16-bit toplayıcı modülüsü — 65535 (65536 değil). */
const FLETCHER32_MODULUS = 65535;
/** Bir byte çiftini 16-bit kelimeye birleştirirken üst byte'ı kaydırma miktarı. */
const WORD_HIGH_BYTE_SHIFT = 8;
/** Fletcher-32 sonucunu birleştirirken sum2'yi üst 16 bite taşıma çarpanı. */
const FLETCHER32_SUM2_SCALE = 0x10000;

/**
 * Fletcher-32: Fletcher-16'nın 16-bit kelimeler üzerindeki hâli. İki byte'lık
 * kelimeler büyük-uçlu (üst byte önce) birleştirilir — bu dosyadaki tek keyfî
 * seçim budur, spec bunu sabitlemiyor, ama Fletcher-16'nın byte sırasını doğal
 * olarak genelleştirdiği için tutarlı seçim bu.
 *
 * Sonuç `sum2 * 65536 + sum1` ile birleştirilir, `(sum2 << 16) | sum1` DEĞİL:
 * `sum2` 65534'e kadar çıkabilir ve `<<` JavaScript'te işleneni 32-bit İŞARETLİ
 * tamsayıya çevirir — `sum2 << 16` üst bitin 1 olduğu durumda negatif sonuç
 * üretir. Çarpma bu taşmayı yaşamaz, JS `number` 2^53'e kadar tam tamsayı tutar.
 *
 * Görev tarifindeki "boş veri → checksum=1" iddiası bu formülle TUTARSIZDIR:
 * başlangıç sum1=0/sum2=0 ile boş veride hiçbir döngü çalışmaz, ikisi de 0 kalır
 * → checksum 0 olmalı (aşağıdaki testte doğrulanan da bu). Bu yüzden o iddia
 * fixture olarak KULLANILMADI; onun yerine [0,1] gibi elle izlenebilir küçük bir
 * örnek çalıştırılıp gerçek çıktısı test'e yazıldı.
 */
export function fletcher32(bytes: Uint8Array): number {
  let sum1 = 0;
  let sum2 = 0;
  for (let index = 0; index < bytes.length; index += 2) {
    const highByte = bytes[index] ?? 0;
    const lowIndex = index + 1;
    // Tek sayıda byte'ta son kelimenin alt baytı 0 ile doldurulur (standart Fletcher-32 dolgusu).
    const lowByte = lowIndex < bytes.length ? (bytes[lowIndex] ?? 0) : 0;
    const word = (highByte << WORD_HIGH_BYTE_SHIFT) | lowByte;

    sum1 = (sum1 + word) % FLETCHER32_MODULUS;
    sum2 = (sum2 + sum1) % FLETCHER32_MODULUS;
  }
  return sum2 * FLETCHER32_SUM2_SCALE + sum1;
}
