/**
 * WebSocket tabanlı `ByteSource` gerçeklemesi — spec §8.1'in kaynak
 * listesindeki "WebSocket" maddesi.
 *
 * ## Neden bu kaynak donanımsız zincirin ikinci ayağı
 *
 * Web Serial yalnız güvenli bağlamda, kullanıcı jestiyle ve gerçek donanımla
 * açılır. WebSocket ise hiçbirini istemez: bir seri/CAN köprüsünün (ser2net,
 * socketcand, kendi yazdığınız köprü) hattını doğrudan tarayıcıya taşır.
 * Sözleşme aynı olduğu için monitör, Packet Builder ve Test Automation üçü de
 * bu kaynağı BEDAVA kullanır.
 *
 * ## Soketi bu modül AÇTIRIR ama SEÇTİRMEZ
 *
 * `createSerialSource` hazır bir port tutamağı alır çünkü `requestPort()` bir
 * kullanıcı jesti ister. WebSocket'te öyle bir kısıt yok: adres bir metindir,
 * bağlanma da `start()`ın işidir. Buna karşılık soketi ÜRETEN fonksiyon dışarı
 * açık (`socketFactory`) — testler sahte soket enjekte edebilsin diye; aynı
 * "fabrikaya tutamak ver" disiplininin bu protokoldeki karşılığı.
 *
 * ## Metin çerçeveleri de BAYTTIR
 *
 * Köprülerin çoğu ikili çerçeve gönderir, ama bazıları (ör. satır tabanlı NMEA
 * köprüleri) metin çerçevesi yollar. Metni ATMAK sessiz bir veri kaybı olurdu;
 * UTF-8 baytlarına çevrilip aynı `onChunk`a verilir — hattaki ASCII protokoller
 * zaten bayt olarak çözülür.
 */

import type { ByteSource, ByteSourceHandlers, ConnectionError } from '../types';

/** Sözleşmedeki `readyState` sabitleri — `WebSocket.OPEN` vb. saf sayılardır. */
const SOCKET_OPEN = 1;

/** `ws://` ve `wss://` dışındaki şemalar bu kaynağın işi değil. */
const ALLOWED_PROTOCOLS: readonly string[] = ['ws:', 'wss:'];

/**
 * Kaynağın kullandığı soket yüzeyi. Global `WebSocket`in TAMAMI değil, yalnız
 * burada çağrılanlar: sahte soket yazmak bir tarayıcı sınıfını taklit etmeyi
 * gerektirmesin.
 */
export interface WebSocketLike {
  binaryType: string;
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  send(data: ArrayBufferView | ArrayBuffer | string): void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketSourceOptions {
  /** Alt protokol (`Sec-WebSocket-Protocol`). Köprüler bazen ister. */
  readonly protocols?: string | readonly string[];
  /** Soketi üreten fabrika; varsayılanı global `WebSocket`. Testler burayı değiştirir. */
  readonly socketFactory?: (url: string, protocols?: string | readonly string[]) => WebSocketLike;
}

function toConnectionError(code: ConnectionError['code'], cause: unknown): ConnectionError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code, message };
}

/**
 * Adres DOĞRULANIR, çünkü `new WebSocket('http://…')` tarayıcıda SENKRON
 * fırlatır ve o istisna `start()`ın çağıranına kaçardı. Sözleşmenin hata yolu
 * `onError`dir; adres hatası da oradan bildirilmeli.
 */
function validateUrl(url: string): ConnectionError | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { code: 'open-failed', message: `Geçersiz WebSocket adresi: ${url}` };
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return {
      code: 'open-failed',
      message: `WebSocket adresi ws:// ya da wss:// olmalı, alınan: ${parsed.protocol}//`,
    };
  }
  return undefined;
}

