/**
 * Message Difference Analyzer — spec §36 (39320-39355).
 *
 * Spec iki (ya da daha fazla) mesajı karşılaştırıp şunları göstermeyi ister:
 * değişen byte, değişen bit, XOR farkı, decimal fark, signed fark, sabit alan,
 * muhtemel sayaç, muhtemel CRC, muhtemel payload, korelasyon. Bu dosya ilk
 * dokuzunu üretir; korelasyon `fieldCorrelation.ts`te.
 *
 * ── İKİ MESAJ FARK GÖSTERİR, ROL GÖSTERMEZ ────────────────────────────────
 * Fark satırı (bayt bayt XOR/decimal/signed) İKİ mesajdan çıkar. "Muhtemel
 * sayaç / CRC / payload" ETİKETİ ise iki mesajdan ÇIKMAZ: iki örnekte tek fark
 * vardır ve tek fark her zaman "sabit adım"a benzer (`counterDetect` bu yüzden
 * en az üç çerçeve ister). Bu yüzden `analyzeMessageDifference` iki mesajı
 * KÜMENİN içinden seçer: fark çiftten, roller kümeden gelir. Küme iki çerçeveden
 * ibaretse sayaç etiketi bilinçli olarak çıkmaz.
 *
 * ── ROL SIRASI (spec vermiyor, karar burada) ──────────────────────────────
 * 1. `checksum-candidate` (doğrulanmış): `scanChecksumFields` bir algoritma ve
 *    konum için yüksek Match Rate bulduysa. Kanıtı olan iddia önce gelir.
 * 2. `constant`: sütun tek değer aldıysa. Sabit bir bayt sayaç da checksum da
 *    değildir; çok baytlı bir sayaç okuması sabit üst baytı kapsayabilir
 *    (`AA 10 00 01` → 4 baytlık "sayaç"), o yüzden sabitlik sayaçtan önde.
 * 3. `counter-candidate`: `counterDetect` adayının kapsadığı baytlar.
 * 4. `checksum-candidate` (sezgisel): çerçevenin SON `tailBytes` baytı içinde,
 *    değişken ve sayaç değilse. Spec'in kendi RF örneği bunu bekler
 *    (35060: "Bytes 5–6: Possible checksum/CRC") — orada hiçbir CRC algoritması
 *    tutmaz, etiket konumdan gelir. Bu yüzden `reason` alanı hangi gerekçeyle
 *    etiketlendiğini AÇIKÇA söyler; doğrulanmış ile sezgisel karıştırılmaz.
 * 5. `payload`: kalan her şey.
 */

import { profileByteColumns } from './byteColumns';
import { detectCounters } from './counterDetect';
import { scanChecksumFields } from './checksumScan';
import type { ChecksumScanOptions } from './checksumScan';
import type { AnalysisFrame } from './types';

const BITS_PER_BYTE = 8;
const BYTE_SIGN_LIMIT = 0x80;
const BYTE_MODULUS = 0x100;
const DEFAULT_TAIL_BYTES = 2;
const DEFAULT_VERIFIED_MIN_MATCH_RATE = 90;

export interface ByteDiff {
  readonly offset: number;
  /** Çerçeve o ofsete sahip değilse `undefined` (değişken uzunluk). */
  readonly left: number | undefined;
  readonly right: number | undefined;
  readonly changed: boolean;
  readonly xor: number | undefined;
  /** İşaretsiz yorum: right − left. */
  readonly decimalDifference: number | undefined;
  /** İki baytı da int8 sayan yorum: right − left. */
  readonly signedDifference: number | undefined;
  /** Değişen bitlerin indeksleri; 0 = en düşük değerlikli bit. */
  readonly changedBits: readonly number[];
}

export type FieldRole = 'constant' | 'counter-candidate' | 'checksum-candidate' | 'payload';

export interface FieldRoleAssignment {
  readonly offset: number;
  readonly role: FieldRole;
  /** Etiketin gerekçesi; doğrulanmış ile sezgisel burada ayrılır. */
  readonly reason: string;
}

export interface FieldRoleOptions {
  /** Sezgisel checksum bölgesi: çerçeve sonundan kaç bayt. */
  readonly tailBytes?: number;
  /** Doğrulanmış sayılmak için gereken en küçük Match Rate. */
  readonly verifiedMinMatchRatePercent?: number;
  readonly checksumScan?: ChecksumScanOptions;
}

export interface MessageDifference {
  readonly leftIndex: number;
  readonly rightIndex: number;
  readonly diffs: readonly ByteDiff[];
  readonly roles: readonly FieldRoleAssignment[];
  readonly changedOffsets: readonly number[];
  readonly changedBitCount: number;
}

