# 3.3 Endüstriyel Protokoller

*Kaynak: satır 6351–10211 ("Modbus RTU" → "3.3 Ortak Industrial Transaction Analyzer"). Kayıpsız teknik özet; anlatım dolgusu atılmış, sayı/formül/terim/alan listeleri aynen korunmuştur.*

## Modbus RTU

Modbus application protocol'ün seri hatta binary RTU encoding ile taşınan biçimi (Modbus Organization: seri için *Serial Line Protocol and Implementation Guide V1.02*, application için *Modbus Application Protocol V1.1b3*).

**ADU:** `ADDRESS | FUNCTION | DATA | CRC LOW | CRC HIGH`. Örnek istek `01 03 00 00 00 02 C4 0B` → Slave=1, FC=03 (Read Holding Registers), Start=0, Qty=2, CRC valid; yanıt `01 03 04 00 64 00 C8 BA 7A` → ByteCount=4, Reg0=0x0064(100), Reg1=0x00C8(200).

**Register tipleri:** uint16, int16, uint32, int32, float32, float64, BCD, ASCII, HEX, bit field. 32-bit byte/word ordering: **ABCD, BADC, CDAB, DCBA** (örn. Reg0=`41 CC`, Reg1=`00 00` → ABCD → IEEE-754 = **25.5**).

**Framing** delimiter değil timing'dir: `T_char = BitsPerCharacter / BaudRate`, `T_1.5 = 1.5*T_char`, `T_3.5 = 3.5*T_char` (örn. 0.92 char = Same Frame, 4.17 char = New Frame).

**CRC:** Received, Calculated, byte order, Coverage, PASS/FAIL (hata örneği: Received=0x0BC5, Calculated=0x0BC4, Difference=0x0001).

**Exception response:** normal Function ile exception biçimi/exception code ayrı çözülür, semantik gösterilir (örn. FC=0x03 → *Illegal Data Address*).

**Analyzer alanları:** Slave Address, Function, Request/Response, Register, Quantity, Byte Count, Data, CRC, Response Time, Silent Interval, Retry Count, Exception.

## Modbus ASCII

Modbus mesajlarını printable hex ASCII karakterlerle taşır (RTU=binary bytes, ASCII=hex chars). **Frame:** `:ADDRESS FUNCTION DATA LRC CR LF`; start `:`=`0x3A`, end `CR LF`=`0D 0A`. Binary `01 03 00 00 00 02` → wire `:010300000002...`. Toolkit üç görünüm birlikte: WIRE ASCII (`:010300000002FA\r\n`), ASCII HEX (`3A 30 31 30 33 ...`), DECODED BYTES.

CRC yerine **LRC** (Received/Calculated/Coverage/PASS-FAIL). **Parser state:** WAIT_COLON → READ_HEX_PAIR → READ_LRC → WAIT_CR → WAIT_LF → VALIDATE. **Hatalar:** Invalid Hex Character, Odd Number Of Hex Digits, Missing Colon, Missing CR, Missing LF, Invalid LRC, Timeout (örn. `:0103GG00` → `'G' is not a hexadecimal character`).

RTU/ASCII aynı function-code application modelini paylaşır, yalnız framing farklıdır.

## Modbus TCP

Modbus mesajını TCP/IP üzerinde **MBAP Header** ile taşır (Modbus Organization ayrı *Messaging Implementation Guide* yayımlar). **Yapı:** MBAP {Transaction ID, Protocol ID, Length, Unit ID} + PDU {Function Code, Data}. Wire: `00 01|00 00|00 06|01|03 00 00 00 02` → TID=1, PID=0, Len=6, UID=1, FC=0x03, Start=0, Qty=2. RTU CRC yok — bütünlük TCP/IP stack'ine bırakılır.

