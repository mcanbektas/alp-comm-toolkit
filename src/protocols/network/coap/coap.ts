/**
 * CoAP (Constrained Application Protocol, RFC 7252) — UDP üzerinde REST-tarzı
 * mesajlaşma. 4 baytlık sabit başlık + opsiyonel Token + Options listesi +
 * opsiyonel 0xFF payload marker'ı ve payload (brief-faz10-dalga4.md, 4d).
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * `docs/spec/` başlığın BİT DİYAGRAMINI (Ver/T/TKL, Code, Message ID) ve
 * mesaj tiplerini (CON/NON/ACK/RST) + Code'un "class.detail" gösterimini VERİR
 * (spec ~29073-29138, ~29177-29198) — ama option delta/length'in COMPACT
 * ENCODING'inin bit/bayt açılımı (13/14/15 nibble kuralları, +13/+269 ofsetleri)
 * spec'te YOK; bu yüzden dış kaynak RFC 7252 §3.1'dir (IETF, kamuya açık).
 * Option Number → ad eşlemesi RFC 7252'nin KENDİ temel option tablosuyla
 * (§5.10) SINIRLIDIR — Observe(6)/Block1(27)/Block2(23)/Size2(28) gibi RFC
 * 7641/7959 UZANTILARI bilerek DAR kümeye GİRMEZ (brief madde 5): tanınmayan
 * option numarası her zaman ham + uyarı yoluna düşer, uydurma isim YOK.
 *
 * ── GİRDİ: TEK CoAP MESAJI ────────────────────────────────────────────────────
 * UDP datagramı zaten mesaj sınırını verir (TCP'nin aksine stream birleştirme
 * YOK, dalga 1 çizgisi burada da geçerli). `data` uzunluğu mesajın TAMAMIDIR —
 * MQTT/RTCM'nin aksine ayrı bir "remaining length" alanı yoktur, bu yüzden
 * "trailing data" kavramı bu motorda YOK.
 *
 * ── TKL 9-15: HATA, Ver ≠ 1: UYARI ────────────────────────────────────────────
 * RFC 7252 §3: TKL 9-15 "a message format error" — Token Length rezerve değer
 * taşıyorsa Token/Options/Payload GÜVENLE ayrıştırılamaz (Token'ın kaç bayt
 * olduğu bilinmez), bu yüzden HATA ve motor orada durur (yalnız temel başlık
 * alanları — Version/Type/TKL/Code/Message ID — kısmi çözüm olarak gösterilir).
 * Version ≠ 1 ise spec'in kendisi "future version" tonu taşır — sessiz ret YOK,
 * yalnız UYARI; çözümleme normal şekilde DEVAM eder.
 *
 * ── OPTIONS: KÜMÜLATİF NUMARA, 15 NIBBLE'I YALNIZ MARKER BAĞLAMINDA ──────────
 * Her option `[delta(4 bit) | length(4 bit)]` baytıyla başlar; 13/14 nibble'ı
 * bir/iki ek bayt (+13/+269) ile GENİŞLER. Option Number önceki delta'ların
 * TOPLAMIDIR (ilk option'da delta = doğrudan numara). Nibble 15 YALNIZ option
 * baytının kendisi TAM OLARAK 0xFF ise (payload marker) geçerlidir — delta VEYA
 * length'te TEK BAŞINA 15 (öbürü ≠15) görülmesi "message format error"dur
 * (RFC 7252 §3.1) ve motor o noktada durur (kalan baytlar ham + hata alanı).
 * 0xFF görülüp ARDINDAN hiç bayt gelmezse de aynı şekilde hata (RFC: marker
 * varsa payload zorunlu).
 *
 * ── KAPSAM DIŞI (bilinçli) ────────────────────────────────────────────────────
 * • Option DEĞERLERİNİN tip-bağımlı çözümü (Uri-Path'i UTF-8 metne, Content-
 *   Format'ı sayıya çevirme gibi): brief yalnız NUMARA→AD eşlemesini ister,
 *   değer baytları ham gösterilir (`rawBytes`), MQTT Properties'in aksine tip
 *   tablosu bu turda YOK.
 * • Observe (RFC 7641) / Block1-Block2 (RFC 7959) akışları ÇÖZÜLMEZ — yalnız
 *   option NUMARASI görülür, o numaralar dar ad kümesinde OLMADIĞI için
 *   otomatik olarak "tanınmayan option" yoluna düşerler (brief madde 5, ekstra
 *   kod YAZILMADI).
 * • CON→ACK yeniden gönderim/timeout, retransmission: çok mesajlık oturum
 *   analizi, parser'a girmez (dalga 1 çizgisi).
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'coap';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CoAP';

const HEADER_LENGTH = 4;

const VERSION_BIT_POSITION = 0;
const VERSION_BIT_LENGTH = 2;
const TYPE_BIT_POSITION = 2;
const TYPE_BIT_LENGTH = 2;
const TKL_BIT_POSITION = 4;
const TKL_BIT_LENGTH = 4;
const CODE_BIT_POSITION = 8;
const CODE_BIT_LENGTH = 8;
const MESSAGE_ID_BIT_POSITION = 16;
const MESSAGE_ID_BIT_LENGTH = 16;

const CODE_OFFSET = 1;
const MESSAGE_ID_OFFSET = 2;
const MESSAGE_ID_LENGTH = 2;

const EXPECTED_VERSION = 1;
const MAX_VALID_TKL = 8;

const CODE_CLASS_SHIFT = 5;
const CODE_DETAIL_MASK = 0x1f;
const CODE_DETAIL_DIGITS = 2;

/** RFC 7252 §3: 2 bitlik Type alanının dört değeri — kapalı küme, hepsi geçerli. */
const TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'CON'],
  [1, 'NON'],
  [2, 'ACK'],
  [3, 'RST'],
]);