/** Spec §36'nın bayt bayt fark tablosu. Uzunluklar farklıysa uzun olan esas alınır. */
export function diffFrames(left: AnalysisFrame, right: AnalysisFrame): ByteDiff[] {
  const length = Math.max(left.bytes.length, right.bytes.length);
  const diffs: ByteDiff[] = [];

  for (let offset = 0; offset < length; offset++) {
    const leftValue = offset < left.bytes.length ? left.bytes[offset] : undefined;
    const rightValue = offset < right.bytes.length ? right.bytes[offset] : undefined;

    if (leftValue === undefined || rightValue === undefined) {
      diffs.push({
        offset,
        left: leftValue,
        right: rightValue,
        // Bir tarafta bayt YOKSA bu bir "değişim"dir ama farkı hesaplanamaz:
        // olmayan baytı 0 saymak uydurma bir fark üretirdi.
        changed: true,
        xor: undefined,
        decimalDifference: undefined,
        signedDifference: undefined,
        changedBits: [],
      });
      continue;
    }

    const xor = leftValue ^ rightValue;
    const changedBits: number[] = [];
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
      if ((xor & (1 << bit)) !== 0) changedBits.push(bit);
    }

    diffs.push({
      offset,
      left: leftValue,
      right: rightValue,
      changed: xor !== 0,
      xor,
      decimalDifference: rightValue - leftValue,
      signedDifference: toSigned(rightValue) - toSigned(leftValue),
      changedBits,
    });
  }

  return diffs;
}

/** Küme genelinden bayt rollerini çıkarır (spec §36'nın etiket maddeleri). */
export function assignFieldRoles(
  frames: readonly AnalysisFrame[],
  options: FieldRoleOptions = {},
): FieldRoleAssignment[] {
  if (frames.length === 0) return [];
  const tailBytes = options.tailBytes ?? DEFAULT_TAIL_BYTES;
  const verifiedMinRate = options.verifiedMinMatchRatePercent ?? DEFAULT_VERIFIED_MIN_MATCH_RATE;

  const profiles = profileByteColumns(frames);
  const counters = detectCounters(frames);
  const counterReason = new Map<number, string>();
  for (const counter of counters) {
    for (let index = 0; index < counter.width; index++) {
      const offset = counter.offset + index;
      if (counterReason.has(offset)) continue;
      counterReason.set(
        offset,
        `sayaç adayı: ofset ${counter.offset}, ${counter.width} bayt ${counter.endianness}, adım ${counter.step ?? '?'}`,
      );
    }
  }

  const verifiedChecksum = new Map<number, string>();
  const scanned = scanChecksumFields(frames, options.checksumScan);
  for (const candidate of scanned) {
    if (candidate.matchRatePercent < verifiedMinRate) continue;
    for (const frame of frames) {
      const end = frame.bytes.length - candidate.trailingOffset;
      for (let offset = end - candidate.checksumWidth; offset < end; offset++) {
        if (offset < 0 || verifiedChecksum.has(offset)) continue;
        verifiedChecksum.set(
          offset,
          `doğrulanmış: ${candidate.algorithmId} (${candidate.matchRatePercent.toFixed(0)}% eşleşme)`,
        );
      }
    }
  }

  let minLength = Number.POSITIVE_INFINITY;
  for (const frame of frames) minLength = Math.min(minLength, frame.bytes.length);
  const tailStart = Number.isFinite(minLength) ? minLength - tailBytes : 0;

  return profiles.map((profile) => {
    const verified = verifiedChecksum.get(profile.offset);
    if (verified !== undefined) {
      return { offset: profile.offset, role: 'checksum-candidate' as const, reason: verified };
    }
    if (profile.constant) {
      return {
        offset: profile.offset,
        role: 'constant' as const,
        reason: `sabit: 0x${(profile.value ?? 0).toString(16).padStart(2, '0').toUpperCase()}`,
      };
    }
    const counter = counterReason.get(profile.offset);
    if (counter !== undefined) {
      return { offset: profile.offset, role: 'counter-candidate' as const, reason: counter };
    }
    if (profile.offset >= tailStart) {
      return {
        offset: profile.offset,
        role: 'checksum-candidate' as const,
        reason: 'sezgisel: çerçeve sonunda, değişken ve sayaç değil',
      };
    }
    return {
      offset: profile.offset,
      role: 'payload' as const,
      reason: `değişken alan (değişim oranı ${(profile.changeRate ?? 0).toFixed(2)})`,
    };
  });
}

/**
 * Kümeden seçilen iki mesajın farkını, kümeden çıkan rollerle birlikte verir.
 * Spec §36'nın örnek çıktısı bu ikisinin birleşimidir.
 */
export function analyzeMessageDifference(
  frames: readonly AnalysisFrame[],
  leftIndex: number,
  rightIndex: number,
  options: FieldRoleOptions = {},
): MessageDifference | undefined {
  const left = frames[leftIndex];
  const right = frames[rightIndex];
  if (left === undefined || right === undefined) return undefined;

  const diffs = diffFrames(left, right);
  const roles = assignFieldRoles(frames, options);
  const changedOffsets = diffs.filter((diff) => diff.changed).map((diff) => diff.offset);
  const changedBitCount = diffs.reduce((total, diff) => total + diff.changedBits.length, 0);

  return { leftIndex, rightIndex, diffs, roles, changedOffsets, changedBitCount };
}

function toSigned(value: number): number {
  return value >= BYTE_SIGN_LIMIT ? value - BYTE_MODULUS : value;
}
