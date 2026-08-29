/**
 * Log Analyzer'ın durum yönetimi (spec §34). Ayrıştırma, filtre, istatistik ve
 * çözümleme HESAPLARININ HİÇBİRİ burada değildir — hepsi `protocol-core/logs`
 * altındaki saf modüllerde. Bu dosya yalnız onları React yaşam döngüsüne
 * bağlar (CLAUDE.md: "Protokol hesabı React bileşeninin içine yazılmaz").
 *
 * ── WORKER VE YEDEĞİ ──────────────────────────────────────────────────────
 * Ayrıştırma Worker'da koşar (spec §34: "Büyük dosyalar Web Worker içinde
 * işlenmelidir"). `Worker` bulunmayan ortamda (jsdom testleri, Worker'ı kapatan
 * eski WebView) aynı saf fonksiyon ana iş parçacığında çağrılır: davranış
 * aynıdır, yalnız büyük dosyada arayüz o süre boyunca donar. Sessizce
 * "yükleniyor"da asılı kalmaktansa yavaş ama doğru çalışmak yeğdir.
 *
 * ── İSTEK KİMLİĞİ NEDEN VAR ───────────────────────────────────────────────
 * Kullanıcı ilk dosya okunurken ikinciyi seçebilir. Sonuçlar geliş sırasına
 * göre değil, İSTEK KİMLİĞİNE göre kabul edilir; eski istek geç gelirse atılır.
 * Bu olmadan büyük bir dosyanın geç gelen sonucu, kullanıcının sonradan seçtiği
 * küçük dosyanın ekranını ezerdi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { applyLogFilter } from '@/protocol-core/logs/logFilter';
import type { LogFilter } from '@/protocol-core/logs/logFilter';
import { buildTimeline, computeLogStatistics } from '@/protocol-core/logs/logStatistics';
import type { LogStatistics, TimelineBucket } from '@/protocol-core/logs/logStatistics';
import { parseLogFile } from '@/protocol-core/logs/parseLog';
import type { ParseLogOptions } from '@/protocol-core/logs/parseLog';
import type { LogParseSummary, LogRecord, LogSourceFormat, LogWarning } from '@/protocol-core/logs/types';
import { recordsToCsv } from '@/protocol-core/logs/logExport';
import { downloadTextFile } from '@/utils/downloadTextFile';
import type { LogWorkerInMessage, LogWorkerOutMessage } from '@/workers/logAnalyzer.worker';

/** Zaman çizgisi kova sayısı: 420 px genişlikte her kova en az 4 px kalır. */
export const TIMELINE_BUCKET_COUNT = 96;

export type LogAnalyzerStatus = 'idle' | 'parsing' | 'ready' | 'error';

export interface LogAnalyzerState {
  readonly status: LogAnalyzerStatus;
  readonly fileName: string | undefined;
  readonly fileSizeBytes: number | undefined;
  readonly elapsedMs: number | undefined;
  readonly summary: LogParseSummary | undefined;
  readonly records: readonly LogRecord[];
  readonly warnings: readonly LogWarning[];
  readonly errorMessage: string | undefined;
}

const INITIAL_STATE: LogAnalyzerState = {
  status: 'idle',
  fileName: undefined,
  fileSizeBytes: undefined,
  elapsedMs: undefined,
  summary: undefined,
  records: [],
  warnings: [],
  errorMessage: undefined,
};

export interface UseLogAnalyzerResult {
  readonly state: LogAnalyzerState;
  readonly filter: LogFilter;
  readonly filteredRecords: readonly LogRecord[];
  /** Filtre UYGULANMADAN önceki istatistik — filtre seçeneklerinin kaynağı. */
  readonly sourceStatistics: LogStatistics;
  readonly statistics: LogStatistics;
  readonly timeline: readonly TimelineBucket[];
  readonly selectedRecord: LogRecord | undefined;
  readonly selectedIndex: number | undefined;
  /** Kullanıcının elle seçtiği biçim; `undefined` ise dosyadan saptanır. */
  readonly formatOverride: LogSourceFormat | undefined;
  loadFile(file: File): Promise<void>;
  setFilter(filter: LogFilter): void;
  setFormatOverride(format: LogSourceFormat | undefined): void;
  selectRecord(index: number | undefined): void;
  exportFilteredCsv(): void;
  reset(): void;
}

interface ParseOutcome {
  readonly state: LogAnalyzerState;
}

