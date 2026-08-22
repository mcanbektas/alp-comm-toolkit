import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField } from '@/protocol-core/types';

import { microwireParser, microwirePlugin, parseMicrowire } from './microwire';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField {
  const field = fields.find((candidate) => candidate.id === id);
  if (field === undefined) throw new Error(`alan yok: ${id}`);
  return field;
}

/** Varsayılan profil (93xx46 x16) ile çözülen READ örneği — eklentinin kendi fixture'ı. */
const READ_WORD_BYTES = Uint8Array.from([0xc5, 0x5f, 0x77, 0x80]);

describe('microwire eklentisi — seçenek bildirimi', () => {
  it('decodeOptions bildirir; profil şıkları preset listesinden ve custom şıkkından oluşur', () => {
    const options = microwirePlugin.decodeOptions;
    expect(options).toBeDefined();
    if (options === undefined) return;

    const profileOption = options.find((option) => option.id === 'profile');
    expect(profileOption?.kind).toBe('select');
    const values = (profileOption?.choices ?? []).map((choice) => choice.value);
    expect(values).toEqual(['93xx46-x16', '93xx46-x8', '93xx56-x16', '93xx56-x8', 'custom']);
  });

  it('üç serbest sayı alanı sınırlı — sınırsız bit genişliği kabul edilmez', () => {
    const options = microwirePlugin.decodeOptions ?? [];
    for (const id of ['opcodeBits', 'addressBits', 'wordBits']) {
      const option = options.find((candidate) => candidate.id === id);
      expect(option?.kind).toBe('number');
      expect(option?.min).toBeGreaterThan(0);
      expect(option?.max).toBeGreaterThan(option?.min ?? 0);
    }
  });
});

describe('microwire eklentisi — varsayılan profil', () => {
  it('seçeneksiz çağrı 93xx46 x16 ile çözer', () => {
    const result = parseMicrowire(READ_WORD_BYTES);
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) return;

    expect(fieldById(result.frame.fields, 'opcode').physicalValue).toBe('READ');
    expect(fieldById(result.frame.fields, 'address').physicalValue).toBe('0x0A');
    expect(fieldById(result.frame.fields, 'data').physicalValue).toBe('0xBEEF');
  });

  it('ilk alan YÜRÜRLÜKTEKİ PROFİLİ basar — hangi sayılarla çözüldüğü gizlenmez', () => {
    const result = parseMicrowire(READ_WORD_BYTES);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    const profileField = result.frame.fields[0];
    expect(profileField?.id).toBe('profile');
    expect(String(profileField?.rawValue)).toContain('93xx46B');
    // Preset'te kaynak belgesi de basılır; `custom`'da basılmaz.
    expect(profileField?.physicalValue).toBe('Microchip DS20001749K Table 1-3');
  });

  it('READ veri alanı DO (slave sürer), WRITE veri alanı DI (master sürer)', () => {
    const read = parseMicrowire(READ_WORD_BYTES);
    if (!isParseSuccess(read)) throw new Error('çözülmeliydi');
    expect(fieldById(read.frame.fields, 'data').name).toContain('DO');

    // SB=1, opcode=01 (WRITE), A5–A0=0x3F, D15–D0=0x1234.
    const write = parseMicrowire(Uint8Array.from([0xbf, 0x89, 0x1a, 0x00]));
    if (!isParseSuccess(write)) throw new Error('çözülmeliydi');
    expect(fieldById(write.frame.fields, 'data').name).toContain('DI');
  });
});

