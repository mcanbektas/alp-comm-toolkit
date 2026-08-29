/**
 * Test Automation Studio ekranı — spec §38.
 *
 * Ekran boş AÇILMAZ: senaryo kutusunda §38'in kendi örneğinin (39421-39429)
 * uygulanabilir hâli hazır durur ve "Çalıştır" ilk tıklamada simüle cihaza
 * bağlanıp gerçek bir rapor üretir. Playwright'ta Web Serial yok, yani bu
 * ekranın tarayıcıda sınanabilmesi tamamen simüle cihaza bağlı
 * (`connection/mock/simulatedDevice.ts`).
 *
 * "Çalıştır" düğmesi bilerek bir TIKLAMA işleyicisi: gerçek port seçimi
 * (`requestPort`) kullanıcı jesti içinde başlamak zorunda (§41 39562).
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { ReportPanel } from './components/ReportPanel';
import { ScenarioPanel } from './components/ScenarioPanel';
import { TEST_FRAMING_METHODS, useTestAutomation } from './useTestAutomation';
import type { TestFramingMethod, TestSourceKind } from './useTestAutomation';
import type { TranslationKey } from '@/translations';

const SECTION_CLASS = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-4';
const SECTION_TITLE_CLASS = 'font-display text-sm font-semibold uppercase tracking-wide text-muted';
const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const FRAMING_LABELS: Record<TestFramingMethod, TranslationKey> = {
  'fixed-length': 'testAutomation.framing.fixedLength',
  'start-byte': 'testAutomation.framing.startByte',
  'line-ending': 'testAutomation.framing.lineEnding',
  'inter-frame-timeout': 'testAutomation.framing.interFrameTimeout',
  slip: 'testAutomation.framing.slip',
  cobs: 'testAutomation.framing.cobs',
  'hdlc-flag': 'testAutomation.framing.hdlcFlag',
};

/** Yöntemin parametresi yoksa alan gizlenir; boş bir kutu soru işareti bırakır. */
const PARAMETERLESS: ReadonlySet<TestFramingMethod> = new Set<TestFramingMethod>(['slip', 'cobs', 'hdlc-flag']);

export function TestAutomationScreen(): ReactNode {
  const { t } = useTranslation();
  const automation = useTestAutomation();
  const { state, connection } = automation;
  const running = state.status === 'running';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('testAutomation.title')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('testAutomation.intro')}</p>
        <p className="max-w-3xl text-xs text-muted">{t('testAutomation.privacy')}</p>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('testAutomation.section.connection')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="ta-source">
            {t('testAutomation.source.kind')}
            <select
              id="ta-source"
              data-testid="ta-source"
              className={FIELD_CLASS}
              value={connection.sourceKind}
              onChange={(event) => automation.setConnection({ sourceKind: event.target.value as TestSourceKind })}
            >
              <option value="simulated-device">{t('testAutomation.source.simulated')}</option>
              <option value="serial">{t('testAutomation.source.serial')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="ta-framing">
            {t('testAutomation.source.framing')}
            <select
              id="ta-framing"
              data-testid="ta-framing"
              className={FIELD_CLASS}
              value={connection.framingMethod}
              onChange={(event) => automation.setConnection({ framingMethod: event.target.value as TestFramingMethod })}
            >
              {TEST_FRAMING_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(FRAMING_LABELS[method])}
                </option>
              ))}
            </select>
          </label>

          {PARAMETERLESS.has(connection.framingMethod) ? null : (
            <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="ta-framing-parameter">
              {t('testAutomation.source.framingParameter')}
              <input
                id="ta-framing-parameter"
                data-testid="ta-framing-parameter"
                className={FIELD_CLASS}
                value={connection.framingParameter}
                onChange={(event) => automation.setConnection({ framingParameter: event.target.value })}
              />
            </label>
          )}
        </div>

        {connection.sourceKind === 'serial' && !automation.serialSupported ? (
          <p className="text-xs text-warn" data-testid="ta-serial-unsupported">
            {t('testAutomation.source.serialUnsupported')}
          </p>
        ) : null}
        {connection.sourceKind === 'simulated-device' ? (
          <p className="text-xs text-muted">{t('testAutomation.source.simulatedHint')}</p>
        ) : null}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('testAutomation.section.scenario')}</h2>
        <ScenarioPanel
          scenario={automation.scenario}
          issues={automation.issues}
          onChange={automation.setScenario}
          onImport={(file) => {
            void automation.importScenario(file);
          }}
          onExport={automation.exportScenario}
          onReset={automation.resetScenario}
        />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('testAutomation.section.run')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BUTTON_CLASS}
            data-testid="ta-run"
            disabled={running || automation.issues.length > 0}
            onClick={() => {
              void automation.run();
            }}
          >
            {t('testAutomation.action.run')}
          </button>
          <button type="button" className={BUTTON_CLASS} data-testid="ta-cancel" disabled={!running} onClick={automation.cancel}>
            {t('testAutomation.action.cancel')}
          </button>
          {running ? (
            <span className="text-sm text-muted" role="status" data-testid="ta-running">
              {t('testAutomation.status.running', { count: state.steps.length })}
            </span>
          ) : null}
        </div>

        {state.errorMessage === undefined ? null : (
          <p className="text-sm text-danger" role="alert" data-testid="ta-error">
            {state.errorMessage}
          </p>
        )}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('testAutomation.section.report')}</h2>
        <ReportPanel
          steps={state.steps}
          report={state.report}
          droppedFrames={state.droppedFrames}
          onExportReport={automation.exportReport}
        />
      </section>
    </div>
  );
}
