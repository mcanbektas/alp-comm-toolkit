/**
 * Dosya oynatma kaynağı — spec §8.1'in "Dosya oynatma" maddesi. Kaydedilmiş
 * bir logu monitörün canlı hattıymış gibi geri oynatır; böylece donanım
 * olmadan da bütün canlı zincir (çerçeveleme → doğrulama → istatistik →
 * sinyal) gerçek veriyle koşar.
 *
 * ── DOSYAYI KENDİ AYRIŞTIRMAZ ─────────────────────────────────────────────
 * `createSerialSource` açılmış bir port TUTAMAĞI alır, `requestPort()`u
 * kendisi çağırmaz — test edilebilirliğin sebebi budur. Burada da aynı ayrım:
 * fabrika ÇÖZÜMLENMİŞ kayıtları alır (`protocol-core/logs`), dosya okuma ve
 * biçim saptama çağıranın işidir. Kaynak yalnız "ne zaman hangi baytı
 * gönderirim" sorusunu cevaplar.
 *
 * ── ZAMAN DAMGASI YENİDEN YAZILMAZ ────────────────────────────────────────
 * `onChunk`in `receivedAt`i sözleşme gereği ŞU ANIN saatidir
 * (`performance.timeOrigin + performance.now()`), logdaki özgün damga DEĞİL.
 * Özgün damgayı geçirmek cazip ama yıkıcı olurdu: zaman tabanlı çerçeveleme
 * (`inter-frame-timeout`, `modbus-silent-interval`) ve çerçeve zaman aşımı
 * gözcüsü ana iş parçacığının SAATİYLE karşılaştırır; iki farklı saat
 * karışınca çerçeveler rastgele açılıp kapanır. Logun kendi zamanlaması bu
 * yüzden damgaya değil TEMPOYA yazılır — kayıtlar arasındaki gerçek boşluklar
 * `replaySchedule.ts` ile yeniden üretilir.
 *
 * ── TEK ZAMANLAYICI ───────────────────────────────────────────────────────
 * Kayıt başına `setTimeout` kurulmaz: 200 bin kayıtlı bir log 200 bin
 * zamanlayıcı demektir. Tek bir `setInterval` her turda "vakti gelmiş" bütün
 * kayıtları boşaltır — `simulatedSource.ts`in düzeni.
 */

import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { LogRecord } from '../../protocol-core/logs/types';
import type { ByteSource, ByteSourceHandlers } from '../types';
import { buildReplaySchedule } from './replaySchedule';
import type { ReplayPacing } from './replaySchedule';

/** Simülasyon kaynağıyla aynı tur süresi: 16.7 ms'lik kare bütçesinin üstünde. */
const TICK_INTERVAL_MS = 20;
/** Tek kayıt bu boyu aşarsa gerçek bir portun yaptığı gibi parçalanır. */
const DEFAULT_MAX_CHUNK_SIZE = 256;

export interface FileSourceOptions {
  readonly pacing?: ReplayPacing;
  /** `realtime` hız çarpanı. */
  readonly speed?: number;
  /** `fixed-interval` kayıtlar arası süre. */
  readonly intervalMs?: number;
  /** İki kayıt arasında garanti edilen en küçük boşluk (çerçeveleme sınırı). */
  readonly minimumGapMs?: number;
  /** Uzun sessizliklerin kırpılacağı üst sınır. */
  readonly maxGapMs?: number;
  readonly maxChunkSize?: number;
  /** Oynatma bitince çağrılır. Sözleşmede bir "bitti" durumu YOK; bu ek bir kanaldır. */
  readonly onCompleted?: () => void;
}

export const DEFAULT_FILE_SOURCE_OPTIONS: FileSourceOptions = {
  pacing: 'realtime',
  speed: 1,
  intervalMs: 10,
  minimumGapMs: 0,
  maxGapMs: 1000,
  maxChunkSize: DEFAULT_MAX_CHUNK_SIZE,
};

