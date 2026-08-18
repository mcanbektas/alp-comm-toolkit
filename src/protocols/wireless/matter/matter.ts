/**
 * Matter TLV Tree Decoder (CSA Matter Core Specification R1.4, Appendix A) —
 * bağımsız bir TLV blob'unu özyinelemeli olarak yürür ve ağacı düz bir
 * `ParsedField` listesine indirger.
 *
 * ── GİRDİ: TLV BLOB'U, MESAJ ÇERÇEVESİ DEĞİL ───────────────────────────────
 * Matter Message framing (Message Header + Security + payload) girdiye
 * GİRMEZ: o katman şifreli ve OTURUMLUdur (spec 33293-33325) — anahtar
 * olmadan çözülemez ve dalga 5 karar 8 (şifreli içerik ham + işaret, anahtar
 * girişi HİÇBİR alt dalgada yok) burada da geçerlidir. Girdi, o zarfın
 * içinden çıkmış çıplak TLV'dir: bir Interaction Model payload'ı, bir
 * commissioning yapısı ya da SDK/spec'in test vektörleri.
 *
 * ── KODLAMA `protocol-core/decoding/matterTlv.ts`TE ─────────────────────────
 * Kontrol baytı/tag/uzunluk çözümü PAYLAŞILAN walker'dadır; burada yalnız
 * YÜRÜYÜŞ POLİTİKASI vardır (derinlik ve eleman tavanı, ağacın düzleştirme
 * biçimi). Bu ayrım walker'ın karar 3'ünün karşılığıdır: sınırlar tüketiciye
 * göre değişir, saf yardımcının içine gömülmez. `berReader` KULLANILMAZ —
 * Matter TLV başka bir kodlamadır (walker dosya başı).
 *
 * ── AĞAÇ → DÜZ LİSTE ───────────────────────────────────────────────────────
 * `ParsedField` hiyerarşi taşımaz, bu yüzden derinlik ADIN İÇİNDE girintiyle
 * gösterilir ve spec 33567-33597'nin "raw ↔ değer drill-down" şartı
 * protocol-tree/byte-viewer ikilisiyle karşılanır: her elemanın `offset`i HAM
 * çerçeveye göredir (walker karar 2), yani bir satır seçilince byte-viewer o
 * baytları vurgular.
 *
 * Container'ın `length`i AÇILIŞ baytından EŞLEŞEN end-of-container'ın sonuna
 * kadar olan TÜM aralıktır — bu ancak yürüyüş kapanışa vardığında bilinir, o
 * yüzden alan önce açılışla eklenir, kapanışta güncellenir. `end-of-container`
 * elemanı AYRI bir satır olarak BASILMAZ: kapsayıcının kendi aralığına
 * dahildir, ayrı satır ağacı gürültüye boğardı.
 *
 * ── TAVANLAR: DERİNLİK VE ELEMAN SAYISI ────────────────────────────────────
 * Matter container'larının uzunluk alanı YOKTUR (sonlarını yalnız EOC
 * bildirir), yani bozuk bir girdi teorik olarak sınırsız derinlik tarif
 * edebilir. `MAX_DEPTH`/`MAX_ELEMENTS` bu yüzden ipv6'nın
 * `MAX_EXTENSION_HEADERS` tavanının aynı gerekçesiyle vardır: her eleman en az
 * 1 bayt tükettiği için sonsuz döngü zaten matematiksel olarak imkânsızdır,
 * ama aşırı girdide bir yerde durmak gerekir — ve durulduğu SÖYLENİR (uyarı),
 * sessizce kesilmez.
 *
 * ── TAG KURALLARI: HATA DEĞİL UYARI ────────────────────────────────────────
 * Array üyeleri anonim olmak zorunda, Structure üyeleri anonim olamaz, en dış
 * seviyede context tag yasak (spec A.5.1/A.5.2/A.2.2). Bir ANALİZ aracı
 * kurala aykırı ama okunabilir bir elemanı GÖSTERİP UYARMALIDIR — çözümlemeyi
 * durdurmaz (walker karar 4).
 */

