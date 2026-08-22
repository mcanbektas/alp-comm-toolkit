/**
 * USB 2.0 — paket çözümü. Faz 10 dalga 11j (sıralama önerisi #9,
 * `brief-faz10-dalga11.md:127`). İskelet `usbPacket.ts`te, Chapter 9 çözümü
 * `usbDescriptors.ts`te; bu dosya ikisini alan tablosuna ve örnek çerçevelere
 * çevirir.
 *
 * Spec özetinin (`01-fiziksel-arayuzler.md:358-380`) istediklerinden bu dalgada
 * KARŞILANANLAR: paket alanları (PID, Address, Endpoint, Frame Number, Data,
 * CRC), PID türleri, SETUP paketi çözücüsü, tanımlayıcı ağacı (Device /
 * Configuration / Interface / Endpoint / String). KAPSAM DIŞI kalanlar ve
 * NEDENLERİ:
 *   - SYNC / EOP: bit seviyesi, bayt akışında izi yok (spec §8.2).
 *   - Transaction ve Transfer seviyeleri: paket sınırını veren SYNC/EOP
 *     olmadan art arda paketler bölünemez (`usbPacket.ts` dosya başı).
 *   - Enumeration timeline: birden çok transfer boyunca DURUM tutmayı ister,
 *     tek yakalamalık parser API'sinin kanalı yok.
 *   - Hız sınıfı / VBUS / Type-C rol yapısı: elektriksel, bayt akışında yok
 *     (RS-232 gerilim aralığındaki disiplin — sayı uydurulmaz).
 *
 * `'live'` sekmesi katalogdan ÇIKARILDI: `connection/` yalnız serial+mock
 * taşıyor, WebUSB yok — I²C'de (11c) verilen kararın aynısı.
 */

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

import {
  buildDataPacket,
  buildSofPacket,
  buildTokenPacket,
  formatBinary,
  formatHexByte,
  formatHexWord,
  splitUsbPacket,
  USB_PID_BYTES,
  type UsbPacketStructure,
} from './usbPacket';
import {
  decodeDescriptorChain,
  decodeSetupRequest,
  isPossibleDescriptorPayload,
  isPossibleSetupPayload,
  type UsbSetupRequest,
} from './usbDescriptors';

const PROTOCOL_ID = 'usb';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'USB';

const MIN_FRAME_LENGTH = 1;
const PID_OFFSET = 0;
const PAYLOAD_OFFSET = 1;

const ERROR_EMPTY_FRAME = 'protocol.usb.error.emptyFrame';
const ERROR_ABORTED = 'protocol.usb.error.aborted';
const ERROR_PID_CHECK = 'protocol.usb.error.pidCheckFailed';
const ERROR_CRC5 = 'protocol.usb.error.crc5Mismatch';
const ERROR_CRC16 = 'protocol.usb.error.crc16Mismatch';
const ERROR_TOKEN_TRUNCATED = 'protocol.usb.error.tokenTruncated';

const WARNING_SETUP_INFERRED = 'protocol.usb.warning.setupInferred';
const WARNING_DESCRIPTOR_INFERRED = 'protocol.usb.warning.descriptorInferred';
const WARNING_TRAILING_BYTES = 'protocol.usb.warning.trailingBytes';
const WARNING_RESERVED_PID = 'protocol.usb.warning.reservedPid';
const WARNING_SPECIAL_PID = 'protocol.usb.warning.specialPid';

export type UsbFrameMetadata = {
  pid: string;
  pidByte: string;
  pidGroup: string;
  packetKind: string;
  address?: number;
  endpoint?: number;
  frameNumber?: number;
  payloadBytes?: number;
  crcValid?: boolean;
  setupRequest?: string;
  descriptorTypes?: readonly string[];
};

interface UsbParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function field(
  id: string,
  name: string,
  data: Uint8Array,
  offset: number,
  length: number,
  rawValue: number | string,
  physicalValue: string,
  valid = true,
): ParsedField {
  return {
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    rawValue,
    physicalValue,
    valid,
    warnings: [],
  };
}

