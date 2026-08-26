import type { CatalogDomain } from '../types';

/**
 * Domain 4 — Marine & Navigation: 5 aile, 11 protokol.
 *
 * Bu domain'in iki kasıtlı özelliği var, katalogda gezinirken tuzak oluşturur:
 *
 * 1. GNSS & Corrections ailesindeki `gnss-ubx` ve `rtcm` KANONİK kayıtlardır —
 *    interfaces-framing ve aerospace-uav'daki eşlerinin `aliasOf` hedefi buraya
 *    bakar. Aynı ailedeki `gps-nmea` ise tersine, nmea-family/nmea-0183'ün
 *    alias'ıdır: aynı parser, üzerine GNSS semantic layer.
 * 2. NMEA 2000 ile J1939 aynı 29-bit CAN identifier yapısını paylaşır ama aynı
 *    protokol DEĞİLDİR (biri PGN, diğeri PGN/SPN modeli). Kaynak belge yalnız
 *    29-bit çerçeve görüldü diye kesin sınıflandırma yapılmamasını, bunun yerine
 *    confidence gösterilmesini şart koşuyor; `related` bağı bu yüzden var.
 *
 * IEC 61162'nin beş alt varyantı (-1/-2/-3/-450/-460) ayrı protokol kaydı değil:
 * tek kayıtta `tools` içinde transport profili olarak geçiyor. Ayrı kayıt yapmak
 * 172 sayımını bozardı ve varyantlar bağımsız motor gerektirmiyor. Bu HÂLÂ
 * doğrudur, ama dalga 16c'de bir şey değişti: varyantlardan BİRİNİN (-450)
 * kendine ait, gerçek bir tel biçimi olduğu beş bağımsız uygulamada
 * doğrulandı (`UdPbC\0` + TAG block + NMEA cümlesi). Kayıt artık gerçek bir
 * çözücü taşıyor (`pluginId: 'iec-61162'`, rozet `partial`): `-450`nin ASCII
 * teli ÇÖZÜLÜR, `-1`/`-2`/`-3`/`-460` ise `transportProfile` seçeneğiyle
 * yönlendirme görünümü basar. `-450`nin ikinci (binary `R?UdP`) teli, Ed.2'nin
 * PGN kapsüllemesi ve `a:` authentication içeriği KAPSAM DIŞIDIR.
 *
 * `definitions` alanı buradaki hiçbir protokolde standart bir dosya biçimine
 * (DBC/EDS/…) karşılık gelmez; NMEA sentence revision DB, NMEA 2000 PGN DB, AIS
 * M.1371 mesaj tablosu ve RTCM mesaj numarası DB'si lisanslı/özel şemalardır —
 * bu yüzden 'custom-schema'. Vendor'a özel register/mesaj eşlemeleri 'vendor-map'.
 */
