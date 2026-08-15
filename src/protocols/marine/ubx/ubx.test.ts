import { describe, expect, it } from 'vitest';

import { parseUbx, ubxParser, ubxPlugin } from './ubx';
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

/**
 * Motorun `computeUbxChecksum`ından TAMAMEN AYRI yazılmış ikinci uygulama —
 * brief-faz10-dalga3.md'nin istediği LIN/KWP2000 deseni: iki bağımsız kod yolu
 * aynı sonucu verirse doğrulanan ALGORİTMANIN kendisidir, motorun kopyası değil.
 */
function referenceUbxChecksum(bytes: readonly number[]): [ckA: number, ckB: number] {
  let a = 0;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 256;
    b = (b + a) % 256;
  }
  return [a, b];
}

const SPEC_FIXTURE = new Uint8Array([0xb5, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x3a]);

describe('parseUbx — spec ~5355 fixture (B5 62 0A 06 00 00 10 3A)', () => {
  it('checksum İKİ bağımsız hesapla doğrulanır: referans fonksiyon + motor', () => {
    const [refCkA, refCkB] = referenceUbxChecksum([0x0a, 0x06, 0x00, 0x00]);
    expect(refCkA).toBe(0x10);
    expect(refCkB).toBe(0x3a);

    const { frame } = expectSuccess(parseUbx(SPEC_FIXTURE));
    expect(frame.valid).toBe(true);
    const checksum = fieldById(frame, 'checksum');
    expect(checksum.valid).toBe(true);
    expect(checksum.physicalValue).toBe('Valid');
  });

  it('Class MON (0x0A), ID 0x06 ve sıfır uzunluk alan alan çözülür', () => {
    const { frame } = expectSuccess(parseUbx(SPEC_FIXTURE));
    expect(fieldById(frame, 'sync').valid).toBe(true);
    expect(fieldById(frame, 'class').rawValue).toBe(0x0a);
    expect(fieldById(frame, 'class').physicalValue).toBe('MON');
    expect(fieldById(frame, 'message-id').rawValue).toBe(0x06);
    expect(fieldById(frame, 'length').rawValue).toBe(0);
    // Boş payload: payload alanı hiç üretilmez.
    expect(frame.fields.some((field) => field.id === 'payload')).toBe(false);
  });
});

describe('parseUbx — tanınmayan class (uyarı yolu)', () => {
  it('dar kümede olmayan class HATA değil UYARI basar, çerçeve yine geçerli sayılır', () => {
    const bytes = new Uint8Array([0xb5, 0x62, 0x99, 0x01, 0x00, 0x00, 0x9a, 0x67]);
    const { frame } = expectSuccess(parseUbx(bytes));

    expect(frame.valid).toBe(true); // uyarı, hata değil
    const classField = fieldById(frame, 'class');
    expect(classField.valid).toBe(false);
    expect(classField.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ubx.warning.unknownClass');
  });
});

describe('parseUbx — dolu payload (payloadNeedsDatabase yolu)', () => {
  it('payload ham kalır, alan düzeni yazılmaz, uyarı basılır', () => {
    const bytes = new Uint8Array([
      0xb5, 0x62, 0x01, 0x07, 0x04, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x44, 0x3b,
    ]);
    const { frame } = expectSuccess(parseUbx(bytes));

    expect(frame.valid).toBe(true);
    const payload = fieldById(frame, 'payload');
    expect(payload.length).toBe(4);
    expect(Array.from(payload.rawBytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(payload.warnings).toContain('protocol.ubx.warning.payloadNeedsDatabase');
    expect(warningCodes(frame)).toContain('protocol.ubx.warning.payloadNeedsDatabase');
    // NAV class tanınır ama ID/alan düzeni adlandırılmaz.
    expect(fieldById(frame, 'class').physicalValue).toBe('NAV');
  });
});

describe('parseUbx — bozuk checksum (hata yolu)', () => {
  it('checksum uyuşmazlığında HATA basar, çerçeve yine alan alan gösterilir', () => {
    const bytes = new Uint8Array([0xb5, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x00]);
    const { frame } = expectSuccess(parseUbx(bytes));

    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'checksum').valid).toBe(false);
    // Bozuk checksum'a rağmen class/id/length yine görünür.
    expect(fieldById(frame, 'class').rawValue).toBe(0x0a);
  });
});

describe('parseUbx — kısa girdi', () => {
  it('header bile taşımayan veri HARD FAIL olur (truncated-frame, recoverable)', () => {
    const result = expectFailure(parseUbx(new Uint8Array([0xb5, 0x62, 0x0a])));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.recoverable).toBe(true);
  });

  it('payload/checksum eksikse SOFT hata basar, header alanları yine gösterilir', () => {
    // Length=4 diyor ama ardından hiç bayt yok.
    const bytes = new Uint8Array([0xb5, 0x62, 0x0a, 0x06, 0x04, 0x00]);
    const { frame } = expectSuccess(parseUbx(bytes));

    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('truncated-frame');
    expect(fieldById(frame, 'length').rawValue).toBe(4);
    expect(frame.fields.some((field) => field.id === 'payload')).toBe(false);
    expect(frame.fields.some((field) => field.id === 'checksum')).toBe(false);
  });
});

describe('parseUbx — geçersiz sync (savunma katmanı)', () => {
  it('canParse eler ama doğrudan parse çağrısı start-delimiter-not-found basar', () => {
    const bytes = new Uint8Array([0x00, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x3a]);
    const { frame } = expectSuccess(parseUbx(bytes));
    expect(frame.valid).toBe(false);
    expect(frame.errors[0]?.code).toBe('start-delimiter-not-found');
  });
});

describe('ubxParser.canParse', () => {
  it('sync baytlarını ve asgari uzunluğu kontrol eder', () => {
    expect(ubxParser.canParse(SPEC_FIXTURE)).toBe(true);
    expect(ubxParser.canParse(new Uint8Array([0x00, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x3a]))).toBe(
      false,
    );
    expect(ubxParser.canParse(new Uint8Array([0xb5, 0x62]))).toBe(false);
  });
});

describe('ubxPlugin', () => {
  it('protocolId ve registry anahtarı birebir aynı: gnss-ubx', () => {
    expect(ubxPlugin.id).toBe('gnss-ubx');
    expect(ubxPlugin.parser?.protocolId).toBe('gnss-ubx');
  });

  it('örnek çerçevelerin her biri beklenen valid/invalid örüntüsünü üretir', () => {
    expect(ubxPlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of ubxPlugin.exampleFrames) {
      const result = parseUbx(example.bytes);
      expect(result.success, example.id).toBe(true);
      if (result.success) {
        expect(result.frame.valid, example.id).toBe(example.expectedValid);
      }
    }
  });
});
