/**
 * Sabit kapasiteli halka arabellek — canlı akışta biriken kayıtları sınırlı
 * bellekte tutar (spec §44: "100.000 satırlık log arayüzü dondurmamalı").
 *
 * Neden dizi + `shift()` değil: `shift()` O(n)'dir, 100 bin elemanlı dizide
 * saniyede binlerce kez çağrılırsa tek başına UI thread'ini bloklar. Halka
 * arabellekte hem yazma hem indeksli okuma O(1).
 *
 * Neden `toArray()` sıcak yolda kullanılmaz: sanallaştırılmış tablo yalnız
 * görünen ~40 satırı ister; `at(index)` diziyi hiç maddileştirmeden o satırı
 * verir. `toArray()` dışa aktarma gibi soğuk yollar içindir.
 *
 * Dolduğunda EN ESKİ kayıt düşer (drop-oldest). Canlı monitörde yeni veri
 * eskisinden değerlidir; ayrıca düşen kayıt sayısı `droppedCount` ile
 * sayılır, böylece arayüz "veri atıldı" bilgisini gizlemek zorunda kalmaz.
 */

export interface RingBuffer<T> {
  readonly capacity: number;
  /** Şu an tutulan kayıt sayısı — `capacity`yi aşmaz. */
  readonly size: number;
  /** Kapasite taşması yüzünden atılan kayıt sayısı. */
  readonly droppedCount: number;
  /** Arabelleğe hiç girmiş toplam kayıt sayısı (`size + droppedCount`). */
  readonly totalPushed: number;
  push(item: T): void;
  /** `index` 0 = en ESKİ tutulan kayıt. Aralık dışıysa `undefined`. */
  at(index: number): T | undefined;
  /** Son `count` kaydı eskiden yeniye sırayla verir. */
  latest(count: number): T[];
  /** `[start, end)` aralığını eskiden yeniye verir; aralık kırpılır. */
  slice(start: number, end: number): T[];
  toArray(): T[];
  clear(): void;
}

export function createRingBuffer<T>(capacity: number): RingBuffer<T> {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError(`Halka arabellek kapasitesi pozitif tam sayı olmalı, verilen: ${capacity}`);
  }

  // `undefined` ile dolu sabit uzunlukta depo; `count` kaç gözün dolu olduğunu
  // söyler, bu yüzden `undefined` bir kayıt değeri olarak asla okunmaz.
  const store: (T | undefined)[] = new Array<T | undefined>(capacity).fill(undefined);
  let head = 0;
  let count = 0;
  let dropped = 0;

  function physicalIndex(logicalIndex: number): number {
    const start = (head - count + capacity) % capacity;
    return (start + logicalIndex) % capacity;
  }

  function readRange(start: number, end: number): T[] {
    const from = Math.max(0, Math.min(start, count));
    const to = Math.max(from, Math.min(end, count));
    const result: T[] = [];
    for (let index = from; index < to; index += 1) {
      const item = store[physicalIndex(index)];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  return {
    capacity,
    get size() {
      return count;
    },
    get droppedCount() {
      return dropped;
    },
    get totalPushed() {
      return count + dropped;
    },

    push(item: T): void {
      store[head] = item;
      head = (head + 1) % capacity;
      if (count < capacity) {
        count += 1;
      } else {
        // Dolu: `head` yeni yazımla birlikte en eski kaydın üstüne bindi.
        dropped += 1;
      }
    },

    at(index: number): T | undefined {
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        return undefined;
      }
      return store[physicalIndex(index)];
    },

    latest(requested: number): T[] {
      if (requested <= 0) {
        return [];
      }
      return readRange(count - requested, count);
    },

    slice(start: number, end: number): T[] {
      return readRange(start, end);
    },

    toArray(): T[] {
      return readRange(0, count);
    },

    clear(): void {
      store.fill(undefined);
      head = 0;
      count = 0;
      dropped = 0;
    },
  };
}
