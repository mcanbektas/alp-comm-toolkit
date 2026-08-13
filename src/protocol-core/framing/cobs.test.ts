import { describe, expect, it } from 'vitest';

import { cobsExtractor, decodeCobs, encodeCobs, encodeCobsFrame } from './cobs';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const OPTIONS = { maxFrameLength: 1024 };

describe('COBS', () => {
  it('spec fixture 1: 11 22 00 33 → 03 11 22 02 33 (delimiter hariç, satır 139)', () => {
    const encoded = encodeCobs(Uint8Array.from([0x11, 0x22, 0x00, 0x33]));
    expect(hex(encoded)).toBe('03 11 22 02 33');
    const decoded = decodeCobs(encoded);
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && hex(decoded.data)).toBe('11 22 00 33');
  });

  it('spec fixture 1 tam kablo: 03 11 22 02 33 00 (satır 139)', () => {
    expect(hex(encodeCobsFrame(Uint8Array.from([0x11, 0x22, 0x00, 0x33])))).toBe('03 11 22 02 33 00');
  });

  it('spec fixture 2: 00 → 01 01 (satır 140)', () => {
    const encoded = encodeCobs(Uint8Array.from([0x00]));
    expect(hex(encoded)).toBe('01 01');
    const decoded = decodeCobs(encoded);
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && hex(decoded.data)).toBe('00');
  });

  it('spec fixture 2 tam kablo: 01 01 00 (satır 140)', () => {
    expect(hex(encodeCobsFrame(Uint8Array.from([0x00])))).toBe('01 01 00');
  });

  it('sıfır içermeyen veri tek blokta kodlanır (uzunluk+1 önek)', () => {
    const raw = Uint8Array.from([0x01, 0x02, 0x03]);
    const encoded = encodeCobs(raw);
    expect(hex(encoded)).toBe('04 01 02 03');
  });

  it('254 sıfırsız bayt 0xFF kod baytıyla bölünür (taşırma sınırı)', () => {
    const raw = Uint8Array.from({ length: 254 }, (_unused, i) => (i % 255) + 1); // hiç 0 yok
    const encoded = encodeCobs(raw);
    expect(encoded[0]).toBe(0xff);
    expect(encoded.length).toBe(1 + 254 + 1); // 0xFF kod + 254 veri + kapanış kod(1)
    const decoded = decodeCobs(encoded);
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && hex(decoded.data)).toBe(hex(raw));
  });

  it('extractor: tam kablo çerçeveden orijinal veriyi çıkarır', () => {
    const raw = Uint8Array.from([0x11, 0x22, 0x00, 0x33]);
    const wire = encodeCobsFrame(raw);
    const result = cobsExtractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe(hex(raw));
      expect(result.consumedBytes).toBe(wire.length);
    }
  });

  it('extractor: delimiter gelmeden incomplete döner', () => {
    const result = cobsExtractor.extract(Uint8Array.from([0x03, 0x11, 0x22]), OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('decodeCobs: gövde içinde 0x00 (COBS ihlali) invalid-stuffing döner', () => {
    // `cobsExtractor` delimiter'ı ARABELLEKTEKİ İLK 0x00'da arar, bu yüzden bu
    // dal onun üzerinden asla tetiklenmez (dilimlenen gövde yapısı gereği hiç
    // 0x00 taşımaz) — yalnız `decodeCobs`e DOĞRUDAN, elle bozulmuş bir gövde
    // verildiğinde ulaşılır (örn. başka bir kaynaktan gelen ham COBS bloğu).
    const result = decodeCobs(Uint8Array.from([0x03, 0x11, 0x00]));
    expect(result).toMatchObject({ ok: false, code: 'invalid-stuffing', offset: 2 });
  });

  it('extractor: kod kalan veriden uzunsa truncated-frame döner', () => {
    const wire = Uint8Array.from([0x05, 0x11, 0x22, 0x00]); // kod 5 → 4 veri baytı ister, yalnız 2 var
    const result = cobsExtractor.extract(wire, OPTIONS);
    expect(result).toMatchObject({ status: 'error', error: { code: 'truncated-frame' }, recoverable: true });
  });

  it('extractor: parça parça beslenen aynı içerik tek seferde beslenenle aynı sonucu verir', () => {
    const raw = Uint8Array.from([0xaa, 0x00, 0xbb]);
    const wire = encodeCobsFrame(raw);
    const partial = wire.subarray(0, wire.length - 1);
    expect(cobsExtractor.extract(partial, OPTIONS)).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
    const full = cobsExtractor.extract(wire, OPTIONS);
    expect(full.status).toBe('complete');
    if (full.status === 'complete') expect(hex(full.frame)).toBe(hex(raw));
  });
});
