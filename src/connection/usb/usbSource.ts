/**
 * WebUSB tabanlı `ByteSource` gerçeklemesi — spec §8.1'in kaynak
 * listesindeki "WebUSB" maddesi.
 *
 * Cihazı bu modül SEÇTİRMEZ: `requestUsbDevice()` kullanıcı jesti içinde
 * çağrılmak zorunda (spec §41, `createSerialSource` ile aynı kısıt); fabrika
 * hazır bir cihaz alır ki testler sahte cihaz enjekte edebilsin.
 *
 * ## Okuma döngüsünün durdurulma sırası SERİ PORTUNUN TERSİDİR
 *
 * `createSerialSource`ta sıra `reader.cancel()` → `port.close()`: kilitli
 * stream'de `close()` reddedilir, önce cancel gerekir. WebUSB'de
 * `transferIn`in bekleyen çağrısını doğrudan iptal eden bir API YOK — spec'in
 * kendi davranışı bu: `releaseInterface`/`close()` bekleyen transferleri
 * REDDETTİRİR. Yani burada sıra TERS: önce arayüz bırakılır/cihaz kapatılır,
 * o da bekleyen `transferIn`i reddeder, döngü `running` bayrağını görüp sessiz
 * çıkar. Sırayı seri porttakiyle aynı yazmak `stop()`u sonsuza kadar askıda
 * bırakırdı — cihaz veri göndermeyi keserse `transferIn` süresiz bekler.
 */

import type { ByteSource, ByteSourceHandlers, ConnectionError } from '../types';
import type { UsbConnectionOptions } from './usbOptions';
import type { WebUsbDevice } from './webUsbTypes';

function toConnectionError(code: ConnectionError['code'], cause: unknown): ConnectionError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code, message };
}

export function createUsbSource(device: WebUsbDevice, options: UsbConnectionOptions): ByteSource {
  let running = false;
  /** `stop()` ile okuma döngüsünün bitişini buluşturur — `serialSource.ts` ile aynı gerekçe. */
  let loopDone: Promise<void> = Promise.resolve();

  async function readLoop(handlers: ByteSourceHandlers): Promise<void> {
    while (running) {
      let result;
      try {
        result = await device.transferIn(options.endpointIn, options.transferSize);
      } catch (cause) {
        if (running) {
          handlers.onError(toConnectionError('read-failed', cause));
          handlers.onStatus('error');
        }
        return;
      }
      if (!running) {
        return;
      }
      if (result.status !== 'ok') {
        // `stall`/`babble` kurtarma (clearHalt) burada uygulanmadı: cihaz başına
        // farklı bir onarım gerektirir ve spec bunu istemiyor — okunabilir bir
        // hatayla durmak sessizce yanlış bayt üretmekten iyidir.
        handlers.onError(
          toConnectionError('read-failed', new Error(`transferIn durumu: ${result.status}`)),
        );
        handlers.onStatus('error');
        return;
      }
      if (result.data !== undefined && result.data.byteLength > 0) {
        const bytes = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
        // Epoch tabanı (timeOrigin + now) — ByteSourceHandlers sözleşmesi gereği.
        handlers.onChunk(bytes, performance.timeOrigin + performance.now());
      }
    }
  }

  return {
    kind: 'web-usb',
    canWrite: true,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      if (running) {
        return;
      }
      handlers.onStatus('connecting');
      try {
        if (!device.opened) {
          await device.open();
        }
        await device.selectConfiguration(options.configurationValue);
        await device.claimInterface(options.interfaceNumber);
      } catch (cause) {
        const isPermission =
          cause instanceof Error && /denied|NotAllowed|SecurityError/i.test(cause.name + cause.message);
        handlers.onError(toConnectionError(isPermission ? 'permission-denied' : 'open-failed', cause));
        handlers.onStatus('error');
        return;
      }

      running = true;
      handlers.onStatus('connected');
      loopDone = readLoop(handlers);
    },

    async stop(): Promise<void> {
      if (!running) {
        return;
      }
      running = false;
      // Sıra BİLEREK ters (bkz. dosya başı yorumu): önce arayüz/cihaz kapatılır,
      // bu bekleyen `transferIn`i reddettirir, döngü sonra kendini bitirir.
      try {
        await device.releaseInterface(options.interfaceNumber);
      } catch {
        // Cihaz zaten çıkarılmışsa arayüz bırakma da reddeder — kapanış yine sürmeli.
      }
      try {
        await device.close();
      } catch {
        // Aynı gerekçe: kapanamayan cihaz, uygulamayı hatalı duruma düşürmemeli.
      }
      await loopDone;
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (!running) {
        throw new Error('not-connected');
      }
      const result = await device.transferOut(options.endpointOut, bytes);
      if (result.status !== 'ok') {
        throw new Error(`transferOut durumu: ${result.status}`);
      }
    },
  };
}
