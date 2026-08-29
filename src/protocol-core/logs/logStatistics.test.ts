import { describe, expect, it } from 'vitest';

import { buildTimeline, computeLogStatistics } from './logStatistics';
import type { LogRecord } from './types';

function record(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    index: 0,
    line: undefined,
    timestamp: undefined,
    direction: undefined,
    channel: undefined,
    frameId: undefined,
    frameIdValue: undefined,
    data: new Uint8Array([0xaa]),
    originalLength: 1,
    flags: [],
    ...overrides,
  };
}

describe('computeLogStatistics', () => {
  it('yön dağılımında bilinmeyeni ayrı sayar', () => {
    const stats = computeLogStatistics([
      record({ direction: 'rx' }),
      record({ direction: 'tx' }),
      record(),
    ]);
    expect(stats.rxCount).toBe(1);
    expect(stats.txCount).toBe(1);
    expect(stats.unknownDirectionCount).toBe(1);
  });

  it('telde geçen bayt ile dosyadaki baytı ayrı toplar', () => {
    const stats = computeLogStatistics([
      record({ data: new Uint8Array([1, 2]), originalLength: 1514, flags: ['truncated'] }),
    ]);
    expect(stats.totalBytes).toBe(1514);
    expect(stats.capturedBytes).toBe(2);
    expect(stats.truncatedCount).toBe(1);
    expect(stats.flagCounts.truncated).toBe(1);
  });

  it('süre ve ortalama hızı damgalardan hesaplar', () => {
    const stats = computeLogStatistics([
      record({ timestamp: 1000 }),
      record({ timestamp: 1500 }),
      record({ timestamp: 2000 }),
    ]);
    expect(stats.durationMs).toBe(1000);
    expect(stats.averageRate).toBe(3);
    expect(stats.interval.average).toBe(500);
  });

  it('damga yoksa süreyi ve hızı uydurmaz', () => {
    const stats = computeLogStatistics([record(), record()]);
    expect(stats.durationMs).toBeUndefined();
    expect(stats.averageRate).toBeUndefined();
  });

  it('kanal ve kimlik dağılımını sayıya göre sıralar', () => {
    const stats = computeLogStatistics([
      record({ channel: 'can0', frameId: '123' }),
      record({ channel: 'can0', frameId: '124' }),
      record({ channel: 'can1', frameId: '123' }),
      record({ channel: 'can0', frameId: '123' }),
    ]);
    expect(stats.channels[0]).toEqual({ key: 'can0', count: 3, bytes: 3 });
    expect(stats.channelCount).toBe(2);
    expect(stats.frameIds[0]?.key).toBe('123');
    expect(stats.frameIdCount).toBe(2);
  });
});

describe('buildTimeline', () => {
  it('kayıtları eşit genişlikli kovalara dağıtır', () => {
    const buckets = buildTimeline(
      [record({ timestamp: 0 }), record({ timestamp: 50 }), record({ timestamp: 100 })],
      2,
    );
    expect(buckets).toHaveLength(2);
    // Kova genişliği 50 ms: 0 → ilk kova; 50 ve 100 → ikinci kova. Üst
    // sınırdaki 100 taşmaz, son kovaya sabitlenir.
    expect(buckets[0]?.count).toBe(1);
    expect(buckets[1]?.count).toBe(2);
  });

  it('damgasız kayıtları saymaz', () => {
    expect(buildTimeline([record(), record()], 4)).toHaveLength(0);
  });

  it('tüm kayıtlar aynı andaysa tek kova döner', () => {
    const buckets = buildTimeline([record({ timestamp: 5 }), record({ timestamp: 5 })], 8);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.count).toBe(2);
  });
});
