import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../can/canClassic';
import { CAN_CLASSIC_FRAME_LENGTH } from '../can/canFrame';
import {
  J1939_STRUCTURAL_PGNS,
  PDU2_FORMAT_THRESHOLD,
  decodeJ1939Identifier,
  j1939Parser,
  j1939Plugin,
  parseJ1939,
} from './j1939';
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

/** Spec §43 fixture'ı: CAN ID 0x18F00401 → Priority 6, PGN 61444, Source address 1. */
const SPEC_FIXTURE_ID = 0x18f00401;
const SPEC_FIXTURE_FRAME = buildCanClassicFrame(
  SPEC_FIXTURE_ID,
  [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff],
  { extended: true },
);

describe('decodeJ1939Identifier — spec §43 fixture 0x18F00401', () => {
  const identifier = decodeJ1939Identifier(SPEC_FIXTURE_ID);

  it('spec’in beklediği üç değeri birebir üretir', () => {
    expect(identifier.priority).toBe(6);
    expect(identifier.pgn).toBe(61444);
    expect(identifier.sourceAddress).toBe(1);
  });

  it('alanların tamamını spec’in bit diyagramına göre ayırır', () => {
    expect(identifier.reserved).toBe(0);
    expect(identifier.dataPage).toBe(0);
    expect(identifier.pduFormat).toBe(0xf0);
    expect(identifier.pduSpecific).toBe(0x04);
  });

  it('PF ≥ 240 olduğu için PDU2’dir ve PS group extension olarak PGN’e GİRER', () => {
    expect(identifier.pduFormatType).toBe('PDU2');
    expect(identifier.destinationAddress).toBeUndefined();
    // PGN = (0 << 16) | (240 << 8) | 4 = 61440 + 4
    expect(identifier.pgn).toBe((0xf0 << 8) | 0x04);
  });
});

describe('decodeJ1939Identifier — PDU1 / PDU2 ayrımı', () => {
  it('PDU1’de PS HEDEF ADRESTİR ve PGN’den DÜŞÜLÜR', () => {
    // 0x18EF2A0B: PF = 0xEF = 239 < 240 → PDU1, PS = 0x2A = 42 hedef adres.
    const identifier = decodeJ1939Identifier(0x18ef2a0b);
    expect(identifier.pduFormatType).toBe('PDU1');
    expect(identifier.destinationAddress).toBe(0x2a);
    expect(identifier.sourceAddress).toBe(0x0b);
    // PS PGN'e GİRMEZ: 239 << 8 = 61184, hedef adres kadar kaymaz.
    expect(identifier.pgn).toBe(61184);
  });

  it('eşiğin iki yanındaki PF değerleri farklı PGN kuralına düşer', () => {
    // Aynı PS ile PF 239 ve PF 240: birinde PS düşülür, ötekinde eklenir.
    const pdu1 = decodeJ1939Identifier((6 << 26) | (239 << 16) | (0x55 << 8) | 0x01);
    const pdu2 = decodeJ1939Identifier((6 << 26) | (240 << 16) | (0x55 << 8) | 0x01);
    expect(pdu1.pgn).toBe(239 << 8);
    expect(pdu2.pgn).toBe((240 << 8) | 0x55);
    expect(PDU2_FORMAT_THRESHOLD).toBe(240);
  });

  it('Data Page biti PGN’in 16. bitine taşınır', () => {
    const withDataPage = decodeJ1939Identifier(
      (6 << 26) | (1 << 24) | (0xf0 << 16) | (0x04 << 8) | 0x01,
    );
    expect(withDataPage.dataPage).toBe(1);
    expect(withDataPage.pgn).toBe((1 << 16) | (0xf0 << 8) | 0x04);
  });

  it('Reserved biti spec’in modelinde AYRI okunur (EDP olarak PGN’e katılmaz)', () => {
    // Güncel SAE modelinde bu bit EDP'dir ve sayfa seçimine katılır; spec'in
    // modeli onu Reserved sayıyor ve PGN formülüne SOKMUYOR. Fixture bu modele
    // göre doğrulanmış olduğu için model bilerek korunuyor.
    const withReserved = decodeJ1939Identifier(
      (6 << 26) | (1 << 25) | (0xf0 << 16) | (0x04 << 8) | 0x01,
    );
    expect(withReserved.reserved).toBe(1);
    // EDP olsaydı sayfa seçimine katılır ve PGN 192516 çıkardı; spec'in
    // modelinde bit PGN'e HİÇ dokunmaz, sonuç fixture'ınkiyle aynı kalır.
    expect(withReserved.pgn).toBe(61444);
  });
});

