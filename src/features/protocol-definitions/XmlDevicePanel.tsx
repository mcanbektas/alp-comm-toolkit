/**
 * `definitions` sekmesinin XML AYGIT TANIMI paneli — GSDML (PROFINET), IODD
 * (IO-Link) ve SCL (IEC 61850) için TEK panel.
 *
 * ── NEDEN TEK PANEL ─────────────────────────────────────────────────────────
 * Üç biçim ayrı standartlardan gelir ama sekmenin sorduğu soru aynı: bu
 * aygıtta hangi kalem var, hangi tipte, nerede duruyor. Üç panel yazmak aynı
 * tabloyu üç kez çizmek, üç kez çevirmek ve üç kez bakımını yapmak olurdu.
 * Biçim farkı `format` özelliğiyle taşınır ve YALNIZ örnek dosya seçimini
 * değiştirir; okuma işini `parseDeviceDescription` biçime göre kendi yapar.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): dosyayı
 * `parseDeviceDescription` çözer, değeri `decodeDeviceItem` okur.
 *
 * ── ÇÖZÜM BÖLÜMÜ HER KALEMDE AÇILMAZ ────────────────────────────────────────
 * SCL'in veri nesnelerinde bayt yerleşimi YOKTUR (değer bir yapılandırma
 * girdisidir, telde bir konum değil) ve bazı GSDML/IODD kalemleri de yerleşim
 * taşımaz. O kalemlerde hex kutusu açmak, olmayan bir hizalama varmış gibi
 * gösterirdi; bunun yerine nedeni yazılır.
 *
 * Ekran BOŞ AÇILMAZ (spec §50). Kullanıcı verisi YERELDE KALIR (spec §41).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SelectField } from '@/components/forms';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { parseDeviceDescription } from '@/protocol-core/definitions/xml-device/deviceDescriptionParser';
import {
  SAMPLE_GSDML_TEXT,
  SAMPLE_IODD_PROCESS_DATA,
  SAMPLE_IODD_TEXT,
  SAMPLE_SCL_TEXT,
} from '@/protocol-core/definitions/xml-device/deviceDescriptionFixture';
import type {
  DeviceDescription,
  DeviceDescriptionFormat,
  DeviceDescriptionIssue,
  DeviceItem,
  DeviceItemGroup,
} from '@/protocol-core/definitions/xml-device/deviceDescriptionTypes';
import { decodeDeviceItem, isDecodable } from '@/protocol-core/definitions/xml-device/deviceItemDecoder';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

/** Değeri olmayan hücrenin işareti; dile bağlı değil, çeviriye girmez. */
const EMPTY_GLYPH = '—';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Biçim adı ARAYÜZ metnidir; standardın kendi kısaltması korunur. */
const FORMAT_LABELS: Record<DeviceDescriptionFormat, string> = {
  gsdml: 'GSDML',
  iodd: 'IODD',
  scl: 'SCL',
};

const GROUP_LABEL_KEYS: Record<DeviceItemGroup, TranslationKey> = {
  parameter: 'definition.xmlDevice.group.parameter',
  'process-data': 'definition.xmlDevice.group.processData',
  'data-object': 'definition.xmlDevice.group.dataObject',
};

const SAMPLES: Record<DeviceDescriptionFormat, string> = {
  gsdml: SAMPLE_GSDML_TEXT,
  iodd: SAMPLE_IODD_TEXT,
  scl: SAMPLE_SCL_TEXT,
};

