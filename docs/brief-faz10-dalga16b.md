# BRİF — Faz 10 dalga 16b, `seatalk` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga16.md`i**, sonra bu dosyayı okur.
**16a'nın Görev 0'ı (fixture mayınları) bitmiş olmalıdır** — aksi hâlde bu alt
dalga `src/pages/ProtocolPage.test.tsx`i kırar.

Bu alt dalga **`legacy-proprietary-marine` ailesini KAPATIR** (16a'nın
`hdlc-based-marine`i + bu kayıt).

**İKİ `[DUR-SOR]` kararı taşır** (ana brif açık soru 3 ve 4). İkisi de karara
bağlanmadan kod yazılmaz.

---

## Kaynak durumu — beklenenden ÇOK daha iyi

Keşif turunun hipotezi *"`seatalk` kaynaksız-kayıt politikasının muhtemel
adayıdır"* idi. **ÇÜRÜDÜ** (ana brif çürüyen tahmin 3). Gerçek durum:

**Birincil kaynak: Thomas Knauf, *SeaTalk Technical Reference*, Revision 3.23.**
Dört sayfa da CANLI (HTTP 200, 2026-08-26'da doğrulandı):

| Sayfa | URL | Tarih | İçerik |
|---|---|---|---|
| İndeks | http://www.thomasknauf.de/seatalk.htm | 29.07.2017 | sürüm geçmişi |
| **Part 1** | http://www.thomasknauf.de/rap/seatalk1.htm | 01.02.2009 | **tel + çerçeveleme** |
| **Part 2** | http://www.thomasknauf.de/rap/seatalk2.htm | **21.10.2023** | **60 datagram** |
| Part 3 | http://www.thomasknauf.de/rap/seatalk3.htm | 01.09.2003 | PC arayüzü + C monitörü |

**Üç bağımsız uygulama örtüşüyor** — "iki bağımsız kaynak" kuralı (dalga 13
dersi 5) fazlasıyla sağlanıyor:

| Uygulama | Ne doğruluyor | Dosya:satır |
|---|---|---|
| `MartinDavidWaller/SeaTalkNMEA` (`6d73294`) | 9-bit AVR UART, uzunluk formülü, çarpışma kuralı | `Source/HardwareSerial9bit/HardwareSerial.h:82` (`SERIAL_9N1 0x86`) · `Source/SeaTalkNMEA/SeaTalkNMEA.ino:31,1394,1717-1725,1740` |
| `MatsA/seatalk1-to-NMEA0183` (`dd4cb3c`) | 9-bit bit-bang, 4800 baud | `STALK_read.py:30` — `st1read.bb_serial_read_open(gpio, 4800, 9)` |
| `SignalK/nmea0183-signalk` (`e587926`) | **21 datagramın alan çözümü** | `src/hooks/ALK.ts:19-27` · `src/hooks/seatalk/index.ts` · her hook dosyası Knauf'un Part 2 metnini **birebir doc yorumu olarak gömüyor** (ör. `0x84.ts:20-45`) |
| `canboat` (`102d0f7`) | **20 SeaTalk PGN'i** — NMEA 2000 tüneli | `database/pgns/126720-seatalk1Keystroke.yaml:29-52` · `126720-seatalk1PilotMode.yaml` |

**Knauf'un sayfası ekosistemin de-facto normatif kaynağıdır.** SignalK onu
birebir alıntılıyor, gpsd bibliyografyasında ona atıf yapıyor
(`gpsd/www/NMEA.adoc:3059-3061`).

### `[DİKKAT]` — kaynağın KENDİ güvenilirlik uyarısı

Knauf, kendi sayfasında birebir: *"the description is **incomplete inaccurate
and may even be wrong**."* Raymarine hiçbir resmî spec yayımlamadı. Bazı
komutlar sayfada "unknown meaning" olarak duruyor (ör. Raystar 120'den gelen
`A7 09 86 …`).

**Bu, rozetin ve adlandırma kapsamının gerekçesidir** (aşağıda).

### `gpsd` SeaTalk 1'i ÇÖZMEZ — yanılgıya düşme `[KANIT]`

`gpsd/include/packet_states.h:66`daki `SEATALK_LEAD_1` **SeaTalk protokolü
değil**, NMEA 0183'ün `$II`/`$IN` talker öneki içindir
(`gpsd/gpsd/packet.c:660,938`). Kaynak ararken gpsd'ye bakan model bunu
protokol desteği sanabilir.

---

## Girdi sözleşmesi

**TEK bir SeaTalk 1 datagramının ham baytları** — 3 ile 18 bayt arası.

`data[0]` **komut baytıdır** (varsayılan; `commandByteSource` seçeneğiyle
değiştirilebilir), `data[1]` **attribute baytıdır** ve düşük nibble'ı uzunluğu
taşır.

**RF/elektriksel katman ve 9-bit UART parser'a GİRMEZ** — girdi zaten
çözülmüş baytlardır (`hdlcCore.ts`in "Logical Frame" ayrımıyla aynı disiplin).

---

## BULGU 8 (ana brif) — komut biti ÇERÇEVEDE YOKTUR

**Bu alt dalganın en incelikli noktasıdır ve spec özeti bunu VERMİYOR.**
`05-denizcilik.md:228-241` elektriksel katmanı hiç anlatmıyor; bilgi tamamen
dış kaynaktan geldi.

Knauf Part 1 §Serial Data Transmission, birebir:
> *"**11 bits are transmitted for each character:** 1 Start bit (0V) / 8 Data
> Bits (least significant bit transmitted first) / **1 Command bit, set on the
> first character of each datagram. Reflected in the parity bit of most
> UARTs.** Not compatible with NMEA0183 but well suited for the multiprocessor
> communications mode of 8051-family microcontrollers (bit SM2 in SCON set). /
> 1 Stop bit (+12V)"*

Yani **4800 baud, 1 start + 9 veri + 1 stop = 11 bit/karakter.** Dokuzuncu bit
veri değil, **datagram başlangıç işaretidir** ve `Uint8Array`de **YERİ YOKTUR.**

### Parity numarası — nasıl okunduğu, kanıtla

Knauf'un kendi DOS monitörü (Part 3) bir 16550'yi şöyle programlıyor:
```c
_outb(  24, PORT  ); /*DLL Set Baud Rate to 4800 LSB*/
_outb(0x3B, PORT+3); /*LCR Stick Parity to 0, Enable Parity, 1 Stop bit, 8 bits/char */
...
if(line_status_reg & 4) { /* Parity bit set => Command Byte */
```
`0x3B`, Linux'un kanonik UART kayıt tanımlarına göre
(`torvalds/linux` `include/uapi/linux/serial_reg.h:110-119`):

| bit | define | değer | anlam |
|---|---|---|---|
| 0-1 | `UART_LCR_WLEN8 0x03` | 11 | 8 veri biti |
| 2 | `UART_LCR_STOP 0x04` | 0 | 1 stop biti |
| 3 | `UART_LCR_PARITY 0x08` | 1 | parity açık |
| 4 | `UART_LCR_EPAR 0x10` | 1 | even-parity seçimi |
| 5 | `UART_LCR_SPAR 0x20` | 1 | **stick parity** |

Stick + EPAR ⇒ parity biti sabit **0 (SPACE)** olarak beklenir. Komut baytı
9. bitini `1` taşıdığı için parity uyuşmaz ve UART `UART_LSR_PE = 0x04`
(`serial_reg.h:145`) kaldırır. **`line_status_reg & 4` testi tam olarak
budur: "parity hatası" bayrağı KOMUT BİTİ göstergesidir.**

Linux tarafında karşılığı `CMSPAR` (belgesiz):
SPACE = `c_cflag |= PARENB|CMSPAR; c_cflag &= ~PARODD`,
MARK = `c_cflag |= PARENB|CMSPAR|PARODD`
(https://viereck.ch/linux-mark-space-parity/).

İki gerçek alternatif de kodda: `SERIAL_9N1 0x86` (AVR gerçek 9-bit,
`HardwareSerial.h:82`) ve `bb_serial_read_open(gpio, 4800, 9)` (Pi bit-bang,
`STALK_read.py:30`).

### [Karar 16b-1] Bunun parser'a etkisi

Bu, `mil-std-1553`ün *"sözcük tipi çerçevede YOK"* bulgusunun (15g) ve
`io-link`in `messageSide`inin (13h) birebir sınıfıdır: **girdinin bir parçası
çerçevenin İÇİNDE değil.**

`decodeOptions` `commandByteSource`:
- **`assumeFirstByte` (VARSAYILAN):** `data[0]` komut baytıdır. Tek datagram
  yapıştırıldığı için bu yapısal olarak doğrudur.
- **`lengthChained`:** `3 + (data[1] & 0x0F)` zincirini takip ederek girdideki
  datagram sınırlarını doğrular; uzunluk tutmazsa `datagramBoundaryUnverified`
  uyarısı.

**HER İKİ modda da KOŞULSUZ bir `commandBitNotInBytes` uyarısı basılır**
ve alan tablosunda komut baytı `Command (assumed)` olarak adlanır.
Gerekçe `mode-s`in DF0/4/5'te CRC PASS/FAIL alanını **HİÇ BASMAMASI** (15h) ile
aynı: olmayan bir ölçümü varmış gibi göstermemek. Burada ölçüm var ama
**varsayıma dayalı** ve bu görünür olmalı.

`[BEKLENTİ — uygulamada doğrulanacak]` Çok datagramlı yapıştırmalarda
`lengthChained` modunun desenkronizasyondan kurtulabilmesi. Kurtulamıyorsa
mod düşürülür ve brif işaretlenir.

---

## BULGU 9 (ana brif) — CHECKSUM YOKTUR, bu KESİN

Knauf Part 1/2/3'ün TAM metninde `checksum`/`Checksum`/`CRC`/`crc` araması
**SIFIR sonuç** veriyor. Belgelenen tek iki bütünlük mekanizması:

### 1) Tümleyen-çift artıklığı — YALNIZ bazı komutlarda

Part 1 §Data Coding, birebir:
> *"Some characters are repeated with all bits inverted for noise or
> transmission error detection. **Example: 0xA2 is followed by 0x5D. The sum of
> both bytes must always be 0xFF.** The listing below shows repeated bytes in
> small letters (example: ZZ zz)."*

Part 2, komut `82` satırı: *"XX+xx = YY+yy = ZZ+zz = FF (allows error
detection)"*.

Gerçek örnek (Part 2, keystroke `86`): `86 11 05 FA` — `0x05 + 0xFA = 0xFF`.

**canboat bu artıklığı NMEA 2000 tünelinde bile koruyor** `[KANIT]`
`126720-seatalk1Keystroke.yaml` alanları: `device`, `key`, **`keyInverted`**.

→ `complementCheck` seçeneği (varsayılan `true`): tümleyen çifti TANIMLI olan
komutlarda toplamın `0xFF` olduğu doğrulanır ve PASS/FAIL basılır. Tanımlı
OLMAYAN komutlarda **alan HİÇ BASILMAZ** (uydurma doğrulama üretmemek).

### 2) Uzunluk uyuşmazlığı = at

Part 1 §Collision Management, birebir:
> *"For listeners this means that messages which are **shorter than expected
> are invalid and have to be cancelled totally**."*

Doğrulayıcı: `SeaTalkNMEA.ino:1749` bir datagramı yalnız `packetLength == bi`
ile kabul ediyor — **checksum yolu KODDA YOK.**

→ `strictLength` seçeneği (varsayılan `true`): `data.length !== 3 + (data[1] &
0x0F)` ise `ProtocolError` (`success: false`). `false` yapılırsa uyarıyla
devam edilir.

### TUZAK — `$STALK`ın `*CS`i SEATALK'IN DEĞİLDİR

SignalK SeaTalk'u `$STALK,xx,yy,nn*CS` sarmalıyla taşıyor
(`nmea0183-signalk/src/hooks/ALK.ts:19-27`) ve o `*CS` **NMEA 0183'ün XOR
checksum'ıdır** — sarmalın, SeaTalk'un değil. Bir model bunu görüp
"SeaTalk'un checksum'ı var" sonucuna varabilir. **VARMAZ.** Aksine bu, yerlisi
olmadığının kanıtıdır.

**Bu motorun girdisi `$STALK` cümlesi DEĞİL, ham datagram baytlarıdır.**
`$STALK` sarmalı bir KONTEYNER biçimidir (`mode-s`in Beast/SBS konteynerleri
gibi, 15h) ve **kapsam dışıdır**; sayfa metninde belirtilir.

---

## Datagram yapısı — tam formül

Part 2 sütun başlığı birebir: `Com Att Dat Dat...`

Part 1 §Composition of Messages, birebir:
> *"Each datagram contains **between 3 and 18 characters**:
> - Type of command (**the only byte with the command-bit set**)
> - Attribute Character, specifying the total length of the datagram in the
>   least significant nibble:
>   - Most significant 4 bits: **0 or part of a data value**
>   - Least significant 4 bits: Number of additional data bytes = n =>
>   - **Total length of datagram = 3 + n characters**
> - First, mandatory data byte
> - 3. - 18. optional, additional data bytes"*

```
┌──────────┬─────────────────────┬──────────────────────────────┐
│ Command  │ Attribute           │ Data … (1 + n − 1 bayt)      │
│ data[0]  │ data[1]             │ data[2 … 2+n]                │
│ 9. bit=1 │ MSN: veri | LSN: n  │ toplam uzunluk = 3 + n       │
└──────────┴─────────────────────┴──────────────────────────────┘
   n = 0 → 3 bayt (en kısa)        n = 15 → 18 bayt (en uzun)
```

**TUZAK — attribute'ın YÜKSEK nibble'ı VERİDİR.** `data[1] & 0xF0` bir dolgu
değil, komuta göre anlamlı bir veri parçasıdır (ör. `9C U1 VW RR`de `U`
başlığın yüksek bitlerini ve dönüş yönünü taşır). **`data[1]`i tümüyle
"length" diye adlandırmak YANLIŞTIR** — alan `Attribute` adını alır, düşük
nibble'ı ayrı bir `Attribute · Additional Byte Count` alanı olarak basılır.

Formül üç bağımsız yerde doğrulandı:
- Knauf'un monitörü: `byte_ctr = (receiver_buf & 0xF) + 2;` (+2 çünkü komut
  baytı zaten tüketilmiş)
