/**
 * Custom Protocol Studio alt paneli — spec §9.7'nin sekiz çıktısı tek sekmeli
 * yüzeyde: Çözümleme · Doğrulama · JSON şeması · C yapısı · C ayrıştırıcı ·
 * Python ayrıştırıcı · TypeScript ayrıştırıcı · Markdown doküman.
 *
 * Son altısı `artifacts` prop'undan gelir; bu bileşen KOD ÜRETMEZ, çözümleme
 * YAPMAZ ve ÜRETİLEN KODU ÇALIŞTIRMAZ. Kod yalnız metindir: kopyalanır ya da
 * indirilir (spec §41 — `eval` ve dinamik kod çalıştırma yasak). Söz dizimi
 * vurgusu da yoktur; bunun için kütüphane eklemek panelin işi değil.
 *
 * Çözümleme sekmesi spec §50'nin sonuç ekranı sekizlisini karşılar: nihai
 * sonuç, ham değer, fiziksel değer, kullanılan formül, ara hesaplamalar,
 * birimler, doğrulama durumu, hata ve uyarılar. Hesap adımlarının METNİ
 * {@link describeFieldComputation} ile kurulur — sayı üretilmez, `ParsedField`
 * zaten `rawValue`/`physicalValue` taşır (CLAUDE.md: protokol hesabı bileşene
 * yazılmaz).
 */

import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { CopyButton } from '@/components/forms';
import { downloadTextFile } from '@/utils/downloadTextFile';
import type { TranslationKey } from '@/translations';
import type {
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolErrorCode,
  SchemaIssue,
} from '@/protocol-core';
import type { GeneratedArtifact, GeneratedArtifactId } from '@/protocol-core/codegen';
import type { DraftIssue } from '../schemaDraft';

export interface OutputPanelProps {
  readonly parseResult: ParseResult | null;
  readonly draftIssues: readonly DraftIssue[];
  readonly schemaIssues: readonly SchemaIssue[];
  readonly artifacts: readonly GeneratedArtifact[];
  readonly schemaName: string;
}

/** Sabit iki sekme + artefakt kimlikleri. */
export type OutputTabId = 'parsed' | 'validation' | GeneratedArtifactId;

interface OutputTab {
  readonly id: OutputTabId;
  readonly labelKey: TranslationKey;
}

/**
 * Sekme başlıkları artefakt kimliğinden SABİT tabloyla türetilir. Anahtarı
 * `` `studio.output.tab.${id}` `` gibi şablonla kurmak, sözlükte olmayan bir
 * anahtarı derlemeye yakalatmazdı.
 */
const ARTIFACT_TAB_LABEL_KEYS: Record<GeneratedArtifactId, TranslationKey> = {
  'json-schema': 'studio.output.tab.jsonSchema',
  'c-struct': 'studio.output.tab.cStruct',
  'c-parser': 'studio.output.tab.cParser',
  'python-parser': 'studio.output.tab.pythonParser',
  'typescript-parser': 'studio.output.tab.typeScriptParser',
  'markdown-doc': 'studio.output.tab.markdownDoc',
};

/** Hata KODU çevrilir, `message` çevrilmez: mesaj çözümleyicinin ürettiği veridir. */
const PARSE_ERROR_LABEL_KEYS: Record<ProtocolErrorCode, TranslationKey> = {
  'invalid-hex-input': 'studio.output.parseError.code.invalidHexInput',
  'length-mismatch': 'studio.output.parseError.code.lengthMismatch',
  'checksum-mismatch': 'studio.output.parseError.code.checksumMismatch',
  'crc-mismatch': 'studio.output.parseError.code.crcMismatch',
  'unsupported-function-code': 'studio.output.parseError.code.unsupportedFunctionCode',
  'start-delimiter-not-found': 'studio.output.parseError.code.startDelimiterNotFound',
  'value-out-of-range': 'studio.output.parseError.code.valueOutOfRange',
  'frame-too-long': 'studio.output.parseError.code.frameTooLong',
  'truncated-frame': 'studio.output.parseError.code.truncatedFrame',
  'circular-length-reference': 'studio.output.parseError.code.circularLengthReference',
  'parser-timeout': 'studio.output.parseError.code.parserTimeout',
};

