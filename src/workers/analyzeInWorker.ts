/**
 * Bilinmeyen protokol analizi Worker'ının ANA İŞ PARÇACIĞI tarafındaki istemcisi.
 *
 * `parseLogInWorker.ts` ile aynı gerekçe (tek `new Worker(new URL(…))` satırı,
 * Worker'sız ortamda saf yol) ama sözleşmesi FARKLI olmak zorunda: log
 * ayrıştırma tek atımlık bir söz (`Promise`) verirken analiz SÜREN bir iştir —
 * ilerleme bildirir ve ortasında iptal edilebilir (§44, 39680-39692). Bu yüzden
 * dönen şey bir `Promise` değil bir OTURUM: `cancel()` çağrılabilir, sonuç
 * geri çağrımla gelir.
 *
 * Bir oturum ancak `result`, `cancelled` ya da `failed`ten BİRİYLE biter ve
 * bittikten sonra Worker sonlandırılır — analiz sayfası açık kaldığı sürece
 * boşta bir Worker tutmanın anlamı yok, yeni analiz yeni Worker açar.
 *
 * Worker bulunmayan ortamda (jsdom, Worker'ı kapatan WebView) aynı adımlar ana
 * iş parçacığında, aynı adım sırasıyla ve yine makro görevlere bölünerek koşar:
 * iptal orada da adım arasında gerçektir, kaybedilen tek şey akıcılıktır —
 * adımın kendisi arayüzü bloklar. Yavaş ama doğru, sessizce asılı kalmaktan
 * yeğdir.
 */

import { createAnalysisRunner } from '../protocol-core/analysis/report';
import { packFrames, transferListOf } from '../protocol-core/analysis/packedFrames';
import type { AnalysisFrame } from '../protocol-core/analysis/types';
import type { AnalysisPhase, ReverseEngineeringOptions, ReverseEngineeringReport } from '../protocol-core/analysis/report';
import type { ReverseEngineeringInMessage, ReverseEngineeringOutMessage } from './reverseEngineering.worker';

export interface AnalysisProgress {
  readonly phase: AnalysisPhase;
  readonly completed: number;
  readonly total: number;
}

export interface AnalysisHandlers {
  readonly onProgress?: (progress: AnalysisProgress) => void;
  readonly onResult?: (report: ReverseEngineeringReport, elapsedMs: number) => void;
  /** İptal edilen analizin KISMİ raporu; tamamlanan adımlar yine gösterilebilir. */
  readonly onCancelled?: (report: ReverseEngineeringReport) => void;
  readonly onFailed?: (message: string) => void;
}

export interface AnalysisSession {
  cancel(): void;
}

let nextRequestId = 0;

export function isAnalysisWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

function runOnMainThread(
  frames: readonly AnalysisFrame[],
  options: ReverseEngineeringOptions,
  handlers: AnalysisHandlers,
): AnalysisSession {
  let cancelled = false;
  const startedAt = Date.now();
  const runner = createAnalysisRunner(frames, options, { shouldCancel: () => cancelled });
  let index = 0;

  // Adımlar Worker'daki gibi makro görevlere bölünür. Tek bir senkron döngü
  // olsaydı çağıran oturumu ELİNE ALMADAN analiz biterdi: `cancel()` hiçbir
  // zaman işe yaramaz, geri çağrımlar ise React'te render sırasında düşerdi.
  // Adım İÇİ iş yine bloklar — burada kazanılan iptal, akıcılık değil.
  const runNext = (): void => {
    if (cancelled) {
      handlers.onCancelled?.(runner.snapshot());
      return;
    }

    const step = runner.steps[index];
    if (step === undefined) {
      handlers.onResult?.(runner.snapshot(), Date.now() - startedAt);
      return;
    }

    try {
      step.run();
    } catch (cause) {
      handlers.onFailed?.(cause instanceof Error ? cause.message : String(cause));
      return;
    }

    index += 1;
    handlers.onProgress?.({ phase: step.phase, completed: index, total: runner.steps.length });
    setTimeout(runNext, 0);
  };

  setTimeout(runNext, 0);

  return {
    cancel: () => {
      cancelled = true;
    },
  };
}

export function startAnalysis(
  frames: readonly AnalysisFrame[],
  options: ReverseEngineeringOptions,
  handlers: AnalysisHandlers,
): AnalysisSession {
  if (!isAnalysisWorkerAvailable()) return runOnMainThread(frames, options, handlers);

  const requestId = ++nextRequestId;
  // Vite bu URL biçimini tanıyıp Worker'ı ayrı bir chunk olarak paketler.
  const worker = new Worker(new URL('./reverseEngineering.worker.ts', import.meta.url), { type: 'module' });
  let finished = false;

  function finish(): void {
    if (finished) return;
    finished = true;
    worker.terminate();
  }

  worker.onmessage = (event: MessageEvent<ReverseEngineeringOutMessage>) => {
    const message = event.data;
    if (message.requestId !== requestId) return;

    switch (message.type) {
      case 'progress':
        handlers.onProgress?.({ phase: message.phase, completed: message.completed, total: message.total });
        return;
      case 'result':
        finish();
        handlers.onResult?.(message.report, message.elapsedMs);
        return;
      case 'cancelled':
        finish();
        handlers.onCancelled?.(message.report);
        return;
      case 'failed':
        finish();
        handlers.onFailed?.(message.message);
        return;
    }
  };
  worker.onerror = (event: ErrorEvent) => {
    finish();
    handlers.onFailed?.(event.message.length > 0 ? event.message : 'Worker hatası');
  };

  const packed = packFrames(frames);
  worker.postMessage({ type: 'analyze', requestId, frames: packed, options } satisfies ReverseEngineeringInMessage, transferListOf(packed));

  return {
    cancel: () => {
      if (finished) return;
      // Sonlandırma DEĞİL iptal: Worker adım arasında mesajı görür ve kısmi
      // raporu gönderir; `terminate()` o raporu da öldürürdü.
      worker.postMessage({ type: 'cancel', requestId } satisfies ReverseEngineeringInMessage);
    },
  };
}
