import { describe, expect, it } from 'vitest';

import { delimiterBasedProtocolParser, delimiterBasedProtocolPlugin } from './delimiterBasedProtocol';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}": ${result.error.message}`);
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

describe('delimiterBasedProtocolParser', () => {
  it('01 7E 02 (delimiter collision): payload çözülür, bir escape-event alanı basılır', () => {
    const frame = expectSuccess(delimiterBasedProtocolParser.parse(delimiterBasedProtocolPlugin.exampleFrames[0]?.bytes ?? new Uint8Array())).frame;
    expect(fieldById(frame, 'flag-start').rawValue).toBe('0x7E');
    expect(fieldById(frame, 'payload').rawValue).toBe('01 7E 02');
    expect(fieldById(frame, 'escape-event-0').physicalValue).toContain('delimiter collision resolved');
    expect(() => fieldById(frame, 'escape-event-1')).toThrow();
    expect(fieldById(frame, 'flag-end').rawValue).toBe('0x7E');
    expect(frame.valid).toBe(true);
  });

  it('kaçış gerekmeyen payload hiç escape-event basmaz', () => {
    const wire = delimiterBasedProtocolPlugin.encoder?.encode(Uint8Array.from([0x01, 0x02, 0x03]));
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(delimiterBasedProtocolParser.parse(wire)).frame;
    expect(fieldById(frame, 'payload').rawValue).toBe('01 02 03');
    expect(() => fieldById(frame, 'escape-event-0')).toThrow();
  });

  it('kapanış bayrağı eksikse hata döner', () => {
    const result = expectFailure(delimiterBasedProtocolParser.parse(delimiterBasedProtocolPlugin.exampleFrames[1]?.bytes ?? new Uint8Array()));
    expect(result.error.code).toBe('truncated-frame');
  });

  it('canParse yalnız HDLC_FLAG (0x7E) ile başlayan girdide true döner', () => {
    expect(delimiterBasedProtocolParser.canParse(Uint8Array.from([0x7e, 0x01]))).toBe(true);
    expect(delimiterBasedProtocolParser.canParse(Uint8Array.from([0x01, 0x7e]))).toBe(false);
    expect(delimiterBasedProtocolParser.canParse(new Uint8Array(0))).toBe(false);
  });
});

describe('delimiterBasedProtocolPlugin', () => {
  it('katalogdaki kimlik ve kategoriyi taşır', () => {
    expect(delimiterBasedProtocolPlugin.id).toBe('delimiter-based-protocol');
    expect(delimiterBasedProtocolPlugin.category).toBe('interfaces-framing');
  });

  it('her örnek çözülür (başarısız olması beklenenler dahil) ve expectedValid ile eşleşir', () => {
    for (const example of delimiterBasedProtocolPlugin.exampleFrames) {
      const result = delimiterBasedProtocolParser.parse(example.bytes);
      const valid = result.success ? result.frame.valid : false;
      expect(valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.delimiterBasedProtocol.example. önekli çeviri anahtarıdır', () => {
    for (const example of delimiterBasedProtocolPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.delimiterBasedProtocol.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.delimiterBasedProtocol.example.'), example.id).toBe(true);
    }
  });
});
