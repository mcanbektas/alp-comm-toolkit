import { describe, expect, it } from 'vitest';

import {
  calculateLoraAirtime,
  calculateLoraEnergyBudget,
  calculateLoraLinkBudget,
  calculateLoraSymbolTiming,
  calculateLoraTimeOnAir,
  estimateLoraSensitivity,
} from './lora';
import type { LoraEnergyInput, LoraTimeOnAirInput } from './lora';

/** EU868 LoRaWAN varsayılanı: BW 125 kHz, CR 4/5, 8 sembol preamble, explicit header, CRC açık. */
const BASE: LoraTimeOnAirInput = {
  spreadingFactor: 7,
  bandwidthHz: 125_000,
  codingRate: 1,
  payloadBytes: 20,
  preambleSymbols: 8,
  crcEnabled: true,
  implicitHeader: false,
  lowDataRateOptimization: false,
};

describe('calculateLoraSymbolTiming — Ts = 2^SF / BW', () => {
  it('SF7/BW125 kHz → 1.024 ms sembol, 976.5625 sembol/s', () => {
    const result = calculateLoraSymbolTiming({ spreadingFactor: 7, bandwidthHz: 125_000 });

    expect(result.symbolTimeSeconds).toBeCloseTo(0.001024, 12);
    expect(result.symbolRateHz).toBeCloseTo(976.5625, 6);
    expect(result.lowDataRateOptimizationRequired).toBe(false);
  });

  it('LDRO eşiği 16 ms: SF10 altında, SF11 üstünde kalır', () => {
    // SF10/BW125 → 8.192 ms, SF11/BW125 → 16.384 ms. Eşik ikisinin arasından geçer.
    expect(
      calculateLoraSymbolTiming({ spreadingFactor: 10, bandwidthHz: 125_000 })
        .lowDataRateOptimizationRequired,
    ).toBe(false);
    expect(
      calculateLoraSymbolTiming({ spreadingFactor: 11, bandwidthHz: 125_000 })
        .lowDataRateOptimizationRequired,
    ).toBe(true);
  });

  it('bant genişliği artınca sembol kısalır: SF12/BW500 = SF10/BW125', () => {
    const wide = calculateLoraSymbolTiming({ spreadingFactor: 12, bandwidthHz: 500_000 });
    const narrow = calculateLoraSymbolTiming({ spreadingFactor: 10, bandwidthHz: 125_000 });

    expect(wide.symbolTimeSeconds).toBeCloseTo(narrow.symbolTimeSeconds, 12);
  });

  it('geçersiz SF ve bant genişliğinde RangeError fırlatır', () => {
    expect(() => calculateLoraSymbolTiming({ spreadingFactor: 5, bandwidthHz: 125_000 })).toThrow(RangeError);
    expect(() => calculateLoraSymbolTiming({ spreadingFactor: 13, bandwidthHz: 125_000 })).toThrow(RangeError);
    expect(() => calculateLoraSymbolTiming({ spreadingFactor: 7.5, bandwidthHz: 125_000 })).toThrow(RangeError);
    expect(() => calculateLoraSymbolTiming({ spreadingFactor: 7, bandwidthHz: 0 })).toThrow(RangeError);
  });
});

