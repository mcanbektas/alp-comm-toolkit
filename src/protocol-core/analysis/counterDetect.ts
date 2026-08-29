/**
 * Sayaç alanı tespiti — spec §35 "Sayaç tespiti", üçüncü formül:
 *
 *   Delta_t = Value_t − Value_(t−1)
 *
 * Spec sayacın GENİŞLİĞİNİ, bayt sırasını ve sarma davranışını söylemez;
 * aşağıdaki kapsam çizgisi bu dosyanın kararıdır:
 *
 * · Genişlik 1, 2 ve 4 bayt; her bayt ofsetinde (hizalama varsayılmaz — telde
 *   hizalanmamış alanlar sıradandır).
 * · Bayt sırası büyük ve küçük uçlu; tek baytta ikisi aynı olduğu için yalnız
 *   bir kez raporlanır.
 * · **Fark mod 2^(8×genişlik) alınır.** Sarma olmadan 8 bitlik bir sayaç
 *   255→0 geçişinde −255 fark verir ve "sabit adım" testi kırılırdı; oysa
 *   telde olan şey +1'dir. Sarma hesaba katılmazsa her tur başında sayaç
 *   kaybedilir.
 * · **En az 3 çerçeve gerekir.** İki çerçevede TEK fark vardır ve tek fark her
 *   zaman "sabit"tir — iki noktadan geçen doğru gibi. Bu eşik olmadan gürültülü
 *   her alan sayaç sanılırdı.
 * · Adım SIFIR olamaz: sabit bir alan sayaç değildir (`byteColumns` onu zaten
 *   sabit diye raporlar).
 * · Yalnız SABİT adım aranır. "Artıyor ama adımı değişiyor" ölçütü üç örnekte
 *   checksum'ları da yakalar (spec'in kendi RF setinde 5-6. baytlar öyle);
 *   gevşetmek gerekiyorsa `allowVariableStep` açıkça istenir.
 */

import { readFieldSeries } from './readField';
import type { AnalysisFrame, FieldEndianness, FieldWidth } from './types';
import { FIELD_ENDIANNESSES, FIELD_WIDTHS, normalizeEndianness } from './types';

const MIN_FRAMES_FOR_COUNTER = 3;
const BITS_PER_BYTE = 8;

export interface CounterCandidate {
  readonly offset: number;
  readonly width: FieldWidth;
  readonly endianness: FieldEndianness;
  /** Sabit adım; `allowVariableStep` ile bulunmuş adayda `undefined`. */
  readonly step: number | undefined;
  /** Sarma (taşma) sayısı — kaç kez üst sınırdan başa dönüldü. */
  readonly wrapCount: number;
  readonly firstValue: number;
  readonly lastValue: number;
}

export interface CounterDetectOptions {
  /** Sabit olmayan ama hep ileri giden alanları da aday sayar. Varsayılan kapalı. */
  readonly allowVariableStep?: boolean;
  readonly widths?: readonly FieldWidth[];
}

function modulusFor(width: FieldWidth): number {
  return 2 ** (BITS_PER_BYTE * width);
}

export function detectCounters(
  frames: readonly AnalysisFrame[],
  options: CounterDetectOptions = {},
): CounterCandidate[] {
  if (frames.length < MIN_FRAMES_FOR_COUNTER) return [];
  const widths = options.widths ?? FIELD_WIDTHS;
  const allowVariableStep = options.allowVariableStep ?? false;

  let maxLength = 0;
  for (const frame of frames) maxLength = Math.max(maxLength, frame.bytes.length);

  const candidates: CounterCandidate[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < maxLength; offset++) {
    for (const width of widths) {
      for (const endianness of FIELD_ENDIANNESSES) {
        const normalized = normalizeEndianness(width, endianness);
        const key = `${offset}:${width}:${normalized}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const values = readFieldSeries(frames, offset, width, normalized);
        if (values === undefined) continue;

        const modulus = modulusFor(width);
        const deltas: number[] = [];
        let wrapCount = 0;
        for (let i = 1; i < values.length; i++) {
          const raw = (values[i] ?? 0) - (values[i - 1] ?? 0);
          const delta = ((raw % modulus) + modulus) % modulus;
          if (raw < 0) wrapCount += 1;
          deltas.push(delta);
        }

        const first = deltas[0] ?? 0;
        if (first === 0) continue;
        const constantStep = deltas.every((delta) => delta === first);
        if (!constantStep && !allowVariableStep) continue;
        if (!constantStep && !deltas.every((delta) => delta > 0 && delta < modulus / 2)) continue;

        candidates.push({
          offset,
          width,
          endianness: normalized,
          step: constantStep ? first : undefined,
          wrapCount,
          firstValue: values[0] ?? 0,
          lastValue: values[values.length - 1] ?? 0,
        });
      }
    }
  }

  // Dar alan önce: 1 baytlık bir sayaç, onu içeren 2 baytlık okumadan daha
  // olası bir yorumdur ve kullanıcı listenin başında onu görmeli.
  return candidates.sort((left, right) => left.offset - right.offset || left.width - right.width);
}
