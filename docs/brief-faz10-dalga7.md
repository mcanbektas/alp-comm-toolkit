# BRİF — ALP Comm Toolkit, Faz 10 dalga 7 (kablosuz: BLE Advertisement · LoRaWAN · Zigbee · Matter TLV)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Bu brif dalga 5 bittikten sonra yazıldı. Son commit `7abc356` (dalga 5e GOOSE +
BER walker — dalga 5 tamam: 5a DNP3, 5b IEC-104, 5c M-Bus, 5d EtherCAT, 5e
GOOSE). Sayılar: **2511 birim testi (143 dosya), 35 e2e dosyası, 36 kayıtlı
plugin**, katalog bekçisi 8/54/172 yeşil (`src/tests/catalog.test.ts:12-16`).
Registry (alfabetik, `src/protocols/index.test.ts:7-44`): ais, can-2-0a,
can-2-0b, can-fd, can-xl, canopen, coap, dnp3, doip, ethercat, ethernet-ii,
gnss-ubx, iec-60870-5-104, iec-61850, ieee-802-3, ipv4, ipv6, iso-14230,
iso-9141, iso-tp, j1939, lin, m-bus, mavlink, modbus-ascii, modbus-rtu,
modbus-tcp, mqtt, nmea-0183, nmea-2000, obd-ii, rtcm, tcp, udp, uds,
vlan-802-1q.

**Dalga 6 (bina otomasyonu) brifi/işi henüz repoda yok** — araya girerse (ya da
paralel oturumda yürüyorsa) başlamadan hash'i, sayıları ve listeyi güncelle;
iki dalga farklı domain/dizinlerde çalıştığı için içerik çakışması yok.

Bu dalga sonunda (7a-7d) 4 yeni plugin: ble-advertisement, lorawan, zigbee,
matter → 40. **Yeni dizin GEREKİR:** `src/protocols/wireless/` bugün YOK
(mevcut: aerospace, automotive, industrial, marine, network) — ilk kablosuz
motorla açılır. Kategori `'wireless-iot'` protocol-core'da zaten tanımlı
(`src/protocol-core/types.ts:208`, `PROTOCOL_CATEGORIES` :200);
`index.test.ts:46` `EXPECTED_CATEGORY` haritasına dört yeni satır girer,
kategori bekçisi :121, örnek-çerçeve bekçisi :122 (`exampleFrames.length > 0`).

## Aday listesi doğrulaması — dalga 5 keşfi haklı ama iki düzeltmeyle

Dalga 5 brifi bu dalgayı "BLE advertisement, Zigbee (802.15.4/NWK/APS),
LoRaWAN, Matter TLV" diye tanımlamıştı (`docs/brief-faz10-dalga5.md:55-57`).
Bu keşif turu listeyi DOĞRULADI; dayanak üç kaynak üst üste düşüyor:

- **V1.4 kablosuz üçlüsü** = BLE (39764), Zigbee (39765), LoRaWAN (39766).
  (Dalga 5 brifi 39762-39764 demişti — iki satır kaymış; 39762-39763 MQTT/CoAP.)
- **§31 asgari alan listesi** (39115-39165) tam bu üçlüyü sayar — bu dalganın
  kapsam ÇİZGİSİDİR (dalga 5'teki §29'un kablosuz karşılığı): BLE 39119-39127,
  Zigbee 39131-39138, LoRaWAN 39152-39165. Thread da listede (39142-39146) ama
  içeriği IPv6/UDP/CoAP/mesh — spec gövdesi Thread'i ANALYZER işi yapar (aşağıda).
- **Matter TLV** plan satırının üçüncü zor decoder'ı (`docs/plan-fazlar.md:32`:
  "zor decoder'larda (EtherCAT, GOOSE, Matter TLV) gerekirse Opus'a çık") —
  o not BU brife taşındı; V1.4'te yoktur, plan satırı onu bu gruba ekler.

