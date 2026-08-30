import { describe, expect, it } from 'vitest';

import { buildCanClassicFrame } from '../can/canClassic';

import { decodeJ1939Identifier, encodeJ1939Frame, encodeJ1939Identifier } from './j1939';

/**
 * `encodeJ1939Identifier` bir TERS fonksiyondur; doğruluğunun ölçütü de tersi
 * olduğu fonksiyondur. Her iddia bu yüzden ya spec'in kendi identifier'ıyla ya
 * da `decodeJ1939Identifier`in çıktısıyla karşılaştırılıyor — encoder'ı kendi
 * varsayımıyla sınamak hiçbir şey kanıtlamazdı.
 */

/** Spec §43 fixture identifier'ı: öncelik 6, PGN 0xF004 (PDU2), kaynak 0x01. */
const SPEC_IDENTIFIER = 0x18f00401;

describe('encodeJ1939Identifier', () => {
  it('rebuilds the spec identifier from its decoded fields', () => {
    const decoded = decodeJ1939Identifier(SPEC_IDENTIFIER);

    expect(
      encodeJ1939Identifier({
        priority: decoded.priority,
        pgn: decoded.pgn,
        sourceAddress: decoded.sourceAddress,
        destinationAddress: decoded.destinationAddress,
      }),
    ).toBe(SPEC_IDENTIFIER);
  });

  it('round-trips a PDU1 identifier with its destination address', () => {
    // 0x18EF2A0B — PF 0xEF (< 240) yani hedefli: PS = 0x2A hedef adresi.
    const decoded = decodeJ1939Identifier(0x18ef2a0b);

    expect(decoded.pduFormatType).toBe('PDU1');
    expect(decoded.destinationAddress).toBe(0x2a);
    expect(
      encodeJ1939Identifier({
        priority: decoded.priority,
        pgn: decoded.pgn,
        sourceAddress: decoded.sourceAddress,
        destinationAddress: decoded.destinationAddress,
      }),
    ).toBe(0x18ef2a0b);
  });

  it('refuses a PDU1 PGN without a destination address', () => {
    expect(() => encodeJ1939Identifier({ priority: 6, pgn: 0xef00, sourceAddress: 0x0b })).toThrow(
      RangeError,
    );
  });

  /** PDU2'de identifier'da hedef alanı YOKTUR; verilen değer sessizce düşerdi. */
  it('refuses a destination address on a broadcast PGN', () => {
    expect(() =>
      encodeJ1939Identifier({ priority: 3, pgn: 0xf205, sourceAddress: 0x17, destinationAddress: 0x10 }),
    ).toThrow(RangeError);
  });

  it('refuses a PDU1 PGN whose low byte is not zero', () => {
    expect(() =>
      encodeJ1939Identifier({ priority: 6, pgn: 0xef2a, sourceAddress: 0x0b, destinationAddress: 0x2a }),
    ).toThrow(RangeError);
  });

  it('refuses a priority wider than three bits', () => {
    expect(() => encodeJ1939Identifier({ priority: 8, pgn: 0xf004, sourceAddress: 0x01 })).toThrow(
      RangeError,
    );
  });
});

describe('encodeJ1939Frame', () => {
  it('produces the spec example frame', () => {
    const data = [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff];
    // öncelik 6 · PGN 0x0F004 · hedef 0xFF (yayın) · kaynak 0x01.
    const body = Uint8Array.from([0x06, 0x00, 0xf0, 0x04, 0xff, 0x01, ...data]);

    expect(encodeJ1939Frame(body)).toEqual(
      buildCanClassicFrame(SPEC_IDENTIFIER, data, { extended: true }),
    );
  });

  it('produces a PDU1 frame addressed to a single node', () => {
    const data = [0x01, 0x02, 0x03, 0x04];
    const body = Uint8Array.from([0x06, 0x00, 0xef, 0x00, 0x2a, 0x0b, ...data]);

    expect(encodeJ1939Frame(body)).toEqual(
      buildCanClassicFrame(0x18ef2a0b, data, { extended: true }),
    );
  });

  it('refuses a broadcast PGN with a node destination', () => {
    const body = Uint8Array.from([0x03, 0x00, 0xf2, 0x05, 0x10, 0x17]);

    expect(() => encodeJ1939Frame(body)).toThrow(RangeError);
  });

  it('refuses more than eight data bytes', () => {
    const body = Uint8Array.from([0x06, 0x00, 0xf0, 0x04, 0xff, 0x01, ...new Array<number>(9).fill(0)]);

    expect(() => encodeJ1939Frame(body)).toThrow(RangeError);
  });

  it('refuses a body shorter than its header', () => {
    expect(() => encodeJ1939Frame(Uint8Array.from([0x06, 0x00, 0xf0, 0x04, 0xff]))).toThrow(RangeError);
  });
});
