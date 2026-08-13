# 3.6 Havacılık & UAV

Kaynak satır aralığı: 17200–21438 (ALP Comm Toolkit ana belgesi). Bölüm; MAVLink 1/2, UAVCAN ailesi (DroneCAN/Cyphal), RC protokolleri (SBUS/IBUS/CRSF/PPM/PWM), avionics bus'ları (ARINC 429, MIL-STD-1553), surveillance (ADS-B/Mode-S), GNSS katmanı (UBX/RTCM/NMEA'nin havacılık görünümü) ve bunları birleştiren ortak analiz katmanlarını (flight state, coordinate frame, freshness, latency, bridge, hata modeli, sistem grafiği, drill-down) kapsar.

---

## MAVLink 1

MAVLink; İHA ve robotik sistemlerde vehicle↔ground-station ve component↔component haberleşmesi için kullanılan hafif binary mesajlaşma protokolüdür. Resmi dokümantasyon MAVLink 1 ve MAVLink 2 wire format'larını ayrı tanımlar; yeni sistemler için MAVLink 2 önerilir, ancak MAVLink 1 uyumluluğu hâlâ önemlidir.

**Frame yapısı** (başlangıç byte'ı `0xFE`, Message ID 8 bit, payload ≤ 255 byte):

| Offset | Alan |
|---|---|
| 0 | STX (`0xFE`) |
| 1 | LEN (payload uzunluğu) |
| 2 | SEQ |
| 3 | SYSID |
| 4 | COMPID |
| 5 | MSGID (8 bit) |
| 6.. | PAYLOAD |
| ... | CRC LOW |
| ... | CRC HIGH |

Örnek renklendirme: `FE | 09 | 2A | 01 | 01 | 00 | PAYLOAD... | CRC` → STX LEN SEQ SYS CMP MSG DATA CRC.

**Sequence:** Her gönderici bileşenin paketlerinde artan 8-bit sayaçtır, paket kaybı tahmininde kullanılır:

```
Δ = (CurrentSequence − PreviousSequence) mod 256
Lost = Δ − 1,  Δ > 1
Lost = 0,      Δ ≤ 1
```

Örnek: Previous=41, Current=45 → Δ=4 → tahmini kayıp=3. Sequence takibi **System ID + Component ID + Link** bazında yapılmalı; farklı bileşenlerin sayaçları karıştırılmamalıdır.

**System ID / Component ID:** System ID bir vehicle/sistemi, Component ID o sistem içindeki autopilot/camera/gimbal/companion-computer gibi bileşeni ayırt eder. Toolkit bunu component-tree olarak göstermelidir (örn. System 1 → Autopilot/Camera/Gimbal/Companion Computer; System 2 → Autopilot).

---

## MAVLink 2

MAVLink 1 frame'ini genişletir. Başlangıç marker'ı `0xFD`, Message ID 24 bit'tir; ayrıca compat/incompat flags ve opsiyonel 13-byte signature alanı vardır.

**Wire frame:** `STX | LEN | INCOMPAT_FLAGS | COMPAT_FLAGS | SEQ | SYSID | COMPID | MSGID[24bit] | PAYLOAD | CHECKSUM | OPTIONAL SIGNATURE`

Görsel: `FD | LEN | IF | CF | SEQ | SYS | CMP | MSG ID | PAYLOAD | CRC | SIGN`

### MAVLink 1 / MAVLink 2 karşılaştırması

| | MAVLink 1 | MAVLink 2 |
|---|---|---|
| STX | 0xFE | 0xFD |
| MSG ID | 8 bit | 24 bit |
| Signing | Yok | Desteklenir |
| Flags | Yok | Var |
| Extensions | Yok | Var |

Resmi dokümantasyon mümkün olduğunda MAVLink 2 kullanımını önerir.

### MAVLink CRC (CRC_EXTRA)

Paket bütünlüğü için **CRC-16/MCRF4XX** kullanılır. CRC hesabı `magic` başlangıç byte'ını ve opsiyonel signature'ı kapsamaz; mesaj-özel **CRC_EXTRA** değeri de hesaba dahil edilir. CRC_EXTRA yalnız transmission corruption'ı değil, gönderici/alıcının aynı message definition'a sahip olup olmadığını da doğrular. Toolkit `CRC FAILED` durumunda olası nedenleri listelemelidir: corrupted packet, wrong dialect, wrong message definition, wrong CRC_EXTRA, incorrect serialization.

### MAVLink Payload Serialization

Multi-byte değerler **little-endian**'dır. Wire field sırası XML declaration sırasıyla aynı değildir — generator alanları native type boyutuna göre yeniden sıralar (reorder). MAVLink 2 extension field'ları wire üzerinde base field'lardan sonra gelir. Bu nedenle custom MAVLink XML import edilirken **XML declaration sırasına doğrudan byte offset verilmemelidir**. Pipeline: `MAVLink XML → Field Ordering Rules → Wire Layout → CRC_EXTRA → Parser`.

### MAVLink 2 Payload Truncation

MAVLink 2, sondaki zero-filled payload byte'larını wire üzerinden göndermeyebilir; receiver eksik trailing byte'ları zero olarak yorumlamalıdır. Örnek: Defined Payload Size=36B, Wire Payload=28B, Trailing Zero Truncation=8B → `Valid MAVLink 2`.

### MAVLink Signing

MAVLink 2 opsiyonel mesaj imzalama sağlar — **authentication**, encryption değil. İmzalı frame'de incompat flag'in ilgili biti set edilir ve frame sonuna 13 byte signature eklenir (link ID, timestamp, truncated cryptographic signature). Toolkit `Verification: PASS` / `SIGNATURE INVALID` göstermeli; anahtar verilmediyse `Signature present / Verification unavailable` demelidir. **Secret key hiçbir zaman dış servise gönderilmemelidir.**

---

## MAVLink Message Decoder

Desteklenmesi istenen temel mesajlar: HEARTBEAT, SYS_STATUS, GPS_RAW_INT, ATTITUDE, GLOBAL_POSITION_INT, LOCAL_POSITION_NED, VFR_HUD, BATTERY_STATUS, COMMAND_LONG, COMMAND_ACK, PARAM_VALUE, HIGHRES_IMU. Bunlar ortak MAVLink XML definitions üzerinden decode edilmeli; **hard-coded field offset kullanılmamalı**, resmi dialect definition yüklenmelidir.

- **HEARTBEAT:** Vehicle presence/temel state takibi (System, Component, Vehicle Type, Autopilot, Base Mode, Custom Mode, System Status). Heartbeat üzerinden node presence: `ONLINE / DEGRADED / OFFLINE`.
- **ATTITUDE:** Roll/Pitch/Yaw ve Roll/Pitch/Yaw Rate grafikleri; açılar rad↔deg çevrilebilmeli.
- **GLOBAL_POSITION_INT:** Latitude, Longitude, Altitude, Relative Altitude, Velocity N/E/D, Heading → ortak NavigationData modeline aktarılır.
- **GPS_RAW_INT:** Fix Type, Lat/Lon/Alt, HDOP-benzeri belirsizlik, Velocity, Course, Satellite Count → navigation dashboard.
- **BATTERY_STATUS:** Voltage, Current, Remaining, Temperature, varsa Cell data → trend grafiği.

---

## MAVLink Command Transaction

Command ve acknowledgement mesajları birbirine bağlanmalıdır: GCS `COMMAND_LONG` → Vehicle `COMMAND_ACK`. Toolkit: Command, Target System, Target Component, Sent/ACK zaman damgaları, Result (Accepted), Response Time (örn. 24 ms) göstermeli. Timeout durumunda `COMMAND TIMEOUT` ve retry denemeleri (`Attempt 1`, `Attempt 2`, `ACK`) gruplanmalıdır.

## MAVLink Parameter Analyzer

Parameter trafiği `Parameter Request → PARAM_VALUE` (veya MAVLink 2 parameter microservice mesajları) ile izlenir. Alanlar: Parameter, Value, Type, Index, Count, Timestamp, Changed. Örnek: `RTL_ALT` Previous=1500 → Current=2000 → Change=+500.

## MAVLink Message Rate

Her message ID için: Rate, Period, Jitter, Count, Lost Estimate, Last Seen, Age. Örnek: ATTITUDE configured/observed 50 Hz, Average 49.8 Hz, Jitter ±1.2 ms.

## MAVLink Link Analyzer

Aynı vehicle'a Telemetry Radio, USB, UDP, TCP, Wi-Fi, Serial gibi birden fazla link üzerinden erişilebilir. Toolkit her link için Packet Rate, Packet Loss, Latency metadata'sı tutmalıdır. MAVLink 2 signing'deki link ID de multi-link mimariyle ilişkilidir.

---

## UAVCAN (isimlendirme uyarısı)

Bu başlık isimlendirme açısından özellikle dikkat gerektirir: Tarihsel **UAVCAN v0**, bugün **DroneCAN** adıyla sürdürülmektedir. **UAVCAN v1** geliştirme hattı ise **Cyphal** adıyla devam etmiştir (OpenCyphal güncel dokümantasyonunda `UAVCAN v0 aka DroneCAN` ifadesi kullanılır). Bu yüzden toolkit'te "UAVCAN" tek bir parser adı **olmamalıdır**; protocol selector açıkça `UAVCAN v0 / DroneCAN` ile `Cyphal v1.x` ayrımı yapmalı, auto-detection sonucu da `Legacy UAVCAN / DroneCAN candidate` veya `Cyphal/CAN candidate` şeklinde gösterilmelidir.

---

## DroneCAN

UAVCAN v0 tabanlı, UAV/robotics distributed embedded network'ler için CAN-based protokol. Tasarım hedefleri: masterless network, büyük transferlerin segmentation/reassembly'si, redundant interface desteği, düşük gecikme, düşük hesaplama yükü. Katman modeli: `Application Data → DSDL → DroneCAN Transfer → CAN Frame(s) → CAN 2.0B`. Yalnız **29-bit CAN identifier** kullanılır.

### Transfer Types
Üç tür: **Message** (broadcast), **Service Request**, **Service Response** (client↔server). Örnek: `Transfer Type: Message Broadcast` veya `Service: GetNodeInfo, Client: Node 10, Server: Node 42, Transfer ID: 7`.

### DroneCAN CAN ID (29-bit)
- **Broadcast (message):** Priority + Message Type ID + Message/Service indicator + Source Node ID.
- **Service:** Priority + Service Type ID + Request/Response + Destination Node ID + Service indicator + Source Node ID.

Exact bit width'ler resmi DroneCAN CAN transport specification'ında tanımlıdır. Toolkit raw CAN ID'yi (örn. `0x1ABCDEF0`) Priority/Transfer(Message)/Data Type ID/Source Node alanlarına ayırmalıdır.

### Node ID
1–127 aralığında; bazı değerler debugging araçlarına ayrılmıştır. Node explorer: Name, Hardware Version, Software Version, Health, Mode, Uptime.

### Tail Byte
CAN frame data alanının son byte'ı transport-layer metadata taşır:

| Bit | Anlam |
|---|---|
| 7 | Start Of Transfer (SOT) |
| 6 | End Of Transfer (EOT) |
| 5 | Toggle |
| 4:0 | Transfer ID (5 bit) |

Örnek: `0xC5` = `11000101` → SOT=1, EOT=1, Toggle=0, Transfer ID=5.

### Single-Frame / Multi-Frame Transfer
Single-frame: SOT=1, EOT=1, Toggle=0. Payload tek CAN frame'e sığmazsa multi-frame'e bölünür; toggle bit her frame'de değişir (alternates) — bu, duplication/order hatalarının tespitine yardımcı olur; ayrıca transfer başına bir **transfer CRC** kullanılır.

Örnek 4-frame transfer: Frame1 SOT=1/Toggle=0(START), Frame2 SOT=0/Toggle=1(CONTINUE), Frame3 Toggle=0(CONTINUE), Frame4 EOT=1(END); Toggle Sequence `0 1 0 1`; Transfer CRC PASS. Beklenen toggle ile alınan farklıysa: `TRANSFER ERROR – Unexpected Toggle Bit`.

### Transfer ID
5 bit (0–31), aynı logical transfer descriptor için artarak wrap eder (31→0 = `Valid wrap`).

### DSDL
DroneCAN veri yapıları **DSDL (Data Structure Description Language)** ile tanımlanır. Primitive tipler arbitrary bit width kullanabilir: `uintX, intX, bool, float16, float32, float64, arrays, nested types`; alanlar wire üzerinde bit-packed olabilir, implicit byte alignment zorunlu değildir. Import pipeline: `Data Type → DSDL Compiler/Parser → Bit Layout → Physical Fields`.

### Standard Message Categories
Namespace grupları: `protocol` (Node Status, Node Info, Parameters, File, Debug), `equipment` (ESC, GNSS, Air Data, ...), `navigation`, `debug`.

---

## Cyphal

UAVCAN v1 hattının devamı, modern distributed embedded communication protokolü. **Cyphal Specification v1.0 Mayıs 2025'te stable yayımlandı**; 2026 itibarıyla v1.1 geliştirme aşamasındadır ve henüz stable parser default'u kabul edilmemelidir. Toolkit: **Cyphal v1.0 stable default**, **Cyphal v1.1 yalnız explicit opt-in ile Experimental**.

### Transport Independence
Cyphal CAN'e bağlı değildir; resmi ekosistem Cyphal/CAN, Cyphal/UDP, Cyphal/serial destekler (serial = full-duplex byte stream, örn. TCP, RS-232/422, UART, USB CDC). Mimari: `Cyphal Presentation → Transfer → Transport Adapter → {CAN, UDP, Serial}`.

### Subject ve Service
Uygulama etkileşimleri **Publish/Subscribe Subjects** ve **Request/Response Services** ile organize edilir. Örnek node grafiği: Node 42 → Publishes(Heartbeat, Air Data, GNSS) / Subscribes(ESC Command) / Services(Register Access, ExecuteCommand).

### Heartbeat
Node heartbeat, temel operasyonel presence/health bilgisini taşır; resmi kılavuz her Cyphal node'un heartbeat yayınlamasını zorunlu temel davranış sayar. Alanlar: Node, Uptime, Health (Nominal), Mode (Operational), Last Heartbeat (örn. 120 ms önce). Offline tespiti: `HEARTBEAT TIMEOUT`.

### DSDL
Cyphal da DSDL tabanlı typed data model kullanır. Browser alanları: Namespace, Type, Version, Extent, Fields, Constants, Array Bounds, Serialization. Versiyonlama semantik korunmalı, örn. `uavcan.node.Heartbeat.1.0`.

### Network Graph
Örnek: Node 10 (Autopilot), Node 20 (GNSS), Node 30–33 (ESC 1–4). Graph edge örneği: `GNSS Position: Node 20 → Subject ... → Node 10`.

---

## DroneCAN / UAVCAN / Cyphal Ayırıcı

Kullanıcı açısından en büyük karışıklık kaynağı bu isimlendirmedir. Bilgi paneli: `UAVCAN v0 → DroneCAN` ve `UAVCAN v1 development line → Cyphal` şeklinde gösterilmelidir (güncel OpenCyphal dokümantasyonu DroneCAN'i "UAVCAN v0" legacy predecessor olarak tanımlar). Proje konfigürasyonunda belirsiz `Protocol: UAVCAN` seçeneği **kabul edilmemeli**; kullanıcıdan açıkça `DroneCAN / UAVCAN v0` veya `Cyphal v1.0` seçmesi istenmelidir.

---

## SBUS

Futaba'nın geliştirdiği S.BUS, bir receiver'ın çok sayıda RC channel bilgisini tek serial hat üzerinden servo/gyro/flight controller'a ilettiği bus yaklaşımıdır; tüm channel verisi aynı bus'ta taşınır, her S.BUS cihazı kendi atanmış channel'ını kullanır. Toolkit klasik flight-controller SBUS profili için **Legacy SBUS/FC profile** sağlamalıdır (Betaflight referansı).

### UART Profile
Baud 100000, Data 8, Parity Even, Stop 2, Signal Inverted by default. Konfigürasyon ekranında `UART Inversion Required: YES`, `Hardware Inverter: Detected/Unknown` alanları bulunmalı.

### Frame (25 byte)
`Start Byte(0x0F) | 22-byte packed channel data | Flags | End Byte`. 16 analog channel 11-bit packed formatta taşınır; flags byte signal-loss/failsafe bilgisi içerir. Görsel: `0F | CHANNEL DATA[22] | FLAGS | END`.

### Channel Packing
16 × 11 bit = 176 bit = 22 byte (Betaflight `sbusChannels_t`). Channel alanları byte sınırına hizalı **değildir** — bu yüzden `CH1 = Byte1+Byte2, CH2 = Byte3+Byte4` gibi yanlış (byte-aligned) decode yapılmamalıdır; bitstream üzerinden 11-bit kaydırmalı okuma gerekir.

### Flags
En az: Digital Channel 17, Digital Channel 18, Frame Lost, Failsafe (Betaflight'ta signal-loss ve failsafe-active ayrı bit'lerdir). Örnek: Signal Lost=YES, Failsafe=NO → `RC LINK DEGRADED` uyarısı.

### RC View
CH1 Roll 1502, CH2 Pitch 1498, CH3 Throttle 1005, CH4 Yaw 1501, CH5 Arm 1812 ... Görüntüleme modları: Raw, Normalized 0..1, Normalized -1..+1, µs-benzeri, Percentage. Mapping kullanıcı tarafından kalibre edilmeli; packed raw değerin doğrudan PWM mikrosaniye olduğu **varsayılmamalıdır**.

---

## IBUS

FlySky receiver ekosisteminin serial RC/telemetry bus ailesi. FlySky güncel receiver'ları i-BUS ve yeni **i-BUS2** (tek telli serial tree-topology, sensor/servo/diğer peripheral'lar için) destekler. Toolkit **FlySky i-BUS** ile **FlySky i-BUS2**'yi ayrı protokol ailesi olarak ele almalıdır (wire format ve davranış aynı değildir).

### Classic i-BUS RC Profile / Frame
FlySky'nin resmi AFHDS3 i-BUS duyurusu: 3.3V UART, 115200 baud, 8 data bit, 2 stop bit, no parity. Betaflight implementasyonu: 115200 baud, 32-byte serial RX packet. Frame yorumu: `Length | Command/Type | Channel Data | Checksum`; Betaflight'ta 32 byte'lık packet içinde 14 adet 2-byte channel slotu temel yapıdır, yeni receiver'larda önceden kullanılmayan üst bitlerle ek channel taşınabilir.

### Channel Decode
Byte görünümü: Byte2–3→CH1, Byte4–5→CH2, ... ancak exact bit masking seçilen i-BUS profile implementasyonuna göre yapılmalıdır.

### Checksum
Received vs Calculated checksum → PASS/FAIL; Betaflight'ta classic receiver packet'inde son iki byte received checksum'dır. Frame loss: Last Valid Frame süresine göre timeout tabanlı `SIGNAL LOST` durumu (örn. son geçerli frame 8 ms önce, mevcut 40 ms → SIGNAL LOST).

---

## CRSF — Crossfire Serial Protocol

Team BlackSheep'in RC receiver/radio transmitter/flight controller arasında kullandığı bidirectional, frame-tabanlı protokol (TBS resmi CRSF specification repo'su referans implementasyondur). Low-latency RC control, telemetry ve remote device configuration destekler.

