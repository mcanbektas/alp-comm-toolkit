# Faz 10, dalga 11 — Serial Interfaces / Peripheral Buses / Host & Network Interfaces / Vehicle-Field Physical Layers (keşif, 2026-08-21)

## Kapsam

`interfaces-framing` domain'inin dalga10'un kapsamadığı kalan 4 ailesi, 23 protokol
(kaynak: `src/app/catalog/domains/interfaces-framing.ts`, hepsi `status:'planned'`):

- **Serial Interfaces (8)**: uart, ttl-uart, cmos-uart, rs-232, rs-422, rs-485, current-loop, 4-20-ma
- **Peripheral Buses (9)** — **TEK aile**, "SPI Family + I²C Family iki alt aile" önceki not
  YANLIŞTI, düzeltildi: spi, quad-spi, octal-spi, microwire, i2c, i3c, smbus, pmbus, one-wire
- **Host & Network Interfaces (3)**: usb, ethernet-interface, single-pair-ethernet
- **Vehicle/Field Physical Layers (3)**: can-phy, lin-phy, flexray-phy

Spec kaynağı: `docs/spec/ozet/01-fiziksel-arayuzler.md:40-509` (satır aralıkları aşağıdaki
aile tablolarında). Sayı üç bağımsız kaynaktan doğrulandı: katalog dosyası, spec başlığı
("3.1 Fiziksel arayüzler — kapsam listesi (23 arayüz)", `:40`), domain yorumu
(`interfaces-framing.ts:4`, "8+9+3+3").

## Önkoşul düzeltmesi — calculator altyapısı ZATEN VAR

Önceki varsayımın (`features/calculators/` boş) aksine, `src/features/calculators/registry.ts`
+ `tools/timingTools.tsx` (436 satır) dolu ve ÇALIŞIYOR: `UartTimingTool`, `Rs485TimingTool`
(termination/bias/propagation/unitLoad 4 alt bölüm), `SpiTimingTool`, `I2cTimingTool`,
`PmbusLinearTool` zaten yazılmış. Bu dalganın "motor yazma" yükü 5 protokol için (uart, rs-485,
spi, i2c, pmbus) büyük ölçüde ZATEN ÖDENMİŞ — kalan iş çoğunlukla decode/UI tarafı + katalog
kaydına `calculatorIds` eklemek (şu an bu 5 kayıtta `calculatorIds` alanı YOK, LoRa'da var).

## Ortak bulgu — bu 23 protokol "byte decode" mi?

17/23'ün `tabs`ında `'decode'` var. 6'sında yok — **current-loop, 4-20-ma,
single-pair-ethernet, can-phy, lin-phy, flexray-phy**: saf elektriksel/PHY, bayt akışı yok.

Katalog şemasında (`types.ts:63-69`, `ProtocolLayer` = physical/data-link/network/transport/
application/multi-layer) bu ayrımı yapan bir alan YOK — `layer:'physical'` hem decode'lu
(uart, spi, i2c...) hem decode'suz (current-loop, can-phy...) kayıtlarda aynı. Ayrım fiilen
`tabs` dizisinde `'decode'` olup olmamasından okunuyor, resmi şema alanı değil.

**Kanıtlanmış presedan — LoRa** (`src/app/catalog/domains/wireless-iot.ts:169-187`):
`status:'partial'` (`'ready'` DEĞİL), `pluginId` YOK, `tabs`ında `'decode'` YOK,
`calculatorIds:['lora-airtime','lora-link-budget','lora-battery']`. `features/calculators/
registry.ts:59-61` gerekçesi: *"LoRa PHY: katalogdaki kayıt çerçeve ÇÖZMEZ, hesap makinesidir."*
**172 kayıtlık katalogda `'ready'` durumunda saf-elektriksel/PHY bir protokol YOK** — en olgun
emsal `'partial'`. Yukarıdaki 6 aday için olgunluk tavanı muhtemelen `'ready'` değil `'partial'`.

**Spec'in "ortak Bit/Signal Analyzer" isteği (`01-fiziksel-arayuzler.md:476-493`,
Electrical→Logic→Bits→Bytes→Transaction→Protocol katman geçişi) TAMAMEN aspirasyonel** —
`src/protocol-core/`, `src/components/` içinde sıfır kod karşılığı (signal-viewer/
packet-viewer/protocol-tree dosya sisteminde yok). Spec'in kendi Dikkat-çekenler #9'u (`:519`)
bunu zaten "mimari tasarım kararı gerektiren en soyut gereksinim" diye işaretliyor.

