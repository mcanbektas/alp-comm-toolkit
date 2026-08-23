import { describe, expect, it } from 'vitest';

import { parseXcpOnCan, xcpOnCanParser, xcpOnCanPlugin } from './xcpOnCan';
import { buildCanClassicFrame } from '../can/canClassic';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

describe('xcpOnCanParser.canParse', () => {
  it('8-16 bayt arası her uzunluğu kabul eder (CAN ID XCP-özgü değildir)', () => {
    expect(xcpOnCanParser.canParse(buildCanClassicFrame(0x7e0, [0xff]))).toBe(true);
    expect(xcpOnCanParser.canParse(buildCanClassicFrame(0x7e0, [0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(
      true,
    );
  });

  it('8 bayttan kısa ya da 16 bayttan uzun girdiyi reddeder', () => {
    expect(xcpOnCanParser.canParse(new Uint8Array(7))).toBe(false);
    expect(xcpOnCanParser.canParse(new Uint8Array(72))).toBe(false);
  });
});

describe('xcpOnCanParser.parse — girdi sınırları', () => {
  it('8 bayttan kısa girdi truncated-frame verir, kurtarılabilir', () => {
    const result = xcpOnCanParser.parse(new Uint8Array(4));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('tam CAN FD uzunluğu (72 bayt) unsupported-encoding ile AÇIKÇA reddedilir', () => {
    const result = xcpOnCanParser.parse(new Uint8Array(72));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unsupported-encoding');
    }
  });

  it('16 baytı aşan (FD olmayan) girdi frame-too-long verir', () => {
    const result = xcpOnCanParser.parse(new Uint8Array(20));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('frame-too-long');
    }
  });

  it('boş payload (DLC=0) truncated-frame hatası verir — PID baytı yoktur', () => {
    const result = xcpOnCanParser.parse(buildCanClassicFrame(0x7e0, []));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(false);
      expect(result.frame.errors.some((e) => e.code === 'truncated-frame')).toBe(true);
    }
  });

  it('extended (29-bit) CAN ID reddedilmez, yalnız etiketlenir (DeviceNetten fark)', () => {
    const result = xcpOnCanParser.parse(buildCanClassicFrame(0x18f00401, [0xff, 0x00], { extended: true }));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.frame.valid).toBe(true);
      expect(fieldById(result.frame.fields, 'can-id')?.physicalValue).toBe('Extended / 29-bit');
    }
  });
});

describe('xcpOnCanParser.parse — decodeOptions: role', () => {
  it('varsayılan role=command: 0xFF → CONNECT', () => {
    const result = parseXcpOnCan(buildCanClassicFrame(0x7e0, [0xff, 0x00]));
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'pid')?.physicalValue).toBe('CONNECT');
    }
  });

  it('role=response seçilince AYNI bayt dizisi RES olarak okunur', () => {
    const data = buildCanClassicFrame(0x7e8, [0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const result = xcpOnCanParser.parse(data, { options: { role: 'response' } });
    expect(result.success).toBe(true);
    if (isParseSuccess(result)) {
      expect(fieldById(result.frame.fields, 'packet-code')?.physicalValue).toBe('positive-response');
    }
  });
});

describe('xcpOnCanParser.parse — decodeOptions: byteOrder', () => {
  it('SET_MTA adresini little-endian ve big-endian ile FARKLI çözer', () => {
    const data = buildCanClassicFrame(0x7e0, [0xf6, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00]);
    const little = xcpOnCanParser.parse(data, { options: { byteOrder: 'little-endian' } });
    const big = xcpOnCanParser.parse(data, { options: { byteOrder: 'big-endian' } });
    expect(isParseSuccess(little) && isParseSuccess(big)).toBe(true);
    if (isParseSuccess(little) && isParseSuccess(big)) {
      const littleAddress = fieldById(little.frame.fields, 'address')?.rawValue;
      const bigAddress = fieldById(big.frame.fields, 'address')?.rawValue;
      expect(littleAddress).not.toBe(bigAddress);
    }
  });
});

describe('xcpOnCanPlugin', () => {
  it('örnek çerçevelerin hepsi motorla sorunsuz çözülür', () => {
    for (const example of xcpOnCanPlugin.exampleFrames) {
      const result = xcpOnCanParser.parse(example.bytes);
      expect(result.success, `${example.id} parse etmedi`).toBe(true);
    }
  });

  it('decodeOptions role/byteOrder ikisini de bildirir', () => {
    const ids = (xcpOnCanPlugin.decodeOptions ?? []).map((option) => option.id);
    expect(ids).toEqual(['role', 'byteOrder']);
  });
});