### Default FC UART
TBS spesifikasyonuna göre default dual-wire bağlantı: **416666 baud**, 8N1, non-inverted, 3.0–3.3V sınıfı; daha yüksek baud'a negotiation yapılabilir. Bazı FC implementasyonları **420000 baud** nominal değerini kullanır. Toolkit preset: `CRSF Standard: 416666`, `CRSF FC Compatibility: 420000`, `CRSF v3: Negotiated Baud`.

### Frame
`DEVICE ADDRESS | FRAME LENGTH | TYPE | PAYLOAD | CRC` — Betaflight aynı modeli kullanır, maksimum frame boyutu **64 byte**. Görsel: `C8 | 18 | 16 | PAYLOAD... | CRC` → ADR LEN TYPE DATA CRC.

### Extended Frame
Extended frame'lerde Destination/Source bilgisi payload/header extension içinde bulunabilir (örn. Destination: Flight Controller, Source: Receiver).

### RC Channels
Konvansiyonel channel packet 16 channel'ı packed taşır: Betaflight'ta 16 × 11-bit = 176-bit channel payload (CH1..CH16, her biri 11 bit).

### Telemetry
TBS spesifikasyonu çok sayıda telemetry frame tipi tanımlar: GNSS, battery, barometric altitude, airspeed, RPM, temperature, link statistics. Toolkit kategorileri: RC Control, Link Statistics, GPS, Battery, Vario, Airspeed, RPM, Temperature, Device Info, Configuration.

