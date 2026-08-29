/**
 * `definitions` sekmesinin A2L (ASAM MCD-2 MC) paneli.
 *
 * Bu panel katalogda ADIYLA beklenen bir boşluğu kapatıyor: `automotive.ts`in
 * XCP kaydı "Ham DTO baytları A2L olmadan anlamsızdır" diyor ve A2L Import'u
 * o dalganın dışında bırakmıştı. Ölçüm adı, ECU adresi, veri tipi ve dönüşüm
 * formülü artık burada.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): dosyayı `parseA2l` çözer,
 * değeri `decodeA2lMeasurement` okur. Dışa aktarma YOK — bir `a2lWriter`
 * yazılmadı, `EdsPanel` ile aynı sınır: round-trip bu işin kapsamında değil ve
 * eksik bir yazıcı, aracın ürettiği dosyayı gerçek bir A2L sanma riski taşır.
 *
 * Ekran BOŞ AÇILMAZ (spec §50): örnek A2L ve ölçüm başına örnek baytlar yüklü
 * gelir. Kullanıcı verisi YERELDE KALIR (spec §41).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { decodeA2lMeasurement } from '@/protocol-core/definitions/a2l/a2lDecoder';
import { SAMPLE_A2L_BYTES, SAMPLE_A2L_TEXT } from '@/protocol-core/definitions/a2l/a2lFixture';
import { findCompuMethod, findVerbalTable, parseA2l } from '@/protocol-core/definitions/a2l/a2lParser';
import type {
  A2lDatabase,
  A2lMeasurement,
  A2lParseIssue,
} from '@/protocol-core/definitions/a2l/a2lTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** `A2lParseIssue.messageKey` sözlükte varsa çevrilir — `EdsPanel`in aynı gerekçesi. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

function formatAddress(address: number | undefined): string {
  return address === undefined ? EMPTY_GLYPH : `0x${address.toString(HEX_RADIX).toUpperCase()}`;
}

/** Örnek dosya yüklüyken ölçümün fixture'daki baytları; yoksa boş. */
function sampleBytesFor(measurement: A2lMeasurement | null, sample: boolean): string {
  if (measurement === null || !sample) return '';
  const bytes = SAMPLE_A2L_BYTES[measurement.name];
  return bytes === undefined ? '' : (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

type A2lState =
  | { readonly status: 'ready'; readonly database: A2lDatabase; readonly issues: readonly A2lParseIssue[]; readonly sample: boolean }
  | { readonly status: 'failed'; readonly issues: readonly A2lParseIssue[] };

function initialState(): A2lState {
  const result = parseA2l(SAMPLE_A2L_TEXT);
  return result.success
    ? { status: 'ready', database: result.database, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly A2lParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="a2l-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="a2l-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.a2l.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : <span className="font-mono text-muted"> {issue.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function MeasurementTable({ database }: { database: A2lDatabase }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="a2l-measurement-table"
        className="w-full min-w-[48rem] border-collapse"
        aria-label={t('definition.a2l.table.measurements')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.a2l.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.a2l.column.dataType')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.a2l.column.address')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.a2l.column.conversion')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.a2l.column.limits')}</th>
          </tr>
        </thead>
        <tbody>
          {database.measurements.map((measurement) => {
            const method = findCompuMethod(database, measurement.conversion);
            return (
              <tr
                key={measurement.name}
                data-testid="a2l-measurement-row"
                data-measurement={measurement.name}
                className="border-b border-line/60 last:border-b-0"
              >
                <td className={BODY_CELL_CLASS}>
                  {/* Ölçüm adı ve açıklaması VERİDİR, çevrilmez. */}
                  {measurement.name}
                  {measurement.longIdentifier === '' ? null : (
                    <span className="block text-xs text-muted">{measurement.longIdentifier}</span>
                  )}
                </td>
                <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>{measurement.dataType}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                  {formatAddress(measurement.ecuAddress)}
                </td>
                <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>
                  {measurement.conversion === '' ? EMPTY_GLYPH : measurement.conversion}
                  {method === null ? null : (
                    <span className="block text-muted">{method.conversionType}</span>
                  )}
                </td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs text-muted`}>
                  {measurement.lowerLimit} … {measurement.upperLimit}
                  {measurement.unit === undefined ? '' : ` ${measurement.unit}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function A2lPanel(): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<A2lState>(initialState);
  const [selectedName, setSelectedName] = useState('');
  const [sampleHex, setSampleHex] = useState('');
  const [importErrorKey, setImportErrorKey] = useState<
    'definition.a2l.error.readFailed' | 'definition.a2l.error.parseFailed' | null
  >(null);

  const database = state.status === 'ready' ? state.database : null;

  const selectedMeasurement = useMemo(() => {
    if (database === null) return null;
    return (
      database.measurements.find((measurement) => measurement.name === selectedName) ??
      database.measurements[0] ??
      null
    );
  }, [database, selectedName]);

  /** Elle yazılmış bayt kullanıcının verisidir; boşken örnek baytlar gösterilir. */
  const effectiveHex =
    sampleHex === ''
      ? sampleBytesFor(selectedMeasurement, state.status === 'ready' && state.sample)
      : sampleHex;

  const decoded = useMemo(() => {
    if (database === null || selectedMeasurement === null || effectiveHex.trim() === '') return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(effectiveHex);
    } catch {
      return { invalidHex: true } as const;
    }
    const method = findCompuMethod(database, selectedMeasurement.conversion);
    const table = findVerbalTable(database, method?.compuTabRef);
    return {
      invalidHex: false,
      result: decodeA2lMeasurement(
        selectedMeasurement,
        bytes,
        database.defaultByteOrder,
        method,
        table,
      ),
    } as const;
  }, [database, selectedMeasurement, effectiveHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.a2l.error.readFailed');
      return;
    }
    const result = parseA2l(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ dosyayı silmez.
      setImportErrorKey('definition.a2l.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', database: result.database, issues: result.issues, sample: false });
    setSelectedName('');
    setSampleHex('');
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
    <div className="flex flex-col gap-4" data-testid="a2l-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="a2l-import" className="text-xs font-medium text-muted">
          {t('definition.a2l.action.import')}
        </label>
        <input
          id="a2l-import"
          data-testid="a2l-import"
          type="file"
          accept=".a2l,.txt,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="a2l-import-error" className="text-sm text-danger">
          {t(importErrorKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="a2l-sample-notice">
          {t('definition.a2l.sampleNotice')}
        </p>
      ) : null}

      {database === null ? (
        <p
          role="alert"
          data-testid="a2l-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.a2l.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="a2l-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.a2l.project')}
              </dt>
              {/* Proje ve modül adı VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="a2l-project">
                {database.project === '' ? EMPTY_GLYPH : database.project}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.a2l.module')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="a2l-module">
                {database.module === '' ? EMPTY_GLYPH : database.module}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.a2l.byteOrder')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="a2l-byte-order">
                {database.defaultByteOrder}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.a2l.measurementCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="a2l-measurement-count">
                {database.measurements.length}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.a2l.characteristicCount')}
              </dt>
              <dd
                className="tabular font-mono text-sm text-text"
                data-testid="a2l-characteristic-count"
              >
                {database.characteristics.length}
              </dd>
            </div>
          </dl>

          <MeasurementTable database={database} />

          {selectedMeasurement === null ? null : (
            <>
              <SelectField
                id="a2l-measurement"
                label={t('definition.a2l.measurement.label')}
                value={selectedMeasurement.name}
                onChange={(value) => {
                  setSelectedName(value);
                  setSampleHex('');
                }}
                options={database.measurements.map((measurement) => ({
                  value: measurement.name,
                  // Ad ve açıklama VERİDİR, çevrilmez.
                  label:
                    measurement.longIdentifier === ''
                      ? measurement.name
                      : `${measurement.name} — ${measurement.longIdentifier}`,
                }))}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="a2l-hex" className="text-xs font-medium text-muted">
                  {t('definition.a2l.decodeHex.label')}
                </label>
                <textarea
                  id="a2l-hex"
                  data-testid="a2l-hex"
                  rows={2}
                  spellCheck={false}
                  value={effectiveHex}
                  aria-invalid={decoded?.invalidHex === true}
                  className={`w-full rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    decoded?.invalidHex === true ? 'border-danger' : 'border-line'
                  }`}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                    setSampleHex(event.target.value);
                  }}
                />
                {decoded?.invalidHex === true ? (
                  <p role="alert" data-testid="a2l-hex-error" className="text-xs text-danger">
                    {t('decode.error.invalidHex')}
                  </p>
                ) : null}
              </div>

              {decoded !== null && !decoded.invalidHex ? (
                decoded.result.success ? (
                  <div className="flex flex-col gap-2" data-testid="a2l-decoded">
                    <dl className="flex flex-wrap gap-4">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs uppercase tracking-wide text-muted">
                          {t('decode.column.raw')}
                        </dt>
                        <dd className="tabular font-mono text-sm text-text" data-testid="a2l-raw">
                          {String(decoded.result.rawValue)}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs uppercase tracking-wide text-muted">
                          {t('definition.a2l.column.physical')}
                        </dt>
                        <dd className="tabular font-mono text-sm text-text" data-testid="a2l-physical">
                          {String(decoded.result.physicalValue)}
                          {decoded.result.unit === '' ? '' : ` ${decoded.result.unit}`}
                        </dd>
                      </div>
                    </dl>

                    {/*
                      Dönüşüm uygulanamadıysa SUSMAK yanıltıcı olurdu: ham değer
                      fiziksel değer sanılırdı. Neden burada, değerin yanında
                      duruyor.
                    */}
                    {decoded.result.conversionNoteKey === undefined ? null : (
                      <p
                        data-testid="a2l-conversion-note"
                        className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
                      >
                        {translateIssue(decoded.result.conversionNoteKey, t)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    role="alert"
                    data-testid="a2l-decode-error"
                    className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
                  >
                    {t('definition.a2l.decode.tooShort')}{' '}
                    <span className="tabular font-mono">{decoded.result.requiredBytes}</span>
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
