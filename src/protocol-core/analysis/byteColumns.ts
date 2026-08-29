/**
 * Sütun (bayt konumu) profili — spec §35'in "sabit byte tespiti", "değişen
 * byte tespiti", "entropy analizi" ve "ASCII alanı tespiti" maddelerinin ortak
 * temeli. Spec'in birinci formülü:
 *
 *   ChangeRate_i = Count(Byte_i(t) ≠ Byte_i(t−1)) / (N − 1)
 *
 * ── DEĞİŞKEN UZUNLUK ──────────────────────────────────────────────────────
 * Bir ofset bütün çerçevelerde bulunmayabilir. Sütun yalnız o ofsete SAHİP
 * çerçevelerden hesaplanır ve `presentCount` kaç çerçeveden geldiğini söyler;
 * eksik çerçeveleri 0 ile doldurmak, olmayan bir baytı "sabit sıfır" gibi
 * gösterirdi. Değişim oranı da yalnız ardışık MEVCUT çerçeveler arasında
 * sayılır.
 *
 * ── N = 1 ─────────────────────────────────────────────────────────────────
 * Tek çerçevede `N − 1 = 0` ve oran TANIMSIZDIR. Sıfır dönmek "hiç değişmiyor"
 * demek olurdu ki bu, tek örnekten çıkarılamayacak bir iddiadır: `changeRate`
 * `undefined` kalır ve `constant` de `false`tur.
 */

import { shannonEntropyBits } from '../statistics/entropy';
import type { AnalysisFrame } from './types';

/** Yazdırılabilir ASCII aralığı; sekme/satır sonu da metin sayılır. */
const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;
const PRINTABLE_EXTRA = new Set([0x09, 0x0a, 0x0d]);

export interface ByteColumnProfile {
  readonly offset: number;
  /** Bu ofsete sahip çerçeve sayısı. */
  readonly presentCount: number;
  /** Spec formülü; `presentCount < 2` ise `undefined`. */
  readonly changeRate: number | undefined;
  readonly distinctCount: number;
  readonly min: number;
  readonly max: number;
  readonly entropyBits: number;
  /** Tek bir değer görüldü VE en az iki örnek var. */
  readonly constant: boolean;
  /** Sabitse o değer; değilse `undefined`. */
  readonly value: number | undefined;
  /** Yazdırılabilir ASCII oranı (0…1). */
  readonly printableRatio: number;
}

function isPrintable(byte: number): boolean {
  return (byte >= PRINTABLE_MIN && byte <= PRINTABLE_MAX) || PRINTABLE_EXTRA.has(byte);
}

export function profileByteColumns(frames: readonly AnalysisFrame[]): ByteColumnProfile[] {
  let maxLength = 0;
  for (const frame of frames) maxLength = Math.max(maxLength, frame.bytes.length);

  const profiles: ByteColumnProfile[] = [];
  for (let offset = 0; offset < maxLength; offset++) {
    const values: number[] = [];
    let changes = 0;
    let previous: number | undefined;
    let printable = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const frame of frames) {
      const byte = frame.bytes[offset];
      if (byte === undefined) continue;
      values.push(byte);
      if (previous !== undefined && byte !== previous) changes += 1;
      previous = byte;
      if (isPrintable(byte)) printable += 1;
      min = Math.min(min, byte);
      max = Math.max(max, byte);
    }

    const presentCount = values.length;
    const distinct = new Set(values);
    profiles.push({
      offset,
      presentCount,
      changeRate: presentCount < 2 ? undefined : changes / (presentCount - 1),
      distinctCount: distinct.size,
      min: presentCount === 0 ? 0 : min,
      max: presentCount === 0 ? 0 : max,
      entropyBits: shannonEntropyBits(values),
      constant: presentCount >= 2 && distinct.size === 1,
      value: presentCount >= 2 && distinct.size === 1 ? values[0] : undefined,
      printableRatio: presentCount === 0 ? 0 : printable / presentCount,
    });
  }
  return profiles;
}

/** Sabit sütunların ofsetleri — "başlık nerede bitiyor" sorusunun ilk cevabı. */
export function constantOffsets(profiles: readonly ByteColumnProfile[]): number[] {
  return profiles.filter((profile) => profile.constant).map((profile) => profile.offset);
}

/** Değişen sütunlar, değişim oranına göre azalan sırada. */
export function changingOffsets(profiles: readonly ByteColumnProfile[]): number[] {
  return profiles
    .filter((profile) => !profile.constant && (profile.changeRate ?? 0) > 0)
    .sort((left, right) => (right.changeRate ?? 0) - (left.changeRate ?? 0))
    .map((profile) => profile.offset);
}
