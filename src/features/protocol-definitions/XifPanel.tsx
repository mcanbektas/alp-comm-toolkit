/**
 * Protokol sayfasındaki `definitions` sekmesinin XIF paneli.
 *
 * `EdsPanel.tsx`in deseni: panel HESAP YAPMAZ (CLAUDE.md mimari kuralı), XIF
 * metnini `parseXif` çözer, panel yalnız gösterir. Ekran BOŞ AÇILMAZ (spec
 * §50): dosya yüklenmeden önce gerçek bir cihazın XIF'i gösterilir. Kullanıcı
 * verisi YERELDE KALIR (spec §41): `readTextFile` `Blob.text()` ile okur.
 *
 * ── 🚨 "HEX ÇÖZ" ALT ARACI BİLİNÇLİ OLARAK YOK ──────────────────────────────
 * `EdsPanel` ham baytı seçili nesnenin `DataType`ına göre çözen bir alt araç
 * taşır. Burada AYNISI YAPILMADI ve gerekçe üç katmanlı:
 *
 * 1. **EDS'te nesne TELDE adreslenir, XIF'te NV adreslenmez.** CANopen SDO
 *    çerçevesi Index ve Sub-index'i AÇIKÇA taşır, dolayısıyla "bu baytlar bu
 *    nesnenindir" bir ÖLÇÜMDÜR. LonTalk NV mesajı yalnız 14 bitlik bir
 *    SELECTOR taşır; selector cihazın bağlama tablosundaki bir indekstir, NV
 *    indeksi DEĞİLDİR ve tip hiç değildir (`lonworks.ts`in `nvTypeNotOnWire`
 *    uyarısı). Buraya bir çözme aracı koymak kullanıcıdan İKİ bildirim üst üste
 *    isterdi (hangi baytlar + hangi NV) ve sonucu XIF'in DOĞRULADIĞI bir
 *    ölçümmüş gibi sunardı. Tam olarak `nvTypeNotOnWire`in engellediği şey.
 *
 * 2. **ÖLÇÜLDÜ: gerçek cihazda çözülebilir NV azınlıkta.** Açılış fixture'ı
 *    olan gerçek WattNode XIF'inde 28 NV'nin **23'ü çok elemanlı yapı/union**;
 *    deponun `SNVT_SCALAR_TYPES` tablosu (221 tipin skaler olan 75'i) bunların
 *    HİÇBİRİNİ çözemez. İndeksi tabloda karşılığı olan NV sayısı **4/28**
 *    (%14, dördü de `SNVT_count`). Kalan %86'da araç ya sessizce boş kalır ya
 *    da yanlış çözer.
 *
 * 3. **Yetenek zaten DOĞRU yerde var.** `lonworks`un `decode` sekmesi bir
 *    `nvType` `decodeOptions` kanalı taşır ve GERÇEK yakalanmış çerçeveyi
 *    çözer, üstelik `nvTypeNotOnWire` uyarısını KOŞULSUZ basar. İkinci bir
 *    bildirim noktası açmak ikisinin ayrışmasına davetiye olurdu.
 *
 * Karşı emsal (2026-08-31'de DÜZELTİLDİ — bu satır önce "`DbcPanel` de hex çöz
 * aracı taşımaz" diyordu ve YANLIŞTI): `DbcPanel` bir çöz aracı TAŞIR
 * (`dbc-sample-hex` → `decodeDbcMessage` → `dbc-decoded-table`), `LdfPanel` de
 * öyle. İkisinde de tip VE yerleşim dosyada, çerçeve de telden adreslenebiliyor;
 * ayrım tam olarak budur. Burada üçü de tutmadığı için araç YOK: bu panel tip
 * bilgisini GÖSTERİR ve telde doğrulanamayacağını KOŞULSUZ yazar.
 */

