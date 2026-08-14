/**
 * ISO 15765-2 (ISO-TP) — CAN üzerinde segmentli tanı mesajlaşmasının taşıma katmanı.
 *
 * Girdi J1939/CAN 2.0 ile AYNI SocketCAN `struct can_frame` kaydıdır (bkz.
 * `canFrame.ts` dosya başı) — ISO-TP ayrı bir tel biçimi değildir, CAN payload'ının
 * ilk baytı(ları) PCI (Protocol Control Information) olarak yorumlanır.
 *
 * ── PCI TİPLERİ (spec özet 04-otomotiv.md:223-226, nibble eşlemesi birebir) ──
 *   Üst nibble  0x0 Single Frame · 0x1 First Frame · 0x2 Consecutive Frame ·
 *               0x3 Flow Control
 *
 * Dördü de PCI baytının ANLAMINI verir; 12-bit FF_DL'in iki bayta nasıl
 * dağıldığı ve SN'nin alt nibble'da taşındığı ISO 15765-2'nin kendi çerçeveleme
 * kuralıdır (spec bu kadarını çerçeve düzeyinde zaten örnekliyor: SF `02 10 01`
 * → SF_DL 2 (özet 04:228); FF `10 14 …` → FF_DL 20 (özet 04:230)).
 *
 * ── KAPSAM DIŞI (bilinçli, karar turunda sonuçlandırıldı) ───────────────────
 * • OTURUM/DURUM MAKİNESİ: spec DoIP için "state machine tutulmalı" diyor
 *   (ana dok. ~12763-12775), ISO-TP için bu cümleyi HİÇ kurmuyor — bilinçli
 *   fark. Tek çerçeve parser'ı çok çerçeveli oturum tutamaz; SN sıra doğrulaması,
 *   BS/STmin'e göre bekleme, FF+CF birleştirme analyzer katmanının işidir.
 *   J1939 TP ile aynı desen (bkz. `j1939.ts` dosya başı, `WARN_TRANSPORT_SESSION`).
 * • STmin KODLAMASI: 0x00-0x7F → ms, 0xF1-0xF9 → 100µs katları tablosu spec'te
 *   YOK (grep sıfır). STmin bu yüzden HAM BAYT olarak gösterilir, ms/µs'ye
 *   çevrilmez — çevirmek uydurma olurdu.
 * • FF_DL ESCAPE (0x00 + 32-bit uzun uzunluk, CAN FD): spec 4095 sınırını hiç
 *   vermiyor; yalnız klasik 12-bit FF_DL çözülür.
 *
 * TUZAK — UDS/OBD-II BU DOSYAYI ÇAĞIRMAZ: girdileri CAN çerçevesi DEĞİL, ham
 * PDU baytıdır (SID+parametre / mod+PID+veri). Zinciri parser katmanında
 * kurmak oturum durumu ister — J1939'da reddedilenin aynısı. Üç motor bağımsız
 * PDU/çerçeve sözleşmesiyle çalışır (karar turu, brief-faz10-dalga1.md).
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

import { buildCanClassicFrame } from '../can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../can/canFrame';

const PROTOCOL_ID = 'iso-tp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ISO-TP';

const DLC_OFFSET = 4;
/** Payload'ın CAN başlığından sonraki ilk baytı — PCI her zaman burada başlar. */
const PCI_BYTE_OFFSET = CAN_HEADER_LENGTH;
const PCI_TYPE_SHIFT = 4;
const NIBBLE_MASK = 0x0f;

const PCI_TYPE_SINGLE_FRAME = 0x0;
const PCI_TYPE_FIRST_FRAME = 0x1;
const PCI_TYPE_CONSECUTIVE_FRAME = 0x2;
const PCI_TYPE_FLOW_CONTROL = 0x3;

/** Classic CAN'de payload azami 8 bayt; SF/CF bir PCI baytı düşer, FF iki. */
const CLASSIC_MAX_PAYLOAD = 8;
const SF_PCI_LENGTH = 1;
const FF_PCI_LENGTH = 2;

