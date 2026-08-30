/**
 * Sinyal paneli — spec §37: canlı grafik + her sinyal için Min/Max/Average/
 * RMS/Standard deviation.
 *
 * Grafik verisi buraya SEYRELTİLMİŞ gelir; nokta sayısı sınırı `chartMaxPoints`
 * ile ekrandan bağımsız uygulanır (spec §44).
 *
 * Çizim `components/signal-viewer/SignalViewer`e devredilir (2026-08-30):
 * burada kalan tek iş `SignalTap`ı (live-monitor'a özgü) `ChartSeries`e
 * çevirmek ve çeviri anahtarlarını çözüp `labels` prop'unu doldurmak.
 */

import type { ReactNode } from 'react';

import { SignalViewer, type SignalViewerLabels } from '../../../components/signal-viewer';
import type { ChartDatum, ChartSeries } from '../../../components/charts/LiveLineChart';
import { useTranslation } from '../../../app/providers/LanguageProvider';
import type { SignalStatistics } from '../../../protocol-core/statistics/signalStatistics';
import type { SignalTap } from '../signalTaps';

export interface SignalPanelProps {
  readonly taps: readonly SignalTap[];
  readonly data: readonly ChartDatum[];
  readonly statistics: readonly SignalStatistics[];
  readonly maxPoints: number;
}

export function SignalPanel({ taps, data, statistics, maxPoints }: SignalPanelProps): ReactNode {
  const { t } = useTranslation();

  const series: ChartSeries[] = taps.map((tap) => ({
    id: tap.id,
    label: tap.label,
    colorToken: tap.colorToken,
    unit: tap.unit,
    axis: tap.axis ?? 'left',
  }));

  const labels: SignalViewerLabels = {
    chartEmpty: t('monitor.chart.empty'),
    chartLoading: t('monitor.chart.loading'),
    pointNote: t('monitor.chart.pointNote', { count: maxPoints }),
    columnSignal: t('monitor.section.signals'),
    columnLast: t('monitor.signal.last'),
    columnMin: t('monitor.signal.min'),
    columnMax: t('monitor.signal.max'),
    columnAverage: t('monitor.signal.average'),
    columnRms: t('monitor.signal.rms'),
    columnStdDev: t('monitor.signal.stdDev'),
  };

  return (
    <SignalViewer
      series={series}
      data={data}
      statistics={statistics}
      xTickFormatter={(value) => `${value.toFixed(1)} s`}
      labels={labels}
    />
  );
}
