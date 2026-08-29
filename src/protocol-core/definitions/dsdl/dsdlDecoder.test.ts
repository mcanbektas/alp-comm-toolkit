import { describe, expect, it } from 'vitest';

import { decodeDsdlField, isDecodableField } from './dsdlDecoder';
import { SAMPLE_DSDL_BYTES, SAMPLE_DSDL_TEXT } from './dsdlFixture';
import { parseDsdl } from './dsdlParser';
import type { DsdlField } from './dsdlTypes';

function field(overrides: Partial<DsdlField> = {}): DsdlField {
  return {
    name: 'x',
    typeText: 'uint8',
    primitive: { kind: 'unsigned', bitLength: 8 },
    bitOffset: 0,
    bitLength: 8,
    ...overrides,
  };
}

describe('isDecodableField', () => {
  it('yalnız konumu ve genişliği bilinen İLKEL alanları çözülebilir sayar', () => {
    expect(isDecodableField(field())).toBe(true);
    // Konum bilinmiyor (değişken dizi sonrası).
    expect(isDecodableField({ ...field(), bitOffset: undefined })).toBe(false);
    // Dolgu okunmaz.
    expect(isDecodableField(field({ primitive: { kind: 'void', bitLength: 7 } }))).toBe(false);
    // Dizi tek değer değildir.
    expect(isDecodableField(field({ array: { mode: 'fixed', capacity: 4 } }))).toBe(false);
  });
});

describe('decodeDsdlField — LSB-first, küçük endian', () => {
  it('bayt hizalı `uint16`ı küçük endian okur', () => {
    const result = decodeDsdlField(
      field({ primitive: { kind: 'unsigned', bitLength: 16 }, bitLength: 16 }),
      Uint8Array.from([0xd2, 0x04]),
    );
    // MSB-first okuyan bir uygulama 0xD204 = 53764 basardı.
    expect(result).toMatchObject({ rawValue: 1234n, displayValue: '1234' });
  });

  it('bayt hizasına oturmayan iki dörtlüğü ayrı ayrı okur', () => {
    const bytes = Uint8Array.from([0x21]);
    const low = decodeDsdlField(
      field({ primitive: { kind: 'unsigned', bitLength: 4 }, bitOffset: 0, bitLength: 4 }),
      bytes,
    );
    const high = decodeDsdlField(
      field({ primitive: { kind: 'unsigned', bitLength: 4 }, bitOffset: 4, bitLength: 4 }),
      bytes,
    );
    expect(low).toMatchObject({ rawValue: 1n });
    expect(high).toMatchObject({ rawValue: 2n });
  });

  it('işaretli alanı iki tümleyen okur', () => {
    const result = decodeDsdlField(
      field({ primitive: { kind: 'signed', bitLength: 16 }, bitLength: 16 }),
      Uint8Array.from([0xd4, 0xfe]),
    );
    expect(result).toMatchObject({ rawValue: -300n });
  });

  it('float32 okur', () => {
    const result = decodeDsdlField(
      field({ primitive: { kind: 'float', bitLength: 32 }, bitLength: 32 }),
      Uint8Array.from([0x00, 0x00, 0x48, 0x42]),
    );
    expect(result).toMatchObject({ displayValue: '50' });
  });

  it('float16’yı elle açar', () => {
    // 0x5140 = 42.0 yarı duyarlıkta; küçük endian → 40 51
    const result = decodeDsdlField(
      field({ primitive: { kind: 'float', bitLength: 16 }, bitLength: 16 }),
      Uint8Array.from([0x40, 0x51]),
    );
    expect(result).toMatchObject({ displayValue: '42' });
  });

  it('bool alanını tek bitten okur', () => {
    const result = decodeDsdlField(
      field({ primitive: { kind: 'bool', bitLength: 1 }, bitLength: 1 }),
      Uint8Array.from([0x01]),
    );
    expect(result).toMatchObject({ rawValue: true, displayValue: 'true' });
  });

  it('konumu bilinmeyen alanı ÇÖZMEZ', () => {
    const result = decodeDsdlField({ ...field(), bitOffset: undefined }, Uint8Array.from([1]));
    expect(result).toEqual({ success: false, messageKey: 'definition.dsdl.decode.noLayout' });
  });

  it('bayt yetmiyorsa kaç bayt gerektiğini söyler', () => {
    const result = decodeDsdlField(
      field({ primitive: { kind: 'unsigned', bitLength: 32 }, bitOffset: 8, bitLength: 32 }),
      Uint8Array.from([0x00, 0x01]),
    );
    expect(result).toEqual({
      success: false,
      messageKey: 'definition.dsdl.decode.tooShort',
      requiredBytes: 5,
    });
  });
});

describe('örnek tanım + örnek baytlar — uçtan uca', () => {
  it('altı alanı da doğru çözer', () => {
    const parsed = parseDsdl(SAMPLE_DSDL_TEXT);
    if (!parsed.success) throw new Error('okunamadı');
    const section = parsed.definition.sections[0];
    if (section === undefined) throw new Error('bölüm yok');

    const byName = (name: string): DsdlField => {
      const found = section.fields.find((entry) => entry.name === name);
      if (found === undefined) throw new Error(`alan yok: ${name}`);
      return found;
    };

    expect(decodeDsdlField(byName('sequence'), SAMPLE_DSDL_BYTES)).toMatchObject({ displayValue: '1234' });
    expect(decodeDsdlField(byName('mode'), SAMPLE_DSDL_BYTES)).toMatchObject({ displayValue: '1' });
    expect(decodeDsdlField(byName('health'), SAMPLE_DSDL_BYTES)).toMatchObject({ displayValue: '2' });
    expect(decodeDsdlField(byName('temperature_deci'), SAMPLE_DSDL_BYTES)).toMatchObject({
      displayValue: '300',
    });
    expect(decodeDsdlField(byName('voltage'), SAMPLE_DSDL_BYTES)).toMatchObject({ displayValue: '50' });
    expect(decodeDsdlField(byName('armed'), SAMPLE_DSDL_BYTES)).toMatchObject({ displayValue: 'true' });
  });
});
