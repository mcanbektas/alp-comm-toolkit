/**
 * Protocol Studio orta paneli — spec §9.7'nin altı maddesi: HEX görünümü, ASCII
 * görünümü, byte offset, bit görünümü, renklendirilmiş alanlar ve hatalı alan
 * vurgusu.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): baytlar ve bölgeler dışarıdan
 * hazır gelir (`parseWithSchema` → `parsedFrameToRegions`). Buradaki tek iş
 * görünümü seçmek, düzeni ayarlamak ve seçimi yukarı bildirmek.
 *
 * Seçim burada TUTULMAZ. `ByteViewer` gibi bu panel de kontrollüdür: aynı alan
 * sol listede ve sağ özellik panelinde de vurgulanacak, seçim panelde tutulursa
 * üç görünüm ayrışır.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { TranslationKey } from '@/translations';
import { ByteViewer, buildLayout, buildRegionMap, formatOffset } from '@/components/byte-viewer';
import type { ByteCell, ByteRegion, NormalizedRegion, SeriesColorIndex } from '@/components/byte-viewer';
import { CheckboxField, SelectField } from '@/components/forms';

export interface FrameViewPanelProps {
  readonly bytes: Uint8Array;
  readonly regions: readonly ByteRegion[];
  readonly hexInput: string;
  readonly hexErrorKey: string | null;
  readonly selectedRegionId: string | null;
  readonly onHexInputChange: (hex: string) => void;
  readonly onSelectRegion: (regionId: string | null) => void;
}

/** Spec §9.7'nin "HEX görünümü · ASCII görünümü · Bit görünümü" üçlüsü. */
export const FRAME_VIEW_MODES = ['hexAscii', 'hexOnly', 'bits'] as const;
export type FrameViewMode = (typeof FRAME_VIEW_MODES)[number];

const VIEW_MODE_KEYS: Record<FrameViewMode, TranslationKey> = {
  hexAscii: 'studio.frame.view.hexAscii',
  hexOnly: 'studio.frame.view.hexOnly',
  bits: 'studio.frame.view.bits',
};

/** Satır başına bayt seçenekleri; 32'nin üstü bit görünümünde okunaksız oluyor. */
export const BYTES_PER_ROW_CHOICES = [8, 16, 32] as const;
export type BytesPerRow = (typeof BYTES_PER_ROW_CHOICES)[number];

const DEFAULT_BYTES_PER_ROW: BytesPerRow = 16;
const BITS_PER_BYTE = 8;

/**
 * Renk sınıfları TAM LİTERAL yazılmak zorunda (bkz. ByteViewer.tsx:27-39):
 * Tailwind kaynağı statik tarar, `` `text-series-${i}` `` üretilen CSS'e girmez.
 * ByteViewer bu tabloları dışa açmıyor — kopya kasıtlı; tabloyu paylaşmak için
 * salt sunum bileşenini feature koduna açmaktansa dört satır tekrar ucuz.
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

/** Kesme satırının işareti; "B" bayt birimi, çevrilecek bir sözcük değil. */
const TRUNCATION_PREFIX = '…';
const BYTE_UNIT_SUFFIX = 'B';

