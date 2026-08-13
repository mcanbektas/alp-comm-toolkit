/**
 * Sanallaştırılmış kaydırma penceresi — yalnız görünen satırları DOM'a koyar.
 *
 * Bileşen satırın NE olduğunu bilmez; `renderRow(index)` ile dışarıdan gelir.
 * Böylece hem çerçeve tablosu hem ileride log analizörü aynı pencereyi
 * kullanabilir. Yükseklik prop olarak alınır (ölçülmez): jsdom'da `clientHeight`
 * 0'dır, ölçüme dayansaydı bileşen testte hiçbir satır çizmezdi.
 *
 * `followTail` canlı akış için: yeni satır geldikçe en alta yapışır, kullanıcı
 * yukarı kaydırınca kendiliğinden bırakır — okurken ekranın kaçması, canlı
 * monitörlerin en sık şikâyeti.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { computeWindowRange } from './windowRange';

export interface VirtualizedTableProps {
  readonly rowCount: number;
  readonly rowHeight: number;
  /** Kaydırma alanının piksel yüksekliği. */
  readonly height: number;
  readonly overscan?: number;
  readonly renderRow: (index: number) => ReactNode;
  readonly followTail?: boolean;
  /** Kullanıcı yukarı kaydırıp takibi bıraktığında bildirilir. */
  readonly onFollowTailChange?: (following: boolean) => void;
  readonly ariaLabel?: string;
  readonly emptyLabel?: string;
}

const DEFAULT_OVERSCAN = 8;
/** Bu mesafeden fazla yukarı kaydırılırsa kullanıcı okuyor demektir; takip bırakılır. */
const FOLLOW_TAIL_THRESHOLD_PX = 24;

export function VirtualizedTable({
  rowCount,
  rowHeight,
  height,
  overscan = DEFAULT_OVERSCAN,
  renderRow,
  followTail = false,
  onFollowTailChange,
  ariaLabel,
  emptyLabel,
}: VirtualizedTableProps): ReactNode {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const range = useMemo(
    () => computeWindowRange({ scrollTop, viewportHeight: height, rowHeight, rowCount, overscan }),
    [scrollTop, height, rowHeight, rowCount, overscan],
  );

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    setScrollTop(viewport.scrollTop);

    if (followTail && onFollowTailChange !== undefined) {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceFromBottom > FOLLOW_TAIL_THRESHOLD_PX) {
        onFollowTailChange(false);
      }
    }
  }, [followTail, onFollowTailChange]);

  // Satır sayısı değiştiğinde boyama ÖNCESİ alta yapış; useEffect olsaydı
  // kullanıcı bir kare boyunca eski konumu görür, akış titrerdi.
  useLayoutEffect(() => {
    if (!followTail) {
      return;
    }
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
    setScrollTop(viewport.scrollTop);
  }, [followTail, rowCount, rowHeight]);

  // Takip yeniden açıldığında da alta in.
  useEffect(() => {
    if (!followTail) {
      return;
    }
    const viewport = viewportRef.current;
    if (viewport !== null) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [followTail]);

  const rows: ReactNode[] = [];
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    rows.push(renderRow(index));
  }

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rowCount}
      tabIndex={0}
      className="overflow-y-auto overflow-x-auto rounded-token border border-line bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ height }}
    >
      {rowCount === 0 && emptyLabel !== undefined ? (
        <p className="p-4 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div
          role="rowgroup"
          style={{ paddingTop: range.paddingTop, paddingBottom: range.paddingBottom }}
        >
          {rows}
        </div>
      )}
    </div>
  );
}
