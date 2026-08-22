import { describe, expect, it } from 'vitest';

import { parseTelnet, telnetParser, telnetPlugin } from './telnet';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

const IAC = 0xff;
const SE = 240;
const NOP = 241;
const AYT = 246;
const SB = 250;
const WILL = 251;
const DO = 253;

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

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(telnetPlugin.id).toBe('telnet');
    expect(telnetPlugin.category).toBe('network-ethernet');
    expect(telnetPlugin.parser?.protocolId).toBe('telnet');
    expect(telnetPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of telnetPlugin.exampleFrames) {
      const result = telnetParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.telnet. önekli çeviri anahtarıdır', () => {
    for (const example of telnetPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.telnet.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.telnet.'), example.id).toBe(true);
    }
  });
});

describe('canParse', () => {
  it('boş girdiyi reddeder', () => {
    expect(telnetParser.canParse(Uint8Array.from([]))).toBe(false);
  });

  it('en az 1 baytı kabul eder', () => {
    expect(telnetParser.canParse(Uint8Array.from([0x41]))).toBe(true);
  });
});

describe('Metin/IAC yürüyüşü', () => {
  it('düz metni Text alanı olarak basar', () => {
    const bytes = Uint8Array.from(ascii('hello'));
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(fieldById(frame, 'text-0').physicalValue).toBe('hello');
  });

  it('IAC DO ECHO tek komutun kendi anlamıyla gösterilir (çapraz-korelasyon yok)', () => {
    const bytes = Uint8Array.from([IAC, DO, 1, ...ascii('login: ')]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    const negotiation = fieldById(frame, 'negotiation-0');
    expect(negotiation.name).toBe('IAC DO');
    expect(negotiation.rawValue).toBe(1);
    expect(negotiation.physicalValue).toBe('Requests the peer to enable ECHO');
    expect(fieldById(frame, 'text-3').physicalValue).toBe('login: ');
  });

  it('bilinmeyen option kodu için "option N" düşer, hata basmaz', () => {
    const bytes = Uint8Array.from([IAC, WILL, 200]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(fieldById(frame, 'negotiation-0').physicalValue).toBe('Offers/confirms to enable option 200');
  });

  it('SB…SE arasını option kodu + ham veriye ayırır', () => {
    const bytes = Uint8Array.from([IAC, SB, 24, 0, ...ascii('VT100'), IAC, SE]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(fieldById(frame, 'subnegotiation-option-0').physicalValue).toBe('TERMINAL TYPE');
    const subData = fieldById(frame, 'subnegotiation-data-3');
    expect(Array.from(subData.rawBytes)).toEqual([0, ...ascii('VT100')]);
  });

  it('SB verisi içindeki kaçışlı IAC IAC, SE ile karıştırılmaz', () => {
    // SB option 5, veri = [IAC IAC] (literal 0xFF), sonra gerçek IAC SE.
    const bytes = Uint8Array.from([IAC, SB, 5, IAC, IAC, IAC, SE]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(frame.valid).toBe(true);
    const subData = fieldById(frame, 'subnegotiation-data-3');
    expect(Array.from(subData.rawBytes)).toEqual([IAC, IAC]);
  });

  it('kaçışlı literal 0xFF, komşu metin koşularından AYRI bir alan olarak görünür', () => {
    const bytes = Uint8Array.from([0x41, IAC, IAC, 0x42]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(fieldById(frame, 'text-0').physicalValue).toBe('A');
    expect(fieldById(frame, 'escaped-ff-1').rawValue).toBe(0xff);
    expect(fieldById(frame, 'text-3').physicalValue).toBe('B');
  });

  it('bağımsız komutları (ör. AYT) 2 baytlık alan olarak basar', () => {
    const bytes = Uint8Array.from([IAC, AYT]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(fieldById(frame, 'command-0').name).toBe('IAC AYT (Are You There)');
  });

  it('tekli IAC (sonrasında bayt yok) truncated-frame basar', () => {
    const bytes = Uint8Array.from([...ascii('hi'), IAC]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'text-0').physicalValue).toBe('hi');
  });

  it('IAC WILL ardından option baytı gelmeden biterse truncated-frame basar', () => {
    const bytes = Uint8Array.from([IAC, WILL]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(frame.valid).toBe(false);
  });

  it('IAC SB kapanmadan (IAC SE hiç gelmeden) biterse truncated-frame basar', () => {
    const bytes = Uint8Array.from([IAC, SB, 24, ...ascii('VT100')]);
    const { frame } = expectSuccess(telnetParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.telnet.error.subnegotiationUnterminated');
  });
});

describe('Plaintext güvenlik uyarısı', () => {
  it('her başarılı çözümde sabit olarak basılır', () => {
    const { frame } = expectSuccess(telnetParser.parse(Uint8Array.from(ascii('hi'))));
    expect(warningCodes(frame)).toContain('protocol.telnet.warning.plaintextProtocol');
  });

  it('NOP gibi tamamen boş içerikte de basılır', () => {
    const { frame } = expectSuccess(telnetParser.parse(Uint8Array.from([IAC, NOP])));
    expect(warningCodes(frame)).toContain('protocol.telnet.warning.plaintextProtocol');
    expect(hasField(frame, 'text-0')).toBe(false);
  });
});

describe('Boş girdi', () => {
  it('truncated-frame ile başarısız olur', () => {
    const { error } = expectFailure(telnetParser.parse(Uint8Array.from([])));
    expect(error.code).toBe('truncated-frame');
  });
});

describe('parseTelnet yardımcı fonksiyonu', () => {
  it('bağlamsız çağrıda parser ile aynı alanları üretir', () => {
    const bytes = Uint8Array.from([IAC, DO, 1]);
    const { frame } = expectSuccess(parseTelnet(bytes));
    expect(frame.fields).toEqual(expectSuccess(telnetParser.parse(bytes)).frame.fields);
  });
});
