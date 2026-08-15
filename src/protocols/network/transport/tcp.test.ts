import { describe, expect, it } from 'vitest';

import { parseTcp, tcpParser, tcpPlugin } from './tcp';
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

function segment(overrides: {
  dataOffsetReserved?: number;
  flags?: number;
  sequenceNumber?: number;
  acknowledgmentNumber?: number;
  checksum?: number;
  rest?: readonly number[];
} = {}): Uint8Array {
  const dataOffsetReserved = overrides.dataOffsetReserved ?? 0x50;
  const flags = overrides.flags ?? 0x00;
  const sequenceNumber = overrides.sequenceNumber ?? 0;
  const acknowledgmentNumber = overrides.acknowledgmentNumber ?? 0;
  const checksum = overrides.checksum ?? 0;
  const rest = overrides.rest ?? [];
  return Uint8Array.from([
    0x00, 0x50, // source port 80
    0x00, 0x51, // destination port 81
    (sequenceNumber >>> 24) & 0xff,
    (sequenceNumber >>> 16) & 0xff,
    (sequenceNumber >>> 8) & 0xff,
    sequenceNumber & 0xff,
    (acknowledgmentNumber >>> 24) & 0xff,
    (acknowledgmentNumber >>> 16) & 0xff,
    (acknowledgmentNumber >>> 8) & 0xff,
    acknowledgmentNumber & 0xff,
    dataOffsetReserved,
    flags,
    0xff, 0xff, // window size
    (checksum >>> 8) & 0xff,
    checksum & 0xff,
    0x00, 0x00, // urgent pointer
    ...rest,
  ]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(tcpPlugin.id).toBe('tcp');
    expect(tcpPlugin.category).toBe('network-ethernet');
    expect(tcpPlugin.parser?.protocolId).toBe('tcp');
    expect(tcpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of tcpPlugin.exampleFrames) {
      const result = tcpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.tcp. önekli çeviri anahtarıdır', () => {
    for (const example of tcpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.tcp.'), example.id).toBe(true);
    }
  });
});

describe('Sequence / Acknowledgment — 32-bit, ilişki kurulmaz', () => {
  it('32-bit üst sınırı >>> 0 ile işaretsiz okur', () => {
    const { frame } = expectSuccess(
      tcpParser.parse(segment({ sequenceNumber: 0xffffffff, acknowledgmentNumber: 0x80000000 })),
    );
    expect(fieldById(frame, 'sequence-number').rawValue).toBe(0xffffffff);
    expect(fieldById(frame, 'acknowledgment-number').rawValue).toBe(0x80000000);
  });
});

describe('Data Offset / Reserved', () => {
  it('4 bit Data Offset’i 32-bit kelimeden bayta çevirir', () => {
    const { frame } = expectSuccess(tcpParser.parse(segment()));
    const dataOffset = fieldById(frame, 'data-offset');
    expect(dataOffset.rawValue).toBe(5);
    expect(dataOffset.physicalValue).toBe('20 bytes');
    expect(dataOffset.valid).toBe(true);
  });

  it('Data Offset < 5 value-out-of-range üretir ama sabit alanlar yine görünür', () => {
    const { frame } = expectSuccess(tcpParser.parse(segment({ dataOffsetReserved: 0x40 })));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(frame, 'data-offset').valid).toBe(false);
    expect(fieldById(frame, 'window-size').rawValue).toBe(0xffff);
    expect(hasField(frame, 'options')).toBe(false);
    expect(hasField(frame, 'payload')).toBe(false);
  });
});

describe('Flag paneli (CWR/ECE/URG/ACK/PSH/RST/SYN/FIN)', () => {
  it('her bayrağı ayrı alan olarak çözer', () => {
    // SYN(0x02) + ACK(0x10) = 0x12.
    const { frame } = expectSuccess(tcpParser.parse(segment({ flags: 0x12 })));
    expect(fieldById(frame, 'flag-syn').rawValue).toBe(1);
    expect(fieldById(frame, 'flag-ack').rawValue).toBe(1);
    expect(fieldById(frame, 'flag-fin').rawValue).toBe(0);
    expect(fieldById(frame, 'flag-cwr').rawValue).toBe(0);
    expect(fieldById(frame, 'flag-ece').rawValue).toBe(0);
    expect(fieldById(frame, 'flag-urg').rawValue).toBe(0);
    expect(fieldById(frame, 'flag-psh').rawValue).toBe(0);
    expect(fieldById(frame, 'flag-rst').rawValue).toBe(0);
  });

  it('tüm bayraklar (0xFF) hepsini 1 gösterir', () => {
    const { frame } = expectSuccess(tcpParser.parse(segment({ flags: 0xff })));
    for (const id of ['flag-cwr', 'flag-ece', 'flag-urg', 'flag-ack', 'flag-psh', 'flag-rst', 'flag-syn', 'flag-fin']) {
      expect(fieldById(frame, id).rawValue, id).toBe(1);
    }
  });
});

describe('Checksum — karar 2: pseudo-header olmadan doğrulanamaz', () => {
  it('her zaman ham gösterilir, checksumNeedsPseudoHeader uyarısı basar, mismatch ASLA basılmaz', () => {
    const { frame } = expectSuccess(tcpParser.parse(segment({ checksum: 0xbeef })));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(true);
    expect(checksum.rawValue).toBe(0xbeef);
    expect(warningCodes(frame)).toContain('protocol.tcp.warning.checksumNeedsPseudoHeader');
    expect(frame.errors.some((error) => error.code === 'checksum-mismatch')).toBe(false);
  });
});

describe('Options / Payload', () => {
  it('Data Offset > 5 olduğunda ham Options alanı üretir', () => {
    const bytes = segment({ dataOffsetReserved: 0x60, rest: [0x01, 0x01, 0x01, 0x00, 0xaa, 0xbb] });
    const { frame } = expectSuccess(tcpParser.parse(bytes));
    const options = fieldById(frame, 'options');
    expect(options.offset).toBe(20);
    expect(options.length).toBe(4);
    const payload = fieldById(frame, 'payload');
    expect(payload.offset).toBe(24);
    expect(Array.from(payload.rawBytes)).toEqual([0xaa, 0xbb]);
  });

  it('deklare edilen başlık (options dahil) tamponda eksikse truncated-frame üretir', () => {
    // Data Offset=8 (32 bayt) ama yalnız 20+4=24 bayt geldi.
    const bytes = segment({ dataOffsetReserved: 0x80, rest: [0x01, 0x01, 0x01, 0x00] });
    const { frame } = expectSuccess(tcpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'options')).toBe(false);
    expect(hasField(frame, 'payload')).toBe(false);
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('yalnız asgari uzunluğa bakar (TCP’nin ayırt edici sabiti yok)', () => {
    expect(tcpParser.canParse(segment())).toBe(true);
    expect(tcpParser.canParse(Uint8Array.from([0x00, 0x50]))).toBe(false);
  });
});

describe('başlık hataları', () => {
  it('20 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(tcpParser.parse(Uint8Array.from([0x00, 0x50, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const result = expectFailure(tcpParser.parse(segment(), { maxFrameLength: 10 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseTcp kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseTcp(segment()));
    expect(frame.protocol).toBe('tcp');
  });
});
