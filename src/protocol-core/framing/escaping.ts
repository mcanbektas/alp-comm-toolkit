/**
 * Genel escape/byte-stuffing motoru. Spec §8.4'ün "Escape-based framing" ve
 * "Byte stuffing" maddeleri MEKANİK olarak aynı teknik — özel bir baytın
 * önüne bir kaçış (escape) baytı koyup kendisini değiştirmek. `slip.ts` ve
 * `hdlcFraming.ts` bu motoru sabit parametrelerle SARAR; kod tekrarı yerine
 * spec'in kendi §8.4/§8.5 kaynağındaki iki farklı kaçış üslubu tek yerde
 * modellenir:
 *
 * - **İkameli (SLIP, KISS)**: özel bayt escape + SABİT bir yerine geçen bayt
 *   olur (0xC0 → 0xDB 0xDC). `substitutions` haritası kullanılır.
 * - **XOR'lu (PPP, HDLC-async)**: özel bayt escape + (bayt XOR maske) olur
 *   (0x7E → 0x7D 0x5E, maske 0x20). `xorMask` kullanılır.
 *
 * İkisi karışık kullanılmaz — bir `EscapeRule` ya `substitutions` ya
 * `xorMask` taşır, ikisi birden anlamsız.
 */

import type { FramingError, FramingErrorCode } from './types';

export interface EscapeRule {
  readonly escapeByte: number;
  readonly specialBytes: ReadonlySet<number>;
  readonly substitutions?: ReadonlyMap<number, number>;
  readonly xorMask?: number;
}

function resolveEscapedByte(rule: EscapeRule, original: number): number {
  if (rule.substitutions !== undefined) {
    const substituted = rule.substitutions.get(original);
    if (substituted !== undefined) return substituted;
    // escapeByte'ın kendisi de kaçış gerektirir ama substitutions'ta ayrı
    // girdisi olmayabilir (SLIP escapeByte'ı kendi özel baytı değildir) —
    // bu dal yalnız yanlış yapılandırılmış bir kural için savunma.
    throw new RangeError(`escaping: ${original} için substitution tanımlı değil`);
  }
  if (rule.xorMask !== undefined) return original ^ rule.xorMask;
  throw new RangeError('escaping: EscapeRule ne substitutions ne xorMask taşıyor');
}

function resolveUnescapedByte(rule: EscapeRule, escaped: number): number | undefined {
  if (rule.substitutions !== undefined) {
    for (const [original, sub] of rule.substitutions) {
      if (sub === escaped) return original;
    }
    return undefined;
  }
  if (rule.xorMask !== undefined) return escaped ^ rule.xorMask;
  return undefined;
}

/** Ham veriyi verilen kurala göre kaçışlı (wire-ready) bayt dizisine çevirir — delimiter EKLEMEZ, yalnız içerik. */
export function escapeBytes(data: Uint8Array, rule: EscapeRule): Uint8Array {
  const output: number[] = [];
  for (const byte of data) {
    if (byte === rule.escapeByte || rule.specialBytes.has(byte)) {
      output.push(rule.escapeByte, resolveEscapedByte(rule, byte));
    } else {
      output.push(byte);
    }
  }
  return Uint8Array.from(output);
}

export type UnescapeResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; code: Extract<FramingErrorCode, 'invalid-escape' | 'truncated-frame'>; offset: number };

/** Kaçışlı bayt dizisini ham veriye çözer — girdide delimiter OLMAMALI, çağıran önce ayırmış olmalı. */
export function unescapeBytes(wire: Uint8Array, rule: EscapeRule): UnescapeResult {
  const output: number[] = [];
  for (let i = 0; i < wire.length; i += 1) {
    const byte = wire[i];
    if (byte === undefined) break; // noUncheckedIndexedAccess — döngü sınırı zaten `wire.length`, pratikte hiç olmaz
    if (byte === rule.escapeByte) {
      const next = wire[i + 1];
      if (next === undefined) {
        return { ok: false, code: 'truncated-frame', offset: i };
      }
      const resolved = resolveUnescapedByte(rule, next);
      if (resolved === undefined) {
        return { ok: false, code: 'invalid-escape', offset: i };
      }
      output.push(resolved);
      i += 1;
    } else {
      output.push(byte);
    }
  }
  return { ok: true, data: Uint8Array.from(output) };
}

export function toFramingError(code: 'invalid-escape' | 'truncated-frame', offset: number): FramingError {
  return {
    code,
    offset,
    message: code === 'invalid-escape' ? `Geçersiz kaçış dizisi (offset ${offset})` : `Kaçış baytından sonra veri kesildi (offset ${offset})`,
  };
}
