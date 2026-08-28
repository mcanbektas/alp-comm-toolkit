/**
 * Protokol sayfasındaki `definitions` sekmesinin ÖZEL ŞEMA paneli.
 *
 * `DbcPanel`/`EdsPanel` deseninin üçüncüsü, ama kapsamı onlardan geniş:
 * `custom-schema` katalogda 20 kayıt taşıyor (DBC 6, EDS 2). Tek panel, on
 * biçimin en kalabalığını "planlandı" bildiriminden çıkarır.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı) — üç motor da hazırdı ve
 * hiçbiri burada yeniden yazılmadı:
 *
 * - `parseProtocolSchemaJson`: güvenilmeyen JSON'u zod ile şemaya çevirir
 *   (BİÇİM doğrulaması).
 * - `validateProtocolSchema`: alanlar arası tutarlılığı denetler (ANLAM
 *   doğrulaması — çakışan ofset, döngüsel uzunluk referansı…). İkisi ayrı
 *   raporlanır, çünkü "JSON doğru şekilli mi" ile "protokol anlamlı mı" ayrı
 *   sorular ve kullanıcı hangisinin bozuk olduğunu bilmek ister.
 * - `parseWithSchema`: şemayı örnek çerçeveye uygular.
 *
 * Ekran BOŞ AÇILMAZ (spec §50): spec §9.6'nın şeması ve §43'ün doğrulanmış
 * çerçevesi yüklü gelir, yani sekme neyi vaat ettiğini kanıtlar.
 *
 * Kullanıcı verisi YERELDE KALIR (spec §41): `readTextFile` `Blob.text()` ile
 * okur, hiçbir bayt sunucuya gitmez. Şema VERİDİR, çalıştırılmaz.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { parseWithSchema } from '@/protocol-core/decoding/schemaParser';
import {
  SPEC_SENSOR_FRAME,
  SPEC_SENSOR_PROTOCOL_JSON,
  parseProtocolSchemaJson,
} from '@/protocol-core/schemas';
import type {
  ProtocolFieldSchema,
  ProtocolSchema,
  SchemaParseIssue,
} from '@/protocol-core/schemas';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';
import { validateProtocolSchema } from '@/protocol-core/validation/schemaValidation';
import type { SchemaIssue } from '@/protocol-core/validation/schemaValidation';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { PARSE_ERROR_LABEL_KEYS, translateDiagnostic } from '@/utils/parseDiagnostics';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';
const EXPORT_FILE_NAME = 'protocol-schema.json';
const EXPORT_MIME_TYPE = 'application/json';
const JSON_INDENT = 2;

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const BUTTON_CLASS =
  'rounded-token-sm border border-line bg-raised px-2 py-1.5 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * İç içe yapıların alanları da tabloya girer: `structure`/`array` alanlarının
 * çocukları gizlenirse şemanın yarısı görünmez olur. Derinlik girinti için
 * taşınır — ad sütunundaki boşluk hiyerarşiyi tek bakışta okutur.
 */
interface FlatSchemaField {
  readonly field: ProtocolFieldSchema;
  readonly depth: number;
  readonly path: string;
}

function flattenFields(
  fields: readonly ProtocolFieldSchema[],
  depth = 0,
  prefix = '',
): FlatSchemaField[] {
  return fields.flatMap((field) => {
    const path = prefix === '' ? field.id : `${prefix}.${field.id}`;
    const self: FlatSchemaField = { field, depth, path };
    return field.fields === undefined
      ? [self]
      : [self, ...flattenFields(field.fields, depth + 1, path)];
  });
}

/**
 * Uzunluk sütunu üç ayrı kaynağı tek hücrede toplar: sabit `length`, başka bir
 * alandan gelen `lengthFrom` ve bit geometrisi. Üçünü ayrı sütuna dağıtmak
 * tabloyu 390 pikselde okunmaz yapardı; hangi kaynağın konuştuğu değerin
 * kendisinden anlaşılır.
 */
function formatLength(field: ProtocolFieldSchema, unresolved: string): string {
  if (field.bitLength !== undefined) return `${String(field.bitLength)} bit`;
  if (field.length !== undefined) return String(field.length);
  if (field.lengthFrom !== undefined) return `← ${field.lengthFrom}`;
  return unresolved;
}

function formatOffset(field: ProtocolFieldSchema): string {
  if (field.offset === undefined) return EMPTY_GLYPH;
  const byteOffset = String(field.offset);
  return field.bitOffset === undefined ? byteOffset : `${byteOffset}+${String(field.bitOffset)}b`;
}

/**
 * `bytesToHex` ayraçsız üretir ("34127F"); bayt sınırları görünmeli, yoksa
 * dört baytlık bir alanın nerede bittiği okunmuyor. `DecodePanel`in aynı
 * deseni.
 */
