import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../can/canClassic';
import { CAN_CLASSIC_FRAME_LENGTH, CAN_HEADER_LENGTH } from '../can/canFrame';
import { isoTpParser, isoTpPlugin, parseIsoTp } from './isotp';
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

const EXAMPLE_CAN_ID = 0x7a1;

describe('parseIsoTp — Single Frame (spec özet 04:228)', () => {
  // PCI 0x02 → SF_DL 2, veri 10 01.
  const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x02, 0x10, 0x01], { extended: true });

  it('SF_DL ve veriyi spec’in verdiği değerlerle çözer', () => {
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(parsed.valid).toBe(true);
    expect(fieldById(parsed, 'pci-type').rawValue).toBe(0);
    expect(fieldById(parsed, 'pci-type').physicalValue).toBe('Single Frame');
    expect(fieldById(parsed, 'sf-dl').rawValue).toBe(2);
    expect(fieldById(parsed, 'data').rawBytes).toEqual(new Uint8Array([0x10, 0x01]));
  });

  it('Single Frame taşıma oturumu uyarısı BASMAZ — tek başına eksiksizdir', () => {
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(warningCodes(parsed)).not.toContain('protocol.isotp.warning.transportSession');
  });
});

describe('parseIsoTp — First Frame (spec özet 04:230)', () => {
  // PCI 0x10 0x14 → FF_DL (0x0 << 8) | 0x14 = 20.
  const frame = buildCanClassicFrame(
    EXAMPLE_CAN_ID,
    [0x10, 0x14, 0x49, 0x02, 0x01, 0x00, 0x00],
    { extended: true },
  );

  it('FF_DL’i 12 bit olarak spec’in verdiği değerle çözer', () => {
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(fieldById(parsed, 'pci-type').physicalValue).toBe('First Frame');
    expect(fieldById(parsed, 'ff-dl').rawValue).toBe(20);
    expect(fieldById(parsed, 'ff-dl').offset).toBe(CAN_HEADER_LENGTH);
    expect(fieldById(parsed, 'ff-dl').length).toBe(2);
  });

  it('ilk altı veri baytını PCI’den sonraki bölgede taşır', () => {
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    const data = fieldById(parsed, 'data');
    expect(data.offset).toBe(CAN_HEADER_LENGTH + 2);
    expect(data.rawBytes).toEqual(new Uint8Array([0x49, 0x02, 0x01, 0x00, 0x00]));
  });

  it('çok çerçeveli oturum uyarısı basar — birleştirme burada YAPILMAZ', () => {
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(warningCodes(parsed)).toContain('protocol.isotp.warning.transportSession');
  });

  it('ikinci PCI baytı eksikse truncated-frame döner', () => {
    const short = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x10], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(short));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.fields.some((field) => field.id === 'ff-dl')).toBe(false);
  });
});

describe('parseIsoTp — Consecutive Frame', () => {
  it('SN’i alt nibble’dan çözer ve oturum uyarısı basar', () => {
    // PCI 0x21 → SN 1.
    const frame = buildCanClassicFrame(
      EXAMPLE_CAN_ID,
      [0x21, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77],
      { extended: true },
    );
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(fieldById(parsed, 'pci-type').physicalValue).toBe('Consecutive Frame');
    expect(fieldById(parsed, 'sequence-number').rawValue).toBe(1);
    expect(fieldById(parsed, 'data').length).toBe(7);
    expect(warningCodes(parsed)).toContain('protocol.isotp.warning.transportSession');
  });

  it('SN 15’ten 0’a SARAR — bu tek çerçevede yalnız DEĞER olarak görünür, sıra doğrulaması YOK', () => {
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x20, 0x01], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(fieldById(parsed, 'sequence-number').rawValue).toBe(0);
  });
});

