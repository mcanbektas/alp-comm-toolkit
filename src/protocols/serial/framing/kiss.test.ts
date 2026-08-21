import { describe, expect, it } from 'vitest';

import { kissParser, kissPlugin } from './kiss';
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

describe('kissParser — Type Indicator (spec fixture: escaping.test.ts KISS emsali)', () => {
  it('Data Frame (komut 0) portu/komutu adlar, payload AX.25 olarak ham kalır', () => {
    const wire = encodeSlip(Uint8Array.from([0x00, 0x11, 0x22, 0x33]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').rawValue).toBe('0x00');
    expect(fieldById(frame, 'type-indicator').physicalValue).toBe('Port 0 — Data Frame');
    expect(fieldById(frame, 'payload').rawValue).toBe('11 22 33');
    expect(fieldById(frame, 'payload').physicalValue).toBe('AX.25 frame payload, 3 bytes (raw — not decoded by this engine)');
    expect(frame.protocol).toBe('kiss');
  });

  it('TXDELAY (komut 1) 10ms biriminden ms’ye çevrilir', () => {
    const wire = encodeSlip(Uint8Array.from([0x01, 0x32]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').physicalValue).toBe('Port 0 — TXDELAY');
    expect(fieldById(frame, 'payload').physicalValue).toBe('500 ms (raw value 50 × 10ms unit)');
  });

  it('FullDuplex (komut 5) 0 dışı değeri Full Duplex olarak adlar', () => {
    const wire = encodeSlip(Uint8Array.from([0x05, 0x01]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').physicalValue).toBe('Port 0 — FullDuplex');
    expect(fieldById(frame, 'payload').physicalValue).toBe('Full Duplex (1)');
  });

  it('kaçışlı Data Frame: FEND/FESC baytları ayrı escape-event alanlarında, payload doğru offsette', () => {
    // escaping.test.ts:51'in DOĞRULANMIŞ fixture'ı (11 C0 22 DB 33), Type
    // Indicator (0x00) önüne eklendi.
    const wire = encodeSlip(Uint8Array.from([0x00, 0x11, 0xc0, 0x22, 0xdb, 0x33]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').offset).toBe(0);
    expect(fieldById(frame, 'escape-event-0').offset).toBe(2);
    expect(fieldById(frame, 'escape-event-0').rawValue).toBe('0xDB 0xDC');
    expect(fieldById(frame, 'escape-event-0').physicalValue).toBe('0xC0');
    expect(fieldById(frame, 'escape-event-1').offset).toBe(5);
    expect(fieldById(frame, 'escape-event-1').physicalValue).toBe('0xDB');
    expect(fieldById(frame, 'payload').offset).toBe(1);
    expect(fieldById(frame, 'payload').rawValue).toBe('11 C0 22 DB 33');
  });

  it('bilinmeyen komut (yarım bayt 7-14) uyarı üretir', () => {
    const wire = encodeSlip(Uint8Array.from([0x07]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').physicalValue).toBe('Port 0 — Reserved/Unknown Command (7)');
    expect(fieldById(frame, 'type-indicator').warnings).toContain('protocol.kiss.warning.unknownCommand');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.kiss.warning.unknownCommand');
  });

  it('Return baytı (0xFF) port/komuta ayrıştırılmaz, özel durum olarak adlanır', () => {
    const wire = encodeSlip(Uint8Array.from([0xff]));
    const frame = expectSuccess(kissParser.parse(wire)).frame;

    expect(fieldById(frame, 'type-indicator').rawValue).toBe('0xFF');
    expect(fieldById(frame, 'type-indicator').physicalValue).toBe('Return (exit KISS mode)');
    expect(hasField(frame, 'payload')).toBe(false);
  });

  it('çerçeve sonrası artık bayt ayrı bir alanda ve uyarıyla gösterilir', () => {
    const twoFrames = Uint8Array.from([...encodeSlip(Uint8Array.from([0x00, 0x01])), ...encodeSlip(Uint8Array.from([0x00, 0x02]))]);
    const frame = expectSuccess(kissParser.parse(twoFrames)).frame;

    expect(fieldById(frame, 'payload').rawValue).toBe('01');
    expect(frame.warnings.map((w) => w.code)).toContain('protocol.kiss.warning.trailingBytes');
  });
});

describe('kissParser — hata yolları', () => {
  it('boş girdide truncated-frame döner', () => {
    expect(expectFailure(kissParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('delimiter hiç gelmeyen girdide truncated-frame döner', () => {
    expect(expectFailure(kissParser.parse(Uint8Array.from([0x00, 0x01, 0x02]))).error.code).toBe('truncated-frame');
  });

  it('bozuk kaçış dizisi unsupported-encoding döner', () => {
    const wire = Uint8Array.from([0xdb, 0xaa, SLIP_END]);
    expect(expectFailure(kissParser.parse(wire)).error.code).toBe('unsupported-encoding');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = kissParser.parse(Uint8Array.from([SLIP_END]), { signal: controller.signal });
    expect(expectFailure(result).error.code).toBe('parser-timeout');
  });

  it('canParse boş girdide false, dolu girdide true döner', () => {
    expect(kissParser.canParse(new Uint8Array(0))).toBe(false);
    expect(kissParser.canParse(Uint8Array.from([0x00]))).toBe(true);
  });
});

describe('kissPlugin', () => {
  it('katalogdaki kimlik, kategori, parser ve encoder bağını taşır', () => {
    expect(kissPlugin.id).toBe('kiss');
    expect(kissPlugin.category).toBe('interfaces-framing');
    expect(kissPlugin.parser).toBe(kissParser);
    expect(kissPlugin.encoder?.encode).toBe(encodeSlip);
  });

  it('encoder çıktısı parser tarafından aynı payload olarak geri okunur (round-trip)', () => {
    const payload = Uint8Array.from([0x00, 0xde, 0xad, 0xbe, 0xef]);
    const wire = kissPlugin.encoder?.encode(payload);
    if (wire === undefined) throw new Error('encoder tanımsız');
    const frame = expectSuccess(kissParser.parse(wire)).frame;
    expect(fieldById(frame, 'type-indicator').rawValue).toBe('0x00');
    expect(fieldById(frame, 'payload').rawValue).toBe('DE AD BE EF');
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of kissPlugin.exampleFrames) {
      const result = kissParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.kiss.example. önekli çeviri anahtarıdır', () => {
    for (const example of kissPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.kiss.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.kiss.example.'), example.id).toBe(true);
    }
  });

  it('exampleFrames boş değildir (registry testinin genel kuralı)', () => {
    expect(kissPlugin.exampleFrames.length).toBeGreaterThan(0);
  });
});
