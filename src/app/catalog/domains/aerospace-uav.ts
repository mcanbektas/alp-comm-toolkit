import type { CatalogDomain } from '../types';

/**
 * Domain 5 — Aerospace & UAV: 6 aile, 16 protokol.
 *
 * Bu domain'in ayırt edici yanı, protokollerin tek başına değil ortak bir
 * "flight state" modeline bağlanarak okunmasıdır: MAVLink Yaw, DroneCAN
 * Attitude ve ARINC Heading aynı zaman çizelgesinde karşılaştırılabilir.
 * Bu yüzden neredeyse her kayıtta `timing` ve `diagnostics` açıktır —
 * tazelik (age), rate ve jitter burada protokolden bağımsız ortak dildir.
 */
export const aerospaceUavDomain: CatalogDomain = {
  id: 'aerospace-uav',
  name: 'Aerospace & UAV',
  summary:
    'Flight-side communication from RC sticks to ground station: UAV telemetry, distributed CAN avionics, RC control links, certified avionics buses, surveillance downlinks and the GNSS layer underneath.',
  highlights: ['MAVLink', 'DroneCAN', 'CRSF', 'ARINC 429', 'MIL-STD-1553', 'ADS-B'],
  families: [
    {
      id: 'uav-telemetry',
      name: 'UAV Telemetry',
      summary:
        'Vehicle-to-ground and component-to-component messaging that carries attitude, position, battery, commands and parameters off the aircraft.',
      protocols: [
        {
          // MAVLink 1 ve 2 ayrı wire format'tır (STX 0xFE/0xFD, 8/24-bit MSGID,
          // signing yalnız v2'de) ama aynı mesaj sözlüğünü ve aynı decoder'ı
          // paylaşırlar; bu yüzden tek kayıt, sürüm farkı `tools` içinde.
          id: 'mavlink',
          name: 'MAVLink',
          summary:
            'Lightweight binary messaging protocol for UAV and robotics systems, carrying vehicle telemetry, commands, parameters and missions between autopilot components and the ground control station.',
          layer: 'application',
          // Header çerçeve düzeyinde tam çözülür ama CRC-16/MCRF4XX + CRC_EXTRA
          // dialect'e bağlı olduğu için doğrulanamaz — 'ready' yanıltıcı olurdu
          // (OBD-II emsali, karar turu brief-faz10-dalga3.md).
          status: 'partial',
          pluginId: 'mavlink',
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
            'Frame Decoder (MAVLink 1 / MAVLink 2)',
            'System / Component Tree',
            'Message Browser',
            'HEARTBEAT',
            'ATTITUDE',
            'GPS',
            'Position',
            'Battery',
            'Commands',
            'ACK',
            'Parameters',
            'Mission',
            'CRC (CRC_EXTRA)',
            'Signing',
            'Payload Serialization',
            'Packet Loss',
            'Message Rate',
            'Link Analyzer',
          ],
          // Dialect XML'i olmadan alanlar okunamaz: generator alanları native
          // tip boyutuna göre yeniden sıralar, XML bildirim sırası wire sırası
          // DEĞİLDİR. Sabit byte offset'i bu yüzden yasak — tanım yüklenmeli.
          definitions: ['custom-schema'],
          related: [
            'aerospace-uav/distributed-uav-networks/dronecan',
            'aerospace-uav/rc-control-links/crsf',
            'aerospace-uav/gnss-navigation/gps-ubx',
          ],
        },
      ],
    },
    {
      id: 'distributed-uav-networks',
      name: 'Distributed UAV Networks',
      summary:
        'Masterless, DSDL-typed node networks that connect ESCs, GNSS receivers and sensors to the flight controller without a bus master.',
      protocols: [
        {
          id: 'dronecan',
          name: 'DroneCAN (UAVCAN v0)',
          summary:
            'Masterless CAN-based protocol for UAV and robotics distributed embedded networks, carrying DSDL-typed transfers over 29-bit CAN 2.0B identifiers to ESCs, GNSS units and airspeed sensors.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'dronecan',
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
            'CAN ID Decoder (29-bit)',
            'Transfer Type',
            'Tail Byte',
            'Transfer ID',
            'Multi-Frame Reassembly',
            'Transfer CRC',
            'DSDL Browser',
            'ESC Status',
            'GNSS',
            'Node Status',
          ],
          // DSDL alanları bit-packed'dir ve byte hizası garanti değildir;
          // fiziksel alan çıkarımı yalnız derlenmiş tanımdan yapılabilir.
          definitions: ['dsdl'],
          related: [
            'aerospace-uav/distributed-uav-networks/cyphal',
            'aerospace-uav/distributed-uav-networks/uavcan-compatibility',
          ],
        },
        {
          id: 'cyphal',
          name: 'Cyphal',
          summary:
            'Transport-agnostic successor of the UAVCAN v1 line, organising avionics traffic into publish/subscribe subjects and request/response services over Cyphal/CAN, Cyphal/UDP or Cyphal/serial.',
          layer: 'multi-layer',
          // `partial` BİLİNÇLİ KAPSAM KARARI (dalga 15b), kaynak eksikliği
          // DEĞİL: motor Cyphal/CAN **Classic CAN 2.0B**'yi tam çözüyor;
          // Cyphal/UDP, Cyphal/Serial ve CAN FD kapsam DIŞI. CAN FD ayrı
          // sayılır çünkü dolgu baytları transfer CRC'sinin İÇİNDEDİR —
          // "aynı biçim, daha uzun payload" değildir (bkz. cyphal.ts dosya
          // başı). Emsal: iec-61850 GOOSE-only, cc-link-ie 0x890F-only.
          status: 'partial',
          pluginId: 'cyphal',
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
            'Subjects',
            'Services',
            'Heartbeat',
            'DSDL Browser',
            'Cyphal/CAN',
            'Cyphal/UDP',
            'Cyphal/Serial',
            'Network Graph',
            'Register Access',
          ],
          // Sürüm ayrımı anlamlıdır: v1.0 stable (default), v1.1 yalnız
          // explicit opt-in ile experimental — parser default'u kaydırılmaz.
          definitions: ['dsdl'],
          related: [
            'aerospace-uav/distributed-uav-networks/dronecan',
            'aerospace-uav/distributed-uav-networks/uavcan-compatibility',
          ],
        },
        {
          // Bağımsız bir wire protokolü değil: "UAVCAN" adının iki ayrı hattı
          // (v0 → DroneCAN, v1 → Cyphal) işaret etmesinden doğan karışıklığı
          // çözen köprü/uyumluluk katmanı. Belirsiz `Protocol: UAVCAN` seçimi
          // kabul edilmez; kullanıcı hattı açıkça seçmek zorundadır.
          id: 'uavcan-compatibility',
          name: 'UAVCAN Compatibility',
          summary:
            'Bridge and disambiguation layer rather than a wire protocol: it maps the legacy UAVCAN v0 (DroneCAN) and UAVCAN v1 (Cyphal) lines onto the correct parser and reports auto-detection candidates from an ambiguous CAN capture.',
          layer: 'multi-layer',
          // `partial`: kayıt ÇÖZMÜYOR, SINIFLANDIRIYOR — alan tablosu yerine
          // aday tablosu üretir ve kullanıcıyı kanonik kayda yönlendirir.
          // `decode` sekmesi AÇIK kalır (14a'nın parser'sız LoRa paterni
          // BURAYA OTURMUYOR: gösterilecek gerçek bir şey var).
          status: 'partial',
          pluginId: 'uavcan-compatibility',
          tabs: ['overview', 'decode', 'diagnostics', 'examples'],
          tools: [
            'Naming Disambiguation Panel',
            'Protocol Selector Guard',
            'Auto-Detection Candidates',
            'DroneCAN / Cyphal Feature Matrix',
            'Legacy Migration Notes',
          ],
          related: [
            'aerospace-uav/distributed-uav-networks/dronecan',
            'aerospace-uav/distributed-uav-networks/cyphal',
          ],
        },
      ],
    },
    {
      id: 'rc-control-links',
      name: 'RC & Control Links',
      summary:
        'Pilot-side links from transmitter to receiver to actuator, all reduced to one failsafe state machine and correlated with flight-mode changes.',
      protocols: [
        {
          id: 'sbus',
          name: 'SBUS',
          summary:
            "Futaba's inverted 100000-baud serial bus that packs sixteen 11-bit RC channels plus flag bits into a 25-byte frame shared by receiver, servos and flight controller.",
          layer: 'data-link',
          // Alan yapısının tamamı çözülür, iki bağımsız kaynak (spec +
          // Betaflight) örtüşüyor. Checksum YOK — doğrulanacak bir bütünlük
          // alanı olmaması `partial` gerekçesi DEĞİL (protokolde yok, eksik
          // uygulama değil). Faz 10 dalga 15c, bkz. sbus.ts dosya başı.
          status: 'ready',
          pluginId: 'sbus',
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
            'Serial Configuration',
            'Frame Decoder',
            '16 Channels',
            'Packed Bits (11-bit)',
            'Flags',
            'Frame Lost',
            'Failsafe',
            'RC Monitor',
            'Normalization',
            'Protocol Auto-Detection',
          ],
          // Tuzak: 16 × 11 bit = 22 byte, kanal alanları byte sınırına HİZALI
          // DEĞİL. `CH1 = Byte1+Byte2` gibi byte-aligned okuma yanlıştır;
          // ayrıca packed raw değer doğrudan PWM mikrosaniyesi sayılamaz.
          related: [
            'aerospace-uav/rc-control-links/ibus',
            'aerospace-uav/rc-control-links/crsf',
          ],
        },
        {
          id: 'ibus',
          name: 'IBUS',
          summary:
            'FlySky serial RC and telemetry bus running at 115200 baud with two-byte channel slots inside a 32-byte packet, plus a newer i-BUS2 tree topology for sensors and peripherals.',
          layer: 'data-link',
          // Klasik i-BUS (iA6/iA6B) TAM çözülür, checksum DOĞRULANIR.
          // `partial`: yalnız i-BUS2 kapsam dışı — FlySky yayınlamamış,
          // Betaflight uygulamamış, halka açık tel biçimi kaynağı YOK
          // (kaynaksız kayıt politikası, dalga 15 ana brif). Faz 10 dalga
          // 15c, bkz. ibus.ts dosya başı.
          status: 'partial',
          pluginId: 'ibus',
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
            'Channel Decode',
            'Checksum',
            'Telemetry',
            'RC Monitor',
            'i-BUS / i-BUS2 Profile',
            'Signal Lost Timeout',
          ],
          // i-BUS ve i-BUS2 aynı wire format değildir; tek profil altında
          // birleştirilmemeli, kullanıcı hangi profili çözdüğünü seçmeli.
          related: [
            'aerospace-uav/rc-control-links/sbus',
            'aerospace-uav/rc-control-links/crsf',
          ],
        },
        {
          id: 'crsf',
          name: 'CRSF',
          summary:
            "TBS Crossfire's bidirectional low-latency serial protocol between radio, receiver and flight controller, carrying packed RC channels, link statistics, telemetry and device configuration.",
          layer: 'data-link',
          // Kaynak MÜKEMMEL: TBS'in resmî spec'i ve Betaflight'ın referans
          // uygulaması birbirini örtüyor. Çerçeve düzeyi (adres, uzunluk,
          // tip, iki AYRI CRC-8, RC kanalları) TAM çözülür ve doğrulanır;
          // payload yalnız `0x16` için çözülür ama bu bir kapsam daraltması
          // DEĞİL (bkz. crsf.ts dosya başı). Faz 10 dalga 15d.
          status: 'ready',
          pluginId: 'crsf',
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
            'Extended Frame',
            'RC Channels',
            'Link Statistics',
            'GPS',
            'Battery',
            'Vario',
            'Airspeed',
            'RPM',
            'Temperature',
            'Telemetry',
            'Device Info',
            'CRC',
            'Baud Negotiation',
          ],
          // Frame CRC ile extended komutların komut-özel CRC'si ayrı tutulur;
          // tek bir "CRC PASS" göstergesine indirgenemez.
          related: [
            'aerospace-uav/rc-control-links/sbus',
            'aerospace-uav/rc-control-links/ibus',
            'aerospace-uav/uav-telemetry/mavlink',
          ],
        },
        {
          // PPM ve PWM Servo taksonomide tek "Pulse Control" sayfası olarak
          // anlatılır; burada ayrı kayıt tutulur çünkü topoloji farklıdır:
          // PPM tek hatta çok kanal, PWM servo kanal başına ayrı hat.
          id: 'ppm',
          name: 'PPM',
          summary:
            'Legacy pulse-position signal that time-encodes several RC channels inside a single pulse train delimited by a sync gap, decoded from capture edges rather than from bytes.',
          layer: 'physical',
          // Konteyner (`pulseLog.ts`) `canParse` KALİBRASYONSUZ DAİMA `false`
          // döner (`uavcanCompatibility` sınıfı karar) — bu bir eksiklik
          // değil, evrensel bir pulse-width bandı olmadığı için otomatik
          // algılamanın bilinçli olarak dışarıda bırakılmasıdır. Faz 10
          // dalga 15e, bkz. ppm.ts dosya başı.
          status: 'ready',
          pluginId: 'ppm',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Pulse Width',
            'Frame Period',
            'Sync Gap Detection',
            'Channel Decode',
            'Normalization',
            'Jitter',
            'Failsafe',
            'Polarity',
            'Frame State Machine',
          ],
          // Evrensel bir pulse-width eşlemesi YOKTUR; Min/Center/Max ve sync
          // gap kullanıcı kalibrasyonudur, preset olarak hard-code edilemez.
          related: ['aerospace-uav/rc-control-links/pwm-servo'],
        },
        {
          id: 'pwm-servo',
          name: 'PWM Servo',
          summary:
            'Classic per-channel RC actuator signal where the pulse high time sets servo position, analysed for pulse width, frame period, frequency, duty cycle, jitter and missing pulses.',
          layer: 'physical',
          // Aynı konteyner, AYRI yorum (HIGH/LOW çifti) — `ppm`den BAĞIMSIZ
          // modül (Karar 15e-1). `canParse` aynı gerekçeyle DAİMA `false`.
          // Faz 10 dalga 15e, bkz. pwmServo.ts dosya başı.
          status: 'ready',
          pluginId: 'pwm-servo',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Pulse Width',
            'Frame Period',
            'Frequency',
            'Duty Cycle',
            'Servo Position Normalization',
            'Jitter',
            'Missing Pulse',
            'Multi-Channel View',
          ],
          // 20 ms / 50 Hz yalnız bir konfigürasyon örneğidir; digital ve
          // high-speed servolar farklı refresh rate ve pulse aralığı kullanır.
          related: ['aerospace-uav/rc-control-links/ppm'],
        },
      ],
    },
    {
      id: 'avionics-data-buses',
      name: 'Avionics Data Buses',
      summary:
        'Certified aircraft buses whose raw words carry no engineering meaning on their own — an equipment ICD must be loaded before any value can be trusted.',
      protocols: [
        {
          // `live` yok: ilk sürümde analog waveform yakalama hedeflenmiyor,
          // girdi 32-bit raw word / HEX / CSV / adapter log dosyasıdır.
          id: 'arinc-429',
          name: 'ARINC 429',
          summary:
            'Widely used civil avionics data bus that broadcasts 32-bit words split into Label, SDI, Data, SSM and Parity between guidance, navigation, flight control and communication equipment.',
          layer: 'multi-layer',
          // Beş alanın hepsi çözülüyor ve parite GERÇEKTEN doğrulanıyor; Label
          // bit sırası dört bağımsız kaynakla çaprazlandı. Çözülmeyen tek şey
          // Label/SDI/Discrete-bit ANLAMI ve o çerçevede DEĞİL equipment
          // ICD'sinde — bir kapsam daraltması değil (Faz 10 dalga 15f,
          // bkz. arinc429.ts dosya başı).
          status: 'ready',
          pluginId: 'arinc-429',
          tabs: [
            'overview',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            '32-bit Word Decoder',
            'Label (Octal / Binary / Decimal)',
            'SDI',
            'Data Field',
            'SSM',
            'Parity',
            'BNR',
            'BCD',
            'Discrete',
            'Scale / Resolution',
            'Label Rate',
            'Inter-word Gap',
            'Missing Label',
            'Equipment ICD Database',
          ],
          // Label anlamı global DEĞİLDİR, equipment ICD'sine bağlıdır; SSM
          // yorumu da seçilen data encoding'e (BNR/BCD/Discrete) göre değişir.
          definitions: ['vendor-map', 'custom-schema'],
          related: ['aerospace-uav/avionics-data-buses/mil-std-1553'],
        },
        {
          id: 'mil-std-1553',
          name: 'MIL-STD-1553',
          summary:
            'Military command/response time-division multiplex avionics bus where a Bus Controller drives Remote Terminals over redundant Bus A/B while a passive Bus Monitor records every transaction.',
          layer: 'multi-layer',
          // Command / Status / Data sözcüklerinin alan sınırları dört bağımsız
          // uygulamayla çaprazlandı ve gerçekten çözülüyor. Çözülmeyen tek şey
          // sözcük TİPİdir ve o çerçevede DEĞİL 3 bitlik senkron darbesindedir
          // — üstelik Command ile Status aynı senkronu paylaşır. Tip
          // kullanıcıdan alınır (`wordType`), tahmin EDİLMEZ; bu bir kapsam
          // daraltması değil, girdinin kendisinde olmayan bir bilgidir
          // (Faz 10 dalga 15g, bkz. mil1553.ts dosya başı).
          status: 'ready',
          pluginId: 'mil-std-1553',
          tabs: [
            'overview',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'BC / RT / BM Roles',
            'Command Word',
            'Status Word',
            'Data Word',
            'Transaction Timeline',
            'RT / Subaddress Explorer',
            'Mode Codes',
            'Bus A/B Redundancy',
            'Response Time',
            'Inter-word Gap',
            'Bus Utilization',
            'ICD Mapping',
          ],
          // Exact field'lar ve mode-code veritabanı seçilen standard
          // revizyonundan yüklenir; kabul limitleri profile/ICD'den gelir.
          definitions: ['vendor-map', 'custom-schema'],
          related: ['aerospace-uav/avionics-data-buses/arinc-429'],
        },
      ],
    },
    {
      id: 'surveillance',
      name: 'Surveillance',
      summary:
        'Transponder downlinks that turn broadcast frames into a live aircraft table, keeping each field age tracked separately.',
      protocols: [
        {
          id: 'ads-b',
          name: 'ADS-B',
          summary:
            'Automatic Dependent Surveillance–Broadcast, in which aircraft broadcast their own GNSS-derived position, velocity and identity over 1090ES or 978 MHz UAT to ground stations and other traffic.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Aircraft Table',
            'ICAO Address',
            'Callsign',
            'Position',
            'Altitude',
            'Velocity',
            'Heading',
            'CPR',
            'Message Age',
            'CRC',
            '1090ES / UAT Source',
          ],
          // Position/Velocity/Callsign yaşları AYRI tutulur: farklı bilgi
          // türleri farklı anlarda gelir, tek "last seen" yanıltıcıdır.
          related: ['aerospace-uav/surveillance/mode-s'],
        },
        {
          id: 'mode-s',
          name: 'Mode-S',
          summary:
            'Secondary surveillance transponder family with short and extended downlink formats, 24-bit ICAO addressing and 24-bit parity, whose DF17 extended squitter is what ADS-B 1090ES rides on.',
          layer: 'data-link',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'DF Decoder',
            'Short Frame',
            'Extended Frame',
            'ICAO Address',
            'Payload',
            'Parity / CRC',
            'CRC Correction Candidates',
            'DF17 → ADS-B Handoff',
          ],
          // Mode-S ile ADS-B aynı şey sayılmaz. Ayrıca bit düzeltilerek
          // kurtarılan bir mesaj, native-valid frame ile aynı confidence
          // seviyesinde gösterilemez — sahte kesinlik riski.
          related: ['aerospace-uav/surveillance/ads-b'],
        },
      ],
    },
    {
      id: 'gnss-navigation',
      name: 'GNSS & Navigation',
      summary:
        "The aircraft's positioning layer: the same GNSS parsers as marine, presented through a flight navigation dashboard and cross-checked against each other.",
      protocols: [
        {
          // Ailenin üçü de kasıtlı tekrardır: parser motoru Marine'de kanonik,
          // burada yalnız "Flight Navigation Dashboard" görünümü değişir.
          id: 'gps-ubx',
          name: 'GPS UBX',
          summary:
            'u-blox binary UBX navigation output seen through a flight navigation view that maps fix type, position, MSL and ellipsoid altitude, ground speed and accuracy onto the common flight state.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Flight Navigation Dashboard',
            'Fix Type',
            'Position',
            'MSL / Ellipsoid Altitude',
            'Ground Speed',
            'Heading',
            'Vertical Velocity',
            'Accuracy Estimates',
            'Satellite Count',
            'GNSS Cross-Check',
          ],
          related: [
            'aerospace-uav/gnss-navigation/nmea',
            'aerospace-uav/gnss-navigation/rtcm',
            'aerospace-uav/uav-telemetry/mavlink',
          ],
          aliasOf: 'marine-navigation/gnss-corrections/gnss-ubx',
        },
        {
          id: 'rtcm',
          name: 'RTCM',
          summary:
            'Differential GNSS correction stream feeding the RTK rover on board, tracked here for correction age, reference station, constellation and the Float/Fixed state it produces.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'RTCM Message Rate',
            'Correction Age',
            'Reference Station',
            'GNSS Constellation',
            'CRC',
            'Last Received',
            'RTK State (Float / Fixed)',
            'Correction Link Loss Timeline',
          ],
          related: ['aerospace-uav/gnss-navigation/gps-ubx'],
          aliasOf: 'marine-navigation/gnss-corrections/rtcm',
        },
        {
          id: 'nmea',
          name: 'NMEA',
          summary:
            'ASCII GNSS sentence stream read through the flight layer, turning GGA and RMC into position, velocity and time for the flight controller and comparing them against the UBX output of the same receiver.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Sentence Decoder',
            'GGA / RMC',
            'Position / Velocity / Time',
            'Message Rate',
            'Checksum',
            'NMEA / UBX Compare',
            'Flight Navigation Dashboard',
          ],
          related: ['aerospace-uav/gnss-navigation/gps-ubx'],
          aliasOf: 'marine-navigation/nmea-family/nmea-0183',
        },
      ],
    },
  ],
};
