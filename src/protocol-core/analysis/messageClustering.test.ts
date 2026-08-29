import { describe, expect, it } from 'vitest';

import { clusterMessages, framesOfCluster, selectSignatureOffsets } from './messageClustering';
import type { AnalysisFrame } from './types';

/**
 * Fixture kuralı: iki küme de SPEC'İN KENDİ örneklerinden geliyor —
 * 7 baytlık RF telemetri seti (ana spec 35060) ve 10 baytlık §36 çifti
 * (39339-39353). Sentetik veri yok.
 */
function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

const RF_FRAMES: readonly AnalysisFrame[] = [
  frame([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]),
  frame([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]),
];

const DIFF_FRAMES: readonly AnalysisFrame[] = [
  frame([0xaa, 0x01, 0x10, 0x04, 0x25, 0x01, 0x00, 0x00, 0x7c, 0x55]),
  frame([0xaa, 0x01, 0x10, 0x04, 0x2a, 0x01, 0x00, 0x00, 0x91, 0x55]),
];

const MIXED: readonly AnalysisFrame[] = [...RF_FRAMES, ...DIFF_FRAMES];

describe('selectSignatureOffsets', () => {
  it('sabit ve yüksek kardinaliteli sütunları imzaya almaz', () => {
    // Bayt 0 (AA) ve bayt 2 (10) her çerçevede sabit; bayt 1 ve 3 iki değer alır.
    expect(selectSignatureOffsets(MIXED)).toEqual([1, 3]);
  });

  it('sayaç sütunu başlık bölgesinde olsa bile ayırt edici sayılmaz', () => {
    const frames = [
      frame([0x01, 0x00]),
      frame([0x02, 0x00]),
      frame([0x03, 0x00]),
      frame([0x04, 0x00]),
      frame([0x05, 0x00]),
      frame([0x06, 0x00]),
      frame([0x07, 0x00]),
      frame([0x08, 0x00]),
      frame([0x09, 0x00]),
    ];
    // 9 farklı değer > varsayılan eşik (8): mesaj tipi değil, sayaç.
    expect(selectSignatureOffsets(frames)).toEqual([]);
  });

  it('az değerli olsa bile sayaç sütununu imzaya almaz', () => {
    // 3 farklı değer eşiğin altında ama sütun bir sayaç: imzaya girerse her
    // çerçeve kendi kümesine düşerdi.
    const frames = [frame([0xaa, 0x01]), frame([0xaa, 0x02]), frame([0xaa, 0x03])];
    expect(selectSignatureOffsets(frames)).toEqual([]);
  });

  it('kullanıcı imza baytlarını verirse seçim yapmaz', () => {
    expect(selectSignatureOffsets(MIXED, { signatureOffsets: [0] })).toEqual([0]);
  });

  it('boş kümede boş döner', () => {
    expect(selectSignatureOffsets([])).toEqual([]);
  });
});

describe('clusterMessages', () => {
  it('spec setlerini iki kümeye ayırır', () => {
    const clusters = clusterMessages(MIXED);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.size).toBe(3);
    expect(clusters[0]?.frameLength).toBe(7);
    expect(clusters[0]?.frameIndices).toEqual([0, 1, 2]);
    expect(clusters[1]?.size).toBe(2);
    expect(clusters[1]?.frameLength).toBe(10);
    expect(clusters[1]?.frameIndices).toEqual([3, 4]);
  });

  it('küme anahtarı okunabilir ve deterministik', () => {
    const first = clusterMessages(MIXED)[0]?.key;
    const second = clusterMessages(MIXED)[0]?.key;
    expect(first).toBe('len=7 @1=AA @3=00');
    expect(second).toBe(first);
  });

  it('aynı uzunlukta farklı tipleri imza baytıyla ayırır', () => {
    const frames = [
      frame([0xaa, 0x01, 0x00, 0x01]),
      frame([0xaa, 0x02, 0x00, 0x02]),
      frame([0xaa, 0x01, 0x00, 0x03]),
    ];
    const clusters = clusterMessages(frames);
    expect(clusters.map((cluster) => cluster.size)).toEqual([2, 1]);
    expect(clusters[0]?.frameIndices).toEqual([0, 2]);
  });

  it('uzunluk imzadan çıkarılabilir', () => {
    const clusters = clusterMessages(MIXED, { includeLength: false });
    expect(clusters[0]?.frameLength).toBeUndefined();
    expect(clusters[0]?.key).toBe('@1=AA @3=00');
  });

  it('ayırt edici bayt yoksa tek küme verir', () => {
    const frames = [frame([0xaa, 0xbb]), frame([0xaa, 0xbb]), frame([0xaa, 0xbb])];
    const clusters = clusterMessages(frames, { includeLength: false });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.key).toBe('all');
  });

  it('kısa çerçevede eksik imza baytı ayrı kümedir', () => {
    const clusters = clusterMessages([...MIXED, frame([0xaa])], { signatureOffsets: [1] });
    const shortCluster = clusters.find((cluster) => cluster.key.includes('@1=-'));
    expect(shortCluster?.size).toBe(1);
  });

  it('framesOfCluster küme çerçevelerini sırayla verir', () => {
    const cluster = clusterMessages(MIXED)[1];
    expect(cluster).toBeDefined();
    const frames = framesOfCluster(MIXED, cluster as NonNullable<typeof cluster>);
    expect(frames).toHaveLength(2);
    expect(Array.from(frames[0]?.bytes.slice(0, 2) ?? [])).toEqual([0xaa, 0x01]);
  });

  it('boş kümede boş döner', () => {
    expect(clusterMessages([])).toEqual([]);
  });
});