**Transaction matching:** yanıtlar zaman sırasına değil **Transaction ID**'ye göre eşleşir (çoklu outstanding request). **TCP stream problemi:** 1 TCP read ≠ 1 mesaj — bir ADU birden çok segmente bölünebilir veya tek payload'da birden çok ADU olabilir. Parser: **TCP Stream Reassembly → MBAP Length → ADU Extraction**.

## PROFIBUS DP

IEC 61158/IEC 61784 tabanlı açık fieldbus; DP = decentralized peripheral I/O (PI: spec/GSD/device integration belgeleri). **Kavramlar:** DP Master, DP Device/Slave, Station Address, Cyclic I/O, Acyclic Services, Parameterization, Configuration, Diagnostics, GSD, Ident Number.

**Commissioning:** Device Detected → Parameterization → Configuration Check → Diagnostic Check → Data Exchange. Cyclic I/O örneği: Output Byte=`0x05`=`00000101` (bit0=Motor Start, bit2=Reset); Input bit0=Running, bit1=Fault, bit2=Limit Switch. GSD import → byte'lar module/I/O tanımına bağlanır (PI: GSD = communication capabilities + diagnostics bilgisi).

Diagnostic örnek: Station 7, Data Exchange, Module1 8DI OK, Module2 4DO Fault→"Module missing". **Timing:** Bus Cycle Time, Station Response Time, Request Interval, Retry, Gap Time, Jitter, Cyclic Update Period. **GSD Explorer:** Vendor, Model, Ident Number, Supported Baud Rates, Modules, Input/Output Length, Diagnostic/Acyclic Capability.

## PROFINET

Ethernet tabanlı; cyclic I/O + parameterization + diagnostics + standart TCP/IP aynı ağda (I/O'dan senkron motion control'a). **Roller:** IO Controller, IO Device, IO Supervisor. **Katmanlar:** Ethernet → PROFINET Frame → Frame Type/Service → Device/Slot/Subslot → Process Data/Parameter/Alarm.

**DCP discovery** ayrı gösterilir: MAC `00:11:22:33:44:55`, Device Name `conveyor-io-01`, IP `192.168.10.25`, Vendor, Device. Cyclic örnek: Control Word=0x000F, Speed Setpoint=1500rpm → Status Word=0x1237, Actual Speed=1498rpm (profil varsa semantik bit isim). **Slot/Subslot** ağaç (Device→Slot0/Subslot..., Slot1 Input Module...).

**GSDML:** XML; device identification/structure/communication features/process data/parameters/diagnosis. PI güncel sürüm **V2.50** (Haziran 2026). Pipeline: Import GSDML → Build Module Tree → Decode Process Data → Decode Alarms → Show Parameters. Diagnostic timeline örneği: 12:00:00.000 Online → ...115 Parameterization → ...430 Data Exchange → 12:04:18.420 Module Pull → ...422 Alarm → 12:04:20.100 Module Plug → ...400 restored.

## EtherCAT

Real-time Industrial Ethernet; MainDevice frame'i SubDevice'lardan **on-the-fly** geçer. EtherType **`0x88A4`**; frame'de birden çok datagram olabilir. **Frame:** Ethernet Header → EtherCAT Header → Datagram(lar) → FCS. Datagram alanları: Command, Index, Address, Length, IRQ, Data, **Working Counter** (exact bit'ler resmi ETG revizyonundan, tahmin edilmez).

**Komutlar:** Read, Write, Read/Write; Physical/Auto-increment/Logical addressing. **WKC** en kritik alan — örn. Expected=4, Actual=3 → ERROR, "one mapped device did not process datagram" (ETG: WKC cyclic erişim başarısını denetler).

**State machine:** INIT → PRE-OP → SAFE-OP → OP (başarısızsa Requested/Actual State + AL Status Code). **Distributed Clocks:** Reference Clock, Node Clock Offset, Propagation Delay, Synchronization Error (kısa cycle time + düşük jitter tasarım hedefi). **Mailbox:** CoE, FoE, EoE, SoE, AoE → ikinci decoder'a yönlendirilir.

