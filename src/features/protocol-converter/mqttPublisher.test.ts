import { describe, expect, it } from 'vitest';

import { mqttParser } from '@/protocols/network/mqtt/mqtt';

import { publishMqttPacket } from './mqttPublisher';

import type { ByteSource, ByteSourceHandlers } from '@/connection/types';

/** Kısa: testler gerçek zamanlayıcıyla koşuyor, sahte saat kurmaya değmedi. */
const TIMEOUT_MS = 25;

/** `encodeMqttPublishPacket`in ürettiği gerçek bir PUBLISH (`a/b` topic'i, `hi` payload'ı). */
const PUBLISH_PACKET = Uint8Array.from([0x30, 0x07, 0x00, 0x03, 0x61, 0x2f, 0x62, 0x68, 0x69]);

const CONNACK_ACCEPTED = Uint8Array.from([0x20, 0x02, 0x00, 0x00]);

interface FakeSource extends ByteSource {
  /** Sürücünün sokete yazdığı paketler, sırasıyla. */
  readonly written: readonly Uint8Array[];
  readonly stopCount: number;
  push(bytes: Uint8Array): void;
  emitStatus(status: 'connected' | 'idle'): void;
  emitError(message: string): void;
}

interface FakeSourceOptions {
  /** `start()` çağrılır çağrılmaz, HENÜZ beklemeye geçilmeden koşar (senkron olay yolu). */
  readonly onStart?: (source: FakeSource, handlers: ByteSourceHandlers) => void;
  readonly failStart?: string;
  readonly failWriteAt?: number;
}

function createFakeSource(options: FakeSourceOptions = {}): FakeSource {
  const written: Uint8Array[] = [];
  let handlers: ByteSourceHandlers | undefined;
  let stopCount = 0;

  const source: FakeSource = {
    kind: 'websocket',
    canWrite: true,

    get written() {
      return written;
    },
    get stopCount() {
      return stopCount;
    },

    async start(given) {
      handlers = given;
      if (options.failStart !== undefined) throw new Error(options.failStart);
      options.onStart?.(source, given);
      return Promise.resolve();
    },

    async stop() {
      stopCount += 1;
      return Promise.resolve();
    },

    async write(bytes) {
      if (options.failWriteAt === written.length) throw new Error('soket düştü');
      written.push(bytes);
      return Promise.resolve();
    },

    push(bytes) {
      handlers?.onChunk(bytes, 0);
    },
    emitStatus(status) {
      handlers?.onStatus(status);
    },
    emitError(message) {
      handlers?.onError({ code: 'open-failed', message });
    },
  };

  return source;
}

/** Bağlanıp CONNACK'i veren varsayılan broker davranışı. */
function acceptingBroker(connack: Uint8Array = CONNACK_ACCEPTED) {
  return (source: FakeSource, handlers: ByteSourceHandlers): void => {
    handlers.onStatus('connected');
    // CONNACK ancak CONNECT yazıldıktan SONRA gelmeli; sürücü o sırada
    // beklemeye geçmiş olur.
    queueMicrotask(() => {
      source.push(connack);
    });
  };
}