- `SeaTalkNMEA.ino:1740`: `packetLength = 3 + (v & 0x0f);`
- Part 2'nin her satırı: `00 02 YZ XX XX` → `3+2=5` ✔ · `20 01 XX XX` →
  `3+1=4` ✔ · `30 00 0X` → `3+0=3` ✔ · `84 U6 …` → `3+6=9` ✔

---

## Komut tablosu — 60 komut, ama HEPSİ adlandırılmaz

Knauf Part 2'de belgeli **60 farklı komut baytı** (iki bağımsız sayımın
birleşimi):
```
00 01 05 10 11 20 21 22 23 24 25 26 27 30 36 38 50 51 52 53 54 55 56 57 58 59
61 65 66 68 6C 6E 70 80 81 82 83 84 85 86 87 88 89 90 91 92 93 95 99 9A 9C 9E
A1 A2 A4 A5 A7 A8 AB C7
```

**SignalK 21 datagramı çözüyor** (`src/hooks/seatalk/index.ts`):
`00 10 11 20 21 22 25 26 27 50 51 52 53 54 56 57 82 84 85 99 9C`

**canboat 20 SeaTalk PGN'i tanımlıyor**, ikisi doğrudan SeaTalk 1 komut
baytına eşleniyor: `seatalk1Command match: 134` = **0x86** (Keystroke) ve
`match: 132` = **0x84** (PilotMode).

