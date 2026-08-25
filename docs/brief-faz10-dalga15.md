# Faz 10, dalga 15 — Aerospace & UAV (keşif, 2026-08-25)

Bu dosya **keşif** çıktısıdır: kod yazılmadı, brif üretildi. Her alt dalganın
uygulama brifi ayrı dosyada (`brief-faz10-dalga15a.md` … `brief-faz10-dalga15h.md`);
kod yazacak model ÖNCE bu dosyayı, SONRA kendi alt dalga brifini okur.

Yazım kuralı (dalga 12/13/14'ten devralındı): **tahmin ile kanıt ayrılır.**
Aşağıda `[KANIT]` etiketli her cümle dosya:satır ile gösterilmiştir; `[BEKLENTİ]`
etiketli her cümle sınanmamış bir öngörüdür ve alt dalga onu çürütebilir.

---

## Kapsam

`aerospace-uav` domain'i: **6 aile / 16 protokol** (`aerospace-uav.ts:12-578`).

Ham `status` dağılımı: **15 `planned` + 1 `partial`**. Ama ham sayı yanıltıcı —
`gnss-navigation` ailesinin **üç kaydı da ALIAS'tır** ve yönü DIŞARI bakar:

| Alias kayıt | `aliasOf` | Kanonik ikizin durumu |
|---|---|---|
| `gps-ubx` (`:507`, `aliasOf` `:531`) | `marine-navigation/gnss-corrections/gnss-ubx` | `ready` (`marine-navigation.ts:258`) |
| `rtcm` (`:534`, `aliasOf` `:552`) | `marine-navigation/gnss-corrections/rtcm` | `ready` (`marine-navigation.ts:296`) |
| `nmea` (`:555`, `aliasOf` `:572`) | `marine-navigation/nmea-family/nmea-0183` | `ready` (`marine-navigation.ts:40`) |

`resolveStatus()` bunları çözer, rozet `ready` basar. **15 ham `planned` − 3 alias
= 12 gerçek iş**, CLAUDE.md'nin borç sayımıyla birebir ("aerospace-uav 12").
`gnss-navigation` ailesi bu dalgada HİÇ dokunulmaz — zaten kapalı.

Domain'de ayrıca **bir `partial` kayıt** var: `mavlink` (`:37`). Bu dalganın
kapsamında DEĞİL, ama dosya başı bu dalganın en önemli iki kısıtını yazılı olarak
taşıyor (bkz. bulgu 6 ve 9).

Spec kaynağı: `docs/spec/ozet/06-havacilik-uav.md` (546 satır).

### Aile aile döküm

| Aile | `ready`/`partial`/alias | `planned` (bu dalga) |
|---|---|---|
| uav-telemetry (`:20`) | mavlink (`partial`) | — (aile bitti) |
| distributed-uav-networks (`:83`) | — | **dronecan, cyphal, uavcan-compatibility** |
| rc-control-links (`:192`) | — | **sbus, ibus, crsf, ppm, pwm-servo** |
| avionics-data-buses (`:359`) | — | **arinc-429, mil-std-1553** |
| surveillance (`:443`) | — | **ads-b, mode-s** |
| gnss-navigation (`:499`) | gps-ubx, rtcm, nmea (alias→ready) | — (aile bitti) |

Dalga kapanırsa deponun kanonik borcu **20 → 8** iner (wireless-iot 4,
marine-navigation 3, building-automation 1).

---

## Zaten var olan motorlar — neyin YENİDEN YAZILMAYACAĞI

Dalga 14'ün bıraktığı makinenin her parçası KODDA sınandı. Sonuç: **dört hipotezden
üçü doğrulandı, biri ÇÜRÜDÜ.** Aşağıda kanıtıyla.

### ✅ `canFrame.ts` taşıyıcı paylaşımı — ALTI tüketiciyle kanıtlı, biri CROSS-DOMAIN

`src/protocols/automotive/can/canFrame.ts` (SocketCAN 16 baytlık yakalama konteyneri).
Tüketiciler `[KANIT]` (`grep -rl 'can/canFrame' src/protocols/`):

```
automotive/isotp/isotp.ts        automotive/j1939/j1939.ts
automotive/ccp/ccp.ts            automotive/xcp/xcpOnCan.ts
industrial/canopen/canopen.ts    industrial/devicenet/devicenet.ts
marine/nmea2000/nmea2000.ts   ← CROSS-DOMAIN, automotive DIŞINDA
```

Dalga 14 brifi "beş kez kanıtlı" diyordu; bugün **altı** ve `nmea2000.ts` paylaşımın
domain sınırını zaten geçtiğini gösteriyor. `dronecan` ve `cyphal` için ayrı bir CAN
okuyucu YAZILMAZ; ilgili semboller (`decodeSocketCanFrame`, `CanIdentity`,
`decodeCanId`, `CAN_CLASSIC_FRAME_LENGTH`, `CAN_HEADER_LENGTH`, `formatHex`)
`canFrame.ts`ten alınır.

**CAN FD kapsam sorusu GERÇEK ve bu dalgada karara bağlanacak** `[KANIT]`:
`CAN_FD_FRAME_LENGTH = 72` (`canFrame.ts:66`) var ve `canFd.ts` tam bir FD parser'ı
taşıyor; ama `xcpOnCan.ts:31` FD'yi AÇIKÇA reddediyor
(*"`CAN_FD_FRAME_LENGTH` (72 bayt) ise bu AÇIKÇA 'CAN FD desteklenmiyor'"*,
uygulaması `xcpOnCan.ts:169`). `dronecan` FD kullanmaz (v0 yalnız CAN 2.0B,
spec `:117`); **`cyphal` kullanabilir** → bulgu 3.

### ✅ `pulseLog.ts` nabız konteyneri — `ppm` ve `pwm-servo` için BİREBİR

`src/protocol-core/decoding/pulseLog.ts`. Sözleşme (dosya başı `:44-56`) `[KANIT]`:
nabız başına 2 bayt `Uint16LE`, birim **0.1 µs**, üst sınır 6553.5 µs
(`MAX_PULSE_DURATION_US`, `:83`), girdi uzunluğu **ÇİFT** olmalı, değer **0 REZERVE**
(`RESERVED_REGISTER_VALUE`, `:81`).

Katalog bu iki kaydın girdisinin nabız olduğunu ZATEN söylüyor `[KANIT]`:
`ppm` `layer: 'physical'` (`aerospace-uav.ts:316`) ve summary'si *"decoded from
capture edges rather than from bytes"* (`:315`); `pwm-servo` `layer: 'physical'`
(`:339`). Spec de öyle: *"Pulse capture edge'lerinden (örn. 0µs, 1502µs, 3001µs...)
channel süreleri hesaplanır"* (`06-havacilik-uav.md:254`).

**Konteynerin kendisi yeter, J1850'ye özel yardımcılar GEREKMEZ** `[KANIT]`:
`j1850Pulse.ts:64` `isShortPulse` J1850'nin **ikili** kısa/uzun ayrımı içindir;
PPM'in kanal süresi 1000–2000 µs arası **sürekli** bir değerdir, ikili değil — SENT
nibble'ının aynı gerekçesiyle (`pulseLog.ts:18-20`) bu fonksiyon KULLANILMAZ.
`deriveAlternatingLevels` (`j1850Pulse.ts:83`) yalnız VPW'nin aktif/pasif hat modeli
içindir; PPM/PWM tek yönlü darbe trenidir. `packBitsToBytes` da gereksiz — PPM/PWM'de
CRC yok, bayta paketlenecek bit akışı yok.

**Sonuç: `ppm`/`pwm-servo` yalnız `@/protocol-core/decoding/pulseLog`ten import eder,
`protocols/automotive/j1850/`ye HİÇ dokunmaz.** (14g'nin taşıma kararı tam bunun
için verilmişti.)

### ✅ `bitCursor.ts` — bu dalganın EN ÇOK tüketilen motoru

`src/protocol-core/decoding/bitCursor.ts`: `readBits` (`:48`), `readBitsAsNumber`
(`:85`, 53 bit üstünde ATAR), `toSignedBits` (`:100`), `BitOrder` (`:26`),
varsayılan `msb-first` (`:37`).

**Yedi kayıt bunu ister** `[BEKLENTİ→alt dalgada kanıtlanacak]`:

| Kayıt | Bit alanı | Gerekli `BitOrder` |
|---|---|---|
| `dronecan` | 29-bit CAN ID → 5+16+1+7 | `msb-first` |
| `cyphal` | 29-bit CAN ID (v1 düzeni) | `msb-first` |
| `sbus` | 16 × 11 bit paketli kanal | **`lsb-first`** (bulgu 5) |
| `crsf` | 16 × 11 bit paketli kanal | **`lsb-first`** (bulgu 5) |
| `arinc-429` | 32-bit word → 8+2+19+2+1 | tuzaklı (bulgu 7) |
| `mil-std-1553` | 16-bit word alt alanları | `msb-first` |
| `mode-s` | 5+3+24+56+24 bit | `msb-first` |

### ❌ ÇÜRÜDÜ: `crcBits()` bu domain'de HİÇ tüketici bulamıyor

Görev tanımı *"`mil-std-1553`ün 20 bitlik sözcüğü, `arinc-429`un 32 bit + parite
yapısı `crcBits`i ister mi?"* diye soruyordu. **Cevap: HAYIR, ikisinin de CRC'si
YOK.** `[KANIT]`

- **MIL-STD-1553'te CRC yoktur** — sözcük 3 bit sync + 16 bit yük + **1 bit tek
  parite**tir (Wikipedia MIL-STD-1553 "Bus protocol": *"each word could be considered
  as a 20 bit word: 3 bit for sync, 16 bit for payload and 1 bit for odd parity
  control"*). Spec özeti de yalnız "Parity" diyor (`06-havacilik-uav.md:317-319`),
  CRC demiyor.
- **ARINC 429'da da CRC yoktur** — bit 32 tek paritedir
  (`06-havacilik-uav.md:302`: *"Word parity kontrolü yapılır (Odd/Valid → PASS)"*).
- **Mode S'in CRC-24'ü bayt hizalıdır**: mesaj 56 veya 112 bit = 7 veya 14 tam bayt
  (mode-s.org, "Mode S format" tablosu). `crc()` yeter.
- Kalan CRC'li kayıtların hepsi bayt hizalı: DroneCAN transfer CRC (bayt dizisi),
  CRSF CRC-8 (bayt dizisi), IBUS checksum (16-bit toplam).

**Bu dalgada `crcBits()` ÇAĞRILMAZ.** 14e'nin eklemesi bu domain'e düşmedi —
dürüstlük gereği yazılıyor, `crcBits`i "kullanmış olmak için" zorlamak sessiz
yanlış çözümün kapısıdır.

### ✅ `canParse` registry bekçisi — bu dalganın EN YÜKSEK risk sınıfı

Üç emsal `[KANIT]`: `j1850CanParseRegistry.test.ts`, `sentSpcCanParseRegistry.test.ts`,
`psi5CanParseRegistry.test.ts` (`src/protocols/automotive/*/`).

14f'in ÖLÇTÜĞÜ rakam bu dalgaya birebir taşınır (`pulseLog.ts:63-68`): naif bir
`data.length % 2 === 0` kontrolü *"registry'nin 761 örnek çerçevesinin 413'ünü (%54)
yanlış pozitif kabul ediyordu."*

Bu dalgada çarpışmaya en açık üçlü:
- **`sbus`**: sabit 25 bayt, ilk bayt `0x0F`, **checksum YOK** — doğrulanacak tek şey
  uzunluk + iki uç bayt. Registry'de 25 baytlık ve `0x0F` ile başlayan her çerçeve
  aday olur.
- **`ibus`**: 32 bayt (iA6B) veya 31 bayt/`0x55` (iA6). Checksum VAR → `canParse`
  checksum'ı doğrulamalı, yalnız uzunluğa bakmamalı.
- **`crsf`**: `0xC8` sync + uzunluk alanı + CRC-8. Üçü birden bakılmalı.
- **`ppm`/`pwm-servo`**: nabız konteyneri **her** çift uzunluklu bayt dizisine uyar.
  14f'in dersinin doğrudan mirasçısı.

**Her alt dalga brifi bu bekçi testini görev listesine ALIYOR.** İstisnasız.

### ✅ `crcCatalogue.ts` — ne var, ne yok

26 giriş `[KANIT]` (`grep -cE '^  [A-Z][A-Z0-9_]+:' crcCatalogue.ts` = 26):

```
CRC4_ITU CRC5_USB CRC6_ITU CRC7_MMC CRC8 CRC8_SAE_J1850 CRC8_AUTOSAR CRC8_MAXIM
CRC8_BACNET_MSTP CRC11_FLEXRAY CRC16_ARC CRC16_MODBUS CRC16_CCITT_FALSE
CRC16_XMODEM CRC16_X25 CRC16_DNP CRC16_EN13757 CRC16_KERMIT CRC16_USB CRC24
CRC24_Q CRC24_FLEXRAY_A CRC24_FLEXRAY_B CRC32 CRC32C CRC64
```

`CrcCalculatorTool.test.tsx:77` bu sayıyı **34**'e sabitliyor (26 katalog + 7 basit
toplam + 1 özel; testin kendi yorumu `:71-76`). **Dosya yolu `src/features/calculators/
tools/CrcCalculatorTool.test.tsx`** — dalga 14 brifleri `src/app/components/tools/`
diyordu, yol DEĞİŞMİŞ/YANLIŞMIŞ, düzeltildi.

**Bu dalgada eklenen her CRC bu sayıyı bir artırır ve testi kırar.** Beklenen: iki
ekleme → 34 → **36**.

---

## Mimari bulgular

### 1) DroneCAN'in transfer CRC'si ZATEN KATALOGDA — sıfır ekleme `[KANIT]`

Resmî DroneCAN/UAVCAN v0 CAN taşıma spec'i (legacy.uavcan.org/Specification/
4._CAN_bus_transport_layer, "Transfer CRC") algoritmayı adıyla ve parametresiyle
veriyor:

