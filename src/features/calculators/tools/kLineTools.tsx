import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, SelectField } from '@/components/forms';
import {
  calculateFastInitPulse,
  calculateFiveBaudInit,
  calculateUartTiming,
  evaluateTimingWindow,
} from '@/protocol-core';
import type { UartParity } from '@/protocol-core';
import { ErrorNotice, SectionSwitch, StatTable, formatSeconds } from './shared';

/**
 * K-Line hesap aracı — `k-line` katalog kaydının TEK motoru
 * (`protocol-core/timing/kLine.ts`). Kaydın decode'u yoktur (LoRa paterni,
 * `vehiclePhyTools.tsx`/`singlePairEthernetTools.tsx` emsali); sayfa buraya
 * `calculatorIds` ile bağlanır.
 *
 * Üç bölüm: 5-baud init süresi, fast init darbe bütçesi, bayt süresi + genel
 * aralık penceresi (inter-byte VE inter-message gap aynı pencere motorunu
 * paylaşır — `kLine.ts`teki `evaluateTimingWindow` gerekçesi).
 */

const MILLISECONDS_PER_SECOND = 1e3;

function millisecondsToSeconds(value: string): number {
  return Number(value) / MILLISECONDS_PER_SECOND;
}

const PARITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'even', label: 'Even' },
  { value: 'odd', label: 'Odd' },
];

type KLineSection = 'fiveBaud' | 'fastInit' | 'gap';

export function KLineTool(): ReactElement {
  const { t } = useTranslation();
  const [section, setSection] = useState<KLineSection>('fiveBaud');

  const options: Array<{ value: KLineSection; label: string }> = [
    { value: 'fiveBaud', label: t('calc.field.kLineFiveBaudSection') },
    { value: 'fastInit', label: t('calc.field.kLineFastInitSection') },
    { value: 'gap', label: t('calc.field.kLineGapSection') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitch value={section} onChange={setSection} options={options} />
      {section === 'fiveBaud' && <FiveBaudSection />}
      {section === 'fastInit' && <FastInitSection />}
      {section === 'gap' && <GapBudgetSection />}
    </div>
  );
}

function FiveBaudSection(): ReactElement {
  const { t } = useTranslation();
  const [dataBits, setDataBits] = useState('8');
  const [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState('none');

  const result = useMemo(() => {
    try {
      return calculateFiveBaudInit({
        dataBits: Number(dataBits),
        stopBits: Number(stopBits),
        parity: parity as UartParity,
      });
    } catch {
      return null;
    }
  }, [dataBits, stopBits, parity]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-kline-databits" label={t('calc.field.dataBits')} value={dataBits} onChange={setDataBits} />
        <NumberField id="calc-kline-stopbits" label={t('calc.field.stopBits')} value={stopBits} onChange={setStopBits} />
        <SelectField id="calc-kline-parity" label={t('calc.field.parity')} value={parity} onChange={setParity} options={PARITY_OPTIONS} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.bitTime'), formatSeconds(result.bitTimeSeconds)],
            [t('calc.field.bitsPerCharacter'), String(result.bitsPerCharacter)],
            [t('calc.field.addressByteDuration'), formatSeconds(result.addressByteDurationSeconds)],
          ]}
        />
      )}
    </div>
  );
}

