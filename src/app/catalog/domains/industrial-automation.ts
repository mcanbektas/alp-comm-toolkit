import type { CatalogDomain } from '../types';

/**
 * Domain 2 — 8 aile / 25 protokol (taksonomi §2: 3+4+6+3+1+1+2+5).
 *
 * Bu dosyadaki dört kayıt KANONİKTİR ve başka domain'lerdeki ikizleri buraya
 * `aliasOf` ile bağlanır: Modbus RTU, Modbus TCP (building-automation), M-Bus
 * (building-automation), Wireless M-Bus (wireless-iot), CANopen (automotive).
 * Ayrıca marine-navigation/marine-machinery/marine-modbus da Modbus RTU'ya
 * bağlanır. Alias yönünü ters çevirme — kanonik tarafa `aliasOf` yazılırsa
 * arama sonuçları ikizlenir ve `uniqueProtocols` sayımı bozulur.
 *
 * `live` sekmesi bilinçli olarak seçicidir: yalnız tarayıcıdan (Web Serial /
 * USB) ya da yerel köprüden gerçekten akış alınabilen protokollerde var.
 * Klasik fieldbus'lar (PROFIBUS DP, CC-Link, AS-i, FOUNDATION Fieldbus) özel
 * bus monitor donanımı ister — onlarda akış değil dışa aktarılmış yakalama
 * dosyası okunur, bu yüzden `live` yok. CIP ise kendi teline sahip olmayan
 * soyut nesne modelidir; canlı yakalaması EtherNet/IP ve DeviceNet sayfalarında.
 *
 * `definitions` yalnız decoder'a semantik veren tanım dosyası olan beş kayıtta:
 * GSD, GSDML, EDS, IODD, SCL. EtherNet/IP ve POWERLINK araç listelerinde EDS /
 * XDD geçse de sekme verilmedi — EtherNet/IP'nin EDS'i CIP device profile'ı
 * üzerinden okunur, XDD ise DEFINITION_FORMATS'ta karşılığı olmayan bir biçim.
 */
