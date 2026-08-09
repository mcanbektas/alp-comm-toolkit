import type {
  ByteCell,
  ByteLayout,
  ByteRegion,
  ByteRow,
  ByteSegment,
  NormalizedRegion,
  SeriesColorIndex,
} from './types';

/**
 * ByteViewer'ın tüm hesabı burada, React'sizdir. Gerekçe: hizalama ve sınır
 * kırpma hatalarını render ederek aramak pahalı; saf fonksiyon olarak tamamı
 * tek tek doğrulanabilir.
 *
 * Bu dosyanın değişmezleri (testlerle çivilenmiştir):
 *  - Bozuk bölge çizilmez, ATMAZ. Analiz aracında tek bozuk alanın ekranı
 *    komple düşürmesi kabul edilemez; hatalı girdi sessizce elenir.
 *  - Bölge sınırı çerçeveyi taşarsa kırpılır (`end = min(offset+length, n)`).
 *  - Çakışan bölgelerde SONRAKİ bölge kazanır (aşağıda ayrıca yazılı).
 *  - Boş `bytes` → boş satır listesi; hiçbir yerde "0 bayt" özel durumu yok.
 */

export const DEFAULT_BYTES_PER_ROW = 16;

/**
 * Üst sınır: 1024 satır × 16 bayt = 16 KB. 64 KB'lık bir çerçeve tek seferde
 * basılırsa ~65K hücre düğümü çıkar ve sekme kilitlenir. Sanallaştırma Faz 5'in
 * işi; buradaki kesme yalnızca patlamayı önlemek için — kalan bayt sayısı
 * kullanıcıya bildirilir ki veri sessizce kaybolmasın.
 */
export const MAX_RENDERED_ROWS = 1024;

/** Renk sırası; `colorIndex` verilmeyen bölgeler bu diziyi döngüsel tüketir. */
const SERIES_ORDER: readonly SeriesColorIndex[] = [0, 1, 2, 3];
export const SERIES_COLOR_COUNT = SERIES_ORDER.length;

const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;
const NON_PRINTABLE_GLYPH = '.';
const BYTE_MASK = 0xff;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
const OFFSET_HEX_DIGITS = 4;
const PAD_CHAR = '0';

/** İki hane, büyük harf. Girdi maskelenir: 0..255 dışı bir sayı hizalamayı bozmasın. */
export function toHexByte(value: number): string {
  const safe = Number.isFinite(value) ? value & BYTE_MASK : 0;
  return safe.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, PAD_CHAR);
}

/** 0x20..0x7E dışı her şey tek nokta — kontrol karakterleri hizalamayı bozamaz. */
export function toPrintableAscii(value: number): string {
  if (!Number.isFinite(value)) return NON_PRINTABLE_GLYPH;
  const safe = value & BYTE_MASK;
  if (safe < ASCII_PRINTABLE_MIN || safe > ASCII_PRINTABLE_MAX) return NON_PRINTABLE_GLYPH;
  return String.fromCharCode(safe);
}

/**
 * Ofset etiketi: en az 4 hane, büyük harf hex. 64 KB üstünde doğal olarak
 * 5 haneye taşar — kırpmıyoruz, çünkü yanlış ofset okumak hiç okumamaktan kötü.
 */
export function formatOffset(offset: number): string {
  const safe = Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : 0;
  return safe.toString(HEX_RADIX).toUpperCase().padStart(OFFSET_HEX_DIGITS, PAD_CHAR);
}

/** Bozuk `bytesPerRow` (0, negatif, kesirli, NaN) sessizce varsayılana düşer. */
export function resolveBytesPerRow(bytesPerRow: number | undefined): number {
  if (bytesPerRow === undefined) return DEFAULT_BYTES_PER_ROW;
  if (!Number.isInteger(bytesPerRow) || bytesPerRow < 1) return DEFAULT_BYTES_PER_ROW;
  return bytesPerRow;
}

function toCell(index: number, value: number): ByteCell {
  return { index, value, hex: toHexByte(value), ascii: toPrintableAscii(value) };
}

/**
 * Baytları satırlara böler. `for..of` kullanılıyor çünkü `bytes[i]` altında
 * `noUncheckedIndexedAccess` `number | undefined` verir ve gereksiz bir guard
 * ya da `!` doğurur; iterasyon her ikisinden de kurtarır.
 */
export function buildRows(bytes: Uint8Array, bytesPerRow?: number): ByteRow[] {
  const perRow = resolveBytesPerRow(bytesPerRow);
  const rows: ByteRow[] = [];
  let cells: ByteCell[] = [];
  let index = 0;

  for (const value of bytes) {
    cells.push(toCell(index, value));
    index += 1;
    if (cells.length === perRow) {
      rows.push({ offset: index - perRow, cells });
      cells = [];
    }
  }
  // Son satır kısa olabilir; doldurma yapılmaz, hizalama grid şablonundan gelir.
  if (cells.length > 0) rows.push({ offset: index - cells.length, cells });

  return rows;
}

