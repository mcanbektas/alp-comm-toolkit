# 3.2 Framing / Stream Protokolleri — Teknik Özet

Kaynak: satır 3629–6253 ("Custom Binary Protocol" → "3.2 Ortak Transaction Timeline"). Bu modül yalnızca HEX frame gösteren bir decoder değil; stream→frame dönüşümünü, escaping/stuffing işlemlerini, request-response ilişkisini, transfer state machine'ini ve hata kurtarma davranışını katman katman açıklayan bir analiz sistemi olmalıdır.

---

## Custom Binary Protocol

Açık standarda bağlı olmayan, üreticiye özel frame formatı. Toolkit için kritik öncelik çünkü endüstriyel cihazların büyük kısmı üretici-özel binary protokol kullanır.

Örnek frame: `AA 55 03 10 04 34 12 78 56 C9 27`

Örnek yapı (Offset/Length/Field):
| Offset | Length | Field |
|---|---|---|
| 0 | 2 | Header |
| 2 | 1 | Address |
| 3 | 1 | Command |
| 4 | 1 | Payload Length |
| 5 | 4 | Payload |
| 9 | 2 | CRC |

Görsel: `AA 55 | 03 | 10 | 04 | 34 12 78 56 | C9 27` → SYNC ADR CMD LEN DATA CRC

Kullanıcı herhangi bir field'a tıklayınca byte+bit karşılığını görmeli. Örnek: byte `0x34` → binary `00110100`, bit index 7-0.

Desteklenmesi gereken framing yöntemleri (11): Fixed Length, Start Byte, Multiple Start Bytes, End Byte, Start+End, Length Field, Timeout, Escaped Delimiter, COBS, SLIP-like, HDLC-like.

### Fixed-Length Custom Frame
16 byte'lık sabit mesaj örneği. Stream başlangıcı bilinmiyorsa yalnız fixed-length yetmez: noise byte'ı (`4F`) frame'ler arasına girerse (`AA 01 02...16byte`, `AA 02 03...16byte`) bir byte kayması sonraki tüm frame'leri bozar. Bu yüzden fixed-length'te bile Header + Known field + CRC doğrulaması şart.

### Length-Based Custom Binary
Frame: `AA 55 | LEN | PAYLOAD | CRC`. Örnek: `AA 55 04 11 22 33 44 A5 C1` → LEN=0x04, payload=`11 22 33 44`.

Toolkit'in desteklemesi gereken 4 length semantiği (üretici protokollerinde standart değil):
- Length includes payload only
- Length includes header
- Length includes checksum
- Length includes complete frame

### Address / Command Yapısı
Tipik: HEADER ADDRESS COMMAND LENGTH DATA CRC. Örnek `AA 01 20 02 32 64 8D` decode: Header=AA, Address=01, Command=20 (Set Output), Length=02, Channel=0x32, Value=0x64, Checksum=Valid.

### Request / Response Eşleştirme
TX: `AA 01 10 00 CRC` → RX: `AA 01 90 02 19 00 CRC`. Toolkit: Request Command 0x10, Response Command 0x90, Response Time 4.27 ms eşleştirmesi yapmalı.

### Sequence Counter
Örnek dizi: `AA 01 10...`, `AA 02 10...`, `AA 03 10...`, `AA 05 10...` → Toolkit: Expected Sequence 04, Received Sequence 05, Possible Lost Frame 1 göstermeli.

### Decoder Davranışı
Custom Binary Decoder şunları yapmalı: sync byte arama, olası frame başlangıcı tespiti, length doğrulama, CRC/checksum kontrolü, enum alan isimlendirme, signed/unsigned dönüşüm, endian dönüşüm, scale/offset uygulama, sequence counter takibi, request-response eşleştirme, bilinmeyen byte'ları raw bırakma.

---

## ASCII Protocol

İnsan-okunabilir karakterlerden oluşan seri protokol sınıfı. Örnek: `TEMP,25.3,40.2\r\n` → HEX `54 45 4D 50 2C 32 35 2E 33 2C 34 30 2E 32 0D 0A`. Toolkit HEX ve ASCII görünümü eşzamanlı göstermeli.

### Line Termination
CR=0x0D, LF=0x0A. `AT\r` → HEX `41 54 0D`. Toolkit "Show CR as `<CR>`" / "Show LF as `<LF>`" seçeneği sunmalı → görünüm: `AT<CR>`, `OK<CR><LF>`.

