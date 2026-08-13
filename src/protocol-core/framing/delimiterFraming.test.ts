import { describe, expect, it } from 'vitest';

import { createBoundedDelimiterExtractor, createStartMarkerExtractor } from './delimiterFraming';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
function ascii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

const OPTIONS = { maxFrameLength: 1024 };

describe('start-end-delimiter (bounded)', () => {
  const STX = 0x02;
  const ETX = 0x03;
  const stxEtx = createBoundedDelimiterExtractor({ method: 'start-end-delimiter', startSequence: [STX], endSequence: [ETX] });

  it('spec fixture: 02 31 32 33 34 03 = <STX>1234<ETX> (satır 76-79)', () => {
    const wire = Uint8Array.from([STX, 0x31, 0x32, 0x33, 0x34, ETX]);
    const result = stxEtx.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(ascii(result.frame)).toBe('1234');
      expect(result.consumedBytes).toBe(wire.length);
    }
  });

  it('spec fixture: AA 01 10 22 33 C7 55 (satır 79-80, AA/55 sınırlayıcı)', () => {
    const aa55 = createBoundedDelimiterExtractor({ method: 'start-end-delimiter', startSequence: [0xaa], endSequence: [0x55] });
    const wire = Uint8Array.from([0xaa, 0x01, 0x10, 0x22, 0x33, 0xc7, 0x55]);
    const result = aa55.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(hex(result.frame)).toBe('01 10 22 33 C7');
  });

  it('bitiş gelmeden incomplete döner', () => {
    const wire = Uint8Array.from([STX, 0x31, 0x32]);
    expect(stxEtx.extract(wire, OPTIONS)).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });

  it('başlangıçtan önceki gürültüyü atlayarak resync olur', () => {
    const wire = Uint8Array.from([0xff, 0xfe, STX, 0x41, ETX]);
    const first = stxEtx.extract(wire, OPTIONS);
    expect(first).toMatchObject({ status: 'error', error: { code: 'no-sync' }, consumedBytes: 2, recoverable: true });
    const second = stxEtx.extract(wire.subarray(first.consumedBytes), OPTIONS);
    expect(second.status).toBe('complete');
    if (second.status === 'complete') expect(ascii(second.frame)).toBe('A');
  });

  it('includeDelimitersInFrame=true iken sınırlayıcılar da çerçeveye girer', () => {
    const withMarkers = createBoundedDelimiterExtractor({
      method: 'start-end-delimiter',
      startSequence: [STX],
      endSequence: [ETX],
      includeDelimitersInFrame: true,
    });
    const wire = Uint8Array.from([STX, 0x41, ETX]);
    const result = withMarkers.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(hex(result.frame)).toBe('02 41 03');
  });
});

describe('line-ending (bounded, başlangıçsız)', () => {
  const CR = 0x0d;
  const lineEnding = createBoundedDelimiterExtractor({ method: 'line-ending', endSequence: [CR] });

  it('spec fixture: AT\\r → 41 54 0D (satır 55-71)', () => {
    const wire = Uint8Array.from([0x41, 0x54, CR]);
    const result = lineEnding.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(ascii(result.frame)).toBe('AT');
      expect(result.consumedBytes).toBe(3);
    }
  });
});

describe('start-byte / multiple-start-bytes (bir sonraki başlangıca kadar)', () => {
  it('tek baytlı başlangıç: çerçeve bir sonraki başlangıca kadar sürer', () => {
    const extractor = createStartMarkerExtractor({ method: 'start-byte', startSequence: [0xaa] });
    const wire = Uint8Array.from([0xaa, 0x01, 0x02, 0xaa, 0x03]);
    const result = extractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(hex(result.frame)).toBe('AA 01 02');
      expect(result.consumedBytes).toBe(3);
    }
  });

  it('çok baytlı başlangıç dizisi (multiple-start-bytes) doğru eşleşir', () => {
    const extractor = createStartMarkerExtractor({ method: 'multiple-start-bytes', startSequence: [0xaa, 0x55] });
    const wire = Uint8Array.from([0xaa, 0x55, 0x01, 0x02, 0xaa, 0x55, 0x03]);
    const result = extractor.extract(wire, OPTIONS);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(hex(result.frame)).toBe('AA 55 01 02');
  });

  it('bir sonraki başlangıç henüz gelmediyse (akıştaki son çerçeve) incomplete kalır — yöntemin doğası', () => {
    const extractor = createStartMarkerExtractor({ method: 'start-byte', startSequence: [0xaa] });
    const wire = Uint8Array.from([0xaa, 0x01, 0x02]);
    expect(extractor.extract(wire, OPTIONS)).toEqual({ status: 'incomplete', consumedBytes: 0, phase: 'payload' });
  });
});
