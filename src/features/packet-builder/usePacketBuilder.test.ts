import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import type { ByteSource, ByteSourceHandlers, ConnectionError } from '@/connection/types';
import type { SerialConnectionOptions } from '@/connection/serial/serialOptions';
import type { WebSerialPort } from '@/connection/serial/webSerialTypes';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import {
  SPEC_BUILDER_FRAME,
  SPEC_SENSOR_PROTOCOL_JSON,
} from '@/protocol-core/schemas/specFixture';

import { protocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '@/protocols';
import { asciiProtocolPlugin } from '@/protocols/serial/framing/asciiProtocol';
import { encodeHdlcSyncFrame } from '@/protocols/serial/framing/hdlcCore';
import { rfTelemetryPlugin } from '@/protocols/wireless/rftelemetry/rfTelemetry';

import { usePacketBuilder } from './usePacketBuilder';

// Hook motorları global registry'den yükler; üretimde `main.tsx` kaydeder.
registerBuiltInProtocols(protocolRegistry);

/**
 * Bağlantı katmanı BÜTÜNÜYLE sahte: gerçek Web Serial jsdom'da yok ve
 * `createSimulatedSource` kendi `setInterval`ını kurup her teste veri sızdırır.
 * Sahte kaynak `ByteSource` sözleşmesini birebir gerçekler, yani hook'un
 * gördüğü şey üretimdekiyle aynı biçimdedir.
 */
const holder = vi.hoisted(() => ({
  createSerialSource: vi.fn(),
  createSimulatedSource: vi.fn(),
  requestSerialPort: vi.fn(),
}));

vi.mock('@/connection/serial/serialSource', () => ({
  createSerialSource: holder.createSerialSource,
}));

vi.mock('@/connection/mock/simulatedSource', () => ({
  createSimulatedSource: holder.createSimulatedSource,
}));

vi.mock('@/connection/serial/webSerialTypes', () => ({
  requestSerialPort: holder.requestSerialPort,
  isWebSerialSupported: () => true,
}));

// --- localStorage sahtesi -------------------------------------------------

/**
 * jsdom'un depolaması test dosyası boyunca PAYLAŞILIR; bellek içi bir kopya
 * her testte sıfırlanabilir (`useProtocolStudio.test.ts` ile aynı gerekçe).
 */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

const memoryStorage = createMemoryStorage();
Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

// --- Sahte kaynak ---------------------------------------------------------

interface FakeSourceOptions {
  readonly canWrite: boolean;
  /** `start` sırasında bildirilecek hata; verilirse bağlantı kurulmaz. */
  readonly openError?: ConnectionError;
  readonly writeError?: Error;
  /** Yazma sonrası geri gönderilecek yanıt (makrogörev olarak yayılır). */
  readonly respondWith?: Uint8Array;
}

interface FakeSource {
  readonly source: ByteSource;
  readonly writes: Uint8Array[];
  stopCount: () => number;
}

function createFakeSource(options: FakeSourceOptions): FakeSource {
  const writes: Uint8Array[] = [];
  let handlers: ByteSourceHandlers | undefined;
  let stopCount = 0;

  const source: ByteSource = {
    kind: 'web-serial',
    canWrite: options.canWrite,

    async start(next: ByteSourceHandlers): Promise<void> {
      handlers = next;
      next.onStatus('connecting');
      if (options.openError !== undefined) {
        next.onError(options.openError);
        next.onStatus('error');
        return;
      }
      next.onStatus('connected');
    },

    async stop(): Promise<void> {
      stopCount += 1;
    },

    async write(bytes: Uint8Array): Promise<void> {
      if (options.writeError !== undefined) {
        throw options.writeError;
      }
      writes.push(bytes);
      const response = options.respondWith;
      if (response !== undefined) {
        // Makrogörev: `waitForResponse` ancak `write` çözüldükten SONRA abone
        // olur, senkron yayın dinleyicisiz kalırdı.
        setTimeout(() => {
          handlers?.onChunk(response, 0);
        }, 0);
      }
    },
  };

  return { source, writes, stopCount: () => stopCount };
}

const FAKE_PORT: WebSerialPort = {
  readable: null,
  writable: null,
  async open(): Promise<void> {
    // Sahte kaynak port'u hiç açmıyor; nesne yalnız `createSerialSource`a geçiyor.
  },
  async close(): Promise<void> {
    // Aynı gerekçe.
  },
  getInfo() {
    return {};
  },
};

function useFakeSerial(fake: FakeSource): void {
  holder.requestSerialPort.mockResolvedValue(FAKE_PORT);
  holder.createSerialSource.mockImplementation(
    (_port: WebSerialPort, _options: SerialConnectionOptions) => fake.source,
  );
}

/** Bekleyen makrogörevleri (yanıt yayını, `waitForResponse` zamanlayıcısı) boşaltır. */
async function flush(ms = 10): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// --- Fixture'lar ----------------------------------------------------------

/** `sequenceCounter` taşıyan asgari protokol — sayaç ilerlemesini sınamak için. */
const SEQUENCE_PROTOCOL_JSON = JSON.stringify({
  name: 'Sequence Probe',
  version: '1.0',
  framing: { type: 'none', maximumFrameLength: 16 },
  fields: [
    { id: 'counter', name: 'Counter', type: 'sequenceCounter', offset: 0, length: 1 },
    { id: 'value', name: 'Value', type: 'uint8', offset: 1, length: 1 },
  ],
});

beforeEach(() => {
  memoryStorage.clear();
  holder.createSerialSource.mockReset();
  holder.createSimulatedSource.mockReset();
  holder.requestSerialPort.mockReset();
  useProtocolSchemaStore.setState({ schemaJson: SPEC_SENSOR_PROTOCOL_JSON });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Spec §10 örneği: Set Output, kanal 2, %75 duty. */
function fillSpecBuilderValues(setValue: (path: string, value: string) => void): void {
  setValue('address', '5');
  setValue('command', '32');
  setValue('payload', '024B');
}

describe('usePacketBuilder', () => {
  it('opens with the schema published by the shared protocol store', () => {
    const { result } = renderHook(() => usePacketBuilder());

    expect(result.current.schema?.name).toBe('ALP Sensor Protocol');
    expect(result.current.schemaErrorKey).toBeNull();
    expect(result.current.fields.map((field) => field.path)).toEqual([
      'address',
      'command',
      'payloadLength',
      'payload',
      'checksum',
    ]);
  });

  it('seeds the form with usable defaults and leaves derived fields out of the values', () => {
    const { result } = renderHook(() => usePacketBuilder());

    expect(result.current.values.address).toBe('0');
    // Enum ilk anahtarına düşer; boş bir seçim kutusu gösterilmez.
    expect(result.current.values.command).toBe('16');
    expect(result.current.values.payload).toBe('');
    expect(Object.keys(result.current.values)).not.toContain('payloadLength');
    expect(Object.keys(result.current.values)).not.toContain('checksum');
  });

  it('reports a broken schema instead of throwing', () => {
    useProtocolSchemaStore.setState({ schemaJson: '{"name":"broken"}' });

    const { result } = renderHook(() => usePacketBuilder());

    expect(result.current.schema).toBeNull();
    expect(result.current.schemaErrorKey).toBe('builder.error.invalidSchema');
    expect(result.current.fields).toHaveLength(0);
    expect(result.current.buildResult).toBeNull();
    expect(result.current.outgoingBytes).toBeNull();
  });

  it('builds the spec §10 packet from the form values', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
    });

    expect(result.current.buildResult?.ok).toBe(true);
    expect(result.current.outgoingBytes).toEqual(SPEC_BUILDER_FRAME);
  });

  it('turns an unparseable numeric entry into an issue and refuses to emit bytes', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setValue('address', 'not-a-number');
    });

    expect(result.current.buildResult?.ok).toBe(false);
    expect(result.current.buildResult?.issues).toContainEqual({
      fieldId: 'address',
      messageKey: 'builder.issue.invalidValue',
      params: { detail: 'not-a-number' },
    });
    expect(result.current.outgoingBytes).toBeNull();
  });

  it('clamps stepping at the field range instead of wrapping', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setValue('address', '255');
    });
    act(() => {
      result.current.stepValue('address', 1);
    });
    expect(result.current.values.address).toBe('255');

    act(() => {
      result.current.stepValue('address', -1);
    });
    expect(result.current.values.address).toBe('254');
  });

  it('ignores stepping on derived fields', () => {
    const { result } = renderHook(() => usePacketBuilder());
    const before = result.current.values;

    act(() => {
      result.current.stepValue('checksum', 1);
    });

    expect(result.current.values).toBe(before);
  });

  it('randomizes editable numeric fields and never touches derived ones', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.randomize();
    });

    const address = Number(result.current.values.address);
    expect(Number.isInteger(address)).toBe(true);
    expect(address).toBeGreaterThanOrEqual(0);
    expect(address).toBeLessThanOrEqual(255);
    expect(Object.keys(result.current.values)).not.toContain('checksum');
  });

  it('sends the hex override instead of the form when it is set', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
    });
    act(() => {
      result.current.setHexOverride('DEADBEEF');
    });

    expect(result.current.outgoingBytes).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));

    act(() => {
      result.current.setHexOverride(null);
    });
    expect(result.current.outgoingBytes).toEqual(SPEC_BUILDER_FRAME);
  });

  it('rejects an invalid hex override with builder.error.invalidHex', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setHexOverride('ZZ');
    });

    expect(result.current.outgoingBytes).toBeNull();
    expect(result.current.buildResult?.ok).toBe(false);
    expect(result.current.buildResult?.issues).toContainEqual({
      fieldId: null,
      messageKey: 'builder.error.invalidHex',
    });
  });

  it('applies post processing on top of the raw frame', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
    });
    act(() => {
      result.current.setPostProcessing('slip');
    });

    const build = result.current.buildResult;
    expect(build?.rawFrame).toEqual(SPEC_BUILDER_FRAME);
    // SLIP kendi sonlandırıcılarını ekler; ham çerçeve DEĞİŞMEDEN durmalı.
    expect(build?.framedBytes?.length).toBeGreaterThan(SPEC_BUILDER_FRAME.length);
  });

  it('connects to a read-only source and marks it as unable to write', async () => {
    const fake = createFakeSource({ canWrite: false });
    holder.createSimulatedSource.mockReturnValue(fake.source);

    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      await result.current.connect('simulated');
    });

    expect(result.current.connection.status).toBe('connected');
    expect(result.current.connection.kind).toBe('simulated');
    expect(result.current.connection.canWrite).toBe(false);
  });

  it('refuses to send over a source that cannot write', async () => {
    const fake = createFakeSource({ canWrite: false });
    holder.createSimulatedSource.mockReturnValue(fake.source);

    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      await result.current.connect('simulated');
    });
    act(() => {
      result.current.send();
    });

    expect(result.current.connection.errorKey).toBe('builder.error.cannotWrite');
    expect(result.current.scheduler.running).toBe(false);
    expect(fake.writes).toHaveLength(0);
  });

  it('writes the built packet once in the "once" mode', async () => {
    const fake = createFakeSource({ canWrite: true });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
      result.current.setResponseTimeoutMs(0);
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush();
    });

    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]).toEqual(SPEC_BUILDER_FRAME);
    expect(result.current.scheduler.sentCount).toBe(1);
    expect(result.current.scheduler.running).toBe(false);
  });

  it('advances the sequence counter on every send', async () => {
    useProtocolSchemaStore.setState({ schemaJson: SEQUENCE_PROTOCOL_JSON });
    const fake = createFakeSource({ canWrite: true });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setResponseTimeoutMs(0);
      result.current.setSchedulerConfig({ mode: 'count', intervalMs: 10, count: 3 });
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush(120);
    });

    expect(fake.writes).toHaveLength(3);
    expect(fake.writes.map((frame) => frame[0])).toEqual([0, 1, 2]);
    // Form da sayacı gösterir; gönderilen paketle ekran ayrışmaz.
    expect(result.current.values.counter).toBe('2');
  });

  it('captures the reply that arrives inside the response window', async () => {
    const reply = Uint8Array.from([0xaa, 0x01, 0x55]);
    const fake = createFakeSource({ canWrite: true, respondWith: reply });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
      result.current.setResponseTimeoutMs(200);
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush(50);
    });

    expect(result.current.lastResponse).not.toBeNull();
    expect(bytesToHex(result.current.lastResponse ?? new Uint8Array(0))).toBe('AA0155');
  });

  it('treats a missing reply as null, not as an error', async () => {
    const fake = createFakeSource({ canWrite: true });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
      result.current.setResponseTimeoutMs(0);
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush();
    });

    expect(result.current.lastResponse).toBeNull();
    expect(result.current.scheduler.sentCount).toBe(1);
    expect(result.current.scheduler.lastErrorKey).toBeNull();
  });

  it('stops the loop and keeps the error key when a write fails', async () => {
    const fake = createFakeSource({ canWrite: true, writeError: new Error('device gone') });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
      result.current.setSchedulerConfig({ mode: 'periodic', intervalMs: 10, count: 1 });
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush(60);
    });

    expect(result.current.scheduler.running).toBe(false);
    expect(result.current.scheduler.sentCount).toBe(0);
    expect(result.current.scheduler.lastErrorKey).toBe('packetBuilder.scheduler.errors.sendFailed');
  });

  it('names the busy port when another owner already holds it', async () => {
    const fake = createFakeSource({
      canWrite: true,
      openError: { code: 'open-failed', message: 'InvalidStateError: The port is already open.' },
    });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      await result.current.connect('serial');
    });

    expect(result.current.connection.status).toBe('error');
    expect(result.current.connection.errorKey).toBe('builder.error.portBusy');
  });

  it('reports an unsupported browser when the port cannot even be requested', async () => {
    holder.requestSerialPort.mockRejectedValue(new Error('web-serial-unsupported'));

    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      await result.current.connect('serial');
    });

    expect(result.current.connection.status).toBe('error');
    expect(result.current.connection.errorKey).toBe('builder.error.serialUnsupported');
  });

  it('closes the source on disconnect', async () => {
    const fake = createFakeSource({ canWrite: true });
    useFakeSerial(fake);

    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      await result.current.disconnect();
    });

    expect(fake.stopCount()).toBe(1);
    expect(result.current.connection.status).toBe('disconnected');
    expect(result.current.connection.kind).toBeNull();
    expect(result.current.connection.canWrite).toBe(false);
  });

  it('stops the scheduler and closes the source on unmount', async () => {
    const fake = createFakeSource({ canWrite: true });
    useFakeSerial(fake);

    const { result, unmount } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
      result.current.setResponseTimeoutMs(0);
      result.current.setSchedulerConfig({ mode: 'periodic', intervalMs: 10, count: 1 });
    });
    await act(async () => {
      await result.current.connect('serial');
    });
    await act(async () => {
      result.current.send();
      await flush(30);
    });

    const writesBeforeUnmount = fake.writes.length;
    expect(writesBeforeUnmount).toBeGreaterThan(0);

    unmount();
    await flush(60);

    // Spec §41: unmount'tan sonra tek bir gönderim daha olmamalı.
    expect(fake.writes).toHaveLength(writesBeforeUnmount);
    expect(fake.stopCount()).toBe(1);
  });

  it('rebuilds the form from the schema when it is reloaded', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setValue('address', '42');
    });
    expect(result.current.values.address).toBe('42');

    act(() => {
      result.current.reloadSchema();
    });
    expect(result.current.values.address).toBe('0');
  });

  it('keeps the scheduler configuration raw so partial entries stay editable', () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      result.current.setSchedulerConfig({ mode: 'periodic', intervalMs: 5, count: 1 });
    });

    // Kırpma `scheduler.start` içinde; form alanında "5" yazmak "50"nin ön adımıdır.
    expect(result.current.schedulerConfig.intervalMs).toBe(5);
    expect(result.current.responseTimeoutMs).toBe(500);
  });
});

