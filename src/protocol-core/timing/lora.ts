/**
 * LoRa (Semtech chirp spread spectrum) PHY zamanlama ve link bütçesi motoru.
 *
 * Bu dosya LoRaWAN DEĞİLDİR: LoRaWAN MAC katmanını (MHDR/FHDR/FPort/MIC) çözer,
 * burada yalnız fiziksel katmanın ZAMAN hesabı vardır — sembol süresi, Time on
 * Air, kanal doluluğu, link bütçesi. Çerçeve çözülmez; girdiler kullanıcı
 * formundan gelir (katalogdaki `lora` kaydının `tabs` listesinde `decode` yoktur).
 *
 * ── CRC TERİMİ: İKİ RESMİ KAYNAK ÇATIŞIYOR (KAYNAK UYARISI) ──────────────────
 * Payload sembol sayısı formülünde CRC terimi iki kaynakta FARKLI yazılır:
 *
 *   Semtech SX1276/77/78/79 Datasheet Rev.7 (2020-05) §4.1.1.7 — PARAMETRİK:
 *       n_payload = 8 + max( ceil[ (8·PL − 4·SF + 28 + 16·CRC − 20·IH)
 *                                  / (4·(SF − 2·DE)) ] × (CR + 4), 0 )
 *
 *   AN1200.13 Rev.1 (2013) ve `avbentem/airtime-calculator` (MIT) — SABİT `+16`:
 *       CRC her zaman AÇIK varsayılır, fonksiyon imzasında `crc` parametresi yok.
 *
 * Bu dosya GÜNCEL datasheet'i (parametrik) uygular. Sabit `+16` yalnız "CRC hep
 * açık" özel durumunda (LoRaWAN uplink) doğru sonuç verir; CRC kapalı senaryoda
 * (LoRaWAN downlink) fazladan sembol sayar. İleride biri `avbentem` ile farklı
 * sonuç görürse hata sanmasın diye: CRC kapalıyken fark GERÇEKTİR ve bilinçlidir
 * — `lora.test.ts` ikisini ayıran fixture'ı tutar (SF7/BW125/CR4-5/PL=20:
 * CRC açık 56.576 ms, CRC kapalı 51.456 ms).
 *
 * ── SF6 ──────────────────────────────────────────────────────────────────────
 * SF6 yalnız implicit header ile çalışır (datasheet §4.1.1.2). Formül SF6'yı
 * hesaplar ama explicit header ile SF6 gerçek donanımda kurulamaz; bu bir
 * doğrulama hatası değil, çağıranın bileceği bir kısıttır — hesap engellenmez.
 */

/** Sembol süresi bu eşiği aşınca Low Data Rate Optimization zorunludur (datasheet §4.1.1.6). */
const LORA_LDRO_THRESHOLD_SECONDS = 16e-3;

/** Preamble'a eklenen sabit senkronizasyon payı: 4.25 sembol (datasheet §4.1.1.6). */
const LORA_PREAMBLE_OVERHEAD_SYMBOLS = 4.25;

/** Payload'ın önündeki sabit sembol sayısı — formüldeki `8 +` terimi. */
const LORA_PAYLOAD_FIXED_SYMBOLS = 8;

const LORA_MIN_SPREADING_FACTOR = 6;
const LORA_MAX_SPREADING_FACTOR = 12;
/** PHY payload uzunluğu bayt cinsinden; datasheet 1-255 der, 0 da hesaplanabilir. */
const LORA_MAX_PAYLOAD_BYTES = 255;

/**
 * SF başına demodülatör SNR limiti, dB (datasheet Rev.7 Tablo 13). Duyarlılık
 * tahmininin tek protokole özgü terimi budur; gerisi termal gürültüdür.
 */
const LORA_DEMODULATOR_SNR_DB: Readonly<Record<number, number>> = {
  6: -5,
  7: -7.5,
  8: -10,
  9: -12.5,
  10: -15,
  11: -17.5,
  12: -20,
};

/** Termal gürültü tabanı, 1 Hz bant genişliğinde, 290 K: kTB = −174 dBm/Hz. */
const THERMAL_NOISE_DBM_PER_HZ = -174;

/**
 * Serbest uzay yol kaybı sabiti, metre + Hz birimleri için:
 * FSPL(dB) = 20·log10(d_m) + 20·log10(f_Hz) − 147.55.
 */
const FREE_SPACE_CONSTANT_DB = 147.55;

