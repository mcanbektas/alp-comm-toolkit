import { describe, expect, it } from 'vitest';

import {
  formatNmeaChecksum,
  nmeaXorChecksum,
  parseNmeaSentence,
  verifyNmeaChecksum,
} from './nmeaChecksum';

const GPGGA_SENTENCE =
  '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
const GPGGA_PAYLOAD =
  'GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,';

describe('nmeaXorChecksum', () => {
  it('bilinen gerçek örnekte 0x47 üretir', () => {
    expect(nmeaXorChecksum(GPGGA_PAYLOAD)).toBe(0x47);
  });

  it('ayraç virgülleri de XOR hesabına dahildir', () => {
    // Küçük, elle izlenebilir bir örnek: 'A,B' = 0x41 ^ 0x2C ^ 0x42 = 0x2F,
    // virgülsüz 'AB' = 0x41 ^ 0x42 = 0x03 — ikisi FARKLI, virgül gerçekten
    // hesaba katılıyor. (Gerçek GPGGA cümlesinde bu farkı göstermek yanıltıcı
    // olurdu: içindeki 14 virgül ÇİFT sayıda olduğu için XOR'da birbirini
    // götürüyor ve virgülleri silmek tesadüfen aynı sonucu veriyor.)
    expect(nmeaXorChecksum('A,B')).toBe(0x2f);
    expect(nmeaXorChecksum('AB')).toBe(0x03);
    expect(nmeaXorChecksum('A,B')).not.toBe(nmeaXorChecksum('AB'));
  });
});

describe('formatNmeaChecksum', () => {
  it('2 haneli büyük harf hex üretir, tek haneli değerde 0 ile doldurur', () => {
    expect(formatNmeaChecksum(0x47)).toBe('47');
    expect(formatNmeaChecksum(0x07)).toBe('07');
    expect(formatNmeaChecksum(0xab)).toBe('AB');
  });
});

describe('parseNmeaSentence', () => {
  it('$ ve * arasındaki payload ile checksum hanesini ayırır', () => {
    expect(parseNmeaSentence(GPGGA_SENTENCE)).toEqual({
      payload: GPGGA_PAYLOAD,
      checksumHex: '47',
    });
  });

  it('CR/LF ile biten cümlede checksum hanesini kırpar', () => {
    expect(parseNmeaSentence(`${GPGGA_SENTENCE}\r\n`)?.checksumHex).toBe('47');
  });

  it('$ ile başlamayan girdide undefined döner', () => {
    expect(parseNmeaSentence('GPGGA,123519*47')).toBeUndefined();
  });

  it('* içermeyen girdide undefined döner', () => {
    expect(parseNmeaSentence('$GPGGA,123519')).toBeUndefined();
  });
});

describe('verifyNmeaChecksum', () => {
  it('bilinen gerçek GPGGA cümlesini doğrular', () => {
    expect(verifyNmeaChecksum(GPGGA_SENTENCE)).toBe(true);
  });

  it("bozuk checksum'lı cümlede false döner", () => {
    const corrupted = GPGGA_SENTENCE.replace('*47', '*00');
    expect(verifyNmeaChecksum(corrupted)).toBe(false);
  });

  it('formatsız (\\$ veya * eksik) cümlede false döner', () => {
    expect(verifyNmeaChecksum('GPGGA,123519*47')).toBe(false);
  });
});
