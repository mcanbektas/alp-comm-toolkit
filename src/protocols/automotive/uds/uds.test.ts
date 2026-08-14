import { describe, expect, it } from 'vitest';

import { UDS_SERVICES, getUdsServiceInfo, parseUds, udsParser, udsPlugin } from './uds';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

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

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

describe('UDS_SERVICES — spec özet 04:248-261 / 10:683-696', () => {
  it('spec’in verdiği 14 SID’i birebir taşır', () => {
    expect(UDS_SERVICES.map((service) => service.sid).sort((a, b) => a - b)).toEqual(
      [0x10, 0x11, 0x14, 0x19, 0x22, 0x27, 0x28, 0x2e, 0x31, 0x34, 0x36, 0x37, 0x3e, 0x85].sort(
        (a, b) => a - b,
      ),
    );
  });

  it('getUdsServiceInfo tanınan SID’in adını döner, tanınmayanda undefined', () => {
    expect(getUdsServiceInfo(0x22)?.name).toBe('Read Data By Identifier');
    expect(getUdsServiceInfo(0x99)).toBeUndefined();
  });
});

describe('parseUds — Read Data By Identifier isteği (spec özet 04:263)', () => {
  const frame = new Uint8Array([0x22, 0xf1, 0x90]);

  it('SID’i adlandırır, kalan baytları ham Parameters bloğu yapar', () => {
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'sid').rawValue).toBe(0x22);
    expect(fieldById(parsed, 'sid').physicalValue).toBe('Read Data By Identifier');
    expect(fieldById(parsed, 'parameters').rawBytes).toEqual(new Uint8Array([0xf1, 0x90]));
  });

  it('metadata rolü request olarak taşır', () => {
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(parsed.rawFrame.metadata?.role).toBe('request');
    expect(parsed.rawFrame.metadata?.serviceName).toBe('Read Data By Identifier');
  });
});

describe('parseUds — Pozitif yanıt (SID + 0x40)', () => {
  it('0x62’yi 0x22’nin pozitif yanıtı olarak tanır ve orijinal servis adını gösterir', () => {
    const frame = new Uint8Array([0x62, 0xf1, 0x90, 0x31]);
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(fieldById(parsed, 'sid').rawValue).toBe(0x62);
    expect(fieldById(parsed, 'sid').physicalValue).toBe('Read Data By Identifier');
    expect(parsed.rawFrame.metadata?.role).toBe('positive-response');
  });

  it('parametre baytı yoksa Parameters alanı üretilmez', () => {
    const frame = new Uint8Array([0x51]); // 0x11 + 0x40, ECU Reset pozitif yanıtı
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(parsed.fields.some((field) => field.id === 'parameters')).toBe(false);
  });
});

describe('parseUds — Negatif yanıt (spec özet 04:265, 7F 22 31)', () => {
  const frame = new Uint8Array([0x7f, 0x22, 0x31]);

  it('response-code, original-sid ve NRC’yi ayrı alanlara çözer', () => {
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'response-code').physicalValue).toBe('Negative Response');
    expect(fieldById(parsed, 'original-sid').rawValue).toBe(0x22);
    expect(fieldById(parsed, 'original-sid').physicalValue).toBe('Read Data By Identifier');
    expect(fieldById(parsed, 'nrc').rawValue).toBe(0x31);
  });

  it('NRC’nin lisanslı veritabanı gerektirdiğini uyarıyla söyler, tablo uydurmaz', () => {
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(warningCodes(parsed)).toContain('protocol.uds.warning.nrcNeedsDatabase');
    // NRC alanının kendisi ham kalır — isim/anlam ATANMAZ.
    expect(fieldById(parsed, 'nrc').physicalValue).toBeUndefined();
  });

  it('eksik NRC baytında truncated-frame basar ama response-code/original-sid yine görünür', () => {
    const truncated = new Uint8Array([0x7f, 0x22]);
    const { frame: parsed } = expectSuccess(parseUds(truncated));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(parsed, 'original-sid').rawValue).toBe(0x22);
    expect(parsed.fields.some((field) => field.id === 'nrc')).toBe(false);
  });

  it('yalnız 0x7F varsa response-code gösterilir, original-sid üretilmez', () => {
    const bare = new Uint8Array([0x7f]);
    const { frame: parsed } = expectSuccess(parseUds(bare));
    expect(parsed.valid).toBe(false);
    expect(fieldById(parsed, 'response-code')).toBeDefined();
    expect(parsed.fields.some((field) => field.id === 'original-sid')).toBe(false);
  });

  it('fazladan bayt varsa trailing-data uyarısıyla ayrı gösterilir', () => {
    const withTrailing = new Uint8Array([0x7f, 0x22, 0x31, 0xaa]);
    const { frame: parsed } = expectSuccess(parseUds(withTrailing));
    expect(fieldById(parsed, 'trailing-data').rawBytes).toEqual(new Uint8Array([0xaa]));
    expect(warningCodes(parsed)).toContain('protocol.uds.warning.trailingBytes');
  });
});

