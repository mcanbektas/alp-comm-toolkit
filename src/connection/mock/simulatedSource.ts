/**
 * Donanımsız `ByteSource` — spec §8.1'in "Simulated source" kaynağı.
 *
 * İki işi var: (1) Web Serial'i olmayan ya da cihazı olmayan kullanıcıya
 * monitörü gerçekten çalışır göstermek, (2) Playwright turunun tek veri
 * kaynağı olmak — gerçek seri port tarayıcı otomasyonunda açılamaz.
 */

import type { ByteSource, ByteSourceHandlers } from '../types';
import {
  createLcg,
  createSimulatedByteStream,
  DEFAULT_SIMULATED_STREAM_OPTIONS,
  splitIntoChunks,
  type SimulatedByteStreamOptions,
} from './simulatedProtocol';

export interface SimulatedSourceOptions {
  readonly framesPerSecond: number;
  readonly stream?: SimulatedByteStreamOptions;
  readonly maxChunkSize?: number;
}

export const DEFAULT_SIMULATED_SOURCE_OPTIONS: SimulatedSourceOptions = {
  framesPerSecond: 200,
  stream: DEFAULT_SIMULATED_STREAM_OPTIONS,
  maxChunkSize: 7,
};

/**
 * Zamanlayıcı aralığı. 20 ms seçildi: bir kare bütçesinden (16.7 ms) biraz
 * geniş, yani tur başına iş rAF ile yarışmıyor; yine de saniyede 50 tur veriyor,
 * o da yüksek hızda parça boyutunu makul tutuyor.
 */
const TICK_INTERVAL_MS = 20;

export function createSimulatedSource(
  options: SimulatedSourceOptions = DEFAULT_SIMULATED_SOURCE_OPTIONS,
): ByteSource {
  const streamOptions = options.stream ?? DEFAULT_SIMULATED_STREAM_OPTIONS;
  const maxChunkSize = options.maxChunkSize ?? 7;

  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  return {
    kind: 'simulated',
    canWrite: false,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      if (running) {
        return;
      }
      running = true;

      const byteStream = createSimulatedByteStream(streamOptions);
      const chunkRandom = createLcg(streamOptions.seed ^ 0x1234_5678);
      /**
       * Tur başına düşen çerçeve sayısı kesirli olabilir (ör. 5 fps'te tur
       * başına 0.1). Kesir birikmezse düşük hızlarda hiç çerçeve üretilmezdi.
       */
      let frameDebt = 0;

      handlers.onStatus('connecting');
      handlers.onStatus('connected');

      timer = setInterval(() => {
        frameDebt += (options.framesPerSecond * TICK_INTERVAL_MS) / 1000;
        const frameCount = Math.floor(frameDebt);
        if (frameCount <= 0) {
          return;
        }
        frameDebt -= frameCount;

        const frames: Uint8Array[] = [];
        let totalLength = 0;
        for (let index = 0; index < frameCount; index += 1) {
          const frame = byteStream.next();
          frames.push(frame);
          totalLength += frame.length;
        }

        const batch = new Uint8Array(totalLength);
        let offset = 0;
        for (const frame of frames) {
          batch.set(frame, offset);
          offset += frame.length;
        }

        const receivedAt = performance.timeOrigin + performance.now();
        for (const chunk of splitIntoChunks(batch, chunkRandom, maxChunkSize)) {
          handlers.onChunk(chunk, receivedAt);
        }
      }, TICK_INTERVAL_MS);
    },

    async stop(): Promise<void> {
      if (!running) {
        return;
      }
      running = false;
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    },

    async write(): Promise<void> {
      throw new Error('not-connected');
    },
  };
}