function setupFields(data: Uint8Array, request: UsbSetupRequest): ParsedField[] {
  const direction = request.directionDeviceToHost ? 'Device-to-host' : 'Host-to-device';
  const requestLabel =
    request.requestName === undefined
      ? formatHexByte(request.bRequest)
      : `${request.requestName} (${formatHexByte(request.bRequest)})`;
  const valueLabel =
    request.descriptorType === undefined
      ? formatHexWord(request.wValue)
      : `${formatHexWord(request.wValue)} · ${request.descriptorType} #${request.descriptorIndex ?? 0}`;

  return [
    field(
      'bmRequestType',
      'bmRequestType',
      data,
      PAYLOAD_OFFSET,
      1,
      request.bmRequestType,
      `${formatHexByte(request.bmRequestType)} · ${direction} · ${request.type} · ${request.recipient}`,
    ),
    field('bRequest', 'bRequest', data, PAYLOAD_OFFSET + 1, 1, request.bRequest, requestLabel),
    field('wValue', 'wValue', data, PAYLOAD_OFFSET + 2, 2, request.wValue, valueLabel),
    field('wIndex', 'wIndex', data, PAYLOAD_OFFSET + 4, 2, request.wIndex, formatHexWord(request.wIndex)),
    field('wLength', 'wLength', data, PAYLOAD_OFFSET + 6, 2, request.wLength, `${request.wLength} B`),
  ];
}

function descriptorFields(data: Uint8Array, payload: Uint8Array): { fields: ParsedField[]; types: string[] } {
  const nodes = decodeDescriptorChain(payload);
  const fields: ParsedField[] = [];
  const types: string[] = [];

  nodes.forEach((node, index) => {
    types.push(node.typeName);
    const base = PAYLOAD_OFFSET + node.offset;
    fields.push(
      field(
        `descriptor${index}`,
        `${node.typeName} Descriptor`,
        data,
        base,
        Math.min(node.bLength, data.length - base),
        node.bDescriptorType,
        `bLength ${node.bLength} · bDescriptorType ${node.bDescriptorType}${node.truncated ? ' · truncated' : ''}`,
        !node.truncated,
      ),
    );
    for (const descriptorField of node.fields) {
      fields.push(
        field(
          `descriptor${index}.${descriptorField.name}`,
          `${node.typeName} · ${descriptorField.name}`,
          data,
          PAYLOAD_OFFSET + descriptorField.offset,
          descriptorField.length,
          descriptorField.value,
          descriptorField.formatted,
        ),
      );
    }
  });

  return { fields, types };
}

