# BRİF — Faz 10 dalga 15c, `sbus` + `ibus` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.

Bu alt dalga iki şey doğurur ve 15d ikisini de tüketir:
1. **16 × 11-bit paketli kanal okuyucusu** (ana brif bulgu 5).
2. **Sabit uzunluklu RC çerçeveleri için `canParse` bekçi deseni.**

---

## BULGU 5 — bu alt dalganın TEK büyük teknik kararı

### `BitOrder` = `lsb-first`, ve bu sessizce yanlış çıkabilecek tek şey

`bitCursor.ts:26` iki sıra tanımlar, varsayılanı `msb-first`tir (`:37`, `:52`).
Dosyanın kendi uyarısı (`:22`):

> *"Sıra yanlış seçilirse hata OLUŞMAZ, yalnız değer yanlış çıkar — bu yüzden
> varsayılan açıkça belgelendi."*

**SBUS için doğru sıra `lsb-first`tir.** Kanıt: Betaflight `rx/sbus_channels.h:31-47`

```c
// 176 bits of data (11 bits per channel * 16 channels) = 22 bytes.
unsigned int chan0 : 11;
unsigned int chan1 : 11;
…
unsigned int chan15 : 11;
} __attribute__ ((__packed__));
```

C bitfield'ları little-endian hedefte **LSB-first** paketlenir: `chan0` ilk baytın
en düşük 8 biti + ikinci baytın alt 3 biti; `chan1` ikinci baytın üst 5 biti +
üçüncü baytın alt 6 biti; ve böyle devam eder.

Spec özeti tuzağın **varlığını** uyarıyor ama **yönünü vermiyor**
(`06-havacilik-uav.md:197`):