### [DUR-SOR] Karar 16b-2 — adlandırma kapsamı (ana brif açık soru 4)

Üç yol:

**(a) 60 komutun hepsi adlandırılır ve payload'ları çözülür.**
Tek kaynağa (Knauf) dayanır ve o kaynak kendisi için *"may even be wrong"*
diyor. Dalga 13 dersi 5'e (*"İki bağımsız kaynak örtüşmezse alan
ADLANDIRILMAZ"*) doğrudan aykırı.

**(b) *(ÖNERİLEN)* Katmanlı:**
- **60 komutun HEPSİ TANINIR** — komut baytı `Command` alanına adıyla basılır
  (Knauf'un tablosu bir isim listesi olarak güvenilir; yanlış olabilecek şey
  payload'ın BİT AYRINTISIDIR, komutun adı değil).
- **Payload YALNIZ çift-kaynaklı komutlarda çözülür** — SignalK'in 21'i ∪
  canboat'ın eşlediği 2'si. Bu küme için Knauf + bağımsız bir uygulama
  örtüşüyor.
- **Geri kalan ~39 komutta payload HAM kalır** + `commandPayloadNeedsVendorMap`
  uyarısı.

Bu, **`ads-b`nin Type Code kararının (15h) birebir aynı biçimidir**:
*"TC 5–8, 28, 29, 31 TANINIR ama payload ÇÖZÜLMEZ (ham + `typeCodeNotDecoded`
uyarısı)."*

