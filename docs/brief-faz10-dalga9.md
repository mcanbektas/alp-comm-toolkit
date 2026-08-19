# BRİF — ALP Comm Toolkit, Faz 10 dalga 9 (LoRa PHY hesapları · AT komut ailesi)

## Konum

Dalga 8 (`d54af64`) BLE GATT motorunu ekledi (8a), LoRaWAN FOpts MAC komut borcunu
ve Zigbee ZCL cluster/attribute kütüphane borcunu kapattı. 8b (Web Bluetooth kaynağı)
hâlâ karar 1'i (canlı BLE veri sözleşmesi — `MessageSource` önerisi) bekliyor,
cevaplanmadı.

Bu brief 8b'den **bağımsız** iki aileyi kapsar: `lora` (katalogda ayrı bir kayıt,
LoRaWAN'dan farklı — PHY hesap makinesi) ve beş kayıtlık bir AT-komut ailesi
(`hayes-command-set`, `at-commands`, `lte-modem-at`, `nb-iot`, `gnss-modem`).

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

**Bu depoda `calculators` altyapısı zaten CANLI**, blokaj değil: `obd.ts:364`
(`calculators: CALCULATORS`) + `src/features/calculators/` (registry.ts, types.ts,
tools/) dolu. `protocol-core/types.ts`'teki `CalculatorDefinition`'ın "hesap
motorları Faz 5'te gelecek" notu ESKİ bir durumu anlatıyor — `docs/plan-fazlar.md:44`:
*"Faz 5-8 bitti."* `lora` bu emsali (obd.ts) izler, `parser` gerekmeyebilir (ya da
minik bir PHY header ayrıştırıcıyla birlikte gelebilir — karar 1).

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
| `wireless-iot/lora-lpwan/lora` | planned | yok/yok | **ready**, calculator |
| `interfaces-framing/framing-stream-protocols/hayes-command-set` | planned | yok/yok | karar 1'e bağlı |
| `interfaces-framing/framing-stream-protocols/at-commands` | planned | yok/yok | **ready**, motor |
| `wireless-iot/cellular-iot/lte-modem-at` | planned | yok/yok | karar 4'e bağlı |
| `wireless-iot/cellular-iot/nb-iot` | planned | yok/yok | 9d, lte-modem-at'e bağlı |
| `wireless-iot/cellular-iot/gnss-modem` | planned | yok/yok | 9e, lte-modem-at + nmea-0183'e bağlı |

## BEKÇİ BORCU — YOK

Altı kayıt da zaten katalogda; yalnız `status`/`pluginId` işlenecek. 8/54/172
dokunulmaz. Registry 48 (dalga 8 sonrası) → en fazla 54 (altısı da yazılırsa).

## Kapsam bölmesi

### 9a — LoRa PHY hesap makinesi (bağımsız, hemen başlanabilir)

1. `src/features/calculators/` desenini izleyerek ToA/Airtime/Symbol-Time/Bit-Rate/
   Link-Budget hesaplarını yaz — `obd.ts`'in `calculators: CALCULATORS` deseni emsal.
2. Payload sembol sayısı formülünde **güncel Semtech Rev.7'yi** kullan (karar 2).
3. Fixture: TTN/ChirpStack'in yayınladığı bilinen ToA değerleri (ör. SF7/BW125/
   CR4-5, 20 bayt payload → ~61.7 ms) ile bağımsız doğrula — spec worked example
   yoksa iki bağımsız hesaplayıcı (kendi + `avbentem`'in kendi test paketindeki
   sayılar) çapraz kontrol.
4. `decode`/`parser` gerekip gerekmediği karar 1.
5. Katalog: `status: 'ready'`. `pluginId` gerekip gerekmediği de karar 1'e bağlı
   (yalnız `calculators` taşıyan bir `ProtocolPlugin` hâlâ `pluginId` iddia
   edebilir mi — `DecodePanel`'in `pluginId` zorunlu kıldığı yer var mı kontrol
   edilmeli, `decode` sekmesi olmadığı için bu soru gerçek).

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

### Karar 1 — `lora` yalnız hesap mı, hesap+mini-decode mi?

`tabs` listesinde `decode` yok — bu KASITLI mı (katalog yazarı PHY header'ı
ayrıştırmayı hiç düşünmedi) yoksa hesap makinesinin PHY Parameter Set'i
kullanıcının ELLE gireceği anlamına mı geliyor (SF/BW/CR/PL kullanıcı formundan)?

**Öneri: yalnız hesap, `decode` yok, `pluginId` YOK.** `tabs`'ın kendisi zaten
kararı veriyor — girdi elle form, `calculators` yeter. `ProtocolPlugin.parser`
opsiyonel (`protocol-core/types.ts`), `DecodePanel`'in `pluginId` zorunlu kılıp
kılmadığını 9a başında hızlıca doğrula (küçük bir kontrol, karar değil).

### Karar 2 — ToA formülünde CRC terimi: sabit mi, parametrik mi?

`avbentem`/2013-AN1200.13 sabit `+16` kullanıyor (CRC hep açık varsayılıyor);
güncel Semtech Rev.7 parametrik `16·CRC` veriyor.

**Öneri: parametrik (güncel datasheet).** Katalogdaki *"Preamble & Header Mode
Inspector (explicit / implicit, CRC, LDRO)"* aracı zaten CRC'yi KULLANICI
SEÇENEĞİ olarak vaat ediyor — sabit varsayım bu vaadi karşılamaz. Test
fixture'ında CRC açık/kapalı İKİ ayrı örnek gerekir (yalnız "hep açık" durumunu
sınamak `avbentem` ile farkı asla ortaya çıkarmaz).

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

## Tuzaklar

- **CRC terimi (karar 2)**: `avbentem`'i TEK kaynak sayıp sabit `+16` yazma —
  güncel datasheet'le çapraz kontrol ZORUNLU, dosya başında ikisinin FARKI
  açıkça yazılmalı (gelecekte biri "avbentem farklı sonuç veriyor" diye hata
  sanabilir).
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

## Öneri

**9a'yı hemen başlat** — 8b'nin karar 1'inden VE bu brief'in kendi kararlarının
çoğundan bağımsız, yalnız karar 1/2 (küçük, düşük riskli) gerekir. Sonnet ·
medium (emsal var — obd.ts — tarif net).

**9b-9e için karar 1-5'i yanıtla, sonra başla.** Karar 3 (dizin) ve karar 4
(stateful/saf gerilimi) mimari niteliğinde — Opus · high. 9b bitmeden 9c/9d/9e'ye
girilmez.
