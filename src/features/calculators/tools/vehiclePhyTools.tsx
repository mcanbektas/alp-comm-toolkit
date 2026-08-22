import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField } from '@/components/forms';
import {
  calculateCanBitBudget,
  calculateFlexrayChannels,
  calculateLinBreak,
  calculateParallelTermination,
  estimateBaudFromSyncSpan,
} from '@/protocol-core';
import { ErrorNotice, SectionSwitch, StatTable, formatSeconds } from './shared';

/**
 * Araç içi PHY hesap araçları — CAN PHY, LIN PHY ve FlexRay PHY katalog
 * kayıtlarının tek motoru (`protocol-core/timing/vehiclePhy.ts`). Üç kaydın da
 * decode'u yoktur (LoRa paterni), sayfalar buraya `calculatorIds` ile bağlanır.
 *
 * Üç kayıt AYNI bileşeni `variant` ile paylaşır — `CodeArrayGeneratorTool`in
 * altı kod üretecini `language` ile paylaşmasıyla aynı desen (registry.ts
 * dosya başı notu). Her sayfanın kendi id'si olması derin bağlantı içindir.
 *
 * Gecikme girdileri nanosaniye alınır: transceiver ve kanal gecikmeleri
 * datasheet'lerde ns cinsindendir, kullanıcıya saniyeye çevirtmek hataya
 * davetiye olurdu.
 */

const NANOSECONDS_PER_SECOND = 1e9;
const MICROSECONDS_PER_SECOND = 1e6;

function nanosecondsToSeconds(value: string): number {
  return Number(value) / NANOSECONDS_PER_SECOND;
}

export type VehiclePhyVariant = 'can' | 'lin' | 'flexray';

export function VehiclePhyTool({ variant }: { variant: VehiclePhyVariant }): ReactElement {
  if (variant === 'can') return <CanPhySections />;
  if (variant === 'lin') return <LinPhySection />;
  return <FlexrayPhySection />;
}

type CanSection = 'termination' | 'budget';

function CanPhySections(): ReactElement {
  const { t } = useTranslation();
  const [section, setSection] = useState<CanSection>('budget');

  const options: Array<{ value: CanSection; label: string }> = [
    { value: 'budget', label: t('calc.field.canBudget') },
    { value: 'termination', label: t('calc.field.canTermination') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitch value={section} onChange={setSection} options={options} />
      {section === 'budget' ? <CanBudgetSection /> : <CanTerminationSection />}
    </div>
  );
}

function CanTerminationSection(): ReactElement {
  const { t } = useTranslation();
  // Varsayılan kaynağın kendi örneği: iki uçta 120 Ω → 60 Ω eşdeğer.
  const [ohmsEach, setOhmsEach] = useState('120');
  const [count, setCount] = useState('2');

  const result = useMemo(() => {
    try {
      return calculateParallelTermination(Number(ohmsEach), Number(count));
    } catch {
      return null;
    }
  }, [ohmsEach, count]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-can-term-ohms"
          label={t('calc.field.terminationOhms')}
          value={ohmsEach}
          onChange={setOhmsEach}
        />
        <NumberField
          id="calc-can-term-count"
          label={t('calc.field.terminationCount')}
          value={count}
          onChange={setCount}
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable rows={[[t('calc.field.equivalentOhms'), `${result.toFixed(1)} Ω`]]} />
      )}
    </div>
  );
}

function CanBudgetSection(): ReactElement {
  const { t } = useTranslation();
  // Varsayılanlar spec'in CAN FD örneğindeki arbitrasyon hızı çevresinde.
  const [bitrate, setBitrate] = useState('500000');
  const [samplePoint, setSamplePoint] = useState('80');
  const [cableLength, setCableLength] = useState('40');
  const [velocity, setVelocity] = useState('200000000');
  const [transceiverDelay, setTransceiverDelay] = useState('120');
  const [nodeDelay, setNodeDelay] = useState('');

  const result = useMemo(() => {
    try {
      return calculateCanBitBudget({
        bitrateBps: Number(bitrate),
        samplePointPercent: Number(samplePoint),
        cableLengthMeters: Number(cableLength),
        propagationVelocityMetersPerSecond: Number(velocity),
        transceiverDelaySeconds: nanosecondsToSeconds(transceiverDelay),
        ...(nodeDelay.trim().length === 0
          ? {}
          : { nodeDelaySeconds: nanosecondsToSeconds(nodeDelay) }),
      });
    } catch {
      return null;
    }
  }, [bitrate, samplePoint, cableLength, velocity, transceiverDelay, nodeDelay]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-can-bitrate"
          label={t('calc.field.bitrateBps')}
          value={bitrate}
          onChange={setBitrate}
        />
        <NumberField
          id="calc-can-samplepoint"
          label={t('calc.field.samplePointPercent')}
          value={samplePoint}
          onChange={setSamplePoint}
        />
        <NumberField
          id="calc-can-cable"
          label={t('calc.field.cableLengthMeters')}
          value={cableLength}
          onChange={setCableLength}
        />
        <NumberField
          id="calc-can-velocity"
          label={t('calc.field.propagationVelocity')}
          value={velocity}
          onChange={setVelocity}
        />
        <NumberField
          id="calc-can-transceiver"
          label={t('calc.field.transceiverDelayNs')}
          value={transceiverDelay}
          onChange={setTransceiverDelay}
        />
        <NumberField
          id="calc-can-node"
          label={t('calc.field.nodeDelayNsOptional')}
          value={nodeDelay}
          onChange={setNodeDelay}
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.bitTime'), formatSeconds(result.bitTimeSeconds)],
            [t('calc.field.propagationDelay'), formatSeconds(result.cableDelaySeconds)],
            [t('calc.field.roundTripDelay'), formatSeconds(result.roundTripDelaySeconds)],
            [t('calc.field.sampleTime'), formatSeconds(result.sampleTimeSeconds)],
            [t('calc.field.timingMargin'), formatSeconds(result.marginSeconds)],
            [
              t('calc.field.budgetVerdict'),
              result.withinBudget ? t('calc.canPhy.withinBudget') : t('calc.canPhy.overBudget'),
            ],
          ]}
        />
      )}
    </div>
  );
}

