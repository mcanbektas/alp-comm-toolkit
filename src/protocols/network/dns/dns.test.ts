import { describe, expect, it } from 'vitest';

import { dnsParser, dnsPlugin, parseDns } from './dns';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(dnsPlugin.id).toBe('dns');
    expect(dnsPlugin.category).toBe('network-ethernet');
    expect(dnsPlugin.parser?.protocolId).toBe('dns');
    expect(dnsPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of dnsPlugin.exampleFrames) {
      const result = dnsParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.dns. önekli çeviri anahtarıdır', () => {
    for (const example of dnsPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.dns.'), example.id).toBe(true);
    }
  });

  it('frame.protocol "dns" damgasını taşır', () => {
    const example = dnsPlugin.exampleFrames.find((frame) => frame.id === 'simple-query');
    if (example === undefined) throw new Error('simple-query example missing');
    const result = parseDns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(result.frame.protocol).toBe('dns');
  });
});

describe('canParse', () => {
  it('12 bayttan kısa veriyi reddeder', () => {
    expect(dnsParser.canParse(Uint8Array.from([0, 0, 0, 0]))).toBe(false);
  });
});

describe('sıkıştırılmış Answer örneği', () => {
  it('0xC00C pointer’ını doğru çözer', () => {
    const example = dnsPlugin.exampleFrames.find((frame) => frame.id === 'response-with-answer');
    if (example === undefined) throw new Error('example missing');
    const result = parseDns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(fieldById(result.frame, 'answer-1-name').rawValue).toBe('example.com');
    expect(fieldById(result.frame, 'answer-1-rdata').rawValue).toBe('93.184.216.34');
  });
});
