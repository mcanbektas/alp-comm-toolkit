import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField } from '@/components/forms';
import {
  calculateLoopCompliance,
  classifyLoopCurrent,
  engineeringValueFromCurrent,
  normalizedFromCurrent,
  shuntVoltage,
} from '@/protocol-core';
import type { LoopCurrentState } from '@/protocol-core';
import type { TranslationKey } from '@/translations';
import { ErrorNotice, SectionSwitch, StatTable } from './shared';

/**
 * Akım döngüsü aracı — Current Loop ve 4–20 mA sayfalarının TEK motoru
 * (`protocol-core/timing/currentLoop.ts`). Bu iki katalog kaydının decode'u
 * yoktur; LoRa paterniyle (`status:'partial'`, `pluginId` yok) buraya bağlanır.
 *
 * İki bölüm, `Rs485TimingTool`in bölüm anahtarı deseniyle: ölçekleme (akım ↔
 * mühendislik değeri, shunt gerilimi, durum) ve loop compliance bütçesi.
 *
 * Arıza eşikleri (kopuk döngü / kısa devre) BOŞ gelir: kaynak bu iki durum için
 * sayı vermiyor, boş bırakılırsa hiç raporlanmazlar.
 */

/** `t()` anahtar birliğine bağlı: eksik/yanlış anahtar derleme hatası olur. */
const LOOP_STATE_KEYS: Record<LoopCurrentState, TranslationKey> = {
  'open-loop': 'calc.loopState.openLoop',
  'under-range': 'calc.loopState.underRange',
  normal: 'calc.loopState.normal',
  'over-range': 'calc.loopState.overRange',
  'short-suspected': 'calc.loopState.shortSuspected',
};

type CurrentLoopSection = 'scaling' | 'compliance';

export function CurrentLoopTool(): ReactElement {
  const { t } = useTranslation();
  const [section, setSection] = useState<CurrentLoopSection>('scaling');

  const sectionOptions: Array<{ value: CurrentLoopSection; label: string }> = [
    { value: 'scaling', label: t('calc.field.loopScaling') },
    { value: 'compliance', label: t('calc.field.loopCompliance') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitch value={section} onChange={setSection} options={sectionOptions} />
      {section === 'scaling' ? <LoopScalingSection /> : <LoopComplianceSection />}
    </div>
  );
}

function LoopScalingSection(): ReactElement {
  const { t } = useTranslation();
  // Varsayılanlar spec'in kendi örneği: 0–250 bar aralığında 13.6 mA → 150 bar.
  const [minValue, setMinValue] = useState('0');
  const [maxValue, setMaxValue] = useState('250');
  const [milliamps, setMilliamps] = useState('13.6');
  const [shuntOhms, setShuntOhms] = useState('250');
  const [openLoopBelow, setOpenLoopBelow] = useState('');
  const [shortAbove, setShortAbove] = useState('');

  const result = useMemo(() => {
    try {
      const current = Number(milliamps);
      const range = { minValue: Number(minValue), maxValue: Number(maxValue) };
      return {
        engineeringValue: engineeringValueFromCurrent(current, range),
        normalized: normalizedFromCurrent(current),
        shuntVolts: shuntVoltage(current, Number(shuntOhms)),
        state: classifyLoopCurrent(current, {
          ...(openLoopBelow.trim().length === 0
            ? {}
            : { openLoopBelowMilliamps: Number(openLoopBelow) }),
          ...(shortAbove.trim().length === 0 ? {} : { shortAboveMilliamps: Number(shortAbove) }),
        }),
      };
    } catch {
      return null;
    }
  }, [minValue, maxValue, milliamps, shuntOhms, openLoopBelow, shortAbove]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-loop-current"
          label={t('calc.field.loopCurrentMa')}
          value={milliamps}
          onChange={setMilliamps}
          step={0.1}
          suffix="mA"
        />
        <NumberField
          id="calc-loop-shunt"
          label={t('calc.field.shuntOhms')}
          value={shuntOhms}
          onChange={setShuntOhms}
          suffix="Ω"
        />
        <NumberField
          id="calc-loop-min"
          label={t('calc.field.rangeMinValue')}
          value={minValue}
          onChange={setMinValue}
        />
        <NumberField
          id="calc-loop-max"
          label={t('calc.field.rangeMaxValue')}
          value={maxValue}
          onChange={setMaxValue}
        />
        <NumberField
          id="calc-loop-openloop"
          label={t('calc.field.openLoopBelowOptional')}
          value={openLoopBelow}
          onChange={setOpenLoopBelow}
          step={0.1}
          suffix="mA"
        />
        <NumberField
          id="calc-loop-short"
          label={t('calc.field.shortAboveOptional')}
          value={shortAbove}
          onChange={setShortAbove}
          step={0.1}
          suffix="mA"
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.engineeringValue'), result.engineeringValue.toFixed(2)],
            [t('calc.field.normalizedPercent'), `${(result.normalized * 100).toFixed(2)} %`],
            [t('calc.field.shuntVoltageOut'), `${result.shuntVolts.toFixed(3)} V`],
            [t('calc.field.loopState'), t(LOOP_STATE_KEYS[result.state])],
          ]}
        />
      )}
    </div>
  );
}

