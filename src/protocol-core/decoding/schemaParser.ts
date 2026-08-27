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

// ── `canParse` ön elemesi ───────────────────────────────────────────────
//
// ## Boş `startBytes` MAYINI ve kapanışı (2026-08-27)
//
// Eski gövde `startBytes.every((byte, index) => data[index] === byte)` idi ve
// `[].every(...)` boş dizide **`true`** döner: `startBytes`i olmayan bir şema
// kayıt defterindeki HER çerçeveyi sahiplenirdi. Ölçüldü (148 kayıt, 937
// örnek): `length-based-protocol` 937/937, `ascii-protocol` 937/937.
//
// **Değişmez ilke: SIFIR koşul denetleyen bir `canParse` `true` DÖNMEZ.** Şema
// ayırt edici bir sinyal sunmuyorsa doğru cevap `false`tur — yanlış negatif
// kabul edilebilir (kayıt yalnız otomatik seçilmez, elle seçilince yine
// çözülür), yanlış pozitif değil (auto-detection'ı zehirler).
//
// Dolayısıyla boş `startBytes` dalı, ŞEMANIN KENDİ BİLDİRDİĞİ yapısal kısıtları
// teldeki baytlara uygular — ayrıştırmadan, yalnız bayt karşılaştırmasıyla:
//
//  1. `startEnd` ise bitiş baytları kuyrukta tutuyor mu (`verifyFraming` de
//     bitiş baytlarına YALNIZ orada bakar; öbür türlerde `endBytes` süstür ve
//     `parse` onu hiç denetlemez, `canParse` de denetlemez).
//  2. Şemadan türeyen TOPLAM çerçeve boyu `data.length`a EŞİT mi ve azami
//     çerçeve uzunluğunu aşmıyor mu. `lengthFrom` taşıyan alanların boyu,
//     teldeki uzunluk alanından OKUNARAK hesaba girer.
//  3. `ascii` alanlarının kapsadığı baytlar yazdırılabilir mi. Metin olduğunu
//     şemanın kendisi bildiriyor; ikili bir çöp bloğu o alanı dolduramaz.
//
// Bunlardan HİÇBİRİ türetilemiyorsa (koşullu/tekrarlı/bileşik alanlar yüzünden
// boy belirsizse, ya da `lengthField` çerçeveleme vaat edildiği hâlde şemada
// `length` alanı yoksa) denetlenecek koşul YOKTUR ve cevap `false`tur.
//
// `parseWithSchema` BİLEREK çağrılmaz: `canParse` sıcak yolda her çerçeve için
// çağrılır, ucuz ön eleme olarak kalmalıdır. Alan başına yapılan iş şemadan
// bir kez çıkarılır (`buildCanParsePlan`), çerçeve başına yalnız bayt
// karşılaştırması kalır.
//
// ÖLÇÜM (aynı 937 örnek, önce → sonra, toplam/kendi/yabancı):
//   custom-binary-protocol (startBytes DOLU) 16/2/14 → 16/2/14  (BİREBİR AYNI)
//   length-based-protocol                    937/2/935 → 1/1/0
//   ascii-protocol                           937/2/935 → 5/1/4
//   startBytes'siz `lengthField` sonda       937 → 0
// Kaybedilen iki KENDİ örneği bilinçlidir ve ikisi de `expectedValid: false`
// olan, TANIMI GEREĞİ bozuk çerçevelerdir: `length-based-protocol/
// oversized-length` (bildirilen 1000, telde 3 bayt) ve `ascii-protocol/
// missing-line-ending` (CRLF kesik, 16 yerine 14 bayt). Bir ön elemenin
// bozuk çerçeveyi sahiplenmemesi doğru davranıştır. `ascii-protocol`ün kalan
// 4 yabancı isabeti de hata değil GERÇEK belirsizliktir: hepsi 16 baytlık
// yazdırılabilir AT-komut satırıdır (`at-commands`, `hayes-command-set`,
// `lte-modem-at`) ve bir ASCII satırı başka bir ASCII satırından ayırt
// edilemez — bunu ancak alan İÇERİĞİNİ uyduran bir kural "çözerdi".

