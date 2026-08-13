import { describe, expect, it } from 'vitest';

import { destuffBits, stuffBits } from './bitStuffing';

describe('bit stuffing (HDLC)', () => {
  it('tam 5 art arda 1 biti olan veriye bir stuff-0 ekler', () => {
    // 0x1F = 0001 1111 — sondaki 5 bit hepsi 1.
    const result = stuffBits(Uint8Array.from([0x1f]));
    expect(result.bitLength).toBe(9);
    // 9 bit MSB-önce: 000111110 → paketlenince [0001 1111, 0xxx xxxx] = [0x1F, 0x00]
    expect(Array.from(result.bytes)).toEqual([0x1f, 0x00]);
  });

  it('6 art arda 1 biti içeren veri (bayrak deseniyle çakışabilecek) iki stuff-0 ile korunur', () => {
    // 0x3F = 0011 1111 — 6 art arda 1. 5.den sonra stuff-0, kalan 1 devam eder.
    const result = stuffBits(Uint8Array.from([0x3f]));
    // Beklenen bit dizisi: 0,0,1,1,1,1,1,[stuff 0],1 → 001111101 (9 bit)
    const decoded = destuffBits(result);
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && Array.from(decoded.data)).toEqual([0x3f]);
  });

  it('stuff/destuff round-trip: rastgele bayt dizisinde orijinali geri verir', () => {
    const raw = Uint8Array.from([0xff, 0x00, 0xab, 0x7e, 0x81]);
    const stuffed = stuffBits(raw);
    const result = destuffBits(stuffed);
    expect(result.ok).toBe(true);
    expect(result.ok && Array.from(result.data)).toEqual(Array.from(raw));
  });

  it('istiflenmiş veride bayrak deseninin (0111 1110) 6 art arda 1 biti asla belirmez', () => {
    // "Kötü niyetli" girdi: baştan sona 1 bitlerinden oluşan 4 bayt.
    const raw = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);
    const stuffed = stuffBits(raw);
    const bits: number[] = [];
    for (let byteIndex = 0; byteIndex < stuffed.bytes.length; byteIndex += 1) {
      const byte = stuffed.bytes[byteIndex] ?? 0;
      for (let bitOffset = 7; bitOffset >= 0; bitOffset -= 1) {
        if (byteIndex * 8 + (7 - bitOffset) >= stuffed.bitLength) break;
        bits.push((byte >> bitOffset) & 1);
      }
    }
    let maxRun = 0;
    let run = 0;
    for (const bit of bits) {
      run = bit === 1 ? run + 1 : 0;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(5);
  });

  it('bozulmuş istifleme (stuff bitinin yerinde 1 bulunması) invalid-stuffing döner', () => {
    // 9 bit: 1,1,1,1,1 (5 art arda 1, index0-4), index5 STUFF-0 OLMALIYDI ama
    // bilerek 1 bırakıldı → geçerli bir bit dizisi MSB-önce: 1,1,1,1,1,1,0,0,0
    // = ilk bayt 0b11111100 (0xFC), ikinci baytın tek anlamlı biti (index8) 0.
    const forced = { bytes: Uint8Array.from([0b11111100, 0x00]), bitLength: 9 };
    const result = destuffBits(forced);
    expect(result).toEqual({ ok: false, code: 'invalid-stuffing', offset: 5 });
  });
});
