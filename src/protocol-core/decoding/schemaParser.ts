/**
 * Şema YORUMLAYICI ayrıştırıcı — spec §9'un çalışan karşılığı.
 *
 * ## Neden yorumlayıcı, neden kod üretip çalıştırmıyor
 *
 * Spec §41 `eval`i ve dinamik kod çalıştırmayı yasaklıyor. Kullanıcının
 * tanımladığı protokol bu yüzden koda DERLENMEZ; şema veri olarak okunur ve bu
 * modül onu adım adım yorumlar. Alt paneldeki C/Python/TypeScript ayrıştırıcı
 * çıktıları kullanıcının kopyalayacağı METİNlerdir — uygulama onları asla
 * çalıştırmaz.
 *
 * ## Koruma bantları (spec §41: "Parser timeout", "Sonsuz loop engelle")
 *
 * - Azami çerçeve uzunluğu şemadan gelir ve aşılırsa ayrıştırma durur.
 * - Tekrar sayısı hem mutlak bir tavanla hem de kalan bayt sayısıyla sınırlı;
 *   bozuk bir sayaç alanı milyonlarca yineleme isteyemez.
 * - `AbortSignal` her alanda yoklanır, uzun ayrıştırma iptal edilebilir.
 *
 * ## Çıktı düzlemi
 *
 * `ParsedFrame.fields` DÜZDÜR: iç içe yapıların ve dizi yinelemelerinin alanları
 * `samples[0].temperature` gibi ad uzayı almış kimliklerle aynı listeye girer.
 * `ParsedField`in çocuk alanı yok (spec §7 sözleşmesi) ve o sözleşme 172
 * protokolün tamamını bağladığı için değiştirilmiyor.
 */

import { bytesToNumber, toSignedInt } from '../buffers/endianness';
import { toPhysicalValue } from '../buffers/physicalValue';
import { checksumWidthBytes, computeChecksum, readStoredChecksum } from '../checksums/algorithmCatalogue';
import { decodeBcd } from '../encoding/bcd';
import { decodeFloat16, decodeFloat32, decodeFloat64 } from '../encoding/ieee754';
import { utf8BytesToString } from '../encoding/utf8Viewer';
import { fieldTypeInfo, isCompositeField, isDerivedField } from '../schemas/fieldTypes';
import type { Endianness } from '../encoding/ieee754';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import type {
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolWarning,
  RawFrame,
} from '../types';
import { createRawFrame } from '../types';
import { readBits, toSignedBits } from './bitCursor';

/** Bozuk bir tekrar sayacının üretebileceği yineleme sayısına mutlak tavan. */
const MAX_REPEAT_ITERATIONS = 4096;

interface ParseState {
  readonly schema: ProtocolSchema;
  readonly bytes: Uint8Array;
  readonly signal: AbortSignal | undefined;
  /** Bir sonraki alanın başlayacağı bayt konumu. */
  cursor: number;
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  /** Alan kimliği → sayısal ham değer; uzunluk/koşul/tekrar referansları buradan okunur. */
  readonly values: Map<string, number>;
  /** Alan kimliği → çerçevedeki bayt aralığı; checksum kapsamı buradan çözülür. */
  readonly ranges: Map<string, { start: number; end: number }>;
}

class ParseAbort extends Error {
  constructor(readonly protocolError: ProtocolError) {
    super(protocolError.message);
  }
}

function fail(code: ProtocolError['code'], message: string, offset?: number): never {
  throw new ParseAbort({ code, message, ...(offset === undefined ? {} : { offset }) });
}

function endiannessOf(field: ProtocolFieldSchema, schema: ProtocolSchema): Endianness {
  return field.endianness ?? schema.defaultEndianness ?? 'big';
}

/** Alanın bayt uzunluğunu çözer; dinamikse daha önce okunmuş değerden alır. */
function resolveLength(field: ProtocolFieldSchema, state: ParseState): number {
  if (field.lengthFrom !== undefined) {
    const source = state.values.get(field.lengthFrom);
    if (source === undefined) {
      fail(
        'circular-length-reference',
        `"${field.id}" uzunluğunu "${field.lengthFrom}" alanından alıyor ama o alan henüz çözümlenmemiş`,
      );
    }
    if (source < 0) {
      fail('length-mismatch', `"${field.id}" için negatif uzunluk: ${source}`);
    }
    return source;
  }

  if (isDerivedField(field.type)) {
    return field.algorithm === undefined ? 0 : checksumWidthBytes(field.algorithm);
  }

  const info = fieldTypeInfo(field.type);
  if (info.kind === 'bits') {
    // Bit alanı bayt sınırına yuvarlanır (ParsedField bayt aralığı taşır) ve
    // hesaba `bitOffset` de girer: bit 4'ten başlayan 8 bitlik alan İKİ baytı
    // kapsar, birini değil.
    return Math.ceil(((field.bitOffset ?? 0) + (field.bitLength ?? 0)) / 8);
  }
  if (field.length !== undefined) {
    return field.length;
  }
  if (info.byteLength !== undefined) {
    return info.byteLength;
  }
  fail('length-mismatch', `"${field.id}" alanının uzunluğu belirlenemiyor`);
}