function LoopComplianceSection(): ReactElement {
  const { t } = useTranslation();
  // Varsayılanlar spec'in compliance örneği: 24 V, transmitter 10 V, 100 Ω, 250 Ω, 20 mA.
  const [supplyVolts, setSupplyVolts] = useState('24');
  const [transmitterMinVolts, setTransmitterMinVolts] = useState('10');
  const [cableOhms, setCableOhms] = useState('100');
  const [loadOhms, setLoadOhms] = useState('250');
  const [milliamps, setMilliamps] = useState('20');
  const [marginVolts, setMarginVolts] = useState('');

  const result = useMemo(() => {
    try {
      return calculateLoopCompliance({
        supplyVolts: Number(supplyVolts),
        transmitterMinVolts: Number(transmitterMinVolts),
        cableOhms: Number(cableOhms),
        loadOhms: Number(loadOhms),
        loopCurrentMilliamps: Number(milliamps),
        ...(marginVolts.trim().length === 0 ? {} : { marginVolts: Number(marginVolts) }),
      });
    } catch {
      return null;
    }
  }, [supplyVolts, transmitterMinVolts, cableOhms, loadOhms, milliamps, marginVolts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-loop-supply"
          label={t('calc.field.loopSupplyVolts')}
          value={supplyVolts}
          onChange={setSupplyVolts}
          suffix="V"
        />
        <NumberField
          id="calc-loop-txmin"
          label={t('calc.field.transmitterMinVolts')}
          value={transmitterMinVolts}
          onChange={setTransmitterMinVolts}
          suffix="V"
        />
        <NumberField
          id="calc-loop-cable"
          label={t('calc.field.cableOhms')}
          value={cableOhms}
          onChange={setCableOhms}
          suffix="Ω"
        />
        <NumberField
          id="calc-loop-load"
          label={t('calc.field.loadOhms')}
          value={loadOhms}
          onChange={setLoadOhms}
          suffix="Ω"
        />
        <NumberField
          id="calc-loop-compliance-current"
          label={t('calc.field.loopCurrentMa')}
          value={milliamps}
          onChange={setMilliamps}
          step={0.1}
          suffix="mA"
        />
        <NumberField
          id="calc-loop-margin"
          label={t('calc.field.marginVoltsOptional')}
          value={marginVolts}
          onChange={setMarginVolts}
          suffix="V"
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.cableDropVolts'), `${result.cableDropVolts.toFixed(2)} V`],
            [t('calc.field.loadDropVolts'), `${result.loadDropVolts.toFixed(2)} V`],
            [t('calc.field.requiredVolts'), `${result.requiredVolts.toFixed(2)} V`],
            [
              t('calc.field.remainingCompliance'),
              `${result.remainingComplianceVolts.toFixed(2)} V`,
            ],
            [
              t('calc.field.loopVerdict'),
              result.sufficient
                ? t('calc.loopCompliance.sufficient')
                : t('calc.loopCompliance.insufficient'),
            ],
          ]}
        />
      )}
    </div>
  );
}
