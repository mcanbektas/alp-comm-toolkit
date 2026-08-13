/**
 * SLIP (RFC 1055) — `escapedDelimiterFraming.ts`nin sabit parametreli
 * örneği. END=0xC0, ESC=0xDB, ESC_END=0xDC, ESC_ESC=0xDD (spec §8.4 satır
 * 112-127). Spec'in kendi uyarısı (satır 127) korunur: SLIP'in kendisi
 * adres/tip/CRC/sıra taşımaz — bütünlük doğrulaması protokol katmanının işi,
 * burası yalnız "çerçeve nerede bitiyor" sorusuna cevap verir.
 */

import { createEscapedDelimiterExtractor, encodeEscapedDelimiterFrame } from './escapedDelimiterFraming';
import type { EscapedDelimiterConfig } from './escapedDelimiterFraming';
import type { EscapeRule } from './escaping';

export const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

export const SLIP_ESCAPE_RULE: EscapeRule = {
  escapeByte: SLIP_ESC,
  specialBytes: new Set([SLIP_END, SLIP_ESC]),
  substitutions: new Map([
    [SLIP_END, SLIP_ESC_END],
    [SLIP_ESC, SLIP_ESC_ESC],
  ]),
};

const SLIP_CONFIG: EscapedDelimiterConfig = {
  method: 'slip',
  delimiterByte: SLIP_END,
  rule: SLIP_ESCAPE_RULE,
};

export const slipExtractor = createEscapedDelimiterExtractor(SLIP_CONFIG);

export function encodeSlip(payload: Uint8Array): Uint8Array {
  return encodeEscapedDelimiterFrame(payload, SLIP_CONFIG);
}
