import { describe, expect, it } from 'vitest';

import { findChecksumMatches } from './checksumFinder';

/** Spec §43 fixture: ASCII "123456789" → hex '313233343536373839'. */
const ASCII_123456789_HEX = '313233343536373839';

describe('findChecksumMatches', () => {
  it('spec §43 CRC-8 fixture ile eşleşir (normal bayt sırası)', () => {
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: 'F4' });
    expect(matches.some((match) => match.id === 'CRC8' && match.matchedByteOrder === 'normal')).toBe(true);
  });

  it('spec §43 CRC-16 CCITT-FALSE fixture ile eşleşir', () => {
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: '29B1' });
    expect(matches.some((match) => match.id === 'CRC16_CCITT_FALSE' && match.matchedByteOrder === 'normal')).toBe(true);
  });

  it('spec §43 CRC-32 fixture ile eşleşir', () => {
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: 'CBF43926' });
    expect(matches.some((match) => match.id === 'CRC32' && match.matchedByteOrder === 'normal')).toBe(true);
  });

  it('bayt sırası ters çevrilmiş checksum\'u "swapped" olarak bulur', () => {
    // CRC-16 MODBUS = 0x4B37 ([0x4B,0x37]); tel üzerinde ters sırayla ([0x37,0x4B] = "374B") okunmuş varsayımı.
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: '374B' });
    const match = matches.find((entry) => entry.id === 'CRC16_MODBUS');
    expect(match?.matchedByteOrder).toBe('swapped');
    expect(match?.computedHex).toBe('4B37');
  });

  it('genişlik uyuşmayan algoritmaları elemeye devam eder (4/5/6/7-bit CRC hiç denenmez)', () => {
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: 'F4' });
    expect(matches.some((match) => match.id.startsWith('CRC4') || match.id.startsWith('CRC5'))).toBe(false);
  });

  it('eşleşme yoksa boş dizi döner', () => {
    const matches = findChecksumMatches({ dataHex: ASCII_123456789_HEX, expectedHex: '00' });
    expect(matches).toEqual([]);
  });

  it('geçersiz hex girdisinde fırlatır (çağıran yakalar)', () => {
    expect(() => findChecksumMatches({ dataHex: 'ZZ', expectedHex: 'F4' })).toThrow();
  });
});