const SEVERITY_TEXT_CLASS: Record<SchemaIssue['severity'], string> = {
  error: 'text-danger',
  warning: 'text-warn',
};

const SEVERITY_LABEL_KEYS: Record<SchemaIssue['severity'], TranslationKey> = {
  error: 'studio.output.validation.severity.error',
  warning: 'studio.output.validation.severity.warning',
};

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';

/**
 * Hesap adımlarında geçen terimler protokol tanımı biçiminin ANAHTAR ADLARIdır
 * (`rawValue`, `physicalValue`, `scale`, `calibrationOffset` — spec §9.2/§9.6),
 * arayüz cümlesi değil. Protokol biçiminin adları veridir ve çeviriye girmez;
 * kullanıcı aynı adları JSON şemasında da görür, çevrilseydi bağ kopardı.
 */
const RAW_BYTES_TERM = 'rawBytes';
const RAW_VALUE_TERM = 'rawValue';
const PHYSICAL_VALUE_TERM = 'physicalValue';
const SCALE_TERM = 'scale';
const CALIBRATION_OFFSET_TERM = 'calibrationOffset';
const SIGNED_TERM = 'signed';
const UNIT_TERM = 'unit';

function formatByte(byte: number): string {
  return byte.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, '0');
}

function formatBytes(bytes: Uint8Array): string {
  return Array.from(bytes, formatByte).join(' ');
}

/**
 * Tamsayının onaltılık gösterimi. Kesirli sayıda (IEEE-754 çözümü) ve metinde
 * `null` döner: 25.75 için "0x19.C" yazmak yanıltıcı olurdu.
 */
function formatHexNumber(value: bigint | number): string | null {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return null;
  }
  const negative = value < 0;
  const magnitude = negative ? -value : value;
  return `${negative ? '-' : ''}0x${magnitude.toString(HEX_RADIX).toUpperCase()}`;
}

/** Tablo hücresi için tek satırlık değer metni; yoksa nötr işaret. */
function formatScalar(value: bigint | number | string | undefined): string {
  if (value === undefined) return EMPTY_GLYPH;
  return typeof value === 'string' ? value : String(value);
}

/** Ham değer sütunu: onaltılık + ondalık birlikte (spec §50 "Ham değer"). */
function formatRawCell(value: bigint | number | string | undefined): string {
  if (value === undefined) return EMPTY_GLYPH;
  if (typeof value === 'string') return value;
  const hex = formatHexNumber(value);
  return hex === null ? String(value) : `${hex} (${String(value)})`;
}

function formatByteRange(field: ParsedField): string {
  const start = field.offset;
  if (field.length <= 1) {
    return `[${String(start)}]`;
  }
  return `[${String(start)}…${String(start + field.length - 1)}]`;
}

/** `bigint` ile `number` karışık gelebilir; ölçek uygulanmadığını böyle anlarız. */
function isSameNumericValue(left: bigint | number, right: bigint | number): boolean {
  if (typeof left === typeof right) {
    return left === right;
  }
  return Number(left) === Number(right);
}

function isNegative(value: bigint | number): boolean {
  return typeof value === 'bigint' ? value < 0n : value < 0;
}

