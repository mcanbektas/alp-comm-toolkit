import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { createFileSource, minimumGapForFraming } from './fileSource';
import type { ByteSourceHandlers, ConnectionStatus } from '../types';
import type { LogRecord } from '../../protocol-core/logs/types';
import { createExtractorFromConfig } from '../../protocol-core/framing/createExtractor';
import { createStreamBuffer } from '../../protocol-core/streams/streamBuffer';

function record(data: readonly number[], timestamp?: number): LogRecord {
  return {
    index: 0,
    line: undefined,
    timestamp,
    direction: undefined,
    channel: undefined,
    frameId: undefined,
    frameIdValue: undefined,
    data: new Uint8Array(data),
    originalLength: data.length,
    flags: [],
  };
}

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
      onChunk: (chunk) => {
        chunks.push(chunk);
      },
      onStatus: (status) => {
        statuses.push(status);
      },
      onError: () => undefined,
    },
  };
}

describe('createFileSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('yazma yönünü desteklemez', async () => {
    const source = createFileSource([record([1])]);
    expect(source.canWrite).toBe(false);
    expect(source.kind).toBe('file');
    await expect(source.write(new Uint8Array([1]))).rejects.toThrow('not-connected');
  });

  it('bağlanma durumlarını sırayla bildirir', async () => {
    const { handlers, statuses } = createRecordingHandlers();
    const source = createFileSource([record([1], 0)], { pacing: 'immediate' });
    await source.start(handlers);
    expect(statuses).toEqual(['connecting', 'connected']);
    await source.stop();
  });

  it('anında kipinde bütün kayıtları ilk turda gönderir', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createFileSource([record([1], 0), record([2], 5000), record([3], 9000)], {
      pacing: 'immediate',
    });

    await source.start(handlers);

    expect(chunks).toHaveLength(3);
    await source.stop();
  });

  it('gerçek zamanlı kipte kayıtları damga farkı kadar bekletir', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createFileSource([record([1], 0), record([2], 100)], { pacing: 'realtime' });

    await source.start(handlers);
    expect(chunks).toHaveLength(1);

    vi.advanceTimersByTime(60);
    expect(chunks).toHaveLength(1);

    vi.advanceTimersByTime(60);
    expect(chunks).toHaveLength(2);
    await source.stop();
  });

  it('hız çarpanı bekleme süresini kısaltır', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createFileSource([record([1], 0), record([2], 100)], { pacing: 'realtime', speed: 10 });

    await source.start(handlers);
    vi.advanceTimersByTime(20);
    expect(chunks).toHaveLength(2);
    await source.stop();
  });

  it('büyük kaydı gerçek bir port gibi parçalara böler', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const big = record(Array.from({ length: 700 }, () => 0xaa), 0);
    const source = createFileSource([big], { pacing: 'immediate', maxChunkSize: 256 });

    await source.start(handlers);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(256);
    expect(chunks[2]).toHaveLength(700 - 512);
    await source.stop();
  });

  it('boş veri taşıyan kaydı atlar', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createFileSource([record([], 0), record([7], 0)], { pacing: 'immediate' });
    await source.start(handlers);
    expect(chunks).toHaveLength(1);
    await source.stop();
  });

  it('oynatma bitince zamanlayıcıyı bırakır ve bir kez haber verir', async () => {
    const { handlers } = createRecordingHandlers();
    let completed = 0;
    const source = createFileSource([record([1], 0), record([2], 40)], {
      pacing: 'realtime',
      onCompleted: () => {
        completed += 1;
      },
    });

    await source.start(handlers);
    vi.advanceTimersByTime(500);

    expect(completed).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    await source.stop();
  });

  it('durdurulduktan sonra çerçeve göndermez', async () => {
    const { handlers, chunks } = createRecordingHandlers();
    const source = createFileSource([record([1], 0), record([2], 1000), record([3], 2000)], {
      pacing: 'realtime',
    });

    await source.start(handlers);
    await source.stop();
    vi.advanceTimersByTime(5000);

    expect(chunks).toHaveLength(1);
  });

  it('durdurma tekrar çağrılabilir', async () => {
    const source = createFileSource([record([1], 0)], { pacing: 'immediate' });
    await source.stop();
    await source.stop();
  });
});

describe('minimumGapForFraming', () => {
  it('zaman tabanlı ayarda zaman aşımının iki katını ister', () => {
    expect(minimumGapForFraming({ method: 'modbus-silent-interval', timeoutMs: 4 })).toBe(8);
    expect(minimumGapForFraming({ method: 'inter-frame-timeout', timeoutMs: 10 })).toBe(20);
  });

  it('bayt tabanlı ayarda boşluk gerektirmez', () => {
    expect(minimumGapForFraming({ method: 'slip' })).toBe(1);
    expect(minimumGapForFraming({ method: 'line-ending', endSequence: [0x0a] })).toBe(1);
  });
});

/**
 * Uçtan uca değişmez: KAYIT SINIRI ÇERÇEVE SINIRI OLARAK KORUNUR.
 *
 * Dosya kaynağı tek başına doğru olsa bile, kayıtları çerçeveleyicinin zaman
 * aşımından daha yakın gönderirse dosyada iki satır olan şey ekranda tek satır
 * olur. Bu tur o zinciri gerçek `streamBuffer` ile kurar — kaynak ve
 * çerçeveleyici birlikte sınanmadan bu hata görülmez.
 */
describe('dosya kaynağı + zaman tabanlı çerçeveleme', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('her kaydı ayrı bir çerçeve olarak kapatır', async () => {
    const framing = { method: 'inter-frame-timeout', timeoutMs: 5 } as const;
    const extractor = createExtractorFromConfig(framing);
    const buffer = createStreamBuffer(extractor, { maxFrameLength: 256 });
    const frames: Uint8Array[] = [];
    buffer.onFrame((frame) => frames.push(frame.bytes));

    // Monitörün saati: her tur 20 ms ilerler ve `push`/`tick` aynı saati görür.
    let virtualNow = 0;
    const source = createFileSource(
      [record([0xaa, 0xbb], 0), record([0xcc, 0xdd, 0xee], 100)],
      { pacing: 'realtime', minimumGapMs: minimumGapForFraming(framing) },
    );

    await source.start({
      onChunk: (chunk) => buffer.push(chunk, virtualNow),
      onStatus: () => undefined,
      onError: () => undefined,
    });
    buffer.tick(virtualNow);

    for (let step = 0; step < 20; step++) {
      virtualNow += 20;
      vi.advanceTimersByTime(20);
      buffer.tick(virtualNow);
    }

    expect(frames).toHaveLength(2);
    expect(Array.from(frames[0] ?? [])).toEqual([0xaa, 0xbb]);
    expect(Array.from(frames[1] ?? [])).toEqual([0xcc, 0xdd, 0xee]);
    await source.stop();
  });
});
