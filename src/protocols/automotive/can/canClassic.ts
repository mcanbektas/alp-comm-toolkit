/**
 * Classical CAN taşıma katmanı — CAN 2.0A (CBFF) ve CAN 2.0B (CEFF).
 *
 * İKİ PLUGIN, TEK PARSER: 2.0A ile 2.0B'nin tel biçimi AYNIDIR, ayrım yalnız
 * identifier genişliğidir (11 bit base / 29 bit extended) ve SocketCAN'de bu
 * ayrım `can_id`in EFF bayrağında taşınır. Modbus'ta üç taşıma üç ayrı dosyaydı
 * çünkü çerçeveleme gerçekten farklıydı; burada ayrı dosya yazmak aynı parser'ı
 * iki kez kopyalamak olurdu. Taksonomi de ikisini "birleşik Classical CAN
 * görünümü" diye anıyor.
 *
 * Sayfanın beklediği biçim ile çerçevenin biçimi uyuşmazsa HATA ÜRETİLMEZ,
 * uyarı basılır: CAN 2.0A sayfasına extended bir çerçeve yapıştıran kullanıcı
 * "çözülemedi" değil, "bu extended bir çerçeve" cevabını hak eder.
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
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_CLASSIC_MAX_PAYLOAD,
  CAN_EFF_MASK,
  CAN_HEADER_LENGTH,
  CAN_RTR_FLAG,
  CAN_SFF_MASK,
  approximateFrameBits,
  decodeCanId,
  decodeSocketCanFrame,
  readUint32Le,
} from './canFrame';

/** Kayıt defterindeki ve katalogdaki kimliklerle AYNI olmak zorunda: bağ bu string. */
const BASE_PROTOCOL_ID = 'can-2-0a';
const EXTENDED_PROTOCOL_ID = 'can-2-0b';
/** Protokol adları veridir, çeviriye girmez (CLAUDE.md). */
const BASE_DISPLAY_NAME = 'CAN 2.0A';
const EXTENDED_DISPLAY_NAME = 'CAN 2.0B';

/** `can_id` alanının bayt genişliği — encoder'ın gövdesinde de ilk dört bayt odur. */
const CAN_IDENTIFIER_WORD_LENGTH = 4;

const ERROR_FRAME_TOO_SHORT = 'protocol.can.classic.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.can.classic.error.frameTooLong';
const ERROR_ABORTED = 'protocol.can.classic.error.aborted';

/**
 * Çerçeve seviyesinde taşınan ek bilgi. `ParsedFrame`de özet alanı YOKTUR
 * (spec §7) ve sözleşmeye alan eklenmez; `interface` DEĞİL `type` çünkü
 * `RawFrame.metadata` `Record<string, unknown>` ve arayüzler örtük indeks
 * imzası taşımaz.
 */
