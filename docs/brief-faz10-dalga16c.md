# BRİF — Faz 10 dalga 16c, `iec-61162` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga16.md`i**, sonra bu dosyayı okur.
**16a'nın Görev 0'ı (fixture mayınları) bitmiş olmalıdır** — aksi hâlde bu alt
dalga `e2e/nmea-decode.spec.ts`i kırar.

Bu alt dalga **`nmea-family` ailesini ve `marine-navigation` DOMAIN'İNİ
KAPATIR** — dalga 16'nın son işi ve deponun **altıncı kapanan domain'i.**

**BİR `[DUR-SOR]` kararı taşır** (ana brif açık soru 1) ve **bir tavsiye
kararı** (açık soru 2). İkisi de kod yazılmadan netleşir.

---

## BULGU 7 (ana brif) — hipotez ÇÜRÜDÜ, bu GERÇEK bir parser

Keşif turunun açık hipotezi şuydu: *"`iec-61162` NMEA 0183/2000'in standart
çatısıdır; kendi teli yoktur, `uavcan-compatibility` (15b) emsali geçerlidir —
sınıflandırıcı parser + `canParse` DAİMA `false`."*

**ÇÜRÜDÜ.** Beş profilden **biri kendi tel biçimini taşıyor** ve o tel beş
bağımsız açık kaynak uygulamasında birebir doğrulandı.

| Profil | Kendi teli | Karar | Kaynak (birebir alıntı) |
|---|---|---|---|
| **-1** (Ed.6, 2024) | **YOK** | `nmea-0183`e YÖNLENDİR | gpsd `drivers/driver_nmea0183.c:2-9`: *"Driver for NMEA 0183 protocol, **aka IEC 61162-1**"*; IEC 61162-1:2024 önsözü: *"the data transmission rate… **The default remains as 4 800 (bits/s)**"* + *"aligned… with **NMEA 0183 version 4.10**"* |
| **-2** (Ed.2, 2024) | **YOK** | `nmea-0183`e YÖNLENDİR + hız notu | IEC 61162-2:2024 önsözü, **kesin kanıt**: *"**the description of the data format protocol has been removed as this information is given in IEC 61162-1**"*; varsayılan **38 400 bit/s** |
| **-3** | **YOK** | `nmea-2000`e YÖNLENDİR | Wireshark `epan/dissectors/packet-nmea2000.c:13,21`: *"standardized as **IEC 61162-3**"* / *"Relies on the J1939 dissector"* |
| **-450** (Ed.3, 2024) | **VAR — ve İKİ tane** | **GERÇEK PARSER** | beş uygulama, aşağıda |
| **-460** (2024) | **YOK** | bilgi görünümü | IEC 61162-460 Ed.1 **Scope**, birebir: *"**It does not introduce new application level protocol requirements to those that are defined in IEC 61162-450.**"* |

