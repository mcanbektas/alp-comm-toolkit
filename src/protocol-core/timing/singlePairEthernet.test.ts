import { describe, expect, it } from 'vitest';

import {
  calculatePlcaBurst,
  calculatePlcaCycle,
  calculateSpeFrameTime,
  PLCA_REGISTER_DEFAULTS,
  SPE_BIT_RATES,
  speBitTime,
} from './singlePairEthernet';

describe('SPE PHY sınıfları', () => {
  it('veri hızları PHY adının kendisinden gelir', () => {
    expect(SPE_BIT_RATES['10base-t1s']).toBe(10e6);
    expect(SPE_BIT_RATES['10base-t1l']).toBe(10e6);
    expect(SPE_BIT_RATES['100base-t1']).toBe(100e6);
    expect(SPE_BIT_RATES['1000base-t1']).toBe(1000e6);
  });

  it('bit süresi hızın tersidir', () => {
    expect(speBitTime('10base-t1s')).toBeCloseTo(100e-9, 12);
    expect(speBitTime('1000base-t1')).toBeCloseTo(1e-9, 12);
  });

  it('çerçeve süresi bayt × 8 × bit süresidir', () => {
    // 10 Mbit/s'te 64 baytlık asgari Ethernet çerçevesi = 512 bit = 51.2 µs.
    const result = calculateSpeFrameTime({ phy: '10base-t1s', frameBytes: 64 });
    expect(result.frameBitTimes).toBe(512);
    expect(result.frameSeconds).toBeCloseTo(51.2e-6, 12);
    expect(result.totalSeconds).toBe(result.frameSeconds);
  });

  it('IFG verilirse toplama eklenir, verilmezse eklenmez', () => {
    const withGap = calculateSpeFrameTime({ phy: '10base-t1s', frameBytes: 64, interFrameGapBitTimes: 96 });
    expect(withGap.totalSeconds).toBeCloseTo((512 + 96) * 100e-9, 12);
  });

  it('negatif girdi reddedilir', () => {
    expect(() => calculateSpeFrameTime({ phy: '10base-t1s', frameBytes: -1 })).toThrow(RangeError);
  });
});

describe('PLCA çevrim bütçesi', () => {
  it('OPEN Alliance register varsayılanları belgelenmiştir', () => {
    // 10BASE-T1S PLCA Management Registers v1.2: TOTMR.TOT = 32,
    // BURST.MAXBC = 0 (kapalı), BURST.BTMR = 128.
    expect(PLCA_REGISTER_DEFAULTS.toTimerBitTimes).toBe(32);
    expect(PLCA_REGISTER_DEFAULTS.maxBurstCount).toBe(0);
    expect(PLCA_REGISTER_DEFAULTS.burstTimerBitTimes).toBe(128);
  });

  it('herkesin sustuğu çevrim yalnız to_timer pencerelerinden oluşur', () => {
    const result = calculatePlcaCycle({
      phy: '10base-t1s',
      nodeCount: 8,
      transmittingNodes: 0,
      frameBytes: 0,
      toTimerBitTimes: 32,
    });

    expect(result.idleBitTimes).toBe(8 * 32);
    expect(result.transmitBitTimes).toBe(0);
    expect(result.cycleBitTimes).toBe(256);
    // 10 Mbit/s'te 256 bit = 25.6 µs.
    expect(result.cycleSeconds).toBeCloseTo(25.6e-6, 12);
    expect(result.efficiencyPercent).toBe(0);
  });

  it('gönderen node çerçevesi kadar, susan node to_timer kadar yer kaplar', () => {
    const result = calculatePlcaCycle({
      phy: '10base-t1s',
      nodeCount: 8,
      transmittingNodes: 2,
      frameBytes: 64,
      toTimerBitTimes: 32,
    });

    expect(result.idleBitTimes).toBe(6 * 32);
    expect(result.transmitBitTimes).toBe(2 * 512);
    expect(result.cycleBitTimes).toBe(192 + 1024);
    expect(result.cycleSeconds).toBeCloseTo(121.6e-6, 12);
    // En kötü erişim gecikmesi çevrimin kendisidir (sıra bir tur sonra döner).
    expect(result.worstCaseAccessSeconds).toBe(result.cycleSeconds);
    expect(result.efficiencyPercent).toBeCloseTo((1024 / 1216) * 100, 6);
  });

  it('BEACON verilmezse çevrime eklenmez ve bu işaretlenir', () => {
    const without = calculatePlcaCycle({
      phy: '10base-t1s',
      nodeCount: 4,
      transmittingNodes: 0,
      frameBytes: 0,
      toTimerBitTimes: 32,
    });
    const withBeacon = calculatePlcaCycle({
      phy: '10base-t1s',
      nodeCount: 4,
      transmittingNodes: 0,
      frameBytes: 0,
      toTimerBitTimes: 32,
      beaconBitTimes: 20,
    });

    expect(without.beaconOmitted).toBe(true);
    expect(without.beaconBitTimes).toBe(0);
    expect(withBeacon.beaconOmitted).toBe(false);
    expect(withBeacon.cycleBitTimes).toBe(without.cycleBitTimes + 20);
  });

  it('gönderen sayısı node sayısını aşamaz', () => {
    expect(() =>
      calculatePlcaCycle({
        phy: '10base-t1s',
        nodeCount: 4,
        transmittingNodes: 5,
        frameBytes: 64,
        toTimerBitTimes: 32,
      }),
    ).toThrow(RangeError);
  });

  it('to_timer pozitif olmalı', () => {
    expect(() =>
      calculatePlcaCycle({
        phy: '10base-t1s',
        nodeCount: 4,
        transmittingNodes: 1,
        frameBytes: 64,
        toTimerBitTimes: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe('PLCA burst modu', () => {
  it('MAXBC 0 varsayılanı burst kapalı demektir — pencere tek pakettir', () => {
    const result = calculatePlcaBurst({
      phy: '10base-t1s',
      maxBurstCount: 0,
      burstTimerBitTimes: 128,
      frameBytes: 64,
    });

    expect(result.enabled).toBe(false);
    expect(result.packetsPerOpportunity).toBe(1);
    expect(result.opportunityBitTimes).toBe(512);
  });

  it('MAXBC paketleri ekler, aralarına burst_timer girer', () => {
    const result = calculatePlcaBurst({
      phy: '10base-t1s',
      maxBurstCount: 2,
      burstTimerBitTimes: 128,
      frameBytes: 64,
    });

    expect(result.enabled).toBe(true);
    expect(result.packetsPerOpportunity).toBe(3);
    expect(result.opportunityBitTimes).toBe(3 * 512 + 2 * 128);
    expect(result.opportunitySeconds).toBeCloseTo((1536 + 256) * 100e-9, 12);
  });

  it('negatif MAXBC reddedilir', () => {
    expect(() =>
      calculatePlcaBurst({ phy: '10base-t1s', maxBurstCount: -1, burstTimerBitTimes: 128, frameBytes: 64 }),
    ).toThrow(RangeError);
  });
});