### Link Statistics
Uplink RSSI/LQ/SNR, Downlink RSSI/LQ, RF Mode, TX Power, Antenna; zaman/RSSI/LQ/SNR trendi uçuş loguyla korelasyon kurulabilmeli. Örnek zaman çizelgesi: 12:00:32 LQ düşmeye başlar → 12:00:34 RSSI düşük → 12:00:35 RC failsafe.

### CRC
Received/Calculated CRC → PASS/FAIL. Extended komutlarda komut-özel ek CRC yapıları olabileceğinden **frame CRC ile command CRC ayrı tutulmalıdır** (örnek: Betaflight bind-command implementasyonu).

### Baud Negotiation
CRSF v3'te receiver ve FC daha yüksek baud'da anlaşabilir: standard baud ile başla → speed request → FC accept/reject → kabul edilirse iki taraf yeni baud'a geçer. Zaman çizelgesi: `416666 → Speed Proposal(2,000,000) → Accepted → Guard Time → Switch → 2,000,000`. Switch sırasında hata: `BAUD NEGOTIATION FAILED`.

---

## PPM — Pulse Position Modulation

Birden fazla RC channel'ın tek pulse train içinde time-domain kodlandığı legacy/kompakt kontrol sinyali. **Tek bir evrensel pulse-width mapping varsayılmamalı**; kullanıcı Channel Count, Frame Period, Minimum/Center/Maximum Pulse, Sync Gap, Polarity tanımlamalıdır. Kavramsal waveform: `|CH1| gap |CH2| gap |CH3| gap |CH4| ... |SYNC GAP|` (veya implementasyona göre pulse-to-pulse interval). Pulse capture edge'lerinden (örn. 0µs, 1502µs, 3001µs...) channel süreleri hesaplanır (CH1=1502µs, CH2=1499µs...).

