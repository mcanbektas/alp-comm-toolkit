/**
 * Protokol şemasının ANLAM doğrulaması — spec §42'nin
 * "Protocol definition contains circular length references" hatası ve §48'in
 * "Dynamic payload length çalışmalı" kabul ölçütü.
 *
 * `schemas/protocolSchema.ts` yalnız BİÇİMİ doğrular: "JSON doğru şekilli mi".
 * Burası ise "protokol anlamlı mı" sorusunu yanıtlar — bir alan var olmayan
 * bir alandan uzunluk alıyor mu, iki alan birbirinin uzunluğunu mu bekliyor,
 * checksum kapsamı ters mi. İkisi ayrı raporlanmalı: biçim hatası dosyanın
 * bozuk olduğunu, anlam hatası protokolün yanlış tasarlandığını söyler.
 *
 * Doğrulama ÇALIŞTIRMADAN yapılır. Şemayı deneyip "patladı mı" diye bakmak
 * bozuk tanımların parser'a ulaşmasına izin verirdi; spec §41 zaten sonsuz
 * döngü ve zaman aşımı korumasını şart koşuyor, en ucuz koruma girişte elemek.
 */

import { checksumWidthBytes } from '../checksums/algorithmCatalogue';
import { fieldTypeInfo, isCompositeField, isDerivedField } from '../schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';

export type SchemaIssueCode =
  | 'duplicate-field-id'
  | 'missing-length'
  | 'conflicting-length'
  | 'unknown-length-reference'
  | 'circular-length-reference'
  | 'forward-reference'
  | 'unknown-condition-field'
  | 'unknown-repeat-reference'
  | 'unknown-coverage-field'
  | 'invalid-coverage-order'
  | 'missing-algorithm'
  | 'missing-bit-geometry'
  | 'empty-composite'
  | 'missing-repeat-count'
  | 'overlapping-fields'
  | 'exceeds-maximum-frame-length';

export interface SchemaIssue {
  readonly code: SchemaIssueCode;
  readonly severity: 'error' | 'warning';
  /** İlgili alanın kimliği; şema düzeyindeki sorunlarda yok. */
  readonly fieldId?: string;
  readonly message: string;
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SchemaIssue[];
}

interface FlatField {
  readonly field: ProtocolFieldSchema;
  /** Çerçeve boyunca çözümleme sırası — bağımlılıklar geriye bakmak zorunda. */
  readonly order: number;
  readonly path: string;
}

/**
 * Alanları çözümleme sırasında düzleştirir. İç içe yapıların alanları da
 * listeye girer: uzunluk/koşul referansları yapı sınırını aşabilir (dış
 * alandaki bir sayaç, iç alanın tekrar sayısını verebilir).
 */
function flattenFields(
  fields: readonly ProtocolFieldSchema[],
  path: string,
  accumulator: FlatField[],
): void {
  for (const field of fields) {
    const fieldPath = path === '' ? field.id : `${path}.${field.id}`;
    accumulator.push({ field, order: accumulator.length, path: fieldPath });
    if (field.fields !== undefined) {
      flattenFields(field.fields, fieldPath, accumulator);
    }
  }
}

/** Bir alanın hangi alanların DEĞERİNE bağımlı olduğu. */
function dependenciesOf(field: ProtocolFieldSchema): string[] {
  const dependencies: string[] = [];
  if (field.lengthFrom !== undefined) {
    dependencies.push(field.lengthFrom);
  }
  if (field.condition !== undefined) {
    dependencies.push(field.condition.field);
  }
  if (typeof field.repeatCount === 'object') {
    dependencies.push(field.repeatCount.fromField);
  }
  return dependencies;
}

/**
 * Bağımlılık çevrimlerini DFS ile bulur.
 *
 * Sıra denetimi tek başına yetmez gibi görünse de aslında çevrimleri de
 * yakalar (her bağımlılık geriye bakmak zorundaysa çevrim kurulamaz); yine de
 * çevrim ayrıca aranıyor, çünkü spec §42 bu hatayı ADIYLA istiyor ve kullanıcıya
 * "ileri referans" demek ile "birbirinize bağladınız" demek farklı şeyler.
 */
