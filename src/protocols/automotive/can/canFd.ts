/**
 * CAN FD taşıma katmanı — `struct canfd_frame` (SocketCAN).
 *
 * Klasik çerçeveden üç farkı vardır ve üçü de bu dosyanın işidir:
 *   1. Payload 0–64 bayt; uzunluk alanı DLC KODU DEĞİL, GERÇEK BAYT SAYISIDIR.
 *   2. Ayrı bir `flags` baytı: FDF (bu bir CAN FD çerçevesi), BRS (veri fazı
 *      farklı bit rate), ESI (gönderenin hata durumu).
 *   3. Yalnız kanonik uzunluklar geçerlidir — 0-8, 12, 16, 20, 24, 32, 48, 64.
 *      Aradaki bir değer (ör. 13) gerçek bir FD çerçevesinde OLAMAZ.
 *
 * TUZAK — DLC KODU vs UZUNLUK: spec "DLC → Actual Payload Length eşlemesi
 * yapılmalı" diyor ama SocketCAN kaydı zaten gerçek uzunluğu taşıyor; bu yüzden
 * eşleme TERS yönde kullanılır — uzunluktan DLC kodu geri türetilir ve ikisi yan
 * yana gösterilir. Eşleme tablosunun kaynağı ve spec'te BULUNMADIĞI uyarısı için
 * bkz. `canFrame.ts` içindeki `CAN_FD_DLC_LENGTHS`.
 *
 * Bayt düzeni ve neden SocketCAN seçildiği için bkz. `canFrame.ts` dosya başı.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  CAN_FD_FRAME_LENGTH,
  CAN_FD_MAX_PAYLOAD,
  CAN_HEADER_LENGTH,
  decodeSocketCanFrame,
} from './canFrame';

const PROTOCOL_ID = 'can-fd';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CAN FD';

const CANFD_BRS_FLAG = 0x01;
const CANFD_ESI_FLAG = 0x02;
const CANFD_FDF_FLAG = 0x04;

const ERROR_FRAME_TOO_SHORT = 'protocol.can.fd.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.can.fd.error.frameTooLong';
const ERROR_ABORTED = 'protocol.can.fd.error.aborted';

export type CanFdFrameMetadata = {
  canId: number;
  extended: boolean;
  payloadLength: number;
  bitRateSwitched: boolean;
  errorPassive: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

interface CanFdParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseFdFrame(data: Uint8Array, options: CanFdParseOptions): ParseResult {
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

  const maxFrameLength = options.maxFrameLength ?? CAN_FD_FRAME_LENGTH;
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

  const decoded = decodeSocketCanFrame(data, { kind: 'fd' });
  const warnings: ProtocolWarning[] = decoded.warnings.map(toProtocolWarning);
  const errors: ProtocolError[] = [];

  const flags = data[5] ?? 0;
  const metadata: CanFdFrameMetadata = {
    canId: decoded.identity.id,
    extended: decoded.identity.extended,
    payloadLength: decoded.payloadLength,
    bitRateSwitched: (flags & CANFD_BRS_FLAG) !== 0,
    errorPassive: (flags & CANFD_ESI_FLAG) !== 0,
    summaryKey: decoded.summaryKey,
    summaryParams: decoded.summaryParams,
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
    fields: [...decoded.fields],
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseCanFd(data: Uint8Array): ParseResult {
  return parseFdFrame(data, {});
}

export const canFdParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * UCUZ ön eleme (spec §7). FDF bayrağı BURADA ZORUNLU TUTULMAZ: bayrağı eksik
   * bir kayıt `parse`ta uyarıyla gösterilebilmeli, otomatik tanımada sessizce
   * elenmemeli.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= CAN_HEADER_LENGTH && data.length <= CAN_FD_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CanFdParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseFdFrame(data, options);
  },
};

/**
 * `struct canfd_frame` üretir. KOMPAKT biçim: başlık + yalnız `len` kadar veri.
 *
 * Gerçek `canfd_frame` sabit 72 bayttır (data[64] her zaman ayrılır) ve parser
 * onu da kabul eder; ama 72 baytlık bir örnek arayüzdeki hex kutusuna 216
 * karakter olarak düşerdi. Örneklerde kompakt biçim kullanılıyor çünkü ikisi de
 * geçerli girdi ve okunabilir olan öğreticidir.
 */
export function buildCanFdFrame(
  canId: number,
  payload: readonly number[],
  flags: { extended?: boolean; bitRateSwitch?: boolean; errorPassive?: boolean } = {},
): Uint8Array {
  const frame = new Uint8Array(CAN_HEADER_LENGTH + payload.length);
  let rawId = canId >>> 0;
  if (flags.extended === true) rawId = (rawId | 0x80000000) >>> 0;
  frame[0] = rawId & 0xff;
  frame[1] = (rawId >>> 8) & 0xff;
  frame[2] = (rawId >>> 16) & 0xff;
  frame[3] = (rawId >>> 24) & 0xff;
  frame[4] = payload.length;
  let flagByte = CANFD_FDF_FLAG;
  if (flags.bitRateSwitch === true) flagByte |= CANFD_BRS_FLAG;
  if (flags.errorPassive === true) flagByte |= CANFD_ESI_FLAG;
  frame[5] = flagByte;
  for (let index = 0; index < payload.length; index += 1) {
    frame[CAN_HEADER_LENGTH + index] = payload[index] ?? 0;
  }
  return frame;
}

/** 0'dan başlayan artan bayt dizisi — uzun payload'ları elle yazmadan üretir. */
function rampPayload(length: number): number[] {
  return Array.from({ length }, (_unused, index) => index & 0xff);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'fd-brs-12-byte',
    name: 'protocol.can.fd.example.fdBrs12Byte.name',
    // 12 bayt = DLC kodu 9: klasik CAN'in 8 bayt sınırının hemen üstü, yani
    // eşlemenin kırıldığı ilk nokta.
    bytes: buildCanFdFrame(0x123, rampPayload(12), { bitRateSwitch: true }),
    description: 'protocol.can.fd.example.fdBrs12Byte.description',
    expectedValid: true,
  },
  {
    id: 'fd-max-payload',
    name: 'protocol.can.fd.example.fdMaxPayload.name',
    // 64 bayt = DLC kodu 15, CAN FD'nin üst sınırı.
    bytes: buildCanFdFrame(0x18da00f1, rampPayload(CAN_FD_MAX_PAYLOAD), {
      extended: true,
      bitRateSwitch: true,
    }),
    description: 'protocol.can.fd.example.fdMaxPayload.description',
    expectedValid: true,
  },
  {
    id: 'fd-error-passive',
    name: 'protocol.can.fd.example.fdErrorPassive.name',
    bytes: buildCanFdFrame(0x456, rampPayload(8), { errorPassive: true }),
    description: 'protocol.can.fd.example.fdErrorPassive.description',
    expectedValid: true,
  },
  {
    id: 'fd-non-canonical-length',
    name: 'protocol.can.fd.example.fdNonCanonicalLength.name',
    // 13 bayt hiçbir DLC koduna karşılık gelmez — uyarı yolunu gösterir.
    bytes: buildCanFdFrame(0x123, rampPayload(13), { bitRateSwitch: true }),
    description: 'protocol.can.fd.example.fdNonCanonicalLength.description',
    expectedValid: true,
  },
];

export const canFdPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: canFdParser,
  documentation: {
    summary: 'protocol.can.fd.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
