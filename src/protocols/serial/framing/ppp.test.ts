import { describe, expect, it } from 'vitest';

import { pppParser, pppPlugin } from './ppp';
import { HDLC_FLAG, encodeHdlcFlagFrame } from '@/protocol-core/framing/hdlcFraming';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

describe('pppParser — Address/Control/Protocol demux', () => {
  it('standart Address/Control (0xFF/0x03) ayrı alanlarda, Protocol iki bayt çözülür', () => {
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0xff, 0x03, 0x00, 0x21, 0x01, 0x02, 0x03]));
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'address').rawValue).toBe('0xFF');
    expect(fieldById(frame, 'control').rawValue).toBe('0x03');
    expect(fieldById(frame, 'protocol').rawValue).toBe('0x00 0x21');
    expect(fieldById(frame, 'protocol').physicalValue).toBe('IPv4');
    expect(fieldById(frame, 'information').rawValue).toBe('01 02 03');
    expect(frame.protocol).toBe('ppp');
  });

  it('ACFC+PFC: Address/Control yok, Protocol tek bayt (sıkıştırılmış) çözülür', () => {
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0x21, 0x45, 0x00, 0x00, 0x14]));
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(hasField(frame, 'address')).toBe(false);
    expect(hasField(frame, 'control')).toBe(false);
    expect(fieldById(frame, 'protocol').rawValue).toBe('0x21');
    expect(fieldById(frame, 'protocol').physicalValue).toBe('IPv4');
    expect(fieldById(frame, 'protocol').offset).toBe(0);
    expect(fieldById(frame, 'information').rawValue).toBe('45 00 00 14');
  });

  it('async kaçış: 0x7E içeren Information doğru offsette çözülür (spec fixture: hdlcFraming.test.ts)', () => {
    // hdlcFraming.test.ts:12 doğrulanmış fixture'ı (01 7E 02 → 01 7D 5E 02).
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0xff, 0x03, 0x00, 0x21, 0x01, 0x7e, 0x02]));
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'escape-event-0').offset).toBe(5);
    expect(fieldById(frame, 'escape-event-0').rawValue).toBe('0x7D 0x5E');
    expect(fieldById(frame, 'escape-event-0').physicalValue).toBe('0x7E');
    expect(fieldById(frame, 'information').offset).toBe(4);
    expect(fieldById(frame, 'information').rawValue).toBe('01 7E 02');
  });

  it('bilinmeyen protokol numarası hex ile adlanır', () => {
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0xff, 0x03, 0x12, 0x35, 0xaa]));
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'protocol').physicalValue).toBe('Unknown (0x12 0x35)');
  });
});

