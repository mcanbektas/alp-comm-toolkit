import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, SelectField, TextField } from '@/components/forms';
import {
  calculateI2cRiseTime,
  calculateI2cTransferTime,
  calculateRs485Bias,
  calculateRs485Propagation,
  calculateRs485Termination,
  calculateRs485UnitLoad,
  calculateSpiTransferTime,
  calculateUartTiming,
  decodeLinear11,
  decodeLinear16,
  encodeI2c7BitAddress,
  encodeLinear11,
  qspiThroughput,
} from '@/protocol-core';
import type { UartParity } from '@/protocol-core';

/** Sayısal hesap çıktıları için ortak tablo — bu ekranlarda kopyalama gerekmez, sonuçlar okunur/karşılaştırılır. */
function StatTable({ rows }: { rows: ReadonlyArray<readonly [string, string]> }): ReactElement {
  return (
    <div className="overflow-x-auto rounded-token border border-line">
      <table className="w-full text-left text-sm tabular">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line last:border-0">
              <th scope="row" className="px-3 py-2 font-normal text-muted">
                {label}
              </th>
              <td className="px-3 py-2 font-mono font-medium text-text">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }): ReactElement {
  return <p className="text-xs text-danger">{message}</p>;
}

function formatSeconds(value: number): string {
  if (value < 1e-6) return `${(value * 1e9).toFixed(2)} ns`;
  if (value < 1e-3) return `${(value * 1e6).toFixed(2)} µs`;
  if (value < 1) return `${(value * 1e3).toFixed(3)} ms`;
  return `${value.toFixed(6)} s`;
}

const PARITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'even', label: 'Even' },
  { value: 'odd', label: 'Odd' },
];

export function UartTimingTool(): ReactElement {
  const { t } = useTranslation();
  const [baudRate, setBaudRate] = useState('115200');
  const [dataBits, setDataBits] = useState('8');
  const [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState('none');
  const [packetBytes, setPacketBytes] = useState('');

  const result = useMemo(() => {
    try {
      return calculateUartTiming({
        baudRate: Number(baudRate),
        dataBits: Number(dataBits),
        stopBits: Number(stopBits) as 1 | 2,
        parity: parity as UartParity,
        packetBytes: packetBytes.trim().length === 0 ? undefined : Number(packetBytes),
      });
    } catch {
      return null;
    }
  }, [baudRate, dataBits, stopBits, parity, packetBytes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-baud" label={t('calc.field.baudRate')} value={baudRate} onChange={setBaudRate} />
        <NumberField id="calc-databits" label={t('calc.field.dataBits')} value={dataBits} onChange={setDataBits} />
        <NumberField id="calc-stopbits" label={t('calc.field.stopBits')} value={stopBits} onChange={setStopBits} />
        <SelectField id="calc-parity" label={t('calc.field.parity')} value={parity} onChange={setParity} options={PARITY_OPTIONS} />
        <NumberField id="calc-packetbytes" label={t('calc.field.packetBytesOptional')} value={packetBytes} onChange={setPacketBytes} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.bitsPerCharacter'), String(result.bitsPerCharacter)],
            [t('calc.field.characterTime'), formatSeconds(result.characterTimeSeconds)],
            [t('calc.field.maxByteRate'), `${result.maxByteRate.toFixed(1)} B/s`],
            ...(result.packetTimeSeconds === undefined ? [] : [[t('calc.field.packetTime'), formatSeconds(result.packetTimeSeconds)] as const]),
            ...(result.maxPacketRate === undefined ? [] : [[t('calc.field.maxPacketRate'), `${result.maxPacketRate.toFixed(2)} /s`] as const]),
          ]}
        />
      )}
    </div>
  );
}

type Rs485Section = 'termination' | 'bias' | 'propagation' | 'unitLoad';

function SectionSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}): ReactElement {
  return (
    <div role="group" className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => {
            onChange(option.value);
          }}
          className={`rounded-token-sm border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent ${
            value === option.value
              ? 'border-accent bg-accent-soft font-medium text-accent-strong'
              : 'border-line text-muted hover:text-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Rs485TimingTool(): ReactElement {
  const { t } = useTranslation();
  const [section, setSection] = useState<Rs485Section>('termination');

  const sectionOptions: Array<{ value: Rs485Section; label: string }> = [
    { value: 'termination', label: t('calc.field.rs485Termination') },
    { value: 'bias', label: t('calc.field.rs485Bias') },
    { value: 'propagation', label: t('calc.field.rs485Propagation') },
    { value: 'unitLoad', label: t('calc.field.rs485UnitLoad') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitch value={section} onChange={setSection} options={sectionOptions} />
      {section === 'termination' && <Rs485TerminationSection />}
      {section === 'bias' && <Rs485BiasSection />}
      {section === 'propagation' && <Rs485PropagationSection />}
      {section === 'unitLoad' && <Rs485UnitLoadSection />}
    </div>
  );
}

function Rs485TerminationSection(): ReactElement {
  const { t } = useTranslation();
  const [differentialVoltage, setDifferentialVoltage] = useState('5');
  const [terminationOhms, setTerminationOhms] = useState('120');

  const result = useMemo(() => {
    try {
      return calculateRs485Termination({ differentialVoltage: Number(differentialVoltage), terminationOhms: Number(terminationOhms) });
    } catch {
      return null;
    }
  }, [differentialVoltage, terminationOhms]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-voltage" label={t('calc.field.differentialVoltage')} value={differentialVoltage} onChange={setDifferentialVoltage} />
        <NumberField id="calc-termination" label={t('calc.field.terminationOhms')} value={terminationOhms} onChange={setTerminationOhms} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.effectiveResistance'), `${result.effectiveResistanceOhms.toFixed(2)} Ω`],
            [t('calc.field.driverCurrent'), `${(result.driverCurrentAmps * 1000).toFixed(2)} mA`],
          ]}
        />
      )}
    </div>
  );
}

function Rs485BiasSection(): ReactElement {
  const { t } = useTranslation();
  const [supplyVoltage, setSupplyVoltage] = useState('5');
  const [terminationOhms, setTerminationOhms] = useState('120');
  const [biasResistorOhms, setBiasResistorOhms] = useState('560');

  const result = useMemo(() => {
    try {
      return calculateRs485Bias({
        supplyVoltage: Number(supplyVoltage),
        terminationOhms: Number(terminationOhms),
        biasResistorOhms: Number(biasResistorOhms),
      });
    } catch {
      return null;
    }
  }, [supplyVoltage, terminationOhms, biasResistorOhms]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField id="calc-supply" label={t('calc.field.supplyVoltage')} value={supplyVoltage} onChange={setSupplyVoltage} />
        <NumberField id="calc-termination" label={t('calc.field.terminationOhms')} value={terminationOhms} onChange={setTerminationOhms} />
        <NumberField id="calc-bias" label={t('calc.field.biasResistorOhms')} value={biasResistorOhms} onChange={setBiasResistorOhms} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.differentialBiasVoltage'), `${result.differentialBiasVoltage.toFixed(3)} V`],
            [t('calc.field.biasCurrent'), `${(result.biasCurrentAmps * 1000).toFixed(2)} mA`],
          ]}
        />
      )}
    </div>
  );
}

function Rs485PropagationSection(): ReactElement {
  const { t } = useTranslation();
  const [cableLengthMeters, setCableLengthMeters] = useState('100');
  const [propagationVelocity, setPropagationVelocity] = useState('200000000');

  const result = useMemo(() => {
    try {
      return calculateRs485Propagation({
        cableLengthMeters: Number(cableLengthMeters),
        propagationVelocityMetersPerSecond: Number(propagationVelocity),
      });
    } catch {
      return null;
    }
  }, [cableLengthMeters, propagationVelocity]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-length" label={t('calc.field.cableLengthMeters')} value={cableLengthMeters} onChange={setCableLengthMeters} />
        <NumberField id="calc-velocity" label={t('calc.field.propagationVelocity')} value={propagationVelocity} onChange={setPropagationVelocity} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.propagationDelay'), formatSeconds(result.propagationDelaySeconds)],
            [t('calc.field.roundTripDelay'), formatSeconds(result.roundTripDelaySeconds)],
          ]}
        />
      )}
    </div>
  );
}

function Rs485UnitLoadSection(): ReactElement {
  const { t } = useTranslation();
  const [nodeCount, setNodeCount] = useState('32');
  const [unitLoadEach, setUnitLoadEach] = useState('1');

  const result = useMemo(() => {
    try {
      const count = Number(nodeCount);
      const unitLoad = Number(unitLoadEach);
      const nodes = Array.from({ length: count }, (_unused, index) => ({ id: `node-${index}`, unitLoad }));
      return calculateRs485UnitLoad(nodes);
    } catch {
      return null;
    }
  }, [nodeCount, unitLoadEach]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">{t('calc.field.rs485UnitLoadHint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-nodecount" label={t('calc.field.nodeCount')} value={nodeCount} onChange={setNodeCount} />
        <NumberField id="calc-unitload" label={t('calc.field.unitLoadPerNode')} value={unitLoadEach} onChange={setUnitLoadEach} />
      </div>
      {result === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.totalUnitLoad'), result.totalUnitLoad.toFixed(2)],
            [t('calc.field.maximumAllowed'), String(result.maximumAllowed)],
            [t('calc.field.withinLimit'), result.withinLimit ? t('common.yes') : t('common.no')],
          ]}
        />
      )}
    </div>
  );
}

export function SpiTimingTool(): ReactElement {
  const { t } = useTranslation();
  const [clockFrequencyHz, setClockFrequencyHz] = useState('10000000');
  const [totalClockBits, setTotalClockBits] = useState('32');

  const transfer = useMemo(() => {
    try {
      return calculateSpiTransferTime({ totalClockBits: Number(totalClockBits), clockFrequencyHz: Number(clockFrequencyHz) });
    } catch {
      return null;
    }
  }, [totalClockBits, clockFrequencyHz]);

  const qspi = useMemo(() => {
    try {
      return qspiThroughput({ clockFrequencyHz: Number(clockFrequencyHz) });
    } catch {
      return null;
    }
  }, [clockFrequencyHz]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-clock" label={t('calc.field.clockFrequencyHz')} value={clockFrequencyHz} onChange={setClockFrequencyHz} />
        <NumberField id="calc-bits" label={t('calc.field.totalClockBits')} value={totalClockBits} onChange={setTotalClockBits} />
      </div>
      {transfer === null || qspi === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.transferTime'), formatSeconds(transfer.transferTimeSeconds)],
            [t('calc.field.qspiThroughput'), `${(qspi.throughputBitsPerSecond / 1e6).toFixed(2)} Mbit/s`],
          ]}
        />
      )}
    </div>
  );
}

export function I2cTimingTool(): ReactElement {
  const { t } = useTranslation();
  const [sclFrequencyHz, setSclFrequencyHz] = useState('400000');
  const [byteCount, setByteCount] = useState('4');
  const [address, setAddress] = useState('80');
  const [pullUpOhms, setPullUpOhms] = useState('4700');
  const [busCapacitancePf, setBusCapacitancePf] = useState('200');

  const transfer = useMemo(() => {
    try {
      return calculateI2cTransferTime({ sclFrequencyHz: Number(sclFrequencyHz), byteCount: Number(byteCount) });
    } catch {
      return null;
    }
  }, [sclFrequencyHz, byteCount]);

  const addressBytes = useMemo(() => {
    try {
      return encodeI2c7BitAddress(Number(address));
    } catch {
      return null;
    }
  }, [address]);

  const riseTime = useMemo(() => {
    try {
      return calculateI2cRiseTime({ pullUpOhms: Number(pullUpOhms), busCapacitanceFarads: Number(busCapacitancePf) * 1e-12 });
    } catch {
      return null;
    }
  }, [pullUpOhms, busCapacitancePf]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField id="calc-scl" label={t('calc.field.sclFrequencyHz')} value={sclFrequencyHz} onChange={setSclFrequencyHz} />
        <NumberField id="calc-bytecount" label={t('calc.field.byteCount')} value={byteCount} onChange={setByteCount} />
      </div>
      {transfer === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.totalClockCount'), String(transfer.totalClockCount)],
            [t('calc.field.transferTime'), formatSeconds(transfer.transferTimeSeconds)],
          ]}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField id="calc-address" label={t('calc.field.i2cAddress7bit')} value={address} onChange={setAddress} />
        <NumberField id="calc-pullup" label={t('calc.field.pullUpOhms')} value={pullUpOhms} onChange={setPullUpOhms} />
        <NumberField id="calc-capacitance" label={t('calc.field.busCapacitancePf')} value={busCapacitancePf} onChange={setBusCapacitancePf} />
      </div>
      {addressBytes === null || riseTime === null ? (
        <ErrorNotice message={t('calc.error.invalidInput')} />
      ) : (
        <StatTable
          rows={[
            [t('calc.field.writeByte'), `0x${addressBytes.writeByte.toString(16).toUpperCase().padStart(2, '0')}`],
            [t('calc.field.readByte'), `0x${addressBytes.readByte.toString(16).toUpperCase().padStart(2, '0')}`],
            [t('calc.field.riseTime'), formatSeconds(riseTime.riseTimeSeconds)],
          ]}
        />
      )}
    </div>
  );
}

type PmbusDirection = 'decode' | 'encode';

export function PmbusLinearTool(): ReactElement {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<PmbusDirection>('decode');
  const [word, setWord] = useState('0x1E66');
  const [linearValue, setLinearValue] = useState('7.4');
  const [exponent, setExponent] = useState('-11');
  const [mantissa, setMantissa] = useState('7577');
  const [linear16Exponent, setLinear16Exponent] = useState('-9');

  const decoded11 = useMemo(() => {
    if (direction !== 'decode') return undefined;
    try {
      return decodeLinear11(Number(word));
    } catch {
      return null;
    }
  }, [direction, word]);

  const encoded11 = useMemo(() => {
    if (direction !== 'encode') return undefined;
    try {
      return encodeLinear11(Number(linearValue), exponent.trim().length === 0 ? undefined : Number(exponent));
    } catch {
      return null;
    }
  }, [direction, linearValue, exponent]);

  const decoded16 = useMemo(() => {
    try {
      return decodeLinear16(Number(mantissa), Number(linear16Exponent));
    } catch {
      return null;
    }
  }, [mantissa, linear16Exponent]);

  const directionOptions: Array<{ value: PmbusDirection; label: string }> = [
    { value: 'decode', label: t('calc.field.pmbusDecode') },
    { value: 'encode', label: t('calc.field.pmbusEncode') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Linear11</h2>
        <SectionSwitch value={direction} onChange={setDirection} options={directionOptions} />
        {direction === 'decode' ? (
          <>
            <TextField id="calc-word" label={t('calc.field.linear11Word')} value={word} onChange={setWord} monospace />
            {decoded11 === null ? <ErrorNotice message={t('calc.error.invalidInput')} /> : decoded11 !== undefined && <StatTable rows={[[t('calc.field.decodedValue'), String(decoded11)]]} />}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField id="calc-linearvalue" label={t('calc.field.value')} value={linearValue} onChange={setLinearValue} />
              <NumberField id="calc-exponent" label={t('calc.field.exponentOptional')} value={exponent} onChange={setExponent} />
            </div>
            {encoded11 === null ? (
              <ErrorNotice message={t('calc.error.invalidInput')} />
            ) : (
              encoded11 !== undefined && <StatTable rows={[[t('calc.field.encodedWord'), `0x${encoded11.toString(16).toUpperCase().padStart(4, '0')}`]]} />
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Linear16</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField id="calc-mantissa" label={t('calc.field.mantissa')} value={mantissa} onChange={setMantissa} />
          <NumberField id="calc-linear16exponent" label={t('calc.field.exponent')} value={linear16Exponent} onChange={setLinear16Exponent} />
        </div>
        {decoded16 === null ? <ErrorNotice message={t('calc.error.invalidInput')} /> : <StatTable rows={[[t('calc.field.decodedValue'), String(decoded16)]]} />}
      </div>
    </div>
  );
}
