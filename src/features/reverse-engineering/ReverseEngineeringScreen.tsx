/**
 * Unknown Protocol Analyzer ekranı — spec §35 + §36.
 *
 * Ekran boş AÇILMAZ: girdi kutusu spec 35060'ın RF telemetri setiyle dolu
 * gelir, "Analiz et" ilk tıklamada gerçek bir rapor üretir. "Boş kart basmak
 * yasak" kuralının bu ekrandaki karşılığı budur — kullanıcı neyin beklendiğini
 * örnekten okur.
 *
 * Sonuç bölümleri rapor GELMEDEN görünmez; bunun yerine analizin hangi adımda
 * olduğu yazılır (§44'ün progress göstergesi). İptal edilen analizde KISMİ
 * rapor gösterilir ve iptal edildiği açıkça söylenir — yarım bir raporu tam
 * gibi göstermek, hiç göstermemekten kötüdür.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { AnalysisInputPanel } from './components/AnalysisInputPanel';
import { ClusterPanel } from './components/ClusterPanel';
import { ColumnProfileTable } from './components/ColumnProfileTable';
import { FieldCandidatesPanel } from './components/FieldCandidatesPanel';
import { FrameDiffPanel } from './components/FrameDiffPanel';
import { useReverseEngineering } from './useReverseEngineering';
import type { AnalysisPhase } from '@/protocol-core/analysis/report';
import type { TranslationKey } from '@/translations';

const SECTION_CLASS = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-4';
const SECTION_TITLE_CLASS = 'font-display text-sm font-semibold uppercase tracking-wide text-muted';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const PHASE_LABELS: Record<AnalysisPhase, TranslationKey> = {
  columns: 'reverseEngineering.phase.columns',
  clusters: 'reverseEngineering.phase.clusters',
  counters: 'reverseEngineering.phase.counters',
  lengthFields: 'reverseEngineering.phase.lengthFields',
  asciiFields: 'reverseEngineering.phase.asciiFields',
  timestampFields: 'reverseEngineering.phase.timestampFields',
  period: 'reverseEngineering.phase.period',
  checksums: 'reverseEngineering.phase.checksums',
  roles: 'reverseEngineering.phase.roles',
  correlation: 'reverseEngineering.phase.correlation',
};

export function ReverseEngineeringScreen(): ReactNode {
  const { t } = useTranslation();
  const analyzer = useReverseEngineering();
  const { state } = analyzer;
  const [diffLeft, setDiffLeft] = useState(0);
  const [diffRight, setDiffRight] = useState(1);
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  const report = state.report;

  const handleExport = (): void => {
    if (report === undefined) return;
    try {
      setExportError(undefined);
      downloadTextFile('protokol-analizi.json', JSON.stringify(report, null, 2), 'application/json');
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('reverseEngineering.title')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('reverseEngineering.intro')}</p>
        <p className="max-w-3xl text-xs text-muted">{t('reverseEngineering.privacy')}</p>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.input')}</h2>
        <AnalysisInputPanel
          input={analyzer.input}
          state={state}
          onChange={analyzer.setInput}
          onAnalyze={analyzer.analyze}
          onCancel={analyzer.cancel}
          onFileSelected={(file) => {
            void analyzer.loadFile(file);
          }}
          onClearFile={analyzer.clearFile}
        />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.status')}</h2>

        {state.status === 'analyzing' ? (
          <p className="text-sm text-muted" role="status" data-testid="re-progress">
            {state.progress === undefined
              ? t('reverseEngineering.status.starting')
              : t('reverseEngineering.status.progress', {
                  phase: t(PHASE_LABELS[state.progress.phase]),
                  completed: state.progress.completed,
                  total: state.progress.total,
                })}
          </p>
        ) : null}

        {state.status === 'cancelled' ? (
          <p className="text-sm text-warn" role="status" data-testid="re-cancelled">
            {t('reverseEngineering.status.cancelled')}
          </p>
        ) : null}

        {state.error === undefined ? null : (
          <p className="text-sm text-danger" role="alert" data-testid="re-error">
            {state.error}
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t('reverseEngineering.summary.frameCount')}</dt>
          <dd className="tabular" data-testid="re-frame-count">
            {state.frameCount}
          </dd>
          {report === undefined ? null : (
            <>
              <dt className="text-muted">{t('reverseEngineering.summary.lengthRange')}</dt>
              <dd className="tabular" data-testid="re-length-range">
                {report.lengthRange.min}…{report.lengthRange.max}
              </dd>
            </>
          )}
          {state.elapsedMs === undefined ? null : (
            <>
              <dt className="text-muted">{t('reverseEngineering.summary.elapsed')}</dt>
              <dd className="tabular">{state.elapsedMs} ms</dd>
            </>
          )}
        </dl>

        {state.truncated ? (
          <p className="text-xs text-warn" data-testid="re-truncated">
            {t('reverseEngineering.summary.truncated')}
          </p>
        ) : null}

        {state.issues.length === 0 ? null : (
          <div className="flex flex-col gap-1" data-testid="re-issues">
            <p className="text-xs text-warn">{t('reverseEngineering.summary.issues', { count: state.issues.length })}</p>
            <ul className="list-inside list-disc text-xs text-muted">
              {state.issues.slice(0, 10).map((issue) => (
                <li key={`${issue.line}-${issue.text}`}>
                  {t(
                    issue.reason === 'not-hex'
                      ? 'reverseEngineering.issue.notHex'
                      : 'reverseEngineering.issue.oddDigits',
                    { line: issue.line, text: issue.text },
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report === undefined ? null : (
        <>
          <section className={SECTION_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.columns')}</h2>
              <button type="button" className={BUTTON_CLASS} data-testid="re-export" onClick={handleExport}>
                {t('reverseEngineering.action.export')}
              </button>
            </div>
            {exportError === undefined ? null : (
              <p className="text-sm text-danger" role="alert">
                {exportError}
              </p>
            )}
            <ColumnProfileTable columns={report.columns} roles={report.roles} />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.candidates')}</h2>
            <FieldCandidatesPanel
              counters={report.counters}
              lengthFields={report.lengthFields}
              asciiFields={report.asciiFields}
              timestampFields={report.timestampFields}
              checksums={report.checksums}
              period={report.period}
              seriesCorrelations={report.seriesCorrelations}
            />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.clusters')}</h2>
            <ClusterPanel clusters={report.clusters} />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('reverseEngineering.section.diff')}</h2>
            <FrameDiffPanel
              frames={state.frames}
              leftIndex={diffLeft}
              rightIndex={diffRight}
              onSelect={(side, index) => {
                const next = Number.isFinite(index) ? index : 0;
                if (side === 'left') setDiffLeft(next);
                else setDiffRight(next);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