export const industrialAutomationDomain: CatalogDomain = {
  id: 'industrial-automation',
  name: 'Industrial Automation',
  summary:
    'Fieldbus, industrial Ethernet, device integration and SCADA protocols that carry process data between controllers, drives, sensors and utility stations.',
  highlights: ['Modbus RTU', 'PROFIBUS DP', 'PROFINET', 'EtherCAT', 'OPC UA', 'IEC 61850'],
  families: [
    {
      id: 'modbus',
      name: 'Modbus',
      summary:
        'The three Modbus transports that share one function-code application model and differ only in framing.',
      protocols: [
        {
          id: 'modbus-rtu',
          name: 'Modbus RTU',
          summary:
            'Binary Modbus encoding over a serial line where frame boundaries are silent intervals rather than delimiters, dominant in PLC-to-remote-I/O polling.',
          // Seri çerçeveleme + function-code uygulaması aynı spec'te tanımlı:
          // katman tek başına data-link ya da application değil.
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'modbus-rtu',
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
            'Frame Decoder',
            'Request/Response',
            'Function Codes',
            'Register Viewer',
            'Register Map',
            'Data Type Decoder',
            'Word/Byte Order',
            'CRC',
            'Timing',
            'Polling',
            'Exception Decoder',
            'Packet Builder',
            'Master Simulator',
            'Slave Simulator',
          ],
          related: [
            'industrial-automation/modbus/modbus-ascii',
            'industrial-automation/modbus/modbus-tcp',
          ],
        },
        {
          id: 'modbus-ascii',
          name: 'Modbus ASCII',
          summary:
            'Modbus messages carried as printable hex characters between a colon and CR LF, used on links where binary transparency cannot be guaranteed.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'modbus-ascii',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'ASCII Frame',
            'HEX Conversion',
            'LRC',
            'Request/Response',
            'Register Map',
            'Builder',
            'Parser State Machine',
          ],
          related: [
            'industrial-automation/modbus/modbus-rtu',
            'industrial-automation/modbus/modbus-tcp',
          ],
        },
        {
          id: 'modbus-tcp',
          name: 'Modbus TCP',
          summary:
            'Modbus PDUs wrapped in an MBAP header on TCP/IP, where responses are matched by transaction ID and integrity is delegated to the TCP stack.',
          layer: 'application',
          status: 'ready',
          pluginId: 'modbus-tcp',
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
            'MBAP Header',
            'Transaction ID',
            'Unit ID',
            'TCP Stream Reassembly',
            'Register Decoder',
            'Request/Response',
            'Connection Statistics',
          ],
          related: [
            'industrial-automation/modbus/modbus-rtu',
            'industrial-automation/modbus/modbus-ascii',
          ],
        },
      ],
    },
    {
      id: 'classic-fieldbus',
      name: 'Classic Fieldbus',
      summary:
        'Pre-Ethernet field networks that still run most installed plants, each with its own physical layer and cyclic scan.',
      protocols: [
        {
          id: 'profibus-dp',
          name: 'PROFIBUS DP',
          summary:
            'IEC 61158 based RS-485 fieldbus for decentralized peripheral I/O, where a master parameterizes, configures and then cyclically exchanges data with addressed slave stations. The decoder covers every FDL telegram class — short acknowledgement, SD1, SD2, SD3 and the SD4 token — down to the frame control bits, the address extension that carries the DP service access points, and the frame check sequence, which is really verified. Only the user data unit stays raw, because its layout comes from the GSD file rather than the wire.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'profibus-dp',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'definitions', 'examples'],
          tools: [
            'Station Explorer',
            'Telegram Decoder',
            'Master/Slave',
            'Cyclic I/O',
            'Parameterization',
            'Configuration',
            'Diagnostics',
            'Timing',
            'GSD Explorer',
          ],
          definitions: ['gsd'],
        },
        {
          id: 'cc-link',
          name: 'CC-Link',
          summary:
            'Mitsubishi-originated factory automation fieldbus reaching 10 Mbit/s over up to 64 stations, exchanging remote inputs, outputs and registers as logical data areas. The decoder covers the cyclic link-device image of one station — the RX/RY bit points and the RWr/RWw registers, sized from the occupied-station count and the extended cyclic setting you supply. The RS-485 telegram itself is not decoded: its field layout is not published anywhere, so guessing it would be worse than leaving it out.',
          layer: 'multi-layer',
          // Karar (dalga 13g): CLPA'nın veri bağı spec'i üyelik arkasında ve
          // hiçbir kamuya açık kaynak (Wireshark dahil) telgraf alanlarını
          // vermiyor. Motor telgrafı DEĞİL, nokta sayıları iki bağımsız
          // belgede teyitli olan döngüsel link cihazı görüntüsünü çözer —
          // rozet bu yüzden 'partial' (iec-61850 emsali).
          status: 'partial',
          pluginId: 'cc-link',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Station Explorer',
            'Cyclic Communication',
            'Remote Inputs',
            'Remote Outputs',
            'Remote Registers',
            'Diagnostics',
            'Network Timing',
          ],
        },
        {
          id: 'as-interface',
          name: 'AS-Interface',
          summary:
            'Low-cost sensor/actuator network carrying data and power on the same two wires, polled device by device — classic AS-i and the faster ASi-5 generation. The decoder covers classic AS-i completely: every bit of the 14-bit master call and the 7-bit slave response, the call table down to each named command, and the even-parity check the specification defines. ASi-5 is not implemented: it is a different OFDM physical and data-link layer whose frame format is not published anywhere.',
          layer: 'multi-layer',
          // Karar (dalga 13g): klasik AS-i tarafı bit bit çözülüyor ve parite
          // gerçekten doğrulanıyor, ama kayıt İKİ nesil vaat ediyor (özet +
          // araç listesindeki "ASi-5"). ASi-5'in tel biçimi kamuya açık
          // olmadığı için bilinçli eksik → rozet 'partial' (iec-61850 emsali).
          status: 'partial',
          pluginId: 'as-interface',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Master',
            'Device Address',
            'Input/Output Bits',
            'Cyclic Poll',
            'Parameter Data',
            'Diagnostics',
            'ASi-5',
          ],
          // Gateway üzerinden üst ağa haritalanır (PROFINET Module → AS-i adresi
          // → fiziksel I/O), bu yüzden iki hızlı geçiş verildi.
          related: [
            'industrial-automation/industrial-ethernet/profinet',
            'industrial-automation/industrial-ethernet/ethernet-ip',
          ],
        },
        {
          id: 'foundation-fieldbus',
          name: 'FOUNDATION Fieldbus',
          summary:
            'Process-automation digital bus combining the H1 publisher/subscriber segment with the HSE Ethernet backbone and a function-block device model. The decoder covers HSE only: the 12-byte FDA message header — version, option flags, protocol id (FDA, SM, FMS, LAN Redundancy), message type, service name, FDA address and message length — plus the optional trailer. The service body stays raw and H1 is not decoded at all, because its frame is defined in a paid standard and its start and end delimiters are non-data symbols that cannot be represented as bytes.',
          layer: 'multi-layer',
          // Karar (dalga 13g): motor HSE-only ve FDA zarfıyla sınırlı. Kayıt
          // iki katman vaat ediyor (araç listesinde ayrı "H1" ve "HSE"), H1
          // için kamuya açık kaynak YOK ve sınırlayıcıları bayt bile değil.
          // Ayrıca HSE yerleşimi TEK kaynaklı (Wireshark packet-ff.c) ve bu
          // her çözümde uyarıyla söyleniyor → rozet 'partial' (iec-61850).
          status: 'partial',
          pluginId: 'foundation-fieldbus',
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'H1',
            'HSE',
            'Device Explorer',
            'Resource Block',
            'Transducer Block',
            'Function Blocks',
            'Publisher/Subscriber',
            'Diagnostics',
          ],
        },
      ],
    },
    {
      id: 'industrial-ethernet',
      name: 'Industrial Ethernet',
      summary:
        'Real-time protocols that put deterministic cyclic traffic and standard IP traffic on the same Ethernet wire.',
      protocols: [
        {
          id: 'profinet',
          name: 'PROFINET',
          summary:
            'Ethernet-based automation standard combining DCP device discovery, cyclic IO controller/device exchange, alarms and slot/subslot structured process data.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'profinet',
          tabs: [
            'overview',
            'live',
            'decode',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'Device Discovery/DCP',
            'IO Controller',
            'IO Device',
            'Cyclic I/O',
            'Slot/Subslot',
            'Alarms',
            'Diagnostics',
            'Timing/Jitter',
            'GSDML Explorer',
          ],
          definitions: ['gsdml'],
        },
        {
          id: 'ethercat',
          name: 'EtherCAT',
          summary:
            'On-the-fly Ethernet fieldbus (EtherType 0x88A4) in which one frame carries many datagrams processed by slaves as it passes, tracked by the working counter.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'ethercat',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Ethernet Frame',
            'EtherCAT Datagram',
            'Command',
            'Addressing',
            'Working Counter',
            'Slave States',
            'Distributed Clocks',
            'PDO',
            'Mailbox (CoE, FoE, EoE, SoE, AoE)',
            'Diagnostics',
          ],
          // CoE mailbox içeriği CANopen object dictionary motoruna yönlendirilir.
          related: ['industrial-automation/cip-can-based/canopen'],
        },
        {
          id: 'ethernet-ip',
          name: 'EtherNet/IP',
          summary:
            'ODVA adaptation that encapsulates CIP over standard TCP/IP for explicit messaging and over UDP multicast for implicit cyclic I/O at a configured RPI.',
          layer: 'application',
          status: 'ready',
          pluginId: 'ethernet-ip',
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
            'Encapsulation',
            'Session',
            'CIP',
            'Explicit Messaging',
            'Implicit I/O',
            'Assemblies',
            'RPI',
            'Sequence/Jitter',
            'EDS',
          ],
          related: ['industrial-automation/cip-can-based/cip'],
        },
        {
          id: 'cc-link-ie',
          name: 'CC-Link IE',
          summary:
            'Gigabit Ethernet CC-Link family (Controller, Field, Field Basic, TSN) mixing deterministic cyclic data with transient messaging on one network. The decoder covers the three variants that share EtherType 0x890F — Controller, Field and TSN: the Ethernet frame, the frame type, the common header down to srcNodeNumber, the protocolVer/protocolType nibbles that name the network variant, and the SLMP envelope inside TSN acyclic data. The HEC is shown but never verified because its algorithm is not public, cyclic payloads stay raw because their link-device map comes from the network parameters, and Field Basic is not covered at all: it is SLMP over IPv4/UDP, not an 0x890F frame.',
          layer: 'multi-layer',
          // Karar (dalga 13g): motor 0x890F-only. Kaydın vaat ettiği dört ağ
          // tipinden Field Basic BAŞKA BİR TAŞIYICIDA (IPv4/UDP + SLMP) geldiği
          // için bilinçli eksik — rozet 'ready' değil 'partial', özet metni
          // neyin çözülüp neyin çözülmediğini açıkça yazar (iec-61850 emsali).
          status: 'partial',
          pluginId: 'cc-link-ie',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'IE Field',
            'IE Controller',
            'IE Field Basic',
            'IE TSN',
            'Cyclic Communication',
            'Transient Communication',
            'Network Diagnostics',
          ],
        },
        {
          id: 'sercos-iii',
          name: 'Sercos III',
          summary:
            'Ethernet real-time bus for controls, drives and I/O with cycle times from 31.25 µs and sub-microsecond synchronization accuracy.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'sercos-iii',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Communication Cycle',
            'Real-Time Telegrams',
            'Drive Data',
            'Device Parameters',
            'State/Phase',
            'Timing',
          ],
        },
        {
          id: 'powerlink',
          name: 'POWERLINK',
          summary:
            'Hard real-time Fast Ethernet protocol where a managing node schedules isochronous polling of controlled nodes and reuses the CANopen object model.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'powerlink',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Managing Node',
            'Controlled Nodes',
            'Isochronous Phase',
            'Asynchronous Phase',
            'PDO',
            'SDO',
            'NMT',
            'Diagnostics',
          ],
          // Aynı OD adresleme SÖZLEŞMESİ (16-bit Index + 8-bit Sub-index), ama ortak
          // motor YOK: dalga 13f iddiayı sınadı ve bit düzeyinde çürüttü — NMT durum
          // baytları kesişmiyor (`0x00` iki tarafta FARKLI anlam), SDO komut
          // spesifikatörü farklı, PDO uzunluğu POWERLINK'te 16-bit ALAN iken
          // CANopen'da CAN DLC'sidir (≤8 bayt). Gerekçe `powerlink.ts` dosya başında;
          // `canopen.ts` bilerek DEĞİŞTİRİLMEDİ. Bağ kavramsaldır, kod paylaşımı değil.
          related: ['industrial-automation/cip-can-based/canopen'],
        },
      ],
    },
    {
      id: 'cip-can-based',
      name: 'CIP & CAN-Based Industrial',
      summary:
        'The media-independent CIP object model and the CAN-based industrial application layers built on the same idea.',
      protocols: [
        {
          id: 'cip',
          name: 'CIP',
          summary:
            'Media-independent object-oriented application protocol whose class/instance/attribute/service model is shared by EtherNet/IP and DeviceNet.',
          layer: 'application',
          status: 'ready',
          pluginId: 'cip',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Object',
            'Class',
            'Instance',
            'Attribute',
            'Service',
            'Path Decoder',
            'Status',
            'Device Profiles',
          ],
          related: [
            'industrial-automation/industrial-ethernet/ethernet-ip',
            'industrial-automation/cip-can-based/devicenet',
          ],
        },
        {
          id: 'devicenet',
          name: 'DeviceNet',
          summary:
            'CIP over a CAN data link on a trunkline/dropline cable that also carries network power, connecting controllers to field I/O and starters.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'devicenet',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Node Explorer',
            'CAN Frame',
            'CIP Layer',
            'I/O Messaging',
            'Explicit Messaging',
            'Diagnostics',
          ],
          related: ['industrial-automation/cip-can-based/cip'],
        },
        {
          id: 'canopen',
          name: 'CANopen',
          summary:
            'CiA standardized CAN application layer addressing device data through a 16-bit index / 8-bit sub-index object dictionary served by PDO, SDO, NMT and EMCY.',
          layer: 'application',
          status: 'ready',
          pluginId: 'canopen',
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
            'Node Explorer',
            'Object Dictionary',
            'NMT',
            'PDO',
            'SDO',
            'SYNC',
            'EMCY',
            'Heartbeat',
            'EDS',
            'CiA Profiles',
          ],
          definitions: ['eds'],
          related: [
            'industrial-automation/industrial-ethernet/powerlink',
            'industrial-automation/industrial-ethernet/ethercat',
          ],
        },
      ],
    },
    {
      id: 'sensors-device-integration',
      name: 'Sensors & Device Integration',
      summary:
        'Point-to-point device links that turn raw sensor bytes into named, scaled parameters.',
      protocols: [
        {
          id: 'io-link',
          name: 'IO-Link',
          summary:
            'Point-to-point interface between an IO-Link master port and an intelligent sensor or actuator, carrying process data, on-request parameters and events. The decoder covers the full M-sequence envelope on both sides of the link — the master\'s R/W bit, communication channel and address (FlowCTRL on the ISDU channel), the M-sequence type, and the device\'s event flag and Process Data status — with a checksum that is really the official 6-bit XOR-and-compress algorithm, genuinely verified. On the ISDU channel it goes further and decodes a complete parameter request or response, index, subindex and its own independent CHKPDU checksum, whenever one fits in a single M-sequence. Process Data content, a Type 2 message\'s process/on-request split and a segmented ISDU stay raw, because they depend on the IODD file, a prior negotiation or the paired frame rather than on this one.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'io-link',
          tabs: [
            'overview',
            'live',
            'decode',
            'build',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'Master/Port Explorer',
            'Process Data',
            'Parameter Data',
            'Events',
            'Diagnostics',
            'Device Identity',
            'IODD Explorer',
          ],
          definitions: ['iodd'],
        },
      ],
    },
    {
      id: 'process-instrumentation',
      name: 'Process Instrumentation',
      summary:
        'Digital communication layered on the analog instrumentation loop of process plants.',
      protocols: [
        {
          id: 'hart',
          name: 'HART',
          summary:
            'FSK digital communication superimposed on the 4–20 mA current loop, letting a host read the analog process value and the digital device data side by side. The decoder covers the full serial frame envelope — preamble, short and long start delimiters, the primary/secondary master flag, the short polling address and the long manufacturer/device-type/device-ID address, universal/common practice/device-specific command classification, byte count, response code (communication-error flags versus command-specific status) and device status, and the checksum, which is really an XOR over the delimiter through the data and is genuinely verified. Only the command data itself stays raw, because its layout is defined per command (roughly 200 of them) rather than by the envelope.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'hart',
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
            '4–20 mA',
            'Digital Frame',
            'Device Address',
            'Commands',
            'Universal Commands',
            'Common Practice',
            'Device-Specific',
            'Device Status',
            'Burst Mode',
            'Analog/Digital Compare',
          ],
        },
      ],
    },
    {
      id: 'metering',
      name: 'Metering',
      summary:
        'EN 13757 meter reading for heat, water, gas and energy — one application decoder, two link layers.',
      protocols: [
        {
          id: 'm-bus',
          name: 'M-Bus',
          summary:
            'Wired EN 13757 meter bus whose long-frame data records expose energy, volume, flow and temperature values with unit, tariff and storage semantics.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'm-bus',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Meter Browser',
            'Device Identity',
            'Telegram',
            'Data Records',
            'Energy',
            'Volume',
            'Flow',
            'Temperature',
            'Diagnostics',
          ],
          related: ['industrial-automation/metering/wireless-m-bus'],
        },
        {
          id: 'wireless-m-bus',
          name: 'Wireless M-Bus',
          summary:
            'Radio variant of EN 13757 metering that reuses the wired application-data decoder behind its own link layer, radio metadata and optional payload encryption.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'wireless-m-bus',
          tabs: ['overview', 'live', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Meter Browser',
            'Device Identity',
            'Telegram',
            'Data Records',
            'Energy',
            'Volume',
            'Flow',
            'Temperature',
            'Diagnostics',
            'Radio Metadata',
            'Encryption Status',
          ],
          related: ['industrial-automation/metering/m-bus'],
        },
      ],
    },
    {
      id: 'scada-utility',
      name: 'SCADA & Utility',
      summary:
        'Telecontrol and substation protocols that move measurements, events and commands between control centres and remote stations.',
      protocols: [
        {
          id: 'opc-ua',
          name: 'OPC UA',
          summary:
            'Interoperability architecture with an information model, service sets and built-in security, browsed as an address space and monitored through subscriptions.',
          layer: 'application',
          status: 'ready',
          pluginId: 'opc-ua',
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
            'Endpoint Discovery',
            'Secure Channel',
            'Session',
            'Address Space',
            'Browse',
            'Read',
            'Write',
            'Method',
            'Subscription',
            'Monitored Items',
            'Security',
            'Certificates',
          ],
        },
        {
          id: 'iec-60870-5-101',
          name: 'IEC 60870-5-101',
          summary:
            'Serial telecontrol companion standard carrying ASDUs with type identification, cause of transmission, information object addresses, quality bits and time tags.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'iec-60870-5-101',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Link Layer',
            'ASDU',
            'Type ID',
            'Cause',
            'Common Address',
            'IOA',
            'Quality',
            'Timestamp',
            'Commands',
          ],
          // ASDU çekirdeği 104 ile ortak; yalnız alt taşıma farklı.
          related: ['industrial-automation/scada-utility/iec-60870-5-104'],
        },
        {
          id: 'iec-60870-5-104',
          name: 'IEC 60870-5-104',
          summary:
            'Network profile that moves the 101 ASDU model onto TCP/IP with an APCI carrying I, S and U format frames and tracked send/receive sequence numbers.',
          layer: 'application',
          status: 'ready',
          pluginId: 'iec-60870-5-104',
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
            'TCP Session',
            'APCI',
            'I-Format',
            'S-Format',
            'U-Format',
            'Sequence Numbers',
            'ASDU',
            'Session Timeline',
          ],
          related: ['industrial-automation/scada-utility/iec-60870-5-101'],
        },
        {
          id: 'dnp3',
          name: 'DNP3',
          summary:
            'Layered SCADA protocol for electric and water utilities using object groups and variations, event classes, unsolicited responses and internal indication flags.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'dnp3',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Data Link',
            'Transport',
            'Application',
            'Objects',
            'Variations',
            'Classes',
            'Unsolicited',
            'Confirm',
            'IIN',
            'Events',
          ],
        },
        {
          id: 'iec-61850',
          name: 'IEC 61850',
          summary:
            'Substation automation standard whose IED/logical node information model is served by client-server MMS and by multicast GOOSE for time-critical protection events. The decoder covers GOOSE only: the Ethernet frame, the APPID/Length/Reserved header and every BER-coded goosePdu field down to the dataset values. MMS and SCL import are not implemented yet.',
          layer: 'multi-layer',
          // Karar 4 (dalga 5e): motor GOOSE-only. Kaydın vaat ettiği MMS ve SCL
          // BİLİNÇLİ eksik olduğu için rozet 'ready' değil 'partial' — özet
          // metni neyin çözülüp neyin çözülmediğini açıkça yazar (KWP2000 emsali).
          status: 'partial',
          pluginId: 'iec-61850',
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
            'Information Model',
            'SCL Explorer',
            'MMS (Association, Read, Write, Reports, Control)',
            'GOOSE (Publisher, Dataset, stNum, sqNum, Retransmission, Diagnostics)',
          ],
          definitions: ['scl'],
        },
      ],
    },
  ],
};