function decodeInteger(
  bytes: Uint8Array,
  field: ProtocolFieldSchema,
  schema: ProtocolSchema,
): bigint | number {
  const info = fieldTypeInfo(field.type);
  const order = endiannessOf(field, schema);
  const signed = field.signed ?? info.signed ?? false;

  if (info.requiresBigInt === true || bytes.length > 6) {
    // 6 bayttan geniş değerler Number'ın güvenli tamsayı aralığını aşabilir.
    const raw = bytesFromOrder(bytes, order);
    return signed ? toSignedBits(raw, bytes.length * 8) : raw;
  }

  const raw = bytesToNumber(bytes, order);
  return signed ? toSignedInt(raw, bytes.length * 8) : raw;
}

/** Bayt dizisini bigint'e çevirir; `bytesToNumber`ın 64 bitlik karşılığı. */
function bytesFromOrder(bytes: Uint8Array, order: Endianness): bigint {
  let value = 0n;
  if (order === 'big') {
    for (const byte of bytes) {
      value = (value << 8n) | BigInt(byte);
    }
    return value;
  }
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[index] ?? 0);
  }
  return value;
}

function decodeAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.')).join('');
}

interface DecodedValue {
  readonly rawValue: bigint | number | string | undefined;
  readonly physicalValue: bigint | number | string | undefined;
  readonly warnings: readonly string[];
  readonly valid: boolean;
}

function decodeField(
  field: ProtocolFieldSchema,
  slice: Uint8Array,
  state: ParseState,
): DecodedValue {
  const info = fieldTypeInfo(field.type);
  const order = endiannessOf(field, state.schema);
  const warnings: string[] = [];

  switch (info.kind) {
    case 'float': {
      const value =
        field.type === 'float16'
          ? decodeFloat16(slice, order)
          : field.type === 'float32'
            ? decodeFloat32(slice, order)
            : decodeFloat64(slice, order);
      return { rawValue: value, physicalValue: applyScale(value, field), warnings, valid: true };
    }

    case 'boolean': {
      const value = slice.some((byte) => byte !== 0);
      return { rawValue: value ? 1 : 0, physicalValue: String(value), warnings, valid: true };
    }

    case 'bits': {
      const bitLength = field.bitLength ?? 0;
      const bitOffset = field.bitOffset ?? 0;
      const raw = readBits(slice, bitOffset, bitLength, field.bitOrder ?? 'msb-first');
      const signed = field.signed === true ? toSignedBits(raw, bitLength) : raw;
      const asNumber = bitLength <= 53 ? Number(signed) : signed;
      return {
        rawValue: asNumber,
        physicalValue: typeof asNumber === 'number' ? applyScale(asNumber, field) : asNumber,
        warnings,
        valid: true,
      };
    }

    case 'enum': {
      const raw = decodeInteger(slice, field, state.schema);
      const key = String(raw);
      const label = field.enumValues?.[key];
      if (label === undefined) {
        // Bilinmeyen enum değeri veriyi geçersiz KILMAZ — cihaz yeni bir kod
        // göndermiş olabilir; ham değer korunur, kullanıcı uyarılır.
        warnings.push(`Bilinmeyen enum değeri: ${key}`);
        return { rawValue: raw, physicalValue: key, warnings, valid: true };
      }
      return { rawValue: raw, physicalValue: label, warnings, valid: true };
    }

    case 'text': {
      const text = field.type === 'utf8' ? utf8BytesToString(slice) : decodeAscii(slice);
      return { rawValue: text, physicalValue: text, warnings, valid: true };
    }

    case 'bytes': {
      return { rawValue: undefined, physicalValue: undefined, warnings, valid: true };
    }

    case 'timestamp': {
      const raw = decodeInteger(slice, field, state.schema);
      const milliseconds = field.type === 'unixTimestamp' ? Number(raw) * 1000 : Number(raw);
      const iso = Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : String(raw);
      return { rawValue: raw, physicalValue: iso, warnings, valid: true };
    }

    case 'integer': {
      if (field.type === 'bcd') {
        const value = decodeBcd(slice);
        return { rawValue: value, physicalValue: applyScale(value, field), warnings, valid: true };
      }
      const raw = decodeInteger(slice, field, state.schema);
      const masked = applyMask(raw, field);
      const physical = typeof masked === 'number' ? applyScale(masked, field) : masked;
      const rangeWarning = checkRange(masked, field);
      if (rangeWarning !== undefined) {
        warnings.push(rangeWarning);
      }
      return { rawValue: masked, physicalValue: physical, warnings, valid: true };
    }

    case 'derived':
    case 'composite':
      // Bu tipler ayrı yollarda işlenir; buraya düşmemeli.
      return { rawValue: undefined, physicalValue: undefined, warnings, valid: true };
  }
}

