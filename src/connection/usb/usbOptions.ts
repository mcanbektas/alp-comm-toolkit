/**
 * WebUSB bağlantı ayarları — spec §8.1 WebUSB kaynağı için, `serialOptions.ts`
 * ile aynı disiplin (saf veri + doğrulama, hiçbir tarayıcı API'sine dokunmaz).
 *
 * Spec §8.1'in "Bağlantı ayarları" listesi (Baud rate, Data bits, Parity…)
 * UART'a özgüdür ve WebUSB'nin toplu (bulk) transferine karşılığı YOK — bu
 * yüzden alanlar WebUSB'nin KENDİ API'sinin zorunlu kıldığı parametrelerden
 * türetildi: `selectConfiguration`/`claimInterface`/`transferIn`/`transferOut`
 * hepsi bir sayı ister, tahmin edilemez.
 */

export interface UsbConnectionOptions {
  readonly configurationValue: number;
  readonly interfaceNumber: number;
  /** IN yönü — cihazdan okunan uç nokta. */
  readonly endpointIn: number;
  /** OUT yönü — cihaza yazılan uç nokta; `canWrite` bunu kullanır. */
  readonly endpointOut: number;
  /** `transferIn` tek çağrıda okuyacağı azami bayt — spec'in "Buffer size" alanının WebUSB karşılığı. */
  readonly transferSize: number;
}

/** En sık görülen tekli bulk IN/OUT çift uç nokta düzeni (ör. CDC-benzeri seri köprüler). */
export const DEFAULT_USB_OPTIONS: UsbConnectionOptions = {
  configurationValue: 1,
  interfaceNumber: 0,
  endpointIn: 1,
  endpointOut: 1,
  transferSize: 64,
};

const MIN_TRANSFER_SIZE = 1;
/** USB 2.0 bulk'ın pratik üst sınırı; üstü çoğu sürücüde parçalanır. */
const MAX_TRANSFER_SIZE = 1_048_576;

export type UsbOptionsField = keyof UsbConnectionOptions;

export interface UsbOptionsIssue {
  readonly field: UsbOptionsField;
  readonly code: 'not-integer' | 'out-of-range';
}

function checkNonNegativeInteger(
  field: UsbOptionsField,
  value: number,
  issues: UsbOptionsIssue[],
): void {
  if (!Number.isInteger(value)) {
    issues.push({ field, code: 'not-integer' });
  } else if (value < 0) {
    issues.push({ field, code: 'out-of-range' });
  }
}

export function validateUsbOptions(options: UsbConnectionOptions): UsbOptionsIssue[] {
  const issues: UsbOptionsIssue[] = [];

  checkNonNegativeInteger('configurationValue', options.configurationValue, issues);
  checkNonNegativeInteger('interfaceNumber', options.interfaceNumber, issues);
  checkNonNegativeInteger('endpointIn', options.endpointIn, issues);
  checkNonNegativeInteger('endpointOut', options.endpointOut, issues);

  if (!Number.isInteger(options.transferSize)) {
    issues.push({ field: 'transferSize', code: 'not-integer' });
  } else if (options.transferSize < MIN_TRANSFER_SIZE || options.transferSize > MAX_TRANSFER_SIZE) {
    issues.push({ field: 'transferSize', code: 'out-of-range' });
  }

  return issues;
}
