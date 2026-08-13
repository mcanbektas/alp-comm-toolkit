# ALP Comm Toolkit — Özet 01: Fiziksel Arayüzler

*Kaynak: "ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve Protokol Geliştirme Platformu.md", satır 1–3628 (giriş, rol, hedef, katman listesi, 3.1 Fiziksel Arayüzler, 3.2'nin başlangıcı).*

## 1. Rolün

Kıdemli profil: elektronik ve haberleşme mühendisi, gömülü sistemler geliştiricisi, endüstriyel haberleşme uzmanı, otomotiv haberleşme protokolleri uzmanı, deniz elektroniği ve navigasyon sistemleri uzmanı, React/TypeScript geliştiricisi, web tabanlı analiz yazılımı mimarı, UI/UX tasarımcısı.

Hedef kullanıcılar: elektronik mühendisleri, gömülü sistem geliştiricileri, test mühendisleri, otomasyon mühendisleri, deniz elektroniği teknisyenleri, öğrenciler.

- Proje adı: **ALP Comm Toolkit**
- Tam açıklama: *Advanced Communication Protocol Analysis, Decoding, Simulation and Engineering Toolkit*
- TR açıklama: Haberleşme Protokolü Analiz, Çözümleme, Simülasyon ve Mühendislik Araçları

**Kısıtlama:** proje basit bir seri port terminali veya HEX dönüştürücü OLMAMALI; fiziksel arayüzlerden uygulama katmanı protokollerine kadar çok seviyeli analiz yapabilen modüler mühendislik platformu olmalı.

## 2. Projenin temel hedefi

Karşılanması gereken 14 ihtiyaç:

1. Ham haberleşme verisini görüntülemek
2. Gelen byte dizisini paketlere ayırmak
3. Paket içindeki adres, komut, uzunluk, veri, checksum alanlarını belirlemek
4. Standart protokolleri otomatik çözümlemek
5. Kullanıcının kendi özel protokolünü tanımlamasını sağlamak
6. Protokole uygun paket oluşturmak ve göndermek
7. Canlı verileri gerçek zamanlı grafiklere aktarmak
8. Haberleşme hızı, frame süresi, bus load ve timeout hesaplamak
9. Log dosyalarını analiz etmek
10. Bilinmeyen protokollerde değişen alanları ve checksum yapısını tahmin etmek
11. Farklı protokoller arasında veri dönüştürmek
12. Test senaryoları ve haberleşme simülasyonları oluşturmak
13. Protokol dokümantasyonu ve örnek kod üretmek
14. Haberleşme hatalarını ve zamanlama sorunlarını tespit etmek

Ana ürün yalnız hazır protokolleri çözmemeli. Merkezde kullanıcı tanımlı protokolleri destekleyen bir **Custom Protocol Studio** bulunmalı.

## 3. Desteklenecek haberleşme katmanları

### 3.1 Fiziksel arayüzler — kapsam listesi (23 arayüz)

UART, RS-232, RS-422, RS-485, TTL UART, CMOS UART, Current Loop, 4–20 mA, SPI, Quad SPI, Octal SPI, I²C, I3C, SMBus, PMBus, 1-Wire, Microwire, USB, Ethernet, Single Pair Ethernet, CAN Physical Layer, LIN Physical Layer, FlexRay Physical Layer.

### Her arayüz sayfasının ortak yapısı

Her arayüz yalnız isim olarak listelenmemeli; mümkün olduğunca 12 ortak görünüm sağlanmalı:

| Görünüm | İçerik |
|---|---|
| Overview | Amaç ve kullanım alanı |
| Signal View | Hat/sinyallerin görsel gösterimi |
| Bit View | Tek transaction'ın bit seviyesi gösterimi |
| Byte View | HEX, binary, decimal, ASCII karşılığı |
| Timing View | Clock/data/enable/acknowledge zaman diyagramı |
| Configuration | Baud rate, clock, mode, address, data width vb. |
| Transaction Builder | Kullanıcının örnek aktarım oluşturması |
| Decoder | Girilen/canlı yakalanan verinin çözümü |
| Calculator | Hız, süre, throughput, timeout hesapları |
| Error View | Framing, parity, NACK, timeout, collision |
| Examples | Gerçek sensör/PLC/MCU/modem/bellek örnekleri |
| Integration Notes | Gömülü yazılım/sistem entegrasyon noktaları |

---

### UART — Universal Asynchronous Receiver/Transmitter

Paralel↔seri dönüştürücü, asenkron. Kendi başına voltaj seviyesi/kablo standardı değildir — aynı bit akışı 1.8V/3.3V CMOS, 5V TTL-compatible, RS-232 veya RS-485 transceiver üzerinden taşınabilir. Ayrı clock hattı yok; verici/alıcı aynı baud rate + frame konfigürasyonunu önceden bilmeli. Hatlar: TX, RX, GND — TX/RX bağımsız olduğundan full-duplex.

**Frame yapısı:** `Idle(1) | Start(0) | D0..D7 (DATA) | Parity(P) | Stop(1) | Idle`. Örnek konfig `115200 8N1` = Baud 115200, Data 8 bit, Parity None, Stop 1.

Formüller (8N1 örneği):
- `N_char = 1 + 8 + 1 = 10 bit`
- `T_bit = 1 / BaudRate` → 115200 baud'da `T_bit = 8.6806 µs`
- `T_char = 10 × 8.6806 = 86.806 µs`
- `R_byte = 115200 / 10 = 11520 byte/s` (yani 115200 baud ≠ 115200 byte/s)

Microchip UART dokümantasyonu: asenkron UART NRZ kullanır, idle = Mark = logic-1, Start = logic-0, Stop = logic-1, klasik asenkron UART veri bitleri LSB-first taşınabilir.

**Bit view örneği:** 0x53 = `0101 0011` (D7..D0 = 0 1 0 1 0 0 1 1). LSB-first aktarım: `Start D0 D1 D2 D3 D4 D5 D6 D7 Stop = 0 1 1 0 0 1 0 1 0 1`. Her bit için: Bit adı, Value, Start Time, End Time, Duration (örn. D4: 1, 43.40 µs, 52.08 µs, 8.68 µs).

**Oversampling:** `f_sample = Oversampling × BaudRate`. 8x/16x yaygın (Microchip USART). 115200 baud, 16x → `f_sample = 1.8432 MHz`.

**Baud rate error:** hedef 115200, gerçek 115107 → `Error = 115107 − 115200 = −93`; `Error% = (−93/115200)×100 = −0.0807%`. Toolkit TX Baud Error, RX Baud Error, Relative Baud Mismatch'i ayrı ayrı göstermeli (her iki tarafın clock toleransı kabul edilmeli).

**Parity:** None/Even/Odd. Even parity → toplam `1` sayısı çift. Örnek: Data=10110010, 1 count=4 → Even parity=0, Odd parity=1.

**Hata türleri:** Parity Error, Framing Error, Overrun Error, Noise Error, Break Detection, Receiver Timeout, Buffer Overflow, Unexpected Idle, Baud Mismatch Suspected. Framing Error: stop biti beklenen konumda logic-1 görülememesi. Overrun Error: önceki karakter SW tarafından alınmadan yeni karakter gelmesi.

**Config paneli:** Baud Rate, Data Bits, Parity, Stop Bits, Flow Control, Bit Order (LSB First), Oversampling, RX Timeout, Buffer Size, Encoding (Raw/ASCII/UTF-8), Line Ending (None/CR/LF/CRLF).

**Canlı görünüm örneği:** `12:41:03.201 RX 48 65 6C 6C 6F 0D 0A` → ASCII `Hello\r\n`, Length 7 byte, Frame Time 607.6 µs.

**Kullanım örnekleri:** STM32↔GNSS, STM32↔LTE modem, MCU↔Bluetooth, USB-UART↔Debug console, MCU↔RS-485/RS-232 transceiver, Flight Controller↔Telemetry radio, PLC service port↔PC.

---

### RS-232

Single-ended gerilim sinyalli fiziksel katman. **UART ≠ RS-232.** Tipik zincir: MCU UART (3.3V) → MAX3232 → RS-232 → PC/PLC/Instrument. MAX3232 ailesi TIA/EIA-232-F gereksinimlerini karşılayan UART-to-RS-232 elektriksel arabirim örneğidir.

**Mark/Space:** Mark→Logic1→negatif hat gerilimi; Space→Logic0→pozitif hat gerilimi. UART idle=logic1 olduğundan RS-232 TX hattı idle'da negatif olabilir (logic inversion). Toolkit UART Side ve RS-232 Side dalga formunu yan yana göstermeli.

**DTE/DCE:** DTE=Data Terminal Equipment, DCE=Data Communication Equipment (örn. PC=DTE, Modem=DCE) — pin yönlerinin anlaşılması için gerekli.

**DB9 sinyalleri:** TXD, RXD, GND, RTS, CTS, DTR, DSR, DCD, RI. Minimal bağlantı: TXD/RXD/GND. HW handshake: RTS/CTS.

**Null modem:** iki DTE doğrudan bağlanınca TX↔RX, RX↔TX, RTS↔CTS çaprazlanmalı; toolkit girişten (`Device A/B Type: DTE`) "Null Modem Required" uyarısı üretebilmeli.

**Yazılım:** UART benzeri ayarlar (9600 8N1 / 19200 8E1 / 115200 8N1) — fiziksel RS-232 katmanı UART frame'ini değiştirmez.

**Örnek:** 9600 8N1, Data=0x41='A' → Bit view `Start D0..D7 Stop = 0 1 0 0 0 0 0 1 0 1`; toolkit bunun RS-232 fiziksel polarite karşılığını da göstermeli.

**Entegrasyon hataları:** TTL UART'ın doğrudan RS-232'ye bağlanması, TX/TX bağlantısı, yanlış DTE/DCE varsayımı, yanlış null-modem config, ortak referans (GND) yokluğu, HW flow control'ün yalnız bir tarafta aktif olması, yanlış baud/parity/stop, CR/LF uyuşmazlığı.

---

### RS-422

Balanced differential seri standart. `A/B` veya `TX+/TX-`; receiver `V_diff = V+ − V−` değerine bakar. TI örneği: bir driver aynı diferansiyel bus'ta 10 receiver'a kadar sürebilir (klasik yapı, tek driver → çoklu receiver).

**Full-duplex:** dört tel — `TX+, TX-, RX+, RX-`. Bağlantı: A.TX+→B.RX+, A.TX-→B.RX-, A.RX+→B.TX+, A.RX-→B.TX-.

**Bit görünümü:** UART `1 0 1 1 0` → Vdiff `+V −V +V +V −V`. Toolkit dört kanalı (UART Bit, TX+, TX-, Vdiff, Decoded Logic) birlikte göstermeli.

**Termination:** `R_T ≈ Z_0`; 100–120 ohm sınıfı twisted-pair'de benzer değer görülür.

**Yazılım:** Baud/Data bits/Parity/Stop bits + Mode (Simplex/Full Duplex), Driver Count, Receiver Count, Cable Length, Termination, Propagation Velocity.

**Kullanım:** Encoder→Motion controller, Navigation sensor→Control computer, Industrial sensor→PLC, Spacecraft equipment interface, Long-distance serial telemetry.

---

### RS-485

Balanced differential + multipoint. **RS-485 üst seviye protokol değildir → RS-485 ≠ Modbus.** Doğru zincir: `Modbus RTU → UART → RS-485 Transceiver → A/B Differential Bus`.

**Half-duplex:** tek A/B pair, tüm cihazlar paylaşır; bir anda normalde tek driver bus'ı sürer. **Full-duplex:** iki pair (`TX+/TX-`, `RX+/RX-`).

**Transceiver kontrolü:** `DI`=Driver Input, `RO`=Receiver Output, `DE`=Driver Enable, `/RE`=Receiver Enable, `A/B`=Bus. MCU: UART TX→DI, UART RX←RO, GPIO→DE, GPIO→/RE. Half-duplex TX sırası: (1) DE=1, (2) UART TX başlat, (3) son byte shift register'dan tamamen çıksın, (4) DE=0, (5) receiver moda geç. **Kritik:** yalnız `TX buffer empty` interrupt'ı bazı implementasyonlarda erken olabilir — `TX Register Empty` ile `Transmission Complete` farkı ayrı öğretilmeli.

**Differential logic:** `V_AB = V_A − V_B`. Klasik receiver threshold bölgesi ~±200 mV; modern fail-safe transceiver'lar 0V differential (idle/open/short) durumunu bilinen logic seviyesine taşıyan farklı iç threshold kullanabilir.

**Termination:** nominal twisted-pair'de iki uçta 120 ohm. Enerjisiz bus: `R_eq = 120‖120 = 60 ohm` — A-B arası ~60 ohm ölçülmesi iki 120-ohm terminasyonun pratik göstergesidir. Amaç: kablo karakteristik empedansı ile yükü eşleştirip yansımaları azaltmak (TI: 120 ohm nominal twisted-pair termination).

**Bias/fail-safe:** hiçbir driver aktif değilken A/B floating → termination nedeniyle `V_AB≈0` olabilir → internal fail-safe receiver veya external bias resistor gerekir. Bias Calculator girdileri: VCC, Pull-up R, Pull-down R, Termination R, Receiver threshold, Number of terminations → çıktı: Idle VAB, Bias Current, Termination Current, Noise Margin.

**Unit Load:** standard bus driver 32 Unit Load'a göre değerlendirilir. 1/8 UL receiver çok daha fazla node'a izin verir (TI örneği: 1/8 UL cihazlarla teorik 256 node). Toolkit her node için UL girer, Total UL toplar, `Maximum Allowed = 32 UL` ile karşılaştırır.

**Propagation delay:** `T_prop = L / v_p`. Örnek: L=500 m, v_p=2×10⁸ m/s → `T_prop = 2.5 µs`; Round trip `T_RT = 5 µs`.

**Bit/bus görünümü:** aynı ekranda UART TX, DE, A, B, A-B, UART RX kanalları. Örnek Modbus frame: `UART TX: 01 03 00 00 00 02 C4 0B`, DE penceresi TX süresince aktif.

**Turnaround akışı:** Master TX → DE off → Bus idle → Slave processing → Slave TX. Ölçümler: TX Duration, DE Release Delay, Bus Turnaround, Slave Response Delay, Inter-frame Gap, Total Transaction Time.

**Entegrasyon problemleri:** A/B polarite ters, termination yok, 3+ termination direnci, star topology, uzun stub, DE'nin erken/geç bırakılması, iki node'un eşzamanlı TX yapması, fail-safe yokluğu, farklı ground potansiyeli, yanlış UART parametreleri, yanlış Modbus silent timing, echo'nun response sanılması. Multipoint/shared-medium yapıda contention oluşmamalı.

---

### TTL UART

Ayrı bir frame protokolü değil — UART verisinin TTL-compatible logic seviyeleri üzerinden taşınması. Ayrım: **UART = framing, TTL = elektriksel logic ailesi/uyumluluk.**

Logic compatibility view: kullanıcı `Device A VOH(min)`, `Device A VOL(max)`, `Device B VIH(min)`, `Device B VIL(max)` girer.
- HIGH kontrolü: `VOH_min > VIH_min`
- LOW kontrolü: `VOL_max < VIL_max`

Sağlanırsa "Logic Compatibility: PASS", değilse "WARNING: Level Translation May Be Required". **Kullanıcıya kesinlikle yalnız 3.3V/5V seçtirip karar verilmemeli** — gerçek uyumluluk datasheet'teki VIH/VIL/VOH/VOL/Absolute Maximum/5V Tolerant değerlerine bağlıdır. Toolkit Voltage View, Logic View, UART Bit View arasında geçiş sağlamalı.

---

### CMOS UART

UART frame'inin CMOS logic seviyeleri (1.2V, 1.8V, 2.5V, 3.3V) ile taşınması — SoC/mikrodenetleyiciler arası önemli. Örnek: 1.8V Processor UART → Level Translator → 3.3V GNSS Module.

Toolkit her iki yönü AYRI değerlendirmeli (A TX→B RX ve B TX→A RX) çünkü iki cihazın output/input karakteristikleri simetrik olmayabilir. Örnek: `A→B: PASS`, `B→A: FAIL` (Reason: B VOH=1.8V, A VIH=2.0V).

---

### Current Loop

Bilgiyi hat GERİLİMİ değil **hat AKIMI** üzerinden taşıyan arayüzlerin genel sınıfı. Analog Current Loop (4–20 mA, 0–20 mA) vs tarihsel Digital Current Loop (farklı akım seviyeleri = binary durumlar). Endüstriyel tercih nedeni: uzun kabloda direnç kaynaklı gerilim düşümüne rağmen loop compliance sınırları içinde akımın korunması (ADI current-loop kaynakları).

Ohm kanunu: `V = I × R`. Örnek: I=20 mA, R=100 ohm → `V=2V`.

Ekran alanları: Loop Supply, Transmitter Drop, Cable Resistance, Receiver Resistance, Loop Current, Remaining Compliance Voltage.

---

### 4–20 mA

Proses otomasyonu analog current-loop standardı. Mapping: 4 mA=Minimum measurement, 20 mA=Maximum measurement (örn. pressure sensor 0 bar→4mA, 100 bar→20mA).

**Scaling formülü:**
- `I = 4mA + 16mA × (x − x_min)/(x_max − x_min)`
- Ters: `x = x_min + (x_max − x_min) × (I − 4mA)/16mA`

**Örnek:** sensör 0–250 bar, ölçülen 13.6 mA → `x = 250 × (13.6−4)/16 = 150 bar`. Toolkit çıktısı: Loop Current 13.600 mA, Normalized 60.00%, Engineering Value 150.00 bar.

**250 ohm shunt:** `V = I × 250` → 4mA→1V, 20mA→5V, yani 4–20mA → 1–5V dönüşümü.

**Loop compliance:** `V_supply ≥ V_transmitter + I×(R_wire + R_load) + V_margin`. Örnek girdi: 24V supply, transmitter min 10V, cable R=100 ohm, input R=250 ohm, I=20mA → kullanılabilir voltage margin hesaplanmalı.

**Fault durumları** (yapılandırılabilir eşiklerle): Under-range, Normal range, Over-range, Open Loop, Short suspected, Sensor fault.

---

### SPI — Serial Peripheral Interface

Host + 1/N peripheral, clock tabanlı senkron. Sinyaller: SCLK, MOSI (Host→Peripheral), MISO (Peripheral→Host), CS (Chip Select); yeni terminolojide COPI/CIPO. Genelde full-duplex.

**SPI Mode (Microchip SPI, 4 mod):**

| Mode | CPOL | CPHA |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 0 | 1 |
| 2 | 1 | 0 |
| 3 | 1 | 1 |

CPOL: 0=clock idle LOW, 1=clock idle HIGH. CPHA: 0=ilk clock edge'te sample, 1=ikinci edge'te sample.

**Timing view:** CS/SCLK/MOSI/MISO dalga formu; bit tıklanınca Bit, Sample Edge, Shift Edge, Setup Time, Hold Time gösterilir.

**Transfer süresi:** `T = N_clock / f_SCLK`. Örnek: 32 clock, 10 MHz → `T = 3.2 µs`.

**Full-duplex:** her clock'ta MOSI 1 bit gönderir, MISO 1 bit alır (eşzamanlı). Register read örneği: MOSI `80 00`, MISO `XX 5A` → TX `0x80 0x00`, RX `0xFF 0x5A` (Command byte 0x80, Dummy TX 0x00, Returned 0x5A).

**Register transaction örneği** (IMU register 0x75, read bit = bit7): Command = `0x75 | 0x80 = 0xF5`. Sekans: CS LOW → TX 0xF5 → TX 0x00 (dummy) → RX dummy → RX 0x71 → CS HIGH.

**Yazılım parametreleri:** Clock Frequency, CPOL, CPHA, Mode, Bit Order, Word Size, CS Active Level, CS Setup Time, CS Hold Time, Inter-word Delay, Duplex. Bit order cihazdan cihaza değişir (MSB-first veya LSB-first).

**Hata teşhis pattern'leri:** Wrong CPOL, Wrong CPHA, Wrong bit order, CS timing violation, Clock too fast, Unexpected dummy byte, RX shifted by one bit, All 0xFF, All 0x00, MISO tri-state, Wrong register read/write bit. (Yanlış CPOL/CPHA verinin geçersiz/kaymış görünmesine yol açar.)

---

### Quad SPI — QSPI

Seri bellek haberleşmesinde çoklu data hattı ile throughput artışı. Hatlar: IO0–IO3, SCLK, CS — MOSI/MISO kavramı bidirectional IO lane'e dönüşür.

**Transfer fazları** (tipik Flash Read): Command → Address → Dummy → Data. Örnek: Command 0xEB, Address 0x001234, Dummy 6 cycle, Data 256 byte. Lane genişliği fazdan faza değişebilir: Command 1 lane, Address 4 lane, Dummy 4 lane, Data 4 lane. Microchip QSPI controller: standart SPI peripheral iletişimi + serial Flash + memory-mapped/XIP destekler.

**Raw throughput (SDR Quad):** `R = 4 × f_clock`. 100 MHz → `R = 400 Mbit/s`.

**Efektif throughput:** `Efficiency = PayloadCycles / (Command + Address + Dummy + PayloadCycles)`.

Toolkit girdileri: Command Width (1/2/4), Address Width (1/2/4), Data Width (1/2/4), Clock, Dummy Cycles, Address Length, Payload Length, SDR/DDR → gerçek transfer süresi.

---

### Octal SPI — OSPI

IO0–IO7 (8 data lane). Modern external Flash/PSRAM: SDR, DDR, DQS, memory-mapped, XIP. Microchip Octal SPI örneği: IO0–IO7 + DQS data strobe + memory-mapped/XIP desteği.

**Teorik hız:** Octal SDR `R = 8f`; Octal DDR `R = 16f`. 100 MHz DDR → `R = 1.6 Gbit/s`.

**Transaction view:** Command, Address, Mode bits, Dummy, DQS, Payload — her biri farklı renk. Command/address/data lane sayıları ayrı kabul edilmeli (her faz aynı lane width ile çalışmak zorunda değil).

---

### I²C

İki telli, senkron, adres tabanlı multi-device bus. Hatlar: SDA (data), SCL (clock) — open-drain/open-collector + pull-up.

**Temel transaction:** `START → ADDRESS → R/W → ACK → DATA → ACK → DATA → ACK → STOP`.
- START: SCL HIGH iken SDA HIGH→LOW.
- STOP: SCL HIGH iken SDA LOW→HIGH.

**7-bit address örneği** (device 0x68): Write byte = `(0x68<<1)|0 = 0xD0`; Read byte = `(0x68<<1)|1 = 0xD1`. Toolkit KESİNLİKLE 7-bit address / 8-bit write address / 8-bit read address ayrımını göstermeli — entegrasyonda sık karıştırılır.

**Bit görünümü:** 0x68 Write = `1 1 0 1 0 0 0 0` (adres bitleri + R/W), 9. clock'ta ACK.

**ACK/NACK:** her 8 data bitinden sonra 9. clock'ta receiver bildirir. Örnek: Byte1 0xD0 ACK, Byte2 0x75 ACK, Byte3 0x01 NACK.

**Register read örneği:** `START, 0x68+W, ACK, Register 0x75, ACK, REPEATED START, 0x68+R, ACK, Data 0x71, NACK, STOP`. Görsel: `S | D0 | A | 75 | A | Sr | D1 | A | 71 | N | P`.

**Hızlar:** Standard Mode, Fast Mode, Fast-mode Plus, High-speed Mode + custom SCL girişi desteklenmeli.

**Transfer süresi:** 1 byte+ACK = 9 clock. `T ≈ N_clock / f_SCL`. Örnek: 400 kHz, 10 byte toplam, START/STOP hariç ≈ `90/400000 = 225 µs`.

**Clock stretching:** target SCL'yi LOW tutup controller'ı bekletir. Örnek: SCL expected 2.5 µs period, Stretch detected 43 µs.

**Arbitration:** multi-controller'da dominant-LOW üzerinden. Örnek: Controller A=1, Controller B=0, Observed SDA=0 → Controller A loses arbitration.

**Bus scan:** örn. 0x1E ACK→Magnetometer?, 0x50 ACK→EEPROM?, 0x68 ACK→IMU/RTC?. Toolkit adresi KESİN cihaz adı olarak göstermemeli — "Possible devices" (aynı adresi birden çok cihaz kullanabilir).

---

### I3C

İki telli sensor/control bus; I²C uyumluluğu + yüksek hız + dynamic addressing + in-band interrupt (MIPI standardı). Hatlar: SDA, SCL. MIPI'ye göre SDR base raw rate 12.5 Mbit/s, kullanılabilir veri hızı ~11 Mbit/s; HDR modlarında raw rate 33.3 Mbit/s seviyesine ulaşabilir.

**I²C'den ayrılan kavramlar:** Dynamic Address Assignment, Common Command Codes, In-Band Interrupt, Hot-Join, Controller Role Request, SDR, HDR.

**Dynamic address:** target'ın static address'i olabilir, ancak controller bus başlangıcında dynamic address atar. Alanlar: PID, BCR, DCR, Static Address, Dynamic Address. Bus discovery örneği: Target1 PID `0x123456789ABC` → Dynamic Address `0x08`; Target2 PID `0x00A112334455` → Dynamic Address `0x09`.

**IBI (In-Band Interrupt):** I²C'de ayrı interrupt GPIO gerektiren işlemler I3C'de bus içinde bildirilir. Timeline: Controller idle → Target requests IBI → Controller ACK → Target interrupt payload.

**CCC (Common Command Codes):** ayrı decoder kategorisi — Broadcast CCC, Direct CCC. Toolkit CCC ID, yön, hedef, payload'ı ayrıştırmalı.

---

### SMBus

I²C fiziksel yapısını temel alır, sistem yönetimi için daha sıkı transaction/timeout kuralları tanımlar. Güncel yayınlanmış spesifikasyon: **3.3.1**. Hatlar: SMBCLK, SMBDAT; opsiyonel SMBALERT#.

**Transaction türleri:** Quick Command, Send Byte, Receive Byte, Write Byte, Read Byte, Write Word, Read Word, Process Call, Block Write, Block Read, Block Write-Block Read Process Call.

**Read Word örneği:** `S, SlaveAddr+W, ACK, Command, ACK, Sr, SlaveAddr+R, ACK, DataLow, ACK, DataHigh, NACK, P`.

**PEC (Packet Error Code):** CRC-8 tabanlı. Alanlar: Packet Bytes, PEC Input Coverage, Calculated PEC, Received PEC, PASS/FAIL.

**Timeout:** I²C'den önemli fark — SMBus bus timeout davranışlarını tanımlar. İzlenmeli: Clock LOW duration, Transaction timeout, Bus stuck detection.

---

### PMBus

Güç kaynağı/power-management cihazları için SMBus tabanlı command protokolü. Güncel tam PMBus revizyonu **1.5**; altında kullanılan SMBus sürümü **3.3.1**. Örnek cihazlar: DC/DC converter, Power module, Server PSU, POL regulator, Hot-swap controller, Digital power controller.

**Komut veritabanı (asgari):** PAGE, OPERATION, ON_OFF_CONFIG, VOUT_MODE, VOUT_COMMAND, READ_VIN, READ_VOUT, READ_IIN, READ_IOUT, READ_TEMPERATURE_1, READ_POUT, STATUS_BYTE, STATUS_WORD, CLEAR_FAULTS.

**Örnek transaction:** Host→PSU `READ_VOUT`; PSU→Host raw data. Toolkit: Command READ_VOUT, Raw 0x1234, Format Linear16, Exponent, Physical 12.04V.

**Linear11:** `Value = Mantissa × 2^Exponent` (exponent ve mantissa signed two's-complement). Bit view: bit 15–11 Exponent, bit 10–0 Mantissa.

**STATUS_WORD decoder:** ham değer (örn. 0x0840) tek sayı olarak bırakılmamalı — bit ağacı: VOUT fault, IOUT fault, Temperature, CML, Power Good, ...

---

### 1-Wire

Tek data hattı + ground, half-duplex; 1 master + N device aynı hattı paylaşır, bazı cihazlar parasite-power ile data hattından beslenir (ADI: tek data connection üzerinde half-duplex bus).

**Bus:** `VDD—Pull-up—DQ` ortak hattı, üzerine Device1/Device2/Device3 bağlı.

**Reset/Presence:** `Master Reset Pulse → Slave Presence Pulse → ROM Command → Function Command → Data`. Timing view: reset LOW, release, presence LOW, release.

**ROM ID:** çoğu cihaz benzersiz 64-bit registration number taşır — Family Code, Serial Number, CRC olarak parçalanmalı. Örnek: `28 FF 64 1D 91 16 03 5C` → Family 0x28, Serial ..., CRC 0x5C.

**ROM komutları (asgari):** READ ROM, MATCH ROM, SKIP ROM, SEARCH ROM.

**Search algorithm:** Bit, Complement Bit, Branch Choice, Discrepancy adımlarının ağaç (tree) olarak görselleştirilmesi değerli.

---

### Microwire

National Semiconductor kökenli, 3 telli basit seri haberleşme; eski EEPROM/ADC vb. peripheral'larda görülür. Microchip dokümantasyonu: half-duplex master/slave message passing, bazı implementasyonlarda control word sonrası target response.

Hatlar: SK (Serial Clock), DI (Data Input), DO (Data Output), CS (Chip Select).

**EEPROM örneği:** `CS → Start Bit → Opcode → Address → Data`. Örnek: 93xx EEPROM — READ, WRITE, ERASE, EWEN, EWDS komutları.

Toolkit bu protokolü **"SPI ile aynı" kabul etmemeli**; cihaz datasheet'indeki Clock edge, Command length, Address length, Word organization, 8-bit/16-bit organization bilgisine göre transaction oluşturmalı. Microchip halen 93AAxx ailesi gibi 3-wire Microwire EEPROM'lar için entegrasyon belgeleri yayımlıyor.

---

### USB

Çok katmanlı protokol ailesi; bu bölümde öncelikle fiziksel bağlantı + low-level packet görünümü. USB-IF güncel kütüphanesinde USB 2.0 temel spesifikasyonu ve electrical compliance belgeleri ayrı yayınlanır.

**USB 2.0 fiziksel sinyaller:** VBUS, D+, D- (differential pair), GND. USB Type-C yalnız "hız" değildir — konnektör + role/configuration yapısını da içerir. Toolkit ayırmalı: Connector, USB generation, Negotiated speed, Device role, Host role, VBUS, D+, D-, SuperSpeed lanes.

**Hız sınıfları:** USB 2.0'da Low/Full/High Speed; daha yeni ailelerde SuperSpeed ve USB4 katmanları ayrı ele alınmalı.

**Packet alanları:** SYNC, PID, Address, Endpoint, Frame Number, Data, CRC, EOP.

**PID türleri:** IN, OUT, SETUP, DATA0, DATA1, ACK, NAK, STALL, SOF.

**Control transfer:** `SETUP → DATA → STATUS`. Toolkit 3 seviyede göstermeli: Packet, Transaction, Transfer.

**Enumeration timeline:** Attach → Reset → Get Descriptor → Set Address → Get Configuration → Set Configuration.

**Descriptor decoder (tree view):** Device, Configuration, Interface, Endpoint, String, BOS. Örnek: VID 0x0483, PID 0x5740, Class CDC, Endpoint IN 0x81, Endpoint OUT 0x01.

**Transfer türleri** (ayrı renk): Control, Bulk, Interrupt, Isochronous.

**Entegrasyon sorunları:** Enumeration failed, Device not configured, Endpoint stalled, NAK storm, Invalid descriptor, Wrong packet size, VBUS present but no data, Charge-only cable, Speed fallback, Driver/class problem.

---

### Ethernet

PHY/MAC/üst protokol ayrımı net gösterilmeli: `Application → TCP/UDP → IP → Ethernet MAC → Ethernet PHY → Twisted Pair/Fiber`.

**MCU bağlantısı:** `STM32/MPU → RMII → Ethernet PHY → Magnetics → RJ45`. MAC-PHY arabirimleri: MII, RMII, GMII, RGMII, SGMII. Microchip güncel Ethernet PHY portföyü 10BASE-T, 100BASE-TX, 1000BASE-T dahil farklı PHY sınıflarını içerir.

**Frame alanları:** Preamble, SFD, Destination MAC, Source MAC, EtherType/Length, Payload, FCS, Inter-Packet Gap. Örnek: Destination `FF:FF:FF:FF:FF:FF`, Source `00:11:22:33:44:55`, EtherType `0x0806`, Payload ARP. MAC adreslerinin ağ üzerindeki iletim sırası ayrıca açıklanmalı.

**Link durumu (PHY register view):** Link UP, Speed 100 Mbps, Duplex Full, Auto-negotiation Complete, Partner 10/100 capable.

**MDIO/MDC:** PHY management interface — MDC, MDIO, PHY Address, Register Address, Read/Write decoder eklenebilir.

**Entegrasyon problemleri:** PHY not detected, Wrong PHY address, RMII clock missing, Link up but no packets, Duplex mismatch, Auto-negotiation failure, MAC address issue, ARP unresolved, Packet CRC errors, Dropped RX descriptors, DMA ring overflow.

---

### Single Pair Ethernet — SPE

Ethernet'i tek balanced twisted pair üzerinden taşıyan PHY ailesi. Sınıflar: 10BASE-T1S, 10BASE-T1L, 100BASE-T1, 1000BASE-T1.

**10BASE-T1S:** sensör/aktüatör ve multidrop sistemler için değerli. Microchip LAN8651: 10 Mbit/s, single balanced pair, half-duplex, multidrop yapı desteği.

**PLCA (Physical Layer Collision Avoidance):** Coordinator, Node ID, Node Count, Transmit Opportunity, Burst Count. Shared medium üzerinde cihazlara sıralı transmit opportunity vererek collision davranışını daha deterministik hale getirir.

**MAC-PHY:** bazı 10BASE-T1S cihazları host MCU'ya SPI ile bağlanabilir — native Ethernet MAC'ı olmayan sistemlerde de Ethernet stack kullanımı sağlar. Örnek: `MCU —SPI→ LAN8651 MAC-PHY → 10BASE-T1S`.

Toolkit alanları: PHY Type, T1S/T1L/T1, Point-to-point/multidrop, PLCA enabled, Node ID, Node count, Link speed, MAC-PHY or PHY.

---

### CAN Physical Layer

Yalnız physical layer + controller-transceiver ilişkisi: `MCU CAN Controller → TX/RX → CAN Transceiver → CAN_H/CAN_L → Bus`. NXP TJA1051 gibi high-speed CAN transceiver'lar ISO 11898-2 fiziksel arayüzünü uygular; CAN FD fast phase için daha yüksek data-rate timing desteği sunabilir.

**Differential:** `V_diff = V_CANH − V_CANL`. Dominant/Recessive durumları — yalnız voltage threshold değil, wired-AND arbitration davranışının temeli.

**Physical view:** Controller TX, CAN_H, CAN_L, Vdiff, Controller RX aynı timeline'da.

**Termination:** bus iki ucunda 120 ohm; enerjisiz `120‖120 = 60 ohm`.

**Split termination:** standart `CAN_H –120R– CAN_L`; split `CAN_H –60R–[C to GND/ref]–60R– CAN_L`.

**Topoloji:** önerilen linear trunk + short stub; problemli large star / long stub.

**Propagation:** girdiler Cable length, Propagation speed, Transceiver delay, Node delay, Bit rate, Sample point → fiziksel delay budget.

**Bit görünümü (PHY ekranı):** Dominant duration, Recessive duration, Edge timestamp, Edge-to-edge jitter, Differential amplitude.

**CAN FD:** physical view'da Nominal bitrate, Data bitrate, BRS transition farklı renk. Örnek: Arbitration 500 kbit/s, Data 2 Mbit/s, BRS anı timeline'da görülür.

**Entegrasyon hataları:** termination yok / tek / 3 adet, CAN_H/CAN_L ters, yanlış bitrate, yanlış sample point, uzun stub, bus-off, ACK yok, transceiver standby modu, 3.3/5V controller interface mismatch, CAN FD frame'in uyumsuz node'a gönderilmesi.

---

### LIN Physical Layer

Otomotivde düşük maliyetli sensör/aktüatör subnet'leri, single-wire physical bus: `MCU UART/LIN Controller → TX/RX → LIN Transceiver → LIN`. NXP TJA1021 gibi LIN transceiver'lar ISO 17987/LIN 2.x uyumlu 12V fiziksel bus ile MCU controller arasında dönüşüm yapar; 1–20 kBd sınıfında haberleşme destekler.

**Single-wire bus:** `VBAT—Pull-up—LIN` hattı üzerinde N adet Node.

**Logic:** Recessive/Dominant.

**LIN-UART ilişkisi:** temel byte aktarımı UART benzeri seri format kullanır, ancak frame başında Break, Sync, PID gibi LIN'e özgü yapılar bulunur. PHY screen: TXD, LIN Bus, RXD.

**Break:** normal UART karakterinden daha uzun dominant periyot. Toolkit: "Break detected", Duration: x bit times.

**Sync:** `0x55 = 01010101` — edge'ler üzerinden baud senkronizasyonu yapılabilir.

**Örnek bus:** Body Controller —LIN— Window switch / Mirror / Seat controller / Small actuator.

**Hata görünümü:** No break, Invalid sync, Wrong baud, No response, Bus stuck dominant, Bus stuck recessive, Wake-up detected, Checksum error, PID parity error.

---

### FlexRay Physical Layer

Yüksek hızlı, deterministik otomotiv haberleşmesi için differential physical layer. Kavramlar: Channel A, Channel B, Differential pair, Passive bus, Active star, Wake-up. NXP'nin aktif FlexRay transceiver ailesi ISO 17458-4 electrical physical layer ile uyumludur, 2.5–10 Mbit/s sınıfında haberleşme sağlar.

**Dual channel:** ECU1↔ECU2 hem Channel A hem Channel B üzerinden — redundancy veya ayrı communication resource amaçlı kullanılabilir.

**Topolojiler:** Point-to-point, Passive bus, Active star, Hybrid topology (NXP dokümantasyonu: passive linear bus ve active-star destekleniyor).

**Physical signal view:** TXD, BP, BM, Differential, RXD.

**Channel analysis:** her frame/log için Channel A / Channel B / Both filtrelenebilmeli.

**Timing (physical ekran):** Edge timestamp, Frame duration, Channel delay, A/B skew, Wake-up pattern, Idle, Activity.

**Active star örneği:** `ECU1 ─┐ / ECU2 ─┼─ Active Star ─ ECU4 / ECU3 ─┘`.

**Entegrasyon hataları:** Wrong channel, Channel A/B mapping error, No wake-up, Transceiver in sleep, Incorrect bitrate, Differential polarity issue, Channel asymmetry, Timing mismatch, Missing node activity.

---

### 3.1 için ortak Bit/Signal Analyzer davranışı

Tüm dijital arayüzler mümkün olduğunca ortak bir analiz motoru kullanmalı. Görünüm seviyeleri arası geçiş: `Electrical → Logic → Bits → Bytes → Transaction → Protocol`.

**RS-485 üzerinde Modbus RTU örneği:**
- Electrical: A/B voltages
- Logic: `1 0 0 0 0 0 ...`
- UART: `Start | D0..D7 | Stop`
- Bytes: `01 03 00 00 00 02 C4 0B`
- Protocol: Address=1, Function=0x03, Start Register=0, Quantity=2, CRC=Valid

**SPI:** Electrical → SCLK/MOSI/MISO/CS → Bits → Bytes → Register Transaction.

**I²C:** Electrical → SDA/SCL → START/bits/ACK → Address → Register → Payload.

**CAN:** CAN_H/CAN_L → Dominant/Recessive → CAN bits → Frame → Signal.

Amaç: ALP Comm Toolkit'in yalnız protokol decoder değil, **fiziksel haberleşmeden uygulama verisine kadar aynı transaction'ı katman katman açıklayabilen bir haberleşme analiz platformu** olması.

---

### Not — kaynağın devamı (3.2, kapsam dışı)

Satır 3495'ten itibaren kaynak **"3.2 Seri ve frame tabanlı protokoller"** bölümüne geçiyor ve okunan aralık (satır 3628) bu bölümün ortasında, protokol detaylarına geçmeden kesiliyor. Bu özetin kapsamı dışıdır, ayrı dosyada işlenecektir. Sadece kayıp olmasın diye kapsamı not edilir:

- Liste: Custom Binary Protocol, ASCII Protocol, Delimiter-Based Protocol, Length-Based Protocol, SLIP, COBS, HDLC, SDLC, PPP, KISS, XMODEM, YMODEM, ZMODEM, UBX, RTCM, AT Commands, Hayes Command Set.
- Çerçeve kavramları: Fixed Length, Start/End Delimiter, Length Field, Inter-Byte/Inter-Frame Timeout, Byte/Bit Stuffing, Escape Character, COBS, Sequence Counter, Checksum, CRC, ACK/NACK, Request-Response, Command-Response.
- Ortak **Serial Frame Analyzer** katmanları: `Raw Stream → Frame Boundary → Escaping/Stuffing Removal → Header → Length/Address/Command → Payload → Checksum/CRC → Decoded Fields`.
- Örnek raw stream: `73 91 AA 55 01 10 04 34 12 78 56 6A 3F  AA 55 01 20 02 01 00 8C 21 AA` — `73 91` gürültü olarak işaretlenmeli, `AA 55...` geçerli frame olarak otomatik bulunmalı.
- Parser durum makinesi: `SEARCHING, SYNC_FOUND, READING_HEADER, READING_LENGTH, READING_PAYLOAD, READING_CHECK, WAITING_END, VALIDATING, FRAME_COMPLETE, FRAME_ERROR, RESYNCHRONIZING`.

---

## Dikkat çekenler

1. **Çift 3.1 numaralandırması:** Kaynakta "3.1 Fiziksel arayüzler" hem satır 61'de (H2, kısa liste) hem satır 87'de "3.1 Fiziksel ve Düşük Seviye Haberleşme Arayüzleri" adıyla (H1, detaylı içerik) iki kez geçiyor — aynı numara, farklı başlık metni ve farklı başlık seviyesi. Ayrıca kaynakta her protokol (RS-232, SPI, I²C, ...) H1 (`#`) seviyesinde yazılmış, gerçek hiyerarşik konumu (3.1 altında alt başlık) yansıtılmamış. Bu özette hiyerarşi mantıksal olarak normalleştirildi (H2 ana bölüm, H3 protokol); başlık metinleri aynen korundu.
2. **Formül gösterimi bozuk:** Kaynaktaki tüm formüller `\[ ... \]` LaTeX blokları içinde ama satır satır parçalanmış, kaçış karakterleri (`\times`, `\frac`) düzensiz sızmış — muhtemelen Docs→Markdown dönüşüm hatası. Sayısal/mantıksal içerik doğrulanıp bu özette temiz gösterimle (`T_bit = 1/BaudRate` gibi) yazıldı; kod/UI'a geçirilirken kaynağın ham LaTeX parçaları değil buradaki temiz form esas alınmalı.
3. **UART genel parity formülü verilmemiş:** `N_char = 1+8+1 = 10 bit` yalnız 8N1 (parity yok) özel durumu için. Parity=Even/Odd olduğunda karakter uzunluğu (11 bit) formülü kaynakta açık yazılmamış — genelleştirme implementasyon sırasında gerekiyor.
4. **I3C hız rakamlarının versiyon bağımlılığı:** "SDR 12.5 Mbit/s / HDR 33.3 Mbit/s" hangi MIPI I3C spec revizyonuna ait belirtilmemiş; canlı standart olduğundan toolkit'te sabit sayı yerine güncellenebilir referans olarak tutulmalı.
5. **SMBus 3.3.1 / PMBus 1.5 sürüm numaraları** kaynakta sabit veriliyor ama bunlar zamanla revize edilen dış standartlar — toolkit'in bu bilgiyi nasıl güncel tutacağı (statik sabit mi, yapılandırılabilir mi) belirtilmemiş.
6. **RS-485 Unit Load hesabı idealize:** 32 UL / (1/8 UL) = 256 node hesaplaması yalnız elektriksel yük sınırını yansıtıyor; topoloji, kablo uzunluğu, stub etkisi ayrı ele alınmadığından toolkit bu sınırı "teorik azami" olarak mı yoksa "güvenli tasarım sınırı" olarak mı sunacak açık değil.
7. **RS-232 gerçek voltaj aralıkları verilmemiş:** Mark/Space açıklaması kaynakta "Basitleştirilmiş" olarak işaretli; ±3V–±15V gibi standart gerilim aralıkları yok, yalnızca polarite yönü var — toolkit'in Signal View'da gerçekçi voltaj mı yoksa yalnız polarite mi göstereceği belirsiz.
8. **Microwire/1-Wire için sabit decoder yeterli değil:** Her ikisi de "cihaz datasheet'ine göre" parametrik transaction kurulmasını istiyor (sabit komut seti yerine kullanıcı tanımlı alan uzunlukları) — bu, generic bir decoder yerine parametrik/şema tabanlı bir alt sistem gerektiriyor, kapsam ve efor küçümsenmemeli.
9. **"Ortak Bit/Signal Analyzer" mimarisi somutlaştırılmamış:** Kaynak yalnız "aynı görünüm seviyeleri" (Electrical→Logic→Bits→Bytes→Transaction→Protocol) istiyor; UART/SPI/I²C/CAN gibi çok farklı sinyal sayısı ve semantiğine sahip arayüzler için ortak bir veri modeli/arayüz tanımlanmamış — bu, mimari tasarım kararı gerektiren en soyut/zor gereksinimlerden biri.
10. **3.2'nin bu aralıkta yarım kalması:** Okunan satır aralığı (1–3628) "3.2 Seri ve frame tabanlı protokoller" bölümünün girişini içeriyor ama protokol bazlı detaylara (SLIP, COBS, HDLC, ...) geçmeden kesiliyor; bu içerik yukarıda kısa not olarak işaretlendi ama tam özeti ayrı dosyada yapılmalı.