## EtherNet/IP

Standart Ethernet/TCP/IP/UDP/IP üzerinde **CIP** (ODVA: TCP/IP→Explicit, UDP/IP→Implicit). **Katman:** CIP → EtherNet/IP → TCP/UDP → IP → Ethernet.

**Explicit** (Read/Write parameter, Diagnostics, Configuration, Object access): Service, Class, Instance, Attribute, Path, Request Data, General Status, Extended Status, Response Data. **Implicit** (Cyclic I/O, UDP + producer-consumer multicast).

**Session:** Command, Length, Session Handle, Status, Sender Context, Options, Payload; timeline TCP Connect → Register Session → Explicit Messaging → Forward Open → I/O Exchange → Forward Close → Unregister. **Implicit I/O** örnek: Output Assembly=4B, Input Assembly=8B, RPI=10ms; izlenir: Requested/Actual Mean Interval, Min, Max, Jitter, Lost/Duplicate Packet, Sequence. Roller: **Scanner/Originator**, **Adapter/Target**.

## CIP — Common Industrial Protocol

Media-independent object-oriented application protocol; EtherNet/IP+DeviceNet aynı object modelini paylaşır. **Model:** Object→Class/Instance/Attribute/Service. **Path:** Encoded Path→Class/Instance/Attribute Segment (örn. `20 xx 24 yy 30 zz`; ID'ler yalnız resmi ODVA database'e göre).

