import { describe, expect, it } from 'vitest';

import { aisParser, aisPlugin, decodeAisArmorChar, parseAis } from './ais';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

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

function errorMessages(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.message);
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

/**
 * §43 tarzı bağımsız fixture'lar — checksum'ları `nmea0183.test.ts`in izlediği
 * yöntemle (gerçek XOR algoritmasıyla) elle hesaplanıp doğrulandı, uydurulmadı.
 * Payload karakterleri M.1371'in geçerli armor kümesinden.
 */
const POSITION_REPORT_CLASS_A = '!AIVDM,1,1,,A,16b?w,0*0B';
const MULTI_FRAGMENT_STATIC_DATA = '!AIVDM,2,1,5,A,56b?w,0*39';
const CHECKSUM_MISMATCH = '!AIVDM,1,1,,A,16b?w,0*0C';
const UNNAMED_MESSAGE_TYPE = '!AIVDM,1,1,,A,86b?w,0*02';
const OWN_VESSEL_CLASS_B = '!AIVDO,1,1,,B,B6b?w,0*79';

describe('decodeAisArmorChar — M.1371 6-bit armoring kuralı (bağımsız doğrulama)', () => {
  it.each([
    ['0', 0],
    ['9', 9],
    ['W', 39], // 0x30-0x57 aralığının üst sınırı: 87-48=39, 40'ı AŞMIYOR.
    ['`', 40], // 0x60: 96-48=48>40 → 48-8=40, ikinci aralığın alt sınırı.
    ['w', 63], // 0x77: 119-48=71>40 → 71-8=63, 6 bitin üst sınırı.
    ['1', 1],
    ['5', 5],
    ['8', 8],
    ['B', 18],
  ])('%s → %i', (char, expected) => {
    expect(decodeAisArmorChar(char)).toBe(expected);
  });
});

describe('parseAis — zarf alanları (fragment/seq/channel/fill/checksum) TAM çözülür', () => {
  it('tek fragmentli örnekte tüm zarf alanlarını doğru çözer', () => {
    const { frame } = expectSuccess(parseAis(ascii(POSITION_REPORT_CLASS_A)));

    expect(fieldById(frame, 'talker').rawValue).toBe('AI');
    expect(fieldById(frame, 'sentence-formatter').rawValue).toBe('VDM');
    expect(fieldById(frame, 'fragment-count').physicalValue).toBe(1);
    expect(fieldById(frame, 'fragment-number').physicalValue).toBe(1);
    // Tek fragmentli mesajda sequence id BOŞTUR — bu normaldir, uyarı üretmez.
    expect(fieldById(frame, 'sequence-message-id').rawValue).toBeUndefined();
    expect(fieldById(frame, 'channel').rawValue).toBe('A');
    expect(fieldById(frame, 'fill-bits').physicalValue).toBe(0);

    const checksum = fieldById(frame, 'checksum');
    expect(checksum.rawValue).toBe('0B');
    expect(checksum.physicalValue).toBe('0B');
    expect(checksum.valid).toBe(true);
    expect(frame.valid).toBe(true);
    expect(frame.errors).toEqual([]);
  });

  it('protokol kimliğini ais’e bağlar', () => {
    const result = expectSuccess(parseAis(ascii(POSITION_REPORT_CLASS_A)));
    expect(result.frame.protocol).toBe('ais');
    expect(result.consumedBytes).toBe(ascii(POSITION_REPORT_CLASS_A).length);
  });
});

