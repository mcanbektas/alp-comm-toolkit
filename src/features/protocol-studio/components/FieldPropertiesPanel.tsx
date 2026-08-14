/**
 * Alan özellikleri paneli — Custom Protocol Studio'nun SAĞ sütunu (spec §9.7).
 *
 * §9.7 dokuz başlık sayar ama düzenlenebilir alanların KANONİK listesi §9.1'in
 * 23 maddesidir; panel onların tamamını taşır. "Hangi alan var" sorusunun tek
 * kaynağı `FieldDraft`tir: taslak tipi §9.1'in birebir karşılığı olduğu için
 * yeni bir madde eklendiğinde burada derleme değil, GÖRÜNÜRLÜK eksiği kalır —
 * o yüzden aşağıdaki gruplar taslak alan adlarıyla bire bir eşlenir.
 *
 * ## İki ayrı "offset"
 *
 * Spec'te aynı sözcük iki şeydir: `offset` çerçeve içindeki BAYT KONUMU,
 * `calibrationOffset` ise fiziksel değer formülünün (`raw * scale + offset`)
 * sabitidir. Etiketleri ayrı anahtarlardan gelir; tek bir "Offset" etiketi
 * kullanıcıya sessizce yanlış alanı doldurtururdu.
 *
 * ## Panelin asıl işi: alakasızı hiç göstermemek
 *
 * `uint16` için enum tablosu ya da `ascii` için `bitMask` doldurulabilir
 * kalsaydı taslak bunları şemaya yazardı ve hata ancak ayrıştırma anında
 * görünürdü. Görünürlük kararları tek blokta (`visibility`) toplandı; tipe
 * bakan `if` kontrolleri JSX'in içine dağılmaz.
 *
 * ## Neden `NumberField` değil de metin girdisi
 *
 * Taslak katmanı ARA DURUMU korumak için string tutuyor (`"1."`, `"-"`, `"0x"`)
 * ve tam sayı alanları `0x` önekli onaltılığı da kabul ediyor. `type="number"`
 * bir girdi bunların ikisini de kaybeder: tarayıcı geçersiz ara metin için
 * `value` olarak boş string döndürür, onaltılık girişi ise hiç kabul etmez.
 * Bu yüzden burada `inputMode` ipuçlu METİN girdileri kullanılır; sayıya
 * çevirme işi tek yerde, `draftToSchema` içindedir.
 *
 * Hesap YOK: panel yalnız gösterir ve değişikliği YAMA olarak yukarı bildirir.
 */

import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { TranslationKey } from '@/translations';
import { CHECKSUM_ALGORITHMS } from '@/protocol-core/checksums/algorithmCatalogue';
import type { ChecksumAlgorithm } from '@/protocol-core/checksums/algorithmCatalogue';
import type { BitOrder } from '@/protocol-core/decoding/bitCursor';
import type { Endianness } from '@/protocol-core/encoding/ieee754';
import {
  FIELD_TYPES,
  fieldTypeInfo,
  hasIntrinsicLength,
  isDerivedField,
} from '@/protocol-core/schemas/fieldTypes';

import { createEnumEntryDraft } from '../schemaDraft';
import type { DraftIssue, EnumEntryDraft, FieldDraft, RepeatCountDraft } from '../schemaDraft';

export interface FieldPropertiesPanelProps {
  readonly field: FieldDraft | null;
  readonly issues: readonly DraftIssue[];
  readonly onChange: (patch: Partial<FieldDraft>) => void;
}

// --- Sabit tablolar ------------------------------------------------------

const ENDIANNESS_VALUES: readonly Endianness[] = ['big', 'little'];
const BIT_ORDER_VALUES: readonly BitOrder[] = ['msb-first', 'lsb-first'];
const REPEAT_MODES: readonly RepeatCountDraft['mode'][] = ['none', 'fixed', 'fromField'];

const ENDIANNESS_LABEL_KEYS: Record<Endianness, TranslationKey> = {
  big: 'studio.option.endianBig',
  little: 'studio.option.endianLittle',
};

