/**
 * Şemadan paket üretimi — spec §10 Packet Builder'ın motoru.
 *
 * Ayrıştırmanın tersi ama simetrik değil: çözerken uzunluk ve checksum
 * çerçeveden OKUNUR, üretirken HESAPLANIR. Spec §10 bunu açıkça istiyor
 * ("Otomatik length hesaplama", "Otomatik CRC", "Otomatik checksum") — kullanıcı
 * bu alanları elle giremez, girse de yok sayılır.
 *
 * ## Neden üç geçiş
 *
 * 1. **İçerik alanları kodlanır.** Uzunlukları ancak burada belli olur; dinamik
 *    payload'ın kaç bayt olduğunu kullanıcı girdisi belirler.
 * 2. **Türetilen uzunluklar doldurulur.** `lengthFrom: "payloadLength"` diyen
 *    bir alan varsa, `payloadLength`in DEĞERİ o alanın bayt sayısıdır. Tek
 *    geçişte yapılamaz: uzunluk alanı payload'dan ÖNCE gelir ama değeri
 *    payload'a bağlıdır.
 * 3. **Checksum'lar hesaplanır.** Kapsam alan kimliği aralığıdır; bayt aralığı
 *    ancak yerleşim bittikten sonra bilinir.
 */

import { numberToBytes, toUnsignedRaw } from '../buffers/endianness';
import { toRawValue } from '../buffers/physicalValue';
import { checksumToBytes, checksumWidthBytes, computeChecksum } from '../checksums/algorithmCatalogue';
import { writeBits } from '../decoding/bitCursor';
import { fieldTypeInfo, isCompositeField, isDerivedField } from '../schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import type { Endianness } from './ieee754';
import { encodeFloat16, encodeFloat32, encodeFloat64 } from './ieee754';
import { encodeBcd } from './bcd';
import { stringToUtf8Bytes } from './utf8Viewer';

export type EncodeIssueCode =
  | 'missing-value'
  | 'value-out-of-range'
  | 'invalid-value'
  | 'unknown-enum-label'
  | 'length-mismatch'
  | 'exceeds-maximum-frame-length';

export interface EncodeIssue {
  readonly code: EncodeIssueCode;
  readonly fieldId: string;
  readonly message: string;
}

export type EncodeFieldValue = number | bigint | string | boolean | Uint8Array;

/** Alan kimliği → değer. İç içe alanlar `header.a`, dizi öğeleri `items[0].v`. */
export type EncodeValues = Readonly<Record<string, EncodeFieldValue | undefined>>;

export type EncodeResult =
  | { readonly success: true; readonly bytes: Uint8Array; readonly issues: readonly EncodeIssue[] }
  | { readonly success: false; readonly issues: readonly EncodeIssue[] };

interface EncodedPiece {
  readonly fieldId: string;
  readonly schemaId: string;
  bytes: Uint8Array;
  /** Uzunluğu sonradan doldurulacak alan mı. */
  readonly derivedLengthFor?: string;
  readonly checksumField?: ProtocolFieldSchema;
}

function endiannessOf(field: ProtocolFieldSchema, schema: ProtocolSchema): Endianness {
  return field.endianness ?? schema.defaultEndianness ?? 'big';
}

/** Spec §42'nin birebir hata metni: "Value exceeds uint16 range". */
function rangeMessage(type: string): string {
  return `Value exceeds ${type} range`;
}

function integerBounds(byteLength: number, signed: boolean): { min: bigint; max: bigint } {
  const bits = BigInt(byteLength * 8);
  if (signed) {
    const half = 1n << (bits - 1n);
    return { min: -half, max: half - 1n };
  }
  return { min: 0n, max: (1n << bits) - 1n };
}

function toBigInt(value: EncodeFieldValue): bigint | undefined {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? BigInt(Math.round(value)) : undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 1n : 0n;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+$/.test(trimmed)) {
      return undefined;
    }
    return BigInt(trimmed);
  }
  return undefined;
}

