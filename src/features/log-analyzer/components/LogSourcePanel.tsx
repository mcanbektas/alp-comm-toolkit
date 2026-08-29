/**
 * Kaynak dosya paneli: dosya seçimi, biçim ezme ve ayrıştırma künyesi.
 * Dosya `input type="file"` ile alınır ve `arrayBuffer()` ile okunur —
 * hiçbir bayt ağa çıkmaz (spec §41).
 */

import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { LogParseSummary, LogSourceFormat, LogWarning, LogWarningCode } from '@/protocol-core/logs/types';
import type { TranslationKey } from '@/translations';

import { formatByteSize, formatCount, formatDuration } from '../formatLog';
import type { LogAnalyzerState } from '../useLogAnalyzer';

const FORMAT_LABEL_KEYS: Record<LogSourceFormat, TranslationKey> = {
  pcap: 'logAnalyzer.format.pcap',
  candump: 'logAnalyzer.format.candump',
  'vector-asc': 'logAnalyzer.format.vectorAsc',
  delimited: 'logAnalyzer.format.delimited',
  json: 'logAnalyzer.format.json',
  'hex-text': 'logAnalyzer.format.hexText',
  binary: 'logAnalyzer.format.binary',
};

const WARNING_LABEL_KEYS: Record<LogWarningCode, TranslationKey> = {
  'unparsed-line': 'logAnalyzer.warning.unparsedLine',
  'bad-hex': 'logAnalyzer.warning.badHex',
  'bad-timestamp': 'logAnalyzer.warning.badTimestamp',
  'truncated-packet': 'logAnalyzer.warning.truncatedPacket',
  'record-limit': 'logAnalyzer.warning.recordLimit',
  'missing-column': 'logAnalyzer.warning.missingColumn',
};

const FORMAT_ORDER: readonly LogSourceFormat[] = [
  'pcap',
  'candump',
  'vector-asc',
  'delimited',
  'json',
  'hex-text',
  'binary',
];

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent';

export interface LogSourcePanelProps {
  readonly state: LogAnalyzerState;
  readonly formatOverride: LogSourceFormat | undefined;
  readonly onFileSelected: (file: File) => void;
  readonly onFormatOverrideChange: (format: LogSourceFormat | undefined) => void;
  readonly onReset: () => void;
}

function SummaryLine({ summary }: { readonly summary: LogParseSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <>
      <dt className="text-muted">{t('logAnalyzer.source.detected')}</dt>
      <dd className="text-text" data-testid="log-detected-format">
        {t(FORMAT_LABEL_KEYS[summary.format])}
        {summary.detail === undefined ? '' : ` · ${summary.detail}`}
      </dd>
    </>
  );
}

function WarningList({ warnings }: { readonly warnings: readonly LogWarning[] }): ReactNode {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('logAnalyzer.warning.title')}</h3>
      <ul className="flex flex-col gap-1 text-xs text-muted">
        {warnings.map((warning) => (
          <li key={warning.code} data-testid={`log-warning-${warning.code}`}>
            <span className="text-danger">{t(WARNING_LABEL_KEYS[warning.code])}</span>
            {' · '}
            {t('logAnalyzer.warning.count', { count: warning.count })}
            {warning.line === undefined ? '' : ` · ${warning.line}`}
            <span className="block text-muted">{warning.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LogSourcePanel({
  state,
  formatOverride,
  onFileSelected,
  onFormatOverrideChange,
  onReset,
}: LogSourcePanelProps): ReactNode {
  const { t } = useTranslation();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) onFileSelected(file);
  };

  const handleFormatChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.target.value;
    onFormatOverrideChange(value === '' ? undefined : (value as LogSourceFormat));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-file">
          {t('logAnalyzer.source.file')}
          <input
            id="log-file"
            data-testid="log-file"
            type="file"
            accept=".pcap,.cap,.log,.txt,.csv,.tsv,.asc,.json,.ndjson,.bin"
            onChange={handleFileChange}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="log-format">
          {t('logAnalyzer.source.formatLabel')}
          <select
            id="log-format"
            data-testid="log-format"
            value={formatOverride ?? ''}
            onChange={handleFormatChange}
            className={FIELD_CLASS}
          >
            <option value="">{t('logAnalyzer.source.formatAuto')}</option>
            {FORMAT_ORDER.map((format) => (
              <option key={format} value={format}>
                {t(FORMAT_LABEL_KEYS[format])}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={BUTTON_CLASS} onClick={onReset}>
          {t('logAnalyzer.source.reset')}
        </button>
      </div>

      <p className="text-xs text-muted">{t('logAnalyzer.source.hint')}</p>

      {state.status === 'idle' ? <p className="text-sm text-muted">{t('logAnalyzer.source.empty')}</p> : null}
      {state.status === 'parsing' ? (
        <p className="text-sm text-muted" role="status">
          {t('logAnalyzer.source.parsing')}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="text-sm text-danger" role="alert" data-testid="log-error">
          {state.errorMessage}
        </p>
      ) : null}

      {state.status === 'ready' && state.summary !== undefined ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <SummaryLine summary={state.summary} />
            <dt className="text-muted">{t('logAnalyzer.source.size')}</dt>
            <dd className="text-text tabular">{formatByteSize(state.fileSizeBytes)}</dd>
            <dt className="text-muted">{t('logAnalyzer.source.recordCount')}</dt>
            <dd className="text-text tabular" data-testid="log-record-count">
              {formatCount(state.summary.recordCount)}
            </dd>
            <dt className="text-muted">{t('logAnalyzer.source.skipped')}</dt>
            <dd className="text-text tabular">{formatCount(state.summary.skippedLines)}</dd>
            <dt className="text-muted">{t('logAnalyzer.source.elapsed')}</dt>
            <dd className="text-text tabular">{formatDuration(state.elapsedMs)}</dd>
          </dl>
          {state.summary.limitReached ? (
            <p className="text-xs text-danger">{t('logAnalyzer.source.limitReached')}</p>
          ) : null}
          <WarningList warnings={state.warnings} />
        </>
      ) : null}
    </div>
  );
}