const FLOW_STATUS_LABELS: ReadonlyMap<number, string> = new Map([
  [0x0, 'Continue To Send'],
  [0x1, 'Wait'],
  [0x2, 'Overflow'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.isotp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.isotp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.isotp.error.aborted';
const ERROR_MISSING_PCI = 'protocol.isotp.error.missingPci';
const ERROR_INCOMPLETE_FF_PCI = 'protocol.isotp.error.incompleteFirstFramePci';
const ERROR_UNKNOWN_PCI_TYPE = 'protocol.isotp.error.unknownPciType';

const WARN_REMOTE_FRAME = 'protocol.isotp.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.isotp.warning.truncatedPayload';
const WARN_TRUNCATED_SF_DATA = 'protocol.isotp.warning.truncatedSingleFrameData';
const WARN_TRANSPORT_SESSION = 'protocol.isotp.warning.transportSession';
const WARN_UNKNOWN_FLOW_STATUS = 'protocol.isotp.warning.unknownFlowStatus';

const SUMMARY_SINGLE_FRAME = 'protocol.isotp.summary.singleFrame';
const SUMMARY_FIRST_FRAME = 'protocol.isotp.summary.firstFrame';
const SUMMARY_CONSECUTIVE_FRAME = 'protocol.isotp.summary.consecutiveFrame';
const SUMMARY_FLOW_CONTROL = 'protocol.isotp.summary.flowControl';
const SUMMARY_UNKNOWN_PCI_TYPE = 'protocol.isotp.summary.unknownPciType';

export type IsoTpFrameType = 'single-frame' | 'first-frame' | 'consecutive-frame' | 'flow-control';

export type IsoTpFrameMetadata = {
  pciType: number;
  frameType: IsoTpFrameType | undefined;
  payloadLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

interface IsoTpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** PCI baytından sonraki bölgeyi "Data" alanı olarak ekler — boşsa hiçbir şey eklemez. */
function pushDataField(fields: ParsedField[], data: Uint8Array, offset: number, length: number): void {
  if (length <= 0) return;
  fields.push({
    id: 'data',
    name: 'Data',
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    unit: 'B',
    valid: true,
    warnings: [],
  });
}

interface ShapeResult {
  frameType: IsoTpFrameType | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
}

function decodeSingleFrame(
  data: Uint8Array,
  payloadLength: number,
  pciByte: number,
  pciTypeField: ParsedField,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  pciTypeField.physicalValue = 'Single Frame';
  fields.push(pciTypeField);

  const sfDl = pciByte & NIBBLE_MASK;
  fields.push({
    id: 'sf-dl',
    name: 'SF_DL',
    offset: PCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(PCI_BYTE_OFFSET, PCI_BYTE_OFFSET + 1),
    rawValue: sfDl,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const availableAfterPci = Math.max(0, payloadLength - SF_PCI_LENGTH);
  const dataLength = Math.min(sfDl, availableAfterPci);
  if (dataLength < sfDl) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_SF_DATA));
  }
  pushDataField(fields, data, PCI_BYTE_OFFSET + SF_PCI_LENGTH, dataLength);

  return {
    frameType: 'single-frame',
    summaryKey: SUMMARY_SINGLE_FRAME,
    summaryParams: { sfDl: String(sfDl) },
  };
}

function decodeFirstFrame(
  data: Uint8Array,
  payloadLength: number,
  pciByte: number,
  pciTypeField: ParsedField,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  pciTypeField.physicalValue = 'First Frame';
  fields.push(pciTypeField);
  warnings.push(toProtocolWarning(WARN_TRANSPORT_SESSION));

  const summaryParams: Record<string, string> = {};
  if (payloadLength < FF_PCI_LENGTH) {
    // İkinci PCI baytı (FF_DL'in alt sekiz biti) yok — uzunluk çözülemez.
    errors.push({
      code: 'truncated-frame',
      message: ERROR_INCOMPLETE_FF_PCI,
      offset: PCI_BYTE_OFFSET,
      length: payloadLength,
    });
  } else {
    const ffDl = ((pciByte & NIBBLE_MASK) << 8) | byteAt(data, PCI_BYTE_OFFSET + 1);
    fields.push({
      id: 'ff-dl',
      name: 'FF_DL',
      offset: PCI_BYTE_OFFSET,
      length: FF_PCI_LENGTH,
      rawBytes: data.slice(PCI_BYTE_OFFSET, PCI_BYTE_OFFSET + FF_PCI_LENGTH),
      rawValue: ffDl,
      unit: 'B',
      valid: true,
      warnings: [],
    });
    summaryParams.ffDl = String(ffDl);

    const dataLength = Math.max(0, payloadLength - FF_PCI_LENGTH);
    pushDataField(fields, data, PCI_BYTE_OFFSET + FF_PCI_LENGTH, dataLength);
  }

  return { frameType: 'first-frame', summaryKey: SUMMARY_FIRST_FRAME, summaryParams };
}

function decodeConsecutiveFrame(
  data: Uint8Array,
  payloadLength: number,
  pciByte: number,
  pciTypeField: ParsedField,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  pciTypeField.physicalValue = 'Consecutive Frame';
  fields.push(pciTypeField);
  warnings.push(toProtocolWarning(WARN_TRANSPORT_SESSION));

  const sequenceNumber = pciByte & NIBBLE_MASK;
  fields.push({
    id: 'sequence-number',
    name: 'SN',
    offset: PCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(PCI_BYTE_OFFSET, PCI_BYTE_OFFSET + 1),
    rawValue: sequenceNumber,
    valid: true,
    warnings: [],
  });

  const dataLength = Math.max(0, payloadLength - SF_PCI_LENGTH);
  pushDataField(fields, data, PCI_BYTE_OFFSET + SF_PCI_LENGTH, dataLength);

  return {
    frameType: 'consecutive-frame',
    summaryKey: SUMMARY_CONSECUTIVE_FRAME,
    summaryParams: { sequenceNumber: String(sequenceNumber) },
  };
}

function decodeFlowControl(
  data: Uint8Array,
  payloadLength: number,
  pciByte: number,
  pciTypeField: ParsedField,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  pciTypeField.physicalValue = 'Flow Control';
  fields.push(pciTypeField);
  warnings.push(toProtocolWarning(WARN_TRANSPORT_SESSION));

  const flowStatus = pciByte & NIBBLE_MASK;
  const flowStatusLabel = FLOW_STATUS_LABELS.get(flowStatus);
  const fsField: ParsedField = {
    id: 'flow-status',
    name: 'FS',
    offset: PCI_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(PCI_BYTE_OFFSET, PCI_BYTE_OFFSET + 1),
    rawValue: flowStatus,
    valid: flowStatusLabel !== undefined,
    warnings: [],
  };
  if (flowStatusLabel !== undefined) {
    fsField.physicalValue = flowStatusLabel;
  } else {
    fsField.warnings.push(WARN_UNKNOWN_FLOW_STATUS);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_FLOW_STATUS));
  }
  fields.push(fsField);

  const summaryParams: Record<string, string> = {
    flowStatus: flowStatusLabel ?? String(flowStatus),
  };

  if (payloadLength >= 2) {
    const blockSize = byteAt(data, PCI_BYTE_OFFSET + 1);
    fields.push({
      id: 'block-size',
      name: 'BS',
      offset: PCI_BYTE_OFFSET + 1,
      length: 1,
      rawBytes: data.slice(PCI_BYTE_OFFSET + 1, PCI_BYTE_OFFSET + 2),
      rawValue: blockSize,
      valid: true,
      warnings: [],
    });
    summaryParams.blockSize = String(blockSize);
  }

  if (payloadLength >= 3) {
    // STmin kasten HAM BAYT: ms/0.1ms kodlama tablosu spec'te yok (dosya başı).
    const separationTime = byteAt(data, PCI_BYTE_OFFSET + 2);
    fields.push({
      id: 'separation-time',
      name: 'STmin',
      offset: PCI_BYTE_OFFSET + 2,
      length: 1,
      rawBytes: data.slice(PCI_BYTE_OFFSET + 2, PCI_BYTE_OFFSET + 3),
      rawValue: separationTime,
      valid: true,
      warnings: [],
    });
  }

  return { frameType: 'flow-control', summaryKey: SUMMARY_FLOW_CONTROL, summaryParams };
}

function decodeUnknownPciType(
  data: Uint8Array,
  payloadLength: number,
  pciType: number,
  pciTypeField: ParsedField,
  fields: ParsedField[],
  errors: ProtocolError[],
): ShapeResult {
  pciTypeField.valid = false;
  pciTypeField.warnings.push(ERROR_UNKNOWN_PCI_TYPE);
  fields.push(pciTypeField);
  errors.push({
    code: 'value-out-of-range',
    message: ERROR_UNKNOWN_PCI_TYPE,
    offset: PCI_BYTE_OFFSET,
    length: 1,
    details: { pciType },
  });

  const dataLength = Math.max(0, payloadLength - SF_PCI_LENGTH);
  pushDataField(fields, data, PCI_BYTE_OFFSET + SF_PCI_LENGTH, dataLength);

  return { frameType: undefined, summaryKey: SUMMARY_UNKNOWN_PCI_TYPE, summaryParams: {} };
}

function parseIsoTpFrame(data: Uint8Array, options: IsoTpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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

  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: 0,
    length: 4,
    rawBytes: data.slice(0, 4),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: true,
    warnings: [],
  });

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, CLASSIC_MAX_PAYLOAD, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (identity.remote) {
    warnings.push(toProtocolWarning(WARN_REMOTE_FRAME));
  }
  if (payloadLength < Math.min(declaredLength, CLASSIC_MAX_PAYLOAD)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  let shape: ShapeResult;
  if (payloadLength === 0) {
    // PCI baytı yok: ISO-TP çözülemez ama çerçeve yine gösterilir (spec §47).
    errors.push({
      code: 'truncated-frame',
      message: ERROR_MISSING_PCI,
      offset: CAN_HEADER_LENGTH,
      length: 0,
    });
    shape = { frameType: undefined, summaryKey: SUMMARY_UNKNOWN_PCI_TYPE, summaryParams: {} };
  } else {
    const pciByte = byteAt(data, PCI_BYTE_OFFSET);
    const pciType = (pciByte >>> PCI_TYPE_SHIFT) & NIBBLE_MASK;
    const pciTypeField: ParsedField = {
      id: 'pci-type',
      name: 'PCI Type',
      offset: PCI_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PCI_BYTE_OFFSET, PCI_BYTE_OFFSET + 1),
      rawValue: pciType,
      valid: true,
      warnings: [],
    };

    switch (pciType) {
      case PCI_TYPE_SINGLE_FRAME:
        shape = decodeSingleFrame(data, payloadLength, pciByte, pciTypeField, fields, warnings);
        break;
      case PCI_TYPE_FIRST_FRAME:
        shape = decodeFirstFrame(
          data,
          payloadLength,
          pciByte,
          pciTypeField,
          fields,
          warnings,
          errors,
        );
        break;
      case PCI_TYPE_CONSECUTIVE_FRAME:
        shape = decodeConsecutiveFrame(data, payloadLength, pciByte, pciTypeField, fields, warnings);
        break;
      case PCI_TYPE_FLOW_CONTROL:
        shape = decodeFlowControl(data, payloadLength, pciByte, pciTypeField, fields, warnings);
        break;
      default:
        shape = decodeUnknownPciType(data, payloadLength, pciType, pciTypeField, fields, errors);
        break;
    }
  }

  const summaryParams: Record<string, string> = {
    canId: identity.id.toString(16).toUpperCase(),
    payloadLength: String(payloadLength),
    ...shape.summaryParams,
  };

  const metadata: IsoTpFrameMetadata = {
    pciType: payloadLength > 0 ? (byteAt(data, PCI_BYTE_OFFSET) >>> PCI_TYPE_SHIFT) & NIBBLE_MASK : -1,
    frameType: shape.frameType,
    payloadLength,
    summaryKey: shape.summaryKey,
    summaryParams,
  };

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

