/**
 * Canlı monitörün bağlantı + ayrıştırma + yayınlama döngüsü.
 *
 * PERFORMANS DEĞİŞMEZİ (spec §44): kare başına en fazla bir React güncellemesi
 * yapılır ve o bile ~10 Hz'e kısılır. Neden:
 *
 * 1. Ayrıştırma Worker'da. Ana thread yalnız hazır çerçeveleri alır.
 * 2. Worker mesajları GELDİĞİ ANDA React state'ine YAZILMAZ. Saniyede binlerce
 *    `setState` çağrısı tek başına arayüzü kilitler. Mesajlar sıradan bir
 *    diziye birikir; `requestAnimationFrame` döngüsü kareye bir kez boşaltır.
 * 3. Boşaltma React'e dokunmaz — halka arabelleğe ve istatistik biriktiricisine
 *    yazar. React'e yalnız `UI_REFRESH_INTERVAL_MS`de bir "sürüm arttı" sinyali
 *    gider. 60 Hz yerine 10 Hz yayın, tablo ve grafiği yeniden çizme maliyetini
 *    altıya böler; canlı bir monitör için 100 ms gecikme fark edilmez.
 *
 * Yani veri TAM HIZDA toplanır, ekran sabit hızda tazelenir. İkisi ayrı.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ByteSource,
  ByteSourceHandlers,
  ConnectionError,
  ConnectionStatus,
} from '../../connection/types';
import { createSimulatedSource, type SimulatedSourceOptions } from '../../connection/mock/simulatedSource';
import { createSerialSource } from '../../connection/serial/serialSource';
import type { SerialConnectionOptions } from '../../connection/serial/serialOptions';
import { serialBitsPerByte } from '../../connection/serial/serialOptions';
import type { WebSerialPort } from '../../connection/serial/webSerialTypes';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { StreamBufferState } from '../../protocol-core/streams/types';
import {
  EMPTY_COMM_STATISTICS,
  type CommStatisticsSnapshot,
} from '../../protocol-core/statistics/commStatistics';
import type { SignalStatistics } from '../../protocol-core/statistics/signalStatistics';
import type { ChartDatum } from '../../components/charts/LiveLineChart';
import type { WorkerInMessage, WorkerOutMessage } from '../../workers/streamParser.worker';
import { createMonitorIngestor, type MonitorIngestorConfig } from './monitorIngestor';
import type { MonitorRecord } from './types';

/** Ekran tazeleme aralığı — yukarıdaki değişmezin 3. maddesi. */
const UI_REFRESH_INTERVAL_MS = 100;

export interface LiveMonitorConfig extends MonitorIngestorConfig {
  readonly framing: FramingMethodConfig;
  readonly maxFrameLength: number;
  /** Spec §8.1 "Frame timeout" — bu süre veri gelmezse zaman aşımı sayılır. */
  readonly frameTimeoutMs: number;
  /** Grafikte çizilecek azami nokta (spec §44). */
  readonly chartMaxPoints: number;
}

export interface LiveMonitorState {
  readonly status: ConnectionStatus;
  readonly error: ConnectionError | undefined;
  readonly parserState: StreamBufferState;
  readonly recordCount: number;
  readonly droppedCount: number;
  readonly statistics: CommStatisticsSnapshot;
  readonly displayPaused: boolean;
  readonly sourceKind: ByteSource['kind'] | undefined;
}

export interface LiveMonitorApi {
  readonly state: LiveMonitorState;
  recordAt(index: number): MonitorRecord | undefined;
  allRecords(): MonitorRecord[];
  chartData(): ChartDatum[];
  signalStatistics(): SignalStatistics[];
  connectSerial(port: WebSerialPort, options: SerialConnectionOptions): Promise<void>;
  connectSimulated(options?: SimulatedSourceOptions): Promise<void>;
  disconnect(): Promise<void>;
  clear(): void;
  setDisplayPaused(paused: boolean): void;
}

const INITIAL_STATE: LiveMonitorState = {
  status: 'idle',
  error: undefined,
  parserState: 'SEARCHING_FOR_FRAME',
  recordCount: 0,
  droppedCount: 0,
  statistics: EMPTY_COMM_STATISTICS,
  displayPaused: false,
  sourceKind: undefined,
};

