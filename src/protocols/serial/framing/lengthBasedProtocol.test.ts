import { describe, expect, it } from 'vitest';

import { lengthBasedProtocolParser, lengthBasedProtocolPlugin } from './lengthBasedProtocol';
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

describe('lengthBasedProtocolParser', () => {
  it('LENGTH (BE) doğru payload uzunluğunu belirler, checksum PASS', () => {
    const frame = expectSuccess(lengthBasedProtocolParser.parse(Uint8Array.from([0x00, 0x04, 0xaa, 0xbb, 0xcc, 0xdd, 0x00]))).frame;
    expect(fieldById(frame, 'length').rawValue).toBe(4);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd]));
    expect(fieldById(frame, 'checksum').physicalValue).toBe('valid');
    expect(frame.valid).toBe(true);
  });

  it('bozuk checksum: frame.valid=false', () => {
    const frame = expectSuccess(lengthBasedProtocolParser.parse(Uint8Array.from([0x00, 0x04, 0xaa, 0xbb, 0xcc, 0xdd, 0xff]))).frame;
    expect(frame.valid).toBe(false);
  });

  it('declared length gerçek veriyle tutarsızsa truncated-frame döner ("payload" alanı çerçeveyi aşıyor)', () => {
    const result = expectFailure(lengthBasedProtocolParser.parse(Uint8Array.from([0x03, 0xe8, 0xaa])));
    expect(result.error.code).toBe('truncated-frame');
  });

  it('endianness büyük-uçlu: 00 04 küçük-uçlu yorumlansaydı 1024 çıkardı, BE 4 çıkarıyor', () => {
    const frame = expectSuccess(lengthBasedProtocolParser.parse(Uint8Array.from([0x00, 0x04, 0xaa, 0xbb, 0xcc, 0xdd, 0x00]))).frame;
    expect(fieldById(frame, 'length').rawValue).toBe(4);
    expect(fieldById(frame, 'length').rawValue).not.toBe(1024);
  });
});

describe('lengthBasedProtocolPlugin', () => {
  it('katalogdaki kimlik ve kategoriyi taşır', () => {
    expect(lengthBasedProtocolPlugin.id).toBe('length-based-protocol');
    expect(lengthBasedProtocolPlugin.category).toBe('interfaces-framing');
  });

  it('encoder çıktısı parser tarafından geçerli olarak geri okunur (round-trip)', () => {
    const wire = lengthBasedProtocolPlugin.encoder?.encode({ payload: Uint8Array.from([0x01, 0x02, 0x03]) });
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(lengthBasedProtocolParser.parse(wire)).frame;
    expect(frame.valid).toBe(true);
  });

  it('her örnek çözülür (başarısız olması beklenenler dahil) ve expectedValid ile eşleşir', () => {
    for (const example of lengthBasedProtocolPlugin.exampleFrames) {
      const result = lengthBasedProtocolParser.parse(example.bytes);
      const valid = result.success ? result.frame.valid : false;
      expect(valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.lengthBasedProtocol.example. önekli çeviri anahtarıdır', () => {
    for (const example of lengthBasedProtocolPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.lengthBasedProtocol.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.lengthBasedProtocol.example.'), example.id).toBe(true);
    }
  });
});
