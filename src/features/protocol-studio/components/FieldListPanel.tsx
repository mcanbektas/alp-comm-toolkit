/**
 * Custom Protocol Studio'nun SOL paneli — spec §9.7'nin altı maddesi:
 * çerçeve yapısı, alan listesi, alan ekleme, sürükleyerek sıralama, koşullu
 * alanlar ve tekrarlanan yapılar.
 *
 * Panel HESAP YAPMAZ ve taslağı KENDİ DEĞİŞTİRMEZ: gelen `SchemaDraft`i çizer,
 * her isteği geri çağırımla dışarı verir (CLAUDE.md mimari kuralı). Şema
 * üretimi, doğrulama ve mutasyon `schemaDraft.ts`in saf fonksiyonlarındadır.
 *
 * Çerçeve üst bilgisi burada SALT OKUNURDUR. Düzenlemesi ekranın üst şeridinde
 * durur; aynı alanı iki yerde düzenletmek iki ayrı doğruluk kaynağı demek olur,
 * kullanıcı hangisinin geçerli olduğunu bilemezdi.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { SeriesColorIndex } from '@/components/byte-viewer';
import { ReorderableList } from '@/components/forms';
import { isCompositeField } from '@/protocol-core/schemas/fieldTypes';
import type { TranslationKey } from '@/translations';
import type { DraftIssue, FieldDraft, FramingType, SchemaDraft } from '../schemaDraft';

export interface FieldListPanelProps {
  readonly draft: SchemaDraft;
  readonly selectedDraftId: string | null;
  readonly issuesByDraftId: ReadonlyMap<string, readonly DraftIssue[]>;
  readonly onSelect: (draftId: string | null) => void;
  readonly onAdd: (parentDraftId: string | null) => void;
  readonly onRemove: (draftId: string) => void;
  readonly onDuplicate: (draftId: string) => void;
  readonly onMove: (parentDraftId: string | null, fromIndex: number, toIndex: number) => void;
}

/** Değeri olmayan alanın işareti; dile bağlı olmadığı için çeviriye girmez. */
const PLACEHOLDER = '—';

/**
 * Renk sınıfları TAM LİTERAL yazılmak zorunda: Tailwind kaynağı statik tarar,
 * `` `text-series-${i}` `` gibi bir şablon üretilen CSS'e hiç girmez
 * (bkz. ByteViewer.tsx).
 */
const SERIES_TEXT_CLASS: Record<SeriesColorIndex, string> = {
  0: 'text-series-1',
  1: 'text-series-2',
  2: 'text-series-3',
  3: 'text-series-4',
};

const SERIES_CYCLE: readonly SeriesColorIndex[] = [0, 1, 2, 3];

/** Renk alanın SIRASINDAN gelir; aynı seviyedeki komşular hep farklı renktedir. */
function seriesIndexFor(order: number): SeriesColorIndex {
  return SERIES_CYCLE[order % SERIES_CYCLE.length] ?? 0;
}

/**
 * Record olarak yazıldı: `FramingType`a yeni bir tip eklenirse burada DERLEME
 * HATASI çıkar, düz bir tablo olsaydı etiket sessizce eksik kalırdı.
 */
const FRAMING_TYPE_KEYS: Record<FramingType, TranslationKey> = {
  startEnd: 'studio.framing.startEnd',
  startOnly: 'studio.framing.startOnly',
  fixedLength: 'studio.framing.fixedLength',
  lengthField: 'studio.framing.lengthField',
  none: 'studio.framing.none',
};

const ICON_BUTTON_CLASS =
  'shrink-0 rounded-token-sm border border-line bg-raised px-1.5 py-0.5 text-xs text-text transition-colors hover:border-line-strong hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const DANGER_ICON_BUTTON_CLASS =
  'shrink-0 rounded-token-sm border border-line bg-raised px-1.5 py-0.5 text-xs text-danger transition-colors hover:border-line-strong hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const BADGE_CLASS =
  'shrink-0 rounded-token-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-muted';

