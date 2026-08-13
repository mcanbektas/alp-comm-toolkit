/**
 * HDLC bayrak tabanlı çerçeveleme — spec §8.4 satır 156-173. Bu araç setinin
 * hedef bağlamı ("seri port / WebSocket verisi", §8.4 giriş cümlesi) BAYT
 * odaklı bir akış olduğu için `hdlc-flag` yöntemi gerçek senkron donanımın
 * BİT istiflemesini (bkz. `bitStuffing.ts`) değil, PPP'nin (RFC 1662) de
 * kullandığı "async HDLC" bayt-kaçış kuralını uygular: Flag=`0x7E`,
 * Control Escape=`0x7D`, kaçışlı bayt = orijinal XOR `0x20`. Bu, spec'in
 * kendi notuyla tutarlı (satır 170): "Exact control-field bit yorumu seçilen
 * HDLC profile/moduna göre değişir" — burada yalnız ÇERÇEVE sınırı çözülür,
 * I/S/U-frame ayrımı ve FCS profili (CRC-16/32/özel) protokol katmanının işi.
 */

import { createEscapedDelimiterExtractor, encodeEscapedDelimiterFrame } from './escapedDelimiterFraming';
import type { EscapedDelimiterConfig } from './escapedDelimiterFraming';
import type { EscapeRule } from './escaping';

export const HDLC_FLAG = 0x7e;
const HDLC_ESCAPE = 0x7d;
const HDLC_XOR_MASK = 0x20;

export const HDLC_ESCAPE_RULE: EscapeRule = {
  escapeByte: HDLC_ESCAPE,
  specialBytes: new Set([HDLC_FLAG, HDLC_ESCAPE]),
  xorMask: HDLC_XOR_MASK,
};

const HDLC_CONFIG: EscapedDelimiterConfig = {
  method: 'hdlc-flag',
  delimiterByte: HDLC_FLAG,
  rule: HDLC_ESCAPE_RULE,
};

export const hdlcFlagExtractor = createEscapedDelimiterExtractor(HDLC_CONFIG);

export function encodeHdlcFlagFrame(payload: Uint8Array): Uint8Array {
  return encodeEscapedDelimiterFrame(payload, HDLC_CONFIG);
}
