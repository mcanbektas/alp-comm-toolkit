/**
 * XCP on CAN — ASAM XCP Part 3 (CAN taşıma katmanı) üzerinde CTO paketleri.
 *
 * Faz 10, dalga 14b. Girdi 16 baytlık SocketCAN klasik çerçevesidir, çıplak
 * XCP paketi DEĞİL — Scapy'nin kendi `XCPOnCAN` sınıfı da bunu doğruluyor:
 * generic `CAN` katmanını extend eder ve CTORequest/CTOResponse'u DOĞRUDAN
 * payload olarak bağlar (`xcpPacket.ts` dosya başı, kaynak 1). CAN veri-bağı
 * motoru İKİNCİ KEZ YAZILMADI — `devicenet.ts`in `canopen.ts:57`den
 * PAYLAŞMA emsali BİREBİR izlendi (aynı beş sembol: `buildCanClassicFrame`,
 * `CAN_CLASSIC_FRAME_LENGTH`, `CAN_HEADER_LENGTH`, `decodeCanId`,
 * `readUint32Le`).
 *
 * ── EXTENDED CAN ID REDDEDİLMEZ (DeviceNet'ten FARK) ────────────────────────
 * DeviceNet'in Predefined Connection Set'i yalnız 11-bit ID tanımladığı için
 * `devicenet.ts` extended ID'yi hata sayıyordu. XCP-on-CAN'da durum FARKLI:
 * ASAM Part 3, CMD/RES CAN kimliklerinin 11-bit VEYA 29-bit olabileceğini
 * (konfigürasyona bağlı) söyler — Scapy'nin `XCPOnCAN.identifier` alanı da
 * `XBitField(..., 29)` olarak tanımlı, tek bir genişliğe kilitlenmemiş. Bu
 * yüzden burada extended ID sadece ETİKETLENİR, reddedilmez.
 *
 * ── `role` VE `byteOrder`: automotive'de decodeOptions kanalını AÇAN ilk
 *    kayıt (`xcpPacket.ts` dosya başı, DÜZELTME 1 ve 2) ────────────────────
 * İkisi de GERÇEKTEN çerçeveden çıkarılamaz: `role` (komut mu yanıt mı) CAN
 * ID'nin CMD mi RES mi olduğuna bağlıdır (kullanıcı sistem/A2L bağlamından
 * bilir); `byteOrder` CONNECT ile müzakere edilir ve durumsuz `parse(data)`
 * bunu hatırlayamaz. `devicenet.ts`in `payloadInterpretation` kanalıyla AYNI
 * gerekçe sınıfı, varsayılan sırasıyla `command` ve `little-endian`.
 *
 * ── CAN FD: AÇIKÇA REDDEDİLİR, SESSİZCE YANLIŞ ÇÖZÜLMEZ ─────────────────────
 * İlk sürüm yalnız klasik CAN'i kapsar (brief-faz10-dalga14b.md). Girdi tam
 * `CAN_FD_FRAME_LENGTH` (72 bayt) ise bu AÇIKÇA "CAN FD desteklenmiyor"
 * hatasıyla durur — `unsupported-encoding` (`types.ts`: "yapısal olarak
 * okunabildi ama KODLAMA BİÇİMİ bu çözücünün kabul ettiği kümede değil").
 */

import { decodeXcpPacket } from './xcpPacket';
import type { XcpRole } from './xcpPacket';
import { buildCanClassicFrame } from '../can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_FD_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../can/canFrame';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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

const PROTOCOL_ID = 'xcp-on-can';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'XCP on CAN';

const OPTION_ROLE = 'role';
const ROLE_COMMAND = 'command';
const ROLE_RESPONSE = 'response';

const OPTION_BYTE_ORDER = 'byteOrder';
const BYTE_ORDER_LITTLE = 'little-endian';
const BYTE_ORDER_BIG = 'big-endian';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_ROLE,
    label: 'protocol.xcp.option.role',
    kind: 'select',
    defaultValue: ROLE_COMMAND,
    description: 'protocol.xcp.option.role.description',
    choices: [
      { value: ROLE_COMMAND, label: 'protocol.xcp.option.role.command' },
      { value: ROLE_RESPONSE, label: 'protocol.xcp.option.role.response' },
    ],
  },
  {
    id: OPTION_BYTE_ORDER,
    label: 'protocol.xcp.option.byteOrder',
    kind: 'select',
    defaultValue: BYTE_ORDER_LITTLE,
    description: 'protocol.xcp.option.byteOrder.description',
    choices: [
      { value: BYTE_ORDER_LITTLE, label: 'protocol.xcp.option.byteOrder.little' },
      { value: BYTE_ORDER_BIG, label: 'protocol.xcp.option.byteOrder.big' },
    ],
  },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.xcp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.xcp.error.frameTooLong';
const ERROR_CAN_FD_NOT_SUPPORTED = 'protocol.xcp.error.canFdNotSupported';
const ERROR_ABORTED = 'protocol.xcp.error.aborted';
const ERROR_EMPTY_PAYLOAD = 'protocol.xcp.error.emptyPayload';

const SUMMARY_PREFIX = 'protocol.xcp.summary.';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

export type XcpOnCanFrameMetadata = {
  role: XcpRole;
  pid: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface XcpOnCanParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  role: XcpRole;
  byteOrder: typeof BYTE_ORDER_LITTLE | typeof BYTE_ORDER_BIG;
}

function resolveParseOptions(context: ParseContext | undefined): XcpOnCanParseOptions {
  const rawRole = context?.options?.[OPTION_ROLE];
  const role: XcpRole = rawRole === ROLE_RESPONSE ? ROLE_RESPONSE : ROLE_COMMAND;
  const rawByteOrder = context?.options?.[OPTION_BYTE_ORDER];
  const byteOrder = rawByteOrder === BYTE_ORDER_BIG ? BYTE_ORDER_BIG : BYTE_ORDER_LITTLE;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    role,
    byteOrder,
  };
}