const BIT_ORDER_LABEL_KEYS: Record<BitOrder, TranslationKey> = {
  'msb-first': 'studio.option.bitOrderMsb',
  'lsb-first': 'studio.option.bitOrderLsb',
};

const REPEAT_MODE_LABEL_KEYS: Record<RepeatCountDraft['mode'], TranslationKey> = {
  none: 'studio.option.repeatNone',
  fixed: 'studio.option.repeatFixed',
  fromField: 'studio.option.repeatFromField',
};

/** Seri renkleri 0..3'tür; `color` taslakta metin tutulduğu için anahtar da metin. */
const COLOR_CHOICES = ['0', '1', '2', '3'] as const;

type ColorChoice = (typeof COLOR_CHOICES)[number];

/**
 * Sınıf adları TAM LİTERAL: Tailwind kaynağı statik tarar, `bg-series-${n}`
 * gibi bir şablon üretilen CSS'e hiç girmez (bkz. ByteViewer.tsx:27-39).
 */
const SERIES_SWATCH_CLASS: Record<ColorChoice, string> = {
  '0': 'bg-series-1',
  '1': 'bg-series-2',
  '2': 'bg-series-3',
  '3': 'bg-series-4',
};

// --- Sorun yönlendirme ---------------------------------------------------

/**
 * `DraftIssue.field` kök taslaktan itibaren noktalı bir YOLdur
 * (`fields.1.enumValues.16`). Panel tek alan gösterdiğinden yolun baş kısmı
 * ilgisizdir; sondan geriye doğru taranıp tanınan ilk parça "yuva" sayılır.
 * Böylece hem `fields.1.offset` hem `fields.1.fields.0.offset` aynı girdiye
 * düşer ve iç içe alanlarda mesaj kaybolmaz.
 */
const ISSUE_SLOT_PRESENCE = {
  id: true,
  name: true,
  description: true,
  documentation: true,
  offset: true,
  length: true,
  lengthFrom: true,
  bitOffset: true,
  bitLength: true,
  bitMask: true,
  scale: true,
  calibrationOffset: true,
  unit: true,
  minimum: true,
  maximum: true,
  enumValues: true,
  algorithm: true,
  coverage: true,
  condition: true,
  repeatCount: true,
  defaultValue: true,
  color: true,
} as const satisfies Readonly<Record<string, true>>;

type IssueSlot = keyof typeof ISSUE_SLOT_PRESENCE;

function isIssueSlot(value: string): value is IssueSlot {
  return Object.prototype.hasOwnProperty.call(ISSUE_SLOT_PRESENCE, value);
}

function resolveIssueSlot(path: string): IssueSlot | null {
  const segments = path.split('.');
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment !== undefined && isIssueSlot(segment)) {
      return segment;
    }
  }
  return null;
}

interface GroupedIssues {
  readonly bySlot: ReadonlyMap<IssueSlot, readonly DraftIssue[]>;
  /**
   * Hiçbir girdiye bağlanamayan sorunlar. Sessizce düşürülmez: zod reddi
   * (`studio.draft.schemaRejected`) alan yerine bütün nesneyi işaret
   * edebiliyor ve o mesaj kullanıcıya ulaşmazsa panel "her şey yolunda" der.
   */
  readonly unmatched: readonly DraftIssue[];
}

function groupIssues(issues: readonly DraftIssue[]): GroupedIssues {
  const bySlot = new Map<IssueSlot, DraftIssue[]>();
  const unmatched: DraftIssue[] = [];
  for (const issue of issues) {
    const slot = resolveIssueSlot(issue.field);
    if (slot === null) {
      unmatched.push(issue);
      continue;
    }
    const bucket = bySlot.get(slot);
    if (bucket === undefined) {
      bySlot.set(slot, [issue]);
    } else {
      bucket.push(issue);
    }
  }
  return { bySlot, unmatched };
}

const NO_ISSUES: readonly DraftIssue[] = [];

// --- Girdi kabukları -----------------------------------------------------

