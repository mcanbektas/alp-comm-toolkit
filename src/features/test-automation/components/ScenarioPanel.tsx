/**
 * Senaryo düzenleyici: adım listesi, ekleme menüsü ve dosya turları.
 *
 * Liste ÖZYİNELİ: `loop` ve `conditional` kendi çocuklarını taşıyor ve
 * girintili basılıyorlar. Düz bir liste, döngü içindeki adımın hangi döngüye
 * ait olduğunu göstermezdi — koşu raporu tur numarası bastığı hâlde düzenleyici
 * yapıyı gizlerdi.
 *
 * Ağaç düzenleme kuralları burada değil `../scenarioEdit.ts`te: bileşenin
 * içinde yazılsalardı yalnız tarayıcıda sınanabilirlerdi.
 */

import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { StepFields } from './StepFields';
import { TEST_STEP_KINDS } from '../scenario';
import { appendStep, createStep, moveStep, nextStepId, removeStep, updateStep } from '../scenarioEdit';
import type { BranchKey } from '../scenarioEdit';
import type { ScenarioIssue, TestScenario, TestStep, TestStepKind } from '../scenario';
import type { TranslationKey } from '@/translations';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-2 py-1 text-xs text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export const STEP_LABELS: Record<TestStepKind, TranslationKey> = {
  connect: 'testAutomation.step.connect',
  disconnect: 'testAutomation.step.disconnect',
  'send-frame': 'testAutomation.step.sendFrame',
  wait: 'testAutomation.step.wait',
  'wait-for-frame': 'testAutomation.step.waitForFrame',
  'validate-field': 'testAutomation.step.validateField',
  'validate-crc': 'testAutomation.step.validateCrc',
  'set-variable': 'testAutomation.step.setVariable',
  'increment-variable': 'testAutomation.step.incrementVariable',
  loop: 'testAutomation.step.loop',
  conditional: 'testAutomation.step.conditional',
  log: 'testAutomation.step.log',
  'export-report': 'testAutomation.step.exportReport',
};

interface AddMenuProps {
  readonly testId: string;
  readonly onAdd: (kind: TestStepKind) => void;
}

function AddMenu({ testId, onAdd }: AddMenuProps): ReactNode {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {t('testAutomation.scenario.addStep')}
      <select
        data-testid={testId}
        className={FIELD_CLASS}
        value=""
        onChange={(event) => {
          if (event.target.value === '') return;
          onAdd(event.target.value as TestStepKind);
          // Seçim sıfırlanır: aynı tipten ikinci adım eklemek için listeyi
          // başka bir değere getirip geri getirmek gerekmesin.
          event.target.value = '';
        }}
      >
        <option value="">…</option>
        {TEST_STEP_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(STEP_LABELS[kind])}
          </option>
        ))}
      </select>
    </label>
  );
}

interface StepRowsProps {
  readonly steps: readonly TestStep[];
  readonly depth: number;
  readonly issues: readonly ScenarioIssue[];
  readonly onChange: (step: TestStep) => void;
  readonly onRemove: (id: string) => void;
  readonly onMove: (id: string, delta: number) => void;
  readonly onAddChild: (parentId: string, branch: BranchKey, kind: TestStepKind) => void;
}

