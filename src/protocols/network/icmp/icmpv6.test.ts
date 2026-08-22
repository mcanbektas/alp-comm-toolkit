import { describe, expect, it } from 'vitest';

import { icmpv6Parser, icmpv6Plugin, parseIcmpv6 } from './icmpv6';
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

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(icmpv6Plugin.id).toBe('icmpv6');
    expect(icmpv6Plugin.category).toBe('network-ethernet');
    expect(icmpv6Plugin.parser?.protocolId).toBe('icmpv6');
    expect(icmpv6Plugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of icmpv6Plugin.exampleFrames) {
      const result = icmpv6Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.icmpv6. önekli çeviri anahtarıdır', () => {
    for (const example of icmpv6Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.icmpv6.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('8 bayttan kısa veriyi reddeder', () => {
    expect(icmpv6Parser.canParse(Uint8Array.from([128, 0, 0, 0]))).toBe(false);
  });

  it('8 bayt ve üstünü kabul eder', () => {
    expect(icmpv6Parser.canParse(Uint8Array.from([128, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
  });
});

describe('uzunluk hataları', () => {
  it('8 bayttan kısa çerçeve truncated-frame ile başarısız olur', () => {
    const result = expectFailure(parseIcmpv6(Uint8Array.from([128, 0, 0, 0])));
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('Type / Code', () => {
  it('Echo Request (128) doğru adlandırılır', () => {
    const bytes = Uint8Array.from([128, 0, 0, 0, 0, 1, 0, 1]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'type').physicalValue).toBe('Echo Request');
    expect(fieldById(frame, 'type').valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.icmpv6.warning.neighborDiscoveryDeferred');
  });

  it('Neighbor Discovery tipi (Router Solicitation) adlandırılır ama ertelenir', () => {
    const bytes = Uint8Array.from([133, 0, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'type').physicalValue).toBe('Router Solicitation');
    expect(fieldById(frame, 'type').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.icmpv6.warning.neighborDiscoveryDeferred');
    expect(fieldById(frame, 'message-body').rawBytes).toEqual(Uint8Array.from([0, 0, 0, 0]));
  });

  it('dar kümenin dışındaki bir Type uyarı üretir ama frame geçerli kalır', () => {
    const bytes = Uint8Array.from([200, 0, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'type').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.icmpv6.warning.unknownType');
    expect(frame.valid).toBe(true);
  });

  it('Destination Unreachable Code=4 (Port Unreachable) adlandırılır', () => {
    const bytes = Uint8Array.from([1, 4, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'code').physicalValue).toBe('Port Unreachable');
  });

  it('bilinen Type ama dar kümenin dışındaki bir Code uyarı üretir', () => {
    const bytes = Uint8Array.from([1, 200, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'code').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.icmpv6.warning.unknownCode');
  });
});

describe('Packet Too Big — MTU', () => {
  it('4 baytlık MTU alanını çözer (Path MTU Discovery)', () => {
    // MTU = 1280 (0x00000500) — IPv6 asgari zorunlu MTU.
    const bytes = Uint8Array.from([2, 0, 0, 0, 0x00, 0x00, 0x05, 0x00]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'mtu').rawValue).toBe(1280);
    expect(fieldById(frame, 'mtu').unit).toBe('B');
  });
});

describe('Parameter Problem — Pointer', () => {
  it('4 baytlık (32-bit) Pointer alanını çözer', () => {
    const bytes = Uint8Array.from([4, 0, 0, 0, 0x00, 0x00, 0x00, 0x28]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'pointer').rawValue).toBe(40);
  });
});

describe('Invoking Packet', () => {
  it('hata mesajlarında offset 8’den sonrası invoking packet olarak gösterilir', () => {
    const bytes = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 0x60, 0x00, 0x00, 0x00]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'invoking-packet').rawBytes).toEqual(Uint8Array.from([0x60, 0x00, 0x00, 0x00]));
  });

  it('fazladan bayt yoksa invoking packet alanı üretilmez', () => {
    const bytes = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(hasField(frame, 'invoking-packet')).toBe(false);
  });
});

describe('Echo — Identifier/Sequence/Data', () => {
  it('Identifier, Sequence Number ve Data alanlarını ayrıştırır', () => {
    const bytes = Uint8Array.from([129, 0, 0, 0, 0x12, 0x34, 0x00, 0x02, 0xde, 0xad]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    expect(fieldById(frame, 'identifier').rawValue).toBe(0x1234);
    expect(fieldById(frame, 'sequence-number').rawValue).toBe(0x0002);
    expect(fieldById(frame, 'data').rawBytes).toEqual(Uint8Array.from([0xde, 0xad]));
  });
});

describe('Checksum', () => {
  it('pseudo-header istediği için her zaman valid:true ile ham gösterilir', () => {
    const bytes = Uint8Array.from([128, 0, 0x12, 0x34, 0, 1, 0, 1]);
    const { frame } = expectSuccess(parseIcmpv6(bytes));
    const checksumField = fieldById(frame, 'checksum');
    expect(checksumField.valid).toBe(true);
    expect(checksumField.rawValue).toBe(0x1234);
    expect(checksumField.warnings).toContain('protocol.icmpv6.warning.checksumNeedsPseudoHeader');
    expect(frame.errors.some((error) => error.code === 'checksum-mismatch')).toBe(false);
  });
});
