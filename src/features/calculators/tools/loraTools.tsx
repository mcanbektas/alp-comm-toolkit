import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { CheckboxField, NumberField, SelectField } from '@/components/forms';
import {
  calculateLoraAirtime,
  calculateLoraEnergyBudget,
  calculateLoraLinkBudget,
  calculateLoraTimeOnAir,
  estimateLoraSensitivity,
} from '@/protocol-core';
import { ErrorNotice, SectionSwitch, StatTable, formatSeconds } from './shared';

/**
 * LoRa PHY hesap araçları — katalogdaki `wireless-iot/lora-lpwan/lora` kaydının
 * vaat ettiği araç kümesi. Motor `protocol-core/timing/lora.ts`tedir; burada
 * yalnız form ve gösterim var (CLAUDE.md: hesap bileşenin içine yazılmaz).
 *
 * Girdiler ELLE gelir, çerçeveden çözülmez: `lora` kaydının `tabs` listesinde
 * `decode` yoktur, PHY parametreleri kullanıcının bildiği radyo ayarlarıdır.
 */

/** SX1276/77/78/79'un desteklediği bant genişlikleri (datasheet Rev.7 Tablo 84). */
const BANDWIDTH_OPTIONS = [
  { value: '7800', label: '7.8 kHz' },
  { value: '10400', label: '10.4 kHz' },
  { value: '15600', label: '15.6 kHz' },
  { value: '20800', label: '20.8 kHz' },
  { value: '31250', label: '31.25 kHz' },
  { value: '41700', label: '41.7 kHz' },
  { value: '62500', label: '62.5 kHz' },
  { value: '125000', label: '125 kHz' },
  { value: '250000', label: '250 kHz' },
  { value: '500000', label: '500 kHz' },
];

/** SF adları veridir, çevrilmez (CLAUDE.md). SF6 yalnız implicit header ile kurulur. */
const SPREADING_FACTOR_OPTIONS = [
  { value: '6', label: 'SF6' },
  { value: '7', label: 'SF7' },
  { value: '8', label: 'SF8' },
  { value: '9', label: 'SF9' },
  { value: '10', label: 'SF10' },
  { value: '11', label: 'SF11' },
  { value: '12', label: 'SF12' },
];

const CODING_RATE_OPTIONS = [
  { value: '1', label: '4/5' },
  { value: '2', label: '4/6' },
  { value: '3', label: '4/7' },
  { value: '4', label: '4/8' },
];

type LdroMode = 'auto' | 'on' | 'off';

function resolveLdro(mode: LdroMode): boolean | undefined {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // 'auto': motor Ts > 16 ms kuralını kendisi uygular.
  return undefined;
}

/**
 * PHY parametre seti → sembol süresi, Time on Air, bit hızı ve duty cycle bütçesi.
 * Katalogdaki "Symbol Time & Symbol Rate", "Estimated PHY Bit Rate", "Time on Air"
 * ve "Airtime Analyzer" araçlarının tamamı tek forma bağlıdır: hepsi AYNI
 * parametre setinden türer, ayrı ekranlara bölmek kullanıcıyı aynı sayıları
 * dört kez girmeye zorlardı.
 */