/** Worker varsa onu, yoksa ana iş parçacığını kullanır; sözleşme aynıdır. */
async function runParse(
  bytes: Uint8Array,
  fileName: string,
  options: ParseLogOptions,
  requestId: number,
): Promise<{ readonly result: ReturnType<typeof parseLogFile>; readonly elapsedMs: number }> {
  if (typeof Worker === 'undefined') {
    const startedAt = Date.now();
    return { result: parseLogFile({ bytes, fileName }, options), elapsedMs: Date.now() - startedAt };
  }

  // Vite bu URL biçimini tanıyıp Worker'ı ayrı bir chunk olarak paketler.
  const worker = new Worker(new URL('../../workers/logAnalyzer.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<LogWorkerOutMessage>) => {
        const message = event.data;
        if (message.requestId !== requestId) return;
        if (message.type === 'failed') {
          reject(new Error(message.message));
          return;
        }
        resolve({ result: message.result, elapsedMs: message.elapsedMs });
      };
      worker.onerror = (event: ErrorEvent) => {
        reject(new Error(event.message.length > 0 ? event.message : 'Worker hatası'));
      };
      worker.postMessage({ type: 'parse', requestId, fileName, bytes, options } satisfies LogWorkerInMessage);
    });
  } finally {
    // Spec §41 "Worker cancellation": önce iptal, sonra sonlandırma.
    worker.postMessage({ type: 'cancel' } satisfies LogWorkerInMessage);
    worker.terminate();
  }
}

export function useLogAnalyzer(): UseLogAnalyzerResult {
  const [state, setState] = useState<LogAnalyzerState>(INITIAL_STATE);
  const [filter, setFilterState] = useState<LogFilter>({});
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(undefined);
  const [formatOverride, setFormatOverrideState] = useState<LogSourceFormat | undefined>(undefined);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sourceStatistics = useMemo(() => computeLogStatistics(state.records), [state.records]);
  const filteredRecords = useMemo(() => applyLogFilter(state.records, filter), [state.records, filter]);
  const statistics = useMemo(() => computeLogStatistics(filteredRecords), [filteredRecords]);
  const timeline = useMemo(() => buildTimeline(filteredRecords, TIMELINE_BUCKET_COUNT), [filteredRecords]);

  const selectedRecord = useMemo(
    () => (selectedIndex === undefined ? undefined : filteredRecords[selectedIndex]),
    [filteredRecords, selectedIndex],
  );

  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setSelectedIndex(undefined);
      setState(() => ({
        ...INITIAL_STATE,
        status: 'parsing',
        fileName: file.name,
        fileSizeBytes: file.size,
        // Önceki dosyanın künyesi ve uyarıları yeni dosya okunurken kalmasın.
        summary: undefined,
        warnings: [],
      }));

      let outcome: ParseOutcome;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const options: ParseLogOptions = formatOverride === undefined ? {} : { format: formatOverride };
        const { result, elapsedMs } = await runParse(bytes, file.name, options, requestId);
        outcome = {
          state:
            result.status === 'ok'
              ? {
                  status: 'ready',
                  fileName: file.name,
                  fileSizeBytes: file.size,
                  elapsedMs,
                  summary: result.summary,
                  records: result.records,
                  warnings: result.warnings,
                  errorMessage: undefined,
                }
              : {
                  ...INITIAL_STATE,
                  status: 'error',
                  fileName: file.name,
                  fileSizeBytes: file.size,
                  errorMessage: result.message,
                },
        };
      } catch (cause) {
        outcome = {
          state: {
            ...INITIAL_STATE,
            status: 'error',
            fileName: file.name,
            fileSizeBytes: file.size,
            errorMessage: cause instanceof Error ? cause.message : String(cause),
          },
        };
      }

      // Geç gelen eski istek yeni ekranı ezmez.
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      setState(outcome.state);
    },
    [formatOverride],
  );

  const setFilter = useCallback((next: LogFilter): void => {
    setFilterState(next);
    // Filtre değişince seçim indeksi başka bir kaydı gösterirdi; seçim düşer.
    setSelectedIndex(undefined);
  }, []);

  const setFormatOverride = useCallback((format: LogSourceFormat | undefined): void => {
    setFormatOverrideState(format);
  }, []);

  const selectRecord = useCallback((index: number | undefined): void => {
    setSelectedIndex(index);
  }, []);

  const exportFilteredCsv = useCallback((): void => {
    const kind = state.summary?.timestampKind ?? 'none';
    const baseName = (state.fileName ?? 'log').replace(/\.[^.]+$/, '');
    downloadTextFile(`${baseName}-filtreli.csv`, recordsToCsv(filteredRecords, kind), 'text/csv');
  }, [filteredRecords, state.fileName, state.summary]);

  const reset = useCallback((): void => {
    requestIdRef.current += 1;
    setState(INITIAL_STATE);
    setFilterState({});
    setSelectedIndex(undefined);
  }, []);

  return {
    state,
    filter,
    filteredRecords,
    sourceStatistics,
    statistics,
    timeline,
    selectedRecord,
    selectedIndex,
    formatOverride,
    loadFile,
    setFilter,
    setFormatOverride,
    selectRecord,
    exportFilteredCsv,
    reset,
  };
}
