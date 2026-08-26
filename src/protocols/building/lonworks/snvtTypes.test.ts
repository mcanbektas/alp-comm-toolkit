import { describe, expect, it } from 'vitest';

import {
  SNVT_RAW,
  SNVT_SCALAR_TYPES,
  applySnvtScale,
  findSnvtType,
  readSnvtRawValue,
} from './snvtTypes';

/**
 * Faz 10 dalga 17 — SNVT ölçek tablosu.
 *
 * Bu dosyanın ASIL işi ölçek formülünü teste BAĞLAMAKTIR: `A × 10^B × (ham+C)`
 * ile `(A × 10^B) × ham + C` `SNVT_temp`te ~2466 °C ayrışıyor ve yanlış olan
 * HATA VERMEZ. Aşağıda iki formül de hesaplanır ve AYRIŞTIKLARI assert edilir;
 * doğru olanın hangisi olduğu LonMark'ın yayımlanmış değerine bağlanır.
 */

/** Örnek 1)'in NV yükü `00 CA` = 202 — beş tipte beş farklı mühendislik değeri. */
const RAW_00_CA = 202;

describe('SNVT ölçek tablosu', () => {
  it('yalnız skaler, ölçek üçlüsü DOLU ve güncel tipleri taşır', () => {
    expect(SNVT_SCALAR_TYPES.length).toBeGreaterThanOrEqual(70);
    for (const type of SNVT_SCALAR_TYPES) {
      expect(type.name.startsWith('SNVT_'), type.name).toBe(true);
      expect(type.index).toBeGreaterThan(0);
      expect([1, 2]).toContain(type.size);
      expect(Number.isFinite(type.a) && Number.isFinite(type.b) && Number.isFinite(type.c)).toBe(true);
    }
  });

  it('indeksler ve adlar BENZERSİZDİR — `nvPayloadType` şık listesi bu tablodan üretiliyor', () => {
    const names = new Set(SNVT_SCALAR_TYPES.map((type) => type.name));
    const indexes = new Set(SNVT_SCALAR_TYPES.map((type) => type.index));
    expect(names.size).toBe(SNVT_SCALAR_TYPES.length);
    expect(indexes.size).toBe(SNVT_SCALAR_TYPES.length);
    // `raw` ayrılmış bir şık değeridir; bir SNVT adıyla çakışamaz.
    expect(names.has(SNVT_RAW)).toBe(false);
  });

  it('LonMark`ın yayımlanmış ölçek üçlüleri BİREBİR duruyor', () => {
    // lonmark.org/nvs/ tip sayfalarından çıkarıldı (2026-08-26).
    const expected = [
      { name: 'SNVT_amp', index: 1, size: 2, signed: true, a: 1, b: -1, c: 0 },
      { name: 'SNVT_count', index: 8, size: 2, signed: false, a: 1, b: 0, c: 0 },
      { name: 'SNVT_temp', index: 39, size: 2, signed: false, a: 1, b: -1, c: -2740 },
      { name: 'SNVT_lev_percent', index: 81, size: 2, signed: true, a: 5, b: -3, c: 0 },
      { name: 'SNVT_angle_deg', index: 104, size: 2, signed: true, a: 2, b: -2, c: 0 },
      { name: 'SNVT_temp_p', index: 105, size: 2, signed: true, a: 1, b: -2, c: 0 },
    ];
    for (const row of expected) {
      const type = findSnvtType(row.name);
      expect(type, row.name).toBeDefined();
      expect({ ...type, unit: undefined }).toMatchObject({ ...row, unit: undefined });
    }
  });
});