function buildFields(
  data: Uint8Array,
  structure: UsbPacketStructure,
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
  metadata: UsbFrameMetadata,
): ParsedField[] {
  const { pid } = structure;
  const fields: ParsedField[] = [
    field(
      'pid',
      'PID',
      data,
      PID_OFFSET,
      1,
      pid.byte,
      `${pid.name} · ${formatBinary(pid.type, 4)} · check ${pid.checkValid ? 'OK' : 'FAIL'}`,
      pid.checkValid,
    ),
  ];

  if (!pid.checkValid) {
    // Spec §8.3.1: check alanı tutmayan PID bozuk kabul edilir ve paketin
    // tamamı yok sayılır. Yapısal çözüm YİNE gösterilir (onewire emsali).
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_PID_CHECK,
      offset: PID_OFFSET,
      length: 1,
      details: { type: pid.type, check: pid.check, expected: ~pid.type & 0x0f },
    });
  }

  if (structure.token !== undefined) {
    const token = structure.token;
    fields.push(
      field(
        'address',
        'Address',
        data,
        PAYLOAD_OFFSET,
        1,
        token.address,
        `${token.address}${token.address === 0 ? ' · default address' : ''}`,
      ),
      // ENDP iki baytın sınırını aşar (ADDR 7 bit + ENDP 4 bit = 11 bit).
      field('endpoint', 'Endpoint', data, PAYLOAD_OFFSET, 2, token.endpoint, `EP${token.endpoint}`),
      field(
        'crc5',
        'CRC5',
        data,
        PAYLOAD_OFFSET + 1,
        1,
        token.crc5,
        `${formatBinary(token.crc5, 5)} · calculated ${formatBinary(token.crc5Calculated, 5)}`,
        token.crc5Valid,
      ),
    );
    metadata.address = token.address;
    metadata.endpoint = token.endpoint;
    metadata.crcValid = token.crc5Valid;
    if (!token.crc5Valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_CRC5,
        offset: PAYLOAD_OFFSET + 1,
        length: 1,
        details: { received: token.crc5, calculated: token.crc5Calculated },
      });
    }
  }

  if (structure.sof !== undefined) {
    const sof = structure.sof;
    fields.push(
      field('frameNumber', 'Frame Number', data, PAYLOAD_OFFSET, 2, sof.frameNumber, `${sof.frameNumber}`),
      field(
        'crc5',
        'CRC5',
        data,
        PAYLOAD_OFFSET + 1,
        1,
        sof.crc5,
        `${formatBinary(sof.crc5, 5)} · calculated ${formatBinary(sof.crc5Calculated, 5)}`,
        sof.crc5Valid,
      ),
    );
    metadata.frameNumber = sof.frameNumber;
    metadata.crcValid = sof.crc5Valid;
    if (!sof.crc5Valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_CRC5,
        offset: PAYLOAD_OFFSET + 1,
        length: 1,
        details: { received: sof.crc5, calculated: sof.crc5Calculated },
      });
    }
  }

  if (structure.data !== undefined) {
    const packet = structure.data;
    const payload = packet.payload;
    metadata.payloadBytes = payload.length;
    metadata.crcValid = packet.crc16Valid;

    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Data',
        offset: PAYLOAD_OFFSET,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }

    // Yükün ne olduğu paketten ÇIKARILIR (usbDescriptors.ts dosya başı) —
    // ikisi de uyarıyla işaretlenir, kesinlik iddia edilmez.
    if (isPossibleSetupPayload(payload)) {
      const request = decodeSetupRequest(payload);
      fields.push(...setupFields(data, request));
      metadata.setupRequest = request.requestName ?? formatHexByte(request.bRequest);
      warnings.push({
        code: 'setup-inferred',
        message: WARNING_SETUP_INFERRED,
        offset: PAYLOAD_OFFSET,
        length: payload.length,
      });
    } else if (isPossibleDescriptorPayload(payload)) {
      const decoded = descriptorFields(data, payload);
      fields.push(...decoded.fields);
      metadata.descriptorTypes = decoded.types;
      warnings.push({
        code: 'descriptor-inferred',
        message: WARNING_DESCRIPTOR_INFERRED,
        offset: PAYLOAD_OFFSET,
        length: payload.length,
      });
    }

    const crcOffset = PAYLOAD_OFFSET + payload.length;
    fields.push(
      field(
        'crc16',
        'CRC16',
        data,
        crcOffset,
        2,
        packet.crc16,
        `${formatHexWord(packet.crc16)} · calculated ${formatHexWord(packet.crc16Calculated)}`,
        packet.crc16Valid,
      ),
    );
    if (!packet.crc16Valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_CRC16,
        offset: crcOffset,
        length: 2,
        details: { received: packet.crc16, calculated: packet.crc16Calculated },
      });
    }
  }

  if (structure.trailingBytes.length > 0) {
    // 11a/11b'nin "veri sessizce kayboluyor" hata sınıfına karşı bekçi: artan
    // baytlar kendi alanına düşer ve uyarı olarak görünür.
    const offset = data.length - structure.trailingBytes.length;
    fields.push({
      id: 'trailing',
      name: 'Unassigned Bytes',
      offset,
      length: structure.trailingBytes.length,
      rawBytes: structure.trailingBytes,
      unit: 'B',
      valid: false,
      warnings: [],
    });
    warnings.push({
      code: 'trailing-bytes',
      message: WARNING_TRAILING_BYTES,
      offset,
      length: structure.trailingBytes.length,
    });
  }

  return fields.sort((left, right) => left.offset - right.offset);
}

function parseUsbFrame(data: Uint8Array, options: UsbParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_EMPTY_FRAME,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const structure = splitUsbPacket(data);
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  const metadata: UsbFrameMetadata = {
    pid: structure.pid.name,
    pidByte: formatHexByte(structure.pid.byte),
    pidGroup: structure.pid.group,
    packetKind: structure.kind,
  };

  // Token/SOF üç bayttan kısaysa alanlar çözülemez — kısmi çözüm yerine hata,
  // çünkü eksik baytlar CRC5'in yerini de kaydırır (uydurma alan üretmez).
  if ((structure.kind === 'token' || structure.kind === 'sof') && structure.lengthMismatch < 0) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TOKEN_TRUNCATED,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: 3 },
    });
  }

  if (structure.pid.name === 'Reserved') {
    warnings.push({ code: 'reserved-pid', message: WARNING_RESERVED_PID, offset: PID_OFFSET, length: 1 });
  } else if (structure.pid.group === 'special') {
    // PRE ve ERR AYNI PID kodunu paylaşır (Table 8-1) — tek paketten hangisi
    // olduğu ÇIKARILAMAZ, SPLIT/PING'in alan çözümü de bu dalgada yok.
    warnings.push({ code: 'special-pid', message: WARNING_SPECIAL_PID, offset: PID_OFFSET, length: 1 });
  }

  const fields = buildFields(data, structure, errors, warnings, metadata);

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
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

export function parseUsb(data: Uint8Array): ParseResult {
  return parseUsbFrame(data, {});
}

