/**
 * WebUSB API'nin asgari yapısal tipleri.
 *
 * Neden elle yazıldı: `webSerialTypes.ts` ile aynı gerekçe — TypeScript'in
 * `lib.dom` tanımlarında WebUSB YOK (`navigator.usb` erişimi TS2339 verir) ve
 * tam `@types` paketi birkaç arayüz için depoya girmeye değmiyor. Yerel
 * arayüzler testlerde sahte cihaz enjekte edilebilmesini de sağlıyor.
 *
 * Yalnız bu modülün KULLANDIĞI yüzey tanımlı: cihaz keşfi/konfigürasyon
 * listeleme YOK, çünkü ekran kullanıcıdan config/arayüz/endpoint numarasını
 * doğrudan ister (seri portun baud rate'i elle seçmesiyle aynı disiplin —
 * bkz. `usbOptions.ts`).
 */

export interface WebUsbInTransferResult {
  readonly data?: DataView;
  readonly status: 'ok' | 'stall' | 'babble';
}

export interface WebUsbOutTransferResult {
  readonly bytesWritten: number;
  readonly status: 'ok' | 'stall';
}

export interface WebUsbDevice {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<WebUsbInTransferResult>;
  /**
   * Gerçek WebUSB `BufferSource` (ArrayBuffer da) kabul eder; burada `Uint8Array`e
   * daraltıldı çünkü `usbSource.ts` başka hiçbir şey GEÇMİYOR — TS 5.7'nin
   * `SharedArrayBuffer` varyansı yüzünden `BufferSource` burada gereksiz sürtünme
   * çıkarırdı (bkz. dosya başı: "yalnız kullanılan yüzey tanımlı").
   */
  transferOut(endpointNumber: number, data: Uint8Array): Promise<WebUsbOutTransferResult>;
}

export interface WebUsbDeviceFilter {
  readonly vendorId?: number;
  readonly productId?: number;
  readonly classCode?: number;
}

export interface WebUsbRequestOptions {
  readonly filters: readonly WebUsbDeviceFilter[];
}

export interface WebUsb {
  requestDevice(options: WebUsbRequestOptions): Promise<WebUsbDevice>;
  getDevices(): Promise<WebUsbDevice[]>;
}

/** `navigator.usb`e tek erişim noktası — cast burada kapalı kalır. */
export function getWebUsb(): WebUsb | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return (navigator as Navigator & { usb?: WebUsb }).usb;
}

export function isWebUsbSupported(): boolean {
  return getWebUsb() !== undefined;
}

/**
 * Cihaz seçtirir. **Yalnız kullanıcı jesti içinden çağrılabilir** (spec §41:
 * "kullanıcı izni olmadan port açma — yasak", Web Serial ile aynı kısıt);
 * jest dışında tarayıcı `SecurityError` atar. Filtresiz istek TÜM cihazları
 * listeler — spec bir varsayılan vendor/product ID vermiyor, seçim
 * kullanıcının.
 */
export async function requestUsbDevice(
  options: WebUsbRequestOptions = { filters: [] },
): Promise<WebUsbDevice> {
  const usb = getWebUsb();
  if (usb === undefined) {
    throw new Error('web-usb-unsupported');
  }
  return usb.requestDevice(options);
}
