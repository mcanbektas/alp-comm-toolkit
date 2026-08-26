import { describe, expect, it } from 'vitest';

import {
  applyWhitening,
  PN9_WHITENING,
  validateWhiteningConfig,
  whiteningSequence,
} from './lfsrWhitening';
import type { LfsrWhiteningConfig } from './lfsrWhitening';

/**
 * TI'ın CC1101/CC2500 belgelerinde yayımlanan PN9 dizisinin ilk dokuz baytı.
 * Bu bir FIXTURE'dır: motor kendi kendini doğrulamadan hiçbir kayda bağlanmaz.
 */
const PUBLISHED_PN9_PREFIX = [0xff, 0xe1, 0x1d, 0x9a, 0xed, 0x85, 0x33, 0x24, 0xea];

describe('lfsrWhitening — PN9 fixture', () => {
  it('yayımlanmış PN9 dizisinin ilk dokuz baytını üretir', () => {
    expect([...whiteningSequence(PN9_WHITENING, PUBLISHED_PN9_PREFIX.length)]).toEqual(
      PUBLISHED_PN9_PREFIX,
    );
  });

  it('PN9 dizisi 511 baytta tekrar eder — 9 bitlik LFSR\'ın azami periyodu', () => {
    // 2⁹ − 1 = 511 bit periyot; bayt hizasına oturması için 511 BAYT gerekir
    // (511 ile 8 aralarında asal). Bu, tap kümesinin gerçekten maksimal uzunluk
    // ürettiğinin kanıtıdır — yanlış bir tap çok daha kısa periyot verirdi.
    const sequence = whiteningSequence(PN9_WHITENING, 511 + 9);
    expect([...sequence.subarray(511, 511 + 9)]).toEqual(PUBLISHED_PN9_PREFIX);
  });

  it('msb-first paketleme BAŞKA bir dizidir — fixture yalnız lsb-first için geçerli', () => {
    const msb = whiteningSequence(PN9_WHITENING, 4, 'msb-first');
    const lsb = whiteningSequence(PN9_WHITENING, 4, 'lsb-first');
    expect([...msb]).not.toEqual([...lsb]);
    // İlk bayt `FF` her iki pakette de aynıdır (sekiz 1 biti simetriktir);
    // ayrım ikinci bayttan itibaren görünür: 0xE1 → bit-ters 0x87.
    expect(msb[0]).toBe(0xff);
    expect(msb[1]).toBe(0x87);
  });
});

describe('lfsrWhitening — XOR kendi tersidir', () => {
  it('iki kez uygulamak özgün baytları geri verir', () => {
    const original = Uint8Array.from([0x01, 0x14, 0x04, 0x34, 0x12, 0x78, 0x56, 0xac, 0x54]);
    const whitened = applyWhitening(original, PN9_WHITENING);
    expect([...whitened]).not.toEqual([...original]);
    expect([...applyWhitening(whitened, PN9_WHITENING)]).toEqual([...original]);
  });

  it('dalga 18e varsayılan profilinin gövdesini brifteki tel baytlarına çevirir', () => {
    // Örnek 2'nin telde görünen gövdesi — bu değer BRİFTEN alınmadı, burada
    // yeniden üretiliyor (CLAUDE.md "brife değil motora inan").
    const body = Uint8Array.from([0x01, 0x14, 0x04, 0x34, 0x12, 0x78, 0x56, 0xac, 0x54]);
    expect([...applyWhitening(body, PN9_WHITENING)]).toEqual([
      0xfe, 0xf5, 0x19, 0xae, 0xff, 0xfd, 0x65, 0x88, 0xbe,
    ]);
  });

  it('tohum değişince dizi tamamen değişir — tohum gerçek bir kanaldır', () => {
    const body = Uint8Array.from([0x01, 0x14, 0x04]);
    const withDefaultSeed = applyWhitening(body, PN9_WHITENING);
    const withOtherSeed = applyWhitening(body, { ...PN9_WHITENING, seed: 0x0ff });
    expect([...withDefaultSeed]).not.toEqual([...withOtherSeed]);
  });

  it('boş girdide boş çıktı verir', () => {
    expect(applyWhitening(new Uint8Array(0), PN9_WHITENING).length).toBe(0);
  });
});

describe('lfsrWhitening — yapısal olarak anlamsız yapılandırma reddedilir', () => {
  const cases: ReadonlyArray<readonly [string, LfsrWhiteningConfig]> = [
    ['genişlik çok küçük', { width: 1, taps: [0], seed: 1 }],
    ['genişlik çok büyük', { width: 32, taps: [0], seed: 1 }],
    ['tap yok', { width: 9, taps: [], seed: 1 }],
    ['tap genişliği aşıyor', { width: 9, taps: [0, 9], seed: 1 }],
    // Sıfır tohumlu Fibonacci LFSR sonsuza kadar sıfır üretir: "beyazlatma
    // açık" derken hiçbir şey yapmaz. Sessizce yanlış çalışmaktansa reddedilir.
    ['tohum sıfır', { width: 9, taps: [0, 5], seed: 0 }],
    ['tohum genişliği aşıyor', { width: 9, taps: [0, 5], seed: 0x200 }],
  ];

  for (const [label, config] of cases) {
    it(`reddeder: ${label}`, () => {
      expect(validateWhiteningConfig(config)).toBeDefined();
      expect(() => whiteningSequence(config, 4)).toThrow();
    });
  }

  it('geçerli yapılandırmayı kabul eder', () => {
    expect(validateWhiteningConfig(PN9_WHITENING)).toBeUndefined();
  });

  it('negatif bayt sayısını reddeder', () => {
    expect(() => whiteningSequence(PN9_WHITENING, -1)).toThrow();
  });
});
