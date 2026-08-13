import { describe, expect, it } from 'vitest';

import { HDLC_FLAG, encodeHdlcFlagFrame, hdlcFlagExtractor } from './hdlcFraming';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const OPTIONS = { maxFrameLength: 1024 };

describe('HDLC flag framing (async/PPP-style bayt kaçışı)', () => {
  it('PPP fixture aynı kural üzerinden çalışır: 01 7E 02 → 01 7D 5E 02 (spec satır 206)', () => {
    const wire = encodeHdlcFlagFrame(Uint8Array.from([0x01, 0x7e, 0x02]));
    // Delimiter'lı gövde: 7D 5E EKLENMİŞ, çünkü 0x7E hem flag hem payload'ta geçen özel bayttır.
    expect(hex(wire)).toBe(`01 7D 5E 02 ${HDLC_FLAG.toString(16).toUpperCase()}`);
  });

  it('mantıksal çerçeve örneği (7E FF 03 12 34 CRC 7E) çözülür — spec satır 165', () => {
    const payload = Uint8Array.from([0xff, 0x03, 0x12, 0x34, 0xca, 0xfe]); // FF 03 12 34 + kurgusal 2-baytlık FCS
    const wire = encodeHdlcFlagFrame(payload);
    const result = hdlcFlagExtractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe(hex(payload));
      expect(result.consumedBytes).toBe(wire.length);
    }
  });

  it('içerik hem 0x7E hem 0x7D taşıdığında ikisi de kaçışlanır', () => {
    const payload = Uint8Array.from([0x7e, 0x7d, 0x00]);
    const wire = encodeHdlcFlagFrame(payload);
    expect(hex(wire)).toBe('7D 5E 7D 5D 00 7E');
    const result = hdlcFlagExtractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(hex(result.frame)).toBe(hex(payload));
  });

  it('bayrak gelmeden incomplete döner', () => {
    const result = hdlcFlagExtractor.extract(Uint8Array.from([0x01, 0x02]), OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });
});