Şemsiye iddiasının kendi kaynağı (https://en.wikipedia.org/wiki/IEC_61162):
*"The 61162 standards are all concerning the transport of **NMEA sentences, but
the IEC does not define any of these.** This is left to the NMEA Organization."*

**Sonuç:** `iec-61162` **hem sınıflandırıcı hem parser** olan bir kayıttır.
`canParse` **`true` döner** (altı baytlık sihirli önek; ölçülen yanlış pozitif
**SIFIR**, ana brif bulgu 10) — `uavcan-compatibility`nin "daima `false`"
kararı burada geçerli DEĞİL.

Önizleme PDF'leri:
- 61162-1:2024 — https://cdn.standards.iteh.ai/samples/108134/c3c1d634d7f844368f1f9f774375f514/IEC-61162-1-2024.pdf
- 61162-2:2024 — https://cdn.standards.iteh.ai/samples/108135/66a817295ba14eb98cac51bf544ff613/IEC-61162-2-2024.pdf
- 61162-450:2011+AMD1 — https://cdn.standards.iteh.ai/samples/16550/3897f00a33a442e19ebd8bc9b54ebc92/IEC-61162-450-2011.pdf
- 61162-450 Ed.2 önsöz — http://www.normservis.cz/download/view/iec/info_iec61162-450%7Bed2.0%7Den.pdf
- 61162-460 Ed.1 — http://www.normservis.cz/download/view/iec/info_iec61162-460%7Bed1.0%7Den.pdf

---

## Girdi sözleşmesi

**TEK bir UDP payload'ı** — `coap.ts`/`sacn.ts`/`artnet.ts` emsali.
`sacn.ts` dosya başı bunu birebir yazıyor:
> *"── GİRDİ: TEK UDP PAYLOAD'I (coap.ts emsali) ── UDP datagramı mesaj
> sınırının KENDİSİDİR — TCP'nin aksine stream birleştirme YOK."*

**UDP/IP başlığı parser'a GİRMEZ.** Bunun bir sonucu var ve önemli:
**multicast grubu (dolayısıyla veri kategorisi) payload'da YOKTUR** —
`transmissionGroup` seçeneği bu yüzden var (aşağıda).

---

## `UdPbC` teli — bayt bayt

**Altı baytlık sihirli önek: `55 64 50 62 43 00` = `"UdPbC"` + NUL.**

**BEŞ bağımsız uygulama, dosya:satır** `[KANIT]`:

| Uygulama | Satır |
|---|---|
| `fkie-cad/maritime-dissector` (Fraunhofer FKIE, Wireshark Lua) | `maritime-modules/heuristic.lua:85-88` — `if potential_proto_token ~= "UdPbC" then return false end`; `maritime-modules/proto/iec61162450nmea.lua:27-33` — `sub_buffer = buffer(6,-1); offset_shift = 6` (yorum: *"remove token from buffer. Necessary since :string() stops at \0 bytes"*) |
| `ipal-ids/ipal_transcriber` | `transcribers/iec450.py:13` — `if raw[:6] != b"UdPbC\x00" or raw[-2:] != b"\r\n":` |
| `72025003-sketch/PyLWE` | `src/pylwe/parser.py:60-63`; `generator.py:54` — `f"UdPbC\x00{tag_str}{sentence_str}\r\n"` |
| `munnik/gosk` | `writer/lwe.go:158` |
| `ErnadS/EsDemo` | `common_library/udp/udp_61162_450.cpp:93,118-120` |

```
IEC 61162-450 "UdPbC" datagramı  (dst 239.192.0.g : 6000g, ≤ 1472 bayt)
┌──────────────────┬─────┬────────────────────────┬─────┬──────────────────────┬──────┐
│ 'U''d''P''b''C'  │ NUL │ \ TAG block(s) *hh \   │ ... │ $/! NMEA cümlesi *hh │ CRLF │
│ 55 64 50 62 43   │ 00  │ 5c … 2a hh hh 5c       │     │ 24/21 … 2a hh hh     │ 0d0a │
│ ofs 0..4         │  5  │ ofs 6..                │     │                      │      │
└──────────────────┴─────┴────────────────────────┴─────┴──────────────────────┴──────┘
   0..n TAG bloğu, her biri ≤80 B   ·   1..n cümle aynı datagramı paylaşabilir
```

### Gerçek yakalama — `maritime-dissector/tests/iec-61162-450-nmea.pcap`, 40 bayt

```
55 64 50 62 43 00                                    "UdPbC" NUL
5c 73 3a 48 45 30 30 30 31 2a 34 35 5c               "\s:HE0001*45\"
24 48 45 52 4f 54 2c 2b 30 30 30 2e 30 35 2c 41 2a 33 35   "$HEROT,+000.05,A*35"
0d 0a                                                 CRLF
```
İki checksum da bağımsız yeniden hesaplandı ve tutuyor:
`XOR("s:HE0001") = 0x45` · `XOR("HEROT,+000.05,A") = 0x35`.

**Çoklu-TAG** (`…-multitag.pcap`, 53 B):
`UdPbC\0` `\d:HE0002*51\` `\s:HE0001*45\` `$HEROT,+000.05,A*35\r\n`

**Çoklu-cümle** (`…-multisentence.pcap`, 568 B, **8 cümle**):
`UdPbC\0\s:IN0001,n:881,c:1683881316755*4D\$INGLL,5416.4774,N,01201.8283,E,084836.75,A,A*7F\r\n\s:IN0001,n:882,…`

**Bu üç yakalama doğrudan `exampleFrames` olur.**

---

## TUZAK 1 — AYNI DATAGRAMDA İKİ CHECKSUM, FARKLI BAYT ARALIKLARI

**Bu alt dalganın en incelikli noktasıdır ve klasik bir sessiz-yanlış
kaynağıdır.**

| Checksum | Kapsadığı | Sınırlayıcılar |
|---|---|---|
| **TAG block** `*45` | `\` ile `*` ARASINDAKİ karakterler (`s:HE0001`) | `\` … `*` |
| **Cümle** `*35` | `$` ile `*` ARASINDAKİ karakterler (`HEROT,+000.05,A`) | `$` … `*` |

**Algoritma AYNI** (NMEA XOR), **kapsam FARKLI**. İkisini tek bir fonksiyonla
"cümleyi bul, checksum'ını doğrula" diye çözmeye çalışmak TAG bloğunu ya
atlar ya yanlış aralıkta hesaplar.

Üç bağımsız uygulama TAG aralığını ayrı hesaplıyor `[KANIT]`:
`maritime-dissector/maritime-modules/checksumcalculator.lua:22-28` ·
`PyLWE/src/pylwe/parser.py:19-30` · `gosk/writer/lwe.go:187-191`.

### Depo tarafındaki çözüm — `ais.ts` emsali BİREBİR

`nmeaChecksum.ts` üç şey veriyor:
- `nmeaXorChecksum(payload: string): number` (`:14`) — **algoritma**,
  sınırlayıcıdan bağımsız
- `formatNmeaChecksum(n): string` — 2 haneli BÜYÜK hex
- `parseNmeaSentence(sentence)` — **`$` başlangıcını SABİT varsayar**

`ais.ts:10-20` bu tam durumu yaşamış ve çözümünü yazmış `[KANIT]`:
> *"checksum ALGORİTMASI `nmeaChecksum.ts`teki `nmeaXorChecksum`/
> `formatNmeaChecksum` ile hesaplanır… Yalnız cümle sınırlayıcılarını bulan
> küçük fonksiyon (`splitAisSentence`) burada YENİDEN yazıldı, çünkü
> `parseNmeaSentence` (nmeaChecksum.ts) `$` başlangıcını SABİT varsayıyor —
> AIS taşıma cümlesi IEC 61162'nin `!` ile başlayan 'encapsulation sentence'
> alt kümesindendir."*

**Karar:**
- `nmeaXorChecksum` + `formatNmeaChecksum` **DOĞRUDAN import edilir**
  (`xcpPacket.ts` sınıfı paylaşım).
- `parseNmeaSentence` **KULLANILMAZ.** İki küçük yerel bölücü yazılır:
  `splitTagBlock` (`\`…`*`…`\`) ve `splitLwePayloadSentence` (`$` VEYA `!`
  ile başlar — **`!` de kabul edilir**, `ais.ts`in gerekçesi burada da geçerli
  ve bu datagramlar AIS taşır).
- `nmeaChecksum.ts`e **DOKUNULMAZ** — dört tüketicisi var
  (`nmea0183.ts`, `ais.ts`, `algorithmCatalogue.ts:19`,
  `CrcCalculatorTool.tsx:38`), imzasını değiştirmek hepsini riske atar.

---

## TAG block — parametre sözlüğü

En iyi kamu referansı gpsd `www/AIVDM.adoc:4862-4920`
(https://gitlab.com/gpsd/gpsd/-/blob/master/www/AIVDM.adoc), birebir:
> *"The general format of a tag block is: an opening backslash, followed by
> multiple comma-separated fields none of which may contain backslashes,
> followed by an asterisk and NMEA checksum, followed by a closing backslash."*

gpsd'nin örneği:
`\g:1-2-73874,n:157036,s:r003669945,c:1241544035*4A\!AIVDM,1,1,,B,15N4cJ`005Jrek0H@9n`DW5608EP,0*13`

| Harf | Tip | Anlam |
|---|---|---|
| `s:` | string | **source / station (SFI) — ZORUNLU** (`PyLWE/src/pylwe/generator.py:25-26`) |
| `n:` | int>0 | line count |
| `g:` | `sentence-total-groupid` | cümle gruplama — *"The first number is the sentence number, the second is total number of sentences to make up one group. The third number is an identifier for that particular group."* |
| `c:` | int>0 | UNIX zamanı (**saniye VEYA milisaniye**) |
| `d:` | string ≤15 | destination |
| `r:` | int>0 | göreli zaman |
| `t:` / `i:` | string ≤15 | metin |
| `a:` | — | authentication — **-450 Ed.2'de eklendi**, biçim KAMUYA AÇIK DEĞİL |

Standardın kendi tanımı (61162-450 önizleme, madde 3.25): *"transport annotate
and group / TAG / formatted block of data, defined in NMEA 0183, that adds
parameters to IEC 61162-1 sentences."* Ayrıca madde 3.24: *"transmission group
= a pair of a multicast address and a port number"*; madde 3.5: *"datagram =
one atomic UDP transmission unit"*.

### TUZAK 2 — `c:` saniye mi milisaniye mi, ÇERÇEVEDEN ANLAŞILMAZ

Gerçek yakalamada `c:1683881316755` — 13 hane, milisaniye. Ama gpsd'nin
örneğinde `c:1241544035` — 10 hane, saniye. **Aynı parametre, iki ölçek.**

**Karar:** ham değer basılır; **birim ATANMAZ** eğer hane sayısı ayrım
vermiyorsa. 10 hane → `s`, 13 hane → `ms` çıkarımı yapılır ve
`timestampScaleInferred` uyarısıyla işaretlenir. `types.ts:46`nın *"`unit`
yalnız gerçek fiziksel değere"* kuralı: çıkarılmış bir ölçek gerçek bir ölçüm
değildir.

---

## Multicast grubu — TAM tablo, ve neden payload'da OLMADIĞI

**Üç bağımsız kaynak bayt bayt örtüşüyor** `[KANIT]`:

| Grup | Adres | Port | | Grup | Adres | Port |
|---|---|---|---|---|---|---|
| MISC | 239.192.0.1 | 60001 | | VDRD | 239.192.0.5 | 60005 |
| TGTD | 239.192.0.2 | 60002 | | RCOM | 239.192.0.6 | 60006 |
| SATD | 239.192.0.3 | 60003 | | TIME | 239.192.0.7 | 60007 |
| NAVD | 239.192.0.4 | 60004 | | PROP | 239.192.0.8 | 60008 |
| | | | | USR1–USR8 | 239.192.0.9 – .16 | 60009 – 60016 |

Kaynaklar: Cobham SAILOR 6280 Kurulum Kılavuzu **Tablo B-1 "Destination
multicast addresses and port numbers"**
(https://www.manualslib.com/manual/1326622/Cobham-Sailor-6280.html?page=93 —
standardın Tablo 4'ünü birebir aktarıyor) · `gosk/writer/lwe.go:14-45`
(+ `:48-114`te 60 girişlik talker-ID→grup eşlemesi) ·
`codekilo/nmea0183-iec61121-450-server/transmissiongroups.json:1-82` ·
`EsDemo/common_library/udp/udp_61162_450.cpp:7,64,76,78`
(`udpIp = "239.192.0." + (nGroupIndex+1); udpPort = 60001 + nGroupIndex`).

`239.192.0.0/14` IANA "Organization-Local Scope"tur (RFC 2365).

**Bu tablo payload'da YOKTUR — UDP/IP başlığındadır.** Motor UDP payload'ı
aldığı için grubu BİLEMEZ. Bu, `mil-std-1553`ün *"sözcük tipi çerçevede
YOK"* (15g) ve `io-link`in `messageSide` (13h) bulgularının aynı sınıfıdır.

→ `transmissionGroup` seçeneği (varsayılan **`unknown`**). Seçilirse grup adı
ve anlamsal kategori (ör. VDRD = *"Data required for the VDR according to
IEC 61996"*) basılır **ve KOŞULSUZ bir `groupFromUserNotWire` uyarısı
eklenir.** Seçilmezse **grup alanı HİÇ BASILMAZ** — `mode-s`in DF'e göre CRC
alanını hiç basmaması (15h) emsali.

### `[KAYNAK ANOMALİSİ — dosya başına yazılır]`

FKIE'nin gerçek `…-multisentence.pcap` yakalaması
`192.168.31.1:43339 → 239.192.0.4:**60104**` hedefliyor — **doğru NAVD grubu
ama port 60004 değil, 60104.** Vendor sapması mı testbed konvansiyonu mu
çözülemedi. **Sonuç: motor porta GÜVENMEZ**; grup bilgisi yalnız kullanıcı
seçiminden gelir.

### `[COULD NOT VERIFY]` — brife girmeyecek iddialar

Kaynak turu şu üç yaygın iddiayı **çürüttü**, dosya başına uyarı olarak
yazılır ki ileride yeniden "keşfedilmesin":
- **Port 60101 — HİÇBİR yerde kanıt yok, YANLIŞ kabul et.** (Muhtemelen
  yukarıdaki 60104 anomalisinin folkloru.)
- **60011–60014 ayrı bir aralık DEĞİL** — Tablo 4'te USR3–USR6.
- **`239.192.76.x` — sıfır bulgu, muhtemelen yanlış.**
- **"239.192.0.5-8 -460 içindir" — YANLIŞ**; onlar -450'nin
  VDRD/RCOM/TIME/PROP'u. -460 kendi adresi TANIMLAMAZ.
- **`UdPbB` diye bir token YOKTUR** — GitHub geneli kod aramasında sıfır
  sonuç. Tek `UdPb*` token'ı `UdPbC`dir.

---

## Datagram boyutu — 1472 bayt

Standardın **kendi yazarlarından** (Rødseth, Christensen & Lee — IEC TC80/WG6),
ISIS 2011 §5.3, birebir
(https://web.archive.org/web/2018id_/http://www.mits-forum.org/resources/lwe-paper-isis-v9.pdf):
> *"The message length is limited to **1472 bytes** (the maximum size of the
> UDP payload in a single Ethernet frame) to avoid potential problems with
> incorrect fragmentation and assembly of IP multicast messages."*

Standardın maddesi: `6.2.4 Datagram size` (üç sürümde de).

→ `maxDatagramBytes` seçeneği, varsayılan `1472`. Aşılırsa
`datagramExceedsStandardLimit` uyarısı (hata DEĞİL — motor yine çözer).

---

## `R?UdP` — ikinci, TAMAMEN AYRI tel

`-450`nin ikinci alt protokolü: **binary dosya transferi.**
Token üçlüsü `[KANIT]` `maritime-dissector/maritime-modules/heuristic.lua:109`:
```lua
local tokens = {"RaUdP", "RpUdP", "RrUdP"}
```
Düzen `[KANIT]` `proto/iec61162450binary.lua:62-72` — **tüm çok-baytlı alanlar
BIG-ENDIAN**:
```
 0..5  token (6B ASCII + NUL)      6..7  version u16       8..9  headerLength u16 (=38)
10..15 srcId (6B ASCII)           16..21 destId (6B ASCII, "XXXXXX" = belirsiz)
22..23 msgType u16 (1=data 2=query 3=ack)   24..27 blockId u32
28..31 seqNum u32                 32..35 maxSeqNum u32     36 device u8   37 channel u8
38..   payload
       (msgType==1 && seqNum==1 ise Binary File Descriptor ile başlar:
        u32 fdLength, u32 fileLength, u16 statusOfAcq, u16 ackDestPort,
        u8 typeLength, MIME string, u16 statusLength, status text)
```
Gerçek yakalamayla (`tests/iec-61162-450-binary-type1.pcap`) her alan
doğrulandı: version=2, headerLength=38, src=`EI0001`, dst=`VR0001`, msgType=1,
blockId=513, seq=1/2, fdLength=31, fileLength=1492, ackDestPort=60006,
dataType=`text/plain\0`, status=`TEST\0`.

### [DUR-SOR / TAVSİYE] Bu dalgada YAZILMASIN — ana brif açık soru 2

**Öneri: HAYIR.** Gerekçe **15h'in [Karar 15h-1]'inin birebir aynısı**:
*"domain'i kapatan alt dalgada opsiyonel bir motor riski artırır; kayıt onsuz
da `partial` kapanır."*

Ek gerekçeler:
- `RaUdP`/`RpUdP`/`RrUdP` arasındaki **anlam farkı kamuya açık değil** (FKIE
  yalnız *"message type and transfer mode"* diyor ve yakalamaları sadece
  `RrUdP` içeriyor) → üç token'dan ikisi için alan ADLANDIRILAMAZ (dalga 13
  dersi 5).
- Parça birleştirme (`seqNum`/`maxSeqNum`) **çerçeveler arası durumdur** ve
  parser'a girmez (ana brif bulgu 12) — motor tek datagramı çözer, dosyayı
  KURAMAZ. Bu, kaydın vaadini yarım bırakır.

**Yapılmazsa:** sayfa metni ikinci teli, `-460`ı ve Ed.2'nin PGN
kapsüllemesini **AÇIKÇA "kapsam dışı"** olarak listeler ve rozet `partial`
olur.

**Yapılırsa:** ayrı modül (`iec61162_450Binary.ts`), ayrı `pluginId` DEĞİL —
aynı kayıt altında `transportProfile` seçeneğinin ikinci şıkkı. Rozet yine
`partial` kalır.

### Ed.2'nin eklediği diğer teller — hepsi kapsam dışı

`-450` Ed.2 önsözü, birebir: *"c) **new encapsulation of IEC 61162-3 PGNs
added**; d) **new alternative for binary file transfer added: TCP/IP** based on
Annex H of IEC 62388:2007 on radars; e) general authentication tag **"a:"**
added."*

- **PGN kapsüllemesi (§7.4, Tablo 13-14):** var olduğu doğrulandı, **5
  karakterlik token bilinmiyor**, kamuya açık uygulama YOK → kapsam dışı.
- **TCP tabanlı dosya transferi (§7.6):** ayrı taşıyıcı, kapsam dışı.
- **`a:` authentication tag:** varlığı doğrulandı, **biçimi kamuya açık
  değil** → TAG block çözücüsü onu TANIR ama içeriğini ÇÖZMEZ
  (`authTagNotDecoded` uyarısı). **Yeni kripto yüzeyi AÇILMAZ** — bu bir
  DUR-SOR sınıfıdır ve burada peşinen "açılmıyor" kararı veriliyor.

---

## Gömülü cümle — `nmeaSentences.ts` TÜKETİLİR

`nmea0183.ts:1-8` ayrımı yazıyor `[KANIT]`:
> *"Cümle çözümü BURADA YOKTUR; alan alan semantik/generic çözüm
> `nmeaSentences.ts`te tek yerde yaşar (modbusPdu.ts/modbusRtu.ts ayrımının
> karşılığı)."*

Dışa açılanlar: `NMEA_SENTENCE_FORMATTERS` (`:64`, **28 formatter** — GGA, RMC,
GSA, GSV, VTG, GLL, ZDA, HDT, HDG, DPT, DBT, MWV, ROT, VHW, VLW, XDR, MTW,
RSA…), `getSentenceInfo`, `splitPayloadTokens`, `decodeSentenceFields`
(`:675`), `SentenceDecodeResult` (`:663`).

Ayrıca `nmea0183.ts:57,59`: `NMEA_0183_MIN_SENTENCE_LENGTH = 7`,
`NMEA_0183_MAX_SENTENCE_LENGTH = 82`.

**Karar:** `sentenceDecoding` seçeneği:
- **`envelope-only` (VARSAYILAN):** cümle tek bir `Sentence` alanı olarak ham
  basılır, checksum'ı doğrulanır, talker/formatter ayrılır.
- **`full`:** `decodeSentenceFields` çağrılır ve cümle alan alan çözülür.

Neden `envelope-only` varsayılan: bu sayfanın konusu **-450 taşımasıdır**,
cümle içeriği değil — cümlenin kendisi zaten `nmea-0183` sayfasında tam
çözülüyor. `modbusPdu`/`modbusRtu` ayrımının aynı mantığı.

**`nmea0183Parser.parse()` ÇAĞRILMAZ** — o kendi `ParseResult`unu üretiyor
(`nmea0183.ts:304,308`) ve bu motorun alan tablosuna gömülemez.
`cipCore.ts`/`xcpPacket.ts`in *"kendi `ParseResult`unu ÜRETMEZ, `fields`
dizisine yazar"* deseni burada `decodeSentenceFields` üzerinden sağlanır —
o zaten alan üreten bir yardımcıdır.

### TUZAK 3 — 82 karakter sınırı DATAGRAM'A DEĞİL, CÜMLEYE aittir

`NMEA_0183_MAX_SENTENCE_LENGTH = 82` **tek bir cümle** içindir. Bir -450
datagramı **8 cümle** taşıyabiliyor (gerçek yakalama, 568 bayt). Sınırı
datagrama uygulamak geçerli trafiği reddeder.

### TUZAK 4 — çoklu cümle DÜZ alan tablosuna nasıl sığar

`ParsedFrame` DÜZDÜR, `children` YOKTUR (kilitli sözleşme). 8 cümlelik bir
datagram için hiyerarşi **alan ADLARIYLA** kurulur — 12g'nin RTCP çözümü:
```
Magic Token
TAG 1 · Source          TAG 1 · Line Count      TAG 1 · Checksum
Sentence 1 · Talker     Sentence 1 · Formatter  Sentence 1 · Checksum
TAG 2 · Source          …
Sentence 2 · Talker     …
```
**`ParsedField.id` KENDİ offset'ini kullanır** — 8 cümlenin alanları aynı
id'yi paylaşamaz; id'ye **sıra numarası** girer (`sentence-3-talker`), offset
değil (`ftp.ts`/`rtcp.ts` vakaları).

---

## Yönlendirme görünümü — `-1`/`-2`/`-3`/`-460`

`transportProfile` seçeneği `450-udpbc` DIŞINDA bir şık seçilirse motor
**çerçeve ÇÖZMEZ**; bunun yerine `uavcanCompatibility.ts`in aday tablosu
biçiminde bir **yönlendirme tablosu** basar:

| Profil | Basılan |
|---|---|
| `-1` | Encoding: Printable ASCII · Talker: Single · Listeners: Multiple · Varsayılan hız: 4800 bit/s (Ed.6'da yapılandırılabilir) · **Çözücü: `marine-navigation/nmea-family/nmea-0183`** |
| `-2` | aynı cümle biçimi · Varsayılan hız: **38400 bit/s** · Elektriksel: RS-422 (ITU-T V.11) · **Çözücü: `nmea-0183`** · not: *"Ed.2 veri biçimi maddesini SİLDİ, -1'e devretti"* |
| `-3` | CAN tabanlı · **Çözücü: `marine-navigation/nmea-family/nmea-2000`** |
| `-460` | Yeni uygulama protokolü TANIMLAMAZ · Node sınıfları (450-Node, 460-Node/Switch/Forwarder/Gateway/Wireless gateway) · CoS/DSCP önceliklendirme · **Çözücü: -450 ile aynı** |

Bu, katalogun `Transport Profile`, `IEC 61162-1/-2/-3/-450/-460`,
`Profile Comparison`, `Encoding / Talker / Listener Model` araçlarının
(`marine-navigation.ts:136-149`) doğrudan karşılığıdır.

**Emsal:** `uavcanCompatibility.ts:13-17` — *"kullanıcıyı kaydı gerçekten
çözen sayfaya yönlendirir (`ipv4.ts`in 'üst katmanı şu sayfada çöz' deseninin
aynısı)"*. Katalogda `related` zaten `nmea-0183` ve `nmea-2000`e bakıyor
(`:152-155`).

**Yönlendirme profillerinde `canParse` yine `false` dönmez** — `canParse`
seçenekten bağımsızdır ve **her zaman `UdPbC` önekine bakar** (`ProtocolParser`
sözleşmesinde `canParse` `decodeOptions` almaz).

---

## `canParse` — `true`, ve yanlış pozitifi ÖLÇÜLDÜ

```ts
canParse(data: Uint8Array): boolean {
  // "UdPbC\0" — altı bayt, sabit
  return data.length >= 6 &&
    data[0] === 0x55 && data[1] === 0x64 && data[2] === 0x50 &&
    data[3] === 0x62 && data[4] === 0x43 && data[5] === 0x00;
}
```

**Ölçüldü** (ana brif bulgu 10; 140 kayıt / 870 örnek çerçeve):
**0 çakışma.** Altı baytlık sabit önek deponun en temiz imzasıdır.

**Bekçi testi yine ZORUNLU** (15f/15g/15h disiplini):
`src/protocols/marine/iec61162/iec61162CanParseRegistry.test.ts`
Kanıtlayacakları:
1. `iec-61162` DIŞINDAKİ hiçbir örnek çerçeve `canParse`ı geçmez.
2. Kendi `exampleFrames`i **hepsi** `true` döner (imza aşırı daraltılmadı).
3. `totalExamples > 800` sağlık kontrolü.

---

## `decodeOptions` — BEŞ kanal

| Seçenek | Şıklar | Neden | Emsal |
|---|---|---|---|
| `transportProfile` | `450-udpbc` (vars.) · `61162-1` · `61162-2` · `61162-3` · `61162-460` | Beş profilden yalnız biri çözülüyor; diğerleri yönlendirme görünümü | `cyphal` `transport` (15b) |
| `transmissionGroup` | `unknown` (vars.) · MISC · TGTD · SATD · NAVD · VDRD · RCOM · TIME · PROP · USR1-8 | **Grup payload'da YOK, UDP başlığında** | `mil-std-1553` `wordType` (15g) |
| `sentenceDecoding` | `envelope-only` (vars.) · `full` | Cümle içeriği bu sayfanın konusu değil | `modbusPdu`/`modbusRtu` |
| `requireTagBlock` | `true` (vars.) · `false` | Standart `s:`i ZORUNLU kılıyor, uygulamalar sapıyor | `ppp.ts` ACFC varsayımı |
| `maxDatagramBytes` | `1472` (vars.) | Standardın yazarlarının kendi sınırı | `hdlc` `maxFrameLength` |

**Dalga 15'in dersi gereği bu sayının BÜYÜMESİ beklenir.** Görünen adaylar
(uygulamada çıkarsa eklenir ve brif işaretlenir): `timestampScale`
(`c:`in ölçeğini elle zorlama), `trailingCrlfRequired`
(`ipal_transcriber` şart koşuyor, FKIE koşmuyor), `sentenceStartChars`
(`$` yanında `!` kabulü).

---

## Beklenen rozet: `partial` — `[DUR-SOR]` (ana brif açık soru 1)

**Çözülen:** `UdPbC` sihirli öneki · 0..n TAG bloğu, her biri kendi
checksum'ıyla doğrulanmış · `s:`/`n:`/`g:`/`c:`/`d:`/`r:`/`t:` parametreleri ·
1..n cümle, her biri kendi checksum'ıyla · CRLF sonlandırıcı · 1472 sınırı ·
`-1`/`-2`/`-3`/`-460` için yönlendirme görünümü.

**Çözülmeyen ve AÇIKÇA "kapsam dışı" yazılan:**
- **`RaUdP`/`RpUdP`/`RrUdP` binary dosya transferi** (ayrı tel)
- **Ed.2 §7.4 IEC 61162-3 PGN kapsüllemesi** (token bilinmiyor)
- **Ed.2 §7.6 TCP tabanlı transfer** (ayrı taşıyıcı)
- **`a:` authentication tag içeriği** (biçim kamuya açık değil)
- Standart Tablo 5/6'nın hücre değerleri (paywall)

Emsal: `ads-b` 1090ES-only, `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only,
`foundation-fieldbus` HSE-only, `cyphal` Cyphal/CAN-only.

---

## Uygulama görevleri

1. **Kaynak turu** — FKIE `maritime-dissector`ın üç `.pcap`ini ve
   `iec61162450nmea.lua` + `checksumcalculator.lua` dosyalarını AÇ.
   **Özellikle doğrula:** (a) altı baytlık önekin NUL dahil olduğu,
   (b) TAG checksum'ının `\` ile `*` arasını kapsadığı, (c) çoklu-TAG ve
   çoklu-cümle sıralaması, (d) CRLF'in zorunluluğu. `PyLWE/src/pylwe/parser.py`
   ile ÇAPRAZLA.
2. **[DUR-SOR] Rozet kararını al** (ana brif açık soru 1) ve `R?UdP`
   tavsiyesini onayla (açık soru 2). Kararsız kod YAZILMAZ.
3. **`src/protocols/marine/iec61162/iec61162.ts`** — dosya başı ZORUNLU:
   - **Neden bu kayıt `uavcan-compatibility` DEĞİL** — `-450`nin gerçek teli
     var, `canParse` `true` döner, ve keşif hipotezinin nasıl çürüdüğü.
   - **İki checksum'ın FARKLI aralıkları** ve `parseNmeaSentence`in neden
     kullanılamadığı (`ais.ts:10-20` emsali).
   - Multicast tablosunun payload'da OLMADIĞI ve `transmissionGroup`un
     ne çözdüğü.
   - **Port anomalisi** (60104) ve çürütülen dört iddia (60101, 60011-14,
     239.192.76.x, "-460'ın adresleri").
   - `R?UdP`, Ed.2 PGN kapsüllemesi, TCP transferi ve `a:` içeriğinin neden
     kapsam dışı olduğu.
   - 82 karakter sınırının CÜMLEYE ait olduğu.
   - `c:`in ölçeğinin çıkarım olduğu.
4. **`src/protocols/marine/iec61162/lweTagBlock.ts`** — TAG bloğu bölücü ve
   parametre sözlüğü ayrı modülde (`nmeaSentences.ts`in `nmea0183.ts`ten
   ayrılma gerekçesi). `nmeaXorChecksum`/`formatNmeaChecksum` **import
   edilir**, yeniden yazılmaz.
5. **Katalog** — `iec-61162` `status` `'planned'` → `'partial'`
   (`marine-navigation.ts:133`), `pluginId: 'iec-61162'` eklenir.
   `summary` (`:130-131`) çözülenle çözülmeyeni AÇIKÇA yazacak biçimde
   güncellenir. `tabs`a dokunulmaz — `'build'` yok, `encoder` YAZILMAZ;
   `'definitions'` de yok, panel sorusu HİÇ doğmuyor.
   **Dosya başındaki domain yorumu (`:1-24`) güncellenir** — orada
   *"IEC 61162'nin beş alt varyantı … ayrı protokol kaydı değil: tek kayıtta
   `tools` içinde transport profili olarak geçiyor"* yazıyor ve bu **hâlâ
   doğru**, ama artık `-450`nin gerçek bir çözücüsü olduğu eklenir.
6. **Registry** — `registerOnce(registry, 'iec-61162', …)`. 142 → **143**.
7. **Çeviri** — `en.ts` + `tr.ts`. Grup adları (MISC/TGTD/…) ve TAG parametre
   harfleri **VERİDİR, çeviriye girmez**; kategorilerin açıklamaları
   (*"Data required for the VDR…"*) çeviriye GİRER. `mode-s` 42 anahtar
   kullanmıştı; burada **~35-45** beklenir.
8. **Test** — `iec61162.test.ts`:
   - Üç gerçek yakalama (tek cümle / çoklu TAG / 8 cümle) alan alan.
   - **İki checksum'ın farklı aralıkları ayrı testle** — TAG checksum'ı
     bozulunca TAG FAIL / cümle PASS, ve tersi.
   - TAG bloğu HİÇ yoksa (`requireTagBlock: false`) çözüm devam ediyor.
   - `c:` 10 hane → `s`, 13 hane → `ms`, ikisinde de
     `timestampScaleInferred` uyarısı.
   - `transmissionGroup: 'unknown'` (varsayılan) → grup alanı **HİÇ
     BASILMIYOR**; seçilince basılıyor + `groupFromUserNotWire` uyarısı.
   - `transportProfile` yönlendirme şıkları → çerçeve çözülmüyor, yönlendirme
     tablosu basılıyor.
   - `sentenceDecoding: 'full'` → `decodeSentenceFields` alanları geliyor.
   - 1472'yi aşan datagram → uyarı, hata DEĞİL.
   - **8 cümlelik datagramda `ParsedField.id`lerin BENZERSİZ olduğu.**
   - Bozuk önek (`UdPbB`, `UdPbC` ama NUL yok) → `success: false`.
   `lweTagBlock.test.ts`: parametre sözlüğü, checksum aralığı, ≤80 bayt sınırı.
9. **Bekçi** — `iec61162CanParseRegistry.test.ts` (yukarıda, üç iddia).
10. **e2e** — `e2e/iec-61162-decode.spec.ts`. Kanıtlanacak: sayfa **Kısmi**
    rozetiyle açılıyor · özet kapsam dışını AÇIKÇA yazıyor · varsayılan örnek
    ilk render'da girdide · TAG ve cümle checksum'ları AYRI AYRI PASS
    görünüyor · `transportProfile` `-1`e çevrilince yönlendirme tablosu ve
    `nmea-0183` bağlantısı görünüyor · `transmissionGroup` seçilince uyarı
    beliriyor · konsola hata yok · 1440/390'da taşma yok.

---

## Devralınan tuzaklar

- **`nmeaChecksum.ts`e DOKUNULMAZ** — dört tüketicisi var
  (`nmea0183.ts:38-40`, `ais.ts:102`, `algorithmCatalogue.ts:19`,
  `CrcCalculatorTool.tsx:38`).
- **`parseNmeaSentence` KULLANILMAZ** — `$` başlangıcını sabit varsayıyor
  (`ais.ts:10-20` emsali).
- **`nmea0183Parser.parse()` ÇAĞRILMAZ** — kendi `ParseResult`unu üretir.
- **İki checksum, İKİ FARKLI aralık.** Tek fonksiyonla çözülmez.
- **82 karakter sınırı CÜMLEYE aittir**, datagrama değil.
- **Multicast grubu payload'da YOK** — seçilmezse alan HİÇ BASILMAZ.
- **Port bilgisine GÜVENİLMEZ** (60104 anomalisi).
- **`60101`, `239.192.76.x`, "-460'ın adresleri" YANLIŞTIR** — yeniden
  keşfedilmesin diye dosya başında yazılı.
- **`UdPbB` diye bir token YOKTUR.**
- **`a:` authentication içeriği ÇÖZÜLMEZ** — yeni kripto yüzeyi AÇILMAZ.
- **Parça birleştirme (`R?UdP` `seqNum`) çerçeveler arasıdır**, parser'a
  girmez (`mavlink.ts`in SEQ-LOSS kararı).
- **`ParsedField.id` 8 cümlede BENZERSİZ olmalı** — id'ye sıra numarası girer.
- **`ParsedFrame` DÜZ, `children` YOK.** Hiyerarşi alan ADLARIYLA.
- **`unit` yalnız gerçek fiziksel değere** — TAG sayacı, grup numarası,
  blockId BİRİMSİZ; çıkarılmış zaman ölçeği de birim ALMAZ.
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings`
  `ProtocolWarning[]`.
- **`'build'` sekmesi YOK → `encoder` YAZILMAZ.**
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **16a'nın Görev 0'ı bitmiş olmalı** — `e2e/nmea-decode.spec.ts` bu kayda
  bağlıydı.
- **`CrcCalculatorTool.test.tsx`e DOKUNMA** — bu dalga CRC eklemiyor, 37 kalır.

---

## Model/effort önerisi

**Opus · high.**

**Model = Opus:** dört ayrı sessiz-yanlış noktası ve biri depoda emsalsiz.
1. **Aynı datagramda iki checksum, iki farklı bayt aralığı** — tek fonksiyonla
   çözme cazibesi yüksek ve yanlış aralık hata VERMEDEN yanlış PASS/FAIL basar.
2. **Kaydın kimliği keşifte DEĞİŞTİ** (sınıflandırıcı → gerçek parser); brif
   bunu yazıyor ama uygulayan modelin "hangi kısmı çözülür, hangisi
   yönlendirilir" sınırını doğru çizmesi gerekiyor ve bu sınır rozeti
   belirliyor.
3. **Grup bilgisinin payload'da olmaması** görünmez bir değişmez —
   `transmissionGroup` yanlış tasarlanırsa sayfa ölçülmemiş bir bilgiyi
   ölçülmüş gibi gösterir.
4. **Çoklu cümlenin düz alan tablosuna oturtulması** — `ParsedField.id`
   çakışması jsdom testinde bile sessiz kalabilir.

Üstelik **domain'i kapatan alt dalgadır** ve hata maliyeti artmıştır.

**Effort = high (`xhigh`/`max` DEĞİL):** kaynak kesin, bayt düzeni beş
uygulamada birebir, gerçek yakalamalar elde. Belirsizlik **kapsamda**, problemin
tanımında değil — `max` "problemi tarif etmek bile zor" durumu içindir ve
burada problem tam tarifli. `xhigh` geri dönüşü pahalı bir ödünleşim
gerektirir; burada `protocol-core/types.ts`e dokunulmuyor, yeni bir paylaşılan
çekirdek doğmuyor, katalog CRC sayısı değişmiyor.

**Tamamlanma ölçütü:** `nmea-family` ailesinde `planned` kayıt KALMIYOR **ve
`marine-navigation` domain'inde `planned` KALMIYOR** (3 kanonik kayıt kapandı,
deponun borcu 8 → 5); `iec-61162` **Kısmi** rozetiyle açılıyor ve kapsam
dışı teller sayfada AÇIKÇA listeleniyor; üç gerçek FKIE yakalaması alan alan
çözülüyor; **TAG ve cümle checksum'ları AYRI AYRI doğrulanıyor ve bozulunca
birbirini etkilemiyor**; `transmissionGroup` seçilmezse grup alanı HİÇ
basılmıyor, seçilince koşulsuz uyarı basıyor; yönlendirme profilleri çerçeve
çözmüyor, tablo basıyor; 8 cümlelik datagramda `ParsedField.id`ler benzersiz;
`iec61162CanParseRegistry.test.ts` yeşil ve **sıfır yanlış pozitif**
ölçüyor; **`crcCatalogue.ts` ve `nmeaChecksum.ts` DEĞİŞMEDİ**;
birim + e2e + build yeşil.

**KAYIT KAYIT bitir:** kaynak turu → DUR-SOR kararı → `lweTagBlock.ts` →
`iec61162.ts` → yönlendirme görünümü → çeviri → test → bekçi → e2e.

---

## Dalga kapanışı — bu alt dalga bitince yapılacaklar

1. **`CLAUDE.md` "Bilinen borçlar"** güncellenir: `marine-navigation` TAMAMEN
   KAPANDI (16a hdlc-based-marine + 16b seatalk + 16c iec-61162 — 3 alt dalga,
   3 kanonik kayıt, 1 `ready` + 2 `partial`); domain toplamı **6 `ready` +
   2 `partial` + 3 alias**, `planned` KALMADI; kalan kanonik borç **5**
   (wireless-iot 4, building-automation 1). Ham sayım **KODDAN yeniden
   doğrulanır**.
   Yeni kalıcı dersler yazılır:
   - `hdlcCore.ts` üçüncü tüketicisini aldı — paylaşılan çekirdek deseni
     üçüncü kez kanıtlandı.
   - **Aynı POLİNOM aynı algoritma değildir**: katalogda poly `0x1021` olan
     dört giriş var, yalnız `CRC16_X25` HDLC'dir.
   - **`canParse` yanlış pozitifi BRİF AŞAMASINDA ölçülebilir** ve bu dalgada
     ölçüldü (870 örnek üzerinde 27 / 7 / 6 / 0) — tahmin yerine sayı.
   - **Bir kaydın "kendi teli var mı" sorusu keşifte cevaplanmalı**:
     `iec-61162` sınıflandırıcı sanılıyordu, `-450`nin gerçek teli çıktı.
2. **`docs/plan-fazlar.md`** — dalga 16 kapanış özeti (15'in biçimi emsal) ve
   `:32`deki faz tablosu satırı güncellenir (**altıncı kapanan domain**).
3. **`docs/brief-faz10-dalga16.md`** — "Çürüyen tahminler → Uygulama sırasında
   çürüyenler (16a-16c)" bölümü DOLDURULUR. **Yanlış öngörüler SİLİNMEZ,
   İŞARETLENİR.**
4. **Sıradaki domain seçimi** — iki aday kalıyor (`wireless-iot` 4,
   `building-automation` 1). Seçim gerekçesiyle yazılır.
