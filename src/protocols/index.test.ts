import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from './index';

/** `registeredProtocolIds()` ALFABETİK döner; liste o sırayla yazılır. */
const BUILT_IN_IDS = [
  'ais',
  'arp',
  'art-net',
  'ascii-protocol',
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
  'cmos-uart',
  'coap',
  'cobs',
  'custom-binary-protocol',
  'dali',
  'delimiter-based-protocol',
  'dhcp',
  'dmx512',
  'dnp3',
  'dns',
  'doip',
  'ethercat',
  'ethernet-ii',
  'ethernet-interface',
  'ftp',
  'gnss-modem',
  'gnss-ubx',
  'hayes-command-set',
  'hdlc',
  'http',
  'i2c',
  'i3c',
  'icmp',
  'icmpv6',
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
  'length-based-protocol',
  'lin',
  'lldp',
  'lorawan',
  'lte-modem-at',
  'm-bus',
  'matter',
  'mavlink',
  'mdns',
  'microwire',
  'modbus-ascii',
  'modbus-rtu',
  'modbus-tcp',
  'mqtt',
  'mqtt-sn',
  'nb-iot',
  'nmea-0183',
  'nmea-2000',
  'ntp',
  'obd-ii',
  'octal-spi',
  'one-wire',
  'pmbus',
  'ppp',
  'ptp',
  'quad-spi',
  'rs-232',
  'rs-422',
  'rs-485',
  'rtcm',
  'rtcp',
  'rtp',
  'sacn',
  'sdlc',
  'slip',
  'smbus',
  'snmp',
  'spi',
  'syslog',
  'tcp',
  'telnet',
  'tftp',
  'ttl-uart',
  'uart',
  'udp',
  'uds',
  'usb',
  'vlan-802-1q',
  'websocket',
  'xmodem',
  'ymodem',
  'zigbee',
  'zmodem',
];

const EXPECTED_CATEGORY: Record<string, string> = {
  ais: 'marine-navigation',
  arp: 'network-ethernet',
  'art-net': 'building-automation',
  'ascii-protocol': 'interfaces-framing',
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
  'cmos-uart': 'interfaces-framing',
  coap: 'network-ethernet',
  cobs: 'interfaces-framing',
  'custom-binary-protocol': 'interfaces-framing',
  dali: 'building-automation',
  'delimiter-based-protocol': 'interfaces-framing',
  dhcp: 'network-ethernet',
  dmx512: 'building-automation',
  dnp3: 'industrial-automation',
  dns: 'network-ethernet',
  doip: 'automotive',
  ethercat: 'industrial-automation',
  'ethernet-interface': 'interfaces-framing',
  'ethernet-ii': 'network-ethernet',
  ftp: 'network-ethernet',
  'gnss-modem': 'wireless-iot',
  'gnss-ubx': 'marine-navigation',
  'hayes-command-set': 'interfaces-framing',
  hdlc: 'interfaces-framing',
  http: 'network-ethernet',
  i2c: 'interfaces-framing',
  icmp: 'network-ethernet',
  icmpv6: 'network-ethernet',
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
  'length-based-protocol': 'interfaces-framing',
  lldp: 'network-ethernet',
  lin: 'automotive',
  lorawan: 'wireless-iot',
  'lte-modem-at': 'wireless-iot',
  'm-bus': 'industrial-automation',
  mdns: 'network-ethernet',
  matter: 'wireless-iot',
  mavlink: 'aerospace-uav',
  'modbus-ascii': 'industrial-automation',
  'modbus-rtu': 'industrial-automation',
  'modbus-tcp': 'industrial-automation',
  mqtt: 'network-ethernet',
  'mqtt-sn': 'network-ethernet',
  'nb-iot': 'wireless-iot',
  'nmea-0183': 'marine-navigation',
  'nmea-2000': 'marine-navigation',
  ntp: 'network-ethernet',
  'obd-ii': 'automotive',
  'octal-spi': 'interfaces-framing',
  'one-wire': 'interfaces-framing',
  pmbus: 'interfaces-framing',
  ppp: 'interfaces-framing',
  ptp: 'network-ethernet',
  'quad-spi': 'interfaces-framing',
  'rs-232': 'interfaces-framing',
  'rs-422': 'interfaces-framing',
  'rs-485': 'interfaces-framing',
  rtcm: 'marine-navigation',
  rtcp: 'network-ethernet',
  rtp: 'network-ethernet',
  sacn: 'building-automation',
  sdlc: 'interfaces-framing',
  slip: 'interfaces-framing',
  smbus: 'interfaces-framing',
  i3c: 'interfaces-framing',
  microwire: 'interfaces-framing',
  snmp: 'network-ethernet',
  spi: 'interfaces-framing',
  syslog: 'network-ethernet',
  tcp: 'network-ethernet',
  telnet: 'network-ethernet',
  tftp: 'network-ethernet',
  'ttl-uart': 'interfaces-framing',
  uart: 'interfaces-framing',
  udp: 'network-ethernet',
  uds: 'automotive',
  usb: 'interfaces-framing',
  'vlan-802-1q': 'network-ethernet',
  websocket: 'network-ethernet',
  xmodem: 'interfaces-framing',
  ymodem: 'interfaces-framing',
  zigbee: 'wireless-iot',
  zmodem: 'interfaces-framing',
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
