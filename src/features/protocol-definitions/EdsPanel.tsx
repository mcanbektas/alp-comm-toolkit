/**
 * Protokol sayfasındaki `definitions` sekmesinin EDS paneli (Faz 10, dalga 1c).
 *
 * `DbcPanel.tsx`nin BİREBİR deseni: panel HESAP YAPMAZ (CLAUDE.md mimari
 * kuralı), EDS metnini `parseEds` çözer, Object Dictionary girdisini
 * `decodeEdsValue` çözer. DBC'den TEK fark: dışa aktarma YOK — brief 1c'nin
 * kapsamını `edsTypes/edsParser/edsDecoder/edsFixture` olarak sınırladı, bir
 * `edsWriter` yok (EDS round-trip Faz 10'un bu dalgasının işi değil).
 *
 * Ekran BOŞ AÇILMAZ (spec §50): dosya yüklenmeden önce örnek EDS gösterilir.
 * Kullanıcı verisi YERELDE KALIR (spec §41): `readTextFile` `Blob.text()` ile
 * okur, hiçbir bayt sunucuya gitmez.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { hexToBytes } from '@/protocol-core/buffers/representation';
import { decodeEdsValue, getEdsDataTypeInfo } from '@/protocol-core/definitions/eds/edsDecoder';
import { SAMPLE_EDS_TEXT } from '@/protocol-core/definitions/eds/edsFixture';
import { parseEds } from '@/protocol-core/definitions/eds/edsParser';
import type {
  EdsDatabase,
  EdsObject,
  EdsParseIssue,
} from '@/protocol-core/definitions/eds/edsTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;
/** 0x1000 Device Type'ın DefaultValue'su (`92 01 02 00` LE → 0x00020192). */
const DEFAULT_SAMPLE_HEX = '92 01 02 00';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** `EdsParseIssue.messageKey` sözlükte varsa çevrilir, yoksa olduğu gibi basılır — `DbcPanel`in `translateIssue`ıyla aynı gerekçe. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

function objectKey(index: number, subIndex: number | undefined): string {
  return `${String(index)}-${String(subIndex)}`;
}

