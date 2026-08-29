/**
 * Analizin girdi paneli: yapıştırılan döküm ya da log dosyası, çerçeveleme
 * seçimi ve bilinen değer serisi.
 *
 * Çerçeveleme alanı yalnız AKIŞ modunda görünür — satır modunda çerçeve sınırı
 * zaten satır sonudur ve orada bir yöntem sormak kullanıcıya var olmayan bir
 * karar yükler.
 */

import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { RE_FRAMING_METHODS } from '../useReverseEngineering';
import type { ReFramingMethod, ReverseEngineeringInput, ReverseEngineeringState } from '../useReverseEngineering';
import type { FrameInputMode } from '../frameInput';
import type { TranslationKey } from '@/translations';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const MODE_LABELS: Record<FrameInputMode, TranslationKey> = {
  lines: 'reverseEngineering.mode.lines',
  stream: 'reverseEngineering.mode.stream',
};

const FRAMING_LABELS: Record<ReFramingMethod, TranslationKey> = {
  'start-byte': 'reverseEngineering.framing.startByte',
  'fixed-length': 'reverseEngineering.framing.fixedLength',
  'line-ending': 'reverseEngineering.framing.lineEnding',
  slip: 'reverseEngineering.framing.slip',
  cobs: 'reverseEngineering.framing.cobs',
  'hdlc-flag': 'reverseEngineering.framing.hdlcFlag',
};

/** Parametre alanı olmayan yöntemler: sınırları protokolün kendisi tanımlar. */
const PARAMETERLESS: ReadonlySet<ReFramingMethod> = new Set<ReFramingMethod>(['slip', 'cobs', 'hdlc-flag']);

export interface AnalysisInputPanelProps {
  readonly input: ReverseEngineeringInput;
  readonly state: ReverseEngineeringState;
  readonly onChange: (patch: Partial<ReverseEngineeringInput>) => void;
  readonly onAnalyze: () => void;
  readonly onCancel: () => void;
  readonly onFileSelected: (file: File) => void;
  readonly onClearFile: () => void;
}

export function AnalysisInputPanel({
  input,
  state,
  onChange,
  onAnalyze,
  onCancel,
  onFileSelected,
  onClearFile,
}: AnalysisInputPanelProps): ReactNode {
  const { t } = useTranslation();
  const fileLoaded = state.fileName !== undefined;
  const analyzing = state.status === 'analyzing';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) onFileSelected(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-mode">
          {t('reverseEngineering.source.mode')}
          <select
            id="re-mode"
            data-testid="re-mode"
            className={FIELD_CLASS}
            value={input.mode}
            onChange={(event) => onChange({ mode: event.target.value as FrameInputMode })}
          >
            {(['lines', 'stream'] as const).map((mode) => (
              <option key={mode} value={mode}>
                {t(MODE_LABELS[mode])}
              </option>
            ))}
          </select>
        </label>

        {input.mode === 'stream' ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-framing">
              {t('reverseEngineering.source.framing')}
              <select
                id="re-framing"
                data-testid="re-framing"
                className={FIELD_CLASS}
                value={input.framingMethod}
                onChange={(event) => onChange({ framingMethod: event.target.value as ReFramingMethod })}
              >
                {RE_FRAMING_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(FRAMING_LABELS[method])}
                  </option>
                ))}
              </select>
            </label>

            {PARAMETERLESS.has(input.framingMethod) ? null : (
              <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-framing-parameter">
                {t('reverseEngineering.source.framingParameter')}
                <input
                  id="re-framing-parameter"
                  data-testid="re-framing-parameter"
                  className={FIELD_CLASS}
                  value={input.framingParameter}
                  onChange={(event) => onChange({ framingParameter: event.target.value })}
                />
              </label>
            )}
          </>
        ) : null}

        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-file">
          {t('reverseEngineering.source.file')}
          <input
            id="re-file"
            data-testid="re-file"
            type="file"
            accept=".pcap,.cap,.log,.txt,.csv,.tsv,.asc,.json,.ndjson,.bin"
            onChange={handleFileChange}
            className={FIELD_CLASS}
          />
        </label>

        {fileLoaded ? (
          <button type="button" className={BUTTON_CLASS} data-testid="re-clear-file" onClick={onClearFile}>
            {t('reverseEngineering.action.clearFile')}
          </button>
        ) : null}
      </div>

      {fileLoaded ? (
        <p className="text-sm text-muted" data-testid="re-file-name">
          {t('reverseEngineering.source.fileLoaded', { name: state.fileName ?? '', count: state.frameCount })}
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-input">
          {t('reverseEngineering.source.text')}
          <textarea
            id="re-input"
            data-testid="re-input"
            rows={8}
            spellCheck={false}
            className={`${FIELD_CLASS} font-mono`}
            value={input.text}
            onChange={(event) => onChange({ text: event.target.value })}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="re-known-values">
        {t('reverseEngineering.source.knownValues')}
        <input
          id="re-known-values"
          data-testid="re-known-values"
          className={FIELD_CLASS}
          placeholder="90, 100, 110"
          value={input.knownValuesText}
          onChange={(event) => onChange({ knownValuesText: event.target.value })}
        />
      </label>
      <p className="text-xs text-muted">{t('reverseEngineering.source.knownValuesHint')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON_CLASS} data-testid="re-analyze" onClick={onAnalyze} disabled={analyzing}>
          {t('reverseEngineering.action.analyze')}
        </button>
        <button type="button" className={BUTTON_CLASS} data-testid="re-cancel" onClick={onCancel} disabled={!analyzing}>
          {t('reverseEngineering.action.cancel')}
        </button>
      </div>
    </div>
  );
}
