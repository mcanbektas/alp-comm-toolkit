/**
 * Adım parametreleri ve koşul düzenleyici.
 *
 * Koşul bir METİN KUTUSU değil, alan alan seçilen bir nesne: §41 `eval` ve
 * dinamik kod çalıştırmayı yasaklıyor (39563-39564), yani kullanıcının yazdığı
 * bir ifadeyi çalıştıracak bir yer olmamalı — düzenleyici de o yüzden ifade
 * değil OPERAND + OPERATÖR + OPERAND soruyor.
 */

import type { ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { CHECKSUM_ALGORITHMS } from '@/protocol-core/checksums/algorithmCatalogue';
import { PAYLOAD_ENCODERS } from '@/protocols/encoderCatalog';
import { COMPARISON_OPERATORS } from '../conditions';
import type { ChecksumAlgorithm } from '@/protocol-core/checksums/algorithmCatalogue';
import type { Condition, ComparisonOperator, Operand } from '../conditions';
import type { FieldEndianness, FieldWidth } from '@/protocol-core/analysis/types';
import type { FramePayload, TestStep } from '../scenario';
import type { TranslationKey } from '@/translations';

const FIELD_CLASS = 'rounded-token-sm border border-line bg-surface px-2 py-1 text-sm text-text';
const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-muted';

const OPERAND_LABELS: Record<Operand['kind'], TranslationKey> = {
  constant: 'testAutomation.operand.constant',
  variable: 'testAutomation.operand.variable',
  'frame-field': 'testAutomation.operand.frameField',
  'frame-length': 'testAutomation.operand.frameLength',
};

const WIDTHS: readonly FieldWidth[] = [1, 2, 4];
const ENDIANNESSES: readonly FieldEndianness[] = ['big', 'little'];

/** Boş bir gönderim adımı anlamsız olurdu; iki baytlık asgari yük. */
const DEFAULT_PAYLOAD_BYTES: readonly number[] = [0xaa, 0x01];

function hexOf(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function bytesOf(text: string): number[] {
  const bytes: number[] = [];
  for (const token of text.split(/[\s,:-]+/)) {
    const cleaned = token.startsWith('0x') || token.startsWith('0X') ? token.slice(2) : token;
    if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) continue;
    for (let index = 0; index < cleaned.length; index += 2) {
      bytes.push(Number.parseInt(cleaned.slice(index, index + 2), 16));
    }
  }
  return bytes;
}

/** Bayt taşıyan iki kaynağın ortak okuması; şablon kaynağında bayt yoktur. */
function payloadBytesOf(payload: FramePayload): readonly number[] {
  return payload.source === 'template' ? [] : payload.bytes;
}

/**
 * Kaynak değişince yük KORUNUR: kullanıcı `bytes` ile yazdığı yükü zarfa
 * sarmak istediğinde onu yeniden yazmak zorunda kalmamalı. Şablona geçişte
 * korunacak bir bayt yoktur.
 */
function payloadFor(source: string, previous: FramePayload): FramePayload {
  if (source === 'template') {
    return { source: 'template', templateId: '' };
  }
  const bytes = payloadBytesOf(previous);
  const carried = bytes.length === 0 ? DEFAULT_PAYLOAD_BYTES : bytes;

  if (source === 'plugin-frame') {
    const first = PAYLOAD_ENCODERS[0];
    return { source: 'plugin-frame', pluginId: first?.pluginId ?? '', bytes: carried };
  }
  return { source: 'bytes', bytes: carried };
}

function numberOr(text: string, fallback: number): number {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Maske ve beklenen değer onaltılık yazılabilir. `parseFloat("0xFF")` 0 döner
 * (öneki okumaz) ve maske sessizce sıfırlanırdı; `Number` okur.
 */
function maskNumberOr(text: string, fallback: number): number {
  const trimmed = text.trim();
  const value = /^0[xX][0-9a-fA-F]+$/.test(trimmed) ? Number(trimmed) : Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : fallback;
}

export interface OperandEditorProps {
  readonly id: string;
  readonly operand: Operand;
  readonly onChange: (operand: Operand) => void;
}

export function OperandEditor({ id, operand, onChange }: OperandEditorProps): ReactNode {
  const { t } = useTranslation();

  const changeKind = (kind: Operand['kind']): void => {
    switch (kind) {
      case 'constant':
        onChange({ kind: 'constant', value: 0 });
        return;
      case 'variable':
        onChange({ kind: 'variable', name: 'deger' });
        return;
      case 'frame-length':
        onChange({ kind: 'frame-length' });
        return;
      case 'frame-field':
        onChange({ kind: 'frame-field', offset: 0, width: 1, endianness: 'big' });
        return;
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className={LABEL_CLASS} htmlFor={`${id}-kind`}>
        {t('testAutomation.field.operand')}
        <select
          id={`${id}-kind`}
          data-testid={`${id}-kind`}
          className={FIELD_CLASS}
          value={operand.kind}
          onChange={(event) => changeKind(event.target.value as Operand['kind'])}
        >
          {(Object.keys(OPERAND_LABELS) as Operand['kind'][]).map((kind) => (
            <option key={kind} value={kind}>
              {t(OPERAND_LABELS[kind])}
            </option>
          ))}
        </select>
      </label>

      {operand.kind === 'constant' ? (
        <label className={LABEL_CLASS} htmlFor={`${id}-value`}>
          {t('testAutomation.field.value')}
          <input
            id={`${id}-value`}
            data-testid={`${id}-value`}
            className={FIELD_CLASS}
            value={operand.value}
            onChange={(event) => onChange({ kind: 'constant', value: numberOr(event.target.value, 0) })}
          />
        </label>
      ) : null}

      {operand.kind === 'variable' ? (
        <label className={LABEL_CLASS} htmlFor={`${id}-name`}>
          {t('testAutomation.field.variableName')}
          <input
            id={`${id}-name`}
            data-testid={`${id}-name`}
            className={FIELD_CLASS}
            value={operand.name}
            onChange={(event) => onChange({ kind: 'variable', name: event.target.value })}
          />
        </label>
      ) : null}

      {operand.kind === 'frame-field' ? (
        <>
          <label className={LABEL_CLASS} htmlFor={`${id}-offset`}>
            {t('testAutomation.field.offset')}
            <input
              id={`${id}-offset`}
              data-testid={`${id}-offset`}
              className={`${FIELD_CLASS} w-20`}
              value={operand.offset}
              onChange={(event) => onChange({ ...operand, offset: numberOr(event.target.value, 0) })}
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-width`}>
            {t('testAutomation.field.width')}
            <select
              id={`${id}-width`}
              className={FIELD_CLASS}
              value={operand.width}
              onChange={(event) => onChange({ ...operand, width: Number(event.target.value) as FieldWidth })}
            >
              {WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-endianness`}>
            {t('testAutomation.field.endianness')}
            <select
              id={`${id}-endianness`}
              className={FIELD_CLASS}
              value={operand.endianness}
              onChange={(event) => onChange({ ...operand, endianness: event.target.value as FieldEndianness })}
            >
              {ENDIANNESSES.map((endianness) => (
                <option key={endianness} value={endianness}>
                  {endianness === 'big' ? 'BE' : 'LE'}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-scale`}>
            {t('testAutomation.field.scale')}
            <input
              id={`${id}-scale`}
              className={`${FIELD_CLASS} w-20`}
              value={operand.scale ?? 1}
              onChange={(event) => onChange({ ...operand, scale: numberOr(event.target.value, 1) })}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

export interface ConditionEditorProps {
  readonly id: string;
  readonly condition: Condition;
  readonly onChange: (condition: Condition) => void;
}

export function ConditionEditor({ id, condition, onChange }: ConditionEditorProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 rounded-token-sm border border-line p-2">
      <label className={LABEL_CLASS} htmlFor={`${id}-condition-kind`}>
        {t('testAutomation.field.conditionKind')}
        <select
          id={`${id}-condition-kind`}
          data-testid={`${id}-condition-kind`}
          className={FIELD_CLASS}
          value={condition.kind}
          onChange={(event) =>
            onChange(
              event.target.value === 'mask'
                ? { kind: 'mask', operand: { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' }, mask: 0xff, expected: 0 }
                : {
                    kind: 'compare',
                    left: { kind: 'frame-field', offset: 0, width: 1, endianness: 'big' },
                    operator: '==',
                    right: { kind: 'constant', value: 0 },
                  },
            )
          }
        >
          <option value="compare">{t('testAutomation.condition.compare')}</option>
          <option value="mask">{t('testAutomation.condition.mask')}</option>
        </select>
      </label>

      {condition.kind === 'compare' ? (
        <>
          <OperandEditor id={`${id}-left`} operand={condition.left} onChange={(left) => onChange({ ...condition, left })} />
          <label className={LABEL_CLASS} htmlFor={`${id}-operator`}>
            {t('testAutomation.field.operator')}
            <select
              id={`${id}-operator`}
              data-testid={`${id}-operator`}
              className={`${FIELD_CLASS} w-24`}
              value={condition.operator}
              onChange={(event) => onChange({ ...condition, operator: event.target.value as ComparisonOperator })}
            >
              {COMPARISON_OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </label>
          <OperandEditor id={`${id}-right`} operand={condition.right} onChange={(right) => onChange({ ...condition, right })} />
        </>
      ) : (
        <>
          <OperandEditor
            id={`${id}-operand`}
            operand={condition.operand}
            onChange={(operand) => onChange({ ...condition, operand })}
          />
          <div className="flex flex-wrap gap-2">
            <label className={LABEL_CLASS} htmlFor={`${id}-mask`}>
              {t('testAutomation.field.mask')}
              <input
                id={`${id}-mask`}
                className={`${FIELD_CLASS} w-24`}
                value={`0x${condition.mask.toString(16).toUpperCase()}`}
                onChange={(event) => onChange({ ...condition, mask: maskNumberOr(event.target.value, condition.mask) })}
              />
            </label>
            <label className={LABEL_CLASS} htmlFor={`${id}-expected`}>
              {t('testAutomation.field.expected')}
              <input
                id={`${id}-expected`}
                className={`${FIELD_CLASS} w-24`}
                value={condition.expected}
                onChange={(event) => onChange({ ...condition, expected: maskNumberOr(event.target.value, 0) })}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

export interface StepFieldsProps {
  readonly step: TestStep;
  readonly onChange: (step: TestStep) => void;
}

export function StepFields({ step, onChange }: StepFieldsProps): ReactNode {
  const { t } = useTranslation();
  /**
   * Şablon listesi store'dan DOĞRUDAN okunuyor, prop olarak indirilmiyor:
   * `ScenarioPanel` → adım satırı → burası üç katmanlık bir aktarım demekti ve
   * araya giren iki bileşenin şablonlarla hiçbir işi yok. Okuma bir seçim
   * (`selector`); protokol hesabı hâlâ bileşenin dışında.
   */
  const templates = useProtocolSchemaStore((store) => store.packetTemplates);
  const id = `step-${step.id}`;

  switch (step.kind) {
    case 'connect':
    case 'disconnect':
    case 'export-report':
      return null;

    case 'send-frame':
      return (
        <div className="flex flex-wrap items-end gap-2">
          <label className={LABEL_CLASS} htmlFor={`${id}-source`}>
            {t('testAutomation.field.payloadSource')}
            <select
              id={`${id}-source`}
              data-testid={`${id}-source`}
              className={FIELD_CLASS}
              value={step.payload.source}
              onChange={(event) => onChange({ ...step, payload: payloadFor(event.target.value, step.payload) })}
            >
              <option value="bytes">{t('testAutomation.payload.bytes')}</option>
              <option value="template">{t('testAutomation.payload.template')}</option>
              <option value="plugin-frame">{t('testAutomation.payload.pluginFrame')}</option>
            </select>
          </label>
          {step.payload.source === 'plugin-frame' ? (
            <label className={LABEL_CLASS} htmlFor={`${id}-plugin`}>
              {t('testAutomation.field.frameEncoder')}
              <select
                id={`${id}-plugin`}
                data-testid={`${id}-plugin`}
                className={FIELD_CLASS}
                value={step.payload.pluginId}
                onChange={(event) =>
                  onChange({
                    ...step,
                    payload: { source: 'plugin-frame', pluginId: event.target.value, bytes: payloadBytesOf(step.payload) },
                  })
                }
              >
                {/* Protokol adları veridir, sözlükten geçmez. */}
                {PAYLOAD_ENCODERS.map((entry) => (
                  <option key={entry.pluginId} value={entry.pluginId}>
                    {entry.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {step.payload.source === 'template' ? (
            <label className={LABEL_CLASS} htmlFor={`${id}-template`}>
              {t('testAutomation.field.templateId')}
              {/* Şablon kimliğini store üretir (`template-1`); elle yazmak
                  imkânsıza yakındı. Boş depo bir hata değil, bir DURUM: seçenek
                  yerine nereden geleceği yazılır. */}
              {templates.length === 0 ? (
                <span className="text-xs text-warn" data-testid={`${id}-template-empty`}>
                  {t('testAutomation.field.templateEmpty')}
                </span>
              ) : (
                <select
                  id={`${id}-template`}
                  data-testid={`${id}-template`}
                  className={FIELD_CLASS}
                  value={step.payload.templateId}
                  onChange={(event) =>
                    onChange({ ...step, payload: { source: 'template', templateId: event.target.value } })
                  }
                >
                  <option value="">{t('testAutomation.field.templateUnset')}</option>
                  {/* Şablon adı kullanıcı verisidir, çeviriye girmez. */}
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <label className={LABEL_CLASS} htmlFor={`${id}-bytes`}>
              {step.payload.source === 'bytes'
                ? t('testAutomation.field.bytes')
                : t('testAutomation.field.payloadBytes')}
              <input
                id={`${id}-bytes`}
                data-testid={`${id}-bytes`}
                className={`${FIELD_CLASS} font-mono`}
                value={hexOf(payloadBytesOf(step.payload))}
                onChange={(event) =>
                  onChange({
                    ...step,
                    payload:
                      step.payload.source === 'plugin-frame'
                        ? {
                            source: 'plugin-frame',
                            pluginId: step.payload.pluginId,
                            bytes: bytesOf(event.target.value),
                          }
                        : { source: 'bytes', bytes: bytesOf(event.target.value) },
                  })
                }
              />
            </label>
          )}
        </div>
      );

    case 'wait':
      return (
        <label className={LABEL_CLASS} htmlFor={`${id}-duration`}>
          {t('testAutomation.field.durationMs')}
          <input
            id={`${id}-duration`}
            data-testid={`${id}-duration`}
            className={`${FIELD_CLASS} w-28`}
            value={step.durationMs}
            onChange={(event) => onChange({ ...step, durationMs: numberOr(event.target.value, 0) })}
          />
        </label>
      );

    case 'wait-for-frame':
      return (
        <div className="flex flex-wrap items-end gap-2">
          <label className={LABEL_CLASS} htmlFor={`${id}-timeout`}>
            {t('testAutomation.field.timeoutMs')}
            <input
              id={`${id}-timeout`}
              data-testid={`${id}-timeout`}
              className={`${FIELD_CLASS} w-28`}
              value={step.timeoutMs}
              onChange={(event) => onChange({ ...step, timeoutMs: numberOr(event.target.value, 500) })}
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-match-offset`}>
            {t('testAutomation.field.matchOffset')}
            <input
              id={`${id}-match-offset`}
              className={`${FIELD_CLASS} w-20`}
              value={step.match?.offset ?? 0}
              onChange={(event) =>
                onChange({
                  ...step,
                  match: { offset: numberOr(event.target.value, 0), bytes: step.match?.bytes ?? [] },
                })
              }
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-match-bytes`}>
            {t('testAutomation.field.matchBytes')}
            <input
              id={`${id}-match-bytes`}
              data-testid={`${id}-match-bytes`}
              className={`${FIELD_CLASS} font-mono`}
              value={hexOf(step.match?.bytes ?? [])}
              onChange={(event) => {
                const bytes = bytesOf(event.target.value);
                // Boş filtre "herhangi bir çerçeve" demektir; boş bir dizi
                // bırakmak da aynı anlama gelirdi ama modeli açık tutuyoruz.
                onChange(
                  bytes.length === 0
                    ? { ...step, match: undefined }
                    : { ...step, match: { offset: step.match?.offset ?? 0, bytes } },
                );
              }}
            />
          </label>
        </div>
      );

    case 'validate-field':
      return <ConditionEditor id={id} condition={step.condition} onChange={(condition) => onChange({ ...step, condition })} />;

    case 'validate-crc':
      return (
        <div className="flex flex-wrap items-end gap-2">
          <label className={LABEL_CLASS} htmlFor={`${id}-algorithm`}>
            {t('testAutomation.field.algorithm')}
            <select
              id={`${id}-algorithm`}
              data-testid={`${id}-algorithm`}
              className={FIELD_CLASS}
              value={step.algorithm}
              onChange={(event) => onChange({ ...step, algorithm: event.target.value as ChecksumAlgorithm })}
            >
              {CHECKSUM_ALGORITHMS.filter((algorithm) => algorithm !== 'none').map((algorithm) => (
                <option key={algorithm} value={algorithm}>
                  {algorithm}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-data-start`}>
            {t('testAutomation.field.dataStart')}
            <input
              id={`${id}-data-start`}
              className={`${FIELD_CLASS} w-20`}
              value={step.dataStart}
              onChange={(event) => onChange({ ...step, dataStart: numberOr(event.target.value, 0) })}
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-trailing`}>
            {t('testAutomation.field.trailingOffset')}
            <input
              id={`${id}-trailing`}
              className={`${FIELD_CLASS} w-20`}
              value={step.trailingOffset}
              onChange={(event) => onChange({ ...step, trailingOffset: numberOr(event.target.value, 0) })}
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-crc-endianness`}>
            {t('testAutomation.field.endianness')}
            <select
              id={`${id}-crc-endianness`}
              className={FIELD_CLASS}
              value={step.endianness}
              onChange={(event) => onChange({ ...step, endianness: event.target.value as 'big' | 'little' })}
            >
              <option value="big">BE</option>
              <option value="little">LE</option>
            </select>
          </label>
        </div>
      );

    case 'set-variable':
      return (
        <div className="flex flex-col gap-2">
          <label className={LABEL_CLASS} htmlFor={`${id}-variable`}>
            {t('testAutomation.field.variableName')}
            <input
              id={`${id}-variable`}
              data-testid={`${id}-variable`}
              className={FIELD_CLASS}
              value={step.name}
              onChange={(event) => onChange({ ...step, name: event.target.value })}
            />
          </label>
          <OperandEditor id={`${id}-value`} operand={step.value} onChange={(value) => onChange({ ...step, value })} />
        </div>
      );

    case 'increment-variable':
      return (
        <div className="flex flex-wrap items-end gap-2">
          <label className={LABEL_CLASS} htmlFor={`${id}-variable`}>
            {t('testAutomation.field.variableName')}
            <input
              id={`${id}-variable`}
              className={FIELD_CLASS}
              value={step.name}
              onChange={(event) => onChange({ ...step, name: event.target.value })}
            />
          </label>
          <label className={LABEL_CLASS} htmlFor={`${id}-by`}>
            {t('testAutomation.field.by')}
            <input
              id={`${id}-by`}
              className={`${FIELD_CLASS} w-20`}
              value={step.by}
              onChange={(event) => onChange({ ...step, by: numberOr(event.target.value, 1) })}
            />
          </label>
        </div>
      );

    case 'loop':
      return (
        <label className={LABEL_CLASS} htmlFor={`${id}-count`}>
          {t('testAutomation.field.count')}
          <input
            id={`${id}-count`}
            data-testid={`${id}-count`}
            className={`${FIELD_CLASS} w-24`}
            value={step.count}
            onChange={(event) => onChange({ ...step, count: Math.trunc(numberOr(event.target.value, 1)) })}
          />
        </label>
      );

    case 'conditional':
      return <ConditionEditor id={id} condition={step.condition} onChange={(condition) => onChange({ ...step, condition })} />;

    case 'log':
      return (
        <label className={LABEL_CLASS} htmlFor={`${id}-message`}>
          {t('testAutomation.field.message')}
          <input
            id={`${id}-message`}
            data-testid={`${id}-message`}
            className={FIELD_CLASS}
            value={step.message}
            onChange={(event) => onChange({ ...step, message: event.target.value })}
          />
        </label>
      );
  }
}
