/**
 * Akış ayrıştırıcı Worker köprüsü — spec §41/§44: "Worker cancellation
 * uygula", "canlı akış UI thread'ini bloklamamalı". Gerçek durum makinesi
 * (`../protocol-core/streams/streamBuffer.ts`) burada TEKRAR YAZILMAZ, yalnız
 * `postMessage` protokolüyle sarılır.
 *
 * `tsconfig.json`'ın tek, `DOM` kitaplıklı projesi `self`/`postMessage`i
 * `Window` imzasıyla tanır (`WebWorker` kitaplığı eklemek `DOM`la ÇAKIŞIR —
 * ikisi `postMessage` için uyumsuz imza taşır). İkinci bir worker-scope'lu
 * tsconfig açmak yerine (proje genelinde tek build/typecheck adımını
 * bölerdi) bu dosya `self`i KENDİ dar arayüzüyle `declare` eder — yalnız
 * burada kullanılan iki üyeyi (`onmessage`, `postMessage`) tanımlar, geri
 * kalan Worker/DOM global'lerine hiç ihtiyaç duymaz.
 *
 * Mesaj işleyicisi (`createWorkerMessageHandler`) BİLEREK bu `self`
 * bağlamından AYRI, saf bir fonksiyon: `postMessage`i enjekte edilen bir
 * callback üzerinden çağırır, böylece gerçek bir Worker global'i olmadan
 * (Vitest/jsdom'da) doğrudan test edilebilir — dosyanın son iki satırı
 * (`self.onmessage = …`) kasıtlı olarak test edilmeyen, önemsiz tel bağlantısı.
 */

import { createExtractorFromConfig } from '../protocol-core/framing/createExtractor';
import type { FramingMethodConfig } from '../protocol-core/framing/createExtractor';
import type { FramingError } from '../protocol-core/framing/types';
import { createStreamBuffer } from '../protocol-core/streams/streamBuffer';
import type { StreamBuffer } from '../protocol-core/streams/streamBuffer';
import type { StreamBufferState } from '../protocol-core/streams/types';
import type { FrameDirection, RawFrame } from '../protocol-core/types';

export interface WorkerInitMessage {
  readonly type: 'init';
  readonly config: FramingMethodConfig;
  readonly maxFrameLength: number;
  readonly direction?: FrameDirection;
  readonly channel?: string;
}
export interface WorkerPushMessage {
  readonly type: 'push';
  readonly chunk: Uint8Array;
  readonly receivedAt?: number;
}
export interface WorkerTickMessage {
  readonly type: 'tick';
  readonly nowMs: number;
}
export interface WorkerResetMessage {
  readonly type: 'reset';
}
/** Spec §41 "Worker cancellation" — arabelleği ve durumu temizler, `init` DIŞINDA sonraki her mesajı yok sayar. */
export interface WorkerCancelMessage {
  readonly type: 'cancel';
}

export type WorkerInMessage = WorkerInitMessage | WorkerPushMessage | WorkerTickMessage | WorkerResetMessage | WorkerCancelMessage;

export interface WorkerFrameMessage {
  readonly type: 'frame';
  readonly frame: RawFrame;
}
export interface WorkerErrorMessage {
  readonly type: 'error';
  readonly error: FramingError;
  readonly recoverable: boolean;
  /**
   * Hatanın SAPTANDIĞI an, epoch ms — `RawFrame.timestamp` ile aynı taban
   * (`performance.timeOrigin + performance.now()`).
   *
   * Neden Worker damgalıyor: ana thread mesajları kareye bir kez toplu
   * boşaltıyor. Damga orada atılsaydı hata, kendisinden SONRA ayrıştırılmış
   * çerçevelerden daha geç görünürdü ve canlı listede zaman damgaları geri
   * giderdi — tam da sebep-sonuç izlemenin dayandığı sıra bozulurdu.
   */
  readonly timestamp: number;
}
export interface WorkerStateMessage {
  readonly type: 'state';
  readonly state: StreamBufferState;
}

export type WorkerOutMessage = WorkerFrameMessage | WorkerErrorMessage | WorkerStateMessage;

export type PostMessageFn = (message: WorkerOutMessage) => void;

/**
 * Worker'ın mesaj işleme mantığı — `self` bağlamından bilerek KOPARILMIŞ,
 * saf(a yakın) bir fabrika: gelen her mesajı işler, üretilen çıktıyı
 * `post`a verir. `init` YENİDEN çağrılabilir (örn. kullanıcı çerçeveleme
 * yöntemini değiştirdi) — önceki `StreamBuffer` sessizce bırakılır, yeni bir
 * tanesi kurulur.
 */
export function createWorkerMessageHandler(post: PostMessageFn): (message: WorkerInMessage) => void {
  let buffer: StreamBuffer | null = null;
  let cancelled = false;

  return function handleMessage(message: WorkerInMessage): void {
    if (cancelled && message.type !== 'init') return;

    switch (message.type) {
      case 'init': {
        cancelled = false;
        const extractor = createExtractorFromConfig(message.config);
        buffer = createStreamBuffer(extractor, {
          maxFrameLength: message.maxFrameLength,
          ...(message.direction !== undefined ? { direction: message.direction } : {}),
          ...(message.channel !== undefined ? { channel: message.channel } : {}),
        });
        buffer.onFrame((frame) => post({ type: 'frame', frame }));
        buffer.onError((error, recoverable) =>
          post({
            type: 'error',
            error,
            recoverable,
            timestamp: performance.timeOrigin + performance.now(),
          }),
        );
        buffer.onStateChange((state) => post({ type: 'state', state }));
        return;
      }
      case 'push':
        buffer?.push(message.chunk, message.receivedAt);
        return;
      case 'tick':
        buffer?.tick(message.nowMs);
        return;
      case 'reset':
        buffer?.reset();
        return;
      case 'cancel':
        // Worker PROCESS'ini kapatmak (`self.close()`) çağıranın (ana iş
        // parçacığının `worker.terminate()`i) kararıdır — burası yalnız İÇ
        // durumu iptal eder, aynı worker sonradan yeni bir `init` ile
        // yeniden kullanılabilir.
        buffer?.reset();
        cancelled = true;
        return;
    }
  };
}

declare const self: {
  onmessage: ((event: { data: WorkerInMessage }) => void) | null;
  postMessage: (message: WorkerOutMessage) => void;
};

const handleMessage = createWorkerMessageHandler((message) => {
  self.postMessage(message);
});
self.onmessage = (event) => {
  handleMessage(event.data);
};
