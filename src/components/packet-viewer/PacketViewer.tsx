/**
 * Paket görünümü — bayt görünümünü (`ByteViewer`) ve çözümlenmiş alan
 * tablosunu TEK seçim durumuyla eşleyen sunum bileşeni (spec §6
 * `components/packet-viewer`).
 *
 * `protocol-decode/DecodePanel`den TAŞINDI (2026-08-30). i18n bağı YOK
 * (`ByteViewer`/`LiveLineChart` ile aynı kural, bkz. `ByteViewer.tsx`): bütün
 * metin `labels` prop'undan gelir, uyarı metni zaten çevrilmiş verilir.
 *
 * `testIdPrefix`: `DecodePanel`in onlarca e2e testi `decode-field-row` gibi
 * SABİT testid'lere bağlı; bileşen paylaşılabilir olsun diye o testid'leri
 * kırmak yanlış olurdu. Prefix aynı DOM'u üretir — `DecodePanel`
 * `testIdPrefix="decode"` verir ve çıktı taşımadan ÖNCEKİYLE birebir aynıdır.
 */

import type { ReactNode } from 'react';

import { ByteViewer } from '../byte-viewer';
import type { ByteRegion } from '../byte-viewer';
import type { ParsedField } from '@/protocol-core/types';

const HEX_RADIX = 16;
/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';

/**
 * Tamsayının onaltılık gösterimi. Kesirli sayıda (IEEE-754 çözümü) `null`
 * döner: 25.75 için "0x19.C" yazmak yanıltıcı olurdu.
 */
function formatHexNumber(value: bigint | number): string | null {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return null;
  }
  const negative = value < 0;
  const magnitude = negative ? -value : value;
  return `${negative ? '-' : ''}0x${magnitude.toString(HEX_RADIX).toUpperCase()}`;
}

function formatRawCell(value: bigint | number | string | undefined): string {
  if (value === undefined) return EMPTY_GLYPH;
  if (typeof value === 'string') return value;
  const hex = formatHexNumber(value);
  return hex === null ? String(value) : `${hex} (${String(value)})`;
}

function formatPhysicalCell(
  value: bigint | number | string | undefined,
  unit: string | undefined,
): string {
  if (value === undefined) return EMPTY_GLYPH;
  const text = typeof value === 'string' ? value : String(value);
  return unit === undefined || unit === '' ? text : `${text} ${unit}`;
}

export interface PacketViewerLabels {
  readonly byteEmpty: string;
  readonly fieldsEmpty: string;
  readonly tableAriaLabel: string;
  readonly columnField: string;
  readonly columnOffset: string;
  readonly columnLength: string;
  readonly columnRaw: string;
  readonly columnPhysical: string;
  readonly columnValidity: string;
  readonly statusValid: string;
  readonly statusInvalid: string;
}

export interface PacketViewerProps {
  readonly bytes: Uint8Array;
  readonly regions: readonly ByteRegion[];
  /** `undefined` = henüz çözümlenmiş bir çerçeve yok; tablo hiç çizilmez. */
  readonly fields: readonly ParsedField[] | undefined;
  readonly selectedFieldId: string | null;
  readonly onSelectField: (fieldId: string) => void;
  readonly labels: PacketViewerLabels;
  /** Alan uyarısı METNİ zaten çevrilmiş gelir — bileşen sözlük bilmez. */
  readonly translateWarning: (text: string) => string;
  readonly testIdPrefix: string;
}

function FieldRow({
  field,
  selected,
  onToggle,
  labels,
  translateWarning,
  testIdPrefix,
}: {
  field: ParsedField;
  selected: boolean;
  onToggle: (fieldId: string) => void;
  labels: PacketViewerLabels;
  translateWarning: (text: string) => string;
  testIdPrefix: string;
}): ReactNode {
  return (
    <>
      <tr
        data-testid={`${testIdPrefix}-field-row`}
        data-field-id={field.id}
        data-selected={String(selected)}
        data-valid={String(field.valid)}
        className={selected ? 'border-b border-line bg-accent-soft' : 'border-b border-line'}
      >
        <td className={`${BODY_CELL_CLASS} font-medium`}>
          {/*
            Satırın kendisi tıklanabilir yapılmadı: `<tr onClick>` klavyeyle
            erişilemez ve ekran okuyucuya duyurulmaz. Seçim düğmesi ad hücresinde
            durur, böylece bölge ↔ satır vurgusu iki yönden de sürülebilir.
          */}
          <button
            type="button"
            data-testid={`${testIdPrefix}-field-select`}
            aria-pressed={selected}
            className="rounded-token-sm text-left text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              onToggle(field.id);
            }}
          >
            {field.name}
          </button>
        </td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{String(field.offset)}</td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{String(field.length)}</td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid={`${testIdPrefix}-field-raw`}>
          {formatRawCell(field.rawValue)}
        </td>
        <td
          className={`${BODY_CELL_CLASS} tabular font-mono`}
          data-testid={`${testIdPrefix}-field-physical`}
        >
          {formatPhysicalCell(field.physicalValue, field.unit)}
        </td>
        <td
          className={field.valid ? `${BODY_CELL_CLASS} text-accent` : `${BODY_CELL_CLASS} text-danger`}
          data-testid={`${testIdPrefix}-field-validity`}
        >
          {field.valid ? labels.statusValid : labels.statusInvalid}
        </td>
      </tr>
      {field.warnings.length > 0 ? (
        <tr className="border-b border-line">
          <td colSpan={6} className="px-2 pb-2">
            <ul className="flex flex-col gap-0.5 text-xs text-warn">
              {field.warnings.map((warning) => (
                <li
                  key={warning}
                  data-testid={`${testIdPrefix}-field-warning`}
                  data-field-id={field.id}
                >
                  {translateWarning(warning)}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function PacketViewer({
  bytes,
  regions,
  fields,
  selectedFieldId,
  onSelectField,
  labels,
  translateWarning,
  testIdPrefix,
}: PacketViewerProps): ReactNode {
  return (
    <>
      <div className="overflow-x-auto rounded-token border border-line bg-surface p-3">
        <ByteViewer
          bytes={bytes}
          regions={regions}
          selectedRegionId={selectedFieldId}
          onRegionSelect={onSelectField}
          emptyLabel={labels.byteEmpty}
        />
      </div>

      {fields === undefined ? null : (
        <div className="overflow-x-auto">
          <table
            data-testid={`${testIdPrefix}-field-table`}
            className="w-full min-w-[40rem] border-collapse"
            aria-label={labels.tableAriaLabel}
          >
            <thead>
              <tr>
                <th className={HEADER_CELL_CLASS}>{labels.columnField}</th>
                <th className={HEADER_CELL_CLASS}>{labels.columnOffset}</th>
                <th className={HEADER_CELL_CLASS}>{labels.columnLength}</th>
                <th className={HEADER_CELL_CLASS}>{labels.columnRaw}</th>
                <th className={HEADER_CELL_CLASS}>{labels.columnPhysical}</th>
                <th className={HEADER_CELL_CLASS}>{labels.columnValidity}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  selected={field.id === selectedFieldId}
                  onToggle={onSelectField}
                  labels={labels}
                  translateWarning={translateWarning}
                  testIdPrefix={testIdPrefix}
                />
              ))}
            </tbody>
          </table>
          {fields.length === 0 ? (
            <p
              className="px-2 py-1.5 text-sm text-muted"
              data-testid={`${testIdPrefix}-fields-empty`}
            >
              {labels.fieldsEmpty}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
