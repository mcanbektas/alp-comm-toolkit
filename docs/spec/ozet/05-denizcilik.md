# 3.5 Denizcilik

Kaynak satır aralığı: 14139–17071 (orijinal belgede "3.5 Denizcilik" bölümü; 17073'te başlayan "3.6 Havacılık ve insansız sistem protokolleri" bu özetin dışındadır).

## NMEA 0183

Text tabanlı seri haberleşme standardı. Güncel yayımlanmış sürüm **NMEA 0183 Version 4.30**. Temel bus 4800 baud; **NMEA 0183-HS** 38.4 kbaud yüksek hızlı varyanttır. Her bus'ta tek talker, birden fazla listener; veri printable ASCII. IEC tarafındaki güncel karşılığı **IEC 61162-1:2024** (single-talker/multiple-listener, printable ASCII).

**Genel sentence yapısı:** `$TALKER,FIELD1,FIELD2,...*CHECKSUM`

Örnek: `$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47`

Toolkit bunu Start(`$`) / Talker(`GP`) / Sentence Formatter(`GGA`) olarak ayrıştırmalı.

**Talker ID:** `GP` historical GPS talker'ı temsil eder. NMEA 0183 v4.30, GNSS sentence ailesini GPS, GLONASS, Galileo, BeiDou, QZSS, NavIC ve diğer modern sistemleri kapsayacak şekilde genişletmiştir. Talker yalnız text değil, semantik gösterilmeli: Talker `GP` → Category `GNSS` → Interpretation "GPS-related talker".

**Desteklenecek temel Sentence Formatter grubu** (belgede tanımlı): GGA, RMC, GSA, GSV, VTG, HDT, HDG, DPT, DBT, MWV, ROT, VHW, VLW, XDR, MTW, ZDA, GLL, RSA.

Tam field tanımları **selected NMEA 0183 revision database** üzerinden gelmeli — NMEA, internetteki sentence açıklamalarının çoğunun eski/yanlış olabileceğini açıkça belirtir; toolkit rastgele internet tablolarına bağımlı olmamalı.

### Checksum

`$` ile `*` arasındaki karakterlerin XOR'u:

`Checksum = C1 ⊕ C2 ⊕ ... ⊕ Cn`

Örnek: `$GPGGA,...*47` → Received `0x47`, Calculated `0x47` → Checksum **PASS**.

Character-level: G=0x47, P=0x50, G=0x47, G=0x47, A=0x41, `,`=0x2C, ...

Her XOR adımı isteğe bağlı açılabilmeli (checksum eğitimi ve custom sentence debug için):
`Initial=00 → 00 XOR 47=47 → 47 XOR 50=17 → 17 XOR 47=50 → ... → Final=47`

### Coordinate conversion

`DecimalDegrees = Degrees + (Minutes / 60)`; South ve West negatif.

Örnek `4807.038,N`: Degrees=48, Minutes=07.038 → `Latitude = 48 + 7.038/60 = 48.1173°`
Örnek `01131.000,E`: Degrees=11, Minutes=31 → `Longitude = 11 + 31/60 = 11.5166667°`

Toolkit aynı alanı Raw (`4807.038,N`) / Degrees-Minutes (`48° 07.038' N`) / Decimal (`48.117300°`) / Radians olarak gösterebilmeli.

### Sentence decoder

GGA örneği loaded revision database doğrultusunda: Sentence GGA, Talker GP, UTC 12:35:19, Latitude 48.117300°, Longitude 11.516667°, Fix Quality, Satellite Count 8, HDOP 0.9, Altitude 545.4 m, Checksum PASS.

**Raw/parsed sync:** Kullanıcı `545.4` field'ına tıklayınca raw sentence içinde `...,0.9,[545.4],M,...` highlight edilmeli.

### Sentence frequency

Her sentence formatter için: Count, Expected period, Average period, Minimum, Maximum, Jitter, Last received, Age. Örnek GGA: Average 1.001 s, Expected 1.000 s, Jitter ±8 ms, Last 43 ms ago, State Fresh.

**Stale data:** HDT normalde düzenli gelirken Last Update 4.8 s ago ise → **STALE DATA** uyarısı.

### Source conflict

Aynı veri birden fazla talker'dan gelebilir (GPS1→RMC, GPS2→RMC, INS→RMC). Toolkit karşılaştırmalı tablo göstermeli: Source / Latitude / Age.

---

## NMEA 2000

CAN tabanlı, multi-master, self-configuring marine network standardı; merkezi network controller gerektirmez. Güncel sürüm **NMEA 2000 Version 3.000**. IEC 61162-3, NMEA 2000'in CAN teknolojisini kullanan serial-data instrument network olarak SOLAS vessels uygulamasını ele alır.

**Katman:** NMEA 2000 Application → PGN/Network Management → 29-bit CAN Identifier → CAN Data Link → NMEA 2000 Physical Network.

Toolkit mesajı yalnız `CAN ID = 0x...` göstermemeli; Priority / PGN / Source Address / Destination alanlarına ayırmalı. Hedeflenen alanlar: PGN, Source address, Destination, Priority, Fast packet, Single frame, Multi-packet, Device instance, Manufacturer code, Product information.

### PGN (Parameter Group Number)

Application message türünü temsil eder. NMEA'nın resmi PGN suite'i şu veri sınıflarını kapsar: GNSS, Navigation, AIS & DSC, Battery Management, Combustion Engines, Electric Propulsion, Environment, Alerts, Windlass, HVAC, Lighting.

PGN browser metadata: PGN, Name, Category, Priority, Length, Transmission Type, Source, Destination, Period, Fields. Tam proprietary/licensed PGN field database, lisanslı NMEA database'i veya uygun import paketi üzerinden yüklenmeli.

### 29-bit identifier

CAN/J1939 benzeri 29-bit identifier analiz modeli: CAN ID, Priority, PGN, Source, Destination.

Bit görünümü:
```
28      26 25 24 23        16 15        8 7         0
+---------+--+--+------------+-----------+-----------+
|Priority |R |DP|     PF     |    PS     |    SA     |
+---------+--+--+------------+-----------+-----------+
```
J1939 benzeri extraction engine ortak kullanılabilir, ancak NMEA 2000 PGN database'i ve network behaviour kendi protocol module'unda tutulmalı.

### Single frame / multi-frame

Kısa mesaj: CAN Frame → doğrudan Complete NMEA Message. Uzun application mesajlarında transport/reassembly gerekir. Ayrım: Fast Packet / Single Frame / Multi-packet.

**Fast Packet reassembly:** CAN Frame 1 (Sequence, Frame Index 0, Total Length, Payload part) → Frame 2 (Index 1, payload) → Frame 3 (Index 2, payload) → Complete PGN Payload. Reassembly ekranı: PGN, Expected Length, Received (örn. 24/32 bytes), Fragments (4/5), State WAITING.

**Sequence error:** Expected Fragment 3, Received 4 → `FAST PACKET ERROR — Missing fragment 3`.

### Device discovery

Network'teki cihazlar tabloda: Source / Manufacturer / Device Class / Function (örn. 12–Navigation–GNSS, 21–Instrument–Display, 35–Engine–ECU). NMEA, certified NMEA 2000 ürünleri için class/function code ve network identity mekanizmalarını standardın parçası olarak yönetir. Toolkit alanları: Address, Manufacturer, Product, Serial, Device Class, Device Function, Device Instance, System Instance — bilinen network management PGN'lerinden türetilmeli.

**Address changes:** Self-configuring olduğundan source address sabit identity değildir. Toolkit Device NAME altında Old SA (35) → New SA (48) değişimini aynı logical device olarak takip etmeli.

### PGN frequency analysis

Örnek Heading PGN: Period 100 ms, Average 100.3 ms, Jitter ±1.4 ms, Missing 0.

### NMEA 2000 signal dashboard

PGN database yüklüyse: **Navigation** (Position, Heading, COG/SOG, Depth, Wind), **Propulsion** (Engine RPM, Oil Pressure, Coolant Temperature, Fuel Rate), **Electrical** (Battery Voltage, Battery Current, State).

---

## IEC 61162 Temel Mesaj Analizi

IEC 61162, denizcilik navigation/radiocommunication ekipmanları arası dijital arayüzler için geniş uluslararası standart ailesidir. Toolkit tek protokol gibi göstermemeli; en az şu aileleri ayırmalı: **IEC 61162-1, -2, -3, -450, -460**.

- **IEC 61162-1** (Edition 6, **IEC 61162-1:2024**): single talker/multiple listeners, printable ASCII, düşük hızlı sentence communication; NMEA 0183 ile kavramsal olarak güçlü bağlantılı. Toolkit: Transport Profile IEC 61162-1, Encoding ASCII, Talker Single, Listeners Multiple.
- **IEC 61162-2** (**IEC 61162-2:2024**): single talker/multiple listener, high-speed serial transmission; approved/proprietary sentence'ları printable ASCII taşır, repetition rate çok daha yüksek olabilir. Toolkit 61162-1 vs 61162-2 karşılaştırması: Profile, Baud/speed profile, Sentence format, Observed update rate.
- **IEC 61162-3**: NMEA 2000'in SOLAS vessel implementation'ı; CAN tabanlı serial data instrument network. Toolkit yönlendirmesi: IEC 61162-3 → NMEA 2000 parser.
- **IEC 61162-450** (Edition 3, **IEC 61162-450:2024**): multiple talkers/multiple listeners, shipboard Ethernet interconnection standardı; yüksek hızlı communication ve navigation/radiocommunication ekipmanı arasında Ethernet üzerinden veri transferi framework'ü. Katman: IEC 61162-450 Application Data → UDP/Ethernet transport → Ship LAN. Toolkit görünümü: Sender, Destination Multicast, Message Type, Sequence, Timestamp, Payload, Network.
- **IEC 61162-460** (**IEC 61162-460:2024**): 61162-450 üzerine safety/security ekler — network isolation, protected interconnection, redundant network gereksinimleri; yeni application protocol tanımlamaz, 61162-450'yi güvenlik yönünden genişletir. Toolkit'te: 61162-450 Network, Security Profile 61162-460, Network Zone, Gateway, Redundancy, Isolation, Unexpected Flow analizi eklenebilir.

---

## AIS Mesajları

VHF maritime mobile band üzerinde TDMA kullanan Automatic Identification System. **Güncel ITU-R recommendation (Ağustos 2026 itibarıyla): M.1371-6 (02/2026)**, 19 Şubat 2026'da onaylanmış, M.1371-5'in yerini almıştır. Recommendation; Physical/Link/Network/Transport Layer ve application behaviour'ı kapsar.

Toolkit iki ayrı AIS seviyesini ayırmalı:
1. AIS RF/VDL Message → AIS Binary Payload
2. IEC/NMEA transport → `!AIVDM`/`!AIVDO` → AIS 6-bit Payload

### AIVDM / AIVDO

Hedef alanlar: AIVDM, AIVDO, Fragment count, Fragment number, Channel, Payload, Fill bits. AIS payload `!AIVDM,...` sentence'ından alınıp 6-bit AIS data'ya çevrilmeli.

Örnek: `!AIVDM,2,1,5,A,<payload>,0*XX` → Sentence AIVDM, Total Fragments 2, Fragment 1, Sequence 5, Channel A, Payload ..., Fill Bits 0, NMEA Checksum PASS.

### AIS fragment reassembly

Bazı AIS payload'lar birden fazla NMEA sentence'a bölünür (Fragment 1/2, Fragment 2/2). Birleştirme anahtarları: Sequence ID, Channel, Fragment Count, Fragment Number, Arrival Time. Durum: Fragment 1 RECEIVED, Fragment 2 WAITING → COMPLETE.

**Missing fragment:** Fragment 1 ve Fragment 3 var ama 2 yok → `AIS FRAGMENT ERROR — Missing fragment 2`.

### AIS 6-bit payload decoder

İşlem zinciri: AIVDM Payload → ASCII armoring removal → 6-bit values → Bit Stream → AIS Message Fields.

Toolkit intermediate görünüm: Payload Character (örn. `X`) → Encoded → 6-bit (örn. `101011`); tüm payload Bit Offset / Length / Raw / Decoded formatında. Exact bit-field table, güncel ITU-R M.1371 revision ve kullanılan AIS message type database'ına bağlı tutulmalı.

### AIS message type

Belgenin hedefleri: Position Report Class A, Static and Voyage Data, Class B Position Report, Base Station Report, Safety Related Message.

Decoder alanları: Message Type, MMSI, Navigation Status, Position, COG, SOG, Heading. Tam AIS message type/field database **M.1371-6** revizyonuna bağlı tutulmalı.

### AIS Target Table

Canlı capture'dan tablo: MMSI / Name / Lat / Lon / SOG / COG. Her target: Last Position Update, Last Static Data, Message Type, Class, Channel, Age.

**Stale target:** Last AIS report 180 s ago → `STALE TARGET`.

---

## GPS NMEA Mesajları

NMEA 0183 decoder'ın GNSS navigation odaklı özel görünümü — parser yeniden yazılmaz, aynı parser üzerine **GNSS semantic layer** kurulur. Temel sentence grupları: GGA, RMC, GSA, GSV, VTG, GLL, ZDA (zaten desteklenen sentence'lar arasında).