export function useLiveMonitor(config: LiveMonitorConfig): LiveMonitorApi {
  const ingestor = useMemo(
    () =>
      createMonitorIngestor({
        validation: config.validation,
        taps: config.taps,
        bufferCapacity: config.bufferCapacity,
        chartSampleCapacity: config.chartSampleCapacity,
        link: config.link,
        sequenceModulus: config.sequenceModulus,
      }),
    // Yapılandırma değişince biriktirici baştan kurulur: eski kayıtlar yeni
    // doğrulama/musluk ayarına göre üretilmediği için karışık listede
    // gösterilmeleri yanıltıcı olurdu.
    [
      config.validation,
      config.taps,
      config.bufferCapacity,
      config.chartSampleCapacity,
      config.link,
      config.sequenceModulus,
    ],
  );

  const workerRef = useRef<Worker | undefined>(undefined);
  const sourceRef = useRef<ByteSource | undefined>(undefined);
  const pendingRef = useRef<WorkerOutMessage[]>([]);
  const parserStateRef = useRef<StreamBufferState>('SEARCHING_FOR_FRAME');
  const lastChunkAtRef = useRef<number | undefined>(undefined);
  const timeoutRecordedRef = useRef(false);
  const displayPausedRef = useRef(false);
  const frameRef = useRef<number | undefined>(undefined);
  const lastPublishRef = useRef(0);

  const [state, setState] = useState<LiveMonitorState>(INITIAL_STATE);
  /** Yayın sinyali: değeri anlamsız, değişmesi "arabellek tazelendi" demek. */
  const [, setVersion] = useState(0);

  const post = useCallback((message: WorkerInMessage) => {
    workerRef.current?.postMessage(message);
  }, []);

  /** Kareye bir kez: biriken Worker mesajlarını arabelleğe boşalt, gerekiyorsa yayınla. */
  const drain = useCallback(() => {
    frameRef.current = requestAnimationFrame(drain);

    const nowMs = performance.timeOrigin + performance.now();
    const batch = pendingRef.current;
    if (batch.length > 0) {
      pendingRef.current = [];
      for (const message of batch) {
        switch (message.type) {
          case 'frame':
            ingestor.ingestFrame(message.frame);
            break;
          case 'error':
            // Damga Worker'dan gelir, buradan DEĞİL: `nowMs` boşaltma anıdır ve
            // hatayı kendisinden sonraki çerçevelerden geç gösterirdi.
            ingestor.ingestError(message.error, message.recoverable, message.timestamp);
            break;
          case 'state':
            parserStateRef.current = message.state;
            break;
        }
      }
    }

    // Zaman tabanlı çerçeveleme yöntemleri (inter-frame timeout, Modbus sessiz
    // aralık) veri gelmese de ilerlemeli — tick olmadan son çerçeve asla
    // tamamlanmaz.
    if (sourceRef.current !== undefined) {
      post({ type: 'tick', nowMs });
    }

    const lastChunkAt = lastChunkAtRef.current;
    if (
      sourceRef.current !== undefined &&
      lastChunkAt !== undefined &&
      nowMs - lastChunkAt > config.frameTimeoutMs
    ) {
      // Boşluk başına bir kez sayılır; yoksa sessiz hat her karede zaman aşımı üretirdi.
      if (!timeoutRecordedRef.current) {
        timeoutRecordedRef.current = true;
        ingestor.recordTimeout();
      }
    }

    if (displayPausedRef.current) {
      return;
    }

    const sinceLastPublish = nowMs - lastPublishRef.current;
    if (sinceLastPublish < UI_REFRESH_INTERVAL_MS) {
      return;
    }
    lastPublishRef.current = nowMs;

    setState((previous) => {
      const statistics = ingestor.statistics(nowMs);
      const recordCount = ingestor.recordCount;
      const droppedCount = ingestor.droppedCount;
      const parserState = parserStateRef.current;
      if (
        previous.recordCount === recordCount &&
        previous.droppedCount === droppedCount &&
        previous.parserState === parserState &&
        previous.statistics.packetRate === statistics.packetRate &&
        previous.statistics.byteRate === statistics.byteRate
      ) {
        // Hiçbir şey değişmediyse yeni nesne üretme: boşta duran monitör
        // sonsuza dek yeniden render etmemeli.
        return previous;
      }
      return { ...previous, recordCount, droppedCount, parserState, statistics };
    });
    setVersion((value) => value + 1);
  }, [config.frameTimeoutMs, ingestor, post]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(drain);
    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [drain]);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current !== undefined) {
      return workerRef.current;
    }
    // Vite bu URL biçimini tanıyıp Worker'ı ayrı bir chunk olarak paketler.
    const worker = new Worker(new URL('../../workers/streamParser.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      pendingRef.current.push(event.data);
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const teardown = useCallback(async () => {
    const source = sourceRef.current;
    sourceRef.current = undefined;
    if (source !== undefined) {
      await source.stop();
    }
    const worker = workerRef.current;
    if (worker !== undefined) {
      // Önce cancel: Worker yarım çerçeveyi atsın ve yeni mesaj üretmesin.
      // Sonra terminate — spec §41 "Worker cancellation uygula".
      worker.postMessage({ type: 'cancel' } satisfies WorkerInMessage);
      worker.terminate();
      workerRef.current = undefined;
    }
    pendingRef.current = [];
    lastChunkAtRef.current = undefined;
    timeoutRecordedRef.current = false;
  }, []);

  const createHandlers = useCallback(
    (): ByteSourceHandlers => ({
      onChunk: (chunk, receivedAt) => {
        lastChunkAtRef.current = receivedAt;
        timeoutRecordedRef.current = false;
        post({ type: 'push', chunk, receivedAt });
      },
      onStatus: (status) => {
        setState((previous) => ({ ...previous, status }));
      },
      onError: (error) => {
        setState((previous) => ({ ...previous, error }));
      },
    }),
    [post],
  );

  const startSource = useCallback(
    async (source: ByteSource) => {
      await teardown();
      ingestor.clear();
      parserStateRef.current = 'SEARCHING_FOR_FRAME';

      const worker = ensureWorker();
      worker.postMessage({
        type: 'init',
        config: config.framing,
        maxFrameLength: config.maxFrameLength,
        direction: 'rx',
      } satisfies WorkerInMessage);

      sourceRef.current = source;
      setState((previous) => ({
        ...previous,
        error: undefined,
        recordCount: 0,
        droppedCount: 0,
        statistics: EMPTY_COMM_STATISTICS,
        sourceKind: source.kind,
      }));
      await source.start(createHandlers());
    },
    [config.framing, config.maxFrameLength, createHandlers, ensureWorker, ingestor, teardown],
  );

  const connectSerial = useCallback(
    async (port: WebSerialPort, options: SerialConnectionOptions) => {
      ingestor.setLink({ baudRate: options.baudRate, bitsPerByte: serialBitsPerByte(options) });
      await startSource(createSerialSource(port, options));
    },
    [ingestor, startSource],
  );

  const connectSimulated = useCallback(
    async (options?: SimulatedSourceOptions) => {
      // Simülasyonun fiziksel bir hattı yok; bus load anlamsız olurdu.
      ingestor.setLink(undefined);
      await startSource(createSimulatedSource(options));
    },
    [ingestor, startSource],
  );

  const disconnect = useCallback(async () => {
    await teardown();
    setState((previous) => ({ ...previous, status: 'idle', sourceKind: undefined }));
  }, [teardown]);

  const clear = useCallback(() => {
    ingestor.clear();
    setState((previous) => ({
      ...previous,
      recordCount: 0,
      droppedCount: 0,
      statistics: EMPTY_COMM_STATISTICS,
      error: undefined,
    }));
  }, [ingestor]);

  const setDisplayPaused = useCallback((paused: boolean) => {
    // Yalnız EKRAN durur; veri toplanmaya devam eder. Duraklatma sırasında
    // gelen çerçeveler kaybolmaz, sürdürünce hepsi tablodadır.
    displayPausedRef.current = paused;
    setState((previous) => ({ ...previous, displayPaused: paused }));
  }, []);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const recordAt = useCallback((index: number) => ingestor.recordAt(index), [ingestor]);
  const allRecords = useCallback(() => ingestor.allRecords(), [ingestor]);
  const chartData = useCallback(
    () => ingestor.chartData(config.chartMaxPoints),
    [config.chartMaxPoints, ingestor],
  );
  const signalStatistics = useCallback(() => ingestor.signalStatistics(), [ingestor]);

  return {
    state,
    recordAt,
    allRecords,
    chartData,
    signalStatistics,
    connectSerial,
    connectSimulated,
    disconnect,
    clear,
    setDisplayPaused,
  };
}
