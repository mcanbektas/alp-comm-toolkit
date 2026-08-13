import { describe, expect, it } from 'vitest';

import {
  createCommStatisticsAccumulator,
  EMPTY_COMM_STATISTICS,
  type FrameObservation,
} from './commStatistics';

function rxFrame(overrides: Partial<FrameObservation> = {}): FrameObservation {
  return {
    direction: 'rx',
    byteLength: 12,
    timestamp: 0,
    validity: 'valid',
    ...overrides,
  };
}

describe('createCommStatisticsAccumulator', () => {
  it('hiç veri yokken sayılar sıfır, oranlar "bilinmiyor" olur', () => {
    const snapshot = createCommStatisticsAccumulator().snapshot(1000);

    expect(snapshot.totalFrames).toBe(0);
    expect(snapshot.crcErrorRatePercent).toBeUndefined();
    expect(snapshot.packetLossRatePercent).toBeUndefined();
    expect(snapshot.meanPeriodMs).toBeUndefined();
    expect(snapshot.averageFrameLength).toBeUndefined();
    expect(snapshot.busLoadPercent).toBeUndefined();
    expect(snapshot.minResponseTimeMs).toBeUndefined();
    expect(snapshot.elapsedMs).toBe(0);
  });

  it('EMPTY_COMM_STATISTICS boş biriktiricinin görüntüsüdür', () => {
    expect(EMPTY_COMM_STATISTICS.totalFrames).toBe(0);
    expect(EMPTY_COMM_STATISTICS.crcErrorRatePercent).toBeUndefined();
  });

  it('RX ve TX sayaçlarını ayrı tutar', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFrame(rxFrame({ byteLength: 10, timestamp: 0 }));
    stats.recordFrame(rxFrame({ byteLength: 20, timestamp: 10 }));
    stats.recordFrame(rxFrame({ direction: 'tx', byteLength: 8, timestamp: 20 }));

    const snapshot = stats.snapshot(30);

    expect(snapshot.totalFrames).toBe(3);
    expect(snapshot.rxFrames).toBe(2);
    expect(snapshot.txFrames).toBe(1);
    expect(snapshot.rxBytes).toBe(30);
    expect(snapshot.txBytes).toBe(8);
  });

  it('çerçeve uzunluğu min/max/ortalamasını hesaplar', () => {
    const stats = createCommStatisticsAccumulator();
    for (const byteLength of [10, 30, 20]) {
      stats.recordFrame(rxFrame({ byteLength }));
    }

    const snapshot = stats.snapshot(0);

    expect(snapshot.minFrameLength).toBe(10);
    expect(snapshot.maxFrameLength).toBe(30);
    expect(snapshot.averageFrameLength).toBe(20);
  });

  it('spec §39: CRC Error Rate = hatalı / denetlenen × 100', () => {
    const stats = createCommStatisticsAccumulator();
    for (let index = 0; index < 8; index += 1) {
      stats.recordFrame(rxFrame({ validity: 'valid' }));
    }
    stats.recordFrame(rxFrame({ validity: 'crc-error' }));
    stats.recordFrame(rxFrame({ validity: 'checksum-error' }));

    const snapshot = stats.snapshot(0);

    expect(snapshot.crcCheckedFrames).toBe(10);
    expect(snapshot.validFrames).toBe(8);
    expect(snapshot.invalidFrames).toBe(2);
    expect(snapshot.crcErrors).toBe(1);
    expect(snapshot.checksumErrors).toBe(1);
    expect(snapshot.crcErrorRatePercent).toBeCloseTo(20, 10);
  });

  it('doğrulanmamış çerçeve ne geçerli ne geçersiz sayılır ve oranı bozmaz', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFrame(rxFrame({ validity: 'unchecked' }));
    stats.recordFrame(rxFrame({ validity: 'unchecked' }));

    const snapshot = stats.snapshot(0);

    expect(snapshot.totalFrames).toBe(2);
    expect(snapshot.validFrames).toBe(0);
    expect(snapshot.invalidFrames).toBe(0);
    expect(snapshot.crcCheckedFrames).toBe(0);
    expect(snapshot.crcErrorRatePercent).toBeUndefined();
  });

  it('spec §39: Jitter_i = Period_i − Mean Period ve σ anakütle tanımıyla', () => {
    const stats = createCommStatisticsAccumulator();
    // t = 0, 10, 20, 40 → periyotlar 10, 10, 20; ortalama 40/3 = 13.3333
    for (const timestamp of [0, 10, 20, 40]) {
      stats.recordFrame(rxFrame({ timestamp }));
    }

    const snapshot = stats.snapshot(40);

    expect(snapshot.meanPeriodMs).toBeCloseTo(40 / 3, 10);
    expect(snapshot.lastJitterMs).toBeCloseTo(20 - 40 / 3, 10);
    // σ = sqrt[((10−μ)² + (10−μ)² + (20−μ)²)/3] = sqrt(200/9) ≈ 4.7140
    expect(snapshot.periodStdDevMs).toBeCloseTo(Math.sqrt(200 / 9), 10);
  });

  it('sabit periyotta σ sıfır, jitter sıfırdır', () => {
    const stats = createCommStatisticsAccumulator();
    for (let index = 0; index < 20; index += 1) {
      stats.recordFrame(rxFrame({ timestamp: index * 25 }));
    }

    const snapshot = stats.snapshot(500);

    expect(snapshot.meanPeriodMs).toBeCloseTo(25, 10);
    expect(snapshot.periodStdDevMs).toBeCloseTo(0, 10);
    expect(snapshot.lastJitterMs).toBeCloseTo(0, 10);
  });

  it('periyot yalnız RX çerçeveleri arasında ölçülür — araya giren TX bölmez', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFrame(rxFrame({ timestamp: 0 }));
    stats.recordFrame(rxFrame({ direction: 'tx', timestamp: 5 }));
    stats.recordFrame(rxFrame({ timestamp: 10 }));

    expect(stats.snapshot(10).meanPeriodMs).toBeCloseTo(10, 10);
  });

  it('spec §39: Packet Loss Rate = eksik / beklenen × 100', () => {
    const stats = createCommStatisticsAccumulator({ sequenceModulus: 256 });
    // 0, 1, 3, 4 → 2 numaralı paket eksik
    for (const sequenceNumber of [0, 1, 3, 4]) {
      stats.recordFrame(rxFrame({ sequenceNumber }));
    }

    const snapshot = stats.snapshot(0);

    expect(snapshot.sequenceErrors).toBe(1);
    expect(snapshot.missingPackets).toBe(1);
    expect(snapshot.expectedPackets).toBe(5);
    expect(snapshot.packetLossRatePercent).toBeCloseTo(20, 10);
  });

  it('sıra numarası sayacı sardığında kayıp saymaz', () => {
    const stats = createCommStatisticsAccumulator({ sequenceModulus: 256 });
    for (const sequenceNumber of [254, 255, 0, 1]) {
      stats.recordFrame(rxFrame({ sequenceNumber }));
    }

    const snapshot = stats.snapshot(0);

    expect(snapshot.sequenceErrors).toBe(0);
    expect(snapshot.missingPackets).toBe(0);
    expect(snapshot.packetLossRatePercent).toBeCloseTo(0, 10);
  });

  it('tekrar eden sıra numarası sıra hatası sayılır ama kayıp saymaz', () => {
    const stats = createCommStatisticsAccumulator({ sequenceModulus: 256 });
    for (const sequenceNumber of [7, 7]) {
      stats.recordFrame(rxFrame({ sequenceNumber }));
    }

    const snapshot = stats.snapshot(0);

    expect(snapshot.sequenceErrors).toBe(1);
    expect(snapshot.missingPackets).toBe(0);
  });

  it('sıra numarası hiç verilmezse paket kaybı "bilinmiyor" kalır', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFrame(rxFrame());

    expect(stats.snapshot(0).packetLossRatePercent).toBeUndefined();
  });

  it('bus load = aktarılan bit / (baud × geçen süre) × 100', () => {
    const stats = createCommStatisticsAccumulator({ link: { baudRate: 115200, bitsPerByte: 10 } });
    // 1 saniye içinde 1000 bayt → 10 000 bit
    stats.recordFrame(rxFrame({ byteLength: 1000, timestamp: 0 }));

    const snapshot = stats.snapshot(1000);

    expect(snapshot.busLoadPercent).toBeCloseTo((10_000 / 115_200) * 100, 10);
  });

  it('setLink ile hat ayarı sonradan verilebilir', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFrame(rxFrame({ byteLength: 1000, timestamp: 0 }));
    expect(stats.snapshot(1000).busLoadPercent).toBeUndefined();

    stats.setLink({ baudRate: 9600, bitsPerByte: 10 });

    expect(stats.snapshot(1000).busLoadPercent).toBeCloseTo((10_000 / 9600) * 100, 10);
  });

  it('çerçeveleme hatalarını koda göre ayrıştırır', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFramingError('no-sync');
    stats.recordFramingError('no-sync');
    stats.recordFramingError('invalid-length');

    const snapshot = stats.snapshot(0);

    expect(snapshot.framingErrors).toBe(3);
    expect(snapshot.framingErrorsByCode).toEqual({ 'no-sync': 2, 'invalid-length': 1 });
  });

  it('görüntü, biriktiricinin sonraki değişikliklerinden etkilenmez', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordFramingError('no-sync');
    const snapshot = stats.snapshot(0);

    stats.recordFramingError('no-sync');

    expect(snapshot.framingErrorsByCode).toEqual({ 'no-sync': 1 });
  });

  it('zaman aşımı ve yanıt süresi metriklerini toplar', () => {
    const stats = createCommStatisticsAccumulator();
    stats.recordTimeout();
    stats.recordTimeout();
    stats.recordResponseTime(12);
    stats.recordResponseTime(4);
    stats.recordResponseTime(20);
    stats.recordResponseTime(-5);

    const snapshot = stats.snapshot(0);

    expect(snapshot.timeoutErrors).toBe(2);
    expect(snapshot.minResponseTimeMs).toBe(4);
    expect(snapshot.maxResponseTimeMs).toBe(20);
    expect(snapshot.averageResponseTimeMs).toBeCloseTo(12, 10);
  });

  it('ortalama paket hızı geçen süreye bölünür', () => {
    const stats = createCommStatisticsAccumulator();
    for (let index = 0; index < 100; index += 1) {
      stats.recordFrame(rxFrame({ timestamp: index * 10 }));
    }

    // İlk çerçeve t=0, görüntü t=1000 → 100 çerçeve / 1 s
    expect(stats.snapshot(1000).averagePacketRate).toBeCloseTo(100, 6);
  });

  it('reset() bütün sayaçları ve hızları sıfırlar', () => {
    const stats = createCommStatisticsAccumulator({ link: { baudRate: 9600, bitsPerByte: 10 } });
    for (let index = 0; index < 10; index += 1) {
      stats.recordFrame(rxFrame({ timestamp: index * 10, sequenceNumber: index }));
    }
    stats.recordFramingError('no-sync');
    stats.recordTimeout();
    stats.recordResponseTime(5);

    stats.reset();
    const snapshot = stats.snapshot(1000);

    expect(snapshot.totalFrames).toBe(0);
    expect(snapshot.framingErrors).toBe(0);
    expect(snapshot.framingErrorsByCode).toEqual({});
    expect(snapshot.timeoutErrors).toBe(0);
    expect(snapshot.packetRate).toBe(0);
    expect(snapshot.byteRate).toBe(0);
    expect(snapshot.maxResponseTimeMs).toBeUndefined();
    expect(snapshot.meanPeriodMs).toBeUndefined();
  });

  it('anlık paket hızı kayan pencereden okunur ve akış durunca düşer', () => {
    const stats = createCommStatisticsAccumulator({ rateWindowMs: 1000 });
    for (let index = 0; index < 50; index += 1) {
      stats.recordFrame(rxFrame({ byteLength: 10, timestamp: index * 20 }));
    }

    // Son çerçeve t=980; t=999'da 10 kovanın hepsi hâlâ pencerede → 50 çerçeve/s.
    expect(stats.snapshot(999).packetRate).toBeCloseTo(50, 6);
    expect(stats.snapshot(999).byteRate).toBeCloseTo(500, 6);

    // Kova çözünürlüğü 100 ms: t=1000'de ilk kova (t=0..99, 5 çerçeve) yaşlanıp
    // düşer. Bu kayan pencerenin tanımı gereğidir, yuvarlama hatası değil.
    expect(stats.snapshot(1000).packetRate).toBeCloseTo(45, 6);

    // Akış durdu: pencere boşalınca hız sıfırlanmalı, ömür ortalaması ise kalmalı.
    const later = stats.snapshot(5000);
    expect(later.packetRate).toBe(0);
    expect(later.byteRate).toBe(0);
    expect(later.averagePacketRate).toBeGreaterThan(0);
  });
});
