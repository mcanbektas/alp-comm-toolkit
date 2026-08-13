# 3.9 Kablosuz & IoT — Teknik Özet

*Kaynak: "ALP Comm Toolkit" satır 31921–37320.*

## BLE Advertisement

BLE (2.4 GHz), bağlantı öncesi discovery/presence/service/app-data yayınlar. Ayrım: Legacy / Extended / Periodic Advertising / Scan Response.

RF görünüm: Timestamp, PHY (LE 1M vb.), Channel (37/38/39), Frequency, RSSI, CRC PASS/FAIL. RSSI mesafeye çevrilmemeli (anten/TX power/multipath etkisi) — en fazla "RSSI-based rough estimate, Confidence: LOW" deneysel. Aynı event'teki CH37/38/39 RSSI'ları correlate edilir (interference/anten davranışı).

Link Layer: Preamble→Access Address→PDU→CRC; PDU = Header(PDU Type/RFU/ChSel/TxAdd/RxAdd/Length) + Payload. PDU türleri: ADV_IND, ADV_DIRECT_IND, ADV_NONCONN_IND, ADV_SCAN_IND, SCAN_REQ, SCAN_RSP, CONNECT_IND; Extended: ADV_EXT_IND, AUX_ADV_IND, AUX_CHAIN_IND, AUX_SCAN_RSP.

**AD Structure formatı:** `Length | AD Type | AD Data` (ilk octet=Length, Data'nın ilk octet'i=AD Type):
```
02 01 06                        → Length=2, AD Type=0x01, AD Data=06
05 FF 4C 00 01 02               → Length | Type | Company Identifier | Manufacturer Data
09 09 53 65 6E 73 6F 72 30 31   → ASCII "Sensor01" → Complete Local Name: Sensor01
```
AD Type'lar (Bluetooth Assigned Numbers): Flags, Complete/Shortened Local Name, 16/128-bit Service UUID, Service Data, Manufacturer Specific Data, Tx Power, Appearance, URI.

Device Table: Address/Name/RSSI/PHY/Last Seen + Public-Random, Connectable, Scannable, Directed, Tx Power, Services, Manufacturer, Adv Rate. Adres tipleri: Public, Random Static, Resolvable Private, Non-Resolvable Private — rotasyonda identity key yoksa "Possible rotation / Identity unknown" (otomatik "New Device" denmez).

Advertisement Rate: `T_i = t_i − t_(i−1)`, `f = 1/T_avg`. Örnek: 102/98/101/104 ms → Avg 101.25 ms, Rate 9.88 adv/s + Jitter (random scheduling nedeniyle küçük varyasyon hata sayılmaz).

## BLE GATT

Katman: Application→GATT→ATT→L2CAP→LE Link (service discovery + read/write + notify/indicate, ATT üzerinden).

GATT ağacı: Service→Characteristic(Declaration/Value/Descriptor). UUID: 16-bit (SIG DB, ör. 0x2A6E=Temperature) veya 128-bit custom. Attribute: Handle+UUID+Permissions+Value (ör. 0x0025/Custom Temperature/READ+NOTIFY).

Properties bit mask: Broadcast/Read/Write Without Response/Write/Notify/Indicate/Authenticated Signed Write/Extended Properties. Örnek `0x12=00010010` → READ+NOTIFY.

Read: Read Request→Read Response (ör. Handle 0x0025, raw `EA 00`, int16, scale 0.01°C → 2.34°C). Write: Write Request (response bekler) vs Write Command/Without Response (beklemez).

Notification (ack yok) vs Indication (confirmation beklenir) — fark açık gösterilmeli. CCCD (0x2902): bit0=notification, bit1=indication enable (ör. `0x0001` → Notify Enabled/Indicate Disabled).

Custom GATT Schema Import: Service/Characteristic UUID, Name, Data Type, Endian, Scale, Offset, Unit, Enum, Bit Fields. Örnek: BatteryVoltage, uint16 LE, factor 0.001 V, raw `C4 30` = 12484 → **12.484 V**.

## Zigbee

