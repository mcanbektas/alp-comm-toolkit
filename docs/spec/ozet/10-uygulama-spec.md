# 10 — Uygulama Spec (Bölüm 4–50): Teknoloji, Mimari, Protocol Core ve Tüm Araçlar

> Kaynak: "ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve Protokol Geliştirme Platformu.md", satır 37321–40074.
> Bu bölüm **uygulamanın kendisinin** spesifikasyonudur — en kritik parça. Aşağıda kayıpsıza yakın, düşük sıkıştırmalı özet yer alır.

---

## 4. Teknoloji yığını

Zorunlu teknolojiler:

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
* File System Access API (uygun olduğu yerlerde)
* Web Workers
* Recharts veya benzeri hafif bir grafik kütüphanesi
* Vitest
* React Testing Library
* Playwright
* Zod veya eşdeğer schema doğrulama kütüphanesi

Kod içindeki bütün teknik isimlendirmeler **İngilizce** olmalı: değişken isimleri, fonksiyon isimleri, dosya isimleri, sınıf isimleri, TypeScript interface/type isimleri, kod yorumları, test isimleri.

Kullanıcı arayüzü başlangıçta **Türkçe**; İngilizce dil desteği de bulunmalı. Bütün metinler çeviri dosyalarında tutulmalı. Örnek:

```typescript
export const translations = {
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
```

---

## 5. Tasarım yaklaşımı

Uygulama teknik, sade, hızlı ve profesyonel görünmeli. Ana sayfa **kategori kartlarından** oluşmalı.

