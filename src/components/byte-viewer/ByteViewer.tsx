import { useMemo } from 'react';
import type { ReactElement } from 'react';

import {
  buildLayout,
  buildRegionMap,
  formatOffset,
  resolveBytesPerRow,
  splitRowByRegion,
} from './layout';
import type { ByteCell, ByteSegment, ByteViewerProps, NormalizedRegion, SeriesColorIndex } from './types';

/**
 * Salt sunum. Kendi state'i YOKTUR: hover ve seçim dışarı bildirilir, seçili
 * bölge `selectedRegionId` ile kontrol edilir. Gerekçe: aynı çerçeve birden
 * çok panelde (ağaç, alan listesi, byte görünümü) eşzamanlı vurgulanacak;
 * seçim burada tutulursa üç görünüm ayrışır.
 *
 * i18n bağı yoktur — görünen tek serbest metin `emptyLabel` prop'udur. Bölge
 * etiketleri ad + sayı + sembolden oluşur (aşağıya bkz.), çeviri gerektirmez.
 */

/**
 * Renk sınıfları TAM LİTERAL yazılmak zorunda: Tailwind kaynağı statik tarar,
 * `` `text-series-${i}` `` gibi bir şablon üretilen CSS'e hiç girmez.
 */
const SERIES_TEXT_CLASS: Record<SeriesColorIndex, string> = {
  0: 'text-series-1',
  1: 'text-series-2',
  2: 'text-series-3',
  3: 'text-series-4',
};

const SERIES_BG_CLASS: Record<SeriesColorIndex, string> = {
  0: 'bg-series-1/10',
  1: 'bg-series-2/10',
  2: 'bg-series-3/10',
  3: 'bg-series-4/10',
};

/**
 * Hücre genişliği karakter cinsindendir, CSS'ten değil: monospace + `whitespace-pre`
 * varken "AA " daima 3 karakter yer kaplar. Bayt başına `<span>` basmamanın tek
 * sebebi bu — 16 KB'lık üst sınırda 16K düğüm yerine parça başına tek metin düğümü.
 */
const HEX_CHARS_PER_CELL = 3;

/** Ofset sütunu ayırıcısı. Adlandırıldı ki hizalama hesabı sihirli sabite dayanmasın. */
const OFFSET_SUFFIX = ':';

/** `emptyLabel` verilmediğinde: dile bağlı olmayan nötr işaret. */
const DEFAULT_EMPTY_GLYPH = '—';

/** Kesme satırının işareti; "B" bayt birimi, çevrilecek bir sözcük değil. */
const TRUNCATION_PREFIX = '…';
const BYTE_UNIT_SUFFIX = 'B';