> Name: CRC-16-CCITT-FALSE · Initial value: 0xFFFF · Poly: 0x1021 · Reverse: no

Depodaki `CRC16_CCITT_FALSE` (`crcCatalogue.ts:143` civarı) `[KANIT]`:
`width: 16, poly: 0x1021n, init: 0xffffn, refin: false, refout: false, xorout: 0x0000n`.

**Birebir aynı. `dronecan` için katalog eklemesi YOK.** Bu, dalganın en ucuz
bulgusudur ve 15a'yı en başa koymanın gerekçesidir.

Aynı spec CAN ID düzenini de **bit genişliğiyle** veriyor (dolayısıyla "exact bit
width'ler resmi spec'te" diyen spec özeti `:126`in bıraktığı boşluk kapanıyor):

| Transfer | Alanlar (yüksekten alçağa) |
|---|---|
| Message broadcast | Priority(5) · Message type ID(16) · Service-not-message(1)=0 · Source node ID(7) |
| Anonymous message | Priority(5) · Discriminator(14) · Msg type ID alt bitleri(2) · SNM(1)=0 · Source node ID(7)=0 |
| Service | Priority(5) · Service type ID(8) · Request-not-response(1) · Destination node ID(7) · SNM(1)=1 · Source node ID(7) |

Tail byte (`data[len-1]`, MSB'den): SOT(1) · EOT(1) · Toggle(1) · Transfer ID(5) —
spec özeti `:134-139` ile birebir örtüşüyor. **İki bağımsız kaynak örtüştü.**

### 2) `mode-s` ↔ `ads-b` GERÇEK paylaşımdır — ADS-B, DF17'nin ME alanıdır `[KANIT]`

Katalog bunu zaten yazmış: `mode-s` summary'si *"whose DF17 extended squitter is what
ADS-B 1090ES rides on"* (`aerospace-uav.ts:477`), tool listesinde *"DF17 → ADS-B
Handoff"* (`:489`). Spec de: *"ADS-B 1090ES → Mode S Extended Squitter'ı kullanır"*
(`06-havacilik-uav.md:361`).

Dış kaynak çerçeveyi bit bit veriyor (mode-s.org, "ADS-B Basics / Message structure"):

```
+----------+----------+-------------+------------------------+-----------+
|  DF (5)  |  CA (3)  |  ICAO (24)  |         ME (56)        |  PI (24)  |
+----------+----------+-------------+------------------------+-----------+
   bit 1-5    6-8         9-32            33-88 (TC=33-37)      89-112
```

**Bu, `xcpPacket.ts`/`dnsWire.ts` sınıfı bir paylaşımdır**, `ccp.ts`in "birleştirme"
tuzağı değil: Mode S çerçeve ayrıştırması (DF, uzunluk, ICAO, parite) ile ADS-B ME
yorumu (Type Code → identification/position/velocity) **iki ayrı katmandır ve
aralarındaki sınır spec tarafından çizilmiştir**. 15h ikisini tek alt dalgada
yapar, ama **iki ayrı modülde**.

### 3) Cyphal'ın CAN FD'si bir KAPSAM KARARIDIR — `xcpOnCan` emsali ters yönde `[BEKLENTİ]`

`cyphal` katalog kaydı transport-agnostic (`layer: 'multi-layer'`, `:132`; tools
`Cyphal/CAN`, `Cyphal/UDP`, `Cyphal/Serial`, `:151-153`). Spec: *"Cyphal CAN'e bağlı
değildir; resmi ekosistem Cyphal/CAN, Cyphal/UDP, Cyphal/serial destekler"*
(`06-havacilik-uav.md:164`).

Depoda `xcpOnCan.ts:31` CAN FD'yi AÇIKÇA reddediyor ve bunu bir KARAR olarak yazıyor.
`cyphal` için aynı kararı vermek mümkün ama **gerekçesi farklı olmak zorunda**: XCP
FD'siz de tam bir protokoldür, Cyphal/CAN FD ise resmî ekosistemin parçasıdır.

**Öneri: Cyphal/CAN (classic) kapsamda, CAN FD + UDP + Serial taşıyıcıları kapsam
DIŞI, kayıt `partial`.** Emsal: `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only,
`foundation-fieldbus` HSE-only. **DUR-SOR** (açık soru 2).

### 4) `uavcan-compatibility` `automotive-ethernet` DEĞİLDİR — `decode` sekmesi VAR `[KANIT]`

Görev tanımı bu kaydın 14a'daki "hiç parser almadan LoRa paterniyle kapanma" emsaline
oturabileceğini söylüyordu. **Kodla sınandı: OTURMUYOR.**

`aerospace-uav.ts:176`: `tabs: ['overview', 'decode', 'diagnostics', 'examples']` —
**`decode` sekmesi AÇIK.** Tool listesi (`:177-183`) `Auto-Detection Candidates` ve
`Protocol Selector Guard` içeriyor. Katalog yorumu (`:166-169`) kaydın ne olduğunu
tarif ediyor: *"Bağımsız bir wire protokolü değil… Belirsiz `Protocol: UAVCAN`
seçimi kabul edilmez."*

Karşılaştır: `automotive-ethernet` 14a'da parser almadan kapandı ve `decode`
sekmesi katalogdan DÜŞÜRÜLDÜ (14a brifi, "yanlış vaat yok"). Burada sekme duruyor
ve vaat ettiği şey **bir sınıflandırıcı**: ham 29-bit CAN çerçevesi → "DroneCAN
adayı" / "Cyphal adayı" / "belirsiz".

**Bu yapılabilir bir iştir ve GERÇEK paylaşımdır**: sınıflandırıcı 15a'nın DroneCAN
CAN-ID çözücüsünü ve 15b'nin Cyphal çözücüsünü TÜKETİR, kendi tel biçimini
tanımlamaz. Ama bir kaydın parser alıp almayacağı ve rozetinin ne olacağı
**DUR-SOR**tur (açık soru 3).

### 5) SBUS ve CRSF AYNI 11-bit paketlemeyi kullanır — ve sıra `lsb-first`tir `[KANIT]`

Bu dalganın **en yüksek sessiz-yanlış-değer riski**.

İki bağımsız kaynak aynı yapıyı gösteriyor:

- Betaflight `rx/sbus_channels.h:31-47`: `// 176 bits of data (11 bits per channel *
  16 channels) = 22 bytes.` ardından `unsigned int chan0 : 11; … chan15 : 11;`
- TBS resmî CRSF spec'i (`tbs-crsf-spec/crsf.md:517-531`, "0x16 RC Channels Packed
  Payload"): *"16 channels packed into 22 bytes"*, `int channel_01: 11; …`
- Betaflight `rx/crsf.c:113-131`: aynı struct, `__attribute__((__packed__))`.

**C bitfield'ları little-endian hedefte LSB-first paketlenir**: `chan0` ilk baytın
EN DÜŞÜK 8 biti + ikinci baytın alt 3 biti. Yani `bitCursor`ın varsayılanı
(`msb-first`, `bitCursor.ts:37`) **YANLIŞTIR** ve `lsb-first` seçilmelidir.

Spec özeti tuzağın varlığını uyarıyor ama YÖNÜNÜ vermiyor (`:197`: *"`CH1 =
Byte1+Byte2` gibi yanlış (byte-aligned) decode yapılmamalıdır; bitstream üzerinden
11-bit kaydırmalı okuma gerekir"*). Yön yalnız kaynak koddan geliyor.

`bitCursor.ts:22` bu riski kendi yazıyor: *"Sıra yanlış seçilirse hata OLUŞMAZ,
yalnız değer yanlış çıkar."* 12e'nin OID vakasının (küçük değerlerde doğru, büyükte
patlar) aynı sınıfı.

**Paylaşım GERÇEK ama SINIRLI — ve sınır tam olarak 14g'nin çizdiği yerde:**

| Paylaşılır | Paylaşılmaz |
|---|---|
| 22 bayttan 16 × 11 bit `lsb-first` okuma | Değerin ANLAMI |
| | SBUS: 173…1812 aralığı (`sbus.c:85-86`) |
| | CRSF: merkez 992, `TICKS_TO_US(x)=(x-992)*5/8+1500` (`crsf.md:522-526`) |

Aynı bitler, farklı ölçek. `pulseLog.ts`in "konteyner TAŞINDI, TÜRETİM TAŞINMADI"
kuralı birebir. **Ortak yardımcı 15c'de doğar, 15d onu tüketir.**

### 6) MIL-STD-1553'ün SÖZCÜK TİPİ ÇERÇEVEDE YOKTUR — dalganın en büyük kararı `[KANIT]`

MIL-STD-1553 sözcüğü 20 bittir ama **ilk 3 bit senkron darbesidir ve Manchester
kodunda oluşamayan bir ihlal desenidir** (Wikipedia MIL-STD-1553: *"1.5 μs low plus
1.5 μs high for data words and the opposite for command and status words, which
cannot occur in the Manchester code"*).

Yani sözcüğün **Command / Status / Data** olduğu bilgisi **yalnız senkron deseninde**
taşınır. Ve toolkit'in girdisi Manchester dalgası DEĞİL — spec bunu açıkça yazıyor
(`06-havacilik-uav.md:311`): *"Toolkit ilk aşamada analog Manchester waveform
acquisition zorunda değildir; girdiler: bus analyzer log, CSV, TXT, vendor adapter
export, raw decoded word list."*

**Sonuç: 16 bitlik yükten sözcük tipi ÇIKARILAMAZ.** Command Word ve Status Word'ün
ikisi de üst 5 bitte RT Address taşır; ayrımları senkrondadır. Bir parser bunu
tahmin ederse **her çerçevede sessizce yanlış alan adı basar**.

Depoda bunun çözülmüş emsali VAR `[KANIT]`: 13h'te IO-Link'in aynı problemi
`messageSide` adlı bir `decodeOptions` alanıyla çözüldü — *"alan YERLEŞİMİNİ
değiştiren seçenek"* (CLAUDE.md "Bilinen borçlar"). Öncesinde `ccLink.ts`/`iec101.ts`
aynı deseni kullanmıştı.

**Öneri: `wordType` adlı zorunlu bir `decodeOptions` `select` alanı**
(`command` | `status` | `data`), varsayılan YOK ya da `data`. Seçilmediğinde alan
ADLANDIRILMAZ, 16 bit ham + uyarı. Bu, `microwire.ts`in gerekçesinin birebir
tekrarıdır (*"aynı dört bayt, x8 profiliyle READ 0x2A, x16 profiliyle bambaşka bir
şey"*). Ayrıntı 15g brifinde.

### 7) ARINC 429'un bit numaralandırması tersine yazılır — ve Label alanı ayrıca terstir `[KANIT + UYARI]`

Wikipedia ARINC 429, "Bit numbering, transmission order, and bit significance":

> ARINC 429 word transmission begins with Bit 1 and ends with Bit 32… it is common to
> diagram and describe ARINC 429 words in the order from Bit 32 to Bit 1.

Yani **her diyagram tersine okunur**: Bit 1-8 Label, 9-10 SDI, 11-29 Data,
30-31 SSM, 32 Parity — ama tablolarda soldan sağa 32→1 dizilir. Bir motorun bunu
`msb-first` sanıp doğrudan `readBits(bytes, 0, 8)` demesi **Label'i tersten okur**.

Ek olarak: ARINC 429'un oktal Label'i, telin ilk sekiz bitinin **ters sırada**
okunmasıyla elde edilir — bu, ARINC dünyasının en bilinen tuzağıdır ve
**bağımsız ikinci kaynakla doğrulanmadan uygulanmamalıdır** (15f brifinin ilk
görevi). `[BEKLENTİ]`

Depo bunu zaten bir kez yaşadı: 12e'nin OID vakası (`ftp.ts`/`rtcp.ts` sınıfı),
14e'nin `BitOrder` kararı. **`bitReverse` hesaplayıcısı registry'de VAR**
(`features/calculators/registry.ts:37`, `id: 'bit-reverse'`) — ama motor kodu kendi
dönüşümünü `bitCursor` üzerinden yapar, hesaplayıcıyı çağırmaz.

### 8) `arinc-429`/`mil-std-1553` için PHY kaydı YOK — `flexray-phy` emsali burada ÇALIŞMIYOR `[KANIT]`

14e'de `flexray` ile `interfaces-framing/vehicle-field-physical-layers/flexray-phy`
arasında çift yönlü bağlantı kurulmuştu. Bu dalgada karşılığı aranırsa **bulunmaz**:

`interfaces-framing.ts:677-756` — `vehicle-field-physical-layers` ailesinin TAMAMI
üç kayıttır: `can-phy` (`:683`), `lin-phy` (`:715`), `flexray-phy` (`:735`).
**ARINC 429 PHY, MIL-STD-1553 PHY, 1090 MHz PHY kaydı YOKTUR.**

Ayrıca `protocol-core`da **Manchester çözücü yoktur** `[KANIT]`: `grep -rli manchester
src/` yalnız "Manchester'a girmez" kararı yazan dosyaları buluyor (`dali.ts`,
`psi5.ts:6-13`, `wirelessMbus.ts`, `asInterface.ts`, `profibusDp.ts`,
`foundationFieldbus.ts`).

**Sonuç: bu iki kayıt çapraz bağlantı ALMAZ, yeni PHY kaydı da AÇILMAZ** (yeni
katalog kaydı açmak bu dalganın kapsamı dışında). `related` yalnız birbirlerine
bakar (`:402`, `:438`) — mevcut hâli doğrudur.

### 9) `definitions: ['dsdl']` ve `['vendor-map','custom-schema']` PANELSİZ kapanır — emsal ZATEN var `[KANIT]`

Dört kayıt tanım dosyası biçimi bildiriyor: `dronecan` ve `cyphal` `['dsdl']`
(`:121`, `:159`); `arinc-429` ve `mil-std-1553` `['vendor-map','custom-schema']`
(`:401`, `:437`).

`DEFINITION_FORMATS` bunların hepsini zaten tanıyor (`app/catalog/types.ts:45-58`)
ve `ProtocolPage.tsx:62` `dsdl` anahtarını taşıyor. **Ama kanal BOŞ kalabilir** —
bu, depoda dört kez uygulanmış bir emsal:

- `snmp.ts:46`: *"Katalog `definitions: ['custom-schema']` işaretli ama kanal boş."*
- `bleGatt.ts:34`: *"`definitions: ['custom-schema']` — bu dalganın kapsamı DIŞINDA."*
- `a2l`/`ldf` 14'te panelsiz kapandı (dalga 14 bulgu 8).

**DSDL derleyicisi, ICD veritabanı ve ARINC Label sözlüğü bu dalganın kapsamı
DIŞINDADIR.** Payload ham + uyarı. Gerekçe `mavlink.ts` dosya başında hazır ve
birebir uygulanır: *"payload'a sabit offset'le alan adı YAKIŞTIRILMAZ; ham bayt +
uyarı."*

### 10) Çerçeveler arası durum PARSER'A GİRMEZ — üç kayıt bunu ister, üçü de reddedilir `[KANIT]`

`mavlink.ts` dosya başı: *"SEQ-LOSS HESABI PARSER'A GİRMEZ… ÇERÇEVELER ARASI durum"*.
Bu kural bu dalgada üç yerde geçerlidir:

| Kayıt | Katalog/spec'in istediği | Neden parser'a girmez |
|---|---|---|
| `ads-b` | "Aircraft Table", "Message Age" (`:457,465`) | Çok çerçeveli hedef takibi |
| `ads-b` | **CPR global pozisyon** (`:464`) | **Even+Odd çerçeve ÇİFTİ gerekir** |
| `mode-s` | "CRC Correction Candidates" (`:488`) | Tek çerçeveli, ama güven seviyesi ayrı |
| `dronecan` | "Multi-Frame Reassembly" (`:112`) | Çok çerçeveli transfer |
| tüm RC | "RC Failsafe Analyzer" state machine (`spec:409`) | Çerçeveler arası durum |

CPR özellikle dikkat ister: tek çerçeveden **CPR Format (Even/Odd) + ham
Latitude/Longitude** çıkar ve gösterilir (spec `:376` bunu açıkça istiyor), ama
**global enlem/boylam HESAPLANMAZ**. Hesaplanırsa tek çerçeveden üretilemeyen bir
sayı üretilmiş olur — `mavlink.ts`in reddettiği şeyin aynısı.

---

## Kaynak durumu — kayıt kayıt

Dalga 13 mimari bulgu 1'in kuralı bu turda **12 kaydın hepsine uygulandı**: gerçekten
arandı, bulunanlar aşağıda adlandırıldı.

| Kayıt | Kaynak | Nitelik | Beklenen rozet |
|---|---|---|---|
| `dronecan` | legacy.uavcan.org/dronecan.github.io Bölüm 4 (CAN transport) — bit genişlikleri, tail byte, transfer CRC **parametreleriyle** | **MÜKEMMEL** | `ready` |
| `cyphal` | opencyphal.org Cyphal Specification v1.0 (PDF, Mayıs 2025 stable) + `OpenCyphal/public_regulated_data_types` | **İYİ** (PDF; HTML sürümü ve pycyphal kaynak kodu çaprazlama için) | **`partial`** (Cyphal/CAN classic-only) |
| `uavcan-compatibility` | Kendi tel biçimi YOK; 15a+15b'nin çözücüleri + spec `:180-182` | Yapı gereği türev | **`partial`** |
| `sbus` | Betaflight `rx/sbus.c` + `rx/sbus_channels.h` (sabitler, bitfield, bayrak bitleri) | **İYİ** (vendor spec yok, referans uygulama var) | `ready` |
| `ibus` | Betaflight `rx/ibus.c` (iA6 ve iA6B iki model, iki ayrı checksum tohumu) | **İYİ** (klasik i-BUS); **i-BUS2 için kaynak YOK** | **`partial`** (i-BUS2 kapsam dışı) |
| `crsf` | TBS resmî `tbs-crsf-spec/crsf.md` (çerçeve tipleri, 0x16 payload, CRC) + Betaflight `rx/crsf.c`, `common/crc.h` | **MÜKEMMEL** (iki bağımsız kaynak örtüşüyor) | `ready` |
| `ppm` | Standart YOK; spec `:252-266` kavramsal + kalibrasyon örneği | **YETERLİ** (girdi zaten kullanıcı kalibrasyonu) | `ready` |
| `pwm-servo` | Standart YOK; spec `:270-284` formüller + örnek | **YETERLİ** | `ready` |
| `arinc-429` | **ARINC 429 spec ÜCRETLİ** (SAE ITC / aviation-ia.sae-itc.com). Word formatı Wikipedia + üretici uygulama notlarında (Holt — spec'in KENDİ referansı, `06-havacilik-uav.md:290`) | **ORTA** (format açık, Label sözlüğü ICD'ye bağlı) | `ready` (alan yapısı) — Label ANLAMI ham |
| `mil-std-1553` | MIL-STD-1553B kamuya açık ABD askerî standardı (DLA ASSIST'te aktif, spec `:311`); sözcük yapısı yaygın belgeli | **İYİ** | `ready` **eğer** `wordType` seçeneği kabul edilirse; aksi hâlde `partial` |
| `ads-b` | mode-s.org ("The 1090 Megahertz Riddle", Junzi Sun) + `pyModeS` + ICAO Doc 9871 (spec `:355`) | **MÜKEMMEL** | **`partial`** (1090ES-only, UAT kapsam dışı) |
| `mode-s` | mode-s.org DF tablosu + `dump1090` checksum tablosu (polinom doğrudan okunuyor) | **MÜKEMMEL** | `ready` |

**Kaynaksız kayıt politikası (2026-08-23 kullanıcı kararı) kurulu ve UYGULANIR:**
`planned` bırakılmaz, `partial` yazılır, teyitli olan çözülür, gerisi ham + uyarı,
özet AÇIKÇA yazar. **Bu SORULMAZ.** Ama bir kaydın `ready` yerine `partial`
kapanacağı otonomi anlaşmasında DUR-SOR olduğu için, yukarıda `partial` beklenen
**dört kayıt** açık sorularda ayrıca işaretlendi.

### Katalog eklemeleri — iki yeni CRC, ikisi de "sahte dost" vakası

**1. Mode S CRC-24 — katalogdaki HİÇBİR CRC24 ile aynı DEĞİL.** `[KANIT]`

`dump1090.c:683-695`'teki `modes_checksum_table`ın son sıfır olmayan girdisi
**`0xfff409`**tur; bu, tabloyu üreten generator polinomudur (Mode S üreteci
`0x1FFF409`, 24 bitlik gösterimi `0xFFF409`). Aynı dosya `:718`: `return crc &
0x00FFFFFF;` — init 0, yansıtma yok, xorout yok.

Katalogdakilerle karşılaştırma:

| Giriş | poly | init | Aynı mı? |
|---|---|---|---|
| `CRC24` (OpenPGP) `crcCatalogue.ts:239` | `0x864cfb` | `0xb704ce` | **HAYIR** |
| `CRC24_Q` `:258` | `0x864cfb` | `0x000000` | **HAYIR** |
| `CRC24_FLEXRAY_A` `:285` | `0x5d6dcb` | `0xfedcba` | **HAYIR** |
| `CRC24_FLEXRAY_B` `:293` | `0x5d6dcb` | `0xabcdef` | **HAYIR** |
| Mode S (gerekli) | `0xfff409` | `0x000000` | yeni giriş |

**"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR" kuralının (dalga 13 dersi 2,
14g/14h'te iki kez uygulandı) beşinci vakası.** Dört tane 24-bit CRC var ve hiçbiri
işe yaramıyor. Yeni giriş: `CRC24_MODE_S`.

**2. CRSF CRC-8 — katalogdaki beş CRC8'in hiçbiri değil.** `[KANIT]`

Betaflight `common/crc.h:33`: `#define crc8_dvb_s2(crc, a)  crc8_calc(crc, a, 0xD5)`.
Kullanımı `crsf.c:334-336`: `crc = crc8_dvb_s2(0, crsfFrame.frame.type)` sonra payload
baytları → **init 0x00, poly 0xD5, yansıtma yok, xorout yok** (CRC-8/DVB-S2).

Katalogda: `CRC8` (0x07), `CRC8_SAE_J1850` (0x1D), `CRC8_AUTOSAR` (0x2F),
`CRC8_MAXIM` (0x31), `CRC8_BACNET_MSTP` (0x81). **0xD5 YOK.** Yeni giriş:
`CRC8_DVB_S2`.

**Ek KANIT — CRC'nin KAPSAMI:** `crsf.c:334` CRC'yi **Type baytından** başlatıyor,
Address ve Frame Length baytlarını DIŞARIDA bırakıyor. Bu, "CRC'yi çerçevenin
tamamına uygula" varsayımının sessizce yanlış çıkacağı yerdir.

**Toplam: `CrcCalculatorTool.test.tsx:77` 34 → 36.** İkisi de `check` fixture'ıyla
`crcEngine.test.ts`te doğrulanır.

---

## Alt dalga sıralaması önerisi

Dalga 13/14'ün kuralı: en kanıtlı ve en ucuz olan başta, kararı beklenen ve riskli
olan sonda; paylaşımı DOĞURAN kayıt tüketenden önce.

| # | Kayıtlar | Neden burada | Motor | Zorluk |
|---|---|---|---|---|
| **15a** | dronecan | Kaynak mükemmel, taşıyıcı altı kez kanıtlı, **katalog eklemesi YOK**. Domain'in en ucuz girişi | `canFrame.ts` + `CRC16_CCITT_FALSE` + `bitCursor` | orta |
| **15b** | cyphal, uavcan-compatibility | `distributed-uav-networks` KAPANIR. `uavcan-compatibility` 15a+15b'yi TÜKETİR; CAN FD kapsam kararı burada | `canFrame.ts` + 15a'nın çözücüsü | zor (iki karar) |
| **15c** | sbus, ibus | Sabit uzunluklu RC çerçeveleri; **11-bit kanal yardımcısı burada DOĞAR**; `canParse` bekçisi burada kurulur | yeni ortak yardımcı + `bitCursor` (`lsb-first`) | orta |
| **15d** | crsf | 15c'nin yardımcısını TÜKETİR; `CRC8_DVB_S2` eklenir; frame CRC ↔ command CRC ayrımı | 15c yardımcısı + yeni katalog girişi | orta |
| **15e** | ppm, pwm-servo | `rc-control-links` KAPANIR; `pulseLog.ts` konteynerinin ilk aerospace tüketicileri | `pulseLog.ts` (olduğu gibi) | orta |
| **15f** | arinc-429 | Bağımsız; bit sırası tuzağı + SSM'in kodlamaya bağımlılığı | `bitCursor` + parite | zor |
| **15g** | mil-std-1553 | `avionics-data-buses` KAPANIR; **`wordType` `decodeOptions` kararı** (bulgu 6) | `bitCursor` + `decodeOptions` | zor |
| **15h** | mode-s, ads-b | `surveillance` KAPANIR, DOMAIN KAPANIR; `CRC24_MODE_S`; DF17 → ME devri gerçek paylaşım | yeni katalog girişi + `crc()` + `bitCursor` | zor |

**Toplam 8 alt dalga / 12 kayıt.** 15a bilerek en başta: hiçbir katalog girişi
eklemeden, altı kez kanıtlı bir taşıyıcının üstüne, iki bağımsız kaynağın örtüştüğü
tek kayıt.

**Bağımlılıklar:** 15b → 15a (`uavcan-compatibility` DroneCAN çözücüsünü tüketir) ·
15d → 15c (11-bit yardımcı orada doğar) · 15h içinde ads-b → mode-s (ME alanı DF17'den
gelir). 15e, 15f, 15g birbirinden ve diğerlerinden bağımsızdır.

**Aile kapanış sırası:** 15b `distributed-uav-networks` · 15e `rc-control-links` ·
15g `avionics-data-buses` · 15h `surveillance` (+ domain).

### Model önerisi (alt dalga başına)

`CLAUDE.md`nin iki tablosu ayrı ayrı uygulandı — model = muhakeme sınıfı,
effort = düşünme derinliği.

- **15a (dronecan)** → **Sonnet · high.** Tarif net (iki bağımsız kaynak örtüşüyor,
  katalog eklemesi yok), ama "multi-frame reassembly parser'a girer mi" sınırı bir
  tasarım kararı — `mavlink.ts`in SEQ-LOSS emsali var, mekanik değil.
- **15b (cyphal + uavcan-compatibility)** → **Opus · high.** İki DUR-SOR kararı
  (CAN FD kapsamı + köprü kaydının parser alıp almayacağı), biri kayıt rozetini
  değiştiriyor. `iec-61850` GOOSE-only sınıfı muhakeme.
- **15c (sbus + ibus)** → **Sonnet · high.** Desen kurulu ama **`BitOrder` seçimi
  sessiz yanlış değer üretir** ve IBUS'un iki modeli `decodeOptions` tasarımı
  gerektiriyor. `medium` değil: yanlış seçimin bedeli görünmez.
- **15d (crsf)** → **Sonnet · high.** Yeni katalog girişi + CRC kapsam sınırı
  (Type'tan başlar, Address'ten değil) + extended frame ayrımı. Emsalli ama dikkatli.
- **15e (ppm + pwm-servo)** → **Sonnet · high.** Konteyner hazır (14f/14g), ama
  `canParse` yanlış-pozitif riski ölçülmüş ve *"tek evrensel sabit varsayma"*
  disiplini her satırda geçerli.
- **15f (arinc-429)** → **Opus · high.** Bit numaralandırma tersliği + Label bit
  sırası + SSM'in kodlamaya bağımlılığı: üç ayrı sessiz-yanlış-değer noktası,
  üstelik spec ÜCRETLİ olduğu için iki-bağımsız-kaynak kuralı sıkı uygulanacak.
- **15g (mil-std-1553)** → **Opus · high.** Bulgu 6'nın kararı `decodeOptions`
  yüzeyini şekillendiriyor ve yanlış varsayım her çerçevede yanlış alan adı basar.
- **15h (mode-s + ads-b)** → **Opus · high.** Dalganın görünmez-değişmez riski en
  yüksek işi: sahte-dost CRC, DF'e göre değişen parite semantiği (bulgu aşağıda),
  CPR'ın çerçeveler arası sınırı, "düzeltilmiş mesaj aynı güvende gösterilemez"
  kısıtı.

**Fable önerilmiyor.** Hiçbir alt dalga Opus'un yetmediği bir muhakeme sınıfında
değil; hepsinin emsali depoda mevcut.

---

## `decodeOptions` kanalı — bu domain'deki adaylar

`types.ts:308` `decodeOptions?: readonly DecodeOption[]`, `:247` `'select'` şıkkı.
Kanal AÇILMAZ, var olan kanal KULLANILIR — `types.ts` sözleşmesine DOKUNULMAZ.

| Kayıt | Seçenek | Neden gerekli | Emsal |
|---|---|---|---|
| `cyphal` | `transport` (`can` / `udp` / `serial`) | Aynı transfer, üç ayrı çerçeve | `xcpOnEthernet`/`xcpOnCan` ayrımı |
| `uavcan-compatibility` | — (kendisi bir seçici) | | |
| `ibus` | `profile` (`ia6` / `ia6b`) | **İki farklı checksum tohumu ve iki farklı senkron kuralı** (`ibus.c:106-115`) | `microwire.ts` profil kararı |
| `crsf` | `baudProfile` (416666 / 420000 / negotiated) | Yalnız `timing` görünümünü etkiler, çerçeveyi değil | `uart.ts` |
| `ppm` | `channelCount`, `syncGapUs`, `polarity`, `minPulseUs`/`centerPulseUs`/`maxPulseUs` | **Spec AÇIKÇA yasaklıyor hard-code'u** (`:254`, `:263`) | `j1850Vpw.ts`in `initialLevel`i |
| `pwm-servo` | `centerPulseUs`, `minPulseUs`, `maxPulseUs` | 20 ms/50 Hz *"yalnız bir konfigürasyon örneğidir"* (`aerospace-uav.ts:352`) | aynı |
| `arinc-429` | `dataEncoding` (`bnr` / `bcd` / `discrete` / `raw`) | **SSM'in ANLAMI kodlamaya bağlı** (`spec:301`) | `ioLink.ts`in `messageSide`i |
| `mil-std-1553` | `wordType` (`command` / `status` / `data`) | **Bulgu 6 — tip çerçevede YOK** | `ioLink.ts`in `messageSide`i |
| `ads-b` | — (DF17 ME'si kendini anlatır) | | |
| `mode-s` | `attemptCrcCorrection` (bool, varsayılan `false`) | Düzeltme opsiyonel ve güven seviyesi ayrı (`spec:373`) | — (yeni ama dar) |

**`decodeOptions` YOKKEN davranış her kayıtta belgelenir**: alan ADLANDIRILMAZ,
ham gösterilir, uyarı basılır. Sessizce bir varsayılan seçmek bu kanalın engellemek
için var olduğu şeydir.

---

## Açık sorular

Otonomi anlaşması gereği DUR-SOR olanlar **kalın** işaretli. Diğerleri alt dalga
içinde karara bağlanabilir.

1. **[DUR-SOR] `ads-b` 1090ES-only olarak `partial` mi kapansın?**
   Spec izin veriyor (`:346`: *"ilk kapsam olarak 1090ES/Mode S'e odaklanılabilir"*)
   ama katalog `1090ES / UAT Source` aracını listeliyor (`:467`). 978 MHz UAT ayrı
   bir tel biçimidir, ayrı kaynak gerektirir. Emsal: `cc-link-ie` 0x890F-only,
   `iec-61850` GOOSE-only. **Öneri: EVET, `partial` + özet ve dosya başı açıkça yazar.**

2. **[DUR-SOR] `cyphal` Cyphal/CAN-only olarak `partial` mi kapansın?**
   Bulgu 3. Üç taşıyıcının üçünü de yapmak dalganın kapsamını iki katına çıkarır;
   biri yapılınca kayıt "hazır" diyemez. **Öneri: Cyphal/CAN classic-only, `partial`,
   `transport` seçeneği yalnız `can` şıkkıyla açılır ve diğer ikisi "kapsam dışı"
   uyarısıyla listelenir.** CAN FD ayrıca sorulmalı: `canFd.ts` hazır olduğu için
   *ucuz*, ama Cyphal/CAN FD'nin transfer CRC'si classic'ten farklıysa (CRC-32C
   iddiası — 15b'de doğrulanacak) ucuz değil.

3. **[DUR-SOR] `uavcan-compatibility` parser ALSIN mı, `decode` sekmesi DÜŞSÜN mü?**
   Bulgu 4. İki yol:
   **(a)** Sınıflandırıcı parser: ham CAN çerçevesini alır, DroneCAN/Cyphal aday
   listesi + güven seviyesi döndürür, kendi tel biçimi tanımlamaz. `decode` sekmesi
   kalır, rozet `partial` (çünkü "çözmüyor", sınıflandırıyor).
   **(b)** 14a yolu: parser YOK, `decode` sekmesi katalogdan DÜŞER, kayıt bilgi
   sayfası olarak `partial` kapanır, `related` genişletilir.
   **Öneri: (a).** Gerekçe: spec bunu bir ÜRÜN GEREKSİNİMİ olarak yazıyor
   (`:111`, `:182`: *"auto-detection sonucu `Legacy UAVCAN / DroneCAN candidate` veya
   `Cyphal/CAN candidate` şeklinde gösterilmelidir"*), ve iş 15a+15b bittikten sonra
   neredeyse bedava. `automotive-ethernet`in durumundan farkı: orada gösterilecek
   HİÇBİR ŞEY yoktu, burada gösterilecek şey iki komşunun çıktısı.

4. **[DUR-SOR] `mil-std-1553` `wordType` seçeneği ZORUNLU mu olsun?**
   Bulgu 6. Zorunlu olursa (varsayılansız) kayıt `ready` kapanabilir çünkü kullanıcı
   ne çözdüğünü söylemiş olur. Varsayılan `data` konursa parser sessizce Data Word
   varsayar ve Command/Status çerçevelerini yanlış adlandırır. **Öneri: zorunlu
   DEĞİL ama varsayılanı YOK** — seçilmediğinde 16 bit ham + `wordTypeUnknown`
   uyarısı, `ready` rozeti korunur. `ioLink.ts`in `messageSide` çözümüyle aynı biçim.

5. **[DUR-SOR] `ibus` i-BUS2'siz `partial` mi kapansın?**
   Katalog *"i-BUS ve i-BUS2 aynı wire format değildir; tek profil altında
   birleştirilmemeli"* diyor (`:260-261`) ve tool listesinde `i-BUS / i-BUS2 Profile`
   var (`:257`). i-BUS2 için halka açık tel biçimi kaynağı **bulunamadı** (FlySky
   yayınlamamış, Betaflight uygulamamış). **Öneri: EVET, `partial`;
   `profile` seçeneği yalnız `ia6`/`ia6b` şıklarıyla açılır, i-BUS2 "kaynak yok"
   uyarısıyla listelenir.**

6. `ppm`/`pwm-servo` **tek modül mü, iki modül mü?** Katalog ikisini ayrı kayıt
   tutuyor ve gerekçesini yazıyor (`:309-311`: *"topoloji farklıdır: PPM tek hatta
   çok kanal, PWM servo kanal başına ayrı hat"*). Ama nabız okuma aynı.
   **15e içinde karara bağlanabilir** (DUR-SOR değil — 14d'nin SOME/IP-SD kararı
   emsal, "tek kayıt iki modül" ya da "iki kayıt bir yardımcı" ikisi de kabul).
   **Öneri: iki ayrı modül, ortak yardımcı YOK** — `pulseLog.ts` zaten ortak, üstüne
   ikinci bir ortak katman koymak 14g'nin reddettiği şeydir.

7. `mode-s` **CRC düzeltme motoru bu dalgada yazılsın mı?** Katalog istiyor (`:488`),
   spec örnek veriyor (`:373`). Tek-bit düzeltme 112 bit üzerinde ucuz.
   **15h içinde karara bağlanabilir.** **Öneri: `attemptCrcCorrection` seçeneği
   arkasında, varsayılan KAPALI, düzeltilmiş sonuç AYRI bir güven etiketiyle ve
   koşulsuz uyarıyla.** Katalog yorumu (`:491-493`) bunu bir tasarım kısıtı olarak
   yazmış, uyulur.

---

## Kaynak satır haritası (spec `06-havacilik-uav.md`, 546 satır)

mavlink `:7-107` (partial, dalga 3) · **UAVCAN isimlendirme uyarısı `:109-113`** ·
**dronecan `:115-156`** (transfer types `:119`, CAN ID `:122`, node ID `:128`,
tail byte `:131-141`, single/multi-frame `:143-146`, transfer ID `:148`,
DSDL `:151`, mesaj kategorileri `:154`) · **cyphal `:159-177`** (transport
independence `:163`, subject/service `:166`, heartbeat `:169`, DSDL `:172`,
network graph `:175`) · **DroneCAN/UAVCAN/Cyphal ayırıcı `:180-182`** ·
**sbus `:186-203`** (UART profili `:190`, 25-bayt çerçeve `:193`, kanal paketleme
`:196`, bayraklar `:199`, RC görünümü `:202`) · **ibus `:207-218`**
(klasik profil `:211`, kanal çözümü `:214`, checksum `:217`) ·
**crsf `:222-248`** (varsayılan UART `:226`, çerçeve `:229`, extended `:232`,
RC kanalları `:235`, telemetri `:238`, link istatistikleri `:241`, CRC `:244`,
baud pazarlığı `:247`) · **ppm `:252-266`** (normalizasyon `:256`, çerçeve tespiti
`:265`) · **pwm-servo `:270-284`** (hesaplar `:274`, normalizasyon/jitter `:283`) ·
**arinc-429 `:288-305`** (32-bit word `:292-302`, rate analyzer `:304`) ·
**mil-std-1553 `:309-340`** (roller `:313`, word tipleri `:316-321`, transaction
tipleri `:323-328`, RT/SA explorer `:330`, mode code `:333`, redundant bus `:336`,
timing `:339`) · **ads-b `:344-355`** (source pipeline `:348`, aircraft table `:351`,
1090ES `:354`) · **mode-s `:359-379`** (uzunluk/DF `:363`, DF17 `:366`,
ICAO `:369`, CRC/parite `:372`, CPR `:375`, target age `:378`) ·
gps-ubx `:383-388` (alias) · rtcm `:390-392` (alias) · nmea `:394-396` (alias) ·
Ortak araçlar `:400-533` · **Dikkat çekenler `:534-545`**.

**Spec'in kendi uyardığı, bu dalgada BAĞLAYICI olan beş madde:**

- *"UAVCAN tuzağı"* (`:536`) — belirsiz `Protocol: UAVCAN` seçeneği **yasak**.
  15b'nin `uavcan-compatibility` gerekçesi bu.
- *"SBUS bit-packing tuzağı"* (`:538`) — naif byte-aligned decode açıkça "yanlış"
  işaretli. 15c'nin `BitOrder` kararının gerekçesi bu.
- *"Mode-S CRC-correction güven seviyesi"* (`:541`) — düzeltilmiş mesaj **asla**
  native-valid ile aynı güvende gösterilmez. 15h'in açık soru 7'si bu.
- *"DroneCAN/Cyphal tail-byte toggle"* (`:543`) — 5-bit Transfer ID'nin 31→0 wrap'i
  **geçerli** sayılır, hatadan AYRILIR. 15a'nın uyarı listesinde.
- *"ARINC/MIL-STD-1553'te exact bit width/field'lar seçilen resmi standard
  revizyonundan yüklenmeli"* (`:545`) — 15f ve 15g'nin `partial`/ham-alan
  disiplininin doğrudan gerekçesi.

Ayrıca `:542` (koordinat çerçevesi NED/ENU karışması) ve `:544` (ortak failsafe state
machine) **domain geneli analiz işleridir**, kayıt başına değil — dalga 12/13/14'ün
aynı sınıftaki kararıyla bu dalganın DIŞINDA (ileride ayrı iş).

---

## Devralınan tuzaklar (her alt dalga brifinde tekrarlanır)

- **`ParsedField.offset`/`length` BAYT cinsindendir** (`protocol-core/types.ts:30`,
  `:41-42`, kilitli sözleşme). Bit alanları için **kapsayan bayt aralığı** verilir,
  bit ayrıntısı **alan ADINDA** taşınır (`rtp.ts`/`rtcp.ts` emsali).
- **`ParsedField.id` KENDİ offset'ini kullanır** — `bitCursor` ile çalışırken bit
  konumunu bayt offset'ine çevirirken kolayca kaçar (`ftp.ts`/`rtcp.ts` vakaları).
- **`ParsedField.warnings` `string[]`dir** (`types.ts:53`), `ProtocolWarning[]`
  değil; `ParsedFrame.warnings` ise `ProtocolWarning[]` (`:68`). Karıştırılmaz.
- **`ParsedFrame` DÜZDÜR, `children` YOKTUR.** Ağaç isteği alan ADLARIYLA karşılanır
  (`Header Frame ID`, `Trailer Frame CRC` — 12g'nin RTCP çözümü).
- **`unit` yalnız gerçek fiziksel değere** (`types.ts:46`). Ham tick sayısına,
  paketlenmiş kanal değerine, Label oktaline birim YAZILMAZ.
- **DecodePanel e2e tuzakları** (12d+12e'de bulundu, 14c brifinde listelendi):
  alan uyarısı ayrı `<tr>`de basılır (`fieldRow(...).getByTestId('decode-field-warning')`
  BOŞ döner; kökten `[data-testid="decode-field-warning"][data-field-id="X"]` ara) ·
  `success:false` `decode-parse-error` kartı basar, `decode-frame-error` DEĞİL ·
  `decode-field-raw` sayıyı `0x22 (34)` diye biçimler · çerçeve uyarısı birden
  çoksa `getByTestId('decode-frame-warning')` strict-mode ihlali verir,
  `.filter({ hasText })` ile süz.
- **`CrcCalculatorTool.test.tsx:77` katalog sayısını sabitliyor (şu an 34).**
  Yeni CRC eklendiğinde bu test ve içindeki yorum GÜNCELLENİR. Dosya yolu
  `src/features/calculators/tools/`.
- **`catalog.test.ts` `pluginId` ve `calculatorIds` tutarlılığını sınıyor** —
  `calculatorIds`teki her id `features/calculators/registry.ts`te bulunmalı.
- **Registry kaydı `src/protocols/index.ts`te `registerOnce(...)` ile** (şu an 129
  kayıt, `mavlink` örneği `:208-209`).
- **CRC "gösterilir" ile "doğrulanır" ayrımı kullanıcıya görünür olmalı**
  (dalga 13 dersi 3).
- **Uydurma kaynak gerçek bir tehlikedir** (dalga 13 dersi 5, üç iddia reddedildi).
  İki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır + uyarılır.
- **`[[ekrani-gercekten-ac]]`** — yeşil test + temiz review yetmez, varsayılan
  girdiyle tarayıcı turu şart.
- **KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → karar → motor → çeviri →
  test → e2e; biri bitmeden diğerine geçme.

---

## Çürüyen tahminler

*(Dalga kapanışında doldurulacak. Dalga 12/13/14'te kural hâline gelen bölüm:
brifin yanlış çıkan öngörüleri dosyada İŞARETLENİR, silinmez.)*

**Keşif turunda ZATEN çürüyen iki görev-hipotezi — kayıt için burada:**

1. **"`crcBits()` bu domain'de tüketici bulacak."** ÇÜRÜDÜ. ARINC 429 ve
   MIL-STD-1553'ün ikisinde de CRC yok, yalnız tek parite var; Mode S'in CRC-24'ü
   bayt hizalı. 14e'nin eklemesi bu dalgaya düşmedi. (Bulgu "❌" bölümü.)
2. **"`uavcan-compatibility` 14a'nın parser'sız LoRa paterniyle kapanır."**
   ÇÜRÜDÜ (kısmen). Kayıt `decode` sekmesi taşıyor (`aerospace-uav.ts:176`) ve
   spec sınıflandırmayı bir ürün gereksinimi olarak yazıyor; 14a'nın "gösterilecek
   hiçbir şey yok" durumu burada geçerli değil. (Bulgu 4.)

Ayrıca bir görev-hipotezi **kısmen** doğrulandı: *"`arinc-429` ARINC spec'leri ÜCRETLİ
olabilir → kaynaksız kayıt politikası devreye girebilir."* Spec gerçekten ücretli
(SAE ITC), **ama** word formatı üretici uygulama notlarında ve genel kaynaklarda
tam olarak yayınlanmış durumda — politika ALAN YAPISI için değil, **Label
sözlüğü** için devreye giriyor.

---

Bağlam: [[alp-comm-dalga14-automotive]], [[alp-comm-dalga13-industrial]],
[[alp-comm-otonom-dalga-yurutme]]. Bu dalga 2026-08-25'te KEŞİF turuyla açıldı;
kod henüz yazılmadı.
