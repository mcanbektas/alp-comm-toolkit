/**
 * Uzunluk alanı tespiti — spec §35 "Uzunluk alanı tespiti". Spec yöntem
 * vermiyor; buradaki ölçüt şu: bir alan, DEĞERİ ile çerçevenin uzunluğu
 * arasında SABİT bir fark taşıyorsa uzunluk alanıdır.
 *
 *   frameLength = value + lengthOffset   (lengthOffset bütün çerçevelerde aynı)
 *
 * `lengthOffset` protokolün "uzunluk neyi sayıyor" kararıdır: yalnız gövdeyi mi,
 * başlığı da mı, CRC dahil mi. Onu sabit bir sayı olarak raporlamak, kullanıcıya
 * cevabı doğrudan verir.
 *
 * ── EN AZ İKİ FARKLI UZUNLUK ŞART ─────────────────────────────────────────
 * Bütün çerçeveler aynı uzunluktaysa HER sabit alan bu testi geçer: sabit bir
 * bayt ile sabit bir uzunluk arasındaki fark da sabittir. Böyle bir kümede
 * "uzunluk alanı buldum" demek uydurmadır; ayrım ancak uzunluk değişince
 * görülür. Bu durumda boş liste döner.
 */

import { frameLengthRange, readFieldSeries } from './readField';
import type { AnalysisFrame, FieldEndianness, FieldWidth } from './types';
import { FIELD_ENDIANNESSES, FIELD_WIDTHS, normalizeEndianness } from './types';

const MIN_FRAMES = 2;

export interface LengthFieldCandidate {
  readonly offset: number;
  readonly width: FieldWidth;
  readonly endianness: FieldEndianness;
  /** `frameLength − value`; 0 ise alan çerçevenin tamamını sayıyor. */
  readonly lengthOffset: number;
}

export function detectLengthFields(frames: readonly AnalysisFrame[]): LengthFieldCandidate[] {
  if (frames.length < MIN_FRAMES) return [];
  const { min, max } = frameLengthRange(frames);
  // Tek uzunluklu kümede ayrım yapılamaz (bkz. dosya başı).
  if (min === max) return [];

  const candidates: LengthFieldCandidate[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < min; offset++) {
    for (const width of FIELD_WIDTHS) {
      for (const endianness of FIELD_ENDIANNESSES) {
        const normalized = normalizeEndianness(width, endianness);
        const key = `${offset}:${width}:${normalized}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const values = readFieldSeries(frames, offset, width, normalized);
        if (values === undefined) continue;

        const firstFrame = frames[0];
        if (firstFrame === undefined) continue;
        const lengthOffset = firstFrame.bytes.length - (values[0] ?? 0);
        const matches = frames.every((frame, index) => frame.bytes.length - (values[index] ?? 0) === lengthOffset);
        if (matches) candidates.push({ offset, width, endianness: normalized, lengthOffset });
      }
    }
  }

  return candidates.sort((left, right) => left.offset - right.offset || left.width - right.width);
}
