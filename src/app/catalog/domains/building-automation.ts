import type { CatalogDomain } from '../types';

/**
 * Bina otomasyonu domain'i: 7 aile, 11 protokol.
 *
 * Domain'in birleştirici fikri protokoller değil ortak nokta modelidir —
 * BACnet object'i, KNX group address'i, Modbus register'ı ve M-Bus data
 * record'u aynı `Point` şemasına indirgenir, kullanıcı tek equipment
 * dashboard'unda görür. Bu yüzden neredeyse her kayıtta `data` sekmesi var.
 *
 * Kaynakta üç kez tekrarlanan değişmez: FİZİKSEL ADRES ≠ MANTIKSAL KİMLİK.
 * MS/TP MAC ≠ Device Instance, BACnet/IP'de IP ≠ Device Instance, sACN'de
 * IP ≠ CID. Üçünde de fiziksel adres değişse bile kayıt aynı cihaza
 * korele edilmelidir; ilgili protokollerin `tools` listesi bu ayrımı
 * görünür kılacak başlıkları taşır.
 */
export const buildingAutomationDomain: CatalogDomain = {
  id: 'building-automation',
  name: 'Building Automation',
  summary:
    'HVAC, lighting and metering networks of a building — BACnet, KNX, DALI, M-Bus, Modbus and the Ethernet lighting streams — normalised into a single point database that can be drilled down to the raw frame.',
  highlights: ['BACnet/IP', 'BACnet MS/TP', 'KNX', 'DALI', 'M-Bus', 'sACN'],
  families: [
    {
      id: 'bacnet',
      name: 'BACnet',
      summary:
        'One object and service model carried over two very different transports: token-passing RS-485 and UDP/IP.',
      protocols: [
        {
          // MS/TP data-link'tir: BACnet object/service katmanı ve RS-485 elektriksel
          // katmanı ondan ayrıdır (Objects/Services → NPDU/APDU → MS/TP → RS-485).
          // Sayfa bu dört katmanı ayrı açabilmeli, tek yığın gibi göstermemeli.
          id: 'bacnet-mstp',
          name: 'BACnet MS/TP',
          summary:
            'Master-Slave/Token-Passing data-link that carries BACnet objects and services over RS-485 to field-level controllers such as VAV boxes, unitary controllers and VFDs.',
          layer: 'data-link',
          status: 'planned',
          // timing: token rotation süresi ölçülebilir bir büyüklük
          // (T_rotation = t_token(n) − t_token(n−1)), jitter ve maksimum ile birlikte.
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Explorer',
            'Object Explorer',
            'Properties',
            'Who-Is/I-Am',
            'ReadProperty',
            'WriteProperty',
            'COV',
            'Priority Array',
            'Alarm',
            'Event',
            'Trend',
            'Schedule',
            'MAC',
            'Token',
            'Token Rotation',
            'Frame',
            'CRC',
            'RS-485 Diagnostics',
          ],
          related: ['interfaces-framing/serial-interfaces/rs-485'],
        },
        {
          // Aynı object/service modeli, farklı taşıma: BVLL → UDP → IP.
          // multi-layer, çünkü sayfanın vaadi tam yığını (Objects → Services →
          // APDU → NPDU → BVLL → UDP → IP → Ethernet) katman katman açmak.
          id: 'bacnet-ip',
          name: 'BACnet/IP',
          summary:
            'The same BACnet object and service model carried over UDP/IP through the BACnet Virtual Link Layer, used for supervisory BMS backbones and cross-subnet discovery via BBMD and foreign device registration.',
          layer: 'multi-layer',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Explorer',
            'Object Explorer',
            'Properties',
            'Who-Is/I-Am',
            'ReadProperty',
            'WriteProperty',
            'COV',
            'Priority Array',
            'Alarm',
            'Event',
            'Trend',
            'Schedule',
            'BVLL',
            'UDP',
            'BBMD',
            'Foreign Device',
            'Broadcast',
            'Device Discovery',
          ],
        },
      ],
    },
    {
      id: 'knx',
      name: 'KNX',
      summary:
        'Distributed building control where the meaning of a telegram comes from the group address and its datapoint type, not from the raw bytes.',
      protocols: [
        {
          // Tuzak: DPT bilinmiyorsa semantik değer UYDURULMAZ. Payload `00 64`
          // için doğru çıktı "raw uint16: 100 — engineering meaning unknown",
          // tahmini bir sıcaklık değil. ETS Import bu yüzden definitions'ta.
          id: 'knx',
          name: 'KNX',
          summary:
            'Standardised home and building control bus where devices exchange group telegrams over TP, PL, RF or IP, and values are only decodable once the datapoint type of the group address is known.',
          layer: 'multi-layer',
          status: 'planned',
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
            'Individual Address',
            'Group Address',
            'Group Objects',
            'Datapoint Types',
            'GroupValueRead',
            'GroupValueWrite',
            'GroupValueResponse',
            'Group Monitor',
            'ETS Import',
          ],
          // ETS group-address export'u (XML/CSV) makine-okunur bir proje tanımıdır;
          // listedeki hazır biçimlerin hiçbirine denk düşmediği için custom-schema.
          definitions: ['custom-schema'],
        },
      ],
    },
    {
      id: 'dali',
      name: 'DALI',
      summary:
        'Two-wire digital lighting bus carrying both power and data, with addressed control gear, groups, scenes and lamp fault reporting.',
      protocols: [
        {
          // DALI-2 kapasite sınırları sert: subnet başına 64 control gear +
          // 64 control device, control gear için 16 group + 16 scene. Adres
          // çakışması ve eksik cihaz bu limitlerden doğar, Fault Monitor'ün işi.
          id: 'dali',
          name: 'DALI',
          summary:
            'Digital Addressable Lighting Interface bus that drives LED and emergency control gear with control, configuration and query commands, addressed individually, by group or by broadcast.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'dali',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Explorer',
            'Short Address',
            'Groups',
            'Scenes',
            'Dimming',
            'Queries',
            'Control Commands',
            'Device Types',
            'DT6',
            'DT8',
            'Fault Monitor',
          ],
        },
      ],
    },
    {
      id: 'metering',
      name: 'Metering',
      summary:
        'Wired meter bus that pulls heat, water, gas and electricity consumption records into the building management system.',
      protocols: [
        {
          // Kanonik kayıt endüstriyel domain'de; buradaki kayıt aynı motoru
          // bina bağlamında (BMS'e sayaç verisi alma) sunar.
          id: 'm-bus',
          name: 'M-Bus',
          summary:
            'EN 13757 two-wire meter bus whose long frames carry DIF/VIF data records, turning heat, water, gas and electricity meter readings into engineering values for the BMS.',
          layer: 'multi-layer',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Meter Browser',
            'Primary Address',
            'Secondary Address',
            'Telegram',
            'DIF/VIF',
            'Energy',
            'Volume',
            'Temperature',
          ],
          aliasOf: 'industrial-automation/metering/m-bus',
        },
      ],
    },
    {
      id: 'modbus-building',
      name: 'Modbus Building',
      summary:
        'The industrial Modbus parsers reused unchanged at the building layer, with register maps and HVAC equipment dashboards layered on top.',
      protocols: [
        {
          // Protokol yeniden yazılmaz: endüstriyel Modbus RTU parser'ı paylaşılır,
          // üstüne yalnız building-specific semantic layer eklenir. Ham `0x05DC`
          // ancak register map varsa "1500 rpm"e dönüşür — map yoksa ham kalır.
          id: 'modbus-rtu',
          name: 'Modbus RTU',
          summary:
            'Serial Modbus over RS-485 as it appears in buildings, where a register map turns raw holding-register words into HVAC points such as supply air temperature, damper position and fan speed.',
          layer: 'application',
          status: 'planned',
          // timing: poll group periyotları ve tek tek okuma yerine block read
          // ile elde edilen bus traffic reduction hesaplanabilir.
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
            'Shared Modbus RTU Parser',
            'Register Map Import',
            'HVAC Register Map',
            'AHU Dashboard',
            'VFD Dashboard',
            'Chiller Dashboard',
            'Boiler Dashboard',
            'Polling Optimizer',
            'Block Read Analysis',
            'Scaling Check',
            'Point Drill-Down',
          ],
          // CSV/JSON register map (Address, Name, Data Type, Byte Order, Factor,
          // Offset, Unit, Enum, Bit Definitions) — klasik vendor map.
          definitions: ['vendor-map'],
          related: ['interfaces-framing/serial-interfaces/rs-485'],
          // Endüstriyel Modbus parser'ının bina kılığı; kanonik kayıt orada.
          aliasOf: 'industrial-automation/modbus/modbus-rtu',
        },
        {
          id: 'modbus-tcp',
          name: 'Modbus TCP',
          summary:
            'Modbus PDUs wrapped in MBAP over TCP to building plant such as chillers, boilers and power meters, where responses are matched to requests by transaction identifier rather than by arrival order.',
          layer: 'application',
          status: 'planned',
          // timing: TCP RTT ile Modbus response time ayrı ölçülür — yavaşlığın
          // ağdan mı cihazdan mı geldiğini ancak bu ikisinin farkı gösterir.
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
            'Shared Modbus TCP Parser',
            'Device Browser',
            'Connection Analyzer',
            'Transaction ID Matching',
            'Register Map Import',
            'HVAC Register Map',
            'AHU Dashboard',
            'VFD Dashboard',
            'Chiller Dashboard',
            'Boiler Dashboard',
            'Polling Optimizer',
          ],
          definitions: ['vendor-map'],
          aliasOf: 'industrial-automation/modbus/modbus-tcp',
        },
      ],
    },
    {
      id: 'lonworks',
      name: 'LonWorks',
      summary:
        'Legacy ISO/IEC 14908 control networking modelled through network variables and XIF device interfaces rather than raw registers.',
      protocols: [
        {
          // Kapsam bilinçli olarak dar: ilk sürümde full stack implementasyonu
          // hedeflenmiyor, temel mesaj görünümü yeterli. Bu yüzden `live` ve
          // `build` yok — sayfa okuma/çözümleme ve XIF eşlemesi vaat ediyor.
          id: 'lonworks',
          name: 'LonWorks',
          summary:
            'ISO/IEC 14908 distributed control networking used across legacy building systems, where each device exposes network variable inputs, outputs and configuration properties typed by SNVT.',
          layer: 'multi-layer',
          status: 'planned',
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'definitions', 'examples'],
          tools: [
            'Device',
            'Network Variables',
            'SNVT',
            'Configuration Properties',
            'XIF Import',
            'Gateway Mapping',
          ],
          // XIF, cihazın dış arayüzünü (NV'ler ve configuration property'ler)
          // tanımlayan resmi LonMark dosyasıdır; semantik çözüm buna bağlı.
          definitions: ['xif'],
        },
      ],
    },
    {
      id: 'lighting-networks',
      name: 'Lighting Networks',
      summary:
        'Entertainment and architectural lighting transports, from the DMX512 wire to its two Ethernet streaming successors.',
      protocols: [
        {
          // Fiziksel tavan: 512 slotluk tam universe'da maksimum tekrar hızı
          // ~44 Hz. Slot sayısı azalırsa frame hızlanır — refresh rate ölçümü
          // bu ilişkiyi göstermeli, sabit 44 Hz varsaymamalı.
          id: 'dmx512',
          name: 'DMX512',
          summary:
            'ANSI E1.11 unidirectional lighting stream that pushes up to 512 eight-bit slots per universe from a console to stage, auditorium and façade fixtures.',
          layer: 'multi-layer',
          status: 'ready',
          pluginId: 'dmx512',
          // timing: BREAK ve MAB süreleri, frame duration ve refresh rate
          // doğrudan sinyal zamanlamasından ölçülür.
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
            'Universe',
            'Break',
            'MAB',
            'Start Code',
            'Slots',
            'Fixture Profile',
            '8-bit Channel',
            '16-bit Channel',
            'Refresh Rate',
          ],
          // Fixture personality (start address + footprint + kanal adları)
          // makine-okunur bir profil dosyasıdır; standart bir biçimi yok.
          definitions: ['custom-schema'],
          related: [
            'building-automation/lighting-networks/art-net',
            'building-automation/lighting-networks/sacn',
          ],
        },
        {
          // Sequence boşluğu paket kaybı DEMEK DEĞİLDİR: sequence kullanımı
          // konfigürasyonda kapatılabilir/opsiyoneldir. Uyarı bu ihtimali
          // belirtmeden "lost packet" diye kesinleştirilmemeli.
          id: 'art-net',
          name: 'Art-Net',
          summary:
            'Royalty-free UDP protocol that carries many DMX512 universes over Ethernet together with node discovery, management and multi-port gateway mapping.',
          layer: 'application',
          status: 'ready',
          pluginId: 'art-net',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Node Discovery',
            'ArtPoll',
            'ArtPollReply',
            'ArtDmx',
            'Universe',
            'Sequence',
            'ArtSync',
            'Gateway Mapping',
          ],
          related: [
            'building-automation/lighting-networks/dmx512',
            'building-automation/lighting-networks/sacn',
          ],
        },
        {
          // Kimlik IP'den değil CID'den okunur: IP değişse bile aynı CID aynı
          // source'tur. Sequence sarması (254, 255, 0, 1) geçerlidir; kayıp
          // istatistiği source + universe çifti bazında tutulur.
          id: 'sacn',
          name: 'sACN',
          summary:
            'ANSI E1.31 streaming of DMX512-A data over UDP/IP, identifying every source by its CID and resolving contention on a universe through numeric source priority.',
          layer: 'application',
          status: 'ready',
          pluginId: 'sacn',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Source/CID',
            'Universe',
            'Priority',
            'Sequence',
            'DMX Data',
            'Synchronization',
            'Multiple Source Monitor',
          ],
          related: [
            'building-automation/lighting-networks/dmx512',
            'building-automation/lighting-networks/art-net',
          ],
        },
      ],
    },
  ],
};