function applyMask(raw: bigint | number, field: ProtocolFieldSchema): bigint | number {
  if (field.bitMask === undefined) {
    return raw;
  }
  if (typeof raw === 'bigint') {
    const mask = BigInt(field.bitMask);
    // Maskeyi uygularken kaydırma da yapılır — spec §9.4:
    // Field Value = (RawValue & Mask) >> Shift
    return (raw & mask) >> BigInt(trailingZeroCount(field.bitMask));
  }
  return (raw & field.bitMask) >>> trailingZeroCount(field.bitMask);
}

function trailingZeroCount(mask: number): number {
  if (mask === 0) {
    return 0;
  }
  let count = 0;
  let value = mask;
  while ((value & 1) === 0) {
    value >>>= 1;
    count += 1;
  }
  return count;
}

function applyScale(raw: number, field: ProtocolFieldSchema): number {
  if (field.scale === undefined && field.calibrationOffset === undefined) {
    return raw;
  }
  // Spec §9.2: Physical Value = Raw Value × Scale + Offset
  return toPhysicalValue(raw, field.scale ?? 1, field.calibrationOffset ?? 0);
}

function checkRange(value: bigint | number, field: ProtocolFieldSchema): string | undefined {
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  if (field.minimum !== undefined && numeric < field.minimum) {
    return `Değer alt sınırın altında: ${numeric} < ${field.minimum}`;
  }
  if (field.maximum !== undefined && numeric > field.maximum) {
    return `Değer üst sınırın üstünde: ${numeric} > ${field.maximum}`;
  }
  return undefined;
}

/** Koşullu alan: koşul sağlanmıyorsa alan çerçevede HİÇ yoktur, atlanır. */
function conditionMet(field: ProtocolFieldSchema, state: ParseState): boolean {
  if (field.condition === undefined) {
    return true;
  }
  const actual = state.values.get(field.condition.field);
  return actual === field.condition.equals;
}

function resolveRepeatCount(field: ProtocolFieldSchema, state: ParseState): number {
  const repeat = field.repeatCount;
  if (repeat === undefined) {
    return 1;
  }
  const requested = typeof repeat === 'number' ? repeat : (state.values.get(repeat.fromField) ?? 0);
  if (requested < 0) {
    fail('length-mismatch', `"${field.id}" için negatif tekrar sayısı: ${requested}`);
  }
  if (requested > MAX_REPEAT_ITERATIONS) {
    // Spec §41 "Sonsuz loop engelle": bozuk bir sayaç alanı milyonlarca
    // yineleme isteyebilir; tavan olmadan ayrıştırıcı asla dönmezdi.
    fail(
      'value-out-of-range',
      `"${field.id}" ${requested} yineleme istiyor; azami ${MAX_REPEAT_ITERATIONS}`,
    );
  }
  return requested;
}