**(c) Yalnız 21'i tanınır, gerisi tamamen ham.** Gereksiz dar — komut adı
bilgisi kaybedilir ve katalogdaki `Command Identification` aracı (`:448`)
karşılıksız kalır.

**Öneri: (b).** Ve `semanticDepth` seçeneği kullanıcıya üçünü de veriyor:
`envelope` (yalnız zarf) · `knownCommands` (varsayılan, (b)) · `raw`
(hiç adlandırma yok, tersine mühendislik modu).

### Çözülecek 21 komutun kaynak alıntıları (Part 2, birebir)

| Bytes | Uzunluk | Anlam |
|---|---|---|
| `00 02 YZ XX XX` | 5 | Depth below transducer = `XXXX/10` **feet**. `Y&8` anchor alarm · `Y&4` metric · `Z&4` transducer defective · `Z&2` deep alarm · `Z&1` shallow alarm. NMEA: DPT, DBT |
| `20 01 XX XX` | 4 | Speed through water = `XXXX/10` knots. NMEA: VHW |
| `26 04 XX XX YY YY DE` | 7 | Speed hi-res = `XXXX/100` kn sensör 1 (geçerli if `D&4=4`); `YYYY/100` = ortalama (if `D&8=0`) ya da sensör 2 (if `D&8=8`); `E&1=1` ortalama durdu; `E&2=2` MPH göster |
| `30 00 0X` | 3 (min) | Set lamp intensity; `X=0`:L0 · `4`:L1 · `8`:L2 · `C`:L3 |
| `9C U1 VW RR` | 4 | Compass heading + rudder. **heading = `(U&0x3)*90 + (VW&0x3F)*2 + (U&0xC ? (U&0xC==0xC ? 2 : 1) : 0)`**; `U`nun MSB'si dönüş yönü; `RR` rudder derece (pozitif = sağ) |
| `84 U6 VW XY 0Z 0M RR SS TT` | 9 | Autopilot. heading aynı formül; **course = `(V>>2)*90 + XY/2`**; `Z&0x2=0` Standby / `=2` Auto · `Z&0x4` Vane(WindTrim) · `Z&0x8` Track; `M&0x04` off-course · `M&0x08` wind shift; `RR` rudder (`0xFE` = 2° sol); `TT` = `0x08` 400G'de, `0x05` 150(G)'de |

**Gerçek yakalanmış baytlar** (Part 2'den, `exampleFrames` için birebir
kullanılabilir):
- `86 11 05 FA` — Keystroke "−1", Z101 uzaktan kumanda. `0x05 + 0xFA = 0xFF`
  (tümleyen çift). Diğerleri: `11 06 F9`=−10 · `11 07 F8`=+1 ·
  `11 08 F7`=+10 · `11 45 BA`=−1, 1 sn'den uzun basılı.