§3.9'un 16 kaydından (31709-31724, katalogda `wireless-iot` domain'i birebir)
kalan 12'si bu dalgaya GİRMEZ ve planned kalır — gerekçeler kapsam tablosunda:
ble-gatt (bağlantı/oturum işi), thread (6LoWPAN/MLE analyzer), lora (PHY hesap
makinesi, kaydında `decode` sekmesi bile yok — wireless-iot.ts:173), wifi,
esp-now, rf-telemetry-custom-frame (custom-schema/RE komşusu), wireless-m-bus
(EN 13757 lisans + şifreleme; dalga 5 kapsam tablosu "bu dalga DIŞI" demişti),
mqtt/coap (alias — motorlar dalga 4'ten hazır), nb-iot, lte-modem-at,
gnss-modem (log/AT analizi + Web Serial bağlantı işi).

## Bu dalganın dört rayı

```
A) 7a BLE Advertisement : advertising-channel PDU (Header + Payload). Header
   bit alanları (PDU Type/RFU/ChSel/TxAdd/RxAdd/Length), AdvA, AD structure
   zinciri (Length|Type|Data). Spec'te İŞLENMİŞ HEX ÖRNEKLERİ HAZIR — grubun
   en temiz başlangıcı.
B) 7b LoRaWAN           : PHYPayload = MHDR | MACPayload | MIC. FHDR (DevAddr/
   FCtrl/FCnt/FOpts) + FPort; FRMPayload ŞİFRELİ → ham + işaret; MIC
   doğrulanamaz (anahtar ister) → MAVLink crcNeedsDialect emsali. Küçük ve net.
C) 7c Zigbee            : ÜÇ katman tek motor: 802.15.4 MAC (LE bit alanları,
   değişken adresleme, FCS) → NWK → APS + dar ZCL. Değişken alan düzeni
   nedeniyle grubun sinsi zoru.
D) 7d Matter TLV        : YENİ walker — berReader KULLANILAMAZ (aşağıda).
   Spec kavramsal, kodlama baytları tamamen dış kaynaktan. Plan notunun
   "zor decoder"ı; Opus.
```

Sıra bilinçli: spec kapsamı en iyi ve tek katmanlı olanlar önce (7a-7b),
çok katmanlı/yeni-yardımcı isteyen zorlar sonra (7c-7d).

Hazır parçalar:
- `src/protocol-core/decoding/bitCursor.ts` (`readBits`/`readBitsAsNumber`
  :48/:85, `BitOrder` :26) — BLE PDU header bitleri, 802.15.4 Frame Control,
  LoRaWAN MHDR/FCtrl bit alanları için hazır.
- `src/protocol-core/decoding/berReader.ts` — Matter TLV için **KULLANILAMAZ**;
  net söylüyorum: berReader X.690 BER/DER yürür (class/constructed'lı tag
  okteti + big-endian length oktetleri, `readBerTag`/`readBerLength`/`readBerTlv`
  :210/:237/:286). Matter TLV ise BAŞKA kodlamadır: tek kontrol baytı element
  type (alt 5 bit) + tag control (üst 3 bit) taşır, tag ve uzunluk alanları
  little-endian ve tip-türevi genişliktedir. berReader'ın kendi JSDoc'u da
  "Matter TLV BAŞKA kodlamadır — bu walker'ı genelleştirmeye çalışma" diye
  yazar (dalga 5 kararının kaydı). 7d'de yeni `matterTlv` walker'ı yazılır;
  berReader'dan alınan şey kod değil, API DESENİDİR: `bytes + offset` (dilim
  değil), kapalı hata union'ı, uzunluk-taşma korumaları, politika (derinlik/
  eleman sınırı) çağıranda.
- `src/protocol-core/checksums/crcCatalogue.ts` — kablosuz için mevcutlar
  YETMEZ, iki boşluk var: (1) BLE link-layer CRC'si 24 bit / poly 0x65B'dir;
  katalogdaki `CRC24` (:109) ve `CRC24_Q` (:128) 0x864CFB'dir (RTCM için
  eklendi) — BLE'ye UYMAZ, karıştırma. Karar 2 tam-paket girdisini seçerse
  yeni `CRC24_BLE` girdisi gerekir. (2) 802.15.4 FCS'i CRC16/KERMIT'tir
  (poly 0x1021, init 0x0000, reflected, xorout 0x0000); katalogda 0x1021'li
  üç girdi var ama hiçbiri o değil: `CRC16_CCITT_FALSE` (:77, init 0xFFFF
  non-reflected), `CRC16_XMODEM` (:85, init 0 non-reflected), `CRC16_X25`
  (:93, reflected ama init/xorout 0xFFFF). Yeni `CRC16_KERMIT` girdisi gerekir.
  Her iki yeni girdinin parametreleri resmi/yayımlı kaynaktan teyitle girilir
  (katalog dosya başı kuralı: değerler UYDURULMAZ).
