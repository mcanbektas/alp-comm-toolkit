# 3.7 Bina Otomasyonu

Kapsam: BACnet MS/TP, BACnet Object Model/Services, BACnet COV, BACnet/IP, KNX, DALI/DALI-2, M-Bus, Modbus RTU/TCP (bina katmanı), LonWorks, DMX512, Art-Net, sACN, protokoller-arası gateway analyzer'lar ve ortak building-layer araçları (Point Database, Freshness, Traffic Matrix, Equipment Dashboard, Alarm/Lighting Correlation, ortak hata modeli, drill-down).

---

## BACnet MS/TP

BACnet MS/TP: BACnet application/network katmanlarının RS-485 üzerinde **Master-Slave/Token-Passing** data-link ile taşındığı bina otomasyon ağı türü (BACnet International tanımı). Token yalnız master-capable node'lar arasında dolaşır; subordinate cihazlar yalnız gelen isteklere cevap verir.

Katman ayrımı (karıştırılmamalı): BACnet Objects/Services → BACnet NPDU/APDU → BACnet MS/TP → RS-485 (yalnız elektriksel fiziksel katman).

Tipik ağ: BMS Controller — RS-485 — VAV1(MAC10), VAV2(MAC11), VFD(MAC20).

### Frame yapısı
Alan sırası: **Preamble → Frame Type → Destination → Source → Length → Header CRC → Data → Data CRC**.

Raw: `55 FF | TT | DD | SS | LL LL | HC | DATA... | CRC CRC`

UI karşılığı: Preamble Valid, Frame Type "Data Expecting Reply", Destination MAC 10, Source MAC 1, Data Length ..., Header CRC PASS, Data CRC PASS. Exact sabitler ve CRC algoritması seçilen BACnet protocol revision database'ından gelmelidir.

### Token dolaşımı
Timeline: MAC1 →TOKEN→ MAC5 →TOKEN→ MAC10 →TOKEN→ MAC20.

İzlenecek değerler: Token Holder, Token Rotation Time, Token Pass Count, Token Retry, Token Lost, Duplicate Token Suspected.

**Token Rotation Time**: `T_rotation = t_token(n) − t_token(n−1)`
Örnek: MAC10 token 12:00:00.100, sonraki token 12:00:00.147 → `T_rotation = 47 ms`.
Toolkit: Mean Rotation 46.8 ms, Maximum 61.2 ms, Jitter ...

### MAC Address ≠ Device Instance
Kritik entegrasyon ayrımı: MS/TP MAC Address, BACnet Device Instance ile aynı şey değildir. Ayrı kolonlarda gösterilmeli:

| MAC | Device Instance | Name |
|---|---|---|
| 10 | 420010 | VAV-101 |
| 11 | 420011 | VAV-102 |
| 20 | 500020 | AHU-1 VFD |

---

## BACnet Object Model

BACnet'in özü raw register değil **object/property modeli**: her object type+instance identifier taşır, properties üzerinden izlenir/kontrol edilir (BACnet International). Her object'te en az `Object_Identifier`, `Object_Name`, `Object_Type` bulunur.

Örnek — Analog Input 1: Object Identifier, Object Name, Present Value, Units, Status Flags, Event State, Out Of Service, Reliability.

**Desteklenmesi gereken object türleri**: Analog/Binary/Multi-State Input, Output, Value; Device; Schedule; Calendar; Trend Log; Notification Class; Loop; Accumulator; Lighting Output.

**Point görünümü örneği**: AI:12 "Room101_Temperature", Present_Value 23.42, Units °C, Status Normal, Out_Of_Service False → UI: "Room 101 Temperature — 23.42 °C — GOOD". Raw property bilgisi kaybolmamalıdır.

---

## BACnet Services

Service: bir cihazın diğerinin object/property bilgisine erişme veya operasyon yaptırma yöntemi — standardized communication mechanism (BACnet International).

Desteklenecek minimum servis seti: `Who-Is`, `I-Am`, `Who-Has`, `I-Have`, `ReadProperty`, `ReadPropertyMultiple`, `WriteProperty`, `WritePropertyMultiple`, `SubscribeCOV`, `ConfirmedCOVNotification`, `UnconfirmedCOVNotification`, `AcknowledgeAlarm`, `GetEventInformation`, `DeviceCommunicationControl`, `ReinitializeDevice`.

### Who-Is / I-Am
Discovery: BMS →Who-Is (broadcast)→ ağ; yanıtlar ←I-Am Device100, ←I-Am Device200, ←I-Am Device300. Toolkit: Discovery Request/Response sayısı + device listesi.

