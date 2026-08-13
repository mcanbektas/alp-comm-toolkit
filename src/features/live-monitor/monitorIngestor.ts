/**
 * Monitörün veri çekirdeği: Worker'dan gelen çerçeve/hata olaylarını kayda,
 * istatistiğe ve grafik örneğine çevirir.
 *
 * React'ten BAĞIMSIZ tutuldu (CLAUDE.md mimari kuralı ve test edilebilirlik):
 * hook yalnız bunu bir Worker'a ve bir çizim döngüsüne bağlar. Böylece "5000
 * çerçeve girdiğinde istatistik ne der" sorusu tarayıcı açmadan sınanabiliyor.
 */

import { createRingBuffer, type RingBuffer } from '../../protocol-core/buffers/ringBuffer';
import type { FramingError } from '../../protocol-core/framing/types';
import {
  createCommStatisticsAccumulator,
  type CommStatisticsAccumulator,
  type CommStatisticsSnapshot,
  type LinkOptions,
} from '../../protocol-core/statistics/commStatistics';
import { downsampleLttb } from '../../protocol-core/statistics/downsample';
import {
  computeSignalStatistics,
  type SignalStatistics,
} from '../../protocol-core/statistics/signalStatistics';
import type { RawFrame } from '../../protocol-core/types';
import type { ChartDatum } from '../../components/charts/LiveLineChart';
import { validateFrame, type FrameValidationConfig } from './frameValidation';
import { readSignalValues, type SignalTap } from './signalTaps';
import type { MonitorRecord } from './types';

export interface ChartSample {
  /** Epoch ms. */
  readonly x: number;
  readonly values: readonly (number | undefined)[];
}

export interface MonitorIngestorConfig {
  readonly validation: FrameValidationConfig;
  readonly taps: readonly SignalTap[];
  /** Halka arabellek kapasitesi — spec §44 hedefi 100 000 satır. */
  readonly bufferCapacity: number;
  /** Grafiğin kayan penceresi (örnek sayısı) — spec §37 "Rolling window". */
  readonly chartSampleCapacity: number;
  readonly link?: LinkOptions;
  readonly sequenceModulus?: number;
}

export interface MonitorIngestor {
  ingestFrame(frame: RawFrame): void;
  ingestError(error: FramingError, recoverable: boolean, timestamp: number): void;
  recordTimeout(): void;
  recordAt(index: number): MonitorRecord | undefined;
  readonly recordCount: number;
  readonly droppedCount: number;
  allRecords(): MonitorRecord[];
  statistics(nowMs: number): CommStatisticsSnapshot;
  signalStatistics(): SignalStatistics[];
  chartData(maxPoints: number): ChartDatum[];
  setLink(link: LinkOptions | undefined): void;
  clear(): void;
}

