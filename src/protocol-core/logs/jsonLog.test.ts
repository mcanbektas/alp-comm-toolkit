import { describe, expect, it } from 'vitest';

import { parseJsonLog } from './jsonLog';
import { bytesToHex } from '../buffers/representation';

describe('parseJsonLog', () => {
  it('nesne dizisini kayda çevirir', () => {
    const result = parseJsonLog(
      JSON.stringify([
        { ts: 0.1, channel: 'can0', id: '123', dir: 'rx', data: 'DEADBEEF' },
        { ts: 0.2, channel: 'can0', id: '124', dir: 'tx', data: 'AA BB' },
      ]),
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.channel).toBe('can0');
    expect(result.records[0]?.direction).toBe('rx');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(result.records[0]?.timestamp).toBeCloseTo(100, 6);
  });

  it('JSON Lines yazımını okur', () => {
    const result = parseJsonLog('{"time":1,"data":"AA"}\n{"time":2,"data":"BB"}');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
  });

  it('sarmalayıcı nesnenin içindeki diziyi bulur', () => {
    const result = parseJsonLog('{"meta":{"tool":"x"},"frames":[{"data":"AABB"}]}');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(1);
  });

  it('sayı dizisi biçimindeki veriyi okur', () => {
    const result = parseJsonLog('[{"data":[222,173,190,239]}]');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
  });

  it('255 üstü elemanı maskelemez, kaydı atlar', () => {
    const result = parseJsonLog('[{"data":[1,2,300]},{"data":"AA"}]');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('bad-hex');
  });

  it('büyük sayısal damgayı milisaniye, küçüğünü saniye sayar', () => {
    const milliseconds = parseJsonLog('[{"ts":1637856000123,"data":"AA"}]');
    if (milliseconds.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(milliseconds.records[0]?.timestamp).toBe(1_637_856_000_123);

    const seconds = parseJsonLog('[{"ts":1637856000,"data":"AA"}]');
    if (seconds.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(seconds.records[0]?.timestamp).toBe(1_637_856_000_000);
  });

  it('okunabilir kaydı olmayan JSON için hata döner', () => {
    expect(parseJsonLog('[{"foo":"bar"}]').status).toBe('error');
  });
});
