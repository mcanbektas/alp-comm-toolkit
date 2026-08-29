/**
 * `definitions` sekmesinin ÜRETİCİ KAYIT HARİTASI paneli.
 *
 * `DbcPanel`/`EdsPanel`/`SchemaPanel` deseninin dördüncüsü. Ötekilerden bir
 * farkı var ve panelin bütün tasarımını o belirliyor: `vendor-map`in standart
 * bir dosya biçimi YOKTUR (bkz. `vendorMapTypes.ts`). Kullanıcı tabloyu
 * üreticinin kılavuzundan kendi çıkarır, elektronik tabloda tutar. Bu yüzden
 * panel CSV'yi birinci sınıf giriş kabul eder ve sütun adlarını esnek eşler;
 * dosyayı bizim şemamıza uydurmayı kullanıcıya yıkmak, aracı kullanmamak için
 * yeterli bir sebep olurdu.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): tabloyu `parseVendorMap`
 * çözer, değeri `decodeVendorMapEntry` okur. Buradaki tek iş dosyayı almak,
 * seçimi tutmak ve sonucu çizmek.
 *
 * Ekran BOŞ AÇILMAZ (spec §50): örnek harita ve ona ait register baytları
 * yüklü gelir. Kullanıcı verisi YERELDE KALIR (spec §41).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { decodeVendorMapEntry } from '@/protocol-core/definitions/vendor-map/vendorMapDecoder';
import {
  SAMPLE_VENDOR_MAP_BYTES,
  SAMPLE_VENDOR_MAP_CSV,
} from '@/protocol-core/definitions/vendor-map/vendorMapFixture';
import { parseVendorMap } from '@/protocol-core/definitions/vendor-map/vendorMapParser';
import type {
  VendorMap,
  VendorMapAddressSpace,
  VendorMapEntry,
  VendorMapIssue,
} from '@/protocol-core/definitions/vendor-map/vendorMapTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;
const JSON_INDENT = 2;
const EXPORT_FILE_NAME = 'vendor-map.json';
const EXPORT_MIME_TYPE = 'application/json';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const BUTTON_CLASS =
  'rounded-token-sm border border-line bg-raised px-2 py-1.5 text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Adres uzayı ARAYÜZ metnidir (protokol verisi değil), çevrilir. */
const SPACE_LABEL_KEYS: Record<VendorMapAddressSpace, TranslationKey> = {
  coil: 'definition.vendorMap.space.coil',
  'discrete-input': 'definition.vendorMap.space.discreteInput',
  'input-register': 'definition.vendorMap.space.inputRegister',
  'holding-register': 'definition.vendorMap.space.holdingRegister',
  command: 'definition.vendorMap.space.command',
  unspecified: 'definition.vendorMap.space.unspecified',
};

/** `VendorMapIssue.messageKey` sözlükte varsa çevrilir — `EdsPanel`in aynı gerekçesi. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

/**
 * Adres iki gösterimle birden basılır. Üretici kılavuzları ikisini karışık
 * kullanıyor (tabloda ondalık, örnek telde hex) ve kullanıcı hangisine bakarsa
 * baksın satırı bulabilmeli.
 */
function formatAddress(address: number): string {
  return `${String(address)} (0x${address.toString(HEX_RADIX).toUpperCase()})`;
}

function entryKey(entry: VendorMapEntry): string {
  return `${entry.space}:${String(entry.address)}`;
}