describe('parseIsoTp — Flow Control', () => {
  it('FS/BS’i çözer, STmin’i HAM BAYT olarak taşır (ms/µs’ye çevirmez)', () => {
    // PCI 0x30 → FS 0 (Continue To Send), BS 0x00, STmin ham 0x0A.
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x30, 0x00, 0x0a], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(fieldById(parsed, 'flow-status').rawValue).toBe(0);
    expect(fieldById(parsed, 'flow-status').physicalValue).toBe('Continue To Send');
    expect(fieldById(parsed, 'block-size').rawValue).toBe(0);
    const stmin = fieldById(parsed, 'separation-time');
    expect(stmin.rawValue).toBe(0x0a);
    // Kasıtlı: kodlama tablosu yok, `unit`/`physicalValue` YOK.
    expect(stmin.unit).toBeUndefined();
    expect(stmin.physicalValue).toBeUndefined();
    expect(warningCodes(parsed)).toContain('protocol.isotp.warning.transportSession');
  });

  it('Wait ve Overflow durumlarını adlandırır', () => {
    const wait = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x31, 0x00, 0x00], { extended: true });
    const overflow = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x32, 0x00, 0x00], { extended: true });
    expect(
      fieldById(expectSuccess(parseIsoTp(wait)).frame, 'flow-status').physicalValue,
    ).toBe('Wait');
    expect(
      fieldById(expectSuccess(parseIsoTp(overflow)).frame, 'flow-status').physicalValue,
    ).toBe('Overflow');
  });

  it('tanınmayan FS değerinde alanı geçersiz işaretler ve uyarır', () => {
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x3f, 0x00, 0x00], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(fieldById(parsed, 'flow-status').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.isotp.warning.unknownFlowStatus');
  });

  it('BS/STmin yoksa yalnız var olan alanları üretir', () => {
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x30], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(parsed.fields.some((field) => field.id === 'block-size')).toBe(false);
    expect(parsed.fields.some((field) => field.id === 'separation-time')).toBe(false);
  });
});

describe('parseIsoTp — hata ve uyarı yolları', () => {
  it('tanınmayan PCI tipinde value-out-of-range basar ama çerçeveyi yine gösterir', () => {
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0xf0, 0x01, 0x02], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(parsed, 'pci-type').valid).toBe(false);
    expect(fieldById(parsed, 'data').rawBytes).toEqual(new Uint8Array([0x01, 0x02]));
  });

  it('SF_DL vaat ettiğinden az veri varsa uyarır ve elde olanı gösterir', () => {
    // SF_DL 7 vaat ediyor, yalnız üç bayt veri var.
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x07, 0x11, 0x22, 0x33], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(parsed.valid).toBe(true);
    expect(warningCodes(parsed)).toContain('protocol.isotp.warning.truncatedSingleFrameData');
    expect(fieldById(parsed, 'data').length).toBe(3);
  });

  it('PCI baytı yoksa (boş payload) truncated-frame basar, CAN alanları yine görünür', () => {
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [], { extended: true });
    const { frame: parsed } = expectSuccess(parseIsoTp(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(parsed, 'can-id')).toBeDefined();
    expect(fieldById(parsed, 'dlc')).toBeDefined();
    expect(parsed.fields.some((field) => field.id === 'pci-type')).toBe(false);
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseIsoTp(new Uint8Array(4))).error.code).toBe('truncated-frame');
    expect(
      expectFailure(parseIsoTp(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).error.code,
    ).toBe('frame-too-long');
  });
});

describe('isoTpParser', () => {
  it('canParse SF/FF/CF/FC’nin dördünü de kabul eder', () => {
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, [0x02, 0x10, 0x01]))).toBe(
      true,
    );
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, [0x10, 0x14]))).toBe(true);
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, [0x21, 0x01]))).toBe(true);
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, [0x30, 0x00, 0x00]))).toBe(
      true,
    );
  });

  it('canParse tanınmayan PCI tipini ve boş payload’ı eler', () => {
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, [0xf0]))).toBe(false);
    expect(isoTpParser.canParse(buildCanClassicFrame(EXAMPLE_CAN_ID, []))).toBe(false);
  });

  it('canParse aralık dışı uzunluğu eler', () => {
    expect(isoTpParser.canParse(new Uint8Array(4))).toBe(false);
    expect(isoTpParser.canParse(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const frame = buildCanClassicFrame(EXAMPLE_CAN_ID, [0x02, 0x10, 0x01]);
    const result = expectFailure(isoTpParser.parse(frame, { signal: controller.signal }));
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('isoTpPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(isoTpPlugin.id).toBe('iso-tp');
    expect(isoTpPlugin.category).toBe('automotive');
    expect(isoTpPlugin.parser).toBe(isoTpParser);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of isoTpPlugin.exampleFrames) {
      const result = isoTpParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.isotp.example. önekli çeviri anahtarıdır', () => {
    for (const example of isoTpPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.isotp.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.isotp.example.'), example.id).toBe(true);
    }
  });

  it('örnekler dört PCI tipini ve hata yolunu birlikte kapsar', () => {
    const ids = isoTpPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('single-frame');
    expect(ids).toContain('first-frame');
    expect(ids).toContain('consecutive-frame');
    expect(ids).toContain('flow-control-continue');
    expect(ids).toContain('unknown-pci-type-rejected');
  });
});
