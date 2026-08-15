import { describe, expect, it } from 'vitest';

import { ipv6Parser, ipv6Plugin, parseIpv6 } from './ipv6';
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

const SOURCE = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const DESTINATION = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];

function baseHeader(overrides: {
  nextHeader?: number;
  versionClassFlow?: readonly [number, number, number, number];
  payload?: readonly number[];
} = {}): Uint8Array {
  const versionClassFlow = overrides.versionClassFlow ?? [0x60, 0x00, 0x00, 0x00];
  const nextHeader = overrides.nextHeader ?? 6;
  const payload = overrides.payload ?? [0xaa, 0xbb];
  return Uint8Array.from([
    ...versionClassFlow,
    (payload.length >>> 8) & 0xff,
    payload.length & 0xff,
    nextHeader,
    64,
    ...SOURCE,
    ...DESTINATION,
    ...payload,
  ]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(ipv6Plugin.id).toBe('ipv6');
    expect(ipv6Plugin.category).toBe('network-ethernet');
    expect(ipv6Plugin.parser?.protocolId).toBe('ipv6');
    expect(ipv6Plugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of ipv6Plugin.exampleFrames) {
      const result = ipv6Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ipv6. önekli çeviri anahtarıdır', () => {
    for (const example of ipv6Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ipv6.'), example.id).toBe(true);
    }
  });
});

