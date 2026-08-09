/**
 * ByteViewer'ın kendi sözleşmesi. Burası KASITLI olarak `protocol-core`'dan
 * bağımsızdır: görüntüleyici saf sunum katmanıdır, protokol tiplerine
 * bağlanırsa her `ParsedField` değişikliğinde UI kırılır. `ParsedField →
 * ByteRegion` köprüsü ayrı bir adaptörde yazılacak; oradaki tek yön bağımlılık
 * (adaptör → viewer) bu dosyayı sabit tutar.
 */

/** 0..3 — `text-series-1..4` token renklerine eşlenir. */
export type SeriesColorIndex = 0 | 1 | 2 | 3;

export interface ByteRegion {
  id: string;
  name: string;
  /** Çerçeve içindeki bayt konumu (kalibrasyon ofseti DEĞİL — spec bu ikisini aynı adla anıyor). */
  offset: number;
  length: number;
  /** 0..3 — series-1..4 token renklerine eşlenir; verilmezse sırayla dağıtılır. */
  colorIndex?: SeriesColorIndex;
  /** Alan doğrulamayı geçemediyse hata vurgusu uygulanır. */
  invalid?: boolean;
}

export interface ByteViewerProps {
  bytes: Uint8Array;
  regions?: readonly ByteRegion[];
  /** Satır başına bayt. Varsayılan 16. */
  bytesPerRow?: number;
  /** Ofset sütununu gizle. */
  hideOffsets?: boolean;
  /** ASCII sütununu gizle. */
  hideAscii?: boolean;
  selectedRegionId?: string | null;
  onRegionHover?: (regionId: string | null) => void;
  onRegionSelect?: (regionId: string) => void;
  emptyLabel?: string;
}

/**
 * Tek bayt. `hex`/`ascii` layout aşamasında bir kez hesaplanır; render sırasında
 * yeniden üretmek 16K hücrede ölçülebilir maliyet demek.
 */
export interface ByteCell {
  /** Çerçevenin başından itibaren MUTLAK bayt indeksi (satır içi değil). */
  index: number;
  value: number;
  hex: string;
  ascii: string;
}

export interface ByteRow {
  /** Satırın ilk baytının mutlak indeksi. Son satır kısa olabilir. */
  offset: number;
  cells: ByteCell[];
}

/**
 * Kırpılmış, renk atanmış bölge. `end` DIŞLAYICIDIR ve daima `<= bytes.length`
 * — sınır taşması normalize aşamasında yenir, render'a asla ulaşmaz.
 */
export interface NormalizedRegion {
  region: ByteRegion;
  start: number;
  end: number;
  colorIndex: SeriesColorIndex;
}

export interface ByteLayout {
  rows: ByteRow[];
  /** Satır sınırı yüzünden çizilmeyen bayt sayısı; 0 ise kesme yok. */
  hiddenByteCount: number;
  totalByteCount: number;
}

/**
 * Bir satırın, aynı bölgeye ait ardışık hücrelerinden oluşan parçası.
 * Bayt başına bir `<button>` yerine parça başına bir `<button>` basılır:
 * 16K odaklanabilir öğe hem DOM'u hem klavye gezintisini kullanılmaz kılar.
 */
export interface ByteSegment {
  /** React `key` — satır ofseti + parçanın ilk bayt indeksi benzersizdir. */
  key: string;
  /** Bölgeye ait değilse undefined: nötr (tıklanamaz) parça. */
  region: NormalizedRegion | undefined;
  cells: ByteCell[];
}
