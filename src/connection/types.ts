/**
 * Bağlantı kaynakları için ortak sözleşme — spec §8.1'in kaynak listesi
 * (Web Serial, WebUSB, Web Bluetooth, WebSocket, dosya oynatma, simülasyon,
 * yerel bridge) tek bir arayüzün ayrı gerçeklemeleridir.
 *
 * Neden bu soyutlama: Web Serial yalnız güvenli bağlamda ve kullanıcı jestiyle
 * açılır; jsdom'da ve Playwright'ta hiç yoktur. Monitörün gerçek tarayıcıda
 * uçtan uca sınanabilmesi, simüle edilmiş bir kaynağın aynı sözleşmeyi
 * gerçeklemesine bağlı — yoksa ekran yalnız donanım varken test edilebilirdi.
 */

export type ByteSourceKind = 'web-serial' | 'simulated' | 'file' | 'websocket';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closing' | 'error';

export type ConnectionErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'open-failed'
  | 'read-failed'
  | 'write-failed'
  | 'not-connected';

export interface ConnectionError {
  readonly code: ConnectionErrorCode;
  readonly message: string;
}

export interface ByteSourceHandlers {
  /**
   * `receivedAt` **`performance.timeOrigin + performance.now()`** ile üretilir:
   * epoch milisaniyesi, ama monotonik kaynaktan — `Date.now()` değil.
   *
   * Taban neden bu: ayrıştırma Worker'da yapılıyor ve Worker'ın kendi
   * `performance.now()` sıfır noktası ana thread'inkiyle AYNI DEĞİL. Yalnız
   * `now()` gönderilseydi `push(receivedAt)` ile `tick(nowMs)` farklı
   * saatlerden gelir, zaman tabanlı çerçeveleme (inter-character/inter-frame
   * timeout) sessizce bozulurdu — hata vermeden, yanlış çerçeveleyerek.
   * `timeOrigin + now()` iki thread'de de aynı epoch'u gösterir ve Worker'ın
   * ürettiği `RawFrame.timestamp` ile de aynı tabandır.
   */
  onChunk(chunk: Uint8Array, receivedAt: number): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: ConnectionError): void;
}

export interface ByteSource {
  readonly kind: ByteSourceKind;
  /** Yazma yönü (TX) destekleniyor mu — simülasyon kaynağı için false. */
  readonly canWrite: boolean;
  start(handlers: ByteSourceHandlers): Promise<void>;
  /** Yeniden çağrılabilir olmalı; kapalı kaynakta no-op. */
  stop(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
}
