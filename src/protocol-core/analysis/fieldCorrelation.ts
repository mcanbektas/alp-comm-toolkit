/**
 * Korelasyon analizi — spec §35 "Korelasyon analizi" ve §36'nın "Korelasyon"
 * maddesi. İki soru sorulur:
 *
 * 1. Bir alan, KULLANICININ verdiği bilinen değer serisiyle örtüşüyor mu?
 *    (spec 16283: gyro heading 90° iken payload `23 28`, 100° iken `27 10` —
 *    2 baytlık büyük uçlu alan, derecenin 100 katı.)
 * 2. İki alan birbiriyle örtüşüyor mu? (aynı sayaçtan türeyen alanlar, ölçek
 *    çiftleri.)
 *
 * ── EN AZ ÜÇ ÖRNEK ────────────────────────────────────────────────────────
 * Pearson iki noktada HER ZAMAN ±1 verir: iki noktadan geçen doğru tektir.
 * `counterDetect`teki eşiğin aynısı burada da geçerli — üç örnekten azıyla
 * "korelasyon bulundu" demek veriyle desteklenmeyen bir iddiadır.
 *
 * ── EVAL YASAĞI ───────────────────────────────────────────────────────────
 * Bilinen değer serisi SAYI DİZİSİ olarak alınır. Kullanıcı tanımlı formül /
 * ifade alanı YOK: sandbox'sız değerlendirme (CLAUDE.md) yasak. Ölçek ve ofset
 * zaten Pearson'ı etkilemez — `value × 100` ile `value` aynı katsayıyı verir,
 * kullanıcının dönüşümü elle yazmasına gerek kalmaz.
 *
 * ── BÜTÇE ─────────────────────────────────────────────────────────────────
 * Alan↔alan taraması ofset sayısında KARESEL büyür. Varsayılan olarak yalnız
 * tek baytlık sütunlar eşleştirilir ve `maxPairs` bütçesi aşıldığında tarama
 * durur (100 bin çerçeve şartı §44). Çok baytlı alan↔alan karşılaştırması
 * gerekiyorsa `widths` açıkça verilir.
 */

import { pearsonCorrelation } from '../statistics/correlation';
import { readFieldSeries } from './readField';
import { FIELD_ENDIANNESSES, FIELD_WIDTHS, normalizeEndianness } from './types';
import type { AnalysisFrame, FieldEndianness, FieldWidth } from './types';

const MIN_SAMPLES_FOR_CORRELATION = 3;
const DEFAULT_MIN_ABS_COEFFICIENT = 0.9;
const DEFAULT_MAX_PAIRS = 20000;

export interface FieldRef {
  readonly offset: number;
  readonly width: FieldWidth;
  readonly endianness: FieldEndianness;
}

export interface FieldCorrelationOptions {
  readonly widths?: readonly FieldWidth[];
  /** Mutlak değeri bunun altındaki katsayı raporlanmaz. */
  readonly minAbsCoefficient?: number;
  /** Alan↔alan taramasında denenecek azami çift sayısı. */
  readonly maxPairs?: number;
}

export interface SeriesCorrelation extends FieldRef {
  readonly coefficient: number;
}

export interface FieldPairCorrelation {
  readonly left: FieldRef;
  readonly right: FieldRef;
  readonly coefficient: number;
}

/**
 * Bilinen değer serisiyle örtüşen alanları arar. `values` uzunluğu çerçeve
 * sayısına EŞİT olmalıdır: kısa seriyi hizalamak, hangi ölçümün hangi çerçeveye
 * ait olduğunu uydurmak olurdu.
 */