function assertSpreadingFactor(spreadingFactor: number): void {
  if (
    !Number.isInteger(spreadingFactor) ||
    spreadingFactor < LORA_MIN_SPREADING_FACTOR ||
    spreadingFactor > LORA_MAX_SPREADING_FACTOR
  ) {
    throw new RangeError('spreadingFactor 6-12 arası tam sayı olmalı');
  }
}

function assertBandwidth(bandwidthHz: number): void {
  if (!(bandwidthHz > 0)) {
    throw new RangeError('bandwidthHz pozitif olmalı');
  }
}

export interface LoraSymbolTimingInput {
  spreadingFactor: number;
  bandwidthHz: number;
}

export interface LoraSymbolTimingResult {
  symbolTimeSeconds: number;
  symbolRateHz: number;
  /** Ts > 16 ms — datasheet LDRO'yu bu noktada ZORUNLU kılar, öneri değil. */
  lowDataRateOptimizationRequired: boolean;
}

/**
 * Sembol süresi ve sembol hızı: `Ts = 2^SF / BW`, `Rs = 1 / Ts`.
 * Üç kaynak (datasheet Rev.7, AN1200.13, avbentem) bu iki formülde birebir örtüşür.
 */
export function calculateLoraSymbolTiming(input: LoraSymbolTimingInput): LoraSymbolTimingResult {
  assertSpreadingFactor(input.spreadingFactor);
  assertBandwidth(input.bandwidthHz);

  const symbolTimeSeconds = 2 ** input.spreadingFactor / input.bandwidthHz;

  return {
    symbolTimeSeconds,
    symbolRateHz: 1 / symbolTimeSeconds,
    lowDataRateOptimizationRequired: symbolTimeSeconds > LORA_LDRO_THRESHOLD_SECONDS,
  };
}

export interface LoraTimeOnAirInput {
  spreadingFactor: number;
  bandwidthHz: number;
  /** Kodlama oranı payı: 1..4 → 4/5, 4/6, 4/7, 4/8. Formüldeki `CR`. */
  codingRate: number;
  /** PHY payload bayt sayısı (`PL`), 0-255. */
  payloadBytes: number;
  /** Programlanan preamble sembol sayısı (`n_preamble`); LoRaWAN varsayılanı 8. */
  preambleSymbols: number;
  /** Formüldeki `CRC` — payload CRC'si açık mı. Karar 2: SABİT DEĞİL, parametrik. */
  crcEnabled: boolean;
  /** Formüldeki `IH` — implicit header (header baytları havada taşınmaz). */
  implicitHeader: boolean;
  /**
   * Formüldeki `DE`. Verilmezse datasheet kuralıyla OTOMATİK belirlenir
   * (Ts > 16 ms → açık); elle verilirse o değer aynen kullanılır, çünkü gerçek
   * donanımda LDRO eşik altında da elle açılabilir.
   */
  lowDataRateOptimization?: boolean;
}

export interface LoraTimeOnAirResult {
  symbolTimeSeconds: number;
  symbolRateHz: number;
  /** `n_preamble + 4.25` — kesirli, yuvarlanmaz. */
  totalPreambleSymbols: number;
  preambleTimeSeconds: number;
  payloadSymbolCount: number;
  payloadTimeSeconds: number;
  timeOnAirSeconds: number;
  /** PHY ham bit hızı: `SF × (4/(4+CR)) / Ts`. */
  bitRateBitsPerSecond: number;
  /** Payload baytlarının ToA'ya bölümü — preamble/header payını da yüklenir. */
  effectiveBitRateBitsPerSecond: number;
  /** Hesapta gerçekten kullanılan `DE` değeri (otomatik seçim burada görünür). */
  lowDataRateOptimizationApplied: boolean;
}

/**
 * Time on Air — bu kaydın asıl işi (katalog `wireless-iot.ts`, `lora`).
 *
 * `n_payload = 8 + max( ceil[ (8·PL − 4·SF + 28 + 16·CRC − 20·IH) / (4·(SF − 2·DE)) ]
 *              × (CR + 4), 0 )` — Semtech SX1276 Datasheet Rev.7 §4.1.1.7.
 *
 * `max(…, 0)` DIŞ terime uygulanır, ceil'in içine değil: çok kısa payload'da
 * pay negatif olur, ceil negatif kalır ve ancak çarpımdan SONRA sıfıra kırpılır.
 * Sırayı bozmak kısa paketlerde sessiz-yanlış sonuç üretir.
 */