function parseFieldList(
  fields: readonly ProtocolFieldSchema[],
  namespace: string,
  state: ParseState,
): void {
  for (const field of fields) {
    if (state.signal?.aborted === true) {
      fail('parser-timeout', 'Ayrıştırma iptal edildi');
    }
    if (!conditionMet(field, state)) {
      continue;
    }

    const qualifiedId = namespace === '' ? field.id : `${namespace}.${field.id}`;

    if (isCompositeField(field.type)) {
      const iterations = field.type === 'array' ? resolveRepeatCount(field, state) : 1;
      for (let index = 0; index < iterations; index += 1) {
        const elementNamespace = field.type === 'array' ? `${qualifiedId}[${index}]` : qualifiedId;
        parseFieldList(field.fields ?? [], elementNamespace, state);
      }
      continue;
    }

    const offset = field.offset ?? state.cursor;
    const length = resolveLength(field, state);

    if (offset + length > state.bytes.length) {
      fail(
        'truncated-frame',
        `"${field.id}" alanı çerçeveyi aşıyor: [${offset}, ${offset + length}) ama çerçeve ${state.bytes.length} bayt`,
        offset,
      );
    }
    if (offset + length > state.schema.framing.maximumFrameLength) {
      fail(
        'frame-too-long',
        `"${field.id}" azami çerçeve uzunluğunu (${state.schema.framing.maximumFrameLength}) aşıyor`,
        offset,
      );
    }

    const slice = state.bytes.subarray(offset, offset + length);

    const parsed: ParsedField = isDerivedField(field.type)
      ? parseChecksumField(field, qualifiedId, slice, offset, length, state)
      : buildField(field, qualifiedId, slice, offset, length, decodeField(field, slice, state));

    state.fields.push(parsed);
    state.ranges.set(field.id, { start: offset, end: offset + length });
    if (typeof parsed.rawValue === 'number') {
      state.values.set(field.id, parsed.rawValue);
    }
    for (const warning of parsed.warnings) {
      state.warnings.push({ code: 'field-warning', message: `${field.name}: ${warning}`, offset });
    }

    state.cursor = offset + length;
  }
}

function buildField(
  field: ProtocolFieldSchema,
  qualifiedId: string,
  slice: Uint8Array,
  offset: number,
  length: number,
  decoded: DecodedValue,
): ParsedField {
  return {
    id: qualifiedId,
    name: field.name,
    offset,
    length,
    rawBytes: slice,
    ...(decoded.rawValue === undefined ? {} : { rawValue: decoded.rawValue }),
    ...(decoded.physicalValue === undefined ? {} : { physicalValue: decoded.physicalValue }),
    ...(field.unit === undefined ? {} : { unit: field.unit }),
    valid: decoded.valid,
    warnings: [...decoded.warnings],
  };
}

/**
 * Checksum/CRC alanı: değeri okunmaz, HESAPLANIR ve karşılaştırılır.
 * Kapsam alan kimliği aralığıyla verilir (spec §9.6), bayt ofsetiyle değil —
 * dinamik uzunluklu bir payload'da bayt aralığı zaten önceden bilinemez.
 */
function parseChecksumField(
  field: ProtocolFieldSchema,
  qualifiedId: string,
  slice: Uint8Array,
  offset: number,
  length: number,
  state: ParseState,
): ParsedField {
  const warnings: string[] = [];
  const algorithm = field.algorithm;

  if (algorithm === undefined || field.coverage === undefined) {
    return {
      id: qualifiedId,
      name: field.name,
      offset,
      length,
      rawBytes: slice,
      valid: true,
      warnings: ['Kapsam ya da algoritma tanımlı değil; doğrulama yapılmadı'],
    };
  }

  const start = state.ranges.get(field.coverage.startField);
  const end = state.ranges.get(field.coverage.endField);
  if (start === undefined || end === undefined) {
    return {
      id: qualifiedId,
      name: field.name,
      offset,
      length,
      rawBytes: slice,
      valid: false,
      warnings: [`Kapsam alanları çözümlenemedi: ${field.coverage.startField}..${field.coverage.endField}`],
    };
  }

  const covered = state.bytes.subarray(start.start, end.end);
  const computed = computeChecksum(covered, algorithm);
  const stored = readStoredChecksum(slice, endiannessOf(field, state.schema));
  const matches = computed !== undefined && computed === stored;

  if (!matches) {
    warnings.push(
      `Beklenen 0x${(computed ?? 0n).toString(16).toUpperCase()}, gelen 0x${stored.toString(16).toUpperCase()}`,
    );
  }

  return {
    id: qualifiedId,
    name: field.name,
    offset,
    length,
    rawBytes: slice,
    rawValue: stored,
    physicalValue: matches ? 'valid' : 'invalid',
    valid: matches,
    warnings,
  };
}

