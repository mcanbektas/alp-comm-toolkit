# BRİF — ALP Comm Toolkit, Faz 10 dalga 9 (LoRa PHY hesapları · AT komut ailesi)

## Konum

Dalga 8 (`d54af64`) BLE GATT motorunu ekledi (8a), LoRaWAN FOpts MAC komut borcunu
ve Zigbee ZCL cluster/attribute kütüphane borcunu kapattı. 8b (Web Bluetooth kaynağı)
hâlâ karar 1'i (canlı BLE veri sözleşmesi — `MessageSource` önerisi) bekliyor,
cevaplanmadı.

Bu brief 8b'den **bağımsız** iki aileyi kapsar: `lora` (katalogda ayrı bir kayıt,
LoRaWAN'dan farklı — PHY hesap makinesi) ve beş kayıtlık bir AT-komut ailesi
(`hayes-command-set`, `at-commands`, `lte-modem-at`, `nb-iot`, `gnss-modem`).

**9a TAMAM.** Karar 1 ve karar 2 uygulandı. Ne yazıldığı ve keşif turunun hangi
öncülünün yanlış çıktığı aşağıda: bkz. "9a — ne yapıldı" ve düzeltilmiş §2.

**Karar 3/4/5/6 verildi** (2026-08-20). **9b'nin `at-commands` kısmı, 9c/9d/9e'nin
tamamı TAMAM** — bkz. "9b — ne yapıldı", "9c — ne yapıldı", "9d — ne yapıldı"
ve "9e — ne yapıldı". Beş kayıtlık AT-komut zinciri (`hayes-command-set`
hariç) TAMAMLANDI. `hayes-command-set` (madde 7) BAĞIMSIZ, hâlâ kendi küçük
kararını bekliyor — zincire bağlı değil, istenirse ayrı alınır.

## Durum — keşif turunda doğrulananlar

Bu bölümdeki her satır bu depoda okunarak ya da resmi/açık kaynaktan doğrulanarak
kuruldu. İki paralel araştırma turu (kod yapısı + protokol kaynakları) kullanıldı.

### 1. Altı kayıt da `planned`, hiçbirinin motoru yok — bekçi borcu YOK

`registerOnce` listesinde (`src/protocols/index.ts`, 47 kayıt) bu altı id'den
**hiçbiri** yok: `lora`, `hayes-command-set`, `at-commands`, `lte-modem-at`,
`nb-iot`, `gnss-modem`. Katalogda ikisi `wireless-iot.ts`'te (`lora-lpwan` ve
`cellular-iot` aileleri), üçü `interfaces-framing.ts`'te (`framing-stream-protocols`
ailesi — `at-commands`, `hayes-command-set`) zaten kayıtlı satırlar. Yeni katalog
girdisi **eklenmeyecek** — yalnız `status`/`pluginId` işlenecek. `EXPECTED_DOMAIN_COUNT/
FAMILY_COUNT/PROTOCOL_COUNT` (8/54/172) dokunulmaz.

### 2. `lora` ≠ `lorawan` — PHY hesap makinesi, çerçeve çözücü DEĞİL