export function calculateLoraTimeOnAir(input: LoraTimeOnAirInput): LoraTimeOnAirResult {
  assertSpreadingFactor(input.spreadingFactor);
  assertBandwidth(input.bandwidthHz);

  if (!Number.isInteger(input.codingRate) || input.codingRate < 1 || input.codingRate > 4) {
    throw new RangeError('codingRate 1-4 arası tam sayı olmalı (4/5..4/8)');
  }
  if (
    !Number.isInteger(input.payloadBytes) ||
    input.payloadBytes < 0 ||
    input.payloadBytes > LORA_MAX_PAYLOAD_BYTES
  ) {
    throw new RangeError('payloadBytes 0-255 arası tam sayı olmalı');
  }
  if (!Number.isInteger(input.preambleSymbols) || input.preambleSymbols < 0) {
    throw new RangeError('preambleSymbols negatif olmayan tam sayı olmalı');
  }

  const symbolTiming = calculateLoraSymbolTiming(input);
  const lowDataRateOptimizationApplied =
    input.lowDataRateOptimization ?? symbolTiming.lowDataRateOptimizationRequired;

  const crcTerm = input.crcEnabled ? 1 : 0;
  const implicitHeaderTerm = input.implicitHeader ? 1 : 0;
  const lowDataRateTerm = lowDataRateOptimizationApplied ? 1 : 0;

  const numerator =
    8 * input.payloadBytes -
    4 * input.spreadingFactor +
    28 +
    16 * crcTerm -
    20 * implicitHeaderTerm;
  // SF ∈ [6,12] ve DE ∈ {0,1} olduğu için payda en küçük 4·(6−2)=16; sıfıra bölme yok.
  const denominator = 4 * (input.spreadingFactor - 2 * lowDataRateTerm);

  const payloadSymbolCount =
    LORA_PAYLOAD_FIXED_SYMBOLS +
    Math.max(Math.ceil(numerator / denominator) * (input.codingRate + 4), 0);

  const totalPreambleSymbols = input.preambleSymbols + LORA_PREAMBLE_OVERHEAD_SYMBOLS;
  const preambleTimeSeconds = totalPreambleSymbols * symbolTiming.symbolTimeSeconds;
  const payloadTimeSeconds = payloadSymbolCount * symbolTiming.symbolTimeSeconds;
  const timeOnAirSeconds = preambleTimeSeconds + payloadTimeSeconds;

  const bitRateBitsPerSecond =
    (input.spreadingFactor * (4 / (4 + input.codingRate))) / symbolTiming.symbolTimeSeconds;

  return {
    symbolTimeSeconds: symbolTiming.symbolTimeSeconds,
    symbolRateHz: symbolTiming.symbolRateHz,
    totalPreambleSymbols,
    preambleTimeSeconds,
    payloadSymbolCount,
    payloadTimeSeconds,
    timeOnAirSeconds,
    bitRateBitsPerSecond,
    effectiveBitRateBitsPerSecond: (input.payloadBytes * 8) / timeOnAirSeconds,
    lowDataRateOptimizationApplied,
  };
}

export interface LoraAirtimeInput {
  timeOnAirSeconds: number;
  /** İzin verilen kanal doluluk oranı, yüzde (ör. EU868 g1 bandı: 1). */
  dutyCyclePercent: number;
  /** Verilirse planlanan hızın doluluk karşılığı da hesaplanır. */
  packetsPerHour?: number;
}

export interface LoraAirtimeResult {
  maxPacketsPerHour: number;
  maxPacketsPerDay: number;
  /** Bir gönderimden sonra beklenmesi gereken asgari sessizlik. */
  minimumOffTimeSeconds: number;
  /** Gönderim başlangıçları arası asgari aralık (ToA dahil). */
  minimumIntervalSeconds: number;
  occupancyPercent?: number;
  withinDutyCycle?: boolean;
}

/**
 * Duty cycle sınırı altında kaç paket sığdığı ve gönderim sonrası sessizlik payı.
 *
 * Sınır ZAMAN üzerinden tanımlıdır, paket sayısı üzerinden değil: aynı duty
 * cycle SF12'de saatte birkaç pakete, SF7'de yüzlercesine karşılık gelir.
 */
