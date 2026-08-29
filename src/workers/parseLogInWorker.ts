/**
 * Log ayrıştırma Worker'ının ANA İŞ PARÇACIĞI tarafındaki istemcisi.
 *
 * İki tüketicisi var (Log Analyzer ekranı ve monitörün dosya oynatma kaynağı)
 * ve ikisi de aynı üç şeyi ister: Worker'ı kur, sonucu iste, bitince kapat.
 * Bu dosya olmasaydı `new Worker(new URL(…))` satırı iki yerde dururdu ve
 * yalnız birinde düzeltilen bir hata sessizce yaşamaya devam ederdi.
 *
 * `Worker` bulunmayan ortamda (jsdom testleri, Worker'ı kapatan eski WebView)
 * aynı SAF fonksiyon ana iş parçacığında çağrılır: sonuç aynıdır, yalnız büyük
 * dosyada arayüz o süre boyunca donar. Sessizce "yükleniyor"da asılı kalmak
 * yerine yavaş ama doğru çalışmak yeğdir.
 */

import { parseLogFile } from '../protocol-core/logs/parseLog';
import type { ParseLogOptions } from '../protocol-core/logs/parseLog';
import type { LogParseResult } from '../protocol-core/logs/types';
import type { LogWorkerInMessage, LogWorkerOutMessage } from './logAnalyzer.worker';

export interface LogParseRun {
  readonly result: LogParseResult;
  readonly elapsedMs: number;
}

let nextRequestId = 0;

export function isLogWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

export async function parseLogInWorker(
  bytes: Uint8Array,
  fileName: string,
  options: ParseLogOptions = {},
): Promise<LogParseRun> {
  if (!isLogWorkerAvailable()) {
    const startedAt = Date.now();
    return { result: parseLogFile({ bytes, fileName }, options), elapsedMs: Date.now() - startedAt };
  }

  const requestId = ++nextRequestId;
  // Vite bu URL biçimini tanıyıp Worker'ı ayrı bir chunk olarak paketler.
  const worker = new Worker(new URL('./logAnalyzer.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<LogParseRun>((resolve, reject) => {
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
