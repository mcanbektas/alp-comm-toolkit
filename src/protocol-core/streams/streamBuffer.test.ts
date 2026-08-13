import { describe, expect, it } from 'vitest';

import { createLengthFieldExtractor } from '../framing/lengthFieldFraming';
import { createTimeoutExtractor } from '../framing/timeoutFraming';
import { slipExtractor, encodeSlip } from '../framing/slip';
import type { RawFrame } from '../types';
import { createStreamBuffer } from './streamBuffer';
import type { StreamBufferState } from './types';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** Kanonik uzunluk-alanlı çerçeve extractor'ı — `lengthFieldFraming.test.ts` ile aynı yapılandırma. */
function createCanonicalExtractor() {
  return createLengthFieldExtractor({
    startByte: 0xaa,
    headerBytesBeforeLength: 2,
    lengthFieldWidth: 1,
    lengthFieldEndianness: 'big',
    trailerLength: 2,
  });
}

describe('createStreamBuffer — spec §8.4 kanonik chunk örneği', () => {
  // Spec satır 246-252: dört parça, çerçeve sınırlarıyla ÇAKIŞMAYAN kesimlerde gelir.
  //   Chunk 1: AA 05
  //   Chunk 2: 10 03 34
  //   Chunk 3: 12 7F 4F 55 AA
  //   Chunk 4: 05 10 03
  // Birleşik akış = kanonik çerçeve (AA 05 10 03 34 12 7F 4F 55, 9 bayt) +
  // ikinci bir çerçevenin başlangıcı (AA 05 10 03, 4 bayt, henüz eksik).
  it('4 parça halinde beslenince birinci çerçeveyi TAM ANINDA yayınlar, ikincisini yarım bırakır', () => {
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    const frames: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));

    buffer.push(Uint8Array.from([0xaa, 0x05]));
    expect(frames).toHaveLength(0);
    expect(buffer.state).toBe('READING_HEADER');

    buffer.push(Uint8Array.from([0x10, 0x03, 0x34]));
    expect(frames).toHaveLength(0);
    expect(buffer.state).toBe('READING_PAYLOAD');

    buffer.push(Uint8Array.from([0x12, 0x7f, 0x4f, 0x55, 0xaa]));
    expect(frames).toEqual(['AA 05 10 03 34 12 7F 4F 55']);
    // Beşinci bayt (yeni AA) tüketilmedi, ikinci çerçevenin başı olarak arabellekte kaldı.
    expect(buffer.pendingByteLength).toBe(1);
    expect(buffer.state).toBe('READING_HEADER');

    buffer.push(Uint8Array.from([0x05, 0x10, 0x03]));
    expect(frames).toHaveLength(1); // ikinci çerçeve hâlâ tamamlanmadı (payload eksik)
    expect(buffer.pendingByteLength).toBe(4);
    // 4 bayt (start+address+command+length) TAM header+length alanını karşılıyor —
    // uzunluk artık okunabiliyor (değeri 3), yalnız 3 payload + 2 trailer bayt eksik.
    expect(buffer.state).toBe('READING_PAYLOAD');
  });

  it('tüm akış TEK SEFERDE verilse de aynı tek tam çerçeveyi üretir (chunk sınırları sonucu değiştirmez)', () => {
    const whole = Uint8Array.from([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55, 0xaa, 0x05, 0x10, 0x03]);
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    const frames: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));
    buffer.push(whole);
    expect(frames).toEqual(['AA 05 10 03 34 12 7F 4F 55']);
    expect(buffer.pendingByteLength).toBe(4);
  });

  it('tek push içinde İKİ ard arda tam çerçeve varsa ikisini de aynı turda yayınlar', () => {
    const oneFrame = Uint8Array.from([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);
    const two = new Uint8Array(oneFrame.length * 2);
    two.set(oneFrame, 0);
    two.set(oneFrame, oneFrame.length);

    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    const frames: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));
    buffer.push(two);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBe(frames[1]);
    expect(buffer.pendingByteLength).toBe(0);
    expect(buffer.state).toBe('SEARCHING_FOR_FRAME');
  });

  it('RawFrame alanları doğru dolar (id/timestamp/direction/channel)', () => {
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024, direction: 'tx', channel: 'usb0' });
    let captured: RawFrame | undefined;
    buffer.onFrame((frame) => {
      captured = frame;
    });
    buffer.push(Uint8Array.from([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]));
    expect(captured?.direction).toBe('tx');
    expect(captured?.channel).toBe('usb0');
    expect(typeof captured?.id).toBe('string');
    expect(captured?.id.length).toBeGreaterThan(0);
    expect(typeof captured?.timestamp).toBe('number');
  });
});

