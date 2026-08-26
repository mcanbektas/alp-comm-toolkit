import type { CatalogDomain } from '../types';

/**
 * Domain 8 — Wireless & IoT: 8 aile / 16 protokol (taksonomi §8).
 *
 * Bu dosyadaki üç kural koddan okunamaz, bu yüzden yazılı:
 *
 * 1. `live` yalnız tarayıcının kendi API'siyle (Web Bluetooth / Web Serial)
 *    ulaşılabilen protokollerde açılır. BLE Advertisement ve BLE GATT Web
 *    Bluetooth ile, LTE Modem AT ve GNSS Modem ise USB-seri modem üzerinden
 *    Web Serial ile canlı okunur. Zigbee/Thread/LoRa gibi kayıtlar harici
 *    sniffer donanımı ister — köprü gelene kadar `live` verilmez.
 * 2. Anahtar gerektiren doğrulamalar (LoRaWAN MIC, Zigbee/Matter/W-MBus
 *    şifre çözme) tarayıcıda kalır: anahtar hiçbir koşulda dışarı gönderilmez,
 *    anahtar yoksa payload "encrypted" bırakılır — uydurulmaz.
 * 3. Wireless Metering ve IoT Messaging kayıtları kasıtlı tekrardır; motor
 *    kanonik kayıtta yaşar, buradaki sayfa yalnız IoT-odaklı ekranları ekler.
 *    Bu yüzden `aliasOf` taşırlar (bkz. taksonomi "Dikkat çekenler" §5).
 *
 * `tabs` her kayıtta WORKSPACE_TABS sırasını korur — sekme şeridi bu diziyi
 * olduğu gibi render eder, sıralama yapmaz.
 */
