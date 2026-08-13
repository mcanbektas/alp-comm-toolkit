import { describe, expect, it } from 'vitest';

import { createLengthFieldExtractor } from './lengthFieldFraming';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const OPTIONS = { maxFrameLength: 1024 };

/**
 * Kanonik çerçeve — spec `10-uygulama-spec.md` §43 ve `ProtocolPage.tsx`
 * `SAMPLE_FRAME_BYTES`/`SAMPLE_FRAME_REGIONS` ile AYNI bayt dizisi:
 * START(AA) ADDRESS(05) COMMAND(10) LENGTH(03) PAYLOAD(34 12 7F) CHECKSUM(4F) EOF(55).
 */
const CANONICAL_FRAME = Uint8Array.from([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);

const canonicalExtractor = createLengthFieldExtractor({
  startByte: 0xaa,
  headerBytesBeforeLength: 2, // address + command
  lengthFieldWidth: 1,
  lengthFieldEndianness: 'big',
  trailerLength: 2, // checksum + EOF
});

describe('length-field framing', () => {
  it('kanonik çerçeveyi (spec §43) tek seferde tam ayrıştırır', () => {
    const result = canonicalExtractor.extract(CANONICAL_FRAME, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe(hex(CANONICAL_FRAME));
      expect(result.consumedBytes).toBe(9);
    }
  });

  it('header tamamlandı ama length alanı henüz gelmedi → incomplete("length" fazı)', () => {
    // START+ADDRESS+COMMAND (3 bayt) tamam, LENGTH baytı (4.) henüz yok.
    const result = canonicalExtractor.extract(CANONICAL_FRAME.subarray(0, 3), OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'length' });
  });

  it('header bile tamamlanmadı → incomplete("header" fazı)', () => {
    const result = canonicalExtractor.extract(CANONICAL_FRAME.subarray(0, 2), OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'header' });
  });

  it('payload/trailer tamamlanmadan incomplete("payload" fazı) döner', () => {
    const result = canonicalExtractor.extract(CANONICAL_FRAME.subarray(0, 6), OPTIONS);
    expect(result).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('yanlış senkron baytında tek bayt atlayarak kurtarır', () => {
    const corrupted = Uint8Array.from([0xff, ...CANONICAL_FRAME]);
    const first = canonicalExtractor.extract(corrupted, OPTIONS);
    expect(first).toMatchObject({ status: 'error', error: { code: 'no-sync' }, consumedBytes: 1, recoverable: true });
    const second = canonicalExtractor.extract(corrupted.subarray(first.consumedBytes), OPTIONS);
    expect(second.status).toBe('complete');
  });

  it('spec satır 108 resync örneği: bozuk length sonraki header\'a atlar', () => {
    // AA 55 FF FF (bozuk, length=0xFFFF/geniş varsayım aşırı büyük) ... AA 55 04 ...
    const extractor = createLengthFieldExtractor({
      startByte: 0xaa,
      headerBytesBeforeLength: 1, // yalnız "0x55" tipi tek header baytı
      lengthFieldWidth: 2,
      lengthFieldEndianness: 'big',
      trailerLength: 0,
    });
    const garbage = Uint8Array.from([0xaa, 0x55, 0xff, 0xff]);
    const result = extractor.extract(garbage, { maxFrameLength: 64 });
    expect(result).toMatchObject({ status: 'error', error: { code: 'invalid-length' }, recoverable: true });
    if (result.status === 'error') {
      // Yalnız header kadar (start+header+length = 1+1+2=4) tüketildi, 0xFFFF kadar DEĞİL.
      expect(result.consumedBytes).toBe(4);
    }
  });

  it('little-endian uzunluk alanını doğru okur', () => {
    const extractor = createLengthFieldExtractor({
      headerBytesBeforeLength: 0,
      lengthFieldWidth: 2,
      lengthFieldEndianness: 'little',
      trailerLength: 0,
    });
    // Uzunluk baytları 34 12 → little-endian yorum = 0x1234 = 4660 (spec satır 101-104'ün endianness uyarısı).
    const buffer = new Uint8Array(2 + 4660);
    buffer[0] = 0x34;
    buffer[1] = 0x12;
    const result = extractor.extract(buffer, { maxFrameLength: 10_000 });
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(result.consumedBytes).toBe(2 + 4660);
  });

  it('opsiyonel start baytı olmadan da (yalnız header+length+payload) çalışır', () => {
    const extractor = createLengthFieldExtractor({ headerBytesBeforeLength: 0, lengthFieldWidth: 1, lengthFieldEndianness: 'big', trailerLength: 0 });
    const buffer = Uint8Array.from([0x02, 0xaa, 0xbb]);
    const result = extractor.extract(buffer, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(hex(result.frame)).toBe('02 AA BB');
  });
});