/**
 * RFC 7252 §5.10'un TEMEL option tablosu — dosya başı "Options" bölümüne bak:
 * Observe/Block1/Block2/Size2 gibi sonraki RFC'lerin uzantı numaraları BİLEREK
 * YOK; bu liste dışındaki her numara "tanınmayan option" yoluna düşer.
 */
const COAP_OPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'If-Match'],
  [3, 'Uri-Host'],
  [4, 'ETag'],
  [5, 'If-None-Match'],
  [7, 'Uri-Port'],
  [8, 'Location-Path'],
  [11, 'Uri-Path'],
  [12, 'Content-Format'],
  [14, 'Max-Age'],
  [15, 'Uri-Query'],
  [17, 'Accept'],
  [20, 'Location-Query'],
  [35, 'Proxy-Uri'],
  [39, 'Proxy-Scheme'],
  [60, 'Size1'],
]);

const PAYLOAD_MARKER = 0xff;
/** Option delta/length nibble kuralları (RFC 7252 §3.1). */
const OPTION_EXT13_NIBBLE = 13;
const OPTION_EXT13_OFFSET = 13;
const OPTION_EXT14_NIBBLE = 14;
const OPTION_EXT14_OFFSET = 269;
const OPTION_RESERVED_NIBBLE = 15;

const ERROR_HEADER_TRUNCATED = 'protocol.coap.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.coap.error.frameTooLong';
const ERROR_ABORTED = 'protocol.coap.error.aborted';
const ERROR_TKL_RESERVED = 'protocol.coap.error.tokenLengthReserved';
const ERROR_TOKEN_TRUNCATED = 'protocol.coap.error.tokenTruncated';
const ERROR_OPTION_TRUNCATED = 'protocol.coap.error.optionTruncated';
const ERROR_OPTION_NIBBLE_RESERVED = 'protocol.coap.error.optionNibbleReserved';
const ERROR_PAYLOAD_MARKER_EMPTY = 'protocol.coap.error.payloadMarkerEmpty';

const WARN_VERSION_UNEXPECTED = 'protocol.coap.warning.versionUnexpected';
const WARN_UNKNOWN_OPTION = 'protocol.coap.warning.unknownOption';

const SUMMARY_FRAME = 'protocol.coap.summary.frame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** Code baytını RFC 7252 §3'ün "c.dd" gösterimine çevirir (spec 29177: ham + semantik). */
function formatCode(code: number): string {
  const codeClass = (code >>> CODE_CLASS_SHIFT) & 0x07;
  const detail = code & CODE_DETAIL_MASK;
  return `${String(codeClass)}.${String(detail).padStart(CODE_DETAIL_DIGITS, '0')}`;
}

interface OptionExtension {
  readonly value: number;
  readonly bytesConsumed: number;
}

/**
 * Delta/length nibble'ının extended-value kuralını uygular (RFC 7252 §3.1):
 * 13 → 1 ek bayt (+13), 14 → 2 ek bayt BE (+269), 0-12 → nibble doğrudan değer.
 * 15 çağıran tarafından ELENMİŞ olmalı (yalnız payload marker bağlamında geçerli).
 * Tampon ek baytlara yetmezse `undefined` — çağıran bunu kesme (truncated) sayar.
 */
