import { describe, expect, it, vi } from 'vitest';

import { createProtocolRegistry, ProtocolRegistryError } from './registry';
import { createRawFrame, isParseSuccess } from './types';
import type { ParseResult, ProtocolPlugin } from './types';

function makePlugin(id: string): ProtocolPlugin {
  return {
    id,
    name: `Plugin ${id}`,
    category: 'industrial-automation',
    exampleFrames: [],
  };
}

/** Loader'ı testin istediği anda çözebilmek için elle kontrol edilen promise. */
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createProtocolRegistry', () => {
  it('does not invoke the loader at registration time', () => {
    const registry = createProtocolRegistry();
    const loader = vi.fn(() => Promise.resolve(makePlugin('modbus-rtu')));

    registry.registerProtocolPlugin('modbus-rtu', loader);

    expect(loader).not.toHaveBeenCalled();
    expect(registry.isProtocolRegistered('modbus-rtu')).toBe(true);
    expect(registry.getLoadedPlugin('modbus-rtu')).toBeUndefined();
  });

  it('lists registered ids in a deterministic order', () => {
    const registry = createProtocolRegistry();
    registry.registerProtocolPlugin('nmea-0183', () => Promise.resolve(makePlugin('nmea-0183')));
    registry.registerProtocolPlugin('can-2-0', () => Promise.resolve(makePlugin('can-2-0')));

    expect(registry.registeredProtocolIds()).toEqual(['can-2-0', 'nmea-0183']);
  });

  it('runs the loader once for concurrent load calls', async () => {
    const registry = createProtocolRegistry();
    const deferred = createDeferred<ProtocolPlugin>();
    const loader = vi.fn(() => deferred.promise);
    registry.registerProtocolPlugin('j1939', loader);

    const first = registry.loadProtocolPlugin('j1939');
    const second = registry.loadProtocolPlugin('j1939');
    expect(loader).toHaveBeenCalledTimes(1);

    deferred.resolve(makePlugin('j1939'));
    const [pluginA, pluginB] = await Promise.all([first, second]);

    expect(loader).toHaveBeenCalledTimes(1);
    // Tek nesne dolaşmalı: iki farklı örnek, iki farklı parser durumu demektir.
    expect(pluginA).toBe(pluginB);
  });

  it('caches a successful load and serves it synchronously afterwards', async () => {
    const registry = createProtocolRegistry();
    const loader = vi.fn(() => Promise.resolve(makePlugin('lin')));
    registry.registerProtocolPlugin('lin', loader);

    const plugin = await registry.loadProtocolPlugin('lin');
    await registry.loadProtocolPlugin('lin');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(registry.getLoadedPlugin('lin')).toBe(plugin);
  });

  it('unwraps a module namespace default export', async () => {
    const registry = createProtocolRegistry();
    registry.registerProtocolPlugin('mavlink', () =>
      Promise.resolve({ default: makePlugin('mavlink') }),
    );

    const plugin = await registry.loadProtocolPlugin('mavlink');

    expect(plugin.id).toBe('mavlink');
  });

  it('rejects a duplicate registration instead of overwriting', () => {
    const registry = createProtocolRegistry();
    const first = vi.fn(() => Promise.resolve(makePlugin('canopen')));
    const second = vi.fn(() => Promise.resolve(makePlugin('canopen')));
    registry.registerProtocolPlugin('canopen', first);

    expect(() => registry.registerProtocolPlugin('canopen', second)).toThrow(ProtocolRegistryError);
    expect(() => registry.registerProtocolPlugin('canopen', second)).toThrow(/already registered/);
  });

  it('does not cache a failed load and retries on the next call', async () => {
    const registry = createProtocolRegistry();
    const loader = vi
      .fn<() => Promise<ProtocolPlugin>>()
      .mockRejectedValueOnce(new Error('chunk load failed'))
      .mockResolvedValueOnce(makePlugin('arinc-429'));
    registry.registerProtocolPlugin('arinc-429', loader);

    await expect(registry.loadProtocolPlugin('arinc-429')).rejects.toThrow('chunk load failed');
    expect(registry.getLoadedPlugin('arinc-429')).toBeUndefined();

    const plugin = await registry.loadProtocolPlugin('arinc-429');

    expect(loader).toHaveBeenCalledTimes(2);
    expect(plugin.id).toBe('arinc-429');
  });

  it('turns a synchronously throwing loader into a rejection', async () => {
    const registry = createProtocolRegistry();
    registry.registerProtocolPlugin('sent', () => {
      throw new Error('broken loader');
    });

    await expect(registry.loadProtocolPlugin('sent')).rejects.toThrow('broken loader');
    // Uçuş kaydı hiç kurulmadığı için sonraki deneme yine loader'a gider.
    expect(registry.getLoadedPlugin('sent')).toBeUndefined();
  });

  it('reports an unknown protocol id with a distinguishable error code', async () => {
    const registry = createProtocolRegistry();
    registry.registerProtocolPlugin('dali', () => Promise.resolve(makePlugin('dali')));

    const failure = await registry.loadProtocolPlugin('knx').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProtocolRegistryError);
    expect((failure as ProtocolRegistryError).code).toBe('unknown-protocol');
    expect((failure as ProtocolRegistryError).message).toContain('knx');
  });

  it('rejects when the loaded plugin reports a different id', async () => {
    const registry = createProtocolRegistry();
    registry.registerProtocolPlugin('bacnet-ip', () => Promise.resolve(makePlugin('bacnet-mstp')));

    const failure = await registry.loadProtocolPlugin('bacnet-ip').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProtocolRegistryError);
    expect((failure as ProtocolRegistryError).code).toBe('plugin-id-mismatch');
    expect(registry.getLoadedPlugin('bacnet-ip')).toBeUndefined();
  });
});

describe('protocol-core helpers', () => {
  it('narrows a parse result through isParseSuccess', () => {
    const failure: ParseResult = {
      success: false,
      error: { code: 'crc-mismatch', message: 'CRC mismatch' },
      consumedBytes: 2,
      recoverable: true,
    };

    expect(isParseSuccess(failure)).toBe(false);
    if (!isParseSuccess(failure)) {
      expect(failure.error.code).toBe('crc-mismatch');
    }
  });

  it('creates a raw frame with a unique id and a monotonic timestamp', () => {
    const bytes = Uint8Array.of(0x01, 0x03, 0x00, 0x00);

    const first = createRawFrame(bytes);
    const second = createRawFrame(bytes, { direction: 'tx', channel: 'COM3' });

    expect(first.id).not.toBe(second.id);
    expect(first.direction).toBe('rx');
    expect(second.direction).toBe('tx');
    expect(second.channel).toBe('COM3');
    expect(Number.isFinite(first.timestamp)).toBe(true);
    expect(second.timestamp).toBeGreaterThanOrEqual(first.timestamp);
    // Opsiyoneller yalnız verildiğinde yazılır — boş anahtar serileştirmeyi kirletir.
    expect('channel' in first).toBe(false);
    expect('metadata' in first).toBe(false);
  });

  it('keeps the caller byte buffer by reference without copying', () => {
    const bytes = Uint8Array.of(0xaa, 0x55);

    expect(createRawFrame(bytes).bytes).toBe(bytes);
  });
});