import {
  decodeMatterTlvFloat,
  decodeMatterTlvSignedInteger,
  decodeMatterTlvUnsignedInteger,
  decodeMatterTlvUtf8String,
  readMatterTlvElement,
  validateMatterTlvTag,
} from '@/protocol-core/decoding/matterTlv';
import type {
  MatterTlvContainerType,
  MatterTlvElement,
  MatterTlvErrorCode,
  MatterTlvTag,
  MatterTlvTagViolation,
} from '@/protocol-core/decoding/matterTlv';
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

const PROTOCOL_ID = 'matter';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Matter';
const TRANSLATION_KEY_PREFIX = 'protocol.matter';

/** Dosya başı: bozuk girdide bir yerde durmak gerekir; ipv6 MAX_EXTENSION_HEADERS emsali. */
const MAX_DEPTH = 16;
const MAX_ELEMENTS = 512;

/** Girinti ADIN içinde — `ParsedField` hiyerarşi taşımaz (dosya başı). */
const INDENT_UNIT = '··';

const ERROR_FRAME_EMPTY = `${TRANSLATION_KEY_PREFIX}.error.frameEmpty`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.truncated`;
const ERROR_RESERVED_ELEMENT_TYPE = `${TRANSLATION_KEY_PREFIX}.error.reservedElementType`;
const ERROR_TAGGED_END_OF_CONTAINER = `${TRANSLATION_KEY_PREFIX}.error.taggedEndOfContainer`;
const ERROR_VALUE_OVERFLOW = `${TRANSLATION_KEY_PREFIX}.error.valueOverflow`;
const ERROR_LENGTH_UNSUPPORTED = `${TRANSLATION_KEY_PREFIX}.error.lengthUnsupported`;
const ERROR_UNEXPECTED_END_OF_CONTAINER = `${TRANSLATION_KEY_PREFIX}.error.unexpectedEndOfContainer`;
const ERROR_UNCLOSED_CONTAINER = `${TRANSLATION_KEY_PREFIX}.error.unclosedContainer`;

const WARN_MAX_DEPTH_REACHED = `${TRANSLATION_KEY_PREFIX}.warning.maxDepthReached`;
const WARN_MAX_ELEMENTS_REACHED = `${TRANSLATION_KEY_PREFIX}.warning.maxElementsReached`;
const WARN_IMPLICIT_PROFILE_UNRESOLVED = `${TRANSLATION_KEY_PREFIX}.warning.implicitProfileUnresolved`;
const WARN_MALFORMED_UTF8 = `${TRANSLATION_KEY_PREFIX}.warning.malformedUtf8`;
const WARN_CONTEXT_TAG_AT_TOP_LEVEL = `${TRANSLATION_KEY_PREFIX}.warning.contextTagAtTopLevel`;
const WARN_ANONYMOUS_TAG_IN_STRUCTURE = `${TRANSLATION_KEY_PREFIX}.warning.anonymousTagInStructure`;
const WARN_NON_ANONYMOUS_TAG_IN_ARRAY = `${TRANSLATION_KEY_PREFIX}.warning.nonAnonymousTagInArray`;

/** Kodlama katmanının kapalı hata union'ı → protokol katmanının anahtarı ve kodu. */
const WALKER_ERROR_MESSAGES: Readonly<Record<MatterTlvErrorCode, string>> = {
  truncated: ERROR_TRUNCATED,
  'reserved-element-type': ERROR_RESERVED_ELEMENT_TYPE,
  'tagged-end-of-container': ERROR_TAGGED_END_OF_CONTAINER,
  'value-overflow': ERROR_VALUE_OVERFLOW,
  'length-unsupported': ERROR_LENGTH_UNSUPPORTED,
};

const WALKER_ERROR_CODES: Readonly<Record<MatterTlvErrorCode, ProtocolError['code']>> = {
  truncated: 'truncated-frame',
  'reserved-element-type': 'unsupported-encoding',
  'tagged-end-of-container': 'unsupported-encoding',
  'value-overflow': 'value-out-of-range',
  'length-unsupported': 'value-out-of-range',
};

const TAG_VIOLATION_WARNINGS: Readonly<Record<MatterTlvTagViolation, string>> = {
  'context-tag-at-top-level': WARN_CONTEXT_TAG_AT_TOP_LEVEL,
  'anonymous-tag-in-structure': WARN_ANONYMOUS_TAG_IN_STRUCTURE,
  'non-anonymous-tag-in-array': WARN_NON_ANONYMOUS_TAG_IN_ARRAY,
};

/** Eleman tipi adları protokol VERİSİdir, çeviriye girmez (CLAUDE.md). */
const ELEMENT_TYPE_LABELS: Readonly<Record<MatterTlvElement['type'], string>> = {
  'signed-integer': 'Signed Integer',
  'unsigned-integer': 'Unsigned Integer',
  boolean: 'Boolean',
  float: 'Float',
  'utf8-string': 'UTF-8 String',
  'octet-string': 'Octet String',
  null: 'Null',
  structure: 'Structure',
  array: 'Array',
  list: 'List',
  'end-of-container': 'End of Container',
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

/** Tag'in okunabilir gösterimi — spec A.8'in üç alanlı yapısını tek satıra indirir. */
function formatTag(tag: MatterTlvTag): string {
  switch (tag.control) {
    case 'anonymous':
      return 'anon';
    case 'context-specific':
      return `ctx:${String(tag.tagNumber ?? 0)}`;
    case 'common-profile-2':
    case 'common-profile-4':
      return `common:${String(tag.tagNumber ?? 0)}`;
    case 'implicit-profile-2':
    case 'implicit-profile-4':
      // Vendor/profile baytlarda YOK, bağlamdan gelir (walker karar 8).
      return `implicit:${String(tag.tagNumber ?? 0)}`;
    case 'fully-qualified-6':
    case 'fully-qualified-8':
      return `${toHex(tag.vendorId ?? 0, 2)}::${toHex(tag.profileNumber ?? 0, 2)}:${String(tag.tagNumber ?? 0)}`;
  }
}

function isContainer(type: MatterTlvElement['type']): type is MatterTlvContainerType {
  return type === 'structure' || type === 'array' || type === 'list';
}

interface MatterParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** Yürüyüş yığınının bir katmanı — container alanını kapanışta güncellemek için tutulur. */
interface ContainerFrame {
  readonly field: ParsedField;
  readonly containerType: MatterTlvContainerType;
}

function parseMatterFrame(data: Uint8Array, options: MatterParseOptions): ParseResult {
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
      error: { code: 'truncated-frame', message: ERROR_FRAME_EMPTY, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const stack: ContainerFrame[] = [];
  let cursor = 0;
  let elementIndex = 0;

  while (cursor < data.length) {
    if (elementIndex >= MAX_ELEMENTS) {
      warnings.push(toProtocolWarning(WARN_MAX_ELEMENTS_REACHED));
      break;
    }

    const read = readMatterTlvElement(data, cursor);
    if (!read.ok) {
      errors.push({
        code: WALKER_ERROR_CODES[read.error],
        message: WALKER_ERROR_MESSAGES[read.error],
        offset: read.offset,
        length: data.length - read.offset,
        details: { walkerError: read.error },
      });
      break;
    }

    if (read.type === 'end-of-container') {
      const frame = stack.pop();
      if (frame === undefined) {
        errors.push({
          code: 'unsupported-encoding',
          message: ERROR_UNEXPECTED_END_OF_CONTAINER,
          offset: read.offset,
          length: 1,
        });
        break;
      }
      // Container'ın aralığı açılıştan bu kapanışın sonuna kadardır (dosya başı).
      frame.field.length = read.end - frame.field.offset;
      frame.field.rawBytes = data.slice(frame.field.offset, read.end);
      cursor = read.end;
      continue;
    }

    const depth = stack.length;
    const containerType = stack[depth - 1]?.containerType;
    const violation = validateMatterTlvTag(read.tag, containerType);

    const field = buildField(data, read, depth, elementIndex);
    if (violation !== undefined) {
      const warningKey = TAG_VIOLATION_WARNINGS[violation];
      field.warnings.push(warningKey);
      warnings.push(toProtocolWarning(warningKey));
    }
    if (read.tag.control === 'implicit-profile-2' || read.tag.control === 'implicit-profile-4') {
      field.warnings.push(WARN_IMPLICIT_PROFILE_UNRESOLVED);
      warnings.push(toProtocolWarning(WARN_IMPLICIT_PROFILE_UNRESOLVED));
    }
    if (read.type === 'utf8-string') {
      const decoded = decodeMatterTlvUtf8String(data, read.valueOffset, read.valueLength);
      if (decoded.ok && !decoded.wellFormed) {
        field.warnings.push(WARN_MALFORMED_UTF8);
        warnings.push(toProtocolWarning(WARN_MALFORMED_UTF8));
      }
    }
    fields.push(field);
    elementIndex += 1;

    if (isContainer(read.type)) {
      if (stack.length >= MAX_DEPTH) {
        warnings.push(toProtocolWarning(WARN_MAX_DEPTH_REACHED));
        break;
      }
      stack.push({ field, containerType: read.type });
    }

    cursor = read.end;
  }

  if (stack.length > 0 && errors.length === 0) {
    // Kapanmamış container: EOC spec A.11.4'te ZORUNLUdur, çıkarımla tamamlanmaz.
    const unclosed = stack[stack.length - 1];
    errors.push({
      code: 'truncated-frame',
      message: ERROR_UNCLOSED_CONTAINER,
      offset: unclosed?.field.offset ?? 0,
      length: data.length - (unclosed?.field.offset ?? 0),
      details: { openContainers: stack.length },
    });
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

/** Bir elemanı `ParsedField`e indirger; container'ın `length`i kapanışta güncellenir. */
function buildField(
  data: Uint8Array,
  element: MatterTlvElement,
  depth: number,
  index: number,
): ParsedField {
  const indent = INDENT_UNIT.repeat(depth);
  const label = ELEMENT_TYPE_LABELS[element.type];
  const field: ParsedField = {
    id: `tlv-${String(index)}`,
    name: `${indent}${formatTag(element.tag)} · ${label}`,
    offset: element.offset,
    length: element.end - element.offset,
    rawBytes: data.slice(element.offset, element.end),
    rawValue: toHex(element.controlByte, 1),
    valid: true,
    warnings: [],
  };

  const physicalValue = decodeElementValue(data, element);
  if (physicalValue !== undefined) {
    field.physicalValue = physicalValue;
  }
  return field;
}

/** Değerin görüntülenecek hâli; container/null'da yoktur (ağaçta satırın kendisi yeter). */
function decodeElementValue(data: Uint8Array, element: MatterTlvElement): string | undefined {
  switch (element.type) {
    case 'boolean':
      return element.booleanValue === true ? 'true' : 'false';
    case 'signed-integer': {
      const decoded = decodeMatterTlvSignedInteger(data, element.valueOffset, element.valueLength);
      return decoded.ok ? decoded.value.toString() : undefined;
    }
    case 'unsigned-integer': {
      const decoded = decodeMatterTlvUnsignedInteger(data, element.valueOffset, element.valueLength);
      return decoded.ok ? decoded.value.toString() : undefined;
    }
    case 'float': {
      const decoded = decodeMatterTlvFloat(data, element.valueOffset, element.valueLength);
      return decoded.ok ? String(decoded.value) : undefined;
    }
    case 'utf8-string': {
      const decoded = decodeMatterTlvUtf8String(data, element.valueOffset, element.valueLength);
      return decoded.ok ? `"${decoded.text}"` : undefined;
    }
    case 'octet-string':
      // Gövde HAM kalır — byte-viewer zaten baytları gösterir, tekrarlamak gürültü.
      return `${String(element.valueLength)} B`;
    case 'null':
      return 'null';
    default:
      return undefined;
  }
}

export function parseMatter(data: Uint8Array): ParseResult {
  return parseMatterFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): MatterParseOptions {
  const options: MatterParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const matterParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: ilk kontrol baytının eleman tipi geçerli aralıkta mı. */
  canParse(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    return readMatterTlvElement(data, 0).ok;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseMatterFrame(data, readContextOptions(context));
  },
};

/**
 * Örnek çerçeveler. HEPSİ dış kaynaktan, atıflı (fixture uydurma yasağı):
 *   - "Tablo 105/106/107" = Matter Core Specification R1.4, Appendix A.12'nin
 *     işlenmiş örnek tabloları.
 *   - "SDK" = connectedhomeip (Apache-2.0, SHA a50d8797…), `TestTLV.cpp`.
 * Hata yolu örnekleri, spec örneklerinin KESİLMİŞ ya da tek baytı bozulmuş
 * hâlleridir — yeni bayt dizisi uydurulmamıştır.
 */
function bytes(text: string): Uint8Array {
  return Uint8Array.from(text.trim().split(/\s+/).map((part) => Number.parseInt(part, 16)));
}

/** SDK `TestTLV.cpp` `sIdentifyResponseBuf` — gerçek bir Matter mesaj payload'ı (53 bayt). */
const SDK_IDENTIFY_RESPONSE = `
  d5 00 00 0e 00 01 00 25 00 5a 23 24 01 07 24 02
  05 25 03 22 1e 2c 04 10 30 34 41 41 30 31 41 43
  32 33 31 34 30 30 4c 50 2c 09 06 31 2e 34 72 63
  35 24 0c 01 18
