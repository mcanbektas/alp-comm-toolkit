/**
 * Custom Protocol Studio ekranı — spec §9.7'nin dört panelli düzeni.
 *
 * Bu bileşen HESAP YAPMAZ: taslak→şema dönüşümü, doğrulama, ayrıştırma ve altı
 * kod üreticisi `useProtocolStudio` üzerinden saf modüllerden gelir. Buradaki
 * tek iş yerleşim, üst bilgi düzenlemesi ve panellerin birbirine bağlanması
 * (CLAUDE.md mimari kuralı).
 *
 * ## Ekranın kendi tuttuğu üç durum
 *
 * Hiçbiri taslaktan türetilemez, o yüzden hook'ta değil burada yaşar:
 * - `selectedRegionId`: bayt görüntüleyicide seçili bölge. Şemanın değil
 *   GÖRÜNTÜNÜN durumu; şema değişince anlamını yitirmesi de doğru davranış.
 * - `importErrorKey`: içe aktarma başarısızlığı. Tek seferlik olay, taslağa
 *   yansımaz — yansısaydı geçerli bir şemayı düzenlerken bile ekranda kalırdı.
 * - `announcementKey`: "Çözümle" düğmesinin ekran okuyucuya duyurusu (§42/5).
 *   Çözümleme zaten anlık; düğme spec maddesi ve odak/duyuru için var.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, SelectField, TextField } from '@/components/forms';
import type { SelectFieldOption } from '@/components/forms';
import type { Endianness } from '@/protocol-core/encoding/ieee754';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

import { FieldListPanel } from './components/FieldListPanel';
import { FieldPropertiesPanel } from './components/FieldPropertiesPanel';
import { FrameViewPanel } from './components/FrameViewPanel';
import { OutputPanel } from './components/OutputPanel';
import { FRAMING_TYPES, isFramingType } from './schemaDraft';
import type { DraftIssue, FieldDraft, FramingDraft, FramingType } from './schemaDraft';
import { useProtocolStudio } from './useProtocolStudio';

/** Dosya okuması başarısızsa gösterilecek anahtar; şema reddi ile aynı şey DEĞİL. */
const FILE_READ_ERROR_KEY = 'studio.error.fileReadFailed';

const NO_ISSUES: readonly DraftIssue[] = [];

const FRAMING_TYPE_KEYS: Readonly<Record<FramingType, TranslationKey>> = {
  startEnd: 'studio.framing.startEnd',
  startOnly: 'studio.framing.startOnly',
  fixedLength: 'studio.framing.fixedLength',
  lengthField: 'studio.framing.lengthField',
  none: 'studio.framing.none',
};

/** §42/10 — araca özgü sınırlar. Sıra ekrana basıldığı sıradır. */
const LIMITATION_KEYS: readonly TranslationKey[] = [
  'studio.help.limitations.generatedCodeNotExecuted',
  'studio.help.limitations.byteViewerLimit',
  'studio.help.limitations.encoderIgnoresOffset',
  'studio.help.limitations.bigintFields',
];

/** §42/3,4,5,6,7,8,12,13 — hangi maddenin ekranda nerede karşılandığı. */
const SECTION_MAP_KEYS: readonly TranslationKey[] = [
  'studio.help.sections.inputs',
  'studio.help.sections.sample',
  'studio.help.sections.action',
  'studio.help.sections.result',
  'studio.help.sections.formula',
  'studio.help.sections.steps',
  'studio.help.sections.copy',
  'studio.help.sections.export',
];

interface CommonErrorEntry {
  /** Hata metninin kendisi — §42'nin sabit İngilizce karşılıkları sözlükte duruyor. */
  readonly termKey: TranslationKey;
  readonly adviceKey: TranslationKey;
}