function* splitIntoChunks(bytes: Uint8Array, maxChunkSize: number): Generator<Uint8Array> {
  if (bytes.length <= maxChunkSize) {
    yield bytes;
    return;
  }
  for (let offset = 0; offset < bytes.length; offset += maxChunkSize) {
    yield bytes.subarray(offset, Math.min(offset + maxChunkSize, bytes.length));
  }
}

export function createFileSource(
  records: readonly LogRecord[],
  options: FileSourceOptions = DEFAULT_FILE_SOURCE_OPTIONS,
): ByteSource {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const schedule = buildReplaySchedule(
    records.map((record) => record.timestamp),
    {
      pacing: options.pacing ?? 'realtime',
      ...(options.speed === undefined ? {} : { speed: options.speed }),
      ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
      ...(options.minimumGapMs === undefined ? {} : { minimumGapMs: options.minimumGapMs }),
      ...(options.maxGapMs === undefined ? {} : { maxGapMs: options.maxGapMs }),
    },
  );

  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;
  let nextIndex = 0;
  /**
   * Geçen süre TUR SAYARAK ilerletilir, `performance.now()` okunarak değil:
   * çizelge zaten kurgusal bir zaman ekseni ve sahte zamanlayıcıyla test
   * edilebilmesi gerekiyor. Gerçek tarayıcıda da tur aralığı sabit olduğu için
   * fark yok.
   */
  let elapsedMs = 0;

  return {
    kind: 'file',
    // Dosya oynatma tek yönlüdür: geri yazılacak bir hat yok.
    canWrite: false,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      if (running) return;
      running = true;
      nextIndex = 0;
      elapsedMs = 0;

      handlers.onStatus('connecting');
      handlers.onStatus('connected');

      const drain = (): void => {
        if (!running) return;
        const receivedAt = performance.timeOrigin + performance.now();

        while (nextIndex < records.length && (schedule[nextIndex] ?? 0) <= elapsedMs) {
          const record = records[nextIndex];
          nextIndex += 1;
          if (record === undefined || record.data.length === 0) continue;
          for (const chunk of splitIntoChunks(record.data, maxChunkSize)) {
            handlers.onChunk(chunk, receivedAt);
          }
        }

        if (nextIndex >= records.length) {
          // Oynatma bitti: zamanlayıcı durur ama kaynak AÇIK kalır. Bağlantıyı
          // kapatmak kullanıcının kararıdır — sözleşmede "bitti" durumu yok ve
          // uydurulmuş bir `idle` bildirimi ekranda "hiç bağlanmadı" gibi
          // okunurdu.
          if (timer !== undefined) {
            clearInterval(timer);
            timer = undefined;
          }
          options.onCompleted?.();
          return;
        }
        elapsedMs += TICK_INTERVAL_MS;
      };

      // İlk tur hemen koşar: `offset === 0` olan kayıtlar bir tur beklemez.
      drain();
      if (running && nextIndex < records.length) {
        timer = setInterval(drain, TICK_INTERVAL_MS);
      }
    },

    async stop(): Promise<void> {
      if (!running) return;
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

/**
 * Seçili çerçeveleme ayarı için güvenli en küçük kayıt aralığı.
 *
 * Zaman tabanlı bir ayarda (`inter-frame-timeout`, `modbus-silent-interval`,
 * `inter-character-timeout`) çerçeve sınırı SESSİZLİKTİR. İki kaydı o
 * sessizlikten daha yakın göndermek ikisini tek çerçeveye yapıştırır: dosyada
 * iki satır olan şey ekranda bir satır olur. Zaman aşımının iki katı, ölçüm
 * gürültüsüne (tur aralığı, tarayıcı gecikmesi) karşı emniyet payıdır.
 *
 * Zaman tabanlı olmayan ayarlarda (SLIP, COBS, satır sonu, uzunluk alanı)
 * sınır baytların içindedir; boşluğa gerek yoktur, 1 ms yalnız turların
 * birbirine geçmemesi için.
 */
export function minimumGapForFraming(config: FramingMethodConfig): number {
  if ('timeoutMs' in config) return config.timeoutMs * 2;
  return 1;
}
