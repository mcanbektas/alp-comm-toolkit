import { describe, expect, it } from 'vitest';

import {
  computeInternetChecksum,
  computeInternetChecksumWithFieldZeroed,
  verifyInternetChecksum,
} from './internetChecksum';

describe('computeInternetChecksum', () => {
  it('klasik IPv4 başlık örneğinde spec/ders kitabı değeriyle eşleşir (0xB1E6)', () => {
    // Başlık checksum alanı (offset 10-11) ÖNCEDEN sıfırlanmış: 45 00 00 3c 1c 46
    // 40 00 40 06 [00 00] ac 10 0a 63 ac 10 0a 0c. Bağımsız ikinci hesap (Node,
    // görev betiği) 0xB1E6 verdi — RFC 1071 örnekleriyle aynı ailede yaygın
    // bilinen bir ders kitabı fixture'ı (Kurose/Ross tarzı).
    const header = Uint8Array.of(
      0x45, 0x00, 0x00, 0x3c, 0x1c, 0x46, 0x40, 0x00, 0x40, 0x06, 0x00, 0x00, 0xac, 0x10, 0x0a,
      0x63, 0xac, 0x10, 0x0a, 0x0c,
    );
    expect(computeInternetChecksum(header)).toBe(0xb1e6);
  });

  it('tek bayt kalan (odd length) veride sonuna örtük sıfır dolgusu uygular', () => {
    // 0xAB tek başına: kelime 0xAB00 sayılır (alt bayt örtük sıfır) → tümleyen 0x54FF.
    expect(computeInternetChecksum(Uint8Array.of(0xab))).toBe(0x54ff);
  });

  it('tüm sıfır veri için 0xFFFF döner (toplam 0, tümleyeni tüm-bir)', () => {
    expect(computeInternetChecksum(Uint8Array.of(0x00, 0x00, 0x00, 0x00))).toBe(0xffff);
  });

  it('ASCII "123456789" için bağımsız hesapla doğrulanan sabit değeri verir', () => {
    // Katalogdaki CRC fixture'larının "check" geleneğiyle aynı girdi (spec §43),
    // burada internet checksum için bağımsız ikinci hesapla üretildi: 0xF62A.
    const ascii = Uint8Array.from('123456789', (char) => char.charCodeAt(0));
    expect(computeInternetChecksum(ascii)).toBe(0xf62a);
  });

  it('end-around carry: 16 biti aşan ara toplamlar geri katlanır', () => {
    // 0xFFFF + 0xFFFF = 0x1FFFE → katlama: 0xFFFE + 1 = 0xFFFF → tümleyen 0x0000.
    expect(computeInternetChecksum(Uint8Array.of(0xff, 0xff, 0xff, 0xff))).toBe(0x0000);
  });
});

describe('computeInternetChecksumWithFieldZeroed', () => {
  it('checksum alanında NE olursa olsun (garbage dahil) alanı sıfırlayıp aynı sonucu verir', () => {
    const headerWithGarbage = Uint8Array.of(
      0x45, 0x00, 0x00, 0x3c, 0x1c, 0x46, 0x40, 0x00, 0x40, 0x06, 0xff, 0xff, 0xac, 0x10, 0x0a,
      0x63, 0xac, 0x10, 0x0a, 0x0c,
    );
    expect(computeInternetChecksumWithFieldZeroed(headerWithGarbage, 10, 2)).toBe(0xb1e6);
  });

  it('orijinal diziyi DEĞİŞTİRMEZ (immutable kopya üzerinde çalışır)', () => {
    const header = Uint8Array.of(0x45, 0x00, 0xaa, 0xbb);
    const before = Uint8Array.from(header);
    computeInternetChecksumWithFieldZeroed(header, 2, 2);
    expect(header).toEqual(before);
  });
});

describe('verifyInternetChecksum', () => {
  it('doğru checksum telle birlikte gönderildiğinde true döner (tümleyen 0x0000)', () => {
    const headerWithChecksum = Uint8Array.of(
      0x45, 0x00, 0x00, 0x3c, 0x1c, 0x46, 0x40, 0x00, 0x40, 0x06, 0xb1, 0xe6, 0xac, 0x10, 0x0a,
      0x63, 0xac, 0x10, 0x0a, 0x0c,
    );
    expect(verifyInternetChecksum(headerWithChecksum)).toBe(true);
  });

  it('bozuk veri (checksum aynı kalıp bir bayt değişince) false döner', () => {
    const corrupted = Uint8Array.of(
      0x45, 0x00, 0x00, 0x3c, 0x1c, 0x46, 0x40, 0x00, 0x40, 0x06, 0xb1, 0xe6, 0xac, 0x10, 0x0a,
      0x63, 0xac, 0x10, 0x0a, 0x0d, // son bayt 0x0c → 0x0d
    );
    expect(verifyInternetChecksum(corrupted)).toBe(false);
  });
});
