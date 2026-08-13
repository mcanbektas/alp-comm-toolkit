import { describe, expect, it } from 'vitest';

import { alignToByte, readBits, readBitsAsNumber, toSignedBits, writeBits } from './bitCursor';

describe('readBits — msb-first', () => {
  it('tek baytın üst nibble\'ını okur', () => {
    // 0xA5 = 1010 0101 → üst 4 bit = 1010 = 0xA
    expect(readBits(Uint8Array.from([0xa5]), 0, 4)).toBe(0xan);
    expect(readBits(Uint8Array.from([0xa5]), 4, 4)).toBe(0x5n);
  });

  it('bayt sınırını AŞAN alanı okur — bitOps bunu yapamıyordu', () => {
    // 0x0F 0xF0 = 0000 1111 1111 0000; bit 4'ten 8 bit = 1111 1111 = 0xFF
    expect(readBits(Uint8Array.from([0x0f, 0xf0]), 4, 8)).toBe(0xffn);
  });

  it('üç bayta yayılan alanı okur', () => {
    // 0xFF 0xFF 0xFF, bit 3'ten 20 bit → hepsi 1 → 2^20-1
    expect(readBits(Uint8Array.from([0xff, 0xff, 0xff]), 3, 20)).toBe((1n << 20n) - 1n);
  });

  it('64 bitlik alanı kayıpsız okur — Number olsaydı yuvarlanırdı', () => {
    const bytes = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    const value = readBits(bytes, 0, 64);
    expect(value).toBe(0xffff_ffff_ffff_ffffn);

    // Number'a çevirip geri dönmek DEĞERİ BOZAR — bigint dönmenin sebebi bu.
    // (Literal karşılaştırması işe yaramaz: 0xffff_ffff_ffff_ffff yazıldığı an
    // zaten yuvarlanmış bir Number'dır, iki taraf da aynı yanlış değeri taşır.)
    expect(BigInt(Number(value))).not.toBe(value);
  });

  it('sıfır uzunluk sıfır verir', () => {
    expect(readBits(Uint8Array.from([0xff]), 0, 0)).toBe(0n);
  });

  it('tek bit okur', () => {
    // 0x80 = 1000 0000
    expect(readBits(Uint8Array.from([0x80]), 0, 1)).toBe(1n);
    expect(readBits(Uint8Array.from([0x80]), 1, 1)).toBe(0n);
  });
});

describe('readBits — lsb-first', () => {
  it('bit 0 ilk baytın EN DÜŞÜK bitidir', () => {
    // 0x01 = 0000 0001 → lsb-first'te bit 0 = 1
    expect(readBits(Uint8Array.from([0x01]), 0, 1, 'lsb-first')).toBe(1n);
    // msb-first'te aynı bit 0'dır — sıra seçimi değeri değiştirir
    expect(readBits(Uint8Array.from([0x01]), 0, 1, 'msb-first')).toBe(0n);
  });

  it('alt nibble\'ı okur', () => {
    // 0xA5 = 1010 0101 → lsb-first ilk 4 bit = 0101 = 5
    expect(readBits(Uint8Array.from([0xa5]), 0, 4, 'lsb-first')).toBe(0x5n);
  });

  it('bayt sınırını aşan alanda bitleri düşükten yükseğe dizer', () => {
    // 0x0F 0xF0: lsb-first bit 4'ten 8 bit
    // bitler: byte0 bit4..7 = 0,0,0,0 ; byte1 bit0..3 = 0,0,0,0
    expect(readBits(Uint8Array.from([0x0f, 0xf0]), 4, 8, 'lsb-first')).toBe(0x00n);
  });
});

describe('readBits — sınır denetimi', () => {
  it('arabelleği aşan aralığı reddeder', () => {
    expect(() => readBits(Uint8Array.from([0xff]), 4, 8)).toThrow(RangeError);
    expect(() => readBits(new Uint8Array(0), 0, 1)).toThrow(RangeError);
  });

  it('negatif konum ve uzunluğu reddeder', () => {
    expect(() => readBits(Uint8Array.from([0xff]), -1, 4)).toThrow(RangeError);
    expect(() => readBits(Uint8Array.from([0xff]), 0, -4)).toThrow(RangeError);
  });
});

