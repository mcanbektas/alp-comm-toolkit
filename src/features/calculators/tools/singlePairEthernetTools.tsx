import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, SelectField } from '@/components/forms';
import {
  calculatePlcaBurst,
  calculatePlcaCycle,
  calculateSpeFrameTime,
  PLCA_REGISTER_DEFAULTS,
  SPE_BIT_RATES,
} from '@/protocol-core';
import type { SpePhyType } from '@/protocol-core';
import { ErrorNotice, formatSeconds, SectionSwitch, StatTable } from './shared';

/**
 * Single Pair Ethernet aracı — `single-pair-ethernet` katalog kaydının TEK
 * motoru (`protocol-core/timing/singlePairEthernet.ts`). Kaydın decode'u
 * yoktur (LoRa paterni); PHY sınıfı seçimi + PLCA çevrim bütçesi burada.
 *
 * İki bölüm, `CurrentLoopTool`un bölüm anahtarı deseniyle: PHY/çerçeve süresi
 * ve PLCA çevrimi (burst dahil).
 *
 * **BEACON alanı BOŞ gelir:** elimizdeki iki kaynak (IEEE 802.3cg'nin kamuya
 * açık PLCA register belgesi ve spec özeti) BEACON'ın bit uzunluğunu vermiyor.
 * Boş bırakılırsa çevrime eklenmez ve sonuç tablosu bunu ayrıca söyler —
 * 4–20 mA arıza eşikleri ve LIN break asgarisindeki disiplin.
 */

const PHY_OPTIONS: ReadonlyArray<{ value: SpePhyType; label: string }> = [
  { value: '10base-t1s', label: '10BASE-T1S' },
  { value: '10base-t1l', label: '10BASE-T1L' },
  { value: '100base-t1', label: '100BASE-T1' },
  { value: '1000base-t1', label: '1000BASE-T1' },
];

type SpeSection = 'phy' | 'plca';

export function SinglePairEthernetTool(): ReactElement {
  const { t } = useTranslation();
  const [section, setSection] = useState<SpeSection>('phy');

  const sectionOptions: Array<{ value: SpeSection; label: string }> = [
    { value: 'phy', label: t('calc.field.spePhySection') },
    { value: 'plca', label: t('calc.field.plcaSection') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitch value={section} onChange={setSection} options={sectionOptions} />
      {section === 'phy' ? <SpePhySection /> : <PlcaCycleSection />}
    </div>
  );
}

function SpePhySection(): ReactElement {
  const { t } = useTranslation();
  const [phy, setPhy] = useState<SpePhyType>('10base-t1s');
  // Varsayılan 64 bayt: Ethernet'in asgari çerçeve boyu.
  const [frameBytes, setFrameBytes] = useState('64');
  const [gapBitTimes, setGapBitTimes] = useState('96');

  const result = useMemo(() => {
    try {
      return calculateSpeFrameTime({
        phy,
        frameBytes: Number(frameBytes),
        ...(gapBitTimes.trim().length === 0 ? {} : { interFrameGapBitTimes: Number(gapBitTimes) }),
      });
    } catch {
      return null;
    }
  }, [phy, frameBytes, gapBitTimes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="calc-spe-phy"
          label={t('calc.field.spePhyType')}
          value={phy}
          onChange={(value) => {
            setPhy(value as SpePhyType);
          }}
          options={PHY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        <NumberField
          id="calc-spe-frame"
          label={t('calc.field.frameBytes')}
          value={frameBytes}
          onChange={setFrameBytes}
          suffix="B"
        />
        <NumberField
          id="calc-spe-gap"
          label={t('calc.field.interFrameGapBits')}
          value={gapBitTimes}
          onChange={setGapBitTimes}
          suffix="BT"
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.lineRate'), `${(SPE_BIT_RATES[phy] / 1e6).toFixed(0)} Mbit/s`],
            [t('calc.field.bitTime'), formatSeconds(result.bitTimeSeconds)],
            [t('calc.field.frameBitTimes'), `${result.frameBitTimes} BT`],
            [t('calc.field.frameTime'), formatSeconds(result.frameSeconds)],
            [t('calc.field.frameTimeWithGap'), formatSeconds(result.totalSeconds)],
          ]}
        />
      )}
    </div>
  );
}

