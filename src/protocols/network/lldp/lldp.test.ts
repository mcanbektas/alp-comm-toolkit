import { describe, expect, it } from 'vitest';

import { lldpParser, lldpPlugin, parseLldp } from './lldp';
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

function tlvHeader(type: number, length: number): number[] {
  return [((type & 0x7f) << 1) | ((length >>> 8) & 0x01), length & 0xff];
}

function textBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

const END_TLV = tlvHeader(0, 0);

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(lldpPlugin.id).toBe('lldp');
    expect(lldpPlugin.category).toBe('network-ethernet');
    expect(lldpPlugin.parser?.protocolId).toBe('lldp');
    expect(lldpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of lldpPlugin.exampleFrames) {
      const result = lldpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.lldp. önekli çeviri anahtarıdır', () => {
    for (const example of lldpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.lldp.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('2 bayttan kısa veriyi reddeder', () => {
    expect(lldpParser.canParse(Uint8Array.from([0x02]))).toBe(false);
  });

  it('2 bayt ve üstünü kabul eder', () => {
    expect(lldpParser.canParse(Uint8Array.from(END_TLV))).toBe(true);
  });
});

describe('Chassis ID / Port ID', () => {
  it('MAC subtype formatMac ile, Interface Name subtype UTF-8 ile çözülür', () => {
    const bytes = Uint8Array.from([
      ...tlvHeader(1, 7),
      4,
      0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e,
      ...tlvHeader(2, 1 + textBytes('eth0').length),
      5,
      ...textBytes('eth0'),
      ...END_TLV,
    ]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'chassis-id-subtype').physicalValue).toBe('MAC Address');
    expect(fieldById(frame, 'chassis-id').rawValue).toBe('00:1A:2B:3C:4D:5E');
    expect(fieldById(frame, 'port-id-subtype').physicalValue).toBe('Interface Name');
    expect(fieldById(frame, 'port-id').rawValue).toBe('eth0');
  });
});

describe('TTL', () => {
  it('2 baytlık saniye değerini çözer', () => {
    const bytes = Uint8Array.from([...tlvHeader(3, 2), 0x00, 0x78, ...END_TLV]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'ttl').rawValue).toBe(120);
    expect(fieldById(frame, 'ttl').unit).toBe('s');
  });
});

describe('System Name / Description / Port Description', () => {
  it('UTF-8 metin olarak çözer', () => {
    const bytes = Uint8Array.from([
      ...tlvHeader(5, textBytes('switch01').length),
      ...textBytes('switch01'),
      ...END_TLV,
    ]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'system-name').rawValue).toBe('switch01');
  });
});

describe('System Capabilities', () => {
  it('bit alanlarını isimlere çözer', () => {
    // 0x0014 = Bridge(bit2) + Router(bit4); enabled 0x0004 = yalnız Bridge.
    const bytes = Uint8Array.from([...tlvHeader(7, 4), 0x00, 0x14, 0x00, 0x04, ...END_TLV]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'system-capabilities').rawValue).toBe(0x14);
    expect(fieldById(frame, 'system-capabilities').physicalValue).toBe('Bridge, Router');
    expect(fieldById(frame, 'system-capabilities-enabled').physicalValue).toBe('Bridge');
  });
});

describe('Management Address', () => {
  it('IPv4 adresini ve Interface Number’ı çözer', () => {
    const bytes = Uint8Array.from([
      ...tlvHeader(8, 12),
      5, 1, 192, 168, 1, 1, 2, 0x00, 0x00, 0x00, 0x01, 0,
      ...END_TLV,
    ]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'management-address-subtype').physicalValue).toBe('IPv4');
    expect(fieldById(frame, 'management-address').rawValue).toBe('192.168.1.1');
    expect(fieldById(frame, 'management-address-interface-subtype').rawValue).toBe(2);
    expect(fieldById(frame, 'management-address-interface-number').rawValue).toBe(1);
    expect(hasField(frame, 'management-address-oid')).toBe(false);
  });
});

describe('Organizationally Specific TLV', () => {
  it('OUI/Subtype ayrıştırılır, veri ham bırakılır', () => {
    const bytes = Uint8Array.from([
      ...tlvHeader(127, 6),
      0x00, 0x80, 0xc2, 0x01, 0xde, 0xad,
      ...END_TLV,
    ]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'organizationally-specific-oui').rawValue).toBe('00:80:C2');
    expect(fieldById(frame, 'organizationally-specific-subtype').rawValue).toBe(1);
    expect(fieldById(frame, 'organizationally-specific-data').rawBytes).toEqual(
      Uint8Array.from([0xde, 0xad]),
    );
  });

  it('ikinci geçişte id’lere -2 eklenir', () => {
    const bytes = Uint8Array.from([
      ...tlvHeader(127, 4),
      0x00, 0x80, 0xc2, 0x01,
      ...tlvHeader(127, 4),
      0x00, 0x80, 0xc2, 0x02,
      ...END_TLV,
    ]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'organizationally-specific-subtype').rawValue).toBe(1);
    expect(fieldById(frame, 'organizationally-specific-subtype-2').rawValue).toBe(2);
  });
});

describe('Tanınmayan TLV türü', () => {
  it('ham bırakılır, HATA değil UYARI basar', () => {
    const bytes = Uint8Array.from([...tlvHeader(50, 2), 0xaa, 0xbb, ...END_TLV]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(fieldById(frame, 'tlv-50').rawBytes).toEqual(Uint8Array.from([0xaa, 0xbb]));
    expect(warningCodes(frame)).toContain('protocol.lldp.warning.unrecognizedTlvType');
    expect(frame.valid).toBe(true);
  });
});

describe('End TLV / uzunluk hataları', () => {
  it('End TLV eksikse missingEndTlv uyarısı basar, frame geçerli kalır', () => {
    const bytes = Uint8Array.from([...tlvHeader(3, 2), 0x00, 0x78]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(warningCodes(frame)).toContain('protocol.lldp.warning.missingEndTlv');
    expect(frame.valid).toBe(true);
  });

  it('End TLV Length≠0 ise uyarı basar ama yürüyüş durur', () => {
    const bytes = Uint8Array.from([...tlvHeader(0, 1), 0x00]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(warningCodes(frame)).toContain('protocol.lldp.warning.endTlvLengthNotZero');
  });

  it('kesik bir TLV truncated-frame ile başarısız kılar', () => {
    const bytes = Uint8Array.from([...tlvHeader(3, 2), 0x00]);
    const { frame } = expectSuccess(parseLldp(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
  });

  it('2 bayttan kısa çerçeve truncated-frame ile ParseResult başarısızlığı üretir', () => {
    const result = expectFailure(parseLldp(Uint8Array.from([0x02])));
    expect(result.error.code).toBe('truncated-frame');
  });
});
