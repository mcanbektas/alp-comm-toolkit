import { describe, expect, it } from 'vitest';

import { parseUdp, udpParser, udpPlugin } from './udp';
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

function datagram(
  sourcePort: number,
  destinationPort: number,
  length: number,
  checksum: number,
  payload: readonly number[] = [],
): Uint8Array {
  return Uint8Array.from([
    (sourcePort >>> 8) & 0xff,
    sourcePort & 0xff,
    (destinationPort >>> 8) & 0xff,
    destinationPort & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    (checksum >>> 8) & 0xff,
    checksum & 0xff,
    ...payload,
  ]);
}

describe('plugin kaydı', () => {
  it('kimlik/kategori/parser bağı katalogla eşleşir', () => {
    expect(udpPlugin.id).toBe('udp');
    expect(udpPlugin.category).toBe('network-ethernet');
    expect(udpPlugin.parser?.protocolId).toBe('udp');
    expect(udpPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of udpPlugin.exampleFrames) {
      const result = udpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.udp. önekli çeviri anahtarıdır', () => {
    for (const example of udpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.udp.'), example.id).toBe(true);
    }
  });
});

describe('portlar ve length', () => {
  it('source/destination port ve length alanlarını okur', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(53, 12345, 12, 0x1234, [1, 2, 3, 4])));
    expect(fieldById(frame, 'source-port').rawValue).toBe(53);
    expect(fieldById(frame, 'destination-port').rawValue).toBe(12345);
    expect(fieldById(frame, 'length').rawValue).toBe(12);
    expect(fieldById(frame, 'length').valid).toBe(true);
  });

  it('8’den küçük Length value-out-of-range üretir', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(1, 2, 4, 0)));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(frame, 'length').valid).toBe(false);
    expect(hasField(frame, 'payload')).toBe(false);
  });

  it('payload = length − 8 kadardır', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(1, 2, 12, 0, [1, 2, 3, 4])));
    const payload = fieldById(frame, 'payload');
    expect(payload.offset).toBe(8);
    expect(payload.length).toBe(4);
  });
});

describe('Checksum — karar 2: pseudo-header olmadan doğrulanamaz', () => {
  it('her zaman ham gösterilir, checksumNeedsPseudoHeader uyarısı basar, mismatch ASLA basılmaz', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(1, 2, 8, 0xabcd)));
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(true);
    expect(checksum.rawValue).toBe(0xabcd);
    expect(warningCodes(frame)).toContain('protocol.udp.warning.checksumNeedsPseudoHeader');
    expect(frame.errors.some((error) => error.code === 'checksum-mismatch')).toBe(false);
  });

  it('checksum 0x0000 IPv4 taşıyıcısında "kullanılmıyor" bilgi notu ekler', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(1, 2, 8, 0x0000)));
    expect(warningCodes(frame)).toContain('protocol.udp.warning.checksumZeroMeansDisabledOverIpv4');
  });

  it('sıfır olmayan checksum "kullanılmıyor" notu EKLEMEZ', () => {
    const { frame } = expectSuccess(udpParser.parse(datagram(1, 2, 8, 0x0001)));
    expect(warningCodes(frame)).not.toContain('protocol.udp.warning.checksumZeroMeansDisabledOverIpv4');
  });
});

describe('trailing data', () => {
  it('tampon deklare edilenden uzunsa fazlası ayrı bir alana düşer, hata değil uyarı basar', () => {
    const bytes = datagram(1, 2, 10, 0, [0x01, 0x02, 0xee, 0xee]);
    const { frame } = expectSuccess(udpParser.parse(bytes));
    expect(frame.valid).toBe(true);
    const trailing = fieldById(frame, 'trailing-data');
    expect(trailing.offset).toBe(10);
    expect(Array.from(trailing.rawBytes)).toEqual([0xee, 0xee]);
    expect(warningCodes(frame)).toContain('protocol.udp.warning.trailingBytes');
  });

  it('tampon deklare edilenden kısaysa (truncated) hata basar ama kısmi çözüm sürer', () => {
    const bytes = datagram(1, 2, 20, 0, [0x01, 0x02]);
    const { frame } = expectSuccess(udpParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'payload')).toBe(true);
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('yalnız asgari uzunluğa bakar (UDP’nin ayırt edici sabiti yok)', () => {
    expect(udpParser.canParse(datagram(1, 2, 8, 0))).toBe(true);
    expect(udpParser.canParse(Uint8Array.from([0x00, 0x01]))).toBe(false);
  });
});

describe('başlık hataları', () => {
  it('8 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(udpParser.parse(Uint8Array.from([0x00, 0x01, 0x02])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const result = expectFailure(udpParser.parse(datagram(1, 2, 8, 0), { maxFrameLength: 4 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseUdp kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseUdp(datagram(1, 2, 8, 0)));
    expect(frame.protocol).toBe('udp');
  });
});