/** `bytesToNumber`ın güvenli tamsayı sınırı; uzunluk alanı bundan geniş olamaz. */
const MAX_LENGTH_FIELD_BYTES = 6;

/** Alanın teldeki veriye BAĞLI OLMAYAN bayt genişliği; şemadan çıkmıyorsa `undefined`. */
function staticFieldLength(field: ProtocolFieldSchema): number | undefined {
  // Sıra `fieldByteLength` ile AYNI olmalı: türetilmiş alan kendi genişliğini
  // algoritmadan alır, şemadaki `length` onu geçersizleştirmez.
  if (isDerivedField(field.type)) {
    return field.algorithm === undefined ? 0 : checksumWidthBytes(field.algorithm);
  }
  const info = fieldTypeInfo(field.type);
  if (info.kind === 'bits') {
    return Math.ceil(((field.bitOffset ?? 0) + (field.bitLength ?? 0)) / 8);
  }
  if (field.length !== undefined) {
    return field.length;
  }
  return info.byteLength;
}

interface CanParseFieldPlan {
  readonly id: string;
  readonly offset: number | undefined;
  readonly staticLength: number | undefined;
  readonly lengthFrom: string | undefined;
  /** Sayısal değeri okunup `lengthFrom` referanslarına sunulacak mı. */
  readonly readsValue: boolean;
  readonly isAscii: boolean;
  readonly endianness: Endianness;
}

interface CanParsePlan {
  /** Çerçeve boyu şemadan türetilebiliyor mu. Türetilemiyorsa o sinyal YOKTUR. */
  readonly extentDerivable: boolean;
  readonly fields: readonly CanParseFieldPlan[];
  /** Yalnız `startEnd`te dolu — `verifyFraming` de bitiş baytlarına yalnız orada bakar. */
  readonly endBytes: readonly number[];
  readonly maximumFrameLength: number;
}

function buildCanParsePlan(schema: ProtocolSchema): CanParsePlan {
  const fields: CanParseFieldPlan[] = [];
  // `lengthFrom` referansının ÇÖZÜLEBİLECEĞİ alan kimlikleri. `parseWithSchema`
  // sayısal ham değeri olan HER alanı `state.values`a yazar, dolayısıyla uzunluk
  // kaynağı `type: 'length'` olmak zorunda değildir (spec §9.6'nın kendi örneği
  // `payloadLength`i `uint8` yazar). Burada işaretsiz ve sabit genişlikli tam
  // sayı alanlarıyla sınırlanır: gerisini okumak tahmin olurdu.
  const resolvableLengthSources = new Set<string>();
  let extentDerivable = true;
  let hasLengthSource = false;

  for (const field of schema.fields) {
    // Koşullu, tekrarlı ve bileşik alanların çerçevedeki yeri ancak ayrıştırma
    // sırasında belli olur; `canParse` ayrıştırma YAPMAZ, o yüzden bu şemadan
    // bir çerçeve boyu türetilemez.
    if (
      field.condition !== undefined ||
      field.repeatCount !== undefined ||
      isCompositeField(field.type)
    ) {
      extentDerivable = false;
      break;
    }

    if (field.lengthFrom !== undefined) {
      // Kaynak alan daha ÖNCE gelmiş ve sayısal olarak okunabiliyor olmalı.
      if (!resolvableLengthSources.has(field.lengthFrom)) {
        extentDerivable = false;
        break;
      }
      hasLengthSource = true;
    }

    const staticLength = field.lengthFrom === undefined ? staticFieldLength(field) : undefined;
    if (field.lengthFrom === undefined && staticLength === undefined) {
      extentDerivable = false;
      break;
    }

    const info = fieldTypeInfo(field.type);
    const signed = field.signed ?? info.signed ?? false;
    const readsValue =
      staticLength !== undefined &&
      staticLength >= 1 &&
      staticLength <= MAX_LENGTH_FIELD_BYTES &&
      info.kind === 'integer' &&
      !signed;
    if (readsValue) {
      resolvableLengthSources.add(field.id);
    }

    fields.push({
      id: field.id,
      offset: field.offset,
      staticLength,
      lengthFrom: field.lengthFrom,
      readsValue,
      isAscii: field.type === 'ascii',
      endianness: endiannessOf(field, schema),
    });
  }

  // `lengthField` çerçeveleme, boyu bir UZUNLUK ALANINDAN gelen bir çerçeve
  // vaat eder. Şemada öyle bir bağ yoksa vaat boştur: denetlenecek bir şey
  // kalmaz ve bu şema hiçbir çerçeveyi sahiplenemez.
  if (schema.framing.type === 'lengthField' && !hasLengthSource) {
    extentDerivable = false;
  }

  return {
    extentDerivable,
    fields,
    endBytes: schema.framing.type === 'startEnd' ? (schema.framing.endBytes ?? []) : [],
    maximumFrameLength: schema.framing.maximumFrameLength,
  };
}

