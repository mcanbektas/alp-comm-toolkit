/**
 * Kayan pencereli hız ölçer — spec §39'un "Packet rate" ve "Byte rate"
 * metrikleri için.
 *
 * Neden ömür boyu ortalama değil: canlı monitörde hız DEĞİŞİR. Başlangıçtan
 * beri ortalama, akış durduğunda bile yüksek görünür ve "şu an ne oluyor"
 * sorusuna yanlış cevap verir. Kayan pencere son `windowMs` içindeki gerçek
 * hızı gösterir.
 *
 * Neden zaman damgası listesi değil: saniyede binlerce olayda liste tutup
 * budamak O(n) olur. Sabit sayıda kova (bucket) kullanılıyor; hem ekleme hem
 * okuma O(bucketCount), yani olay sayısından bağımsız.
 */

export interface RateMeter {
  /** `nowMs` **`performance.now()` tabanlı** olmalı — sayaçlar bu saatle yaşlanır. */
  record(nowMs: number, amount?: number): void;
  /** Son pencere içindeki saniye başına miktar. Hiç olay yoksa 0. */
  rate(nowMs: number): number;
  reset(): void;
}

export function createRateMeter(windowMs: number, bucketCount: number): RateMeter {
  if (!Number.isInteger(bucketCount) || bucketCount <= 0) {
    throw new RangeError(`Kova sayısı pozitif tam sayı olmalı, verilen: ${bucketCount}`);
  }
  if (!(windowMs > 0)) {
    throw new RangeError(`Pencere pozitif olmalı, verilen: ${windowMs}`);
  }

  const bucketMs = windowMs / bucketCount;
  const amounts = new Float64Array(bucketCount);
  // Her kovanın hangi zaman dilimine ait olduğu; eski dilim gelirse kova sıfırlanır.
  const slots = new Float64Array(bucketCount).fill(Number.NEGATIVE_INFINITY);

  function slotOf(nowMs: number): number {
    return Math.floor(nowMs / bucketMs);
  }

  /** Pencereden düşmüş kovaları sıfırlar; okuma ve yazma aynı yaşlandırmayı görmeli. */
  function expire(nowMs: number): void {
    const currentSlot = slotOf(nowMs);
    const oldestValidSlot = currentSlot - bucketCount + 1;
    for (let index = 0; index < bucketCount; index += 1) {
      const slot = slots[index] ?? Number.NEGATIVE_INFINITY;
      if (slot < oldestValidSlot) {
        amounts[index] = 0;
        slots[index] = Number.NEGATIVE_INFINITY;
      }
    }
  }

  return {
    record(nowMs: number, amount = 1): void {
      expire(nowMs);
      const slot = slotOf(nowMs);
      const index = ((slot % bucketCount) + bucketCount) % bucketCount;
      if (slots[index] !== slot) {
        slots[index] = slot;
        amounts[index] = 0;
      }
      amounts[index] = (amounts[index] ?? 0) + amount;
    },

    rate(nowMs: number): number {
      expire(nowMs);
      let total = 0;
      for (let index = 0; index < bucketCount; index += 1) {
        total += amounts[index] ?? 0;
      }
      return (total * 1000) / windowMs;
    },

    reset(): void {
      amounts.fill(0);
      slots.fill(Number.NEGATIVE_INFINITY);
    },
  };
}