/** Örnek harita seçildiğinde girdinin fixture'daki baytları; yoksa boş. */
function sampleBytesFor(entry: VendorMapEntry | null, sample: boolean): string {
  if (entry === null || !sample) return '';
  const bytes = SAMPLE_VENDOR_MAP_BYTES[String(entry.address)];
  return bytes === undefined ? '' : (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

type MapState =
  | { readonly status: 'ready'; readonly map: VendorMap; readonly issues: readonly VendorMapIssue[]; readonly sample: boolean }
  | { readonly status: 'failed'; readonly issues: readonly VendorMapIssue[] };

function initialState(): MapState {
  const result = parseVendorMap(SAMPLE_VENDOR_MAP_CSV);
  return result.success
    ? { status: 'ready', map: result.map, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly VendorMapIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="vendor-map-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="vendor-map-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.vendorMap.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : <span className="font-mono text-muted"> {issue.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function EntryTable({ entries }: { entries: readonly VendorMapEntry[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="vendor-map-table"
        className="w-full min-w-[48rem] border-collapse"
        aria-label={t('definition.vendorMap.table.entries')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.address')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.type')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.space')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.scale')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.vendorMap.column.access')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entryKey(entry)}
              data-testid="vendor-map-row"
              data-entry-key={entryKey(entry)}
              className="border-b border-line/60 last:border-b-0"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {formatAddress(entry.address)}
              </td>
              <td className={BODY_CELL_CLASS}>
                {/* Girdi adı ve açıklaması VERİDİR, çevrilmez. */}
                {entry.name}
                {entry.description === undefined ? null : (
                  <span className="block text-xs text-muted">{entry.description}</span>
                )}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>{entry.type}</td>
              <td className={`${BODY_CELL_CLASS} text-xs text-muted`}>
                {t(SPACE_LABEL_KEYS[entry.space])}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {entry.scale === undefined ? EMPTY_GLYPH : String(entry.scale)}
                {entry.unit === undefined ? '' : ` ${entry.unit}`}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono text-xs uppercase`}>
                {entry.access ?? EMPTY_GLYPH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VendorMapPanel(): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<MapState>(initialState);
  const [selectedKey, setSelectedKey] = useState('');
  const [sampleHex, setSampleHex] = useState('');
  const [importErrorKey, setImportErrorKey] = useState<
    'definition.vendorMap.error.readFailed' | 'definition.vendorMap.error.parseFailed' | null
  >(null);

  const map = state.status === 'ready' ? state.map : null;

  /**
   * Seçim boşken İLK girdi gösterilir: ekran boş açılmamalı ve kullanıcıyı
   * "önce bir satır seç" adımına zorlamak, panelin ne yaptığını gizler.
   */
  const selectedEntry = useMemo(() => {
    if (map === null) return null;
    return map.entries.find((entry) => entryKey(entry) === selectedKey) ?? map.entries[0] ?? null;
  }, [map, selectedKey]);

  /**
   * Kutuya elle yazılmış bayt kullanıcının verisidir ve seçim değişince
   * SİLİNMEZ; boşken örnek haritanın o girdiye ait baytları gösterilir.
   */
  const effectiveHex = sampleHex === '' ? sampleBytesFor(selectedEntry, state.status === 'ready' && state.sample) : sampleHex;

  const decoded = useMemo(() => {
    if (map === null || selectedEntry === null || effectiveHex.trim() === '') return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(effectiveHex);
    } catch {
      return { invalidHex: true } as const;
    }
    return {
      invalidHex: false,
      result: decodeVendorMapEntry(selectedEntry, bytes, map.defaultWordOrder),
    } as const;
  }, [map, selectedEntry, effectiveHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.vendorMap.error.readFailed');
      return;
    }
    const result = parseVendorMap(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ haritayı silmez.
      setImportErrorKey('definition.vendorMap.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', map: result.map, issues: result.issues, sample: false });
    setSelectedKey('');
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

  const handleExport = useCallback((): void => {
    if (map === null) return;
    downloadTextFile(EXPORT_FILE_NAME, JSON.stringify(map, null, JSON_INDENT), EXPORT_MIME_TYPE);
  }, [map]);

  return (
    <div className="flex flex-col gap-4" data-testid="vendor-map-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="vendor-map-import" className="text-xs font-medium text-muted">
          {t('definition.vendorMap.action.import')}
        </label>
        <input
          id="vendor-map-import"
          data-testid="vendor-map-import"
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
        <p className="text-xs text-muted">{t('definition.vendorMap.importHint')}</p>
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="vendor-map-import-error" className="text-sm text-danger">
          {t(importErrorKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="vendor-map-sample-notice">
          {t('definition.vendorMap.sampleNotice')}
        </p>
      ) : null}

      {map === null ? (
        <p
          role="alert"
          data-testid="vendor-map-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.vendorMap.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="vendor-map-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.vendorMap.device')}
              </dt>
              {/* Cihaz/üretici adı VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="vendor-map-device">
                {map.device === '' ? EMPTY_GLYPH : map.device}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.vendorMap.vendor')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="vendor-map-vendor">
                {map.vendor ?? EMPTY_GLYPH}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.vendorMap.wordOrder')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="vendor-map-word-order">
                {t(
                  map.defaultWordOrder === 'high-first'
                    ? 'definition.vendorMap.wordOrder.highFirst'
                    : 'definition.vendorMap.wordOrder.lowFirst',
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.vendorMap.entryCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="vendor-map-entry-count">
                {map.entries.length}
              </dd>
            </div>
          </dl>

          <EntryTable entries={map.entries} />

          {selectedEntry === null ? null : (
            <>
              <SelectField
                id="vendor-map-entry"
                label={t('definition.vendorMap.entry.label')}
                value={entryKey(selectedEntry)}
                onChange={(value) => {
                  setSelectedKey(value);
                  // Elle yazılmış bayt korunur; boşsa yeni girdinin örneği gelir.
                  setSampleHex('');
                }}
                options={map.entries.map((entry) => ({
                  value: entryKey(entry),
                  // Adres ve ad VERİDİR, çevrilmez.
                  label: `${formatAddress(entry.address)} — ${entry.name}`,
                }))}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="vendor-map-hex" className="text-xs font-medium text-muted">
                  {t('definition.vendorMap.decodeHex.label')}
                </label>
                <textarea
                  id="vendor-map-hex"
                  data-testid="vendor-map-hex"
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
                  <p role="alert" data-testid="vendor-map-hex-error" className="text-xs text-danger">
                    {t('decode.error.invalidHex')}
                  </p>
                ) : null}
              </div>

              {decoded !== null && !decoded.invalidHex ? (
                decoded.result.success ? (
                  <div className="flex flex-col gap-3" data-testid="vendor-map-decoded">
                    <dl className="flex flex-wrap gap-4">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs uppercase tracking-wide text-muted">
                          {t('decode.column.raw')}
                        </dt>
                        <dd className="tabular font-mono text-sm text-text" data-testid="vendor-map-raw">
                          {String(decoded.result.rawValue)}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs uppercase tracking-wide text-muted">
                          {t('definition.vendorMap.column.physical')}
                        </dt>
                        <dd className="tabular font-mono text-sm text-text" data-testid="vendor-map-physical">
                          {String(decoded.result.physicalValue)}
                          {decoded.result.unit === undefined ? '' : ` ${decoded.result.unit}`}
                        </dd>
                      </div>
                    </dl>

                    {decoded.result.bits === undefined || decoded.result.bits.length === 0 ? null : (
                      <ul className="flex flex-wrap gap-2" data-testid="vendor-map-bits">
                        {decoded.result.bits.map((bit) => (
                          <li
                            key={bit.bit}
                            data-testid="vendor-map-bit"
                            data-bit={bit.bit}
                            data-value={String(bit.value)}
                            className={`rounded-token-sm border px-2 py-1 text-xs ${
                              bit.value ? 'border-accent text-accent' : 'border-line text-muted'
                            }`}
                          >
                            {/* Bit adı VERİDİR, çevrilmez. */}
                            <span className="font-mono">{bit.bit}</span> {bit.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p
                    role="alert"
                    data-testid="vendor-map-decode-error"
                    className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
                  >
                    {t('definition.vendorMap.decode.tooShort')}{' '}
                    <span className="tabular font-mono">{decoded.result.requiredBytes}</span>
                  </p>
                )
              ) : null}
            </>
          )}

          <div>
            <button
              type="button"
              data-testid="vendor-map-export"
              onClick={handleExport}
              className={BUTTON_CLASS}
            >
              {t('definition.vendorMap.action.export')}
            </button>
          </div>
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