### ReadProperty
Request: ReadProperty(Object=AI 12, Property=Present_Value) → Response 23.42. Transaction görünümü: Client BMS, Server VAV-101, Service ReadProperty, Object AI:12, Property Present_Value, Value 23.42 °C, Response Time 18.4 ms.

### WriteProperty ve Priority Array
Commandable object'lerde salt "değer yaz" mantığı yoktur — **priority mekanizması** vardır. Priority Array: 1 Emergency … 8 Manual Operator … 16 Default/Application. Örnek: WriteProperty Value=100%, Priority=8 → "Manual override active" semantik uyarısı üretilebilir.

---

## BACnet COV (Change of Value)

Sürekli polling yerine belirli değer değişiminde subscriber'a bildirim: BMS →SubscribeCOV→ VAV; sıcaklık değişince VAV →COV Notification→ BMS. İzlenecek alanlar: Subscription, Object, Lifetime, Confirmed/Unconfirmed, Last Notification, Change Amount.

Polling (5 s periyodik okuma) vs COV (yalnız ilgili değişimde mesaj) — trafik karşılaştırma ekranı yapılabilir.

---

## BACnet MS/TP Error Analyzer

Ayrılacak durumlar: `CRC Error`, `No Token`, `Token Rotation Too Long`, `Duplicate MAC`, `Device Offline`, `Unexpected Source`, `Reply Timeout`, `BACnet Reject`, `BACnet Abort`, `BACnet Error`, `Invalid APDU`, `Unknown Object`, `Unknown Property`, `Write Access Denied`.

**Duplicate MAC**: aynı MAC'ten iki farklı source fingerprint görülürse → **"POSSIBLE DUPLICATE MS/TP MAC"** uyarısı üretilmelidir.

---

## BACnet/IP

Aynı object/service modelini IP üzerinde taşır. BACnet International: UDP/IP üzerinde **BACnet Virtual Link Layer (BVLL)** kullanılır; IP address + UDP port kombinasyonu pseudo-MAC işlevi görür.

Katman: BACnet Objects → BACnet Services → APDU → NPDU → BVLL → UDP → IP → Ethernet — her katman ayrı açılabilmelidir.

### Discovery ve BBMD
Local subnet: Who-Is → Broadcast → I-Am responses. Farklı subnet'lerde broadcast routing sorunu için: **BBMD** (broadcast mesajlarını local segment dışına dağıtır — BACnet International), **Foreign Device Registration**, **Broadcast Distribution Table (BDT)**. Toolkit: BBMD Detected, IP, BDT Entries, Foreign Devices, TTL, Registration.

### Device tree örneği
Device 1001 (192.168.1.20): AI1 Supply Air Temp, AI2 Return Air Temp, AO1 Damper, BV1 Occupied. Device 1002 (192.168.1.21): ...

### IP ≠ Device Identity
BACnet device Device Instance (örn. 12345) ile tanımlanır; IP değişse de aynı logical device'tır. Örnek: Old IP 192.168.1.20 → New IP 192.168.10.20, Device Instance 12345 sabit → Identity: Same device olarak correlate edilmelidir.

---

## BACnet Trend ve Alarm Görünümü

Present value'nun ötesinde ayrı dashboard: Trend Log, Alarm, Event, Notification, Schedule, Calendar.

Örnek: AHU Supply Air Temperature 12:00 16.2 °C, 12:05 16.4 °C, 12:10 19.8 °C → Alarm HIGH TEMPERATURE, Transition Normal→Offnormal, Acknowledged No.

---

## KNX

Bina/konut otomasyonunda distributed control için standardize ekosistem. Önemli olan yalnız fiziksel telegram değil: Individual Address, Group Address, Group Object, Datapoint Type, Application Program birlikteliğidir.

Group Address 16 bit genişliğindedir; `0` değeri system broadcast için ayrılmıştır. ETS group-address modelinde main/middle/sub group yapıları kullanılabilir.

### KNX adresleri
İki farklı adres kesinlikle ayrılmalıdır:
- **Individual Address** — topoloji/cihaz kimliği. Örnek `1.1.15` → Area.Line.Device.
- **Group Address** — fonksiyonu temsil eder. Örnek `1/2/5` → Main=Lighting, Middle=Floor2, Sub=Meeting Room. Toolkit: Group 1/2/5, Name "Meeting Room Light", DPT Switch, Current ON.

### KNX Group Objects
Cihaz application'ları group object içerir. Örnek wall switch: GO1 Switch(1 bit), GO2 Dimming(4 bit). Actuator: GO1 Switch(1 bit), GO2 Status(1 bit). ETS'te group address'ler group object'lerle ilişkilendirilir; **group object flags** cihazın read/write/transmit/update davranışını tanımlar: **C**ommunication, **R**ead, **W**rite, **T**ransmit, **U**pdate, **I**nitialization.

