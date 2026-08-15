import { describe, expect, it } from 'vitest';

import { iso14230Parser, iso14230Plugin, parseIso14230 } from './iso14230';
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

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

/**
 * Motorun checksum hesabından BAĞIMSIZ ikinci hesap (LIN emsali, dosya başı
 * brifi) — 8-bit toplam mod 256, checksum baytı hariç tüm baytlar üzerinde.
 */
function independentChecksum(bytesExcludingChecksum: readonly number[]): number {
  return bytesExcludingChecksum.reduce((sum, value) => (sum + value) & 0xff, 0);
}

describe('parseIso14230 — FMT baytı adres kipi', () => {
  it('fiziksel adresleme (10): TGT/SRC üretir, FMT-içi uzunluk kullanılır', () => {
    const bytes = new Uint8Array([0x83, 0x10, 0xf1, 0x21, 0x00, 0x0c, 0xb1]);
    expect(independentChecksum([0x83, 0x10, 0xf1, 0x21, 0x00, 0x0c])).toBe(0xb1);
    const { frame } = expectSuccess(parseIso14230(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'fmt').physicalValue).toBe('Physical');
    expect(fieldById(frame, 'target-address').rawValue).toBe(0x10);
    expect(fieldById(frame, 'source-address').rawValue).toBe(0xf1);
    expect(fieldById(frame, 'sid').rawValue).toBe(0x21);
    expect(fieldById(frame, 'sid').warnings).toContain('protocol.iso14230.warning.serviceNeedsTable');
    expect(hasField(frame, 'length')).toBe(false);
    expect(warningCodes(frame)).not.toContain('protocol.iso14230.warning.lengthMismatch');
  });

  it('fonksiyonel adresleme (11) + ayrı LEN baytı (uzunluk biti 0)', () => {
    const bytes = new Uint8Array([0xc0, 0x33, 0xf1, 0x04, 0x14, 0xff, 0x00, 0x00, 0xfb]);
    expect(independentChecksum([0xc0, 0x33, 0xf1, 0x04, 0x14, 0xff, 0x00, 0x00])).toBe(0xfb);
    const { frame } = expectSuccess(parseIso14230(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'fmt').physicalValue).toBe('Functional');
    expect(fieldById(frame, 'length').rawValue).toBe(4);
    expect(fieldById(frame, 'sid').rawValue).toBe(0x14);
    expect(fieldById(frame, 'data').rawBytes).toEqual(new Uint8Array([0xff, 0x00, 0x00]));
  });

  it('adres yok (00): TGT/SRC üretilmez', () => {
    const bytes = new Uint8Array([0x02, 0x10, 0x81, 0x93]);
    const { frame } = expectSuccess(parseIso14230(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'fmt').physicalValue).toBe('No Address');
    expect(hasField(frame, 'target-address')).toBe(false);
    expect(hasField(frame, 'source-address')).toBe(false);
  });

  it('CARB kipi (01) hata değil UYARI basar, adres baytı yok varsayılır', () => {
    const bytes = new Uint8Array([0x42, 0x11, 0x01, 0x54]);
    const { frame } = expectSuccess(parseIso14230(bytes));
    expect(frame.valid).toBe(true);
    expect(fieldById(frame, 'fmt').valid).toBe(false);
    expect(fieldById(frame, 'fmt').physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.iso14230.warning.unknownAddressMode');
    expect(hasField(frame, 'target-address')).toBe(false);
  });
});

describe('parseIso14230 — checksum', () => {
  it('doğru checksum valid: true döner', () => {
    const { frame } = expectSuccess(
      parseIso14230(new Uint8Array([0x02, 0x10, 0x81, 0x93])),
    );
    expect(fieldById(frame, 'checksum').valid).toBe(true);
  });

  it('bozuk checksum checksum-mismatch hatası basar, önceki alanlar yine görünür', () => {
    const { frame } = expectSuccess(
      parseIso14230(new Uint8Array([0x83, 0x10, 0xf1, 0x21, 0x00, 0x0c, 0x00])),
    );
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'sid').rawValue).toBe(0x21);
    expect(fieldById(frame, 'checksum').valid).toBe(false);
  });
});

describe('parseIso14230 — kısaltılmış girdi', () => {
  it('3 bayttan kısa girdide truncated-frame döner', () => {
    expect(expectFailure(parseIso14230(new Uint8Array([0x83, 0x10]))).error.code).toBe(
      'truncated-frame',
    );
  });

  it('TGT/SRC var ama SID+checksum için yer kalmazsa truncated-frame basar, adres alanları görünür', () => {
    const { frame } = expectSuccess(parseIso14230(new Uint8Array([0x83, 0x10, 0xf1])));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'target-address').rawValue).toBe(0x10);
    expect(fieldById(frame, 'source-address').rawValue).toBe(0xf1);
    expect(hasField(frame, 'sid')).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      iso14230Parser.parse(new Uint8Array([0x02, 0x10, 0x81, 0x93]), {
        signal: controller.signal,
      }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });

  it('maxFrameLength aşılırsa frame-too-long döner', () => {
    const result = expectFailure(
      iso14230Parser.parse(new Uint8Array([0x02, 0x10, 0x81, 0x93]), { maxFrameLength: 2 }),
    );
    expect(result.error.code).toBe('frame-too-long');
  });
});

describe('parseIso14230 — uzunluk tutarlılığı', () => {
  it('deklare edilen uzunluk gerçek SID+veri sayısıyla uyuşmazsa uyarır ama hata basmaz', () => {
    // FMT 0x05: adres yok, uzunluk biti 5 diyor ama SID+veri gerçekte 2. Checksum
    // bu bayt dizisine göre yeniden hesaplandı (0x05+0x10+0x81 = 0x96).
    const bytes = new Uint8Array([0x05, 0x10, 0x81, 0x96]);
    const { frame } = expectSuccess(parseIso14230(bytes));
    expect(frame.valid).toBe(true);
    expect(warningCodes(frame)).toContain('protocol.iso14230.warning.lengthMismatch');
  });
});

describe('iso14230Parser.canParse', () => {
  it('uzunluk aralığındaki her girdiyi kabul eder', () => {
    expect(iso14230Parser.canParse(new Uint8Array([0x02, 0x10, 0x81]))).toBe(true);
  });

  it('3 bayttan kısa girdiyi eler', () => {
    expect(iso14230Parser.canParse(new Uint8Array([0x02, 0x10]))).toBe(false);
  });
});

describe('iso14230Plugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(iso14230Plugin.id).toBe('iso-14230');
    expect(iso14230Plugin.category).toBe('automotive');
    expect(iso14230Plugin.parser).toBe(iso14230Parser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of iso14230Plugin.exampleFrames) {
      const result = iso14230Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.iso14230.example. önekli çeviri anahtarıdır', () => {
    for (const example of iso14230Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.iso14230.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.iso14230.example.'), example.id).toBe(true);
    }
  });

  it('örnekler iki uzunluk taşıma yolunu da (FMT-içi / ayrı LEN baytı) kapsar', () => {
    const ids = iso14230Plugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('physical-inline-length');
    expect(ids).toContain('functional-separate-length');
    expect(ids).toContain('no-address');
    expect(ids).toContain('carb-mode-warning');
    expect(ids).toContain('checksum-mismatch');
  });
});