export function LoraAirtimeTool(): ReactElement {
  const { t } = useTranslation();
  const [spreadingFactor, setSpreadingFactor] = useState('7');
  const [bandwidthHz, setBandwidthHz] = useState('125000');
  const [codingRate, setCodingRate] = useState('1');
  const [payloadBytes, setPayloadBytes] = useState('20');
  const [preambleSymbols, setPreambleSymbols] = useState('8');
  const [crcEnabled, setCrcEnabled] = useState(true);
  const [implicitHeader, setImplicitHeader] = useState(false);
  const [ldroMode, setLdroMode] = useState<LdroMode>('auto');
  const [dutyCyclePercent, setDutyCyclePercent] = useState('1');
  const [packetsPerHour, setPacketsPerHour] = useState('');

  const timeOnAir = useMemo(() => {
    try {
      return calculateLoraTimeOnAir({
        spreadingFactor: Number(spreadingFactor),
        bandwidthHz: Number(bandwidthHz),
        codingRate: Number(codingRate),
        payloadBytes: Number(payloadBytes),
        preambleSymbols: Number(preambleSymbols),
        crcEnabled,
        implicitHeader,
        lowDataRateOptimization: resolveLdro(ldroMode),
      });
    } catch {
      return null;
    }
  }, [
    spreadingFactor,
    bandwidthHz,
    codingRate,
    payloadBytes,
    preambleSymbols,
    crcEnabled,
    implicitHeader,
    ldroMode,
  ]);

  const airtime = useMemo(() => {
    if (timeOnAir === null) return null;
    try {
      return calculateLoraAirtime({
        timeOnAirSeconds: timeOnAir.timeOnAirSeconds,
        dutyCyclePercent: Number(dutyCyclePercent),
        packetsPerHour: packetsPerHour.trim().length === 0 ? undefined : Number(packetsPerHour),
      });
    } catch {
      return null;
    }
  }, [timeOnAir, dutyCyclePercent, packetsPerHour]);

  const ldroOptions: Array<{ value: LdroMode; label: string }> = [
    { value: 'auto', label: t('calc.field.loraLdroAuto') },
    { value: 'on', label: t('calc.field.loraLdroOn') },
    { value: 'off', label: t('calc.field.loraLdroOff') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField
            id="calc-lora-sf"
            label={t('calc.field.loraSpreadingFactor')}
            value={spreadingFactor}
            onChange={setSpreadingFactor}
            options={SPREADING_FACTOR_OPTIONS}
          />
          <SelectField
            id="calc-lora-bw"
            label={t('calc.field.loraBandwidth')}
            value={bandwidthHz}
            onChange={setBandwidthHz}
            options={BANDWIDTH_OPTIONS}
          />
          <SelectField
            id="calc-lora-cr"
            label={t('calc.field.loraCodingRate')}
            value={codingRate}
            onChange={setCodingRate}
            options={CODING_RATE_OPTIONS}
          />
          <NumberField
            id="calc-lora-payload"
            label={t('calc.field.loraPayloadBytes')}
            value={payloadBytes}
            onChange={setPayloadBytes}
          />
          <NumberField
            id="calc-lora-preamble"
            label={t('calc.field.loraPreambleSymbols')}
            value={preambleSymbols}
            onChange={setPreambleSymbols}
          />
          <SelectField
            id="calc-lora-ldro"
            label={t('calc.field.loraLowDataRateOptimization')}
            value={ldroMode}
            onChange={(value) => {
              setLdroMode(value as LdroMode);
            }}
            options={ldroOptions}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CheckboxField
            id="calc-lora-crc"
            label={t('calc.field.loraCrcEnabled')}
            checked={crcEnabled}
            onChange={setCrcEnabled}
            description={t('calc.field.loraCrcHint')}
          />
          <CheckboxField
            id="calc-lora-implicit"
            label={t('calc.field.loraImplicitHeader')}
            checked={implicitHeader}
            onChange={setImplicitHeader}
            description={t('calc.field.loraImplicitHeaderHint')}
          />
        </div>
      </div>

      {timeOnAir === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.loraSymbolTime'), formatSeconds(timeOnAir.symbolTimeSeconds)],
            [t('calc.field.loraSymbolRate'), `${timeOnAir.symbolRateHz.toFixed(2)} sym/s`],
            [t('calc.field.loraLdroApplied'), timeOnAir.lowDataRateOptimizationApplied ? t('common.yes') : t('common.no')],
            [t('calc.field.loraTotalPreambleSymbols'), String(timeOnAir.totalPreambleSymbols)],
            [t('calc.field.loraPreambleTime'), formatSeconds(timeOnAir.preambleTimeSeconds)],
            [t('calc.field.loraPayloadSymbols'), String(timeOnAir.payloadSymbolCount)],
            [t('calc.field.loraPayloadTime'), formatSeconds(timeOnAir.payloadTimeSeconds)],
            [t('calc.field.loraTimeOnAir'), formatSeconds(timeOnAir.timeOnAirSeconds)],
            [t('calc.field.loraBitRate'), `${timeOnAir.bitRateBitsPerSecond.toFixed(2)} bit/s`],
            [t('calc.field.loraEffectiveBitRate'), `${timeOnAir.effectiveBitRateBitsPerSecond.toFixed(2)} bit/s`],
          ]}
        />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('calc.field.loraAirtimeSection')}
        </h2>
        <p className="text-xs text-muted">{t('calc.field.loraDutyCycleHint')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            id="calc-lora-duty"
            label={t('calc.field.loraDutyCyclePercent')}
            value={dutyCyclePercent}
            onChange={setDutyCyclePercent}
          />
          <NumberField
            id="calc-lora-rate"
            label={t('calc.field.loraPacketsPerHour')}
            value={packetsPerHour}
            onChange={setPacketsPerHour}
          />
        </div>
        {airtime === null ? (
          <ErrorNotice message={t('calc.error.invalidInput')} />
        ) : (
          <StatTable
            rows={[
              [t('calc.field.loraMaxPacketsPerHour'), airtime.maxPacketsPerHour.toFixed(1)],
              [t('calc.field.loraMaxPacketsPerDay'), airtime.maxPacketsPerDay.toFixed(1)],
              [t('calc.field.loraMinimumOffTime'), formatSeconds(airtime.minimumOffTimeSeconds)],
              [t('calc.field.loraMinimumInterval'), formatSeconds(airtime.minimumIntervalSeconds)],
              ...(airtime.occupancyPercent === undefined
                ? []
                : ([[t('calc.field.loraOccupancy'), `${airtime.occupancyPercent.toFixed(3)} %`]] as const)),
              ...(airtime.withinDutyCycle === undefined
                ? []
                : ([
                    [t('calc.field.loraWithinDutyCycle'), airtime.withinDutyCycle ? t('common.yes') : t('common.no')],
                  ] as const)),
            ]}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Pil/enerji tahmini. Girdisi PHY parametreleri DEĞİL, doğrudan Time on Air —
 * enerji modelinin gerçekten bağlı olduğu tek zaman terimi odur. PHY setini
 * burada ikinci kez sormak formu on sekiz alana çıkarırdı; ToA'yı üreten araca
 * bağlantı veriliyor.
 */
export function LoraBatteryTool(): ReactElement {
  const { t } = useTranslation();
  const [timeOnAirMs, setTimeOnAirMs] = useState('56.576');
  const [transmitCurrentMilliamps, setTransmitCurrentMilliamps] = useState('44');
  const [receiveCurrentMilliamps, setReceiveCurrentMilliamps] = useState('11.5');
  const [receiveWindowMs, setReceiveWindowMs] = useState('150');
  const [activeCurrentMilliamps, setActiveCurrentMilliamps] = useState('8');
  const [activeMs, setActiveMs] = useState('500');
  const [sleepCurrentMicroamps, setSleepCurrentMicroamps] = useState('2');
  const [messagesPerDay, setMessagesPerDay] = useState('24');
  const [batteryCapacityMilliampHours, setBatteryCapacityMilliampHours] = useState('2400');
  const [deratingPercent, setDeratingPercent] = useState('20');
  const [selfDischargePercentPerYear, setSelfDischargePercentPerYear] = useState('1');

  const energy = useMemo(() => {
    try {
      return calculateLoraEnergyBudget({
        timeOnAirSeconds: Number(timeOnAirMs) / 1000,
        transmitCurrentMilliamps: Number(transmitCurrentMilliamps),
        receiveCurrentMilliamps: Number(receiveCurrentMilliamps),
        receiveWindowSeconds: Number(receiveWindowMs) / 1000,
        activeCurrentMilliamps: Number(activeCurrentMilliamps),
        activeSeconds: Number(activeMs) / 1000,
        sleepCurrentMicroamps: Number(sleepCurrentMicroamps),
        messagesPerDay: Number(messagesPerDay),
        batteryCapacityMilliampHours: Number(batteryCapacityMilliampHours),
        deratingPercent: Number(deratingPercent),
        selfDischargePercentPerYear: Number(selfDischargePercentPerYear),
      });
    } catch {
      return null;
    }
  }, [
    timeOnAirMs,
    transmitCurrentMilliamps,
    receiveCurrentMilliamps,
    receiveWindowMs,
    activeCurrentMilliamps,
    activeMs,
    sleepCurrentMicroamps,
    messagesPerDay,
    batteryCapacityMilliampHours,
    deratingPercent,
    selfDischargePercentPerYear,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('calc.field.loraDutyProfileSection')}
        </h2>
        <p className="text-xs text-muted">
          {t('calc.field.loraTimeOnAirHint')}{' '}
          <Link
            to="/calculators/lora-airtime"
            className="rounded-token-sm px-0.5 text-accent-strong underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('calc.loraAirtime.name')}
          </Link>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            id="calc-lora-toa"
            label={t('calc.field.loraTimeOnAirMs')}
            value={timeOnAirMs}
            onChange={setTimeOnAirMs}
          />
          <NumberField
            id="calc-lora-txcurrent"
            label={t('calc.field.loraTransmitCurrent')}
            value={transmitCurrentMilliamps}
            onChange={setTransmitCurrentMilliamps}
          />
          <NumberField
            id="calc-lora-messages"
            label={t('calc.field.loraMessagesPerDay')}
            value={messagesPerDay}
            onChange={setMessagesPerDay}
          />
          <NumberField
            id="calc-lora-rxcurrent"
            label={t('calc.field.loraReceiveCurrent')}
            value={receiveCurrentMilliamps}
            onChange={setReceiveCurrentMilliamps}
          />
          <NumberField
            id="calc-lora-rxwindow"
            label={t('calc.field.loraReceiveWindowMs')}
            value={receiveWindowMs}
            onChange={setReceiveWindowMs}
          />
          <NumberField
            id="calc-lora-sleepcurrent"
            label={t('calc.field.loraSleepCurrent')}
            value={sleepCurrentMicroamps}
            onChange={setSleepCurrentMicroamps}
          />
          <NumberField
            id="calc-lora-activecurrent"
            label={t('calc.field.loraActiveCurrent')}
            value={activeCurrentMilliamps}
            onChange={setActiveCurrentMilliamps}
          />
          <NumberField
            id="calc-lora-activems"
            label={t('calc.field.loraActiveMs')}
            value={activeMs}
            onChange={setActiveMs}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('calc.field.loraBatterySection')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            id="calc-lora-capacity"
            label={t('calc.field.loraBatteryCapacity')}
            value={batteryCapacityMilliampHours}
            onChange={setBatteryCapacityMilliampHours}
          />
          <NumberField
            id="calc-lora-derating"
            label={t('calc.field.loraDerating')}
            value={deratingPercent}
            onChange={setDeratingPercent}
          />
          <NumberField
            id="calc-lora-selfdischarge"
            label={t('calc.field.loraSelfDischarge')}
            value={selfDischargePercentPerYear}
            onChange={setSelfDischargePercentPerYear}
          />
        </div>
      </div>

      {energy === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <>
          <StatTable
            rows={[
              [t('calc.field.loraTransmitCharge'), `${energy.transmitChargeMicroampHours.toFixed(3)} µAh`],
              [t('calc.field.loraReceiveCharge'), `${energy.receiveChargeMicroampHours.toFixed(3)} µAh`],
              [t('calc.field.loraActiveCharge'), `${energy.activeChargeMicroampHours.toFixed(3)} µAh`],
              [t('calc.field.loraChargePerMessage'), `${energy.chargePerMessageMicroampHours.toFixed(3)} µAh`],
              [t('calc.field.loraDailyActiveCharge'), `${energy.dailyActiveChargeMilliampHours.toFixed(4)} mAh`],
              [t('calc.field.loraDailySleepCharge'), `${energy.dailySleepChargeMilliampHours.toFixed(4)} mAh`],
              [t('calc.field.loraDailySelfDischarge'), `${energy.dailySelfDischargeMilliampHours.toFixed(4)} mAh`],
              [t('calc.field.loraDailyCharge'), `${energy.dailyChargeMilliampHours.toFixed(4)} mAh`],
              [t('calc.field.loraAverageCurrent'), `${energy.averageCurrentMicroamps.toFixed(2)} µA`],
              [t('calc.field.loraIdleShare'), `${energy.idleSharePercent.toFixed(1)} %`],
              [t('calc.field.loraUsableCapacity'), `${energy.usableCapacityMilliampHours.toFixed(1)} mAh`],
              ...(energy.batteryLifeDays === undefined
                ? []
                : ([
                    [
                      t('calc.field.loraBatteryLifeDays'),
                      `${energy.batteryLifeDays.toFixed(0)} ${t('calc.field.loraUnitDays')}`,
                    ],
                  ] as const)),
              ...(energy.batteryLifeYears === undefined
                ? []
                : ([
                    [
                      t('calc.field.loraBatteryLifeYears'),
                      `${energy.batteryLifeYears.toFixed(2)} ${t('calc.field.loraUnitYears')}`,
                    ],
                  ] as const)),
            ]}
          />
          <p className="text-xs text-muted">{t('calc.field.loraBatteryModelHint')}</p>
        </>
      )}
    </div>
  );
}

type SensitivitySource = 'estimated' | 'manual';

/**
 * Link bütçesi ve marj. Duyarlılık ya SF/BW/NF'den TAHMİN edilir ya da elle
 * girilir — ikisi ayrı tutulur çünkü datasheet'in ölçülmüş tablosu tahminden
 * 1-2 dB sapar ve saha hesabında hangisinin kullanıldığı görünmelidir.
 */
export function LoraLinkBudgetTool(): ReactElement {
  const { t } = useTranslation();
  const [source, setSource] = useState<SensitivitySource>('estimated');
  const [spreadingFactor, setSpreadingFactor] = useState('7');
  const [bandwidthHz, setBandwidthHz] = useState('125000');
  const [noiseFigureDb, setNoiseFigureDb] = useState('6');
  const [manualSensitivityDbm, setManualSensitivityDbm] = useState('-137');
  const [txPowerDbm, setTxPowerDbm] = useState('14');
  const [txAntennaGainDbi, setTxAntennaGainDbi] = useState('2');
  const [rxAntennaGainDbi, setRxAntennaGainDbi] = useState('2');
  const [cableLossDb, setCableLossDb] = useState('0.5');
  const [frequencyMhz, setFrequencyMhz] = useState('868');
  const [measuredRssiDbm, setMeasuredRssiDbm] = useState('');

  const sensitivity = useMemo(() => {
    if (source !== 'estimated') return undefined;
    try {
      return estimateLoraSensitivity({
        spreadingFactor: Number(spreadingFactor),
        bandwidthHz: Number(bandwidthHz),
        noiseFigureDb: Number(noiseFigureDb),
      });
    } catch {
      return null;
    }
  }, [source, spreadingFactor, bandwidthHz, noiseFigureDb]);

  const sensitivityDbm =
    source === 'estimated' ? (sensitivity?.sensitivityDbm ?? null) : Number(manualSensitivityDbm);

  const budget = useMemo(() => {
    if (sensitivityDbm === null || !Number.isFinite(sensitivityDbm)) return null;
    try {
      return calculateLoraLinkBudget({
        txPowerDbm: Number(txPowerDbm),
        txAntennaGainDbi: Number(txAntennaGainDbi),
        rxAntennaGainDbi: Number(rxAntennaGainDbi),
        cableLossDb: Number(cableLossDb),
        sensitivityDbm,
        frequencyHz: Number(frequencyMhz) * 1e6,
        measuredRssiDbm: measuredRssiDbm.trim().length === 0 ? undefined : Number(measuredRssiDbm),
      });
    } catch {
      return null;
    }
  }, [
    sensitivityDbm,
    txPowerDbm,
    txAntennaGainDbi,
    rxAntennaGainDbi,
    cableLossDb,
    frequencyMhz,
    measuredRssiDbm,
  ]);

  const sourceOptions: Array<{ value: SensitivitySource; label: string }> = [
    { value: 'estimated', label: t('calc.field.loraSensitivityEstimated') },
    { value: 'manual', label: t('calc.field.loraSensitivityManual') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('calc.field.loraSensitivitySection')}
        </h2>
        <SectionSwitch value={source} onChange={setSource} options={sourceOptions} />
        {source === 'estimated' ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField
                id="calc-lora-lb-sf"
                label={t('calc.field.loraSpreadingFactor')}
                value={spreadingFactor}
                onChange={setSpreadingFactor}
                options={SPREADING_FACTOR_OPTIONS}
              />
              <SelectField
                id="calc-lora-lb-bw"
                label={t('calc.field.loraBandwidth')}
                value={bandwidthHz}
                onChange={setBandwidthHz}
                options={BANDWIDTH_OPTIONS}
              />
              <NumberField
                id="calc-lora-nf"
                label={t('calc.field.loraNoiseFigure')}
                value={noiseFigureDb}
                onChange={setNoiseFigureDb}
              />
            </div>
            {sensitivity === null || sensitivity === undefined ? (
              <ErrorNotice message={t('calc.error.invalidInput')} />
            ) : (
              <StatTable
                rows={[
                  [t('calc.field.loraThermalNoise'), `${sensitivity.thermalNoiseDbm.toFixed(2)} dBm`],
                  [t('calc.field.loraDemodulatorSnr'), `${sensitivity.demodulatorSnrDb.toFixed(1)} dB`],
                  [t('calc.field.loraSensitivity'), `${sensitivity.sensitivityDbm.toFixed(2)} dBm`],
                ]}
              />
            )}
          </>
        ) : (
          <NumberField
            id="calc-lora-sensitivity"
            label={t('calc.field.loraSensitivity')}
            value={manualSensitivityDbm}
            onChange={setManualSensitivityDbm}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          {t('calc.field.loraLinkBudgetSection')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField id="calc-lora-tx" label={t('calc.field.loraTxPower')} value={txPowerDbm} onChange={setTxPowerDbm} />
          <NumberField
            id="calc-lora-txgain"
            label={t('calc.field.loraTxAntennaGain')}
            value={txAntennaGainDbi}
            onChange={setTxAntennaGainDbi}
          />
          <NumberField
            id="calc-lora-rxgain"
            label={t('calc.field.loraRxAntennaGain')}
            value={rxAntennaGainDbi}
            onChange={setRxAntennaGainDbi}
          />
          <NumberField id="calc-lora-cable" label={t('calc.field.loraCableLoss')} value={cableLossDb} onChange={setCableLossDb} />
          <NumberField
            id="calc-lora-frequency"
            label={t('calc.field.loraFrequencyMhz')}
            value={frequencyMhz}
            onChange={setFrequencyMhz}
          />
          <NumberField
            id="calc-lora-rssi"
            label={t('calc.field.loraMeasuredRssi')}
            value={measuredRssiDbm}
            onChange={setMeasuredRssiDbm}
          />
        </div>
        {budget === null ? (
          <ErrorNotice message={t('calc.error.invalidInput')} />
        ) : (
          <>
            <StatTable
              rows={[
                [t('calc.field.loraEffectiveRadiatedPower'), `${budget.effectiveRadiatedPowerDbm.toFixed(2)} dBm`],
                [t('calc.field.loraMaximumPathLoss'), `${budget.maximumPathLossDb.toFixed(2)} dB`],
                ...(budget.estimatedFreeSpaceRangeMeters === undefined
                  ? []
                  : ([
                      [
                        t('calc.field.loraFreeSpaceRange'),
                        `${(budget.estimatedFreeSpaceRangeMeters / 1000).toFixed(2)} km`,
                      ],
                    ] as const)),
                ...(budget.measuredMarginDb === undefined
                  ? []
                  : ([[t('calc.field.loraMeasuredMargin'), `${budget.measuredMarginDb.toFixed(2)} dB`]] as const)),
              ]}
            />
            <p className="text-xs text-muted">{t('calc.field.loraFreeSpaceRangeHint')}</p>
          </>
        )}
      </div>
    </div>
  );
}
