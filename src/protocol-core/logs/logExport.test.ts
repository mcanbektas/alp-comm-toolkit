import { describe, expect, it } from 'vitest';

import { recordsToCsv } from './logExport';
import type { LogRecord } from './types';

const RECORD: LogRecord = {
  index: 0,
  line: 3,
  timestamp: 1_637_856_000_000,
  direction: 'rx',
  channel: 'can0',
  frameId: '123',
  frameIdValue: 0x123,
  data: new Uint8Array([0xde, 0xad]),
  originalLength: 8,
  flags: ['extended-id'],
};

describe('recordsToCsv', () => {
  it('mutlak damgayı ISO 8601 yazar', () => {
    const csv = recordsToCsv([RECORD], 'absolute');
    expect(csv.split('\n')[1]).toContain('2021-11-25T');
  });

  it('göreli damgayı ham milisaniye bırakır', () => {
    const csv = recordsToCsv([{ ...RECORD, timestamp: 12.5 }], 'relative');
    expect(csv.split('\n')[1]).toContain('12.5');
  });

  it('başlık satırını ve veriyi yazar', () => {
    const csv = recordsToCsv([RECORD], 'absolute');
    expect(csv.split('\n')[0]).toBe('index,line,timestamp,direction,channel,id,length,captured,flags,data');
    expect(csv).toContain('DEAD');
  });

  it('ayraç içeren hücreyi tırnaklar', () => {
    const csv = recordsToCsv([{ ...RECORD, channel: 'a,b' }], 'absolute');
    expect(csv).toContain('"a,b"');
  });
});
