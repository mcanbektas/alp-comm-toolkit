import type { CatalogDomain } from '../types';

/**
 * Otomotiv domain'i: 7 aile / 25 protokol.
 *
 * Kataloğun geri kalanı gibi saf veridir. Buradaki üç ayrım kaynakta özellikle
 * vurgulanıyor ve sayfa tasarımını bağlar:
 *
 * 1. CAN ID bir node adresi DEĞİLDİR. Adres kavramı yalnız üst katmanlarda
 *    modellenir (J1939 → Source Address, CANopen → Node ID, DoIP → Logical
 *    Address). Bu yüzden `data` sekmesi CAN ailesinde sinyal, J1939'da SPN,
 *    CANopen'da object dictionary anlamına gelir; aynı şey değildirler.
 * 2. K-Line yalnız fiziksel/taşıma ortamıdır; ISO 9141, KWP2000, UDS ve OBD-II
 *    onun ÜZERİNDE çalışan ayrı katmanlardır. Legacy Diagnostics ailesindeki üç
 *    kayıt bu yüzden ayrı ayrı durur, tek sayfaya katlanmaz.
 * 3. CAN frame CRC'si ile uygulama seviyesi E2E CRC'si farklı katmanlardır;
 *    `diagnostics` sekmesi ikisini ayrı raporlamak zorundadır.
 *
 * `definitions` sekmesi yalnız makine-okunur tanım dosyası gerçekten varsa
 * açılır: CAN ailesi + DBC, LIN + LDF, XCP/CCP + A2L, CANopen + EDS. Kaynak bu
 * bölümde ODX'ten hiç söz etmediği için UDS/DoIP kayıtlarında tanım sekmesi yok.
 */