function cx(...parts: readonly (string | false | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
}

/**
 * Ayırıcı boşluk hücrenin KENDİSİNE aittir, parçalar arasına ayrıca eklenmez.
 * Aksi hâlde bölge sınırında bir boşluk eksilir ve alttaki satırla hizalama kayar.
 */
function toHexText(cells: readonly ByteCell[]): string {
  return cells.map((cell) => `${cell.hex} `).join('');
}

function toAsciiText(cells: readonly ByteCell[]): string {
  return cells.map((cell) => cell.ascii).join('');
}

/**
 * Erişilebilir ad: `<ad> @0x00A0 +4`. Uzunluk KIRPILMIŞ uzunluktur — ekranda
 * ne çiziliyorsa o duyurulur, bildirilen uzunluk değil.
 */
function toRegionLabel(item: NormalizedRegion): string {
  return `${item.region.name} @0x${formatOffset(item.start)} +${item.end - item.start}`;
}

function toSegmentClass(region: NormalizedRegion | undefined, isSelected: boolean): string {
  if (region === undefined) return '';
  // Geçersiz alan renge ek olarak dalgalı altı çizili: renk körü kullanıcı için
  // tek ayırt edici sinyal renk olamaz.
  const tone = region.region.invalid === true
    ? 'bg-danger-soft text-danger underline decoration-wavy underline-offset-4'
    : cx(SERIES_BG_CLASS[region.colorIndex], SERIES_TEXT_CLASS[region.colorIndex]);
  return cx(tone, isSelected && 'ring-2 ring-accent');
}

interface PreparedRow {
  offset: number;
  offsetLabel: string;
  /** Son satır kısa olabilir; eksik hücreler boşlukla doldurulur ki ASCII sütunu kaymasın. */
  padCount: number;
  segments: ByteSegment[];
}

export function ByteViewer({
  bytes,
  regions,
  bytesPerRow,
  hideOffsets = false,
  hideAscii = false,
  selectedRegionId = null,
  onRegionHover,
  onRegionSelect,
  emptyLabel,
}: ByteViewerProps): ReactElement {
  const prepared = useMemo(() => {
    const perRow = resolveBytesPerRow(bytesPerRow);
    const layout = buildLayout(bytes, perRow);
    // Bölge haritası YALNIZ görünür bayt sayısı kadar: 64 KB'lık çerçevede
    // kesilen kısım için 48K'lık boş dizi ayırmanın anlamı yok.
    const visibleByteCount = layout.totalByteCount - layout.hiddenByteCount;
    const regionMap = buildRegionMap(regions, visibleByteCount);
    const rows: PreparedRow[] = layout.rows.map((row) => ({
      offset: row.offset,
      offsetLabel: formatOffset(row.offset),
      padCount: perRow - row.cells.length,
      segments: splitRowByRegion(row, regionMap),
    }));
    return { rows, hiddenByteCount: layout.hiddenByteCount, visibleByteCount };
  }, [bytes, bytesPerRow, regions]);

  if (bytes.length === 0) {
    return (
      <div className="font-mono tabular text-sm text-muted" data-testid="byte-viewer-empty">
        {emptyLabel ?? DEFAULT_EMPTY_GLYPH}
      </div>
    );
  }

  const renderHexSegment = (segment: ByteSegment): ReactElement => {
    const text = toHexText(segment.cells);
    if (segment.region === undefined) {
      return (
        <span key={segment.key} className="align-baseline">
          {text}
        </span>
      );
    }

    const region = segment.region;
    const isSelected = selectedRegionId !== null && selectedRegionId === region.region.id;
    return (
      <button
        key={segment.key}
        type="button"
        // Seçim callback'i olmasa bile buton: bölge sınırları ancak odaklanabilir
        // bir öğeyle klavyeden gezilebilir ve ekran okuyucuya duyurulabilir.
        className={cx(
          'cursor-pointer rounded-token-sm align-baseline',
          toSegmentClass(region, isSelected),
        )}
        aria-label={toRegionLabel(region)}
        aria-pressed={isSelected}
        data-region-id={region.region.id}
        data-selected={isSelected}
        data-invalid={region.region.invalid === true}
        onClick={() => onRegionSelect?.(region.region.id)}
        onMouseEnter={() => onRegionHover?.(region.region.id)}
        onMouseLeave={() => onRegionHover?.(null)}
        // Fare olaylarının klavye karşılığı; hover vurgusu odakla da tetiklenmeli.
        onFocus={() => onRegionHover?.(region.region.id)}
        onBlur={() => onRegionHover?.(null)}
      >
        {text}
      </button>
    );
  };

  const renderAsciiSegment = (segment: ByteSegment): ReactElement => (
    <span
      key={segment.key}
      className={segment.region === undefined ? undefined : toSegmentClass(segment.region, false)}
    >
      {toAsciiText(segment.cells)}
    </span>
  );

  return (
    <div className="font-mono tabular text-sm text-text" data-testid="byte-viewer">
      {prepared.rows.map((row) => (
        <div key={row.offset} className="flex items-start gap-4 whitespace-pre leading-6">
          {!hideOffsets && (
            <span className="select-none text-muted" data-testid="byte-viewer-offset">
              {row.offsetLabel}
              {OFFSET_SUFFIX}
            </span>
          )}
          <span data-testid="byte-viewer-hex">
            {row.segments.map(renderHexSegment)}
            {row.padCount > 0 && ' '.repeat(row.padCount * HEX_CHARS_PER_CELL)}
          </span>
          {!hideAscii && (
            <span className="text-muted" data-testid="byte-viewer-ascii">
              {row.segments.map(renderAsciiSegment)}
              {row.padCount > 0 && ' '.repeat(row.padCount)}
            </span>
          )}
        </div>
      ))}
      {prepared.hiddenByteCount > 0 && (
        <div
          className="flex items-start gap-4 whitespace-pre leading-6 text-muted"
          data-testid="byte-viewer-truncated"
        >
          {!hideOffsets && (
            <span className="select-none">
              {formatOffset(prepared.visibleByteCount)}
              {OFFSET_SUFFIX}
            </span>
          )}
          <span>{`${TRUNCATION_PREFIX} +${prepared.hiddenByteCount} ${BYTE_UNIT_SUFFIX}`}</span>
        </div>
      )}
    </div>
  );
}
