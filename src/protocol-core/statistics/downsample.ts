/**
 * Grafik seyreltme (downsampling) — spec §37 "Downsampling" ve §44 "grafik
 * maksimum nokta sayısını sınırlamalı".
 *
 * Yöntem: LTTB (Largest Triangle Three Buckets). Neden basit "her N'inciyi al"
 * değil: sabit adımlı örnekleme tepe ve dip noktalarını atlar, yani sinyalin
 * ASIL bilgisi olan uçları siler. LTTB her kovadan, komşularıyla en büyük
 * üçgeni kuran noktayı seçer; tepe ve dipler korunur, çizginin görsel şekli
 * kaynağa sadık kalır.
 *
 * Girdi x'e göre ARTAN sıralı olmalı — canlı akışta zaman damgası doğal olarak
 * öyledir; sıralanmamış girdi için sonuç tanımsız değil ama anlamsızdır.
 */

export interface SamplePoint {
  readonly x: number;
  readonly y: number;
}

export function downsampleLttb(
  points: readonly SamplePoint[],
  threshold: number,
): SamplePoint[] {
  if (threshold >= points.length || threshold <= 0) {
    return [...points];
  }
  if (threshold === 1) {
    const only = points[points.length - 1];
    return only === undefined ? [] : [only];
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return [];
  }
  if (threshold === 2) {
    return [first, last];
  }

  const sampled: SamplePoint[] = [first];
  // İlk ve son nokta daima korunur; kalan threshold−2 nokta kovalara bölünür.
  const bucketSize = (points.length - 2) / (threshold - 2);
  let previous = first;

  for (let bucket = 0; bucket < threshold - 2; bucket += 1) {
    const bucketStart = Math.floor(bucket * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((bucket + 1) * bucketSize) + 1, points.length - 1);

    const nextStart = bucketEnd;
    const nextEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, points.length - 1);

    // Sonraki kovanın AĞIRLIK MERKEZİ üçgenin üçüncü köşesidir; tek bir sonraki
    // nokta kullanılsaydı seçim gürültüye aşırı duyarlı olurdu.
    let averageX = 0;
    let averageY = 0;
    let averageCount = 0;
    for (let index = nextStart; index < nextEnd; index += 1) {
      const point = points[index];
      if (point === undefined) {
        continue;
      }
      averageX += point.x;
      averageY += point.y;
      averageCount += 1;
    }
    if (averageCount === 0) {
      const fallback = points[points.length - 1];
      if (fallback !== undefined) {
        averageX = fallback.x;
        averageY = fallback.y;
        averageCount = 1;
      }
    }
    averageX /= averageCount;
    averageY /= averageCount;

    let bestPoint: SamplePoint | undefined;
    let bestArea = -1;
    for (let index = bucketStart; index < bucketEnd; index += 1) {
      const candidate = points[index];
      if (candidate === undefined) {
        continue;
      }
      const area = Math.abs(
        (previous.x - averageX) * (candidate.y - previous.y) -
          (previous.x - candidate.x) * (averageY - previous.y),
      );
      if (area > bestArea) {
        bestArea = area;
        bestPoint = candidate;
      }
    }

    if (bestPoint !== undefined) {
      sampled.push(bestPoint);
      previous = bestPoint;
    }
  }

  sampled.push(last);
  return sampled;
}
