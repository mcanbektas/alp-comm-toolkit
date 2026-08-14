/**
 * SAE J1979 / ISO 15031-5 OBD-II — mod kimliği ve üç doğrulanmış PID formülü.
 *
 * GİRDİ CAN ÇERÇEVESİ DEĞİLDİR: UDS ile aynı gerekçeyle ham PDU baytıdır
 * (mod + parametreler). Bkz. `uds.ts` dosya başı — üç motor (ISO-TP/UDS/OBD-II)
 * bağımsız çalışır, zincir parser katmanında kurulmaz.
 *
 * ── `status: 'partial'`, `ready` DEĞİL — bilinçli, karar turunda sonuçlandırıldı ──
 * Spec özet 04-otomotiv.md:277-303'ün verdiği ile vermediği net ayrı:
 *
 *   VERİYOR : 9 modun adı (satır 285-293) · üç PID formülü (Engine RPM, Vehicle
 *             Speed, Coolant Temperature, satır 295-299) · RPM için doğrulanmış
 *             tek fixture (A=0x1A, B=0xF8 → 1726 rpm, satır 295).
 *   VERMİYOR: PID NUMARALARI — üç formülün HİÇBİRİNİN hangi PID baytıyla
 *             tetikleneceği spec'te YOK (0x0C/0x0D/0x05 buradan gelmiyor).
 *             DTC bit mapping algoritması ("uygun bit mapping ile", satır 301) —
 *             sonuç örneği var, yöntem yok. PID tablosunun geri kalanı (J1979-DA
 *             dijital ek, satır 279'da açıkça atıf var, içerik aktarılmıyor).
 *
 * Bu yüzden `parse()` PID'i BİR PARAMETRE OLARAK gösterir, isme/formüle
 * BAĞLAMAZ — bağlamak, spec'in vermediği PID↔isim eşlemesini uydurmak olurdu
 * (J1939'un SPN'i ham bırakmasıyla aynı gerekçe, `j1939.ts`). Üç formül ayrı,
 * test edilmiş SAF FONKSİYONLAR olarak dışa açılır; `calculators` alanı Faz
 * 5'in hesap motoru arayüzü için yalnız ŞEKİL taşır (spec §7: "hesap motorları
 * Faz 5'te gelecek, burada sadece şekil sabitleniyor").
 *
 * ── MOD + 0x40 = YANIT (KAYNAK UYARISI) ──────────────────────────────────────
 * Bu kural spec'in OBD-II bölümünde YENİDEN yazılmıyor ama UDS'in ISO 14229
 * kökenli aynı kuralının (spec özet 10:700) SAE J1979/ISO 15031-5 tarafındaki
 * karşılığıdır — her genel OBD-II kaynağında bulunan, lisanslı olmayan bir
 * çerçeveleme kuralıdır (CAN FD DLC tablosuyla aynı gerekçe, bkz. `canFrame.ts`).
 * Olmadan gerçek bir yanıt çerçevesi (`41 0C …` gibi) hiç çözülemezdi.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  CalculatorDefinition,
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

const PROTOCOL_ID = 'obd-ii';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'OBD-II';

/** KAYNAK UYARISI: dosya başı — spec'te yeniden yazılmıyor, SAE J1979/ISO 15031-5'in yapısıdır. */
const RESPONSE_MODE_OFFSET = 0x40;

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

const ERROR_EMPTY_PDU = 'protocol.obd.error.emptyPdu';
const ERROR_FRAME_TOO_LONG = 'protocol.obd.error.frameTooLong';
const ERROR_ABORTED = 'protocol.obd.error.aborted';

const WARN_UNKNOWN_MODE = 'protocol.obd.warning.unknownMode';

const SUMMARY_REQUEST = 'protocol.obd.summary.request';
const SUMMARY_RESPONSE = 'protocol.obd.summary.response';

export interface ObdModeInfo {
  readonly mode: number;
  /** Protokol terimi — veridir, çevrilmez (CLAUDE.md). */
  readonly name: string;
}

/** Spec özet 04-otomotiv.md:285-293 — dokuz modun adı BİREBİR. */
export const OBD_MODES: readonly ObdModeInfo[] = [
  { mode: 0x01, name: 'Current Data' },
  { mode: 0x02, name: 'Freeze Frame' },
  { mode: 0x03, name: 'Stored DTC' },
  { mode: 0x04, name: 'Clear DTC / diagnostic information' },
  { mode: 0x05, name: 'Oxygen sensor test (legacy)' },
  { mode: 0x06, name: 'Monitor test results' },
  { mode: 0x07, name: 'Pending DTC' },
  { mode: 0x08, name: 'Control operation' },
  { mode: 0x09, name: 'Vehicle Information' },
];

/** Spec: "toolkit en az Mode 01/03/04/09 desteklemeli" (özet 04:281). */
export const OBD_MINIMUM_REQUIRED_MODES: readonly number[] = [0x01, 0x03, 0x04, 0x09];

const MODE_INDEX: ReadonlyMap<number, ObdModeInfo> = new Map(
  OBD_MODES.map((info) => [info.mode, info]),
);

export function getObdModeInfo(mode: number): ObdModeInfo | undefined {
  return MODE_INDEX.get(mode);
}

/**
 * Engine RPM formülü — spec özet 04:295, doğrulanmış fixture: A=0x1A (26),
 * B=0xF8 (248) → (26×256+248)/4 = 1726 rpm.
 */
export function decodeEngineRpm(a: number, b: number): number {
  return (a * 256 + b) / 4;
}

