/**
 * Özet paneli: sayısal künye, yön dağılımı, zaman çizgisi ve en yoğun
 * kanal/kimlik listeleri (spec §34 "Statistics", "Timeline").
 *
 * Zaman çizgisi SVG ya da grafik kitaplığı DEĞİL, oransal yükseklikli
 * kutulardır: tek eksenli, etkileşimsiz bir yoğunluk şeridi için kitaplık
 * yüklemek açılış paketine bedel yazardı ve bu şeridin okunabilirliği zaten
 * yükseklik oranından ibaret.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { LogGroupCount, LogStatistics, TimelineBucket } from '@/protocol-core/logs/logStatistics';
import type { LogTimestampKind } from '@/protocol-core/logs/types';

import { formatByteSize, formatCount, formatDuration, formatMilliseconds, formatRate, formatRecordTimestamp } from '../formatLog';

const PERCENT = 100;
const TIMELINE_HEIGHT_PX = 56;
/** Sıfır olmayan her kova görünsün diye en az bir piksellik taban. */
const MIN_BAR_PERCENT = 2;

export interface LogSummaryPanelProps {
  readonly statistics: LogStatistics;
  readonly timeline: readonly TimelineBucket[];
  readonly timestampKind: LogTimestampKind;
}

function Tile({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="flex flex-col gap-0.5 rounded-token border border-line bg-surface px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-text tabular">{value}</span>
    </div>
  );
}

function GroupList({ title, groups }: { readonly title: string; readonly groups: readonly LogGroupCount[] }): ReactNode {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="flex flex-col gap-0.5 text-sm text-text">
        {groups.map((group) => (
          <li key={group.key} className="flex justify-between gap-3 tabular">
            <span className="font-mono">{group.key}</span>
            <span className="text-muted">{group.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timeline({
  timeline,
  timestampKind,
}: {
  readonly timeline: readonly TimelineBucket[];
  readonly timestampKind: LogTimestampKind;
}): ReactNode {
  const { t } = useTranslation();
  if (timeline.length === 0) {
    return <p className="text-sm text-muted">{t('logAnalyzer.summary.timelineEmpty')}</p>;
  }

  const peak = timeline.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-end gap-px rounded-token border border-line bg-surface p-2"
        style={{ height: TIMELINE_HEIGHT_PX }}
        data-testid="log-timeline"
      >
        {timeline.map((bucket) => (
          <div
            key={bucket.startMs}
            className={bucket.count === 0 ? 'flex-1 bg-line' : 'flex-1 bg-accent'}
            style={{
              height: peak === 0 ? '0%' : `${Math.max(MIN_BAR_PERCENT, (bucket.count / peak) * PERCENT)}%`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted tabular">
        <span>{formatRecordTimestamp(first?.startMs, timestampKind)}</span>
        <span>{formatRecordTimestamp(last?.endMs, timestampKind)}</span>
      </div>
    </div>
  );
}

export function LogSummaryPanel({ statistics, timeline, timestampKind }: LogSummaryPanelProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label={t('logAnalyzer.summary.records')} value={formatCount(statistics.recordCount)} />
        <Tile label={t('logAnalyzer.summary.totalBytes')} value={formatByteSize(statistics.totalBytes)} />
        <Tile label={t('logAnalyzer.summary.capturedBytes')} value={formatByteSize(statistics.capturedBytes)} />
        <Tile label={t('logAnalyzer.summary.duration')} value={formatDuration(statistics.durationMs)} />
        <Tile label={t('logAnalyzer.summary.rate')} value={formatRate(statistics.averageRate)} />
        <Tile label={t('logAnalyzer.summary.avgLength')} value={formatCount(statistics.length.average === undefined ? undefined : Math.round(statistics.length.average))} />
        <Tile label={t('logAnalyzer.summary.minLength')} value={formatCount(statistics.length.min)} />
        <Tile label={t('logAnalyzer.summary.maxLength')} value={formatCount(statistics.length.max)} />
        <Tile label={t('logAnalyzer.summary.period')} value={formatMilliseconds(statistics.interval.average)} />
        <Tile label={t('logAnalyzer.summary.jitter')} value={formatMilliseconds(statistics.interval.stdDev)} />
        <Tile
          label={t('logAnalyzer.summary.direction')}
          value={`${statistics.rxCount} / ${statistics.txCount}`}
        />
        <Tile
          label={t('logAnalyzer.summary.unknownDirection')}
          value={formatCount(statistics.unknownDirectionCount)}
        />
        <Tile label={t('logAnalyzer.summary.truncated')} value={formatCount(statistics.truncatedCount)} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('logAnalyzer.summary.timeline')}
        </h3>
        <Timeline timeline={timeline} timestampKind={timestampKind} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GroupList title={t('logAnalyzer.summary.channels')} groups={statistics.channels} />
        <GroupList title={t('logAnalyzer.summary.frameIds')} groups={statistics.frameIds} />
      </div>
    </div>
  );
}
