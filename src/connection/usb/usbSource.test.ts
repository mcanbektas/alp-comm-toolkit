import { describe, expect, it } from 'vitest';

import type { ByteSourceHandlers, ConnectionError, ConnectionStatus } from '../types';
import { DEFAULT_USB_OPTIONS } from './usbOptions';
import { createUsbSource } from './usbSource';
import type { WebUsbDevice, WebUsbInTransferResult } from './webUsbTypes';

interface FakeUsbDevice extends WebUsbDevice {
  /** Cihazdan geliyormuş gibi bekleyen `transferIn`i baytla çözer. */
  emit(bytes: Uint8Array): void;
  /** `transferIn`i `stall`/`babble` durumuyla çözer. */
  emitStatus(status: 'stall' | 'babble'): void;
  /** Bekleyen `transferIn`i hata ile düşürür (cihaz çekildi). */
  fail(error: Error): void;
  readonly closeCount: number;
  readonly releaseInterfaceCount: number;
  readonly written: Uint8Array[];
}

interface FakeUsbDeviceOptions {
  readonly openError?: Error;
}

/**
 * Döngü aynı anda TEK bir `transferIn` çağrısı bekletir (bkz. `usbSource.ts`
 * `while (running)`), o yüzden tek bir "bekleyen" yuva yeterli — kuyruk
 * gerekmiyor.
 */
function createFakeUsbDevice(options: FakeUsbDeviceOptions = {}): FakeUsbDevice {
  let opened = false;
  let closed = false;
  let closeCount = 0;
  let releaseInterfaceCount = 0;
  const written: Uint8Array[] = [];
  let pending: {
    resolve: (result: WebUsbInTransferResult) => void;
    reject: (cause: unknown) => void;
  } | undefined;

  return {
    vendorId: 0,
    productId: 0,
    get opened() {
      return opened;
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
      closed = true;
      pending?.reject(new Error('device closed'));
      pending = undefined;
    },
    async selectConfiguration() {
      // Sahte cihazda tek konfigürasyon var, seçim her zaman başarılı.
    },
    async claimInterface() {
      // Sahte cihazda arayüz çakışması yok.
    },
    async releaseInterface() {
      releaseInterfaceCount += 1;
    },
    transferIn() {
      if (closed) {
        return Promise.reject(new Error('device closed'));
      }
      return new Promise<WebUsbInTransferResult>((resolve, reject) => {
        pending = { resolve, reject };
      });
    },
    async transferOut(_endpointNumber: number, data: Uint8Array) {
      written.push(data.slice());
      return { bytesWritten: data.length, status: 'ok' as const };
    },
    emit(bytes) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      pending?.resolve({ data: view, status: 'ok' });
      pending = undefined;
    },
    emitStatus(status) {
      pending?.resolve({ status });
      pending = undefined;
    },
    fail(error) {
      pending?.reject(error);
      pending = undefined;
    },
    get closeCount() {
      return closeCount;
    },
    get releaseInterfaceCount() {
      return releaseInterfaceCount;
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

describe('createUsbSource', () => {
  it('cihazı açar, arayüzü seçer, connected bildirir ve gelen baytları iletir', async () => {
    const device = createFakeUsbDevice();
    const { handlers, chunks, statuses, errors } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    device.emit(Uint8Array.from([0xaa, 0x05]));
    await flush();
    device.emit(Uint8Array.from([0x10, 0x03]));
    await flush();

    expect(statuses).toEqual(['connecting', 'connected']);
    expect(errors).toEqual([]);
    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([
      [0xaa, 0x05],
      [0x10, 0x03],
    ]);

    await source.stop();
  });

  it('boş veri çerçevesini iletmez', async () => {
    const device = createFakeUsbDevice();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    device.emit(new Uint8Array(0));
    await flush();
    device.emit(Uint8Array.from([0x01]));
    await flush();

    expect(chunks).toHaveLength(1);

    await source.stop();
  });

  it('transferIn stall/babble durumunu read-failed olarak bildirip döngüyü durdurur', async () => {
    const device = createFakeUsbDevice();
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    device.emitStatus('stall');
    await flush();

    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('read-failed');
    expect(statuses).toEqual(['connecting', 'connected', 'error']);
  });

  it('stop() bekleyen transferIn çağrısını takılmadan çözer (sıra kasıtlı ters)', async () => {
    const device = createFakeUsbDevice();
    const { handlers } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    // `emit`/`fail` HİÇ çağrılmadı: transferIn hâlâ bekliyor. `stop()` yine de
    // takılmadan dönmeli çünkü `close()` bekleyen çağrıyı reddettirir.
    await source.stop();

    expect(device.releaseInterfaceCount).toBe(1);
    expect(device.closeCount).toBe(1);
  });

  it('stop() ikinci kez çağrılınca cihazı yeniden kapatmaz', async () => {
    const device = createFakeUsbDevice();
    const { handlers } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    await source.stop();
    await source.stop();

    expect(device.closeCount).toBe(1);
  });

  it('stop() sonrası gelen baytlar iletilmez', async () => {
    const device = createFakeUsbDevice();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    await source.stop();
    device.fail(new Error('should be ignored'));
    await flush();

    expect(chunks).toEqual([]);
  });

  it('açma hatasını open-failed olarak bildirir ve döngü başlatmaz', async () => {
    const device = createFakeUsbDevice({ openError: new Error('device busy') });
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'error']);
    expect(errors).toEqual([{ code: 'open-failed', message: 'device busy' }]);
  });

  it('izin reddini permission-denied olarak ayırır', async () => {
    const denied = new Error('The device permission was denied');
    denied.name = 'NotAllowedError';
    const device = createFakeUsbDevice({ openError: denied });
    const { handlers, errors } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);

    expect(errors[0]?.code).toBe('permission-denied');
  });

  it('cihaz okuma sırasında düşerse read-failed bildirir', async () => {
    const device = createFakeUsbDevice();
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    device.fail(new Error('device disconnected'));
    await flush();

    expect(errors).toEqual([{ code: 'read-failed', message: 'device disconnected' }]);
    expect(statuses).toEqual(['connecting', 'connected', 'error']);
  });

  it('write() bağlıyken baytları transferOut ile yazar', async () => {
    const device = createFakeUsbDevice();
    const { handlers } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);
    await source.write(Uint8Array.from([0x01, 0x06]));

    expect(device.written.map((chunk) => Array.from(chunk))).toEqual([[0x01, 0x06]]);

    await source.stop();
  });

  it('write() bağlı değilken reddeder', async () => {
    const device = createFakeUsbDevice();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await expect(source.write(Uint8Array.from([0x01]))).rejects.toThrow('not-connected');
  });

  it('açılan cihazı yeniden açmaya çalışmaz', async () => {
    const device = createFakeUsbDevice();
    await device.open();
    const { handlers, statuses } = createRecordingHandlers();
    const source = createUsbSource(device, DEFAULT_USB_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'connected']);
    await source.stop();
  });
});