export function calculateLoraAirtime(input: LoraAirtimeInput): LoraAirtimeResult {
  if (!(input.timeOnAirSeconds > 0)) {
    throw new RangeError('timeOnAirSeconds pozitif olmalı');
  }
  if (!(input.dutyCyclePercent > 0) || input.dutyCyclePercent > 100) {
    throw new RangeError('dutyCyclePercent 0 ile 100 arasında olmalı');
  }

  const dutyCycleRatio = input.dutyCyclePercent / 100;
  const maxPacketsPerHour = (3600 * dutyCycleRatio) / input.timeOnAirSeconds;

  const result: LoraAirtimeResult = {
    maxPacketsPerHour,
    maxPacketsPerDay: maxPacketsPerHour * 24,
    minimumOffTimeSeconds: input.timeOnAirSeconds * (1 / dutyCycleRatio - 1),
    minimumIntervalSeconds: input.timeOnAirSeconds / dutyCycleRatio,
  };

  if (input.packetsPerHour !== undefined) {
    if (input.packetsPerHour < 0) {
      throw new RangeError('packetsPerHour negatif olamaz');
    }
    const occupancyPercent = ((input.packetsPerHour * input.timeOnAirSeconds) / 3600) * 100;
    result.occupancyPercent = occupancyPercent;
    result.withinDutyCycle = occupancyPercent <= input.dutyCyclePercent;
  }

  return result;
}

export interface LoraEnergyInput {
  /** Tek gönderimin havada geçirdiği süre — `calculateLoraTimeOnAir` çıktısı. */
  timeOnAirSeconds: number;
  transmitCurrentMilliamps: number;
  receiveCurrentMilliamps: number;
  /** Class A'da RX1+RX2 pencerelerinin TOPLAM dinleme süresi. */
  receiveWindowSeconds: number;
  /** Radyo dışındaki uyanık tüketim (MCU, sensör okuma). */
  activeCurrentMilliamps: number;
  activeSeconds: number;
  sleepCurrentMicroamps: number;
  messagesPerDay: number;
  batteryCapacityMilliampHours: number;
  /**
   * Kullanılamayan kapasite payı, yüzde: kesme gerilimi, düşük sıcaklık, üretim
   * toleransı. Verilmezse 0 — motor kendiliğinden bir kimya varsaymaz.
   */
  deratingPercent?: number;
  /**
   * Kendiliğinden boşalma, yıllık yüzde. Verilmezse 0. Düşük duty cycle'lı bir
   * düğümde bu terim gönderim yükünü RAHATLIKLA geçer — sıfır bırakmak ömrü
   * kat kat abartır, bu yüzden ayrı ve görünür bir girdidir.
   */
  selfDischargePercentPerYear?: number;
}

export interface LoraEnergyResult {
  /** Gönderim başına yükler, µAh. */
  transmitChargeMicroampHours: number;
  receiveChargeMicroampHours: number;
  activeChargeMicroampHours: number;
  chargePerMessageMicroampHours: number;
  dailyActiveChargeMilliampHours: number;
  dailySleepChargeMilliampHours: number;
  dailySelfDischargeMilliampHours: number;
  dailyChargeMilliampHours: number;
  averageCurrentMicroamps: number;
  usableCapacityMilliampHours: number;
  /** Uykunun + kendiliğinden boşalmanın toplam içindeki payı — tasarımın nereye bakacağını söyler. */
  idleSharePercent: number;
  /** Günlük tüketim sıfırsa üretilmez (ömür tanımsızdır, sonsuz değil). */
  batteryLifeDays?: number;
  batteryLifeYears?: number;
}

/** Artık yılı da kapsayan ortalama — yıllık kendiliğinden boşalmayı güne indirger. */
const DAYS_PER_YEAR = 365.25;

/** mA × saniye → µAh. 1 mA·s = 1/3.6 µAh. */
function milliampSecondsToMicroampHours(currentMilliamps: number, seconds: number): number {
  return (currentMilliamps * seconds) / 3.6;
}

/**
 * Pil/enerji tahmini (katalog: "Battery / Energy Estimator").
 *
 * Model bilinçli olarak DÜZ: sabit akımlı üç pencere (gönderim, alım, uyanık
 * işlem) + sürekli uyku + kendiliğenden boşalma. İçermedikleri, sonucu okurken
 * bilinmesi gerekenler:
 *   - Sıcaklık etkisi ve darbe akımı altında gerilim çökmesi YOK. Li-SOCl2 gibi
 *     yüksek iç dirençli kimyalarda gerçek sınır çoğu zaman kapasite değil,
 *     TX darbesinde kesme gerilimine düşmektir.
 *   - Radyo rampası (PLL kilidi, PA ısınması) ToA'ya dahil değildir; gerçek
 *     gönderim penceresi ToA'dan birkaç ms uzundur.
 *   - Raf ömrü tavanı YOK: model 40 yıl da diyebilir, hiçbir pil o kadar durmaz.
 */