**GNSS dashboard:** Position (Latitude, Longitude, Altitude), Fix, Satellites, HDOP, UTC, COG, SOG.

**Sentence correlation:** Aynı epoch'taki GGA/RMC/GSA/GSV mesajları "GNSS Epoch 12:35:19" altında gruplanır.

**Cross-check:** RMC Position vs GGA Position karşılaştırması (örn. Difference 0.4 m).

**Invalid fix:** GNSS fix invalid ise fiziksel position değeri mevcut olsa dahi `POSITION INVALID` durumu korunmalı; raw değer validity'den ayrılmalı (Latitude 40.XXXX, Validity INVALID).

---

## GNSS UBX

UBX, u-blox GNSS receiver'ların binary protocol ailesidir. Modern u-blox cihazları UART, USB, SPI ve bazı serilerde I²C üzerinden GNSS data sağlar; güncel ürünler halen UBX tabanlı düşük seviye communication kullanır. UBX temel parser, 3.2 bölümündeki ortak binary parser ile paylaşılmalı.

Conceptual frame: SYNC → CLASS → ID → LENGTH → PAYLOAD → CHECKSUM.

**Marine GNSS görünümü:** Raw UBX frame yalnız class/ID seviyesinde bırakılmamalı. Örneğin navigation solution message: UBX → Navigation Solution → Position, Velocity, Heading, Fix, Accuracy, Time — ortak NavigationData modeline dönüştürülmeli. u-center 2 güncel dokümantasyonu, UBX-NAV-PVT'nin receiver position information kaynağı olarak kullanılabildiğini belirtir.

