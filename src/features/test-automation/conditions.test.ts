import { describe, expect, it } from 'vitest';

import { describeCondition, evaluateCondition, evaluateOperand } from './conditions';
import type { Condition, EvaluationContext, Operand } from './conditions';

/** Spec §43'ün custom protocol fixture'ı: `AA 05 10 03 34 12 7F 4F 55`. */
const FRAME = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);

function context(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return { variables: new Map(), lastFrame: FRAME, ...overrides };
}

describe('evaluateOperand', () => {
  it('çerçeve alanını okur', () => {
    const operand: Operand = { kind: 'frame-field', offset: 1, width: 1, endianness: 'big' };
    expect(evaluateOperand(operand, context())).toEqual({ status: 'value', value: 5 });
  });

  it('ölçek ve ofset uygular', () => {
    // Ham 0x34 = 52; ×0.1 → 5.2 (spec §33'ün `value × 0.1` modeli).
    const operand: Operand = { kind: 'frame-field', offset: 4, width: 1, endianness: 'big', scale: 0.1 };
    const result = evaluateOperand(operand, context());
    expect(result.status).toBe('value');
    if (result.status !== 'value') throw new Error('değer yok');
    expect(result.value).toBeCloseTo(5.2, 10);
  });

  it('işaretli okumada iki\'nin tümleyenini uygular', () => {
    // 0xAA = 170 işaretsiz, −86 işaretli.
    const unsigned: Operand = { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' };
    const signed: Operand = { kind: 'frame-field', offset: 0, width: 1, endianness: 'big', signed: true };
    expect(evaluateOperand(unsigned, context())).toEqual({ status: 'value', value: 170 });
    expect(evaluateOperand(signed, context())).toEqual({ status: 'value', value: -86 });
  });

  it('çerçeve yoksa 0 UYDURMAZ', () => {
    const operand: Operand = { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' };
    const result = evaluateOperand(operand, context({ lastFrame: undefined }));
    expect(result.status).toBe('unresolved');
  });

  it('alan çerçeveye sığmıyorsa çözülemez', () => {
    const operand: Operand = { kind: 'frame-field', offset: 8, width: 4, endianness: 'big' };
    const result = evaluateOperand(operand, context());
    expect(result.status).toBe('unresolved');
  });

  it('tanımsız değişkeni 0 SAYMAZ', () => {
    const result = evaluateOperand({ kind: 'variable', name: 'sicaklik' }, context());
    expect(result).toEqual({ status: 'unresolved', reason: 'değişken tanımsız: sicaklik' });
  });

  it('çerçeve uzunluğunu verir', () => {
    expect(evaluateOperand({ kind: 'frame-length' }, context())).toEqual({ status: 'value', value: 9 });
  });
});

describe('evaluateCondition', () => {
  it('§38 örneğinin karşılaştırmasını yapar (sıcaklık > 85)', () => {
    const variables = new Map([['temperature', 90]]);
    const condition: Condition = {
      kind: 'compare',
      left: { kind: 'variable', name: 'temperature' },
      operator: '>',
      right: { kind: 'constant', value: 85 },
    };
    expect(evaluateCondition(condition, context({ variables }))).toEqual({ status: 'true', left: 90, right: 85 });

    const cool = new Map([['temperature', 20]]);
    expect(evaluateCondition(condition, context({ variables: cool })).status).toBe('false');
  });

  it('çözülemeyen operand koşulu FALSE yapmaz', () => {
    const condition: Condition = {
      kind: 'compare',
      left: { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' },
      operator: '>',
      right: { kind: 'constant', value: 85 },
    };
    const result = evaluateCondition(condition, context({ lastFrame: undefined }));
    expect(result.status).toBe('unresolved');
  });

  it('maske koşulunu değerlendirir', () => {
    const condition: Condition = {
      kind: 'mask',
      operand: { kind: 'frame-field', offset: 2, width: 1, endianness: 'big' },
      mask: 0xf0,
      expected: 0x10,
    };
    expect(evaluateCondition(condition, context()).status).toBe('true');
  });

  it('kesirli değeri maskelemeyi REDDEDER', () => {
    const condition: Condition = {
      kind: 'mask',
      operand: { kind: 'frame-field', offset: 4, width: 1, endianness: 'big', scale: 0.1 },
      mask: 0x0f,
      expected: 0x02,
    };
    expect(evaluateCondition(condition, context()).status).toBe('unresolved');
  });

  it('her operatörü doğru uygular', () => {
    const variables = new Map([['v', 10]]);
    const left: Operand = { kind: 'variable', name: 'v' };
    const right: Operand = { kind: 'constant', value: 10 };
    const outcomes = (['==', '!=', '<', '<=', '>', '>='] as const).map(
      (operator) => evaluateCondition({ kind: 'compare', left, operator, right }, context({ variables })).status,
    );
    expect(outcomes).toEqual(['true', 'false', 'false', 'true', 'false', 'true']);
  });
});

describe('describeCondition', () => {
  it('koşulu rapora yazılabilir metne çevirir', () => {
    expect(
      describeCondition({
        kind: 'compare',
        left: { kind: 'frame-field', offset: 4, width: 2, endianness: 'little' },
        operator: '>=',
        right: { kind: 'constant', value: 85 },
      }),
    ).toBe('frame[4:2LE] >= 85');
  });
});