function readOptionExtension(data: Uint8Array, pos: number, nibble: number): OptionExtension | undefined {
  if (nibble === OPTION_EXT13_NIBBLE) {
    if (pos + 1 > data.length) return undefined;
    return { value: byteAt(data, pos) + OPTION_EXT13_OFFSET, bytesConsumed: 1 };
  }
  if (nibble === OPTION_EXT14_NIBBLE) {
    if (pos + 2 > data.length) return undefined;
    return { value: readUint16BE(data, pos) + OPTION_EXT14_OFFSET, bytesConsumed: 2 };
  }
  return { value: nibble, bytesConsumed: 0 };
}

/** Kesilmiş/geçersiz bir option'da kalan tüm baytları TEK ham hata alanı yapar. */
function pushOptionError(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  errors: ProtocolError[],
  message: string,
  code: ProtocolErrorCode,
): void {
  const remaining = data.slice(offset);
  fields.push({
    id: `option-${String(offset)}`,
    name: 'Option',
    offset,
    length: remaining.length,
    rawBytes: remaining,
    valid: false,
    warnings: [message],
  });
  errors.push({ code, message, offset, length: remaining.length });
}

/**
 * Token'dan sonraki Options döngüsü + 0xFF payload marker + Payload. RFC
 * 7252 §3.1 kümülatif Option Number kuralı: `optionNumber` her başarılı
 * option'dan sonra delta kadar ARTAR, bir sonraki option'a TAŞINIR.
 */
function parseOptionsAndPayload(
  data: Uint8Array,
  startPos: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  let pos = startPos;
  let optionNumber = 0;

  while (pos < data.length) {
    const optionByte = byteAt(data, pos);

    if (optionByte === PAYLOAD_MARKER) {
      const markerOffset = pos;
      const hasPayload = markerOffset + 1 < data.length;
      fields.push({
        id: 'payload-marker',
        name: 'Payload Marker',
        offset: markerOffset,
        length: 1,
        rawBytes: data.slice(markerOffset, markerOffset + 1),
        rawValue: PAYLOAD_MARKER,
        valid: hasPayload,
        warnings: hasPayload ? [] : [ERROR_PAYLOAD_MARKER_EMPTY],
      });
      if (!hasPayload) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_PAYLOAD_MARKER_EMPTY,
          offset: markerOffset,
          length: 1,
        });
        return;
      }
      const payload = data.slice(markerOffset + 1);
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: markerOffset + 1,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [],
      });
      return;
    }

    const deltaNibble = (optionByte >>> 4) & 0x0f;
    const lengthNibble = optionByte & 0x0f;

    // 15 yalnız TAM 0xFF baytında (yukarıda elendi) geçerlidir — burada tek
    // başına görülmesi RFC 7252'nin "message format error"udur.
    if (deltaNibble === OPTION_RESERVED_NIBBLE || lengthNibble === OPTION_RESERVED_NIBBLE) {
      pushOptionError(data, pos, fields, errors, ERROR_OPTION_NIBBLE_RESERVED, 'value-out-of-range');
      return;
    }

    let cursor = pos + 1;

    const deltaExt = readOptionExtension(data, cursor, deltaNibble);
    if (deltaExt === undefined) {
      pushOptionError(data, pos, fields, errors, ERROR_OPTION_TRUNCATED, 'truncated-frame');
      return;
    }
    cursor += deltaExt.bytesConsumed;

    const lengthExt = readOptionExtension(data, cursor, lengthNibble);
    if (lengthExt === undefined) {
      pushOptionError(data, pos, fields, errors, ERROR_OPTION_TRUNCATED, 'truncated-frame');
      return;
    }
    cursor += lengthExt.bytesConsumed;

    if (cursor + lengthExt.value > data.length) {
      pushOptionError(data, pos, fields, errors, ERROR_OPTION_TRUNCATED, 'truncated-frame');
      return;
    }

    optionNumber += deltaExt.value;
    const optionEnd = cursor + lengthExt.value;
    const knownName = COAP_OPTION_NAMES.get(optionNumber);
    const optionField: ParsedField = {
      id: `option-${String(pos)}`,
      name: knownName ?? 'Unknown Option',
      offset: pos,
      length: optionEnd - pos,
      rawBytes: data.slice(pos, optionEnd),
      rawValue: optionNumber,
      valid: true,
      warnings: [],
    };
    if (knownName === undefined) {
      optionField.warnings.push(WARN_UNKNOWN_OPTION);
      warnings.push(toProtocolWarning(WARN_UNKNOWN_OPTION));
    }
    fields.push(optionField);

    pos = optionEnd;
  }
}

