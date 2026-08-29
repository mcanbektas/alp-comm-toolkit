import { describe, expect, it } from 'vitest';

import { parseVectorAscLog } from './vectorAsc';
import { bytesToHex } from '../buffers/representation';

const ABSOLUTE_SAMPLE = [
  'date Tue Sep 21 10:00:00 2021',
  'base hex  timestamps absolute',
  'internal events logged',
  '// version 9.0.0',
  'Begin Triggerblock Tue Sep 21 10:00:00 2021',
  '   0.011557 1  100             Rx   d 8 01 02 03 04 05 06 07 08',
  '   0.021557 1  18F00401x       Rx   d 8 11 22 33 44 55 66 77 88',
  '   0.031557 1  200             Tx   r 4',
  '   0.041557 1  ErrorFrame',
  'End TriggerBlock',
].join('\n');

describe('parseVectorAscLog', () => {
  it('klasik CAN satırını kimlik, yön ve veriyle okur', () => {
    const result = parseVectorAscLog(ABSOLUTE_SAMPLE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.records).toHaveLength(3);
    const first = result.records[0];
    expect(first?.frameId).toBe('100');
    expect(first?.frameIdValue).toBe(0x100);
    expect(first?.direction).toBe('rx');
    expect(first?.channel).toBe('1');
    expect(bytesToHex(first?.data ?? new Uint8Array(0))).toBe('0102030405060708');
  });

  it('kimliğin sonundaki `x` işaretini kimlikten ayırır ve genişletilmiş sayar', () => {
    const result = parseVectorAscLog(ABSOLUTE_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const extended = result.records[1];
    expect(extended?.frameId).toBe('18F00401');
    expect(extended?.frameIdValue).toBe(0x18f00401);
    expect(extended?.flags).toContain('extended-id');
  });

  it('`r` uzaktan çerçevesinde veri üretmez, DLC saklanır', () => {
    const result = parseVectorAscLog(ABSOLUTE_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const remote = result.records[2];
    expect(remote?.flags).toContain('remote-frame');
    expect(remote?.data).toHaveLength(0);
    expect(remote?.originalLength).toBe(4);
    expect(remote?.direction).toBe('tx');
  });

  it('ErrorFrame ve blok satırlarını uyarı üretmeden atlar', () => {
    const result = parseVectorAscLog(ABSOLUTE_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.skippedLines).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('`date` başlığı okunabiliyorsa damgayı epoch ms yapar', () => {
    const result = parseVectorAscLog(ABSOLUTE_SAMPLE);
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.timestampKind).toBe('absolute');
    const base = Date.parse('Tue Sep 21 10:00:00 2021');
    expect(result.records[0]?.timestamp).toBeCloseTo(base + 11.557, 3);
  });

  it('`date` başlığı okunamıyorsa tarih uydurmaz, damga göreli kalır', () => {
    const result = parseVectorAscLog(
      ['date Die Sep 21 10:00:00 2021', 'base hex  timestamps absolute', '   0.011557 1  100  Rx   d 1 AA'].join('\n'),
    );
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.timestampKind).toBe('relative');
    expect(result.records[0]?.timestamp).toBeCloseTo(11.557, 3);
  });

  it('`timestamps relative` dosyada deltaları birikimli toplar', () => {
    const result = parseVectorAscLog(
      [
        'base hex  timestamps relative',
        '   0.010000 1  100  Rx   d 1 AA',
        '   0.005000 1  100  Rx   d 1 BB',
        '   0.005000 1  100  Rx   d 1 CC',
      ].join('\n'),
    );
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records.map((record) => record.timestamp)).toEqual([10, 15, 20]);
  });

  it('`base dec` başlığında kimliği ondalık okur', () => {
    const result = parseVectorAscLog(['base dec  timestamps absolute', '   0.01 1  100  Rx   d 1 AA'].join('\n'));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records[0]?.frameIdValue).toBe(100);
    expect(result.summary.detail).toBe('base dec');
  });

  it('CAN FD satırını okur ve mesaj adını veriyle karıştırmaz', () => {
    const result = parseVectorAscLog(
      ['base hex  timestamps absolute', '   0.030000 CANFD   1 Rx   11a  Msg1  0 0 8 8 11 22 33 44 55 66 77 88'].join(
        '\n',
      ),
    );
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const fd = result.records[0];
    expect(fd?.frameId).toBe('11a');
    expect(fd?.flags).toContain('flexible-data-rate');
    expect(bytesToHex(fd?.data ?? new Uint8Array(0))).toBe('1122334455667788');
  });

  it('mesaj adı olmayan CAN FD satırını da okur', () => {
    const result = parseVectorAscLog(
      ['base hex  timestamps absolute', '   0.030000 CANFD   1 Tx   11a  0 0 4 4 DE AD BE EF'].join('\n'),
    );
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEADBEEF');
    expect(result.records[0]?.direction).toBe('tx');
  });

  it('çerçeve satırı bulunmayan dosyayı hata olarak döner', () => {
    expect(parseVectorAscLog('base hex\n// yalnız yorum').status).toBe('error');
  });
});
