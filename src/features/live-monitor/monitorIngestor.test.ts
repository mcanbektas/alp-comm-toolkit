/**
 * Uçtan uca boru hattı testi: simüle bayt akışı → gerçek stream buffer →
 * ingestor → kayıt/istatistik/grafik. Yalnız Worker ve React dışarıda kalır;
 * onlar Playwright turunda doğrulanır.
 */

import { describe, expect, it } from 'vitest';

import {
  createLcg,
  createSimulatedByteStream,
  SIMULATED_FRAMING_CONFIG,
  splitIntoChunks,
} from '../../connection/mock/simulatedProtocol';
import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';
import { createMonitorIngestor, type MonitorIngestor } from './monitorIngestor';
import { SIMULATED_FRAME_VALIDATION, DEFAULT_FRAME_VALIDATION } from './frameValidation';
import { SIMULATED_SIGNAL_TAPS } from './signalTaps';
import { isFrameRecord } from './types';

const MAX_FRAME_LENGTH = 512;

/**
 * Çerçeve zaman damgaları Worker'ın `createRawFrame` varsayılanından, yani
 * EPOCH tabanından gelir. Geçen süreye bakan metrikler (hat yükü, ortalama hız)
 * bu tabanda bir "şimdi" ister; küçük yapay sayılar verilirse elapsed sıfır
 * çıkar ve metrik "ölçülmedi" döner.
 */
function epochNow(offsetMs: number): number {
  return performance.timeOrigin + performance.now() + offsetMs;
}

interface PipelineOptions {
  readonly frameCount: number;
  readonly corruptionRate?: number;
  readonly garbageRate?: number;
  readonly bufferCapacity?: number;
  readonly chartSampleCapacity?: number;
  readonly seed?: number;
}

function runPipeline(options: PipelineOptions): MonitorIngestor {
  const ingestor = createMonitorIngestor({
    validation: SIMULATED_FRAME_VALIDATION,
    taps: SIMULATED_SIGNAL_TAPS,
    bufferCapacity: options.bufferCapacity ?? 10_000,
    chartSampleCapacity: options.chartSampleCapacity ?? 2000,
  });

  const seed = options.seed ?? 4242;
  const stream = createSimulatedByteStream({
    seed,
    corruptionRate: options.corruptionRate ?? 0,
    garbageRate: options.garbageRate ?? 0,
  });

  const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
    maxFrameLength: MAX_FRAME_LENGTH,
  });
  let clock = 1000;
  buffer.onFrame((frame) => ingestor.ingestFrame(frame));
  buffer.onError((error, recoverable) => {
    ingestor.ingestError(error, recoverable, clock);
  });

  const frames: Uint8Array[] = [];
  let total = 0;
  for (let index = 0; index < options.frameCount; index += 1) {
    const frame = stream.next();
    frames.push(frame);
    total += frame.length;
  }
  const batch = new Uint8Array(total);
  let offset = 0;
  for (const frame of frames) {
    batch.set(frame, offset);
    offset += frame.length;
  }

  for (const chunk of splitIntoChunks(batch, createLcg(seed ^ 0xabcd), 5)) {
    clock += 1;
    buffer.push(chunk, clock);
  }

  return ingestor;
}