### ASCII Command-Response Örneği
TX: `READ:TEMP\r\n` → RX: `TEMP:25.4\r\n`. Parser çıktısı: Command=READ, Parameter=TEMP, Response Type=TEMP, Value=25.4, Unit=°C, Response Time=18.3 ms.

### Numeric Parsing
Desteklenmeli: Decimal (`123`), Signed (`-45`), Float (`25.75`), Scientific (`1.25E-3`), Hex text (`0x7F`), Boolean (`ON`/`OFF`), Enum (`AUTO`/`MANUAL`).

### ASCII Parser Sorunları
Gösterilmesi gereken durumlar (10): Missing CR, Missing LF, Unexpected character, Invalid UTF-8, Invalid numeric field, Too many fields, Too few fields, Line too long, Response timeout, Echo detected.

Echo örneği: TX `AT` → RX `AT` + `OK`. Toolkit ayrım yapmalı: Echo: AT / Final Result: OK.

---

## Delimiter-Based Protocol

Frame başlangıcı/sonu özel byte(lar) ile belirlenir. Örnek: `STX DATA ETX`, STX=0x02, ETX=0x03 → `02 31 32 33 34 03` = `<STX>1234<ETX>`.

### Start + End Delimiter
`AA ... 55`. Örnek: `AA 01 10 22 33 C7 55`. Parser akışı: Search AA → Collect bytes → Find 55 → Validate frame.

### Delimiter Collision Problemi
Payload içinde delimiter byte'ı çıkabilir: Header=AA, End=55, payload `10 55 20` içindeki çıplak `55` parser tarafından frame sonu sanılabilir. Çözüm yöntemleri: Escaping, Byte stuffing, Length field, COBS.

### Escape Örneği
END=0x7E, ESCAPE=0x7D. Payload `01 7E 02` → wire `01 7D 5E 02`. **Exact dönüşüm protokole özeldir**; toolkit kullanıcı tanımlı (custom) escape rule tanımlamaya izin vermelidir — sabit tek algoritma yeterli değil.

### Decoder
Ayırt edilmesi gereken durumlar (9): Valid Frame, Empty Frame, Missing Start, Missing End, Nested Start, Unexpected Escape, Truncated Escape, Maximum Frame Length Exceeded, Timeout Before End.

---

## Length-Based Protocol

Frame uzunluğu header içindeki bir alandan belirlenir. Örnek: `AA 55 05 10 20 30 40 50 CRC` (Length alanı=05).

Parser adımları: (1) Header bul, (2) Length oku, (3) Gerekli byte sayısını hesapla, (4) Payload tamamlanana kadar bekle, (5) Checksum/CRC oku, (6) Validate et.

### Length Alanı Boyutları
Desteklenmeli: uint8, uint16 LE, uint16 BE, uint24, uint32, variable-length integer.

Endianness örneği: length bytes `34 12` → Little-endian yorumda `0x1234=4660`; Big-endian yorumlanırsa `0x3412=13330`. **Length endianness açıkça tanımlanmalıdır.**

### Güvenlik ve Parser Limiti
Length alanına körü körüne güvenilmemeli. Bozuk frame örneği: `AA 55 FF FF ...` → Length=65535 diye 64 kB beklenmemeli. Schema: Maximum Frame Length=1024 ise hata: "Declared length exceeds maximum".

### Resynchronization
Bozuk length alınırsa parser sonraki olası header'ı aramalı: `AA 55 FF ...` (garbage) `AA 55 04 ...` → ikinci header'a resync.

---

## SLIP — Serial Line Internet Protocol

RFC 1055: IP datagramlarını seri hat üzerinde frame'lemek için basit yöntem; `END` ve `ESC` karakterlerini kullanır.

Özel byte'lar: `END=0xC0`, `ESC=0xDB`, `ESC_END=0xDC`, `ESC_ESC=0xDD`. Encode kuralı: payload içindeki `0xC0` → `DB DC`; `0xDB` → `DB DD`.

### Örnek
Ham payload: `45 00 C0 11 DB 22` → SLIP encoded: `45 00 DB DC 11 DB DD 22 C0`.
Byte view: `45`, `00`, `DB DC`→decoded `C0`, `11`, `DB DD`→decoded `DB`, `22`, `C0`→END.

