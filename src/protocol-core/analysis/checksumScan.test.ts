import { describe, expect, it } from 'vitest';

import { scanChecksumFields } from './checksumScan';
import { computeNamedCrc } from '../checksums/crcCatalogue';
import type { AnalysisFrame } from './types';

/**
 * Fixture kuralı: spec §43'ün DOĞRULANMIŞ Modbus RTU çerçevesi
 * `01 03 00 00 00 02 C4 0B` esas alındı (CRC16_MODBUS, telde küçük uçlu).
 * Aynı biçimde iki çerçeve daha gerekiyor ve onların CRC'si `computeNamedCrc`
 * ile ÜRETİLİYOR — burada sınanan şey CRC motoru değil TARAYICI: motorun kendi
 * doğrulanmış fixture'ları `crcCatalogue.test.ts`te. Üretim kuralı testin
 * içinde görünür olsun diye fonksiyon burada duruyor.
 */
function modbusFrame(payload: readonly number[]): AnalysisFrame {
  const data = new Uint8Array(payload);
  const crc = Number(computeNamedCrc(data, 'CRC16_MODBUS'));
  const bytes = new Uint8Array(data.length + 2);
  bytes.set(data, 0);
  // Modbus CRC'yi düşük bayt önce yazar.
  bytes[data.length] = crc & 0xff;
  bytes[data.length + 1] = (crc >>> 8) & 0xff;
  return { bytes, timestamp: undefined };
}

const MODBUS_FRAMES: readonly AnalysisFrame[] = [
  modbusFrame([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]),
  modbusFrame([0x01, 0x03, 0x00, 0x01, 0x00, 0x02]),
  modbusFrame([0x02, 0x03, 0x00, 0x00, 0x00, 0x04]),
];

describe('scanChecksumFields', () => {
  it('spec Modbus çerçevesini fixture olarak doğrular', () => {
    expect(Array.from(MODBUS_FRAMES[0]?.bytes ?? [])).toEqual([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]);
  });

  it('son iki baytı CRC16_MODBUS olarak %100 oranla bulur', () => {
    const candidates = scanChecksumFields(MODBUS_FRAMES);
    const best = candidates[0];
    expect(best?.algorithmId).toBe('CRC16_MODBUS');
    expect(best?.checksumWidth).toBe(2);
    expect(best?.dataStart).toBe(0);
    expect(best?.matchRatePercent).toBe(100);
    expect(best?.matchedFrames).toBe(3);
  });

  it('telde ters yazılmış bayt sırasını raporlar', () => {
    const best = scanChecksumFields(MODBUS_FRAMES)[0];
    // Modbus CRC'yi düşük bayt önce yazar; finder bunu "swapped" diye bildirir.
    expect(best?.byteOrder).toBe('swapped');
  });

  it('checksum taşımayan kümede aday üretmez', () => {
    const frames: readonly AnalysisFrame[] = [
      { bytes: new Uint8Array([1, 2, 3, 4, 5]), timestamp: undefined },
      { bytes: new Uint8Array([2, 3, 4, 5, 6]), timestamp: undefined },
      { bytes: new Uint8Array([3, 4, 5, 6, 7]), timestamp: undefined },
    ];
    expect(scanChecksumFields(frames, { minMatchRatePercent: 100 })).toEqual([]);
  });

  it('tek çerçevede tesadüfi eşleşmeyi %100 gibi gösterir — oran bu yüzden çerçeve sayısıyla okunur', () => {
    const single = scanChecksumFields([MODBUS_FRAMES[0] as AnalysisFrame]);
    expect(single[0]?.testedFrames).toBe(1);
    expect(single[0]?.matchRatePercent).toBe(100);
  });

  it('başlık atlayan yorumu da dener ama tam kapsayanı öne alır', () => {
    const candidates = scanChecksumFields(MODBUS_FRAMES);
    expect(candidates[0]?.dataStart).toBe(0);
  });

  it('örneklem sınırını uygular', () => {
    const candidates = scanChecksumFields(MODBUS_FRAMES, { sampleSize: 2 });
    expect(candidates[0]?.testedFrames).toBe(2);
  });

  it('boş kümede boş döner', () => {
    expect(scanChecksumFields([])).toEqual([]);
  });

  it('checksum için yer kalmayan kısa çerçeveleri denemez', () => {
    const frames: readonly AnalysisFrame[] = [{ bytes: new Uint8Array([0xaa]), timestamp: undefined }];
    expect(scanChecksumFields(frames, { widths: [4] })).toEqual([]);
  });

  it('iptal edildiğinde o ana kadarki adaylarla döner', () => {
    let calls = 0;
    const candidates = scanChecksumFields(MODBUS_FRAMES, {
      // İlk kombinasyon (width 1) bittikten hemen sonra iptal.
      shouldCancel: () => {
        calls += 1;
        return calls > 4;
      },
    });
    expect(calls).toBeGreaterThan(0);
    // Erken kesildiği için 2 baytlık CRC16 kombinasyonuna hiç sıra gelmez.
    expect(candidates.some((candidate) => candidate.algorithmId === 'CRC16_MODBUS')).toBe(false);
  });

  it('ilerlemeyi kombinasyon başına bildirir', () => {
    const seen: Array<[number, number]> = [];
    scanChecksumFields(MODBUS_FRAMES, {
      widths: [2],
      maxDataStart: 2,
      onProgress: (completed, total) => seen.push([completed, total]),
    });
    // 1 genişlik × 1 trailing × (0..2) dataStart = 3 kombinasyon.
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('sonda sınırını geçemeyen kombinasyonda kalan çerçeveleri denemez', () => {
    // Sonda çıktıda görünmez (elenen kombinasyon zaten aday üretmezdi), o yüzden
    // ölçüm ERİŞİM sayısıyla yapılır: her çerçevenin baytları kaç kez okundu.
    function countingFrames(): { frames: AnalysisFrame[]; reads: () => number } {
      let reads = 0;
      const frames = Array.from({ length: 40 }, (_, index) => {
        const bytes = new Uint8Array([0xaa, index & 0xff, (index * 7) & 0xff, 0x5a, 0x33]);
        return {
          get bytes(): Uint8Array {
            reads += 1;
            return bytes;
          },
          timestamp: undefined,
        } as AnalysisFrame;
      });
      return { frames, reads: () => reads };
    }

    const probed = countingFrames();
    scanChecksumFields(probed.frames, { probeFrames: 4, minMatchRatePercent: 100 });
    const full = countingFrames();
    scanChecksumFields(full.frames, { probeFrames: 0, minMatchRatePercent: 100 });

    expect(probed.reads()).toBeLessThan(full.reads());
  });

  it('sonda gerçek checksum adayını elemez', () => {
    const many = Array.from({ length: 20 }, (_, index) => modbusFrame([0x01, 0x03, 0x00, index & 0xff, 0x00, 0x02]));
    const best = scanChecksumFields(many, { probeFrames: 4 })[0];
    expect(best?.algorithmId).toBe('CRC16_MODBUS');
    expect(best?.matchRatePercent).toBe(100);
    expect(best?.testedFrames).toBe(20);
  });
});
