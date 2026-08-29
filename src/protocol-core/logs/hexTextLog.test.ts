import { describe, expect, it } from 'vitest';

import { parseHexTextLog } from './hexTextLog';
import { bytesToHex } from '../buffers/representation';

describe('parseHexTextLog', () => {
  it('köşeli parantezli saat ve yön önekini okur', () => {
    const result = parseHexTextLog('[00:00:01.234] TX: 41 54 0D 0A');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const record = result.records[0];
    expect(record?.direction).toBe('tx');
    expect(bytesToHex(record?.data ?? new Uint8Array(0))).toBe('41540D0A');
    expect(record?.timestamp).toBeCloseTo(1234, 3);
  });

  it('parantezsiz saat ve ok işaretli yönü okur', () => {
    const result = parseHexTextLog('12:34:56.789 <- 0A 0B 0C');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.direction).toBe('rx');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('0A0B0C');
  });

  it('bitişik yazılmış hex diziyi bayta böler', () => {
    const result = parseHexTextLog('0.001500 -> DEADBEEF');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.data).toHaveLength(4);
    expect(result.records[0]?.timestamp).toBeCloseTo(1.5, 6);
  });

  it('çıplak tam sayıyı zaman damgası değil bayt sayar', () => {
    const result = parseHexTextLog('01 02 03');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.timestamp).toBeUndefined();
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('010203');
    expect(result.summary.timestampKind).toBe('none');
  });

  it('yön yoksa uydurmaz', () => {
    const result = parseHexTextLog('AA 55 01');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.direction).toBeUndefined();
  });

  it('düz metin satırlarını uyarı üretmeden atlar', () => {
    const result = parseHexTextLog(['--- terminal acildi ---', 'AA 55', 'baglanti kapandi'].join('\n'));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('yarım kalmış hex satırında uyarı üretir ama diğer satırları okur', () => {
    const result = parseHexTextLog(['AA 55', 'BB 5'].join('\n'));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('bad-hex');
  });

  it('köşeli parantezli kanal adını kanal olarak saklar', () => {
    const result = parseHexTextLog('[can0] AA BB');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.channel).toBe('can0');
  });

  it('epoch saniyeli damgayı mutlak sayar', () => {
    const result = parseHexTextLog('1637856000.500 AA');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.timestampKind).toBe('absolute');
  });

  it('veri taşımayan dosyayı hata döner', () => {
    expect(parseHexTextLog('sadece metin\nbaska metin').status).toBe('error');
  });
});
