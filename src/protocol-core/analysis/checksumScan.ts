/**
 * Checksum/CRC ALAN tarayıcısı — spec §35'in "Checksum tahmini" ve "CRC
 * tahmini" maddeleri, dördüncü formülüyle birlikte:
 *
 *   Match Rate = Matching Frames / Total Frames × 100
 *
 * ── ALGORİTMA KATMANINA DOKUNULMAZ ────────────────────────────────────────
 * Hangi algoritmanın hangi değeri ürettiği `checksums/checksumFinder.ts`in
 * işidir ve orada 19 CRC + 9 basit toplam, normal ve ters bayt sırasıyla
 * denenir. Bu dosya onun ÇÖZMEDİĞİ soruyu çözer: checksum çerçevenin NERESİNDE
 * ve NEYİN üstünden hesaplanıyor? `checksumFinder` tek bir veri+beklenen değer
 * çifti alır; burada konum ve aralık taranır, sonuç çok çerçevede oylanır.
 *
 * ── TEK ÇERÇEVE YETMEZ ────────────────────────────────────────────────────
 * Tek çerçevede rastgele bir bayt çiftinin bir CRC'ye uyması şaşırtıcı
 * değildir: 8 bitlik bir alanda 256'da 1, üstelik 28 algoritma × birkaç konum
 * deneniyor. Ölçüt bu yüzden ORAN: aynı (algoritma, konum, aralık) üçlüsü kaç
 * çerçevede tutuyor. Gerçek checksum %100'e yakın çıkar, tesadüf çıkmaz.
 *
 * ── TARAMA UZAYI VE BÜTÇE ─────────────────────────────────────────────────
 * Uzay = konum × genişlik × veri aralığı × algoritma × çerçeve. Sınırsız
 * bırakılırsa 100 bin çerçevelik bir kümede kombinatorik patlar. Sınırlar:
 * genişlik {1,2,4}, konum "çerçeve sonundan `trailingOffset` bayt geride",
 * veri aralığı "baştan `dataStart` bayt atlayarak checksum'a kadar", örneklem
 * `sampleSize` çerçeveyle sınırlı. Örneklem BAŞTAN alınır (rastgele değil):
 * aynı girdi aynı sonucu vermeli.
 *
 * Hex dönüşümü maliyeti bilerek kabul edildi: `findChecksumMatches` hex string
 * arayüzüne sahip ve onu bayt tabanlıya çevirmek algoritma katmanına dokunmak
 * olurdu. Örneklem sınırı bu maliyeti sabitliyor.
 */

import { bytesToHex } from '../buffers/representation';
import { findChecksumMatches } from '../checksums/checksumFinder';
import type { ChecksumAlgorithmKind, ChecksumByteOrder } from '../checksums/checksumFinder';
import type { AnalysisFrame } from './types';

const DEFAULT_CHECKSUM_WIDTHS: readonly number[] = [1, 2, 4];
const DEFAULT_TRAILING_OFFSETS: readonly number[] = [0];
const DEFAULT_MAX_DATA_START = 4;
const DEFAULT_SAMPLE_SIZE = 200;
const DEFAULT_MIN_MATCH_RATE_PERCENT = 50;
const DEFAULT_PROBE_FRAMES = 8;
const MIN_DATA_BYTES = 1;
const PERCENT = 100;

export interface ChecksumScanOptions {
  /** Denenecek checksum alanı genişlikleri (bayt). */
  readonly widths?: readonly number[];
  /** Alanın çerçeve sonundan geriye kaç bayt olduğu; 0 = son bayt(lar). */
  readonly trailingOffsets?: readonly number[];
  /** Veri aralığının başlayabileceği en büyük ofset (atlanan başlık baytı). */
  readonly maxDataStart?: number;
  /** Denenecek azami çerçeve sayısı; baştan alınır. */
  readonly sampleSize?: number;
  /** Bu oranın altındaki adaylar raporlanmaz. */
  readonly minMatchRatePercent?: number;
  /**
   * Erken çıkış sondası: bir kombinasyon ilk bu kadar çerçevede eşiği tutturan
   * TEK bir aday bile üretmiyorsa kalan örneklem denenmez. Gerçek bir checksum
   * her çerçevede tutar; sondayı geçemeyen kombinasyon zaten eşiğin altında
   * bitecekti. 0 verilirse sonda kapanır.
   */
  readonly probeFrames?: number;
  /**
   * İptal kancası. Her kombinasyonun başında ve sonda sınırında sorulur;
   * `true` dönerse tarama O ANA KADAR toplanan adaylarla döner (hata atmaz —
   * Worker iptali kısmi sonucu göstermek isteyebilir).
   */
  readonly shouldCancel?: () => boolean;
  /** İlerleme kancası: biten kombinasyon / toplam kombinasyon. */
  readonly onProgress?: (completed: number, total: number) => void;
}

