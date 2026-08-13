/**
 * Web Serial API'nin asgari yapısal tipleri.
 *
 * Neden elle yazıldı: TypeScript 7'nin `lib.dom` tanımlarında Web Serial YOK
 * (`navigator.serial` erişimi TS2339 verir) ve `@types/w3c-web-serial`
 * bağımlılığı yalnız birkaç arayüz için depoya girmeye değmiyor. Global
 * augmentation yerine yerel arayüzler seçildi: kaynak testlerinde sahte port
 * enjekte edilebiliyor, üstelik ileride lib.dom bu tipleri kazanırsa çakışan
 * global bildirim sorunu çıkmıyor.
 *
 * Tipler tarayıcının gerçekten kabul ettiği alt kümedir — Web Serial `dataBits`
 * olarak yalnız 7|8, `stopBits` olarak yalnız 1|2 kabul eder.
 */

export interface WebSerialOpenOptions {
  readonly baudRate: number;
  readonly dataBits?: 7 | 8;
  readonly stopBits?: 1 | 2;
  readonly parity?: 'none' | 'even' | 'odd';
  readonly bufferSize?: number;
  readonly flowControl?: 'none' | 'hardware';
}

export interface WebSerialPortInfo {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

export interface WebSerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: WebSerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): WebSerialPortInfo;
}

export interface WebSerialPortFilter {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

export interface WebSerialRequestOptions {
  readonly filters?: readonly WebSerialPortFilter[];
}

export interface WebSerial {
  requestPort(options?: WebSerialRequestOptions): Promise<WebSerialPort>;
  getPorts(): Promise<WebSerialPort[]>;
}

/** `navigator.serial`e tek erişim noktası — cast burada kapalı kalır. */
export function getWebSerial(): WebSerial | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return (navigator as Navigator & { serial?: WebSerial }).serial;
}

export function isWebSerialSupported(): boolean {
  return getWebSerial() !== undefined;
}

/**
 * Port seçtirir. **Yalnız kullanıcı jesti içinden çağrılabilir** (spec §41:
 * "kullanıcı izni olmadan port açma — yasak"); jest dışında tarayıcı
 * `SecurityError` atar.
 */
export async function requestSerialPort(options?: WebSerialRequestOptions): Promise<WebSerialPort> {
  const serial = getWebSerial();
  if (serial === undefined) {
    throw new Error('web-serial-unsupported');
  }
  return serial.requestPort(options);
}
