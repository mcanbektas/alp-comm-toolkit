/**
 * ISO 14229 UDS (Unified Diagnostic Services) — servis kimliği ve pozitif/negatif
 * yanıt zarfının çözümü.
 *
 * GİRDİ CAN ÇERÇEVESİ DEĞİLDİR: ham UDS PDU baytıdır (SID + parametreler,
 * ör. `22 F1 90`). ISO-TP'nin çok çerçeveli birleştirmesi analyzer katmanının
 * işi olarak bırakıldığı için (bkz. `isotp.ts` dosya başı) UDS/OBD-II zinciri
 * parser seviyesinde CAN'e bağlanmaz — üç motor bağımsız PDU/çerçeve
 * sözleşmesiyle çalışır (karar turu, brief-faz10-dalga1.md). Kullanıcı bu
 * sayfaya ham CAN çerçevesi yapıştırırsa çözülmez; bedel bilinçli kabul edildi.
 *
 * ── SID/YANIT AYRIMI KENDİ BAYT DEĞERİNDEDİR ─────────────────────────────────
 * Modbus'un aksine (aynı function code hem istekte hem yanıtta görünür, rol
 * gövde şeklinden TAHMİN edilir) UDS'de rol belirsiz DEĞİLDİR:
 *   • byte0 == 0x7F                        → Negatif yanıt (sabit işaretçi)
 *   • byte0 == SID + 0x40, SID tabloda      → Pozitif yanıt
 *   • byte0 tabloda                        → İstek
 * Bu yüzden Modbus'taki "roleInferred" uyarı deseni burada YOK — gerek yok.
 *
 * ── SID TABLOSU (spec özet 04/10, 14 servis) ─────────────────────────────────
 * Spec'in kendi başlığı "belgedeki TEMEL servisler" — ISO 14229'un tamamı
 * değil, spec'in verdiği bu 14 kod BİREBİR taşınır, eklenmez.
 *
 * ── KAPSAM DIŞI (bilinçli) ───────────────────────────────────────────────────
 * • NRC TABLOSU: spec'te tüm dokümanda TEK örnek var (`7F 22 31` → 0x31 Request
 *   Out Of Range). Tam NRC tablosu ISO 14229'un normatif gövdesindedir ve bu
 *   depo spec'i onu vermiyor; NRC bu yüzden HAM BAYT kalır, `spnNeedsDatabase`
 *   ile aynı gerekçeyle uyarılır (J1939 deseni, `j1939.ts`).
 * • SERVİS PARAMETRE GÖVDESİ: her servisin kendi alt-fonksiyon/veri düzeni
 *   (ör. Security Access seed uzunluğu, ReadDataByIdentifier DID genişliği)
 *   spec'te YOK. Parametre baytları tek ham blok olarak gösterilir — J1939'un
 *   SPN'i ham bırakmasıyla aynı gerekçe.
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

const PROTOCOL_ID = 'uds';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'UDS';

const NEGATIVE_RESPONSE_SID = 0x7f;
const POSITIVE_RESPONSE_OFFSET = 0x40;

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

const ERROR_EMPTY_PDU = 'protocol.uds.error.emptyPdu';
const ERROR_INCOMPLETE_NEGATIVE_RESPONSE = 'protocol.uds.error.incompleteNegativeResponse';
const ERROR_FRAME_TOO_LONG = 'protocol.uds.error.frameTooLong';
const ERROR_ABORTED = 'protocol.uds.error.aborted';

const WARN_UNKNOWN_SID = 'protocol.uds.warning.unknownSid';
const WARN_NRC_NEEDS_DATABASE = 'protocol.uds.warning.nrcNeedsDatabase';
const WARN_TRAILING_BYTES = 'protocol.uds.warning.trailingBytes';

const SUMMARY_REQUEST = 'protocol.uds.summary.request';
const SUMMARY_POSITIVE_RESPONSE = 'protocol.uds.summary.positiveResponse';
const SUMMARY_NEGATIVE_RESPONSE = 'protocol.uds.summary.negativeResponse';

export interface UdsServiceInfo {
  readonly sid: number;
  /** Protokol terimi — veridir, çevrilmez (CLAUDE.md). */
  readonly name: string;
}

/**
 * Spec özet 04-otomotiv.md:248-261 ve 10-uygulama-spec.md:683-696 — üç yerde
 * birebir aynı liste, "belgedeki temel servisler" başlığıyla. ISO 14229'un
 * TAMAMI değil; ekleme/çıkarma yapılmaz.
 */
