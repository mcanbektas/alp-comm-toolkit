/**
 * BLE Advertisement (Bluetooth Core Specification 6.3, [Vol 6] Part B §2.3 +
 * Assigned Numbers — 2026-08-17 tarihli resmi PDF, `assigned_numbers/core/
 * ad_types.yaml`) — bağlantısız advertising-channel PDU: 2 baytlık Header +
 * değişken Payload (AdvA + AD Structure zinciri).
 *
 * ── GİRDİ MODELİ: ADVERTISING-CHANNEL PDU (dalga 7 karar 4a) ────────────────
 * Girdi sniffer/Wireshark'ın verdiği seviyedir: Header(2B)+Payload. Preamble/
 * Access Address/CRC (link katmanı) girdide YOK — bunlar sniffer donanımında
 * ayıklanır. CRC24_BLE (poly 0x65B) bu yüzden bu dalgada gerekmez.
 *
 * ── PDU TYPE'A GÖRE PAYLOAD STRATEJİSİ ──────────────────────────────────────
 * PDU Type header'dan HER ZAMAN adlandırılır (spec 32069-32097; kodlar Core
 * Spec [Vol 6] Part B §2.3 + Zephyr `pdu.h` (Apache-2.0) + Wireshark
 * `packet-btle.c` (`header & 0x0F`) üç bağımsız kaynakla çapraz doğrulandı).
 * Ama yalnız AD STRUCTURE taşıyan dört tür (ADV_IND/ADV_NONCONN_IND/
 * ADV_SCAN_IND/SCAN_RSP) AdvA+AD zinciri modeliyle çözülür (brief 7a adım 2).
 * Diğerlerinin payload'ı FARKLI şema taşır (ADV_DIRECT_IND: AdvA+TargetA,
 * SCAN_REQ: ScanA+AdvA, CONNECT_IND: InitA+AdvA+LLData, ADV_EXT_IND: Extended
 * Header) ve bu dalgada çözülmez — ham + "payload şeması çözülmüyor" uyarısı
 * (yanlış şemayla AdvA/AD okumak sessiz-yanlış decode olurdu, fixture uydurma
 * yasağının bir uzantısı).
 *
 * ── BİT SIRASI: LSB-FIRST ───────────────────────────────────────────────────
 * Header'ın ilk baytı PDU Type(4b)+RFU(1b)+ChSel(1b)+TxAdd(1b)+RxAdd(1b) —
 * bitCursor `lsb-first` (Wireshark'ın `header & 0x0F` maskesiyle örtüşür: PDU
 * Type alt nibble). ChSel yalnız ADV_IND'de anlamlıdır (Core Spec); diğer
 * türlerde aynı bit RFU sayılır ama alan adı tutarlılık için hep aynıdır.
 * Length ikinci bayt TAMAMI (8 bit) — Extended Advertising sonrası Core
 * Spec'in güncel yorumu budur (Legacy'de üst bitler fiilen hep 0).
 *
 * ── AD STRUCTURE ZİNCİRİ: LENGTH TYPE BAYTINI KAPSAR ────────────────────────
 * İlk oktet Length = (Type+Data) toplam baytı — data uzunluğu length-1'dir
 * (spec örneği: `02 01 06` → Length2, Type 0x01, Data 1 bayt `06`). Length=0
 * ve arabelleği aşan Length HATA (ipv6 ext-header zincir sınırı emsali).
 *
 * ── AD TYPE: DAR KÜME, KALANI HAM ────────────────────────────────────────────
 * Yalnız Flags/Local Name/Service UUID(16&128-bit)/Service Data/Manufacturer
 * Specific/Tx Power semantik çözülür (brief 7a adım 3). Kalan AD Type'lar ham
 * + tip numarası. Company Identifier (Manufacturer Specific içinde) de dar
 * bir kümedir — Assigned Numbers §7.1, kalanı ham hex.
 *
 * ── GÖSTERİM: ADRESLER TERS YAZILIR ─────────────────────────────────────────
 * AdvA teldeyken little-endian'dır; ekranda geleneksel MAC gösterimiyle
 * (en-anlamlı-bayt-önce) TERS sırada yazılır (dalga 7 tuzak notu, testte
 * sabitlenir).
 */

