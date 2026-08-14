import { describe, expect, it } from 'vitest';

import { CAN_FD_FRAME_LENGTH, CAN_FD_MAX_PAYLOAD, CAN_HEADER_LENGTH } from './canFrame';
import { buildCanFdFrame, canFdParser, canFdPlugin, parseCanFd } from './canFd';
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

describe('buildCanFdFrame', () => {
  it('KOMPAKT biçim üretir: başlık + yalnız len kadar veri', () => {
    const frame = buildCanFdFrame(0x123, ramp(12));
    expect(frame).toHaveLength(CAN_HEADER_LENGTH + 12);
    expect(frame[4]).toBe(12);
  });

  it('FDF bayrağını her zaman kurar, BRS/ESI’yi isteğe bağlı ekler', () => {
    expect(buildCanFdFrame(0x123, [])[5]).toBe(0x04);
    expect(buildCanFdFrame(0x123, [], { bitRateSwitch: true })[5]).toBe(0x05);
    expect(buildCanFdFrame(0x123, [], { errorPassive: true })[5]).toBe(0x06);
  });
});

describe('parseCanFd — 12 baytlık BRS çerçevesi', () => {
  const frame = buildCanFdFrame(0x123, ramp(12), { bitRateSwitch: true });

  it('çözülür ve protokol kimliğini can-fd’ye bağlar', () => {
    const result = expectSuccess(parseCanFd(frame));
    expect(result.frame.protocol).toBe('can-fd');
    expect(result.consumedBytes).toBe(frame.length);
    expect(result.frame.valid).toBe(true);
  });

  it('uzunluk alanı GERÇEK bayt sayısı, physicalValue ise DLC kodudur', () => {
    const { frame: parsed } = expectSuccess(parseCanFd(frame));
    const lengthField = fieldById(parsed, 'payload-length');
    // Spec'in istediği "DLC ↔ Actual Payload Length" eşlemesi ekranda yan yana.
    expect(lengthField.rawValue).toBe(12);
    expect(lengthField.physicalValue).toBe('DLC 9');
    // Birim BİLEREK yok: fiziksel değer bir DLC kodudur, bayt sayısı değil.
    // "9 B" basmak kodu uzunluk sanmaya davet ederdi.
    expect(lengthField.unit).toBeUndefined();
  });

  it('FDF/BRS/ESI alanlarını semantik etiketleriyle basar', () => {
    const { frame: parsed } = expectSuccess(parseCanFd(frame));
    expect(fieldById(parsed, 'fdf').physicalValue).toBe('CAN FD Frame');
    expect(fieldById(parsed, 'brs').physicalValue).toBe('Bit Rate Switched');
    expect(fieldById(parsed, 'esi').physicalValue).toBe('Error Active');
  });

  it('metadata BRS/ESI durumunu taşır', () => {
    const { frame: parsed } = expectSuccess(parseCanFd(frame));
    expect(parsed.rawFrame.metadata?.bitRateSwitched).toBe(true);
    expect(parsed.rawFrame.metadata?.errorPassive).toBe(false);
    expect(parsed.rawFrame.metadata?.payloadLength).toBe(12);
  });
});

describe('parseCanFd — uzunluk kuralları', () => {
  it('64 baytlık üst sınırı DLC 15 olarak çözer', () => {
    const frame = buildCanFdFrame(0x18da00f1, ramp(CAN_FD_MAX_PAYLOAD), { extended: true });
    const { frame: parsed } = expectSuccess(parseCanFd(frame));
    expect(fieldById(parsed, 'payload-length').physicalValue).toBe('DLC 15');
    expect(fieldById(parsed, 'data').length).toBe(64);
  });

  it('kanonik olmayan uzunlukta alanı geçersiz işaretler ama çerçeveyi çözer', () => {
    // 13 bayt hiçbir DLC koduna karşılık gelmez.
    const frame = buildCanFdFrame(0x123, ramp(13));
    const { frame: parsed } = expectSuccess(parseCanFd(frame));
    expect(fieldById(parsed, 'payload-length').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.can.frame.warning.nonCanonicalFdLength');
    // Uyarıya rağmen veri yine gösterilir (spec §47).
    expect(fieldById(parsed, 'data').length).toBe(13);
  });

  it('SABİT 72 baytlık gerçek struct’ı da kabul eder', () => {
    // Gerçek `canfd_frame` data[64]'ü her zaman ayırır; kompakt biçim yalnız
    // örneklerin okunabilirliği için. İkisi de geçerli girdi olmalı.
    const full = new Uint8Array(CAN_FD_FRAME_LENGTH);
    full.set(buildCanFdFrame(0x123, ramp(12), { bitRateSwitch: true }));
    const { frame: parsed } = expectSuccess(parseCanFd(full));
    expect(fieldById(parsed, 'payload-length').rawValue).toBe(12);
    expect(fieldById(parsed, 'data').length).toBe(12);
    // Dolgu bayt sayılmaz: trailing uyarısı ÇIKMAMALI.
    expect(warningCodes(parsed)).not.toContain('protocol.can.frame.warning.trailingBytes');
  });

  it('struct boyunu aşan girdide frame-too-long döner', () => {
    const result = expectFailure(parseCanFd(new Uint8Array(CAN_FD_FRAME_LENGTH + 1)));
    expect(result.error.code).toBe('frame-too-long');
  });

  it('başlıktan kısa girdide truncated-frame döner', () => {
    const result = expectFailure(parseCanFd(new Uint8Array(5)));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });
});

describe('canFdParser', () => {
  it('canParse FDF bayrağını ZORUNLU TUTMAZ — bayraksız kayıt uyarıyla gösterilebilmeli', () => {
    const noFdf = new Uint8Array(CAN_HEADER_LENGTH + 8);
    noFdf[4] = 8;
    expect(canFdParser.canParse(noFdf)).toBe(true);
    const { frame } = expectSuccess(canFdParser.parse(noFdf));
    expect(warningCodes(frame)).toContain('protocol.can.frame.warning.missingFdfFlag');
  });

  it('canParse aralık dışı uzunluğu eler', () => {
    expect(canFdParser.canParse(new Uint8Array(4))).toBe(false);
    expect(canFdParser.canParse(new Uint8Array(CAN_FD_FRAME_LENGTH + 1))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      canFdParser.parse(buildCanFdFrame(0x123, ramp(8)), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('canFdPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(canFdPlugin.id).toBe('can-fd');
    expect(canFdPlugin.category).toBe('automotive');
    expect(canFdPlugin.parser).toBe(canFdParser);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of canFdPlugin.exampleFrames) {
      const result = canFdParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.can.fd.example. önekli çeviri anahtarıdır', () => {
    for (const example of canFdPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.can.fd.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.can.fd.example.'), example.id).toBe(true);
    }
  });

  it('örnekler DLC eşlemesinin kırıldığı noktaları kapsar (12, 64 ve kanonik olmayan 13)', () => {
    const lengths = canFdPlugin.exampleFrames.map((example) => example.bytes[4]);
    expect(lengths).toContain(12);
    expect(lengths).toContain(64);
    expect(lengths).toContain(13);
  });
});
