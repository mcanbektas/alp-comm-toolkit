/**
 * Sanallaştırma penceresi hesabı — spec §44 "büyük tablolar virtualized olmalı".
 *
 * Saf fonksiyon olarak ayrıldı çünkü bileşenin içinde kalsaydı yalnız jsdom
 * üzerinden, üstelik `clientHeight`ı 0 olan sahte bir düzenle sınanabilirdi.
 * Burada aritmetiğin kendisi doğrudan doğrulanıyor.
 *
 * Sabit satır yüksekliği varsayılır. Değişken yükseklik ölçüm turu ve konum
 * önbelleği gerektirir; canlı monitörde bütün satırlar aynı düzende olduğu için
 * o karmaşıklığın karşılığı yok.
 */

export interface WindowRangeInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
  readonly rowCount: number;
  /** Görünür pencerenin iki ucuna eklenen yedek satır sayısı — hızlı kaydırmada boş alanı önler. */
  readonly overscan: number;
}

export interface WindowRange {
  readonly startIndex: number;
  /** Dışlayıcı üst sınır: render edilecek aralık `[startIndex, endIndex)`. */
  readonly endIndex: number;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly totalHeight: number;
}

const EMPTY_RANGE: WindowRange = {
  startIndex: 0,
  endIndex: 0,
  paddingTop: 0,
  paddingBottom: 0,
  totalHeight: 0,
};

export function computeWindowRange(input: WindowRangeInput): WindowRange {
  const { rowHeight, rowCount } = input;

  if (!(rowHeight > 0) || rowCount <= 0) {
    return EMPTY_RANGE;
  }

  const totalHeight = rowCount * rowHeight;
  // Negatif scrollTop tarayıcıların "rubber band" davranışında görülebilir.
  const scrollTop = Math.max(0, input.scrollTop);
  const viewportHeight = Math.max(0, input.viewportHeight);
  const overscan = Math.max(0, Math.floor(input.overscan));

  const firstVisible = Math.min(rowCount - 1, Math.floor(scrollTop / rowHeight));
  // +1: görünür alanın üstünde ve altında yarım kalan satırlar da çizilmeli.
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 1;

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(rowCount, firstVisible + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * rowHeight,
    paddingBottom: totalHeight - endIndex * rowHeight,
    totalHeight,
  };
}