- `01 05 00 00 00 60 01 00` — Equipment ID = **Course Computer 400G**.
  Diğerleri: `01 05 04 BA 20 28 01 00` = ST60 Tridata ·
  `01 05 FF FF FF D0 00 00` = Smart Controller Remote.

### TUZAK — heading formülü NAİF DEĞİLDİR

`9C`/`84`ün başlık formülü üç parçalıdır ve orta terim **iki derecelik
adımlarla** ilerler, düzeltme terimi ise `U`nun 2-3. bitlerine bağlı bir
**0/1/2 derecelik** eklemedir:
```
heading = (U & 0x3) * 90            // çeyrek
        + (VW & 0x3F) * 2           // 2° adım
        + (U & 0xC ? (U & 0xC) == 0xC ? 2 : 1 : 0)   // 0/1/2° düzeltme
```
Bunu `(U & 0x3)*90 + VW/2` gibi "makul" bir şeye sadeleştirmek **hata VERMEDEN
yanlış açı üretir.** Formül `seatalk.ts` dosya başına birebir yazılır ve
testte Knauf'un örnek değerleriyle sınanır.

**`unit` KURALI:** çözülmüş heading `°`, derinlik `ft` (Knauf açıkça "feet"
diyor — `Y&4` metrik bayrağı SET ise dönüşüm yapılır ve `m` olur), hız `kn`
alır. **Ham `VW`, `U`, attribute nibble'ı BİRİMSİZDİR** (`types.ts:46`).

---

## SeaTalkNG — kapsam DIŞI, ve neden

Katalog summary'si SeaTalkNG'yi anıyor (`marine-navigation.ts:432-433`:
*"correlated across SeaTalkNG gateway conversions"*) ve tool listesinde
`SeaTalk1 → SeaTalkNG Gateway View` var (`:455`).

**SeaTalkNG = NMEA 2000. Kendi tel biçimi YOK.** Üç kaynak:
- **Raymarine'in kendi sayfası**, birebir: *"**SeaTalk NG is Raymarine's
  cabling system used to carry NMEA 2000 data.**… SeaTalk NG cables contain
  **an extra communication wire for SeaTalk 1**, allowing older Raymarine
  devices to integrate."*
  https://www.raymarine.com/en-us/our-products/networking-and-accessories/seatalk-ng-and-nmea-2000
- **Actisense**, birebir: *"On a data format / Protocol level, both of these are
  identical… **The only difference between the two is the physical layer.**"*
  https://actisense.com/news/understanding-different-protocols-seatalk/
- **OpenSeaMap**: *"SeaTalk-NG (Next Generation, **former: SeaTalk²**) is based
  on NMEA-2000 or CAN."* https://wiki.openseamap.org/wiki/h:En:Shipnetwork
  → **SeaTalk2 = SeaTalkNG'nin eski adı.** Katalog "SeaTalk2" demiyor ama bir
  model bunu ayrı bir protokol sanabilir.

**Karar:** `seatalk.ts` NMEA 2000'e HİÇ dokunmaz. Gateway görünümü çerçeveler
arası bir iştir (ana brif bulgu 12) ve **parser'a girmez.**

**AMA bir şey sayfa metnine girer** `[KANIT]` `canboat`:
SeaTalk 1 komutları NMEA 2000 içinde **Raymarine proprietary PGN 126720**
olarak tünellenir. `126720-seatalk1Keystroke.yaml:29-52`:
```yaml
- id: proprietaryId    match: 240   description: Seatalk 1 Encoded
- id: command          match: 129   description: Seatalk1
- id: seatalk1Command  match: 134   description: Keystroke     # 134 = 0x86
- id: device  - id: key  - id: keyInverted
```
`manufacturerCode match: 1851` = Raymarine. Kardeş dosya
`126720-seatalk1PilotMode.yaml` → `seatalk1Command match: 132` = **0x84**.

→ Sayfa metni bunu **`related` bağı ve bir not** olarak taşır: *"aynı komut
baytları NMEA 2000 üzerinde PGN 126720 içinde görünebilir."* Motor
üretmez. `related`e `marine-navigation/nmea-family/nmea-2000` zaten var
(`:461`).

---

## `canParse` — DAİMA `false`, ve bu ÖLÇÜLMÜŞ bir karardır

**Bu dalganın en yüksek `canParse` riskidir.** SeaTalk'ta:
- sihirli sayı **YOK**
- checksum **YOK**
- sınırlayıcı **YOK**
- adres **YOK** (Part 1: *"No datagrams or devices carry addresses"*)

Geriye tek sinyal kalıyor: `3 ≤ n ≤ 18 && n === 3 + (data[1] & 0x0F)`.

**Ölçüldü** (ana brif bulgu 10; 140 kayıt / 870 örnek çerçeve, 2026-08-26):

