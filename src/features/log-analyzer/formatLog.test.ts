import { describe, expect, it } from 'vitest';

import { UNKNOWN_PLACEHOLDER, formatByteSize, formatDuration, formatRate, formatRecordTimestamp } from './formatLog';

describe('formatRecordTimestamp', () => {
  it('göreli damgayı saate ÇEVİRMEZ, saniye olarak yazar', () => {
    expect(formatRecordTimestamp(1500, 'relative')).toBe('1.500 s');
  });

  it('mutlak damgayı yerel saat olarak yazar', () => {
    const date = new Date(2021, 10, 25, 18, 40, 0, 123);
    expect(formatRecordTimestamp(date.getTime(), 'absolute')).toBe('18:40:00.123');
  });

  it('damga yoksa yer tutucu döner', () => {
    expect(formatRecordTimestamp(undefined, 'absolute')).toBe(UNKNOWN_PLACEHOLDER);
    expect(formatRecordTimestamp(5, 'none')).toBe(UNKNOWN_PLACEHOLDER);
  });
});

describe('formatDuration', () => {
  it('saniye altını ms, üstünü s yazar', () => {
    expect(formatDuration(250)).toBe('250.0 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
  });

  it('dakika ve üstünü sözcük kullanmadan yazar', () => {
    expect(formatDuration(90_000)).toBe('1:30.0');
  });
});

describe('formatByteSize', () => {
  it('bayt, KB ve MB eşiklerini uygular', () => {
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(2048)).toBe('2.0 KB');
    expect(formatByteSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('formatRate', () => {
  it('düşük hızda ondalık gösterir, yüksekte yuvarlar', () => {
    expect(formatRate(2.345)).toBe('2.35 /s');
    expect(formatRate(1234.5)).toBe('1235 /s');
    expect(formatRate(undefined)).toBe(UNKNOWN_PLACEHOLDER);
  });
});
