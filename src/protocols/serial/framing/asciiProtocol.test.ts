import { describe, expect, it } from 'vitest';

import { asciiProtocolParser, asciiProtocolPlugin } from './asciiProtocol';
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

function ascii(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
}

describe('asciiProtocolParser', () => {
  it('"TEMP,25.3,40.2\\r\\n" — command/parameters/lineEnding ayrı alanlara çözülür', () => {
    const frame = expectSuccess(asciiProtocolParser.parse(ascii('TEMP,25.3,40.2\r\n'))).frame;
    expect(fieldById(frame, 'command').rawValue).toBe('TEMP');
    expect(fieldById(frame, 'parameters').rawValue).toBe(',25.3,40.2');
    expect(frame.valid).toBe(true);
  });

  it('CRLF kesikse hata döner (Missing CR/LF durumu)', () => {
    const result = expectFailure(asciiProtocolParser.parse(ascii('TEMP,25.3,40.2')));
    expect(result.error.code).toBe('truncated-frame');
  });

  it('canParse dolu girdide true döner', () => {
    expect(asciiProtocolParser.canParse(ascii('TEMP,25.3,40.2\r\n'))).toBe(true);
  });
});

describe('asciiProtocolPlugin', () => {
  it('katalogdaki kimlik ve kategoriyi taşır', () => {
    expect(asciiProtocolPlugin.id).toBe('ascii-protocol');
    expect(asciiProtocolPlugin.category).toBe('interfaces-framing');
  });

  it('encoder çıktısı parser tarafından geçerli olarak geri okunur (round-trip)', () => {
    const wire = asciiProtocolPlugin.encoder?.encode({ command: 'READ', parameters: ':TEMP,0.0' });
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(asciiProtocolParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'command').rawValue).toBe('READ');
  });

  it('her örnek çözülür (başarısız olması beklenenler dahil) ve expectedValid ile eşleşir', () => {
    for (const example of asciiProtocolPlugin.exampleFrames) {
      const result = asciiProtocolParser.parse(example.bytes);
      const valid = result.success ? result.frame.valid : false;
      expect(valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.asciiProtocol.example. önekli çeviri anahtarıdır', () => {
    for (const example of asciiProtocolPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.asciiProtocol.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.asciiProtocol.example.'), example.id).toBe(true);
    }
  });
});
