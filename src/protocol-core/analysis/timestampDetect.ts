/**
 * Zaman damgası alanı tespiti — spec §35 "Timestamp tahmini". Spec hangi
 * kodlamaların aranacağını söylemiyor; kapsam çizgisi burada çizildi:
 *
 * · **Yalnız 32 bit Unix SANİYE.** Milisaniye epoch'u 2001'den beri 2^32'yi
 *   aşıyor, yani 4 bayta SIĞMAZ; 8 baytlık okuma ise `number`ın tam sayı
 *   kesinliğini (2^53) aşmasa da bu dosyanın `FieldWidth` kümesinde yok.
 *   Uydurulmuş bir 6 baytlık okuma eklemek yerine kapsam dışı bırakıldı.
 * · Makul aralık 2000-01-01 … 2100-01-01. Bu pencere olmadan herhangi bir
 *   4 baytlık sayı "zaman damgası" sayılırdı — 32 bitlik alanların çoğu bu
 *   testi geçerdi.
 * · Değerler AZALMAMALI. Zaman geriye gitmez; giden bir alan sayaç ya da
 *   rastgele veridir.
 * · Çerçevenin KENDİ damgası varsa (yakalama zamanı), alanla arasındaki
 *   Pearson katsayısı da raporlanır. Yüksek katsayı alanın gerçekten zaman
 *   taşıdığının en güçlü işaretidir — ama katsayı KANIT değil, o yüzden
 *   ayrı bir alan olarak verilir, adayı elemez.
 */

import { pearsonCorrelation } from '../statistics/correlation';
import { readFieldSeries } from './readField';
import type { AnalysisFrame, FieldEndianness } from './types';
import { FIELD_ENDIANNESSES } from './types';

const TIMESTAMP_WIDTH = 4;
/** 2000-01-01T00:00:00Z ve 2100-01-01T00:00:00Z, saniye cinsinden. */
const MIN_PLAUSIBLE_SECONDS = 946_684_800;
const MAX_PLAUSIBLE_SECONDS = 4_102_444_800;
const MIN_FRAMES = 2;

export interface TimestampFieldCandidate {
  readonly offset: number;
  readonly endianness: FieldEndianness;
  readonly firstValue: number;
  readonly lastValue: number;
  /** Çerçeve yakalama damgalarıyla korelasyon; damga yoksa `undefined`. */
  readonly frameTimeCorrelation: number | undefined;
}

export function detectTimestampFields(frames: readonly AnalysisFrame[]): TimestampFieldCandidate[] {
  if (frames.length < MIN_FRAMES) return [];

  const frameTimes = frames.map((frame) => frame.timestamp);
  const haveAllTimes = frameTimes.every((time): time is number => time !== undefined);

  let maxLength = 0;
  for (const frame of frames) maxLength = Math.max(maxLength, frame.bytes.length);

  const candidates: TimestampFieldCandidate[] = [];
  for (let offset = 0; offset + TIMESTAMP_WIDTH <= maxLength; offset++) {
    for (const endianness of FIELD_ENDIANNESSES) {
      const values = readFieldSeries(frames, offset, TIMESTAMP_WIDTH, endianness);
      if (values === undefined) continue;

      const plausible = values.every(
        (value) => value >= MIN_PLAUSIBLE_SECONDS && value <= MAX_PLAUSIBLE_SECONDS,
      );
      if (!plausible) continue;

      const nonDecreasing = values.every((value, index) => index === 0 || value >= (values[index - 1] ?? 0));
      if (!nonDecreasing) continue;

      candidates.push({
        offset,
        endianness,
        firstValue: values[0] ?? 0,
        lastValue: values[values.length - 1] ?? 0,
        frameTimeCorrelation: haveAllTimes ? pearsonCorrelation(frameTimes, values) : undefined,
      });
    }
  }

  return candidates.sort((left, right) => left.offset - right.offset);
}