describe('calculateLoraTimeOnAir — Semtech SX1276 Rev.7 §4.1.1.7', () => {
  it('SF7/BW125/CR4-5, 10 bayt → 41.216 ms (yayınlanmış TTN/avbentem değeri)', () => {
    // Elle doğrulama: n_payload = 8 + ceil((80−28+28+16)/28)×5 = 8 + 4×5 = 28.
    //   Tpreamble = 12.25 × 1.024 = 12.544 ms, Tpayload = 28 × 1.024 = 28.672 ms.
    const result = calculateLoraTimeOnAir({ ...BASE, payloadBytes: 10 });

    expect(result.payloadSymbolCount).toBe(28);
    expect(result.preambleTimeSeconds).toBeCloseTo(0.012544, 9);
    expect(result.payloadTimeSeconds).toBeCloseTo(0.028672, 9);
    expect(result.timeOnAirSeconds).toBeCloseTo(0.041216, 9);
  });

  it('SF7/BW125/CR4-5, 25 bayt → 61.696 ms', () => {
    // n_payload = 8 + ceil((200−28+28+16)/28)×5 = 8 + 8×5 = 48.
    const result = calculateLoraTimeOnAir({ ...BASE, payloadBytes: 25 });

    expect(result.payloadSymbolCount).toBe(48);
    expect(result.timeOnAirSeconds).toBeCloseTo(0.061696, 9);
  });

  it('KARAR 2 — CRC parametriktir: aynı paket CRC kapalıyken 5 sembol kısalır', () => {
    // Bu çift `avbentem`/AN1200.13'ün sabit `+16` varsayımını doğrudan ayırt eder:
    // sabit terimle iki sonuç EŞİT çıkardı. 56.576 ms ≠ 51.456 ms.
    const withCrc = calculateLoraTimeOnAir({ ...BASE, crcEnabled: true });
    const withoutCrc = calculateLoraTimeOnAir({ ...BASE, crcEnabled: false });

    expect(withCrc.payloadSymbolCount).toBe(43);
    expect(withoutCrc.payloadSymbolCount).toBe(38);
    expect(withCrc.timeOnAirSeconds).toBeCloseTo(0.056576, 9);
    expect(withoutCrc.timeOnAirSeconds).toBeCloseTo(0.051456, 9);
    expect(withCrc.timeOnAirSeconds).toBeGreaterThan(withoutCrc.timeOnAirSeconds);
  });

  it('implicit header 20·IH terimini düşürür ve paketi kısaltır', () => {
    // n_payload = 8 + ceil((160−28+28+16−20)/28)×5 = 8 + 6×5 = 38.
    const result = calculateLoraTimeOnAir({ ...BASE, implicitHeader: true });

    expect(result.payloadSymbolCount).toBe(38);
    expect(result.timeOnAirSeconds).toBeCloseTo(0.051456, 9);
  });

  it('LDRO paydayı 4·(SF−2) yapar: SF12/50 bayt için 2301.952 ms ↔ 2138.112 ms', () => {
    const withLdro = calculateLoraTimeOnAir({
      ...BASE,
      spreadingFactor: 12,
      payloadBytes: 50,
      lowDataRateOptimization: true,
    });
    const withoutLdro = calculateLoraTimeOnAir({
      ...BASE,
      spreadingFactor: 12,
      payloadBytes: 50,
      lowDataRateOptimization: false,
    });

    expect(withLdro.payloadSymbolCount).toBe(58);
    expect(withoutLdro.payloadSymbolCount).toBe(53);
    expect(withLdro.timeOnAirSeconds).toBeCloseTo(2.301952, 9);
    expect(withoutLdro.timeOnAirSeconds).toBeCloseTo(2.138112, 9);
  });

  it('LDRO verilmezse Ts > 16 ms kuralıyla kendiliğinden açılır', () => {
    const { lowDataRateOptimization: _unused, ...withoutFlag } = BASE;

    expect(
      calculateLoraTimeOnAir({ ...withoutFlag, spreadingFactor: 12 })
        .lowDataRateOptimizationApplied,
    ).toBe(true);
    expect(
      calculateLoraTimeOnAir({ ...withoutFlag, spreadingFactor: 7 })
        .lowDataRateOptimizationApplied,
    ).toBe(false);
  });

  it('max(…,0) kırpması dış terime uygulanır — negatif payda payload sembolü 8 kalır', () => {
    // PL=0, SF12, CRC kapalı, implicit header, LDRO açık: pay = −40, payda = 40 →
    // ceil(−1) = −1, ×5 = −5, kırpma sonrası 0. n_payload = 8, ToA = 20.25 × 32.768 ms.
    const result = calculateLoraTimeOnAir({
      ...BASE,
      spreadingFactor: 12,
      payloadBytes: 0,
      crcEnabled: false,
      implicitHeader: true,
      lowDataRateOptimization: true,
    });

    expect(result.payloadSymbolCount).toBe(8);
    expect(result.timeOnAirSeconds).toBeCloseTo(0.663552, 9);
  });

  it('SF7/BW125/CR4-5 ham bit hızı 5468.75 bit/s (datasheet DR5)', () => {
    const result = calculateLoraTimeOnAir(BASE);

    expect(result.bitRateBitsPerSecond).toBeCloseTo(5468.75, 6);
    // Etkin hız preamble/header payını da yüklenir, ham hızın altında kalır.
    expect(result.effectiveBitRateBitsPerSecond).toBeCloseTo(160 / 0.056576, 6);
    expect(result.effectiveBitRateBitsPerSecond).toBeLessThan(result.bitRateBitsPerSecond);
  });

  it('preamble payı 4.25 sembol sabittir', () => {
    expect(calculateLoraTimeOnAir({ ...BASE, preambleSymbols: 8 }).totalPreambleSymbols).toBe(12.25);
    expect(calculateLoraTimeOnAir({ ...BASE, preambleSymbols: 0 }).totalPreambleSymbols).toBe(4.25);
  });

  it('geçersiz coding rate, payload ve preamble değerlerinde RangeError fırlatır', () => {
    expect(() => calculateLoraTimeOnAir({ ...BASE, codingRate: 0 })).toThrow(RangeError);
    expect(() => calculateLoraTimeOnAir({ ...BASE, codingRate: 5 })).toThrow(RangeError);
    expect(() => calculateLoraTimeOnAir({ ...BASE, payloadBytes: 256 })).toThrow(RangeError);
    expect(() => calculateLoraTimeOnAir({ ...BASE, payloadBytes: -1 })).toThrow(RangeError);
    expect(() => calculateLoraTimeOnAir({ ...BASE, payloadBytes: 1.5 })).toThrow(RangeError);
    expect(() => calculateLoraTimeOnAir({ ...BASE, preambleSymbols: -1 })).toThrow(RangeError);
  });
});