**UBX + NMEA simultaneous stream:** Aynı UART'ta `B5 62 ...`, `$GNGGA,...`, `$GNRMC,...`, `B5 62 ...` karışık akış görülebilir. Auto-detector: `B5 62` → UBX candidate, `$` → NMEA candidate.

**Common value comparison:** UBX Position vs NMEA Position, Difference (örn. 0.08 m) — özellikle entegrasyon testlerinde yararlı.

---

## RTCM Düzeltme Mesajları

GNSS correction data'nın standardize taşıma formatlarından biri. RTCM Version 3 ailesinin güncel standardı **RTCM 10403.4**. Artık yalnız maritime değil: Marine navigation, Surveying, Precision agriculture, Robotics, UAV, Autonomous systems gibi high-precision GNSS uygulamalarında da kullanılıyor.

**RTCM stream parser pipeline:** Raw Stream → Preamble Detection → Length → Payload → Message Number → CRC → GNSS Correction Fields. Toolkit metadata: Message Type, Length, Station, GNSS, Epoch, Satellite Count, Signal Type, CRC. Exact field database seçilen RTCM standard revision'ına bağlı tutulmalı.

**RTCM categories:** Reference Station, GPS, GLONASS, Galileo, BeiDou, MSM, SSR, Antenna, Station Information.

