import { describe, expect, it } from 'vitest';

import { ANALYSIS_PHASES, analyzeFrames, createAnalysisRunner } from './report';
import type { AnalysisFrame } from './types';

/** Fixture: spec 35060 RF telemetri seti. */
const RF_FRAMES: readonly AnalysisFrame[] = [
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x01, 0x53, 0x21]), timestamp: 1000 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x02, 0x61, 0x38]), timestamp: 1100 },
  { bytes: new Uint8Array([0xaa, 0xaa, 0x10, 0x00, 0x03, 0x14, 0xb7]), timestamp: 1200 },
];

describe('analyzeFrames', () => {
  it('spec setinin bütün adımlarını tamamlar', () => {
    const report = analyzeFrames(RF_FRAMES);
    expect(report.completedPhases).toEqual([...ANALYSIS_PHASES]);
    expect(report.frameCount).toBe(3);
    expect(report.lengthRange).toEqual({ min: 7, max: 7 });
  });

  it('spec çıktısındaki alanları raporlar', () => {
    const report = analyzeFrames(RF_FRAMES);
    expect(report.columns).toHaveLength(7);
    expect(report.counters.some((counter) => counter.offset === 4 && counter.width === 1)).toBe(true);
    expect(report.roles[4]?.role).toBe('counter-candidate');
    expect(report.period?.periodic).toBe(true);
    expect(report.clusters).toHaveLength(1);
  });

  it('bilinen değer serisi verilmezse korelasyon boş kalır ama adım tamamlanır', () => {
    const report = analyzeFrames(RF_FRAMES);
    expect(report.seriesCorrelations).toEqual([]);
    expect(report.completedPhases).toContain('correlation');
  });

  it('bilinen değer serisiyle korelasyon üretir', () => {
    const report = analyzeFrames(RF_FRAMES, { knownValues: [1, 2, 3] });
    expect(report.seriesCorrelations[0]?.offset).toBe(4);
  });

  it('boş kümede çökmez', () => {
    const report = analyzeFrames([]);
    expect(report.frameCount).toBe(0);
    expect(report.columns).toEqual([]);
    expect(report.completedPhases).toEqual([...ANALYSIS_PHASES]);
  });
});

describe('createAnalysisRunner', () => {
  it('kurulumda hiçbir adımı koşturmaz', () => {
    const runner = createAnalysisRunner(RF_FRAMES);
    expect(runner.snapshot().completedPhases).toEqual([]);
    expect(runner.steps).toHaveLength(ANALYSIS_PHASES.length);
  });

  it('yarıda bırakılan analiz KISMİ rapor verir', () => {
    const runner = createAnalysisRunner(RF_FRAMES);
    runner.steps[0]?.run();
    runner.steps[1]?.run();
    const snapshot = runner.snapshot();
    expect(snapshot.completedPhases).toEqual(['columns', 'clusters']);
    expect(snapshot.columns).toHaveLength(7);
    expect(snapshot.counters).toEqual([]);
  });

  it('anlık kopya sonradan koşan adımdan etkilenmez', () => {
    const runner = createAnalysisRunner(RF_FRAMES);
    const empty = runner.snapshot();
    for (const step of runner.steps) step.run();
    expect(empty.completedPhases).toEqual([]);
    expect(runner.snapshot().completedPhases).toHaveLength(ANALYSIS_PHASES.length);
  });
});