function PlcaCycleSection(): ReactElement {
  const { t } = useTranslation();
  const [nodeCount, setNodeCount] = useState('8');
  const [transmitting, setTransmitting] = useState('2');
  const [frameBytes, setFrameBytes] = useState('64');
  // OPEN Alliance PLCA Management Registers v1.2 varsayılanları.
  const [toTimer, setToTimer] = useState(String(PLCA_REGISTER_DEFAULTS.toTimerBitTimes));
  const [maxBurst, setMaxBurst] = useState(String(PLCA_REGISTER_DEFAULTS.maxBurstCount));
  const [burstTimer, setBurstTimer] = useState(String(PLCA_REGISTER_DEFAULTS.burstTimerBitTimes));
  // Kaynaklarda sayı YOK — bilerek boş.
  const [beacon, setBeacon] = useState('');

  const result = useMemo(() => {
    try {
      const cycle = calculatePlcaCycle({
        phy: '10base-t1s',
        nodeCount: Number(nodeCount),
        transmittingNodes: Number(transmitting),
        frameBytes: Number(frameBytes),
        toTimerBitTimes: Number(toTimer),
        ...(beacon.trim().length === 0 ? {} : { beaconBitTimes: Number(beacon) }),
      });
      const burst = calculatePlcaBurst({
        phy: '10base-t1s',
        maxBurstCount: Number(maxBurst),
        burstTimerBitTimes: Number(burstTimer),
        frameBytes: Number(frameBytes),
      });
      return { cycle, burst };
    } catch {
      return null;
    }
  }, [nodeCount, transmitting, frameBytes, toTimer, beacon, maxBurst, burstTimer]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-plca-nodes" label={t('calc.field.plcaNodeCount')} value={nodeCount} onChange={setNodeCount} />
        <NumberField
          id="calc-plca-transmitting"
          label={t('calc.field.plcaTransmittingNodes')}
          value={transmitting}
          onChange={setTransmitting}
        />
        <NumberField
          id="calc-plca-frame"
          label={t('calc.field.frameBytes')}
          value={frameBytes}
          onChange={setFrameBytes}
          suffix="B"
        />
        <NumberField
          id="calc-plca-totimer"
          label={t('calc.field.plcaToTimer')}
          value={toTimer}
          onChange={setToTimer}
          suffix="BT"
        />
        <NumberField
          id="calc-plca-maxbc"
          label={t('calc.field.plcaMaxBurstCount')}
          value={maxBurst}
          onChange={setMaxBurst}
        />
        <NumberField
          id="calc-plca-btmr"
          label={t('calc.field.plcaBurstTimer')}
          value={burstTimer}
          onChange={setBurstTimer}
          suffix="BT"
        />
        <NumberField
          id="calc-plca-beacon"
          label={t('calc.field.plcaBeaconOptional')}
          value={beacon}
          onChange={setBeacon}
          suffix="BT"
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <>
          <StatTable
            rows={[
              [t('calc.field.plcaIdleBits'), `${result.cycle.idleBitTimes} BT`],
              [t('calc.field.plcaTransmitBits'), `${result.cycle.transmitBitTimes} BT`],
              [t('calc.field.plcaCycleBits'), `${result.cycle.cycleBitTimes} BT`],
              [t('calc.field.plcaCycleTime'), formatSeconds(result.cycle.cycleSeconds)],
              [t('calc.field.plcaWorstCase'), formatSeconds(result.cycle.worstCaseAccessSeconds)],
              [t('calc.field.plcaEfficiency'), `${result.cycle.efficiencyPercent.toFixed(1)} %`],
              [
                t('calc.field.plcaBurstWindow'),
                result.burst.enabled
                  ? `${result.burst.packetsPerOpportunity} × · ${formatSeconds(result.burst.opportunitySeconds)}`
                  : t('calc.field.plcaBurstDisabled'),
              ],
            ]}
          />
          {result.cycle.beaconOmitted ? (
            // Hata DEĞİL, sınır bildirimi: kırmızı `ErrorNotice` yerine sessiz
            // metin — kullanıcı yanlış bir şey yapmadı, kaynak sayı vermiyor.
            <p className="text-xs text-muted">{t('calc.field.plcaBeaconOmitted')}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
