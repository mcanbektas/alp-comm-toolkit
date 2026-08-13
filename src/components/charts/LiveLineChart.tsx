/**
 * Canlı çizgi grafiği — spec §37 "Live chart / Multiple signals / Rolling
 * window".
 *
 * Bileşen SEYRELTME YAPMAZ: veri buraya gelmeden önce `downsampleLttb` ile
 * sınırlandırılır (spec §44 "grafik maksimum nokta sayısını sınırlamalı").
 * Ayrım kasıtlı — seyreltme saf bir hesaptır ve protocol-core'da test edilir,
 * bileşen yalnız gösterir (CLAUDE.md mimari kuralı).
 */

import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useTokenColors } from './useTokenColors';

export interface ChartSeries {
  readonly id: string;
  readonly label: string;
  /** CSS özel özellik adı, ör. `--series-1`. Ham renk verilmez. */
  readonly colorToken: string;
  readonly unit?: string;
  /**
   * Düşey eksen. Büyüklük mertebeleri ayrışan sinyalleri tek eksende çizmek
   * küçük olanı taban çizgisine yapıştırır — grafik teknik olarak doğru ama
   * okunamaz olur. Verilmezse sol eksen.
   */
  readonly axis?: 'left' | 'right';
}

export interface ChartDatum {
  /** Yatay eksen değeri — canlı akışta saniye cinsinden göreli zaman. */
  readonly x: number;
  readonly [seriesId: string]: number | undefined;
}

export interface LiveLineChartProps {
  readonly series: readonly ChartSeries[];
  readonly data: readonly ChartDatum[];
  readonly height?: number;
  readonly xTickFormatter?: (value: number) => string;
  readonly emptyLabel?: string;
}

const DEFAULT_HEIGHT = 260;

export function LiveLineChart({
  series,
  data,
  height = DEFAULT_HEIGHT,
  xTickFormatter,
  emptyLabel,
}: LiveLineChartProps): ReactNode {
  const colors = useTokenColors(series.map((entry) => entry.colorToken));
  const axisColor = useTokenColors(['--muted'])[0] ?? 'currentColor';
  const gridColor = useTokenColors(['--line'])[0] ?? 'currentColor';
  const surfaceColor = useTokenColors(['--raised'])[0] ?? 'currentColor';
  const hasRightAxis = series.some((entry) => entry.axis === 'right');

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-token border border-line bg-surface p-4 text-sm text-muted"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data as ChartDatum[]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke={axisColor}
            tick={{ fill: axisColor, fontSize: 11 }}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke={axisColor}
            tick={{ fill: axisColor, fontSize: 11 }}
            width={56}
          />
          {/* Sağ eksen yalnız kullanan seri varsa çizilir — boş bir eksen
              grafiği daraltır ve hiçbir şey anlatmaz. */}
          {hasRightAxis ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              width={56}
            />
          ) : null}
          <Tooltip
            contentStyle={{
              background: surfaceColor,
              border: `1px solid ${gridColor}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(value) =>
              typeof value === 'number' && xTickFormatter !== undefined
                ? xTickFormatter(value)
                : String(value)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
          {series.map((entry, index) => (
            <Line
              key={entry.id}
              yAxisId={entry.axis ?? 'left'}
              type="monotone"
              dataKey={entry.id}
              name={entry.unit === undefined ? entry.label : `${entry.label} (${entry.unit})`}
              stroke={colors[index] ?? 'currentColor'}
              strokeWidth={1.5}
              // Canlı akışta nokta işaretleri hem gürültü hem DOM yükü; binlerce
              // <circle> çizmek grafiğin kendisinden pahalıya gelir.
              dot={false}
              // Akan veride giriş animasyonu her turda yeniden başlar ve çizgi titrer.
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
