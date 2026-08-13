/**
 * Canlı çerçeve tablosu — spec §8.3 alanları, sanallaştırılmış.
 *
 * Satırlar `recordAt(index)` ile TEK TEK istenir; kayıt listesi hiç
 * maddileştirilmez. 100 bin kayıtta bile DOM'a giren satır sayısı görünür
 * pencere kadardır (spec §44).
 */

import type { ReactNode } from 'react';

import { VirtualizedTable } from '../../../components/virtualized-tables/VirtualizedTable';
import { useTranslation } from '../../../app/providers/LanguageProvider';
import type { TranslationKey } from '../../../translations';
import type { FrameValidity } from '../../../protocol-core/statistics/commStatistics';
import { formatBytesForDisplay, formatTimestamp } from '../formatRecord';
import type { DisplayMode, MonitorRecord, TimestampResolution } from '../types';
import { isFrameRecord } from '../types';

/** Satır yüksekliği sabit olmak ZORUNDA — sanallaştırma aritmetiği buna dayanıyor. */
const ROW_HEIGHT_PX = 28;
const TABLE_HEIGHT_PX = 420;

const VALIDITY_LABEL_KEYS: Record<FrameValidity, TranslationKey> = {
  valid: 'monitor.validity.valid',
  'crc-error': 'monitor.validity.crcError',
  'checksum-error': 'monitor.validity.checksumError',
  unchecked: 'monitor.validity.unchecked',
};

const VALIDITY_CLASS: Record<FrameValidity, string> = {
  valid: 'text-accent-strong',
  'crc-error': 'text-danger',
  'checksum-error': 'text-danger',
  unchecked: 'text-muted',
};

export interface FrameTableProps {
  readonly recordCount: number;
  readonly recordAt: (index: number) => MonitorRecord | undefined;
  readonly displayMode: DisplayMode;
  readonly timestampResolution: TimestampResolution;
  readonly followTail: boolean;
  readonly onFollowTailChange: (following: boolean) => void;
}

export function FrameTable({
  recordCount,
  recordAt,
  displayMode,
  timestampResolution,
  followTail,
  onFollowTailChange,
}: FrameTableProps): ReactNode {
  const { t } = useTranslation();

  const renderRow = (index: number): ReactNode => {
    const record = recordAt(index);
    if (record === undefined) {
      return <div key={index} role="row" style={{ height: ROW_HEIGHT_PX }} />;
    }

    const timestamp = formatTimestamp(record.timestamp, timestampResolution);

    if (!isFrameRecord(record)) {
      return (
        <div
          key={record.index}
          role="row"
          className="flex items-center gap-3 border-t border-line px-3 text-xs text-danger tabular"
          style={{ height: ROW_HEIGHT_PX }}
        >
          <span role="gridcell" className="w-28 shrink-0 font-mono">
            {timestamp}
          </span>
          <span role="gridcell" className="w-10 shrink-0">
            --
          </span>
          <span role="gridcell" className="truncate">
            {record.code}: {record.message}
          </span>
        </div>
      );
    }

    return (
      <div
        key={record.index}
        role="row"
        className="flex items-center gap-3 border-t border-line px-3 text-xs text-text tabular"
        style={{ height: ROW_HEIGHT_PX }}
      >
        <span role="gridcell" className="w-28 shrink-0 font-mono text-muted">
          {timestamp}
        </span>
        <span role="gridcell" className="w-10 shrink-0 uppercase">
          {record.direction}
        </span>
        <span role="gridcell" className="w-12 shrink-0 text-right text-muted">
          {record.bytes.length}
        </span>
        <span role="gridcell" className={`w-28 shrink-0 ${VALIDITY_CLASS[record.validity]}`}>
          {t(VALIDITY_LABEL_KEYS[record.validity])}
        </span>
        <span role="gridcell" className="truncate font-mono">
          {formatBytesForDisplay(record.bytes, displayMode)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="w-28 shrink-0">{t('monitor.table.timestamp')}</span>
        <span className="w-10 shrink-0">{t('monitor.table.direction')}</span>
        <span className="w-12 shrink-0 text-right">{t('monitor.table.length')}</span>
        <span className="w-28 shrink-0">{t('monitor.table.validation')}</span>
        <span>{t('monitor.table.bytes')}</span>
      </div>

      <VirtualizedTable
        rowCount={recordCount}
        rowHeight={ROW_HEIGHT_PX}
        height={TABLE_HEIGHT_PX}
        renderRow={renderRow}
        followTail={followTail}
        onFollowTailChange={onFollowTailChange}
        ariaLabel={t('monitor.table.label')}
        emptyLabel={t('monitor.table.empty')}
      />
    </div>
  );
}
