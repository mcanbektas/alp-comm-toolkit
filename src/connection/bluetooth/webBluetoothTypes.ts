/**
 * Web Bluetooth API'nin asgari yapısal tipleri.
 *
 * Neden elle yazıldı: `webSerialTypes.ts`/`webUsbTypes.ts` ile aynı gerekçe —
 * `lib.dom` Web Bluetooth taşımıyor (`navigator.bluetooth` TS2339 verir).
 *
 * Yalnız GATT bildirim (notify) + yazma yüzeyi tanımlı — cihaz bir seri
 * köprüsü gibi ele alınıyor (Nordic UART Service ve benzerlerinin deseni):
 * tek servis, bir bildirim karakteristiği (RX), bir yazma karakteristiği
 * (TX) — bkz. `bluetoothOptions.ts`. Genel GATT keşfi (servis/karakteristik
 * listeleme) kasıtlı olarak YOK; kullanıcı UUID'leri elle girer, tıpkı seri
 * portun baud rate'i elle seçmesi gibi.
 */

export interface WebBluetoothCharacteristicValueChangedEvent {
  readonly target: WebBluetoothCharacteristic;
}

export interface WebBluetoothCharacteristic {
  readonly value?: DataView;
  startNotifications(): Promise<void>;
  stopNotifications(): Promise<void>;
  writeValue(value: Uint8Array): Promise<void>;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: WebBluetoothCharacteristicValueChangedEvent) => void,
  ): void;
  removeEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: WebBluetoothCharacteristicValueChangedEvent) => void,
  ): void;
}

export interface WebBluetoothService {
  getCharacteristic(characteristicUuid: string): Promise<WebBluetoothCharacteristic>;
}

export interface WebBluetoothServer {
  readonly connected: boolean;
  connect(): Promise<WebBluetoothServer>;
  disconnect(): void;
  getPrimaryService(serviceUuid: string): Promise<WebBluetoothService>;
}

export interface WebBluetoothDevice {
  readonly gatt?: WebBluetoothServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

export interface WebBluetoothScanFilter {
  readonly services?: readonly string[];
  readonly namePrefix?: string;
}

export interface WebBluetoothRequestOptions {
  readonly filters?: readonly WebBluetoothScanFilter[];
  readonly acceptAllDevices?: boolean;
  /** İstenen serviste OLMAYAN ama sonradan `getPrimaryService`le erişilecek servisler burada bildirilmeli. */
  readonly optionalServices?: readonly string[];
}

export interface WebBluetooth {
  requestDevice(options: WebBluetoothRequestOptions): Promise<WebBluetoothDevice>;
}

/** `navigator.bluetooth`a tek erişim noktası — cast burada kapalı kalır. */
export function getWebBluetooth(): WebBluetooth | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return (navigator as Navigator & { bluetooth?: WebBluetooth }).bluetooth;
}

export function isWebBluetoothSupported(): boolean {
  return getWebBluetooth() !== undefined;
}

/**
 * Cihaz seçtirir. **Yalnız kullanıcı jesti içinden çağrılabilir** (spec §41,
 * Web Serial/WebUSB ile aynı kısıt). `optionalServices` VERİLMELİDİR: Web
 * Bluetooth güvenlik modeli, `requestDevice` sırasında bildirilmeyen bir
 * servise sonradan erişimi REDDEDER (`getPrimaryService` `SecurityError`
 * atar) — filtre listesindeki servis otomatik "optional" sayılmaz.
 */
export async function requestBluetoothDevice(
  options: WebBluetoothRequestOptions,
): Promise<WebBluetoothDevice> {
  const bluetooth = getWebBluetooth();
  if (bluetooth === undefined) {
    throw new Error('web-bluetooth-unsupported');
  }
  return bluetooth.requestDevice(options);
}