function bigIntToBytes(value: bigint, byteLength: number, order: Endianness): Uint8Array {
  const result = new Uint8Array(byteLength);
  const mask = (1n << BigInt(byteLength * 8)) - 1n;
  const unsigned = value < 0n ? (value + (1n << BigInt(byteLength * 8))) & mask : value & mask;
  for (let index = 0; index < byteLength; index += 1) {
    const byte = Number((unsigned >> BigInt(8 * index)) & 0xffn);
    result[order === 'little' ? index : byteLength - 1 - index] = byte;
  }
  return result;
}

/** Alanın sabit bayt genişliği; bilinemezse `undefined`. */
function fixedLengthOf(field: ProtocolFieldSchema): number | undefined {
  const info = fieldTypeInfo(field.type);
  if (info.kind === 'bits') {
    return Math.ceil(((field.bitOffset ?? 0) + (field.bitLength ?? 0)) / 8);
  }
  if (field.length !== undefined) {
    return field.length;
  }
  return info.byteLength;
}

function encodeScalar(
  field: ProtocolFieldSchema,
  schema: ProtocolSchema,
  value: EncodeFieldValue | undefined,
  issues: EncodeIssue[],
  fieldId: string,
): Uint8Array {
  const info = fieldTypeInfo(field.type);
  const order = endiannessOf(field, schema);
  const byteLength = fixedLengthOf(field);

  // --- Ham bayt taşıyan tipler ---
  if (info.kind === 'bytes') {
    if (value instanceof Uint8Array) {
      if (field.length !== undefined && value.length !== field.length) {
        issues.push({
          code: 'length-mismatch',
          fieldId,
          message: `"${fieldId}" ${field.length} bayt bekliyor, ${value.length} bayt verildi`,
        });
      }
      return Uint8Array.from(value);
    }
    if (value === undefined) {
      // padding/reserved varsayılan olarak sıfırdır; kullanıcıdan istenmez.
      return new Uint8Array(byteLength ?? 0);
    }
    if (typeof value === 'string') {
      return stringToUtf8Bytes(value);
    }
    issues.push({ code: 'invalid-value', fieldId, message: `"${fieldId}" için bayt dizisi bekleniyor` });
    return new Uint8Array(byteLength ?? 0);
  }

  // --- Metin ---
  if (info.kind === 'text') {
    const text = value === undefined ? '' : String(value);
    const encoded =
      field.type === 'utf8'
        ? stringToUtf8Bytes(text)
        : Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
    if (field.length === undefined) {
      return encoded;
    }
    // Sabit uzunluklu metin alanı sıfırla doldurulur ya da kırpılır.
    const padded = new Uint8Array(field.length);
    padded.set(encoded.subarray(0, field.length), 0);
    if (encoded.length > field.length) {
      issues.push({
        code: 'length-mismatch',
        fieldId,
        message: `"${fieldId}" ${field.length} bayta kırpıldı (${encoded.length} bayt verildi)`,
      });
    }
    return padded;
  }

  // --- Ondalıklı ---
  if (info.kind === 'float') {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      issues.push({ code: 'invalid-value', fieldId, message: `"${fieldId}" için sayı bekleniyor` });
      return new Uint8Array(byteLength ?? 4);
    }
    const raw = field.scale === undefined && field.calibrationOffset === undefined
      ? numeric
      : toRawValue(numeric, field.scale ?? 1, field.calibrationOffset ?? 0);
    return field.type === 'float16'
      ? encodeFloat16(raw, order)
      : field.type === 'float32'
        ? encodeFloat32(raw, order)
        : encodeFloat64(raw, order);
  }

  // --- Boolean ---
  if (info.kind === 'boolean') {
    const truthy = value === true || value === 1 || value === '1' || value === 'true';
    return Uint8Array.from([truthy ? 1 : 0]);
  }

  // --- Enum: sayı ya da etiket adı kabul edilir ---
  if (info.kind === 'enum') {
    let numeric = toBigInt(value ?? 0);
    if (numeric === undefined && typeof value === 'string' && field.enumValues !== undefined) {
      const match = Object.entries(field.enumValues).find(([, label]) => label === value);
      if (match === undefined) {
        issues.push({
          code: 'unknown-enum-label',
          fieldId,
          message: `"${fieldId}" için bilinmeyen enum adı: ${value}`,
        });
        numeric = 0n;
      } else {
        numeric = BigInt(match[0]);
      }
    }
    return bigIntToBytes(numeric ?? 0n, byteLength ?? 1, order);
  }

  // --- Bit alanı ---
  if (info.kind === 'bits') {
    const target = new Uint8Array(byteLength ?? 1);
    const numeric = toBigInt(value ?? 0) ?? 0n;
    writeBits(target, field.bitOffset ?? 0, field.bitLength ?? 0, numeric, field.bitOrder ?? 'msb-first');
    return target;
  }

  // --- Zaman damgası ve tam sayılar ---
  const width = byteLength ?? 1;

  if (field.type === 'bcd') {
    const numeric = Number(toBigInt(value ?? 0) ?? 0n);
    const encoded = encodeBcd(numeric);
    if (field.length !== undefined && encoded.length !== field.length) {
      const padded = new Uint8Array(field.length);
      padded.set(encoded.subarray(0, field.length), Math.max(0, field.length - encoded.length));
      return padded;
    }
    return encoded;
  }

  const scaled =
    typeof value === 'number' && (field.scale !== undefined || field.calibrationOffset !== undefined)
      ? Math.round(toRawValue(value, field.scale ?? 1, field.calibrationOffset ?? 0))
      : value;

  const numeric = toBigInt(scaled ?? 0);
  if (numeric === undefined) {
    issues.push({ code: 'invalid-value', fieldId, message: `"${fieldId}" için sayı bekleniyor` });
    return new Uint8Array(width);
  }

  const signed = field.signed ?? info.signed ?? false;
  const bounds = integerBounds(width, signed);
  if (numeric < bounds.min || numeric > bounds.max) {
    issues.push({ code: 'value-out-of-range', fieldId, message: rangeMessage(field.type) });
    return new Uint8Array(width);
  }

  if (signed) {
    return numberToBytes(toUnsignedRaw(Number(numeric), width * 8), width, order);
  }
  return bigIntToBytes(numeric, width, order);
}

