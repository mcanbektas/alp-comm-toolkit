/**
 * Web Bluetooth bağlantı ayarları — spec §8.1 Web Bluetooth kaynağı için,
 * `serialOptions.ts`/`usbOptions.ts` ile aynı disiplin (saf veri + doğrulama,
 * tarayıcı API'sine dokunmaz).
 *
 * UART alanlarının (Baud rate, Parity…) GATT karşılığı yok; alanlar
 * `getPrimaryService`/`getCharacteristic`in zorunlu kıldığı UUID'lerden
 * kuruldu — bir seri köprüsü GATT servisinin (Nordic UART Service ve
 * benzerleri) tipik şekli: bir bildirim (RX) + bir yazma (TX) karakteristiği.
 */

/** Nordic UART Service — en yaygın "GATT üzerinden seri" köprüsü, varsayılan olarak makul. */
const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export interface BluetoothConnectionOptions {
  readonly serviceUuid: string;
  /** Cihazdan gelen bildirimlerin okunduğu karakteristik. */
  readonly notifyCharacteristicUuid: string;
  /** Cihaza yazmak için kullanılan karakteristik; bildirimle AYNI UUID olabilir. */
  readonly writeCharacteristicUuid: string;
}

export const DEFAULT_BLUETOOTH_OPTIONS: BluetoothConnectionOptions = {
  serviceUuid: NORDIC_UART_SERVICE_UUID,
  // Nordic'te TX (cihazdan) bildirilir, RX (cihaza) yazılır — isimlendirme
  // cihazın bakış açısından, uygulamanınkinin TERSİDİR.
  notifyCharacteristicUuid: NORDIC_UART_TX_CHARACTERISTIC_UUID,
  writeCharacteristicUuid: NORDIC_UART_RX_CHARACTERISTIC_UUID,
};

export type BluetoothOptionsField = keyof BluetoothConnectionOptions;

export interface BluetoothOptionsIssue {
  readonly field: BluetoothOptionsField;
  readonly code: 'empty' | 'not-a-uuid';
}

/** 16-bit kısa biçim (`0x180d`) ya da 128-bit tam UUID — Web Bluetooth ikisini de kabul eder. */
const SHORT_UUID_PATTERN = /^0x[0-9a-f]{4}$/i;
const FULL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkUuid(field: BluetoothOptionsField, value: string, issues: BluetoothOptionsIssue[]): void {
  if (value.trim() === '') {
    issues.push({ field, code: 'empty' });
    return;
  }
  if (!SHORT_UUID_PATTERN.test(value) && !FULL_UUID_PATTERN.test(value)) {
    issues.push({ field, code: 'not-a-uuid' });
  }
}

export function validateBluetoothOptions(options: BluetoothConnectionOptions): BluetoothOptionsIssue[] {
  const issues: BluetoothOptionsIssue[] = [];
  checkUuid('serviceUuid', options.serviceUuid, issues);
  checkUuid('notifyCharacteristicUuid', options.notifyCharacteristicUuid, issues);
  checkUuid('writeCharacteristicUuid', options.writeCharacteristicUuid, issues);
  return issues;
}
