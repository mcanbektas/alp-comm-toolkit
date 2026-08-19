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
Kalan iş 9b-9e; onlar için karar 3/4/5 hâlâ cevapsız. Yeni bir karar doğdu
(karar 6, hesap sekmelerinin protokol sayfasına bağlanması).

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
| `interfaces-framing/framing-stream-protocols/hayes-command-set` | planned | yok/yok | karar 1'e bağlı |
| `interfaces-framing/framing-stream-protocols/at-commands` | planned | yok/yok | **ready**, motor |
| `wireless-iot/cellular-iot/lte-modem-at` | planned | yok/yok | karar 4'e bağlı |
| `wireless-iot/cellular-iot/nb-iot` | planned | yok/yok | 9d, lte-modem-at'e bağlı |
| `wireless-iot/cellular-iot/gnss-modem` | planned | yok/yok | 9e, lte-modem-at + nmea-0183'e bağlı |

## BEKÇİ BORCU — YOK

Altı kayıt da zaten katalogda; yalnız `status`/`pluginId` işlenecek. 8/54/172
dokunulmaz. Registry 48 (dalga 8 sonrası) → en fazla **53**: `lora` eklenti
YAZILMADI (karar 1'in sonucu), yalnız beş AT kaydı registry'ye girebilir.
9a sonrası registry hâlâ 48. Katalog sayıları da 9a'da değişmedi.

## Kapsam bölmesi

### 9a — LoRa PHY hesap makinesi — **TAMAM**

Ne yazıldı:

| Dosya | İçerik |
|---|---|
| `src/protocol-core/timing/lora.ts` (yeni) | Motor: `calculateLoraSymbolTiming`, `calculateLoraTimeOnAir`, `calculateLoraAirtime`, `estimateLoraSensitivity`, `calculateLoraLinkBudget` |
| `src/protocol-core/timing/lora.test.ts` (yeni) | 26 test — doğrulanmış fixture'lar, CRC açık/kapalı ayırt edici çifti dahil |
| `src/protocol-core/timing/index.ts` | `export * from './lora'` |
| `src/features/calculators/tools/loraTools.tsx` (yeni) | `LoraAirtimeTool`, `LoraLinkBudgetTool` |
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
`Battery / Energy Estimator` brief'in 9a madde 1 listesinde geçmiyordu; ToA
üstüne oturur, ucuzdur, ayrı bir turda eklenebilir.

### 9b — AT komut çekirdeği: `at-commands` (jenerik motor)

6. `src/protocols/interfaces/atcommands/` (ya da uygun dizin — `src/protocols/`
   alt dizin listesinde "cellular" yok, `serial`/`interfaces` en yakını, karar 3)
   içinde jenerik çerçeveleme: komut/yanıt ayrımı, URC akışı, final result code
   (`OK`/`ERROR`/`+CME ERROR: <n>`/`+CMS ERROR: <n>`), `Command Parser State
   Machine` (IDLE→COMMAND_SENT→WAIT_RESPONSE→FINAL_RESULT).
7. `hayes-command-set`in bu motoru nasıl kullandığı karar 1.

### 9c — `lte-modem-at` (hücresel sözlük, 9b'ye bağlı)

8. TS 27.007 komut veritabanı: en az CSQ/COPS/CREG/CEREG/CGATT/CGDCONT/CIMI/
   CGSN/CCLK/CPIN (brief'te tam yanıt formatlarıyla doğrulandı, kaynaklar
   tablosuna bkz.). Dar küme — CLAUDE.md "Yeni bir motor yazarken fixture'ını da
   yaz" kuralı burada AT+CSQ→`+CSQ: 20,99` gibi somut örneklerle karşılanır.
9. IMEI/IMSI/ICCID/telefon numarası **Privacy Masking on Export** — katalog
   bunu açıkça vaat ediyor (`wireless-iot.ts:417`), CLAUDE.md'nin "kullanıcı
   verisi yerelde kalır" ilkesiyle aynı yönde ama EXPORT'a özel bir maskeleme
   davranışı — dar kapsamda olsa bile atlanmamalı (güvenlik-bitişik özellik).
10. `Cellular Initialization Dashboard` STATEFUL (birden çok transaction'ı
    biriktirir) — `ProtocolParser`'ın saf/durumsuz sözleşmesiyle nasıl bir
    araya geleceği karar 4.

### 9d — `nb-iot` (9c'ye bağlı)

11. `lte-modem-at`'in ayrıştırdığı CEREG/CSQ/vendor URC'lerinden NB-IoT'ye özgü
    görünüm (AcT=9 tespiti, PSM/eDRX zamanlayıcı çıkarımı). Muhtemelen `aliasOf`
    DEĞİL (gnss-modem/nmea-0183 emsali: yorumlama katmanı, motor paylaşımı) —
    ama bu da karar (karar 5).

### 9e — `gnss-modem` (9c + nmea-0183'e bağlı)

12. `AT+QGPSGNMEA` yanıtının içindeki ham NMEA cümlesini `nmea-0183` motoruna
    devret (motor TEKRAR YAZILMAZ, katalog yorumu zaten bunu söylüyor).
    `AT+QGPSLOC` gibi önceden-ayrıştırılmış yanıtlar ayrı, dar bir alan kümesiyle
    çözülür (fix/lat/lon/alt/sat/hdop).
13. TTFF Calculator, Fix Loss Detector — bunlar da stateful/timeline araçlar,
    karar 4'ün kapsamı.

## Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

Durum: **1 ve 2 uygulandı** (9a). **3, 4, 5 hâlâ cevapsız** — 9b'yi bunlar bloklar.
**6 yeni** (9a'da doğdu), bağımsız.

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

### Karar 3 — AT motoru hangi dizine gider?

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

### Karar 4 — Stateful dashboard'lar `ProtocolParser`'ın saf sözleşmesiyle nasıl uyuşur?

`Cellular Initialization Dashboard`, `TTFF Calculator`, `Fix Loss Detector`
BİRDEN ÇOK transaction'ı biriktirir — ama `protocol-core/types.ts`: *"Akış
durumu (yarım frame) stream katmanının işi, parser'ın değil."*

**Öneri: `parser` TEK transaction'ı saf çözer (mevcut sözleşme korunur);
biriktirme/dashboard UI katmanında (feature bileşeni) yaşar, `live-monitor`'ün
zaten yaptığı gibi (ayrı transaction'ları zaman çizelgesinde toplamak zaten bu
katmanın işi — bkz. `src/features/live-monitor/`).** Yeni bir "stateful parser"
sınıfı İCAT ETME — bu sözleşmeyi bu dalgada bükmenin bedeli 172 protokolün
TAMAMINA yayılır (types.ts'in kendi uyarısı).

### Karar 5 — `nb-iot`/`gnss-modem` nasıl "bağlı" olacak: `aliasOf`, `related`, yoksa ayrı `pluginId`?

Üçü de mümkün, ikisi hâlâ `related` (motor paylaşımı ama İKİNCİ bir yorumlama
katmanı — wireless-m-bus/mqtt/coap'ın SIFIR-yeni-kod `aliasOf`'undan farklı).

**Öneri: `aliasOf` DEĞİL, ayrı `pluginId` + iç çağrı.** `nb-iot`/`gnss-modem`
gerçek katma değer üretiyor (AcT filtreleme, PSM/eDRX çıkarımı, NMEA-cümle
ayıklama) — `aliasOf` "ikinci parser yazma, birebir aynı motor" demektir
(CLAUDE.md), burada aynı değil. `gnss-modem/nmea-0183` emsali zaten `related`
kullanıyor, `aliasOf` değil — tutarlı.

### Karar 6 — Hesap sekmeleri protokol sayfasına nasıl bağlanacak? (9a'da DOĞDU, cevapsız)

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
- **PSM/eDRX zamanlayıcıları**: TS 27.007 kodlu (ör. `T3324`/`T3412` GPRS
  Timer 2/3 formatında, 3 bit birim + 5 bit değer) — ham sayıyı doğrudan
  saniyeye çevirmek YANLIŞ, birim tablosunu (TS 24.008 §10.5.7.4a) doğrula.
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

**9b-9e için karar 3/4/5'i yanıtla, sonra başla.** Karar 3 (dizin) ve karar 4
(stateful/saf gerilimi) mimari niteliğinde — Opus · high. 9b bitmeden 9c/9d/9e'ye
girilmez. Karar 6 bağımsızdır, kendi turunda ele alınabilir.
