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
  // IPv4/IPv6 (internet layer) + UDP/TCP (transport) — dalga 4b: ortak
  // internetChecksum.ts yardımcısını paylaşır ama her biri ayrı motor/dosya
  // (ethernet'in tek-parser-üç-plugin deseninin AKSİNE, dört ayrı tel biçimi).
  registerOnce(registry, 'ipv4', () => import('./network/ip/ipv4').then((module) => module.ipv4Plugin));
  registerOnce(registry, 'ipv6', () => import('./network/ip/ipv6').then((module) => module.ipv6Plugin));
  registerOnce(registry, 'udp', () =>
    import('./network/transport/udp').then((module) => module.udpPlugin),
  );
  registerOnce(registry, 'tcp', () =>
    import('./network/transport/tcp').then((module) => module.tcpPlugin),
  );
  // MQTT — dalga 4c: kendi VBI (Variable Byte Integer) yardımcısını doğurur
  // (mqttVbi.ts), TCP/IP ailesinden bağımsız chunk.
  registerOnce(registry, 'mqtt', () =>
    import('./network/mqtt/mqtt').then((module) => module.mqttPlugin),
  );
  // CoAP — dalga 4d: UDP üstü, bitCursor'la çözülen 4 baytlık bit alanlı
  // başlık (RTCM'nin 3c'deki deseninin aynısı); MQTT'den bağımsız chunk.
  registerOnce(registry, 'coap', () =>
    import('./network/coap/coap').then((module) => module.coapPlugin),
  );
  // DMX512 — dalga 6a: Start Code + ≤512 slot; `building/` dizinini açan ilk
  // motor. BREAK/MAB fiziksel sinyaldir, bayt olarak modellenmez (bkz. lin.ts
  // dosya başı emsali). Checksum yok; 512 slot aşımı hata değil uyarı.
  registerOnce(registry, 'dmx512', () =>
    import('./building/dmx512/dmx512').then((module) => module.dmx512Plugin),
  );
  // Art-Net — dalga 6b: UDP payload (coap.ts girdi emsali); ortak başlık ID+
  // OpCode(LE)+ProtVer(BE, ArtPollReply'de YOK) + OpCode'a göre dallanan gövde
  // (bkz. artnet.ts dosya başı). ArtDmx tam, ArtPoll/ArtPollReply dar alan
  // kümesiyle çözülür, geri kalan OpCode'lar ad+ham gövde.
  registerOnce(registry, 'art-net', () =>
    import('./building/artnet/artnet').then((module) => module.artNetPlugin),
  );
  // DNP3 — dalga 5a: link katmanı (bloklu CRC16_DNP) + transport FIR/FIN +
  // application header (object header'a kadar, bkz. dnp3.ts dosya başı).
  registerOnce(registry, 'dnp3', () =>
    import('./industrial/dnp3/dnp3').then((module) => module.dnp3Plugin),
  );
  // IEC 60870-5-104 — dalga 5b: APCI (I/S/U format) + ASDU başlığı; ASDU
  // çekirdeği ayrı modülde (iec104Asdu.ts), ileride 101 paylaşabilsin diye.
  registerOnce(registry, 'iec-60870-5-104', () =>
    import('./industrial/iec104/iec104').then((module) => module.iec104Plugin),
  );
  // M-Bus — dalga 5c: dört çerçeve sınıfı (Single Character/Short/Control/Long,
  // sum8Checksum) + CI=0x72 yolunda Fixed Data Header/DIF/VIF kayıt zinciri
  // (bkz. mbus.ts dosya başı). Kanonik kayıt industrial-automation/metering;
  // building-automation'daki M-Bus kaydı alias'tır (kendi pluginId'si YOK).
  registerOnce(registry, 'm-bus', () =>
    import('./industrial/mbus/mbus').then((module) => module.mbusPlugin),
  );
  // EtherCAT — dalga 5d: girdi TAM Ethernet çerçevesi (EtherType 0x88A4), sonra
  // EtherCAT başlığı + datagram zinciri + Working Counter (bkz. ethercat.ts
  // dosya başı: bu bir katman zinciri DEĞİL, çerçevenin kendisi).
  registerOnce(registry, 'ethercat', () =>
    import('./industrial/ethercat/ethercat').then((module) => module.ethercatPlugin),
  );
  // IEC 61850 GOOSE — dalga 5e: girdi TAM Ethernet çerçevesi (EtherType 0x88B8),
  // sonra 8 baytlık GOOSE başlığı + BER/TLV kodlu goosePdu. Kayıt id'si katalog
  // kaydıyla aynı olmak zorunda: `iec-61850` (katalogda ayrı `goose` kaydı YOK).
  // Motor GOOSE-only; MMS/SCL yok → katalog status'u 'partial' (karar 4).
  registerOnce(registry, 'iec-61850', () =>
    import('./industrial/goose/goose').then((module) => module.goosePlugin),
  );
}
