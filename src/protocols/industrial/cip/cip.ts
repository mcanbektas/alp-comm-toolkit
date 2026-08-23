/**
 * CIP — çıplak CIP Message Router isteği/yanıtı sayfası.
 *
 * Faz 10, dalga 13d. Katalogdaki `cip` kaydı (`layer: 'application'`) CIP
 * çekirdeğinin (`cipCore.ts`) HEM paylaşılan bir motor HEM DE kendi başına
 * bir plugin olduğunu gösterir — brief: "kullanıcı çıplak bir CIP mesajı
 * yapıştırabilmeli". `ethernetip.ts` ve `devicenet.ts` AYNI `decodeCipMessage`
 * fonksiyonunu kendi taşıyıcı zarflarının İÇİNDEN çağırır (dosya başı bkz.
 * `cipCore.ts`) — CIP media-independent olduğu için taşıyıcı yok, girdi
 * doğrudan Service/Reply-Service baytıyla başlar.
 *
 * Kaynak uyarısı, kapsam ve tuzak notları `cipCore.ts` dosya başındadır;
 * burada tekrarlanmaz.
 */

import { decodeCipMessage } from './cipCore';
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

const PROTOCOL_ID = 'cip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CIP';

/** İstek için asgari: Service(1) + Path Size(1). Yanıt zaten daha uzun (4 bayt) ister. */
const MIN_MESSAGE_LENGTH = 2;

const ERROR_ABORTED = 'protocol.cip.error.aborted';

