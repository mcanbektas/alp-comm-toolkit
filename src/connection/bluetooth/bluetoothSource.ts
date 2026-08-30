/**
 * Web Bluetooth (GATT) tabanlı `ByteSource` gerçeklemesi — spec §8.1'in
 * kaynak listesindeki "Web Bluetooth" maddesi.
 *
 * Cihazı bu modül SEÇTİRMEZ: `requestBluetoothDevice()` kullanıcı jesti
 * içinde çağrılmak zorunda (spec §41, `createSerialSource`/`createUsbSource`
 * ile aynı kısıt); fabrika hazır bir cihaz alır ki testler sahte cihaz
 * enjekte edebilsin.
 *
 * ## Okuma bir DÖNGÜ değil, bir OLAYDIR
 *
 * Seri port ve WebUSB'nin aksine GATT bildirimi (`characteristicvaluechanged`)
 * itmeli: `startNotifications()`ten sonra veri kendi geldiğinde olay ateşler,
 * `await`lenecek bir okuma döngüsü yok. Bu yüzden `serialSource.ts`/
 * `usbSource.ts`teki `loopDone` senkronizasyonu burada YOK — `stop()` yalnız
 * dinleyiciyi kaldırıp bildirimi durdurur.
 *
 * ## Beklenmedik kopma AYRI bir sinyaldir
 *
 * Cihaz menzil dışına çıkarsa ya da kapanırsa tarayıcı `gattserverdisconnected`
 * fırlatır — okuma hatasına eşdeğer ama farklı bir olay yüzeyinden gelir, seri
 * portun `reader.read()` reddiyle ya da WebUSB'nin `transferIn` reddiyle AYNI
 * ANLAMI taşır: bağlantı koptu, kullanıcıya bildirilmeli.
 */

import type { ByteSource, ByteSourceHandlers, ConnectionError } from '../types';
import type { BluetoothConnectionOptions } from './bluetoothOptions';
import type {
  WebBluetoothCharacteristic,
  WebBluetoothCharacteristicValueChangedEvent,
  WebBluetoothDevice,
} from './webBluetoothTypes';

function toConnectionError(code: ConnectionError['code'], cause: unknown): ConnectionError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code, message };
}

export function createBluetoothSource(
  device: WebBluetoothDevice,
  options: BluetoothConnectionOptions,
): ByteSource {
  let running = false;
  let notifyCharacteristic: WebBluetoothCharacteristic | undefined;
  let writeCharacteristic: WebBluetoothCharacteristic | undefined;
  let activeHandlers: ByteSourceHandlers | undefined;

  function onValueChanged(event: WebBluetoothCharacteristicValueChangedEvent): void {
    if (!running || activeHandlers === undefined) {
      return;
    }
    const value = event.target.value;
    if (value === undefined || value.byteLength === 0) {
      return;
    }
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    // Epoch tabanı (timeOrigin + now) — ByteSourceHandlers sözleşmesi gereği.
    activeHandlers.onChunk(bytes, performance.timeOrigin + performance.now());
  }

  function onDisconnected(): void {
    if (!running || activeHandlers === undefined) {
      return;
    }
    running = false;
    activeHandlers.onError({
      code: 'read-failed',
      message: 'GATT bağlantısı beklenmedik şekilde koptu (gattserverdisconnected)',
    });
    activeHandlers.onStatus('error');
  }

  return {
    kind: 'web-bluetooth',
    canWrite: true,

    async start(handlers: ByteSourceHandlers): Promise<void> {
      if (running) {
        return;
      }
      handlers.onStatus('connecting');

      try {
        const gatt = device.gatt;
        if (gatt === undefined) {
          throw new Error('Cihaz GATT sunucusu bildirmiyor.');
        }
        const server = gatt.connected ? gatt : await gatt.connect();
        const service = await server.getPrimaryService(options.serviceUuid);
        notifyCharacteristic = await service.getCharacteristic(options.notifyCharacteristicUuid);
        // Bildirim ve yazma AYNI karakteristikse (bazı basit köprüler) ikinci
        // bir GATT gidiş-dönüşü gereksiz.
        writeCharacteristic =
          options.writeCharacteristicUuid === options.notifyCharacteristicUuid
            ? notifyCharacteristic
            : await service.getCharacteristic(options.writeCharacteristicUuid);
        await notifyCharacteristic.startNotifications();
      } catch (cause) {
        const isPermission =
          cause instanceof Error && /denied|NotAllowed|SecurityError/i.test(cause.name + cause.message);
        handlers.onError(toConnectionError(isPermission ? 'permission-denied' : 'open-failed', cause));
        handlers.onStatus('error');
        return;
      }

      running = true;
      activeHandlers = handlers;
      notifyCharacteristic.addEventListener('characteristicvaluechanged', onValueChanged);
      device.addEventListener('gattserverdisconnected', onDisconnected);
      handlers.onStatus('connected');
    },

    async stop(): Promise<void> {
      if (!running) {
        return;
      }
      running = false;
      notifyCharacteristic?.removeEventListener('characteristicvaluechanged', onValueChanged);
      device.removeEventListener('gattserverdisconnected', onDisconnected);
      try {
        await notifyCharacteristic?.stopNotifications();
      } catch {
        // Cihaz zaten koptuysa bildirim durdurma da reddeder — kapanış yine sürmeli.
      }
      try {
        device.gatt?.disconnect();
      } catch {
        // Aynı gerekçe: kapanamayan bağlantı, uygulamayı hatalı duruma düşürmemeli.
      }
      notifyCharacteristic = undefined;
      writeCharacteristic = undefined;
      activeHandlers = undefined;
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (!running || writeCharacteristic === undefined) {
        throw new Error('not-connected');
      }
      await writeCharacteristic.writeValue(bytes);
    },
  };
}
