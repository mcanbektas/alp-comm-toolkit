import { describe, expect, it } from 'vitest';

import { SAMPLE_A2L_TEXT } from './a2lFixture';
import { findCompuMethod, findVerbalTable, parseA2l, tokenizeA2l } from './a2lParser';

describe('tokenizeA2l', () => {
  it('tırnaklı dizgeyi TEK belirteç sayar, boşluğu bölmez', () => {
    const tokens = tokenizeA2l('MEASUREMENT Devir "Motor devri, filtreli" UWORD');
    expect(tokens.map((token) => token.text)).toEqual([
      'MEASUREMENT',
      'Devir',
      'Motor devri, filtreli',
      'UWORD',
    ]);
    expect(tokens[2]?.quoted).toBe(true);
  });

  it('blok ve satır yorumlarını atar', () => {
    const tokens = tokenizeA2l('A /* yorum\n devam */ B // satır sonu\nC');
    expect(tokens.map((token) => token.text)).toEqual(['A', 'B', 'C']);
  });

  it('tırnak içindeki yorum işaretini VERİ sayar', () => {
    const tokens = tokenizeA2l('X "/* bu yorum değil */" Y');
    expect(tokens[1]).toMatchObject({ text: '/* bu yorum değil */', quoted: true });
  });

  it('satır numarasını yorumlar boyunca korur', () => {
    const tokens = tokenizeA2l('A\n\n/* iki\nsatır */\nB');
    expect(tokens.find((token) => token.text === 'B')?.line).toBe(5);
  });
});

describe('parseA2l', () => {
  it('proje, modül ve modül varsayılan bayt sırasını okur', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.database.project).toBe('ALP_DEMO');
    expect(result.database.module).toBe('ECU_MAIN');
    expect(result.database.defaultByteOrder).toBe('MSB_LAST');
  });

  it('beş ölçümü sırasıyla ve alanlarıyla okur', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(result.database.measurements).toHaveLength(5);
    expect(result.database.measurements[0]).toMatchObject({
      name: 'EngineSpeed',
      longIdentifier: 'Motor devri',
      dataType: 'UWORD',
      conversion: 'CM_EngineSpeed',
      ecuAddress: 0x80_01_00,
      unit: 'rpm',
    });
  });

  it('girdiye özel BYTE_ORDER ve BIT_MASK alanlarını taşır', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    const throttle = result.database.measurements.find((item) => item.name === 'ThrottlePosition');
    expect(throttle?.byteOrder).toBe('MSB_FIRST');

    const lamp = result.database.measurements.find((item) => item.name === 'LampState');
    expect(lamp?.bitMask).toBe(0x0f_00);
  });

  it('kapsam dışı blokları (RECORD_LAYOUT, IF_DATA) SESSİZCE atlar', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    // İç içe blok taşıyan IF_DATA'dan sonra da ayrıştırma sürmeli: sürmezse
    // ondan sonraki hiçbir blok okunmazdı.
    expect(result.issues).toEqual([]);
    expect(result.database.characteristics).toHaveLength(1);
  });

  it('CHARACTERISTIC adresini ve dönüşümünü okur', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(result.database.characteristics[0]).toMatchObject({
      name: 'IdleSetpoint',
      type: 'VALUE',
      address: 0x81_00_00,
      conversion: 'CM_EngineSpeed',
    });
  });

  it('RAT_FUNC katsayılarını altı sayı olarak alır', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    const method = findCompuMethod(result.database, 'CM_EngineSpeed');
    expect(method).toMatchObject({ conversionType: 'RAT_FUNC', coeffs: [0, 4, 0, 0, 0, 1], unit: 'rpm' });
  });

  it('LINEAR katsayılarını ikili olarak alır', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(findCompuMethod(result.database, 'CM_Temperature')).toMatchObject({
      conversionType: 'LINEAR',
      coeffsLinear: [0.5, -40],
    });
  });

  it('COMPU_VTAB sözlüğünü okur ve COMPU_TAB_REF ile bağlar', () => {
    const result = parseA2l(SAMPLE_A2L_TEXT);
    if (!result.success) throw new Error('dosya okunamadı');

    const method = findCompuMethod(result.database, 'CM_Gear');
    const table = findVerbalTable(result.database, method?.compuTabRef);
    expect(table?.values).toEqual({ '0': 'Neutral', '1': 'First', '2': 'Second', '3': 'Third' });
  });

  it('`NO_COMPU_METHOD` dönüşüm adı olarak TAŞINMAZ', () => {
    const text = `/begin PROJECT P ""
      /begin MODULE M ""
        /begin MEASUREMENT Ham "Ham sayaç" ULONG NO_COMPU_METHOD 0 0 0 100 /end MEASUREMENT
      /end MODULE
    /end PROJECT`;
    const result = parseA2l(text);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(result.database.measurements[0]?.conversion).toBe('');
  });

  it('bozuk ölçümü atlar, sorun yazar ve ayrıştırmayı SÜRDÜRÜR', () => {
    const text = `/begin PROJECT P ""
      /begin MODULE M ""
        /begin MEASUREMENT Bozuk "Tip yok" QUANTUM CM 0 0 0 1 /end MEASUREMENT
        /begin MEASUREMENT Saglam "İyi" UBYTE CM 0 0 0 255 /end MEASUREMENT
      /end MODULE
    /end PROJECT`;
    const result = parseA2l(text);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(result.database.measurements).toHaveLength(1);
    expect(result.database.measurements[0]?.name).toBe('Saglam');
    expect(result.issues[0]?.messageKey).toBe('definition.a2l.issue.badMeasurement');
  });

  it('tanınmayan dönüşüm türünü UNKNOWN yapar ve bildirir', () => {
    const text = `/begin PROJECT P ""
      /begin MODULE M ""
        /begin MEASUREMENT X "" UBYTE CM_X 0 0 0 1 /end MEASUREMENT
        /begin COMPU_METHOD CM_X "" QUADRATIC "%6.1" "" /end COMPU_METHOD
      /end MODULE
    /end PROJECT`;
    const result = parseA2l(text);
    if (!result.success) throw new Error('dosya okunamadı');

    expect(findCompuMethod(result.database, 'CM_X')?.conversionType).toBe('UNKNOWN');
    expect(result.issues.some((issue) => issue.messageKey === 'definition.a2l.issue.unknownConversion')).toBe(
      true,
    );
  });

  it('hiç ölçüm/parametre yoksa başarısız olur', () => {
    const result = parseA2l('/begin PROJECT P ""\n/end PROJECT');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.a2l.issue.noObjects');
  });
});