/** Gelen çerçeveyi bayta çevirir. `null` = taşınacak veri yok. */
function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') return new TextEncoder().encode(data);
  // `Blob` YALNIZ `binaryType = 'blob'` iken gelir ve biz 'arraybuffer' yazıyoruz;
  // yine de sessiz kalmamak için bilinmeyen tip veri sayılmaz.
  return null;
}

export function createWebSocketSource(url: string, options: WebSocketSourceOptions = {}): ByteSource {
  let socket: WebSocketLike | undefined;
  /**
   * `stop()` çağrıldıktan sonra gelen `onclose`/`onerror` bir HATA DEĞİLDİR:
   * kapanışı biz istedik. Bayrak olmadan her normal kapanış ekranda kırmızıya
   * dönerdi.
   */
  let closingByUs = false;

  async function stop(): Promise<void> {
    if (socket === undefined) return;
    closingByUs = true;
    const active = socket;
    socket = undefined;
    active.onopen = null;
    active.onmessage = null;
    active.onerror = null;
    active.onclose = null;
    try {
      active.close();
    } catch {
      // Zaten kapalı soketi kapatmak önemsiz; `stop()` yeniden çağrılabilir olmalı.
    }
    return Promise.resolve();
  }

  return {
    kind: 'websocket',
    canWrite: true,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      const factory =
        options.socketFactory ??
        ((target: string, protocols?: string | readonly string[]) => {
          if (typeof WebSocket === 'undefined') {
            throw new Error('Bu ortamda WebSocket yok.');
          }
          return (protocols === undefined
            ? new WebSocket(target)
            : new WebSocket(target, protocols as string | string[])) as unknown as WebSocketLike;
        });

      const urlError = validateUrl(url);
      if (urlError !== undefined) {
        handlers.onError(urlError);
        handlers.onStatus('error');
        return;
      }

      closingByUs = false;
      handlers.onStatus('connecting');

      let opened: WebSocketLike;
      try {
        opened = factory(url, options.protocols);
      } catch (cause) {
        // `WebSocket` yoksa (jsdom, eski tarayıcı) ayrı bir koddur: kullanıcı
        // "bağlanamadım" ile "bu tarayıcı desteklemiyor"u ayırt edebilmeli.
        const code = typeof WebSocket === 'undefined' ? 'unsupported' : 'open-failed';
        handlers.onError(toConnectionError(code, cause));
        handlers.onStatus('error');
        return;
      }

      opened.binaryType = 'arraybuffer';
      socket = opened;

      opened.onopen = () => {
        handlers.onStatus('connected');
      };

      opened.onmessage = (event) => {
        const bytes = toBytes(event.data);
        if (bytes === null || bytes.length === 0) return;
        // Epoch tabanı (timeOrigin + now) — `ByteSourceHandlers` sözleşmesi gereği.
        handlers.onChunk(bytes, performance.timeOrigin + performance.now());
      };

      opened.onerror = () => {
        if (closingByUs) return;
        // WebSocket'in `error` olayı AYRINTI TAŞIMAZ (güvenlik gereği): sebebi
        // uydurmak yerine ne bilindiği yazılır.
        handlers.onError({ code: 'open-failed', message: `WebSocket bağlantısı başarısız: ${url}` });
        handlers.onStatus('error');
      };

      opened.onclose = () => {
        if (closingByUs) return;
        socket = undefined;
        // Karşı taraf kapattı: bu bir hata değil, hattın bitmesidir.
        handlers.onStatus('idle');
      };
    },

    stop,

    async write(bytes: Uint8Array): Promise<void> {
      const active = socket;
      if (active === undefined || active.readyState !== SOCKET_OPEN) {
        throw new Error('WebSocket bağlı değil.');
      }
      // Kopya BİLEREK: `bytes` çağıranın tamponunun bir görünümü olabilir ve
      // `send` kuyruğa alırken tampon değişirse telden başka bayt çıkardı.
      active.send(bytes.slice());
      return Promise.resolve();
    },
  };
}