### Decoder State
Durumlar: READING, ESCAPE_SEEN, FRAME_COMPLETE, ERROR.
Pseudo: `if byte==C0: frame complete`; `elif byte==DB: next byte escaped`; `else: append byte`. ESC sonrası: DC→C0, DD→DB.

### SLIP'in Sınırlamaları
SLIP kendisi: address alanı tanımlamaz, packet type tanımlamaz, CRC/checksum sağlamaz, sequence sağlamaz, retransmission sağlamaz (RFC 1055'e göre yalnız basit packet framing). Toolkit göstermeli: Framing: Valid / Integrity: Not provided by SLIP.

---

## COBS — Consistent Overhead Byte Stuffing

Frame içinden belirli bir byte değerini (genelde `0x00`) tamamen kaldıran reversible byte-stuffing algoritması; böylece `0x00` delimiter olarak güvenle kullanılabilir. Orijinal Cheshire–Baker çalışmasına göre worst-case overhead: her 254 input byte başına en fazla 1 byte.

### Temel Mantık
Encoded stream: `CODE DATA DATA DATA CODE DATA ...`. Code byte, bir sonraki `0x00`'ın nerede olduğunu temsil eder.

### Örnekler
- Ham `11 22 00 33` → COBS `03 11 22 02 33` → delimiter ile `03 11 22 02 33 00`. Açıklama: `03`→sonraki 2 byte non-zero (`11 22`)→original zero→`02`→sonraki 1 byte (`33`).
- Ham `00` → COBS `01 01` → delimiter ile `01 01 00`.

### 0xFF Code
Bir blokta 254 adet sıfır-olmayan byte varsa `FF` code kullanılır ve yeni block başlar — bu, worst-case overhead'i sınırlayan temel mekanizma.

### Toolkit Görünümü
RAW `11 22 00 33` / COBS `03 11 22 02 33` / WIRE `03 11 22 02 33 00`.

### COBS Decoder Hataları
Zero found inside encoded frame, Code exceeds remaining length, Truncated block, Missing delimiter, Maximum frame exceeded, Decode produced invalid length.

### COBS + CRC
COBS kendi başına integrity sağlamaz. Önerilen yapı: Payload → CRC ekle → COBS encode → `0x00` delimiter. Wire: `[COBS(DATA+CRC)] 00`. Receiver: Find 00 → COBS decode → CRC validate → Parse payload.

---

## HDLC — High-Level Data Link Control

Bit-oriented data-link framing ailesi. Frame: FLAG ADDRESS CONTROL INFORMATION FCS FLAG. Flag=`01111110` (0x7E). PPP'nin HDLC-like framing standardı da aynı `01111110` flag'i kullanır.

### Bit Stuffing
Payload içinde yanlışlıkla `01111110` oluşmasını önlemek için: gönderici 5 ardışık `1` bitinden sonra otomatik `0` ekler. Örnek: original `01111110...` → stuffed `011111010...` (eklenen bit işaretli). Receiver 5 ardışık `1`den sonraki stuffed `0`'ı kaldırır. PPP'nin bit-synchronous HDLC-like framing tanımı da FCS dahil içerikte aynı kuralı tanımlar.

### Toolkit İki Ayrı Görünüm
Logical Frame (`7E FF 03 12 34 CRC 7E`) ve Transmitted Bit Stream (`01111110 ...` — eklenen bitler `[STUFFED 0]` farklı renkte).

### HDLC Frame Sınıfları
Control alanı yorumuna göre 3 sınıf: I-frame (Information/sequenced data), S-frame (Supervisory), U-frame (Unnumbered control). IBM SDLC dokümantasyonu aynı I/S/U sınıflandırmasını kullanır — SDLC ve HDLC aileleri yakından ilişkili.

### Decoder
Göstermeli: Flag, Address, Control, Frame Type, N(S), N(R), Poll/Final, Information, FCS. **Exact control-field bit yorumu seçilen HDLC profile/moduna göre değişir.**

### FCS
Profile'a göre değişebileceğinden seçenekler: CRC-16 profile, CRC-32 profile, Custom HDLC FCS.

---

## SDLC — Synchronous Data Link Control

IBM'in synchronous bit-oriented protokolü; frame yapısı HDLC ile çok benzer. IBM AIX SDLC dokümantasyonu: Flag, Station Address, Control, Information, FCS, Flag; 3 frame türü: Information, Supervisory, Unnumbered.

Görsel: `7E | ADDRESS | CONTROL | INFORMATION | FCS | 7E`

**Station model** — toolkit metadata: Local Station, Remote Station, Primary/Secondary Role, Station Address, Poll/Final State.

**Frame type**: Control byte decode ile Information/Supervisory/Unnumbered Frame sınıflandırması.

**Bit stuffing**: Flag transparanlığı için HDLC-benzeri destek gerekli.

**Toolkit**: İlk sürüm log/import tabanlı çalışabilir — Raw bit stream, HEX frame, Decoded control, Station address, FCS, Frame type, Sequence information.

---

## PPP — Point-to-Point Protocol

RFC 1661: çoklu network-layer protokolünü point-to-point link üzerinden taşımanın standart yöntemi. RFC 1662: async/sync bağlantılarda HDLC-like framing.

### PPP Frame
Flag, Address, Control, Protocol, Information, Padding, FCS, Flag. Değerler: Flag=0x7E, Address=0xFF, Control=0x03. Protocol alanı 8 veya 16 bit (RFC 1661: kapsüllenmiş datagram türünü belirler). Örnek: `7E FF 03 C0 21 ... FCS 7E` → `C021`=LCP.

### LCP
Link Control Protocol yapısı: Code, Identifier, Length, Data. RFC 1661 code tablosu: 1 Configure-Request, 2 Configure-Ack, 3 Configure-Nak, 4 Configure-Reject, 5 Terminate-Request, 6 Terminate-Ack, 7 Code-Reject.

Toolkit negotiation timeline: Configure-Request → Configure-Ack → Link Open; veya Configure-Request → Configure-Nak → New Configure-Request.

### PPP Asynchronous Escaping
RFC 1662: Control Escape=0x7D. `0x7E`→`7D 5E`, `0x7D`→`7D 5D`. Dönüşüm: escaped byte'ın `0x20` ile XOR'u. Örnek: original `01 7E 02` → wire `01 7D 5E 02`.

### ACCM
Asynchronous Control Character Map — bazı control byte'ların da escape edilmesini sağlar. Toolkit: ACCM bitmap + Escaped Character List göstermeli.

### FCS
16-bit veya 32-bit. Toolkit: Received FCS, Calculated FCS, PASS/FAIL.

---

## KISS — Keep It Simple, Stupid / KISS TNC Framing

Bilgisayar ile packet-radio TNC arası basit binary framing. Delimiter: FEND=0xC0. Payload'daki `0xC0` escape edilmeli (TAPR kaynakları FESC/FEND mekanizmasını doğrular).

Değerler: FEND=C0, FESC=DB, TFEND=DC, TFESC=DD.

### Data Frame Örneği
`C0 00 [AX.25 FRAME] C0`. İlk byte (`00`) genelde data command/port bilgisi (TAPR standart port-0: `C0 00 <packet> C0`).

### Escaping
Payload `11 C0 22 DB 33` → wire `11 DB DC 22 DB DD 33`.

### Decoder Görünümü ve Hataları
Görünüm: FEND, Command/Port, Payload, FEND. Payload AX.25 ise zincirleme decode: KISS → AX.25 → APRS/higher layer.
Hatalar: Missing FEND, Unexpected FESC, Invalid escape, Unknown command, Empty frame, Oversized frame.

---

## XMODEM

Seri dosya transferi için block-based protokol. Ward Christensen'in orijinal tanımı: async 8N1, 128-byte veri blokları, SOH/EOT/ACK/NAK/CAN kontrol karakterleri (sonradan düzeltilmiş ACK=`0x06`).

Kontrol byte'ları: SOH=0x01, EOT=0x04, ACK=0x06, NAK=0x15, CAN=0x18.

### Classic XMODEM Frame
SOH, Block Number, 255-Block Number, 128-byte Data, Checksum. Örnek: `01 01 FE [128 DATA BYTE] CHECKSUM` → Block=0x01, Complement=0xFE (çünkü `0x01+0xFE=0xFF`).

### Checksum
Formül: **Checksum = (Σ Data_i) mod 256** (128 payload byte'ının düşük 8 biti).

### XMODEM-CRC
Sonraki türevler CRC-16 kullanabilir; receiver başlangıçta `'C'` göndererek CRC mode ister. Handshake: Receiver→C, Sender→Block 1, Receiver→ACK, Sender→Block 2, Receiver→ACK, ..., Sender→EOT, Receiver→ACK.

### Retry
CRC/checksum bozuksa NAK gönderilir, aynı block tekrar gönderilir. Timeline örneği: Block 17 CRC:FAIL → NAK → Retry 1 → Block 17 CRC:PASS → ACK.

### XMODEM-1K
Güncel `lrzsz` dokümanları XMODEM-1K'yı ayrıca destekler (receiver 1024-byte block kullanır). Toolkit 128-byte Block / 1024-byte Block ayrımını göstermeli.

---

## YMODEM

XMODEM ailesini batch file transfer, dosya adı ve metadata ile genişletir. Güncel `lrzsz` receiver dokümantasyonu: 128 veya 1024 byte sector kabul edilir; "True YMODEM" metadata mevcutsa dosya uzunluğu, modification time, file mode kullanılabilir.

### Block 0
File metadata: SOH, 00, FF, `filename\0`, filesize..., padding, CRC. Örnek: `firmware.bin\0` `32768 1710000000 ...`. Toolkit: Filename: firmware.bin, Declared Size: 32768 byte, Modification Time: ...

### Data / Batch Transfer
Sonraki bloklar (Block 1, 2, 3...) gerçek payload taşır; YMODEM-1K'da STX ile 1024-byte block. Batch session: File 1 metadata → File 1 data → EOT → File 2 metadata → File 2 data → EOT → Empty metadata block → Session end.

### Toolkit
Tree view: `Session ├─ firmware.bin (Size/Blocks/Retries/CRC) └─ config.dat`.

---

## ZMODEM

XMODEM/YMODEM'e göre gelişmiş streaming ve hata kurtarma. GNU/FreeBSD `lrzsz` XMODEM/YMODEM/ZMODEM için aktif referans uygulamadır; `rz` ZMODEM batch receiver olarak çalışır.

Önemli kavramlar: Session negotiation, File information, Streaming data, Position information, Error recovery, Resume, Batch transfer, CRC.

### Genel Session Görünümü
State machine: Initialization → Receiver Ready → File Information → File Accepted → Data → End Of File → Next File/Finish.
Yaygın frame isimleri: ZRQINIT, ZRINIT, ZFILE, ZRPOS, ZDATA, ZEOF, ZFIN. **Çeşitli legacy implementation farkları** bulunduğundan parser kullanılan ZMODEM profile/implementation bilgisini metadata olarak tutmalı.

### Resume
Örnek: File Size: 8,388,608 / Received: 5,242,880 / Resume Position: 5,242,880.

### Streaming Görünümü
XMODEM'in her block için ACK bekleme modeli yerine stream tabanlı görünüm: Data Stream ──▶, Checkpoint, CRC, Recovery request.

---

## UBX — u-blox Binary Protocol

u-blox GNSS cihazları için binary format. u-center yazılımı class/ID seçerek payload oluşturur, header+checksum otomatik üretilir.

Frame: Sync, Class, ID, Length, Payload, Checksum. Yaygın sync: `B5 62`. u-blox `ubxlib` örnek log: `B5 62 0A 06 00 00 10 3A`.

Görünüm: `B5 62 | 01 | 07 | 5C 00 | PAYLOAD... | CK_A CK_B` → SYNC CLASS ID LENGTH DATA CHECK.

### Length
Little-endian. Örnek: `5C 00` → Length=`0x005C`=92.

### Class / ID
İsimlendirme: Class: NAV, ID: PVT → UBX-NAV-PVT. Güncel örnekler: UBX-RXM-SFRBX, UBX-RXM-MEASX, UBX-RXM-RAWX.

### Checksum
Toolkit: Received CK_A, Received CK_B, Calculated CK_A, Calculated CK_B. Checksum coverage seçilen u-blox protocol specification sürümüne göre değişir; **sync byte'larının checksum'a dahil olup olmadığı UI'da açıkça belirtilmeli.**

### Stream Parser
UBX/NMEA aynı porttan gelebileceğinden multi-protocol detection: `$`→possible NMEA, `B5 62`→possible UBX, `D3`→possible RTCM3.

Toolkit log görünümü örneği: `12:10:01.000 UBX-NAV-PVT`, `12:10:01.050 NMEA-GGA`, `12:10:01.100 RTCM3-1077`, `12:10:02.000 UBX-NAV-PVT`.

---

## RTCM

GNSS correction ve navigasyon verisi mesaj ailesi. Güncel Version 3 standardı: **RTCM 10403.4** (Version 3 + Amendment 1, Kasım 2024). **Tam teknik mesaj tabloları lisanslı yayın kapsamındadır** (ücretsiz erişilemez).

Decoder sürüm seçimine sahip olmalı: RTCM 2.x, RTCM 3.x, Selected message database revision.

### RTCM 3 Stream Detection
Frame düzeyi: Preamble, Reserved, Length, Payload, CRC. Toolkit minimum göstermeli: Preamble, Payload Length, Message Type, Station ID, Payload, CRC State.

### Message Type
Payload başındaki mesaj numarası: 1005, 1077, 1087, 1097, 1127, 1230, ... **Exact field decoding seçilen RTCM 10403 revision'ının resmi tanımına bağlı olmalı.**

### GNSS Kategorileri
Message database kategorileri: Reference Station, GPS, GLONASS, Galileo, BeiDou, MSM, Antenna, Station Information, SSR.

### CRC
Toolkit: Frame Length, Received CRC, Calculated CRC, CRC PASS/FAIL. **CRC algoritması (exact polynomial, bit processing) resmi RTCM implementation profile'a göre protocol modülü içinde sabit tutulmalı** — kullanıcı generic CRC ekranından yanlış parametre girmemeli.

### Multi-Protocol GNSS Monitor
Auto detector: `B5 62`→UBX, `$`→NMEA, `D3`→possible RTCM3 → candidate parser çalıştırılır → length/CRC ile doğrulanır.

---

## AT Commands

Modemler ve haberleşme modülleri için text tabanlı command/response ailesi. ITU-T V.250 (güncel sürüm 07/2003), DTE'nin DCE'yi async serial üzerinden kontrolü için AT format standardını tanımlar. 3GPP TS 27.007 cellular UE AT command set'ini tanımlar (halen change control altında).

### Temel Command / Command Form
`AT<CR>` → HEX `41 54 0D` → Response `OK<CR><LF>`.

Formlar: General `AT+COMMAND`, Read `AT+COMMAND?`, Set `AT+COMMAND=value`, Test `AT+COMMAND=?`. **Her üretici 4 formu da desteklemek zorunda değil** — destek command definition'a göre belirlenir. u-blox AT command manual: command line = "AT" prefix + command name + configurable termination char; başarılı→OK, başarısız→ERROR.

Örnek: TX `AT+CSQ\r` → RX `+CSQ: 18,99\r\n` `OK\r\n`. Toolkit: Command: AT+CSQ, Type: Execution, Intermediate Response: +CSQ: 18,99, Final Response: OK, Response Time: 42.1 ms.

### URC — Unsolicited Result Code
Modem komut gönderilmeden kendiliğinden mesaj üretebilir: `+CEREG: 1`, `+UUSORD: 0,64`, `RING`. Toolkit bunları normal response ile karıştırmamalı — Command transaction ve URC stream ayrı kanallar olmalı. u-blox tanımı: event/status change nedeniyle DCE'nin async ürettiği mesajlar.

### Parser State
IDLE, COMMAND_SENT, WAITING_RESPONSE, READING_INTERMEDIATE, READING_FINAL, DATA_PROMPT, DATA_MODE, TIMEOUT, ERROR.

### Final Result
OK, ERROR, CONNECT, NO CARRIER, BUSY, NO ANSWER + üretici-özel `+CME ERROR:` / `+CMS ERROR:`.

### Prompt Tabanlı Command / Binary Payload
Örnek: `AT+SEND=10` → `>` prompt. Toolkit zinciri: Command → Prompt → Binary/Text Payload → Final Result. Bazı modern AT setleri binary payload'ı aynı workflow içinde taşır (u-blox: SOH+length içeren ayrı veri formatı) — AT parser yalnız line-based text parser olmamalı.

---

## Hayes Command Set

`AT` yaklaşımının tarihsel temeli. ITU-T V.250: mevcut modem pratiğinde kullanılan "ATtention" command set'ini kodifiye eder. Temel yapı: `AT` prefix. Klasik örnekler: AT, ATI, ATD..., ATA, ATH, ATO, ATZ.

### Temel Anlamlar
AT=Attention/modem response test, ATI=Identification information, ATD=Dial, ATA=Answer, ATH=Hook control/hang up, ATO=Return to online data mode, ATZ=Reset profile. Exact desteklenen komutlar modem implementation'ına bağlı.

### S-Register Yapısı
`ATS<number>?` / `ATS<number>=value`. u-blox V.250-tabanlı örnek: S2=Escape character, S3=Command termination, S4=Response formatting, S5=Command-line editing character.

### Command Mode / Data Mode
İki durum: COMMAND MODE (ATD... gibi komutlar işlenir) ve ONLINE DATA MODE (raw user data uzak bağlantıya aktarılır).

### Escape Sequence
Data mode'dan command mode'a dönüş: klasik `+++`. **Doğru escape detection yalnızca üç `+` aramak değildir** — guard-time kavramı var. Toolkit analyzer timeline: Silence / +++ / Silence.

### Echo / Verbose
`ATE0` sonrası echo kapanabilir — toolkit Echo ON/OFF tespiti yapmalı. Verbose (OK/CONNECT/ERROR) yerine numeric result code kullanılabilir — response mapper Raw Result → Semantic Result şeklinde çalışmalı.

---

## 3.2 İçin Ortak Frame Visualizer (TAM)

Bölümdeki tüm protokoller aynı ortak visualizer altyapısını kullanmalı:

- **RAW görünüm**: `00000000  AA 55 01 10 04 34 12 78 56 C9 27`
- **HEX + ASCII**: `AA 55 01 10 04 34 12 78 56 C9 27` / `.U...4.xV.'`
- **Binary**: `AA`→`10101010`, `55`→`01010101`
- **Field görünümü**: `AA 55 | 01 | 10 | 04 | 34 12 78 56 | C9 27` → SYNC ADR CMD LEN DATA CRC
- **Bit görünümü**: seçilen byte `0x10` → bit `7 6 5 4 3 2 1 0` = `0 0 0 1 0 0 0 0`, bit 4 "Command bit" olarak işaretli
- **Stream görünümü**: Noise → `73 91`; Frame 1 → `AA 55 01 ...`; Frame 2 → `AA 55 02 ...`
- **Stuffing görünümü** (karşılaştırmalı): PPP `7E`→`7D 5E`; COBS `11 22 00 33`→`03 11 22 02 33`; SLIP `C0`→`DB DC`; KISS `C0`→`DB DC`; HDLC bit-level `11111...`→`111110...` (stuffed 0 işaretli)

Bu ekran kullanıcının **byte stuffing ile bit stuffing arasındaki farkı doğrudan görmesini** sağlamalıdır.

---

## 3.2 Ortak Decoder Hata Modeli (TAM)

Tüm serial/frame protokol decoder'ları ortak hata modelini desteklemeli (19 kod):

`NO_SYNC`, `INVALID_HEADER`, `INVALID_LENGTH`, `FRAME_TOO_SHORT`, `FRAME_TOO_LONG`, `TRUNCATED_FRAME`, `INVALID_ESCAPE`, `INVALID_STUFFING`, `INVALID_CHECKSUM`, `INVALID_CRC`, `UNSUPPORTED_COMMAND`, `UNSUPPORTED_MESSAGE`, `SEQUENCE_ERROR`, `TIMEOUT`, `UNEXPECTED_RESPONSE`, `NACK_RECEIVED`, `RETRY_LIMIT`, `BUFFER_OVERFLOW`, `PARSER_RESYNC`

Her hata için gösterilecek alanlar: Severity, Timestamp, Offset, Expected, Received, Possible Cause, Recovery Action.

Örnek — CRC ERROR: Frame `AA 01 10 02 34 12 8F 71`, Received CRC `0x718F`, Calculated CRC `0x61CE`. Possible Causes: corrupted byte, incorrect CRC profile, wrong CRC coverage, wrong byte order.

---

## 3.2 Ortak Stream Auto-Detection (TAM)

Platform aynı stream içinde birden fazla olası framing pattern'i test edebilmeli.

Örnek GNSS stream: `B5 62 ...`, `24 47 50 ...`, `D3 ...`, `B5 62 ...`.

Candidate detector: `B5 62`→UBX candidate, `'$'`→NMEA candidate, `D3`→RTCM3 candidate. **Candidate yalnız başlangıç byte'ına göre kesin protokol sayılmamalı.**

Doğrulama: Header + Length + Known message structure + Checksum/CRC üzerinden confidence hesaplanır.

Örnek — Protocol Detection: UBX: Header match 100%, Length valid 100%, Checksum valid 100%, Confidence HIGH; RTCM: Preamble match 0%.

---

## 3.2 Ortak Transaction Timeline (TAM)

Request-response protokolleri için: TX Request → (2.1 ms) → Request Complete → (8.7 ms processing) → RX Response → Response Complete.

Ölçümler: Request Duration, Response Delay, Response Duration, Round Trip Time, Inter-Frame Gap, Timeout Margin, Retries.

File transfer protokollerinde ayrı session timeline: Block → ACK → Block → ACK → Block → NAK → Retry → ACK.

**Mimari tez** (kaynağın kapanış cümlesi, korunmalı): 3.2 modülü yalnız HEX frame gösteren bir decoder değil; serial stream'in frame'e dönüşümünü, escaping/stuffing işlemlerini, request-response ilişkisini, transfer state machine'ini ve hata kurtarma davranışını katman katman açıklayan bir analiz sistemi olmalıdır.

---

## Dikkat çekenler

1. **Length semantiği standart değil**: Custom Binary'de LEN alanının 4 farklı anlamı olabilir (yalnız payload / header dahil / checksum dahil / tüm frame dahil). Toolkit cihaz bazında yapılandırılabilir tutmazsa parse hatası kaçınılmaz.
2. **Endianness belirsizliği somut örnekle gösteriliyor**: aynı `34 12` baytları LE'de 4660, BE yanlış okumada 13330 veriyor — UI'da açık seçim şart, varsayılan tanımlanmamış.
3. **Delimiter-Based escape dönüşümü kasıtlı olarak açık bırakılmış**: "exact dönüşüm protokole özeldir" deniyor, tek algoritma verilmemiş → toolkit sabit escape algoritması yerine kullanıcı tanımlı escape-rule motoru gerektiriyor.
4. **HDLC/SDLC control-field yorumu profile-bağımlı**: "seçilen HDLC profile/moduna göre" değiştiği açıkça belirtiliyor — tek kanonik decode yok, her profil için ayrı tablo/bakım yükü var.
5. **FCS/CRC seçimi açık bırakılmış**: HDLC için CRC-16/CRC-32/Custom, PPP için 16-bit/32-bit — varsayılan tanımlanmamış; yanlış profil seçilirse sessizce yanlış PASS/FAIL çıkabilir.
6. **RTCM mesaj tabloları lisanslı**: "RTCM standardının tam teknik mesaj tabloları lisanslı yayın kapsamındadır" — toolkit'in RTCM decode derinliği yalnızca açık kaynaklarla tam kurulamaz; bu bir lisans/maliyet riski, salt teknik değil.
7. **RTCM CRC bilinçli olarak generic ekrandan çıkarılmış**: exact polynomial/bit processing protokol modülüne sabitleniyor, kullanıcıya generic CRC parametre girişi verilmiyor — doğru tasarım ama yanlış çıkarsa kullanıcı sebebini genel ekrandan teşhis edemez.
8. **UBX checksum kapsamı versiyon-bağımlı**: sync byte'larının checksum'a dahil olup olmadığı "seçilen u-blox protocol specification sürümüne göre" değişiyor ve UI'da ayrıca belirtilmesi gerekiyor — tek doğru cevap yok.
9. **ZMODEM'de kanonik tanım yok**: "çeşitli legacy implementation farkları" olduğu açıkça kabul ediliyor; ZRQINIT/ZRINIT gibi frame'ler %100 tekdüze değil → parser tek bir "doğru" ZMODEM varsaymamalı, profile/implementation metadata'sı tutmalı.
10. **AT command 4 formu zorunlu değil**: genel/read/set/test formlarından hangisinin destekleneceği üreticiye göre değişir — toolkit desteği per-command tanım/veritabanından türetmeli, varsaymamalı.
11. **Hayes escape sequence tespiti kırılgan**: "+++" tespitinin yalnızca üç `+` aramakla yapılamayacağı, guard-time gerektiği açıkça uyarılıyor — naif tespit, veri içindeki literal "+++" ile yanlış pozitif üretebilir.
12. **Severity skalası tanımsız**: Ortak Decoder Hata Modeli her hata için "Severity" alanı istiyor ama skalanın kendisi (ör. INFO/WARN/ERROR/FATAL) kaynakta tanımlanmamış — implementasyon boşluğu.
13. **Auto-Detection confidence eşiği belirsiz**: confidence hesaplama bileşenleri (Header+Length+Known structure+CRC) veriliyor ama düşük confidence'ın hangi sayısal eşikte reddedileceği belirtilmemiş.
