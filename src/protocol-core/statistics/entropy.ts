/**
 * Shannon entropisi — spec §35'in ikinci formülü:
 *
 *   H(X) = −Σ p(x) × log2 p(x)
 *
 * Bilinmeyen protokol analizinde entropi bir alanın NE TAŞIDIĞINI ayırt eder:
 * sabit bir başlık baytı 0 bit, artan bir sayaç düşük, şifreli ya da sıkıştırılmış
 * bir gövde 8 bite yakın çıkar. Birim BİT'tir ve bir bayt için üst sınır 8'dir.
 *
 * ── SAYISAL KENAR ─────────────────────────────────────────────────────────
 * `p = 0` olan değerler toplama HİÇ girmez: `0 × log2(0)` matematikte 0 kabul
 * edilir ama JavaScript'te `0 * -Infinity = NaN` verir. Terim atlanmazsa tek bir
 * görülmeyen bayt değeri bütün sonucu NaN yapardı.
 */

const BITS_PER_BYTE = 8;

/** Bir baytın taşıyabileceği azami entropi. */
export const MAX_BYTE_ENTROPY_BITS = BITS_PER_BYTE;

/**
 * Değer dizisinin entropisi (bit). Boş dizide 0 döner — "belirsizlik yok",
 * çünkü hiç gözlem yok. Tek değerli dizide de 0'dır (p=1, log2(1)=0).
 */
export function shannonEntropyBits(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    // p = 0 olan değer zaten haritada yok; log2(0) tuzağına düşülmez.
    const probability = count / values.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/** Bayt dizisinin entropisi (bit); 0…8 arasında. */
export function byteEntropyBits(bytes: Uint8Array): number {
  return shannonEntropyBits(Array.from(bytes));
}

/**
 * Entropinin azami değere oranı (0…1). Farklı alfabelerdeki alanları
 * karşılaştırmak için; ham bit değeri tek başına "yüksek mi" sorusuna cevap
 * vermez.
 */
export function normalizedByteEntropy(bytes: Uint8Array): number {
  return byteEntropyBits(bytes) / MAX_BYTE_ENTROPY_BITS;
}