/**
 * Satır üst sınırını uygular. Kesme `buildRows`'tan ÖNCE yapılır (subarray bir
 * görünüm, kopya değil): 64 KB için önce 65K hücre üretip sonra atmak tam da
 * kaçınmak istediğimiz maliyet.
 */
export function buildLayout(
  bytes: Uint8Array,
  bytesPerRow?: number,
  maxRows: number = MAX_RENDERED_ROWS,
): ByteLayout {
  const perRow = resolveBytesPerRow(bytesPerRow);
  const rowCap = Number.isInteger(maxRows) && maxRows > 0 ? maxRows : MAX_RENDERED_ROWS;
  const visibleCap = rowCap * perRow;
  const truncated = bytes.length > visibleCap;
  const visible = truncated ? bytes.subarray(0, visibleCap) : bytes;

  return {
    rows: buildRows(visible, perRow),
    hiddenByteCount: truncated ? bytes.length - visibleCap : 0,
    totalByteCount: bytes.length,
  };
}

function isDrawableOffset(offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0;
}

function isDrawableLength(length: number): boolean {
  return Number.isInteger(length) && length > 0;
}

/**
 * Bölgeleri çizilebilir hâle getirir: eler, kırpar, renk atar.
 *
 * Eleme kuralları (hepsi sessiz — bkz. dosya başı):
 *  - `offset` tamsayı ve >= 0 değilse (negatif, NaN, kesirli) bölge yok sayılır.
 *  - `length` tamsayı ve > 0 değilse yok sayılır; length 0 çizilmez.
 *  - `offset >= byteCount` ise tamamen dışarıdadır, yok sayılır.
 *
 * Otomatik renk sayacı YALNIZ `colorIndex` verilmeyen bölgelerde ilerler:
 * elle renk verilmiş bir alan sıradan bir slot yemez, aksi hâlde iki komşu
 * otomatik alan aynı rengi alabilirdi. Elenen bölgeler de sayacı ilerletmez.
 */
export function normalizeRegions(
  regions: readonly ByteRegion[] | undefined,
  byteCount: number,
): NormalizedRegion[] {
  if (regions === undefined || regions.length === 0 || byteCount <= 0) return [];

  const normalized: NormalizedRegion[] = [];
  let autoColor = 0;

  for (const region of regions) {
    if (!isDrawableOffset(region.offset) || !isDrawableLength(region.length)) continue;
    if (region.offset >= byteCount) continue;

    const end = Math.min(region.offset + region.length, byteCount);
    let colorIndex: SeriesColorIndex;
    if (region.colorIndex === undefined) {
      colorIndex = SERIES_ORDER[autoColor] ?? SERIES_ORDER[0] ?? 0;
      autoColor = (autoColor + 1) % SERIES_COLOR_COUNT;
    } else {
      colorIndex = region.colorIndex;
    }

    normalized.push({ region, start: region.offset, end, colorIndex });
  }

  return normalized;
}

/**
 * Bayt indeksi → onu kapsayan bölge. Dizi uzunluğu daima `byteCount`.
 *
 * ÇAKIŞMA KURALI: iki bölge aynı baytı kapsıyorsa listede SONRA gelen kazanır.
 * Sıra anlamlıdır — kaba bir "payload" bölgesinin üstüne onu detaylandıran alt
 * alanlar yazılabilsin diye böyle; ters sıra göndermek üst bölgeyi görünmez
 * kılar. Kesişim ayrı parçaya bölünmez, bilinçli bir sadeleştirmedir.
 */
export function buildRegionMap(
  regions: readonly ByteRegion[] | undefined,
  byteCount: number,
): readonly (NormalizedRegion | undefined)[] {
  const size = Number.isInteger(byteCount) && byteCount > 0 ? byteCount : 0;
  const map = new Array<NormalizedRegion | undefined>(size).fill(undefined);

  for (const normalized of normalizeRegions(regions, size)) {
    for (let i = normalized.start; i < normalized.end; i += 1) {
      map[i] = normalized;
    }
  }

  return map;
}

/**
 * Satırı, aynı bölgeye ait ardışık hücre öbeklerine böler. Bölge satır sınırını
 * aşarsa her satırda ayrı bir parça olur — tek bir DOM öğesinin iki satıra
 * yayılması grid hizalamasını bozardı.
 */
export function splitRowByRegion(
  row: ByteRow,
  regionMap: readonly (NormalizedRegion | undefined)[],
): ByteSegment[] {
  const segments: ByteSegment[] = [];
  let current: ByteSegment | undefined;

  for (const cell of row.cells) {
    const region = regionMap[cell.index];
    if (current === undefined || current.region !== region) {
      current = { key: `${row.offset}:${cell.index}`, region, cells: [cell] };
      segments.push(current);
      continue;
    }
    current.cells.push(cell);
  }

  return segments;
}
