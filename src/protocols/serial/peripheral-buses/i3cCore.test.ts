import { describe, expect, it } from 'vitest';

import {
  I3C_BROADCAST_ADDRESS,
  I3C_CCC_CODES,
  I3C_CCC_DIRECT_BIT,
  decodeBcr,
  decodeDcr,
  decodeEventMask,
  decodePid,
  decodeStatus,
  i3cAddress7Bit,
  i3cIsBroadcastAddress,
  i3cIsReadAddress,
  lookupCcc,
} from './i3cCore';

/**
 * Bu tablo `include/linux/i3c/ccc.h`ten birebir kopyalandı; motordan
 * TÜRETİLMEDİ, motoru SINIYOR. Bir kod kayarsa burası kırılır.
 */
describe('I3C CCC kod uzayı — Linux ccc.h', () => {
  const BROADCAST: readonly [number, string][] = [
    [0x00, 'ENEC'],
    [0x01, 'DISEC'],
    [0x02, 'ENTAS0'],
    [0x03, 'ENTAS1'],
    [0x04, 'ENTAS2'],
    [0x05, 'ENTAS3'],
    [0x06, 'RSTDAA'],
    [0x07, 'ENTDAA'],
    [0x08, 'DEFSLVS'],
    [0x09, 'SETMWL'],
    [0x0a, 'SETMRL'],
    [0x0b, 'ENTTM'],
    [0x20, 'ENTHDR0'],
    [0x27, 'ENTHDR7'],
    [0x28, 'SETXTIME'],
  ];

  const DIRECT: readonly [number, string][] = [
    [0x80, 'ENEC'],
    [0x81, 'DISEC'],
    [0x86, 'RSTDAA'],
    [0x87, 'SETDASA'],
    [0x88, 'SETNEWDA'],
    [0x89, 'SETMWL'],
    [0x8a, 'SETMRL'],
    [0x8b, 'GETMWL'],
    [0x8c, 'GETMRL'],
    [0x8d, 'GETPID'],
    [0x8e, 'GETBCR'],
    [0x8f, 'GETDCR'],
    [0x90, 'GETSTATUS'],
    [0x91, 'GETACCMST'],
    [0x93, 'SETBRGTGT'],
    [0x94, 'GETMXDS'],
    [0x95, 'GETHDRCAP'],
    [0x98, 'SETXTIME'],
    [0x99, 'GETXTIME'],
  ];

  it.each(BROADCAST)('broadcast %s → %s', (code, name) => {
    const info = I3C_CCC_CODES.get(code);
    expect(info?.name).toBe(name);
    expect(info?.kind).toBe('broadcast');
  });

  it.each(DIRECT)('direct %s → %s', (code, name) => {
    const info = I3C_CCC_CODES.get(code);
    expect(info?.name).toBe(name);
    expect(info?.kind).toBe('direct');
  });

  it('SETXTIME deseni BOZAR — 0x28 | 0x80 direct formu DEĞİL', () => {
    expect(I3C_CCC_CODES.get(0x28)?.name).toBe('SETXTIME');
    expect(I3C_CCC_CODES.get(0x98)?.name).toBe('SETXTIME');
    // Desen izlenseydi direct form 0xA8 olurdu; öyle bir komut YOK.
    expect(I3C_CCC_CODES.has(0x28 | I3C_CCC_DIRECT_BIT)).toBe(false);
  });

  it('bit 7 Direct/Broadcast ayrımıdır — tablodaki her girdi buna uyar', () => {
    for (const [code, info] of I3C_CCC_CODES) {
      const expected = (code & I3C_CCC_DIRECT_BIT) !== 0 ? 'direct' : 'broadcast';
      expect(info.kind, `kod ${String(code)}`).toBe(expected);
    }
  });
});

describe('lookupCcc — satıcı aralığı ve bilinmeyen kod', () => {
  it('0x61 broadcast satıcı aralığının başıdır', () => {
    const result = lookupCcc(0x61);
    expect(result.vendorDefined).toBe(true);
    expect(result.kind).toBe('broadcast');
    expect(result.name).toBe('Vendor Broadcast #0');
  });

  it('0xE0 direct satıcı aralığının başıdır', () => {
    const result = lookupCcc(0xe5);
    expect(result.vendorDefined).toBe(true);
    expect(result.kind).toBe('direct');
    expect(result.name).toBe('Vendor Direct #5');
  });

  it('ne tabloda ne satıcı aralığında olan kod UYDURULMAZ', () => {
    const result = lookupCcc(0x40);
    expect(result.unknown).toBe(true);
    expect(result.vendorDefined).toBe(false);
    expect(result.name).toBe('Unknown CCC');
  });
});