import { useCallback, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import { SAMPLE_XIF_TEXT } from '@/protocol-core/definitions/xif/xifFixture';
import { parseXif, selectXifConfigProperties } from '@/protocol-core/definitions/xif/xifParser';
import type {
  XifConfigFile,
  XifDatabase,
  XifMessageTag,
  XifNetworkVariable,
  XifParseIssue,
} from '@/protocol-core/definitions/xif/xifTypes';
import { SNVT_SCALAR_TYPES } from '@/protocols/building/lonworks/snvtTypes';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

const EMPTY_GLYPH = '—';

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** `XifParseIssue.messageKey` sözlükte varsa çevrilir — `EdsPanel`in `translateIssue`ıyla aynı. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

/**
 * SNVT indeksi HER ZAMAN basılır (dosyanın kendi verisi); adı YALNIZ deponun
 * skaler tablosunda karşılığı varsa eklenir.
 *
 * TUZAK: tablo 221 SNVT'nin yalnız skaler olan 75'ini taşır, o yüzden "adı yok"
 * ile "tanımsız tip" AYNI ŞEY DEĞİLDİR. İndeksi her satırda basmak bu
 * karışıklığı yapısal olarak engelliyor — adsız satır da eksiksiz bir veri
 * taşıyor. `definition.xif.snvtTableNote` bunu ayrıca yazar.
 */
function formatSnvt(snvtIndex: number, unvtLabel: string): string {
  // 0 = kullanıcı tanımlı tip; SNVT indeksi DEĞİL.
  if (snvtIndex === 0) return unvtLabel;
  const known = SNVT_SCALAR_TYPES.find((type) => type.index === snvtIndex);
  const label = `#${String(snvtIndex)}`;
  return known === undefined ? label : `${label} · ${known.name}`;
}

function IssueList({ issues }: { issues: readonly XifParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="xif-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="xif-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.xif.line')} {issue.line}:{' '}
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

function NetworkVariableTable({
  variables,
}: {
  readonly variables: readonly XifNetworkVariable[];
}): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="xif-nv-table"
        className="w-full min-w-[56rem] border-collapse"
        aria-label={t('definition.xif.table.networkVariables')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.index')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.direction')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.snvt')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.elements')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.arraySize')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.class')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.documentation')}</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((variable) => (
            <tr
              key={`${String(variable.index)}-${variable.name}`}
              data-testid="xif-nv-row"
              data-nv-index={String(variable.index)}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{variable.index}</td>
              {/* Programatik ad VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-medium`}>{variable.name}</td>
              <td className={BODY_CELL_CLASS}>
                {t(
                  variable.direction === 'input'
                    ? 'definition.xif.direction.input'
                    : 'definition.xif.direction.output',
                )}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>
                {formatSnvt(variable.snvtIndex, t('definition.xif.userDefinedType'))}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{variable.elementCount}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {variable.arraySize === 0 ? EMPTY_GLYPH : variable.arraySize}
              </td>
              <td className={BODY_CELL_CLASS}>
                {t(
                  variable.configClass
                    ? 'definition.xif.class.config'
                    : 'definition.xif.class.network',
                )}
              </td>
              {/* Self-documentation cihazın kendi metnidir, çevrilmez. */}
              <td className={BODY_CELL_CLASS}>
                {variable.selfDocumentation === '' ? EMPTY_GLYPH : variable.selfDocumentation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigPropertyTable({
  properties,
}: {
  readonly properties: readonly XifNetworkVariable[];
}): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="xif-config-property-table"
        className="w-full min-w-[44rem] border-collapse"
        aria-label={t('definition.xif.table.configProperties')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.index')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.snvt')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.service')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.defaultValue')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.documentation')}</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr
              key={`${String(property.index)}-${property.name}`}
              data-testid="xif-config-property-row"
              data-nv-index={String(property.index)}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{property.index}</td>
              <td className={`${BODY_CELL_CLASS} font-medium`}>{property.name}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`}>
                {formatSnvt(property.snvtIndex, t('definition.xif.userDefinedType'))}
              </td>
              <td className={BODY_CELL_CLASS}>
                {property.serviceType === undefined
                  ? EMPTY_GLYPH
                  : t(`definition.xif.service.${property.serviceType}`)}
              </td>
              <td className={`${BODY_CELL_CLASS} font-mono`} data-testid="xif-config-default">
                {property.defaultValue === undefined
                  ? EMPTY_GLYPH
                  : bytesToHex(Uint8Array.from(property.defaultValue))}
              </td>
              <td className={BODY_CELL_CLASS}>
                {property.selfDocumentation === '' ? EMPTY_GLYPH : property.selfDocumentation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageTagTable({ tags }: { readonly tags: readonly XifMessageTag[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="xif-message-tag-table"
        className="w-full min-w-[28rem] border-collapse"
        aria-label={t('definition.xif.table.messageTags')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.index')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.bindable')}</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr
              key={`${String(tag.index)}-${tag.name}`}
              data-testid="xif-message-tag-row"
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{tag.index}</td>
              <td className={`${BODY_CELL_CLASS} font-medium`}>{tag.name}</td>
              <td className={BODY_CELL_CLASS}>{t(tag.bindable ? 'common.yes' : 'common.no')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigFileTable({ files }: { readonly files: readonly XifConfigFile[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table
          data-testid="xif-config-file-table"
          className="w-full min-w-[36rem] border-collapse"
          aria-label={t('definition.xif.table.configFiles')}
        >
          <thead>
            <tr>
              <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.name')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.fileIndex')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.fileType')}</th>
              <th className={HEADER_CELL_CLASS}>{t('definition.xif.column.length')}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={`${String(file.index)}-${file.name}`}
                data-testid="xif-config-file-row"
                className="border-b border-line"
              >
                <td className={`${BODY_CELL_CLASS} font-medium`}>{file.name}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{file.index}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{file.type}</td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                  {file.declaredLength ?? file.contents.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Şablon dosyasının İÇİNDEKİ CP kayıtları ÇÖZÜLMEZ — ayrı bir spesifikasyon. */}
      <p className="text-xs text-muted" data-testid="xif-config-file-note">
        {t('definition.xif.configFileNote')}
      </p>
    </div>
  );
}

type XifState =
  | {
      readonly status: 'ready';
      readonly database: XifDatabase;
      readonly issues: readonly XifParseIssue[];
      readonly sample: boolean;
    }
  | { readonly status: 'failed'; readonly issues: readonly XifParseIssue[] };

function initialState(): XifState {
  const result = parseXif(SAMPLE_XIF_TEXT);
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

export function XifPanel(): ReactNode {
  const { t } = useTranslation();

  const [state, setState] = useState<XifState>(initialState);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);

  const database = state.status === 'ready' ? state.database : null;

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.xif.error.readFailed');
      return;
    }
    const result = parseXif(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ veritabanını silmez (`EdsPanel` deseni).
      setImportErrorKey('definition.xif.error.parseFailed');
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

  const configProperties = database === null ? [] : selectXifConfigProperties(database);

  return (
    <div className="flex flex-col gap-4" data-testid="xif-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="xif-import" className="text-xs font-medium text-muted">
          {t('definition.xif.action.import')}
        </label>
        <input
          id="xif-import"
          data-testid="xif-import"
          type="file"
          accept=".xif,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="xif-import-error" className="text-sm text-danger">
          {t(importErrorKey as TranslationKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="xif-sample-notice">
          {t('definition.xif.sampleNotice')}
        </p>
      ) : null}

      {database === null ? (
        <p
          role="alert"
          data-testid="xif-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.xif.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="xif-summary">
            {/* Dosya adı, program ID ve cihaz metni VERİDİR, çevrilmez. */}
            <SummaryEntry
              label={t('definition.xif.fileName')}
              value={database.fileInfo.fileName === '' ? EMPTY_GLYPH : database.fileInfo.fileName}
              testId="xif-file-name"
            />
            <SummaryEntry
              label={t('definition.xif.programId')}
              value={database.device.programId}
              testId="xif-program-id"
            />
            <SummaryEntry
              label={t('definition.xif.formatVersion')}
              value={
                database.fileInfo.formatVersion === '' ? EMPTY_GLYPH : database.fileInfo.formatVersion
              }
              testId="xif-format-version"
            />
            <SummaryEntry
              label={t('definition.xif.nvCount')}
              value={String(database.networkVariables.length)}
              testId="xif-nv-count"
            />
            <SummaryEntry
              label={t('definition.xif.configPropertyCount')}
              value={String(configProperties.length)}
              testId="xif-config-property-count"
            />
            <SummaryEntry
              label={t('definition.xif.messageTagCount')}
              value={String(database.messageTags.length)}
              testId="xif-message-tag-count"
            />
            <SummaryEntry
              label={t('definition.xif.channelBitRate')}
              value={
                database.device.channelBitRate === undefined
                  ? EMPTY_GLYPH
                  : String(database.device.channelBitRate)
              }
              testId="xif-channel-bit-rate"
            />
          </dl>

          {database.device.selfDocumentation === '' ? null : (
            <p className="text-sm text-text" data-testid="xif-device-documentation">
              {database.device.selfDocumentation}
            </p>
          )}

          {/*
            KOŞULSUZ uyarı — `lonworks.ts`in `nvTypeNotOnWire` disiplini. Tip
            burada GÖSTERİLİR ama yakalanmış bir çerçeveden DOĞRULANAMAZ.
          */}
          <p
            role="note"
            data-testid="xif-type-not-on-wire"
            className="rounded-token border border-line bg-warn-soft p-3 text-sm text-warn"
          >
            {t('definition.xif.typeNotOnWire')}
          </p>

          <NetworkVariableTable variables={database.networkVariables} />
          <p className="text-xs text-muted" data-testid="xif-snvt-table-note">
            {t('definition.xif.snvtTableNote')}
          </p>

          {configProperties.length === 0 ? null : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">
                {t('definition.xif.table.configProperties')}
              </h3>
              <ConfigPropertyTable properties={configProperties} />
            </section>
          )}

          {database.messageTags.length === 0 ? null : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">
                {t('definition.xif.table.messageTags')}
              </h3>
              <MessageTagTable tags={database.messageTags} />
            </section>
          )}

          {database.configFiles.length === 0 ? null : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">
                {t('definition.xif.table.configFiles')}
              </h3>
              <ConfigFileTable files={database.configFiles} />
            </section>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}
