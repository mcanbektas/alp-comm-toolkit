/**
 * Sinyal paneli — spec §37: canlı grafik + her sinyal için Min/Max/Average/
 * RMS/Standard deviation.
 *
 * Grafik verisi buraya SEYRELTİLMİŞ gelir; nokta sayısı sınırı `chartMaxPoints`
 * ile ekrandan bağımsız uygulanır (spec §44).
 */

import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

import type { ChartDatum, ChartSeries } from '../../../components/charts/LiveLineChart';
import { useTranslation } from '../../../app/providers/LanguageProvider';
import type { SignalStatistics } from '../../../protocol-core/statistics/signalStatistics';
import type { SignalTap } from '../signalTaps';

/**
 * `LiveLineChart` TEMBEL: recharts'ı içe aktaran tek yer orası ve monitör
 * sayfası chunk'ının çoğunu tutuyor. Tip dışında statik bir import chart'ı
 * yine bu chunk'a dikerdi (bkz. docs/brief-monitor-grafik-ayirma.md).
 */
const LiveLineChart = lazy(async () => {
  const module = await import('../../../components/charts/LiveLineChart');
  return { default: module.LiveLineChart };
});

/** `LiveLineChart`in kendi varsayılan yüksekliğiyle AYNI — yoksa chunk inince yer tutucu zıplar. */
const CHART_HEIGHT = 260;

export interface SignalPanelProps {
  readonly taps: readonly SignalTap[];
  readonly data: readonly ChartDatum[];
  readonly statistics: readonly SignalStatistics[];
  readonly maxPoints: number;
}

function formatValue(value: number | undefined, unit: string): string {
  if (value === undefined) {
    return '—';
  }
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit === '' ? formatted : `${formatted} ${unit}`;
}

function ChartFallback({ label }: { label: string }): ReactNode {
  return (
    <div
      className="flex items-center justify-center rounded-token border border-line bg-surface p-4 text-sm text-muted"
      style={{ height: CHART_HEIGHT }}
    >
      {label}
    </div>
  );
}

export function SignalPanel({ taps, data, statistics, maxPoints }: SignalPanelProps): ReactNode {
  const { t } = useTranslation();

  if (taps.length === 0) {
    return <p className="text-sm text-muted">{t('monitor.chart.empty')}</p>;
  }

  const series: ChartSeries[] = taps.map((tap) => ({
    id: tap.id,
    label: tap.label,
    colorToken: tap.colorToken,
    unit: tap.unit,
    axis: tap.axis ?? 'left',
  }));

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<ChartFallback label={t('monitor.chart.loading')} />}>
        <LiveLineChart
          series={series}
          data={data}
          height={CHART_HEIGHT}
          xTickFormatter={(value) => `${value.toFixed(1)} s`}
          emptyLabel={t('monitor.chart.empty')}
        />
      </Suspense>

      <p className="text-xs text-muted">{t('monitor.chart.pointNote', { count: maxPoints })}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular">
          <thead className="bg-raised text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.section.signals')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.last')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.min')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.max')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.average')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.rms')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('monitor.signal.stdDev')}
              </th>
            </tr>
          </thead>
          <tbody>
            {taps.map((tap, index) => {
              const entry = statistics[index];
              return (
                <tr key={tap.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-text">
                    {tap.label}
                  </th>
                  <td className="px-3 py-2">{formatValue(entry?.last, tap.unit)}</td>
                  <td className="px-3 py-2">{formatValue(entry?.min, tap.unit)}</td>
                  <td className="px-3 py-2">{formatValue(entry?.max, tap.unit)}</td>
                  <td className="px-3 py-2">{formatValue(entry?.average, tap.unit)}</td>
                  <td className="px-3 py-2">{formatValue(entry?.rms, tap.unit)}</td>
                  <td className="px-3 py-2">{formatValue(entry?.stdDev, tap.unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
