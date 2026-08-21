import { describe, expect, it } from 'vitest';

import { ymodemParser, ymodemPlugin } from './ymodem';
import { encodeXmodemBlock } from './xmodemCore';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

/** Test-yerel Block 0 kurucu — ymodem.ts'in kendi (dışa aktarılmayan) `encodeBlockZero`ından BAĞIMSIZ, testin implementasyona bağlanmasını önler. */
function buildBlockZeroPayload(filename: string, filesize: number, length: 128 | 1024 = 128): Uint8Array {
  const header = Uint8Array.from([
    ...Array.from(filename, (char) => char.charCodeAt(0)),
    0x00,
    ...Array.from(String(filesize), (char) => char.charCodeAt(0)),
  ]);
  const padded = new Uint8Array(length);
  padded.set(header.slice(0, length));
  return padded;
}

describe('ymodemParser — Block 0 (batch metadata)', () => {
  it('dosya adı + boyutu çözülür, kalan padding metadata-remainder olarak ham gösterilir', () => {
    const wire = encodeXmodemBlock(0, buildBlockZeroPayload('report.pdf', 4096), 'crc');
    const frame = expectSuccess(ymodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'block-number').physicalValue).toBe('Block 0 — batch metadata');
    expect(fieldById(frame, 'filename').rawValue).toBe('report.pdf');
    expect(fieldById(frame, 'filesize').rawValue).toBe('4096');
    expect(fieldById(frame, 'filesize').physicalValue).toBe(4096);
    expect(hasField(frame, 'metadata-remainder')).toBe(true);
    expect(hasField(frame, 'data')).toBe(false);
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('ymodem');
  });

  it('boş dosya adı batch terminatörü olarak adlanır, filename/filesize alanı YOK', () => {
    const wire = encodeXmodemBlock(0, new Uint8Array(128), 'crc');
    const frame = expectSuccess(ymodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'batch-terminator').physicalValue).toBe('Empty filename — end of batch (no more files)');
    expect(hasField(frame, 'filename')).toBe(false);
    expect(hasField(frame, 'filesize')).toBe(false);
  });
});

describe('ymodemParser — normal veri bloğu (Block > 0, XMODEM ile aynı)', () => {
  it('Block 1: data alanı XMODEM ile aynı şekilde çözülür, Block 0 alanları YOK', () => {
    const wire = encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'crc');
    const frame = expectSuccess(ymodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'data').physicalValue).toBe('128 bytes');
    expect(hasField(frame, 'filename')).toBe(false);
    expect(hasField(frame, 'batch-terminator')).toBe(false);
    expect(fieldById(frame, 'crc').physicalValue).toContain('PASS');
  });
});

describe('ymodemParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(ymodemParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('tanınmayan tek bayt unsupported-encoding döner', () => {
    expect(expectFailure(ymodemParser.parse(Uint8Array.from([0x99]))).error.code).toBe('unsupported-encoding');
  });

  it('bozuk CRC: frame.valid=false, crc-mismatch hatası', () => {
    const good = encodeXmodemBlock(0, buildBlockZeroPayload('a.bin', 1), 'crc');
    const corrupted = Uint8Array.from(good);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;

    const frame = expectSuccess(ymodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = ymodemParser.parse(Uint8Array.from([0x04]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(ymodemParser.canParse(new Uint8Array(0))).toBe(false);
    expect(ymodemParser.canParse(Uint8Array.from([0x04]))).toBe(true);
  });
});

describe('ymodemPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(ymodemPlugin.id).toBe('ymodem');
    expect(ymodemPlugin.category).toBe('interfaces-framing');
    expect(ymodemPlugin.parser).toBe(ymodemParser);
  });

  it('encoder çıktısı parser tarafından geçerli (PASS) olarak geri okunur (round-trip)', () => {
    const wire = ymodemPlugin.encoder?.encode(new Uint8Array(128).fill(0x42));
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(ymodemParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of ymodemPlugin.exampleFrames) {
      const result = ymodemParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ymodem.example. önekli çeviri anahtarıdır', () => {
    for (const example of ymodemPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ymodem.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.ymodem.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(ymodemPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