function conditionMet(
  field: ProtocolFieldSchema,
  values: EncodeValues,
  namespace: string,
): boolean {
  if (field.condition === undefined) {
    return true;
  }
  const key = namespace === '' ? field.condition.field : `${namespace}.${field.condition.field}`;
  const actual = values[key] ?? values[field.condition.field];
  return Number(actual) === field.condition.equals;
}

function collectPieces(
  fields: readonly ProtocolFieldSchema[],
  namespace: string,
  schema: ProtocolSchema,
  values: EncodeValues,
  issues: EncodeIssue[],
  pieces: EncodedPiece[],
): void {
  for (const field of fields) {
    if (!conditionMet(field, values, namespace)) {
      continue;
    }
    const fieldId = namespace === '' ? field.id : `${namespace}.${field.id}`;

    if (isCompositeField(field.type)) {
      const repeat = field.repeatCount;
      const iterations =
        field.type !== 'array'
          ? 1
          : typeof repeat === 'number'
            ? repeat
            : Number(values[repeat?.fromField ?? ''] ?? 0);

      for (let index = 0; index < iterations; index += 1) {
        const elementNamespace = field.type === 'array' ? `${fieldId}[${index}]` : fieldId;
        collectPieces(field.fields ?? [], elementNamespace, schema, values, issues, pieces);
      }
      continue;
    }

    if (isDerivedField(field.type)) {
      const width = field.algorithm === undefined ? 0 : checksumWidthBytes(field.algorithm);
      pieces.push({
        fieldId,
        schemaId: field.id,
        bytes: new Uint8Array(width),
        checksumField: field,
      });
      continue;
    }

    pieces.push({
      fieldId,
      schemaId: field.id,
      bytes: encodeScalar(field, schema, values[fieldId], issues, fieldId),
    });
  }
}

/** Hangi uzunluk alanı hangi alanın uzunluğunu taşıyor. */
function buildLengthTargets(
  fields: readonly ProtocolFieldSchema[],
  targets: Map<string, string>,
): void {
  for (const field of fields) {
    if (field.lengthFrom !== undefined) {
      targets.set(field.lengthFrom, field.id);
    }
    if (field.fields !== undefined) {
      buildLengthTargets(field.fields, targets);
    }
  }
}

