import { describe, expect, it } from 'vitest';

import { SLIP_END, encodeSlip, slipExtractor } from './slip';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const OPTIONS = { maxFrameLength: 1024 };

describe('SLIP', () => {
  it('spec fixture: 45 00 C0 11 DB 22 → wire DB DC 11 DB DD 22 C0 içerir, çözülünce aynı payload çıkar', () => {
    const payload = Uint8Array.from([0x45, 0x00, 0xc0, 0x11, 0xdb, 0x22]);
    const wire = encodeSlip(payload);
    expect(hex(wire)).toBe('45 00 DB DC 11 DB DD 22 C0');

    const result = slipExtractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe(hex(payload));
      expect(result.consumedBytes).toBe(wire.length);
    }
  });

  it('arabellekte çerçeve tamamlanmadıysa incomplete döner (END henüz gelmedi)', () => {
    const partial = Uint8Array.from([0x11, 0x22, 0x33]);
    const result = slipExtractor.extract(partial, OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('baştaki opsiyonel END işaretleyicisini (RFC 1055 hat temizliği) atlar', () => {
    const wire = Uint8Array.from([SLIP_END, 0x01, 0x02, SLIP_END]);
    const result = slipExtractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe('01 02');
      expect(result.consumedBytes).toBe(4);
    }
  });

  it('art arda iki delimiter (boş çerçeve) kurtarılabilir hata döner', () => {
    // Baştaki TEK delimiter RFC 1055'in opsiyonel hat-temizleme işaretleyicisi
    // sayılıp atlanır (bkz. yukarıdaki test) — bu yüzden boş çerçeveyi tetiklemek
    // için İKİ delimiter ART ARDA aynı `extract()` çağrısında olmalı: ilki
    // "opsiyonel öncü" diye atlanır, ikincisi arama başlangıcıyla ÇAKIŞIR.
    const wire = Uint8Array.from([SLIP_END, SLIP_END, 0x02, SLIP_END]);
    const result = slipExtractor.extract(wire, OPTIONS);
    expect(result).toMatchObject({ status: 'error', error: { code: 'frame-too-short' }, recoverable: true });
  });

  it('kaçış dizisi bozuksa kurtarılabilir invalid-escape döner', () => {
    const wire = Uint8Array.from([0xdb, 0xaa, SLIP_END]);
    const result = slipExtractor.extract(wire, OPTIONS);
    expect(result).toMatchObject({ status: 'error', error: { code: 'invalid-escape' }, recoverable: true });
  });

  it('parça parça (chunk chunk) beslenen aynı içerik tek seferde beslenenle aynı sonucu verir', () => {
    const payload = Uint8Array.from([0xaa, 0xbb, SLIP_END, 0xcc]);
    const wire = encodeSlip(payload);
    // İlk üç bayt henüz çerçeveyi bitirmiyor.
    const partial = wire.subarray(0, 3);
    expect(slipExtractor.extract(partial, OPTIONS)).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
    // Tamamı gelince aynı sonuç.
    const full = slipExtractor.extract(wire, OPTIONS);
    expect(full.status).toBe('complete');
    if (full.status === 'complete') expect(hex(full.frame)).toBe(hex(payload));
  });
});