export type CanClassicFrameMetadata = {
  canId: number;
  extended: boolean;
  remote: boolean;
  errorFrame: boolean;
  payloadLength: number;
  /** Spec §17.2'nin YAKLAŞIK çerçeve bit sayısı — stuff bitleri hariç. */
  approximateFrameBits: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

/** `ProtocolWarning.code` ile `message` aynı çeviri anahtarını taşır (modbusRtu.ts ile aynı gerekçe). */
function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

interface CanClassicParseOptions {
  expectedFormat?: 'base' | 'extended';
  suggestHigherLayers?: boolean;
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseClassicFrame(
  data: Uint8Array,
  protocolId: string,
  options: CanClassicParseOptions,
): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil: fırlatmak yerine kodla döner (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
    // `consumedBytes: 0` + `recoverable: true` = "daha çok veri bekle".
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
    // `struct can_frame` SABİT boyludur; fazlası kayıt sınırının kaymış olması
    // demektir. Buffer ayrılmadan durulur (spec §41).
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

  const decodeOptions = {
    kind: 'classic' as const,
    ...(options.expectedFormat === undefined ? {} : { expectedFormat: options.expectedFormat }),
    ...(options.suggestHigherLayers === undefined
      ? {}
      : { suggestHigherLayers: options.suggestHigherLayers }),
  };
  const decoded = decodeSocketCanFrame(data, decodeOptions);

  const warnings: ProtocolWarning[] = decoded.warnings.map(toProtocolWarning);
  const errors: ProtocolError[] = [];

  const metadata: CanClassicFrameMetadata = {
    canId: decoded.identity.id,
    extended: decoded.identity.extended,
    remote: decoded.identity.remote,
    errorFrame: decoded.identity.errorFrame,
    payloadLength: decoded.payloadLength,
    approximateFrameBits: approximateFrameBits(
      decoded.payloadLength,
      decoded.identity.extended,
    ),
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
    protocol: protocolId,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: [...decoded.fields],
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/** Tek bir Classical CAN kaydını çözer. `data` TAM bir `struct can_frame` olmalıdır. */
export function parseCanClassic(data: Uint8Array, expectedFormat?: 'base' | 'extended'): ParseResult {
  return parseClassicFrame(
    data,
    expectedFormat === 'extended' ? EXTENDED_PROTOCOL_ID : BASE_PROTOCOL_ID,
    expectedFormat === undefined ? {} : { expectedFormat },
  );
}

function readContextOptions(context: ParseContext | undefined): CanClassicParseOptions {
  const options: CanClassicParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

/**
 * `canParse` UCUZ olmak zorunda: otomatik tanımada 172 parser'a sırayla
 * soruluyor (spec §7). Yalnız uzunluk aralığı ve identifier'ın kendi biçimi
 * okunur; payload doğrulaması `parse`a bırakılır.
 */
function canParseClassic(data: Uint8Array, expectExtended: boolean): boolean {
  if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
    return false;
  }
  return decodeCanId(readUint32Le(data, 0)).extended === expectExtended;
}

export const can20aParser: ProtocolParser = {
  protocolId: BASE_PROTOCOL_ID,
  displayName: BASE_DISPLAY_NAME,
  canParse(data: Uint8Array): boolean {
    return canParseClassic(data, false);
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseClassicFrame(data, BASE_PROTOCOL_ID, {
      ...readContextOptions(context),
      expectedFormat: 'base',
    });
  },
};

export const can20bParser: ProtocolParser = {
  protocolId: EXTENDED_PROTOCOL_ID,
  displayName: EXTENDED_DISPLAY_NAME,
  canParse(data: Uint8Array): boolean {
    return canParseClassic(data, true);
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseClassicFrame(data, EXTENDED_PROTOCOL_ID, {
      ...readContextOptions(context),
      expectedFormat: 'extended',
      // Spec: 29-bit ID tek başına protokol kanıtı değildir; sayfa adayları söyler.
      suggestHigherLayers: true,
    });
  },
};

/**
 * `struct can_frame` üretir — örnek çerçeveler elle hex yazılmak yerine
 * buradan kurulur ki `can_id`in little-endian sırası tek yerde yaşasın.
 * Yanlış sırada yazılmış tek bir örnek, ekranda tamamen başka bir identifier
 * gösterirdi.
 */
export function buildCanClassicFrame(
  canId: number,
  payload: readonly number[],
  flags: { extended?: boolean; remote?: boolean } = {},
): Uint8Array {
  const frame = new Uint8Array(CAN_CLASSIC_FRAME_LENGTH);
  let rawId = canId >>> 0;
  if (flags.extended === true) rawId = (rawId | 0x80000000) >>> 0;
  if (flags.remote === true) rawId = (rawId | 0x40000000) >>> 0;
  frame[0] = rawId & 0xff;
  frame[1] = (rawId >>> 8) & 0xff;
  frame[2] = (rawId >>> 16) & 0xff;
  frame[3] = (rawId >>> 24) & 0xff;
  frame[4] = payload.length;
  for (let index = 0; index < payload.length; index += 1) {
    frame[CAN_HEADER_LENGTH + index] = payload[index] ?? 0;
  }
  return frame;
}

/**
 * ENCODER'IN GİRDİSİ: 4 baytlık identifier sözcüğü (SocketCAN düzeninde,
 * little-endian) + en çok 8 veri baytı. Çıktı `struct can_frame`in tamamıdır;
 * DLC ile 16 bayta kadarki dolgu BURADA hesaplanır (spec §33'ün "NMEA heading →
 * CAN signal" dönüşümünün hedef tarafı).
 *
 * Neden ham çerçeve değil de gövde alınıyor: DLC veri uzunluğundan
 * TÜRETİLEBİLİR, dolayısıyla çağırana sormak onu gövdeyle çelişebilir hâle
 * getirmek olurdu — Modbus encoder'larının CRC/Length gerekçesiyle aynı.
 *
 * **Format biti çağırandan alınmaz, SAYFADAN gelir.** 2.0A base, 2.0B extended
 * çerçeve üretir; identifier sözcüğünde ne yazarsa yazsın EFF biti sayfanın
 * biçimine göre yazılır. Aksi hâlde 2.0B sayfası base çerçeve üretebilir ve
 * `can20bParser` kendi ürettiğimiz çerçeveye "biçim uyuşmuyor" uyarısı basardı.
 * RTR biti çağıranındır: uzaktan istek çerçevesi meşru bir üretimdir.
 */
function encodeCanClassicFrame(body: Uint8Array, extended: boolean): Uint8Array {
  const label = extended ? 'encodeCanExtendedFrame' : 'encodeCanBaseFrame';
  if (body.length < CAN_IDENTIFIER_WORD_LENGTH) {
    throw new RangeError(`${label}: gövde en az ${CAN_IDENTIFIER_WORD_LENGTH} bayt olmalı (identifier sözcüğü)`);
  }

  const payload = body.subarray(CAN_IDENTIFIER_WORD_LENGTH);
  if (payload.length > CAN_CLASSIC_MAX_PAYLOAD) {
    throw new RangeError(
      `${label}: veri ${payload.length} bayt, Classical CAN üst sınırı ${CAN_CLASSIC_MAX_PAYLOAD}`,
    );
  }

  const rawId = readUint32Le(body, 0);
  const identifier = rawId & (extended ? CAN_EFF_MASK : CAN_SFF_MASK);
  // Base çerçevede 11 bitin ÜSTÜ sessizce kırpılsaydı, kullanıcının yazdığından
  // BAŞKA bir ID kabloya çıkardı — susarak yanlış çerçeve üretmektense hata.
  if (!extended && (rawId & CAN_EFF_MASK) !== identifier) {
    throw new RangeError(
      `${label}: identifier 0x${(rawId & CAN_EFF_MASK).toString(16).toUpperCase()} base formatın 11 bitine sığmıyor`,
    );
  }

  return buildCanClassicFrame(identifier, Array.from(payload), {
    extended,
    remote: (rawId & CAN_RTR_FLAG) !== 0,
  });
}

/** CAN 2.0A (base, 11 bit) çerçevesi üretir. Girdi için bkz. yukarısı. */
export function encodeCanBaseFrame(body: Uint8Array): Uint8Array {
  return encodeCanClassicFrame(body, false);
}

/** CAN 2.0B (extended, 29 bit) çerçevesi üretir. Girdi için bkz. yukarısı. */
export function encodeCanExtendedFrame(body: Uint8Array): Uint8Array {
  return encodeCanClassicFrame(body, true);
}

/**
 * Örnek çerçeveler spec §42 madde 4'ün "örnek veri"sidir; adlar/açıklamalar
 * çeviri anahtarı, baytlar veridir. Tüketici bu dizileri DEĞİŞTİRMEMELİ —
 * plugin nesnesi tekildir, paylaşılır.
 *
 * Spec §43 CAN için ham çerçeve fixture'ı VERMİYOR (tek CAN tabanlı referans
 * değer J1939 identifier'ıdır), bu yüzden örnekler spec §3.4'ün METİN İÇİNDEKİ
 * çerçeve örneklerinden alındı ve testler bunları gerçek motorla doğruluyor.
 */
const BASE_EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'base-data-frame',
    name: 'protocol.can.classic.example.baseDataFrame.name',
    // Spec §3.4'ün DLC örneği: CAN ID 0x321, DLC 8, DATA 10 27 00 64 12 34 FF 00.
    bytes: buildCanClassicFrame(0x321, [0x10, 0x27, 0x00, 0x64, 0x12, 0x34, 0xff, 0x00]),
    description: 'protocol.can.classic.example.baseDataFrame.description',
    expectedValid: true,
  },
  {
    id: 'base-arbitration-winner',
    name: 'protocol.can.classic.example.baseArbitrationWinner.name',
    // Spec §3.4 arbitration örneği: 0x120 ile 0x123 yarışır, küçük ID kazanır.
    bytes: buildCanClassicFrame(0x120, [0x01, 0x02, 0x03, 0x04]),
    description: 'protocol.can.classic.example.baseArbitrationWinner.description',
    expectedValid: true,
  },
  {
    id: 'base-remote-frame',
    name: 'protocol.can.classic.example.baseRemoteFrame.name',
    bytes: buildCanClassicFrame(0x123, [], { remote: true }),
    description: 'protocol.can.classic.example.baseRemoteFrame.description',
    expectedValid: true,
  },
];

const EXTENDED_EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'extended-j1939-identifier',
    name: 'protocol.can.classic.example.extendedJ1939Identifier.name',
    // Spec §43 fixture identifier'ı 0x18F00401. Spec aynı ID'yi hem CAN 2.0B'nin
    // "Extended format" örneği hem J1939'un PGN örneği olarak kullanıyor —
    // iki sayfanın tutarlılığını kanıtlayan referans noktası.
    bytes: buildCanClassicFrame(
      0x18f00401,
      [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff],
      { extended: true },
    ),
    description: 'protocol.can.classic.example.extendedJ1939Identifier.description',
    expectedValid: true,
  },
  {
    id: 'extended-base-frame-mismatch',
    name: 'protocol.can.classic.example.extendedBaseFrameMismatch.name',
    // Kasıtlı uyuşmazlık: extended sayfasında base çerçeve → uyarı yolu görünür.
    bytes: buildCanClassicFrame(0x123, [0xaa, 0xbb]),
    description: 'protocol.can.classic.example.extendedBaseFrameMismatch.description',
    expectedValid: true,
  },
];

export const can20aPlugin: ProtocolPlugin = {
  id: BASE_PROTOCOL_ID,
  name: BASE_DISPLAY_NAME,
  category: 'automotive',
  parser: can20aParser,
  // Girdi: identifier sözcüğü + veri baytları (bkz. `encodeCanClassicFrame`).
  encoder: { encode: encodeCanBaseFrame },
  documentation: {
    summary: 'protocol.can.classic.base.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: BASE_EXAMPLE_FRAMES,
};

export const can20bPlugin: ProtocolPlugin = {
  id: EXTENDED_PROTOCOL_ID,
  name: EXTENDED_DISPLAY_NAME,
  category: 'automotive',
  parser: can20bParser,
  // Girdi: identifier sözcüğü + veri baytları (bkz. `encodeCanClassicFrame`).
  encoder: { encode: encodeCanExtendedFrame },
  documentation: {
    summary: 'protocol.can.classic.extended.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXTENDED_EXAMPLE_FRAMES,
};
