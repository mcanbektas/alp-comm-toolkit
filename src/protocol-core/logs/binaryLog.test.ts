import { describe, expect, it } from 'vitest';

import { parseBinaryLog } from './binaryLog';

describe('parseBinaryLog', () => {
  it('çerçeve boyu verilmezse dosyayı tek kayıt sayar, bölme uydurmaz', () => {
    const result = parseBinaryLog(new Uint8Array([1, 2, 3, 4, 5]));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.data).toHaveLength(5);
    expect(result.summary.timestampKind).toBe('none');
  });

  it('çerçeve boyu verilirse sabit boyda diler', () => {
    const result = parseBinaryLog(new Uint8Array([1, 2, 3, 4]), { frameLength: 2 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
    expect(Array.from(result.records[1]?.data ?? [])).toEqual([3, 4]);
  });

  it('son dilim eksikse kesilmiş işaretler ve uyarır', () => {
    const result = parseBinaryLog(new Uint8Array([1, 2, 3]), { frameLength: 2 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[1]?.flags).toContain('truncated');
    expect(result.records[1]?.originalLength).toBe(2);
    expect(result.warnings.some((warning) => warning.code === 'truncated-packet')).toBe(true);
  });

  it('kayıt sınırını uygular', () => {
    const result = parseBinaryLog(new Uint8Array(10), { frameLength: 1, maxRecords: 3 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(3);
    expect(result.summary.limitReached).toBe(true);
  });

  it('boş dosyayı reddeder', () => {
    expect(parseBinaryLog(new Uint8Array(0)).status).toBe('error');
  });
});
