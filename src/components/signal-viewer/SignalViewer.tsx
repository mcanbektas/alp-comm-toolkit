/**
 * Sinyal görünümü — canlı grafik (`LiveLineChart`) + her sinyal için Min/Max/
 * Average/RMS/Standard deviation tablosunu tek bileşende birleştirir (spec §6
 * `components/signal-viewer`).
 *
 * `live-monitor/SignalPanel`den TAŞINDI (2026-08-30). i18n bağı YOK
 * (`ByteViewer`/`LiveLineChart`/`PacketViewer` ile aynı kural): bütün metin
 * `labels` prop'undan gelir, `SignalTap` gibi live-monitor'a özgü tipler
 * burada YOKTUR — çağıran taps'ı `ChartSeries[]`e kendi çevirir.
 *
 * `LiveLineChart`i saran `lazy`+`Suspense` sınırı da TAŞINDI: recharts'ı içe
 * aktaran tek yer `LiveLineChart.tsx` ve bu artık her `SignalViewer`
 * tüketicisinin bedavaya aldığı bir özellik, tek tek yeniden kurulmaz.
 */

import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

import type { ChartDatum, ChartSeries } from '../charts/LiveLineChart';
import type { SignalStatistics } from '@/protocol-core/statistics/signalStatistics';

/**
 * Tip dışında statik bir import `LiveLineChart`i (ve recharts'ı) bu chunk'a
 * geri dikerdi (bkz. docs/brief-monitor-grafik-ayirma.md).
 */
const LiveLineChart = lazy(async () => {
  const module = await import('../charts/LiveLineChart');
  return { default: module.LiveLineChart };
});

/** `LiveLineChart`in kendi varsayılan yüksekliğiyle AYNI — yoksa chunk inince yer tutucu zıplar. */
const DEFAULT_CHART_HEIGHT = 260;

export interface SignalViewerLabels {
  /** Hem "hiç sinyal yok" hem grafiğin "hiç veri yok" durumunda kullanılır (davranış korunur). */
  readonly chartEmpty: string;
  readonly chartLoading: string;
  /** Zaten `{count}` yerine konmuş, biçimlenmiş metin. */
  readonly pointNote: string;
  readonly columnSignal: string;
  readonly columnLast: string;
  readonly columnMin: string;
  readonly columnMax: string;
  readonly columnAverage: string;
  readonly columnRms: string;
  readonly columnStdDev: string;
}

export interface SignalViewerProps {
  readonly series: readonly ChartSeries[];
  readonly data: readonly ChartDatum[];
  readonly statistics: readonly SignalStatistics[];
  readonly xTickFormatter?: (value: number) => string;
  readonly labels: SignalViewerLabels;
  readonly chartHeight?: number;
}

function formatValue(value: number | undefined, unit: string): string {
  if (value === undefined) {
    return '—';
  }
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit === '' ? formatted : `${formatted} ${unit}`;
}

function ChartFallback({ label, height }: { label: string; height: number }): ReactNode {
  return (
    <div
      className="flex items-center justify-center rounded-token border border-line bg-surface p-4 text-sm text-muted"
      style={{ height }}
    >
      {label}
    </div>
  );
}

export function SignalViewer({
  series,
  data,
  statistics,
  xTickFormatter,
  labels,
  chartHeight = DEFAULT_CHART_HEIGHT,
}: SignalViewerProps): ReactNode {
  if (series.length === 0) {
    return <p className="text-sm text-muted">{labels.chartEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<ChartFallback label={labels.chartLoading} height={chartHeight} />}>
        <LiveLineChart
          series={series}
          data={data}
          height={chartHeight}
          xTickFormatter={xTickFormatter}
          emptyLabel={labels.chartEmpty}
        />
      </Suspense>

      <p className="text-xs text-muted">{labels.pointNote}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular">
          <thead className="bg-raised text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnSignal}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnLast}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnMin}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnMax}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnAverage}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnRms}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels.columnStdDev}
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((entry, index) => {
              const stats = statistics[index];
              const unit = entry.unit ?? '';
              return (
                <tr key={entry.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-text">
                    {entry.label}
                  </th>
                  <td className="px-3 py-2">{formatValue(stats?.last, unit)}</td>
                  <td className="px-3 py-2">{formatValue(stats?.min, unit)}</td>
                  <td className="px-3 py-2">{formatValue(stats?.max, unit)}</td>
                  <td className="px-3 py-2">{formatValue(stats?.average, unit)}</td>
                  <td className="px-3 py-2">{formatValue(stats?.rms, unit)}</td>
                  <td className="px-3 py-2">{formatValue(stats?.stdDev, unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
