import { describe, expect, it } from 'vitest';

import {
  bytesToEpoch32,
  bytesToEpoch64,
  epochToBytes32,
  epochToBytes64,
  epochToIso,
  isoToEpoch,
} from './unixTimestamp';

describe('epochToIso / isoToEpoch', () => {
  it('converts the epoch origin in seconds', () => {
    expect(epochToIso(0, 'seconds')).toBe('1970-01-01T00:00:00.000Z');
    expect(isoToEpoch('1970-01-01T00:00:00.000Z', 'seconds')).toBe(0);
  });

  it('converts a known timestamp in milliseconds', () => {
    // 2024-01-01T00:00:00.000Z epoch milisaniye.
    const ms = 1704067200000;
    expect(epochToIso(ms, 'milliseconds')).toBe('2024-01-01T00:00:00.000Z');
    expect(isoToEpoch('2024-01-01T00:00:00.000Z', 'milliseconds')).toBe(ms);
  });

  it('round-trips seconds through ISO', () => {
    const seconds = 1700000000;
    expect(isoToEpoch(epochToIso(seconds, 'seconds'), 'seconds')).toBe(seconds);
  });

  it('throws on an invalid ISO string', () => {
    expect(() => isoToEpoch('not-a-date', 'seconds')).toThrow();
  });
});

describe('epochToBytes32 / bytesToEpoch32', () => {
  it('encodes 0 and 1 in both endianness', () => {
    expect(Array.from(epochToBytes32(1, 'big'))).toEqual([0x00, 0x00, 0x00, 0x01]);
    expect(Array.from(epochToBytes32(1, 'little'))).toEqual([0x01, 0x00, 0x00, 0x00]);
  });

  it('round-trips a realistic epoch-seconds value', () => {
    const seconds = 1700000000;
    expect(bytesToEpoch32(epochToBytes32(seconds, 'big'), 'big')).toBe(seconds);
    expect(bytesToEpoch32(epochToBytes32(seconds, 'little'), 'little')).toBe(seconds);
  });

  it('rejects values outside the unsigned 32-bit range', () => {
    expect(() => epochToBytes32(-1, 'big')).toThrow();
    expect(() => epochToBytes32(0x100000000, 'big')).toThrow();
  });

  it('throws on wrong byte length', () => {
    expect(() => bytesToEpoch32(Uint8Array.of(0, 0), 'big')).toThrow();
  });
});

describe('epochToBytes64 / bytesToEpoch64', () => {
  it('round-trips a bigint epoch-milliseconds value in both endianness', () => {
    const ms = 1704067200000n;
    expect(bytesToEpoch64(epochToBytes64(ms, 'big'), 'big')).toBe(ms);
    expect(bytesToEpoch64(epochToBytes64(ms, 'little'), 'little')).toBe(ms);
  });

  it('throws on wrong byte length', () => {
    expect(() => bytesToEpoch64(Uint8Array.of(0, 0, 0, 0), 'big')).toThrow();
  });
});