export const automotiveDomain: CatalogDomain = {
  id: 'automotive',
  name: 'Automotive',
  summary:
    'In-vehicle communication from sensor pulse level through CAN, LIN and FlexRay framing up to diagnostic, Ethernet and calibration services.',
  highlights: ['CAN FD', 'J1939', 'LIN', 'UDS', 'OBD-II', 'SOME/IP'],
  families: [
    {
      id: 'can-family',
      name: 'CAN Family',
      summary:
        'Three generations of the CAN data-link layer, from the classical 8-byte frame to the 2048-byte CAN XL frame.',
      protocols: [
        {
          id: 'can-2-0a',
          name: 'CAN 2.0A',
          summary:
            'Classical CAN base frame format with an 11-bit identifier and up to 8 data bytes, the baseline bus of nearly every powertrain and body network.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'can-2-0a',
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
          // Bit stuffing iki ayrı görünüm gerektirir: mantıksal frame bitleri ve
          // hatta gerçekten görünen bitler. Araç listesi bunu ayrı başlık tutar.
          tools: [
            'Frame Decoder',
            'Arbitration',
            'CAN ID',
            'DLC',
            'Data',
            'Bit Stuffing',
            'CRC',
            'ACK',
            'Timing',
            'Bus Load',
            'Period/Jitter',
            'Error Frames',
          ],
          definitions: ['dbc'],
        },
        {
          id: 'can-2-0b',
          name: 'CAN 2.0B',
          summary:
            'Classical CAN extended frame format whose 29-bit identifier (11-bit base plus 18-bit extension) carries higher-layer protocols such as J1939 and NMEA 2000.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'can-2-0b',
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
            'Frame Decoder',
            'Extended Identifier',
            'Base/Extended Comparison',
            'Arbitration',
            'DLC',
            'Data',
            'Bit Stuffing',
            'CRC',
            'ACK',
            'Higher-Layer Candidates',
            'Timing',
            'Bus Load',
            'Period/Jitter',
            'Error Frames',
          ],
          definitions: ['dbc'],
          // 29-bit ID tek başına protokol kanıtı değildir; sayfa aday üst
          // katmanlara hızlı geçiş vermek zorunda, karar kullanıcınındır.
          related: [
            'automotive/vehicle-network-protocols/j1939',
            'automotive/vehicle-network-protocols/canopen',
            'automotive/diagnostics/iso-tp',
          ],
        },
        {
          id: 'can-fd',
          name: 'CAN FD',
          summary:
            'Second-generation CAN data-link format extending the payload to 64 bytes and allowing the data phase to switch to a faster bit rate.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'can-fd',
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
          // DLC artık doğrudan byte sayısı değil: 9..15 aralığı 12/16/20/24/32/
          // 48/64 byte'a eşlenir. Eşleme tablosu ayrı bir araç başlığıdır.
          tools: [
            'Frame Decoder',
            'FDF',
            'BRS',
            'ESI',
            'DLC Mapping',
            '64-byte Payload',
            'Nominal Timing',
            'Data Timing',
            'Sample Point',
            'CRC',
            'ISO / Non-ISO Variant',
            'Bus Load',
          ],
          definitions: ['dbc'],
        },
        {
          id: 'can-xl',
          name: 'CAN XL',
          summary:
            'Third-generation CAN data-link layer with a 1–2048 byte data field that splits the classical identifier into an 11-bit priority ID and a 32-bit acceptance field.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'can-xl',
          // Kaynak ilk sürüm için bilinçli olarak tam stack yerine yalnız
          // frame-level inspection istiyor: build/timing/diagnostics yok.
          tabs: ['overview', 'live', 'decode', 'data', 'definitions', 'examples'],
          tools: [
            'Frame Inspector',
            'Priority ID',
            'Acceptance Field',
            'SDT',
            'VCID',
            'DLC',
            'Large Payload',
            'Hex Viewer',
            'Payload Export',
          ],
          definitions: ['dbc'],
        },
      ],
    },
    {
      id: 'vehicle-network-protocols',
      name: 'Vehicle Network Protocols',
      summary:
        'Higher-layer and non-CAN in-vehicle networks, from heavy-duty J1939 to deterministic FlexRay and legacy Class-B J1850.',
      protocols: [
        {
          id: 'j1939',
          name: 'J1939',
          summary:
            'CAN-based communication architecture for heavy-duty trucks, agricultural and construction machinery, addressing messages by PGN and nodes by claimed source address.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'j1939',
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
          // Katalog borcu (dalga 1c'de kapatıldı): DBC paneli önceden yalnız
          // marine-j1939 ALIAS'ında açılıyordu, kanonik kayıtta değil — zincir
          // ters yönde işliyordu. `definitions` artık kanonikte de var.
          definitions: ['dbc'],
          // PGN hesabı PF eşiğine bağlıdır: PDU1'de PS bir hedef adrestir ve
          // PGN'den düşülür, PDU2'de group extension olarak PGN'e girer.
          tools: [
            '29-bit ID',
            'Priority',
            'PGN',
            'PDU1/PDU2',
            'Source Address',
            'Destination',
            'SPN',
            'Physical Values',
            'Address Claim',
            'Transport Protocol',
            'BAM/RTS/CTS Sessions',
            'DM1/DM2',
            'DTC',
            'FMI',
            'Period/Jitter',
          ],
          related: ['automotive/can-family/can-2-0b'],
        },
        {
          id: 'canopen',
          name: 'CANopen',
          summary:
            'Object-dictionary based CAN application layer seen in electric drivetrains, special-purpose vehicles and auxiliary ECUs, built on NMT, SDO, PDO, SYNC, EMCY and heartbeat services.',
          layer: 'application',
          status: 'planned',
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
            'NMT State Machine',
            'SDO',
            'PDO Mapping',
            'SYNC',
            'EMCY',
            'Heartbeat',
            'Object Dictionary',
            'Node ID',
            'CiA 402 Profile',
            'EDS Import',
          ],
          definitions: ['eds'],
          // Kanonik kayıt endüstriyel otomasyonda; buradaki kayıt otomotiv
          // bağlamı için kasıtlı tekrardır, 172 sayımı bunu içerir.
          aliasOf: 'industrial-automation/cip-can-based/canopen',
        },
        {
          id: 'lin',
          name: 'LIN',
          summary:
            'Low-cost single-wire automotive subnetwork where a commander polls responders through a fixed schedule table of break, sync, PID, data and checksum frames.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'lin',
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
            'Break',
            'Sync',
            'PID',
            'Parity',
            'Data',
            'Checksum',
            'Classic/Enhanced Checksum',
            'Schedule Table',
            'Nodes',
            'LDF Import',
          ],
          definitions: ['ldf'],
        },
        {
          id: 'flexray',
          name: 'FlexRay',
          summary:
            'Deterministic, time-triggered dual-channel network for chassis and safety domains, splitting each communication cycle into static and dynamic segments.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Channel A/B',
            'Communication Cycle',
            'Static Segment',
            'Dynamic Segment',
            'Symbol Window',
            'Network Idle Time',
            'Frame Decoder',
            'Cycle Count',
            'Header CRC',
            'Frame CRC',
            'Slot Violation',
          ],
        },
        {
          id: 'sae-j1850-pwm',
          name: 'SAE J1850 PWM',
          summary:
            'Legacy Class-B vehicle network in its 41.6 kbit/s pulse-width-modulated two-wire form, decoded from raw pulse widths rather than byte-clocked serial data.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'diagnostics', 'examples'],
          // Bit eşiği profile bağlıdır; "8 us = 1" gibi sabitler evrensel
          // değildir, decoder eşiği seçilen J1850 profilinden almalıdır.
          tools: [
            'Pulse Analyzer',
            'Pulse Width',
            'Threshold',
            'Decoded Bit',
            'Confidence',
            'Frame Analyzer',
            'SOF/EOD/EOF',
            'Header',
            'CRC',
            'Collision Detection',
          ],
          related: ['automotive/vehicle-network-protocols/sae-j1850-vpw'],
        },
        {
          id: 'sae-j1850-vpw',
          name: 'SAE J1850 VPW',
          summary:
            'Single-wire 10.4 kbit/s variable-pulse-width variant of J1850 where a bit follows from the active/passive state combined with the pulse duration, commonly carrying legacy OBD-II traffic.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Pulse Capture',
            'Symbol Decode',
            'Active/Passive State',
            'Bits',
            'Bytes',
            'Frame Analyzer',
            'CRC',
            'OBD Message Chaining',
          ],
          // Zincirleme çözümleme kaynakta açıkça isteniyor:
          // J1850 VPW → OBD-II → Mode → PID.
          related: [
            'automotive/vehicle-network-protocols/sae-j1850-pwm',
            'automotive/diagnostics/obd-ii',
          ],
        },
      ],
    },
    {
      id: 'sensor-interfaces',
      name: 'Automotive Sensor Interfaces',
      summary:
        'Point-to-point sensor-to-ECU links whose information lives in pulse durations and current levels rather than in byte-clocked serial frames.',
      protocols: [
        {
          id: 'sent',
          name: 'SENT',
          summary:
            'SAE J2716 single-edge nibble transmission, encoding sensor values as pulse durations on a one-way line used by throttle, pressure and position sensors.',
          layer: 'physical',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          // Tick time capture'dan kestirilir; sabit varsayılmaz. Tolerans ve
          // nibble sayısı seçilen J2716 revizyonuna/profiline göre değişir.
          tools: [
            'Pulse Analyzer',
            'Sync Pulse',
            'Tick Time',
            'Status Nibble',
            'Data Nibbles',
            'CRC',
            'Fast Channel',
            'Slow Channel',
            'Pause Pulse',
            'Pulse Width Graph',
          ],
          related: ['automotive/sensor-interfaces/spc'],
        },
        {
          id: 'spc',
          name: 'SPC',
          summary:
            'Short PWM Code extension of SENT in which the ECU drives a trigger pulse on the sensor line to request a response frame or switch the sensor mode.',
          layer: 'physical',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Trigger Pulse',
            'Request',
            'Response Delay',
            'SENT Response',
            'Transaction Timeline',
            'Sensor Selection',
            'Diagnostics',
          ],
          related: ['automotive/sensor-interfaces/sent'],
        },
        {
          id: 'psi5',
          name: 'PSI5',
          summary:
            'Current-modulated two-wire peripheral sensor interface used mainly for airbag and chassis safety sensors, multiplexing several sensors into time slots after a sync pulse.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          // Tek global frame formatı yoktur: CRC, frame boyu ve slot kuralları
          // seçilen application profile'dan (Airbag/Chassis/Powertrain) gelir.
          tools: [
            'Sensor Channels',
            'Sync',
            'Slots',
            'Slot View',
            'Data',
            'Parity',
            'CRC',
            'Sensor Address',
            'Sensor Status',
            'Sync/Async Mode',
            'Application Profile',
          ],
        },
      ],
    },
    {
      id: 'legacy-diagnostics',
      name: 'Legacy Diagnostics',
      summary:
        'Pre-CAN diagnostic communication over the single-wire K-Line, where initialization style rather than framing tells the protocols apart.',
      protocols: [
        {
          id: 'k-line',
          name: 'K-Line',
          summary:
            'Single-wire UART-based physical diagnostic line that carries ISO 9141, KWP2000, UDS or OEM proprietary protocols on top of it.',
          layer: 'physical',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'diagnostics', 'examples'],
          // ISO 9141 ve ISO 14230 initialization yöntemleri aynı hatta bir arada
          // bulunabilir; ayrımı tester yapmak zorunda, analizör tahmin etmemeli.
          tools: [
            'Idle Detection',
            'Initialization Detector',
            '5-Baud Init',
            'Fast Init',
            'Request/Response View',
            'Inter-byte Gap',
            'Inter-message Gap',
            'Timing',
          ],
          related: [
            'automotive/legacy-diagnostics/iso-9141',
            'automotive/legacy-diagnostics/iso-14230',
          ],
        },
        {
          id: 'iso-9141',
          name: 'ISO 9141',
          summary:
            'Early emissions-related diagnostic communication standard that opens a session with a 5-baud address, exchanges keyword bytes and then checksummed request/response messages.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Initialization',
            'Keyword/Synchronization',
            'Target/Source Address',
            'Data Bytes',
            'Checksum',
            'Timing',
            'Init Timeout Detection',
          ],
          related: [
            'automotive/legacy-diagnostics/k-line',
            'automotive/legacy-diagnostics/iso-14230',
          ],
        },
        {
          id: 'iso-14230',
          name: 'ISO 14230 (KWP2000)',
          summary:
            'Keyword Protocol 2000 over K-Line, defining both the addressed header/length framing and the diagnostic service set that UDS later replaced.',
          layer: 'multi-layer',
          status: 'planned',
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
            'Format Byte',
            'Target Address',
            'Source Address',
            'Length',
            'Service ID',
            'Checksum',
            '5-Baud Init',
            'Fast Init',
            'KWP Service Parser',
            'Negative Response',
            'KWP2000 vs UDS Comparison',
          ],
          // Legacy ECU'dan UDS tabanlı ECU'ya geçişte servis karşılıklarının
          // yan yana görünmesi kaynakta özellikle isteniyor.
          related: ['automotive/legacy-diagnostics/k-line', 'automotive/diagnostics/uds'],
        },
      ],
    },
    {
      id: 'diagnostics',
      name: 'Diagnostics',
      summary:
        'The modern diagnostic stack: segmented transport over CAN, transport-independent UDS services, emissions-related OBD-II access and DoIP over Ethernet.',
      protocols: [
        {
          id: 'iso-tp',
          name: 'ISO-TP',
          summary:
            'ISO 15765-2 transport protocol that segments diagnostic messages longer than a CAN payload into first, consecutive and flow-control frames.',
          layer: 'transport',
          status: 'ready',
          pluginId: 'iso-tp',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          // Sequence number 1..F sonrası 0'a sarar; eksik CF tespiti bu sarmayı
          // hesaba katmazsa her 16 frame'de yanlış alarm üretir.
          tools: [
            'Single Frame',
            'First Frame',
            'Consecutive Frame',
            'Flow Control',
            'Block Size',
            'STmin',
            'Sequence Check',
            'Reassembly',
            'Addressing Mode',
            'Padding',
            'Timing',
          ],
          related: [
            'automotive/diagnostics/uds',
            'automotive/diagnostics/obd-ii',
            'automotive/diagnostics/doip',
          ],
        },
        {
          id: 'uds',
          name: 'UDS',
          summary:
            'ISO 14229 unified diagnostic services defining sessions, data identifiers, DTC access, security access and ECU programming independently of the underlying transport.',
          layer: 'application',
          status: 'ready',
          pluginId: 'uds',
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
          // Güvenlik sınırı: seed-key yalnız pasif olarak izlenir. Analizör
          // anahtarı kırmaya ya da tahmin etmeye çalışmaz.
          tools: [
            'Sessions',
            'Services',
            'SID Decoder',
            'DID',
            'DID Database',
            'DTC',
            'Security Access',
            'Routine Control',
            'Programming',
            'Positive Response',
            'Negative Response',
            'NRC Decoder',
          ],
          related: [
            'automotive/diagnostics/iso-tp',
            'automotive/diagnostics/obd-ii',
            'automotive/diagnostics/doip',
          ],
        },
        {
          id: 'obd-ii',
          name: 'OBD-II',
          summary:
            'Standardized emissions-related access model (SAE J1979) exposing live data, stored and pending DTCs, freeze frames and vehicle information through numbered modes and PIDs.',
          layer: 'application',
          status: 'partial',
          pluginId: 'obd-ii',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Modes',
            'PID Browser',
            'PID Formulas',
            'Live Data',
            'DTC',
            'DTC Class Decoder',
            'Freeze Frame',
            'Vehicle Information',
            'VIN Reassembly',
          ],
          related: [
            'automotive/diagnostics/iso-tp',
            'automotive/diagnostics/uds',
            'automotive/diagnostics/doip',
          ],
        },
        {
          id: 'doip',
          name: 'DoIP',
          summary:
            'ISO 13400 diagnostics over IP, adding vehicle discovery, routing activation and logical addressing so UDS payloads can travel over TCP/UDP on automotive Ethernet.',
          layer: 'transport',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Vehicle Discovery',
            'Routing Activation',
            'Logical Addresses',
            'Diagnostic Messages',
            'Alive Check',
            'TCP Session',
            'Connection State Machine',
            'TLS Status',
            'UDS Decoder',
          ],
          related: [
            'automotive/diagnostics/iso-tp',
            'automotive/diagnostics/uds',
            'automotive/diagnostics/obd-ii',
            'automotive/automotive-ethernet/automotive-ethernet',
          ],
        },
      ],
    },
    {
      id: 'automotive-ethernet',
      name: 'Automotive Ethernet',
      summary:
        'The IP-based in-vehicle backbone and the service-oriented middleware that runs on it.',
      protocols: [
        {
          id: 'automotive-ethernet',
          name: 'Automotive Ethernet',
          summary:
            'Single-pair 100BASE-T1 and 1000BASE-T1 vehicle networking with VLAN, TSN and IP layers carrying camera, ADAS, infotainment and diagnostic traffic.',
          layer: 'multi-layer',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            '100BASE-T1',
            '1000BASE-T1',
            'VLAN',
            'IP',
            'UDP/TCP',
            'Communication Matrix',
            'Traffic Matrix',
            'Bandwidth',
            'Top Talkers',
            'Latency/Jitter',
            'Packet Loss',
          ],
          related: [
            'automotive/automotive-ethernet/some-ip',
            'automotive/diagnostics/doip',
            'automotive/calibration/xcp-on-ethernet',
          ],
        },
        {
          id: 'some-ip',
          name: 'SOME/IP',
          summary:
            'AUTOSAR service-oriented middleware over automotive Ethernet, correlating requests and responses by session ID and announcing services through its own discovery protocol.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Service',
            'Method',
            'Event',
            'Request/Response',
            'Session',
            'Payload',
            'Service Discovery',
            'Service Browser',
            'Return Code',
          ],
          related: ['automotive/automotive-ethernet/automotive-ethernet'],
        },
      ],
    },
    {
      id: 'calibration',
      name: 'Calibration',
      summary:
        'Master-slave measurement and calibration protocols that read and write ECU memory through addresses described by an A2L file.',
      protocols: [
        {
          id: 'xcp-on-can',
          name: 'XCP on CAN',
          summary:
            'ASAM MCD-1 XCP measurement, calibration, stimulation and programming carried over CAN or CAN FD between a calibration tool and the ECU.',
          layer: 'application',
          status: 'planned',
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
          // Ham DTO baytları A2L olmadan anlamsızdır: fiziksel değer ancak
          // measurement/characteristic tanımıyla birlikte üretilebilir.
          tools: [
            'CTO',
            'DTO',
            'Commands',
            'DAQ',
            'ODT',
            'Event Channels',
            'Measurement',
            'Calibration',
            'A2L Import',
            'Lost DTO',
            'Transaction Tree',
          ],
          definitions: ['a2l'],
          related: [
            'automotive/calibration/xcp-on-ethernet',
            'automotive/calibration/ccp',
          ],
        },
        {
          id: 'xcp-on-ethernet',
          name: 'XCP on Ethernet',
          summary:
            'The same XCP base protocol transported over UDP/IP or TCP/IP, where high-rate DAQ streams need packet-loss, ordering and time-correlation analysis.',
          layer: 'application',
          status: 'planned',
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
            'XCP Transport Header',
            'UDP/TCP Transport',
            'Stream Reassembly',
            'CTO',
            'DTO',
            'DAQ',
            'Sequence Gap',
            'Packet Loss',
            'Throughput',
            'Time Correlation',
            'A2L Import',
          ],
          definitions: ['a2l'],
          related: [
            'automotive/calibration/xcp-on-can',
            'automotive/automotive-ethernet/automotive-ethernet',
          ],
        },
        {
          id: 'ccp',
          name: 'CCP',
          summary:
            'CAN Calibration Protocol, the CAN-specific predecessor of XCP that ASAM now classifies as legacy but which is still found in older ECU projects.',
          layer: 'application',
          status: 'planned',
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
            'CRO',
            'DTO',
            'Commands',
            'Counter',
            'Command Flow',
            'DAQ',
            'Measurement',
            'A2L Mapping',
            'CCP vs XCP Comparison',
          ],
          definitions: ['a2l'],
          // ASAM yeni tasarımlarda XCP öneriyor; karşılaştırma paneli bu geçişi
          // görünür kılmak için var, iki sayfa arası geçiş zorunlu.
          related: ['automotive/calibration/xcp-on-can'],
        },
      ],
    },
  ],
};