describe('parseJ1939 — spec §43 fixture çerçevesi', () => {
  it('çözülür, geçerlidir ve protokol kimliğini j1939’a bağlar', () => {
    const result = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(result.frame.protocol).toBe('j1939');
    expect(result.frame.valid).toBe(true);
    expect(result.frame.errors).toEqual([]);
    expect(result.consumedBytes).toBe(CAN_CLASSIC_FRAME_LENGTH);
  });

  it('spec’in üç beklenen değerini ekrana çıkan alanlarda taşır', () => {
    const { frame } = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(fieldById(frame, 'priority').rawValue).toBe(6);
    expect(fieldById(frame, 'pgn').rawValue).toBe(61444);
    expect(fieldById(frame, 'source-address').rawValue).toBe(1);
  });

  it('LITTLE-ENDIAN sayesinde her alan KENDİ baytına düşer', () => {
    // Bu, byte-viewer'da bit maskesi göstermek zorunda kalmamamızın sebebi.
    const { frame } = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(fieldById(frame, 'source-address').offset).toBe(0);
    expect(fieldById(frame, 'pdu-specific').offset).toBe(1);
    expect(fieldById(frame, 'pdu-format').offset).toBe(2);
    expect(fieldById(frame, 'priority').offset).toBe(3);
    for (const id of ['source-address', 'pdu-specific', 'pdu-format', 'priority']) {
      expect(fieldById(frame, id).length, id).toBe(1);
    }
  });

  it('PDU Format alanı PDU1/PDU2 sonucunu KENDİSİ söyler', () => {
    const { frame } = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(fieldById(frame, 'pdu-format').rawValue).toBe(0xf0);
    expect(fieldById(frame, 'pdu-format').physicalValue).toBe('PDU2');
    // PDU2 olduğu için PS alanı group extension adını taşır.
    expect(fieldById(frame, 'pdu-specific').name).toBe('Group Extension');
  });

  it('SPN çözümünün lisanslı veritabanı gerektirdiğini UYARIYLA söyler', () => {
    // Spec: J1939DA lisanslıdır; uydurma alan adı basmak yerine sebebi söylenir.
    const { frame } = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(warningCodes(frame)).toContain('protocol.j1939.warning.spnNeedsDatabase');
    // Payload ham blok olarak yine gösterilir.
    expect(fieldById(frame, 'data').length).toBe(8);
  });

  it('metadata PGN ve adres bilgisini arayüz için hazır tutar', () => {
    const { frame } = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(frame.rawFrame.metadata?.pgn).toBe(61444);
    expect(frame.rawFrame.metadata?.priority).toBe(6);
    expect(frame.rawFrame.metadata?.sourceAddress).toBe(1);
    expect(frame.rawFrame.metadata?.pduFormatType).toBe('PDU2');
  });
});

describe('parseJ1939 — PDU1 hedefli mesaj', () => {
  const frame = buildCanClassicFrame(0x18ef2a0b, [0x01, 0x02, 0x03, 0x04], { extended: true });

  it('PS alanını HEDEF ADRES olarak adlandırır', () => {
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(fieldById(parsed, 'pdu-specific').name).toBe('Destination Address');
    expect(fieldById(parsed, 'pdu-specific').rawValue).toBe(0x2a);
    expect(fieldById(parsed, 'pdu-format').physicalValue).toBe('PDU1');
    expect(parsed.rawFrame.metadata?.destinationAddress).toBe(0x2a);
  });
});

describe('parseJ1939 — yapısal PGN’ler', () => {
  it('Address Claimed (60928) tanınır ve adlandırılır', () => {
    const frame = buildCanClassicFrame(0x18eeff00, [0x00, 0x00, 0x40], { extended: true });
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(fieldById(parsed, 'pgn').rawValue).toBe(60928);
    expect(fieldById(parsed, 'pgn').physicalValue).toBe('Address Claimed');
    expect(fieldById(parsed, 'pdu-specific').physicalValue).toBe('Global');
  });

  it('TP.DT (60160) tanınır ve taşıma oturumu uyarısı basar', () => {
    const frame = buildCanClassicFrame(0x1cebff00, [0x01, 0x11, 0x22], { extended: true });
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(fieldById(parsed, 'pgn').physicalValue).toBe('TP.DT');
    expect(warningCodes(parsed)).toContain('protocol.j1939.warning.transportSession');
    // Yapısal mesajda SPN uyarısı BASILMAZ: içerik zaten protokolün kendisi.
    expect(warningCodes(parsed)).not.toContain('protocol.j1939.warning.spnNeedsDatabase');
  });

  it('tablo yalnız YAPISAL PGN’leri içerir — içerik PGN’i adlandırılmaz', () => {
    expect([...J1939_STRUCTURAL_PGNS.keys()].sort((a, b) => a - b)).toEqual([
      59904, 60160, 60416, 60928,
    ]);
    // 61444 spec'in fixture'ıdır ama İÇERİK PGN'idir: adı J1939DA'dadır,
    // uydurulmaz.
    expect(J1939_STRUCTURAL_PGNS.has(61444)).toBe(false);
  });
});

