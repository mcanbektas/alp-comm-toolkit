/**
 * SPI (ve QSPI/OSPI) zamanlama ve throughput hesap motoru.
 */

/** CPOL: clock idle seviyesi. 0=LOW, 1=HIGH (spec §3.1 "SPI Mode"). */
export type SpiClockPolarity = 0 | 1;
/** CPHA: örnekleme kenarı. 0=ilk kenarda örnekle, 1=ikinci kenarda örnekle. */
export type SpiClockPhase = 0 | 1;

export type SpiMode = 'mode0' | 'mode1' | 'mode2' | 'mode3';

/**
 * CPOL/CPHA çiftini standart SPI mode numarasına çevirir — tablo donanım
 * tarafında sabittir (Mode0=CPOL0/CPHA0 … Mode3=CPOL1/CPHA1, spec §3.1 "SPI
 * Mode" tablosu). İki ikili girdi (2×2=4 kombinasyon) olduğu için if/else
 * zinciri switch'ten daha az gürültülü ve tüm dallar TS tarafından `0|1`
 * daralmasıyla doğrulanır.
 */
export function resolveSpiMode(cpol: SpiClockPolarity, cpha: SpiClockPhase): SpiMode {
  if (cpol === 0 && cpha === 0) {
    return 'mode0';
  }
  if (cpol === 0 && cpha === 1) {
    return 'mode1';
  }
  if (cpol === 1 && cpha === 0) {
    return 'mode2';
  }
  return 'mode3';
}

// --- Transfer süresi ---

export interface SpiTransferTimeInput {
  totalClockBits: number;
  clockFrequencyHz: number;
}

export interface SpiTransferTimeResult {
  transferTimeSeconds: number;
}

/**
 * `Transfer Time = Total Clock Bits / SPI Clock Frequency` (spec §3.1 "SPI").
 * Zorunlu fixture: 32 clock bit, 10 MHz → 3.2 µs.
 */
export function calculateSpiTransferTime(input: SpiTransferTimeInput): SpiTransferTimeResult {
  if (input.clockFrequencyHz <= 0) {
    throw new RangeError('clockFrequencyHz pozitif olmalı');
  }
  return { transferTimeSeconds: input.totalClockBits / input.clockFrequencyHz };
}

// --- Transaction toplam süresi (faz toplamı) ---

/**
 * `T_total = T_setup + T_command + T_address + T_dummy + T_payload + T_crc +
 * T_hold` (spec §3.1 "SPI"). Her faz opsiyoneldir — protokole göre bazı fazlar
 * (ör. CRC) hiç kullanılmayabilir, verilmeyen faz 0 kabul edilir.
 */
export interface SpiTransactionPhasesSeconds {
  setupSeconds?: number;
  commandSeconds?: number;
  addressSeconds?: number;
  dummySeconds?: number;
  payloadSeconds?: number;
  crcSeconds?: number;
  holdSeconds?: number;
}

export interface SpiTransactionTimingResult {
  totalSeconds: number;
}

export function calculateSpiTransactionTiming(
  phases: SpiTransactionPhasesSeconds,
): SpiTransactionTimingResult {
  const totalSeconds =
    (phases.setupSeconds ?? 0) +
    (phases.commandSeconds ?? 0) +
    (phases.addressSeconds ?? 0) +
    (phases.dummySeconds ?? 0) +
    (phases.payloadSeconds ?? 0) +
    (phases.crcSeconds ?? 0) +
    (phases.holdSeconds ?? 0);

  return { totalSeconds };
}

// --- QSPI / OSPI throughput ---

/** QSPI 4 veri hattı (IO0-IO3) kullanır — SDR modda clock başına lane sayısı kadar bit taşınır. */
const QSPI_LANE_COUNT = 4;
/** OSPI 8 veri hattı (IO0-IO7) kullanır. */
const OSPI_LANE_COUNT = 8;
/** DDR (Double Data Rate) her iki clock kenarında da veri taşır → SDR'ın iki katı hat başına bit. */
const DDR_RATE_MULTIPLIER = 2;

export type SpiDataRateMode = 'sdr' | 'ddr';

export interface QspiThroughputInput {
  clockFrequencyHz: number;
}

export interface QspiThroughputResult {
  throughputBitsPerSecond: number;
}

/**
 * QSPI ham throughput'u — yalnız SDR (Microchip QSPI/Flash XIP kullanımının
 * tipik modu, spec §3.1 "Quad SPI"). `R = 4 × f_clock`. Zorunlu doğrulama:
 * 100 MHz → 400 Mbit/s.
 */
export function qspiThroughput(input: QspiThroughputInput): QspiThroughputResult {
  return { throughputBitsPerSecond: QSPI_LANE_COUNT * input.clockFrequencyHz };
}

export interface OspiThroughputInput {
  clockFrequencyHz: number;
  dataRateMode: SpiDataRateMode;
}

export interface OspiThroughputResult {
  throughputBitsPerSecond: number;
}

/**
 * OSPI ham throughput'u. SDR: `R = 8f`; DDR: `R = 16f` (spec §3.1 "Octal SPI").
 * Zorunlu doğrulama: 100 MHz DDR → 1.6 Gbit/s.
 */
export function ospiThroughput(input: OspiThroughputInput): OspiThroughputResult {
  const laneRate =
    input.dataRateMode === 'ddr' ? OSPI_LANE_COUNT * DDR_RATE_MULTIPLIER : OSPI_LANE_COUNT;

  return { throughputBitsPerSecond: laneRate * input.clockFrequencyHz };
}
