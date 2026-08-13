import { describe, expect, it } from 'vitest';

import { lrcChecksum } from './lrc';
import { twosComplementChecksum } from './simpleChecksums';

describe('lrcChecksum', () => {
  it('Modbus resmi örneğinde 0x7E üretir (elle toplam: 0x82, tümleyen: 0x7E)', () => {
    // Adres 0x11, fonksiyon 0x03, start-hi 0x00, start-lo 0x6B, count-hi 0x00, count-lo 0x03.
    const bytes = Uint8Array.of(0x11, 0x03, 0x00, 0x6b, 0x00, 0x03);
    expect(lrcChecksum(bytes)).toBe(0x7e);
  });

  it('twosComplementChecksum ile aynı formülü paylaşır (birebir aynı sonuç)', () => {
    const bytes = Uint8Array.of(0x01, 0x02, 0x03, 0x04);
    expect(lrcChecksum(bytes)).toBe(twosComplementChecksum(bytes));
  });

  it('round-trip: veri + LRC baytının SUM-8 toplamı 0 çıkar (alıcı doğrulaması budur)', () => {
    const data = Uint8Array.of(0x11, 0x03, 0x00, 0x6b, 0x00, 0x03);
    const lrc = lrcChecksum(data);
    const combined = Uint8Array.of(...data, lrc);
    const sum = combined.reduce((total, byte) => total + byte, 0) % 256;

    expect(sum).toBe(0);
  });
});
