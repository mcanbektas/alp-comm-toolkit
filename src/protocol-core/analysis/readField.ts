/**
 * Çerçevelerden aday alan değerlerini okuma. Tek yerde durmasının sebebi
 * `noUncheckedIndexedAccess`: değişken uzunluklu çerçevelerde bir ofset bazı
 * çerçevelerde YOKTUR ve `bytes[i]` `number | undefined` döner. Her motorun
 * bu guard'ı kendi yazması, birinde unutulunca sessizce 0 okunması demekti —
 * 0, telde gerçekten bulunan bir değerden ayırt edilemezdi.
 */

import { bytesToNumber } from '../buffers/endianness';
import type { AnalysisFrame, FieldEndianness, FieldWidth } from './types';

/**
 * Çerçevenin `offset`inden `width` baytlık işaretsiz değeri okur. Alan
 * çerçeveye SIĞMIYORSA `undefined` döner — kısa çerçeveyi sıfırla doldurmak
 * olmayan bir değer uydururdu.
 */
export function readFieldValue(
  frame: AnalysisFrame,
  offset: number,
  width: FieldWidth,
  endianness: FieldEndianness,
): number | undefined {
  if (offset < 0 || offset + width > frame.bytes.length) return undefined;
  return bytesToNumber(frame.bytes.subarray(offset, offset + width), endianness);
}

/**
 * Aynı alanı bütün çerçevelerde okur. Alan çerçevelerden BİRİNDE bile
 * sığmıyorsa `undefined` döner: eksik örnekle hesaplanan bir sayaç adımı ya da
 * korelasyon, aslında farklı çerçevelerden derlenmiş sahte bir seri olurdu.
 */
export function readFieldSeries(
  frames: readonly AnalysisFrame[],
  offset: number,
  width: FieldWidth,
  endianness: FieldEndianness,
): number[] | undefined {
  const values: number[] = [];
  for (const frame of frames) {
    const value = readFieldValue(frame, offset, width, endianness);
    if (value === undefined) return undefined;
    values.push(value);
  }
  return values;
}

/** Çerçeve kümesindeki en kısa ve en uzun çerçeve uzunluğu. */
export function frameLengthRange(frames: readonly AnalysisFrame[]): { readonly min: number; readonly max: number } {
  if (frames.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const frame of frames) {
    min = Math.min(min, frame.bytes.length);
    max = Math.max(max, frame.bytes.length);
  }
  return { min, max };
}
