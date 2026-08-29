/**
 * Pearson korelasyon katsayısı — spec §35 "Korelasyon analizi" ve ana spec'in
 * HDLC reverse-engineering örneği (gyro Heading 90° iken gövdede `23 28`,
 * 100° iken `27 10` görülüyorsa sayısal korelasyon kurulabilir).
 *
 * ── SIFIR DEĞİL, BİLİNMİYOR ───────────────────────────────────────────────
 * Katsayı iki seride de DEĞİŞİM olmasını gerektirir. Serilerden biri sabitse
 * payda sıfırdır ve katsayı TANIMSIZDIR. Bu durumda 0 dönmek "ilişki yok"
 * demek olurdu; oysa doğru cevap "bu veriyle söylenemez"dir — sabit bir alan
 * her seriyle uyumludur da, uyumsuzdur da. `undefined` döner.
 */

const MIN_SAMPLE_COUNT = 2;

/**
 * İki eşit uzunluklu serinin Pearson katsayısı (−1…1). Uzunluklar farklıysa,
 * iki örnekten az varsa ya da serilerden biri sabitse `undefined`.
 */
export function pearsonCorrelation(left: readonly number[], right: readonly number[]): number | undefined {
  if (left.length !== right.length || left.length < MIN_SAMPLE_COUNT) return undefined;

  const count = left.length;
  let sumLeft = 0;
  let sumRight = 0;
  for (let i = 0; i < count; i++) {
    sumLeft += left[i] ?? 0;
    sumRight += right[i] ?? 0;
  }
  const meanLeft = sumLeft / count;
  const meanRight = sumRight / count;

  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let i = 0; i < count; i++) {
    const deltaLeft = (left[i] ?? 0) - meanLeft;
    const deltaRight = (right[i] ?? 0) - meanRight;
    covariance += deltaLeft * deltaRight;
    varianceLeft += deltaLeft * deltaLeft;
    varianceRight += deltaRight * deltaRight;
  }

  if (varianceLeft === 0 || varianceRight === 0) return undefined;
  return covariance / Math.sqrt(varianceLeft * varianceRight);
}
