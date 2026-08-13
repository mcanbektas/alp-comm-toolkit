/**
 * Web Serial tabanlı `ByteSource` gerçeklemesi.
 *
 * Port'u bu modül SEÇTİRMEZ: `requestPort()` kullanıcı jesti içinde çağrılmak
 * zorunda (spec §41 "kullanıcı izni olmadan port açma — yasak"), jest ise React
 * olay işleyicisindedir. Bu yüzden fabrika hazır bir port alır; böylece testler
 * de sahte port enjekte edebiliyor.
 */

import type { ByteSource, ByteSourceHandlers, ConnectionError } from '../types';
import type { SerialConnectionOptions } from './serialOptions';
import type { WebSerialPort } from './webSerialTypes';

function toConnectionError(code: ConnectionError['code'], cause: unknown): ConnectionError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code, message };
}

export function createSerialSource(
  port: WebSerialPort,
  options: SerialConnectionOptions,
): ByteSource {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let running = false;
  /**
   * `stop()` ile okuma döngüsünün bitişini buluşturur. `reader.cancel()`
   * bekleyen `read()`i `done: true` ile çözer ama döngünün *o turu* bitene
   * kadar port kapatılamaz — kilitli stream'de `port.close()` reddedilir.
   */
  let loopDone: Promise<void> = Promise.resolve();

  async function readLoop(handlers: ByteSourceHandlers): Promise<void> {
    const activeReader = reader;
    if (activeReader === undefined) {
      return;
    }
    try {
      while (running) {
        const { value, done } = await activeReader.read();
        if (done) {
          break;
        }
        if (value !== undefined && value.length > 0) {
          // Epoch tabanı (timeOrigin + now) — ByteSourceHandlers sözleşmesi gereği.
          handlers.onChunk(value, performance.timeOrigin + performance.now());
        }
      }
    } catch (cause) {
      if (running) {
        handlers.onError(toConnectionError('read-failed', cause));
        handlers.onStatus('error');
      }
    } finally {
      try {
        activeReader.releaseLock();
      } catch {
        // Lock zaten bırakılmışsa önemsiz; kapanış yolunu bozmamalı.
      }
    }
  }

  return {
    kind: 'web-serial',
    canWrite: true,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      if (running) {
        return;
      }
      handlers.onStatus('connecting');
      try {
        await port.open({
          baudRate: options.baudRate,
          dataBits: options.dataBits,
          stopBits: options.stopBits,
          parity: options.parity,
          flowControl: options.flowControl,
          bufferSize: options.bufferSize,
        });
      } catch (cause) {
        // Tarayıcı izin reddini de açma hatası olarak fırlatır; ayırt etmek için
        // ada bakmak zorundayız — DOMException kodu her tarayıcıda tutarlı değil.
        const isPermission = cause instanceof Error && /denied|NotAllowed|SecurityError/i.test(cause.name + cause.message);
        handlers.onError(toConnectionError(isPermission ? 'permission-denied' : 'open-failed', cause));
        handlers.onStatus('error');
        return;
      }

      if (port.readable === null) {
        handlers.onError({ code: 'open-failed', message: 'port.readable is null' });
        handlers.onStatus('error');
        await port.close().catch(() => undefined);
        return;
      }

      running = true;
      reader = port.readable.getReader();
      handlers.onStatus('connected');
      loopDone = readLoop(handlers);
    },

    async stop(): Promise<void> {
      if (!running) {
        return;
      }
      running = false;
      try {
        await reader?.cancel();
      } catch {
        // Cihaz çıkarıldıysa cancel de reddedebilir — kapanış yine sürmeli.
      }
      await loopDone;
      reader = undefined;
      try {
        await port.close();
      } catch {
        // Aynı gerekçe: kapanamayan port, uygulamayı hatalı duruma düşürmemeli.
      }
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (!running || port.writable === null) {
        throw new Error('not-connected');
      }
      const writer = port.writable.getWriter();
      try {
        await writer.write(bytes);
      } finally {
        writer.releaseLock();
      }
    },
  };
}