export type CipFrameMetadata = {
  isResponse: boolean;
  service: number | undefined;
  serviceName: string | undefined;
  generalStatus: number | undefined;
  generalStatusName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface CipParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

const SUMMARY_REQUEST = 'protocol.cip.summary.request';
const SUMMARY_RESPONSE = 'protocol.cip.summary.response';

function parseCipFrame(data: Uint8Array, options: CipParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_MESSAGE_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: 'protocol.cip.error.frameTooShort',
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? 512;
  if (data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: 'protocol.cip.error.frameTooLong',
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

  const summary = decodeCipMessage(data, 0, data.length, fields, warnings, errors, '');

  const summaryParams: Record<string, string> = {};
  if (summary.serviceName !== undefined) summaryParams.service = summary.serviceName;
  if (summary.generalStatusName !== undefined) summaryParams.status = summary.generalStatusName;

  const metadata: CipFrameMetadata = {
    isResponse: summary.isResponse,
    service: summary.service,
    serviceName: summary.serviceName,
    generalStatus: summary.generalStatus,
    generalStatusName: summary.generalStatusName,
    summaryKey: summary.isResponse ? SUMMARY_RESPONSE : SUMMARY_REQUEST,
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

export function parseCip(data: Uint8Array): ParseResult {
  return parseCipFrame(data, {});
}

export const cipParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: yalnız uzunluk aralığı. CIP'in kendisi taşıyıcısız bir
   * mesaj sözlüğüdür — Service baytı 0x00-0x7F aralığının HER değeri
   * (sınıfa özel + vendor-specific servisler dahil) yapısal olarak
   * "olası"dır, bu yüzden ek bir imza kontrolü GÜVENİLİR bir eleme sağlamaz.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_MESSAGE_LENGTH && data.length <= 512;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CipParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseCipFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. Baytlar `cipCore.ts` dosya başında kaynaklanan EPATH/
 * Service/Status tablolarından ELLE inşa edildi (spec olmadığı için "spec
 * örneği" değil, motorun kendi kurallarına göre kurulmuş referans mesajlar —
 * `iec101.ts`in ELLE inşa edilmiş örnekleriyle aynı disiplin, testte
 * bağımsızca doğrulanır).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'get-attribute-single-request-8bit',
    name: 'protocol.cip.example.getAttributeSingleRequest8Bit.name',
    // Get_Attribute_Single(0x0E), Path Size=3 word, Class(8bit)=1(Identity)/
    // Instance(8bit)=1/Attribute(8bit)=1(Vendor ID) — hiç PAD baytı yok.
    bytes: Uint8Array.from([0x0e, 0x03, 0x20, 0x01, 0x24, 0x01, 0x30, 0x01]),
    description: 'protocol.cip.example.getAttributeSingleRequest8Bit.description',
    expectedValid: true,
  },
  {
    id: 'get-attribute-all-request-16bit-class',
    name: 'protocol.cip.example.getAttributeAllRequest16BitClass.name',
    // Get_Attribute_All(0x01), Path Size=3 word: Class(16bit)=4(Assembly) —
    // segment baytından SONRA bir PAD baytı (0x00) var, değer ondan sonra
    // gelir — Instance(8bit)=1 segmentinin PAD'siz devam ettiğini gösterir.
    bytes: Uint8Array.from([0x01, 0x03, 0x21, 0x00, 0x04, 0x00, 0x24, 0x01]),
    description: 'protocol.cip.example.getAttributeAllRequest16BitClass.description',
    expectedValid: true,
  },
  {
    id: 'get-attribute-single-response-success',
    name: 'protocol.cip.example.getAttributeSingleResponseSuccess.name',
    // Reply Service=0x8E (0x0E|0x80), Reserved=0, Status=Success, AddlSize=0,
    // Response Data = Vendor ID 0x0001 (little-endian).
    bytes: Uint8Array.from([0x8e, 0x00, 0x00, 0x00, 0x01, 0x00]),
    description: 'protocol.cip.example.getAttributeSingleResponseSuccess.description',
    expectedValid: true,
  },
  {
    id: 'response-path-destination-unknown',
    name: 'protocol.cip.example.responsePathDestinationUnknown.name',
    // Reply Service=0x8E, Reserved=0, Status=0x05 (Path destination unknown), AddlSize=0.
    bytes: Uint8Array.from([0x8e, 0x00, 0x05, 0x00]),
    description: 'protocol.cip.example.responsePathDestinationUnknown.description',
    expectedValid: true,
  },
  {
    id: 'request-connection-point-segment',
    name: 'protocol.cip.example.requestConnectionPointSegment.name',
    // Get_Attribute_Single(0x0E), Path Size=2 word: Class(8bit)=4(Assembly)/
    // Connection Point(8bit)=0x65(101) — EPATH'in dördüncü lojik alt tipi.
    bytes: Uint8Array.from([0x0e, 0x02, 0x20, 0x04, 0x2c, 0x65]),
    description: 'protocol.cip.example.requestConnectionPointSegment.description',
    expectedValid: true,
  },
  {
    id: 'request-unknown-service-code',
    name: 'protocol.cip.example.requestUnknownServiceCode.name',
    // 0x4B: 0x00-0x7F aralığında ama dar ortak-servis kümesinde yok (sınıfa
    // özel/vendor-specific olabilir) — yapısal olarak GEÇERLİ, adsız.
    bytes: Uint8Array.from([0x4b, 0x02, 0x20, 0x01, 0x24, 0x01]),
    description: 'protocol.cip.example.requestUnknownServiceCode.description',
    expectedValid: true,
  },
  {
    id: 'request-path-truncated',
    name: 'protocol.cip.example.requestPathTruncated.name',
    // Path Size=3 word (6 bayt) VAAT ediyor ama yalnız 4 bayt path verisi var.
    bytes: Uint8Array.from([0x0e, 0x03, 0x20, 0x01, 0x24, 0x01]),
    description: 'protocol.cip.example.requestPathTruncated.description',
    expectedValid: true,
  },
];

export const cipPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: cipParser,
  documentation: {
    summary: 'protocol.cip.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'OpENer — Open Source EtherNet/IP(TM) Adapter Stack (ciperror.h / ciptypes.h / cipepath.c)',
        url: 'https://github.com/EIPStackGroup/OpENer',
      },
      {
        title: 'Wireshark CIP dissector (epan/dissectors/packet-cip.c) — cip_gs_vals General Status table',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-cip.c',
      },
      {
        title: 'scadaprotocols.com — CIP Path Segments Explained / CIP Object Model Explained',
        url: 'https://scadaprotocols.com/cip-path-segments-explained/',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
