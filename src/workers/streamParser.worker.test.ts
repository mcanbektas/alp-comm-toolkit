import { describe, expect, it } from 'vitest';

import { createWorkerMessageHandler } from './streamParser.worker';
import type { WorkerOutMessage } from './streamParser.worker';

/**
 * `createWorkerMessageHandler` bilerek gerçek bir Worker global'inden BAĞIMSIZ
 * — `self.onmessage`in son iki satırı test EDİLMEZ (dosya başı yorumu), bu
 * dosya yalnız mesaj protokolünü doğrudan çağırarak sınar.
 */
function setUp() {
  const posted: WorkerOutMessage[] = [];
  const handle = createWorkerMessageHandler((message) => posted.push(message));
  return { posted, handle };
}

describe('streamParser.worker — createWorkerMessageHandler', () => {
  it('init + push tam bir çerçevede "frame" mesajı üretir', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'slip' }, maxFrameLength: 1024 });
    handle({ type: 'push', chunk: Uint8Array.from([0x01, 0x02, 0xc0]) }); // 0xC0 = SLIP END

    const frameMessages = posted.filter((message) => message.type === 'frame');
    expect(frameMessages).toHaveLength(1);
    if (frameMessages[0]?.type === 'frame') {
      expect(Array.from(frameMessages[0].frame.bytes)).toEqual([0x01, 0x02]);
    }
  });

  it('"state" mesajları durum geçişlerini yansıtır', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'fixed-length', frameLength: 3 }, maxFrameLength: 1024 });
    handle({ type: 'push', chunk: Uint8Array.from([0x01]) });
    const stateMessages = posted.filter((message) => message.type === 'state');
    expect(stateMessages.length).toBeGreaterThan(0);
    expect(stateMessages[0]).toMatchObject({ type: 'state', state: 'READING_PAYLOAD' });
  });

  it('geçersiz veri "error" mesajı üretir', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'cobs' }, maxFrameLength: 1024 });
    // Kod (03) kalan veriden uzun → truncated-frame.
    handle({ type: 'push', chunk: Uint8Array.from([0x03, 0x11, 0x00]) });
    const errorMessages = posted.filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    if (errorMessages[0]?.type === 'error') expect(errorMessages[0].error.code).toBe('truncated-frame');
  });

  it('"error" mesajı çerçevelerle AYNI zaman tabanında damgalanır', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'cobs' }, maxFrameLength: 1024 });

    const before = performance.timeOrigin + performance.now();
    handle({ type: 'push', chunk: Uint8Array.from([0x03, 0x11, 0x00]) });
    const after = performance.timeOrigin + performance.now();

    const [errorMessage] = posted.filter((message) => message.type === 'error');
    expect(errorMessage?.type).toBe('error');
    if (errorMessage?.type === 'error') {
      // Damga Worker'da atılmalı: ana thread toplu boşaltma yaparsa hata,
      // kendisinden sonraki çerçevelerden geç görünür ve liste zamanda geri gider.
      expect(errorMessage.timestamp).toBeGreaterThanOrEqual(before);
      expect(errorMessage.timestamp).toBeLessThanOrEqual(after);
    }
  });

  it('hata ve çerçeve damgaları üretim sırasını korur', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'slip' }, maxFrameLength: 1024 });
    // Önce sağlam bir çerçeve, sonra bozuk kaçış dizisi.
    handle({ type: 'push', chunk: Uint8Array.from([0xc0, 0x01, 0x02, 0xc0]) });
    handle({ type: 'push', chunk: Uint8Array.from([0xdb, 0x99, 0xc0]) });

    const stamps = posted
      .map((message) =>
        message.type === 'frame'
          ? message.frame.timestamp
          : message.type === 'error'
            ? message.timestamp
            : undefined,
      )
      .filter((value): value is number => value !== undefined);

    expect(stamps.length).toBeGreaterThan(1);
    for (let index = 1; index < stamps.length; index += 1) {
      expect(stamps[index] ?? 0).toBeGreaterThanOrEqual(stamps[index - 1] ?? 0);
    }
  });

  it('cancel sonrası init dışındaki mesajlar yok sayılır', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'slip' }, maxFrameLength: 1024 });
    handle({ type: 'cancel' });
    posted.length = 0; // cancel'ın kendi reset()'inden gelebilecek state mesajlarını at
    handle({ type: 'push', chunk: Uint8Array.from([0x01, 0xc0]) });
    expect(posted).toHaveLength(0);
  });

  it('cancel sonrası yeniden init edilince worker normale döner', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'slip' }, maxFrameLength: 1024 });
    handle({ type: 'cancel' });
    handle({ type: 'init', config: { method: 'slip' }, maxFrameLength: 1024 });
    handle({ type: 'push', chunk: Uint8Array.from([0x01, 0xc0]) });
    const frameMessages = posted.filter((message) => message.type === 'frame');
    expect(frameMessages).toHaveLength(1);
  });

  it('tick mesajı zaman-tabanlı yöntemi tetikler', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'inter-frame-timeout', timeoutMs: 10 }, maxFrameLength: 1024 });
    handle({ type: 'push', chunk: Uint8Array.from([0x01, 0x02]), receivedAt: 0 });
    handle({ type: 'tick', nowMs: 10 });
    const frameMessages = posted.filter((message) => message.type === 'frame');
    expect(frameMessages).toHaveLength(1);
  });

  it('push/tick/reset init öncesi sessizce yok sayılır (henüz buffer yok)', () => {
    const { posted, handle } = setUp();
    expect(() => {
      handle({ type: 'push', chunk: Uint8Array.from([0x01]) });
      handle({ type: 'tick', nowMs: 100 });
      handle({ type: 'reset' });
    }).not.toThrow();
    expect(posted).toHaveLength(0);
  });

  it('yeniden init aktif akışı sıfırdan başlatır', () => {
    const { posted, handle } = setUp();
    handle({ type: 'init', config: { method: 'fixed-length', frameLength: 4 }, maxFrameLength: 1024 });
    handle({ type: 'push', chunk: Uint8Array.from([0x01, 0x02]) }); // yarım çerçeve
    handle({ type: 'init', config: { method: 'fixed-length', frameLength: 2 }, maxFrameLength: 1024 }); // yöntem değişti
    posted.length = 0;
    handle({ type: 'push', chunk: Uint8Array.from([0xaa, 0xbb]) });
    const frameMessages = posted.filter((message) => message.type === 'frame');
    expect(frameMessages).toHaveLength(1);
    if (frameMessages[0]?.type === 'frame') expect(Array.from(frameMessages[0].frame.bytes)).toEqual([0xaa, 0xbb]);
  });
});
