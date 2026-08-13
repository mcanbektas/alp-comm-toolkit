/**
 * İstatistik paneli — spec §39'un metrik listesi.
 *
 * "Ölçülmedi" ile "0" AYRI gösterilir. Sıra numarası taşımayan bir protokolde
 * paket kaybını %0 yazmak, ölçülmemiş bir şeyi mükemmel göstermek olurdu.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '../../../app/providers/LanguageProvider';
import type { TranslationKey } from '../../../translations';
import type { CommStatisticsSnapshot } from '../../../protocol-core/statistics/commStatistics';

export interface StatisticsPanelProps {
  readonly statistics: CommStatisticsSnapshot;
}

function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function StatisticsPanel({ statistics }: StatisticsPanelProps): ReactNode {
  const { t } = useTranslation();
  const unknown = t('monitor.stats.unknown');

  const optional = (value: number | undefined, format: (input: number) => string): string =>
    value === undefined ? unknown : format(value);

  const entries: readonly { readonly key: TranslationKey; readonly value: string }[] = [
    { key: 'monitor.stats.totalFrames', value: formatNumber(statistics.totalFrames) },
    { key: 'monitor.stats.validFrames', value: formatNumber(statistics.validFrames) },
    { key: 'monitor.stats.invalidFrames', value: formatNumber(statistics.invalidFrames) },
    { key: 'monitor.stats.rxBytes', value: formatNumber(statistics.rxBytes) },
    { key: 'monitor.stats.txBytes', value: formatNumber(statistics.txBytes) },
    { key: 'monitor.stats.packetRate', value: `${formatNumber(statistics.packetRate, 1)} /s` },
    { key: 'monitor.stats.byteRate', value: `${formatNumber(statistics.byteRate, 0)} B/s` },
    { key: 'monitor.stats.crcErrors', value: formatNumber(statistics.crcErrors) },
    { key: 'monitor.stats.checksumErrors', value: formatNumber(statistics.checksumErrors) },
    { key: 'monitor.stats.framingErrors', value: formatNumber(statistics.framingErrors) },
    { key: 'monitor.stats.timeoutErrors', value: formatNumber(statistics.timeoutErrors) },
    {
      key: 'monitor.stats.crcErrorRate',
      value: optional(statistics.crcErrorRatePercent, (value) => `%${formatNumber(value, 2)}`),
    },
    {
      key: 'monitor.stats.minFrameLength',
      value: optional(statistics.minFrameLength, (value) => `${formatNumber(value)} B`),
    },
    {
      key: 'monitor.stats.maxFrameLength',
      value: optional(statistics.maxFrameLength, (value) => `${formatNumber(value)} B`),
    },
    {
      key: 'monitor.stats.avgFrameLength',
      value: optional(statistics.averageFrameLength, (value) => `${formatNumber(value, 1)} B`),
    },
    { key: 'monitor.stats.sequenceErrors', value: formatNumber(statistics.sequenceErrors) },
    {
      key: 'monitor.stats.packetLoss',
      value: optional(statistics.packetLossRatePercent, (value) => `%${formatNumber(value, 2)}`),
    },
    {
      key: 'monitor.stats.meanPeriod',
      value: optional(statistics.meanPeriodMs, (value) => `${formatNumber(value, 3)} ms`),
    },
    {
      key: 'monitor.stats.jitter',
      value: optional(statistics.lastJitterMs, (value) => `${formatNumber(value, 3)} ms`),
    },
    {
      key: 'monitor.stats.periodStdDev',
      value: optional(statistics.periodStdDevMs, (value) => `${formatNumber(value, 3)} ms`),
    },
    {
      key: 'monitor.stats.busLoad',
      value: optional(statistics.busLoadPercent, (value) => `%${formatNumber(value, 2)}`),
    },
    {
      key: 'monitor.stats.responseTime',
      value:
        statistics.minResponseTimeMs === undefined || statistics.maxResponseTimeMs === undefined
          ? unknown
          : `${formatNumber(statistics.minResponseTimeMs, 2)} / ${formatNumber(statistics.maxResponseTimeMs, 2)} ms`,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <div key={entry.key} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">{t(entry.key)}</dt>
            <dd className="text-sm font-semibold text-text tabular">{entry.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">{t('monitor.stats.formulaNote')}</p>
    </div>
  );
}
