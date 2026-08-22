import { describe, expect, it } from 'vitest';

import { buildDnsMessage, encodeDomainName, parseDnsMessage } from './dnsWire';
import type { ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
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

const TYPE_A = 1;
const TYPE_CNAME = 5;
const TYPE_MX = 15;
const TYPE_TXT = 16;
const TYPE_AAAA = 28;
const TYPE_SRV = 33;
const TYPE_SOA = 6;
const CLASS_IN = 1;

function parseDns(data: Uint8Array): ParseResult {
  return parseDnsMessage(data, { protocolId: 'dns', variant: 'dns' });
}

function parseMdns(data: Uint8Array): ParseResult {
  return parseDnsMessage(data, { protocolId: 'mdns', variant: 'mdns' });
}

describe('uzunluk hataları', () => {
  it('12 bayttan kısa çerçeve truncated-frame ile başarısız olur', () => {
    const result = parseDns(Uint8Array.from([0, 0, 0, 0]));
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('Header', () => {
  it('flags alt alanlarını doğru ayırır (spec örneği 0x8180)', () => {
    const bytes = buildDnsMessage({ id: 0x1234, flags: 0x8180 });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(fieldById(frame, 'flags-qr').rawValue).toBe(1);
    expect(fieldById(frame, 'flags-qr').physicalValue).toBe('Response');
    expect(fieldById(frame, 'flags-opcode').rawValue).toBe(0);
    expect(fieldById(frame, 'flags-opcode').physicalValue).toBe('QUERY');
    expect(fieldById(frame, 'flags-aa').rawValue).toBe(0);
    expect(fieldById(frame, 'flags-rd').rawValue).toBe(1);
    expect(fieldById(frame, 'flags-ra').rawValue).toBe(1);
    expect(fieldById(frame, 'flags-rcode').rawValue).toBe(0);
    expect(fieldById(frame, 'flags-rcode').physicalValue).toBe('NOERROR');
  });

  it('RCODE=3 NXDOMAIN adlandırılır', () => {
    const bytes = buildDnsMessage({ id: 1, flags: 0x8183 });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(fieldById(frame, 'flags-rcode').physicalValue).toBe('NXDOMAIN');
  });
});

describe('Question', () => {
  it('QNAME/QTYPE/QCLASS’ı çözer', () => {
    const bytes = buildDnsMessage({
      id: 1,
      flags: 0x0100,
      questions: [{ name: { labels: ['example', 'com'] }, type: TYPE_A, class: CLASS_IN }],
    });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(fieldById(frame, 'question-1-name').rawValue).toBe('example.com');
    expect(fieldById(frame, 'question-1-type').physicalValue).toBe('A');
    expect(fieldById(frame, 'question-1-class').physicalValue).toBe('IN');
  });

  it('birden çok soru 1-indexli alan id’leri üretir', () => {
    const bytes = buildDnsMessage({
      id: 1,
      flags: 0,
      questions: [
        { name: { labels: ['a', 'com'] }, type: TYPE_A, class: CLASS_IN },
        { name: { labels: ['b', 'com'] }, type: TYPE_A, class: CLASS_IN },
      ],
    });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(fieldById(frame, 'question-1-name').rawValue).toBe('a.com');
    expect(fieldById(frame, 'question-2-name').rawValue).toBe('b.com');
  });
});

describe('İsim sıkıştırması', () => {
  it('0xC00C pointer’ını soru adına doğru çözer (spec örneği)', () => {
    const bytes = buildDnsMessage({
      id: 1,
      flags: 0x8180,
      questions: [{ name: { labels: ['example', 'com'] }, type: TYPE_A, class: CLASS_IN }],
      answers: [{ name: { pointerTo: 12 }, type: TYPE_A, class: CLASS_IN, ttl: 300, rdata: [1, 2, 3, 4] }],
    });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(fieldById(frame, 'answer-1-name').rawValue).toBe('example.com');
    // Pointer 2 bayt tüketir — offset+2 sonraki alana geçer.
    expect(fieldById(frame, 'answer-1-name').length).toBe(2);
  });

  it('kendi kendine işaret eden pointer döngü hatası üretir, kilitlenmez', () => {
    const bytes = Uint8Array.from([
      0, 4, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, // header, QDCOUNT=1
      0xc0, 0x0c, // pointer → offset 12 (kendisi)
    ]);
    const { frame } = expectSuccess(parseDns(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(frame.errors[0]?.message).toBe('protocol.dnsWire.error.nameLoop');
  });

  it('A→B→A iki adımlı döngüde de kilitlenmez', () => {
    // offset12: pointer→14; offset14: pointer→12. İkisi de aynı isim alanı gibi.
    const bytes = Uint8Array.from([
      0, 5, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0,
      0xc0, 0x0e, // offset12 → offset14
      0xc0, 0x0c, // offset14 → offset12
    ]);
    const { frame } = expectSuccess(parseDns(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.message).toBe('protocol.dnsWire.error.nameLoop');
  });
});

describe('RDATA — dar küme', () => {
  function answerWithRdata(type: number, rdata: readonly number[]): Uint8Array {
    return buildDnsMessage({
      id: 1,
      flags: 0x8180,
      answers: [{ name: { labels: ['host', 'example', 'com'] }, type, class: CLASS_IN, ttl: 60, rdata }],
    });
  }

  it('A → dotted-decimal', () => {
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_A, [10, 0, 0, 1])));
    expect(fieldById(frame, 'answer-1-rdata').rawValue).toBe('10.0.0.1');
  });

  it('AAAA → hex grupları', () => {
    const rdata = [0x20, 0x01, 0x0d, 0xb8, ...new Array<number>(12).fill(0)];
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_AAAA, rdata)));
    expect(fieldById(frame, 'answer-1-rdata').rawValue).toBe('2001:db8:0:0:0:0:0:0');
  });

  it('CNAME → isim (RDATA içinde sıkıştırmasız)', () => {
    const { frame } = expectSuccess(
      parseDns(answerWithRdata(TYPE_CNAME, encodeDomainName(['target', 'example', 'com']))),
    );
    expect(fieldById(frame, 'answer-1-rdata').rawValue).toBe('target.example.com');
  });

  it('TXT → karakter dizilerini “ | ” ile birleştirir', () => {
    const rdata = [5, ...Array.from(new TextEncoder().encode('hello')), 3, ...Array.from(new TextEncoder().encode('bye'))];
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_TXT, rdata)));
    expect(fieldById(frame, 'answer-1-rdata').rawValue).toBe('hello | bye');
  });

  it('MX → Preference + Exchange', () => {
    const rdata = [0x00, 0x0a, ...encodeDomainName(['mail', 'example', 'com'])];
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_MX, rdata)));
    expect(fieldById(frame, 'answer-1-rdata-preference').rawValue).toBe(10);
    expect(fieldById(frame, 'answer-1-rdata-exchange').rawValue).toBe('mail.example.com');
  });

  it('SRV → Priority/Weight/Port/Target', () => {
    const rdata = [0, 1, 0, 2, 0x1f, 0x90, ...encodeDomainName(['target', 'example', 'com'])];
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_SRV, rdata)));
    expect(fieldById(frame, 'answer-1-rdata-priority').rawValue).toBe(1);
    expect(fieldById(frame, 'answer-1-rdata-weight').rawValue).toBe(2);
    expect(fieldById(frame, 'answer-1-rdata-port').rawValue).toBe(8080);
    expect(fieldById(frame, 'answer-1-rdata-target').rawValue).toBe('target.example.com');
  });

  it('SOA → yedi alt alanı çözer', () => {
    const rdata = [
      ...encodeDomainName(['ns1', 'example', 'com']),
      ...encodeDomainName(['admin', 'example', 'com']),
      0x00, 0x00, 0x00, 0x01, // serial
      0x00, 0x00, 0x0e, 0x10, // refresh 3600
      0x00, 0x00, 0x01, 0x2c, // retry 300
      0x00, 0x09, 0x3a, 0x80, // expire 604800
      0x00, 0x00, 0x00, 0x3c, // minimum 60
    ];
    const { frame } = expectSuccess(parseDns(answerWithRdata(TYPE_SOA, rdata)));
    expect(fieldById(frame, 'answer-1-rdata-mname').rawValue).toBe('ns1.example.com');
    expect(fieldById(frame, 'answer-1-rdata-rname').rawValue).toBe('admin.example.com');
    expect(fieldById(frame, 'answer-1-rdata-serial').rawValue).toBe(1);
    expect(fieldById(frame, 'answer-1-rdata-refresh').rawValue).toBe(3600);
    expect(fieldById(frame, 'answer-1-rdata-expire').rawValue).toBe(604800);
  });

  it('dar kümenin dışındaki bir TYPE ham RDATA gösterir, uyarı üretir', () => {
    const { frame } = expectSuccess(parseDns(answerWithRdata(99, [0xde, 0xad])));
    expect(fieldById(frame, 'answer-1-type').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dnsWire.warning.unknownType');
    expect(fieldById(frame, 'answer-1-rdata').rawBytes).toEqual(Uint8Array.from([0xde, 0xad]));
  });
});