- `src/protocols/aerospace/mavlink/mavlink.ts:151` `crcNeedsDialect` deseni —
  "doğrulanamayan alan ham + uyarı, mismatch asla basılmaz". LoRaWAN MIC'in
  birebir emsali: spec metni zaten aynı tonu emreder ("MIC present / Cannot
  verify without session keys", 34089-34109).
- `src/protocols/industrial/ethercat/` — baştan sona little-endian + bitCursor
  motor emsali; 802.15.4 MAC ve LoRaWAN alanları için en yakın akraba
  (kablosuzda network-order alışkanlığı yok, aşağıda tuzak).
- `src/protocols/network/ipv6/` ext-header zincir sınırı — BLE AD zinciri ve
  Matter TLV derinlik/eleman sınırının emsali (taşma/sonsuz döngü koruması).
- `src/protocol-core/capture/pcap.ts` — fixture üretiminde gerçek capture'dan
  çerçeve çıkarmak için (Wireshark 802.15.4/BLE örnekleri); motor girdisi yine
  tek çerçeve HEX.

## Spec kapsam tablosu (keşif turunda çıkarıldı; ana spec 42 975 satır)

Dalga 5 keşfinin "bu grubun spec kapsamı en iyi" tespiti DOĞRULANDI — BLE ve
ZCL'de işlenmiş örnekler bile var. Ama desen aynı: spec alan ADLARINI ve
ağaçları verir, bit sabitlerini üç yerde açıkça resmi revizyona havale eder
(32065, 32797 "profile/revision'a göre", 33999). Sürüm çıpası 31739: Bluetooth
Core 6.3 · Matter 1.6 · Zigbee 4.0 (Core R23.2, BDB 3.1) · Thread 1.4.1;
"Protocol + Revision/Profile mantığıyla çalıştır" emri de oradadır.

| Konu | Durum |
|---|---|
| BLE link-layer katman sırası (Preamble/Access Address/PDU/CRC) + PDU header alan adları (PDU Type/RFU/ChSel/TxAdd/RxAdd/Length) | **VAR adlar** (32027-32063) — "Exact field interpretation seçilen Bluetooth Core revision'ına göre" (32065); Access Address/CRC init sabitleri spec'te YOK (grep boş) → dış kaynak (KAMU) |
| Advertising PDU tür adları (ADV_IND…CONNECT_IND + Extended: ADV_EXT_IND/AUX_*) | **VAR adlar** (32069-32099) — tür↔bit kodu eşlemesi YOK → dış kaynak |
| BLE AD Structure + **İŞLENMİŞ HEX ÖRNEKLERİ** (`02 01 06` → Len/Type/Data; `05 FF 4C 00 01 02` → Company ID'li manufacturer; `09 09 "Sensor01"`) | **VAR** (32101-32151; ozet 09:13-18) — grubun en iyi kapsanan konusu, fixture adayları hazır |
| AD Type ad kümesi (Flags, Local Name, Service UUID, Service Data, Manufacturer Specific, Tx Power, Appearance, URI) | **VAR adlar** (32155-32197) — "Bluetooth Assigned Numbers database'ıyla" (32157) → sayılar dış kaynaktan (KAMU) |
| BLE Device Table / Address Privacy / Advertisement Rate | **ANALYZER** (32199-32311) — çok çerçeve/zaman ister, parser'a girmez |
| BLE GATT (ağaç, UUID, properties, CCCD, schema import) | **VAR kavram** (32313-32693) ama bağlantı+oturum+definitions işi → bu dalga DIŞI, planned |
| Zigbee 802.15.4 MAC | **VAR yalnız katman adları** (32771-32793: Frame Control/Sequence/Addressing/Payload/FCS) — Frame Control bit düzeni, adresleme modları YOK → dış kaynak (IEEE GET, KAMU) |
| Zigbee NWK alanları + örnek değerler | **VAR** (32795-32833) — "profile/revision'a göre" (32797) |
| Zigbee Addressing (64-bit IEEE ↔ 16-bit NWK) | **VAR** (32835-32869) |
| Zigbee APS alan adları (Endpoint/Cluster/Profile/Counter) | **VAR adlar** (32871-32891) |
| ZCL + **İŞLENMİŞ ÖRNEK** (raw `29 09` → MeasuredValue 0x0929 → 23.45 °C) + komut tip adları | **VAR** (32893-32957; komutlar 32959-32991) — cluster/attribute sayı tabloları YOK → dış kaynak |
| Zigbee Join Analyzer | **ANALYZER** (32993-33043) |
| Zigbee Security: key yoksa "Encrypted APS/NWK payload" bırak, uydurma | **VAR politika** (33045-33075) — karar 8'in dayanağı |
| Thread / 6LoWPAN / MLE / Border Router | **ANALYZER/İLERİ** (33077-33291) → planned |
| Matter katman ayrımı (Message/Security/UDP-IP) | **VAR kavram** (33293-33325) — Message framing şifreli+oturumlu → parser'a girmez |
| Matter Node/Data/Interaction/Subscription/Commissioning/Security | **ANALYZER** (33327-33565) → sekme içerikleri planned bildirimli |
| Matter TLV | **KAVRAMSAL** (33567-33597): yalnız ağaç görünümü + eleman TİP ADLARI (Structure/Context Tag/Unsigned Integer/Boolean/Byte String/List) + raw↔değer drill-down şartı. Kontrol baytı/kodlama YOK → sabitlerin TAMAMI dış kaynaktan |
| LoRa PHY (SF/BW/CR, ToA formülleri) | **HESAP MAKİNESİ** (33601-33931) — lora kaydı planned; ToA calculator ayrı iş (kayıtta decode sekmesi yok) |
| LoRaWAN çerçeve ağacı (PHYPayload → MHDR/MACPayload/MIC; FHDR → DevAddr/FCtrl/FCnt/FOpts → FPort → FRMPayload) | **VAR yapı** (33959-33997) — "Exact fields selected LoRaWAN Link Layer revision'a göre" (33999) |
| MHDR mesaj tipi SEMANTİK ADLARI (Join Request/Accept, Un/Confirmed Data Up/Down, Rejoin, Proprietary) | **VAR** (34003-34025) — bit kodları YOK → dış kaynak (KAMU) |
| DevAddr/FCnt/MIC | **VAR** (34027-34109) — MIC: "PASS/FAIL; key yoksa 'MIC present / Cannot verify without session keys'" (34089-34109) |
| LoRaWAN Activation: OTAA'nın GÖRÜNÜR alanları (DevEUI/JoinEUI/DevNonce/atanan DevAddr) çözülür; "Encrypted fields key yoksa raw" | **VAR** (34111-34151) |
| LoRaWAN Classes/ADR/Regional/Duty-cycle | **ANALYZER/HESAP** (34155-34305) |
| Wi-Fi 802.11 / ESP-NOW / wM-Bus / NB-IoT-AT / GNSS modem | **VAR adlar/kavram** (34306+; wM-Bus 8935-9003) → hepsi bu dalga DIŞI, planned |
| §31 asgari alan listesi (bu dalganın kapsam çizgisi) | **VAR** (39115-39165) — NOT: BLE alt listesi "GATT characteristic + Notification decoder" da sayar (39126-39127) → karar 3 |
| §43 fixture (dalga 7 adayları için) | **YOK** — §43 başlıkları değişmedi (CRC/UART/Modbus/NMEA/Custom/J1939/IEEE-754); kablosuz fixture yok. Karşılık: spec'in kendi işlenmiş örnekleri (BLE 32101-32151, ZCL 32931-32957) kaynak-atıflı fixture yapılabilir |

## Kaynak uyarısı — dalga 5'in tersi: kaynaklar KAMU, gerilim düşük

Dalga 5 keşfinin bu grup için notu ("kaynaklar KAMU ya da ücretsiz kayıt,
spec kapsamı en iyi" — `brief-faz10-dalga5.md:153`) tek tek işaretlendi:

| Konu | Resmi kaynak | Erişim | Not | Güven |
|---|---|---|---|---|
| BLE PDU header bitleri, AD yapısı, CRC/AA sabitleri | Bluetooth Core Spec (6.3) + Assigned Numbers | **KAMU** (Bluetooth SIG, ücretsiz indirme; Assigned Numbers açık sayfa) | AD Type/Company ID sayıları Assigned Numbers'tan | Yüksek |
| 802.15.4 MAC bit düzeni, FCS | IEEE 802.15.4 | **KAMU** (IEEE GET Program, ücretsiz kayıt) | dalga 5 tablosu da "IEEE-GET" demişti | Yüksek |
| Zigbee NWK/APS/ZCL sabitleri | CSA Zigbee Core R23 / ZCL spec | **KAMU/kayıtlı indirme** (CSA sitesi) | dar ZCL kümesi yeter (karar 5) | Orta-yüksek |
| LoRaWAN alan düzeni, MType kodları | LoRaWAN L2 (TS001, Link Layer) | **KAMU** (LoRa Alliance, ücretsiz indirme) | spec 33999 "revision'a göre" der — sürümü JSDoc'a yaz (karar 6) | Yüksek |
| Matter TLV kodlaması | Matter Core Spec (1.6) Appendix (TLV) | **KAMU** (CSA, form doldurup indirme) | ayrıca connectedhomeip SDK **Apache-2.0** — dalga 5'in GPL çekincesi burada YOK, çapraz teyit serbest | Yüksek |

Kurallar:
- **Erişim iddiaları bu keşif turunda dışarıdan DOĞRULANMADI** (ağ taraması
  yapılmadı — dalga 5 kuralının aynısı). Her alt dalganın ilk adımı: kaynağa
  gerçekten eriş, sürümüyle JSDoc'a yaz.
- Resmi metin kamu olduğundan dalga 5'in "İKİ bağımsız ikincil kaynak" şartı
  burada **TEK resmi kaynak + bir çapraz sağlama**ya (Wireshark dissector
  davranışı, Apache-2.0 SDK) gevşer — bu bilinçli fark, karar 2'de onaylatılır.
- Bu brifte anılan ama spec'te olmayan sabit adayları (CRC24 poly 0x65B,
  advertising CRC init 0x555555, Access Address 0x8E89BED6, CRC16/KERMIT
  parametreleri, Matter kontrol baytı düzeni) keşif bilgisidir — koda ancak
  resmi metinden teyitle girer; teyit edilemeyen alan ham + uyarı.
- Fixture uydurma yasağı sürer: spec'in işlenmiş örnekleri satır atıfıyla
  fixture olur; sentetik çerçevelerin CRC/FCS'leri motordan bağımsız hesapla
  kanıtlanır (UBX 3c emsali); Wireshark örnek capture'ı kaynağı JSDoc'ta
  anılarak kullanılabilir.

## Katalog yolları (doğrulandı — `src/app/catalog/domains/wireless-iot.ts`)

Domain: 8 aile / 16 protokol; hiçbir kayıtta bugün `pluginId` yok (hepsi
planned). Bu dalganın katalog işi yalnız dört kanonik kayda `pluginId`+`status`
işlemek — dördü de kanoniktir, alias'ları yoktur.

| Yol | Rol | Not |
|---|---|---|
| `wireless-iot/bluetooth-le/ble-advertisement` | kanonik (:37) | tabs 7'li (:43) **'live' DAHİL** — Web Bluetooth canlı tarama bu dalgada YAZILMAZ (tuzaklara bak) |
| `wireless-iot/lora-lpwan/lorawan` | kanonik (:187) | tabs (:193): overview, decode, timing, data, diagnostics, examples |
| `wireless-iot/mesh-smart-home/zigbee` | kanonik (:98) | tabs (:104) aynı altılı; tools MAC/NWK/APS/ZCL katmanlarını tek tek sayar |
| `wireless-iot/mesh-smart-home/matter` | kanonik (:137) | tabs (:143) aynı altılı; tools'ta 'TLV Tree Decoder' — motor bunu verir, kalan tools (Interaction/Commissioning/Session) planned bildirimli |
| ble-gatt (:59, definitions custom-schema :87) · thread (:119) · lora (:165, decode sekmesi YOK :173) · wifi (:217) · esp-now (:238) · rf-telemetry-custom-frame (:265, definitions :283) · nb-iot (:367) · lte-modem-at (:387) · gnss-modem (:418) | planned kalır | dokunulmaz |
| `wireless-iot/wireless-metering/wireless-m-bus` (:294) | alias → `industrial-automation/metering/wireless-m-bus` (:310) | dokunulmaz (planned; dalga 5 tablosu "bu dalga DIŞI") |
| `wireless-iot/iot-messaging/mqtt` (:321, aliasOf :338) · `coap` (:341, aliasOf :356) | alias → network-ethernet kanonikleri | motorlar dalga 4'ten HAZIR; e2e alias testleri bu sayfalarda yaşar (bekçi borcu bölümü) |

Alias kaydına `pluginId`/`status` YAZMA — zincirden türer (mqtt :338 emsali).
Dosya başı yorumun (:6-18) üç kuralı bu dalganın da sözleşmesidir: `live`
yalnız tarayıcı API'siyle erişilebilenlerde; anahtar tarayıcıda kalır,
anahtarsız payload "encrypted" bırakılır; alias'larda motor kanonikte yaşar.

## BEKÇİ BORCU — YOK

İki `PLANNED_DECODE_PATH` sabiti var, ikisi de grubun dışında:
`e2e/modbus-decode.spec.ts:36` → psi5 (automotive),
`e2e/nmea-decode.spec.ts:35` → iec-61162 (marine). Taşıma gerekmez.
Dalga 5 keşfinin gördüğü wireless-iot yolları yalnız mqtt/coap ALIAS
testlerinde (`e2e/mqtt-decode.spec.ts:21` ve `:168`,
`e2e/coap-decode.spec.ts:21` ve `:165` — "alias sayfası aynı motoru ve Hazır
rozetini devralır" testleri). Bunlar planned bekçisi DEĞİL ve dalga 7'nin
dokunduğu kayıtlar değil → **çakışma yok**, dokunulmaz. e2e'de ble/zigbee/
lorawan/matter yoluna referans yok (grep temiz).

## Kapsam bölmesi

Dört alt dalga; her biri dalga 2-5 deseninde tek oturumluk iş (motor + plugin +
kayıt + katalog pluginId/status + çeviri + birim test + e2e + tarayıcı turu).

- **7a**: BLE Advertisement — işlenmiş spec örnekleri hazır, en temiz başlangıç
- **7b**: LoRaWAN — dar alan kümesi, MAVLink MIC emsali hazır
- **7c**: Zigbee — üç katman tek motor; değişken 802.15.4 adresleme; yeni
  CRC16_KERMIT girdisi
- **7d**: Matter TLV — Opus (plan satırı 32'nin notu); YENİ TLV walker
  `protocol-core`a girer

### Yapılacaklar

**7a — BLE Advertisement** (`src/protocols/wireless/ble/` — dizini bu iş açar)
1. Girdi advertising-channel PDU (karar 4): header 2 bayt — PDU Type (4 bit),
   RFU, ChSel, TxAdd, RxAdd, Length (bitCursor, LSB dikkat) — tür adları
   32073-32095 kümesinden; Length↔kalan bayt tutarlılık kontrolü.
2. Payload: AdvA 6 bayt (LE — ekranda ters sırayla gösterilir; TxAdd'e göre
   public/random adlandırması), ardından AD zinciri: `Length | AD Type | Data`,
   Length Type baytını KAPSAR (data = length-1), Length=0 ve taşan Length hata
   (IPv6 ext-header sınır emsali).
3. Dar AD Type kümesi (32155-32197 adları, sayılar Assigned Numbers'tan):
   Flags (bit paneli), Shortened/Complete Local Name (ASCII), 16/128-bit
   Service UUID, Service Data, Manufacturer Specific (Company ID 16-bit LE +
   dar ad kümesi), Tx Power. Kalan tipler ham + tip numarası.
4. Spec örnekleri fixture (`02 01 06`, `05 FF 4C 00 01 02`, `09 09 Sensor01`
   — 32101-32151 satır atıfıyla). Plugin + registry + katalog + çeviri +
   `e2e/ble-decode.spec.ts`. 'live'/'timing' sekmeleri planned bildirimli.

**7b — LoRaWAN** (`src/protocols/wireless/lorawan/`)
5. MHDR: MType (3 bit — 34003-34025 semantik adları), RFU, Major. MType hem
   yönü (up/down) hem gövde şemasını belirler.
6. Data mesajları: FHDR — DevAddr 4B LE, FCtrl bit alanları (yöne göre FARKLI
   düzen — tuzaklara bak), FCnt 2B LE, FOpts (FOptsLen kadar, MAC komutları
   HAM — analyzer işi); FPort (0 = MAC komutu, şifreli — "uygulama verisi"
   deme); FRMPayload ŞİFRELİ → ham + encrypted işareti (karar 8); MIC 4B —
   `micNeedsSessionKeys` uyarısı, PASS/FAIL asla basılmaz (mavlink emsali;
   spec 34089-34109 metni birebir).
7. Join Request AÇIK metindir: JoinEUI 8B LE, DevEUI 8B LE, DevNonce 2B LE
   çözülür (34137-34149). Join Accept MHDR sonrası şifreli → ham + işaret
   (34151). Plugin + e2e.

**7c — Zigbee** (`src/protocols/wireless/zigbee/`)
8. 802.15.4 MAC: Frame Control 2B LE bit alanları (frame type, security,
   pending, AR, PAN ID compression, dest/src addressing mode), Sequence,
   adres alanları MODLARA GÖRE DEĞİŞKEN (yok/16-bit/64-bit + PAN ID
   compression etkisi — kombinasyonlar tek tek testli), FCS 2B = yeni
   `CRC16_KERMIT` (karar 7 girdide FCS'in varlığını belirler). Bit sabitleri
   IEEE 802.15.4'ten (GET, kamu).
9. NWK: Frame Control 2B LE (protocol version, discover route, security),
   Dest/Source 16-bit, Radius, Sequence (32795-32833 alanları + 32835-32869
   adres notu). **NWK security biti setse ötesine İNME** — payload
   "Encrypted NWK payload" (33045-33075).
10. APS: frame control, endpoint'ler, Cluster ID, Profile ID, counter
    (32871-32891). ZCL DAR (karar 5): frame control (global/cluster-specific),
    komut adları (32959-32991 kümesi), Read Attributes Response/Report
    Attributes'ta attribute id + veri tipi + değer — dar tip kümesi; spec
    örneği `29 09` → 23.45 °C fixture (32931-32957). Tam cluster kütüphanesi
    GİRMEZ. Plugin + e2e.

**7d — Matter TLV** (`src/protocols/wireless/matter/`) — Opus oturumu
11. YENİ `protocol-core/decoding/matterTlv.ts`: kontrol baytı (element type +
    tag control), tag biçimleri (anonymous/context/profile'lı), tip-türevi LE
    uzunluk/değer okuma, container aç/kapa yürüyüşü; derinlik ve eleman sınırı
    ÇAĞIRANDA (berReader karar emsali). Kodlama sabitlerinin tamamı Matter
    Core spec TLV ekinden, connectedhomeip (Apache-2.0) ile çapraz teyit.
    Bağımsız birim testleri. berReader'a DOKUNULMAZ.
12. Plugin `matter` id'siyle: girdi bağımsız TLV blob'u (Matter Message
    framing YOK — şifreli+oturumlu, 33293-33325); çıktı recursive ağacın
    `ParsedField`lere düzleştirilmiş hâli (offset'ler ham çerçeveye göre —
    berReader'ın "offset mutlaktır" ilkesi). 33567-33597'nin drill-down şartı
    protocol-tree ile karşılanır. Interaction/Commissioning/Session tools'ları
    planned bildirimli (karar 9 status'u belirler). Plugin + e2e.

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **Alt dalga bölmesi ve kapsam dışılar:** dalga 7 = ble-advertisement,
   lorawan, zigbee, matter (TLV-only); kalan 12 wireless-iot kaydı planned.
   Onay (dalga 5 karar 1'in devamı).
2. **Kaynak politikası gevşemesi:** resmi metinler kamu olduğundan "iki
   bağımsız ikincil kaynak" şartı → "resmi metin + bir çapraz sağlama". GPL
   kuralı gereksizleşti (connectedhomeip Apache-2.0). Onay + 'ready' rozeti
   için güven eşiği aynı kalsın mı?
3. **BLE'de GATT'ın yeri:** §31 BLE listesi "GATT characteristic +
   Notification decoder" da sayar (39126-39127) ama GATT bağlantı/oturum +
   custom-schema definitions işidir (32313-32693). Seçenekler: (a) ble-gatt
   tamamen planned (eğilim — tek karakteristik çözümü schema import'suz
   anlamsız), (b) dar "tek attribute değeri çöz" motoru. Eğilim: (a).
4. **BLE girdi modeli:** (a) advertising-channel PDU (Header+Payload; sniffer/
   Wireshark çıktısıyla uyumlu; CRC girdide yok) — eğilim; (b) tam link-layer
   paket (Preamble+AA+PDU+CRC → CRC24_BLE katalog girdisi + dewhitening
   sorusu açılır); (c) yalnız AD baytları (Web Bluetooth'un verdiği).
   Spec 32027-32047 hem katman listesini hem PDU açılımını sayar, girdiyi
   TARİF ETMEZ. (a) seçilirse CRC24_BLE bu dalgada GEREKMEZ.
5. **Zigbee ZCL derinliği:** §31 çizgisi Cluster/Profile/Payload'da durur
   (39131-39138); ZCL örneği spec'te var (32893-32957). Eğilim: APS zorunlu +
   ZCL dar (global komutlar + attribute id/tip/değer); cluster-specific komut
   gövdeleri ham. Tam ZCL kütüphanesi sonraki iş.
6. **LoRaWAN sürüm çıpası:** eğilim L2 1.0.4 (TS001) hedeflenir, JSDoc'a
   yazılır; 1.1'e özgü alanlar (Rejoin varyantları) dar adlanır, çözülmeyen
   kısım ham. FOpts MAC komut çözümü bu dalgaya GİRMEZ (analyzer).
7. **Zigbee FCS politikası:** girdi MAC çerçevesi FCS'li mi? Sniffer
   formatlarının bir kısmı FCS'yi metadata'ya alır. Eğilim: FCS girdinin
   parçası ve doğrulanır (CRC16_KERMIT); FCS'siz kabul varyantı decode-option
   ister — repoda emsalsiz, ERTELE.
8. **Şifreli içerik politikası:** dalga 5 karar 8 DEVRALINIR
   (`brief-faz10-dalga5.md:298-300`; spec 33045-33075, 34151; ozet 09:290):
   anahtar girişi ve şifre çözme HİÇBİR alt dalgada yok; encrypted alan ham +
   işaret. Zigbee NWK/APS, LoRaWAN FRMPayload/Join Accept, Matter Message
   üçünde de geçerli. Onay yeter — yeniden tartışılmaz.
9. **matter kaydının status'u:** motor yalnız TLV; Interaction Model/
   Commissioning/Session tools'ları planned bildirimli. 'ready' mi 'partial'
   mı (iec-61850 karar 4 emsali)? Sekme içinde ne çözüldüğü dürüstçe yazılır —
   boş kart yasağı ihlal edilmez.

## Tuzaklar — önceki dalgalardan taşınanlar + bu dalgaya özgüler

- **CRC24/CRC24_Q (0x864CFB) BLE CRC'si DEĞİLDİR** (crcCatalogue.ts:109/:128 —
  RTCM için eklendiler). BLE 0x65B'dir; karar 4 (b) seçilmedikçe hiç gerekmez.
- **0x1021'li üç mevcut girdinin hiçbiri 802.15.4 FCS'i değil** (CCITT_FALSE/
  XMODEM/X25 — init/reflect kombinasyonları farklı). CRC16_KERMIT yeni girdi;
  parametreleri yayımlı kaynaktan, doğrulama değeriyle.
- **Kablosuz baştan sona LITTLE-endian ağırlıklı** (802.15.4 çok baytlı
  alanlar, BLE alanları, LoRaWAN DevAddr/FCnt/EUI'ler) — dalga 4'ün
  network-order alışkanlığına kapılma (EtherCAT emsali). Üstüne gösterim
  tuzağı: EUI/adresler ekranda geleneksel olarak TERS (big-endian görünümlü)
  yazılır — gösterim kararını JSDoc'a yaz, testte sabitle.
- **BLE AD Length, Type baytını KAPSAR** (data = length-1) — off-by-one
  klasiği. Length=0 ve kalan bayttan taşan Length → hata; zincir sınırı koy.
- **802.15.4 adres alanları modlara göre 0/2/8 bayt + PAN ID compression** —
  tek "mutlu yol" düzeni varsayma; kombinasyon başına test.
- **Zigbee NWK/APS security biti setse üst katmana İNME** — encrypted bırak
  (33045-33075); "çözülemedi" hatası değil, bilgi işareti.
- **LoRaWAN FCtrl bit düzeni YÖNE GÖRE FARKLI** (uplink ADR/ACK/ClassB,
  downlink FPending) ve yön MType'tan gelir — tek düzen varsayma. **FPort 0 =
  şifreli MAC komutları** — uygulama verisi diye adlandırma. FCnt 16-bit'tir;
  32-bit sayaç genişletmesi analyzer işidir, parser'a koyma.
- **Matter TLV için berReader'ı KULLANMA ve GENELLEŞTİRME** — berReader.ts
  JSDoc'unun kendi emri; yeni walker ayrı modül, API deseni aynı (bytes+offset,
  kapalı hata union'ı, politika çağıranda), derinlik/eleman sınırı şart.
- **'live' sekmesi ble-advertisement kaydında VAR** (:43) — Web Bluetooth
  canlı tarama `src/connection/bluetooth` işi, bu dalgada YAZILMAZ; sekme
  planned bildirimli kalır, boş kart basılmaz. 'timing' (advertisement rate,
  ToA) ve tüm Device-Table/Join/Subscription tools'ları ANALYZER — parser'a
  koyma (32199-32311, 32993-33043, 33451+).
- **`ble-advertisement`/`rf-telemetry-custom-frame` gibi tireli id'lerden
  çeviri anahtarı üretme tuzağı** — anahtar segmentinde tire olamaz (canopen
  `SUMMARY_KEY_SUFFIXES` emsali; dalga 5'te iec-60870-5-104 aynı tuzaktı).
- **Fixture uydurma yasak; §43'te kablosuz fixture YOK** — spec'in işlenmiş
  örnekleri satır atıfıyla fixture; sentetik çerçevede FCS/CRC bağımsız
  hesapla kanıtlanır; Wireshark capture'ı kaynak anılarak kullanılabilir.
- `ParsedField` = `offset`/`length`; `ProtocolErrorCode` kapalı union (yeni
  hata kodunda union'ı genişlet); uyarı kodu serbest metin anahtarı.
- `src/tests/catalog.test.ts` 8/54/172 + alias bütünlüğü bekçileri — kayıt
  EKLENMİYOR, yalnız dört kanonik kayda pluginId/status; alias'a yazma.
  `index.test.ts:46` EXPECTED_CATEGORY'ye 4 satır (`'wireless-iot'`), :122
  exampleFrames bekçisi her plugin'de örnek çerçeve ister.
- `noUncheckedIndexedAccess`; yorum TR / tanımlayıcı EN; ham renk yok;
  protokol adları veridir.
- Playwright `/comm/` + 4319 + `reuseExistingServer: false`; dev 3001.
- Her alt dalga sonunda iki dilli, tüm örnekli tarayıcı turu (geçici
  `_tour.spec.ts` deseni — sonunda silinir).

## Çalışma kuralları
Dalga 2-5 brifleriyle aynı: fixture uydurma yasağı, dış kaynak disclosure'ı
(dosya başı JSDoc — kaynak SÜRÜMÜYLE: Core 6.3 / R23.x / TS001 1.0.4 /
Matter 1.6, spec 31739'un Revision/Profile emri), commit serbest / push
onaylı, keşif subagent'a, 200K'da oturumu böl. Motor yazmadan önce
`docs/spec/ozet/09-kablosuz-iot.md` okunur (CLAUDE.md şartı; BLE 09:5-23,
Zigbee 09:39-51, LoRaWAN 09:117-139, Matter 09:67-79, ortak kurallar
09:285-294).

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 7a | BLE Advertisement (PDU header + AD zinciri) | Sonnet · high |
| 7b | LoRaWAN (PHYPayload + Join Request) | Sonnet · high |
| 7c | Zigbee (802.15.4 MAC + NWK + APS + dar ZCL) | **Sonnet · xhigh** (takılırsa Opus) |
| 7d | Matter TLV (+ yeni matterTlv walker) | **Opus · xhigh** |

7a-7b **Sonnet · high**: kurulu desene ekleme; kaynak kamu ve dar, ama her
birinde birkaç dallanma var (AD zinciri sınırları, MType'a göre gövde şeması)
— medium değil. 7c **Sonnet · xhigh**: üç katman tek motorda ve 802.15.4
adresleme kombinasyonları ödünleşimli — yanlış varsayımın bedeli sessiz-yanlış
decode; plan satırı Zigbee'yi zor decoder saymadığı için Opus başlangıç şartı
değil, ilk adreslemede tökezlenirse Opus'a çık. 7d **Opus · xhigh**: plan
satırı 32'nin adıyla andığı üçüncü zor decoder; spec kodlamayı hiç vermiyor
(tamamı dış kaynak sentezi) ve walker `protocol-core`a giren paylaşılan YENİ
yardımcı — API hatası ileride her TLV tüketicisine taşınır (BER walker'ın
xhigh gerekçesinin aynısı). Fable gerekmez: kararların hepsi dalga başında
kullanıcıyla kapanacak kadar dar; spec keşfi bu brifte bitti.