describe('parseAis — Message Type adlandırması (SADECE spec’in beşlisi)', () => {
  it('tip 1 → Position Report Class A', () => {
    const { frame } = expectSuccess(parseAis(ascii(POSITION_REPORT_CLASS_A)));
    const messageType = fieldById(frame, 'message-type');
    expect(messageType.rawValue).toBe(1);
    expect(messageType.physicalValue).toBe('Position Report Class A');
    expect(warningCodes(frame)).not.toContain('protocol.ais.warning.messageTypeNeedsDatabase');
  });

  it('tip 5 → Static and Voyage Data', () => {
    const { frame } = expectSuccess(parseAis(ascii(MULTI_FRAGMENT_STATIC_DATA)));
    expect(fieldById(frame, 'message-type').physicalValue).toBe('Static and Voyage Data');
  });

  it('tip 18 → Class B Position Report (AIVDO)', () => {
    const { frame } = expectSuccess(parseAis(ascii(OWN_VESSEL_CLASS_B)));
    expect(fieldById(frame, 'sentence-formatter').rawValue).toBe('VDO');
    expect(fieldById(frame, 'message-type').physicalValue).toBe('Class B Position Report');
  });

  it('spec’te adı olmayan tip (8) HAM kalır, messageTypeNeedsDatabase uyarısı basılır', () => {
    const { frame } = expectSuccess(parseAis(ascii(UNNAMED_MESSAGE_TYPE)));
    const messageType = fieldById(frame, 'message-type');
    expect(messageType.rawValue).toBe(8);
    expect(messageType.physicalValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ais.warning.messageTypeNeedsDatabase');
  });

  it('kalan bitler HER ZAMAN ham kalır, fieldsNeedDatabase uyarısı basılır', () => {
    const { frame } = expectSuccess(parseAis(ascii(POSITION_REPORT_CLASS_A)));
    const remaining = fieldById(frame, 'remaining-payload');
    expect(remaining.rawValue).toBeUndefined();
    expect(warningCodes(frame)).toContain('protocol.ais.warning.fieldsNeedDatabase');
  });
});

describe('parseAis — fragment sayısı 1’den büyükse oturum uyarısı basılır (ISO-TP emsali, ayrı anahtar)', () => {
  it('tek fragmentte fragmentedMessage BASILMAZ', () => {
    const { frame } = expectSuccess(parseAis(ascii(POSITION_REPORT_CLASS_A)));
    expect(warningCodes(frame)).not.toContain('protocol.ais.warning.fragmentedMessage');
  });

  it('iki fragmentli zarfta fragmentedMessage basılır', () => {
    const { frame } = expectSuccess(parseAis(ascii(MULTI_FRAGMENT_STATIC_DATA)));
    expect(warningCodes(frame)).toContain('protocol.ais.warning.fragmentedMessage');
    expect(fieldById(frame, 'fragment-count').physicalValue).toBe(2);
    expect(fieldById(frame, 'sequence-message-id').physicalValue).toBe(5);
  });

  it('WARN_TRANSPORT_SESSION anahtarı YENİDEN KULLANILMAZ — kendi anahtarı var', () => {
    const { frame } = expectSuccess(parseAis(ascii(MULTI_FRAGMENT_STATIC_DATA)));
    expect(warningCodes(frame)).not.toContain('protocol.isotp.warning.transportSession');
  });
});

describe('parseAis — checksum hata yolu (spec §47: yine alan alan çözülür)', () => {
  it('bozuk checksum hata basar ama çerçeve yine çözülür', () => {
    const { frame } = expectSuccess(parseAis(ascii(CHECKSUM_MISMATCH)));
    expect(frame.valid).toBe(false);
    expect(frame.errors).toHaveLength(1);
    expect(frame.errors[0]?.code).toBe('checksum-mismatch');
    expect(fieldById(frame, 'checksum').valid).toBe(false);

    // ...ama message-type YİNE çözülmüş olmalı.
    expect(fieldById(frame, 'message-type').physicalValue).toBe('Position Report Class A');
  });
});

describe('parseAis — hata yolları (yapısal olarak çözülemez)', () => {
  it('çok kısa girdide truncated-frame döner', () => {
    expect(expectFailure(parseAis(ascii('!AIVDM,1*0B'))).error.code).toBe('truncated-frame');
  });

  it('çok uzun girdide frame-too-long döner', () => {
    const long = `!AIVDM,1,1,,A,${'6'.repeat(75)},0*00`;
    expect(expectFailure(parseAis(ascii(long))).error.code).toBe('frame-too-long');
  });

  it('`!` ile başlamayan girdide start-delimiter-not-found döner', () => {
    expect(expectFailure(parseAis(ascii('$AIVDM,1,1,,A,16b?w,0*00'))).error.code).toBe(
      'start-delimiter-not-found',
    );
  });

  it('checksum ayracı (`*`) yoksa truncated-frame döner', () => {
    const result = expectFailure(parseAis(ascii('!AIVDM,1,1,,A,16b?w,0')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.ais.error.missingChecksumDelimiter');
  });

  it('kimlik 5 karakterden kısaysa (talker+formatter) truncated-frame döner', () => {
    const result = expectFailure(parseAis(ascii('!AIV,1,1,,A,16b?w,0*00')));
    expect(result.error.code).toBe('truncated-frame');
    expect(result.error.message).toBe('protocol.ais.error.malformedIdentifier');
  });

  it('formatter VDM/VDO değilse value-out-of-range döner', () => {
    const result = expectFailure(parseAis(ascii('!AIALR,1,1,,A,16b?w,0*00')));
    expect(result.error.code).toBe('value-out-of-range');
    expect(result.error.message).toBe('protocol.ais.error.unknownFormatter');
  });

  it('iptal edilmiş signal’da parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const result = expectFailure(
      aisParser.parse(ascii(POSITION_REPORT_CLASS_A), { signal: controller.signal }),
    );
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('parseAis — eksik/boş alanlar (hata basılır ama çerçeve yine gösterilir)', () => {
  it('payload/fill-bits token’ları hiç yoksa insufficientEnvelopeFields hatası basılır', () => {
    const { frame } = expectSuccess(parseAis(ascii('!AIVDM,1,1,999999,A*16')));
    expect(frame.valid).toBe(false);
    expect(errorMessages(frame)).toContain('protocol.ais.error.insufficientEnvelopeFields');
    expect(hasField(frame, 'message-type')).toBe(false);
    // ...ama var olan zarf alanları yine gösterilir.
    expect(fieldById(frame, 'sequence-message-id').rawValue).toBe('999999');
  });

  it('payload token boşsa emptyPayload hatası basılır, message-type üretilmez', () => {
    const { frame } = expectSuccess(parseAis(ascii('!AIVDM,1,1,12345,A,,0*17')));
    expect(frame.valid).toBe(false);
    expect(errorMessages(frame)).toContain('protocol.ais.error.emptyPayload');
    expect(hasField(frame, 'message-type')).toBe(false);
    expect(hasField(frame, 'remaining-payload')).toBe(false);
    // Zarf tamamlanmışsa (7 token) insufficientEnvelopeFields AYRICA basılmaz.
    expect(errorMessages(frame)).not.toContain('protocol.ais.error.insufficientEnvelopeFields');
  });
});

describe('aisParser', () => {
  it('canParse yalnız `!AIVDM`/`!AIVDO` ile başlayan uzunluktaki girdiyi kabul eder', () => {
    expect(aisParser.canParse(ascii(POSITION_REPORT_CLASS_A))).toBe(true);
    expect(aisParser.canParse(ascii(OWN_VESSEL_CLASS_B))).toBe(true);
    expect(aisParser.canParse(ascii('!AIALR,1,1,,A,16b?w,0*00'))).toBe(false);
    expect(aisParser.canParse(ascii('$AIVDM,1,1,,A,16b?w,0*00'))).toBe(false);
    expect(aisParser.canParse(ascii('!AIVDM,1*0B'))).toBe(false);
  });
});

describe('aisPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(aisPlugin.id).toBe('ais');
    expect(aisPlugin.category).toBe('marine-navigation');
    expect(aisPlugin.parser).toBe(aisParser);
  });

  it('her örnek çerçeve çözülür ve expectedValid ile eşleşir', () => {
    for (const example of aisPlugin.exampleFrames) {
      const result = aisParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.ais.example. önekli çeviri anahtarıdır', () => {
    for (const example of aisPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.ais.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.ais.example.'), example.id).toBe(true);
    }
  });

  it('örnekler tek/çok fragment, checksum hatası ve adsız mesaj tipini birlikte kapsar', () => {
    const ids = aisPlugin.exampleFrames.map((example) => example.id);
    expect(ids).toContain('position-report-class-a');
    expect(ids).toContain('multi-fragment-static-data');
    expect(ids).toContain('checksum-mismatch');
    expect(ids).toContain('unnamed-message-type');
    expect(ids).toContain('own-vessel-class-b');
  });
});
