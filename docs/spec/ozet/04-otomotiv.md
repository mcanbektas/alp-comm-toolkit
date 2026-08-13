# 3.4 Otomotiv

Kapsam: CAN 2.0A/2.0B, CAN FD, CAN XL, J1939, CANopen, LIN, FlexRay, SENT, SPC, PSI5, K-Line, ISO 9141, KWP2000, ISO-TP, UDS, OBD-II, DoIP, Automotive Ethernet, SOME/IP, XCP (CAN/Ethernet), CCP, J1850 (PWM/VPW) ve ortak Automotive Network Analyzer katmanı. (Kaynak satır 10335–13989; 13991'den başlayan "3.5 Denizcilik ve navigasyon protokolleri" bu özetin kapsamı dışındadır.)

## CAN 2.0A — Classical CAN Base Frame

"CAN 2.0A" başlığı modern ISO/CiA terminolojisinde **Classical CAN Base Frame Format (CBFF)** — 11-bit identifier kullanan klasik CAN data frame — karşılığıdır. ISO 11898-1'de Classical CAN için 11-bit CBFF ve 29-bit CEFF frame formatları ayrılır. CAN bir node-address protokolü değildir: CAN ID doğrudan "ECU adresi" değildir, mesajın önceliğini ve anlamını üst protokol/sistem tasarımı belirler.

**Frame yapısı:** SOF → Arbitration Field (11-bit CAN ID + RTR) → Control Field (IDE + DLC) → Data Field → CRC Field → ACK Field → EOF → Intermission. CiA'ya göre Classical CAN base frame 11-bit CAN ID ve 0–8 byte data field kullanır.

**CAN ID örneği:** 0x123 → decimal 291 → binary (11-bit) `001 0010 0011`. Toolkit: CAN ID, Decimal, Binary, Format (Base/11-bit) alanlarını göstermelidir.

**Arbitration:** Küçük numerik CAN ID = yüksek öncelik. İki node aynı anda transmission başlatırsa bit-by-bit arbitration'da dominant bit recessive'i bastırır; kaybeden node transmission'ı bozmaz, receiver'a geçer. Örnek: Node A ID `00100100000`, Node B ID `00100100011`; farklılaşan bitte Node A 0, Node B 1 gönderir, bus'ta 0 gözlenir → Node B arbitration'ı kaybeder. Toolkit bit seviyesinde göstermelidir.

**DLC:** Classical CAN'de application data alanı en fazla 8 byte. Örnek: CAN ID 0x321, DLC 8, DATA `10 27 00 64 12 34 FF 00` → Byte 0=0x10, Byte 1=0x27... Toolkit byte ve bit görünümü sağlamalıdır.

**Bit stuffing:** CAN NRZ aktarımda senkronizasyon için bit stuffing uygular (CiA: frame coding mekanizması). Transmitter stuff bit ekler, receiver kaldırır. Toolkit "Logical Frame Bits" ve "Actual Bus Bits" olmak üzere iki görünüm vermeli; eklenen bit `[STUFF]` işaretlenmelidir.

**ACK:** Frame'i doğru alan en az bir receiver ACK slotunda dominant durum oluşturarak acknowledgement sağlar. Toolkit: ACK Detected / ACK State Valid, ya da "ACK ERROR — No node acknowledged transmitted frame".

**CAN Analyzer alanları:** Timestamp, Channel, CAN ID, 11/29 bit, Data/Remote, DLC, Data, CRC state, ACK state, Frame duration, Period, Frequency, Jitter, Count.

## CAN 2.0B — Classical CAN Extended Frame

29-bit identifier kullanan **Classical CAN Extended Frame Format (CEFF)**. Yapı: Base Identifier 11 bit + Identifier Extension 18 bit = Total 29 bit (CiA: CEFF 29-bit CAN ID, 11-bit base + 18-bit extension'dan oluşur).

Örnek: CAN ID `0x18F00401` → Format: Extended, Binary: `0000110001111000000000100000001`.

**Base/Extended karşılaştırma:** Classical Base = 11-bit ID; Classical Extended = 29-bit ID. Extended frame'in arbitration/control bölümü daha uzun olduğundan aynı payload için bus'ta daha fazla bit tüketir.

**Protocol detection:** 29-bit frame görüldüğünde toolkit yalnız "Extended CAN" dememeli; olası üst katman adayları: J1939, NMEA 2000, ISO-TP Extended ID, OEM Custom, CANopen Extended. ID biçiminden tek başına kesin protokol kararı verilmemelidir.

## CAN FD

Classical CAN'in data alanı ve throughput sınırlarını genişleten ikinci nesil CAN data-link formatı: 11 veya 29-bit identifier, 0–64 byte payload, opsiyonel bit-rate switching. Frame'ler FBFF/FEFF olarak adlandırılır. Classical CAN node CAN FD frame'i anlayamaz; CAN FD controller Classical CAN frame'lerini de işleyebilir.

**Frame:** SOF → Arbitration → Control (FDF, BRS, ESI, DLC) → Data (0–64 byte) → CRC → ACK → EOF.

- **FDF:** Classical CAN ile CAN FD frame formatını ayırır.
- **BRS (Bit Rate Switch):** Aktifse arbitration ve data fazları farklı bit rate kullanabilir (CiA: BRS recessive olduğunda ikinci bit rate data phase'de kullanılır). Örnek: Nominal Bit Rate 500 kbit/s, Data Bit Rate 2 Mbit/s; zaman çizelgesi SOF/Arbitration @500 kbit/s → BRS → DATA+CRC parçası @2 Mbit/s → ACK/EOF @500 kbit/s. Toolkit ayrı hesaplamalı: Nominal Bit Time, Data Bit Time, Nominal Sample Point, Data Sample Point, Nominal Prescaler, Data Prescaler.
- **ESI (Error State Indicator):** Error Active / Error Passive — transmitter state bilgisi. Toolkit semantik gösterim yapmalı (örn. "ESI: Error Active").
- **DLC mapping:** CAN FD'de DLC 0–8 doğrudan byte sayısı değildir; toolkit DLC → Actual Payload Length eşlemesi yapmalı ve 12, 16, 20, 24, 32, 48, 64 byte uzunluklarını doğru göstermelidir.
- **CRC:** Payload uzunluğuna bağlı güçlü CRC + stuff-bit counter; ISO ve non-ISO CAN FD implementasyonları CRC/stuff-bit counter ayrıntılarında farklılaşır (CiA: yeni tasarımlarda ISO CAN FD önerilir). Toolkit metadata: CAN FD Variant = ISO / Non-ISO / Unknown.

**CAN FD decoder alanları:** CAN ID, Base/Extended, FDF, BRS, ESI, DLC, Payload Length, Data, Nominal Rate, Data Rate, Frame Time, CRC, ACK.

## CAN XL — Temel Frame İnceleme

Üçüncü nesil CAN data-link yapısı; ISO 11898-1:2024 içinde Classical CAN ve CAN FD ile birlikte standardize edilir. Data field 1–2048 byte. İlk sürümde tam stack yerine **frame-level inspection** hedeflenir.

**Temel fark:** CAN CC/CAN FD'de CAN ID = Priority + Content/Address semantics; CAN XL'de 11-bit Priority ID + 32-bit Acceptance Field ayrımı vardır.

**LLC alanları:** FTYP, BRS, ESI, SDT, SEC, DLC, VCID, AF, LLC Data.

- **SDT (Service Data Unit Type):** Higher-layer içeriğin türünü tanımlar. Toolkit: SDT 0x.. → Interpretation: "Configured higher-layer protocol".
- **VCID (Virtual CAN Network ID):** Aynı fiziksel CAN XL network üzerinde logical/virtual ayrım.
- **Acceptance Field (32-bit, AF):** Node address veya content indication — higher layer kullanımına bırakılır.
- **Payload (1–2048 byte):** Normal CAN hex-table görünümü yetersiz kalır; toolkit Hex Viewer, Offset, ASCII, Search, Field regions, Payload export sağlamalıdır.

## SAE J1939

Ağır hizmet araçları, iş/tarım makineleri ve vehicle-derived stationary applications için CAN tabanlı communication architecture. Classical J1939 data-link 29-bit Classical CAN extended frame kullanır; SAE ayrıca J1939-22 ile CAN FD tabanlı data-link'i tanımlar.

**29-bit identifier alanları:** Priority, Reserved (R), Data Page (DP), PDU Format (PF), PDU Specific (PS), Source Address (SA).

Bit yerleşimi:
```
28        26 25 24 23        16 15         8 7          0
+-----------+--+--+------------+------------+------------+
| Priority  |R |DP|     PF     |     PS     |     SA     |
+-----------+--+--+------------+------------+------------+
```

Örnek: CAN ID `0x18F00401` → Priority: 6, PGN: 61444, Source Address: 1.

**PGN hesabı:**
- PDU1 (PF < 240): PS bir **destination address**'tir ve PGN hesaplanırken sıfırlanır → `PGN = (DP<<16) | (PF<<8)`
- PDU2 (PF ≥ 240): PS bir **group extension**'dır → `PGN = (DP<<16) | (PF<<8) | PS`

**SPN (Suspect Parameter Number):** PGN payload'ı içindeki fiziksel parametreler. Alanlar: SPN, Name, Start Bit, Length, Resolution, Offset, Unit, Valid Range, NA Value, Error Value.
Physical dönüşüm: `Physical = Raw × Resolution + Offset`

**Address Claim:** Toolkit node tablosu (SA, NAME, Device) oluşturmalı; örnek: SA 00 = Engine #1, SA 03 = Transmission, SA 21 = Body Controller. Address conflict tespiti gerekir (örn. 0x21 iki farklı NAME tarafından claim edilmiş).

**Transport Protocol:** 8 byte CAN payload'unu aşan application data için segmentasyon mesajları: **BAM, RTS, CTS, DT, EndOfMsgAck, Abort** — toolkit bunları session olarak gruplamalıdır.
BAM akışı: `TP.CM BAM → TP.DT packet 1 → TP.DT packet 2 → TP.DT packet 3 → ...` → Reassembled: Original PGN, Total Length, Packet Count, Complete Payload.

**DM1 / DM2 (diagnostic):**
- DM1: Lamp Status + Active DTC (SPN, FMI, Occurrence Count)
- DM2: Previously Active DTC

**J1939 Analyzer alanları:** CAN ID, Priority, PGN, PGN Name, Source, Destination, SPNs, Physical Values, Transport State, Address Claims, DM1/DM2, DTC, FMI, Occurrence, Period, Jitter.

## CANopen

Otomotiv dışında da yaygın; elektrikli araç, özel araç, robotik ve auxiliary ECU sistemlerinde görülebilir. Temel protokoller: NMT, SDO, PDO, SYNC, EMCY, Heartbeat — Object Dictionary etrafında organize edilir (CiA 301: CANopen application layer ve communication profile).

**Object Dictionary:** 16-bit Index + 8-bit Sub-index. Örnek: Index 0x6041, Subindex 0, Name: Statusword, Type: uint16, Access: RO, Value: 0x1237.

**NMT state akışı:** Initializing → Pre-operational → Operational → Stopped.

**PDO:** TPDO (Device→Network), RPDO (Network→Device). PDO mapping, object dictionary mapping entries üzerinden hangi application objects'in payload'a konduğunu tanımlar. Örnek: CAN ID 0x181, DATA `37 12 DC 05`; EDS/profile varsa → Statusword: 0x1237, Velocity: 1500 rpm.

**SDO:** Configuration/service access (Client ↔ Index/Sub-index/Read-Write ↔ Server). Transfer tipleri: Expedited, Segmented, Block (CiA: SDO server/client channels ve OD erişimi tanımlar).

**EMCY:** Node, Error Code, Error Register, Manufacturer Data.

**CiA 402 (drive profile):** Controlword, Statusword, Modes of Operation, Target/Actual Velocity, Target/Actual Position — state-machine görünümüyle işlenir (motion controller/drives için en yaygın CANopen profillerinden biri).

## LIN

Düşük maliyetli automotive subnetwork haberleşmesi. Güncel yayımlanmış spesifikasyon **ISO 17987-3:2025** — signal management, frame transfer, schedule table, commander/responder behaviour ve status management'i kapsar.

**Frame:** BREAK → SYNC → PROTECTED IDENTIFIER → DATA → CHECKSUM.

- **Break:** Commander frame başlangıcını uzun dominant pulse ile bildirir. Toolkit: Break Length, Expected Minimum, Measured, PASS/FAIL.
- **Sync:** `0x55` deseni (binary `01010101`); alternating edge yapısı baud senkronizasyonu için uygundur.
- **Identifier:** 6-bit frame ID + parity bitleri → Protected Identifier. Formüller:
  `P0 = ID0 ⊕ ID1 ⊕ ID2 ⊕ ID4`
  `P1 = ¬(ID1 ⊕ ID3 ⊕ ID4 ⊕ ID5)`
  Toolkit: Raw PID, Frame ID, P0, P1, Parity (PASS).
- **Schedule Table:** Deterministik iletişim için kullanılır. Örnek: Slot 1 = Frame 0x10 (Period 10 ms), Slot 2 = Frame 0x20 (Period 20 ms), Slot 3 = Diagnostic Frame. Toolkit zaman çizelgesi: `0ms | F10 | F20 | F10 | F30 | F10 ...` (10/20/30 ms işaretli).
- **Checksum:** Classic Checksum / Enhanced Checksum ayrımı yapılmalı.
- **LDF:** LIN Description File import edildiğinde Nodes, Frames, Signals, Schedules, Diagnostic frames, Baudrate semantic decoder'a aktarılmalı.

## FlexRay

Deterministic, time-triggered, çift kanallı automotive communication sistemi. ISO 17458 ailesi standardize eder; fiziksel katman 10 Mbit/s'ye kadar; topolojiler: point-to-point, linear passive bus, passive star, active star.

**Channel:** Channel A ve Channel B ayrı ayrı analiz edilir.

**Communication cycle:** Static Segment, Dynamic Segment, Symbol Window, Network Idle Time (toolkit cycle timeline göstermeli).

- **Static segment:** Time-triggered slotlar (örn. Slot 1→ECU A, Slot 2→ECU B, Slot 3→ECU C) — deterministik mesaj iletimi.
- **Dynamic segment:** Event-driven, minislot tabanlı arbitration.

Toolkit Static/Dynamic/Symbol/Idle alanlarını farklı renkte göstermelidir.

**Frame alanları:** Frame ID, Cycle Count, Payload Length, Header CRC, Frame CRC, Channel A/B. Frame ağacı: Header (Indicators, Frame ID, Payload Length, Header CRC, Cycle Count) → Payload → Trailer (Frame CRC).

**Cycle correlation:** Örn. Frame ID 10, cycle desenleri 20/22/24/26 gibi filtrelenip pattern olarak gösterilebilir.

**Error analizi:** Header CRC error, Frame CRC error, Missing static frame, Unexpected cycle, Channel A/B mismatch, Slot violation, Cycle timing error.

## SENT — Single Edge Nibble Transmission

Sensörden ECU'ya düşük maliyetli dijital sensor data aktarımı için pulse-duration tabanlı arayüz; SAE J2716 ile standardize edilir. UART/CAN gibi byte-clocked serial protokol değildir — bilgi **pulse duration** üzerinden nibble olarak kodlanır.

**Fast Channel frame:** Synchronization/Calibration Pulse → Status/Communication Nibble → Data Nibble 1, 2, ... → CRC Nibble → Optional Pause Pulse. (Kaynakta da: Sync pulse, Status nibble, Data nibbles, CRC nibble, Pause pulse, Fast channel, Slow channel tanımlı.)

**Pulse decoder:** Girdi log örneği: Pulse 0: 168 us, Pulse 1: 45 us, Pulse 2: 63 us... Önce calibration/sync pulse'tan Estimated Tick Time çıkarılır; ardından her nibble Pulse duration → Tick count → Nibble value olarak decode edilir. Örnek: Pulse 45.0 us, Tick 3.0 us → Pulse Ticks 15 → Decoded Nibble 0x3. Not: Kesin timing sabitleri ve toleranslar seçilen SAE J2716 revizyon/profiline göre değişir; toolkit bunları evrensel sabit varsaymamalıdır.

**Slow Channel:** Fast channel'ın communication/status bitlerinden daha düşük hızlı ikincil bilgi taşınır. Toolkit ayrı stream üretmeli: Fast Channel = Sensor Value; Slow Channel = Sensor ID, Status, Diagnostic, Calibration information.

**CRC:** Received / Calculated / PASS-FAIL gösterimi.

**Signal graph:** Pulse Width vs Frame grafiği (örn. nibble 0x1/0xA/0xF için scatter/trend görünümü).

## SPC — Short PWM Code

SENT ile ilişkili bidirectional/request-triggered kullanım biçimi. Receiver/ECU SENT hattında belirli bir pulse oluşturarak transmitter/sensor'dan response veya belirli davranış talep eder (Microchip SENT peripheral dokümanı: mesaj isteme, mode değiştirme, sensor calibration gibi bidirectional senaryolar için kullanılabilir).

**Transaction:** ECU → SPC Trigger Pulse → Sensor recognizes request → SENT Response Frame. Zaman çizelgesi: Idle → SPC Trigger → Response Delay → SENT Sync → SENT Data.

**Trigger analizi:** Trigger Start, Trigger End, Pulse Width, Sensor selection/profile, Response delay, Response frame.

**Hata durumları:** Trigger too short, Trigger too long, No response, Response timeout, Invalid SENT CRC, Unexpected sensor, Line not idle before trigger. (SPC profile-specific pulse width semantikleri sensor/vendor datasheet'ine bağlı tutulmalıdır.)

## PSI5 — Peripheral Sensor Interface

Otomotiv peripheral sensörler için sensor interface; birçok implementasyonda sensor-to-ECU iletişim current-loop/current-modulation tabanlıdır, dedicated PSI5 peripheral veya harici PHY/transceiver üzerinden işlenir (Infineon AURIX dokümantasyonu: özellikle airbag ve diğer peripheral sensor uygulamaları için current-loop serial link). İlk sürümde fiziksel current waveform capture zorunlu olmayabilir; belgenin yaklaşımına uygun biçimde pulse/frame log import desteklenebilir.

**Analyzer alanları:** Channel, Timestamp, Slot, Frame Type, Data, Parity, CRC, Sensor Address, Status, Sync Mode.

**Synchronous communication:** ECU Sync Pulse → Time Slot 1→Sensor 1, Time Slot 2→Sensor 2, Time Slot 3→Sensor 3. Toolkit slot view: SYNC → TS1[Sensor 1], TS2[Sensor 2], TS3[Sensor 3].

**Asynchronous mode:** Frame'ler external sync olmadan sensor timing'iyle gelir. Toolkit Synchronous/Asynchronous ayrımını otomatik veya kullanıcı seçimiyle yapmalı.

**Fiziksel/protokol ayrımı (katmanlar):** Current modulation → Decoded Manchester/bit stream → PSI5 frame → Sensor data.

**Versioning:** PSI5 Revision, Application Profile (Airbag, Chassis/Safety, Powertrain, Custom) metadata olarak tutulmalı. Toolkit kesin CRC, frame-size ve slot kurallarını seçilen profile specification'dan yüklemeli; tek global frame formatı varsaymamalıdır.

## K-Line

Legacy automotive diagnostics'te kullanılan single-wire UART tabanlı fiziksel iletişim hattı. K-Line üzerinde farklı diagnostic data-link/application protokolleri çalışabilir: ISO 9141, ISO 14230 KWP2000, UDS on K-Line, OEM proprietary. K-Line = fiziksel/data transport ortamı; KWP/UDS/OBD = üst katmanlar — karıştırılmamalıdır. ISO 14230-1 K-Line fiziksel katmanını ISO 9141 tabanlı tanımlar ve 12V/24V vehicle supply sistemlerine genişletir.

**Toolkit fiziksel/log görünümü:** Idle, Initialization, Request, Response, Inter-byte gap, Inter-message gap.

**Initialization:** Analyzer 5-baud initialization, Fast initialization, Unknown/OEM initialization adaylarını ayırt etmelidir. ISO 14230-2, ISO 9141 ve ISO 14230 initialization yöntemlerinin coexistence durumunu tester'ın ayırması gerektiğini özellikle belirtir.

## ISO 9141

Vehicle ECU ile diagnostic tester arasında digital information exchange için eski ama önemli diagnostic communication standardı. ISO 9141-2 emissions-related OBD diagnostic iletişimini OBD test ekipmanıyla ilişkilendirir.

**Toolkit görünümleri:** Initialization, Keyword/synchronization, Target/source, Data bytes, Checksum, Timing.

**5-baud initialization:** Initialization Start → Address transmission → Synchronization → Keywords → Normal diagnostic communication (analyzer bunu ayrı event olarak tanımalı; kesin timing seçilen ISO 9141 revizyon/profiline göre doğrulanmalı).

**Hata görünümü:** Initialization timeout, Invalid sync, Keyword mismatch, Checksum failure, Response timeout, Unexpected address.

## ISO 14230 — KWP2000

K-Line üzerinde diagnostic communication için **Keyword Protocol 2000 (KWP2000)** ailesi. ISO 14230-2 UART-based K-Line vehicle communication için data-link servisleri tanımlar ve UDS/OBD gibi application layer'ları taşıyabilir.

**Katman:** KWP Application Services → ISO 14230 Data Link → K-Line Physical Layer.

**Message analyzer alanları:** Format, Target Address, Source Address, Length, Service ID, Data, Checksum (seçilen header formatına göre).

**Initialization:** 5-Baud Init ve Fast Init — ayrı zaman çizelgesine sahip olmalı.

**KWP service parser:** Request SID, Response SID, Parameters, Negative response modeli.

**Migration karşılaştırma:** Toolkit KWP2000 vs UDS servis isimleri/semantik karşılıklarını gösterebilir — legacy ECU'dan UDS tabanlı ECU'ya geçişte özellikle değerlidir.

## ISO-TP — ISO 15765-2 DoCAN Transport Protocol

CAN'in sınırlı frame payload'ı üzerinde daha uzun application mesajlarının parçalanıp yeniden birleştirilmesini sağlar. 2026 itibarıyla mevcut yayımlanmış standart **ISO 15765-2:2024 Edition 4**'tür; Edition 5 üzerinde çalışma başlamıştır — toolkit standard revision metadata'sını saklamalıdır. Hem Classical CAN hem CAN FD ortamlarında kullanılabilir.

**PCI frame tipleri** (high nibble):

| Nibble | Tip |
|---|---|
| 0x0 | Single Frame |
| 0x1 | First Frame |
| 0x2 | Consecutive Frame |
| 0x3 | Flow Control |

**Single Frame:** Kısa payload, `PCI \| UDS DATA`. Örnek: `02 10 01` → PCI: Single Frame, Payload Length: 2, Payload: `10 01`, UDS: Diagnostic Session Control.

**First Frame:** Uzun mesaj başlangıcı. Örnek: `10 14 ...` → Frame Type: First Frame, Total Application Length: 20 byte.

**Consecutive Frame:** `21 ...`, `22 ...`, `23 ...` — sequence nibble 1,2,3...F,0,1... döngüsel (wrap) ilerler. Hata örneği: Expected SN 4, Received SN 6 → "ERROR: Missing Consecutive Frame".

**Flow Control:** `30 BS STmin ...` → Flow Status, Block Size, Separation Time alanlarına ayrılır. Flow Status semantik: Continue To Send / Wait / Overflow.

**Reassembly görünümü:** FF → CF1 → CF2 → CF3 → Complete UDS Payload. Toolkit: Progress (örn. 48/128 bytes), Sequence (Valid), Elapsed (örn. 18.4 ms).

**Addressing mode:** Addressing Mode ve Padding parametreleri mutlaka desteklenmelidir: Normal Addressing, Extended Addressing, Mixed Addressing (profile'a göre seçilir).

## UDS — Unified Diagnostic Services

ECU diagnostic fonksiyonlarının network transport'tan bağımsız application-layer servislerini tanımlar. **ISO 14229-1'in güncel yayımlanmış sürümü Haziran 2026 itibarıyla ISO 14229-1:2026 Edition 4'tür.** Kapsam: DTC okuma/silme, live data okuma, actuator/routine control, programlama vb. UDS transport'tan bağımsızdır — CAN/ISO-TP, DoIP ve K-Line gibi farklı alt katmanlarla kullanılabilir (ISO 14229-2 bunu özellikle tanımlar).

**Temel servisler (kaynakta listelenen):**

| SID | Servis |
|---|---|
| 0x10 | Diagnostic Session Control |
| 0x11 | ECU Reset |
| 0x14 | Clear Diagnostic Information |
| 0x19 | Read DTC Information |
| 0x22 | Read Data By Identifier |
| 0x27 | Security Access |
| 0x28 | Communication Control |
| 0x2E | Write Data By Identifier |
| 0x31 | Routine Control |
| 0x34 | Request Download |
| 0x36 | Transfer Data |
| 0x37 | Request Transfer Exit |
| 0x3E | Tester Present |
| 0x85 | Control DTC Setting |

**Request/positive response:** Örnek TX `22 F1 90` → Service: ReadDataByIdentifier, DID: 0xF190. Positive response = Request SID + `0x40` (genel model; belge açıkça tanımlar). Örnek: Request 22 → Positive Response 62.

**Negative Response:** `7F` + Original SID + NRC. Örnek: `7F 22 31` → Negative Response, Original Service: ReadDataByIdentifier, NRC: 0x31, Meaning: Request Out Of Range.

**Session yönetimi:** Default Session, Programming Session, Extended Diagnostic Session, OEM Session. Zaman çizelgesi: Default →(10 03)→ Extended → Diagnostic operations →(timeout/reset)→ Default.

**Security Access:** Tester→Request Seed, ECU→Seed, Tester→Key, ECU→Positive/Negative. Alanlar: Security Level, Seed, Key length, Response, Delay/Lockout. Toolkit seed-key algoritmasını bilmediği durumda kırmaya veya tahmin etmeye çalışmamalı; yalnız transaction'ı analiz etmelidir.

**DID (Data Identifier):** DID database import edilebilir. Örnekler: DID 0xF190 → Name: VIN, Type: ASCII, Length: 17. DID 0x1234 → Name: Battery Voltage, Type: uint16, Factor: 0.001, Unit: V.

**DTC viewer alanları:** DTC, Status Mask, Status, Snapshot, Extended Data, Occurrence.

**Programming timeline:** Programming Session → Security Access → Request Download → Transfer Data → Transfer Data → Request Transfer Exit → Routine Check → ECU Reset — tek programming session olarak gruplanmalıdır.

## OBD-II

Emissions-related generic vehicle diagnostics için standardize edilmiş erişim modeli. SAE J1979/ISO 15031-5 vehicle OBD sistemi ile generic test ekipmanı arasındaki emissions-related diagnostic servisleri tanımlar. Güncel SAE J1979 sürümü Mayıs 2025'te reaffirm edilmiştir; J1979-DA diagnostic data/PID tanımlarını dijital ek olarak sürdürür.

**Modlar** (toolkit en az Mode 01/03/04/09 desteklemeli; geniş decoder aşağıdaki gibidir):

| Mode | Anlam |
|---|---|
| 01 | Current Data |
| 02 | Freeze Frame |
| 03 | Stored DTC |
| 04 | Clear DTC / diagnostic information |
| 05 | Oxygen sensor test (legacy) |
| 06 | Monitor test results |
| 07 | Pending DTC |
| 08 | Control operation |
| 09 | Vehicle Information |

**PID örneği — Engine RPM:** `RPM = (A×256+B)/4`. Örnek: A=0x1A=26, B=0xF8=248 → RPM=(26×256+248)/4=1726. Toolkit: PID Engine RPM, Raw `1A F8`, Physical 1726 rpm.

**Vehicle speed:** `Speed = A km/h`.

**Coolant temperature:** `T = A − 40` (°C).

**DTC:** Pxxxx / Cxxxx / Bxxxx / Uxxxx sınıf ve kod ayrıştırması. Örnek raw DTC bytes `01 33` → uygun bit mapping ile standart textual DTC'ye dönüştürülmeli.

**VIN:** Mode 09 response varsa multi-frame reassembly sonrası VIN (17 karakter) gösterilmeli.

## DoIP — Diagnostics over Internet Protocol

Diagnostic communication'ı IP/Ethernet ortamına taşır. **Güncel ISO 13400-2 sürümü Haziran 2025 tarihli Edition 3'tür.** Client DoIP entity ile vehicle/server tarafı arasında TCP ve UDP üzerinden secured/unsecured diagnostic communication, discovery, routing ve gateway davranışlarını tanımlar.

**Katman:** UDS → DoIP → TCP/UDP → IP → Ethernet.

**Discovery:** Vehicle Announcement, Vehicle Identification Request, Vehicle Identification Response — ayrı transaction olarak gösterilmeli (ISO 13400-2: vehicle announcement/discovery ve network integration mandatory functionality olarak tanımlanır).

**Routing Activation:** TCP Connect → Routing Activation Request → Routing Activation Response → Diagnostic Communication. Alanlar: Tester Logical Address, Gateway Logical Address, Activation Type, Response.

**Diagnostic message:** DoIP Header → Source Address, Target Address → UDS Payload (ardından UDS decoder'a aktarılır).

**Alive/connection state machine:** TCP Connected, Routing Active, Diagnostic Active, Idle, Disconnected.

**TLS:** ISO 13400-2:2025 opsiyonel TLS capability içerir. Toolkit: TLS Enabled/Disabled, Certificate, Cipher, Handshake status.

## Automotive Ethernet

Tek bir application protokolü değil; Ethernet ekosistemi olarak ele alınmalı: 100BASE-T1, 1000BASE-T1, Multi-Gig automotive Ethernet, Switching, VLAN, TSN, IPv4/IPv6, UDP/TCP, DoIP, SOME/IP, PTP, AVB/TSN. Diagnostic external interface tarafında ISO 13400-3, IEEE 802.3 tabanlı 100BASE-TX vehicle/test equipment interface'i tanımlar.

**Protokol stack (katmanlı):** Ethernet → 802.1Q VLAN → IPv4/IPv6 → UDP/TCP → SOME/IP / DoIP / XCP.

**ECU communication matrix:** Örnek tablo (ECU, IP, MAC) — Gateway 10.0.0.1, Camera 10.0.0.20, ADAS, Infotainment.

**Stream statistics:** Bandwidth, Packets/s, Multicast, Unicast, Broadcast, VLAN, PCP, Latency, Jitter, Packet Loss.

**Top talkers örneği:** Camera ECU 420 Mbit/s, Gateway 35 Mbit/s, Diagnostics 2.4 Mbit/s.

## SOME/IP

Automotive Ethernet üzerinde service-oriented communication protokol ailesi. AUTOSAR resmi Foundation specification setinde SOME/IP Protocol Specification yayınlanır. İki ana parça: SOME/IP ve SOME/IP Service Discovery (SD).

**Header alanları:** Service ID, Method/Event ID, Length, Client ID, Session ID, Protocol Version, Interface Version, Message Type, Return Code, Payload. Kavramsal yerleşim: `Service ID | Method ID` / `Client ID | Session ID` / Length / Version / Message Type / Return Code / Payload. Kesin bit/byte tahsisi seçilen AUTOSAR SOME/IP spec revizyonundan uygulanmalıdır.

**Request/Response:** Client → Request Service 0x1234, Method 0x0001, Session 0x0034 → Server; Server → Response Session 0x0034 → Client. Toolkit session ID üzerinden request-response correlation yapmalıdır.

**Notification/Event:** Event → Subscriber(s) — request-response'dan ayrı renkte gösterilmelidir.

**Service Discovery:** FindService, OfferService, SubscribeEventgroup, SubscribeAck, StopOffer — ayrı decoder modülüyle gösterilmelidir.

**Service Browser (tree view):** Service 0x1234 → Instance 0x0001 → Methods, Events, Event Groups.

## XCP on CAN

ECU measurement, calibration, stimulation ve programming için bus-independent master-slave protokol. **ASAM MCD-1 XCP'nin güncel yayımlanmış versiyonu 1.5.0'dır.** Base protocol CAN, CAN FD, FlexRay, Ethernet, serial links ve USB gibi farklı transport'lara map edilebilir.

**Katman:** Calibration Tool → XCP → CAN/CAN FD → ECU.

**CTO / DTO:** CTO (Command Transfer Object) — command/response trafiği: CONNECT, GET_STATUS, SET_MTA, UPLOAD, DOWNLOAD, ...; DTO (Data Transfer Object) — yüksek hızlı data stream: DAQ, STIM.

**A2L:** ECU parametre ve measurement variable memory addresses/properties bilgisi A2L üzerinden calibration sistemine verilir. Toolkit A2L yüklendiğinde: Measurements, Characteristics, Axis, Memory Segment, Events, DAQ Lists, XCP Parameters tanımlarını oluşturmalıdır.

**Measurement örneği:** Raw DTO `01 34 12 78 56`; A2L varsa → EngineSpeed: 1498 rpm, Throttle: 23.4 %.

**DAQ analyzer alanları:** DAQ List, ODT, Event Channel, Timestamp, Measurements, Packet Rate, Lost DTO.

**Calibration transaction tree:** CONNECT → SET_MTA → UPLOAD → Modify → DOWNLOAD.

## XCP on Ethernet

XCP base protokolü aynı kalır, transport: Ethernet → IP → UDP veya TCP → XCP. ASAM XCP standardı UDP/IP ve TCP/IP transport layer'larını açıkça destekler.

**Analyzer katmanları:** MAC, IP, UDP/TCP, XCP Transport Header, XCP Packet, CTO/DTO, DAQ, Measurement.

**UDP:** Yüksek data-rate DAQ trafiğinde izlenmeli: Packet Loss, Sequence Gap, Out-of-order, Jitter.

**TCP:** Toolkit stream reassembly yapmalıdır: TCP Segment 1, TCP Segment 2 → Complete XCP Packet.

**Throughput hesapları:** DAQ Samples/s, Payload Byte/s, Network Byte/s, Protocol Efficiency, Packet Rate.

**Time correlation:** ECU timestamp, Host timestamp, Offset, Drift — XCP'nin measurement data ve ECU event timing mekanizmaları nedeniyle özellikle yararlıdır (ASAM XCP standardı time correlation işlevlerini de içerir).

## CCP — CAN Calibration Protocol

CAN-specific ECU calibration ve measurement protokolü. **ASAM MCD-1 CCP'nin current published versiyonu 2.1.0'dır**; ASAM bunu legacy/obsolete teknoloji olarak sınıflandırır ve yeni sistemlerde XCP kullanımını önerir.

**Katman:** Calibration Tool → CCP → CAN → ECU.

**CRO / DTO:** CRO (Command Receive Object), DTO (Data Transmission Object).

**Command flow:** CONNECT → GET_CCP_VERSION → SET_MTA → UPLOAD/DOWNLOAD → DAQ. Alanlar: Command, Counter, Parameters, Response, Status.

**A2L entegrasyonu:** Raw ECU Address → A2L Mapping → Parameter Name → Physical Value.

**CCP → XCP karşılaştırma:** CCP = CAN-specific, Legacy; XCP = Transport independent, Recommended successor.

## SAE J1850 PWM

Legacy Class-B automotive communication network standardı; güncel durumu **stabilized**. İki klasik fiziksel/data coding implementasyonu: **41.6 kbit/s PWM** ve **10.4 kbit/s VPW**.

PWM = Pulse Width Modulation. Toolkit pulse-log tabanlı decoder sağlamalıdır.

**Pulse Analyzer örneği:** Pulse 1: 8 us, Pulse 2: 16 us, Pulse 3: 8 us → seçilen J1850 profiline göre Bit 1, Bit 0, Bit 1. (SAE'nin J1850 standard summary'si 41.6 kbit/s PWM implementasyonunu tanımlar.)

**Frame analyzer:** SOF, Header, Data, CRC, EOD, EOF. Exact header semantics mesaj/uygulama standardına göre değişebileceğinden J2178/J1979 gibi üst dokümanlarla eşlenmelidir (SAE J2178: J1850 non-diagnostic message header/data field tanımlarını ayrıca standardize eder).

**Bit pulse view örneği:** 8.1 us → Bit 1; 15.9 us → Bit 0; 8.0 us → Bit 1. Alanlar: Pulse Width, Threshold, Decoded Bit, Confidence.

**Hatalar:** Invalid pulse width, SOF missing, CRC error, EOF timeout, Collision/arbitration issue, Unexpected symbol.

## SAE J1850 VPW

VPW = Variable Pulse Width; single-wire legacy J1850 implementasyonu. SAE J1850 klasik implementasyon setinde 10.4 kbit/s VPW ile 41.6 kbit/s PWM fiziksel seçenekleri birlikte tanımlanmıştır. VPW'de bit anlamı yalnız pulse width'e değil, aktif/passive state ile pulse duration'ın birlikte değerlendirilmesine bağlıdır.

Örnek raw capture: Active 64 us, Passive 128 us, Active 64 us, ... → bitstream çıkarılır.

**Analyzer aşamaları:** Pulse Capture → Symbol Decode → Bits → Bytes → J1850 Frame → OBD/OEM Message.

**OBD ilişkisi:** Legacy OBD-II uygulamaları J1850 üzerinden taşınabilir; güncel SAE J1979 kapsamı halen legacy physical/data-link seçenekleri arasında SAE J1850'yi listeler. Toolkit zincirleme decode yapabilmelidir: J1850 VPW → OBD-II → Mode → PID.

## Ortak Automotive Network Analyzer

Bütün otomotiv modüllerinin üzerinde ortak bir vehicle-network analiz katmanı bulunmalıdır.

### ECU / Node Explorer

Örnek (Network: Powertrain CAN): ECU, Address/ID sütunlu tablo — Engine ECU, Transmission ECU, ABS/ESC, Gateway, Instrument Cluster. Node detection protokole göre yapılır: CAN → observed IDs; J1939 → Source Address/NAME; CANopen → Node ID; LIN → Node/Frame publisher; DoIP → Logical Address; Ethernet → MAC/IP.

### Network Matrix

Örnek tablo (Message, Producer, Consumer, Period): 0x100 Engine→Cluster 10 ms; 0x120 ABS→Gateway 20 ms; 0x321 Body→Door 100 ms.

### Period Analysis

Formüller:
`Period_i = t_i − t_(i-1)`
`T_avg = (1/(N-1)) × Σ_{i=2}^{N} (t_i − t_(i-1))`
`f = 1/T`
`J_i = T_i − T_expected`

Örnek: CAN ID 0x120, Expected 10.000 ms, Average 10.013 ms, Minimum 9.890 ms, Maximum 10.171 ms, Jitter ±0.17 ms.

### Missing Message Detector

Örnek: Expected Period 10 ms, Last Frame 35 ms ago → Missing Estimate: 3, Alarm: CYCLIC MESSAGE TIMEOUT.

### Counter Analysis

Örnek payload nibble dizisi: Frame1=0x0, Frame2=0x1, Frame3=0x2, Frame4=0x4 → Expected: 3, Received: 4, Possible Lost Frame: 1.

### Rolling Counter / Alive Counter

Custom signal database tanımlanabilmelidir: Counter Start Bit, Counter Length, Modulo, Initial Value.

### Application CRC / E2E

CAN frame CRC'den bağımsız application-layer CRC bulunabilir (örn. CAN Data = CRC | Counter | Signals). Toolkit CAN protocol CRC ile payload/application CRC'yi karıştırmamalıdır: **CAN Frame CRC ≠ Application E2E CRC** açıkça gösterilmelidir.

### DBC Integration

DBC yüklendiğinde: CAN ID → Message → Signals eşlemesi yapılmalıdır. Signal alanları: Start Bit, Length, Byte Order, Signed, Factor, Offset, Min, Max, Unit, Enum, Multiplexing.
Physical dönüşüm: `Physical = Raw × Factor + Offset`

### A2L Integration

XCP/CCP için: Measurement, Characteristic, Axis, Memory Address, Conversion, Unit, DAQ, Event tanımları A2L'den alınmalıdır.

### LDF Integration

LIN: Node, Frame, Signal, Schedule eşlemesi.

### EDS Integration

CANopen: Object Dictionary, PDO, SDO, Device Profile eşlemesi.

### Diagnostic Timeline

Tek timeline: Tester → ISO-TP request → UDS 10 03 → Positive Response → Security Access → Read DID → ECU Reset.

### Gateway Correlation

Modern araçlarda aynı application transaction farklı ağlarda görünebilir: CAN → Central Gateway → Ethernet → Target ECU. Toolkit aynı diagnostic transaction'ı DoIP → Gateway → ISO-TP → UDS ECU olarak ilişkilendirebilirse çok güçlü bir entegrasyon aracı olur.

### Multi-Bus Time Correlation

CAN1, CAN2, LIN, Ethernet, FlexRay capture'ları aynı timeline'a getirilebilmelidir. Örnek:
```
12:01:00.100 CAN     BrakeRequest
12:01:00.101 FlexRay  BrakeCommand
12:01:00.103 CAN     BrakeStatus
```

### Trigger sistemi

Kullanıcı tanımlı trigger örnekleri: CAN ID == 0x123; Signal EngineSpeed > 6000; UDS NRC received; DTC appears; LIN checksum error; DoIP disconnected; J1939 DM1 contains FMI 5. Trigger olduğunda capture: 5 saniye öncesi + 10 saniye sonrası saklanabilmelidir.

### Otomatik Hata Korelasyonu

Örnek zaman çizelgesi:
```
12:10:00.000  CAN ECU disappears
12:10:00.050  Gateway reports communication DTC
12:10:00.100  UDS request timeout
12:10:00.110  Application sets signal invalid
```
Toolkit çıktısı: Possible Root Event: ECU communication lost; Consequences: cyclic CAN frame missing, gateway DTC, UDS timeout, application data invalid.

**Kapanış hedefi (kaynaktan):** Otomotiv bölümü yalnızca ayrı ayrı CAN decoder, UDS decoder ve OBD decoder sunan bir araç koleksiyonu olmamalıdır. Amaç; sensor pulse seviyesinden CAN/LIN/FlexRay frame'ine, transport katmanından UDS/OBD diagnostic servisine, Automotive Ethernet üzerinden DoIP/SOME-IP/XCP uygulama verisine kadar aynı araç içi iletişimi katman katman inceleyebilen **bütünleşik bir automotive communication analyzer** oluşturmaktır.

## Dikkat çekenler

- **Zamana duyarlı standart sürümleri** — kaynak birçok yerde açık tarih/edition veriyor ve "toolkit metadata olarak saklamalı" diyor: ISO 15765-2:2024 Edition 4 (ISO-TP, Edition 5 çalışması sürüyor), ISO 14229-1:2026 Edition 4 (UDS, Haziran 2026), ISO 13400-2 Edition 3 (DoIP, Haziran 2025, opsiyonel TLS), SAE J1979 (OBD-II, Mayıs 2025 reaffirm). Bunlar sabit kod olarak gömülmemeli, sürüm bilgisi olarak izlenmelidir.
- **CCP açıkça legacy/obsolete** — ASAM CCP'yi (v2.1.0) yeni sistemlerde önermiyor, XCP (v1.5.0) "recommended successor" olarak işaretli. Toolkit karşılaştırma panelinde bunu görünür kılmalı.
- **"CAN ID ≠ node address"** ilkesi tekrarlanıyor: CAN 2.0A bölümünde açıkça vurgulanıyor, J1939'da Source Address ayrı bir alan olarak modelleniyor, CANopen'da Node ID yine ayrı. Toolkit bu üç modeli birbirine karıştırmamalı.
- **29-bit ID tek başına protokol kanıtı değildir** — CAN 2.0B'de belirtildiği gibi J1939, NMEA 2000, ISO-TP Extended ID, OEM Custom, CANopen Extended hepsi aday; kesin karar ID formatından çıkarılmamalı.
- **K-Line ≠ KWP/UDS/OBD** — K-Line yalnızca fiziksel/data transport ortamıdır, KWP2000/UDS/OBD-II bunun üzerinde çalışan üst katmanlardır; belge bu ayrımı özellikle vurguluyor.
- **CAN Frame CRC ≠ Application E2E CRC** — Ortak Analyzer bölümünde açıkça ayrılması istenen iki farklı katman; karıştırılmaması gerektiği özellikle belirtiliyor.
- **Güvenlik sınırı** — UDS Security Access analizinde toolkit'in seed-key algoritmasını kırmaya/tahmin etmeye çalışmaması, yalnız transaction'ı pasif analiz etmesi gerektiği açıkça belirtiliyor.
- **Zamanlama sabitleri evrensel değildir** — SENT (SAE J2716), SPC ve PSI5 için exact timing/pulse-width/CRC/slot kuralları seçilen revizyon, profil (Airbag/Chassis-Safety/Powertrain/Custom) veya vendor datasheet'ine bağlıdır; toolkit hiçbirinde tek sabit evrensel değer varsaymamalı.
- **Tanım dosyası kapsamı** — bu bölümde yalnızca **DBC, LDF, A2L, EDS** entegrasyonları geçiyor (CAN/LIN/XCP-CCP/CANopen için); ODX bu satır aralığında hiç geçmiyor.
- **A2L Integration iki kez görünüyor** — biri "XCP on CAN" altında protokole özgü, diğeri "Ortak Automotive Network Analyzer" altında sistem-geneli; ikisi tutarlı ama farklı kapsamda ele alınmalı.
- **J1939 ↔ CAN 2.0B çapraz örnek** — aynı `0x18F00401` CAN ID'si hem CAN 2.0B'de "Extended format" örneği hem J1939'da "Priority 6 / PGN 61444 / SA 1" örneği olarak kullanılıyor; iki bölüm arasında tutarlılık kontrolü için iyi bir referans noktası.
- **CAN XL kasıtlı olarak sınırlı kapsam** — belge ilk sürüm için tam stack yerine yalnızca "frame-level inspection" istiyor; toolkit'in ilk faz hedefini şişirmemek gerekiyor.
- **Okunan aralığın sınırı** — 10335–14138 satır aralığı otomotiv bölümünün sonunu (13989) aştı; 13991'den itibaren "3.5 Denizcilik ve navigasyon protokolleri" başlıyor ve bu özete dahil edilmedi (ayrı bir özet dosyasını gerektirir).
