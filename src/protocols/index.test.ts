import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from './index';

/** `registeredProtocolIds()` ALFABETİK döner; liste o sırayla yazılır. */
const BUILT_IN_IDS = [
  'ais',
  'art-net',
  'at-commands',
  'bacnet-ip',
  'bacnet-mstp',
  'ble-advertisement',
  'ble-gatt',
  'can-2-0a',
  'can-2-0b',
  'can-fd',
  'can-xl',
  'canopen',
  'coap',
  'cobs',
  'dali',
  'dmx512',
  'dnp3',
  'doip',
  'ethercat',
  'ethernet-ii',
  'gnss-modem',
  'gnss-ubx',
  'hayes-command-set',
  'iec-60870-5-104',
  'iec-61850',
  'ieee-802-3',
  'ipv4',
  'ipv6',
  'iso-14230',
  'iso-9141',
  'iso-tp',
  'j1939',
  'kiss',
  'knx',
  'lin',
  'lorawan',
  'lte-modem-at',
  'm-bus',
  'matter',
  'mavlink',
  'modbus-ascii',
  'modbus-rtu',
  'modbus-tcp',
  'mqtt',
  'nb-iot',
  'nmea-0183',
  'nmea-2000',
  'obd-ii',
  'ppp',
  'rtcm',
  'sacn',
  'slip',
  'tcp',
  'udp',
  'uds',
  'vlan-802-1q',
  'zigbee',
];

const EXPECTED_CATEGORY: Record<string, string> = {
  ais: 'marine-navigation',
  'art-net': 'building-automation',
  'at-commands': 'interfaces-framing',
  'bacnet-ip': 'building-automation',
  'bacnet-mstp': 'building-automation',
  'ble-advertisement': 'wireless-iot',
  'ble-gatt': 'wireless-iot',
  'can-2-0a': 'automotive',
  'can-2-0b': 'automotive',
  'can-fd': 'automotive',
  'can-xl': 'automotive',
  canopen: 'industrial-automation',
  coap: 'network-ethernet',
  cobs: 'interfaces-framing',
  dali: 'building-automation',
  dmx512: 'building-automation',
  dnp3: 'industrial-automation',
  doip: 'automotive',
  ethercat: 'industrial-automation',
  'ethernet-ii': 'network-ethernet',
  'gnss-modem': 'wireless-iot',
  'gnss-ubx': 'marine-navigation',
  'hayes-command-set': 'interfaces-framing',
  'iec-60870-5-104': 'industrial-automation',
  'iec-61850': 'industrial-automation',
  'ieee-802-3': 'network-ethernet',
  ipv4: 'network-ethernet',
  ipv6: 'network-ethernet',
  'iso-14230': 'automotive',
  'iso-9141': 'automotive',
  'iso-tp': 'automotive',
  j1939: 'automotive',
  kiss: 'interfaces-framing',
  knx: 'building-automation',
  lin: 'automotive',
  lorawan: 'wireless-iot',
  'lte-modem-at': 'wireless-iot',
  'm-bus': 'industrial-automation',
  matter: 'wireless-iot',
  mavlink: 'aerospace-uav',
  'modbus-ascii': 'industrial-automation',
  'modbus-rtu': 'industrial-automation',
  'modbus-tcp': 'industrial-automation',
  mqtt: 'network-ethernet',
  'nb-iot': 'wireless-iot',
  'nmea-0183': 'marine-navigation',
  'nmea-2000': 'marine-navigation',
  'obd-ii': 'automotive',
  ppp: 'interfaces-framing',
  rtcm: 'marine-navigation',
  sacn: 'building-automation',
  slip: 'interfaces-framing',
  tcp: 'network-ethernet',
  udp: 'network-ethernet',
  uds: 'automotive',
  'vlan-802-1q': 'network-ethernet',
  zigbee: 'wireless-iot',
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
    // Varsayılan 5000ms, kayıt büyüdükçe (her dalga +birkaç dynamic import)
    // tam paket koşusunda worker rekabeti altında marjinal hâle geliyordu —
    // izolasyonda <500ms, tam pakette gözlemlenen bir kez 5000ms'yi aştı.
  }, 15000);
});
