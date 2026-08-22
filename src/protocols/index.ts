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
  // sACN — dalga 6c: UDP payload; Root→Framing→DMP katmanları, üçünde
  // tekrarlanan flags&length deseni (4 bit flags + 12 bit length, bitCursor)
  // ve dört-yönlü katman-length tutarlılık kontrolü (bkz. sacn.ts dosya
  // başı). Root Vector = VECTOR_ROOT_E131_DATA olan E1.31 Data Packet tam
  // çözülür; Synchronization/Universe Discovery Packet (Root Vector =
  // VECTOR_ROOT_E131_EXTENDED) ad + ham gövde kalır — kamu-kaynaklı üçlünün
  // (6a-6c) SONUNCUSU.
  registerOnce(registry, 'sacn', () => import('./building/sacn/sacn').then((module) => module.sacnPlugin));
  // DALI — dalga 6d: lisanslı IEC 62386 ailesine geçen ilk motor (6a-6c kamu
  // kaynaklıydı). Girdi 1 (backward) / 2 (forward) / 3 (DALI-2 device frame,
  // karar 6 gereği bu dalgada ham+planned) bayt; forward frame'de Address
  // Byte üst bitlerden Individual/Group/Broadcast'e ayrılır, en düşük bit
  // (S) DAPC/Command ayrımını kilitler (bkz. dali.ts dosya başı — Wikipedia +
  // python-dali çapraz teyitli). Checksum yok; dar opcode ad kümesi.
  registerOnce(registry, 'dali', () => import('./building/dali/dali').then((module) => module.daliPlugin));
  // KNX — dalga 6e: lisanslı KNX Standard/ISO 22510 ailesine geçen ikinci
  // motor (dali.ts ile aynı disiplin). Girdi TP1 STANDART L_Data telegramı;
  // Control Field (Frame Type/Repeat/Priority), Source/Destination Address
  // (Individual `a.b.c` / Group `a/b/c` — AT bitine göre İKİ AYRI formatter),
  // NPCI (AT+HopCount+Length, Length OFF-BY-ONE), TPCI/APCI (dar ad kümesi:
  // GroupValueRead/Write/Response) çözülür (bkz. knx.ts dosya başı — Calimero+
  // XKNX+franckmarini çapraz teyitli). Extended frame (Control Field bit7=0)
  // Karar 5 gereği kapsam dışı: ham+uyarı. Checksum terslenmiş (NOT) XOR;
  // `xor8Checksum` üstüne ince tersleme katmanı. Payload DPT'siz HAM kalır.
  registerOnce(registry, 'knx', () => import('./building/knx/knx').then((module) => module.knxPlugin));
  // BACnet MS/TP — dalga 6f: lisanslı üçlünün SONUNCUSU + paylaşılan NPDU/APDU
  // çekirdeği (bkz. building/bacnet/npdu.ts + apdu.ts — iec104Asdu.ts'nin
  // AYNI ayrı-modül deseni, dalga 6g/bacnet-ip aynı çekirdeği yeniden
  // kullanacak). Çerçeve: Preamble 55 FF + Frame Type (dar ad kümesi) +
  // Destination/Source MAC (Device Instance İLE KARIŞTIRILMAZ) + Length +
  // Header CRC-8 (yeni katalog girdisi `CRC8_BACNET_MSTP`) + koşullu Data +
  // Data CRC-16 (`CRC16_X25`, Length=0'da hiç YOK). Data yalnız Frame Type 5/6
  // (BACnet Data Expecting/Not Expecting Reply) iken NPDU/APDU'ya geçirilir;
  // servis parametreleri HAM tek blok kalır (berReader BACnet tag formatına
  // uymuyor, bkz. apdu.ts dosya başı). Klasör/dosya adı tireli DEĞİL
  // (`bacnetmstp` — art-net'in `artnet` emsali); `bacnet-mstp` yalnız
  // PROTOCOL_ID/katalog id/registry key'de kalır.
  registerOnce(registry, 'bacnet-mstp', () =>
    import('./building/bacnetmstp/bacnetmstp').then((module) => module.bacnetMstpPlugin),
  );
  // BACnet/IP — dalga 6g: BVLL (BACnet Virtual Link Layer) başlığı (Type=0x81
  // sabit + Function dar ad kümesi + Length — KENDİSİNİ DE SAYAN toplam
  // uzunluk, MBAP'ın tersine) + 6f'nin PAYLAŞILAN NPDU/APDU çekirdeğinin
  // (bacnet/npdu.ts + apdu.ts) YENİDEN KULLANIMI (bkz. bacnetip.ts dosya başı
  // — iec104Asdu.ts'nin AYNI ayrı-modül deseni). Original-Unicast/Broadcast-
  // NPDU ve Forwarded-NPDU (6 baytlık B/IP adresinden SONRA NPDU başlar) bu
  // çekirdeğe girer; kalan dokuz BVLC fonksiyonu (BVLC-Result, BDT/FDT
  // read/write, Register-Foreign-Device vb.) yalnız ad + ham gövde —
  // BBMD/Foreign Device tablo takibi YAPILMAZ (analyzer işi). Dalga 6'nın
  // KAPANIŞI (6a-6g tamam).
  registerOnce(registry, 'bacnet-ip', () =>
    import('./building/bacnetip/bacnetip').then((module) => module.bacnetIpPlugin),
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
  // BLE Advertisement — dalga 7a: `wireless/` dizinini açan ilk motor. Girdi
  // advertising-channel PDU (Header 2B + AdvA + AD zinciri); Preamble/Access
  // Address/CRC girdide YOK (sniffer seviyesi, bkz. bleAdvertisement.ts dosya
  // başı). Yalnız AD taşıyan dört PDU tipi (ADV_IND/NONCONN_IND/SCAN_IND/
  // SCAN_RSP) AdvA+AD şemasıyla çözülür; diğerleri (ADV_DIRECT_IND/SCAN_REQ/
  // CONNECT_IND/ADV_EXT_IND) ham + uyarı — farklı payload şeması taşırlar.
  registerOnce(registry, 'ble-advertisement', () =>
    import('./wireless/ble/bleAdvertisement').then((module) => module.bleAdvertisementPlugin),
  );
  // BLE GATT — dalga 8a: ATT/L2CAP bağlantılı PDU (bkz. bleGatt.ts dosya
  // başı). Girdi çıplak ATT PDU; opsiyonel L2CAP Basic çerçeve öneki
  // (Length+CID=0x0004) algılanıp soyulur — tek girdi kutusu Web Bluetooth'un
  // çıplak değerini de Wireshark dökümünü de yer. Onyedi opcode (karar
  // dosya başı) adlandırılır ve gövdesi çözülür; Value her zaman şemasız
  // ham kalır (Custom GATT Schema Import dalga 8d). CCCD bit çözümü
  // (`decodeCccdValue`) BİLİNÇLİ OLARAK genel Value alanına kablolanmaz —
  // Handle'ın CCCD olduğunu bilmek GATT keşif geçmişi ister, tek-PDU'luk bu
  // parser'da o oturum durumu yok.
  registerOnce(registry, 'ble-gatt', () =>
    import('./wireless/ble/bleGatt').then((module) => module.bleGattPlugin),
  );
  // LoRaWAN — dalga 7b: PHYPayload = MHDR + MACPayload + MIC (bkz. lorawan.ts
  // dosya başı). Join-Request açık metin (JoinEUI/DevEUI/DevNonce); Join-Accept
  // MHDR sonrası uçtan uca şifreli → tek ham blok. Data frame FHDR+FPort+
  // FRMPayload(şifreli); FOpts MAC komutları ham (analyzer işi); MIC mavlink
  // crcNeedsDialect emsali — asla PASS/FAIL basılmaz. Sürüm çıpası L2 1.0.4
  // (karar 6): FType 110 (1.1 Rejoin Request) dar adlanır, gövdesi çözülmez.
  registerOnce(registry, 'lorawan', () =>
    import('./wireless/lorawan/lorawan').then((module) => module.lorawanPlugin),
  );
  // Zigbee — dalga 7c: ÜÇ katman TEK motor (802.15.4 MAC → NWK → APS + dar
  // ZCL, bkz. zigbee.ts dosya başı). Girdi TAM 802.15.4 çerçevesi (FCF..FCS).
  // FCS bu dalgada GERÇEKTEN doğrulanır (CRC16_KERMIT, anahtarsız — MIC/
  // checksum-dialect kuralının istisnası). NWK/APS security=1 → encrypted
  // ham (öteye inilmez). ZCL yalnız Read Attributes Response/Report
  // Attributes/Default Response payload'ı çözer; cluster-specific komutların
  // GÖVDESİ hâlâ ham+uyarı (karar 5, dar kapsam). Dalga 8: Cluster ID +
  // Attribute ID isim eşlemesi eklendi — Home Automation'ın en yaygın 18
  // cluster'ı (zigbee-herdsman + Wireshark çapraz doğrulaması, bkz. zigbee.ts
  // CLUSTER/ATTRIBUTE KÜTÜPHANESİ); TAM ZCL kütüphanesi DEĞİL.
  registerOnce(registry, 'zigbee', () =>
    import('./wireless/zigbee/zigbee').then((module) => module.zigbeePlugin),
  );
  // Matter — dalga 7d: TLV Tree Decoder. Girdi bağımsız bir TLV blob'udur,
  // Matter MESAJ çerçevesi DEĞİL (o katman şifreli+oturumlu, anahtar ister —
  // dalga 5 karar 8). Kodlama PAYLAŞILAN yeni walker'da
  // (protocol-core/decoding/matterTlv.ts — berReader KULLANILMAZ, Matter TLV
  // başka bir kodlamadır); burada yalnız yürüyüş politikası (derinlik/eleman
  // tavanı) ve ağacın ParsedField listesine düzleştirilmesi var. Interaction
  // Model/Commissioning/Session tools'ları planned bildirimli → 'partial'.
  registerOnce(registry, 'matter', () =>
    import('./wireless/matter/matter').then((module) => module.matterPlugin),
  );
  // AT Commands — Faz 10 dalga 9b: ITU-T V.250 / 3GPP TS 27.007 jenerik
  // çerçeveleme (komut/yanıt ayrımı, URC, final result code sözel VE sayısal
  // — ATV0 numeric mode dalga 9 madde 7'de eklendi, tüm AT lehçelerine
  // fayda sağlasın diye burada, hayes-command-set'e özel değil).
  registerOnce(registry, 'at-commands', () =>
    import('./serial/atcommands/atCommands').then((module) => module.atCommandsPlugin),
  );
  // Hayes Command Set — Faz 10 dalga 9 madde 7: V.250 TEMEL sözdizimi
  // (ATD/ATA/ATH/ATZ, S-register okuma/yazma, sayısal result code — at-commands
  // ÜSTÜNDE, ikinci bir plugin, motor TEKRAR YAZILMADI). "+++" guard-time
  // analizi ve command/data mode izleyicisi motor-hazır (`detectEscapeSequence`/
  // `createHayesModeTracker`), UI'a BAĞLANMADI — Cellular Initialization
  // Dashboard'la aynı sınıf iş, kendi turunu bekliyor.
  registerOnce(registry, 'hayes-command-set', () =>
    import('./serial/atcommands/hayesCommandSet').then((module) => module.hayesCommandSetPlugin),
  );
  // SLIP — Faz 10 dalga 10a: RFC 1055, `protocol-core/framing/slip.ts`nin
  // (Faz 6) ÜSTÜNDE ince sarmal — motor zaten kesiyor VE kaçış çözüyor,
  // yeni bir ayrıştırma algoritması YOK.
  registerOnce(registry, 'slip', () => import('./serial/framing/slip').then((module) => module.slipPlugin));
  // COBS — Faz 10 dalga 10a: `protocol-core/framing/cobs.ts`nin (Faz 6)
  // ÜSTÜNDE ince sarmal — SLIP'le aynı gerekçe, motor zaten çözüyor.
  registerOnce(registry, 'cobs', () => import('./serial/framing/cobs').then((module) => module.cobsPlugin));
  // KISS — Faz 10 dalga 10b: `protocol-core/framing/slip.ts`nin (Faz 6)
  // ÜSTÜNDE ince sarmal — SLIP'in AYNI dört baytı (FEND/FESC/TFEND/TFESC),
  // motor TEKRAR YAZILMADI. Type Indicator (port/komut) adlanır; AX.25 v1'de
  // hiç çözülmez (brief-faz10-dalga10.md, 10b).
  registerOnce(registry, 'kiss', () => import('./serial/framing/kiss').then((module) => module.kissPlugin));
  // PPP — Faz 10 dalga 10b: `protocol-core/framing/hdlcFraming.ts`nin (Faz 6)
  // ÜSTÜNDE ince sarmal — motor zaten kesiyor VE async kaçış çözüyor. Yeni iş
  // Address/Control+Protocol demux ve LCP paket/seçenek çözümü (RFC 1661).
  registerOnce(registry, 'ppp', () => import('./serial/framing/ppp').then((module) => module.pppPlugin));
  // HDLC — Faz 10 dalga 10c: `hdlcCore.ts`nin (bu dalga, PAYLAŞILAN çekirdek
  // — SDLC de kullanıyor) ÜSTÜNDE ince sarmal. 10a/10b'nin AKSİNE gerçek
  // yeni iş: FCS (CRC16_X25) + I/S/U çerçeve sınıflandırması hiç yoktu,
  // burada yazıldı. Kaçışsız `createBoundedDelimiterExtractor` kullanır
  // (`hdlcFlagExtractor` DEĞİL — o async kaçışlı, gerçek bit-senkron veride
  // yanlış araç, bkz. hdlcCore.ts dosya başı).
  registerOnce(registry, 'hdlc', () => import('./serial/framing/hdlc').then((module) => module.hdlcPlugin));
  // SDLC — Faz 10 dalga 10c: `hdlcCore.ts`nin AYNISI (HDLC ile birebir aynı
  // çerçeve şekli), yalnız Address alanı "Station Address" olarak adlanır.
  registerOnce(registry, 'sdlc', () => import('./serial/framing/sdlc').then((module) => module.sdlcPlugin));
  // XMODEM — Faz 10 dalga 10d: framing motoruna (Faz 6) HİÇ UĞRAMAZ —
  // stop-and-wait ACK/NAK dosya transferi, motorun 15 yönteminden hiçbiri
  // bu şekli karşılamıyor. Yeni `xmodemCore.ts` (PAYLAŞILAN çekirdek, YMODEM
  // de kullanıyor): blok yapısı + checksum(SUM-8)/CRC(CRC16_XMODEM) modu
  // çerçeve UZUNLUĞUNDAN türetilir, el sıkışma baytına bakılmaz (tek çerçeve
  // decode, oturum durumu YOK).
  registerOnce(registry, 'xmodem', () => import('./serial/framing/xmodem').then((module) => module.xmodemPlugin));
  // YMODEM — Faz 10 dalga 10d: `xmodemCore.ts`nin AYNISI (blok yapısı XMODEM
  // ile birebir), yalnız Block 0 "batch metadata" (dosya adı+boyutu) olarak
  // ayrıca çözülür — mtime/mode/serial encoding'i standardize DEĞİL, ham
  // bırakılır (uydurulmadı).
  registerOnce(registry, 'ymodem', () => import('./serial/framing/ymodem').then((module) => module.ymodemPlugin));
  // ZMODEM — Faz 10 dalga 10d/2: `xmodemCore.ts`yle wire seviyesinde HİÇBİR
  // ortak yanı yok, kendi çekirdeği (`zmodemCore.ts`). Projenin kendi speci
  // bit seviyesi vermiyor ("kanonik tanım yok") — kullanıcı kararıyla
  // **lrzsz profili** seçildi, sabitler Forsberg'in zmodem.txt/zmodem.h'si +
  // zm.c/crctab.c'den (iki bağımsız mirror, çapraz doğrulandı) türetildi.
  // ZDLE kaçışı (XOR 0x40 + ZRUB0/1 literal + ZCRCE/G/Q/W terminatör) ÜÇ
  // ayrı anlam taşıdığından `escaping.ts`nin jenerik motoru KULLANILMADI
  // (HDLC'nin `hdlcFlagExtractor`i reddetmesiyle aynı gerekçe kalıbı).
  registerOnce(registry, 'zmodem', () => import('./serial/framing/zmodem').then((module) => module.zmodemPlugin));
  // Custom Binary Protocol — Faz 10 dalga 10e: 4 "jenerik" sayfanın ilki.
  // `specFixture.ts`teki SPEC_SENSOR_PROTOCOL (§8.3+§9.6+§43 çapraz
  // doğrulanmış) AYNEN sarıldı — `ProtocolFramingSchema`nın 'startEnd'
  // türü zaten yetiyor, 15 yöntemlik framing motoruna hiç uğranmaz.
  registerOnce(registry, 'custom-binary-protocol', () =>
    import('./serial/framing/customBinaryProtocol').then((module) => module.customBinaryProtocolPlugin),
  );
  // ASCII Protocol — Faz 10 dalga 10e. `ProtocolFramingSchema` 'none' türü
  // yeterli. Virgülle ayrılmış sayısal alan parse'ı (spec özetinin vaadi)
  // FIELD_TYPES'ta yok — `parameters` alanı ham metin kalır, uydurulmadı.
  registerOnce(registry, 'ascii-protocol', () =>
    import('./serial/framing/asciiProtocol').then((module) => module.asciiProtocolPlugin),
  );
  // Delimiter-Based Protocol — Faz 10 dalga 10e, 4'ün TEK istisnası:
  // `ProtocolFramingSchema` bir EscapeRule taşımıyor, bu yüzden Faz 6'nın
  // `hdlcFraming.ts`si (PPP'nin de kullandığı `hdlc-flag` motoru) AYNEN
  // kullanıldı — delimiter-collision + escape mekaniği somut gösterilir.
  registerOnce(registry, 'delimiter-based-protocol', () =>
    import('./serial/framing/delimiterBasedProtocol').then((module) => module.delimiterBasedProtocolPlugin),
  );
  // Length-Based Protocol — Faz 10 dalga 10e. `ProtocolFramingSchema`
  // 'lengthField' türü yeterli — LENGTH(uint16 BE)+PAYLOAD+CHECKSUM(xor8),
  // bağımsız hesaplanmış fixture (spec özeti sembolik, CRC vermiyordu).
  registerOnce(registry, 'length-based-protocol', () =>
    import('./serial/framing/lengthBasedProtocol').then((module) => module.lengthBasedProtocolPlugin),
  );
  // LTE Modem AT — Faz 10 dalga 9c: 3GPP TS 27.007 hücresel sözlük
  // (CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN), at-commands'ın
  // ÜSTÜNDE. Sebep kodu anlamı (CREG/CEREG reject_cause) ve model/firmware/bant
  // bu dalgada YOK — kaynak komutları madde 8 listesinde değil.
  registerOnce(registry, 'lte-modem-at', () =>
    import('./wireless/cellular/lteModemAt').then((module) => module.lteModemAtPlugin),
  );
  // NB-IoT — Faz 10 dalga 9d: `lte-modem-at`in ÜSTÜNDE (karar 5, aliasOf
  // DEĞİL) — AcT=9 tespiti (CREG/CEREG/COPS'un ortak access-technology
  // alanı üstüne) + PSM (AT+CPSMS, T3412/T3324, GPRS Timer 3/2 — FARKLI
  // tablolar) + eDRX (AT+CEDRXS/CEDRXRDP/CEDRXP, yalnız NB-S1 modu)
  // zamanlayıcı çözümü.
  registerOnce(registry, 'nb-iot', () =>
    import('./wireless/cellular/nbIot').then((module) => module.nbIotPlugin),
  );
  // GNSS Modem — Faz 10 dalga 9e: lte-modem-at VE nmea-0183'ün ÜSTÜNDE
  // (karar 5, aliasOf DEĞİL) — AT+QGPSGNMEA'nın gömülü ham NMEA cümlesi
  // nmea-0183 motoruna DEVREDİLİR (motor tekrar yazılmaz), AT+QGPSLOC dar
  // bir alan kümesiyle (fix/lat/lon/alt/sat/hdop) çözülür.
  registerOnce(registry, 'gnss-modem', () =>
    import('./wireless/cellular/gnssModem').then((module) => module.gnssModemPlugin),
  );
  // 1-Wire — Faz 10 dalga 11a: Peripheral Buses ailesinin İLK üyesi
  // (brief-faz10-dalga11.md). ROM Command (Microchip AN3320 + esp-open-rtos
  // onewire.c çapraz teyitli) + 64-bit ROM ID (Family/Serial/CRC-8/MAXIM,
  // motor `protocol-core/checksums`ta ZATEN vardı) çözülür. Framing motoruna
  // (Faz 6) HİÇ UĞRAMAZ — XMODEM/ZMODEM gibi kendi sabit-uzunluklu çerçevesi
  // var. Search ROM'un bit-seviyeli arama ağacı ve Reset/Presence pulse
  // timing'i KAPSAM DIŞI (onewire.ts dosya başı notu, ayrı bir iş).
  registerOnce(registry, 'one-wire', () =>
    import('./serial/peripheral-buses/onewire').then((module) => module.oneWirePlugin),
  );
  // SPI — Faz 10 dalga 11b: register transaction decode (Command bit7=R/W̄ +
  // 1 dummy bayt + Data, spec'in kendi IMU örneği). CPOL/CPHA/transfer süresi
  // `timing/spi.ts`ta (Faz 5) zaten vardı, motor tekrar yazılmadı.
  registerOnce(registry, 'spi', () =>
    import('./serial/peripheral-buses/spi').then((module) => module.spiPlugin),
  );
  // Quad SPI — Faz 10 dalga 11b: `qspiCore.ts`nin (bu dalga, octal-spi ile
  // PAYLAŞILAN çekirdek) üstünde ince sarmal. Command+Address(3 bayt sabit)+
  // Data; Dummy cycle hiç bayt tüketmez (kapsam kararı, qspiCore.ts notu).
  registerOnce(registry, 'quad-spi', () =>
    import('./serial/peripheral-buses/quadSpi').then((module) => module.quadSpiPlugin),
  );
  // Octal SPI — Faz 10 dalga 11b: `qspiCore.ts`nin AYNISI (quad-spi ile
  // birebir aynı çerçeve şekli). SDR/DDR/DQS decode'a girmez (elektriksel/
  // zamanlama kavramları, octalSpi.ts dosya başı notu).
  registerOnce(registry, 'octal-spi', () =>
    import('./serial/peripheral-buses/octalSpi').then((module) => module.octalSpiPlugin),
  );
  // I²C — Faz 10 dalga 11c: 4 transaction şekli (address-only/write/read/
  // repeated-start register-read, spec'in ana örneğine sadık). CPOL/CPHA gibi
  // `timing/i2c.ts`taki transfer süresi/7-bit encode/rise-time (Faz 5) zaten
  // vardı, motor tekrar yazılmadı. ACK/NACK/10-bit addressing KAPSAM DIŞI
  // (i2c.ts dosya başı notu); `'live'` tab katalogdan çıkarıldı (connection/
  // yalnız serial+mock, I2C köprü cihazı yok).
  registerOnce(registry, 'i2c', () =>
    import('./serial/peripheral-buses/i2c').then((module) => module.i2cPlugin),
  );
  // SMBus / PMBus — Faz 10 dalga 11i: ikisi de `smbusCore.ts` paylaşılan
  // iskeletini kullanır (adres + repeated START + PEC). SMBus sayfası spec
  // özetinin saydığı 11 transaction türünü ayırır ve PEC panelini besler
  // (PEC'in düz CRC-8 olduğu SMBus 3.1 §5.4'ten DOĞRULANDI, varsayılmadı —
  // smbusCore.ts dosya başı). PMBus sayfası bunun üstüne komut haritasını,
  // Linear11/ULINEAR16/STATUS bit ağacını ve COEFFICIENTS→m/b/R çözümünü
  // ekler; DIRECT format motoru `timing/pmbus.ts`e eklendi (PMBus Part II
  // Rev 1.3.1 §7.4, dış kaynak). Timeout/bus-stuck izleme KAPSAM DIŞI.
  registerOnce(registry, 'smbus', () =>
    import('./serial/peripheral-buses/smbus').then((module) => module.smbusPlugin),
  );
  registerOnce(registry, 'pmbus', () =>
    import('./serial/peripheral-buses/pmbus').then((module) => module.pmbusPlugin),
  );
  // Microwire / I3C — Faz 10 dalga 11 (#11), Peripheral Buses ailesinin SON
  // iki kaydı. İkisi de bu dalgada açılan `ProtocolPlugin.decodeOptions`
  // kanalını kullanır (`protocol-core/types.ts`): çerçeveden ÇIKARILAMAYAN
  // parametre kullanıcıdan alınır, tahmin edilmez.
  //   - Microwire'da parametre transaction'ın ŞEKLİDİR (opcode/adres/word bit
  //     genişlikleri). Spec "SPI ile aynı kabul etme" diyor; motor
  //     `timing/microwire.ts`te ve iki Microchip datasheet'inin clock-cycle
  //     sütunuyla çapraz doğrulandı. 93xx66 preset'i tablosu doğrulanamadığı
  //     için GÖNDERİLMEDİ.
  //   - I3C'de parametre çerçevenin TÜRÜDÜR: yakalanmış baytlardan private
  //     SDR read ile IBI ayırt EDİLEMEZ. Sabitler Linux çekirdeği I3C alt
  //     sisteminden (MIPI spec'i kamuya açık değil). HDR/hot-join KAPSAM DIŞI,
  //     hız rakamları versiyon-bağımlı olduğu için hiçbir yere yazılmadı.
  registerOnce(registry, 'microwire', () =>
    import('./serial/peripheral-buses/microwire').then((module) => module.microwirePlugin),
  );
  registerOnce(registry, 'i3c', () =>
    import('./serial/peripheral-buses/i3c').then((module) => module.i3cPlugin),
  );
  // USB — Faz 10 dalga 11j: TEK paket seviyesi (PID + token/SOF/veri/handshake
  // + CRC5/CRC16) ve veri yükünün Chapter 9 çözümü (SETUP isteği, tanımlayıcı
  // zinciri). Veri CRC16'sı `CRC16_ARC` DEĞİL: USB 2.0 §8.3.5.2'den doğrulanıp
  // katalogda `CRC16_USB` olarak açıldı (crcCatalogue.ts girdisinin notu).
  // Transaction/transfer/enumeration seviyeleri ve `'live'` sekmesi KAPSAM DIŞI
  // (usb.ts dosya başı; connection/ yalnız serial+mock).
  registerOnce(registry, 'usb', () =>
    import('./serial/host-network-interfaces/usb').then((module) => module.usbPlugin),
  );
  // Ethernet Interface — Faz 10 dalga 11k: sayfanın kendi bayt akışı MDIO
  // yönetim çerçevesidir (Ethernet çerçevesini network/ethernet zaten çözer).
  // Clause 22 alanları + BMCR/BMSR/ANAR/ANLPAR bit çözümü; Clause 45 yalnız
  // ADLANIR (op kodu tablosu kamuya açık kaynaklarda bulunamadı, mdio.ts
  // dosya başı). Cevapsız okuma (TA=11) "PHY not detected" uyarısı verir.
  registerOnce(registry, 'ethernet-interface', () =>
    import('./serial/host-network-interfaces/mdio').then((module) => module.mdioPlugin),
  );
  // RS-485 / RS-422 — Faz 10 dalga 11d: elektriksel katmanlar, decode'ları
  // ortak `uartLineCore.ts` üzerinden UART karakter hattı görünümü (8N1
  // varsayımı orada gerekçeli). RS-485 ayrıca half-duplex echo şüphesini
  // uyarıyla işaretler. Termination/bias/unit-load/propagation motorları
  // `timing/rs485.ts`te (Faz 5) zaten vardı, tekrar yazılmadı.
  registerOnce(registry, 'rs-485', () =>
    import('./serial/serial-interfaces/rs485').then((module) => module.rs485Plugin),
  );
  registerOnce(registry, 'rs-422', () =>
    import('./serial/serial-interfaces/rs422').then((module) => module.rs422Plugin),
  );
  // UART / RS-232 — Faz 10 dalga 11e: aynı `uartLineCore.ts` karakter açılımı.
  // UART sayfası satır sonu (CR/LF/CRLF) ayrımını ve ASCII karşılığını ekler;
  // RS-232 sayfası mark/space polaritesini (logic 1 → Mark, negatif hat).
  // Baud/karakter süresi `timing/uart.ts`te (Faz 5) zaten vardı.
  registerOnce(registry, 'uart', () =>
    import('./serial/serial-interfaces/uart').then((module) => module.uartPlugin),
  );
  registerOnce(registry, 'rs-232', () =>
    import('./serial/serial-interfaces/rs232').then((module) => module.rs232Plugin),
  );
  // TTL UART / CMOS UART — Faz 10 dalga 11f: bayt akışında ikisini ayıran iz
  // YOK (ikisi de UART çerçevesi), ayrım tamamen elektriksel — bu yüzden TEK
  // modül iki eklenti üretir (canClassic.ts/ethernet.ts emsali). Sayfaların
  // asıl motoru `timing/logicLevels.ts` + `logic-level-compat` hesaplayıcısı.
  registerOnce(registry, 'ttl-uart', () =>
    import('./serial/serial-interfaces/logicLevelUart').then((module) => module.ttlUartPlugin),
  );
  registerOnce(registry, 'cmos-uart', () =>
    import('./serial/serial-interfaces/logicLevelUart').then((module) => module.cmosUartPlugin),
  );
}
