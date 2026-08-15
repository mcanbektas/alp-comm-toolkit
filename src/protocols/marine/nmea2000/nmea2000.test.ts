import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { CAN_CLASSIC_FRAME_LENGTH } from '../../automotive/can/canFrame';
import { decodeJ1939Identifier } from '../../automotive/j1939/j1939';
import { nmea2000Parser, nmea2000Plugin, parseNmea2000 } from './nmea2000';
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
 * Spec §14701'in identifier tablosu J1939 §3.4 ile birebir aynı (§14701 = §38503)
 * — bu yüzden J1939'un kendi doğrulanmış fixture'ı (0x18F00401) burada da geçerli
 * bir referans: aynı formülün NMEA 2000 sayfasında da AYNI sonucu ürettiğini kanıtlar.
 */
const SHARED_FIXTURE_ID = 0x18f00401;
const SHARED_FIXTURE_FRAME = buildCanClassicFrame(
  SHARED_FIXTURE_ID,
  [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff],
  { extended: true },
);

describe('parseNmea2000 — J1939 ile paylaşılan identifier formülü', () => {
  it('decodeJ1939Identifier ile birebir aynı sonucu üretir', () => {
    const expected = decodeJ1939Identifier(SHARED_FIXTURE_ID);
    const { frame } = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));

    expect(fieldById(frame, 'priority').rawValue).toBe(expected.priority);
    expect(fieldById(frame, 'pgn').rawValue).toBe(expected.pgn);
    expect(fieldById(frame, 'source-address').rawValue).toBe(expected.sourceAddress);
  });

  it('çözülür, geçerlidir ve protokol kimliğini nmea-2000’e bağlar', () => {
    const result = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));
    expect(result.frame.protocol).toBe('nmea-2000');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
    expect(result.consumedBytes).toBe(CAN_CLASSIC_FRAME_LENGTH);
  });
});

describe('parseNmea2000 — PGN her zaman ham kalır', () => {
  it('pgn alanına HİÇBİR ZAMAN isim atanmaz (J1939’un aksine yapısal tablo yok)', () => {
    const { frame } = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));
    expect(fieldById(frame, 'pgn').physicalValue).toBeUndefined();
  });

  it('pgnNeedsDatabase uyarısı her çözülen çerçevede basılır', () => {
    const { frame } = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));
    expect(warningCodes(frame)).toContain('protocol.nmea.2000.warning.pgnNeedsDatabase');
  });

  it('possibleJ1939 uyarısı her çözülen çerçevede basılır — 29-bit id tek başına kanıt değil', () => {
    const { frame } = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));
    expect(warningCodes(frame)).toContain('protocol.nmea.2000.warning.possibleJ1939');
  });
});

describe('parseNmea2000 — Fast Packet tek çerçeveden İDDİA EDİLMEZ', () => {
  it('payload varsa fastPacketUnknown uyarısı basılır, bayt0/bayt1 yorumlanmaz', () => {
    const { frame } = expectSuccess(parseNmea2000(SHARED_FIXTURE_FRAME));
    expect(warningCodes(frame)).toContain('protocol.nmea.2000.warning.fastPacketUnknown');
    // Bayt0/bayt1'e seq/length anlamı yakıştırılmadığı için 'data' HAM blok kalır.
    expect(fieldById(frame, 'data').rawValue).toBeUndefined();
  });

  it('payload yoksa fastPacketUnknown basılmaz', () => {
    const frame = buildCanClassicFrame(0x0cf20517, [], { extended: true });
    const { frame: parsed } = expectSuccess(parseNmea2000(frame));
    expect(warningCodes(parsed)).not.toContain('protocol.nmea.2000.warning.fastPacketUnknown');
    expect(parsed.fields.some((field) => field.id === 'data')).toBe(false);
  });
});

