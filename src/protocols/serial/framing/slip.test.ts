import { describe, expect, it } from 'vitest';

import { slipParser, slipPlugin } from './slip';
import { SLIP_END, encodeSlip } from '@/protocol-core/framing/slip';
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

describe('slipParser — kaçışlı çerçeve (spec fixture: slip.test.ts emsali)', () => {
  it('END VE ESC kaçışını AYNI çerçevede çözer, olay konumları doğru', () => {
    const wire = Uint8Array.from([0x45, 0x00, 0xdb, 0xdc, 0x11, 0xdb, 0xdd, 0x22, SLIP_END]);
    const frame = expectSuccess(slipParser.parse(wire)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('45 00 C0 11 DB 22');
    expect(fieldById(frame, 'escape-event-0').offset).toBe(2);
    expect(fieldById(frame, 'escape-event-0').rawValue).toBe('0xDB 0xDC');
    expect(fieldById(frame, 'escape-event-0').physicalValue).toBe('0xC0');
    expect(fieldById(frame, 'escape-event-1').offset).toBe(5);
    expect(fieldById(frame, 'escape-event-1').physicalValue).toBe('0xDB');
    expect(fieldById(frame, 'trailing-end').offset).toBe(8);
    expect(hasField(frame, 'leading-end')).toBe(false);
    expect(frame.protocol).toBe('slip');
  });

  it('baştaki opsiyonel END işaretleyicisini ayrı bir alanda gösterir', () => {
    const wire = Uint8Array.from([SLIP_END, 0x01, 0x02, SLIP_END]);
    const frame = expectSuccess(slipParser.parse(wire)).frame;

    expect(fieldById(frame, 'leading-end').offset).toBe(0);
    expect(fieldById(frame, 'payload').rawValue).toBe('01 02');
    expect(fieldById(frame, 'payload').offset).toBe(1);
    expect(fieldById(frame, 'trailing-end').offset).toBe(3);
  });

  it('kaçış gerekmeyen veri hiç escape-event üretmez', () => {
    const wire = encodeSlip(Uint8Array.from([0x01, 0x02, 0x03]));
    const frame = expectSuccess(slipParser.parse(wire)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('01 02 03');
    expect(hasField(frame, 'escape-event-0')).toBe(false);
  });

  it('çerçeve sonrası artık bayt ayrı bir alanda ve uyarıyla gösterilir', () => {
    const twoFrames = Uint8Array.from([...encodeSlip(Uint8Array.from([0x01])), ...encodeSlip(Uint8Array.from([0x02]))]);
    const frame = expectSuccess(slipParser.parse(twoFrames)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('01');
    expect(fieldById(frame, 'trailing-bytes').rawValue).toBe('02 C0');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.slip.warning.trailingBytes');
  });
});

describe('slipParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(slipParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(slipParser.parse(Uint8Array.from([0x01, 0x02, 0x03]))).error.code).toBe('truncated-frame');
  });

  it('bozuk kaçış dizisi unsupported-encoding döner', () => {
    const wire = Uint8Array.from([0xdb, 0xaa, SLIP_END]);
    expect(expectFailure(slipParser.parse(wire)).error.code).toBe('unsupported-encoding');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = slipParser.parse(Uint8Array.from([SLIP_END]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(slipParser.canParse(new Uint8Array(0))).toBe(false);
    expect(slipParser.canParse(Uint8Array.from([0x01]))).toBe(true);
  });
});

describe('slipPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve encoder bağını taşır', () => {
    expect(slipPlugin.id).toBe('slip');
    expect(slipPlugin.category).toBe('interfaces-framing');
    expect(slipPlugin.parser).toBe(slipParser);
    expect(slipPlugin.encoder?.encode).toBe(encodeSlip);
  });

  it('encoder çıktısı parser tarafından aynı payload olarak geri okunur (round-trip)', () => {
    const payload = Uint8Array.from([0xc0, 0xdb, 0x01, 0x00]);
    const wire = slipPlugin.encoder?.encode(payload);
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(slipParser.parse(wire)).frame;
    expect(fieldById(frame, 'payload').rawValue).toBe('C0 DB 01 00');
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of slipPlugin.exampleFrames) {
      const result = slipParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.slip.example. önekli çeviri anahtarıdır', () => {
    for (const example of slipPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.slip.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.slip.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(slipPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