Ana kategoriler (spec'in orijinal listesi — bkz. Bölüm 50 sonundaki revize öneri için "Dikkat çekenler"):

Live Communication · Protocol Studio · Protocol Decoders · Protocol Encoders · Network Analyzer · Industrial Communication · Automotive Communication · Marine Communication · Wireless and IoT · Data Conversion · Integrity and CRC Tools · Timing and Bus Calculators · Log Analyzer · Protocol Reverse Engineering · Test Automation · Project Manager · Documentation

Her kategori kartında: Kategori adı, Kısa açıklama, İçerdiği araç sayısı, En çok kullanılan araçlar, Favoriye ekleme, Kategoriyi açma.

Arayüz özellikleri: Açık tema, Koyu tema, Responsive tasarım, Daraltılabilir sol menü, Global arama, Son kullanılan araçlar, Favoriler, Proje kaydetme, Çoklu çalışma sekmesi, Sürüklenebilir paneller, Klavye kısayolları, Bildirim sistemi, Tam ekran analiz modu, Veriyi kopyalama, JSON/CSV/TXT dışa aktarma.

---

## 6. Uygulama mimarisi (klasör yapısı — AYNEN)

```
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
```

Kural: Protokol hesaplama kodlarını React bileşenlerinin içine **yazma**. Ayrıştırma, kodlama, checksum ve mühendislik hesapları **bağımsız TypeScript modülleri** olmalı.

---

## 7. Protocol Core (TypeScript interface'ler — AYNEN)

Bütün protokollerin ortak kullanabileceği bir çekirdek.

```typescript
interface RawFrame {
  id: string;
  timestamp: number;
  direction: "rx" | "tx";
  channel?: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
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
  warnings: string[];
}

interface ParsedFrame {
  protocol: string;
  timestamp: number;
  rawFrame: RawFrame;
  fields: ParsedField[];
  valid: boolean;
  errors: ProtocolError[];
  warnings: ProtocolWarning[];
}
```

Parser sonuç tipi (discriminated union):

```typescript
type ParseResult =
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
```

Ortak parser interface'i:

```typescript
interface ProtocolParser {
  readonly protocolId: string;
  readonly displayName: string;

  canParse(data: Uint8Array): boolean;
  parse(data: Uint8Array, context?: ParseContext): ParseResult;
}
```

Encoder interface'i:

```typescript
interface ProtocolEncoder<TMessage> {
  encode(message: TMessage): Uint8Array;
}
```

---

## 8. Live Communication Monitor

### 8.1 Bağlantı kaynakları
Web Serial, WebUSB, Web Bluetooth, WebSocket, Dosya oynatma, Simulated source, Local bridge.

Bağlantı ayarları: Port, Baud rate, Data bits, Stop bits, Parity, Flow control, Character encoding, Line ending, Buffer size, Frame timeout, Timestamp resolution.

Desteklenecek baud rate değerleri: 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000, 2000000, Custom.

### 8.2 Görüntüleme modları
HEX, ASCII, UTF-8, Decimal, Binary, Mixed HEX and ASCII, Protocol tree, Signal table, Real-time chart, Statistics, Timeline.

### 8.3 Canlı mesaj örneği

```
09:42:15.102  RX  AA 05 10 03 34 12 7F 4F 55  Custom Protocol  Valid
09:42:15.212  RX  01 03 04 00 64 00 C8 BA 7A     Modbus RTU      Valid
09:42:15.350  TX  01 06 00 01 00 32 59 DD        Modbus RTU      Sent
```

Her mesaj için gösterilecek alanlar: Timestamp, Direction, Channel, Protocol, Frame type, Raw bytes, Parsed fields, Validation state, CRC state, Length, Sequence number, Address, Command, Error details.

### 8.4 Stream parser

Seri port / WebSocket verisi paket sınırlarıyla aynı parçalarda gelmeyebilir. Örnek:

```
Chunk 1: AA 05
Chunk 2: 10 03 34
Chunk 3: 12 7F 4F 55 AA
Chunk 4: 05 10 03
```

Bu nedenle bir **stream buffer** geliştirilmeli.

Parser durumları (state machine):
`SEARCHING_FOR_FRAME → READING_HEADER → READING_LENGTH → READING_PAYLOAD → READING_TRAILER → VALIDATING_FRAME → FRAME_COMPLETE / FRAME_ERROR → RECOVERING`

Framing yöntemleri: Fixed length, Start byte, Multiple start bytes, Start and end delimiter, Length field, Line ending, Inter-character timeout, Inter-frame timeout, Escape-based framing, Bit stuffing, Byte stuffing, COBS, SLIP, HDLC flag, Modbus silent interval.

Yoğun veri akışında ayrıştırma işlemi **Web Worker** içinde yapılmalı.

---

## 9. Custom Protocol Studio

**Bu modül uygulamanın en önemli bölümüdür.** Kullanıcı kendi protokolünü sürükle-bırak yöntemiyle oluşturabilmelidir.

### 9.1 Desteklenen alan tipleri (TAM LİSTE — 32 tip)

```
uint8, int8, uint16, int16, uint24, int24, uint32, int32, uint64, int64,
float16, float32, float64,
boolean, bitField, enum,
ascii, utf8, bcd,
unixTimestamp, dateTime,
rawBytes, array, structure,
checksum, crc,
padding, reserved, delimiter, length, sequenceCounter,
address, command
```

Her alan için seçilebilecek özellikler (kaynakta "Offset" iki kez geçiyor: biri çerçeve içindeki bayt konumu, diğeri fiziksel değer formülündeki kalibrasyon ofseti — ikisi de aynen aktarılmıştır):

* Field name
* Description
* Offset (bayt konumu)
* Length
* Data type
* Signed
* Endianness
* Bit order
* Scale
* Offset (kalibrasyon ofseti)
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

### 9.2 Sayısal dönüşüm

```
Physical Value = Raw Value × Scale + Offset
Raw Value = (Physical Value - Offset) / Scale
```

Örnek: Raw Value = 653, Scale = 0.1, Offset = −40 → Physical Value = 653 × 0.1 − 40 = **25.3 °C**

### 9.3 Signed integer (N bit two's complement)

```
Raw < 2^(N-1)  →  Signed Value = Raw
Raw ≥ 2^(N-1)  →  Signed Value = Raw - 2^N
```

Örnek: 0xF6 = 246 → 246 − 256 = **−10**

### 9.4 Bit field

```
Bit Value = (RawValue >> BitPosition) & 1
Field Value = (RawValue & Mask) >> Shift     (maskeli alan)
```

### 9.5 Endianness

```
Little-endian: Value = Σ Byte[i] × 256^i
Big-endian:    Value = Σ Byte[i] × 256^(N-1-i)
```

### 9.6 Protocol schema örneği (JSON — AYNEN)

```json
{
  "name": "ALP Sensor Protocol",
  "version": "1.0",
  "framing": {
    "type": "startEnd",
    "startBytes": [170],
    "endBytes": [85],
    "maximumFrameLength": 256
  },
  "fields": [
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
  ]
}
```

Not: `startBytes: [170]` = 0xAA, `endBytes: [85]` = 0x55 (Bölüm 8.3'teki canlı mesaj örneğiyle ve Bölüm 10 paket örneğiyle tutarlı).

### 9.7 Görsel düzen (4 panel)

**Sol panel:** Frame yapısı, Alan listesi, Alan ekleme, Sürükleyerek sıralama, Koşullu alanlar, Tekrarlanan yapılar.

**Orta panel:** HEX görünümü, ASCII görünümü, Byte offset, Bit görünümü, Renklendirilmiş alanlar, Hatalı alan vurgusu.

**Sağ panel:** Alan özellikleri, Veri tipi, Endianness, Scale, Offset, Unit, Validation, Enum, Bit mask.

**Alt panel:** Parsed output, Validation results, Generated JSON schema, Generated C structure, Generated C parser, Generated Python parser, Generated TypeScript parser, Markdown protocol documentation.

---

## 10. Packet Builder

Kullanıcı form üzerinden paket oluşturabilmeli. Örnek:

```
Device Address: 5
Command: Set Output
Output Channel: 2
Duty Cycle: 75%
```

Oluşturulan paket: `AA 05 20 02 02 4B 6C 55`

Özellikler: Form tabanlı paket oluşturma, HEX düzenleme, Field validation, Otomatik length hesaplama, Otomatik CRC, Otomatik checksum, Byte stuffing, Bit stuffing, COBS encoding, SLIP encoding, Endianness, Scale ve offset, Seri port üzerinden gönderme, WebSocket üzerinden gönderme, Periyodik gönderme, N kere gönderme, Alan artırma, Alan azaltma, Random data, Sequence counter, Response bekleme.

Kod çıktıları (3 dil, AYNEN):

```c
uint8_t frame[] = {
    0xAA, 0x05, 0x20, 0x02,
    0x02, 0x4B, 0x6C, 0x55
};
```

```python
frame = bytes([
    0xAA, 0x05, 0x20, 0x02,
    0x02, 0x4B, 0x6C, 0x55
])
```

```typescript
const frame = new Uint8Array([
  0xAA, 0x05, 0x20, 0x02,
  0x02, 0x4B, 0x6C, 0x55
]);
```

---

## 11. CRC ve checksum araçları

Desteklenecek algoritmalar (TAM LİSTE):

XOR-8, SUM-8, SUM-16, Two's complement, One's complement, Fletcher-16, Fletcher-32, Adler-32, LRC, NMEA XOR, CRC-4, CRC-5, CRC-6, CRC-7, CRC-8, CRC-8 SAE J1850, CRC-8 AUTOSAR, CRC-8 MAXIM, CRC-16 ARC, CRC-16 Modbus, CRC-16 CCITT-FALSE, CRC-16 XMODEM, CRC-16 X25, CRC-16 DNP, CRC-24, CRC-32, CRC-32C, CRC-64, Custom CRC.

Custom CRC parametreleri: Width, Polynomial, Initial value, Reflect input, Reflect output, XOR output, Check value, Residue, Byte order.

Standart kontrol girdisi: `123456789`

Beklenen sonuçlar (referans değerler — test/doğrulama için kritik):

```
CRC-8              = 0xF4
CRC-16 CCITT-FALSE = 0x29B1
CRC-16 MODBUS      = 0x4B37
CRC-32 ISO-HDLC    = 0xCBF43926
```

CRC Finder aracı: Veri ve checksum çiftlerini kabul etsin, Yaygın CRC algoritmalarını denesin, Byte order varyasyonlarını denesin, Coverage alanını tahmin etsin, Eşleşme yüzdesi göstersin.

---

## 12. Veri dönüştürme araçları (TAM LİSTE — 28 araç)

HEX to ASCII, ASCII to HEX, HEX to binary, Binary to HEX, Decimal converter, Signed and unsigned converter, Little-endian converter, Big-endian converter, Mixed endian converter, IEEE-754 Float16, IEEE-754 Float32, IEEE-754 Float64, BCD converter, UTF-8 byte viewer, Base64, Base32, URL encoding, Unix timestamp, Bit mask, Byte swap, Bit reverse, Nibble swap, C array generator, C++ array generator, Python bytes generator, Rust array generator, Java byte array generator, JavaScript Uint8Array generator.

---

## 13. UART ve seri haberleşme hesapları

```
Bits Per Character = Start Bits + Data Bits + Parity Bits + Stop Bits
8N1: 1 + 8 + 0 + 1 = 10 bit

Character Time = Bits Per Character / Baud Rate
Packet Time = Packet Bytes × Bits Per Character / Baud Rate
Maximum Byte Rate = Baud Rate / Bits Per Character
Maximum Packet Rate = 1 / Packet Time
Efficiency = Payload Bytes / Total Frame Bytes × 100
Baud Error = Actual Baud - Target Baud
Baud Error Percentage = Baud Error / Target Baud × 100
```

UART calculator girişleri: Clock frequency, Baud rate, Oversampling, Prescaler, Data bits, Stop bits, Parity, Packet length, Payload length, Inter-frame delay.

Çıktılar: Actual baud, Baud error, Bit time, Character time, Packet time, Maximum bytes/s, Maximum packet/s, Efficiency, Recommended timeout.

---

## 14. RS-232, RS-422 ve RS-485 araçları

### 14.1 RS-485 termination
```
İki adet 120 Ω terminasyon: R_effective = 120 Ω || 120 Ω = 60 Ω
I_driver = V_differential / R_effective
```

### 14.2 Bias hesabı
```
V_AB = V_CC × R_T / (2 × R_B + R_T)
I_bias = V_CC / (2 × R_B + R_T)
```

### 14.3 Propagation delay
```
Propagation Delay = Cable Length / Propagation Velocity   (kablo hızı kullanıcı girer)
Round Trip Delay = 2 × One Way Delay
```

RS-485 araçları: Termination helper, Bias resistor helper, Unit load calculator, Node count estimator, Cable delay, Timeout assistant, Stub length warning, Half-duplex timing, Driver-enable timing, Turnaround delay, Modbus RTU line calculator.

---

## 15. SPI, I²C, I3C, SMBus ve PMBus

### 15.1 SPI süresi
```
Transfer Time = Total Clock Bits / SPI Clock Frequency
T_total = T_setup + T_command + T_address + T_dummy + T_payload + T_crc + T_hold
```
Destekle: Standard SPI, Dual SPI, Quad SPI, Octal SPI, CPOL, CPHA, Command, Address, Dummy cycle, Payload, Chip select timing.

### 15.2 I²C süresi
```
Her byte ≈ 8 data bit + 1 ACK/NACK bit = 9 clock
Transfer Time ≈ Total Clock Count / SCL Frequency
```
Destekle: 7-bit address, 10-bit address, Write, Read, Repeated start, Clock stretching, ACK/NACK, Register address bytes.

### 15.3 Pull-up hesabı
```
t_r ≈ 0.8473 × R_pullup × C_bus
R_pullup_max = t_r_max / (0.8473 × C_bus)
R_pullup_min = (V_DD - V_OL_max) / I_OL
```

### 15.4 SMBus ve PMBus
SMBus timeout, PEC CRC-8, PMBus command decoder, Linear11 converter, Linear16 converter, Direct format converter, Voltage/Current/Temperature/Power telemetry.

```
Linear11: Value = Mantissa × 2^Exponent
```

---

## 16. Modbus ailesi

Destekle: Modbus RTU, Modbus ASCII, Modbus TCP.

Function code'lar:
```
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
```

Frame yapıları:
* **Modbus RTU:** Address, Function Code, Data, CRC Low, CRC High
* **Modbus ASCII:** Colon, Address, Function, Data, LRC, CR, LF
* **Modbus TCP:** Transaction ID, Protocol ID, Length, Unit ID, Function, Data

Register gösterimleri: uint16, int16, uint32, int32, float32, float64, BCD, ASCII, HEX, bit field.

Byte order seçenekleri: ABCD, BADC, CDAB, DCBA.

Modbus timing:
```
T_char = Bits Per Character / Baud Rate
T_1.5 = 1.5 × T_char
T_3.5 = 3.5 × T_char
```

---

## 17. CAN, CAN FD ve CAN XL araçları

### 17.1 CAN frame decoder — alanlar
Timestamp, CAN ID, Standard veya extended, RTR, IDE, DLC, Data, CRC state, ACK, Frequency, Period, Jitter, Message count.

### 17.2 Yaklaşık CAN frame uzunluğu
```
Standard frame:  Frame Bits ≈ 47 + 8 × DLC
Extended frame:  Frame Bits ≈ 67 + 8 × DLC
Maximum Stuff Bits ≈ floor((Stuff Region - 1) / 4)
Frame Time = Frame Bits / CAN Bit Rate
Bus Load = Σ(Frame Frequency × Frame Bit Count) / CAN Bit Rate × 100
```

### 17.3 CAN bit timing
```
Time Quantum = Prescaler / CAN Clock
Bit Time = Time Quantum × (1 + TSEG1 + TSEG2)
CAN Bit Rate = CAN Clock / [Prescaler × (1 + TSEG1 + TSEG2)]
Sample Point = (1 + TSEG1) / (1 + TSEG1 + TSEG2) × 100
```

CAN FD için ayrıca: Arbitration bitrate, Data bitrate, BRS, Nominal timing, Data timing, Payload up to 64 byte, CRC length variation.

### 17.4 DBC
DBC yükleme ve oluşturma desteği. Signal özellikleri: Start bit, Length, Endianness, Signed, Factor, Offset, Min, Max, Unit, Enum, Multiplexing.

```
Physical Value = Raw Value × Factor + Offset
```

---

## 18. J1939

29-bit identifier: Priority, Reserved, Data Page, PDU Format, PDU Specific, Source Address.

```
PGN (PF < 240):  PGN = (DP << 16) | (PF << 8)
PGN (PF ≥ 240):  PGN = (DP << 16) | (PF << 8) | PS
```

Destekle: PGN, SPN, Source address, Destination address, Priority, Address claim, Request PGN, Transport Protocol, BAM, RTS/CTS, DM1, DM2, DTC, FMI, Occurrence count.

```
SPN Physical Value = Raw Value × Resolution + Offset
```

---

## 19. CANopen

Desteklenecek yapılar: NMT, SYNC, EMCY, PDO, SDO, Heartbeat, Node guarding, LSS, Object Dictionary, EDS import.

CANopen COB-ID çözümleme aracı oluşturulmalı. SDO transferleri: Expedited, Segmented, Block.

Object dictionary gösterimi: Index, Sub-index, Name, Data type, Access type, Raw value, Physical value.

---

## 20. LIN

Frame yapısı: Break, Sync, Protected Identifier, Data, Checksum. Sync = `0x55`.

```
PID parity:
P0 = ID0 XOR ID1 XOR ID2 XOR ID4
P1 = NOT(ID1 XOR ID3 XOR ID4 XOR ID5)
```

Destekle: PID validation, Classic checksum, Enhanced checksum, Frame timing, Schedule table, Signal decoding, LDF import (temel destek).

---

## 21. UDS, ISO-TP ve OBD-II

### 21.1 ISO-TP
Frame türleri: Single Frame, First Frame, Consecutive Frame, Flow Control.
Alanlar: Payload length, Sequence number, Block size, Separation time, Padding, Addressing mode.

### 21.2 UDS — desteklenecek servisler
```
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
```

```
Positive response: Response SID = Request SID + 0x40
Negative response: 0x7F, Original SID, Negative Response Code
```

### 21.3 OBD-II
Destekle: Mode 01, Mode 03, Mode 04, Mode 09, PID decoder, DTC decoder, VIN decoder.

```
RPM = ((A × 256) + B) / 4
Vehicle Speed = A km/h
Temperature = A - 40 °C
```

---

## 22. FlexRay, SENT ve PSI5

**FlexRay:** Frame ID, Cycle count, Payload length, Header CRC, Frame CRC, Static segment, Dynamic segment, Channel A/B, Timing overview.

**SENT:** Sync pulse, Status nibble, Data nibbles, CRC nibble, Pause pulse, Fast channel, Slow channel. (Nibble değeri pulse süresinden hesaplanmalı.)

**PSI5:** Frame type, Slot, Data bits, Parity, CRC, Sensor addressing, Synchronous/asynchronous mode.

Not: Bu 3 protokolde ilk sürümde doğrudan fiziksel sinyal yakalama zorunlu değil; kullanıcı pulse/frame loglarını içe aktarabilmeli.

---

## 23. NMEA 0183

Genel yapı: `$TALKER,FIELD1,FIELD2,...*CHECKSUM` — Checksum = `$` ve `*` arasındaki karakterlerin XOR'u.

Desteklenecek mesajlar: GGA, RMC, GSA, GSV, VTG, HDT, HDG, MWV, DBT, DPT, ZDA, GLL, ROT, RSA, VHW, VLW, XDR, MTW.

```
Decimal Degrees = Degrees + Minutes / 60   (South ve West negatif)
```

Canlı gösterimler: Koordinat, Heading, Speed, Depth, Wind, Satellite count, Altitude, Fix quality, Checksum state.

---

## 24. NMEA 2000

CAN ve J1939 benzeri 29-bit identifier yapısı üzerinden analiz edilmeli.

Destekle: PGN, Source address, Destination, Priority, Fast packet, Single frame, Multi-packet, Device instance, Manufacturer code, Product information.

Örnek PGN kategorileri: Position, Heading, Speed, Depth, Wind, Engine, Battery, Environmental, AIS, Navigation.

Log desteği: Candump import, CSV import, JSON import, USB-CAN bridge.

---

## 25. AIS Decoder

AIS mesajları NMEA taşıma cümlelerinden çözülmeli. Destekle: AIVDM, AIVDO, Fragment count, Fragment number, Channel, Payload, Fill bits.

AIS 6-bit ASCII payload decoder gerekli.

Temel mesaj tipleri: Position Report Class A, Static and Voyage Data, Class B Position Report, Base Station Report, Safety Related Message.

Göster: MMSI, Latitude, Longitude, Course over ground, Speed over ground, Heading, Navigation status, Ship name, Call sign, Ship type.

---

## 26. MAVLink

Destekle: MAVLink 1, MAVLink 2, Signing, Sequence counter, Message CRC, CRC extra, System ID, Component ID.

Mesajlar: HEARTBEAT, SYS_STATUS, GPS_RAW_INT, ATTITUDE, GLOBAL_POSITION_INT, LOCAL_POSITION_NED, VFR_HUD, BATTERY_STATUS, COMMAND_LONG, COMMAND_ACK, PARAM_VALUE, HIGHRES_IMU.

Grafikler: Roll, Pitch, Yaw, Altitude, GPS, Ground speed, Battery, Packet loss.

```
Delta = (Current Sequence - Previous Sequence) mod 256
Delta > 1 ise: Lost Packets = Delta - 1
```

---

## 27. ARINC 429

32-bit word decoder. Alanlar: Label, SDI, Data, SSM, Parity.

Özellikler: Octal label, Bit order handling, BNR, BCD, Discrete, Signed value, Scale, Parity validation, SSM interpretation.

```
BNR Physical Value = Raw Signed Value × Resolution
```

İlk sürüm log tabanlı çalışmalı.

---

## 28. Ethernet ve ağ protokolleri

Kullanıcı HEX, PCAP veya bridge üzerinden ağ paketlerini analiz edebilmeli.

**28.1 Ethernet II:** Destination MAC, Source MAC, EtherType, VLAN, Payload, (FCS varsa doğrulama).

**28.2 IPv4:** Version, IHL, DSCP, Total length, Identification, Flags, Fragment offset, TTL, Protocol, Header checksum, Source IP, Destination IP. IPv4 header checksum doğrulaması eklenmeli.

**28.3 UDP:** Source port, Destination port, Length, Checksum, Payload.

**28.4 TCP:** Source port, Destination port, Sequence, Acknowledgment, Flags, Window, Checksum, Options, Payload.
TCP flags: FIN, SYN, RST, PSH, ACK, URG, ECE, CWR.

**28.5 MQTT:** CONNECT, CONNACK, PUBLISH, PUBACK, SUBSCRIBE, SUBACK, UNSUBSCRIBE, PINGREQ, PINGRESP, DISCONNECT. Göster: Topic, QoS, Retain, Duplicate, Packet identifier, Payload, Properties.

**28.6 CoAP:** Version, Type, Token length, Code, Message ID, Token, Options, Payload.

---

## 29. Endüstriyel Ethernet

Log tabanlı veya PCAP tabanlı decoder: EtherCAT, ProfiNet, EtherNet/IP, CIP, Sercos III, POWERLINK, Modbus TCP, OPC UA (temel görüntüleme), IEC 61850 GOOSE, DNP3 TCP, IEC 60870-5-104.

Her protokol için ilk aşamada çözümlenecek alanlar: Header, Message type, Address, Command/service, Sequence, Length, Status, Error, Payload. (İleri seviye mühendislik tanımları sonradan genişletilebilir.)

---

## 30. BACnet, KNX, DALI ve bina otomasyonu

**BACnet:** BACnet MS/TP, BACnet/IP, Device instance, Object type, Object instance, Property identifier, Service choice, APDU, NPDU.

**KNX:** Control field, Source address, Destination address, Routing counter, Length, APCI, Data, Checksum.

**DALI:** Address, Command, Data, Forward frame, Backward frame, Timing information.

**DMX512:** Break, Mark after break, Start code, Channel values, Refresh rate, Universe, Art-Net packet, sACN packet.

---

## 31. BLE, Zigbee, Thread ve LoRaWAN

**BLE:** Advertising packet, Device address, Advertising type, Manufacturer data, Service UUID, Service data, RSSI, GATT characteristic, Notification decoder.

**Zigbee:** Frame control, Sequence, PAN ID, Source, Destination, Cluster, Profile, Payload.

**Thread:** IPv6, UDP, CoAP, Mesh addressing, Network data.

**LoRaWAN:** Destekle: Join Request, Join Accept, Unconfirmed/Confirmed Data Up, Unconfirmed/Confirmed Data Down.
Alanlar: MHDR, DevAddr, FCtrl, FCnt, FPort, FRMPayload, MIC.

Güvenlik notu: Güvenlik anahtarı girilmişse yerel çözümleme yapılabilir — **anahtarlar dışarı gönderilmemeli**.

---

## 32. AT Command Studio

GSM, LTE, GNSS, Wi-Fi ve Bluetooth modemleri için AT komut terminali.

Özellikler: Komut geçmişi, Otomatik CR/LF, Komut şablonları, Beklenen cevap, Timeout, Regex tabanlı response parser, Çok satırlı cevap, URC mesajları, Script oluşturma.

Örnek komutlar: `AT`, `AT+GMR`, `AT+CSQ`, `AT+CREG?`, `AT+CGATT?`, `AT+CGPSINFO`

Komut sekansı örneği:
```
1. Send AT
2. Expect OK
3. Send AT+CSQ
4. Parse signal quality
5. Fail if response timeout
```

---

## 33. Protocol Converter

Farklı protokoller arasında alan eşleme aracı. Örnek dönüşümler: Modbus register → MQTT topic, NMEA heading → CAN signal, CAN DBC signal → JSON, UART custom frame → UDP packet, J1939 SPN → CSV, BACnet property → MQTT, Modbus TCP → Modbus RTU, NMEA 0183 → NMEA 2000 gösterim modeli.

Kullanıcı kaynak/hedef alanlarını eşleyebilmeli. Mapping örneği:
```
Source: Modbus Register 40001
Transform: value × 0.1
Destination: MQTT Topic: sensors/temperature
```

---

## 34. Log Analyzer

Desteklenen formatlar: TXT, CSV, JSON, BIN, ASC, Candump, PCAP, PCAPNG, Serial terminal logs, Custom timestamped logs.

Özellikler: Otomatik delimiter tespiti, Timestamp/Direction/Data/ID sütunu seçme, Protocol auto-detection, Frame extraction, CRC validation, Error filtering, Timeline, Statistics, Export.

Kural: Büyük dosyalar **Web Worker** içinde işlenmeli; tablolar **sanallaştırılmalı**.

---

## 35. Bilinmeyen protokol analizi

Unknown Protocol Analyzer özellikleri: Sabit byte tespiti, Değişen byte tespiti, Sayaç tespiti, Uzunluk alanı tespiti, Checksum tahmini, CRC tahmini, Timestamp tahmini, ASCII alanı tespiti, Endianness tahmini, Entropy analizi, Mesaj kümelendirme, Periyot analizi, Korelasyon analizi.

```
Change Rate_i = Count(Byte_i(t) ≠ Byte_i(t-1)) / (N - 1)
Entropy: H(X) = -Σ p(x) × log2(p(x))
Counter detection: Delta_t = Value_t - Value_(t-1)
Checksum Match Rate = Matching Frames / Total Frames × 100
```

---

## 36. Message Difference Analyzer

İki veya daha fazla mesajı karşılaştırır. Göster: Değişen byte, Değişen bit, XOR difference, Decimal difference, Signed difference, Sabit alan, Muhtemel sayaç, Muhtemel CRC, Muhtemel payload, Korelasyon.

Örnek:
```
Packet A: AA 01 10 04 25 01 00 00 7C 55
Packet B: AA 01 10 04 2A 01 00 00 91 55

Çıktı:
Byte 4: 0x25 → 0x2A   Difference: +5
Byte 8: 0x7C → 0x91   Possible checksum field
```

---

## 37. Gerçek zamanlı grafik ve sinyal sistemi

Her sayısal alan grafiğe eklenebilmeli. Özellikler: Live chart, Pause, Resume, Zoom, Pan, Multiple signals, Unit, Min, Max, Average, RMS, Standard deviation, Rolling window, CSV export, PNG export, Downsampling, Threshold, Alarm.

Örnek sinyaller: Temperature, Voltage, Current, RPM, Heading, Altitude, Depth, Wind speed, CAN signal, Modbus register, J1939 SPN, MQTT payload value.

---

## 38. Test Automation Studio

Kullanıcı haberleşme test senaryoları oluşturabilmeli. Adımlar: Connect, Disconnect, Send frame, Wait, Wait for frame, Validate field, Validate CRC, Set variable, Increment variable, Loop, Conditional branch, Log result, Export report.

Örnek senaryo:
```
1. Connect to COM4 at 115200 baud
2. Send status request
3. Wait up to 500 ms
4. Expect command 0x31
5. Validate CRC
6. Read temperature
7. Fail if temperature > 85 °C
8. Repeat 100 times
9. Export report
```

Rapor alanları: Test name, Start time, End time, Pass, Fail, Timeout, Received frame, Expected value, Actual value, Error details.

---

## 39. Haberleşme istatistikleri

Hesaplanacak metrikler: Total frames, Valid frames, Invalid frames, RX bytes, TX bytes, CRC errors, Checksum errors, Framing errors, Timeout errors, Packet rate, Byte rate, Average/Min/Max frame length, Packet loss, Sequence errors, Mean period, Jitter, Bus load, Response time (min/max).

```
CRC Error Rate = CRC Error Frames / CRC Checked Frames × 100
Packet Loss Rate = Missing Packets / Expected Packets × 100
Jitter_i = Period_i - Mean Period
σ = sqrt[ Σ(Period_i - Mean Period)^2 / N ]
```

---

## 40. Proje yönetimi

Bir proje şunları saklamalı: Project name, Description, Connection profiles, Protocol definitions, Packet templates, Decoder settings, Filters, Graph configurations, Test scenarios, Saved logs, Mapping rules, User notes.

JSON proje yapısı `version` içermeli:

```json
{
  "formatVersion": 1,
  "project": {
    "name": "ALP Marine Communication Test",
    "description": "NMEA and Modbus analysis",
    "connections": [],
    "protocols": [],
    "packetTemplates": [],
    "charts": [],
    "tests": []
  }
}
```

Import sırasında uygulanacaklar: Schema validation, Version check, Migration, Error handling, Unknown field handling.

---

## 41. Gizlilik ve güvenlik

Temel işlemler **yerel olarak** gerçekleştirilmeli.

Sunucuya gönderilmemesi gereken veriler: Seri port mesajları, CAN logları, Özel protokol tanımları, Modbus register değerleri, Ağ paketleri, Şifreleme anahtarları, LoRaWAN anahtarları, Test logları.

Kurallar: Kullanıcı izni olmadan port açma (yasak), `eval` kullanma (yasak), Dinamik kod çalıştırma (yasak), HTML sanitize et, Dosya boyutu sınırı uygula, Parser timeout kullan, Maximum frame length uygula, Worker cancellation uygula, Sonsuz loop engelle, Anahtarları kalıcı saklama seçeneğini varsayılan olarak kapalı tut.

---

## 42. UX standardı

Her araç şu bölümleri içermeli:
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

Hata mesajları açıklayıcı olmalı — örnekler:
```
Invalid hexadecimal input
Frame length does not match the length field
CRC mismatch
Unsupported function code
Start delimiter not found
Value exceeds uint16 range
Serial port permission denied
Protocol definition contains circular length references
```

---

## 43. Test gereksinimleri

Bütün hesaplama motorları ve parser'lar için birim testi yazılmalı. Temel test fixture'ları (referans değerler):

**CRC** — Input: `123456789` → CRC-8: `0xF4`, CRC-16 CCITT-FALSE: `0x29B1`, CRC-16 MODBUS: `0x4B37`, CRC-32: `0xCBF43926`

**UART** — Baud: 115200, Format: 8N1, Length: 20 byte → Expected time: ≈ 1.736 ms

**Modbus RTU** — `01 03 00 00 00 02 C4 0B` → Address: 1, Function: 3, Start register: 0, Register count: 2, CRC: valid

**NMEA** — `$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47` → Latitude: 48.1173, Longitude: 11.516666..., Checksum: valid

**Custom protocol** — `AA 05 10 03 34 12 7F 4F 55` → Address: 5, Command: 0x10, Length: 3, Payload: 34 12 7F, XOR checksum: valid, EOF: valid

**J1939** — CAN ID: `0x18F00401` → Priority: 6, PGN: 61444, Source address: 1

**IEEE-754** — Float: 25.75 → Big-endian: `41 CE 00 00`, Little-endian: `00 00 CE 41`

---

## 44. Performans hedefleri

Ana sayfa hızlı açılmalı; basit hesaplamalar anlık yapılmalı; 100.000 satırlık log arayüzü dondurmamalı; canlı akış UI thread'i bloklamamalı; parser saniyede binlerce frame işleyebilmeli; grafik maksimum nokta sayısını sınırlamalı; büyük tablolar virtualized olmalı; ağır analizler Web Worker içinde çalışmalı; protocol auto-detection iptal edilebilir olmalı; log parsing progress göstergesi bulunmalı.

---

## 45. Sürüm planı

**Version 1.0 — Temel haberleşme araçları:** Ana sayfa, HEX ve ASCII converter, Endian converter, IEEE-754 converter, CRC calculator, UART calculator, SPI calculator, I²C calculator, Live Serial Monitor, Custom Protocol Studio, Packet Builder, Modbus RTU, Modbus TCP, NMEA 0183, Log export, Project save/load, Dark mode.

**Version 1.1 — CAN ve otomotiv:** CAN analyzer, CAN FD, DBC, CAN bus load, CAN timing, J1939, CANopen, LIN, ISO-TP, UDS, OBD-II.

**Version 1.2 — Denizcilik ve havacılık:** NMEA 2000, AIS, MAVLink, DroneCAN, UBX, RTCM, ARINC 429, Live navigation dashboard.

**Version 1.3 — Endüstri ve bina otomasyonu:** Profibus temel analyzer, ProfiNet, EtherCAT, EtherNet/IP, IO-Link, HART, BACnet, KNX, DALI, DMX512.

**Version 1.4 — Ağ ve IoT:** Ethernet, IPv4, IPv6, TCP, UDP, MQTT, CoAP, BLE, Zigbee, LoRaWAN, PCAP import.

**Version 1.5 — İleri analiz:** Unknown Protocol Analyzer, CRC Finder, Protocol Converter, Test Automation Studio, Message clustering, Automatic field detection, Code generation, Protocol documentation generation.

---

## 46. Geliştirme sırası (Phase 1–10)

```
Phase 1: Project setup, Routing, Theme, Layout, Translation system, Reusable components
Phase 2: Byte utilities, Conversion engine, CRC engine, Timing calculators, Unit tests
Phase 3: Stream buffer, Framing engine, Protocol parser interface, Field decoder, Field encoder
Phase 4: Custom Protocol Studio, Packet Builder, Project storage
Phase 5: Web Serial Monitor, Live parser, Charts, Statistics
Phase 6: Modbus, NMEA 0183, CAN, DBC, J1939
Phase 7: CANopen, LIN, ISO-TP, UDS, OBD-II
Phase 8: NMEA 2000, AIS, MAVLink, UBX, RTCM
Phase 9: Ethernet, TCP/IP, MQTT, CoAP, PCAP
Phase 10: Industrial protocols, Wireless protocols, Reverse engineering, Test automation
```

---

## 47. Kod kalitesi

TypeScript strict mode kullan; `any` kullanımını en aza indir; Pure function kullan; Parser ve UI kodlarını ayır; Magic number kullanma; Sabitleri anlamlı isimlendir; Discriminated union kullan; BigInt gereken yerlerde BigInt kullan; Floating-point sonuçlarında tolerans kullan; Her parser için test fixture oluştur; Hatalı veride uygulamayı çökertme; Parser recovery mekanizması geliştir; **Protokol eklentisi mantığını destekle**.

Protocol plugin tanımı (TypeScript — AYNEN):

```typescript
interface ProtocolPlugin {
  id: string;
  name: string;
  category: ProtocolCategory;
  parser?: ProtocolParser;
  encoder?: ProtocolEncoder<unknown>;
  calculators?: CalculatorDefinition[];
  documentation?: ProtocolDocumentation;
  exampleFrames: ExampleFrame[];
}
```

---

## 48. Kabul kriterleri

Proje şu koşulları sağlamadan tamamlanmış kabul edilmemeli:

* Kullanıcı farklı HEX giriş biçimlerini girebilmeli
* Custom Protocol Studio ile alan tanımlayabilmeli
* Dynamic payload length çalışmalı
* CRC ve checksum doğrulanabilmeli
* Paket alanları renklendirilebilmeli
* Kullanıcı tanımlı protokolden paket üretilebilmeli
* Web Serial üzerinden veri alınabilmeli
* Parçalı serial chunk'lar birleştirilebilmeli
* Modbus RTU ve TCP çözümlenebilmeli
* NMEA checksum doğrulanabilmeli
* CAN frame analiz edilebilmeli
* DBC signal dönüşümü yapılabilmeli
* J1939 PGN hesaplanabilmeli
* Formüller ve ara adımlar gösterilmeli
* Proje JSON olarak kaydedilebilmeli
* Log dosyaları büyük veride UI'ı dondurmamalı
* Koyu tema çalışmalı
* Mobil görünüm kullanılabilir olmalı
* Kullanıcı verileri varsayılan olarak yerel kalmalı

---

## 49. Beklenen teslimat

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

README bölümleri: Project Overview, Features, Supported Protocols, Architecture, Installation, Development, Testing, Deployment, Web Serial Usage, Local Bridge Usage, Adding a New Protocol, Protocol Definition Format, Security and Privacy, Roadmap.

---

## 50. Son geliştirme talimatı

Projeyi **tek bir dosyada yazma**.

Önce uygulama mimarisini, routing yapısını, temel UI bileşenlerini ve Protocol Core sistemini oluştur. Daha sonra hesaplama motorlarını ve veri dönüştürücüleri geliştir.

İlk çalışan teslimatta şu araçlar **gerçekten çalışmalı** (15 araç):

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

Boş veya yalnızca görsel kartlar oluşturma. Her aracın **gerçek hesaplama veya parsing motoru** bulunmalı.

Her sonuç ekranında gösterilmeli: Nihai sonuç, Ham değer, Fiziksel değer, Kullanılan formül, Ara hesaplamalar, Birimler, Doğrulama durumu, Hata ve uyarılar.

### 50.1 Ana sayfa kategorileri için revize öneri (dokümanın kendi içindeki ek not)

Dokümanın sonunda, Bölüm 5'teki orijinal ana kategori listesini **revize eden** bir öz-değerlendirme yer alıyor. Gerekçe: Doküman artık ayrı ayrı **Industrial, Automotive, Marine, Aerospace, Building, Network ve Wireless** protocol klasörleri öngörüyor (bkz. Bölüm 6 mimari, `protocols/` altı), ama Bölüm 5'in ana sayfa kategori listesinde **Aerospace** ve **Building Automation** hiç yok.

Önerilen 17 kategori (gerekçeleriyle):

1. **Live Communication** — Serial, USB, Bluetooth, WebSocket bridge, canlı RX/TX ve gerçek zamanlı frame analizi.
2. **Protocol Studio** — Custom Protocol Studio, Packet Builder, custom binary/ASCII framing, encoder/decoder oluşturma. (`Protocol Encoders` ve `Protocol Decoders` ayrı ana kategori olmaktan çıkar; burada ve ilgili sektör kategorilerinde yer alır.)
3. **Serial & Interfaces** — UART, RS-232/422/485, SPI, I²C, I3C, SMBus, PMBus, 1-Wire, USB, CAN/LIN/FlexRay physical layer, 4–20 mA vb.
4. **Industrial Automation** — Modbus, PROFIBUS, PROFINET, EtherCAT, EtherNet/IP, CIP, CANopen, IO-Link, HART, OPC UA, IEC 60870, DNP3, IEC 61850 vb.
5. **Automotive** — CAN/CAN FD/CAN XL, J1939, LIN, FlexRay, SENT, PSI5, ISO-TP, UDS, OBD-II, DoIP, SOME/IP, XCP/CCP vb.
6. **Marine & Navigation** — NMEA 0183/2000, IEC 61162, AIS, GNSS, UBX, RTCM, SeaTalk, marine J1939 vb.
7. **Aerospace & UAV** — MAVLink, DroneCAN, Cyphal, SBUS, CRSF, ARINC 429, MIL-STD-1553, ADS-B, Mode-S, GNSS/RTCM vb. **(Şu an ana sayfa kategorilerinde tamamen eksik.)**
8. **Building Automation** — BACnet, KNX, DALI, M-Bus, LonWorks, DMX512, Art-Net, sACN. **(Bu da şu an ana sayfada eksik.)**
9. **Network & Ethernet** — Ethernet, VLAN, ARP, IPv4/IPv6, TCP/UDP, DHCP, DNS, NTP, SNMP, HTTP, WebSocket, RTP/RTCP, PTP, LLDP, mDNS vb.
10. **Wireless & IoT** — BLE, Zigbee, Thread, Matter, LoRa/LoRaWAN, Wi-Fi, ESP-NOW, Wireless M-Bus, NB-IoT, modem/GNSS haberleşmeleri.
11. **Data Conversion** — HEX/ASCII/Binary, endian, signed/unsigned, IEEE-754, BCD, bit-field, unit/engineering value dönüşümleri.
12. **CRC & Data Integrity** — CRC Calculator, checksum, parity, XOR/LRC, CRC Finder, integrity verification.
13. **Timing & Bus Calculators** — UART timing, I²C pull-up, SPI timing, CAN bit timing/bus load, Modbus timing, network throughput, LoRa airtime vb.
14. **Log & Capture Analyzer** — TXT/CSV/PCAP/serial log import, filtreleme, statistics, timeline, multi-protocol capture analizi.
15. **Protocol Reverse Engineering** — Unknown Protocol Analyzer, field detection, counter tespiti, CRC Finder, clustering, entropy/değişken byte analizi.
16. **Test & Simulation** — Test Automation Studio, frame generator, error injection, request/response simulation, protocol/device simulator.
17. **Projects & Documentation** — Project Manager, kayıtlı connection/profile/schema'lar, protocol documentation, code generation ve export.

**En büyük önerilen değişiklik:** `Protocol Decoders` ve `Protocol Encoders` ana sayfa kategorisi olmaktan çıkar — çünkü artık neredeyse her sektör kategorisinin kendi decoder/encoder'ı var. Yerine eksik olan **Aerospace & UAV**, **Building Automation** ve **Serial & Interfaces** ana kategori olur.

Önerilen nihai ana sayfa grupları (5 grup, AYNEN):

```
LIVE & DEVELOPMENT
  Live Communication
  Protocol Studio

COMMUNICATION DOMAINS
  Serial & Interfaces
  Industrial Automation
  Automotive
  Marine & Navigation
  Aerospace & UAV
  Building Automation
  Network & Ethernet
  Wireless & IoT

ENGINEERING TOOLS
  Data Conversion
  CRC & Data Integrity
  Timing & Bus Calculators

ANALYSIS & TEST
  Log & Capture Analyzer
  Protocol Reverse Engineering
  Test & Simulation

WORKSPACE
  Projects & Documentation
```

---

## Dikkat çekenler

* **Bölüm 5 vs Bölüm 50 çelişkisi:** Ana sayfa kategori listesi dokümanda iki kez tanımlanıyor ve ikincisi (Bölüm 50 sonu) birinciyi (Bölüm 5) açıkça revize ediyor — 17 alt kategori + 5 üst grup öneriliyor, `Protocol Decoders`/`Protocol Encoders` kaldırılıyor, `Aerospace & UAV` ve `Building Automation` ekleniyor. Uygulama IA'sı kurulurken **Bölüm 50 sonundaki revize liste** esas alınmalı, Bölüm 5'in orijinal 17 kategorisi değil.
* **"Offset" çakışması:** Bölüm 9.1'de alan özellik listesinde "Offset" iki farklı anlamda iki kez geçiyor — biri frame içindeki bayt konumu, diğeri Bölüm 9.2'deki `Physical Value = Raw × Scale + Offset` formülündeki kalibrasyon sabiti. Kod/şemada bu iki alan ayrı isimlerle modellenmeli (örn. `byteOffset` vs `calibrationOffset`) yoksa isim çakışması riski var.
* **Sürüm planında formülsüz protokoller:** Bölüm 45/46'da DroneCAN, UBX, RTCM, Profibus, IO-Link, HART, IPv6, Matter, ESP-NOW gibi isimler geçiyor ama bu okunan aralıkta (37321–40074) bu protokoller için ayrı formül/alan bölümü **yok** — muhtemelen dokümanın başka bir yerinde (37321 öncesi veya farklı bir ek) detaylandırılmış olabilir; kontrol edilmeli.
* **"En önemli bölüm" vurgusu:** Doküman Custom Protocol Studio'yu (Bölüm 9) açıkça "uygulamanın en önemli bölümü" olarak işaretliyor — implementasyon önceliklendirmesinde bu dikkate alınmalı (Phase 4'te de erken planlanmış).
* **32 alan tipi + 4 panel + JSON schema + 4 kod üretici (C/Python/TypeScript/Markdown doc)** Custom Protocol Studio'nun kapsamını tanımlıyor; bu modül tek başına küçük bir "protokol derleyicisi" niteliğinde.
* **Protocol Core 5 interface + 1 type alias**, tüm protokol parser/encoder'larının uyması gereken tek sözleşme — `ProtocolParser` ve `ProtocolEncoder<TMessage>` generic tasarımı, Bölüm 47'deki `ProtocolPlugin` ile birleşerek eklenti mimarisinin omurgasını oluşturuyor.
* **Test fixture'ları somut ve doğrulanabilir** (Bölüm 43): CRC-8/16/32 referans değerleri, UART timing, Modbus RTU örneği, NMEA GGA, custom protokol örneği, J1939 ID, IEEE-754 — bunların hepsi Bölüm 11/13/16/18/23'teki örneklerle birebir aynı verileri kullanıyor, yani spec içi tutarlılık yüksek.
* **İlk teslimat kapsamı net ve dar** (Bölüm 50): 15 araç isim isim sayılmış — bu liste MVP/Phase 1-6 kesişimiyle uyumlu ve geliştirme sırasını (Bölüm 46) doğruluyor.
* **Güvenlik kısıtı sert:** `eval` ve dinamik kod çalıştırma yasak; şifreleme/LoRaWAN anahtarları asla sunucuya gönderilemez ve varsayılan olarak kalıcı saklanamaz — bu, olası bir "kullanıcı tanımlı script/formül" özelliğinin sandbox'sız uygulanamayacağı anlamına geliyor.
* **Framing yöntemleri listesi 15 çeşit** (Fixed length'ten Modbus silent interval'a) — stream parser state machine'i (9 durum) bu çeşitliliği tek bir motor içinde karşılamalı.
* **CRC algoritma listesi 28 adet + custom parametrik CRC** (width/poly/init/reflect/xorout/check/residue) — CRC Finder aracı bunların hepsini brute-force deneyebilmeli, bu da Web Worker'a taşınması gereken ağır bir iş.
* Kaynak dosyadaki orijinal biçimlendirme (madde işaretleri için ters eğik çizgili escape, örn. `\!`, `\<`, `\>`, `\-`) bu özette temizlenmiş; sayısal/teknik içerik değişmeden aktarılmıştır.