describe('calculateLoraAirtime — duty cycle', () => {
  it('EU868 %1 sınırı altında 56.576 ms paket: saatte 636.3 paket, 5.601 s sessizlik', () => {
    const result = calculateLoraAirtime({ timeOnAirSeconds: 0.056576, dutyCyclePercent: 1 });

    expect(result.maxPacketsPerHour).toBeCloseTo(36 / 0.056576, 6);
    expect(result.maxPacketsPerDay).toBeCloseTo((36 / 0.056576) * 24, 6);
    expect(result.minimumOffTimeSeconds).toBeCloseTo(5.601024, 9);
    expect(result.minimumIntervalSeconds).toBeCloseTo(5.6576, 9);
  });

  it('planlanan hız verilirse doluluk ve sınır uyumu üretilir', () => {
    const within = calculateLoraAirtime({
      timeOnAirSeconds: 0.056576,
      dutyCyclePercent: 1,
      packetsPerHour: 100,
    });
    const exceeding = calculateLoraAirtime({
      timeOnAirSeconds: 0.056576,
      dutyCyclePercent: 1,
      packetsPerHour: 1000,
    });

    expect(within.occupancyPercent).toBeCloseTo(0.15715555555, 9);
    expect(within.withinDutyCycle).toBe(true);
    expect(exceeding.occupancyPercent).toBeCloseTo(1.5715555555, 9);
    expect(exceeding.withinDutyCycle).toBe(false);
  });

  it('hız verilmezse doluluk alanları hiç üretilmez', () => {
    const result = calculateLoraAirtime({ timeOnAirSeconds: 0.056576, dutyCyclePercent: 1 });

    expect(result.occupancyPercent).toBeUndefined();
    expect(result.withinDutyCycle).toBeUndefined();
  });

  it('geçersiz ToA ve duty cycle değerlerinde RangeError fırlatır', () => {
    expect(() => calculateLoraAirtime({ timeOnAirSeconds: 0, dutyCyclePercent: 1 })).toThrow(RangeError);
    expect(() => calculateLoraAirtime({ timeOnAirSeconds: 0.05, dutyCyclePercent: 0 })).toThrow(RangeError);
    expect(() => calculateLoraAirtime({ timeOnAirSeconds: 0.05, dutyCyclePercent: 101 })).toThrow(RangeError);
    expect(() =>
      calculateLoraAirtime({ timeOnAirSeconds: 0.05, dutyCyclePercent: 1, packetsPerHour: -1 }),
    ).toThrow(RangeError);
  });
});

