/**
 * Alan değerleri formu — spec §10'un "her alan için girdi" maddesi.
 *
 * ## Girdi tipini kim seçer
 *
 * Seçim `BuilderFieldDescriptor`in TİPİNDEN yapılır, alan adından ya da
 * kullanıcının yazdığı metinden değil. Böylece protokol değiştiğinde form
 * kendiliğinden doğru girdiyi gösterir:
 *
 *   enum     → SelectField (anahtar/etiket tablosu)
 *   boolean  → CheckboxField
 *   sayısal  → NumberField + artır/azalt
 *   metin    → TextField
 *   bayt     → TextField (hex)
 *   derived  → ResultField (salt-okunur) + "otomatik" rozeti
 *
 * ## Artır/azalt neden burada değil motorda
 *
 * Düğmeler yalnız `onStepValue(path, ±1)` çağırır; sınıra kırpma, işaretli/
 * işaretsiz aralık ve ölçek hesabı `packetPipeline.stepFieldValue`ta. Bileşen
 * "değeri bir artır" derken kaç olduğunu bilmez — protokol hesabının bileşene
 * yazılmaması kuralı (CLAUDE.md) burada birebir uygulanıyor.
 *
 * ## Türetilen alanlar
 *
 * Değerleri `values`ta YOKTUR (kodlayıcı hesaplar), bu yüzden nötr bir tire
 * gösterilir. Sıfır göstermek "checksum 0" gibi okunurdu; tire dile bağlı
 * olmayan "değer sana ait değil" işaretidir (ByteViewer'daki boş göstergeyle
 * aynı glif).
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { CheckboxField, NumberField, ResultField, SelectField, TextField } from '@/components/forms';
import { fieldTypeInfo } from '@/protocol-core/schemas/fieldTypes';
import type { TranslationKey } from '@/translations';

import type { FieldValueFormProps } from '../builderTypes';
import type { BuilderFieldDescriptor, PacketIssue } from '../packetPipeline';

/** Türetilen alanın yerine basılan nötr işaret — çevrilecek bir sözcük değil. */
const DERIVED_GLYPH = '—';

/** Artır/azalt glifleri; erişilebilir ad `sr-only` metinden gelir. */
const STEP_UP_GLYPH = '+';
const STEP_DOWN_GLYPH = '−';

const STEP_DELTA = 1;

function fieldId(path: string): string {
  return `builder-field-${path}`;
}

function stepButtonClass(): string {
  return 'rounded-token-sm border border-line bg-raised px-2 py-1 text-sm text-text hover:border-line-strong hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
}

/** Alan başlığı: ad + birim. Birim VERİDİR (şemadan gelir), çeviriye girmez. */
function labelOf(field: BuilderFieldDescriptor): string {
  return field.unit === null ? field.name : `${field.name} (${field.unit})`;
}

export function FieldValueForm(props: FieldValueFormProps): ReactNode {
  const { t } = useTranslation();

  /** Alan başına ilk sorun: bir girdinin altında sorun listesi değil, tek satır gösterilir. */
  const issueOf = (path: string): PacketIssue | undefined =>
    props.issues.find((issue) => issue.fieldId === path);

  const renderInput = (field: BuilderFieldDescriptor): ReactNode => {
    const id = fieldId(field.path);
    const label = labelOf(field);
    const value = props.values[field.path] ?? '';
    const issue = issueOf(field.path);
    const error = issue === undefined ? undefined : t(issue.messageKey as TranslationKey, issue.params);

    if (field.derived) {
      // Değer encoder tarafından üretilir; formda yalnız yer tutucu durur, o yüzden
      // kopyalama düğmesi gizli (tire kopyalamak yanıltıcıydı).
      return <ResultField id={id} label={label} value={DERIVED_GLYPH} hideCopy />;
    }

    const kind = fieldTypeInfo(field.type).kind;

    if (kind === 'enum' && field.enumValues !== null) {
      return (
        <SelectField
          id={id}
          label={label}
          value={value}
          onChange={(next) => {
            props.onValueChange(field.path, next);
          }}
          options={[...field.enumValues].map(([key, name]) => ({ value: key, label: name }))}
        />
      );
    }

    if (kind === 'boolean') {
      return (
        <CheckboxField
          id={id}
          label={label}
          checked={value === 'true'}
          onChange={(checked) => {
            props.onValueChange(field.path, checked ? 'true' : 'false');
          }}
        />
      );
    }

    if (kind === 'text' || kind === 'bytes') {
      return (
        <TextField
          id={id}
          label={label}
          value={value}
          onChange={(next) => {
            props.onValueChange(field.path, next);
          }}
          error={error}
          monospace
        />
      );
    }

    return (
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumberField
            id={id}
            label={label}
            value={value}
            onChange={(next) => {
              props.onValueChange(field.path, next);
            }}
            error={error}
          />
        </div>
        <button
          type="button"
          data-testid={`builder-step-down-${field.path}`}
          className={stepButtonClass()}
          onClick={() => {
            props.onStepValue(field.path, -STEP_DELTA);
          }}
        >
          <span aria-hidden="true">{STEP_DOWN_GLYPH}</span>
          <span className="sr-only">
            {t('builder.field.decrement')} {field.name}
          </span>
        </button>
        <button
          type="button"
          data-testid={`builder-step-up-${field.path}`}
          className={stepButtonClass()}
          onClick={() => {
            props.onStepValue(field.path, STEP_DELTA);
          }}
        >
          <span aria-hidden="true">{STEP_UP_GLYPH}</span>
          <span className="sr-only">
            {t('builder.field.increment')} {field.name}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="builder-field-form">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('builder.form.label')}
        </span>
        <button
          type="button"
          data-testid="builder-randomize"
          className="rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={props.onRandomize}
        >
          {t('builder.form.randomize')}
        </button>
      </div>

      {props.fields.length === 0 ? (
        <p className="text-sm text-muted" data-testid="builder-form-empty">
          {t('builder.form.empty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {props.fields.map((field) => (
            <div key={field.path} data-testid={`builder-field-${field.path}`} className="flex flex-col gap-1">
              {renderInput(field)}

              {field.derived ? (
                <span
                  data-testid={`builder-derived-${field.path}`}
                  className="w-fit rounded-token-sm bg-accent-soft px-2 py-0.5 text-xs text-accent"
                >
                  {t('builder.form.derivedBadge')}
                </span>
              ) : null}

              {/* Sayılar AYRI span'de: yer tutuculu bir çeviri anahtarı,
                  sözlükte yoksa `interpolate` çalışma zamanında patlar. */}
              {field.minimum !== null || field.maximum !== null ? (
                <p className="text-xs text-muted" data-testid={`builder-range-${field.path}`}>
                  {field.minimum !== null ? (
                    <>
                      {t('builder.form.minimum')} <span className="tabular">{field.minimum}</span>{' '}
                    </>
                  ) : null}
                  {field.maximum !== null ? (
                    <>
                      {t('builder.form.maximum')} <span className="tabular">{field.maximum}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
