import { describe, expect, it } from 'vitest';

import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';
import { xor8Checksum } from '../../protocol-core/checksums/simpleChecksums';
import { bytesToNumber, toSignedInt } from '../../protocol-core/buffers/endianness';
import type { RawFrame } from '../../protocol-core/types';
import type { FramingError } from '../../protocol-core/framing/types';
import {
  buildSimulatedFrame,
  createLcg,
  createSimulatedByteStream,
  createTelemetryGenerator,
  SIMULATED_EOF_BYTE,
  SIMULATED_FRAME_LENGTH,
  SIMULATED_FRAMING_CONFIG,
  SIMULATED_START_BYTE,
  splitIntoChunks,
} from './simulatedProtocol';

const MAX_FRAME_LENGTH = 256;

function collect(chunks: readonly Uint8Array[]): { frames: RawFrame[]; errors: FramingError[] } {
  const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
    maxFrameLength: MAX_FRAME_LENGTH,
  });
  const frames: RawFrame[] = [];
  const errors: FramingError[] = [];
  buffer.onFrame((frame) => frames.push(frame));
  buffer.onError((error) => errors.push(error));
  let clock = 0;
  for (const chunk of chunks) {
    clock += 1;
    buffer.push(chunk, clock);
  }
  return { frames, errors };
}

describe('buildSimulatedFrame', () => {
  it('spec §8.3 çerçeve şeklini üretir: START, ADDRESS, COMMAND, LENGTH, PAYLOAD, CHECKSUM, EOF', () => {
    const frame = buildSimulatedFrame({ temperatureDeciC: 250, voltageMilliV: 12_000, rpm: 1500 });

    expect(frame).toHaveLength(SIMULATED_FRAME_LENGTH);
    expect(frame[0]).toBe(SIMULATED_START_BYTE);
    expect(frame[1]).toBe(0x05);
    expect(frame[2]).toBe(0x10);
    expect(frame[3]).toBe(6);
    expect(frame[SIMULATED_FRAME_LENGTH - 1]).toBe(SIMULATED_EOF_BYTE);
    expect(frame[SIMULATED_FRAME_LENGTH - 2]).toBe(
      xor8Checksum(frame.subarray(0, SIMULATED_FRAME_LENGTH - 2)),
    );
  });

  it('işaretli sıcaklığı iki tümleyen olarak kodlar ve geri okunabilir', () => {
    const frame = buildSimulatedFrame({ temperatureDeciC: -125, voltageMilliV: 5000, rpm: 0 });
    const raw = bytesToNumber(frame.subarray(4, 6), 'big');

    expect(toSignedInt(raw, 16)).toBe(-125);
  });
});

describe('createTelemetryGenerator', () => {
  it('aynı tohumla aynı akışı verir (deterministik)', () => {
    const first = createTelemetryGenerator({ seed: 42 });
    const second = createTelemetryGenerator({ seed: 42 });
    const firstValues = [first(), first(), first()];
    const secondValues = [second(), second(), second()];

    expect(firstValues).toEqual(secondValues);
  });

  it('farklı tohumla farklı akış verir', () => {
    const a = createTelemetryGenerator({ seed: 1 });
    const b = createTelemetryGenerator({ seed: 2 });

    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('rpm negatife düşmez', () => {
    const generate = createTelemetryGenerator({ seed: 7 });
    for (let index = 0; index < 500; index += 1) {
      expect(generate().rpm).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('splitIntoChunks', () => {
  it('parçaları birleştirince özgün diziyi verir', () => {
    const bytes = Uint8Array.from({ length: 97 }, (_unused, index) => index & 0xff);
    const chunks = splitIntoChunks(bytes, createLcg(3), 7);
    const merged = new Uint8Array(bytes.length);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    expect(offset).toBe(bytes.length);
    expect(Array.from(merged)).toEqual(Array.from(bytes));
  });

  it('parçalar kendi arabelleğine sahiptir — Worker klonlamasını şişirmesin diye', () => {
    const bytes = new Uint8Array(64);
    const chunks = splitIntoChunks(bytes, createLcg(9), 5);

    for (const chunk of chunks) {
      expect(chunk.buffer.byteLength).toBe(chunk.length);
    }
  });

  it('boş dizi için boş liste döner', () => {
    expect(splitIntoChunks(new Uint8Array(0), createLcg(1), 4)).toEqual([]);
  });
});

describe('simüle akış ↔ stream buffer turu', () => {
  it('bozulma ve çöp kapalıyken üretilen her çerçeve, parçalı gelse de aynen geri çözülür', () => {
    const stream = createSimulatedByteStream({ seed: 123, corruptionRate: 0, garbageRate: 0 });
    const expected: Uint8Array[] = [];
    let total = 0;
    for (let index = 0; index < 40; index += 1) {
      const frame = stream.next();
      expected.push(frame);
      total += frame.length;
    }
    const batch = new Uint8Array(total);
    let offset = 0;
    for (const frame of expected) {
      batch.set(frame, offset);
      offset += frame.length;
    }

    // maxChunkSize=3, çerçeve 12 bayt: hiçbir parça bir çerçeveyi tek başına
    // taşıyamaz, yani spec §8.4'ün "chunk sınırı ≠ çerçeve sınırı" durumu zorunlu.
    const { frames, errors } = collect(splitIntoChunks(batch, createLcg(77), 3));

    expect(errors).toEqual([]);
    expect(frames).toHaveLength(expected.length);
    frames.forEach((frame, index) => {
      expect(Array.from(frame.bytes)).toEqual(Array.from(expected[index] ?? new Uint8Array(0)));
    });
  });

  it('çöp bayt eklendiğinde no-sync hatası verir ama sonraki çerçeveler kurtarılır', () => {
    const stream = createSimulatedByteStream({ seed: 5, corruptionRate: 0, garbageRate: 1 });
    const chunks: Uint8Array[] = [];
    for (let index = 0; index < 20; index += 1) {
      chunks.push(stream.next());
    }

    const { frames, errors } = collect(chunks);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.code === 'no-sync')).toBe(true);
    // Çerçevelerin tamamı kurtarılmalı: çöp START baytıyla çakışmayacak şekilde üretiliyor.
    expect(frames).toHaveLength(20);
  });

  it('bozulmuş çerçeve ÇERÇEVELEME düzeyinde geçer, doğrulama düzeyinde düşer', () => {
    const stream = createSimulatedByteStream({ seed: 11, corruptionRate: 1, garbageRate: 0 });
    const chunks: Uint8Array[] = [];
    for (let index = 0; index < 10; index += 1) {
      chunks.push(stream.next());
    }

    const { frames, errors } = collect(chunks);

    expect(errors).toEqual([]);
    expect(frames).toHaveLength(10);
    for (const frame of frames) {
      const stored = frame.bytes[frame.bytes.length - 2];
      const computed = xor8Checksum(frame.bytes.subarray(0, frame.bytes.length - 2));
      expect(stored).not.toBe(computed);
    }
  });
});