/**
 * SX1276 sınıfı bir düğüm: 14 dBm gönderim (44 mA), Class A iki alım penceresi,
 * yarım saniyelik MCU uyanıklığı, 2 µA uyku, saatte bir mesaj, 2400 mAh Li-SOCl2.
 * ToA yukarıdaki SF7/BW125/PL=20 fixture'ının ta kendisi.
 */
const BASE_ENERGY: LoraEnergyInput = {
  timeOnAirSeconds: 0.056576,
  transmitCurrentMilliamps: 44,
  receiveCurrentMilliamps: 11.5,
  receiveWindowSeconds: 0.15,
  activeCurrentMilliamps: 8,
  activeSeconds: 0.5,
  sleepCurrentMicroamps: 2,
  messagesPerDay: 24,
  batteryCapacityMilliampHours: 2400,
  deratingPercent: 20,
  selfDischargePercentPerYear: 1,
};

describe('calculateLoraEnergyBudget', () => {
  it('gönderim başına yükü üç pencereye ayırır ve toplar', () => {
    // Elle doğrulama: 1 mA·s = 1/3.6 µAh.
    //   TX  = 44 × 0.056576 / 3.6 = 0.691484 µAh
    //   RX  = 11.5 × 0.15    / 3.6 = 0.479167 µAh
    //   MCU = 8 × 0.5        / 3.6 = 1.111111 µAh
    const result = calculateLoraEnergyBudget(BASE_ENERGY);

    expect(result.transmitChargeMicroampHours).toBeCloseTo(0.691484, 6);
    expect(result.receiveChargeMicroampHours).toBeCloseTo(0.479167, 6);
    expect(result.activeChargeMicroampHours).toBeCloseTo(1.111111, 6);
    expect(result.chargePerMessageMicroampHours).toBeCloseTo(2.281762, 6);
  });

  it('günlük yükü üçe ayırır: gönderim, uyku, kendiliğinden boşalma', () => {
    const result = calculateLoraEnergyBudget(BASE_ENERGY);

    // Gönderim başına yük bir önceki testte 2.281762 µAh olarak elle sabitlendi;
    // burada yalnız günlük ölçeğe taşındığı sınanır (µAh → mAh, × mesaj sayısı).
    expect(result.dailyActiveChargeMilliampHours).toBeCloseTo(
      (result.chargePerMessageMicroampHours * 24) / 1000,
      12,
    );
    expect(result.dailyActiveChargeMilliampHours).toBeCloseTo(0.0547623, 7);
    // Uyku akımı sürekli akar: 2 µA × 24 h = 48 µAh = 0.048 mAh.
    expect(result.dailySleepChargeMilliampHours).toBeCloseTo(0.048, 12);
    // %1/yıl × 2400 mAh = 24 mAh/yıl, güne bölünür.
    expect(result.dailySelfDischargeMilliampHours).toBeCloseTo(24 / 365.25, 12);
    expect(result.dailyChargeMilliampHours).toBeCloseTo(
      result.dailyActiveChargeMilliampHours +
        result.dailySleepChargeMilliampHours +
        result.dailySelfDischargeMilliampHours,
      12,
    );
  });

  it('derating kullanılabilir kapasiteyi kırpar, ömrü ondan hesaplar', () => {
    const result = calculateLoraEnergyBudget(BASE_ENERGY);

    expect(result.usableCapacityMilliampHours).toBeCloseTo(1920, 9);
    if (result.batteryLifeDays === undefined) throw new Error('ömür üretilmedi');
    expect(result.batteryLifeDays).toBeCloseTo(1920 / result.dailyChargeMilliampHours, 6);
    expect(result.batteryLifeYears).toBeCloseTo(result.batteryLifeDays / 365.25, 9);
    expect(result.batteryLifeYears).toBeCloseTo(31.2, 1);
  });

  it('kendiliğinden boşalmayı sıfır bırakmak ömrü KAT KAT abartır', () => {
    // Bu düğümde gönderim yükü günlük 0.055 mAh; kendiliğinden boşalma 0.066 mAh
    // — yani DAHA BÜYÜK. Terimi atlamak 31 yılı 51 yıl gösterir.
    const withSelfDischarge = calculateLoraEnergyBudget(BASE_ENERGY);
    const without = calculateLoraEnergyBudget({
      ...BASE_ENERGY,
      selfDischargePercentPerYear: 0,
    });

    expect(withSelfDischarge.batteryLifeYears).toBeCloseTo(31.2, 1);
    expect(without.batteryLifeYears).toBeCloseTo(51.2, 1);
    expect(withSelfDischarge.dailySelfDischargeMilliampHours).toBeGreaterThan(
      withSelfDischarge.dailyActiveChargeMilliampHours,
    );
  });

  it('boşta kalan payı gönderim yükünün baskın olup olmadığını gösterir', () => {
    const lowRate = calculateLoraEnergyBudget(BASE_ENERGY);
    // Saatte bir yerine dakikada bir: gönderim yükü artık baskın.
    const highRate = calculateLoraEnergyBudget({ ...BASE_ENERGY, messagesPerDay: 1440 });

    expect(lowRate.idleSharePercent).toBeGreaterThan(50);
    expect(highRate.idleSharePercent).toBeLessThan(10);
  });

  it('ortalama akım günlük yükün 24 saate yayılmışıdır', () => {
    const result = calculateLoraEnergyBudget(BASE_ENERGY);

    expect(result.averageCurrentMicroamps).toBeCloseTo(
      (result.dailyChargeMilliampHours * 1000) / 24,
      9,
    );
  });

  it('opsiyonel terimler verilmezse motor kendiliğinden kimya varsaymaz', () => {
    const { deratingPercent: _d, selfDischargePercentPerYear: _s, ...bare } = BASE_ENERGY;
    const result = calculateLoraEnergyBudget(bare);

    expect(result.dailySelfDischargeMilliampHours).toBe(0);
    expect(result.usableCapacityMilliampHours).toBeCloseTo(2400, 9);
  });

  it('günlük tüketim sıfırsa ömür ÜRETİLMEZ (tanımsız, sonsuz değil)', () => {
    const result = calculateLoraEnergyBudget({
      ...BASE_ENERGY,
      sleepCurrentMicroamps: 0,
      messagesPerDay: 0,
      selfDischargePercentPerYear: 0,
    });

    expect(result.dailyChargeMilliampHours).toBe(0);
    expect(result.batteryLifeDays).toBeUndefined();
    expect(result.batteryLifeYears).toBeUndefined();
    expect(result.idleSharePercent).toBe(0);
  });

  it('geçersiz akım, kapasite, derating ve boşalma değerlerinde RangeError fırlatır', () => {
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, transmitCurrentMilliamps: -1 })).toThrow(RangeError);
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, messagesPerDay: -1 })).toThrow(RangeError);
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, timeOnAirSeconds: Number.NaN })).toThrow(RangeError);
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, batteryCapacityMilliampHours: 0 })).toThrow(RangeError);
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, deratingPercent: 100 })).toThrow(RangeError);
    expect(() => calculateLoraEnergyBudget({ ...BASE_ENERGY, selfDischargePercentPerYear: 101 })).toThrow(RangeError);
  });
});

