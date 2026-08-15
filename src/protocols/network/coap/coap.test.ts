import { describe, expect, it } from 'vitest';

import { coapParser, coapPlugin, parseCoap } from './coap';
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
    expect(coapPlugin.id).toBe('coap');
    expect(coapPlugin.category).toBe('network-ethernet');
    expect(coapPlugin.parser?.protocolId).toBe('coap');
    expect(coapPlugin.exampleFrames.length).toBeGreaterThan(0);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of coapPlugin.exampleFrames) {
      const result = coapParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.coap. önekli çeviri anahtarıdır', () => {
    for (const example of coapPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.coap.'), example.id).toBe(true);
    }
  });
});

describe('sabit başlık — Version/Type/TKL', () => {
  it('Ver=1, Type=CON(0), TKL=0 doğru adlandırılır ve uyarı basmaz', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(fieldById(frame, 'version').rawValue).toBe(1);
    expect(fieldById(frame, 'version').valid).toBe(true);
    expect(fieldById(frame, 'type').rawValue).toBe(0);
    expect(fieldById(frame, 'type').physicalValue).toBe('CON');
    expect(fieldById(frame, 'token-length').rawValue).toBe(0);
    expect(warningCodes(frame)).not.toContain('protocol.coap.warning.versionUnexpected');
  });

  it('Type NON/ACK/RST OASIS değil RFC 7252 adlarıyla eşlenir', () => {
    const withType = (type: number): Uint8Array => Uint8Array.from([0x40 | (type << 4), 0x01, 0x00, 0x01]);
    expect(expectSuccess(coapParser.parse(withType(1))).frame.fields.find((f) => f.id === 'type')?.physicalValue).toBe('NON');
    expect(expectSuccess(coapParser.parse(withType(2))).frame.fields.find((f) => f.id === 'type')?.physicalValue).toBe('ACK');
    expect(expectSuccess(coapParser.parse(withType(3))).frame.fields.find((f) => f.id === 'type')?.physicalValue).toBe('RST');
  });

  it('Ver ≠ 1 uyarı basar ama çerçeve valid kalır (sessiz ret yok)', () => {
    // Ver=2 (0b10), Type=CON, TKL=0 → byte0 = 0b10000000 = 0x80.
    const bytes = Uint8Array.from([0x80, 0x01, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(fieldById(frame, 'version').rawValue).toBe(2);
    expect(fieldById(frame, 'version').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.coap.warning.versionUnexpected');
    expect(frame.valid).toBe(true);
  });

  it('TKL 0-8 arası geçerlidir, hata basmaz', () => {
    const bytes = Uint8Array.from([0x48, 0x01, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(fieldById(frame, 'token-length').rawValue).toBe(8);
    expect(fieldById(frame, 'token-length').valid).toBe(true);
    expect(fieldById(frame, 'token').rawBytes).toEqual(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(frame.valid).toBe(true);
  });

  it('TKL 9-15 (rezerve) value-out-of-range basar, Token/Options üretilmez', () => {
    // TKL=15 → byte0 = 0x4F.
    const bytes = Uint8Array.from([0x4f, 0x01, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(frame, 'token-length').valid).toBe(false);
    // Kısmi çözüm: Code/Message ID yine gösterilir.
    expect(hasField(frame, 'code')).toBe(true);
    expect(hasField(frame, 'message-id')).toBe(true);
    expect(hasField(frame, 'token')).toBe(false);
  });

  it('Token tamponda eksikse truncated-frame basar, header yine görünür', () => {
    // TKL=4 ama yalnız 2 bayt token var.
    const bytes = Uint8Array.from([0x44, 0x01, 0x00, 0x01, 0xaa, 0xbb]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(frame, 'token')).toBe(false);
    expect(fieldById(frame, 'code').rawValue).toBe(1);
  });
});

describe('Code — class.detail gösterimi', () => {
  it.each([
    [0x01, '0.01'],
    [0x45, '2.05'],
    [0x84, '4.04'],
  ])('0x%s → %s (ham + semantik ikisi de ParsedField’da)', (code, formatted) => {
    const bytes = Uint8Array.from([0x40, code, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const field = fieldById(frame, 'code');
    expect(field.rawValue).toBe(code);
    expect(field.physicalValue).toBe(formatted);
  });
});

describe('Options — kümülatif numara + dar ad kümesi', () => {
  it('bilinen option numarası adlandırılır (Uri-Path=11)', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xb4, 0x74, 0x65, 0x6d, 0x70]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const option = fieldById(frame, 'option-4');
    expect(option.name).toBe('Uri-Path');
    expect(option.rawValue).toBe(11);
    expect(option.rawBytes).toEqual(Uint8Array.from([0xb4, 0x74, 0x65, 0x6d, 0x70]));
    expect(option.warnings).toEqual([]);
    expect(frame.valid).toBe(true);
  });

  it('ikinci Uri-Path segmenti delta=0 ile AYNI numarayı (11) kümülatif korur', () => {
    const bytes = Uint8Array.from([
      0x40, 0x01, 0x00, 0x01, 0xb7, 0x73, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x73, 0x04, 0x74, 0x65, 0x6d,
      0x70,
    ]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const first = fieldById(frame, 'option-4');
    const second = fieldById(frame, 'option-12');
    expect(first.rawValue).toBe(11);
    expect(second.rawValue).toBe(11);
    expect(frame.valid).toBe(true);
  });

  it('tanınmayan option (Observe=6, RFC 7641 uzantısı) ham + uyarı basar, çerçeve valid kalır', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0x61, 0x00]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const option = fieldById(frame, 'option-4');
    expect(option.name).toBe('Unknown Option');
    expect(option.rawValue).toBe(6);
    expect(warningCodes(frame)).toContain('protocol.coap.warning.unknownOption');
    expect(frame.valid).toBe(true);
  });

  it('extended delta (nibble 13, +13 ofset) doğru hesaplanır', () => {
    // delta nibble=13, ext=0x02 → delta=15 (Uri-Query), length nibble=0.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xd0, 0x02]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const option = fieldById(frame, 'option-4');
    expect(option.rawValue).toBe(15);
    expect(option.name).toBe('Uri-Query');
  });

  it('extended delta (nibble 14, +269 ofset) doğru hesaplanır', () => {
    // delta nibble=14, ext=0x0001 → delta=270, length nibble=0.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xe0, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    const option = fieldById(frame, 'option-4');
    expect(option.rawValue).toBe(270);
    expect(option.name).toBe('Unknown Option');
  });

  it('extended length (nibble 14) tamponda sığmazsa truncated-frame basar', () => {
    // If-Match(delta=1), length nibble=14, ext=0x0000 → length=269 ama yalnız 5 bayt kalıyor.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0x1e, 0x00, 0x00, 0xaa, 0xbb]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    const option = fieldById(frame, 'option-4');
    expect(option.valid).toBe(false);
  });

  it('extended delta ek baytı hiç yoksa truncated-frame basar', () => {
    // delta nibble=13 ama ext bayt için tampon bitmiş.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xd0]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
  });

  it('delta nibble=15 ama bayt 0xFF DEĞİLSE (length≠15) value-out-of-range basar', () => {
    // 0xF0: delta=15, length=0 — marker bağlamı dışı.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xf0]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
  });

  it('length nibble=15 ama bayt 0xFF DEĞİLSE (delta≠15) value-out-of-range basar', () => {
    // 0x5F: delta=5, length=15 — marker bağlamı dışı.
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0x5f]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('value-out-of-range');
  });
});

describe('0xFF payload marker', () => {
  it('marker sonrası payload varsa ayrı alan olarak gösterilir', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xff, 0x61, 0x62]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(fieldById(frame, 'payload-marker').rawValue).toBe(0xff);
    expect(fieldById(frame, 'payload-marker').valid).toBe(true);
    expect(fieldById(frame, 'payload').rawBytes).toEqual(Uint8Array.from([0x61, 0x62]));
    expect(frame.valid).toBe(true);
  });

  it('marker sonrası hiç bayt yoksa truncated-frame basar', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xff]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'payload-marker').valid).toBe(false);
    expect(hasField(frame, 'payload')).toBe(false);
  });

  it('options hiç yoksa (buffer header/token’dan sonra biterse) payload/marker üretilmez', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01]);
    const { frame } = expectSuccess(coapParser.parse(bytes));
    expect(hasField(frame, 'payload')).toBe(false);
    expect(hasField(frame, 'payload-marker')).toBe(false);
    expect(frame.valid).toBe(true);
  });
});

