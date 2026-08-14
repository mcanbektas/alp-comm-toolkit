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
}
