/**
 * Log ayrıştırma Worker köprüsü — CLAUDE.md "Ağır iş Web Worker'a" ve spec §34
 * "Büyük dosyalar Web Worker içinde işlenmelidir" maddesi. Ayrıştırmanın
 * kendisi (`protocol-core/logs`) burada TEKRAR YAZILMAZ, yalnız `postMessage`
 * protokolüyle sarılır — `streamParser.worker.ts` ile aynı düzen.
 *
 * ── İPTALİN SINIRI (dürüstçe) ─────────────────────────────────────────────
 * `parseLogFile` tek parça, senkron bir çağrıdır; başladıktan sonra ORTASINDAN
 * durdurulamaz. `cancel` bu yüzden "hesabı durdurur" demez, SONUCU ATAR: ana
 * iş parçacığı iptal ettiği bir yüklemenin sonucunu almaz. Gerçek kesinti
 * isteniyorsa çağıran `worker.terminate()` etmelidir — bu kararı Worker
 * kendisi veremez. Kullanıcı açısından fark eden şey UI'ın donmamasıdır ve o
 * zaten sağlanır: ayrıştırma ana iş parçacığında DEĞİLDİR.
 *
 * `self` bilerek dar bir arayüzle `declare` edilir (`WebWorker` kitaplığını
 * eklemek tek tsconfig'li bu projede `DOM` ile çakışır — bkz.
 * `streamParser.worker.ts` başlığı).
 */

import { parseLogFile } from '../protocol-core/logs/parseLog';
import type { ParseLogOptions } from '../protocol-core/logs/parseLog';
import type { LogParseResult } from '../protocol-core/logs/types';

export interface LogWorkerParseMessage {
  readonly type: 'parse';
  /** İstek kimliği: geç gelen bir sonucun hangi yüklemeye ait olduğu buradan bilinir. */
  readonly requestId: number;
  readonly fileName?: string;
  readonly bytes: Uint8Array;
  readonly options?: ParseLogOptions;
}

export interface LogWorkerCancelMessage {
  readonly type: 'cancel';
}

export type LogWorkerInMessage = LogWorkerParseMessage | LogWorkerCancelMessage;

export interface LogWorkerResultMessage {
  readonly type: 'result';
  readonly requestId: number;
  readonly result: LogParseResult;
  /** Ayrıştırmanın sürdüğü süre (ms) — kullanıcıya "9,2 MB, 1,4 s" diye gösterilir. */
  readonly elapsedMs: number;
}

export interface LogWorkerFailedMessage {
  readonly type: 'failed';
  readonly requestId: number;
  readonly message: string;
}

export type LogWorkerOutMessage = LogWorkerResultMessage | LogWorkerFailedMessage;

export type PostLogMessageFn = (message: LogWorkerOutMessage) => void;

/**
 * Mesaj işleyicisi — `self` bağlamından KOPARILMIŞ saf fabrika, böylece
 * gerçek bir Worker global'i olmadan (Vitest/jsdom) doğrudan test edilir.
 */
export function createLogWorkerMessageHandler(post: PostLogMessageFn): (message: LogWorkerInMessage) => void {
  let cancelledRequestId: number | undefined;

  return function handleMessage(message: LogWorkerInMessage): void {
    if (message.type === 'cancel') {
      cancelledRequestId = undefined;
      return;
    }

    const startedAt = Date.now();
    let result: LogParseResult;
    try {
      result = parseLogFile({ bytes: message.bytes, ...(message.fileName === undefined ? {} : { fileName: message.fileName }) }, message.options ?? {});
    } catch (cause) {
      // Ayrıştırıcıların sözleşmesi "çökme yok"tur; yine de beklenmedik bir
      // istisna Worker'ı sessizce öldürmesin — ana iş parçacığı sonsuza kadar
      // "yükleniyor" göstermemeli.
      post({
        type: 'failed',
        requestId: message.requestId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return;
    }

    if (cancelledRequestId === message.requestId) return;
    post({ type: 'result', requestId: message.requestId, result, elapsedMs: Date.now() - startedAt });
  };
}

declare const self: {
  onmessage: ((event: { data: LogWorkerInMessage }) => void) | null;
  postMessage: (message: LogWorkerOutMessage) => void;
};

const handleMessage = createLogWorkerMessageHandler((message) => {
  self.postMessage(message);
});
self.onmessage = (event) => {
  handleMessage(event.data);
};