describe('mDNS varyantı — CLASS üst biti', () => {
  it('soruda üst bit “unicast response requested” olarak çözülür', () => {
    const bytes = buildDnsMessage({
      id: 0,
      flags: 0,
      questions: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: 0x8001 }],
    });
    const { frame } = expectSuccess(parseMdns(bytes));
    expect(fieldById(frame, 'question-1-class').rawValue).toBe(1);
    expect(fieldById(frame, 'question-1-class').physicalValue).toBe('IN');
    expect(fieldById(frame, 'question-1-unicast-response').rawValue).toBe(1);
  });

  it('yanıtta üst bit “cache flush” olarak çözülür', () => {
    const bytes = buildDnsMessage({
      id: 0,
      flags: 0x8400,
      answers: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: 0x8001, ttl: 120, rdata: [1, 2, 3, 4] }],
    });
    const { frame } = expectSuccess(parseMdns(bytes));
    expect(fieldById(frame, 'answer-1-cache-flush').rawValue).toBe(1);
  });

  it('standart DNS varyantında üst bit alanı üretilmez', () => {
    const bytes = buildDnsMessage({
      id: 0,
      flags: 0,
      questions: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: CLASS_IN }],
    });
    const { frame } = expectSuccess(parseDns(bytes));
    expect(hasField(frame, 'question-1-unicast-response')).toBe(false);
  });
});

describe('güvenlik tavanı', () => {
  it('MAX_RECORDS_PER_SECTION üstü kayıt sayısı uyarı üretir', () => {
    const bytes = Uint8Array.from([0, 0, 0, 0, 0xff, 0xff, 0, 0, 0, 0, 0, 0]);
    const { frame } = expectSuccess(parseDns(bytes));
    expect(warningCodes(frame)).toContain('protocol.dnsWire.warning.tooManyRecords');
  });
});