import { readBitsAsNumber, toSignedBits } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'ble-advertisement';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'BLE Advertisement';
/** Çeviri anahtarı segmentlerinde tire olamaz — `ble-advertisement` id'sinin camelCase karşılığı (canopen SUMMARY_KEY_SUFFIXES tuzak emsali). */
const TRANSLATION_KEY_PREFIX = 'protocol.bleAdvertisement';

const HEADER_LENGTH = 2;
const ADV_A_LENGTH = 6;

const PDU_TYPE_BIT_POSITION = 0;
const PDU_TYPE_BIT_LENGTH = 4;
const RFU_BIT_POSITION = 4;
const CH_SEL_BIT_POSITION = 5;
const TX_ADD_BIT_POSITION = 6;
const RX_ADD_BIT_POSITION = 7;
const LENGTH_BYTE_OFFSET = 1;
const LENGTH_BIT_LENGTH = 8;

/** ADV_IND'in Channel Selection Algorithm anlamı (Core Spec) — diğer PDU tiplerinde bit RFU sayılır. */
const CH_SEL_RELEVANT_PDU_TYPE = 0x00;

/** Core Spec [Vol 6] Part B §2.3 (spec 32073-32095) — kodlar Zephyr pdu.h + Wireshark packet-btle.c ile çapraz doğrulandı. */
const PDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'ADV_IND'],
  [0x01, 'ADV_DIRECT_IND'],
  [0x02, 'ADV_NONCONN_IND'],
  [0x03, 'SCAN_REQ'],
  [0x04, 'SCAN_RSP'],
  [0x05, 'CONNECT_IND'],
  [0x06, 'ADV_SCAN_IND'],
  [0x07, 'ADV_EXT_IND'],
]);

/** AdvA+AD Structure zinciri şeması yalnız bu dört PDU tipinde geçerlidir (dosya başı). */
const AD_BEARING_PDU_TYPES: ReadonlySet<number> = new Set([0x00, 0x02, 0x04, 0x06]);

type AdTypeKind =
  | 'flags'
  | 'local-name'
  | 'service-uuid-16'
  | 'service-uuid-128'
  | 'service-data-16'
  | 'manufacturer-specific'
  | 'tx-power';

interface AdTypeInfo {
  readonly name: string;
  readonly kind: AdTypeKind;
}

/** Bluetooth Assigned Numbers (2026-08-17, assigned_numbers/core/ad_types.yaml) — dar küme, kalanı ham (dosya başı). */
const AD_TYPES: ReadonlyMap<number, AdTypeInfo> = new Map([
  [0x01, { name: 'Flags', kind: 'flags' }],
  [0x02, { name: 'Incomplete List of 16-bit Service UUIDs', kind: 'service-uuid-16' }],
  [0x03, { name: 'Complete List of 16-bit Service UUIDs', kind: 'service-uuid-16' }],
  [0x06, { name: 'Incomplete List of 128-bit Service UUIDs', kind: 'service-uuid-128' }],
  [0x07, { name: 'Complete List of 128-bit Service UUIDs', kind: 'service-uuid-128' }],
  [0x08, { name: 'Shortened Local Name', kind: 'local-name' }],
  [0x09, { name: 'Complete Local Name', kind: 'local-name' }],
  [0x0a, { name: 'Tx Power Level', kind: 'tx-power' }],
  [0x16, { name: 'Service Data - 16-bit UUID', kind: 'service-data-16' }],
  [0xff, { name: 'Manufacturer Specific Data', kind: 'manufacturer-specific' }],
]);

/** Core Spec Supplement Part A §1.3 — dar küme bit0-4, bit5-7 dosya başı notuyla RFU sayılır. */
const FLAG_BIT_NAMES: readonly string[] = [
  'LE Limited Discoverable Mode',
  'LE General Discoverable Mode',
  'BR/EDR Not Supported',
  'Simultaneous LE and BR/EDR (Controller)',
  'Simultaneous LE and BR/EDR (Host)',
];

/** Assigned Numbers §7.1 (2026-08-17) — dar küme, kalan Company ID ham hex gösterilir. */
const COMPANY_IDS: ReadonlyMap<number, string> = new Map([
  [0x0006, 'Microsoft'],
  [0x000f, 'Broadcom Corporation'],
  [0x0025, 'NXP B.V.'],
  [0x004c, 'Apple, Inc.'],
]);

