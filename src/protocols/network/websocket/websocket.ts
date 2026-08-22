/**
 * WebSocket (RFC 6455) — açılış el sıkışmasından sonraki iki yönlü çerçeveler.
 * Girdi TEK bir WebSocket ÇERÇEVESİDİR.
 *
 * ── EL SIKIŞMASI BU MOTORUN İŞİ DEĞİL, HTTP'NİNKİ ───────────────────────────
 * Açılış el sıkışması (spec `:405`) düpedüz bir HTTP mesajıdır: `GET /ws
 * HTTP/1.1 … Upgrade: websocket` ve `HTTP/1.1 101 Switching Protocols`. Aynı
 * dalgada `http.ts` yazıldı; motorlar zincir KURMAZ (`arp.ts`/`icmp.ts`
 * kararının aynısı), bu yüzden el sıkışması metni buraya verilirse ÇÖZÜLMEZ —
 * tanınır ve "HTTP sayfasında çöz" uyarısı basılır.
 *
 * `Sec-WebSocket-Accept` doğrulaması (spec `:407`: anahtar → GUID → SHA-1 →
 * Base64) de el sıkışmasının işidir ve ayrıca ASENKRON kripto ister
 * (`crypto.subtle`); `ProtocolParser.parse` SENKRON bir sözleşmedir
 * (`protocol-core/types.ts`). Hesap aracı olarak ayrı bir iş.
 *
 * ── KONTROL ÇERÇEVELERİNİN İKİ SERT SINIRI VAR ──────────────────────────────
 * RFC 6455 §5.5: opcode'un 0x8 biti açıksa (Close/Ping/Pong ve ayrılmış
 * 0xB-0xF) çerçeve (a) 125 BAYTTAN UZUN OLAMAZ ve (b) PARÇALANAMAZ, yani
 * `FIN` 1 olmak zorundadır. Uzunluk alanı 126/127 uzatmasını yapısal olarak
 * kabul ettiği için ihlal sessizce geçer — açıkça denetlenir.
 *
 * ── UZUNLUK ALANI ÜÇ BİÇİMLİDİR VE EN KISASI ZORUNLUDUR ─────────────────────
 * 0-125 doğrudan; 126 → sonraki 2 bayt; 127 → sonraki 8 bayt ve **en anlamlı
 * bit 0 olmalıdır** (§5.2). Ayrıca "the minimal number of bytes MUST be used":
 * 200 baytlık bir yükü 127 biçimiyle göndermek geçerli görünür ama kural dışıdır.
 *
 * ── MASKELEME BİTİ YÖNÜ SÖYLER ──────────────────────────────────────────────
 * Brief bu kaydı "yön sorulmalı, `decodeOptions` adayı" diye işaretlemişti.
 * Gerek KALMADI: RFC 6455 §5.1 istemci→sunucu çerçevelerin maskelenmesini
 * ZORUNLU, sunucu→istemci maskelenmesini YASAK kılar — yani `MASK` biti yönün
 * kendisidir, tahmin değil. Türetilmiş `direction` alanı bu kuralla üretilir ve
 * dayanağı alan adında taşınır. (12d'de NTP'nin T4'ü için kanalın AÇILMAMA
 * gerekçesinin kardeşi: kanal, kullanıcının BİLDİĞİ ama telde OLMAYAN şey
 * içindir; burada bilgi telde var.)
 *
 * ── UNMASK XOR'U DÖNGÜSELDİR ────────────────────────────────────────────────
 * `Decoded_i = Encoded_i ⊕ Mask_(i mod 4)`. Maske anahtarının kendisi
 * ÇÖZÜLMEZ (o dört bayt zaten düz); yalnız yük açılır.
 *
 * ── PARÇA BİRLEŞTİRME ÇOK-ÇERÇEVE İŞİDİR ────────────────────────────────────
 * `Text(FIN=0) → Continuation(FIN=0) → Continuation(FIN=1)` tek uygulama
 * mesajıdır (spec `:432`); tek çerçeve çözücüsü bunu veremez — 12c'deki DNS
 * Transaction Matching, 12e'deki syslog dashboard kararlarının aynısı.
 * Continuation çerçevesinin KENDİ opcode'u yoktur: yükün metin mi ikili mi
 * olduğu ilk parçadaydı, bu yüzden burada yorumlanmaz.
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

const PROTOCOL_ID = 'websocket';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'WebSocket';

/** İki baytlık asgari başlık: bayrak/opcode + maske/uzunluk. */
const MIN_FRAME_LENGTH = 2;

