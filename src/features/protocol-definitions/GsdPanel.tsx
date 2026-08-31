/**
 * Protokol sayfasındaki `definitions` sekmesinin GSD paneli.
 *
 * `XifPanel.tsx`in (o da `EdsPanel.tsx`in) deseni: panel HESAP YAPMAZ
 * (CLAUDE.md mimari kuralı), GSD metnini `parseGsd` çözer — kimlik baytlarının
 * giriş/çıkış uzunluğuna çevrilmesi dahil — panel yalnız gösterir. Ekran BOŞ
 * AÇILMAZ (spec §50): dosya yüklenmeden önce gerçek bir cihazın GSD'si
 * gösterilir. Kullanıcı verisi YERELDE KALIR (spec §41): `readTextFile`
 * `Blob.text()` ile okur.
 *
 * ── 🚨 "HEX ÇÖZ" ALT ARACI BİLİNÇLİ OLARAK YOK ──────────────────────────────
 * `EdsPanel` ham baytı seçili nesnenin `DataType`ına göre çözen bir alt araç
 * taşır. Burada AYNISI YAPILMADI. Karar XIF dalgasının `nvTypeNotOnWire`
 * muhakemesiyle aynı sınıf ama gerekçesi FARKLI — ve burada asıl yetenek
 * ZATEN modül tablosunun içinde:
 *
 * 1. **Eksik olan şey tip değil, YERLEŞİM — ve yerleşim GSD'de yazmıyor.**
 *    `profibusDp.ts` Data Exchange telgrafının kullanıcı verisini ham bırakıp
 *    `WARN_USER_DATA_NEEDS_GSD` basıyor: "hangi baytın hangi modülün
 *    girişi/çıkışı olduğu ÇERÇEVEDE YAZMAZ, GSD'deki modül ve I/O uzunluk
 *    bildiriminden gelir". Bu panel o bildirimin İKİNCİ yarısını GERÇEKTEN
 *    veriyor (aşağıdaki modül tablosunun Giriş/Çıkış/Yerleşim sütunları). Ama
 *    ÜÇÜNCÜ yarı GSD'de de yok: hangi modüllerin gerçekten takılı olduğu ve
 *    hangi sırayla oturduğu konfigürasyon aracında seçilir ve **Chk_Cfg
 *    telgrafıyla** taşınır. GSD yalnız SEÇENEKLERİ sayar.
 * 2. **ÖLÇÜLDÜ: seçenek sayısı takılabilecek modül sayısından fazla.** Açılış
 *    fixture'ı olan Siemens SINAMICS G120 dosyası `Max_Module = 2` diyor ama
 *    **7** modül tanımı taşıyor; yani en çok iki yuvaya yedi seçenekten
 *    hangilerinin oturduğunu dosya SÖYLEMİYOR. Bir "hex'i modüle göre böl"
 *    aracı kullanıcıdan ÖNCE bu konfigürasyonu bildirmesini isterdi ve sonucu
 *    GSD'nin DOĞRULADIĞI bir ölçümmüş gibi sunardı. Tam olarak
 *    `WARN_USER_DATA_NEEDS_GSD`in engellemeye çalıştığı şey.
 * 3. **Bağlanacak gerçek bir yakalama YOK.** `profibus-dp`nin `decode`
 *    sekmesindeki `sd2-data-exchange` örneği dört baytlık genel bir telgraftır,
 *    bu fixture'ın cihazından ALINMAMIŞTIR; Chk_Cfg telgrafı örnek kümesinde
 *    hiç yok. İki tarafı birbirine çözdürmek uydurma bir eşleşme üretirdi.
 *
 * Emsal: `XifPanel` ve `DbcPanel` de hex çöz aracı taşımaz. Onun yerine bu
 * panel modülün BAYT UZUNLUĞUNU ve YÖNÜNÜ — yani telde eksik olan tam bilgiyi —
 * gösterir ve konfigürasyonun bu dosyada olmadığını KOŞULSUZ yazar.
 */

