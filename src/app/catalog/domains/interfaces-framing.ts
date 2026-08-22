import type { CatalogDomain } from '../types';

/**
 * Domain 1 — 5 aile, 40 protokol (8 + 9 + 3 + 3 + 17).
 *
 * Bu domain'in ayırt edici yanı: buradaki kayıtların çoğu bir *taşıyıcı*, üst
 * seviye bir protokol değil. Kaynak iki yanılgıyı özellikle vurguluyor ve
 * katalog metinleri bunları bozmamalı:
 *   - UART ≠ RS-232 (biri framing, öteki elektriksel katman)
 *   - RS-485 ≠ Modbus (doğru zincir: Modbus RTU → UART → RS-485 transceiver → A/B)
 *
 * `tabs` seçimi kural tabanlıdır, kanaat değil:
 *   - 'live' yalnız tarayıcıdan (Web Serial/WebUSB) ya da köprüden yakalanabilenlerde.
 *     Bit-senkron çerçeveleme (HDLC, SDLC) bunun dışındadır — özel yakalama donanımı
 *     ister, ilk sürüm log/import ile çalışır. Aynı nedenle akım-döngüsü arayüzleri
 *     (Current Loop, 4–20 mA) ve saf PHY sayfaları da 'live' taşımaz.
 *   - 'definitions' YALNIZ makine-okunur tanım dosyası olanlarda. Bu domain'de bu,
 *     kullanıcının kendi şemasını yazdığı dört custom framing protokolü ve
 *     cihaz-başına komut haritası içe aktarılabilen PMBus'tır. UART sayfasında
 *     'definitions' görünmemesi, sekme kuralının canlı kanıtıdır.
 */
