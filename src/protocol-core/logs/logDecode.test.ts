import { describe, expect, it } from 'vitest';

import { decodeLogRecord, summarizeLogDecode } from './logDecode';
import type { LogRecord } from './types';
import type { ParseResult, ProtocolParser } from '../types';
import { createRawFrame } from '../types';

function record(data: readonly number[]): LogRecord {
  return {
    index: 0,
    line: undefined,
    timestamp: undefined,
    direction: undefined,
    channel: undefined,
    frameId: undefined,
    frameIdValue: undefined,
    data: new Uint8Array(data),
    originalLength: data.length,
    flags: [],
  };
}

/** İlk baytı 0xAA olan çerçeveyi çözer, 0xFF görürse çöker. */
const PARSER: ProtocolParser = {
  protocolId: 'test',
  displayName: 'Test',
  canParse: () => true,
  parse(data: Uint8Array): ParseResult {
    if (data[0] === 0xff) throw new Error('beklenmedik bayt');
    if (data[0] !== 0xaa) {
      return {
        success: false,
        error: { code: 'start-delimiter-not-found', message: 'başlık uyuşmuyor' },
        consumedBytes: 0,
        recoverable: true,
      };
    }
    return {
      success: true,
      consumedBytes: data.length,
      frame: {
        protocol: 'test',
        timestamp: 0,
        rawFrame: createRawFrame(data, { direction: 'rx' }),
        fields: [],
        valid: true,
        errors: [],
        warnings: [],
      },
    };
  },
};

describe('decodeLogRecord', () => {
  it('motorun istisnasını yutar ve çökme olarak bildirir', () => {
    const outcome = decodeLogRecord(PARSER, record([0xff]));
    expect(outcome.kind).toBe('crashed');
  });

  it('başarılı çözümlemeyi olduğu gibi döner', () => {
    const outcome = decodeLogRecord(PARSER, record([0xaa, 0x01]));
    expect(outcome.kind).toBe('parsed');
    if (outcome.kind !== 'parsed') return;
    expect(outcome.result.success).toBe(true);
  });
});

describe('summarizeLogDecode', () => {
  it('başarı, başarısızlık ve çökmeyi ayrı sayar', () => {
    const summary = summarizeLogDecode('test', PARSER, [record([0xaa]), record([0x01]), record([0xff])], 10);
    expect(summary.attempted).toBe(3);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.crashed).toBe(1);
    expect(summary.successRatePercent).toBeCloseTo(33.33, 1);
  });

  it('örneklemi baştan alır ve sınırı aşmaz', () => {
    const records = [record([0xaa]), record([0xaa]), record([0x01])];
    expect(summarizeLogDecode('test', PARSER, records, 2).attempted).toBe(2);
  });

  it('hiç kayıt yoksa oranı sıfır değil bilinmeyen bırakır', () => {
    expect(summarizeLogDecode('test', PARSER, [], 5).successRatePercent).toBeUndefined();
  });
});
