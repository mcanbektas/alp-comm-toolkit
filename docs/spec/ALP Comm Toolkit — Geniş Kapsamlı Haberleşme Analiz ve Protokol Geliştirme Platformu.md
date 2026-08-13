# **ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve Protokol Geliştirme Platformu**

## **1\. Rolün**

Sen kıdemli bir:

* Elektronik ve haberleşme mühendisi  
* Gömülü sistemler geliştiricisi  
* Endüstriyel haberleşme uzmanı  
* Otomotiv haberleşme protokolleri uzmanı  
* Deniz elektroniği ve navigasyon sistemleri uzmanı  
* React ve TypeScript geliştiricisi  
* Web tabanlı analiz yazılımı mimarı  
* Kullanıcı arayüzü ve kullanıcı deneyimi tasarımcısısın

Görevin, elektronik mühendisleri, gömülü sistem geliştiricileri, test mühendisleri, otomasyon mühendisleri, deniz elektroniği teknisyenleri ve öğrenciler tarafından kullanılabilecek kapsamlı bir web tabanlı haberleşme analiz platformu geliştirmektir.

Projenin adı:

# **ALP Comm Toolkit**

Tam açıklaması:

> Advanced Communication Protocol Analysis, Decoding, Simulation and Engineering Toolkit

Türkçe açıklaması:

> Haberleşme Protokolü Analiz, Çözümleme, Simülasyon ve Mühendislik Araçları

Bu proje basit bir seri port terminali veya HEX dönüştürücü olmamalıdır. Kullanıcıların fiziksel haberleşme arayüzlerinden uygulama katmanı protokollerine kadar farklı seviyelerde analiz yapabildiği modüler bir mühendislik platformu olmalıdır.

---

# **2\. Projenin temel hedefi**

ALP Comm Toolkit aşağıdaki temel ihtiyaçları karşılamalıdır:

1. Ham haberleşme verisini görüntülemek  
2. Gelen byte dizisini paketlere ayırmak  
3. Paket içerisindeki adres, komut, uzunluk, veri ve checksum alanlarını belirlemek  
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

Ana ürün yalnızca hazır protokolleri çözmemelidir. Platformun merkezinde kullanıcı tanımlı protokolleri destekleyen bir **Custom Protocol Studio** bulunmalıdır.

---

# **3\. Desteklenecek haberleşme katmanları**

Araçları haberleşme katmanlarına göre sınıflandır.

## **3.1 Fiziksel arayüzler**

* UART  
* RS-232  
* RS-422  
* RS-485  
* TTL UART  
* CMOS UART  
* Current Loop  
* 4–20 mA  
* SPI  
* Quad SPI  
* Octal SPI  
* I²C  
* I3C  
* SMBus  
* PMBus  
* 1-Wire  
* Microwire  
* USB  
* Ethernet  
* Single Pair Ethernet  
* CAN Physical Layer  
* LIN Physical Layer  
* FlexRay Physical Layer

# **3.1 Fiziksel ve Düşük Seviye Haberleşme Arayüzleri**

Bu bölümde desteklenen arayüzler yalnızca isim olarak listelenmemeli; her arayüz için kullanıcıya fiziksel/lojik çalışma prensibi, veri yönü, zamanlama, bit ve byte görünümü, elektriksel seviye, topoloji, temel hesaplamalar, yazılım konfigürasyonu, örnek transaction, hata durumları ve entegrasyon notları sunulmalıdır.

Her arayüz sayfasında mümkün olduğunca aşağıdaki ortak görünümler bulunmalıdır:

* **Overview:** Arayüzün amacı ve kullanım alanı  
* **Signal View:** Hatların ve sinyallerin görsel gösterimi  
* **Bit View:** Tek transaction'ın bit seviyesinde gösterimi  
* **Byte View:** HEX, binary, decimal ve ASCII karşılığı  
* **Timing View:** Clock, data, enable, acknowledge gibi sinyallerin zaman diyagramı  
* **Configuration:** Baud rate, clock, mode, address, data width gibi parametreler  
* **Transaction Builder:** Kullanıcının örnek aktarım oluşturabilmesi  
* **Decoder:** Girilen veya canlı yakalanan verinin çözümlenmesi  
* **Calculator:** Hız, süre, throughput, timeout ve ilgili mühendislik hesapları  
* **Error View:** Framing, parity, NACK, timeout, collision gibi hata durumlarının gösterilmesi  
* **Examples:** Gerçek sensör, PLC, MCU, modem, bellek veya cihaz haberleşme örnekleri  
* **Integration Notes:** Gömülü yazılım ve sistem entegrasyonu sırasında dikkat edilecek noktalar

---

## **UART — Universal Asynchronous Receiver/Transmitter**

UART, paralel veriyi seri bit dizisine dönüştüren ve seri veriyi tekrar paralel veriye çeviren asenkron haberleşme çevrebirimidir. UART kendi başına bir voltaj seviyesi veya kablo standardı değildir. Aynı UART bit akışı 1.8 V CMOS, 3.3 V CMOS, 5 V TTL-compatible, RS-232 veya bir RS-485 transceiver üzerinden taşınabilir.

UART'ta ayrı clock hattı bulunmaz. Verici ve alıcı önceden aynı baud rate ve frame konfigürasyonunu kullanmalıdır.

Temel hatlar:

TX  → Transmit

RX  → Receive

GND → Common reference

Normal bağlantı:

Device A TX ─────────────→ Device B RX

Device A RX ←───────────── Device B TX

Device A GND ───────────── Device B GND

TX ve RX birbirinden bağımsız olduğu için UART normalde full-duplex çalışabilir.

### **UART frame yapısı**

Tipik bir UART karakteri:

Idle | Start | D0 D1 D2 D3 D4 D5 D6 D7 | Parity | Stop | Idle

  1  |   0   |          DATA             |   P    |  1   |  1

En yaygın konfigürasyon:

115200 8N1

anlamı:

Baud Rate : 115200

Data Bits : 8

Parity    : None

Stop Bits : 1

8N1 için:

\[  
N\_{char}=1+8+1=10\\ bit  
\]

Bit süresi:

\[  
T\_{bit}=\\frac{1}{BaudRate}  
\]

115200 baud:

\[  
T\_{bit}=8.6806\\ \\mu s  
\]

Karakter süresi:

\[  
T\_{char}=10\\times8.6806=86.806\\ \\mu s  
\]

Maksimum teorik byte rate:

\[  
R\_{byte}=\\frac{115200}{10}=11520\\ byte/s  
\]

Bu nedenle 115200 baud, 115200 byte/s anlamına gelmez.

Microchip UART belgelerinde asenkron UART'ın NRZ kullandığı, idle durumunun Mark yani logic-1 olduğu, Start bitinin logic-0, Stop bitinin logic-1 olduğu ve klasik asenkron UART'ta veri bitlerinin LSB-first aktarılabildiği belirtilmektedir.

### **Bit görünümü örneği**

Gönderilecek byte:

0x53

Binary:

0101 0011

Bit isimleri:

D7 D6 D5 D4 D3 D2 D1 D0

 0  1  0  1  0  0  1  1

LSB-first UART aktarımı:

Start D0 D1 D2 D3 D4 D5 D6 D7 Stop

  0    1  1  0  0  1  0  1  0   1

Toolkit bu görünümde her bitin üzerine gelindiğinde:

Bit: D4

Value: 1

Start Time: 43.40 us

End Time: 52.08 us

Duration: 8.68 us

gibi bilgi gösterebilmelidir.

### **Oversampling**

UART receiver genellikle RX sinyalini baud rate'in katı hızda örnekler.

Örnek:

8x oversampling

16x oversampling

16x ve 8x oversampling modern USART çevrebirimlerinde yaygın seçeneklerdir. Örneğin Microchip USART implementasyonlarında receiver RX hattını 8 veya 16 kat hızla örnekleyebilir.

\[  
f\_{sample}=Oversampling\\times BaudRate  
\]

115200 baud ve 16x:

\[  
f\_{sample}=1.8432\\ MHz  
\]

### **Baud rate error**

Hedef baud:

115200

gerçek baud:

115107

ise:

\[  
Error=115107-115200=-93  
\]

\[  
Error\_{%}=  
\\frac{-93}{115200}\\times100  
\=-0.0807%  
\]

Toolkit hem transmitter hem receiver clock toleransını kabul etmeli:

TX Baud Error

RX Baud Error

Relative Baud Mismatch

göstermelidir.

### **Parity**

Destek:

None

Even

Odd

Even parity'de toplam `1` bitlerinin sayısı çift yapılır.

Örnek:

Data \= 10110010

1 count \= 4

Even parity \= 0

Odd parity  \= 1

### **UART hata türleri**

Decoder aşağıdaki hata durumlarını ayırmalıdır:

Parity Error

Framing Error

Overrun Error

Noise Error

Break Detection

Receiver Timeout

Buffer Overflow

Unexpected Idle

Baud Mismatch Suspected

Framing Error, Stop biti beklenen konumda logic-1 görülememesi gibi durumlarda oluşabilir.

Overrun Error ise yeni karakter geldiğinde önceki karakter yazılım tarafından alınmamışsa meydana gelebilir.

### **Yazılım görünümü**

UART Configuration paneli:

Baud Rate       : 115200

Data Bits       : 8

Parity          : None

Stop Bits       : 1

Flow Control    : None

Bit Order       : LSB First

Oversampling    : 16x

RX Timeout      : 100 ms

Buffer Size     : 4096 byte

Encoding        : Raw / ASCII / UTF-8

Line Ending     : None / CR / LF / CRLF

### **Canlı UART görünümü**

12:41:03.201 RX 48 65 6C 6C 6F 0D 0A

ASCII            H  e  l  l  o \\r \\n

Length: 7 byte

Frame Time: 607.6 us

### **Kullanım örnekleri**

STM32 ↔ GNSS

STM32 ↔ LTE modem

MCU ↔ Bluetooth module

USB-UART ↔ Debug console

MCU ↔ RS-485 transceiver

MCU ↔ RS-232 transceiver

Flight Controller ↔ Telemetry radio

PLC service port ↔ PC

---

# **RS-232**

RS-232, seri verinin single-ended gerilim sinyalleri üzerinden taşınmasını tanımlayan fiziksel arayüz standardıdır. UART ile sık kullanılmasına rağmen UART ile RS-232 aynı şey değildir.

Tipik yapı:

MCU UART

   │

TX/RX 3.3 V

   │

MAX3232

   │

RS-232

   │

PC / PLC / Instrument

MAX3232 gibi transceiverlar MCU logic seviyeleri ile TIA/EIA-232 seviyeleri arasında dönüşüm yapar. TI'nin MAX3232 ailesi TIA/EIA-232-F gereksinimlerini karşılayan UART-to-RS-232 elektriksel arabirim örneğidir.

### **RS-232 sinyal mantığı**

UART logic görünümü ile RS-232 hat polaritesi birbirinden ayrılmalıdır.

RS-232'de Mark ve Space kavramları kullanılır.

Basitleştirilmiş:

Mark  → Logic 1 → negatif hat gerilimi

Space → Logic 0 → pozitif hat gerilimi

UART:

Idle \= logic 1

olduğundan RS-232 fiziksel TX hattı idle durumda negatif olabilir.

Toolkit'te iki görünüm yan yana gösterilmelidir:

UART Side:

3.3V ────────

0V      \_\_\_\_\_\_

RS-232 Side:

Negative ─────

Positive   \_\_\_\_

Böylece kullanıcı logic inversion kavramını görebilir.

### **DTE ve DCE**

RS-232 entegrasyonunda önemli kavramlar:

DTE \= Data Terminal Equipment

DCE \= Data Communication Equipment

Klasik örnek:

PC    \= DTE

Modem \= DCE

DTE/DCE ayrımı pin yönlerinin anlaşılmasını sağlar.

### **DB9 sinyalleri**

Toolkit DB9 pin görünümünde en az:

TXD

RXD

GND

RTS

CTS

DTR

DSR

DCD

RI

sinyallerini açıklamalıdır.

Yalnız üç hat kullanılan bağlantı:

TXD

RXD

GND

Hardware handshaking:

RTS

CTS

ile genişletilebilir.

### **Null modem**

İki DTE cihaz doğrudan bağlandığında TX/RX çaprazlanması gerekebilir.

Toolkit:

Device A Type: DTE

Device B Type: DTE

girişinden:

Null Modem Required

TX ↔ RX

RX ↔ TX

RTS ↔ CTS

...

uyarısı verebilmelidir.

### **RS-232 yazılım görünümü**

Yazılım tarafında kullanıcı yine UART benzeri:

9600 8N1

19200 8E1

115200 8N1

ayarlarını kullanır.

Fiziksel RS-232 katmanı UART frame'ini değiştirmez.

### **Örnek**

9600 8N1

Data \= 0x41

ASCII \= A

Bit view:

Start  D0 D1 D2 D3 D4 D5 D6 D7 Stop

  0     1  0  0  0  0  0  1  0   1

Ayrıca toolkit bunun RS-232 fiziksel polarite karşılığını göstermelidir.

### **Entegrasyon hataları**

TTL UART directly connected to RS-232

TX/TX connection

Wrong DTE/DCE assumption

Wrong null-modem configuration

No common reference

Hardware flow control enabled only on one side

Wrong baud/parity/stop

CR/LF mismatch

---

# **RS-422**

RS-422 balanced differential seri haberleşme standardıdır. RS-232'nin single-ended yapısına kıyasla veri iki iletken arasındaki gerilim farkı ile temsil edilir.

A / B

veya

TX+ / TX-

Receiver:

\[  
V\_{diff}=V\_{+}-V\_{-}  
\]

değerine bakar.

RS-422 temel olarak **bir driver'ın bir veya daha fazla receiver'a veri göndermesi** için tasarlanmıştır. TI'nin RS-422 uygulama örneğinde bir driver'ın aynı diferansiyel bus üzerinde 10 receiver'a kadar sürmesi standardın klasik yapısı olarak açıklanır.

### **Full-duplex RS-422**

Tipik dört data iletkeni:

TX+

TX-

RX+

RX-

Bağlantı:

Device A TX+ ───────── Device B RX+

Device A TX- ───────── Device B RX-

Device A RX+ ───────── Device B TX+

Device A RX- ───────── Device B TX-

### **Bit görünümü**

UART:

1 0 1 1 0

RS-422 transceiver bunu differential hale getirir:

Bit      Vdiff

1        \+V

0        \-V

1        \+V

1        \+V

0        \-V

Toolkit aynı transaction için:

UART Bit

TX+

TX-

Vdiff

Decoded Logic

dört kanal gösterebilmelidir.

### **Termination**

Uzun veya hızlı hatlarda terminasyon hattın differential karakteristik empedansına uygun seçilir.

Genel amaç:

\[  
R\_T\\approx Z\_0  
\]

Örneğin 100–120 ohm sınıfındaki twisted-pair kabloda benzer değerde termination görülebilir.

### **Yazılım**

RS-422 yazılım katmanı çoğu zaman UART olarak görülür:

Baud

Data bits

Parity

Stop bits

Fakat toolkit ayrıca:

Mode: Simplex / Full Duplex

Driver Count

Receiver Count

Cable Length

Termination

Propagation Velocity

parametrelerini kabul etmelidir.

### **Örnek kullanım**

Encoder → Motion controller

Navigation sensor → Control computer

Industrial sensor → PLC

Spacecraft equipment interface

Long-distance serial telemetry

RS-422 balanced differential yapı ve multidrop receiver kullanımı nedeniyle uzun mesafeli ve gürültülü ortamlarda tercih edilebilir.

---

# **RS-485**

RS-485, balanced differential ve multipoint seri haberleşme için en önemli fiziksel katmanlardan biridir.

RS-485 bir üst seviye protokol değildir.

Dolayısıyla:

RS-485 ≠ Modbus

Doğrusu:

Modbus RTU

     ↓

UART

     ↓

RS-485 Transceiver

     ↓

A/B Differential Bus

şeklindedir.

### **Half-duplex RS-485**

En yaygın yapı:

A \============================== A

B \============================== B

Tüm cihazlar aynı pair'i paylaşır.

Bir anda normalde tek driver bus'ı sürer.

### **Full-duplex RS-485**

İki differential pair kullanılır:

TX+/TX-

RX+/RX-

### **Transceiver kontrolü**

Tipik transceiver:

DI  \= Driver Input

RO  \= Receiver Output

DE  \= Driver Enable

/RE \= Receiver Enable

A/B \= Bus

MCU:

UART TX ─→ DI

UART RX ←─ RO

GPIO ───── DE

GPIO ───── /RE

Half-duplex'te yazılım için önemli olay:

1\. DE \= 1

2\. UART TX başlat

3\. Son byte shift register'dan tamamen çıksın

4\. DE \= 0

5\. Receiver moda geç

Yalnız `TX buffer empty` interrupt'ına bakmak bazı implementasyonlarda erken olabilir. Toolkit:

TX Register Empty

vs

Transmission Complete

farkını öğretmelidir.

### **Differential logic**

Receiver:

\[  
V\_{AB}=V\_A-V\_B  
\]

değerini değerlendirir.

Klasik RS-485 standardında receiver threshold bölgesi yaklaşık ±200 mV temelinde tanımlanır; modern fail-safe transceiverlar 0 V differential idle/open/short durumunu bilinen logic seviyesine taşıyacak farklı iç thresholdlar kullanabilir.

### **Termination**

Nominal twisted-pair RS-485 tasarımında yaygın:

120 ohm \------------------- 120 ohm

   |                           |

A \============================= A

B \============================= B

İki adet 120 ohm termination paralel olarak görüldüğünde:

\[  
R\_{eq}=120||120=60\\ ohm  
\]

Enerjisiz bus üzerinde A-B arasının yaklaşık 60 ohm ölçülmesi iki adet 120 ohm terminasyonun bulunduğuna dair pratik bir göstergedir.

RS-485 termination'ın amacı kablo karakteristik empedansı ile yükü eşleştirerek yansımaları azaltmaktır. TI RS-485 kaynakları 120 ohm'u nominal twisted-pair termination değeri olarak açıklar.

### **Bias / fail-safe**

Hiçbir driver aktif değilken:

A/B floating

durumu oluşabilir.

Termination nedeniyle:

\[  
V\_{AB}\\approx0  
\]

olabilir.

Bu durumda:

* internal fail-safe receiver  
* external bias resistor

kullanılabilir.

Toolkit Bias Calculator şu girdileri almalıdır:

VCC

Pull-up resistor

Pull-down resistor

Termination resistance

Receiver threshold

Number of terminations

ve:

Idle VAB

Bias Current

Termination Current

Noise Margin

hesaplamalıdır.

### **Unit Load**

Klasik RS-485 bir receiver load'u **Unit Load** kavramıyla tanımlar.

Bir standard bus driver'ı 32 unit load'a göre değerlendirilir. 1/8 UL receiver teorik olarak çok daha fazla node kullanılmasına izin verir. TI, 1/8 unit-load cihazlarla teorik 256 node örneğini verir.

Toolkit:

Node 1: 1/8 UL

Node 2: 1/4 UL

Node 3: 1 UL

...

Total UL \= ...

Maximum Allowed \= 32 UL

hesabı yapabilmelidir.

### **Propagation delay**

\[  
T\_{prop}=\\frac{L}{v\_p}  
\]

Örneğin:

Cable length \= 500 m

Propagation velocity \= 2×10^8 m/s

\[  
T\_{prop}=2.5\\ \\mu s  
\]

Round trip:

\[  
T\_{RT}=5\\ \\mu s  
\]

### **Bit ve bus görünümü**

Toolkit'te aynı ekran:

UART TX

DE

A

B

A-B

UART RX

kanallarını göstermelidir.

Örnek:

UART TX: 01 03 00 00 00 02 C4 0B

DE:      \_\_\_\_\_\_████████████\_\_\_\_\_\_\_\_

A/B:     differential waveform

### **Turnaround**

Request-response sisteminde:

Master TX

↓

DE off

↓

Bus idle

↓

Slave processing

↓

Slave TX

gösterilmelidir.

Ölçümler:

TX Duration

DE Release Delay

Bus Turnaround

Slave Response Delay

Inter-frame Gap

Total Transaction Time

### **Yaygın entegrasyon problemleri**

A/B polarity swapped

No termination

Three or more termination resistors

Star topology

Long stubs

DE released too early

DE released too late

Two nodes transmitting simultaneously

No fail-safe

Different ground potentials

Wrong UART parameters

Incorrect Modbus silent timing

Echo interpreted as response

RS-485'in multipoint ve shared-medium yapısı nedeniyle contention oluşmaması gerekir.

---

# **TTL UART**

TTL UART ayrı bir frame protokolü değildir. UART verisinin TTL-compatible logic seviyeleri üzerinden doğrudan taşındığını ifade eder.

Örnek:

USB-UART Adapter TX → MCU RX

USB-UART Adapter RX ← MCU TX

GND                  ↔ GND

Önemli nokta:

UART \= framing

TTL \= electrical logic family/compatibility

şeklinde ayrılmalıdır.

### **Toolkit logic compatibility görünümü**

Kullanıcı:

Device A VOH(min)

Device A VOL(max)

Device B VIH(min)

Device B VIL(max)

değerlerini girmelidir.

HIGH kontrolü:

\[  
VOH\_{min}\>VIH\_{min}  
\]

LOW kontrolü:

\[  
VOL\_{max}\<VIL\_{max}  
\]

Sağlanıyorsa:

Logic Compatibility: PASS

aksi halde:

WARNING: Level Translation May Be Required

### **Kullanıcıya kesinlikle yalnız:**

3.3 V

5 V

seçtirip karar verilmemelidir.

Çünkü gerçek uyumluluk datasheet'teki:

VIH

VIL

VOH

VOL

Absolute Maximum

5 V Tolerant

değerlerine bağlıdır.

### **Bit görünümü**

3.3 V örneği:

Logic 1 → yaklaşık HIGH level

Logic 0 → yaklaşık LOW level

Toolkit:

Voltage View

Logic View

UART Bit View

arasında geçiş yapabilmelidir.

---

# **CMOS UART**

CMOS UART da UART frame'inin CMOS logic seviyeleri ile taşınmasıdır.

Özellikle:

1.2 V

1.8 V

2.5 V

3.3 V

SoC ve mikrodenetleyiciler arasında önemlidir.

Örnek:

1.8 V Processor UART

          │

    Level Translator

          │

3.3 V GNSS Module

Toolkit her iki yönü ayrı değerlendirmelidir:

A TX → B RX

B TX → A RX

çünkü iki cihazın output/input karakteristikleri simetrik olmayabilir.

Örnek sonuç:

A → B: PASS

B → A: FAIL

Reason:

B VOH \= 1.8 V

A VIH \= 2.0 V

Bu özellik entegratör için basit fakat oldukça değerlidir.

---

# **Current Loop**

Current Loop, bilgiyi hat geriliminden çok **hat akımı** üzerinden taşıyan arayüzlerin genel sınıfıdır.

İki ana kullanım ayrılmalıdır:

Analog Current Loop

Digital Current Loop

Analog örnek:

4–20 mA

0–20 mA

Tarihsel dijital current-loop sistemlerinde ise farklı akım seviyeleri binary durumları temsil edebilir.

Current-loop arayüzlerinin endüstriyel sistemlerde tercih edilmesinin önemli nedeni uzun kabloda hat direncinin oluşturduğu gerilim düşümüne rağmen loop compliance sınırları içinde akımın korunabilmesidir. Analog Devices current-loop kaynakları bu yapının uzun kablo ve gürültülü endüstriyel ortam avantajını açıklar.

### **Temel Ohm kanunu**

Receiver üzerindeki shunt:

\[  
V=I\\times R  
\]

Örnek:

I \= 20 mA

R \= 100 ohm

\[  
V=2V  
\]

Toolkit Current Loop ekranı:

Loop Supply

Transmitter Drop

Cable Resistance

Receiver Resistance

Loop Current

Remaining Compliance Voltage

değerlerini göstermelidir.

---

# **4–20 mA**

4–20 mA, proses otomasyonu ve endüstriyel sensör sistemlerinde kullanılan analog current-loop standardıdır.

Temel mapping:

4 mA  \= Minimum measurement

20 mA \= Maximum measurement

Örneğin:

Pressure sensor:

0 bar   → 4 mA

100 bar → 20 mA

Analog Devices'in endüstriyel current-loop örneklerinde 4–20 mA sinyali uzaktaki sensör değerinin PLC'ye taşınması için kullanılan klasik arayüz olarak ele alınır.

### **Scaling**

\[  
I=  
4mA+  
16mA  
\\frac{x-x\_{min}}  
{x\_{max}-x\_{min}}  
\]

Tersi:

\[  
x=  
x\_{min}+  
(x\_{max}-x\_{min})  
\\frac{I-4mA}{16mA}  
\]

### **Örnek**

Sensör:

0–250 bar

ölçülen:

13.6 mA

\[  
x=  
250\\times  
\\frac{13.6-4}{16}  
\]

\[  
x=150\\ bar  
\]

Toolkit çıktısı:

Loop Current:       13.600 mA

Normalized:         60.00 %

Engineering Value:  150.00 bar

### **250 ohm shunt örneği**

\[  
V=I\\times250  
\]

4 mA:

\[  
V=1V  
\]

20 mA:

\[  
V=5V  
\]

Dolayısıyla:

4–20 mA → 1–5 V

elde edilir.

### **Loop compliance**

Loop supply tüm voltage drop'ları karşılayabilmelidir:

\[  
V\_{supply}\\ge  
V\_{transmitter}  
\+  
I(R\_{wire}+R\_{load})  
\+  
V\_{margin}  
\]

Toolkit:

24 V supply

Transmitter minimum voltage: 10 V

Cable resistance: 100 ohm

Input resistance: 250 ohm

Current: 20 mA

girdisinden kullanılabilir voltage margin'i hesaplamalıdır.

### **Fault görünümü**

Toolkit:

Under-range

Normal range

Over-range

Open Loop

Short suspected

Sensor fault

durumlarını yapılandırılabilir eşiklerle gösterebilmelidir.

---

# **SPI — Serial Peripheral Interface**

SPI, host ile bir veya daha fazla peripheral arasında clock tabanlı senkron seri haberleşme sağlar.

Yaygın sinyaller:

SCLK  Serial Clock

MOSI  Host → Peripheral

MISO  Peripheral → Host

CS    Chip Select

Yeni terminolojide:

COPI

CIPO

gibi isimler de kullanılabilir.

SPI yaygın olarak full-duplex çalışabilir.

Microchip SPI belgelerinde SPI dört temel CPOL/CPHA moduyla tanımlanır.

### **SPI Mode**

Mode  CPOL CPHA

0      0    0

1      0    1

2      1    0

3      1    1

CPOL:

0 → Clock idle LOW

1 → Clock idle HIGH

CPHA:

0 → ilk clock edge'inde sample

1 → ikinci clock edge'inde sample

### **Toolkit timing görünümü**

Örnek Mode 0:

CS   ─────\\\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_/────

SCLK \_\_\_\_\_\_/‾\\\_/‾\\\_/‾\\\_/‾\\\_\_\_\_\_\_\_\_\_

MOSI \-----D7--D6--D5--D4------------

MISO \-----Q7--Q6--Q5--Q4------------

Kullanıcı bir bite tıklayınca:

Bit: MOSI D5

Sample Edge: Rising

Shift Edge: Falling

Setup Time: ...

Hold Time: ...

görülebilmelidir.

### **Transfer süresi**

\[  
T=\\frac{N\_{clock}}{f\_{SCLK}}  
\]

Örnek:

32 clock

10 MHz

\[  
T=3.2\\ \\mu s  
\]

### **Full-duplex özelliği**

SPI'da her clock pulse ile aynı anda:

MOSI → bir bit

MISO ← bir bit

aktarılabilir.

Örneğin register read:

MOSI: 80 00

MISO: XX 5A

Toolkit göstermeli:

TX: 0x80 0x00

RX: 0xFF 0x5A

Command byte: 0x80

Dummy TX:     0x00

Returned:     0x5A

### **Register transaction örneği**

IMU:

Register 0x75

Read bit \= bit7

Command:

0x75 | 0x80 \= 0xF5

Transaction:

CS LOW

TX 0xF5

TX 0x00

RX dummy

RX 0x71

CS HIGH

### **SPI yazılım parametreleri**

Clock Frequency

CPOL

CPHA

Mode

Bit Order

Word Size

CS Active Level

CS Setup Time

CS Hold Time

Inter-word Delay

Duplex

Bit order cihazdan cihaza değişebilir; bazı SPI çevrebirimleri MSB-first veya LSB-first seçimine izin verir.

### **Hata teşhisi**

Toolkit özellikle:

Wrong CPOL

Wrong CPHA

Wrong bit order

CS timing violation

Clock too fast

Unexpected dummy byte

RX shifted by one bit

All 0xFF

All 0x00

MISO tri-state

Wrong register read/write bit

durumları için örnek pattern gösterebilmelidir.

Yanlış CPOL/CPHA alınan verinin geçersiz veya kaymış görünmesine neden olabilir.

---

# **Quad SPI — QSPI**

Quad SPI, seri bellek haberleşmesinde birden fazla data hattı kullanarak SPI throughput'unu artırır.

Hatlar:

IO0

IO1

IO2

IO3

SCLK

CS

Normal SPI'daki MOSI/MISO kavramı Quad modunda bidirectional IO lane'lere dönüşebilir.

### **Transfer fazları**

Tipik Flash Read:

Command

Address

Dummy

Data

Örnek:

Command: 0xEB

Address: 0x001234

Dummy:   6 cycles

Data:    256 byte

Toolkit transaction timeline:

CS

│

├── Command      1 lane

├── Address      4 lane

├── Dummy        4 lane

└── Data         4 lane

şeklinde gösterebilmelidir.

Microchip QSPI controller dokümanlarında QSPI'nin standard SPI peripheral iletişimi yanında serial Flash ve memory-mapped/XIP kullanımını destekleyebildiği belirtilir.

### **Raw throughput**

SDR Quad:

\[  
R=4f\_{clock}  
\]

100 MHz:

\[  
R=400Mbit/s  
\]

Ancak efektif throughput:

\[  
Efficiency=  
\\frac{PayloadCycles}  
{Command+Address+Dummy+PayloadCycles}  
\]

ile düşer.

### **Toolkit**

Command Width: 1/2/4

Address Width: 1/2/4

Data Width: 1/2/4

Clock

Dummy Cycles

Address Length

Payload Length

SDR/DDR

girdilerinden gerçek transfer süresini hesaplamalıdır.

---

# **Octal SPI — OSPI**

Octal SPI:

IO0 … IO7

olmak üzere sekiz data lane kullanır.

Modern external Flash/PSRAM sistemlerinde:

SDR

DDR

DQS

memory-mapped

XIP

özellikleri görülebilir.

Microchip'in Octal SPI bellek arayüzü örneğinde IO0–IO7 yanında DQS data strobe ve memory-mapped/XIP kullanım desteği bulunur.

### **Teorik hız**

Octal SDR:

\[  
R=8f  
\]

Octal DDR:

\[  
R=16f  
\]

100 MHz DDR:

\[  
R=1.6Gbit/s  
\]

### **Transaction view**

Command

Address

Mode bits

Dummy

DQS

Payload

her biri farklı renkte gösterilmelidir.

Toolkit command/address/data lane sayılarını ayrı kabul etmelidir çünkü her faz aynı lane width ile çalışmak zorunda değildir.

---

# **I²C**

I²C iki telli, senkron ve adres tabanlı multi-device seri bus'tır.

Hatlar:

SDA → Serial Data

SCL → Serial Clock

SDA/SCL tipik olarak open-drain/open-collector mantığıyla çalışır ve pull-up dirençleri kullanılır.

### **Temel transaction**

START

ADDRESS

R/W

ACK

DATA

ACK

DATA

ACK

STOP

### **START**

SCL HIGH iken

SDA HIGH → LOW

### **STOP**

SCL HIGH iken

SDA LOW → HIGH

### **7-bit address**

Örneğin device address:

0x68

Write address byte:

\[  
(0x68 \<\< 1)|0  
\]

0xD0

Read:

\[  
(0x68 \<\< 1)|1  
\]

0xD1

Toolkit kesinlikle:

7-bit address

8-bit write address

8-bit read address

ayrımını göstermelidir.

Bu, entegrasyonda çok sık karıştırılan bir konudur.

### **Bit görünümü**

Address 0x68 Write:

1 1 0 1 0 0 0 0

│             │

└ address \----┘ R/W

Ardından dokuzuncu clock:

ACK

### **ACK/NACK**

Her sekiz data bitinden sonra receiver dokuzuncu clock sırasında ACK/NACK bildirir.

Toolkit:

Byte 1: 0xD0 ACK

Byte 2: 0x75 ACK

Byte 3: 0x01 NACK

gösterebilmelidir.

### **Register read örneği**

START

0x68 \+ W

ACK

Register 0x75

ACK

REPEATED START

0x68 \+ R

ACK

Data 0x71

NACK

STOP

Görsel:

S | D0 | A | 75 | A | Sr | D1 | A | 71 | N | P

### **I²C hızları**

Toolkit en az:

Standard Mode

Fast Mode

Fast-mode Plus

High-speed Mode

parametrelerini desteklemeli; kullanıcının custom SCL değeri girmesine izin vermelidir.

### **Transfer süresi**

Bir byte \+ ACK:

\[  
9\\ clock  
\]

Basitleştirilmiş:

\[  
T\\approx\\frac{N\_{clock}}{f\_{SCL}}  
\]

Örneğin:

400 kHz

10 byte total bus transaction

START/STOP hariç yaklaşık:

\[  
90/400000=225\\ \\mu s  
\]

### **Clock stretching**

Target SCL hattını LOW tutarak controller'ı bekletebilir.

Toolkit timing:

SCL expected: 2.5 us period

Stretch detected: 43 us

gösterebilmelidir.

### **Arbitration**

Multi-controller yapıda iki controller aynı anda bus'a erişirse dominant LOW davranışı üzerinden arbitration gerçekleşebilir.

Toolkit:

Controller A: 1

Controller B: 0

Observed SDA: 0

Controller A loses arbitration

simülasyonu gösterebilmelidir.

### **Bus scan**

Örnek:

0x1E ACK → Magnetometer?

0x50 ACK → EEPROM?

0x68 ACK → IMU/RTC?

Toolkit adresi otomatik cihaz adı olarak kesin kabul etmemeli:

Possible devices

şeklinde göstermelidir; aynı adresi birçok cihaz kullanabilir.

---

# **I3C**

I3C, iki telli sensor/control bus yaklaşımını I²C uyumluluğu, daha yüksek hız, dynamic addressing ve in-band interrupt gibi özelliklerle geliştiren MIPI standardıdır.

Hatlar:

SDA

SCL

MIPI'ye göre I3C SDR base raw rate 12.5 Mbit/s, kullanılabilir veri hızı yaklaşık 11 Mbit/s düzeyindedir; HDR modlarında raw rate 33.3 Mbit/s seviyesine ulaşabilir.

### **I²C'den ayrılan önemli kavramlar**

Dynamic Address Assignment

Common Command Codes

In-Band Interrupt

Hot-Join

Controller Role Request

SDR

HDR

### **Dynamic address**

Bir target'ın static address'i bulunabilir ancak bus başlangıcında controller dynamic address atayabilir.

Toolkit:

PID

BCR

DCR

Static Address

Dynamic Address

alanlarını göstermelidir.

### **Bus discovery görünümü**

Target 1

PID: 0x123456789ABC

Dynamic Address: 0x08

Target 2

PID: 0x00A112334455

Dynamic Address: 0x09

### **IBI**

I²C'de ayrı interrupt GPIO gerektiren bazı işlemler I3C'de **In-Band Interrupt** üzerinden bus içinde bildirilebilir.

Toolkit timeline:

Controller idle

↓

Target requests IBI

↓

Controller ACK

↓

Target interrupt payload

göstermelidir.

### **CCC**

Common Command Codes ayrı decoder kategorisi olmalıdır:

Broadcast CCC

Direct CCC

Toolkit CCC ID, yön, hedef ve payload'ı ayrıştırmalıdır.

---

# **SMBus**

SMBus, I²C fiziksel yapısını temel alan fakat sistem yönetimi için daha sıkı transaction ve timeout kuralları tanımlayan bus'tır.

Güncel yayınlanmış SMBus spesifikasyonu 3.3.1'dir.

Hatlar:

SMBCLK

SMBDAT

Opsiyonel:

SMBALERT\#

### **SMBus transaction türleri**

Toolkit aşağıdaki yapıları ayrı gösterebilmelidir:

Quick Command

Send Byte

Receive Byte

Write Byte

Read Byte

Write Word

Read Word

Process Call

Block Write

Block Read

Block Write-Block Read Process Call

### **Örnek Read Word**

S

SlaveAddr \+ W

ACK

Command

ACK

Sr

SlaveAddr \+ R

ACK

DataLow

ACK

DataHigh

NACK

P

### **PEC**

SMBus Packet Error Code, CRC-8 tabanlı hata kontrolü sağlar.

Toolkit:

Packet Bytes

PEC Input Coverage

Calculated PEC

Received PEC

PASS/FAIL

göstermelidir.

### **Timeout**

I²C ile SMBus arasındaki önemli entegrasyon farklarından biri SMBus'ın bus timeout davranışlarını tanımlamasıdır.

Bu nedenle toolkit:

Clock LOW duration

Transaction timeout

Bus stuck detection

alanlarını izlemelidir.

---

# **PMBus**

PMBus, güç kaynakları ve power-management cihazlarının izlenmesi ve kontrolü için SMBus tabanlı command protocol'dür. Güncel tam PMBus revision 1.5'tir ve PMBus'ın altında kullanılan güncel SMBus sürümü 3.3.1 olarak listelenmektedir.

Örnek cihazlar:

DC/DC converter

Power module

Server PSU

POL regulator

Hot-swap controller

Digital power controller

### **Yaygın komutlar**

Toolkit command database içermelidir:

PAGE

OPERATION

ON\_OFF\_CONFIG

VOUT\_MODE

VOUT\_COMMAND

READ\_VIN

READ\_VOUT

READ\_IIN

READ\_IOUT

READ\_TEMPERATURE\_1

READ\_POUT

STATUS\_BYTE

STATUS\_WORD

CLEAR\_FAULTS

### **Örnek transaction**

Host → PSU:

READ\_VOUT

PSU → Host:

Raw data

Toolkit:

Command: READ\_VOUT

Raw: 0x1234

Format: Linear16

Exponent: ...

Physical: 12.04 V

göstermelidir.

### **Linear11**

\[  
Value=Mantissa\\times2^{Exponent}  
\]

Exponent ve mantissa signed two's-complement olarak çözümlenmelidir.

Toolkit bit view:

15........11 10................0

| Exponent |      Mantissa      |

şeklinde göstermelidir.

### **STATUS\_WORD decoder**

Ham:

0x0840

tek sayı olarak bırakılmamalıdır.

Bit ağacı:

STATUS\_WORD

├─ VOUT fault

├─ IOUT fault

├─ Temperature

├─ CML

├─ Power Good

...

şeklinde açıklanmalıdır.

---

# **1-Wire**

1-Wire tek data hattı \+ ground ile çalışan half-duplex bus'tır. Bir master ve bir veya daha fazla device aynı hattı paylaşabilir. Bazı cihazlar parasite-power yöntemiyle data hattından enerji de alabilir. Analog Devices 1-Wire dokümantasyonu bu yapıyı tek data connection üzerinde half-duplex bus olarak tanımlar.

### **Bus**

VDD

 |

Pull-up

 |

DQ \===============================

      |          |          |

   Device1    Device2    Device3

### **Reset / Presence**

Temel transaction:

Master Reset Pulse

↓

Slave Presence Pulse

↓

ROM Command

↓

Function Command

↓

Data

Toolkit timing view:

Master reset LOW

Release

Presence LOW

Release

şeklinde göstermelidir.

### **ROM ID**

Birçok 1-Wire cihaz benzersiz 64-bit registration number taşır.

Toolkit:

Family Code

Serial Number

CRC

olarak parçalamalıdır.

Örnek:

28 FF 64 1D 91 16 03 5C

Family: 0x28

Serial: ...

CRC: 0x5C

### **ROM komutları**

En az:

READ ROM

MATCH ROM

SKIP ROM

SEARCH ROM

desteklenmelidir.

### **Search algorithm visualization**

Birden fazla cihazda:

Bit

Complement Bit

Branch Choice

Discrepancy

adımlarının ağaç olarak gösterilmesi çok değerlidir.

---

# **Microwire**

Microwire, National Semiconductor kökenli basit üç telli seri haberleşme yaklaşımıdır ve özellikle eski EEPROM, ADC ve benzeri peripheral cihazlarda görülür.

Microchip Microwire dokümantasyonunda protokol half-duplex master/slave message passing yapısı olarak tanımlanır; bazı implementasyonlarda bir control word'den sonra target response gelir.

Yaygın hat isimleri:

SK   Serial Clock

DI   Data Input

DO   Data Output

CS   Chip Select

EEPROM örneği:

CS

Start Bit

Opcode

Address

Data

Örneğin:

93xx EEPROM

READ

WRITE

ERASE

EWEN

EWDS

gibi command yapıları bulunabilir.

Toolkit bu protokolü “SPI ile aynı” kabul etmemeli; cihaz datasheet'indeki:

Clock edge

Command length

Address length

Word organization

8-bit / 16-bit organization

bilgilerine göre transaction oluşturmalıdır.

Microchip halen 93AAxx ailesi gibi 3-wire Microwire EEPROM'lar için entegrasyon belgeleri yayımlamaktadır.

---

# **USB**

USB çok katmanlı bir protokol ailesidir. 3.1 bölümünde öncelikle fiziksel bağlantı ve low-level packet görünümü ele alınmalıdır.

USB-IF'in güncel doküman kütüphanesinde USB 2.0 temel spesifikasyonu ve güncel electrical compliance belgeleri ayrı olarak yayınlanmaktadır.

### **USB 2.0 fiziksel sinyaller**

VBUS

D+

D-

GND

D+ / D- differential data pair'dir.

USB Type-C ise yalnızca “USB hızı” değildir; konnektör ve role/configuration yapısını da içerir.

Toolkit:

Connector

USB generation

Negotiated speed

Device role

Host role

VBUS

D+

D-

SuperSpeed lanes

kavramlarını birbirinden ayırmalıdır.

### **USB speed sınıfları**

USB 2.0 tarafında:

Low Speed

Full Speed

High Speed

ayrımı bulunur.

Daha yeni USB ailelerinde SuperSpeed ve USB4 katmanları ayrıca ele alınmalıdır.

### **USB packet görünümü**

Low-level decoder mümkün olduğunda:

SYNC

PID

Address

Endpoint

Frame Number

Data

CRC

EOP

alanlarını ayırmalıdır.

### **PID**

Packet Identifier'da packet türü gösterilmelidir:

IN

OUT

SETUP

DATA0

DATA1

ACK

NAK

STALL

SOF

### **USB transaction görünümü**

Control transfer örneği:

SETUP

↓

DATA

↓

STATUS

Toolkit bunu üç seviyede göstermelidir:

Packet

Transaction

Transfer

Bu ayrım USB öğrenme ve debug açısından çok değerlidir.

### **Enumeration**

Device bağlandığında:

Attach

Reset

Get Descriptor

Set Address

Get Configuration

Set Configuration

timeline'ı gösterilmelidir.

### **Descriptor decoder**

Device Descriptor

Configuration Descriptor

Interface Descriptor

Endpoint Descriptor

String Descriptor

BOS

alanlarını tree view ile göstermelidir.

Örnek:

VID: 0x0483

PID: 0x5740

Class: CDC

Endpoint IN: 0x81

Endpoint OUT: 0x01

### **Transfer türleri**

Control

Bulk

Interrupt

Isochronous

ayrı renklerle gösterilmelidir.

### **Entegrasyon sorunları**

Enumeration failed

Device not configured

Endpoint stalled

NAK storm

Invalid descriptor

Wrong packet size

VBUS present but no data

Charge-only cable

Speed fallback

Driver/class problem

---

# **Ethernet**

Ethernet bölümünde PHY, MAC ve üst protokol ayrımı açık biçimde gösterilmelidir.

Application

   ↓

TCP / UDP

   ↓

IP

   ↓

Ethernet MAC

   ↓

Ethernet PHY

   ↓

Twisted Pair / Fiber

### **MCU bağlantısı**

Tipik gömülü sistem:

STM32 / MPU

    │

   RMII

    │

 Ethernet PHY

    │

  Magnetics

    │

   RJ45

Yaygın MAC-PHY arabirimleri:

MII

RMII

GMII

RGMII

SGMII

Microchip'in güncel Ethernet PHY portföyü 10BASE-T, 100BASE-TX ve 1000BASE-T dahil farklı PHY sınıflarını içerir.

### **Ethernet frame low-level görünümü**

Toolkit frame'i:

Preamble

SFD

Destination MAC

Source MAC

EtherType/Length

Payload

FCS

Inter-Packet Gap

şeklinde ayırmalıdır.

### **Örnek**

Destination: FF:FF:FF:FF:FF:FF

Source:      00:11:22:33:44:55

EtherType:   0x0806

Payload:     ARP

Bit/byte view'da MAC adreslerinin ağ üzerinde iletim sırası ayrıca açıklanmalıdır.

### **Link durumu**

PHY register görünümü:

Link: UP

Speed: 100 Mbps

Duplex: Full

Auto-negotiation: Complete

Partner: 10/100 capable

### **MDIO/MDC**

PHY management interface için:

MDC

MDIO

PHY Address

Register Address

Read/Write

decoder eklenebilir.

### **Entegrasyon problemleri**

PHY not detected

Wrong PHY address

RMII clock missing

Link up but no packets

Duplex mismatch

Auto-negotiation failure

MAC address issue

ARP unresolved

Packet CRC errors

Dropped RX descriptors

DMA ring overflow

---

# **Single Pair Ethernet — SPE**

Single Pair Ethernet, Ethernet'i tek balanced twisted pair üzerinden taşıyan PHY ailesidir.

Önemli sınıflar:

10BASE-T1S

10BASE-T1L

100BASE-T1

1000BASE-T1

### **10BASE-T1S**

Özellikle sensör/aktüatör ve multidrop sistemleri için değerlidir.

Microchip LAN8651 10BASE-T1S uygulaması 10 Mbit/s, single balanced pair, half-duplex ve multidrop yapı desteğini gösterir.

Örnek:

Controller

    |

\====+======+======+====== Single Pair

    |      |      |

 Sensor  Motor   IO

### **PLCA**

10BASE-T1S'de Physical Layer Collision Avoidance kullanılabilir.

Toolkit:

PLCA Coordinator

Node ID

Node Count

Transmit Opportunity

Burst Count

parametrelerini göstermelidir.

PLCA, shared medium üzerinde cihazlara sıralı transmit opportunity vererek collision davranışını daha deterministik hale getirir.

### **MAC-PHY**

Bazı 10BASE-T1S cihazları host MCU'ya:

SPI

ile bağlanabilir.

Bu çok değerlidir çünkü MCU'nun native Ethernet MAC içermediği sistemlerde de Ethernet stack kullanılabilir.

Örnek:

MCU

 │ SPI

LAN8651 MAC-PHY

 │

10BASE-T1S

### **Toolkit**

PHY Type

T1S/T1L/T1

Point-to-point / multidrop

PLCA enabled

Node ID

Node count

Link speed

MAC-PHY or PHY

göstermelidir.

---

# **CAN Physical Layer**

CAN bölümünün bu kısmında yalnız physical layer ve controller-transceiver ilişkisi ele alınmalıdır.

MCU CAN Controller

        │

      TX/RX

        │

 CAN Transceiver

        │

 CAN\_H / CAN\_L

        │

       Bus

NXP TJA1051 gibi high-speed CAN transceiverlar ISO 11898-2 fiziksel arayüzünü uygular ve CAN FD fast phase için daha yüksek data-rate timing desteği sunabilir.

### **Differential bus**

CAN\_H

CAN\_L

Receiver:

\[  
V\_{diff}=V\_{CANH}-V\_{CANL}  
\]

değerini değerlendirir.

CAN'de:

Dominant

Recessive

durumları vardır.

Bu kavram 0/1'in yalnız voltage threshold karşılığı gibi düşünülmemelidir; wired-AND arbitration davranışının temelidir.

### **Physical view**

Toolkit:

Controller TX

CAN\_H

CAN\_L

Vdiff

Controller RX

kanallarını aynı timeline'da göstermelidir.

### **Termination**

Linear bus'ın iki fiziksel ucunda tipik:

120 ohm                               120 ohm

   |                                     |

CAN\_H \====================================

CAN\_L \====================================

Enerjisiz bus:

\[  
120||120=60\\ ohm  
\]

### **Split termination görünümü**

Toolkit conventional ve split termination farkını açıklayabilir:

Standard:

CAN\_H \--120R-- CAN\_L

Split:

CAN\_H \--60R--+--60R-- CAN\_L

             |

             C

             |

            GND/reference

### **Bus topology**

Önerilen:

Linear trunk

\+ short stubs

Problemli:

large star

long stub

### **Propagation**

CAN arbitration nedeniyle propagation delay bit timing açısından önemlidir.

Toolkit:

Cable length

Propagation speed

Transceiver delay

Node delay

Bit rate

Sample point

girdilerini kullanarak fiziksel delay budget gösterebilmelidir.

### **Bit görünümü**

CAN protocol kısmında frame ayrıştırılacak olsa da PHY ekranında:

Dominant duration

Recessive duration

Edge timestamp

Edge-to-edge jitter

Differential amplitude

gösterilmelidir.

### **CAN FD**

Physical view:

Nominal bitrate

Data bitrate

BRS transition

alanlarını farklı renkle işaretlemelidir.

Örneğin:

Arbitration: 500 kbit/s

Data:        2 Mbit/s

BRS anı timeline'da görülebilmelidir.

### **Entegrasyon hataları**

No termination

One termination

Three termination resistors

CAN\_H / CAN\_L swapped

Wrong bitrate

Wrong sample point

Long stub

Bus-off

No ACK

Transceiver standby mode

3.3/5 V controller interface mismatch

CAN FD frame sent to incompatible node

---

# **LIN Physical Layer**

LIN, otomotivde düşük maliyetli sensör ve aktüatör subnetleri için kullanılan single-wire physical bus'tır.

MCU:

UART/LIN Controller

       │

      TX/RX

       │

 LIN Transceiver

       │

      LIN

NXP TJA1021 gibi LIN transceiverlar ISO 17987/LIN 2.x uyumlu 12 V fiziksel bus ile MCU controller arasında dönüşüm yapar ve 1–20 kBd sınıfında haberleşme destekler.

### **Single-wire bus**

VBAT

 |

Pull-up

 |

LIN \==============================

      |        |        |

     Node     Node     Node

### **Logic**

Bus durumları:

Recessive

Dominant

olarak ele alınmalıdır.

### **LIN ve UART ilişkisi**

LIN frame'inin temel byte aktarımı UART benzeri seri format kullanır ancak frame başlangıcında:

Break

Sync

PID

gibi LIN'e özgü yapılar bulunur.

PHY screen:

TXD

LIN Bus

RXD

kanallarını göstermelidir.

### **Break**

LIN Break normal UART data karakterinden daha uzun dominant periyottur.

Toolkit:

Break detected

Duration: x bit times

göstermelidir.

### **Sync**

0x55

pattern'i:

01010101

olduğu için edge'ler üzerinden baud synchronization yapılabilir.

### **Örnek bus**

Body Controller

      |

     LIN

      |

 ├─ Window switch

 ├─ Mirror

 ├─ Seat controller

 └─ Small actuator

### **Hata görünümü**

No break

Invalid sync

Wrong baud

No response

Bus stuck dominant

Bus stuck recessive

Wake-up detected

Checksum error

PID parity error

---

# **FlexRay Physical Layer**

FlexRay yüksek hızlı, deterministik automotive communication için geliştirilmiş differential physical layer kullanır.

Önemli fiziksel kavramlar:

Channel A

Channel B

Differential pair

Passive bus

Active star

Wake-up

NXP'nin aktif FlexRay transceiver ailesi ISO 17458-4 electrical physical layer ile uyumludur ve 2.5–10 Mbit/s sınıfında haberleşme sağlar.

### **Dual channel**

            Channel A

ECU1 \========================== ECU2

 │                               │

 └==============================─┘

             Channel B

İki kanal:

Redundancy

veya

separate communication resources

amaçlı kullanılabilir.

### **Topolojiler**

Toolkit:

Point-to-point

Passive bus

Active star

Hybrid topology

gösterebilmelidir.

NXP FlexRay transceiver dokümantasyonunda passive linear bus ve active-star kullanım desteklenmektedir.

### **Physical signal view**

TXD

BP

BM

Differential

RXD

gibi transceiver tarafındaki sinyaller gösterilmelidir.

### **Channel analysis**

Her frame/log için:

Channel A

Channel B

Both

filtrelenebilmelidir.

### **Timing**

FlexRay'in asıl deterministik timing yapısı üst protokol katmanında ele alınacak olsa da physical ekran:

Edge timestamp

Frame duration

Channel delay

A/B skew

Wake-up pattern

Idle

Activity

göstermelidir.

### **Active star**

Toolkit active-star görünümünde:

ECU1 ─┐

ECU2 ─┼─ Active Star ─ ECU4

ECU3 ─┘

gibi topoloji oluşturabilmelidir.

### **Entegrasyon hataları**

Wrong channel

Channel A/B mapping error

No wake-up

Transceiver in sleep

Incorrect bitrate

Differential polarity issue

Channel asymmetry

Timing mismatch

Missing node activity

---

# **3.1 için ortak Bit / Signal Analyzer davranışı**

Yukarıdaki bütün dijital arayüzler mümkün olduğunca ortak bir analiz motorunu kullanmalıdır.

Kullanıcı aşağıdaki görünüm seviyeleri arasında geçebilmelidir:

Electrical

↓

Logic

↓

Bits

↓

Bytes

↓

Transaction

↓

Protocol

Örneğin RS-485 üzerinde Modbus RTU mesajı için:

Electrical:

A / B voltages

Logic:

1 0 0 0 0 0 ...

UART:

Start | D0..D7 | Stop

Bytes:

01 03 00 00 00 02 C4 0B

Protocol:

Address \= 1

Function \= 0x03

Start Register \= 0

Quantity \= 2

CRC \= Valid

Aynı yaklaşım SPI için:

Electrical

↓

SCLK/MOSI/MISO/CS

↓

Bits

↓

Bytes

↓

Register Transaction

I²C için:

Electrical

↓

SDA/SCL

↓

START / bits / ACK

↓

Address

↓

Register

↓

Payload

CAN için:

CAN\_H/CAN\_L

↓

Dominant/Recessive

↓

CAN bits

↓

Frame

↓

Signal

şeklinde ilerlemelidir.

Bu yapı ALP Comm Toolkit'in yalnız protokol decoder değil, **fiziksel haberleşmeden uygulama verisine kadar aynı transaction'ı katman katman açıklayabilen bir haberleşme analiz platformu** olmasını sağlamalıdır.

## **3.2 Seri ve frame tabanlı protokoller**

* Custom Binary Protocol  
* ASCII Protocol  
* Delimiter-Based Protocol  
* Length-Based Protocol  
* SLIP  
* COBS  
* HDLC  
* SDLC  
* PPP  
* KISS  
* XMODEM  
* YMODEM  
* ZMODEM  
* UBX  
* RTCM  
* AT Commands  
* Hayes Command Set

Bu bölümde fiziksel haberleşme katmanından gelen byte stream'in nasıl anlamlı paketlere ayrıldığı ele alınmalıdır. UART, RS-232, RS-422, RS-485, USB-Serial, TCP stream veya dosya kaynağından gelen veri her zaman bir paket sınırıyla birlikte gelmeyebilir. Bu nedenle platformun temel görevi, kesintisiz bir byte stream içinden frame sınırlarını tespit etmek, frame'i doğrulamak, alanlara ayırmak ve kullanıcıya bit/byte seviyesinde açıklamaktır.

Bir seri protokol genel olarak aşağıdaki kavramlardan bir veya birkaçını kullanabilir:

Fixed Length

Start Delimiter

End Delimiter

Start \+ End Delimiter

Length Field

Inter-Byte Timeout

Inter-Frame Timeout

Byte Stuffing

Bit Stuffing

Escape Character

COBS

Sequence Counter

Checksum

CRC

ACK / NACK

Request / Response

Command / Response

Platformun ortak **Serial Frame Analyzer** altyapısı aşağıdaki katmanları göstermelidir:

Raw Stream

   ↓

Frame Boundary

   ↓

Escaping / Stuffing Removal

   ↓

Header

   ↓

Length / Address / Command

   ↓

Payload

   ↓

Checksum / CRC

   ↓

Decoded Fields

Örnek raw stream:

73 91 AA 55 01 10 04 34 12 78 56 6A 3F

AA 55 01 20 02 01 00 8C 21 AA

Toolkit:

73 91

byte'larını garbage/noise olarak işaretleyebilmeli ve:

AA 55 ...

ile başlayan geçerli frame'i otomatik bulabilmelidir.

Parser durumları:

SEARCHING

SYNC\_FOUND

READING\_HEADER

READING\_LENGTH

READING\_PAYLOAD

READING\_CHECK

WAITING\_END

VALIDATING

FRAME\_COMPLETE

FRAME\_ERROR

RESYNCHRONIZING

olmalıdır.

---

# **Custom Binary Protocol**

Custom Binary Protocol, herhangi bir açık standart protokole bağlı olmayan ve cihaz üreticisinin veya geliştiricinin kendi frame formatını tanımladığı binary haberleşme yapısını ifade eder.

Bu kategori ALP Comm Toolkit'in en önemli parçalarından biri olmalıdır çünkü gerçek endüstriyel cihazların önemli bir kısmı tamamen üreticiye özel binary protokoller kullanabilir.

Örnek frame:

AA 55 03 10 04 34 12 78 56 C9 27

Örnek yapı:

Offset  Length  Field

0       2       Header

2       1       Address

3       1       Command

4       1       Payload Length

5       4       Payload

9       2       CRC

Görsel:

AA 55 | 03 | 10 | 04 | 34 12 78 56 | C9 27

─────   ──   ──   ──   ───────────   ─────

SYNC    ADR   CMD  LEN      DATA        CRC

Toolkit kullanıcının herhangi bir field üzerine tıklayarak byte ve bit karşılığını görmesini sağlamalıdır.

Örneğin:

Byte: 0x34

Binary:

00110100

Bit:

7 6 5 4 3 2 1 0

0 0 1 1 0 1 0 0

Custom protocol aşağıdaki framing yöntemlerinden herhangi birini kullanabilir:

Fixed Length

Start Byte

Multiple Start Bytes

End Byte

Start \+ End

Length Field

Timeout

Escaped Delimiter

COBS

SLIP-like

HDLC-like

### **Fixed-Length Custom Frame**

Örneğin her mesaj:

16 byte

ise parser 16 byte'lık bloklar oluşturabilir.

Ancak stream başlangıcı bilinmiyorsa yalnız fixed length yeterli olmayabilir.

Örneğin:

Noise:

4F

Frames:

AA 01 02 ... 16 byte

AA 02 03 ... 16 byte

bir byte kayması bütün sonraki frame'lerin yanlış ayrılmasına neden olabilir.

Bu nedenle fixed-length frame'lerde bile:

Header

Known field

CRC

gibi doğrulama mekanizmaları kullanılmalıdır.

### **Length-Based Custom Binary**

Frame:

AA 55 | LEN | PAYLOAD | CRC

Örneğin:

AA 55 04 11 22 33 44 A5 C1

Burada:

LEN \= 0x04

payload:

11 22 33 44

olarak yorumlanır.

Toolkit length alanı için şu seçenekleri desteklemelidir:

Length includes payload only

Length includes header

Length includes checksum

Length includes complete frame

Çünkü üretici protokollerinde length semantics standart değildir.

### **Address / Command Yapısı**

Tipik:

HEADER

ADDRESS

COMMAND

LENGTH

DATA

CRC

Örnek:

AA 01 20 02 32 64 8D

Decoder:

Header:     AA

Address:    01

Command:    20 \= Set Output

Length:     02

Channel:    0x32

Value:      0x64

Checksum:   Valid

şeklinde gösterebilmelidir.

### **Request / Response eşleştirme**

Örneğin:

TX:

AA 01 10 00 CRC

RX:

AA 01 90 02 19 00 CRC

Toolkit:

Request Command:  0x10

Response Command: 0x90

Response Time:

4.27 ms

eşleştirmesi yapabilmelidir.

### **Sequence Counter**

Örnek:

AA 01 10 ...

AA 02 10 ...

AA 03 10 ...

AA 05 10 ...

Toolkit:

Expected Sequence: 04

Received Sequence: 05

Possible Lost Frame: 1

göstermelidir.

### **Decoder davranışı**

Custom Binary Decoder:

* sync byte aramalı,  
* olası frame başlangıçlarını tespit etmeli,  
* length'i doğrulamalı,  
* CRC/checksum kontrol etmeli,  
* enum alanlarını isimlendirmeli,  
* signed/unsigned dönüşümü yapmalı,  
* endian dönüşümü yapmalı,  
* scale/offset uygulamalı,  
* sequence counter takip etmeli,  
* request-response eşleştirmeli,  
* bilinmeyen byte'ları raw bırakmalıdır.

---

# **ASCII Protocol**

ASCII Protocol, haberleşme mesajlarının insan tarafından okunabilir karakterlerden oluşturulduğu seri protokol sınıfıdır.

Örneğin:

TEMP,25.3,40.2\\r\\n

HEX:

54 45 4D 50 2C 32 35 2E 33 2C 34 30 2E 32 0D 0A

Toolkit aynı veriyi eş zamanlı göstermelidir:

HEX:

54 45 4D 50 2C 32 35 2E 33

ASCII:

T  E  M  P  ,  2  5  .  3

### **Line termination**

En yaygın:

CR

LF

CRLF

HEX:

CR \= 0x0D

LF \= 0x0A

Dolayısıyla:

AT\\r

HEX olarak:

41 54 0D

olur.

Toolkit:

Show CR as \<CR\>

Show LF as \<LF\>

seçeneği sunmalıdır.

Görünüm:

AT\<CR\>

OK\<CR\>\<LF\>

### **ASCII command-response örneği**

TX:

READ:TEMP\\r\\n

RX:

TEMP:25.4\\r\\n

Parser:

Command: READ

Parameter: TEMP

Response Type: TEMP

Value: 25.4

Unit: °C

Response Time: 18.3 ms

### **Numeric parsing**

Destek:

Decimal:

123

Signed:

\-45

Float:

25.75

Scientific:

1.25E-3

Hex text:

0x7F

Boolean:

ON

OFF

Enum:

AUTO

MANUAL

### **ASCII parser sorunları**

Toolkit şu durumları göstermelidir:

Missing CR

Missing LF

Unexpected character

Invalid UTF-8

Invalid numeric field

Too many fields

Too few fields

Line too long

Response timeout

Echo detected

Özellikle modemler terminalden gönderilen komutu geri echo edebilir:

TX:

AT

RX:

AT

OK

Toolkit:

Echo: AT

Final Result: OK

ayrımını yapabilmelidir.

---

# **Delimiter-Based Protocol**

Delimiter-based protokollerde frame başlangıcı veya sonu özel byte veya byte dizileri ile belirlenir.

Örnek:

STX DATA ETX

ASCII kontrol karakterleri kullanıldığında:

STX \= 0x02

ETX \= 0x03

Örnek:

02 31 32 33 34 03

ASCII:

\<STX\>1234\<ETX\>

### **Start \+ End delimiter**

AA ... 55

Örnek:

AA 01 10 22 33 C7 55

Parser:

Search AA

↓

Collect bytes

↓

Find 55

↓

Validate frame

### **Delimiter collision problemi**

Payload içinde delimiter çıkabilir:

Header \= AA

End    \= 55

Payload:

10 55 20

Parser çıplak `55` byte'ını frame sonu sanabilir.

Bu problem:

Escaping

Byte stuffing

Length field

COBS

gibi yöntemlerle çözülür.

### **Escape örneği**

Tanımlar:

END    \= 0x7E

ESCAPE \= 0x7D

Payload:

01 7E 02

wire üzerinde:

01 7D 5E 02

gibi taşınabilir.

Exact dönüşüm protokole özeldir; toolkit custom escape rule tanımlamaya izin vermelidir.

### **Decoder**

Delimiter Decoder şu durumları ayırmalıdır:

Valid Frame

Empty Frame

Missing Start

Missing End

Nested Start

Unexpected Escape

Truncated Escape

Maximum Frame Length Exceeded

Timeout Before End

---

# **Length-Based Protocol**

Length-Based framing, frame'in toplam veya payload uzunlığının header içindeki bir alandan belirlenmesine dayanır.

Örnek:

AA 55 05 10 20 30 40 50 CRC

      ^^

      Length

Parser:

1\. Header bul

2\. Length oku

3\. Gerekli byte sayısını hesapla

4\. Payload tamamlanana kadar bekle

5\. Checksum/CRC oku

6\. Validate et

### **Length alanı boyutları**

Destek:

uint8

uint16 LE

uint16 BE

uint24

uint32

variable-length integer

Örnek:

Length bytes:

34 12

Little-endian:

\[  
0x1234=4660  
\]

Big-endian yorumlanırsa:

\[  
0x3412=13330  
\]

olur.

Bu nedenle length endianness açıkça tanımlanmalıdır.

### **Güvenlik ve parser limiti**

Length alanına körü körüne güvenilmemelidir.

Örnek bozuk frame:

AA 55 FF FF ...

Parser:

Length \= 65535

diye 64 kB beklememelidir.

Schema:

Maximum Frame Length: 1024

ise:

ERROR:

Declared length exceeds maximum

gösterilmelidir.

### **Resynchronization**

Bozuk length alınırsa parser sonraki olası header'ı aramalıdır.

AA 55 FF ...

Garbage

AA 55 04 ...

ikinci header'a geri senkronize olabilmelidir.

---

# **SLIP — Serial Line Internet Protocol**

SLIP temel amacı IP datagramlarını seri hat üzerinde frame'lemek olan oldukça basit bir framing mekanizmasıdır. RFC 1055, SLIP'in IP datagramları için seri hat framing yöntemi olduğunu ve özel olarak `END` ve `ESC` karakterlerini kullandığını tanımlar.

Özel byte'lar:

END     \= 0xC0

ESC     \= 0xDB

ESC\_END \= 0xDC

ESC\_ESC \= 0xDD

RFC 1055'e göre payload içindeki `0xC0`:

DB DC

olarak;

`0xDB`:

DB DD

olarak encode edilir.

### **Örnek**

Ham payload:

45 00 C0 11 DB 22

SLIP encoded:

45 00 DB DC 11 DB DD 22 C0

Toolkit byte view:

45

00

DB DC → decoded C0

11

DB DD → decoded DB

22

C0    → END

### **Decoder state**

READING

ESCAPE\_SEEN

FRAME\_COMPLETE

ERROR

Pseudo davranış:

if byte \== C0:

    frame complete

else if byte \== DB:

    next byte escaped

else:

    append byte

ESC sonrasında:

DC → C0

DD → DB

çevrilmelidir.

### **SLIP'in sınırlamaları**

SLIP'in kendisi:

* address alanı tanımlamaz,  
* packet type tanımlamaz,  
* CRC/checksum sağlamaz,  
* sequence sağlamaz,  
* retransmission sağlamaz.

RFC 1055 de SLIP'i yalnız basit packet framing mekanizması olarak tanımlar.

Toolkit bu nedenle:

Framing: Valid

Integrity: Not provided by SLIP

şeklinde ayrım göstermelidir.

---

# **COBS — Consistent Overhead Byte Stuffing**

COBS, bir frame içinden belirli bir byte değerini, çoğunlukla `0x00` değerini tamamen kaldıran reversible byte-stuffing algoritmasıdır.

Bu sayede:

0x00

frame delimiter olarak güvenle kullanılabilir.

COBS'un temel amacı, delimiter collision problemini deterministik ve düşük worst-case overhead ile çözmektir. Orijinal Cheshire–Baker çalışması, COBS'un en kötü durumda 254 input byte başına en fazla bir byte ek overhead oluşturduğunu açıklar.

### **Temel mantık**

COBS encoded stream:

CODE DATA DATA DATA CODE DATA ...

şeklinde code block'lardan oluşur.

Code byte genel olarak bir sonraki `0x00` byte'ın nerede olduğunu temsil eder.

### **Basit örnek**

Ham:

11 22 00 33

COBS:

03 11 22 02 33

Frame delimiter eklenirse:

03 11 22 02 33 00

Açıklama:

03

↓

sonraki 2 byte non-zero:

11 22

↓

original zero

02

↓

sonraki 1 byte:

33

### **Başka örnek**

Input:

00

COBS:

01 01

ve dış delimiter ile:

01 01 00

### **0xFF code**

Bir blok içinde 254 adet sıfır olmayan byte varsa:

FF

code byte kullanılır ve yeni block başlar. Bu, COBS'un worst-case overhead'ini sınırlayan temel mekanizmadır.

### **Toolkit görünümü**

RAW:

11 22 00 33

COBS:

03 11 22 02 33

WIRE:

03 11 22 02 33 00

### **COBS Decoder hataları**

Zero found inside encoded frame

Code exceeds remaining length

Truncated block

Missing delimiter

Maximum frame exceeded

Decode produced invalid length

### **COBS \+ CRC**

COBS kendi başına integrity sağlamaz.

Önerilen custom yapı:

Payload

↓

CRC ekle

↓

COBS encode

↓

0x00 delimiter

Wire:

\[COBS(DATA \+ CRC)\] 00

Receiver:

Find 00

↓

COBS decode

↓

CRC validate

↓

Parse payload

---

# **HDLC — High-Level Data Link Control**

HDLC bit-oriented bir data-link framing ailesidir.

Temel frame görünümü:

FLAG

ADDRESS

CONTROL

INFORMATION

FCS

FLAG

Flag:

01111110

HEX gösterimi:

0x7E

PPP'nin HDLC-like framing standardı da frame başlangıcı ve sonunda bu `01111110` flag sequence'ini kullanır.

### **Bit stuffing**

Bit-oriented framing'de payload içinde yanlışlıkla:

01111110

flag pattern'inin oluşmasını önlemek gerekir.

Gönderici beş ardışık `1` bitinden sonra otomatik bir `0` ekler:

Original:

01111110...

Stuffed:

011111010...

       ^

     inserted

Receiver beş ardışık `1` bitinden sonra gelen stuffed `0` bitini kaldırır.

PPP'nin bit-synchronous HDLC-like framing açıklaması da FCS dahil frame içeriğinde beş ardışık `1` sonrasında `0` eklenmesini tanımlar.

### **Toolkit iki ayrı görünüm vermelidir**

Logical Frame

ve:

Transmitted Bit Stream

Örneğin:

Logical:

7E FF 03 12 34 CRC 7E

Bit Stuffed View:

01111110 ...

Eklenen bitler:

\[STUFFED 0\]

olarak farklı renkte gösterilmelidir.

### **HDLC frame sınıfları**

HDLC ailesinde control alanının yorumuna göre üç temel frame sınıfı bulunur:

I-frame

S-frame

U-frame

Genel kullanım:

I \= Information / sequenced data

S \= Supervisory

U \= Unnumbered control

IBM SDLC dokümantasyonu da aynı I/S/U sınıflandırmasını kullanır; SDLC ve HDLC aileleri bu bakımdan yakından ilişkilidir.

### **Decoder**

Flag

Address

Control

Frame Type

N(S)

N(R)

Poll/Final

Information

FCS

göstermelidir.

Exact control-field bit yorumu seçilen HDLC profile/moduna göre yapılmalıdır.

### **FCS**

FCS profiline göre değişebileceği için toolkit:

CRC-16 profile

CRC-32 profile

Custom HDLC FCS

seçenekleri sunmalıdır.

---

# **SDLC — Synchronous Data Link Control**

SDLC, IBM tarafından kullanılan synchronous bit-oriented data-link protokolüdür ve frame yapısı HDLC ailesiyle çok benzerdir.

IBM'in güncel AIX SDLC dokümantasyonunda SDLC frame yapısı:

Flag

Station Address

Control

Information

FCS

Flag

olarak tanımlanır; ayrıca Information, Supervisory ve Unnumbered olmak üzere üç frame türü bulunur.

### **Görsel**

7E | ADDRESS | CONTROL | INFORMATION | FCS | 7E

### **Station model**

SDLC klasik kullanımında station ilişkileri önemlidir.

Toolkit metadata:

Local Station

Remote Station

Primary/Secondary Role

Station Address

Poll/Final State

gösterebilmelidir.

### **Frame type**

Control byte decode edilerek:

Information Frame

Supervisory Frame

Unnumbered Frame

olarak sınıflandırılmalıdır.

### **Bit stuffing**

Flag transparanlığını korumak için HDLC benzeri bit stuffing görünümü desteklenmelidir.

### **Toolkit**

SDLC ilk sürümde özellikle log/import tabanlı çalışabilir:

Raw bit stream

HEX frame

Decoded control

Station address

FCS

Frame type

Sequence information

---

# **PPP — Point-to-Point Protocol**

PPP point-to-point bağlantılarda birden fazla network-layer protokolünü kapsüllemek için standart data-link yapısı sağlar.

RFC 1661 PPP'nin multi-protocol datagramları point-to-point link üzerinden taşımak için standart yöntem sağladığını; RFC 1662 ise asynchronous ve synchronous bağlantılardaki HDLC-like framing yöntemini tanımlar.

### **PPP frame**

Standart görünüm:

Flag

Address

Control

Protocol

Information

Padding

FCS

Flag

Değerler:

Flag    \= 0x7E

Address \= 0xFF

Control \= 0x03

Protocol alanı:

8 veya 16 bit

olabilir. RFC 1661 Protocol field'ının kapsüllenmiş datagramın türünü belirlediğini açıklar.

Örnek:

7E FF 03 C0 21 ... FCS 7E

Burada:

C021 \= LCP

olarak yorumlanabilir.

### **LCP**

Link Control Protocol:

Code

Identifier

Length

Data

yapısına sahiptir.

RFC 1661'de örneğin:

1 Configure-Request

2 Configure-Ack

3 Configure-Nak

4 Configure-Reject

5 Terminate-Request

6 Terminate-Ack

7 Code-Reject

tanımlanır.

Toolkit LCP negotiation'ı timeline halinde göstermelidir:

Configure-Request

        ↓

Configure-Ack

        ↓

Link Open

veya:

Configure-Request

        ↓

Configure-Nak

        ↓

New Configure-Request

### **PPP asynchronous escaping**

RFC 1662'de:

Control Escape \= 0x7D

tanımlanır.

`0x7E`:

7D 5E

`0x7D`:

7D 5D

olarak taşınır. Dönüşüm temel olarak escaped byte'ın `0x20` ile XOR edilmesine dayanır.

Örnek:

Original:

01 7E 02

Wire:

01 7D 5E 02

### **ACCM**

Asynchronous Control Character Map ile bazı control byte'ların da escape edilmesi sağlanabilir.

Toolkit:

ACCM bitmap

Escaped Character List

gösterebilmelidir.

### **FCS**

PPP:

16-bit

veya

32-bit

FCS kullanabilir.

Toolkit:

Received FCS

Calculated FCS

PASS / FAIL

sunmalıdır.

---

# **KISS — Keep It Simple, Stupid / KISS TNC Framing**

KISS özellikle bilgisayar ile packet-radio TNC arasında kullanılan basit binary framing yöntemidir.

Classic KISS'te frame delimiter olarak:

FEND \= 0xC0

kullanılır.

Payload içinde `0xC0` bulunduğunda escape edilmesi gerekir. TAPR kaynaklarındaki KISS kullanım örnekleri, KISS frame'in `0xC0` ile sınırlandığını ve payload'daki `0xC0` değerinin FESC/FEND escape mekanizmasıyla dönüştürülmesi gerektiğini açıkça gösterir.

Yaygın değerler:

FEND  \= C0

FESC  \= DB

TFEND \= DC

TFESC \= DD

### **Data frame örneği**

C0 00 \[AX.25 FRAME\] C0

İlk byte:

00

genellikle data command/port bilgisini temsil eder.

TAPR kullanım örneğinde standart port-0 data frame'i:

C0 00 \<packet\> C0

şeklinde gösterilir.

### **Escaping**

Payload:

11 C0 22 DB 33

wire üzerinde:

11 DB DC 22 DB DD 33

olmalıdır.

### **Decoder görünümü**

FEND

Command/Port

Payload

FEND

Payload AX.25 ise toolkit zincirleme decode yapmalıdır:

KISS

 ↓

AX.25

 ↓

APRS / higher layer

### **Decoder hataları**

Missing FEND

Unexpected FESC

Invalid escape

Unknown command

Empty frame

Oversized frame

---

# **XMODEM**

XMODEM seri bağlantılarda dosya transferi için geliştirilen block-based protokoldür.

Ward Christensen'in orijinal XMODEM tanımında asynchronous 8N1 bağlantı, 128-byte veri blokları ve SOH/EOT/ACK/NAK/CAN kontrol karakterleri tanımlanmıştır. Orijinal belgede daha sonra düzeltilmiş ACK değeri `0x06`'dır.

Temel kontrol byte'ları:

SOH \= 0x01

EOT \= 0x04

ACK \= 0x06

NAK \= 0x15

CAN \= 0x18

### **Classic XMODEM frame**

SOH

Block Number

255 \- Block Number

128-byte Data

Checksum

Örnek:

01 01 FE \[128 DATA BYTE\] CHECKSUM

Burada:

Block \= 0x01

Complement \= 0xFE

çünkü:

\[  
0x01+0xFE=0xFF  
\]

### **Checksum**

Classic checksum genel olarak 128 payload byte'ının düşük 8 bitlik toplamıdır:

\[  
Checksum=  
\\left(  
\\sum Data\_i  
\\right)  
\\bmod256  
\]

### **XMODEM-CRC**

Daha sonraki XMODEM türevleri basit checksum yerine CRC-16 kullanabilir.

Receiver başlangıçta:

'C'

göndererek CRC mode isteyebilir.

Toolkit handshake'i göstermelidir:

Receiver → C

Sender   → Block 1

Receiver → ACK

Sender   → Block 2

Receiver → ACK

...

Sender   → EOT

Receiver → ACK

### **Retry**

CRC/checksum bozuksa:

NAK

gönderilir ve aynı block tekrar gönderilir.

Toolkit:

Block 17

CRC: FAIL

NAK

Retry 1

Block 17

CRC: PASS

ACK

timeline'ı vermelidir.

### **XMODEM-1K**

Güncel `lrzsz` uygulama belgeleri XMODEM yanında XMODEM-1K desteğini de ayırır ve receiver tarafında 1024-byte block kullanımını destekler.

Toolkit:

128-byte Block

1024-byte Block

ayrımını göstermelidir.

---

# **YMODEM**

YMODEM, XMODEM ailesini batch file transfer, dosya adı ve dosya metadata aktarımı gibi özelliklerle genişleten protokol ailesidir.

Güncel `lrzsz` receiver dokümantasyonu YMODEM'in 128 veya 1024 byte sector kabul edebildiğini; “True YMODEM” metadata mevcutsa dosya uzunluğu, modification time ve file mode gibi bilgilerin kullanılabildiğini belirtir.

### **Block 0**

YMODEM'de ilk block tipik olarak file metadata taşır.

Örnek:

SOH

00

FF

filename\\0

filesize ...

padding

CRC

Örnek metadata:

firmware.bin\\0

32768 1710000000 ...

Toolkit:

Filename: firmware.bin

Declared Size: 32768 byte

Modification Time: ...

olarak göstermelidir.

### **Data**

Sonraki bloklar:

Block 1

Block 2

Block 3

...

şeklinde gerçek file payload taşır.

YMODEM 1K aktarımında:

STX

ile 1024 byte block kullanımı görülebilir.

### **Batch transfer**

Bir dosya tamamlandıktan sonra yeni file metadata block'u gelebilir.

Session:

File 1 metadata

File 1 data

EOT

File 2 metadata

File 2 data

EOT

Empty metadata block

Session end

şeklinde görüntülenmelidir.

### **Toolkit**

Session

├─ firmware.bin

│  ├─ Size

│  ├─ Blocks

│  ├─ Retries

│  └─ CRC

└─ config.dat

tree view oluşturmalıdır.

---

# **ZMODEM**

ZMODEM, XMODEM/YMODEM ailesine göre daha gelişmiş streaming ve hata kurtarma mekanizmaları sağlayan seri dosya transfer protokolüdür.

GNU/FreeBSD `lrzsz`, XMODEM, YMODEM ve ZMODEM için aktif bir referans uygulama ailesidir; `rz` ZMODEM batch transfer receiver olarak çalışabilir.

ZMODEM'in özellikle toolkit açısından önemli kavramları:

Session negotiation

File information

Streaming data

Position information

Error recovery

Resume

Batch transfer

CRC

### **Genel session görünümü**

Toolkit state machine'i yüksek seviyede:

Initialization

↓

Receiver Ready

↓

File Information

↓

File Accepted

↓

Data

↓

End Of File

↓

Next File / Finish

olarak göstermelidir.

Yaygın ZMODEM frame isimleri için decoder:

ZRQINIT

ZRINIT

ZFILE

ZRPOS

ZDATA

ZEOF

ZFIN

gibi semantic isimleri destekleyebilmelidir.

Ancak çeşitli legacy implementation farkları bulunduğundan parser, kullanılan ZMODEM profile/implementation bilgisini metadata olarak tutmalıdır.

### **Resume**

ZMODEM'in önemli kullanım senaryolarından biri kesilmiş transferin belirli file offset'inden devam ettirilebilmesidir.

Toolkit:

File Size:        8,388,608

Received:         5,242,880

Resume Position:  5,242,880

gösterebilmelidir.

### **Streaming görünümü**

XMODEM gibi her küçük block için sürekli ACK bekleme yerine ZMODEM stream tabanlı transfer gösterebilir.

Toolkit:

Data Stream

──────────────▶

Checkpoint

CRC

Recovery request

görünümü sunmalıdır.

---

# **UBX — u-blox Binary Protocol**

UBX, u-blox GNSS cihazlarında kullanılan binary message formatıdır.

u-blox'un güncel u-center yazılımı kullanıcıya UBX message class ve ID seçerek payload oluşturma, ardından full header ve checksum'ı otomatik üretme imkânı sağlar.

Temel UBX frame görünümü:

Sync

Class

ID

Length

Payload

Checksum

Yaygın sync:

B5 62

u-blox'un kendi açık kaynak `ubxlib` örnek loglarında:

B5 62 0A 06 00 00 10 3A

gibi UBX frame'leri görülür; burada sync'ten sonra class, ID, length ve checksum yapısı izlenebilir.

### **Görünüm**

B5 62 | 01 | 07 | 5C 00 | PAYLOAD... | CK\_A CK\_B

─────   ──   ──   ─────   ──────────   ─────────

SYNC   CLASS  ID   LENGTH      DATA       CHECK

### **Length**

UBX payload length alanı little-endian yorumlanmalıdır.

Örnek:

5C 00

\[  
Length=0x005C=92  
\]

### **Class / ID**

Toolkit:

Class: NAV

ID: PVT

→ UBX-NAV-PVT

gibi isimlendirme yapmalıdır.

u-blox güncel GNSS kaynaklarında örneğin:

UBX-RXM-SFRBX

UBX-RXM-MEASX

UBX-RXM-RAWX

gibi UBX mesajları halen kullanılmaktadır.

### **Checksum**

Toolkit checksum'u:

Received CK\_A

Received CK\_B

Calculated CK\_A

Calculated CK\_B

şeklinde göstermelidir.

Checksum coverage, seçilen u-blox protocol specification sürümüne göre uygulanmalı ve sync byte'larının checksum'a dahil edilip edilmediği açıkça UI'da belirtilmelidir.

### **Stream parser**

UBX ile NMEA aynı porttan gelebileceği için parser:

$ → possible NMEA

B5 62 → possible UBX

D3 → possible RTCM3

gibi multi-protocol stream detection desteklemelidir.

Bu GNSS cihazlarında özellikle değerlidir.

### **Toolkit görünümü**

12:10:01.000 UBX-NAV-PVT

12:10:01.050 NMEA-GGA

12:10:01.100 RTCM3-1077

12:10:02.000 UBX-NAV-PVT

---

# **RTCM**

RTCM GNSS correction ve related navigation data mesajlarında kullanılan standart ailesidir.

RTCM'nin güncel yayın listesinde Version 3 ailesinin güncel standardı **RTCM 10403.4** olarak listelenmektedir; bu sürüm Kasım 2024 tarihli Version 3 \+ Amendment 1 yayınıdır. RTCM standardının tam teknik mesaj tabloları lisanslı yayın kapsamındadır.

Bu nedenle Toolkit'in RTCM decoder'ı sürüm seçimine sahip olmalıdır:

RTCM 2.x

RTCM 3.x

Selected message database revision

### **RTCM 3 stream detection**

RTCM 3 family decoder için tipik frame düzeyi:

Preamble

Reserved

Length

Payload

CRC

Toolkit kullanıcıya en az:

Preamble

Payload Length

Message Type

Station ID

Payload

CRC State

alanlarını göstermelidir.

### **Message type**

Payload başındaki message number parse edilerek:

1005

1077

1087

1097

1127

1230

...

gibi message type gösterimi yapılabilir.

Ancak exact field decoding seçilen RTCM 10403 revision'ındaki resmi message tanımına bağlı olmalıdır.

### **GNSS kategorileri**

Decoder message database'i:

Reference Station

GPS

GLONASS

Galileo

BeiDou

MSM

Antenna

Station Information

SSR

gibi kategorilere ayırmalıdır.

### **CRC**

Toolkit:

Frame Length

Received CRC

Calculated CRC

CRC PASS/FAIL

göstermelidir.

CRC algoritması, exact polynomial ve bit processing resmi RTCM implementation profile'a bağlı olarak sabit protocol module içinde tutulmalıdır; kullanıcı generic CRC ekranından yanlış parametre girmemelidir.

### **Multi-protocol GNSS monitor**

GNSS portu:

UBX

NMEA

RTCM

mesajlarını aynı anda taşıyabilir.

Auto detector:

B5 62 → UBX

$     → NMEA

D3    → possible RTCM3

üzerinden candidate parser çalıştırmalı, ardından length/CRC ile doğrulama yapmalıdır.

---

# **AT Commands**

AT Commands, modemler ve haberleşme modülleri ile text tabanlı command/response iletişimi için kullanılan komut ailesidir.

ITU-T V.250, DTE'nin DCE'yi asynchronous serial interface üzerinden kontrol etmesi için AT command ve response formatlarını standardize eder. Güncel yürürlükteki temel V.250 sürümü 07/2003'tür.

Mobil modemler için 3GPP TS 27.007 ayrıca cellular User Equipment AT command set'ini tanımlar ve hâlen change control altında tutulmaktadır.

### **Temel command**

AT\<CR\>

HEX:

41 54 0D

Response:

OK\<CR\>\<LF\>

### **Command form**

Genel:

AT+COMMAND

Read:

AT+COMMAND?

Set:

AT+COMMAND=value

Test:

AT+COMMAND=?

Her üretici bütün dört formu desteklemek zorunda değildir; destek command definition'a göre belirlenmelidir.

u-blox'un güncel AT command manual'ında command line'ın `"AT"` prefix'i, command name ve configurable termination character ile oluşturulduğu; başarılı command'in `OK`, başarısız command'in `ERROR` final result code'u üretmesi örneklendirilir.

### **Örnek**

TX:

AT+CSQ\\r

RX:

\+CSQ: 18,99\\r\\n

OK\\r\\n

Toolkit:

Command: AT+CSQ

Type: Execution

Intermediate Response:

\+CSQ: 18,99

Final Response:

OK

Response Time:

42.1 ms

göstermelidir.

### **URC — Unsolicited Result Code**

Modem bazı mesajları command gönderilmeden kendiliğinden üretebilir.

Örnek:

\+CEREG: 1

\+UUSORD: 0,64

RING

Toolkit bu mesajları normal command response ile karıştırmamalıdır.

Command transaction

ve:

URC stream

ayrı kanallar olarak tutulmalıdır.

u-blox güncel AT command manual'ı URC'leri event veya status change nedeniyle DCE tarafından asynchronous olarak oluşturulan mesajlar şeklinde kullanır.

### **Parser state**

IDLE

COMMAND\_SENT

WAITING\_RESPONSE

READING\_INTERMEDIATE

READING\_FINAL

DATA\_PROMPT

DATA\_MODE

TIMEOUT

ERROR

### **Final result**

Destek:

OK

ERROR

CONNECT

NO CARRIER

BUSY

NO ANSWER

ve üretici-specific:

\+CME ERROR:

\+CMS ERROR:

yapıları.

### **Prompt tabanlı command**

Örneğin bazı modemler:

AT+SEND=10

sonrasında:

\>

prompt üretir.

Toolkit:

Command

↓

Prompt

↓

Binary/Text Payload

↓

Final Result

işlem zincirini desteklemelidir.

### **Binary payload**

Bazı modern modem command setleri AT komutu ile binary payload'ı aynı workflow içinde taşıyabilir. u-blox'un güncel command setinde örneğin binary data için SOH ve length içeren ayrı veri formatı tanımlanmıştır.

Bu nedenle AT parser yalnız line-based text parser olmamalıdır.

---

# **Hayes Command Set**

Hayes Command Set, modem kontrolünde kullanılan tarihsel `AT` command yaklaşımının temelidir. ITU-T V.250 mevcut modem pratiğinde kullanılan ATtention command set'ini kodifiye ettiğini açıkça belirtir.

Temel yapı:

AT

prefix'idir.

Klasik modem örnekleri:

AT

ATI

ATD...

ATA

ATH

ATO

ATZ

### **Temel anlamlar**

AT

Attention / modem response test

ATI

Identification information

ATD

Dial

ATA

Answer

ATH

Hook control / hang up

ATO

Return to online data mode

ATZ

Reset profile

Exact supported commands modem implementation'ına bağlıdır.

### **S-register yapısı**

Hayes/V.250 tarzı modemlerde:

ATS\<number\>?

ATS\<number\>=value

formunda S-register'lar bulunabilir.

u-blox'un V.250 tabanlı güncel implementation'ında örneğin:

S2 → Escape character

S3 → Command termination

S4 → Response formatting

S5 → Command-line editing character

gibi S-parameters kullanılır.

### **Command mode ve data mode**

Modem iki temel durumda olabilir:

COMMAND MODE

ve:

ONLINE DATA MODE

Command mode:

ATD...

gibi modem komutları işlenir.

Data mode:

Raw user data

uzaktaki bağlantıya aktarılır.

### **Escape sequence**

Data mode'dan command mode'a dönmek için klasik modemlerde escape sequence kavramı bulunur.

Tipik:

\+++

Ancak doğru escape detection yalnız üç `+` karakteri aramak değildir; modem implementation'ında guard-time kavramı bulunabilir.

Toolkit escape sequence analyzer:

Silence

\+++

Silence

timeline'ı göstermelidir.

### **Echo**

Classic modem ayarları command echo'yu açıp kapatabilir.

Örneğin:

ATE0

sonrasında sent command tekrar echo edilmeyebilir.

Toolkit:

Echo ON/OFF

durumunu tespit etmeye çalışmalıdır.

### **Verbose / numeric response**

Bazı modemlerde:

OK

CONNECT

ERROR

gibi verbose responses yerine numeric result code kullanılabilir.

Toolkit response mapper:

Raw Result

Semantic Result

şeklinde çalışmalıdır.

---

# **3.2 için Ortak Frame Visualizer**

Bu bölümdeki bütün protokoller aynı ortak visualizer altyapısından yararlanmalıdır.

## **RAW görünüm**

00000000  AA 55 01 10 04 34 12 78 56 C9 27

## **HEX \+ ASCII**

AA 55 01 10 04 34 12 78 56 C9 27

.U...4.xV.'

## **Binary**

AA

10101010

55

01010101

## **Field görünümü**

AA 55 | 01 | 10 | 04 | 34 12 78 56 | C9 27

SYNC    ADR  CMD  LEN       DATA       CRC

## **Bit görünümü**

Seçilen byte:

0x10

Bit: 7 6 5 4 3 2 1 0

     0 0 0 1 0 0 0 0

           ^

         Command bit

## **Stream görünümü**

Noise

 ↓

73 91

Frame 1

 ↓

AA 55 01 ...

Frame 2

 ↓

AA 55 02 ...

## **Stuffing görünümü**

Örneğin PPP:

Original:

7E

Encoded:

7D 5E

COBS:

Original:

11 22 00 33

Encoded:

03 11 22 02 33

SLIP:

Original:

C0

Encoded:

DB DC

KISS:

Original:

C0

Encoded:

DB DC

HDLC:

Original Bits:

11111...

Wire:

111110...

     ^

   Stuffed 0

Bu ekran kullanıcının **byte stuffing ile bit stuffing arasındaki farkı doğrudan görmesini** sağlamalıdır.

---

# **3.2 Ortak Decoder Hata Modeli**

Tüm serial/frame protokol decoder'ları ortak hata modelini desteklemelidir:

NO\_SYNC

INVALID\_HEADER

INVALID\_LENGTH

FRAME\_TOO\_SHORT

FRAME\_TOO\_LONG

TRUNCATED\_FRAME

INVALID\_ESCAPE

INVALID\_STUFFING

INVALID\_CHECKSUM

INVALID\_CRC

UNSUPPORTED\_COMMAND

UNSUPPORTED\_MESSAGE

SEQUENCE\_ERROR

TIMEOUT

UNEXPECTED\_RESPONSE

NACK\_RECEIVED

RETRY\_LIMIT

BUFFER\_OVERFLOW

PARSER\_RESYNC

Her hata için:

Severity

Timestamp

Offset

Expected

Received

Possible Cause

Recovery Action

gösterilmelidir.

Örnek:

CRC ERROR

Frame:

AA 01 10 02 34 12 8F 71

Received CRC:

0x718F

Calculated CRC:

0x61CE

Possible Causes:

• corrupted byte

• incorrect CRC profile

• wrong CRC coverage

• wrong byte order

---

# **3.2 Ortak Stream Auto-Detection**

Platform aynı stream içerisinde birden fazla olası framing pattern'i test edebilmelidir.

Örnek GNSS stream:

B5 62 ...

24 47 50 ...

D3 ...

B5 62 ...

Candidate detector:

B5 62 → UBX candidate

'$'   → NMEA candidate

D3    → RTCM3 candidate

Candidate yalnız başlangıç byte'ına göre kesin protokol sayılmamalıdır.

Doğrulama:

Header

\+

Length

\+

Known message structure

\+

Checksum/CRC

üzerinden confidence hesaplanmalıdır.

Örnek:

Protocol Detection

UBX:

Header match       100%

Length valid       100%

Checksum valid     100%

Confidence         HIGH

RTCM:

Preamble match       0%

---

# **3.2 Ortak Transaction Timeline**

Request-response protokolleri için:

TX Request

│

│ 2.1 ms

▼

Request Complete

│

│ 8.7 ms processing

▼

RX Response

│

▼

Response Complete

ölçümleri:

Request Duration

Response Delay

Response Duration

Round Trip Time

Inter-Frame Gap

Timeout Margin

Retries

gösterilmelidir.

File transfer protokollerinde:

Block

ACK

Block

ACK

Block

NAK

Retry

ACK

şeklinde ayrı session timeline oluşturulmalıdır.

Bu şekilde 3.2 modülü yalnız HEX frame gösteren bir decoder değil; **serial stream'in frame'e dönüşümünü, escaping/stuffing işlemlerini, request-response ilişkisini, transfer state machine'ini ve hata kurtarma davranışını katman katman açıklayan bir analiz sistemi** olmalıdır.

## **3.3 Endüstriyel protokoller**

* Modbus RTU  
* Modbus ASCII  
* Modbus TCP  
* Profibus DP  
* ProfiNet  
* EtherCAT  
* EtherNet/IP  
* CIP  
* DeviceNet  
* CANopen  
* CC-Link  
* CC-Link IE  
* Sercos III  
* POWERLINK  
* IO-Link  
* AS-Interface  
* HART  
* FOUNDATION Fieldbus  
* M-Bus  
* Wireless M-Bus  
* OPC UA  
* IEC 60870-5-101  
* IEC 60870-5-104  
* DNP3  
* IEC 61850 için temel MMS ve GOOSE analiz araçları

Endüstriyel protokol bölümü yalnızca paketleri HEX olarak göstermekle sınırlı olmamalıdır. Platform; PLC, remote I/O, sürücü, servo, sensör, transmitter, enerji sayacı, gateway, SCADA RTU, protection relay ve diğer endüstriyel cihazlarla çalışan bir entegrasyon mühendisinin ihtiyaç duyacağı bütün haberleşme seviyelerini mümkün olduğunca tek ekranda birleştirmelidir.

Her protokol için mümkün olduğunda şu görünümler sağlanmalıdır:

* Network/Node View  
* Raw Frame View  
* HEX \+ ASCII View  
* Bit View  
* Field Tree  
* Request/Response View  
* Cyclic Process Data View  
* Acyclic Parameter View  
* Diagnostic View  
* State Machine  
* Timing / Cycle View  
* Device Description File View  
* Error Statistics  
* Address/Node Explorer  
* Live Values  
* Transaction Timeline  
* Import/Export

Ortak endüstriyel transaction modeli:

Controller / Client / Master

          │

          │ Request / Cyclic Output

          ▼

      Field Device

          │

          │ Response / Cyclic Input

          ▼

Controller / Client / Master

Real-time cyclic protokollerde:

Cycle 1      Cycle 2      Cycle 3      Cycle 4

│            │            │            │

OUT → Device OUT → Device OUT → Device OUT → Device

IN  ← Device IN  ← Device IN  ← Device IN  ← Device

Acyclic servislerde:

Read Parameter

      ↓

Device processes request

      ↓

Parameter Response

şeklinde ayrı timeline gösterilmelidir.

---

# **Modbus RTU**

Modbus RTU, Modbus application protocol'ünün seri hat üzerinde binary RTU encoding ile taşınan biçimidir. Yeni seri Modbus uygulamaları için Modbus Organization, Serial Line Protocol and Implementation Guide V1.02 kullanılmasını belirtmektedir. Application protocol tarafında güncel yayımlanan temel belge Modbus Application Protocol V1.1b3'tür.

Tipik RTU Application Data Unit:

ADDRESS | FUNCTION | DATA | CRC LOW | CRC HIGH

Örnek:

01 03 00 00 00 02 C4 0B

Decoder:

01       Slave Address \= 1

03       Function      \= Read Holding Registers

00 00    Start Address \= 0

00 02    Quantity      \= 2

C4 0B    CRC           \= Valid

Frame görünümü:

01 | 03 | 00 00 | 00 02 | C4 0B

──   ──   ─────   ─────   ─────

ADR  FC   START    COUNT    CRC

Response örneği:

01 03 04 00 64 00 C8 BA 7A

Decoder:

Address:        1

Function:       0x03

Byte Count:     4

Register 0:

Raw:            0x0064

Unsigned:       100

Register 1:

Raw:            0x00C8

Unsigned:       200

CRC:

PASS

Toolkit register'ları yalnız `uint16` olarak göstermemelidir.

Kullanıcı seçebilmelidir:

uint16

int16

uint32

int32

float32

float64

BCD

ASCII

HEX

bit field

32-bit değerlerde:

ABCD

BADC

CDAB

DCBA

byte/word ordering seçenekleri bulunmalıdır.

Örnek iki register:

Register 0 \= 41 CC

Register 1 \= 00 00

ABCD:

41 CC 00 00

IEEE-754:

25.5

olarak çözümlenebilir.

### **RTU framing**

Modbus RTU frame sınırı özel start/end byte'ı ile değil, serial-line timing ile ilişkilidir.

Toolkit aşağıdakileri göstermelidir:

Previous Frame

───────────────

      Silent Interval

                    New Frame

                    ───────────────

Mevcut belgendeki Modbus timing hesaplarıyla birlikte:

\[  
T\_{char}=\\frac{BitsPerCharacter}{BaudRate}  
\]

\[  
T\_{1.5}=1.5T\_{char}  
\]

\[  
T\_{3.5}=3.5T\_{char}  
\]

hesapları kullanılmalıdır.

Toolkit gerçek stream üzerinde:

Byte Gap:

0.92 char → Same Frame

Byte Gap:

4.17 char → New Frame

gösterebilmelidir.

### **CRC**

Modbus RTU decoder:

Received CRC

Calculated CRC

CRC byte order

Coverage

PASS / FAIL

göstermelidir.

Hatalı örnek:

CRC ERROR

Received:

0x0BC5

Calculated:

0x0BC4

Difference:

0x0001

### **Exception response**

Normal response:

Function \= 0x03

Exception response'ta function code'un exception biçimi ve exception code ayrı çözülmelidir.

Örneğin kullanıcıya:

Request:

Read Holding Registers

Response:

Exception

Original Function:

0x03

Exception:

Illegal Data Address

şeklinde semantic açıklama verilmelidir.

### **Modbus RTU Analyzer**

En az:

Slave Address

Function

Request/Response

Register

Quantity

Byte Count

Data

CRC

Response Time

Silent Interval

Retry Count

Exception

alanlarını takip etmelidir.

---

# **Modbus ASCII**

Modbus ASCII, Modbus mesajlarını printable hexadecimal ASCII karakterleriyle taşıyan seri biçimdir.

RTU'dan önemli farklar:

RTU   → Binary bytes

ASCII → ASCII encoded hexadecimal characters

Tipik frame:

:ADDRESS FUNCTION DATA LRC CR LF

Başlangıç:

:

HEX:

0x3A

Bitiş:

CR LF

HEX:

0D 0A

Örneğin binary anlamdaki:

01 03 00 00 00 02

ASCII wire görünümünde:

:010300000002...

olarak görülebilir.

Toolkit iki görünümü aynı anda sağlamalıdır:

WIRE ASCII:

:010300000002FA\\r\\n

ASCII HEX:

3A 30 31 30 33 ...

DECODED BYTES:

01 03 00 00 00 02 FA

### **LRC**

Modbus ASCII CRC yerine LRC kullanır.

Toolkit:

LRC Received

LRC Calculated

Coverage

PASS / FAIL

göstermelidir.

### **Parser**

State:

WAIT\_COLON

READ\_HEX\_PAIR

READ\_LRC

WAIT\_CR

WAIT\_LF

VALIDATE

Hatalar:

Invalid Hex Character

Odd Number Of Hex Digits

Missing Colon

Missing CR

Missing LF

Invalid LRC

Timeout

Örneğin:

:0103GG00

için:

ERROR:

'G' is not a hexadecimal character

gösterilmelidir.

Modbus RTU ve ASCII aynı application-layer function code modelini paylaşır; taşıma/framing biçimleri farklıdır. Modbus Organization application protocol ve serial implementation belgelerini ayrı yayımlar.

---

# **Modbus TCP**

Modbus TCP, Modbus application mesajını TCP/IP üzerinde MBAP Header ile taşır. Modbus Organization, Modbus TCP/IP için ayrı Messaging Implementation Guide yayımlar.

Genel yapı:

MBAP HEADER

│

├─ Transaction Identifier

├─ Protocol Identifier

├─ Length

└─ Unit Identifier

PDU

│

├─ Function Code

└─ Data

Wire görünümü:

00 01 | 00 00 | 00 06 | 01 | 03 00 00 00 02

─────   ─────   ─────   ──   ───────────────

TID      PID      LEN    UID       PDU

Toolkit:

Transaction ID:  1

Protocol ID:     0

Length:          6

Unit ID:         1

Function:        0x03

Start Register:  0

Quantity:        2

göstermelidir.

RTU'dan önemli fark:

Modbus TCP frame içinde RTU CRC bulunmaz.

Bunun yerine TCP/IP stack'in integrity mekanizmaları vardır.

### **Transaction matching**

TCP bağlantısında birden fazla request outstanding olabilir.

Toolkit:

Transaction ID 0x0010

Request → Read Register

Transaction ID 0x0011

Request → Read Register

Response 0x0011

Response 0x0010

durumunda response'ları yalnız zaman sırasına göre değil Transaction Identifier ile eşleştirmelidir.

### **TCP stream problemi**

Bir TCP read çağrısı:

1 Modbus message

ile eş anlamlı değildir.

Örneğin:

TCP Segment 1:

00 01 00

TCP Segment 2:

00 00 06 01 03 00 00

TCP Segment 3:

00 02

tek Modbus TCP request oluşturabilir.

Tersi:

TCP Segment:

\[Modbus Frame 1\]\[Modbus Frame 2\]

aynı TCP payload içinde iki ADU taşıyabilir.

Bu nedenle parser:

TCP Stream Reassembly

↓

MBAP Length

↓

Modbus ADU Extraction

yapmalıdır.

---

# **PROFIBUS DP**

PROFIBUS, manufacturing ve process automation için IEC 61158/IEC 61784 tabanlı açık fieldbus ailesidir. PROFIBUS DP özellikle decentralized peripheral I/O haberleşmesi için kullanılır. PI halen PROFIBUS DP specification, GSD ve device integration belgelerini yayımlamaktadır.

Toolkit açısından önemli kavramlar:

DP Master

DP Device/Slave

Station Address

Cyclic I/O

Acyclic Services

Parameterization

Configuration

Diagnostics

GSD

Ident Number

Tipik ağ:

PLC / DP Master

       │

\=======+==========+==========+======== PROFIBUS

       │          │          │

   Remote IO    Drive     Valve Island

### **Startup mantığı**

Bir cihaz yalnız “online” olmakla process-data exchange'e geçmemelidir.

Analyzer aşağıdaki commissioning akışını gösterebilmelidir:

Device Detected

      ↓

Parameterization

      ↓

Configuration Check

      ↓

Diagnostic Check

      ↓

Data Exchange

### **Cyclic I/O**

Örneğin remote I/O:

Master → Slave

Output Byte 0:

bit0 \= Motor Start

bit1 \= Valve Open

bit2 \= Reset

Slave → Master

Input Byte 0:

bit0 \= Motor Running

bit1 \= Fault

bit2 \= Limit Switch

Bit görünümü:

Output Byte \= 0x05

bit7 bit6 bit5 bit4 bit3 bit2 bit1 bit0

 0    0    0    0    0    1    0    1

                          │         │

                        Reset     Start

Toolkit GSD import edildiğinde bu byte'ları yalnız raw göstermemeli; module ve I/O tanımlarına bağlamalıdır.

PI'ye göre GSD dosyaları bir PROFIBUS cihazının communication capabilities ve diagnostics bilgileri gibi temel özelliklerini engineering araçlarına taşır.

### **Diagnostic view**

Station: 7

State: Data Exchange

Module 1:

8 DI

Status: OK

Module 2:

4 DO

Status: Fault

Diagnostic:

Module missing

gibi görünmelidir.

### **Timing**

Toolkit:

Bus Cycle Time

Station Response Time

Request Interval

Retry

Gap Time

Jitter

Cyclic Update Period

istatistiklerini çıkarabilmelidir.

### **GSD Explorer**

GSD yüklenince:

Vendor

Model

Ident Number

Supported Baud Rates

Modules

Input Length

Output Length

Diagnostic Capability

Acyclic Capability

gösterilmelidir.

PI, PROFIBUS DP cihazlarının device identification ve integration işlemleri için Ident Number ve GSD kullanımını tanımlar.

---

# **PROFINET**

PROFINET Ethernet tabanlı endüstriyel haberleşme sistemidir. Aynı ağ altyapısında cyclic I/O, parameterization, diagnostics ve standart TCP/IP tabanlı trafiğin birlikte bulunabilmesini sağlar. PI'nin PROFINET tanımı basit I/O görevlerinden synchronous motion control'a kadar kullanım ve TCP/IP iletişiminin paralel çalışabilmesini özellikle belirtmektedir.

Ana roller:

IO Controller

IO Device

IO Supervisor

Örnek:

PLC

 │

PROFINET

 │

Switch

 ├─ Remote I/O

 ├─ Servo Drive

 ├─ Vision System

 └─ Valve Island

### **Analyzer katmanları**

Ethernet

↓

PROFINET Frame

↓

Frame Type / Service

↓

Device / Slot / Subslot

↓

Process Data / Parameter / Alarm

### **Discovery ve commissioning**

Toolkit DCP tabanlı discovery/configuration trafiğini ayrı göstermelidir:

Device discovered

MAC:

00:11:22:33:44:55

Device Name:

conveyor-io-01

IP:

192.168.10.25

Vendor:

...

Device:

...

Device Name ile IP address birbirinden ayrı alanlar olarak ele alınmalıdır.

### **Cyclic process data**

Örnek:

PLC → Drive

Control Word: 0x000F

Speed Setpoint: 1500 rpm

Drive → PLC

Status Word: 0x1237

Actual Speed: 1498 rpm

Bit görünümü:

Control Word

bit0 \= ...

bit1 \= ...

bit2 \= ...

Eğer profile tanımı biliniyorsa semantic isim gösterilmeli; bilinmiyorsa raw bit olarak bırakılmalıdır.

### **Slot/Subslot**

PROFINET cihaz modeli:

Device

 ├─ Slot 0

 │   └─ Subslot ...

 ├─ Slot 1

 │   ├─ Input Module

 │   └─ ...

 └─ Slot 2

şeklinde tree olarak gösterilmelidir.

### **GSDML**

PROFINET GSD dosyaları XML tabanlı GSDML formatındadır ve device identification, structure, communication features, process data, parameters ve diagnosis bilgilerini açıklayabilir. PI'nin güncel GSDML specification sürümü Haziran 2026 itibarıyla V2.50'dir.

Toolkit:

Import GSDML

↓

Build Module Tree

↓

Decode Process Data

↓

Decode Alarms

↓

Show Parameters

işlem hattı oluşturmalıdır.

### **Diagnostic timeline**

12:00:00.000 Device Online

12:00:00.115 Parameterization

12:00:00.430 Data Exchange

12:04:18.420 Module Pull

12:04:18.422 Alarm

12:04:20.100 Module Plug

12:04:20.400 Data Exchange restored

gösterilmelidir.

---

# **EtherCAT**

EtherCAT, real-time Industrial Ethernet teknolojisidir. MainDevice tarafından gönderilen Ethernet frame'i SubDevice'lardan geçerken her cihaz kendisine ait veriyi **on-the-fly** okur veya frame'e ekler. EtherCAT frame'i standart Ethernet içerisinde EtherType `0x88A4` ile tanımlanır ve bir frame içerisinde bir veya daha fazla EtherCAT datagram bulunabilir.

Ağ:

MainDevice

    │

    ▼

SubDevice 1

    │

    ▼

SubDevice 2

    │

    ▼

SubDevice 3

    │

    └──────── return path

### **Frame görünümü**

Ethernet Header

      ↓

EtherCAT Header

      ↓

Datagram 1

Datagram 2

Datagram 3

      ↓

Ethernet FCS

Datagram seviyesinde toolkit:

Command

Index

Address

Length

IRQ information

Data

Working Counter

göstermelidir.

Exact bit alanları seçilen resmi ETG specification revision'ından alınmalıdır; toolkit bunları tahmin ederek üretmemelidir.

### **EtherCAT command türleri**

Semantic olarak analyzer en az:

Read

Write

Read/Write

Physical addressing

Auto-increment addressing

Logical addressing

ayrımını göstermelidir. ETG, EtherCAT datagramlarının read/write/read-write ile direct veya logical addressing kullanabildiğini belirtir.

### **Working Counter — WKC**

EtherCAT analizinde en önemli alanlardan biri WKC'dir.

Her erişilen SubDevice beklenen biçimde datagramı işlerse Working Counter beklenen değere ulaşır.

Toolkit:

Datagram:

Logical Read/Write

Expected WKC:

4

Actual WKC:

3

STATUS:

ERROR

Possible:

One mapped device did not process datagram

göstermelidir.

ETG, WKC'nin datagram erişiminin başarılı olup olmadığını cyclic olarak denetlemek için kullanıldığını açıklar.

### **EtherCAT state machine**

SubDevice state'leri:

INIT

PRE-OP

SAFE-OP

OP

gibi state transition görünümüyle izlenmelidir.

Timeline:

INIT

 ↓

PRE-OP

 ↓

SAFE-OP

 ↓

OP

Bir cihaz OP'a geçemiyorsa:

Requested State

Actual State

AL Status Code

gösterilmelidir.

### **Distributed Clocks**

Toolkit:

Reference Clock

Node Clock Offset

Propagation Delay

Synchronization Error

gibi değerleri loglardan/ESC register'larından çıkarabiliyorsa ayrı grafik üretmelidir.

EtherCAT'in tasarım hedefleri arasında çok kısa cycle time ve düşük synchronization jitter bulunur.

### **Mailbox protocols**

Analyzer mailbox içeriğinde:

CoE

FoE

EoE

SoE

AoE

gibi üst protokolleri ikinci decoder'a yönlendirebilmelidir. EtherCAT resmi teknoloji dokümantasyonu bu application profiles/protocols ailesini tanımlar.

---

# **EtherNet/IP**

EtherNet/IP, standard Ethernet/TCP/IP/UDP/IP altyapısı üzerinde CIP kullanan endüstriyel ağdır.

ODVA'ya göre TCP/IP tipik olarak CIP Explicit Messaging için, UDP/IP ise real-time Implicit I/O data için kullanılır.

Katman:

CIP

↓

EtherNet/IP

↓

TCP / UDP

↓

IP

↓

Ethernet

### **İki temel messaging tipi**

Explicit Messaging

Implicit Messaging

Explicit:

Read parameter

Write parameter

Diagnostics

Configuration

Object access

gibi request-response işlemler için kullanılır.

Implicit:

Cyclic I/O

Real-time process data

için kullanılır. ODVA, implicit I/O bağlantılarında UDP ve producer-consumer multicast modelinin kullanılabildiğini açıklar.

### **Explicit örnek**

PLC → Drive

Service:

Get Attribute

Class:

...

Instance:

...

Attribute:

...

Response:

General Status:

Success

Data:

...

Toolkit:

Service

Class

Instance

Attribute

Path

Request Data

General Status

Extended Status

Response Data

alanlarını göstermelidir.

### **Session / encapsulation**

EtherNet/IP analyzer TCP stream'de EtherNet/IP encapsulation mesajlarını ayırmalı ve:

Command

Length

Session Handle

Status

Sender Context

Options

Payload

gibi alanları göstermelidir.

Session timeline:

TCP Connect

↓

Register Session

↓

Explicit Messaging

↓

Forward Open

↓

I/O Exchange

↓

Forward Close

↓

Unregister / Disconnect

şeklinde gösterilebilir.

### **Implicit I/O**

Örneğin:

Originator → Adapter

Output Assembly:

4 bytes

Adapter → Originator

Input Assembly:

8 bytes

RPI:

10 ms

Toolkit:

Requested Packet Interval

Actual Mean Interval

Min

Max

Jitter

Lost Packet

Duplicate

Sequence

istatistikleri üretmelidir.

ODVA, EtherNet/IP'te Scanner/Originator ve Adapter/Target rollerini ayrıca tanımlar.

---

# **CIP — Common Industrial Protocol**

CIP media-independent ve object-oriented endüstriyel application protocol'dür. EtherNet/IP ve DeviceNet dahil farklı CIP Networks aynı application-layer object modelini paylaşır.

Temel kavram:

Object

 ├─ Class

 ├─ Instance

 ├─ Attribute

 └─ Service

Örneğin:

Class

   ↓

Instance

   ↓

Attribute

üzerinden bir device parameter'ına erişilebilir.

### **CIP path**

Toolkit CIP path'i byte düzeyinde ve semantic olarak göstermelidir:

Encoded Path

↓

Class Segment

Instance Segment

Attribute Segment

Raw:

20 xx 24 yy 30 zz

gibi path görüldüğünde:

Class: ...

Instance: ...

Attribute: ...

olarak çözülmelidir.

Exact numeric object IDs yalnız resmi ODVA object database/profile'a göre isimlendirilmelidir.

### **Service model**

Request:

Service

Path Size

Path

Request Data

Response:

Reply Service

Reserved

General Status

Additional Status Size

Additional Status

Response Data

görünümünde çözümlenmelidir.

### **Producer-consumer**

CIP klasik destination-only mesaj modelinden farklı olarak producer-consumer iletişim modelini kullanabilir. ODVA, tek producer'ın aynı bilgiyi birden fazla consumer'ın kullanabileceği biçimde iletebilmesini CIP'in temel özelliklerinden biri olarak tanımlar.

### **Device Profiles**

Toolkit EDS/profile import edildiğinde:

Device Type

Identity

Objects

Assemblies

Parameters

Connections

göstermelidir.

ODVA'nın Nisan 2026 CIP Networks Library'sinde CIP Volume 1 v3.40, EtherNet/IP Adaptation v1.36 ve DeviceNet Adaptation v1.16 olarak listelenmektedir.

---

# **DeviceNet**

DeviceNet, CAN data-link layer üzerinde CIP kullanan industrial fieldbus'tır. ODVA DeviceNet'i controller ile field I/O cihazları arasında digital multi-drop fieldbus olarak tanımlar.

Katman:

CIP

↓

DeviceNet

↓

CAN

↓

Physical Bus

Ağ:

Controller

    │

\====+==========+========== trunk

    │          │

   drop       drop

    │          │

 Sensor      Motor Starter

DeviceNet trunkline-dropline topolojisini ve aynı kablo üzerinden network power dağıtımını destekler.

### **Toolkit görünümü**

CAN frame:

CAN ID

DLC

DATA

yalnız bırakılmamalıdır.

Üstüne:

DeviceNet

↓

CIP Connection

↓

CIP Object / I/O Data

decoder zinciri uygulanmalıdır.

### **Messaging**

DeviceNet hem:

I/O Messaging

Explicit Messaging

destekler.

Toolkit:

Node Address

Connection Type

Produced Data

Consumed Data

Explicit Service

Timeout

Duplicate MAC check result

gibi durumları izlemelidir.

### **Device view**

Node 05

Motor Starter

State:

Online

Input:

Status \= Running

Current \= ...

Output:

Command \= Start

Explicit:

Parameter reads \= 12

---

# **CANopen**

CANopen, CAN üzerinde standardized application layer, object dictionary ve communication services sağlayan protokoldür.

CANopen device'in merkezinde:

Object Dictionary

bulunur.

CiA'ya göre bütün communication ve application parameters 16-bit Index \+ 8-bit Sub-index ile adreslenen Object Dictionary içinde organize edilir.

### **Object Dictionary**

Görünüm:

1000h Device Type

1001h Error Register

...

2000h Manufacturer Specific

...

6000h Profile Objects

CiA, `1000h–1FFFh` aralığını communication parameters; `2000h–9FFFh` aralığını application-related parameters için kullanır.

Toolkit:

Index

Sub-index

Name

Data Type

Access

Raw

Physical

Default

Min

Max

göstermelidir.

### **NMT**

State view:

Initializing

↓

Pre-operational

↓

Operational

↓

Stopped

Node bazında:

Node 1 → Operational

Node 2 → Operational

Node 3 → Pre-operational

gösterilmelidir.

### **PDO**

PDO, yüksek öncelikli process/control data taşır.

Classic CANopen CC PDO tek CAN data frame'i içinde 8 byte'a kadar application data taşır. CANopen FD varyantlarında daha büyük payload mümkündür.

Örnek:

TPDO1

CAN ID: 0x181

DATA:

37 12 DC 05 00 00 00 00

EDS/object mapping varsa:

Status Word:

0x1237

Velocity:

1500 rpm

şeklinde çözümlenmelidir.

### **SDO**

SDO object dictionary access için client-server ve confirmed communication sağlar. CiA expedited, segmented ve block transfer çeşitlerini tanımlar.

Toolkit:

SDO Request

↓

Index 6040

Subindex 00

Write

Value 000F

SDO Response

↓

Success

şeklinde göstermelidir.

### **EMCY**

Emergency message:

Node

Error Code

Error Register

Manufacturer Data

olarak çözülmelidir.

### **EDS import**

CiA elektronik device description yaklaşımını EDS ile standardize eder.

Import sonrası decoder raw frame'i semantic signal'a dönüştürmelidir.

---

# **CC-Link**

CC-Link factory automation için fieldbus ailesidir. CLPA classic CC-Link'i 10 Mbit/s'ye kadar, 64 station ve konfigürasyona bağlı olarak 1200 m'ye kadar bus uzunluğu destekleyen açık fieldbus olarak tanımlar.

Toolkit classic CC-Link'te:

Master Station

Local Station

Remote I/O Station

Remote Device Station

rollerini ayırmalıdır.

### **Cyclic communication**

Temel görünüm:

Master

↓

Remote Input/Output exchange

↓

Station 1

↓

Station 2

...

Process-data ekranı:

Remote Input RX

Remote Output RY

Remote Register RWr

Remote Register RWw

gibi logical data areas ile gösterilebilir; exact alan isimleri/profile mapping'i selected CC-Link specification revision'a bağlı olmalıdır.

### **Device map**

Station 1

Remote I/O

Status OK

Station 2

Inverter

Status OK

Station 3

Missing

### **Error analyzer**

Station timeout

Duplicate station

Cyclic data mismatch

Communication stopped

Retry

Invalid station configuration

istatistikleri sunulmalıdır.

Exact wire telegram alanları CLPA specification package'tan alınmalı; toolkit vendor/protocol documentation olmadan tahmin ederek field isimleri üretmemelidir.

CLPA Mart 2024 tarihli CC-Link Specification Overview/Protocol belgesini resmi download alanında yayımlar.

---

# **CC-Link IE**

CC-Link IE Ethernet tabanlı CC-Link ailesidir.

Alt aileler:

CC-Link IE Controller Network

CC-Link IE Field Network

CC-Link IE Field Network Basic

CC-Link IE TSN

ayrılmalıdır.

CC-Link IE Field Network, 1 Gbit/s Ethernet üzerinde deterministic cyclic control ile asynchronous/transient communication'ı aynı ağda sağlar.

### **Analyzer mode**

Toolkit ilk olarak network type belirlemelidir:

IE Field

IE Controller

IE Field Basic

IE TSN

Çünkü wire behavior aynı değildir.

### **Cyclic vs transient**

Timeline:

Cycle

│

├─ Cyclic Process Data

├─ Cyclic Process Data

└─ Transient Message

Cyclic process data:

PLC ↔ Servo

PLC ↔ Remote I/O

Transient:

Parameter read

Diagnostics

Information transfer

olarak ayrı renklendirilmelidir.

CLPA, Field Network'te control communication ve information/transient communication bandwidth'inin ayrılabildiğini ve cyclic control'ün deterministic tutulduğunu açıklar.

### **Shared memory görünümü**

Controller Network gibi varyantlarda network shared-memory modelini:

Station 1 Area

Station 2 Area

Station 3 Area

olarak gösteren memory-map view yararlı olacaktır. CLPA Controller Network için token passing ve network shared memory yaklaşımını açıklar.

### **CC-Link IE TSN**

TSN varyantında:

IEEE 802.1AS synchronization

Time-aware communication

Cyclic traffic

General Ethernet traffic

görünümü eklenmelidir.

CLPA güncel CC-Link IE TSN network specifications içinde 1 Gbit/s ve 100 Mbit/s seçeneklerini ve IEEE 802.1AS synchronization'ı belirtmektedir.

---

# **Sercos III**

Sercos III, industrial controls, drives, I/O ve diğer automation devices için Ethernet tabanlı real-time communication sistemidir. Standard Ethernet physical/protocol temelini real-time Sercos mekanizmalarıyla birleştirir.

Tipik kullanım:

Motion Controller

      │

   Sercos III

      │

 ├─ Servo Drive X

 ├─ Servo Drive Y

 ├─ Servo Drive Z

 └─ Remote I/O

### **Cycle analyzer**

Sercos için en kritik görünümlerden biri cycle structure olmalıdır.

Toolkit:

Communication Cycle

├─ Real-Time Telegrams

├─ Device Data

└─ Unified Communication Channel

gibi üst seviye timeline göstermelidir.

Exact telegram names/field tables selected Sercos III specification revision'ına bağlı tutulmalıdır.

### **Timing**

Sercos resmi teknoloji sayfası Fast Ethernet 100 Mbit/s full-duplex kullandığını, communication cycle time'ın 31.25 µs ile 65 ms arasında yapılandırılabildiğini ve synchronization accuracy'nin 1 µs'nin altında olabildiğini belirtmektedir.

Toolkit:

Configured Cycle: 1 ms

Measured Mean:     1.0002 ms

Minimum:           ...

Maximum:           ...

Jitter:            ...

hesaplamalıdır.

### **Device parameter model**

Sercos yalnız raw process bytes olarak gösterilmemeli; standardized parameters ve identifiers kullanılabiliyorsa bunlar semantic olarak açılmalıdır.

Örneğin:

Drive

├─ Command value

├─ Actual value

├─ Status

├─ Diagnostic

└─ Parameters

### **State / phase**

Communication startup ve operating phase'leri state timeline olarak gösterilmelidir.

---

# **POWERLINK**

POWERLINK, IEEE 802.3 Fast Ethernet üzerinde hard real-time industrial communication sağlayan protokoldür. POWERLINK'te network'u yöneten **Managing Node (MN)** ve **Controlled Node (CN)** rolleri bulunur. OpenPOWERLINK reference stack'i hem MN hem CN implementasyonunu destekler.

Ağ:

Managing Node

      │

      ├─ Controlled Node 1

      ├─ Controlled Node 2

      └─ Controlled Node 3

### **Cycle modeli**

Toolkit POWERLINK cycle'ını iki ana bölüme ayırmalıdır:

Isochronous Phase

Asynchronous Phase

Isochronous process data her cycle veya configured multiple'da gönderilebilir. POWERLINK resmi OPC UA information model tanımı isochronous data'yı her cycle veya multiplexing durumunda her n'inci cycle gönderilen veri olarak tanımlar.

### **Frame semantic**

Analyzer aşağıdaki mesaj türlerini semantic isimle tanıyabilmelidir:

Cycle start/synchronization

Poll request

Poll response

Start of asynchronous phase

Asynchronous send

Exact wire field layout resmi POWERLINK specification'a bağlı olmalıdır.

### **CANopen benzeri object model**

POWERLINK application layer CANopen mekanizmalarıyla güçlü uyumluluk taşır:

Object Dictionary

PDO

SDO

NMT

Device Profile

EPSG/OPC Foundation companion specification, POWERLINK'in CANopen object dictionary, PDO, SDO ve NMT kavramlarını kullandığını açıklar.

Toolkit bu yüzden CANopen ile ortak object-dictionary engine kullanabilir.

### **Process view**

CN 1

TPDO:

Position \= ...

Velocity \= ...

RPDO:

Control \= ...

Target \= ...

### **Diagnostics**

Node missing

NMT state mismatch

Cycle timeout

Late response

PDO mismatch

SDO abort

gösterilmelidir.

---

# **IO-Link**

IO-Link, sensör ve aktüatörlerin intelligent point-to-point bağlantısı için standardize edilmiş digital interface'tir.

IO-Link 2025 released package içinde Interface and System Specification V1.1.5 yayımlanmıştır.

Tipik:

PLC

 │

Industrial Ethernet

 │

IO-Link Master

 ├─ Port 1 → Pressure Sensor

 ├─ Port 2 → Distance Sensor

 ├─ Port 3 → Valve

 └─ Port 4 → RFID

### **Üç önemli data sınıfı**

Toolkit conceptual olarak:

Process Data

Parameter / On-request Data

Events / Diagnostics

ayırmalıdır.

### **Process Data**

Örneğin pressure sensor:

Raw Process Data:

09 C4

Decoded:

Pressure \= 25.00 bar

Status \= Valid

Bit görünümü:

09 C4

00001001 11000100

IODD varsa exact bit/data mapping kullanılmalıdır.

### **Parameter access**

Örneğin:

Read:

Vendor ID

Read:

Device ID

Write:

Filter Time \= 100 ms

transaction timeline olarak gösterilmelidir.

### **IODD**

IODD; manufacturer, device type, serial information, parameters, process data, diagnostics ve communication characteristics gibi device description bilgisini taşır.

Toolkit'in IO-Link decoder'ı **IODD import** olmadan yalnız raw payload ve temel service bilgisi vermeli; IODD import edildiğinde semantic isim, unit, scaling ve enum üretmelidir.

### **Port status**

Port 1

Mode: IO-Link

Device: Pressure Transmitter

Communication: OK

Process Data Valid: YES

Port 2

Mode: DI

gösterilmelidir.

### **Diagnostic view**

Device event

Port event

Communication lost

Process data invalid

Parameter write rejected

Device replacement mismatch

---

# **AS-Interface — AS-i**

AS-Interface sensör ve aktüatör seviyesinde düşük maliyetli field network'tür. Data ve power aynı iki iletken üzerinden taşınabilir ve line, star veya tree gibi esnek topolojiler desteklenir.

Ağ:

Gateway / Master

      │

\======+============ AS-i cable

      │

 ├─ Proximity Sensor

 ├─ Valve

 ├─ Motor Starter

 └─ Safety Module

### **Toolkit iki generation'ı ayırmalıdır**

Classic AS-i

ASi-5

Bunlar aynı analyzer başlığı altında fakat farklı decoder/profile olarak ele alınmalıdır.

### **Cyclic view**

Master Poll

   ↓

Device Response

   ↓

Next Device

ve ASi-5 için daha modern OFDM/multi-device process data davranışı ayrı görünmelidir.

ASi-5 resmi teknik bilgilerinde yaklaşık 1.2 ms cycle time, 96 active device'e kadar sistem ve device başına 32 byte'a kadar cyclic input/output process data tanımlanmaktadır.

### **Device panel**

Address

Device Type

Input Bits

Output Bits

Parameter Data

Diagnostic

Safety Status

### **Gateway view**

AS-i çoğu fabrikada üst tarafta:

PROFINET

EtherNet/IP

...

gateway üzerinden bağlanabilir.

Toolkit gateway transaction'ında:

PROFINET Module

↓

AS-i Device Address

↓

Physical I/O

mapping gösterebilmelidir.

---

# **HART**

HART, proses enstrümantasyonunda analog 4–20 mA loop üzerinde digital communication sağlayan protocol ailesidir.

HART specification FieldComm Group tarafından sürdürülür. Güncel specification setinde Universal Commands, Common Practice Commands, Data Link Layer ve diğer protocol bileşenleri ayrı belgeler halinde tutulmaktadır.

Tipik sistem:

DCS / PLC

   │

HART Modem

   │

4–20 mA \+ HART

   │

Pressure Transmitter

### **Toolkit iki şeyi ayrı göstermelidir**

Analog Process Value

Digital HART Communication

Örneğin:

Loop Current:

12.00 mA

Normalized Process:

50 %

HART:

Device online

PV \= ...

Device Status \= ...

### **HART frame semantic**

Decoder:

Preamble

Start Delimiter

Address

Command

Byte Count

Status

Data

Checksum

seviyesinde field tree sunmalıdır.

Exact delimiter/address bit allocation selected HART protocol revision'dan alınmalıdır.

### **Command database**

Komutları:

Universal Commands

Common Practice Commands

Device-Specific Commands

olarak ayırmalıdır.

FieldComm Group Common Practice Commands'ın application-layer specification olduğunu ve kullanılan komutların specification'da tanımlandığı gibi uygulanması gerektiğini belirtir.

### **Request-response**

Host:

Command xx

Device:

Status

Data

Toolkit:

Command

Description

Request Length

Response Length

Device Status

Command Status

Decoded Data

Response Time

göstermelidir.

### **Burst mode**

Logda periyodik device-originated HART mesajları görülürse:

BURST

olarak sınıflandırılabilmelidir.

### **Integration**

HART ekranında:

4–20 mA reading

HART PV

Difference

karşılaştırması bulunması çok değerli olur.

Örneğin:

Analog PV: 50.02 bar

HART PV:   49.98 bar

Difference: 0.04 bar

---

# **FOUNDATION Fieldbus**

FOUNDATION Fieldbus proses otomasyonuna yönelik digital fieldbus sistemidir.

İki ana ortam:

H1

HSE

olarak ayrılmalıdır.

FieldComm Group H1'i bi-directional digital serial publisher-subscriber field network olarak tanımlar; bir H1 segmenti çevresel koşullara bağlı olarak 32 field device ve 1900 m segment uzunluğuna kadar yapılandırılabilir.

### **H1 topology**

Host / DCS

     │

Power Conditioner

     │

\===== TRUNK \=================

      │      │      │

     Spur   Spur   Spur

      │      │      │

     PT     FT     Valve

### **Toolkit layer view**

Physical Layer

↓

Communication Stack

↓

User Layer

↓

Function Blocks

FieldComm Group architecture'ı bu üç ana functional component ile tanımlar.

### **Device view**

Fieldbus cihazı yalnız register listesi gibi gösterilmemelidir.

Device

├─ Resource Block

├─ Transducer Block

└─ Function Blocks

gibi logical view sağlanmalıdır.

Function block seviyesinde:

AI

AO

PID

DI

DO

gibi block'lar profile/device description mevcutsa açılmalıdır.

### **Publisher-subscriber**

Cyclic scheduled communication:

Pressure AI publishes

↓

PID consumes

↓

Valve AO consumes

data flow olarak çizilebilir.

### **HSE**

FOUNDATION HSE, standard Ethernet/IP üzerinde daha üst-level field/device integration sağlar ve 100 Mbit/s Ethernet control backbone kullanımını hedefler.

Toolkit H1 ile HSE trafiğini ayrı decoder katmanlarına yönlendirmelidir.

---

# **M-Bus — Meter-Bus**

M-Bus utility metering için kullanılan wired communication sistemidir.

Kullanım:

Heat Meter

Water Meter

Gas Meter

Energy Meter

M-Bus kullanıcı grubu güncel bağlayıcı referansın EN 13757 standardı olduğunu özellikle belirtir; kendi web sitesindeki eski detaylı documentation yalnız bilgi amaçlıdır.

Bu yüzden toolkit:

M-Bus Revision / EN 13757 Profile

metadata'sı taşımalıdır.

### **Frame classes**

Decoder common M-Bus frame sınıflarını:

Single Character

Short Frame

Control Frame

Long Frame

gibi ayırmalıdır.

Exact byte structure selected EN 13757 revision'ına bağlı tutulmalıdır.

### **Meter data**

Long response içinde:

Control

Address

CI

Application Data

Checksum

semantic tree oluşturulmalıdır.

Application layer'da meter data records:

Value

Unit

Function

Tariff

Storage

Timestamp

Device information

alanlarına ayrılabilmelidir.

Legacy M-Bus documentation CI field'in application data type ve byte sequence hakkında bilgi taşıdığını açıklar.

### **Meter browser**

Primary Address

Secondary Address

Manufacturer

Medium

Version

Identification

Status

gibi cihaz tablosu oluşturulmalıdır.

### **Örnek**

Meter:

Heat

Energy:

1234.56 kWh

Volume:

78.901 m³

Flow Temperature:

63.2 °C

Raw record'a tıklandığında:

DIF

DIFE

VIF

VIFE

DATA

gibi record structure gösterilebilir; exact coding table resmi standard database'ından gelmelidir.

---

# **Wireless M-Bus**

Wireless M-Bus, EN 13757 ailesindeki kablosuz metering communication yaklaşımıdır.

Toolkit wired M-Bus ile aynı application-data decoding motorunu mümkün olduğunca paylaşmalı, fakat radio/link-layer kısmını ayrı tutmalıdır.

Girdi kaynakları:

SDR decoded log

RF receiver log

Gateway export

HEX telegram

PCAP/custom capture

### **Radio metadata**

Her frame için:

Timestamp

Frequency

Mode

RSSI

LQI/SNR if available

Direction

Device ID

Manufacturer

Encryption Status

gösterilmelidir.

### **Frame pipeline**

Radio Frame

↓

Link Layer

↓

Security/Encryption

↓

M-Bus Application Data

↓

Meter Records

### **Encryption**

Key verilmemişse:

Encrypted Payload

olarak bırakılmalıdır.

Key mevcutsa:

Decryption:

PASS

Authentication:

PASS/FAIL

yerel olarak gerçekleştirilebilir.

Anahtar dış servislere gönderilmemelidir.

M-Bus Usergroup, yalnız güncel EN 13757 standardının bağlayıcı olduğunu vurgular; Wireless M-Bus için de decoder tables kullanılan revision'a bağlanmalıdır.

---

# **OPC UA**

OPC UA yalnız “bir TCP protokolü” olarak ele alınmamalıdır; information model, object model, services, security, client/server ve PubSub mekanizmalarını içeren geniş bir interoperability architecture'dır.

OPC UA güncel reference specification 1.05 ailesinde Services; Discovery, SecureChannel, Session, NodeManagement, View, Attribute, Method, MonitoredItem ve Subscription gibi Service Set'lere ayrılır.

### **Address Space**

Toolkit OPC UA Server'ı tree olarak gösterebilmelidir:

Objects

└─ Machine1

   ├─ Temperature

   ├─ Speed

   ├─ State

   ├─ Alarm

   └─ Start()

Her Node:

NodeId

BrowseName

DisplayName

NodeClass

DataType

AccessLevel

Value

StatusCode

SourceTimestamp

ServerTimestamp

gibi bilgilerle gösterilmelidir.

### **Connection timeline**

TCP Connect

↓

Hello / Acknowledge

↓

OpenSecureChannel

↓

CreateSession

↓

ActivateSession

↓

Browse / Read / Write

↓

CreateSubscription

↓

Publish

↓

CloseSession

↓

CloseSecureChannel

OPC UA specification SecureChannel'ın confidentiality/integrity sağlayan logical channel olduğunu ve Session kurulmadan önce oluşturulduğunu belirtir.

### **Read example**

Client:

Read

NodeId \= ...

Server:

Value \= 25.73

Status \= Good

Timestamp \= ...

Toolkit:

Request Handle

NodeId

Attribute

StatusCode

Value

Type

Timestamp

göstermelidir.

### **Subscription**

Örneğin:

Publishing Interval:

100 ms

Monitored Item:

Machine1.Speed

Sampling:

20 ms

Queue:

10

Toolkit:

Value

Sequence Number

Publish Time

Missed Sequence

DataChange

takip etmelidir.

### **Security**

Endpoint

Security Policy

Message Security Mode

Server Certificate

User Authentication

SecureChannel Token

göstermelidir.

Certificate validation problemi:

Untrusted certificate

Expired

Hostname mismatch

Revoked

semantic hata olarak gösterilmelidir.

---

# **IEC 60870-5-101**

IEC 60870-5-101, geographically widespread telecontrol systems için serial transmission kullanan companion standard'dır. Güncel consolidated yayın `IEC 60870-5-101:2003+AMD1:2015` olarak IEC 60870-5:2026 series içerisinde listelenmektedir.

Kullanım:

SCADA Master

    │

Serial Link

    │

RTU

    │

Substation / Field I/O

### **Toolkit frame katmanları**

Link Layer

↓

Application Service Data Unit

↓

Type Identification

↓

Cause of Transmission

↓

Common Address

↓

Information Object Address

↓

Information Elements

Exact byte widths:

Link address size

Common address size

IOA size

Cause size

system profile/configuration'a bağlı olarak kullanıcı tarafından seçilebilmeli veya project profile'dan alınmalıdır.

### **ASDU görünümü**

Örnek semantic:

Type:

Single Point Information

Cause:

Spontaneous

Common Address:

1

Information Object:

100

Value:

ON

Quality:

Good

Timestamp:

...

### **Monitor direction**

Toolkit:

Monitor direction

Control direction

mesajlarını farklı renkte göstermelidir.

### **Command correlation**

Select

↓

Execute

↓

Activation Confirmation

↓

Activation Termination

kullanılan profile/service uygunsa tek transaction olarak gruplanmalıdır.

### **Quality**

Digital/analog information object'lerde:

Invalid

Not topical

Substituted

Blocked

Overflow

gibi quality bits exact ASDU type definition'a göre bit view'da açılmalıdır.

### **Time tags**

Desteklenen information object type'a göre:

No timestamp

CP24Time2a

CP56Time2a

gibi timestamp formatları semantic olarak decode edilmelidir.

Exact bit tables IEC standardından alınmalıdır.

---

# **IEC 60870-5-104**

IEC 60870-5-104, IEC 60870-5-101 telecontrol application modelini standard transport profiles üzerinden network erişimine taşır. Güncel consolidated sürüm IEC tarafından `IEC 60870-5-104:2006+AMD1:2016` olarak yayımlanmaktadır ve 2026 series paketinde yer almaktadır.

Entegrasyon açısından temel fark:

101 → Serial telecontrol

104 → TCP/IP-based network access

### **APDU**

Toolkit:

APCI

↓

ASDU

ayrımı göstermelidir.

Frame categories:

I-format

S-format

U-format

semantic olarak ayrılmalıdır.

### **Sequence tracking**

I-format mesajlarda transmit/receive sequence'leri izlenmelidir:

TX Sequence

RX Sequence

Expected TX

Expected RX

Örnek:

Frame A:

TX \= 151

RX \= 223

Frame B:

TX \= 152

RX \= 223

Frame C:

TX \= 154

ise:

Possible missing I-frame

Expected TX \= 153

uyarısı üretilebilir.

### **U-format states**

Toolkit control message'larını:

STARTDT

STOPDT

TESTFR

ve confirmation durumlarını state timeline içinde göstermelidir.

### **SCADA session**

TCP Connect

↓

STARTDT

↓

General Interrogation

↓

Spontaneous Events

↓

Commands

↓

TESTFR

↓

STOPDT / Disconnect

şeklinde session görünümü oluşturulmalıdır.

### **ASDU decoder**

101 ile ortak ASDU core kullanılmalıdır:

Type ID

VSQ

Cause

Common Address

IOA

Value

Quality

Timestamp

---

# **DNP3**

DNP3 SCADA ve telecontrol uygulamaları için geliştirilmiş layered protocol'dür.

DNP Users Group, DNP3'ün application, data-link ve physical katmanlardan oluşan temel architecture'a sahip olduğunu; addressing, timestamped events, time synchronization, broadcast ve application/data-link confirmations gibi özellikler sunduğunu belirtmektedir.

### **Layer view**

Application Layer

↓

Transport Function

↓

Data Link Layer

↓

Physical / TCP transport

Toolkit kullanıcıya tek düz HEX yerine her katmanı ayrı göstermelidir.

### **Link layer**

Decoder:

Start

Length

Control

Destination

Source

CRC

User Data

şeklinde field tree sunmalıdır.

Exact byte constants and CRC segmentation selected official DNP3 specification revision'dan alınmalıdır.

### **Application**

Application Control

Function Code

Internal Indications

Object Headers

Objects

gibi semantic yapıya ayrılmalıdır.

### **Object / Variation**

DNP3 process data yalnız register gibi gösterilmemelidir.

Object Group

Variation

Qualifier

Range

Value

Flags

Timestamp

ayrılmalıdır.

Örnek:

Binary Input

Index:

12

Value:

ON

Flags:

ONLINE

Time:

12:15:44.231

### **Event classes**

Toolkit:

Class 0

Class 1

Class 2

Class 3

filtreleri sağlamalıdır.

### **Unsolicited response**

RTU'nun poll beklemeden event göndermesi:

UNSOLICITED

olarak ayrıca işaretlenmelidir.

### **Confirm**

Response

↓

Confirmation required

↓

Confirm

transaction olarak gruplanmalıdır.

### **IIN**

Internal Indications:

Device Restart

Need Time

Local Control

Device Trouble

...

exact bit definition'a göre semantic alarm olarak açılmalıdır.

---

# **IEC 61850 — Temel MMS ve GOOSE Analiz Araçları**

IEC 61850 yalnız bir communication protocol değildir; power utility automation için device/data modelling ve communication services içeren geniş bir standard series'dir. IEC'nin 2026 overview dokümanı standardın IED communication ve related system requirements üzerine kapsamlı bir seri olduğunu belirtmektedir.

ALP Comm Toolkit'in ilk sürümünde bütün IEC 61850 ekosistemini uygulamak yerine iki temel alan üzerinde yoğunlaşılmalıdır:

MMS

GOOSE

## **IEC 61850 Information Model**

Tree:

IED

└─ Logical Device

   └─ Logical Node

      ├─ Data Object

      │  └─ Data Attribute

      └─ ...

Toolkit SCL dosyası mevcutsa:

IED

LD

LN

DO

DA

Dataset

Report Control Block

GOOSE Control Block

mapping yapmalıdır.

---

## **MMS**

IEC 61850-8-1, ACSI hizmetlerini MMS ve Ethernet tabanlı iletişime map eder. Standard hem time-critical hem non-time-critical data exchange için mapping tanımlar.

MMS çoğunlukla client/server interaction için değerlendirilmelidir.

Toolkit:

Association

Read

Write

GetNameList

Report

File service

Control

gibi high-level service'leri semantic olarak göstermelidir.

Network stack:

Ethernet

↓

IP

↓

TCP

↓

ISO transport/session/presentation

↓

MMS

↓

IEC 61850 object

olarak katmanlı görünüm sunulabilir.

### **Read örneği**

Client:

Read

Object:

IED1/LD0/...status...

Response:

Value:

true

Quality:

Good

Timestamp:

...

SCL varsa cryptic MMS variable name, IEC 61850 logical-node path'e dönüştürülmelidir.

---

## **GOOSE**

GOOSE yüksek hızlı event ve protection/control bilgilerinin Ethernet üzerinde multicast aktarımı için kullanılır.

IEC network engineering dokümanı GOOSE'un protection trip command'larının iletilmesi gibi time-critical uygulamalarda kullanıldığını belirtmektedir.

GOOSE doğrudan Ethernet seviyesinde incelenmelidir.

Toolkit field tree:

Destination MAC

EtherType

APPID

Length

Reserved

GOOSE PDU

PDU:

Control Block Reference

Time Allowed To Live

Dataset

GO ID

Timestamp

State Number

Sequence Number

Test

Configuration Revision

Needs Commissioning

Number Of Dataset Entries

Dataset Values

Exact BER/TLV field coding IEC 61850-8-1 revision'ına göre uygulanmalıdır.

### **stNum / sqNum analizi**

Bu iki sayaç özellikle izlenmelidir.

Conceptual olarak:

No state change:

stNum \= 10

sqNum \= 1

sqNum \= 2

sqNum \= 3

State changes:

stNum \= 11

sqNum restarts

Toolkit:

State Change Detected

Previous stNum:

10

Current stNum:

11

göstermelidir.

### **Retransmission timeline**

GOOSE event:

State Change

↓

GOOSE

↓

rapid retransmission

↓

retransmission

↓

slower retransmission

grafiği oluşturulmalıdır.

### **Dataset view**

SCL import edildiğinde:

Dataset:

ProtectionTrip

Entry 1:

Breaker Trip \= TRUE

Entry 2:

Protection Operated \= TRUE

Entry 3:

Interlock \= FALSE

gibi semantic görünmelidir.

SCL yoksa:

Dataset Entry 1:

BOOLEAN \= TRUE

şeklinde generic ASN.1 value gösterilebilir.

### **GOOSE troubleshooting**

Toolkit:

stNum unexpected jump

sqNum duplicate

sqNum gap

Configuration revision changed

Dataset mismatch

TTL expired

GOOSE stopped

Unexpected publisher

Unexpected destination MAC

Test flag active

uyarılarını üretmelidir.

IEC'nin 2024 network supervision guidance'ı da unexpected IED/GOOSE/SV flow'larının SCD ile karşılaştırılarak izlenmesini ele almaktadır.

---

# **3.3 Ortak Industrial Transaction Analyzer**

Bütün endüstriyel protokollerde ortak bir üst analiz motoru bulunmalıdır.

## **Device / Node Table**

Address   Device               Protocol       State

1         Remote IO            Modbus RTU     Online

2         Servo X              EtherCAT       OP

3         Pressure Sensor      IO-Link        Online

4         Drive                CANopen        Operational

## **Cyclic Data Statistics**

Her cyclic signal için:

Expected Period

Average Period

Minimum

Maximum

Jitter

Message Count

Missing Count

Duplicate Count

Timeout Count

Last Update

hesaplanmalıdır.

Jitter:

\[  
J\_i=T\_i-T\_{nominal}  
\]

ve örneğin:

Nominal:

10 ms

Observed:

9.95

10.02

10.08

9.97 ms

grafiklenebilmelidir.

## **Request/Response Statistics**

Request Count

Response Count

Timeout

Exception

Retry

Minimum Response

Average Response

Maximum Response

95th Percentile

tutulmalıdır.

## **Process Value görünümü**

Ham communication data:

41 CC 00 00

tek başına bırakılmamalıdır.

Mapping mevcutsa:

Motor Speed

1500 rpm

olarak görünmelidir.

Kullanıcı aynı sinyali:

Raw HEX

Raw Decimal

Engineering Value

Trend

modlarında görebilmelidir.

## **Quality / Status**

Bir process value yalnız sayı değildir.

Mümkün olan protokollerde:

Value

Quality

Timestamp

Source

Validity

Substitution

Alarm

birlikte gösterilmelidir.

## **Device Description Integration**

Protokole göre:

PROFIBUS        → GSD

PROFINET        → GSDML

CANopen         → EDS

EtherNet/IP     → EDS

IO-Link         → IODD

POWERLINK       → XDD

IEC 61850       → SCL

HART/Fieldbus   → EDD/FDI where available

yüklenebilmelidir.

Device description dosyası yalnız proje konfigürasyonu için değil, **decoder'a semantic bilgi sağlayan veri kaynağı** olarak kullanılmalıdır.

Örneğin:

Without EDS:

Byte 0-1:

37 12

With EDS/Profile:

StatusWord:

0x1237

şeklinde davranmalıdır.

## **Industrial Error Correlation**

Toolkit farklı protokol seviyelerindeki hataları ilişkilendirebilmelidir.

Örnek:

12:10:00.101 Ethernet Link Down

12:10:00.104 PROFINET Device Lost

12:10:00.105 PLC IO Provider Status Bad

12:10:00.120 Application Alarm:

Conveyor Sensor Communication Failure

Bunları dört bağımsız hata gibi göstermek yerine:

ROOT EVENT:

Ethernet Link Down

Consequences:

PROFINET connection lost

Process input invalid

Application alarm generated

şeklinde timeline üzerinde ilişkilendirmek çok değerli olacaktır.

## **Layer Drill-Down**

Her endüstriyel mesaj için kullanıcı aşağı doğru inebilmelidir:

Application Value

      ↓

Industrial Protocol

      ↓

Transport / Fieldbus

      ↓

Frame

      ↓

Bytes

      ↓

Bits / Physical Capture

Örneğin:

Motor Speed \= 1498 rpm

↓

PROFINET Process Data

↓

Ethernet Frame

↓

Byte Offset 46–47

↓

05 DA

↓

00000101 11011010

veya:

Pressure \= 50.2 bar

↓

Modbus Holding Register 40001

↓

Response Function 03

↓

Register bytes

↓

13 9C

şeklinde izlenebilmelidir.

Bu yapı sayesinde endüstriyel modül yalnızca “Modbus decoder”, “CANopen decoder” veya “PROFINET viewer” koleksiyonu olmamalıdır. Amaç; **PLC'den field device'a kadar process value'nun hangi frame, byte, bit, object, register veya service üzerinden taşındığını izlenebilir hale getiren bir endüstriyel haberleşme analiz ortamı** oluşturmaktır.

## **3.4 Otomotiv protokolleri**

* CAN 2.0A  
* CAN 2.0B  
* CAN FD  
* CAN XL için temel frame inceleme  
* J1939  
* CANopen  
* LIN  
* FlexRay  
* SENT  
* SPC  
* PSI5  
* K-Line  
* ISO 9141  
* ISO 14230 KWP2000  
* ISO-TP  
* UDS  
* OBD-II  
* DoIP  
* Automotive Ethernet  
* SOME/IP  
* XCP on CAN  
* XCP on Ethernet  
* CCP  
* SAE J1850 PWM  
* SAE J1850 VPW

Otomotiv haberleşme bölümü yalnızca ham CAN ID veya diagnostic byte dizisi gösteren basit bir araç olmamalıdır. Platform; ECU geliştiricileri, embedded yazılımcılar, calibration mühendisleri, test mühendisleri, vehicle integration ekipleri ve servis/diagnostic geliştiricilerinin araç içi haberleşmeyi farklı katmanlarda inceleyebilmesini sağlamalıdır.

Her otomotiv protokolünde mümkün olduğunca aşağıdaki görünümler bulunmalıdır:

* Raw Frame  
* HEX View  
* Binary / Bit View  
* Signal View  
* Timestamp  
* Direction  
* Channel  
* Bus Type  
* Arbitration ID / Address  
* Frame Type  
* Payload  
* CRC / Checksum  
* Counter  
* State  
* Timing  
* Period  
* Frequency  
* Jitter  
* Message Count  
* Error Count  
* Diagnostic Session  
* Request / Response  
* ECU / Tester  
* Physical / Functional Addressing  
* DTC  
* Parameter  
* Calibration Data  
* Transport Reassembly  
* DBC / LDF / A2L / EDS gibi tanım dosyaları  
* Live chart  
* Transaction timeline

Ortak katman görünümü:

Application

    ↓

UDS / OBD / J1939 / CANopen / XCP / SOME-IP

    ↓

Transport

    ↓

ISO-TP / TCP / UDP / J1939 TP

    ↓

Data Link

    ↓

CAN / CAN FD / CAN XL / LIN / FlexRay / Ethernet

    ↓

Physical Layer

Kullanıcı bir değere tıkladığında mümkün olduğunca:

Engine Speed

1500 rpm

   ↓

SPN / Signal / DID / PID

   ↓

Payload bytes

   ↓

CAN frame

   ↓

CAN ID

   ↓

Bit stream

şeklinde aşağı doğru inebilmelidir.

---

# **CAN 2.0A — Classical CAN Base Frame**

Belgede CAN 2.0A olarak kullanılan başlık, modern ISO/CiA terminolojisinde esas olarak **Classical CAN Base Frame Format — CBFF** yani 11-bit identifier kullanan klasik CAN data frame yapısına karşılık düşünülmelidir. Modern ISO 11898-1 terminolojisinde Classical CAN için 11-bit CBFF ve 29-bit CEFF frame formatları ayrılır.

CAN bir node-address protokolü değildir. CAN ID çoğu uygulamada doğrudan “ECU adresi” değildir; mesajın önceliği ve anlamı üst protokol veya sistem tasarımı tarafından belirlenir.

Temel CAN data frame:

SOF

│

├─ Arbitration Field

│  ├─ 11-bit CAN ID

│  └─ RTR

│

├─ Control Field

│  ├─ IDE

│  └─ DLC

│

├─ Data Field

├─ CRC Field

├─ ACK Field

├─ EOF

└─ Intermission

CiA'ya göre Classical CAN base frame 11-bit CAN ID ve 0–8 byte data field kullanır. CRC, ACK ve EOF alanları frame'in kalan temel parçalarıdır.

### **CAN ID**

Örnek:

CAN ID:

0x123

11-bit binary:

00100100011

Toolkit:

CAN ID: 0x123

Decimal: 291

Binary: 001 0010 0011

Format: Base / 11-bit

göstermelidir.

### **Arbitration**

CAN'de küçük numerical CAN ID daha yüksek arbitration priority'ye sahiptir.

Örnek:

Node A:

ID \= 0x120

Node B:

ID \= 0x123

Aynı anda transmission başlarsa bit-by-bit arbitration sırasında dominant bit recessive biti bastırır. Arbitration'ı kaybeden node transmission'ı bozmaz, receiver durumuna geçer.

Toolkit bunu bit seviyesinde gösterebilmelidir:

Node A ID: 00100100000

Node B ID: 00100100011

                    ↑

Node A sends: 0

Node B sends: 1

Bus observed: 0

Node B loses arbitration

### **DLC**

Classical CAN'de application data alanı en fazla 8 byte'tır.

Örnek:

CAN ID: 0x321

DLC: 8

DATA:

10 27 00 64 12 34 FF 00

Toolkit:

Byte 0 \= 0x10

Byte 1 \= 0x27

...

ve bit görünümünü sağlamalıdır.

### **Bit stuffing**

CAN NRZ tabanlı aktarım kullanırken senkronizasyon için bit stuffing uygular. Transmitter gerekli yerlerde stuff bit ekler, receiver bunları kaldırır. CiA güncel terminolojisi CAN'deki bit stuffing'i frame coding mekanizması olarak tanımlar.

Toolkit iki görünüm vermelidir:

Logical Frame Bits

ve:

Actual Bus Bits

Eklenen bit:

\[STUFF\]

olarak işaretlenmelidir.

### **ACK**

Frame'i doğru alan en az bir receiver ACK slotunda dominant durum oluşturarak acknowledgement sağlar.

Toolkit:

ACK:

Detected

ACK State:

Valid

veya:

ACK ERROR

No node acknowledged transmitted frame

göstermelidir.

### **CAN Analyzer**

Her frame:

Timestamp

Channel

CAN ID

11/29 bit

Data/Remote

DLC

Data

CRC state

ACK state

Frame duration

Period

Frequency

Jitter

Count

ile gösterilmelidir.

---

# **CAN 2.0B — Classical CAN Extended Frame**

CAN 2.0B başlığı altında özellikle 29-bit identifier kullanan **Classical CAN Extended Frame Format — CEFF** analiz edilmelidir.

29-bit identifier:

Base Identifier:

11 bit

Identifier Extension:

18 bit

Total:

29 bit

CiA modern tanımında CEFF'nin 29-bit CAN ID kullandığı ve 11-bit base identifier ile 18-bit extension'dan oluştuğu belirtilir.

Örnek:

CAN ID:

0x18F00401

Toolkit:

Format:

Extended

CAN ID:

0x18F00401

Binary:

0000110001111000000000100000001

gösterebilmelidir.

### **Base / Extended karşılaştırması**

Classical Base:

11-bit ID

Classical Extended:

29-bit ID

Extended frame'in arbitration/control bölümü daha uzun olduğu için aynı payload için bus üzerinde daha fazla bit tüketir.

### **Protocol detection**

29-bit frame görüldüğünde toolkit yalnız:

Extended CAN

dememelidir.

Candidate higher layers:

Possible:

J1939

NMEA 2000

ISO-TP Extended ID

OEM Custom

CANopen Extended

gibi gösterilebilir.

Ancak ID'nin biçiminden tek başına kesin protokol kararı verilmemelidir.

---

# **CAN FD**

CAN FD, Classical CAN'in data alanı ve throughput sınırlarını genişleten ikinci nesil CAN data-link formatıdır.

CAN FD:

11-bit veya 29-bit identifier

0–64 byte payload

Optional bit-rate switching

sağlar. CAN FD frame'leri FBFF ve FEFF olarak adlandırılır. Classical CAN node CAN FD frame'i anlayamazken CAN FD controller Classical CAN frame'lerini de işleyebilir.

### **CAN FD frame**

Conceptual:

SOF

↓

Arbitration

↓

Control

│

├─ FDF

├─ BRS

├─ ESI

└─ DLC

↓

Data 0–64 byte

↓

CRC

↓

ACK

↓

EOF

### **FDF**

FDF:

Classical CAN

vs

CAN FD

frame formatını ayırır.

### **BRS — Bit Rate Switch**

BRS aktifse frame'in arbitration ve data fazları farklı bit rate kullanabilir.

Örnek:

Nominal Bit Rate:

500 kbit/s

Data Bit Rate:

2 Mbit/s

Timeline:

SOF / Arbitration

500 kbit/s

───────────────

BRS

 ↓

DATA \+ part of CRC

2 Mbit/s

─────────────────

ACK / EOF

500 kbit/s

──────────

CiA, BRS recessive olduğunda ikinci bit rate'in data phase'de kullanılmasını tanımlar.

Toolkit hesaplamaları ayrı yapmalıdır:

Nominal Bit Time

Data Bit Time

Nominal Sample Point

Data Sample Point

Nominal Prescaler

Data Prescaler

### **ESI**

Error State Indicator:

Error Active

Error Passive

durumu hakkında transmitter state bilgisi sağlayabilir.

Toolkit:

ESI:

Error Active

gibi semantic gösterim yapmalıdır.

### **DLC mapping**

CAN FD'de DLC yalnız 0–8 doğrudan byte sayısı ilişkisi gibi ele alınmamalıdır.

Toolkit:

DLC

↓

Actual Payload Length

mapping yapmalıdır ve 12, 16, 20, 24, 32, 48, 64 byte gibi CAN FD payload boylarını doğru göstermelidir.

### **CRC**

CAN FD frame'lerinde payload uzunluğuna bağlı daha güçlü CRC mekanizmaları ve stuff-bit counter kullanılır; ISO ve eski non-ISO CAN FD implementasyonları CRC/stuff-bit counter ayrıntılarında farklıdır. CiA güncel tasarımlarda ISO CAN FD kullanılmasını önerir.

Toolkit metadata:

CAN FD Variant:

ISO

Non-ISO

Unknown

destekleyebilir.

### **CAN FD decoder**

CAN ID

Base/Extended

FDF

BRS

ESI

DLC

Payload Length

Data

Nominal Rate

Data Rate

Frame Time

CRC

ACK

gösterilmelidir.

---

# **CAN XL — Temel Frame İnceleme**

CAN XL üçüncü nesil CAN data-link yapısıdır. ISO 11898-1:2024 içerisinde Classical CAN ve CAN FD ile birlikte standardize edilir. CAN XL data field 1 byte'tan 2048 byte'a kadar çıkabilir.

Bu toolkit'te ilk sürümde tam CAN XL stack implementasyonu yerine **frame-level inspection** yapılmalıdır.

### **Temel fark**

CAN CC / CAN FD:

CAN ID

\=

Priority \+ Content/Address semantics

CAN XL:

11-bit Priority ID

\+

32-bit Acceptance Field

ayrımı getirir.

### **LLC alanları**

CAN XL tarafında toolkit en az:

FTYP

BRS

ESI

SDT

SEC

DLC

VCID

AF

LLC Data

alanlarını gösterebilmelidir.

### **SDT — Service Data Unit Type**

SDT higher-layer içeriğinin türünü tanımlamak için kullanılabilir.

Toolkit:

SDT:

0x..

Interpretation:

Configured higher-layer protocol

göstermelidir.

### **VCID**

Virtual CAN Network ID:

VCID

aynı fiziksel CAN XL network üzerinde logical/virtual communication ayrımında kullanılabilir.

### **Acceptance Field**

32-bit:

AF

node address veya content indication benzeri bilgileri higher layer kullanımına bırakabilir.

### **Payload**

1 ... 2048 byte

olduğu için normal CAN hex-table görünümü yetersiz kalabilir.

Toolkit:

Hex Viewer

Offset

ASCII

Search

Field regions

Payload export

özelliklerini sağlamalıdır.

---

# **SAE J1939**

J1939 özellikle ağır hizmet araçları, iş makineleri, tarım makineleri ve vehicle-derived stationary applications için kullanılan CAN tabanlı communication architecture'dır. Classical J1939 data-link layer 29-bit Classical CAN extended frame kullanır; SAE ayrıca J1939-22 ile CAN FD tabanlı data-link yapısını da tanımlar.

### **29-bit identifier**

Belgendeki mevcut yapıya uygun olarak:

Priority

Reserved

Data Page

PDU Format

PDU Specific

Source Address

alanlarına ayrılmalıdır.

Görsel:

28        26 25 24 23        16 15         8 7          0

\+-----------+--+--+------------+------------+------------+

| Priority  |R |DP|     PF     |     PS     |     SA     |

\+-----------+--+--+------------+------------+------------+

Örnek:

CAN ID:

0x18F00401

Belgedeki test beklentisine göre:

Priority:

6

PGN:

61444

Source Address:

1

olarak çözülmelidir.

### **PGN**

PDU1:

PF \< 240

ise PS destination address olarak değerlendirilir ve PGN hesaplanırken PS sıfırlanır.

Belgedeki formül:

\[  
PGN=(DP\<\<16)|(PF\<\<8)  
\]

PDU2:

PF \>= 240

ise PS group extension'dır:

\[  
PGN=(DP\<\<16)|(PF\<\<8)|PS  
\]

### **SPN**

PGN payload'ı içindeki physical parameters SPN olarak tanımlanabilir.

Toolkit:

SPN

Name

Start Bit

Length

Resolution

Offset

Unit

Valid Range

NA Value

Error Value

göstermelidir.

Physical conversion:

\[  
Physical=Raw\\times Resolution+Offset  
\]

### **Address Claim**

Toolkit node table:

SA     NAME                 Device

00     Engine \#1            ...

03     Transmission         ...

21     Body Controller      ...

oluşturmalıdır.

Address conflict:

Address 0x21 claimed by two NAME values

tespit edilebilmelidir.

### **Transport Protocol**

8 byte CAN payload'u aşan J1939 application data için transport mekanizmaları bulunur.

Toolkit:

BAM

RTS

CTS

DT

EndOfMsgAck

Abort

akışlarını session olarak gruplayabilmelidir. J1939 transport segmentation standardın data-link/transport doküman ailesinin parçasıdır.

BAM:

TP.CM BAM

      ↓

TP.DT packet 1

TP.DT packet 2

TP.DT packet 3

...

Reassembled:

Original PGN

Total Length

Packet Count

Complete Payload

### **DM1 / DM2**

Diagnostic görünüm:

DM1

├─ Lamp Status

└─ Active DTC

   ├─ SPN

   ├─ FMI

   └─ Occurrence Count

DM2:

Previously Active DTC

### **J1939 Analyzer**

CAN ID

Priority

PGN

PGN Name

Source

Destination

SPNs

Physical Values

Transport State

Address Claims

DM1/DM2

DTC

FMI

Occurrence

Period

Jitter

göstermelidir.

---

# **CANopen**

CANopen automotive dışında da yaygın olsa da elektrikli araç, special vehicle, robotics ve auxiliary ECU sistemlerinde görülebilir.

CANopen temel communication protocols:

NMT

SDO

PDO

SYNC

EMCY

Heartbeat

ve Object Dictionary etrafında organize edilir. CiA 301 CANopen application layer ve communication profile'ı tanımlar.

### **Object Dictionary**

16-bit Index

\+

8-bit Sub-index

yapısı kullanılmalıdır.

Toolkit:

Index:     0x6041

Subindex:  0

Name:      Statusword

Type:      uint16

Access:    RO

Value:     0x1237

şeklinde gösterebilmelidir.

### **NMT**

Node state timeline:

Initializing

      ↓

Pre-operational

      ↓

Operational

      ↓

Stopped

### **PDO**

Real-time process data:

TPDO

Device → Network

RPDO

Network → Device

PDO mapping, object dictionary mapping entries üzerinden hangi application objects'ın payload içine konduğunu tanımlar.

Örnek:

CAN ID:

0x181

DATA:

37 12 DC 05

EDS/profile varsa:

Statusword:

0x1237

Velocity:

1500 rpm

olarak çözülebilir.

### **SDO**

Configuration/service access:

Client

↓

Index

Sub-index

Read / Write

↓

Server

Toolkit:

Expedited

Segmented

Block

transfer tiplerini ayırmalıdır. CiA SDO server/client channels ve Object Dictionary erişimini tanımlar.

### **EMCY**

Node

Error Code

Error Register

Manufacturer Data

semantic olarak açılmalıdır.

### **CiA 402**

Drive profile yüklüyse:

Controlword

Statusword

Modes of Operation

Target Velocity

Actual Velocity

Target Position

Actual Position

gibi değerler state-machine görünümü ile işlenebilir. CiA 402 motion controller/drives için en yaygın CANopen profile'lardan biridir.

---

# **LIN**

LIN düşük maliyetli automotive subnetwork haberleşmesidir. Güncel published protocol specification **ISO 17987-3:2025** signal management, frame transfer, schedule table, commander/responder behaviour ve status management'i kapsar.

Temel frame:

BREAK

SYNC

PROTECTED IDENTIFIER

DATA

CHECKSUM

Belgedeki yapıyla uyumludur.

### **Break**

Commander frame başlangıcını uzun dominant pulse ile bildirir.

Toolkit:

Break Length

Expected Minimum

Measured

PASS / FAIL

göstermelidir.

### **Sync**

0x55

pattern'i kullanılır.

Binary:

01010101

alternating edge yapısı baud synchronization için uygundur.

### **Identifier**

6-bit frame ID üzerine parity bitleri eklenerek Protected Identifier oluşturulur.

Belgedeki formüller:

\[  
P0=ID0\\oplus ID1\\oplus ID2\\oplus ID4  
\]

\[  
P1=\\neg(ID1\\oplus ID3\\oplus ID4\\oplus ID5)  
\]

Toolkit:

Raw PID:

0x..

Frame ID:

0x..

P0:

...

P1:

...

Parity:

PASS

göstermelidir.

### **Schedule Table**

LIN deterministik communication için schedule table kullanır.

Slot 1:

Frame 0x10

Period 10 ms

Slot 2:

Frame 0x20

Period 20 ms

Slot 3:

Diagnostic Frame

Toolkit timeline:

0ms      10ms      20ms      30ms

| F10 | F20 | F10 | F30 | F10 |

göstermelidir.

### **Checksum**

Classic Checksum

Enhanced Checksum

ayrılmalıdır.

### **LDF**

LIN Description File import edildiğinde:

Nodes

Frames

Signals

Schedules

Diagnostic frames

Baudrate

semantic decoder'a aktarılmalıdır.

---

# **FlexRay**

FlexRay deterministic ve time-triggered automotive communication için tasarlanmış çift kanallı communication system'dir. ISO 17458 ailesi FlexRay'i standardize eder; fiziksel katman data rate'i 10 Mbit/s'ye kadar destekler ve point-to-point, linear passive bus, passive star ve active star topolojileri tanımlar.

### **Channel**

Channel A

Channel B

ayrı ayrı analiz edilmelidir.

### **Communication cycle**

Conceptual:

Communication Cycle

│

├─ Static Segment

├─ Dynamic Segment

├─ Symbol Window

└─ Network Idle Time

Toolkit cycle timeline göstermelidir.

### **Static segment**

Time-triggered slots:

Slot 1 → ECU A

Slot 2 → ECU B

Slot 3 → ECU C

Deterministik message transmission için kullanılır.

### **Dynamic segment**

Event-driven communication için minislot tabanlı arbitration kullanılır.

Toolkit:

Static

Dynamic

Symbol

Idle

alanlarını farklı renkte göstermelidir.

### **Frame**

Belgedeki mevcut hedeflerle:

Frame ID

Cycle Count

Payload Length

Header CRC

Frame CRC

Channel A/B

gösterilmelidir.

Frame tree:

Header

├─ Indicators

├─ Frame ID

├─ Payload Length

├─ Header CRC

└─ Cycle Count

Payload

Trailer

└─ Frame CRC

### **Cycle correlation**

Örneğin:

Frame ID 10

Cycle:

20

22

24

26

gibi belirli cycle filtering kullanıyorsa toolkit bunu pattern olarak gösterebilir.

### **Error analysis**

Header CRC error

Frame CRC error

Missing static frame

Unexpected cycle

Channel A/B mismatch

Slot violation

Cycle timing error

tespit edilmelidir.

---

# **SENT — Single Edge Nibble Transmission**

SENT, automotive sensors'tan ECU'ya düşük maliyetli digital sensor data aktarımı için kullanılan pulse-duration tabanlı interface'tir ve SAE J2716 ile standardize edilmiştir.

SENT UART/CAN gibi byte-clocked serial protocol değildir. Bilgi **pulse duration** üzerinden nibble olarak kodlanır.

### **Fast Channel frame**

Toolkit conceptual frame'i:

Synchronization / Calibration Pulse

↓

Status / Communication Nibble

↓

Data Nibble 1

Data Nibble 2

...

↓

CRC Nibble

↓

Optional Pause Pulse

olarak göstermelidir.

Belgende de SENT için:

Sync pulse

Status nibble

Data nibbles

CRC nibble

Pause pulse

Fast channel

Slow channel

tanımlanmış durumda.

### **Pulse decoder**

Input log:

Pulse 0: 168 us

Pulse 1: 45 us

Pulse 2: 63 us

Pulse 3: ...

Toolkit önce calibration/sync pulse üzerinden:

Estimated Tick Time

çıkarmalıdır.

Ardından her nibble:

Pulse duration

↓

Tick count

↓

Nibble value

olarak decode edilmelidir.

Örnek ekran:

Pulse:

45.0 us

Tick:

3.0 us

Pulse Ticks:

15

Decoded Nibble:

0x3

Exact timing constants ve toleranslar seçilen SAE J2716 revision/profile'dan alınmalıdır; toolkit bunları hard-coded evrensel değer olarak kabul etmemelidir. SAE J2716 mevcut yayımlanmış temel SENT standardıdır.

### **Slow Channel**

Fast channel frame'leri içindeki communication/status bitlerinden daha düşük hızlı secondary information taşınabilir.

Toolkit:

Fast Channel:

Sensor Value

Slow Channel:

Sensor ID

Status

Diagnostic

Calibration information

olarak ayrı stream üretmelidir.

### **CRC**

CRC nibble:

Received

Calculated

PASS/FAIL

gösterilmelidir.

### **Signal graph**

SENT için önemli özellik:

Pulse Width vs Frame

grafiğidir.

Örneğin:

Nibble      Pulse

0x1         ...

0xA         ...

0xF         ...

scatter/trend görünümü sağlanabilir.

---

# **SPC — Short PWM Code**

SPC, SENT ile ilişkili bidirectional/request-triggered kullanım yaklaşımıdır. Receiver/ECU, SENT data hattında belirli bir pulse oluşturarak transmitter/sensor'dan response veya belirli davranış talep edebilir. Microchip'in SENT peripheral dokümanında SPC'nin receiver'ın transmitter'dan message istemesi, mode değiştirmesi veya sensor calibration gibi bidirectional senaryolar için kullanılabildiği belirtilir.

### **Transaction**

ECU

│

└─ SPC Trigger Pulse

        ↓

Sensor recognizes request

        ↓

SENT Response Frame

Toolkit timeline:

Idle

↓

SPC Trigger

↓

Response Delay

↓

SENT Sync

↓

SENT Data

### **Trigger analysis**

Trigger Start

Trigger End

Pulse Width

Sensor selection/profile

Response delay

Response frame

göstermelidir.

### **Error cases**

Trigger too short

Trigger too long

No response

Response timeout

Invalid SENT CRC

Unexpected sensor

Line not idle before trigger

SPC profile-specific pulse width semantics sensor/vendor datasheet'ine bağlı tutulmalıdır.

---

# **PSI5 — Peripheral Sensor Interface**

PSI5 automotive peripheral sensors için geliştirilmiş sensor interface'tir. Birçok implementation'da sensor-to-ECU communication current-loop/current-modulation tabanlıdır ve dedicated PSI5 peripheral veya external PHY/transceiver üzerinden işlenir. Infineon AURIX documentation PSI5'i özellikle airbag ve diğer peripheral sensor applications için current-loop serial link olarak tanımlar.

Toolkit'in ilk sürümünde fiziksel current waveform capture zorunlu olmayabilir; belgenin mevcut yaklaşımına uygun biçimde pulse/frame log import desteklenebilir.

### **Analyzer alanları**

Channel

Timestamp

Slot

Frame Type

Data

Parity

CRC

Sensor Address

Status

Sync Mode

### **Synchronous communication**

Conceptual:

ECU Sync Pulse

       ↓

Time Slot 1 → Sensor 1

Time Slot 2 → Sensor 2

Time Slot 3 → Sensor 3

Toolkit slot view:

SYNC

│

├── TS1 \[Sensor 1\]

├── TS2 \[Sensor 2\]

└── TS3 \[Sensor 3\]

### **Asynchronous mode**

Frame'ler external sync'e bağlı olmadan sensor timing'i ile gelebilir.

Toolkit:

Synchronous

Asynchronous

ayrımını otomatik veya kullanıcı seçimiyle yapmalıdır.

### **Physical / protocol split**

Current modulation

↓

Decoded Manchester/bit stream

↓

PSI5 frame

↓

Sensor data

katmanları ayrılmalıdır.

### **PSI5 versioning**

PSI5'in farklı revision ve application-specific profile'ları bulunduğu için:

PSI5 Revision

Application Profile

Airbag

Chassis/Safety

Powertrain

Custom

metadata'sı kullanılmalıdır.

Toolkit exact CRC, frame-size ve slot kurallarını seçilen profile specification'dan yüklemeli; tek global frame formatı varsaymamalıdır.

---

# **K-Line**

K-Line, legacy automotive diagnostics'te kullanılan single-wire UART tabanlı physical communication hattıdır.

K-Line üzerinde farklı diagnostic data-link/application protocol'leri çalışabilir:

ISO 9141

ISO 14230 KWP2000

UDS on K-Line

OEM proprietary

Bu nedenle:

K-Line \= physical/data transport environment

ile:

KWP / UDS / OBD \= upper layers

karıştırılmamalıdır.

ISO 14230-1 K-Line physical layer'ı ISO 9141 tabanlı olarak tanımlar ve 12 V ile 24 V vehicle supply sistemlerine genişletir.

### **Toolkit physical/log view**

Idle

Initialization

Request

Response

Inter-byte gap

Inter-message gap

göstermelidir.

### **Initialization**

K-Line analyzer:

5-baud initialization

Fast initialization

Unknown/OEM initialization

candidate detector sağlamalıdır.

ISO 14230-2, ISO 9141 ve ISO 14230 initialization yöntemlerinin coexistence durumunu tester'ın ayırması gerektiğini özellikle belirtir.

---

# **ISO 9141**

ISO 9141 vehicle ECU ile diagnostic tester arasında digital information exchange için eski fakat önemli diagnostic communication standardıdır. ISO 9141-2 emissions-related OBD diagnostic iletişimini OBD test equipment ile ilişkilendirir.

Toolkit:

Initialization

Keyword / synchronization

Target/source

Data bytes

Checksum

Timing

görünümleri sağlamalıdır.

### **5-baud initialization**

Analyzer slow initialization pattern'i ayrı event olarak tanımalıdır:

Initialization Start

↓

Address transmission

↓

Synchronization

↓

Keywords

↓

Normal diagnostic communication

Exact timing selected ISO 9141 revision/profile'a göre doğrulanmalıdır.

### **Error view**

Initialization timeout

Invalid sync

Keyword mismatch

Checksum failure

Response timeout

Unexpected address

gösterilmelidir.

---

# **ISO 14230 — KWP2000**

ISO 14230, K-Line üzerinde diagnostic communication için kullanılan **Keyword Protocol 2000 — KWP2000** ailesidir.

ISO 14230-2 UART-based K-Line vehicle communication için data-link services tanımlar ve UDS/OBD gibi application layer'ları taşıyabilir.

### **Katman**

KWP Application Services

↓

ISO 14230 Data Link

↓

K-Line Physical Layer

### **Message analyzer**

Toolkit:

Format

Target Address

Source Address

Length

Service ID

Data

Checksum

alanlarını seçilen header formatına göre göstermelidir.

### **Initialization**

İki önemli yöntem:

5-Baud Init

Fast Init

ayrı timeline'a sahip olmalıdır.

### **KWP service**

KWP2000 diagnostic service parser:

Request SID

Response SID

Parameters

Negative response

modeli kullanmalıdır.

### **Migration comparison**

Toolkit karşılaştırma ekranında:

KWP2000

vs

UDS

servis isimlerini ve semantic karşılıklarını gösterebilir.

Bu özellikle legacy ECU'dan UDS tabanlı ECU'ya geçişte değerlidir.

---

# **ISO-TP — ISO 15765-2 DoCAN Transport Protocol**

ISO-TP, CAN'in sınırlı frame payload'ı üzerinde daha uzun application message'ların parçalanıp yeniden birleştirilmesini sağlar.

2026 itibarıyla mevcut published standard **ISO 15765-2:2024 Edition 4**'tür; Edition 5 üzerinde çalışma başlamıştır. Toolkit standard revision metadata'sını saklamalıdır.

ISO-TP hem Classical CAN hem CAN FD ortamlarında kullanılabilir.

### **PCI frame tipleri**

Belgedeki mevcut liste:

Single Frame

First Frame

Consecutive Frame

Flow Control

şeklindedir.

High nibble conceptual:

0x0 → Single Frame

0x1 → First Frame

0x2 → Consecutive Frame

0x3 → Flow Control

### **Single Frame**

Kısa payload:

PCI | UDS DATA

Örnek:

02 10 01

Toolkit:

PCI:

Single Frame

Payload Length:

2

Payload:

10 01

UDS:

Diagnostic Session Control

göstermelidir.

### **First Frame**

Uzun mesaj başlangıcı:

10 14 ...

örneğinde toolkit:

Frame Type:

First Frame

Total Application Length:

20 byte

olarak yorumlamalıdır.

### **Consecutive Frame**

21 ...

22 ...

23 ...

sequence nibble:

1

2

3

...

F

0

1

wrap edebilir.

Toolkit:

Expected SN: 4

Received SN: 6

ERROR:

Missing Consecutive Frame

göstermelidir.

### **Flow Control**

30 BS STmin ...

gibi frame:

Flow Status

Block Size

Separation Time

alanlarına ayrılmalıdır.

Flow Status:

Continue To Send

Wait

Overflow

semantic olarak gösterilmelidir.

### **Reassembly view**

FF

↓

CF1

↓

CF2

↓

CF3

↓

Complete UDS Payload

Toolkit:

Progress:

48 / 128 bytes

Sequence:

Valid

Elapsed:

18.4 ms

göstermelidir.

### **Addressing mode**

Belgede belirtilen:

Addressing Mode

Padding

parametreleri mutlaka desteklenmelidir.

Örneğin:

Normal Addressing

Extended Addressing

Mixed Addressing

profile'a göre seçilebilir.

---

# **UDS — Unified Diagnostic Services**

UDS, ECU diagnostic fonksiyonlarının network transport'tan bağımsız application-layer servislerini tanımlar.

**ISO 14229-1'in güncel yayımlanmış sürümü Haziran 2026 itibarıyla ISO 14229-1:2026 Edition 4'tür.** Diagnostic tester'ın ECU'da DTC okuma/silme, live data okuma, actuator/routine control, programming vb. işlemler yapmasını kapsar.

UDS transport'tan bağımsızdır; CAN/ISO-TP, DoIP ve K-Line gibi farklı alt katmanlarla kullanılabilir. ISO 14229-2 bunu özellikle tanımlar.

### **Belgedeki temel servisler**

0x10 Diagnostic Session Control

0x11 ECU Reset

0x14 Clear Diagnostic Information

0x19 Read DTC Information

0x22 Read Data By Identifier

0x27 Security Access

0x28 Communication Control

0x2E Write Data By Identifier

0x31 Routine Control

0x34 Request Download

0x36 Transfer Data

0x37 Request Transfer Exit

0x3E Tester Present

0x85 Control DTC Setting

### **Request / positive response**

Örnek:

TX:

22 F1 90

Toolkit:

Service:

ReadDataByIdentifier

DID:

0xF190

olarak göstermelidir.

Positive response service genel modelde request SID \+ `0x40` ilişkisini kullanır; belge de bunu açıkça tanımlamış.

Request:

22

Positive Response:

62

### **Negative Response**

7F

Original SID

NRC

Toolkit:

7F 22 31

için:

Negative Response

Original Service:

ReadDataByIdentifier

NRC:

0x31

Meaning:

Request Out Of Range

gibi semantic decoder kullanmalıdır.

### **Session**

Toolkit ECU state:

Default Session

Programming Session

Extended Diagnostic Session

OEM Session

olarak takip etmelidir.

Timeline:

Default

   ↓ 10 03

Extended

   ↓

Diagnostic operations

   ↓ timeout / reset

Default

### **Security Access**

Tester → Request Seed

ECU    → Seed

Tester → Key

ECU    → Positive / Negative

Toolkit:

Security Level

Seed

Key length

Response

Delay / Lockout

gösterebilir.

Seed-key algoritmasını bilmediği durumda kırmaya veya tahmin etmeye çalışmamalı; yalnız transaction'ı analiz etmelidir.

### **DID**

DID database import edilebilmelidir:

DID 0xF190

Name: VIN

Type: ASCII

Length: 17

DID 0x1234

Name: Battery Voltage

Type: uint16

Factor: 0.001

Unit: V

### **DTC**

DTC viewer:

DTC

Status Mask

Status

Snapshot

Extended Data

Occurrence

alanlarını göstermelidir.

### **Programming timeline**

Programming Session

↓

Security Access

↓

Request Download

↓

Transfer Data

↓

Transfer Data

↓

Request Transfer Exit

↓

Routine Check

↓

ECU Reset

tek programming session olarak gruplanmalıdır.

---

# **OBD-II**

OBD-II emissions-related generic vehicle diagnostics için standardize edilmiş diagnostic erişim modelidir. SAE J1979/ISO 15031-5 vehicle OBD system ile generic test equipment arasındaki emissions-related diagnostic services'i tanımlar. Güncel SAE J1979 sürümü Mayıs 2025'te reaffirm edilmiştir; J1979-DA ise diagnostic data/PID tanımlarını dijital ek olarak sürdürmektedir.

### **Modes**

Toolkit en az:

Mode 01

Mode 03

Mode 04

Mode 09

desteklemelidir; belgenin mevcut hedefi de budur.

Daha geniş decoder:

01 Current Data

02 Freeze Frame

03 Stored DTC

04 Clear DTC / diagnostic information

05 Oxygen sensor test legacy

06 Monitor test results

07 Pending DTC

08 Control operation

09 Vehicle Information

historical J1979 test mode yapısı bu şekilde tanımlanmıştır.

### **PID example — Engine RPM**

Belgedeki formül:

\[  
RPM=\\frac{A\\times256+B}{4}  
\]

Örnek:

A \= 0x1A \= 26

B \= 0xF8 \= 248

\[  
RPM=  
\\frac{26\\times256+248}{4}  
\=1726  
\]

Toolkit:

PID:

Engine RPM

Raw:

1A F8

Physical:

1726 rpm

### **Vehicle speed**

\[  
Speed=A\\ km/h  
\]

### **Coolant temperature**

\[  
T=A-40  
\]

### **DTC**

Toolkit:

Pxxxx

Cxxxx

Bxxxx

Uxxxx

class ve code ayrıştırmasını yapmalıdır.

Örneğin raw DTC bytes:

01 33

appropriate bit mapping ile standard textual DTC'ye dönüştürülmelidir.

### **VIN**

Mode 09 response varsa multi-frame reassembly sonrası:

VIN:

XXXXXXXXXXXXXXXXX

gösterilmelidir.

---

# **DoIP — Diagnostics over Internet Protocol**

DoIP diagnostic communication'ı IP/Ethernet ortamına taşır.

**Güncel ISO 13400-2 sürümü Haziran 2025 tarihli Edition 3'tür.** Standard client DoIP entity ile vehicle/server tarafı arasında TCP ve UDP üzerinden secured veya unsecured diagnostic communication, discovery, routing ve gateway davranışlarını tanımlar.

### **Katman**

UDS

↓

DoIP

↓

TCP / UDP

↓

IP

↓

Ethernet

### **Discovery**

Toolkit ayrı:

Vehicle Announcement

Vehicle Identification Request

Vehicle Identification Response

transaction'larını göstermelidir.

ISO 13400-2 vehicle announcement/discovery ve network integration'ı mandatory functionality olarak tanımlar.

### **Routing Activation**

Diagnostic communication başlamadan önce tester ile DoIP gateway arasında routing activation akışı olabilir.

Timeline:

TCP Connect

↓

Routing Activation Request

↓

Routing Activation Response

↓

Diagnostic Communication

Toolkit:

Tester Logical Address

Gateway Logical Address

Activation Type

Response

göstermelidir.

### **Diagnostic message**

DoIP Header

↓

Source Address

Target Address

UDS Payload

ve ardından UDS decoder'a aktarılmalıdır.

### **Alive / connection state**

TCP Connected

Routing Active

Diagnostic Active

Idle

Disconnected

state machine tutulmalıdır.

### **TLS**

ISO 13400-2:2025 optional TLS capability içerir. Toolkit:

TLS:

Enabled / Disabled

Certificate

Cipher

Handshake status

metadata'sı gösterebilir.

---

# **Automotive Ethernet**

Automotive Ethernet tek bir application protocol değildir.

Aşağıdaki yapıları kapsayan Ethernet ecosystem'i olarak ele alınmalıdır:

100BASE-T1

1000BASE-T1

Multi-Gig automotive Ethernet

Switching

VLAN

TSN

IPv4 / IPv6

UDP / TCP

DoIP

SOME/IP

PTP

AVB/TSN

Diagnostic external interface tarafında ISO 13400-3, IEEE 802.3 tabanlı 100BASE-TX vehicle/test equipment interface'i tanımlar.

Vehicle içi Automotive Ethernet tarafında toolkit protocol stack'i katmanlı göstermelidir:

Ethernet

↓

802.1Q VLAN

↓

IPv4 / IPv6

↓

UDP / TCP

↓

SOME/IP / DoIP / XCP

### **ECU communication matrix**

ECU              IP              MAC

Gateway          10.0.0.1        ...

Camera           10.0.0.20       ...

ADAS              ...

Infotainment      ...

### **Stream statistics**

Bandwidth

Packets/s

Multicast

Unicast

Broadcast

VLAN

PCP

Latency

Jitter

Packet Loss

### **Top talkers**

Camera ECU:

420 Mbit/s

Gateway:

35 Mbit/s

Diagnostics:

2.4 Mbit/s

gibi görünüm sağlanabilir.

---

# **SOME/IP**

SOME/IP automotive Ethernet üzerinde service-oriented communication için kullanılan protocol ailesidir. AUTOSAR resmi Foundation specification setinde SOME/IP Protocol Specification yayınlamaktadır.

Toolkit iki ana parçayı ayırmalıdır:

SOME/IP

SOME/IP Service Discovery

### **SOME/IP header**

Decoder en az:

Service ID

Method / Event ID

Length

Client ID

Session ID

Protocol Version

Interface Version

Message Type

Return Code

Payload

alanlarını göstermelidir.

Conceptual:

Service ID | Method ID

Client ID  | Session ID

Length

Version

Message Type

Return Code

Payload

Exact bit/byte allocation seçilen AUTOSAR SOME/IP specification revision'ından uygulanmalıdır.

### **Request / Response**

Client

↓

Request Service 0x1234

Method 0x0001

Session 0x0034

↓

Server

Server

↓

Response

Session 0x0034

↓

Client

Toolkit session ID üzerinden request-response correlation yapmalıdır.

### **Notification / Event**

Event

↓

Subscriber(s)

request-response'dan ayrı renkte gösterilmelidir.

### **Service Discovery**

Toolkit:

FindService

OfferService

SubscribeEventgroup

SubscribeAck

StopOffer

gibi SD semantic'lerini ayrı decoder module ile göstermelidir.

### **Service Browser**

Service 0x1234

├─ Instance 0x0001

├─ Methods

├─ Events

└─ Event Groups

tree view oluşturulabilir.

---

# **XCP on CAN**

XCP, ECU measurement, calibration, stimulation ve programming için kullanılan bus-independent master-slave protocol'dür.

ASAM MCD-1 XCP'nin güncel yayımlanmış version'ı 1.5.0'dır. Base protocol CAN, CAN FD, FlexRay, Ethernet, serial links ve USB gibi farklı transport'lara map edilebilir.

XCP on CAN:

Calibration Tool

↓

XCP

↓

CAN / CAN FD

↓

ECU

### **CTO ve DTO**

Toolkit iki conceptual message category'yi ayırmalıdır:

CTO

Command Transfer Object

DTO

Data Transfer Object

CTO:

CONNECT

GET\_STATUS

SET\_MTA

UPLOAD

DOWNLOAD

...

gibi command/response trafiği için.

DTO:

DAQ

STIM

yüksek hızlı data stream için kullanılabilir.

### **A2L**

ASAM, ECU parameter ve measurement variable memory addresses/properties bilgisinin A2L üzerinden calibration system'e verildiğini açıklar.

Toolkit:

Load A2L

↓

Measurements

Characteristics

Axis

Memory Segment

Events

DAQ Lists

XCP Parameters

tanımlarını oluşturmalıdır.

### **Measurement**

Raw DTO:

01 34 12 78 56

A2L varsa:

EngineSpeed:

1498 rpm

Throttle:

23.4 %

olarak dönüştürülmelidir.

### **DAQ**

DAQ analyzer:

DAQ List

ODT

Event Channel

Timestamp

Measurements

Packet Rate

Lost DTO

göstermelidir.

### **Calibration**

CONNECT

↓

SET\_MTA

↓

UPLOAD

↓

Modify

↓

DOWNLOAD

transaction tree oluşturulmalıdır.

---

# **XCP on Ethernet**

XCP base protocol aynı kalırken transport:

Ethernet

↓

IP

↓

UDP veya TCP

↓

XCP

olabilir. ASAM XCP standardı UDP/IP ve TCP/IP transport layer'larını açıkça destekler.

### **Analyzer**

MAC

IP

UDP/TCP

XCP Transport Header

XCP Packet

CTO/DTO

DAQ

Measurement

katmanlarını ayırmalıdır.

### **UDP**

DAQ gibi yüksek data-rate traffic'te:

Packet Loss

Sequence Gap

Out-of-order

Jitter

izlenmelidir.

### **TCP**

Toolkit TCP stream reassembly yapmalıdır:

TCP Segment 1

TCP Segment 2

↓

Complete XCP Packet

### **Throughput**

DAQ Samples/s

Payload Byte/s

Network Byte/s

Protocol Efficiency

Packet Rate

hesaplanmalıdır.

### **Time correlation**

XCP'ın measurement data ve ECU event timing mekanizmaları nedeniyle:

ECU timestamp

Host timestamp

Offset

Drift

analizi özellikle yararlı olur. ASAM XCP standardı measurement/calibration yanında time correlation işlevlerini de içerir.

---

# **CCP — CAN Calibration Protocol**

CCP, CAN-specific ECU calibration ve measurement protocol'dür.

ASAM MCD-1 CCP'nin current published version'ı 2.1.0'dır; ASAM bunu legacy/obsolete teknoloji olarak sınıflandırmakta ve yeni sistemlerde XCP kullanımını önermektedir.

Katman:

Calibration Tool

↓

CCP

↓

CAN

↓

ECU

### **CRO / DTO**

CCP'de conceptual:

CRO

Command Receive Object

DTO

Data Transmission Object

yapıları gösterilmelidir.

### **Command flow**

CONNECT

↓

GET\_CCP\_VERSION

↓

SET\_MTA

↓

UPLOAD / DOWNLOAD

↓

DAQ

Toolkit:

Command

Counter

Parameters

Response

Status

alanlarını ayrıştırmalıdır.

### **A2L integration**

CCP de calibration database/A2L ile birlikte kullanıldığında anlamlı hale gelir.

Raw ECU Address

↓

A2L Mapping

↓

Parameter Name

↓

Physical Value

### **CCP → XCP karşılaştırma**

Toolkit bilgi paneli:

CCP:

CAN-specific

Legacy

XCP:

Transport independent

Recommended successor

gösterebilir.

---

# **SAE J1850 PWM**

SAE J1850 legacy Class-B automotive communication network standardıdır. Standardın güncel durumu stabilized'dır; J1850 iki klasik physical/data coding implementation'ı tanımlamıştır: **41.6 kbit/s PWM** ve **10.4 kbit/s VPW**.

PWM:

Pulse Width Modulation

kullanır.

Toolkit pulse-log tabanlı decoder sağlamalıdır.

### **Pulse Analyzer**

Input:

Pulse 1:

8 us

Pulse 2:

16 us

Pulse 3:

8 us

Decoder selected J1850 profile'a göre:

Bit 1

Bit 0

Bit 1

gibi dönüştürmelidir.

SAE'nin J1850 standard summary'si 41.6 kbit/s PWM implementation'ı tanımlar.

### **Frame analyzer**

Conceptual:

SOF

Header

Data

CRC

EOD

EOF

alanlarını göstermelidir.

Exact header semantics message/application standardına göre değişebileceğinden J2178/J1979 gibi üst dokümanlarla mapping yapılmalıdır. SAE J2178, J1850 non-diagnostic message header/data field tanımlarını ayrıca standardize eder.

### **Bit pulse view**

Pulse Width

Threshold

Decoded Bit

Confidence

alanları:

Width      Bit

8.1 us     1

15.9 us    0

8.0 us     1

### **Errors**

Invalid pulse width

SOF missing

CRC error

EOF timeout

Collision/arbitration issue

Unexpected symbol

---

# **SAE J1850 VPW**

VPW:

Variable Pulse Width

single-wire legacy J1850 implementation'dır.

SAE J1850 classic implementation setinde 10.4 kbit/s VPW ve 41.6 kbit/s PWM fiziksel seçenekleri birlikte tanımlanmıştır.

VPW'de bit anlamı yalnız pulse width'e değil aktif/passive state ve pulse duration'a birlikte bağlıdır.

Toolkit raw capture:

State     Duration

Active    64 us

Passive   128 us

Active    64 us

...

üzerinden bitstream çıkarmalıdır.

### **Analyzer stages**

Pulse Capture

↓

Symbol Decode

↓

Bits

↓

Bytes

↓

J1850 Frame

↓

OBD / OEM Message

### **OBD relation**

Legacy OBD-II uygulamaları J1850 üzerinden taşınabilir. Güncel SAE J1979 scope halen legacy physical/data-link seçenekleri arasında SAE J1850'yi listeler.

Bu nedenle toolkit:

J1850 VPW

↓

OBD-II

↓

Mode

↓

PID

zincirleme decode yapabilmelidir.

---

# **3.4 Ortak Automotive Network Analyzer**

Bütün otomotiv modüllerinin üzerinde ortak bir vehicle-network analiz katmanı bulunmalıdır.

## **ECU / Node Explorer**

Network: Powertrain CAN

ECU                         Address / ID

Engine ECU                  ...

Transmission ECU            ...

ABS/ESC                     ...

Gateway                     ...

Instrument Cluster          ...

Node detection protocol'e göre yapılmalıdır:

CAN        → observed IDs

J1939      → Source Address / NAME

CANopen    → Node ID

LIN        → Node/Frame publisher

DoIP       → Logical Address

Ethernet   → MAC / IP

## **Network Matrix**

Message      Producer       Consumer       Period

0x100        Engine         Cluster        10 ms

0x120        ABS            Gateway        20 ms

0x321        Body           Door           100 ms

## **Period Analysis**

Her ID:

\[  
Period\_i=t\_i-t\_{i-1}  
\]

Average:

\[  
T\_{avg}=  
\\frac{1}{N-1}  
\\sum\_{i=2}^{N}(t\_i-t\_{i-1})  
\]

Frequency:

\[  
f=\\frac{1}{T}  
\]

Jitter:

\[  
J\_i=T\_i-T\_{expected}  
\]

gösterilmelidir.

Örnek:

CAN ID:

0x120

Expected:

10.000 ms

Average:

10.013 ms

Minimum:

9.890 ms

Maximum:

10.171 ms

Jitter:

±0.17 ms

## **Missing Message Detector**

Expected Period:

10 ms

Last Frame:

35 ms ago

Missing Estimate:

3

Alarm:

CYCLIC MESSAGE TIMEOUT

## **Counter Analysis**

Örneğin payload nibble:

Frame 1:

0x0

Frame 2:

0x1

Frame 3:

0x2

Frame 4:

0x4

Toolkit:

Expected:

3

Received:

4

Possible Lost Frame:

1

göstermelidir.

## **Rolling Counter / Alive Counter**

Custom signal database:

Counter Start Bit

Counter Length

Modulo

Initial Value

tanımlanabilmelidir.

## **Application CRC / E2E**

Automotive payload içinde CAN frame CRC'den bağımsız application-layer CRC bulunabilir.

Örneğin:

CAN Data:

CRC | Counter | Signals

Toolkit CAN protocol CRC ile payload/application CRC'yi karıştırmamalıdır.

Katman:

CAN Frame CRC

    ≠

Application E2E CRC

olarak açık gösterilmelidir.

## **DBC Integration**

DBC yüklendiğinde:

CAN ID

↓

Message

↓

Signals

mapping yapılmalıdır.

Signal:

Start Bit

Length

Byte Order

Signed

Factor

Offset

Min

Max

Unit

Enum

Multiplexing

belgedeki mevcut yapıyla uyumlu olarak desteklenmelidir.

Physical conversion:

\[  
Physical=Raw\\times Factor+Offset  
\]

## **A2L Integration**

XCP/CCP için:

Measurement

Characteristic

Axis

Memory Address

Conversion

Unit

DAQ

Event

tanımları A2L'den alınmalıdır.

## **LDF Integration**

LIN:

Node

Frame

Signal

Schedule

mapping.

## **EDS Integration**

CANopen:

Object Dictionary

PDO

SDO

Device Profile

mapping.

## **Diagnostic Timeline**

Bir diagnostic session:

Tester

│

├─ ISO-TP request

│     ↓

├─ UDS 10 03

│     ↓

├─ Positive Response

│

├─ Security Access

│

├─ Read DID

│

└─ ECU Reset

tek timeline olarak gösterilmelidir.

## **Gateway Correlation**

Modern araçlarda aynı application transaction farklı ağlarda görünebilir:

CAN

↓

Central Gateway

↓

Ethernet

↓

Target ECU

Toolkit aynı diagnostic transaction'ı:

DoIP

↓

Gateway

↓

ISO-TP

↓

UDS ECU

olarak ilişkilendirebilirse çok güçlü bir integration aracı olur.

## **Multi-Bus Time Correlation**

Örneğin:

CAN1

CAN2

LIN

Ethernet

FlexRay

capture'ları aynı timeline'a getirilebilmelidir.

12:01:00.100 CAN    BrakeRequest

12:01:00.101 FlexRay BrakeCommand

12:01:00.103 CAN    BrakeStatus

## **Trigger sistemi**

Kullanıcı trigger tanımlayabilmelidir:

CAN ID \== 0x123

Signal EngineSpeed \> 6000

UDS NRC received

DTC appears

LIN checksum error

DoIP disconnected

J1939 DM1 contains FMI 5

Trigger olduğunda:

Capture 5 seconds before

\+

10 seconds after

saklanabilmelidir.

## **Otomatik Hata Korelasyonu**

Örnek:

12:10:00.000

CAN ECU disappears

12:10:00.050

Gateway reports communication DTC

12:10:00.100

UDS request timeout

12:10:00.110

Application sets signal invalid

Toolkit:

Possible Root Event:

ECU communication lost

Consequences:

• cyclic CAN frame missing

• gateway DTC

• UDS timeout

• application data invalid

şeklinde ilişkilendirmelidir.

Bu yapı sayesinde otomotiv bölümü yalnız ayrı ayrı **CAN decoder, UDS decoder ve OBD decoder** sunan bir araç koleksiyonu olmamalıdır. Amaç; **sensor pulse seviyesinden CAN/LIN/FlexRay frame'ine, transport katmanından UDS/OBD diagnostic servisine, Automotive Ethernet üzerinden DoIP/SOME-IP/XCP uygulama verisine kadar aynı araç içi iletişimi katman katman inceleyebilen bütünleşik bir automotive communication analyzer** oluşturmaktır.

## **3.5 Denizcilik ve navigasyon protokolleri**

* NMEA 0183  
* NMEA 2000  
* IEC 61162 için temel mesaj analizi  
* AIS mesajları  
* GPS NMEA mesajları  
* GNSS UBX  
* RTCM düzeltme mesajları  
* J1939 tabanlı deniz mesajları  
* SeaTalk için temel veri çözümleme  
* Modbus tabanlı deniz ekipmanı mesajları  
* HDLC tabanlı özel deniz cihazı haberleşmeleri

Denizcilik haberleşme bölümü yalnızca NMEA cümlelerini HEX veya ASCII olarak gösteren bir terminal olmamalıdır. Platform; GNSS alıcıları, gyrocompass, heading sensor, AIS, ECDIS, radar, autopilot, echo sounder, speed log, wind sensor, engine ECU, battery monitor, VDR, bridge equipment, navigation computer ve diğer gemi elektroniklerinin haberleşmesini **ham byte seviyesinden fiziksel navigasyon değerine kadar** analiz edebilmelidir.

Her denizcilik protokolünde mümkün olduğunca şu görünümler bulunmalıdır:

* Raw Stream  
* ASCII / HEX / Binary View  
* Sentence / Frame View  
* Talker / Source  
* Destination  
* Message Type  
* PGN / Message ID  
* Timestamp  
* Checksum / CRC  
* Sequence / Fragment  
* Position  
* Latitude / Longitude  
* Heading  
* Course Over Ground  
* Speed Over Ground  
* Speed Through Water  
* Rate of Turn  
* Depth  
* Wind  
* GNSS Fix  
* Satellite information  
* Engine data  
* Electrical data  
* AIS targets  
* Device identity  
* Network health  
* Source selection  
* Message period  
* Jitter  
* Timeout  
* Stale-data detection  
* Multi-message reassembly  
* Gateway conversion  
* Live chart  
* Navigation dashboard

Ortak navigation data modeli oluşturulmalıdır:

NavigationData

├─ Position

│  ├─ Latitude

│  ├─ Longitude

│  └─ Altitude

├─ Motion

│  ├─ SOG

│  ├─ COG

│  ├─ STW

│  └─ ROT

├─ Heading

│  ├─ True

│  └─ Magnetic

├─ Depth

├─ Wind

│  ├─ Apparent

│  └─ True

├─ GNSS

│  ├─ Fix Type

│  ├─ Satellites

│  ├─ HDOP

│  └─ Correction Status

└─ Vessel

   ├─ Engine

   ├─ Battery

   └─ AIS

Bu ortak model sayesinde aynı fiziksel bilgi farklı protokollerden geldiğinde karşılaştırılabilmelidir:

Heading

NMEA 0183 HDT

        ↓

       123.4°

NMEA 2000 Heading

        ↓

       123.5°

Gyro proprietary protocol

        ↓

       123.4°

Toolkit:

Difference:

0.1°

Sources:

3

Selected Source:

Gyro 1

gibi bir **Source Comparison** görünümü sağlamalıdır.

---

# **NMEA 0183**

NMEA 0183 deniz elektroniklerinde kullanılan text tabanlı seri haberleşme standardıdır. NMEA'nın güncel yayımlanmış NMEA 0183 sürümü **Version 4.30**'dur. Standart 4800 baud temel seri veri bus'ını; NMEA 0183-HS ise 38.4 kbaud yüksek hızlı varyantı tanımlar. Her bus'ta tek talker ve birden fazla listener bulunabilir. Veri printable ASCII biçimindedir.

IEC tarafındaki güncel karşılığı IEC 61162-1:2024'tür; bu da single-talker / multiple-listener, printable ASCII denizcilik veri aktarımını tanımlar.

## **Genel sentence yapısı**

Belgede tanımlanan temel yapı:

$TALKER,FIELD1,FIELD2,...\*CHECKSUM

şeklindedir.

Örnek:

$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,\*47

Toolkit bunu:

$ GP GGA , ...

│ │  │

│ │  └─ Sentence Formatter

│ └──── Talker

└────── Start

şeklinde ayrıştırmalıdır.

### **Talker ID**

Örneğin:

GP

historical GPS talker'ı temsil edebilir.

Modern GNSS sistemlerinde farklı talker identifiers bulunabilir. NMEA 0183 Version 4.30 GNSS sentence ailesini GPS, GLONASS, Galileo, BeiDou, QZSS, NavIC ve diğer modern sistemleri kapsayacak şekilde genişletmiştir.

Toolkit talker'ı yalnız text olarak göstermemelidir:

Talker:

GP

Category:

GNSS

Interpretation:

GPS-related talker

gibi semantic görünüm sağlamalıdır.

### **Sentence Formatter**

Örnek:

GGA

RMC

GSA

GSV

VTG

HDT

HDG

DPT

DBT

MWV

ROT

VHW

VLW

XDR

MTW

ZDA

GLL

RSA

Belgede bunlar desteklenecek temel sentence grubu olarak zaten tanımlanmıştır.

Tam field tanımları **selected NMEA 0183 revision database** üzerinden gelmelidir. NMEA, internette bulunan birçok sentence açıklamasının eski veya yanlış olabileceği konusunda açıkça uyarır; bu yüzden toolkit internette toplanmış rastgele sentence tablolarına bağlı olmamalıdır.

---

## **NMEA 0183 checksum**

Checksum:

$

ve:

\*

arasındaki karakterlerin XOR işlemidir. Belgedeki mevcut tasarım da bunu tanımlıyor.

Genel:

\[  
Checksum=  
C\_1\\oplus C\_2\\oplus ...\\oplus C\_n  
\]

Örneğin toolkit:

Sentence:

$GPGGA,...\*47

Received:

0x47

Calculated:

0x47

Checksum:

PASS

göstermelidir.

### **Character-level görünüm**

G  0x47

P  0x50

G  0x47

G  0x47

A  0x41

,  0x2C

...

Her XOR adımı isteğe bağlı açılabilmelidir:

Initial \= 00

00 XOR 47 \= 47

47 XOR 50 \= 17

17 XOR 47 \= 50

...

Final \= 47

Bu özellikle checksum eğitimi ve custom sentence debug için değerlidir.

---

## **NMEA coordinate conversion**

Belgedeki dönüşüm:

\[  
DecimalDegrees=  
Degrees+\\frac{Minutes}{60}  
\]

South ve West negatif yapılmalıdır.

Örnek:

4807.038,N

ayrıştırılır:

Degrees:

48

Minutes:

07.038

\[  
Latitude=  
48+\\frac{7.038}{60}  
\]

\[  
Latitude=48.1173°  
\]

Benzer:

01131.000,E

\[  
Longitude=  
11+\\frac{31}{60}  
\]

\[  
Longitude=11.5166667°  
\]

Toolkit aynı alanı:

Raw:

4807.038,N

Degrees-Minutes:

48° 07.038' N

Decimal:

48.117300°

Radians:

...

olarak gösterebilmelidir.

---

## **NMEA 0183 sentence decoder**

Örneğin GGA sentence:

$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,\*47

Toolkit, loaded revision database doğrultusunda:

Sentence:

GGA

Talker:

GP

UTC:

12:35:19

Latitude:

48.117300°

Longitude:

11.516667°

Fix Quality:

...

Satellite Count:

8

HDOP:

0.9

Altitude:

545.4 m

Checksum:

PASS

gibi çıktı sağlamalıdır.

### **Raw / parsed sync**

Kullanıcı:

545.4

field'ına tıklayınca raw sentence içinde:

...,0.9,\[545.4\],M,...

highlight edilmelidir.

---

## **Sentence frequency**

Toolkit her sentence formatter için:

Count

Expected period

Average period

Minimum

Maximum

Jitter

Last received

Age

hesaplamalıdır.

Örneğin:

GGA

Average:

1.001 s

Expected:

1.000 s

Jitter:

±8 ms

Last:

43 ms ago

State:

Fresh

### **Stale data**

Örneğin heading:

HDT

normalde düzenli geliyorsa fakat:

Last Update:

4.8 s ago

ise toolkit:

STALE DATA

uyarısı üretmelidir.

---

## **NMEA 0183 source conflict**

Aynı veri birden fazla talker tarafından üretilebilir.

Örneğin:

GPS 1 → RMC

GPS 2 → RMC

INS   → RMC

Toolkit:

Source     Latitude      Age

GPS1       ...           20 ms

GPS2       ...           22 ms

INS        ...           15 ms

karşılaştırmalı görünüm sağlamalıdır.

---

# **NMEA 2000**

NMEA 2000, CAN tabanlı, multi-master ve self-configuring marine network standardıdır. Merkezi bir network controller gerektirmez; birden fazla transmitter ve receiver aynı network üzerinden command, status ve navigation/ship data paylaşabilir. NMEA'nın güncel kamuya açık standard sayfası **NMEA 2000 Version 3.000**'ı mevcut sürüm olarak listeler.

IEC 61162-3 de NMEA 2000'in CAN teknolojisini kullanan serial-data instrument network olduğunu ve özellikle SOLAS vessels üzerindeki uygulamasını ele alır.

## **Katman**

NMEA 2000 Application

        ↓

PGN / Network Management

        ↓

29-bit CAN Identifier

        ↓

CAN Data Link

        ↓

NMEA 2000 Physical Network

Toolkit NMEA 2000 mesajını yalnız:

CAN ID \= 0x...

olarak göstermemelidir.

ID:

Priority

PGN

Source Address

Destination where applicable

alanlarına ayrılmalıdır.

Belgedeki mevcut hedef de NMEA 2000 için:

PGN

Source address

Destination

Priority

Fast packet

Single frame

Multi-packet

Device instance

Manufacturer code

Product information

alanlarını istemektedir.

---

## **NMEA 2000 PGN**

PGN:

Parameter Group Number

application message türünü temsil eder.

NMEA'nın resmi sayfası NMEA 2000 PGN suite içinde örneğin şu veri sınıflarının bulunduğunu açıkça belirtir:

GNSS

Navigation

AIS & DSC

Battery Management

Combustion Engines

Electric Propulsion

Environment

Alerts

Windlass

HVAC

Lighting

Toolkit PGN browser:

PGN

Name

Category

Priority

Length

Transmission Type

Source

Destination

Period

Fields

gibi metadata göstermelidir.

Tam proprietary/licensed PGN field database, kullanıcının lisanslı NMEA database'i veya uygun import paketi üzerinden yüklenmelidir.

---

## **29-bit identifier görünümü**

NMEA 2000, CAN/J1939 benzeri 29-bit identifier analiz modeli kullanmalıdır. Belge de bunu açıkça istemektedir.

Toolkit:

CAN ID:

0xXXXXXXXX

Priority:

...

PGN:

...

Source:

...

Destination:

...

göstermelidir.

Bit görünümü:

28      26 25 24 23        16 15        8 7         0

\+---------+--+--+------------+-----------+-----------+

|Priority |R |DP|     PF     |    PS     |    SA     |

\+---------+--+--+------------+-----------+-----------+

J1939 benzeri extraction engine ortak kullanılabilir, ancak NMEA 2000 PGN database'i ve network behaviour kendi protocol module'unda tutulmalıdır.

---

## **Single frame ve multi-frame**

Kısa message:

CAN Frame

↓

Complete NMEA Message

olarak decode edilebilir.

Daha uzun application mesajlarında transport/reassembly gerekir.

Belgedeki hedef:

Fast Packet

Single Frame

Multi-packet

ayrımını desteklemektir.

### **Fast Packet reassembly**

Toolkit:

CAN Frame 1

Sequence ...

Frame Index 0

Total Length ...

Payload part

CAN Frame 2

Frame Index 1

Payload part

CAN Frame 3

Frame Index 2

Payload part

gibi parçaları:

Complete PGN Payload

haline getirmelidir.

Reassembly ekranı:

PGN:

...

Expected Length:

...

Received:

24 / 32 bytes

Fragments:

4 / 5

State:

WAITING

### **Sequence error**

Expected Fragment:

3

Received:

4

ise:

FAST PACKET ERROR

Missing fragment 3

gösterilmelidir.

---

## **NMEA 2000 device discovery**

Network üzerindeki cihazlar ayrı tabloda gösterilmelidir:

Source   Manufacturer   Device Class   Function

12       ...            Navigation     GNSS

21       ...            Instrument     Display

35       ...            Engine         ECU

NMEA, certified NMEA 2000 products için class/function code ve network identity mekanizmalarını standardın parçası olarak yönetir.

Toolkit:

Address

Manufacturer

Product

Serial

Device Class

Device Function

Device Instance

System Instance

alanlarını bilinen network management PGN'lerinden oluşturabilmelidir.

---

## **Address changes**

NMEA 2000 self-configuring olduğundan source address sabit device identity olarak görülmemelidir.

Toolkit:

Device NAME:

...

Old SA:

35

New SA:

48

değişimini aynı logical device altında takip edebilmelidir.

---

## **PGN frequency analysis**

Örneğin heading message:

PGN: Heading

için:

Period:

100 ms

Average:

100.3 ms

Jitter:

±1.4 ms

Missing:

0

gibi statistik sağlanmalıdır.

---

## **NMEA 2000 signal dashboard**

PGN database yüklüyse:

Navigation

├─ Position

├─ Heading

├─ COG/SOG

├─ Depth

└─ Wind

Propulsion

├─ Engine RPM

├─ Oil Pressure

├─ Coolant Temperature

└─ Fuel Rate

Electrical

├─ Battery Voltage

├─ Battery Current

└─ State

gibi canlı dashboard oluşturulmalıdır.

---

# **IEC 61162 Temel Mesaj Analizi**

IEC 61162 ailesi denizcilik navigation ve radiocommunication equipment arasındaki dijital interfaces için daha geniş uluslararası standard ailesidir.

Toolkit IEC 61162'yi tek protokol gibi göstermemelidir.

En az şu aileleri ayırmalıdır:

IEC 61162-1

IEC 61162-2

IEC 61162-3

IEC 61162-450

IEC 61162-460

### **IEC 61162-1**

Güncel Edition 6:

IEC 61162-1:2024

single talker / multiple listeners, printable ASCII data ve düşük hızlı denizcilik sentence communication'ı kapsar.

Conceptual olarak NMEA 0183 ile güçlü bağlantısı vardır.

Toolkit:

Transport Profile:

IEC 61162-1

Encoding:

ASCII

Talker:

Single

Listeners:

Multiple

göstermelidir.

### **IEC 61162-2**

Güncel:

IEC 61162-2:2024

single talker/multiple listener high-speed serial transmission içindir ve approved/proprietary sentence'ları printable ASCII olarak taşır. Tipik message repetition rate'i çok daha yüksek olabilir.

Toolkit:

61162-1

vs

61162-2

karşılaştırması sağlamalıdır:

Profile

Baud / speed profile

Sentence format

Observed update rate

### **IEC 61162-3**

NMEA 2000'in SOLAS vessel implementation'ı ile bağlantılıdır ve CAN tabanlı serial data instrument network'ü ele alır.

Toolkit:

IEC 61162-3

↓

NMEA 2000 parser

yönlendirmesi yapmalıdır.

### **IEC 61162-450**

Güncel Edition 3:

IEC 61162-450:2024

multiple talkers / multiple listeners için shipboard Ethernet interconnection standardıdır. Yüksek hızlı communication ve navigation/radiocommunication equipment arasında Ethernet network üzerinden veri transferi için framework sağlar.

Katman görünümü:

IEC 61162-450 Application Data

↓

UDP / Ethernet transport

↓

Ship LAN

Toolkit özellikle:

Sender

Destination Multicast

Message Type

Sequence

Timestamp

Payload

Network

görünümü sağlamalıdır.

### **IEC 61162-460**

Güncel:

IEC 61162-460:2024

61162-450'nin üzerine safety ve security gereksinimleri ekler; network isolation, protected interconnection ve redundant network gereksinimlerini kapsar. Yeni application protocol tanımlamak yerine 61162-450'yi güvenlik açısından genişletir.

Toolkit'te:

61162-450 Network

Security Profile:

61162-460

Network Zone

Gateway

Redundancy

Isolation

Unexpected Flow

analizi eklenebilir.

---

# **AIS Mesajları**

AIS, VHF maritime mobile band üzerinde time-division multiple access kullanan Automatic Identification System'dir.

**Güncel ITU-R recommendation Ağustos 2026 itibarıyla M.1371-6 (02/2026)** olup 19 Şubat 2026'da onaylanmıştır ve M.1371-5'in yerini almıştır.

Recommendation:

Physical Layer

Link Layer

Network Layer

Transport Layer

Application behaviour

gibi AIS iletişiminin birden çok yönünü kapsar.

Toolkit iki ayrı AIS seviyesini ayırmalıdır:

AIS RF / VDL Message

        ↓

AIS Binary Payload

ve

IEC/NMEA transport

        ↓

\!AIVDM / \!AIVDO

        ↓

AIS 6-bit Payload

---

## **AIVDM / AIVDO**

Belgedeki mevcut AIS hedefleri:

AIVDM

AIVDO

Fragment count

Fragment number

Channel

Payload

Fill bits

alanlarını desteklemeyi istiyor.

AIS payload:

\!AIVDM,...

sentence'ından alındıktan sonra 6-bit AIS data'ya çevrilmelidir.

Toolkit transport cümlesini:

\!AIVDM,2,1,5,A,\<payload\>,0\*XX

gibi parçalara ayırmalıdır:

Sentence:

AIVDM

Total Fragments:

2

Fragment:

1

Sequence:

5

Channel:

A

Payload:

...

Fill Bits:

0

NMEA Checksum:

PASS

---

## **AIS fragment reassembly**

Bazı AIS payload'ları birden fazla NMEA sentence'a bölünür.

Örneğin:

Fragment 1 / 2

Fragment 2 / 2

Toolkit:

Sequence ID

Channel

Fragment Count

Fragment Number

Arrival Time

üzerinden birleştirmelidir.

State:

AIS Reassembly

Fragment 1:

RECEIVED

Fragment 2:

WAITING

ve tamamlanınca:

COMPLETE

olmalıdır.

### **Missing fragment**

Fragment 1

Fragment 3

gibi hata:

AIS FRAGMENT ERROR

Missing fragment 2

olarak gösterilmelidir.

---

## **AIS 6-bit payload decoder**

Processing:

AIVDM Payload

↓

ASCII armoring removal

↓

6-bit values

↓

Bit Stream

↓

AIS Message Fields

Toolkit intermediate görünümü sağlamalıdır:

Payload Character:

X

Encoded:

...

6-bit:

101011

ve bütün payload:

Bit Offset

Length

Raw

Decoded

formatında gösterilmelidir.

Exact bit-field table güncel ITU-R M.1371 revision ve kullanılan AIS message type database'ına bağlı tutulmalıdır.

---

## **AIS message type**

Belgenin mevcut hedefleri arasında:

Position Report Class A

Static and Voyage Data

Class B Position Report

Base Station Report

Safety Related Message

bulunuyor.

Decoder:

Message Type:

...

MMSI:

...

Navigation Status:

...

Position:

...

COG:

...

SOG:

...

Heading:

...

göstermelidir.

Tam AIS message type/field database, **M.1371-6** revision'ına bağlı tutulmalıdır.

---

## **AIS Target Table**

Toolkit canlı AIS capture'dan:

MMSI        Name        Lat       Lon       SOG    COG

\---------   \--------    \-------   \-------   \-----  \-----

...         ...         ...       ...       ...    ...

oluşturmalıdır.

Her target:

Last Position Update

Last Static Data

Message Type

Class

Channel

Age

bilgisine sahip olmalıdır.

### **Stale target**

Last AIS report:

180 s ago

ise:

STALE TARGET

gösterilebilir.

---

# **GPS NMEA Mesajları**

Bu bölüm NMEA 0183 decoder'ın GNSS navigation odaklı özel görünümü olmalıdır.

NMEA 0183 parser yeniden yazılmamalı; aynı parser'ın üzerine **GNSS semantic layer** kurulmalıdır.

Temel sentence grupları:

GGA

RMC

GSA

GSV

VTG

GLL

ZDA

Belgenin mevcut NMEA bölümü bunları desteklenecek sentence'lar arasında zaten listeliyor.

## **GNSS dashboard**

Position

Latitude:

...

Longitude:

...

Altitude:

...

Fix:

...

Satellites:

...

HDOP:

...

UTC:

...

COG:

...

SOG:

...

### **Sentence correlation**

Örneğin aynı epoch için:

GGA

RMC

GSA

GSV

message'ları:

GNSS Epoch 12:35:19

altında gruplanabilir.

### **Cross-check**

Toolkit örneğin:

RMC Position

vs

GGA Position

karşılaştırması yapmalıdır.

Difference:

0.4 m

gibi.

### **Invalid fix**

GNSS fix invalid ise fiziksel position değeri mevcut olsa dahi:

POSITION INVALID

durumu korunmalıdır.

Raw value ile validity ayrılmalıdır:

Latitude:

40.XXXX

Validity:

INVALID

---

# **GNSS UBX**

UBX, u-blox GNSS receivers tarafından kullanılan binary protocol ailesidir. Modern u-blox cihazlarında UART, USB, SPI ve bazı serilerde I²C gibi interfaces üzerinden GNSS data alınabilir; u-blox'un güncel ürünleri halen UBX tabanlı düşük seviye communication desteğini kullanmaktadır.

UBX temel parser 3.2 bölümündeki ortak binary parser ile paylaşılmalıdır.

Conceptual frame:

SYNC

CLASS

ID

LENGTH

PAYLOAD

CHECKSUM

### **Marine GNSS görünümü**

Toolkit raw UBX frame'i yalnız class/ID seviyesinde bırakmamalıdır.

Örneğin navigation solution message:

UBX

↓

Navigation Solution

↓

Position

Velocity

Heading

Fix

Accuracy

Time

alanlarını ortak NavigationData modeline dönüştürmelidir.

u-center 2'nin güncel dokümantasyonunda UBX-NAV-PVT'nin receiver position information kaynağı olarak kullanılabildiği belirtilmektedir.

### **UBX \+ NMEA simultaneous stream**

Aynı UART üzerinde:

B5 62 ...

$GNGGA,...

$GNRMC,...

B5 62 ...

gibi mixed stream görülebilir.

Toolkit auto-detector:

B5 62 → UBX candidate

$     → NMEA candidate

çalıştırmalıdır.

### **Common value comparison**

UBX Position:

...

NMEA Position:

...

Difference:

0.08 m

gibi validation görünümü özellikle entegrasyon testlerinde yararlı olur.

---

# **RTCM Düzeltme Mesajları**

RTCM GNSS correction data'nın standardize edilmiş taşıma formatlarından biridir. RTCM'nin yayımlanmış Version 3 standard ailesindeki güncel standard listesinde RTCM 10403.4 yer almaktadır.

RTCM artık yalnız maritime applications değil:

Marine navigation

Surveying

Precision agriculture

Robotics

UAV

Autonomous systems

gibi high-precision GNSS uygulamalarında da kullanılmaktadır.

### **RTCM stream parser**

Pipeline:

Raw Stream

↓

Preamble Detection

↓

Length

↓

Payload

↓

Message Number

↓

CRC

↓

GNSS Correction Fields

Toolkit:

Message Type

Length

Station

GNSS

Epoch

Satellite Count

Signal Type

CRC

gibi metadata göstermelidir.

Exact field database seçilen RTCM standard revision'ına bağlı tutulmalıdır.

### **RTCM categories**

Decoder:

Reference Station

GPS

GLONASS

Galileo

BeiDou

MSM

SSR

Antenna

Station Information

gibi kategori görünümü sağlayabilir.

### **Correction stream statistics**

Message        Rate       Last

107x           1 Hz       100 ms

108x           1 Hz       120 ms

109x           1 Hz       80 ms

...

Exact message-number interpretation licensed/current RTCM database'dan alınmalıdır.

### **Age of correction**

Toolkit mümkünse:

Correction Age

Epoch Age

Last RTCM Frame

göstermelidir.

Correction stream durduğunda:

RTCM STREAM LOST

alarmı üretilebilir.

---

# **NTRIP ile RTCM İlişkisi**

NTRIP, RTCM correction data'yı IP üzerinden stream etmek için yaygın kullanılan transport protocol'dür. u-blox güncel açıklamasına göre NTRIP HTTP tabanlı transport, RTCM ise correction message data formatıdır.

Bu nedenle:

NTRIP ≠ RTCM

Doğrusu:

NTRIP

  ↓

RTCM Stream

  ↓

GNSS Receiver

Toolkit NTRIP capture verilirse:

Caster

Mount Point

Connection

HTTP Status

RTCM Message Rate

Bytes/s

Reconnect

gibi network metadata da gösterebilir.

---

# **J1939 Tabanlı Deniz Mesajları**

Bazı marine propulsion, generator, engine ve machinery control sistemleri SAE J1939 tabanlı haberleşme kullanabilir.

Burada J1939 decoder yeniden yazılmamalıdır.

Ortak katman:

CAN

↓

J1939

↓

PGN

↓

SPN

↓

Marine Engine / Machinery Value

kullanılmalıdır.

SAE J1939 application data artık J1939DA database ve çeşitli application-layer dokümanlarına ayrılmış durumdadır; toolkit specific marine PGN/SPN anlamlarını yalnız uygun lisanslı/current database varsa semantic olarak isimlendirmelidir.

### **Engine dashboard**

J1939 database mevcutsa:

Engine

├─ Speed

├─ Coolant Temperature

├─ Oil Pressure

├─ Load

├─ Fuel Rate

└─ Diagnostic Status

gibi görünüm oluşturulabilir.

### **Multi-engine**

Deniz araçlarında:

Port Engine

Starboard Engine

Generator 1

Generator 2

gibi birden fazla source olabilir.

Toolkit source address \+ device identity üzerinden:

SA 0x00 → Port Engine

SA 0x01 → Starboard Engine

mapping tanımlamaya izin vermelidir.

### **NMEA 2000 vs J1939**

Bu ayrım özellikle net olmalıdır.

NMEA 2000

CAN based marine network

PGN model

SAE J1939

CAN based vehicle/machinery network

PGN/SPN model

Benzer identifier yapıları kullanmaları aynı protocol oldukları anlamına gelmez.

Toolkit aynı CAN capture'da candidate detection yapmalı fakat:

29-bit CAN frame

görüldüğü için otomatik olarak NMEA 2000 veya J1939 diye kesin karar vermemelidir.

Confidence:

J1939 Database Match:

92 %

NMEA 2000 Match:

12 %

gibi gösterilebilir.

---

# **SeaTalk için Temel Veri Çözümleme**

SeaTalk 1, Raymarine'in eski/original marine networking sistemidir. Raymarine'in güncel ürün açıklamasına göre SeaTalk 1 üç telli network üzerinden **bidirectional data ve 12 V DC power** taşır; instrument, autopilot controller ve navigation component'lerini bağlamak için kullanılır. Daisy-chain veya star biçimlerinde kurulabilir.

Toolkit'te ilk sürüm **temel log/frame çözümleme** seviyesinde tutulmalıdır.

### **SeaTalk 1 conceptual layer**

SeaTalk 1 Bus

↓

Raw Byte / Word Stream

↓

Command / Message Identification

↓

Payload

↓

Navigation Value

### **Supported semantic groups**

Database mevcutsa:

Depth

Speed

Wind

Heading

Rudder

Autopilot

Navigation

Waypoint

GPS

Instrument control

gibi kategoriler desteklenebilir.

Raymarine SeaTalk1-to-SeaTalkNG converter firmware dokümantasyonu Speed, Depth, Wind, Heading, GPS, rudder ve autopilot gibi bilgilerin iki network arasında bridge edildiğini doğrular.

### **SeaTalk gateway view**

Özellikle:

SeaTalk1

↓

SeaTalk1 → SeaTalkNG Converter

↓

SeaTalkNG / NMEA 2000 style network

traffic mapping görünümü yararlı olur.

Örneğin:

SeaTalk1:

Heading

Converted:

NMEA 2000 Heading message

### **Duplicate source**

Converter kullanan sistemlerde aynı physical data birden fazla kaynaktan gelebilir.

Toolkit:

Heading Source 1:

SeaTalk1 → Converter

Heading Source 2:

Native network sensor

algılayarak duplicate source warning üretebilir.

### **Proprietary limitation**

SeaTalk 1 tamamen açık bir NMEA standardı değildir. Exact message database vendor documentation veya kullanıcının sağladığı validated mapping üzerinden yüklenmelidir.

---

# **Modbus Tabanlı Deniz Ekipmanı Mesajları**

Bazı marine auxiliary systems, machinery monitoring, tank systems, power systems, battery chargers, generators, propulsion auxiliaries ve alarm systems Modbus RTU veya Modbus TCP kullanabilir.

Modbus standardı application-layer protocol'dür ve RS-232, RS-485 veya Ethernet/TCP gibi farklı lower-layer networks üzerinde çalışabilir. Modbus Organization güncel application protocol olarak V1.1b3'ü, yeni serial implementations için Serial Line Guide V1.02'yi listeler.

Marine tarafında ayrı bir “Marine Modbus Protocol” varsayılmamalıdır.

Doğru model:

Vendor Register Map

        ↓

Modbus

        ↓

RS-485 / Ethernet

şeklindedir.

### **Example**

Device:

Battery Charger

Slave Address:

3

Register:

40001

Raw:

0x09C4

Vendor documentation:

Scale:

0.01

Unit:

V

ise:

\[  
Value=2500\\times0.01  
\]

\[  
Value=25.00V  
\]

Toolkit:

Register:

40001

Raw:

2500

Physical:

25.00 V

Meaning:

Battery Voltage

göstermelidir.

### **Vendor register map import**

Register

Name

Function

Type

Byte Order

Scale

Offset

Unit

Access

Min

Max

CSV/JSON üzerinden import edilebilmelidir.

### **Marine dashboard**

Örneğin generator controller:

Generator

├─ RPM

├─ Coolant Temp

├─ Oil Pressure

├─ Frequency

├─ Voltage

├─ Current

├─ Power

└─ Alarm

Modbus register'lardan oluşturulabilmelidir.

### **Poll cycle**

Read Holding 40001–40010

↓

50 ms

↓

Read Input 30001–30008

↓

50 ms

↓

Repeat

Toolkit:

Poll Period

Response Time

Timeout

Exception

Retry

Bus Utilization

göstermelidir.

---

# **HDLC Tabanlı Özel Deniz Cihazı Haberleşmeleri**

Bazı eski veya vendor-specific maritime equipment'ler HDLC veya HDLC-benzeri bit/frame yapıları kullanabilir.

Burada toolkit exact vendor protocol bilmeden HDLC frame'i yanlış isimlendirmemelidir.

Layer:

Physical Interface

↓

HDLC / HDLC-like Framing

↓

Vendor Header

↓

Vendor Command

↓

Vendor Payload

### **Generic HDLC structure**

FLAG

ADDRESS

CONTROL

INFORMATION

FCS

FLAG

Flag:

0x7E

Bit stream:

01111110

### **Bit stuffing**

Payload içinde flag pattern oluşmasını önlemek için HDLC family protocol'lerde bit stuffing uygulanabilir.

Toolkit:

Raw Captured Bits

↓

Flag Detection

↓

Bit Destuff

↓

Frame Bytes

↓

FCS

işlem zincirini göstermelidir.

### **Unknown marine HDLC protocol**

Örneğin capture:

7E 12 03 18 04 20 10 33 88 XX XX 7E

Toolkit:

Flag:

Valid

Address:

0x12 candidate

Control:

0x03 candidate

Payload:

18 04 20 10 33 88

FCS:

Candidate CRC-16

gibi conservative interpretation vermelidir.

Vendor schema yüklendiğinde:

Address:

Gyro 1

Command:

Heading Report

Heading:

123.45°

gibi semantic görünüm üretilebilir.

### **HDLC reverse engineering**

Toolkit Unknown Protocol Analyzer ile entegre çalışmalıdır:

Fixed bytes

Changing bytes

Counter

Possible checksum

Possible CRC

Periodic fields

Correlation with known sensor value

Örneğin gyro fiziksel olarak:

Heading:

90°

iken payload:

23 28

ve heading 100° olduğunda:

27 10

görülüyorsa numeric correlation yapılabilir.

---

# **Ortak Marine Navigation Dashboard**

Bütün protokol parser'ları aynı navigation state modeline veri gönderebilmelidir.

Örneğin:

VESSEL NAVIGATION

Position

Lat: ...

Lon: ...

Heading

True: 123.4°

Magnetic: 118.2°

COG:

121.7°

SOG:

12.4 kn

STW:

11.8 kn

ROT:

\+2.1 °/min

Depth:

34.2 m

Wind

AWA: ...

AWS: ...

TWA: ...

TWS: ...

GNSS:

Fix ...

Satellites ...

HDOP ...

AIS Targets:

27

---

# **Heading / COG Ayrımı**

Toolkit heading ve course over ground değerlerini kesinlikle aynı şey olarak göstermemelidir.

Heading

\=

Vessel bow direction

COG

\=

Actual ground-track direction

NMEA'nın teknik açıklaması da heading ile COG'un farklı fiziksel büyüklükler olduğunu özellikle belirtir.

Örneğin:

Heading:

090°

COG:

105°

gemi doğuya bakarken akıntı/rüzgâr nedeniyle güneydoğu yönünde ilerliyor olabilir.

Toolkit:

Heading-COG Difference:

15°

hesabı sunmalıdır.

---

# **True / Magnetic Heading**

Toolkit:

True Heading

Magnetic Heading

Variation

Deviation if available

değerlerini ayrı tutmalıdır.

Asla:

Heading \= 120°

şeklinde reference bilinmeden tek değer göstermemelidir.

UI:

Heading:

120.4 °T

Magnetic:

115.8 °M

gibi suffix kullanabilir.

---

# **Speed Source Ayrımı**

SOG

Speed Over Ground

STW

Speed Through Water

ayrı physical values olarak tutulmalıdır.

Örnek:

SOG:

12.5 kn

STW:

10.8 kn

Difference:

1.7 kn

bu fark current/tide etkisini gösterebilir fakat toolkit bunu doğrudan “current \= 1.7 kn” diye yorumlamamalıdır; yönsel vektör bilgisi gerekir.

---

# **Apparent / True Wind**

Wind data:

Apparent Wind Angle

Apparent Wind Speed

True Wind Angle

True Wind Speed

ayrılmalıdır.

Source field yanlış interpretation özellikle gateway sistemlerinde sorun oluşturabilir. Raymarine'in 2024 SeaTalk converter firmware notlarında Apparent ve True Wind ayrımında yapılan bir düzeltme bunun gerçek entegrasyon problemi olduğuna örnektir.

Toolkit:

Wind Type:

Apparent / True / Unknown

alanını explicit tutmalıdır.

---

# **Depth Data**

Depth:

Below Transducer

Below Surface

Below Keel

reference farklılıkları nedeniyle yalnız sayı olarak tutulmamalıdır.

Toolkit:

Depth:

14.7 m

Reference:

Below Transducer

Offset:

...

gibi metadata taşımalıdır.

---

# **Multi-Protocol Gateway Analyzer**

Deniz elektroniklerinde gateway kullanımı çok yaygındır.

Örnek:

NMEA 0183

     ↓

 Gateway

     ↓

NMEA 2000

veya:

SeaTalk1

↓

SeaTalkNG

↓

NMEA 2000

Toolkit conversion correlation yapmalıdır:

Input:

HDT

123.4°

Output:

NMEA 2000 Heading

123.4°

Latency:

8.2 ms

### **Value mismatch**

Input:

12.4 kn

Output:

12.3 kn

Difference:

0.1 kn

### **Missing conversion**

Input sentence detected:

X

Expected output PGN:

Not observed

gibi integration warning üretilebilir.

---

# **Source Priority / Data Selection Analyzer**

Bir bridge system'de aynı data'nın birden fazla kaynağı olabilir.

Örneğin heading:

Gyro 1

GNSS Compass

Autopilot Sensor

Gateway

Toolkit:

Source               Value      Rate       Age

Gyro 1               122.4°     10 Hz      12 ms

GNSS Compass         122.6°      5 Hz      60 ms

Autopilot            122.4°     10 Hz      18 ms

göstermelidir.

### **Conflict**

Gyro 1:

122°

GNSS:

168°

ise:

SOURCE DISAGREEMENT

Difference:

46°

alarmı oluşturulabilir.

---

# **Navigation Data Freshness**

Her signal için `age` hesaplanmalıdır:

\[  
Age=t\_{now}-t\_{lastUpdate}  
\]

Örneğin:

Heading:

Age 20 ms

Fresh

Position:

Age 1.2 s

Fresh

Depth:

Age 14.3 s

STALE

Wind:

Never received

MISSING

Threshold protocol/message type bazında ayarlanabilmelidir.

---

# **Rate / Period Analyzer**

Her marine message:

Expected Rate

Observed Rate

Mean Period

Minimum

Maximum

Jitter

Missing Count

değerine sahip olmalıdır.

Örneğin:

Heading

Expected:

10 Hz

Observed:

9.98 Hz

Average Period:

100.2 ms

Jitter:

±2.4 ms

---

# **Unit Normalization**

Denizcilik protokollerinde aynı büyüklük farklı units ile gelebilir.

Toolkit internal canonical unit kullanmalı, UI unit dönüşümü yapabilmelidir.

Örneğin speed:

\[  
1\\ knot=1.852\\ km/h  
\]

ve:

\[  
1\\ knot\\approx0.514444\\ m/s  
\]

Input:

12.0 kn

UI:

12.0 kn

22.224 km/h

6.173 m/s

gösterebilmelidir.

Angle:

degrees

radians

distance:

m

km

NM

depth:

m

ft

seçenekleri bulunmalıdır.

---

# **Time Synchronization View**

Navigation systems birçok farklı timestamp kaynağı kullanabilir:

GNSS UTC

Message timestamp

Capture timestamp

Device local time

Host time

AIS report time

Toolkit bunları karıştırmamalıdır.

Her value:

Value Time:

12:35:19.000 UTC

Received:

12:35:19.042

Host Capture:

12:35:19.043

gibi gösterilebilir.

Latency:

\[  
Latency=t\_{capture}-t\_{measurement}  
\]

hesaplanabilir.

---

# **Position Difference Analyzer**

İki position source karşılaştırılabilmelidir.

Basit küçük-mesafe yaklaşımı yerine toolkit tercihen geodesic distance hesabı kullanmalıdır.

Input:

GNSS 1:

lat1, lon1

GNSS 2:

lat2, lon2

Output:

Horizontal Separation:

1.82 m

Bearing:

243°

Bu özellik dual-GNSS ve redundant bridge systems için faydalıdır.

---

# **Marine Message Correlation**

Örneğin vessel turning event:

12:00:00

Heading begins changing

12:00:00

ROT becomes positive

12:00:01

COG changes

12:00:02

AIS position report reflects new course

Toolkit bu değişimleri multi-signal timeline üzerinde gösterebilmelidir.

---

# **Ortak Denizcilik Hata Modeli**

Aşağıdaki hata sınıfları desteklenmelidir:

CHECKSUM\_ERROR

CRC\_ERROR

INVALID\_SENTENCE

UNKNOWN\_TALKER

UNKNOWN\_FORMATTER

INVALID\_COORDINATE

INVALID\_FIX

MISSING\_FIELD

FIELD\_OUT\_OF\_RANGE

STALE\_DATA

MESSAGE\_TIMEOUT

UNEXPECTED\_PERIOD

FRAGMENT\_MISSING

FAST\_PACKET\_ERROR

SOURCE\_ADDRESS\_CONFLICT

DEVICE\_DISAPPEARED

PGN\_UNKNOWN

AIS\_FRAGMENT\_ERROR

AIS\_TARGET\_STALE

RTCM\_STREAM\_LOST

GNSS\_FIX\_LOST

DUPLICATE\_SOURCE

SOURCE\_DISAGREEMENT

GATEWAY\_CONVERSION\_MISSING

GATEWAY\_VALUE\_MISMATCH

Her hata:

Timestamp

Protocol

Source

Message

Field

Severity

Expected

Received

Possible Cause

bilgisine sahip olmalıdır.

---

# **Ortak Marine Layer Drill-Down**

Kullanıcı bir navigation value'ya tıklayınca değer kaynağına kadar inebilmelidir.

Örneğin:

Heading

123.4° True

    ↓

NMEA 0183 HDT

    ↓

Field 1

    ↓

"123.4"

    ↓

ASCII

31 32 33 2E 34

    ↓

Serial Stream

NMEA 2000 için:

Engine RPM

1500 rpm

    ↓

PGN

    ↓

Signal Field

    ↓

Raw bytes

    ↓

CAN Frame

    ↓

29-bit Identifier

AIS için:

Ship Position

    ↓

AIS Message

    ↓

6-bit Payload

    ↓

AIVDM Fragment(s)

    ↓

NMEA 0183 Transport

RTCM için:

GNSS Correction

    ↓

RTCM Message

    ↓

Correction Stream

    ↓

NTRIP Connection

Bu yapı sayesinde denizcilik bölümü yalnız **NMEA terminali** olmamalıdır. Amaç; **GNSS sensöründen gyro ve AIS'e, serial NMEA 0183'ten CAN tabanlı NMEA 2000'e, RTCM correction stream'den engine J1939 ağına ve gateway dönüşümlerine kadar gemideki navigasyon/haberleşme verisinin nereden geldiğini, nasıl taşındığını ve hangi fiziksel değere dönüştüğünü tek platformda analiz edebilmek** olmalıdır.

## **3.6 Havacılık ve insansız sistem protokolleri**

* MAVLink 1  
* MAVLink 2  
* UAVCAN  
* Cyphal  
* DroneCAN  
* SBUS  
* IBUS  
* CRSF  
* PPM  
* PWM servo frame analizleri  
* ARINC 429 için temel word decoder  
* MIL-STD-1553 için log tabanlı temel frame decoder  
* ADS-B  
* Mode-S  
* GPS UBX  
* RTCM  
* NMEA

Havacılık ve insansız sistem haberleşme bölümü yalnızca uçuş kontrolcüsünden gelen telemetri paketlerini listeleyen bir terminal olmamalıdır. Platform; uçuş kontrolcüleri, görev bilgisayarları, GNSS alıcıları, ESC'ler, servo sistemleri, payload controller'ları, gimbal sistemleri, hava veri bilgisayarları, avionics bus'ları, RC receiver'lar, ground control station'lar ve surveillance sistemleri arasındaki haberleşmeyi farklı seviyelerde analiz edebilmelidir.

Bu bölümde mümkün olduğunca şu ortak görünümler bulunmalıdır:

* Raw Frame  
* HEX View  
* Binary / Bit View  
* Message Tree  
* Source / Destination  
* System ID  
* Component ID  
* Node ID  
* Message ID  
* Subject / Service  
* Sequence / Transfer ID  
* Timestamp  
* CRC / Checksum  
* Signature  
* Packet Loss  
* Frame Rate  
* Message Rate  
* Latency  
* Jitter  
* Link Quality  
* RSSI  
* SNR  
* RC Channel Values  
* Failsafe  
* GNSS Fix  
* Position  
* Attitude  
* Velocity  
* Acceleration  
* Angular Rate  
* Battery  
* ESC / Motor  
* Airspeed  
* Altitude  
* Navigation  
* Vehicle State  
* Flight Mode  
* Command / ACK  
* Parameter  
* Mission  
* Diagnostic  
* Multi-frame Reassembly  
* Signal Timeout  
* Stale Data  
* Source Comparison  
* Protocol Auto-Detection

Ortak sistem görünümü şu yapıyı desteklemelidir:

Ground Control Station

        │

        │ MAVLink

        ▼

Flight Controller

        │

        ├──── DroneCAN / Cyphal ──── GNSS

        │

        ├──── DroneCAN / Cyphal ──── ESC

        │

        ├──── UART / UBX ─────────── GNSS

        │

        ├──── SBUS / CRSF / IBUS ─── RC Receiver

        │

        ├──── PWM ────────────────── Servo

        │

        └──── Payload Link ───────── Camera / Gimbal

Daha büyük avionics sistemlerinde:

Mission Computer

      │

      ├── ARINC 429

      ├── MIL-STD-1553

      ├── Ethernet

      ├── CAN

      └── Serial

gibi farklı bus'lar aynı timeline üzerinde incelenebilmelidir.

---

# **MAVLink 1**

MAVLink, insansız hava araçları ve diğer robotik sistemlerde vehicle–ground station ve component–component communication için kullanılan hafif bir binary messaging protocol'dür. MAVLink'in resmi dokümantasyonu MAVLink 1 ve MAVLink 2 wire formatlarını ayrı tanımlar; MAVLink 2 yeni sistemler için önerilen sürümdür fakat MAVLink 1 compatibility halen önemlidir.

MAVLink 1 paket yapısı:

STX

│

├─ Payload Length

├─ Sequence

├─ System ID

├─ Component ID

├─ Message ID

├─ Payload

└─ Checksum

MAVLink 1 başlangıç byte'ı:

0xFE

olarak tanımlanmıştır. Message ID 8 bittir ve payload maksimum 255 byte olabilir.

Byte görünümü:

Offset

0       STX

1       LEN

2       SEQ

3       SYSID

4       COMPID

5       MSGID

6..     PAYLOAD

...     CRC LOW

...     CRC HIGH

Toolkit frame'i şu şekilde renklendirebilmelidir:

FE | 09 | 2A | 01 | 01 | 00 | PAYLOAD... | CRC

──   ──   ──   ──   ──   ──   ──────────   ───

STX  LEN  SEQ  SYS  CMP  MSG       DATA       CRC

## **Sequence**

Sequence field her sender component tarafından gönderilen paketlerde artar ve packet loss tahmini için kullanılabilir. MAVLink'in resmi packet formatında `seq` 8-bit bir counter olarak tanımlanır.

Belgedeki mevcut paket kaybı mantığı genişletilerek:

\[  
\\Delta \=  
(CurrentSequence-PreviousSequence)\\bmod256  
\]

\[  
Lost=  
\\begin{cases}  
\\Delta-1,& \\Delta\>1\\  
0,& \\Delta\\le1  
\\end{cases}  
\]

kullanılabilir.

Örnek:

Previous:

41

Current:

45

Delta:

4

Estimated Lost Packets:

3

Ancak sequence takibi:

System ID

\+

Component ID

\+

Link

bazında yapılmalıdır.

Farklı component'ların sequence counter'ları birbirine karıştırılmamalıdır.

## **System ID ve Component ID**

MAVLink network içinde:

System ID

bir vehicle/system'i,

Component ID

ise o sistem içindeki autopilot, camera, gimbal vb. component'i ayırmak için kullanılır. MAVLink resmi serialization tanımı kaynak `sysid` ve `compid` alanlarını bu amaçla tanımlar.

Toolkit:

System 1

├─ Autopilot

├─ Camera

├─ Gimbal

└─ Companion Computer

System 2

└─ Autopilot

gibi component tree oluşturabilmelidir.

---

# **MAVLink 2**

MAVLink 2, MAVLink 1 frame yapısını genişletir.

Wire frame:

STX

LEN

INCOMPAT\_FLAGS

COMPAT\_FLAGS

SEQ

SYSID

COMPID

MSGID \[24 bit\]

PAYLOAD

CHECKSUM

OPTIONAL SIGNATURE

MAVLink 2 başlangıç marker'ı:

0xFD

ve Message ID alanı 24 bittir. Paket ayrıca compatibility/incompatibility flags ve opsiyonel 13-byte signature alanına sahiptir.

Görsel:

FD | LEN | IF | CF | SEQ | SYS | CMP | MSG ID | PAYLOAD | CRC | SIGN

## **MAVLink 1 / MAVLink 2 karşılaştırması**

MAVLink 1

STX       0xFE

MSG ID    8 bit

Signing   Yok

Flags     Yok

MAVLink 2

STX       0xFD

MSG ID    24 bit

Signing   Desteklenir

Flags     Var

Extensions Var

MAVLink resmi dokümantasyonu mümkün olduğunda MAVLink 2 kullanılmasını önerir.

---

## **MAVLink CRC**

MAVLink packet integrity için CRC-16/MCRF4XX kullanır. CRC hesabı `magic` başlangıç byte'ını ve optional signature'ı kapsamaz; message-specific `CRC_EXTRA` da checksum hesabına dahil edilir.

Toolkit:

Received CRC:

0xABCD

Calculated CRC:

0xABCD

CRC\_EXTRA:

...

Result:

PASS

göstermelidir.

### **CRC\_EXTRA**

CRC\_EXTRA yalnız transmission corruption kontrolü değildir. Sender ve receiver'ın aynı message definition'a sahip olup olmadığını doğrulamaya da yardımcı olur.

Toolkit hata mesajı:

CRC FAILED

Possible causes:

• corrupted packet

• wrong dialect

• wrong message definition

• wrong CRC\_EXTRA

• incorrect serialization

gibi olmalıdır.

---

## **MAVLink Payload Serialization**

MAVLink payload içerisindeki multi-byte değerler little-endian olarak serialize edilir. Ayrıca wire field order XML declaration order ile her zaman aynı değildir; MAVLink generator alanları native type size'a göre reorder eder. MAVLink 2 extension fields ise base fields'dan sonra wire üzerinde yer alır.

Bu nedenle toolkit custom MAVLink XML import ettiğinde **XML declaration order'a doğrudan byte offset vermemelidir**.

Pipeline:

MAVLink XML

↓

Field Ordering Rules

↓

Wire Layout

↓

CRC\_EXTRA

↓

Parser

olmalıdır.

---

## **MAVLink 2 Payload Truncation**

MAVLink 2 trailing zero-filled payload bytes'larını wire üzerinde göndermeyebilir. Receiver buna rağmen message definition'a göre eksik trailing bytes'ları zero olarak yorumlayabilmelidir.

Toolkit:

Defined Payload Size:

36 bytes

Wire Payload:

28 bytes

Trailing Zero Truncation:

8 bytes

Status:

Valid MAVLink 2

gösterebilmelidir.

---

## **MAVLink Signing**

MAVLink 2 optional message signing sağlar. Signing authentication sağlar; MAVLink'in kendisi encryption sağlamaz.

Signed frame'de incompatibility flag içindeki ilgili bit set edilir ve frame sonuna 13 byte signature bilgisi eklenir. Signature alanında link ID, timestamp ve truncated cryptographic signature bilgileri bulunur.

Toolkit:

Signed:

YES

Link ID:

2

Timestamp:

...

Signature:

...

Verification:

PASS

veya:

SIGNATURE INVALID

göstermelidir.

Anahtar kullanıcı tarafından verilmediyse:

Signature present

Verification unavailable

olarak gösterilmelidir.

Secret key hiçbir zaman dış servise gönderilmemelidir.

---

# **MAVLink Message Decoder**

Belgede desteklenmesi istenen temel mesajlar:

HEARTBEAT

SYS\_STATUS

GPS\_RAW\_INT

ATTITUDE

GLOBAL\_POSITION\_INT

LOCAL\_POSITION\_NED

VFR\_HUD

BATTERY\_STATUS

COMMAND\_LONG

COMMAND\_ACK

PARAM\_VALUE

HIGHRES\_IMU

şeklindedir.

Bu message'lar ortak MAVLink XML definitions üzerinden decode edilmelidir; hard-coded field offset kullanmak yerine official dialect definition yüklenmelidir.

## **HEARTBEAT**

Vehicle presence ve temel state takibi için kullanılmalıdır.

Toolkit:

System:

1

Component:

Autopilot

Message:

HEARTBEAT

Vehicle Type:

...

Autopilot:

...

Base Mode:

...

Custom Mode:

...

System Status:

...

göstermelidir.

Heartbeat üzerinden node presence:

ONLINE

DEGRADED

OFFLINE

takibi yapılabilir.

## **ATTITUDE**

Roll

Pitch

Yaw

Roll Rate

Pitch Rate

Yaw Rate

grafikleri oluşturulmalıdır.

Angles:

rad

deg

arasında çevrilebilmelidir.

## **GLOBAL\_POSITION\_INT**

Latitude

Longitude

Altitude

Relative Altitude

Velocity North

Velocity East

Velocity Down

Heading

gibi alanlar common NavigationData modeline aktarılmalıdır.

## **GPS\_RAW\_INT**

Fix Type

Latitude

Longitude

Altitude

HDOP-like uncertainty data

Velocity

Course

Satellite Count

gibi GNSS bilgileri navigation dashboard'a aktarılmalıdır.

## **BATTERY\_STATUS**

Voltage

Current

Remaining

Temperature

Cell data where available

gibi telemetry alanları trend olarak gösterilmelidir.

---

# **MAVLink Command Transaction**

MAVLink'te command ve acknowledgement mesajları birbirine bağlanmalıdır.

Örnek:

GCS

 │

 ├─ COMMAND\_LONG

 │      command \= ...

 │

 ▼

Vehicle

 │

 └─ COMMAND\_ACK

Toolkit:

Command:

...

Target System:

1

Target Component:

1

Sent:

12:30:10.100

ACK:

12:30:10.124

Result:

Accepted

Response Time:

24 ms

göstermelidir.

Timeout:

COMMAND TIMEOUT

retry:

Attempt 1

Attempt 2

ACK

olarak gruplanmalıdır.

---

# **MAVLink Parameter Analyzer**

Parameter traffic:

Parameter Request

↓

PARAM\_VALUE

veya ilgili MAVLink 2 parameter microservice mesajları ile takip edilebilir.

Toolkit:

Parameter

Value

Type

Index

Count

Timestamp

Changed

göstermelidir.

Örneğin:

Parameter:

RTL\_ALT

Previous:

1500

Current:

2000

Change:

\+500

---

# **MAVLink Message Rate**

Her message ID için:

Message

Rate

Period

Jitter

Count

Lost Estimate

Last Seen

Age

gösterilmelidir.

Örnek:

ATTITUDE

Configured / observed:

50 Hz

Average:

49.8 Hz

Jitter:

±1.2 ms

---

# **MAVLink Link Analyzer**

Aynı vehicle birden fazla MAVLink link üzerinden erişilebilir:

Telemetry Radio

USB

UDP

TCP

Wi-Fi

Serial

Toolkit source-link metadata tutmalıdır.

Link 1:

Telemetry Radio

Packet Rate:

...

Packet Loss:

...

Latency:

...

Link 2:

Wi-Fi

Packet Rate:

...

MAVLink 2 signing'deki link ID de multi-link architecture ile ilişkilidir.

---

# **UAVCAN**

Bu başlık isimlendirme açısından özellikle dikkatli ele alınmalıdır.

Tarihsel olarak:

UAVCAN v0

olarak bilinen protocol bugün **DroneCAN** adı altında sürdürülmektedir.

Buna karşılık UAVCAN v1 geliştirme hattı daha sonra **Cyphal** adıyla devam etmiştir. OpenCyphal'ın güncel geliştirme belgelerinde de `UAVCAN v0 aka DroneCAN` ifadesi kullanılır.

Bu nedenle toolkit'te:

UAVCAN

tek parser adı olmamalıdır.

Protocol selector:

UAVCAN v0 / DroneCAN

Cyphal v1.x

şeklinde açık ayrım yapmalıdır.

Auto-detection sonucunda:

Legacy UAVCAN / DroneCAN candidate

veya:

Cyphal/CAN candidate

gösterilmelidir.

---

# **DroneCAN**

DroneCAN, UAVCAN v0 tabanlı ve özellikle UAV/robotics distributed embedded networks için kullanılan CAN-based communication protocol'dür. Tasarım hedefleri arasında masterless network, large transfer segmentation/reassembly, redundant interface desteği, low latency ve embedded node'larda düşük computational overhead bulunur.

DroneCAN yalnız “CAN message database” değildir.

Katman:

Application Data

↓

DSDL

↓

DroneCAN Transfer

↓

CAN Frame(s)

↓

CAN 2.0B

DroneCAN CAN transport yalnız 29-bit CAN identifiers kullanır.

---

## **DroneCAN Transfer Types**

Üç temel transfer türü:

Message

Service Request

Service Response

Message:

broadcast

service:

client ↔ server

mantığındadır.

Toolkit:

Transfer Type:

Message Broadcast

veya:

Service:

GetNodeInfo

Client:

Node 10

Server:

Node 42

Transfer ID:

7

göstermelidir.

---

## **DroneCAN CAN ID**

Broadcast message için 29-bit ID genel olarak:

Priority

Message Type ID

Message/Service indicator

Source Node ID

bilgilerini içerir.

Service transfer için:

Priority

Service Type ID

Request/Response

Destination Node ID

Service indicator

Source Node ID

alanları bulunur. DroneCAN official CAN transport specification exact bit widths'leri tanımlar.

Toolkit ID'yi:

Raw CAN ID:

0x1ABCDEF0

Priority:

...

Transfer:

Message

Data Type ID:

...

Source Node:

...

şeklinde bit alanlarına ayırmalıdır.

---

## **DroneCAN Node ID**

DroneCAN CAN node ID:

1 ... 127

aralığındadır; bazı ID değerleri debugging araçları için ayrılmıştır.

Node explorer:

Node 10

├─ Name

├─ Hardware Version

├─ Software Version

├─ Health

├─ Mode

└─ Uptime

gibi oluşturulmalıdır.

---

## **Tail Byte**

DroneCAN CAN frame data alanının son byte'ı transport-layer metadata taşır.

Tail byte:

Bit 7   Start Of Transfer

Bit 6   End Of Transfer

Bit 5   Toggle

Bit 4:0 Transfer ID

olarak tanımlanır.

Toolkit bit görünümü:

Tail Byte:

0xC5

Binary:

11000101

SOT:

1

EOT:

1

Toggle:

0

Transfer ID:

5

gibi ayrıştırmalıdır.

---

## **Single Frame Transfer**

Single-frame transfer:

SOT \= 1

EOT \= 1

Toggle \= 0

özelliklerine sahiptir.

Toolkit:

Transfer:

Single Frame

Payload:

...

Transfer ID:

...

olarak göstermelidir.

---

## **Multi-Frame Transfer**

Payload tek CAN frame'e sığmıyorsa DroneCAN transfer birden fazla CAN frame'e ayrılır.

Frame 1

SOT=1

Toggle=0

Frame 2

SOT=0

Toggle=1

Frame 3

SOT=0

Toggle=0

Frame 4

EOT=1

Toggle bit her frame'de alternates ve duplication/order hatalarının tespitine yardımcı olur. Multi-frame transfer başına ayrıca transfer CRC kullanılır.

Toolkit:

Transfer ID:

9

Frames:

4

Frame 1:

START

Frame 2:

CONTINUE

Frame 3:

CONTINUE

Frame 4:

END

Toggle Sequence:

0 1 0 1

Transfer CRC:

PASS

göstermelidir.

### **Reassembly error**

Expected Toggle:

1

Received:

0

ise:

TRANSFER ERROR

Unexpected Toggle Bit

gösterilmelidir.

---

## **DroneCAN Transfer ID**

Transfer ID 5 bit'tir:

0 ... 31

ve aynı logical transfer descriptor için artarak wrap eder.

Toolkit:

Previous Transfer ID:

31

Current:

0

Result:

Valid wrap

gösterebilmelidir.

---

## **DroneCAN DSDL**

DroneCAN data structures **DSDL — Data Structure Description Language** ile tanımlanır.

Primitive type'lar arbitrary bit width kullanabilir:

uintX

intX

bool

float16

float32

float64

arrays

nested types

ve alanlar wire üzerinde bit-packed olabilir; implicit byte alignment zorunlu değildir.

Toolkit DSDL import ettiğinde:

Data Type

↓

DSDL Compiler/Parser

↓

Bit Layout

↓

Physical Fields

oluşturmalıdır.

Örnek bit view:

Bit 0..4      status

Bit 5..15     value

Bit 16        valid

...

---

## **DroneCAN Standard Message Categories**

Standard namespace içerisinde:

protocol

equipment

navigation

debug

gibi data-type grupları bulunur.

Toolkit:

Protocol

├─ Node Status

├─ Node Info

├─ Parameters

├─ File

└─ Debug

Equipment

├─ ESC

├─ GNSS

├─ Air Data

...

şeklinde kategorize edebilir.

---

# **Cyphal**

Cyphal, UAVCAN v1 geliştirme hattının devamı olan modern distributed embedded communication protocol'dür.

**Cyphal Specification v1.0 Mayıs 2025'te stable olarak yayımlanmıştır.** 2026 itibarıyla v1.1 üzerinde geliştirme devam etmektedir; v1.1 henüz stable parser default'u olarak ele alınmamalıdır.

Toolkit:

Cyphal v1.0

stable default olmalı;

Cyphal v1.1 Experimental

ancak explicit opt-in ile desteklenmelidir.

---

## **Cyphal Transport Independence**

Cyphal yalnız CAN'e bağlı değildir.

Resmi ekosistem:

Cyphal/CAN

Cyphal/UDP

Cyphal/serial

gibi transport'ları destekler. Cyphal/serial full-duplex byte stream'ler; örneğin TCP connection, RS-232/422, UART ve USB CDC gibi ortamları hedefler.

Toolkit architecture:

Cyphal Presentation

↓

Transfer

↓

Transport Adapter

├─ CAN

├─ UDP

└─ Serial

şeklinde tasarlanmalıdır.

---

## **Subject ve Service**

Cyphal application interaction'ları:

Publish / Subscribe Subjects

ve:

Request / Response Services

üzerinden organize edilir.

Toolkit:

Node 42

├─ Publishes

│  ├─ Heartbeat

│  ├─ Air Data

│  └─ GNSS

├─ Subscribes

│  └─ ESC Command

└─ Services

   ├─ Register Access

   └─ ExecuteCommand

gibi graph oluşturmalıdır.

---

## **Cyphal Heartbeat**

Stable Cyphal data type setinde node heartbeat, node'un temel operational presence ve health bilgisini taşır. Resmi guide her Cyphal node'un heartbeat yayınlamasını temel zorunlu application-level davranış olarak tanımlar.

Toolkit:

Node:

42

Uptime:

...

Health:

Nominal

Mode:

Operational

Last Heartbeat:

120 ms ago

göstermelidir.

Offline detection:

HEARTBEAT TIMEOUT

olarak çalışmalıdır.

---

## **Cyphal DSDL**

Cyphal da DSDL tabanlı typed data model kullanır.

Toolkit DSDL browser:

Namespace

Type

Version

Extent

Fields

Constants

Array Bounds

Serialization

göstermelidir.

Version:

uavcan.node.Heartbeat.1.0

gibi data type versioning semantic olarak korunmalıdır.

---

## **Cyphal Network Graph**

Node 10

Autopilot

Node 20

GNSS

Node 30

ESC 1

Node 31

ESC 2

Node 32

ESC 3

Node 33

ESC 4

Graph edge:

GNSS Position

Node 20

→ Subject ...

→ Node 10

şeklinde gösterilebilir.

---

# **DroneCAN / UAVCAN / Cyphal Ayırıcı**

Toolkit'te kullanıcı açısından en büyük karışıklıklardan biri bu isimler olacaktır.

Bilgi paneli:

UAVCAN v0

    ↓

DroneCAN

UAVCAN v1 development line

    ↓

Cyphal

şeklinde olmalıdır. Güncel OpenCyphal development documentation DroneCAN'i `UAVCAN v0` legacy predecessor olarak tanımlar.

Dolayısıyla:

Protocol: UAVCAN

şeklinde belirsiz project configuration kabul edilmemelidir.

Kullanıcıdan:

DroneCAN / UAVCAN v0

Cyphal v1.0

seçmesi istenmelidir.

---

# **SBUS**

S.BUS Futaba tarafından geliştirilen, bir receiver'ın çok sayıda RC channel bilgisini tek serial data line üzerinden servo/gyro/flight controller gibi cihazlara iletebilmesini sağlayan bus yaklaşımıdır. Futaba'nın resmi açıklamasına göre tüm channel control bilgileri aynı bus üzerinden taşınır ve S.BUS cihazı kendi atanmış channel verisini kullanır.

Flight-controller ekosisteminde kullanılan klasik SBUS serial frame profili için toolkit bir **Legacy SBUS / FC profile** sağlamalıdır. Betaflight'ın güncel SBUS implementation'ı 100000 baud, even parity, iki stop bit, inverted serial input, `0x0F` başlangıç byte'ı ve 25-byte frame yapısını kullanır.

### **UART profile**

Baud:

100000

Data:

8

Parity:

Even

Stop:

2

Signal:

Inverted by default

Toolkit wiring/configuration ekranında:

UART Inversion Required:

YES

Hardware Inverter:

Detected / Unknown

gibi alanlar bulunmalıdır.

---

## **SBUS Frame**

Betaflight'ın current implementation'ında:

Start Byte

22-byte packed channel data

Flags

End Byte

şeklinde toplam 25-byte frame kullanılmaktadır. 16 analog channel 11-bit packed formatta taşınır; flags byte signal-loss ve failsafe bilgilerini içerir.

Görsel:

0F | CHANNEL DATA \[22\] | FLAGS | END

---

## **SBUS Channel Packing**

16 ana channel:

16 × 11 bit

\=

176 bit

\=

22 byte

olarak packed edilir. Betaflight'ın `sbusChannels_t` yapısı da bunu doğrudan tanımlar.

Toolkit bit görünümü:

Byte 1

Byte 2

Byte 3

...

↓ bitstream

CH1  \[11 bit\]

CH2  \[11 bit\]

CH3  \[11 bit\]

...

CH16 \[11 bit\]

şeklinde olmalıdır.

Channel alanları byte boundary'ye hizalı değildir.

Bu yüzden yanlış:

CH1 \= Byte1 \+ Byte2

CH2 \= Byte3 \+ Byte4

gibi decode yapılmamalıdır.

---

## **SBUS Flags**

Toolkit flags byte için en az:

Digital Channel 17

Digital Channel 18

Frame Lost

Failsafe

alanlarını profile'a göre göstermelidir.

Betaflight implementation'ında `signal loss` ve `failsafe active` ayrı flag bitleri olarak işlenir.

Örnek:

Signal Lost:

YES

Failsafe:

NO

ve:

RC LINK DEGRADED

uyarısı verilebilir.

---

## **SBUS RC View**

CH1 Roll       1502

CH2 Pitch      1498

CH3 Throttle   1005

CH4 Yaw        1501

CH5 Arm        1812

...

Display mode:

Raw

Normalized 0..1

Normalized \-1..+1

µs-like display

Percentage

olmalıdır.

Mapping kullanıcı tarafından kalibre edilmelidir; packed raw değerin doğrudan PWM microseconds olduğu varsayılmamalıdır.

---

# **IBUS**

i-BUS FlySky receiver ecosystem'inde kullanılan serial RC/telemetry bus ailesidir. FlySky güncel receiver'larında i-BUS ve yeni i-BUS2 desteği sunmaktadır; i-BUS2 tek telli serial tree-topology bus olarak sensor, servo ve diğer peripherals için kullanılabilir.

Toolkit iki protocol family'yi ayırmalıdır:

FlySky i-BUS

FlySky i-BUS2

Çünkü wire format ve application behaviour aynı kabul edilmemelidir.

---

## **Classic i-BUS RC Profile**

FlySky'nin resmi AFHDS3 i-BUS channel format duyurusunda serial link:

3.3 V UART

115200 baud

8 data bit

2 stop bit

No parity

olarak yayımlanmıştır.

Betaflight'ın güncel implementation'ı da:

115200 baud

32-byte serial RX packet

profilini destekler.

### **Frame**

Yaygın supported RC frame:

Length

Command/Type

Channel Data

Checksum

şeklinde yorumlanmalıdır.

Betaflight implementation'ında 32-byte receiver packet ve 14 adet 2-byte channel slotu temel yapı olarak kullanılır; yeni receiver'larda previously unused upper bits ile ek channels da taşınabilir.

### **Channel decode**

Toolkit:

Channel 1

Raw

Normalized

Channel 2

Raw

Normalized

...

göstermelidir.

Byte view:

Byte 2–3  → CH1

Byte 4–5  → CH2

...

ancak exact bit masking seçilen i-BUS profile implementation'ına göre yapılmalıdır.

---

## **i-BUS Checksum**

Parser:

Received Checksum

Calculated Checksum

PASS / FAIL

göstermelidir.

Betaflight implementation'ında classic receiver packet için checksum validation frame içeriği üzerinden yapılır ve son iki byte received checksum olarak değerlendirilir.

### **Frame loss**

Last Valid Frame:

8 ms

Current:

40 ms

State:

SIGNAL LOST

gibi timeout tabanlı RC link health oluşturulmalıdır.

---

# **CRSF — Crossfire Serial Protocol**

CRSF Team BlackSheep tarafından RC receiver, radio transmitter ve flight controller arasında kullanılan bidirectional frame-based protocol'dür. TBS'nin resmi CRSF specification repository'si protokolü public implementation reference olarak yayımlar. CRSF; low-latency RC control, telemetry ve remote device configuration amaçlarını destekler.

### **Default FC UART**

TBS specification'a göre flight-controller tarafındaki conventional dual-wire connection:

416666 baud

8N1

non-inverted

3.0–3.3 V class

default olarak kullanılır ve daha yüksek baud rate'e negotiation yapılabilir. Bazı flight-controller implementations 420000 baud nominal değerini kullanır.

Toolkit preset:

CRSF Standard:

416666

CRSF FC Compatibility:

420000

CRSF v3:

Negotiated Baud

gibi options sağlamalıdır.

---

## **CRSF Frame**

Temel frame:

DEVICE ADDRESS

FRAME LENGTH

TYPE

PAYLOAD

CRC

Betaflight current implementation da bu frame modelini kullanır ve maksimum frame size'ı 64 byte olarak sınırlar.

Görsel:

C8 | 18 | 16 | PAYLOAD... | CRC

──   ──   ──   ──────────   ───

ADR  LEN TYPE      DATA      CRC

---

## **CRSF Extended Frame**

Extended frame'lerde:

Destination

Source

bilgileri payload/header extension içerisinde bulunabilir.

Toolkit:

Frame Type:

Extended

Destination:

Flight Controller

Source:

Receiver

göstermelidir.

---

## **RC Channels**

CRSF conventional channel packet 16 adet channel'ı packed biçimde taşıyabilir. Betaflight implementation'ında 16 × 11-bit \= 176-bit channel payload yapısı bulunmaktadır.

CH1 11 bit

CH2 11 bit

...

CH16 11 bit

Toolkit bit-level packed channel visualizer sağlamalıdır.

---

## **CRSF Telemetry**

TBS official protocol specification çok sayıda telemetry frame type tanımlar; bunlar arasında GNSS, battery, barometric altitude, airspeed, RPM, temperature ve link statistics gibi bilgiler bulunabilir.

Toolkit:

RC Control

Link Statistics

GPS

Battery

Vario

Airspeed

RPM

Temperature

Device Info

Configuration

kategorileri oluşturmalıdır.

---

## **Link Statistics**

RC link dashboard:

Uplink RSSI

Uplink LQ

Uplink SNR

Downlink RSSI

Downlink LQ

RF Mode

TX Power

Antenna

gibi alanları desteklemelidir.

### **Link trend**

Time

RSSI

LQ

SNR

grafiği uçuş loguyla correlate edilebilmelidir.

Örneğin:

12:00:32

LQ begins dropping

12:00:34

RSSI low

12:00:35

RC failsafe

---

## **CRSF CRC**

Toolkit:

CRC:

Received

Calculated

PASS / FAIL

göstermelidir.

Extended command'lerde bazı command-specific ek CRC yapıları bulunabileceğinden frame CRC ile command CRC birbirinden ayrı tutulmalıdır. Betaflight bind-command implementation'ı bunun örneğini içerir.

---

## **CRSF Baud Negotiation**

CRSF v3 receiver ve flight controller daha yüksek baud rate üzerinde anlaşabilir.

TBS/current CRSF working-group description'a göre receiver standard baud ile başlar, speed request gönderir, FC kabul/ret cevabı verir ve kabul edilirse iki taraf yeni baud'a geçer.

Toolkit timeline:

416666

↓

Speed Proposal

2,000,000 baud

↓

Accepted

↓

Guard Time

↓

Switch

↓

2,000,000

göstermelidir.

Baud switch sırasında:

BAUD NEGOTIATION FAILED

tespit edilebilmelidir.

---

# **PPM — Pulse Position Modulation / RC PPM**

RC sistemlerindeki PPM, birden fazla RC channel'ın tek pulse train içerisinde time-domain olarak encode edildiği legacy/compact control signal formatıdır.

Bu protokol için tek bir evrensel pulse width mapping'i varsayılmamalıdır. Toolkit kullanıcıya:

Channel Count

Frame Period

Minimum Pulse

Center Pulse

Maximum Pulse

Sync Gap

Polarity

parametrelerini tanımlatmalıdır.

### **Conceptual waveform**

|CH1| gap |CH2| gap |CH3| gap |CH4| ........ |SYNC GAP|

veya kullanılan implementation'a göre pulse-to-pulse interval üzerinden channel timing çıkarılabilir.

Toolkit pulse capture:

Edge 1:

0 us

Edge 2:

1502 us

Edge 3:

3001 us

...

üzerinden:

CH1:

1502 us

CH2:

1499 us

CH3:

...

hesaplamalıdır.

---

## **PPM Normalization**

Kullanıcı:

Minimum \= 1000 us

Center  \= 1500 us

Maximum \= 2000 us

örnek calibration preset'i seçerse:

centered normalization:

\[  
x=  
\\frac{Pulse-Center}  
{Maximum-Center}  
\]

pozitif tarafta;

negatif tarafta uygun minimum-center aralığı kullanılmalıdır.

Örnek:

Pulse:

1750 us

Normalized:

\+0.5

Bu değerler **preset örneği** olmalı; protocol standardı olarak hard-code edilmemelidir.

---

## **PPM Frame Detection**

Toolkit:

Normal Channel Gap

vs

Sync Gap

ayırarak frame başlangıcı bulmalıdır.

State:

SEARCH\_SYNC

READ\_CH1

READ\_CH2

...

FRAME\_COMPLETE

### **Errors**

Missing Sync

Too Many Channels

Too Few Channels

Pulse Out Of Range

Frame Period Error

Jitter Excessive

Signal Timeout

göstermelidir.

---

# **PWM Servo Frame Analizi**

PWM servo signal traditional RC actuator control için kullanılan per-channel pulse signal yaklaşımıdır.

PPM'den farkı:

PPM

→ bir hatta birden fazla channel

PWM servo

→ genellikle her channel için ayrı signal

şeklindedir.

Toolkit servo signal'ı sadece:

HIGH time

değil:

Pulse Width

Frame Period

Frequency

Duty Cycle

Jitter

Missing Pulse

olarak analiz etmelidir.

---

## **PWM hesapları**

\[  
Frequency=\\frac{1}{Period}  
\]

\[  
DutyCycle=  
\\frac{PulseWidth}{Period}\\times100  
\]

Örnek:

Period:

20 ms

Pulse:

1.5 ms

\[  
f=50Hz  
\]

\[  
Duty=7.5%  
\]

Bu sadece bir örnek konfigürasyondur; digital/high-speed servo sistemleri farklı refresh rates ve pulse ranges kullanabilir.

---

## **Servo position normalization**

Calibration:

Min:

1000 us

Center:

1500 us

Max:

2000 us

ile:

1000 → \-100 %

1500 → 0 %

2000 → \+100 %

gibi normalized view sağlanabilir.

### **Multi-channel view**

Servo 1:

1501 us

Servo 2:

1230 us

Servo 3:

1782 us

Servo 4:

1500 us

### **Jitter**

Örneğin servo center command:

1498

1502

1501

1497

1503 us

Toolkit:

Mean:

1500.2 us

Peak-to-Peak:

6 us

Standard Deviation:

...

hesaplamalıdır.

---

# **ARINC 429 — Temel Word Decoder**

ARINC 429 civil avionics'te guidance/navigation, flight control, flight data ve communication systems arasında kullanılan yaygın avionics data bus standardıdır. Holt gibi ARINC 429 protocol IC üreticileri 32-bit word processing, label recognition, parity ve independent transmitter/receiver data rates gibi standard özellikleri donanımda uygular.

Toolkit'in ilk sürümünde doğrudan analog ARINC waveform capture zorunlu olmamalıdır.

Girdi:

32-bit raw word

HEX log

CSV log

Adapter log

olabilir.

---

## **ARINC 429 Word**

32-bit word temel olarak:

Label

SDI

Data

SSM

Parity

alanlarına ayrılır.

Belgedeki mevcut hedef de:

Label

SDI

Data

SSM

Parity

ve:

Octal label

BNR

BCD

Discrete

Signed

Scale

Parity validation

desteklerini istemektedir.

Toolkit bit tree:

ARINC Word

├─ Label

├─ SDI

├─ Data

├─ SSM

└─ Parity

olmalıdır.

### **32-bit**

Holt current ARINC 429 interfaces word'leri 32-bit olarak buffer/FIFO'larda işler ve parity result'unu 32\. bit ile ilişkilendirir.

---

## **Label**

ARINC label convention nedeniyle toolkit label'ı:

Binary

Octal

Decimal

görünümlerinde gösterebilmelidir.

Örnek:

Raw Label:

0x..

Octal:

203

Database Name:

Altitude / example profile

Actual label meaning loaded ARINC 429 equipment database/ICD üzerinden gelmelidir.

Label'ın tek başına global olarak aynı engineering meaning'i taşıdığı varsayılmamalıdır; aircraft/equipment ICD önemlidir.

---

## **SDI**

Source/Destination Identifier:

00

01

10

11

bit value olarak gösterilmeli ve configured equipment mapping varsa:

SDI 01:

IRS \#1

gibi semantic isim verilebilmelidir.

---

## **Data Field**

Data:

BNR

BCD

Discrete

Custom

formatlarında yorumlanabilir.

### **BNR**

Physical conversion:

\[  
Physical \=  
RawSigned\\times Resolution  
\]

ve gerekli profile offset/range kuralları uygulanmalıdır.

Örnek:

Raw:

12345

Resolution:

0.1 ft

Physical:

1234.5 ft

### **BCD**

Toolkit digit extraction göstermelidir:

Digit 1

Digit 2

Digit 3

Digit 4

...

### **Discrete**

Bit 11:

Landing Gear Down

Bit 12:

Warning

Bit 13:

Valid

gibi ICD mapping yapılabilir.

---

## **SSM**

Sign/Status Matrix field'ı data encoding türüne bağlı semantic anlama sahip olabilir.

Toolkit:

Raw SSM:

10

Encoding:

BNR

Meaning:

...

şeklinde selected data-format rules'a göre decode etmelidir.

---

## **Parity**

ARINC 429 word parity kontrolü yapılmalıdır.

Toolkit:

Parity:

Odd

Calculated:

Valid

ve:

PARITY ERROR

göstermelidir.

ARINC 429 terminal IC'leri parity generation/checking'i donanım seviyesinde destekler.

---

## **ARINC 429 Rate Analyzer**

Holt terminal implementations selectable ARINC data-rate handling ve receiver oversampling sunmaktadır.

Toolkit capture metadata'dan:

Word Rate

Inter-word Gap

Label Rate

Label Jitter

Missing Label

istatistikleri çıkarmalıdır.

Örneğin:

Label 203

Expected:

20 Hz

Observed:

19.96 Hz

Last Seen:

12 ms

---

# **MIL-STD-1553 — Log Tabanlı Temel Decoder**

MIL-STD-1553 aktif ABD askeri interface standardı olarak **Digital Time Division Command/Response Multiplex Data Bus**'ı tanımlar. DLA ASSIST veritabanında standard 2026 itibarıyla aktif görünmektedir ve scope'u bus line, interface electronics, concept of operation, information flow ve electrical/functional formats'ı kapsar.

Toolkit'in ilk aşamasında doğrudan analog Manchester waveform acquisition zorunlu olmamalıdır.

Girdiler:

Bus analyzer log

CSV

TXT

Vendor adapter export

Raw decoded word list

olabilir.

---

## **MIL-STD-1553 Roller**

Sistem:

Bus Controller — BC

Remote Terminal — RT

Bus Monitor — BM

rolleri ile gösterilmelidir.

Network diagram:

                 RT 1

                   │

BC \======= BUS \====+======= RT 2

                   │

                  RT 3

BM → passive monitoring

---

## **Word Types**

Toolkit en az:

Command Word

Status Word

Data Word

ayrımını yapmalıdır.

### **Command Word**

Semantic tree:

RT Address

Transmit / Receive

Subaddress / Mode

Word Count / Mode Code

Parity

### **Status Word**

RT Address

Status Flags

Message Error

Service Request

Subsystem Flags

Terminal Flags

Parity

exact fields selected MIL-STD-1553 standard revision'a göre decode edilmelidir.

### **Data Word**

16-bit Data

Parity

ve yüklenen ICD varsa engineering fields'a dönüştürülmelidir.

---

## **Transaction Types**

Toolkit sequence'leri transaction olarak gruplayabilmelidir.

Örnek BC → RT:

BC

Command Word

↓

Data Word

Data Word

...

↓

RT Status Word

RT → BC:

BC Command

↓

RT Status

↓

RT Data

RT Data

...

RT-to-RT:

BC Receive Command → Destination RT

BC Transmit Command → Source RT

Source Status

Data...

Destination Status

Timeline view özellikle önemlidir.

---

## **RT/Subaddress Explorer**

RT 01

├─ SA 01

├─ SA 02

└─ SA 05

RT 02

├─ SA 03

└─ SA 10

Her RT/subaddress için:

Message Count

Word Count

Rate

Error

Last Seen

istatistikleri tutulmalıdır.

---

## **Mode Codes**

Mode command'ları data transfer'ından ayrılmalıdır.

Toolkit:

Mode Command

Code

Broadcast

Data Word Present

Response

göstermelidir.

Exact mode-code database active standard revision'dan yüklenmelidir.

---

## **Redundant Bus A/B**

MIL-STD-1553 sistemleri redundant bus architecture kullanabilir.

Toolkit:

Bus A

Bus B

capture'larını karşılaştırmalıdır.

Örnek:

Transaction:

RT 4 / SA 2

Bus A:

PASS

Bus B:

No traffic

ve:

REDUNDANCY WARNING

gibi çıktı verebilir.

---

## **Timing Analyzer**

Her transaction:

Command Time

Response Time

Inter-word Gap

Transaction Duration

Bus Utilization

ölçülmelidir.

Örneğin:

RT Response:

8.2 us

Configured Limit:

...

Status:

PASS

Exact acceptance limits selected standard/profile/ICD configuration'dan alınmalıdır.

---

# **ADS-B**

ADS-B — Automatic Dependent Surveillance–Broadcast — aircraft'ın kendi navigation solution'ını ve ilgili surveillance bilgisini broadcast etmesi prensibine dayanır. FAA'ya göre onboard avionics GNSS/navigation source kullanarak aircraft position'ını belirler ve position ile ek aircraft information'ı ground/other users'a broadcast eder. ABD'de iki ana ADS-B data-link seçeneği 1090 MHz Extended Squitter ve 978 MHz UAT'tır.

Toolkit:

1090ES

978 UAT

data sources'ını ayrı parser olarak ele almalıdır.

Belgedeki ilk kapsam için özellikle:

1090ES / Mode S

üzerine yoğunlaşılabilir.

---

## **ADS-B Source Pipeline**

RF Capture / Receiver

↓

Mode S / UAT Demodulator

↓

Binary Frame

↓

CRC

↓

ADS-B Message

↓

Aircraft State

Toolkit doğrudan SDR demodulator olmak zorunda değildir.

Input:

Raw hex

Beast binary

SBS/BaseStation log

dump1090 JSON

PCAP/custom receiver export

gibi formatlardan gelebilir.

---

## **Aircraft Table**

ICAO       Callsign   Altitude   Speed   Heading   Lat   Lon

ABC123     TEST01     ...        ...     ...       ...   ...

Her target:

Last Seen

Message Count

Position Age

Velocity Age

Callsign Age

CRC State

Source Receiver

RSSI if available

metadata'sı taşımalıdır.

---

## **1090ES**

FAA, 1090 MHz Mode S transponder'ın ADS-B functionality ile genişletilmiş mesajlarını **Extended Squitter — 1090ES** olarak tanımlar.

Mode S/ADS-B detailed message format için authoritative reference ICAO Doc 9871 ve ilgili airborne equipment standards'dır; toolkit message-definition database'i revision metadata'sına sahip olmalıdır. ICAO Doc 9871 Mode S services, transponder registers ve extended-squitter formats/protocols'u tanımlar.

---

# **Mode-S**

Mode S secondary surveillance transponder communication family'dir.

Toolkit ADS-B ile Mode S'i aynı şey kabul etmemelidir:

Mode S

└─ birçok downlink/uplink format

ADS-B 1090ES

└─ Mode S Extended Squitter kullanır

FAA da Mode S transponder capability ile Mode S \+ Extended Squitter ADS-B capability'yi ayrı sınıflandırır.

---

## **Mode S Message Length**

Mode S implementations short ve extended frame sınıfları kullanabilir. FlightAware `dump1090` decoder'ı DF0/4/5/11/16/20/21 ve DF17 gibi çeşitli Mode S downlink formats'ı işler ve 24-bit CRC tabanlı validation uygular.

Toolkit parser:

Short Mode S

Extended Mode S

olarak length'i belirlemeli;

DF

ICAO

Payload

Parity/CRC

gibi ortak fields göstermelidir.

---

## **Downlink Format — DF**

İlk bits:

DF

mesajın downlink type'ını belirler.

Toolkit:

DF 11

All-call reply

DF 17

Extended Squitter / ADS-B candidate

DF 4

Altitude reply

...

gibi type database kullanmalıdır.

FlightAware decoder'ın current implementation'ı özellikle DF11 ve DF17'yi ve diğer surveillance DF formats'ını destekler.

---

## **DF17 — ADS-B Extended Squitter**

Toolkit:

DF

Capability

ICAO Address

Extended Squitter Message

Parity

alanlarına ayırmalıdır.

Ardından ADS-B payload decoder:

Type Code

Subtype

Aircraft Identification

Position

Velocity

Altitude

Status

gibi message-specific semantic'lere geçmelidir.

Exact type-code field allocation ICAO/DO-260 revision database'ına bağlı tutulmalıdır.

---

## **ICAO Address**

24-bit aircraft address:

ICAO:

ABC123

target tracking key'lerinden biri olarak kullanılabilir.

Ancak toolkit:

ICAO Address

ile:

Callsign

Registration

Flight Number

bilgilerini birbirine karıştırmamalıdır.

---

## **CRC / Parity**

Mode S decoder 24-bit parity/CRC alanı üzerinden message integrity validation yapmalıdır. FlightAware's decoder da 24-bit CRC üzerinden error checking/correction seçenekleri sağlar.

Toolkit:

CRC:

PASS

Corrected Bits:

0

ve eğer optional correction engine kullanılıyorsa:

Original:

CRC FAIL

Candidate Correction:

Bit 42

Corrected:

CRC PASS

Confidence:

Low / Corrected

göstermelidir.

**Corrected message hiçbir zaman native-valid frame ile aynı confidence seviyesinde gösterilmemelidir.**

---

## **ADS-B Position**

Position data decode edildiğinde:

Latitude

Longitude

Altitude

Position source age

gösterilmelidir.

Position calculation için Compact Position Reporting gibi encoding yöntemleri kullanıldığında toolkit intermediate data'yı da gösterebilmelidir:

CPR Format:

Even / Odd

Raw Latitude:

...

Raw Longitude:

...

Reference / Pair:

...

FlightAware-style Mode S decoders CPR position decoding'i uygulamaktadır.

---

## **ADS-B Target Age**

Farklı information türleri farklı zamanlarda gelebilir.

Bu nedenle target:

Position Age

Altitude Age

Velocity Age

Identification Age

Status Age

ayrı tutulmalıdır.

Örneğin:

Aircraft:

ABC123

Position:

0.4 s old

Velocity:

1.1 s old

Callsign:

18 s old

---

# **GPS UBX — Havacılık Kullanım Görünümü**

UBX parser 3.2 ve 3.5 bölümlerindeki aynı core'u kullanmalıdır.

Burada tekrar protocol parser yazılmamalı; üstüne **flight navigation view** eklenmelidir.

UBX

↓

GNSS Solution

↓

Flight Navigation

Toolkit:

Fix Type

Latitude

Longitude

MSL Altitude

Ellipsoid Altitude

Ground Speed

Heading

Vertical Velocity

Position Accuracy

Velocity Accuracy

Time Accuracy

Satellite Count

gibi navigation values'ı ortak flight state'e dönüştürmelidir.

---

## **GNSS Cross-Check**

Aynı flight controller'da:

UBX

MAVLink GPS\_RAW\_INT

RTCM status

NMEA

aynı GNSS chain'in farklı seviyeleri olabilir.

Toolkit:

GNSS Receiver UBX:

Fix 3D

Sat 18

Flight Controller MAVLink:

Fix 3D

Sat 18

Difference:

0

karşılaştırması yapabilmelidir.

---

# **RTCM — UAV / RTK Kullanımı**

RTCM decoder 3.5 bölümündeki ortak RTCM engine'i kullanmalıdır.

UAV-specific layer:

RTCM Correction

↓

GNSS Rover

↓

RTK Float / Fixed

↓

Flight Controller

gibi görünmelidir.

Toolkit:

RTCM Message Rate

Correction Age

Reference Station

GNSS Constellation

CRC

Last Received

göstermelidir.

### **Correction link loss**

RTCM Last Received:

7.2 s

RTK State:

FLOAT

Previous:

FIXED

timeline correlation yapılabilir.

---

# **NMEA — Havacılık Kullanımı**

NMEA parser 3.5'teki ortak engine'i kullanmalıdır.

UAV layer:

NMEA GNSS

↓

Position / Velocity / Time

↓

Flight Controller

şeklinde olmalıdır.

### **Message rate**

Örneğin:

GGA:

5 Hz

RMC:

5 Hz

ve flight controller navigation loop'u ile karşılaştırılabilir.

### **NMEA / UBX Compare**

NMEA Position:

...

UBX Position:

...

Difference:

0.3 m

aynı receiver outputlarının consistency kontrolünde kullanılabilir.

---

# **RC Input Protocol Auto-Detection**

Toolkit RC input analyzer:

SBUS

IBUS

CRSF

PPM

PWM

candidate detection sağlayabilir.

Örneğin:

Serial:

100000

Even

2 Stop

Inverted

Observed:

0x0F start

25-byte repeating frames

Candidate:

SBUS

Confidence:

HIGH

SBUS implementation profile için bu karakteristikler Betaflight parser'ı ile uyumludur.

Başka örnek:

Serial:

115200

Frame:

32 bytes

Candidate:

FlySky i-BUS

CRSF:

\~416666 / 420000

Frame:

Address \+ Length \+ Type \+ Payload \+ CRC

Candidate:

CRSF

---

# **RC Failsafe Analyzer**

Bütün RC protokolleri ortak state modeline bağlanmalıdır:

NORMAL

DEGRADED

FRAME\_LOSS

FAILSAFE

SIGNAL\_LOST

RECOVERING

Timeline:

LQ 100%

↓

LQ 60%

↓

Lost Frames

↓

Failsafe

↓

Signal Recovered

### **Flight Control Correlation**

12:10:00.000

RC LQ drops

12:10:00.300

RC Failsafe

12:10:00.320

Flight Mode → RTL

12:10:00.350

Throttle command changes

aynı timeline üzerinde gösterilmelidir.

---

# **Common Flight State Model**

MAVLink, DroneCAN/Cyphal, UBX ve diğer telemetry kaynakları ortak veri modeline dönüştürülmelidir.

FlightState

├─ Attitude

│  ├─ Roll

│  ├─ Pitch

│  └─ Yaw

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

Bu sayede:

MAVLink Yaw

vs

DroneCAN Attitude

vs

ARINC Heading

aynı graph üzerinde karşılaştırılabilir.

---

# **Coordinate Frame Analyzer**

Aerospace protocols farklı coordinate frames kullanabilir:

NED

ENU

Body FRD

Body FLU

ECEF

Geodetic

Toolkit frame metadata olmadan vector'leri karşılaştırmamalıdır.

Örneğin:

Velocity:

\[10, 2, \-1\]

Frame:

NED

ile:

Velocity:

\[10, \-2, 1\]

Frame:

ENU

doğrudan aynı kabul edilmemelidir.

### **Vector transform module**

Known transform varsa:

\[  
v\_B=R\_{BA}v\_A  
\]

kullanılabilir.

UI:

Source Frame:

NED

Target:

ENU

Converted:

...

---

# **Attitude Unit / Convention Analyzer**

Toolkit:

Euler

Quaternion

Rotation Matrix

gösterimlerini desteklemelidir.

Euler:

Roll

Pitch

Yaw

Quaternion:

w

x

y

z

### **Quaternion norm**

\[  
||q||=  
\\sqrt{w^2+x^2+y^2+z^2}  
\]

Expected:

\[  
||q||\\approx1  
\]

Toolkit:

Quaternion Norm:

0.998

Status:

OK

gösterebilir.

---

# **Flight Message Freshness**

Her telemetry value:

Last Update

Expected Rate

Age

Validity

bilgisine sahip olmalıdır.

Örnek:

Attitude:

Age 8 ms

FRESH

GNSS:

Age 180 ms

FRESH

Airspeed:

Age 3.4 s

STALE

Age:

\[  
Age=t\_{now}-t\_{last}  
\]

---

# **Multi-Protocol Time Correlation**

Örneğin:

MAVLink ATTITUDE

50 Hz

DroneCAN ESC Status

20 Hz

CRSF RC

150 Hz

UBX GNSS

10 Hz

aynı timeline üzerinde normalize edilebilmelidir.

Toolkit:

Host Timestamp

Protocol Timestamp

Sensor Timestamp

GNSS UTC

kaynaklarını birbirinden ayırmalıdır.

---

# **Flight Latency Analyzer**

Command pipeline:

RC Stick

↓

CRSF

↓

Flight Controller

↓

Control Output

↓

Servo / ESC

yakalanabiliyorsa end-to-end delay yaklaşık ölçülebilir.

Örneğin:

RC channel change:

t \= 0

FC output change:

t \= 2.3 ms

Servo PWM change:

t \= 4.1 ms

Toolkit:

RX → FC Latency

FC Processing

FC → Actuator Latency

Total

gösterebilir.

Bu değerler capture timestamp accuracy'ye bağlı olduğundan uncertainty de belirtilmelidir.

---

# **Protocol Bridge Analyzer**

Örnek:

DroneCAN GNSS

↓

Flight Controller

↓

MAVLink GPS\_RAW\_INT

Toolkit:

Input:

DroneCAN Position

Output:

MAVLink GPS

Latency:

4.3 ms

Position Difference:

0.07 m

gibi gateway/bridge correlation yapabilir.

Başka:

CRSF RC

↓

FC

↓

MAVLink RC\_CHANNELS

ve:

UBX

↓

FC

↓

MAVLink GPS\_RAW\_INT

correlation yapılabilir.

---

# **Avionics Bus Source Database**

ARINC 429 ve MIL-STD-1553 gibi protocol'lerde raw frame tek başına engineering meaning için yeterli değildir.

Toolkit project database:

ARINC

├─ Channel

├─ Label

├─ SDI

├─ Encoding

├─ Scale

├─ Unit

└─ Equipment

MIL-STD-1553

├─ Bus

├─ RT

├─ Subaddress

├─ Direction

├─ Word Count

└─ ICD Mapping

desteklemelidir.

Bu database import:

CSV

JSON

Custom schema

ile yapılabilir.

---

# **Ortak Havacılık Hata Modeli**

Aşağıdaki error/warning sınıfları desteklenmelidir:

CRC\_ERROR

CHECKSUM\_ERROR

SIGNATURE\_INVALID

UNKNOWN\_MESSAGE

UNKNOWN\_DIALECT

SEQUENCE\_GAP

PACKET\_LOSS

TRANSFER\_ID\_ERROR

TOGGLE\_ERROR

MULTIFRAME\_INCOMPLETE

NODE\_OFFLINE

HEARTBEAT\_TIMEOUT

INVALID\_RC\_FRAME

RC\_FRAME\_LOST

RC\_FAILSAFE

GNSS\_FIX\_LOST

RTCM\_TIMEOUT

TELEMETRY\_STALE

COMMAND\_TIMEOUT

COMMAND\_REJECTED

PARAMETER\_TIMEOUT

ARINC\_PARITY\_ERROR

UNKNOWN\_ARINC\_LABEL

MIL1553\_PARITY\_ERROR

MIL1553\_RESPONSE\_TIMEOUT

ADS\_B\_CRC\_ERROR

ADS\_B\_POSITION\_STALE

SOURCE\_DISAGREEMENT

RATE\_OUT\_OF\_RANGE

EXCESSIVE\_JITTER

Her hata:

Protocol

Timestamp

Source

Message

Field

Expected

Received

Severity

Possible Cause

bilgisine sahip olmalıdır.

---

# **Aerospace System Graph**

Toolkit proje görünümünde kullanıcı sistemi node graph olarak kurabilmelidir.

Örnek:

                     ┌── GNSS UBX

                      │

RC ─ CRSF ─ Flight Controller ─ MAVLink ─ GCS

                      │

                      ├── DroneCAN ─ ESC 1

                      │             ESC 2

                      │             ESC 3

                      │             ESC 4

                      │

                      └── PWM ─ Servo

Daha büyük aircraft:

Mission Computer

├── ARINC 429 → Navigation Equipment

├── MIL-STD-1553 → Avionics RT

├── Ethernet → EO Payload

└── MAVLink → Flight Controller

Her connection:

Protocol

Bit Rate

Message Rate

Health

Errors

Last Activity

göstermelidir.

---

# **Ortak Aerospace Layer Drill-Down**

Kullanıcı bir flight parameter'a tıklayınca raw source'a kadar inebilmelidir.

Örneğin MAVLink:

Roll:

12.4°

↓

ATTITUDE

↓

Payload Field

↓

MAVLink 2 Packet

↓

UART / UDP

DroneCAN:

ESC RPM:

5200 rpm

↓

DroneCAN ESC Status

↓

DSDL Field

↓

Transfer

↓

CAN Frame

↓

29-bit CAN ID

CRSF:

Throttle:

63 %

↓

RC Channel 3

↓

11-bit packed channel

↓

CRSF RC Frame

↓

UART

ARINC 429:

Altitude:

12500 ft

↓

BNR

↓

Data Field

↓

Label

↓

32-bit ARINC Word

MIL-STD-1553:

Sensor Value

↓

ICD Field

↓

Data Word

↓

RT / Subaddress Transaction

↓

Bus A/B

ADS-B:

Aircraft Position

↓

ADS-B Message

↓

Extended Squitter

↓

Mode S Frame

↓

1090 MHz Receiver

GNSS:

Position

↓

UBX Navigation Message

↓

UART

Bu yapı sayesinde 3.6 bölümü yalnız **MAVLink decoder \+ RC channel viewer** olmamalıdır. Amaç; **RC kumanda girişinden flight controller telemetrisine, distributed CAN avionics ağından GNSS correction stream'ine, ARINC/MIL bus'larından ADS-B surveillance mesajlarına kadar uçuş sistemindeki haberleşmeyi tek bir zaman çizelgesinde ve bit/field/application seviyelerinde inceleyebilen bütünleşik bir aerospace communication analyzer** oluşturmaktır.

## **3.7 Bina otomasyonu**

* BACnet MS/TP  
* BACnet/IP  
* KNX  
* DALI  
* M-Bus  
* Modbus RTU  
* Modbus TCP  
* LonWorks için temel mesaj görüntüleme  
* DMX512  
* Art-Net  
* sACN

Bina otomasyonu bölümü yalnızca bir protokol paketi içindeki register veya object değerini gösteren basit bir decoder olmamalıdır. Platform; HVAC controller'ları, VAV kutuları, fan-coil controller'ları, chiller'lar, boiler'lar, VFD'ler, pompalar, enerji sayaçları, oda kontrol cihazları, termostatlar, DALI gateway'leri, KNX actuator/sensor'ları, BACnet controller'ları, lighting controller'ları ve BMS/SCADA sistemlerinin haberleşmesini hem ağ hem de uygulama seviyesinde analiz edebilmelidir.

BACnet özellikle HVAC, lighting, elevator monitoring, access-control, security ve fire-alarm integration gibi bina otomasyon alanları için geliştirilmiş vendor-independent bir building automation communication standardıdır. Güncel temel standard ANSI/ASHRAE 135-2024'tür ve BACnet aynı zamanda ISO 16484-5 standardıdır.

Her bina otomasyonu protokolünde mümkün olduğunca şu ortak görünümler bulunmalıdır:

Network

Devices

Objects / Datapoints

Raw Frame

HEX

Binary

Address

Source

Destination

Function / Service

Value

Unit

Quality

Timestamp

Priority

Alarm

Event

Trend

Schedule

Command

Response

Polling

COV / Event

Latency

Period

Jitter

Timeout

Retry

Error

Gateway Mapping

Ortak bina modeli:

Building

├─ HVAC

│  ├─ Chiller

│  ├─ Boiler

│  ├─ AHU

│  ├─ FCU

│  ├─ VAV

│  ├─ Pump

│  └─ VFD

├─ Rooms

│  ├─ Temperature

│  ├─ Humidity

│  ├─ CO₂

│  ├─ Occupancy

│  └─ Setpoint

├─ Lighting

│  ├─ On/Off

│  ├─ Dimming

│  ├─ Scene

│  └─ Colour

├─ Metering

│  ├─ Electricity

│  ├─ Water

│  ├─ Gas

│  └─ Heat

└─ Infrastructure

   ├─ Alarm

   ├─ Access

   └─ Elevator

Aynı physical value farklı protokollerden geliyorsa karşılaştırılabilmelidir:

Room 101 Temperature

BACnet:

23.4 °C

KNX:

23.5 °C

Modbus FCU:

23.3 °C

Difference:

max 0.2 °C

---

# **BACnet MS/TP**

BACnet MS/TP, BACnet application ve network katmanlarının RS-485 tabanlı **Master-Slave/Token-Passing** data-link üzerinde taşındığı bina otomasyon network türüdür. BACnet International, MS/TP'yi EIA-485 üzerinde çalışan multidrop serial/token-passing MAC layer olarak tanımlar. Token yalnız master-capable node'lar arasında dolaşır; subordinate cihazlar kendilerine gelen isteklere cevap verir.

Tipik ağ:

BMS Controller

     │

     │ RS-485

\=====+============+============+========

     │            │            │

   VAV 1        VAV 2         VFD

MAC 10          MAC 11        MAC 20

BACnet ile RS-485 birbirine karıştırılmamalıdır:

BACnet Objects / Services

        ↓

BACnet NPDU / APDU

        ↓

BACnet MS/TP

        ↓

RS-485

RS-485 yalnız electrical physical layer'dır.

---

## **BACnet MS/TP Frame Görünümü**

Toolkit frame'i conceptual olarak:

Preamble

Frame Type

Destination

Source

Length

Header CRC

Data

Data CRC

alanlarına ayırmalıdır.

Raw:

55 FF | TT | DD | SS | LL LL | HC | DATA... | CRC CRC

UI:

Preamble:

Valid

Frame Type:

Data Expecting Reply

Destination MAC:

10

Source MAC:

1

Data Length:

...

Header CRC:

PASS

Data CRC:

PASS

Exact constants ve CRC algoritmaları selected BACnet protocol revision database'ından gelmelidir.

---

## **MS/TP Token**

MS/TP analizinde yalnız application message değil **token circulation** mutlaka incelenmelidir.

Timeline:

MAC 1

TOKEN →

MAC 5

      TOKEN →

MAC 10

           TOKEN →

MAC 20

Toolkit:

Token Holder

Token Rotation Time

Token Pass Count

Token Retry

Token Lost

Duplicate Token Suspected

değerlerini göstermelidir.

### **Token Rotation Time**

Aynı node'un token'ı tekrar alma zamanı:

\[  
T\_{rotation}=t\_{token,n}-t\_{token,n-1}  
\]

Örneğin:

MAC 10

Token:

12:00:00.100

Next Token:

12:00:00.147

\[  
T\_{rotation}=47ms  
\]

Toolkit:

Mean Rotation:

46.8 ms

Maximum:

61.2 ms

Jitter:

...

göstermelidir.

---

## **BACnet MAC Address ile Device Instance Ayrımı**

Çok kritik entegrasyon konusu:

MS/TP MAC Address

≠

BACnet Device Instance

Örneğin:

MAC:

10

BACnet Device Instance:

420010

Toolkit bunları ayrı kolonlarda göstermelidir.

MAC    Device Instance    Name

10     420010             VAV-101

11     420011             VAV-102

20     500020             AHU-1 VFD

---

# **BACnet Object Model**

BACnet communication'ın en önemli tarafı raw register değil **object/property modelidir**. BACnet International her object'in type \+ instance identifier taşıdığını ve properties üzerinden izlenip kontrol edildiğini açıklar. Her object'te en az Object\_Identifier, Object\_Name ve Object\_Type gibi temel properties bulunur.

Örneğin:

Analog Input 1

├─ Object Identifier

├─ Object Name

├─ Present Value

├─ Units

├─ Status Flags

├─ Event State

├─ Out Of Service

└─ Reliability

### **Yaygın object türleri**

Toolkit database'i en az:

Analog Input

Analog Output

Analog Value

Binary Input

Binary Output

Binary Value

Multi-State Input

Multi-State Output

Multi-State Value

Device

Schedule

Calendar

Trend Log

Notification Class

Loop

Accumulator

Lighting Output

gibi object'leri desteklemelidir.

---

## **BACnet point görünümü**

Örneğin:

Object:

Analog Input, 12

Name:

Room101\_Temperature

Present\_Value:

23.42

Units:

Degrees Celsius

Status:

Normal

Out\_Of\_Service:

False

UI:

Room 101 Temperature

23.42 °C

GOOD

olarak gösterilebilir.

Raw property bilgisi kaybolmamalıdır.

---

# **BACnet Services**

BACnet service, bir cihazın diğer cihazın object/property bilgisine erişme veya belirli operasyon yaptırma yöntemidir. BACnet International service kavramını object/property verisini okumak, command göndermek veya event bildirmek için kullanılan standardized communication mechanism olarak tanımlar.

Toolkit en az:

Who-Is

I-Am

Who-Has

I-Have

ReadProperty

ReadPropertyMultiple

WriteProperty

WritePropertyMultiple

SubscribeCOV

ConfirmedCOVNotification

UnconfirmedCOVNotification

AcknowledgeAlarm

GetEventInformation

DeviceCommunicationControl

ReinitializeDevice

gibi service'leri desteklemelidir.

---

## **Who-Is / I-Am**

Discovery:

BMS

 │

 ├─ Who-Is ──────────────→ Broadcast

 │

 ├← I-Am Device 100

 ├← I-Am Device 200

 └← I-Am Device 300

Toolkit:

Discovery Request

Who-Is

Responses:

3 devices

Device 100

Device 200

Device 300

göstermelidir.

---

## **ReadProperty**

Request:

ReadProperty

Object:

Analog Input 12

Property:

Present\_Value

Response:

23.42

Toolkit transaction:

Client:

BMS

Server:

VAV-101

Service:

ReadProperty

Object:

AI:12

Property:

Present\_Value

Value:

23.42 °C

Response Time:

18.4 ms

olarak göstermelidir.

---

## **WriteProperty ve Priority Array**

BACnet output control'de yalnız “değeri yaz” mantığı yoktur. Commandable object'lerde **priority mechanism** önemlidir.

Toolkit:

Object:

Analog Output 3

Present Value:

45 %

Priority Array:

1  Emergency

2  ...

8  Manual Operator

...

16 Default/Application

gibi priority view sağlamalıdır.

Bir command:

WriteProperty

Value:

100 %

Priority:

8

ise:

Manual override active

gibi semantic warning üretilebilir.

---

# **BACnet COV — Change of Value**

Sürekli polling yerine device belirli value değişimlerinde subscriber'a notification gönderebilir.

BMS

 │

 ├─ SubscribeCOV

 ▼

VAV

Temperature changes

      ↓

VAV

 └─ COV Notification → BMS

Toolkit:

Subscription

Object

Lifetime

Confirmed / Unconfirmed

Last Notification

Change Amount

göstermelidir.

### **Polling vs COV**

Polling:

Read every 5 s

COV:

Message only after relevant change

traffic comparison ekranı yapılabilir.

---

# **BACnet MS/TP Error Analyzer**

CRC Error

No Token

Token Rotation Too Long

Duplicate MAC

Device Offline

Unexpected Source

Reply Timeout

BACnet Reject

BACnet Abort

BACnet Error

Invalid APDU

Unknown Object

Unknown Property

Write Access Denied

gibi durumlar ayrılmalıdır.

### **Duplicate MAC**

MAC 10

Source fingerprint A

MAC 10

Source fingerprint B

gibi conflict gözlenirse:

POSSIBLE DUPLICATE MS/TP MAC

uyarısı üretilmelidir.

---

# **BACnet/IP**

BACnet/IP aynı BACnet object/service modelini IP network üzerinde taşır. BACnet International'a göre BACnet/IP, UDP/IP üzerinde BACnet Virtual Link Layer kullanır; IP address \+ UDP port kombinasyonu BACnet datalink üzerinde pseudo-MAC işlevi görür.

Katman:

BACnet Objects

↓

BACnet Services

↓

APDU

↓

NPDU

↓

BVLL

↓

UDP

↓

IP

↓

Ethernet

Toolkit:

Ethernet

IP

UDP

BVLL

NPDU

APDU

BACnet Service

katmanlarını ayrı açabilmelidir.

---

## **BACnet/IP discovery**

Local subnet:

Who-Is

↓

Broadcast

↓

I-Am responses

farklı subnet'lerde broadcast routing problemi oluşabilir.

Burada:

BBMD

Foreign Device Registration

Broadcast Distribution Table

gibi kavramlar önemlidir.

BACnet International, BBMD'nin broadcast messages'ın local segment dışına dağıtılmasında kullanıldığını tanımlar.

Toolkit:

BBMD Detected

IP

BDT Entries

Foreign Devices

TTL

Registration

gösterebilmelidir.

---

## **BACnet/IP device tree**

BACnet Network

Device 1001

192.168.1.20

├─ AI 1 Supply Air Temp

├─ AI 2 Return Air Temp

├─ AO 1 Damper

└─ BV 1 Occupied

Device 1002

192.168.1.21

└─ ...

### **IP ≠ Device Identity**

Bir BACnet device:

Device Instance:

12345

ile tanımlanmalıdır.

IP değişse bile aynı BACnet logical device olabilir.

Toolkit:

Old IP:

192.168.1.20

New IP:

192.168.10.20

Device Instance:

12345

Identity:

Same device

olarak correlate edebilmelidir.

---

# **BACnet Trend ve Alarm Görünümü**

BACnet object model yalnız present value'dan oluşmaz.

Toolkit:

Trend Log

Alarm

Event

Notification

Schedule

Calendar

object/service'lerini ayrı dashboard yapmalıdır.

Örneğin:

AHU Supply Air Temperature

12:00  16.2 °C

12:05  16.4 °C

12:10  19.8 °C

Alarm:

HIGH TEMPERATURE

Transition:

Normal → Offnormal

Acknowledged:

No

---

# **KNX**

KNX bina ve konut otomasyonunda distributed control için kullanılan standardized building automation ecosystem'idir.

KNX'in önemli özelliği yalnız fiziksel telegram değil:

Individual Address

Group Address

Group Object

Datapoint Type

Application Program

kavramlarının birlikte çalışmasıdır.

KNX Group Address 16 bit genişliğindedir; `0` değeri system broadcast için ayrılmıştır. ETS group-address modelinde main/middle/sub group yapıları kullanılabilir.

---

## **KNX adresleri**

İki farklı address kesinlikle ayrılmalıdır:

Individual Address

ve:

Group Address

### **Individual address**

Topology/device identity amaçlıdır.

Örneğin:

1.1.15

conceptual:

Area

Line

Device

olarak gösterilebilir.

### **Group address**

Fonksiyonu temsil eder:

1/2/5

Örneğin:

Main:

Lighting

Middle:

Floor 2

Sub:

Meeting Room

Toolkit:

Group:

1/2/5

Name:

Meeting Room Light

DPT:

Switch

Current:

ON

göstermelidir.

---

# **KNX Group Objects**

Cihaz application'ları group objects içerir.

Örneğin wall switch:

Group Object 1

Switch

1 bit

Group Object 2

Dimming

4 bit

actuator:

Group Object 1

Switch

1 bit

Group Object 2

Status

1 bit

KNX ETS'te group address'ler group object'lerle ilişkilendirilir ve group object flags, device'in read/write/transmit/update davranışını tanımlar.

Toolkit:

C Communication

R Read

W Write

T Transmit

U Update

I Initialization

flags view sağlamalıdır.

---

# **KNX Datapoint Types — DPT**

KNX raw telegram anlamının doğru çözülmesi için Datapoint Type kritiktir.

KNX Association DPT bilgisinin Group Address veya Group Object configuration'ına bağlanabileceğini ve bus/group monitor'ın bunun üzerinden telegram değerini decode ettiğini açıklar.

Örnekler:

1-bit

Switch / Boolean

2-byte float

Temperature

8-bit percentage

Time

Date

RGB / Colour

Scene

Toolkit:

Raw:

0C 29

DPT:

Temperature

Decoded:

23.45 °C

gösterebilmelidir.

### **DPT bilinmiyorsa**

Toolkit **tahmin ederek kesin değer üretmemelidir**.

Örneğin:

Payload:

00 64

Known Length:

2 bytes

DPT:

Unknown

çıktı:

Raw uint16:

100

Possible:

Cannot determine engineering meaning without DPT

olmalıdır.

KNX Association da project context/DPT yoksa kesin semantic decoding'in her durumda mümkün olmadığını belirtmektedir.

---

# **KNX telegram görünümü**

Toolkit abstraction:

Source Address

Destination Address

Destination Type

Priority

APCI Service

Payload

Checksum

şeklinde alanlara ayırmalıdır.

Application service:

GroupValueRead

GroupValueResponse

GroupValueWrite

özellikle vurgulanmalıdır.

### **Örnek**

Source:

1.1.10

Destination:

2/1/5

Service:

GroupValueWrite

DPT:

Switch

Value:

1

Semantic:

Light ON

---

# **KNX Group Monitor**

Toolkit ETS Group Monitor mantığına yakın:

Timestamp

Source

Destination

Service

DPT

Raw

Decoded

gösterebilmelidir.

KNX ETS Group Monitor group address value'larını seçilen DPT'ye göre decode edebilir ve read/write operation gönderebilir.

---

# **KNX project import**

ETS'ten Group Address XML/CSV export yapılabildiğinden toolkit en az group address import desteği sağlamalıdır. KNX Association resmi ETS dokümantasyonu group address'lerin CSV veya XML olarak export edilebildiğini belirtir.

Import:

Group Address

Name

Description

DPT

Associated Objects

sonrasında:

2/1/5

yerine:

MeetingRoom\_Lighting\_Command

gösterilebilmelidir.

---

# **DALI / DALI-2**

DALI — Digital Addressable Lighting Interface — lighting control için iki telli digital bus'tır.

DALI Alliance'a göre DALI:

* control, configuration ve query işlemleri sağlar,  
* aynı iki tel üzerinde bus power \+ data taşıyabilir,  
* bidirectional communication sunar,  
* individual, group ve broadcast addressing sağlar,  
* scene recall destekler.

DALI-2 bir subnet'te **64 control gear \+ 64 control device address** alanını destekleyebilir. Control gear ayrıca 16 group ve 16 scene gibi temel lighting control yapılarını destekler.

---

# **DALI Network Explorer**

DALI Line 1

Control Gear

├─ Address 0 LED Driver

├─ Address 1 LED Driver

├─ Address 2 Emergency Driver

└─ Address 3 DT8 Driver

Control Devices

├─ Occupancy Sensor

├─ Light Sensor

└─ Push Button

Toolkit:

Short Address

Device Type

Groups

Scenes

Current Level

Status

Lamp Failure

Communication Status

göstermelidir.

---

## **DALI addressing**

Komut:

Individual

Group

Broadcast

olarak sınıflandırılmalıdır.

Örnek:

Target:

Group 5

Command:

OFF

veya:

Target:

Short Address 12

Command:

Recall Scene 3

---

## **DALI commands**

DALI Alliance command'ları genel olarak:

Control

Configuration

Query

kategorilerine ayırır.

Toolkit:

CONTROL

OFF

Go To Scene

Direct Arc Power

CONFIGURATION

Set Fade Time

Store Scene

QUERY

Query Actual Level

Query Lamp Failure

şeklinde semantic isimler göstermelidir.

---

## **DALI Query / Response**

Controller

↓

QUERY ACTUAL LEVEL

↓

Driver

Driver

↓

Response

Toolkit:

Target:

Driver 12

Query:

Actual Level

Response:

178

Normalized:

69.8 %

gibi değer gösterebilir.

---

# **DALI dimming view**

Her lighting device:

Actual Level

Target Level

Fade Time

Fade Rate

Scene

Colour Temperature

Colour where supported

dashboard'ına sahip olmalıdır.

Örneğin:

Driver 5

Level:

60 %

Target:

100 %

Fade:

2.0 s

### **Scene comparison**

Scene 1:

Office Work

Driver 1 → 80 %

Driver 2 → 80 %

Driver 3 → 60 %

Scene 2:

Presentation

Driver 1 → 20 %

Driver 2 → 20 %

Driver 3 → 5 %

---

# **DALI device type / DT**

Toolkit:

DT6

LED control gear

DT8

Colour control

gibi device-type bilgilerini certification/device database mevcutsa semantic olarak gösterebilmelidir.

DALI Alliance certified gateway ürünleri güncel sistemlerde DT6 ve DT8; RGB/RGBW, xy colour ve tunable-white gibi kontrol özelliklerini destekleyen DALI-2 implementations bulunduğunu göstermektedir.

---

# **DALI Fault Monitor**

Lamp Failure

Control Gear Failure

Missing Device

Short Address Conflict

Bus Communication Fault

Query Timeout

Input Device Lost

alarmları tutulmalıdır.

Örneğin:

Address:

18

State:

ONLINE

Lamp Failure:

YES

---

# **M-Bus — Meter-Bus**

M-Bus bina otomasyonunda özellikle:

Heat Meter

Water Meter

Gas Meter

Energy Meter

verilerinin BMS'e alınmasında önemlidir.

M-Bus, EN 13757 standard ailesinin parçasıdır; M-Bus Usergroup güncel ve bağlayıcı teknik referansın EN 13757 olduğunu özellikle belirtmektedir. Wired M-Bus için EN 13757-2 physical/link layer ve EN 13757-3 application layer referans alınır.

M-Bus Usergroup'un web üzerindeki eski ayrıntılı dokümantasyonu bilgilendirici amaçlıdır ve yeni ürün tasarımı için bağlayıcı standard yerine kullanılmamalıdır.

---

## **M-Bus architecture**

BMS / Meter Gateway

      │

   M-Bus Master

      │

\======+=========+========= two-wire bus

      │         │

 Heat Meter   Water Meter

Legacy M-Bus documentation master/slave hiyerarşisini ve two-wire parallel meter network yapısını açıklar.

---

# **M-Bus frame view**

Toolkit common frame sınıflarını:

Single Character

Short Frame

Control Frame

Long Frame

olarak ayırmalıdır.

Long frame conceptual:

Start

Length

Length

Start

Control

Address

CI

Application Data

Checksum

Stop

Exact field constants current EN 13757 database'ına bağlı olmalıdır.

### **Semantic layer**

Control

Address

CI

Data Records

Checksum

tree view oluşturulmalıdır.

---

# **M-Bus meter records**

Application payload:

DIF

DIFE

VIF

VIFE

DATA

gibi data-record structures üzerinden engineering value'lara dönüştürülebilir.

Toolkit:

Energy:

12543.2 kWh

Volume:

354.27 m³

Power:

12.4 kW

Flow:

1.5 m³/h

Supply Temperature:

70.3 °C

Return Temperature:

52.7 °C

gösterebilmelidir.

Legacy M-Bus application documentation CI field'in application-data sequence/type bilgisini taşıdığını açıklar.

---

# **M-Bus addressing**

Toolkit:

Primary Address

Secondary Address

ayrımını sağlamalıdır.

Secondary addressing ile meter identity:

Identification

Manufacturer

Version

Medium

üzerinden seçilebilir. Legacy M-Bus network-layer açıklaması secondary-address selection mekanizmasının primary addressing'i genişlettiğini belirtir.

### **Meter browser**

Primary   Manufacturer   Medium       Serial

1         ...            Heat         ...

2         ...            Water        ...

3         ...            Electricity  ...

---

# **Modbus RTU — Building Automation Layer**

Modbus RTU parser 3.3'teki ortak parser'ı kullanmalıdır. Yeni serial Modbus implementations için Modbus Organization Serial Line Protocol and Implementation Guide V1.02'yi; application function codes için V1.1b3'ü yayımlar.

Burada yeniden protocol yazmak yerine building-specific semantic layer eklenmelidir.

Örneğin:

VFD

Slave 10

Holding Register 40001

Raw 0x05DC

Vendor map:

Name:

Motor Speed

Scale:

1 rpm

Value:

1500 rpm

---

# **Building Modbus Register Map**

CSV/JSON import:

Address

Name

Register Type

Data Type

Length

Byte Order

Word Order

Factor

Offset

Unit

Access

Enum

Bit Definitions

Örneğin:

40001

Supply Air Temperature

int16

Factor 0.1

Unit °C

Raw:

00 EA

Decimal:

234

\[  
23.4°C  
\]

---

# **Modbus HVAC Dashboard**

AHU-1

Supply Air:

16.2 °C

Return Air:

24.3 °C

Fan:

RUNNING

Fan Speed:

62 %

Filter Alarm:

NORMAL

Damper:

37 %

Cooling Valve:

52 %

Bütün değerler register map üzerinden oluşturulmalıdır.

---

# **Poll Optimization**

BMS çoğu Modbus cihazını polling ile okur.

Toolkit:

Poll Group 1

Registers 40001–40010

Period 1 s

Poll Group 2

Registers 40100–40150

Period 10 s

gibi polling plan gösterebilmelidir.

### **Transaction efficiency**

Ardışık register'ları ayrı ayrı okumak yerine block read avantajı analiz edilebilir.

Method A:

10 request

Method B:

1 block request

çıktı:

Bus Traffic Reduction:

...

---

# **Modbus TCP — Building Automation Layer**

Modbus TCP parser yine 3.3'teki common parser'ı kullanmalıdır.

Katman:

Building Device

↓

Modbus PDU

↓

MBAP

↓

TCP

↓

IP

↓

Ethernet

### **Device browser**

192.168.10.10

Chiller

192.168.10.11

Boiler

192.168.10.12

Power Meter

Her cihaz:

Connection State

Unit ID

Response Time

Function Codes

Errors

Register Map

göstermelidir.

Modbus Organization Modbus TCP için ayrı messaging implementation guide ve conformance/diagnostic tools sürdürmektedir.

---

# **Modbus TCP connection analyzer**

TCP Connect

↓

Read Holding

↓

Response

↓

Read Input

↓

Response

↓

Idle

ölçümler:

TCP RTT

Modbus Response

Request Rate

Timeout

Reconnect

Transaction ID Errors

### **Transaction ID**

Concurrent requests:

TID 100 → Temperature

TID 101 → Pressure

TID 102 → Status

response matching transaction identifier ile yapılmalıdır.

---

# **LonWorks / LON — Temel Mesaj Görüntüleme**

LonWorks/LON bina otomasyonunda uzun süredir kullanılan distributed control networking teknolojisidir.

LonMark, LON protocol stack'in ISO/IEC 14908 serisi altında standardize edildiğini belirtir. Protocol stack ISO/IEC 14908-1; twisted pair ISO/IEC 14908-2; powerline ISO/IEC 14908-3; IP tunnelling ISO/IEC 14908-4 ile ilişkilidir.

İlk toolkit sürümünde full LonWorks stack implementation zorunlu olmamalıdır.

Ama:

Message

Source

Destination

Network Variable

Service

Payload

Timing

temel görünümü sağlanmalıdır.

---

# **LON Network Variables**

LonWorks application integration'da network variables çok önemlidir.

Toolkit semantic model:

Device

├─ Network Variable Input

├─ Network Variable Output

└─ Configuration Property

LonMark technical resources functional profiles, network variable types ve configuration-property types için standardized resource files sağlar.

### **SNVT**

Standard Network Variable Types biliniyorsa:

SNVT\_temp

SNVT\_switch

SNVT\_hvac\_mode

...

gibi semantic decode yapılabilir.

Exact current SNVT/resource definitions LonMark resource file'dan yüklenmelidir.

---

# **XIF Import**

LonMark, device interface tanımı için `.XIF` file specification/guide yayımlar.

Toolkit:

Import XIF

↓

Device Interface

↓

Network Variables

↓

Configuration Properties

oluşturabilir.

Device:

Fan Coil Controller

NV Inputs:

Setpoint

Occupancy

NV Outputs:

Temperature

Fan State

Alarm

şeklinde gösterilebilir.

---

# **LonWorks Gateway Analyzer**

Örneğin HVAC gateway:

BACnet

↓

Gateway

↓

LonWorks

↓

Air Conditioner

LonMark product database'deki gerçek gateway örnekleri HVAC unit state, fan speed, setpoint ve fault bilgilerini LonTalk tarafında BMS'e taşıyabilmektedir.

Toolkit:

BACnet Object

↕

LON Network Variable

mapping gösterebilmelidir.

---

# **DMX512**

DMX512 bina otomasyonunun klasik HVAC tarafı değil; **architectural lighting, façade lighting, auditorium, theatre, event hall ve decorative lighting** entegrasyonu açısından değerlidir.

Current DMX512-A standard ailesi ANSI E1.11 altında ESTA tarafından sürdürülür. ESTA'nın güncel yayın kataloğu Nisan 2024 tarihli editorial revision'ı current published E1.11 olarak listeler.

DMX512:

Controller

↓

DMX Universe

↓

Fixture 1

Fixture 2

Fixture 3

...

şeklinde mostly controller-to-device stream mantığına sahiptir.

---

# **DMX Universe**

Bir klasik DMX universe:

Start Code

\+

Up to 512 data slots

mantığı ile çalışır.

ESTA'nın E1.11 açıklamalarında 512 slot kullanılan tam packet için maksimum update rate'in yaklaşık 44 Hz olduğu belirtilmektedir; slot sayısı azaldıkça frame daha hızlı tekrar edebilir.

Toolkit:

Universe

1

Slots:

512

Refresh:

44 Hz

gösterebilmelidir.

---

# **DMX signal/frame**

Logical timeline:

BREAK

↓

Mark After Break

↓

START CODE

↓

Slot 1

Slot 2

Slot 3

...

Slot N

↓

Next BREAK

Toolkit pulse/serial capture varsa:

Break Duration

MAB Duration

Start Code

Slot Count

Frame Duration

Refresh Rate

ölçmelidir.

---

## **DMX Slot**

Her slot:

8-bit value

0 ... 255

olarak görüntülenmelidir.

Örneğin RGB fixture:

Fixture Address:

1

Slot 1:

Red \= 255

Slot 2:

Green \= 128

Slot 3:

Blue \= 0

Slot 4:

Dimmer \= 200

UI:

RGB:

255 / 128 / 0

---

# **Fixture Personality**

Toolkit fixture profile tanımlamasına izin vermelidir:

Fixture:

RGBW Wash

Start Address:

101

Footprint:

8 channels

101 Dimmer

102 Red

103 Green

104 Blue

105 White

106 Strobe

107 Macro

108 Speed

Ham slot'lar:

C8 FF 40 00 ...

yerine semantic değerler gösterilebilir.

---

# **DMX 16-bit parameter**

Bazı fixture parameters iki slot kullanır:

Coarse

Fine

Örneğin:

\[  
Value\_{16}=Coarse\\times256+Fine  
\]

Coarse:

128

Fine:

64

\[  
Value=32832  
\]

Normalize:

\[  
Percent=  
\\frac{32832}{65535}\\times100  
\]

yaklaşık `%50.1`.

Toolkit bunu özellikle pan/tilt gibi channels için desteklemelidir.

---

# **Start Code**

Standart lighting data genellikle standard start code kullanır; Alternate START Codes de ANSI E1.11 ekosisteminde kayıtlıdır. ESTA public Alternate Start Code database tutmaktadır.

Toolkit:

Start Code:

0x00

Type:

DMX Level Data

veya:

Alternate Start Code:

...

gösterebilmelidir.

---

# **Art-Net**

Art-Net 4, DMX512 ve RDM benzeri lighting data'nın Ethernet network üzerinden taşınması için geliştirilmiş royalty-free protocol'dür. Art-Net resmi sitesi Art-Net 4'ü current specification olarak yayımlar ve protokolün standard networking technology kullanarak çok sayıda DMX universe taşımasını hedeflediğini açıklar.

Art-Net UDP tabanlı lightweight packet yapısı kullanır.

Katman:

Lighting Application

↓

Art-Net

↓

UDP

↓

IP

↓

Ethernet

---

# **Art-Net packet**

Toolkit common Art-Net header:

ID

OpCode

Protocol Version

Packet-specific fields

Payload

olarak ayırmalıdır.

Exact field offsets current Art-Net 4 specification'dan uygulanmalıdır.

### **OpCode**

Toolkit:

ArtPoll

ArtPollReply

ArtDmx

ArtSync

ArtTimeCode

...

gibi packet type'ları semantic isimle göstermelidir.

---

# **ArtPoll / ArtPollReply**

Discovery:

Controller

↓

ArtPoll

↓

Network

Nodes

↓

ArtPollReply

Toolkit node explorer:

Node

IP

Short Name

Long Name

Ports

Universes

Status

Firmware

OEM

oluşturmalıdır.

---

# **ArtDmx**

DMX universe data:

ArtDmx

├─ Sequence

├─ Physical

├─ Port-Address / Universe

├─ Length

└─ DMX Data

Exact field layout Art-Net 4 official specification'dan gelmelidir.

Toolkit:

Universe:

10

Sequence:

52

Slots:

512

Source:

192.168.1.20

Rate:

40 Hz

göstermelidir.

---

# **Art-Net Universe View**

Universe 1

→ House Lighting

Universe 2

→ Lobby

Universe 3

→ Façade

Universe 10

→ Stage

Her universe:

Source

Sequence

Slot Count

FPS

Last Packet

değerine sahip olmalıdır.

---

# **Art-Net sequence analysis**

Sequence:

20

21

22

24

ise:

Expected:

23

Possible Lost Packet:

1

uyarısı oluşturulabilir.

Protocol configuration'da sequence kullanımının disabled/optional olduğu durumlar ayrıca hesaba katılmalıdır.

---

# **ArtSync**

Birden fazla universe aynı lighting frame'e aitse:

Universe 1

Universe 2

Universe 3

↓

ArtSync

şeklinde senkron output yapılabilir.

Toolkit:

Universe packets received

Waiting for sync

↓

ArtSync

↓

Output cycle complete

timeline oluşturmalıdır.

---

# **Art-Net / DMX Gateway**

Ethernet

Art-Net

↓

Node

↓

Physical DMX Port 1

Physical DMX Port 2

Toolkit:

Art-Net Universe

↓

Gateway Port

↓

DMX Universe

mapping göstermelidir.

Art-Net 4 özellikle çok-portlu gateways ve independent universe assignment gibi özellikleri geliştirmiştir.

---

# **sACN — Streaming ACN / ANSI E1.31**

sACN, DMX512-A data'nın IP network üzerinden streaming taşınması için ANSI E1.31 standardında tanımlanan protocol'dür.

**Güncel published standard ANSI E1.31-2025'tir ve 5 Ocak 2026'da yayımlanmıştır.** Bu revision IPv4 yanında IPv6 desteği eklemiştir.

sACN:

DMX Data

↓

E1.31

↓

UDP/IP

↓

Ethernet

şeklinde ele alınmalıdır.

---

# **sACN packet structure**

Toolkit packet'i conceptual katmanlara ayırmalıdır:

Root Layer

↓

Framing Layer

↓

DMP Layer

↓

DMX Slot Data

Field tree:

Root

├─ CID

└─ Protocol Identifier

Framing

├─ Source Name

├─ Priority

├─ Sequence

├─ Universe

└─ Options

DMP

└─ DMX Values

Exact byte layout ANSI E1.31-2025 specification'dan uygulanmalıdır.

---

# **CID**

Her sACN source:

Component Identifier

ile tanımlanabilir.

Toolkit yalnız IP address üzerinden source identity belirlememelidir.

Source Name:

Lighting Console 1

CID:

...

IP:

192.168.1.50

şeklinde ayrı gösterilmelidir.

IP değişse bile CID aynı source'u belirleyebilir.

---

# **sACN Universe**

Her packet:

Universe

identifier'ına sahiptir.

Universe monitor:

Universe 1

Source A

Priority 100

Universe 2

Source A

Priority 100

Universe 10

Source B

Priority 120

---

# **sACN Priority**

sACN'in Art-Net/klasik DMX'e göre önemli özelliklerinden biri source priority mekanizmasıdır.

Toolkit:

Universe:

1

Source A:

Priority 100

Source B:

Priority 120

Selected:

Source B

göstermelidir.

Priority change:

Source B disappears

↓

Source A becomes active

timeline'a işlenmelidir.

---

# **sACN Sequence**

250

251

252

254

görüldüğünde:

Missing:

253

tespit edilebilir.

Wrap:

254

255

0

1

valid olmalıdır.

Toolkit packet-loss istatistiğini **source \+ universe** bazında tutmalıdır.

---

# **sACN Source Merge**

Bir universe için birden fazla source varsa:

Universe 1

Console A

Priority 100

Console B

Priority 100

merge davranışı configuration/profile'a bağlı olabilir.

Toolkit:

Multiple Active Sources

uyarısı göstermeli ve observed merge/result'u ayrı analiz etmelidir.

---

# **sACN Universe Synchronization**

E1.31 universe synchronization, birden fazla universe'a ait data'nın aynı output timing noktasında uygulanmasını sağlar. ESTA bunu özellikle multi-universe display'lerde tearing veya senkronizasyon problemlerini önlemek için tanımlar.

Toolkit:

Universe 1 Data

Universe 2 Data

Universe 3 Data

↓

Synchronization Packet

↓

Output

timeline'ı sağlamalıdır.

---

# **Art-Net ve sACN Karşılaştırma Görünümü**

Art-Net 4 ve sACN aynı amaçların bazılarını paylaşsa da aynı protocol değildir.

Art-Net resmi dokümantasyonu Art-Net 4'ün discovery, management ve RDM işlevlerini sağlayabildiğini; ayrıca canlı data için sACN ile birlikte kullanılabilecek şekilde tasarlandığını belirtir.

Toolkit:

                    Art-Net        sACN

Transport            UDP            UDP

DMX Streaming        Yes            Yes

Discovery            ArtPoll        Different model

Management           Rich           Limited focus

RDM support          Art-Net tools  Not core E1.31 purpose

Priority             Different      Native source priority

Universe Sync        ArtSync        E1.31 Sync

gibi comparison panel sağlayabilir.

---

# **KNX ↔ DALI Gateway Analyzer**

Gerçek bina projelerinde çok önemli entegrasyon:

KNX

↓

KNX-DALI Gateway

↓

DALI

↓

LED Drivers

DALI Alliance certified products arasında günümüzde de KNX–DALI-2 gateways yaygındır ve 64 gear/16 group gibi mappings kullanılır.

Toolkit:

KNX Group Address:

2/1/10

Command:

50 %

↓ Gateway

DALI:

Group 4

Command:

Level 50 %

correlation gösterebilmelidir.

### **Gateway latency**

KNX Telegram:

t \= 0

DALI Command:

t \= 18 ms

Gateway Latency:

18 ms

---

# **BACnet ↔ Modbus Gateway Analyzer**

Modbus Register

↓

Gateway

↓

BACnet Object

Örnek:

Modbus

Register:

40001

Raw:

234

Scale:

0.1

Value:

23.4 °C

↓

BACnet

Object:

AI-12

Present\_Value:

23.4 °C

Toolkit:

Value Match:

PASS

Latency:

54 ms

gösterebilmelidir.

### **Fault**

Modbus device timeout:

Modbus:

TIMEOUT

BACnet tarafında:

Reliability:

Communication Failure

Status Flags:

Fault

gibi mapping varsa correlation yapılabilir.

---

# **BACnet ↔ KNX Gateway**

KNX Group Object

↓

Gateway

↓

BACnet Object

Örneğin:

KNX:

Room Temp

DPT temperature

23.2 °C

BACnet:

Analog Input

23.2 °C

### **Common error**

KNX DPT:

°C

Gateway configuration:

interprets raw incorrectly

BACnet result:

234.0 °C

Toolkit:

POSSIBLE SCALING / DPT MAPPING ERROR

üretebilir.

---

# **Bina Otomasyonu Point Database**

Toolkit bütün protokolleri ortak point modeline çevirebilmelidir.

Point

├─ Name

├─ System

├─ Equipment

├─ Protocol

├─ Address

├─ Raw Value

├─ Engineering Value

├─ Unit

├─ Quality

├─ Timestamp

├─ Writable

├─ Priority

└─ Alarm

Örnek:

AHU01\_SupplyTemp

Protocol:

BACnet

Address:

AI:12

Value:

16.4 °C

Quality:

GOOD

Başka:

Room101\_Light

Protocol:

KNX

Address:

2/1/5

Value:

ON

---

# **Point Freshness Analyzer**

Her building point:

Last Update

Expected Update

Age

Freshness

bilgisine sahip olmalıdır.

\[  
Age=t\_{now}-t\_{lastUpdate}  
\]

Örnek:

Room Temperature:

Age 1.2 s

Fresh

AHU Fan Status:

Age 35 s

STALE

Power Meter:

Never received

MISSING

---

# **Polling / Event / COV Ayrımı**

Building protocols üç farklı update modeline sahip olabilir:

Polling

Modbus

Event / Group Telegram

KNX

COV/Event

BACnet

Cyclic Stream

DMX / sACN / Art-Net

Toolkit kullanıcıya data-source davranışını göstermelidir.

Örneğin:

Temperature

Protocol:

Modbus

Update Model:

Polling

Poll:

5 s

vs:

Temperature

Protocol:

BACnet

Update:

COV

---

# **Building Network Traffic Matrix**

Protocol      Messages/s     Data Rate      Errors

BACnet/IP     120            ...            0

BACnet MS/TP  45             ...            2

KNX           18             ...            0

Modbus RTU    32             ...            1

sACN          1760           ...            0

yüksek lighting traffic ile HVAC traffic ayrı görülebilmelidir.

---

# **Equipment Dashboard**

Örneğin AHU:

AHU-01

BACnet Device:

1001

Supply Temp:

16.4 °C

Return Temp:

24.8 °C

Fan:

RUNNING

Speed:

62 %

Filter:

NORMAL

Damper:

35 %

Cooling Valve:

48 %

Heating Valve:

0 %

Alarm:

NONE

Farklı noktalar farklı protokollerden bile gelebilir:

Temperature:

BACnet

VFD:

Modbus

Energy:

M-Bus

ama kullanıcı equipment dashboard'da bunu tek sistem olarak görmelidir.

---

# **Alarm Correlation**

Örnek:

12:30:10

Modbus VFD stops responding

12:30:11

BACnet AHU Fan Status → Fault

12:30:12

BMS alarm:

Supply Fan Failure

12:30:13

Room temperature begins increasing

Toolkit:

Possible Root Cause:

VFD communication/device failure

Consequences:

• Fan fault

• AHU alarm

• Temperature deviation

şeklinde correlate edebilmelidir.

---

# **Lighting Network Correlation**

Örnek:

KNX Wall Switch

↓

KNX Telegram

↓

DALI Gateway

↓

DALI Group Command

↓

Driver output changes

veya:

BMS

↓

BACnet Lighting Object

↓

Lighting Gateway

↓

sACN

↓

Architectural Fixture

aynı timeline üzerinde incelenebilmelidir.

---

# **Ortak Bina Otomasyonu Hata Modeli**

DEVICE\_OFFLINE

ADDRESS\_CONFLICT

DUPLICATE\_MAC

TOKEN\_LOST

TOKEN\_ROTATION\_HIGH

CRC\_ERROR

CHECKSUM\_ERROR

TIMEOUT

RETRY

OBJECT\_NOT\_FOUND

PROPERTY\_NOT\_FOUND

WRITE\_DENIED

INVALID\_DPT

DPT\_MISMATCH

GROUP\_ADDRESS\_UNKNOWN

DALI\_DEVICE\_MISSING

DALI\_LAMP\_FAILURE

METER\_OFFLINE

REGISTER\_TIMEOUT

REGISTER\_SCALING\_ERROR

LON\_VARIABLE\_UNKNOWN

DMX\_BREAK\_ERROR

DMX\_SLOT\_MISSING

ARTNET\_SEQUENCE\_GAP

SACN\_SEQUENCE\_GAP

SACN\_SOURCE\_CONFLICT

STALE\_VALUE

GATEWAY\_VALUE\_MISMATCH

GATEWAY\_MAPPING\_MISSING

Her error:

Time

Protocol

Device

Point

Severity

Raw Frame

Expected

Received

Likely Cause

ile gösterilmelidir.

---

# **Ortak Building Layer Drill-Down**

Kullanıcı herhangi bir BMS point'ine tıklayarak ham haberleşmeye kadar inebilmelidir.

## **BACnet**

Room Temperature

23.4 °C

↓

Present\_Value

↓

Analog Input 12

↓

ReadProperty / COV

↓

BACnet APDU

↓

BACnet/IP

↓

UDP

↓

Ethernet

## **KNX**

Meeting Room Light

ON

↓

Group Address 2/1/5

↓

DPT Switch

↓

GroupValueWrite

↓

KNX Telegram

## **DALI**

Light Level

50 %

↓

DALI Driver 12

↓

Direct Arc / Control Command

↓

DALI Bus

## **Modbus**

Fan Speed

1500 rpm

↓

Register 40001

↓

0x05DC

↓

Function 03 Response

↓

Modbus RTU

↓

RS-485

## **M-Bus**

Heat Energy

12,543 kWh

↓

Value Record

↓

DIF / VIF

↓

M-Bus Long Frame

↓

Meter

## **DMX / Art-Net / sACN**

Lobby Light Red

75 %

↓

DMX Slot 101

↓

Universe 4

↓

sACN / Art-Net

↓

UDP/IP

↓

Ethernet

Bu yapı sayesinde **3.7 bina otomasyonu bölümü**, yalnız BACnet veya Modbus frame gösteren ayrı araçlardan oluşmamalıdır. Amaç; **oda sensöründen HVAC controller'a, enerji sayacından BMS'e, KNX butondan DALI driver'a ve Ethernet lighting controller'dan DMX fixture'a kadar binadaki kontrol verisinin hangi protokolden, hangi address/object/register üzerinden geçtiğini ve fiziksel sistemde neye karşılık geldiğini takip edebilen bütünleşik bir Building Automation Communication Analyzer** oluşturmaktır.

## **3.8 Ağ ve Ethernet protokolleri**

* Ethernet II  
* IEEE 802.3  
* VLAN 802.1Q  
* ARP  
* IPv4  
* IPv6  
* ICMP  
* ICMPv6  
* UDP  
* TCP  
* DHCP  
* DNS  
* NTP  
* SNMP için temel paket analizi  
* HTTP için temel mesaj görüntüleme  
* WebSocket frame  
* MQTT  
* MQTT-SN  
* CoAP  
* RTP  
* RTCP  
* PTP  
* TFTP  
* FTP kontrol mesajları  
* Telnet  
* Syslog  
* LLDP  
* mDNS

Ağ ve Ethernet protokolleri bölümü yalnızca PCAP içerisindeki paketleri satır satır listeleyen klasik bir packet viewer olmamalıdır. Platform; gömülü Linux geliştiricileri, embedded network yazılımcıları, otomasyon ve entegrasyon mühendisleri, IoT geliştiricileri, test mühendisleri ve sistem entegratörleri için **Ethernet frame seviyesinden application message seviyesine kadar aynı paketi katman katman açıklayabilmelidir**.

Temel analiz zinciri:

Physical / Capture

        ↓

Ethernet

        ↓

VLAN

        ↓

ARP / IPv4 / IPv6

        ↓

ICMP / UDP / TCP

        ↓

Application Protocol

        ↓

Application Data

Örneğin bir MQTT mesajında:

Sensor Value

25.4 °C

   ↓

MQTT PUBLISH

   ↓

Topic:

factory/line1/temp

   ↓

TCP Stream

   ↓

IPv4 Packet

   ↓

Ethernet Frame

görünümü sağlanmalıdır.

Her packet için ortak olarak:

Timestamp

Interface

Direction

Frame Number

Frame Length

Captured Length

Source MAC

Destination MAC

VLAN

Source IP

Destination IP

Protocol

Source Port

Destination Port

Payload Length

Checksum State

Flow

Conversation

Latency

Sequence

Errors

alanları bulunmalıdır.

---

# **Ethernet II**

Ethernet II, bugün IP tabanlı ağlarda en sık görülen Ethernet MAC frame yorumlarından biridir.

Temel frame:

Preamble

SFD

Destination MAC

Source MAC

EtherType

Payload

FCS

Mantıksal görünüm:

| DST MAC | SRC MAC | TYPE | PAYLOAD | FCS |

| 6 byte  | 6 byte  | 2 B  | ...     | 4 B |

Wire üzerinde ayrıca:

7-byte Preamble

1-byte Start Frame Delimiter

frame öncesinde bulunur.

IEEE 802.3-2022 güncel yayımlanmış temel Ethernet standardıdır ve ortak MAC yapısı üzerinden 1 Mbit/s'den 400 Gbit/s'ye kadar çok sayıda PHY sınıfını kapsar. 2026 itibarıyla 802.3 çalışma grubu standardı yeni PHY ve hız amendment'larıyla geliştirmeye devam etmektedir.

## **MAC address**

MAC address:

48 bit

\=

6 byte

örnek:

00:11:22:33:44:55

Toolkit aynı MAC'i:

HEX:

00 11 22 33 44 55

Text:

00:11:22:33:44:55

Binary:

00000000 00010001 ...

gösterebilmelidir.

## **Destination türü**

Destination MAC:

Unicast

Multicast

Broadcast

olarak sınıflandırılmalıdır.

Broadcast:

FF:FF:FF:FF:FF:FF

Toolkit:

Destination:

Broadcast

şeklinde semantic çıktı üretmelidir.

---

## **EtherType**

EtherType payload içindeki üst protokolü tanımlar.

Örnek:

0x0800 → IPv4

0x0806 → ARP

0x86DD → IPv6

0x8100 → 802.1Q tagged frame

Toolkit:

EtherType:

0x0800

Protocol:

IPv4

şeklinde recursive parser'a geçmelidir.

## **Frame örneği**

FF FF FF FF FF FF

00 11 22 33 44 55

08 06

...

Decoder:

Destination:

FF:FF:FF:FF:FF:FF

Broadcast

Source:

00:11:22:33:44:55

EtherType:

0x0806

Payload:

ARP

---

## **Ethernet FCS**

Ethernet frame sonunda Frame Check Sequence bulunur.

Toolkit:

FCS Present:

YES / NO / Unknown

ayrımı yapmalıdır.

Çünkü birçok NIC/OS packet capture sırasında FCS alanını kullanıcıya aktarmadan önce kaldırır.

Dolayısıyla capture'da FCS görünmüyorsa:

FCS missing

yerine:

FCS not captured

gösterilmesi daha doğru olabilir.

FCS mevcutsa:

Received FCS

Calculated CRC-32

PASS / FAIL

gösterilmelidir.

---

# **Ethernet Frame Boyutu ve Throughput**

Normal Ethernet frame'in MAC seviyesindeki uzunluğu:

L\_{header}  
\+  
L\_{payload}  
\+  
L\_{FCS}  
\]

Ethernet II header:

\[  
L\_{header}=14\\ byte  
\]

FCS:

\[  
4\\ byte  
\]

Minimum data alanı gerekirse padding ile büyütülür.

Network throughput hesaplarında yalnız application payload düşünülmemelidir.

Wire-time hesabında conceptual:

Preamble \+ SFD

Ethernet Frame

Inter-Frame Gap

de hesaba katılabilir.

Örneğin analyzer iki farklı efficiency gösterebilir:

MAC Efficiency

ve:

Wire Efficiency

Böylece küçük UDP packet'lerinin neden beklenenden daha fazla network bandwidth tükettiği görülebilir.

---

# **IEEE 802.3**

IEEE 802.3 yalnız bir frame biçimi değil Ethernet'in MAC ve çok sayıda PHY standardını içeren geniş standard ailesidir. Güncel temel published revision IEEE 802.3-2022'dir.

Ethernet II ve IEEE 802.3 frame yorumları arasındaki önemli farklardan biri MAC header'daki iki-byte alanın yorumudur.

Ethernet II:

Destination

Source

EtherType

IEEE 802.3 length interpretation:

Destination

Source

Length

şeklinde olabilir.

Toolkit bu alanı:

Value

Interpretation

şeklinde göstermelidir.

Örnek:

Field:

0x0800

Interpretation:

EtherType IPv4

vs:

Field:

0x002E

Interpretation:

IEEE 802.3 Payload Length \= 46 bytes

802.3 frame üstünde LLC/SNAP gibi üst katmanlar bulunuyorsa parser bunlara zincirleme geçebilmelidir.

---

# **Ethernet Frame Analyzer**

Her Ethernet frame:

Frame 245

Timestamp:

12:14:05.123456

Captured:

74 bytes

Wire:

74 bytes

Destination:

...

Source:

...

VLAN:

None

Upper Protocol:

IPv4

FCS:

Not captured

şeklinde özetlenmelidir.

Ek istatistik:

Frames/s

Bytes/s

Average Frame Size

Minimum Frame

Maximum Frame

Broadcast %

Multicast %

Unicast %

FCS Errors

---

# **VLAN — IEEE 802.1Q**

IEEE 802.1Q bridged networks ve VLAN operasyonlarını standardize eder. 2026 itibarıyla published temel revision **IEEE 802.1Q-2022**'dir; bunun yeni maintenance revision çalışması devam etmektedir.

VLAN tag normal Ethernet header'a dört byte ekler.

Conceptual:

Destination MAC

Source MAC

TPID

TCI

EtherType

Payload

FCS

TCI:

15             13 12 11                 0

\+----------------+--+--------------------+

|      PCP       |DEI|       VID          |

\+----------------+--+--------------------+

     3 bit       1      12 bit

## **PCP**

Priority Code Point:

3 bit

0 ... 7

trafik priority/class bilgisi taşır.

Toolkit:

PCP:

5

Priority Class:

Configured QoS mapping

göstermelidir.

PCP semantic ismini doğrudan sabitlemek yerine switch/project QoS mapping'i kullanılabilmelidir.

## **DEI**

Drop Eligible Indicator:

0 / 1

network congestion durumlarında traffic treatment için kullanılabilir.

## **VLAN ID**

12 bit

VLAN identifier'dır.

Toolkit:

VLAN ID:

100

Name:

Automation

gibi kullanıcı tanımlı VLAN database ile eşleştirebilmelidir.

---

## **Tagged / Untagged traffic**

Port bazında:

Tagged Frames

Untagged Frames

oranı tutulmalıdır.

Örnek:

Interface:

eth0

Expected VLAN:

20

Observed:

VLAN 30

uyarı:

UNEXPECTED VLAN

---

## **VLAN stacking**

Parser yalnız tek VLAN tag varsaymamalıdır.

Stacked tags:

Ethernet

↓

Outer VLAN

↓

Inner VLAN

↓

IP

gibi recursive decode edilebilmelidir.

Toolkit:

Tag \#1

VID 100

Tag \#2

VID 20

göstermelidir.

---

# **ARP — Address Resolution Protocol**

ARP IPv4 address ile local-network hardware/MAC address arasında mapping yapmak için kullanılır. RFC 826 bu address-resolution mekanizmasını tanımlar.

Tipik kullanım:

Host A

IP 192.168.1.10

wants:

192.168.1.20

Question:

Who has 192.168.1.20?

ARP Request:

Broadcast

FF:FF:FF:FF:FF:FF

ARP Reply:

192.168.1.20

is at

AA:BB:CC:DD:EE:FF

---

## **ARP frame yapısı**

Hardware Type

Protocol Type

Hardware Length

Protocol Length

Operation

Sender Hardware Address

Sender Protocol Address

Target Hardware Address

Target Protocol Address

Örnek:

Operation:

1

Interpretation:

Request

ve:

Operation:

2

Interpretation:

Reply

---

## **ARP Request Decoder**

Sender MAC:

00:11:22:33:44:55

Sender IP:

192.168.1.10

Target MAC:

00:00:00:00:00:00

Target IP:

192.168.1.20

Operation:

REQUEST

Semantic çıktı:

Who has 192.168.1.20?

Tell 192.168.1.10

---

## **ARP table**

Toolkit capture'dan geçici mapping tablosu oluşturmalıdır:

IP                MAC

192.168.1.1       00:AA:...

192.168.1.10      00:11:...

192.168.1.20      AA:BB:...

### **Conflict detector**

Aynı IP:

192.168.1.20

iki MAC'ten görülürse:

IP ADDRESS CONFLICT

MAC A:

...

MAC B:

...

uyarısı oluşturulabilir.

Bu tek başına saldırı kanıtı olarak gösterilmemeli; static change, redundancy veya configuration değişikliği de mümkün olabilir.

---

# **IPv4**

IPv4 connectionless datagram network-layer protocol'dür. RFC 791 IPv4'ün addressing ve fragmentation temel mekanizmalarını tanımlar; reliability, sequencing, retransmission ve flow-control sağlamadığını açıkça belirtir.

IPv4 header:

Version

IHL

DSCP / ECN

Total Length

Identification

Flags

Fragment Offset

TTL

Protocol

Header Checksum

Source Address

Destination Address

Options

Payload

---

## **Version**

4 bit

Value:

4

olmalıdır.

Toolkit:

Version:

4

Status:

IPv4

göstermelidir.

---

## **IHL — Internet Header Length**

IHL:

4 bit

ve 32-bit word sayısını ifade eder.

\[  
HeaderLength=IHL\\times4\\ bytes  
\]

Örneğin:

IHL:

5

ise:

\[  
5\\times4=20\\ bytes  
\]

header vardır.

IHL:

15

ise maksimum:

\[  
60\\ bytes  
\]

olabilir.

---

# **IPv4 Total Length**

Total Length:

IPv4 Header

\+

IPv4 Payload

toplamıdır.

Örnek:

Total Length:

60

Header:

20

Payload:

\[  
60-20=40\\ bytes  
\]

Toolkit:

IPv4 Header:

20 B

Payload:

40 B

göstermelidir.

---

# **IPv4 TTL**

TTL her forwarding hop'ta azaltılır.

RFC 791 TTL'nin datagram lifetime'ını sınırlayan mekanizmalardan biri olduğunu tanımlar.

Toolkit:

TTL:

64

göstermelidir.

Flow karşılaştırmasında:

Packet 1 TTL:

64

Packet observed after router:

63

gibi hop davranışı gösterilebilir.

TTL sıfıra ulaştığında packet drop edilir ve ICMP Time Exceeded oluşturulabilir.

---

# **IPv4 Protocol Field**

Üst protokol:

1  → ICMP

6  → TCP

17 → UDP

gibi protocol-number database üzerinden isimlendirilmelidir.

Toolkit:

Protocol:

17

Decoded:

UDP

sonra UDP parser'a geçmelidir.

---

# **IPv4 Header Checksum**

IPv4 yalnız header için checksum taşır.

Toolkit:

Received:

0x...

Calculated:

0x...

Status:

PASS / FAIL

göstermelidir.

Router TTL alanını değiştirdiğinde checksum da uygun şekilde güncellenir.

---

# **IPv4 Fragmentation**

RFC 791 router/host seviyesinde IPv4 fragmentation ve reassembly mekanizmasını tanımlar. Identification, More Fragments ve Fragment Offset alanları bir datagramın parçalarını yeniden birleştirmek için kullanılır.

Önemli fields:

Identification

DF

MF

Fragment Offset

Fragment offset:

8-byte units

üzerinden yorumlanır.

Gerçek byte offset:

\[  
Offset\_{bytes}=FragmentOffset\\times8  
\]

Örnek:

Fragment Offset:

185

\[  
Offset=1480\\ bytes  
\]

---

## **Fragment Reassembly View**

Datagram ID:

0x1234

Fragment 1

Offset 0

MF=1

Payload 1480 B

Fragment 2

Offset 1480

MF=1

Payload 1480 B

Fragment 3

Offset 2960

MF=0

Payload 200 B

Toolkit:

Reassembled:

3160 bytes

Fragments:

3

Missing:

0

göstermelidir.

### **Error**

Missing Fragment

Overlap

Duplicate Fragment

Timeout

ayrı işaretlenmelidir.

---

# **IPv6**

IPv6 RFC 8200 ile standardize edilen, IPv4'ün devamı niteliğindeki Internet Protocol sürümüdür. IPv6 address uzunluğu 128 bittir ve common base header IPv4'e kıyasla sadeleştirilmiştir.

IPv6 base header:

Version

Traffic Class

Flow Label

Payload Length

Next Header

Hop Limit

Source Address

Destination Address

Base header:

40 byte

sabit uzunluktadır.

---

## **IPv6 address**

128 bit

örnek:

2001:db8:1234:5678::10

Toolkit:

Full

Compressed

Prefix

Host Portion

Address Type

gösterebilmelidir.

---

# **IPv6 Header**

Version:

6

Traffic Class:

...

Flow Label:

...

Payload Length:

...

Next Header:

...

Hop Limit:

...

### **Flow Label**

20-bit Flow Label traffic flow identification için kullanılabilir.

Toolkit flow-table'da:

IPv6 Flow Label

kolonu sağlayabilir.

---

# **IPv6 Extension Headers**

IPv6 optional bilgileri base header büyütmek yerine extension-header chain içerisinde taşır. RFC 8200 Hop-by-Hop, Routing, Fragment, Destination Options gibi extension headers tanımlar.

Decoder:

IPv6

↓

Hop-by-Hop

↓

Routing

↓

Fragment

↓

UDP

gibi recursive chain göstermelidir.

### **Loop protection**

Malformed packet:

Extension A

→ Extension B

→ malformed length

parser'ı infinite loop'a sokmamalıdır.

---

# **IPv6 Fragmentation**

IPv6'da router'lar normal forwarding sırasında IPv4 tarzında packet fragmentation yapmaz. Fragmentation gerektiğinde source node Fragment extension header kullanır. RFC 8200 bu modeli tanımlar.

Toolkit IPv4 ve IPv6 fragmentation farkını özellikle açıklamalıdır:

IPv4:

Routers may fragment

IPv6:

Source performs fragmentation

---

# **IPv6 Header Checksum**

IPv6 base header'da IPv4 benzeri header checksum bulunmaz.

Bu nedenle:

IPv6 Header Checksum:

N/A

gösterilmelidir.

TCP/UDP/ICMPv6 gibi üst protokollerin integrity mekanizmaları kullanılabilir.

---

# **ICMP**

ICMP IPv4 network control ve error reporting için kullanılır. RFC 792 ICMP'nin IP'nin ayrılmaz bir parçası olduğunu ve packet-processing hataları ile diagnostic mesajlar için kullanıldığını tanımlar.

Genel:

Type

Code

Checksum

Message-Specific Data

---

# **ICMP Echo**

Ping:

Host A

↓

Echo Request

↓

Host B

Host B

↓

Echo Reply

↓

Host A

RFC 792:

Echo Request:

Type 8

Echo Reply:

Type 0

tanımlar.

Frame:

Type

Code

Checksum

Identifier

Sequence Number

Data

Toolkit:

Identifier:

1234

Sequence:

42

Request:

12:10:00.100

Reply:

12:10:00.104

RTT:

4 ms

hesaplamalıdır.

---

# **ICMP Destination Unreachable**

RFC 792 Type 3 mesajını Destination Unreachable olarak tanımlar ve Code alanı net/host/protocol/port unreachable gibi nedeni detaylandırır.

Toolkit:

ICMP Destination Unreachable

Code:

3

Interpretation:

Port Unreachable

Original Packet:

UDP

192.168.1.20:55000

→

192.168.1.30:5000

gibi original datagram correlation yapmalıdır.

---

# **ICMP Time Exceeded**

Type:

11

traceroute gibi mekanizmaların temelinde kullanılabilir. RFC 792 TTL exceeded durumunu Type 11 altında tanımlar.

Toolkit:

Hop:

4

Router:

10.0.0.4

RTT:

7.8 ms

gibi hop analysis oluşturabilir.

---

# **ICMPv6**

ICMPv6, IPv6 control/error protocol'dür ve IPv6 Next Header değeri 58'dir. RFC 4443 ICMPv6 general format, error ve informational message classes'ını tanımlar.

Genel:

Type

Code

Checksum

Message Body

---

## **ICMPv6 temel tipler**

RFC 4443:

1   Destination Unreachable

2   Packet Too Big

3   Time Exceeded

4   Parameter Problem

128 Echo Request

129 Echo Reply

tanımlar.

Toolkit:

Type:

2

Message:

Packet Too Big

Reported MTU:

1280

göstermelidir.

Packet Too Big özellikle IPv6 Path MTU Discovery için önemlidir.

---

# **ICMPv6 Neighbor Discovery İlişkisi**

Neighbor Discovery ayrı RFC'lerde tanımlansa da ICMPv6 message family kullanır.

Toolkit basic ICMPv6 parser üzerine:

Neighbor Solicitation

Neighbor Advertisement

Router Solicitation

Router Advertisement

Redirect

decoder module'ları daha sonra ekleyebilir.

Bunlar `ARP for IPv6` diye birebir basitleştirilmemeli; IPv6 Neighbor Discovery'nin kapsamı ARP'den daha geniştir.

---

# **UDP — User Datagram Protocol**

UDP RFC 768 tarafından tanımlanan connectionless datagram transport protocol'dür. UDP uygulamalara minimum transport mekanizmasıyla mesaj gönderme olanağı sağlar; reliability, ordering veya retransmission sağlamaz.

UDP header yalnız:

Source Port

Destination Port

Length

Checksum

alanlarından oluşur.

Header:

8 byte

---

## **UDP header**

0               15 16              31

\+-----------------+------------------+

| Source Port     | Destination Port |

\+-----------------+------------------+

| Length          | Checksum         |

\+-----------------+------------------+

| Payload ...                        |

---

# **UDP Length**

RFC 768 Length alanının UDP header \+ data toplamını verdiğini ve minimum değerinin 8 olduğunu tanımlar.

\[  
PayloadLength=  
UDPLength-8  
\]

Örnek:

UDP Length:

108

\[  
Payload=100\\ bytes  
\]

---

# **UDP checksum**

Checksum pseudo-header \+ UDP header \+ payload üzerinden hesaplanır. RFC 768 bunu one's-complement checksum olarak tanımlar.

Toolkit:

Checksum:

0x....

Validation:

PASS

göstermelidir.

Checksum-offload kullanılan capture'larda host üzerinde outgoing checksum henüz NIC tarafından tamamlanmamış görünebilir.

Bu durumda toolkit:

Possible checksum offload artifact

seçeneği sunmalıdır; her bad checksum gerçek wire corruption değildir.

---

# **UDP Conversation**

UDP connection-oriented olmasa da toolkit pseudo-conversation oluşturabilir:

Source IP

Source Port

Destination IP

Destination Port

4-tuple bazında.

Örnek:

192.168.1.10:50000

↔

192.168.1.20:5000

istatistik:

Datagrams

Bytes

Datagrams/s

Bytes/s

Packet Loss if upper protocol sequence exists

Jitter

Last Activity

---

# **UDP Datagram Özelliği**

UDP:

send 100 bytes

uygulama seviyesinde bir datagram oluşturur.

TCP'den farklı olarak application datagram boundary korunur.

Toolkit kullanıcıya:

UDP:

Message-oriented

TCP:

Byte-stream

ayrımını açıkça göstermelidir.

---

# **TCP — Transmission Control Protocol**

TCP'nin güncel temel consolidated specification'ı **RFC 9293**'tür; RFC 793 ve yıllar içinde onu güncelleyen çeşitli belgeleri birleştirerek güncel Internet Standard olarak yayınlanmıştır.

TCP:

connection-oriented

reliable

ordered

bidirectional

byte-stream

transport sağlar. RFC 9293 TCP'nin portlar, sequence/acknowledgement, retransmission ve bidirectional connection modelini tanımlar.

---

# **TCP Header**

Source Port

Destination Port

Sequence Number

Acknowledgment Number

Data Offset

Flags

Window

Checksum

Urgent Pointer

Options

Data

Minimum header:

20 byte

Options ile daha uzun olabilir.

---

# **TCP Flags**

Toolkit en az:

SYN

ACK

FIN

RST

PSH

URG

ECE

CWR

bitlerini göstermelidir.

Bit panel:

SYN 1

ACK 0

FIN 0

RST 0

Semantic:

Connection establishment request

---

# **TCP Three-Way Handshake**

Client                   Server

SYN

Seq \= X

\------------------------\>

                SYN \+ ACK

                Seq \= Y

                Ack \= X+1

\<------------------------

ACK

Ack \= Y+1

\------------------------\>

ESTABLISHED

Toolkit:

Handshake:

PASS

Client ISN:

...

Server ISN:

...

Handshake Time:

3.4 ms

hesaplamalıdır.

### **Failed handshake**

SYN

SYN

SYN

ve cevap yoksa:

TCP CONNECTION FAILED

No SYN/ACK

gibi gösterebilir.

---

# **TCP Sequence Number**

TCP uygulama verisini **byte sequence space** içerisinde takip eder.

Örneğin:

Seq:

1000

Payload:

500 byte

sonraki beklenen sequence:

\[  
1000+500=1500  
\]

olur.

Toolkit:

Seq:

1000

Data:

500 B

Next Seq:

1500

göstermelidir.

SYN ve FIN de sequence space içerisinde birer position tüketir.

---

# **TCP ACK**

Receiver:

ACK \= N

ile:

N'den önceki byte'lar alındı,

sonraki beklenen byte N

anlamını taşır.

Toolkit visualizer:

Sender

Seq 1000–1499

\-----------------\>

Receiver

ACK 1500

\<-----------------

---

# **TCP Retransmission**

RFC 9293 TCP'nin loss durumunda retransmission kullanarak data delivery sağlamasını tanımlar.

Toolkit:

Original:

Seq 1000

Len 500

No ACK

Retransmission:

Seq 1000

Len 500

işaretlemelidir.

Classification:

Retransmission

Possible Fast Retransmission

Duplicate ACK

Out Of Order

Duplicate Segment

algoritmik inference olarak gösterilebilir.

---

# **TCP Stream Reassembly**

Bu Comm Toolkit açısından **kritik** olmalıdır.

TCP packet değildir:

> TCP bir byte stream sağlar.

Örneğin application:

MESSAGE:

AA BB CC DD EE FF

wire'da:

TCP Segment 1:

AA BB

TCP Segment 2:

CC DD EE

TCP Segment 3:

FF

olabilir.

Tersi:

TCP Segment:

\[Message A\]\[Message B\]\[part of C\]

olabilir.

Dolayısıyla MQTT, HTTP, Modbus TCP ve diğer TCP protokolleri:

Packet Payload

üzerinden değil:

Reassembled TCP Stream

üzerinden parse edilmelidir.

Pipeline:

TCP Segments

↓

Sequence Ordering

↓

Retransmission Removal

↓

Gap Detection

↓

Byte Stream

↓

Application Framer

---

# **TCP Receive Window**

TCP flow control receiver window üzerinden çalışır.

Toolkit:

Advertised Window

Window Scale

Effective Window

Zero Window

Window Update

gösterebilmelidir.

### **Zero Window**

Window:

0

ise:

RECEIVER BUFFER FULL / FLOW CONTROL PAUSE

gibi açıklama verilebilir.

---

# **TCP RTT**

Bir segment ve ACK eşleştirilebiliyorsa yaklaşık RTT hesaplanabilir:

\[  
RTT=t\_{ACK}-t\_{segment}  
\]

Toolkit:

Minimum RTT

Average RTT

Maximum RTT

Smoothed estimate

gibi istatistikler gösterebilir.

Retransmitted packet'lardan RTT sample üretirken ambiguity dikkate alınmalıdır.

---

# **TCP Closing**

Normal close:

FIN

ACK

FIN

ACK

veya eşzamanlı farklı varyasyonlarla gerçekleşebilir.

Toolkit:

Connection:

CLOSED NORMALLY

vs:

RST

Connection reset

ayrımını sağlamalıdır.

---

# **TCP State Machine View**

RFC 9293 connection state machine'i tanımlar.

UI:

CLOSED

↓

SYN-SENT

↓

ESTABLISHED

↓

FIN-WAIT

↓

TIME-WAIT

↓

CLOSED

ve server:

LISTEN

↓

SYN-RECEIVED

↓

ESTABLISHED

...

timeline olarak gösterilebilir.

---

# **DHCP**

DHCP, host'lara IP address ve network configuration parameters sağlayan client/server protocol'dür. RFC 2131 DHCP'nin network address allocation ve host-specific configuration delivery mekanizmalarını tanımlar.

Temel flow:

Client                      Server

DHCPDISCOVER

\--------------------------\>

               DHCPOFFER

\<--------------------------

DHCPREQUEST

\--------------------------\>

               DHCPACK

\<--------------------------

Kısaca:

DORA

Discover

Offer

Request

Acknowledge

---

# **DHCP Packet**

DHCP, BOOTP message structure'ını temel alır.

Toolkit:

op

htype

hlen

hops

xid

secs

flags

ciaddr

yiaddr

siaddr

giaddr

chaddr

sname

file

options

alanlarını göstermelidir.

---

# **Transaction ID**

DHCP transaction:

XID:

0x12345678

üzerinden eşleştirilmelidir.

Toolkit:

Discover

XID 0x12345678

Offer

XID 0x12345678

aynı transaction altında göstermelidir.

---

# **DHCP Address Fields**

ciaddr

Client IP

yiaddr

Your IP / offered client address

siaddr

Server-related address

giaddr

Relay Agent Address

semantic açıklamaları bulunmalıdır.

---

# **DHCP Options**

Toolkit option tree:

Option 53

DHCP Message Type

Option 1

Subnet Mask

Option 3

Router

Option 6

DNS Servers

Option 51

Lease Time

Option 54

Server Identifier

Option 50

Requested IP Address

gibi option database kullanmalıdır.

Exact IANA DHCP option registry ayrı data source olarak güncellenebilir.

---

# **DHCP Lease Timeline**

RFC 2131 lease modelinde client address'i limited-duration lease olarak alabilir.

Toolkit:

Lease Start

Lease Duration

Renewal

Rebinding

Expiration

timeline sağlamalıdır.

BOUND

↓

RENEWING

↓

REBINDING

↓

EXPIRED

---

# **Multiple DHCP Server Detection**

Discover sonrasında:

Offer Server A

Offer Server B

görülüyorsa:

Multiple DHCP offers:

2

gösterilebilir.

Bu tek başına hata değildir.

Ancak beklenmeyen server:

Unknown DHCP Server

olarak project allowlist'e göre uyarılabilir.

---

# **DNS — Domain Name System**

DNS domain-name bilgisini structured distributed database üzerinden çözümler. RFC 1035 DNS message structure, question ve resource-record formatlarını tanımlar.

DNS message:

Header

Question

Answer

Authority

Additional

---

# **DNS Header**

12-byte base header:

ID

Flags:

QR

Opcode

AA

TC

RD

RA

Z/extended flags

RCODE

QDCOUNT

ANCOUNT

NSCOUNT

ARCOUNT

Toolkit bit görünüm:

Flags:

0x8180

QR \= 1

Opcode \= 0

AA \= 0

TC \= 0

RD \= 1

RA \= 1

RCODE \= 0

gibi ayrıştırmalıdır.

---

# **DNS Question**

QNAME

QTYPE

QCLASS

Örnek:

QNAME:

sensor.local

QTYPE:

A

QCLASS:

IN

---

# **DNS Resource Record**

NAME

TYPE

CLASS

TTL

RDLENGTH

RDATA

Toolkit yaygın record'ları desteklemelidir:

A

AAAA

CNAME

PTR

MX

TXT

SRV

NS

SOA

---

# **DNS name compression**

DNS packet içinde domain suffix'leri pointer ile sıkıştırılabilir.

Toolkit:

Compression Pointer:

0xC00C

Points To:

example.com

göstermelidir.

Malformed pointer loop:

Pointer A → Pointer B

Pointer B → Pointer A

parser'ı kilitlememelidir.

---

# **DNS transaction matching**

DNS request-response:

Transaction ID

\+

Source/Destination tuple

\+

Question

üzerinden correlate edilmelidir.

Query:

example.com A

Response:

93.184....

Response Time:

12.3 ms

---

# **DNS Response Code**

Toolkit:

NOERROR

FORMERR

SERVFAIL

NXDOMAIN

NOTIMP

REFUSED

gibi RCODE isimleri sağlamalıdır.

Örnek:

Query:

device.company.local

Response:

NXDOMAIN

---

# **DNS TTL / Cache**

Resource record:

TTL:

300 s

ise:

Received:

12:00:00

Expires:

12:05:00

gibi cache-age simulation yapılabilir.

---

# **NTP — Network Time Protocol**

NTPv4 RFC 5905 tarafından tanımlanır ve distributed time servers/clients arasında system clock synchronization sağlar. RFC 5905 protocol architecture, state machines ve timing algorithms'ı tanımlar.

Temel NTP packet:

LI / VN / Mode

Stratum

Poll

Precision

Root Delay

Root Dispersion

Reference ID

Reference Timestamp

Origin Timestamp

Receive Timestamp

Transmit Timestamp

---

# **NTP İlk Byte**

LI

VN

Mode

bit field olarak gösterilmelidir.

Örneğin:

LI:

0

Version:

4

Mode:

Server

---

# **NTP Stratum**

Toolkit:

Stratum:

1

ise reference-clock'a yakın time source;

Stratum:

2

ise upstream stratum-1 source'tan time alan server gibi semantic bilgi verebilir.

Ancak `daha küçük stratum = otomatik olarak daha doğru clock` şeklinde kesin yorum yapılmamalıdır.

---

# **NTP Four-Timestamp Model**

Client                          Server

T1

Request \----------------------\>

                         T2 receive

                         T3 transmit

Response \<---------------------

T4

Network delay:

\[  
\\delta \=  
(T\_4-T\_1)-(T\_3-T\_2)  
\]

Clock offset:

\[  
\\theta=  
\\frac{(T\_2-T\_1)+(T\_3-T\_4)}{2}  
\]

Toolkit:

T1

T2

T3

T4

Round Trip Delay

Clock Offset

göstermelidir.

---

# **NTP Example**

T1 \= 100.000 ms

T2 \= 110.000 ms

T3 \= 112.000 ms

T4 \= 124.000 ms

Delay:

\[  
(124-100)-(112-110)  
\=22ms  
\]

Offset:

\-1ms  
\]

Toolkit:

Estimated Network Delay:

22 ms

Estimated Clock Offset:

\-1 ms

gösterebilir.

Bu model path symmetry varsayımından etkilenebilir.

---

# **NTP Drift / Offset Trend**

Time        Offset

12:00       \+1.2 ms

12:01       \+1.5 ms

12:02       \+1.9 ms

Toolkit:

Clock drifting

şeklinde trend oluşturabilir.

---

# **SNMP — Temel Paket Analizi**

SNMP network management için kullanılan protocol framework'tür. SNMPv3 architecture RFC 3411 altında SNMP engine, message processing, security ve access-control subsystem'lerini tanımlar.

Toolkit full SNMP management platform olmak zorunda değildir; fakat packet analysis güçlü olmalıdır.

Destek:

SNMPv1

SNMPv2c

SNMPv3

---

# **SNMP ASN.1 / BER**

SNMP messages ASN.1 data structures'ın BER encoded biçimini kullanır.

Toolkit:

TLV

Type

Length

Value

ağacı gösterebilmelidir.

Örneğin:

SEQUENCE

├─ INTEGER version

├─ OCTET STRING community

└─ PDU

---

# **SNMPv2c conceptual packet**

Version

Community

PDU

PDU:

Request ID

Error Status

Error Index

Variable Bindings

---

# **SNMP Operations**

Toolkit:

GET

GET-NEXT

GET-BULK

SET

RESPONSE

TRAP

INFORM

REPORT

gibi PDU/service types'ı tanıyabilmelidir.

Exact version support kontrol edilmelidir; bütün operations bütün SNMP version'larında aynı değildir.

---

# **OID**

Object Identifier:

1.3.6.1.2.1....

Toolkit MIB database varsa:

Raw OID:

1.3.6.1....

Name:

sysUpTime

Value:

...

şeklinde gösterebilmelidir.

### **MIB import**

OID

Name

Syntax

Access

Description

Enum

Unit

metadata'sı parser'a verilmelidir.

---

# **VarBind**

OID

\+

Value

çifti:

Variable Binding 1

OID:

...

Type:

Counter32

Value:

12345

gibi gösterilmelidir.

---

# **SNMPv3**

SNMPv3 packet:

Version

Global Message Data

Security Parameters

Scoped PDU

şeklinde daha gelişmiş security model taşır. RFC 3411 SNMP engine içerisinde security subsystem ve access control subsystem tanımlar.

Toolkit:

Security Model

Security Level

Engine ID

User

Authentication

Privacy

metadata'sını gösterebilir.

Encrypted ScopedPDU anahtar bilinmiyorsa:

Encrypted

Unable to decode payload

olarak bırakılmalıdır.

---

# **HTTP — Temel Mesaj Görüntüleme**

HTTP application-level request/response protocol'dür. HTTP semantics RFC 9110 ailesinde; HTTP/1.1 message syntax, parsing ve connection management ise RFC 9112'de güncel Internet Standard olarak tanımlanmıştır.

Toolkit'in bu başlığı öncelikle **HTTP/1.1 text-message viewer** olmalıdır.

HTTP/2 ve HTTP/3 binary framing ayrı ileri modül olarak ele alınabilir.

---

# **HTTP Request**

Request Line

Headers

Blank Line

Optional Body

Örnek:

GET /api/status HTTP/1.1

Host: 192.168.1.20

Accept: application/json

Toolkit:

Method:

GET

Target:

/api/status

Version:

HTTP/1.1

Host:

192.168.1.20

göstermelidir.

---

# **HTTP Response**

Status Line

Headers

Blank Line

Body

Örnek:

HTTP/1.1 200 OK

Content-Type: application/json

Content-Length: 25

{"temperature":25.4}

Toolkit:

Status:

200 OK

Content Type:

application/json

Body:

JSON

göstermelidir.

---

# **HTTP Method**

En az:

GET

HEAD

POST

PUT

DELETE

OPTIONS

CONNECT

TRACE

base semantics desteklenmeli; registered additional methods database ile genişletilebilmelidir.

---

# **HTTP Body Framing**

HTTP/1.1 parser:

Content-Length

ve:

Transfer-Encoding

gibi message framing mekanizmalarını doğru yorumlamalıdır. RFC 9112 message body framing ve chunked transfer rules'u tanımlar.

### **Chunked example**

4\\r\\n

Wiki\\r\\n

5\\r\\n

pedia\\r\\n

0\\r\\n

\\r\\n

Toolkit:

Chunk 1:

4 bytes

Chunk 2:

5 bytes

Total Body:

9 bytes

Reassembled:

Wikipedia

göstermelidir.

---

# **HTTP Transaction Matching**

TCP Connection

Request 1

GET /status

Response 1

200 OK

Request 2

POST /config

Response 2

204

şeklinde transaction görünümü oluşturulmalıdır.

Pipelining veya multiple connection durumları flow bazında ayrılmalıdır.

---

# **HTTP Content Viewer**

Content-Type'a göre:

application/json

text/plain

text/html

application/xml

application/octet-stream

görüntüleme değişebilir.

JSON:

Raw

Pretty

Tree

modlarında gösterilebilir.

Binary content:

HEX

ASCII

Export

şeklinde.

---

# **WebSocket**

WebSocket RFC 6455 tarafından tanımlanan, opening handshake sonrasında aynı connection üzerinde iki yönlü frame-based communication sağlayan protocol'dür.

İki aşama:

HTTP Opening Handshake

↓

WebSocket Frames

---

# **WebSocket Handshake**

Client:

GET /ws HTTP/1.1

Upgrade: websocket

Connection: Upgrade

Sec-WebSocket-Key: ...

Sec-WebSocket-Version: 13

Server:

HTTP/1.1 101 Switching Protocols

Upgrade: websocket

Connection: Upgrade

Sec-WebSocket-Accept: ...

Toolkit:

Handshake:

VALID

Upgrade:

WebSocket

Protocol:

...

Extensions:

...

göstermelidir.

---

# **Sec-WebSocket-Accept**

Server, client key üzerinde RFC 6455'te tanımlanan GUID \+ SHA-1 \+ Base64 işlem zincirini kullanır.

Toolkit:

Client Key

↓

Append WebSocket GUID

↓

SHA-1

↓

Base64

↓

Expected Accept

ve:

Received:

...

Expected:

...

PASS

gösterebilmelidir.

---

# **WebSocket Frame**

FIN

RSV1

RSV2

RSV3

Opcode

MASK

Payload Length

Extended Payload Length

Masking Key

Payload

Bit görünümü:

0                   1                   2

0 1 2 3 4 5 6 7 8 ...

\+-+-+-+-+-+-+-+-+

|F|R|R|R| opcode |

\+-+-+-+-+-+-+-+-+

|M| payload len  |

\+-+-+-+-+-+-+-+-+

---

# **WebSocket Opcode**

Toolkit:

Continuation

Text

Binary

Close

Ping

Pong

gibi opcode semantic'lerini göstermelidir.

---

# **WebSocket Masking**

RFC 6455 client-to-server frames için masking mekanizması tanımlar.

Toolkit:

Masked:

YES

Mask Key:

12 34 56 78

ve payload için byte-level unmask görünümü sağlamalıdır.

\[  
Decoded\_i=  
Encoded\_i\\oplus Mask\_{i\\bmod4}  
\]

---

# **WebSocket Fragmentation**

Text Frame

FIN=0

Continuation

FIN=0

Continuation

FIN=1

tek application message olarak reassemble edilmelidir.

Control frames application fragmentation'dan ayrı işlenmelidir.

---

# **MQTT**

MQTT client/server publish-subscribe messaging protocol'dür. Güncel OASIS Standard **MQTT Version 5.0**, 7 Mart 2019'da onaylanmıştır; MQTT 3.1.1 compatibility de pratikte önemlidir. MQTT TCP/IP veya ordered/lossless bidirectional transport sağlayan başka katmanlar üzerinde çalışabilir.

Architecture:

Publisher

     │

     ▼

   Broker

   /    \\

  ▼      ▼

Subscriber Subscriber

---

# **MQTT Control Packet**

Genel:

Fixed Header

Variable Header

Payload

İlk byte:

Packet Type

Flags

ardından:

Remaining Length

variable-byte encoding ile gelir.

Toolkit:

Packet:

PUBLISH

DUP:

0

QoS:

1

RETAIN:

0

Remaining Length:

...

göstermelidir.

---

# **MQTT Packet Types**

En az:

CONNECT

CONNACK

PUBLISH

PUBACK

PUBREC

PUBREL

PUBCOMP

SUBSCRIBE

SUBACK

UNSUBSCRIBE

UNSUBACK

PINGREQ

PINGRESP

DISCONNECT

AUTH

MQTT v5 profile'ına göre desteklenmelidir.

---

# **MQTT Connection**

Client

↓

CONNECT

Broker

↓

CONNACK

Toolkit:

Client ID

Protocol Level

Clean Start

Keep Alive

Will Present

Username Present

Authentication

Properties

alanlarını gösterebilmelidir.

---

# **MQTT Topic**

PUBLISH:

Topic:

factory/line1/temperature

Payload:

25.4

Topic tree:

factory

└─ line1

   └─ temperature

oluşturulabilir.

### **Subscription**

factory/+/temperature

ve:

factory/\#

wildcard'ları semantic olarak gösterilebilir.

---

# **MQTT QoS 0**

Publisher

↓

PUBLISH

↓

Broker

At-most-once modelidir. MQTT 5 specification üç QoS delivery seviyesini tanımlar.

---

# **MQTT QoS 1**

PUBLISH

↓

PUBACK

At-least-once delivery.

Toolkit:

Packet ID:

42

PUBLISH:

t0

PUBACK:

t1

Ack Latency:

4.3 ms

gösterebilir.

Duplicate PUBLISH:

DUP=1

ayrıca gösterilmelidir.

---

# **MQTT QoS 2**

PUBLISH

↓

PUBREC

↓

PUBREL

↓

PUBCOMP

Exactly-once delivery handshake.

Toolkit dört packet'ı:

QoS2 Transaction \#123

altında gruplayabilmelidir.

---

# **MQTT Retained Message**

RETAIN=1

ise broker topic'in retained state'ini güncelleyebilir.

Toolkit:

Retained:

YES

göstermelidir.

---

# **MQTT Last Will**

CONNECT içerisinde Last Will tanımı mevcutsa:

Will Topic

Will Payload

Will QoS

Will Retain

gösterilmelidir.

Connection abnormal biter ve Will publish gözlenirse:

Unexpected Disconnect

↓

Will Published

correlation yapılabilir.

---

# **MQTT v5 Properties**

MQTT v5:

Reason Code

User Property

Session Expiry

Message Expiry

Response Topic

Correlation Data

Content Type

Topic Alias

Maximum Packet Size

Receive Maximum

gibi çok sayıda extensibility/property mekanizması ekler.

Toolkit properties'i TLV-benzeri tree olarak göstermelidir.

---

# **MQTT Session Analyzer**

Client Connect

↓

Subscribe

↓

PUBLISH flow

↓

Ping

↓

Disconnect

metric:

Connection Duration

Messages

Publish Rate

Subscribe Count

QoS Distribution

Retransmissions

Keepalive State

Last Activity

---

# **MQTT-SN**

MQTT-SN constrained sensor networks için MQTT ile ilişkili messaging protocol'dür.

Önemli güncel not: **MQTT-SN Version 1.2 OASIS MQTT-SN Subcommittee tarafından input specification olarak kabul edilmiş olsa da OASIS sayfası bunun henüz MQTT 5 gibi resmen onaylanmış OASIS Standard olmadığını açıkça belirtmektedir.**

Toolkit:

Profile:

MQTT-SN 1.2

metadata'sını tutmalıdır.

---

# **MQTT-SN Architecture**

Sensor Client

     │

 MQTT-SN

     ▼

   Gateway

     │

   MQTT

     ▼

   Broker

MQTT-SN özellikle topic strings ve TCP-oriented assumptions'ın constrained/non-TCP sensor networks üzerindeki maliyetini azaltmayı hedefler.

---

# **MQTT-SN Message**

Conceptual:

Length

Message Type

Message-Specific Fields

Uzun packet'lerde extended length representation profile'a göre desteklenmelidir.

Toolkit:

Message:

PUBLISH

Topic ID:

0x0012

Message ID:

42

QoS:

1

Payload:

...

gibi göstermelidir.

---

# **MQTT-SN Gateway Discovery**

Desteklenmesi gereken semantic flows:

ADVERTISE

SEARCHGW

GWINFO

Toolkit:

Gateway Discovered

Gateway ID

Address

Advertisement Duration

gibi topology view oluşturabilir.

---

# **MQTT-SN Topic Registration**

MQTT-SN gateway/client arasında numeric Topic ID mapping kullanılabilir.

REGISTER

↓

REGACK

Toolkit:

Topic:

room/temperature

Topic ID:

0x0012

mapping table oluşturmalıdır.

---

# **CoAP — Constrained Application Protocol**

CoAP constrained nodes ve low-power/lossy networks için geliştirilmiş specialized web-transfer protocol'dür ve RFC 7252 tarafından tanımlanır.

CoAP genellikle UDP üzerinde kullanılır ve REST-benzeri:

GET

POST

PUT

DELETE

request semantics sağlar.

---

# **CoAP Base Header**

İlk dört byte:

Version

Type

Token Length

Code

Message ID

ardından:

Token

Options

0xFF Payload Marker

Payload

gelir.

Bit görünümü:

0 1 2 3 4 5 6 7

\+-+-+-+-+-+-+-+-+

|Ver| T |  TKL  |

\+-+-+-+-+-+-+-+-+

|     Code      |

\+-+-+-+-+-+-+-+-+

|  Message ID   |

\+-+-+-+-+-+-+-+-+

---

# **CoAP Message Types**

CON

Confirmable

NON

Non-confirmable

ACK

Acknowledgement

RST

Reset

RFC 7252 message reliability modelini bu dört type üzerinden tanımlar.

---

# **CoAP Confirmable Flow**

Client

↓

CON GET

MID 100

Server

↓

ACK

MID 100

Response piggyback edilebilir veya ayrı message olarak gelebilir.

Toolkit:

Message ID

Token

Request

Response

Retransmission

ilişkilerini takip etmelidir.

---

# **CoAP Code**

Code:

Class.Detail

mantığıyla görüntülenmelidir.

Örneğin:

0.01

GET

Response:

2.xx

Success family

Toolkit raw byte ve semantic notation'ı birlikte göstermelidir.

---

# **CoAP Token**

Token request-response correlation için kullanılır.

Message ID ile Token aynı işlev değildir.

Toolkit:

Message ID:

Network message matching/reliability

Token:

Request-response correlation

farkını açıkça göstermelidir.

---

# **CoAP Options**

Option parser:

Uri-Host

Uri-Path

Uri-Query

Content-Format

Accept

ETag

Max-Age

Observe where extension enabled

Block options where extension enabled

gibi current registered option database ile genişletilebilir.

Options delta/length compact encoding'i bit/byte olarak açılmalıdır.

---

# **CoAP Payload Marker**

0xFF

payload başlangıcını gösterir.

Toolkit:

Options End

↓

FF

↓

Payload

göstermelidir.

---

# **RTP — Real-time Transport Protocol**

RTP real-time audio, video ve simulation data için transport functions sağlar. RFC 3550 RTP'nin payload-type identification, sequence numbering, timestamping ve delivery monitoring işlevlerini tanımlar; RTP çoğunlukla UDP üzerinde kullanılır.

RTP:

UDP

↓

RTP

↓

Audio / Video / Data

---

# **RTP Header**

Version

Padding

Extension

CSRC Count

Marker

Payload Type

Sequence Number

Timestamp

SSRC

CSRC List

Header Extension

Payload

Bit görünümü:

V  P X  CC

M  PT

Sequence

Timestamp

SSRC

---

# **RTP Sequence Number**

16-bit sequence:

100

101

102

104

ise:

Expected:

103

Possible packet loss:

1

Toolkit sequence wrap:

65534

65535

0

1

durumunu normal kabul etmelidir.

---

# **RTP Timestamp**

RTP timestamp:

Wall clock değildir.

Payload clock domain'ini temsil eder.

Toolkit Payload Type / SDP bilgisi varsa clock rate'i kullanarak:

\[  
Time=  
\\frac{\\Delta RTPtimestamp}{ClockRate}  
\]

hesabı yapabilir.

Örnek:

Clock:

90000 Hz

Timestamp Difference:

9000

\[  
0.1s  
\]

---

# **RTP SSRC**

Synchronization Source:

32-bit

stream identity için kullanılır.

Toolkit:

SSRC 0x12345678

Camera 1

SSRC 0x87654321

Microphone 1

kullanıcı mapping'i oluşturabilir.

---

# **RTP Jitter**

RFC 3550 interarrival jitter için smoothed estimator tanımlar.

Packet (i) transit:

\[  
Transit\_i=  
Arrival\_i-RTPTime\_i  
\]

ardışık fark:

\[  
D\_i=  
Transit\_i-Transit\_{i-1}  
\]

jitter estimator:

\[  
J\_i=  
J\_{i-1}  
\+  
\\frac{|D\_i|-J\_{i-1}}{16}  
\]

Toolkit:

RTP Jitter

Packet Loss

Sequence Gap

Late Packet

Out Of Order

grafikleri üretmelidir.

---

# **RTP Payload**

Payload Type:

PT

alanı payload encoding'i belirtir fakat dynamic payload numbers için SDP/session configuration gerekebilir.

Toolkit:

Payload Type:

96

Mapping:

Unknown unless SDP/profile supplied

gibi davranmalıdır.

Yanlış codec tahmini yapılmamalıdır.

---

# **RTCP**

RTCP, RTP data transfer'ını delivery quality monitoring ve participant information ile tamamlar. RFC 3550 RTP ve RTCP'yi birbirine bağlı iki protocol olarak tanımlar.

RTCP packet türleri:

Sender Report

Receiver Report

Source Description

BYE

APP

---

# **RTCP Common Header**

Version

Padding

Report Count / Subtype

Packet Type

Length

Toolkit compound RTCP packet içindeki her alt packet'ı ayrı tree node yapmalıdır.

---

# **Sender Report — SR**

SSRC

NTP Timestamp

RTP Timestamp

Sender Packet Count

Sender Octet Count

Report Blocks

RTP time ile absolute NTP time arasında mapping sağlar.

Toolkit:

NTP:

...

RTP:

...

Derived Media Timeline:

...

gösterebilir.

---

# **Receiver Report — RR**

Report block:

SSRC

Fraction Lost

Cumulative Lost

Extended Highest Sequence

Interarrival Jitter

LSR

DLSR

gibi delivery-quality metrikleri içerir.

Toolkit:

Loss:

1.2 %

Jitter:

4.6 ms

Reported RTT:

...

gösterebilir.

---

# **PTP — Precision Time Protocol**

PTP networked measurement/control systems'de precise clock synchronization için IEEE 1588 standardında tanımlanır. **2026 itibarıyla aktif temel standard IEEE 1588-2019, protocol version PTP v2.1'dir**; sonrasında BMCA, terminology, management/YANG gibi amendment'lar yayımlanmıştır.

PTP properly designed networks'de sub-microsecond ve bazı sistemlerde daha iyi synchronization precision hedefler.

---

# **PTP Clock Types**

Toolkit:

Grandmaster

Ordinary Clock

Boundary Clock

Transparent Clock

rollerini topology üzerinde göstermelidir.

Örnek:

Grandmaster

     │

Boundary Clock

 ├── Device 1

 ├── Device 2

 └── Device 3

---

# **PTP Message Types**

En az:

Sync

Follow\_Up

Delay\_Req

Delay\_Resp

Pdelay\_Req

Pdelay\_Resp

Pdelay\_Resp\_Follow\_Up

Announce

Signaling

Management

desteklenmelidir.

---

# **One-Step / Two-Step**

Two-step:

Master

↓

Sync

↓

Follow\_Up

Follow\_Up precise origin timestamp taşır.

One-step:

Sync

içinde timestamp/correction uygun hardware tarafından doğrudan sağlanabilir.

Toolkit:

Clock Mode:

Two-Step

gösterebilmelidir.

---

# **End-to-End PTP Delay**

Conceptual timestamps:

Master                         Slave

t1 Sync sent

\------------------------------\>

                       t2 received

                       t3 DelayReq sent

\<------------------------------

t4 DelayReq received

DelayResp

\------------------------------\>

Symmetric path varsayımı altında:

\[  
MeanPathDelay=  
\\frac{(t\_2-t\_1)+(t\_4-t\_3)}{2}  
\]

Offset:

\[  
OffsetFromMaster=  
(t\_2-t\_1)-MeanPathDelay  
\]

Toolkit ayrıca PTP correctionField değerlerini uygun profile göre hesaba katmalıdır.

---

# **PTP Analyzer**

Grandmaster ID

Clock Identity

Domain

Sequence ID

Message Type

Log Message Interval

Correction Field

Port Identity

Two-Step

Offset

Mean Path Delay

Announce State

göstermelidir.

### **Sequence gaps**

Sync:

100

101

103

ise:

Missing Sync:

102

uyarısı üretilebilir.

---

# **BMCA**

PTP network grandmaster seçiminde Best Master Clock Algorithm kullanabilir. IEEE 1588-2019 ve 1588a-2023 BMCA ve enhanced BMCA mekanizmalarını kapsar.

Toolkit Announce message'lardan:

Priority1

Clock Class

Clock Accuracy

Variance

Priority2

Clock Identity

alanlarını göstererek:

Selected Grandmaster

kararını açıklayabilmelidir.

---

# **TFTP**

TFTP basit file-transfer protocol'dür. RFC 1350 TFTP'yi UDP üzerinde küçük ve kolay uygulanabilir file-transfer protocol'ü olarak tanımlar. Her nonterminal data block ayrı ACK ile onaylanır.

Ana packet types:

RRQ

WRQ

DATA

ACK

ERROR

Option extension kullanıldığında:

OACK

de desteklenmelidir.

---

# **TFTP Read Flow**

Client

↓

RRQ filename

Server

↓

DATA block 1

Client

↓

ACK block 1

Server

↓

DATA block 2

Client

↓

ACK block 2

Toolkit session:

File:

firmware.bin

Direction:

Download

Blocks:

...

Retries:

...

Transferred:

...

---

# **TFTP Packet**

DATA:

Opcode

Block Number

Data

ACK:

Opcode

Block Number

Error:

Opcode

Error Code

Error Message

0x00

---

# **TFTP Block Size**

Classic default transfer block:

512 bytes

RFC 1350'de final DATA packet normal block size'dan daha kısa olduğunda transfer end condition oluşur; option extensions daha farklı negotiated block sizes sağlayabilir.

Toolkit:

Block Size:

512

Block:

100

Payload:

512

State:

Continue

son:

Payload:

203

State:

Final Block

---

# **TFTP Retransmission**

DATA 25

↓

No ACK

↓

Timeout

↓

DATA 25 retransmitted

Toolkit:

Block:

25

Retries:

2

Transfer Delay:

...

göstermelidir.

---

# **FTP Kontrol Mesajları**

FTP RFC 959 tarafından tanımlanan file-transfer protocol'dür ve control connection ile data-transfer connection'ı birbirinden ayırır.

Bu toolkit kapsamı:

> **FTP control-message analysis**

olmalıdır.

Full file reconstruction isteğe bağlı ileri özellik olabilir.

---

# **FTP Control Connection**

Conceptual:

Client

↓

TCP Control Connection

↓

FTP Server

Commands ASCII text'tir.

Örnek:

USER user

PASS password

SYST

PWD

TYPE I

PASV

RETR firmware.bin

QUIT

Toolkit credentials için default olarak:

PASS \*\*\*\*\*\*\*\*

redaction sağlamalıdır.

---

# **FTP Responses**

Server üç haneli numeric response code kullanır.

Örnek:

220 Server Ready

331 Password Required

230 Logged In

227 Entering Passive Mode

150 Opening Data Connection

226 Transfer Complete

Toolkit:

Code:

230

Class:

Success

Meaning:

User logged in

gibi database kullanabilir.

---

# **Active / Passive FTP**

Control analyzer:

PORT / EPRT

→ active connection;

PASV / EPSV

→ passive connection

olarak sınıflandırmalıdır.

Timeline:

PASV

↓

Server supplies endpoint

↓

Client creates data TCP connection

↓

RETR

↓

Data

---

# **FTP Transaction Tree**

Session

├─ Login

├─ Directory operations

├─ Transfer 1

│  ├─ RETR

│  ├─ Data connection

│  └─ 226 Complete

└─ QUIT

---

# **Telnet**

Telnet RFC 854 tarafından tanımlanan bidirectional eight-bit byte-oriented terminal communication protocol'dür.

Telnet normal text stream ile protocol-control commands'ı aynı TCP stream içinde taşır.

Özel byte:

IAC

0xFF

Interpret As Command.

---

# **Telnet Option Negotiation**

Ana commands:

WILL

WONT

DO

DONT

Conceptual:

Client:

IAC DO ECHO

Server:

IAC WILL ECHO

Toolkit:

Request:

Enable ECHO

Result:

Accepted

gibi semantic transaction oluşturmalıdır.

---

# **Telnet Subnegotiation**

IAC SB

...

IAC SE

arasında option-specific data taşınabilir.

Toolkit:

Subnegotiation

Option:

Terminal Type

Payload:

...

gösterebilmelidir.

---

# **Telnet IAC Escaping**

Normal data içinde literal `0xFF` göndermek için protocol escaping gerekir.

Toolkit:

FF FF

↓

Literal 0xFF

gibi byte-transparency görünümü sağlamalıdır.

---

# **Telnet Security View**

Telnet'in base protocol'ü encryption sağlamaz.

Toolkit:

Security:

Plaintext protocol

Credentials may be visible in capture

uyarısı gösterebilir.

Bu özellik özellikle eski embedded cihaz entegrasyonlarında yararlıdır.

---

# **Syslog**

Syslog event notification messages taşımak için kullanılır. RFC 5424 transport-independent layered syslog architecture ve standard message formatını tanımlar.

Message:

PRI

VERSION

TIMESTAMP

HOSTNAME

APP-NAME

PROCID

MSGID

STRUCTURED-DATA

MSG

---

# **PRI**

PRI:

\<NUMBER\>

içinde facility ve severity kodlanır.

\[  
PRI=  
Facility\\times8+Severity  
\]

Örnek:

PRI:

34

\[  
Facility=\\lfloor34/8\\rfloor=4  
\]

\[  
Severity=34\\bmod8=2  
\]

Toolkit:

Facility:

4

Severity:

2

ve semantic names gösterebilmelidir.

---

# **Syslog Header**

Örnek conceptual:

\<34\>1 2026-08-08T15:00:00Z device1 app 123 ID47 \- Motor fault

Decoder:

PRI:

34

Version:

1

Timestamp:

...

Hostname:

device1

App:

app

Process:

123

Message ID:

ID47

Structured Data:

None

Message:

Motor fault

RFC 5424 bu HEADER ve STRUCTURED-DATA modelini standardize eder.

---

# **Syslog Structured Data**

Örnek:

\[temperature sensor="1" value="85.2"\]

Toolkit:

Structured Data

├─ ID temperature

├─ sensor \= 1

└─ value \= 85.2

tree görünümü sağlamalıdır.

---

# **Syslog Severity Dashboard**

Emergency

Alert

Critical

Error

Warning

Notice

Informational

Debug

sayım:

Critical:

3

Error:

14

Warning:

52

Trend:

Errors/minute

grafiği oluşturulabilir.

---

# **LLDP — Link Layer Discovery Protocol**

LLDP adjacent IEEE 802 network devices'ın topology/connectivity bilgisini birbirine duyurması için kullanılan link-layer discovery protocol'dür.

Published base standard halen IEEE 802.1AB-2016'dır; 2026 itibarıyla bunun yeni revision projesi aktif durumdadır. Ayrıca multiframe LLDPDU desteği için 802.1ABdh-2021 amendment'ı yayımlanmıştır.

LLDP:

Router

Switch

Embedded Device

PLC

Industrial Switch

komşuluk keşfi için yararlıdır.

---

# **LLDP TLV**

LLDPDU esas olarak TLV dizisinden oluşur:

Chassis ID

Port ID

TTL

Optional TLVs

End Of LLDPDU

TLV header conceptual:

Type

Length

Value

Toolkit:

TLV Type:

System Name

Length:

8

Value:

switch01

göstermelidir.

---

# **Mandatory LLDP TLVs**

Temel neighbor discovery için:

Chassis ID

Port ID

TTL

End

alanları önemlidir.

Toolkit neighbor table:

Local Port   Remote System   Remote Port   TTL

eth0         switch01        Gi1/0/4       120

eth1         plc-switch      port2         120

oluşturmalıdır.

---

# **Optional LLDP TLV**

Destek:

Port Description

System Name

System Description

System Capabilities

Management Address

Organizationally Specific TLVs

Organization-specific TLV'ler OUI \+ subtype üzerinden plugin/database sistemiyle decode edilebilir.

---

# **LLDP TTL**

Neighbor:

TTL:

120 s

ise LLDP update gelmediğinde:

Neighbor Age

takip edilmelidir.

Last LLDP:

130 s ago

State:

EXPIRED

---

# **LLDP Topology Builder**

Capture'dan:

Switch A port 3

↔

PLC port eth0

Switch A port 4

↔

Camera port eth0

network graph oluşturulabilir.

PLC ───── Switch ───── Camera

              │

              └──── HMI

---

# **mDNS — Multicast DNS**

mDNS conventional DNS server olmadan local link üzerinde DNS-benzeri name resolution sağlar. RFC 6762 mDNS'in DNS message structure kullanarak UDP multicast üzerinden çalışmasını ve `.local.` namespace'in link-local semantics'ini tanımlar.

mDNS:

UDP port 5353

üzerinden çalışır. RFC 6762 bunu açıkça tanımlar.

---

# **mDNS Query**

Örnek:

Query:

device.local

Type A

local network multicast'a gönderilir.

Response:

device.local

A

192.168.1.50

Toolkit normal DNS ile mDNS'i ayırmalıdır:

DNS:

Unicast resolver query

mDNS:

Link-local multicast

---

# **.local**

RFC 6762:

.local.

domain'ini link-local multicast DNS için special namespace olarak tanımlar.

Toolkit:

Hostname:

sensor01.local

Scope:

Link Local

göstermelidir.

---

# **mDNS Probing**

Yeni cihaz bir hostname/resource record kullanmadan önce conflict olup olmadığını kontrol etmek için probe yapabilir.

Timeline:

Device starts

↓

Random initial delay

↓

Probe

↓

Probe

↓

Probe

↓

Announcement

RFC 6762 startup probing, announcing ve conflict-resolution davranışlarını tanımlar.

Toolkit:

Name:

sensor.local

State:

PROBING

sonra:

ANNOUNCED

gösterebilir.

---

# **mDNS Conflict**

İki cihaz:

device.local

ismini claim ederse:

NAME CONFLICT

uyarısı üretilebilir.

Toolkit:

Name:

device.local

Responder A:

MAC/IP ...

Responder B:

MAC/IP ...

göstermelidir.

---

# **mDNS Resource Records**

Normal DNS yapısı kullanıldığı için:

A

AAAA

PTR

SRV

TXT

gibi records decode edilebilir.

DNS Service Discovery layer ayrıca etkinleştirilmişse:

\_service.\_tcp.local

gibi service records üzerinden local-service browser oluşturulabilir.

mDNS ile DNS-SD aynı şey olarak adlandırılmamalıdır:

mDNS

\=

multicast name/resource resolution

DNS-SD

\=

DNS records kullanarak service discovery

---

# **Ortak Network Packet Tree**

Bütün 3.8 protokolleri için paket şu yapıda drill-down edilebilmelidir:

Frame 152

└─ Ethernet II

   ├─ Destination

   ├─ Source

   ├─ VLAN

   └─ IPv4

      ├─ Source

      ├─ Destination

      ├─ TTL

      └─ TCP

         ├─ Source Port

         ├─ Destination Port

         ├─ Sequence

         └─ MQTT

            ├─ PUBLISH

            ├─ Topic

            └─ Payload

---

# **Raw HEX ile Field Senkronizasyonu**

Örnek:

45 00 00 3C 12 34 40 00 40 06 ...

Kullanıcı:

TTL

alanına tıklayınca:

\[40\]

ilgili byte highlight edilmelidir.

Bit görünüm:

01000000

Decimal:

64

Semantic:

TTL \= 64

aynı anda gösterilmelidir.

---

# **Flow / Conversation Analyzer**

Toolkit tüm packet'ları conversation halinde gruplayabilmelidir.

## **Ethernet**

MAC A ↔ MAC B

## **IP**

IP A ↔ IP B

## **UDP**

A:Port

↔

B:Port

## **TCP**

Connection

## **MQTT**

Client

↔

Broker

## **DNS**

Query

↔

Response

## **DHCP**

Client

↔

Server

---

# **Endpoint Table**

IP                MAC                TX        RX

192.168.1.10      00:11:...          ...       ...

192.168.1.20      AA:BB:...          ...       ...

Ek:

Protocols

Ports

Hostnames

mDNS Names

LLDP Name

VLAN

Last Seen

---

# **Port Analyzer**

TCP/UDP port database:

Port

Protocol

Observed Application

Configured Application

Örneğin:

1883

TCP

MQTT candidate

Ancak:

> Port numarası tek başına protocol kanıtı değildir.

Toolkit:

Port-based candidate:

MQTT

Payload validation:

PASS

Confidence:

HIGH

gibi çalışmalıdır.

Örneğin TCP 1883 üzerinde proprietary protocol bulunabilir.

---

# **Protocol Auto-Detection**

Protocol detection sadece port numarasına dayanmamalıdır.

Örnek MQTT:

TCP Port 1883

\+

Valid MQTT fixed header

\+

Valid remaining length

\+

Valid packet flags

confidence yükseltir.

HTTP:

GET / POST / HTTP/

\+

valid header syntax

DNS:

valid DNS header

\+

count/record structure

mDNS:

UDP 5353

\+

DNS structure

\+

multicast destination

---

# **Checksum Validation Engine**

Ortak checksum engine:

Ethernet FCS

IPv4 Header Checksum

ICMP Checksum

ICMPv6 Checksum

UDP Checksum

TCP Checksum

Application CRC

değerlerini ayrı göstermelidir.

Örnek:

Ethernet:

FCS not captured

IPv4:

PASS

UDP:

PASS

Application:

CRC FAIL

Bu durumda:

Network transport valid

Application payload integrity failed

şeklinde katman bazlı açıklama yapılabilir.

---

# **Pseudo-Header Görünümü**

TCP/UDP checksum hesaplaması sırasında IP pseudo-header kullanılır.

Toolkit checksum explanation ekranında:

IPv4 Pseudo Header

├─ Source IP

├─ Destination IP

├─ Protocol

└─ Length

TCP/UDP Header

Payload

hesap kapsamını göstermelidir.

IPv6 için uygun IPv6 pseudo-header modeli kullanılmalıdır.

---

# **Packet Length Breakdown**

Her packet:

Application Payload:

100 bytes

TCP:

20 bytes

IPv4:

20 bytes

Ethernet:

14 bytes

FCS:

4 bytes

şeklinde overhead breakdown verebilir.

Efficiency:

\[  
Efficiency=  
\\frac{ApplicationPayload}  
{TotalTransmittedBytes}  
\\times100  
\]

Wire overhead istenirse preamble/SFD ve IFG gibi Ethernet wire-time overhead ayrıca modele eklenebilir.

---

# **Bandwidth Analyzer**

Belirli flow için:

\[  
Bitrate=  
\\frac{TotalBits}{ObservationTime}  
\]

Örneğin:

Data:

12 MB

Duration:

10 s

yaklaşık:

9.6 Mbit/s

application vs network throughput ayrı hesaplanmalıdır.

Application:

8.5 Mbit/s

TCP Payload:

8.8 Mbit/s

IP:

9.1 Mbit/s

Ethernet:

9.6 Mbit/s

---

# **Packet Rate**

\[  
PacketRate=  
\\frac{PacketCount}{Time}  
\]

Örneğin:

10000 packet

10 s

\[  
1000pps  
\]

gösterilmelidir.

---

# **Latency / RTT**

Protocol izin veriyorsa request-response eşleştirilmelidir:

DNS

DHCP

ICMP

MQTT QoS

CoAP

HTTP

NTP

TFTP

SNMP

Örnek:

DNS Query:

t0

DNS Response:

t1

\[  
ResponseTime=t\_1-t\_0  
\]

---

# **Jitter**

Periodic network message:

\[  
Period\_i=t\_i-t\_{i-1}  
\]

\[  
J\_i=Period\_i-T\_{expected}  
\]

Örnek:

Expected:

10 ms

Observed:

9.8

10.1

10.0

10.4 ms

gösterilmelidir.

RTP gibi protocol-specific jitter algorithm varsa generic formula yerine standard algorithm ayrıca kullanılmalıdır.

---

# **Packet Loss**

Network layer packet loss her zaman doğrudan capture'dan bulunamaz.

Sequence number sağlayan protocols:

TCP

RTP

MQTT transaction state

Art-Net

sACN

Custom protocols

üzerinden daha güvenilir inference yapılabilir.

UDP'nin kendisinde sequence yoktur.

Toolkit:

UDP Packet Loss:

Unknown

demeyi bilmelidir.

Üst application sequence varsa:

Application packet loss:

3

hesaplanabilir.

---

# **TCP Stream Viewer**

Hex:

00000000  47 45 54 20 2F ...

Text:

GET /...

Frames:

Segment 1

Segment 2

Segment 3

Stream:

Complete Application Data

arasında geçiş yapılmalıdır.

---

# **UDP Datagram Viewer**

UDP'de her datagram ayrı entity olarak korunmalıdır:

Datagram \#1

Datagram \#2

Datagram \#3

TCP gibi bütün payload'ları tek continuous stream haline getirmemelidir.

---

# **Fragment / Reassembly Center**

Aynı ekranda:

IPv4 Fragments

IPv6 Fragments

TCP Segments

WebSocket Fragments

CoAP Block Transfers

TFTP Blocks

RTP Packets

farkları açıkça gösterilmelidir.

Çünkü bunların hepsine günlük dilde “parçalama” denebilse de katmanları ve algoritmaları farklıdır.

---

# **Discovery Protocol Dashboard**

Aynı network üzerinde:

ARP

DHCP

LLDP

mDNS

DNS

traffic bir arada görülebilir.

Toolkit:

Device:

PLC01

MAC:

00:11:...

IPv4:

192.168.1.20

DHCP Server:

192.168.1.1

LLDP Name:

PLC01

mDNS:

plc01.local

gibi farklı kaynaklardan logical device identity oluşturmaya çalışabilir.

Bu ilişkilendirme confidence-based olmalıdır.

---

# **Network Topology Builder**

LLDP \+ ARP \+ IP traffic üzerinden:

         Switch 1

       /     |      \\

    PLC     HMI    Camera

             |

          Gateway

topology çıkarılabilir.

Kesin LLDP bilgisi:

Confirmed Edge

traffic inference:

Inferred Relationship

olarak farklı gösterilmelidir.

---

# **Network Error Correlation**

Örnek:

12:10:00.000

Ethernet link returns

12:10:00.020

DHCP Discover

12:10:00.060

DHCP ACK

12:10:00.080

ARP

12:10:00.100

mDNS announcement

12:10:00.150

MQTT CONNECT

12:10:00.170

MQTT CONNACK

Toolkit bunu:

DEVICE NETWORK STARTUP

session'ı olarak gruplayabilir.

Başka:

TCP retransmissions

↓

MQTT PUBACK latency increases

↓

Application timeout

root-cause correlation yapılabilir.

---

# **Ağ Hata Modeli**

Ortak hata/warning sınıfları:

BAD\_FCS

BAD\_IP\_CHECKSUM

BAD\_TCP\_CHECKSUM

BAD\_UDP\_CHECKSUM

IP\_FRAGMENT\_MISSING

IP\_FRAGMENT\_OVERLAP

TCP\_RETRANSMISSION

TCP\_DUP\_ACK

TCP\_OUT\_OF\_ORDER

TCP\_ZERO\_WINDOW

TCP\_RESET

TCP\_HANDSHAKE\_TIMEOUT

ARP\_CONFLICT

DHCP\_TIMEOUT

MULTIPLE\_DHCP\_SERVER

DNS\_NXDOMAIN

DNS\_SERVFAIL

DNS\_TIMEOUT

NTP\_OFFSET\_HIGH

NTP\_DELAY\_HIGH

SNMP\_ERROR

HTTP\_MALFORMED

WEBSOCKET\_BAD\_FRAME

MQTT\_MALFORMED

MQTT\_QOS\_TIMEOUT

MQTT\_KEEPALIVE\_TIMEOUT

COAP\_RETRANSMISSION

COAP\_TIMEOUT

RTP\_SEQUENCE\_GAP

RTP\_JITTER\_HIGH

PTP\_SYNC\_LOST

PTP\_OFFSET\_HIGH

TFTP\_RETRY

FTP\_ERROR

TELNET\_NEGOTIATION\_ERROR

SYSLOG\_MALFORMED

LLDP\_NEIGHBOR\_EXPIRED

MDNS\_CONFLICT

UNKNOWN\_PROTOCOL

Her hata:

Timestamp

Layer

Protocol

Flow

Packet

Severity

Expected

Received

Related Packets

Possible Cause

bilgisine sahip olmalıdır.

---

# **Network Layer Drill-Down**

Örneğin MQTT sensor value:

Temperature

25.4 °C

↓

MQTT PUBLISH

↓

Topic

factory/line1/temp

↓

TCP Byte Stream

↓

TCP Segment

↓

IPv4 Datagram

↓

VLAN 20

↓

Ethernet Frame

↓

Capture Interface

HTTP:

JSON:

{"state":"RUN"}

↓

HTTP Response

↓

TCP

↓

IPv6

↓

Ethernet

mDNS:

PLC01

↓

A Record

↓

mDNS Response

↓

UDP 5353

↓

IPv4 Multicast

↓

Ethernet Multicast

PTP:

Clock Offset:

250 ns

↓

Sync \+ Follow\_Up

↓

PTP

↓

UDP/Ethernet Profile

↓

Ethernet

Bu yapı sayesinde **3.8 ağ ve Ethernet protokolleri bölümü**, yalnızca küçük bir Wireshark benzeri packet listesi olmamalıdır. Amaç; **Ethernet frame'inden VLAN'a, IP fragment'ından TCP byte stream'ine, DHCP/DNS discovery sürecinden MQTT/CoAP IoT trafiğine, RTP jitter analizinden PTP clock synchronization'a kadar ağdaki iletişimin ne yaptığını hem byte/bit hem transaction hem de sistem davranışı seviyesinde açıklayabilen bütünleşik bir Network Communication Analyzer** oluşturmaktır.

## **3.9 Kablosuz ve IoT protokolleri**

* Bluetooth Low Energy advertisement  
* BLE GATT characteristic decoder  
* Zigbee  
* Thread  
* Matter için temel mesaj inceleme  
* LoRa  
* LoRaWAN  
* Wi-Fi frame log analizi  
* ESP-NOW  
* RF telemetry custom frame  
* Wireless M-Bus  
* MQTT  
* CoAP  
* NB-IoT log analizi  
* LTE modem AT komutları  
* GNSS modem mesajları

Tarayıcı üzerinden doğrudan erişilemeyen fiziksel protokoller için:

* Log dosyası içe aktarma  
* WebSocket bridge  
* Yerel Python veya Node.js bridge  
* USB cihaz adaptörü  
* Seri port üzerinden köprü  
* Üreticiye özel adapter parser

yaklaşımları kullanılmalıdır.

Kablosuz ve IoT bölümü yalnızca alınan RF paketlerinin HEX karşılığını gösteren bir packet viewer olmamalıdır. Platform; battery-powered sensörler, smart-home cihazları, endüstriyel IoT node'ları, BLE beacon'lar, Zigbee/Thread/Matter cihazları, LoRa/LoRaWAN node'ları, Wi-Fi cihazları, ESP32 tabanlı sistemler, akıllı sayaçlar, NB-IoT modemleri ve cellular/GNSS modüllerinin haberleşmesini **RF/link seviyesinden application payload seviyesine kadar** analiz edebilmelidir.

Ağustos 2026 itibarıyla Bluetooth SIG'in yayımlanmış güncel Core sürümü Bluetooth Core 6.3'tür. Matter 1.6 Haziran 2026'da yayımlanmıştır; Zigbee tarafında Zigbee 4.0, Core R23.2 ve BDB 3.1 dokümanları güncel ekosistemin parçalarıdır. Thread Group ise Thread 1.4.1 specification'ını sunmaktadır. Toolkit protocol parser'larını tek sabit formata bağlamak yerine `Protocol + Revision/Profile` mantığıyla çalıştırmalıdır.

Ortak analiz katmanları:

Radio / Capture

      ↓

PHY Metadata

      ↓

MAC / Link Layer

      ↓

Network Layer

      ↓

Transport

      ↓

Application Protocol

      ↓

Application Value

Örneğin bir Thread/Matter sıcaklık sensörü:

Temperature

23.4 °C

   ↓

Matter Attribute

   ↓

Matter Interaction Model

   ↓

Matter Message

   ↓

UDP

   ↓

IPv6

   ↓

6LoWPAN

   ↓

IEEE 802.15.4

   ↓

2.4 GHz RF

Bir LoRaWAN sensörü:

Soil Moisture

42 %

   ↓

Application Payload

   ↓

LoRaWAN FRMPayload

   ↓

LoRaWAN MAC Frame

   ↓

LoRa PHY

   ↓

Sub-GHz RF

Bir BLE sensörü:

Temperature

24.2 °C

   ↓

GATT Characteristic

   ↓

ATT Notification

   ↓

L2CAP

   ↓

BLE Link Layer

   ↓

BLE PHY

Platform mümkün olduğunca aşağıdaki ortak metadata'yı göstermelidir:

Timestamp

Protocol

Interface

Channel

Frequency

Bandwidth

PHY

Data Rate

RSSI

SNR

LQI

Direction

Source

Destination

Address Type

Packet Type

Sequence

Counter

Payload Length

CRC / MIC

Encryption

Authentication

Retries

Packet Loss

Latency

Jitter

Last Seen

Age

Battery / Power Metadata

---

# **Bluetooth Low Energy Advertisement**

Bluetooth LE advertising, connection kurulmadan önce cihazların discovery, presence, service information ve belirli application data'yı yayınlayabilmesini sağlar.

Bluetooth LE 2.4 GHz bandında çalışır ve Bluetooth Core çeşitli LE PHY seçenekleri tanımlar. Modern toolkit parser'ı yalnız eski BLE 4.x formatını varsaymamalı; Legacy Advertising ve Extended Advertising yapılarını ayırmalıdır. Güncel Bluetooth Core specification ailesi advertising, periodic advertising, extended advertising ve scan-response yapılarını tanımlar.

Temel analyzer ayrımı:

Legacy Advertising

Extended Advertising

Periodic Advertising

Scan Response

---

## **BLE Advertisement RF görünümü**

Capture adapter RF metadata sağlıyorsa:

Timestamp:

12:05:41.124831

PHY:

LE 1M

Channel:

37

Frequency:

...

RSSI:

\-61 dBm

CRC:

PASS

gibi gösterilmelidir.

RSSI:

\-40 dBm

\-65 dBm

\-90 dBm

gibi received signal indication'dır.

Ancak:

> RSSI tek başına kesin mesafe değildir.

Antenna, TX power, orientation, multipath, body attenuation ve environment etkileri nedeniyle toolkit:

Estimated Distance: 2.3 m

gibi kesin sonuç üretmemelidir.

İstenirse:

RSSI-based rough estimate

Confidence: LOW

şeklinde experimental feature olabilir.

---

# **BLE Advertising Channels**

Legacy advertising'de primary advertising channel yapısı analiz edilmelidir.

Toolkit:

Channel 37

Channel 38

Channel 39

üzerindeki advertisement event'lerini aynı event altında correlate edebilmelidir.

Örneğin:

Advertising Event \#452

CH37   \-62 dBm

CH38   \-70 dBm

CH39   \-65 dBm

Bu şekilde channel-specific interference veya antenna behaviour görülebilir.

---

# **BLE Advertising Packet**

Decoder Link Layer seviyesinde en az:

Preamble

Access Address

PDU

CRC

katmanlarını gösterebilmelidir.

Advertising-channel PDU:

Header

Payload

olarak açılmalıdır.

Header içinde kullanılan advertising PDU/profile'a bağlı olarak:

PDU Type

RFU

Channel Selection information

TxAdd

RxAdd

Length

gibi alanlar gösterilebilir.

Exact field interpretation seçilen Bluetooth Core revision'ına göre yapılmalıdır.

---

# **Advertising PDU türleri**

Legacy/profile-aware decoder yaygın advertising structures için semantic isim göstermelidir:

ADV\_IND

ADV\_DIRECT\_IND

ADV\_NONCONN\_IND

ADV\_SCAN\_IND

SCAN\_REQ

SCAN\_RSP

CONNECT\_IND

Extended Advertising destekleniyorsa ayrıca:

ADV\_EXT\_IND

AUX\_ADV\_IND

AUX\_CHAIN\_IND

AUX\_SCAN\_RSP

gibi structures parser database'ında bulunmalıdır.

---

# **Advertising Data — AD Structures**

Bluetooth Core'da Advertising Data ve Scan Response Data bir veya daha fazla **AD Structure** içerir.

Her structure:

Length

AD Type

AD Data

şeklindedir.

Bluetooth Core specification AD Structure'ın ilk octet'inin Length, Data alanındaki ilk octet'in ise AD Type olduğunu tanımlar.

Örnek:

02 01 06

Parser:

Length:

2

AD Type:

0x01

AD Data:

06

olarak ayırmalıdır.

Başka structure:

05 FF 4C 00 01 02

gibi bir manufacturer-specific structure olduğunda:

Length

Type

Company Identifier

Manufacturer Data

şeklinde açılmalıdır.

---

# **AD Type decoder**

Toolkit Bluetooth Assigned Numbers database'ıyla:

Flags

Complete Local Name

Shortened Local Name

16-bit Service UUID

128-bit Service UUID

Service Data

Manufacturer Specific Data

Tx Power

Appearance

URI

gibi AD Type'ları semantic isimlendirebilmelidir.

Raw görünüm:

09 09 53 65 6E 73 6F 72 30 31

ASCII interpretation:

Sensor01

ise:

Complete Local Name:

Sensor01

olarak gösterilmelidir.

---

# **BLE Advertisement Device Table**

Address              Name        RSSI   PHY    Last Seen

AA:BB:CC:DD:EE:01    Sensor01    \-62    1M     12 ms

AA:BB:CC:DD:EE:02    Beacon02    \-81    1M     25 ms

...

Ek:

Public / Random

Connectable

Scannable

Directed

Tx Power

Services

Manufacturer

Advertisement Rate

alanları bulunmalıdır.

---

# **BLE Address Privacy**

Toolkit address type'larını:

Public

Random Static

Resolvable Private

Non-Resolvable Private

gibi classification'lara ayırabilmelidir.

Private address değişimi görüldüğünde:

Old Address

→

New Address

otomatik olarak:

New Device

demek hatalı olabilir.

Identity resolution bilgisi/key mevcut değilse:

Possible address rotation

Identity unknown

şeklinde davranılmalıdır.

---

# **Advertisement Rate**

Aynı cihaz için:

\[  
T\_i=t\_i-t\_{i-1}  
\]

\[  
f=\\frac{1}{T\_{avg}}  
\]

Örnek:

Advertisement intervals:

102 ms

98 ms

101 ms

104 ms

Toolkit:

Average:

101.25 ms

Rate:

9.88 advertisement/s

Jitter:

...

gösterebilir.

Advertising scheduling'in random component içerebildiği dikkate alınmalıdır; küçük interval variation doğrudan hata olarak işaretlenmemelidir.

---

# **BLE GATT Characteristic Decoder**

GATT, Bluetooth Attribute Protocol üzerinde service/characteristic framework tanımlar. Bluetooth SIG, GATT'ın service discovery, characteristic read/write, notification ve indication işlemlerini ATT üzerinden gerçekleştirdiğini belirtir.

Katman:

Application

↓

GATT

↓

ATT

↓

L2CAP

↓

LE Link

---

# **GATT Database**

GATT Server:

Service

├─ Characteristic

│  ├─ Declaration

│  ├─ Value

│  └─ Descriptor(s)

├─ Characteristic

└─ ...

Toolkit tree view:

Generic Access

├─ Device Name

├─ Appearance

└─ Connection Parameters

Environmental Sensing

├─ Temperature

├─ Humidity

└─ Pressure

Custom Service

└─ Custom Characteristic

---

# **UUID**

GATT attributes:

16-bit UUID

128-bit UUID

kullanabilir.

Toolkit:

UUID:

0x2A6E

Known:

Temperature

veya:

UUID:

12345678-....

Custom

gösterebilmelidir.

Bluetooth SIG'in resmi GATT Supplement ve Assigned Numbers verileri semantic decoder'ın temel database kaynaklarından biri olmalıdır.

---

# **Attribute Handle**

Her attribute:

Handle

UUID

Permissions

Value

bilgisine sahiptir.

Örnek:

Handle:

0x0025

UUID:

Custom Temperature

Properties:

READ

NOTIFY

Toolkit handle range'lerini service ağacına bağlamalıdır.

---

# **Characteristic Properties**

Properties bit mask'i:

Broadcast

Read

Write Without Response

Write

Notify

Indicate

Authenticated Signed Write

Extended Properties

gibi özellikleri gösterebilir. Bluetooth Core GATT specification bu property bitlerini tanımlar.

Bit görünümü:

Properties:

0x12

00010010

READ   \= 1

NOTIFY \= 1

---

# **BLE GATT Read**

Client

↓

ATT Read Request

Server

↓

ATT Read Response

Toolkit:

Handle:

0x0025

Characteristic:

Temperature

Raw:

EA 00

Type:

int16

Scale:

0.01 °C

Value:

2.34 °C

gibi schema-based decoding yapmalıdır.

---

# **BLE Write**

Write Request

→ response bekler

Write Command / Write Without Response

→ ATT response beklemez

GATT specification her iki procedure ailesini ayrı tanımlar.

Toolkit:

Operation:

Write Without Response

Characteristic:

Motor Command

Payload:

01

Response:

Not expected

göstermelidir.

---

# **Notification vs Indication**

Bu fark özellikle açık olmalıdır.

Notification

Server → Client

ATT-level acknowledgment yok

Indication

Server → Client

Confirmation beklenir

Bluetooth Core GATT specification notification'ın acknowledgment istemediğini, indication'ın ise confirmation gerektirdiğini açıkça tanımlar.

Timeline:

NOTIFICATION

Server

\----------------\> Client

versus:

INDICATION

Server

\----------------\> Client

       Confirmation

\<----------------

---

# **CCCD**

Client Characteristic Configuration Descriptor:

UUID:

0x2902

notification/indication enable state'ini tutabilir.

Toolkit:

CCCD:

0x0001

Notification:

Enabled

Indication:

Disabled

gösterebilmelidir. Bluetooth GATT specification CCCD'nin bit 0'ını notification, bit 1'ini indication için tanımlar.

---

# **GATT Schema Import**

Custom BLE cihazlarda semantic decode için kullanıcı:

Service UUID

Characteristic UUID

Name

Data Type

Endian

Scale

Offset

Unit

Enum

Bit Fields

tanımlayabilmelidir.

Örneğin:

Characteristic:

BatteryVoltage

UUID:

...

Type:

uint16 LE

Factor:

0.001

Unit:

V

Raw:

C4 30

Decimal:

12484

Physical:

\[  
12.484V  
\]

---

# **Zigbee**

Zigbee, IEEE 802.15.4 tabanlı düşük güçlü mesh IoT communication stack'idir. Connectivity Standards Alliance, 2025 sonunda Zigbee 4.0'ı duyurmuş ve bu release'i Core R23.2, BDB 3.1, Device Type Library ve Zigbee Direct gibi güncel specification bileşenleriyle ilişkilendirmiştir. Zigbee 2.4 GHz yanında desteklenen Sub-GHz PHY seçeneklerini de kapsar.

Katman:

Application

↓

ZCL

↓

APS

↓

NWK

↓

IEEE 802.15.4 MAC

↓

PHY

Toolkit her katmanı ayrı göstermelidir.

---

# **Zigbee Node Rolleri**

Network:

Coordinator

Router

End Device

logical rolleri ile gösterilmelidir.

Topology:

            Coordinator

             /         \\

         Router       Router

         /   \\          |

      Sensor Lamp     Sensor

Toolkit:

Coordinator

Routers

End Devices

Parent

Children

Depth

Neighbors

graph oluşturabilmelidir.

---

# **IEEE 802.15.4 MAC altında Zigbee**

Capture:

802.15.4 MAC

├─ Frame Control

├─ Sequence Number

├─ Addressing

├─ Payload

└─ FCS

Payload daha sonra:

Zigbee NWK

olarak parse edilmelidir.

---

# **Zigbee NWK**

Toolkit network-layer frame'de profile/revision'a göre:

Frame Control

Destination Address

Source Address

Radius

Sequence Number

Optional fields

Payload

alanlarını göstermelidir.

Örnek:

Source NWK:

0x1234

Destination:

0x0000

Radius:

10

Sequence:

52

---

# **Zigbee Addressing**

İki identifier ayrılmalıdır:

64-bit IEEE Address

16-bit Network Address

Örneğin:

IEEE:

00:12:4B:00:...

NWK:

0x37A2

Cihaz rejoin sonrasında network short address değiştirirse:

Old:

0x1234

New:

0x5A21

IEEE:

same

aynı physical device altında ilişkilendirilebilmelidir.

---

# **Zigbee APS**

APS seviyesinde:

Destination Endpoint

Source Endpoint

Cluster ID

Profile ID

Counter

Security

Payload

gibi information decode edilmelidir.

---

# **ZCL — Zigbee Cluster Library**

Semantic application layer'ın önemli kısmı cluster modelidir.

Örnek:

Endpoint 1

On/Off Cluster

├─ OnOff Attribute

Level Control Cluster

├─ CurrentLevel

Temperature Measurement

├─ MeasuredValue

Toolkit:

Cluster ID

Cluster Name

Command

Attribute

Data Type

Value

Unit

göstermelidir.

### **Örnek**

Raw:

29 09

loaded ZCL schema:

MeasuredValue:

0x0929

decimal:

2345

factor:

0.01 °C

output:

Temperature:

23.45 °C

---

# **Zigbee command types**

Read Attributes

Read Attributes Response

Write Attributes

Report Attributes

Default Response

Cluster-Specific Command

transaction halinde gösterilmelidir.

Example:

Coordinator

↓

Read Temperature

Sensor

↓

Read Response

23.4 °C

---

# **Zigbee Join Analyzer**

Joining:

Network Discovery

↓

Parent Selection

↓

Association / Join

↓

Security

↓

Device Announce

↓

Application Discovery / Binding

yüksek seviyeli commissioning timeline olarak gösterilmelidir.

Toolkit:

Join Started

Parent

Network

Channel

PAN ID

Extended PAN ID

Assigned Address

Security Result

Join Time

bilgilerini mümkün olduğunda capture'dan çıkarmalıdır.

---

# **Zigbee Security**

CSA, Zigbee güncel mimarisinde AES-128 tabanlı encryption/authentication ve certificate/elliptic-crypto temelli yeni security imkanlarını belirtmektedir.

Toolkit:

Security:

Enabled

Frame Counter:

...

Key Sequence:

...

MIC:

Valid / Invalid / Unable to verify

gösterebilir.

Key yoksa:

Encrypted APS/NWK payload

olarak bırakılmalı, payload uydurulmamalıdır.

---

# **Thread**

Thread düşük güç IoT cihazları için IPv6 tabanlı mesh network protocol'dür. Thread 802.15.4 radio ve 6LoWPAN üzerinde IPv6 kullanır; Thread Group bunu özellikle IP-native, low-power mesh architecture olarak tanımlar. Güncel resource sayfasında Thread 1.4.1 specification sunulmaktadır.

Katman:

Application

↓

UDP / IPv6

↓

Thread Network Layer

↓

6LoWPAN

↓

IEEE 802.15.4

Matter çoğu durumda Thread'in üstünde application protocol olarak kullanılabilir, fakat:

Thread ≠ Matter

---

# **Thread cihaz rolleri**

Toolkit network graph:

Leader

Router

Router-Eligible End Device

End Device

Sleepy End Device

Border Router

rollerini gösterebilmelidir.

Örnek:

             Border Router

                   |

                 Leader

                /      \\

             Router    Router

             /  \\        |

           SED   ED      SED

Thread mesh'te tek bir permanent central hub bulunmaz; Border Router Thread network ile diğer IPv6 networks arasında connectivity sağlar.

---

# **Thread IPv6 addresses**

Toolkit node için:

Extended Address

RLOC16

Mesh-Local Address

Link-Local IPv6

Global/ULA IPv6

gibi identifiers mevcutsa ayrı göstermelidir.

Özellikle:

RLOC

ile application identity karıştırılmamalıdır.

Network topology değişince routing locator değişebilir.

---

# **6LoWPAN**

IPv6 header'ları constrained IEEE 802.15.4 network üzerinde pahalı olabileceğinden Thread 6LoWPAN compression kullanır.

Toolkit:

802.15.4 Payload

↓

6LoWPAN compressed header

↓

Reconstructed IPv6

görünümü sağlamalıdır.

Örneğin:

Compressed:

X bytes

Reconstructed IPv6 Header:

40 bytes

ve:

Header Compression Saving:

...

hesaplanabilir.

---

# **Thread Fragment Reassembly**

IPv6 datagram IEEE 802.15.4 frame'e sığmadığında adaptation-layer fragmentation kullanılabilir.

Toolkit:

Fragment 1

Fragment 2

Fragment 3

↓

Complete IPv6 Datagram

reassembly yapmalıdır.

Error:

THREAD\_FRAGMENT\_MISSING

THREAD\_REASSEMBLY\_TIMEOUT

---

# **Thread MLE**

Mesh Link Establishment traffic node/router relationships ve network maintenance için önemlidir.

Toolkit MLE traffic'i application UDP traffic'ten ayrı sınıflandırmalıdır:

Parent Request

Parent Response

Child ID

Advertisement

Link Request

Link Accept

exact message database selected Thread revision'a bağlı tutulmalıdır.

---

# **Thread Border Router Analyzer**

Thread Mesh

↓

Border Router

↓

Ethernet / Wi-Fi LAN

↓

IPv6 Network

Toolkit:

Border Router

Thread Interface

Infrastructure Interface

Prefixes

Routes

NAT64 if present

DNS discovery state

gibi network information gösterebilir.

---

# **Matter için Temel Mesaj İnceleme**

Matter IP tabanlı application-layer protocol'dür. Matter'ın resmi SDK architecture dokümantasyonu application, data model, interaction model, action framing, security, message framing/routing ve IP transport katmanlarını açıkça ayırır. Matter Wi-Fi ve Thread gibi farklı IP-capable links üzerinde çalışabilir. Haziran 2026'da Matter 1.6 yayımlanmıştır.

Katman:

Matter Application

↓

Data Model

↓

Interaction Model

↓

Matter Message

↓

Security

↓

UDP/IP

↓

Wi-Fi / Thread / Ethernet

---

# **Matter Node Model**

Node

├─ Endpoint 0

│  ├─ Basic Information

│  ├─ Descriptor

│  └─ Operational Credentials

├─ Endpoint 1

│  ├─ On/Off

│  ├─ Level Control

│  └─ ...

└─ Endpoint 2

Matter data model cluster/endpoint/attribute/command temelinde çalışır. Matter'ın official SDK documentation'ı interaction model üzerinden read/write/subscribe ve command işlemlerinin data-model entities üzerinde yapıldığını tanımlar.

---

# **Matter Data Model**

Toolkit:

Node ID

Fabric

Endpoint

Cluster

Attribute

Command

Event

tree oluşturmalıdır.

Örnek:

Node:

0x12344321

Endpoint:

1

Cluster:

OnOff

Attribute:

OnOff

Value:

TRUE

---

# **Interaction Model**

Analyzer:

Read

Write

Subscribe

Invoke

Report

semantic interaction'larını göstermelidir.

Example:

Controller

↓

ReadRequest

Node

↓

ReportData

UI:

Operation:

READ

Endpoint:

1

Cluster:

Temperature Measurement

Attribute:

MeasuredValue

Response:

23.4 °C

---

# **Matter Subscription**

Controller

↓

Subscribe

Device

↓

ReportData

↓

ReportData

↓

ReportData

Toolkit:

Min Interval

Max Interval

Subscription ID

Last Report

Attribute

Report Count

göstermelidir.

Matter 1.4.2 ve sonraki releases communication/reporting efficiency üzerinde iyileştirmeler getirmiştir; parser revision bilgisi saklamalıdır.

---

# **Matter Commissioning**

Toolkit commissioning traffic'i normal operational traffic'ten ayırmalıdır.

High-level:

Discovery

↓

Commissioning Channel

↓

PASE

↓

Device Attestation

↓

Network Provisioning

↓

Operational Credentials

↓

CASE / Operational State

Matter 1.6 ayrıca NFC-based commissioning gibi setup geliştirmeleri eklemiştir; dolayısıyla commissioning analyzer tek bir BLE-based assumption'a bağlanmamalıdır.

---

# **Matter Security**

Matter message analyzer security status:

Session:

PASE / CASE / Group

Encrypted:

YES

Fabric:

...

Session ID:

...

gösterebilmelidir.

Key yoksa encrypted application content çözümlenmemelidir.

Access Control tarafında:

Privilege

Auth Mode

Subject

Target

gibi information schema/project data mevcutsa gösterilebilir. Matter official Access Control guide tüm Interaction Model işlemlerinin access-control kontrolünden geçtiğini belirtmektedir.

---

# **Matter TLV görünümü**

Matter serialized data'da protocol-specific TLV representation kullanır.

Toolkit:

Structure

├─ Context Tag

├─ Unsigned Integer

├─ Boolean

├─ Byte String

└─ List

gibi recursive tree view sağlamalıdır.

Raw:

XX XX XX ...

ile:

Cluster Attribute:

Temperature \= ...

arasında drill-down yapılmalıdır.

---

# **LoRa**

LoRa bir network protocol değil, Semtech tarafından geliştirilen chirp spread spectrum tabanlı PHY/modulation teknolojisidir. LoRaWAN ise LoRa PHY üzerine kurulan network/MAC standardıdır. Bu iki kavram mutlaka ayrılmalıdır.

LoRa

\=

PHY / modulation

LoRaWAN

\=

Network / MAC protocol

Toolkit iki ayrı modül sunmalıdır:

LoRa PHY Analyzer

LoRaWAN Protocol Analyzer

---

# **LoRa PHY Parametreleri**

Temel:

Center Frequency

Bandwidth — BW

Spreading Factor — SF

Coding Rate — CR

Preamble Length

Explicit / Implicit Header

CRC

Payload Length

IQ configuration

Semtech, BW/SF/CR seçiminin time-on-air, robustness, sensitivity ve battery/range arasında doğrudan trade-off oluşturduğunu belirtmektedir.

---

# **Spreading Factor**

LoRa symbol her symbol için:

\[  
2^{SF}  
\]

chip benzeri frequency-step space kullanır.

Symbol duration:

\[  
T\_{sym}=  
\\frac{2^{SF}}{BW}  
\]

Örnek:

SF \= 7

BW \= 125 kHz

# **\[**

# **T\_{sym}**

\\frac{128}{125000}  
\]

\[  
T\_{sym}=1.024ms  
\]

SF artarsa symbol süresi yaklaşık iki katına çıkar.

Semtech de her SF artışında symbol period'un yaklaşık iki katına çıktığını belirtir.

---

# **Symbol Rate**

# **\[**

# **R\_s=**

# **\\frac{1}{T\_{sym}}**

\\frac{BW}{2^{SF}}  
\]

Örneğin:

SF7

BW125

\[  
R\_s=  
976.5625\\ symbols/s  
\]

---

# **LoRa nominal information-rate yaklaşımı**

Basitleştirilmiş karşılaştırma için:

\[  
R\_b  
\\approx  
SF  
\\times  
\\frac{BW}{2^{SF}}  
\\times  
CodingRateFraction  
\]

Coding-rate fraction kullanılan LoRa coding profile'a göre belirlenir.

Toolkit bunu:

Estimated PHY Bit Rate

olarak göstermeli; gerçek application throughput ile eşitlememelidir.

Çünkü:

Preamble

Header

FEC

CRC

Protocol overhead

vardır.

---

# **Time on Air**

LoRa Toolkit için en önemli calculator'lardan biri **Time on Air** olmalıdır.

Input:

SF

BW

CR

Preamble

Header Mode

CRC

Payload Length

Low Data Rate Optimization

Output:

Symbol Time

Preamble Symbols

Payload Symbols

Preamble Time

Payload Time

Total Time On Air

Effective Data Rate

Semtech'in resmi LoRa Calculator aracı aynı temel timing parametrelerinden Time on Air, symbol count, symbol time ve effective data rate hesaplar.

---

# **LoRa Example Comparison**

Payload:

20 bytes

Profile A:

SF7

BW125

Profile B:

SF12

BW125

Toolkit:

Profile A

Time On Air: shorter

Data Rate: higher

Profile B

Time On Air: much longer

Sensitivity/robustness: higher

gibi karşılaştırmalı result göstermelidir.

Exact numeric ToA profile-specific Semtech formula ile hesaplanmalıdır.

---

# **LoRa RSSI / SNR**

Packet metadata:

RSSI:

\-118 dBm

SNR:

\-8.5 dB

gibi gösterilmelidir.

LoRa demodulation negative SNR values'da da çalışabilecek profile'lara sahip olabilir; yalnız RSSI'ya bakarak packet quality değerlendirilmemelidir.

Toolkit scatter plot:

X:

RSSI

Y:

SNR

Marker:

Packet Success / Failure

oluşturabilir.

---

# **Link Budget**

Genel RF link-budget calculator:

# **\[**

# **P\_{RX}**

## **P\_{TX}**

## **\+**

## **G\_{TX}**

## **\+**

## **G\_{RX}**

## **L\_{path}**

L\_{misc}  
\]

Link margin:

\[  
Margin=  
P\_{RX}-Sensitivity  
\]

Örnek:

TX:

14 dBm

TX Antenna:

2 dBi

RX Antenna:

2 dBi

Path \+ Misc:

120 dB

\[  
P\_{RX}=14+2+2-120=-102dBm  
\]

Sensitivity:

\-130 dBm

ise:

\[  
Margin=28dB  
\]

Toolkit bunun theoretical link-budget olduğunu, gerçek range guarantee olmadığını belirtmelidir.

---

# **LoRaWAN**

LoRaWAN battery-powered IoT end devices için LoRa Alliance tarafından tanımlanan LPWAN protocol'dür. Network tipik olarak **star-of-stars** topolojisindedir: end devices RF üzerinden bir veya birden fazla gateway'e ulaşır, gateways IP üzerinden Network Server'a aktarır. LoRaWAN 1.1 ve 1.0.4 güncel kullanılan major specification branches arasında yer alır.

Topology:

Sensor A ─┐

 Sensor B ─┼── Gateway 1 ──┐

 Sensor C ─┘                │

                            ├── Network Server

 Sensor A ───── Gateway 2 ──┘

                                  │

                           Application Server

                                  │

                              Join Server

---

# **LoRaWAN MAC Frame**

High-level:

PHYPayload

├─ MHDR

├─ MACPayload

└─ MIC

Data packet:

MHDR

↓

FHDR

├─ DevAddr

├─ FCtrl

├─ FCnt

└─ FOpts

↓

FPort

↓

FRMPayload

↓

MIC

Exact fields selected LoRaWAN Link Layer revision'a göre decode edilmelidir.

---

# **MHDR**

Toolkit message type:

Join Request

Join Accept

Unconfirmed Data Up

Unconfirmed Data Down

Confirmed Data Up

Confirmed Data Down

Rejoin Request

Proprietary

gibi semantic isimlerle göstermelidir.

---

# **DevAddr**

DevAddr:

32-bit

network-session address olarak gösterilmelidir.

Bu:

DevEUI

ile karıştırılmamalıdır.

Toolkit:

DevEUI:

device identity

DevAddr:

current network session address

ayrımını açıkça göstermelidir.

---

# **Frame Counter**

FCntUp

FCntDown

profile/version'a göre izlenmelidir.

Capture:

100

101

102

105

ise:

Counter Gap:

3

Possible missing uplinks:

2

gibi inference yapılabilir.

Gateway capture'ın bütün uplinkleri görmeyebileceği dikkate alınmalıdır.

---

# **MIC**

Toolkit:

MIC Received

MIC Calculated

PASS / FAIL

gösterebilmelidir.

Key yoksa:

MIC present

Cannot verify without session keys

denmelidir.

---

# **LoRaWAN Activation**

İki genel activation yaklaşımı:

OTAA

ABP

olarak profile'a göre ayrılmalıdır.

OTAA timeline:

Join Request

↓

Join Accept

↓

Session Keys

↓

Data Uplink

Toolkit:

Device EUI

Join EUI

DevNonce

Join result

Assigned DevAddr

gibi visible information'ı decode edebilir.

Encrypted fields key yoksa raw bırakılmalıdır.

---

# **LoRaWAN Classes**

LoRa Alliance specification:

Class A

Class B

Class C

end-device operating classes tanımlar. LoRaWAN 1.1 ayrıca Class B ve security/roaming enhancements içerir.

## **Class A**

Uplink

↓

RX1

↓

RX2

Her uplink sonrasında receive windows açılır.

Toolkit:

TX complete

RX1 expected

RX2 expected

Downlink observed

timeline sağlamalıdır.

## **Class B**

Beacon ve scheduled ping slots kullanır.

## **Class C**

Device receive window'ı mümkün olduğunca açık tutar; daha düşük downlink latency karşılığında daha fazla power consumption beklenir.

---

# **ADR — Adaptive Data Rate**

Toolkit:

Data Rate

Tx Power

ADR Flag

ADR ACK state

trendlerini gösterebilmelidir.

Semtech/LoRaWAN materials ADR'nin link conditions'a göre data rate ve power kullanımını optimize etmek için önemli olduğunu belirtir.

Graph:

Time

SF

RSSI

SNR

TX Power

---

# **Regional Parameters**

LoRaWAN frequency/channel/data-rate kuralları region'a bağlıdır.

Toolkit project başında:

Region:

EU868

US915

AU915

AS923

IN865

KR920

...

seçtirmelidir.

Aynı:

DR5

değeri farklı region profiles'da aynı RF settings anlamına gelmeyebilir.

LoRa Alliance Link Layer standardını Regional Parameters dokümanından ayrı sürdürür.

---

# **Duty Cycle / Airtime Budget**

Region profile'da regulatory/application duty restrictions varsa:

\[  
DutyCycle=  
\\frac{TotalTXTime}{ObservationTime}\\times100  
\]

Örnek:

TX Time:

36 s

Observation:

3600 s

\[  
DutyCycle=1%  
\]

Toolkit:

Packets/hour

Average ToA

Total ToA

Duty Cycle

hesaplamalıdır.

Regulatory limit project region database'ından gelmelidir; global tek `%1` kuralı hard-code edilmemelidir.

---

# **Wi-Fi Frame Log Analizi**

Wi-Fi analyzer full RF demodulator olmak zorunda değildir. PCAP/PCAPNG, monitor-mode log veya adapter export'tan IEEE 802.11 MAC frame analizi yapabilir.

IEEE'nin güncel consolidated WLAN MAC/PHY revision'ı **IEEE 802.11-2024**'tür.

Toolkit:

802.11 Management

802.11 Control

802.11 Data

frame classes'ını ayırmalıdır.

---

# **802.11 Frame Control**

Conceptual:

Protocol Version

Type

Subtype

To DS

From DS

More Fragments

Retry

Power Management

More Data

Protected

Order / profile-dependent

bit field halinde gösterilmelidir.

Example:

Type:

Management

Subtype:

Beacon

Protected:

No

---

# **Wi-Fi Address Fields**

802.11 frame type/ToDS/FromDS kombinasyonuna göre:

Address 1

Address 2

Address 3

Address 4

alanlarının anlamı değişebilir.

Toolkit doğrudan:

Address 1 \= Destination

Address 2 \= Source

diye her frame'de sabitlememelidir.

Semantic:

Receiver Address

Transmitter Address

Source Address

Destination Address

BSSID

frame context'e göre hesaplanmalıdır.

---

# **Management Frames**

Toolkit en az:

Beacon

Probe Request

Probe Response

Authentication

Deauthentication

Association Request

Association Response

Reassociation

Disassociation

Action

frame türlerini tanımalıdır.

---

# **Beacon Analyzer**

SSID

BSSID

Timestamp

Beacon Interval

Capabilities

Supported Rates

Channel

Security Information

Vendor IE

gibi Information Elements tree şeklinde gösterilmelidir.

Example:

SSID:

FactoryWiFi

BSSID:

AA:BB:CC:DD:EE:FF

Channel:

6

Security:

WPA2/WPA3 information from IEs

Beacon Interval:

...

---

# **Wi-Fi Information Elements**

Management payload genellikle:

Element ID

Length

Data

sequence'larından oluşur.

Toolkit:

SSID

Supported Rates

DS Parameter

RSN

HT

VHT

HE

EHT

Vendor Specific

gibi IEs için revision-aware parser kullanmalıdır.

Unknown IE:

Element:

221

Vendor Specific

OUI:

...

Payload:

RAW

olarak korunmalıdır.

---

# **Wi-Fi Sequence Control**

Data/management frame:

Sequence Number

Fragment Number

alanları packet duplication/retry analysis için kullanılabilir.

Sequence:

100

101

101 RETRY

102

Toolkit:

Possible retry

şeklinde işaretleyebilir.

---

# **RSSI / Channel metadata**

Monitor adapter capture metadata sağlıyorsa:

RSSI

Channel

Center Frequency

Bandwidth

MCS

Spatial Streams

Guard Interval

PHY

gösterilebilir.

Bu metadata 802.11 frame'in kendisinin değil capture interface'in ek bilgisinin parçası olabilir.

UI bunu:

Capture Metadata

ve:

802.11 Frame

olarak ayırmalıdır.

---

# **Wi-Fi Connection Timeline**

Probe

↓

Authentication

↓

Association

↓

Security Handshake

↓

Data

↓

Disassociation

Toolkit:

Discovery Time

Authentication Time

Association Time

First Data

Disconnect Reason

gibi state/timing gösterebilir.

---

# **ESP-NOW**

ESP-NOW Espressif tarafından geliştirilen connectionless Wi-Fi communication protocol'dür. Application data standard IP/TCP/UDP stack üzerinden gitmek yerine Wi-Fi **vendor-specific action frame** içine yerleştirilir. Güncel ESP-IDF dokümantasyonu ESP-NOW v1.0 ve v2.0 formatlarını tanımlar.

Katman:

ESP-NOW Application

↓

ESP-NOW Vendor Specific Element

↓

802.11 Vendor-Specific Action Frame

↓

Wi-Fi MAC/PHY

Bu nedenle:

ESP-NOW ≠ UDP

ESP-NOW ≠ TCP

---

# **ESP-NOW Action Frame**

Güncel Espressif dokümantasyonuna göre conceptual frame:

MAC Header

Category Code

Organization Identifier

Random Value

Vendor Specific Content

FCS

Category:

127

vendor-specific action category olarak kullanılır.

Espressif organization identifier:

18 FE 34

olarak tanımlanmıştır.

Toolkit:

Category:

Vendor Specific

OUI:

18:FE:34

Vendor:

Espressif

Protocol:

ESP-NOW

göstermelidir.

---

# **ESP-NOW Element**

ESP-NOW element:

Element ID

Length

OUI

Type

Version / flags

Body

şeklinde decode edilmelidir.

Espressif'in güncel dokümantasyonu:

Element ID:

221

Type:

4

değerlerini ESP-NOW vendor-specific element için tanımlar.

---

# **ESP-NOW v1 / v2**

Current ESP-IDF documentation:

ESP-NOW v1.0

maximum protocol payload:

250 byte

ESP-NOW v2.0

maximum protocol payload:

1470 byte

olarak belirtir; v2.0 birden fazla vendor-specific element kullanabilir.

Toolkit:

Version:

2

Payload:

1050 byte

Elements:

5

Reassembly:

PASS

gösterebilmelidir.

---

# **ESP-NOW Addressing**

MAC Header context:

Destination MAC

Source MAC

Broadcast third address

ile gösterilebilir.

Espressif dokümanı ToDS ve FromDS bitlerinin ikisinin de sıfır olduğunu ve üçüncü address alanının broadcast olarak ayarlandığını tanımlar.

---

# **ESP-NOW Security**

ESP-NOW CCMP kullanabilir. Espressif implementation'ında PMK ve peer-specific LMK kavramları kullanılır; LMK varsa unicast peer action frames korunabilir. Multicast/broadcast encryption için implementation limitations bulunmaktadır.

Toolkit:

Peer:

AA:BB:...

Encrypted:

YES

Security:

CCMP

Key:

Available locally

MIC:

PASS

gibi görünüm sağlayabilir.

Key yoksa:

Encrypted ESP-NOW

Payload unavailable

---

# **ESP-NOW Device Graph**

ESP32-A

├──── ESP32-B

├──── ESP32-C

└──── ESP32-D

traffic'ten:

Unicast

Broadcast

Packets/s

Bytes/s

RSSI

Retries if visible

Last Seen

tabloları oluşturulabilir.

---

# **RF Telemetry Custom Frame**

Bu araç proprietary Sub-GHz/2.4 GHz RF telemetry sistemleri için **Custom Protocol Studio'nun RF versiyonu** olmalıdır.

Input:

Demodulated bytes

Bit stream

Pulse durations

Logic analyzer export

SDR decoder output

UART output from RF module

olabilir.

Schema:

Preamble

Sync Word

Header

Device ID

Packet Type

Sequence

Length

Payload

CRC

örnek:

AA AA AA 2D D4 01 14 04 34 12 78 56 C9 21

Toolkit:

Preamble:

AA AA AA

Sync:

2D D4

Device:

01

Type:

14

Length:

04

Data:

34 12 78 56

CRC:

C9 21

gösterebilmelidir.

---

# **RF Metadata**

Custom profile:

Frequency

Modulation

Data Rate

Deviation

Bandwidth

RSSI

SNR

Preamble

Sync

Whitening

Manchester

CRC

metadata'sı tanımlanabilmelidir.

Modulation:

FSK

GFSK

OOK

ASK

LoRa

Custom demodulated

olarak etiketlenebilir.

---

# **Whitening**

Bazı RF protocols packet bitstream'e whitening uygular.

Pipeline:

RF bits

↓

Dewhitening

↓

Frame

↓

CRC

Toolkit:

Wire:

A7 39 ...

Dewhitened:

01 10 ...

görünümü verebilmelidir.

Whitening polynomial/seed custom schema'da tanımlanabilmelidir.

---

# **Manchester**

Custom bitstream:

01

10

symbol pairs üzerinden Manchester decode kullanıyorsa:

Encoded Symbols

↓

Decoded Bits

↓

Bytes

görünümü verilmelidir.

Polarity convention profile tarafından belirlenmelidir.

---

# **Unknown RF Protocol Analyzer**

Capture set:

Packet 1

AA AA 10 00 01 53 21

Packet 2

AA AA 10 00 02 61 38

Packet 3

AA AA 10 00 03 14 B7

Toolkit otomatik:

Bytes 0–1:

Constant

Byte 4:

Monotonic counter candidate

Bytes 5–6:

Possible checksum/CRC

analizi yapabilir.

Bu özellikle proprietary sensor ve telemetry reverse-engineering sırasında değerlidir.

---

# **Wireless M-Bus**

Wireless M-Bus utility metering communication için EN 13757 ailesindeki wireless link technology'dir. Open Metering System — OMS, Wireless M-Bus'u EN 13757 tabanı üzerinde interoperable meter/gateway profile olarak kullanır. OMS'nin güncel yayın sayfası Generation 5 için 2023-12 rev.1 release'ini yayımlamaktadır.

Kullanım:

Heat Meter

Water Meter

Gas Meter

Electricity Meter

Temperature Sensor

↓

Wireless M-Bus

↓

Collector / Gateway

↓

HES / BMS

---

# **Wireless M-Bus Mode**

Toolkit selected EN 13757/OMS profile'a göre:

S mode

T mode

C mode

R mode

N mode

F mode

gibi mode'ları ayırabilmelidir.

Exact:

frequency

chip/symbol rate

frame structure

direction

seçilen profile revision'dan gelmelidir.

---

# **W-MBus Telegram**

Pipeline:

RF Metadata

↓

Link Layer Frame

↓

Manufacturer / Device Identity

↓

Security

↓

Application Layer

↓

Meter Records

Toolkit:

Manufacturer

Device ID

Version

Device Type

Access Number

Status

Configuration

Payload

gibi alanları profile'a göre göstermelidir.

---

# **Meter Records**

Application payload:

DIF

DIFE

VIF

VIFE

DATA

yapısından:

Energy

Power

Volume

Flow

Temperature

Battery

Time

değerlerine dönüştürülebilir.

Example:

Meter:

Heat

Energy:

12,542.7 kWh

Volume:

321.45 m³

Supply:

68.2 °C

Return:

52.7 °C

---

# **Wireless M-Bus Security**

OMS security profiles AES-128 ve daha yeni transport security mekanizmalarını kullanabilen security modes tanımlar. OMS'nin current specification paketi ayrıca security-specific annex ve technical reports yayımlar.

Toolkit:

Security Mode

Encrypted

Authentication

Key ID

Frame Counter

göstermelidir.

Key yoksa:

Application Payload:

ENCRYPTED

olarak bırakılmalıdır.

---

# **MQTT — IoT Kullanım Katmanı**

MQTT parser 3.8'deki ortak MQTT engine'i kullanmalıdır; burada tekrar transport parser yazılmamalıdır.

IoT-specific görünüm:

Device

↓

MQTT Client

↓

Broker

↓

Application

Toolkit:

Device ID

Client ID

Topic

QoS

Retain

Payload Type

Publish Rate

Last Seen

Connection State

göstermelidir.

---

# **MQTT Device Telemetry**

Örnek:

Topic:

factory/node17/telemetry

Payload:

{"temp":23.4,"humidity":42}

Toolkit schema varsa:

Temperature:

23.4 °C

Humidity:

42 %

değerlerini çıkarmalıdır.

---

# **Topic Structure Analyzer**

factory

├─ line1

│  ├─ sensor1

│  │  ├─ temperature

│  │  └─ humidity

│  └─ sensor2

└─ line2

topic tree oluşturulmalıdır.

---

# **MQTT IoT Health**

Her client:

Connected

Disconnected

Last Publish

Keep Alive

QoS ACK latency

Message Rate

Duplicate

Retained

Will

durumları izlenmelidir.

Örneğin:

Node 17

Last Publish:

75 s ago

Expected:

10 s

State:

STALE

---

# **CoAP — IoT Kullanım Katmanı**

CoAP parser 3.8'deki common CoAP implementation'ı kullanmalıdır.

IoT view:

Sensor

↓

CoAP Resource

↓

UDP/IP

↓

Gateway / Server

Resource tree:

/temp

/humidity

/config

/status

/battery

---

# **CoAP Resource Transaction**

GET /temp

↓

2.xx response

23.4

Toolkit:

Resource:

/temp

Method:

GET

Response:

Success

Content:

23.4

Content Format:

...

Latency:

14 ms

göstermelidir.

---

# **Observe**

CoAP Observe extension/profile kullanılıyorsa:

Client

↓

Observe /temp

Server

↓

23.1

↓

23.2

↓

23.4

IoT subscription stream olarak gösterilebilir.

Exact Observe semantics ilgili RFC extension parser'ından gelmelidir.

---

# **NB-IoT Log Analizi**

NB-IoT raw LTE radio protocol analyzer'ı tarayıcıda ilk sürüm için gerçekçi bir hedef değildir.

İlk sürümde destek:

Modem AT logs

Network registration logs

Signal-quality logs

Packet session logs

Power-state logs

Socket logs

Operator logs

Module debug logs

üzerinden olmalıdır.

NB-IoT 3GPP LTE/IoT standard ailesinin parçasıdır ve Release 18 tarafında IoT NTN dahil enhancements sürdürülmüştür. 3GPP'nin 2026 portalı ilgili LTE/NB-IoT specifications'ın hâlen change-control altında geliştirildiğini göstermektedir.

---

# **NB-IoT State Model**

Toolkit common modem state:

POWER OFF

↓

BOOT

↓

SIM READY

↓

SEARCHING

↓

REGISTERED

↓

ATTACHED

↓

PDP / PDN ACTIVE

↓

SOCKET OPEN

↓

DATA

↓

IDLE / POWER SAVE

olarak gösterebilir.

Terminology modem/3GPP release'e göre farklı olabilir; parser generic state ile vendor event'i ayrı tutmalıdır.

---

# **Registration Analyzer**

AT log:

AT+CEREG?

response:

\+CEREG: ...

Toolkit:

Registration:

Registered / Searching / Denied / Roaming / Unknown

Tracking Area:

...

Cell:

...

Access Technology:

...

gibi fields decode edebilir.

Exact `<stat>` ve optional fields selected 3GPP 27.007 revision/vendor profile üzerinden gelmelidir. 3GPP TS 27.007, UE AT command set için aktif ve change-control altındaki temel specification'dır.

---

# **Signal Quality Timeline**

Vendor ve standardized commands üzerinden alınabiliyorsa:

RSSI

RSRP

RSRQ

SINR

Cell ID

EARFCN / channel

Band

değerleri trend olarak gösterilmelidir.

UI:

Time     RSRP       RSRQ       Registration

12:00    ...        ...        Registered

12:01    ...        ...        Registered

12:02    ...        ...        Searching

---

# **NB-IoT Power Analyzer**

Loglarda mevcutsa:

PSM

eDRX

Active Time

TAU timer

Wakeup

Sleep

state'leri ayrılmalıdır.

Timeline:

DATA TX

↓

Connected

↓

Idle

↓

PSM

──────────────

Wake

↓

TAU / Data

Battery-oriented IoT için bu görünüm çok değerlidir.

---

# **Socket Timeline**

Network Registered

↓

PDP/PDN Context

↓

DNS

↓

Socket Open

↓

TCP/UDP Connected

↓

Send

↓

Receive

↓

Close

modem logs ile network logs correlate edilebilmelidir.

---

# **LTE Modem AT Komutları**

LTE/NB-IoT/5G-capable modemler DTE/DCE command interface olarak AT command ailesi kullanabilir.

3GPP **TS 27.007 — AT command set for User Equipment** 2026 itibarıyla aktif change-control altındadır. Bunun üstüne üreticiler vendor-specific command set ekler.

Toolkit iki command database tutmalıdır:

3GPP Standard AT

Vendor AT

---

# **AT Command sınıfları**

Basic

Execution

Read

Set

Test

Örnek:

AT

AT+CSQ

AT+CEREG?

AT+COMMAND=value

AT+COMMAND=?

---

# **AT Transaction Parser**

Input:

TX:

AT+CEREG?

RX:

\+CEREG: ...

OK

Output:

Command:

\+CEREG

Form:

READ

Intermediate:

\+CEREG: ...

Final:

OK

Latency:

24 ms

---

# **URC**

Unsolicited Result Code:

Network registration change

Incoming SMS

Socket data

Socket closed

GNSS event

SIM event

command response'tan ayrı tutulmalıdır.

Örneğin:

TX:

AT+CSQ

RX:

\+CEREG: ...

\+CSQ: ...

OK

Toolkit:

URC:

\+CEREG

Response:

\+CSQ

Final:

OK

olarak ayırmalıdır.

---

# **AT Parser State Machine**

IDLE

↓

COMMAND\_SENT

↓

WAIT\_RESPONSE

↓

INTERMEDIATE

↓

FINAL\_RESULT

alternatif:

WAIT\_PROMPT

↓

DATA\_MODE

↓

FINAL\_RESULT

ve:

URC received at any time

durumunu desteklemelidir.

---

# **Final Result Codes**

OK

ERROR

CONNECT

NO CARRIER

BUSY

NO ANSWER

ve:

\+CME ERROR

\+CMS ERROR

gibi extended error forms semantic database ile açıklanmalıdır.

---

# **Cellular Initialization Dashboard**

Module

├─ Model

├─ Firmware

├─ IMEI

├─ SIM

├─ IMSI

├─ Operator

├─ Registration

├─ RAT

├─ Band

├─ Signal

└─ IP

privacy-aware display kullanılmalıdır.

Export sırasında:

IMEI

IMSI

ICCID

Phone number

masking seçeneği olmalıdır.

---

# **LTE Modem Boot Analysis**

Example:

Power ON

↓

RDY

↓

SIM READY

↓

AT handshake

↓

Network search

↓

Registered

↓

PDP context

Toolkit:

Boot → AT Ready:

1.2 s

AT Ready → SIM:

0.8 s

SIM → Registration:

4.7 s

Total Network Ready:

6.7 s

hesaplayabilir.

---

# **GNSS Modem Mesajları**

Cellular modemlerin bir kısmı dahili GNSS receiver içerir.

Burada:

GNSS modem messages

tek bir standard binary protocol gibi değerlendirilmemelidir.

Bir modem:

AT Commands

\+

NMEA output

\+

Vendor-specific GNSS URCs

\+

Vendor-specific binary output

kullanabilir.

Doğru toolkit architecture:

Modem AT Parser

       │

       ├── GNSS Control Commands

       ├── GNSS Status

       └── GNSS URC

                │

NMEA Stream ────┤

                ▼

        Common GNSS Model

---

# **GNSS Control**

Vendor command database varsa:

GNSS Power On

GNSS Power Off

Get Position

Get Fix Status

Set Update Rate

Select Constellation

Assistance Data

NMEA Enable

NMEA Output Port

semantic olarak gösterilebilir.

Standard olmayan vendor command'lar:

Vendor:

Quectel / u-blox / SIMCom / other

Command Definition Revision:

...

metadata'sına bağlanmalıdır.

---

# **GNSS NMEA Stream**

Modem:

$GNGGA,...

$GNRMC,...

$GNGSA,...

output üretiyorsa 3.5'teki NMEA parser aynen kullanılmalıdır.

Yeniden parser yazılmamalıdır.

Modem UART

↓

Line Detector

↓

NMEA

↓

GNSS NavigationData

---

# **GNSS Modem Dashboard**

GNSS:

ON

Fix:

3D

Latitude:

...

Longitude:

...

Altitude:

...

Satellites:

...

UTC:

...

HDOP:

...

Speed:

...

Course:

...

Last Fix:

...

---

# **GNSS Fix Acquisition Timeline**

GNSS ON

↓

No Fix

↓

Time Valid

↓

2D Fix

↓

3D Fix

Toolkit:

Time To First Fix

hesaplayabilir:

\[  
TTFF=  
t\_{firstValidFix}-t\_{GNSSStart}  
\]

Örnek:

GNSS Start:

12:00:00

First Valid Fix:

12:00:28.4

TTFF:

28.4 s

---

# **GNSS Fix Loss**

3D FIX

↓

Satellites decline

↓

NO FIX

↓

Position stale

Toolkit:

GNSS\_FIX\_LOST

Last Valid:

...

Age:

...

uyarısı üretmelidir.

---

# **GNSS \+ Cellular Correlation**

Cellular module field tests için:

Position

\+

Cell ID

\+

RSRP

\+

RSRQ

aynı timeline'a alınabilir.

Örnek:

Position       RSRP

Point A        \-86

Point B        \-104

Point C        \-118

ve harita/export için dataset üretilebilir.

---

# **Kablosuz Signal Quality Ortak Modeli**

Farklı protokoller farklı quality metrics kullanır.

Toolkit tek bir:

Signal Quality \= 75%

değerine zorlamamalıdır.

Ham metrics korunmalıdır:

BLE:

RSSI

Zigbee:

RSSI

LQI

Thread:

RSSI

Link Margin where available

LoRa:

RSSI

SNR

Wi-Fi:

RSSI

MCS

Retries

CRSF-like RF:

RSSI

LQ

SNR

Cellular:

RSRP

RSRQ

SINR

İstenirse:

Normalized Quality

ayrı derived metric olarak verilebilir.

---

# **RSSI Trend**

Time    RSSI

0       \-60

1       \-64

2       \-71

3       \-84

Toolkit:

Mean

Minimum

Maximum

Standard Deviation

Fade Events

hesaplamalıdır.

---

# **Packet Error / Reception Ratio**

Sequence/counter varsa:

\[  
PRR=  
\\frac{ReceivedPackets}  
{ExpectedPackets}  
\]

Örnek:

Expected:

1000

Received:

970

\[  
PRR=97%  
\]

Packet loss:

\[  
Loss=3%  
\]

Ancak expected packet count yalnız known sequence/period varsa hesaplanmalıdır.

---

# **Link Latency**

Request/response protocol:

\[  
Latency=t\_{response}-t\_{request}  
\]

BLE indication/read:

Read Request

↓

Read Response

Matter:

Invoke

↓

Response

CoAP:

CON

↓

ACK

ESP-NOW custom ACK varsa:

TX

↓

Application ACK

gibi protocol-specific transaction kullanılmalıdır.

---

# **Wireless Airtime Analyzer**

Ortak calculator:

Protocol

PHY

Data Rate

Packet Size

Header

Preamble

FEC

Retransmission

Input'tan:

Air Time

Packets/s

Channel Occupancy

Duty Cycle

hesaplanmalıdır.

LoRa için protocol-specific exact calculator;

BLE/Wi-Fi/Zigbee için PHY-aware approximate/exact calculators ayrı olmalıdır.

---

# **Battery / Energy Estimator**

IoT için haberleşme yalnız bitrate değildir.

Packet energy:

# **\[**

# **E\_{TX}**

V  
\\times  
I\_{TX}  
\\times  
T\_{TX}  
\]

Receive:

# **\[**

# **E\_{RX}**

V  
\\times  
I\_{RX}  
\\times  
T\_{RX}  
\]

Sleep:

# **\[**

# **E\_{sleep}**

V  
\\times  
I\_{sleep}  
\\times  
T\_{sleep}  
\]

Örnek:

Voltage:

3.3 V

TX:

40 mA

TX Time:

50 ms

\[  
E=  
3.3\\times0.04\\times0.05  
\]

\[  
E=0.0066J  
\]

Toolkit:

TX Energy

RX Energy

Idle Energy

Sleep Energy

Estimated Daily Consumption

Estimated Battery Life

hesaplayabilir.

Battery-life sonucu:

Theoretical Estimate

olarak açık etiketlenmelidir.

---

# **Wireless Coexistence Analyzer**

Özellikle 2.4 GHz:

Wi-Fi

BLE

Zigbee

Thread

ESP-NOW

aynı spectrum'u paylaşabilir.

Toolkit capture/scan metadata mevcutsa:

Technology

Channel

Center Frequency

Bandwidth

Activity

RSSI

matrix oluşturabilir.

Örneğin:

Wi-Fi Channel 1

High Occupancy

Zigbee Channel X

Overlap: High

gibi coexistence warning üretilebilir.

Exact RF interference sonucunun yalnız protocol logundan kesin belirlenemeyeceği belirtilmelidir.

---

# **Wireless Device Identity Correlation**

Aynı fiziksel cihaz:

BLE MAC

Wi-Fi MAC

Thread Node ID

Matter Node ID

MQTT Client ID

Serial Number

gibi farklı identifier'lara sahip olabilir.

Toolkit project mapping:

Physical Device:

Room Sensor 17

BLE:

...

Thread:

...

Matter:

...

MQTT:

sensor17

oluşturabilmelidir.

Automatic correlation:

CONFIRMED

PROBABLE

USER\_DEFINED

confidence seviyeleriyle gösterilmelidir.

---

# **Commissioning Timeline**

IoT systems için ortak commissioning view:

Device Powered

↓

Discovery

↓

Pair / Join

↓

Authentication

↓

Network Configuration

↓

Application Configuration

↓

Operational

Protocol specific:

BLE:

Advertising → Connect → Pair → GATT

Zigbee:

Discovery → Join → Security → ZCL

Thread:

Attach → Parent → IPv6

Matter:

Discovery → Commission → Fabric

LoRaWAN:

Join Request → Join Accept

Wi-Fi:

Scan → Auth → Assoc → IP

Cellular:

SIM → Register → PDN

---

# **Multi-Protocol IoT Device Timeline**

Örnek Matter Wi-Fi sensor:

12:00:00 BLE advertisement

12:00:05 Matter commissioning starts

12:00:08 Wi-Fi association

12:00:09 DHCP

12:00:10 Matter operational session

12:00:15 MQTT connection if application also uses cloud

Toolkit:

DEVICE STARTUP SESSION

olarak gruplayabilir.

---

# **Gateway Analyzer**

IoT gateway:

BLE

Zigbee

Thread

LoRaWAN

Wireless M-Bus

         ↓

       Gateway

         ↓

Ethernet / Wi-Fi / Cellular

         ↓

MQTT / HTTP / Cloud

Toolkit protocol conversion correlation yapmalıdır.

Örneğin:

Zigbee Temperature:

23.4 °C

↓ Gateway

MQTT:

building/room1/temp

23.4

Latency:

47 ms

---

# **Gateway Mapping Error**

Input:

W-MBus:

Energy \= 1254.3 kWh

Output:

MQTT:

12543

Toolkit schema biliyorsa:

POSSIBLE SCALE ERROR

Expected:

1254.3

Published:

12543

uyarısı verebilir.

---

# **IoT Payload Decoder**

Application payload decoder common engine kullanmalıdır.

Supported data types:

uint8

int8

uint16

int16

uint32

int32

float32

float64

boolean

BCD

ASCII

UTF-8

JSON

CBOR

TLV

bit field

custom struct

Schema:

offset

bit offset

length

type

endian

factor

offset

unit

enum

validity

---

# **Binary Sensor Payload Example**

Raw:

01 09 24 13 88 64

Custom schema:

Byte 0

Device State

Byte 1–2

Temperature

uint16 BE

factor 0.01

Byte 3–4

Pressure

uint16 BE

factor 0.1

Byte 5

Battery %

Decoder:

State:

ON

Temperature:

23.40 °C

Pressure:

500.0 ...

Battery:

100 %

---

# **CBOR / JSON IoT Payload**

JSON:

{"t":23.4,"h":45}

tree:

t

23.4

h

45

CBOR payload varsa:

Raw CBOR

↓

CBOR Tree

↓

Schema Names

↓

Engineering Values

support eklenebilir.

---

# **Ortak Kablosuz Hata Modeli**

BAD\_CRC

BAD\_MIC

AUTH\_FAILED

DECRYPTION\_FAILED

UNKNOWN\_DEVICE

UNKNOWN\_PROFILE

UNKNOWN\_SERVICE

UNKNOWN\_CHARACTERISTIC

BLE\_ADV\_MALFORMED

BLE\_GATT\_TIMEOUT

BLE\_INDICATION\_TIMEOUT

ZIGBEE\_JOIN\_FAILED

ZIGBEE\_PARENT\_LOST

ZIGBEE\_COUNTER\_ERROR

THREAD\_ATTACH\_FAILED

THREAD\_PARENT\_LOST

THREAD\_FRAGMENT\_MISSING

MATTER\_COMMISSIONING\_FAILED

MATTER\_ACCESS\_DENIED

MATTER\_SESSION\_LOST

LORA\_CRC\_ERROR

LORA\_LINK\_MARGIN\_LOW

LORAWAN\_MIC\_ERROR

LORAWAN\_COUNTER\_GAP

LORAWAN\_JOIN\_FAILED

LORAWAN\_RX\_WINDOW\_MISS

WIFI\_ASSOC\_FAILED

WIFI\_DEAUTH

WIFI\_RETRY\_HIGH

ESPNOW\_CRC\_ERROR

ESPNOW\_PEER\_LOST

CUSTOM\_RF\_SYNC\_LOST

WMBUS\_DECRYPTION\_FAILED

MQTT\_DISCONNECTED

MQTT\_KEEPALIVE\_TIMEOUT

COAP\_TIMEOUT

NB\_IOT\_REGISTRATION\_LOST

MODEM\_NO\_SIM

MODEM\_NETWORK\_DENIED

MODEM\_SOCKET\_CLOSED

GNSS\_FIX\_LOST

STALE\_SENSOR\_DATA

EXCESSIVE\_JITTER

SIGNAL\_QUALITY\_LOW

Her hata:

Timestamp

Protocol

Device

Channel

Frame

State

Expected

Received

Severity

Possible Cause

ile gösterilmelidir.

---

# **Kablosuz Layer Drill-Down**

## **BLE**

Temperature

23.4 °C

↓

Characteristic

↓

ATT Notification

↓

L2CAP

↓

BLE Link Layer

↓

RF

## **Zigbee**

Light ON

↓

On/Off Cluster

↓

ZCL Command

↓

APS

↓

NWK

↓

802.15.4

## **Thread \+ Matter**

Room Temperature

↓

Matter Attribute

↓

Matter Report

↓

UDP

↓

IPv6

↓

6LoWPAN

↓

Thread

↓

802.15.4

## **LoRaWAN**

Humidity

42 %

↓

Application Payload

↓

FRMPayload

↓

LoRaWAN MAC

↓

LoRa PHY

## **ESP-NOW**

Button:

Pressed

↓

Custom Body

↓

ESP-NOW Element

↓

Vendor Action Frame

↓

802.11

## **Wireless M-Bus**

Energy

1254 kWh

↓

Meter Record

↓

OMS / EN13757 Application

↓

W-MBus Telegram

↓

RF

## **NB-IoT**

Sensor Data

↓

MQTT/UDP/etc.

↓

Modem Socket

↓

Cellular Packet Session

↓

NB-IoT Registration

Bu yapı sayesinde **3.9 Kablosuz ve IoT protokolleri** bölümü yalnızca BLE scanner, LoRa calculator veya MQTT viewer gibi birbirinden kopuk araçlardan oluşmamalıdır. Amaç; **RF packet'tan IoT application value'ya, BLE characteristic'ten Matter cluster'a, Zigbee mesh node'undan Thread IPv6 packet'ına, LoRa airtime'dan LoRaWAN join sürecine, ESP-NOW action frame'den MQTT gateway output'una ve NB-IoT modem registration state'ine kadar kablosuz bir cihazın bütün haberleşme zincirini tek platformda izleyebilen bir Wireless & IoT Communication Analyzer** oluşturmaktır.

---

# **4\. Teknoloji yığını**

Projeyi aşağıdaki teknolojilerle geliştir:

* React  
* TypeScript  
* Vite  
* Tailwind CSS  
* React Router  
* Zustand  
* IndexedDB  
* Web Serial API  
* WebUSB API  
* Web Bluetooth API  
* WebSocket API  
* File System Access API uygun olduğu yerlerde  
* Web Workers  
* Recharts veya benzeri hafif bir grafik kütüphanesi  
* Vitest  
* React Testing Library  
* Playwright  
* Zod veya eşdeğer schema doğrulama kütüphanesi

Kod içindeki bütün teknik isimlendirmeler İngilizce olmalıdır:

* Değişken isimleri  
* Fonksiyon isimleri  
* Dosya isimleri  
* Sınıf isimleri  
* TypeScript interface ve type isimleri  
* Kod yorumları  
* Test isimleri

Kullanıcı arayüzü başlangıçta Türkçe olmalıdır. İngilizce dil desteği de bulunmalıdır.

Bütün metinler çeviri dosyalarında tutulmalıdır.

Örnek:

export const translations \= {  
  tr: {  
    connect: "Bağlan",  
    disconnect: "Bağlantıyı Kes",  
    packetLength: "Paket Uzunluğu"  
  },  
  en: {  
    connect: "Connect",  
    disconnect: "Disconnect",  
    packetLength: "Packet Length"  
  }  
};

---

# **5\. Tasarım yaklaşımı**

Uygulama teknik, sade, hızlı ve profesyonel görünmelidir.

Ana sayfa kategori kartlarından oluşmalıdır.

Ana kategoriler:

Live Communication  
Protocol Studio  
Protocol Decoders  
Protocol Encoders  
Network Analyzer  
Industrial Communication  
Automotive Communication  
Marine Communication  
Wireless and IoT  
Data Conversion  
Integrity and CRC Tools  
Timing and Bus Calculators  
Log Analyzer  
Protocol Reverse Engineering  
Test Automation  
Project Manager  
Documentation

Her kategori kartında:

* Kategori adı  
* Kısa açıklama  
* İçerdiği araç sayısı  
* En çok kullanılan araçlar  
* Favoriye ekleme  
* Kategoriyi açma

bulunmalıdır.

Arayüz özellikleri:

* Açık tema  
* Koyu tema  
* Responsive tasarım  
* Daraltılabilir sol menü  
* Global arama  
* Son kullanılan araçlar  
* Favoriler  
* Proje kaydetme  
* Çoklu çalışma sekmesi  
* Sürüklenebilir paneller  
* Klavye kısayolları  
* Bildirim sistemi  
* Tam ekran analiz modu  
* Veriyi kopyalama  
* JSON, CSV ve TXT dışa aktarma

---

# **6\. Uygulama mimarisi**

src/  
├── app/  
│   ├── router/  
│   ├── providers/  
│   ├── store/  
│   └── configuration/  
│  
├── components/  
│   ├── common/  
│   ├── layout/  
│   ├── navigation/  
│   ├── forms/  
│   ├── byte-viewer/  
│   ├── packet-viewer/  
│   ├── signal-viewer/  
│   ├── protocol-tree/  
│   ├── charts/  
│   └── virtualized-tables/  
│  
├── connection/  
│   ├── serial/  
│   ├── usb/  
│   ├── bluetooth/  
│   ├── websocket/  
│   ├── file/  
│   └── mock/  
│  
├── protocol-core/  
│   ├── streams/  
│   ├── buffers/  
│   ├── framing/  
│   ├── encoding/  
│   ├── decoding/  
│   ├── checksums/  
│   ├── validation/  
│   ├── statistics/  
│   ├── timing/  
│   └── schemas/  
│  
├── protocols/  
│   ├── serial/  
│   ├── industrial/  
│   ├── automotive/  
│   ├── marine/  
│   ├── aerospace/  
│   ├── building/  
│   ├── network/  
│   └── wireless/  
│  
├── features/  
│   ├── live-monitor/  
│   ├── protocol-studio/  
│   ├── packet-builder/  
│   ├── log-analyzer/  
│   ├── protocol-converter/  
│   ├── reverse-engineering/  
│   ├── test-automation/  
│   ├── calculators/  
│   └── projects/  
│  
├── workers/  
│   ├── stream-parser.worker.ts  
│   ├── log-analyzer.worker.ts  
│   ├── crc-finder.worker.ts  
│   ├── reverse-engineering.worker.ts  
│   └── network-parser.worker.ts  
│  
├── types/  
├── constants/  
├── utils/  
├── translations/  
└── tests/

Protokol hesaplama kodlarını React bileşenlerinin içine yazma.

Ayrıştırma, kodlama, checksum ve mühendislik hesapları bağımsız TypeScript modülleri olmalıdır.

---

# **7\. Protocol Core**

Bütün protokollerin ortak kullanabileceği bir çekirdek oluştur.

Temel veri tipleri:

interface RawFrame {  
  id: string;  
  timestamp: number;  
  direction: "rx" | "tx";  
  channel?: string;  
  bytes: Uint8Array;  
  metadata?: Record\<string, unknown\>;  
}

interface ParsedField {  
  id: string;  
  name: string;  
  offset: number;  
  length: number;  
  rawBytes: Uint8Array;  
  rawValue?: bigint | number | string;  
  physicalValue?: bigint | number | string;  
  unit?: string;  
  valid: boolean;  
  warnings: string\[\];  
}

interface ParsedFrame {  
  protocol: string;  
  timestamp: number;  
  rawFrame: RawFrame;  
  fields: ParsedField\[\];  
  valid: boolean;  
  errors: ProtocolError\[\];  
  warnings: ProtocolWarning\[\];  
}

Parser sonuç tipi:

type ParseResult \=  
  | {  
      success: true;  
      frame: ParsedFrame;  
      consumedBytes: number;  
    }  
  | {  
      success: false;  
      error: ProtocolError;  
      consumedBytes: number;  
      recoverable: boolean;  
    };

Bütün parser’lar ortak bir interface uygulamalıdır:

interface ProtocolParser {  
  readonly protocolId: string;  
  readonly displayName: string;

  canParse(data: Uint8Array): boolean;  
  parse(data: Uint8Array, context?: ParseContext): ParseResult;  
}

Encoder interface:

interface ProtocolEncoder\<TMessage\> {  
  encode(message: TMessage): Uint8Array;  
}

---

# **8\. Live Communication Monitor**

## **8.1 Bağlantı kaynakları**

* Web Serial  
* WebUSB  
* Web Bluetooth  
* WebSocket  
* Dosya oynatma  
* Simulated source  
* Local bridge

Bağlantı ayarları:

* Port  
* Baud rate  
* Data bits  
* Stop bits  
* Parity  
* Flow control  
* Character encoding  
* Line ending  
* Buffer size  
* Frame timeout  
* Timestamp resolution

Desteklenecek baud rate değerleri:

300  
600  
1200  
2400  
4800  
9600  
19200  
38400  
57600  
115200  
230400  
460800  
921600  
1000000  
2000000  
Custom

## **8.2 Görüntüleme modları**

* HEX  
* ASCII  
* UTF-8  
* Decimal  
* Binary  
* Mixed HEX and ASCII  
* Protocol tree  
* Signal table  
* Real-time chart  
* Statistics  
* Timeline

## **8.3 Canlı mesaj örneği**

09:42:15.102  RX  AA 05 10 03 34 12 7F 4F 55  Custom Protocol  Valid  
09:42:15.212  RX  01 03 04 00 64 00 C8 BA 7A     Modbus RTU      Valid  
09:42:15.350  TX  01 06 00 01 00 32 59 DD        Modbus RTU      Sent

Her mesaj için:

* Timestamp  
* Direction  
* Channel  
* Protocol  
* Frame type  
* Raw bytes  
* Parsed fields  
* Validation state  
* CRC state  
* Length  
* Sequence number  
* Address  
* Command  
* Error details

göster.

## **8.4 Stream parser**

Seri port veya WebSocket verisi paket sınırlarıyla aynı parçalarda gelmeyebilir.

Örnek:

Chunk 1: AA 05  
Chunk 2: 10 03 34  
Chunk 3: 12 7F 4F 55 AA  
Chunk 4: 05 10 03

Bu nedenle bir stream buffer geliştir.

Parser durumları:

SEARCHING\_FOR\_FRAME  
READING\_HEADER  
READING\_LENGTH  
READING\_PAYLOAD  
READING\_TRAILER  
VALIDATING\_FRAME  
FRAME\_COMPLETE  
FRAME\_ERROR  
RECOVERING

Framing yöntemleri:

* Fixed length  
* Start byte  
* Multiple start bytes  
* Start and end delimiter  
* Length field  
* Line ending  
* Inter-character timeout  
* Inter-frame timeout  
* Escape-based framing  
* Bit stuffing  
* Byte stuffing  
* COBS  
* SLIP  
* HDLC flag  
* Modbus silent interval

Yoğun veri akışında ayrıştırma işlemini Web Worker içinde gerçekleştir.

---

# **9\. Custom Protocol Studio**

Bu modül uygulamanın en önemli bölümüdür.

Kullanıcı kendi protokolünü sürükle-bırak yöntemiyle oluşturabilmelidir.

## **9.1 Desteklenen alan tipleri**

uint8  
int8  
uint16  
int16  
uint24  
int24  
uint32  
int32  
uint64  
int64  
float16  
float32  
float64  
boolean  
bitField  
enum  
ascii  
utf8  
bcd  
unixTimestamp  
dateTime  
rawBytes  
array  
structure  
checksum  
crc  
padding  
reserved  
delimiter  
length  
sequenceCounter  
address  
command

Her alan için:

* Field name  
* Description  
* Offset  
* Length  
* Data type  
* Signed  
* Endianness  
* Bit order  
* Scale  
* Offset  
* Unit  
* Minimum  
* Maximum  
* Enum table  
* Bit mask  
* Validation rule  
* Dynamic length source  
* Conditional field  
* Repeat count  
* Checksum coverage  
* Default value  
* Color  
* Documentation

seçilebilmelidir.

## **9.2 Sayısal dönüşüm**

Fiziksel değer:

Physical Value \= Raw Value × Scale \+ Offset

Ters dönüşüm:

Raw Value \= (Physical Value \- Offset) / Scale

Örnek:

Raw Value \= 653  
Scale \= 0.1  
Offset \= \-40

Physical Value \= 653 × 0.1 \- 40  
Physical Value \= 25.3 °C

## **9.3 Signed integer**

N bit two’s complement için:

Raw \< 2^(N-1) ise:  
Signed Value \= Raw

Raw ≥ 2^(N-1) ise:  
Signed Value \= Raw \- 2^N

Örnek:

0xF6 \= 246

246 \- 256 \= \-10

## **9.4 Bit field**

Bit Value \= (RawValue \>\> BitPosition) & 1

Maskeli alan:

Field Value \= (RawValue & Mask) \>\> Shift

## **9.5 Endianness**

Little-endian:

Value \= Σ Byte\[i\] × 256^i

Big-endian:

Value \= Σ Byte\[i\] × 256^(N-1-i)

## **9.6 Protocol schema örneği**

{  
  "name": "ALP Sensor Protocol",  
  "version": "1.0",  
  "framing": {  
    "type": "startEnd",  
    "startBytes": \[170\],  
    "endBytes": \[85\],  
    "maximumFrameLength": 256  
  },  
  "fields": \[  
    {  
      "id": "address",  
      "name": "Device Address",  
      "type": "uint8",  
      "offset": 1,  
      "length": 1  
    },  
    {  
      "id": "command",  
      "name": "Command",  
      "type": "enum",  
      "offset": 2,  
      "length": 1,  
      "enumValues": {  
        "16": "Sensor Data",  
        "32": "Set Output",  
        "48": "Status Request"  
      }  
    },  
    {  
      "id": "payloadLength",  
      "name": "Payload Length",  
      "type": "uint8",  
      "offset": 3,  
      "length": 1  
    },  
    {  
      "id": "payload",  
      "name": "Payload",  
      "type": "rawBytes",  
      "offset": 4,  
      "lengthFrom": "payloadLength"  
    },  
    {  
      "id": "checksum",  
      "name": "Checksum",  
      "type": "checksum",  
      "algorithm": "xor8",  
      "coverage": {  
        "startField": "address",  
        "endField": "payload"  
      }  
    }  
  \]  
}

## **9.7 Görsel düzen**

Sol panel:

* Frame yapısı  
* Alan listesi  
* Alan ekleme  
* Sürükleyerek sıralama  
* Koşullu alanlar  
* Tekrarlanan yapılar

Orta panel:

* HEX görünümü  
* ASCII görünümü  
* Byte offset  
* Bit görünümü  
* Renklendirilmiş alanlar  
* Hatalı alan vurgusu

Sağ panel:

* Alan özellikleri  
* Veri tipi  
* Endianness  
* Scale  
* Offset  
* Unit  
* Validation  
* Enum  
* Bit mask

Alt panel:

* Parsed output  
* Validation results  
* Generated JSON schema  
* Generated C structure  
* Generated C parser  
* Generated Python parser  
* Generated TypeScript parser  
* Markdown protocol documentation

---

# **10\. Packet Builder**

Kullanıcı form üzerinden paket oluşturabilmelidir.

Örnek:

Device Address: 5  
Command: Set Output  
Output Channel: 2  
Duty Cycle: 75%

Oluşturulan paket:

AA 05 20 02 02 4B 6C 55

Özellikler:

* Form tabanlı paket oluşturma  
* HEX düzenleme  
* Field validation  
* Otomatik length hesaplama  
* Otomatik CRC  
* Otomatik checksum  
* Byte stuffing  
* Bit stuffing  
* COBS encoding  
* SLIP encoding  
* Endianness  
* Scale ve offset  
* Seri port üzerinden gönderme  
* WebSocket üzerinden gönderme  
* Periyodik gönderme  
* N kere gönderme  
* Alan artırma  
* Alan azaltma  
* Random data  
* Sequence counter  
* Response bekleme

Kod çıktıları:

uint8\_t frame\[\] \= {  
    0xAA, 0x05, 0x20, 0x02,  
    0x02, 0x4B, 0x6C, 0x55  
};

frame \= bytes(\[  
    0xAA, 0x05, 0x20, 0x02,  
    0x02, 0x4B, 0x6C, 0x55  
\])

const frame \= new Uint8Array(\[  
  0xAA, 0x05, 0x20, 0x02,  
  0x02, 0x4B, 0x6C, 0x55  
\]);

---

# **11\. CRC ve checksum araçları**

Desteklenecek algoritmalar:

* XOR-8  
* SUM-8  
* SUM-16  
* Two’s complement  
* One’s complement  
* Fletcher-16  
* Fletcher-32  
* Adler-32  
* LRC  
* NMEA XOR  
* CRC-4  
* CRC-5  
* CRC-6  
* CRC-7  
* CRC-8  
* CRC-8 SAE J1850  
* CRC-8 AUTOSAR  
* CRC-8 MAXIM  
* CRC-16 ARC  
* CRC-16 Modbus  
* CRC-16 CCITT-FALSE  
* CRC-16 XMODEM  
* CRC-16 X25  
* CRC-16 DNP  
* CRC-24  
* CRC-32  
* CRC-32C  
* CRC-64  
* Custom CRC

Custom CRC parametreleri:

* Width  
* Polynomial  
* Initial value  
* Reflect input  
* Reflect output  
* XOR output  
* Check value  
* Residue  
* Byte order

Standart kontrol girdisi:

123456789

Beklenen örnekler:

CRC-8              \= 0xF4  
CRC-16 CCITT-FALSE \= 0x29B1  
CRC-16 MODBUS      \= 0x4B37  
CRC-32 ISO-HDLC    \= 0xCBF43926

CRC Finder aracı:

* Veri ve checksum çiftlerini kabul etsin  
* Yaygın CRC algoritmalarını denesin  
* Byte order varyasyonlarını denesin  
* Coverage alanını tahmin etsin  
* Eşleşme yüzdesi göstersin

---

# **12\. Veri dönüştürme araçları**

Aşağıdaki araçları geliştir:

* HEX to ASCII  
* ASCII to HEX  
* HEX to binary  
* Binary to HEX  
* Decimal converter  
* Signed and unsigned converter  
* Little-endian converter  
* Big-endian converter  
* Mixed endian converter  
* IEEE-754 Float16  
* IEEE-754 Float32  
* IEEE-754 Float64  
* BCD converter  
* UTF-8 byte viewer  
* Base64  
* Base32  
* URL encoding  
* Unix timestamp  
* Bit mask  
* Byte swap  
* Bit reverse  
* Nibble swap  
* C array generator  
* C++ array generator  
* Python bytes generator  
* Rust array generator  
* Java byte array generator  
* JavaScript Uint8Array generator

---

# **13\. UART ve seri haberleşme hesapları**

Bits per character:

Bits Per Character \=  
Start Bits \+  
Data Bits \+  
Parity Bits \+  
Stop Bits

8N1:

1 \+ 8 \+ 0 \+ 1 \= 10 bit

Character time:

Character Time \=  
Bits Per Character / Baud Rate

Packet time:

Packet Time \=  
Packet Bytes × Bits Per Character / Baud Rate

Maximum byte rate:

Maximum Byte Rate \=  
Baud Rate / Bits Per Character

Maximum packet rate:

Maximum Packet Rate \=  
1 / Packet Time

Protocol efficiency:

Efficiency \=  
Payload Bytes / Total Frame Bytes × 100

Baud rate error:

Baud Error \=  
Actual Baud \- Target Baud

Baud Error Percentage \=  
Baud Error / Target Baud × 100

UART calculator girişleri:

* Clock frequency  
* Baud rate  
* Oversampling  
* Prescaler  
* Data bits  
* Stop bits  
* Parity  
* Packet length  
* Payload length  
* Inter-frame delay

Çıktılar:

* Actual baud  
* Baud error  
* Bit time  
* Character time  
* Packet time  
* Maximum bytes/s  
* Maximum packet/s  
* Efficiency  
* Recommended timeout

---

# **14\. RS-232, RS-422 ve RS-485 araçları**

## **14.1 RS-485 termination**

İki adet 120 ohm terminasyon için:

R\_effective \= 120 Ω || 120 Ω  
R\_effective \= 60 Ω

Yaklaşık sürücü akımı:

I\_driver \= V\_differential / R\_effective

## **14.2 Bias hesabı**

V\_AB \= V\_CC × R\_T / (2 × R\_B \+ R\_T)

I\_bias \= V\_CC / (2 × R\_B \+ R\_T)

## **14.3 Propagation delay**

Propagation Delay \=  
Cable Length / Propagation Velocity

Yaklaşık kablo yayılma hızı kullanıcı tarafından girilmelidir.

Round trip:

Round Trip Delay \=  
2 × One Way Delay

RS-485 araçları:

* Termination helper  
* Bias resistor helper  
* Unit load calculator  
* Node count estimator  
* Cable delay  
* Timeout assistant  
* Stub length warning  
* Half-duplex timing  
* Driver-enable timing  
* Turnaround delay  
* Modbus RTU line calculator

---

# **15\. SPI, I²C, I3C, SMBus ve PMBus**

## **15.1 SPI süresi**

Transfer Time \=  
Total Clock Bits / SPI Clock Frequency

Toplam süre:

T\_total \=  
T\_setup \+  
T\_command \+  
T\_address \+  
T\_dummy \+  
T\_payload \+  
T\_crc \+  
T\_hold

Destekle:

* Standard SPI  
* Dual SPI  
* Quad SPI  
* Octal SPI  
* CPOL  
* CPHA  
* Command  
* Address  
* Dummy cycle  
* Payload  
* Chip select timing

## **15.2 I²C süresi**

Her byte yaklaşık:

8 data bit \+ 1 ACK/NACK bit \= 9 clock

Transfer Time ≈  
Total Clock Count / SCL Frequency

Destekle:

* 7-bit address  
* 10-bit address  
* Write  
* Read  
* Repeated start  
* Clock stretching  
* ACK/NACK  
* Register address bytes

## **15.3 Pull-up hesabı**

Yaklaşık rise time:

t\_r ≈ 0.8473 × R\_pullup × C\_bus

Maksimum pull-up:

R\_pullup\_max \=  
t\_r\_max / (0.8473 × C\_bus)

Minimum pull-up:

R\_pullup\_min \=  
(V\_DD \- V\_OL\_max) / I\_OL

## **15.4 SMBus ve PMBus**

* SMBus timeout  
* PEC CRC-8  
* PMBus command decoder  
* Linear11 converter  
* Linear16 converter  
* Direct format converter  
* Voltage  
* Current  
* Temperature  
* Power telemetry

Linear11:

Value \= Mantissa × 2^Exponent

---

# **16\. Modbus ailesi**

Destekle:

* Modbus RTU  
* Modbus ASCII  
* Modbus TCP

Function code’lar:

0x01 Read Coils  
0x02 Read Discrete Inputs  
0x03 Read Holding Registers  
0x04 Read Input Registers  
0x05 Write Single Coil  
0x06 Write Single Register  
0x0F Write Multiple Coils  
0x10 Write Multiple Registers  
0x16 Mask Write Register  
0x17 Read/Write Multiple Registers  
0x2B Encapsulated Interface Transport

Modbus RTU:

Address  
Function Code  
Data  
CRC Low  
CRC High

Modbus ASCII:

Colon  
Address  
Function  
Data  
LRC  
CR  
LF

Modbus TCP:

Transaction ID  
Protocol ID  
Length  
Unit ID  
Function  
Data

Modbus register gösterimleri:

* uint16  
* int16  
* uint32  
* int32  
* float32  
* float64  
* BCD  
* ASCII  
* HEX  
* bit field

Byte order seçenekleri:

ABCD  
BADC  
CDAB  
DCBA

Modbus timing:

T\_char \= Bits Per Character / Baud Rate

T\_1.5 \= 1.5 × T\_char

T\_3.5 \= 3.5 × T\_char

---

# **17\. CAN, CAN FD ve CAN XL araçları**

## **17.1 CAN frame decoder**

Gösterilecek alanlar:

* Timestamp  
* CAN ID  
* Standard veya extended  
* RTR  
* IDE  
* DLC  
* Data  
* CRC state  
* ACK  
* Frequency  
* Period  
* Jitter  
* Message count

## **17.2 Yaklaşık CAN frame uzunluğu**

Standard frame:

Frame Bits ≈ 47 \+ 8 × DLC

Extended frame:

Frame Bits ≈ 67 \+ 8 × DLC

Stuffing yaklaşımı:

Maximum Stuff Bits ≈  
floor((Stuff Region \- 1\) / 4\)

Frame time:

Frame Time \=  
Frame Bits / CAN Bit Rate

Bus load:

Bus Load \=  
Σ(Frame Frequency × Frame Bit Count)  
/  
CAN Bit Rate  
× 100

## **17.3 CAN bit timing**

Time Quantum \=  
Prescaler / CAN Clock

Bit Time \=  
Time Quantum ×  
(1 \+ TSEG1 \+ TSEG2)

CAN Bit Rate \=  
CAN Clock /  
\[Prescaler × (1 \+ TSEG1 \+ TSEG2)\]

Sample Point \=  
(1 \+ TSEG1) /  
(1 \+ TSEG1 \+ TSEG2)  
× 100

CAN FD için ayrı hesapla:

* Arbitration bitrate  
* Data bitrate  
* BRS  
* Nominal timing  
* Data timing  
* Payload up to 64 byte  
* CRC length variation

## **17.4 DBC**

DBC yükleme ve oluşturma desteği ekle.

Signal özellikleri:

* Start bit  
* Length  
* Endianness  
* Signed  
* Factor  
* Offset  
* Min  
* Max  
* Unit  
* Enum  
* Multiplexing

Physical value:

Physical Value \=  
Raw Value × Factor \+ Offset

---

# **18\. J1939**

29-bit identifier:

Priority  
Reserved  
Data Page  
PDU Format  
PDU Specific  
Source Address

PGN:

PF \< 240 ise:  
PGN \= (DP \<\< 16\) | (PF \<\< 8\)

PF ≥ 240 ise:  
PGN \= (DP \<\< 16\) | (PF \<\< 8\) | PS

Destekle:

* PGN  
* SPN  
* Source address  
* Destination address  
* Priority  
* Address claim  
* Request PGN  
* Transport Protocol  
* BAM  
* RTS/CTS  
* DM1  
* DM2  
* DTC  
* FMI  
* Occurrence count

SPN dönüşümü:

Physical Value \=  
Raw Value × Resolution \+ Offset

---

# **19\. CANopen**

Desteklenecek yapılar:

* NMT  
* SYNC  
* EMCY  
* PDO  
* SDO  
* Heartbeat  
* Node guarding  
* LSS  
* Object Dictionary  
* EDS import

CANopen COB-ID çözümleme aracı oluştur.

SDO transferleri:

* Expedited  
* Segmented  
* Block

Object dictionary gösterimi:

Index  
Sub-index  
Name  
Data type  
Access type  
Raw value  
Physical value

---

# **20\. LIN**

LIN frame:

Break  
Sync  
Protected Identifier  
Data  
Checksum

Sync:

0x55

PID parity:

P0 \= ID0 XOR ID1 XOR ID2 XOR ID4

P1 \= NOT(ID1 XOR ID3 XOR ID4 XOR ID5)

Destekle:

* PID validation  
* Classic checksum  
* Enhanced checksum  
* Frame timing  
* Schedule table  
* Signal decoding  
* LDF import için temel destek

---

# **21\. UDS, ISO-TP ve OBD-II**

## **21.1 ISO-TP**

Frame türleri:

* Single Frame  
* First Frame  
* Consecutive Frame  
* Flow Control

Alanlar:

* Payload length  
* Sequence number  
* Block size  
* Separation time  
* Padding  
* Addressing mode

## **21.2 UDS**

Desteklenecek servisler:

0x10 Diagnostic Session Control  
0x11 ECU Reset  
0x14 Clear Diagnostic Information  
0x19 Read DTC Information  
0x22 Read Data By Identifier  
0x27 Security Access  
0x28 Communication Control  
0x2E Write Data By Identifier  
0x31 Routine Control  
0x34 Request Download  
0x36 Transfer Data  
0x37 Request Transfer Exit  
0x3E Tester Present  
0x85 Control DTC Setting

Positive response:

Response SID \= Request SID \+ 0x40

Negative response:

0x7F  
Original SID  
Negative Response Code

## **21.3 OBD-II**

Destekle:

* Mode 01  
* Mode 03  
* Mode 04  
* Mode 09  
* PID decoder  
* DTC decoder  
* VIN decoder

Örnek RPM:

RPM \= ((A × 256\) \+ B) / 4

Araç hızı:

Vehicle Speed \= A km/h

Motor sıcaklığı:

Temperature \= A \- 40 °C

---

# **22\. FlexRay, SENT ve PSI5**

## **FlexRay**

* Frame ID  
* Cycle count  
* Payload length  
* Header CRC  
* Frame CRC  
* Static segment  
* Dynamic segment  
* Channel A/B  
* Timing overview

## **SENT**

* Sync pulse  
* Status nibble  
* Data nibbles  
* CRC nibble  
* Pause pulse  
* Fast channel  
* Slow channel

Nibble değeri pulse süresinden hesaplanmalıdır.

## **PSI5**

* Frame type  
* Slot  
* Data bits  
* Parity  
* CRC  
* Sensor addressing  
* Synchronous/asynchronous mode

Bu protokollerde ilk sürümde doğrudan fiziksel sinyal yakalama zorunlu değildir. Kullanıcı pulse veya frame loglarını içe aktarabilmelidir.

---

# **23\. NMEA 0183**

Genel yapı:

$TALKER,FIELD1,FIELD2,...\*CHECKSUM

Checksum:

$ ve \* arasındaki karakterlerin XOR sonucu

Desteklenecek mesajlar:

* GGA  
* RMC  
* GSA  
* GSV  
* VTG  
* HDT  
* HDG  
* MWV  
* DBT  
* DPT  
* ZDA  
* GLL  
* ROT  
* RSA  
* VHW  
* VLW  
* XDR  
* MTW

Koordinat dönüşümü:

Decimal Degrees \=  
Degrees \+ Minutes / 60

South ve West negatif olmalıdır.

Canlı gösterimler:

* Koordinat  
* Heading  
* Speed  
* Depth  
* Wind  
* Satellite count  
* Altitude  
* Fix quality  
* Checksum state

---

# **24\. NMEA 2000**

NMEA 2000, CAN ve J1939 benzeri 29-bit identifier yapısı üzerinden analiz edilmelidir.

Destekle:

* PGN  
* Source address  
* Destination  
* Priority  
* Fast packet  
* Single frame  
* Multi-packet  
* Device instance  
* Manufacturer code  
* Product information

Örnek PGN kategorileri:

* Position  
* Heading  
* Speed  
* Depth  
* Wind  
* Engine  
* Battery  
* Environmental  
* AIS  
* Navigation

NMEA 2000 logları için:

* Candump import  
* CSV import  
* JSON import  
* USB-CAN bridge

desteği sağla.

---

# **25\. AIS Decoder**

AIS mesajları NMEA taşıma cümlelerinden çözülebilmelidir.

Destekle:

* AIVDM  
* AIVDO  
* Fragment count  
* Fragment number  
* Channel  
* Payload  
* Fill bits

AIS 6-bit ASCII payload decoder geliştir.

Temel mesaj tipleri:

* Position Report Class A  
* Static and Voyage Data  
* Class B Position Report  
* Base Station Report  
* Safety Related Message

Göster:

* MMSI  
* Latitude  
* Longitude  
* Course over ground  
* Speed over ground  
* Heading  
* Navigation status  
* Ship name  
* Call sign  
* Ship type

---

# **26\. MAVLink**

Destekle:

* MAVLink 1  
* MAVLink 2  
* Signing  
* Sequence counter  
* Message CRC  
* CRC extra  
* System ID  
* Component ID

Mesajlar:

* HEARTBEAT  
* SYS\_STATUS  
* GPS\_RAW\_INT  
* ATTITUDE  
* GLOBAL\_POSITION\_INT  
* LOCAL\_POSITION\_NED  
* VFR\_HUD  
* BATTERY\_STATUS  
* COMMAND\_LONG  
* COMMAND\_ACK  
* PARAM\_VALUE  
* HIGHRES\_IMU

Grafikler:

* Roll  
* Pitch  
* Yaw  
* Altitude  
* GPS  
* Ground speed  
* Battery  
* Packet loss

Paket kaybı:

Delta \=  
(Current Sequence \- Previous Sequence) mod 256

Delta \> 1 ise:  
Lost Packets \= Delta \- 1

---

# **27\. ARINC 429**

32-bit word decoder geliştir.

Alanlar:

Label  
SDI  
Data  
SSM  
Parity

Özellikler:

* Octal label  
* Bit order handling  
* BNR  
* BCD  
* Discrete  
* Signed value  
* Scale  
* Parity validation  
* SSM interpretation

BNR fiziksel değer:

Physical Value \=  
Raw Signed Value × Resolution

İlk sürüm log tabanlı çalışmalıdır.

---

# **28\. Ethernet ve ağ protokolleri**

Kullanıcı HEX, PCAP veya bridge üzerinden ağ paketlerini analiz edebilmelidir.

## **28.1 Ethernet II**

Alanlar:

* Destination MAC  
* Source MAC  
* EtherType  
* VLAN  
* Payload  
* FCS bilgisi mevcutsa doğrulama

## **28.2 IPv4**

Alanlar:

* Version  
* IHL  
* DSCP  
* Total length  
* Identification  
* Flags  
* Fragment offset  
* TTL  
* Protocol  
* Header checksum  
* Source IP  
* Destination IP

IPv4 header checksum doğrulaması ekle.

## **28.3 UDP**

* Source port  
* Destination port  
* Length  
* Checksum  
* Payload

## **28.4 TCP**

* Source port  
* Destination port  
* Sequence  
* Acknowledgment  
* Flags  
* Window  
* Checksum  
* Options  
* Payload

TCP flags:

* FIN  
* SYN  
* RST  
* PSH  
* ACK  
* URG  
* ECE  
* CWR

## **28.5 MQTT**

Destekle:

* CONNECT  
* CONNACK  
* PUBLISH  
* PUBACK  
* SUBSCRIBE  
* SUBACK  
* UNSUBSCRIBE  
* PINGREQ  
* PINGRESP  
* DISCONNECT

Göster:

* Topic  
* QoS  
* Retain  
* Duplicate  
* Packet identifier  
* Payload  
* Properties

## **28.6 CoAP**

* Version  
* Type  
* Token length  
* Code  
* Message ID  
* Token  
* Options  
* Payload

---

# **29\. Endüstriyel Ethernet**

Aşağıdaki protokoller için log tabanlı veya PCAP tabanlı decoder ekle:

* EtherCAT  
* ProfiNet  
* EtherNet/IP  
* CIP  
* Sercos III  
* POWERLINK  
* Modbus TCP  
* OPC UA temel görüntüleme  
* IEC 61850 GOOSE  
* DNP3 TCP  
* IEC 60870-5-104

Her protokol için ilk aşamada:

* Header  
* Message type  
* Address  
* Command/service  
* Sequence  
* Length  
* Status  
* Error  
* Payload

alanlarını çözümle.

İleri seviye mühendislik tanımları sonradan genişletilebilir.

---

# **30\. BACnet, KNX, DALI ve bina otomasyonu**

## **BACnet**

Destekle:

* BACnet MS/TP  
* BACnet/IP  
* Device instance  
* Object type  
* Object instance  
* Property identifier  
* Service choice  
* APDU  
* NPDU

## **KNX**

* Control field  
* Source address  
* Destination address  
* Routing counter  
* Length  
* APCI  
* Data  
* Checksum

## **DALI**

* Address  
* Command  
* Data  
* Forward frame  
* Backward frame  
* Timing information

## **DMX512**

* Break  
* Mark after break  
* Start code  
* Channel values  
* Refresh rate  
* Universe  
* Art-Net packet  
* sACN packet

---

# **31\. BLE, Zigbee, Thread ve LoRaWAN**

## **BLE**

* Advertising packet  
* Device address  
* Advertising type  
* Manufacturer data  
* Service UUID  
* Service data  
* RSSI  
* GATT characteristic  
* Notification decoder

## **Zigbee**

* Frame control  
* Sequence  
* PAN ID  
* Source  
* Destination  
* Cluster  
* Profile  
* Payload

## **Thread**

* IPv6  
* UDP  
* CoAP  
* Mesh addressing  
* Network data

## **LoRaWAN**

Destekle:

* Join Request  
* Join Accept  
* Unconfirmed Data Up  
* Confirmed Data Up  
* Unconfirmed Data Down  
* Confirmed Data Down

Alanlar:

* MHDR  
* DevAddr  
* FCtrl  
* FCnt  
* FPort  
* FRMPayload  
* MIC

Güvenlik anahtarı girilmişse yerel çözümleme yapılabilir. Anahtarlar dışarı gönderilmemelidir.

---

# **32\. AT Command Studio**

GSM, LTE, GNSS, Wi-Fi ve Bluetooth modemleri için AT komut terminali geliştir.

Özellikler:

* Komut geçmişi  
* Otomatik CR/LF  
* Komut şablonları  
* Beklenen cevap  
* Timeout  
* Regex tabanlı response parser  
* Çok satırlı cevap  
* URC mesajları  
* Script oluşturma

Örnek:

AT  
AT+GMR  
AT+CSQ  
AT+CREG?  
AT+CGATT?  
AT+CGPSINFO

Komut sekansları:

1\. Send AT  
2\. Expect OK  
3\. Send AT+CSQ  
4\. Parse signal quality  
5\. Fail if response timeout

---

# **33\. Protocol Converter**

Farklı protokoller arasında alan eşleme aracı oluştur.

Örnek dönüşümler:

* Modbus register → MQTT topic  
* NMEA heading → CAN signal  
* CAN DBC signal → JSON  
* UART custom frame → UDP packet  
* J1939 SPN → CSV  
* BACnet property → MQTT  
* Modbus TCP → Modbus RTU  
* NMEA 0183 → NMEA 2000 gösterim modeli

Kullanıcı kaynak ve hedef alanlarını eşleyebilmelidir.

Mapping örneği:

Source:  
Modbus Register 40001

Transform:  
value × 0.1

Destination:  
MQTT Topic: sensors/temperature

---

# **34\. Log Analyzer**

Desteklenen formatlar:

* TXT  
* CSV  
* JSON  
* BIN  
* ASC  
* Candump  
* PCAP  
* PCAPNG  
* Serial terminal logs  
* Custom timestamped logs

Özellikler:

* Otomatik delimiter tespiti  
* Timestamp sütunu seçme  
* Direction sütunu seçme  
* Data sütunu seçme  
* ID sütunu seçme  
* Protocol auto-detection  
* Frame extraction  
* CRC validation  
* Error filtering  
* Timeline  
* Statistics  
* Export

Büyük dosyalar Web Worker içinde işlenmelidir.

Tablolar sanallaştırılmalıdır.

---

# **35\. Bilinmeyen protokol analizi**

Unknown Protocol Analyzer geliştir.

Özellikler:

* Sabit byte tespiti  
* Değişen byte tespiti  
* Sayaç tespiti  
* Uzunluk alanı tespiti  
* Checksum tahmini  
* CRC tahmini  
* Timestamp tahmini  
* ASCII alanı tespiti  
* Endianness tahmini  
* Entropy analizi  
* Mesaj kümelendirme  
* Periyot analizi  
* Korelasyon analizi

Change rate:

ChangeRate\_i \=  
Count(Byte\_i(t) ≠ Byte\_i(t-1))  
/  
(N \- 1\)

Entropy:

H(X) \=  
\-Σ p(x) × log2(p(x))

Counter detection:

Delta\_t \=  
Value\_t \- Value\_(t-1)

Checksum eşleşme oranı:

Match Rate \=  
Matching Frames /  
Total Frames  
× 100

---

# **36\. Message Difference Analyzer**

İki veya daha fazla mesajı karşılaştır.

Göster:

* Değişen byte  
* Değişen bit  
* XOR difference  
* Decimal difference  
* Signed difference  
* Sabit alan  
* Muhtemel sayaç  
* Muhtemel CRC  
* Muhtemel payload  
* Korelasyon

Örnek:

Packet A:  
AA 01 10 04 25 01 00 00 7C 55

Packet B:  
AA 01 10 04 2A 01 00 00 91 55

Çıktı:

Byte 4:  
0x25 → 0x2A  
Difference: \+5

Byte 8:  
0x7C → 0x91  
Possible checksum field

---

# **37\. Gerçek zamanlı grafik ve sinyal sistemi**

Her sayısal alan grafiğe eklenebilmelidir.

Özellikler:

* Live chart  
* Pause  
* Resume  
* Zoom  
* Pan  
* Multiple signals  
* Unit  
* Min  
* Max  
* Average  
* RMS  
* Standard deviation  
* Rolling window  
* CSV export  
* PNG export  
* Downsampling  
* Threshold  
* Alarm

Örnek sinyaller:

* Temperature  
* Voltage  
* Current  
* RPM  
* Heading  
* Altitude  
* Depth  
* Wind speed  
* CAN signal  
* Modbus register  
* J1939 SPN  
* MQTT payload value

---

# **38\. Test Automation Studio**

Kullanıcı haberleşme test senaryoları oluşturabilmelidir.

Adımlar:

* Connect  
* Disconnect  
* Send frame  
* Wait  
* Wait for frame  
* Validate field  
* Validate CRC  
* Set variable  
* Increment variable  
* Loop  
* Conditional branch  
* Log result  
* Export report

Örnek:

1\. Connect to COM4 at 115200 baud  
2\. Send status request  
3\. Wait up to 500 ms  
4\. Expect command 0x31  
5\. Validate CRC  
6\. Read temperature  
7\. Fail if temperature \> 85 °C  
8\. Repeat 100 times  
9\. Export report

Rapor:

* Test name  
* Start time  
* End time  
* Pass  
* Fail  
* Timeout  
* Received frame  
* Expected value  
* Actual value  
* Error details

---

# **39\. Haberleşme istatistikleri**

Hesapla:

* Total frames  
* Valid frames  
* Invalid frames  
* RX bytes  
* TX bytes  
* CRC errors  
* Checksum errors  
* Framing errors  
* Timeout errors  
* Packet rate  
* Byte rate  
* Average frame length  
* Min frame length  
* Max frame length  
* Packet loss  
* Sequence errors  
* Mean period  
* Jitter  
* Bus load  
* Response time  
* Minimum response  
* Maximum response

CRC error rate:

CRC Error Rate \=  
CRC Error Frames /  
CRC Checked Frames  
× 100

Packet loss:

Packet Loss Rate \=  
Missing Packets /  
Expected Packets  
× 100

Jitter:

Jitter\_i \=  
Period\_i \- Mean Period

Standart sapma:

σ \=  
sqrt\[  
Σ(Period\_i \- Mean Period)^2 / N  
\]

---

# **40\. Proje yönetimi**

Bir proje şunları saklamalıdır:

* Project name  
* Description  
* Connection profiles  
* Protocol definitions  
* Packet templates  
* Decoder settings  
* Filters  
* Graph configurations  
* Test scenarios  
* Saved logs  
* Mapping rules  
* User notes

JSON proje yapısı version içermelidir.

{  
  "formatVersion": 1,  
  "project": {  
    "name": "ALP Marine Communication Test",  
    "description": "NMEA and Modbus analysis",  
    "connections": \[\],  
    "protocols": \[\],  
    "packetTemplates": \[\],  
    "charts": \[\],  
    "tests": \[\]  
  }  
}

Import sırasında:

* Schema validation  
* Version check  
* Migration  
* Error handling  
* Unknown field handling

uygula.

---

# **41\. Gizlilik ve güvenlik**

Temel işlemler yerel olarak gerçekleştirilmelidir.

Sunucuya gönderilmemesi gereken veriler:

* Seri port mesajları  
* CAN logları  
* Özel protokol tanımları  
* Modbus register değerleri  
* Ağ paketleri  
* Şifreleme anahtarları  
* LoRaWAN anahtarları  
* Test logları

Kurallar:

* Kullanıcı izni olmadan port açma  
* `eval` kullanma  
* Dinamik kod çalıştırma  
* HTML sanitize et  
* Dosya boyutu sınırı uygula  
* Parser timeout kullan  
* Maximum frame length uygula  
* Worker cancellation uygula  
* Sonsuz loop engelle  
* Anahtarları kalıcı saklama seçeneğini varsayılan olarak kapalı tut

---

# **42\. Kullanıcı deneyimi standardı**

Her araç şu bölümleri içermelidir:

1. Araç ne işe yarar?  
2. Hangi protokol veya arayüz için kullanılır?  
3. Giriş alanları  
4. Örnek veri  
5. Analiz veya hesaplama butonu  
6. Sonuç  
7. Formül  
8. Adım adım hesap  
9. Sonucun yorumu  
10. Sınırlamalar  
11. Yaygın hatalar  
12. Kopyalama  
13. Dışa aktarma

Hata mesajları açıklayıcı olmalıdır:

Invalid hexadecimal input  
Frame length does not match the length field  
CRC mismatch  
Unsupported function code  
Start delimiter not found  
Value exceeds uint16 range  
Serial port permission denied  
Protocol definition contains circular length references

---

# **43\. Test gereksinimleri**

Bütün hesaplama motorları ve parser’lar için birim testi yaz.

Temel testler:

## **CRC**

Input: 123456789  
CRC-8: 0xF4  
CRC-16 CCITT-FALSE: 0x29B1  
CRC-16 MODBUS: 0x4B37  
CRC-32: 0xCBF43926

## **UART**

Baud: 115200  
Format: 8N1  
Length: 20 byte  
Expected time: approximately 1.736 ms

## **Modbus RTU**

01 03 00 00 00 02 C4 0B

Beklenen:

Address: 1  
Function: 3  
Start register: 0  
Register count: 2  
CRC: valid

## **NMEA**

$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,\*47

Beklenen:

Latitude: 48.1173  
Longitude: 11.516666...  
Checksum: valid

## **Custom protocol**

AA 05 10 03 34 12 7F 4F 55

Beklenen:

Address: 5  
Command: 0x10  
Length: 3  
Payload: 34 12 7F  
XOR checksum: valid  
EOF: valid

## **J1939**

CAN ID: 0x18F00401

Beklenen:

Priority: 6  
PGN: 61444  
Source address: 1

## **IEEE-754**

Float: 25.75  
Big-endian: 41 CE 00 00  
Little-endian: 00 00 CE 41

---

# **44\. Performans hedefleri**

* Ana sayfa hızlı açılmalı  
* Basit hesaplamalar anlık yapılmalı  
* 100.000 satırlık log arayüzü dondurmamalı  
* Canlı akış UI thread’i bloklamamalı  
* Parser saniyede binlerce frame işleyebilmeli  
* Grafik maksimum nokta sayısını sınırlamalı  
* Büyük tablolar virtualized olmalı  
* Ağır analizler Web Worker içinde çalışmalı  
* Protocol auto-detection iptal edilebilir olmalı  
* Log parsing progress göstergesi bulunmalı

---

# **45\. Sürüm planı**

## **Version 1.0 — Temel haberleşme araçları**

* Ana sayfa  
* HEX ve ASCII converter  
* Endian converter  
* IEEE-754 converter  
* CRC calculator  
* UART calculator  
* SPI calculator  
* I²C calculator  
* Live Serial Monitor  
* Custom Protocol Studio  
* Packet Builder  
* Modbus RTU  
* Modbus TCP  
* NMEA 0183  
* Log export  
* Project save/load  
* Dark mode

## **Version 1.1 — CAN ve otomotiv**

* CAN analyzer  
* CAN FD  
* DBC  
* CAN bus load  
* CAN timing  
* J1939  
* CANopen  
* LIN  
* ISO-TP  
* UDS  
* OBD-II

## **Version 1.2 — Denizcilik ve havacılık**

* NMEA 2000  
* AIS  
* MAVLink  
* DroneCAN  
* UBX  
* RTCM  
* ARINC 429  
* Live navigation dashboard

## **Version 1.3 — Endüstri ve bina otomasyonu**

* Profibus temel analyzer  
* ProfiNet  
* EtherCAT  
* EtherNet/IP  
* IO-Link  
* HART  
* BACnet  
* KNX  
* DALI  
* DMX512

## **Version 1.4 — Ağ ve IoT**

* Ethernet  
* IPv4  
* IPv6  
* TCP  
* UDP  
* MQTT  
* CoAP  
* BLE  
* Zigbee  
* LoRaWAN  
* PCAP import

## **Version 1.5 — İleri analiz**

* Unknown Protocol Analyzer  
* CRC Finder  
* Protocol Converter  
* Test Automation Studio  
* Message clustering  
* Automatic field detection  
* Code generation  
* Protocol documentation generation

---

# **46\. Geliştirme sırası**

Phase 1:  
Project setup  
Routing  
Theme  
Layout  
Translation system  
Reusable components

Phase 2:  
Byte utilities  
Conversion engine  
CRC engine  
Timing calculators  
Unit tests

Phase 3:  
Stream buffer  
Framing engine  
Protocol parser interface  
Field decoder  
Field encoder

Phase 4:  
Custom Protocol Studio  
Packet Builder  
Project storage

Phase 5:  
Web Serial Monitor  
Live parser  
Charts  
Statistics

Phase 6:  
Modbus  
NMEA 0183  
CAN  
DBC  
J1939

Phase 7:  
CANopen  
LIN  
ISO-TP  
UDS  
OBD-II

Phase 8:  
NMEA 2000  
AIS  
MAVLink  
UBX  
RTCM

Phase 9:  
Ethernet  
TCP/IP  
MQTT  
CoAP  
PCAP

Phase 10:  
Industrial protocols  
Wireless protocols  
Reverse engineering  
Test automation

---

# **47\. Kod kalitesi**

* TypeScript strict mode kullan  
* `any` kullanımını en aza indir  
* Pure function kullan  
* Parser ve UI kodlarını ayır  
* Magic number kullanma  
* Sabitleri anlamlı isimlendir  
* Discriminated union kullan  
* BigInt gereken yerlerde BigInt kullan  
* Floating-point sonuçlarında tolerans kullan  
* Her parser için test fixture oluştur  
* Hatalı veride uygulamayı çökertme  
* Parser recovery mekanizması geliştir  
* Protokol eklentisi mantığını destekle

Protocol plugin tanımı:

interface ProtocolPlugin {  
  id: string;  
  name: string;  
  category: ProtocolCategory;  
  parser?: ProtocolParser;  
  encoder?: ProtocolEncoder\<unknown\>;  
  calculators?: CalculatorDefinition\[\];  
  documentation?: ProtocolDocumentation;  
  exampleFrames: ExampleFrame\[\];  
}

---

# **48\. Kabul kriterleri**

Proje şu koşulları sağlamadan tamamlanmış kabul edilmemelidir:

* Kullanıcı farklı HEX giriş biçimlerini girebilmeli  
* Custom Protocol Studio ile alan tanımlayabilmeli  
* Dynamic payload length çalışmalı  
* CRC ve checksum doğrulanabilmeli  
* Paket alanları renklendirilebilmeli  
* Kullanıcı tanımlı protokolden paket üretilebilmeli  
* Web Serial üzerinden veri alınabilmeli  
* Parçalı serial chunk’lar birleştirilebilmeli  
* Modbus RTU ve TCP çözümlenebilmeli  
* NMEA checksum doğrulanabilmeli  
* CAN frame analiz edilebilmeli  
* DBC signal dönüşümü yapılabilmeli  
* J1939 PGN hesaplanabilmeli  
* Formüller ve ara adımlar gösterilmeli  
* Proje JSON olarak kaydedilebilmeli  
* Log dosyaları büyük veride UI’ı dondurmamalı  
* Koyu tema çalışmalı  
* Mobil görünüm kullanılabilir olmalı  
* Kullanıcı verileri varsayılan olarak yerel kalmalı

---

# **49\. Beklenen teslimat**

Aşağıdaki çıktıları oluştur:

1. Çalışan React ve TypeScript projesi  
2. Modüler klasör yapısı  
3. Tema ve responsive tasarım  
4. Protocol Core  
5. CRC engine  
6. Conversion engine  
7. Timing calculator engine  
8. Web Serial bağlantı katmanı  
9. Protocol Studio  
10. Packet Builder  
11. Modbus decoder  
12. NMEA decoder  
13. CAN ve J1939 temel araçları  
14. Unit testler  
15. Örnek log dosyaları  
16. Örnek özel protokol tanımları  
17. README  
18. Kullanım dokümantasyonu  
19. Deployment ayarları  
20. GitHub Pages uyumlu build

README bölümleri:

Project Overview  
Features  
Supported Protocols  
Architecture  
Installation  
Development  
Testing  
Deployment  
Web Serial Usage  
Local Bridge Usage  
Adding a New Protocol  
Protocol Definition Format  
Security and Privacy  
Roadmap

---

# **50\. Son geliştirme talimatı**

Projeyi tek bir dosyada yazma.

Önce uygulama mimarisini, routing yapısını, temel UI bileşenlerini ve Protocol Core sistemini oluştur.

Daha sonra hesaplama motorlarını ve veri dönüştürücüleri geliştir.

İlk çalışan teslimatta şu araçlar gerçekten çalışmalıdır:

* HEX / ASCII Converter  
* IEEE-754 Converter  
* Endian Converter  
* CRC Calculator  
* UART Calculator  
* SPI Calculator  
* I²C Calculator  
* Live Serial Monitor  
* Custom Protocol Studio  
* Packet Builder  
* Modbus RTU Decoder  
* Modbus TCP Decoder  
* NMEA 0183 Decoder  
* CAN Frame Decoder  
* J1939 ID Decoder

Boş veya yalnızca görsel kartlar oluşturma.

Her aracın gerçek hesaplama veya parsing motoru bulunmalıdır.

Her sonuç ekranında:

* Nihai sonuç  
* Ham değer  
* Fiziksel değer  
* Kullanılan formül  
* Ara hesaplamalar  
* Birimler  
* Doğrulama durumu  
* Hata ve uyarılar

gösterilmelidir.

Özellikle dokümanda artık ayrı ayrı **Industrial, Automotive, Marine, Aerospace, Building, Network ve Wireless** protocol klasörleri bile öngörülüyor. Ana sayfayı ben şöyle revize ederdim:

1. **Live Communication** — Serial, USB, Bluetooth, WebSocket bridge, canlı RX/TX ve gerçek zamanlı frame analizi.  
2. **Protocol Studio** — Custom Protocol Studio, Packet Builder, custom binary/ASCII framing, encoder/decoder oluşturma. `Protocol Encoders` ve `Protocol Decoders` ayrı ana kategori olmaktan çıksın; burada ve ilgili sektör kategorilerinde yer alsın.  
3. **Serial & Interfaces** — UART, RS-232/422/485, SPI, I²C, I3C, SMBus, PMBus, 1-Wire, USB, CAN/LIN/FlexRay physical layer, 4–20 mA vb.  
4. **Industrial Automation** — Modbus, PROFIBUS, PROFINET, EtherCAT, EtherNet/IP, CIP, CANopen, IO-Link, HART, OPC UA, IEC 60870, DNP3, IEC 61850 vb.  
5. **Automotive** — CAN/CAN FD/CAN XL, J1939, LIN, FlexRay, SENT, PSI5, ISO-TP, UDS, OBD-II, DoIP, SOME/IP, XCP/CCP vb.  
6. **Marine & Navigation** — NMEA 0183/2000, IEC 61162, AIS, GNSS, UBX, RTCM, SeaTalk, marine J1939 vb.  
7. **Aerospace & UAV** — MAVLink, DroneCAN, Cyphal, SBUS, CRSF, ARINC 429, MIL-STD-1553, ADS-B, Mode-S, GNSS/RTCM vb. **Bu şu an ana sayfa kategorilerinde tamamen eksik.**  
8. **Building Automation** — BACnet, KNX, DALI, M-Bus, LonWorks, DMX512, Art-Net, sACN. **Bu da şu an ana sayfada eksik.**  
9. **Network & Ethernet** — Ethernet, VLAN, ARP, IPv4/IPv6, TCP/UDP, DHCP, DNS, NTP, SNMP, HTTP, WebSocket, RTP/RTCP, PTP, LLDP, mDNS vb.  
10. **Wireless & IoT** — BLE, Zigbee, Thread, Matter, LoRa/LoRaWAN, Wi-Fi, ESP-NOW, Wireless M-Bus, NB-IoT, modem/GNSS haberleşmeleri.  
11. **Data Conversion** — HEX/ASCII/Binary, endian, signed/unsigned, IEEE-754, BCD, bit-field, unit/engineering value dönüşümleri.  
12. **CRC & Data Integrity** — CRC Calculator, checksum, parity, XOR/LRC, CRC Finder, integrity verification.  
13. **Timing & Bus Calculators** — UART timing, I²C pull-up, SPI timing, CAN bit timing/bus load, Modbus timing, network throughput, LoRa airtime vb.  
14. **Log & Capture Analyzer** — TXT/CSV/PCAP/serial log import, filtreleme, statistics, timeline, multi-protocol capture analizi.  
15. **Protocol Reverse Engineering** — Unknown Protocol Analyzer, field detection, counter tespiti, CRC Finder, clustering, entropy/değişken byte analizi.  
16. **Test & Simulation** — Test Automation Studio, frame generator, error injection, request/response simulation, protocol/device simulator.  
17. **Projects & Documentation** — Project Manager, kayıtlı connection/profile/schema'lar, protocol documentation, code generation ve export.

Bence **en büyük değişiklik** şu olsun: `Protocol Decoders` ve `Protocol Encoders` ana sayfa kategorisi olmaktan çıksın. Çünkü artık neredeyse her sektör kategorisinin kendi decoder/encoder'ı var. Onun yerine eksik olan **Aerospace & UAV**, **Building Automation** ve **Serial & Interfaces** ana kategori olsun.

Ana sayfa böyle çok daha mantıklı akar:

> LIVE & DEVELOPMENT

> Live Communication

> Protocol Studio

> 

> COMMUNICATION DOMAINS

> Serial & Interfaces

> Industrial Automation

> Automotive

> Marine & Navigation

> Aerospace & UAV

> Building Automation

> Network & Ethernet

> Wireless & IoT

> 

> ENGINEERING TOOLS

> Data Conversion

> CRC & Data Integrity

> Timing & Bus Calculators

> 

> ANALYSIS & TEST

> Log & Capture Analyzer

> Protocol Reverse Engineering

> Test & Simulation

> 

> WORKSPACE

> Projects & Documentation

> 

# **COMMUNICATION DOMAINS**

Communication Domains bölümü 8 ana kategoriye ayrılmalıdır:

Communication Domains  
│  
├── 1\. Interfaces & Framing  
├── 2\. Industrial Automation  
├── 3\. Automotive  
├── 4\. Marine & Navigation  
├── 5\. Aerospace & UAV  
├── 6\. Building Automation  
├── 7\. Network & Ethernet  
└── 8\. Wireless & IoT

Her ana kategori açıldığında önce **protokol aileleri**, onların altında **protokoller**, protokol açıldığında ise **o protokole ait analiz araçları** görünmelidir.

Genel hiyerarşi:

Communication Domains  
      ↓  
Domain  
      ↓  
Protocol Family  
      ↓  
Protocol / Interface  
      ↓  
Analyzer / Decoder / Calculator / Builder / Monitor

---

# **1\. INTERFACES & FRAMING**

Bu kategori temel haberleşme arayüzleri ve genel-purpose frame/stream protokollerini içerir.

Interfaces & Framing  
│  
├── Serial Interfaces  
├── Peripheral Buses  
├── Management & Sensor Buses  
├── Host & Network Interfaces  
├── Vehicle / Field Physical Layers  
└── Framing & Stream Protocols

---

## **1.1 Serial Interfaces**

Serial Interfaces  
│  
├── UART  
├── TTL UART  
├── CMOS UART  
├── RS-232  
├── RS-422  
├── RS-485  
├── Current Loop  
└── 4–20 mA

### **UART**

UART  
│  
├── Overview  
├── Configuration  
│   ├── Baud Rate  
│   ├── Data Bits  
│   ├── Parity  
│   ├── Stop Bits  
│   ├── Bit Order  
│   └── Flow Control  
│  
├── Frame Visualizer  
│   ├── Start Bit  
│   ├── Data Bits  
│   ├── Parity Bit  
│   └── Stop Bits  
│  
├── Live UART Monitor  
├── UART Decoder  
├── UART Packet Builder  
├── Timing Calculator  
│   ├── Bit Time  
│   ├── Character Time  
│   ├── Packet Time  
│   ├── Throughput  
│   └── Efficiency  
│  
├── Baud Error Calculator  
├── Oversampling Analyzer  
├── Error Analyzer  
│   ├── Parity Error  
│   ├── Framing Error  
│   ├── Overrun  
│   ├── Break  
│   └── Timeout  
│  
└── Examples

---

### **TTL UART**

TTL UART  
│  
├── Logic-Level Configuration  
│   ├── 1.8 V  
│   ├── 2.5 V  
│   ├── 3.3 V  
│   └── 5 V  
│  
├── Logic Compatibility  
│   ├── VIH  
│   ├── VIL  
│   ├── VOH  
│   └── VOL  
│  
├── UART Frame View  
├── Live Monitor  
├── Level Compatibility Calculator  
└── Error / Warning View

---

### **CMOS UART**

CMOS UART  
│  
├── Supply Voltage  
├── Logic Thresholds  
├── TX → RX Compatibility  
├── RX → TX Compatibility  
├── Level Translation Check  
├── UART Frame View  
└── Live Monitor

---

### **RS-232**

RS-232  
│  
├── Overview  
├── UART ↔ RS-232 Layer View  
├── Signal View  
│   ├── TXD  
│   ├── RXD  
│   ├── RTS  
│   ├── CTS  
│   ├── DTR  
│   ├── DSR  
│   └── DCD  
│  
├── DTE / DCE Analyzer  
├── Null-Modem Helper  
├── DB9 Pinout Helper  
├── Frame Decoder  
├── Live Monitor  
├── Timing Calculator  
└── Error Analyzer

---

### **RS-422**

RS-422  
│  
├── Differential Signal View  
├── TX+ / TX-  
├── RX+ / RX-  
├── Full-Duplex Analyzer  
├── Voltage Difference Calculator  
├── Termination Helper  
├── Live Decoder  
├── Timing  
└── Diagnostics

---

### **RS-485**

RS-485  
│  
├── Physical Layer  
├── Half-Duplex  
├── Full-Duplex  
├── A/B Differential View  
├── DE / RE Timing  
├── Driver Turnaround  
├── Termination Calculator  
├── Bias / Fail-Safe Calculator  
├── Unit Load / Node Calculator  
├── Cable Delay Calculator  
├── Bus Timing  
├── Live Monitor  
├── Collision / Turnaround Analyzer  
└── Diagnostics

RS-485 altında ayrıca hızlı geçişler:

Related Protocols  
├── Modbus RTU  
├── Modbus ASCII  
├── BACnet MS/TP  
├── PROFIBUS  
└── Custom RS-485

olmalıdır.

---

### **Current Loop**

Current Loop  
│  
├── Digital Current Loop  
├── Loop Voltage  
├── Loop Current  
├── Cable Resistance  
├── Receiver Burden  
├── Ohm's Law Calculator  
└── Diagnostics

---

### **4–20 mA**

4–20 mA  
│  
├── Current → Engineering Value  
├── Engineering Value → Current  
├── Shunt Resistor Calculator  
├── ADC Voltage Calculator  
├── Compliance Voltage  
├── Cable Resistance  
├── Live Zero  
├── Sensor Range  
├── Fault Detection  
└── Trend View

---

# **1.2 Peripheral Buses**

Peripheral Buses  
│  
├── SPI Family  
│   ├── SPI  
│   ├── Quad SPI  
│   ├── Octal SPI  
│   └── Microwire  
│  
└── I²C Family  
    ├── I²C  
    ├── I3C  
    ├── SMBus  
    ├── PMBus  
    └── 1-Wire

---

## **SPI**

SPI  
│  
├── Configuration  
│   ├── Clock Frequency  
│   ├── CPOL  
│   ├── CPHA  
│   ├── Mode 0  
│   ├── Mode 1  
│   ├── Mode 2  
│   ├── Mode 3  
│   └── Bit Order  
│  
├── Signal View  
│   ├── SCLK  
│   ├── MOSI  
│   ├── MISO  
│   └── CS  
│  
├── Timing Diagram  
├── Transfer Decoder  
├── Register Transaction Decoder  
├── Packet Builder  
├── Transfer Time Calculator  
├── Setup / Hold Analyzer  
├── CS Timing  
├── Throughput Calculator  
└── Error Analyzer

---

## **Quad SPI**

Quad SPI  
│  
├── IO0  
├── IO1  
├── IO2  
├── IO3  
├── Command Phase  
├── Address Phase  
├── Dummy Cycles  
├── Data Phase  
├── Read Transaction  
├── Write Transaction  
├── Throughput Calculator  
└── Memory Transaction Viewer

---

## **Octal SPI**

Octal SPI  
│  
├── IO0–IO7  
├── SDR  
├── DDR  
├── DQS  
├── Command  
├── Address  
├── Dummy  
├── Data  
├── XIP  
├── Memory Transaction Analyzer  
└── Throughput Calculator

---

## **Microwire**

Microwire  
│  
├── Command Decoder  
├── Opcode  
├── Address  
├── Data  
├── Read  
├── Write  
├── EEPROM Transaction View  
└── Timing

---

## **I²C**

I²C  
│  
├── Signal View  
│   ├── SDA  
│   └── SCL  
│  
├── START / STOP  
├── Address Decoder  
│   ├── 7-bit  
│   └── 10-bit  
│  
├── Read / Write Bit  
├── ACK / NACK  
├── Register Transaction  
├── Repeated START  
├── Clock Stretch  
├── Arbitration  
├── Bus Scanner  
├── Timing Calculator  
├── Pull-Up Calculator  
├── Bus Capacitance  
├── Bus Utilization  
├── Live Decoder  
├── Transaction Builder  
└── Error Analyzer

---

## **I3C**

I3C  
│  
├── Device Discovery  
├── Static Address  
├── Dynamic Address  
├── ENTDAA  
├── CCC Commands  
├── SDR Traffic  
├── HDR Traffic  
├── IBI  
├── Hot-Join  
├── Legacy I²C Devices  
├── Device Table  
└── Diagnostics

---

## **SMBus**

SMBus  
│  
├── Quick Command  
├── Send Byte  
├── Receive Byte  
├── Read Byte  
├── Write Byte  
├── Read Word  
├── Write Word  
├── Block Read  
├── Block Write  
├── PEC  
├── Timeout  
└── Transaction Decoder

---

## **PMBus**

PMBus  
│  
├── Device Explorer  
├── Command Browser  
├── READ\_VOUT  
├── READ\_IOUT  
├── READ\_TEMPERATURE  
├── STATUS  
├── Linear11 Decoder  
├── Linear16 Decoder  
├── Direct Format Decoder  
├── Telemetry Dashboard  
├── Fault Decoder  
└── Command Builder

---

## **1-Wire**

1-Wire  
│  
├── Reset Pulse  
├── Presence Pulse  
├── ROM Commands  
├── 64-bit ROM ID  
├── Search ROM  
├── Device Tree  
├── Scratchpad  
├── Read / Write Slot  
├── Parasite Power  
└── Timing Analyzer

---

# **1.3 Host & Network Interfaces**

Host & Network Interfaces  
│  
├── USB  
├── Ethernet  
└── Single Pair Ethernet

### **USB**

USB  
│  
├── Device Enumeration  
├── Descriptors  
│   ├── Device  
│   ├── Configuration  
│   ├── Interface  
│   ├── Endpoint  
│   └── String  
│  
├── Control Transfer  
├── Bulk Transfer  
├── Interrupt Transfer  
├── Isochronous Transfer  
├── Endpoint Explorer  
├── PID Decoder  
├── Setup Packet  
└── Error Analyzer

---

### **Ethernet Interface**

Buradaki Ethernet **fiziksel/interface görünümüdür**.

Ethernet Interface  
│  
├── Link Status  
├── PHY  
├── Speed  
├── Duplex  
├── Auto-Negotiation  
├── MII  
├── RMII  
├── GMII  
├── RGMII  
├── MDIO / MDC  
└── PHY Register Viewer

Asıl packet protocol'leri:

Network & Ethernet

ana kategorisinde bulunmalıdır.

---

### **Single Pair Ethernet**

Single Pair Ethernet  
│  
├── 10BASE-T1S  
├── 10BASE-T1L  
├── 100BASE-T1  
├── 1000BASE-T1  
├── PLCA  
├── PHY Configuration  
├── Link Status  
└── Diagnostics

---

# **1.4 Vehicle / Field Physical Layers**

Vehicle / Field Physical Layers  
│  
├── CAN Physical Layer  
├── LIN Physical Layer  
└── FlexRay Physical Layer

### **CAN PHY**

CAN PHY  
│  
├── CANH / CANL  
├── Differential Voltage  
├── Dominant / Recessive  
├── Termination  
├── Split Termination  
├── Bus Topology  
├── Propagation Delay  
├── Transceiver Delay  
└── Physical Diagnostics

### **LIN PHY**

LIN PHY  
│  
├── Single-Wire Signal  
├── Dominant / Recessive  
├── Wake-Up  
├── Break  
├── Transceiver View  
└── Physical Diagnostics

### **FlexRay PHY**

FlexRay PHY  
│  
├── Channel A  
├── Channel B  
├── Differential Signal  
├── Passive Bus  
├── Active Star  
├── Hybrid Topology  
└── Physical Diagnostics

---

# **1.5 Framing & Stream Protocols**

Framing & Stream Protocols  
│  
├── Custom Framing  
├── Encapsulation & Escaping  
├── Data Transfer Protocols  
├── Navigation Binary Protocols  
└── Command Protocols

---

## **Custom Framing**

Custom Framing  
│  
├── Custom Binary Protocol  
│   ├── Header  
│   ├── Address  
│   ├── Command  
│   ├── Length  
│   ├── Payload  
│   ├── CRC  
│   ├── Parser Builder  
│   └── Packet Builder  
│  
├── ASCII Protocol  
├── Delimiter-Based Protocol  
└── Length-Based Protocol

---

## **Encapsulation & Escaping**

Encapsulation & Escaping  
│  
├── SLIP  
│   ├── Encode  
│   ├── Decode  
│   └── Escape View  
│  
├── COBS  
│   ├── Encode  
│   ├── Decode  
│   └── Overhead Calculator  
│  
├── HDLC  
│   ├── Flag  
│   ├── Bit Stuffing  
│   ├── Address  
│   ├── Control  
│   ├── Payload  
│   └── FCS  
│  
├── SDLC  
├── PPP  
└── KISS

---

## **Data Transfer Protocols**

Data Transfer Protocols  
│  
├── XMODEM  
├── YMODEM  
└── ZMODEM

Her biri:

Transfer Session  
├── Blocks  
├── Sequence  
├── ACK / NAK  
├── CRC  
├── Retry  
├── Progress  
└── Errors

---

## **Navigation Binary Protocols**

Navigation Binary  
│  
├── UBX  
└── RTCM

Bunlar ayrıca Marine ve Aerospace kategorilerinden **cross-link** almalıdır.

---

## **Command Protocols**

Command Protocols  
│  
├── AT Commands  
│   ├── Command Parser  
│   ├── Response Parser  
│   ├── URC  
│   ├── State Machine  
│   └── Command Console  
│  
└── Hayes Command Set  
    ├── Basic Commands  
    ├── Dial Commands  
    ├── S Registers  
    └── Result Codes

---

# **2\. INDUSTRIAL AUTOMATION**

Industrial Automation  
│  
├── Modbus  
├── Classic Fieldbus  
├── Industrial Ethernet  
├── CIP & CAN-Based  
├── Sensors & Device Integration  
├── Process Instrumentation  
├── Metering  
└── SCADA & Utility

---

# **2.1 Modbus**

Modbus  
│  
├── Modbus RTU  
├── Modbus ASCII  
└── Modbus TCP

### **Modbus RTU**

Modbus RTU  
│  
├── Frame Decoder  
├── Request / Response  
├── Function Codes  
├── Register Viewer  
├── Register Map  
├── Data Type Decoder  
├── Word / Byte Order  
├── CRC  
├── Timing  
├── Polling  
├── Exception Decoder  
├── Packet Builder  
├── Master Simulator  
└── Slave Simulator

### **Modbus ASCII**

Modbus ASCII  
│  
├── ASCII Frame  
├── HEX Conversion  
├── LRC  
├── Request / Response  
├── Register Map  
└── Builder

### **Modbus TCP**

Modbus TCP  
│  
├── MBAP Header  
├── Transaction ID  
├── Unit ID  
├── TCP Stream Reassembly  
├── Register Decoder  
├── Request / Response  
└── Connection Statistics

---

# **2.2 Classic Fieldbus**

Classic Fieldbus  
│  
├── PROFIBUS DP  
├── CC-Link  
├── AS-Interface  
└── FOUNDATION Fieldbus

### **PROFIBUS DP**

PROFIBUS DP  
│  
├── Station Explorer  
├── Telegram Decoder  
├── Master / Slave  
├── Cyclic I/O  
├── Parameterization  
├── Configuration  
├── Diagnostics  
├── Timing  
└── GSD Explorer

### **CC-Link**

CC-Link  
│  
├── Station Explorer  
├── Cyclic Communication  
├── Remote Inputs  
├── Remote Outputs  
├── Remote Registers  
├── Diagnostics  
└── Network Timing

### **AS-Interface**

AS-Interface  
│  
├── Master  
├── Device Address  
├── Input / Output Bits  
├── Cyclic Poll  
├── Parameter Data  
├── Diagnostics  
└── ASi-5

### **FOUNDATION Fieldbus**

FOUNDATION Fieldbus  
│  
├── H1  
├── HSE  
├── Device Explorer  
├── Resource Block  
├── Transducer Block  
├── Function Blocks  
├── Publisher / Subscriber  
└── Diagnostics

---

# **2.3 Industrial Ethernet**

Industrial Ethernet  
│  
├── PROFINET  
├── EtherCAT  
├── EtherNet/IP  
├── CC-Link IE  
├── Sercos III  
└── POWERLINK

### **PROFINET**

PROFINET  
│  
├── Device Discovery / DCP  
├── IO Controller  
├── IO Device  
├── Cyclic I/O  
├── Slot / Subslot  
├── Alarms  
├── Diagnostics  
├── Timing / Jitter  
└── GSDML Explorer

### **EtherCAT**

EtherCAT  
│  
├── Ethernet Frame  
├── EtherCAT Datagram  
├── Command  
├── Addressing  
├── Working Counter  
├── Slave States  
├── Distributed Clocks  
├── PDO  
├── Mailbox  
│   ├── CoE  
│   ├── FoE  
│   ├── EoE  
│   ├── SoE  
│   └── AoE  
│  
└── Diagnostics

### **EtherNet/IP**

EtherNet/IP  
│  
├── Encapsulation  
├── Session  
├── CIP  
├── Explicit Messaging  
├── Implicit I/O  
├── Assemblies  
├── RPI  
├── Sequence / Jitter  
└── EDS

### **CC-Link IE**

CC-Link IE  
│  
├── IE Field  
├── IE Controller  
├── IE Field Basic  
├── IE TSN  
├── Cyclic Communication  
├── Transient Communication  
└── Network Diagnostics

### **Sercos III**

Sercos III  
│  
├── Communication Cycle  
├── Real-Time Telegrams  
├── Drive Data  
├── Device Parameters  
├── State / Phase  
└── Timing

### **POWERLINK**

POWERLINK  
│  
├── Managing Node  
├── Controlled Nodes  
├── Isochronous Phase  
├── Asynchronous Phase  
├── PDO  
├── SDO  
├── NMT  
└── Diagnostics

---

# **2.4 CIP & CAN-Based Industrial**

CIP & CAN-Based  
│  
├── CIP  
├── DeviceNet  
└── CANopen

### **CIP**

CIP  
│  
├── Object  
├── Class  
├── Instance  
├── Attribute  
├── Service  
├── Path Decoder  
├── Status  
└── Device Profiles

### **DeviceNet**

DeviceNet  
│  
├── Node Explorer  
├── CAN Frame  
├── CIP Layer  
├── I/O Messaging  
├── Explicit Messaging  
└── Diagnostics

### **CANopen**

CANopen  
│  
├── Node Explorer  
├── Object Dictionary  
├── NMT  
├── PDO  
├── SDO  
├── SYNC  
├── EMCY  
├── Heartbeat  
├── EDS  
└── CiA Profiles

---

# **2.5 Sensors & Device Integration**

Sensors & Device Integration  
└── IO-Link

IO-Link  
│  
├── Master / Port Explorer  
├── Process Data  
├── Parameter Data  
├── Events  
├── Diagnostics  
├── Device Identity  
└── IODD Explorer

---

# **2.6 Process Instrumentation**

Process Instrumentation  
└── HART

HART  
│  
├── 4–20 mA  
├── Digital Frame  
├── Device Address  
├── Commands  
├── Universal Commands  
├── Common Practice  
├── Device-Specific  
├── Device Status  
├── Burst Mode  
└── Analog / Digital Compare

---

# **2.7 Metering**

Metering  
├── M-Bus  
└── Wireless M-Bus

Her biri:

Meter Browser  
├── Device Identity  
├── Telegram  
├── Data Records  
├── Energy  
├── Volume  
├── Flow  
├── Temperature  
└── Diagnostics

---

# **2.8 SCADA & Utility**

SCADA & Utility  
│  
├── OPC UA  
├── IEC 60870-5-101  
├── IEC 60870-5-104  
├── DNP3  
└── IEC 61850

### **OPC UA**

OPC UA  
│  
├── Endpoint Discovery  
├── Secure Channel  
├── Session  
├── Address Space  
├── Browse  
├── Read  
├── Write  
├── Method  
├── Subscription  
├── Monitored Items  
├── Security  
└── Certificates

### **IEC 60870-5-101**

IEC 101  
│  
├── Link Layer  
├── ASDU  
├── Type ID  
├── Cause  
├── Common Address  
├── IOA  
├── Quality  
├── Timestamp  
└── Commands

### **IEC 60870-5-104**

IEC 104  
│  
├── TCP Session  
├── APCI  
├── I-Format  
├── S-Format  
├── U-Format  
├── Sequence Numbers  
├── ASDU  
└── Session Timeline

### **DNP3**

DNP3  
│  
├── Data Link  
├── Transport  
├── Application  
├── Objects  
├── Variations  
├── Classes  
├── Unsolicited  
├── Confirm  
├── IIN  
└── Events

### **IEC 61850**

IEC 61850  
│  
├── Information Model  
├── SCL Explorer  
├── MMS  
│   ├── Association  
│   ├── Read  
│   ├── Write  
│   ├── Reports  
│   └── Control  
│  
└── GOOSE  
    ├── Publisher  
    ├── Dataset  
    ├── stNum  
    ├── sqNum  
    ├── Retransmission  
    └── Diagnostics

---

# **3\. AUTOMOTIVE**

Automotive  
│  
├── CAN Family  
├── Vehicle Network Protocols  
├── Sensor Interfaces  
├── Legacy Diagnostics  
├── Diagnostics  
├── Automotive Ethernet  
└── Calibration

---

# **3.1 CAN Family**

CAN Family  
│  
├── CAN 2.0A  
├── CAN 2.0B  
├── CAN FD  
└── CAN XL

### **CAN 2.0A / 2.0B**

Classical CAN  
│  
├── Frame Decoder  
├── Arbitration  
├── CAN ID  
├── DLC  
├── Data  
├── Bit Stuffing  
├── CRC  
├── ACK  
├── Timing  
├── Bus Load  
├── Period / Jitter  
└── Error Frames

### **CAN FD**

CAN FD  
│  
├── FDF  
├── BRS  
├── ESI  
├── DLC Mapping  
├── 64-byte Payload  
├── Nominal Timing  
├── Data Timing  
├── CRC  
└── Bus Load

### **CAN XL**

CAN XL  
│  
├── Priority ID  
├── Acceptance Field  
├── SDT  
├── VCID  
├── DLC  
├── Large Payload  
└── Frame Inspector

---

# **3.2 Vehicle Network Protocols**

Vehicle Network Protocols  
│  
├── J1939  
├── CANopen  
├── LIN  
├── FlexRay  
├── SAE J1850 PWM  
└── SAE J1850 VPW

### **J1939**

J1939  
│  
├── 29-bit ID  
├── Priority  
├── PGN  
├── Source Address  
├── Destination  
├── SPN  
├── Physical Values  
├── Address Claim  
├── Transport Protocol  
├── DM1 / DM2  
└── DTC

### **LIN**

LIN  
│  
├── Break  
├── Sync  
├── PID  
├── Parity  
├── Data  
├── Checksum  
├── Schedule Table  
├── Nodes  
└── LDF

### **FlexRay**

FlexRay  
│  
├── Channel A / B  
├── Communication Cycle  
├── Static Segment  
├── Dynamic Segment  
├── Frame Decoder  
├── Cycle Count  
├── CRC  
└── Timing

---

# **3.3 Automotive Sensor Interfaces**

Sensor Interfaces  
│  
├── SENT  
├── SPC  
└── PSI5

### **SENT**

SENT  
│  
├── Sync Pulse  
├── Tick Time  
├── Status Nibble  
├── Data Nibbles  
├── CRC  
├── Fast Channel  
├── Slow Channel  
└── Pulse Analyzer

### **SPC**

SPC  
│  
├── Trigger Pulse  
├── Request  
├── Response Delay  
├── SENT Response  
└── Diagnostics

### **PSI5**

PSI5  
│  
├── Sensor Channels  
├── Sync  
├── Slots  
├── Data  
├── Parity  
├── CRC  
└── Sensor Status

---

# **3.4 Legacy Diagnostics**

Legacy Diagnostics  
│  
├── K-Line  
├── ISO 9141  
└── ISO 14230 KWP2000

---

# **3.5 Diagnostics**

Diagnostics  
│  
├── ISO-TP  
├── UDS  
├── OBD-II  
└── DoIP

### **ISO-TP**

ISO-TP  
│  
├── Single Frame  
├── First Frame  
├── Consecutive Frame  
├── Flow Control  
├── Block Size  
├── STmin  
├── Reassembly  
└── Timing

### **UDS**

UDS  
│  
├── Sessions  
├── Services  
├── DID  
├── DTC  
├── Security Access  
├── Routine Control  
├── Programming  
├── Positive Response  
├── Negative Response  
└── NRC Decoder

### **OBD-II**

OBD-II  
│  
├── Modes  
├── PID Browser  
├── Live Data  
├── DTC  
├── Freeze Frame  
└── Vehicle Information

### **DoIP**

DoIP  
│  
├── Vehicle Discovery  
├── Routing Activation  
├── Logical Addresses  
├── Diagnostic Messages  
├── Alive Check  
├── TCP Session  
└── UDS Decoder

---

# **3.6 Automotive Ethernet**

Automotive Ethernet  
│  
├── Automotive Ethernet  
└── SOME/IP

### **Automotive Ethernet**

Automotive Ethernet  
│  
├── 100BASE-T1  
├── 1000BASE-T1  
├── VLAN  
├── IP  
├── UDP / TCP  
├── Traffic Matrix  
└── Bandwidth

### **SOME/IP**

SOME/IP  
│  
├── Service  
├── Method  
├── Event  
├── Request / Response  
├── Session  
├── Payload  
└── Service Discovery

---

# **3.7 Calibration**

Calibration  
│  
├── XCP on CAN  
├── XCP on Ethernet  
└── CCP

### **XCP**

XCP  
│  
├── CTO  
├── DTO  
├── Commands  
├── DAQ  
├── Measurement  
├── Calibration  
├── A2L  
├── Event Channels  
└── Timing

---

# **4\. MARINE & NAVIGATION**

Marine & Navigation  
│  
├── NMEA Family  
├── AIS  
├── GNSS & Corrections  
├── Marine Machinery  
└── Legacy / Proprietary Marine

---

# **4.1 NMEA Family**

NMEA Family  
│  
├── NMEA 0183  
├── NMEA 2000  
└── IEC 61162

### **NMEA 0183**

NMEA 0183  
│  
├── Sentence Monitor  
├── Talker ID  
├── Formatter  
├── Fields  
├── Checksum  
├── Coordinate Converter  
├── GGA  
├── RMC  
├── GSA  
├── GSV  
├── VTG  
├── HDT / HDG  
├── DPT / DBT  
├── MWV  
├── ROT  
└── Rate / Freshness

### **NMEA 2000**

NMEA 2000  
│  
├── CAN Frame  
├── PGN  
├── Source / Destination  
├── Device Explorer  
├── Fast Packet  
├── Reassembly  
├── Navigation  
├── Engine  
├── Electrical  
└── PGN Statistics

### **IEC 61162**

IEC 61162  
│  
├── IEC 61162-1  
├── IEC 61162-2  
├── IEC 61162-3  
├── IEC 61162-450  
└── IEC 61162-460

---

# **4.2 AIS**

AIS  
│  
├── AIVDM  
├── AIVDO  
├── Fragment Reassembly  
├── 6-bit Decoder  
├── Message Types  
├── MMSI  
├── Position  
├── SOG / COG  
├── Heading  
├── Static / Voyage Data  
├── Target Table  
└── Target Freshness

---

# **4.3 GNSS & Corrections**

GNSS & Corrections  
│  
├── GPS NMEA  
├── GNSS UBX  
└── RTCM

### **GNSS dashboard**

GNSS  
│  
├── Position  
├── Fix  
├── Satellites  
├── HDOP  
├── Altitude  
├── Velocity  
├── COG  
├── Time  
└── Accuracy

### **RTCM**

RTCM  
│  
├── Stream Decoder  
├── Message Type  
├── Station  
├── Constellation  
├── Epoch  
├── CRC  
├── Message Rate  
└── Correction Age

---

# **4.4 Marine Machinery**

Marine Machinery  
│  
├── Marine J1939  
└── Marine Modbus

---

# **4.5 Legacy / Proprietary Marine**

Legacy / Proprietary  
│  
├── SeaTalk  
└── HDLC-Based Marine

---

# **5\. AEROSPACE & UAV**

Aerospace & UAV  
│  
├── UAV Telemetry  
├── Distributed UAV Networks  
├── RC & Control Links  
├── Avionics Data Buses  
├── Surveillance  
└── GNSS & Navigation

---

# **5.1 UAV Telemetry**

UAV Telemetry  
│  
└── MAVLink  
    ├── MAVLink 1  
    └── MAVLink 2

### **MAVLink workspace**

MAVLink  
│  
├── Frame Decoder  
├── System / Component  
├── Message Browser  
├── HEARTBEAT  
├── ATTITUDE  
├── GPS  
├── Position  
├── Battery  
├── Commands  
├── ACK  
├── Parameters  
├── Mission  
├── CRC  
├── Signing  
├── Packet Loss  
└── Message Rate

---

# **5.2 Distributed UAV Networks**

Distributed UAV Networks  
│  
├── UAVCAN v0 / DroneCAN  
├── Cyphal  
└── UAVCAN Compatibility

### **DroneCAN**

DroneCAN  
│  
├── Node Explorer  
├── CAN ID  
├── Transfer Type  
├── Tail Byte  
├── Transfer ID  
├── Multi-Frame  
├── CRC  
├── DSDL  
├── ESC  
├── GNSS  
└── Node Status

### **Cyphal**

Cyphal  
│  
├── Node Explorer  
├── Subjects  
├── Services  
├── Heartbeat  
├── DSDL  
├── Cyphal/CAN  
├── Cyphal/UDP  
└── Cyphal/Serial

---

# **5.3 RC & Control Links**

RC & Control Links  
│  
├── SBUS  
├── IBUS  
├── CRSF  
├── PPM  
└── PWM Servo

### **SBUS**

SBUS  
│  
├── Serial Configuration  
├── Frame  
├── 16 Channels  
├── Packed Bits  
├── Flags  
├── Frame Lost  
├── Failsafe  
└── RC Monitor

### **IBUS**

IBUS  
│  
├── Frame  
├── Channels  
├── Checksum  
├── Telemetry  
└── RC Monitor

### **CRSF**

CRSF  
│  
├── Frame  
├── RC Channels  
├── Link Statistics  
├── GPS  
├── Battery  
├── Telemetry  
├── Device Info  
├── CRC  
└── Baud Negotiation

### **PPM / PWM**

Pulse Control  
│  
├── Pulse Width  
├── Frame Period  
├── Frequency  
├── Channel Decode  
├── Normalization  
├── Jitter  
└── Failsafe

---

# **5.4 Avionics Data Buses**

Avionics Data Buses  
│  
├── ARINC 429  
└── MIL-STD-1553

### **ARINC 429**

ARINC 429  
│  
├── 32-bit Word  
├── Label  
├── SDI  
├── Data  
├── SSM  
├── Parity  
├── BNR  
├── BCD  
├── Discrete  
└── Label Rate

### **MIL-STD-1553**

MIL-STD-1553  
│  
├── BC  
├── RT  
├── BM  
├── Command Word  
├── Status Word  
├── Data Word  
├── Transactions  
├── RT / Subaddress  
├── Mode Codes  
├── Bus A/B  
└── Timing

---

# **5.5 Surveillance**

Surveillance  
│  
├── ADS-B  
└── Mode-S

### **ADS-B**

ADS-B  
│  
├── Aircraft Table  
├── ICAO Address  
├── Callsign  
├── Position  
├── Altitude  
├── Velocity  
├── Heading  
├── CPR  
├── Message Age  
└── CRC

### **Mode-S**

Mode-S  
│  
├── DF  
├── Short Frame  
├── Extended Frame  
├── ICAO  
├── Payload  
├── Parity / CRC  
└── DF17 → ADS-B

---

# **5.6 GNSS & Navigation**

GNSS & Navigation  
│  
├── GPS UBX  
├── RTCM  
└── NMEA

Bunlar Marine'deki ortak parser'ı kullanmalı ancak **Flight Navigation Dashboard** göstermelidir.

---

# **6\. BUILDING AUTOMATION**

Building Automation  
│  
├── BACnet  
├── KNX  
├── DALI  
├── Metering  
├── Modbus Building  
├── LonWorks  
└── Lighting Networks

---

# **6.1 BACnet**

BACnet  
│  
├── BACnet MS/TP  
└── BACnet/IP

### **Common BACnet**

BACnet  
│  
├── Device Explorer  
├── Object Explorer  
├── Properties  
├── Who-Is / I-Am  
├── ReadProperty  
├── WriteProperty  
├── COV  
├── Priority Array  
├── Alarm  
├── Event  
├── Trend  
└── Schedule

### **BACnet MS/TP**

MS/TP  
│  
├── MAC  
├── Token  
├── Token Rotation  
├── Frame  
├── CRC  
└── RS-485 Diagnostics

### **BACnet/IP**

BACnet/IP  
│  
├── BVLL  
├── UDP  
├── BBMD  
├── Foreign Device  
├── Broadcast  
└── Device Discovery

---

# **6.2 KNX**

KNX  
│  
├── Individual Address  
├── Group Address  
├── Group Objects  
├── Datapoint Types  
├── GroupValueRead  
├── GroupValueWrite  
├── GroupValueResponse  
├── Group Monitor  
└── ETS Import

---

# **6.3 DALI**

DALI  
│  
├── Device Explorer  
├── Short Address  
├── Groups  
├── Scenes  
├── Dimming  
├── Queries  
├── Control Commands  
├── Device Types  
├── DT6  
├── DT8  
└── Fault Monitor

---

# **6.4 Metering**

Metering  
└── M-Bus  
    ├── Meter Browser  
    ├── Primary Address  
    ├── Secondary Address  
    ├── Telegram  
    ├── DIF / VIF  
    ├── Energy  
    ├── Volume  
    └── Temperature

---

# **6.5 Modbus Building**

Modbus Building  
│  
├── Modbus RTU  
└── Modbus TCP

Bunlar Industrial Modbus parser'ını paylaşmalı, fakat üstüne:

HVAC Register Map  
AHU Dashboard  
VFD Dashboard  
Chiller Dashboard  
Boiler Dashboard  
Polling Optimizer

eklenmelidir.

---

# **6.6 LonWorks**

LonWorks  
│  
├── Device  
├── Network Variables  
├── SNVT  
├── Configuration Properties  
├── XIF Import  
└── Gateway Mapping

---

# **6.7 Lighting Networks**

Lighting Networks  
│  
├── DMX512  
├── Art-Net  
└── sACN

### **DMX512**

DMX512  
│  
├── Universe  
├── Break  
├── MAB  
├── Start Code  
├── Slots  
├── Fixture Profile  
├── 8-bit Channel  
├── 16-bit Channel  
└── Refresh Rate

### **Art-Net**

Art-Net  
│  
├── Node Discovery  
├── ArtPoll  
├── ArtPollReply  
├── ArtDmx  
├── Universe  
├── Sequence  
├── ArtSync  
└── Gateway Mapping

### **sACN**

sACN  
│  
├── Source / CID  
├── Universe  
├── Priority  
├── Sequence  
├── DMX Data  
├── Synchronization  
└── Multiple Source Monitor

---

# **7\. NETWORK & ETHERNET**

Network & Ethernet  
│  
├── Data Link  
├── Internet Layer  
├── Transport  
├── Addressing & Discovery  
├── Time & Management  
├── Web & Messaging  
├── Real-Time Media  
└── File / Terminal Protocols

---

# **7.1 Data Link**

Data Link  
│  
├── Ethernet II  
├── IEEE 802.3  
├── VLAN 802.1Q  
├── ARP  
└── LLDP

### **Ethernet**

Ethernet  
│  
├── MAC Addresses  
├── EtherType  
├── Frame Length  
├── FCS  
├── Broadcast  
├── Multicast  
├── Throughput  
└── Frame Statistics

### **VLAN**

VLAN  
│  
├── TPID  
├── PCP  
├── DEI  
├── VID  
├── Tagged  
├── Untagged  
└── Stacked VLAN

### **ARP**

ARP  
│  
├── Request  
├── Reply  
├── IP ↔ MAC Map  
└── Conflict Detector

### **LLDP**

LLDP  
│  
├── Chassis ID  
├── Port ID  
├── TTL  
├── System Name  
├── Capabilities  
├── Management Address  
└── Topology

---

# **7.2 Internet Layer**

Internet Layer  
│  
├── IPv4  
├── IPv6  
├── ICMP  
└── ICMPv6

### **IPv4**

IPv4  
│  
├── Header  
├── Addresses  
├── TTL  
├── Protocol  
├── Checksum  
├── DSCP / ECN  
├── Fragmentation  
└── Reassembly

### **IPv6**

IPv6  
│  
├── Header  
├── Addresses  
├── Flow Label  
├── Next Header  
├── Hop Limit  
├── Extension Headers  
├── Fragment Header  
└── Reassembly

### **ICMP**

ICMP  
│  
├── Echo  
├── RTT  
├── Destination Unreachable  
├── Time Exceeded  
└── Error Correlation

---

# **7.3 Transport**

Transport  
│  
├── UDP  
└── TCP

### **UDP**

UDP  
│  
├── Ports  
├── Length  
├── Checksum  
├── Datagram View  
├── Conversation  
└── Statistics

### **TCP**

TCP  
│  
├── Header  
├── Flags  
├── Three-Way Handshake  
├── Sequence  
├── ACK  
├── Window  
├── Options  
├── Retransmissions  
├── Out-of-Order  
├── RTT  
├── Stream Reassembly  
├── Connection State  
└── Close / Reset

---

# **7.4 Addressing & Discovery**

Addressing & Discovery  
│  
├── DHCP  
├── DNS  
└── mDNS

### **DHCP**

DHCP  
│  
├── Discover  
├── Offer  
├── Request  
├── ACK  
├── Options  
├── Lease  
└── Server Detection

### **DNS**

DNS  
│  
├── Query  
├── Response  
├── Resource Records  
├── A  
├── AAAA  
├── CNAME  
├── PTR  
├── TXT  
├── SRV  
├── Compression  
├── TTL  
└── Response Time

### **mDNS**

mDNS  
│  
├── .local  
├── Query  
├── Response  
├── Probing  
├── Announcements  
├── Conflict  
└── Local Services

---

# **7.5 Time & Management**

Time & Management  
│  
├── NTP  
├── PTP  
├── SNMP  
└── Syslog

### **NTP**

NTP  
│  
├── Packet  
├── Stratum  
├── T1 / T2 / T3 / T4  
├── Delay  
├── Offset  
└── Clock Drift

### **PTP**

PTP  
│  
├── Grandmaster  
├── Ordinary Clock  
├── Boundary Clock  
├── Transparent Clock  
├── Sync  
├── Follow\_Up  
├── Delay\_Req  
├── Delay\_Resp  
├── Announce  
├── BMCA  
├── Offset  
└── Path Delay

### **SNMP**

SNMP  
│  
├── SNMPv1  
├── SNMPv2c  
├── SNMPv3  
├── ASN.1 / BER  
├── OID  
├── VarBind  
├── GET  
├── SET  
├── TRAP  
├── MIB Import  
└── Security

### **Syslog**

Syslog  
│  
├── Facility  
├── Severity  
├── Timestamp  
├── Host  
├── Application  
├── Structured Data  
└── Log Statistics

---

# **7.6 Web & Messaging**

Web & Messaging  
│  
├── HTTP  
├── WebSocket  
├── MQTT  
├── MQTT-SN  
└── CoAP

### **HTTP**

HTTP  
│  
├── Request  
├── Response  
├── Methods  
├── Headers  
├── Status Codes  
├── Body  
├── Chunked Transfer  
├── JSON Viewer  
└── Transaction Timing

### **WebSocket**

WebSocket  
│  
├── Upgrade Handshake  
├── Text Frame  
├── Binary Frame  
├── Mask  
├── Fragmentation  
├── Ping / Pong  
└── Close

### **MQTT**

MQTT  
│  
├── CONNECT  
├── CONNACK  
├── PUBLISH  
├── SUBSCRIBE  
├── Topics  
├── QoS 0  
├── QoS 1  
├── QoS 2  
├── Retained  
├── Last Will  
├── Keep Alive  
└── MQTT v5 Properties

### **MQTT-SN**

MQTT-SN  
│  
├── Gateway Discovery  
├── Topic Registration  
├── Publish  
├── Subscribe  
└── Sensor Session

### **CoAP**

CoAP  
│  
├── CON  
├── NON  
├── ACK  
├── RST  
├── GET  
├── POST  
├── PUT  
├── DELETE  
├── Token  
├── Options  
├── Resources  
└── Observe

---

# **7.7 Real-Time Media**

Real-Time Media  
│  
├── RTP  
└── RTCP

### **RTP**

RTP  
│  
├── Sequence  
├── Timestamp  
├── SSRC  
├── Payload Type  
├── Packet Loss  
└── Jitter

### **RTCP**

RTCP  
│  
├── Sender Report  
├── Receiver Report  
├── Packet Loss  
├── Jitter  
└── RTP ↔ NTP Mapping

---

# **7.8 File & Terminal**

File & Terminal  
│  
├── TFTP  
├── FTP  
└── Telnet

### **TFTP**

TFTP  
│  
├── RRQ  
├── WRQ  
├── DATA  
├── ACK  
├── ERROR  
├── Block Transfer  
└── Retries

### **FTP**

FTP  
│  
├── Control Session  
├── Commands  
├── Responses  
├── Active  
├── Passive  
└── Transfer Timeline

### **Telnet**

Telnet  
│  
├── Text Stream  
├── IAC  
├── WILL  
├── WONT  
├── DO  
├── DONT  
└── Subnegotiation

---

# **8\. WIRELESS & IoT**

Wireless & IoT  
│  
├── Bluetooth LE  
├── Mesh & Smart Home  
├── LoRa / LPWAN  
├── Wi-Fi Wireless  
├── Custom RF  
├── Wireless Metering  
├── IoT Messaging  
└── Cellular IoT

---

# **8.1 Bluetooth LE**

Bluetooth LE  
│  
├── BLE Advertisement  
└── BLE GATT

### **BLE Advertisement**

BLE Advertisement  
│  
├── Device Scanner  
├── Advertising Channels  
├── PDU Type  
├── Address  
├── AD Structures  
├── Flags  
├── Name  
├── UUID  
├── Manufacturer Data  
├── Service Data  
├── RSSI  
├── Advertisement Rate  
└── Privacy / Address Rotation

### **BLE GATT**

BLE GATT  
│  
├── Services  
├── Characteristics  
├── Descriptors  
├── Handles  
├── UUIDs  
├── Properties  
├── Read  
├── Write  
├── Notification  
├── Indication  
├── CCCD  
└── Custom Schema

---

# **8.2 Mesh & Smart Home**

Mesh & Smart Home  
│  
├── Zigbee  
├── Thread  
└── Matter

### **Zigbee**

Zigbee  
│  
├── Network Graph  
├── Coordinator  
├── Router  
├── End Device  
├── MAC  
├── NWK  
├── APS  
├── ZCL  
├── Endpoints  
├── Clusters  
├── Attributes  
├── Commands  
├── Join  
└── Security

### **Thread**

Thread  
│  
├── Leader  
├── Router  
├── End Device  
├── Sleepy End Device  
├── Border Router  
├── IPv6  
├── 6LoWPAN  
├── MLE  
├── Fragmentation  
└── Topology

### **Matter**

Matter  
│  
├── Node  
├── Fabric  
├── Endpoint  
├── Cluster  
├── Attribute  
├── Command  
├── Event  
├── Read  
├── Write  
├── Subscribe  
├── Invoke  
├── Commissioning  
├── Sessions  
├── Security  
└── TLV

---

# **8.3 LoRa / LPWAN**

LoRa / LPWAN  
│  
├── LoRa  
└── LoRaWAN

### **LoRa**

LoRa  
│  
├── Frequency  
├── Bandwidth  
├── Spreading Factor  
├── Coding Rate  
├── Preamble  
├── RSSI  
├── SNR  
├── Symbol Time  
├── Data Rate  
├── Time on Air  
├── Link Budget  
└── Airtime Calculator

### **LoRaWAN**

LoRaWAN  
│  
├── Device  
├── Gateway  
├── Network Server  
├── MHDR  
├── DevAddr  
├── Frame Counter  
├── MIC  
├── OTAA  
├── ABP  
├── Class A  
├── Class B  
├── Class C  
├── ADR  
├── Regional Parameters  
└── Duty Cycle

---

# **8.4 Wi-Fi Wireless**

Wi-Fi Wireless  
│  
├── Wi-Fi Frame Analyzer  
└── ESP-NOW

### **Wi-Fi**

Wi-Fi  
│  
├── Management Frames  
├── Control Frames  
├── Data Frames  
├── Beacon  
├── Probe  
├── Authentication  
├── Association  
├── Information Elements  
├── BSSID  
├── RSSI  
├── Channel  
├── Retry  
└── Connection Timeline

### **ESP-NOW**

ESP-NOW  
│  
├── Action Frame  
├── Espressif OUI  
├── Peer  
├── Unicast  
├── Broadcast  
├── Payload  
├── ESP-NOW v1  
├── ESP-NOW v2  
├── Security  
└── Device Graph

---

# **8.5 Custom RF**

Custom RF  
└── RF Telemetry Custom Frame  
    ├── Preamble  
    ├── Sync Word  
    ├── Device ID  
    ├── Packet Type  
    ├── Sequence  
    ├── Length  
    ├── Payload  
    ├── CRC  
    ├── Whitening  
    ├── Manchester  
    └── Unknown RF Analyzer

---

# **8.6 Wireless Metering**

Wireless Metering  
└── Wireless M-Bus  
    ├── RF Mode  
    ├── Device Identity  
    ├── Telegram  
    ├── Meter Records  
    ├── Security  
    ├── Encryption  
    └── Meter Dashboard

---

# **8.7 IoT Messaging**

Buradaki parser **Network & Ethernet kategorisindeki aynı engine'i** kullanmalıdır.

IoT Messaging  
│  
├── MQTT  
└── CoAP

Burada sadece IoT-oriented ekranlar eklenir:

MQTT  
├── Device Clients  
├── Topic Tree  
├── Sensor Payloads  
├── Publish Rate  
└── Device Health

CoAP  
├── Resource Tree  
├── Sensor Resources  
├── Observe  
└── Device Health

---

# **8.8 Cellular IoT**

Cellular IoT  
│  
├── NB-IoT  
├── LTE Modem AT  
└── GNSS Modem

### **NB-IoT**

NB-IoT  
│  
├── SIM  
├── Registration  
├── Operator  
├── Cell  
├── Signal  
├── RSRP  
├── RSRQ  
├── SINR  
├── PSM  
├── eDRX  
├── PDP / PDN  
├── Socket  
└── Connection Timeline

### **LTE Modem AT**

LTE Modem AT  
│  
├── AT Console  
├── Command Parser  
├── Response  
├── URC  
├── SIM  
├── Network Registration  
├── Signal  
├── Data Session  
├── Socket  
├── SMS  
├── Errors  
└── Boot Timeline

### **GNSS Modem**

GNSS Modem  
│  
├── GNSS Control  
├── GNSS Status  
├── NMEA  
├── Position  
├── Fix  
├── Satellites  
├── TTFF  
└── Fix Loss

---

# **ORTAK PROTOKOL SAYFASI YAPISI**

Bütün protokollerde birebir aynı sekmeler görünmemeli; ama mümkün olan protokollerde ortak workspace düzeni şu olmalıdır:

Protocol Page

Overview  
│  
├── Protocol Summary  
├── Layer  
├── Topology  
├── Common Uses  
└── Related Protocols

Live  
│  
├── Connection  
├── Capture  
├── RX / TX  
└── Statistics

Decode  
│  
├── Raw  
├── HEX  
├── Binary  
├── Fields  
├── Protocol Tree  
└── Validation

Build / Send  
│  
├── Packet Builder  
├── Encoder  
├── Send  
└── Templates

Timing  
│  
├── Frame Time  
├── Message Rate  
├── Bus Load  
├── Latency  
└── Jitter

Data  
│  
├── Signals  
├── Registers  
├── Objects  
├── Parameters  
└── Physical Values

Diagnostics  
│  
├── Errors  
├── Warnings  
├── Timeouts  
├── Sequence Problems  
└── Statistics

Definitions  
│  
├── DBC  
├── EDS  
├── GSD  
├── GSDML  
├── IODD  
├── A2L  
├── LDF  
├── SCL  
├── Vendor Maps  
└── Custom Schema

Examples  
│  
├── Example Frames  
├── Example Transactions  
└── Test Data

Ancak örneğin:

UART

sayfasında `DBC` görünmez;

CAN

sayfasında `DBC` görünür;

CANopen

sayfasında `EDS` görünür;

PROFINET

sayfasında `GSDML` görünür;

IO-Link

sayfasında `IODD` görünür;

XCP

sayfasında `A2L` görünür;

LIN

sayfasında `LDF` görünür;

IEC 61850

sayfasında `SCL` görünür.

Yani protokol sayfalarının sekmeleri **protocol capability'ye göre dinamik oluşturulmalıdır**.

---

# **ANA SAYFADA COMMUNICATION DOMAINS GÖRÜNÜMÜ**

Ana sayfada sekiz kart:

┌──────────────────────┐  
│ Interfaces & Framing │  
│ UART • SPI • I²C     │  
│ RS-485 • HDLC • AT   │  
└──────────────────────┘

┌──────────────────────┐  
│ Industrial Automation│  
│ Modbus • PROFINET    │  
│ EtherCAT • OPC UA    │  
└──────────────────────┘

┌──────────────────────┐  
│ Automotive           │  
│ CAN • J1939 • UDS    │  
│ LIN • DoIP • XCP     │  
└──────────────────────┘

┌──────────────────────┐  
│ Marine & Navigation  │  
│ NMEA • AIS • RTCM    │  
│ NMEA 2000 • GNSS     │  
└──────────────────────┘

┌──────────────────────┐  
│ Aerospace & UAV      │  
│ MAVLink • DroneCAN   │  
│ ARINC • ADS-B        │  
└──────────────────────┘

┌──────────────────────┐  
│ Building Automation  │  
│ BACnet • KNX • DALI  │  
│ DMX • M-Bus          │  
└──────────────────────┘

┌──────────────────────┐  
│ Network & Ethernet   │  
│ TCP/IP • HTTP • MQTT │  
│ DNS • PTP • RTP      │  
└──────────────────────┘

┌──────────────────────┐  
│ Wireless & IoT       │  
│ BLE • Zigbee • Matter│  
│ LoRaWAN • ESP-NOW    │  
└──────────────────────┘

Bu sekiz kategori **Communication Domains** bölümünün tamamını oluşturmalıdır.

