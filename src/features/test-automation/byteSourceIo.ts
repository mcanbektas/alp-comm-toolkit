/**
 * `ScenarioIo`nun bir `ByteSource` üstündeki gerçeklemesi — koşucuyu gerçek
 * (ya da simüle) bir cihaza bağlayan tek yer.
 *
 * Koşucu çerçeve bilir, kaynak bayt bilir; aradaki çerçeveleme
 * `protocol-core/streams/streamBuffer.ts`e bırakılır. Elle bir arabellek
 * yazmak, yarım çerçeve ve hatadan kurtulma mantığını ikinci kez (ve yalnız
 * burada düzeltilerek) üretmek olurdu.
 *
 * ── ÇERÇEVE KUYRUĞU: BEKLEMEDEN ÖNCE GELEN ÇERÇEVE KAYBOLMAZ ──────────────
 * Cihaz hızlıysa yanıt, `waitForFrame` çağrılmadan ÖNCE gelebilir. Gelen
 * çerçeveler bu yüzden kuyruğa yazılır ve bekleme önce kuyruğa bakar. Aksi
 * hâlde senaryo, cihaz doğru cevap verdiği hâlde zaman aşımına düşerdi —
 * hata vermeden, yanlış raporlayarak.
 *
 * ── FİLTREYİ IO UYGULAR ───────────────────────────────────────────────────
 * "0x31 komutlu çerçeveyi bekle" adımı, araya giren ilgisiz bir çerçeve
 * yüzünden BAŞARISIZ olmamalı — beklemek, eşleşen çerçeve gelene ya da süre
 * dolana kadar sürer. Eşleşmeyen çerçeveler atılır; atılan sayısı
 * `droppedFrames`ten okunur, sessizce yutulmaz.
 *
 * ── ZAMAN TABANI ──────────────────────────────────────────────────────────
 * `now()` `performance.timeOrigin + performance.now()`: epoch milisaniyesi
 * ama monotonik kaynaktan (`connection/types.ts` başlık yorumu). `Date.now()`
 * NTP düzeltmesiyle geriye sıçrar ve adım süreleri negatife düşerdi.
 */

import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { ByteSource, ConnectionError } from '../../connection/types';
import type { ReceivedFrame, ScenarioIo, WaitForFrameRequest } from './runner';
import type { FrameMatch } from './scenario';

const DEFAULT_MAX_FRAME_LENGTH = 4096;

/**
 * Zaman tabanlı çerçeveleme (`inter-frame-timeout`, `modbus-silent-interval`)
 * YENİ VERİ olmadan da tetiklenmek zorunda; `streamBuffer.tick()` bunu bekler.
 * Sürülmezse o yöntemlerde son çerçeve hiç kapanmaz — hata vermeden, sonsuza
 * kadar "bekleniyor"da kalarak. 20 ms `simulatedSource.ts`nin tur aralığıyla
 * aynı; bir kare bütçesinden geniş, saniyede 50 tur.
 */
const TICK_INTERVAL_MS = 20;

export interface ByteSourceIoOptions {
  readonly source: ByteSource;
  readonly framing: FramingMethodConfig;
  readonly maxFrameLength?: number;
  /** Şablon deposu ekrandan gelir; verilmezse şablonla gönderim hata verir. */
  readonly encodeTemplate?: (templateId: string) => Promise<Uint8Array>;
  readonly onError?: (error: ConnectionError) => void;
}

export interface ByteSourceScenarioIo extends ScenarioIo {
  /** Filtreye uymadığı için atılan çerçeve sayısı. */
  readonly droppedFrames: number;
  /** Kaynağı kapatır ve bekleyenleri çözer; ekran kapanışında çağrılır. */
  dispose(): Promise<void>;
}

