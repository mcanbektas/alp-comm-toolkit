/**
 * Kayıt tablosu — sanallaştırılmış (spec §34 "tablolar sanallaştırılmalıdır").
 * 200 bin kayıtta DOM'a giren satır sayısı görünür pencere kadardır.
 *
 * Satır seçimi FİLTRELENMİŞ listedeki konuma göre yapılır; kaydın kendi
 * `index` alanı kaynak dosyadaki sırayı taşır ve ekranda o gösterilir —
 * kullanıcı filtreyi kaldırınca aynı kaydı orada bulur.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import type { LogRecord, LogTimestampKind } from '@/protocol-core/logs/types';
import { VirtualizedTable } from '@/components/virtualized-tables/VirtualizedTable';

import { UNKNOWN_PLACEHOLDER, formatRecordTimestamp } from '../formatLog';

/** Satır yüksekliği sabit olmak ZORUNDA — sanallaştırma aritmetiği buna dayanıyor. */
const ROW_HEIGHT_PX = 28;
const TABLE_HEIGHT_PX = 420;
/** Satırda gösterilen azami bayt; gerisi ayrıntı panelinde okunur. */
const PREVIEW_BYTES = 16;

export interface LogRecordTableProps {
  readonly records: readonly LogRecord[];
  readonly timestampKind: LogTimestampKind;
  readonly selectedIndex: number | undefined;
  readonly onSelect: (index: number) => void;
}

function previewHex(bytes: Uint8Array): string {
  const shown = bytes.subarray(0, PREVIEW_BYTES);
  const text = (bytesToHex(shown).match(/../g) ?? []).join(' ');
  return bytes.length > PREVIEW_BYTES ? `${text} …` : text;
}

export function LogRecordTable({ records, timestampKind, selectedIndex, onSelect }: LogRecordTableProps): ReactNode {
  const { t } = useTranslation();

  const renderRow = (index: number): ReactNode => {
    const record = records[index];
    if (record === undefined) {
      return <div key={index} role="row" style={{ height: ROW_HEIGHT_PX }} />;
    }
    const selected = index === selectedIndex;

    return (
      <button
        key={record.index}
        type="button"
        role="row"
        aria-selected={selected}
        onClick={() => {
          onSelect(index);
        }}
        className={[
          'flex w-full items-center gap-3 border-t border-line px-3 text-left text-xs tabular',
          selected ? 'bg-accent-soft text-accent-strong' : 'text-text hover:bg-raised',
        ].join(' ')}
        style={{ height: ROW_HEIGHT_PX }}
      >
        <span role="gridcell" className="w-14 shrink-0 text-muted">
          {record.index}
        </span>
        <span role="gridcell" className="w-24 shrink-0 font-mono text-muted">
          {formatRecordTimestamp(record.timestamp, timestampKind)}
        </span>
        <span role="gridcell" className="w-8 shrink-0 uppercase">
          {record.direction ?? UNKNOWN_PLACEHOLDER}
        </span>
        <span role="gridcell" className="w-20 shrink-0 truncate">
          {record.channel ?? UNKNOWN_PLACEHOLDER}
        </span>
        <span role="gridcell" className="w-20 shrink-0 font-mono">
          {record.frameId ?? UNKNOWN_PLACEHOLDER}
        </span>
        <span role="gridcell" className="w-12 shrink-0 text-right text-muted">
          {record.originalLength}
        </span>
        <span role="gridcell" className="truncate font-mono">
          {previewHex(record.data)}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="w-14 shrink-0">{t('logAnalyzer.table.index')}</span>
        <span className="w-24 shrink-0">{t('logAnalyzer.table.time')}</span>
        <span className="w-8 shrink-0">{t('logAnalyzer.table.direction')}</span>
        <span className="w-20 shrink-0">{t('logAnalyzer.table.channel')}</span>
        <span className="w-20 shrink-0">{t('logAnalyzer.table.id')}</span>
        <span className="w-12 shrink-0 text-right">{t('logAnalyzer.table.length')}</span>
        <span>{t('logAnalyzer.table.data')}</span>
      </div>

      <VirtualizedTable
        rowCount={records.length}
        rowHeight={ROW_HEIGHT_PX}
        height={TABLE_HEIGHT_PX}
        renderRow={renderRow}
        ariaLabel={t('logAnalyzer.table.label')}
        emptyLabel={t('logAnalyzer.table.empty')}
      />
    </div>
  );
}