export function calculateLoraEnergyBudget(input: LoraEnergyInput): LoraEnergyResult {
  const nonNegative: ReadonlyArray<readonly [string, number]> = [
    ['timeOnAirSeconds', input.timeOnAirSeconds],
    ['transmitCurrentMilliamps', input.transmitCurrentMilliamps],
    ['receiveCurrentMilliamps', input.receiveCurrentMilliamps],
    ['receiveWindowSeconds', input.receiveWindowSeconds],
    ['activeCurrentMilliamps', input.activeCurrentMilliamps],
    ['activeSeconds', input.activeSeconds],
    ['sleepCurrentMicroamps', input.sleepCurrentMicroamps],
    ['messagesPerDay', input.messagesPerDay],
  ];
  for (const [name, value] of nonNegative) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} negatif olmayan sonlu bir sayı olmalı`);
    }
  }
  if (!(input.batteryCapacityMilliampHours > 0)) {
    throw new RangeError('batteryCapacityMilliampHours pozitif olmalı');
  }

  const deratingPercent = input.deratingPercent ?? 0;
  if (deratingPercent < 0 || deratingPercent >= 100) {
    throw new RangeError('deratingPercent 0 ile 100 arasında olmalı (100 hariç)');
  }

  const selfDischargePercentPerYear = input.selfDischargePercentPerYear ?? 0;
  if (selfDischargePercentPerYear < 0 || selfDischargePercentPerYear > 100) {
    throw new RangeError('selfDischargePercentPerYear 0 ile 100 arasında olmalı');
  }

  const transmitChargeMicroampHours = milliampSecondsToMicroampHours(
    input.transmitCurrentMilliamps,
    input.timeOnAirSeconds,
  );
  const receiveChargeMicroampHours = milliampSecondsToMicroampHours(
    input.receiveCurrentMilliamps,
    input.receiveWindowSeconds,
  );
  const activeChargeMicroampHours = milliampSecondsToMicroampHours(
    input.activeCurrentMilliamps,
    input.activeSeconds,
  );
  const chargePerMessageMicroampHours =
    transmitChargeMicroampHours + receiveChargeMicroampHours + activeChargeMicroampHours;

  const dailyActiveChargeMilliampHours =
    (chargePerMessageMicroampHours * input.messagesPerDay) / 1000;
  // Uyku akımı sürekli akar; gönderim pencerelerinin uykudan düştüğü pay bu
  // ölçekte gürültüdür (saniyeler vs. 24 saat) ve KASTEN düşülmez.
  const dailySleepChargeMilliampHours = (input.sleepCurrentMicroamps * 24) / 1000;
  // Kendiliğinden boşalma kalan kapasiteyle orantılıdır; burada NOMİNAL kapasite
  // üzerinden sabit alınır — üstten sınır verir, ömrü abartmaz.
  const dailySelfDischargeMilliampHours =
    (input.batteryCapacityMilliampHours * (selfDischargePercentPerYear / 100)) / DAYS_PER_YEAR;

  const dailyChargeMilliampHours =
    dailyActiveChargeMilliampHours + dailySleepChargeMilliampHours + dailySelfDischargeMilliampHours;
  const usableCapacityMilliampHours =
    input.batteryCapacityMilliampHours * (1 - deratingPercent / 100);

  const result: LoraEnergyResult = {
    transmitChargeMicroampHours,
    receiveChargeMicroampHours,
    activeChargeMicroampHours,
    chargePerMessageMicroampHours,
    dailyActiveChargeMilliampHours,
    dailySleepChargeMilliampHours,
    dailySelfDischargeMilliampHours,
    dailyChargeMilliampHours,
    averageCurrentMicroamps: (dailyChargeMilliampHours * 1000) / 24,
    usableCapacityMilliampHours,
    idleSharePercent:
      dailyChargeMilliampHours === 0
        ? 0
        : ((dailySleepChargeMilliampHours + dailySelfDischargeMilliampHours) /
            dailyChargeMilliampHours) *
          100,
  };

  if (dailyChargeMilliampHours > 0) {
    const batteryLifeDays = usableCapacityMilliampHours / dailyChargeMilliampHours;
    result.batteryLifeDays = batteryLifeDays;
    result.batteryLifeYears = batteryLifeDays / DAYS_PER_YEAR;
  }

  return result;
}

export interface LoraSensitivityInput {
  spreadingFactor: number;
  bandwidthHz: number;
  /** Alıcı gürültü figürü, dB. SX127x için tipik ~6 dB. */
  noiseFigureDb?: number;
}

export interface LoraSensitivityResult {
  thermalNoiseDbm: number;
  demodulatorSnrDb: number;
  sensitivityDbm: number;
}

/**
 * Duyarlılık TAHMİNİ: `S = −174 + 10·log10(BW) + NF + SNR_limit`.
 *
 * Datasheet'in ölçülmüş duyarlılık tablosunun yerine geçmez — kart tasarımı,
 * anten uyumu ve sıcaklık burada yok. SF7/BW125/NF=6 için −124.5 dBm verir,
 * datasheet'in ölçtüğü değer −123 dBm; fark tam da bu terimlerdir.
 */
export function estimateLoraSensitivity(input: LoraSensitivityInput): LoraSensitivityResult {
  assertSpreadingFactor(input.spreadingFactor);
  assertBandwidth(input.bandwidthHz);

  const noiseFigureDb = input.noiseFigureDb ?? 6;
  const demodulatorSnrDb = LORA_DEMODULATOR_SNR_DB[input.spreadingFactor];
  // assertSpreadingFactor tabloyu garanti eder; guard `noUncheckedIndexedAccess` içindir.
  if (demodulatorSnrDb === undefined) {
    throw new RangeError('spreadingFactor için SNR limiti tanımlı değil');
  }

  const thermalNoiseDbm = THERMAL_NOISE_DBM_PER_HZ + 10 * Math.log10(input.bandwidthHz);

  return {
    thermalNoiseDbm,
    demodulatorSnrDb,
    sensitivityDbm: thermalNoiseDbm + noiseFigureDb + demodulatorSnrDb,
  };
}

export interface LoraLinkBudgetInput {
  txPowerDbm: number;
  txAntennaGainDbi: number;
  rxAntennaGainDbi: number;
  /** Verici tarafındaki kablo/konnektör kaybı, dB. */
  cableLossDb: number;
  sensitivityDbm: number;
  /** Verilirse serbest uzay menzil tahmini de üretilir. */
  frequencyHz?: number;
  /** Verilirse ölçülen RSSI'ın duyarlılığa göre marjı üretilir. */
  measuredRssiDbm?: number;
}

export interface LoraLinkBudgetResult {
  effectiveRadiatedPowerDbm: number;
  maximumPathLossDb: number;
  /** SERBEST UZAY tahmini — engel, kırınım ve arazi yok, saha menzili değil. */
  estimatedFreeSpaceRangeMeters?: number;
  measuredMarginDb?: number;
}

/**
 * Link bütçesi ve marj (katalog: "theoretical estimate" — vaat bu kadarıdır).
 *
 * `maxPathLoss = (Ptx + Gtx − Lcable) + Grx − S`. Menzil tahmini serbest uzay
 * modelidir: `FSPL = 20·log10(d) + 20·log10(f) − 147.55`. Gerçek LoRa
 * dağıtımında yol kaybı üssü 2 değil 2.7-4 arasıdır; bu sayı ÜST SINIRDIR.
 */
export function calculateLoraLinkBudget(input: LoraLinkBudgetInput): LoraLinkBudgetResult {
  const effectiveRadiatedPowerDbm = input.txPowerDbm + input.txAntennaGainDbi - input.cableLossDb;
  const maximumPathLossDb =
    effectiveRadiatedPowerDbm + input.rxAntennaGainDbi - input.sensitivityDbm;

  const result: LoraLinkBudgetResult = { effectiveRadiatedPowerDbm, maximumPathLossDb };

  if (input.frequencyHz !== undefined) {
    if (!(input.frequencyHz > 0)) {
      throw new RangeError('frequencyHz pozitif olmalı');
    }
    // Yol kaybı negatifse link zaten kapalı; negatif üsten "menzil" üretmek yanıltır.
    if (maximumPathLossDb > 0) {
      const exponent =
        (maximumPathLossDb + FREE_SPACE_CONSTANT_DB - 20 * Math.log10(input.frequencyHz)) / 20;
      result.estimatedFreeSpaceRangeMeters = 10 ** exponent;
    }
  }

  if (input.measuredRssiDbm !== undefined) {
    result.measuredMarginDb = input.measuredRssiDbm - input.sensitivityDbm;
  }

  return result;
}
