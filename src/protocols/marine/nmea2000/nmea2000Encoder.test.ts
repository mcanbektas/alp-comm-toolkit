import { describe, expect, it } from 'vitest';

import { encodeJ1939Frame } from '../../automotive/j1939/j1939';

import { nmea2000Plugin, parseNmea2000 } from './nmea2000';

/**
 * NMEA 2000'in encoder'ı J1939'unkinin KENDİSİDİR. Bu dosya o kararı sınıyor:
 * (1) iki plugin aynı baytı üretmeli — kopya bir üretici sızarsa burada ayrışır,
 * (2) üretilen çerçeve NMEA 2000 çözücüsünden geçmeli.
 */

/** ISO Address Claim (PGN 60928 = 0xEE00, PDU1) — N2K'nın kendi örnek PGN'i. */
const ADDRESS_CLAIM_BODY = Uint8Array.from([
  0x06, 0x00, 0xee, 0x00, 0xff, 0x22, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
]);

describe('nmea-2000 encoder', () => {
  it('is the J1939 encoder itself, not a copy', () => {
    expect(nmea2000Plugin.encoder?.encode(ADDRESS_CLAIM_BODY)).toEqual(
      encodeJ1939Frame(ADDRESS_CLAIM_BODY),
    );
  });

  it('produces a frame its own parser reads back', () => {
    const frame = nmea2000Plugin.encoder?.encode(ADDRESS_CLAIM_BODY);

    expect(frame).toBeDefined();
    if (frame === undefined) return;
    const result = parseNmea2000(frame);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.errors).toEqual([]);
    expect(result.frame.valid).toBe(true);
  });
});
