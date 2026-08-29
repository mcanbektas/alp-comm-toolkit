import { describe, expect, it } from 'vitest';

import { appendStep, collectIds, createStep, moveStep, nextStepId, removeStep, updateStep } from './scenarioEdit';
import { validateScenario, SCENARIO_FORMAT_VERSION, TEST_STEP_KINDS } from './scenario';
import type { TestStep } from './scenario';

const TREE: readonly TestStep[] = [
  { id: 'a', kind: 'connect' },
  {
    id: 'loop',
    kind: 'loop',
    count: 2,
    steps: [
      { id: 'inner-1', kind: 'log', message: 'bir' },
      { id: 'inner-2', kind: 'log', message: 'iki' },
    ],
  },
  {
    id: 'branch',
    kind: 'conditional',
    condition: { kind: 'compare', left: { kind: 'constant', value: 1 }, operator: '>', right: { kind: 'constant', value: 0 } },
    thenSteps: [{ id: 'then-1', kind: 'log', message: 'evet' }],
    elseSteps: [],
  },
];

describe('updateStep', () => {
  it('iç içe adımı günceller', () => {
    const next = updateStep(TREE, 'inner-2', (step) => ({ ...step, label: 'etiket' }));
    const loop = next[1];
    if (loop?.kind !== 'loop') throw new Error('döngü yok');
    expect(loop.steps[1]?.label).toBe('etiket');
    // Kaynak ağaç DEĞİŞMEZ.
    expect(TREE[1]?.kind === 'loop' && TREE[1].steps[1]?.label).toBeUndefined();
  });

  it('koşul dallarına da iner', () => {
    const next = updateStep(TREE, 'then-1', (step) => ({ ...step, label: 'x' }));
    const branch = next[2];
    if (branch?.kind !== 'conditional') throw new Error('koşul yok');
    expect(branch.thenSteps[0]?.label).toBe('x');
  });
});

describe('removeStep', () => {
  it('kökten siler', () => {
    expect(removeStep(TREE, 'a').map((step) => step.id)).toEqual(['loop', 'branch']);
  });

  it('döngü içinden siler', () => {
    const loop = removeStep(TREE, 'inner-1')[1];
    if (loop?.kind !== 'loop') throw new Error('döngü yok');
    expect(loop.steps.map((step) => step.id)).toEqual(['inner-2']);
  });
});

describe('moveStep', () => {
  it('kök listede kaydırır', () => {
    expect(moveStep(TREE, 'branch', -1).map((step) => step.id)).toEqual(['a', 'branch', 'loop']);
  });

  it('sınırın dışına taşımaz', () => {
    expect(moveStep(TREE, 'a', -1).map((step) => step.id)).toEqual(['a', 'loop', 'branch']);
  });

  it('döngü içindeki sırayı değiştirir', () => {
    const loop = moveStep(TREE, 'inner-2', -1)[1];
    if (loop?.kind !== 'loop') throw new Error('döngü yok');
    expect(loop.steps.map((step) => step.id)).toEqual(['inner-2', 'inner-1']);
  });
});

describe('appendStep', () => {
  it('kökün sonuna ekler', () => {
    const next = appendStep(TREE, { id: 'yeni', kind: 'disconnect' });
    expect(next.at(-1)?.id).toBe('yeni');
  });

  it('döngünün içine ekler', () => {
    const loop = appendStep(TREE, { id: 'yeni', kind: 'disconnect' }, 'loop', 'steps')[1];
    if (loop?.kind !== 'loop') throw new Error('döngü yok');
    expect(loop.steps.map((step) => step.id)).toEqual(['inner-1', 'inner-2', 'yeni']);
  });

  it('koşulun else dalına ekler', () => {
    const branch = appendStep(TREE, { id: 'yeni', kind: 'disconnect' }, 'branch', 'elseSteps')[2];
    if (branch?.kind !== 'conditional') throw new Error('koşul yok');
    expect(branch.elseSteps.map((step) => step.id)).toEqual(['yeni']);
  });
});

describe('nextStepId', () => {
  it('kullanılmayan kimlik üretir — iç içe kimlikleri de sayar', () => {
    expect(collectIds(TREE).has('inner-1')).toBe(true);
    expect(nextStepId('log', TREE)).toBe('log-1');
    const withLog = appendStep(TREE, { id: 'log-1', kind: 'log', message: 'x' });
    expect(nextStepId('log', withLog)).toBe('log-2');
  });
});

describe('createStep', () => {
  it('her adım tipi GEÇERLİ bir senaryo üretir', () => {
    for (const kind of TEST_STEP_KINDS) {
      const step = createStep(kind, `${kind}-1`);
      const issues = validateScenario({ formatVersion: SCENARIO_FORMAT_VERSION, name: 'x', steps: [step] });
      expect(issues, `${kind} varsayılanı geçersiz`).toEqual([]);
    }
  });
});