const FIN_MASK = 0x80;
const RSV1_MASK = 0x40;
const RSV2_MASK = 0x20;
const RSV3_MASK = 0x10;
const OPCODE_MASK = 0x0f;
const MASK_FLAG = 0x80;
const PAYLOAD_LENGTH_MASK = 0x7f;

const LENGTH_EXTENDED_16 = 126;
const LENGTH_EXTENDED_64 = 127;
const CONTROL_FRAME_MAX_PAYLOAD = 125;
/** Opcode'un bu biti açıksa çerçeve bir KONTROL çerçevesidir (§5.5). */
const CONTROL_OPCODE_FLAG = 0x8;

const MASKING_KEY_LENGTH = 4;
const CLOSE_STATUS_LENGTH = 2;
const HEX_RADIX = 16;

const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

const OPCODE_NAMES: ReadonlyMap<number, string> = new Map([
  [OPCODE_CONTINUATION, 'Continuation'],
  [OPCODE_TEXT, 'Text'],
  [OPCODE_BINARY, 'Binary'],
  [OPCODE_CLOSE, 'Close'],
  [OPCODE_PING, 'Ping'],
  [OPCODE_PONG, 'Pong'],
]);

/** RFC 6455 §7.4.1. 1005/1006/1015 TELDE GÖRÜNEMEZ — yerel kullanım içindir. */
const CLOSE_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [1000, 'Normal Closure'],
  [1001, 'Going Away'],
  [1002, 'Protocol Error'],
  [1003, 'Unsupported Data'],
  [1007, 'Invalid Frame Payload Data'],
  [1008, 'Policy Violation'],
  [1009, 'Message Too Big'],
  [1010, 'Mandatory Extension'],
  [1011, 'Internal Server Error'],
  [1012, 'Service Restart'],
  [1013, 'Try Again Later'],
  [1014, 'Bad Gateway'],
]);

const RESERVED_CLOSE_STATUSES: ReadonlySet<number> = new Set([1005, 1006, 1015]);

const ERROR_FRAME_TOO_SHORT = 'protocol.websocket.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.websocket.error.frameTooLong';
const ERROR_ABORTED = 'protocol.websocket.error.aborted';
const ERROR_LENGTH_TRUNCATED = 'protocol.websocket.error.lengthTruncated';
const ERROR_PAYLOAD_TRUNCATED = 'protocol.websocket.error.payloadTruncated';
const ERROR_EXTENDED_LENGTH_MSB = 'protocol.websocket.error.extendedLengthMsb';
const ERROR_CONTROL_FRAME_TOO_LONG = 'protocol.websocket.error.controlFrameTooLong';
const ERROR_CONTROL_FRAME_FRAGMENTED = 'protocol.websocket.error.controlFrameFragmented';
const ERROR_HANDSHAKE_NOT_A_FRAME = 'protocol.websocket.error.handshakeNotAFrame';

const WARN_RESERVED_OPCODE = 'protocol.websocket.warning.reservedOpcode';
const WARN_RSV_BITS_SET = 'protocol.websocket.warning.rsvBitsSet';
const WARN_NON_MINIMAL_LENGTH = 'protocol.websocket.warning.nonMinimalLength';
const WARN_PAYLOAD_LONGER_THAN_FRAME = 'protocol.websocket.warning.payloadLongerThanFrame';
const WARN_CLOSE_STATUS_RESERVED = 'protocol.websocket.warning.closeStatusReserved';
const WARN_CLOSE_STATUS_UNKNOWN = 'protocol.websocket.warning.closeStatusUnknown';
const WARN_CLOSE_PAYLOAD_TOO_SHORT = 'protocol.websocket.warning.closePayloadTooShort';
const WARN_CONTINUATION_OPCODE_UNKNOWN = 'protocol.websocket.warning.continuationOpcodeUnknown';
const WARN_FRAGMENT_REASSEMBLY_NEEDS_STREAM = 'protocol.websocket.warning.fragmentReassemblyNeedsStream';
const WARN_TEXT_NOT_VALID_UTF8 = 'protocol.websocket.warning.textNotValidUtf8';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