export interface ChecksumScanCandidate {
  readonly algorithmId: string;
  readonly kind: ChecksumAlgorithmKind;
  readonly byteOrder: ChecksumByteOrder;
  readonly checksumWidth: number;
  readonly trailingOffset: number;
  readonly dataStart: number;
  readonly matchedFrames: number;
  readonly testedFrames: number;
  readonly matchRatePercent: number;
}

interface Tally {
  readonly algorithmId: string;
  readonly kind: ChecksumAlgorithmKind;
  readonly byteOrder: ChecksumByteOrder;
  matched: number;
}

export function scanChecksumFields(
  frames: readonly AnalysisFrame[],
  options: ChecksumScanOptions = {},
): ChecksumScanCandidate[] {
  const widths = options.widths ?? DEFAULT_CHECKSUM_WIDTHS;
  const trailingOffsets = options.trailingOffsets ?? DEFAULT_TRAILING_OFFSETS;
  const maxDataStart = options.maxDataStart ?? DEFAULT_MAX_DATA_START;
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const minMatchRate = options.minMatchRatePercent ?? DEFAULT_MIN_MATCH_RATE_PERCENT;
  const probeFrames = options.probeFrames ?? DEFAULT_PROBE_FRAMES;
  const { shouldCancel, onProgress } = options;
  const sample = frames.slice(0, Math.max(0, sampleSize));
  const candidates: ChecksumScanCandidate[] = [];
  if (sample.length === 0) return candidates;

  const totalCombinations = widths.length * trailingOffsets.length * (maxDataStart + 1);
  let completed = 0;

  for (const width of widths) {
    for (const trailingOffset of trailingOffsets) {
      for (let dataStart = 0; dataStart <= maxDataStart; dataStart++) {
        if (shouldCancel?.() === true) return sortCandidates(candidates);

        const tallies = new Map<string, Tally>();
        let tested = 0;

        for (const frame of sample) {
          const checksumEnd = frame.bytes.length - trailingOffset;
          const checksumStart = checksumEnd - width;
          if (checksumStart - dataStart < MIN_DATA_BYTES) continue;

          tested += 1;
          const data = frame.bytes.subarray(dataStart, checksumStart);
          const expected = frame.bytes.subarray(checksumStart, checksumEnd);
          const matches = findChecksumMatches({
            dataHex: bytesToHex(data),
            expectedHex: bytesToHex(expected),
          });

          // Aynı algoritma bir çerçevede iki kez sayılmasın diye tekilleştirilir.
          const seen = new Set<string>();
          for (const match of matches) {
            const key = `${match.id}:${match.matchedByteOrder}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const tally = tallies.get(key);
            if (tally === undefined) {
              tallies.set(key, {
                algorithmId: match.id,
                kind: match.kind,
                byteOrder: match.matchedByteOrder,
                matched: 1,
              });
              continue;
            }
            tally.matched += 1;
          }

          // Sonda sınırı: eşiği tutturan aday yoksa bu kombinasyon bırakılır.
          if (probeFrames > 0 && tested === probeFrames && !reachesThreshold(tallies, tested, minMatchRate)) {
            break;
          }
          if (shouldCancel?.() === true) return sortCandidates(candidates);
        }

        completed += 1;
        onProgress?.(completed, totalCombinations);
        if (tested === 0) continue;
        for (const tally of tallies.values()) {
          const rate = (tally.matched / tested) * PERCENT;
          if (rate < minMatchRate) continue;
          candidates.push({
            algorithmId: tally.algorithmId,
            kind: tally.kind,
            byteOrder: tally.byteOrder,
            checksumWidth: width,
            trailingOffset,
            dataStart,
            matchedFrames: tally.matched,
            testedFrames: tested,
            matchRatePercent: rate,
          });
        }
      }
    }
  }

  return sortCandidates(candidates);
}

/** Sonda kararı: bu kadar çerçevede eşiği tutturan en az bir aday var mı? */
function reachesThreshold(tallies: ReadonlyMap<string, Tally>, tested: number, minRate: number): boolean {
  for (const tally of tallies.values()) {
    if ((tally.matched / tested) * PERCENT >= minRate) return true;
  }
  return false;
}

/**
 * Yüksek oran önce; eşitlikte daha çok veriyi kapsayan (küçük `dataStart`)
 * yorum önce gelir — protokoller checksum'u genellikle çerçevenin tamamından
 * hesaplar, başlığı atlayan yorum daha özel bir iddiadır.
 */
function sortCandidates(candidates: ChecksumScanCandidate[]): ChecksumScanCandidate[] {
  return candidates.sort(
    (left, right) =>
      right.matchRatePercent - left.matchRatePercent ||
      left.dataStart - right.dataStart ||
      left.checksumWidth - right.checksumWidth ||
      left.algorithmId.localeCompare(right.algorithmId),
  );
}
