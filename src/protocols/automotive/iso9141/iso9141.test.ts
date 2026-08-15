import { describe, expect, it } from 'vitest';

import { iso9141Parser, iso9141Plugin, parseIso9141 } from './iso9141';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/**
 * Motorun checksum hesabından BAĞIMSIZ ikinci hesap (LIN emsali, dosya başı
 * brifi) — 8-bit toplam mod 256, checksum baytı hariç tüm baytlar üzerinde.
 */
function independentChecksum(bytesExcludingChecksum: readonly number[]): number {
  return bytesExcludingChecksum.reduce((sum, value) => (sum + value) & 0xff, 0);
}

describe('parseIso9141 — sabit header', () => {
  it('0x68/0x6A standart header + Source Address ham çözülür', () => {
    const bytes = new Uint8Array([0x68, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x22]);
    expect(independentChecksum([0x68, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8])).toBe(0x22);
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'format').valid).toBe(true);
    expect(fieldById(frame, 'target-address').valid).toBe(true);
    expect(fieldById(frame, 'source-address').rawValue).toBe(0xf1);
    expect(fieldById(frame, 'data').rawBytes).toEqual(new Uint8Array([0x41, 0x0c, 0x1a, 0xf8]));
    expect(fieldById(frame, 'data').warnings).toContain('protocol.iso9141.warning.dataNeedsObdPage');
    expect(warningCodes(frame)).toContain('protocol.iso9141.warning.dataNeedsObdPage');
  });

  it('format baytı 0x68 değilse uyarır ama hata basmadan ham çözer', () => {
    const bytes = new Uint8Array([0x48, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x02]);
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'format').valid).toBe(false);
    expect(fieldById(frame, 'format').rawValue).toBe(0x48);
    expect(warningCodes(frame)).toContain('protocol.iso9141.warning.unexpectedFormatByte');
  });

  it('target address baytı 0x6A değilse uyarır ama hata basmadan ham çözer', () => {
    const bytes = new Uint8Array([0x68, 0x48, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x00]);
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'target-address').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.iso9141.warning.unexpectedTargetAddress');
  });

  it('Source Address hiçbir zaman uyarı üretmez — freediag’da teknik olarak değişken alan', () => {
    const bytes = new Uint8Array([0x68, 0x6a, 0x00, 0x41, 0x0c, 0x1a, 0xf8, 0x22]);
    const bytesSum = independentChecksum([0x68, 0x6a, 0x00, 0x41, 0x0c, 0x1a, 0xf8]);
    bytes[bytes.length - 1] = bytesSum;
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(fieldById(frame, 'source-address').warnings).toEqual([]);
  });

  it('veri baytı yoksa data alanı ve NeedsObdPage uyarısı üretilmez', () => {
    const bytes = new Uint8Array([0x68, 0x6a, 0xf1, 0xc3]);
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(frame.valid).toBe(true);
    expect(hasField(frame, 'data')).toBe(false);
    expect(warningCodes(frame)).not.toContain('protocol.iso9141.warning.dataNeedsObdPage');
  });
});

describe('parseIso9141 — checksum', () => {
  it('bozuk checksum checksum-mismatch hatası basar, önceki alanlar yine görünür', () => {
    const bytes = new Uint8Array([0x68, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0xff]);
    const { frame } = expectSuccess(parseIso9141(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'data').rawBytes).toEqual(new Uint8Array([0x41, 0x0c, 0x1a, 0xf8]));
    expect(fieldById(frame, 'checksum').valid).toBe(false);
  });
});

describe('parseIso9141 — kısaltılmış girdi', () => {
  it('4 bayttan kısa girdide truncated-frame döner', () => {
    expect(expectFailure(parseIso9141(new Uint8Array([0x68, 0x6a, 0xf1]))).error.code).toBe(
      'truncated-frame',
    );
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      iso9141Parser.parse(new Uint8Array([0x68, 0x6a, 0xf1, 0xc3]), {
        signal: controller.signal,
      }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const result = expectFailure(
      iso9141Parser.parse(new Uint8Array([0x68, 0x6a, 0xf1, 0xc3]), { maxFrameLength: 3 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });
});

describe('iso9141Parser.canParse', () => {
  it('uzunluk aralığındaki her girdiyi kabul eder', () => {
    expect(iso9141Parser.canParse(new Uint8Array([0x68, 0x6a, 0xf1, 0xc3]))).toBe(true);
  });

  it('4 bayttan kısa girdiyi eler', () => {
    expect(iso9141Parser.canParse(new Uint8Array([0x68, 0x6a, 0xf1]))).toBe(false);
  });
});

describe('iso9141Plugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(iso9141Plugin.id).toBe('iso-9141');
    expect(iso9141Plugin.category).toBe('automotive');
    expect(iso9141Plugin.parser).toBe(iso9141Parser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of iso9141Plugin.exampleFrames) {
      const result = iso9141Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.iso9141.example. önekli çeviri anahtarıdır', () => {
    for (const example of iso9141Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.iso9141.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.iso9141.example.'), example.id).toBe(true);
    }
  });
});
