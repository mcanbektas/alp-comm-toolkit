import { describe, expect, it } from 'vitest';

import { encodeCobsFrame } from '@/protocol-core/framing/cobs';
import { encodeSlip } from '@/protocol-core/framing/slip';
import { createProtocolRegistry } from '@/protocol-core/registry';
import type { ProtocolPlugin } from '@/protocol-core/types';

import { ENCODER_CATALOG, VALUES_ENCODERS, findEncoderEntry } from './encoderCatalog';
import { registerBuiltInProtocols } from './index';

/**
 * Defter kopya bir listedir; kopyanın bedeli ayrışmadır. Bu dosya ayrışmayı
 * DERLEMEDE değil TESTTE yakalar (bkz. `encoderCatalog.ts` dosya başı):
 * `encoder:` taşıyan her plugin defterde olmak, defterdeki her kayıt gerçek
 * bir encoder'a denk gelmek zorunda. Tek yönlü bir kontrol yetmezdi — eksik
 * kayıt ekranı sessizce eksiltir, fazla kayıt seçilince çöker.
 */

const registry = createProtocolRegistry();
registerBuiltInProtocols(registry);

async function loadAllPlugins(): Promise<readonly ProtocolPlugin[]> {
  return Promise.all(registry.registeredProtocolIds().map((id) => registry.loadProtocolPlugin(id)));
}

/** Yerleşik karşılığın doğruluğunu İDDİA etmek yetmez; aynı baytı üretmeli. */
const EQUIVALENCE_PAYLOAD = Uint8Array.from([0x00, 0x11, 0xc0, 0xdb, 0xff]);

describe('encoder catalog', () => {
  it('lists every plugin that ships an encoder, and nothing else', async () => {
    const plugins = await loadAllPlugins();

    const withEncoder = plugins.filter((plugin) => plugin.encoder !== undefined).map((plugin) => plugin.id);
    const catalogued = ENCODER_CATALOG.map((entry) => entry.pluginId);

    expect([...catalogued].sort()).toEqual([...withEncoder].sort());
  });

  it('carries the plugin display name verbatim', async () => {
    const plugins = await loadAllPlugins();

    for (const entry of ENCODER_CATALOG) {
      const plugin = plugins.find((candidate) => candidate.id === entry.pluginId);
      expect(plugin, entry.pluginId).toBeDefined();
      expect(plugin?.name, entry.pluginId).toBe(entry.displayName);
    }
  });

  it('produces the same bytes as the built-in branch it claims to equal', async () => {
    const builtIns = {
      cobs: encodeCobsFrame,
      slip: encodeSlip,
    } as const;

    for (const entry of ENCODER_CATALOG) {
      if (entry.role !== 'payload' || entry.builtInEquivalent === undefined) {
        continue;
      }
      const plugin = await registry.loadProtocolPlugin(entry.pluginId);
      const fromPlugin = plugin.encoder?.encode(EQUIVALENCE_PAYLOAD);

      expect(fromPlugin, entry.pluginId).toEqual(builtIns[entry.builtInEquivalent](EQUIVALENCE_PAYLOAD));
    }
  });

  it('loads a schema for every values encoder', async () => {
    for (const entry of VALUES_ENCODERS) {
      const definition = await entry.load();

      expect(definition.schema.fields.length, entry.pluginId).toBeGreaterThan(0);
    }
  });

  /**
   * Tohum, encoder'ın KENDİ varsayılanını tekrar etmelidir. Ayrışırsa form
   * varsayılanı kabloya çıkan çerçeveyi sessizce değiştirirdi — tam olarak
   * tohumun engellemek için var olduğu şey.
   */
  it('seeds only values the encoder would have defaulted to anyway', async () => {
    for (const entry of VALUES_ENCODERS) {
      const definition = await entry.load();
      if (definition.seedValues === undefined) {
        continue;
      }
      const plugin = await registry.loadProtocolPlugin(entry.pluginId);

      const seeded: Record<string, Uint8Array> = {};
      for (const [path, hex] of Object.entries(definition.seedValues)) {
        const bytes = hex.match(/../g) ?? [];
        seeded[path] = Uint8Array.from(bytes.map((pair) => Number.parseInt(pair, 16)));
      }

      expect(plugin.encoder?.encode(seeded), entry.pluginId).toEqual(plugin.encoder?.encode({}));
    }
  });

  it('finds entries by plugin id', () => {
    expect(findEncoderEntry('slip')?.role).toBe('payload');
    expect(findEncoderEntry('ascii-protocol')?.role).toBe('values');
    expect(findEncoderEntry('modbus-rtu')?.role).toBe('payload');
    // Encoder taşımayan bir plugin defterde de yoktur.
    expect(findEncoderEntry('nmea-0183')).toBeUndefined();
  });
});