import { useCallback, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { SAMPLE_GSD_TEXT } from '@/protocol-core/definitions/gsd/gsdFixture';
import { parseGsd, resolveGsdPrmTextValues } from '@/protocol-core/definitions/gsd/gsdParser';
import type {
  GsdBaudRate,
  GsdDatabase,
  GsdDiagnosisText,
  GsdExtUserPrmData,
  GsdIoBlock,
  GsdModule,
  GsdParseIssue,
  GsdPrmDataType,
} from '@/protocol-core/definitions/gsd/gsdTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Parametre tipi → çeviri anahtarı. Tip adları PROTOKOL TERİMİ, ham basılmaz. */
const PRM_DATA_TYPE_KEYS: Readonly<Record<GsdPrmDataType, TranslationKey>> = {
  bit: 'definition.gsd.type.bit',
  'bit-area': 'definition.gsd.type.bitArea',
  unsigned8: 'definition.gsd.type.unsigned8',
  unsigned16: 'definition.gsd.type.unsigned16',
  unsigned32: 'definition.gsd.type.unsigned32',
  signed8: 'definition.gsd.type.signed8',
  signed16: 'definition.gsd.type.signed16',
  signed32: 'definition.gsd.type.signed32',
};

/** `GsdParseIssue.messageKey` sözlükte varsa çevrilir — `XifPanel`inkiyle aynı. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

/** Baytlar dosyadaki yazımla (`0xE1 0xD5`) gösterilir — satırı bulmak kolay olsun. */
function formatBytes(bytes: readonly number[]): string {
  if (bytes.length === 0) return EMPTY_GLYPH;
  return bytes
    .map((byte) => `0x${byte.toString(HEX_RADIX).padStart(2, '0').toUpperCase()}`)
    .join(' ');
}

function formatIdentNumber(identNumber: number | undefined): string {
  if (identNumber === undefined) return EMPTY_GLYPH;
  return `0x${identNumber.toString(HEX_RADIX).padStart(4, '0').toUpperCase()}`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? EMPTY_GLYPH : String(value);
}

function IssueList({ issues }: { readonly issues: readonly GsdParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="gsd-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="gsd-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.gsd.line')} {issue.line}:{' '}
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

/** Tek bir I/O bloğunun okunur özeti: `Giriş 6 × word (12 B)`. */
function formatIoBlock(block: GsdIoBlock, t: (key: TranslationKey) => string): string {
  const direction = t(
    block.direction === 'input' ? 'definition.gsd.direction.input' : 'definition.gsd.direction.output',
  );
  const unit = t(block.unit === 'word' ? 'definition.gsd.unit.word' : 'definition.gsd.unit.byte');
  return `${direction} ${String(block.count)} × ${unit} (${String(block.lengthBytes)} B)`;
}

function ModuleTable({ modules }: { readonly modules: readonly GsdModule[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="gsd-module-table"
        className="w-full min-w-[60rem] border-collapse"
        aria-label={t('definition.gsd.table.modules')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.reference')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.configBytes')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.inputBytes')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.outputBytes')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.layout')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.info')}</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr
              key={`${String(module.line)}-${module.name}`}
              data-testid="gsd-module-row"
              data-module-reference={
                module.moduleReference === undefined ? '' : String(module.moduleReference)
              }
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatNumber(module.moduleReference)}
                {module.preset ? (
                  <span className="ml-1 text-xs text-muted">{t('definition.gsd.preset')}</span>
                ) : null}
              </td>
              {/* Modül adı VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-medium`}>{module.name}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`} data-testid="gsd-module-config-bytes">
                {formatBytes(module.configBytes)}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="gsd-module-input">
                {module.config.inputLengthBytes}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="gsd-module-output">
                {module.config.outputLengthBytes}
              </td>
              <td className={BODY_CELL_CLASS} data-testid="gsd-module-layout">
                {module.config.blocks.length === 0 ? (
                  <span className="text-muted">{t('definition.gsd.noIoData')}</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {module.config.blocks.map((block, index) => (
                      <li key={`${block.direction}-${String(index)}`} className="text-xs">
                        {formatIoBlock(block, t)}
                      </li>
                    ))}
                  </ul>
                )}
                {module.config.manufacturerBytes.length === 0 ? null : (
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {t('definition.gsd.manufacturerBytes')}{' '}
                    {formatBytes(module.config.manufacturerBytes)}
                  </p>
                )}
              </td>
              {/* Modülün kendi açıklaması, çevrilmez. */}
              <td className={BODY_CELL_CLASS}>
                {module.infoText === '' ? EMPTY_GLYPH : module.infoText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParameterTable({
  database,
  definitions,
}: {
  readonly database: GsdDatabase;
  readonly definitions: readonly GsdExtUserPrmData[];
}): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="gsd-parameter-table"
        className="w-full min-w-[52rem] border-collapse"
        aria-label={t('definition.gsd.table.parameters')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.reference')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.dataType')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.bits')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.defaultValue')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.range')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.choices')}</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((definition) => {
            const choices = resolveGsdPrmTextValues(database, definition);
            const bits =
              definition.bitFrom === undefined
                ? EMPTY_GLYPH
                : definition.bitTo === undefined || definition.bitTo === definition.bitFrom
                  ? String(definition.bitFrom)
                  : `${String(definition.bitFrom)}-${String(definition.bitTo)}`;
            const range =
              definition.minValue === undefined || definition.maxValue === undefined
                ? EMPTY_GLYPH
                : `${String(definition.minValue)} … ${String(definition.maxValue)}`;

            return (
              <tr
                key={`${String(definition.reference)}-${definition.name}`}
                data-testid="gsd-parameter-row"
                data-parameter-reference={String(definition.reference)}
                className="border-b border-line"
              >
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{definition.reference}</td>
                {/* Parametre adı VERİDİR, çevrilmez. */}
                <td className={`${BODY_CELL_CLASS} font-medium`}>{definition.name}</td>
                <td className={BODY_CELL_CLASS}>
                  {definition.dataType === undefined ? (
                    // Tanınmayan tipte ham satır basılır — uydurulmuş bir tip DEĞİL.
                    <span className="font-mono text-muted">
                      {definition.rawType === '' ? EMPTY_GLYPH : definition.rawType}
                    </span>
                  ) : (
                    t(PRM_DATA_TYPE_KEYS[definition.dataType])
                  )}
                </td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{bits}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                  {formatNumber(definition.defaultValue)}
                </td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{range}</td>
                <td className={BODY_CELL_CLASS} data-testid="gsd-parameter-choices">
                  {choices.length === 0 ? (
                    EMPTY_GLYPH
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {choices.map((choice) => (
                        <li key={`${String(choice.value)}-${choice.text}`} className="text-xs">
                          <span className="tabular font-mono">{choice.value}</span>
                          {' = '}
                          {/* Seçenek metni cihazın kendi verisidir, çevrilmez. */}
                          {choice.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BaudRateTable({ rates }: { readonly rates: readonly GsdBaudRate[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="gsd-baud-table"
        className="w-full min-w-[24rem] border-collapse"
        aria-label={t('definition.gsd.table.baudRates')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.baudRate')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.supported')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.maxTsdr')}</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr
              key={rate.label}
              data-testid="gsd-baud-row"
              data-baud-label={rate.label}
              className="border-b border-line"
            >
              {/* Hız etiketi GSD anahtarının kendisidir, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{rate.label}</td>
              <td className={BODY_CELL_CLASS}>{t(rate.supported ? 'common.yes' : 'common.no')}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatNumber(rate.maxTsdr)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosisTable({ texts }: { readonly texts: readonly GsdDiagnosisText[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="gsd-diagnosis-table"
        className="w-full min-w-[36rem] border-collapse"
        aria-label={t('definition.gsd.table.diagnosis')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.diagnosisCode')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.diagnosisType')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.gsd.column.diagnosisText')}</th>
          </tr>
        </thead>
        <tbody>
          {texts.map((entry) => (
            <tr
              key={`${String(entry.line)}-${String(entry.code)}`}
              data-testid="gsd-diagnosis-row"
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{entry.code}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {formatNumber(entry.unitDiagType)}
              </td>
              {/* Teşhis metni cihazın kendi verisidir, çevrilmez. */}
              <td className={BODY_CELL_CLASS}>{entry.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type GsdState =
  | {
      readonly status: 'ready';
      readonly database: GsdDatabase;
      readonly issues: readonly GsdParseIssue[];
      readonly sample: boolean;
    }
  | { readonly status: 'failed'; readonly issues: readonly GsdParseIssue[] };

function initialState(): GsdState {
  const result = parseGsd(SAMPLE_GSD_TEXT);
  return result.success
    ? { status: 'ready', database: result.database, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

function SummaryEntry({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

export function GsdPanel(): ReactNode {
  const { t } = useTranslation();

  const [state, setState] = useState<GsdState>(initialState);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);

  const database = state.status === 'ready' ? state.database : null;

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.gsd.error.readFailed');
      return;
    }
    const result = parseGsd(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ veritabanını silmez (`XifPanel` deseni).
      setImportErrorKey('definition.gsd.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    setState({ status: 'ready', database: result.database, issues: result.issues, sample: false });
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
    <div className="flex flex-col gap-4" data-testid="gsd-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="gsd-import" className="text-xs font-medium text-muted">
          {t('definition.gsd.action.import')}
        </label>
        <input
          id="gsd-import"
          data-testid="gsd-import"
          type="file"
          accept=".gsd,.gse,.gsg,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="gsd-import-error" className="text-sm text-danger">
          {t(importErrorKey as TranslationKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="gsd-sample-notice">
          {t('definition.gsd.sampleNotice')}
        </p>
      ) : null}

      {database === null ? (
        <p
          role="alert"
          data-testid="gsd-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.gsd.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="gsd-summary">
            {/* Üretici, model ve sipariş numarası VERİDİR, çevrilmez. */}
            <SummaryEntry
              label={t('definition.gsd.vendorName')}
              value={database.device.vendorName === '' ? EMPTY_GLYPH : database.device.vendorName}
              testId="gsd-vendor"
            />
            <SummaryEntry
              label={t('definition.gsd.modelName')}
              value={database.device.modelName === '' ? EMPTY_GLYPH : database.device.modelName}
              testId="gsd-model"
            />
            <SummaryEntry
              label={t('definition.gsd.orderNumber')}
              value={database.device.orderNumber === '' ? EMPTY_GLYPH : database.device.orderNumber}
              testId="gsd-order-number"
            />
            <SummaryEntry
              label={t('definition.gsd.identNumber')}
              value={formatIdentNumber(database.device.identNumber)}
              testId="gsd-ident-number"
            />
            <SummaryEntry
              label={t('definition.gsd.gsdRevision')}
              value={formatNumber(database.device.gsdRevision)}
              testId="gsd-revision"
            />
            <SummaryEntry
              label={t('definition.gsd.slaveFamily')}
              value={database.device.slaveFamily === '' ? EMPTY_GLYPH : database.device.slaveFamily}
              testId="gsd-slave-family"
            />
            <SummaryEntry
              label={t('definition.gsd.stationKind')}
              value={
                database.device.modularStation === undefined
                  ? EMPTY_GLYPH
                  : t(
                      database.device.modularStation
                        ? 'definition.gsd.station.modular'
                        : 'definition.gsd.station.compact',
                    )
              }
              testId="gsd-station-kind"
            />
            <SummaryEntry
              label={t('definition.gsd.moduleCount')}
              value={String(database.modules.length)}
              testId="gsd-module-count"
            />
            <SummaryEntry
              label={t('definition.gsd.maxInputLength')}
              value={formatNumber(database.device.maxInputLength)}
              testId="gsd-max-input"
            />
            <SummaryEntry
              label={t('definition.gsd.maxOutputLength')}
              value={formatNumber(database.device.maxOutputLength)}
              testId="gsd-max-output"
            />
          </dl>

          {database.device.infoText === '' ? null : (
            <p className="text-sm text-text" data-testid="gsd-device-info">
              {database.device.infoText}
            </p>
          )}

          {/*
            KOŞULSUZ uyarı — `XifPanel`in `typeNotOnWire` disiplini. Uzunluk ve
            yön burada YAZAR, hangi modülün takılı olduğu YAZMAZ.
          */}
          <p
            role="note"
            data-testid="gsd-config-not-in-file"
            className="rounded-token border border-line bg-warn-soft p-3 text-sm text-warn"
          >
            {t('definition.gsd.configurationNotInFile')}
          </p>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">{t('definition.gsd.table.modules')}</h3>
            <ModuleTable modules={database.modules} />
            <p className="text-xs text-muted" data-testid="gsd-identifier-note">
              {t('definition.gsd.identifierNote')}
            </p>
          </section>

          {database.parameterDefinitions.length === 0 ? (
            /* Basit biçimli dosyada `ExtUserPrmData` YOKTUR — boş tablo basmak yerine söyle. */
            <p className="text-xs text-muted" data-testid="gsd-simple-parameters">
              {t('definition.gsd.simpleParameterNote')}{' '}
              <span className="font-mono">{formatBytes(database.userPrmData)}</span>
            </p>
          ) : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">
                {t('definition.gsd.table.parameters')}
              </h3>
              <ParameterTable database={database} definitions={database.parameterDefinitions} />
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">
              {t('definition.gsd.table.baudRates')}
            </h3>
            <BaudRateTable rates={database.device.baudRates} />
          </section>

          {database.diagnosisTexts.length === 0 ? null : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">
                {t('definition.gsd.table.diagnosis')}
              </h3>
              <DiagnosisTable texts={database.diagnosisTexts} />
            </section>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
