/**
 * `definitions` sekmesinin DSDL paneli (Cyphal / DroneCAN).
 *
 * Katalog kaydı (`aerospace-uav.ts`) şunu yazmıştı: "DSDL alanları
 * bit-packed'dir ve byte hizası garanti değildir." Panel tam olarak bunu
 * gösteriyor: alanlar bit konumlarıyla listeleniyor ve çözüm bit düzeyinde
 * yapılıyor — bayt hizasına oturmayan `uint4` çiftleri de dahil.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): dosyayı `parseDsdl` çözer,
 * değeri `decodeDsdlField` okur.
 *
 * ── HER ALAN ÇÖZÜLEMEZ ──────────────────────────────────────────────────────
 * Değişken uzunluklu bir dizi ya da bileşik tip geçildikten sonra alanların
 * konumu telin İÇERİĞİNE bağlanır; ayrıştırıcı orada konum vermiyor ve panel
 * o alanlarda hex kutusu açmıyor, nedenini yazıyor.
 *
 * Ekran BOŞ AÇILMAZ (spec §50). Kullanıcı verisi YERELDE KALIR (spec §41).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { decodeDsdlField, isDecodableField } from '@/protocol-core/definitions/dsdl/dsdlDecoder';
import { SAMPLE_DSDL_BYTES, SAMPLE_DSDL_TEXT } from '@/protocol-core/definitions/dsdl/dsdlFixture';
import { lengthPrefixBits, parseDsdl } from '@/protocol-core/definitions/dsdl/dsdlParser';
import type {
  DsdlDefinition,
  DsdlField,
  DsdlParseIssue,
  DsdlSection,
  DsdlSectionKind,
} from '@/protocol-core/definitions/dsdl/dsdlTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';
/** `void` dolgusunun adı yoktur; tabloda boş hücre yerine bu görünür. */
const PADDING_GLYPH = '(void)';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const SECTION_LABEL_KEYS: Record<DsdlSectionKind, TranslationKey> = {
  message: 'definition.dsdl.section.message',
  request: 'definition.dsdl.section.request',
  response: 'definition.dsdl.section.response',
};

function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

