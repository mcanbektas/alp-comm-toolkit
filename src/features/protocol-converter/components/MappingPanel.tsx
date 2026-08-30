/**
 * Eşleme tablosu — spec §33'ün "Kullanıcı kaynak/hedef alanlarını
 * eşleyebilmeli" maddesinin ekrandaki karşılığı.
 *
 * Kaynak alan SERBEST METİN DEĞİL, SEÇİMDİR: alan kimlikleri (`register-0`,
 * `pdu-length`) protokolün parser'ının ürettiği kimliklerdir ve elle yazmak
 * imkânsıza yakındı. Çerçeve çözülemediğinde liste boş kalır; o zaman da kutu
 * seçenek yerine "önce çözülebilir bir çerçeve" der.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import type { ParsedField } from '@/protocol-core/types';
import type { TranslationKey } from '@/translations';

import type { FieldMapping, TransformKind } from '../converterTypes';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-muted';
const BUTTON_CLASS =
  'rounded-token-sm border border-line px-3 py-1.5 text-sm text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const TRANSFORM_LABELS: Record<TransformKind, TranslationKey> = {
  none: 'converter.transform.none',
  scale: 'converter.transform.scale',
  offset: 'converter.transform.offset',
  scaleOffset: 'converter.transform.scaleOffset',
};

/** Çarpan yalnız ölçekleyen dönüşümlerde, eklenen yalnız kaydıranlarda anlamlı. */
const USES_FACTOR: ReadonlySet<TransformKind> = new Set<TransformKind>(['scale', 'scaleOffset']);
const USES_ADDEND: ReadonlySet<TransformKind> = new Set<TransformKind>(['offset', 'scaleOffset']);

interface MappingPanelProps {
  readonly mappings: readonly FieldMapping[];
  readonly fields: readonly ParsedField[];
  readonly onAdd: () => void;
  readonly onRemove: (mappingId: string) => void;
  readonly onUpdate: (mappingId: string, patch: Partial<Omit<FieldMapping, 'id'>>) => void;
}

export function MappingPanel({ mappings, fields, onAdd, onRemove, onUpdate }: MappingPanelProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3" data-testid="converter-mappings">
      {mappings.map((mapping) => {
        const id = `converter-${mapping.id}`;
        return (
          <div key={mapping.id} className="flex flex-wrap items-end gap-3 rounded-token border border-line p-3">
            <label className={LABEL_CLASS} htmlFor={`${id}-source`}>
              {t('converter.field.sourceField')}
              <select
                id={`${id}-source`}
                data-testid={`${id}-source`}
                className={FIELD_CLASS}
                value={mapping.sourceFieldId}
                onChange={(event) => onUpdate(mapping.id, { sourceFieldId: event.target.value })}
              >
                <option value="">{t('converter.field.sourceFieldUnset')}</option>
                {/* Alan adı protokolün verisidir, çeviriye girmez. */}
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
                {/* Kaynak protokol değişince eski kimlik listede olmayabilir;
                    seçili değeri düşürmek kullanıcının eşlemesini sessizce
                    silmek olurdu, o yüzden kimlik olduğu gibi eklenir. */}
                {mapping.sourceFieldId !== '' && !fields.some((field) => field.id === mapping.sourceFieldId) ? (
                  <option value={mapping.sourceFieldId}>{mapping.sourceFieldId}</option>
                ) : null}
              </select>
            </label>

            <label className={LABEL_CLASS} htmlFor={`${id}-transform`}>
              {t('converter.field.transform')}
              <select
                id={`${id}-transform`}
                data-testid={`${id}-transform`}
                className={FIELD_CLASS}
                value={mapping.transform}
                onChange={(event) => onUpdate(mapping.id, { transform: event.target.value as TransformKind })}
              >
                {(Object.keys(TRANSFORM_LABELS) as TransformKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {t(TRANSFORM_LABELS[kind])}
                  </option>
                ))}
              </select>
            </label>

            {USES_FACTOR.has(mapping.transform) ? (
              <label className={LABEL_CLASS} htmlFor={`${id}-factor`}>
                {t('converter.field.factor')}
                <input
                  id={`${id}-factor`}
                  data-testid={`${id}-factor`}
                  className={FIELD_CLASS}
                  type="number"
                  step="any"
                  value={mapping.factor}
                  onChange={(event) => onUpdate(mapping.id, { factor: Number(event.target.value) })}
                />
              </label>
            ) : null}

            {USES_ADDEND.has(mapping.transform) ? (
              <label className={LABEL_CLASS} htmlFor={`${id}-addend`}>
                {t('converter.field.addend')}
                <input
                  id={`${id}-addend`}
                  data-testid={`${id}-addend`}
                  className={FIELD_CLASS}
                  type="number"
                  step="any"
                  value={mapping.addend}
                  onChange={(event) => onUpdate(mapping.id, { addend: Number(event.target.value) })}
                />
              </label>
            ) : null}

            <label className={LABEL_CLASS} htmlFor={`${id}-destination`}>
              {t('converter.field.destinationName')}
              <input
                id={`${id}-destination`}
                data-testid={`${id}-destination`}
                className={FIELD_CLASS}
                value={mapping.destinationName}
                onChange={(event) => onUpdate(mapping.id, { destinationName: event.target.value })}
              />
            </label>

            <button
              type="button"
              className={BUTTON_CLASS}
              data-testid={`${id}-remove`}
              onClick={() => onRemove(mapping.id)}
            >
              {t('converter.action.removeMapping')}
            </button>
          </div>
        );
      })}

      <div>
        <button type="button" className={BUTTON_CLASS} data-testid="converter-add-mapping" onClick={onAdd}>
          {t('converter.action.addMapping')}
        </button>
      </div>
    </div>
  );
}