`lorawan` (dalga 7b'de yazıldı, `status: 'partial'`, `pluginId: 'lorawan'`) MAC
katmanını çözer: MHDR/FHDR/FPort/FRMPayload/MIC. Katalogdaki **ayrı** `lora` kaydı
(`wireless-iot.ts:169-189`, `layer: 'physical'`) tamamen farklı bir iş: `tabs` içinde
`decode` bile YOK (`['overview', 'timing', 'data', 'diagnostics', 'examples']`).
Araçların tamamı hesap makinesi: *PHY Parameter Set*, *Symbol Time & Symbol Rate
Calculator*, *Estimated PHY Bit Rate*, **Time on Air Calculator**, *Airtime
Analyzer*, *Link Budget & Margin Calculator*, *Battery/Energy Estimator*. Dosya
başı kod yorumu (`wireless-iot.ts:174-175`) bunu doğruluyor: *"Airtime / Time on
Air hesabı bu kaydın asıl işi."*

~~**Bu depoda `calculators` altyapısı zaten CANLI**, blokaj değil: `obd.ts:364`
(`calculators: CALCULATORS`) + `src/features/calculators/` (registry.ts, types.ts,
tools/) dolu.~~

**DÜZELTME (9a uygulanırken çıktı — bu öncül YANLIŞTI.)** Tek bir "calculators
altyapısı" yok, İKİ AYRI şey var ve biri motor taşımıyor:

1. `ProtocolPlugin.calculators: CalculatorDefinition[]` — **metadata-only**.
   `protocol-core/types.ts:218-224` tipin tamamıdır: `id`, `name`, `description`,
   `unit?`. Girdi tipi yok, `compute` yok, sonuç tipi yok. Tip yorumundaki "hesap
   motorları Faz 5'te gelecek, burada sadece şekil sabitleniyor" notu ESKİ DEĞİL,
   hâlâ geçerli. Depoda `plugin.calculators` alanını okuyan TEK yer bir test
   satırıdır (`obd.test.ts:170`); sıfır UI bileşeni okur. Yani obd.ts'in deseni
   izlenirse ekranda **hiçbir şey çıkmaz**.
2. `src/features/calculators/` — asıl CANLI olan bu: `CALCULATOR_TOOLS` kaydı,
   `/calculators/:toolId` rotası, `CalculatorPage.tsx`teki `TOOL_RENDERERS`
   eşlemesi ve `tools/` altındaki gerçek React araçları (`timingTools.tsx`,
   `numericTools.tsx`, `CrcCalculatorTool.tsx`). Protokol eklentisiyle HİÇ
   bağlantısı yok — `pluginId` de protokol id'si de okumaz.

Motor da bu ikinci sistemin emsalini izler: UART/RS-485/SPI/I²C/PMBus zamanlama
motorlarının hepsi `protocol-core/timing/` altındadır ve hepsi protokole
özgüdür. LoRa PHY de oraya yazıldı. `parser` gerekmiyor (karar 1).

### 3. LoRa ToA formülü — İKİ RESMİ KAYNAK ÇATIŞIYOR, güncel olan tercih edilmeli

Sembol süresi ve preamble süresi üç kaynakta da (güncel Semtech datasheet, 2013
AN1200.13, `avbentem/airtime-calculator`) birebir örtüşüyor:

```
Ts = 2^SF / BW
Tpreamble = (n_preamble + 4.25) × Ts
```

**Payload sembol sayısında ayrım var.** Semtech SX1276/77/78/79 Datasheet
(Rev.7, Mayıs 2020, §4.1.1.7) — güncel, resmi:

```
n_payload = 8 + max( ceil[ (8·PL − 4·SF + 28 + 16·CRC − 20·IH) / (4·(SF−2·DE)) ] × (CR+4), 0 )
```

`avbentem/airtime-calculator` (açık kaynak, MIT) ve orijinal 2013 AN1200.13,
CRC terimini **sabit `+16`** yazıyor (CRC her zaman açık varsayılır — fonksiyon
imzasında `crc` parametresi bile yok). Bu yalnız "CRC her zaman açık" özel
durumunda (LoRaWAN uplink) doğru sonuç verir; CRC kapalı senaryoda (LoRaWAN
downlink çerçeveleri gibi) yanlış hesaplar. **Karar 2**'de ele alınıyor.

Terimler: `PL`=payload bayt (1-255), `SF`=6-12, `CRC`∈{0,1}, `IH`(implicit
header)∈{0,1}, `DE`(Low Data Rate Optimization)∈{0,1}, `CR`=1..4 (4/5..4/8).

### 4. `nb-iot` PHY/MAC çözücü DEĞİL — %100 AT komutu

3GPP Rel-13+ NB-IoT'nin fiziksel katmanı (NPBCH/NPDCCH/NPDSCH/NPRACH/NPUSCH) VE
RRC/NAS katmanları **modülün kendi çipinde** sonlanır — host'a hiç görünmez.
Quectel BC66 ve u-blox SARA-N2/N3 AT komut kılavuzlarının HİÇBİRİNDE host'un ham
hava arayüzü çerçevesine eriştiği bir bölüm yok; her ikisi de baştan sona AT
komut/yanıt metni. Katalogdaki `nb-iot` kaydının kendi tools listesi de bunu
doğruluyor (`wireless-iot.ts:379-388`): OFDMA/subcarrier/transport-block gibi PHY
terimleri YOK, tamamı `AT+CEREG`/`AT+CSQ` türünden yanıtlardan türetilebilecek
kavramlar (Registration Analyzer, Signal Quality Trend, Power Save/PSM/eDRX,
PDP/PDN Context).

### 5. Beş kayıt bir bağımlılık zinciri — MQTT/CoAP'tan FARKLI desen

Hiçbiri `aliasOf` taşımıyor (ikisini de kontrol ettim — dalga 8'in MQTT/CoAP
hatasını tekrar etmemek için). Ama `related` alanları gerçek bir katman zinciri
gösteriyor:

```
hayes-command-set ──┐
                     ├─→ at-commands ─→ lte-modem-at ─┬─→ nb-iot
                     │   (jenerik motor)  (hücresel      └─→ gnss-modem
                     │                     sözlük)            (+ nmea-0183 kanonik)
   (V.250 eski sözlük,
    ATD/ATH/S-register)
```

- **`hayes-command-set`** (`interfaces-framing.ts:934-953`): V.250'nin ORİJİNAL
  sözlüğü — ATD (çevir)/ATA (cevapla)/ATH (kapat)/ATZ (sıfırla), S-register'lar,
  guard-time'lı `+++` kaçışı (komut/veri modu geçişi). Tools: *Dial Command
  Parser, S-Register Browser, Escape Sequence Guard-Time Analyzer* — bunlar
  `at-commands`'ta YOK, kendine özgü.
- **`at-commands`** (`interfaces-framing.ts:906-931`): JENERİK çerçeveleme/ayrıştırma
  motoru — *Command Parser, Response Parser, URC Stream Separator, Parser State
  Machine, Final Result Code Decoder*. Hangi AT lehçesi olursa olsun (dial-up,
  hücresel, GNSS) ortak çekirdek burası.
- **`lte-modem-at`** (`wireless-iot.ts:392-421`): TS 27.007 HÜCRESEL sözlük —
  *Command Database (3GPP TS 27.007 and vendor sets)*, *Cellular Initialization
  Dashboard (IMEI/SIM/operator/RAT/band/IP)* — bu ikisi TEK bir işlemden değil,
  BİRDEN ÇOK ayrıştırılmış komutun BİRİKTİRİLMESİNDEN çıkar (oturum durumu ister,
  `mavlink`/`isotp` türü stateful parser'lardan farklı bir sınıf değil ama
  `ProtocolParser`'ın "SAF, durum biriktirmez" kuralıyla gerilimli — karar 4).
  `related: ['interfaces-framing/framing-stream-protocols/at-commands']`.
- **`nb-iot`** (`wireless-iot.ts:372-390`): `lte-modem-at`'in ayrıştırdığı
  yanıtların NB-IoT'ye özgü alt kümesini yorumlayan gösterge paneli (CEREG'in
  `AcT=9` değeri = NB-IoT, PSM/eDRX zamanlayıcıları). `related` doğrudan
  `lte-modem-at`'e işaret ediyor.
- **`gnss-modem`** (`wireless-iot.ts:423-445`): AT sarmalı + içeriği. Quectel'in
  tümleşik hücresel+GNSS modülleri (EC25/EG25-G/BG96) `AT+QGPSLOC?` (önceden
  ayrıştırılmış konum) VE `AT+QGPSGNMEA="GGA"` (yanıtın İÇİNE gömülü HAM NMEA
  cümlesi) ikisini birden veriyor. Katalog yorumu zaten doğru yönü işaret ediyor
  (`wireless-iot.ts:439-440`): *"NMEA parser'ı yeniden yazılmaz; marine kaydındaki
  kanonik motor kullanılır."* `related: ['marine-navigation/nmea-family/nmea-0183',
  '.../lte-modem-at']` — ikisine de bağımlı, ayrı bağımsız NMEA/UBX alıcılarda
  (u-blox NEO-M8, Quectel L80) AT katmanı YOK, yalnız çıplak NMEA.

Bu, dalga 8'in ByteSource/GATT uyuşmazlığından **farklı bir sınıf** sorun: orada
sözleşme uyuşmazlığıydı, burada **parser katmanlama/yeniden-kullanım** sorunu —
zigbee.ts'in ZCL_CLUSTERS'ı ZCL çekirdeğinin üstüne oturması, ya da gnss-modem'in
nmea-0183'ü çağırması gibi bir örüntü, ama BEŞ kayıt derinliğinde.

### 6. Canlı bağlantı riski DÜŞÜK — 8b'nin aksine

`lte-modem-at`/`gnss-modem`'in `live` sekmesi Web Serial ister
(`wireless-iot.ts:10-11` dosya başı: *"LTE Modem AT ve GNSS Modem ise USB-seri
modem üzerinden Web Serial ile canlı okunur"*). `src/connection/serial/` **zaten
var ve çalışıyor** (BLE GATT'ın Web Bluetooth boşluğunun aksine). AT komutları
satır-yönelimli ASCII'dir (`\r\n` ile kendi kendini sınırlar) — tıpkı hâlâ
`ready` durumdaki `nmea-0183`nin serial üzerinden zaten kanıtladığı gibi.
**Karar 1'e benzer bir blokaj YOK.**

## Kaynaklar

| Konu | Resmi | Çapraz doğrulama |
|---|---|---|
| LoRa ToA | Semtech SX1276/77/78/79 Datasheet Rev.7 (2020-05) §4.1.1.7 | AN1200.13 Rev.1 (2013) + `avbentem/airtime-calculator` (MIT) — CRC terimi farkı karar 2'de |
| AT komut çekirdeği | ITU-T V.250 | — |
| Hücresel AT (CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN) | 3GPP TS 27.007 (ETSI TS 127 007 V18.7.0) | Quectel BG96 AT Commands Manual V2.3 |
| NB-IoT modem sınırı | 3GPP TS 36.211/36.300/36.331 | Quectel BC66 + u-blox SARA-N2/N3 AT kılavuzları |
| GNSS-üzerinden-AT | Quectel EC25/EG25-G/BG96 GNSS AT Commands Manual | u-blox NEO-M8 Data Sheet (AT katmanı YOK, karşılaştırma için) |

## Katalog yolları (doğrulandı)

| Yol | Durum | pluginId/aliasOf | Bu dalgada |
|---|---|---|---|
| `wireless-iot/lora-lpwan/lora` | ~~planned~~ **partial** | yok/yok (bilinçli) | **TAMAM** — motor `protocol-core/timing/lora.ts`, araçlar `/calculators` altında; eklenti YAZILMADI, gerekçe 9a bölümünde |
| `interfaces-framing/framing-stream-protocols/hayes-command-set` | planned | yok/yok | madde 7'ye bağlı (henüz yazılmadı) |
| `interfaces-framing/framing-stream-protocols/at-commands` | ~~planned~~ **ready** | `at-commands` | **TAMAM** |
| `wireless-iot/cellular-iot/lte-modem-at` | ~~planned~~ **ready** | `lte-modem-at` | **TAMAM** — motor `protocols/wireless/cellular/lteModemAt.ts` |
| `wireless-iot/cellular-iot/nb-iot` | ~~planned~~ **ready** | `nb-iot` | **TAMAM** — motor `protocols/wireless/cellular/nbIot.ts` |
| `wireless-iot/cellular-iot/gnss-modem` | ~~planned~~ **ready** | `gnss-modem` | **TAMAM** — motor `protocols/wireless/cellular/gnssModem.ts` |

## BEKÇİ BORCU — YOK

Altı kayıt da zaten katalogda; yalnız `status`/`pluginId` işlenecek. 8/54/172
dokunulmaz. Registry 48 (dalga 8 sonrası) → 9b'de **49** (`at-commands`) →
9c'de **50** (`lte-modem-at`) → 9d'de **51** (`nb-iot`) → 9e'de **52**
(`gnss-modem`). `lora` eklenti hiç YAZILMADI (karar 1'in sonucu),
`hayes-command-set` hâlâ yazılmadı — registry burada KALICI OLARAK 52'de
duruyor, `hayes-command-set` kendi kararını alıp yazılırsa 53 olur. Katalog
sayıları (8/54/172) 9a/9b/9c/9d/9e'nin hiçbirinde değişmedi.

## Kapsam bölmesi

### 9a — LoRa PHY hesap makinesi — **TAMAM**

Ne yazıldı:

| Dosya | İçerik |
|---|---|
| `src/protocol-core/timing/lora.ts` (yeni) | Motor: `calculateLoraSymbolTiming`, `calculateLoraTimeOnAir`, `calculateLoraAirtime`, `estimateLoraSensitivity`, `calculateLoraLinkBudget` |
| `src/protocol-core/timing/lora.test.ts` (yeni) | 26 test — doğrulanmış fixture'lar, CRC açık/kapalı ayırt edici çifti dahil |
| `src/protocol-core/timing/index.ts` | `export * from './lora'` |
| `src/features/calculators/tools/loraTools.tsx` (yeni) | `LoraAirtimeTool`, `LoraLinkBudgetTool`, `LoraBatteryTool` |
| `src/features/calculators/tools/shared.tsx` (yeni) | `StatTable`/`ErrorNotice`/`formatSeconds`/`SectionSwitch` — `timingTools.tsx`ten çıkarıldı, kopyalanmadı |
| `src/features/calculators/registry.ts` | `lora-airtime`, `lora-link-budget` (kategori `timing`) |
| `src/pages/CalculatorPage.tsx` | İki `TOOL_RENDERERS` girdisi |
| `src/translations/tr.ts` + `en.ts` | 58 anahtar |
| `src/app/catalog/domains/wireless-iot.ts` | `lora.status`: `planned` → `partial` (gerekçe dosyada yorumda) |
| `e2e/lora-calculator.spec.ts` (yeni) | 4 test — gerçek tarayıcıda varsayılan girdi, karar 2'nin ekranda görünmesi dahil |

Doğrulama: `npm run typecheck` temiz · `npm test` 2938/2938 · yeni e2e 4/4 ·
ekran gerçekten açıldı (iki araç da ekran görüntüsüyle bakıldı).

**Fixture'lar** (hepsi `lora.test.ts`te, elle doğrulanmış ara adımlarla):

| Girdi | Sonuç |
|---|---|
| SF7/BW125 | Ts = 1.024 ms, Rs = 976.5625 sym/s |
| SF7/BW125/CR4-5, PL=10, preamble 8, CRC açık, explicit | 41.216 ms (yayınlanmış TTN/avbentem değeri) |
| aynısı PL=20 | **56.576 ms** |
| aynısı PL=20, CRC KAPALI | **51.456 ms** ← karar 2'yi ayırt eden çift |
| aynısı PL=25 | 61.696 ms |
| SF12, PL=50, LDRO açık ↔ kapalı | 2301.952 ms ↔ 2138.112 ms |
| SF7/BW125/CR4-5 ham bit hızı | 5468.75 bit/s (datasheet DR5) |

> **Brief'in kendi sayısı düzeltildi.** Yukarıda "SF7/BW125/CR4-5, 20 bayt payload
> → ~61.7 ms" yazıyordu; 61.696 ms **PL=25**'in karşılığıdır, PL=20 için doğru
> değer 56.576 ms'dir. 61.7 muhtemelen uygulama payload'ına LoRaWAN başlığı
> eklenmiş bir sayıydı ama 13 baytlık LoRaWAN yükü de tutmuyor (PL=33 → 71.936 ms).
> PHY seviyesinde tek anlamlı girdi `PL`'dir; araç da onu ister.

**Karar 1 nasıl uygulandı ve bir adım ötesi.** "Yalnız hesap, `decode` yok,
`pluginId` YOK" aynen uygulandı. Düzeltilmiş §2'nin sonucu olarak bir adım daha
gerekti: `ProtocolPlugin` da yazılmadı. Gerekçe — `pluginId` olmayınca
`ProtocolPage` eklentiyi hiç yüklemez (`pluginBinding.resolvePluginId` katalog
alanını okur, registry'ye bakmaz), `plugin.calculators` da metadata-only; geriye
yalnız zorunlu `exampleFrames` alanını doldurmak için **uydurulmuş örnek çerçeve**
kalırdı. Çerçeve çözmeyen bir kayda sahte örnek çerçeve yazmak, katalogdaki
"örneksiz sayfa kullanıcıya hiçbir şey vaat etmez" kuralının tersine çalışırdı.

**Katalog `ready` değil `partial` yapıldı — bilinçli sapma.** Brief `ready`
diyordu. Motor gerçekten var ve koşuyor, ama `/comm/wireless-iot/lora-lpwan/lora`
sayfası hâlâ "planlandı" bildirimi basıyor: `ProtocolPage` yalnız `decode`
sekmesinde eklenti yükler, `timing`/`data`/`diagnostics` sekmelerinin eklentiye
bakan bir yolu yok (bu, `ProtocolPage.test.tsx:73-79`te Modbus RTU üzerinden
KASITLI davranış olarak sınanıyor). `ready` demek ekranda yalan olurdu. Bağlantı
karar 6'ya taşındı.

**Yapılmayanlar** (katalog `tools` listesinde var, 9a kapsamında değildi):
`RSSI / SNR Scatter` canlı/kaydedilmiş ölçüm ister — veri kaynağı yok.

~~`Battery / Energy Estimator`~~ **eklendi** (9a sonrası ayrı tur): motor
`calculateLoraEnergyBudget` (`lora.ts`), araç `lora-battery`, 9 test + 2 e2e.
Girdisi PHY seti değil doğrudan **Time on Air** — enerji modelinin gerçekten
bağlı olduğu tek zaman terimi odur; PHY'yi ikinci kez sormak formu 18 alana
çıkarırdı, bunun yerine `lora-airtime` aracına bağlantı verildi.

Modelin en yanıltıcı terimi **kendiliğinden boşalma**: örnek düğümde (SF7,
saatte bir mesaj, 2 µA uyku, 2400 mAh) günlük 0.0657 mAh ile gönderim yükünü
(0.0548 mAh) GEÇİYOR. Terimi sıfır bırakmak 31.2 yılı 51.2 yıl gösteriyor —
bu yüzden motorda varsayılanı 0 (kendiliğinden kimya varsaymaz), formda 1
öneriliyor ve fark hem birim testinde hem ekranda sınanıyor. Sonuç tablosunda
"boşta kalan payı" da var: yüksekse gönderim sıklığını azaltmak ömrü uzatmaz.

### 9b — AT komut çekirdeği: `at-commands` (jenerik motor) — **TAMAM (yalnız madde 6)**

6. ~~`src/protocols/interfaces/atcommands/`~~ **`src/protocols/serial/atcommands/atCommands.ts`**
   (karar 3 uygulandı) — jenerik çerçeveleme: komut/yanıt ayrımı, URC akışı,
   final result code (`OK`/`ERROR`/`CONNECT`/`+CME ERROR: <n>`/`+CMS ERROR: <n>`),
   `Command Parser State Machine` (IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT).

   Ne yazıldığı:

   | Parça | İçerik |
   |---|---|
   | `atCommandsParser: ProtocolParser` | TEK satırı SAF çözer (karar 4'ün gerektirdiği gibi) — sınıflandırma: `command`/`information`/`final-result-code`/`prompt`/`text` |
   | `createAtLineExtractor(terminator?)` | Akıştan satır kesen `FrameExtractor`; **varsayılan `\r\n`, SABİT DEĞİL** — brief tuzağı (V.250 S3/S4) burada kapatıldı |
   | `createAtCommandSession()` | IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT durum makinesi + URC ayrımı — `atCommandsParser`in DIŞINDA, `createStreamBuffer` ile aynı desen (kapanışlı fabrika, karar 4'ü bozmadan) |
   | 15 `ExampleFrame` | beş `AtLineKind` değerinin tamamını, `ATE0` echo-baskılama dahil |
   | `atCommands.test.ts` | 47 test |
   | `e2e/at-commands-decode.spec.ts` (yeni) | 9 test — gerçek tarayıcıda HEX ofset/vurgulama doğrulaması dahil |

   Katalog: `at-commands` `planned` → **`ready`**, `pluginId: 'at-commands'`.
   `EXPECTED_CATEGORY`: `interfaces-framing`. Registry 48 → **49**.

   **Kasıtlı sınır — CME/CMS kod anlamı YOK.** `+CME ERROR: 10` yapısal olarak
   çözülür (numeric mi verbose mu, kodun kendisi) ama 10'un "SIM not inserted"
   demek olduğu bir tabloya bağlanmaz — TS 27.007 Annex'in ~250 kodluk tablosu
   bu dalganın kapsamı dışında (obd.ts'in PID tablosu uyarısıyla aynı gerekçe).
   Hem birim testinde hem e2e'de "bu metin HİÇBİR yerde görünmemeli" diye
   negatif sınandı.

   **Kasıtlı sınır — yalnız genişletilmiş sözdizimi.** `AT+NAME` ayrıştırılır
   (`command-name`/`action`/`parameters`); temel sözdizimi (`ATD`, `ATZ`) hâlâ
   `kind: 'command'` sayılır ama gövdesi ham kalır — bu, madde 7'nin işi.

7. **`hayes-command-set`in bu motoru nasıl kullanacağı — hâlâ AÇIK, bugün
   YAZILMADI.** Brief'in bu maddedeki "karar 1" atfı bu dalganın kendi karar
   listesindeki (1-6) hiçbirine karşılık gelmiyor — muhtemelen erken bir
   taslaktan kalma referans. Kullanıcıya sorulmadı, dolayısıyla KENDİLİĞİNDEN
   karar verilmedi; yalnız madde 6 (at-commands, sınırları net) uygulandı.
   `hayes-command-set` katalog kaydı hâlâ `planned`, `pluginId` yok,
   dokunulmadı. Küçük ve dar bir karar gerekiyor — örnek çerçeve: ortak
   motoru (`atCommandsParser`/`createAtLineExtractor`) İÇERİDEN çağırıp
   üstüne ATD/ATA/ATH/ATZ/S-register/`+++` sözlüğünü mü koyar, yoksa CAN
   2.0A/2.0B emsali gibi AYNI dosyada ikinci bir `ProtocolPlugin` mi olur.

### 9c — `lte-modem-at` (hücresel sözlük, 9b'ye bağlı) — **TAMAM**

Ne yazıldı: `src/protocols/wireless/cellular/lteModemAt.ts` (+ `.test.ts`, 39
test). Katalog kategorisiyle hizalı dizin (`wireless-iot` → `wireless/`),
`at-commands`i CROSS-IMPORT eder (`gnss-modem → nmea-0183` için brief'in zaten
planladığı desenin aynısı). Katalog: `planned` → `ready`, `pluginId: 'lte-modem-at'`,
`EXPECTED_CATEGORY: wireless-iot`. Registry 49 → **50**.

**Mimari: bileşim, kopyalama değil.** `lteModemAtParser.parse()` önce
`atCommandsParser.parse()`i çağırır (satır sınıflandırma, final result code,
echo — hepsi 9b'de çözülü kalır), sonra yalnız `kind: 'information'` ve
prefiksi bilinen bir komut adına denk gelen çerçeveleri zenginleştirir.
`OK`/`ERROR`/echo/prompt satırları bu dosyaya hiç uğramadan aynen geçer.

8. TS 27.007 komut veritabanı — **madde 8 TAMAM**, on komutun onu da yazıldı
   (CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/CGSN/CCLK/CPIN). Fixture'lar spec'in
   VE vendor kılavuzlarının kendi doğrulanmış örnekleri (araştırma turu: 3GPP TS
   27.007 v18.8.0 doğrudan PDF'ten okundu, Quectel EC25&EC21/u-blox SARA-R4-N4/
   SIMCom SIM7500-7600 çapraz doğrulama). Üç gerçek satıcı çelişkisi bulundu ve
   HİÇBİRİ sessizce çözülmedi:
   - **BER yüzdesi**: u-blox ve SIMCom farklı tablo veriyor → yalnız ordinal
     sınıf (0-7) taşınır, yüzde uydurulmaz.
   - **AcT ≥ 8**: SIMCom'un 8=CDMA/HDR'ı spec'in 8=EC-GSM-IoT'siyle ÇAKIŞIYOR →
     eşik-üstü değerler satıcı-çakışma uyarısı taşır (hem birim testinde hem
     e2e'de sınandı).
   - **CGDCONT `<PDP_addr>`**: SIMCom hep boş döner diyor, u-blox'un kendi
     örneği dolu gösteriyor → boşsa alan hiç üretilmez, "yok" ile "bilinmiyor"
     ayrımı zorlanmaz.

   **CIMI/CGSN bare yanıt — dürüst belirsizlik.** İkisi de öneksiz salt rakam
   döner (V.250'nin bilinçli istisnası), tek satırdan AYIRT EDİLEMEZ — bu
   yüzden `numeric-identifier` alanı ikisini de kapsayan GENEL bir aday,
   "kesinlikle IMSI" ya da "kesinlikle IMEI" iddia edilmez. `AT+CGSN=1`in
   prefiksli formu (`+CGSN: "..."`) kesindir, ayrı `serial-number` alanına gider.

   **CREG/CEREG `reject_cause` anlamı çözülmedi** — CREG TS 24.008 Annex G'ye,
   CEREG TS 24.301 Annex A'ya bakar (FARKLI tablolar), yalnız CEREG tarafı
   kısmen doğrulandı (araştırma #7/#8/#14'ü doğrudan spec'ten teyit etti);
   CREG tarafı hiç doğrulanmadı. Asimetrik/eksik doğrulanmış bir tabloyu
   kısmen yazmak CME/CMS disipliniyle çelişirdi — yapı (cause_type + ham sayı)
   çözülür, HİÇBİR anlam tablosu yazılmaz.

9. **Privacy Masking on Export — motor yazıldı, bağlantı YOK, bilinçli.**
   `maskSensitiveIdentifier()` (son 4 hane görünür, gerisi •) test edilmiş ve
   hazır; `serial-number`/`numeric-identifier` alanları `sensitiveExportValue`
   uyarısıyla DecodePanel'de ZATEN görünür işaretli (ekranda sınandı). Ama
   BAĞLANMADI: keşif turu bu depoda decoded-alan seviyesinde export eden TEK
   mekanizmanın `live-monitor/formatRecord.ts` (CSV/JSON/TXT) olduğunu, ve
   onun HAM BAYT üzerinden çalıştığını buldu — 172 protokolün TAMAMI için
   protokol BAĞIMSIZ, decode edilmiş alan bilmiyor. Maskelemeyi oraya bağlamak
   o jenerik mekanizmayı protokol-farkında yapmayı gerektirirdi — karar 4'ün
   "172 protokolün tamamına yayılır" uyarısıyla AYNI SINIF risk, tek dalganın
   kapsamının çok ötesinde. ICCID/telefon numarası maskelemesi de YOK — kaynak
   komutları (AT+CCID/AT+QCCID, AT+CNUM) madde 8'in listesinde değil.
10. `Cellular Initialization Dashboard` — **motor yazıldı
    (`createCellularInitializationState`), React UI YOK.** Karar 4 uygulandı:
    `features/live-monitor/monitorIngestor.ts`teki `MonitorIngestor` ile AYNI
    desen — React'ten bağımsız, kapanışlı, saf durum biriktirici,
    `lteModemAtParser`in ürettiği `ParsedFrame`leri tüketir, `at-commands`
    oturum makinesini (echo/URC ayrımı) hiç bilmez. UI katmanı karar 6'nın
    hesap sekmesi bağlantısıyla aynı sınıf iş, kendi turunu hak ediyor.

    Katalogun "model, firmware, IMEI, SIM, operator, RAT, band, IP" vaadinden
    bu dalgada YALNIZ IMEI/SIM/operator/RAT(AcT)/IP üretilebilir —
    model/firmware (ATI, AT+CGMM, AT+CGMR) ve bant (vendor-özel, ör.
    AT+QNWINFO) madde 8'in komut kümesinde YOK, LoRa'nın RSSI/SNR Scatter'ıyla
    aynı gerekçeyle uydurulmadı.

Doğrulama: `npm run typecheck` temiz · `npm test` 3033/3033 (39 yeni) ·
`e2e/lte-modem-at-decode.spec.ts` (yeni) 9/9 — HEX ofset/vurgulama gerçek
tarayıcıda sınandı (LAC `1A2D`→6701, hücre kimliği `0001A2B3`→107187, CCLK
`+08`→2 saat hepsi ekranda doğrulandı) · ekran görüntüsüyle bakıldı (CSQ,
CREG, CCLK, CGSN-bare).

### 9d — `nb-iot` (9c'ye bağlı) — **TAMAM**

Ne yazıldı: `src/protocols/wireless/cellular/nbIot.ts` (+ `.test.ts`, 22
test). `lte-modem-at`in `atCommandsParser`ini DEĞİL, `lteModemAtParser`ini
çağırır — karar 5'in "içeriden çağırır" ifadesinin birebir karşılığı, İKİ
KATMAN derin bileşim (`nb-iot → lte-modem-at → at-commands`). Katalog:
`planned` → `ready`, `pluginId: 'nb-iot'`, `EXPECTED_CATEGORY: wireless-iot`.
Registry 50 → **51**.

11. AcT=9 tespiti VE PSM/eDRX zamanlayıcı çıkarımı — **madde 11 TAMAM.**

    **AcT=9 tespiti**: CREG/CEREG/COPS'un `lte-modem-at` tarafından ZATEN
    çözülmüş `access-technology` alanı üstüne bir eşleşme etiketi ekler
    (`nb-iot-access-technology-match`) — yeniden ayrıştırma YOK. AcT=9 ise
    uyarısız "NB-IoT (E-UTRAN NB-S1 mode)"; değilse "NB-IoT değil (AcT=n)" +
    uyarı.

    **PSM (`AT+CPSMS?`)**: `lte-modem-at`in madde 8 komut kümesinde bu komut
    YOKTU, burada eklendi. **Brief'in kendi Tuzaklar notu ("GPRS Timer 2/3,
    §10.5.7.4a") DÜZELTİLDİ** — araştırma turu (ETSI TS 127 007 V18.7.0
    doğrudan PDF + Quectel BG96/BC66 + SIMCom SIM7022 çapraz doğrulama)
    T3324 (Active-Time) ve T3412-extended (Periodic-TAU) için AYRI iki tablo
    olduğunu gösterdi: T3324 → **GPRS Timer 2** (TS 24.008 Table 10.5.163,
    yalnız dört birim: 2sn/1dk/decihour/deactivated), T3412-ext → **GPRS
    Timer 3** (Table 10.5.163a, yedi birim: 10dk/1sa/10sa/2sn/30sn/1dk/
    **320sa**/deactivated). İkisini TEK tabloya bağlamak sessiz-yanlış saniye
    üretirdi — BG96 kılavuzunun kendi örneği (`"00000100"`→40dk T3412,
    `"00001111"`→30sn T3324) iki tabloyu da bağımsız doğruluyor, fixture
    olarak aynen kullanıldı (gerçek tarayıcıda da doğrulandı, aşağı bkz.).
    Rezerve birim kodu (Timer 2'de 011-110) CREG/CEREG `reject_cause`
    disipliniyle aynı: saniye UYDURULMAZ, uyarı basılır.

    **eDRX (`AT+CEDRXS?` / `+CEDRXP` / `AT+CEDRXRDP`)**: döngü tablosu (TS
    24.008 Table 10.5.5.32) yalnız **NB-S1 modu** (`AcT_type=5`) için
    doğrulandı (Quectel BC26 + u-blox SARA-N2/N3 çapraz teyitli, 10 kod).
    WB-S1 (`AcT_type=4`, LTE-M) FARKLI bir tablo kullanır ve BİLEREK
    yazılmadı — o modda gelen bir değer saniyeye çevrilmez, ayrı uyarı
    taşır. Paging Time Window bağımsız doğrulanmadı, ham dize kalır (aynı
    disiplin). `+CEDRXP` (URC) ve `AT+CEDRXRDP` (okuma) AYNI dört parametre
    şeklini paylaştığı için TEK çözücüye dispatch edilir.

12. **`decode` sekmesi açıldı — bilinçli, karar 5'in doğal sonucu, kullanıcıya
    SORULMADI.** Katalogdaki `nb-iot` kaydının `tabs`'ında `decode` YOKTU
    (yalnız `overview/timing/data/diagnostics/examples`) — bu motor tam
    olarak decode-zamanı bir zenginleştirme olduğundan, eklemeden `ready` +
    `pluginId` yazmak 9a'nın "ready sayfada yalan olmasın" dersini çiğnerdi
    (`ProtocolPage.tsx`in `pluginId`i yalnız `decode` sekmesinde okuduğu
    doğrulandı). `live`/`build` EKLENMEDİ — yeni bir canlı bağlantı ya da
    komut gönderme yeteneği yok. Bu, brief'in "verilmesi gereken kararlar"
    listesinde YOKTU — karar 5 + 9a emsalinin zorunlu sonucu olarak
    kendiliğinden uygulandı, kod yorumunda ve burada açıkça işaretli.
13. Katalogun vaat ettiği STATEFUL panolar (Connection State Machine,
    Registration Analyzer, Power Save Analyzer, Socket/Connection Timeline)
    bu dalgada YOK — `lte-modem-at`in Cellular Initialization Dashboard'uyla
    AYNI SINIF iş (karar 4: parser saf kalır, biriktirme UI katmanında),
    kendi turunu bekliyor. `timing`/`data`/`diagnostics` sekmeleri hâlâ
    `tools` metin listesiyle "planlandı" gösterir.

**Bekçi güncellemesi (unutulmuş olsaydı testte yakalanırdı, yakalandı):**
`src/protocols/index.test.ts`teki `BUILT_IN_IDS`/`EXPECTED_CATEGORY`
listelerine `nb-iot` eklenmemişti — ilk test turu 2 testte bunu yakaladı,
düzeltildi.

Doğrulama: `npm run typecheck` temiz · `npm test` 3055/3055 (22 yeni) ·
`e2e/nb-iot-decode.spec.ts` (yeni) 9/9 · tüm e2e paketi 445/445 (bir turda
`lte-modem-at-decode.spec.ts`ten TEK bir izole flake görüldü — dosyayı tek
başına iki kez çalıştırınca 9/9 yeşil, benim değişikliklerimle ilgisi yok,
5 paralel worker'ın aynı önizleme sunucusuna birden yüklenmesinden kaynaklı
bilinen sınıf bir gecikme) · ekran gerçekten açıldı (`npm run dev`, PSM
etkin/deactivated ve AcT=9/AcT≠9 karşıtları taze tarayıcıda görüntülendi).

### 9e — `gnss-modem` (9c + nmea-0183'e bağlı) — **TAMAM**

Ne yazıldı: `src/protocols/wireless/cellular/gnssModem.ts` (+ `.test.ts`, 16
test). `lte-modem-at`i (AT katmanı) VE `nmea-0183`ü (gömülü cümle) BİRLİKTE
çağırır — 9d'nin kurduğu "üstteki motoru içeriden çağır" şablonunun bu kez
İKİ motora bağımlı hâli (karar 5). Katalog: `planned` → `ready`,
`pluginId: 'gnss-modem'`, `EXPECTED_CATEGORY: wireless-iot`; `tabs`'ta
`decode` ZATEN vardı (9d'nin aksine, burada tab eklemek gerekmedi). Registry
51 → **52** — beş kayıtlık AT-komut zincirinin (`hayes-command-set` hariç)
TAMAMI artık kayıtlı.

12. `AT+QGPSGNMEA` → `nmea-0183`ye devir — **madde 12 TAMAM, motor TEKRAR
    YAZILMADI.** `+QGPSGNMEA: $GPGGA,...,*77` satırının `parameters` alanı
    (Quectel EC25&EC21 GNSS AT Commands Manual V1.1 §3.2'nin kendi
    `<nmeasrc>` örneği) `splitParameterTokens`le VİRGÜLE BÖLÜNMEZ — cümlenin
    kendi virgülleri AT parametre ayracı sanılırdı, ilk token'dan sonrasını
    sessizce keserdi. Bunun yerine `parameters` alanının HAM BAYTLARI
    doğrudan `nmea0183Parser`e verilir; dönen alanlar `rebaseField`le DIŞ
    `data` tamponundaki gerçek ofsetine kaydırılır (`tokenField`in
    `paramsOffset + token.offset` deseninin, bu kez BAŞKA BİR PARSER'IN tüm
    çıktısına uygulanmış hâli — 9c/9d'de görülmemiş YENİ bir teknik, gerçek
    tarayıcıda HEX vurgulamayla doğrulandı, aşağı bkz.). Bozuk checksum gibi
    iç motorun kendi teşhisi de AYNEN taşınır — motor tekrar yazılmadığı
    gibi, motorun teşhisi de tekrar üretilmez. Cümle TİPİ (GGA/RMC/GSA/GSV/
    VTG/GNS — Quectel'in kendi test-komutu listesi) hiç FARK ETMİYOR,
    `nmea0183Parser` zaten hepsini tek biçimde çözüyor (GGA VE RMC ikisi de
    fixture'landı). Gömülü metin bir NMEA cümlesi olarak hiç ÇÖZÜLEMEZSE
    dış çerçeve BİLİNÇLİ OLARAK geçersiz sayılır (`frame.valid: false`,
    checksum uyuşmazlığından daha ciddi bir sınıf) ama AT-katmanı alanları
    (kind/prefix/parameters) SİLİNMEZ — kısmi çözüm gösterilir (spec §47).
13. `AT+QGPSLOC` — **madde 12'nin ikinci yarısı TAMAM, "dar" kapsam BİREBİR
    UYGULANDI.** `+QGPSLOC: <UTC>,<latitude>,<longitude>,<hdop>,<altitude>,
    <fix>,<cog>,<spkm>,<spkn>,<date>,<nsat>` (Quectel §3.1, doğrudan PDF'ten
    doğrulandı) — brief'in kendi "dar bir alan kümesiyle çözülür
    (fix/lat/lon/alt/sat/hdop)" sınırı harfiyen uygulandı, `UTC`/`cog`/
    `spkm`/`spkn`/`date` HİÇ ÜRETİLMEZ (CGDCONT'un tail-parametre
    disipliniyle aynı sınıf, burada gerisi EMİLMEZ bile). `<latitude>`/
    `<longitude>` Quectel'e özgü TEK-token+hemisfer-harfi biçiminde
    (`3150.7223N`) gelir — NMEA'nin kendi iki-tokenli `lat,N` biçiminden
    FARKLI. `AT+QGPSLOC=<mode>` biçimi de DEĞİŞTİRİR (0/1: harf sonekli,
    2: zaten imzalı ondalık derece) ama parser SAF kalmak zorunda (karar 4)
    — çözüm TOKENİN KENDİSİNDEN biçim sezmek (harf sonekli mi değil mi),
    dışarıdan `<mode>` durumu GEREKMEZ. ddmm.mmmm→ondalık formülü
    `nmeaSentences.ts`teki `convertCoordinate`in AYNISI (48.1173/
    11.516666... fixture'ıyla çapraz doğrulandı) — export edilmediği için
    (lte-modem-at'in kendi tablolarını yerel tutması emsali) yerel bir kopya
    yazıldı. `<fix>` yalnız Quectel'in belgelediği 2/3 (2D/3D) tanır, başka
    değer (ör. 1) mod UYDURULMAZ, uyarı basılır.

**Verilmeyen** (brief'in kendi madde 13'ünde zaten "stateful/timeline
araçlar, karar 4'ün kapsamı" diye işaretli kısım): TTFF Calculator, Fix Loss
Detector, GNSS+Cellular Correlation Timeline, Position Dashboard'un React
UI'ı, GNSS Control Commands (power/update rate/constellation) — hepsi
`lte-modem-at`in Cellular Initialization Dashboard'uyla AYNI SINIF iş, kendi
turlarını bekliyor.

Doğrulama: `npm run typecheck` temiz · `npm test` 3071/3071 (16 yeni) ·
`e2e/gnss-modem-decode.spec.ts` (yeni) 7/7 · tüm e2e paketi 452/452 (bu
turda flake YOK) · ekran gerçekten açıldı (`npm run dev`, QGPSLOC/QGPSGNMEA-
GGA/QGPSGNMEA-bozuk üç örnek taze tarayıcıda görüntülendi — rebase edilen
`checksum` alanının HEX vurgusu satırın doğru yerinde, elle doğrulandı).

**Beş kayıtlık AT-komut zinciri (`hayes-command-set → at-commands →
lte-modem-at → {nb-iot, gnss-modem}`) TAMAMLANDI** — `hayes-command-set`
hariç dördü de `ready`, registry 47 (dalga 7 sonrası) → 52. Brief'in dosya
başındaki "beş kayıt bir bağımlılık zinciri" şeması (bölüm 5) artık
tamamen koda karşılık geliyor.

## Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

Durum: **hepsi karara bağlandı.** 1 ve 2 uygulandı (9a). **3, 4, 5 ve 6 verildi**
(2026-08-20, kullanıcı onayı) — hepsinde brief'in kendi önerisi seçildi, aşağıda
her kararın altında "VERİLDİ" satırıyla yazılı. 9b'nin önünde engel kalmadı.

### Karar 1 — `lora` yalnız hesap mı, hesap+mini-decode mi? — **UYGULANDI (9a)**

`tabs` listesinde `decode` yok — bu KASITLI mı (katalog yazarı PHY header'ı
ayrıştırmayı hiç düşünmedi) yoksa hesap makinesinin PHY Parameter Set'i
kullanıcının ELLE gireceği anlamına mı geliyor (SF/BW/CR/PL kullanıcı formundan)?

**Öneri: yalnız hesap, `decode` yok, `pluginId` YOK.** `tabs`'ın kendisi zaten
kararı veriyor — girdi elle form, `calculators` yeter. `ProtocolPlugin.parser`
opsiyonel (`protocol-core/types.ts`), `DecodePanel`'in `pluginId` zorunlu kılıp
kılmadığını 9a başında hızlıca doğrula (küçük bir kontrol, karar değil).

> **Sonuç:** öneri uygulandı; "küçük kontrol" büyük çıktı. `pluginId`'yi zorunlu
> kılan tek yer `ProtocolPage.tsx:380` — ve o satır yalnız `decode` sekmesini
> yönetiyor. Hesap sekmelerinin eklentiye bakan bir yolu HİÇ yok. Bunun sonucu
> olarak `ProtocolPlugin` de yazılmadı (gerekçe: "9a — ne yapıldı").

### Karar 2 — ToA formülünde CRC terimi: sabit mi, parametrik mi? — **UYGULANDI (9a)**

`avbentem`/2013-AN1200.13 sabit `+16` kullanıyor (CRC hep açık varsayılıyor);
güncel Semtech Rev.7 parametrik `16·CRC` veriyor.

**Öneri: parametrik (güncel datasheet).** Katalogdaki *"Preamble & Header Mode
Inspector (explicit / implicit, CRC, LDRO)"* aracı zaten CRC'yi KULLANICI
SEÇENEĞİ olarak vaat ediyor — sabit varsayım bu vaadi karşılamaz. Test
fixture'ında CRC açık/kapalı İKİ ayrı örnek gerekir (yalnız "hep açık" durumunu
sınamak `avbentem` ile farkı asla ortaya çıkarmaz).

> **Sonuç:** parametrik uygulandı (`lora.ts`, `16 * crcTerm`). İki fixture da
> yazıldı: PL=20'de CRC açık 56.576 ms, kapalı 51.456 ms. Fark ekranda da
> sınanıyor (`e2e/lora-calculator.spec.ts`, kullanıcı onay kutusunu kapatıyor).
> İki kaynağın farkı hem dosya başı yorumunda hem de onay kutusunun altındaki
> kullanıcıya görünen açıklamada yazılı — "avbentem farklı sonuç veriyor"
> tuzağı ikisiyle de kapatıldı.

### Karar 3 — AT motoru hangi dizine gider? — **VERİLDİ: `src/protocols/serial/atcommands/`**

`src/protocols/` alt dizinleri (CLAUDE.md): `serial · industrial · automotive ·
marine · aerospace · building · network · wireless`. AT komutları ne kablosuz
ne endüstriyel — hücresel/seri bir "framing" protokolü, katalogda İKİ domain'e
yayılıyor (`interfaces-framing` kanonik, `wireless-iot` hücresel görünüm).

**Öneri: `src/protocols/serial/atcommands/`.** Gerekçe: `interfaces-framing`
domain'i zaten bu motorun KANONİK katalog evi; `serial/` dizini de bugüne kadar
boştu (CLAUDE.md'nin "boş klasörler ileride dolacak" notu) ve AT'nin doğası
seri hat üzerinde metin çerçeveleme — `wireless/`e koymak `lte-modem-at`
YÜZÜNDEN yanlış bir emsal kurar (motor wireless değil, ÜZERİNDE çalıştığı
CİHAZ wireless).

> **VERİLDİ:** öneri seçildi. Beş kaydın da motoru `src/protocols/serial/atcommands/`
> altında toplanır; `wireless-iot` domain'indeki üç kayıt (`lte-modem-at`,
> `nb-iot`, `gnss-modem`) oradan beslenir. `protocol-core/framing/at/` seçeneği
> elendi: katalogdaki `at-commands` kaydının kendi eklentisi olması bekleniyor.

### Karar 4 — Stateful dashboard'lar `ProtocolParser`'ın saf sözleşmesiyle nasıl uyuşur? — **VERİLDİ: parser saf kalır**

`Cellular Initialization Dashboard`, `TTFF Calculator`, `Fix Loss Detector`
BİRDEN ÇOK transaction'ı biriktirir — ama `protocol-core/types.ts`: *"Akış
durumu (yarım frame) stream katmanının işi, parser'ın değil."*

**Öneri: `parser` TEK transaction'ı saf çözer (mevcut sözleşme korunur);
biriktirme/dashboard UI katmanında (feature bileşeni) yaşar, `live-monitor`'ün
zaten yaptığı gibi (ayrı transaction'ları zaman çizelgesinde toplamak zaten bu
katmanın işi — bkz. `src/features/live-monitor/`).** Yeni bir "stateful parser"
sınıfı İCAT ETME — bu sözleşmeyi bu dalgada bükmenin bedeli 172 protokolün
TAMAMINA yayılır (types.ts'in kendi uyarısı).

> **VERİLDİ:** öneri seçildi. `ProtocolParser` imzası DEĞİŞMEZ — ne ikinci bir
> stateful sözleşme, ne `parse(bytes, context?)` gibi genişletilmiş imza.
> `Cellular Initialization Dashboard`, `TTFF Calculator` ve `Fix Loss Detector`
> feature katmanında yaşar; girdileri parser'ın ürettiği tekil `ParsedFrame`
> dizisidir. 9c/9e yazılırken bu sınır aşılırsa dur ve sor.

### Karar 5 — `nb-iot`/`gnss-modem` nasıl "bağlı" olacak? — **VERİLDİ: ayrı `pluginId` + iç çağrı**

Üçü de mümkün, ikisi hâlâ `related` (motor paylaşımı ama İKİNCİ bir yorumlama
katmanı — wireless-m-bus/mqtt/coap'ın SIFIR-yeni-kod `aliasOf`'undan farklı).

**Öneri: `aliasOf` DEĞİL, ayrı `pluginId` + iç çağrı.** `nb-iot`/`gnss-modem`
gerçek katma değer üretiyor (AcT filtreleme, PSM/eDRX çıkarımı, NMEA-cümle
ayıklama) — `aliasOf` "ikinci parser yazma, birebir aynı motor" demektir
(CLAUDE.md), burada aynı değil. `gnss-modem/nmea-0183` emsali zaten `related`
kullanıyor, `aliasOf` değil — tutarlı.

> **VERİLDİ:** öneri seçildi. Beş kaydın beşi de kendi `pluginId`sini alır;
> hiçbiri `aliasOf` DEĞİLDİR. `nb-iot` ve `gnss-modem` `lte-modem-at`in
> ayrıştırıcısını İÇERİDEN çağırır, kendi yorumlama katmanını üstüne yazar
> (AcT=9 tespiti + PSM/eDRX çıkarımı; `AT+QGPSGNMEA` yanıtından NMEA cümlesi
> ayıklayıp `nmea-0183` motoruna devretme). NMEA parser'ı YENİDEN YAZILMAZ.

### Karar 6 — Hesap sekmeleri protokol sayfasına nasıl bağlanacak? — **VERİLDİ: `calculatorIds` + bağlantı**

Bugün `ProtocolPage` yalnız `decode` sekmesinde eklenti yükler; `timing`, `data`,
`diagnostics` sekmeleri katalogdaki `tools` **metin listesini** anahtar kelimeyle
süzüp basar, üstüne "planlandı" bildirimi koyar. Bu kasıtlıdır ve sınanır
(`ProtocolPage.test.tsx:73-79`, tamamen `ready` olan Modbus RTU üzerinden).

Sonuç: LoRa hesap makinesi `/calculators` altında ÇALIŞIYOR ama LoRa protokol
sayfasından ne görünüyor ne de bağlantısı var. Aynı durum ileride hesap taşıyan
her kayıt için tekrarlanacak.

Seçenekler:

- **(a) Bırak.** Hesaplar `/calculators`ta yaşar, protokol sayfası "planlandı"
  der. En ucuz, ama katalogdaki `tools` vaadi (`Time on Air Calculator` vb.)
  o sayfada karşılıksız kalır.
- **(b) Bağlantı ver.** Katalog kaydına hesap aracı id'si taşıyan bir alan
  eklenir (ör. `calculatorIds?: readonly string[]`), protokol sayfası ilgili
  sekmede "bu araca git" bağlantısı basar. Küçük, geri dönüşü kolay; sayfa hâlâ
  hesabı İÇİNDE göstermez.
- **(c) Gömme.** `ProtocolPage`e hesap paneli mount eden yeni bir dal eklenir
  (`TOOL_RENDERERS`ın protokol tarafındaki karşılığı). En doğrusu ama 172 kaydı
  ilgilendiren bir sözleşme ve mevcut testi değiştirir.

**Öneri: (b).** `ready`'nin ne demek olduğunu bozmadan vaadi karşılar ve (c)'yi
ileride engellemez. (c) kendi dalgasını hak eder — karar 4'ün "stateful dashboard
UI katmanında yaşar" sonucuyla aynı yere bakıyor, ikisi birlikte tasarlanmalı.

> **VERİLDİ: (b).** `CatalogProtocol`e opsiyonel `calculatorIds?: readonly string[]`
> eklenir, `ProtocolPage` ilgili sekmede araca bağlantı basar. Kapsam ve bekçiler:
>
> - `lora` ilk kullanıcı: `['lora-airtime', 'lora-link-budget', 'lora-battery']`.
> - `catalog.test.ts`e iki yönlü bekçi: her `calculatorIds` girdisi
>   `CALCULATOR_TOOLS`ta VAR olmalı (`registry.test.ts`in protokol tarafındaki
>   karşılığı). Ölü id sessizce 404'e düşer, yalnız burada yakalanır.
> - `ProtocolPage.test.tsx:73-79` (Modbus RTU, `calculatorIds` yok) DEĞİŞMEDEN
>   geçmeli — dal yalnız alan doluyken kurulur.
> - Bu dalgada katalog sayıları (8/54/172) ve `lora.status` (`partial`)
>   DEĞİŞMEZ. `ready`'ye yükseltmek (c)'nin işi.
>
> Kendi turu var, 9b-9e zincirinden bağımsız; sırayı bozmadan araya alınabilir.

**UYGULANDI (2026-08-20).** `CatalogProtocol`e `calculatorIds?: readonly
string[]` eklendi (`app/catalog/types.ts`), `lora` kaydı
`['lora-airtime', 'lora-link-budget', 'lora-battery']` taşıyor
(`app/catalog/domains/wireless-iot.ts`). `ProtocolPage` yalnız **`timing`
sekmesinde** bağlantı listesi basıyor — `related` bloğuyla aynı
`<li><Link></li>` deseni, ad `findCalculator` ile çözülüyor
(`pages/ProtocolPage.tsx`). Bilinçli dar seçim: sekme eşlemesi genel bir
`CalculatorCategory → WorkspaceTab` tablosu değil, sabit `activeTab ===
'timing'` kontrolü — lora'nın üç aracı da zaten `timing` kategorisinde ve
kaydın kendi yorumu bunu doğruluyor ("'timing' sekmesi olmadan LoRa sayfası
anlamsız kalır"). **Tuzak, ileride:** `checksum`/`conversion` kategorili bir
`calculatorIds` girdisi taşıyan bir protokol gelirse bu bağlantı hiçbir
sekmede GÖRÜNMEZ (yalnız `timing` dinleniyor) — o zaman genelleştirmek
gerekir, bu dalgada YAPILMADI (kapsam dışı, yalnız lora vardı).

Bekçiler: `catalog.test.ts`e `'resolves every calculatorIds entry to a known
calculator tool'` eklendi (`related`/`aliasOf` testleriyle aynı desen).
`ProtocolPage.test.tsx:73-79` DOKUNULMADI, değişmeden yeşil. Yeni üç test
eklendi (`timing`te üç bağlantı + doğru `href`, `diagnostics`te bağlantı YOK,
`calculatorIds`i olmayan protokolde bağlantı YOK). `calc.loraAirtime.name`
gibi anahtarlar zaten vardı; yalnız `protocol.relatedCalculators` yeni
(`translations/tr.ts` + `en.ts`).