export const usbParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * PID'in check alanı (üst nibble = alt nibble'ın tümleyeni) USB'ye özgü,
   * bayt seviyesinde gerçek bir imza — I²C/SMBus'ın aksine burada ayırt edici
   * bir kontrol YAPILABİLİR (spec §8.3.1).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    const byte = data[0] ?? 0;
    return ((byte >> 4) & 0x0f) === (~byte & 0x0f);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: UsbParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseUsbFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. CRC'lerin HİÇBİRİ elle yazılmadı — `buildTokenPacket` /
 * `buildSofPacket` / `buildDataPacket` bağımsızca hesaplıyor (1-Wire ROM
 * CRC'sindeki disiplin).
 *
 * Cihaz tanımlayıcısı spec ÖZETİNİN KENDİ örneği: VID 0x0483, PID 0x5740,
 * CDC sınıfı, Endpoint IN 0x81 / OUT 0x01 (`01-fiziksel-arayuzler.md:374`).
 * Sınıf kodu CDC için 0x02 (spec özeti "Class CDC" diyor, sayıyı vermiyor —
 * USB-IF'in yayımlı Communications Device Class kodu).
 */
const GET_DESCRIPTOR_SETUP = Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);

const DEVICE_DESCRIPTOR = Uint8Array.from([
  0x12, 0x01, 0x00, 0x02, 0x02, 0x00, 0x00, 0x40, 0x83, 0x04, 0x40, 0x57, 0x00, 0x02, 0x01, 0x02,
  0x03, 0x01,
]);

/** Configuration + Interface + Endpoint IN + Endpoint OUT zinciri (§9.4.3). */
const CONFIGURATION_CHAIN = Uint8Array.from([
  0x09, 0x02, 0x20, 0x00, 0x01, 0x01, 0x00, 0x80, 0x32, // Configuration, 32 B toplam, 100 mA
  0x09, 0x04, 0x00, 0x00, 0x02, 0x0a, 0x00, 0x00, 0x00, // Interface, 2 endpoint, CDC Data
  0x07, 0x05, 0x81, 0x02, 0x40, 0x00, 0x00, // Endpoint IN 0x81, Bulk, 64 B
  0x07, 0x05, 0x01, 0x02, 0x40, 0x00, 0x00, // Endpoint OUT 0x01, Bulk, 64 B
]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'setup-token',
    name: 'protocol.usb.example.setupToken.name',
    bytes: buildTokenPacket(USB_PID_BYTES.SETUP, 0, 0),
    description: 'protocol.usb.example.setupToken.description',
    expectedValid: true,
  },
  {
    id: 'in-token',
    name: 'protocol.usb.example.inToken.name',
    bytes: buildTokenPacket(USB_PID_BYTES.IN, 0x3a, 0x0a),
    description: 'protocol.usb.example.inToken.description',
    expectedValid: true,
  },
  {
    id: 'sof',
    name: 'protocol.usb.example.sof.name',
    bytes: buildSofPacket(USB_PID_BYTES.SOF, 0x64),
    description: 'protocol.usb.example.sof.description',
    expectedValid: true,
  },
  {
    id: 'setup-data',
    name: 'protocol.usb.example.setupData.name',
    bytes: buildDataPacket(USB_PID_BYTES.DATA0, GET_DESCRIPTOR_SETUP),
    description: 'protocol.usb.example.setupData.description',
    expectedValid: true,
  },
  {
    id: 'device-descriptor',
    name: 'protocol.usb.example.deviceDescriptor.name',
    bytes: buildDataPacket(USB_PID_BYTES.DATA1, DEVICE_DESCRIPTOR),
    description: 'protocol.usb.example.deviceDescriptor.description',
    expectedValid: true,
  },
  {
    id: 'configuration-descriptor',
    name: 'protocol.usb.example.configurationDescriptor.name',
    bytes: buildDataPacket(USB_PID_BYTES.DATA0, CONFIGURATION_CHAIN),
    description: 'protocol.usb.example.configurationDescriptor.description',
    expectedValid: true,
  },
  {
    id: 'ack',
    name: 'protocol.usb.example.ack.name',
    bytes: Uint8Array.from([USB_PID_BYTES.ACK]),
    description: 'protocol.usb.example.ack.description',
    expectedValid: true,
  },
  {
    id: 'bad-crc16',
    name: 'protocol.usb.example.badCrc.name',
    // Son bayt kasten bozuldu: CRC16 hatasının nasıl göründüğünü gösterir.
    bytes: (() => {
      const packet = buildDataPacket(USB_PID_BYTES.DATA0, GET_DESCRIPTOR_SETUP);
      const broken = Uint8Array.from(packet);
      broken[broken.length - 1] = (broken[broken.length - 1] ?? 0) ^ 0xff;
      return broken;
    })(),
    description: 'protocol.usb.example.badCrc.description',
    expectedValid: false,
  },
];

export const usbPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: usbParser,
  documentation: {
    summary: 'protocol.usb.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
