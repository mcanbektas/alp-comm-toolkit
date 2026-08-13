import { describe, expect, it } from 'vitest';

import { escapeBytes, unescapeBytes } from './escaping';
import type { EscapeRule } from './escaping';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** SLIP (RFC 1055): END=0xC0, ESC=0xDB, ESC_END=0xDC, ESC_ESC=0xDD — spec §8.4 satır 112-127. */
const SLIP_RULE: EscapeRule = {
  escapeByte: 0xdb,
  specialBytes: new Set([0xc0, 0xdb]),
  substitutions: new Map([
    [0xc0, 0xdc],
    [0xdb, 0xdd],
  ]),
};

/** PPP async escaping: Control Escape=0x7D, transform = bayt XOR 0x20 — spec §8.4 satır 205-206. */
const PPP_RULE: EscapeRule = {
  escapeByte: 0x7d,
  specialBytes: new Set([0x7e, 0x7d]),
  xorMask: 0x20,
};

/** KISS: FEND=0xC0, FESC=0xDB, TFEND=0xDC, TFESC=0xDD — spec §8.4 satır 216-230, SLIP'le AYNI ikame. */
const KISS_RULE: EscapeRule = SLIP_RULE;

describe('escaping (generic engine — SLIP/PPP/KISS bunun sarmalayıcısı)', () => {
  it('SLIP fixture: 45 00 C0 11 DB 22 → 45 00 DB DC 11 DB DD 22 (spec satır 119, delimiter hariç)', () => {
    const raw = Uint8Array.from([0x45, 0x00, 0xc0, 0x11, 0xdb, 0x22]);
    const escaped = escapeBytes(raw, SLIP_RULE);
    expect(hex(escaped)).toBe('45 00 DB DC 11 DB DD 22');

    const result = unescapeBytes(escaped, SLIP_RULE);
    expect(result.ok).toBe(true);
    expect(result.ok && hex(result.data)).toBe(hex(raw));
  });

  it('PPP fixture: 01 7E 02 → 01 7D 5E 02 (spec satır 206)', () => {
    const raw = Uint8Array.from([0x01, 0x7e, 0x02]);
    const escaped = escapeBytes(raw, PPP_RULE);
    expect(hex(escaped)).toBe('01 7D 5E 02');

    const result = unescapeBytes(escaped, PPP_RULE);
    expect(result.ok).toBe(true);
    expect(result.ok && hex(result.data)).toBe(hex(raw));
  });

  it('KISS fixture: 11 C0 22 DB 33 → 11 DB DC 22 DB DD 33 (spec satır 226)', () => {
    const raw = Uint8Array.from([0x11, 0xc0, 0x22, 0xdb, 0x33]);
    const escaped = escapeBytes(raw, KISS_RULE);
    expect(hex(escaped)).toBe('11 DB DC 22 DB DD 33');

    const result = unescapeBytes(escaped, KISS_RULE);
    expect(result.ok).toBe(true);
    expect(result.ok && hex(result.data)).toBe(hex(raw));
  });

  it('kaçış baytından hemen sonra veri kesilirse truncated-frame döner', () => {
    const result = unescapeBytes(Uint8Array.from([0x01, 0xdb]), SLIP_RULE);
    expect(result).toEqual({ ok: false, code: 'truncated-frame', offset: 1 });
  });

  it('tanınmayan bir ikame baytı invalid-escape döner', () => {
    const result = unescapeBytes(Uint8Array.from([0xdb, 0xaa]), SLIP_RULE);
    expect(result).toEqual({ ok: false, code: 'invalid-escape', offset: 0 });
  });

  it('özel bayt içermeyen veri değişmeden geçer', () => {
    const raw = Uint8Array.from([0x01, 0x02, 0x03]);
    expect(hex(escapeBytes(raw, SLIP_RULE))).toBe(hex(raw));
  });
});
