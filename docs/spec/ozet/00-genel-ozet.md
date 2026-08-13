# ALP Comm Toolkit — Genel Özet (Ana Dosya)

> Kaynak: `ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve Protokol Geliştirme Platformu.md`
> (42.975 satır, ~63.350 kelime, 1.594 başlık). Tamamı 11 parça halinde satır satır okundu ve
> aşağıdaki dosyalara kayıpsız teknik özet olarak indirildi. Bu dosya birleşik üst görünümdür.

## Özet dosya haritası

| Dosya | Kapsam | Kaynak satır |
|---|---|---|
| [01-fiziksel-arayuzler.md](01-fiziksel-arayuzler.md) | Giriş, rol, hedef + 3.1: UART…FlexRay PHY (23 arayüz) | 1–3628 |
| [02-framing-protokolleri.md](02-framing-protokolleri.md) | 3.2: Custom Binary…Hayes (17) + Frame Visualizer/Hata Modeli/Auto-Detection | 3629–6350 |
| [03-endustriyel.md](03-endustriyel.md) | 3.3: Modbus…IEC 61850 (25) + Industrial Transaction Analyzer | 6351–10334 |
| [04-otomotiv.md](04-otomotiv.md) | 3.4: CAN…J1850 (25) + Automotive Network Analyzer | 10335–13989 |
| [05-denizcilik.md](05-denizcilik.md) | 3.5: NMEA/AIS/RTCM + Marine Dashboard | 14139–17071 |
| [06-havacilik-uav.md](06-havacilik-uav.md) | 3.6: MAVLink/DroneCAN/ARINC/ADS-B + Aerospace Analyzer | 17200–21438 |
| [07-bina-otomasyonu.md](07-bina-otomasyonu.md) | 3.7: BACnet/KNX/DALI/DMX/Art-Net/sACN + gateway'ler | 21602–25311 |
| [08-ag-ethernet.md](08-ag-ethernet.md) | 3.8: Ethernet…mDNS (28) + Network Analyzer | 25312–31920 |
| [09-kablosuz-iot.md](09-kablosuz-iot.md) | 3.9: BLE/Zigbee/Thread/Matter/LoRa/Wi-Fi/NB-IoT | 31921–37320 |
| [10-uygulama-spec.md](10-uygulama-spec.md) | **Bölüm 4–50: uygulamanın kendisi** (en kritik) | 37321–40074 |
| [11-domain-taksonomisi.md](11-domain-taksonomisi.md) | 8 domain / 54 aile / 172 protokol ağacı + sayfa şablonu | 40075–42975 |

## Ne inşa edilecek

Web tabanlı, tamamen **yerel çalışan** haberleşme analiz ve protokol geliştirme platformu.
Basit seri terminal DEĞİL: fiziksel katmandan (RS-485 A/B voltajı) uygulama değerine
(Motor Speed 1500 rpm) kadar aynı transaction'ı **katman katman** açıklayan mühendislik ortamı.

14 temel yetenek: ham veri görüntüle → paketle → alanları çöz → standart protokolleri otomatik
çözümle → **kullanıcı kendi protokolünü tanımlasın** (merkez: Custom Protocol Studio) → paket
üret/gönder → canlı grafik → timing/bus load hesapla → log analiz → bilinmeyen protokolü tersine
mühendislik → protokoller arası dönüştür → test senaryosu → dokümantasyon/kod üret → hata tespit.

## Teknoloji ve mimari

- **Stack:** React + TypeScript + Vite + Tailwind + React Router + Zustand + IndexedDB +
  Web Serial/USB/Bluetooth/WebSocket + File System Access + Web Workers + Recharts +
  Vitest/RTL/Playwright + Zod.
