import { describe, expect, it } from 'vitest';

import { parseRtp, rtpParser, rtpPlugin } from './rtp';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

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

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(rtpPlugin.id).toBe('rtp');
    expect(rtpPlugin.category).toBe('network-ethernet');
    expect(rtpPlugin.parser?.protocolId).toBe('rtp');
    expect(rtpPlugin.exampleFrames.length).toBeGreaterThan(0);
    expect(rtpPlugin.decodeOptions).toBeUndefined();
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of rtpPlugin.exampleFrames) {
      const result = rtpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.rtp. önekli çeviri anahtarıdır', () => {
    for (const example of rtpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.rtp.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.rtp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('12 baytın altını reddeder', () => {
    expect(rtpParser.canParse(Uint8Array.from([0x80, 0x00, 0x00, 0x00]))).toBe(false);
  });

  it('versiyon 2 olmayanı reddeder', () => {
    const bytes = new Uint8Array(12);
    bytes[0] = 0x00; // V=0
    expect(rtpParser.canParse(bytes)).toBe(false);
  });

  it('versiyon 2 ve asgari uzunluğu kabul eder', () => {
    const bytes = new Uint8Array(12);
    bytes[0] = 0x80; // V=2
    expect(rtpParser.canParse(bytes)).toBe(true);
  });
});

describe('sabit başlık — V/P/X/CC/M/PT/Seq/Timestamp/SSRC', () => {
  it('temel alanları doğru çözer, PT bilinen codec\'e eşlenir', () => {
    const bytes = Uint8Array.from([
      0x80, 0x00, 0x12, 0x34, 0x00, 0x00, 0x0b, 0xb8, 0x12, 0x34, 0x56, 0x78,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'version').rawValue).toBe(2);
    expect(fieldById(frame, 'padding').rawValue).toBe(0);
    expect(fieldById(frame, 'extension').rawValue).toBe(0);
    expect(fieldById(frame, 'csrc-count').rawValue).toBe(0);
    expect(fieldById(frame, 'marker').rawValue).toBe(0);
    expect(fieldById(frame, 'payload-type').rawValue).toBe(0);
    expect(fieldById(frame, 'payload-type').physicalValue).toBe('PCMU (8000 Hz, mono)');
    expect(fieldById(frame, 'sequence-number').rawValue).toBe(0x1234);
    expect(fieldById(frame, 'timestamp').rawValue).toBe(3000);
    expect(fieldById(frame, 'ssrc').rawValue).toBe(0x12345678);
    expect(hasField(frame, 'payload')).toBe(false);
  });

  it('versiyon 2 değilse uyarır ama çözümlemeye devam eder', () => {
    const bytes = Uint8Array.from([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(fieldById(frame, 'version').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.rtp.warning.versionUnexpected');
  });

  it('dinamik/atanmamış Payload Type için uyarır, codec adı UYDURMAZ', () => {
    const bytes = Uint8Array.from([
      0x80, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    const ptField = fieldById(frame, 'payload-type');
    expect(ptField.rawValue).toBe(96);
    expect(ptField.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.rtp.warning.payloadTypeUnresolved');
  });

  it('12 bayttan kısa girdide truncated-frame ile başarısız olur (kısmi çözüm YOK)', () => {
    const { error } = expectFailure(rtpParser.parse(Uint8Array.from([0x80, 0x00, 0x00, 0x00])));
    expect(error.code).toBe('truncated-frame');
  });
});

describe('CSRC listesi', () => {
  it('CC=2 iken iki CSRC alanı sırayla okunur', () => {
    const bytes = Uint8Array.from([
      0x82, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11, 0x11, 0x11, 0x11,
      0x22, 0x22, 0x22, 0x22,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(fieldById(frame, 'csrc-0').rawValue).toBe(0x11111111);
    expect(fieldById(frame, 'csrc-1').rawValue).toBe(0x22222222);
  });

  it('CC listesine yetecek bayt yoksa truncated-frame hatası basar', () => {
    const bytes = Uint8Array.from([
      0x81, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(frame.errors[0]?.message).toBe('protocol.rtp.error.csrcTruncated');
  });
});

describe('Header Extension (X=1)', () => {
  it('profil + uzunluk + veriyi okur, sonrasını payload sayar', () => {
    const bytes = Uint8Array.from([
      0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xbe, 0xde, 0x00, 0x01,
      0x10, 0x00, 0x00, 0x00, 0xaa, 0xbb,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(fieldById(frame, 'extension-profile').rawValue).toBe(0xbede);
    expect(fieldById(frame, 'extension-length').rawValue).toBe(1);
    expect(fieldById(frame, 'extension-data').rawBytes).toEqual(Uint8Array.from([0x10, 0x00, 0x00, 0x00]));
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
  });

  it('veri uzunluğu tampona sığmıyorsa truncated-frame hatası basar', () => {
    const bytes = Uint8Array.from([
      0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.rtp.error.extensionTruncated');
  });
});

describe('Padding (P=1)', () => {
  it('son bayt (kendisi dâhil) sayılıp payload/padding ayrışır', () => {
    const bytes = Uint8Array.from([
      0xa0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0x00, 0x00,
      0x03,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
    expect(fieldById(frame, 'padding-bytes').rawValue).toBe(3);
    expect(fieldById(frame, 'padding-bytes').rawBytes).toEqual(Uint8Array.from([0x00, 0x00, 0x03]));
  });

  it('dolgu sayısı kalan alandan büyükse value-out-of-range basar', () => {
    const bytes = Uint8Array.from([
      0xa0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
  });

  it('dolgu sayısı 0 ise value-out-of-range basar (kendisi dâhil en az 1 olmalı)', () => {
    const bytes = Uint8Array.from([
      0xa0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(rtpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
  });
});

describe('parseRtp yardımcı fonksiyonu', () => {
  it('bağlamsız çağrıda parser ile aynı alanları üretir', () => {
    const bytes = Uint8Array.from([
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const { frame } = expectSuccess(parseRtp(bytes));
    expect(frame.fields).toEqual(expectSuccess(rtpParser.parse(bytes)).frame.fields);
  });
});
