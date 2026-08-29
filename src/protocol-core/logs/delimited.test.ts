import { describe, expect, it } from 'vitest';

import { detectDelimiter, guessColumnMapping, parseDelimitedLog, splitDelimitedLine } from './delimited';
import { bytesToHex } from '../buffers/representation';

const CSV_SAMPLE = [
  'Timestamp,Channel,ID,Dir,DLC,Data',
  '0.001000,can0,123,Rx,4,DEADBEEF',
  '0.002000,can0,18F00401,Tx,2,01 02',
].join('\n');

const INDEXED_SAMPLE = [
  'Time;ID;D0;D1;D2;D3',
  '0.001;100;AA;BB;CC;DD',
].join('\n');

describe('splitDelimitedLine', () => {
  it('tırnak içindeki ayracı veri sayar', () => {
    expect(splitDelimitedLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
  });

  it('kaçırılmış çift tırnağı tek tırnağa indirger', () => {
    expect(splitDelimitedLine('a,"b""c"', ',')).toEqual(['a', 'b"c']);
  });
});

describe('detectDelimiter', () => {
  it('tutarlı sütun sayısı üreten ayracı seçer', () => {
    expect(detectDelimiter(CSV_SAMPLE.split('\n'))).toBe(',');
    expect(detectDelimiter(INDEXED_SAMPLE.split('\n'))).toBe(';');
    expect(detectDelimiter(['a\tb\tc', 'd\te\tf'])).toBe('\t');
  });

  it('veri içindeki tek virgüle aldanmaz', () => {
    // Her satırda sekme 3 sütun üretir; virgül yalnız bir satırda görünür.
    expect(detectDelimiter(['a\tb\tc', 'd,x\te\tf', 'g\th\ti'])).toBe('\t');
  });
});

describe('guessColumnMapping', () => {
  it('başlık adlarından rolleri çıkarır', () => {
    const mapping = guessColumnMapping(['Timestamp', 'Channel', 'ID', 'Dir', 'DLC', 'Data']);
    expect(mapping.timestamp).toBe(0);
    expect(mapping.channel).toBe(1);
    expect(mapping.frameId).toBe(2);
    expect(mapping.direction).toBe(3);
    expect(mapping.length).toBe(4);
    expect(mapping.dataColumns).toEqual([5]);
  });

  it('numaralı bayt sütunlarını tek veri alanı olarak toplar', () => {
    const mapping = guessColumnMapping(['Time', 'ID', 'D0', 'D1', 'D2', 'D3']);
    expect(mapping.dataColumns).toEqual([2, 3, 4, 5]);
  });

  it('Türkçe başlıkları tanır', () => {
    const mapping = guessColumnMapping(['Zaman', 'Kimlik', 'Yön', 'Veri']);
    expect(mapping.timestamp).toBe(0);
    expect(mapping.frameId).toBe(1);
    expect(mapping.direction).toBe(2);
    expect(mapping.dataColumns).toEqual([3]);
  });
});

describe('parseDelimitedLog', () => {
  it('başlıklı CSV dosyasını kayda çevirir', () => {
    const result = parseDelimitedLog(CSV_SAMPLE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.records).toHaveLength(2);
    const first = result.records[0];
    expect(first?.channel).toBe('can0');
    expect(first?.frameId).toBe('123');
    expect(first?.frameIdValue).toBe(0x123);
    expect(first?.direction).toBe('rx');
    expect(bytesToHex(first?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(first?.line).toBe(2);
  });

  it('numaralı bayt sütunlarını birleştirir', () => {
    const result = parseDelimitedLog(INDEXED_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('AABBCCDD');
  });

  it('kimlik tabanını seçenekle ondalığa çevirir', () => {
    const result = parseDelimitedLog(CSV_SAMPLE, { idRadix: 10 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.frameIdValue).toBe(123);
  });

  it('başlıksız dosyada rolleri değerlerden tahmin eder', () => {
    const result = parseDelimitedLog('0.001,RX,DEADBEEF\n0.002,TX,AABB');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.direction).toBe('rx');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
  });

  it('elle verilen sütun eşlemesini tahmine tercih eder', () => {
    const result = parseDelimitedLog('9,8,DEADBEEF', {
      hasHeader: false,
      mapping: { timestamp: undefined, direction: undefined, frameId: 1, channel: 0, length: undefined, dataColumns: [2] },
    });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.channel).toBe('9');
    expect(result.records[0]?.frameId).toBe('8');
  });

  it('DLC sütununu telde geçen uzunluk olarak saklar', () => {
    const result = parseDelimitedLog(['Time,ID,DLC,Data', '0.1,100,8,AABB'].join('\n'));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.originalLength).toBe(8);
    expect(result.records[0]?.data).toHaveLength(2);
  });

  it('veri sütunu bulunamazsa açık hata döner', () => {
    const result = parseDelimitedLog('alpha,beta\ngamma,delta');
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('missing-data-column');
  });

  it('okunamayan satırı atlar ve uyarır', () => {
    const result = parseDelimitedLog(['Time,Data', '0.1,AABB', '0.2,ZZZZ'].join('\n'));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('bad-hex');
  });
});
