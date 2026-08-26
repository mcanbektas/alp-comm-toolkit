# Faz 10, dalga 16 — Marine & Navigation (keşif, 2026-08-26)

Bu dosya **keşif** çıktısıdır: kod yazılmadı, brif üretildi. Her alt dalganın
uygulama brifi ayrı dosyada (`brief-faz10-dalga16a.md` … `brief-faz10-dalga16c.md`);
kod yazacak model ÖNCE bu dosyayı, SONRA kendi alt dalga brifini okur.

Yazım kuralı (dalga 12/13/14/15'ten devralındı): **tahmin ile kanıt ayrılır.**
`[KANIT]` etiketli her cümle dosya:satır ya da URL ile gösterilmiştir;
`[BEKLENTİ]` etiketli her cümle sınanmamış bir öngörüdür ve alt dalga onu
çürütebilir. Dalga 15'in en değerli çıktısı çürüyen tahminlerin İŞARETLENMİŞ
olmasıydı — o bölüm burada da en sonda, doldurulmayı bekliyor.

---

## Kapsam

`marine-navigation` domain'i: **5 aile / 11 protokol**
(`src/app/catalog/domains/marine-navigation.ts`).

Ham `status` dağılımı **KODDAN sayıldı** (tek kullanımlık script, 2026-08-26):
**5 `ready` / 3 `planned` / 3 alias**. `[KANIT]` Tüm katalog: 172 kayıt.

| Alias kayıt | `aliasOf` | Kanonik ikizin durumu |
|---|---|---|
| `gps-nmea` (`:216`, `aliasOf` `:255`) | `marine-navigation/nmea-family/nmea-0183` | `ready` (`:45`) |
| `marine-j1939` (`:344`, `aliasOf` `:378`) | `automotive/vehicle-network-protocols/j1939` | `ready` |
| `marine-modbus` (`:381`, `aliasOf` `:419`) | `industrial-automation/modbus/modbus-rtu` | `ready` |

**Bu üç aliasa DOKUNULMAZ.** `resolveStatus()` (`src/protocols/pluginBinding.ts`)
rozetlerini hedeflerinden çözer; ham `status: 'planned'` yazsa da ekranda
**Hazır** görünürler. Alias yönünü ters çevirme (CLAUDE.md, katalog bölümü).

### Aile aile döküm

| Aile | `ready`/alias | `planned` (bu dalga) |
|---|---|---|
| nmea-family (`:34`) | nmea-0183 (`ready`), nmea-2000 (`ready`) | **iec-61162** (`:128`) |
| ais (`:160`) | ais (`ready`, `:174`) | — (aile bitti) |
| gnss-corrections | gnss-ubx (`ready`, `:263`), rtcm (`ready`, `:301`), gps-nmea (alias) | — (aile bitti) |
| marine-machinery | marine-j1939 (alias), marine-modbus (alias) | — (aile bitti) |
| legacy-proprietary-marine (`:424`) | — | **seatalk** (`:430`), **hdlc-based-marine** (`:465`) |

Dalga kapanırsa **`marine-navigation` DOMAIN'İ KAPANIR** — `interfaces-framing`,
`network-ethernet`, `industrial-automation`, `automotive`, `aerospace-uav`'dan
sonra **altıncı kapanan domain**. Deponun kanonik borcu **8 → 5** iner
(wireless-iot 4, building-automation 1).

Spec kaynağı: `docs/spec/ozet/05-denizcilik.md` (381 satır) + ana doküman
`:14940-15085` (IEC 61162) ve `:15893-15991` (SeaTalk).

---

## Zaten var olan makine — neyin YENİDEN YAZILMAYACAĞI

Keşfin ana sorusu buydu: `nmea-0183` / `nmea-2000` / `ais` / `gnss-ubx` / `rtcm`
zaten `ready`. Üç yeni kayıt bunların ne kadarını TÜKETİR? Her biri
**`xcpPacket.ts`/`dnsWire.ts` sınıfı mı** (çekirdek gerçekten ortak → PAYLAŞ)
yoksa **`ccp.ts` sınıfı mı** (benzer görünüyor, çekirdek ortak DEĞİL → AYRI tut)?

Sonuç: **üç kayıttan ikisi gerçek paylaşım, biri hiç paylaşmıyor.** Kanıtıyla.

### ✅ BULGU 1 — `hdlcCore.ts` ZATEN VAR ve İKİ tüketicisi var `[KANIT]`

Bu dalganın en büyük tek bulgusu. `hdlc-based-marine` için sıfırdan HDLC
yazmaya gerek YOK:

`src/protocols/serial/framing/hdlcCore.ts` — **Faz 10 dalga 10c'de PAYLAŞILAN
ÇEKİRDEK olarak yazıldı** ve dosya başı bunu açıkça söylüyor (`:2-3`):
*"HDLC-ailesi (HDLC/SDLC) çerçeveleri için PAYLAŞILAN çekirdek… `hdlc.ts`/
`sdlc.ts` bunun üstüne ince, protokole özgü sarmal."*

Dışa açtıkları `[KANIT]`:

| Export | Satır | Ne yapar |
|---|---|---|
| `HDLC_SYNC_FLAG` | `:55` | `0x7e` |
| `hdlcSyncExtractor` | `:57` | **KAÇIŞSIZ** start=end=`0x7E` çerçeve çıkarıcı |
| `hexByte` / `hexWord` / `hexString` | `:65,69,73` | biçimleyiciler |
| `byteAt` | `:78` | `noUncheckedIndexedAccess` guard'ı |
| `HdlcFrameFormat` | `:88` | `'i-format' \| 's-format' \| 'u-format'` |
| `classifyControlByte` | `:98` | control baytından I/S/U |
| `decodeControlByte` | `:113` | N(S)/N(R)/P-F/S-tipi (modulo-8) |
| `validateHdlcFcs` | `:133` | `CRC16_X25`, **little-endian tel sırası** |
| `encodeHdlcSyncFrame` | `:145` | çerçeve kurucu (örnek/test üreticisi) |

Tüketiciler `[KANIT]` (`grep -rn 'hdlcCore' src/`):
`hdlc.ts:2`, `sdlc.ts:2` (+ testleri). `qspiCore.ts:4` bu deseni EMSAL olarak
anıyor: *"`hdlcCore.ts`nin HDLC/SDLC'ye yaptığının aynısı"*.

→ **`hdlc-based-marine` ÜÇÜNCÜ tüketicidir.** `sdlc.ts` birebir şablondur:
aynı çekirdek, yalnız alan ADLARI/yorumu değişir (`sdlc.ts` Address'i "Station
Address" yapıyor; marine kaydı hepsini "candidate" yapacak). Bu
**`xcpPacket.ts` sınıfı bir paylaşımdır**, `ccp.ts` sınıfı bir birleştirme
değil — çünkü tel biçimi GERÇEKTEN aynı (ISO/IEC 13239), ayrışan şey yalnız
alan semantiğinin bilinip bilinmemesi.

### ✅ BULGU 2 — `CRC16_X25` katalogda VAR ve `check` fixture'ı DOĞRULANMIŞ `[KANIT]`

`crcCatalogue.ts:159`:
```ts
CRC16_X25: { width: 16, poly: 0x1021n, init: 0xffffn, refin: true, refout: true, xorout: 0xffffn },
```
`crcEngine.test.ts:36`: `CRC16_X25: 0x906en`.

Dış doğrulama — reveng CRC kataloğu, birebir satır
(https://reveng.sourceforge.io/crc-catalogue/16.htm):
```
width=16 poly=0x1021 init=0xffff refin=true refout=true xorout=0xffff
check=0x906e residue=0xf0b8 name="CRC-16/IBM-SDLC"
Alias: CRC-16/ISO-HDLC, CRC-16/ISO-IEC-14443-3-B, CRC-16/X-25, CRC-B, X-25
```

→ **`hdlc-based-marine` için katalog eklemesi YOK.** Bkz. "Katalog eklemeleri".

### ✅ BULGU 3 — NMEA XOR checksum'ı `protocol-core`'da, ve `ais.ts` onu nasıl tükettiği YAZILI `[KANIT]`

`src/protocol-core/checksums/nmeaChecksum.ts` dışa açıyor: `nmeaXorChecksum`
(`:14`, **string alır**), `formatNmeaChecksum`, `parseNmeaSentence`,
`verifyNmeaChecksum`.

Tüketiciler: `nmea0183.ts:38-40,247`, `ais.ts:102`, `algorithmCatalogue.ts:19`,
`CrcCalculatorTool.tsx:38`.

**`ais.ts:10-20` bu dalga için kritik bir emsal yazıyor:**
> *"checksum ALGORİTMASI `nmeaChecksum.ts`teki `nmeaXorChecksum`/
> `formatNmeaChecksum` ile hesaplanır… Yalnız cümle sınırlayıcılarını bulan
> küçük fonksiyon (`splitAisSentence`) burada YENİDEN yazıldı, çünkü
> `parseNmeaSentence` (nmeaChecksum.ts) `$` başlangıcını SABİT varsayıyor —
> AIS taşıma cümlesi IEC 61162'nin `!` ile başlayan 'encapsulation sentence'
> alt kümesindendir."*

→ **`iec-61162` TAM AYNI durumdadır** ve bir adım ötesi: TAG block'un checksum'ı
da aynı XOR'dur ama sınırlayıcıları `\` … `*`. `parseNmeaSentence` yine
KULLANILAMAZ, `nmeaXorChecksum` yine KULLANILIR. `ais.ts`in kararı birebir
tekrarlanır. **Bu da `xcpPacket.ts` sınıfı bir paylaşımdır.**

### ✅ BULGU 4 — `nmeaSentences.ts` cümle çözücüsü ayrı bir modül `[KANIT]`

`nmea0183.ts:1-8` dosya başı: *"Cümle çözümü BURADA YOKTUR; alan alan
semantik/generic çözüm `nmeaSentences.ts`te tek yerde yaşar (modbusPdu.ts/
modbusRtu.ts ayrımının karşılığı)."*

Dışa açılanlar: `NMEA_SENTENCE_FORMATTERS` (`:64`, **28 formatter**: GGA, RMC,
GSA, GSV, VTG, GLL, ZDA, HDT, HDG, DPT, DBT, MWV, ROT, VHW, VLW, XDR, MTW,
RSA…), `splitPayloadTokens`, `getSentenceInfo`, `decodeSentenceFields`
(`:675`), `SentenceDecodeResult` (`:663`).

Ayrıca `nmea0183.ts:57,59`: `NMEA_0183_MIN_SENTENCE_LENGTH = 7`,
`NMEA_0183_MAX_SENTENCE_LENGTH = 82`.

→ `iec-61162`nin **-450 datagramı içindeki cümleyi** çözmek için bunlar
doğrudan tüketilir. `ais.ts`in `NMEA_0183_MAX_SENTENCE_LENGTH`i doğrudan import
etmesi (`ais.ts` dosya başı) emsaldir.

### ❌ BULGU 5 — `seatalk` HİÇBİR ŞEY tüketmiyor `[KANIT]`

SeaTalk 1'in NMEA ile **hiçbir ortak yanı yok**: ASCII değil (ham binary),
`$`/`*` sınırlayıcısı yok, **checksum'ı YOK** (aşağıda kanıt), CAN değil,
delimiter'ı yok. Katalog `related`i yalnız `nmea-2000`e bakıyor (`:461`) ve
o bağ SEMANTİK (gateway dönüşümü), tel değil.

→ **`seatalk.ts` sıfırdan, bağımsız yazılır.** `nmeaChecksum.ts`,
`hdlcCore.ts`, `canFrame.ts`, `bitCursor.ts` — hiçbiri kullanılmaz. Bu bir
eksiklik değil, protokolün kendisi. Paylaşım aramak `ccp.ts`in reddettiği
şeydir.

### ⚠️ BULGU 6 — `nmea2000.ts` `decodeJ1939Identifier`i CROSS-DOMAIN tüketiyor `[KANIT]`

`nmea2000.ts:61-69` importları: `canClassic.ts` (`buildCanClassicFrame`),
`canFrame.ts`, ve `automotive/j1939/j1939.ts`ten `decodeJ1939Identifier`.
Dosya başı gerekçeyi yazıyor: *"spec §14701'in 29-bit identifier tablosu
J1939'un §3.4 tablosuyla BİREBİR AYNIDIR… identifier matematiği burada
YENİDEN YAZILMAZ."*

Bu dalgada doğrudan tüketici yok, ama **`iec-61162`nin -3 profili NMEA 2000'e
yönlendirdiği için** brifin "yönlendirme" bölümünde anılır: yönlendirme
kaydı zaten çalışan bir motora bakıyor.

---

## Mimari bulgular

### 7) `iec-61162` SALT SINIFLANDIRICI DEĞİLDİR — `-450`'nin GERÇEK bir teli var `[KANIT]`

**Bu dalganın en önemli kararı ve keşfin ana sorusuydu.** `uavcan-compatibility`
(15b) emsali — sınıflandırıcı parser + `canParse` DAİMA `false` — burada
**KISMEN** geçerli, çünkü beş profilden **BİRİ kendi tel biçimini taşıyor.**

Profil profil karar, her satır kaynaklı:

| Profil | Kendi teli var mı | Karar | Kaynak |
|---|---|---|---|
| **-1** (Ed.6, 2024) | **HAYIR** — NMEA 0183'ün kendisi, 4800 baud 8N1 | `nmea-0183`e YÖNLENDİR | gpsd `drivers/driver_nmea0183.c:2-9`: *"Driver for NMEA 0183 protocol, **aka IEC 61162-1**"* + sürüm eşlemesi (NMEA 4.10 ↔ 61162-1:2016) |
| **-2** (Ed.2, 2024) | **HAYIR** — aynı cümleler, 38400 baud | `nmea-0183`e YÖNLENDİR + hız profili notu | IEC 61162-2:2024 önsözü, birebir: *"**the description of the data format protocol has been removed as this information is given in IEC 61162-1**"* — [PDF önizleme](https://cdn.standards.iteh.ai/samples/108135/66a817295ba14eb98cac51bf544ff613/IEC-61162-2-2024.pdf) |
| **-3** | **HAYIR** — NMEA 2000 / CAN-J1939 | `nmea-2000`e YÖNLENDİR | Wireshark `epan/dissectors/packet-nmea2000.c:13,21`: *"standardized as IEC 61162-3"* |
| **-450** (Ed.3, 2024) | **EVET — `UdPbC\0` + TAG block + cümle** | **GERÇEK PARSER YAZILIR** | beş bağımsız uygulama, aşağıda |
| **-460** (2024) | **HAYIR** — güvenlik/artıklık profili | Bilgi görünümü | IEC 61162-460 Ed.1 Scope, birebir: *"It does not introduce new application level protocol requirements to those that are defined in IEC 61162-450."* http://www.normservis.cz/download/view/iec/info_iec61162-460%7Bed1.0%7Den.pdf |

**Şemsiye iddiasının kendi kaynağı** (Wikipedia, IEC 61162):
*"The 61162 standards are all concerning the transport of NMEA sentences, but
the IEC does not define any of these. This is left to the NMEA Organization."*
https://en.wikipedia.org/wiki/IEC_61162

**-450'nin teli — `UdPbC\0` altı baytlık sihirli önek, BEŞ bağımsız uygulamada
doğrulandı `[KANIT]`:**

| Uygulama | Dosya:satır |
|---|---|
| Fraunhofer FKIE `maritime-dissector` | `maritime-modules/heuristic.lua:85-88`, `proto/iec61162450nmea.lua:27-33` |
| `ipal_transcriber` | `transcribers/iec450.py:13` — `if raw[:6] != b"UdPbC\x00" or raw[-2:] != b"\r\n"` |
| `PyLWE` | `src/pylwe/parser.py:60-63`, `generator.py:54` |
| `gosk` | `writer/lwe.go:158` |
| `EsDemo` | `common_library/udp/udp_61162_450.cpp:93,118` |

Ayrıntı, bayt düzeni, multicast tablosu, ikinci (binary) alt protokol ve
tüm tuzaklar **`brief-faz10-dalga16c.md`de**.

→ **KARAR: `iec-61162` GERÇEK bir parser alır**, `decode` sekmesi kalır,
`canParse` **`true` döner** (altı baytlık sihirli önek, ölçülmüş yanlış pozitif
**SIFIR** — bulgu 10). `uavcan-compatibility`nin "`canParse` daima false"
kararı burada geçerli DEĞİL, çünkü bu kaydın kendi teli VAR.

### 8) SeaTalk'un komut biti ÇERÇEVEDE YOKTUR — `mil-std-1553` sınıfı tuzak `[KANIT]`

Thomas Knauf, *SeaTalk Technical Reference* Rev. 3.23, Part 1 §Serial Data
Transmission — birebir (http://www.thomasknauf.de/rap/seatalk1.htm):
> *"11 bits are transmitted for each character: 1 Start bit (0V) / 8 Data Bits
> (least significant bit transmitted first) / **1 Command bit, set on the first
> character of each datagram. Reflected in the parity bit of most UARTs.** /
> 1 Stop bit (+12V)"*

**Yani datagram sınırını belirleyen bit, baytların İÇİNDE DEĞİLDİR** — UART'ın
parity bitindedir. Bu, `mil-std-1553`ün "sözcük tipi çerçevede YOK" bulgusunun
(15g) ve `io-link`in `messageSide`inin (13h) birebir sınıfıdır ve dalga 16'nın
en incelikli noktasıdır. Ayrıntı ve karar `brief-faz10-dalga16b.md`de.

### 9) SeaTalk 1'de CHECKSUM YOKTUR — kesin, aranarak doğrulandı `[KANIT]`

Knauf Part 1/2/3'ün TAM metninde `checksum`/`Checksum`/`CRC`/`crc` araması
**SIFIR sonuç** veriyor. Belgelenen tek bütünlük mekanizmaları:

1. **Seçili alanlarda tümleyen-çift artıklığı** — Part 1 §Data Coding, birebir:
   *"Some characters are repeated with all bits inverted for noise or
   transmission error detection. Example: 0xA2 is followed by 0x5D. The sum of
   both bytes must always be 0xFF."*
2. **Uzunluk uyuşmazlığı = at** — Part 1 §Collision Management, birebir:
   *"messages which are shorter than expected are invalid and have to be
   cancelled totally."*

Doğrulayıcı kanıt: `SeaTalkNMEA.ino` bir datagramı yalnız `packetLength == bi`
ile kabul ediyor, checksum yolu YOK. Ve SignalK/OpenCPN SeaTalk'u tel üzerinde
taşırken `$STALK,xx,yy,nn*CS` sarmalıyla **kendi NMEA checksum'ını EKLİYOR** —
tam da yerlisi olmadığı için.

→ **Katalog eklemesi YOK.** `checksumFinder.ts`in "olası checksum" aracı bu
sayfada BİR ARAÇ olarak anılabilir ama motor bir checksum ALANI BASMAZ.

### 10) `canParse` yanlış pozitifleri ÖLÇÜLDÜ — tahmin değil, sayı `[KANIT]`

Dalga 15f/15g/15h'te bekçi testi zorunlu hâle geldi. Bu dalgada ölçüm
**brif yazılırken** yapıldı (tek kullanımlık script, tam registry üzerinde):

**Registry: 140 kayıt, 870 örnek çerçeve** (2026-08-26).

| Kayıt | Denenen imza | Çakışma | Sonuç |
|---|---|---|---|
| `seatalk` | `3 ≤ n ≤ 18 && n === 3 + (b[1] & 0x0F)` | **27 / 870 (%3.1)** | KABUL EDİLEMEZ |
| `seatalk` | yukarısı **+** `b[0]` ∈ Knauf'un 60 komutu | **7 / 870 (%0.8)** | HÂLÂ KIRMIZI |
| `hdlc-based-marine` | `n ≥ 5 && b[0] === 0x7E && b[n-1] === 0x7E` | **6 / 870** | tamamı `hdlc`/`sdlc` |
| `iec-61162` | `b[0..5] === "UdPbC\0"` | **0 / 870** | TEMİZ |

`seatalk`in dar imzasındaki yedi çakışma, adlarıyla:
`bacnet-ip/original-unicast-npdu-read-property(13B, cmd=0x81)` ·
`bacnet-ip/length-mismatch(13B, 0x81)` · `bacnet-ip/invalid-type(13B, 0x01)` ·
`bacnet-mstp/data-not-expecting-reply-i-am(18B, 0x55)` ·
`bacnet-mstp/bad-data-crc(18B, 0x55)` ·
`iso-14230/service-data-truncated(3B, 0x83)` ·
`length-based-protocol/valid-frame(7B, 0x00)`

`hdlc-based-marine`in altı çakışması, adlarıyla:
`hdlc/i-frame(8B)` · `hdlc/s-frame(6B)` · `hdlc/u-frame(6B)` ·
`sdlc/i-frame(8B)` · `sdlc/poll(6B)` · `sdlc/u-frame(6B)`

**Bağlam:** 870 örneğin **501'i (%57.6)** zaten 3–18 bayt aralığında. Uzunluk
dağılımının tepesi: 16B:99, 8B:52, 4B:51, 6B:36, 5B:31, 14B:31, 3B:30.
Yani `seatalk`in imza uzayı deponun en kalabalık bölgesidir.

→ **KARAR: `seatalk` ve `hdlc-based-marine` için `canParse` DAİMA `false`.**
İkisinin de gerekçesi `uavcan-compatibility` (15b) emsalidir ama **sebepleri
farklıdır** ve dosya başlarında ayrı ayrı yazılır:
- `hdlc-based-marine`: imzası `hdlc`in imzasının AYNISI — `true` dönmek
  çalışan iki kaydın çerçevesini ÇALMAK olurdu.
- `seatalk`: baytlarda AYIRT EDİCİ SİNYAL YOK (sihirli sayı yok, checksum yok,
  sınırlayıcı yok) — imza ne kadar daraltılırsa daraltılsın yanlış pozitif
  sıfırlanmıyor, **ölçüldü**.

`iec-61162` ise `canParse` `true` döner ve bekçi testi bunu **beklenen davranış**
olarak yazar.

### 11) Katalogdaki üç kaydın da `build` sekmesi YOK — encoder YAZILMAZ `[KANIT]`

- `iec-61162` `tabs` (`:134`): `['overview','live','decode','timing','data','diagnostics','examples']`
- `seatalk` `tabs` (`:436`): `['overview','live','decode','timing','data','diagnostics','definitions','examples']`
- `hdlc-based-marine` `tabs` (`:471`): `['overview','live','decode','data','diagnostics','definitions','examples']`

Üçünde de `'build'` YOK → `ProtocolPlugin.encoder` **yazılmaz**.

**AMA:** `encodeHdlcSyncFrame` (`hdlcCore.ts:145`) ve benzerleri örnek/test
çerçevesi ÜRETMEK için de kullanılıyor (`hdlcCore.ts:139-143`: *"hem
`ProtocolPlugin.encoder`i besler hem örnek/test çerçevelerini kurar"*). Örnek
çerçeveleri kurmak için çağrılabilir; `encoder` alanı doldurulmaz.

`seatalk` ve `hdlc-based-marine` `definitions: ['vendor-map', …]` taşıyor
(`:461`, `:488`) — **panel YAZILMAZ**, `snmp.ts:46`/`dsdl` emsali (dalga 15
bulgu 9): tanım biçimi katalogda kalır, panel boş.

### 12) Çerçeveler arası durum PARSER'A GİRMEZ — üç kayıt da bunu istiyor, üçü de reddediliyor `[KANIT]`

Dalga 15 bulgu 10'un birebir tekrarı. Katalog/spec'in istediği ama parser'a
girmeyecek olanlar:

| Kayıt | İstenen | Neden parser'a girmez |
|---|---|---|
| `iec-61162` | `Speed Profile & Observed Update Rate` (`:144`), `Unexpected Flow` (`:149`) | Çok datagramlı hız/akış ölçümü |
| `iec-61162` | `Redundancy & Isolation` (`:148`) | Ağ topolojisi, çerçevede yok |
| `seatalk` | `SeaTalk1 → SeaTalkNG Gateway View`, `Conversion Correlation` (`:455-456`) | İki AYRI ağın çerçevelerini eşleştirmek |
| `seatalk` | `Duplicate Source Warning` (`:457`) | Çerçeveler arası kaynak takibi |
| `hdlc-based-marine` | `Fixed vs Changing Bytes`, `Counter Detection`, `Periodic Field Detection`, `Sensor Value Correlation` (`:481-484`) | **Reverse-engineering analyzer işi** — çok çerçeveli |

Gerekçe `mavlink.ts`in kararının aynısı: *"SEQ-LOSS HESABI PARSER'A GİRMEZ…
ÇERÇEVELER ARASI durum."* Bunlar sayfa metninde "analyzer katmanı" olarak
anılır, motor üretmez.

**Not:** `hdlc-based-marine`in reverse-engineering araçları
`src/features/reverse-engineering/` klasörüne aittir ve o klasör **HENÜZ
AÇILMADI** (`docs/plan-fazlar.md` "Faz 7 sonrası açık kalan boşluklar").
Bu dalga o klasörü AÇMAZ.

### 13) Denizcilikte HDLC'nin BULUNAN TEK sağlam örneği AIS'tir — ve `ais.ts`e DOKUNULMAZ `[KANIT]`

Kaynak turu denizcilikte HDLC kullanan ekipman aradı. **Radar/ARPA, VDR
(IEC 61996), GMDSS/DSC ve Inmarsat-C için erişilebilir birincil kaynak
BULUNAMADI** (DSC, ITU-R M.493'ün kendi 10-bit sembol biçimini kullanıyor,
HDLC değil; Inmarsat-C iddiaları yalnız Scribd/ManualsLib'de). Bu, brife
**açıkça** yazılıyor ki bir sonraki dalga aynı aramayı tekrarlamasın.

Bulunan tek somut bağ **AIS'in VDL katmanıdır.** ITU-R M.1371-6 (02/2026),
Annex 2 §A2-3.2.2, birebir:
> *"Data transfer should use a bit-oriented protocol which is based on the
> high-level data link control (HDLC) as specified by **ISO/IEC 13239:2002**…
> **Information packets (I-Packets) should be used with the exception that the
> control field is omitted**"*

Tablo 12 — tam slot (256 bit, 26.67 ms):
`Ramp up 8 | Training 24 | Start flag 8 (7Eh) | Data 168 | CRC 16 | End flag 8 | Buffer 24`

§A2-3.2.2.6: *"**Only the data portion should be included in the CRC
calculation**"*; §A2-3.3: *"Each byte should be output with **least significant
bit first**"* + NRZI.

**Bu bulgunun iki sonucu var ve ikisi de ters yönde:**

1. **16a'nın `decodeOptions` yüzeyi GENİŞLER ve gerekçelenir.**
   `addressFieldBytes: 0`, `controlFieldBytes: 0` ve
   `fcsCoverage: 'information-only'` şıkları **uydurma esneklik değil,
   belgelenmiş bir denizcilik vakasıdır.**
2. **`ais.ts` MOTORU DEĞİŞMEZ ve `related` bağı EKLENMEZ.** Depodaki `ais.ts`in
   girdisi `!AIVDM` **NMEA taşıma cümlesidir**, VDL bit akışı DEĞİL
   (`ais.ts` dosya başı: *"Girdi `!AIVDM`/`!AIVDO` cümle baytlarıdır"*).
   İkisi AYRI katmanlardır; birleştirmek `ccp.ts` sınıfı bir hata olurdu.
   Bağ yalnız **sayfa metninde** anlatılır.

`[BEKLENTİ — uygulamada doğrulanacak]` AIS VDL'inin ham bit akışını
`exampleFrame` yapmak CAZİP ama yapılmamalı: girdi bit-hizasız (168 bit tam
bayt değil, LSB-first oktet + NRZI) ve bu motorların sözleşmesi bayt-hizalı
mantıksal çerçevedir.

---

## Kaynak durumu — kayıt kayıt

Kaynak turu **brif yazılırken yapıldı** (dalga 13 mimari bulgu 1'in disiplini:
kaynak turu ilk adımdır). Kanıtlar aşağıda; alt dalga brifleri ayrıntıyı taşır.

| Kayıt | Kaynak | Nitelik | Beklenen rozet |
|---|---|---|---|
| `iec-61162` | **Standart METNİ paralı** (IEC). Ama `-450`nin teli BEŞ bağımsız açık uygulamada birebir aynı (FKIE `maritime-dissector`, `ipal_transcriber`, `PyLWE`, `gosk`, `EsDemo`) + gerçek `.pcap` yakalamaları + standardın kendi yazarlarının makalesi (Rødseth/Christensen/Lee, ISIS 2011) + resmî önizleme PDF'lerinin önsözleri | **İYİ** (tel biçimi kesin; Tablo 5/6 hücre değerleri paywall arkasında) | **`partial`** (`UdPbC` ASCII-only) |
| `seatalk` | Thomas Knauf Rev. 3.23 (Part 1/2/3, canlı, HTTP 200 doğrulandı) — **60 komut**, tam uzunluk formülü, elektriksel katman. **Üç bağımsız uygulama örtüşüyor:** `MartinDavidWaller/SeaTalkNMEA` (AVR 9-bit UART), `MatsA/seatalk1-to-NMEA0183` (Pi bit-bang), `SignalK/nmea0183-signalk` (21 datagram hook'u). + `canboat` PGN 126720 tüneli (20 Seatalk PGN'i) | **İYİ** (resmî spec YOK; tersine mühendislik ama ekosistemin de-facto normatif kaynağı) | **`partial`** (zarf tam + adlandırılmış alt küme) |
| `hdlc-based-marine` | ITU-T X.25 (10/96) §2.2.x + ITU-T Q.921 §2.2/§3.3.1 + RFC 1662 §3/§4/§5 + reveng CRC kataloğu. **ISO/IEC 13239:2002 metni paywall** ama tüm iddialar üç bağımsız kamu kaynağından türetildi. **Denizcilikte tek sağlam HDLC bağı: AIS VDL** (ITU-R M.1371-6, 02/2026, Annex 2 §A2-3.2.2) | **MÜKEMMEL** (çerçeveleme + FCS + control field tamamen kamuya açık ve depoda ZATEN uygulanmış) | **`ready`** |

### `[DUR-SOR]` sınıfı kaynak notu — X.25'in kendi doğrulaması

En güçlü tek kanıt: X.25 Appendix I'in (s.145) dört örnek çerçevesi
bit-unstuff edilip LSB-first çözülünce reveng kataloğunun kod sözcükleriyle
**BİREBİR** çıkıyor (`033F5BEC`, `01738357`, `013FEBDF`, `03733364`) ve her
birinin residue'sü `0xF0B8`. Tek test aynı anda şunları doğruluyor: CRC
parametreleri, LSB-first bit sırası, FCS'in düşük-oktet-önce taşınması, bit
stuffing, LAPB adresleri (A=0x03, B=0x01) ve SABM(P=1)=0x3F / UA(F=1)=0x73.

### Katalog eklemeleri — **HİÇBİRİ. Sıfır yeni CRC.**

Bu, dalga 13/14/15'ten sonra ilk kez oluyor ve **bilinçli olarak
doğrulandı**, varsayılmadı:

| Kayıt | Gereken checksum | Katalogda var mı |
|---|---|---|
| `iec-61162` | NMEA XOR (TAG block + cümle, İKİSİ de) | **VAR** — `nmeaChecksum.ts:14` (CRC değil, `crcCatalogue`de yeri yok) |
| `seatalk` | **YOK** (bulgu 9) | — |
| `hdlc-based-marine` | `CRC16_X25` (+ opsiyonel `CRC32` profili) | **VAR** — `crcCatalogue.ts:159` ve `:426` |

**"Aynı bit genişliği aynı algoritma DEĞİLDİR" kuralının bu dalgadaki
uygulaması** (dalga 13 dersi 2, 15h'te dört sahte dost reddetmişti): burada
kural **ters yönde** işledi ve bir sahte dost REDDETTİ —
`CRC16_KERMIT` (`crcCatalogue.ts:207`) da poly `0x1021`dir ve HDLC FCS'i
sanılabilir, ama `init=0x0000 xorout=0x0000`dır ve `check` değeri `0x2189`dur,
`0x906E` değil. **`CRC16_X25` alınır, `CRC16_KERMIT` ALINMAZ.** Aynı şekilde
`CRC16_CCITT_FALSE` (`:143`) da poly `0x1021`dir ve HDLC DEĞİLDİR.

**`CrcCalculatorTool.test.tsx` sayısı DEĞİŞMEZ: 37 kalır.** Bu dalga hiçbir
CRC eklemiyor. Dosyadaki gerçek satır **`:81`**tir
(`expect(options).toHaveLength(37);`) — dalga 15h brifi `:77` diyordu ve o sayı
zaten bayatlamıştı (dalga 15 çürüyen tahmin 1). **Sayıyı brif'ten değil
DOSYADAN oku.**

---

## ZORUNLU ÖZEL GÖREV — zamanlanmış mayınlar

Dalga 15b'de tam bu sınıf bir tuzak yaşandı: `e2e/modbus-decode.spec.ts`in
hedefi iki kez motor aldı ve test **iki alt dalga boyunca sessizce kırmızı
kaldı**. Yapısal olarak ödendi ve fixture artık katalogdan türetiliyor.
`[KANIT]` `e2e/modbus-decode.spec.ts` dosya başı:
> *"Hedef artık KATALOGDAN TÜRETİLİYOR: motoru olmayan, alias olmayan,
> `decode` sekmesi olan ilk `planned` kayıt. Bir sonraki dalga o kaydı da
> bağlarsa bekçi kendiliğinden bir sonrakine geçer; hiç `planned` kayıt
> kalmazsa test AÇIKÇA atlanır, sessizce yeşil kalmaz."*

```ts
const plannedEntry = allEntries().find(
  (entry) =>
    entry.protocol.status === 'planned' &&
    entry.protocol.aliasOf === undefined &&
    entry.protocol.pluginId === undefined &&
    entry.protocol.tabs.includes('decode'),
);
const PLANNED_DECODE_PATH =
  plannedEntry === undefined ? undefined : `/comm/${plannedEntry.path}?tab=decode`;
```
ve `:304`te `test.skip(PLANNED_DECODE_PATH === undefined, '…')`.

**Depoda BU düzeltmeyi ALMAMIŞ İKİ sabit fixture kaldı ve ikisi de bu dalgada
patlar.** Tam tarama yapıldı (`grep` ile `src/**/*.test.ts(x)` + `e2e/*.spec.ts`):

| # | Dosya:satır | Sabit değer | Ne zaman patlar |
|---|---|---|---|
| **M1** | `src/pages/ProtocolPage.test.tsx:36` | `PLANNED_PATH = 'marine-navigation/legacy-proprietary-marine/seatalk'` | **16b** (`seatalk` motora bağlanınca) |
| **M2** | `e2e/nmea-decode.spec.ts:35` | `PLANNED_DECODE_PATH = '/comm/marine-navigation/nmea-family/iec-61162?tab=decode'` | **16c** (`iec-61162` motora bağlanınca) |

**İkisi de 16a'da, HERHANGİ bir motor yazılmadan ÖNCE düzeltilir.** Gerekçe:
15b'nin dersi "mayını patladıktan sonra değil, patlamadan önce sök"tür.
Uygulama tarifi `brief-faz10-dalga16a.md` §"Görev 0".

M1'in yorum geçmişi mayının kaçıncı kez taşındığını gösteriyor
(`ProtocolPage.test.tsx:24-35`): `uart` → `microwire` → `flexray` → `seatalk`.
**Dördüncü taşıma yapılmaz, türetilir.**

### Mayın OLMADIĞI doğrulanan yerler

Tarandı ve temiz çıktı — brife yazılıyor ki bir sonraki dalga tekrar aramasın:

- `e2e/modbus-decode.spec.ts` — **zaten türetilmiş** (15b düzeltmesi).
- `src/pages/FamilyPage.test.tsx:50-85` — `aliasRecords()`/`allEntries()`ten
  **türetiliyor**, `it.each` ile koşuyor. Sabit yol yok.
- `e2e/dbc-definitions.spec.ts:19-20` (`marine-j1939?tab=definitions`) ve
  `:215` (`plannedNotice` görünür) — hedef bir **ALIAS**tır, kanonik ikizi
  (`j1939`) zaten `ready` ve alias kaydın ham `status`u kalıcı olarak
  `'planned'`. `definitions` sekmesinin "planlandı" basması **panel bağlı
  olmamasından** kaynaklanıyor, kaydın durumundan değil. **Mayın DEĞİL.**
- `e2e/eds-definitions.spec.ts:145` ve `e2e/arinc-429-decode.spec.ts:328` —
  hedefleri `lin` ve `arinc-429`, ikisi de `ready`; sınanan şey `definitions`
  sekmesinde panel BAĞLI OLMAMASI. **Mayın DEĞİL.**
- `e2e/xcp-on-can-decode.spec.ts:61`, `e2e/xcp-on-ethernet-decode.spec.ts:66` —
  aynı sınıf (`definitions` sekmesi, kayıt `ready`). **Mayın DEĞİL.**
- `e2e/{ais,nmea2000,rtcm,ubx,j1939}-decode.spec.ts` — marine yollarını
  kullanıyorlar ama hedefleri **zaten `ready`** kayıtlar. **Mayın DEĞİL.**
- `src/protocols/pluginBinding.test.ts:163-165` — `marine-modbus` alias yolunu
  sabitliyor ama o kayıt kalıcı olarak alias. **Mayın DEĞİL.**
- `src/tests/catalog.test.ts` — hiçbir yerde sabit sayı yok
  (`DOMAIN_IDS.length`ten türetiyor). **Mayın DEĞİL.**
- `src/features/calculators/tools/CrcCalculatorTool.test.tsx:81` — sabit `37`
  var ama **bu dalga CRC EKLEMİYOR**, dokunulmaz. Bir sonraki dalga eklerse
  günceller.

**Dalga 16'dan sonra kalan mayın: SIFIR.** Ama türetilmiş bekçiler
`wireless-iot` + `building-automation` da kapandığında (5 kanonik kayıt)
kendiliğinden `skip`e düşer — bu tasarım gereğidir, arıza değil.

---

## `decodeOptions` kanalı — bu domain'deki adaylar

**Dalga 15'in dersi:** *"`decodeOptions` adayları tablosu SİSTEMATİK olarak AZ
tahmin etti — `arinc-429` 1 → 7, `pwm-servo` 3 → 5, `ppm` 6 → 7."* Sebep:
kalibrasyon ihtiyacı motor yazılırken görünüyor, brif yazılırken değil.
**Bu tablo o dersle CÖMERT tahmin edilmiştir** ve her satırın kaynağı var.

| Kayıt | Seçenek | Neden gerekli | Emsal |
|---|---|---|---|
| `iec-61162` | `transportProfile` (`450-udpbc` varsayılan; `-1`/`-2`/`-3`/`-460` yalnız YÖNLENDİRME görünümü) | Beş profilden yalnız biri çözülüyor (bulgu 7) | `cyphal`ın `transport`u (15b) |
| `iec-61162` | `transmissionGroup` (`unknown` varsayılan · MISC · TGTD · SATD · NAVD · VDRD · RCOM · TIME · PROP · USR1-8) | **Multicast grubu payload'da YOK** — UDP başlığında. Grup seçilirse anlamsal bağlam basılır + koşulsuz uyarı | `mil-std-1553`ün `wordType`ı (15g) |
| `iec-61162` | `sentenceDecoding` (`envelope-only` \| `full`) | Gömülü cümleyi `nmeaSentences.ts` ile alan alan çözmek opsiyonel olmalı | `modbusPdu`/`modbusRtu` ayrımı |
| `iec-61162` | `requireTagBlock` (bool, varsayılan `true`) | Standart `s:` etiketini ZORUNLU kılıyor ama uygulamalar sapıyor | `ppp.ts`in ACFC varsayımı |
| `iec-61162` | `maxDatagramBytes` (varsayılan `1472`) | Standardın yazarlarının kendi sınırı (ISIS 2011 §5.3) | `hdlc`in `maxFrameLength`i |
| `seatalk` | `commandByteSource` (`assumeFirstByte` varsayılan \| `lengthChained`) | **Komut biti çerçevede YOK** (bulgu 8) | `mil-std-1553` `wordType` |
| `seatalk` | `semanticDepth` (`envelope` \| `knownCommands` varsayılan \| `raw`) | Adlandırılmış alt küme ile ham arasında geçiş | `ioLink`in `messageSide`i |
| `seatalk` | `strictLength` (bool, varsayılan `true`) | Knauf: kısa datagram GEÇERSİZDİR, atılır | — |
| `seatalk` | `complementCheck` (bool, varsayılan `true`) | Tümleyen-çift artıklığı yalnız BAZI komutlarda var | — |
| `hdlc-based-marine` | `fcsProfile` (`crc16-x25` varsayılan \| `crc32-iso-hdlc` \| `none`) | **Spec üç şıkkı da adıyla sayıyor**: *"CRC-16 profile, CRC-32 profile, Custom HDLC FCS"* (`02-framing-protokolleri.md` §HDLC/FCS) | `ibus`un `profile`i (15c) |
| `hdlc-based-marine` | `fcsByteOrder` (`little-endian` varsayılan \| `big-endian`) | RFC 1662 §3.1 LSB-önce der, vendor'lar sapar | `bacnetmstp.ts:358` |
| `hdlc-based-marine` | `addressFieldBytes` (`1` varsayılan \| `2` \| `0`) | Q.921 §3.3.1 EA biti ile genişletiyor; AIS hiç kullanmıyor | `iec101.ts` genişlik seçenekleri |
| `hdlc-based-marine` | `controlFieldBytes` (`1` varsayılan \| `2` \| `0`) | modulo-8/128; **AIS control alanını TAMAMEN ATIYOR** (M.1371-6 §A2-3.2.2) | aynı |
| `hdlc-based-marine` | `controlFieldProfile` (`raw-candidate` varsayılan \| `iso-13239-modulo8`) | Vendor çerçevesi gerçek HDLC olmayabilir — "candidate" disiplini | — (yeni ama dar) |
| `hdlc-based-marine` | `escaping` (`none` varsayılan \| `rfc1662-octet-stuffed`) | Async HDLC `0x7D`/`0x20` kaçışı kullanır, senkron kullanmaz | `ppp.ts` vs `hdlc.ts` |
| `hdlc-based-marine` | `fcsCoverage` (`address-control-information` varsayılan \| `information-only`) | AIS FCS'i YALNIZ 168 veri bitini kapsıyor | — |

**Toplam öngörü: `iec-61162` 5, `seatalk` 4, `hdlc-based-marine` 7 = 16 kanal.**
Dalga 15'in dersi gereği bu sayının **BÜYÜMESİ beklenir**, küçülmesi sürpriz
olur.

---

## Alt dalga sıralaması önerisi

Dalga 13/14/15'in kuralı: en kanıtlı ve en ucuz olan başta, kararı beklenen ve
riskli olan sonda; **aileyi ve domain'i kapatan en sonda.**

**Üç kayıt için ÜÇ ayrı brif.** Gerekçe: `seatalk` ile `hdlc-based-marine`
AYNI ailede (`legacy-proprietary-marine`) olmalarına rağmen **hiçbir kod, kaynak
ya da tel biçimi paylaşmıyorlar** — biri bayrak+bit-stuffing+CRC, öteki
checksum'sız 9-bit UART. 15c'nin (`sbus`+`ibus`) birleştirme gerekçesi
"ortak 11-bit yardımcısı burada doğuyor"du; burada doğacak ortak hiçbir şey yok.
15h'in (`mode-s`+`ads-b`) gerekçesi tek yönlü tüketimdi; burada o da yok.
**Ayrı tutmak "KAYIT KAYIT bitir" kuralının (dalga 13 dersi 7) doğal biçimi.**

| # | Kayıt | Neden burada | Motor | Zorluk |
|---|---|---|---|---|
| **16a** | `hdlc-based-marine` (+ **iki fixture mayını**) | Çekirdek İKİ tüketiciyle kanıtlı (`hdlcCore.ts`), CRC katalogda VE fixture'lı, `sdlc.ts` birebir şablon. **Domain'in en ucuz girişi.** Mayınlar burada sökülür — 16b/16c'ye kırık test devretmez | `hdlcCore.ts` (olduğu gibi) + `CRC16_X25` | orta |
| **16b** | `seatalk` | **`legacy-proprietary-marine` ailesini KAPATIR.** Kaynak turu ağır (60 komut, üç uygulama çaprazlaması), komut biti çerçeve dışı, `canParse` kararı ölçülmüş | sıfırdan bağımsız motor | zor |
| **16c** | `iec-61162` | **`nmea-family` KAPANIR, DOMAIN KAPANIR.** `UdPbC` teli gerçek; `nmeaChecksum.ts`+`nmeaSentences.ts` TÜKETİLİR; aynı datagramda İKİ ayrı kapsamlı checksum | `nmeaChecksum.ts` + `nmeaSentences.ts` (`ais.ts` emsali) | zor |

**Toplam 3 alt dalga / 3 kayıt.**

**Bağımlılıklar:** **YOK.** Üçü de birbirinden bağımsızdır. Tek sıralama kısıtı
16a'nın fixture görevidir: **16a, 16b ve 16c'den ÖNCE koşmalıdır**, aksi hâlde
`ProtocolPage.test.tsx` ve `nmea-decode.spec.ts` kırmızıya döner.

**Aile kapanış sırası:** 16b `legacy-proprietary-marine` · 16c `nmea-family`
(+ **domain**).

### Model önerisi (alt dalga başına)

`CLAUDE.md`nin iki tablosu **ayrı ayrı** uygulandı — model = muhakeme sınıfı,
effort = düşünme derinliği. İkisi otomatik birlikte yükseltilmedi.

- **16a (`hdlc-based-marine` + fixture)** → **Sonnet · high.**
  Muhakeme: tarif net ve şablon (`sdlc.ts`) elde — Opus gerekmiyor.
  Düşünme `high` (medium DEĞİL): **yedi `decodeOptions` kanalının hangi
  varsayılanla açılacağı** ve "alan adı ÜRETİLMEZ, candidate kalır"
  disiplininin her satırda tutulması yanlış giderse **sessiz yanlış ad basar**.
  Ayrıca fixture türetmesi iki ayrı test dosyasında iki farklı yol biçimi
  (`/comm` önekli vs öneksiz) istiyor.

- **16b (`seatalk`)** → **Opus · high.**
  Muhakeme `Opus`: yol belli değil. **Rozet kararı** (`partial` mı `ready` mi),
  **hangi komutların adlandırılacağı** (Knauf 60 ∩ SignalK 21 ∩ canboat 20 —
  üç kümenin kesişimi mi birleşimi mi), ve **komut bitinin çerçevede olmaması**
  görünmez bir değişmez. Tersine mühendislik kaynağının kendisi *"incomplete
  inaccurate and may even be wrong"* diyor — hangi alana güvenileceği aktif
  muhakeme.
  Düşünme `high`: seçenekler var ama her biri tek adımda değerlendirilebilir;
  `xhigh` gerekmiyor çünkü geri dönüşü pahalı bir şema/sözleşme kararı yok.

- **16c (`iec-61162`)** → **Opus · high.**
  Muhakeme `Opus`: **domain'i kapatan alt dalga** + kayıt "sınıflandırıcı mı,
  gerçek parser mı" sorusunun cevabı keşifte DEĞİŞTİ (bulgu 7) + **aynı
  datagramda iki checksum FARKLI bayt aralıklarını kapsıyor** (klasik
  sessiz-yanlış) + `R?UdP` ikinci telinin kapsam kararı rozeti belirliyor.
  Düşünme `high`: kaynak kesin ve bayt düzeni net; belirsizlik kapsamda,
  problemin tanımında değil — `max` gereksiz.

**Fable önerilmiyor.** Hiçbir alt dalga Opus'un yetmediği bir muhakeme
sınıfında değil; üçünün de emsali depoda mevcut (`sdlc.ts`, `uavcanCompatibility.ts`,
`ais.ts`). Fable'ın ayrı haftalık kotasını harcamayı gerektiren bir şey yok.

---

## Devralınan tuzaklar (her alt dalga brifinde tekrarlanır)

- **`ParsedField.offset`/`length` BAYT cinsindendir** (`protocol-core/types.ts:41-42`,
  kilitli sözleşme). Bit alanları için **kapsayan bayt aralığı** verilir, bit
  ayrıntısı **alan ADINDA** taşınır (`rtp.ts`/`rtcp.ts` emsali). SeaTalk'un
  nibble alanları ve HDLC'nin control bitleri bu kuralın altındadır.
- **`ParsedField.id` KENDİ offset'ini kullanır** (`ftp.ts`/`rtcp.ts` vakaları).
  `iec-61162`de TAG block alanları ile gömülü cümle alanları AYNI datagramda —
  id çakışması gerçek bir risk.
- **`ParsedField.warnings` `string[]`dir** (`types.ts:53`), `ParsedFrame.warnings`
  ise `ProtocolWarning[]` (`:68`). Karıştırılmaz.
- **`ParsedFrame` DÜZDÜR, `children` YOKTUR.** Ağaç isteği alan ADLARIYLA
  karşılanır (`TAG · Source`, `Sentence · Talker` — 12g'nin RTCP çözümü).
- **`unit` yalnız gerçek fiziksel değere** (`types.ts:46`). SeaTalk'un ham
  nibble'ına, HDLC'nin N(S)/N(R)'sine, TAG block sayacına birim YAZILMAZ;
  çözülmüş derinlik/hız/başlık birim ALIR.
- **`decodeOptions` `readonly DecodeOption[]`** (`types.ts:308`), tek şık tipi
  `DecodeOptionChoice` (`:248`), tanım `:274`.
- **DecodePanel e2e tuzakları** (12d+12e'de bulundu, 14c'de listelendi):
  alan uyarısı ayrı `<tr>`de basılır (`fieldRow(...).getByTestId('decode-field-warning')`
  BOŞ döner; kökten `[data-testid="decode-field-warning"][data-field-id="X"]` ara) ·
  `success:false` `decode-parse-error` kartı basar, `decode-frame-error` DEĞİL ·
  `decode-field-raw` sayıyı `0x22 (34)` diye biçimler · çerçeve uyarısı birden
  çoksa `getByTestId('decode-frame-warning')` strict-mode ihlali verir,
  `.filter({ hasText })` ile süz.
- **`CrcCalculatorTool.test.tsx` katalog sayısını sabitliyor.** Bu dalga CRC
  EKLEMİYOR → **dokunulmaz, 37 kalır.** Sayıyı brif'ten değil `:81`den oku.
- **`catalog.test.ts` `pluginId` ve `calculatorIds` tutarlılığını sınıyor** —
  `calculatorIds`teki her id `features/calculators/registry.ts`te bulunmalı.
- **Registry kaydı `src/protocols/index.ts`te `registerOnce(...)` ile.**
  Şu an **140 kayıt** (KODDAN sayıldı); dalga 16 sonunda **143**.
  Marine kayıtları `:45-58`de.
- **Durum rozeti `resolveStatus()`ten okunur, ham `protocol.status`tan değil**
  (dalga 11 dersi, `FamilyPage.test.tsx` bekçiliyor).
- **CRC/checksum "gösterilir" ile "doğrulanır" ayrımı kullanıcıya görünür
  olmalı** (dalga 13 dersi 3). SeaTalk'ta doğrulanacak HİÇBİR ŞEY yok —
  o da açıkça yazılır.
- **Uydurma kaynak gerçek bir tehlikedir** (dalga 13 dersi 5). İki bağımsız
  kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır + uyarılır. Bu dalgada kural
  özellikle sıkı: `seatalk`in tek birincil kaynağı bir tersine mühendislik
  sayfası, `iec-61162`nin standardı paywall arkasında.
- **Boş kart basmak yasak** (CLAUDE.md). `definitions` sekmesi açık kalır ama
  panel yoksa "planlandı" bildirimi basar — `snmp.ts:46` emsali.
- **`[[ekrani-gercekten-ac]]`** — yeşil test + temiz review yetmez, varsayılan
  girdiyle tarayıcı turu şart.
- **KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → karar → motor →
  çeviri → test → e2e; biri bitmeden diğerine geçme.

---

## Kaynak satır haritası (spec `05-denizcilik.md`, 381 satır)

NMEA 0183 `:5-59` (checksum `:21`, koordinat `:34`, cümle çözücü `:43`,
frekans `:49`, kaynak çatışması `:55`) · NMEA 2000 `:61-110` (PGN `:69`,
29-bit id `:75`, single/multi-frame `:88`, device discovery `:96`) ·
**IEC 61162 `:112-121`** (şemsiye uyarısı `:114`, -1 `:116`, -2 `:117`,
-3 `:118`, **-450 `:119`**, -460 `:120`) · AIS `:124-162` ·
GPS NMEA `:164-176` · GNSS UBX `:178-190` · RTCM `:192-204` ·
NTRIP `:206-214` · J1939 marine `:216-226` ·
**SeaTalk `:228-241`** (3 telli bus `:230`, kavramsal katman `:232`,
semantik gruplar `:234`, gateway `:236`, duplicate source `:238`,
**proprietary limitation `:240`**) · Marine Modbus `:244-260` ·
**HDLC `:262-274`** (giriş `:264`, **generic yapı `:266`**, bit stuffing `:268`,
**bilinmeyen protokol örneği `:270`**, reverse engineering `:272`) ·
ortak dashboard `:276-350` · **hata modeli `:351-355`** ·
drill-down `:357-368` · **Dikkat çekenler `:370-381`**
(HDLC muhafazakârlığı `:377`, SeaTalk/Modbus "tek protokol yanılgısı" `:378`).

Ek: `docs/spec/ozet/02-framing-protokolleri.md` §HDLC (`hdlcCore.ts`in kendi
atfı: `:156-173`; "Toolkit İki Ayrı Görünüm" `:163-164`; **"Exact control-field
bit yorumu seçilen HDLC profile/moduna göre değişir"** `:170-172`; **FCS
profilleri** hemen ardından).

Ana doküman: IEC 61162 `:14940-15085`, SeaTalk `:15893-15991`.

---

## Açık sorular

Otonomi anlaşması gereği **`[DUR-SOR]` olanlar kalın** işaretli ve
**hepsi burada, tek listede.** Diğerleri alt dalga içinde karara bağlanabilir.

### `[DUR-SOR]` — kullanıcıya sorulacaklar

1. **`iec-61162` `UdPbC`-only olarak `partial` mi kapansın?**
   `-450`nin İKİ ayrı teli var: ASCII `UdPbC\0` (TAG block + NMEA cümlesi) ve
   binary `RrUdP`/`RaUdP`/`RpUdP` (38 baytlık big-endian başlık, parça
   birleştirme, MIME'lı dosya tanımlayıcı). İkincisi de kaynaklı ve gerçek bir
   yakalamayla doğrulanmış, ama **ayrı bir tel biçimidir**.
   **Öneri: EVET — `UdPbC` ASCII-only, rozet `partial`.** `R?UdP`, `-460` ve
   Ed.2'nin PGN kapsüllemesi sayfada AÇIKÇA "kapsam dışı" listelenir. Emsal:
   `ads-b` 1090ES-only, `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only,
   `foundation-fieldbus` HSE-only.

2. **`iec-61162`nin `R?UdP` binary teli bu dalgada YAZILSIN mı?**
   Yazılırsa 16c iki modüle çıkar (`iec61162_450.ts` + `iec61162_450Binary.ts`)
   ve rozet yine `partial` kalır (-460 ve PGN kapsüllemesi hâlâ dışarıda).
   **Öneri: HAYIR.** Gerekçe 15h'in [Karar 15h-1]'inin aynısı: **domain'i
   kapatan alt dalgada opsiyonel bir ikinci motor riski artırır** ve kayıt
   onsuz da dürüstçe `partial` kapanır. Yapılmazsa sayfa metni ikinci teli
   "ileride" olarak yazar.

3. **`seatalk` `partial` mi kapansın, `ready` mi?**
   Zarf (komut baytı, attribute nibble, `3 + (attr & 0x0F)` uzunluk formülü)
   **TAM** çözülüyor ve kendi kendini doğruluyor. Ama (a) komut biti
   çerçevede YOK — doğrulanamıyor; (b) tek birincil kaynak bir tersine
   mühendislik sayfası ve **yazarı kendisi güvenilmez olabileceğini söylüyor**;
   (c) 60 komuttan yalnız çapraz-doğrulanmış alt küme adlandırılabilir.
   **Öneri: `partial`.** Zarf + adlandırılmış alt küme çözülür, gerisi HAM +
   `commandNeedsVendorMap` uyarısı; özet neyin çözülüp neyin çözülmediğini
   AÇIKÇA yazar. Katalogdaki `definitions: ['vendor-map']` (`:461`) ve spec'in
   *"Proprietary limitation"* maddesi (`:240`) bu rozeti zaten söylüyor.

4. **`seatalk`in adlandırılacak komut kümesi hangisi olsun?**
   Üç aday: (a) Knauf'un **60**'ı (tek kaynak), (b) SignalK'in **21** hook'u ∪
   canboat'ın **20** PGN'i (çift kaynak, dar), (c) kesişim.
   **Öneri: (b) — iki bağımsız uygulamada teyitli olanlar adlandırılır**
   (dalga 13 dersi 5'in doğrudan uygulaması: *"İki bağımsız kaynak örtüşmezse
   alan ADLANDIRILMAZ"*). Knauf'un kalan komutları **TANINIR** (komut adı
   basılır) ama **payload ÇÖZÜLMEZ** — `ads-b`nin TC 5-8/28/29/31 kararının
   (15h) birebir biçimi.

5. **`hdlc-based-marine` `ready` mi kapansın, `partial` mi?**
   Zarf (`hdlc`/`sdlc` ile BİREBİR aynı) tam çözülüyor, FCS gerçekten
   doğrulanıyor, kaynak mükemmel. `hdlc` ve `sdlc` **ikisi de `ready`**
   (`interfaces-framing.ts:962,989`) ve aynı sınırları taşıyorlar.
   Karşı argüman: katalog bu kayıtta alanların **"candidate" kalmasını** şart
   koşuyor (`:486-487`), yani hiçbir alan kesin adlandırılmıyor.
   **Öneri: `ready`.** Gerekçe `profibusDp.ts`/`hart.ts` ölçütü
   (`plan-fazlar.md` 13h notu): *"envelope'un HER alanı doğrulanıyor, ham
   kalanlar YAPISAL eksik değil, şema bağımlı içerik."* Burada ham kalan şey
   vendor semantiğidir ve **onun bilinmemesi protokolün kendisidir**, motorun
   eksiği değil.

### Alt dalga içinde karara bağlanabilir (DUR-SOR DEĞİL)

6. `seatalk` ve `hdlc-based-marine` için **`canParse` DAİMA `false`.**
   Ölçüldü (bulgu 10): `seatalk` en dar imzasında bile 7/870 yanlış pozitif,
   `hdlc-based-marine`in imzası `hdlc`in imzasının AYNISI (6/870, hepsi
   `hdlc`/`sdlc`). `uavcan-compatibility` (15b) emsali, iki ayrı gerekçeyle.
   **Karara bağlandı, kod yazılabilir** — ama bekçi testi ZORUNLU ve testin
   kanıtlayacağı şey `false` dönüşünün **kasıtlı** olduğudur
   (`uavcanCompatibility.test.ts` emsali: `dronecan`/`cyphal`in KABUL ETTİĞİ
   çerçevelerde de `false` dönmeli).

7. `iec-61162`nin `transmissionGroup` seçeneği **payload'da olmayan bir bilgiyi**
   kullanıcıdan alıp anlamsal bağlam basıyor. `mil-std-1553`ün `wordType`ı
   (15g) ve `io-link`in `messageSide`i (13h) aynı şeyi yapıyor.
   **Öneri: açılsın, seçildiğinde KOŞULSUZ bir `groupFromUserNotWire` uyarısı
   basılsın.** Seçilmezse grup alanı HİÇ BASILMAZ (`mode-s`in DF-bağımlı
   CRC alanını hiç basmaması emsali).

8. `hdlc-based-marine` `hdlcCore.ts`i **import mi etsin, `hdlc.ts`in
   `related`ine mi yönlensin?** İkincisi 14a'nın (`automotive-ethernet`)
   parser-yazma yolu olurdu. **Öneri: import etsin** — `decode` sekmesi AÇIK
   (`:471`) ve gösterilecek gerçek bir çerçeve var; 14a'nın durumundan farkı
   `uavcan-compatibility`nin 15b'deki farkının aynısı.

---

## Çürüyen tahminler

*(Dalga 12/13/14/15'te kural hâline gelen bölüm: brifin yanlış çıkan
öngörüleri dosyada İŞARETLENİR, SİLİNMEZ. Dalga 15'in en değerli çıktısı buydu.)*

### Keşif turunda ZATEN çürüyenler

1. **"`iec-61162` muhtemelen kendi teli olmayan bir 'standart uyum görünümü'dür
   ve `uavcan-compatibility` emsali geçerli olur — sınıflandırıcı parser +
   `canParse` DAİMA `false`."** (Dalga 16 keşif görevinin açık hipotezi.)
   **ÇÜRÜDÜ.** `-450` profilinin **gerçek, kendine ait bir tel biçimi var**:
   sabit altı baytlık `UdPbC\0` öneki, kendi checksum'ı olan TAG block katmanı,
   çoklu-TAG ve çoklu-cümle datagramları, 1472 baytlık tavan. Beş bağımsız
   uygulamada birebir doğrulandı (bulgu 7). Kayıt **gerçek parser alır** ve
   `canParse` **`true` döner** (ölçülen yanlış pozitif: 0). Hipotezin doğru
   çıkan yarısı: `-1`/`-2`/`-3`/`-460` gerçekten yönlendirmedir ve `-2:2024`
   veri biçimi maddesini **kendi önsözünde SİLDİĞİNİ** yazıyor.

2. **"`hdlc-based-marine` için HDLC framing makinesi `interfaces-framing`
   domain'inde (dalga 11) olabilir."** (Görev tanımının varsayımı.)
   **KISMEN ÇÜRÜDÜ — doğru yer dalga 11 değil, dalga 10c.** Makine
   `src/protocols/serial/framing/hdlcCore.ts`tedir ve `interfaces-framing`
   domain'inin `framing-stream-protocols` ailesine (`hdlc` `:944`, `sdlc`
   `:979`, `ppp` `:1004`) hizmet eder. Sonuç aynı yere çıkıyor ama arama
   dalga 11 briflerinde yapılırsa BULUNAMAZ.

3. **"`seatalk` kaynaksız-kayıt politikasının muhtemel adayıdır."**
   **KISMEN ÇÜRÜDÜ.** `partial` önerisi ayakta ama **sebebi kaynak yokluğu
   DEĞİL**: kaynak beklenenden çok daha iyi çıktı (Knauf Rev. 3.23'te 60 komut
   + üç bağımsız uygulama + canboat tüneli). `partial`ın gerçek sebebi
   **komut bitinin çerçevede olmaması** ve tersine mühendislik kaynağının
   kendi güvenilirlik uyarısıdır. Emsal `iec-61850` GOOSE-only değil,
   `mil-std-1553`ün "tip çerçevede yok" sınıfıdır.

4. **"Üç kayıttan biri katalogda OLMAYAN bir checksum isteyebilir."**
   **ÇÜRÜDÜ — sıfır ekleme.** `hdlc-based-marine`in `CRC16_X25`i katalogda
   (`:159`) ve `check` fixture'ı doğrulanmış (`crcEngine.test.ts:36`,
   `0x906E`); `iec-61162` CRC değil NMEA XOR kullanıyor ve o da depoda
   (`nmeaChecksum.ts:14`); `seatalk`te **checksum HİÇ YOK**. Dalga 13'ten beri
   ilk kez bir dalga `crcCatalogue.ts`e dokunmuyor.

### Uygulama sırasında çürüyenler (16a-16c)

*(Alt dalgalar bittikçe BURAYA yazılır. Yanlış öngörüler silinmez, işaretlenir.)*

**16a — `hdlc-based-marine`**

5. **"Çeviri anahtarı ~20-25 beklenir."** **ÇÜRÜDÜ — 44 çıktı.** Sebep
   `decodeOptions`: yedi kanalın her biri etiket + açıklama + şık etiketleri
   getiriyor. Dalga 15'in *"brifler `decodeOptions` yüzeyini SİSTEMATİK olarak
   AZ tahmin ediyor"* dersinin doğrudan devamı ve bu dalgada ÜÇ kez tekrarlandı
   (bkz. 16c/8).

6. **"Yedi `decodeOptions` kanalı"** — **DOĞRU ÇIKTI**, dalga 15'ten beri ilk
   kez bir tahmin tutmuş oldu. Sebebi tahminin CÖMERT yapılmış olması: üç kanalın
   gerekçesi (AIS VDL'inin control alanını atması ve FCS'i yalnız veriyi
   kapsaması) keşif turunda ZATEN bulunmuştu.

7. **Brifte HİÇ öngörülmeyen iki karar** uygulamada doğdu: (a)
   `rfc1662-octet-stuffed` modunda alan offset'lerinin MANTIKSAL olması ve bunun
   `asyncEscapingAssumed` ile söylenmesi; (b) `iso-13239-modulo8` + 2 baytlık
   control kombinasyonunda ikinci baytın ayrı bir `control-extended` candidate
   alanı olması (uydurma modulo-128 yorumu YAZILMADI).

**16b — `seatalk`**

8. **"Knauf'un 60 komutu."** **ÇÜRÜDÜ — 59.** `C7` bir FANTOM: Part 2'nin tam
   metninde yalnız `C1…C8` waypoint adı yer tutucusunun sarmalanmış devamında
   geçiyor, komut baytı olarak değil. Ders: **kaynağın metninde geçen her bayt
   bir komut değildir**; fantom komut yayımlamak dalga 13 dersi 5'in (uydurma
   kaynak) sessiz biçimidir.

9. **"~23 komutun payload'ı çözülür"** (`[DUR-SOR]` kararı 4'ün sayısı).
   **NEREDEYSE — 22.** Fark tek komut ve sebebi 8'in aynısı.

10. **"Derinlik komutlarında metrik/imperial bayrağı çözülür."** **ÇÜRÜDÜ.**
    Tel DAİMA feet/10 taşır; `Y&4` bayrağı ENSTRÜMANIN GÖSTERİM tercihidir,
    telin birimi değil. Birim sabit `ft` basıldı, bayrak AYRI bir alan oldu.
    Bir bayrağı "birim seçici" sanmak `unit`i yanlış yazmanın klasik yolu.

11. **Brifin ÖNGÖRMEDİĞİ en pahalı iş: iki kaynağın ÜÇ yerde çelişmesi.** Brif
    *"iki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ"* kuralını yazıyordu ama
    çelişkinin **ADLANDIRMA değil YORUM** düzeyinde çıkacağını öngörmemişti:
    Knauf ile SignalK aynı alanı aynı adla ama FARKLI okuyordu (0x85 XTE nibble
    sırası, 0x20 hızın bayt sırası, 0x84/0x9C başlık düzeltme terimi). Çözüm
    kurala eklendi: **kazanan, kaynağın KENDİ worked example'ıyla aritmetik
    olarak doğrulanabilen okumadır**; iki okuma gerçekten ayrışıyorsa alan bir
    uyarı TAŞIR (`headingCorrectionAmbiguous`).

**16c — `iec-61162`**

12. **Keşif hipotezinin çürümesi UYGULAMADA DOĞRULANDI.** Bulgu 7 zaten
    *"`-450`nin gerçek teli var"* diyordu; uygulama turu üç `.pcap` yakalamasını
    doğrudan indirip UDP payload'larını çıkardı ve **her iki checksum'ı da
    bağımsız yeniden hesapladı** — üçü de tutuyor. Brifin bayt düzeni tarifinde
    tek bir sapma çıkmadı. `canParse` yanlış pozitifi de brifin ölçtüğü gibi
    **0** kaldı (bugün 143 kayıt / 886 örnek).

13. **"`decodeOptions` BEŞ kanal."** **ÇÜRÜDÜ — 7.** Brifin kendi "görünen
    adaylar" listesindeki İKİSİ gerçekten gerekti: `timestampScale` (`c:`in
    ölçeği çerçevede YOK ve 10/13 hane dışında çıkarım da yapılamıyor;
    kullanıcı vendor'unu biliyor olabilir) ve `strictTerminator` (brifteki adı
    `trailingCrlfRequired`; üç kaynak ikiye bölünüyor — `ipal_transcriber` ve
    FKIE CRLF'i ŞART koşuyor, PyLWE koşmuyor). Üçüncü aday `sentenceStartChars`
    kanal OLMADI: `!` KOŞULSUZ kabul edilir (`ais.ts`in gerekçesi burada da
    geçerli) ve kapsülleme cümlesi bir uyarıyla işaretlenir — seçenek yapmak
    kullanıcıya olmayan bir karar sordurmak olurdu.

14. **"Çeviri anahtarı ~35-45 beklenir."** **ÇÜRÜDÜ — 73.** Dalganın üçüncü
    aynı hatası (16a'da 20-25 → 44). Kalıcı düzeltme: **anahtar tahmini
    `decodeOptions` kanal sayısıyla ÖLÇEKLENİR** — kanal başına ~4 anahtar
    (etiket + açıklama + şıklar) ve örnek başına 2. Bu kayıtta 7 kanal + 7
    örnek + 12 hata + 16 uyarı + 8 alan uyarısı gerçekten 73 ediyor.

15. **Brifin "grup adı ve ANLAMSAL KATEGORİ basılır" tarifi DEĞİŞTİRİLDİ.**
    Kategorinin düz metin açıklaması (ör. VDRD = *"Data required for the VDR
    according to IEC 61996"*) standardın **paywall'lı Tablo 4**'ündedir ve brife
    ikinci elden (Cobham kılavuzu) girmişti. İkinci elden aktarılmış bir cümleyi
    "standardın tanımı" diye basmak dalga 13 dersi 5'in tam hedefi olurdu.
    Yerine **iki bağımsız kaynakta birebir örtüşen TALKER KÜMESİ** basılıyor
    (`transmissiongroups.json` ve `gosk`in `talkerMulticastMap`i). Bu düz
    metinden DAHA iyi çıktı çünkü **ölçülebilir**: motor datagramdaki gerçek
    talker ID'lerini seçilen grubun kümesiyle karşılaştırıyor ve çelişkide
    `groupTalkerMismatch` basıyor — kullanıcının iddiası telle SINANIYOR.
    Brifin öngörmediği bir doğrulama kanalı doğdu.

16. **`ProtocolErrorCode` kümesi brifte hiç anılmamıştı ve bir tuzak çıktı.**
    "Geçersiz sihirli sayı" ve "kapsam dışı tel" için doğal görünen
    `invalid-header`/`unsupported-version` kodları **kilitli birlik tipte
    YOKTUR** (`types.ts`). Kullanılan karşılıklar: sihirli önek →
    `start-delimiter-not-found` (token çerçevenin başlangıç sınırlayıcısıdır),
    `R?UdP` ve TAG bloğu zorunluluğu → `unsupported-encoding` (*"biçim bu
    çözücünün kabul ettiği kümede değil"*). Yeni bir kod EKLENMEDİ.

17. **Fixture öngörüsü DOĞRU ÇIKTI.** 16a'nın Görev 0'ı iki mayını patlamadan
    söktü; 16c'de `iec-61162` motor alınca iki türetilmiş fixture da
    kendiliğinden `building-automation/lonworks/lonworks`a KAYDI ve hiçbiri
    kırılmadı. `CrcCalculatorTool.test.tsx`in gerçek satırının `:81` ve sayının
    37 olduğu da doğrulandı; dalga boyunca `crcCatalogue.ts` ve
    `nmeaChecksum.ts` HİÇ değişmedi.

18. **Rozet ve kapsam öngörüleri (`[DUR-SOR]` 1/2/3/5) DOĞRU ÇIKTI.**
    `iec-61162` `partial` (`UdPbC`-only), `R?UdP` yazılmadı, `seatalk`
    `partial`, `hdlc-based-marine` `ready`. Tek EK karar: `R?UdP` sessizce
    "geçersiz önek" ile değil, **TANINIP AÇIKÇA "kapsam dışı" denerek**
    reddediliyor ve FKIE'nin gerçek binary yakalamasının 38 baytlık başlığı
    bunun örnek çerçevesi — kapsam kararı böylece EKRANDA görünür oldu.
---

## Dalga kapanışı — 16c bitince yapılacaklar

1. **`CLAUDE.md` "Bilinen borçlar"** güncellenir: `marine-navigation` TAMAMEN
   KAPANDI, kalan kanonik borç **5** (wireless-iot 4, building-automation 1).
   Ham sayım **KODDAN yeniden doğrulanır** (tek kullanımlık sayım script'i —
   dalga 14/15'in yöntemi). Ayrıca yeni kalıcı dersler yazılır: HDLC çekirdeği
   üçüncü tüketicisini aldı; "aynı poly farklı init/xorout" (`CRC16_X25` vs
   `CRC16_KERMIT` vs `CRC16_CCITT_FALSE`); `canParse` yanlış pozitifinin
   BRİF AŞAMASINDA ölçülebildiği.
2. **`docs/plan-fazlar.md`** — dalga 16 kapanış özeti (15'in biçimi emsal) ve
   `:32`deki faz tablosu satırı güncellenir (altıncı kapanan domain).
3. **`docs/brief-faz10-dalga16.md`** — "Çürüyen tahminler → Uygulama sırasında
   çürüyenler" bölümü DOLDURULUR.
4. **Sıradaki domain seçimi** — iki aday kalıyor (`wireless-iot` 4,
   `building-automation` 1). Seçim gerekçesiyle yazılır.

---

## BEŞ `[DUR-SOR]` KARARA BAĞLANDI (2026-08-26, kullanıcı kararı) — tekrar sorma

Beşi de keşif turunun önerdiği şıkla kapandı:

1. **`iec-61162` → `UdPbC`-only, `partial`.** Yalnız beş bağımsız uygulamada
   birebir doğrulanmış -450 teli çözülür; **`R?UdP` binary teli, -460 güvenlik
   katmanı ve Ed.2 PGN kapsüllemesi KAPSAM DIŞI** ve sayfa metni bunu AÇIKÇA
   yazar. Emsal: `ads-b` 1090ES-only, `iec-61850` GOOSE-only,
   `foundation-fieldbus` HSE-only.
2. **`R?UdP` ikinci teli BU DALGADA YAZILMAZ.** Domain'i kapatan dalgada
   ikinci bir motor riski artırır — `[Karar 15h-1]`in (tek-bit CRC düzeltme
   motoru) birebir aynı gerekçesi. Sayfa metni "ileride" der.
3. **`seatalk` → `partial`.** Kaynak tersine mühendislik ürünü ve kaynağın
   KENDİSİ bazı alanlar için *"may even be wrong"* diyor; ayrıca komut biti
   çerçevede taşınmıyor. Kaynaksız kayıt politikasının tam hedefi.
4. **`seatalk` komut kapsamı → 60 TANI, 23 ÇÖZ.** Knauf'un altmış komutunun
   ADI basılır; yalnız ikinci bağımsız kaynakta da teyitli ~23 komutun
   payload'ı ÇÖZÜLÜR, gerisi HAM + uyarı. `ads-b`nin Type Code kararının
   birebir biçimi (TC 1-4/9-22 çözülür, 5-8/28/29/31 tanınır ama çözülmez).
   **Tek kaynaklı komutun alan tablosu YAYINLANMAZ** — "tahmin edilmiş alan
   tablosu ASLA yayınlanmaz" kuralı.
5. **`hdlc-based-marine` → `ready`.** `hdlcCore.ts`in iki tüketicisi (`hdlc`,
   `sdlc`) da `ready`; aynı zarf, aynı `CRC16_X25`. Zarf tam çözülüyor,
   payload'ın tanımsızlığı protokolün kendisidir.

**Ana thread'in doğruladıkları (keşif raporuna güvenilmedi):**
`hdlcCore.ts` var ve tüketicileri `hdlc.ts` + `sdlc.ts` ✓ · `CRC16_X25`
katalogda `crcCatalogue.ts:159`, check `0x906E` fixture'ı `crcEngine.test.ts:36`
✓ · iki fixture mayını da GERÇEK: `ProtocolPage.test.tsx:36` (`/comm` öneki
YOK) ve `e2e/nmea-decode.spec.ts:35` (`/comm` öneki VAR) ✓ ·
`CrcCalculatorTool.test.tsx` sayısı gerçekten `:81`de ve 37 ✓.
