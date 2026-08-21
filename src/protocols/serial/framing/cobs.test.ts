import { describe, expect, it } from 'vitest';

import { cobsParser, cobsPlugin } from './cobs';
import { COBS_DELIMITER, encodeCobsFrame } from '@/protocol-core/framing/cobs';
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

describe('cobsParser — spec fixtureleri (cobs.test.ts emsali)', () => {
  it('spec fixture 1 (satır 139): 11 22 00 33 → iki kod baytı, sıfır ortada geri gelir', () => {
    const wire = Uint8Array.from([0x03, 0x11, 0x22, 0x02, 0x33, COBS_DELIMITER]);
    const frame = expectSuccess(cobsParser.parse(wire)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('11 22 00 33');
    expect(fieldById(frame, 'code-byte-0').offset).toBe(0);
    expect(fieldById(frame, 'code-byte-0').rawValue).toBe(3);
    expect(fieldById(frame, 'code-byte-0').physicalValue).toBe('2 data bytes, zero restored after');
    expect(fieldById(frame, 'code-byte-1').offset).toBe(3);
    expect(fieldById(frame, 'code-byte-1').physicalValue).toBe('1 data bytes');
    expect(fieldById(frame, 'delimiter').offset).toBe(5);
    expect(frame.protocol).toBe('cobs');
  });

  it('spec fixture 2 (satır 140): tek 0x00 baytı iki kod baytıyla kodlanır', () => {
    const wire = Uint8Array.from([0x01, 0x01, COBS_DELIMITER]);
    const frame = expectSuccess(cobsParser.parse(wire)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('00');
    expect(fieldById(frame, 'code-byte-0').physicalValue).toBe('0 data bytes, zero restored after');
    expect(fieldById(frame, 'code-byte-1').physicalValue).toBe('0 data bytes');
  });

  it('sıfır içermeyen veri tek kod baytıyla, "zero restored" iddiası TAŞIMADAN kodlanır', () => {
    const wire = encodeCobsFrame(Uint8Array.from([0x01, 0x02, 0x03]));
    const frame = expectSuccess(cobsParser.parse(wire)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('01 02 03');
    expect(fieldById(frame, 'code-byte-0').physicalValue).toBe('3 data bytes');
    expect(frame.fields.some((field) => field.id === 'code-byte-1')).toBe(false);
  });

  it('254 sıfırsız bayt 0xFF taşırma kodunu üretir, "overflow block" işaretlenir', () => {
    const raw = Uint8Array.from({ length: 254 }, (_unused, i) => (i % 255) + 1);
    const wire = encodeCobsFrame(raw);
    const frame = expectSuccess(cobsParser.parse(wire)).frame;

    expect(fieldById(frame, 'code-byte-0').rawValue).toBe(0xff);
    expect(fieldById(frame, 'code-byte-0').physicalValue).toBe('254 data bytes (overflow block, no zero removed)');
  });

  it('çerçeve sonrası artık bayt ayrı bir alanda ve uyarıyla gösterilir', () => {
    const twoFrames = Uint8Array.from([...encodeCobsFrame(Uint8Array.from([0x01])), ...encodeCobsFrame(Uint8Array.from([0x02]))]);
    const frame = expectSuccess(cobsParser.parse(twoFrames)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('01');
    expect(fieldById(frame, 'trailing-bytes').rawValue).toBe('02 02 00');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.cobs.warning.trailingBytes');
  });
});

describe('cobsParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(cobsParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(cobsParser.parse(Uint8Array.from([0x03, 0x11, 0x22]))).error.code).toBe('truncated-frame');
  });

  it('kod kalan veriden uzunsa truncated-frame döner', () => {
    const wire = Uint8Array.from([0x05, 0x11, 0x22, COBS_DELIMITER]);
    expect(expectFailure(cobsParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = cobsParser.parse(Uint8Array.from([COBS_DELIMITER]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(cobsParser.canParse(new Uint8Array(0))).toBe(false);
    expect(cobsParser.canParse(Uint8Array.from([0x01]))).toBe(true);
  });
});

describe('cobsPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve encoder bağını taşır', () => {
    expect(cobsPlugin.id).toBe('cobs');
    expect(cobsPlugin.category).toBe('interfaces-framing');
    expect(cobsPlugin.parser).toBe(cobsParser);
    expect(cobsPlugin.encoder?.encode).toBe(encodeCobsFrame);
  });

  it('encoder çıktısı parser tarafından aynı payload olarak geri okunur (round-trip)', () => {
    const payload = Uint8Array.from([0x00, 0x00, 0xff, 0x01]);
    const wire = cobsPlugin.encoder?.encode(payload);
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(cobsParser.parse(wire)).frame;
    expect(fieldById(frame, 'payload').rawValue).toBe('00 00 FF 01');
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of cobsPlugin.exampleFrames) {
      const result = cobsParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.cobs.example. önekli çeviri anahtarıdır', () => {
    for (const example of cobsPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.cobs.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.cobs.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(cobsPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
