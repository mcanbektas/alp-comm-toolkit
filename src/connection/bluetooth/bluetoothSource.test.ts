import { describe, expect, it } from 'vitest';

import type { ByteSourceHandlers, ConnectionError, ConnectionStatus } from '../types';
import { DEFAULT_BLUETOOTH_OPTIONS } from './bluetoothOptions';
import { createBluetoothSource } from './bluetoothSource';
import type {
  WebBluetoothCharacteristic,
  WebBluetoothCharacteristicValueChangedEvent,
  WebBluetoothDevice,
  WebBluetoothServer,
  WebBluetoothService,
} from './webBluetoothTypes';

interface FakeCharacteristic extends WebBluetoothCharacteristic {
  emit(bytes: Uint8Array): void;
  readonly startNotificationsCount: number;
  readonly stopNotificationsCount: number;
  readonly written: Uint8Array[];
}

function createFakeCharacteristic(): FakeCharacteristic {
  let startCount = 0;
  let stopCount = 0;
  const written: Uint8Array[] = [];
  const listeners = new Set<(event: WebBluetoothCharacteristicValueChangedEvent) => void>();
  let currentValue: DataView | undefined;

  const characteristic: FakeCharacteristic = {
    get value() {
      return currentValue;
    },
    async startNotifications() {
      startCount += 1;
    },
    async stopNotifications() {
      stopCount += 1;
    },
    async writeValue(value: Uint8Array) {
      written.push(value.slice());
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    emit(bytes) {
      currentValue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (const listener of listeners) {
        listener({ target: characteristic });
      }
    },
    get startNotificationsCount() {
      return startCount;
    },
    get stopNotificationsCount() {
      return stopCount;
    },
    get written() {
      return written;
    },
  };
  return characteristic;
}

interface FakeBluetoothDevice extends WebBluetoothDevice {
  /** Fiziksel kopmayı simüle eder — `gattserverdisconnected` fırlatır. */
  simulateDisconnect(): void;
  readonly notifyCharacteristic: FakeCharacteristic;
  readonly writeCharacteristic: FakeCharacteristic;
  readonly gattDisconnectCount: number;
  readonly getCharacteristicCalls: string[];
}

interface FakeBluetoothDeviceOptions {
  readonly connectError?: Error;
  readonly sameCharacteristicForBoth?: boolean;
}

function createFakeBluetoothDevice(options: FakeBluetoothDeviceOptions = {}): FakeBluetoothDevice {
  const notifyCharacteristic = createFakeCharacteristic();
  const writeCharacteristic =
    options.sameCharacteristicForBoth === true ? notifyCharacteristic : createFakeCharacteristic();
  let connected = false;
  let gattDisconnectCount = 0;
  const getCharacteristicCalls: string[] = [];
  const disconnectListeners = new Set<() => void>();

  const service: WebBluetoothService = {
    async getCharacteristic(characteristicUuid: string) {
      getCharacteristicCalls.push(characteristicUuid);
      if (characteristicUuid === DEFAULT_BLUETOOTH_OPTIONS.notifyCharacteristicUuid) {
        return notifyCharacteristic;
      }
      if (characteristicUuid === DEFAULT_BLUETOOTH_OPTIONS.writeCharacteristicUuid) {
        return writeCharacteristic;
      }
      throw new Error(`bilinmeyen karakteristik: ${characteristicUuid}`);
    },
  };

  const server: WebBluetoothServer = {
    get connected() {
      return connected;
    },
    async connect() {
      if (options.connectError !== undefined) {
        throw options.connectError;
      }
      connected = true;
      return server;
    },
    disconnect() {
      gattDisconnectCount += 1;
      connected = false;
    },
    async getPrimaryService(_serviceUuid: string) {
      return service;
    },
  };

  return {
    gatt: server,
    addEventListener(_type, listener) {
      disconnectListeners.add(listener);
    },
    removeEventListener(_type, listener) {
      disconnectListeners.delete(listener);
    },
    simulateDisconnect() {
      connected = false;
      for (const listener of disconnectListeners) {
        listener();
      }
    },
    notifyCharacteristic,
    writeCharacteristic,
    get gattDisconnectCount() {
      return gattDisconnectCount;
    },
    get getCharacteristicCalls() {
      return getCharacteristicCalls;
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

describe('createBluetoothSource', () => {
  it('GATT sunucusuna bağlanır, bildirimi başlatır ve gelen baytları iletir', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers, chunks, statuses, errors } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'connected']);
    expect(errors).toEqual([]);
    expect(device.notifyCharacteristic.startNotificationsCount).toBe(1);

    device.notifyCharacteristic.emit(Uint8Array.from([0xaa, 0x05]));
    device.notifyCharacteristic.emit(Uint8Array.from([0x10, 0x03]));

    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([
      [0xaa, 0x05],
      [0x10, 0x03],
    ]);

    await source.stop();
  });

  it('boş bildirim değerini iletmez', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    device.notifyCharacteristic.emit(new Uint8Array(0));
    device.notifyCharacteristic.emit(Uint8Array.from([0x01]));

    expect(chunks).toHaveLength(1);

    await source.stop();
  });

  it('bildirim ve yazma AYNI UUID ise karakteristiği yalnız BİR kez ister', async () => {
    const device = createFakeBluetoothDevice({ sameCharacteristicForBoth: true });
    const options = {
      ...DEFAULT_BLUETOOTH_OPTIONS,
      writeCharacteristicUuid: DEFAULT_BLUETOOTH_OPTIONS.notifyCharacteristicUuid,
    };
    const { handlers } = createRecordingHandlers();
    const source = createBluetoothSource(device, options);

    await source.start(handlers);

    expect(device.getCharacteristicCalls).toEqual([DEFAULT_BLUETOOTH_OPTIONS.notifyCharacteristicUuid]);

    await source.write(Uint8Array.from([0x42]));
    expect(device.notifyCharacteristic.written.map((chunk) => Array.from(chunk))).toEqual([[0x42]]);

    await source.stop();
  });

  it('stop() dinleyicileri kaldırır, bildirimi durdurur ve GATT bağlantısını keser', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    await source.stop();

    expect(device.notifyCharacteristic.stopNotificationsCount).toBe(1);
    expect(device.gattDisconnectCount).toBe(1);
  });

  it('stop() ikinci kez çağrılınca GATT bağlantısını yeniden kesmez', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    await source.stop();
    await source.stop();

    expect(device.gattDisconnectCount).toBe(1);
  });

  it('stop() sonrası gelen bildirimler iletilmez', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers, chunks } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    await source.stop();
    device.notifyCharacteristic.emit(Uint8Array.from([0x99]));

    expect(chunks).toEqual([]);
  });

  it('bağlanma hatasını open-failed olarak bildirir ve dinleyici eklemez', async () => {
    const device = createFakeBluetoothDevice({ connectError: new Error('GATT operation failed') });
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'error']);
    expect(errors).toEqual([{ code: 'open-failed', message: 'GATT operation failed' }]);
  });

  it('izin reddini permission-denied olarak ayırır', async () => {
    const denied = new Error('User denied the request for Bluetooth devices');
    denied.name = 'SecurityError';
    const device = createFakeBluetoothDevice({ connectError: denied });
    const { handlers, errors } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);

    expect(errors[0]?.code).toBe('permission-denied');
  });

  it('beklenmedik gattserverdisconnected read-failed bildirir', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers, statuses, errors } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    device.simulateDisconnect();

    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('read-failed');
    expect(statuses).toEqual(['connecting', 'connected', 'error']);
  });

  it('kendi stop() çağrımızdan sonra gelen gattserverdisconnected yok sayılır', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers, errors } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    await source.stop();
    device.simulateDisconnect();

    expect(errors).toEqual([]);
  });

  it('write() bağlıyken karakteristiğe yazar', async () => {
    const device = createFakeBluetoothDevice();
    const { handlers } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);
    await source.write(Uint8Array.from([0x01, 0x06]));

    expect(device.writeCharacteristic.written.map((chunk) => Array.from(chunk))).toEqual([[0x01, 0x06]]);

    await source.stop();
  });

  it('write() bağlı değilken reddeder', async () => {
    const device = createFakeBluetoothDevice();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await expect(source.write(Uint8Array.from([0x01]))).rejects.toThrow('not-connected');
  });

  it('gatt zaten bağlıysa connect() yeniden çağrılmaz', async () => {
    const device = createFakeBluetoothDevice();
    await device.gatt?.connect();
    const { handlers, statuses } = createRecordingHandlers();
    const source = createBluetoothSource(device, DEFAULT_BLUETOOTH_OPTIONS);

    await source.start(handlers);

    expect(statuses).toEqual(['connecting', 'connected']);
    await source.stop();
  });
});