export function createMonitorIngestor(config: MonitorIngestorConfig): MonitorIngestor {
  const records: RingBuffer<MonitorRecord> = createRingBuffer<MonitorRecord>(config.bufferCapacity);
  const samples: RingBuffer<ChartSample> = createRingBuffer<ChartSample>(config.chartSampleCapacity);
  // Hat ayarı çalışma zamanında değişebilir (baud değiştirilip yeniden
  // bağlanmak gibi); `clear()` sonrasında da geçerli kalmalı, bu yüzden
  // yapılandırmadan ayrı tutuluyor.
  let currentLink = config.link;
  let statisticsAccumulator: CommStatisticsAccumulator = createCommStatisticsAccumulator({
    link: currentLink,
    sequenceModulus: config.sequenceModulus,
  });
  let nextIndex = 0;
  const hasTaps = config.taps.length > 0;

  return {
    ingestFrame(frame: RawFrame): void {
      const validity = validateFrame(frame.bytes, config.validation);
      const signals = hasTaps ? readSignalValues(frame.bytes, config.taps) : [];

      records.push({
        kind: 'frame',
        index: nextIndex,
        timestamp: frame.timestamp,
        direction: frame.direction,
        bytes: frame.bytes,
        validity,
        signals,
      });
      nextIndex += 1;

      statisticsAccumulator.recordFrame({
        direction: frame.direction,
        byteLength: frame.bytes.length,
        timestamp: frame.timestamp,
        validity,
      });

      // Grafik örneği iki koşulla eklenir:
      //
      // 1. En az bir sinyal okunabilmiş olmalı — hepsi undefined ise çerçeve o
      //    alanları taşımıyordur, grafiğe boşluk basmanın anlamı yok.
      // 2. Çerçeve doğrulamayı GEÇMİŞ olmalı. Checksum'ı tutmayan çerçevenin
      //    payload'ı tanım gereği güvenilmezdir; onu grafiğe ve sinyal
      //    istatistiğine katmak min/max'ı zehirler — bozuk tek bayt
      //    "sıcaklık -50 °C'ye düştü" diye okunur. Bozuk çerçeve kayıt
      //    listesinde ve hata sayaçlarında DURUR, yalnız sinyal ölçümünden
      //    dışlanır.
      const trustworthy = validity === 'valid' || validity === 'unchecked';
      if (hasTaps && trustworthy && signals.some((value) => value !== undefined)) {
        samples.push({ x: frame.timestamp, values: signals });
      }
    },

    ingestError(error: FramingError, recoverable: boolean, timestamp: number): void {
      records.push({
        kind: 'error',
        index: nextIndex,
        timestamp,
        code: error.code,
        message: error.message,
        recoverable,
      });
      nextIndex += 1;
      statisticsAccumulator.recordFramingError(error.code);
    },

    recordTimeout(): void {
      statisticsAccumulator.recordTimeout();
    },

    recordAt(index: number): MonitorRecord | undefined {
      return records.at(index);
    },

    get recordCount() {
      return records.size;
    },

    get droppedCount() {
      return records.droppedCount;
    },

    allRecords(): MonitorRecord[] {
      return records.toArray();
    },

    statistics(nowMs: number): CommStatisticsSnapshot {
      return statisticsAccumulator.snapshot(nowMs);
    },

    signalStatistics(): SignalStatistics[] {
      const window = samples.toArray();
      return config.taps.map((_tap, tapIndex) =>
        computeSignalStatistics(
          window
            .map((sample) => sample.values[tapIndex])
            .filter((value): value is number => value !== undefined),
        ),
      );
    },

    chartData(maxPoints: number): ChartDatum[] {
      const window = samples.toArray();
      const first = window[0];
      if (first === undefined) {
        return [];
      }

      /**
       * Seyreltme BİRİNCİ seriye göre yapılır ve seçilen ÖRNEK İNDEKSLERİ bütün
       * serilere uygulanır. Her seri ayrı seyreltilseydi ortak bir x ekseni
       * kalmaz, tek bir veri dizisiyle çizilemezlerdi. Bedeli: diğer serilerin
       * tepe noktaları birinci serininki kadar iyi korunmaz — canlı akışta
       * seriler aynı çerçeveden geldiği için örnekleme zaten eş adımlıdır ve
       * kayıp gözle görülür düzeye çıkmaz.
       *
       * LTTB'ye x olarak zaman değil İNDEKS verilir: örnekler eş adımlı olduğu
       * için üçgen alanı aynı, ama seçilen noktayı geri bulmak O(1) oluyor.
       */
      const points = window.map((sample, index) => ({ x: index, y: sample.values[0] ?? 0 }));
      const kept = downsampleLttb(points, maxPoints);

      return kept.reduce<ChartDatum[]>((accumulated, point) => {
        const sample = window[point.x];
        if (sample === undefined) {
          return accumulated;
        }
        const datum: { x: number } & Record<string, number | undefined> = {
          // Saniye cinsinden göreli zaman: epoch ms ekseni okunamaz.
          x: (sample.x - first.x) / 1000,
        };
        config.taps.forEach((tap, tapIndex) => {
          datum[tap.id] = sample.values[tapIndex];
        });
        accumulated.push(datum);
        return accumulated;
      }, []);
    },

    setLink(link: LinkOptions | undefined): void {
      currentLink = link;
      statisticsAccumulator.setLink(link);
    },

    clear(): void {
      records.clear();
      samples.clear();
      nextIndex = 0;
      statisticsAccumulator = createCommStatisticsAccumulator({
        link: currentLink,
        sequenceModulus: config.sequenceModulus,
      });
    },
  };
}