/** §42/11 — Studio'yu ilgilendiren yaygın hatalar ve ne yapılacağı. */
const COMMON_ERRORS: readonly CommonErrorEntry[] = [
  {
    termKey: 'studio.error.invalidHex',
    adviceKey: 'studio.help.commonErrors.invalidHexAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.lengthMismatch',
    adviceKey: 'studio.help.commonErrors.lengthMismatchAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.crcMismatch',
    adviceKey: 'studio.help.commonErrors.crcMismatchAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.startDelimiterNotFound',
    adviceKey: 'studio.help.commonErrors.startDelimiterAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.valueOutOfRange',
    adviceKey: 'studio.help.commonErrors.valueOutOfRangeAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.unsupportedFunctionCode',
    adviceKey: 'studio.help.commonErrors.unsupportedFunctionCodeAdvice',
  },
  {
    termKey: 'studio.output.parseError.code.circularLengthReference',
    adviceKey: 'studio.help.commonErrors.circularLengthAdvice',
  },
];

const BUTTON_CLASS =
  'rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const SECTION_CLASS = 'flex flex-col gap-3 rounded-token border border-line bg-surface p-4';
const COLUMN_CLASS = 'flex min-w-0 flex-col gap-3 rounded-token border border-line bg-surface p-4';
const HEADING_CLASS = 'font-display text-sm font-semibold uppercase tracking-wide text-muted';
const DETAILS_CLASS = 'rounded-token border border-line bg-raised p-3';
const SUMMARY_CLASS = 'cursor-pointer text-sm font-medium text-text';

/** Bayt listesi ayırıcısı: boşluk ya da virgül. Değerin kendisi ondalık ya da `0x..`. */
const BYTE_SEPARATOR = /[\s,]+/;

function parseByteListText(text: string): string[] {
  return text.split(BYTE_SEPARATOR).filter((token) => token !== '');
}

function toEndianness(value: string): Endianness | '' {
  return value === 'big' || value === 'little' ? value : '';
}

/**
 * Bölge kimliği ayrıştırılan alanın kimliğidir; iç içe alanlarda
 * `ata.cocuk` biçiminde birleşir. Kök parça taslakta aranacak addır.
 */
function rootFieldId(regionId: string): string {
  const separator = regionId.indexOf('.');
  return separator < 0 ? regionId : regionId.slice(0, separator);
}

