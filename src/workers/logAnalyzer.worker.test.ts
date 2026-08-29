/**
 * Worker'ın MESAJ SÖZLEŞMESİ testi. Gerçek bir `Worker` global'i kurulmaz —
 * `createLogWorkerMessageHandler` bilerek `self`ten koparılmış saf bir
 * fabrikadır; son iki satırdaki tel bağlantısı test edilmez.
 */

import { describe, expect, it, vi } from 'vitest';

import { createLogWorkerMessageHandler } from './logAnalyzer.worker';
import type { LogWorkerOutMessage } from './logAnalyzer.worker';

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('createLogWorkerMessageHandler', () => {
  it('ayrıştırma sonucunu istek kimliğiyle geri yollar', () => {
    const posted: LogWorkerOutMessage[] = [];
    const handle = createLogWorkerMessageHandler((message) => posted.push(message));

    handle({ type: 'parse', requestId: 7, fileName: 'a.log', bytes: bytesOf('(0.1) can0 123#AABB') });

    expect(posted).toHaveLength(1);
    const message = posted[0];
    expect(message?.type).toBe('result');
    if (message?.type !== 'result') return;
    expect(message.requestId).toBe(7);
    expect(message.result.status).toBe('ok');
    expect(message.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('ayrıştırıcının hatasını sonuç olarak taşır, istisnaya çevirmez', () => {
    const posted: LogWorkerOutMessage[] = [];
    const handle = createLogWorkerMessageHandler((message) => posted.push(message));

    handle({ type: 'parse', requestId: 1, bytes: bytesOf('sadece duz metin') });

    const message = posted[0];
    expect(message?.type).toBe('result');
    if (message?.type !== 'result') return;
    expect(message.result.status).toBe('error');
  });

  it('beklenmedik istisnayı `failed` mesajına çevirir', () => {
    const posted: LogWorkerOutMessage[] = [];
    const handle = createLogWorkerMessageHandler((message) => posted.push(message));
    // `bytes` yerine erişildiğinde patlayan bir nesne: ayrıştırıcı sözleşmesi
    // "çökme yok" der ama Worker yine de sessizce ölmemeli.
    const exploding = {
      get length(): number {
        throw new Error('bozuk arabellek');
      },
    } as unknown as Uint8Array;

    handle({ type: 'parse', requestId: 3, bytes: exploding });

    const message = posted[0];
    expect(message?.type).toBe('failed');
    if (message?.type !== 'failed') return;
    expect(message.requestId).toBe(3);
    expect(message.message).toBe('bozuk arabellek');
  });

  it('iptal mesajı tek başına çıktı üretmez', () => {
    const post = vi.fn();
    const handle = createLogWorkerMessageHandler(post);
    handle({ type: 'cancel' });
    expect(post).not.toHaveBeenCalled();
  });
});