describe('parseJ1939 — hata ve uyarı yolları', () => {
  it('11-bit çerçevede hata basar AMA çerçeveyi yine gösterir (spec §47)', () => {
    const frame = buildCanClassicFrame(0x123, [0xaa, 0xbb, 0xcc, 0xdd]);
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('value-out-of-range');
    // J1939 alanları üretilmez — 11 bitten PGN çıkarılamaz.
    expect(parsed.fields.some((field) => field.id === 'pgn')).toBe(false);
    // Ama CAN ID, DLC ve veri yine görünür.
    expect(fieldById(parsed, 'can-id').rawValue).toBe(0x123);
    expect(fieldById(parsed, 'dlc').rawValue).toBe(4);
    expect(fieldById(parsed, 'data').length).toBe(4);
  });

  it('Reserved biti set ise alanı geçersiz işaretler ve uyarır', () => {
    const frame = buildCanClassicFrame((6 << 26) | (1 << 25) | (0xf0 << 16) | 0x0401, [0x01], {
      extended: true,
    });
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(fieldById(parsed, 'reserved').valid).toBe(false);
    expect(warningCodes(parsed)).toContain('protocol.j1939.warning.reservedBitSet');
  });

  it('null source address (0xFE) uyarısı basar', () => {
    const frame = buildCanClassicFrame(0x18f004fe, [0x01], { extended: true });
    const { frame: parsed } = expectSuccess(parseJ1939(frame));
    expect(fieldById(parsed, 'source-address').physicalValue).toBe('Null Address');
    expect(warningCodes(parsed)).toContain('protocol.j1939.warning.nullSourceAddress');
  });

  it('başlıktan kısa girdide truncated-frame, uzun girdide frame-too-long döner', () => {
    expect(expectFailure(parseJ1939(new Uint8Array(4))).error.code).toBe('truncated-frame');
    expect(
      expectFailure(parseJ1939(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).error.code,
    ).toBe('frame-too-long');
  });
});

describe('j1939Parser', () => {
  it('canParse yalnız extended çerçeveyi kabul eder', () => {
    expect(j1939Parser.canParse(SPEC_FIXTURE_FRAME)).toBe(true);
    expect(j1939Parser.canParse(buildCanClassicFrame(0x123, [0x01]))).toBe(false);
  });

  it('canParse aralık dışı uzunluğu eler', () => {
    expect(j1939Parser.canParse(new Uint8Array(4))).toBe(false);
    expect(j1939Parser.canParse(new Uint8Array(CAN_CLASSIC_FRAME_LENGTH + 1))).toBe(false);
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      j1939Parser.parse(SPEC_FIXTURE_FRAME, { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });

  it('parse() ile parseJ1939() aynı alanları üretir', () => {
    const viaParser = expectSuccess(j1939Parser.parse(SPEC_FIXTURE_FRAME));
    const viaFunction = expectSuccess(parseJ1939(SPEC_FIXTURE_FRAME));
    expect(viaParser.frame.fields).toEqual(viaFunction.frame.fields);
  });
});

describe('j1939Plugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(j1939Plugin.id).toBe('j1939');
    expect(j1939Plugin.category).toBe('automotive');
    expect(j1939Plugin.parser).toBe(j1939Parser);
  });

  it('spec §43 fixture’ını örnekleri arasında taşır', () => {
    const example = j1939Plugin.exampleFrames.find(
      (candidate) => candidate.id === 'pdu2-broadcast',
    );
    expect(example).toBeDefined();
    if (example === undefined) return;
    expect(example.bytes).toEqual(SPEC_FIXTURE_FRAME);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of j1939Plugin.exampleFrames) {
      const result = j1939Parser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.j1939.example. önekli çeviri anahtarıdır', () => {
    for (const example of j1939Plugin.exampleFrames) {
      expect(example.name.startsWith('protocol.j1939.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.j1939.example.'), example.id).toBe(true);
    }
  });

  it('örnekler PDU1, PDU2, yapısal PGN ve hata yolunu birlikte kapsar', () => {
    const ids = j1939Plugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('pdu2-broadcast');
    expect(ids).toContain('pdu1-destination-specific');
    expect(ids).toContain('address-claimed');
    expect(ids).toContain('base-frame-rejected');
  });
});
