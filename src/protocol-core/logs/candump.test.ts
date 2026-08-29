import { describe, expect, it } from 'vitest';

import { parseCandumpLog } from './candump';
import { bytesToHex } from '../buffers/representation';

/** can-utils `candump -l can0` çıktısının birebir yazımı. */
const LOG_FORMAT_SAMPLE = [
  '(1637856000.123456) can0 123#DEADBEEF',
  '(1637856000.124000) can0 18F00401#0102030405060708',
  '(1637856000.125000) can1 456#R8',
  '(1637856000.126000) can0 123##1AABBCC',
].join('\n');

/** Ekrana basılan (insan okur) yazım — damgasız, köşeli parantezli uzunluk. */
const HUMAN_FORMAT_SAMPLE = [
  '  can0  123   [4]  DE AD BE EF',
  "  can0  1F334455   [2]  01 02   '..'",
].join('\n');

describe('parseCandumpLog', () => {
  it('log biçimindeki satırları kimlik, kanal ve veriyle okur', () => {
    const result = parseCandumpLog(LOG_FORMAT_SAMPLE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.records).toHaveLength(4);
    const first = result.records[0];
    expect(first?.channel).toBe('can0');
    expect(first?.frameId).toBe('123');
    expect(bytesToHex(first?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(first?.line).toBe(1);
  });

  it('mutlak epoch damgasını milisaniyeye çevirir ve mutlak olarak işaretler', () => {
    const result = parseCandumpLog(LOG_FORMAT_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.timestampKind).toBe('absolute');
    expect(result.records[0]?.timestamp).toBeCloseTo(1_637_856_000_123.456, 1);
  });

  it('sıfır tabanlı damgayı göreli sayar', () => {
    const result = parseCandumpLog('(0.000000) can0 123#AA\n(0.001500) can0 123#BB');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.timestampKind).toBe('relative');
    expect(result.records[1]?.timestamp).toBeCloseTo(1.5, 6);
  });

  it('8 haneli kimliği genişletilmiş çerçeve sayar, 3 haneliyi saymaz', () => {
    const result = parseCandumpLog(LOG_FORMAT_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[1]?.flags).toContain('extended-id');
    expect(result.records[0]?.flags).not.toContain('extended-id');
    expect(result.records[1]?.frameIdValue).toBe(0x18f00401);
  });

  it('`#R8` uzaktan çerçevesinde veri üretmez ama istenen uzunluğu saklar', () => {
    const result = parseCandumpLog(LOG_FORMAT_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const remote = result.records[2];
    expect(remote?.flags).toContain('remote-frame');
    expect(remote?.data).toHaveLength(0);
    expect(remote?.originalLength).toBe(8);
  });

  it('CAN FD satırında `##` sonrası ilk haneyi bayrak sayar, veriye katmaz', () => {
    const result = parseCandumpLog(LOG_FORMAT_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const fd = result.records[3];
    expect(fd?.flags).toContain('flexible-data-rate');
    expect(bytesToHex(fd?.data ?? new Uint8Array(0))).toBe('AABBCC');
  });

  it('insan okur biçimini okur ve tırnaklı ASCII ekini veriye katmaz', () => {
    const result = parseCandumpLog(HUMAN_FORMAT_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(bytesToHex(result.records[1]?.data ?? new Uint8Array(0))).toBe('0102');
    expect(result.summary.timestampKind).toBe('none');
  });

  it('bozuk satırı atlar, kalanı okur ve tek uyarıda toplar', () => {
    const result = parseCandumpLog('(0.0) can0 123#AA\nbu satır log değil\n(0.1) can0 123#BB\nbu da değil');
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
    expect(result.summary.skippedLines).toBe(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('unparsed-line');
    expect(result.warnings[0]?.count).toBe(2);
  });

  it('tek haneli (yarım bayt) veriyi kabul etmez', () => {
    const result = parseCandumpLog('(0.0) can0 123#ABC');
    expect(result.status).toBe('error');
  });

  it('kayıt sınırına ulaşınca durur ve işaretler', () => {
    const lines = Array.from({ length: 10 }, (_unused, i) => `(0.00${i}) can0 123#AA`).join('\n');
    const result = parseCandumpLog(lines, { maxRecords: 4 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(4);
    expect(result.summary.limitReached).toBe(true);
  });

  it('boş girdiyi hata olarak döner, çökmez', () => {
    expect(parseCandumpLog('').status).toBe('error');
  });
});