function parseXcpOnCanFrame(data: Uint8Array, options: XcpOnCanParseOptions): ParseResult {
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
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (data.length === CAN_FD_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_CAN_FD_NOT_SUPPORTED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: false,
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

  const declaredLength = byteAt(data, 4);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, 8, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  let pid = -1;
  if (payloadLength === 0) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_EMPTY_PAYLOAD,
      offset: CAN_HEADER_LENGTH,
      length: 0,
    });
  } else {
    pid = byteAt(data, CAN_HEADER_LENGTH);
    decodeXcpPacket(
      data,
      CAN_HEADER_LENGTH,
      CAN_HEADER_LENGTH + payloadLength,
      options.role,
      options.byteOrder,
      fields,
      warnings,
      errors,
      '',
    );
  }

  const summaryParams: Record<string, string> = {
    canId: identity.id.toString(16).toUpperCase(),
    pid: pid >= 0 ? `0x${pid.toString(16).toUpperCase().padStart(2, '0')}` : '—',
  };

  const metadata: XcpOnCanFrameMetadata = {
    role: options.role,
    pid,
    summaryKey: `${SUMMARY_PREFIX}${options.role}`,
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

export function parseXcpOnCan(data: Uint8Array): ParseResult {
  return parseXcpOnCanFrame(data, { role: ROLE_COMMAND, byteOrder: BYTE_ORDER_LITTLE });
}

export const xcpOnCanParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: yalnız uzunluk aralığı. XCP-on-CAN'in CAN ID'si (DeviceNet
   * gibi sabit bir bit yapısına sahip olmanın aksine) TAMAMEN kullanıcı/
   * A2L konfigürasyonuna bağlıdır — ID bazlı ek eleme YAPILAMAZ (dosya başı).
   * `canClassic.ts`/`canFd.ts`in kendisi de aynı gerekçeyle yalnız uzunluk
   * denetler.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= CAN_HEADER_LENGTH && data.length <= CAN_CLASSIC_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseXcpOnCanFrame(data, resolveParseOptions(context));
  },
};

/**
 * Örnek çerçeveler `buildCanClassicFrame`den kurulur (devicenet.ts emsali).
 * CAN ID'ler XCP'nin kendi tanımladığı bir sabit DEĞİLDİR (dosya başı) —
 * burada yalnız gösterim amaçlı, akla yatkın bir CAN ID seçildi.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'connect-command-normal',
    name: 'protocol.xcp.example.connectCommandNormal.name',
    // PID 0xFF=CONNECT, connection_mode 0x00=NORMAL.
    bytes: buildCanClassicFrame(0x7e0, [0xff, 0x00]),
    description: 'protocol.xcp.example.connectCommandNormal.description',
    expectedValid: true,
  },
  {
    id: 'connect-positive-response',
    name: 'protocol.xcp.example.connectPositiveResponse.name',
    // PID 0xFF=RES; resource 0x05 (cal_pag+daq), comm_mode_basic 0x00
    // (little-endian), max_cto 8, max_dto 8 (LE: 08 00), protokol/taşıma
    // sürüm MSB 0x01/0x01 — `decodeOptions.role=response` ile açılmalı.
    bytes: buildCanClassicFrame(0x7e8, [0xff, 0x05, 0x00, 0x08, 0x08, 0x00, 0x01, 0x01]),
    description: 'protocol.xcp.example.connectPositiveResponse.description',
    expectedValid: true,
  },
  {
    id: 'get-status-command',
    name: 'protocol.xcp.example.getStatusCommand.name',
    // PID 0xFD=GET_STATUS, parametresiz.
    bytes: buildCanClassicFrame(0x7e0, [0xfd]),
    description: 'protocol.xcp.example.getStatusCommand.description',
    expectedValid: true,
  },
  {
    id: 'set-mta-command',
    name: 'protocol.xcp.example.setMtaCommand.name',
    // PID 0xF6=SET_MTA, reserved 00 00, address_extension 00, address
    // 0x00001000 (LE: 00 10 00 00).
    bytes: buildCanClassicFrame(0x7e0, [0xf6, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00]),
    description: 'protocol.xcp.example.setMtaCommand.description',
    expectedValid: true,
  },
  {
    id: 'error-response-cmd-unknown',
    name: 'protocol.xcp.example.errorResponseCmdUnknown.name',
    // PID 0xFE=ERR, error_code 0x20=ERR_CMD_UNKNOWN — `decodeOptions.role=response` ile açılmalı.
    bytes: buildCanClassicFrame(0x7e8, [0xfe, 0x20]),
    description: 'protocol.xcp.example.errorResponseCmdUnknown.description',
    expectedValid: true,
  },
  {
    id: 'stim-daq-data',
    name: 'protocol.xcp.example.stimDaqData.name',
    // PID 0x00, DAQ list konfigürasyonu olmadan çözülemeyen STIM verisi.
    bytes: buildCanClassicFrame(0x7e0, [0x00, 0x11, 0x22, 0x33]),
    description: 'protocol.xcp.example.stimDaqData.description',
    expectedValid: true,
  },
];

export const xcpOnCanPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: xcpOnCanParser,
  documentation: {
    summary: 'protocol.xcp.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'Scapy — contrib/automotive/xcp (GPL-2.0)',
        url: 'https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/xcp.py',
      },
      {
        title: 'pyxcp — ASAM XCP in Python (LGPL)',
        url: 'https://github.com/christoph2/pyxcp',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
