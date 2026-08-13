import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';
import type { ByteSourceHandlers, ConnectionStatus } from '../types';
import { SIMULATED_FRAMING_CONFIG } from './simulatedProtocol';
import { createSimulatedSource } from './simulatedSource';

function createRecordingHandlers(): {
  handlers: ByteSourceHandlers;
  chunks: Uint8Array[];
  statuses: ConnectionStatus[];
} {
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

describe('createSimulatedSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('yazma desteklemez ve write() reddeder', async () => {
    const source = createSimulatedSource();

    expect(source.canWrite).toBe(false);
    await expect(source.write(new Uint8Array(0))).rejects.toThrow('not-connected');
  });

  it('başlayınca connected bildirir ve parçalı bayt üretir', async () => {
    const { handlers, chunks, statuses } = createRecordingHandlers();
    const source = createSimulatedSource({ framesPerSecond: 500 });

    await source.start(handlers);
    vi.advanceTimersByTime(100);

    expect(statuses).toEqual(['connecting', 'connected']);
    expect(chunks.length).toBeGreaterThan(0);

    await source.stop();
  });

  it('düşük hızda da çerçeve üretir — kesirli tur borcu birikir', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    // Tur başına 0.1 çerçeve: borç birikmezse hiç bayt üretilmezdi.
    const source = createSimulatedSource({ framesPerSecond: 5 });

    await source.start(handlers);
    vi.advanceTimersByTime(1000);

    expect(chunks.length).toBeGreaterThan(0);

    await source.stop();
  });

  it('stop() sonrası üretim durur', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createSimulatedSource({ framesPerSecond: 500 });

    await source.start(handlers);
    vi.advanceTimersByTime(100);
    const countAtStop = chunks.length;
    await source.stop();
    vi.advanceTimersByTime(500);

    expect(chunks.length).toBe(countAtStop);
  });

  it('ürettiği akış stream buffer tarafından çözülebilir', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createSimulatedSource({
      framesPerSecond: 400,
      stream: { seed: 31, corruptionRate: 0, garbageRate: 0 },
    });

    await source.start(handlers);
    vi.advanceTimersByTime(500);
    await source.stop();

    const buffer = createStreamBuffer(createExtractorFromConfig(SIMULATED_FRAMING_CONFIG), {
      maxFrameLength: 256,
    });
    let frameCount = 0;
    let errorCount = 0;
    buffer.onFrame(() => {
      frameCount += 1;
    });
    buffer.onError(() => {
      errorCount += 1;
    });
    let clock = 0;
    for (const chunk of chunks) {
      clock += 1;
      buffer.push(chunk, clock);
    }

    expect(errorCount).toBe(0);
    // 400 fps × 0.5 s ≈ 200 çerçeve; son çerçeve yarım kalmış olabilir.
    expect(frameCount).toBeGreaterThanOrEqual(195);
    expect(frameCount).toBeLessThanOrEqual(200);
  });
});