describe('parseUds — tanınmayan SID', () => {
  it('alanı geçersiz işaretler ve uyarır ama çerçeveyi yine gösterir', () => {
    const frame = new Uint8Array([0x99, 0x01]);
    const { frame: parsed } = expectSuccess(parseUds(frame));
    expect(parsed.valid).toBe(true); // uyarı, hata değil
    expect(fieldById(parsed, 'sid').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.uds.warning.unknownSid');
    expect(fieldById(parsed, 'parameters').rawBytes).toEqual(new Uint8Array([0x01]));
  });
});

describe('parseUds — boş ve uzun PDU', () => {
  it('boş PDU’da truncated-frame döner', () => {
    expect(expectFailure(parseUds(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('maxFrameLength verilirse aşıldığında frame-too-long döner', () => {
    const result = expectFailure(
      udsParser.parse(new Uint8Array([0x22, 0xf1, 0x90]), { maxFrameLength: 2 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });

  it('maxFrameLength verilmezse sabit bir üst sınır DAYATILMAZ', () => {
    const long = new Uint8Array([0x36, ...new Array<number>(500).fill(0xaa)]);
    const result = expectSuccess(parseUds(long));
    expect(result.frame.valid).toBe(true);
  });
});

describe('udsParser', () => {
  it('canParse tanınan SID, pozitif ve negatif yanıtı kabul eder', () => {
    expect(udsParser.canParse(new Uint8Array([0x22, 0xf1, 0x90]))).toBe(true);
    expect(udsParser.canParse(new Uint8Array([0x62, 0xf1, 0x90]))).toBe(true);
    expect(udsParser.canParse(new Uint8Array([0x7f, 0x22, 0x31]))).toBe(true);
  });

  it('canParse tanınmayan SID’i ve boş girdiyi eler', () => {
    expect(udsParser.canParse(new Uint8Array([0x99]))).toBe(false);
    expect(udsParser.canParse(new Uint8Array(0))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      udsParser.parse(new Uint8Array([0x22, 0xf1, 0x90]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('udsPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(udsPlugin.id).toBe('uds');
    expect(udsPlugin.category).toBe('automotive');
    expect(udsPlugin.parser).toBe(udsParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of udsPlugin.exampleFrames) {
      const result = udsParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.uds.example. önekli çeviri anahtarıdır', () => {
    for (const example of udsPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.uds.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.uds.example.'), example.id).toBe(true);
    }
  });

  it('örnekler istek, pozitif yanıt, negatif yanıt ve hata yolunu birlikte kapsar', () => {
    const ids = udsPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('read-data-by-identifier-request');
    expect(ids).toContain('read-data-by-identifier-positive-response');
    expect(ids).toContain('negative-response-request-out-of-range');
    expect(ids).toContain('negative-response-truncated');
  });
});