/**
 * Plugin encoder yolu (spec §7). Registry LAZY olduğu için her seçim bir
 * `await` gerektirir; testler yüklemeyi `act` içinde bekler, çünkü asıl
 * sorulan şey "motor indikten sonra kabloya ne çıkıyor".
 */
describe('usePacketBuilder — plugin encoder', () => {
  it('wraps the schema frame in the selected plugin envelope', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    act(() => {
      fillSpecBuilderValues(result.current.setValue);
    });
    act(() => {
      result.current.setFramingPlugin('hdlc');
    });

    expect(result.current.postProcessing).toBe('plugin');
    expect(result.current.framingPluginId).toBe('hdlc');
    // Motor inene kadar paket ÜRETİLMEZ; yerleşik dala düşülmez.
    expect(result.current.outgoingBytes).toBeNull();

    await waitFor(() => {
      expect(result.current.outgoingBytes).not.toBeNull();
    });

    // Ham çerçeve DEĞİŞMEZ; zarf onun üstüne biner.
    expect(result.current.buildResult?.rawFrame).toEqual(SPEC_BUILDER_FRAME);
    expect(result.current.outgoingBytes).toEqual(encodeHdlcSyncFrame(SPEC_BUILDER_FRAME));
  });

  it('drops the plugin envelope when a built-in mode is picked again', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      result.current.setFramingPlugin('hdlc');
    });
    act(() => {
      result.current.setPostProcessing('none');
    });

    expect(result.current.framingPluginId).toBeNull();
    expect(result.current.postProcessing).toBe('none');
  });

  it('builds the frame with the plugin encoder instead of the store schema', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      result.current.setEncoderPlugin('ascii-protocol');
    });

    expect(result.current.schema?.name).toBe('ASCII Protocol Example');
    expect(result.current.fields.map((field) => field.path)).toEqual([
      'command',
      'parameters',
      'lineEnding',
    ]);

    act(() => {
      result.current.setValue('command', 'TEMP');
      result.current.setValue('parameters', ',25.3,40.2');
      result.current.setValue('lineEnding', '0D0A');
    });

    const encode = asciiProtocolPlugin.encoder?.encode;
    if (encode === undefined) {
      throw new Error('ascii-protocol encoder taşımıyor');
    }
    expect(result.current.outgoingBytes).toEqual(
      encode({ command: 'TEMP', parameters: ',25.3,40.2', lineEnding: Uint8Array.from([0x0d, 0x0a]) }),
    );
  });

  /**
   * Tohumun varlık sebebi: boş bir bayt alanı encoder'ın KENDİ varsayılanını
   * ezerdi ve çerçeve preamble'sız çıkardı.
   */
  it('seeds the form with the defaults the encoder would apply itself', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      result.current.setEncoderPlugin('rf-telemetry-custom-frame');
    });

    expect(result.current.values.preamble).toBe('AAAAAA');
    expect(result.current.values.syncWord).toBe('2DD4');
    expect(Array.from(result.current.outgoingBytes ?? [])).toEqual(
      Array.from(rfTelemetryPlugin.encoder?.encode({}) ?? []),
    );
  });

  it('returns to the store schema when the plugin source is cleared', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      result.current.setEncoderPlugin('ascii-protocol');
    });
    await act(async () => {
      result.current.setEncoderPlugin(null);
    });

    expect(result.current.encoderPluginId).toBeNull();
    expect(result.current.schema?.name).toBe('ALP Sensor Protocol');
  });

  it('reports an unknown encoder instead of silently building with the schema', async () => {
    const { result } = renderHook(() => usePacketBuilder());

    await act(async () => {
      result.current.setEncoderPlugin('modbus-rtu');
    });

    expect(result.current.encoderErrorKey).toBe('builder.error.encoderLoadFailed');
    // Seçim ayakta kaldığı sürece paket ÜRETİLMEZ: yanlış motorla bayt göndermek sessiz bir hata olurdu.
    expect(result.current.outgoingBytes).toBeNull();
  });
});
