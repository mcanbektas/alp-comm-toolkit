import { describe, expect, it } from 'vitest';

import { createReportBuilder, formatFrame, reportToJson } from './report';
import type { StepResult } from './report';

function stepResult(overrides: Partial<StepResult> = {}): StepResult {
  return {
    stepId: 's',
    kind: 'log',
    label: undefined,
    startedAt: 0,
    endedAt: 1,
    outcome: 'pass',
    receivedFrame: undefined,
    expectedValue: undefined,
    actualValue: undefined,
    errorDetails: undefined,
    message: undefined,
    iteration: undefined,
    ...overrides,
  };
}

describe('formatFrame', () => {
  it('baytları boşluklu büyük harf onaltılığa çevirir', () => {
    expect(formatFrame(new Uint8Array([0xaa, 0x05, 0x0f]))).toBe('AA 05 0F');
  });
});

describe('createReportBuilder', () => {
  it('sonuçları türüne göre sayar', () => {
    const builder = createReportBuilder('test', 100);
    builder.record(stepResult({ outcome: 'pass' }));
    builder.record(stepResult({ outcome: 'fail' }));
    builder.record(stepResult({ outcome: 'timeout' }));
    builder.record(stepResult({ outcome: 'error' }));

    const report = builder.finish('failed', 200);
    expect(report).toMatchObject({
      testName: 'test',
      startedAt: 100,
      endedAt: 200,
      passCount: 1,
      failCount: 1,
      timeoutCount: 1,
      errorCount: 1,
      executedSteps: 4,
      truncated: false,
    });
  });

  it('satır bütçesini aşınca SAYMAYA devam eder ama kesildiğini söyler', () => {
    const builder = createReportBuilder('test', 0, 2);
    for (let index = 0; index < 5; index += 1) builder.record(stepResult());

    const report = builder.finish('passed', 10);
    expect(report.steps).toHaveLength(2);
    expect(report.executedSteps).toBe(5);
    expect(report.passCount).toBe(5);
    expect(report.truncated).toBe(true);
  });
});

describe('reportToJson', () => {
  it('raporu okunur JSON metnine çevirir', () => {
    const builder = createReportBuilder('test', 0);
    builder.record(stepResult({ receivedFrame: 'AA 55' }));
    const json = JSON.parse(reportToJson(builder.finish('passed', 5))) as { steps: { receivedFrame: string }[] };
    expect(json.steps[0]?.receivedFrame).toBe('AA 55');
  });
});