**Correction stream statistics** (örnek): 107x — 1 Hz — 100 ms; 108x — 1 Hz — 120 ms; 109x — 1 Hz — 80 ms. Exact message-number yorumu licensed/current RTCM database'dan alınmalı.

**Age of correction:** Correction Age, Epoch Age, Last RTCM Frame gösterilmeli. Correction stream durunca `RTCM STREAM LOST` alarmı.

---

## NTRIP ile RTCM İlişkisi

NTRIP, RTCM correction data'yı IP üzerinden stream etmek için yaygın transport protokolüdür. u-blox güncel açıklamasına göre: NTRIP = HTTP tabanlı transport, RTCM = correction message data format. Yani **NTRIP ≠ RTCM**.

Doğru model: NTRIP → RTCM Stream → GNSS Receiver.

NTRIP capture verilirse toolkit ayrıca network metadata gösterebilir: Caster, Mount Point, Connection, HTTP Status, RTCM Message Rate, Bytes/s, Reconnect.

---

## J1939 Tabanlı Deniz Mesajları

Bazı marine propulsion, generator, engine ve machinery control sistemleri SAE J1939 tabanlı haberleşme kullanır. J1939 decoder burada yeniden yazılmaz. Ortak katman: CAN → J1939 → PGN → SPN → Marine Engine/Machinery Value. SAE J1939 application data J1939DA database ve çeşitli application-layer dokümanlarına ayrılmış durumda; toolkit marine PGN/SPN anlamlarını yalnız uygun lisanslı/güncel database varsa semantik isimlendirmeli.

**Engine dashboard** (J1939 DB mevcutsa): Engine → Speed, Coolant Temperature, Oil Pressure, Load, Fuel Rate, Diagnostic Status.

