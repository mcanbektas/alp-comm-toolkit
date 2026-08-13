import { describe, expect, it } from 'vitest';

import { fletcher16, fletcher32 } from './fletcher';

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

describe('fletcher16', () => {
  it('bilinen referans vektörü üretir: Fletcher-16("abcde") = 0xC8F0', () => {
    expect(fletcher16(ascii('abcde'))).toBe(0xc8f0);
  });

  it('boş veri için 0 döner (her iki toplayıcı da başlangıç değerinde kalır)', () => {
    expect(fletcher16(new Uint8Array())).toBe(0);
  });
});

describe('fletcher32', () => {
  it('boş veri için 0 döner — görev tarifindeki "checksum=1" iddiası formülle tutarsız, kullanılmadı', () => {
    expect(fletcher32(new Uint8Array())).toBe(0);
  });

  it('tek kelimelik [0x00, 0x01] girdisinde elle izlenebilir sonucu üretir', () => {
    // word = 0x0001 → sum1 = 1, sum2 = 0 + 1 = 1 → sonuç = 1*65536 + 1 = 0x10001.
    // Bu değer implementasyonu ÇALIŞTIRIP okunmuştur, tahmin edilmemiştir.
    expect(fletcher32(Uint8Array.of(0x00, 0x01))).toBe(0x10001);
  });

  it('tek sayıda byte girdisinde son kelimeyi 0 ile doldurur', () => {
    // [0x00, 0x01, 0x02] → kelimeler: 0x0001, 0x0200 (alt bayt dolgu 0).
    // sum1 = (1 + 0x0200) % 65535 = 513; sum2 = (1 + 513) % 65535 = 514.
    expect(fletcher32(Uint8Array.of(0x00, 0x01, 0x02))).toBe(514 * 0x10000 + 513);
  });
});
