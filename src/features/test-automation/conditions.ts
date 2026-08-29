/**
 * Test senaryolarının doğrulama koşulları — spec §38'in `Validate field` ve
 * `Conditional branch` adımlarının ortak modeli.
 *
 * ── NEDEN İFADE DİLİ DEĞİL ────────────────────────────────────────────────
 * §41 iki maddeyi arka arkaya yazıyor: `eval` yasak (39563) ve dinamik kod
 * çalıştırma yasak (39564). Kullanıcının yazdığı bir ifadeyi çalıştırmanın
 * sandbox'sız güvenli bir yolu YOK; küçük bir ayrıştırıcı yazmak da yasağın
 * ruhunu değil harfini kurtarırdı. §38'in kendi örneği zaten bir dil istemiyor:
 * "Fail if temperature > 85" tek bir karşılaştırmadır. Bu yüzden koşul
 * YAPILANDIRILMIŞ bir nesnedir — operand + operatör + operand — ve serbest
 * metin hiçbir yerde çalıştırılmaz.
 *
 * `and` / `or` / `not` birleştiricileri BİLEREK YOK. Spec bir birleştirme
 * istemedi; eklemek, kullanıcının göremediği bir öncelik sırası ve bir sürü
 * kenar durumu icat etmek olurdu. İhtiyaç gerçekten doğarsa eklenir — o zaman
 * neyin istendiği de bilinir.
 *
 * ── ÜÇÜNCÜ CEVAP: ÇÖZÜLEMEDİ ──────────────────────────────────────────────
 * Koşul iki değil ÜÇ sonuç verir. Çerçeve hiç gelmediyse, değişken
 * tanımsızsa ya da alan çerçeveye sığmıyorsa doğru cevap `false` DEĞİLDİR:
 * "85'ten büyük değil" ile "sıcaklığı hiç okuyamadım" apayrı iki durumdur ve
 * ikincisini `false` saymak testi sessizce YEŞİL geçirebilirdi. Çözülemeyen
 * koşul adımı hata olarak bitirir (`runner.ts`).
 */

import { readFieldValue } from '../../protocol-core/analysis/readField';
import type { FieldEndianness, FieldWidth } from '../../protocol-core/analysis/types';

export const COMPARISON_OPERATORS = ['==', '!=', '<', '<=', '>', '>='] as const;

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/**
 * Alanın çerçevedeki yeri. Genişlik/bayt sırası `protocol-core/analysis`in
 * modelini paylaşır: aynı soruya iki farklı tip tanımlamak, birinde 4 baytı
 * destekleyip ötekinde unutmak demekti.
 */
export interface FrameFieldRef {
  readonly offset: number;
  readonly width: FieldWidth;
  readonly endianness: FieldEndianness;
  /** İki'nin tümleyeni yorumu. Varsayılan kapalı — sıcaklık negatif olabilir. */
  readonly signed?: boolean;
  /** Ham değer × scale + offset; §33'ün `value × 0.1` dönüşümüyle aynı model. */
  readonly scale?: number;
  readonly valueOffset?: number;
}

export type Operand =
  | { readonly kind: 'constant'; readonly value: number }
  | { readonly kind: 'variable'; readonly name: string }
  | ({ readonly kind: 'frame-field' } & FrameFieldRef)
  /** Son alınan çerçevenin bayt sayısı — uzunluk doğrulaması için. */
  | { readonly kind: 'frame-length' };

export type Condition =
  | {
      readonly kind: 'compare';
      readonly left: Operand;
      readonly operator: ComparisonOperator;
      readonly right: Operand;
    }
  /** `(operand & mask) === expected` — bayrak bitleri için. */
  | {
      readonly kind: 'mask';
      readonly operand: Operand;
      readonly mask: number;
      readonly expected: number;
    };

export interface EvaluationContext {
  readonly variables: ReadonlyMap<string, number>;
  /** Son alınan çerçeve; hiç çerçeve gelmediyse `undefined`. */
  readonly lastFrame: Uint8Array | undefined;
}

export type OperandResult =
  | { readonly status: 'value'; readonly value: number }
  | { readonly status: 'unresolved'; readonly reason: string };

