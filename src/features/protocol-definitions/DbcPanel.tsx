/**
 * Protokol sayfasındaki `definitions` sekmesinin DBC paneli (Faz 9, dalga 3b).
 *
 * Sekme bugüne kadar 172 protokolün hepsinde aynı "planlandı" bildirimini
 * basıyordu; burada CAN ailesi ilk kez gerçek bir tanım dosyası motoruna
 * bağlanır.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): DBC metnini `parseDbc` çözer,
 * sinyalleri `decodeDbcMessage` çıkarır, dosyayı `writeDbc` üretir. Buradaki
 * tek iş dosyayı almak, seçimi tutmak ve sonucu çizmek.
 *
 * ── NEDEN "DEFINITIONS" SEKMESİ ─────────────────────────────────────────────
 * DBC bir protokol DEĞİL, bir tanım dosyasıdır: katalogda kaydı yoktur ve
 * olmamalıdır. Taksonomi onu `Definitions > DBC` yaprağı olarak tanımlıyor ve
 * katalogdaki dört CAN kaydı ile Marine J1939 zaten `definitions: ['dbc']`
 * taşıyor — karar fiilen orada verilmiş.
 *
 * Ekran BOŞ AÇILMAZ (spec §50): dosya yüklenmeden önce örnek DBC gösterilir,
 * böylece sekme neyi vaat ettiğini kanıtlar.
 *
 * Kullanıcı verisi YERELDE KALIR (spec §41): `readTextFile` dosyayı
 * `Blob.text()` ile okur, hiçbir bayt sunucuya gitmez.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { hexToBytes } from '@/protocol-core/buffers/representation';
import { decodeDbcMessage } from '@/protocol-core/definitions/dbc/dbcDecoder';
import { SAMPLE_DBC_TEXT } from '@/protocol-core/definitions/dbc/dbcFixture';
import { parseDbc } from '@/protocol-core/definitions/dbc/dbcParser';
import { writeDbc } from '@/protocol-core/definitions/dbc/dbcWriter';
import type {
  DbcDatabase,
  DbcMessage,
  DbcParseIssue,
  DbcSignal,
} from '@/protocol-core/definitions/dbc/dbcTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;
const DEFAULT_SAMPLE_HEX = 'E8 03 5A 10 27 00 00 00';
const EXPORT_FILE_NAME = 'protocol-definition.dbc';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const BUTTON_CLASS =
  'rounded-token-sm border border-line bg-raised px-2 py-1.5 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * `DbcParseIssue.messageKey` sözlükte varsa çevrilir, yoksa olduğu gibi basılır
 * — `DecodePanel`in `translateDiagnostic` kapısıyla aynı gerekçe: motor saf
 * TypeScript'tir ve yerelleştirilmiş metin üretemez.
 */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

/** Identifier gösterimi: onaltılık + biçim etiketi. Protokol terimi, çevrilmez. */
function formatIdentifier(message: DbcMessage): string {
  const hex = `0x${message.canId.toString(HEX_RADIX).toUpperCase()}`;
  return message.extended ? `${hex} (29-bit)` : `${hex} (11-bit)`;
}

/** Çoklama sütunu — `M` anahtar, `m<N>` o anahtara bağlı sinyal. */
function formatMultiplex(signal: DbcSignal): string {
  switch (signal.multiplex.kind) {
    case 'multiplexor':
      return 'M';
    case 'multiplexed':
      return `m${String(signal.multiplex.switchValue)}`;
    default:
      return EMPTY_GLYPH;
  }
}

function formatByteOrder(signal: DbcSignal): string {
  // Protokol terimleri veridir, çevrilmez.
  return signal.byteOrder === 'intel' ? 'Intel @1' : 'Motorola @0';
}

/** Kayan noktalı sonuçta gereksiz basamak göstermemek için sadeleştirir. */
function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

/** Yüklenen DBC'nin durumu. Yükleme hatası ile "henüz yüklenmedi" ayrı tutulur. */
type DbcState =
  | { readonly status: 'ready'; readonly database: DbcDatabase; readonly issues: readonly DbcParseIssue[]; readonly sample: boolean }
  | { readonly status: 'failed'; readonly issues: readonly DbcParseIssue[] };

