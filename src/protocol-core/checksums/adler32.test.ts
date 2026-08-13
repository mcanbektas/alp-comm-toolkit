import { describe, expect, it } from 'vitest';

import { adler32 } from './adler32';

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

describe('adler32', () => {
  it('bilinen referans vektörü üretir: Adler-32("Wikipedia") = 0x11E60398', () => {
    expect(adler32(ascii('Wikipedia'))).toBe(0x11e60398);
  });

  it('boş veri için A=1, B=0 başlangıcını yansıtır: checksum = 1', () => {
    // Fletcher'ın aksine A 1'den başladığı için boş veri 0 değil 1 verir —
    // bu, Adler'in Fletcher'a göre asıl tasarım farkıdır.
    expect(adler32(new Uint8Array())).toBe(1);
  });

  it('tek bir sıfır byte için A=1, B=1 verir (0x10001)', () => {
    // byte=0: A = (1+0) % 65521 = 1; B = (0+1) % 65521 = 1.
    expect(adler32(Uint8Array.of(0x00))).toBe(0x10001);
  });
});