### Normalization
Kalibrasyon örneği Min=1000µs/Center=1500µs/Max=2000µs için:

```
x = (Pulse − Center) / (Maximum − Center)      [pozitif taraf]
```

negatif tarafta uygun minimum-center aralığı kullanılır. Örnek: Pulse=1750µs → Normalized=+0.5. Bu **preset örneğidir**, protokol standardı olarak hard-code edilmemelidir.

### Frame Detection
Normal Channel Gap vs Sync Gap ayrımıyla frame başlangıcı bulunur. State machine: `SEARCH_SYNC → READ_CH1 → READ_CH2 → ... → FRAME_COMPLETE`. Hatalar: Missing Sync, Too Many Channels, Too Few Channels, Pulse Out Of Range, Frame Period Error, Jitter Excessive, Signal Timeout.

---

## PWM Servo Frame Analizi

Geleneksel RC aktüatör kontrolü için per-channel pulse sinyali. PPM'den farkı: PPM → tek hatta birden fazla channel; PWM servo → genellikle her channel için ayrı sinyal. Toolkit yalnız HIGH time değil Pulse Width, Frame Period, Frequency, Duty Cycle, Jitter, Missing Pulse analiz etmelidir.

### Hesaplar

```
Frequency = 1 / Period
DutyCycle = (PulseWidth / Period) × 100
```