export function correlateFieldsWithSeries(
  frames: readonly AnalysisFrame[],
  values: readonly number[],
  options: FieldCorrelationOptions = {},
): SeriesCorrelation[] {
  if (frames.length < MIN_SAMPLES_FOR_CORRELATION) return [];
  if (values.length !== frames.length) return [];

  const widths = options.widths ?? FIELD_WIDTHS;
  const minAbs = options.minAbsCoefficient ?? DEFAULT_MIN_ABS_COEFFICIENT;
  const results: SeriesCorrelation[] = [];

  for (const field of enumerateFields(frames, widths)) {
    const series = readFieldSeries(frames, field.offset, field.width, field.endianness);
    if (series === undefined) continue;
    const coefficient = pearsonCorrelation(series, values);
    if (coefficient === undefined || Math.abs(coefficient) < minAbs) continue;
    results.push({ ...field, coefficient });
  }

  // Eşit güçte DAR alan önce gelir: geniş bir okuma (ör. sabit başlık + gerçek
  // alan) dar alanı içerdiği için aynı katsayıyı verir, ama daha az bilgi taşır.
  return results.sort(
    (a, b) =>
      Math.abs(b.coefficient) - Math.abs(a.coefficient) || a.width - b.width || a.offset - b.offset,
  );
}

/** Alan↔alan korelasyonu. Aynı alanın kendisiyle ve örtüşen okumalarla eşleşmesi elenir. */
export function correlateFields(
  frames: readonly AnalysisFrame[],
  options: FieldCorrelationOptions = {},
): FieldPairCorrelation[] {
  if (frames.length < MIN_SAMPLES_FOR_CORRELATION) return [];
  const widths = options.widths ?? [1];
  const minAbs = options.minAbsCoefficient ?? DEFAULT_MIN_ABS_COEFFICIENT;
  const maxPairs = options.maxPairs ?? DEFAULT_MAX_PAIRS;

  const fields = enumerateFields(frames, widths);
  const seriesCache = new Map<string, number[]>();
  for (const field of fields) {
    const series = readFieldSeries(frames, field.offset, field.width, field.endianness);
    if (series !== undefined) seriesCache.set(fieldKey(field), series);
  }

  const results: FieldPairCorrelation[] = [];
  let pairs = 0;

  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      if (pairs >= maxPairs) return sortPairs(results);
      const left = fields[i];
      const right = fields[j];
      if (left === undefined || right === undefined) continue;
      // Üst üste binen okumalar (aynı baytları paylaşan alanlar) kendi
      // kendileriyle korele çıkar; bu bir bulgu değil, aynı veriyi iki kez
      // okumaktır.
      if (overlaps(left, right)) continue;

      const leftSeries = seriesCache.get(fieldKey(left));
      const rightSeries = seriesCache.get(fieldKey(right));
      if (leftSeries === undefined || rightSeries === undefined) continue;

      pairs += 1;
      const coefficient = pearsonCorrelation(leftSeries, rightSeries);
      if (coefficient === undefined || Math.abs(coefficient) < minAbs) continue;
      results.push({ left, right, coefficient });
    }
  }

  return sortPairs(results);
}

function enumerateFields(frames: readonly AnalysisFrame[], widths: readonly FieldWidth[]): FieldRef[] {
  let minLength = Number.POSITIVE_INFINITY;
  for (const frame of frames) minLength = Math.min(minLength, frame.bytes.length);
  if (!Number.isFinite(minLength)) return [];

  const fields: FieldRef[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < minLength; offset++) {
    for (const width of widths) {
      if (offset + width > minLength) continue;
      for (const endianness of FIELD_ENDIANNESSES) {
        const normalized = normalizeEndianness(width, endianness);
        const field: FieldRef = { offset, width, endianness: normalized };
        const key = fieldKey(field);
        if (seen.has(key)) continue;
        seen.add(key);
        fields.push(field);
      }
    }
  }
  return fields;
}

function overlaps(left: FieldRef, right: FieldRef): boolean {
  return left.offset < right.offset + right.width && right.offset < left.offset + left.width;
}

function fieldKey(field: FieldRef): string {
  return `${field.offset}:${field.width}:${field.endianness}`;
}

function sortPairs(results: FieldPairCorrelation[]): FieldPairCorrelation[] {
  return results.sort(
    (a, b) =>
      Math.abs(b.coefficient) - Math.abs(a.coefficient) ||
      a.left.offset - b.left.offset ||
      a.right.offset - b.right.offset ||
      a.left.width - b.left.width,
  );
}
