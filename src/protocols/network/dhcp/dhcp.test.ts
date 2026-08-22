import { describe, expect, it } from 'vitest';

import { dhcpParser, dhcpPlugin, parseDhcp } from './dhcp';
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

function exampleById(id: string) {
  const example = dhcpPlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) throw new Error(`example "${id}" missing`);
  return example;
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(dhcpPlugin.id).toBe('dhcp');
    expect(dhcpPlugin.category).toBe('network-ethernet');
    expect(dhcpPlugin.parser?.protocolId).toBe('dhcp');
    expect(dhcpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of dhcpPlugin.exampleFrames) {
      const result = dhcpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.dhcp. önekli çeviri anahtarıdır', () => {
    for (const example of dhcpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.dhcp.'), example.id).toBe(true);
    }
  });
});

describe('canParse / uzunluk hataları', () => {
  it('236 bayttan kısa veriyi reddeder', () => {
    expect(dhcpParser.canParse(Uint8Array.from([1, 1, 6, 0]))).toBe(false);
    const result = expectFailure(parseDhcp(Uint8Array.from([1, 1, 6, 0])));
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('DHCPDISCOVER', () => {
  it('op/htype/chaddr ve Message Type=DISCOVER’ı çözer', () => {
    const { frame } = expectSuccess(parseDhcp(exampleById('discover').bytes));
    expect(fieldById(frame, 'op').physicalValue).toBe('BOOTREQUEST');
    expect(fieldById(frame, 'htype').physicalValue).toBe('Ethernet');
    expect(fieldById(frame, 'chaddr').rawValue).toBe('00:11:22:33:44:55');
    expect(fieldById(frame, 'option-53').physicalValue).toBe('DHCPDISCOVER');
    expect(frame.valid).toBe(true);
  });
});

describe('DHCPOFFER', () => {
  it('yiaddr/siaddr ve seçenekleri (Subnet Mask/Router/Lease Time/Server Id) çözer', () => {
    const { frame } = expectSuccess(parseDhcp(exampleById('offer').bytes));
    expect(fieldById(frame, 'op').physicalValue).toBe('BOOTREPLY');
    expect(fieldById(frame, 'yiaddr').rawValue).toBe('192.168.1.100');
    expect(fieldById(frame, 'option-53').physicalValue).toBe('DHCPOFFER');
    expect(fieldById(frame, 'option-1').rawValue).toBe('255.255.255.0');
    expect(fieldById(frame, 'option-3').rawValue).toBe('192.168.1.1');
    expect(fieldById(frame, 'option-51').rawValue).toBe(3600);
    expect(fieldById(frame, 'option-51').unit).toBe('s');
    expect(fieldById(frame, 'option-54').rawValue).toBe('192.168.1.1');
  });
});

describe('Tanınmayan Message Type', () => {
  it('geçersiz işaretler, HATA değil UYARI basar', () => {
    const { frame } = expectSuccess(parseDhcp(exampleById('unknown-message-type').bytes));
    expect(fieldById(frame, 'option-53').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dhcp.warning.unknownMessageType');
    expect(frame.valid).toBe(true);
  });
});

describe('Magic Cookie', () => {
  it('bozuk cookie value-out-of-range basar, options işlenmez', () => {
    const { frame } = expectSuccess(parseDhcp(exampleById('bad-magic-cookie').bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(hasField(frame, 'option-53')).toBe(false);
  });

  it('cookie/options olmayan klasik BOOTP’ta hata üretmez', () => {
    const bootpOnly = exampleById('discover').bytes.slice(0, 236);
    const { frame } = expectSuccess(parseDhcp(bootpOnly));
    expect(frame.valid).toBe(true);
    expect(hasField(frame, 'magic-cookie')).toBe(false);
  });
});

describe('End option eksikliği', () => {
  it('End(255) yoksa UYARI basar, HATA basmaz', () => {
    const bytes = exampleById('discover').bytes;
    const withoutEnd = bytes.slice(0, bytes.length - 1);
    const { frame } = expectSuccess(parseDhcp(withoutEnd));
    expect(warningCodes(frame)).toContain('protocol.dhcp.warning.missingEndOption');
    expect(frame.valid).toBe(true);
  });
});