Örnek: Period=20ms, Pulse=1.5ms → f=50Hz, Duty=7.5%. (Bu örnek bir konfigürasyondur; digital/high-speed servolar farklı refresh rate ve pulse aralığı kullanabilir.)

### Servo Position Normalization / Jitter
Kalibrasyon Min=1000µs/Center=1500µs/Max=2000µs → 1000→-100%, 1500→0%, 2000→+100%. Multi-channel view örneği: Servo1=1501µs, Servo2=1230µs, Servo3=1782µs, Servo4=1500µs. Jitter örneği (1498,1502,1501,1497,1503µs) → Mean=1500.2µs, Peak-to-Peak=6µs, Standard Deviation hesaplanmalı.

---

## ARINC 429 — Temel Word Decoder

Sivil havacılıkta guidance/navigation, flight control, flight data ve communication sistemleri arasında kullanılan yaygın avionics data bus standardı. Holt gibi ARINC 429 IC üreticileri 32-bit word processing, label recognition, parity ve bağımsız transmitter/receiver data rate'lerini donanımda uygular. Toolkit ilk sürümde analog ARINC waveform capture zorunda değildir; girdi: 32-bit raw word, HEX log, CSV log, adapter log olabilir.

### ARINC 429 Word (32 bit)
Alanlar: **Label, SDI, Data, SSM, Parity**. Ek desteklenmesi istenenler: Octal label, BNR, BCD, Discrete, Signed, Scale, Parity validation. Bit tree: `ARINC Word → {Label, SDI, Data, SSM, Parity}`. Holt'un güncel ARINC 429 arayüzleri word'leri 32-bit olarak buffer/FIFO'da işler, parity sonucunu 32. bit ile ilişkilendirir.