Doğrulama: `npm run typecheck` temiz, `npm test` 3075/3075, `npm run test:e2e`
452/452. Tarayıcıda elle açıldı (`/comm/wireless-iot/lora-lpwan/lora?tab=timing`):
üç bağlantı görünüyor, `diagnostics` sekmesinde yok, tıklanınca gerçek
`/comm/calculators/lora-airtime` sayfasına gidiyor, konsol hatasız.

## Tuzaklar

- ~~**CRC terimi (karar 2)**~~ **KAPATILDI (9a)**: parametrik yazıldı, fark
  `lora.ts` dosya başında + kullanıcıya görünen onay kutusu açıklamasında + iki
  ayrı fixture'da belgeli.
- **AT satır sonu**: bazı modemler `\r\n`, bazıları yalnız `\r` kullanır (V.250
  `S3`/`S4` registerları bunu SEÇİLEBİLİR yapar) — sabit `\r\n` varsayımı sessiz-
  yanlış çerçeveleme üretir.
- **`+++` guard-time**: literal `+++` verideyse (ör. bir URL ya da encoded
  payload içinde) yanlış pozitif — guard-time (sessizlik penceresi) kontrolü
  ZORUNLU, yalnız üç `+` aramak YETMEZ (katalog kod yorumu bunu zaten
  işaretliyor, `interfaces-framing.ts:903-904`).
