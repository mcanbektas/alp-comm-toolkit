import { describe, expect, it } from 'vitest';

import { mdnsParser, mdnsPlugin, parseMdns } from './mdns';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

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

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(mdnsPlugin.id).toBe('mdns');
    expect(mdnsPlugin.category).toBe('network-ethernet');
    expect(mdnsPlugin.parser?.protocolId).toBe('mdns');
    expect(mdnsPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of mdnsPlugin.exampleFrames) {
      const result = mdnsParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.mdns. önekli çeviri anahtarıdır', () => {
    for (const example of mdnsPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.mdns.'), example.id).toBe(true);
    }
  });

  it('frame.protocol "mdns" damgasını taşır', () => {
    const example = mdnsPlugin.exampleFrames.find((frame) => frame.id === 'query-local');
    if (example === undefined) throw new Error('query-local example missing');
    const result = parseMdns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(result.frame.protocol).toBe('mdns');
  });
});

describe('canParse', () => {
  it('12 bayttan kısa veriyi reddeder', () => {
    expect(mdnsParser.canParse(Uint8Array.from([0, 0, 0, 0]))).toBe(false);
  });
});

describe('QU biti / cache flush biti', () => {
  it('unicast-response-requested örneğinde soru üst biti çözülür', () => {
    const example = mdnsPlugin.exampleFrames.find((frame) => frame.id === 'unicast-response-requested');
    if (example === undefined) throw new Error('example missing');
    const result = parseMdns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(fieldById(result.frame, 'question-1-unicast-response').rawValue).toBe(1);
    expect(fieldById(result.frame, 'question-1-class').physicalValue).toBe('IN');
  });

  it('response-cache-flush örneğinde yanıt üst biti çözülür', () => {
    const example = mdnsPlugin.exampleFrames.find((frame) => frame.id === 'response-cache-flush');
    if (example === undefined) throw new Error('example missing');
    const result = parseMdns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(fieldById(result.frame, 'answer-1-cache-flush').rawValue).toBe(1);
    expect(fieldById(result.frame, 'answer-1-rdata').rawValue).toBe('192.168.1.50');
  });

  it('query-local örneğinde üst bit yok, unicast-response alanı üretilmez', () => {
    const example = mdnsPlugin.exampleFrames.find((frame) => frame.id === 'query-local');
    if (example === undefined) throw new Error('example missing');
    const result = parseMdns(example.bytes);
    if (!result.success) throw new Error('expected success');
    expect(hasField(result.frame, 'question-1-unicast-response')).toBe(true);
    expect(fieldById(result.frame, 'question-1-unicast-response').rawValue).toBe(0);
  });
});
