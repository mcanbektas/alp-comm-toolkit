import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';
import { ACK, CAN, EOT, NAK, SOH, STX, encodeXmodemBlock, parseXmodemFrame } from './xmodemCore';

function repeatingPayload(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_unused, index) => index % 256);
}

describe('parseXmodemFrame — kontrol baytları', () => {
  it('boş girdide "empty" döner', () => {
    const result = parseXmodemFrame(new Uint8Array(0));
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('empty');
  });

  it('tanınmayan tek bayt "unknown-header" döner', () => {
    const result = parseXmodemFrame(Uint8Array.from([0x99]));
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('unknown-header');
  });

  const controlBytes: Array<[number, string]> = [
    [EOT, 'EOT (End Of Transmission)'],
    [ACK, 'ACK (Acknowledge)'],
    [NAK, 'NAK (Negative Acknowledge)'],
    [CAN, 'CAN (Cancel)'],
  ];
  it.each(controlBytes)('kontrol baytı 0x%s doğru adlanır', (byte, name) => {
    const result = parseXmodemFrame(Uint8Array.from([byte]));
    if (!result.ok || result.frame.kind !== 'control') throw new Error('expected control frame');
    expect(result.frame.name).toBe(name);
    expect(result.frame.byte).toBe(byte);
  });
});

describe('parseXmodemFrame — blok çerçevesi', () => {
  it('SOH: 128 baytlık blok, checksum modu (trailer 1 bayt) uzunluktan algılanır', () => {
    const payload = repeatingPayload(128);
    const expectedChecksum = sum8Checksum(payload);
    const wire = Uint8Array.from([SOH, 0x01, 0xfe, ...payload, expectedChecksum]);

    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.dataLength).toBe(128);
    expect(result.frame.mode).toBe('checksum');
    expect(result.frame.block).toBe(1);
    expect(result.frame.complementValid).toBe(true);
    expect(result.frame.received).toBe(expectedChecksum);
    expect(result.frame.calculated).toBe(expectedChecksum);
    expect(result.frame.integrityValid).toBe(true);
  });

  it('STX: 1024 baytlık blok, CRC modu (trailer 2 bayt) uzunluktan algılanır, büyük-uçlu okunur', () => {
    const payload = repeatingPayload(1024);
    const crcValue = Number(computeNamedCrc(payload, 'CRC16_XMODEM'));
    const wire = Uint8Array.from([STX, 0x02, 0xfd, ...payload, (crcValue >> 8) & 0xff, crcValue & 0xff]);

    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.dataLength).toBe(1024);
    expect(result.frame.mode).toBe('crc');
    expect(result.frame.received).toBe(crcValue);
    expect(result.frame.calculated).toBe(crcValue);
    expect(result.frame.integrityValid).toBe(true);
  });

  it('blok tümleyeni uyuşmazsa complementValid=false, checksum bağımsız hâlâ hesaplanır', () => {
    const payload = repeatingPayload(128);
    const checksum = sum8Checksum(payload);
    const wire = Uint8Array.from([SOH, 0x01, 0x00 /* yanlış tümleyen */, ...payload, checksum]);

    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.complementValid).toBe(false);
    expect(result.frame.integrityValid).toBe(true);
  });

  it('bozuk checksum integrityValid=false, calculated değişmez', () => {
    const payload = repeatingPayload(128);
    const correctChecksum = sum8Checksum(payload);
    const wire = Uint8Array.from([SOH, 0x01, 0xfe, ...payload, (correctChecksum + 1) % 256]);

    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.integrityValid).toBe(false);
    expect(result.frame.calculated).toBe(correctChecksum);
  });

  it('trailer uzunluğu ne 1 ne 2 baytsa "bad-trailer-length" döner', () => {
    const payload = repeatingPayload(128);
    const wire = Uint8Array.from([SOH, 0x01, 0xfe, ...payload, 0x00, 0x00, 0x00]); // 3 fazla bayt
    const result = parseXmodemFrame(wire);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('bad-trailer-length');
  });

  it('tanınmayan header baytı (SOH/STX değil, uzunluk>1) "unknown-header" döner', () => {
    const result = parseXmodemFrame(Uint8Array.from([0x99, 0x01, 0xfe, 0x00]));
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('unknown-header');
  });
});

describe('encodeXmodemBlock — round-trip', () => {
  it('checksum modu round-trip: parseXmodemFrame(encodeXmodemBlock(...)) integrityValid=true', () => {
    const payload = repeatingPayload(128);
    const wire = encodeXmodemBlock(5, payload, 'checksum');
    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.block).toBe(5);
    expect(result.frame.mode).toBe('checksum');
    expect(result.frame.integrityValid).toBe(true);
    expect(result.frame.complementValid).toBe(true);
  });

  it('CRC modu + 1024 bayt round-trip: parseXmodemFrame(encodeXmodemBlock(...)) integrityValid=true', () => {
    const payload = repeatingPayload(1024);
    const wire = encodeXmodemBlock(9, payload, 'crc');
    const result = parseXmodemFrame(wire);
    if (!result.ok || result.frame.kind !== 'block') throw new Error('expected block frame');
    expect(result.frame.dataLength).toBe(1024);
    expect(result.frame.mode).toBe('crc');
    expect(result.frame.integrityValid).toBe(true);
  });

  it('128/1024 dışı bir uzunlukta RangeError fırlatır', () => {
    expect(() => encodeXmodemBlock(1, new Uint8Array(100), 'checksum')).toThrow(RangeError);
  });
});