function FastInitSection(): ReactElement {
  const { t } = useTranslation();
  const [lowPulseMs, setLowPulseMs] = useState('25');
  const [highPulseMs, setHighPulseMs] = useState('25');
  const [minTotalMs, setMinTotalMs] = useState('');
  const [maxTotalMs, setMaxTotalMs] = useState('');

  const result = useMemo(() => {
    try {
      return calculateFastInitPulse({
        lowPulseSeconds: millisecondsToSeconds(lowPulseMs),
        highPulseSeconds: millisecondsToSeconds(highPulseMs),
      });
    } catch {
      return null;
    }
  }, [lowPulseMs, highPulseMs]);

  const window = useMemo(() => {
    if (result === null) return null;
    if (minTotalMs.trim().length === 0 || maxTotalMs.trim().length === 0) return null;
    try {
      return evaluateTimingWindow({
        measuredSeconds: result.totalDurationSeconds,
        minSeconds: millisecondsToSeconds(minTotalMs),
        maxSeconds: millisecondsToSeconds(maxTotalMs),
      });
    } catch {
      return null;
    }
  }, [result, minTotalMs, maxTotalMs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-kline-lowpulse"
          label={t('calc.field.fastInitLowPulseMs')}
          value={lowPulseMs}
          onChange={setLowPulseMs}
        />
        <NumberField
          id="calc-kline-highpulse"
          label={t('calc.field.fastInitHighPulseMs')}
          value={highPulseMs}
          onChange={setHighPulseMs}
        />
        <NumberField
          id="calc-kline-mintotal"
          label={t('calc.field.fastInitMinTotalMsOptional')}
          value={minTotalMs}
          onChange={setMinTotalMs}
        />
        <NumberField
          id="calc-kline-maxtotal"
          label={t('calc.field.fastInitMaxTotalMsOptional')}
          value={maxTotalMs}
          onChange={setMaxTotalMs}
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.fastInitTotalDuration'), formatSeconds(result.totalDurationSeconds)],
            ...(window === null
              ? []
              : ([
                  [
                    t('calc.field.kLineWindowVerdict'),
                    window.withinWindow
                      ? t('calc.kLine.withinWindow')
                      : window.belowMinimum
                        ? t('calc.kLine.belowMinimum')
                        : t('calc.kLine.aboveMaximum'),
                  ],
                ] as const)),
          ]}
        />
      )}
    </div>
  );
}

function GapBudgetSection(): ReactElement {
  const { t } = useTranslation();
  const [baudRate, setBaudRate] = useState('10400');
  const [dataBits, setDataBits] = useState('8');
  const [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState('none');
  const [measuredMs, setMeasuredMs] = useState('5');
  const [minMs, setMinMs] = useState('1');
  const [maxMs, setMaxMs] = useState('20');

  const byteTime = useMemo(() => {
    try {
      return calculateUartTiming({
        baudRate: Number(baudRate),
        dataBits: Number(dataBits),
        stopBits: Number(stopBits),
        parity: parity as UartParity,
      });
    } catch {
      return null;
    }
  }, [baudRate, dataBits, stopBits, parity]);

  const window = useMemo(() => {
    try {
      return evaluateTimingWindow({
        measuredSeconds: millisecondsToSeconds(measuredMs),
        minSeconds: millisecondsToSeconds(minMs),
        maxSeconds: millisecondsToSeconds(maxMs),
      });
    } catch {
      return null;
    }
  }, [measuredMs, minMs, maxMs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-kline-baud" label={t('calc.field.baudRate')} value={baudRate} onChange={setBaudRate} />
        <NumberField id="calc-kline-gap-databits" label={t('calc.field.dataBits')} value={dataBits} onChange={setDataBits} />
        <NumberField id="calc-kline-gap-stopbits" label={t('calc.field.stopBits')} value={stopBits} onChange={setStopBits} />
        <SelectField id="calc-kline-gap-parity" label={t('calc.field.parity')} value={parity} onChange={setParity} options={PARITY_OPTIONS} />
        <NumberField id="calc-kline-measured" label={t('calc.field.kLineMeasuredGapMs')} value={measuredMs} onChange={setMeasuredMs} />
        <NumberField id="calc-kline-mingap" label={t('calc.field.kLineMinGapMs')} value={minMs} onChange={setMinMs} />
        <NumberField id="calc-kline-maxgap" label={t('calc.field.kLineMaxGapMs')} value={maxMs} onChange={setMaxMs} />
      </div>
      {byteTime === null || window === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.characterTime'), formatSeconds(byteTime.characterTimeSeconds)],
            [
              t('calc.field.kLineWindowVerdict'),
              window.withinWindow
                ? t('calc.kLine.withinWindow')
                : window.belowMinimum
                  ? t('calc.kLine.belowMinimum')
                  : t('calc.kLine.aboveMaximum'),
            ],
          ]}
        />
      )}
    </div>
  );
}