/**
 * Bir alanın ham bayttan fiziksel değere gidiş zincirini ADIM ADIM metne
 * çevirir (spec §50 "Ara hesaplamalar" + "Kullanılan formül").
 *
 * SAF ve hesapsızdır: hiçbir satır yeniden çözümleme yapmaz, yalnız
 * `ParsedField`teki değerleri biçimlendirir. Endianness birleştirmesinin
 * SONUCU `rawValue` satırıdır — baytları burada yeniden birleştirmek, alanın
 * gerçek bayt sırasını bilmediğimiz için (spec §7 sözleşmesi `ParsedField`e
 * endianness/bit geometrisi koymaz) yanlış sayı üretme riski taşırdı.
 * Aynı sebeple maske/kaydırma ayrı satır olarak yazılamaz; maskelenmiş sonuç
 * zaten `rawValue`dur. İşaret genişletmesi ise değerin işaretinden okunur.
 */
export function describeFieldComputation(field: ParsedField): readonly string[] {
  const steps: string[] = [];

  steps.push(
    `${RAW_BYTES_TERM}${formatByteRange(field)} = ${
      field.rawBytes.length === 0 ? EMPTY_GLYPH : formatBytes(field.rawBytes)
    }`,
  );

  const raw = field.rawValue;
  if (raw !== undefined) {
    if (typeof raw === 'string') {
      steps.push(`${RAW_VALUE_TERM} = "${raw}"`);
    } else {
      if (isNegative(raw)) {
        steps.push(`${SIGNED_TERM} = true`);
      }
      const hex = formatHexNumber(raw);
      steps.push(
        hex === null
          ? `${RAW_VALUE_TERM} = ${String(raw)}`
          : `${RAW_VALUE_TERM} = ${hex} = ${String(raw)}`,
      );
    }
  }

  const unitSuffix = field.unit === undefined || field.unit === '' ? '' : ` ${field.unit}`;
  const physical = field.physicalValue;
  if (physical !== undefined) {
    if (typeof physical === 'string') {
      steps.push(`${PHYSICAL_VALUE_TERM} = "${physical}"${unitSuffix}`);
    } else if (raw !== undefined && typeof raw !== 'string' && isSameNumericValue(raw, physical)) {
      // Ölçek/kalibrasyon yok: formülü yazmak "×1 +0" gürültüsü olurdu.
      steps.push(`${PHYSICAL_VALUE_TERM} = ${RAW_VALUE_TERM} = ${String(physical)}${unitSuffix}`);
    } else {
      steps.push(
        `${PHYSICAL_VALUE_TERM} = ${RAW_VALUE_TERM} × ${SCALE_TERM} + ${CALIBRATION_OFFSET_TERM} = ${String(physical)}${unitSuffix}`,
      );
    }
  } else if (unitSuffix !== '') {
    steps.push(`${UNIT_TERM} = "${String(field.unit)}"`);
  }

  return steps;
}

function tabButtonClass(active: boolean): string {
  const base =
    'shrink-0 rounded-token-sm border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  return active
    ? `${base} border-accent bg-accent text-on-accent`
    : `${base} border-line bg-raised text-text hover:bg-surface`;
}

function actionButtonClass(): string {
  return 'shrink-0 rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
}

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';