describe('publishMqttPacket', () => {
  it('walks connect → CONNECT → CONNACK → PUBLISH → DISCONNECT and closes the socket', async () => {
    const source = createFakeSource({ onStart: acceptingBroker() });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome).toEqual({ ok: true, sessionPresent: false });
    expect(source.written).toHaveLength(3);

    // Telden çıkan ilk paketi deponun KENDİ çözücüsü okuyor: sürücü uydurma
    // bayt yazmadı.
    const [connect, published, disconnect] = source.written;
    const parsed = mqttParser.parse(connect ?? new Uint8Array(0));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('unreachable');
    const packetType = parsed.frame.fields.find((field) => field.id === 'packet-type');
    expect(packetType?.physicalValue).toBe('CONNECT');

    // PUBLISH baytları DEĞİŞTİRİLMEDEN geçiyor: paketi encoder yazdı, sürücü taşıdı.
    expect(published).toEqual(PUBLISH_PACKET);
    expect(disconnect).toEqual(Uint8Array.from([0xe0, 0x00]));
    expect(source.stopCount).toBe(1);
  });

  it('reports the broker refusal with its own return code instead of a generic failure', async () => {
    // Return code 5 = "Connection Refused, not authorized" (OASIS §3.2.2.3).
    const source = createFakeSource({ onStart: acceptingBroker(Uint8Array.from([0x20, 0x02, 0x00, 0x05])) });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connack-rejected');
    expect(outcome.connack?.returnCode).toBe(5);
    expect(outcome.connack?.description).toBe('Connection Refused, not authorized');

    // Reddedilen bir oturuma PUBLISH YAZILMAZ — yalnız CONNECT çıkmış olmalı.
    expect(source.written).toHaveLength(1);
    expect(source.stopCount).toBe(1);
  });

  it('carries the session present bit up from CONNACK', async () => {
    const source = createFakeSource({ onStart: acceptingBroker(Uint8Array.from([0x20, 0x02, 0x01, 0x00])) });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome).toEqual({ ok: true, sessionPresent: true });
  });

  /** OASIS §6: WebSocket çerçevesi MQTT paketiyle hizalı değildir. */
  it('accepts a CONNACK split across two chunks', async () => {
    const source = createFakeSource({
      onStart: (fake, handlers) => {
        handlers.onStatus('connected');
        queueMicrotask(() => {
          fake.push(Uint8Array.from([0x20, 0x02]));
          fake.push(Uint8Array.from([0x00, 0x00]));
        });
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(true);
  });

  it('ignores a packet that is not a CONNACK and keeps waiting for one', async () => {
    const source = createFakeSource({
      onStart: (fake, handlers) => {
        handlers.onStatus('connected');
        queueMicrotask(() => {
          // PINGRESP — protokol konuşuluyor ama beklenen cevap bu değil.
          fake.push(Uint8Array.from([0xd0, 0x00]));
          fake.push(CONNACK_ACCEPTED);
        });
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(true);
  });

  it('times out on a broker that opens the socket and then says nothing', async () => {
    const source = createFakeSource({
      onStart: (_fake, handlers) => {
        handlers.onStatus('connected');
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome).toEqual({ ok: false, failure: 'connack-timeout' });
    expect(source.stopCount).toBe(1);
  });

  it('times out when the socket never opens', async () => {
    const source = createFakeSource();

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connect-failed');
    expect(source.written).toHaveLength(0);
  });

  /**
   * `webSocketSource.start()` geçersiz adreste `onError`ı SENKRON çağırır —
   * yani sürücü beklemeye geçmeden önce. Olay kuyruğa yazılmasaydı burada
   * zaman aşımı görürdük, sebebini söyleyen hata değil.
   */
  it('keeps an error raised synchronously inside start() instead of losing it', async () => {
    const source = createFakeSource({
      onStart: (_fake, handlers) => {
        handlers.onError({ code: 'open-failed', message: 'WebSocket adresi ws:// ya da wss:// olmalı' });
        handlers.onStatus('error');
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connect-failed');
    expect(outcome.detail).toContain('ws://');
  });

  it('surfaces a start() throw as a connect failure', async () => {
    const source = createFakeSource({ failStart: 'Bu ortamda WebSocket yok.' });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome).toEqual({ ok: false, failure: 'connect-failed', detail: 'Bu ortamda WebSocket yok.' });
    expect(source.stopCount).toBe(1);
  });

  /** Ret bildirimini CONNACK yerine sessiz kapanışla yapan broker'lar var. */
  it('separates a silent close from a refusal', async () => {
    const source = createFakeSource({
      onStart: (fake, handlers) => {
        handlers.onStatus('connected');
        queueMicrotask(() => {
          fake.emitStatus('idle');
        });
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome).toEqual({ ok: false, failure: 'closed-early' });
  });

  it('reports an unreadable CONNACK apart from a refusal', async () => {
    const source = createFakeSource({
      onStart: (fake, handlers) => {
        handlers.onStatus('connected');
        queueMicrotask(() => {
          // Remaining Length 1: CONNACK'in iki bilgi baytı sığmıyor.
          fake.push(Uint8Array.from([0x20, 0x01, 0x00]));
        });
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connack-malformed');
    expect(outcome.detail).toBe('too-short');
  });

  it('reports a malformed stream rather than trying to resynchronise', async () => {
    const source = createFakeSource({
      onStart: (fake, handlers) => {
        handlers.onStatus('connected');
        queueMicrotask(() => {
          fake.push(Uint8Array.from([0x20, 0xff, 0xff, 0xff, 0xff, 0x7f]));
        });
      },
    });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connack-malformed');
  });

  it('reports a write failure on the PUBLISH instead of claiming it was sent', async () => {
    // 0. yazma CONNECT'tir; 1. yazma PUBLISH.
    const source = createFakeSource({ onStart: acceptingBroker(), failWriteAt: 1 });

    const outcome = await publishMqttPacket({
      source,
      clientId: 'alp-comm-test',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('write-failed');
    expect(source.stopCount).toBe(1);
  });

  /** Geçersiz kimlikte soket HİÇ AÇILMAZ: açılmamış bağlantıyı kapatmak da gerekmez. */
  it('refuses an empty client id before opening the socket', async () => {
    const source = createFakeSource({ onStart: acceptingBroker() });

    const outcome = await publishMqttPacket({
      source,
      clientId: '',
      packet: PUBLISH_PACKET,
      timeoutMs: TIMEOUT_MS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.failure).toBe('connect-failed');
    expect(source.stopCount).toBe(0);
    expect(source.written).toHaveLength(0);
  });
});
