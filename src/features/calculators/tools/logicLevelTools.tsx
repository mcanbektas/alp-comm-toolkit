import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField } from '@/components/forms';
import { evaluateLogicLevelLink } from '@/protocol-core';
import type { LogicLevelDevice, LogicLevelDirectionResult } from '@/protocol-core';
import { ErrorNotice, StatTable } from './shared';

/**
 * Logic seviyesi uyumluluk aracı — TTL UART / CMOS UART sayfalarının asıl
 * mühendislik sorusu (motor: `protocol-core/timing/logicLevels.ts`).
 *
 * Form BİLEREK dört eşiği tek tek ister; "3.3V mi 5V mi" seçtiren bir hazır
 * profil listesi YOKTUR — kaynak bunu açıkça yanlış sayıyor
 * (`docs/spec/ozet/01-fiziksel-arayuzler.md:181`), karar datasheet
 * değerleriyle verilir. Mutlak maksimum alanı opsiyoneldir: boş bırakılırsa
 * aşırı gerilim kontrolü hiç yapılmaz, varsayım üretilmez.
 */

/** Varsayılanlar spec'in CMOS örneğindeki asimetriyi (3.3V ↔ 1.8V) doğrudan gösterir. */
const DEFAULT_A = { voh: '3.0', vol: '0.4', vih: '2.0', vil: '0.8', absMax: '' };
const DEFAULT_B = { voh: '1.8', vol: '0.45', vih: '1.17', vil: '0.63', absMax: '' };

interface DeviceFormState {
  voh: string;
  vol: string;
  vih: string;
  vil: string;
  absMax: string;
}

function toDevice(state: DeviceFormState): LogicLevelDevice {
  const absoluteMax = state.absMax.trim();
  return {
    vohMinVolts: Number(state.voh),
    volMaxVolts: Number(state.vol),
    vihMinVolts: Number(state.vih),
    vilMaxVolts: Number(state.vil),
    ...(absoluteMax.length === 0 ? {} : { absoluteMaxInputVolts: Number(absoluteMax) }),
  };
}

function formatVolts(value: number): string {
  return `${value.toFixed(2)} V`;
}

export function LogicLevelCompatibilityTool(): ReactElement {
  const { t } = useTranslation();
  const [deviceA, setDeviceA] = useState<DeviceFormState>(DEFAULT_A);
  const [deviceB, setDeviceB] = useState<DeviceFormState>(DEFAULT_B);

  const result = useMemo(() => {
    try {
      return evaluateLogicLevelLink(toDevice(deviceA), toDevice(deviceB));
    } catch {
      return null;
    }
  }, [deviceA, deviceB]);

  const directionRows = (direction: LogicLevelDirectionResult): ReadonlyArray<readonly [string, string]> => [
    [
      t('calc.field.logicVerdict'),
      direction.compatible ? t('calc.logicLevel.pass') : t('calc.logicLevel.warning'),
    ],
    [t('calc.field.highNoiseMargin'), formatVolts(direction.highMarginVolts)],
    [t('calc.field.lowNoiseMargin'), formatVolts(direction.lowMarginVolts)],
    ...(direction.overvoltage
      ? ([[t('calc.field.overvoltage'), t('calc.logicLevel.overvoltage')] as const])
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">{t('calc.logicLevel.note')}</p>

      <DeviceFields
        idPrefix="calc-logic-a"
        label={t('calc.field.deviceA')}
        state={deviceA}
        onChange={setDeviceA}
      />
      <DeviceFields
        idPrefix="calc-logic-b"
        label={t('calc.field.deviceB')}
        state={deviceB}
        onChange={setDeviceB}
      />

      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('calc.field.directionAToB')}
            </h3>
            <StatTable rows={directionRows(result.aToB)} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('calc.field.directionBToA')}
            </h3>
            <StatTable rows={directionRows(result.bToA)} />
          </section>
        </div>
      )}
    </div>
  );
}

function DeviceFields({
  idPrefix,
  label,
  state,
  onChange,
}: {
  idPrefix: string;
  label: string;
  state: DeviceFormState;
  onChange: (next: DeviceFormState) => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-voh`}
          label={t('calc.field.vohMin')}
          value={state.voh}
          onChange={(value) => {
            onChange({ ...state, voh: value });
          }}
          step={0.01}
          suffix="V"
        />
        <NumberField
          id={`${idPrefix}-vol`}
          label={t('calc.field.volMax')}
          value={state.vol}
          onChange={(value) => {
            onChange({ ...state, vol: value });
          }}
          step={0.01}
          suffix="V"
        />
        <NumberField
          id={`${idPrefix}-vih`}
          label={t('calc.field.vihMin')}
          value={state.vih}
          onChange={(value) => {
            onChange({ ...state, vih: value });
          }}
          step={0.01}
          suffix="V"
        />
        <NumberField
          id={`${idPrefix}-vil`}
          label={t('calc.field.vilMax')}
          value={state.vil}
          onChange={(value) => {
            onChange({ ...state, vil: value });
          }}
          step={0.01}
          suffix="V"
        />
        <NumberField
          id={`${idPrefix}-absmax`}
          label={t('calc.field.absoluteMaxOptional')}
          value={state.absMax}
          onChange={(value) => {
            onChange({ ...state, absMax: value });
          }}
          step={0.01}
          suffix="V"
        />
      </div>
    </section>
  );
}