describe('pppParser — LCP (RFC 1661 §5-6)', () => {
  it('Configure-Request: Code/Identifier/Length çözülür, MRU seçeneği adlanır', () => {
    const wire = encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x01, 0x01, 0x00, 0x08, 0x01, 0x04, 0x05, 0xdc]),
    );
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'protocol').physicalValue).toBe('LCP (Link Control Protocol)');
    expect(fieldById(frame, 'lcp-code').rawValue).toBe(1);
    expect(fieldById(frame, 'lcp-code').physicalValue).toBe('Configure-Request');
    expect(fieldById(frame, 'lcp-identifier').rawValue).toBe(1);
    expect(fieldById(frame, 'lcp-length').rawValue).toBe(8);
    expect(fieldById(frame, 'lcp-option-0').name).toBe('LCP Option: Maximum-Receive-Unit');
    expect(fieldById(frame, 'lcp-option-0').physicalValue).toBe('MRU = 1500 bytes');
    expect(hasField(frame, 'fcs')).toBe(false);
    expect(frame.warnings).toEqual([]);
  });

  it('Configure-Ack (opsiyonsuz, Data boş) + LCP Length sonrası kalan bayt FCS olarak işaretlenir', () => {
    const wire = encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x02, 0x05, 0x00, 0x04, 0xaa, 0xbb]),
    );
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'lcp-code').physicalValue).toBe('Configure-Ack');
    expect(fieldById(frame, 'lcp-identifier').rawValue).toBe(5);
    expect(hasField(frame, 'lcp-option-0')).toBe(false);
    expect(fieldById(frame, 'fcs').rawValue).toBe('AA BB');
    expect(fieldById(frame, 'fcs').physicalValue).toBe('FCS-16 per RFC 1662 default framing — not validated by this engine');
  });

  it('bilinmeyen LCP seçeneği uyarı üretir, adı hex ile gösterilir', () => {
    const wire = encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x01, 0x02, 0x00, 0x06, 0x63, 0x02]),
    );
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'lcp-option-0').name).toBe('LCP Option: Unknown (99)');
    expect(fieldById(frame, 'lcp-option-0').warnings).toContain('protocol.ppp.warning.unknownLcpOption');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.ppp.warning.unknownLcpOption');
  });

  it('bozuk (truncated) seçenek zinciri malformed olarak işaretlenir, çökmez', () => {
    const wire = encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x01, 0x01, 0x00, 0x07, 0x01, 0x05, 0xaa]),
    );
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'lcp-option-0-malformed').valid).toBe(false);
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.ppp.warning.malformedLcpOptions');
  });

  it('Protocol-Reject: reddedilen protokol numarası Data içinde adlanır', () => {
    const wire = encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x08, 0x01, 0x00, 0x08, 0xc2, 0x23, 0xaa, 0xbb]),
    );
    const frame = expectSuccess(pppParser.parse(wire)).frame;

    expect(fieldById(frame, 'lcp-code').physicalValue).toBe('Protocol-Reject');
    expect(fieldById(frame, 'lcp-data').physicalValue).toBe('Rejected Protocol = CHAP (Challenge Handshake Authentication Protocol)');
  });
});

describe('pppParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(pppParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(pppParser.parse(Uint8Array.from([0xff, 0x03, 0x00, 0x21]))).error.code).toBe('truncated-frame');
  });

  it('art arda iki flag (boş çerçeve) truncated-frame döner', () => {
    const wire = Uint8Array.from([HDLC_FLAG, HDLC_FLAG]);
    expect(expectFailure(pppParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('kaçış baytından sonra veri kesilmişse truncated-frame döner', () => {
    const wire = Uint8Array.from([0xff, 0x03, 0x7d, HDLC_FLAG]);
    expect(expectFailure(pppParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('Address/Control sonrası hiç Protocol baytı yoksa truncated-frame döner', () => {
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0xff, 0x03]));
    expect(expectFailure(pppParser.parse(wire)).error.code).toBe('truncated-frame');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = pppParser.parse(Uint8Array.from([HDLC_FLAG]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(pppParser.canParse(new Uint8Array(0))).toBe(false);
    expect(pppParser.canParse(Uint8Array.from([0xff]))).toBe(true);
  });
});

describe('pppPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve encoder bağını taşır', () => {
    expect(pppPlugin.id).toBe('ppp');
    expect(pppPlugin.category).toBe('interfaces-framing');
    expect(pppPlugin.parser).toBe(pppParser);
    expect(pppPlugin.encoder?.encode).toBe(encodeHdlcFlagFrame);
  });

  it('encoder çıktısı parser tarafından aynı Protocol/Information olarak geri okunur (round-trip)', () => {
    const payload = Uint8Array.from([0xff, 0x03, 0x80, 0x21, 0x01, 0x02]);
    const wire = pppPlugin.encoder?.encode(payload);
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(pppParser.parse(wire)).frame;
    expect(fieldById(frame, 'protocol').physicalValue).toBe('IPCP (IP Control Protocol)');
    expect(fieldById(frame, 'information').rawValue).toBe('01 02');
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of pppPlugin.exampleFrames) {
      const result = pppParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ppp.example. önekli çeviri anahtarıdır', () => {
    for (const example of pppPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ppp.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.ppp.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(pppPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
