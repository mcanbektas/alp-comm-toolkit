/**
 * Çerçeve kümesinin Worker'a AKTARILABİLİR gösterimi.
 *
 * `AnalysisFrame[]` doğrudan `postMessage`e verilirse her çerçevenin
 * `Uint8Array`i ayrı ayrı KOPYALANIR (yapısal klonlama); 100 bin çerçevede bu
 * yüz bin küçük tahsis demektir. Paketlenmiş biçim üç tampon taşır ve üçü de
 * transfer listesiyle gönderilebilir — kopya yok, sahiplik el değiştirir.
 *
 * `subarray` DEĞİL `slice`: `subarray` altındaki tamponu paylaşır, transfer
 * edilen bir tampondan pay alan görünüm ana iş parçacığında ölür
 * (`connection/mock/simulatedProtocol.ts:191` aynı tuzağı not eder). Paketleme
 * zaten tek bir bitişik tampon kurduğu için çözme tarafında `slice` gerekiyor.
 *
 * Damgası olmayan çerçeve `NaN` ile yazılır: 0 gerçek bir zaman damgasıdır
 * (epoch başı ya da göreli sıfır), "yok" anlamına gelemez.
 */

import type { AnalysisFrame } from './types';

export interface PackedFrames {
  /** Bütün çerçeveler ardışık. */
  readonly data: Uint8Array;
  /** `count + 1` uzunlukta; çerçeve i = `data[offsets[i] .. offsets[i + 1])`. */
  readonly offsets: Uint32Array;
  /** Çerçeve başına damga; damgası olmayan `NaN`. */
  readonly timestamps: Float64Array;
}

export function packFrames(frames: readonly AnalysisFrame[]): PackedFrames {
  let total = 0;
  for (const frame of frames) total += frame.bytes.length;

  const data = new Uint8Array(total);
  const offsets = new Uint32Array(frames.length + 1);
  const timestamps = new Float64Array(frames.length);

  let cursor = 0;
  frames.forEach((frame, index) => {
    offsets[index] = cursor;
    data.set(frame.bytes, cursor);
    cursor += frame.bytes.length;
    timestamps[index] = frame.timestamp ?? Number.NaN;
  });
  offsets[frames.length] = cursor;

  return { data, offsets, timestamps };
}

export function unpackFrames(packed: PackedFrames): AnalysisFrame[] {
  const count = Math.max(0, packed.offsets.length - 1);
  const frames: AnalysisFrame[] = [];

  for (let index = 0; index < count; index++) {
    const start = packed.offsets[index] ?? 0;
    const end = packed.offsets[index + 1] ?? start;
    const timestamp = packed.timestamps[index];
    frames.push({
      bytes: packed.data.slice(start, end),
      timestamp: timestamp === undefined || Number.isNaN(timestamp) ? undefined : timestamp,
    });
  }

  return frames;
}

/** `postMessage`in transfer listesi: paketin üç tamponu. */
export function transferListOf(packed: PackedFrames): ArrayBuffer[] {
  return [packed.data.buffer as ArrayBuffer, packed.offsets.buffer as ArrayBuffer, packed.timestamps.buffer as ArrayBuffer];
}