describe('canParse — ucuz ön eleme', () => {
  it('asgari uzunluk + TKL nibble’ının rezerve olmamasına bakar', () => {
    expect(coapParser.canParse(Uint8Array.from([0x40, 0x01, 0x00, 0x01]))).toBe(true);
    expect(coapParser.canParse(Uint8Array.from([0x4f, 0x01, 0x00, 0x01]))).toBe(false);
    expect(coapParser.canParse(Uint8Array.from([0x40, 0x01, 0x00]))).toBe(false);
  });
});

describe('başlık hataları', () => {
  it('4 bayttan kısa veri recoverable truncated-frame ile başarısız olur', () => {
    const result = expectFailure(coapParser.parse(Uint8Array.from([0x40, 0x01, 0x00])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('maxFrameLength aşılınca kurtarılamaz frame-too-long ile başarısız olur', () => {
    const bytes = Uint8Array.from([0x40, 0x01, 0x00, 0x01, 0xff, 0x61, 0x62]);
    const result = expectFailure(coapParser.parse(bytes, { maxFrameLength: 4 }));
    expect(result.error.code).toBe('frame-too-long');
    expect(result.recoverable).toBe(false);
  });

  it('parseCoap kısayolu doğru protokol kimliğine bağlar', () => {
    const { frame } = expectSuccess(parseCoap(Uint8Array.from([0x40, 0x01, 0x00, 0x01])));
    expect(frame.protocol).toBe('coap');
  });
});