function controlClass(invalid: boolean, monospace: boolean, readOnly: boolean): string {
  const parts = [
    'w-full rounded-token-sm border bg-surface px-2 py-1.5 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    invalid ? 'border-danger' : 'border-line',
  ];
  if (monospace) {
    parts.push('font-mono');
  }
  if (readOnly) {
    parts.push('cursor-not-allowed opacity-70');
  }
  return parts.join(' ');
}

interface IssueListProps {
  readonly listId: string;
  readonly issues: readonly DraftIssue[];
}

function IssueList({ listId, issues }: IssueListProps): ReactElement | null {
  const { t } = useTranslation();
  if (issues.length === 0) {
    return null;
  }
  return (
    <ul id={listId} data-testid={listId} className="flex flex-col gap-0.5">
      {issues.map((issue, index) => (
        // Anahtar yol + mesaj + sıra: aynı yolda iki farklı mesaj olabilir.
        <li key={`${issue.field}:${issue.messageKey}:${index}`} className="text-xs text-danger">
          {t(issue.messageKey, issue.params)}
        </li>
      ))}
    </ul>
  );
}

interface ControlCommonProps {
  readonly controlId: string;
  readonly label: string;
  readonly issues: readonly DraftIssue[];
  /**
   * Bileşik gruplarda (kapsam, koşul, tekrar) tek mesaj listesi birden çok
   * girdiye aittir. Verilirse girdi kendi listesini basmaz, `aria-describedby`
   * ile paylaşılan listeyi gösterir.
   */
  readonly sharedIssueListId?: string;
  readonly hint?: string;
}

interface TextControlProps extends ControlCommonProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly monospace?: boolean;
  readonly multiline?: boolean;
  readonly readOnly?: boolean;
  readonly inputMode?: 'text' | 'numeric' | 'decimal';
}

function TextControl({
  controlId,
  label,
  value,
  onValueChange,
  issues,
  sharedIssueListId,
  hint,
  monospace = false,
  multiline = false,
  readOnly = false,
  inputMode = 'text',
}: TextControlProps): ReactElement {
  const invalid = issues.length > 0;
  const listId = sharedIssueListId ?? `${controlId}-issues`;
  const describedBy = invalid ? listId : undefined;
  const className = controlClass(invalid, monospace, readOnly);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-xs font-medium text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={controlId}
          data-testid={controlId}
          value={value}
          rows={3}
          readOnly={readOnly}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
          className={className}
        />
      ) : (
        <input
          id={controlId}
          data-testid={controlId}
          type="text"
          inputMode={inputMode}
          value={value}
          readOnly={readOnly}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
          className={className}
        />
      )}
      {hint !== undefined ? <p className="text-xs text-muted">{hint}</p> : null}
      {sharedIssueListId === undefined ? <IssueList listId={listId} issues={issues} /> : null}
    </div>
  );
}

interface ControlOption {
  readonly value: string;
  readonly label: string;
}

interface SelectControlProps extends ControlCommonProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly ControlOption[];
}

function SelectControl({
  controlId,
  label,
  value,
  onValueChange,
  options,
  issues,
  sharedIssueListId,
  hint,
}: SelectControlProps): ReactElement {
  const invalid = issues.length > 0;
  const listId = sharedIssueListId ?? `${controlId}-issues`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={controlId}
        data-testid={controlId}
        value={value}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? listId : undefined}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        className={`${controlClass(invalid, false, false)} appearance-auto`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined ? <p className="text-xs text-muted">{hint}</p> : null}
      {sharedIssueListId === undefined ? <IssueList listId={listId} issues={issues} /> : null}
    </div>
  );
}

interface FieldGroupProps {
  readonly groupId: string;
  readonly legend: string;
  readonly children: ReactNode;
}

