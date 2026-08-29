/**
 * Senaryo ağacında düzenleme — saf, React'ten bağımsız.
 *
 * Adımlar iç içe geçebiliyor (`loop.steps`, `conditional.thenSteps/elseSteps`),
 * bu yüzden "şu adımı sil" gibi görünüşte basit bir iş ağaç yürüyüşü ister.
 * Bileşenin içinde yazılsaydı her düzenleme kuralı yalnız tarayıcıda
 * sınanabilirdi; burada birim testi kapsıyor.
 *
 * Bütün işlemler YENİ ağaç döndürür: React'in değişiklik saptaması referans
 * karşılaştırmasına dayanıyor, yerinde değiştirilmiş bir dizi ekranı
 * tazelemezdi.
 */

import type { TestStep, TestStepKind } from './scenario';

/** Bir adımın çocuk listesi taşıyan yeri. */
export type BranchKey = 'steps' | 'thenSteps' | 'elseSteps';

function childrenOf(step: TestStep, branch: BranchKey): readonly TestStep[] | undefined {
  if (step.kind === 'loop' && branch === 'steps') return step.steps;
  if (step.kind === 'conditional' && branch === 'thenSteps') return step.thenSteps;
  if (step.kind === 'conditional' && branch === 'elseSteps') return step.elseSteps;
  return undefined;
}

function withChildren(step: TestStep, branch: BranchKey, children: readonly TestStep[]): TestStep {
  if (step.kind === 'loop' && branch === 'steps') return { ...step, steps: children };
  if (step.kind === 'conditional' && branch === 'thenSteps') return { ...step, thenSteps: children };
  if (step.kind === 'conditional' && branch === 'elseSteps') return { ...step, elseSteps: children };
  return step;
}

const BRANCHES: readonly BranchKey[] = ['steps', 'thenSteps', 'elseSteps'];

function mapTree(steps: readonly TestStep[], visit: (step: TestStep) => TestStep): TestStep[] {
  return steps.map((step) => {
    let next = visit(step);
    for (const branch of BRANCHES) {
      const children = childrenOf(next, branch);
      if (children === undefined) continue;
      next = withChildren(next, branch, mapTree(children, visit));
    }
    return next;
  });
}

export function updateStep(steps: readonly TestStep[], id: string, patch: (step: TestStep) => TestStep): TestStep[] {
  return mapTree(steps, (step) => (step.id === id ? patch(step) : step));
}

export function removeStep(steps: readonly TestStep[], id: string): TestStep[] {
  const kept = steps.filter((step) => step.id !== id);
  return kept.map((step) => {
    let next = step;
    for (const branch of BRANCHES) {
      const children = childrenOf(next, branch);
      if (children === undefined) continue;
      next = withChildren(next, branch, removeStep(children, id));
    }
    return next;
  });
}

/**
 * Adımı kendi listesi İÇİNDE kaydırır; dallar arası taşıma YOK. Bir adımı
 * döngünün içinden dışına sürüklemek anlamlı olabilir ama sırayı ve kimlik
 * tekilliğini korumanın kuralı ayrı bir tasarım işi — yarım yapılmış bir
 * taşıma, kullanıcının senaryosunu sessizce bozardı.
 */
export function moveStep(steps: readonly TestStep[], id: string, delta: number): TestStep[] {
  const index = steps.findIndex((step) => step.id === id);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return [...steps];
    const next = [...steps];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return [...steps];
    next.splice(target, 0, moved);
    return next;
  }

  return steps.map((step) => {
    let result = step;
    for (const branch of BRANCHES) {
      const children = childrenOf(result, branch);
      if (children === undefined) continue;
      result = withChildren(result, branch, moveStep(children, id, delta));
    }
    return result;
  });
}

/** Kök listeye ekler; `parentId` verilirse o adımın ilgili dalının sonuna. */
export function appendStep(
  steps: readonly TestStep[],
  step: TestStep,
  parentId?: string,
  branch: BranchKey = 'steps',
): TestStep[] {
  if (parentId === undefined) return [...steps, step];

  return steps.map((current) => {
    if (current.id === parentId) {
      const children = childrenOf(current, branch);
      if (children === undefined) return current;
      return withChildren(current, branch, [...children, step]);
    }
    let next = current;
    for (const key of BRANCHES) {
      const children = childrenOf(next, key);
      if (children === undefined) continue;
      next = withChildren(next, key, appendStep(children, step, parentId, branch));
    }
    return next;
  });
}

/** Ağaçtaki bütün kimlikler — yeni adıma tekil kimlik üretmek için. */
export function collectIds(steps: readonly TestStep[], into: Set<string> = new Set()): Set<string> {
  for (const step of steps) {
    into.add(step.id);
    for (const branch of BRANCHES) {
      const children = childrenOf(step, branch);
      if (children !== undefined) collectIds(children, into);
    }
  }
  return into;
}

export function nextStepId(kind: TestStepKind, steps: readonly TestStep[]): string {
  const used = collectIds(steps);
  for (let index = 1; ; index += 1) {
    const candidate = `${kind}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Yeni adımın varsayılanları. Her alan DOLU başlar: `undefined` bırakılan bir
 * alan, kullanıcı hiç dokunmadan "Çalıştır"a bastığında koşuyu ortasında
 * düşürürdü.
 */
export function createStep(kind: TestStepKind, id: string): TestStep {
  switch (kind) {
    case 'connect':
      return { id, kind };
    case 'disconnect':
      return { id, kind };
    case 'send-frame':
      return { id, kind, payload: { source: 'bytes', bytes: [0xaa, 0x01] } };
    case 'wait':
      // §38'in kendi verdiği tek süre (39424).
      return { id, kind, durationMs: 500 };
    case 'wait-for-frame':
      return { id, kind, timeoutMs: 500, match: undefined };
    case 'validate-field':
      return {
        id,
        kind,
        condition: {
          kind: 'compare',
          left: { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' },
          operator: '==',
          right: { kind: 'constant', value: 0 },
        },
      };
    case 'validate-crc':
      return { id, kind, algorithm: 'xor8', dataStart: 1, trailingOffset: 1, endianness: 'big' };
    case 'set-variable':
      return { id, kind, name: 'deger', value: { kind: 'constant', value: 0 } };
    case 'increment-variable':
      return { id, kind, name: 'deger', by: 1 };
    case 'loop':
      // Boş döngü `validateScenario`da hata; bir adımla doğar.
      return { id, kind, count: 10, steps: [{ id: `${id}-log`, kind: 'log', message: 'tur' }] };
    case 'conditional':
      return {
        id,
        kind,
        condition: {
          kind: 'compare',
          left: { kind: 'constant', value: 1 },
          operator: '>',
          right: { kind: 'constant', value: 0 },
        },
        thenSteps: [],
        elseSteps: [],
      };
    case 'log':
      return { id, kind, message: 'mesaj' };
    case 'export-report':
      return { id, kind };
  }
}