function findCycles(flat: readonly FlatField[]): string[][] {
  const byId = new Map<string, FlatField>();
  for (const entry of flat) {
    if (!byId.has(entry.field.id)) {
      byId.set(entry.field.id, entry);
    }
  }

  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  function visit(id: string): void {
    const current = state.get(id);
    if (current === 'done') {
      return;
    }
    if (current === 'visiting') {
      const start = stack.indexOf(id);
      cycles.push([...stack.slice(start === -1 ? 0 : start), id]);
      return;
    }

    const entry = byId.get(id);
    if (entry === undefined) {
      // Var olmayan referans ayrı bir hata; çevrim aramasını durdurmamalı.
      return;
    }

    state.set(id, 'visiting');
    stack.push(id);
    for (const dependency of dependenciesOf(entry.field)) {
      visit(dependency);
    }
    stack.pop();
    state.set(id, 'done');
  }

  for (const entry of flat) {
    visit(entry.field.id);
  }
  return cycles;
}

/** Alanın statik olarak bilinen bayt uzunluğu; bilinemiyorsa `undefined`. */
export function staticFieldLength(field: ProtocolFieldSchema): number | undefined {
  if (field.lengthFrom !== undefined) {
    return undefined;
  }
  if (isDerivedField(field.type)) {
    return field.algorithm === undefined ? undefined : checksumWidthBytes(field.algorithm);
  }
  const info = fieldTypeInfo(field.type);
  if (info.kind === 'bits') {
    // `bitOffset` de kapsanır: bit 4'ten başlayan 8 bitlik alan iki bayta yayılır.
    return field.bitLength === undefined
      ? undefined
      : Math.ceil(((field.bitOffset ?? 0) + field.bitLength) / 8);
  }
  if (field.length !== undefined) {
    return field.length;
  }
  return info.byteLength;
}

