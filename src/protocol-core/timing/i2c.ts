/**
 * I²C zamanlama, 7-bit adres kodlama ve pull-up direnci hesap motoru.
 * SMBus/PMBus'a özgü Linear11/Linear16 formatları ayrı dosyadadır (`pmbus.ts`)
 * — I²C fiziksel katman ile PMBus komut/veri formatı farklı kaygılar.
 */

/** Her I²C byte'ı 8 veri biti taşır. */
const I2C_DATA_BITS_PER_BYTE = 8;
/** + 9. clock'ta ACK/NACK biti — bu yüzden byte başına toplam 9 clock (spec §3.1 "I²C"). */
const I2C_ACK_BITS_PER_BYTE = 1;
export const I2C_CLOCKS_PER_BYTE = I2C_DATA_BITS_PER_BYTE + I2C_ACK_BITS_PER_BYTE;

// --- Transfer süresi ---

export interface I2cTransferTimeInput {
  sclFrequencyHz: number;
  /** START/STOP hariç, aktarılan byte sayısı (adres byte'ı dahil). */
  byteCount: number;
}

export interface I2cTransferTimeResult {
  totalClockCount: number;
  transferTimeSeconds: number;
}

/**
 * `Transfer Time ≈ Total Clock Count / SCL Frequency` (spec §3.1 "I²C").
 * START/STOP süresi kasten dışarıda bırakılır — spec fixture'ı da "START/STOP
 * hariç" diyor: bunlar cihaza göre değişen, sabit-olmayan kısa geçişlerdir.
 * Zorunlu fixture: 400 kHz, 10 byte → 90 clock / 400000 Hz = 225 µs.
 */
export function calculateI2cTransferTime(input: I2cTransferTimeInput): I2cTransferTimeResult {
  if (input.sclFrequencyHz <= 0) {
    throw new RangeError('sclFrequencyHz pozitif olmalı');
  }
  const totalClockCount = input.byteCount * I2C_CLOCKS_PER_BYTE;

  return {
    totalClockCount,
    transferTimeSeconds: totalClockCount / input.sclFrequencyHz,
  };
}

// --- 7-bit adres kodlama ---

/** 7-bit I²C adres uzayının üst sınırı (0x00..0x7F). */
const I2C_7BIT_ADDRESS_MAX = 0x7f;

export interface I2cAddressBytes {
  writeByte: number;
  readByte: number;
}

/**
 * 7-bit cihaz adresini 8-bit write/read byte'larına çevirir. R/W biti LSB'dedir
 * (spec §3.1: `(0x68<<1)|0=0xD0`, `(0x68<<1)|1=0xD1`) — üst 7 bit adres, en alt
 * bit yön. Toolkit bu ayrımı KESİNLİKLE göstermeli çünkü entegrasyonda sık
 * karıştırılır (7-bit adres vs 8-bit write/read adresi).
 */
export function encodeI2c7BitAddress(address: number): I2cAddressBytes {
  if (address < 0 || address > I2C_7BIT_ADDRESS_MAX) {
    throw new RangeError(`7-bit I²C adresi 0x00..0x7F aralığında olmalı, alınan: ${address}`);
  }

  return {
    writeByte: (address << 1) | 0,
    readByte: (address << 1) | 1,
  };
}

// --- Pull-up direnci ---

/**
 * I²C bus rise-time yaklaşık modeli: `t_r ≈ 0.8473 × R_pullup × C_bus` (spec
 * §3.1 "Pull-up direnci hesabı"). Katsayı, open-drain hattın RC şarj eğrisinde
 * VOL'dan mantıksal HIGH eşiğine çıkışı yaklaşıklayan, I²C ekosisteminde
 * (NXP/TI uygulama notları) yaygın kullanılan ampirik sabittir — birebir RC
 * zaman sabiti (`R×C`) değil, eşik oranına göre ölçeklenmiş hâlidir; formülün
 * kendisi sabit tutulmalı, türetimi tartışmalıdır.
 */
const I2C_RISE_TIME_RC_COEFFICIENT = 0.8473;

export interface I2cRiseTimeInput {
  pullUpOhms: number;
  busCapacitanceFarads: number;
}

export interface I2cRiseTimeResult {
  riseTimeSeconds: number;
}

export function calculateI2cRiseTime(input: I2cRiseTimeInput): I2cRiseTimeResult {
  return {
    riseTimeSeconds: I2C_RISE_TIME_RC_COEFFICIENT * input.pullUpOhms * input.busCapacitanceFarads,
  };
}

export interface I2cPullUpRangeInput {
  /** Modun izin verdiği azami rise time (ör. Standard Mode ~1000 ns). */
  maxRiseTimeSeconds: number;
  busCapacitanceFarads: number;
  /** Bus besleme gerilimi (V_DD). */
  supplyVoltage: number;
  /** Alıcının garanti ettiği azami LOW çıkış gerilimi (V_OL_max). */
  outputLowMaxVoltage: number;
  /** Alıcının kaldırabileceği azami LOW (sink) akımı (I_OL). */
  outputLowMaxCurrentAmps: number;
}

export interface I2cPullUpRangeResult {
  /** Rise-time bütçesini aşmamak için üst sınır — R büyüdükçe yükselme yavaşlar. */
  maxPullUpOhms: number;
  /** Alıcının sink akımını aşmamak için alt sınır — R küçüldükçe LOW akımı artar. */
  minPullUpOhms: number;
}

/**
 * İzin verilen pull-up direnç aralığını hesaplar:
 * `R_max = t_r_max / (0.8473 × C_bus)`, `R_min = (V_DD − V_OL_max) / I_OL`
 * (spec §3.1 "Pull-up direnci hesabı"). İkisi arasındaki her değer geçerli bir
 * pull-up seçimidir; aralık ters dönerse (R_min > R_max) o hat konfigürasyonu
 * için uygun tek bir direnç yoktur — çağıran bunu karşılaştırıp uyarmalı.
 */
export function calculateI2cPullUpRange(input: I2cPullUpRangeInput): I2cPullUpRangeResult {
  if (input.busCapacitanceFarads <= 0 || input.outputLowMaxCurrentAmps <= 0) {
    throw new RangeError('busCapacitanceFarads ve outputLowMaxCurrentAmps pozitif olmalı');
  }

  const maxPullUpOhms =
    input.maxRiseTimeSeconds / (I2C_RISE_TIME_RC_COEFFICIENT * input.busCapacitanceFarads);
  const minPullUpOhms =
    (input.supplyVoltage - input.outputLowMaxVoltage) / input.outputLowMaxCurrentAmps;

  return { maxPullUpOhms, minPullUpOhms };
}