export const UDS_SERVICES: readonly UdsServiceInfo[] = [
  { sid: 0x10, name: 'Diagnostic Session Control' },
  { sid: 0x11, name: 'ECU Reset' },
  { sid: 0x14, name: 'Clear Diagnostic Information' },
  { sid: 0x19, name: 'Read DTC Information' },
  { sid: 0x22, name: 'Read Data By Identifier' },
  { sid: 0x27, name: 'Security Access' },
  { sid: 0x28, name: 'Communication Control' },
  { sid: 0x2e, name: 'Write Data By Identifier' },
  { sid: 0x31, name: 'Routine Control' },
  { sid: 0x34, name: 'Request Download' },
  { sid: 0x36, name: 'Transfer Data' },
  { sid: 0x37, name: 'Request Transfer Exit' },
  { sid: 0x3e, name: 'Tester Present' },
  { sid: 0x85, name: 'Control DTC Setting' },
];

const SERVICE_INDEX: ReadonlyMap<number, UdsServiceInfo> = new Map(
  UDS_SERVICES.map((info) => [info.sid, info]),
);

export function getUdsServiceInfo(sid: number): UdsServiceInfo | undefined {
  return SERVICE_INDEX.get(sid);
}

export type UdsMessageRole = 'request' | 'positive-response' | 'negative-response';