describe('Version/Traffic Class/Flow Label', () => {
  it('ilk 4 baytı üç alt alana ayrıştırır', () => {
    // 0x6A 0xBC 0xDE 0xF0 → version=6, trafficClass=0xAB, flowLabel=0xCDEF0.
    const { frame } = expectSuccess(ipv6Parser.parse(baseHeader({ versionClassFlow: [0x6a, 0xbc, 0xde, 0xf0] })));
    expect(fieldById(frame, 'version').rawValue).toBe(6);
    expect(fieldById(frame, 'traffic-class').rawValue).toBe(0xab);
    expect(fieldById(frame, 'flow-label').rawValue).toBe(0xcdef0);
  });

  it('Version 6 dışındaki bir değeri hata değil uyarıyla basar', () => {
    const { frame } = expectSuccess(ipv6Parser.parse(baseHeader({ versionClassFlow: [0x40, 0x00, 0x00, 0x00] })));
    expect(fieldById(frame, 'version').rawValue).toBe(4);
    expect(fieldById(frame, 'version').valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.ipv6.warning.unexpectedVersion');
  });
});

describe('Next Header adlandırma (karar 1)', () => {
  it('6/TCP, 17/UDP, 58/ICMPv6 adlandırılır ve üst katman uyarısı basar', () => {
    for (const [value, name] of [[6, 'TCP'], [17, 'UDP'], [58, 'ICMPv6']] as const) {
      const { frame } = expectSuccess(ipv6Parser.parse(baseHeader({ nextHeader: value })));
      const field = fieldById(frame, 'next-header');
      expect(field.physicalValue, String(value)).toBe(name);
      expect(field.valid, String(value)).toBe(true);
      expect(warningCodes(frame)).toContain('protocol.ipv6.warning.nextHeaderHigherLayer');
    }
  });

  it('dar kümede olmayan bir Next Header geçersiz işaretlenir, HATA değil UYARI basar', () => {
    const { frame } = expectSuccess(ipv6Parser.parse(baseHeader({ nextHeader: 253 })));
    const field = fieldById(frame, 'next-header');
    expect(field.valid).toBe(false);
    expect(field.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ipv6.warning.unknownNextHeader');
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('Adresler', () => {
  it('16 baytı 8 grup hex olarak biçimlendirir', () => {
    const { frame } = expectSuccess(ipv6Parser.parse(baseHeader()));
    expect(fieldById(frame, 'source-address').rawValue).toBe('2001:db8:0:0:0:0:0:1');
    expect(fieldById(frame, 'destination-address').rawValue).toBe('2001:db8:0:0:0:0:0:2');
  });
});

describe('Checksum — alan yok, N/A', () => {
  it('bayt tüketmeyen bilgi alanı üretir', () => {
    const { frame } = expectSuccess(ipv6Parser.parse(baseHeader()));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.physicalValue).toBe('N/A');
    expect(checksum.length).toBe(0);
  });
});

describe('Extension header zinciri', () => {
  it('bilinen bir uzantı başlığını atlar ve terminal üst katmanı adlandırır', () => {
    const bytes = Uint8Array.from([
      ...baseHeader({ nextHeader: 0, payload: [] }).slice(0, 40),
      17, 0, 0, 0, 0, 0, 0, 0, // Hop-by-Hop, HdrExtLen=0 → 8 bayt, next=UDP
      0x01, 0x02, 0x03, 0x04,
    ]);
    const { frame } = expectSuccess(ipv6Parser.parse(bytes));
    expect(fieldById(frame, 'next-header').physicalValue).toBe('Hop-by-Hop Options');
    const ext = fieldById(frame, 'ext-header-1');
    expect(ext.offset).toBe(40);
    expect(ext.length).toBe(8);
    expect(ext.physicalValue).toBe('UDP');
    expect(warningCodes(frame)).toContain('protocol.ipv6.warning.nextHeaderHigherLayer');
    const payload = fieldById(frame, 'payload');
    expect(payload.offset).toBe(48);
    expect(Array.from(payload.rawBytes)).toEqual([0x01, 0x02, 0x03, 0x04]);
  });

  it('bilinmeyen bir uzantı başlığında zincir DURUR + uyarı (sonsuz döngü koruması)', () => {
    const bytes = Uint8Array.from([
      ...baseHeader({ nextHeader: 0, payload: [] }).slice(0, 40),
      0xfd, 0x00, 0, 0, 0, 0, 0, 0, // Hop-by-Hop → next=253 (bilinmiyor)
    ]);
    const { frame } = expectSuccess(ipv6Parser.parse(bytes));
    const ext = fieldById(frame, 'ext-header-1');
    expect(ext.valid).toBe(false);
    expect(hasField(frame, 'ext-header-2')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ipv6.warning.unknownNextHeader');
  });

  it('8’den fazla uzantı başlığı zincirinde tavana ulaşınca durur ve uyarı basar', () => {
    // 9 art arda Hop-by-Hop (8 bayt): ilk 8’i birbirine, sonuncusu TCP’ye işaret eder.
    const segments: number[] = [];
    for (let i = 0; i < 8; i++) {
      segments.push(0, 0, 0, 0, 0, 0, 0, 0); // next=Hop-by-Hop(0), HdrExtLen=0
    }
    segments.push(6, 0, 0, 0, 0, 0, 0, 0); // 9. segment: next=TCP (asla TÜKETİLMEZ)
    const bytes = Uint8Array.from([...baseHeader({ nextHeader: 0, payload: [] }).slice(0, 40), ...segments]);
    const { frame } = expectSuccess(ipv6Parser.parse(bytes));
    expect(hasField(frame, 'ext-header-8')).toBe(true);
    expect(hasField(frame, 'ext-header-9')).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.ipv6.warning.tooManyExtensionHeaders');
    // 9. segment TÜKETİLMEDİĞİ için ham payload'a düşer.
    const payload = fieldById(frame, 'payload');
    expect(payload.rawBytes.length).toBe(8);
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('yalnız uzunluk + Version nibble 6 olan veriyi kabul eder', () => {
    expect(ipv6Parser.canParse(baseHeader())).toBe(true);
    expect(ipv6Parser.canParse(baseHeader({ versionClassFlow: [0x40, 0, 0, 0] }))).toBe(false);
    expect(ipv6Parser.canParse(Uint8Array.from([0x60, 0x00]))).toBe(false);
  });
});

describe('başlık/uzunluk hataları', () => {
  it('40 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(ipv6Parser.parse(Uint8Array.from([0x60, 0x00, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const result = expectFailure(ipv6Parser.parse(baseHeader(), { maxFrameLength: 10 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseIpv6 kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseIpv6(baseHeader()));
    expect(frame.protocol).toBe('ipv6');
  });
});