- Kod tamamen İngilizce; UI Türkçe (varsayılan) + İngilizce, tüm metin çeviri dosyasında.
- **Klasör yapısı** (10-uygulama-spec.md §6'da aynen): `app/ components/ connection/
  protocol-core/ protocols/{serial,industrial,automotive,marine,aerospace,building,network,wireless}
  features/ workers/ types/ constants/ utils/ translations/ tests/`
- **Kural:** parser/hesap kodu React bileşenine yazılmaz — bağımsız TS modülleri.
- **Protocol Core** (§7'de interface'ler aynen): `RawFrame`, `ParsedField`, `ParsedFrame`,
  `ParseResult` (discriminated union), `ProtocolParser` (canParse/parse), `ProtocolEncoder<T>`,
  `ProtocolPlugin` (§47 — eklenti mimarisi).
- Ağır iş Web Worker'da: stream-parser, log-analyzer, crc-finder, reverse-engineering, network-parser.

## Kapsam: 8 domain, 172 protokol yaprağı

| Domain | Aile | Protokol | Öne çıkanlar |
|---|---|---|---|
| 1. Interfaces & Framing | 5 | 40 | UART, RS-232/422/485, SPI/QSPI/OSPI, I²C/I3C/SMBus/PMBus, 1-Wire, USB, SPE, CAN/LIN/FlexRay PHY, SLIP/COBS/HDLC/PPP/KISS, X/Y/ZMODEM, UBX, RTCM, AT |
| 2. Industrial | 8 | 25 | Modbus ×3, PROFIBUS/PROFINET, EtherCAT, EtherNet/IP+CIP, CANopen, IO-Link, HART, M-Bus, OPC UA, IEC 60870-5-101/104, DNP3, IEC 61850 (v1: yalnız MMS+GOOSE) |
| 3. Automotive | 7 | 25 | CAN/FD/XL, J1939, LIN, FlexRay, SENT/SPC/PSI5, ISO-TP, UDS, OBD-II, DoIP, SOME/IP, XCP/CCP, J1850 |
| 4. Marine | 5 | 11 | NMEA 0183/2000, IEC 61162 ailesi, AIS, RTCM/NTRIP, SeaTalk |
| 5. Aerospace & UAV | 6 | 16 | MAVLink 1/2, DroneCAN/Cyphal, SBUS/IBUS/CRSF/PPM/PWM, ARINC 429, MIL-STD-1553, ADS-B/Mode-S |
| 6. Building | 7 | 11 | BACnet MS/TP+IP, KNX, DALI-2, M-Bus, LonWorks, DMX512, Art-Net, sACN |
| 7. Network | 8 | 28 | Ethernet/VLAN/ARP, IPv4/6, ICMP, TCP/UDP, DHCP/DNS/mDNS, NTP/PTP/SNMP/Syslog/LLDP, HTTP/WS/MQTT/MQTT-SN/CoAP, RTP/RTCP, TFTP/FTP/Telnet |
| 8. Wireless & IoT | 8 | 16 | BLE Adv+GATT, Zigbee, Thread, Matter, LoRa/LoRaWAN, Wi-Fi, ESP-NOW, Custom RF, W-MBus, NB-IoT, LTE AT, GNSS modem |

Hiyerarşi: Domain → Family → Protocol → Analyzer/Decoder/Calculator/Builder/Monitor.
Protokol sayfası şablonu: Overview / Live / Decode / Build / Timing / Data / Diagnostics /
**Definitions (capability'ye göre dinamik!)** / Examples. Definitions eşlemesi:
CAN→DBC, CANopen→EDS, PROFIBUS→GSD, PROFINET→GSDML, IO-Link→IODD, XCP→A2L, LIN→LDF,
IEC 61850→SCL, LonWorks→XIF, SNMP→MIB, ARINC/1553→ICD/CSV.

## Spec'in tekrar eden mimari ilkeleri (tüm domain'lerde aynı)

1. **Layer drill-down:** her değer raw byte'a kadar geri izlenebilir (Heading 123.4° → HDT →
   field → ASCII → serial stream). Çift yönlü senkron highlight.
2. **Ortak hata taksonomisi:** domain başına 19–40 kod (`NO_SYNC`, `CRC_ERROR`,
   `STALE_DATA`, `SOURCE_DISAGREEMENT`…), her hata: Timestamp/Expected/Received/Severity/Possible Cause.
3. **Tanım dosyası = decoder'a semantik kaynağı** (proje konfigü değil): DBC/EDS/GSDML/IODD/A2L/LDF/SCL/XIF + vendor register map (CSV/JSON).
4. **Freshness modeli her yerde:** `Age = t_now − t_lastUpdate`; Fresh/Stale/Missing eşikleri yapılandırılır.
5. **"Tahmin etme" disiplini:** DPT bilinmiyorsa raw göster ("Cannot determine engineering
   meaning"); auto-detection = candidate + confidence (asla başlangıç byte'ından kesin karar);
   adres tek başına cihaz kimliği değil; CRC-düzeltilmiş mesaj native-valid ile aynı güvende gösterilmez.
6. **Fiziksel adres ≠ mantıksal kimlik:** MS/TP MAC ≠ Device Instance, IP ≠ CID (sACN),
   NMEA2000 SA değişir NAME kalır, BLE private address rotation, LoRaWAN DevAddr ≠ DevEUI.
7. **Standart revizyonu = metadata:** sürümler hard-code edilmez (ISO 14229-1:2026 Ed.4,
   ISO 15765-2:2024 Ed.4, ISO 13400-2 Ed.3 2025, RTCM 10403.4, ITU-R M.1371-6 02/2026,
   ANSI E1.31-2025, GSDML V2.50, Matter 1.6, Cyphal v1.0 stable / v1.1 deneysel…).
8. **Anahtar yerel kalır:** LoRaWAN/Zigbee/W-MBus/MAVLink signing anahtarları asla dışarı
   gönderilmez; key yoksa payload "ENCRYPTED" bırakılır, uydurulmaz.
9. **Parser paylaşımı:** tek engine, çok görünüm — Modbus (industrial↔building↔marine),
   NMEA (marine↔aerospace↔GNSS modem), MQTT/CoAP (network↔IoT), J1939 (automotive↔marine),
   UBX/RTCM (framing↔marine↔aerospace), CANopen↔POWERLINK ortak OD engine.
10. **TCP = byte stream:** MQTT/HTTP/Modbus TCP parser'ları reassembled stream üzerinden çalışır,
    packet payload üzerinden değil. Seri tarafta stream buffer + 9 durumlu parser state machine.

## Kısıtlar

- **Güvenlik (§41):** her şey yerel; port mesajı/CAN log/anahtar/register sunucuya gitmez.
  `eval` yasak, dinamik kod yasak, HTML sanitize, dosya boyutu limiti, parser timeout,
  max frame length, worker cancellation, sonsuz loop engeli. Length alanına körü körüne güven yok.
- **Performans (§44):** 100k satır log UI'ı dondurmaz; canlı akış UI thread'i bloklamaz;
  parser binlerce frame/s; tablolar virtualized; grafik nokta sınırı; auto-detection iptal edilebilir.
- **UX (§42):** her araç 13 bölüm (ne işe yarar → giriş → örnek → sonuç → formül →
  **adım adım hesap** → yorum → sınırlamalar → yaygın hatalar → kopyala/dışa aktar).

## Teslimat planı

**Sürümler:** 1.0 temel (converter'lar, CRC, UART/SPI/I²C calc, Live Serial, Protocol Studio,
Packet Builder, Modbus RTU+TCP, NMEA 0183) → 1.1 CAN/otomotiv → 1.2 deniz+hava →
1.3 endüstri+bina → 1.4 ağ+IoT → 1.5 ileri analiz (reverse engineering, CRC Finder, converter, test automation).

**Phase 1–10 (§46):** setup/tema/çeviri → byte utils + CRC + timing engines + testler →
stream buffer + framing + parser interface → **Protocol Studio + Packet Builder** → Web Serial
Monitor + grafikler → Modbus/NMEA/CAN/DBC/J1939 → CANopen/LIN/ISO-TP/UDS/OBD → NMEA2000/AIS/
MAVLink/UBX/RTCM → Ethernet/TCP/MQTT/CoAP/PCAP → industrial/wireless/RE/test-automation.

**İlk çalışan teslimat — 15 araç gerçekten çalışacak (§50):** HEX/ASCII, IEEE-754, Endian,
CRC Calculator, UART/SPI/I²C Calculator, Live Serial Monitor, Custom Protocol Studio,
Packet Builder, Modbus RTU + TCP Decoder, NMEA 0183 Decoder, CAN Frame Decoder, J1939 ID Decoder.
Boş kart yasak — her aracın gerçek motoru olacak.

**Test fixture'ları (§43, spec içi tutarlı):** CRC `123456789` → CRC-8 `0xF4`, CCITT-FALSE
`0x29B1`, MODBUS `0x4B37`, CRC-32 `0xCBF43926` · UART 115200 8N1 20B ≈ 1.736 ms ·
Modbus `01 03 00 00 00 02 C4 0B` · NMEA GGA `*47` · Custom `AA 05 10 03 34 12 7F 4F 55` ·
J1939 `0x18F00401` → PGN 61444 · IEEE-754 25.75 → `41 CE 00 00`.

## Kritik bulgular / riskler (özetlerin birleşik "dikkat çekenler"i)

1. **IA çelişkisi çözümü:** Ana sayfa kategorileri Bölüm 5'te 17 düz liste; Bölüm 50 sonunda (50.1)
   spec kendini revize ediyor → **5 grup / 17 kategori** (LIVE & DEVELOPMENT, COMMUNICATION
   DOMAINS ×8, ENGINEERING TOOLS, ANALYSIS & TEST, WORKSPACE). **50.1 esas alınmalı.**
2. **Çift "3.x" numaralandırma:** erken teknik bölüm (3.1–3.9) ile taksonominin domain içi
   numaraları (3.1–3.7) çakışıyor — çapraz referansta satır numarası/başlık adı kullan.
3. **"Offset" isim çakışması:** alan özelliklerinde hem bayt konumu hem kalibrasyon sabiti —
   kodda `byteOffset` vs `calibrationOffset` ayrılmalı.
4. **Lisanslı veritabanı bağımlılığı:** RTCM mesaj tabloları, NMEA 2000 PGN alanları, AIS tam
   alan tabloları, J1939DA, SAE J1979-DA lisanslı — decoder derinliği açık kaynakla tam kurulamaz;
   mimari "database import + revizyon metadata" üzerine kurulmalı. Teknik değil lisans/maliyet riski.
5. **Parser tuzakları (spec'in açıkça uyardıkları):** SBUS 11-bit packing byte-hizasız (naif
   byte decode yanlış); MAVLink 2 trailing-zero truncation geçerli frame; MAVLink CRC_EXTRA
   dialect uyuşmazlığını da yakalar; "UAVCAN" tek parser olamaz (v0=DroneCAN, v1=Cyphal, belirsiz
   seçenek yasak); CAN Frame CRC ≠ E2E CRC; FCS "missing" değil "not captured"; UDP loss "Unknown";
   Hayes `+++` guard-time ister; length semantiği 4 varyant (payload/header/checksum/frame dahil).
6. **Tanımsız bırakılanlar (implementasyonda karar gerek):** hata Severity skalası, auto-detection
   confidence eşikleri, UART parity'li karakter uzunluğu genelleştirmesi, HDLC/PPP FCS varsayılanı.
7. **ODX hiç geçmiyor** (UDS/OBD tarafında beklenebilirdi) — kapsam dışı bırakılmış.
8. **Kaynak LaTeX formülleri bozuk** (Docs→MD dönüşümü) — özet dosyalarındaki temizlenmiş
   formüller esas alınmalı, kaynaktan kopyalanmamalı.
9. **UDS Security Access:** toolkit seed-key kırmaya çalışmaz, yalnız pasif transaction analizi.
10. **Custom Protocol Studio = küçük protokol derleyicisi:** 32 alan tipi, 4 panel, JSON şema,
    4 kod üretici (C/Python/TS/Markdown), dynamic length, koşullu alan, repeat, CRC coverage —
    tek başına en büyük modül; "en önemli bölüm" diye işaretli, Phase 4'te erken geliyor.
