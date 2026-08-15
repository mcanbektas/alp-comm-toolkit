/**
 * Yerleşik protokol eklentilerinin kayıt noktası — katalogdaki `pluginId`
 * değerlerinin karşılığı burada, tek yerde verilir.
 *
 * Kayıt LOADER ile yapılır, modülü statik içe aktararak DEĞİL: `import()` çağrısı
 * fonksiyon gövdesinde kaldığı sürece Vite parser'ı ayrı bir chunk'a böler ve
 * açılış paketi motorları taşımaz (spec §44 — ana sayfa hızlı açılmalı). Buraya
 * tek bir `import { modbusRtuPlugin } from './industrial/modbus/modbusRtu'`
 * yazmak registry'nin lazy olmasını anlamsızlaştırır: 172 protokolün hepsi
 * yazıldığında o satırların toplamı ilk boyamadan önce indirilen paket olur.
 */

import { protocolRegistry } from '@/protocol-core/registry';
import type { ProtocolPluginLoader, ProtocolRegistry } from '@/protocol-core/registry';

/**
 * Registry aynı id ikinci kez kaydedilirse `duplicate-registration` fırlatır, ama
 * bu fonksiyonun birden çok kez çağrılması normaldir: React StrictMode geliştirmede
 * efektleri iki kez koşturur, HMR modülü yeniden değerlendirir, testler aynı defterle
 * arka arkaya çağırır. Çakışma bu yüzden önden SORULUR — try/catch ile yutmak
 * `duplicate-registration` dışındaki hataları da (bozuk kayıt, ileride eklenecek
 * doğrulamalar) görünmez kılardı.
 */
function registerOnce(registry: ProtocolRegistry, id: string, loader: ProtocolPluginLoader): void {
  if (registry.isProtocolRegistered(id)) return;
  registry.registerProtocolPlugin(id, loader);
}

/**
 * Uygulamanın tanıdığı bütün motorları kaydeder. Çağrısı React yaşam döngüsüne
 * bağlı değildir; açılışta bir kez koşması yeterlidir (`src/main.tsx`).
 *
 * Kayıt sırası önemsizdir: `registeredProtocolIds()` zaten alfabetik döner.
 */
export function registerBuiltInProtocols(registry: ProtocolRegistry = protocolRegistry): void {
  registerOnce(registry, 'modbus-rtu', () =>
    import('./industrial/modbus/modbusRtu').then((module) => module.modbusRtuPlugin),
  );
  registerOnce(registry, 'modbus-ascii', () =>
    import('./industrial/modbus/modbusAscii').then((module) => module.modbusAsciiPlugin),
  );
  registerOnce(registry, 'modbus-tcp', () =>
    import('./industrial/modbus/modbusTcp').then((module) => module.modbusTcpPlugin),
  );
  registerOnce(registry, 'nmea-0183', () =>
    import('./marine/nmea/nmea0183').then((module) => module.nmea0183Plugin),
  );
  registerOnce(registry, 'nmea-2000', () =>
    import('./marine/nmea2000/nmea2000').then((module) => module.nmea2000Plugin),
  );
  registerOnce(registry, 'ais', () => import('./marine/ais/ais').then((module) => module.aisPlugin));
  // UBX + RTCM aynı GNSS portunda multipleksli akış (spec 5563); kanonik kayıtları
  // marine'de, interfaces-framing/aerospace-uav sayfaları alias olarak devralır.
  registerOnce(registry, 'gnss-ubx', () =>
    import('./marine/ubx/ubx').then((module) => module.ubxPlugin),
  );
  registerOnce(registry, 'rtcm', () =>
    import('./marine/rtcm/rtcm').then((module) => module.rtcmPlugin),
  );
  // CAN 2.0A ve 2.0B AYNI modülden gelir: tel biçimleri aynı, ayrım yalnız
  // identifier genişliğinde (bkz. canClassic.ts). İki kayıt tek chunk paylaşır.
  registerOnce(registry, 'can-2-0a', () =>
    import('./automotive/can/canClassic').then((module) => module.can20aPlugin),
  );
  registerOnce(registry, 'can-2-0b', () =>
    import('./automotive/can/canClassic').then((module) => module.can20bPlugin),
  );
  registerOnce(registry, 'can-fd', () =>
    import('./automotive/can/canFd').then((module) => module.canFdPlugin),
  );
  registerOnce(registry, 'can-xl', () =>
    import('./automotive/can/canXl').then((module) => module.canXlPlugin),
  );
  registerOnce(registry, 'j1939', () =>
    import('./automotive/j1939/j1939').then((module) => module.j1939Plugin),
  );
  registerOnce(registry, 'iso-tp', () =>
    import('./automotive/isotp/isotp').then((module) => module.isoTpPlugin),
  );
  registerOnce(registry, 'uds', () =>
    import('./automotive/uds/uds').then((module) => module.udsPlugin),
  );
  // UDS'ten SONRA: OBD-II'nin mod+0x40 yanıt kuralı UDS'in SID+0x40 kuralıyla
  // aynı aileden (dosya başı, obd.ts) — okuma sırası bu ilişkiyi yansıtır.
  registerOnce(registry, 'obd-ii', () =>
    import('./automotive/obd/obd').then((module) => module.obdPlugin),
  );
  registerOnce(registry, 'canopen', () =>
    import('./industrial/canopen/canopen').then((module) => module.canopenPlugin),
  );
  registerOnce(registry, 'doip', () =>
    import('./automotive/doip/doip').then((module) => module.doipPlugin),
  );
  registerOnce(registry, 'lin', () =>
    import('./automotive/lin/lin').then((module) => module.linPlugin),
  );
  registerOnce(registry, 'iso-14230', () =>
    import('./automotive/iso14230/iso14230').then((module) => module.iso14230Plugin),
  );
  registerOnce(registry, 'iso-9141', () =>
    import('./automotive/iso9141/iso9141').then((module) => module.iso9141Plugin),
  );
  // v1 (0xFE) ve v2 (0xFD) AYNI modülden gelir: magic'e göre dallanan tek
  // parser, tek kayıt (can-2-0a/can-2-0b'nin iki-plugin deseninin BİLEREK
  // kullanılmadığı yer — bkz. mavlink.ts dosya başı).
  registerOnce(registry, 'mavlink', () =>
    import('./aerospace/mavlink/mavlink').then((module) => module.mavlinkPlugin),
  );
  // Ethernet II / IEEE 802.3 / VLAN 802.1Q AYNI modülden gelir: tel biçimleri
  // aynı, ayrım MAC çiftinden sonraki 2 baytlık alanın yorumunda (bkz. ethernet.ts,
  // canClassic.ts'in üç-plugin-tek-parser emsali).
  registerOnce(registry, 'ethernet-ii', () =>
    import('./network/ethernet/ethernet').then((module) => module.ethernetIiPlugin),
  );
  registerOnce(registry, 'ieee-802-3', () =>
    import('./network/ethernet/ethernet').then((module) => module.ieee8023Plugin),
  );
  registerOnce(registry, 'vlan-802-1q', () =>
    import('./network/ethernet/ethernet').then((module) => module.vlan8021qPlugin),
  );
}