function initialState(): DbcState {
  const result = parseDbc(SAMPLE_DBC_TEXT);
  return result.success
    ? { status: 'ready', database: result.database, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly DbcParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="dbc-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="dbc-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.dbc.line')} {issue.line}:{' '}
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

function SignalTable({ message }: { message: DbcMessage }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="dbc-signal-table"
        className="w-full min-w-[48rem] border-collapse"
        aria-label={t('definition.dbc.table.signals')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.signal')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.start')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.length')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.byteOrder')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.signed')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.factorOffset')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.range')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.unit')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.multiplex')}</th>
          </tr>
        </thead>
        <tbody>
          {message.signals.map((signal) => (
            <tr
              key={signal.name}
              data-testid="dbc-signal-row"
              data-signal-name={signal.name}
              className="border-b border-line"
            >
              {/* Sinyal adı VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-medium`}>{signal.name}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{signal.startBit}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{signal.bitLength}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>{formatByteOrder(signal)}</td>
              <td className={BODY_CELL_CLASS}>
                {t(signal.signed ? 'common.yes' : 'common.no')}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatValue(signal.factor)} / {formatValue(signal.offset)}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatValue(signal.minimum)} … {formatValue(signal.maximum)}
              </td>
              <td className={BODY_CELL_CLASS}>{signal.unit === '' ? EMPTY_GLYPH : signal.unit}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>{formatMultiplex(signal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {message.signals.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted" data-testid="dbc-signals-empty">
          {t('definition.dbc.signals.empty')}
        </p>
      ) : null}
    </div>
  );
}

export function DbcPanel(): ReactNode {
  const { t } = useTranslation();

  const [state, setState] = useState<DbcState>(initialState);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  const [sampleHex, setSampleHex] = useState<string>(DEFAULT_SAMPLE_HEX);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);

  const database = state.status === 'ready' ? state.database : null;

  const selectedMessage = useMemo<DbcMessage | null>(() => {
    if (database === null) return null;
    const found = database.messages.find(
      (message) => `${String(message.canId)}-${String(message.extended)}` === selectedMessageId,
    );
    // Seçim yoksa ya da yüklenen dosyada karşılığı kalmadıysa ilk mesaja düş:
    // boş bir tablo basmak kullanıcıya hiçbir şey söylemez (spec §50).
    return found ?? database.messages[0] ?? null;
  }, [database, selectedMessageId]);

  const decoded = useMemo(() => {
    if (selectedMessage === null) return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(sampleHex);
    } catch {
      return { invalidHex: true as const };
    }
    return { invalidHex: false as const, signals: decodeDbcMessage(bytes, selectedMessage) };
  }, [selectedMessage, sampleHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.dbc.error.readFailed');
      return;
    }
    const result = parseDbc(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ veritabanını silmez: kullanıcı elindeki
      // çalışan tanımı bir yanlış dosya yüzünden kaybetmemeli.
      setImportErrorKey('definition.dbc.error.parseFailed');
      setState((current) =>
        current.status === 'ready' ? { ...current, issues: result.issues } : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', database: result.database, issues: result.issues, sample: false });
    setSelectedMessageId('');
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      // Girdi sıfırlanır: aynı dosya ikinci kez seçildiğinde de olay doğsun.
      event.target.value = '';
      if (file === undefined) return;
      void handleImport(file);
    },
    [handleImport],
  );

  const handleExport = useCallback((): void => {
    if (database === null) return;
    downloadTextFile(EXPORT_FILE_NAME, writeDbc(database));
  }, [database]);

  return (
    <div className="flex flex-col gap-4" data-testid="dbc-panel">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="dbc-import" className="text-xs font-medium text-muted">
            {t('definition.dbc.action.import')}
          </label>
          <input
            id="dbc-import"
            data-testid="dbc-import"
            type="file"
            accept=".dbc,text/plain"
            onChange={handleFileChange}
            className={FILE_INPUT_CLASS}
          />
        </div>
        <button
          type="button"
          data-testid="dbc-export"
          onClick={handleExport}
          disabled={database === null}
          className={BUTTON_CLASS}
        >
          {t('definition.dbc.action.export')}
        </button>
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="dbc-import-error" className="text-sm text-danger">
          {t(importErrorKey as TranslationKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="dbc-sample-notice">
          {t('definition.dbc.sampleNotice')}
        </p>
      ) : null}

      {database === null ? (
        <p role="alert" data-testid="dbc-load-failed" className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger">
          {t('definition.dbc.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="dbc-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.dbc.version')}
              </dt>
              {/* Sürüm ve düğüm adları VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="dbc-version">
                {database.version === '' ? EMPTY_GLYPH : database.version}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.dbc.messageCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="dbc-message-count">
                {database.messages.length}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.dbc.nodes')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="dbc-nodes">
                {database.nodes.length === 0 ? EMPTY_GLYPH : database.nodes.join(', ')}
              </dd>
            </div>
          </dl>

          <SelectField
            id="dbc-message"
            label={t('definition.dbc.message.label')}
            value={
              selectedMessage === null
                ? ''
                : `${String(selectedMessage.canId)}-${String(selectedMessage.extended)}`
            }
            onChange={setSelectedMessageId}
            options={database.messages.map((message) => ({
              value: `${String(message.canId)}-${String(message.extended)}`,
              // Mesaj adı ve identifier VERİDİR, çevrilmez.
              label: `${formatIdentifier(message)} — ${message.name}`,
            }))}
          />

          {selectedMessage === null ? null : (
            <>
              {selectedMessage.comment === undefined ? null : (
                <p className="text-xs text-muted" data-testid="dbc-message-comment">
                  {selectedMessage.comment}
                </p>
              )}

              <SignalTable message={selectedMessage} />

              <div className="flex flex-col gap-1">
                <label htmlFor="dbc-sample-hex" className="text-xs font-medium text-muted">
                  {t('definition.dbc.sampleHex.label')}
                </label>
                <textarea
                  id="dbc-sample-hex"
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
                  <p role="alert" data-testid="dbc-hex-error" className="text-xs text-danger">
                    {t('decode.error.invalidHex')}
                  </p>
                ) : null}
              </div>

              {decoded !== null && !decoded.invalidHex ? (
                <div className="overflow-x-auto">
                  <table
                    data-testid="dbc-decoded-table"
                    className="w-full min-w-[32rem] border-collapse"
                    aria-label={t('definition.dbc.table.decoded')}
                  >
                    <thead>
                      <tr>
                        <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.signal')}</th>
                        <th className={HEADER_CELL_CLASS}>{t('decode.column.raw')}</th>
                        <th className={HEADER_CELL_CLASS}>{t('decode.column.physical')}</th>
                        <th className={HEADER_CELL_CLASS}>{t('definition.dbc.column.label')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decoded.signals.map((entry) => (
                        <tr
                          key={entry.signal.name}
                          data-testid="dbc-decoded-row"
                          data-signal-name={entry.signal.name}
                          data-out-of-range={String(entry.outOfRange)}
                          className="border-b border-line"
                        >
                          <td className={`${BODY_CELL_CLASS} font-medium`}>{entry.signal.name}</td>
                          <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                            {entry.rawValue}
                          </td>
                          <td
                            className={
                              entry.outOfRange
                                ? `${BODY_CELL_CLASS} tabular font-mono text-danger`
                                : `${BODY_CELL_CLASS} tabular font-mono`
                            }
                            data-testid="dbc-decoded-physical"
                          >
                            {formatValue(entry.physicalValue)}
                            {entry.signal.unit === '' ? '' : ` ${entry.signal.unit}`}
                          </td>
                          <td className={BODY_CELL_CLASS}>{entry.label ?? EMPTY_GLYPH}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {decoded.signals.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted" data-testid="dbc-decoded-empty">
                      {t('definition.dbc.decoded.empty')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