describe('decodeEventMask — ccc.h I3C_CCC_EVENT_*', () => {
  it('SIR bit0, MR bit1, HJ bit3', () => {
    expect(decodeEventMask(0x01)).toEqual(['SIR (Slave Interrupt Request)']);
    expect(decodeEventMask(0x02)).toEqual(['MR (Master Request)']);
    expect(decodeEventMask(0x08)).toEqual(['HJ (Hot-Join)']);
    expect(decodeEventMask(0x0b)).toHaveLength(3);
  });

  it('bit 2 ADLANDIRILMAZ — başlıkta karşılığı yok', () => {
    expect(decodeEventMask(0x04)).toEqual([]);
  });
});

describe('decodeBcr — device.h I3C_BCR_*', () => {
  it('bit 7-6 rol: 00 Target, 01 Controller-capable', () => {
    expect(decodeBcr(0x00).role).toBe('Target');
    expect(decodeBcr(0x40).role).toBe('Controller-capable');
    // 10 ve 11 başlıkta adlandırılmamış — uydurulmaz.
    expect(decodeBcr(0x80).role).toBe('Reserved');
    expect(decodeBcr(0xc0).role).toBe('Reserved');
  });

  it('her yetenek biti kendi bayrağına düşer', () => {
    expect(decodeBcr(0x20).hdrCapable).toBe(true);
    expect(decodeBcr(0x10).bridge).toBe(true);
    expect(decodeBcr(0x08).offlineCapable).toBe(true);
    expect(decodeBcr(0x04).ibiPayload).toBe(true);
    expect(decodeBcr(0x02).ibiRequestCapable).toBe(true);
    expect(decodeBcr(0x01).maxDataSpeedLimited).toBe(true);
  });
});

describe('decodeDcr — yalnız TEK değer adlandırılmış', () => {
  it('0x00 Generic Device', () => {
    expect(decodeDcr(0x00)).toBe('Generic Device');
  });

  it('öteki değerlere sınıf adı UYDURULMAZ', () => {
    expect(decodeDcr(0x2a)).toBeUndefined();
    expect(decodeDcr(0xff)).toBeUndefined();
  });
});

describe('decodePid — device.h I3C_PID_* bit alanları', () => {
  it('rastgele bit KURULU DEĞİLKEN part/instance/extra çözülür', () => {
    // Manufacturer 0x1A2 (15 bit), rnd=0, part 0xBEEF, instance 0x3, extra 0x123.
    const raw = (0x1a2n << 33n) | (0xbeefn << 16n) | (0x3n << 12n) | 0x123n;
    const bytes = new Uint8Array(6);
    for (let index = 0; index < 6; index += 1) {
      bytes[index] = Number((raw >> BigInt((5 - index) * 8)) & 0xffn);
    }

    const decoded = decodePid(bytes);
    expect(decoded.manufacturerId).toBe(0x1a2);
    expect(decoded.randomLower32).toBe(false);
    expect(decoded.partId).toBe(0xbeef);
    expect(decoded.instanceId).toBe(0x3);
    expect(decoded.extraInfo).toBe(0x123);
  });

  it('rastgele bit KURULUYKEN part/instance BASILMAZ — o bitler kimlik değil', () => {
    const raw = (0x1a2n << 33n) | (1n << 32n) | 0xdeadbeefn;
    const bytes = new Uint8Array(6);
    for (let index = 0; index < 6; index += 1) {
      bytes[index] = Number((raw >> BigInt((5 - index) * 8)) & 0xffn);
    }

    const decoded = decodePid(bytes);
    expect(decoded.randomLower32).toBe(true);
    expect(decoded.partId).toBeUndefined();
    expect(decoded.instanceId).toBeUndefined();
    expect(decoded.extraInfo).toBeUndefined();
    expect(decoded.randomValue).toBe(0xdeadbeef);
  });

  it('PID big endian okunur (ccc.h: "48 bits PID in big endian")', () => {
    const decoded = decodePid(Uint8Array.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]));
    expect(decoded.raw).toBe(0x123456789abcn);
  });
});

describe('decodeStatus — ccc.h I3C_CCC_STATUS_*', () => {
  it('bit 3-0 bekleyen kesme, bit 5 protokol hatası, bit 7-6 etkinlik modu', () => {
    expect(decodeStatus(0x0005).pendingInterrupt).toBe(5);
    expect(decodeStatus(0x0020).protocolError).toBe(true);
    expect(decodeStatus(0x0000).protocolError).toBe(false);
    expect(decodeStatus(0x00c0).activityMode).toBe(3);
  });
});

describe('adres baytı', () => {
  it('0x7E ayrılmış broadcast adresidir', () => {
    expect(I3C_BROADCAST_ADDRESS).toBe(0x7e);
    expect(i3cIsBroadcastAddress(0xfc)).toBe(true);
    expect(i3cIsBroadcastAddress(0xfd)).toBe(true);
    expect(i3cIsBroadcastAddress(0x10)).toBe(false);
  });

  it('7-bit adres üstte, R/W altta', () => {
    expect(i3cAddress7Bit(0x10)).toBe(0x08);
    expect(i3cIsReadAddress(0x10)).toBe(false);
    expect(i3cIsReadAddress(0x11)).toBe(true);
  });
});