> *"Channel alanları byte sınırına hizalı değildir — bu yüzden `CH1 = Byte1+Byte2,
> CH2 = Byte3+Byte4` gibi yanlış (byte-aligned) decode yapılmamalıdır; bitstream
> üzerinden 11-bit kaydırmalı okuma gerekir."*

`:538` "Dikkat çekenler"de tekrar edilmiş. **Yön yalnız referans uygulamadan gelir.**

**DOĞRULAMA ZORUNLU — alt dalganın ilk adımı:** elle üretilmiş bir 22 baytlık
diziden beklenen 16 kanal değerini KAĞIT ÜZERİNDE hesapla, `lsb-first` ile oku,
tut. Sonra aynı diziyi `msb-first` ile oku ve **farklı** çıktığını göster — test
sırayı gerçekten sınamalı, yoksa yanlış sırayla da yeşil gelir. `j1850Pulse.ts`in
`packBitsToBytes` testinin aynı disiplini (`j1850Pulse.ts:44-48`).

### Ortak yardımcı — sınır 14g'nin çizdiği yerde

**Paylaşılan:** 22 bayttan 16 × 11 bit `lsb-first` okuma.
**Paylaşılmayan:** değerin ANLAMI.

| | SBUS | CRSF (15d) |
|---|---|---|
| Ham aralık | 173…1812 (`sbus.c:85-86`) | merkez 992 |
| µs dönüşümü | kullanıcı kalibrasyonu (`spec:203`) | `(x−992)×5/8+1500` (`crsf.md:522`) |

**Aynı bitler, farklı ölçek.** `pulseLog.ts`in *"konteyner TAŞINDI, TÜRETİM
TAŞINMADI"* kuralı birebir (`pulseLog.ts:18-24`).

**Konum kararı:** yardımcı **`src/protocol-core/decoding/packedChannels.ts`**
olarak açılır ve YALNIZ okuma yapar:

```ts
readPackedChannels(bytes, offset, channelCount, bitsPerChannel, bitOrder): number[]
```

`bitsPerChannel` parametredir çünkü CRSF'in 0x17 subset çerçevesi 10/11/12/13 bit
kullanabiliyor (`crsf_protocol.h:141-142`). **Ölçek/normalizasyon fonksiyonu bu
dosyaya GİRMEZ** — her protokol kendi dosyasında yapar.

Alternatif: yardımcıyı `sbus.ts`te doğurup 15d'de `protocol-core`a taşımak
(14f→14g'nin `pulseLog` yolu). **Doğrudan `protocol-core`a koymak önerilir**:
14g'nin taşıma turu bir maliyetti ve iki tüketici bu brifte ZATEN biliniyor.
Bu bir DUR-SOR değildir — `protocol-core`a ADDITIVE bir ekleme, `types.ts`e
dokunmuyor (`crcBits`in 14e'deki emsali).

---

## `sbus`

### Girdi sözleşmesi

**HAM 25 baytlık SBUS çerçevesi.** UART taşıyıcısı (100000 baud, 8E2, **inverted**)
parser'a HİÇ girmez — `mavlink.ts`in *"fiziksel taşıyıcı bir bayt akışı değildir,
parser'a hiç girmez"* sınırı birebir. Ters çevirme (inversion) donanım işidir.

### Çerçeve

Kaynak: spec `:193-200` + Betaflight `rx/sbus.c` / `rx/sbus_channels.h`.

```
[0]      Start byte = 0x0F          (SBUS_FRAME_BEGIN_BYTE, sbus.c:71)
[1..22]  22 bayt paketli kanal      (16 × 11 bit, lsb-first)
[23]     Flags
[24]     End byte
```

**Bayraklar** (`sbus_channels.h:25-28` + spec `:200`):

| Bit | Anlam |
|---|---|
| 0 | Digital Channel 17 |
| 1 | Digital Channel 18 |
| 2 | **Frame Lost / Signal Loss** (`SBUS_FLAG_SIGNAL_LOSS = 1<<2`) |
| 3 | **Failsafe Active** (`SBUS_FLAG_FAILSAFE_ACTIVE = 1<<3`) |

Spec `:200` bunu vurguluyor: *"Betaflight'ta signal-loss ve failsafe-active AYRI
bit'lerdir."* Tek bir "RC LINK DEGRADED" göstergesine indirgenmez; iki ayrı alan
basılır ve `diagnostics` ikisini ayrı raporlar.

**End byte değeri sabit VARSAYILMAZ.** Betaflight `endByte` alanını okuyor ama
belirli bir değeri zorlamıyor (`sbus.c` yorumundaki cleanflight tartışması
referansları). Değer HAM basılır; belgelenmiş bir sabit doğrulanmadan
`0x00` beklenmez.

### GÖMÜLMEYECEKLER

- **173/1812 aralığı bir NORMALİZASYON sabitidir, protokol sabiti DEĞİL.**
  Spec `:203`: *"Mapping kullanıcı tarafından kalibre edilmeli; packed raw değerin
  doğrudan PWM mikrosaniye olduğu varsayılmamalıdır."* Katalog yorumu da yazılı
  (`aerospace-uav.ts:226-228`).
  → Kanal alanları **HAM sayı** basar, `unit` **VERİLMEZ**.
- **Roll/Pitch/Throttle/Yaw adları GÖMÜLMEZ.** Spec'in `:203`teki örneği bir
  KULLANICI eşlemesidir. `mavlink.ts`in *"MESSAGE ID ADLANDIRILMAZ"* kararının
  aynısı.
- **Failsafe state machine PARSER'A GİRMEZ** (`spec:409`: NORMAL→…→RECOVERING).
  Çerçeveler arası durum — analyzer işi (`mavlink.ts`in SEQ-LOSS kararı).

### Beklenen rozet: `ready`

Alan yapısının tamamı çözülür ve iki bağımsız kaynak (spec + Betaflight)
örtüşüyor. **Checksum YOK** — doğrulanacak bir bütünlük alanı olmaması `partial`
gerekçesi DEĞİLDİR (protokolde yok, eksik uygulama değil). Bu dosya başında yazılır.

---

## `ibus`

### İKİ MODEL, tek kayıt — `decodeOptions` şart

Betaflight `rx/ibus.c:106-115` iki ayrı model tanıyor ve ikisi **farklı checksum
tohumu** kullanıyor `[KANIT]`:

| Model | Senkron | Çerçeve | Checksum tohumu | Kanal offset |
|---|---|---|---|---|
| **iA6** | ilk bayt `0x55` | 31 bayt | `0x0000` (toplama) | 1 |
| **iA6B** | ilk bayt = UZUNLUK | 32 bayt (`IBUS_SERIAL_RX_PACKET_LENGTH`) | `0xFFFF` (çıkarma) | 2 |

Diğer sabitler: `IBUS_MAX_SLOTS = 14` (2 baytlık kanal yuvası),
`IBUS_BAUDRATE = 115200`, `IBUS_FRAME_GAP = 500` µs.

Spec `:212` bunu doğruluyor: *"Betaflight'ta 32 byte'lık packet içinde 14 adet
2-byte channel slotu temel yapıdır."*

**Kanal maskesi tuzağı** `[KANIT]` — `ibus.c` `updateChannelData`:
```c
ibusChannelData[i] = ibus[offset] + ((ibus[offset + 1] & 0x0F) << 8);
// latest IBUS receivers are using previously not used 4 bits on every channel
```
Yani kanal değeri **12 bittir** (alt bayt + üst baytın alt nibble'ı), üst nibble
yeni alıcılarda **ek kanal** taşıyor. Spec `:212` aynı şeyi söylüyor:
*"yeni receiver'larda önceden kullanılmayan üst bitlerle ek channel taşınabilir."*
Spec `:215` de uyarıyor: *"exact bit masking seçilen i-BUS profile
implementasyonuna göre yapılmalıdır."*

→ Üst nibble **HAM alan olarak ayrı basılır**, "ek kanal" diye ADLANDIRILMAZ
(doğrulanmış kaynak yok).

### [DUR-SOR] i-BUS2 kapsam dışı → rozet `partial` — ana brif açık soru 5

Katalog i-BUS2'yi vadediyor (`aerospace-uav.ts:257` tool listesi,
`:260-261` yorum: *"i-BUS ve i-BUS2 aynı wire format değildir; tek profil altında
birleştirilmemeli"*). Spec `:209` da ayrı ailedir diyor.

**i-BUS2 için halka açık tel biçimi kaynağı BULUNAMADI** — FlySky yayınlamamış,
Betaflight uygulamamış. Kaynaksız kayıt politikası devreye girer:
**`partial`**, `profile` seçeneği yalnız `ia6`/`ia6b` şıklarıyla açılır, i-BUS2
sayfada **"kaynak yok, kapsam dışı"** uyarısıyla listelenir, özet AÇIKÇA yazar.

Emsal: `cc-link` (*"telgraf biçimi kamuya açık değil"*), `as-interface`
(klasik-only), `psi5` (tek çerçeve).

### `decodeOptions`

| Seçenek | Şıklar | Neden |
|---|---|---|
| `profile` | `ia6b` (varsayılan) · `ia6` | İki farklı checksum tohumu **ve** iki farklı senkron kuralı. Yanlış seçim checksum'ı her çerçevede FAIL gösterir |

`microwire.ts`in gerekçesi birebir: *"aynı dört bayt, x8 profiliyle READ 0x2A,
x16 profiliyle bambaşka bir şey; tahmin etmek uydurmaktır."*

**Otomatik profil tahmini YAPILMAZ.** İlk baytın `0x55` olması iA6 kanıtı DEĞİL —
iA6B'de ilk bayt uzunluktur ve `0x55` = 85 geçerli bir uzunluk gibi görünebilir
(gerçi 32'den büyük). Bu belirsizlik `canParse`ta ele alınır (aşağı bak), ama
`parse` KULLANICININ seçtiği profili uygular.

---

## `canParse` — bekçi testi ZORUNLU, bu dalganın en riskli sınıfı

Yeni dosya: **`src/protocols/aerospace/rc/rcCanParseRegistry.test.ts`**
(`sentSpcCanParseRegistry.test.ts` emsali — iki kaydı tek dosyada sınıyor).

**SBUS için:** uzunluk **tam 25** ve `data[0] === 0x0F`. Checksum yok, bu yüzden
üçüncü bir kanıt YOK — bu kabul edilir ama **ölçülür**: test registry'nin tüm
örnek çerçeveleri üzerinde koşar ve SBUS'un kaç yabancı çerçeveyi kabul ettiğini
sayar. Sıfır değilse çakışan protokol brife yazılır.

**IBUS için:** uzunluk 31 veya 32 **ve** seçili profilin checksum'ı **PASS**.
Yalnız uzunluğa bakmak yasaktır — 32 baytlık çerçeve depoda çok yaygındır.

**Ölçüm zorunlu** (14f'in "%54 yanlış pozitif" dersi, `pulseLog.ts:63-68`).
Ters yön de sınanır: SBUS/IBUS örneklerinin başka bir parser tarafından kabul
EDİLMEDİĞİ.

---

## Uygulama görevleri

1. **`BitOrder` doğrulaması** — elle hesaplanmış 22 baytlık fixture, `lsb-first`
   ile doğru, `msb-first` ile FARKLI. Bu test yazılmadan motor yazılmaz.
2. **`src/protocol-core/decoding/packedChannels.ts`** + `packedChannels.test.ts`.
   Dosya başı: neden `protocol-core`da (iki tüketici biliniyor), ne TAŞIMADIĞI
   (ölçek/normalizasyon), `bitsPerChannel`ın neden parametre olduğu.
3. **`src/protocols/aerospace/sbus/sbus.ts`** — 25 baytlık çerçeve, dört bayrak
   biti ayrı alan, kanallar ham.
4. **`src/protocols/aerospace/ibus/ibus.ts`** — `profile` seçeneği, iki checksum
   yolu, 12-bit kanal + üst nibble ham.
5. **Katalog** — `sbus` `'planned'` → `'ready'` (`:203`); `ibus` `'planned'` →
   `'partial'` (`:240`). İkisine de `pluginId`.
6. **Registry** — `registerOnce` iki kayıt.
7. **Çeviri** — `en.ts` + `tr.ts`.
8. **Test** — `sbus.test.ts`, `ibus.test.ts` (iki profil ayrı ayrı),
   `rcCanParseRegistry.test.ts`.
9. **e2e** — `e2e/sbus-decode.spec.ts`, `e2e/ibus-decode.spec.ts`.
   IBUS'ta kanıtlanacak: profil değiştirince checksum sonucunun DEĞİŞTİĞİ
   (seçeneğin gerçekten bağlı olduğu), ve i-BUS2 kapsam-dışı uyarısının görünmesi.

---

## Devralınan tuzaklar

- **`bitCursor` varsayılanı `msb-first`tir ve burada YANLIŞTIR.** `lsb-first`
  açıkça geçilir. Unutulursa hata VERMEZ, değer yanlış çıkar.
- **`readBitsAsNumber` 53 bit üstünde ATAR** (`bitCursor.ts:91`) — 11 bit sorun
  değil, ama toplu okuma denenmez.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
  11-bit kanal alanı için **kapsayan bayt aralığı** verilir (ör. CH1 için bayt
  1–2), bit ayrıntısı **alan ADINDA**: `CH1 (bit 0:10)`. `rtp.ts`/`rtcp.ts` emsali.
- **`ParsedField.id` KENDİ offset'ini kullanır** — 11-bit kanallarda ardışık iki
  kanal AYNI baytı paylaşır; `id` çakışması buradan doğar. Kanal indeksi id'ye
  girer (`sbus-channel-3`), offset değil.
- **`unit` VERİLMEZ** — ham paketli değer fiziksel bir büyüklük değildir
  (`types.ts:46`).
- **`ParsedFrame` DÜZ, `children` YOK.**
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli. Özellikle
  16 kanal + bayraklar çok satır ürettiği için `decode-field-warning` aramaları
  kökten `[data-field-id="X"]` ile yapılır.
- **Checksum "gösterilir" ile "doğrulanır" ayrımı** — SBUS'ta doğrulanacak alan
  YOKTUR ve bu sayfada görünür olmalıdır.

---

## Model/effort önerisi

**Sonnet · high.** Desen kurulu (sabit uzunluklu çerçeve + `bitCursor` + `canParse`
bekçisi hepsi emsalli) ama **`medium` DEĞİL**: `BitOrder` seçimi sessiz yanlış
değer üretir ve yanlış seçim testlerde de yeşil gelebilir; IBUS'un iki modeli bir
`decodeOptions` tasarımı gerektiriyor; SBUS checksum'sız olduğu için `canParse`
yalnız iki kanıta dayanıyor ve çakışma riski ölçülmeli.

**Tamamlanma ölçütü:** `sbus` **Hazır**, `ibus` **Kısmi** rozetiyle açılıyor;
`packedChannels.ts` iki bit sırasında farklı sonuç ürettiği testle kanıtlı;
IBUS'ta profil değişimi checksum sonucunu değiştiriyor ve bu e2e'de görünüyor;
i-BUS2 kapsam-dışı uyarısı sayfada; `rcCanParseRegistry.test.ts` registry'nin tüm
örnekleri üzerinde yeşil ve iki yön de sınanmış; birim + e2e + build yeşil;
`rc-control-links` ailesinde `planned` 5'ten 3'e düşüyor.

**KAYIT KAYIT bitir:** önce yardımcı + `sbus` tamamen, sonra `ibus`.

---

## Çürüyen tahminler

*(Dalga kapanışında doldurulacak. Dalga 12/13/14/15a/15b'te kural hâline gelen
bölüm: brifin yanlış çıkan öngörüleri dosyada İŞARETLENİR, silinmez.)*

Ana thread'in uygulamadan ÖNCE yaptığı bağımsız Betaflight/ArduPilot kaynak
turu bu brifin dört noktasını düzeltti/tamamladı:

1. **"Dijital kanal bayrakları `sbus_channels.h:25-28`de tanımlı."** KISMEN
   ÇÜRÜDÜ — değerler (bit0 Digital CH17, bit1 Digital CH18) doğru çıktı ama
   dosya atfı yanlıştı: gerçek kaynak `sbus_channels.c:38-39`
   (`SBUS_FLAG_CHANNEL_17`/`SBUS_FLAG_CHANNEL_18`). `sbus_channels.h` yalnız
   `SBUS_FLAG_SIGNAL_LOSS`/`SBUS_FLAG_FAILSAFE_ACTIVE`i (bit2/bit3) taşıyor.
   `sbus.ts` dosya başında düzeltilmiş atıfla yazılı.

2. **"IBUS checksum'ları yalnız tohum ve işaretle (+/−) ayrışır."** EKSİK
   ÇIKTI — brif tohumu (iA6 `0x0000` toplama / iA6B `0xFFFF` çıkarma) doğru
   veriyordu ama checksum'ın KAPSAMINI (hangi baytların dahil olduğunu) hiç
   belirtmiyordu. Ana thread'in kaynak turu netleştirdi: iA6B checksum'ı
   UZUNLUK VE KOMUT BAYTLARI DAHİL checksum'dan önceki BÜTÜN 30 baytı
   kapsıyor (`ibus_shared.c:493-511`, `dataSize = ibusPacket[0] −
   IBUS_CHECKSUM_SIZE`); iA6 ise SENKRON BAYTINI (byte0) KAPSAM DIŞI bırakıp
   yalnız 14 kanal yuvasının 16-bit LE SÖZCÜKLERİNİ topluyor
   (`ibus.c:133-144`). Ayrım yalnız işaretten değil KAPSAMDAN ve BİRİMDEN
   (tek tek bayt vs 16-bit sözcük) da ibaret — bu yüzden `computeIa6Checksum`/
   `computeIa6bChecksum` tek bir `seed`/`sign` parametreli ortak fonksiyona
   SIKIŞTIRILMADI, iki ayrı fonksiyon yazıldı (`ibus.ts` dosya başı).

3. **"Üst nibble'ın anlamı için doğrulanmış kaynak YOK, bu yüzden ham
   basılır."** ÇÜRÜDÜ — SONUÇ (ham + uyarı) doğru çıktı ama GEREKÇE
   yanlıştı. Kaynak YOK değil, İKİ kaynak VAR ve BİRBİRİYLE ÇELİŞİYOR:
   - Betaflight `rx/ibus.c:163-164` üç FARKLI kanalın üst nibble'ını
     birleştirip dört ek 12-bit "ek kanal" (indeks 14-17) türetiyor.
   - ArduPilot `AP_RCProtocol_IBUS.cpp:45-49` AYNI baytların üst nibble'ını
     FAILSAFE göstergesi sayıyor.
   Ana thread kararı (uygulandı): üst nibble HAM alan olarak, HER kanal
   yuvası için AYRI basılır; ne "ek kanal" ne "failsafe" adlandırılır, her
   alana İKİ yorumu da kaynağıyla adlandıran bir uyarı eklenir
   (`protocol.ibus.warning.upperNibbleAmbiguous`, `ibus.ts` dosya başı).
   Nihai davranış brifin önerdiğiyle AYNI kaldı — yalnız gerekçesi "kaynak
   yok"tan "kaynaklar çelişiyor"a düzeltildi. Kanal DEĞERİNİN kendisi (12
   bit, alt bayt + üst baytın ALT nibble'ı) iki kaynakta da BİREBİR aynı —
   orada çelişki yok.

4. **"SBUS'ta üçüncü kanıt yok, çakışma sayısını ölç ve raporla."**
   DOĞRULANDI ve tam öngörüldüğü gibi çıktı: `rcCanParseRegistry.test.ts`
   ileri yönde (yabancı çerçeveler sbus/ibus'a kaçıyor mu) SIFIR çakışma
   ölçtü, ama ters yönde (sbus/ibus'un KENDİ örnekleri başka parser'lara
   kaçıyor mu) **448/1048 çift (%43)** çakıştı — 63 benzersiz "genel
   bayt-akışı" protokolünde (`uart`/`rs-232`/`rs-485`/`tcp`/`udp`/`spi`/
   `i2c`/`hdlc`/… — tam liste test dosyası başında). Bu,
   `dronecanCanParseRegistry.test.ts`in KENDİ ters-yön ölçümüyle (380/762,
   "%50") AYNI SINIFTA bir sonuç ve AYNI kök sebep: çarpışan protokollerin
   `canParse`i yapısal bir başlık doğrulamıyor — bu ONLARIN kendi tasarım
   tercihi, bu dalganın (63 ilgisiz dosyaya dokunmak gerekirdi) kapsamı
   DIŞINDA. Sıfıra ZORLANMADI, dronecan'ın 3. testiyle AYNI karar.

---

## Uygulama sonucu (2026-08-25, KAPANDI)

`sbus` **Hazır**, `ibus` **Kısmi** rozetiyle açıldı. `packedChannels.ts`
doğdu (`src/protocol-core/decoding/packedChannels.ts`), `BitOrder` testi
motordan ÖNCE yazıldı ve elle türetilmiş 22 baytlık fixture'la `lsb-first`/
`msb-first`in FARKLI sonuç ürettiğini kanıtladı. IBUS'ta profil değişimi
checksum sonucunu GERÇEKTEN değiştiriyor (birim + e2e'de ayrı ayrı kanıtlı);
i-BUS2 kapsam-dışı uyarısı hem seçenek açıklamasında hem her çözümde basılan
bir çerçeve uyarısında görünür. `rcCanParseRegistry.test.ts` iki yönü de
sınıyor (madde 4). Birim testler (`packedChannels`/`sbus`/`ibus`/
`rcCanParseRegistry`, 50 test) ve iki e2e spec'i (`sbus-decode.spec.ts` 6,
`ibus-decode.spec.ts` 10 — ikisi de gerçek tarayıcıda en az bir kez KOŞTU ve
yeşil) yeşil; `npx tsc --noEmit` temiz. `rc-control-links` ailesinde
`planned` 5'ten **3**'e düştü (`crsf`/`ppm`/`pwm-servo` kaldı, sıradaki 15d
`crsf` bu dalganın `packedChannels.ts`sini tüketecek).