interface CoapParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

export type CoapFrameMetadata = {
  type: number;
  typeName: string | undefined;
  code: number;
  codeFormatted: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: CoapParseOptions,
  metadata: CoapFrameMetadata,
): ParseResult {
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

function parseCoapFrame(data: Uint8Array, options: CoapParseOptions): ParseResult {
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
      error: { code: 'truncated-frame', message: ERROR_HEADER_TRUNCATED, offset: 0, length: data.length },
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

  const version = readBitsAsNumber(data, VERSION_BIT_POSITION, VERSION_BIT_LENGTH);
  const versionValid = version === EXPECTED_VERSION;
  const versionField: ParsedField = {
    id: 'version',
    name: 'Version',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: version,
    valid: versionValid,
    warnings: [],
  };
  if (!versionValid) {
    versionField.warnings.push(WARN_VERSION_UNEXPECTED);
    warnings.push(toProtocolWarning(WARN_VERSION_UNEXPECTED));
  }
  fields.push(versionField);

  const type = readBitsAsNumber(data, TYPE_BIT_POSITION, TYPE_BIT_LENGTH);
  const typeName = TYPE_NAMES.get(type);
  const typeField: ParsedField = {
    id: 'type',
    name: 'Type',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: type,
    valid: true,
    warnings: [],
  };
  if (typeName !== undefined) {
    typeField.physicalValue = typeName;
  }
  fields.push(typeField);

  const tkl = readBitsAsNumber(data, TKL_BIT_POSITION, TKL_BIT_LENGTH);
  const tklValid = tkl <= MAX_VALID_TKL;
  const tklField: ParsedField = {
    id: 'token-length',
    name: 'Token Length',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: tkl,
    valid: tklValid,
    warnings: [],
  };
  if (!tklValid) {
    tklField.warnings.push(ERROR_TKL_RESERVED);
  }
  fields.push(tklField);

  const code = readBitsAsNumber(data, CODE_BIT_POSITION, CODE_BIT_LENGTH);
  const codeFormatted = formatCode(code);
  fields.push({
    id: 'code',
    name: 'Code',
    offset: CODE_OFFSET,
    length: 1,
    rawBytes: data.slice(CODE_OFFSET, CODE_OFFSET + 1),
    rawValue: code,
    physicalValue: codeFormatted,
    valid: true,
    warnings: [],
  });

  const messageId = readBitsAsNumber(data, MESSAGE_ID_BIT_POSITION, MESSAGE_ID_BIT_LENGTH);
  fields.push({
    id: 'message-id',
    name: 'Message ID',
    offset: MESSAGE_ID_OFFSET,
    length: MESSAGE_ID_LENGTH,
    rawBytes: data.slice(MESSAGE_ID_OFFSET, MESSAGE_ID_OFFSET + MESSAGE_ID_LENGTH),
    rawValue: messageId,
    valid: true,
    warnings: [],
  });

  const metadata: CoapFrameMetadata = {
    type,
    typeName,
    code,
    codeFormatted,
    summaryKey: SUMMARY_FRAME,
    summaryParams: { type: typeName ?? String(type), code: codeFormatted },
  };

  if (!tklValid) {
    // RFC 7252 §3: TKL 9-15 "message format error" — Token'ın kaç bayt olduğu
    // bilinmediği için Token/Options/Payload'a hiç GİRİLMEZ (dosya başı).
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_TKL_RESERVED,
      offset: 0,
      length: 1,
      details: { tokenLength: tkl },
    });
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  let pos = HEADER_LENGTH;
  if (tkl > 0) {
    if (pos + tkl > data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TOKEN_TRUNCATED,
        offset: pos,
        length: data.length - pos,
        details: { tokenLength: tkl },
      });
      return finishFrame(data, fields, warnings, errors, options, metadata);
    }
    fields.push({
      id: 'token',
      name: 'Token',
      offset: pos,
      length: tkl,
      rawBytes: data.slice(pos, pos + tkl),
      valid: true,
      warnings: [],
    });
    pos += tkl;
  }

  parseOptionsAndPayload(data, pos, fields, warnings, errors);

  return finishFrame(data, fields, warnings, errors, options, metadata);
}