- **IMSI/IMEI/ICCID**: bu değerler KULLANICI VERİSİ sayılır (CLAUDE.md "kullanıcı
  verisi yerelde kalır") — export maskesi 9c'nin ADI GEÇEN özelliği, atlanamaz.
- ~~**PSM/eDRX zamanlayıcıları**: TS 27.007 kodlu (ör. `T3324`/`T3412` GPRS
  Timer 2/3 formatında, 3 bit birim + 5 bit değer) — ham sayıyı doğrudan
  saniyeye çevirmek YANLIŞ, birim tablosunu (TS 24.008 §10.5.7.4a) doğrula.~~
  **DÜZELTİLDİ (9d) — bu not kendisi yanlıştı.** T3324 ve T3412-extended AYRI
  tablolar kullanıyor: T3324 → GPRS Timer 2 (TS 24.008 Table 10.5.163, dört
  birim), T3412-ext → GPRS Timer 3 (Table 10.5.163a, yedi birim, en büyüğü
  320 saat). Tek clause'a (`§10.5.7.4a`) bağlamak bu ikisini karıştırırdı —
  ETSI TS 127 007 V18.7.0 + üç bağımsız vendor kılavuzu (BG96/BC66/SIM7022)
  çapraz doğrulandı, detay "9d — ne yapıldı"da. eDRX döngü tablosu (Table
  10.5.5.32) yalnız NB-S1 modunda (AcT_type=5) doğrulandı, WB-S1 BİLEREK
  yazılmadı.
- **`related` zincirini `aliasOf` sanma**: bu dalganın EN BÜYÜK risk — beş
  kayıt birbirine `related` ile bağlı ama HİÇBİRİ `aliasOf` değil; birini
  yanlışlıkla alias sayıp "zaten çalışıyor" deme (dalga 8'in MQTT/CoAP
  hatasının TERSİ: orada yanlışlıkla planned sanmıştım, burada yanlışlıkla
  alias sanma riski var).

## Çalışma kuralları

- Komutlar: `npm run typecheck` · `npm test` · `npm run test:e2e`.
- Her alt dalga kendi commit'i: `feat: … (Faz 10, dalga 9a/9b/…)`.
- 9a en ucuz/en izole — kararsız kalınırsa ilk ondan başla.
- 9b→9c→9d/9e sırası ZORUNLU (bağımlılık zinciri), paralel başlanamaz.
- **Hesap aracı yazarken emsal `obd.ts` DEĞİL**, `src/features/calculators/`tir
  (düzeltilmiş §2). Motor `protocol-core/` altına, React aracı `tools/` altına,
  kayıt `registry.ts` + `CalculatorPage.tsx` ikilisine gider — `registry.test.ts`
  bu ikiliyi iki yönlü bekçiler, unutulan taraf testte düşer.

## ~~Bilinen kırık~~ — KAPATILDI (9a sonrası ayrı tur)

`e2e/lorawan-decode.spec.ts:110` "Confirmed Data Down + FOpts" düşüyordu:
`fieldRow(page, 'fopts')` görünmüyordu. 9a'nın hiçbir dosyasıyla ilgisi yoktu —
`git stash` ile HEAD'de de aynı şekilde düştüğü doğrulanmıştı.

**Teşhis: kod değil, test bayattı.** Dalga 8 (`ea02949`, FOpts MAC komut borcu)
tek ham `fopts` alanını kaldırıp zinciri CID CID çözmeye başladı; test hâlâ
dalga 7b davranışını bekliyordu. Beklediği uyarı anahtarı
(`protocol.lorawan.warning.foptsNotDecoded`) da sözlükten kalkmıştı.

**Kök sebep ayrıca kapatıldı:** `e2e/` `tsconfig.json`ın `include`ında yoktu, bu
yüzden ölü çeviri anahtarı `npm run typecheck`te de görünmüyordu. `e2e` ve
`playwright.config.ts` derlemeye alındı; tsc temiz kaldı ve bekçinin gerçekten
ısırdığı ölü anahtarla sınandı (TS2551). Aynı sınıf hata bir daha e2e'de sessiz
kalmaz.

Test iki teste bölündü: biri MAC komutunun çözüldüğünü (DutyCycleReq +
MaxDCycle=3), diğeri bilinmeyen CID'den sonra kalanın hâlâ ham+uyarılı kaldığını
sınıyor — ikincisi eski testin asıl niyetini, hâlâ doğru olduğu yerde koruyor.
Tüm e2e paketi 416/416 yeşil.

## Öneri

~~**9a'yı hemen başlat**~~ — **bitti** (yukarı bkz.). Gerçekleşen: keşif turunun
"calculators altyapısı canlı" öncülü yanlış çıktığı için iş tarif edilenden geniş
oldu (motor + React aracı + kayıt + i18n + e2e), ama hiçbiri mimari karar
gerektirmedi. Karar 6 bunun artığıdır ve 9a'yı bloklamadı.

~~**9b-9e'nin önünde engel kalmadı**~~ — **9b'nin `at-commands` kısmı bitti**
(yukarı bkz. "9b — ne yapıldı"). `hayes-command-set` (madde 7) kasıtlı olarak
YAZILMADI — brief'teki "karar 1" atfı bu dalganın 1-6 karar listesindeki
hiçbirine karşılık gelmiyor (muhtemelen eski taslak artığı), kullanıcıya
sorulmadan kendiliğinden karar verilmedi. Küçük, dar bir soru: ortak motoru
İÇERİDEN mi çağırır, yoksa CAN 2.0A/2.0B emsali gibi aynı dosyada ikinci bir
`ProtocolPlugin` mi olur.

~~Sıradaki iş **9c: `lte-modem-at`**~~ — **bitti** (yukarı bkz. "9c — ne yapıldı").
On komutun onu da yazıldı, üç gerçek satıcı çelişkisi (BER%, AcT≥8, CGDCONT
PDP_addr) hiçbiri sessizce çözülmedi. Privacy masking motoru hazır ama
BAĞLANMADI (jenerik export ham bayt üzerinden çalışıyor, protokol-farkında
değil — bağlamak 172 protokolün tamamını ilgilendiren bir sözleşme değişikliği
olurdu). Cellular Initialization Dashboard'ın motoru hazır, React UI yok —
karar 6'yla aynı sınıf iş, kendi turunu bekliyor.

~~Sıradaki iş **9d: `nb-iot`**~~ — **bitti** (yukarı bkz. "9d — ne yapıldı").
AcT=9 tespiti + PSM (T3412/T3324, GPRS Timer 3/2 — brief'in kendi notu
yanlıştı, düzeltildi, Tuzaklar bölümüne bkz.) + eDRX (yalnız NB-S1)
zamanlayıcı çözümü yazıldı; `decode` sekmesi karar 5'in doğal sonucu olarak
(kullanıcıya sorulmadan, gerekçeli) açıldı. Registry 50 → 51.

~~Sıradaki iş **9e: `gnss-modem`**~~ — **bitti** (yukarı bkz. "9e — ne
yapıldı"). `AT+QGPSGNMEA`nın gömülü NMEA cümlesi `nmea-0183` motoruna
devredildi (motor TEKRAR YAZILMADI, `rebaseField` ile HEX ofsetleri DIŞ AT
satırına doğru kaydırıldı — gerçek tarayıcıda doğrulandı), `AT+QGPSLOC` dar
bir alan kümesiyle (fix/lat/lon/alt/sat/hdop) çözüldü. Registry 51 → 52.

**Beş kayıtlık AT-komut zinciri (`hayes-command-set → at-commands →
lte-modem-at → {nb-iot, gnss-modem}`) TAMAMEN BİTTİ** — bu dalganın asıl
omurgası kapandı. Geriye BAĞIMSIZ üç iş kaldı, hiçbiri zincire bağlı değil:

~~**Karar 6** — hesap sekmelerinin protokol sayfasına bağlanması
(`calculatorIds`). Kendi turu var, `lora`nın ilk kullanıcısı olacak.~~
**bitti** (yukarı bkz. "UYGULANDI (2026-08-20)").
- **`hayes-command-set`** (madde 7) — ortak AT motorunu (`atCommandsParser`)
  içeriden mi çağıracak yoksa CAN 2.0A/2.0B emsali gibi aynı dosyada ikinci
  bir `ProtocolPlugin` mi olacak, dar bir karar bekliyor.
- **Cellular Initialization Dashboard'ın UI'ı** — motor (9c'de) hazır, karar
  6'yla aynı sınıf iş ("hesap/dashboard sekmesini protokol sayfasına
  bağlama"), birlikte tasarlanabilir.

~~Sıradaki iş olarak Karar 6 öneriliyor~~ — **bitti**. Geriye BAĞIMSIZ iki iş
kaldı, sıraları önemsiz: `hayes-command-set` (madde 7, dar bir karar bekliyor
— motoru içeriden mi çağıracak yoksa ikinci `ProtocolPlugin` mi) ve Cellular
Initialization Dashboard'ın React UI'ı (motor hazır, karar 6'yla aynı sınıf
iş). İkisi de kendi turunu bekliyor.

Model önerisi: ikisi de Sonnet · medium.