export const marineNavigationDomain: CatalogDomain = {
  id: 'marine-navigation',
  name: 'Marine & Navigation',
  summary:
    'Shipboard navigation, instrument and machinery links — from ASCII NMEA 0183 sentences and CAN-based NMEA 2000 to AIS traffic, GNSS correction streams and legacy proprietary buses.',
  highlights: ['NMEA 0183', 'NMEA 2000', 'AIS', 'IEC 61162', 'RTCM', 'SeaTalk'],
  families: [
    {
      id: 'nmea-family',
      name: 'NMEA Family',
      summary:
        'The core marine sentence and network standards: ASCII NMEA 0183, CAN-based NMEA 2000 and their IEC 61162 international counterparts.',
      protocols: [
        {
          id: 'nmea-0183',
          name: 'NMEA 0183',
          summary:
            'Printable-ASCII sentence protocol on a single-talker / multiple-listener serial bus (4800 baud, 38.4 kbaud in HS form) carrying position, heading, depth and wind between shipboard instruments.',
          layer: 'application',
          status: 'ready',
          pluginId: 'nmea-0183',
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
            'Sentence Monitor',
            'Talker ID',
            'Sentence Formatter',
            'Field Table',
            'Checksum',
            'Checksum XOR Trace',
            'Coordinate Converter',
            'Raw/Parsed Sync',
            'GGA',
            'RMC',
            'GSA',
            'GSV',
            'VTG',
            'HDT/HDG',
            'DPT/DBT',
            'MWV',
            'ROT',
            'Sentence Frequency',
            'Rate/Freshness',
            'Source Conflict',
          ],
          // Alan tanımları rastgele internet tablolarından değil, seçilen NMEA
          // revizyon veritabanından gelmeli — belge bunu açıkça uyarıyor.
          definitions: ['custom-schema'],
          related: ['marine-navigation/nmea-family/iec-61162', 'marine-navigation/ais/ais'],
        },
        {
          id: 'nmea-2000',
          name: 'NMEA 2000',
          summary:
            'CAN-based, multi-master, self-configuring marine network (the IEC 61162-3 SOLAS instrument bus) that addresses navigation, engine and electrical data by PGN over a 29-bit identifier.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'nmea-2000',
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
            'CAN Frame',
            '29-bit Identifier',
            'Priority / PGN / Source / Destination Split',
            'PGN Browser',
            'Fast Packet Reassembly',
            'Single Frame vs Multi-Packet',
            'Device Explorer',
            'Device Discovery',
            'Address Change Tracking',
            'PGN Statistics',
            'PGN Frequency Analysis',
            'Navigation Dashboard',
            'Engine Dashboard',
            'Electrical Dashboard',
          ],
          definitions: ['custom-schema'],
          related: [
            'marine-navigation/nmea-family/iec-61162',
            'marine-navigation/marine-machinery/marine-j1939',
            'automotive/vehicle-network-protocols/j1939',
          ],
        },
        {
          id: 'iec-61162',
          name: 'IEC 61162',
          summary:
            'International standard family for digital interfaces between shipboard navigation and radiocommunication equipment, spanning low-speed serial sentences (-1), high-speed serial (-2), the CAN instrument network (-3) and Ethernet multicast interconnection (-450/-460). DECODED: the IEC 61162-450 "UdPbC" datagram in full — the six-byte UdPbC+NUL token, every TAG block with its own checksum verified over its own byte range, the s:/n:/g:/c:/d:/r:/t:/i: parameters, one or more embedded NMEA sentences each with its own checksum verified over a DIFFERENT byte range, the CRLF terminator and the 1472-byte datagram ceiling. ROUTED, NOT DECODED: -1 and -2 are NMEA 0183 on a serial line (4800 and 38400 bit/s), -3 is NMEA 2000, and -460 defines no application protocol of its own — selecting them prints a routing table pointing at the page that really decodes them. NOT AVAILABLE AT ALL: the second, entirely separate RaUdP/RpUdP/RrUdP binary file transfer wire, the Edition 2 IEC 61162-3 PGN encapsulation (its five-character token is not public), the Edition 2 TCP-based transfer, and the contents of the a: authentication tag (its format is not public — the tag is recognised, never decoded). The multicast transmission group is NOT in the payload at all: it lives in the UDP/IP header, so it can only be supplied by the user and is always flagged as such.',
          layer: 'multi-layer',
          status: 'partial',
          pluginId: 'iec-61162',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Transport Profile',
            'IEC 61162-1',
            'IEC 61162-2',
            'IEC 61162-3',
            'IEC 61162-450',
            'IEC 61162-460',
            'Profile Comparison',
            'Encoding / Talker / Listener Model',
            'Speed Profile & Observed Update Rate',
            'Multicast Sender & Destination',
            'Sequence & Timestamp',
            'Network Zone',
            'Redundancy & Isolation',
            'Unexpected Flow',
          ],
          // -1 kavramsal olarak NMEA 0183, -3 ise doğrudan NMEA 2000 parser'ına yönlendirilir.
          related: [
            'marine-navigation/nmea-family/nmea-0183',
            'marine-navigation/nmea-family/nmea-2000',
          ],
        },
      ],
    },
    {
      id: 'ais',
      name: 'AIS',
      summary:
        'Automatic Identification System traffic, from the !AIVDM transport sentence down to 6-bit message fields and a live vessel target table.',
      protocols: [
        {
          id: 'ais',
          name: 'AIS',
          summary:
            'TDMA vessel-reporting system on the VHF maritime mobile band whose ITU-R M.1371 messages reach the analyzer as !AIVDM/!AIVDO sentences carrying 6-bit armoured position, static and voyage data.',
          layer: 'multi-layer',
          // Zarf (fragment/seq/channel/fill/checksum) TAM + kimlik alanı (Message
          // Type) adlandırılıyor — NMEA 2000/PGN emsaliyle aynı gerekçe (ais.ts
          // dosya başı "DURUM: 'ready'" notuna bak, brief-faz10-dalga3.md).
          status: 'ready',
          pluginId: 'ais',
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
            'AIVDM',
            'AIVDO',
            'Fragment Reassembly',
            '6-bit Decoder',
            'ASCII Armoring Removal',
            'Bit Offset Table',
            'Message Types',
            'MMSI',
            'Navigation Status',
            'Position',
            'SOG/COG',
            'Heading',
            'Static/Voyage Data',
            'Target Table',
            'Target Freshness',
          ],
          definitions: ['custom-schema'],
          // RF/VDL katmanı ayrı; analiz zinciri NMEA 0183 transport üzerinden iner.
          related: ['marine-navigation/nmea-family/nmea-0183'],
        },
      ],
    },
    {
      id: 'gnss-corrections',
      name: 'GNSS & Corrections',
      summary:
        'GNSS position sources and the correction streams that refine them — NMEA sentences, u-blox UBX binary frames and RTCM differential data.',
      protocols: [
        {
          id: 'gps-nmea',
          name: 'GPS NMEA',
          summary:
            'GNSS-focused view of the NMEA 0183 decoder that groups GGA/RMC/GSA/GSV/VTG/GLL/ZDA sentences of one epoch into a single position, fix, satellite and accuracy state.',
          layer: 'application',
          status: 'planned',
          // Parser yeniden yazılmaz; bu sayfa ayrı bir motor değil, semantic layer.
          // Bu yüzden 'build' yok — sentence üretimi kanonik NMEA 0183 sayfasında.
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
            'GNSS Dashboard',
            'Position',
            'Fix',
            'Satellites',
            'HDOP',
            'Altitude',
            'Velocity',
            'COG',
            'Time',
            'Accuracy',
            'Sentence Correlation',
            'GNSS Epoch Grouping',
            'RMC vs GGA Cross-Check',
            'Invalid Fix Guard',
          ],
          definitions: ['custom-schema'],
          related: [
            'marine-navigation/nmea-family/nmea-0183',
            'marine-navigation/gnss-corrections/gnss-ubx',
          ],
          aliasOf: 'marine-navigation/nmea-family/nmea-0183',
        },
        {
          id: 'gnss-ubx',
          name: 'GNSS UBX',
          summary:
            'u-blox binary protocol whose SYNC / CLASS / ID / LENGTH / PAYLOAD / CHECKSUM frames deliver receiver navigation solutions such as UBX-NAV-PVT over UART, USB, SPI or I²C.',
          layer: 'application',
          status: 'ready',
          pluginId: 'gnss-ubx',
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
            'UBX Frame Decoder',
            'Sync / Class / ID',
            'Length & Payload',
            'Checksum',
            'UBX-NAV-PVT',
            'Navigation Solution',
            'Position / Velocity / Heading',
            'Fix & Accuracy',
            'UBX + NMEA Auto-Detect',
            'Mixed Stream Split',
            'UBX vs NMEA Position Comparison',
          ],
          // Temel binary parser interfaces-framing ile paylaşılır; burada üzerine
          // ortak NavigationData modeline dönüştüren marine görünüm oturur.
          related: [
            'interfaces-framing/framing-stream-protocols/ubx',
            'marine-navigation/gnss-corrections/gps-nmea',
          ],
        },
        {
          id: 'rtcm',
          name: 'RTCM',
          summary:
            'Differential GNSS correction format (RTCM 10403.4) whose framed messages carry reference-station, per-constellation, MSM and SSR corrections to high-precision receivers, typically streamed over NTRIP.',
          layer: 'application',
          status: 'ready',
          pluginId: 'rtcm',
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
            'Stream Decoder',
            'Preamble Detection',
            'Length & Payload',
            'Message Type',
            'CRC',
            'Station',
            'Constellation',
            'Epoch',
            'Satellite Count',
            'Signal Type',
            'MSM',
            'SSR',
            'Message Rate',
            'Correction Age',
            'NTRIP Caster & Mount Point',
          ],
          definitions: ['custom-schema'],
          // NTRIP transport, RTCM ise veri biçimi — ikisi karıştırılmamalı.
          // Kullanım alanı denizcilikle sınırlı değil, UAV tarafına da geçiş var.
          related: ['aerospace-uav/gnss-navigation/rtcm'],
        },
      ],
    },
    {
      id: 'marine-machinery',
      name: 'Marine Machinery',
      summary:
        'Propulsion, generator and auxiliary systems that speak general-purpose industrial protocols rather than marine-specific ones.',
      protocols: [
        {
          id: 'marine-j1939',
          name: 'Marine J1939',
          summary:
            'SAE J1939 CAN messaging as used by marine propulsion, generator and machinery controllers, resolving PGN/SPN values into per-source engine dashboards for port, starboard and generator units.',
          layer: 'application',
          status: 'planned',
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
            'CAN → J1939 → PGN → SPN Chain',
            'PGN Decoder',
            'SPN Decoder',
            'Engine Dashboard',
            'Speed / Coolant Temperature / Oil Pressure',
            'Load & Fuel Rate',
            'Diagnostic Status',
            'Multi-Engine Source Mapping',
            'Source Address Identity',
            'NMEA 2000 vs J1939 Confidence',
          ],
          // Semantik SPN isimlendirmesi ancak lisanslı/güncel J1939DA yüklüyse yapılır.
          definitions: ['dbc', 'custom-schema'],
          related: [
            'automotive/vehicle-network-protocols/j1939',
            'marine-navigation/nmea-family/nmea-2000',
          ],
          aliasOf: 'automotive/vehicle-network-protocols/j1939',
        },
        {
          id: 'marine-modbus',
          name: 'Marine Modbus',
          summary:
            'Modbus RTU/TCP as deployed on marine auxiliaries — tank, battery, generator, propulsion and alarm systems — where a vendor register map turns raw holding/input registers into scaled physical values.',
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
            'Register Decoder',
            'Holding / Input Registers',
            'Slave Address',
            'Function Code',
            'Scale & Offset',
            'Byte Order',
            'Vendor Register Map Import',
            'Marine Dashboard',
            'Poll Cycle',
            'Response Time',
            'Exception & Retry',
            'Bus Utilization',
          ],
          // Ayrı bir "Marine Modbus" standardı YOKTUR; doğru model
          // Vendor Register Map → Modbus → RS-485/Ethernet.
          definitions: ['vendor-map'],
          related: [
            'industrial-automation/modbus/modbus-rtu',
            'industrial-automation/modbus/modbus-tcp',
          ],
          aliasOf: 'industrial-automation/modbus/modbus-rtu',
        },
      ],
    },
    {
      id: 'legacy-proprietary-marine',
      name: 'Legacy / Proprietary Marine',
      summary:
        'Vendor-specific and pre-standard shipboard links that need a loaded message map before any field can be named with confidence.',
      protocols: [
        {
          id: 'seatalk',
          name: 'SeaTalk',
          summary:
            "Raymarine's legacy three-wire SeaTalk 1 bus, carrying bidirectional instrument data plus 12 V power in daisy-chain or star topology. DECODED: the envelope (command byte, attribute nibbles, the 3 + n length rule) and the payload of the 22 commands that a second independent implementation confirms. RECOGNISED BUT NOT DECODED: the remaining 37 documented commands print their name only — their field layouts rest on a single reverse-engineered source whose author calls it \"incomplete inaccurate and may even be wrong\". NOT AVAILABLE AT ALL: the datagram-start command bit lives in the UART parity bit and is absent from the bytes, so it is assumed rather than verified; SeaTalk 1 carries no checksum, so no frame can be certified intact; the $STALK container form and SeaTalkNG/NMEA 2000 gateway correlation are out of scope.",
          layer: 'multi-layer',
          status: 'partial',
          pluginId: 'seatalk',
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
            'Byte/Word Stream View',
            'Command Identification',
            'Payload Decoder',
            'Depth / Speed / Wind / Heading',
            'Rudder & Autopilot',
            'Navigation & Waypoint',
            'Instrument Control',
            'Vendor Message Map',
            'SeaTalk1 → SeaTalkNG Gateway View',
            'Conversion Correlation',
            'Duplicate Source Warning',
          ],
          // Açık bir NMEA standardı değil: mesaj tablosu vendor dokümanından ya da
          // kullanıcının doğruladığı eşlemeden yüklenir, tahmin edilmez.
          definitions: ['vendor-map'],
          related: ['marine-navigation/nmea-family/nmea-2000'],
        },
        {
          id: 'hdlc-based-marine',
          name: 'HDLC-Based Marine',
          summary:
            'HDLC and HDLC-like bit framing used by older or vendor-specific shipboard equipment, read conservatively as flag/address/control/information/FCS candidates until a vendor schema names the fields.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'hdlc-based-marine',
          tabs: ['overview', 'live', 'decode', 'data', 'diagnostics', 'definitions', 'examples'],
          tools: [
            'Flag Detection',
            'Bit Destuffing',
            'Frame Structure (Flag / Address / Control / Information / FCS)',
            'FCS CRC-16 Candidate',
            'Candidate Field Marking',
            'Vendor Header & Command',
            'Vendor Schema Import',
            'Unknown Protocol Analyzer',
            'Fixed vs Changing Bytes',
            'Counter Detection',
            'Periodic Field Detection',
            'Sensor Value Correlation',
          ],
          // Şema yüklenmeden alan adı ÜRETİLMEZ — yanlış kesinlik bu bölümde
          // en büyük risk; her alan "candidate" olarak işaretli kalır.
          definitions: ['vendor-map', 'custom-schema'],
        },
      ],
    },
  ],
};