/** Identifier gösterimi: onaltılık index + varsa sub-index. Protokol verisi, çevrilmez. */
function formatObjectIdentifier(object: EdsObject): string {
  const hex = `0x${object.index.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
  return object.subIndex === undefined ? hex : `${hex} sub${String(object.subIndex)}`;
}

function formatDataType(dataType: number | undefined): string {
  if (dataType === undefined) return EMPTY_GLYPH;
  return getEdsDataTypeInfo(dataType)?.name ?? `0x${dataType.toString(HEX_RADIX)}`;
}

type EdsState =
  | { readonly status: 'ready'; readonly database: EdsDatabase; readonly issues: readonly EdsParseIssue[]; readonly sample: boolean }
  | { readonly status: 'failed'; readonly issues: readonly EdsParseIssue[] };

function initialState(): EdsState {
  const result = parseEds(SAMPLE_EDS_TEXT);
  return result.success
    ? { status: 'ready', database: result.database, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly EdsParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="eds-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="eds-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.eds.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : (
            <span className="font-mono text-muted"> {issue.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ObjectTable({ objects }: { objects: readonly EdsObject[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="eds-object-table"
        className="w-full min-w-[52rem] border-collapse"
        aria-label={t('definition.eds.table.objects')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.index')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.dataType')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.access')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.default')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.range')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.eds.column.pdoMapping')}</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((object) => (
            <tr
              key={objectKey(object.index, object.subIndex)}
              data-testid="eds-object-row"
              data-object-key={objectKey(object.index, object.subIndex)}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatObjectIdentifier(object)}
              </td>
              {/* Parametre adı VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-medium`}>
                {object.parameterName === '' ? EMPTY_GLYPH : object.parameterName}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>{formatDataType(object.dataType)}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>
                {object.accessType ?? EMPTY_GLYPH}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>{object.defaultValue ?? EMPTY_GLYPH}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>
                {object.lowLimit === undefined && object.highLimit === undefined
                  ? EMPTY_GLYPH
                  : `${object.lowLimit ?? EMPTY_GLYPH} … ${object.highLimit ?? EMPTY_GLYPH}`}
              </td>
              <td className={BODY_CELL_CLASS}>
                {object.pdoMapping === undefined ? EMPTY_GLYPH : t(object.pdoMapping ? 'common.yes' : 'common.no')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EdsPanel(): ReactNode {
  const { t } = useTranslation();

  const [state, setState] = useState<EdsState>(initialState);
  const [selectedObjectKey, setSelectedObjectKey] = useState<string>('');
  const [sampleHex, setSampleHex] = useState<string>(DEFAULT_SAMPLE_HEX);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);

  const database = state.status === 'ready' ? state.database : null;

  const selectedObject = useMemo<EdsObject | null>(() => {
    if (database === null) return null;
    const found = database.objects.find(
      (object) => objectKey(object.index, object.subIndex) === selectedObjectKey,
    );
    // Seçim yoksa ya da yüklenen dosyada karşılığı kalmadıysa ilk nesneye düş.
    return found ?? database.objects[0] ?? null;
  }, [database, selectedObjectKey]);

  const decoded = useMemo(() => {
    if (selectedObject === null || selectedObject.dataType === undefined) return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(sampleHex);
    } catch {
      return { invalidHex: true as const };
    }
    return { invalidHex: false as const, value: decodeEdsValue(bytes, selectedObject.dataType) };
  }, [selectedObject, sampleHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.eds.error.readFailed');
      return;
    }
    const result = parseEds(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ veritabanını silmez.
      setImportErrorKey('definition.eds.error.parseFailed');
      setState((current) =>
        current.status === 'ready' ? { ...current, issues: result.issues } : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', database: result.database, issues: result.issues, sample: false });
    setSelectedObjectKey('');
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
    <div className="flex flex-col gap-4" data-testid="eds-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="eds-import" className="text-xs font-medium text-muted">
          {t('definition.eds.action.import')}
        </label>
        <input
          id="eds-import"
          data-testid="eds-import"
          type="file"
          accept=".eds,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="eds-import-error" className="text-sm text-danger">
          {t(importErrorKey as TranslationKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="eds-sample-notice">
          {t('definition.eds.sampleNotice')}
        </p>
      ) : null}

      {database === null ? (
        <p
          role="alert"
          data-testid="eds-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.eds.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="eds-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.eds.fileName')}
              </dt>
              {/* Dosya adı ve satıcı/ürün adları VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="eds-file-name">
                {database.fileInfo.fileName === '' ? EMPTY_GLYPH : database.fileInfo.fileName}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.eds.vendorProduct')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="eds-vendor-product">
                {database.deviceInfo.vendorName === '' && database.deviceInfo.productName === ''
                  ? EMPTY_GLYPH
                  : `${database.deviceInfo.vendorName} / ${database.deviceInfo.productName}`}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.eds.objectCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="eds-object-count">
                {database.objects.length}
              </dd>
            </div>
          </dl>

          <ObjectTable objects={database.objects} />

          <SelectField
            id="eds-object"
            label={t('definition.eds.object.label')}
            value={selectedObject === null ? '' : objectKey(selectedObject.index, selectedObject.subIndex)}
            onChange={setSelectedObjectKey}
            options={database.objects.map((object) => ({
              value: objectKey(object.index, object.subIndex),
              // İsim ve identifier VERİDİR, çevrilmez.
              label: `${formatObjectIdentifier(object)} — ${object.parameterName === '' ? EMPTY_GLYPH : object.parameterName}`,
            }))}
          />

          {selectedObject === null ? null : (
            <div className="flex flex-col gap-1">
              <label htmlFor="eds-decode-hex" className="text-xs font-medium text-muted">
                {t('definition.eds.decodeHex.label')}
              </label>
              <textarea
                id="eds-decode-hex"
                data-testid="eds-decode-hex"
                rows={2}
                spellCheck={false}
                value={sampleHex}
                aria-invalid={decoded?.invalidHex === true}
                className={`w-full rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  decoded?.invalidHex === true ? 'border-danger' : 'border-line'
                }`}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setSampleHex(event.target.value);
                }}
              />
              {decoded?.invalidHex === true ? (
                <p role="alert" data-testid="eds-hex-error" className="text-xs text-danger">
                  {t('decode.error.invalidHex')}
                </p>
              ) : null}

              {selectedObject.dataType === undefined ? (
                <p className="text-xs text-muted" data-testid="eds-decode-unavailable">
                  {t('definition.eds.decode.unavailable')}
                </p>
              ) : decoded !== null && !decoded.invalidHex ? (
                <dl className="flex flex-wrap gap-4" data-testid="eds-decoded-value">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      {t('decode.column.raw')}
                    </dt>
                    <dd className="tabular font-mono text-sm text-text" data-testid="eds-decoded-raw">
                      {decoded.value === undefined ? EMPTY_GLYPH : String(decoded.value.value)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      {t('definition.eds.column.dataType')}
                    </dt>
                    <dd className="font-mono text-sm text-text">
                      {decoded.value === undefined ? EMPTY_GLYPH : decoded.value.dataTypeName}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
