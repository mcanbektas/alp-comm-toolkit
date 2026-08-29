import { describe, expect, it } from 'vitest';

import { applyLogFilter, isFilterEmpty, normalizeHexQuery } from './logFilter';
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
    data: new Uint8Array([0xaa, 0xbb]),
    originalLength: 2,
    flags: [],
    ...overrides,
  };
}

const RECORDS: readonly LogRecord[] = [
  record({ index: 0, channel: 'can0', frameId: '123', direction: 'rx', timestamp: 100, originalLength: 2 }),
  record({ index: 1, channel: 'can1', frameId: '124', direction: 'tx', timestamp: 200, originalLength: 8, data: new Uint8Array([0xde, 0xad]) }),
  record({ index: 2, channel: 'can0', frameId: '123', timestamp: 300, originalLength: 4, flags: ['truncated'] }),
];

describe('applyLogFilter', () => {
  it('boş filtrede tüm kayıtları döner', () => {
    expect(applyLogFilter(RECORDS, {})).toHaveLength(3);
    expect(isFilterEmpty({})).toBe(true);
  });

  it('kanal, kimlik ve yöne göre süzer', () => {
    expect(applyLogFilter(RECORDS, { channel: 'can0' })).toHaveLength(2);
    expect(applyLogFilter(RECORDS, { frameId: '124' })).toHaveLength(1);
    expect(applyLogFilter(RECORDS, { direction: 'rx' })).toHaveLength(1);
  });

  it('yön ölçütü verildiğinde yönü bilinmeyen kaydı eler', () => {
    const matched = applyLogFilter(RECORDS, { direction: 'tx' });
    expect(matched.map((item) => item.index)).toEqual([1]);
  });

  it('uzunluk aralığını telde geçen uzunluğa uygular', () => {
    expect(applyLogFilter(RECORDS, { minLength: 4 }).map((item) => item.index)).toEqual([1, 2]);
    expect(applyLogFilter(RECORDS, { maxLength: 2 }).map((item) => item.index)).toEqual([0]);
  });

  it('zaman aralığını uygular', () => {
    expect(applyLogFilter(RECORDS, { fromMs: 150, toMs: 250 }).map((item) => item.index)).toEqual([1]);
  });

  it('bayrağa göre süzer', () => {
    expect(applyLogFilter(RECORDS, { flag: 'truncated' }).map((item) => item.index)).toEqual([2]);
  });

  it('veri içinde onaltılık arar, ayraç ve harf durumunu yok sayar', () => {
    expect(applyLogFilter(RECORDS, { hexContains: 'de ad' }).map((item) => item.index)).toEqual([1]);
    expect(normalizeHexQuery('de:ad')).toBe('DEAD');
  });
});
