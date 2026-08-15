import { describe, expect, it } from 'vitest';

import {
  MQTT_VBI_MAX_VALUE,
  decodeVariableByteInteger,
  encodeVariableByteInteger,
} from './mqttVbi';

/** OASIS'in kendi örnekleri (spec §1.5.5 tablosu) — dosya başı kaynak notuna bak. */
const VECTORS: ReadonlyArray<{ readonly value: number; readonly bytes: readonly number[] }> = [
  { value: 0, bytes: [0x00] },
  { value: 127, bytes: [0x7f] },
  { value: 128, bytes: [0x80, 0x01] },
  { value: 16_383, bytes: [0xff, 0x7f] },
  { value: 16_384, bytes: [0x80, 0x80, 0x01] },
  { value: 2_097_151, bytes: [0xff, 0xff, 0x7f] },
  { value: 2_097_152, bytes: [0x80, 0x80, 0x80, 0x01] },
  { value: 268_435_455, bytes: [0xff, 0xff, 0xff, 0x7f] },
];

describe('decodeVariableByteInteger', () => {
  it.each(VECTORS)('$value → $bytes', ({ value, bytes }) => {
    const result = decodeVariableByteInteger(Uint8Array.from(bytes), 0);
    expect(result).toEqual({ success: true, value, length: bytes.length });
  });

  it('offset parametresinden başlar', () => {
    const buffer = Uint8Array.from([0xaa, 0xbb, 0x7f, 0xcc]);
    expect(decodeVariableByteInteger(buffer, 2)).toEqual({ success: true, value: 127, length: 1 });
  });

  it('arabellek VBI bitmeden tükenirse truncated döner', () => {
    // Devam biti set (0x80) ama arkasında bayt yok.
    expect(decodeVariableByteInteger(Uint8Array.from([0x80]), 0)).toEqual({
      success: false,
      reason: 'truncated',
    });
  });

  it('dördüncü bayttan sonra hâlâ devam biti set ise malformed döner', () => {
    // Dört bayt, hepsi 0x80 üstü (devam biti set) — OASIS'in "en çok 4 bayt" kuralı ihlali.
    expect(decodeVariableByteInteger(Uint8Array.from([0xff, 0xff, 0xff, 0xff]), 0)).toEqual({
      success: false,
      reason: 'malformed',
    });
  });

  it('beşinci bayt asla okunmaz — dördüncü bayt malformed olarak durur', () => {
    const buffer = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x00]);
    const result = decodeVariableByteInteger(buffer, 0);
    expect(result).toEqual({ success: false, reason: 'malformed' });
  });
});

describe('encodeVariableByteInteger', () => {
  it.each(VECTORS)('$value → $bytes', ({ value, bytes }) => {
    expect(Array.from(encodeVariableByteInteger(value))).toEqual(bytes);
  });

  it('azami değerin üstünü reddeder', () => {
    expect(() => encodeVariableByteInteger(MQTT_VBI_MAX_VALUE + 1)).toThrow(RangeError);
  });

  it('negatif ya da tam sayı olmayan değeri reddeder', () => {
    expect(() => encodeVariableByteInteger(-1)).toThrow(RangeError);
    expect(() => encodeVariableByteInteger(1.5)).toThrow(RangeError);
  });

  it('decode(encode(x)) == x — tüm test vektörlerinde tur-turlama', () => {
    for (const { value } of VECTORS) {
      const encoded = encodeVariableByteInteger(value);
      const decoded = decodeVariableByteInteger(encoded, 0);
      expect(decoded).toEqual({ success: true, value, length: encoded.length });
    }
  });
});