**Multi-engine:** Port Engine, Starboard Engine, Generator 1, Generator 2 gibi birden fazla source olabilir. Toolkit source address + device identity üzerinden mapping tanımlamaya izin vermeli: SA 0x00 → Port Engine, SA 0x01 → Starboard Engine.

**NMEA 2000 vs J1939 ayrımı:** NMEA 2000 = CAN tabanlı marine network, PGN model; SAE J1939 = CAN tabanlı vehicle/machinery network, PGN/SPN model. Benzer identifier yapıları aynı protokol olduğu anlamına gelmez. Toolkit aynı CAN capture'da candidate detection yapmalı ama yalnızca 29-bit CAN frame görüldüğü için NMEA 2000 veya J1939 diye kesin karar vermemeli; confidence göstermeli: örn. J1939 Database Match %92, NMEA 2000 Match %12.

---

## SeaTalk için Temel Veri Çözümleme

SeaTalk 1, Raymarine'in eski/original marine networking sistemi. Raymarine'in güncel ürün açıklamasına göre SeaTalk 1, üç telli network üzerinden **bidirectional data + 12 V DC power** taşır; instrument, autopilot controller ve navigation component'lerini bağlar; daisy-chain veya star topolojide kurulabilir. Toolkit'te ilk sürüm **temel log/frame çözümleme** seviyesinde tutulmalı.

**Conceptual layer:** SeaTalk 1 Bus → Raw Byte/Word Stream → Command/Message Identification → Payload → Navigation Value.

**Desteklenebilecek semantic gruplar** (database mevcutsa): Depth, Speed, Wind, Heading, Rudder, Autopilot, Navigation, Waypoint, GPS, Instrument control. Raymarine SeaTalk1-to-SeaTalkNG converter firmware dokümantasyonu, Speed/Depth/Wind/Heading/GPS/rudder/autopilot bilgisinin iki network arasında bridge edildiğini doğrular.

**SeaTalk gateway view:** SeaTalk1 → SeaTalk1→SeaTalkNG Converter → SeaTalkNG/NMEA 2000 tarzı network trafik mapping'i yararlı olur. Örnek: SeaTalk1 Heading → Converted NMEA 2000 Heading message.

**Duplicate source:** Converter kullanan sistemlerde aynı fiziksel veri birden fazla kaynaktan gelebilir (Heading Source 1: SeaTalk1→Converter; Source 2: Native network sensor) → duplicate source warning.

**Proprietary limitation:** SeaTalk 1 tamamen açık bir NMEA standardı değil. Exact message database vendor documentation veya kullanıcının sağladığı validated mapping üzerinden yüklenmeli.

---

## Modbus Tabanlı Deniz Ekipmanı Mesajları

Bazı marine auxiliary systems (machinery monitoring, tank systems, power systems, battery chargers, generators, propulsion auxiliaries, alarm systems) Modbus RTU veya Modbus TCP kullanır. Modbus application-layer protokolüdür; RS-232, RS-485 veya Ethernet/TCP gibi lower-layer network'ler üzerinde çalışır. Modbus Organization güncel application protocol olarak **V1.1b3**'ü, yeni serial implementation'lar için **Serial Line Guide V1.02**'yi listeler. Ayrı bir "Marine Modbus Protocol" varsayılmamalı — doğru model: Vendor Register Map → Modbus → RS-485/Ethernet.

**Örnek:** Device: Battery Charger, Slave Address 3, Register 40001, Raw `0x09C4` (=2500). Vendor doc: Scale 0.01, Unit V.

`Value = 2500 × 0.01 = 25.00 V`

Toolkit: Register 40001, Raw 2500, Physical 25.00 V, Meaning: Battery Voltage.

**Vendor register map import** (CSV/JSON): Register, Name, Function, Type, Byte Order, Scale, Offset, Unit, Access, Min, Max.