describe('ölçek formülü — `A × 10^B × (ham + C)`', () => {
  it('AYNI iki bayt (`00 CA`) beş tipte BEŞ FARKLI mühendislik değeri verir', () => {
    const read = (name: string): number => {
      const type = findSnvtType(name);
      if (type === undefined) throw new Error(`missing SNVT type ${name}`);
      const bytes = type.size === 1 ? Uint8Array.from([0xca]) : Uint8Array.from([0x00, 0xca]);
      const raw = readSnvtRawValue(bytes, type);
      if (raw === undefined) throw new Error(`unreadable ${name}`);
      return applySnvtScale(raw, type);
    };
    expect(read('SNVT_temp')).toBe(-253.8);
    expect(read('SNVT_temp_p')).toBe(2.02);
    expect(read('SNVT_lev_percent')).toBe(1.01);
    expect(read('SNVT_amp')).toBe(20.2);
    expect(read('SNVT_count')).toBe(202);
  });

  it('`(A × 10^B) × ham + C` YANLIŞ formülü `SNVT_temp`te ~2466 °C sapar', () => {
    const type = findSnvtType('SNVT_temp');
    if (type === undefined) throw new Error('missing SNVT_temp');
    const correct = applySnvtScale(RAW_00_CA, type);
    const wrong = type.a * Math.pow(10, type.b) * RAW_00_CA + type.c;
    expect(correct).toBe(-253.8);
    expect(wrong).toBeCloseTo(-2719.8, 6);
    // Sessiz yanlışın büyüklüğü: iki formül ~2466 birim ayrışıyor ve İKİSİ DE
    // hata vermiyor. Parantezi kaybeden bir düzenleme bu testi kırar.
    expect(Math.abs(correct - wrong)).toBeGreaterThan(2465);
  });

  it('`C` sıfır olan tiplerde iki formül AYNI sonucu verir — tuzağın gizlendiği yer burasıdır', () => {
    const type = findSnvtType('SNVT_amp');
    if (type === undefined) throw new Error('missing SNVT_amp');
    const correct = applySnvtScale(RAW_00_CA, type);
    const wrong = type.a * Math.pow(10, type.b) * RAW_00_CA + type.c;
    expect(correct).toBeCloseTo(wrong, 9);
    // Katalogdaki 75 tipin YALNIZ BİRİNDE `C` sıfırdan farklı; yanlış formül
    // 74 tipte doğru sonuç verir ve yalnız `SNVT_temp`te patlar.
    expect(SNVT_SCALAR_TYPES.filter((candidate) => candidate.c !== 0)).toHaveLength(1);
  });

  it('kayan nokta gürültüsü tipin ÇÖZÜNÜRLÜĞÜNE yuvarlanır', () => {
    const type = findSnvtType('SNVT_amp');
    if (type === undefined) throw new Error('missing SNVT_amp');
    // Ham çarpım 20.200000000000003 üretir; ekranda o basılmamalı.
    expect(type.a * Math.pow(10, type.b) * (RAW_00_CA + type.c)).not.toBe(20.2);
    expect(applySnvtScale(RAW_00_CA, type)).toBe(20.2);
  });
});

describe('ham değer okuma — BÜYÜK ENDIAN ve işaret', () => {
  it('iki baytlık işaretsiz tip big-endian okunur', () => {
    const type = findSnvtType('SNVT_count');
    if (type === undefined) throw new Error('missing SNVT_count');
    expect(readSnvtRawValue(Uint8Array.from([0x01, 0x00]), type)).toBe(256);
    // Little-endian okumak HATA VERMEZ, yalnız ters sayı basar — bu assert onu keser.
    expect(readSnvtRawValue(Uint8Array.from([0x01, 0x00]), type)).not.toBe(1);
  });

  it('işaretli tipte 0x8000 negatif okunur', () => {
    const type = findSnvtType('SNVT_amp');
    if (type === undefined) throw new Error('missing SNVT_amp');
    expect(readSnvtRawValue(Uint8Array.from([0xff, 0xff]), type)).toBe(-1);
    expect(readSnvtRawValue(Uint8Array.from([0x80, 0x00]), type)).toBe(-32768);
  });

  it('tek baytlık tip kendi boyunda okunur', () => {
    const type = findSnvtType('SNVT_lev_cont');
    if (type === undefined) throw new Error('missing SNVT_lev_cont');
    expect(type.size).toBe(1);
    expect(readSnvtRawValue(Uint8Array.from([200]), type)).toBe(200);
    expect(applySnvtScale(200, type)).toBe(100);
  });

  it('uzunluk uymuyorsa `undefined` döner — uydurma değer üretilmez', () => {
    const type = findSnvtType('SNVT_temp');
    if (type === undefined) throw new Error('missing SNVT_temp');
    expect(readSnvtRawValue(Uint8Array.from([0x00]), type)).toBeUndefined();
    expect(readSnvtRawValue(Uint8Array.from([0x00, 0x00, 0x00]), type)).toBeUndefined();
  });

  it('bilinmeyen tip adı `undefined` döner', () => {
    expect(findSnvtType('SNVT_not_a_real_type')).toBeUndefined();
    expect(findSnvtType(SNVT_RAW)).toBeUndefined();
  });
});