describe('createMonitorIngestor', () => {
  it('boş biriktirici hiçbir kayıt ve grafik noktası vermez', () => {
    const ingestor = createMonitorIngestor({
      validation: DEFAULT_FRAME_VALIDATION,
      taps: [],
      bufferCapacity: 10,
      chartSampleCapacity: 10,
    });

    expect(ingestor.recordCount).toBe(0);
    expect(ingestor.droppedCount).toBe(0);
    expect(ingestor.allRecords()).toEqual([]);
    expect(ingestor.chartData(100)).toEqual([]);
    expect(ingestor.statistics(0).totalFrames).toBe(0);
  });

  it('temiz akışta her çerçeveyi geçerli olarak kaydeder', () => {
    const ingestor = runPipeline({ frameCount: 120 });
    const statistics = ingestor.statistics(2000);

    expect(ingestor.recordCount).toBe(120);
    expect(statistics.totalFrames).toBe(120);
    expect(statistics.validFrames).toBe(120);
    expect(statistics.invalidFrames).toBe(0);
    expect(statistics.framingErrors).toBe(0);
  });

  it('bozuk çerçeveleri checksum hatası olarak sayar — çerçeveleme değil doğrulama yakalar', () => {
    const ingestor = runPipeline({ frameCount: 200, corruptionRate: 0.25 });
    const statistics = ingestor.statistics(3000);

    expect(statistics.totalFrames).toBe(200);
    expect(statistics.checksumErrors).toBeGreaterThan(0);
    expect(statistics.validFrames + statistics.invalidFrames).toBe(200);
    // Çerçeveleme sağlam: bozulma payload'da, sınırlarda değil.
    expect(statistics.framingErrors).toBe(0);
    expect(statistics.crcErrorRatePercent).toBeGreaterThan(0);
  });

  it('çöp baytlar çerçeveleme hatası olarak ayrı kaydedilir', () => {
    const ingestor = runPipeline({ frameCount: 60, garbageRate: 1 });
    const statistics = ingestor.statistics(3000);

    expect(statistics.framingErrors).toBeGreaterThan(0);
    expect(statistics.framingErrorsByCode['no-sync']).toBeGreaterThan(0);
    // Hata kayıtları da listede — hangi iki çerçeve arasında olduğu görünsün diye.
    expect(ingestor.allRecords().some((record) => !isFrameRecord(record))).toBe(true);
    expect(statistics.totalFrames).toBe(60);
  });

  it('sinyalleri fiziksel değer olarak okur ve makul aralıkta tutar', () => {
    const ingestor = runPipeline({ frameCount: 200 });
    const records = ingestor.allRecords().filter(isFrameRecord);

    expect(records.length).toBe(200);
    for (const record of records) {
      const [temperature, voltage, rpm] = record.signals;
      expect(temperature).toBeGreaterThan(15);
      expect(temperature).toBeLessThan(35);
      expect(voltage).toBeGreaterThan(11);
      expect(voltage).toBeLessThan(13);
      expect(rpm).toBeGreaterThanOrEqual(0);
    }
  });

  it('doğrulamayı geçemeyen çerçeve sinyal ölçümüne KATILMAZ', () => {
    // Bozulma payload'ın ilk baytını (sıcaklığın üst baytı) çevirir. Bozuk
    // çerçeveler grafiğe girseydi sıcaklık min/max'ı fiziksel aralığın çok
    // dışına savrulurdu — ekranda "-50 °C" olarak görülmüştü.
    const ingestor = runPipeline({ frameCount: 400, corruptionRate: 0.3 });
    const statistics = ingestor.signalStatistics();
    const temperature = statistics[0];

    expect(ingestor.statistics(epochNow(1000)).checksumErrors).toBeGreaterThan(0);
    expect(temperature?.min).toBeGreaterThan(15);
    expect(temperature?.max).toBeLessThan(35);
  });

  it('bozuk çerçeve kayıtta ve sayaçlarda kalır, yalnız grafikten dışlanır', () => {
    const ingestor = runPipeline({ frameCount: 50, corruptionRate: 1 });

    expect(ingestor.recordCount).toBe(50);
    expect(ingestor.statistics(epochNow(1000)).totalFrames).toBe(50);
    expect(ingestor.statistics(epochNow(1000)).checksumErrors).toBe(50);
    // Tek bir güvenilir çerçeve yok — grafik boş kalmalı, uydurma nokta basmamalı.
    expect(ingestor.chartData(100)).toEqual([]);
    expect(ingestor.signalStatistics().every((entry) => entry.count === 0)).toBe(true);
  });

  it('doğrulama kapalıyken çerçeveler grafiğe girer — "denetlenmedi" dışlama sebebi değil', () => {
    const ingestor = createMonitorIngestor({
      validation: DEFAULT_FRAME_VALIDATION,
      taps: SIMULATED_SIGNAL_TAPS,
      bufferCapacity: 500,
      chartSampleCapacity: 500,
    });
    const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
      maxFrameLength: MAX_FRAME_LENGTH,
    });
    buffer.onFrame((frame) => ingestor.ingestFrame(frame));
    const stream = createSimulatedByteStream({ seed: 8, corruptionRate: 0, garbageRate: 0 });
    for (let index = 0; index < 30; index += 1) {
      buffer.push(stream.next(), 1000 + index);
    }

    expect(ingestor.chartData(100).length).toBeGreaterThan(0);
  });

  it('sinyal istatistikleri musluk sırasını korur', () => {
    const ingestor = runPipeline({ frameCount: 300 });
    const statistics = ingestor.signalStatistics();

    expect(statistics).toHaveLength(SIMULATED_SIGNAL_TAPS.length);
    for (const entry of statistics) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.min).toBeLessThanOrEqual(entry.max ?? Number.POSITIVE_INFINITY);
      expect(entry.rms).toBeGreaterThanOrEqual(0);
    }
  });

  it('grafik verisi eşiği aşmaz ve her muslukla anahtarlanır', () => {
    const ingestor = runPipeline({ frameCount: 1500, chartSampleCapacity: 1500 });
    const data = ingestor.chartData(200);

    expect(data.length).toBeLessThanOrEqual(200);
    expect(data.length).toBeGreaterThan(0);
    const first = data[0];
    expect(first).toBeDefined();
    for (const tap of SIMULATED_SIGNAL_TAPS) {
      expect(first).toHaveProperty(tap.id);
    }
  });

  it('grafik x ekseni ilk örnekten itibaren saniye cinsindendir ve artar', () => {
    const ingestor = runPipeline({ frameCount: 400 });
    const data = ingestor.chartData(100);

    expect(data[0]?.x).toBe(0);
    for (let index = 1; index < data.length; index += 1) {
      expect(data[index]?.x ?? 0).toBeGreaterThanOrEqual(data[index - 1]?.x ?? 0);
    }
  });

  it('halka arabellek kapasitesi aşılınca en eski kayıt düşer ama sayaçlar tam kalır', () => {
    const ingestor = runPipeline({ frameCount: 500, bufferCapacity: 100 });

    expect(ingestor.recordCount).toBe(100);
    expect(ingestor.droppedCount).toBe(400);
    // İstatistik arabellekten BAĞIMSIZ: düşen kayıtlar da sayılmış olmalı.
    expect(ingestor.statistics(5000).totalFrames).toBe(500);
  });

  it('musluk yokken grafik boş kalır ama kayıtlar tutulur', () => {
    const ingestor = createMonitorIngestor({
      validation: SIMULATED_FRAME_VALIDATION,
      taps: [],
      bufferCapacity: 100,
      chartSampleCapacity: 100,
    });
    const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
      maxFrameLength: MAX_FRAME_LENGTH,
    });
    buffer.onFrame((frame) => ingestor.ingestFrame(frame));
    const stream = createSimulatedByteStream({ seed: 1, corruptionRate: 0, garbageRate: 0 });
    for (let index = 0; index < 10; index += 1) {
      buffer.push(stream.next(), 1000 + index);
    }

    expect(ingestor.recordCount).toBe(10);
    expect(ingestor.chartData(50)).toEqual([]);
    expect(ingestor.signalStatistics()).toEqual([]);
  });

  it('zaman aşımı sayacı istatistiğe işlenir', () => {
    const ingestor = runPipeline({ frameCount: 10 });
    ingestor.recordTimeout();
    ingestor.recordTimeout();

    expect(ingestor.statistics(2000).timeoutErrors).toBe(2);
  });

  it('setLink sonrası hat yükü hesaplanır', () => {
    const ingestor = runPipeline({ frameCount: 100 });
    expect(ingestor.statistics(epochNow(1000)).busLoadPercent).toBeUndefined();

    ingestor.setLink({ baudRate: 115200, bitsPerByte: 10 });

    expect(ingestor.statistics(epochNow(1000)).busLoadPercent).toBeGreaterThan(0);
  });

  it('clear() kayıtları, grafiği ve istatistiği sıfırlar; hat ayarını korur', () => {
    const ingestor = runPipeline({ frameCount: 200 });
    ingestor.setLink({ baudRate: 9600, bitsPerByte: 10 });

    ingestor.clear();

    expect(ingestor.recordCount).toBe(0);
    expect(ingestor.droppedCount).toBe(0);
    expect(ingestor.chartData(100)).toEqual([]);
    expect(ingestor.statistics(1000).totalFrames).toBe(0);

    // Hat ayarı temizlikten sağ çıkmalı: kullanıcı baud'u yeniden girmemeli.
    const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
      maxFrameLength: MAX_FRAME_LENGTH,
    });
    buffer.onFrame((frame) => ingestor.ingestFrame(frame));
    const stream = createSimulatedByteStream({ seed: 2, corruptionRate: 0, garbageRate: 0 });
    for (let index = 0; index < 20; index += 1) {
      buffer.push(stream.next(), 2000 + index);
    }

    expect(ingestor.statistics(epochNow(2000)).busLoadPercent).toBeGreaterThan(0);
  });

  it('kayıt indeksleri temizlikten sonra sıfırdan başlar', () => {
    const ingestor = runPipeline({ frameCount: 5 });
    expect(ingestor.recordAt(0)?.index).toBe(0);

    ingestor.clear();
    const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
      maxFrameLength: MAX_FRAME_LENGTH,
    });
    buffer.onFrame((frame) => ingestor.ingestFrame(frame));
    buffer.push(createSimulatedByteStream({ seed: 3, corruptionRate: 0, garbageRate: 0 }).next(), 1);

    expect(ingestor.recordAt(0)?.index).toBe(0);
  });

  it('5000 çerçeveyi tek turda işler — sıcak yol dizi büyütmeye dayanmamalı', () => {
    const ingestor = runPipeline({ frameCount: 5000, bufferCapacity: 100_000 });

    expect(ingestor.recordCount).toBe(5000);
    expect(ingestor.statistics(10_000).totalFrames).toBe(5000);
    // Sanallaştırılmış tablonun okuduğu tipik pencere hâlâ O(1) erişimli.
    expect(ingestor.recordAt(2500)?.index).toBe(2500);
  });
});
