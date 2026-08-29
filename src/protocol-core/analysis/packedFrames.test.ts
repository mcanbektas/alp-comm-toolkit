import { describe, expect, it } from 'vitest';

import { packFrames, transferListOf, unpackFrames } from './packedFrames';
import type { AnalysisFrame } from './types';

const FRAMES: readonly AnalysisFrame[] = [
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10]), timestamp: 1000 },
  { bytes: new Uint8Array([0x01]), timestamp: undefined },
  { bytes: new Uint8Array([0x02, 0x03]), timestamp: 0 },
];

describe('packFrames / unpackFrames', () => {
  it('çerçeveleri kayıpsız geri verir', () => {
    const restored = unpackFrames(packFrames(FRAMES));
    expect(restored).toHaveLength(3);
    expect(Array.from(restored[0]?.bytes ?? [])).toEqual([0xaa, 0xaa, 0x10]);
    expect(Array.from(restored[2]?.bytes ?? [])).toEqual([0x02, 0x03]);
  });

  it('damgası olmayan çerçeveyi 0 saymaz', () => {
    const restored = unpackFrames(packFrames(FRAMES));
    expect(restored[1]?.timestamp).toBeUndefined();
    // 0 gerçek bir damgadır ve korunur.
    expect(restored[2]?.timestamp).toBe(0);
  });

  it('çözülen çerçeveler paketin tamponunu PAYLAŞMAZ', () => {
    const packed = packFrames(FRAMES);
    const restored = unpackFrames(packed);
    packed.data[0] = 0x00;
    // `subarray` olsaydı bu yazma çözülmüş çerçeveyi de değiştirirdi.
    expect(restored[0]?.bytes[0]).toBe(0xaa);
  });

  it('boş kümede boş paket verir', () => {
    const packed = packFrames([]);
    expect(packed.data).toHaveLength(0);
    expect(unpackFrames(packed)).toEqual([]);
  });

  it('transfer listesi üç tamponu taşır', () => {
    const packed = packFrames(FRAMES);
    expect(transferListOf(packed)).toHaveLength(3);
  });
});