**Marine dashboard** (örn. generator controller, Modbus register'lardan): RPM, Coolant Temp, Oil Pressure, Frequency, Voltage, Current, Power, Alarm.

**Poll cycle:** Read Holding 40001–40010 → 50 ms → Read Input 30001–30008 → 50 ms → Repeat. Toolkit: Poll Period, Response Time, Timeout, Exception, Retry, Bus Utilization.

---

## HDLC Tabanlı Özel Deniz Cihazı Haberleşmeleri

Bazı eski veya vendor-specific maritime ekipmanlar HDLC veya HDLC-benzeri bit/frame yapıları kullanır. Toolkit exact vendor protokolü bilmeden HDLC frame'i yanlış isimlendirmemeli. Katman: Physical Interface → HDLC/HDLC-like Framing → Vendor Header → Vendor Command → Vendor Payload.

**Generic HDLC structure:** FLAG – ADDRESS – CONTROL – INFORMATION – FCS – FLAG. Flag = `0x7E` (bit stream `01111110`).

**Bit stuffing:** Payload içinde flag pattern oluşmasını önlemek için uygulanır. Zincir: Raw Captured Bits → Flag Detection → Bit Destuff → Frame Bytes → FCS.

**Unknown marine HDLC protocol örneği:** capture `7E 12 03 18 04 20 10 33 88 XX XX 7E` → Flag Valid, Address `0x12` candidate, Control `0x03` candidate, Payload `18 04 20 10 33 88`, FCS candidate CRC-16 (conservative interpretation). Vendor schema yüklendiğinde semantik görünüm: Address "Gyro 1", Command "Heading Report", Heading 123.45°.

**HDLC reverse engineering:** Unknown Protocol Analyzer ile entegre: Fixed bytes, Changing bytes, Counter, Possible checksum, Possible CRC, Periodic fields, Correlation with known sensor value. Örnek: gyro fiziksel Heading 90° iken payload `23 28`; Heading 100° iken `27 10` → numeric correlation kurulabilir.

---

## Ortak Marine Navigation Dashboard

Bütün protokol parser'ları aynı navigation state modeline veri gönderebilmeli. Örnek **VESSEL NAVIGATION**: Position (Lat/Lon), Heading (True 123.4° / Magnetic 118.2°), COG 121.7°, SOG 12.4 kn, STW 11.8 kn, ROT +2.1°/min, Depth 34.2 m, Wind (AWA/AWS/TWA/TWS), GNSS (Fix/Satellites/HDOP), AIS Targets 27.

## Heading / COG Ayrımı

Heading ve COG kesinlikle aynı şey gösterilmemeli: **Heading** = vessel bow direction; **COG** = actual ground-track direction. NMEA'nın teknik açıklaması bu ikisinin farklı fiziksel büyüklükler olduğunu belirtir. Örnek: Heading 090°, COG 105° — gemi doğuya bakarken akıntı/rüzgâr nedeniyle güneydoğuya ilerliyor olabilir. Toolkit Heading-COG Difference (15°) hesabı sunmalı.

## True / Magnetic Heading

True Heading, Magnetic Heading, Variation, Deviation (varsa) ayrı tutulmalı. Asla reference belirtmeden tek bir "Heading = 120°" gösterilmemeli. UI: `Heading: 120.4°T`, `Magnetic: 115.8°M` gibi suffix kullanılabilir.

## Speed Source Ayrımı

**SOG** (Speed Over Ground) ve **STW** (Speed Through Water) ayrı physical value olarak tutulmalı. Örnek: SOG 12.5 kn, STW 10.8 kn, Difference 1.7 kn — bu fark current/tide etkisini gösterebilir ama toolkit bunu doğrudan "current = 1.7 kn" diye yorumlamamalı; yönsel vektör bilgisi gerekir.

## Apparent / True Wind

Apparent Wind Angle, Apparent Wind Speed, True Wind Angle, True Wind Speed ayrılmalı. Source field yanlış yorumu özellikle gateway sistemlerinde sorun yaratır — Raymarine'in 2024 SeaTalk converter firmware notlarında Apparent/True Wind ayrımına yapılan bir düzeltme, bunun gerçek entegrasyon problemi olduğunun kanıtıdır. Toolkit `Wind Type: Apparent / True / Unknown` alanını explicit tutmalı.

## Depth Data

Depth: Below Transducer / Below Surface / Below Keel referans farkları nedeniyle yalnız sayı olarak tutulmamalı. Toolkit: Depth 14.7 m, Reference: Below Transducer, Offset: ... gibi metadata taşımalı.

---

## Multi-Protocol Gateway Analyzer

Deniz elektroniklerinde gateway kullanımı yaygındır (NMEA 0183 → Gateway → NMEA 2000; veya SeaTalk1 → SeaTalkNG → NMEA 2000). Toolkit conversion correlation yapmalı: Input HDT 123.4° → Output NMEA 2000 Heading 123.4°, Latency 8.2 ms.

**Value mismatch:** Input 12.4 kn, Output 12.3 kn, Difference 0.1 kn.

**Missing conversion:** Input sentence X algılanmış ama expected output PGN "Not observed" → integration warning.

## Source Priority / Data Selection Analyzer

Bridge system'de aynı veri birden fazla kaynaktan gelebilir (örn. heading: Gyro 1, GNSS Compass, Autopilot Sensor, Gateway). Tablo: Source / Value / Rate / Age — örn. Gyro 1: 122.4°, 10 Hz, 12 ms; GNSS Compass: 122.6°, 5 Hz, 60 ms; Autopilot: 122.4°, 10 Hz, 18 ms.

**Conflict:** Gyro 1: 122°, GNSS: 168° → `SOURCE DISAGREEMENT`, Difference 46° alarmı.

## Navigation Data Freshness

`Age = t_now − t_lastUpdate`

Örnekler: Heading Age 20 ms → Fresh; Position Age 1.2 s → Fresh; Depth Age 14.3 s → STALE; Wind: Never received → MISSING. Threshold protokol/mesaj tipi bazında ayarlanabilmeli.

## Rate / Period Analyzer

Her marine mesaj için: Expected Rate, Observed Rate, Mean Period, Minimum, Maximum, Jitter, Missing Count. Örnek Heading: Expected 10 Hz, Observed 9.98 Hz, Average Period 100.2 ms, Jitter ±2.4 ms.

## Unit Normalization

Toolkit internal canonical unit kullanmalı, UI dönüşüm yapabilmeli.

`1 knot = 1.852 km/h`
`1 knot ≈ 0.514444 m/s`

Örnek: Input 12.0 kn → UI: 12.0 kn / 22.224 km/h / 6.173 m/s. Ayrıca Angle (degrees, radians), Distance (m, km, NM), Depth (m, ft) seçenekleri bulunmalı.

## Time Synchronization View

Navigation sistemleri birçok farklı timestamp kaynağı kullanır: GNSS UTC, Message timestamp, Capture timestamp, Device local time, Host time, AIS report time — toolkit bunları karıştırmamalı. Örnek: Value Time 12:35:19.000 UTC, Received 12:35:19.042, Host Capture 12:35:19.043.

`Latency = t_capture − t_measurement`

## Position Difference Analyzer

İki position source karşılaştırılabilmeli; basit küçük-mesafe yaklaşımı yerine tercihen **geodesic distance** hesabı kullanılmalı. Input: GNSS 1 (lat1, lon1), GNSS 2 (lat2, lon2) → Output: Horizontal Separation 1.82 m, Bearing 243°. Dual-GNSS ve redundant bridge systems için faydalı.

## Marine Message Correlation

Örnek vessel turning event timeline: 12:00:00 Heading değişmeye başlar; 12:00:00 ROT pozitif olur; 12:00:01 COG değişir; 12:00:02 AIS position report yeni course'u yansıtır. Toolkit bu değişimleri multi-signal timeline üzerinde göstermeli.

---

## Ortak Denizcilik Hata Modeli

Desteklenmesi gereken hata sınıfları: `CHECKSUM_ERROR`, `CRC_ERROR`, `INVALID_SENTENCE`, `UNKNOWN_TALKER`, `UNKNOWN_FORMATTER`, `INVALID_COORDINATE`, `INVALID_FIX`, `MISSING_FIELD`, `FIELD_OUT_OF_RANGE`, `STALE_DATA`, `MESSAGE_TIMEOUT`, `UNEXPECTED_PERIOD`, `FRAGMENT_MISSING`, `FAST_PACKET_ERROR`, `SOURCE_ADDRESS_CONFLICT`, `DEVICE_DISAPPEARED`, `PGN_UNKNOWN`, `AIS_FRAGMENT_ERROR`, `AIS_TARGET_STALE`, `RTCM_STREAM_LOST`, `GNSS_FIX_LOST`, `DUPLICATE_SOURCE`, `SOURCE_DISAGREEMENT`, `GATEWAY_CONVERSION_MISSING`, `GATEWAY_VALUE_MISMATCH`.

Her hata şu bilgiye sahip olmalı: Timestamp, Protocol, Source, Message, Field, Severity, Expected, Received, Possible Cause.

## Ortak Marine Layer Drill-Down

Kullanıcı bir navigation value'ya tıklayınca kaynağa kadar inebilmeli:

- **Heading:** `123.4° True` → NMEA 0183 HDT → Field 1 → `"123.4"` → ASCII `31 32 33 2E 34` → Serial Stream
- **NMEA 2000 (Engine RPM):** `1500 rpm` → PGN → Signal Field → Raw bytes → CAN Frame → 29-bit Identifier
- **AIS:** Ship Position → AIS Message → 6-bit Payload → AIVDM Fragment(s) → NMEA 0183 Transport
- **RTCM:** GNSS Correction → RTCM Message → Correction Stream → NTRIP Connection

Bu yapı sayesinde denizcilik bölümü yalnızca bir "NMEA terminali" olmamalı. Amaç: **GNSS sensöründen gyro ve AIS'e, serial NMEA 0183'ten CAN tabanlı NMEA 2000'e, RTCM correction stream'den engine J1939 ağına ve gateway dönüşümlerine kadar** gemideki navigasyon/haberleşme verisinin nereden geldiğini, nasıl taşındığını ve hangi fiziksel değere dönüştüğünü tek platformda analiz edebilmek.

---

## Dikkat çekenler

- **Tutarlı mimari desen:** Tüm protokoller (NMEA 0183, NMEA 2000, AIS, UBX, RTCM, Modbus, HDLC) aynı üç katmanlı modeli izliyor: raw bytes → structured/parsed alanlar → ortak semantic navigation modeli, ve her değer drill-down ile raw byte'a kadar geri izlenebilir olmalı (bidirectional traceability).
- **"Asla çıplak değer gösterme" ilkesi tekrarlanan bir kural:** Heading mutlaka True/Magnetic etiketiyle, hız mutlaka SOG/STW ayrımıyla, rüzgâr mutlaka Apparent/True etiketiyle, derinlik mutlaka referans (transducer/surface/keel) ile, konum mutlaka fix validity ile birlikte gösterilmeli — bağlamsız tekil sayı üretimi sistematik olarak yasaklanmış.
- **Lisanslı veritabanı bağımlılığı açıkça vurgulanıyor:** NMEA 0183 sentence field'ları, NMEA 2000 PGN field'ları, AIS mesaj tipleri, RTCM mesaj numaraları ve J1939 SPN'leri için toolkit'in rastgele/internet kaynaklı tablolara değil, seçilen resmi/lisanslı revizyon veritabanına bağlı kalması gerektiği her protokol için ayrı ayrı tekrarlanıyor.
- **NMEA 2000 vs J1939 kasıtlı belirsizlik toleransı:** Aynı 29-bit CAN identifier yapısını paylaştıkları için toolkit ikisini otomatik olarak kesin sınıflandırmamalı, bunun yerine confidence yüzdesi (örn. J1939 %92 / NMEA2000 %12) göstermeli — yanlış kesinlik üretmemek tasarım ilkesi.
- **Güncel standart/versiyon referansları (belgede "güncel" olarak anılan):** NMEA 0183 v4.30, NMEA 2000 v3.000, IEC 61162-1:2024 (Ed.6), IEC 61162-2:2024, IEC 61162-450:2024 (Ed.3), IEC 61162-460:2024, RTCM 10403.4, Modbus V1.1b3 + Serial Line Guide V1.02. Dikkat: **ITU-R M.1371-6 (02/2026)**, 19 Şubat 2026 onaylı olarak anılıyor — belge tarihine göre yakın geçmiş/güncel kabul edilmiş.
- **Gerçek dünya entegrasyon hatası referans gösteriliyor:** Raymarine'in 2024 SeaTalk converter firmware notlarındaki Apparent/True Wind düzeltmesi, "wind type'ı explicit tutma" kuralının teorik değil kanıtlanmış bir gereksinim olduğunu göstermek için kullanılmış.
- **HDLC bölümü kasıtlı olarak muhafazakâr:** Vendor protokolü bilinmeyen HDLC frame'lerinde alanlar "candidate" (Address candidate, Control candidate, FCS candidate CRC-16) olarak işaretleniyor; kesin isimlendirme yalnız vendor şeması yüklendiğinde yapılıyor. Reverse engineering, gyro örneğindeki gibi bilinen sensör değeriyle sayısal korelasyon üzerinden öneriliyor.
- **SeaTalk 1 ve Modbus için "tek protokol" yanılgısına karşı özel uyarı:** SeaTalk 1 açık NMEA standardı değildir; "Marine Modbus Protocol" diye ayrı bir standart da yoktur — ikisi de vendor register map / vendor documentation'a bağlı olmalıdır.
- **Freshness/staleness ve source-conflict tespiti çapraz kesen (cross-cutting) bir gereksinim:** Age formülü (`t_now − t_lastUpdate`), jitter hesapları ve disagreement eşikleri NMEA 0183, NMEA 2000, AIS ve genel navigation dashboard seviyelerinde ayrı ayrı ama aynı mantıkla tekrar ediyor.
- **Position Difference Analyzer'da açık metodolojik tercih:** Basit düzlemsel yaklaşık mesafe yerine geodesic distance hesabı özellikle isteniyor — dual-GNSS/redundant sistemlerde hassasiyet vurgusu.
