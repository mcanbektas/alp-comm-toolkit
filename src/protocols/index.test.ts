import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from './index';

/** `registeredProtocolIds()` ALFABETİK döner; liste o sırayla yazılır. */
const BUILT_IN_IDS = [
  'ais',
  'can-2-0a',
  'can-2-0b',
  'can-fd',
  'can-xl',
  'canopen',
  'doip',
  'gnss-ubx',
  'iso-14230',
  'iso-9141',
  'iso-tp',
  'j1939',
  'lin',
  'mavlink',
  'modbus-ascii',
  'modbus-rtu',
  'modbus-tcp',
  'nmea-0183',
  'nmea-2000',
  'obd-ii',
  'rtcm',
  'uds',
];

const EXPECTED_CATEGORY: Record<string, string> = {
  ais: 'marine-navigation',
  'can-2-0a': 'automotive',
  'can-2-0b': 'automotive',
  'can-fd': 'automotive',
  'can-xl': 'automotive',
  canopen: 'industrial-automation',
  doip: 'automotive',
  'gnss-ubx': 'marine-navigation',
  'iso-14230': 'automotive',
  'iso-9141': 'automotive',
  'iso-tp': 'automotive',
  j1939: 'automotive',
  lin: 'automotive',
  mavlink: 'aerospace-uav',
  'modbus-ascii': 'industrial-automation',
  'modbus-rtu': 'industrial-automation',
  'modbus-tcp': 'industrial-automation',
  'nmea-0183': 'marine-navigation',
  'nmea-2000': 'marine-navigation',
  'obd-ii': 'automotive',
  rtcm: 'marine-navigation',
  uds: 'automotive',
};

describe('registerBuiltInProtocols', () => {
  it('registers every built-in engine', () => {
    const registry = createProtocolRegistry();
    registerBuiltInProtocols(registry);

    expect(registry.registeredProtocolIds()).toEqual(BUILT_IN_IDS);
  });

  it('stays quiet on a second call — StrictMode runs startup effects twice', () => {
    const registry = createProtocolRegistry();
    registerBuiltInProtocols(registry);

    expect(() => registerBuiltInProtocols(registry)).not.toThrow();
    expect(registry.registeredProtocolIds()).toEqual(BUILT_IN_IDS);
  });

  it('does not load any module while registering', () => {
    const registry = createProtocolRegistry();
    registerBuiltInProtocols(registry);

    // Lazy sözleşmesi: kayıt ucuz, yükleme talep üzerine. Loader kayıt anında
    // koşsaydı açılışta üç parser da indirilirdi.
    for (const id of BUILT_IN_IDS) {
      expect(registry.getLoadedPlugin(id), id).toBeUndefined();
    }
  });

  it('loads the real plugin behind each id', async () => {
    const registry = createProtocolRegistry();
    registerBuiltInProtocols(registry);

    for (const id of BUILT_IN_IDS) {
      const plugin = await registry.loadProtocolPlugin(id);
      // Registry yüklenen modülün id'sini kayıt anahtarıyla karşılaştırır; buraya
      // gelmek kayıt ile modülün eşleştiğinin de kanıtıdır.
      expect(plugin.id, id).toBe(id);
      expect(plugin.category, id).toBe(EXPECTED_CATEGORY[id]);
      expect(plugin.exampleFrames.length, `${id} has no example frames`).toBeGreaterThan(0);
      expect(registry.getLoadedPlugin(id), id).toBe(plugin);
    }
  });
});