/** `messageKey` sözlükte varsa çevrilir — öteki panellerin aynı sözleşmesi. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

function spacedHex(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

type PanelState =
  | {
      readonly status: 'ready';
      readonly description: DeviceDescription;
      readonly issues: readonly DeviceDescriptionIssue[];
      readonly sample: boolean;
    }
  | { readonly status: 'failed'; readonly issues: readonly DeviceDescriptionIssue[] };

function initialState(format: DeviceDescriptionFormat): PanelState {
  const result = parseDeviceDescription(SAMPLES[format]);
  return result.success
    ? { status: 'ready', description: result.description, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function IssueList({ issues }: { issues: readonly DeviceDescriptionIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="xml-device-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="xml-device-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.xmlDevice.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : <span className="font-mono text-muted"> {issue.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function ItemTable({ items }: { items: readonly DeviceItem[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="xml-device-table"
        className="w-full min-w-[48rem] border-collapse"
        aria-label={t('definition.xmlDevice.table.items')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.id')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.group')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.dataType')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.layout')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xmlDevice.column.default')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              data-testid="xml-device-row"
              data-item-id={item.id}
              className="border-b border-line/60 last:border-b-0"
            >
              {/* Kimlik, ad, tip ve varsayılan VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>{item.id}</td>
              <td className={BODY_CELL_CLASS}>
                {item.name === '' ? EMPTY_GLYPH : item.name}
                {item.description === undefined ? null : (
                  <span className="block text-xs text-muted">{item.description}</span>
                )}
              </td>
              <td className={`${BODY_CELL_CLASS} text-xs text-muted`}>{t(GROUP_LABEL_KEYS[item.group])}</td>
              <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>
                {item.dataType === '' ? EMPTY_GLYPH : item.dataType}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs text-muted`}>
                {item.bitOffset === undefined
                  ? EMPTY_GLYPH
                  : `${String(item.bitOffset)}+${String(item.bitLength ?? 0)} bit`}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {item.defaultValue ?? EMPTY_GLYPH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface XmlDevicePanelProps {
  /** Kaydın bildirdiği biçim; YALNIZ örnek dosya seçimini belirler. */
  readonly format: DeviceDescriptionFormat;
}

