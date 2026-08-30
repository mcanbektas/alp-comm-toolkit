import { describe, expect, it } from 'vitest';

import {
  buildCanClassicFrame,
  encodeCanBaseFrame,
  encodeCanExtendedFrame,
  parseCanClassic,
} from './canClassic';

/**
 * Encoder'ın girdisi identifier sözcüğü + veri; ölçüt ise çözücünün kendi örnek
 * çerçevelerini üreten `buildCanClassicFrame`in çıktısı. İkisi ayrışırsa
 * ekranda üretilen çerçeve, aynı sayfanın çözdüğü çerçeveden farklı olurdu.
 */

function identifierWord(rawId: number): number[] {
  return [rawId & 0xff, (rawId >>> 8) & 0xff, (rawId >>> 16) & 0xff, (rawId >>> 24) & 0xff];
}

describe('encodeCanBaseFrame', () => {
  it('produces the spec base data frame', () => {
    const data = [0x10, 0x27, 0x00, 0x64, 0x12, 0x34, 0xff, 0x00];

    // Spec §3.4: CAN ID 0x321, DLC 8.
    expect(encodeCanBaseFrame(Uint8Array.from([...identifierWord(0x321), ...data]))).toEqual(
      buildCanClassicFrame(0x321, data),
    );
  });

  it('computes the DLC from the data length', () => {
    const frame = encodeCanBaseFrame(Uint8Array.from([...identifierWord(0x120), 0x01, 0x02, 0x03]));

    expect(frame[4]).toBe(3);
    // `struct can_frame` sabit boyludur: kalan veri baytları sıfırla dolar.
    expect(Array.from(frame.subarray(8))).toEqual([0x01, 0x02, 0x03, 0, 0, 0, 0, 0]);
  });

  it('keeps the remote flag the caller set', () => {
    const frame = encodeCanBaseFrame(Uint8Array.from(identifierWord(0x123 | 0x40000000)));

    expect(frame).toEqual(buildCanClassicFrame(0x123, [], { remote: true }));
  });

  /** 11 bitin üstünü sessizce kırpmak, kullanıcının yazdığından başka bir ID göndermek olurdu. */
  it('refuses an identifier that does not fit 11 bits', () => {
    expect(() => encodeCanBaseFrame(Uint8Array.from(identifierWord(0x800)))).toThrow(RangeError);
  });

  it('refuses more than eight data bytes', () => {
    const body = Uint8Array.from([...identifierWord(0x100), ...new Array<number>(9).fill(0xaa)]);

    expect(() => encodeCanBaseFrame(body)).toThrow(RangeError);
  });

  it('refuses a body without a full identifier word', () => {
    expect(() => encodeCanBaseFrame(Uint8Array.from([0x01, 0x02, 0x03]))).toThrow(RangeError);
  });
});

describe('encodeCanExtendedFrame', () => {
  it('produces the spec extended frame and sets the format bit itself', () => {
    const data = [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff];

    // Spec §43 identifier'ı 0x18F00401; çağıran EFF bitini YAZMADI, encoder yazar.
    expect(
      encodeCanExtendedFrame(Uint8Array.from([...identifierWord(0x18f00401), ...data])),
    ).toEqual(buildCanClassicFrame(0x18f00401, data, { extended: true }));
  });

  /**
   * 2.0B sayfası base çerçeve üretebilseydi kendi ürettiğimiz çerçeveye kendi
   * parser'ımız "biçim uyuşmuyor" uyarısı basardı.
   */
  it('is read back as an extended frame with no warning', () => {
    const frame = encodeCanExtendedFrame(Uint8Array.from([...identifierWord(0x18f00401), 0x01]));

    const result = parseCanClassic(frame, 'extended');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors).toEqual([]);
    expect(result.frame.warnings).toEqual([]);
  });

  it('accepts an identifier wider than 11 bits', () => {
    expect(() => encodeCanExtendedFrame(Uint8Array.from(identifierWord(0x1fffffff)))).not.toThrow();
  });
});