function cx(...parts: readonly (string | false | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
}

/**
 * Bit hücresinin tonu. Geçersiz alan renge EK OLARAK dalgalı altı çizili:
 * renk körü kullanıcı için tek ayırt edici sinyal renk olamaz (ByteViewer ile
 * aynı kural).
 */
function toBitToneClass(region: NormalizedRegion, isSelected: boolean): string {
  const tone =
    region.region.invalid === true
      ? 'bg-danger-soft text-danger underline decoration-wavy underline-offset-4'
      : cx(SERIES_BG_CLASS[region.colorIndex], SERIES_TEXT_CLASS[region.colorIndex]);
  return cx(tone, isSelected && 'ring-2 ring-accent');
}

/** Erişilebilir ad: `<ad> @0x0007 b3`. Bit numarası MSB=7 geleneğiyle verilir. */
function toBitLabel(region: NormalizedRegion, byteIndex: number, bitPosition: number): string {
  return `${region.region.name} @0x${formatOffset(byteIndex)} b${bitPosition}`;
}

export interface BitGridViewProps {
  readonly bytes: Uint8Array;
  readonly regions: readonly ByteRegion[];
  readonly bytesPerRow: number;
  readonly hideOffsets: boolean;
  readonly selectedRegionId: string | null;
  /** ByteViewer'ın `onRegionSelect`i ile aynı imza: aç/kapa kararı çağırana ait. */
  readonly onSelectRegion: (regionId: string) => void;
  readonly emptyLabel: string;
}

/**
 * Bit görünümü. `ByteViewer` bit çözünürlüğü SUNMUYOR ve sunmamalı: hex/ascii
 * sütunları bayt hizasına kilitli, bit ızgarası bayt başına sekiz hücre demek —
 * ikisini tek bileşende birleştirmek hizalama hesabını iki kat karmaşıklaştırır.
 *
 * Renk ve geçersizlik ByteViewer ile AYNI kaynaktan gelir (`buildRegionMap`),
 * yoksa aynı çerçeve iki görünümde farklı renklenir.
 */
export function BitGridView({
  bytes,
  regions,
  bytesPerRow,
  hideOffsets,
  selectedRegionId,
  onSelectRegion,
  emptyLabel,
}: BitGridViewProps): ReactElement {
  const prepared = useMemo(() => {
    // Satır kapağı ByteViewer'la ortak: 16 KB üstü çerçevede 130K bit düğümü
    // sekmeyi kilitler. Kesilen bayt sayısı kullanıcıya bildirilir.
    const layout = buildLayout(bytes, bytesPerRow);
    const visibleByteCount = layout.totalByteCount - layout.hiddenByteCount;
    return {
      rows: layout.rows,
      regionMap: buildRegionMap(regions, visibleByteCount),
      hiddenByteCount: layout.hiddenByteCount,
      visibleByteCount,
    };
  }, [bytes, bytesPerRow, regions]);

  if (bytes.length === 0) {
    return (
      <div className="font-mono tabular text-sm text-muted" data-testid="bit-grid-empty">
        {emptyLabel}
      </div>
    );
  }

  const renderBitCell = (cell: ByteCell, columnIndex: number): ReactElement => {
    // MSB-first: en soldaki hücre 7. bit. Ekranda okunan sıra ile bit numarası
    // ters gider, bu yüzden konum ayrı hesaplanır.
    const bitPosition = BITS_PER_BYTE - 1 - columnIndex;
    const bit = (cell.value >> bitPosition) & 1;
    const region = prepared.regionMap[cell.index];

    if (region === undefined) {
      return (
        <span
          key={bitPosition}
          data-testid="bit-grid-cell"
          data-bit={bitPosition}
          className="w-3 text-center text-muted"
        >
          {bit}
        </span>
      );
    }

    const isSelected = selectedRegionId !== null && selectedRegionId === region.region.id;
    return (
      <button
        key={bitPosition}
        type="button"
        data-testid="bit-grid-cell"
        data-bit={bitPosition}
        data-region-id={region.region.id}
        data-selected={isSelected}
        data-invalid={region.region.invalid === true}
        aria-label={toBitLabel(region, cell.index, bitPosition)}
        aria-pressed={isSelected}
        className={cx('w-3 cursor-pointer text-center', toBitToneClass(region, isSelected))}
        onClick={() => onSelectRegion(region.region.id)}
      >
        {bit}
      </button>
    );
  };

  return (
    // Bit ızgarası bayt başına sekiz sütun: 32 bayt/satırda taşar, dikey akışı
    // bozmamak için kaydırma KENDİ kabında kalır.
    <div className="overflow-x-auto font-mono tabular text-xs text-text" data-testid="bit-grid">
      {prepared.rows.map((row) => (
        <div key={row.offset} className="flex gap-2 py-1">
          {row.cells.map((cell) => (
            <div key={cell.index} className="flex flex-col items-center gap-0.5" data-testid="bit-grid-byte">
              <div className="flex gap-px" data-testid="bit-grid-bits">
                {Array.from({ length: BITS_PER_BYTE }, (_, columnIndex) =>
                  renderBitCell(cell, columnIndex),
                )}
              </div>
              {!hideOffsets && (
                <span className="select-none text-muted" data-testid="bit-grid-offset">
                  {formatOffset(cell.index)}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      {prepared.hiddenByteCount > 0 && (
        <div className="py-1 text-muted" data-testid="bit-grid-truncated">
          {`${TRUNCATION_PREFIX} +${prepared.hiddenByteCount} ${BYTE_UNIT_SUFFIX}`}
        </div>
      )}
    </div>
  );
}

function modeButtonClass(active: boolean): string {
  const base =
    'rounded-token border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  return active
    ? `${base} border-accent bg-accent text-on-accent`
    : `${base} border-line bg-raised text-text hover:bg-surface`;
}

export function FrameViewPanel(props: FrameViewPanelProps): ReactElement {
  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState<FrameViewMode>('hexAscii');
  const [bytesPerRow, setBytesPerRow] = useState<BytesPerRow>(DEFAULT_BYTES_PER_ROW);
  const [hideOffsets, setHideOffsets] = useState(false);

  const { onSelectRegion, selectedRegionId } = props;

  /**
   * ByteViewer state tutmaz ve `onRegionSelect` yalnız "bu bölgeye tıklandı"
   * der. Aynı bölgeye ikinci tık SEÇİMİ KALDIRSIN kuralı burada yaşar; iki
   * görünüm de aynı işleyiciye bağlı ki davranış ayrışmasın.
   */
  const handleRegionSelect = useCallback(
    (regionId: string): void => {
      onSelectRegion(regionId === selectedRegionId ? null : regionId);
    },
    [onSelectRegion, selectedRegionId],
  );

  const handleBytesPerRowChange = useCallback((value: string): void => {
    // Seçenek listesinden aranır: `Number(value)` literal birleşimine daralmaz
    // ve dışarıdan gelen bozuk bir değer sessizce state'e girerdi.
    const next = BYTES_PER_ROW_CHOICES.find((choice) => String(choice) === value);
    if (next !== undefined) setBytesPerRow(next);
  }, []);

  // Hata VARLIĞI anahtarın çözülmesine bağlanmaz: sözlükte karşılığı olmayan
  // bir anahtar geldiğinde girdi sessizce "geçerli" görünmemeli, yalnız metni
  // eksik kalmalı.
  const hasHexError = props.hexErrorKey !== null;
  // `hexErrorKey` sözleşmede düz `string`; sözlük anahtarına daraltıldığı tek yer burası.
  const hexErrorText = props.hexErrorKey === null ? '' : t(props.hexErrorKey as TranslationKey);

  const emptyLabel = t('studio.frame.empty');

  const hexInputClass = `w-full rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    hasHexError ? 'border-danger' : 'border-line'
  }`;

  return (
    <div className="flex flex-col gap-4" data-testid="frame-view-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="studio-frame-hex" className="text-xs font-medium text-muted">
          {t('studio.frame.hexInput.label')}
        </label>
        <textarea
          id="studio-frame-hex"
          rows={3}
          spellCheck={false}
          value={props.hexInput}
          placeholder={t('studio.frame.hexInput.placeholder')}
          aria-invalid={hasHexError}
          aria-describedby={hasHexError ? 'studio-frame-hex-error' : undefined}
          className={hexInputClass}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            props.onHexInputChange(event.target.value);
          }}
        />
        {hasHexError && (
          <p id="studio-frame-hex-error" role="alert" className="text-xs text-danger">
            {hexErrorText}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span id="studio-frame-view-label" className="text-xs font-medium text-muted">
            {t('studio.frame.view.label')}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="studio-frame-view-label"
            className="flex flex-wrap items-center gap-2"
          >
            {FRAME_VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewMode === mode}
                data-testid={`frame-view-mode-${mode}`}
                className={modeButtonClass(viewMode === mode)}
                onClick={() => setViewMode(mode)}
              >
                {t(VIEW_MODE_KEYS[mode])}
              </button>
            ))}
          </div>
        </div>

        <div className="w-28">
          <SelectField
            id="studio-frame-bytes-per-row"
            label={t('studio.frame.bytesPerRow')}
            value={String(bytesPerRow)}
            onChange={handleBytesPerRowChange}
            options={BYTES_PER_ROW_CHOICES.map((choice) => ({
              value: String(choice),
              label: String(choice),
            }))}
          />
        </div>

        <CheckboxField
          id="studio-frame-hide-offsets"
          label={t('studio.frame.hideOffsets')}
          checked={hideOffsets}
          onChange={setHideOffsets}
        />
      </div>

      {/* Sayı çeviri şablonuna GÖMÜLMEZ: yer tutuculu bir anahtar iki dilde de
          ayrı ayrı bakım ister, oysa buradaki tek değişken salt rakam. */}
      <p className="text-xs text-muted" data-testid="frame-view-byte-count">
        {t('studio.frame.byteCount')}: <span className="tabular text-text">{props.bytes.length}</span>
      </p>

      <div className="rounded-token border border-line bg-raised p-3">
        {viewMode === 'bits' ? (
          <BitGridView
            bytes={props.bytes}
            regions={props.regions}
            bytesPerRow={bytesPerRow}
            hideOffsets={hideOffsets}
            selectedRegionId={selectedRegionId}
            onSelectRegion={handleRegionSelect}
            emptyLabel={emptyLabel}
          />
        ) : (
          <ByteViewer
            bytes={props.bytes}
            regions={props.regions}
            bytesPerRow={bytesPerRow}
            hideOffsets={hideOffsets}
            hideAscii={viewMode === 'hexOnly'}
            selectedRegionId={selectedRegionId}
            onRegionSelect={handleRegionSelect}
            emptyLabel={emptyLabel}
          />
        )}
      </div>
    </div>
  );
}