export function validateProtocolSchema(schema: ProtocolSchema): SchemaValidationResult {
  const issues: SchemaIssue[] = [];
  const flat: FlatField[] = [];
  flattenFields(schema.fields, '', flat);

  const seenIds = new Set<string>();
  const orderById = new Map<string, number>();
  for (const entry of flat) {
    if (seenIds.has(entry.field.id)) {
      issues.push({
        code: 'duplicate-field-id',
        severity: 'error',
        fieldId: entry.field.id,
        message: `Alan kimliği birden çok kez kullanılmış: "${entry.field.id}"`,
      });
    } else {
      seenIds.add(entry.field.id);
      orderById.set(entry.field.id, entry.order);
    }
  }

  for (const entry of flat) {
    const { field } = entry;
    const info = fieldTypeInfo(field.type);

    // --- Uzunluk ---
    if (field.length !== undefined && field.lengthFrom !== undefined) {
      issues.push({
        code: 'conflicting-length',
        severity: 'error',
        fieldId: field.id,
        message: `"${field.id}" hem sabit uzunluk hem de dinamik uzunluk kaynağı taşıyor; biri seçilmeli`,
      });
    }
    if (
      info.requiresExplicitLength === true &&
      field.length === undefined &&
      field.lengthFrom === undefined &&
      !isCompositeField(field.type) &&
      !isDerivedField(field.type)
    ) {
      issues.push({
        code: 'missing-length',
        severity: 'error',
        fieldId: field.id,
        message: `"${field.id}" (${field.type}) uzunluk taşımıyor; "length" ya da "lengthFrom" gerekli`,
      });
    }
    if (info.byteLength !== undefined && field.length !== undefined && field.length !== info.byteLength) {
      issues.push({
        code: 'conflicting-length',
        severity: 'warning',
        fieldId: field.id,
        message: `"${field.id}" tipi ${field.type} ${info.byteLength} bayt; şemadaki ${field.length} yok sayılacak`,
      });
    }

    // --- Bit geometrisi ---
    if (info.kind === 'bits' && field.bitLength === undefined) {
      issues.push({
        code: 'missing-bit-geometry',
        severity: 'error',
        fieldId: field.id,
        message: `"${field.id}" bir bit alanı ama "bitLength" verilmemiş`,
      });
    }

    // --- Türetilmiş alanlar ---
    if (isDerivedField(field.type)) {
      if (field.algorithm === undefined) {
        issues.push({
          code: 'missing-algorithm',
          severity: 'error',
          fieldId: field.id,
          message: `"${field.id}" bir ${field.type} alanı ama "algorithm" verilmemiş`,
        });
      }
      if (field.coverage !== undefined) {
        const startOrder = orderById.get(field.coverage.startField);
        const endOrder = orderById.get(field.coverage.endField);
        for (const [role, id] of [
          ['startField', field.coverage.startField],
          ['endField', field.coverage.endField],
        ] as const) {
          if (!orderById.has(id)) {
            issues.push({
              code: 'unknown-coverage-field',
              severity: 'error',
              fieldId: field.id,
              message: `"${field.id}" kapsamındaki ${role} "${id}" diye bir alan yok`,
            });
          }
        }
        if (startOrder !== undefined && endOrder !== undefined && startOrder > endOrder) {
          issues.push({
            code: 'invalid-coverage-order',
            severity: 'error',
            fieldId: field.id,
            message: `"${field.id}" kapsamı ters: "${field.coverage.startField}" alanı "${field.coverage.endField}" alanından sonra geliyor`,
          });
        }
      }
    }

    // --- Bileşik alanlar ---
    if (isCompositeField(field.type)) {
      if (field.fields === undefined || field.fields.length === 0) {
        issues.push({
          code: 'empty-composite',
          severity: 'error',
          fieldId: field.id,
          message: `"${field.id}" (${field.type}) iç alan taşımıyor`,
        });
      }
      if (field.type === 'array' && field.repeatCount === undefined) {
        issues.push({
          code: 'missing-repeat-count',
          severity: 'error',
          fieldId: field.id,
          message: `"${field.id}" bir dizi ama tekrar sayısı ("repeatCount") verilmemiş`,
        });
      }
    }

    // --- Referanslar: var mı, geriye mi bakıyor ---
    const references: readonly (readonly [SchemaIssueCode, string])[] = [
      ...(field.lengthFrom === undefined
        ? []
        : ([['unknown-length-reference', field.lengthFrom]] as const)),
      ...(field.condition === undefined
        ? []
        : ([['unknown-condition-field', field.condition.field]] as const)),
      ...(typeof field.repeatCount === 'object'
        ? ([['unknown-repeat-reference', field.repeatCount.fromField]] as const)
        : []),
    ];

    for (const [code, referencedId] of references) {
      const targetOrder = orderById.get(referencedId);
      if (targetOrder === undefined) {
        issues.push({
          code,
          severity: 'error',
          fieldId: field.id,
          message: `"${field.id}" alanı "${referencedId}" diye bir alana bakıyor ama böyle bir alan yok`,
        });
        continue;
      }
      if (targetOrder >= entry.order) {
        // Değeri henüz okunmamış bir alandan uzunluk/koşul almak imkânsız.
        issues.push({
          code: targetOrder === entry.order ? 'circular-length-reference' : 'forward-reference',
          severity: 'error',
          fieldId: field.id,
          message:
            targetOrder === entry.order
              ? `"${field.id}" kendi kendine bağımlı — Protocol definition contains circular length references`
              : `"${field.id}" kendisinden SONRA gelen "${referencedId}" alanına bağımlı; o alan henüz çözümlenmemiş olur`,
        });
      }
    }
  }

  for (const cycle of findCycles(flat)) {
    issues.push({
      code: 'circular-length-reference',
      severity: 'error',
      fieldId: cycle[0],
      message: `Protocol definition contains circular length references: ${cycle.join(' → ')}`,
    });
  }

  // --- Açık ofsetlerin çakışması ---
  const positioned = flat
    .filter((entry) => entry.field.offset !== undefined)
    .map((entry) => ({ entry, start: entry.field.offset ?? 0, length: staticFieldLength(entry.field) }))
    .filter((item): item is { entry: FlatField; start: number; length: number } => item.length !== undefined)
    .sort((left, right) => left.start - right.start);

  for (let index = 1; index < positioned.length; index += 1) {
    const previous = positioned[index - 1];
    const current = positioned[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (previous.start + previous.length > current.start) {
      issues.push({
        code: 'overlapping-fields',
        severity: 'error',
        fieldId: current.entry.field.id,
        message: `"${current.entry.field.id}" alanı ${current.start}. bayttan başlıyor ama "${previous.entry.field.id}" ${previous.start + previous.length}. bayta kadar sürüyor`,
      });
    }
  }

  // --- Azami çerçeve uzunluğu ---
  const lastPositioned = positioned[positioned.length - 1];
  if (lastPositioned !== undefined) {
    const minimumFrameLength = lastPositioned.start + lastPositioned.length;
    if (minimumFrameLength > schema.framing.maximumFrameLength) {
      issues.push({
        code: 'exceeds-maximum-frame-length',
        severity: 'error',
        message: `Alanlar en az ${minimumFrameLength} bayt yer kaplıyor ama azami çerçeve uzunluğu ${schema.framing.maximumFrameLength}`,
      });
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}
