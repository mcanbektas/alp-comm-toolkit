/**
 * Koşu sonucu — spec §38'in rapor alanları ekranda.
 *
 * Adım tablosu SANALLAŞTIRILMIŞ: 100 turluk bir döngü (spec'in kendi örneği,
 * 39428) dokuz adımla 900 satır eder ve §44 tabloların sanallaştırılmasını
 * istiyor. Satırlar koşu SÜRERKEN de akar; rapor beklenmez.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { VirtualizedTable } from '@/components/virtualized-tables/VirtualizedTable';
import { STEP_LABELS } from './ScenarioPanel';
import type { StepOutcome, StepResult, TestReport } from '../report';
import type { TranslationKey } from '@/translations';

const ROW_HEIGHT_PX = 28;
const TABLE_HEIGHT_PX = 360;

const OUTCOME_LABELS: Record<StepOutcome, TranslationKey> = {
  pass: 'testAutomation.outcome.pass',
  fail: 'testAutomation.outcome.fail',
  timeout: 'testAutomation.outcome.timeout',
  error: 'testAutomation.outcome.error',
};

/** Ham renk yasak (CLAUDE.md); sonuç renkleri token'dan. */
const OUTCOME_CLASSES: Record<StepOutcome, string> = {
  pass: 'text-accent-strong',
  fail: 'text-danger',
  timeout: 'text-warn',
  error: 'text-danger',
};

const STATUS_LABELS: Record<TestReport['status'], TranslationKey> = {
  passed: 'testAutomation.runStatus.passed',
  failed: 'testAutomation.runStatus.failed',
  cancelled: 'testAutomation.runStatus.cancelled',
  error: 'testAutomation.runStatus.error',
};

export interface ReportPanelProps {
  readonly steps: readonly StepResult[];
  readonly report: TestReport | undefined;
  readonly droppedFrames: number;
  readonly onExportReport: () => void;
}

export function ReportPanel({ steps, report, droppedFrames, onExportReport }: ReportPanelProps): ReactNode {
  const { t } = useTranslation();

  const renderRow = (index: number): ReactNode => {
    const step = steps[index];
    if (step === undefined) return <div key={index} role="row" style={{ height: ROW_HEIGHT_PX }} />;

    return (
      <div
        key={`${step.stepId}-${index}`}
        role="row"
        className="flex w-full items-center gap-3 border-t border-line px-3 text-left text-xs tabular text-text"
        style={{ height: ROW_HEIGHT_PX }}
      >
        <span role="gridcell" className="w-36 shrink-0 truncate font-mono text-muted">
          {step.stepId}
        </span>
        <span role="gridcell" className="w-32 shrink-0 truncate">
          {t(STEP_LABELS[step.kind])}
        </span>
        <span role="gridcell" className={`w-20 shrink-0 ${OUTCOME_CLASSES[step.outcome]}`}>
          {t(OUTCOME_LABELS[step.outcome])}
        </span>
        <span role="gridcell" className="w-12 shrink-0 text-muted">
          {step.iteration ?? '—'}
        </span>
        <span role="gridcell" className="w-28 shrink-0 truncate">
          {step.expectedValue ?? '—'}
        </span>
        <span role="gridcell" className="w-28 shrink-0 truncate">
          {step.actualValue ?? '—'}
        </span>
        <span role="gridcell" className="truncate font-mono text-muted">
          {step.errorDetails ?? step.message ?? step.receivedFrame ?? '—'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {report === undefined ? null : (
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`font-display text-sm font-semibold uppercase tracking-wide ${
              report.status === 'passed' ? 'text-accent-strong' : 'text-danger'
            }`}
            data-testid="ta-run-status"
          >
            {t(STATUS_LABELS[report.status])}
          </span>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted">{t('testAutomation.report.pass')}</dt>
            <dd className="tabular" data-testid="ta-pass-count">
              {report.passCount}
            </dd>
            <dt className="text-muted">{t('testAutomation.report.fail')}</dt>
            <dd className="tabular" data-testid="ta-fail-count">
              {report.failCount}
            </dd>
            <dt className="text-muted">{t('testAutomation.report.timeout')}</dt>
            <dd className="tabular">{report.timeoutCount}</dd>
            <dt className="text-muted">{t('testAutomation.report.error')}</dt>
            <dd className="tabular">{report.errorCount}</dd>
            <dt className="text-muted">{t('testAutomation.report.executed')}</dt>
            <dd className="tabular">{report.executedSteps}</dd>
            <dt className="text-muted">{t('testAutomation.report.duration')}</dt>
            <dd className="tabular">{Math.round(report.endedAt - report.startedAt)} ms</dd>
          </dl>
          <button
            type="button"
            data-testid="ta-export-report"
            className="rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onExportReport}
          >
            {t('testAutomation.action.exportReport')}
          </button>
        </div>
      )}

      {report?.truncated === true ? (
        <p className="text-xs text-warn">{t('testAutomation.report.truncated')}</p>
      ) : null}
      {droppedFrames > 0 ? (
        <p className="text-xs text-muted">{t('testAutomation.report.dropped', { count: droppedFrames })}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="w-36 shrink-0">{t('testAutomation.table.step')}</span>
        <span className="w-32 shrink-0">{t('testAutomation.table.kind')}</span>
        <span className="w-20 shrink-0">{t('testAutomation.table.outcome')}</span>
        <span className="w-12 shrink-0">{t('testAutomation.table.iteration')}</span>
        <span className="w-28 shrink-0">{t('testAutomation.table.expected')}</span>
        <span className="w-28 shrink-0">{t('testAutomation.table.actual')}</span>
        <span>{t('testAutomation.table.details')}</span>
      </div>

      <VirtualizedTable
        rowCount={steps.length}
        rowHeight={ROW_HEIGHT_PX}
        height={Math.min(TABLE_HEIGHT_PX, Math.max(steps.length, 1) * ROW_HEIGHT_PX)}
        renderRow={renderRow}
        followTail
        ariaLabel={t('testAutomation.table.label')}
        emptyLabel={t('testAutomation.table.empty')}
      />
    </div>
  );
}