export function parseIsoTp(data: Uint8Array): ParseResult {
  return parseIsoTpFrame(data, {});
}

export const isoTpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: uzunluk aralığı + PCI tipinin tanınan dört değerden biri olması. */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
      return false;
    }
    const declaredLength = byteAt(data, DLC_OFFSET);
    const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
    const payloadLength = Math.min(declaredLength, CLASSIC_MAX_PAYLOAD, availableAfterHeader);
    if (payloadLength === 0) return false;
    const pciType = (byteAt(data, PCI_BYTE_OFFSET) >>> PCI_TYPE_SHIFT) & NIBBLE_MASK;
    return pciType <= PCI_TYPE_FLOW_CONTROL;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: IsoTpParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseIsoTpFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. Kimlik (0x7A1) gösterim amaçlıdır — ISO-TP'nin PCI çözümü
 * kimlikten bağımsızdır (CAN 2.0 örneklerindeki 0x120/0x321 ile aynı gerekçe).
 * SF ve FF'in uzunluk değerleri spec özetinin metin içi örneklerinden alındı
 * (özet 04-otomotiv.md:228, :230); dolgu baytları göstermelik veridir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'single-frame',
    name: 'protocol.isotp.example.singleFrame.name',
    // Spec özet 04:228: PCI 0x02 → SF_DL 2, veri 10 01.
    bytes: buildCanClassicFrame(0x7a1, [0x02, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00], {
      extended: true,
    }),
    description: 'protocol.isotp.example.singleFrame.description',
    expectedValid: true,
  },
  {
    id: 'first-frame',
    name: 'protocol.isotp.example.firstFrame.name',
    // Spec özet 04:230: PCI 0x10 0x14 → FF_DL 20 bayt. Kalan altı bayt göstermelik.
    bytes: buildCanClassicFrame(
      0x7a1,
      [0x10, 0x14, 0x49, 0x02, 0x01, 0x00, 0x00, 0x00],
      { extended: true },
    ),
    description: 'protocol.isotp.example.firstFrame.description',
    expectedValid: true,
  },
  {
    id: 'consecutive-frame',
    name: 'protocol.isotp.example.consecutiveFrame.name',
    // PCI 0x21 → SN 1, yedi bayt veri.
    bytes: buildCanClassicFrame(
      0x7a1,
      [0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      { extended: true },
    ),
    description: 'protocol.isotp.example.consecutiveFrame.description',
    expectedValid: true,
  },
  {
    id: 'flow-control-continue',
    name: 'protocol.isotp.example.flowControlContinue.name',
    // PCI 0x30 → FS 0 (Continue To Send), BS 0x00 (sınırsız), STmin ham 0x0A.
    bytes: buildCanClassicFrame(0x7a1, [0x30, 0x00, 0x0a], { extended: true }),
    description: 'protocol.isotp.example.flowControlContinue.description',
    expectedValid: true,
  },
  {
    id: 'single-frame-truncated',
    name: 'protocol.isotp.example.singleFrameTruncated.name',
    // SF_DL 7 vaat ediyor ama yalnız üç bayt veri var — uyarı yolu.
    bytes: buildCanClassicFrame(0x7a1, [0x07, 0x11, 0x22, 0x33], { extended: true }),
    description: 'protocol.isotp.example.singleFrameTruncated.description',
    expectedValid: true,
  },
  {
    id: 'unknown-pci-type-rejected',
    name: 'protocol.isotp.example.unknownPciTypeRejected.name',
    // Üst nibble 0xF: ISO-TP'nin dört PCI tipinden hiçbiri değil.
    bytes: buildCanClassicFrame(0x7a1, [0xf0, 0x01, 0x02], { extended: true }),
    description: 'protocol.isotp.example.unknownPciTypeRejected.description',
    expectedValid: false,
  },
];

export const isoTpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: isoTpParser,
  documentation: {
    summary: 'protocol.isotp.documentation.summary',
    layer: 'transport',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