describe('parseNmea2000 — PDU1 / PDU2 ayrımı (J1939 formülü)', () => {
  it('PDU2’de PS group extension olarak PGN’e girer', () => {
    // PF = 0xF2 = 242 ≥ 240 → PDU2.
    const frame = buildCanClassicFrame(0x0cf20517, [0x00, 0x01], { extended: true });
    const { frame: parsed } = expectSuccess(parseNmea2000(frame));
    expect(fieldById(parsed, 'pdu-format').physicalValue).toBe('PDU2');
    expect(fieldById(parsed, 'pdu-specific').name).toBe('Group Extension');
    expect(fieldById(parsed, 'pgn').rawValue).toBe(0xf205);
  });

  it('PDU1’de PS hedef adrestir ve PGN’den düşülür', () => {
    // PF = 0xEA = 234 < 240 → PDU1, PS = 0x10 hedef adres.
    const frame = buildCanClassicFrame(0x14ea1022, [0x11], { extended: true });
    const { frame: parsed } = expectSuccess(parseNmea2000(frame));
    expect(fieldById(parsed, 'pdu-format').physicalValue).toBe('PDU1');
    expect(fieldById(parsed, 'pdu-specific').name).toBe('Destination Address');
    expect(fieldById(parsed, 'pdu-specific').rawValue).toBe(0x10);
    expect(fieldById(parsed, 'pgn').rawValue).toBe(0xea00);
    expect(parsed.rawFrame.metadata?.destinationAddress).toBe(0x10);
  });
});

describe('parseNmea2000 — hata yolları', () => {
  it('11-bit çerçevede hata basar AMA çerçeveyi yine alan alan gösterir (spec §47)', () => {
    const frame = buildCanClassicFrame(0x321, [0xaa, 0xbb]);
    const { frame: parsed } = expectSuccess(parseNmea2000(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    expect(parsed.fields.some((field) => field.id === 'pgn')).toBe(false);
    expect(fieldById(parsed, 'can-id').rawValue).toBe(0x321);
    expect(fieldById(parsed, 'data').length).toBe(2);
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseNmea2000(new Uint8Array(4))).error.code).toBe('truncated-frame');
    expect(
      expectFailure(parseNmea2000(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).error.code,
    ).toBe('frame-too-long');
  });

  it('Reserved biti set ise alanı geçersiz işaretler ve uyarır', () => {
    const frame = buildCanClassicFrame((6 << 26) | (1 << 25) | (0xf0 << 16) | 0x0401, [0x01], {
      extended: true,
    });
    const { frame: parsed } = expectSuccess(parseNmea2000(frame));
    expect(fieldById(parsed, 'reserved').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.nmea.2000.warning.reservedBitSet');
  });
});

describe('nmea2000Parser', () => {
  it('canParse yalnız extended çerçeveyi kabul eder — J1939 ile aynı ön eleme', () => {
    expect(nmea2000Parser.canParse(SHARED_FIXTURE_FRAME)).toBe(true);
    expect(nmea2000Parser.canParse(buildCanClassicFrame(0x123, [0x01]))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      nmea2000Parser.parse(SHARED_FIXTURE_FRAME, { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('nmea2000Plugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(nmea2000Plugin.id).toBe('nmea-2000');
    expect(nmea2000Plugin.category).toBe('marine-navigation');
    expect(nmea2000Plugin.parser).toBe(nmea2000Parser);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of nmea2000Plugin.exampleFrames) {
      const result = nmea2000Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.nmea.2000.example. önekli çeviri anahtarıdır', () => {
    for (const example of nmea2000Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.nmea.2000.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.nmea.2000.example.'), example.id).toBe(
        true,
      );
    }
  });

  it('örnekler tek çerçeve, fast-packet, geniş PGN, PDU1 ve hata yolunu birlikte kapsar', () => {
    const ids = nmea2000Plugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('shared-j1939-fixture');
    expect(ids).toContain('single-frame-candidate');
    expect(ids).toContain('fast-packet-candidate');
    expect(ids).toContain('wide-pgn-range');
    expect(ids).toContain('pdu1-destination-specific');
    expect(ids).toContain('base-frame-rejected');
  });

  it('J1939 §43 fixture’ını örnekleri arasında birebir taşır', () => {
    const example = nmea2000Plugin.exampleFrames.find(
      (candidate) => candidate.id === 'shared-j1939-fixture',
    );
    expect(example).toBeDefined();
    if (example === undefined) return;
    expect(example.bytes).toEqual(SHARED_FIXTURE_FRAME);
  });
});