/** `fatal: true` — geçersiz UTF-8 sessizce U+FFFD'ye dönüşmesin (§5.6). */
function decodeUtf8Strict(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

interface WebSocketParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface Sink {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function pushWarning(sink: Sink, key: string): void {
  sink.warnings.push(toProtocolWarning(key));
}

/** El sıkışması metni mi? İlk baytlar `GET ` ya da `HTTP/` ise evet. */
function looksLikeHandshake(data: Uint8Array): boolean {
  const head = Array.from(data.slice(0, 5), (byte) => String.fromCharCode(byte)).join('');
  return head.startsWith('GET ') || head.startsWith('HTTP/');
}

/** Yükü maskeden açar: `Decoded_i = Encoded_i ⊕ Mask_(i mod 4)`. */
function unmask(payload: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    out[index] = (payload[index] ?? 0) ^ (key[index % MASKING_KEY_LENGTH] ?? 0);
  }
  return out;
}

function pushBitField(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  value: number,
  sink: Sink,
): ParsedField {
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: value,
    valid: true,
    warnings: [],
  };
  sink.fields.push(field);
  return field;
}

function parseWebSocketFrame(data: Uint8Array, options: WebSocketParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
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
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (looksLikeHandshake(data)) {
    // El sıkışması HTTP'dir, çerçeve değil (dosya başı).
    return {
      success: false,
      error: { code: 'start-delimiter-not-found', message: ERROR_HANDSHAKE_NOT_A_FRAME, offset: 0, length: 5 },
      consumedBytes: 0,
      recoverable: false,
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

  const sink: Sink = { fields: [], warnings: [], errors: [] };

  // ── Bayt 0: FIN + üç RSV biti + opcode. Hepsi aynı baytı kapsar.
  const flagsByte = byteAt(data, 0);
  const fin = (flagsByte & FIN_MASK) !== 0;
  pushBitField(data, 'fin', 'FIN', 0, fin ? 1 : 0, sink).physicalValue = fin ? 'Final fragment' : 'More fragments';

  const rsvBits = [
    { id: 'rsv1', name: 'RSV1', mask: RSV1_MASK },
    { id: 'rsv2', name: 'RSV2', mask: RSV2_MASK },
    { id: 'rsv3', name: 'RSV3', mask: RSV3_MASK },
  ];
  let anyRsvSet = false;
  for (const bit of rsvBits) {
    const set = (flagsByte & bit.mask) !== 0;
    if (set) anyRsvSet = true;
    pushBitField(data, bit.id, bit.name, 0, set ? 1 : 0, sink);
  }
  if (anyRsvSet) {
    // RSV yalnız anlaşılmış bir uzantı varsa (ör. permessage-deflate)
    // kullanılabilir; el sıkışması burada olmadığı için bilinemez.
    pushWarning(sink, WARN_RSV_BITS_SET);
  }

  const opcode = flagsByte & OPCODE_MASK;
  const opcodeName = OPCODE_NAMES.get(opcode);
  const opcodeField = pushBitField(data, 'opcode', 'Opcode', 0, opcode, sink);
  if (opcodeName !== undefined) opcodeField.physicalValue = opcodeName;
  else {
    opcodeField.valid = false;
    opcodeField.warnings = [WARN_RESERVED_OPCODE];
    pushWarning(sink, WARN_RESERVED_OPCODE);
  }

  const isControlFrame = (opcode & CONTROL_OPCODE_FLAG) !== 0;

  // ── Bayt 1: MASK biti + uzunluk alanı.
  const maskLengthByte = byteAt(data, 1);
  const masked = (maskLengthByte & MASK_FLAG) !== 0;
  pushBitField(data, 'mask-flag', 'MASK', 1, masked ? 1 : 0, sink).physicalValue = masked ? 'Masked' : 'Unmasked';

  // Yön MASK bitinden ÇIKAR, tahmin edilmez (dosya başı).
  sink.fields.push({
    id: 'direction',
    name: 'Direction (from MASK, RFC 6455 §5.1)',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    physicalValue: masked ? 'Client → Server' : 'Server → Client',
    valid: true,
    warnings: [],
  });

  const lengthCode = maskLengthByte & PAYLOAD_LENGTH_MASK;
  let payloadLength = lengthCode;
  let cursor = 2;

  if (lengthCode === LENGTH_EXTENDED_16) {
    if (data.length < cursor + 2) {
      sink.errors.push({ code: 'truncated-frame', message: ERROR_LENGTH_TRUNCATED, offset: cursor, length: 2 });
      return finish(data, sink, options);
    }
    payloadLength = (byteAt(data, cursor) << 8) | byteAt(data, cursor + 1);
    sink.fields.push({
      id: 'extended-payload-length',
      name: 'Extended Payload Length (16-bit)',
      offset: cursor,
      length: 2,
      rawBytes: data.slice(cursor, cursor + 2),
      rawValue: payloadLength,
      unit: 'B',
      valid: true,
      warnings: [],
    });
    // "Minimal number of bytes MUST be used" (§5.2).
    if (payloadLength < LENGTH_EXTENDED_16) pushWarning(sink, WARN_NON_MINIMAL_LENGTH);
    cursor += 2;
  } else if (lengthCode === LENGTH_EXTENDED_64) {
    if (data.length < cursor + 8) {
      sink.errors.push({ code: 'truncated-frame', message: ERROR_LENGTH_TRUNCATED, offset: cursor, length: 8 });
      return finish(data, sink, options);
    }
    let value = 0n;
    for (let index = 0; index < 8; index += 1) value = (value << 8n) | BigInt(byteAt(data, cursor + index));
    sink.fields.push({
      id: 'extended-payload-length',
      name: 'Extended Payload Length (64-bit)',
      offset: cursor,
      length: 8,
      rawBytes: data.slice(cursor, cursor + 8),
      rawValue: value,
      unit: 'B',
      valid: (byteAt(data, cursor) & 0x80) === 0,
      warnings: [],
    });
    if ((byteAt(data, cursor) & 0x80) !== 0) {
      // §5.2: 64 bitlik uzunluğun en anlamlı biti 0 OLMALIDIR.
      sink.errors.push({ code: 'value-out-of-range', message: ERROR_EXTENDED_LENGTH_MSB, offset: cursor, length: 8 });
      return finish(data, sink, options);
    }
    if (value <= BigInt(0xffff)) pushWarning(sink, WARN_NON_MINIMAL_LENGTH);
    payloadLength = Number(value);
    cursor += 8;
  } else {
    sink.fields.push({
      id: 'payload-length',
      name: 'Payload Length',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: lengthCode,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  // ── Kontrol çerçevesinin iki sert sınırı (dosya başı).
  if (isControlFrame) {
    if (payloadLength > CONTROL_FRAME_MAX_PAYLOAD) {
      sink.errors.push({
        code: 'value-out-of-range',
        message: ERROR_CONTROL_FRAME_TOO_LONG,
        offset: 1,
        length: cursor - 1,
        details: { payloadLength, maximum: CONTROL_FRAME_MAX_PAYLOAD },
      });
    }
    if (!fin) {
      sink.errors.push({
        code: 'value-out-of-range',
        message: ERROR_CONTROL_FRAME_FRAGMENTED,
        offset: 0,
        length: 1,
        details: { opcode },
      });
    }
  }

  let maskingKey: Uint8Array | undefined;
  if (masked) {
    if (data.length < cursor + MASKING_KEY_LENGTH) {
      sink.errors.push({
        code: 'truncated-frame',
        message: ERROR_LENGTH_TRUNCATED,
        offset: cursor,
        length: MASKING_KEY_LENGTH,
      });
      return finish(data, sink, options);
    }
    maskingKey = data.slice(cursor, cursor + MASKING_KEY_LENGTH);
    sink.fields.push({
      id: 'masking-key',
      name: 'Masking Key',
      offset: cursor,
      length: MASKING_KEY_LENGTH,
      rawBytes: maskingKey,
      rawValue: `0x${formatHex(maskingKey)}`,
      valid: true,
      warnings: [],
    });
    cursor += MASKING_KEY_LENGTH;
  }

  const availablePayload = Math.max(data.length - cursor, 0);
  if (availablePayload < payloadLength) {
    sink.errors.push({
      code: 'truncated-frame',
      message: ERROR_PAYLOAD_TRUNCATED,
      offset: cursor,
      length: payloadLength - availablePayload,
      details: { declaredLength: payloadLength, availableBytes: availablePayload },
    });
    return finish(data, sink, options);
  }
  if (availablePayload > payloadLength) {
    // Fazlalık büyük olasılıkla akıştaki BİR SONRAKİ çerçeve.
    pushWarning(sink, WARN_PAYLOAD_LONGER_THAN_FRAME);
  }

  const rawPayload = data.slice(cursor, cursor + payloadLength);
  const payload = maskingKey === undefined ? rawPayload : unmask(rawPayload, maskingKey);

  if (payloadLength > 0) {
    const payloadField: ParsedField = {
      id: 'payload',
      name: maskingKey === undefined ? 'Payload' : 'Payload (unmasked)',
      offset: cursor,
      length: payloadLength,
      rawBytes: rawPayload,
      unit: 'B',
      valid: true,
      warnings: [],
    };

    if (opcode === OPCODE_TEXT) {
      const text = decodeUtf8Strict(payload);
      if (text !== undefined) payloadField.rawValue = text;
      else {
        // §5.6: Text çerçevesinin yükü GEÇERLİ UTF-8 olmak zorundadır.
        payloadField.rawValue = `0x${formatHex(payload)}`;
        payloadField.valid = false;
        payloadField.warnings = [WARN_TEXT_NOT_VALID_UTF8];
        pushWarning(sink, WARN_TEXT_NOT_VALID_UTF8);
      }
    } else if (opcode !== OPCODE_CLOSE) {
      payloadField.rawValue = `0x${formatHex(payload)}`;
    }

    sink.fields.push(payloadField);
  }

  if (opcode === OPCODE_CLOSE) parseClosePayload(payload, cursor, sink);

  if (opcode === OPCODE_CONTINUATION) {
    // Yükün metin mi ikili mi olduğu İLK parçadaydı (dosya başı).
    pushWarning(sink, WARN_CONTINUATION_OPCODE_UNKNOWN);
  }
  if (!fin || opcode === OPCODE_CONTINUATION) {
    pushWarning(sink, WARN_FRAGMENT_REASSEMBLY_NEEDS_STREAM);
  }

  return finish(data, sink, options);
}

/** Close yükü: 0 bayt ya da 2 bayt durum kodu + UTF-8 gerekçe (§5.5.1). */
function parseClosePayload(payload: Uint8Array, payloadOffset: number, sink: Sink): void {
  if (payload.length === 0) return;

  if (payload.length < CLOSE_STATUS_LENGTH) {
    // Tek baytlık Close yükü geçersizdir; durum kodu 16 bittir.
    pushWarning(sink, WARN_CLOSE_PAYLOAD_TOO_SHORT);
    return;
  }

  const status = ((payload[0] ?? 0) << 8) | (payload[1] ?? 0);
  const statusName = CLOSE_STATUS_NAMES.get(status);
  const statusField: ParsedField = {
    id: 'close-status',
    name: 'Close Status Code',
    offset: payloadOffset,
    length: CLOSE_STATUS_LENGTH,
    rawBytes: payload.slice(0, CLOSE_STATUS_LENGTH),
    rawValue: status,
    valid: !RESERVED_CLOSE_STATUSES.has(status),
    warnings: [],
  };
  if (statusName !== undefined) statusField.physicalValue = statusName;

  if (RESERVED_CLOSE_STATUSES.has(status)) {
    // 1005/1006/1015 yerel kullanım içindir, TELDE GÖRÜNEMEZ (§7.4.1).
    statusField.warnings = [WARN_CLOSE_STATUS_RESERVED];
    pushWarning(sink, WARN_CLOSE_STATUS_RESERVED);
  } else if (statusName === undefined) {
    statusField.warnings = [WARN_CLOSE_STATUS_UNKNOWN];
    pushWarning(sink, WARN_CLOSE_STATUS_UNKNOWN);
  }
  sink.fields.push(statusField);

  const reasonBytes = payload.slice(CLOSE_STATUS_LENGTH);
  if (reasonBytes.length === 0) return;

  const reason = decodeUtf8Strict(reasonBytes);
  const reasonField: ParsedField = {
    id: 'close-reason',
    name: 'Close Reason',
    offset: payloadOffset + CLOSE_STATUS_LENGTH,
    length: reasonBytes.length,
    rawBytes: reasonBytes,
    valid: reason !== undefined,
    warnings: [],
  };
  if (reason !== undefined) reasonField.rawValue = reason;
  else {
    reasonField.rawValue = `0x${formatHex(reasonBytes)}`;
    reasonField.warnings = [WARN_TEXT_NOT_VALID_UTF8];
    pushWarning(sink, WARN_TEXT_NOT_VALID_UTF8);
  }
  sink.fields.push(reasonField);
}

function finish(data: Uint8Array, sink: Sink, options: WebSocketParseOptions): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: sink.errors.length === 0,
    errors: sink.errors,
    warnings: sink.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseWebSocket(data: Uint8Array): ParseResult {
  return parseWebSocketFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): WebSocketParseOptions {
  const options: WebSocketParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const webSocketParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: iki bayt var mı ve el sıkışma metni DEĞİL mi. Opcode
   * yoklanmaz — ayrılmış değerler `parse`de uyarıyla geçer. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && !looksLikeHandshake(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseWebSocketFrame(data, readContextOptions(context));
  },
};

function textBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** İstemci çerçevesi kurar: maskeler ve maske anahtarını başa yazar. */
function maskedFrame(opcode: number, payload: readonly number[], key: readonly number[]): number[] {
  const masked = payload.map((byte, index) => byte ^ (key[index % MASKING_KEY_LENGTH] ?? 0));
  return [FIN_MASK | opcode, MASK_FLAG | payload.length, ...key, ...masked];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'server-text',
    name: 'protocol.websocket.example.serverText.name',
    // Sunucu→istemci: maskesiz (RFC 6455 §5.1).
    bytes: Uint8Array.from([FIN_MASK | OPCODE_TEXT, 5, ...textBytes('hello')]),
    description: 'protocol.websocket.example.serverText.description',
    expectedValid: true,
  },
  {
    id: 'client-masked-text',
    name: 'protocol.websocket.example.clientMaskedText.name',
    // İstemci→sunucu: maskeli. Yük XOR'la açılır.
    bytes: Uint8Array.from(maskedFrame(OPCODE_TEXT, textBytes('merhaba'), [0x37, 0xfa, 0x21, 0x3d])),
    description: 'protocol.websocket.example.clientMaskedText.description',
    expectedValid: true,
  },
  {
    id: 'fragment-start',
    name: 'protocol.websocket.example.fragmentStart.name',
    // FIN=0: parça başlangıcı, birleştirme çok-çerçeve işi.
    bytes: Uint8Array.from([OPCODE_TEXT, 4, ...textBytes('part')]),
    description: 'protocol.websocket.example.fragmentStart.description',
    expectedValid: true,
  },
  {
    id: 'close-normal',
    name: 'protocol.websocket.example.closeNormal.name',
    // 1000 Normal Closure + UTF-8 gerekçe.
    bytes: Uint8Array.from([FIN_MASK | OPCODE_CLOSE, 5, 0x03, 0xe8, ...textBytes('bye')]),
    description: 'protocol.websocket.example.closeNormal.description',
    expectedValid: true,
  },
  {
    id: 'ping',
    name: 'protocol.websocket.example.ping.name',
    bytes: Uint8Array.from([FIN_MASK | OPCODE_PING, 4, ...textBytes('ping')]),
    description: 'protocol.websocket.example.ping.description',
    expectedValid: true,
  },
  {
    id: 'extended-length',
    name: 'protocol.websocket.example.extendedLength.name',
    // 200 baytlık yük: uzunluk kodu 126, ardından 16 bitlik gerçek uzunluk.
    bytes: Uint8Array.from([
      FIN_MASK | OPCODE_BINARY,
      LENGTH_EXTENDED_16,
      0x00,
      0xc8,
      ...new Array<number>(200).fill(0xab),
    ]),
    description: 'protocol.websocket.example.extendedLength.description',
    expectedValid: true,
  },
  {
    id: 'control-frame-too-long',
    name: 'protocol.websocket.example.controlFrameTooLong.name',
    // Ping 126 bayt: kontrol çerçevesi 125'i AŞAMAZ. Hata yolu.
    bytes: Uint8Array.from([
      FIN_MASK | OPCODE_PING,
      LENGTH_EXTENDED_16,
      0x00,
      0x7e,
      ...new Array<number>(126).fill(0x00),
    ]),
    description: 'protocol.websocket.example.controlFrameTooLong.description',
    expectedValid: false,
  },
  {
    id: 'handshake-text',
    name: 'protocol.websocket.example.handshakeText.name',
    // El sıkışması HTTP'dir, çerçeve değil — HTTP sayfasında çözülür.
    bytes: Uint8Array.from(
      textBytes('GET /ws HTTP/1.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\n\r\n'),
    ),
    description: 'protocol.websocket.example.handshakeText.description',
    expectedValid: false,
  },
];

export const webSocketPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: webSocketParser,
  documentation: {
    summary: 'protocol.websocket.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
