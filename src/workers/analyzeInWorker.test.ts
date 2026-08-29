import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAnalysisWorkerAvailable, startAnalysis } from './analyzeInWorker';
import { ANALYSIS_PHASES } from '../protocol-core/analysis/report';
import type { AnalysisFrame } from '../protocol-core/analysis/types';

/**
 * jsdom'da `Worker` YOKTUR; bu dosya bu yüzden istemcinin ana-iş-parçacığı
 * yolunu sınar — Worker yolunun kendisi `reverseEngineering.worker.test.ts`te,
 * gerçek tarayıcıdaki davranışı ise e2e'de sınanıyor.
 */
const RF_FRAMES: readonly AnalysisFrame[] = [
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]), timestamp: 1000 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]), timestamp: 1100 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]), timestamp: 1200 },
];

describe('startAnalysis — Worker olmayan ortam', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bu ortamda Worker yok', () => {
    expect(isAnalysisWorkerAvailable()).toBe(false);
  });

  it('geri çağrımlar SENKRON düşmez — oturum önce çağırana verilir', () => {
    const onResult = vi.fn();
    startAnalysis(RF_FRAMES, {}, { onResult });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('bütün adımları koşturup raporu verir', () => {
    const onResult = vi.fn();
    const onProgress = vi.fn();
    startAnalysis(RF_FRAMES, {}, { onResult, onProgress });
    vi.runAllTimers();

    expect(onProgress).toHaveBeenCalledTimes(ANALYSIS_PHASES.length);
    expect(onResult).toHaveBeenCalledTimes(1);
    const [report] = onResult.mock.calls[0] ?? [];
    expect(report?.frameCount).toBe(3);
    expect(report?.completedPhases).toEqual([...ANALYSIS_PHASES]);
  });

  it('adım arasında iptal edilince kısmi rapor döner', () => {
    const onResult = vi.fn();
    const onCancelled = vi.fn();
    const session = startAnalysis(RF_FRAMES, {}, { onResult, onCancelled });

    vi.advanceTimersToNextTimer(); // columns
    vi.advanceTimersToNextTimer(); // clusters
    session.cancel();
    vi.runAllTimers();

    expect(onResult).not.toHaveBeenCalled();
    expect(onCancelled).toHaveBeenCalledTimes(1);
    const [report] = onCancelled.mock.calls[0] ?? [];
    expect(report?.completedPhases).toEqual(['columns', 'clusters']);
  });
});
