import { describe, expect, it } from 'vitest';

import {
  onesComplementChecksum,
  sum16Checksum,
  sum8Checksum,
  twosComplementChecksum,
  xor8Checksum,
} from './simpleChecksums';

describe('xor8Checksum', () => {
  it('xor-lar tüm byteları tek bir sonuca indirger', () => {
    // 0x01 ^ 0x02 ^ 0x04 = 0x07 — elle doğrulanabilir küçük örnek.
    expect(xor8Checksum(Uint8Array.of(0x01, 0x02, 0x04))).toBe(0x07);
  });

  it('boş veri için 0 döner (XOR birim elemanı)', () => {
    expect(xor8Checksum(new Uint8Array())).toBe(0);
  });

  it('sıra bağımsızdır', () => {
    const a = Uint8Array.of(0xaa, 0x55, 0x0f);
    const b = Uint8Array.of(0x0f, 0xaa, 0x55);
    expect(xor8Checksum(a)).toBe(xor8Checksum(b));
  });
});

describe('sum8Checksum', () => {
  it('byteları toplar', () => {
    expect(sum8Checksum(Uint8Array.of(0x01, 0x02, 0x03))).toBe(0x06);
  });

  it('256 sınırında taşarsa mod 256 ile kırpar', () => {
    // 0xFF + 0x02 = 257 → mod 256 = 1.
    expect(sum8Checksum(Uint8Array.of(0xff, 0x02))).toBe(1);
  });
});

describe('sum16Checksum', () => {
  it('byteları 16 bite kadar taşımaya izin vererek toplar', () => {
    // 0xFF + 0x02 = 0x101 — SUM-8'in aksine burada kırpılmaz.
    expect(sum16Checksum(Uint8Array.of(0xff, 0x02))).toBe(0x101);
  });

  it('65536 sınırında taşarsa mod 65536 ile kırpar', () => {
    // 3 byte'ın toplamı en fazla 3*255 = 765 olur, 65536'yı aşamaz — taşmayı
    // görmek için gerçekten çok byte gerekir: 258 × 0xFF = 65790, mod 65536 = 254.
    const bytes = new Uint8Array(258).fill(0xff);
    expect(sum16Checksum(bytes)).toBe(254);
  });
});

describe('twosComplementChecksum', () => {
  it('sum mod 256 sıfır olmayan tipik durumda 256 − sum verir', () => {
    // sum(0x01,0x02,0x03) = 6 → tümleyen 256 − 6 = 250 (0xFA).
    expect(twosComplementChecksum(Uint8Array.of(0x01, 0x02, 0x03))).toBe(0xfa);
  });

  it('sum mod 256 tam sıfırsa 256 değil 0 verir (taşma tuzağı)', () => {
    // 0x80 + 0x80 = 256 → mod 256 = 0 → tümleyen de 0 olmalı, 256 DEĞİL.
    expect(twosComplementChecksum(Uint8Array.of(0x80, 0x80))).toBe(0);
  });

  it('round-trip: veri + checksum SUM-8 toplamı her zaman 0 çıkar', () => {
    const data = Uint8Array.of(0xde, 0xad, 0xbe, 0xef);
    const checksum = twosComplementChecksum(data);
    const combined = Uint8Array.of(...data, checksum);

    expect(sum8Checksum(combined)).toBe(0);
  });

  it('round-trip taşma sınırında da geçerlidir', () => {
    const data = Uint8Array.of(0x80, 0x80);
    const checksum = twosComplementChecksum(data);
    const combined = Uint8Array.of(...data, checksum);

    expect(sum8Checksum(combined)).toBe(0);
  });
});

describe('onesComplementChecksum', () => {
  it('0xFF − sum verir', () => {
    // sum(0x01,0x02,0x03) = 6 → 0xFF − 6 = 0xF9.
    expect(onesComplementChecksum(Uint8Array.of(0x01, 0x02, 0x03))).toBe(0xf9);
  });

  it('Modbus LRC hesabında kullanılan örnek byte dizisiyle tutarlıdır', () => {
    // Aynı byte dizisi lrc.test.ts'te twosComplementChecksum ile de sınanır;
    // burada yalnız one's complement'in bağımsız doğru sonucu doğrulanır.
    const bytes = Uint8Array.of(0x11, 0x03, 0x00, 0x6b, 0x00, 0x03);
    expect(onesComplementChecksum(bytes)).toBe(0x7d);
  });
});