- **Label:** Binary/Octal/Decimal gösterilebilmeli (örn. Octal 203 → Database Name: Altitude/example profile). Anlamı equipment ICD'sine bağlıdır — **global olarak aynı anlamı taşıdığı varsayılmamalıdır**.
- **SDI (Source/Destination Identifier):** 2-bit değer (00/01/10/11); configured equipment mapping varsa semantik isim verilebilir (örn. SDI 01 → IRS #1).
- **Data Field:** BNR, BCD, Discrete, Custom formatlarında yorumlanır.
  - **BNR:** `Physical = RawSigned × Resolution` (+ profile offset/range kuralları). Örnek: Raw=12345, Resolution=0.1ft → Physical=1234.5ft.
  - **BCD:** Digit 1..4... extraction.
  - **Discrete:** Bit-bazlı ICD mapping (örn. Bit11=Landing Gear Down, Bit12=Warning, Bit13=Valid).
- **SSM (Sign/Status Matrix):** Anlamı data encoding türüne bağlıdır (örn. BNR encoding altında farklı SSM anlamı); seçilen data-format kuralına göre decode edilmelidir.
- **Parity:** Word parity kontrolü yapılır (Odd/Valid → PASS, aksi `PARITY ERROR`); ARINC 429 terminal IC'leri parity generation/checking'i donanım seviyesinde destekler.

### Rate Analyzer
Holt terminal implementasyonları seçilebilir data-rate handling ve receiver oversampling sunar. Capture metadata'dan çıkarılacaklar: Word Rate, Inter-word Gap, Label Rate, Label Jitter, Missing Label. Örnek: Label 203, Expected 20 Hz, Observed 19.96 Hz, Last Seen 12 ms.

---

## MIL-STD-1553 — Log Tabanlı Temel Decoder

Aktif ABD askeri arayüz standardı: **Digital Time Division Command/Response Multiplex Data Bus**. DLA ASSIST veritabanında 2026 itibarıyla aktif görünür; kapsamı bus line, interface electronics, concept of operation, information flow, elektriksel/fonksiyonel formatlardır. Toolkit ilk aşamada analog Manchester waveform acquisition zorunda değildir; girdiler: bus analyzer log, CSV, TXT, vendor adapter export, raw decoded word list.

### Roller
**Bus Controller (BC)**, **Remote Terminal (RT)**, **Bus Monitor (BM — passive)**. Network diyagramı: BC ══ BUS ══ (RT1, RT2, RT3), BM pasif izler.

### Word Types
- **Command Word:** RT Address, Transmit/Receive, Subaddress/Mode, Word Count/Mode Code, Parity.
- **Status Word:** RT Address, Status Flags, Message Error, Service Request, Subsystem Flags, Terminal Flags, Parity.
- **Data Word:** 16-bit Data, Parity (+ yüklenen ICD varsa engineering field'a çevrilir).

Exact field'lar seçilen MIL-STD-1553 standard revizyonuna göre decode edilmelidir.

### Transaction Types
- **BC→RT:** Command Word → Data Word(ler) → RT Status Word.
- **RT→BC:** BC Command → RT Status → RT Data (ler).
- **RT-to-RT:** BC Receive Command→Destination RT, BC Transmit Command→Source RT, Source Status, Data..., Destination Status.

Timeline görünümü özellikle önemlidir.

### RT/Subaddress Explorer
Örnek ağaç: RT01→(SA01,SA02,SA05), RT02→(SA03,SA10). Her RT/subaddress için: Message Count, Word Count, Rate, Error, Last Seen.

### Mode Codes
Mode komutları data transferinden ayrılmalı: Mode Command, Code, Broadcast, Data Word Present, Response. Exact mode-code veritabanı aktif standard revizyonundan yüklenmelidir.

### Redundant Bus A/B
Sistemler Bus A/Bus B redundancy kullanabilir; toolkit iki bus capture'ını karşılaştırmalı (örn. RT4/SA2: Bus A PASS, Bus B "No traffic" → `REDUNDANCY WARNING`).

### Timing Analyzer
Her transaction için: Command Time, Response Time, Inter-word Gap, Transaction Duration, Bus Utilization (örn. RT Response 8.2µs vs Configured Limit → PASS). Exact kabul limitleri seçilen standard/profile/ICD konfigürasyonundan alınır.

---

## ADS-B

**Automatic Dependent Surveillance–Broadcast** — uçağın kendi navigation solution'ını ve surveillance bilgisini broadcast etmesi prensibi. FAA'ya göre onboard avionics GNSS/navigation source ile pozisyonu belirler ve pozisyon + ek bilgiyi ground/diğer kullanıcılara yayınlar. ABD'de iki ana ADS-B data-link: **1090 MHz Extended Squitter (1090ES)** ve **978 MHz UAT**. Toolkit bu ikisini ayrı parser olarak ele almalı; ilk kapsam olarak **1090ES/Mode S**'e odaklanılabilir.

### Source Pipeline
`RF Capture/Receiver → Mode S/UAT Demodulator → Binary Frame → CRC → ADS-B Message → Aircraft State`. Toolkit'in doğrudan SDR demodulator olması gerekmez; girdi: raw hex, Beast binary, SBS/BaseStation log, dump1090 JSON, PCAP/custom receiver export olabilir.

### Aircraft Table
Alanlar: ICAO, Callsign, Altitude, Speed, Heading, Lat, Lon + her target için Last Seen, Message Count, Position/Velocity/Callsign Age, CRC State, Source Receiver, varsa RSSI.

### 1090ES
FAA, 1090 MHz Mode S transponder'ın ADS-B işlevselliğiyle genişletilmiş mesajlarını **Extended Squitter (1090ES)** olarak tanımlar. Mode S/ADS-B detaylı mesaj formatı için otoriter referans **ICAO Doc 9871**'dir (Mode S servisleri, transponder register'ları, extended-squitter format/protokolleri); toolkit'in mesaj-tanım veritabanı revizyon metadata'sı taşımalıdır.

---

## Mode-S

Secondary surveillance transponder haberleşme ailesi. Toolkit ADS-B ile Mode S'i **aynı şey saymamalıdır**: Mode S → birçok downlink/uplink format; ADS-B 1090ES → Mode S Extended Squitter'ı kullanır (FAA de Mode S transponder capability'yi Mode S+Extended Squitter ADS-B capability'den ayrı sınıflandırır).

### Message Length / DF
Mode S short ve extended frame sınıfları içerir. FlightAware `dump1090` decoder'ı DF0/4/5/11/16/20/21/17 gibi downlink format'ları işler, 24-bit CRC tabanlı doğrulama uygular. Parser Short/Extended Mode S ayrımı yapmalı; ortak alanlar: DF, ICAO, Payload, Parity/CRC. İlk bit'ler mesajın **DF (Downlink Format)** tipini belirler — örn. DF11 (all-call reply), DF17 (Extended Squitter/ADS-B candidate), DF4 (altitude reply)... dump1090 özellikle DF11 ve DF17'ye odaklanır.

### DF17 — ADS-B Extended Squitter
Alanlara ayrım: DF, Capability, ICAO Address, Extended Squitter Message, Parity → sonra ADS-B payload decoder: Type Code, Subtype, Aircraft Identification, Position, Velocity, Altitude, Status. Exact type-code alan tahsisi ICAO/DO-260 revizyon veritabanına bağlı tutulmalıdır.

### ICAO Address
24-bit uçak adresi (örn. `ABC123`) target-tracking key'idir; **ICAO Address ile Callsign/Registration/Flight Number karıştırılmamalıdır**.

### CRC/Parity
24-bit parity/CRC ile mesaj bütünlüğü doğrulanır (FlightAware decoder error checking/correction seçenekleri sağlar). Optional correction engine örneği: `Original: CRC FAIL → Candidate Correction: Bit 42 → Corrected: CRC PASS, Confidence: Low/Corrected`. **Corrected mesaj hiçbir zaman native-valid frame ile aynı confidence seviyesinde gösterilmemelidir.**

### Position (CPR)
Decode edilen pozisyon: Latitude, Longitude, Altitude, Position source age. **Compact Position Reporting** kullanıldığında ara veri de gösterilebilir: CPR Format (Even/Odd), Raw Latitude/Longitude, Reference/Pair. FlightAware-tarzı decoder'lar CPR position decoding uygular.

### Target Age
Farklı bilgi türleri farklı zamanlarda gelir; Position/Altitude/Velocity/Identification/Status Age **ayrı tutulmalıdır**. Örnek: ABC123 → Position 0.4s, Velocity 1.1s, Callsign 18s (old).

---

## GPS UBX — Havacılık Kullanım Görünümü

UBX parser 3.2/3.5 bölümlerindeki **aynı core**'u kullanır — protokol burada tekrar yazılmaz, üzerine **flight navigation view** eklenir: `UBX → GNSS Solution → Flight Navigation`. Alanlar: Fix Type, Latitude, Longitude, MSL Altitude, Ellipsoid Altitude, Ground Speed, Heading, Vertical Velocity, Position/Velocity/Time Accuracy, Satellite Count → ortak flight state'e çevrilir.

### GNSS Cross-Check
Aynı flight controller'da UBX, MAVLink GPS_RAW_INT, RTCM status, NMEA aynı GNSS zincirinin farklı seviyeleri olabilir; karşılaştırılmalıdır. Örnek: UBX Fix3D/Sat18 vs MAVLink Fix3D/Sat18 → Difference 0.

## RTCM — UAV/RTK Kullanımı

RTCM decoder 3.5 bölümündeki ortak engine'i kullanır. UAV-özel katman: `RTCM Correction → GNSS Rover → RTK Float/Fixed → Flight Controller`. Alanlar: RTCM Message Rate, Correction Age, Reference Station, GNSS Constellation, CRC, Last Received. Correction link loss örneği: RTCM Last Received 7.2s, RTK State FLOAT (Previous: FIXED) → timeline korelasyonu yapılabilir.

## NMEA — Havacılık Kullanımı

NMEA parser 3.5'teki ortak engine'i kullanır. UAV katmanı: `NMEA GNSS → Position/Velocity/Time → Flight Controller`. Message rate örneği: GGA 5Hz, RMC 5Hz (FC navigation loop'uyla karşılaştırılır). NMEA/UBX Compare: aynı receiver çıktılarının tutarlılığı (örnek fark 0.3 m).

---

## RC Input Protocol Auto-Detection

Toolkit RC input analyzer SBUS/IBUS/CRSF/PPM/PWM aday tespiti yapabilir. Örnekler:
- Serial 100000/Even/2-Stop/Inverted, gözlem: `0x0F` start + 25-byte tekrar eden frame → Candidate **SBUS**, Confidence **HIGH** (Betaflight parser profiliyle uyumlu).
- Serial 115200, 32-byte frame → Candidate **FlySky i-BUS**.
- ~416666/420000 baud, frame `Address+Length+Type+Payload+CRC` → Candidate **CRSF**.

## RC Failsafe Analyzer

Tüm RC protokolleri ortak state modeline bağlanır: `NORMAL → DEGRADED → FRAME_LOSS → FAILSAFE → SIGNAL_LOST → RECOVERING`. Örnek zaman çizelgesi: LQ 100%→60%→Lost Frames→Failsafe→Signal Recovered. Flight Control Correlation örneği: 12:10:00.000 RC LQ düşer → 12:10:00.300 RC Failsafe → 12:10:00.320 Flight Mode→RTL → 12:10:00.350 Throttle komutu değişir — aynı zaman çizelgesinde gösterilmelidir.

---

## Common Flight State Model

MAVLink, DroneCAN/Cyphal, UBX ve diğer telemetri kaynakları ortak veri modeline dönüştürülür:

```
FlightState
├─ Attitude (Roll, Pitch, Yaw)
├─ AngularRate
├─ Position
├─ Velocity
├─ Acceleration
├─ Altitude
├─ Airspeed
├─ GroundSpeed
├─ GNSS
├─ Battery
├─ Motors
├─ RC
└─ VehicleStatus
```

Bu sayede MAVLink Yaw vs DroneCAN Attitude vs ARINC Heading aynı grafik üzerinde karşılaştırılabilir.

## Coordinate Frame Analyzer

Aerospace protokolleri farklı coordinate frame kullanabilir: **NED, ENU, Body FRD, Body FLU, ECEF, Geodetic**. Toolkit frame metadata'sı olmadan vektörleri karşılaştırmamalıdır — örn. Velocity [10,2,-1] Frame:NED ile Velocity [10,-2,1] Frame:ENU **doğrudan aynı kabul edilemez**. Bilinen transform varsa: `v_B = R_BA · v_A`. UI: Source Frame → Target Frame → Converted değer.

## Attitude Unit / Convention Analyzer

Desteklenen gösterimler: Euler (Roll/Pitch/Yaw), Quaternion (w,x,y,z), Rotation Matrix. Quaternion norm kontrolü:

```
||q|| = √(w² + x² + y² + z²)      beklenen: ||q|| ≈ 1
```

Örnek: Quaternion Norm=0.998 → Status OK.

## Flight Message Freshness

Her telemetri değeri Last Update, Expected Rate, Age, Validity bilgisi taşımalıdır:

```
Age = t_now − t_last
```

Örnek: Attitude Age 8ms→FRESH, GNSS Age 180ms→FRESH, Airspeed Age 3.4s→STALE.

## Multi-Protocol Time Correlation

Farklı hızlardaki kaynaklar (örn. MAVLink ATTITUDE 50Hz, DroneCAN ESC Status 20Hz, CRSF RC 150Hz, UBX GNSS 10Hz) aynı zaman çizelgesinde normalize edilebilmelidir. Toolkit Host Timestamp, Protocol Timestamp, Sensor Timestamp, GNSS UTC kaynaklarını birbirinden ayırmalıdır.

## Flight Latency Analyzer

Komut pipeline'ı: `RC Stick → CRSF → Flight Controller → Control Output → Servo/ESC`; yakalanabiliyorsa uçtan uca gecikme yaklaşık ölçülebilir. Örnek: RC channel change t=0 → FC output change t=2.3ms → Servo PWM change t=4.1ms. Toolkit RX→FC Latency, FC Processing, FC→Actuator Latency, Total göstermeli; bu değerler capture timestamp doğruluğuna bağlı olduğundan **belirsizlik (uncertainty) de belirtilmelidir**.

## Protocol Bridge Analyzer

Örnek: `DroneCAN GNSS → Flight Controller → MAVLink GPS_RAW_INT`; Input/Output/Latency (örn. 4.3ms)/Position Difference (örn. 0.07m) gösterilir. Diğer örnekler: `CRSF RC → FC → MAVLink RC_CHANNELS`, `UBX → FC → MAVLink GPS_RAW_INT`.

## Avionics Bus Source Database

ARINC 429 ve MIL-STD-1553'te raw frame tek başına engineering meaning için yeterli değildir. Proje veritabanı:
- **ARINC:** Channel, Label, SDI, Encoding, Scale, Unit, Equipment.
- **MIL-STD-1553:** Bus, RT, Subaddress, Direction, Word Count, ICD Mapping.

Import: CSV, JSON, Custom schema.

---

## Ortak Havacılık Hata Modeli

Desteklenmesi istenen hata/uyarı sınıfları:

`CRC_ERROR, CHECKSUM_ERROR, SIGNATURE_INVALID, UNKNOWN_MESSAGE, UNKNOWN_DIALECT, SEQUENCE_GAP, PACKET_LOSS, TRANSFER_ID_ERROR, TOGGLE_ERROR, MULTIFRAME_INCOMPLETE, NODE_OFFLINE, HEARTBEAT_TIMEOUT, INVALID_RC_FRAME, RC_FRAME_LOST, RC_FAILSAFE, GNSS_FIX_LOST, RTCM_TIMEOUT, TELEMETRY_STALE, COMMAND_TIMEOUT, COMMAND_REJECTED, PARAMETER_TIMEOUT, ARINC_PARITY_ERROR, UNKNOWN_ARINC_LABEL, MIL1553_PARITY_ERROR, MIL1553_RESPONSE_TIMEOUT, ADS_B_CRC_ERROR, ADS_B_POSITION_STALE, SOURCE_DISAGREEMENT, RATE_OUT_OF_RANGE, EXCESSIVE_JITTER`

Her hata şu bilgiyi taşımalıdır: Protocol, Timestamp, Source, Message, Field, Expected, Received, Severity, Possible Cause.

---

## Aerospace System Graph

Kullanıcı sistemi node graph olarak kurabilmelidir. Örnek küçük sistem:

```
                 ┌── GNSS UBX
                  │
RC ─ CRSF ─ Flight Controller ─ MAVLink ─ GCS
                  │
                  ├── DroneCAN ─ ESC 1, ESC 2, ESC 3, ESC 4
                  │
                  └── PWM ─ Servo
```

Daha büyük uçak örneği:

```
Mission Computer
├── ARINC 429 → Navigation Equipment
├── MIL-STD-1553 → Avionics RT
├── Ethernet → EO Payload
└── MAVLink → Flight Controller
```

Her bağlantı: Protocol, Bit Rate, Message Rate, Health, Errors, Last Activity gösterir.

## Ortak Aerospace Layer Drill-Down

Kullanıcı bir flight parametresine tıklayınca raw source'a kadar inebilmelidir:

- **MAVLink:** Roll 12.4° → ATTITUDE → Payload Field → MAVLink 2 Packet → UART/UDP.
- **DroneCAN:** ESC RPM 5200rpm → DroneCAN ESC Status → DSDL Field → Transfer → CAN Frame → 29-bit CAN ID.
- **CRSF:** Throttle 63% → RC Channel 3 → 11-bit packed channel → CRSF RC Frame → UART.
- **ARINC 429:** Altitude 12500ft → BNR → Data Field → Label → 32-bit ARINC Word.
- **MIL-STD-1553:** Sensor Value → ICD Field → Data Word → RT/Subaddress Transaction → Bus A/B.
- **ADS-B:** Aircraft Position → ADS-B Message → Extended Squitter → Mode S Frame → 1090 MHz Receiver.
- **GNSS:** Position → UBX Navigation Message → UART.

**Bölümün amacı** yalnız "MAVLink decoder + RC channel viewer" olmak değildir. Amaç: RC kumanda girişinden flight controller telemetrisine, distributed CAN avionics ağından GNSS correction stream'ine, ARINC/MIL bus'larından ADS-B surveillance mesajlarına kadar uçuş sistemindeki haberleşmeyi **tek bir zaman çizelgesinde ve bit/field/application seviyelerinde** inceleyebilen bütünleşik bir **aerospace communication analyzer** oluşturmaktır.

---

## Dikkat çekenler

- **"UAVCAN" tuzağı:** Kaynak, tek bir "UAVCAN" parser'ının kabul edilemez olduğunu özellikle vurguluyor — UAVCAN v0 = DroneCAN, UAVCAN v1 hattı = Cyphal. Proje konfigürasyonunda belirsiz `Protocol: UAVCAN` seçeneği açıkça yasaklanmış.
- **Cyphal versiyon durumu somut tarihli:** v1.0 Mayıs 2025'te stable; v1.1 2026 itibarıyla hâlâ deneysel — toolkit v1.0'ı default, v1.1'i yalnız opt-in yapmalı.
- **SBUS bit-packing tuzağı açıkça uyarılıyor:** 11-bit channel alanları byte sınırına hizalı değil; `CH1=Byte1+Byte2` gibi naif byte-aligned decode kaynakta açıkça "yanlış" olarak işaretlenmiş.
- **MAVLink 2 payload truncation:** Trailing zero byte'ların wire'da hiç gönderilmeyebileceği ve bunun geçerli bir MAVLink 2 paketi sayıldığı — kolayca gözden kaçacak bir parser detayı.
- **MAVLink CRC_EXTRA çifte amaçlı:** Yalnız bit hatası değil, gönderici/alıcı dialect uyuşmazlığını da yakalıyor; toolkit hata mesajında "wrong dialect / wrong message definition" gibi nedenleri ayrı ayrı listelemeli.
- **Mode-S CRC-correction güven seviyesi:** Bit-düzeltilmiş bir ADS-B mesajının native-valid mesajla **asla aynı confidence'ta gösterilmemesi** gerektiği özellikle vurgulanmış — sahte kesinlik riskine karşı bir tasarım kısıtı.
- **Coordinate frame karıştırma riski:** Aynı sayısal vektörün NED ile ENU'da işaret farkı taşıyabileceği örnekle gösterilmiş (`[10,2,-1]` NED ≠ `[10,-2,1]` ENU); frame metadata'sız vektör karşılaştırması açıkça yasaklanmış.
- **DroneCAN/Cyphal tail-byte toggle mekanizması:** Multi-frame transfer'de toggle bit + transfer CRC birlikte duplication/sıra hatalarını yakalıyor; 5-bit Transfer ID'nin 31→0 wrap'i "geçerli" sayılıyor, hataya karşı ayrım gerektiriyor.
- **Bütün RC protokolleri tek failsafe state machine'ine indirgeniyor** (NORMAL→...→RECOVERING) ve flight-mode değişimiyle (örn. RTL) korele ediliyor — protokol-agnostik ortak analiz felsefesinin en somut örneği.
- **Belirsizlik disiplini tutarlı bir tema:** Latency ölçümlerinde "capture timestamp accuracy'ye bağlı olduğundan uncertainty belirtilmeli", ARINC/MIL-STD-1553'te "exact bit width/field'lar seçilen resmi standard revizyonundan yüklenmeli" gibi ifadelerle kaynak, sabit/hard-code değerler yerine sürüm/ICD-bağımlı doğrulamayı sistematik olarak talep ediyor.