function LinPhySection(): ReactElement {
  const { t } = useTranslation();
  // LIN sınıfı 1–20 kBd; 19200 yaygın bir çalışma noktası.
  const [baudRate, setBaudRate] = useState('19200');
  const [breakBits, setBreakBits] = useState('13');
  const [syncSpanMicroseconds, setSyncSpanMicroseconds] = useState('416.67');

  const result = useMemo(() => {
    try {
      return {
        breakResult: calculateLinBreak({
          baudRate: Number(baudRate),
          breakBits: Number(breakBits),
        }),
        estimatedBaud: estimateBaudFromSyncSpan({
          spanSeconds: Number(syncSpanMicroseconds) / MICROSECONDS_PER_SECOND,
        }),
      };
    } catch {
      return null;
    }
  }, [baudRate, breakBits, syncSpanMicroseconds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-lin-baud"
          label={t('calc.field.baudRate')}
          value={baudRate}
          onChange={setBaudRate}
        />
        <NumberField
          id="calc-lin-breakbits"
          label={t('calc.field.breakBits')}
          value={breakBits}
          onChange={setBreakBits}
        />
        <NumberField
          id="calc-lin-syncspan"
          label={t('calc.field.syncSpanMicroseconds')}
          value={syncSpanMicroseconds}
          onChange={setSyncSpanMicroseconds}
          step={0.01}
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.bitTime'), formatSeconds(result.breakResult.bitTimeSeconds)],
            [t('calc.field.breakDuration'), formatSeconds(result.breakResult.breakDurationSeconds)],
            [
              t('calc.field.breakVerdict'),
              result.breakResult.longerThanUartCharacter
                ? t('calc.linPhy.breakLonger')
                : t('calc.linPhy.breakTooShort'),
            ],
            [t('calc.field.estimatedBaud'), `${result.estimatedBaud.toFixed(0)} Bd`],
          ]}
        />
      )}
    </div>
  );
}

function FlexrayPhySection(): ReactElement {
  const { t } = useTranslation();
  // Kaynağın verdiği sınıfın üst ucu: 10 Mbit/s.
  const [bitrate, setBitrate] = useState('10000000');
  const [frameBits, setFrameBits] = useState('200');
  const [channelADelay, setChannelADelay] = useState('250');
  const [channelBDelay, setChannelBDelay] = useState('400');

  const result = useMemo(() => {
    try {
      return calculateFlexrayChannels({
        bitrateBps: Number(bitrate),
        frameBits: Number(frameBits),
        channelADelaySeconds: nanosecondsToSeconds(channelADelay),
        channelBDelaySeconds: nanosecondsToSeconds(channelBDelay),
      });
    } catch {
      return null;
    }
  }, [bitrate, frameBits, channelADelay, channelBDelay]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id="calc-flexray-bitrate"
          label={t('calc.field.bitrateBps')}
          value={bitrate}
          onChange={setBitrate}
        />
        <NumberField
          id="calc-flexray-framebits"
          label={t('calc.field.frameBits')}
          value={frameBits}
          onChange={setFrameBits}
        />
        <NumberField
          id="calc-flexray-delay-a"
          label={t('calc.field.channelADelayNs')}
          value={channelADelay}
          onChange={setChannelADelay}
        />
        <NumberField
          id="calc-flexray-delay-b"
          label={t('calc.field.channelBDelayNs')}
          value={channelBDelay}
          onChange={setChannelBDelay}
        />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.bitTime'), formatSeconds(result.bitTimeSeconds)],
            [t('calc.field.frameDuration'), formatSeconds(result.frameDurationSeconds)],
            [t('calc.field.channelSkew'), formatSeconds(result.skewSeconds)],
            [t('calc.field.skewBitTimes'), result.skewBitTimes.toFixed(2)],
          ]}
        />
      )}
    </div>
  );
}