function SummaryItem({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}

function FieldRows({ field }: { field: ParsedField }): ReactElement {
  const { t } = useTranslation();
  const steps = describeFieldComputation(field);

  return (
    <>
      <tr data-testid="output-field-row" data-field-id={field.id} className="border-b border-line">
        <td className={`${BODY_CELL_CLASS} font-medium`}>{field.name}</td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{String(field.offset)}</td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="output-field-raw">
          {formatRawCell(field.rawValue)}
        </td>
        <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="output-field-physical">
          {formatScalar(field.physicalValue)}
        </td>
        <td className={BODY_CELL_CLASS}>{field.unit === undefined ? EMPTY_GLYPH : field.unit}</td>
        <td
          className={field.valid ? `${BODY_CELL_CLASS} text-accent` : `${BODY_CELL_CLASS} text-danger`}
          data-testid="output-field-validity"
          data-valid={String(field.valid)}
        >
          {t(field.valid ? 'studio.output.parsed.status.valid' : 'studio.output.parsed.status.invalid')}
        </td>
      </tr>
      <tr className="border-b border-line">
        <td colSpan={6} className="px-2 pb-2">
          <details data-testid="output-field-computation" data-field-id={field.id}>
            <summary className="cursor-pointer text-xs text-muted hover:text-accent">
              {t('studio.output.parsed.computation')}
            </summary>
            <ol className="mt-1 flex flex-col gap-0.5 font-mono text-xs text-muted">
              {steps.map((step) => (
                <li key={step} data-testid="output-computation-step">
                  {step}
                </li>
              ))}
            </ol>
            {field.warnings.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-warn">
                {field.warnings.map((warning) => (
                  <li key={warning} data-testid="output-field-warning">
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        </td>
      </tr>
    </>
  );
}

function ParsedFrameView({ frame, consumedBytes, schemaName }: {
  frame: ParsedFrame;
  consumedBytes: number;
  schemaName: string;
}): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <dl
        data-testid="output-summary"
        className="grid grid-cols-2 gap-3 rounded-token border border-line bg-raised p-3 sm:grid-cols-4"
      >
        <SummaryItem label={t('studio.output.parsed.summary.schema')} value={schemaName} />
        <SummaryItem
          label={t('studio.output.parsed.summary.status')}
          value={
            <span
              data-testid="output-frame-status"
              data-valid={String(frame.valid)}
              className={frame.valid ? 'text-accent' : 'text-danger'}
            >
              {t(frame.valid ? 'studio.output.parsed.status.valid' : 'studio.output.parsed.status.invalid')}
            </span>
          }
        />
        <SummaryItem
          label={t('studio.output.parsed.summary.fieldCount')}
          value={<span className="tabular">{String(frame.fields.length)}</span>}
        />
        <SummaryItem
          label={t('studio.output.parsed.summary.consumedBytes')}
          value={<span className="tabular">{String(consumedBytes)}</span>}
        />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse" aria-label={t('studio.output.parsed.tableLabel')}>
          <thead>
            <tr>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.field')}</th>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.offset')}</th>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.raw')}</th>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.physical')}</th>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.unit')}</th>
              <th className={HEADER_CELL_CLASS}>{t('studio.output.parsed.column.validity')}</th>
            </tr>
          </thead>
          <tbody>
            {frame.fields.map((field) => (
              <FieldRows key={field.id} field={field} />
            ))}
          </tbody>
        </table>
      </div>

      {frame.errors.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('studio.output.parsed.errors')}
          </h3>
          <ul className="flex flex-col gap-1">
            {frame.errors.map((error, index) => (
              <li
                key={`${error.code}-${String(index)}`}
                data-testid="output-frame-error"
                className="rounded-token-sm bg-danger-soft px-2 py-1 text-sm text-danger-strong"
              >
                <span className="font-medium">{t(PARSE_ERROR_LABEL_KEYS[error.code])}</span>{' '}
                <span className="font-mono text-xs">{error.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {frame.warnings.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('studio.output.parsed.warnings')}
          </h3>
          <ul className="flex flex-col gap-1">
            {frame.warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${String(index)}`}
                data-testid="output-frame-warning"
                className="rounded-token-sm bg-warn-soft px-2 py-1 text-sm text-warn"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ParsedPanel({ parseResult, schemaName }: {
  parseResult: ParseResult | null;
  schemaName: string;
}): ReactElement {
  const { t } = useTranslation();

  if (parseResult === null) {
    return (
      <p data-testid="output-parsed-empty" className="text-sm text-muted">
        {t('studio.output.parsed.empty')}
      </p>
    );
  }

  if (!parseResult.success) {
    const { error, recoverable, consumedBytes } = parseResult;
    return (
      <div
        role="alert"
        data-testid="output-parse-error"
        data-error-code={error.code}
        data-recoverable={String(recoverable)}
        className="flex flex-col gap-2 rounded-token border border-line bg-danger-soft p-3"
      >
        <p className="text-sm font-semibold text-danger-strong">
          {t('studio.output.parseError.title')}
        </p>
        <p className="text-sm text-danger">{t(PARSE_ERROR_LABEL_KEYS[error.code])}</p>
        <p className="font-mono text-xs text-text">{error.message}</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {error.offset === undefined ? null : (
            <SummaryItem
              label={t('studio.output.parseError.offset')}
              value={<span className="tabular font-mono">{String(error.offset)}</span>}
            />
          )}
          <SummaryItem
            label={t('studio.output.parsed.summary.consumedBytes')}
            value={<span className="tabular font-mono">{String(consumedBytes)}</span>}
          />
        </dl>
        <p className={recoverable ? 'text-xs text-warn' : 'text-xs text-danger'}>
          {t(
            recoverable
              ? 'studio.output.parseError.recoverable'
              : 'studio.output.parseError.unrecoverable',
          )}
        </p>
      </div>
    );
  }

  return (
    <ParsedFrameView
      frame={parseResult.frame}
      consumedBytes={parseResult.consumedBytes}
      schemaName={schemaName}
    />
  );
}

function ValidationPanel({ draftIssues, schemaIssues }: {
  draftIssues: readonly DraftIssue[];
  schemaIssues: readonly SchemaIssue[];
}): ReactElement {
  const { t } = useTranslation();

  if (draftIssues.length === 0 && schemaIssues.length === 0) {
    return (
      <p data-testid="output-validation-empty" className="text-sm text-muted">
        {t('studio.output.validation.empty')}
      </p>
    );
  }

  return (
    <ul
      className="flex flex-col gap-2"
      aria-label={t('studio.output.validation.listLabel')}
    >
      {draftIssues.map((issue, index) => (
        <li
          key={`draft-${String(index)}-${issue.field}`}
          data-testid="output-issue"
          data-source="draft"
          data-severity="error"
          className="flex flex-col gap-0.5 rounded-token-sm border border-line bg-raised px-2 py-1.5"
        >
          <span className="text-xs uppercase tracking-wide text-muted">
            {t('studio.output.validation.source.draft')}
          </span>
          {/* Taslak sorunları HER ZAMAN hatadır: bir tanesi bile varsa şema üretilmez. */}
          <span className="text-sm text-danger">
            {issue.params === undefined ? t(issue.messageKey) : t(issue.messageKey, issue.params)}
          </span>
          <span className="font-mono text-xs text-muted">{issue.field}</span>
        </li>
      ))}
      {schemaIssues.map((issue, index) => (
        <li
          key={`schema-${String(index)}-${issue.code}`}
          data-testid="output-issue"
          data-source="schema"
          data-severity={issue.severity}
          className="flex flex-col gap-0.5 rounded-token-sm border border-line bg-raised px-2 py-1.5"
        >
          <span className="text-xs uppercase tracking-wide text-muted">
            {t('studio.output.validation.source.schema')} · {t(SEVERITY_LABEL_KEYS[issue.severity])}
          </span>
          <span className={`text-sm ${SEVERITY_TEXT_CLASS[issue.severity]}`}>{issue.message}</span>
          <span className="font-mono text-xs text-muted">
            {issue.fieldId === undefined ? issue.code : `${issue.code} · ${issue.fieldId}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ArtifactPanel({ artifact }: { artifact: GeneratedArtifact }): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted" data-testid="output-artifact-file">
          {artifact.fileName}
        </span>
        <span className="grow" />
        <CopyButton value={artifact.code} />
        <button
          type="button"
          className={actionButtonClass()}
          data-testid="output-artifact-download"
          onClick={() => {
            // Dosya tamamen istemcide üretilir; hiçbir bayt sunucuya gitmez (spec §41).
            downloadTextFile(artifact.fileName, artifact.code);
          }}
        >
          {t('studio.output.artifact.download')}
        </button>
      </div>
      <p className="text-xs text-muted">{t('studio.output.artifact.notExecuted')}</p>
      {/* Üretilen kod SALT METİNdir: çalıştırılmaz, vurgulanmaz. */}
      <pre
        data-testid="output-artifact-code"
        data-artifact-id={artifact.id}
        className="max-h-96 overflow-x-auto overflow-y-auto rounded-token border border-line bg-raised p-3 font-mono text-sm text-text"
      >
        {artifact.code}
      </pre>
    </div>
  );
}

export function OutputPanel(props: OutputPanelProps): ReactNode {
  const { t } = useTranslation();
  const [requestedTabId, setRequestedTabId] = useState<OutputTabId>('parsed');
  const tabRefs = useRef(new Map<OutputTabId, HTMLButtonElement>());

  const tabs = useMemo<readonly OutputTab[]>(
    () => [
      { id: 'parsed', labelKey: 'studio.output.tab.parsed' },
      { id: 'validation', labelKey: 'studio.output.tab.validation' },
      ...props.artifacts.map((artifact) => ({
        id: artifact.id,
        labelKey: ARTIFACT_TAB_LABEL_KEYS[artifact.id],
      })),
    ],
    [props.artifacts],
  );

  // Seçim TÜRETİLİR, `useEffect` ile düzeltilmez: şema bozulunca artefakt
  // sekmeleri kaybolur ve seçili sekme ortadan kalkar; efektle düzeltmek bir
  // kare boyunca boş panel çizerdi.
  const activeTabId = tabs.some((tab) => tab.id === requestedTabId) ? requestedTabId : 'parsed';
  const activeArtifact = props.artifacts.find((artifact) => artifact.id === activeTabId);

  const focusTab = (tab: OutputTab): void => {
    setRequestedTabId(tab.id);
    tabRefs.current.get(tab.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (currentIndex < 0) return;

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        // Baştan sona sarma: `(i - 1 + n) % n`, negatif kalan tuzağına düşmemek için.
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab === undefined) return;
    event.preventDefault();
    focusTab(nextTab);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label={t('studio.output.tablistLabel')}
        className="flex flex-wrap gap-2"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`output-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`output-panel-${tab.id}`}
              // Gezinme ok tuşlarıyla: sekme şeridi TEK sekme durağıdır (WAI-ARIA
              // "roving tabindex"), yoksa sekiz sekme sekiz Tab basışı ederdi.
              tabIndex={selected ? 0 : -1}
              data-testid="output-tab"
              data-tab-id={tab.id}
              className={tabButtonClass(selected)}
              ref={(node) => {
                if (node === null) {
                  tabRefs.current.delete(tab.id);
                } else {
                  tabRefs.current.set(tab.id, node);
                }
              }}
              onClick={() => setRequestedTabId(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {props.artifacts.length === 0 ? (
        <p
          role="status"
          data-testid="output-artifacts-missing"
          className="rounded-token border border-line bg-warn-soft px-3 py-2 text-sm text-warn"
        >
          {t('studio.output.artifact.missing')}
        </p>
      ) : null}

      <div
        role="tabpanel"
        id={`output-panel-${activeTabId}`}
        aria-labelledby={`output-tab-${activeTabId}`}
        data-testid="output-tabpanel"
        data-tab-id={activeTabId}
        tabIndex={0}
        className="rounded-token border border-line bg-surface p-3"
      >
        {activeTabId === 'parsed' ? (
          <ParsedPanel parseResult={props.parseResult} schemaName={props.schemaName} />
        ) : null}
        {activeTabId === 'validation' ? (
          <ValidationPanel draftIssues={props.draftIssues} schemaIssues={props.schemaIssues} />
        ) : null}
        {activeArtifact === undefined ? null : <ArtifactPanel artifact={activeArtifact} />}
      </div>
    </div>
  );
}