/** Vehicle speed formülü — spec özet 04:297: `Speed = A km/h`. */
export function decodeVehicleSpeedKmh(a: number): number {
  return a;
}

/** Coolant temperature formülü — spec özet 04:299: `T = A − 40` °C. */
export function decodeCoolantTemperatureCelsius(a: number): number {
  return a - 40;
}

/**
 * Şekil-only tanımlar (spec §7, Faz 5'in hesap motoru arayüzü). Algoritma
 * yukarıdaki üç saf fonksiyondadır; bu liste yalnız plugin'in VAAT ettiği
 * hesap araçlarını adlandırır.
 */
const CALCULATORS: CalculatorDefinition[] = [
  {
    id: 'engine-rpm',
    name: 'Engine RPM',
    description: 'protocol.obd.calculator.engineRpm.description',
    unit: 'rpm',
  },
  {
    id: 'vehicle-speed',
    name: 'Vehicle Speed',
    description: 'protocol.obd.calculator.vehicleSpeed.description',
    unit: 'km/h',
  },
  {
    id: 'coolant-temperature',
    name: 'Coolant Temperature',
    description: 'protocol.obd.calculator.coolantTemperature.description',
    unit: '°C',
  },
];

export type ObdMessageRole = 'request' | 'response';

export type ObdFrameMetadata = {
  mode: number;
  role: ObdMessageRole;
  modeName: string | undefined;
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

interface ObdParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseObdFrame(data: Uint8Array, options: ObdParseOptions): ParseResult {
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

  const modeByte = byteAt(data, 0);
  const isResponse =
    modeByte >= RESPONSE_MODE_OFFSET && getObdModeInfo(modeByte - RESPONSE_MODE_OFFSET) !== undefined;
  const requestMode = isResponse ? modeByte - RESPONSE_MODE_OFFSET : modeByte;
  const info = getObdModeInfo(requestMode);

  const modeField: ParsedField = {
    id: 'mode',
    name: 'Mode',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: modeByte,
    valid: info !== undefined,
    warnings: [],
  };
  if (info !== undefined) {
    modeField.physicalValue = info.name;
  } else {
    modeField.warnings.push(WARN_UNKNOWN_MODE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_MODE));
  }
  fields.push(modeField);

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

  const summaryParams: Record<string, string> = { mode: formatHexByte(modeByte) };
  if (info !== undefined) {
    summaryParams.modeName = info.name;
  }

  const metadata: ObdFrameMetadata = {
    mode: modeByte,
    role: isResponse ? 'response' : 'request',
    modeName: info?.name,
    summaryKey: isResponse ? SUMMARY_RESPONSE : SUMMARY_REQUEST,
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

export function parseObd(data: Uint8Array): ParseResult {
  return parseObdFrame(data, {});
}

export const obdParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: ilk bayt tanınan bir mod ya da mod+0x40 yanıtı olmalı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < 1) return false;
    const modeByte = byteAt(data, 0);
    if (getObdModeInfo(modeByte) !== undefined) return true;
    return (
      modeByte >= RESPONSE_MODE_OFFSET &&
      getObdModeInfo(modeByte - RESPONSE_MODE_OFFSET) !== undefined
    );
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: ObdParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseObdFrame(data, options);
  },
};

/**
 * Örnek PDU'lar. `engineRpmResponse` spec'in BİREBİR verdiği fixture'ı taşır
 * (özet 04:295: PID Engine RPM, Raw `1A F8`, Physical 1726 rpm) — PID baytı
 * (0x0C) spec'te YOK, gösterim amaçlı eklendi ve `parameters` içinde HAM
 * kalır, isme bağlanmaz. Diğerleri mod tablosunun tutarlı kullanımını gösterir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'current-data-request',
    name: 'protocol.obd.example.currentDataRequest.name',
    // Mode 01 + gösterim amaçlı PID baytı (0x0C spec'te değil, ham parametre).
    bytes: new Uint8Array([0x01, 0x0c]),
    description: 'protocol.obd.example.currentDataRequest.description',
    expectedValid: true,
  },
  {
    id: 'engine-rpm-response',
    name: 'protocol.obd.example.engineRpmResponse.name',
    // Spec özet 04:295 fixture'ı: A=0x1A, B=0xF8 → 1726 rpm (decodeEngineRpm ile doğrulanır).
    bytes: new Uint8Array([0x41, 0x0c, 0x1a, 0xf8]),
    description: 'protocol.obd.example.engineRpmResponse.description',
    expectedValid: true,
  },
  {
    id: 'stored-dtc-request',
    name: 'protocol.obd.example.storedDtcRequest.name',
    // Mode 03: PID gerektirmez, tek baytlık istek.
    bytes: new Uint8Array([0x03]),
    description: 'protocol.obd.example.storedDtcRequest.description',
    expectedValid: true,
  },
  {
    id: 'vehicle-information-request',
    name: 'protocol.obd.example.vehicleInformationRequest.name',
    bytes: new Uint8Array([0x09, 0x02]),
    description: 'protocol.obd.example.vehicleInformationRequest.description',
    expectedValid: true,
  },
  {
    id: 'unknown-mode',
    name: 'protocol.obd.example.unknownMode.name',
    bytes: new Uint8Array([0x0f]),
    description: 'protocol.obd.example.unknownMode.description',
    expectedValid: true,
  },
];

export const obdPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: obdParser,
  calculators: CALCULATORS,
  documentation: {
    summary: 'protocol.obd.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