const ERROR_FRAME_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.frameTooShort`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_AD_LENGTH_ZERO = `${TRANSLATION_KEY_PREFIX}.error.adLengthZero`;
const ERROR_AD_STRUCTURE_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.adStructureTruncated`;
const ERROR_PAYLOAD_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.payloadTooShort`;

const WARN_UNKNOWN_PDU_TYPE = `${TRANSLATION_KEY_PREFIX}.warning.unknownPduType`;
const WARN_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.lengthMismatch`;
const WARN_PAYLOAD_SCHEMA_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.payloadSchemaNotDecoded`;
const WARN_UNKNOWN_AD_TYPE = `${TRANSLATION_KEY_PREFIX}.warning.unknownAdType`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

/** Wire LE; ekranda geleneksel MAC gösterimiyle TERS sırada (dosya başı gösterim notu). */
function formatMacAddress(bytes: Uint8Array): string {
  return Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function decodeAsciiText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) | (byteAt(bytes, offset + 1) << 8);
}

function formatUuid16(bytes: Uint8Array): string {
  return toHex(readUint16Le(bytes, 0), 2);
}

/** Wire LE; standart 128-bit UUID gösterimi baytları TERS sırada okur (dosya başı gösterim notu emsali). */
function formatUuid128(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function describeFlags(byte: number): string {
  const active: string[] = [];
  for (let bit = 0; bit < FLAG_BIT_NAMES.length; bit += 1) {
    if ((byte & (1 << bit)) !== 0) {
      active.push(FLAG_BIT_NAMES[bit] as string);
    }
  }
  return active.length > 0 ? active.join(', ') : 'None';
}

/** AD Data'yı sabit genişlikli birimlere böler; tutarsız uzunlukta ham bırakır (undefined). */
function decodeUuidList(data: Uint8Array, unitLength: number, format: (unit: Uint8Array) => string): string | undefined {
  if (data.length === 0 || data.length % unitLength !== 0) return undefined;
  const values: string[] = [];
  for (let offset = 0; offset < data.length; offset += unitLength) {
    values.push(format(data.slice(offset, offset + unitLength)));
  }
  return values.join(', ');
}

function decodeAdPhysicalValue(kind: AdTypeKind, data: Uint8Array): string | undefined {
  switch (kind) {
    case 'flags':
      return data.length >= 1 ? describeFlags(byteAt(data, 0)) : undefined;
    case 'local-name':
      return decodeAsciiText(data);
    case 'service-uuid-16':
      return decodeUuidList(data, 2, formatUuid16);
    case 'service-uuid-128':
      return decodeUuidList(data, 16, formatUuid128);
    case 'service-data-16': {
      if (data.length < 2) return undefined;
      const serviceDataLength = data.length - 2;
      return `${formatUuid16(data)} (${String(serviceDataLength)}B)`;
    }
    case 'manufacturer-specific': {
      if (data.length < 2) return undefined;
      const companyId = readUint16Le(data, 0);
      return COMPANY_IDS.get(companyId) ?? toHex(companyId, 2);
    }
    case 'tx-power': {
      if (data.length < 1) return undefined;
      return `${toSignedBits(BigInt(byteAt(data, 0)), 8).toString()} dBm`;
    }
  }
}

interface BleAdvertisementParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseBleAdvertisementFrame(data: Uint8Array, options: BleAdvertisementParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < HEADER_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const pduType = readBitsAsNumber(data, PDU_TYPE_BIT_POSITION, PDU_TYPE_BIT_LENGTH, 'lsb-first');
  const pduTypeName = PDU_TYPE_NAMES.get(pduType);
  const pduTypeField: ParsedField = {
    id: 'pdu-type',
    name: 'PDU Type',
    offset: 0,
    length: PDU_TYPE_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: pduType,
    valid: pduTypeName !== undefined,
    warnings: [],
  };
  if (pduTypeName !== undefined) {
    pduTypeField.physicalValue = pduTypeName;
  } else {
    pduTypeField.warnings = [WARN_UNKNOWN_PDU_TYPE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_PDU_TYPE));
  }
  fields.push(pduTypeField);

  const rfu = readBitsAsNumber(data, RFU_BIT_POSITION, 1, 'lsb-first');
  fields.push({
    id: 'rfu',
    name: 'RFU',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: rfu,
    valid: true,
    warnings: [],
  });

  const chSel = readBitsAsNumber(data, CH_SEL_BIT_POSITION, 1, 'lsb-first');
  const chSelField: ParsedField = {
    id: 'ch-sel',
    name: 'Channel Selection Algorithm',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: chSel,
    valid: true,
    warnings: [],
  };
  if (pduType === CH_SEL_RELEVANT_PDU_TYPE) {
    chSelField.physicalValue = chSel === 1 ? 'Algorithm #2' : 'Algorithm #1';
  }
  fields.push(chSelField);

  const txAdd = readBitsAsNumber(data, TX_ADD_BIT_POSITION, 1, 'lsb-first');
  fields.push({
    id: 'tx-add',
    name: 'TxAdd',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: txAdd,
    physicalValue: txAdd === 1 ? 'Random' : 'Public',
    valid: true,
    warnings: [],
  });

  const rxAdd = readBitsAsNumber(data, RX_ADD_BIT_POSITION, 1, 'lsb-first');
  fields.push({
    id: 'rx-add',
    name: 'RxAdd',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: rxAdd,
    physicalValue: rxAdd === 1 ? 'Random' : 'Public',
    valid: true,
    warnings: [],
  });

  const declaredLength = readBitsAsNumber(data, LENGTH_BYTE_OFFSET * 8, LENGTH_BIT_LENGTH, 'lsb-first');
  const actualPayloadLength = data.length - HEADER_LENGTH;
  const lengthField: ParsedField = {
    id: 'length',
    name: 'Length',
    offset: LENGTH_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(LENGTH_BYTE_OFFSET, LENGTH_BYTE_OFFSET + 1),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  if (declaredLength !== actualPayloadLength) {
    lengthField.warnings.push(WARN_LENGTH_MISMATCH);
    warnings.push(toProtocolWarning(WARN_LENGTH_MISMATCH));
  }
  fields.push(lengthField);

  const payload = data.slice(HEADER_LENGTH);

  if (!AD_BEARING_PDU_TYPES.has(pduType)) {
    // Dar kapsam dışı payload şeması (dosya başı) — ham + uyarı, uydurmaya girmez.
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: HEADER_LENGTH,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [WARN_PAYLOAD_SCHEMA_NOT_DECODED],
      });
      warnings.push(toProtocolWarning(WARN_PAYLOAD_SCHEMA_NOT_DECODED));
    }
  } else if (payload.length < ADV_A_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_PAYLOAD_TOO_SHORT,
      offset: HEADER_LENGTH,
      length: payload.length,
    });
  } else {
    const advA = payload.slice(0, ADV_A_LENGTH);
    fields.push({
      id: 'adv-a',
      name: 'AdvA',
      offset: HEADER_LENGTH,
      length: ADV_A_LENGTH,
      rawBytes: advA,
      rawValue: formatMacAddress(advA),
      physicalValue: txAdd === 1 ? 'Random' : 'Public',
      valid: true,
      warnings: [],
    });

    // AD Structure zinciri: Length | AD Type | AD Data — Length, Type baytını KAPSAR (dosya başı).
    let cursor = HEADER_LENGTH + ADV_A_LENGTH;
    const end = data.length;
    let index = 0;
    while (cursor < end) {
      const adLength = byteAt(data, cursor);
      index += 1;

      if (adLength === 0) {
        errors.push({ code: 'value-out-of-range', message: ERROR_AD_LENGTH_ZERO, offset: cursor, length: 1 });
        break;
      }
      if (cursor + 1 + adLength > end) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_AD_STRUCTURE_TRUNCATED,
          offset: cursor,
          length: end - cursor,
          details: { declaredLength: adLength },
        });
        break;
      }

      const adType = byteAt(data, cursor + 1);
      const adData = data.slice(cursor + 2, cursor + 1 + adLength);
      const adTypeInfo = AD_TYPES.get(adType);
      const adField: ParsedField = {
        id: `ad-${String(index)}`,
        name: adTypeInfo !== undefined ? `AD #${String(index)} — ${adTypeInfo.name}` : `AD #${String(index)} — Unknown (${toHex(adType, 1)})`,
        offset: cursor,
        length: 1 + adLength,
        rawBytes: data.slice(cursor, cursor + 1 + adLength),
        rawValue: adType,
        valid: true,
        warnings: [],
      };
      if (adTypeInfo !== undefined) {
        const physicalValue = decodeAdPhysicalValue(adTypeInfo.kind, adData);
        if (physicalValue !== undefined) adField.physicalValue = physicalValue;
      } else {
        adField.warnings.push(WARN_UNKNOWN_AD_TYPE);
        warnings.push(toProtocolWarning(WARN_UNKNOWN_AD_TYPE));
      }
      fields.push(adField);

      cursor += 1 + adLength;
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseBleAdvertisement(data: Uint8Array): ParseResult {
  return parseBleAdvertisementFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): BleAdvertisementParseOptions {
  const options: BleAdvertisementParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const bleAdvertisementParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + Length alanı gerçek kalan bayt sayısıyla tutarlı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    return byteAt(data, LENGTH_BYTE_OFFSET) === data.length - HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseBleAdvertisementFrame(data, readContextOptions(context));
  },
};

