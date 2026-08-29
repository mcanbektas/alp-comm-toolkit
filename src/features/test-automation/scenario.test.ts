import { describe, expect, it } from 'vitest';

import { MAX_LOOP_COUNT, SCENARIO_FORMAT_VERSION, TEST_STEP_KINDS, createEmptyScenario, validateScenario } from './scenario';
import type { TestScenario, TestStep } from './scenario';

function scenario(steps: readonly TestStep[]): TestScenario {
  return { formatVersion: SCENARIO_FORMAT_VERSION, name: 'senaryo', steps };
}

describe('senaryo modeli', () => {
  it('spec §38\'in 13 adım tipini taşır — ne eksik ne fazla', () => {
    expect(TEST_STEP_KINDS).toHaveLength(13);
    expect(TEST_STEP_KINDS).toEqual([
      'connect',
      'disconnect',
      'send-frame',
      'wait',
      'wait-for-frame',
      'validate-field',
      'validate-crc',
      'set-variable',
      'increment-variable',
      'loop',
      'conditional',
      'log',
      'export-report',
    ]);
  });

  it('boş senaryo sürüm alanıyla doğar', () => {
    expect(createEmptyScenario('yeni')).toEqual({ formatVersion: SCENARIO_FORMAT_VERSION, name: 'yeni', steps: [] });
  });

  it('JSON turunu kayıpsız atlatır', () => {
    const original = scenario([{ id: 's1', kind: 'send-frame', payload: { source: 'bytes', bytes: [0xaa, 0x31] } }]);
    // Baytların `Uint8Array` DEĞİL dizi olmasının sebebi tam bu tur.
    expect(JSON.parse(JSON.stringify(original))).toEqual(original);
  });
});

describe('validateScenario', () => {
  it('geçerli senaryoda sorun bulmaz', () => {
    expect(validateScenario(scenario([{ id: 's1', kind: 'connect' }]))).toEqual([]);
  });

  it('boş adı yakalar', () => {
    const issues = validateScenario({ formatVersion: SCENARIO_FORMAT_VERSION, name: '  ', steps: [] });
    expect(issues.map((issue) => issue.message)).toContain('senaryo adı boş');
  });

  it('bilinmeyen biçim sürümünü yakalar', () => {
    const issues = validateScenario({ formatVersion: 99, name: 'x', steps: [] });
    expect(issues[0]?.message).toContain('bilinmeyen biçim sürümü');
  });

  it('tekrar eden adım kimliğini yakalar — döngü İÇİNDE de', () => {
    const issues = validateScenario(
      scenario([
        { id: 'a', kind: 'connect' },
        { id: 'loop', kind: 'loop', count: 2, steps: [{ id: 'a', kind: 'disconnect' }] },
      ]),
    );
    expect(issues.map((issue) => issue.message)).toContain('adım kimliği tekrar ediyor: a');
  });

  it('döngü üst sınırını dayatır (§41 sonsuz loop engelle)', () => {
    const issues = validateScenario(
      scenario([
        {
          id: 'loop',
          kind: 'loop',
          count: MAX_LOOP_COUNT + 1,
          steps: [{ id: 'x', kind: 'log', message: 'x' }],
        },
      ]),
    );
    expect(issues[0]?.message).toContain(`üst sınırı ${MAX_LOOP_COUNT}`);
  });

  it('boş döngüyü ve sıfır sayımı yakalar', () => {
    const issues = validateScenario(scenario([{ id: 'loop', kind: 'loop', count: 0, steps: [] }]));
    expect(issues).toHaveLength(2);
  });

  it('negatif beklemeyi ve sıfır zaman aşımını yakalar', () => {
    const issues = validateScenario(
      scenario([
        { id: 'w', kind: 'wait', durationMs: -1 },
        { id: 'f', kind: 'wait-for-frame', timeoutMs: 0, match: undefined },
      ]),
    );
    expect(issues).toHaveLength(2);
  });

  it('boş gönderimi ve seçilmemiş şablonu yakalar', () => {
    const issues = validateScenario(
      scenario([
        { id: 'a', kind: 'send-frame', payload: { source: 'bytes', bytes: [] } },
        { id: 'b', kind: 'send-frame', payload: { source: 'template', templateId: '' } },
      ]),
    );
    expect(issues).toHaveLength(2);
  });

  it('koşullu dalların içine de bakar', () => {
    const issues = validateScenario(
      scenario([
        {
          id: 'branch',
          kind: 'conditional',
          condition: { kind: 'compare', left: { kind: 'constant', value: 1 }, operator: '>', right: { kind: 'constant', value: 0 } },
          thenSteps: [{ id: 'w', kind: 'wait', durationMs: Number.NaN }],
          elseSteps: [{ id: 'v', kind: 'set-variable', name: ' ', value: { kind: 'constant', value: 1 } }],
        },
      ]),
    );
    expect(issues).toHaveLength(2);
  });
});

describe('validateScenario — plugin zarfı taşıyan gönderim', () => {
  it('encoder seçilmemiş adımı yakalar', () => {
    const issues = validateScenario(
      scenario([{ id: 's1', kind: 'send-frame', payload: { source: 'plugin-frame', pluginId: '', bytes: [1] } }]),
    );

    expect(issues.map((issue) => issue.message)).toContain('protokol encoder\'ı seçilmedi');
  });

  /** Boş yük geçerlidir: bazı zarflar yüksüz de anlamlı bir çerçeve üretir. */
  it('boş yükü sorun SAYMAZ', () => {
    const issues = validateScenario(
      scenario([{ id: 's1', kind: 'send-frame', payload: { source: 'plugin-frame', pluginId: 'hdlc', bytes: [] } }]),
    );

    expect(issues).toEqual([]);
  });

  it('aralık dışı yük baytını yakalar', () => {
    const issues = validateScenario(
      scenario([
        { id: 's1', kind: 'send-frame', payload: { source: 'plugin-frame', pluginId: 'hdlc', bytes: [0x100] } },
      ]),
    );

    expect(issues.map((issue) => issue.message)).toContain('yük baytı 0-255 aralığında olmalı');
  });
});
