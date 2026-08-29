/**
 * Kural tabanlı simüle CİHAZ — isteğe yanıt veren bir `ByteSource`.
 *
 * `simulatedSource.ts` bir YAYIN kaynağıdır: kendiliğinden telemetri üretir,
 * yazma yönü yoktur (`canWrite: false`). Test Automation'ın (§38) ihtiyacı
 * bunun tersi: "status request gönder → 0x31 komutlu yanıtı bekle" zinciri
 * ancak yazılana CEVAP VEREN bir karşı taraf varsa koşabilir. Playwright'ta
 * Web Serial yoktur (`../types.ts` başlık yorumu), yani senaryo koşusunun
 * tarayıcıda sınanabilmesi tamamen bu dosyaya bağlı.
 *
 * `kind` yine `'simulated'`: `ByteSourceKind` birliğini genişletmek, türü
 * kullanan her tüketicide (monitör kaynak seçici, durum metinleri, e2e
 * beklentileri) daralma etkisi yaratırdı ve kazancı yok — bu da bir
 * simülasyon, yalnız yönü iki taraflı.
 *
 * ── EŞLEŞMEYEN İSTEĞE CEVAP YOK ───────────────────────────────────────────
 * Hiçbir kural tutmuyorsa cihaz SESSİZ kalır. Uydurma bir "bilinmeyen komut"
 * yanıtı üretmek, senaryodaki zaman aşımı adımını test edilemez kılardı:
 * gerçek cihazlar da tanımadıkları komuta çoğunlukla susar.
 */

import type { ByteSource, ByteSourceHandlers } from '../types';

export interface DeviceRule {
  /**
   * İsteğin `offset`inden itibaren bu baytlar geliyorsa kural tutar.
   * Verilmezse HER isteğe tutar — kural listesinde son sıraya konur.
   */
  readonly match?: { readonly offset: number; readonly bytes: readonly number[] };
  readonly response: readonly number[];
  /** Cihazın yanıt gecikmesi; verilmezse `defaultDelayMs`. */
  readonly delayMs?: number;
}

export interface SimulatedDeviceOptions {
  readonly rules: readonly DeviceRule[];
  readonly defaultDelayMs?: number;
  /** Yanıtı parçalara böler — çerçeveleyicinin birleştirme yolunu sınamak için. */
  readonly maxChunkSize?: number;
}

const DEFAULT_DELAY_MS = 10;

function matchesRule(request: Uint8Array, rule: DeviceRule): boolean {
  const match = rule.match;
  if (match === undefined) return true;
  if (match.offset + match.bytes.length > request.length) return false;
  return match.bytes.every((byte, index) => request[match.offset + index] === byte);
}

export function createSimulatedDevice(options: SimulatedDeviceOptions): ByteSource {
  const defaultDelayMs = options.defaultDelayMs ?? DEFAULT_DELAY_MS;
  const maxChunkSize = options.maxChunkSize;

  let handlers: ByteSourceHandlers | undefined;
  let running = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function emit(response: readonly number[]): void {
    const target = handlers;
    if (target === undefined || !running) return;

    const bytes = Uint8Array.from(response);
    const receivedAt = performance.timeOrigin + performance.now();
    if (maxChunkSize === undefined || maxChunkSize >= bytes.length) {
      // Tampon burada yeni üretildi ve tüketiciye devrediliyor; paylaşılan
      // bir görünüm olmadığı için ayrıca kopyalamaya gerek yok.
      target.onChunk(bytes, receivedAt);
      return;
    }
    for (let start = 0; start < bytes.length; start += maxChunkSize) {
      target.onChunk(bytes.slice(start, start + maxChunkSize), receivedAt);
    }
  }

  return {
    kind: 'simulated',
    canWrite: true,

    async start(nextHandlers: ByteSourceHandlers): Promise<void> {
      if (running) return;
      handlers = nextHandlers;
      running = true;
      nextHandlers.onStatus('connecting');
      nextHandlers.onStatus('connected');
    },

    async stop(): Promise<void> {
      if (!running) return;
      running = false;
      // Bekleyen yanıtlar temizlenmezse kapanmış bir kaynaktan çerçeve
      // düşer; tüketici çoktan durum makinesini sıfırlamış olur.
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      handlers?.onStatus('idle');
      handlers = undefined;
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (!running) {
        throw new Error('not-connected');
      }
      const rule = options.rules.find((candidate) => matchesRule(bytes, candidate));
      if (rule === undefined) return;

      const delay = rule.delayMs ?? defaultDelayMs;
      const timer = setTimeout(() => {
        timers.delete(timer);
        emit(rule.response);
      }, delay);
      timers.add(timer);
    },
  };
}