describe('estimateLoraSensitivity — S = −174 + 10·log10(BW) + NF + SNR', () => {
  it('SF7/BW125/NF6 → −124.53 dBm (datasheet ölçümü −123 dBm)', () => {
    const result = estimateLoraSensitivity({ spreadingFactor: 7, bandwidthHz: 125_000 });

    expect(result.thermalNoiseDbm).toBeCloseTo(-123.0309, 4);
    expect(result.demodulatorSnrDb).toBe(-7.5);
    expect(result.sensitivityDbm).toBeCloseTo(-124.5309, 4);
  });

  it('SF12 SNR limiti −20 dB ile SF7den 12.5 dB daha duyarlıdır', () => {
    const sf7 = estimateLoraSensitivity({ spreadingFactor: 7, bandwidthHz: 125_000 });
    const sf12 = estimateLoraSensitivity({ spreadingFactor: 12, bandwidthHz: 125_000 });

    expect(sf12.demodulatorSnrDb).toBe(-20);
    expect(sf7.sensitivityDbm - sf12.sensitivityDbm).toBeCloseTo(12.5, 9);
  });

  it('bant genişliğini dörde katlamak gürültü tabanını 6.02 dB yükseltir', () => {
    const narrow = estimateLoraSensitivity({ spreadingFactor: 7, bandwidthHz: 125_000 });
    const wide = estimateLoraSensitivity({ spreadingFactor: 7, bandwidthHz: 500_000 });

    expect(wide.sensitivityDbm - narrow.sensitivityDbm).toBeCloseTo(6.0206, 4);
  });
});