export type ConditionResult =
  | { readonly status: 'true'; readonly left: number; readonly right: number }
  | { readonly status: 'false'; readonly left: number; readonly right: number }
  | { readonly status: 'unresolved'; readonly reason: string };

const BITS_PER_BYTE = 8;

/** İşaretsiz okumayı iki'nin tümleyenine çevirir; genişlik bit sayısını verir. */
function toSigned(value: number, width: FieldWidth): number {
  const bits = width * BITS_PER_BYTE;
  const half = 2 ** (bits - 1);
  return value >= half ? value - 2 ** bits : value;
}

export function evaluateOperand(operand: Operand, context: EvaluationContext): OperandResult {
  switch (operand.kind) {
    case 'constant':
      return { status: 'value', value: operand.value };

    case 'variable': {
      const value = context.variables.get(operand.name);
      // Tanımsız değişkeni 0 saymak, adı yanlış yazılmış bir değişkeni
      // sessizce geçerli kılardı.
      if (value === undefined) return { status: 'unresolved', reason: `değişken tanımsız: ${operand.name}` };
      return { status: 'value', value };
    }

    case 'frame-length': {
      const frame = context.lastFrame;
      if (frame === undefined) return { status: 'unresolved', reason: 'henüz çerçeve alınmadı' };
      return { status: 'value', value: frame.length };
    }

    case 'frame-field': {
      const frame = context.lastFrame;
      if (frame === undefined) return { status: 'unresolved', reason: 'henüz çerçeve alınmadı' };
      // Guard tek yerde durur (`readField.ts` dosya başı gerekçesi); alan
      // çerçeveye sığmıyorsa `undefined` gelir, sıfır DEĞİL.
      const raw = readFieldValue({ bytes: frame, timestamp: undefined }, operand.offset, operand.width, operand.endianness);
      if (raw === undefined) {
        return {
          status: 'unresolved',
          reason: `alan çerçeveye sığmıyor: ofset ${operand.offset}, genişlik ${operand.width}, çerçeve ${frame.length} bayt`,
        };
      }
      const signed = operand.signed === true ? toSigned(raw, operand.width) : raw;
      const scaled = signed * (operand.scale ?? 1) + (operand.valueOffset ?? 0);
      return { status: 'value', value: scaled };
    }
  }
}

function compare(left: number, operator: ComparisonOperator, right: number): boolean {
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
  }
}

export function evaluateCondition(condition: Condition, context: EvaluationContext): ConditionResult {
  if (condition.kind === 'mask') {
    const operand = evaluateOperand(condition.operand, context);
    if (operand.status === 'unresolved') return operand;
    // Bit işlemleri 32 bitlik tam sayıda yapılır; ölçeklenmiş (kesirli) bir
    // değeri maskelemek sessizce tabana yuvarlardı.
    if (!Number.isInteger(operand.value)) {
      return { status: 'unresolved', reason: `maske tam sayı ister, gelen: ${operand.value}` };
    }
    const masked = (operand.value & condition.mask) >>> 0;
    return masked === condition.expected
      ? { status: 'true', left: masked, right: condition.expected }
      : { status: 'false', left: masked, right: condition.expected };
  }

  const left = evaluateOperand(condition.left, context);
  if (left.status === 'unresolved') return left;
  const right = evaluateOperand(condition.right, context);
  if (right.status === 'unresolved') return right;

  return compare(left.value, condition.operator, right.value)
    ? { status: 'true', left: left.value, right: right.value }
    : { status: 'false', left: left.value, right: right.value };
}

/** Rapordaki "Expected value" alanı için koşulun insan okur özeti. */
export function describeCondition(condition: Condition): string {
  if (condition.kind === 'mask') {
    return `(operand & 0x${condition.mask.toString(16).toUpperCase()}) == 0x${condition.expected.toString(16).toUpperCase()}`;
  }
  return `${describeOperand(condition.left)} ${condition.operator} ${describeOperand(condition.right)}`;
}

export function describeOperand(operand: Operand): string {
  switch (operand.kind) {
    case 'constant':
      return String(operand.value);
    case 'variable':
      return `$${operand.name}`;
    case 'frame-length':
      return 'frame.length';
    case 'frame-field':
      return `frame[${operand.offset}:${operand.width}${operand.endianness === 'big' ? 'BE' : 'LE'}]`;
  }
}