function spacedHex(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

/** Alan kimliği: aynı ad iki bölümde de geçebilir, bölüm sırası ayırt eder. */
function fieldKey(sectionIndex: number, field: DsdlField, index: number): string {
  return `${String(sectionIndex)}:${String(index)}:${field.name}`;
}

/**
 * Yerleşim hücresi. Değişken dizide alanın kendisi sabit değildir ama uzunluk
 * ÖNEKİ sabittir; onu göstermek, "neden çözülemiyor" sorusunu yanıtlıyor.
 */
function layoutText(field: DsdlField, t: (key: TranslationKey) => string): string {
  if (field.bitOffset !== undefined && field.bitLength !== undefined) {
    return `${String(field.bitOffset)}+${String(field.bitLength)} bit`;
  }
  if (field.array?.mode === 'variable') {
    return `${t('definition.dsdl.lengthPrefix')} ${String(lengthPrefixBits(field.array.capacity))} bit`;
  }
  return EMPTY_GLYPH;
}

type PanelState =
  | { readonly status: 'ready'; readonly definition: DsdlDefinition; readonly issues: readonly DsdlParseIssue[]; readonly sample: boolean }
  | { readonly status: 'failed'; readonly issues: readonly DsdlParseIssue[] };

function initialState(): PanelState {
  const result = parseDsdl(SAMPLE_DSDL_TEXT);
  return result.success
    ? { status: 'ready', definition: result.definition, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly DsdlParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="dsdl-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="dsdl-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.dsdl.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : <span className="font-mono text-muted"> {issue.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function SectionView({ section, sectionIndex }: { section: DsdlSection; sectionIndex: number }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2" data-testid="dsdl-section" data-kind={section.kind}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{t(SECTION_LABEL_KEYS[section.kind])}</h3>
        {section.directives.map((directive) => (
          // Yönerge dosyanın kendi metnidir (`@sealed`), çevrilmez.
          <span
            key={directive}
            data-testid="dsdl-directive"
            className="rounded-token-sm border border-line px-2 py-0.5 font-mono text-xs text-muted"
          >
            {directive}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table
          data-testid="dsdl-field-table"
          className="w-full min-w-[40rem] border-collapse"
          aria-label={t('definition.dsdl.table.fields')}
        >
          <thead>
            <tr>
              <th className={HEADER_CELL_CLASS}>{t('definition.dsdl.column.name')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.dsdl.column.type')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.dsdl.column.layout')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.dsdl.column.comment')}</th>
            </tr>
          </thead>
          <tbody>
            {section.fields.map((field, index) => (
              <tr
                key={fieldKey(sectionIndex, field, index)}
                data-testid="dsdl-field-row"
                data-field={field.name === '' ? 'void' : field.name}
                className="border-b border-line/60 last:border-b-0"
              >
                {/* Ad, tip ve yorum VERİDİR, çevrilmez. */}
                <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>
                  {field.name === '' ? PADDING_GLYPH : field.name}
                </td>
                <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>{field.typeText}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs text-muted`}>
                  {layoutText(field, t)}
                </td>
                <td className={`${BODY_CELL_CLASS} text-xs text-muted`}>{field.comment ?? EMPTY_GLYPH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {section.constants.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2" data-testid="dsdl-constants">
          {section.constants.map((constant) => (
            <li
              key={constant.name}
              data-testid="dsdl-constant"
              className="rounded-token-sm border border-line px-2 py-1 font-mono text-xs text-muted"
            >
              {constant.name} = {constant.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DsdlPanel(): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<PanelState>(initialState);
  const [selectedKey, setSelectedKey] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [importErrorKey, setImportErrorKey] = useState<
    'definition.dsdl.error.readFailed' | 'definition.dsdl.error.parseFailed' | null
  >(null);

  const definition = state.status === 'ready' ? state.definition : null;

  /** Seçilebilir alanlar: bölüm sırası korunarak düzleştirilir. */
  const selectableFields = useMemo(() => {
    if (definition === null) return [];
    return definition.sections.flatMap((section, sectionIndex) =>
      section.fields
        .map((field, index) => ({ key: fieldKey(sectionIndex, field, index), field }))
        .filter((entry) => entry.field.name !== ''),
    );
  }, [definition]);

  const selected = useMemo(() => {
    return (
      selectableFields.find((entry) => entry.key === selectedKey) ??
      selectableFields.find((entry) => isDecodableField(entry.field)) ??
      selectableFields[0] ??
      null
    );
  }, [selectableFields, selectedKey]);

  const decodable = selected !== null && isDecodableField(selected.field);

  const effectiveHex =
    hexInput === '' ? (state.status === 'ready' && state.sample ? spacedHex(SAMPLE_DSDL_BYTES) : '') : hexInput;

  const decoded = useMemo(() => {
    if (selected === null || !decodable || effectiveHex.trim() === '') return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(effectiveHex);
    } catch {
      return { invalidHex: true } as const;
    }
    return { invalidHex: false, result: decodeDsdlField(selected.field, bytes) } as const;
  }, [selected, decodable, effectiveHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.dsdl.error.readFailed');
      return;
    }
    const result = parseDsdl(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ tanımı silmez.
      setImportErrorKey('definition.dsdl.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', definition: result.definition, issues: result.issues, sample: false });
    setSelectedKey('');
    setHexInput('');
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file === undefined) return;
      void handleImport(file);
    },
    [handleImport],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="dsdl-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="dsdl-import" className="text-xs font-medium text-muted">
          {t('definition.dsdl.action.import')}
        </label>
        <input
          id="dsdl-import"
          data-testid="dsdl-import"
          type="file"
          accept=".dsdl,.uavcan,.txt,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="dsdl-import-error" className="text-sm text-danger">
          {t(importErrorKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="dsdl-sample-notice">
          {t('definition.dsdl.sampleNotice')}
        </p>
      ) : null}

      {definition === null ? (
        <p
          role="alert"
          data-testid="dsdl-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.dsdl.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="dsdl-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.dsdl.kind')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="dsdl-kind">
                {t(definition.isService ? 'definition.dsdl.kind.service' : 'definition.dsdl.kind.message')}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.dsdl.fieldCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="dsdl-field-count">
                {definition.sections.reduce((total, section) => total + section.fields.length, 0)}
              </dd>
            </div>
          </dl>

          {definition.sections.map((section, index) => (
            <SectionView key={section.kind} section={section} sectionIndex={index} />
          ))}

          {selected === null ? null : (
            <>
              <SelectField
                id="dsdl-field"
                label={t('definition.dsdl.field.label')}
                value={selected.key}
                onChange={(value) => {
                  setSelectedKey(value);
                  setHexInput('');
                }}
                options={selectableFields.map((entry) => ({
                  value: entry.key,
                  label: `${entry.field.name} (${entry.field.typeText})`,
                }))}
              />

              {decodable ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="dsdl-hex" className="text-xs font-medium text-muted">
                    {t('definition.dsdl.decodeHex.label')}
                  </label>
                  <textarea
                    id="dsdl-hex"
                    data-testid="dsdl-hex"
                    rows={2}
                    spellCheck={false}
                    value={effectiveHex}
                    aria-invalid={decoded?.invalidHex === true}
                    className={`w-full rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      decoded?.invalidHex === true ? 'border-danger' : 'border-line'
                    }`}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                      setHexInput(event.target.value);
                    }}
                  />
                  {decoded?.invalidHex === true ? (
                    <p role="alert" data-testid="dsdl-hex-error" className="text-xs text-danger">
                      {t('decode.error.invalidHex')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted" data-testid="dsdl-no-layout">
                  {t('definition.dsdl.decode.noLayout')}
                </p>
              )}

              {decoded !== null && !decoded.invalidHex ? (
                decoded.result.success ? (
                  <dl className="flex flex-wrap gap-4" data-testid="dsdl-decoded">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {t('decode.column.raw')}
                      </dt>
                      <dd className="tabular font-mono text-sm text-text" data-testid="dsdl-raw">
                        {String(decoded.result.rawValue)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {t('definition.dsdl.column.value')}
                      </dt>
                      <dd className="tabular font-mono text-sm text-text" data-testid="dsdl-value">
                        {decoded.result.displayValue}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p
                    role="alert"
                    data-testid="dsdl-decode-error"
                    className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
                  >
                    {translateIssue(decoded.result.messageKey, t)}{' '}
                    {decoded.result.requiredBytes === undefined ? null : (
                      <span className="tabular font-mono">{decoded.result.requiredBytes}</span>
                    )}
                  </p>
                )
              ) : null}
            </>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
