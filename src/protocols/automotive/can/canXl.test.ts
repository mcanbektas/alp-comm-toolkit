import { describe, expect, it } from 'vitest';

import {
  CAN_XL_HEADER_LENGTH,
  CAN_XL_MAX_PAYLOAD,
  buildCanXlFrame,
  canXlParser,
  canXlPlugin,
  parseCanXl,
} from './canXl';
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

function ramp(length: number): number[] {
  return Array.from({ length }, (_unused, index) => index & 0xff);
}

describe('buildCanXlFrame', () => {
  it('12 baytlık başlık + payload üretir', () => {
    const frame = buildCanXlFrame(0x123, 0x01, 0x03, 0xdeadbeef, ramp(16));
    expect(frame).toHaveLength(CAN_XL_HEADER_LENGTH + 16);
  });

  it('priority ve VCID’yi AYNI prio alanına ayrı bit aralıklarına yazar', () => {
    const frame = buildCanXlFrame(0x123, 0x2a, 0x00, 0x00000000, []);
    // prio = 0x002A0123 little-endian → 23 01 2A 00
    expect(Array.from(frame.slice(0, 4))).toEqual([0x23, 0x01, 0x2a, 0x00]);
  });

  it('len alanını 16-bit little-endian yazar', () => {
    const frame = buildCanXlFrame(0x001, 0, 0, 0, ramp(256));
    expect(frame[6]).toBe(0x00);
    expect(frame[7]).toBe(0x01);
  });

  it('XLF bayrağını varsayılan olarak kurar, SEC’i isteğe bağlı ekler', () => {
    expect(buildCanXlFrame(1, 0, 0, 0, [1])[4]).toBe(0x80);
    expect(buildCanXlFrame(1, 0, 0, 0, [1], { simpleExtendedContent: true })[4]).toBe(0x81);
    expect(buildCanXlFrame(1, 0, 0, 0, [1], { omitXlf: true })[4]).toBe(0x00);
  });
});

describe('parseCanXl — kısa çerçeve', () => {
  const frame = buildCanXlFrame(0x123, 0x01, 0x03, 0xdeadbeef, ramp(16));

  it('çözülür ve protokol kimliğini can-xl’e bağlar', () => {
    const result = expectSuccess(parseCanXl(frame));
    expect(result.frame.protocol).toBe('can-xl');
    expect(result.frame.valid).toBe(true);
    expect(result.consumedBytes).toBe(frame.length);
  });

  it('Priority ID ile Acceptance Field’ı AYRI alanlar olarak basar', () => {
    // CAN XL'in klasik CAN'den kavramsal farkı tam burada: identifier ikiye ayrılır.
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(fieldById(parsed, 'priority-id').rawValue).toBe(0x123);
    expect(fieldById(parsed, 'acceptance-field').rawValue).toBe(0xdeadbeef);
    expect(fieldById(parsed, 'acceptance-field').physicalValue).toBe('0xDEADBEEF');
  });

  it('VCID’yi prio alanının üst baytından çıkarır', () => {
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(fieldById(parsed, 'vcid').rawValue).toBe(0x01);
  });

  it('Priority ve VCID AYRI bayt aralıklarını kaplar — biri ötekini örtmez', () => {
    // Bekçi — tarayıcı turunda görülen kusur: ikisine de `prio`nun dört baytı
    // verilmişti, bölge adaptörü çakışmada listede sonrakini kazandırdığı için
    // Priority ID'nin bölgesi VCID tarafından tamamen örtülüyordu.
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    const priority = fieldById(parsed, 'priority-id');
    const vcidField = fieldById(parsed, 'vcid');
    // Priority düşük 11 bit → bayt 0-1; VCID 16-23. bitler → bayt 2.
    expect([priority.offset, priority.length]).toEqual([0, 2]);
    expect([vcidField.offset, vcidField.length]).toEqual([2, 1]);
    // Aralıklar KESİŞMEMELİ.
    expect(priority.offset + priority.length).toBeLessThanOrEqual(vcidField.offset);
  });

  it('SDT, uzunluk ve LLC verisini çözer', () => {
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(fieldById(parsed, 'sdt').rawValue).toBe(0x03);
    expect(fieldById(parsed, 'payload-length').rawValue).toBe(16);
    const data = fieldById(parsed, 'data');
    expect(data.name).toBe('LLC Data');
    expect(data.offset).toBe(CAN_XL_HEADER_LENGTH);
    expect(data.length).toBe(16);
  });

  it('metadata alanları arayüz için hazır tutar', () => {
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(parsed.rawFrame.metadata?.priorityId).toBe(0x123);
    expect(parsed.rawFrame.metadata?.vcid).toBe(0x01);
    expect(parsed.rawFrame.metadata?.acceptanceField).toBe(0xdeadbeef);
    expect(parsed.rawFrame.metadata?.simpleExtendedContent).toBe(false);
  });
});

