import { describe, expect, it, vi } from 'vitest';

import type { ByteSourceHandlers, ConnectionError, ConnectionStatus } from '../types';
import { DEFAULT_SERIAL_OPTIONS } from './serialOptions';
import { createSerialSource } from './serialSource';
import type { WebSerialPort } from './webSerialTypes';

interface FakePort extends WebSerialPort {
  /** Cihazdan geliyormuş gibi bayt gönderir. */
  emit(bytes: Uint8Array): void;
  /** Okuma tarafını hata ile düşürür (cihaz çekildi). */
  fail(error: Error): void;
  readonly opened: boolean;
  readonly closeCount: number;
  readonly written: Uint8Array[];
}

interface FakePortOptions {
  readonly openError?: Error;
  readonly nullReadable?: boolean;
}

function createFakePort(options: FakePortOptions = {}): FakePort {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let opened = false;
  let closeCount = 0;
  const written: Uint8Array[] = [];

  const readable = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(chunk);
    },
  });

  return {
    get readable() {
      return options.nullReadable === true ? null : readable;
    },
    get writable() {
      return writable;
    },
    async open() {
      if (options.openError !== undefined) {
        throw options.openError;
      }
      opened = true;
    },
    async close() {
      closeCount += 1;
      opened = false;
    },
    getInfo() {
      return {};
    },
    emit(bytes) {
      try {
        controller?.enqueue(bytes);
      } catch {
        // İptal edilmiş stream'e enqueue TypeError atar; "stop sonrası bayt
        // gelirse" senaryosunda tam olarak bu beklenir, testi düşürmemeli.
      }
    },
    fail(error) {
      controller?.error(error);
    },
    get opened() {
      return opened;
    },
    get closeCount() {
      return closeCount;
    },
    get written() {
      return written;
    },
  };
}

function createRecordingHandlers(): {
  handlers: ByteSourceHandlers;
  chunks: Uint8Array[];
  statuses: ConnectionStatus[];
  errors: ConnectionError[];
} {
  const chunks: Uint8Array[] = [];
  const statuses: ConnectionStatus[] = [];
  const errors: ConnectionError[] = [];
  return {
    chunks,
    statuses,
    errors,
    handlers: {
      onChunk: (chunk) => chunks.push(chunk),
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    },
  };
}

/** Mikro görev kuyruğunu boşaltır — okuma döngüsü zamanlayıcı değil promise tabanlı. */
async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

describe('createSerialSource', () => {
  it('portu ayarlarla açar, connected bildirir ve gelen baytları iletir', async () => {
    const port = createFakePort();
    const openSpy = vi.spyOn(port, 'open');
    const { handlers, chunks, statuses, errors } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    port.emit(Uint8Array.from([0xaa, 0x05]));
    port.emit(Uint8Array.from([0x10, 0x03]));
    await flush();

    expect(openSpy).toHaveBeenCalledWith({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
      bufferSize: 4096,
    });
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(errors).toEqual([]);
    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([
      [0xaa, 0x05],
      [0x10, 0x03],
    ]);

    await source.stop();
  });

  it('boş parçayı iletmez', async () => {
    const port = createFakePort();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    port.emit(new Uint8Array(0));
    port.emit(Uint8Array.from([0x01]));
    await flush();

    expect(chunks).toHaveLength(1);

    await source.stop();
  });

  it('stop() okuma döngüsünü bitirip portu kapatır', async () => {
    const port = createFakePort();
    const { handlers } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    expect(port.opened).toBe(true);

    await source.stop();

    expect(port.closeCount).toBe(1);
    expect(port.opened).toBe(false);
  });

  it('stop() ikinci kez çağrılınca portu yeniden kapatmaz', async () => {
    const port = createFakePort();
    const { handlers } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    await source.stop();
    await source.stop();

    expect(port.closeCount).toBe(1);
  });

  it('stop() sonrası gelen baytlar iletilmez', async () => {
    const port = createFakePort();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    await source.stop();
    port.emit(Uint8Array.from([0x99]));
    await flush();

    expect(chunks).toEqual([]);
  });

  it('açma hatasını open-failed olarak bildirir ve döngü başlatmaz', async () => {
    const port = createFakePort({ openError: new Error('device busy') });
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'error']);
    expect(errors).toEqual([{ code: 'open-failed', message: 'device busy' }]);
  });

  it('izin reddini permission-denied olarak ayırır', async () => {
    const denied = new Error('The port permission was denied');
    denied.name = 'NotAllowedError';
    const port = createFakePort({ openError: denied });
    const { handlers, errors } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);

    expect(errors[0]?.code).toBe('permission-denied');
  });

  it('readable null ise açma hatası verir ve portu kapatır', async () => {
    const port = createFakePort({ nullReadable: true });
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    await flush();

    expect(errors[0]?.code).toBe('open-failed');
    expect(statuses).toEqual(['connecting', 'error']);
    expect(port.closeCount).toBe(1);
  });

  it('cihaz okuma sırasında düşerse read-failed bildirir', async () => {
    const port = createFakePort();
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    port.fail(new Error('device disconnected'));
    await flush();

    expect(errors).toEqual([{ code: 'read-failed', message: 'device disconnected' }]);
    expect(statuses).toEqual(['connecting', 'connected', 'error']);
  });

  it('write() bağlıyken baytları yazar', async () => {
    const port = createFakePort();
    const { handlers } = createRecordingHandlers();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await source.start(handlers);
    await source.write(Uint8Array.from([0x01, 0x06]));

    expect(port.written.map((chunk) => Array.from(chunk))).toEqual([[0x01, 0x06]]);

    await source.stop();
  });

  it('write() bağlı değilken reddeder', async () => {
    const port = createFakePort();
    const source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);

    await expect(source.write(Uint8Array.from([0x01]))).rejects.toThrow('not-connected');
  });
});