**Service model:** Request{Service, Path Size, Path, Request Data} / Response{Reply Service, Reserved, General Status, Additional Status Size/Data, Response Data}. **Producer-consumer:** tek producer→çoklu consumer (ODVA'nın temel CIP özelliği). **Device Profiles** (EDS import): Device Type, Identity, Objects, Assemblies, Parameters, Connections.

ODVA Nisan 2026 CIP Networks Library: **CIP Volume 1 v3.40**, **EtherNet/IP Adaptation v1.36**, **DeviceNet Adaptation v1.16**.

## DeviceNet

CAN data-link üzerinde CIP (ODVA: controller↔field I/O multi-drop fieldbus). **Katman:** CIP→DeviceNet→CAN→Physical Bus; trunkline-dropline + aynı kablodan network power. CAN frame (ID/DLC/DATA) tek başına bırakılmaz: decoder DeviceNet→CIP Connection→CIP Object/I/O Data.

**Messaging:** I/O Messaging + Explicit Messaging; izlenir: Node Address, Connection Type, Produced/Consumed Data, Explicit Service, Timeout, Duplicate MAC check. Örnek: Node05 Motor Starter, Online, Input Status=Running, Output Command=Start, Explicit reads=12.

## CANopen

CAN üzerinde standardize application layer + **Object Dictionary** + communication services (CiA: 16-bit Index+8-bit Sub-index adresleme). OD örneği: `1000h` Device Type, `1001h` Error Register, `2000h` Manufacturer Specific, `6000h` Profile Objects; aralık **`1000h–1FFFh`**=communication, **`2000h–9FFFh`**=application. Alanlar: Index, Sub-index, Name, Data Type, Access, Raw, Physical, Default, Min, Max.

**NMT:** Initializing → Pre-operational → Operational → Stopped (node bazında). **PDO:** yüksek öncelikli process data; klasik CC PDO ≤**8 byte**/frame, FD'de daha büyük. Örnek TPDO1 CAN ID=`0x181`, DATA=`37 12 DC 05 00 00 00 00` → Status Word=0x1237, Velocity=1500rpm.

**SDO:** client-server confirmed OD erişimi; expedited/segmented/block transfer (CiA). Örnek: Index=6040 Subindex=00 Write Value=000F → Success. **EMCY:** Node, Error Code, Error Register, Manufacturer Data. **EDS import** → raw frame semantic signal'a çevrilir.

## CC-Link

Factory automation fieldbus ailesi; CLPA: classic ≤**10 Mbit/s**, ≤**64 station**, ≤**1200 m** (konfigürasyona bağlı). **Roller:** Master, Local, Remote I/O, Remote Device Station. Process-data: Remote Input **RX**, Output **RY**, Register **RWr/RWw** (logical data areas; exact mapping seçilen revizyona bağlı).

**Error analyzer:** Station timeout, Duplicate station, Cyclic data mismatch, Communication stopped, Retry, Invalid station configuration. Exact telegram alanları CLPA spec paketinden (tahmin edilmez); CLPA Mart 2024 *CC-Link Specification Overview/Protocol* yayımlar.

## CC-Link IE

Ethernet tabanlı aile: **CC-Link IE Controller Network**, **Field Network** (**1 Gbit/s**, deterministic cyclic + async/transient aynı ağda), **Field Network Basic**, **TSN**. Analyzer önce network type belirlemeli (wire behavior farklı).

**Cyclic vs transient:** Cyclic Process Data (PLC↔Servo/Remote I/O) + Transient Message (Parameter read, Diagnostics, Information transfer) ayrı renk (CLPA: control/information bandwidth ayrılabilir, cyclic deterministic kalır). **Shared memory** (Controller Network): Station Area memory-map (token passing + network shared memory). **TSN:** IEEE 802.1AS sync, Time-aware/Cyclic/General Ethernet traffic; spec **1 Gbit/s** ve **100 Mbit/s** + 802.1AS.

## Sercos III

Controls/drives/I/O için Ethernet tabanlı real-time (standart Ethernet fiziği + real-time Sercos). **Cycle analyzer:** Communication Cycle→Real-Time Telegrams, Device Data, Unified Communication Channel (exact tablolar seçilen revizyona bağlı).

**Timing:** Fast Ethernet **100 Mbit/s** full-duplex; cycle time **31.25 µs–65 ms**; sync accuracy **<1 µs** (örn. Configured=1ms, Measured Mean=1.0002ms + Min/Max/Jitter). **Device model:** raw bytes değil, semantic Command/Actual value, Status, Diagnostic, Parameters. Startup+operating phase state timeline.

## POWERLINK

IEEE 802.3 Fast Ethernet hard real-time; roller **Managing Node (MN)** / **Controlled Node (CN)** (OpenPOWERLINK her ikisini destekler). **Cycle:** Isochronous Phase (her cycle veya n'inci cycle'da, multiplexing) + Asynchronous Phase. **Frame semantiği:** Cycle start/sync, Poll request/response, Start of async phase, Async send.

**CANopen benzeri model:** Object Dictionary, PDO, SDO, NMT, Device Profile (EPSG/OPC Foundation companion spec) → CANopen ile ortak OD engine paylaşılabilir. Örnek CN1 TPDO Position/Velocity, RPDO Control/Target. **Diagnostics:** Node missing, NMT state mismatch, Cycle timeout, Late response, PDO mismatch, SDO abort.

## IO-Link

Sensör/aktüatör point-to-point intelligent interface; 2025 released package: **Interface and System Specification V1.1.5**. Tipik: PLC→Industrial Ethernet→IO-Link Master→Port1-4 (Pressure/Distance/Valve/RFID).

**Üç veri sınıfı:** Process Data, Parameter/On-request Data, Events/Diagnostics. Örnek: raw `09 C4` → Pressure=25.00bar, Status=Valid, bit=`00001001 11000100`. **IODD:** manufacturer/device type/serial/parameters/process data/diagnostics/comm characteristics — import öncesi yalnız raw+temel servis, sonrası semantic isim/unit/scaling/enum. Port örneği: Port1 Mode=IO-Link, Device=Pressure Transmitter, Comm=OK. **Diagnostic:** Device/Port event, Communication lost, Process data invalid, Parameter write rejected, Device replacement mismatch.

## AS-Interface — AS-i

Sensör/aktüatör seviyesi düşük maliyetli network; data+power 2 iletken, line/star/tree topoloji. **İki nesil ayrı:** Classic AS-i, **ASi-5** (aynı başlık, farklı decoder). Cyclic: Master Poll→Device Response→Next Device; ASi-5 OFDM/multi-device ayrı. ASi-5: **~1.2 ms** cycle, ≤**96 device**, ≤**32 byte**/device cyclic I/O.

**Device panel:** Address, Device Type, Input/Output Bits, Parameter Data, Diagnostic, Safety Status. **Gateway:** PROFINET/EtherNet/IP vb. üzerinden; mapping PROFINET Module→AS-i Device Address→Physical I/O.

## HART

Analog **4–20 mA** loop üzerinde digital comm (FieldComm Group: Universal/Common Practice Commands, Data Link Layer ayrı belgeler). Tipik: DCS/PLC→HART Modem→4–20mA+HART→Transmitter. **Analog Process Value ile Digital HART ayrı gösterilir** (örn. Loop Current=12.00mA/Normalized=50% vs HART PV).

**Frame:** Preamble, Start Delimiter, Address, Command, Byte Count, Status, Data, Checksum. **Komutlar:** Universal, Common Practice, Device-Specific (Common Practice = application-layer spec, tanımlandığı gibi uygulanır). Alanlar: Command, Description, Request/Response Length, Device/Command Status, Decoded Data, Response Time. **Burst mode:** periyodik device-originated → BURST. Integration örneği: Analog PV=50.02bar, HART PV=49.98bar, Difference=0.04bar.

## FOUNDATION Fieldbus

Proses otomasyonu digital fieldbus; **H1** + **HSE**. FieldComm Group: H1=bi-directional publisher-subscriber, segment ≤**32 device**, ≤**1900 m**. Topoloji: Host/DCS→Power Conditioner→TRUNK→Spur→PT/FT/Valve.

**Layer view:** Physical→Communication Stack→User Layer→Function Blocks. **Device view:** Resource Block, Transducer Block, Function Blocks (AI/AO/PID/DI/DO, profil varsa). **Publisher-subscriber** örnek: Pressure AI publishes→PID consumes→Valve AO consumes. **HSE:** standart Ethernet/IP, **100 Mbit/s** control backbone hedefi; H1/HSE ayrı decoder katmanı.

## M-Bus — Meter-Bus

Utility metering (Heat/Water/Gas/Energy) wired sistem; bağlayıcı referans **EN 13757** (eski site dokümantasyonu yalnız bilgi amaçlı) → toolkit M-Bus Revision/EN 13757 Profile metadata'sı taşır.

**Frame sınıfları:** Single Character, Short Frame, Control Frame, Long Frame (byte yapısı revizyona bağlı). Long response: Control, Address, CI, Application Data, Checksum; records: Value, Unit, Function, Tariff, Storage, Timestamp, Device info (CI = data type+byte sequence). **Meter browser:** Primary/Secondary Address, Manufacturer, Medium, Version, Identification, Status. Örnek: Energy=1234.56kWh, Volume=78.901m³, Flow Temp=63.2°C; record: DIF, DIFE, VIF, VIFE, DATA (coding tablosu resmi standard database'ından).

## Wireless M-Bus

EN 13757 ailesi kablosuz metering; wired M-Bus ile aynı application-data decoding motoru, radio/link-layer ayrı. **Girdi:** SDR decoded log, RF receiver log, Gateway export, HEX telegram, PCAP. **Radio metadata:** Timestamp, Frequency, Mode, RSSI, LQI/SNR, Direction, Device ID, Manufacturer, Encryption Status. **Pipeline:** Radio Frame→Link Layer→Security/Encryption→M-Bus Application Data→Meter Records.

**Encryption:** key yoksa Encrypted Payload; key varsa yerel Decryption=PASS, Authentication=PASS/FAIL — **anahtar dış servislere gönderilmez**. Decoder tabloları kullanılan EN 13757 revizyonuna bağlanmalı.

## OPC UA

TCP protokolü değil: information model, object model, services, security, client/server, PubSub içeren interoperability architecture. Spec ailesi **1.05**; Service Set'ler: Discovery, SecureChannel, Session, NodeManagement, View, Attribute, Method, MonitoredItem, Subscription.

**Address Space** ağaç (Objects→Machine1→Temperature/Speed/State/Alarm/Start()); Node alanları: NodeId, BrowseName, DisplayName, NodeClass, DataType, AccessLevel, Value, StatusCode, Source/ServerTimestamp. **Connection:** TCP Connect→Hello/Ack→OpenSecureChannel→CreateSession→ActivateSession→Browse/Read/Write→CreateSubscription→Publish→CloseSession→CloseSecureChannel (SecureChannel=confidentiality/integrity, Session'dan önce). Read örnek: Value=25.73, Status=Good. **Subscription** örnek: Publishing Interval=100ms, Sampling=20ms, Queue=10; izlenir: Value, Sequence Number, Publish Time, Missed Sequence, DataChange. **Security:** Endpoint, Security Policy, Message Security Mode, Server Certificate, User Authentication, SecureChannel Token; hata: Untrusted/Expired/Hostname mismatch/Revoked.

## IEC 60870-5-101

Geniş coğrafi telecontrol için seri companion standard; konsolide sürüm **IEC 60870-5-101:2003+AMD1:2015** (IEC 60870-5:2026 serisi). Kullanım: SCADA Master→Serial Link→RTU→Substation.

**Frame:** Link Layer→ASDU→Type Identification→Cause of Transmission→Common Address→Information Object Address→Information Elements (byte genişlikleri profile bağlı). ASDU örnek: Type=Single Point Information, Cause=Spontaneous, Common Address=1, IO=100, Value=ON, Quality=Good. **Monitor/Control direction** ayrı renk. **Command correlation:** Select→Execute→Activation Confirmation→Activation Termination. **Quality bit'leri:** Invalid, Not topical, Substituted, Blocked, Overflow. **Time tag:** No timestamp, **CP24Time2a**, **CP56Time2a**.

## IEC 60870-5-104

101 modelini ağa taşır; konsolide sürüm **IEC 60870-5-104:2006+AMD1:2016** (2026 serisi). Fark: 101=Serial, 104=TCP/IP. **APDU:** APCI↔ASDU; frame kategorileri **I/S/U-format**.

**Sequence tracking:** TX/RX Sequence, Expected TX/RX (örn. Frame A TX=151/RX=223, B TX=152/RX=223, C TX=154 → *missing I-frame*, Expected TX=153). **U-format:** STARTDT, STOPDT, TESTFR. **SCADA session:** TCP Connect→STARTDT→General Interrogation→Spontaneous Events→Commands→TESTFR→STOPDT/Disconnect. **ASDU** 101 ile ortak core: Type ID, VSQ, Cause, Common Address, IOA, Value, Quality, Timestamp.

## DNP3

SCADA/telecontrol layered protokol (DNP Users Group: application/data-link/physical mimari; addressing, timestamped events, time sync, broadcast, confirmations). **Layer view:** Application→Transport Function→Data Link→Physical/TCP (düz HEX değil, katman katman).

**Link layer:** Start, Length, Control, Destination, Source, CRC, User Data. **Application:** Application Control, Function Code, Internal Indications, Object Headers, Objects. **Object/Variation:** Object Group, Variation, Qualifier, Range, Value, Flags, Timestamp (örn. Binary Input Index=12, Value=ON, Flags=ONLINE, Time=12:15:44.231). **Event class:** 0/1/2/3 filtreleri. **Unsolicited response** ayrı etiket. **Confirm:** Response→Confirmation required→Confirm. **IIN:** Device Restart, Need Time, Local Control, Device Trouble... (bit tanımına göre semantic alarm).

## IEC 61850 — MMS ve GOOSE

Geniş standard serisi (device/data modelling + communication services); **toolkit v1 kapsamı: yalnız MMS+GOOSE**. **Info model:** IED→Logical Device→Logical Node→Data Object→Data Attribute; SCL ile IED/LD/LN/DO/DA/Dataset/Report Control Block/GOOSE Control Block mapping.

### MMS
IEC 61850-8-1: ACSI→MMS/Ethernet mapping (time-critical+non-time-critical), client/server. Servisler: Association, Read, Write, GetNameList, Report, File service, Control. Stack: Ethernet→IP→TCP→ISO transport/session/presentation→MMS→61850 object. SCL ile cryptic MMS variable name→logical-node path.

### GOOSE
Yüksek hızlı event/protection-control multicast (protection trip gibi time-critical); Ethernet seviyesinde. **Field tree:** Destination MAC, EtherType, APPID, Length, Reserved, GOOSE PDU{Control Block Reference, TTL, Dataset, GO ID, Timestamp, State Number, Sequence Number, Test, Configuration Revision, Needs Commissioning, Number Of Dataset Entries, Dataset Values} (BER/TLV coding 61850-8-1 revizyonuna göre).

**stNum/sqNum:** state değişmezse stNum sabit/sqNum artar (10/1,2,3), değişirse stNum artar/sqNum resetlenir (11) → *State Change Detected*. **Retransmission:** State Change→GOOSE→rapid→normal→slower retransmission grafiği. **Dataset:** SCL ile semantik (örn. ProtectionTrip: Breaker Trip=TRUE...), yoksa generic ASN.1 (`BOOLEAN=TRUE`). **Troubleshooting:** stNum unexpected jump, sqNum duplicate/gap, Configuration revision changed, Dataset mismatch, TTL expired, GOOSE stopped, Unexpected publisher/destination MAC, Test flag active (IEC 2024 guidance: SCD ile karşılaştırma).

---

# 3.3 Ortak Industrial Transaction Analyzer

Tüm endüstriyel protokollerde ortak üst analiz motoru — tam ayrıntı.

## Device / Node Table

Kolonlar **Address, Device, Protocol, State**:

| Address | Device | Protocol | State |
|---|---|---|---|
| 1 | Remote IO | Modbus RTU | Online |
| 2 | Servo X | EtherCAT | OP |
| 3 | Pressure Sensor | IO-Link | Online |
| 4 | Drive | CANopen | Operational |

## Cyclic Data Statistics

Her cyclic signal: Expected Period, Average Period, Minimum, Maximum, Jitter, Message Count, Missing Count, Duplicate Count, Timeout Count, Last Update.

Jitter formülü: `J_i = T_i - T_nominal`. Örnek: Nominal=10ms, Observed=9.95/10.02/10.08/9.97 ms (grafiklenebilir).

## Request/Response Statistics

Request Count, Response Count, Timeout, Exception, Retry, Minimum/Average/Maximum Response, **95th Percentile**.

## Process Value görünümü

Ham veri (örn. `41 CC 00 00`) tek başına bırakılmaz; mapping varsa örn. Motor Speed=1500rpm. Dört mod: **Raw HEX, Raw Decimal, Engineering Value, Trend**.

## Quality / Status

Protokol destekliyorsa birlikte: **Value, Quality, Timestamp, Source, Validity, Substitution, Alarm**.

## Device Description Integration

| Protokol | Tanım dosyası |
|---|---|
| PROFIBUS | GSD |
| PROFINET | GSDML |
| CANopen | EDS |
| EtherNet/IP | EDS |
| IO-Link | IODD |
| POWERLINK | XDD |
| IEC 61850 | SCL |
| HART/Fieldbus | EDD/FDI (varsa) |

Tanım dosyası yalnız proje konfigürasyonu değil, **decoder'a semantic bilgi sağlayan veri kaynağı**dır. Örnek: EDS yokken Byte0-1=`37 12`; EDS/Profile ile StatusWord=`0x1237`.

## Industrial Error Correlation

Farklı katman hataları ilişkilendirilir — ayrı 4 hata yerine kök-neden zinciri:

```
12:10:00.101 Ethernet Link Down
12:10:00.104 PROFINET Device Lost
12:10:00.105 PLC IO Provider Status Bad
12:10:00.120 Application Alarm: Conveyor Sensor Communication Failure
```

→ **ROOT EVENT:** Ethernet Link Down; **Consequences:** PROFINET connection lost, Process input invalid, Application alarm generated.

## Layer Drill-Down

```
Application Value → Industrial Protocol → Transport/Fieldbus → Frame → Bytes → Bits/Physical Capture
```

Örnek 1: Motor Speed=1498rpm → PROFINET Process Data → Ethernet Frame → Byte Offset 46–47 → `05 DA` → `00000101 11011010`.
Örnek 2: Pressure=50.2bar → Modbus Holding Register 40001 → Response Function 03 → Register bytes → `13 9C`.

**Amaç:** ayrı "Modbus decoder"/"CANopen decoder"/"PROFINET viewer" koleksiyonu değil; PLC'den field device'a kadar process value'nun hangi frame/byte/bit/object/register/service üzerinden taşındığını izlenebilir kılan tek analiz ortamı.

## Dikkat çekenler

- Satır aralığı (6351–10334) iki bölümü kapsıyor: **3.3 Endüstriyel Protokoller** ~satır 10211'de bitiyor, satır 10213'ten **3.4 Otomotiv Protokolleri** (CAN/LIN/FlexRay/UDS/OBD-II/DoIP/SOME-IP/XCP listesi) başlıyor ve 10334'te kesik durumda devam ediyor. Bu dosya yalnız 3.3'ü kapsar; 3.4 ayrı özet gerektirir.
- EtherCAT, CC-Link, Sercos III, M-Bus, HART, IEC 60870-5-101/104 gibi birçok protokolde metin tekrar tekrar "exact bit/byte alanları resmi spec revizyonundan alınmalı, tahmin edilmemeli" uyarısı yapıyor — wire-level alan tabloları için kaynak iddia değil resmi spesifikasyon olmalı.
- Kaynakta çok sayıda "2026" referansı var: PROFINET GSDML V2.50 (Haziran 2026), ODVA CIP Networks Library (Nisan 2026), IEC 60870-5 2026 serisi, IEC 61850 2026 overview — aynen korundu.
- CANopen ve POWERLINK (EPSG/OPC Foundation companion spec'e göre) aynı object dictionary/PDO/SDO/NMT modelini paylaşıyor; toolkit ortak bir OD engine ile iki protokolü birden besleyebilir.
- IEC 61850 kapsamı bilinçli daraltılmış: "ilk sürümde bütün ekosistem değil yalnız MMS+GOOSE."
- Modbus RTU/ASCII/TCP aynı function-code modelini paylaşır, yalnız framing/taşıma farklıdır — decoder mantığı üçü arasında ortaklaştırılabilir.
- Ortak Industrial Transaction Analyzer mimarinin omurgası: tüm protokol-özel decoder'ların üstüne tek tip Device Table, Cyclic/Request-Response Stats, Process Value, Quality, Device Description Integration, Error Correlation, Layer Drill-Down koyuyor.
- Layer Drill-Down örnekleri somut byte-offset/register numarası içeriyor (Byte Offset 46–47, Holding Register 40001) — hedef kavramsal değil gerçek adres düzeyinde izlenebilirlik.
- Wireless M-Bus'ta nadir açık güvenlik notu: şifre çözme anahtarı yerel kalmalı, dış servislere gönderilmemeli.