### KNX Datapoint Types — DPT
Raw telegram anlamının doğru çözülmesi için kritiktir. KNX Association: DPT bilgisi Group Address/Group Object configuration'ına bağlanabilir; bus/group monitor telegram değerini bunun üzerinden decode eder.

Örnekler: 1-bit Switch/Boolean, 2-byte float Temperature, 8-bit percentage, Time, Date, RGB/Colour, Scene.
Decode örneği: Raw `0C 29` + DPT Temperature → Decoded 23.45 °C.

**DPT bilinmiyorsa toolkit tahmin ederek kesin değer üretmemelidir.** Örnek: Payload `00 64` (2 byte), DPT Unknown → çıktı: "Raw uint16: 100 — Cannot determine engineering meaning without DPT." KNX Association da project context/DPT yoksa kesin semantic decoding'in her durumda mümkün olmadığını belirtir.

### KNX telegram görünümü
Alanlar: Source Address, Destination Address, Destination Type, Priority, APCI Service, Payload, Checksum. Application service özellikle vurgulanmalı: `GroupValueRead`, `GroupValueResponse`, `GroupValueWrite`.

Örnek: Source 1.1.10, Destination 2/1/5, Service GroupValueWrite, DPT Switch, Value 1 → Semantic: Light ON.

### KNX Group Monitor
ETS Group Monitor mantığına yakın alanlar: Timestamp, Source, Destination, Service, DPT, Raw, Decoded. (ETS Group Monitor seçilen DPT'ye göre değeri decode edebilir, read/write operasyonu gönderebilir.)

### KNX project import
ETS'ten Group Address XML/CSV export desteklenmelidir (KNX Association resmi ETS dokümantasyonu). Import alanları: Group Address, Name, Description, DPT, Associated Objects. Örnek: `2/1/5` yerine `MeetingRoom_Lighting_Command` gösterilebilir.

---

## DALI / DALI-2

İki telli digital lighting control bus'ı (DALI Alliance): control/configuration/query işlemleri sağlar; aynı iki tel üzerinde bus power + data taşıyabilir; bidirectional communication sunar; individual/group/broadcast addressing sağlar; scene recall destekler.

DALI-2 bir subnette **64 control gear + 64 control device** adres alanını destekler; control gear ayrıca **16 group + 16 scene** destekler.

### Network Explorer
DALI Line1 → Control Gear: Address0 LED Driver, Address1 LED Driver, Address2 Emergency Driver, Address3 DT8 Driver. Control Devices: Occupancy Sensor, Light Sensor, Push Button. İzlenecek alanlar: Short Address, Device Type, Groups, Scenes, Current Level, Status, Lamp Failure, Communication Status.

### Addressing
Individual / Group / Broadcast sınıflandırması. Örnek: Target Group5, Command OFF; veya Target ShortAddress12, Command Recall Scene 3.

### Commands
DALI Alliance kategorileri: Control, Configuration, Query.
- **CONTROL**: OFF, Go To Scene, Direct Arc Power
- **CONFIGURATION**: Set Fade Time, Store Scene
- **QUERY**: Query Actual Level, Query Lamp Failure

Query/Response örneği: Target Driver12, Query Actual Level → Response 178 → Normalized 69.8%.

### Dimming view
Her cihaz: Actual Level, Target Level, Fade Time, Fade Rate, Scene, Colour Temperature, Colour (destekleniyorsa). Örnek: Driver5 Level60%, Target100%, Fade2.0s.

Scene comparison: Scene1 "Office Work" (D1→80%, D2→80%, D3→60%) vs Scene2 "Presentation" (D1→20%, D2→20%, D3→5%).

### Device Type (DT)
DT6 = LED control gear, DT8 = Colour control. Sertifika/device database mevcutsa semantik gösterim yapılabilir. DALI Alliance sertifikalı güncel gateway ürünleri DT6/DT8 ile RGB/RGBW, xy colour, tunable-white destekler.

### Fault Monitor
`Lamp Failure`, `Control Gear Failure`, `Missing Device`, `Short Address Conflict`, `Bus Communication Fault`, `Query Timeout`, `Input Device Lost`. Örnek: Address18, State ONLINE, Lamp Failure YES.

---

## M-Bus (Meter-Bus)

Heat/Water/Gas/Energy meter verisinin BMS'e alınmasında önemlidir. **EN 13757** standard ailesinin parçasıdır (M-Bus Usergroup: güncel bağlayıcı referans EN 13757). Wired M-Bus: **EN 13757-2** (physical/link layer), **EN 13757-3** (application layer). Eski M-Bus Usergroup web dokümantasyonu yalnız bilgilendirme amaçlıdır, bağlayıcı standart yerine kullanılmamalıdır.

### Mimari
BMS/Meter Gateway → M-Bus Master → iki-telli bus → Heat Meter, Water Meter (master/slave hiyerarşisi, parallel meter network yapısı).

### Frame yapısı
Frame sınıfları: `Single Character`, `Short Frame`, `Control Frame`, `Long Frame`.

Long frame alanları: **Start → Length → Length → Start → Control → Address → CI → Application Data → Checksum → Stop**. Exact alan sabitleri güncel EN 13757 database'ine bağlı olmalıdır.

Semantic tree: Control, Address, CI, Data Records, Checksum.

### Meter records
Application payload data-record yapısı: `DIF, DIFE, VIF, VIFE, DATA` → engineering value'ya dönüştürülür (CI field application-data sequence/type bilgisini taşır). Örnek çıktı: Energy 12543.2 kWh, Volume 354.27 m³, Power 12.4 kW, Flow 1.5 m³/h, Supply Temperature 70.3 °C, Return Temperature 52.7 °C.

### Addressing
Primary Address / Secondary Address ayrımı. Secondary addressing: Identification + Manufacturer + Version + Medium üzerinden seçim yapılır (secondary-address selection primary addressing'i genişletir). Meter browser örneği: Primary1/Heat, Primary2/Water, Primary3/Electricity.

---

## Modbus RTU — Bina Otomasyon Katmanı

3.3'teki ortak Modbus RTU parser kullanılmalıdır (Modbus Organization: yeni serial implementasyonlar için Serial Line Protocol and Implementation Guide V1.02, function code'lar için V1.1b3). Protokol yeniden yazılmaz; **building-specific semantic layer** eklenir.

Örnek: VFD Slave10, Holding Register 40001, Raw `0x05DC` → vendor map: Name "Motor Speed", Scale 1 rpm → Value 1500 rpm.

### Register Map
CSV/JSON import alanları: Address, Name, Register Type, Data Type, Length, Byte Order, Word Order, Factor, Offset, Unit, Access, Enum, Bit Definitions. Örnek: 40001 "Supply Air Temperature" int16, Factor 0.1, Unit °C, Raw `00 EA` = 234 decimal → 23.4 °C.

### HVAC Dashboard
AHU-1: Supply Air 16.2 °C, Return Air 24.3 °C, Fan RUNNING, Fan Speed 62%, Filter Alarm NORMAL, Damper 37%, Cooling Valve 52%. Tüm değerler register map üzerinden üretilmelidir.

### Poll Optimization
Poll Group1: Registers 40001–40010, Period 1 s. Poll Group2: Registers 40100–40150, Period 10 s. Transaction efficiency: ardışık register'ları tek tek okumak (Method A: 10 request) yerine block read (Method B: 1 block request) → Bus Traffic Reduction analiz edilebilir.

---

## Modbus TCP — Bina Otomasyon Katmanı

Yine 3.3'teki ortak parser kullanılır. Katman: Building Device → Modbus PDU → MBAP → TCP → IP → Ethernet.

Device browser örneği: 192.168.10.10 Chiller, 192.168.10.11 Boiler, 192.168.10.12 Power Meter — her biri için Connection State, Unit ID, Response Time, Function Codes, Errors, Register Map gösterilmelidir. (Modbus Organization, TCP için ayrı messaging implementation guide + conformance/diagnostic tools sürdürür.)

### Connection analyzer
Akış: TCP Connect → Read Holding → Response → Read Input → Response → Idle. Ölçümler: TCP RTT, Modbus Response, Request Rate, Timeout, Reconnect, Transaction ID Errors.

**Transaction ID**: eşzamanlı istekler (TID100→Temperature, TID101→Pressure, TID102→Status) — response matching transaction identifier ile yapılmalıdır.

---

## LonWorks / LON

Uzun süredir kullanılan distributed control networking teknolojisi. LonMark: LON protocol stack **ISO/IEC 14908** serisi altında standardize — 14908-1 (protocol stack), 14908-2 (twisted pair), 14908-3 (powerline), 14908-4 (IP tunnelling).

İlk toolkit sürümünde full LonWorks stack implementasyonu zorunlu değildir; temel görünüm yeterlidir: Message, Source, Destination, Network Variable, Service, Payload, Timing.

### LON Network Variables
Semantic model: Device → Network Variable Input, Network Variable Output, Configuration Property. LonMark technical resources: functional profiles, NV types, configuration-property types için standardize resource file sağlar.

**SNVT** (Standard Network Variable Types) biliniyorsa semantik decode yapılabilir: `SNVT_temp`, `SNVT_switch`, `SNVT_hvac_mode`... Exact güncel tanımlar LonMark resource file'dan yüklenmelidir.

### XIF Import
LonMark `.XIF` file specification/guide yayımlar. Akış: Import XIF → Device Interface → Network Variables → Configuration Properties. Örnek: "Fan Coil Controller" — NV Inputs: Setpoint, Occupancy; NV Outputs: Temperature, Fan State, Alarm.

### LonWorks Gateway Analyzer
Örnek: BACnet → Gateway → LonWorks → Air Conditioner. LonMark product database'deki gateway örnekleri HVAC unit state, fan speed, setpoint, fault bilgisini LonTalk tarafında BMS'e taşıyabilir. Toolkit: BACnet Object ↔ LON Network Variable mapping gösterebilmelidir.

---

## DMX512

Bina otomasyonunun klasik HVAC tarafı değil; **architectural/façade lighting, auditorium, theatre, event hall, decorative lighting** entegrasyonu açısından değerlidir. Güncel DMX512-A standard ailesi **ANSI E1.11** altında ESTA tarafından sürdürülür (ESTA güncel yayın kataloğu: Nisan 2024 tarihli editorial revision).

Akış: Controller → DMX Universe → Fixture1, Fixture2, Fixture3... (mostly controller-to-device stream).

### DMX Universe
Universe = Start Code + en çok **512 data slot**. ESTA E1.11: 512 slotluk tam packet'te maksimum update rate ≈ **44 Hz**; slot sayısı azaldıkça frame daha hızlı tekrarlayabilir. Örnek: Universe1, Slots512, Refresh 44 Hz.

### DMX signal/frame
Timeline: **BREAK → Mark After Break (MAB) → START CODE → Slot1...SlotN → sıradaki BREAK**. Ölçülecek: Break Duration, MAB Duration, Start Code, Slot Count, Frame Duration, Refresh Rate.

**Slot**: her biri 8-bit değer (0–255). RGB fixture örneği: Address1 — Slot1 Red=255, Slot2 Green=128, Slot3 Blue=0, Slot4 Dimmer=200 → UI RGB 255/128/0.

### Fixture Personality
Profil tanımı örneği: "RGBW Wash", Start Address101, Footprint 8 channel — 101 Dimmer, 102 Red, 103 Green, 104 Blue, 105 White, 106 Strobe, 107 Macro, 108 Speed. Ham slot `C8 FF 40 00...` yerine semantik değerler gösterilebilir.

### DMX 16-bit parametre
Bazı fixture parametreleri iki slot (Coarse+Fine) kullanır:

`Value16 = Coarse × 256 + Fine`

Örnek: Coarse128, Fine64 → Value = 32832. Normalize: `Percent = (32832 / 65535) × 100` ≈ **%50.1**. Özellikle pan/tilt gibi kanallar için desteklenmelidir.

### Start Code
Standart lighting data genellikle standard start code (`0x00` = DMX Level Data) kullanır; Alternate Start Code'lar da ANSI E1.11 ekosisteminde kayıtlıdır (ESTA public Alternate Start Code database).

---

## Art-Net

**Art-Net 4**: DMX512/RDM benzeri lighting data'yı Ethernet üzerinden taşıyan royalty-free, UDP tabanlı protokol; çok sayıda DMX universe taşımayı hedefler (Art-Net resmi site, current specification).

Katman: Lighting Application → Art-Net → UDP → IP → Ethernet.

### Art-Net packet
Ortak header: ID, OpCode, Protocol Version, packet-specific fields, Payload. Exact alan offsetleri güncel Art-Net 4 spesifikasyonundan uygulanmalıdır.

**OpCode**'lar semantik isimle gösterilmelidir: `ArtPoll`, `ArtPollReply`, `ArtDmx`, `ArtSync`, `ArtTimeCode`, ...

### ArtPoll / ArtPollReply
Discovery: Controller → ArtPoll → Network Nodes → ArtPollReply. Node explorer alanları: Node, IP, Short Name, Long Name, Ports, Universes, Status, Firmware, OEM.

### ArtDmx
DMX universe data alanları: Sequence, Physical, Port-Address/Universe, Length, DMX Data (exact layout Art-Net 4 resmi spec'inden). Örnek: Universe10, Sequence52, Slots512, Source192.168.1.20, Rate40Hz.

### Art-Net Universe View
Örnek: Universe1→House Lighting, Universe2→Lobby, Universe3→Façade, Universe10→Stage. Her universe: Source, Sequence, Slot Count, FPS, Last Packet.

### Art-Net sequence analysis
Örnek: sequence 20,21,22,24 görülürse → Expected23, "Possible Lost Packet: 1" uyarısı. Not: protokol konfigürasyonunda sequence kullanımı disabled/optional olabilir, bu ihtimal ayrıca hesaba katılmalıdır.

### ArtSync
Birden fazla universe aynı lighting frame'e aitse senkron output: Universe1/2/3 → ArtSync. Timeline: Universe packets received → Waiting for sync → ArtSync → Output cycle complete.

### Art-Net / DMX Gateway
Ethernet Art-Net → Node → Physical DMX Port1, Port2. Mapping: Art-Net Universe ↔ Gateway Port ↔ DMX Universe. Art-Net 4 özellikle çok-portlu gateway'ler ve independent universe assignment geliştirmiştir.

---

## sACN — Streaming ACN / ANSI E1.31

DMX512-A verisinin IP üzerinden streaming taşınması için **ANSI E1.31** standardında tanımlanır. **Güncel yayımlanmış standart ANSI E1.31-2025'tir, 5 Ocak 2026'da yayımlanmıştır**; bu revizyon IPv4 yanında **IPv6** desteği eklemiştir.

Akış: DMX Data → E1.31 → UDP/IP → Ethernet.

### sACN packet structure
Katmanlar: **Root Layer → Framing Layer → DMP Layer → DMX Slot Data**.

Field tree:
- Root: CID, Protocol Identifier
- Framing: Source Name, Priority, Sequence, Universe, Options
- DMP: DMX Values

Exact byte layout ANSI E1.31-2025 spesifikasyonundan uygulanmalıdır.

### CID
Her sACN source **Component Identifier (CID)** ile tanımlanır — toolkit yalnız IP üzerinden source identity belirlememelidir. Örnek: Source Name "Lighting Console 1", CID ..., IP 192.168.1.50 — IP değişse bile CID aynı source'u belirler.

### sACN Universe / Priority
Universe monitor örneği: Universe1/SourceA/Priority100; Universe2/SourceA/Priority100; Universe10/SourceB/Priority120.

**Priority**: sACN'i Art-Net/klasik DMX'ten ayıran önemli özelliklerden biri source priority mekanizmasıdır. Örnek: Universe1, SourceA Priority100 vs SourceB Priority120 → Selected SourceB. Priority değişimi (Source B kaybolursa Source A aktif olur) timeline'a işlenmelidir.

### sACN Sequence
Örnek: 250,251,252,254 görüldüğünde Missing:253 tespiti. Wrap: 254,255,0,1 geçerli sayılmalıdır. Packet-loss istatistiği **source + universe** bazında tutulmalıdır.

### sACN Source Merge
Aynı universe için birden fazla source varsa (örn. ConsoleA Priority100, ConsoleB Priority100) merge davranışı configuration/profile'a bağlı olabilir → "Multiple Active Sources" uyarısı gösterilmeli, observed merge/result ayrı analiz edilmelidir.

### sACN Universe Synchronization
E1.31 universe sync: birden fazla universe'a ait data'nın aynı output timing noktasında uygulanmasını sağlar (ESTA: multi-universe display'lerde tearing/senkronizasyon sorunlarını önler). Timeline: Universe1/2/3 Data → Synchronization Packet → Output.

---

## Art-Net / sACN Karşılaştırması

Aynı amacın bir kısmını paylaşsalar da aynı protokol değildir. Art-Net resmi dokümantasyonu: Art-Net 4 discovery/management/RDM işlevleri sağlar; canlı data için sACN ile birlikte kullanılabilecek şekilde tasarlanmıştır.

| | Art-Net | sACN |
|---|---|---|
| Transport | UDP | UDP |
| DMX Streaming | Yes | Yes |
| Discovery | ArtPoll | Farklı model |
| Management | Zengin | Sınırlı odak |
| RDM desteği | Art-Net tools | E1.31'in temel amacı değil |
| Priority | Farklı | Native source priority |
| Universe Sync | ArtSync | E1.31 Sync |

---

## Gateway Analyzer'lar

### KNX ↔ DALI
KNX → KNX-DALI Gateway → DALI → LED Drivers. DALI Alliance sertifikalı KNX–DALI-2 gateway'ler günümüzde yaygındır; 64 gear/16 group gibi mapping kullanılır. Örnek: KNX GA 2/1/10, Command 50% → Gateway → DALI Group4, Level 50% correlate edilmelidir. Gateway latency örneği: KNX telegram t=0, DALI command t=18 ms → Gateway Latency 18 ms.

### BACnet ↔ Modbus
Modbus Register → Gateway → BACnet Object. Örnek: Modbus Register40001, Raw234, Scale0.1 → 23.4 °C ↔ BACnet AI-12 Present_Value 23.4 °C → Value Match PASS, Latency 54 ms. Fault örneği: Modbus TIMEOUT → BACnet tarafında Reliability "Communication Failure", Status Flags "Fault" mapping'i varsa correlate edilir.

### BACnet ↔ KNX
KNX Group Object → Gateway → BACnet Object. Örnek: KNX RoomTemp (DPT temperature) 23.2 °C = BACnet AI 23.2 °C. Common error: KNX DPT °C değerini gateway configuration raw olarak yanlış yorumlarsa BACnet sonucu 234.0 °C çıkar → **"POSSIBLE SCALING / DPT MAPPING ERROR"** üretilmelidir.

---

## Bina Otomasyonu Point Database

Tüm protokoller ortak point modeline çevrilebilmelidir:

`Point { Name, System, Equipment, Protocol, Address, Raw Value, Engineering Value, Unit, Quality, Timestamp, Writable, Priority, Alarm }`

Örnekler: AHU01_SupplyTemp (Protocol BACnet, Address AI:12, Value 16.4 °C, Quality GOOD); Room101_Light (Protocol KNX, Address 2/1/5, Value ON).

## Point Freshness Analyzer

Her point için: Last Update, Expected Update, Age, Freshness.

`Age = t_now − t_lastUpdate`

Örnekler: Room Temperature Age1.2s → Fresh; AHU Fan Status Age35s → STALE; Power Meter Never received → MISSING.

## Polling / Event / COV Ayrımı

Building protokolleri farklı update modeli kullanır: Modbus=Polling, KNX=Event/Group Telegram, BACnet=COV/Event, DMX/sACN/Art-Net=Cyclic Stream. Toolkit kullanıcıya data-source davranışını göstermelidir. Örnek: Temperature(Protocol Modbus, Update Polling, Poll 5s) vs Temperature(Protocol BACnet, Update COV).

## Building Network Traffic Matrix

| Protokol | Messages/s | Data Rate | Errors |
|---|---|---|---|
| BACnet/IP | 120 | ... | 0 |
| BACnet MS/TP | 45 | ... | 2 |
| KNX | 18 | ... | 0 |
| Modbus RTU | 32 | ... | 1 |
| sACN | 1760 | ... | 0 |

Yüksek lighting trafiği ile HVAC trafiği ayrı görülebilmelidir.

## Equipment Dashboard

Örnek AHU-01 (BACnet Device 1001): Supply Temp16.4 °C, Return Temp24.8 °C, Fan RUNNING Speed62%, Filter NORMAL, Damper35%, Cooling Valve48%, Heating Valve0%, Alarm NONE.

Farklı noktalar farklı protokollerden gelebilir (Temperature=BACnet, VFD=Modbus, Energy=M-Bus) ama kullanıcı equipment dashboard'da bunu tek sistem olarak görmelidir.

## Alarm Correlation

Örnek timeline: 12:30:10 Modbus VFD cevap vermiyor → 12:30:11 BACnet AHU Fan Status→Fault → 12:30:12 BMS alarm "Supply Fan Failure" → 12:30:13 oda sıcaklığı yükselmeye başlıyor. Toolkit: Possible Root Cause "VFD communication/device failure"; Consequences: Fan fault, AHU alarm, Temperature deviation.

## Lighting Network Correlation

Zincir örnekleri:
- KNX Wall Switch → KNX Telegram → DALI Gateway → DALI Group Command → Driver output changes
- BMS → BACnet Lighting Object → Lighting Gateway → sACN → Architectural Fixture

Aynı timeline üzerinde incelenebilmelidir.

## Ortak Bina Otomasyonu Hata Modeli

`DEVICE_OFFLINE`, `ADDRESS_CONFLICT`, `DUPLICATE_MAC`, `TOKEN_LOST`, `TOKEN_ROTATION_HIGH`, `CRC_ERROR`, `CHECKSUM_ERROR`, `TIMEOUT`, `RETRY`, `OBJECT_NOT_FOUND`, `PROPERTY_NOT_FOUND`, `WRITE_DENIED`, `INVALID_DPT`, `DPT_MISMATCH`, `GROUP_ADDRESS_UNKNOWN`, `DALI_DEVICE_MISSING`, `DALI_LAMP_FAILURE`, `METER_OFFLINE`, `REGISTER_TIMEOUT`, `REGISTER_SCALING_ERROR`, `LON_VARIABLE_UNKNOWN`, `DMX_BREAK_ERROR`, `DMX_SLOT_MISSING`, `ARTNET_SEQUENCE_GAP`, `SACN_SEQUENCE_GAP`, `SACN_SOURCE_CONFLICT`, `STALE_VALUE`, `GATEWAY_VALUE_MISMATCH`, `GATEWAY_MAPPING_MISSING`.

Her hata: Time, Protocol, Device, Point, Severity, Raw Frame, Expected, Received, Likely Cause alanlarıyla gösterilmelidir.

## Ortak Building Layer Drill-Down

Kullanıcı herhangi bir BMS point'ine tıklayarak ham haberleşmeye kadar inebilmelidir:

- **BACnet**: Room Temperature 23.4 °C → Present_Value → Analog Input12 → ReadProperty/COV → BACnet APDU → BACnet/IP → UDP → Ethernet
- **KNX**: Meeting Room Light ON → Group Address2/1/5 → DPT Switch → GroupValueWrite → KNX Telegram
- **DALI**: Light Level50% → DALI Driver12 → Direct Arc/Control Command → DALI Bus
- **Modbus**: Fan Speed1500rpm → Register40001 → `0x05DC` → Function03 Response → Modbus RTU → RS-485
- **M-Bus**: Heat Energy12,543kWh → Value Record → DIF/VIF → M-Bus Long Frame → Meter
- **DMX/Art-Net/sACN**: Lobby Light Red75% → DMX Slot101 → Universe4 → sACN/Art-Net → UDP/IP → Ethernet

Amaç: yalnız BACnet veya Modbus frame gösteren ayrı araçlar değil; oda sensöründen HVAC controller'a, enerji sayacından BMS'e, KNX butondan DALI driver'a ve Ethernet lighting controller'dan DMX fixture'a kadar binadaki kontrol verisinin **hangi protokolden, hangi address/object/register üzerinden geçtiğini ve fiziksel sistemde neye karşılık geldiğini** takip edebilen bütünleşik bir **Building Automation Communication Analyzer** oluşturmaktır.

---

## Dikkat çekenler

1. **"Fiziksel adres ≠ mantıksal kimlik" deseni üç protokolde tekrarlanıyor**: MS/TP MAC≠Device Instance, BACnet/IP'de IP≠Device Instance, sACN'de IP≠CID — toolkit her seferinde "fiziksel adres değişse de mantıksal kimlik sabit kalmalı" ilkesini ayrı ayrı uyguluyor; bu üç bölüm birlikte okunduğunda mimari bir tasarım prensibi ortaya çıkıyor.
2. **"Tahmin etme" ilkesi açıkça yazılı**: KNX DPT bilinmiyorsa toolkit ham `uint16` değeri gösterip semantik anlam uydurmamalı ("Cannot determine engineering meaning without DPT") — yanlış-pozitif üretmemeyi güvenilirlik ilkesi olarak öne çıkarıyor.
3. **sACN sürüm bilgisi çok spesifik ve tarihli**: ANSI E1.31-2025, 5 Ocak 2026'da yayımlanmış, IPv6 desteği eklemiş — belgede somut versiyon/tarih referansı olarak geçiyor, implementasyonun bu revizyona göre güncellenmesi gerekiyor.
4. **BACnet Priority Array (1-16) ile sACN Priority mekanizması yapısal olarak paralel**: iki bağımsız protokol "kim kazanır" sorusunu numerik öncelikle çözüyor (BACnet'te 8=Manual Operator override; sACN'de 100 vs 120 source çakışması).
5. **DALI-2 kapasite sınırları somut ve sert**: subnet başına 64 control gear + 64 control device, 16 group, 16 scene — saha adresleme/topoloji planlamasında aşılamayan limitler.
6. **DMX512 refresh hızı fiziksel bir tavan**: 512 slotluk tam universe'da ~44 Hz maksimum; sahne/lighting console senkronizasyonunda bu limit doğrudan tasarım kısıtı oluyor.
7. **LonWorks bilinçli olarak eksik bırakılmış**: "İlk toolkit sürümünde full LonWorks stack implementation zorunlu olmamalı" — diğer tüm protokollerin aksine burada kapsam açıkça daraltılmış, yalnız temel mesaj görünümü isteniyor.
8. **~29 hata kodluk tek ortak taksonomi**: BACnet, KNX, DALI, M-Bus, Modbus, LON, DMX, Art-Net, sACN gibi 8+ farklı protokol tek bir normalize hata sözlüğünde birleştiriliyor — gateway ve point-database mimarisinin omurgasını oluşturuyor.
9. **Gateway hata örneği gerçekçi bir entegrasyon hatasını hedefliyor**: BACnet↔KNX örneğinde DPT/scale yanlış yorumlanınca 23.2 °C'nin 234.0 °C'ye dönüşmesi (10x ölçek hatası) — sahada sık görülen tipik bir hata sınıfı olarak özellikle seçilmiş.
10. **Tüm sayısal formüller (Token Rotation, Freshness Age, DMX 16-bit Coarse/Fine) protokolden bağımsız aynı örüntüde**: `değer_yeni − değer_eski` ya da `Coarse×256+Fine` gibi basit ama toolkit genelinde tutarlı biçimde tekrar eden hesaplama kalıpları kullanılıyor.