const ACCENT_BADGE_CLASS =
  'shrink-0 rounded-token-sm bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent';

/** İç içe alanlar dahil TOPLAM alan sayısı — özet "kaç alan var"ı söylemeli. */
function countFields(fields: readonly FieldDraft[]): number {
  return fields.reduce((total, field) => total + 1 + countFields(field.fields), 0);
}

/** Ad boşsa kimlik gösterilir: satır hiçbir zaman adsız kalmamalı. */
function displayName(field: FieldDraft): string {
  const name = field.name.trim();
  if (name !== '') {
    return name;
  }
  const id = field.id.trim();
  return id !== '' ? id : PLACEHOLDER;
}

function textOrPlaceholder(value: string): string {
  return value.trim() === '' ? PLACEHOLDER : value;
}

function byteListText(values: readonly string[]): string {
  return values.length === 0 ? PLACEHOLDER : values.join(' ');
}

interface FrameSummaryRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

function FrameSummary({ draft }: { readonly draft: SchemaDraft }): ReactNode {
  const { t } = useTranslation();

  const rows: readonly FrameSummaryRow[] = [
    { key: 'name', label: t('studio.frame.name'), value: textOrPlaceholder(draft.name) },
    { key: 'version', label: t('studio.frame.version'), value: textOrPlaceholder(draft.version) },
    {
      key: 'framing',
      label: t('studio.frame.framing'),
      value: t(FRAMING_TYPE_KEYS[draft.framing.type]),
    },
    {
      key: 'startBytes',
      label: t('studio.frame.startBytes'),
      value: byteListText(draft.framing.startBytes),
    },
    {
      key: 'endBytes',
      label: t('studio.frame.endBytes'),
      value: byteListText(draft.framing.endBytes),
    },
    {
      key: 'fieldCount',
      label: t('studio.frame.fieldCount'),
      value: String(countFields(draft.fields)),
    },
  ];

  return (
    <div
      data-testid="studio-frame-summary"
      className="flex flex-col gap-2 rounded-token border border-line bg-raised p-3"
    >
      {/* Kendi anahtarı var: orta sütunun `studio.frame.title` başlığı ÇERÇEVENİN
          KENDİSİNİ gösterir, bu kart ise çerçevenin YAPISINI özetler. Aynı erişilebilir
          adı taşısalardı ekran okuyucuda iki ayrı bölge ayırt edilemezdi. */}
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
        {t('studio.fieldList.frameStructure')}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {rows.map((row) => (
          // `contents`: dt ve dd doğrudan grid hücresi olsun, araya kutu girmesin.
          <div key={row.key} className="contents">
            <dt className="truncate text-muted">{row.label}</dt>
            <dd data-testid={`studio-frame-${row.key}`} className="truncate text-text tabular">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Ağacın her düzeyine aynen geçen bağlam. Tek nesne olarak taşınıyor ki yeni
 * bir geri çağırım eklendiğinde her ara bileşenin imzası değişmesin.
 */
interface FieldTreeShared {
  readonly selectedDraftId: string | null;
  readonly issuesByDraftId: ReadonlyMap<string, readonly DraftIssue[]>;
  readonly onSelect: (draftId: string | null) => void;
  readonly onAdd: (parentDraftId: string | null) => void;
  readonly onRemove: (draftId: string) => void;
  readonly onDuplicate: (draftId: string) => void;
  readonly onMove: (parentDraftId: string | null, fromIndex: number, toIndex: number) => void;
}

interface FieldRowProps {
  readonly field: FieldDraft;
  /** Alanın KENDİ düzeyindeki sırası — renk noktası buradan gelir. */
  readonly order: number;
  readonly shared: FieldTreeShared;
}

function FieldRow({ field, order, shared }: FieldRowProps): ReactNode {
  const { t } = useTranslation();

  const issues = shared.issuesByDraftId.get(field.draftId) ?? [];
  const invalid = issues.length > 0;
  const selected = shared.selectedDraftId === field.draftId;
  // Yalnız `structure`/`array` iç alan taşır; iç alan ekleme düğmesi de
  // çocuk listesi de bu tiplerde görünür.
  const composite = isCompositeField(field.type);
  const name = displayName(field);

  const lengthText =
    field.lengthFrom.trim() !== ''
      ? t('studio.fieldList.lengthFromValue', { field: field.lengthFrom })
      : t('studio.fieldList.lengthValue', { length: textOrPlaceholder(field.length) });

  const hasCondition =
    field.condition.field.trim() !== '' || field.condition.equals.trim() !== '';

  const repeatText =
    field.repeatCount.mode === 'fixed'
      ? t('studio.fieldList.repeatFixed', { count: textOrPlaceholder(field.repeatCount.count) })
      : field.repeatCount.mode === 'fromField'
        ? t('studio.fieldList.repeatFromField', {
            field: textOrPlaceholder(field.repeatCount.fromField),
          })
        : null;

  return (
    <div data-testid={`field-row-${field.draftId}`} className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          data-testid={`field-select-${field.draftId}`}
          aria-pressed={selected}
          aria-invalid={invalid}
          // Seçili satıra yeniden tıklamak seçimi bırakır: sağ panelin kapanması
          // için ayrı bir "kapat" düğmesi gerekmesin.
          onClick={() => {
            shared.onSelect(selected ? null : field.draftId);
          }}
          className={`flex min-w-0 grow items-center gap-2 rounded-token-sm border px-2 py-1 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            selected ? 'border-accent bg-surface ring-2 ring-accent' : 'border-line bg-raised hover:bg-surface'
          }`}
        >
          <span aria-hidden="true" className={`shrink-0 ${SERIES_TEXT_CLASS[seriesIndexFor(order)]}`}>
            ●
          </span>
          <span
            data-testid={`field-name-${field.draftId}`}
            className={`truncate font-medium ${invalid ? 'text-danger' : 'text-text'}`}
          >
            {name}
          </span>
          <span data-testid={`field-type-${field.draftId}`} className={BADGE_CLASS}>
            {field.type}
          </span>
          <span data-testid={`field-offset-${field.draftId}`} className="shrink-0 text-xs text-muted">
            {t('studio.fieldList.offsetValue', { offset: textOrPlaceholder(field.offset) })}
          </span>
          <span data-testid={`field-length-${field.draftId}`} className="shrink-0 text-xs text-muted">
            {lengthText}
          </span>
          {hasCondition ? (
            <span data-testid={`field-condition-${field.draftId}`} className={ACCENT_BADGE_CLASS}>
              {t('studio.fieldList.conditionBadge', {
                field: textOrPlaceholder(field.condition.field),
                value: textOrPlaceholder(field.condition.equals),
              })}
            </span>
          ) : null}
          {repeatText !== null ? (
            <span data-testid={`field-repeat-${field.draftId}`} className={ACCENT_BADGE_CLASS}>
              {repeatText}
            </span>
          ) : null}
          {invalid ? (
            <span data-testid={`field-issue-${field.draftId}`} className="shrink-0 text-danger">
              <span aria-hidden="true">⚠</span>
              {/* Uyarı işareti tek başına ekran okuyucuya bir şey söylemez. */}
              <span className="sr-only">
                {t('studio.fieldList.issueCount', { count: issues.length })}
              </span>
            </span>
          ) : null}
        </button>

        {composite ? (
          <button
            type="button"
            data-testid={`field-add-child-${field.draftId}`}
            aria-label={t('studio.fieldList.addChildField', { name })}
            onClick={() => {
              shared.onAdd(field.draftId);
            }}
            className={ICON_BUTTON_CLASS}
          >
            <span aria-hidden="true">+</span>
          </button>
        ) : null}

        <button
          type="button"
          data-testid={`field-duplicate-${field.draftId}`}
          aria-label={t('studio.fieldList.duplicateField', { name })}
          onClick={() => {
            shared.onDuplicate(field.draftId);
          }}
          className={ICON_BUTTON_CLASS}
        >
          <span aria-hidden="true">⧉</span>
        </button>

        <button
          type="button"
          data-testid={`field-remove-${field.draftId}`}
          // Onay istenmiyor (silme geri alınabilir bir taslak işlemi), o yüzden
          // erişilebilir ad alanın ADINI taşımak zorunda: yanlış satıra basan
          // kullanıcı neyi sildiğini ancak buradan duyar.
          aria-label={t('studio.fieldList.removeField', { name })}
          onClick={() => {
            shared.onRemove(field.draftId);
          }}
          className={DANGER_ICON_BUTTON_CLASS}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {composite ? (
        <div className="border-l border-line pl-3">
          <FieldLevel
            parentDraftId={field.draftId}
            parentName={name}
            fields={field.fields}
            shared={shared}
          />
        </div>
      ) : null}
    </div>
  );
}

interface FieldLevelProps {
  /** Kök düzey için `null`; `onMove`/`onAdd` bu değerle çağrılır. */
  readonly parentDraftId: string | null;
  readonly parentName: string | null;
  readonly fields: readonly FieldDraft[];
  readonly shared: FieldTreeShared;
}

/**
 * Bir düzey = bir `ReorderableList`. Sıralama düzeyler arasında yapılmaz:
 * `onMove` yalnız aynı ebeveynin çocuklarını yer değiştirir, bu yüzden her
 * düzeyin kendi listesi olmak zorunda.
 */
function FieldLevel({ parentDraftId, parentName, fields, shared }: FieldLevelProps): ReactNode {
  const { t } = useTranslation();

  if (fields.length === 0) {
    return (
      <p
        data-testid={
          parentDraftId === null ? 'studio-field-list-empty' : `field-children-empty-${parentDraftId}`
        }
        className="text-xs text-muted"
      >
        {parentDraftId === null ? t('studio.fieldList.empty') : t('studio.fieldList.emptyChildren')}
      </p>
    );
  }

  return (
    <div
      data-testid={
        parentDraftId === null ? 'studio-field-list-root' : `field-children-${parentDraftId}`
      }
    >
      <ReorderableList<FieldDraft>
        items={fields}
        getKey={(field) => field.draftId}
        renderItem={(field, index) => (
          <FieldRow field={field} order={index} shared={shared} />
        )}
        onReorder={(fromIndex, toIndex) => {
          shared.onMove(parentDraftId, fromIndex, toIndex);
        }}
        ariaLabel={
          parentName === null
            ? t('studio.fieldList.listLabel')
            : t('studio.fieldList.childListLabel', { name: parentName })
        }
        moveUpLabel={t('studio.fieldList.moveUp')}
        moveDownLabel={t('studio.fieldList.moveDown')}
      />
    </div>
  );
}

export function FieldListPanel(props: FieldListPanelProps): ReactNode {
  const { t } = useTranslation();

  const shared: FieldTreeShared = {
    selectedDraftId: props.selectedDraftId,
    issuesByDraftId: props.issuesByDraftId,
    onSelect: props.onSelect,
    onAdd: props.onAdd,
    onRemove: props.onRemove,
    onDuplicate: props.onDuplicate,
    onMove: props.onMove,
  };

  return (
    <div className="flex flex-col gap-3">
      <FrameSummary draft={props.draft} />

      {/* Panel kendi "Alanlar" başlığını BASMAZ: bölüm başlığı ekranın işi
          (`ProtocolStudioScreen` <h2>). İkisi de basınca ekranda aynı metin iki kez
          çıkıyordu. Listenin erişilebilir adı `ReorderableList`in aria-label'ından gelir. */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="studio-add-root-field"
          onClick={() => {
            props.onAdd(null);
          }}
          className="rounded-token border border-line bg-raised px-3 py-1 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t('studio.fieldList.addField')}
        </button>
      </div>

      <FieldLevel parentDraftId={null} parentName={null} fields={props.draft.fields} shared={shared} />
    </div>
  );
}