describe('calculateLoraLinkBudget', () => {
  it('14 dBm / 2 dBi / 2 dBi / 0.5 dB kayıp, S=−124.53 → 142.03 dB yol kaybı bütçesi', () => {
    const result = calculateLoraLinkBudget({
      txPowerDbm: 14,
      txAntennaGainDbi: 2,
      rxAntennaGainDbi: 2,
      cableLossDb: 0.5,
      sensitivityDbm: -124.5309,
    });

    expect(result.effectiveRadiatedPowerDbm).toBeCloseTo(15.5, 9);
    expect(result.maximumPathLossDb).toBeCloseTo(142.0309, 4);
    expect(result.estimatedFreeSpaceRangeMeters).toBeUndefined();
    expect(result.measuredMarginDb).toBeUndefined();
  });

  it('frekans verilirse menzil tahmini FSPL formülüne geri beslendiğinde bütçeyi verir', () => {
    const frequencyHz = 868e6;
    const result = calculateLoraLinkBudget({
      txPowerDbm: 14,
      txAntennaGainDbi: 2,
      rxAntennaGainDbi: 2,
      cableLossDb: 0.5,
      sensitivityDbm: -124.5309,
      frequencyHz,
    });

    const range = result.estimatedFreeSpaceRangeMeters;
    if (range === undefined) throw new Error('menzil tahmini üretilmedi');

    // Ters kontrol: FSPL(d) = 20log10(d) + 20log10(f) − 147.55 tam bütçeye eşit olmalı.
    const freeSpacePathLossDb = 20 * Math.log10(range) + 20 * Math.log10(frequencyHz) - 147.55;
    expect(freeSpacePathLossDb).toBeCloseTo(result.maximumPathLossDb, 9);
    // Serbest uzay ÜST SINIRDIR — saha menzili değil, yüz kilometreler mertebesinde çıkar.
    expect(range).toBeGreaterThan(300_000);
  });

  it('bütçe negatifse menzil üretilmez', () => {
    const result = calculateLoraLinkBudget({
      txPowerDbm: -140,
      txAntennaGainDbi: 0,
      rxAntennaGainDbi: 0,
      cableLossDb: 0,
      sensitivityDbm: -124.5309,
      frequencyHz: 868e6,
    });

    expect(result.maximumPathLossDb).toBeLessThan(0);
    expect(result.estimatedFreeSpaceRangeMeters).toBeUndefined();
  });

  it('ölçülen RSSI verilirse marj duyarlılığa göre hesaplanır', () => {
    const result = calculateLoraLinkBudget({
      txPowerDbm: 14,
      txAntennaGainDbi: 2,
      rxAntennaGainDbi: 2,
      cableLossDb: 0.5,
      sensitivityDbm: -124.5309,
      measuredRssiDbm: -110,
    });

    expect(result.measuredMarginDb).toBeCloseTo(14.5309, 4);
  });

  it('geçersiz frekansta RangeError fırlatır', () => {
    expect(() =>
      calculateLoraLinkBudget({
        txPowerDbm: 14,
        txAntennaGainDbi: 2,
        rxAntennaGainDbi: 2,
        cableLossDb: 0.5,
        sensitivityDbm: -124.5309,
        frequencyHz: 0,
      }),
    ).toThrow(RangeError);
  });
});