describe('createStreamBuffer — hata/resync', () => {
  it('kurtarılabilir hatada ilerleme garantisi: en az 1 bayt atlanır, sonraki geçerli çerçeve yine bulunur', () => {
    const buffer = createStreamBuffer(slipExtractor, { maxFrameLength: 1024 });
    const frames: string[] = [];
    const errors: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));
    buffer.onError((error) => errors.push(error.code));

    // Bozuk kaçış (DB AA — geçersiz ikame) + geçerli bir SLIP çerçevesi ardı sıra.
    const validFrame = encodeSlip(Uint8Array.from([0x01, 0x02]));
    const stream = new Uint8Array(3 + validFrame.length);
    stream.set([0xdb, 0xaa, 0xc0], 0); // bozuk çerçeve + END
    stream.set(validFrame, 3);

    buffer.push(stream);
    expect(errors).toContain('invalid-escape');
    expect(frames).toEqual(['01 02']);
  });

  it('durum sırası spec diyagramıyla tutarlı: ... → VALIDATING_FRAME → FRAME_COMPLETE → SEARCHING', () => {
    // İki parçada besleniyor ki ara durumlar (READING_LENGTH/PAYLOAD) da
    // gözlemlensin — tek seferde tam çerçeve gelirse extractor doğrudan
    // "complete" döner, ara durumlar hiç OLUŞMAZ (bkz. aşağıdaki ikinci test).
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    const states: StreamBufferState[] = [];
    buffer.onStateChange((state) => states.push(state));
    buffer.push(Uint8Array.from([0xaa, 0x05, 0x10, 0x03]));
    buffer.push(Uint8Array.from([0x34, 0x12, 0x7f, 0x4f, 0x55]));
    expect(states).toEqual(['READING_PAYLOAD', 'VALIDATING_FRAME', 'FRAME_COMPLETE', 'SEARCHING_FOR_FRAME']);
  });

  it('tek seferde tam çerçeve gelirse ara durumlar oluşmadan doğrudan tamamlanır', () => {
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    const states: StreamBufferState[] = [];
    buffer.onStateChange((state) => states.push(state));
    buffer.push(Uint8Array.from([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]));
    expect(states).toEqual(['VALIDATING_FRAME', 'FRAME_COMPLETE', 'SEARCHING_FOR_FRAME']);
  });

  it('savunma sınırı: extractor hiç ilerlemese bile arabellek sınırsız BÜYÜMEZ', () => {
    // Hiçbir zaman tamamlanmayan, hep "incomplete" dönen bozuk bir extractor.
    const stuckExtractor = { method: 'fixed-length' as const, extract: () => ({ status: 'incomplete' as const, consumedBytes: 0 as const, phase: 'payload' as const }) };
    const buffer = createStreamBuffer(stuckExtractor, { maxFrameLength: 10 });
    const errors: string[] = [];
    buffer.onError((error) => errors.push(error.code));
    buffer.push(new Uint8Array(50)); // 10*2 (OVERFLOW_SAFETY_MULTIPLIER) sınırını çok aşıyor
    expect(errors).toContain('buffer-overflow');
    expect(buffer.pendingByteLength).toBe(0);
  });

  it('reset() arabelleği ve durumu temizler', () => {
    const buffer = createStreamBuffer(createCanonicalExtractor(), { maxFrameLength: 1024 });
    buffer.push(Uint8Array.from([0xaa, 0x05]));
    expect(buffer.pendingByteLength).toBeGreaterThan(0);
    buffer.reset();
    expect(buffer.pendingByteLength).toBe(0);
    expect(buffer.state).toBe('SEARCHING_FOR_FRAME');
  });
});

describe('createStreamBuffer — zaman tabanlı yöntem (tick)', () => {
  it('push sonrası tick() eşiği geçmeden çerçeve üretmez, geçince üretir', () => {
    const buffer = createStreamBuffer(createTimeoutExtractor({ method: 'inter-frame-timeout', timeoutMs: 10 }), { maxFrameLength: 1024 });
    const frames: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));

    buffer.push(Uint8Array.from([0x01, 0x02, 0x03]), 0);
    expect(frames).toHaveLength(0);

    buffer.tick(5); // 5ms geçti, eşik 10ms
    expect(frames).toHaveLength(0);

    buffer.tick(10); // tam eşikte
    expect(frames).toEqual(['01 02 03']);
  });

  it('push hiç olmadıysa tick() no-op kalır', () => {
    const buffer = createStreamBuffer(createTimeoutExtractor({ method: 'modbus-silent-interval', timeoutMs: 4 }), { maxFrameLength: 1024 });
    const frames: string[] = [];
    buffer.onFrame((frame) => frames.push(hex(frame.bytes)));
    buffer.tick(1000);
    expect(frames).toHaveLength(0);
  });
});