/** Örnek/test AdvA — gerçek bir cihazı işaret etmez (ipv6 RFC 3849 belgeleme önekinin BLE'de resmi karşılığı yoktur). */
const EXAMPLE_ADV_A = [0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa];

function legacyAdvertisingFrame(pduType: number, adChain: readonly number[]): number[] {
  const payloadLength = ADV_A_LENGTH + adChain.length;
  return [pduType, payloadLength, ...EXAMPLE_ADV_A, ...adChain];
}

/**
 * Örnek çerçeveler. AD chain baytları spec'in kendi işlenmiş örnekleridir
 * (satır atıflı, dosya başı); PDU Header+AdvA sarmalı bu dalgada eklendi.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'flags',
    name: 'protocol.bleAdvertisement.example.flags.name',
    // AD chain spec 32119: `02 01 06` → Flags = LE General Discoverable Mode + BR/EDR Not Supported.
    bytes: Uint8Array.from(legacyAdvertisingFrame(0x00, [0x02, 0x01, 0x06])),
    description: 'protocol.bleAdvertisement.example.flags.description',
    expectedValid: true,
  },
  {
    id: 'manufacturer-specific',
    name: 'protocol.bleAdvertisement.example.manufacturerSpecific.name',
    // AD chain spec 32139: `05 FF 4C 00 01 02` → Company ID 0x004C (Apple, Inc.) + 2 bayt data.
    bytes: Uint8Array.from(legacyAdvertisingFrame(0x00, [0x05, 0xff, 0x4c, 0x00, 0x01, 0x02])),
    description: 'protocol.bleAdvertisement.example.manufacturerSpecific.description',
    expectedValid: true,
  },
  {
    id: 'complete-local-name',
    name: 'protocol.bleAdvertisement.example.completeLocalName.name',
    // AD chain spec 32183: `09 09 53 65 6E 73 6F 72 30 31` → Complete Local Name "Sensor01".
    bytes: Uint8Array.from(
      legacyAdvertisingFrame(0x00, [0x09, 0x09, 0x53, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x30, 0x31]),
    ),
    description: 'protocol.bleAdvertisement.example.completeLocalName.description',
    expectedValid: true,
  },
  {
    id: 'multiple-ad-structures',
    name: 'protocol.bleAdvertisement.example.multipleAdStructures.name',
    // Gerçekçi beacon: Flags + Complete Local Name aynı payload'da art arda (spec 32101-32151 örneklerinin birleşimi).
    bytes: Uint8Array.from(
      legacyAdvertisingFrame(0x00, [0x02, 0x01, 0x06, 0x09, 0x09, 0x53, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x30, 0x31]),
    ),
    description: 'protocol.bleAdvertisement.example.multipleAdStructures.description',
    expectedValid: true,
  },
  {
    id: 'unknown-pdu-type',
    name: 'protocol.bleAdvertisement.example.unknownPduType.name',
    // Reserved PDU Type (0x0F) — header adlandırılamaz, payload şeması bu dalgada zaten çözülmez.
    bytes: Uint8Array.from([0x0f, 0x00]),
    description: 'protocol.bleAdvertisement.example.unknownPduType.description',
    expectedValid: true,
  },
  {
    id: 'truncated-ad-structure',
    name: 'protocol.bleAdvertisement.example.truncatedAdStructure.name',
    // Declared Length (5) kalan bayttan (3) taşıyor — off-by-one/taşma koruması kanıtı.
    bytes: Uint8Array.from(legacyAdvertisingFrame(0x00, [0x05, 0xff, 0x4c, 0x00])),
    description: 'protocol.bleAdvertisement.example.truncatedAdStructure.description',
    expectedValid: false,
  },
];

export const bleAdvertisementPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: bleAdvertisementParser,
  documentation: {
    summary: 'protocol.bleAdvertisement.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