describe('microwire eklentisi — profil DEĞİŞTİRİNCE aynı baytlar başka anlam kazanır', () => {
  /**
   * Bu testin varlık sebebi mimari karardır: parametre gerçekten çözümü
   * değiştirmiyorsa `decodeOptions` kanalına gerek yoktu. Aynı dört bayt iki
   * profille iki farklı transaction verir.
   */
  it('93xx46 x8 profilinde adres 7 bit, veri 8 bit olur', () => {
    const asX16 = parseMicrowire(READ_WORD_BYTES, { profile: '93xx46-x16' });
    const asX8 = parseMicrowire(READ_WORD_BYTES, { profile: '93xx46-x8' });
    if (!isParseSuccess(asX16) || !isParseSuccess(asX8)) throw new Error('ikisi de çözülmeliydi');

    expect(fieldById(asX16.frame.fields, 'address').physicalValue).toBe('0x0A');
    expect(fieldById(asX16.frame.fields, 'data').physicalValue).toBe('0xBEEF');

    // 1 10 0010101 01111101 → adres 0b0010101 = 0x15, veri 0b01111101 = 0x7D
    expect(fieldById(asX8.frame.fields, 'address').physicalValue).toBe('0x15');
    expect(fieldById(asX8.frame.fields, 'data').physicalValue).toBe('0x7D');
  });

  it('custom profili üç sayıyı doğrudan uygular ve kaynak belgesi BASMAZ', () => {
    const result = parseMicrowire(READ_WORD_BYTES, {
      profile: 'custom',
      opcodeBits: 2,
      addressBits: 6,
      wordBits: 8,
    });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');

    expect(fieldById(result.frame.fields, 'data').rawValue).toBe('0b10111110');
    const profileField = result.frame.fields[0];
    expect(String(profileField?.rawValue)).toContain('Custom');
    expect(profileField?.physicalValue).toBeUndefined();
  });

  it('sınır dışı serbest değer varsayılana düşer — çözüm ekrandan kaybolmaz', () => {
    const result = parseMicrowire(READ_WORD_BYTES, {
      profile: 'custom',
      opcodeBits: 999,
      addressBits: 0,
      wordBits: -4,
    });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(String(result.frame.fields[0]?.rawValue)).toContain('opcode 2 bit');
    expect(String(result.frame.fields[0]?.rawValue)).toContain('address 6 bit');
    expect(String(result.frame.fields[0]?.rawValue)).toContain('word 16 bit');
  });

  it("tanınmayan profil kimliği varsayılan preset'e düşer", () => {
    const result = parseMicrowire(READ_WORD_BYTES, { profile: '93xx66-x16' });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(String(result.frame.fields[0]?.rawValue)).toContain('93xx46B');
  });
});

describe('microwire eklentisi — uyarılar ve hatalar', () => {
  it('artan bitler uyarı üretir, sessizce yutulmaz', () => {
    const result = parseMicrowire(READ_WORD_BYTES);
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    // 25 clock 32 bite dolduruldu → 7 bit artıyor.
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('trailing-bits');
  });

  it('start bitinden önceki boşta bitler uyarı üretir', () => {
    // 0x62 = 0110 0010 → ilk bit 0, start biti 1. konumda.
    const result = parseMicrowire(Uint8Array.from([0x62, 0xaf, 0xbb, 0xc0]));
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('leading-idle-bits');
  });

  it("93xx56 x16 profilinde don't-care adres biti uyarı olarak bildirilir", () => {
    const result = parseMicrowire(Uint8Array.from([0xc5, 0x5f, 0x77, 0x80]), {
      profile: '93xx56-x16',
    });
    if (!isParseSuccess(result)) throw new Error('çözülmeliydi');
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('address-dont-care');
  });

  it('tamamı sıfır bayt start biti bulunamadığı için reddedilir', () => {
    const result = parseMicrowire(Uint8Array.from([0x00, 0x00, 0x00]));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('start-delimiter-not-found');
  });

  it('boş arabellek reddedilir', () => {
    const result = parseMicrowire(new Uint8Array());
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
  });

  it('veri sözcüğü yarım kalırsa truncated — yarım okunan değer BASILMAZ', () => {
    // READ komutu 25 bit ister, yalnız 16 bit var.
    const result = parseMicrowire(Uint8Array.from([0xc5, 0x5f]));
    expect(isParseSuccess(result)).toBe(false);
    if (isParseSuccess(result)) return;
    expect(result.error.code).toBe('truncated-frame');
  });
});

describe('microwire eklentisi — örnek çerçeveler', () => {
  it('her örnek varsayılan profille çözülür', () => {
    for (const example of microwirePlugin.exampleFrames) {
      const result = microwireParser.parse(example.bytes);
      expect(isParseSuccess(result), `örnek çözülmedi: ${example.id}`).toBe(true);
    }
  });

  it('örneklerin komutları datasheet satırlarıyla eşleşir', () => {
    const expected: Record<string, string> = {
      'read-word': 'READ',
      'write-word': 'WRITE',
      erase: 'ERASE',
      ewen: 'EWEN',
    };
    for (const example of microwirePlugin.exampleFrames) {
      const result = microwireParser.parse(example.bytes);
      if (!isParseSuccess(result)) throw new Error(`çözülmeliydi: ${example.id}`);
      expect(fieldById(result.frame.fields, 'opcode').physicalValue).toBe(expected[example.id]);
    }
  });
});
