import { describe, expect, it } from 'vitest';

import {
  inferTimestampKind,
  readDirection,
  readHexBytes,
  readHexNumber,
  readNumber,
  readTimestampMs,
  splitLines,
} from './textTokens';
import { bytesToHex } from '../buffers/representation';

describe('readHexBytes', () => {
  it('ayraçları ve 0x öneklerini temizler', () => {
    expect(bytesToHex(readHexBytes('DE-AD BE:EF') ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(bytesToHex(readHexBytes('0xAA 0xBB') ?? new Uint8Array(0))).toBe('AABB');
  });

  it('tek haneyi (yarım bayt) reddeder, yuvarlamaz', () => {
    expect(readHexBytes('ABC')).toBeUndefined();
  });

  it('hex olmayan karakteri reddeder ve HATA FIRLATMAZ', () => {
    expect(readHexBytes('ZZ')).toBeUndefined();
  });

  it('boş girdide boş dizi döner', () => {
    expect(readHexBytes('   ')).toHaveLength(0);
  });
});

describe('readTimestampMs', () => {
  it('kesirli saniyeyi milisaniyeye çevirir', () => {
    expect(readTimestampMs('0.0015')).toBeCloseTo(1.5, 6);
  });

  it('saat yazımını gün başından milisaniyeye çevirir', () => {
    expect(readTimestampMs('01:02:03.5')).toBeCloseTo(3_723_500, 3);
  });

  it('ISO 8601 damgayı epoch ms okur', () => {
    expect(readTimestampMs('2021-11-25T18:40:00.000Z')).toBe(Date.parse('2021-11-25T18:40:00.000Z'));
  });

  it('okunamayan metinde undefined döner', () => {
    expect(readTimestampMs('yok')).toBeUndefined();
  });
});

describe('readDirection', () => {
  it('üç ayrı sözlüğü de tanır', () => {
    expect(readDirection('Rx')).toBe('rx');
    expect(readDirection('TX:')).toBe('tx');
    expect(readDirection('<-')).toBe('rx');
    expect(readDirection('->')).toBe('tx');
  });

  it('tanımadığını uydurmaz', () => {
    expect(readDirection('bilinmiyor')).toBeUndefined();
  });
});

describe('readHexNumber ve readNumber', () => {
  it('onaltılık sayıyı okur', () => {
    expect(readHexNumber('18F00401')).toBe(0x18f00401);
  });

  it('0x öneki tabanı ezer', () => {
    expect(readNumber('0x10', 10)).toBe(16);
    expect(readNumber('10', 10)).toBe(10);
    expect(readNumber('10', 16)).toBe(16);
  });
});

describe('inferTimestampKind', () => {
  it('epoch büyüklüğündeki damgayı mutlak, küçüğünü göreli sayar', () => {
    expect(inferTimestampKind(1_637_856_000_000)).toBe('absolute');
    expect(inferTimestampKind(1500)).toBe('relative');
    expect(inferTimestampKind(undefined)).toBe('none');
  });
});

describe('splitLines', () => {
  it('CRLF, LF ve tek CR ayırır, sondaki boş satırı atar', () => {
    expect(splitLines('a\r\nb\rc\nd\n')).toEqual(['a', 'b', 'c', 'd']);
  });
});
