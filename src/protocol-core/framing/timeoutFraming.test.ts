import { describe, expect, it } from 'vitest';

import { createTimeoutExtractor, modbusSilentIntervalMs } from './timeoutFraming';

const OPTIONS_BASE = { maxFrameLength: 1024 };

describe('timeout-based framing', () => {
  it('elapsed verilmezse (yeni bayt geldi, idle tick değil) incomplete kalır', () => {
    const extractor = createTimeoutExtractor({ method: 'inter-frame-timeout', timeoutMs: 10 });
    const result = extractor.extract(Uint8Array.from([1, 2, 3]), OPTIONS_BASE);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('elapsed eşiğin altındaysa incomplete kalır', () => {
    const extractor = createTimeoutExtractor({ method: 'inter-frame-timeout', timeoutMs: 10 });
    const result = extractor.extract(Uint8Array.from([1, 2, 3]), { ...OPTIONS_BASE, elapsedSinceLastByteMs: 5 });
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('elapsed eşiği geçtiyse arabellekteki her şeyi tek çerçeve olarak tamamlar', () => {
    const extractor = createTimeoutExtractor({ method: 'inter-frame-timeout', timeoutMs: 10 });
    const result = extractor.extract(Uint8Array.from([1, 2, 3]), { ...OPTIONS_BASE, elapsedSinceLastByteMs: 10 });
    expect(result).toMatchObject({ status: 'complete', consumedBytes: 3 });
    if (result.status === 'complete') expect(Array.from(result.frame)).toEqual([1, 2, 3]);
  });

  it('boş arabellekte süre dolsa bile incomplete kalır (çerçeve yok, sinyal yok)', () => {
    const extractor = createTimeoutExtractor({ method: 'modbus-silent-interval', timeoutMs: 4 });
    const result = extractor.extract(new Uint8Array(0), { ...OPTIONS_BASE, elapsedSinceLastByteMs: 100 });
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('geçersiz (≤0) timeoutMs yapılandırma hatası olarak fırlatır', () => {
    expect(() => createTimeoutExtractor({ method: 'inter-character-timeout', timeoutMs: 0 })).toThrow(RangeError);
  });
});

describe('modbusSilentIntervalMs', () => {
  it('9600 baud için bilinen endüstri değerine (≈4.01ms) yakın sonuç verir', () => {
    // 3.5 × (11/9600×1000) = 4.0104166...ms — Modbus RTU dokümantasyonunda yaygın atıfta bulunulan değer.
    expect(modbusSilentIntervalMs(9600)).toBeCloseTo(4.0104, 3);
  });

  it('19200 baud ve üstünde sabit 1.75ms tabanına düşer', () => {
    expect(modbusSilentIntervalMs(19200)).toBe(1.75);
    expect(modbusSilentIntervalMs(115200)).toBe(1.75);
  });

  it('geçersiz baud hızında fırlatır', () => {
    expect(() => modbusSilentIntervalMs(0)).toThrow(RangeError);
    expect(() => modbusSilentIntervalMs(-9600)).toThrow(RangeError);
  });
});
