import { describe, expect, it } from 'vitest';

import { icmpParser, icmpPlugin, parseIcmp } from './icmp';
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

/** Checksum'ı doğru hesaplanmış Echo Request — internetChecksum.ts'in kendi
 * algoritmasıyla bağımsız üretildi (görev betiği), 0x5A60. */
function echoRequest(overrides: { checksum?: number; identifier?: number; sequence?: number } = {}): Uint8Array {
  const checksum = overrides.checksum ?? 0x5a60;
  return Uint8Array.from([
    8,
    0,
    (checksum >>> 8) & 0xff,
    checksum & 0xff,
    ((overrides.identifier ?? 0x0001) >>> 8) & 0xff,
    (overrides.identifier ?? 0x0001) & 0xff,
    ((overrides.sequence ?? 0x0001) >>> 8) & 0xff,
    (overrides.sequence ?? 0x0001) & 0xff,
    0xde,
    0xad,
    0xbe,
    0xef,
  ]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(icmpPlugin.id).toBe('icmp');
    expect(icmpPlugin.category).toBe('network-ethernet');
    expect(icmpPlugin.parser?.protocolId).toBe('icmp');
    expect(icmpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of icmpPlugin.exampleFrames) {
      const result = icmpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.icmp. önekli çeviri anahtarıdır', () => {
    for (const example of icmpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.icmp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('8 bayttan kısa veriyi reddeder', () => {
    expect(icmpParser.canParse(Uint8Array.from([8, 0, 0, 0]))).toBe(false);
  });

  it('8 bayt ve üstünü kabul eder', () => {
    expect(icmpParser.canParse(echoRequest())).toBe(true);
  });
});

describe('uzunluk hataları', () => {
  it('8 bayttan kısa çerçeve truncated-frame ile başarısız olur', () => {
    const result = expectFailure(parseIcmp(Uint8Array.from([8, 0, 0, 0])));
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('Type / Code', () => {
  it('Echo Request (8) doğru adlandırılır', () => {
    const { frame } = expectSuccess(parseIcmp(echoRequest()));
    expect(fieldById(frame, 'type').rawValue).toBe(8);
    expect(fieldById(frame, 'type').physicalValue).toBe('Echo Request');
    expect(fieldById(frame, 'type').valid).toBe(true);
  });

  it('dar kümenin dışındaki bir Type uyarı üretir ama frame geçerli kalır', () => {
    const bytes = Uint8Array.from([30, 0, 0xe1, 0xff, 0x00, 0x00, 0x00, 0x00]);
    const { frame } = expectSuccess(parseIcmp(bytes));
    expect(fieldById(frame, 'type').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.icmp.warning.unknownType');
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'message-body').rawBytes).toEqual(Uint8Array.from([0, 0, 0, 0]));
  });

  it('Destination Unreachable Code=3 (Port Unreachable) adlandırılır', () => {
    const bytes = Uint8Array.from([3, 3, 0xb7, 0xe0, 0, 0, 0, 0, 0x45, 0x00, 0x00, 0x1c, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmp(bytes));
    expect(fieldById(frame, 'code').physicalValue).toBe('Port Unreachable');
    expect(fieldById(frame, 'unused').rawBytes.length).toBe(4);
    expect(fieldById(frame, 'original-datagram').length).toBe(8);
  });

  it('bilinen Type ama dar kümenin dışındaki bir Code uyarı üretir', () => {
    const bytes = Uint8Array.from([3, 15, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmp(bytes));
    expect(fieldById(frame, 'code').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.icmp.warning.unknownCode');
  });

  it('Time Exceeded Code=0 (TTL Exceeded in Transit) adlandırılır', () => {
    const bytes = Uint8Array.from([11, 0, 0xf4, 0xff, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmp(bytes));
    expect(fieldById(frame, 'code').physicalValue).toBe('TTL Exceeded in Transit');
  });
});

describe('Echo — Identifier/Sequence/Data', () => {
  it('Identifier, Sequence Number ve Data alanlarını ayrıştırır', () => {
    const { frame } = expectSuccess(parseIcmp(echoRequest({ identifier: 0x1234, sequence: 0x0002 })));
    expect(fieldById(frame, 'identifier').rawValue).toBe(0x1234);
    expect(fieldById(frame, 'sequence-number').rawValue).toBe(0x0002);
    expect(fieldById(frame, 'data').rawBytes).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
  });

  it('veri olmadan Data alanı üretilmez', () => {
    const bytes = Uint8Array.from([0, 0, 0xff, 0xfd, 0, 1, 0, 1]);
    const { frame } = expectSuccess(parseIcmp(bytes));
    expect(hasField(frame, 'data')).toBe(false);
  });
});

describe('Checksum', () => {
  it('mesajın tamamını kapsayan doğru checksum PASS verir', () => {
    const { frame } = expectSuccess(parseIcmp(echoRequest()));
    expect(fieldById(frame, 'checksum').valid).toBe(true);
    expect(fieldById(frame, 'checksum').physicalValue).toBe('Valid');
  });

  it('bozuk checksum checksum-mismatch üretir ve frame’i geçersiz kılar', () => {
    const { frame } = expectSuccess(parseIcmp(echoRequest({ checksum: 0x0000 })));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'checksum').valid).toBe(false);
  });
});
