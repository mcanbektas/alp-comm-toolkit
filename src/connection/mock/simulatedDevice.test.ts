import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimulatedDevice } from './simulatedDevice';
import type { ByteSourceHandlers, ConnectionStatus } from '../types';

function collector(): { handlers: ByteSourceHandlers; chunks: Uint8Array[]; statuses: ConnectionStatus[] } {
  const chunks: Uint8Array[] = [];
  const statuses: ConnectionStatus[] = [];
  return {
    chunks,
    statuses,
    handlers: {
      onChunk: (chunk) => chunks.push(chunk),
      onStatus: (status) => statuses.push(status),
      onError: () => undefined,
    },
  };
}

const STATUS_REQUEST = Uint8Array.from([0xaa, 0x01]);
/** Spec §38 örneğinin beklediği komut baytı 0x31. */
const RESPONSE = [0xaa, 0x31, 0x55];

describe('createSimulatedDevice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('yazma yönünü destekler — simulatedSource\'un aksine', () => {
    const device = createSimulatedDevice({ rules: [] });
    expect(device.canWrite).toBe(true);
    expect(device.kind).toBe('simulated');
  });

  it('eşleşen isteğe gecikmeyle yanıt verir', async () => {
    const sink = collector();
    const device = createSimulatedDevice({
      rules: [{ match: { offset: 0, bytes: [0xaa, 0x01] }, response: RESPONSE, delayMs: 50 }],
    });
    await device.start(sink.handlers);
    await device.write(STATUS_REQUEST);

    // Gecikme dolmadan yanıt YOK.
    vi.advanceTimersByTime(49);
    expect(sink.chunks).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(sink.chunks).toHaveLength(1);
    expect(Array.from(sink.chunks[0] ?? [])).toEqual(RESPONSE);
  });

  it('eşleşmeyen isteğe SESSİZ kalır', async () => {
    const sink = collector();
    const device = createSimulatedDevice({
      rules: [{ match: { offset: 0, bytes: [0xbb] }, response: RESPONSE }],
    });
    await device.start(sink.handlers);
    await device.write(STATUS_REQUEST);
    vi.advanceTimersByTime(1000);
    expect(sink.chunks).toHaveLength(0);
  });

  it('filtresiz kural her isteğe tutar', async () => {
    const sink = collector();
    const device = createSimulatedDevice({ rules: [{ response: RESPONSE }] });
    await device.start(sink.handlers);
    await device.write(Uint8Array.from([0x99]));
    vi.advanceTimersByTime(1000);
    expect(sink.chunks).toHaveLength(1);
  });

  it('ilk eşleşen kuralı seçer', async () => {
    const sink = collector();
    const device = createSimulatedDevice({
      rules: [
        { match: { offset: 0, bytes: [0xaa] }, response: [0x01] },
        { response: [0x02] },
      ],
    });
    await device.start(sink.handlers);
    await device.write(STATUS_REQUEST);
    vi.advanceTimersByTime(1000);
    expect(Array.from(sink.chunks[0] ?? [])).toEqual([0x01]);
  });

  it('yanıtı parçalara böler', async () => {
    const sink = collector();
    const device = createSimulatedDevice({ rules: [{ response: RESPONSE }], maxChunkSize: 2 });
    await device.start(sink.handlers);
    await device.write(STATUS_REQUEST);
    vi.advanceTimersByTime(1000);
    expect(sink.chunks.map((chunk) => Array.from(chunk))).toEqual([[0xaa, 0x31], [0x55]]);
  });

  it('kapanınca bekleyen yanıtı düşürür', async () => {
    const sink = collector();
    const device = createSimulatedDevice({ rules: [{ response: RESPONSE, delayMs: 100 }] });
    await device.start(sink.handlers);
    await device.write(STATUS_REQUEST);
    await device.stop();
    vi.advanceTimersByTime(1000);
    expect(sink.chunks).toHaveLength(0);
    expect(sink.statuses).toEqual(['connecting', 'connected', 'idle']);
  });

  it('başlatılmadan yazmayı reddeder', async () => {
    const device = createSimulatedDevice({ rules: [{ response: RESPONSE }] });
    await expect(device.write(STATUS_REQUEST)).rejects.toThrow('not-connected');
  });
});