function StepRows({ steps, depth, issues, onChange, onRemove, onMove, onAddChild }: StepRowsProps): ReactNode {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-col gap-2">
      {steps.map((step) => {
        const stepIssues = issues.filter((issue) => issue.stepId === step.id);
        return (
          <li
            key={step.id}
            data-testid={`ta-step-${step.id}`}
            className="flex flex-col gap-2 rounded-token-sm border border-line bg-raised p-2"
            style={{ marginInlineStart: depth * 16 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs font-semibold uppercase tracking-wide text-accent-strong">
                {t(STEP_LABELS[step.kind])}
              </span>
              <span className="font-mono text-xs text-muted">{step.id}</span>
              <span className="grow" />
              <button type="button" className={BUTTON_CLASS} onClick={() => onMove(step.id, -1)}>
                ↑
              </button>
              <button type="button" className={BUTTON_CLASS} onClick={() => onMove(step.id, 1)}>
                ↓
              </button>
              <button
                type="button"
                className={BUTTON_CLASS}
                data-testid={`ta-remove-${step.id}`}
                onClick={() => onRemove(step.id)}
              >
                {t('testAutomation.action.removeStep')}
              </button>
            </div>

            <StepFields step={step} onChange={onChange} />

            {stepIssues.length === 0 ? null : (
              <ul className="list-inside list-disc text-xs text-danger">
                {stepIssues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
            )}

            {step.kind === 'loop' ? (
              <div className="flex flex-col gap-2 border-t border-line pt-2">
                <AddMenu testId={`ta-add-${step.id}-steps`} onAdd={(kind) => onAddChild(step.id, 'steps', kind)} />
                <StepRows
                  steps={step.steps}
                  depth={depth + 1}
                  issues={issues}
                  onChange={onChange}
                  onRemove={onRemove}
                  onMove={onMove}
                  onAddChild={onAddChild}
                />
              </div>
            ) : null}

            {step.kind === 'conditional' ? (
              <div className="flex flex-col gap-3 border-t border-line pt-2">
                {(['thenSteps', 'elseSteps'] as const).map((branch) => (
                  <div key={branch} className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {t(branch === 'thenSteps' ? 'testAutomation.field.thenBranch' : 'testAutomation.field.elseBranch')}
                    </span>
                    <AddMenu testId={`ta-add-${step.id}-${branch}`} onAdd={(kind) => onAddChild(step.id, branch, kind)} />
                    <StepRows
                      steps={branch === 'thenSteps' ? step.thenSteps : step.elseSteps}
                      depth={depth + 1}
                      issues={issues}
                      onChange={onChange}
                      onRemove={onRemove}
                      onMove={onMove}
                      onAddChild={onAddChild}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export interface ScenarioPanelProps {
  readonly scenario: TestScenario;
  readonly issues: readonly ScenarioIssue[];
  readonly onChange: (scenario: TestScenario) => void;
  readonly onImport: (file: File) => void;
  readonly onExport: () => void;
  readonly onReset: () => void;
}

export function ScenarioPanel({ scenario, issues, onChange, onImport, onExport, onReset }: ScenarioPanelProps): ReactNode {
  const { t } = useTranslation();

  const withSteps = (steps: readonly TestStep[]): void => {
    onChange({ ...scenario, steps });
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) onImport(file);
  };

  const scenarioIssues = issues.filter((issue) => issue.stepId === undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="ta-name">
          {t('testAutomation.scenario.name')}
          <input
            id="ta-name"
            data-testid="ta-name"
            className={FIELD_CLASS}
            value={scenario.name}
            onChange={(event) => onChange({ ...scenario, name: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="ta-import">
          {t('testAutomation.action.import')}
          <input id="ta-import" data-testid="ta-import" type="file" accept=".json" className={FIELD_CLASS} onChange={handleImport} />
        </label>

        <button type="button" className={BUTTON_CLASS} data-testid="ta-export" onClick={onExport}>
          {t('testAutomation.action.export')}
        </button>
        <button type="button" className={BUTTON_CLASS} data-testid="ta-reset" onClick={onReset}>
          {t('testAutomation.action.reset')}
        </button>
      </div>

      {scenarioIssues.length === 0 ? null : (
        <ul className="list-inside list-disc text-xs text-danger" data-testid="ta-scenario-issues">
          {scenarioIssues.map((issue) => (
            <li key={issue.message}>{issue.message}</li>
          ))}
        </ul>
      )}

      <AddMenu
        testId="ta-add-step"
        onAdd={(kind) => withSteps(appendStep(scenario.steps, createStep(kind, nextStepId(kind, scenario.steps))))}
      />

      {scenario.steps.length === 0 ? (
        <p className="text-xs text-muted">{t('testAutomation.scenario.empty')}</p>
      ) : (
        <StepRows
          steps={scenario.steps}
          depth={0}
          issues={issues}
          onChange={(step) => withSteps(updateStep(scenario.steps, step.id, () => step))}
          onRemove={(id) => withSteps(removeStep(scenario.steps, id))}
          onMove={(id, delta) => withSteps(moveStep(scenario.steps, id, delta))}
          onAddChild={(parentId, branch, kind) =>
            withSteps(appendStep(scenario.steps, createStep(kind, nextStepId(kind, scenario.steps)), parentId, branch))
          }
        />
      )}
    </div>
  );
}
