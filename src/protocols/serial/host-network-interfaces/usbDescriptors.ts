/**
 * USB 2.0 Chapter 9 — SETUP isteği ve standart tanımlayıcı (descriptor)
 * çözümü. Faz 10 dalga 11j. Paket iskeleti `usbPacket.ts`te; burası bir veri
 * paketinin YÜKÜNÜ okur.
 *
 * Kaynak birebir USB 2.0 spec: Table 9-2 (Format of Setup Data), Table 9-4
 * (Standard Request Codes), Table 9-5 (Descriptor Types), Table 9-8 (Device),
 * Table 9-10 (Configuration), Table 9-12 (Interface), Table 9-13 (Endpoint) ve
 * §9.6.7 (String). Çok baytlı alanlar little-endian (spec §8.1).
 *
 * **Uydurulmayan şey — yükün ne olduğu paketin kendisinde yazmıyor.** Bir
 * DATA0/DATA1 paketi hem SETUP isteği, hem tanımlayıcı yanıtı, hem de ham
 * uygulama verisi olabilir; ayrımı yapan şey ÖNCEKİ token paketidir ve tek
 * paketlik yakalamada o yoktur. Bu yüzden buradaki iki çözüm de ÇIKARIMDIR ve
 * çağıran taraf (`usb.ts`) bunu uyarı olarak basar:
 *   - 8 baytlık yük → SETUP isteği olabilir (Table 9-2 sabit 8 bayt)
 *   - ilk iki bayt (bLength, bDescriptorType) tutarlıysa → tanımlayıcı olabilir
 * İkisi de kesinlik iddia etmez. Aynı disiplin zinciri: 1-Wire endianness →
 * RS-232 gerilim aralığı → 4–20 mA arıza eşikleri → LIN break asgarisi →
 * PMBus ULINEAR16 üssü → bu.
 */

const HEX_RADIX = 16;
const SETUP_PACKET_LENGTH = 8;
const MIN_DESCRIPTOR_LENGTH = 2;

/** Table 9-4 — Standard Request Codes. Ad veridir, çeviriye girmez. */
const STANDARD_REQUESTS: Record<number, string> = {
  0: 'GET_STATUS',
  1: 'CLEAR_FEATURE',
  3: 'SET_FEATURE',
  5: 'SET_ADDRESS',
  6: 'GET_DESCRIPTOR',
  7: 'SET_DESCRIPTOR',
  8: 'GET_CONFIGURATION',
  9: 'SET_CONFIGURATION',
  10: 'GET_INTERFACE',
  11: 'SET_INTERFACE',
  12: 'SYNCH_FRAME',
};

/** Table 9-5 — Descriptor Types. */
export const DESCRIPTOR_TYPES: Record<number, string> = {
  1: 'DEVICE',
  2: 'CONFIGURATION',
  3: 'STRING',
  4: 'INTERFACE',
  5: 'ENDPOINT',
  6: 'DEVICE_QUALIFIER',
  7: 'OTHER_SPEED_CONFIGURATION',
  8: 'INTERFACE_POWER',
};

/** Table 9-2 §9.3.1 — bmRequestType D6..5. */
const REQUEST_TYPES = ['Standard', 'Class', 'Vendor', 'Reserved'] as const;
/** Table 9-2 §9.3.1 — bmRequestType D4..0 (4..31 rezerve). */
const REQUEST_RECIPIENTS = ['Device', 'Interface', 'Endpoint', 'Other'] as const;

export interface UsbSetupRequest {
  bmRequestType: number;
  /** D7: 0 = Host-to-device (OUT), 1 = Device-to-host (IN). */
  directionDeviceToHost: boolean;
  type: string;
  recipient: string;
  bRequest: number;
  /** Standart istek adı; sınıf/satıcı isteklerinde ya da bilinmeyen kodda undefined. */
  requestName?: string;
  wValue: number;
  wIndex: number;
  wLength: number;
  /** GET_DESCRIPTOR/SET_DESCRIPTOR'da wValue üst baytı tanımlayıcı türüdür (§9.4.3). */
  descriptorType?: string;
  descriptorIndex?: number;
}

export interface UsbDescriptorField {
  name: string;
  offset: number;
  length: number;
  value: number | string;
  formatted: string;
}

export interface UsbDescriptorNode {
  /** Yükün başından itibaren tanımlayıcının başladığı ofset. */
  offset: number;
  bLength: number;
  bDescriptorType: number;
  typeName: string;
  fields: UsbDescriptorField[];
  /** bLength eldeki bayt sayısını aşıyorsa true — alanlar yine gösterilir. */
  truncated: boolean;
}

