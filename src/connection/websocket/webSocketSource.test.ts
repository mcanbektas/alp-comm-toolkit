import { describe, expect, it, vi } from 'vitest';

import type { ByteSourceHandlers, ConnectionError, ConnectionStatus } from '../types';

import { createWebSocketSource } from './webSocketSource';
import type { WebSocketLike } from './webSocketSource';

/**
 * Sahte soket: global `WebSocket`i taklit ETMEZ, yalnız kaynağın kullandığı
 * yüzeyi gerçekler (`WebSocketLike`). Böylece test bir tarayıcı sınıfını değil,
 * SÖZLEŞMEYİ sınıyor.
 */
class FakeSocket implements WebSocketLike {
  binaryType = 'blob';
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  readonly sent: (ArrayBufferView | ArrayBuffer | string)[] = [];
  closed = false;

  send(data: ArrayBufferView | ArrayBuffer | string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(null);
  }

  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

interface Harness {
  readonly socket: FakeSocket;
  readonly chunks: { bytes: Uint8Array; receivedAt: number }[];
  readonly statuses: ConnectionStatus[];
  readonly errors: ConnectionError[];
  readonly handlers: ByteSourceHandlers;
}

function harness(): Harness {
  const socket = new FakeSocket();
  const chunks: { bytes: Uint8Array; receivedAt: number }[] = [];
  const statuses: ConnectionStatus[] = [];
  const errors: ConnectionError[] = [];
  return {
    socket,
    chunks,
    statuses,
    errors,
    handlers: {
      onChunk: (bytes, receivedAt) => chunks.push({ bytes, receivedAt }),
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    },
  };
}

describe('createWebSocketSource', () => {
  it('reports connecting then connected, and forwards binary frames', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099/bridge', {
      socketFactory: () => context.socket,
    });

    await source.start(context.handlers);
    expect(context.statuses).toEqual(['connecting']);
    // İkili çerçeveler için `arraybuffer` ZORUNLU: 'blob' kalsaydı veri
    // asenkron bir okuma gerektirir ve `onChunk` senkron sözleşmesini bozardı.
    expect(context.socket.binaryType).toBe('arraybuffer');

    context.socket.open();
    expect(context.statuses).toEqual(['connecting', 'connected']);

    context.socket.receive(Uint8Array.from([0xaa, 0x05]).buffer);
    expect(context.chunks[0]?.bytes).toEqual(Uint8Array.from([0xaa, 0x05]));
    expect(context.chunks[0]?.receivedAt).toBeGreaterThan(0);
  });

  /** Metin çerçevesini atmak sessiz veri kaybı olurdu. */
  it('turns text frames into UTF-8 bytes', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.open();
    context.socket.receive('$GPGGA');

    expect(context.chunks[0]?.bytes).toEqual(new TextEncoder().encode('$GPGGA'));
  });

  it('ignores an empty or unreadable frame', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.open();
    context.socket.receive(new ArrayBuffer(0));
    context.socket.receive({ unexpected: true });

    expect(context.chunks).toEqual([]);
  });

  it('writes a copy of the caller buffer', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.open();

    const buffer = Uint8Array.from([0x01, 0x02]);
    await source.write(buffer);
    // Çağıranın tamponu sonradan değişse bile gönderilen bayt değişmemeli.
    buffer[0] = 0xff;

    expect(context.socket.sent[0]).toEqual(Uint8Array.from([0x01, 0x02]));
  });

  it('refuses to write before the socket is open', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);

    await expect(source.write(Uint8Array.from([0x01]))).rejects.toThrow();
  });

  /** Adres hatası `start()`ın çağıranına FIRLAMAZ; sözleşmenin hata yolundan bildirilir. */
  it('reports a non-websocket url through onError', async () => {
    const context = harness();
    const factory = vi.fn(() => context.socket);
    const source = createWebSocketSource('http://localhost:9099', { socketFactory: factory });

    await source.start(context.handlers);

    expect(factory).not.toHaveBeenCalled();
    expect(context.errors[0]?.code).toBe('open-failed');
    expect(context.statuses).toEqual(['error']);
  });

  it('reports a socket error as an error status', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.onerror?.(null);

    expect(context.errors[0]?.code).toBe('open-failed');
    expect(context.statuses).toEqual(['connecting', 'error']);
  });

  /** Karşı taraf kapattı: hattın bitmesi bir hata değildir. */
  it('treats a remote close as idle, not as an error', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.open();
    context.socket.onclose?.(null);

    expect(context.errors).toEqual([]);
    expect(context.statuses).toEqual(['connecting', 'connected', 'idle']);
  });

  /** Kapanışı BİZ istediysek ekranda kırmızıya dönmemeli. */
  it('stays quiet when the close was requested by stop()', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    context.socket.open();
    await source.stop();

    expect(context.socket.closed).toBe(true);
    expect(context.errors).toEqual([]);
    expect(context.statuses).toEqual(['connecting', 'connected']);
  });

  it('can be stopped twice', async () => {
    const context = harness();
    const source = createWebSocketSource('ws://localhost:9099', { socketFactory: () => context.socket });

    await source.start(context.handlers);
    await source.stop();

    await expect(source.stop()).resolves.toBeUndefined();
  });
});