IEEE 802.15.4 tabanlı mesh IoT stack. CSA, 2025 sonu **Zigbee 4.0** duyurdu (Core R23.2, BDB 3.1, Device Type Library, Zigbee Direct); 2.4 GHz + Sub-GHz PHY. Katman: Application→ZCL→APS→NWK→802.15.4 MAC→PHY.

Roller: Coordinator/Router/End Device (+ Parent/Children/Depth/Neighbors graph). MAC→NWK parse: Frame Control/Sequence/Addressing/Payload/FCS. NWK alanları: Frame Control, Dest/Source Address, Radius, Sequence, Optional, Payload.

Addressing: 64-bit IEEE (kalıcı) vs 16-bit NWK (rejoin sonrası değişebilir, IEEE ile ilişkilendirilir). APS: Dest/Source Endpoint, Cluster ID, Profile ID, Counter, Security, Payload.

ZCL: Cluster ID/Name, Command, Attribute, Data Type, Value, Unit (ör. On/Off, Level Control, Temperature Measurement cluster'ları). Örnek: raw `29 09` → MeasuredValue 0x0929 = 2345 × 0.01°C = **23.45 °C**. Komutlar: Read/Write Attributes, Read Attributes Response, Report Attributes, Default Response, Cluster-Specific Command.

Join Analyzer: Network Discovery→Parent Selection→Association/Join→Security→Device Announce→App Discovery/Binding (çıkarılır: Join Started, Parent, Network, Channel, PAN ID, Ext PAN ID, Assigned Address, Security Result, Join Time).

Security: AES-128 (+ CSA'nın certificate/elliptic-crypto yenilikleri); Security Enabled, Frame Counter, Key Sequence, MIC (Valid/Invalid/Unable to verify) — key yoksa payload encrypted bırakılır, uydurulmaz.

## Thread

IPv6 mesh; 802.15.4+6LoWPAN üzerinde IPv6 (IP-native, low-power mesh). Güncel: **Thread 1.4.1**. Katman: Application→UDP/IPv6→Thread NWK→6LoWPAN→802.15.4. Thread ≠ Matter (Matter genelde üstünde çalışır).

Roller: Leader, Router, Router-Eligible End Device, End Device, Sleepy End Device, Border Router — tek kalıcı hub yok, Border Router diğer IPv6 ağlara bağlar.

Adresler: Extended Address, RLOC16, Mesh-Local, Link-Local IPv6, Global/ULA IPv6 — RLOC ≠ application identity (topoloji değişince değişir).

6LoWPAN: 802.15.4 Payload→compressed header→Reconstructed IPv6 (40 byte); Header Compression Saving hesaplanır. Fragment Reassembly: fragment 1/2/3→Complete IPv6 Datagram (hata: `THREAD_FRAGMENT_MISSING`, `THREAD_REASSEMBLY_TIMEOUT`).

MLE (node/router ilişkisi, app UDP'den ayrı sınıflandırılır): Parent Request/Response, Child ID, Advertisement, Link Request/Accept.

Border Router Analyzer: Thread Mesh→Border Router→Ethernet/WiFi LAN→IPv6 Network (Thread/Infra Interface, Prefixes, Routes, NAT64, DNS discovery state).

## Matter

IP tabanlı app-layer protokol (SDK: application/data model/interaction model/action framing/security/message framing-routing/IP transport); WiFi/Thread üzerinde çalışır. **Matter 1.6** (Haziran 2026). Katman: App→Data Model→Interaction Model→Matter Message→Security→UDP/IP→WiFi/Thread/Ethernet.

Node Model: Node→Endpoint 0 (Basic Information/Descriptor/Operational Credentials) + Endpoint 1..N (cluster'lar, ör. On/Off, Level Control). Data model tree: Node ID, Fabric, Endpoint, Cluster, Attribute, Command, Event.

Interaction Model: Read/Write/Subscribe/Invoke/Report (ör. ReadRequest→ReportData: Temperature Measurement/MeasuredValue=23.4°C). Subscription: Subscribe→tekrarlı ReportData (Min/Max Interval, Subscription ID, Last Report, Report Count) — Matter 1.4.2+ verimlilik iyileştirmesi getirdi.

Commissioning: Discovery→Commissioning Channel→PASE→Device Attestation→Network Provisioning→Operational Credentials→CASE/Operational State; Matter 1.6 NFC-based commissioning ekledi (BLE-only varsayılmamalı).

Security: Session (PASE/CASE/Group), Encrypted, Fabric, Session ID (key yoksa çözülmez); Access Control: Privilege/Auth Mode/Subject/Target — tüm Interaction Model işlemleri buradan geçer.

TLV: Structure→Context Tag/Unsigned Integer/Boolean/Byte String/List, recursive tree; raw bytes ↔ Cluster Attribute arası drill-down.

## LoRa (PHY) ve LoRaWAN (MAC/Network)

**Ayrım:** LoRa = Semtech chirp spread spectrum PHY (network protokolü değil); LoRaWAN = LoRa üzerine kurulu LoRa Alliance network/MAC standardı. İki modül: LoRa PHY Analyzer, LoRaWAN Protocol Analyzer.

### LoRa PHY
Parametreler: Center Frequency, BW, SF, CR, Preamble Length, Explicit/Implicit Header, CRC, Payload Length, IQ config. BW/SF/CR seçimi ToA/robustness/sensitivity/battery-range trade-off'unu belirler (Semtech).

Symbol duration:
```
T_sym = 2^SF / BW
```
Örnek SF=7, BW=125 kHz: T_sym = 128/125000 = **1.024 ms**; SF+1 → T_sym ~2 katına çıkar.

Symbol rate:
```
R_s = 1 / T_sym = BW / 2^SF
```
Örnek SF7/BW125: R_s = **976.5625 symbols/s**.

Nominal bit rate:
```
R_b ≈ SF × (BW / 2^SF) × CodingRateFraction
```
"Estimated PHY Bit Rate" — gerçek throughput değil (preamble/header/FEC/CRC/overhead hariç tutulmamıştır).

Time on Air: Input SF/BW/CR/Preamble/Header Mode/CRC/Payload Length/LDRO → Output Symbol Time, Preamble/Payload Symbols, Preamble/Payload Time, **Total ToA**, Effective Data Rate (bkz. Semtech LoRa Calculator). Örnek (20B payload): SF7/BW125 → kısa ToA + yüksek rate; SF12/BW125 → uzun ToA + yüksek sensitivity/robustness.

RSSI/SNR: ör. RSSI −118 dBm, SNR −8.5 dB — negatif SNR'da demodülasyon mümkündür, tek başına RSSI yetersizdir. Scatter: X=RSSI, Y=SNR, marker=Success/Failure.

Link Budget:
```
P_RX   = P_TX + G_TX + G_RX − L_path − L_misc
Margin = P_RX − Sensitivity
```
Örnek: 14+2+2−120 = **−102 dBm**; Sensitivity −130 dBm → Margin = **28 dB** (teorik, range garantisi değil).

### LoRaWAN
LoRa Alliance LPWAN; star-of-stars: end devices→gateway(ler)→(IP) Network Server→Application/Join Server. Güncel: **1.1**, **1.0.4**.

Frame:
```
PHYPayload = MHDR + MACPayload + MIC
Data:  MHDR → FHDR(DevAddr, FCtrl, FCnt, FOpts) → FPort → FRMPayload → MIC
```
MHDR tipleri: Join Request/Accept, Unconfirmed/Confirmed Data Up/Down, Rejoin Request, Proprietary.

DevAddr: 32-bit session adresi (≠ DevEUI kalıcı kimlik). FCnt: FCntUp/Down — örnek 100,101,102,105 → gap=3, missing≈2 (gateway tüm uplink'i görmeyebilir). MIC: Received/Calculated/PASS-FAIL (key yoksa "cannot verify").

Activation: OTAA (Join Request→Join Accept→Session Keys→Data Uplink; DevEUI/JoinEUI/DevNonce/Assigned DevAddr görünür) vs ABP.

Classes: A (Uplink→RX1→RX2), B (beacon+ping slots; 1.1 security/roaming++), C (window sürekli açık — düşük latency/yüksek tüketim).

ADR: DataRate/TxPower/ADR Flag/ACK state trend (link'e göre optimizasyon). Regional Parameters: EU868, US915, AU915, AS923, IN865, KR920... — aynı DR5 farklı region'da farklı RF ayarı demektir; Regional doküman Link Layer standardından ayrı sürdürülür.

Duty Cycle:
```
DutyCycle = (TotalTXTime / ObservationTime) × 100
```
Örnek: 36s/3600s = **1%**. Hesap: Packets/hour, Avg ToA, Total ToA, Duty Cycle — regulatory limit region database'inden gelir, hardcode edilmez.

## Wi-Fi (IEEE 802.11)

PCAP/monitor-mode/adapter export log analizi yeterli (full RF demod şart değil). Güncel: **IEEE 802.11-2024**. Sınıflar: Management/Control/Data.

Frame Control: Protocol Version, Type, Subtype, ToDS, FromDS, More Fragments, Retry, Power Mgmt, More Data, Protected, Order.

Address1–4 anlamı type/ToDS/FromDS'e göre değişir (sabit "Address1=Dest/Address2=Source" varsayılmaz); Receiver/Transmitter/Source/Dest Address + BSSID context'e göre hesaplanır.

Management: Beacon, Probe Req/Resp, Auth, Deauth, Assoc Req/Resp, Reassoc, Disassoc, Action. Beacon alanları: SSID, BSSID, Timestamp, Beacon Interval, Capabilities, Supported Rates, Channel, Security Info, Vendor IE.

Information Elements: Element ID+Length+Data (SSID, Supported Rates, DS Parameter, RSN, HT, VHT, HE, EHT, Vendor Specific — revision-aware); bilinmeyen IE (221) OUI+Payload RAW olarak korunur.

Sequence Control: Sequence+Fragment Number → retry/duplicate tespiti (ör. 101 RETRY işaretlenir). RSSI/Channel/Center Freq/Bandwidth/MCS/Spatial Streams/Guard Interval/PHY = capture adaptör metadata'sı (802.11 frame'in kendisi değil, ayrı gösterilir).

Connection Timeline: Probe→Auth→Assoc→Security Handshake→Data→Disassoc (Discovery/Auth/Assoc Time, First Data, Disconnect Reason).

## ESP-NOW

Espressif connectionless WiFi protokolü; app data vendor-specific action frame içinde taşınır (≠UDP/TCP). ESP-IDF v1.0/v2.0. Katman: App→Vendor Specific Element→802.11 Vendor Action Frame→WiFi MAC/PHY.

Action Frame: MAC Header, Category (**127** = vendor-specific), Organization Identifier (Espressif OUI **18:FE:34**), Random Value, Vendor Content, FCS. Element: ID **221**, Length, OUI, Type **4**, Version/flags, Body.

v1.0 max payload **250 byte**; v2.0 max **1470 byte** + çoklu vendor-specific element.

Addressing: Dest/Source MAC, 3. adres broadcast; ToDS=FromDS=0. Security: CCMP, PMK+peer-specific LMK (unicast korunur, multicast/broadcast sınırlı) — key yoksa payload unavailable. Device Graph: Unicast/Broadcast, Packets/s, Bytes/s, RSSI, Retries, Last Seen.

## RF Telemetry Custom Frame

Proprietary Sub-GHz/2.4GHz için "Custom Protocol Studio'nun RF versiyonu". Input: demodulated bytes, bit stream, pulse durations, logic analyzer export, SDR decoder output, UART. Şema: Preamble/Sync Word/Header/Device ID/Packet Type/Sequence/Length/Payload/CRC. Örnek: `AA AA AA 2D D4 01 14 04 34 12 78 56 C9 21` → Preamble `AA AA AA`, Sync `2D D4`, Device `01`, Type `14`, Length `04`, Data `34 12 78 56`, CRC `C9 21`.

Metadata: Frequency, Modulation (FSK/GFSK/OOK/ASK/LoRa/Custom demodulated), Data Rate, Deviation, Bandwidth, RSSI, SNR, Preamble, Sync, Whitening, Manchester, CRC.

Whitening: RF bits→Dewhitening→Frame→CRC (ör. wire `A7 39`→dewhitened `01 10`; polynomial/seed schema'da tanımlanır). Manchester: encoded pairs (01/10)→decoded bits→bytes (polarity profile'a bağlı).

Unknown RF Protocol Analyzer: çoklu paket karşılaştırmasıyla otomatik heuristik — sabit byte'lar, monoton counter adayı, olası checksum/CRC alanları (reverse-engineering için değerli).

## Wireless M-Bus

EN 13757 ailesi utility metering wireless link teknolojisi; OMS interoperable meter/gateway profili, güncel **Generation 5 (2023-12 rev.1)**. Kullanım: Heat/Water/Gas/Electricity Meter, Temp Sensor→Wireless M-Bus→Collector/Gateway→HES/BMS.

Mode: S/T/C/R/N/F (frequency, chip/symbol rate, frame structure, direction profil revizyonuna bağlı). Telegram: RF Metadata→Link Layer Frame→Manufacturer/Device Identity→Security→Application Layer→Meter Records (Manufacturer, Device ID, Version, Device Type, Access Number, Status, Configuration, Payload).

Meter Records: DIF/DIFE/VIF/VIFE/DATA→Energy, Power, Volume, Flow, Temperature, Battery, Time. Örnek (Heat meter): Energy 12.542,7 kWh, Volume 321,45 m³, Supply 68,2°C, Return 52,7°C.

Security: AES-128 + yeni transport security modları (OMS); Security Mode, Encrypted, Authentication, Key ID, Frame Counter — key yoksa Application Payload "ENCRYPTED" bırakılır.

## MQTT / CoAP — IoT Kullanım Katmanı

Her ikisi de 3.8'deki ortak transport engine'i kullanır (tekrar parser yazılmaz).

**MQTT:** Device→Client→Broker→Application. Alanlar: Device/Client ID, Topic, QoS, Retain, Payload Type, Publish Rate, Last Seen, Connection State. Örnek: topic `factory/node17/telemetry`, payload `{"temp":23.4,"humidity":42}` → şema ile Temperature/Humidity. Topic Structure Analyzer topic'i ağaç gösterir. Health: Connected/Last Publish/Keep Alive/QoS ACK latency/Message Rate/Duplicate/Retained/Will (ör. 75s önce, beklenen 10s → **STALE**).

**CoAP:** Sensor→CoAP Resource→UDP/IP→Gateway/Server (resource tree: /temp, /humidity, /config, /status, /battery). Transaction: Resource/Method/Response/Content/Content Format/Latency (ör. GET /temp→2.xx→23.4, 14ms). **Observe:** Client Observe→server stream (23.1→23.2→23.4), IoT subscription benzeri; exact semantics ilgili RFC extension'dan gelir.

## NB-IoT / LTE Modem AT

Raw LTE radio-protokol analizi ilk sürüm hedefi değil — log tabanlı destek: Modem AT, Network registration, Signal-quality, Packet session, Power-state, Socket, Operator, Module debug logs. NB-IoT 3GPP LTE/IoT ailesi; Release 18 IoT-NTN dahil geliştirmeler içerir.

State model: POWER OFF→BOOT→SIM READY→SEARCHING→REGISTERED→ATTACHED→PDP/PDN ACTIVE→SOCKET OPEN→DATA→IDLE/POWER SAVE (terminoloji vendor/3GPP release'e göre değişir; generic state vendor event'ten ayrı tutulur).

Registration: `AT+CEREG?`→Registration (Registered/Searching/Denied/Roaming/Unknown), Tracking Area, Cell, Access Technology (3GPP TS 27.007 revizyonuna bağlı). Signal Quality trend: RSSI, RSRP, RSRQ, SINR, Cell ID, EARFCN/channel, Band. Power Analyzer: PSM, eDRX, Active Time, TAU timer, Wakeup, Sleep. Socket Timeline: Registered→PDP/PDN Context→DNS→Socket Open→Connected→Send/Receive→Close.

AT katmanı: 3GPP **TS 27.007** (2026 itibarıyla aktif) + vendor AT — iki ayrı database. Sınıflar: Basic, Execution, Read, Set, Test (`AT`, `AT+CSQ`, `AT+CEREG?`, `AT+CMD=val`, `AT+CMD=?`). Transaction parser: Command/Form/Intermediate/Final/Latency. URC (registration change, incoming SMS, socket data/closed, GNSS event, SIM event) response'tan ayrı tutulur. State machine: IDLE→COMMAND_SENT→WAIT_RESPONSE→INTERMEDIATE→FINAL_RESULT (alternatif: WAIT_PROMPT→DATA_MODE→FINAL_RESULT; URC her an gelebilir). Final Result Codes: OK, ERROR, CONNECT, NO CARRIER, BUSY, NO ANSWER, +CME ERROR, +CMS ERROR.

Cellular Initialization Dashboard: Model, Firmware, IMEI, SIM, IMSI, Operator, Registration, RAT, Band, Signal, IP (privacy-aware; export'ta IMEI/IMSI/ICCID/Phone masking). Boot analizi örneği: Power ON→RDY→SIM READY→AT handshake→Network search→Registered→PDP context, toplam **6.7s** (alt adımlar 1.2/0.8/4.7s).

## GNSS Modem

Dahili GNSS receiver tek standart binary protokol değildir: AT Commands + NMEA output + vendor-specific GNSS URC + vendor binary output karışımı. Mimari: Modem AT Parser (GNSS Control/Status/URC) + NMEA Stream→Common GNSS Model.

Control: GNSS Power On/Off, Get Position, Get Fix Status, Set Update Rate, Select Constellation, Assistance Data, NMEA Enable/Output Port (vendor: Quectel/u-blox/SIMCom/diğer + command definition revizyonu). NMEA: `$GNGGA`, `$GNRMC`, `$GNGSA` → 3.5'teki parser aynen kullanılır, yeniden yazılmaz.

Dashboard: GNSS ON, Fix (2D/3D), Latitude, Longitude, Altitude, Satellites, UTC, HDOP, Speed, Course, Last Fix.

TTFF:
```
TTFF = t_firstValidFix − t_GNSSStart
```
Örnek: GNSS Start 12:00:00, First Valid Fix 12:00:28.4 → **TTFF=28.4s**. Fix Loss: 3D→Satellites decline→No Fix→Position stale→`GNSS_FIX_LOST` (Last Valid, Age). GNSS+Cellular Correlation: Position+Cell ID+RSRP+RSRQ aynı timeline'da; harita/export dataset üretilebilir.

## Ortak Analyzer'lar

**Signal Quality ortak modeli:** tek "Signal Quality=75%" değerine zorlanmaz — ham metrik korunur: BLE (RSSI), Zigbee (RSSI+LQI), Thread (RSSI+Link Margin), LoRa (RSSI+SNR), Wi-Fi (RSSI+MCS+Retries), CRSF-benzeri RF (RSSI+LQ+SNR), Cellular (RSRP+RSRQ+SINR); istenirse ayrı "Normalized Quality" derived metric.

**RSSI Trend:** Mean, Minimum, Maximum, Standard Deviation, Fade Events.

**PRR:**
```
PRR = ReceivedPackets / ExpectedPackets
```
Örnek: 970/1000 → PRR=**97%**, Loss=3% (yalnız known sequence/period varsa hesaplanır).

**Latency:**
```
Latency = t_response − t_request
```
BLE (Read Request→Response), Matter (Invoke→Response), CoAP (CON→ACK), ESP-NOW (TX→Application ACK varsa).

**Airtime Analyzer:** Protocol/PHY/Data Rate/Packet Size/Header/Preamble/FEC/Retransmission → Air Time/Packets per s/Channel Occupancy/Duty Cycle. LoRa için protokole özel exact calculator; BLE/Wi-Fi/Zigbee için PHY-aware ayrı calculator.

**Battery/Energy Estimator:**
```
E_TX    = V × I_TX    × T_TX
E_RX    = V × I_RX    × T_RX
E_sleep = V × I_sleep × T_sleep
```
Örnek: V=3.3V, I_TX=40mA, T_TX=50ms → E = 3.3×0.04×0.05 = **0.0066 J**. Çıktı: TX/RX/Idle/Sleep Energy, Estimated Daily Consumption, Estimated Battery Life — sonuç **"Theoretical Estimate"** etiketlenmeli.

**Coexistence Analyzer:** 2.4 GHz'de Wi-Fi/BLE/Zigbee/Thread/ESP-NOW aynı spektrumu paylaşır; matris: Technology, Channel, Center Frequency, Bandwidth, Activity, RSSI (ör. "Wi-Fi Ch1 High Occupancy / Zigbee ChX Overlap: High"). Kesin RF interference sonucu yalnız protokol log'undan belirlenemez.

**Device Identity Correlation:** aynı fiziksel cihaz farklı identifier'lara sahip olabilir (BLE MAC, Wi-Fi MAC, Thread Node ID, Matter Node ID, MQTT Client ID, Serial Number) → project mapping; confidence: CONFIRMED / PROBABLE / USER_DEFINED.

**Commissioning Timeline:** Device Powered→Discovery→Pair/Join→Authentication→Network Configuration→Application Configuration→Operational. Protokole özel: BLE (Advertising→Connect→Pair→GATT), Zigbee (Discovery→Join→Security→ZCL), Thread (Attach→Parent→IPv6), Matter (Discovery→Commission→Fabric), LoRaWAN (Join Request→Accept), Wi-Fi (Scan→Auth→Assoc→IP), Cellular (SIM→Register→PDN). Multi-Protocol Device Timeline bunları tek "DEVICE STARTUP SESSION"da gruplar.

**Gateway Analyzer:** BLE/Zigbee/Thread/LoRaWAN/Wireless M-Bus→Gateway→Ethernet/Wi-Fi/Cellular→MQTT/HTTP/Cloud; protokol dönüşümü correlate edilir (ör. Zigbee 23.4°C→MQTT `building/room1/temp`, latency 47ms). Mapping Error örneği: WMBus Energy=1254.3kWh iken MQTT'de 12543 yayınlanmışsa "POSSIBLE SCALE ERROR" uyarısı.

**IoT Payload Decoder:** tipler uint8..float64, boolean, BCD, ASCII, UTF-8, JSON, CBOR, TLV, bit field, custom struct; şema: offset, bit offset, length, type, endian, factor, offset, unit, enum, validity. Örnek raw `01 09 24 13 88 64` → Byte0 Device State=ON, Byte1-2 Temperature (uint16 BE ×0.01)=23.40°C, Byte3-4 Pressure (uint16 BE ×0.1)=500.0, Byte5 Battery=100%. JSON/CBOR: Raw→Tree→Schema Names→Engineering Values.

## Ortak Kablosuz Hata Modeli

Ortak taksonomi (her hata: Timestamp, Protocol, Device, Channel, Frame, State, Expected, Received, Severity, Possible Cause ile raporlanır):

- Genel: `BAD_CRC`, `BAD_MIC`, `AUTH_FAILED`, `DECRYPTION_FAILED`, `UNKNOWN_DEVICE/PROFILE/SERVICE/CHARACTERISTIC`, `STALE_SENSOR_DATA`, `EXCESSIVE_JITTER`, `SIGNAL_QUALITY_LOW`
- BLE: `BLE_ADV_MALFORMED`, `BLE_GATT_TIMEOUT`, `BLE_INDICATION_TIMEOUT`
- Zigbee: `ZIGBEE_JOIN_FAILED`, `ZIGBEE_PARENT_LOST`, `ZIGBEE_COUNTER_ERROR`
- Thread: `THREAD_ATTACH_FAILED`, `THREAD_PARENT_LOST`, `THREAD_FRAGMENT_MISSING`
- Matter: `MATTER_COMMISSIONING_FAILED`, `MATTER_ACCESS_DENIED`, `MATTER_SESSION_LOST`
- LoRa/LoRaWAN: `LORA_CRC_ERROR`, `LORA_LINK_MARGIN_LOW`, `LORAWAN_MIC_ERROR`, `LORAWAN_COUNTER_GAP`, `LORAWAN_JOIN_FAILED`, `LORAWAN_RX_WINDOW_MISS`
- Wi-Fi/ESP-NOW: `WIFI_ASSOC_FAILED`, `WIFI_DEAUTH`, `WIFI_RETRY_HIGH`, `ESPNOW_CRC_ERROR`, `ESPNOW_PEER_LOST`
- Diğer: `CUSTOM_RF_SYNC_LOST`, `WMBUS_DECRYPTION_FAILED`, `MQTT_DISCONNECTED`, `MQTT_KEEPALIVE_TIMEOUT`, `COAP_TIMEOUT`, `NB_IOT_REGISTRATION_LOST`, `MODEM_NO_SIM`, `MODEM_NETWORK_DENIED`, `MODEM_SOCKET_CLOSED`, `GNSS_FIX_LOST`

## Kablosuz Layer Drill-Down

Uygulama değeri ↔ RF katman zinciri:
- **BLE:** Temperature 23.4°C ↔ Characteristic ↔ ATT Notification ↔ L2CAP ↔ BLE Link Layer ↔ RF
- **Zigbee:** Light ON ↔ On/Off Cluster ↔ ZCL Command ↔ APS ↔ NWK ↔ 802.15.4
- **Thread+Matter:** Room Temperature ↔ Matter Attribute ↔ Matter Report ↔ UDP ↔ IPv6 ↔ 6LoWPAN ↔ Thread ↔ 802.15.4
- **LoRaWAN:** Humidity 42% ↔ Application Payload ↔ FRMPayload ↔ LoRaWAN MAC ↔ LoRa PHY
- **ESP-NOW:** Button Pressed ↔ Custom Body ↔ ESP-NOW Element ↔ Vendor Action Frame ↔ 802.11
- **Wireless M-Bus:** Energy 1254 kWh ↔ Meter Record ↔ OMS/EN13757 Application ↔ W-MBus Telegram ↔ RF
- **NB-IoT:** Sensor Data ↔ MQTT/UDP/vb. ↔ Modem Socket ↔ Cellular Packet Session ↔ NB-IoT Registration

**Amaç:** dağınık BLE scanner / LoRa calculator / MQTT viewer araçları toplamı değil; RF packet'tan IoT application value'ya uçtan uca izlenebilen tek bir bütünleşik **Wireless & IoT Communication Analyzer**.

## Dikkat çekenler

- Versiyon çapaları net tarihlerle veriliyor: Zigbee 4.0 (CSA, 2025 sonu), Thread 1.4.1, Matter 1.6 (Haziran 2026, NFC commissioning eklendi), LoRaWAN 1.1/1.0.4, IEEE 802.11-2024, ESP-NOW v1.0/v2.0, OMS Generation 5 (2023-12 rev.1), 3GPP TS 27.007 (2026 aktif) — parser'ların revizyon bilgisi saklaması gerektiği tekrarlanan bir vurgu.
- Tüm "tahmini" hesaplamalar (mesafe, link margin, battery life, coexistence) kaynakta ısrarla "theoretical/estimate, kesin değil" etiketiyle sınırlandırılıyor — toolkit'in genel felsefesi.
- Kimlik/adres kararlılığı tekrarlayan tema: BLE private address rotation, Zigbee NWK/IEEE, LoRaWAN DevAddr/DevEUI, Thread RLOC/identity ayrımı — hepsinde "adres değişti diye otomatik yeni cihaz deme" uyarısı ortak.
- Key/şifre yoksa payload'un "encrypted/raw" bırakılıp asla uydurulmaması BLE, Zigbee, Matter, LoRaWAN, ESP-NOW, Wireless M-Bus genelinde tutarlı güvenlik kuralı.
- LoRa↔LoRaWAN ve Thread↔Matter ayrımı özellikle vurgulanıyor: biri PHY/network katmanı, diğeri üstünde çalışan ayrı protokol — iki ayrı modül tasarımının gerekçesi.
- Mevcut motorların (3.5 NMEA parser, 3.8 MQTT/CoAP engine) yeniden yazılmaması, IoT modüllerinin bunları yeniden kullanması gerektiği açık talimat — modülerlik ilkesi.
- Tüm formüller (T_sym, R_s, R_b, ToA, link budget, duty cycle, PRR, latency, TTFF, E_TX/E_RX/E_sleep) sayısal örnekleriyle birebir korunmuştur.
- Kapanış sentezi: 3.9'un amacı dağınık araçlar değil, RF'ten IoT application value'ya uçtan uca izlenebilen tek bir Wireless & IoT Communication Analyzer.