/**
 * Şemadan paket üretir.
 *
 * Uzunluk ve checksum alanları KULLANICIDAN ALINMAZ, hesaplanır — spec §10.
 * Kullanıcı bir değer verse bile üzerine yazılır; yoksa "elle girilmiş yanlış
 * uzunluk" diye bir hata sınıfı doğardı ve Packet Builder'ın varlık sebebi
 * ortadan kalkardı.
 */
export function encodeWithSchema(schema: ProtocolSchema, values: EncodeValues): EncodeResult {
  const issues: EncodeIssue[] = [];
  const pieces: EncodedPiece[] = [];

  collectPieces(schema.fields, '', schema, values, issues, pieces);

  // --- 2. geçiş: türetilen uzunlukları doldur ---
  const lengthTargets = new Map<string, string>();
  buildLengthTargets(schema.fields, lengthTargets);

  const pieceBySchemaId = new Map<string, EncodedPiece>();
  for (const piece of pieces) {
    if (!pieceBySchemaId.has(piece.schemaId)) {
      pieceBySchemaId.set(piece.schemaId, piece);
    }
  }

  for (const [lengthFieldId, measuredFieldId] of lengthTargets) {
    const lengthPiece = pieceBySchemaId.get(lengthFieldId);
    const measuredPiece = pieceBySchemaId.get(measuredFieldId);
    if (lengthPiece === undefined || measuredPiece === undefined) {
      continue;
    }
    const width = lengthPiece.bytes.length;
    const bounds = integerBounds(width, false);
    const measured = BigInt(measuredPiece.bytes.length);
    if (measured > bounds.max) {
      issues.push({
        code: 'value-out-of-range',
        fieldId: lengthFieldId,
        message: `Payload ${measured} bayt; ${width} baytlık uzunluk alanına sığmıyor`,
      });
      continue;
    }
    lengthPiece.bytes = bigIntToBytes(measured, width, schema.defaultEndianness ?? 'big');
  }

  // --- Yerleşim ---
  const startBytes = Uint8Array.from(schema.framing.startBytes ?? []);
  const endBytes = Uint8Array.from(
    schema.framing.type === 'startEnd' ? (schema.framing.endBytes ?? []) : [],
  );

  const bodyLength = pieces.reduce((total, piece) => total + piece.bytes.length, 0);
  const frame = new Uint8Array(startBytes.length + bodyLength + endBytes.length);
  frame.set(startBytes, 0);

  const ranges = new Map<string, { start: number; end: number }>();
  let cursor = startBytes.length;
  for (const piece of pieces) {
    frame.set(piece.bytes, cursor);
    if (!ranges.has(piece.schemaId)) {
      ranges.set(piece.schemaId, { start: cursor, end: cursor + piece.bytes.length });
    }
    cursor += piece.bytes.length;
  }
  frame.set(endBytes, cursor);

  // --- 3. geçiş: checksum'lar ---
  for (const piece of pieces) {
    const field = piece.checksumField;
    if (field === undefined || field.algorithm === undefined || field.coverage === undefined) {
      continue;
    }
    const start = ranges.get(field.coverage.startField);
    const end = ranges.get(field.coverage.endField);
    const own = ranges.get(piece.schemaId);
    if (start === undefined || end === undefined || own === undefined) {
      issues.push({
        code: 'invalid-value',
        fieldId: piece.fieldId,
        message: `"${piece.fieldId}" kapsamı çözümlenemedi`,
      });
      continue;
    }
    const computed = computeChecksum(frame.subarray(start.start, end.end), field.algorithm);
    if (computed === undefined) {
      continue;
    }
    frame.set(
      checksumToBytes(computed, own.end - own.start, endiannessOf(field, schema)),
      own.start,
    );
  }

  if (frame.length > schema.framing.maximumFrameLength) {
    issues.push({
      code: 'exceeds-maximum-frame-length',
      fieldId: '',
      message: `Üretilen paket ${frame.length} bayt; azami ${schema.framing.maximumFrameLength}`,
    });
  }

  const blocking = issues.filter((issue) => issue.code !== 'length-mismatch');
  if (blocking.length > 0) {
    return { success: false, issues };
  }
  return { success: true, bytes: frame, issues };
}
