/**
 * ASCII alanı tespiti — spec §35 "ASCII alanı tespiti". Ölçüt: yazdırılabilir
 * bayt oranı eşiğin üstünde olan ARDIŞIK sütunlar bir metin alanı oluşturur.
 *
 * Eşik neden 1.0 değil: gerçek metin alanları sonu boşluk/NUL ile doldurulmuş
 * ya da bazı çerçevelerde kısa olabilir. Tam saflık istemek bu alanları
 * bölerdi. Eşik neden bu kadar yüksek (0.9): ikili gövdede bayt değerlerinin
 * %75'i zaten yazdırılabilir aralığın DIŞINDA değildir — 0x20–0x7E aralığı
 * 256'nın 95'i, yani rastgele bir baytın yazdırılabilir olma olasılığı ~%37.
 * Düşük eşik ikili payload'u metin ilan ederdi.
 *
 * En az uzunluk 4: üç harflik bir "metin" rastgele ikili veride sık görülür.
 */

import { profileByteColumns } from './byteColumns';
import type { ByteColumnProfile } from './byteColumns';
import type { AnalysisFrame } from './types';

const DEFAULT_PRINTABLE_THRESHOLD = 0.9;
const DEFAULT_MIN_RUN_LENGTH = 4;

export interface AsciiFieldCandidate {
  readonly offset: number;
  readonly length: number;
  /** Aralıktaki en düşük yazdırılabilir oran — güvenin alt sınırı. */
  readonly minPrintableRatio: number;
}

export interface AsciiDetectOptions {
  readonly printableThreshold?: number;
  readonly minRunLength?: number;
}

/**
 * Profil ZATEN hesaplanmışsa bunu çağır: `profileByteColumns` tek geçişte
 * bütün sütunları gezer ve büyük kümelerde en pahalı adımdır, iki kez
 * koşturmanın anlamı yok.
 */
export function detectAsciiFieldsFromProfiles(
  profiles: readonly ByteColumnProfile[],
  options: AsciiDetectOptions = {},
): AsciiFieldCandidate[] {
  const threshold = options.printableThreshold ?? DEFAULT_PRINTABLE_THRESHOLD;
  const minRunLength = options.minRunLength ?? DEFAULT_MIN_RUN_LENGTH;

  const candidates: AsciiFieldCandidate[] = [];
  let runStart: number | undefined;
  let runMinRatio = 1;

  const closeRun = (endExclusive: number): void => {
    if (runStart === undefined) return;
    const length = endExclusive - runStart;
    if (length >= minRunLength) {
      candidates.push({ offset: runStart, length, minPrintableRatio: runMinRatio });
    }
    runStart = undefined;
    runMinRatio = 1;
  };

  for (const profile of profiles) {
    if (profile.presentCount > 0 && profile.printableRatio >= threshold) {
      runStart ??= profile.offset;
      runMinRatio = Math.min(runMinRatio, profile.printableRatio);
      continue;
    }
    closeRun(profile.offset);
  }
  closeRun(profiles.length);

  return candidates;
}

export function detectAsciiFields(
  frames: readonly AnalysisFrame[],
  options: AsciiDetectOptions = {},
): AsciiFieldCandidate[] {
  return detectAsciiFieldsFromProfiles(profileByteColumns(frames), options);
}