`;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'identify-response',
    name: 'protocol.matter.example.identifyResponse.name',
    bytes: bytes(SDK_IDENTIFY_RESPONSE),
    description: 'protocol.matter.example.identifyResponse.description',
    expectedValid: true,
  },
  {
    id: 'mixed-array',
    name: 'protocol.matter.example.mixedArray.name',
    // Tablo 106: Array [42, -170000, {}, 17.9, "Hello!"] — iç içe container + karışık tip.
    bytes: bytes('16 00 2a 02 f0 67 fd ff 15 18 0a 33 33 8f 41 0c 06 48 65 6c 6c 6f 21 18'),
    description: 'protocol.matter.example.mixedArray.description',
    expectedValid: true,
  },
  {
    id: 'structure-context-tags',
    name: 'protocol.matter.example.structureContextTags.name',
    // Tablo 106: Structure {0 = 42, 1 = -17}.
    bytes: bytes('15 20 00 2a 20 01 ef 18'),
    description: 'protocol.matter.example.structureContextTags.description',
    expectedValid: true,
  },
  {
    id: 'tag-forms',
    name: 'protocol.matter.example.tagForms.name',
    // Tablo 107: fully-qualified tag'li Structure, içinde fully-qualified tag'li üye.
    bytes: bytes('d5 f1 ff ed de 01 00 c4 f1 ff ed de 55 aa 2a 18'),
    description: 'protocol.matter.example.tagForms.description',
    expectedValid: true,
  },
  {
    id: 'list-mixed-tags',
    name: 'protocol.matter.example.listMixedTags.name',
    // Tablo 106: List — anonim ve context tag karışık (spec A.5.3).
    bytes: bytes('17 00 01 20 00 2a 00 02 00 03 20 00 ef 18'),
    description: 'protocol.matter.example.listMixedTags.description',
    expectedValid: true,
  },
  {
    id: 'empty-structure',
    name: 'protocol.matter.example.emptyStructure.name',
    // Tablo 106: boş Structure — açılış + zorunlu end-of-container.
    bytes: bytes('15 18'),
    description: 'protocol.matter.example.emptyStructure.description',
    expectedValid: true,
  },
  {
    id: 'unclosed-container',
    name: 'protocol.matter.example.unclosedContainer.name',
    // Tablo 106'nın Structure örneği, kapanış EOC'si KESİLMİŞ hâli.
    bytes: bytes('15 20 00 2a 20 01 ef'),
    description: 'protocol.matter.example.unclosedContainer.description',
    expectedValid: false,
  },
  {
    id: 'truncated-string',
    name: 'protocol.matter.example.truncatedString.name',
    // Tablo 105'in "Hello!" örneği, gövdesi KESİLMİŞ hâli (6 bayt vaat, 2 bayt var).
    bytes: bytes('0c 06 48 65'),
    description: 'protocol.matter.example.truncatedString.description',
    expectedValid: false,
  },
];

export const matterPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: matterParser,
  documentation: {
    summary: 'protocol.matter.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