export function parseCoap(data: Uint8Array): ParseResult {
  return parseCoapFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): CoapParseOptions {
  const options: CoapParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const coapParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + TKL nibble'ının rezerve (9-15) olmaması. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    const tkl = byteAt(data, 0) & 0x0f;
    return tkl <= MAX_VALID_TKL;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseCoapFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'get-request',
    name: 'protocol.coap.example.getRequest.name',
    // CON, Token yok, Code=GET(0.01), Uri-Path="temp" tek segment. Bayt dizisi
    // elle hesaplandı: 0x40=Ver1/CON/TKL0, 0x01=GET, MID=0x1234, option
    // 0xB4=delta11/length4 ("temp" 4 bayt) — coap.test.ts bağımsız doğrular.
    bytes: Uint8Array.from([0x40, 0x01, 0x12, 0x34, 0xb4, 0x74, 0x65, 0x6d, 0x70]),
    description: 'protocol.coap.example.getRequest.description',
    expectedValid: true,
  },
  {
    id: 'content-response',
    name: 'protocol.coap.example.contentResponse.name',
    // ACK, TKL=2 (Token 0xABCD, isteği eşler), Code=2.05 Content, Content-Format
    // option (0xC1 0x00 = text/plain), 0xFF marker + Payload "23.5".
    bytes: Uint8Array.from([
      0x62, 0x45, 0x12, 0x34, 0xab, 0xcd, 0xc1, 0x00, 0xff, 0x32, 0x33, 0x2e, 0x35,
    ]),
    description: 'protocol.coap.example.contentResponse.description',
    expectedValid: true,
  },
  {
    id: 'multiple-uri-path',
    name: 'protocol.coap.example.multipleUriPath.name',
    // CON, GET /sensors/temp — iki Uri-Path option'ı, İKİNCİSİNİN delta'sı 0
    // (aynı option numarası 11 kümülatif olarak korunur).
    bytes: Uint8Array.from([
      0x40, 0x01, 0x00, 0x02, 0xb7, 0x73, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x73, 0x04, 0x74, 0x65, 0x6d,
      0x70,
    ]),
    description: 'protocol.coap.example.multipleUriPath.description',
    expectedValid: true,
  },
  {
    id: 'unrecognized-option',
    name: 'protocol.coap.example.unrecognizedOption.name',
    // NON, GET, Observe(6) option'ı — RFC 7641 uzantısı, dar ad kümesinde YOK
    // (dosya başı) — ham + uyarı yoluna düşer, çerçeve yine valid kalır.
    bytes: Uint8Array.from([0x50, 0x01, 0x00, 0x03, 0x61, 0x00]),
    description: 'protocol.coap.example.unrecognizedOption.description',
    expectedValid: true,
  },
  {
    id: 'token-length-reserved',
    name: 'protocol.coap.example.tokenLengthReserved.name',
    // TKL=9: RFC 7252'nin rezerve bıraktığı aralık (9-15) — hata yolu, Token/
    // Options'a hiç girilmez.
    bytes: Uint8Array.from([0x49, 0x01, 0x00, 0x04]),
    description: 'protocol.coap.example.tokenLengthReserved.description',
    expectedValid: false,
  },
  {
    id: 'payload-marker-empty',
    name: 'protocol.coap.example.payloadMarkerEmpty.name',
    // 0xFF marker'dan sonra tek bir bayt bile yok — RFC 7252: marker varsa
    // payload zorunlu, hata yolu.
    bytes: Uint8Array.from([0x40, 0x01, 0x00, 0x05, 0xff]),
    description: 'protocol.coap.example.payloadMarkerEmpty.description',
    expectedValid: false,
  },
  {
    id: 'option-nibble-reserved',
    name: 'protocol.coap.example.optionNibbleReserved.name',
    // Option baytı 0xF0: delta nibble'ı 15 ama bayt TAM 0xFF değil (length
    // nibble'ı 0) — payload marker bağlamı dışında 15, "message format error".
    bytes: Uint8Array.from([0x40, 0x01, 0x00, 0x06, 0xf0]),
    description: 'protocol.coap.example.optionNibbleReserved.description',
    expectedValid: false,
  },
];

export const coapPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: coapParser,
  documentation: {
    summary: 'protocol.coap.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
