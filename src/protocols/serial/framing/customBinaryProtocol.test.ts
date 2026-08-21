import { describe, expect, it } from 'vitest';

import { customBinaryProtocolParser, customBinaryProtocolPlugin } from './customBinaryProtocol';
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

describe('customBinaryProtocolParser', () => {
  it('spec §43 çerçevesi: address/command/payload/checksum PASS ile çözülür', () => {
    const frame = expectSuccess(customBinaryProtocolParser.parse(customBinaryProtocolPlugin.exampleFrames[0]?.bytes ?? new Uint8Array())).frame;
    expect(fieldById(frame, 'address').rawValue).toBe(5);
    expect(fieldById(frame, 'command').physicalValue).toBe('Sensor Data');
    expect(fieldById(frame, 'checksum').physicalValue).toBe('valid');
    expect(frame.valid).toBe(true);
    expect(frame.protocol).toBe('ALP Sensor Protocol');
  });

  it('bozuk checksum: frame.valid=false, checksum alanı invalid', () => {
    const frame = expectSuccess(customBinaryProtocolParser.parse(customBinaryProtocolPlugin.exampleFrames[1]?.bytes ?? new Uint8Array())).frame;
    expect(fieldById(frame, 'checksum').physicalValue).toBe('invalid');
    expect(frame.valid).toBe(false);
  });

  it('başlangıç baytı yanlışsa start-delimiter-not-found döner', () => {
    const bad = Uint8Array.from([0x00, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);
    expect(expectFailure(customBinaryProtocolParser.parse(bad)).error.code).toBe('start-delimiter-not-found');
  });
});

describe('customBinaryProtocolPlugin', () => {
  it('katalogdaki kimlik ve kategoriyi taşır', () => {
    expect(customBinaryProtocolPlugin.id).toBe('custom-binary-protocol');
    expect(customBinaryProtocolPlugin.category).toBe('interfaces-framing');
  });

  it('encoder çıktısı parser tarafından geçerli olarak geri okunur (round-trip)', () => {
    const wire = customBinaryProtocolPlugin.encoder?.encode({
      address: 7,
      command: 32,
      payload: Uint8Array.from([0x01, 0x02]),
    });
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(customBinaryProtocolParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'address').rawValue).toBe(7);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of customBinaryProtocolPlugin.exampleFrames) {
      const result = customBinaryProtocolParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.customBinaryProtocol.example. önekli çeviri anahtarıdır', () => {
    for (const example of customBinaryProtocolPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.customBinaryProtocol.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.customBinaryProtocol.example.'), example.id).toBe(true);
    }
  });
});
