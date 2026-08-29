import { describe, expect, it } from 'vitest';

import { analyzeMessageDifference, assignFieldRoles, diffFrames } from './messageDiff';
import type { AnalysisFrame } from './types';

/** Fixture: spec §36'nın kendi çifti (39339-39353) ve RF seti (35060). */
function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

const PACKET_A = frame([0xaa, 0x01, 0x10, 0x04, 0x25, 0x01, 0x00, 0x00, 0x7c, 0x55]);
const PACKET_B = frame([0xaa, 0x01, 0x10, 0x04, 0x2a, 0x01, 0x00, 0x00, 0x91, 0x55]);

const RF_FRAMES: readonly AnalysisFrame[] = [
  frame([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]),
];

describe('diffFrames', () => {
  it('spec örneğinin değişen baytlarını verir', () => {
    const diffs = diffFrames(PACKET_A, PACKET_B);
    expect(diffs.filter((diff) => diff.changed).map((diff) => diff.offset)).toEqual([4, 8]);
  });

  it('spec çıktısındaki farkı üretir: Byte 4 → +5', () => {
    const byte4 = diffFrames(PACKET_A, PACKET_B)[4];
    expect(byte4?.left).toBe(0x25);
    expect(byte4?.right).toBe(0x2a);
    expect(byte4?.decimalDifference).toBe(5);
    expect(byte4?.xor).toBe(0x0f);
    expect(byte4?.changedBits).toEqual([0, 1, 2, 3]);
  });

  it('signed fark işaretli yorumdan gelir', () => {
    const byte8 = diffFrames(PACKET_A, PACKET_B)[8];
    // 0x7C = +124, 0x91 = −111 (int8): işaretsiz fark +21, işaretli fark −235.
    expect(byte8?.decimalDifference).toBe(21);
    expect(byte8?.signedDifference).toBe(-235);
  });

  it('değişmeyen baytta fark sıfırdır', () => {
    const byte0 = diffFrames(PACKET_A, PACKET_B)[0];
    expect(byte0?.changed).toBe(false);
    expect(byte0?.xor).toBe(0);
    expect(byte0?.changedBits).toEqual([]);
  });

  it('farklı uzunlukta eksik baytı fark hesaplamadan bildirir', () => {
    const diffs = diffFrames(frame([0x01, 0x02]), frame([0x01]));
    expect(diffs).toHaveLength(2);
    expect(diffs[1]?.changed).toBe(true);
    expect(diffs[1]?.right).toBeUndefined();
    expect(diffs[1]?.decimalDifference).toBeUndefined();
    expect(diffs[1]?.xor).toBeUndefined();
  });
});

describe('assignFieldRoles', () => {
  it('spec RF setinin beklediği rolleri verir', () => {
    const roles = assignFieldRoles(RF_FRAMES);
    // Spec 35060: "Bytes 0–1 Constant, Byte 4 Monotonic counter candidate,
    // Bytes 5–6 Possible checksum/CRC".
    expect(roles[0]?.role).toBe('constant');
    expect(roles[1]?.role).toBe('constant');
    expect(roles[4]?.role).toBe('counter-candidate');
    expect(roles[5]?.role).toBe('checksum-candidate');
    expect(roles[6]?.role).toBe('checksum-candidate');
  });

  it('sayaç etiketinin gerekçesi adımı söyler', () => {
    expect(assignFieldRoles(RF_FRAMES)[4]?.reason).toContain('adım 1');
  });

  it('sezgisel checksum etiketini doğrulanmıştan ayırır', () => {
    expect(assignFieldRoles(RF_FRAMES)[5]?.reason).toContain('sezgisel');
  });

  it('iki çerçevede sayaç etiketi ÇIKMAZ', () => {
    // İki örnekte tek fark vardır ve tek fark her zaman "sabit adım"dır.
    const roles = assignFieldRoles([PACKET_A, PACKET_B]);
    expect(roles.some((role) => role.role === 'counter-candidate')).toBe(false);
    expect(roles[4]?.role).toBe('payload');
    expect(roles[8]?.role).toBe('checksum-candidate');
    expect(roles[9]?.role).toBe('constant');
  });

  it('boş kümede boş döner', () => {
    expect(assignFieldRoles([])).toEqual([]);
  });
});

describe('analyzeMessageDifference', () => {
  it('farkı çiftten, rolleri kümeden alır', () => {
    const result = analyzeMessageDifference(RF_FRAMES, 0, 1);
    expect(result?.changedOffsets).toEqual([4, 5, 6]);
    expect(result?.roles[4]?.role).toBe('counter-candidate');
    expect(result?.changedBitCount).toBeGreaterThan(0);
  });

  it('küme dışı indekste undefined döner', () => {
    expect(analyzeMessageDifference(RF_FRAMES, 0, 9)).toBeUndefined();
  });
});
