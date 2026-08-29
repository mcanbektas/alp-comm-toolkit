import { describe, expect, it } from 'vitest';

import { dataTypeWidth, decodeA2lMeasurement } from './a2lDecoder';
import type { A2lCompuMethod, A2lMeasurement, A2lVerbalTable } from './a2lTypes';

/**
 * Beklenen sayılar fixture'dan okunmuyor, burada bağımsızca yazılıyor — iki
 * yer aynı kaynaktan beslenirse fixture'daki hata testte de tekrarlanır.
 */
function measurement(overrides: Partial<A2lMeasurement> = {}): A2lMeasurement {
  return {
    name: 'X',
    longIdentifier: '',
    dataType: 'UWORD',
    conversion: 'CM',
    lowerLimit: 0,
    upperLimit: 0,
    ...overrides,
  };
}

function method(overrides: Partial<A2lCompuMethod> = {}): A2lCompuMethod {
  return { name: 'CM', longIdentifier: '', conversionType: 'IDENTICAL', unit: '', ...overrides };
}

describe('dataTypeWidth', () => {
  it('ASAM tiplerinin bayt genişliğini verir', () => {
    expect(dataTypeWidth('UBYTE')).toBe(1);
    expect(dataTypeWidth('SWORD')).toBe(2);
    expect(dataTypeWidth('FLOAT32_IEEE')).toBe(4);
    expect(dataTypeWidth('A_UINT64')).toBe(8);
  });
});

