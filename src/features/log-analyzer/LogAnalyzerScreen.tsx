/**
 * Log çözümleyici ekranı (spec §34). Hesap yoktur: dosya ayrıştırma, filtre,
 * istatistik ve çözümleme `protocol-core/logs` altındaki saf modüllerde,
 * durum `useLogAnalyzer` içinde. Burası yalnız yerleşim ve bağlantıdır.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';

import { LogFilterPanel } from './components/LogFilterPanel';
import { LogRecordDetail } from './components/LogRecordDetail';
import { LogRecordTable } from './components/LogRecordTable';
import { LogSourcePanel } from './components/LogSourcePanel';
import { LogSummaryPanel } from './components/LogSummaryPanel';
import { useLogAnalyzer } from './useLogAnalyzer';

const SECTION_CLASS = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-4';
const SECTION_TITLE_CLASS = 'font-display text-sm font-semibold uppercase tracking-wide text-muted';

export function LogAnalyzerScreen(): ReactNode {
  const { t } = useTranslation();
  const analyzer = useLogAnalyzer();
  const timestampKind = analyzer.state.summary?.timestampKind ?? 'none';
  const hasRecords = analyzer.state.records.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t('logAnalyzer.title')}</h1>
        <p className="max-w-3xl text-sm text-muted">{t('logAnalyzer.intro')}</p>
        <p className="max-w-3xl text-xs text-muted">{t('logAnalyzer.privacy')}</p>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{t('logAnalyzer.section.source')}</h2>
        <LogSourcePanel
          state={analyzer.state}
          formatOverride={analyzer.formatOverride}
          onFileSelected={(file) => {
            void analyzer.loadFile(file);
          }}
          onFormatOverrideChange={analyzer.setFormatOverride}
          onReset={analyzer.reset}
        />
      </section>

      {hasRecords ? (
        <>
          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('logAnalyzer.section.filter')}</h2>
            <LogFilterPanel
              filter={analyzer.filter}
              sourceStatistics={analyzer.sourceStatistics}
              shownCount={analyzer.filteredRecords.length}
              totalCount={analyzer.state.records.length}
              onFilterChange={analyzer.setFilter}
              onExport={analyzer.exportFilteredCsv}
            />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('logAnalyzer.section.summary')}</h2>
            <LogSummaryPanel
              statistics={analyzer.statistics}
              timeline={analyzer.timeline}
              timestampKind={timestampKind}
            />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('logAnalyzer.section.records')}</h2>
            <LogRecordTable
              records={analyzer.filteredRecords}
              timestampKind={timestampKind}
              selectedIndex={analyzer.selectedIndex}
              onSelect={analyzer.selectRecord}
            />
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{t('logAnalyzer.section.detail')}</h2>
            <LogRecordDetail record={analyzer.selectedRecord} records={analyzer.filteredRecords} />
          </section>
        </>
      ) : null}
    </div>
  );
}