function verifyFraming(schema: ProtocolSchema, bytes: Uint8Array): void {
  const { framing } = schema;
  if (framing.startBytes !== undefined && framing.startBytes.length > 0) {
    for (let index = 0; index < framing.startBytes.length; index += 1) {
      if (bytes[index] !== framing.startBytes[index]) {
        fail(
          'start-delimiter-not-found',
          `Başlangıç baytı beklendi (0x${(framing.startBytes[index] ?? 0).toString(16).toUpperCase()}), gelen 0x${(bytes[index] ?? 0).toString(16).toUpperCase()}`,
          index,
        );
      }
    }
  }

  if (framing.type === 'startEnd' && framing.endBytes !== undefined && framing.endBytes.length > 0) {
    const tailStart = bytes.length - framing.endBytes.length;
    for (let index = 0; index < framing.endBytes.length; index += 1) {
      if (bytes[tailStart + index] !== framing.endBytes[index]) {
        fail(
          'length-mismatch',
          `Bitiş baytı beklendi (0x${(framing.endBytes[index] ?? 0).toString(16).toUpperCase()})`,
          tailStart + index,
        );
      }
    }
  }
}

export interface SchemaParseOptions {
  readonly context?: ParseContext;
}

/**
 * Şemayı verilen baytlara uygular.
 *
 * Başarısızlıkta `recoverable: true` döner: çerçeveleme katmanı bir sonraki
 * senkron noktasından devam edebilir. Yalnız azami uzunluk aşımı kurtarılamaz
 * sayılır — o durumda akış bu protokol için terk edilmeli.
 */
export function parseWithSchema(
  schema: ProtocolSchema,
  bytes: Uint8Array,
  options: SchemaParseOptions = {},
): ParseResult {
  const context = options.context;
  const rawFrame: RawFrame = createRawFrame(bytes, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const state: ParseState = {
    schema,
    bytes,
    signal: context?.signal,
    cursor: schema.framing.startBytes?.length ?? 0,
    fields: [],
    warnings: [],
    values: new Map(),
    ranges: new Map(),
  };

  try {
    if (bytes.length > schema.framing.maximumFrameLength) {
      fail(
        'frame-too-long',
        `Çerçeve ${bytes.length} bayt; azami ${schema.framing.maximumFrameLength}`,
      );
    }
    verifyFraming(schema, bytes);
    parseFieldList(schema.fields, '', state);
  } catch (cause) {
    if (cause instanceof ParseAbort) {
      return {
        success: false,
        error: cause.protocolError,
        consumedBytes: Math.min(state.cursor, bytes.length),
        recoverable: cause.protocolError.code !== 'frame-too-long',
      };
    }
    // Spec §47: "Hatalı veride uygulamayı çökertme". Şema da baytlar da
    // kullanıcıdan geliyor; beklenmedik bir istisna (ör. bit imlecinin aralık
    // hatası) arayüze kadar sızmamalı, ayrıştırma başarısızlığına dönmeli.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: cause instanceof Error ? cause.message : String(cause),
        offset: Math.min(state.cursor, bytes.length),
      },
      consumedBytes: Math.min(state.cursor, bytes.length),
      recoverable: true,
    };
  }

  const invalidFields = state.fields.filter((field) => !field.valid);
  const errors: ProtocolError[] = invalidFields.map((field) => ({
    code: 'checksum-mismatch',
    message: `${field.name}: ${field.warnings.join('; ')}`,
    offset: field.offset,
    length: field.length,
  }));

  const frame: ParsedFrame = {
    protocol: schema.name,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: state.fields,
    valid: invalidFields.length === 0,
    errors,
    warnings: state.warnings,
  };

  return { success: true, frame, consumedBytes: bytes.length };
}

/**
 * Şemadan spec §7 sözleşmesine uyan bir `ProtocolParser` üretir. Böylece
 * kullanıcı tanımlı protokol, kayıt defterine hazır protokollerle AYNI arayüzden
 * girebilir (spec §47: "Protokol eklentisi mantığını destekle").
 */
export function createSchemaParser(schema: ProtocolSchema): ProtocolParser {
  const startBytes = schema.framing.startBytes ?? [];

  return {
    protocolId: schema.name,
    displayName: schema.name,

    canParse(data: Uint8Array): boolean {
      if (data.length === 0) {
        return false;
      }
      // Yalnız ucuz bir ön eleme: başlangıç baytları tutuyor mu. Tam ayrıştırma
      // `parse` içinde; `canParse` sıcak yolda her çerçeve için çağrılabilir.
      return startBytes.every((byte, index) => data[index] === byte);
    },

    parse(data: Uint8Array, context?: ParseContext): ParseResult {
      return parseWithSchema(schema, data, context === undefined ? {} : { context });
    },
  };
}