function isPrintableAscii(data: Uint8Array, start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    const byte = data[index] ?? 0;
    const printable = byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e);
    if (!printable) {
      return false;
    }
  }
  return true;
}

/**
 * Boş `startBytes` dalının yapısal ön elemesi. `true` ancak EN AZ BİR koşul
 * gerçekten denetlendiyse döner; hiçbir koşul türetilemiyorsa cevap `false`tur.
 */
function structuralPreFilter(plan: CanParsePlan, data: Uint8Array): boolean {
  let checkedSomething = false;

  if (plan.endBytes.length > 0) {
    if (data.length < plan.endBytes.length) {
      return false;
    }
    const tailStart = data.length - plan.endBytes.length;
    for (let index = 0; index < plan.endBytes.length; index += 1) {
      if (data[tailStart + index] !== plan.endBytes[index]) {
        return false;
      }
    }
    checkedSomething = true;
  }

  if (plan.extentDerivable) {
    const declaredLengths = new Map<string, number>();
    let cursor = 0;
    let extent = 0;

    for (const field of plan.fields) {
      let length: number;
      if (field.lengthFrom === undefined) {
        length = field.staticLength ?? 0;
      } else {
        const declared = declaredLengths.get(field.lengthFrom);
        if (declared === undefined || declared < 0) {
          return false;
        }
        length = declared;
      }

      const offset = field.offset ?? cursor;
      const end = offset + length;
      if (offset < 0 || end > data.length) {
        return false;
      }

      if (field.readsValue) {
        declaredLengths.set(field.id, bytesToNumber(data.subarray(offset, end), field.endianness));
      }
      if (field.isAscii && !isPrintableAscii(data, offset, end)) {
        return false;
      }

      cursor = end;
      if (end > extent) {
        extent = end;
      }
    }

    extent += plan.endBytes.length;
    if (extent !== data.length || extent > plan.maximumFrameLength) {
      return false;
    }
    checkedSomething = true;
  }

  return checkedSomething;
}

/**
 * Şemadan spec §7 sözleşmesine uyan bir `ProtocolParser` üretir. Böylece
 * kullanıcı tanımlı protokol, kayıt defterine hazır protokollerle AYNI arayüzden
 * girebilir (spec §47: "Protokol eklentisi mantığını destekle").
 */
export function createSchemaParser(schema: ProtocolSchema): ProtocolParser {
  const startBytes = schema.framing.startBytes ?? [];
  // Boş `startBytes` dalı için şemaya bağlı ön hesap bir KEZ yapılır.
  const plan = startBytes.length === 0 ? buildCanParsePlan(schema) : undefined;

  return {
    protocolId: schema.name,
    displayName: schema.name,

    canParse(data: Uint8Array): boolean {
      if (data.length === 0) {
        return false;
      }
      // Yalnız ucuz bir ön eleme: tam ayrıştırma `parse` içinde; `canParse`
      // sıcak yolda her çerçeve için çağrılabilir.
      if (startBytes.length > 0) {
        // DEĞİŞMEYEN DAL: başlangıç baytları tutuyor mu. `startBytes`
        // `data.length`ı aşıyorsa `data[index]` `undefined` olur ve karşılaştırma
        // düşer — eskiden de böyleydi, öyle kalıyor.
        return startBytes.every((byte, index) => data[index] === byte);
      }
      return plan !== undefined && structuralPreFilter(plan, data);
    },

    parse(data: Uint8Array, context?: ParseContext): ParseResult {
      return parseWithSchema(schema, data, context === undefined ? {} : { context });
    },
  };
}
