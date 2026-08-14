import { describe, expect, it } from 'vitest';

import { linParser, linPlugin, parseLin } from './lin';
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

describe('parseLin — Sync + PID + parite (spec özet 10:667-668)', () => {
  it('ID 0x01 için P0=1, P1=1 üretir, PID 0xC1 ile eşleşir', () => {
    // ID0=1,ID1=0,ID2=0,ID4=0 → P0=1⊕0⊕0⊕0=1. ID1=0,ID3=0,ID4=0,ID5=0 → P1=¬0=1.
    const frame = new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xb9]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'sync').rawValue).toBe(0x55);
    expect(fieldById(parsed, 'id').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'parity').rawValue).toBe(0b11);
    expect(fieldById(parsed, 'parity').physicalValue).toBe('Valid');
    expect(warningCodes(parsed)).not.toContain('protocol.lin.warning.parityMismatch');
  });

  it('parite bitleri yanlışsa alanı geçersiz işaretler, uyarır ama hata BASMAZ', () => {
    // Aynı ID (0x01), parite bitleri sıfırlanmış (doğrusu 0b11 olmalıydı).
    const frame = new Uint8Array([0x55, 0x01, 0x12, 0x34, 0xb9]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(parsed.valid).toBe(true); // uyarı, hata değil
    expect(fieldById(parsed, 'parity').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.lin.warning.parityMismatch');
  });
});

describe('parseLin — checksum (LIN 2.1, dış kaynak)', () => {
  it('klasik checksum (yalnız veri) eşleşirse Classic olarak adlandırır', () => {
    const frame = new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xb9]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(fieldById(parsed, 'checksum').physicalValue).toBe('Classic');
    expect(parsed.rawFrame.metadata?.checksumConvention).toBe('classic');
  });

  it('geliştirilmiş checksum (PID+veri) eşleşirse Enhanced olarak adlandırır', () => {
    const frame = new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xf7]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(fieldById(parsed, 'checksum').physicalValue).toBe('Enhanced');
    expect(parsed.rawFrame.metadata?.checksumConvention).toBe('enhanced');
  });

  it('veri baytı yoksa klasik checksum boş toplam üzerinden hesaplanır (0xFF)', () => {
    const frame = new Uint8Array([0x55, 0xc1, 0xff]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(parsed.fields.some((field) => field.id === 'data')).toBe(false);
    expect(fieldById(parsed, 'checksum').physicalValue).toBe('Classic');
  });

  it('hiçbir konvansiyonla eşleşmezse checksum-mismatch hatası basar', () => {
    const frame = new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0x00]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(parsed, 'checksum').valid).toBe(false);
  });
});

describe('parseLin — hata yolları', () => {
  it('Sync baytı 0x55 değilse start-delimiter-not-found basar ama çerçeveyi yine gösterir', () => {
    const frame = new Uint8Array([0x00, 0xc1, 0x12, 0x34, 0xb9]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(fieldById(parsed, 'sync').valid).toBe(false);
    // PID/parity/checksum yine çözülür.
    expect(fieldById(parsed, 'id').rawValue).toBe(0x01);
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseLin(new Uint8Array(2))).error.code).toBe('truncated-frame');
    expect(expectFailure(parseLin(new Uint8Array(12))).error.code).toBe('frame-too-long');
  });

  it('sekiz baytlık azami veriyi kabul eder', () => {
    const data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
    const checksum = computeExpectedClassicChecksum(data);
    const frame = new Uint8Array([0x55, 0xc1, ...data, checksum]);
    const { frame: parsed } = expectSuccess(parseLin(frame));
    expect(fieldById(parsed, 'data').length).toBe(8);
    expect(parsed.valid).toBe(true);
  });
});

/** Testin kendi bağımsız checksum hesaplaması — motorla aynı algoritmayı YENİDEN yazar, aynı fonksiyonu çağırmaz. */
function computeExpectedClassicChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const value of bytes) {
    sum += value;
    if (sum > 0xff) sum -= 0xff;
  }
  return ~sum & 0xff;
}

describe('linParser', () => {
  it('canParse Sync baytını ve uzunluk aralığını denetler', () => {
    expect(linParser.canParse(new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xb9]))).toBe(true);
    expect(linParser.canParse(new Uint8Array([0x00, 0xc1, 0x12, 0x34, 0xb9]))).toBe(false);
    expect(linParser.canParse(new Uint8Array(2))).toBe(false);
    expect(linParser.canParse(new Uint8Array(12))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      linParser.parse(new Uint8Array([0x55, 0xc1, 0x12, 0x34, 0xb9]), {
        signal: controller.signal,
      }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('linPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(linPlugin.id).toBe('lin');
    expect(linPlugin.category).toBe('automotive');
    expect(linPlugin.parser).toBe(linParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of linPlugin.exampleFrames) {
      const result = linParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.lin.example. önekli çeviri anahtarıdır', () => {
    for (const example of linPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.lin.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.lin.example.'), example.id).toBe(true);
    }
  });

  it('örnekler klasik/geliştirilmiş/parite/checksum hatasını ve sync hatasını kapsar', () => {
    const ids = linPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('valid-classic-checksum');
    expect(ids).toContain('valid-enhanced-checksum');
    expect(ids).toContain('parity-mismatch');
    expect(ids).toContain('checksum-mismatch-rejected');
    expect(ids).toContain('invalid-sync-rejected');
  });
});
