import { describe, expect, it } from 'vitest';

import { xmodemParser, xmodemPlugin } from './xmodem';
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

describe('xmodemParser — blok çözümü', () => {
  it('checksum modu: header/block/complement/data/checksum PASS ile çözülür', () => {
    const wire = encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'checksum');
    const frame = expectSuccess(xmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'header').physicalValue).toBe('SOH — 128-byte block');
    expect(fieldById(frame, 'block-number').rawValue).toBe(1);
    expect(fieldById(frame, 'block-complement').valid).toBe(true);
    expect(fieldById(frame, 'data').physicalValue).toBe('128 bytes');
    expect(fieldById(frame, 'checksum').physicalValue).toContain('PASS');
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('xmodem');
  });

  it('CRC modu + XMODEM-1K: header 1024 bayt olarak adlanır, crc alanı PASS gösterir', () => {
    const wire = encodeXmodemBlock(2, new Uint8Array(1024).fill(0x55), 'crc');
    const frame = expectSuccess(xmodemParser.parse(wire)).frame;

    expect(fieldById(frame, 'header').physicalValue).toBe('STX — 1024-byte block (XMODEM-1K)');
    expect(fieldById(frame, 'crc').physicalValue).toContain('PASS');
  });

  it('bozuk blok tümleyeni: frame.valid=false, value-out-of-range hatası', () => {
    const good = encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'checksum');
    const corrupted = Uint8Array.from(good);
    corrupted[2] = 0x00;

    const frame = expectSuccess(xmodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(fieldById(frame, 'block-complement').valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('value-out-of-range');
  });

  it('bozuk checksum: frame.valid=false, checksum-mismatch hatası', () => {
    const good = encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'checksum');
    const corrupted = Uint8Array.from(good);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;

    const frame = expectSuccess(xmodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('checksum-mismatch');
  });

  it('bozuk CRC: frame.valid=false, crc-mismatch hatası', () => {
    const good = encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'crc');
    const corrupted = Uint8Array.from(good);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;

    const frame = expectSuccess(xmodemParser.parse(corrupted)).frame;
    expect(frame.valid).toBe(false);
    expect(frame.errors.map((e) => e.code)).toContain('crc-mismatch');
  });

  it('EOT tek baytı kontrol çerçevesi olarak, geçerli, adlanarak çözülür', () => {
    const frame = expectSuccess(xmodemParser.parse(Uint8Array.from([0x04]))).frame;
    expect(fieldById(frame, 'control').physicalValue).toBe('EOT (End Of Transmission)');
    expect(frame.valid).toBe(true);
  });
});

describe('xmodemParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(xmodemParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('tanınmayan tek bayt unsupported-encoding döner', () => {
    expect(expectFailure(xmodemParser.parse(Uint8Array.from([0x99]))).error.code).toBe('unsupported-encoding');
  });

  it('tutarsız çerçeve uzunluğu length-mismatch döner', () => {
    const wire = Uint8Array.from([0x01, 0x01, 0xfe, 0x00, 0x00, 0x00]);
    expect(expectFailure(xmodemParser.parse(wire)).error.code).toBe('length-mismatch');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = xmodemParser.parse(Uint8Array.from([0x04]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(xmodemParser.canParse(new Uint8Array(0))).toBe(false);
    expect(xmodemParser.canParse(Uint8Array.from([0x04]))).toBe(true);
  });
});

describe('xmodemPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(xmodemPlugin.id).toBe('xmodem');
    expect(xmodemPlugin.category).toBe('interfaces-framing');
    expect(xmodemPlugin.parser).toBe(xmodemParser);
  });

  it('encoder çıktısı parser tarafından geçerli (PASS) olarak geri okunur (round-trip)', () => {
    const wire = xmodemPlugin.encoder?.encode(new Uint8Array(128).fill(0x42));
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(xmodemParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of xmodemPlugin.exampleFrames) {
      const result = xmodemParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.xmodem.example. önekli çeviri anahtarıdır', () => {
    for (const example of xmodemPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.xmodem.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.xmodem.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(xmodemPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