interface Waiter {
  readonly match: FrameMatch | undefined;
  readonly resolve: (frame: ReceivedFrame | undefined) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

function matchesFrame(frame: Uint8Array, match: FrameMatch | undefined): boolean {
  if (match === undefined) return true;
  if (match.offset + match.bytes.length > frame.length) return false;
  return match.bytes.every((byte, index) => frame[match.offset + index] === byte);
}

export function createByteSourceIo(options: ByteSourceIoOptions): ByteSourceScenarioIo {
  const maxFrameLength = options.maxFrameLength ?? DEFAULT_MAX_FRAME_LENGTH;
  const extractor = createExtractorFromConfig(options.framing);
  const buffer = createStreamBuffer(extractor, { maxFrameLength });

  const pending: ReceivedFrame[] = [];
  const waiters = new Set<Waiter>();
  const sleepTimers = new Set<{ timer: ReturnType<typeof setTimeout>; resolve: () => void }>();
  let dropped = 0;
  let started = false;
  let tickTimer: ReturnType<typeof setInterval> | undefined;

  buffer.onFrame((frame) => {
    const received: ReceivedFrame = { bytes: frame.bytes.slice(), receivedAt: now() };

    for (const waiter of waiters) {
      if (!matchesFrame(received.bytes, waiter.match)) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(received);
      return;
    }
    // Bekleyen yoksa ya da hiçbiri bu çerçeveyi istemiyorsa kuyruğa yazılır;
    // sıradaki `waitForFrame` onu bulur.
    pending.push(received);
  });

  function now(): number {
    return performance.timeOrigin + performance.now();
  }

  function takePending(match: FrameMatch | undefined): ReceivedFrame | undefined {
    const index = pending.findIndex((frame) => matchesFrame(frame.bytes, match));
    if (index < 0) return undefined;
    // Eşleşenden ÖNCEKİLER atılır: onlar bu adımın beklediği çerçeve değil ve
    // bir sonraki adım için de bekletilmeleri sırayı bozardı.
    dropped += index;
    const [frame] = pending.splice(0, index + 1).slice(-1);
    return frame;
  }

  function stopTicking(): void {
    if (tickTimer === undefined) return;
    clearInterval(tickTimer);
    tickTimer = undefined;
  }

  function resolveAll(): void {
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(undefined);
    }
    waiters.clear();
    for (const entry of sleepTimers) {
      clearTimeout(entry.timer);
      entry.resolve();
    }
    sleepTimers.clear();
  }

  return {
    get droppedFrames(): number {
      return dropped;
    },

    now,

    async connect(): Promise<void> {
      if (started) return;
      await options.source.start({
        onChunk: (chunk, receivedAt) => {
          buffer.push(chunk, receivedAt);
        },
        onStatus: () => undefined,
        onError: (error) => {
          options.onError?.(error);
        },
      });
      // `push` ve `tick` AYNI zaman tabanından beslenir; ikisi karışırsa
      // zaman tabanlı çerçeveleme sessizce yanlış çerçeveler.
      tickTimer = setInterval(() => {
        buffer.tick(now());
      }, TICK_INTERVAL_MS);
      started = true;
    },

    async disconnect(): Promise<void> {
      if (!started) return;
      started = false;
      stopTicking();
      await options.source.stop();
      buffer.reset();
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (!options.source.canWrite) {
        // Sessizce başarılı dönmek, gönderilmemiş bir çerçeveyi gönderilmiş
        // gibi raporlardı.
        throw new Error('kaynak yazma yönünü desteklemiyor');
      }
      await options.source.write(bytes);
    },

    async waitForFrame(request: WaitForFrameRequest): Promise<ReceivedFrame | undefined> {
      const buffered = takePending(request.match);
      if (buffered !== undefined) return buffered;

      return new Promise<ReceivedFrame | undefined>((resolve) => {
        const waiter: Waiter = {
          match: request.match,
          resolve,
          timer: setTimeout(() => {
            waiters.delete(waiter);
            resolve(undefined);
          }, request.timeoutMs),
        };
        waiters.add(waiter);
      });
    },

    async sleep(durationMs: number): Promise<void> {
      return new Promise<void>((resolve) => {
        const entry = {
          timer: setTimeout(() => {
            sleepTimers.delete(entry);
            resolve();
          }, durationMs),
          resolve,
        };
        sleepTimers.add(entry);
      });
    },

    async encodeTemplate(templateId: string): Promise<Uint8Array> {
      const encode = options.encodeTemplate;
      if (encode === undefined) throw new Error('şablon deposu bağlı değil');
      return encode(templateId);
    },

    abort(): void {
      resolveAll();
    },

    async dispose(): Promise<void> {
      resolveAll();
      stopTicking();
      if (started) {
        started = false;
        await options.source.stop();
      }
      buffer.reset();
    },
  };
}
