import { describe, expect, it } from 'vitest';

import { analyzePeriod } from './periodAnalysis';
import type { AnalysisFrame } from './types';

function at(timestamp: number | undefined): AnalysisFrame {
  return { bytes: new Uint8Array([0xaa]), timestamp };
}

describe('analyzePeriod', () => {
  it('düzenli aralıklı çerçeveleri periyodik sayar', () => {
    const analysis = analyzePeriod([at(0), at(100), at(200), at(300)]);
    expect(analysis.interval.average).toBe(100);
    expect(analysis.coefficientOfVariation).toBe(0);
    expect(analysis.periodic).toBe(true);
  });

  it('düzensiz aralıkta periyodik saymaz', () => {
    const analysis = analyzePeriod([at(0), at(10), at(500), at(520)]);
    expect(analysis.periodic).toBe(false);
  });

  it('ölçütü mutlak sapmayla değil oranla uygular', () => {
    // 10 s periyotta 100 ms sapma düzenlidir; 10 ms periyotta olsaydı değildi.
    const analysis = analyzePeriod([at(0), at(10_000), at(20_100), at(30_000)]);
    expect(analysis.periodic).toBe(true);
  });

  it('damgasız kümede karar vermez', () => {
    const analysis = analyzePeriod([at(undefined), at(undefined)]);
    expect(analysis.periodic).toBeUndefined();
    expect(analysis.timedFrameCount).toBe(0);
  });

  it('tek aralıkta karar vermez', () => {
    expect(analyzePeriod([at(0), at(100)]).periodic).toBeUndefined();
  });
});