function findDraftIdByFieldId(fields: readonly FieldDraft[], fieldId: string): string | null {
  for (const field of fields) {
    if (field.id === fieldId) {
      return field.draftId;
    }
    const nested = findDraftIdByFieldId(field.fields, fieldId);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

interface ByteListFieldProps {
  readonly id: string;
  readonly label: string;
  readonly values: readonly string[];
  readonly error?: string;
  readonly onChange: (values: string[]) => void;
}

/**
 * Çerçeveleme baytları tek satırda düzenlenir ama taslakta LİSTE olarak durur.
 *
 * Metin YEREL tutulur, `values.join(' ')`ten her render'da yeniden kurulmaz:
 * kurulsaydı kullanıcı ikinci baytı yazmak için boşluğa bastığı anda ayırıcı
 * silinir ve daha fazla bayt yazmak imkânsız olurdu.
 */
function ByteListField({ id, label, values, error, onChange }: ByteListFieldProps): ReactNode {
  const joined = values.join(' ');
  const [text, setText] = useState<string>(joined);

  // Taslak DIŞARIDAN değişebilir (JSON içe aktarma, örneğe dönüş). Karşılaştırma
  // ayrıştırılmış liste üzerinden yapılır: kullanıcının ara yazımı ("AA " gibi
  // sondaki boşluk) aynı listeyi veriyorsa metne dokunulmaz.
  useEffect(() => {
    setText((current) => (parseByteListText(current).join(' ') === joined ? current : joined));
  }, [joined]);

  return (
    <TextField
      id={id}
      label={label}
      value={text}
      error={error}
      monospace
      onChange={(next: string) => {
        setText(next);
        onChange(parseByteListText(next));
      }}
    />
  );
}

export function ProtocolStudioScreen(): ReactNode {
  const { t } = useTranslation();
  const studio = useProtocolStudio();
  const { draft, draftIssues, selectField, updateMeta } = studio;

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);
  const [announcementKey, setAnnouncementKey] = useState<TranslationKey | null>(null);

  const outputSectionRef = useRef<HTMLElement | null>(null);

  /**
   * Sorunlar bir kez gruplanır: alan listesi her satır için ayrı süzseydi
   * maliyet alan sayısıyla kareselleşirdi (bkz. `FieldListPanelProps` yorumu).
   */
  const issuesByDraftId = useMemo<ReadonlyMap<string, readonly DraftIssue[]>>(() => {
    const grouped = new Map<string, DraftIssue[]>();
    for (const issue of draftIssues) {
      if (issue.draftId === null) {
        continue;
      }
      const bucket = grouped.get(issue.draftId);
      if (bucket === undefined) {
        grouped.set(issue.draftId, [issue]);
      } else {
        bucket.push(issue);
      }
    }
    return grouped;
  }, [draftIssues]);

  /**
   * Alana bağlanamayan (şema düzeyi) sorunlar üst şeride aittir: adı boş
   * bırakan kullanıcı hatayı yazdığı yerde görmeli, çıktı sekmesinde değil.
   */
  const metaIssueByField = useMemo<ReadonlyMap<string, DraftIssue>>(() => {
    const map = new Map<string, DraftIssue>();
    for (const issue of draftIssues) {
      if (issue.draftId !== null || map.has(issue.field)) {
        continue;
      }
      map.set(issue.field, issue);
    }
    return map;
  }, [draftIssues]);

  const metaIssueText = (field: string): string | undefined => {
    const issue = metaIssueByField.get(field);
    return issue === undefined ? undefined : t(issue.messageKey, issue.params);
  };

  const selectedIssues =
    studio.selectedDraftId === null
      ? NO_ISSUES
      : (issuesByDraftId.get(studio.selectedDraftId) ?? NO_ISSUES);

  const framingOptions = useMemo<readonly SelectFieldOption[]>(
    () => FRAMING_TYPES.map((type) => ({ value: type, label: t(FRAMING_TYPE_KEYS[type]) })),
    [t],
  );

  const endiannessOptions = useMemo<readonly SelectFieldOption[]>(
    () => [
      { value: '', label: t('studio.option.auto') },
      { value: 'big', label: t('studio.option.endianBig') },
      { value: 'little', label: t('studio.option.endianLittle') },
    ],
    [t],
  );

  const framing: FramingDraft = draft.framing;

  const updateFraming = useCallback(
    (patch: Partial<FramingDraft>): void => {
      // `updateMeta` sığ birleştirir; çerçeveleme nesnesi bütün olarak verilmeli.
      updateMeta({ framing: { ...framing, ...patch } });
    },
    [framing, updateMeta],
  );

  const handleSelectRegion = useCallback(
    (regionId: string | null): void => {
      setSelectedRegionId(regionId);
      if (regionId === null) {
        return;
      }
      // Bayta tıklamak alanı da seçer: kullanıcı çerçevede gördüğü baytın
      // özelliklerine tek adımda ulaşmalı.
      const draftId =
        findDraftIdByFieldId(draft.fields, regionId) ??
        findDraftIdByFieldId(draft.fields, rootFieldId(regionId));
      if (draftId !== null) {
        selectField(draftId);
      }
    },
    [draft.fields, selectField],
  );

  const handleImportFile = useCallback(
    async (file: File): Promise<void> => {
      let text: string;
      try {
        text = await readTextFile(file);
      } catch {
        // Dosya okunamadı (izin, silinmiş dosya): şema reddiyle aynı mesajı
        // basmak yanıltıcı olurdu — içerik hiç görülmedi.
        setImportErrorKey(FILE_READ_ERROR_KEY);
        return;
      }
      const outcome = studio.loadSchemaJson(text);
      setImportErrorKey(outcome.ok ? null : outcome.errorKey);
    },
    [studio],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      // Girdi sıfırlanır: aynı dosya ikinci kez seçildiğinde de olay doğsun.
      event.target.value = '';
      if (file === undefined) {
        return;
      }
      void handleImportFile(file);
    },
    [handleImportFile],
  );

  const handleReset = useCallback((): void => {
    studio.resetToSpecFixture();
    setImportErrorKey(null);
    setSelectedRegionId(null);
  }, [studio]);

  /**
   * §42/5 — çözümleme anlıktır (taslak değişir değişmez zincir yeniden koşar),
   * ama açık bir eylem düğmesi olmadan maddenin karşılığı yok. Düğme sonucu
   * DUYURUR ve çıktıya kaydırır; hesabı tetiklemez.
   */
  const handleAnalyze = useCallback((): void => {
    const nextKey: TranslationKey =
      studio.schema === null
        ? 'studio.analyze.blocked'
        : studio.parseResult === null
          ? 'studio.analyze.empty'
          : studio.parseResult.success
            ? 'studio.analyze.done'
            : 'studio.analyze.failed';
    setAnnouncementKey(nextKey);

    const output = outputSectionRef.current;
    // jsdom'da ve ölçüm API'si olmayan ortamlarda tanımsız; çağırmak fırlatır.
    if (output !== null && typeof output.scrollIntoView === 'function') {
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [studio.parseResult, studio.schema]);

  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">
          {t('studio.title')}
        </h1>
        <p className="max-w-4xl text-sm text-muted">{t('studio.intro')}</p>
        <p className="max-w-4xl text-xs text-muted">{t('studio.privacy')}</p>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>{t('studio.section.schemaMeta')}</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="studio-meta-name"
            label={t('studio.frame.name')}
            value={draft.name}
            error={metaIssueText('name')}
            onChange={(value: string) => {
              updateMeta({ name: value });
            }}
          />
          <TextField
            id="studio-meta-version"
            label={t('studio.frame.version')}
            value={draft.version}
            error={metaIssueText('version')}
            onChange={(value: string) => {
              updateMeta({ version: value });
            }}
          />
          <SelectField
            id="studio-meta-endianness"
            label={t('studio.field.endianness')}
            value={draft.defaultEndianness}
            options={endiannessOptions}
            onChange={(value: string) => {
              updateMeta({ defaultEndianness: toEndianness(value) });
            }}
          />
          <SelectField
            id="studio-meta-framing"
            label={t('studio.frame.framing')}
            value={framing.type}
            options={framingOptions}
            onChange={(value: string) => {
              // Seçenek listesi dışından gelen değer sessizce state'e girmesin.
              if (isFramingType(value)) {
                updateFraming({ type: value });
              }
            }}
          />
          <ByteListField
            id="studio-meta-start-bytes"
            label={t('studio.frame.startBytes')}
            values={framing.startBytes}
            error={metaIssueText('framing.startBytes')}
            onChange={(values: string[]) => {
              updateFraming({ startBytes: values });
            }}
          />
          <ByteListField
            id="studio-meta-end-bytes"
            label={t('studio.frame.endBytes')}
            values={framing.endBytes}
            error={metaIssueText('framing.endBytes')}
            onChange={(values: string[]) => {
              updateFraming({ endBytes: values });
            }}
          />
          <NumberField
            id="studio-meta-max-length"
            label={t('studio.meta.maximumFrameLength')}
            value={framing.maximumFrameLength}
            error={metaIssueText('framing.maximumFrameLength')}
            onChange={(value: string) => {
              updateFraming({ maximumFrameLength: value });
            }}
          />
          <TextField
            id="studio-meta-description"
            label={t('studio.field.description')}
            value={draft.description}
            multiline
            onChange={(value: string) => {
              updateMeta({ description: value });
            }}
          />
        </div>

        <p className="text-xs text-muted">{t('studio.meta.byteListHint')}</p>

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="studio-import-schema" className="text-xs font-medium text-muted">
                {t('studio.action.importSchema')}
              </label>
              <input
                id="studio-import-schema"
                data-testid="studio-import-schema"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <button
              type="button"
              data-testid="studio-reset-fixture"
              className={BUTTON_CLASS}
              onClick={handleReset}
            >
              {t('studio.action.resetToSample')}
            </button>
            <button
              type="button"
              data-testid="studio-analyze"
              className={BUTTON_CLASS}
              onClick={handleAnalyze}
            >
              {t('studio.action.analyze')}
            </button>
          </div>

          <p className="text-xs text-muted">{t('studio.action.sampleHint')}</p>

          {importErrorKey === null ? null : (
            <p role="alert" data-testid="studio-import-error" className="text-xs text-danger">
              {/* `errorKey` sözleşmede düz `string`; sözlük anahtarına daraltıldığı tek yer burası. */}
              {t(importErrorKey as TranslationKey)}
            </p>
          )}

          <p
            role="status"
            aria-live="polite"
            data-testid="studio-analyze-announcement"
            data-message-key={announcementKey ?? ''}
            className="text-xs text-muted"
          >
            {announcementKey === null ? '' : t(announcementKey)}
          </p>
        </div>
      </section>

      {/* `items-start`: sağ panel açık bir alanın 23 özelliğiyle uzayınca grid'in
          varsayılan `stretch`i sol ve orta sütunu da o boya çekiyor ve altlarında
          yüzlerce piksel boş kutu bırakıyordu. Her sütun kendi boyunda dursun. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <section className={COLUMN_CLASS}>
          <h2 className={HEADING_CLASS}>{t('studio.fieldList.title')}</h2>
          <FieldListPanel
            draft={draft}
            selectedDraftId={studio.selectedDraftId}
            issuesByDraftId={issuesByDraftId}
            onSelect={selectField}
            onAdd={studio.addField}
            onRemove={studio.removeField}
            onDuplicate={studio.duplicateField}
            onMove={studio.moveField}
          />
        </section>

        <section className={COLUMN_CLASS}>
          <h2 className={HEADING_CLASS}>{t('studio.frame.title')}</h2>
          <FrameViewPanel
            bytes={studio.sampleBytes}
            regions={studio.regions}
            hexInput={studio.sampleHex}
            hexErrorKey={studio.hexErrorKey}
            selectedRegionId={selectedRegionId}
            onHexInputChange={studio.setSampleHex}
            onSelectRegion={handleSelectRegion}
          />
        </section>

        <section className={COLUMN_CLASS}>
          <h2 className={HEADING_CLASS}>{t('studio.section.properties')}</h2>
          <FieldPropertiesPanel
            field={studio.selectedField}
            issues={selectedIssues}
            onChange={(patch) => {
              if (studio.selectedDraftId !== null) {
                studio.updateField(studio.selectedDraftId, patch);
              }
            }}
          />
        </section>
      </div>

      <section className={SECTION_CLASS} ref={outputSectionRef} data-testid="studio-output-section">
        <h2 className={HEADING_CLASS}>{t('studio.section.output')}</h2>
        <OutputPanel
          parseResult={studio.parseResult}
          draftIssues={draftIssues}
          schemaIssues={studio.schemaIssues}
          artifacts={studio.artifacts}
          schemaName={draft.name}
        />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>{t('studio.section.guide')}</h2>

        <details className={DETAILS_CLASS} data-testid="studio-help-purpose">
          <summary className={SUMMARY_CLASS}>{t('studio.help.purpose.title')}</summary>
          <p className="mt-2 text-sm text-muted">{t('studio.help.purpose.body')}</p>
        </details>

        <details className={DETAILS_CLASS} data-testid="studio-help-protocols">
          <summary className={SUMMARY_CLASS}>{t('studio.help.protocols.title')}</summary>
          <p className="mt-2 text-sm text-muted">{t('studio.help.protocols.body')}</p>
        </details>

        <details className={DETAILS_CLASS} data-testid="studio-help-sections">
          <summary className={SUMMARY_CLASS}>{t('studio.help.sections.title')}</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {SECTION_MAP_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </details>

        <details className={DETAILS_CLASS} data-testid="studio-help-interpretation">
          <summary className={SUMMARY_CLASS}>{t('studio.help.interpretation.title')}</summary>
          <p className="mt-2 text-sm text-muted">{t('studio.help.interpretation.body')}</p>
        </details>

        <details className={DETAILS_CLASS} data-testid="studio-help-limitations">
          <summary className={SUMMARY_CLASS}>{t('studio.help.limitations.title')}</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {LIMITATION_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </details>

        <details className={DETAILS_CLASS} data-testid="studio-help-common-errors">
          <summary className={SUMMARY_CLASS}>{t('studio.help.commonErrors.title')}</summary>
          <dl className="mt-2 flex flex-col gap-2 text-sm">
            {COMMON_ERRORS.map((entry) => (
              <div key={entry.termKey} className="flex flex-col gap-0.5">
                <dt className="font-mono text-xs text-danger">{t(entry.termKey)}</dt>
                <dd className="text-muted">{t(entry.adviceKey)}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </div>
  );
}