export function XmlDevicePanel({ format }: XmlDevicePanelProps): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<PanelState>(() => initialState(format));
  const [selectedId, setSelectedId] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [importErrorKey, setImportErrorKey] = useState<
    'definition.xmlDevice.error.readFailed' | 'definition.xmlDevice.error.parseFailed' | null
  >(null);

  const description = state.status === 'ready' ? state.description : null;

  /**
   * Varsayılan seçim SÜREÇ VERİSİNE düşer, parametreye değil: örnek çerçeve
   * süreç verisinindir ve panel açılır açılmaz çözülmüş bir değer göstermeli.
   * Parametre önce seçilseydi, aynı baytlar onun tipiyle okunup alakasız bir
   * sayı basardı.
   */
  const selectedItem = useMemo(() => {
    if (description === null) return null;
    return (
      description.items.find((item) => item.id === selectedId) ??
      description.items.find((item) => item.group === 'process-data' && isDecodable(item)) ??
      description.items.find((item) => isDecodable(item)) ??
      description.items[0] ??
      null
    );
  }, [description, selectedId]);

  const decodable = selectedItem !== null && isDecodable(selectedItem);

  /**
   * Örnek dosyada IODD süreç verisinin baytları var; öteki iki biçimde örnek
   * çerçeve YOK (GSDML parametre kaydı ve SCL yapılandırması telde tek başına
   * dolaşmıyor), o yüzden kutu boş açılır.
   */
  const effectiveHex =
    hexInput === ''
      ? state.status === 'ready' &&
        state.sample &&
        description?.format === 'iodd' &&
        selectedItem?.group === 'process-data'
        ? spacedHex(SAMPLE_IODD_PROCESS_DATA)
        : ''
      : hexInput;

  const decoded = useMemo(() => {
    if (selectedItem === null || !decodable || effectiveHex.trim() === '') return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(effectiveHex);
    } catch {
      return { invalidHex: true } as const;
    }
    return { invalidHex: false, result: decodeDeviceItem(selectedItem, bytes) } as const;
  }, [selectedItem, decodable, effectiveHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.xmlDevice.error.readFailed');
      return;
    }
    const result = parseDeviceDescription(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ tanımı silmez.
      setImportErrorKey('definition.xmlDevice.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', description: result.description, issues: result.issues, sample: false });
    setSelectedId('');
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
    <div className="flex flex-col gap-4" data-testid="xml-device-panel" data-format={format}>
      <div className="flex flex-col gap-1">
        <label htmlFor="xml-device-import" className="text-xs font-medium text-muted">
          {t('definition.xmlDevice.action.import')}
        </label>
        <input
          id="xml-device-import"
          data-testid="xml-device-import"
          type="file"
          accept=".xml,.gsdml,.iodd,.scl,.icd,.scd,.cid,text/xml,application/xml"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
        <p className="text-xs text-muted">{t('definition.xmlDevice.importHint')}</p>
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="xml-device-import-error" className="text-sm text-danger">
          {t(importErrorKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="xml-device-sample-notice">
          {t('definition.xmlDevice.sampleNotice')}
        </p>
      ) : null}

      {description === null ? (
        <p
          role="alert"
          data-testid="xml-device-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.xmlDevice.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="xml-device-summary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.xmlDevice.format')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="xml-device-format">
                {FORMAT_LABELS[description.format]}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.xmlDevice.vendor')}
              </dt>
              {/* Üretici ve aygıt adı VERİDİR, çevrilmez. */}
              <dd className="font-mono text-sm text-text" data-testid="xml-device-vendor">
                {description.vendor === '' ? EMPTY_GLYPH : description.vendor}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.xmlDevice.device')}
              </dt>
              <dd className="font-mono text-sm text-text" data-testid="xml-device-device">
                {description.device === '' ? EMPTY_GLYPH : description.device}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">
                {t('definition.xmlDevice.itemCount')}
              </dt>
              <dd className="tabular font-mono text-sm text-text" data-testid="xml-device-item-count">
                {description.items.length}
              </dd>
            </div>
          </dl>

          {description.identity.length === 0 ? null : (
            <dl className="flex flex-wrap gap-4" data-testid="xml-device-identity">
              {description.identity.map((entry) => (
                <div key={entry.label} className="flex flex-col gap-0.5">
                  {/* Etiket dosyanın kendi terimidir (VendorID, configVersion), çevrilmez. */}
                  <dt className="text-xs uppercase tracking-wide text-muted">{entry.label}</dt>
                  <dd className="font-mono text-sm text-text">{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <ItemTable items={description.items} />

          {selectedItem === null ? null : (
            <>
              <SelectField
                id="xml-device-item"
                label={t('definition.xmlDevice.item.label')}
                value={selectedItem.id}
                onChange={(value) => {
                  setSelectedId(value);
                  setHexInput('');
                }}
                options={description.items.map((item) => ({
                  value: item.id,
                  label: item.name === '' ? item.id : `${item.id} — ${item.name}`,
                }))}
              />

              {decodable ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="xml-device-hex" className="text-xs font-medium text-muted">
                    {t('definition.xmlDevice.decodeHex.label')}
                  </label>
                  <textarea
                    id="xml-device-hex"
                    data-testid="xml-device-hex"
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
                    <p role="alert" data-testid="xml-device-hex-error" className="text-xs text-danger">
                      {t('decode.error.invalidHex')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted" data-testid="xml-device-no-layout">
                  {t('definition.xmlDevice.decode.noLayout')}
                </p>
              )}

              {decoded !== null && !decoded.invalidHex ? (
                decoded.result.success ? (
                  <dl className="flex flex-wrap gap-4" data-testid="xml-device-decoded">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {t('decode.column.raw')}
                      </dt>
                      <dd className="tabular font-mono text-sm text-text" data-testid="xml-device-raw">
                        {String(decoded.result.rawValue)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {t('definition.xmlDevice.column.value')}
                      </dt>
                      <dd className="tabular font-mono text-sm text-text" data-testid="xml-device-value">
                        {decoded.result.displayValue}
                        {decoded.result.unit === undefined ? '' : ` ${decoded.result.unit}`}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p
                    role="alert"
                    data-testid="xml-device-decode-error"
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
