import { describe, expect, it } from 'vitest';

import { dmx512Parser, dmx512Plugin, parseDmx512 } from './dmx512';
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

describe('parseDmx512 — Start Code (dar ad kümesi)', () => {
  it('0x00 için "DMX Level Data (Standard Lighting)" adlandırır, uyarı basmaz', () => {
    const { frame } = expectSuccess(parseDmx512(Uint8Array.from([0x00, 0xff, 0x80, 0x00, 0xc8])));
    expect(frame.valid).toBe(true);
    const startCode = fieldById(frame, 'start-code');
    expect(startCode.rawValue).toBe(0x00);
    expect(startCode.physicalValue).toBe('DMX Level Data (Standard Lighting)');
    expect(startCode.valid).toBe(true);
    expect(warningCodes(frame)).not.toContain('protocol.dmx512.warning.unrecognizedStartCode');
  });

  it('tanınan alternatif start code’u (0xCC RDM) adlandırır', () => {
    const { frame } = expectSuccess(parseDmx512(Uint8Array.from([0xcc, 0x01, 0x02, 0x03])));
    const startCode = fieldById(frame, 'start-code');
    expect(startCode.physicalValue).toBe('RDM (Remote Device Management)');
    expect(startCode.valid).toBe(true);
  });

  it('bilinmeyen start code’u ham gösterir, alanı geçersiz işaretler ama çerçeve yine valid kalır', () => {
    const { frame } = expectSuccess(parseDmx512(Uint8Array.from([0x01, 0x10, 0x20, 0x30])));
    const startCode = fieldById(frame, 'start-code');
    expect(startCode.rawValue).toBe(0x01);
    expect(startCode.physicalValue).toBeUndefined();
    expect(startCode.valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.dmx512.warning.unrecognizedStartCode');
    // Uyarı hata değildir: yapısal olarak çerçeve yine geçerli sayılır (dosya başı).
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });
});

describe('parseDmx512 — slot ofseti (bayt 0 = start code, slot 1 = bayt 1)', () => {
  it('slot numarası ile bayt indeksi arasında sabit +1 kayma vardır', () => {
    const { frame } = expectSuccess(parseDmx512(Uint8Array.from([0x00, 0xff, 0x80, 0x00, 0xc8])));
    const slot1 = fieldById(frame, 'slot-1');
    expect(slot1.offset).toBe(1);
    expect(slot1.rawValue).toBe(0xff);
    const slot4 = fieldById(frame, 'slot-4');
    expect(slot4.offset).toBe(4);
    expect(slot4.rawValue).toBe(0xc8);
  });
});

describe('parseDmx512 — büyük slot listesi özet gösterimi', () => {
  it('önizleme sınırının altında (≤16) tüm slotlar ayrı alan olur, özet alan yoktur', () => {
    const bytes = Uint8Array.from([0x00, ...new Array(10).fill(0x7f)]);
    const { frame } = expectSuccess(parseDmx512(bytes));
    for (let slot = 1; slot <= 10; slot += 1) {
      expect(hasField(frame, `slot-${String(slot)}`), `slot-${String(slot)}`).toBe(true);
    }
    expect(hasField(frame, 'slot-data')).toBe(false);
    // start-code + 10 slot = 11 alan.
    expect(frame.fields.length).toBe(11);
  });

  it('önizleme sınırının üstünde ilk 16 slot ayrı alan olur, kalanı tek özet alanda toplanır', () => {
    const bytes = Uint8Array.from([0x00, ...new Array(20).fill(0x2a)]);
    const { frame } = expectSuccess(parseDmx512(bytes));
    expect(hasField(frame, 'slot-16')).toBe(true);
    expect(hasField(frame, 'slot-17')).toBe(false);
    expect(hasField(frame, 'slot-20')).toBe(false);
    const remainder = fieldById(frame, 'slot-data');
    expect(remainder.offset).toBe(17);
    expect(remainder.length).toBe(4);
    expect(remainder.name).toBe('Slots 17-20');
    expect(remainder.rawValue).toBeUndefined();
  });

  it('tam 512 slotlu universe’da alan sayısı start-code + 16 önizleme + 1 özet = 18’dir', () => {
    const slots = new Array(512).fill(0).map((_, index) => (index + 1) % 256);
    const bytes = Uint8Array.from([0x00, ...slots]);
    const { frame } = expectSuccess(parseDmx512(bytes));
    expect(frame.fields.length).toBe(18);
    const remainder = fieldById(frame, 'slot-data');
    expect(remainder.name).toBe('Slots 17-512');
    expect(remainder.length).toBe(496);
    expect(warningCodes(frame)).not.toContain('protocol.dmx512.warning.slotCountExceedsMaximum');
  });
});

describe('parseDmx512 — 512 slot tavanı', () => {
  it('512’yi aşan slot sayısı hata değil uyarı basar, çerçeve geçerli kalır', () => {
    const slots = new Array(520).fill(0x01);
    const bytes = Uint8Array.from([0x00, ...slots]);
    const { frame } = expectSuccess(parseDmx512(bytes));
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
    expect(warningCodes(frame)).toContain('protocol.dmx512.warning.slotCountExceedsMaximum');
    const remainder = fieldById(frame, 'slot-data');
    expect(remainder.warnings).toContain('protocol.dmx512.warning.slotCountExceedsMaximum');
    expect(remainder.length).toBe(520 - 16);
  });
});

describe('parseDmx512 — hata yolları', () => {
  it('boş tamponda truncated-frame döner', () => {
    expect(expectFailure(parseDmx512(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('yalnız Start Code (1 bayt) geçerli bir minimal çerçevedir — 0 slot', () => {
    const { frame } = expectSuccess(parseDmx512(Uint8Array.from([0x00])));
    expect(frame.valid).toBe(true);
    expect(frame.fields.length).toBe(1);
    expect(hasField(frame, 'slot-1')).toBe(false);
    expect(hasField(frame, 'slot-data')).toBe(false);
  });

  it('context.maxFrameLength verilip aşılırsa frame-too-long döner', () => {
    const result = dmx512Parser.parse(new Uint8Array(5), { maxFrameLength: 2 });
    expect(expectFailure(result).error.code).toBe('frame-too-long');
  });

  it('context.maxFrameLength verilmezse 512’den uzun çerçeve yine de başarıyla çözülür', () => {
    const slots = new Array(600).fill(0x01);
    const bytes = Uint8Array.from([0x00, ...slots]);
    expect(expectSuccess(dmx512Parser.parse(bytes)).frame.valid).toBe(true);
  });
});

describe('dmx512Parser', () => {
  it('canParse yalnız uzunluk penceresini denetler (DMX’in magic baytı yok)', () => {
    expect(dmx512Parser.canParse(Uint8Array.from([0x00]))).toBe(true);
    expect(dmx512Parser.canParse(Uint8Array.from([0xaa, 0x01, 0x02]))).toBe(true);
    expect(dmx512Parser.canParse(new Uint8Array(0))).toBe(false);
    expect(dmx512Parser.canParse(new Uint8Array(600))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      dmx512Parser.parse(Uint8Array.from([0x00]), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('dmx512Plugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(dmx512Plugin.id).toBe('dmx512');
    expect(dmx512Plugin.category).toBe('building-automation');
    expect(dmx512Plugin.parser).toBe(dmx512Parser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of dmx512Plugin.exampleFrames) {
      const result = dmx512Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.dmx512.example. önekli çeviri anahtarıdır', () => {
    for (const example of dmx512Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.dmx512.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.dmx512.example.'), example.id).toBe(true);
    }
  });

  it('örnekler mutlu yolu, tam universe’ı, aşım/tanınmayan uyarılarını ve minimal çerçeveyi kapsar', () => {
    const ids = dmx512Plugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('standard-lighting-basic');
    expect(ids).toContain('full-512-slot-universe');
    expect(ids).toContain('oversized-slot-count');
    expect(ids).toContain('unrecognized-start-code');
    expect(ids).toContain('recognized-alternate-start-code');
    expect(ids).toContain('minimal-start-code-only');
  });
});