function FieldGroup({ groupId, legend, children }: FieldGroupProps): ReactElement {
  return (
    <fieldset
      data-testid={groupId}
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-3"
    >
      <legend className="px-1 font-display text-xs font-semibold uppercase tracking-wide text-muted">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

/** İki sütunlu ızgara: dar panelde tek sütuna iner. */
function ControlGrid({ children }: { readonly children: ReactNode }): ReactElement {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

// --- Panel ---------------------------------------------------------------

export function FieldPropertiesPanel({
  field,
  issues,
  onChange,
}: FieldPropertiesPanelProps): ReactElement {
  const { t } = useTranslation();
  // Hook'lar koşulsuz çağrılmalı; boş durum kontrolü bundan SONRA gelir.
  const grouped = useMemo(() => groupIssues(issues), [issues]);

  const issuesFor = (slot: IssueSlot): readonly DraftIssue[] => grouped.bySlot.get(slot) ?? NO_ISSUES;

  if (field === null) {
    return (
      <div data-testid="field-properties-panel" className="flex flex-col gap-4">
        <p
          data-testid="field-properties-empty"
          className="rounded-token border border-line bg-surface p-4 text-sm text-muted"
        >
          {t('studio.properties.empty')}
        </p>
      </div>
    );
  }

  const info = fieldTypeInfo(field.type);
  const intrinsicLength = hasIntrinsicLength(field.type);
  const derived = isDerivedField(field.type);

  /**
   * Görünürlük kuralları — tek yerde. `kind` alanın DEĞER SINIFIdır; tip
   * adına tek tek bakmak yerine sınıfa bakmak, `fieldTypes.ts`e yeni bir tip
   * eklendiğinde paneli kendiliğinden doğru davrandırır.
   */
  const visibility = {
    length: !intrinsicLength,
    lengthFrom: !intrinsicLength,
    signed: info.kind === 'integer' || field.type === 'bitField',
    endianness: info.kind === 'integer' || info.kind === 'float' || info.kind === 'timestamp',
    bits: field.type === 'bitField' || info.kind === 'integer',
    scaling: info.kind === 'integer' || info.kind === 'float' || info.kind === 'bits',
    enumTable: field.type === 'enum' || field.type === 'command',
    checksum: field.type === 'checksum' || field.type === 'crc',
    repeat: field.type === 'array',
    // Türetilmiş alanın değeri hesaplanır; varsayılan değer girdisi yanıltır.
    defaultValue: !derived,
  } as const;

  const updateEnumEntry = (index: number, patch: Partial<EnumEntryDraft>): void => {
    onChange({
      enumValues: field.enumValues.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    });
  };

  const typeOptions: readonly ControlOption[] = FIELD_TYPES.map((type) => ({
    value: type,
    // Tip adları VERİdir (protokol adları gibi), çeviriye girmez.
    label: type,
  }));

  const algorithmOptions: readonly ControlOption[] = [
    { value: '', label: t('studio.option.algorithmNone') },
    ...CHECKSUM_ALGORITHMS.map((algorithm) => ({ value: algorithm, label: algorithm })),
  ];

  return (
    <div data-testid="field-properties-panel" className="flex flex-col gap-4">
      {grouped.unmatched.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-token border border-danger bg-danger-soft p-3">
          <p className="text-xs font-semibold text-danger-strong">
            {t('studio.properties.otherIssues')}
          </p>
          <IssueList listId="field-props-issues-other" issues={grouped.unmatched} />
        </div>
      ) : null}

      {derived ? (
        <p
          data-testid="field-props-derived-note"
          role="note"
          className="rounded-token border border-line bg-warn-soft p-3 text-xs text-warn"
        >
          {t('studio.properties.derivedNote')}
        </p>
      ) : null}

      <FieldGroup groupId="field-props-group-identity" legend={t('studio.properties.group.identity')}>
        <ControlGrid>
          <TextControl
            controlId="field-props-id"
            label={t('studio.field.id')}
            value={field.id}
            onValueChange={(value) => {
              onChange({ id: value });
            }}
            issues={issuesFor('id')}
            monospace
          />
          <TextControl
            controlId="field-props-name"
            label={t('studio.field.name')}
            value={field.name}
            onValueChange={(value) => {
              onChange({ name: value });
            }}
            issues={issuesFor('name')}
          />
        </ControlGrid>
        <TextControl
          controlId="field-props-description"
          label={t('studio.field.description')}
          value={field.description}
          onValueChange={(value) => {
            onChange({ description: value });
          }}
          issues={issuesFor('description')}
          multiline
        />
        <TextControl
          controlId="field-props-documentation"
          label={t('studio.field.documentation')}
          value={field.documentation}
          onValueChange={(value) => {
            onChange({ documentation: value });
          }}
          issues={issuesFor('documentation')}
          multiline
        />
      </FieldGroup>

      <FieldGroup groupId="field-props-group-layout" legend={t('studio.properties.group.layout')}>
        <ControlGrid>
          <SelectControl
            controlId="field-props-type"
            label={t('studio.field.type')}
            value={field.type}
            onValueChange={(value) => {
              const type = FIELD_TYPES.find((candidate) => candidate === value);
              if (type === undefined) {
                return;
              }
              // Uzunluk tipten geliyorsa yamada birlikte tazelenir; aksi hâlde
              // eski tipin genişliği taslakta kalır ve şemaya sessizce yazılır.
              const width = fieldTypeInfo(type).byteLength;
              onChange({ type, length: width === undefined ? field.length : String(width) });
            }}
            options={typeOptions}
            issues={NO_ISSUES}
          />
          <TextControl
            controlId="field-props-offset"
            label={t('studio.field.offset')}
            value={field.offset}
            onValueChange={(value) => {
              onChange({ offset: value });
            }}
            issues={issuesFor('offset')}
            monospace
            inputMode="numeric"
          />
          {visibility.length ? (
            <TextControl
              controlId="field-props-length"
              label={t('studio.field.length')}
              value={field.length}
              onValueChange={(value) => {
                onChange({ length: value });
              }}
              issues={issuesFor('length')}
              monospace
              inputMode="numeric"
            />
          ) : (
            <TextControl
              controlId="field-props-length"
              label={t('studio.field.length')}
              value={info.byteLength === undefined ? '' : String(info.byteLength)}
              onValueChange={() => {
                // Salt okunur: genişliği tip belirler.
              }}
              issues={NO_ISSUES}
              hint={t('studio.properties.intrinsicLengthHint')}
              monospace
              readOnly
              inputMode="numeric"
            />
          )}
          {visibility.lengthFrom ? (
            <TextControl
              controlId="field-props-lengthFrom"
              label={t('studio.field.lengthFrom')}
              value={field.lengthFrom}
              onValueChange={(value) => {
                onChange({ lengthFrom: value });
              }}
              issues={issuesFor('lengthFrom')}
              monospace
            />
          ) : null}
          {visibility.signed ? (
            <SelectControl
              controlId="field-props-signed"
              label={t('studio.field.signed')}
              value={field.signed === null ? '' : String(field.signed)}
              onValueChange={(value) => {
                // Üç hâl: seçilmedi (`null`), işaretli, işaretsiz. `null`
                // "tip zaten söylüyor" demektir ve şemaya yazılmaz.
                onChange({ signed: value === '' ? null : value === 'true' });
              }}
              options={[
                { value: '', label: t('studio.option.auto') },
                { value: 'true', label: t('studio.option.signedYes') },
                { value: 'false', label: t('studio.option.signedNo') },
              ]}
              issues={NO_ISSUES}
            />
          ) : null}
          {visibility.endianness ? (
            <SelectControl
              controlId="field-props-endianness"
              label={t('studio.field.endianness')}
              value={field.endianness}
              onValueChange={(value) => {
                const endianness = ENDIANNESS_VALUES.find((candidate) => candidate === value);
                onChange({ endianness: endianness ?? '' });
              }}
              options={[
                { value: '', label: t('studio.option.auto') },
                ...ENDIANNESS_VALUES.map((value) => ({
                  value,
                  label: t(ENDIANNESS_LABEL_KEYS[value]),
                })),
              ]}
              issues={NO_ISSUES}
            />
          ) : null}
        </ControlGrid>

        {visibility.bits ? (
          <ControlGrid>
            <SelectControl
              controlId="field-props-bitOrder"
              label={t('studio.field.bitOrder')}
              value={field.bitOrder}
              onValueChange={(value) => {
                const bitOrder = BIT_ORDER_VALUES.find((candidate) => candidate === value);
                onChange({ bitOrder: bitOrder ?? '' });
              }}
              options={[
                { value: '', label: t('studio.option.auto') },
                ...BIT_ORDER_VALUES.map((value) => ({
                  value,
                  label: t(BIT_ORDER_LABEL_KEYS[value]),
                })),
              ]}
              issues={NO_ISSUES}
            />
            <TextControl
              controlId="field-props-bitOffset"
              label={t('studio.field.bitOffset')}
              value={field.bitOffset}
              onValueChange={(value) => {
                onChange({ bitOffset: value });
              }}
              issues={issuesFor('bitOffset')}
              monospace
              inputMode="numeric"
            />
            <TextControl
              controlId="field-props-bitLength"
              label={t('studio.field.bitLength')}
              value={field.bitLength}
              onValueChange={(value) => {
                onChange({ bitLength: value });
              }}
              issues={issuesFor('bitLength')}
              monospace
              inputMode="numeric"
            />
            <TextControl
              controlId="field-props-bitMask"
              label={t('studio.field.bitMask')}
              value={field.bitMask}
              onValueChange={(value) => {
                onChange({ bitMask: value });
              }}
              issues={issuesFor('bitMask')}
              monospace
              inputMode="numeric"
            />
          </ControlGrid>
        ) : null}
      </FieldGroup>

      {visibility.scaling ? (
        <FieldGroup
          groupId="field-props-group-scaling"
          legend={t('studio.properties.group.scaling')}
        >
          <ControlGrid>
            <TextControl
              controlId="field-props-scale"
              label={t('studio.field.scale')}
              value={field.scale}
              onValueChange={(value) => {
                onChange({ scale: value });
              }}
              issues={issuesFor('scale')}
              monospace
              inputMode="decimal"
            />
            <TextControl
              controlId="field-props-calibrationOffset"
              label={t('studio.field.calibrationOffset')}
              value={field.calibrationOffset}
              onValueChange={(value) => {
                onChange({ calibrationOffset: value });
              }}
              issues={issuesFor('calibrationOffset')}
              monospace
              inputMode="decimal"
            />
            <TextControl
              controlId="field-props-unit"
              label={t('studio.field.unit')}
              value={field.unit}
              onValueChange={(value) => {
                onChange({ unit: value });
              }}
              issues={issuesFor('unit')}
            />
            <TextControl
              controlId="field-props-minimum"
              label={t('studio.field.minimum')}
              value={field.minimum}
              onValueChange={(value) => {
                onChange({ minimum: value });
              }}
              issues={issuesFor('minimum')}
              monospace
              inputMode="decimal"
            />
            <TextControl
              controlId="field-props-maximum"
              label={t('studio.field.maximum')}
              value={field.maximum}
              onValueChange={(value) => {
                onChange({ maximum: value });
              }}
              issues={issuesFor('maximum')}
              monospace
              inputMode="decimal"
            />
          </ControlGrid>
        </FieldGroup>
      ) : null}

      {visibility.enumTable ? (
        <FieldGroup groupId="field-props-group-enum" legend={t('studio.properties.group.enum')}>
          {field.enumValues.length === 0 ? (
            <p data-testid="field-props-enum-empty" className="text-xs text-muted">
              {t('studio.field.enumEmpty')}
            </p>
          ) : (
            <ul data-testid="field-props-enum-rows" className="flex flex-col gap-2">
              {field.enumValues.map((entry, index) => (
                // Anahtar `entryId`: kullanıcı `key` alanını düzeltirken React
                // girdiyi yeniden kurmasın, odak kaybolmasın.
                <li key={entry.entryId} className="flex items-end gap-2">
                  <div className="flex-1">
                    <TextControl
                      controlId={`field-props-enum-key-${index}`}
                      label={t('studio.field.enumKey')}
                      value={entry.key}
                      onValueChange={(value) => {
                        updateEnumEntry(index, { key: value });
                      }}
                      issues={NO_ISSUES}
                      monospace
                      inputMode="numeric"
                    />
                  </div>
                  <div className="flex-1">
                    <TextControl
                      controlId={`field-props-enum-label-${index}`}
                      label={t('studio.field.enumLabel')}
                      value={entry.label}
                      onValueChange={(value) => {
                        updateEnumEntry(index, { label: value });
                      }}
                      issues={NO_ISSUES}
                    />
                  </div>
                  <button
                    type="button"
                    data-testid={`field-props-enum-remove-${index}`}
                    aria-label={t('studio.field.enumRemove')}
                    onClick={() => {
                      onChange({
                        enumValues: field.enumValues.filter((_, position) => position !== index),
                      });
                    }}
                    className="rounded-token-sm border border-line bg-raised px-2 py-1.5 text-xs text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button
              type="button"
              data-testid="field-props-enum-add"
              onClick={() => {
                onChange({ enumValues: [...field.enumValues, createEnumEntryDraft()] });
              }}
              className="rounded-token-sm border border-line bg-raised px-3 py-1.5 text-xs text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('studio.field.enumAdd')}
            </button>
          </div>
          <IssueList listId="field-props-enumValues-issues" issues={issuesFor('enumValues')} />
        </FieldGroup>
      ) : null}

      {visibility.checksum ? (
        <FieldGroup
          groupId="field-props-group-checksum"
          legend={t('studio.properties.group.checksum')}
        >
          <ControlGrid>
            <SelectControl
              controlId="field-props-algorithm"
              label={t('studio.field.algorithm')}
              value={field.algorithm}
              onValueChange={(value) => {
                const algorithm: ChecksumAlgorithm | undefined = CHECKSUM_ALGORITHMS.find(
                  (candidate) => candidate === value,
                );
                onChange({ algorithm: algorithm ?? '' });
              }}
              options={algorithmOptions}
              issues={issuesFor('algorithm')}
            />
            <TextControl
              controlId="field-props-coverageStart"
              label={t('studio.field.coverageStart')}
              value={field.coverage.startField}
              onValueChange={(value) => {
                onChange({ coverage: { ...field.coverage, startField: value } });
              }}
              issues={issuesFor('coverage')}
              sharedIssueListId="field-props-coverage-issues"
              monospace
            />
            <TextControl
              controlId="field-props-coverageEnd"
              label={t('studio.field.coverageEnd')}
              value={field.coverage.endField}
              onValueChange={(value) => {
                onChange({ coverage: { ...field.coverage, endField: value } });
              }}
              issues={issuesFor('coverage')}
              sharedIssueListId="field-props-coverage-issues"
              monospace
            />
          </ControlGrid>
          <IssueList listId="field-props-coverage-issues" issues={issuesFor('coverage')} />
        </FieldGroup>
      ) : null}

      <FieldGroup groupId="field-props-group-repeat" legend={t('studio.properties.group.repeat')}>
        <ControlGrid>
          <TextControl
            controlId="field-props-conditionField"
            label={t('studio.field.conditionField')}
            value={field.condition.field}
            onValueChange={(value) => {
              onChange({ condition: { ...field.condition, field: value } });
            }}
            issues={issuesFor('condition')}
            sharedIssueListId="field-props-condition-issues"
            monospace
          />
          <TextControl
            controlId="field-props-conditionEquals"
            label={t('studio.field.conditionEquals')}
            value={field.condition.equals}
            onValueChange={(value) => {
              onChange({ condition: { ...field.condition, equals: value } });
            }}
            issues={issuesFor('condition')}
            sharedIssueListId="field-props-condition-issues"
            monospace
            inputMode="numeric"
          />
        </ControlGrid>
        <IssueList listId="field-props-condition-issues" issues={issuesFor('condition')} />

        {visibility.repeat ? (
          <>
            <ControlGrid>
              <SelectControl
                controlId="field-props-repeatMode"
                label={t('studio.field.repeatMode')}
                value={field.repeatCount.mode}
                onValueChange={(value) => {
                  const mode = REPEAT_MODES.find((candidate) => candidate === value);
                  if (mode === undefined) {
                    return;
                  }
                  onChange({ repeatCount: { ...field.repeatCount, mode } });
                }}
                options={REPEAT_MODES.map((mode) => ({
                  value: mode,
                  label: t(REPEAT_MODE_LABEL_KEYS[mode]),
                }))}
                issues={NO_ISSUES}
              />
              {field.repeatCount.mode === 'fixed' ? (
                <TextControl
                  controlId="field-props-repeatCount"
                  label={t('studio.field.repeatCount')}
                  value={field.repeatCount.count}
                  onValueChange={(value) => {
                    onChange({ repeatCount: { ...field.repeatCount, count: value } });
                  }}
                  issues={issuesFor('repeatCount')}
                  sharedIssueListId="field-props-repeatCount-issues"
                  monospace
                  inputMode="numeric"
                />
              ) : null}
              {field.repeatCount.mode === 'fromField' ? (
                <TextControl
                  controlId="field-props-repeatFromField"
                  label={t('studio.field.repeatFromField')}
                  value={field.repeatCount.fromField}
                  onValueChange={(value) => {
                    onChange({ repeatCount: { ...field.repeatCount, fromField: value } });
                  }}
                  issues={issuesFor('repeatCount')}
                  sharedIssueListId="field-props-repeatCount-issues"
                  monospace
                />
              ) : null}
            </ControlGrid>
            <IssueList listId="field-props-repeatCount-issues" issues={issuesFor('repeatCount')} />
            <p className="text-xs text-muted">{t('studio.properties.childFieldsHint')}</p>
          </>
        ) : null}
      </FieldGroup>

      <FieldGroup
        groupId="field-props-group-appearance"
        legend={t('studio.properties.group.appearance')}
      >
        {visibility.defaultValue ? (
          <ControlGrid>
            <TextControl
              controlId="field-props-defaultValue"
              label={t('studio.field.defaultValue')}
              value={field.defaultValue}
              onValueChange={(value) => {
                onChange({ defaultValue: value });
              }}
              issues={issuesFor('defaultValue')}
              monospace
            />
            <SelectControl
              controlId="field-props-defaultValueKind"
              label={t('studio.field.defaultValueKind')}
              value={field.defaultValueKind}
              onValueChange={(value) => {
                // Metin mi sayı mı olduğu METİNDEN anlaşılamaz ("1" hem sayı
                // hem karakter dizisi olabilir); kullanıcı açıkça söyler.
                onChange({ defaultValueKind: value === 'number' ? 'number' : 'text' });
              }}
              options={[
                { value: 'text', label: t('studio.option.defaultKindText') },
                { value: 'number', label: t('studio.option.defaultKindNumber') },
              ]}
              issues={NO_ISSUES}
            />
          </ControlGrid>
        ) : null}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t('studio.field.color')}</span>
          <div className="flex flex-wrap items-center gap-2" role="group">
            {COLOR_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                data-testid={`field-props-color-${choice}`}
                aria-pressed={field.color === choice}
                aria-label={t('studio.field.colorOption', { index: Number(choice) + 1 })}
                onClick={() => {
                  onChange({ color: choice });
                }}
                className={
                  field.color === choice
                    ? 'rounded-token-sm border border-accent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                    : 'rounded-token-sm border border-line p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                }
              >
                <span className={`block size-4 rounded-token-sm ${SERIES_SWATCH_CLASS[choice]}`} />
              </button>
            ))}
            <button
              type="button"
              data-testid="field-props-color-none"
              aria-pressed={field.color === ''}
              onClick={() => {
                onChange({ color: '' });
              }}
              className="rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('studio.field.colorNone')}
            </button>
          </div>
          <IssueList listId="field-props-color-issues" issues={issuesFor('color')} />
        </div>
      </FieldGroup>
    </div>
  );
}