describe('readBitsAsNumber', () => {
  it('53 bite kadar sayı verir', () => {
    expect(readBitsAsNumber(Uint8Array.from([0xa5]), 0, 4)).toBe(10);
  });

  it('53 bitten geniş istenirse atar — sessiz yuvarlama yerine hata', () => {
    const bytes = new Uint8Array(8).fill(0xff);
    expect(() => readBitsAsNumber(bytes, 0, 64)).toThrow(RangeError);
  });
});

describe('toSignedBits', () => {
  it('spec §9.3 örneği: 0xF6 8 bitte -10 olur', () => {
    expect(toSignedBits(0xf6n, 8)).toBe(-10n);
  });

  it('işaret biti sıfırken değer değişmez', () => {
    expect(toSignedBits(0x7fn, 8)).toBe(127n);
  });

  it('dar alanlarda da çalışır', () => {
    // 4 bitte 0b1111 = -1
    expect(toSignedBits(0b1111n, 4)).toBe(-1n);
    expect(toSignedBits(0b0111n, 4)).toBe(7n);
  });

  it('64 bitte işaret çözümü kayıpsızdır', () => {
    expect(toSignedBits(0xffff_ffff_ffff_ffffn, 64)).toBe(-1n);
  });
});

describe('writeBits', () => {
  it('yazılan değer aynı sırayla geri okunur', () => {
    for (const bitOrder of ['msb-first', 'lsb-first'] as const) {
      const target = new Uint8Array(4);
      writeBits(target, 5, 13, 0x1abcn & ((1n << 13n) - 1n), bitOrder);

      expect(readBits(target, 5, 13, bitOrder)).toBe(0x1abcn & ((1n << 13n) - 1n));
    }
  });

  it('komşu bitlere DOKUNMAZ — alanlar aynı baytı paylaşabilir', () => {
    const target = Uint8Array.from([0xff, 0xff]);
    writeBits(target, 4, 4, 0x0n);

    // İlk 4 bit korunmalı, son 4 bit sıfırlanmalı.
    expect(target[0]).toBe(0xf0);
    expect(target[1]).toBe(0xff);
  });

  it('iki alan aynı bayta yan yana yazılabilir', () => {
    const target = new Uint8Array(1);
    writeBits(target, 0, 4, 0xan);
    writeBits(target, 4, 4, 0x5n);

    expect(target[0]).toBe(0xa5);
  });

  it('bayt sınırını aşan yazma doğru dağıtılır', () => {
    const target = new Uint8Array(2);
    writeBits(target, 4, 8, 0xffn);

    expect(target[0]).toBe(0x0f);
    expect(target[1]).toBe(0xf0);
  });

  it('64 bitlik değeri kayıpsız yazar', () => {
    const target = new Uint8Array(8);
    const value = 0x0123_4567_89ab_cdefn;
    writeBits(target, 0, 64, value);

    expect(readBits(target, 0, 64)).toBe(value);
  });

  it('arabelleği aşan yazmayı reddeder', () => {
    expect(() => writeBits(new Uint8Array(1), 4, 8, 0xffn)).toThrow(RangeError);
  });

  it('sıfır uzunlukta hiçbir şey yazmaz', () => {
    const target = Uint8Array.from([0xaa]);
    writeBits(target, 0, 0, 0xffn);

    expect(target[0]).toBe(0xaa);
  });
});

describe('alignToByte', () => {
  it('bayt sınırındaki konumu değiştirmez', () => {
    expect(alignToByte(0)).toBe(0);
    expect(alignToByte(8)).toBe(8);
  });

  it('sınır arasındaki konumu yukarı yuvarlar', () => {
    expect(alignToByte(1)).toBe(8);
    expect(alignToByte(7)).toBe(8);
    expect(alignToByte(9)).toBe(16);
  });
});