**`connection/` katmanı yalnız `serial/`+`mock/` içeriyor** (usb/bluetooth/websocket yok) —
`i2c` ve `usb` kayıtlarının `tabs`ında `'live'` olması bu yüzden ŞÜPHELİ, koddan
doğrulanamıyor (bkz. Açık sorular #2).

## Aile bazlı analiz

### Serial Interfaces (8) — `interfaces-framing.ts:29-206`

| id | satır | sınıf | motor durumu |
|---|---|---|---|
| uart | 36-41 | byte-decode | `timing/uart.ts:58` `calculateUartTiming` hazır (bit/karakter/paket süresi, baud error). Decoder/Frame Visualizer/Packet Builder (Start/D0-D7/Parity/Stop→alan tablosu) YENİ. Parity formülü zaten genel (Even/Odd/None), spec'in eksik bıraktığını kod önceden çözmüş. |
| ttl-uart | 56-61 | logic-compat + UART frame | Motor yok. "Logic Compatibility Check" (VOH/VOL/VIH/VIL karşılaştırma) trivial YENİ. Decode = UART'ı çağırır. |
| cmos-uart | 75-80 | ttl-uart ile aynı desen, çift yönlü | Aynı, YENİ — ttl-uart'la ortak "logic level compatibility" modülü adayı. |
| rs-232 | 93-98 | byte-decode (UART) + polarite | Decode=UART reuse, timing=uart.ts reuse. Gerçek voltaj aralığı (±3V-±15V) spec'te yok, yalnız polarite — Signal View kapsamı BELİRSİZ. |
| rs-422 | 113-118 | byte-decode (UART) + diferansiyel | Decode=UART reuse. Vdiff hesabı rs-485'inkiyle aynı ruhta ama paylaşılmıyor. |
| rs-485 | 133-138 | byte-decode (UART) + elektriksel paket | **En hazır**: `timing/rs485.ts` → 4 fonksiyon (termination/bias/propagation/unitLoad) `Rs485TimingTool`'da ÇALIŞIYOR. `related` alanı zaten var (`:159-164`) — diğerlerinde yok, emsal alınmalı. |
| current-loop | 167-172 | saf elektriksel/analog | Motor yok. Ohm kanunu trivial. LoRa paterni adayı. |
| 4-20-ma | 185-190 | saf elektriksel/analog | Motor yok. "Trend View" tool'u (`:202`) log/CSV üzerinden besleniyor olmalı (`'live'` yok, yalnız `'data'`). HART'a (`industrial-automation.ts:499`, `layer:'multi-layer'`, planned) `related` linki YOK — RS-485'in yaptığı çapraz-link burada eksik. |

### Peripheral Buses (9) — `interfaces-framing.ts:207-417`

| id | satır | sınıf | motor durumu |
|---|---|---|---|
| spi | 214-219 | byte-decode | `timing/spi.ts` → `resolveSpiMode`/`calculateSpiTransferTime`/`calculateSpiTransactionTiming` hazır, `SpiTimingTool` çalışıyor. Decode (MOSI/MISO transaction) YENİ. |
| quad-spi | 236-241 | byte-decode (fazlı) | `spi.ts:114` `qspiThroughput` reuse. Decode (Command/Address/Dummy/Data fazları) YENİ. |
| octal-spi | 256-261 | byte-decode | `spi.ts:131` `ospiThroughput` (SDR/DDR) reuse. DQS strobe kavramı hiçbir yerde yok. |
| microwire | 278-283 | byte-decode, PARAMETRİK olmalı | Motor yok. Spec Dikkat-çekenler #8 (`:518`): sabit decoder yetmez, datasheet-bağımlı opcode/adres/word-genişliği — mimari karar (Faz 7 şema motoru mu, başka model mi). |
| i2c | 297-302 | byte-decode | `timing/i2c.ts` → transfer time/7-bit adres encode/rise time/pull-up hazır, `I2cTimingTool` çalışıyor. Decode (START/STOP/ACK/Repeated-START/Clock-Stretch/Arbitration) YENİ. `'live'` şüpheli. |
| i3c | 325-330 | byte-decode | Hiç motor yok (`timing/i3c.ts` yok). Dynamic addressing/CCC/IBI/HDR tamamen YENİ. Hız rakamları (12.5/33.3 Mbit/s) MIPI versiyon-bağımlı, BELİRSİZ (Dikkat-çekenler #4, `:514`). |
| smbus | 348-353 (**`layer:'data-link'`**, tek istisna) | byte-decode + PEC | I²C fiziksel altyapısı reuse edilebilir ama transaction sınıfları + timeout modeli YENİ. PEC: düz `CRC8` (`crcCatalogue.ts:45`) parametreleri uyuyor GİBİ ama provenance/fixture yok — doğrulamadan uydurulmayacak. |
| pmbus | 371-376, `definitions:['vendor-map']` | byte-decode + komut protokolü | **Hazır**: `timing/pmbus.ts` → `decodeLinear11/encodeLinear11/decodeLinear16/encodeLinear16` çalışıyor, `PmbusLinearTool` var. "Direct Format Decoder" (`:387`) ne spec özetinde ne motorda var — PMBus 1.5 spec'inden dış araştırma gerekir. STATUS_WORD bit-ağacı YENİ. |
| one-wire | 397-402 | byte-decode + arama ağacı | **CRC hazır**: `crcCatalogue.ts:62` `CRC8_MAXIM` (Dallas/Maxim standart) spec örneğiyle (`28 FF 64 1D 91 16 03 5C`, `:338`) doğrudan doğrulanabilir. Search ROM ağacı (Bit/Complement/Branch Discrepancy) YENİ. |

### Host & Network Interfaces (3) — `interfaces-framing.ts:419-487`

| id | satır | sınıf | motor durumu |
|---|---|---|---|
| usb | 426-431 (`layer:'multi-layer'`) | gerçek paket yapısı, framing motoruna UYMUYOR | CRC5 hazır (`crcCatalogue.ts:42` `CRC5_USB`, token paketleri). Data-paket CRC16 için USB'ye özel kayıt YOK (`CRC16_ARC` adayı ama parametreleri doğrulanmadı). `'live'` şüpheli (WebUSB yok). Descriptor/enumeration/4 transfer tipi büyük YENİ iş. |
| ethernet-interface | 447-452 | PHY/MDIO register decode — Ethernet FRAME decode DEĞİL | "Decode" burada MDIO/MDC register + Link Status/Speed/Duplex/Auto-Neg yorumu — gerçek Ethernet frame decode zaten `network-ethernet.ts`'te `ieee-802-3`/`ethernet-ii` olarak `ready`. İki kayıt arasında `related` linki YOK. |
| single-pair-ethernet | 469-474 | saf PHY/elektriksel | Motor yok. PLCA (Coordinator/Node ID/Transmit Opportunity) YENİ. LoRa paterni adayı. |

### Vehicle/Field Physical Layers (3) — `interfaces-framing.ts:489-550`

| id | satır | sınıf | motor durumu |
|---|---|---|---|
| can-phy | 496-501 | saf elektriksel/PHY | Motor yok ama matematik rs485.ts'inkiyle neredeyse aynı (120Ω termination, T_prop=L/v). Gerçek CAN frame decode zaten VAR ve `ready` (`automotive.ts`: can-2-0a/can-2-0b/can-fd/can-xl, 4 kayıt). `related` linki YOK. |
| lin-phy | 516-521 | saf elektriksel/PHY | Motor yok. LIN frame decode zaten VAR ve `ready` (`automotive.ts:266`). `related` linki YOK. |
| flexray-phy | 533-538 | saf elektriksel/PHY | Motor yok. FlexRay frame decode HENÜZ YOK (`automotive.ts:299`, `status:'planned'`) — CAN/LIN'den farklı olarak kardeş sayfa da inşa edilmemiş. |

## Motor örtüşme tablosu

| Motor | Konum | Güçlü reuse | Kısmi reuse | Hiç yok |
|---|---|---|---|---|
| UART timing | `timing/uart.ts` | uart, rs-232, rs-422, rs-485 | ttl-uart, cmos-uart (decode kısmı) | i3c, smbus |
| SPI/QSPI/OSPI timing | `timing/spi.ts` | spi, quad-spi, octal-spi | — | microwire |
| I²C timing | `timing/i2c.ts` | i2c | smbus (elektriksel temel) | i3c |
| RS-485 elektrik | `timing/rs485.ts` | rs-485 | rs-422, can-phy (aynı matematik, ayrı dosya) | lin-phy, flexray-phy |
| PMBus Linear11/16 | `timing/pmbus.ts` | pmbus | — | smbus, "Direct format" |
| CRC8_MAXIM | `crcCatalogue.ts:62` | one-wire | — | — |
| CRC5_USB | `crcCatalogue.ts:42` | usb (token) | — | usb (data CRC16) |
| düz CRC8 | `crcCatalogue.ts:45` | — | smbus/pmbus PEC (BELİRSİZ, doğrulanmadı) | — |
| Framing motoru (15 yöntem) | `protocol-core/framing/` | — | — | **hepsi (23/23)** |
| Faz 7 şema motoru | `protocol-core/schemas/` | — | microwire, one-wire adayı | mimari karar bekliyor |
| Otomotiv frame decode | `src/protocols/automotive/{can,lin}` | (`related` olsaydı) | — | flexray-phy (kardeşi de yok) |
| LoRa paterni (partial+calculatorIds) | `wireless-iot.ts` + `registry.ts:59-64` | current-loop, 4-20-ma, single-pair-ethernet, can-phy, lin-phy, flexray-phy (6 aday) | — | — |

## Sıralama önerisi (en kolay/az belirsizden en zora)

1. **one-wire** — CRC8_MAXIM hazır, ROM yapısı spec'te net. En düşük risk.
2. **spi + quad-spi + octal-spi** (paylaşılan çekirdek) — timing hazır, decode NET (fazlı transaction, spec `:207-259` formüllü).
3. **i2c** — timing hazır, decode NET. Tek risk: `'live'` gerçekliği (kodlamaya engel değil).
4. **rs-485 + rs-422** — elektrik motoru ZATEN ÇALIŞIYOR, kalan iş decode + `calculatorIds` eklemek.
5. **uart + rs-232 + ttl-uart + cmos-uart** — UART timing hazır; logic-compat küçük ve iyi tanımlı.
6. **current-loop + 4-20-ma** (LoRa paterni) — motor trivial, asıl iş mimari (partial+calculatorIds) + HART `related` linki.
7. **can-phy + lin-phy + flexray-phy** — motor yok ama rs485.ts'ten adapte edilebilir; `related` linkleri eksik kapatılmalı.
8. **smbus + pmbus** — pmbus çekirdeği hazır ama Direct Format dış araştırma ister; smbus PEC doğrulanmamış.
9. **usb** — CRC5 hazır, CRC16 doğrulanmamış, `'live'` şüpheli, framing motoruna hiç uymuyor. En hacimli tekil protokol.
10. **ethernet-interface + single-pair-ethernet** — küçük ama "hangi decode neyi kapsıyor" sınırı dikkat ister.
11. **microwire + i3c** — ikisi de mimari/versiyon belirsizliği taşıyor, en zor/en belirsiz.

Model/effort önerisi: 1-6 Sonnet·medium-high (dalga10 profiliyle tutarlı, desen kurulu);
7-9 Sonnet·high (mimari fork + doğrulanmamış CRC + `'live'` kararları); 10-11 Opus·high
(microwire'ın şema kararı, i3c'nin versiyon-bağımlı alanları).

## Tuzaklar / açık uçlar

1. Bit/Signal Analyzer ortak mimarisi hiç kurulmadı — şimdi kurulacak (büyük, xhigh-max) mı, yoksa dalga10/HDLC-SDLC emsaliyle protokol-protokol ilerleyip desen kendiliğinden mi çıkacak?
2. `related` çapraz-linkleri sistematik eksik (rs-485 hariç): 4-20mA↔HART, can-phy↔can ailesi, lin-phy↔lin, ethernet-interface↔ieee-802-3/ethernet-ii.
3. `calculatorIds` geriye dönük eksik: uart/rs-485/spi/i2c/pmbus'ın çalışan araçları var ama katalog kaydında yok.
4. `'live'` tab'ının i2c ve usb için gerçekliği koddan cevaplanamıyor (`connection/usb` yok) — kullanıcıya sorulmalı.
5. SMBus/PMBus PEC'in düz CRC8 ile eşleştiği varsayım + USB CRC16 — ikisi de doğrulanmadan uydurulmayacak (`crcCatalogue.ts:1-8` disiplini).
6. Microwire + one-wire'ın "parametrik/datasheet-bağımlı decoder" ihtiyacı (Dikkat-çekenler #8) mimari karar gerektiriyor.
7. PMBus "Direct Format" bu repo'nun spec kaynağında yok — PMBus 1.5 spec'inden ayrıca çekilmesi gerekir (ZMODEM/lrzsz emsali: WebSearch+`ctx_fetch_and_index`).
8. I3C hız rakamları (12.5/33.3 Mbit/s) MIPI versiyon-bağımlı, statik mi güncellenebilir referans mı olacağı belirsiz.
9. RS-485 Unit Load / RS-232 voltaj aralığı / SMBus-PMBus versiyon numaraları — spec Dikkat-çekenler #5/#6/#7 zaten açık bırakmış, hazır cevap yok.
10. `layer:'multi-layer'` kullanımı (usb, hart) ile can-phy/lin-phy/flexray-phy'nin düz `'physical'` kalması arasındaki ayrım muhtemelen kasıtlı (tek sayfa vs ayrı üst-katman sayfası) ama varsayılmadan doğrulanmalı.

## Kullanıcıya sorulacak açık sorular (kodlamaya başlamadan önce)

1. Bit/Signal Analyzer ortak mimarisi şimdi mi kurulsun, yoksa ilerledikçe mi netleşsin?
2. i2c/usb'nin `'live'` tab'ı gerçek mi (harici köprü cihaz), yoksa katalog düzeltilsin mi?
3. PMBus Direct Format için dış kaynağa (PMBus 1.5 spec) gidilsin mi?
4. Sıralama önerisi (yukarı) kabul mü, farklı gruplama mı isteniyor?

## Kapsam dışı, yalnız not

- framing-stream-protocols'ta (dalga10, "tamamlandı" sayılan) `ubx`/`rtcm` hâlâ
  `status:'planned'` (`interfaces-framing.ts:956,976`) — 58a4fc5'in "17/17 ready" commit
  mesajıyla çelişiyor. Bu dalganın konusu değil, ayrı bir tutarlılık sorunu.
- `docs/plan-fazlar.md:32` (Faz 10+ satırı) hâlâ 2026-08-20/dalga9 durumunda; `:43`
  "Faz 10 TAMAMEN BİTTİ" diyor ama katalogda 105 kayıt (bu 23 dahil) hâlâ `planned`.
  Güncellenmesi gerekiyor, bu dalganın implementasyon aşamasında ele alınabilir.

---

## Dalga 11 kapanışı (#11 — microwire + i3c)

Sıralamadaki 11 işin tamamı bitti; `interfaces-framing`in dört ailesi de kapandı.

**Mimari karar — `ProtocolPlugin.decodeOptions` kanalı açıldı.** Tuzak listesinin
6. maddesi ("Microwire + one-wire'ın parametrik decoder ihtiyacı mimari karar
gerektiriyor") iki seçenek karşılaştırılarak kapatıldı:

- *Reddedilen:* parser içinde kapalı bir 93xx profil kataloğu + otomatik seçim.
  2 bitlik opcode ve değişken adres genişliğinden otomatik seçim gerçekten zayıf;
  yanlış profil sessizce makul görünürdü. PMBus VOUT_MODE boşluğu da açık kalırdı.
- *Seçilen:* `ProtocolPlugin.decodeOptions` bildirimi + `DecodePanel`in ondan
  ürettiği form + `ParseContext.options` üzerinden parser'a iniş.
  `ParseContext.options` ilk günden tipte vardı ama hiçbir ekran DOLDURMUYORDU
  (`DecodePanel.tsx:336` `parser.parse(bytes)` diyordu) — 11i'de PMBus ULINEAR16
  üssünün basılmama sebebi tam olarak buydu. Kanal artık açık; PMBus VOUT_MODE,
  quad-spi dummy cycle ve 1-Wire endianness aynı yoldan kapatılabilir (bu
  dalganın konusu değil).

Seçenek bildirmeyen 171 kayıt için çağrı biçimi bit birebir aynı kaldı.

**Doğrulanan kaynaklar.** Microwire: Microchip **DS20001749K** (93xx46) ve
**DS21794F** (93xx56), Tablo 1-3/1-4 tam okundu. Formül datasheet'ten
türetilmedi, datasheet'in "Req. CLK Cycles" sütunundaki **sekiz bağımsız sayıyla
sınandı** ve sekizi de tuttu. I3C: MIPI spec'i kamuya açık indirilebilir değil
(PMBus 1.5 emsali), sabitler Linux çekirdeği I3C alt sisteminden alındı
(`include/linux/i3c/{ccc,device,master}.h`).

**Uydurulmayan üç şey.** (a) 93xx66 preset'i — komut tablosu iki PDF'in hiçbirinde
yok, `custom` profiliyle girilir. (b) I3C DCR sınıf tablosu — çekirdek tek değer
adlandırıyor, ötekiler ham bayt kalır. (c) ENTDAA'da atanan adresin parite
bitinin kablodaki yeri — iki çekirdek sürücüsü iki ayrı yer gösteriyor
(`dw-i3c-master.c:864` BIT(7) register formatı, `svc-i3c-master.c:1075` donanıma
bırakıyor); adres-baytı konvansiyonu VARSAYILDI ve varsayım uyarı olarak basılıyor.

**Kaçınılmaz belirsizlik.** Private SDR okuması ile IBI yakalanmış baytlarda
AYNI görünür. Gizlenmedi: `auto`da uyarı basılıyor, kullanıcı biliyorsa
`frameKind` şıkkından söylüyor. smbus'ın `alternativeKinds` kararının bir
sonraki adımı — orada seçenek kanalı yoktu, artık var.

**Tuzak listesinin kapanan öteki maddeleri:** #2 (`related` çapraz-linkleri
microwire↔spi ve i3c↔i2c/smbus için kuruldu), #3 (`calculatorIds` microwire için
eklendi), #8 (I3C hız rakamları versiyon-bağımlı olduğu için HİÇBİR YERE
yazılmadı; `timing` sekmesi açılmadı).