export type UdsFrameMetadata = {
  sid: number;
  role: UdsMessageRole;
  serviceName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, '0')}`;
}

interface UdsParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface ShapeResult {
  role: UdsMessageRole;
  summaryKey: string;
  summaryParams: Record<string, string>;
}

function decodeNegativeResponse(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ShapeResult {
  fields.push({
    id: 'response-code',
    name: 'Response Code',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: NEGATIVE_RESPONSE_SID,
    physicalValue: 'Negative Response',
    valid: true,
    warnings: [],
  });

  const summaryParams: Record<string, string> = {};

  if (data.length < 2) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_INCOMPLETE_NEGATIVE_RESPONSE,
      offset: 1,
      length: 0,
    });
    return { role: 'negative-response', summaryKey: SUMMARY_NEGATIVE_RESPONSE, summaryParams };
  }

  const originalSid = byteAt(data, 1);
  const originalInfo = getUdsServiceInfo(originalSid);
  const originalSidField: ParsedField = {
    id: 'original-sid',
    name: 'Original SID',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: originalSid,
    valid: originalInfo !== undefined,
    warnings: [],
  };
  if (originalInfo !== undefined) {
    originalSidField.physicalValue = originalInfo.name;
  } else {
    originalSidField.warnings.push(WARN_UNKNOWN_SID);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_SID));
  }
  fields.push(originalSidField);
  summaryParams.originalSid = formatHexByte(originalSid);

  if (data.length < 3) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_INCOMPLETE_NEGATIVE_RESPONSE,
      offset: 2,
      length: 0,
    });
    return { role: 'negative-response', summaryKey: SUMMARY_NEGATIVE_RESPONSE, summaryParams };
  }

  const nrc = byteAt(data, 2);
  fields.push({
    id: 'nrc',
    name: 'NRC',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: nrc,
    valid: true,
    warnings: [],
  });
  // Tam NRC tablosu spec'te yok — ham gösterip sebebini söylemek, uydurma
  // anlam basmaktan doğrudur (J1939'un spnNeedsDatabase deseni).
  warnings.push(toProtocolWarning(WARN_NRC_NEEDS_DATABASE));
  summaryParams.nrc = formatHexByte(nrc);

  if (data.length > 3) {
    const trailing = data.slice(3);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: 3,
      length: trailing.length,
      rawBytes: trailing,
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  return { role: 'negative-response', summaryKey: SUMMARY_NEGATIVE_RESPONSE, summaryParams };
}

function decodeRequestOrPositiveResponse(
  data: Uint8Array,
  sidByte: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): ShapeResult {
  const isPositiveResponse =
    sidByte >= POSITIVE_RESPONSE_OFFSET &&
    getUdsServiceInfo(sidByte - POSITIVE_RESPONSE_OFFSET) !== undefined;
  const serviceSid = isPositiveResponse ? sidByte - POSITIVE_RESPONSE_OFFSET : sidByte;
  const info = getUdsServiceInfo(serviceSid);

  const sidField: ParsedField = {
    id: 'sid',
    name: 'SID',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: sidByte,
    valid: info !== undefined,
    warnings: [],
  };
  if (info !== undefined) {
    sidField.physicalValue = info.name;
  } else {
    sidField.warnings.push(WARN_UNKNOWN_SID);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_SID));
  }
  fields.push(sidField);

  const parameterLength = data.length - 1;
  if (parameterLength > 0) {
    fields.push({
      id: 'parameters',
      name: 'Parameters',
      offset: 1,
      length: parameterLength,
      rawBytes: data.slice(1),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const summaryParams: Record<string, string> = { sid: formatHexByte(sidByte) };
  if (info !== undefined) {
    summaryParams.serviceName = info.name;
  }

  return {
    role: isPositiveResponse ? 'positive-response' : 'request',
    summaryKey: isPositiveResponse ? SUMMARY_POSITIVE_RESPONSE : SUMMARY_REQUEST,
    summaryParams,
  };
}

function parseUdsFrame(data: Uint8Array, options: UdsParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_PDU, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  // UDS PDU'sunun CAN gibi sabit bir zarfı yok; azami uzunluk yalnız çağıran
  // isterse uygulanır (spec §41 — bozuk uzunluk alanı yok, bu yüzden varsayılan
  // sabit sınır dayatılmaz).
  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const sidByte = byteAt(data, 0);
  const shape =
    sidByte === NEGATIVE_RESPONSE_SID
      ? decodeNegativeResponse(data, fields, warnings, errors)
      : decodeRequestOrPositiveResponse(data, sidByte, fields, warnings);

  const metadata: UdsFrameMetadata = {
    sid: sidByte,
    role: shape.role,
    serviceName: shape.summaryParams.serviceName,
    summaryKey: shape.summaryKey,
    summaryParams: shape.summaryParams,
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

export function parseUds(data: Uint8Array): ParseResult {
  return parseUdsFrame(data, {});
}

export const udsParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: ilk bayt 0x7F ya da tanınan bir SID/pozitif-yanıt kodu olmalı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < 1) return false;
    const sidByte = byteAt(data, 0);
    if (sidByte === NEGATIVE_RESPONSE_SID) return true;
    if (getUdsServiceInfo(sidByte) !== undefined) return true;
    return (
      sidByte >= POSITIVE_RESPONSE_OFFSET &&
      getUdsServiceInfo(sidByte - POSITIVE_RESPONSE_OFFSET) !== undefined
    );
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: UdsParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseUdsFrame(data, options);
  },
};

/**
 * Örnek PDU'lar. `readDataByIdentifierRequest` ve `negativeResponse` spec'in
 * BİREBİR verdiği örneklerdir (özet 04-otomotiv.md:263-265: `22 F1 90` →
 * ReadDataByIdentifier DID 0xF190; `7F 22 31` → NRC 0x31 Request Out Of Range).
 * Diğerleri SID tablosunun tutarlı kullanımını gösterir, spec kaynaklı değildir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-data-by-identifier-request',
    name: 'protocol.uds.example.readDataByIdentifierRequest.name',
    // Spec özet 04:263: 22 F1 90 → Read Data By Identifier, DID 0xF190 (VIN).
    bytes: new Uint8Array([0x22, 0xf1, 0x90]),
    description: 'protocol.uds.example.readDataByIdentifierRequest.description',
    expectedValid: true,
  },
  {
    id: 'read-data-by-identifier-positive-response',
    name: 'protocol.uds.example.readDataByIdentifierPositiveResponse.name',
    // 0x62 = 0x22 + 0x40: isteğin pozitif yanıtı, aynı DID'i yankılar.
    bytes: new Uint8Array([0x62, 0xf1, 0x90, 0x31, 0x46, 0x4d]),
    description: 'protocol.uds.example.readDataByIdentifierPositiveResponse.description',
    expectedValid: true,
  },
  {
    id: 'negative-response-request-out-of-range',
    name: 'protocol.uds.example.negativeResponseRequestOutOfRange.name',
    // Spec özet 04:265: 7F 22 31 → NRC 0x31 Request Out Of Range.
    bytes: new Uint8Array([0x7f, 0x22, 0x31]),
    description: 'protocol.uds.example.negativeResponseRequestOutOfRange.description',
    expectedValid: true,
  },
  {
    id: 'tester-present-request',
    name: 'protocol.uds.example.testerPresentRequest.name',
    bytes: new Uint8Array([0x3e, 0x00]),
    description: 'protocol.uds.example.testerPresentRequest.description',
    expectedValid: true,
  },
  {
    id: 'unknown-sid',
    name: 'protocol.uds.example.unknownSid.name',
    bytes: new Uint8Array([0x99, 0x01]),
    description: 'protocol.uds.example.unknownSid.description',
    expectedValid: true,
  },
  {
    id: 'negative-response-truncated',
    name: 'protocol.uds.example.negativeResponseTruncated.name',
    // NRC baytı eksik: yalnız 0x7F ve orijinal SID var.
    bytes: new Uint8Array([0x7f, 0x22]),
    description: 'protocol.uds.example.negativeResponseTruncated.description',
    expectedValid: false,
  },
];

export const udsPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: udsParser,
  documentation: {
    summary: 'protocol.uds.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
