import { describe, expect, it } from 'vitest';

import { correlateFields, correlateFieldsWithSeries } from './fieldCorrelation';
import type { AnalysisFrame } from './types';

/**
 * Fixture kuralı: spec 16283'ün gyro örneği iki ölçüm veriyor (heading 90° →
 * `23 28`, 100° → `27 10`), korelasyon ise en az üç örnek ister. Üçüncü ölçüm
 * spec'in KENDİ kuralıyla üretiliyor: alan = heading × 100, 2 bayt büyük uçlu.
 * Kural burada görünür olsun diye çerçeveyi bir fonksiyon kuruyor; ilk iki
 * çerçevenin spec baytlarını verdiği ayrı bir testle doğrulanıyor.
 */
function gyroFrame(headingDegrees: number): AnalysisFrame {
  const raw = Math.round(headingDegrees * 100);
  return {
    bytes: new Uint8Array([0xaa, 0x01, (raw >> 8) & 0xff, raw & 0xff, 0x00]),
    timestamp: undefined,
  };
}

const HEADINGS = [90, 100, 110];
const GYRO_FRAMES = HEADINGS.map(gyroFrame);

function frame(bytes: readonly number[]): AnalysisFrame {
  return { bytes: new Uint8Array(bytes), timestamp: undefined };
}

describe('correlateFieldsWithSeries', () => {
  it('spec baytlarını üretir (fixture doğrulaması)', () => {
    expect(Array.from(GYRO_FRAMES[0]?.bytes.slice(2, 4) ?? [])).toEqual([0x23, 0x28]);
    expect(Array.from(GYRO_FRAMES[1]?.bytes.slice(2, 4) ?? [])).toEqual([0x27, 0x10]);
  });

  it('bilinen heading serisiyle örtüşen 2 baytlık büyük uçlu alanı bulur', () => {
    const best = correlateFieldsWithSeries(GYRO_FRAMES, HEADINGS)[0];
    expect(best?.offset).toBe(2);
    expect(best?.width).toBe(2);
    expect(best?.endianness).toBe('big');
    expect(best?.coefficient).toBeCloseTo(1, 10);
  });

  it('ölçek ve ofset katsayıyı değiştirmez — formül alanına gerek yok', () => {
    const scaled = HEADINGS.map((heading) => heading * 100 + 7);
    expect(correlateFieldsWithSeries(GYRO_FRAMES, scaled)[0]?.coefficient).toBeCloseTo(1, 10);
  });

  it('ters yönlü ilişkiyi de raporlar', () => {
    const reversed = HEADINGS.map((heading) => -heading);
    expect(correlateFieldsWithSeries(GYRO_FRAMES, reversed)[0]?.coefficient).toBeCloseTo(-1, 10);
  });

  it('üç örnekten azında sonuç vermez', () => {
    expect(correlateFieldsWithSeries(GYRO_FRAMES.slice(0, 2), HEADINGS.slice(0, 2))).toEqual([]);
  });

  it('seri uzunluğu çerçeve sayısıyla eşleşmiyorsa hizalama uydurmaz', () => {
    expect(correlateFieldsWithSeries(GYRO_FRAMES, [90, 100])).toEqual([]);
  });

  it('sabit alan korelasyon vermez', () => {
    const results = correlateFieldsWithSeries(GYRO_FRAMES, HEADINGS);
    expect(results.some((entry) => entry.offset === 0 && entry.width === 1)).toBe(false);
  });
});

describe('correlateFields', () => {
  it('aynı kaynaktan türeyen iki sütunu eşleştirir', () => {
    const frames = [1, 2, 3, 4].map((step) => frame([step, 0x00, step * 2, 0xff]));
    const results = correlateFields(frames);
    const pair = results.find((entry) => entry.left.offset === 0 && entry.right.offset === 2);
    expect(pair?.coefficient).toBeCloseTo(1, 10);
  });

  it('üst üste binen okumaları bulgu saymaz', () => {
    const frames = [1, 2, 3, 4].map((step) => frame([0x00, step, step * 2]));
    const results = correlateFields(frames, { widths: [1, 2] });
    expect(results.every((entry) => entry.left.offset + entry.left.width <= entry.right.offset)).toBe(true);
  });

  it('çift bütçesi aşılınca tarama durur', () => {
    const frames = [1, 2, 3, 4].map((step) => frame([step, 0x11, step * 2, 0x22, step * 3]));
    expect(correlateFields(frames, { maxPairs: 0 })).toEqual([]);
  });

  it('üç örnekten azında sonuç vermez', () => {
    expect(correlateFields([frame([1, 2]), frame([2, 4])])).toEqual([]);
  });
});