**Kapsam dışı bırakılanlar, gerekçeli:** HDR çerçeveleme ve hot-join el sıkışması
(spec ikisini de yalnız adıyla sayıyor), Microwire self-timed write cycle /
RDY-BSY yoklaması (DI hattında bit üretmez), clock edge (yakalamayı ÜRETEN aracın
ayarı, aynı bitleri farklı yorumlatmaz).

**Tarayıcı turunun yakaladığı kusur.** `unit: 'bit'` alanları panelde fiziksel
değerin YANINA basılıyordu: ekranda "EWEN bit", "0x0A bit" yazıyordu. Bit olan
alanın genişliği, değeri değil. Hiçbir birim test hücrenin bileşik metnine
bakmıyordu — dalga 11'de bu, "test yeşil ama ekran yanlış" sınıfının dördüncü
örneği (11c çeviri eksikliği, 11d zayıf assertion, 11i alan sırası, bu).

**Fixture taşındı.** `ProtocolPage.test.tsx`in "motoru olmayan kayıt" fixture'ı
microwire'dan `automotive/vehicle-network-protocols/flexray`e taşındı.

**Doğrulama:** typecheck temiz, `npm test` 3835/3835, `npm run test:e2e` 644/644
(build dahil). Tarayıcı turu: Microwire READ/EWEN, Microwire zamanlama sekmesi
(hesaplayıcı bağlantısı görünüyor), Microwire hesaplayıcısı, I3C ENTDAA ve I3C
IBI ekran görüntüsüyle incelendi, konsol hatasız.