export const interfacesFramingDomain: CatalogDomain = {
  id: 'interfaces-framing',
  name: 'Interfaces & Framing',
  summary:
    'Physical and low-level communication interfaces together with the general-purpose frame and stream protocols that turn a raw byte stream into decoded packets.',
  highlights: ['UART', 'RS-485', 'SPI', 'I²C', 'USB', 'HDLC'],
  families: [
    {
      id: 'serial-interfaces',
      name: 'Serial Interfaces',
      summary:
        'Asynchronous serial framing and the voltage, differential and current-loop layers that carry it between devices.',
      protocols: [
        {
          id: 'uart',
          name: 'UART',
          summary:
            'Asynchronous parallel-to-serial framing with no shared clock, used between MCUs, GNSS receivers, radio modems and debug consoles that agree on a baud rate in advance.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'uart',
          calculatorIds: ['uart-timing'],
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          // Spec'in "UART kendi başına gerilim seviyesi değildir" dersi katalogda
          // da görünsün: sayfa dört taşıyıcısına doğrudan bağlanıyor.
          related: [
            'interfaces-framing/serial-interfaces/rs-232',
            'interfaces-framing/serial-interfaces/rs-485',
            'interfaces-framing/serial-interfaces/ttl-uart',
            'interfaces-framing/serial-interfaces/cmos-uart',
          ],
          tools: [
            'Configuration',
            'Frame Visualizer',
            'Live UART Monitor',
            'UART Decoder',
            'UART Packet Builder',
            'Timing Calculator',
            'Baud Error Calculator',
            'Oversampling Analyzer',
            'Error Analyzer',
          ],
        },
        {
          id: 'ttl-uart',
          name: 'TTL UART',
          summary:
            'UART framing carried over TTL-compatible logic levels, where the real question is whether two boards can drive each other without a level translator.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'ttl-uart',
          // Decode UART'la aynı (aynı modül iki eklenti üretiyor); sayfanın asıl
          // motoru seviye uyumluluğu hesaplayıcısı.
          calculatorIds: ['uart-timing', 'logic-level-compat'],
          tabs: ['overview', 'live', 'decode', 'diagnostics', 'examples'],
          related: [
            'interfaces-framing/serial-interfaces/uart',
            'interfaces-framing/serial-interfaces/cmos-uart',
          ],
          // Kaynağın ısrarı: 3.3V/5V seçtirip "uyumlu" demek yanlış — karar
          // datasheet'teki VIH/VIL/VOH/VOL değerleriyle verilir.
          tools: [
            'Logic-Level Configuration',
            'Logic Compatibility Check',
            'UART Frame View',
            'Live Monitor',
            'Level Compatibility Calculator',
            'Error/Warning View',
          ],
        },
        {
          id: 'cmos-uart',
          name: 'CMOS UART',
          summary:
            'UART framing at CMOS supply levels between SoCs and peripherals, where each direction has to be evaluated separately because output and input characteristics are rarely symmetric.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'cmos-uart',
          calculatorIds: ['uart-timing', 'logic-level-compat'],
          tabs: ['overview', 'live', 'decode', 'diagnostics', 'examples'],
          related: [
            'interfaces-framing/serial-interfaces/uart',
            'interfaces-framing/serial-interfaces/ttl-uart',
          ],
          tools: [
            'Supply Voltage',
            'Logic Thresholds',
            'TX→RX Compatibility',
            'RX→TX Compatibility',
            'Level Translation Check',
            'UART Frame View',
            'Live Monitor',
          ],
        },
        {
          id: 'rs-232',
          name: 'RS-232',
          summary:
            'Single-ended bipolar voltage layer between PCs, PLCs and instruments, where the UART bit stream is inverted onto mark/space levels and DTE/DCE wiring decides whether a null modem is needed.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'rs-232',
          calculatorIds: ['uart-timing'],
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          // "UART ≠ RS-232" dersinin karşılığı: sayfa taşıdığı çerçevelemeye
          // ve komşu elektriksel katmanlara bağlanıyor.
          related: [
            'interfaces-framing/serial-interfaces/uart',
            'interfaces-framing/serial-interfaces/rs-422',
            'interfaces-framing/serial-interfaces/rs-485',
          ],
          tools: [
            'UART↔RS-232 Layer View',
            'Signal View',
            'DTE/DCE Analyzer',
            'Null-Modem Helper',
            'DB9 Pinout Helper',
            'Frame Decoder',
            'Live Monitor',
            'Timing Calculator',
            'Error Analyzer',
          ],
        },
        {
          id: 'rs-422',
          name: 'RS-422',
          summary:
            'Balanced differential point-to-multipoint link with one driver and up to ten receivers, used for encoders, navigation sensors and long-distance telemetry.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'rs-422',
          // `rs485-timing` BİLEREK eklenmedi: termination/propagation matematiği
          // aynı olsa da araç RS-485 adıyla yayınlanmış, RS-422 sayfasında
          // göstermek yanıltır (bkz. rs422.ts dosya başı).
          calculatorIds: ['uart-timing'],
          tabs: ['overview', 'live', 'decode', 'timing', 'diagnostics', 'examples'],
          // Taşıyıcı ↔ komşu taşıyıcı bağı: RS-422 ile RS-485 aynı diferansiyel
          // aileden, ayrım full-duplex/multipoint; UART ise ikisinin de taşıdığı
          // çerçeveleme (spec'in "UART ≠ RS-232" uyarısıyla aynı ders).
          related: [
            'interfaces-framing/serial-interfaces/rs-485',
            'interfaces-framing/serial-interfaces/uart',
          ],
          tools: [
            'Differential Signal View',
            'TX+/TX- View',
            'RX+/RX- View',
            'Full-Duplex Analyzer',
            'Voltage Difference Calculator',
            'Termination Helper',
            'Live Decoder',
            'Timing Calculator',
            'Diagnostics',
          ],
        },
        {
          id: 'rs-485',
          name: 'RS-485',
          summary:
            'Balanced differential multipoint bus used by most industrial field networks, where driver enable turnaround, termination, biasing and unit load budget decide whether the bus works at all.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'rs-485',
          // İki motor da Faz 5'te yazılmıştı: karakter/paket süresi UART'ta,
          // termination/bias/unit-load/propagation RS-485'e özel dosyada.
          calculatorIds: ['uart-timing', 'rs485-timing'],
          // 'live' burada KALIYOR (I²C'den farkı): USB-RS485/RS422 dönüştürücü
          // tarayıcıya seri port olarak görünür, `connection/` Web Serial'i
          // zaten destekliyor — köprü cihaz gerektirmez.
          tabs: ['overview', 'live', 'decode', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Physical Layer View',
            'Half-Duplex Analyzer',
            'Full-Duplex Analyzer',
            'A/B Differential View',
            'DE/RE Timing',
            'Driver Turnaround Analyzer',
            'Termination Calculator',
            'Bias/Fail-Safe Calculator',
            'Unit Load / Node Calculator',
            'Cable Delay Calculator',
            'Bus Timing',
            'Live Monitor',
            'Collision/Turnaround Analyzer',
            'Diagnostics',
          ],
          // Taksonomi 1.5 "Related Protocols": RS-485 sayfası kendi başına bir
          // protokol değil, bu dört protokolün altındaki taşıyıcı — kullanıcı
          // buradan üst katmana geçebilmeli.
          related: [
            'industrial-automation/modbus/modbus-rtu',
            'industrial-automation/modbus/modbus-ascii',
            'building-automation/bacnet/bacnet-mstp',
            'industrial-automation/classic-fieldbus/profibus-dp',
          ],
        },
        {
          id: 'current-loop',
          name: 'Current Loop',
          summary:
            'Interface class that carries information as loop current rather than line voltage, so long cable resistance does not corrupt the value as long as compliance voltage holds.',
          layer: 'physical',
          // LoRa paterni (`wireless-iot.ts` lora kaydı, Faz 10 dalga 9a): bilgi
          // hat AKIMI üzerinden taşınır, ortada çözülecek bayt akışı YOKTUR —
          // `pluginId` bu yüzden hiç verilmedi ve `ready` demek yalan olurdu.
          // Motor YAZILDI (`protocol-core/timing/currentLoop.ts`: Ohm kanunu,
          // ölçekleme, shunt, compliance bütçesi, durum sınıfı) ve `current-loop`
          // hesap aracı olarak koşuyor; 'timing' sekmesi ProtocolPage'in
          // hesaplayıcı bağlantılarını bastığı tek sekme olduğu için eklendi.
          status: 'partial',
          calculatorIds: ['current-loop'],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          related: ['interfaces-framing/serial-interfaces/4-20-ma'],
          tools: [
            'Digital Current Loop View',
            'Loop Voltage',
            'Loop Current',
            'Cable Resistance',
            'Receiver Burden',
            "Ohm's Law Calculator",
            'Diagnostics',
          ],
        },
        {
          id: '4-20-ma',
          name: '4–20 mA',
          summary:
            'Process automation analog current loop where 4 mA and 20 mA bracket the sensor range, and the live zero at 4 mA makes an open loop distinguishable from a real minimum reading.',
          layer: 'physical',
          // Current Loop ile aynı gerekçe: analog akım arayüzü, decode yok,
          // motor `current-loop` hesap aracında (LoRa paterni).
          status: 'partial',
          calculatorIds: ['current-loop'],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          // HART, 4–20 mA döngüsünün ÜSTÜNE bindirilmiş dijital katmandır
          // (`layer: 'multi-layer'`); brief'in saptadığı eksik çapraz-link.
          related: [
            'interfaces-framing/serial-interfaces/current-loop',
            'industrial-automation/process-instrumentation/hart',
          ],
          tools: [
            'Current→Engineering Value',
            'Engineering Value→Current',
            'Shunt Resistor Calculator',
            'ADC Voltage Calculator',
            'Compliance Voltage',
            'Cable Resistance',
            'Live Zero',
            'Sensor Range',
            'Fault Detection',
            'Trend View',
          ],
        },
      ],
    },
    {
      id: 'peripheral-buses',
      name: 'Peripheral Buses',
      summary:
        'Clocked on-board buses between a host controller and its memories, sensors and power devices — the SPI family and the I²C family.',
      protocols: [
        {
          id: 'spi',
          name: 'SPI',
          summary:
            'Four-wire clocked full-duplex bus between a host and chip-selected peripherals, where the CPOL/CPHA mode pair and bit order decide whether the same wires read sense or garbage.',
          layer: 'physical',
          // dalga 11b: register transaction decode (Command bit7=R/W̄ + 1 dummy
          // bayt + Data — spec'in kendi IMU örneği). CPOL/CPHA/transfer-süresi
          // zaten `timing/spi.ts` + `SpiTimingTool`ta vardı, motor tekrar
          // yazılmadı. 'build'/'diagnostics' sekmeleri hâlâ karşılıksız
          // (jenerik BuildPanel yok, dalga10a'nın SLIP/COBS'ta bıraktığı boşluk).
          status: 'ready',
          pluginId: 'spi',
          calculatorIds: ['spi-timing'],
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Configuration',
            'Signal View',
            'Timing Diagram',
            'Transfer Decoder',
            'Register Transaction Decoder',
            'Packet Builder',
            'Transfer Time Calculator',
            'Setup/Hold Analyzer',
            'CS Timing',
            'Throughput Calculator',
            'Error Analyzer',
          ],
        },
        {
          id: 'quad-spi',
          name: 'Quad SPI',
          summary:
            'Four-lane serial memory interface whose command, address, dummy and data phases can each use a different lane width, used for external NOR Flash and memory-mapped execution.',
          layer: 'physical',
          // dalga 11b: Command+Address(3 bayt sabit, spec'in 0xEB/0x001234
          // örneği)+Data decode (qspiCore.ts, octal-spi ile paylaşılan).
          // Dummy cycle hiç bayt tüketmez (kapsam kararı, dosya başı notu) —
          // `timing/spi.ts`teki `qspiThroughput` zaten SpiTimingTool'da vardı.
          status: 'ready',
          pluginId: 'quad-spi',
          calculatorIds: ['spi-timing'],
          tabs: ['overview', 'decode', 'timing', 'data', 'examples'],
          tools: [
            'IO0–IO3 Lane View',
            'Command Phase',
            'Address Phase',
            'Dummy Cycles',
            'Data Phase',
            'Read Transaction',
            'Write Transaction',
            'Throughput Calculator',
            'Memory Transaction Viewer',
          ],
        },
        {
          id: 'octal-spi',
          name: 'Octal SPI',
          summary:
            'Eight-lane serial memory interface with SDR/DDR transfers and a DQS strobe, used by modern external Flash and PSRAM for execute-in-place workloads.',
          layer: 'physical',
          // dalga 11b: quad-spi ile AYNI Command+Address(3)+Data yapısı
          // (qspiCore.ts paylaşılan). SDR/DDR/DQS decode'a girmez — motor
          // (`ospiThroughput`) var ama henüz hiçbir UI hesaplayıcısı okumuyor
          // (bilinen boşluk, octalSpi.ts dosya başı notu).
          status: 'ready',
          pluginId: 'octal-spi',
          calculatorIds: ['spi-timing'],
          tabs: ['overview', 'decode', 'timing', 'data', 'examples'],
          tools: [
            'IO0–IO7 Lane View',
            'SDR Mode',
            'DDR Mode',
            'DQS View',
            'Command Phase',
            'Address Phase',
            'Dummy Cycles',
            'Data Phase',
            'XIP View',
            'Memory Transaction Analyzer',
            'Throughput Calculator',
          ],
        },
        {
          id: 'microwire',
          name: 'Microwire',
          summary:
            'Three-wire half-duplex master/slave interface found on legacy serial EEPROMs and converters, where opcode, address and word length come from the device datasheet rather than a fixed standard.',
          layer: 'physical',
          status: 'planned',
          tabs: ['overview', 'decode', 'timing', 'data', 'examples'],
          tools: [
            'Command Decoder',
            'Opcode View',
            'Address Field',
            'Data Field',
            'Read Transaction',
            'Write Transaction',
            'EEPROM Transaction View',
            'Timing Diagram',
          ],
        },
        {
          id: 'i2c',
          name: 'I²C',
          summary:
            'Two-wire open-drain addressed bus between a controller and multiple targets, where START/STOP conditions, the ACK bit and pull-up sizing govern every register transaction.',
          layer: 'physical',
          status: 'ready',
          pluginId: 'i2c',
          calculatorIds: ['i2c-timing'],
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Signal View',
            'START/STOP Detector',
            'Address Decoder',
            'Read/Write Bit',
            'ACK/NACK View',
            'Register Transaction',
            'Repeated START',
            'Clock Stretch Analyzer',
            'Arbitration Analyzer',
            'Bus Scanner',
            'Timing Calculator',
            'Pull-Up Calculator',
            'Bus Capacitance',
            'Bus Utilization',
            'Live Decoder',
            'Transaction Builder',
            'Error Analyzer',
          ],
        },
        {
          id: 'i3c',
          name: 'I3C',
          summary:
            'MIPI two-wire sensor bus that keeps legacy I²C targets on the same lines while adding dynamic addressing, common command codes, in-band interrupts and hot-join.',
          layer: 'physical',
          status: 'planned',
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Discovery',
            'Static Address',
            'Dynamic Address',
            'ENTDAA Timeline',
            'CCC Commands',
            'SDR Traffic',
            'HDR Traffic',
            'IBI Analyzer',
            'Hot-Join Monitor',
            'Legacy I²C Devices',
            'Device Table',
            'Diagnostics',
          ],
        },
        {
          id: 'smbus',
          name: 'SMBus',
          summary:
            'System management bus built on I²C electricals that fixes a closed set of transaction types plus PEC error checking and explicit bus timeout behaviour.',
          layer: 'data-link',
          // dalga 11i: spec özetinin saydığı 11 transaction türü bayt sayısı +
          // repeated-START konumundan ayrılıyor, PEC paneli (kapsam/hesaplanan/
          // alınan/PASS) dolu. PEC'in düz CRC-8 olduğu SMBus 3.1 §5.4'ten
          // doğrulandı. Timeout/clock-LOW izleme KAPSAM DIŞI — "Timeout
          // Monitor" aracının motoru yok (onewire'ın aspirasyonel tools
          // listesiyle aynı durum).
          status: 'ready',
          pluginId: 'smbus',
          // I²C elektriksel temeli: SMBus aynı hatları kullanır.
          calculatorIds: ['i2c-timing'],
          related: [
            'interfaces-framing/peripheral-buses/i2c',
            'interfaces-framing/peripheral-buses/pmbus',
          ],
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Quick Command',
            'Send Byte',
            'Receive Byte',
            'Read Byte',
            'Write Byte',
            'Read Word',
            'Write Word',
            'Block Read',
            'Block Write',
            'PEC Calculator',
            'Timeout Monitor',
            'Transaction Decoder',
          ],
        },
        {
          id: 'pmbus',
          name: 'PMBus',
          summary:
            'SMBus-based command protocol for digital power devices, turning raw Linear11/Linear16/Direct words from converters and PSUs into volts, amps, degrees and fault bits.',
          layer: 'application',
          // dalga 11i: SMBus iskeleti (`smbusCore.ts`) + komut haritası
          // (Table 31'den, spec özetinin "Yaygın komutlar" listesi) +
          // Linear11 / ULINEAR16 / STATUS bit ağacı / COEFFICIENTS→m,b,R.
          // DIRECT format motoru `timing/pmbus.ts`e eklendi (PMBus Part II
          // Rev 1.3.1 §7.4). ULINEAR16 üssü tek çerçeveden BİLİNEMEZ, o yüzden
          // uydurulmuyor — sayfa "VOUT_MODE gerekli" diyor.
          status: 'ready',
          pluginId: 'pmbus',
          calculatorIds: ['pmbus-linear', 'pmbus-direct'],
          related: [
            'interfaces-framing/peripheral-buses/smbus',
            'interfaces-framing/peripheral-buses/i2c',
          ],
          // 'timing' sekmesi hesaplayıcı bağlantılarının TEK görünme yeri
          // (ProtocolPage kuralı, dalga 11g'de öğrenildi) — Linear/Direct
          // araçları bu yüzden buradan asılı.
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'definitions', 'examples'],
          tools: [
            'Device Explorer',
            'Command Browser',
            'READ_VOUT',
            'READ_IOUT',
            'READ_TEMPERATURE',
            'STATUS Decoder',
            'Linear11 Decoder',
            'Linear16 Decoder',
            'Direct Format Decoder',
            'Telemetry Dashboard',
            'Fault Decoder',
            'Command Builder',
          ],
          // Komut kümesi cihaz başına değişir: PMBus çekirdeği ortak, ama hangi
          // komutun hangi formatta döndüğü üreticiye ait haritadan gelir.
          definitions: ['vendor-map'],
        },
        {
          id: 'one-wire',
          name: '1-Wire',
          summary:
            'Single data line plus ground bus where reset/presence pulses, a 64-bit ROM ID per device and a search tree replace addressing, often with the device powered parasitically from the line.',
          layer: 'physical',
          // dalga 11a: ROM Command (asgari 4 + Overdrive çifti) + 64-bit ROM ID
          // (Family/Serial/CRC-8/MAXIM) çözülüyor. Reset/Presence pulse timing'i
          // ve Search ROM'un bit-seviyeli arama ağacı KAPSAM DIŞI (onewire.ts
          // dosya başı notu) — 'timing' sekmesi hâlâ karşılıksız kalıyor.
          status: 'ready',
          pluginId: 'one-wire',
          tabs: ['overview', 'decode', 'timing', 'data', 'examples'],
          tools: [
            'Reset Pulse',
            'Presence Pulse',
            'ROM Commands',
            '64-bit ROM ID Decoder',
            'Search ROM Tree',
            'Device Tree',
            'Scratchpad View',
            'Read/Write Slot',
            'Parasite Power Analyzer',
            'Timing Analyzer',
          ],
        },
      ],
    },
    {
      id: 'host-network-interfaces',
      name: 'Host & Network Interfaces',
      summary:
        'Host-side and wired-network interfaces where the toolkit stays at the enumeration, PHY and link level — packet protocols live in the Network & Ethernet domain.',
      protocols: [
        {
          id: 'usb',
          name: 'USB',
          summary:
            'Host-driven layered bus whose enumeration sequence, descriptor tree and four transfer types explain most "device not recognised" failures long before any payload is inspected.',
          layer: 'multi-layer',
          // dalga 11j: paket seviyesi (PID + token/SOF/veri/handshake, CRC5 ve
          // CRC16 doğrulaması) ve veri yükünün Chapter 9 çözümü (SETUP isteği,
          // Device/Configuration/Interface/Endpoint/String tanımlayıcı zinciri)
          // bağlandı. Veri CRC16'sı USB 2.0 §8.3.5.2'den doğrulandı ve
          // `CRC16_USB` olarak kataloğa açıldı — brief'in `CRC16_ARC` adayı
          // TUTMUYORDU. Transaction/transfer seviyeleri ve enumeration timeline
          // KAPSAM DIŞI (paket sınırını veren SYNC/EOP bayt akışında yok;
          // gerekçe usb.ts dosya başında). Bu yüzden aşağıdaki araç listesinin
          // "Enumeration"/"Transfer" kalemleri hâlâ aspirasyonel.
          status: 'ready',
          pluginId: 'usb',
          // USB-UART köprüsü spec özetinin kendi kullanım örneği
          // (`01-fiziksel-arayuzler.md:93`).
          related: ['interfaces-framing/serial-interfaces/uart'],
          // `'live'` ÇIKARILDI: `connection/` yalnız serial+mock taşıyor,
          // WebUSB yok — I²C'de (11c) verilen kararın aynısı.
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Device Enumeration',
            'Descriptor Decoder',
            'Control Transfer',
            'Bulk Transfer',
            'Interrupt Transfer',
            'Isochronous Transfer',
            'Endpoint Explorer',
            'PID Decoder',
            'Setup Packet Decoder',
            'Error Analyzer',
          ],
        },
        {
          id: 'ethernet-interface',
          name: 'Ethernet Interface',
          summary:
            'The MAC-to-PHY side of Ethernet — link status, speed, duplex, auto-negotiation and the MII/RMII/GMII/RGMII wiring plus MDIO register access that brings a link up.',
          layer: 'physical',
          // dalga 11k: sayfanın kendi bayt akışı MDIO yönetim çerçevesi —
          // Ethernet ÇERÇEVESİ zaten Network & Ethernet alanında çözülüyor.
          // Clause 22 alanları (ST/OP/PHYAD/REGAD/TA/DATA) + BMCR/BMSR/ANAR/
          // ANLPAR bit çözümü + "PHY cevap vermedi" (TA=11) teşhisi bağlandı.
          // MII/RMII/GMII/RGMII pin arayüzleri ve Clause 45 op kodları KAPSAM
          // DIŞI (gerekçeler mdio.ts dosya başında) — araç listesindeki o
          // kalemler hâlâ aspirasyonel.
          status: 'ready',
          pluginId: 'ethernet-interface',
          related: [
            'network-ethernet/data-link/ethernet-ii',
            'interfaces-framing/host-network-interfaces/single-pair-ethernet',
          ],
          tabs: ['overview', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Link Status',
            'PHY View',
            'Speed',
            'Duplex',
            'Auto-Negotiation',
            'MII',
            'RMII',
            'GMII',
            'RGMII',
            'MDIO/MDC Decoder',
            'PHY Register Viewer',
          ],
        },
        {
          id: 'single-pair-ethernet',
          name: 'Single Pair Ethernet',
          summary:
            'Ethernet over one balanced twisted pair (10BASE-T1S/T1L, 100BASE-T1, 1000BASE-T1), including the PLCA scheme that makes a shared multidrop segment behave deterministically.',
          layer: 'physical',
          // dalga 11k: LoRa paterni — hattaki çerçeve zaten Ethernet
          // çerçevesidir, bu sayfanın konusu (PHY sınıfı, multidrop, PLCA)
          // bayt akışında görünmez. Bu yüzden `pluginId` YOK, motor
          // `calculatorIds` üzerinden: PHY bit süresi/çerçeve süresi + PLCA
          // çevrim ve burst bütçesi. PLCA register varsayılanları OPEN
          // Alliance'ın kamuya açık belgesinden; BEACON süresi hiçbir kaynakta
          // olmadığı için çağırandan gelir (singlePairEthernet.ts dosya başı).
          status: 'partial',
          calculatorIds: ['spe-plca'],
          related: [
            'interfaces-framing/host-network-interfaces/ethernet-interface',
            'network-ethernet/data-link/ethernet-ii',
          ],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            '10BASE-T1S',
            '10BASE-T1L',
            '100BASE-T1',
            '1000BASE-T1',
            'PLCA Analyzer',
            'PHY Configuration',
            'Link Status',
            'Diagnostics',
          ],
        },
      ],
    },
    {
      id: 'vehicle-field-physical-layers',
      name: 'Vehicle / Field Physical Layers',
      summary:
        'The transceiver-level view of the automotive buses: differential voltages, termination, topology and propagation budget, with frame decoding left to the Automotive domain.',
      protocols: [
        {
          id: 'can-phy',
          name: 'CAN PHY',
          summary:
            'ISO 11898-2 differential layer where the dominant/recessive wired-AND behaviour, 120 Ω end termination and total propagation budget set the achievable bit rate and sample point.',
          layer: 'physical',
          // LoRa paterni (dalga 11g'deki Current Loop kararının aynısı): çerçeve
          // çözümü Automotive alanında (`protocols/automotive/can/*`), bu sayfa
          // transceiver seviyesini anlatır — yakalanmış baytta karşılığı yok,
          // bu yüzden `pluginId` verilmedi. Motor `timing/vehiclePhy.ts`te,
          // sayfaya `can-phy-timing` hesaplayıcısı olarak bağlı.
          status: 'partial',
          calculatorIds: ['can-phy-timing'],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          // Brief'in saptadığı eksik çapraz-link: taşıyıcı ↔ üstündeki çerçeve.
          related: [
            'automotive/can-family/can-2-0a',
            'automotive/can-family/can-fd',
            'interfaces-framing/serial-interfaces/rs-485',
          ],
          tools: [
            'CANH/CANL Signal View',
            'Differential Voltage',
            'Dominant/Recessive View',
            'Termination Calculator',
            'Split Termination',
            'Bus Topology',
            'Propagation Delay',
            'Transceiver Delay',
            'Physical Diagnostics',
          ],
        },
        {
          id: 'lin-phy',
          name: 'LIN PHY',
          summary:
            'Single-wire 12 V automotive subnet layer for low-cost switches and actuators, where break, sync and wake-up patterns sit around an otherwise UART-like byte format.',
          layer: 'physical',
          status: 'partial',
          calculatorIds: ['lin-phy-timing'],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          // LIN'in bayt aktarımı UART benzeridir (spec), çerçevesi Automotive'de.
          related: ['automotive/vehicle-network-protocols/lin', 'interfaces-framing/serial-interfaces/uart'],
          tools: [
            'Single-Wire Signal View',
            'Dominant/Recessive View',
            'Wake-Up Detection',
            'Break Detection',
            'Transceiver View',
            'Physical Diagnostics',
          ],
        },
        {
          id: 'flexray-phy',
          name: 'FlexRay PHY',
          summary:
            'Dual-channel differential layer for deterministic automotive networks, covering passive bus, active star and hybrid topologies plus the A/B skew that breaks redundancy.',
          layer: 'physical',
          status: 'partial',
          calculatorIds: ['flexray-phy-timing'],
          tabs: ['overview', 'timing', 'data', 'diagnostics', 'examples'],
          related: ['automotive/vehicle-network-protocols/flexray'],
          tools: [
            'Channel A View',
            'Channel B View',
            'Differential Signal View',
            'Passive Bus Topology',
            'Active Star Topology',
            'Hybrid Topology',
            'Physical Diagnostics',
          ],
        },
      ],
    },
    {
      id: 'framing-stream-protocols',
      name: 'Framing & Stream Protocols',
      summary:
        'General-purpose ways of turning a byte stream into frames — custom formats, escaping and stuffing schemes, file transfer sessions, navigation binaries and text command sets.',
      protocols: [
        {
          id: 'custom-binary-protocol',
          name: 'Custom Binary Protocol',
          summary:
            'Vendor-specific binary frame format described by the user — header, address, command, length, payload and CRC — which is what most industrial devices actually speak.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'custom-binary-protocol',
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
          // Karar (kullanıcı, dalga 10e): schema.framing GENİŞLETİLMEDİ — bu
          // sayfa specFixture.ts'in SPEC_SENSOR_PROTOCOL'ünü (§8.3+§9.6+§43
          // çapraz doğrulanmış) aynen sarar. Sequence Counter Tracker/
          // Request-Response Matcher ASPİRASYONEL — çok-çerçeveli oturum
          // takibi bu turun dışında (X/Y/ZMODEM'in aynı ertelemesi).
          tools: [
            'Header Field',
            'Address Field',
            'Command Field',
            'Length Field',
            'Payload View',
            'CRC Validator',
            'Parser Builder',
            'Packet Builder',
            'Sequence Counter Tracker',
            'Request/Response Matcher',
          ],
          definitions: ['custom-schema'],
        },
        {
          id: 'ascii-protocol',
          name: 'ASCII Protocol',
          summary:
            'Human-readable line-oriented serial protocol class where CR/LF termination, numeric field parsing and echo detection decide whether a response was understood correctly.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'ascii-protocol',
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
          // Numeric Field Parser/Echo Detection ASPİRASYONEL — alan şeması
          // motoru (schemaParser.ts) virgülle ayrılmış değişken-genişlikli
          // sayısal alan OKUMUYOR (FIELD_TYPES'ta yok), `parameters` ham
          // metin kalır; echo/response eşleştirmesi çok-çerçeveli oturum
          // işi, bu turun dışında.
          tools: [
            'HEX + ASCII Dual View',
            'Line Termination Handler',
            'Command/Response Parser',
            'Numeric Field Parser',
            'Echo Detection',
            'Parser Error View',
          ],
          definitions: ['custom-schema'],
        },
        {
          id: 'delimiter-based-protocol',
          name: 'Delimiter-Based Protocol',
          summary:
            'Framing by start and end marker bytes such as STX/ETX, where the real work is handling a delimiter value that also appears inside the payload.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'delimiter-based-protocol',
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
          // Kaynak escape dönüşümünü kasıtlı olarak açık bırakıyor: tek bir
          // algoritma yeterli değil, kural kullanıcı tarafından tanımlanmalı.
          // Uygulama (dalga 10e): Faz 6'nın hazır `hdlc-flag` motoru (PPP'nin
          // de kullandığı) AYNEN kullanıldı — kural kullanıcı tanımlı DEĞİL
          // ama gerçek, çalışan bir escape mekaniği gösterir.
          tools: [
            'Start/End Delimiter Configuration',
            'STX/ETX Framing',
            'Delimiter Collision Analyzer',
            'Escape Rule Editor',
            'Byte Stuffing View',
            'Frame Decoder',
          ],
          definitions: ['custom-schema'],
        },
        {
          id: 'length-based-protocol',
          name: 'Length-Based Protocol',
          summary:
            'Framing driven by a length field in the header, where length semantics, endianness and a maximum-frame guard separate a working parser from one that hangs on a corrupt byte.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'length-based-protocol',
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
          // Length Semantics Selector/Resynchronization Analyzer ASPİRASYONEL
          // — bu turun şeması tek bir length-anlamı (payload-only) ve tek bir
          // fixture gösterir, 4 semantik seçenek arası geçiş ve bozuk-header
          // sonrası resync bu turun dışında.
          tools: [
            'Length Field Configuration',
            'Length Semantics Selector',
            'Endianness Selector',
            'Maximum Frame Length Guard',
            'Resynchronization Analyzer',
            'Frame Decoder',
            'Checksum/CRC Validator',
          ],
          definitions: ['custom-schema'],
        },
        {
          id: 'slip',
          name: 'SLIP',
          summary:
            'RFC 1055 framing that wraps IP datagrams on a serial line using END and ESC bytes only, deliberately providing no addressing, no length and no integrity check.',
          layer: 'data-link',
          // Faz 10 dalga 10a: `protocol-core/framing/slip.ts`nin (Faz 6) ÜSTÜNDE
          // ince ProtocolPlugin sarmalı — motor zaten kesiyor VE kaçış çözüyor/
          // kodluyor, yeni bir ayrıştırma algoritması yazılmadı. Kaçış olaylarının
          // bayt konumları (motorun döndürmediği bir ayrıntı) ayrıca işaretlenir.
          status: 'ready',
          pluginId: 'slip',
          tabs: ['overview', 'live', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'SLIP Encoder',
            'SLIP Decoder',
            'Escape View',
            'END/ESC Byte Map',
            'Decoder State Machine',
          ],
        },
        {
          id: 'cobs',
          name: 'COBS',
          summary:
            'Reversible byte stuffing that removes every zero byte from a frame so 0x00 can serve as an unambiguous delimiter, at a worst case of one extra byte per 254.',
          layer: 'data-link',
          // Faz 10 dalga 10a: `protocol-core/framing/cobs.ts`nin (Faz 6) ÜSTÜNDE
          // ince ProtocolPlugin sarmalı — SLIP'le aynı gerekçe, motor zaten kod
          // baytlarını çözüyor/kodluyor. "COBS + CRC Pipeline" bu dalgada YOK —
          // CRC katmanı ayrı bir protokolün işi, burada uydurulmadı.
          status: 'ready',
          pluginId: 'cobs',
          tabs: ['overview', 'live', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'COBS Encoder',
            'COBS Decoder',
            'Overhead Calculator',
            'Code Byte View',
            'Zero Delimiter View',
            'COBS + CRC Pipeline',
          ],
        },
        {
          id: 'hdlc',
          name: 'HDLC',
          summary:
            'Bit-oriented data-link framing with a 0x7E flag, five-ones bit stuffing and an I/S/U control field, forming the base of PPP, SDLC and many telecom links.',
          layer: 'data-link',
          // Faz 10 dalga 10c: `hdlcCore.ts`nin (PAYLAŞILAN çekirdek, SDLC de
          // kullanıyor) ÜSTÜNDE ince ProtocolPlugin sarmalı. Decode sekmesinin
          // girdisi (hex yapıştırma) zaten bit-destuffed "Logical Frame"
          // sayılır (spec'in kendi terimi) — bit-stuffing/senkron yakalama bu
          // dalgada YOK ("Bit Stuffing View"/"Transmitted Bit Stream View"
          // ERTELENDİ, COBS'un "COBS + CRC Pipeline" ertelemesiyle aynı
          // disiplin). Control field basık/modulo-8 mod (ISO 13239 varsayılan
          // profili); U-frame KOMUT adları (SABM/DISC/UA vb.) doğrulanmış bir
          // bit-deseni↔ad tablosu yokluğunda BİLEREK adlanmadı, yalnız ham
          // M-bit'ler + format (I/S/U) + P/F + N(S)/N(R)/S-tipi çözülür. FCS
          // (CRC16_X25) hesaplanır VE doğrulanır (bacnetmstp.ts/zigbee.ts'in
          // PASS/FAIL deseniyle aynı — PPP'nin (10b) fixture'sızlıkla
          // ERTELEDİĞİNİN AKSİNE, burada motor+fixture ikisi de var).
          status: 'ready',
          pluginId: 'hdlc',
          // 'live' yok: bit-senkron çerçeveleme sıradan seri portla yakalanamaz,
          // ilk sürüm log/import üzerinden çalışır.
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Flag Detector',
            'Bit Stuffing View',
            'Address Field',
            'Control Field Decoder',
            'I/S/U Frame Classifier',
            'Information Field',
            'FCS Validator',
            'Transmitted Bit Stream View',
          ],
        },
        {
          id: 'sdlc',
          name: 'SDLC',
          summary:
            "IBM's synchronous bit-oriented predecessor of HDLC, built around primary/secondary stations, station addressing and poll/final signalling in legacy mainframe links.",
          layer: 'data-link',
          // Faz 10 dalga 10c: `hdlcCore.ts`nin AYNISI (HDLC ile birebir aynı
          // çerçeve şekli) — yalnız Address alanı "Station Address" olarak
          // adlanır, 0xFF All-Stations (broadcast) notu taşır. HDLC'nin
          // ERTELEDİĞİ aynı ikisi (bit-stuffing/senkron yakalama, U-frame
          // komut adları) burada da YOK.
          status: 'ready',
          pluginId: 'sdlc',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Flag Detector',
            'Station Address Decoder',
            'Control Field Decoder',
            'Information/Supervisory/Unnumbered Classifier',
            'Poll/Final State',
            'Bit Stuffing View',
            'FCS Validator',
            'Station Model',
          ],
        },
        {
          id: 'ppp',
          name: 'PPP',
          summary:
            'RFC 1661 encapsulation that carries several network-layer protocols over one point-to-point link, negotiated by LCP and framed HDLC-style with 0x7D escaping and an ACCM.',
          layer: 'data-link',
          // Faz 10 dalga 10b: `protocol-core/framing/hdlcFraming.ts`nin (Faz 6)
          // ÜSTÜNDE ince ProtocolPlugin sarmalı — motor zaten kesiyor VE async
          // kaçış çözüyor/kodluyor. Address/Control+Protocol demux (PFC/ACFC
          // algılanır) ve LCP Code/Identifier/Length + bilinen seçenek TLV'leri
          // (MRU/ACCM/Auth-Protocol/Magic-Number/PFC/ACFC) çözülür. "Negotiation
          // Timeline" (çok çerçeveli oturum takibi) ve "FCS Validator" bu
          // dalgada YOK — FCS ayrı alanda gösterilir ama doğrulanmaz (bağımsız
          // fixture yok, CLAUDE.md fixture disiplini; COBS'un kendi "COBS + CRC
          // Pipeline" ertelemesiyle aynı gerekçe).
          status: 'ready',
          pluginId: 'ppp',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'PPP Frame Decoder',
            'Protocol Field Decoder',
            'LCP Code Decoder',
            'Negotiation Timeline',
            'Asynchronous Escaping View',
            'ACCM Viewer',
            'FCS Validator',
          ],
        },
        {
          id: 'kiss',
          name: 'KISS',
          summary:
            'Minimal FEND-delimited framing between a computer and a packet-radio TNC, whose payload is normally an AX.25 frame that can be decoded further up the chain.',
          layer: 'data-link',
          // Faz 10 dalga 10b: `protocol-core/framing/slip.ts`nin (Faz 6) ÜSTÜNDE
          // ince ProtocolPlugin sarmalı — SLIP'in AYNI dört baytı (FEND/FESC/
          // TFEND/TFESC), motor TEKRAR YAZILMADI. Type Indicator (port/komut
          // yarım baytı) adlanır. "AX.25 Chain Decode" bu dalgada YOK — v1
          // Data Frame payload'ı ham kalır (brief-faz10-dalga10.md, 10b).
          status: 'ready',
          pluginId: 'kiss',
          tabs: ['overview', 'live', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'FEND Framing',
            'FESC Escaping View',
            'Command/Port Decoder',
            'KISS Decoder',
            'KISS Encoder',
            'AX.25 Chain Decode',
            'Error View',
          ],
        },
        {
          id: 'xmodem',
          name: 'XMODEM',
          summary:
            'Stop-and-wait serial file transfer in 128- or 1024-byte blocks with block-number complement checking, checksum or CRC-16 mode, and NAK-driven retransmission.',
          layer: 'application',
          // Faz 10 dalga 10d: `xmodemCore.ts`nin (PAYLAŞILAN çekirdek, YMODEM
          // de kullanıyor) ÜSTÜNDE ince sarmal. Framing motoruna (Faz 6) hiç
          // uğramaz — çerçeve sınırı Header baytının (SOH/STX) taşıdığı sabit
          // veri uzunluğundan (128/1024) türetilir, delimiter/length-field
          // YOK. Checksum(SUM-8)/CRC(CRC16_XMODEM) modu çerçeve UZUNLUĞUNDAN
          // çözülür. "Transfer Session View"/"ACK-NAK Timeline"/"Progress
          // View" (çok-çerçeveli oturum takibi) bu dalgada YOK — decode tek
          // bir blok/kontrol baytı çözer, PPP'nin (10b) LCP oturum takibini
          // ERTELEMESİYLE aynı disiplin.
          status: 'ready',
          pluginId: 'xmodem',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Transfer Session View',
            'Block Decoder',
            'Block Number / Complement Check',
            'Checksum Calculator',
            'CRC-16 Mode Handshake',
            'ACK/NAK Timeline',
            'Retry Analyzer',
            'Progress View',
          ],
        },
        {
          id: 'ymodem',
          name: 'YMODEM',
          summary:
            'XMODEM extended with a block 0 metadata header carrying filename, size and modification time, enabling batch transfer of several files in one session.',
          layer: 'application',
          // Faz 10 dalga 10d: `xmodemCore.ts`nin AYNISI (blok yapısı XMODEM
          // ile birebir) — yalnız Block 0 "batch metadata" olarak ayrıca
          // çözülür: dosya adı + boyutu NET (spec), mtime/mode/serial
          // encoding'i standardize DEĞİL, ham bırakılır (uydurulmadı). Boş
          // dosya adı batch terminatörü olarak adlanır. "Modification Time
          // Decoder"/"Batch Session Tree" (çok-dosyalı oturum takibi) bu
          // dalgada YOK — XMODEM'in aynı gerekçesi.
          status: 'ready',
          pluginId: 'ymodem',
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
            'Transfer Session View',
            'Block 0 Metadata Decoder',
            'Filename / Filesize Parser',
            'Modification Time Decoder',
            '128/1024 Sector Handling',
            'Batch Session Tree',
            'CRC Validator',
            'ACK/NAK Timeline',
            'Retry Analyzer',
            'Progress View',
          ],
        },
        {
          id: 'zmodem',
          name: 'ZMODEM',
          summary:
            'Streaming file transfer with position-based error recovery and resume, exchanging ZRQINIT/ZRINIT/ZFILE/ZRPOS/ZDATA/ZEOF/ZFIN frames instead of waiting for a per-block ACK.',
          layer: 'application',
          status: 'ready',
          pluginId: 'zmodem',
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
          // Kanonik tek bir ZMODEM yok; **lrzsz profili** seçildi (kullanıcı
          // kararı, dalga 10d/2) — header/frame-type/CRC16-32/ZDLE kaçışı bu
          // profille çözülür. "Implementation Profile Metadata" ve
          // session/batch araçları (Session State Machine/Error Recovery
          // View/Batch Transfer Tree) ASPİRASYONEL kaldı — decode tab
          // stateless tek header+subpacket alır, oturum takibi bu dalganın
          // işi değil (XMODEM/YMODEM/PPP'nin aynı ertelemesiyle aynı disiplin).
          tools: [
            'Session State Machine',
            'ZRQINIT/ZRINIT Negotiation',
            'ZFILE Information Decoder',
            'ZDATA Streaming View',
            'ZRPOS Position / Resume Analyzer',
            'Error Recovery View',
            'Batch Transfer Tree',
            'CRC Validator',
            'Implementation Profile Metadata',
          ],
        },
        {
          id: 'ubx',
          name: 'UBX',
          summary:
            'u-blox binary GNSS message format with a B5 62 sync, class/ID naming and a two-byte checksum, usually interleaved with NMEA and RTCM on the same receiver port.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Sync/Class/ID/Length Frame View',
            'Class-ID Browser',
            'Little-Endian Length Decoder',
            'Payload Decoder',
            'Checksum Validator',
            'Packet Builder',
            'Multi-Protocol Stream Detector',
          ],
          related: ['interfaces-framing/framing-stream-protocols/rtcm'],
          aliasOf: 'marine-navigation/gnss-corrections/gnss-ubx',
        },
        {
          id: 'rtcm',
          name: 'RTCM',
          summary:
            'GNSS correction message family framed by a 0xD3 preamble, length and CRC, carrying reference station, observation, MSM and SSR message types to RTK rovers.',
          layer: 'application',
          status: 'planned',
          // 'build' yok: tam mesaj tabloları lisanslı yayın kapsamında olduğu için
          // güvenilir bir üretici (encoder) açık kaynaklarla kurulamaz.
          tabs: ['overview', 'live', 'decode', 'data', 'diagnostics', 'examples'],
          tools: [
            'Preamble/Length/Payload/CRC Frame View',
            'Message Type Decoder',
            'Station ID Decoder',
            'RTCM 2.x / 3.x Version Selector',
            'Message Database Browser',
            'CRC Validator',
            'Multi-Protocol GNSS Monitor',
          ],
          related: ['interfaces-framing/framing-stream-protocols/ubx'],
          aliasOf: 'marine-navigation/gnss-corrections/rtcm',
        },
        {
          id: 'at-commands',
          name: 'AT Commands',
          summary:
            'ITU-T V.250 and 3GPP TS 27.007 text command set for modems and cellular modules, where unsolicited result codes must be kept on a separate channel from command responses.',
          layer: 'application',
          // Faz 10 dalga 9b: jenerik çerçeveleme motoru yazıldı
          // (src/protocols/serial/atcommands/atCommands.ts) — komut/yanıt
          // ayrımı, URC, final result code (OK/ERROR/+CME ERROR/+CMS ERROR).
          // hayes-command-set BU sayfada değil, kendi (planned) kaydında —
          // motoru nasıl kullanacağı ayrı bir karar (brief 9b madde 7).
          status: 'ready',
          pluginId: 'at-commands',
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
            'Command Parser',
            'Response Parser',
            'URC Stream Separator',
            'Parser State Machine',
            'Command Console',
            'Final Result Code Decoder',
            'Prompt / Binary Payload Handler',
            'Response Time Measurement',
          ],
        },
        {
          id: 'hayes-command-set',
          name: 'Hayes Command Set',
          summary:
            'The original ATtention command vocabulary — ATD, ATA, ATH, ATZ, S-registers and the guard-timed +++ escape that separates command mode from online data mode.',
          layer: 'application',
          // Faz 10 dalga 9 madde 7: V.250 temel sözdizimi yazıldı
          // (src/protocols/serial/atcommands/hayesCommandSet.ts) — at-commands'ın
          // ÜSTÜNDE, motoru NASIL kullanacağı kararı "içeriden çağır +
          // zenginleştir" olarak verildi (CAN 2.0A/2.0B'nin iki-plugin emsali
          // DEĞİL). "+++" tespiti üç artı aramak DEĞİLDİR: guard-time olmadan
          // veri içindeki literal "+++" yanlış pozitif üretir —
          // `detectEscapeSequence` bunu üç eşikle (öncesi/arası/sonrası
          // sessizlik) doğru sınar, ama KAYITLI bir akışı analiz eder, canlı
          // modem sürücüsü değildir. Command/Data Mode State View motoru da
          // (`createHayesModeTracker`) hazır — ikisi de UI'a BAĞLANMADI,
          // Cellular Initialization Dashboard'la aynı sınıf iş (karar 4),
          // kendi turunu bekliyor.
          status: 'ready',
          pluginId: 'hayes-command-set',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Basic Command Decoder',
            'Dial Command Parser',
            'S-Register Browser',
            'Result Code Mapper',
            'Command / Data Mode State View',
            'Escape Sequence Guard-Time Analyzer',
            'Echo / Verbose Detection',
          ],
          related: ['interfaces-framing/framing-stream-protocols/at-commands'],
        },
      ],
    },
  ],
};
