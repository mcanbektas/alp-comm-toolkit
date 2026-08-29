import { describe, expect, it } from 'vitest';

import { MAX_LOG_FILE_BYTES, detectLogFormat, parseLogFile } from './parseLog';

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function pcapHeaderBytes(): Uint8Array {
  const bytes = new Uint8Array(24);
  new DataView(bytes.buffer).setUint32(0, 0xa1b2c3d4, true);
  return bytes;
}

describe('detectLogFormat', () => {
  it('pcap imzasını uzantıdan bağımsız tanır', () => {
    expect(detectLogFormat(pcapHeaderBytes(), 'yakalama.txt')).toBe('pcap');
  });

  it('PCAPNG imzasını ayrı bir biçim olarak bildirir', () => {
    expect(detectLogFormat(new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a]))).toBe('pcapng');
  });

  it('candump satırını tanır', () => {
    expect(detectLogFormat(toBytes('(1637856000.123456) can0 123#DEADBEEF'))).toBe('candump');
  });

  it('ASC dosyasını başlık ve çerçeve satırı birlikteyken tanır', () => {
    const asc = ['base hex  timestamps absolute', '   0.011557 1  100  Rx   d 1 AA'].join('\n');
    expect(detectLogFormat(toBytes(asc))).toBe('vector-asc');
  });

  it('JSON gövdesini tanır', () => {
    expect(detectLogFormat(toBytes('[{"data":"AA"}]'))).toBe('json');
  });

  it('tutarlı sütunlu metni ayraçlı sayar', () => {
    expect(detectLogFormat(toBytes('a,b,c\n1,2,DEAD\n3,4,BEEF'))).toBe('delimited');
  });

  it('yalın hex dökümünü hex-text sayar', () => {
    expect(detectLogFormat(toBytes('AA BB CC\nDD EE FF'))).toBe('hex-text');
  });

  it('NUL içeren dosyayı ikili sayar', () => {
    expect(detectLogFormat(new Uint8Array([0x41, 0x00, 0x42, 0x43]))).toBe('binary');
  });
});

describe('parseLogFile', () => {
  it('biçimi saptayıp doğru ayrıştırıcıya verir', () => {
    const result = parseLogFile({ bytes: toBytes('(0.1) can0 123#AABB'), fileName: 'kayit.log' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.summary.format).toBe('candump');
  });

  it('elle verilen biçimi saptamaya tercih eder', () => {
    const result = parseLogFile({ bytes: toBytes('AA BB\nCC DD') }, { format: 'hex-text' });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.format).toBe('hex-text');
  });

  it('PCAPNG için yönlendirici bir hata mesajı döner', () => {
    const result = parseLogFile({ bytes: new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a, 0, 0, 0, 0]) });
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('unsupported-format');
    expect(result.message).toContain('PCAPNG');
  });

  it('boş dosyayı reddeder', () => {
    expect(parseLogFile({ bytes: new Uint8Array(0) }).status).toBe('error');
  });

  it('boyut sınırını aşan dosyayı okumadan reddeder', () => {
    const result = parseLogFile({ bytes: new Uint8Array(64) }, { maxBytes: 32 });
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('file-too-large');
  });

  it('varsayılan boyut sınırı 64 MB', () => {
    expect(MAX_LOG_FILE_BYTES).toBe(67_108_864);
  });
});