export const wirelessIotDomain: CatalogDomain = {
  id: 'wireless-iot',
  name: 'Wireless & IoT',
  summary:
    'Short-range radio, LPWAN, Wi-Fi, proprietary RF and cellular IoT links analysed end to end, from the raw RF packet up to the decoded application value.',
  highlights: ['BLE', 'Zigbee', 'Matter', 'LoRaWAN', 'ESP-NOW', 'MQTT'],
  families: [
    {
      id: 'bluetooth-le',
      name: 'Bluetooth LE',
      summary:
        'Connectionless advertising and connected GATT traffic on the 2.4 GHz Bluetooth Low Energy stack.',
      protocols: [
        {
          id: 'ble-advertisement',
          name: 'BLE Advertisement',
          summary:
            'Connectionless BLE link-layer broadcast carrying discovery, presence and sensor data in AD structures on channels 37/38/39, used by beacons, tags and battery-powered sensors.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'ble-advertisement',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Scanner',
            'Advertising Channel View (37 / 38 / 39)',
            'PDU Type Classifier (Legacy / Extended / Periodic)',
            'Address Type & Privacy Rotation Analyzer',
            'AD Structure Parser (Length / Type / Data)',
            'Flags, Local Name & Service UUID Decoder',
            'Manufacturer Specific Data Decoder',
            'Service Data Decoder',
            'RSSI Trend (mean / min / max / std dev / fade events)',
            'Advertisement Rate & Jitter',
            'Tx Power & Rough Range Estimate (confidence: LOW)',
          ],
        },
        {
          id: 'ble-gatt',
          name: 'BLE GATT',
          summary:
            'Attribute-based service layer over ATT/L2CAP that exposes BLE device data as readable, writable and notifiable characteristics in wearables, medical devices and industrial sensors.',
          layer: 'application',
          status: 'ready',
          pluginId: 'ble-gatt',
          tabs: [
            'overview',
            'live',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'Service / Characteristic / Descriptor Tree',
            'Handle & UUID Map (16-bit SIG and 128-bit custom)',
            'Property Bit Mask Decoder (Read / Write / Notify / Indicate)',
            'Read & Write Transaction View',
            'Notification vs Indication Comparison',
            'CCCD (0x2902) State Inspector',
            'Read / Write Latency',
            'Custom GATT Schema Import (type, endian, scale, offset, unit, enum, bit fields)',
            'Engineering Value Converter',
          ],
          definitions: ['custom-schema'],
        },
      ],
    },
    {
      id: 'mesh-smart-home',
      name: 'Mesh & Smart Home',
      summary:
        'Low-power mesh stacks and the IP application layer that runs on top of them in connected home and building products.',
      protocols: [
        {
          id: 'zigbee',
          name: 'Zigbee',
          summary:
            'IEEE 802.15.4 based mesh stack with a clustered application layer (ZCL) widely deployed in smart lighting, sensors and smart home gateways.',
          layer: 'multi-layer',
          status: 'partial',
          pluginId: 'zigbee',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Network Graph (Coordinator / Router / End Device)',
            'MAC Frame Decoder (Frame Control / Sequence / Addressing / FCS)',
            'NWK Layer Decoder (Radius, Sequence, Addressing)',
            'APS Layer Decoder (Endpoint / Cluster ID / Profile ID)',
            'ZCL Cluster, Attribute & Command Viewer',
            'IEEE 64-bit vs NWK 16-bit Address Correlation',
            'Join Analyzer (discovery → parent → association → security → announce)',
            'Security State (AES-128, frame counter, key sequence, MIC verdict)',
            'Airtime & Channel Occupancy',
            'RSSI / LQI Trend',
          ],
        },
        {
          id: 'thread',
          name: 'Thread',
          summary:
            'IPv6-native low-power mesh over 802.15.4 and 6LoWPAN, providing the routed transport layer beneath Matter in smart home and building networks.',
          layer: 'network',
          status: 'planned',
          tabs: ['overview', 'decode', 'diagnostics', 'examples'],
          tools: [
            'Mesh Topology Graph (Leader / Router / REED / End Device / SED)',
            'Border Router Analyzer (Thread ↔ infrastructure interface, prefixes, routes, NAT64)',
            'Address Map (Extended Address, RLOC16, Mesh-Local, Link-Local, Global / ULA)',
            '6LoWPAN Header Decompression & Compression Saving',
            'Fragment Reassembly (missing fragment, reassembly timeout)',
            'MLE Message Classifier (Parent Request / Response, Child ID, Advertisement, Link Request)',
            'RSSI & Link Margin Trend',
          ],
        },
        {
          id: 'matter',
          name: 'Matter',
          summary:
            'IP-based smart home application layer with a clustered data model and interaction model, running over Wi-Fi, Thread or Ethernet across vendor ecosystems.',
          layer: 'application',
          status: 'partial',
          pluginId: 'matter',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Node & Fabric Explorer',
            'Endpoint / Cluster / Attribute / Command / Event Tree',
            'Interaction Model View (Read / Write / Subscribe / Invoke / Report)',
            'Subscription Monitor (min / max interval, report count, last report)',
            'Commissioning Timeline (Discovery → PASE → Attestation → Network → CASE)',
            'Session & Security State (PASE / CASE / Group, fabric, session ID)',
            'Access Control Inspector (privilege, auth mode, subject, target)',
            'TLV Tree Decoder',
            'Invoke → Response Latency',
          ],
        },
      ],
    },
    {
      id: 'lora-lpwan',
      name: 'LoRa / LPWAN',
      summary:
        'Long-range low-power radio: the chirp spread spectrum physical layer and the LoRaWAN network standard built on top of it.',
      protocols: [
        {
          id: 'lora',
          name: 'LoRa',
          summary:
            'Semtech chirp spread spectrum physical layer trading data rate against range and sensitivity, used as the radio beneath LoRaWAN and proprietary long-range links.',
          layer: 'physical',
          // Airtime / Time on Air hesabı bu kaydın asıl işi — 'timing' sekmesi
          // olmadan LoRa sayfası anlamsız kalır (taksonomi 8.3, Semtech ToA).
          //
          // `partial`, `ready` DEĞİL ve `pluginId` YOK — ikisi de bilinçli (Faz 10
          // dalga 9a, karar 1). Hesap motoru YAZILDI (`protocol-core/timing/lora.ts`:
          // sembol süresi, ToA, bit hızı, duty cycle, link bütçesi) ve `/calculators`
          // altında üç araç olarak KOŞUYOR (`lora-airtime`, `lora-link-budget`,
          // `lora-battery` — bkz. `calculatorIds`). `ProtocolPage` bu sayfanın
          // `timing` sekmesinde onlara BAĞLANTI basar (brief dalga 9, karar 6,
          // VERİLDİ: b); hesabı sayfanın İÇİNE gömmez, `ready` demek o zaman da
          // yalan olurdu. Gömme (seçenek c) ayrı bir dalga, karar 4'ün stateful
          // dashboard'ıyla birlikte tasarlanacak.
          status: 'partial',
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'PHY Parameter Set (Frequency / Bandwidth / Spreading Factor / Coding Rate)',
            'Preamble & Header Mode Inspector (explicit / implicit, CRC, LDRO)',
            'Symbol Time & Symbol Rate Calculator',
            'Estimated PHY Bit Rate',
            'Time on Air Calculator (preamble + payload symbols, total ToA)',
            'Airtime Analyzer (packets per second, channel occupancy)',
            'RSSI / SNR Scatter (success vs failure)',
            'Link Budget & Margin Calculator (theoretical estimate)',
            'Battery / Energy Estimator',
          ],
          calculatorIds: ['lora-airtime', 'lora-link-budget', 'lora-battery'],
        },
        {
          id: 'lorawan',
          name: 'LoRaWAN',
          summary:
            'LoRa Alliance LPWAN standard organising devices, gateways and a network server into a star-of-stars topology for metering, agriculture and city-scale sensing.',
          layer: 'multi-layer',
          status: 'partial',
          pluginId: 'lorawan',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'PHYPayload Decoder (MHDR / FHDR / FPort / FRMPayload / MIC)',
            'Message Type Classifier (Join Request / Accept, Confirmed / Unconfirmed Up / Down)',
            'DevAddr vs DevEUI Identity Map',
            'Frame Counter Gap Analyzer (FCntUp / FCntDown)',
            'MIC Verification — session keys stay in the browser and are never uploaded',
            'OTAA / ABP Activation Analyzer',
            'Class A / B / C Receive Window Timeline',
            'ADR Trend (data rate, Tx power, ACK state)',
            'Regional Parameters (EU868 / US915 / AU915 / AS923 / IN865 / KR920)',
            'Duty Cycle Calculator (regulatory limits from the region database)',
            'Application Payload Decoder',
          ],
        },
      ],
    },
    {
      id: 'wifi-wireless',
      name: 'Wi-Fi Wireless',
      summary:
        'IEEE 802.11 frame analysis from capture logs plus the connectionless vendor action frame protocol built on the same MAC.',
      protocols: [
        {
          id: 'wifi',
          name: 'Wi-Fi',
          summary:
            'IEEE 802.11 wireless LAN whose management, control and data frames are analysed from PCAP or monitor-mode captures to explain association, roaming and retry behaviour. DECODED: the bare MAC frame with its 4-byte FCS — 11 Frame Control subfields, all four addresses resolved through the ToDS/FromDS role matrix, sequence and fragment numbers, QoS and HT Control, CRC-32 FCS PASS/FAIL. NOT DECODED YET: management frame bodies and information elements (next sub-wave). OUT OF SCOPE: radiotap / PPI / Prism / AVS headers and the pcap envelope (separate libpcap link types), HT/VHT/HE PHY parameters, the EAPOL handshake, WEP/TKIP/CCMP decryption, A-MSDU / A-MPDU and defragmentation.',
          layer: 'data-link',
          status: 'partial',
          pluginId: 'wifi',
          tabs: ['overview', 'decode', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Frame Class Filter (Management / Control / Data)',
            'Frame Control Field Decoder (Type, Subtype, ToDS, FromDS, Retry, Protected)',
            'Address1–4 Resolver (RA / TA / SA / DA / BSSID by context)',
            'Beacon & Probe Inspector (SSID, interval, capabilities, supported rates)',
            'Information Element Parser (RSN / HT / VHT / HE / EHT / Vendor 221 raw)',
            'Sequence Control Analyzer (retry and duplicate detection)',
            'Connection Timeline (Probe → Auth → Assoc → Handshake → Data → Disassoc)',
            'Capture Metadata View (RSSI, channel, bandwidth, MCS, spatial streams, PHY)',
            'Airtime & Channel Occupancy',
            'Coexistence Analyzer (2.4 GHz overlap with BLE / Zigbee / Thread)',
          ],
        },
        {
          id: 'esp-now',
          name: 'ESP-NOW',
          summary:
            'Espressif connectionless protocol carrying application payloads inside 802.11 vendor-specific action frames, used for low-latency ESP32 device-to-device links without an access point.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Vendor Action Frame Decoder (Category 127, Espressif OUI 18:FE:34)',
            'Vendor Specific Element Parser (Element ID 221, Type 4, version flags)',
            'Payload Limit Check (v1.0 250 B vs v2.0 1470 B, multi-element)',
            'Peer & Device Graph (unicast / broadcast, packets/s, bytes/s, RSSI, retries)',
            'Addressing View (destination / source / third address, ToDS = FromDS = 0)',
            'Security State (CCMP, PMK and peer LMK; payload unavailable without keys)',
            'Payload Schema Decoder',
            'TX → Application ACK Latency',
          ],
        },
      ],
    },
    {
      id: 'custom-rf',
      name: 'Custom RF',
      summary:
        'Schema-driven workspace for proprietary sub-GHz and 2.4 GHz telemetry frames that follow no published standard.',
      protocols: [
        {
          id: 'rf-telemetry-custom-frame',
          name: 'RF Telemetry Custom Frame',
          summary:
            'Proprietary sub-GHz or 2.4 GHz telemetry framing described by a user-defined schema, used for vendor remote sensors, alarm links and reverse-engineered radio devices.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'definitions', 'examples'],
          tools: [
            'Custom Frame Schema Editor (Preamble / Sync Word / Device ID / Packet Type / Sequence / Length / Payload / CRC)',
            'Input Adapters (demodulated bytes, bit stream, pulse durations, logic analyzer or SDR export, UART)',
            'Dewhitening (polynomial and seed from the schema)',
            'Manchester Decoder (polarity from the profile)',
            'CRC Field Detector & Validator',
            'RF Metadata View (modulation, data rate, deviation, bandwidth, RSSI, SNR)',
            'Unknown RF Protocol Analyzer (constant bytes, counter and checksum candidates)',
            'Frame Builder & Templates',
            'Payload Schema Decoder',
          ],
          definitions: ['custom-schema'],
        },
      ],
    },
    {
      id: 'wireless-metering',
      name: 'Wireless Metering',
      summary:
        'EN 13757 wireless utility metering links between meters and collectors, seen from the IoT gateway side.',
      protocols: [
        {
          id: 'wireless-m-bus',
          name: 'Wireless M-Bus',
          summary:
            'EN 13757 radio link with OMS meter profiles carrying heat, water, gas and electricity telegrams from meters to collectors and gateways.',
          layer: 'multi-layer',
          status: 'planned',
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'RF Mode Profile (S / T / C / R / N / F)',
            'Telegram Decoder (RF metadata → link layer → application layer)',
            'Device Identity View (manufacturer, device ID, version, device type, access number)',
            'DIF / VIF Meter Record Parser',
            'Security State (AES-128, OMS transport security, key ID, frame counter)',
            'Meter Dashboard (energy, power, volume, flow, temperature, battery)',
            'Gateway Correlation (meter record → MQTT topic, scale error warning)',
          ],
          aliasOf: 'industrial-automation/metering/wireless-m-bus',
        },
      ],
    },
    {
      id: 'iot-messaging',
      name: 'IoT Messaging',
      summary:
        'Device-oriented views over the shared Network & Ethernet messaging engines — no second parser is written here.',
      protocols: [
        {
          id: 'mqtt',
          name: 'MQTT',
          summary:
            'Publish/subscribe broker protocol seen from the device side, mapping sensor clients and topic trees onto decoded telemetry payloads in IoT deployments.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Client Table (client ID, last seen, connection state)',
            'Topic Structure Analyzer (topic tree)',
            'Sensor Payload Decoder (JSON / CBOR / binary schema)',
            'Publish Rate & Message Rate',
            'QoS, Retain and Duplicate Inspector',
            'QoS ACK Latency',
            'Device Health (keep alive, will, stale sensor data)',
            'Gateway Correlation (wireless protocol → MQTT topic)',
          ],
          aliasOf: 'network-ethernet/web-messaging/mqtt',
        },
        {
          id: 'coap',
          name: 'CoAP',
          summary:
            'Constrained RESTful protocol over UDP whose resource tree and Observe streams expose readings from low-power sensor nodes to gateways.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Resource Tree Explorer (/temp, /humidity, /config, /status, /battery)',
            'Transaction View (method, response code, content format)',
            'Observe Stream Monitor',
            'CON → ACK Latency',
            'Sensor Payload Decoder',
            'Device Health & Timeout Detection',
          ],
          aliasOf: 'network-ethernet/web-messaging/coap',
        },
      ],
    },
    {
      id: 'cellular-iot',
      name: 'Cellular IoT',
      summary:
        'Modem-log based analysis of cellular IoT devices: registration, packet sessions, AT transactions and the on-board GNSS receiver.',
      protocols: [
        {
          id: 'nb-iot',
          name: 'NB-IoT',
          summary:
            '3GPP narrowband cellular IoT access analysed from modem logs — registration, signal quality and power-save behaviour of metering, tracking and remote sensor devices.',
          layer: 'multi-layer',
          // Faz 10 dalga 9d: `lte-modem-at`in ÜSTÜNDE AcT=9 tespiti + PSM
          // (AT+CPSMS, T3412/T3324) + eDRX (AT+CEDRXS/CEDRXRDP/CEDRXP, yalnız
          // NB-S1) çözüldü (src/protocols/wireless/cellular/nbIot.ts) — bu
          // yüzden `decode` sekmesi açıldı (karar 5'in doğal sonucu, motor
          // decode-zamanı bir zenginleştirme). Connection State Machine/
          // Registration Analyzer/Power Save Analyzer/Socket-Connection
          // Timeline gibi STATEFUL panolar bu dalgada YOK — `lte-modem-at`in
          // Cellular Initialization Dashboard'uyla aynı sınıf iş (karar 4),
          // kendi turunu bekliyor; `timing`/`data`/`diagnostics` hâlâ `tools`
          // metin listesiyle "planlandı" gösterir.
          status: 'ready',
          pluginId: 'nb-iot',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Connection State Machine (POWER OFF → SIM READY → REGISTERED → PDN ACTIVE → SOCKET OPEN)',
            'Registration Analyzer (registered / searching / denied / roaming, tracking area)',
            'Operator & Cell Info (cell ID, EARFCN, band, access technology)',
            'Signal Quality Trend (RSSI, RSRP, RSRQ, SINR)',
            'Power Save Analyzer (PSM, eDRX, active time, TAU timer, wakeup / sleep)',
            'PDP / PDN Context Viewer',
            'Socket Timeline',
            'Connection Timeline',
          ],
          related: ['wireless-iot/cellular-iot/lte-modem-at'],
        },
        {
          id: 'lte-modem-at',
          name: 'LTE Modem AT',
          summary:
            'AT command layer of cellular modems (3GPP TS 27.007 plus vendor extensions) used to bring up SIM, network registration, data sessions and sockets on IoT hardware.',
          layer: 'application',
          // Faz 10 dalga 9c: TS 27.007 komut veritabanı yazıldı
          // (src/protocols/wireless/cellular/lteModemAt.ts) — CSQ/COPS/CREG/
          // CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN, at-commands'ın üstünde.
          // Cellular Initialization Dashboard'ın React katmanı `data`
          // sekmesine bağlandı (karar 6'yla aynı sınıf iş, kendi turu —
          // `features/cellular-dashboard/`): yapıştırılan çok satırlı AT
          // oturumu `createCellularInitializationState`e beslenir, IMEI/SIM/
          // operatör/RAT/kayıt/PDP alanları gösterilir — model/firmware/bant
          // hâlâ YOK (kaynak komutları madde 8'in kümesinde değil). "AT
          // Console" (Web Serial, canlı bağlantı) ve "Boot Timeline" ayrı,
          // daha geniş bir iş — bu dalgada YAPILMADI.
          status: 'ready',
          pluginId: 'lte-modem-at',
          tabs: [
            'overview',
            'live',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'examples',
          ],
          tools: [
            'AT Console (Web Serial)',
            'Command Classifier (Basic / Execution / Read / Set / Test)',
            'Transaction Parser (command → intermediate → final result, latency)',
            'URC Stream, kept separate from command responses',
            'AT State Machine (IDLE → COMMAND_SENT → WAIT_RESPONSE → FINAL_RESULT, prompt / data mode)',
            'Final Result Codes (OK, ERROR, CONNECT, NO CARRIER, +CME ERROR, +CMS ERROR)',
            'Command Database (3GPP TS 27.007 and vendor sets, revision aware)',
            'Cellular Initialization Dashboard (model, firmware, IMEI, SIM, operator, RAT, band, IP)',
            'Privacy Masking on Export (IMEI / IMSI / ICCID / phone number)',
            'Boot Timeline',
          ],
          related: ['interfaces-framing/framing-stream-protocols/at-commands'],
        },
        {
          id: 'gnss-modem',
          name: 'GNSS Modem',
          summary:
            'GNSS receiver embedded in a cellular module, driven by vendor AT commands and read back as NMEA plus vendor URCs in asset tracking and telematics devices.',
          layer: 'application',
          // Faz 10 dalga 9e: AT+QGPSGNMEA yanıtının içindeki ham NMEA
          // cümlesi nmea-0183 motoruna DEVREDİLDİ (motor tekrar yazılmadı —
          // bu yorumun kendi sözü tutuldu), AT+QGPSLOC dar bir alan
          // kümesiyle çözüldü (fix/lat/lon/alt/sat/hdop — src/protocols/
          // wireless/cellular/gnssModem.ts). `tabs`'ta `decode` zaten
          // vardı, dokunulmadı. GNSS Control Commands (power/update rate/
          // constellation), tam vendor URC sözlüğü, Position Dashboard
          // UI'ı, TTFF Calculator, Fix Loss Detector ve GNSS+Cellular
          // Correlation Timeline bu dalgada YOK — hepsi stateful/timeline
          // araçlar, lte-modem-at'in Cellular Initialization Dashboard'uyla
          // aynı sınıf iş (karar 4), kendi turlarını bekliyor.
          status: 'ready',
          pluginId: 'gnss-modem',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'GNSS Control Commands (power, position, fix status, update rate, constellation, assistance data)',
            'GNSS Status & URC Parser (Quectel / u-blox / SIMCom vendor sets)',
            'NMEA Stream View ($GNGGA / $GNRMC / $GNGSA) reusing the marine NMEA 0183 parser',
            'Position Dashboard (fix 2D / 3D, latitude, longitude, altitude, satellites, HDOP, speed, course)',
            'TTFF Calculator',
            'Fix Loss Detector (satellite decline, position age, GNSS_FIX_LOST)',
            'GNSS + Cellular Correlation Timeline (position with cell ID, RSRP, RSRQ)',
          ],
          // NMEA parser'ı yeniden yazılmaz; marine kaydındaki kanonik motor
          // kullanılır (kaynak: 09-kablosuz-iot.md, "3.5'teki parser aynen kullanılır").
          related: [
            'marine-navigation/nmea-family/nmea-0183',
            'wireless-iot/cellular-iot/lte-modem-at',
          ],
        },
      ],
    },
  ],
};
