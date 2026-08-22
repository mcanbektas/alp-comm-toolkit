import { describe, expect, it } from 'vitest';

import { arpParser, arpPlugin, parseArp } from './arp';
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

/** Ethernet/IPv4 ARP Request — spec'in "Who has 192.168.1.20? Tell 192.168.1.10" örneği. */
function arpRequest(operation = 1): Uint8Array {
  return Uint8Array.from([
    0x00, 0x01, // Hardware Type = Ethernet
    0x08, 0x00, // Protocol Type = IPv4
    6, // Hardware Length
    4, // Protocol Length
    (operation >>> 8) & 0xff, operation & 0xff,
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, // Sender Hardware
    192, 168, 1, 10, // Sender Protocol
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Target Hardware
    192, 168, 1, 20, // Target Protocol
  ]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(arpPlugin.id).toBe('arp');
    expect(arpPlugin.category).toBe('network-ethernet');
    expect(arpPlugin.parser?.protocolId).toBe('arp');
    expect(arpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of arpPlugin.exampleFrames) {
      const result = arpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.arp. önekli çeviri anahtarıdır', () => {
    for (const example of arpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.arp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('8 bayttan kısa veriyi reddeder', () => {
    expect(arpParser.canParse(Uint8Array.from([0, 1, 8, 0, 6, 4]))).toBe(false);
  });

  it('8 bayt ve üstünü kabul eder', () => {
    expect(arpParser.canParse(arpRequest())).toBe(true);
  });
});

describe('uzunluk hataları', () => {
  it('8 bayttan kısa çerçeve truncated-frame ile başarısız olur', () => {
    const result = expectFailure(parseArp(Uint8Array.from([0, 1, 8, 0, 6, 4])));
    expect(result.error.code).toBe('truncated-frame');
  });

  it('Hardware/Protocol Length’in bildirdiğinden kısa tampon addressesTruncated hatası üretir', () => {
    const bytes = arpRequest().slice(0, 20);
    const { frame } = expectSuccess(parseArp(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'sender-hardware-address')).toBe(false);
  });
});

describe('Ethernet/IPv4 adresleri', () => {
  it('MAC ve dotted-decimal adresleri okunur biçimde gösterir', () => {
    const { frame } = expectSuccess(parseArp(arpRequest()));
    expect(fieldById(frame, 'sender-hardware-address').rawValue).toBe('00:11:22:33:44:55');
    expect(fieldById(frame, 'sender-protocol-address').rawValue).toBe('192.168.1.10');
    expect(fieldById(frame, 'target-protocol-address').rawValue).toBe('192.168.1.20');
    expect(fieldById(frame, 'hardware-type').physicalValue).toBe('Ethernet');
    expect(fieldById(frame, 'protocol-type').physicalValue).toBe('IPv4');
  });

  it('Ethernet dışı bir kombinasyonda adresler ham bırakılır (rawValue yok)', () => {
    const bytes = Uint8Array.from([
      0x00, 0x06, // Hardware Type = 6 (IEEE 802, örnek)
      0x08, 0x00,
      8, // Hardware Length = 8 (MAC değil)
      4,
      0x00, 0x01,
      1, 2, 3, 4, 5, 6, 7, 8,
      10, 0, 0, 1,
      0, 0, 0, 0, 0, 0, 0, 0,
      10, 0, 0, 2,
    ]);
    const { frame } = expectSuccess(parseArp(bytes));
    expect(fieldById(frame, 'sender-hardware-address').rawValue).toBeUndefined();
    expect(fieldById(frame, 'sender-hardware-address').rawBytes).toEqual(
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
    );
  });
});

describe('Operation', () => {
  it('Reply(2) doğru adlandırılır', () => {
    const { frame } = expectSuccess(parseArp(arpRequest(2)));
    expect(fieldById(frame, 'operation').physicalValue).toBe('Reply');
    expect(fieldById(frame, 'operation').valid).toBe(true);
  });

  it('dar kümenin dışındaki bir Operation uyarı üretir ama frame geçerli kalır', () => {
    const { frame } = expectSuccess(parseArp(arpRequest(5)));
    expect(fieldById(frame, 'operation').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.arp.warning.unknownOperation');
    expect(frame.valid).toBe(true);
  });
});

describe('Padding', () => {
  it('28 bayttan fazlası Padding alanına düşer', () => {
    const bytes = Uint8Array.from([...arpRequest(), ...new Array<number>(10).fill(0)]);
    const { frame } = expectSuccess(parseArp(bytes));
    expect(fieldById(frame, 'padding').length).toBe(10);
  });

  it('fazladan bayt yoksa Padding alanı üretilmez', () => {
    const { frame } = expectSuccess(parseArp(arpRequest()));
    expect(hasField(frame, 'padding')).toBe(false);
  });
});