describe('parseCanXl — bayraklar ve sınırlar', () => {
  it('SEC bayrağını etiketler', () => {
    const frame = buildCanXlFrame(0x010, 0, 0x05, 0xcafebabe, ramp(32), {
      simpleExtendedContent: true,
    });
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(fieldById(parsed, 'flags').physicalValue).toBe('XLF | SEC');
    expect(parsed.rawFrame.metadata?.simpleExtendedContent).toBe(true);
  });

  it('XLF bayrağı yoksa alanı geçersiz işaretler ve uyarır', () => {
    const frame = buildCanXlFrame(0x123, 0, 0, 0, ramp(4), { omitXlf: true });
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(fieldById(parsed, 'flags').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.can.xl.warning.missingXlfFlag');
  });

  it('sıfır uzunluk aralık dışıdır — hata basar ama alanları gösterir', () => {
    // Spec: veri alanı 1–2048 bayt; sıfır uzunluklu CAN XL çerçevesi yoktur.
    const frame = buildCanXlFrame(0x123, 0, 0, 0, []);
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(parsed, 'payload-length').valid).toBe(false);
    // Hataya rağmen identifier alanları çözülmüş olmalı (spec §47).
    expect(fieldById(parsed, 'priority-id').rawValue).toBe(0x123);
  });

  it('2048 baytlık üst sınırı kabul eder', () => {
    const frame = buildCanXlFrame(0x001, 0, 0, 0, ramp(CAN_XL_MAX_PAYLOAD));
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'data').length).toBe(CAN_XL_MAX_PAYLOAD);
  });

  it('bildirilen uzunluk elde olandan büyükse kısaltır ve uyarır', () => {
    const frame = buildCanXlFrame(0x123, 0, 0, 0, ramp(16)).slice(0, CAN_XL_HEADER_LENGTH + 4);
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(warningCodes(parsed)).toContain('protocol.can.xl.warning.truncatedPayload');
    expect(fieldById(parsed, 'data').length).toBe(4);
  });

  it('bildirilen uzunluktan fazla bayt varsa trailing uyarısı basar', () => {
    const frame = new Uint8Array(CAN_XL_HEADER_LENGTH + 8);
    frame.set(buildCanXlFrame(0x123, 0, 0, 0, ramp(4)));
    const { frame: parsed } = expectSuccess(parseCanXl(frame));
    expect(warningCodes(parsed)).toContain('protocol.can.xl.warning.trailingBytes');
  });

  it('başlıktan kısa girdide truncated-frame döner', () => {
    const result = expectFailure(parseCanXl(new Uint8Array(8)));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('canXlParser', () => {
  it('canParse XLF bayrağını arar — CAN XL’in tanımı odur', () => {
    expect(canXlParser.canParse(buildCanXlFrame(0x123, 0, 0, 0, ramp(4)))).toBe(true);
    expect(
      canXlParser.canParse(buildCanXlFrame(0x123, 0, 0, 0, ramp(4), { omitXlf: true })),
    ).toBe(false);
  });

  it('canParse aralık dışı uzunluğu eler', () => {
    expect(canXlParser.canParse(new Uint8Array(8))).toBe(false);
    expect(
      canXlParser.canParse(new Uint8Array(CAN_XL_HEADER_LENGTH + CAN_XL_MAX_PAYLOAD + 1)),
    ).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      canXlParser.parse(buildCanXlFrame(0x123, 0, 0, 0, ramp(4)), {
        signal: controller.signal,
      }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('canXlPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(canXlPlugin.id).toBe('can-xl');
    expect(canXlPlugin.category).toBe('automotive');
    expect(canXlPlugin.parser).toBe(canXlParser);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of canXlPlugin.exampleFrames) {
      const result = canXlParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.can.xl.example. önekli çeviri anahtarıdır', () => {
    for (const example of canXlPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.can.xl.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.can.xl.example.'), example.id).toBe(true);
    }
  });

  it('bir örnek klasik CAN’e sığmayan büyük yükü gösterir', () => {
    const large = canXlPlugin.exampleFrames.find(
      (example) => example.id === 'xl-large-payload',
    );
    expect(large).toBeDefined();
    if (large === undefined) return;
    const result = expectSuccess(canXlParser.parse(large.bytes));
    expect(fieldById(result.frame, 'data').length).toBeGreaterThan(64);
  });
});