function hex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function readWord(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/** BCD alanı (bcdUSB/bcdDevice): 0x0200 → "2.00" (Table 9-8). */
function formatBcd(value: number): string {
  const major = (value >> 8) & 0xff;
  const minor = (value >> 4) & 0x0f;
  const sub = value & 0x0f;
  return `${major.toString(HEX_RADIX)}.${minor.toString(HEX_RADIX)}${sub.toString(HEX_RADIX)}`;
}

export function isPossibleSetupPayload(payload: Uint8Array): boolean {
  return payload.length === SETUP_PACKET_LENGTH;
}

/** Table 9-2. Yalnız 8 baytlık yükte anlamlıdır (`isPossibleSetupPayload`). */
export function decodeSetupRequest(payload: Uint8Array): UsbSetupRequest {
  const bmRequestType = payload[0] ?? 0;
  const bRequest = payload[1] ?? 0;
  const wValue = readWord(payload, 2);
  const type = REQUEST_TYPES[(bmRequestType >> 5) & 0x03] ?? 'Reserved';
  const recipientIndex = bmRequestType & 0x1f;
  const isStandard = type === 'Standard';
  const requestName = isStandard ? STANDARD_REQUESTS[bRequest] : undefined;
  const descriptorType =
    isStandard && (bRequest === 6 || bRequest === 7) ? DESCRIPTOR_TYPES[(wValue >> 8) & 0xff] : undefined;

  return {
    bmRequestType,
    directionDeviceToHost: (bmRequestType & 0x80) !== 0,
    type,
    recipient: REQUEST_RECIPIENTS[recipientIndex] ?? 'Reserved',
    bRequest,
    ...(requestName === undefined ? {} : { requestName }),
    wValue,
    wIndex: readWord(payload, 4),
    wLength: readWord(payload, 6),
    ...(descriptorType === undefined ? {} : { descriptorType }),
    ...(descriptorType === undefined ? {} : { descriptorIndex: wValue & 0xff }),
  };
}

/** bmAttributes (Table 9-13 §9.6.6) — transfer türü D1..0. */
const ENDPOINT_TRANSFER_TYPES = ['Control', 'Isochronous', 'Bulk', 'Interrupt'] as const;

function byteField(
  name: string,
  bytes: Uint8Array,
  base: number,
  offset: number,
  format?: (value: number) => string,
): UsbDescriptorField {
  const value = bytes[base + offset] ?? 0;
  return {
    name,
    offset: base + offset,
    length: 1,
    value,
    formatted: format === undefined ? `${value}` : format(value),
  };
}

function wordField(
  name: string,
  bytes: Uint8Array,
  base: number,
  offset: number,
  format?: (value: number) => string,
): UsbDescriptorField {
  const value = readWord(bytes, base + offset);
  return {
    name,
    offset: base + offset,
    length: 2,
    value,
    formatted: format === undefined ? `${value}` : format(value),
  };
}

function deviceFields(bytes: Uint8Array, base: number): UsbDescriptorField[] {
  return [
    wordField('bcdUSB', bytes, base, 2, formatBcd),
    byteField('bDeviceClass', bytes, base, 4, (v) => hex(v, 2)),
    byteField('bDeviceSubClass', bytes, base, 5, (v) => hex(v, 2)),
    byteField('bDeviceProtocol', bytes, base, 6, (v) => hex(v, 2)),
    byteField('bMaxPacketSize0', bytes, base, 7),
    wordField('idVendor', bytes, base, 8, (v) => hex(v, 4)),
    wordField('idProduct', bytes, base, 10, (v) => hex(v, 4)),
    wordField('bcdDevice', bytes, base, 12, formatBcd),
    byteField('iManufacturer', bytes, base, 14),
    byteField('iProduct', bytes, base, 15),
    byteField('iSerialNumber', bytes, base, 16),
    byteField('bNumConfigurations', bytes, base, 17),
  ];
}

function configurationFields(bytes: Uint8Array, base: number): UsbDescriptorField[] {
  return [
    wordField('wTotalLength', bytes, base, 2, (v) => `${v} B`),
    byteField('bNumInterfaces', bytes, base, 4),
    byteField('bConfigurationValue', bytes, base, 5),
    byteField('iConfiguration', bytes, base, 6),
    // Table 9-10: D6 Self-powered, D5 Remote Wakeup, D7 rezerve (1 olmalı).
    byteField('bmAttributes', bytes, base, 7, (v) => {
      const flags = [
        (v & 0x40) !== 0 ? 'Self-powered' : 'Bus-powered',
        ...((v & 0x20) !== 0 ? ['Remote Wakeup'] : []),
      ];
      return `${hex(v, 2)} · ${flags.join(' · ')}`;
    }),
    // Table 9-10: "Expressed in 2 mA units".
    byteField('bMaxPower', bytes, base, 8, (v) => `${v * 2} mA`),
  ];
}

function interfaceFields(bytes: Uint8Array, base: number): UsbDescriptorField[] {
  return [
    byteField('bInterfaceNumber', bytes, base, 2),
    byteField('bAlternateSetting', bytes, base, 3),
    byteField('bNumEndpoints', bytes, base, 4),
    byteField('bInterfaceClass', bytes, base, 5, (v) => hex(v, 2)),
    byteField('bInterfaceSubClass', bytes, base, 6, (v) => hex(v, 2)),
    byteField('bInterfaceProtocol', bytes, base, 7, (v) => hex(v, 2)),
    byteField('iInterface', bytes, base, 8),
  ];
}

function endpointFields(bytes: Uint8Array, base: number): UsbDescriptorField[] {
  return [
    // Table 9-13: D3..0 endpoint numarası, D7 yön (1 = IN).
    byteField('bEndpointAddress', bytes, base, 2, (v) => {
      const direction = (v & 0x80) !== 0 ? 'IN' : 'OUT';
      return `${hex(v, 2)} · EP${v & 0x0f} ${direction}`;
    }),
    byteField('bmAttributes', bytes, base, 3, (v) => {
      const transfer = ENDPOINT_TRANSFER_TYPES[v & 0x03] ?? 'Control';
      return `${hex(v, 2)} · ${transfer}`;
    }),
    wordField('wMaxPacketSize', bytes, base, 4, (v) => `${v & 0x7ff} B`),
    byteField('bInterval', bytes, base, 6),
  ];
}

/** §9.6.7 — dizgi tanımlayıcısı UNICODE (UTF-16LE) taşır, sonlandırıcı yoktur. */
function stringFields(bytes: Uint8Array, base: number, bLength: number): UsbDescriptorField[] {
  const end = Math.min(base + bLength, bytes.length);
  const units: number[] = [];
  for (let offset = base + 2; offset + 1 < end; offset += 2) units.push(readWord(bytes, offset));
  const text = String.fromCharCode(...units);
  return [
    {
      name: 'bString',
      offset: base + 2,
      length: Math.max(0, end - (base + 2)),
      value: text,
      formatted: text,
    },
  ];
}

function fieldsForType(bytes: Uint8Array, base: number, type: number, bLength: number): UsbDescriptorField[] {
  switch (type) {
    case 1:
    case 6:
      return deviceFields(bytes, base);
    case 2:
    case 7:
      return configurationFields(bytes, base);
    case 3:
      return stringFields(bytes, base, bLength);
    case 4:
      return interfaceFields(bytes, base);
    case 5:
      return endpointFields(bytes, base);
    default:
      return [];
  }
}

/**
 * İlk iki bayt tanımlayıcı başlığı gibi duruyor mu: bLength en az 2 ve
 * bDescriptorType Table 9-5'te tanımlı. Sadece ÇIKARIM — çağıran uyarır.
 */
export function isPossibleDescriptorPayload(payload: Uint8Array): boolean {
  if (payload.length < MIN_DESCRIPTOR_LENGTH) return false;
  const bLength = payload[0] ?? 0;
  const type = payload[1] ?? 0;
  return bLength >= MIN_DESCRIPTOR_LENGTH && DESCRIPTOR_TYPES[type] !== undefined;
}

/**
 * Yükteki tanımlayıcı zincirini çözer. Configuration yanıtı tek yükte
 * Configuration+Interface+Endpoint tanımlayıcılarını arka arkaya taşır
 * (§9.4.3) — bu yüzden zincir `bLength` adımlarıyla yürünür.
 *
 * `bLength` 0 ya da eldeki bayt sayısından büyükse yürüyüş DURUR (sonsuz döngü
 * ve sessiz veri kaybı yok); son düğüm `truncated: true` ile işaretlenir.
 */
export function decodeDescriptorChain(payload: Uint8Array): UsbDescriptorNode[] {
  const nodes: UsbDescriptorNode[] = [];
  let offset = 0;

  while (offset + MIN_DESCRIPTOR_LENGTH <= payload.length) {
    const bLength = payload[offset] ?? 0;
    const bDescriptorType = payload[offset + 1] ?? 0;
    if (bLength < MIN_DESCRIPTOR_LENGTH) break;

    const truncated = offset + bLength > payload.length;
    nodes.push({
      offset,
      bLength,
      bDescriptorType,
      typeName: DESCRIPTOR_TYPES[bDescriptorType] ?? 'Unknown',
      fields: fieldsForType(payload, offset, bDescriptorType, bLength),
      truncated,
    });

    if (truncated) break;
    offset += bLength;
  }

  return nodes;
}