function toSpacedHex(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

/** Çözümlenmiş değer `bigint` de olabilir; `String()` üçünü de aynı biçimde basar. */
function formatValue(value: bigint | number | string | undefined): string {
  return value === undefined ? EMPTY_GLYPH : String(value);
}

type SchemaState =
  | {
      readonly status: 'ready';
      readonly schema: ProtocolSchema;
      readonly json: string;
      readonly sample: boolean;
    }
  | { readonly status: 'failed'; readonly issues: readonly SchemaParseIssue[] };

function initialState(): SchemaState {
  const result = parseProtocolSchemaJson(SPEC_SENSOR_PROTOCOL_JSON);
  return result.success
    ? { status: 'ready', schema: result.schema, json: SPEC_SENSOR_PROTOCOL_JSON, sample: true }
    : { status: 'failed', issues: result.issues };
}

function FormatIssueList({ issues }: { issues: readonly SchemaParseIssue[] }): ReactNode {
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="schema-format-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.path}-${String(index)}`}
          data-testid="schema-format-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-danger"
        >
          {/* Yol ve zod mesajı VERİDİR (şemanın kendi anahtar adları), çevrilmez. */}
          {issue.path === '' ? null : <span className="font-mono">{issue.path}: </span>}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * Anlam doğrulaması ayrı listede: biçim sorunları şemayı BAŞLATMAZ, anlam
 * sorunları ise şema yüklüyken de durur (uyarı seviyesi çözümlemeyi
 * engellemez). İkisini tek listede toplamak, "dosya bozuk" ile "protokol
 * kusurlu"yu aynı şey gibi gösterirdi.
 */
function ValidationIssueList({ issues }: { issues: readonly SchemaIssue[] }): ReactNode {
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="schema-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}-${String(index)}`}
          data-testid="schema-issue"
          data-severity={issue.severity}
          className={`rounded-token-sm border border-line px-2 py-1 text-xs ${
            issue.severity === 'error' ? 'text-danger' : 'text-warn'
          }`}
        >
          {issue.fieldId === undefined ? null : (
            <span className="font-mono text-muted">{issue.fieldId}: </span>
          )}
          {/* `message` motorun ürettiği açıklamadır (alan adlarını içerir), çevrilmez. */}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function FieldTable({ fields }: { fields: readonly ProtocolFieldSchema[] }): ReactNode {
  const { t } = useTranslation();
  const rows = useMemo(() => flattenFields(fields), [fields]);

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="schema-field-table"
        className="w-full min-w-[44rem] border-collapse"
        aria-label={t('definition.schema.table.fields')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.field')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.type')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.offset')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.length')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.detail')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ field, depth, path }) => (
            <tr
              key={path}
              data-testid="schema-field-row"
              data-field-id={field.id}
              className="border-b border-line/60 last:border-b-0"
            >
              <td className={BODY_CELL_CLASS}>
                {/* Alan adı ve kimliği protokol VERİSİDİR, çevrilmez. */}
                <span style={{ paddingLeft: `${String(depth)}rem` }} className="font-medium">
                  {field.name}
                </span>
                <span className="block font-mono text-xs text-muted">{field.id}</span>
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>{field.type}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {formatOffset(field)}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {formatLength(field, EMPTY_GLYPH)}
              </td>
              <td className={`${BODY_CELL_CLASS} text-xs text-muted`}>
                {field.algorithm ?? field.unit ?? (field.enumValues === undefined
                  ? EMPTY_GLYPH
                  : `${String(Object.keys(field.enumValues).length)} ${t('definition.schema.enumValues')}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `success: true` ama `valid: false` MÜMKÜN ve bu panelde sık: bozuk checksum
 * çerçeveyi geçersiz kılar, ama alanlar yine çözülür (spec §47 — kısmi sonuç
 * gösterilir). Tanılar basılmazsa kullanıcı bozuk çerçeveyi sağlam sanır;
 * çözümlemenin durmaması onu daha da yanıltır.
 */
function FrameDiagnostics({ frame }: { frame: ParsedFrame }): ReactNode {
  const { t } = useTranslation();
  if (frame.errors.length === 0 && frame.warnings.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1">
      {frame.errors.map((error, index) => (
        <li
          key={`${error.code}-${String(index)}`}
          data-testid="schema-decode-error"
          data-error-code={error.code}
          className="rounded-token-sm bg-danger-soft px-2 py-1 text-sm text-danger"
        >
          <span className="font-medium">{t(PARSE_ERROR_LABEL_KEYS[error.code])}</span>{' '}
          <span className="text-xs">{translateDiagnostic(error.message, t)}</span>
        </li>
      ))}
      {frame.warnings.map((warning, index) => (
        <li
          key={`${warning.code}-${String(index)}`}
          data-testid="schema-decode-warning"
          className="rounded-token-sm border border-line px-2 py-1 text-sm text-warn"
        >
          {translateDiagnostic(warning.message, t)}
        </li>
      ))}
    </ul>
  );
}

function DecodedTable({ fields }: { fields: readonly ParsedField[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="schema-decoded-table"
        className="w-full min-w-[40rem] border-collapse"
        aria-label={t('definition.schema.table.decoded')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.field')}</th>
            <th className={HEADER_CELL_CLASS}>{t('decode.column.raw')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.physical')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.schema.column.bytes')}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr
              key={field.id}
              data-testid="schema-decoded-row"
              data-field-id={field.id}
              className="border-b border-line/60 last:border-b-0"
            >
              <td className={BODY_CELL_CLASS}>{field.name}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {formatValue(field.rawValue)}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {formatValue(field.physicalValue)}
                {field.unit === undefined ? '' : ` ${field.unit}`}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono text-xs text-muted`}>
                {toSpacedHex(field.rawBytes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemaPanel(): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<SchemaState>(initialState);
  const [sampleHex, setSampleHex] = useState(() => toSpacedHex(SPEC_SENSOR_FRAME));
  const [importErrorKey, setImportErrorKey] = useState<
    'definition.schema.error.readFailed' | 'definition.schema.error.parseFailed' | null
  >(null);
  const [formatIssues, setFormatIssues] = useState<readonly SchemaParseIssue[]>(() => {
    const result = parseProtocolSchemaJson(SPEC_SENSOR_PROTOCOL_JSON);
    return result.success ? [] : result.issues;
  });

  const schema = state.status === 'ready' ? state.schema : null;

  const validation = useMemo(
    () => (schema === null ? null : validateProtocolSchema(schema)),
    [schema],
  );

  /**
   * Çözümleme hex kutusunun HER tuşunda koşar; `parseWithSchema` saftır ve
   * girdi bir çerçevelik olduğu için ölçüde maliyeti yok. Geçersiz hex bir
   * ÇÖZÜMLEME hatası değil, girdi hatasıdır — ayrı işaretlenir, yoksa
   * kullanıcı şemayı suçlar.
   */
  const decoded = useMemo(() => {
    if (schema === null) return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(sampleHex);
    } catch {
      return { invalidHex: true } as const;
    }
    return { invalidHex: false, result: parseWithSchema(schema, bytes) } as const;
  }, [schema, sampleHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.schema.error.readFailed');
      return;
    }
    const result = parseProtocolSchemaJson(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ şemayı SİLMEZ: kullanıcı bozuk dosyayı
      // düzeltirken elindeki çalışan tanımı kaybetmemeli.
      setImportErrorKey('definition.schema.error.parseFailed');
      setFormatIssues(result.issues);
      return;
    }
    setFormatIssues([]);
    setState({
      status: 'ready',
      schema: result.schema,
      json: JSON.stringify(result.schema, null, JSON_INDENT),
      sample: false,
    });
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

  const handleExport = useCallback((): void => {
    if (state.status !== 'ready') return;
    downloadTextFile(EXPORT_FILE_NAME, state.json, EXPORT_MIME_TYPE);
  }, [state]);

  return (
    <div className="flex flex-col gap-4" data-testid="schema-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="schema-import" className="text-xs font-medium text-muted">
          {t('definition.schema.action.import')}
        </label>
        <input
          id="schema-import"
          data-testid="schema-import"
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="schema-import-error" className="text-sm text-danger">
          {t(importErrorKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="schema-sample-notice">
          {t('definition.schema.sampleNotice')}
        </p>
      ) : null}

      {schema === null ? (
        <p
          role="alert"
          data-testid="schema-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.schema.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="schema-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.schema.name')}
              </dt>
              {/* Protokol adı ve sürümü VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="schema-name">
                {schema.name}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.schema.version')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="schema-version">
                {schema.version}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.schema.framing')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="schema-framing">
                {schema.framing.type}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.schema.fieldCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="schema-field-count">
                {flattenFields(schema.fields).length}
              </dd>
            </div>
          </dl>

          <FieldTable fields={schema.fields} />

          {validation === null || validation.issues.length === 0 ? null : (
            <ValidationIssueList issues={validation.issues} />
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="schema-decode-hex" className="text-xs font-medium text-muted">
              {t('definition.schema.decodeHex.label')}
            </label>
            <textarea
              id="schema-decode-hex"
              data-testid="schema-decode-hex"
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
              <p role="alert" data-testid="schema-hex-error" className="text-xs text-danger">
                {t('decode.error.invalidHex')}
              </p>
            ) : null}
          </div>

          {decoded !== null && !decoded.invalidHex ? (
            decoded.result.success ? (
              <>
                <DecodedTable fields={decoded.result.frame.fields} />
                <FrameDiagnostics frame={decoded.result.frame} />
              </>
            ) : (
              <p
                role="alert"
                data-testid="schema-decode-error"
                className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
              >
                {/* Motorun ürettiği mesaj alanın adını ve konumunu taşır; çevrilmiş
                    genel bir metin onu yutardı. */}
                <span className="font-medium">
                  {t(PARSE_ERROR_LABEL_KEYS[decoded.result.error.code])}
                </span>{' '}
                {translateDiagnostic(decoded.result.error.message, t)}
              </p>
            )
          ) : null}

          <div>
            <button
              type="button"
              data-testid="schema-export"
              onClick={handleExport}
              className={BUTTON_CLASS}
            >
              {t('definition.schema.action.export')}
            </button>
          </div>
        </>
      )}

      <FormatIssueList issues={formatIssues} />
    </div>
  );
}