| İmza | Çakışma | Oran |
|---|---|---|
| Naif (`n === 3 + (b[1] & 0x0F)`) | **27 / 870** | %3.1 |
| Dar (+ `b[0]` ∈ Knauf'un 60 komutu) | **7 / 870** | %0.8 |

Dar imzanın yedi çakışması, adlarıyla:
```
bacnet-ip/original-unicast-npdu-read-property  (13B, cmd=0x81)
bacnet-ip/length-mismatch                      (13B, cmd=0x81)
bacnet-ip/invalid-type                         (13B, cmd=0x01)
bacnet-mstp/data-not-expecting-reply-i-am      (18B, cmd=0x55)
bacnet-mstp/bad-data-crc                       (18B, cmd=0x55)
iso-14230/service-data-truncated                (3B, cmd=0x83)
length-based-protocol/valid-frame               (7B, cmd=0x00)
```
Bağlam: 870 örneğin **501'i (%57.6)** zaten 3–18 bayt aralığında; uzunluk
tepesi 16B:99, 8B:52, 4B:51, 6B:36. **SeaTalk'un imza uzayı deponun en
kalabalık bölgesidir.**

**Karar: `canParse(): boolean { return false; }`**

`uavcanCompatibility.ts:27-34` emsali, **farklı sebeple** — ve dosya başına
o fark yazılır:
> `uavcan-compatibility`de sebep "kendi tel biçimi yok"tu. Burada tel biçimi
> VAR ama **baytlarda AYIRT EDİCİ SİNYAL YOK**: datagram sınırını belirleyen
> 9. bit çerçevenin dışında, checksum yok, sihirli sayı yok. İmza ne kadar
> daraltılırsa daraltılsın yanlış pozitif sıfırlanmıyor — **ölçüldü: en dar
> hâlinde bile 7/870.** `true` dönmek registry'nin aday listesini çöpe
> çevirirdi. Kullanıcı bu sayfayı **açıkça seçer**.

**Bekçi testi ZORUNLU:**
`src/protocols/marine/seatalk/seatalkCanParseRegistry.test.ts`
Kanıtlayacakları:
1. **Kendi `exampleFrames`i üzerinde bile `canParse` `false`** — kasıt kanıtı,
   `uavcanCompatibility.test.ts` emsali.
2. Yedi bilinen çakışma adayının hepsinde `false`.
3. `totalExamples > 800` sağlık kontrolü.
4. **Ölçüm testin İÇİNDE tekrarlanır:** naif imzayı uygulayan bir yardımcı
   çakışma sayar ve **`> 0` olduğunu ASSERT eder** — böylece "aslında `true`
   dönebilirdi" iddiası ileride sessizce doğru olamaz. Bu, brifteki sayının
   kodda bekçilenmesidir (`psi5.test.ts`in 1024-yük sayımının aynı biçimi).

---

## `decodeOptions` — DÖRT kanal

| Seçenek | Şıklar | Neden | Emsal |
|---|---|---|---|
| `commandByteSource` | `assumeFirstByte` (vars.) · `lengthChained` | **Komut biti çerçevede YOK** (Karar 16b-1) | `mil-std-1553` `wordType` (15g) |
| `semanticDepth` | `envelope` · `knownCommands` (vars.) · `raw` | Adlandırma kapsamı kullanıcı seçimi (Karar 16b-2) | `io-link` `messageSide` (13h) |
| `strictLength` | `true` (vars.) · `false` | Knauf: kısa datagram GEÇERSİZ, atılır | — |
| `complementCheck` | `true` (vars.) · `false` | Tümleyen çifti yalnız BAZI komutlarda tanımlı | — |

**Dalga 15'in dersi gereği bu sayının BÜYÜMESİ beklenir.** Muhtemel adaylar
(uygulamada görünürse eklenir, brif işaretlenir): derinlik birimi zorlaması
(`Y&4` metrik bayrağını ezmek), `9C` vs `84` heading formülü sürüm farkı,
Knauf'un "unknown meaning" komutlarını gösterme/gizleme.

---

## Beklenen rozet: `partial` — `[DUR-SOR]` (ana brif açık soru 3)

**Çözülen:** komut baytı (60 komut adıyla), attribute nibble'ı, uzunluk
formülü ve doğrulaması, tümleyen-çift kontrolü (tanımlı olduğu yerde),
21+ komutun alan alan payload'ı.

**Çözülmeyen ve AÇIKÇA yazılan:**
- **Komut biti doğrulanamıyor** — çerçevede yok, varsayılıyor.
- **~39 komutun payload'ı ham** — tek kaynak, çift doğrulama yok.
- **SeaTalkNG/gateway korelasyonu kapsam dışı** — çerçeveler arası.
- **`$STALK` konteyner biçimi kapsam dışı.**
- **Checksum yok** — bu bir eksiklik değil, protokolün kendisi; ama
  "doğrulanmış çerçeve" güvencesi de VERİLEMEZ.

Katalog bu rozeti zaten söylüyor: `definitions: ['vendor-map']` (`:461`) ve
yorum (`:459-460`): *"Açık bir NMEA standardı değil: mesaj tablosu vendor
dokümanından ya da kullanıcının doğruladığı eşlemeden yüklenir, tahmin
edilmez."* Spec de (`05-denizcilik.md:240`): *"**Proprietary limitation:**
SeaTalk 1 tamamen açık bir NMEA standardı değil."*

Emsal: `ads-b` 1090ES-only, `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only,
`psi5` yukarı-yön-tek-çerçeve.

---

## Uygulama görevleri

1. **Kaynak turu** — Knauf Part 1 ve Part 2'yi AÇ. **Özellikle doğrula:**
   (a) 11-bit karakter yapısı ve komut bitinin parity'de yansıması,
   (b) `3 + (attr & 0x0F)` formülü, (c) çözülecek 21 komutun bit
   ayrıntıları, (d) `9C`/`84` heading formülünün üç terimi,
   (e) tümleyen çiftinin hangi komutlarda tanımlı olduğu.
   SignalK'in `src/hooks/seatalk/*.ts` dosyalarıyla **ÇAPRAZLA** — her hook
   Knauf'un metnini gömüyor, sapma varsa alan ADLANDIRILMAZ.
2. **[DUR-SOR] İki kararı al** (ana brif açık soru 3 ve 4). Kararsız kod
   YAZILMAZ.
3. **`src/protocols/marine/seatalk/seatalk.ts`** — bağımsız motor, hiçbir
   paylaşılan çekirdek tüketmez (ana brif bulgu 5). Dosya başı ZORUNLU:
   - Komut bitinin neden çerçevede olmadığı, parity numarasının nasıl
     çalıştığı, `commandByteSource`un ne çözdüğü.
   - **CHECKSUM OLMADIĞI** ve bunun nasıl doğrulandığı (tam metin araması).
   - `$STALK`ın `*CS`inin neden SeaTalk'un checksum'ı OLMADIĞI.
   - Hangi komutların payload'ının çözüldüğü ve neden yalnız onların
     (çift kaynak kuralı).
   - `9C`/`84` heading formülünün birebir metni ve neden
     sadeleştirilemeyeceği.
   - `canParse`ın neden DAİMA `false` olduğu + **ölçülen 27 ve 7 sayısı**.
   - SeaTalkNG'nin NMEA 2000 olduğu ve PGN 126720 tüneli.
   - Kaynağın kendi güvenilirlik uyarısı (*"may even be wrong"*).
4. **Komut tablosu ayrı modülde** — `seatalkCommands.ts`.
   `nmeaSentences.ts`in `nmea0183.ts`ten ayrılma gerekçesi burada da geçerli
   (`nmea0183.ts:1-8`: *"Cümle çözümü BURADA YOKTUR… tek yerde yaşar"*).
   60 komut adı + 21'inin alan çözücüsü orada.
5. **Katalog** — `seatalk` `status` `'planned'` → `'partial'` (`:435`),
   `pluginId: 'seatalk'` eklenir. `summary` (`:432-433`) **çözülenle
   çözülmeyeni AÇIKÇA yazacak biçimde güncellenir**
   (`ads-b`/`cc-link-ie` emsali). `definitions: ['vendor-map']` KALIR,
   panel YAZILMAZ. `tabs`a dokunulmaz — `'build'` yok, `encoder` yazılmaz.
6. **Registry** — `registerOnce(registry, 'seatalk', …)`. 141 → 142.
7. **Çeviri** — `en.ts` + `tr.ts`. 60 komut adı **VERİDİR, çeviriye GİRMEZ**
   (CLAUDE.md: *"Protokol ve araç adları veridir"*). Çeviriye giren: alan
   etiketleri, uyarılar, seçenek adları/şıkları. `mode-s` 42 anahtar
   kullanmıştı; burada **~45-60** beklenir.
8. **Test** — `seatalk.test.ts`:
   - `3 + (attr & 0x0F)` formülü min (3B) ve max (18B) sınırlarında.
   - **Attribute'ın yüksek nibble'ının VERİ olduğu** ayrı testle.
   - `86 11 05 FA` — tümleyen çift PASS; bozulmuş hâli FAIL.
   - `01 05 00 00 00 60 01 00` — Equipment ID çözümü.
   - `9C`/`84` heading formülü Knauf'un örnek değerleriyle.
   - `84`ün autopilot mod bitleri (`Z&0x2`, `Z&0x4`, `Z&0x8`).
   - Çözülmeyen bir komut (ör. `A7`) → ad basılıyor, payload HAM,
     `commandPayloadNeedsVendorMap` uyarısı.
   - `strictLength: true`da kısa datagram → `success: false`.
   - Dört `decodeOptions` kanalının her biri için en az bir dal.
   - **`commandBitNotInBytes` uyarısının HER çözümde basıldığı.**
   `seatalkCommands.test.ts`: 60 komutun tablosu eksiksiz, id'ler benzersiz.
9. **Bekçi** — `seatalkCanParseRegistry.test.ts` (yukarıda, dört iddia).
10. **e2e** — `e2e/seatalk-decode.spec.ts`. Kanıtlanacak: sayfa **Kısmi**
    rozetiyle açılıyor · özet çözülmeyeni AÇIKÇA yazıyor · varsayılan örnek
    ilk render'da girdide · `86 11 05 FA` alanları görünüyor ve tümleyen çift
    PASS · `commandBitNotInBytes` uyarısı görünüyor · çözülmeyen bir komut
    seçilince payload ham + uyarı · konsola hata yok · 1440/390'da taşma yok.

---

## Devralınan tuzaklar

- **HİÇBİR paylaşılan çekirdek tüketilmez.** `nmeaChecksum.ts`, `hdlcCore.ts`,
  `canFrame.ts`, `bitCursor.ts` — hiçbiri. Paylaşım aramak `ccp.ts`in
  reddettiği şeydir.
- **Komut biti ÇERÇEVEDE YOK** — her çözümde koşulsuz uyarı.
- **CHECKSUM YOK** — bir checksum alanı UYDURULMAZ; `checksumFinder.ts`
  bir araçtır, bu motorun alanı değil.
- **`$STALK`ın `*CS`i SeaTalk'un DEĞİLDİR.**
- **Attribute'ın yüksek nibble'ı VERİDİR**, dolgu değil.
- **Heading formülü üç terimlidir**, sadeleştirilemez.
- **SeaTalkNG = NMEA 2000**, ayrı protokol değil; SeaTalk2 onun eski adı.
- **`canParse` DAİMA `false`** — ölçüldü (27 naif / 7 dar).
- **Derinlik varsayılan olarak FEET'tir** (`Y&4` metrik bayrağı ile değişir) —
  birim yanlış basılırsa 3.28 kat hata.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
  Nibble alanları için kapsayan bayt, bit ayrıntısı alan ADINDA
  (`Attribute · Additional Byte Count (bit 0:3)`).
- **`ParsedField.id` KENDİ offset'ini kullanır.**
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings`
  `ProtocolWarning[]`.
- **`ParsedFrame` DÜZ, `children` YOK.**
- **`unit` yalnız gerçek fiziksel değere** — ham nibble, `U`, `VW`, komut
  baytı BİRİMSİZ.
- **`'build'` sekmesi YOK → `encoder` YAZILMAZ.**
- **`definitions` paneli YAZILMAZ** (`snmp.ts:46` emsali).
- **Komut adları VERİDİR, çeviriye girmez.**
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **16a'nın Görev 0'ı bitmiş olmalı** — `ProtocolPage.test.tsx` bu kayda
  bağlıydı.
- **`CrcCalculatorTool.test.tsx`e DOKUNMA** — bu dalga CRC eklemiyor.

---

## Model/effort önerisi

**Opus · high.**

**Model = Opus:** yol belli değil, seçenekleri tartıp birini seçmek gerekiyor.
Üç ayrı muhakeme noktası var ve hiçbiri mekanik değil:
1. **Rozet kararı** (`partial` vs `ready`) — zarf tam çözülüyor ama
   doğrulanamayan bir varsayıma dayanıyor.
2. **Adlandırma kapsamı** — 60 / 23 / 21 arasında seçim, ve gerekçe "kaynağın
   kendisi güvenilmez olabileceğini söylüyor" gibi nitel bir yargı.
3. **Komut bitinin çerçevede olmaması** görünmez bir değişmezdir: motor
   yeşil test verirken çok-datagramlı girdide sessizce yanlış sınır çizebilir.

Ayrıca `9C`/`84` heading formülü, sadeleştirme cazibesi yüksek ve
sadeleştirilirse **hata VERMEDEN yanlış açı** üretiyor — `arinc-429`in bit
sırası tuzağıyla (15f) aynı sınıf.

**Effort = high (`xhigh` DEĞİL):** seçenekler var ama her biri tek adımda
değerlendirilebilir ve geri dönüşü pahalı bir şema/sözleşme kararı yok —
`protocol-core/types.ts`e dokunulmuyor, katalog sayısı değişmiyor, yeni bir
paylaşılan çekirdek doğmuyor. `xhigh` bir ödünleşim olduğunda gerekir;
burada ödünleşim değil, kanıt seviyesine göre kapsam seçimi var.

**Tamamlanma ölçütü:** `legacy-proprietary-marine` ailesinde `planned` kayıt
KALMIYOR; `seatalk` **Kısmi** rozetiyle açılıyor ve özet neyin çözülüp
neyin çözülmediğini AÇIKÇA yazıyor; `commandBitNotInBytes` uyarısı HER
çözümde basılıyor ve e2e'de görünüyor; `86 11 05 FA`nın tümleyen çifti PASS
ve bozulmuş hâli FAIL; `9C`/`84` heading formülü Knauf'un örnek değerleriyle
testli; çözülmeyen komutlar ad basıp payload'ı HAM bırakıyor;
`seatalkCanParseRegistry.test.ts` yeşil, **kendi örneklerinde de `false`**
kanıtlıyor ve naif imzanın çakışma sayısını `> 0` olarak bekçiliyor;
**`crcCatalogue.ts` DEĞİŞMEDİ**; birim + e2e + build yeşil.

**KAYIT KAYIT bitir:** kaynak turu → iki DUR-SOR kararı → `seatalkCommands.ts`
→ `seatalk.ts` → çeviri → test → bekçi → e2e.