describe('decodeA2lMeasurement', () => {
  it('MSB_LAST (ASAM varsayılanı) little-endian okur', () => {
    const result = decodeA2lMeasurement(measurement(), Uint8Array.from([0xa0, 0x0f]), 'MSB_LAST', null, null);
    expect(result).toMatchObject({ rawValue: 0x0f_a0 });
  });

  it('MSB_FIRST big-endian okur — aynı baytlar BAŞKA sayı verir', () => {
    const result = decodeA2lMeasurement(measurement(), Uint8Array.from([0xa0, 0x0f]), 'MSB_FIRST', null, null);
    expect(result).toMatchObject({ rawValue: 0xa0_0f });
  });

  it('girdinin kendi BYTE_ORDER’ı modül varsayılanını EZER', () => {
    const result = decodeA2lMeasurement(
      measurement({ byteOrder: 'MSB_FIRST' }),
      Uint8Array.from([0xa0, 0x0f]),
      'MSB_LAST',
      null,
      null,
    );
    expect(result).toMatchObject({ rawValue: 0xa0_0f });
  });

  it('işaretli tipi iki tümleyen okur', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'SWORD' }),
      Uint8Array.from([0xff, 0xff]),
      'MSB_FIRST',
      null,
      null,
    );
    expect(result).toMatchObject({ rawValue: -1 });
  });

  it('64-bit tipi `bigint` tutar — 2^53 üstünde yuvarlanmaz', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'A_UINT64' }),
      Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
      'MSB_FIRST',
      null,
      null,
    );
    expect(result).toMatchObject({ rawValue: 18_446_744_073_709_551_615n });
  });

  it('FLOAT32_IEEE okur', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'FLOAT32_IEEE' }),
      Uint8Array.from([0x42, 0x48, 0x00, 0x00]),
      'MSB_FIRST',
      null,
      null,
    );
    expect(result).toMatchObject({ rawValue: 50 });
  });

  it('BIT_MASK’i uygular VE sonucu sağa kaydırır', () => {
    const result = decodeA2lMeasurement(
      measurement({ bitMask: 0x0f_00 }),
      Uint8Array.from([0x05, 0x00]),
      'MSB_FIRST',
      null,
      null,
    );
    // 0x0500 & 0x0F00 = 0x0500 → 8 bit sağa → 5. Kaydırmayan bir uygulama
    // 1280 basardı.
    expect(result).toMatchObject({ rawValue: 5 });
  });

  it('LINEAR’ı DOĞRUDAN yönde uygular (phys = a×int + b)', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'UBYTE' }),
      Uint8Array.from([180]),
      'MSB_FIRST',
      method({ conversionType: 'LINEAR', coeffsLinear: [0.5, -40], unit: 'degC' }),
      null,
    );
    expect(result).toMatchObject({ rawValue: 180, physicalValue: 50, unit: 'degC' });
  });

  it('RAT_FUNC’u TERS yönde çözer — katsayılar phys→int tanımlıdır', () => {
    // int = (0·p² + 4·p + 0)/(0·p² + 0·p + 1) = 4p  →  phys = int/4
    const result = decodeA2lMeasurement(
      measurement(),
      Uint8Array.from([0x0f, 0xa0]),
      'MSB_FIRST',
      method({ conversionType: 'RAT_FUNC', coeffs: [0, 4, 0, 0, 0, 1], unit: 'rpm' }),
      null,
    );
    // Katsayıyı doğrudan çarpan sanan bir uygulama 16000 basardı.
    expect(result).toMatchObject({ rawValue: 4000, physicalValue: 1000, unit: 'rpm' });
  });

  it('RAT_FUNC’ta ofsetli ters çözüm doğru: phys = (f·int − c)/b', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'UBYTE' }),
      Uint8Array.from([100]),
      'MSB_FIRST',
      method({ conversionType: 'RAT_FUNC', coeffs: [0, 2, 10, 0, 0, 1] }),
      null,
    );
    expect(result).toMatchObject({ physicalValue: 45 }); // (1×100 − 10)/2
  });

  it('ikinci dereceli RAT_FUNC’ta fiziksel değer UYDURMAZ, nedenini söyler', () => {
    const result = decodeA2lMeasurement(
      measurement(),
      Uint8Array.from([0x00, 0x64]),
      'MSB_FIRST',
      method({ conversionType: 'RAT_FUNC', coeffs: [1, 2, 3, 0, 0, 1] }),
      null,
    );
    expect(result).toMatchObject({
      rawValue: 100,
      physicalValue: 100,
      conversionNoteKey: 'definition.a2l.note.nonLinearRatFunc',
    });
  });

  it('TAB_VERB sözlüğünden sözel karşılığı basar', () => {
    const table: A2lVerbalTable = {
      name: 'VT',
      longIdentifier: '',
      values: { '0': 'Neutral', '1': 'First' },
    };
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'UBYTE' }),
      Uint8Array.from([1]),
      'MSB_FIRST',
      method({ conversionType: 'TAB_VERB', compuTabRef: 'VT' }),
      table,
    );
    expect(result).toMatchObject({ rawValue: 1, physicalValue: 'First' });
  });

  it('sözlükte karşılığı olmayan değeri UYDURMAZ', () => {
    const table: A2lVerbalTable = { name: 'VT', longIdentifier: '', values: { '0': 'Neutral' } };
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'UBYTE' }),
      Uint8Array.from([9]),
      'MSB_FIRST',
      method({ conversionType: 'TAB_VERB', compuTabRef: 'VT' }),
      table,
    );
    expect(result).toMatchObject({
      physicalValue: 9,
      conversionNoteKey: 'definition.a2l.note.noVerbalMatch',
    });
  });

  it('desteklenmeyen dönüşümde (FORM) ham değeri gösterir ve nedenini söyler', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'UBYTE' }),
      Uint8Array.from([7]),
      'MSB_FIRST',
      method({ conversionType: 'FORM' }),
      null,
    );
    expect(result).toMatchObject({
      physicalValue: 7,
      conversionNoteKey: 'definition.a2l.note.formulaUnsupported',
    });
  });

  it('bayt yetmiyorsa çözmez ve KAÇ bayt gerektiğini söyler', () => {
    const result = decodeA2lMeasurement(
      measurement({ dataType: 'FLOAT32_IEEE' }),
      Uint8Array.from([0x42, 0x48]),
      'MSB_FIRST',
      null,
      null,
    );
    expect(result).toEqual({
      success: false,
      messageKey: 'definition.a2l.decode.tooShort',
      requiredBytes: 4,
    });
  });
});
