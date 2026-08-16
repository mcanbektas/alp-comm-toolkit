# BRİF — ALP Comm Toolkit, Faz 10 dalga 5 (endüstriyel: DNP3 · IEC-104 · M-Bus · EtherCAT · GOOSE) + grubun yol haritası

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Bu brif dalga 4 bittikten sonra yazıldı. Son commit `e95e079` (dalga 4e PCAP —
dalga 4 tamam: 4a Ethernet/802.3/VLAN, 4b IPv4/IPv6/UDP/TCP + internetChecksum,
4c MQTT + VBI, 4d CoAP, 4e PCAP saf parser `protocol-core/capture/`).
Sayılar: **2330 birim testi (137 dosya), 30 e2e dosyası, 31 kayıtlı plugin**,
katalog bekçisi 8/54/172 yeşil (`src/tests/catalog.test.ts:12-16`).
Registry (alfabetik, `src/protocols/index.test.ts:8-38`): ais, can-2-0a,
can-2-0b, can-fd, can-xl, canopen, coap, doip, ethernet-ii, gnss-ubx,
ieee-802-3, ipv4, ipv6, iso-14230, iso-9141, iso-tp, j1939, lin, mavlink,
modbus-ascii, modbus-rtu, modbus-tcp, mqtt, nmea-0183, nmea-2000, obd-ii, rtcm,
tcp, udp, uds, vlan-802-1q. Araya başka iş girerse başlamadan hash'i ve listeyi
güncelle.

Bu dalga sonunda (5a-5e) 5 yeni plugin: dnp3, iec-60870-5-104, m-bus, ethercat,
iec-61850 → 36. Yeni dizin GEREKMEZ: `src/protocols/industrial/` mevcut
(canopen, modbus). Kategori `'industrial-automation'`
(`src/protocols/index.test.ts:41` EXPECTED_CATEGORY).

## Bu grup önceki dalgalardan FARKLI — önce harita

`docs/plan-fazlar.md:32` son grubu tek satırda sayar:
"industrial/wireless/RE/test-automation" ve "zor decoder'larda (EtherCAT,
GOOSE, Matter TLV) gerekirse Opus'a çık" der. Spec Phase 10 da dört satırdır
(39845-39849): Industrial protocols · Wireless protocols · Reverse engineering ·
Test automation. Keşif bu dört satırın **dört ayrı iş türü** olduğunu gösterdi:

1. **Industrial** = §45 V1.3 listesi (39742-39754: Profibus temel, ProfiNet,
   EtherCAT, EtherNet/IP, IO-Link, HART, BACnet, KNX, DALI, DMX512) + §29
   Endüstriyel Ethernet şartı (39036-39046: + Sercos III, POWERLINK, OPC UA
   temel, IEC 61850 GOOSE, DNP3 TCP, IEC 60870-5-104). Dikkat: DNP3/IEC-104
   V1.3'te YOK ama §29'da VAR; katalogda hepsi kayıtlı. Bina otomasyonu
   (BACnet/KNX/DALI/DMX) ayrı bir domain'dir ama V1.3 onları da sayar.
2. **Wireless** = V1.4'ün kablosuz üçlüsü (39762-39764: BLE, Zigbee, LoRaWAN) +
   §31 (Thread, 39115) + §3.9'un tam listesi (31709-31724: + Matter, LoRa,
   Wi-Fi, ESP-NOW, RF telemetry, wM-Bus, NB-IoT/AT/GNSS modem).
3. **Reverse engineering** = V1.5 (39771-39777) + §35 (39274). Protokol DEĞİL,
   `src/features/` işi — dizin bugün YOK bile (features/: calculators,
   live-monitor, packet-builder, projects, protocol-decode,
   protocol-definitions, protocol-studio).
4. **Test automation** = §38 (39399). O da feature işi; bağlantı katmanı
   (Connect/Send/Wait adımları, 39405-39417) ister — dizin YOK.

**Bölme önerisi (karar 1):** tek satır ≠ tek dalga. Gerçek plan:
- **Dalga 5 (bu brif):** endüstriyel çekirdek — DNP3, IEC-104, M-Bus, EtherCAT,
  GOOSE. Kalan endüstriyeller (PROFINET, EtherNet/IP+CIP, OPC UA, HART,
  IO-Link…) planned kalır; gerekçe kapsam tablosunda.
- **Dalga 6 (ayrı keşif brifi):** bina otomasyonu — BACnet MS/TP + BACnet/IP,
  KNX, DALI, DMX512/Art-Net/sACN.
- **Dalga 7 (ayrı keşif brifi):** kablosuz — BLE advertisement, Zigbee
  (802.15.4/NWK/APS), LoRaWAN, Matter TLV. Plan satırındaki üçüncü zor decoder
  (Matter TLV) BURADA — Opus notu dalga 7 brifine taşınacak.
- **RE ve Test Automation: ayrı FAZLAR** (protokol dalgası değil). İkisi de UI +
  worker + (TA için) bağlantı katmanı işi; ayrı keşif turu ve brif ister. Not:
  RE'nin CRC Finder maddesinin çekirdeği repoda ZATEN VAR
  (`src/protocol-core/checksums/checksumFinder.ts`).

## Bu dalganın beş rayı

```
A) 5a DNP3           : seri link çerçevesi (0x0564 start'lı, bloklu CRC) +
   transport + application başlığı. CRC16_DNP katalogda HAZIR.
B) 5b IEC 60870-5-104: TCP üstü APDU (APCI I/S/U + ASDU başlığı). doip/
   modbus-tcp emsali. ASDU çekirdeği 101'le paylaşılabilir (karar 3).
C) 5c M-Bus          : 4 çerçeve sınıfı (Single/Short/Control/Long), sum8
   checksum HAZIR; DIF/VIF dar küme. Alias: building-automation sayfası.
D) 5d EtherCAT       : Ethernet çerçevesi içinde (EtherType 0x88A4) datagram
   zinciri + WKC. Baştan sona little-endian, 11-bit alanlar. ZOR (plan notu).
E) 5e GOOSE          : Ethernet çerçevesi içinde (0x88B8) APPID/Length + BER/TLV
   kodlu PDU. Repo'da ASN.1/BER yardımcısı YOK (grep boş) — YENİ walker. ZOR.
```

Sıra bilinçli: kararlara en az bağımlı ve kaynağı en temiz olanlar önce (5a-5c),
lisans/kaynak sentezi isteyen zorlar sonra (5d-5e).

Hazır parçalar:
- `src/protocol-core/checksums/crcCatalogue.ts:101` — `CRC16_DNP` (poly 0x3D65,
  reflected, xorout 0xFFFF). DNP3 blok CRC'si BUDUR — yeni CRC yazma; motorun
  işi yalnız blok yürüyüşü (8 baytlık header + 16'şar baytlık gövde blokları,
  her blok sonunda 2 bayt CRC).
- `crcCatalogue.ts:93` — `CRC16_X25`: dalga 6'nın BACnet MS/TP data CRC adayı
  (not olarak burada; bu dalgada kullanılmaz).
- `src/protocol-core/checksums/simpleChecksums.ts:29` — `sum8Checksum`
  (mod-256 toplam). M-Bus checksum'ı budur.
- `src/protocol-core/decoding/bitCursor.ts` — EtherCAT 11-bit length alanları,
  DNP3 control bitleri, IEC-104 kontrol alanı format ayrımı için hazır.
- `src/protocols/automotive/doip/doip.ts` — TCP üstü mesaj motoru iskeleti;
  `modbus-tcp` MBAP length tutarlılığı — IEC-104 APCI'nin birebir emsalleri.
- `src/protocols/aerospace/mavlink/mavlink.ts` `crcNeedsDialect` deseni —
  "doğrulanamayan alan ham + uyarı, mismatch asla basılmaz" tonu. EtherCAT
  WKC'nin emsali: beklenen WKC konfigürasyon ister, tek çerçeveden bilinemez.
- `src/protocols/network/ethernet/ethernetFrame.ts:73-77` `ETHER_TYPE_NAMES`
  (bugün yalnız IPv4/ARP/IPv6) + `:355-377` üst-katman uyarısı — 5d/5e'de
  0x88A4/0x88B8 adlandırması buraya eklenir, "şu sayfada çöz" yönlendirmesi
  CAN `suggestHigherLayers` tonuyla verilir.
- `src/protocol-core/capture/pcap.ts` — fixture üretiminde gerçek capture'dan
  çerçeve çıkarmak için kullanılabilir; motor girdisi yine tek çerçeve HEX.
- `src/protocol-core/framing/hdlcFraming.ts` — bu dalgada GEREKMEZ (DNP3/
  IEC-104/M-Bus kendi start-baytlı yapısını taşır); HDLC arama, şaşırma.

## Spec kapsam tablosu (keşif turunda çıkarıldı; ana spec 42 975 satır)

Bu dalganın ayırt edici bulgusu: spec endüstriyel bölümde alan ADLARINI verir,
bayt/bit sabitlerini BİLEREK vermez ve dört yerde açıkça "resmi standarttan al"
der. Özet 03'ün kendi tespiti de bu (`docs/spec/ozet/03-endustriyel.md:262`).

| Konu | Durum |
|---|---|
| DNP3 katman ayrımı + link alan sırası (Start/Length/Control/Dest/Source/CRC/User Data) | **VAR adlar** (9485-9521) — bayt sabitleri + CRC segmentasyonu YOK: "exact byte constants and CRC segmentation … official DNP3 specification" (9523) → dış kaynak |
| DNP3 application (App Control/Function Code/IIN/Object Headers) | **VAR adlar** (9525-9537); Object/Variation yalnız kavram (9539-9631) — sayısal tablolar YOK → dış kaynak |
| IEC-104 APCI↔ASDU ayrımı + I/S/U format sınıfları | **VAR adlar** (9355-9375) — 0x68 start, length semantiği, kontrol bit düzeni YOK → dış kaynak |
| IEC-104 sequence beklentisi + U-format state timeline | **VAR ama ANALYZER işi** (9377-9425) — çok çerçeve ister, parser'a girmez |
| IEC-101 katman listesi; link/common/IOA/cause GENİŞLİKLERİ profil-bağımlı | **VAR şart** (9213-9251): "kullanıcı tarafından seçilebilmeli veya project profile'dan" — karar 3 |
| M-Bus 4 çerçeve sınıfı + Long frame alan sırası (Start/L/L/Start/C/A/CI/Data/CS/Stop) | **VAR** (8813-8829; 23058-23090) — sabitler YOK: "exact field constants current EN 13757" (23092) |
| M-Bus kayıt yapısı DIF/DIFE/VIF/VIFE/DATA | **KISMİ** (8901-8913): adlar var, kodlama tablosu YOK — "resmi standard database" (8913) |
| Wireless M-Bus | **KAVRAMSAL** (8935-9003): radyo metadata + pipeline; bayt düzeni YOK; şifreleme "anahtar yerelde" (8979) — bu dalga DIŞI |
| EtherCAT çerçeve yapısı + datagram alan adları + WKC örneği | **VAR adlar** (7221-7257; 7279-7309) — "Exact bit alanları seçilen resmi ETG specification revision'ından alınmalıdır; tahmin ederek üretme" (7259) |
| EtherCAT komut/adresleme türleri; state machine | komutlar **VAR adlar** (7261-7277); state machine ANALYZER (7311-7349) |
| GOOSE Ethernet+PDU alan ağacı (Dest MAC/EtherType/APPID/Length/…/Dataset Values) | **VAR adlar** (9767-9805) — "Exact BER/TLV field coding IEC 61850-8-1 revision'ına göre" (9807) |
| GOOSE stNum/sqNum retransmission analizi | **ANALYZER** (9809-9899) — alan çözülür, zaman çizelgesi kurulmaz |
| MMS | **İLERİ/ANALYZER** (9681-9757) — özet 03:265: "ilk sürümde yalnız MMS+GOOSE" dese de MMS tam bir ASN.1/oturum yığınıdır → bu dalga DIŞI, sekmeler planned |
| PROFINET | **KAVRAMSAL** (7017-7189): analyzer katmanları + GSDML; bayt düzeni YOK → planned kalır |
| EtherNet/IP encapsulation alan adları; CIP path/service modeli | **VAR adlar** (7491-7509; 7615-7697) — sayısal kodlar YOK (ODVA lisanslı) → karar 7 |
| OPC UA | **ANALYZER** (9005-9191); §29 yalnız "temel görüntüleme" der (39043) → planned kalır |
| §29 asgari alan listesi (tüm endüstriyel Ethernet decoderlar için) | **VAR** (39048-39060): Header/Message type/Address/Command/Sequence/Length/Status/Error/Payload — "ilk aşamada"; "ileri seviye sonradan" (39062). Bu liste 5d/5e'nin kapsam ÇİZGİSİDİR |
| §43 fixture (dalga 5 adayları için) | **YOK** — §43 başlıkları değişmedi (39606-39679); endüstriyel fixture yok |
| — Dalga 6 ön izleme: BACnet MS/TP ham düzeni `55 FF | TT | DD | SS | LL LL | HC | DATA | CRC CRC` | **VAR** (21666) — "exact constants ve CRC … BACnet revision database" (21698) |
| — Dalga 6: KNX telegram alan adları + semantik örnek | **VAR adlar** (22626-22676); DALI (22826), DMX (23668), Art-Net (23887), sACN (24169) benzer düzeyde |
| — Dalga 7: BLE AD Structure + İŞLENMİŞ HEX ÖRNEKLERİ (`02 01 06`, `05 FF 4C 00 01 02`) | **VAR** (32101-32151; ozet 09:13-18) — grubun en iyi kapsanan adayı |
| — Dalga 7: LoRaWAN çerçeve ağacı + MHDR tipleri | **VAR yapı** (33959-33997; 34003-34023) — "LoRaWAN Link Layer revision" (33999) ama kaynak KAMU |
| — Dalga 7: Zigbee NWK/APS/ZCL alan adları | **VAR adlar** (32795-32931); Matter TLV **KAVRAMSAL** (33567-33597, kodlama yok); Thread/6LoWPAN ANALYZER (33077-33291) |
| — RE: §35 özellik listesi + 4 formül (change rate/entropy/counter/match rate) | **VAR** (39280-39316); `checksumFinder.ts` çekirdeği repoda hazır |
| — TA: §38 adım/örnek/rapor listesi | **VAR** (39405-39442) — bağlantı katmanına bağımlı |

## Kaynak uyarısı — bu dalganın ana gerilimi LİSANSLI standartlar

Dalga 4'ün tersi: beş adayın DÖRDÜNDE resmi metin ücretli/lisanslı. Dalga 2b'nin
freediag yolu (kamuya açık ikincil kaynak) burada zorunlu çalışma biçimidir.

| Konu | Resmi kaynak | Erişim | Kamuya açık ikincil yol | Güven |
|---|---|---|---|---|
| DNP3 link/app sabitleri, CRC yerleşimi | IEEE 1815 | ÜCRETLİ | opendnp3 (Apache-2.0) dokümantasyonu, DNP Users Group primer'ı, Wireshark dissector davranışı | Orta-yüksek |
| IEC-104 APCI sabitleri (0x68, I/S/U bitleri), ASDU başlığı | IEC 60870-5-104 | ÜCRETLİ | lib60870 (GPLv3) dokümanı, yaygın uygulama notları, Wireshark | Orta-yüksek |
| M-Bus çerçeve sabitleri, DIF/VIF tabloları | EN 13757 | ÜCRETLİ | m-bus.com'daki eski açık dokümantasyon, OMS spec, libmbus | Orta |
| EtherCAT başlık/datagram bit düzeni | ETG.1000 serisi (IEC 61158) | Kayıt/lisans şartlı | ETG'nin açık tanıtım dokümanları, Beckhoff donanım dokümanları, Wireshark dissector | Orta |
| GOOSE BER alan kodlaması, APPID/Length | IEC 61850-8-1 | ÜCRETLİ | libiec61850 (GPLv3) dokümanı, akademik yayınlar, Wireshark | Orta |
| PROFINET / CIP+EtherNet-IP / OPC UA binary | PI üyelik / ODVA lisans / OPC Foundation | Kısıtlı | zayıf → bu yüzden planned kalıyorlar | Düşük |
| — Dalga 6-7 notu: Bluetooth Core+Assigned Numbers, LoRaWAN, Matter, Zigbee/802.15.4, Art-Net, sACN | SIG/Alliance/CSA/IEEE-GET/ESTA | KAMU ya da ücretsiz kayıt | gerekmez | Yüksek |

Kurallar:
- **Erişim iddiaları bu keşif turunda dışarıdan DOĞRULANMADI** (ağ taraması
  yapılmadı). Her alt dalganın ilk adımı: kaynağa gerçekten eriş, JSDoc'a yaz.
- GPL'li projelerden (lib60870, libiec61850, libmbus) KOD ALINMAZ; yalnız format
  bilgisi çapraz doğrulanır. Sabitler en az İKİ bağımsız kaynaktan teyit edilir.
- İkincil kaynaktan teyit edilemeyen alan tahmin EDİLMEZ (spec 7259'un kendi
  emri): alan `raw` bırakılır + uyarı. Fixture uydurma yasağı aynen sürer;
  sentetik çerçevelerin CRC'leri motordan bağımsız hesapla kanıtlanır (UBX 3c
  emsali). Wireshark örnek capture'larından alınan çerçeve, kaynağı JSDoc'ta
  anılarak fixture yapılabilir.

## Katalog yolları (doğrulandı — `src/app/catalog/domains/`)

| Yol | Rol | Not |
|---|---|---|
| `industrial-automation/scada-utility/dnp3` | kanonik (industrial-automation.ts:675) | tabs: overview, live, decode, build, data, diagnostics, examples |
| `industrial-automation/scada-utility/iec-60870-5-104` | kanonik (:646) | tabs: overview, live, decode, build, timing, data, diagnostics, examples |
| `industrial-automation/scada-utility/iec-60870-5-101` | kanonik (:624) | karar 3: bu dalgada planned kalabilir |
| `industrial-automation/metering/m-bus` | kanonik (:540) | alias: `building-automation/metering/m-bus` (building-automation.ts:201) → alias devralma e2e'si girer (j1939/mqtt emsali) |
| `industrial-automation/industrial-ethernet/ethercat` | kanonik (:263) | tabs: overview, live, decode, timing, data, diagnostics, examples |
| `industrial-automation/scada-utility/iec-61850` | kanonik (:696) | tabs 9'lu, `definitions: ['scl']` (:719) — SCL import bu dalgada YOK, sekme planned kalır; motor GOOSE-only (karar 4) |
| `industrial-automation/metering/wireless-m-bus` | kanonik (:561), alias wireless-iot.ts:294→:310 | dokunulmaz (planned) |
| profinet (:233, definitions gsdml) · ethernet-ip (:286) · cip (:380) · opc-ua (:592) · hart (:502) · io-link (:466) · profibus-dp (:143) · devicenet (:403) | planned kalır | `ethernet-ip` = CIP; dalga 4'ün "adı Ethernet+IP değil, karıştırma" uyarısı geçerli — karar 7 ertele derse yine dokunulmaz |
| — Dalga 6 adayları: bacnet-mstp (building-automation.ts:34) · bacnet-ip (:69) · knx (:109, definitions custom-schema :138) · dali (:152) · dmx512 (:333, definitions :365) · art-net (:375) · sacn (:401) · lonworks (:302) | planned | dalga 6 keşif brifinde ayrıntılanır |
| — Dalga 7 adayları: ble-advertisement (wireless-iot.ts:37) · ble-gatt (:59, definitions custom-schema :87) · zigbee (:98) · thread (:119) · matter (:137) · lora (:165) · lorawan (:187) · wifi (:217) · esp-now (:238) | planned | dalga 7 keşif brifinde ayrıntılanır |

Alias kaydına `pluginId`/`status` YAZMA — zincirden türer (m-bus alias'ı :201).

## BEKÇİ BORCU — YOK

İki `PLANNED_DECODE_PATH` sabiti var, ikisi de bu grubun tamamen dışında:
`e2e/modbus-decode.spec.ts:36` → psi5 (automotive), `e2e/nmea-decode.spec.ts:35`
→ iec-61162 (marine). İkisi de dalga 5-7 adayı DEĞİL; taşıma gerekmez. e2e'de
dalga-5 aday yolları yalnız mqtt/coap ALIAS testlerinde geçiyor
(`e2e/mqtt-decode.spec.ts:21`, `e2e/coap-decode.spec.ts:21` —
wireless-iot devralma testleri, planned bekçisi değil, dokunulmaz).

## Kapsam bölmesi

Beş alt dalga; her biri dalga 2-4 deseninde tek oturumluk iş (motor + plugin +
kayıt + çeviri + birim test + e2e + tarayıcı turu).

- **5a**: DNP3 — CRC16_DNP hazır, en temiz başlangıç
- **5b**: IEC 60870-5-104 — doip/modbus-tcp emsalli TCP-üstü başlık
- **5c**: M-Bus — sum8 hazır; alias devralma e2e'si; 101/ASDU kararına dokunur
- **5d**: EtherCAT — Opus'a geçilir (plan satırı 32'nin notu)
- **5e**: GOOSE — Opus; YENİ BER walker `protocol-core`a girer

### Yapılacaklar

**5a — DNP3** (`src/protocols/industrial/dnp3/`)
1. Link katmanı: start (2 bayt sabit), length, control (bit alanları: DIR/PRM/
   FCB/FCV + function code), destination/source (16-bit LE), header CRC; gövde
   16'şar baytlık bloklar + blok başına CRC (CRC16_DNP, katalogdan). Sabitler
   iki bağımsız kamu kaynaktan JSDoc'lu.
2. Transport başlığı: FIR/FIN/SEQ tek bayt — alan olarak çözülür; ÇOK-segment
   birleştirme YOK (analyzer işi; dalga 4 fragmentation emsali). FIR&FIN=1
   değilse application katmanı "kısmi segment" uyarısıyla ham kalır.
3. Application başlığı (yalnız tam segmentte): Application Control, Function
   Code (dar ad kümesi), IIN (response'ta 16 bit bayrak paneli). Object
   header'lar ham + sayı; variation-başına veri çözümü YOK (§29 "ilk aşama"
   çizgisi, 39048-39060).
4. Plugin kaydı + registry + katalog pluginId/status + `e2e/dnp3-decode.spec.ts`.

**5b — IEC 60870-5-104** (`src/protocols/industrial/iec104/`)
5. APCI: start 0x68, length (4 kontrol baytı + ASDU; start/length hariç — MBAP
   emsalindeki tutarlılık kontrolü), 4 kontrol baytından I/S/U ayrımı (bit
   maskeleri), I-format'ta 15-bit send/receive sequence (LSB kaydırması).
6. ASDU başlığı: Type Identification (dar ad kümesi — §29 asgarisi), SQ/sayı,
   Cause of Transmission, Common Address, IOA. Information element GÖVDESİ ham
   (tip-başına element çözümü sonraki iş). Sequence BEKLENTİ takibi yok
   (9377-9413 analyzer).
7. ASDU çekirdeğini ayrı modüle koy (karar 3 kabul ederse iec-101 ileride aynı
   çekirdeği kullanır). Plugin + e2e.

**5c — M-Bus** (`src/protocols/industrial/mbus/`)
8. Dört çerçeve sınıfı: Single Character (0xE5), Short, Control, Long; Long'da
   iki length eşitliği (23074-23078), C/A/CI alanları, checksum `sum8Checksum`
   (C'den veri sonuna; start/length/stop hariç), stop baytı.
9. Kayıt katmanı DAR: DIF/DIFE/VIF/VIFE zinciri yürünür (uzatma bitleri), veri
   ham + yaygın VIF dar ad kümesi (enerji/hacim/sıcaklık — 8885-8899 örneği).
   Tam VIF kodlama tablosu bu dalgaya GİRMEZ (EN 13757 lisans notu).
10. Plugin + building-automation alias devralma e2e'si (`m-bus`).

**5d — EtherCAT** (`src/protocols/industrial/ethercat/`) — Opus oturumu
11. Girdi TAM Ethernet çerçevesi (karar 5): MAC'ler + EtherType 0x88A4 (VLAN'lı
    varyant desteklenir — dalga 4a TCI emsali). `ETHER_TYPE_NAMES`e 0x88A4 ekle
    + ethernet motorunda "EtherCAT sayfasında çöz" yönlendirmesi.
12. EtherCAT başlığı (length/reserved/type bitleri — bitCursor, LE) + datagram
    zinciri: cmd (dar ad kümesi: NOP/APRD/APWR…/LRW — 7261-7277 sınıflaması),
    idx, address (fiziksel/logical yorumu komuta göre), len + bayraklar
    (more/roundtrip), IRQ, data ham, WKC. "More" bitiyle zincir yürür; sınır
    koy (taşma koruması). WKC beklenen değeri BİLİNEMEZ → mavlink emsali: ham +
    bilgi notu, mismatch basılmaz.
13. Bit düzeni sabitleri yalnız teyitli kaynaktan; teyit edilemeyen alan raw +
    uyarı (7259'un emri). Plugin + e2e.

**5e — GOOSE** (`src/protocols/industrial/goose/` ya da `iec61850/`) — Opus
14. YENİ `protocol-core` yardımcısı: minimal BER walker (tag/length/value;
    definite short+long form; indefinite form → hata; derinlik sınırı).
    Bağımsız birim testleri. NOT: Matter TLV (dalga 7) BAŞKA kodlamadır — bu
    walker'ı genelleştirmeye çalışma; SNMP/MMS ileride bunun üstüne gelebilir,
    API'yi dar ve saf tut.
15. Girdi TAM Ethernet çerçevesi: MAC (01-0C-CD-01 multicast bilgisi), EtherType
    0x88B8 (+ ETHER_TYPE_NAMES), APPID/Length/Reserved, sonra BER'li goosePdu:
    9769-9805'teki alan ağacı (gocbRef, timeAllowedtoLive, datSet, goID, t,
    stNum, sqNum, test, confRev, ndsCom, numDatSetEntries, allData). Dataset
    değerleri tip etiketiyle (boolean/bit-string/integer…) sığ çözülür;
    retransmission zaman analizi YOK (9809+ analyzer).
16. Plugin `iec-61850` id'siyle (katalogda goose id'si YOK); MMS/SCL sekmeleri
    planned bildirimli (karar 4 status'u belirler). e2e.

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **Grubun bölünmesi:** dalga 5 = bu beşli; dalga 6 = bina otomasyonu; dalga 7
   = kablosuz; RE ve Test Automation ayrı fazlar (her birine ayrı keşif brifi).
   Onay — plan-fazlar.md satır 32'nin tek satırı fiilen 3 dalga + 2 faza açılıyor.
2. **Lisans politikası:** resmi IEC/IEEE/ETG metinleri satın alınmayacak;
   alan düzenleri kamuya açık ikincil kaynaklardan çapraz teyitle. GPL kod
   kopyası yok, yalnız format bilgisi. Teyit edilemeyen alan raw kalır. Onay +
   sınır: hangi güven düzeyi 'ready' rozetine yeter?
3. **IEC-101 kapsamı:** alan genişlikleri profil-bağımlı (9241-9251 "kullanıcı
   seçsin" der). Seçenekler: (a) 101 planned kalır, 104'ün ASDU çekirdeği
   paylaşılır modülde durur; (b) 101 decode-options'lı dar sürümle bu dalgaya
   girer. Eğilim: (a) — options UI'si repoda emsalsiz, ayrı iş.
4. **iec-61850 status'u:** motor GOOSE-only; MMS ve SCL definitions yok.
   'ready' mi 'partial' mı? (Özet 03:265 "v1 = yalnız MMS+GOOSE" der; biz
   MMS'i de vermiyoruz.) Eğilim: kullanıcı karar verir; sekme içinde ne
   çözüldüğü dürüstçe yazılır — boş kart yasağı (CLAUDE.md) ihlal edilmez.
5. **EtherCAT/GOOSE girdi modeli:** spec ikisinde de alan ağacına Ethernet
   başlığını dahil eder (7223-7239; 9769-9773) ve GOOSE için "doğrudan Ethernet
   seviyesinde incelenmeli" der (9765). Eğilim: motor girdisi TAM Ethernet
   çerçevesidir — bu, dalga 1/4'ün "motorlar zincir kurmaz" kararını İHLAL
   ETMEZ (bu protokoller Ethernet'in üstünde değil, çerçevenin kendisidir;
   canClassic→j1939 komşuluğunun emsali). ethernet-ii motoru 0x88A4/0x88B8'i
   yalnız ADLANDIRIR + yönlendirir.
6. **DNP3 application derinliği:** object header'dan öteye (variation-başına
   veri düzeni) inilecek mi? Eğilim: HAYIR — §29 "ilk aşama" listesi çizgi
   (39048-39060); "ileri seviye sonradan" (39062).
7. **EtherNet/IP encapsulation:** başlık alanları spec'te adlarıyla var
   (7491-7509) ve iş küçük (doip emsali); ama CIP'siz sayfa yarım kalır ve CIP
   sabitleri ODVA lisanslı. Eğilim: ERTELE — profinet/cip ile birlikte ileriki
   bir endüstriyel-Ethernet dalgasına.
8. **Şifreli içerik politikası (grup geneli):** anahtar girişi ve şifre çözme
   HİÇBİR dalgada yok; encrypted alan ham + işaret (spec 8979, 39169; ozet
   09:290 aynı kuralı koyar). Onay — dalga 6/7 brifleri buna yaslanacak.

## Tuzaklar — önceki dalgalardan taşınanlar + bu dalgaya özgüler

- **CRC16_DNP hazır** (crcCatalogue.ts:101) — yeniden yazma. DNP3'te CRC her
  BLOĞA ayrı uygulanır; "tüm çerçeveye tek CRC" varsayma. Header CRC'si header
  bloğuna, gövde CRC'leri 16'şar baytlık dilimlere.
- **IEC-104 length semantiği:** APDU length = kontrol alanı (4B) + ASDU; start
  ve length baytının kendisi HARİÇ — off-by-one klasiği. I/S/U ayrımı kontrol
  baytı 1'in düşük bitlerinde; sequence sayıları 15 bit, 1 bit kaydırılmış.
- **M-Bus'ta length İKİ KEZ yazılır** ve eşit olmak zorunda; checksum start/
  length/stop baytlarını KAPSAMAZ. `sum8Checksum` var — elle toplama yazma.
- **EtherCAT LITTLE-endian'dır** (Ethernet alanlarının network-order alışkanlığına
  kapılma); length alanları 11 bit — bitCursor kullan; WKC datagramın SONUNDA.
- **BER walker'da uzunluk:** long-form length'te taşma/negatif kontrolü;
  iç içe derinlik sınırı (sonsuz döngü koruması — dalga 4 IPv6 ext-header
  emsali); indefinite length GOOSE'ta geçersiz → hata.
- **`iec-60870-5-104`/`iec-61850` id'lerinden çeviri anahtarı üretme tuzağı:**
  anahtar segmentinde tire olamaz (canopen `SUMMARY_KEY_SUFFIXES` emsali).
- **`ETHER_TYPE_NAMES`e ad eklemek ethernet motorunun valid/warning davranışını
  değiştirir** (ethernetFrame.ts:355-366): mevcut ethernet/vlan testlerinde
  "bilinmeyen EtherType" senaryosu 0x88xx kullanıyorsa test güncellenir — önce
  grep'le bak.
- **Analyzer işleri parser'a KONMAZ:** DNP3 transport reassembly, IEC-104
  sequence beklenti/oturum takibi (9377-9425), EtherCAT state machine timeline
  (7311), GOOSE stNum/sqNum zaman çizelgesi (9809-9899), M-Bus meter browser.
  Alanlar + metadata yeter (MAVLink seq emsali).
- **'build' sekmesi** dnp3/iec-104 kayıtlarında var — encoder yazmaya kalkma;
  önceki dalgalar decode-only gitti, Packet Builder ayrı yol.
- **`ethernet-ip` ≠ Ethernet+IP** (dalga 4 uyarısının devamı): bu dalgada da
  dokunulmuyor; çeviri/e2e'de bu ada çarpma.
- Fixture uydurma yasak; §43'te bu beşli için fixture YOK — sentetik çerçeve +
  bağımsız checksum kanıtı, ya da kaynağı anılan Wireshark örnek capture'ı.
- `ParsedField` = `offset`/`length`; `ProtocolErrorCode` kapalı union (yeni hata
  kodunda union'ı genişlet); uyarı kodu serbest metin anahtarı.
- `src/tests/catalog.test.ts` 8/54/172 + alias bütünlüğü + definitions↔formats
  bekçileri; alias'a pluginId/status yazma; `index.test.ts:102+` her plugin'e
  örnek çerçeve şart.
- `noUncheckedIndexedAccess`; yorum TR / tanımlayıcı EN; ham renk yok; protokol
  adları veridir.
- Playwright `/comm/` + 4319 + `reuseExistingServer: false`; dev 3001.
- Her alt dalga sonunda iki dilli, tüm örnekli tarayıcı turu (geçici
  `_tour.spec.ts` deseni — sonunda silinir).

## Çalışma kuralları
Dalga 2-4 brifleriyle aynı: fixture uydurma yasağı, dış kaynak disclosure'ı
(dosya başı JSDoc — bu dalgada İKİ bağımsız kaynak şartıyla), commit serbest /
push onaylı, keşif subagent'a, 200K'da oturumu böl. Motor yazmadan önce
`docs/spec/ozet/03-endustriyel.md` okunur (CLAUDE.md şartı).

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 5a | DNP3 (link + transport + app başlığı) | Sonnet · high |
| 5b | IEC 60870-5-104 (APCI + ASDU başlığı) | Sonnet · high |
| 5c | M-Bus (4 çerçeve sınıfı + dar DIF/VIF) | Sonnet · high |
| 5d | EtherCAT (datagram zinciri + WKC) | **Opus · high** |
| 5e | GOOSE (+ yeni BER walker) | **Opus · xhigh** |
| 6 | Bina otomasyonu (BACnet/KNX/DALI/DMX ailesi) | ayrı keşif brifi; ilk tahmin Sonnet · high ağırlıklı |
| 7 | Kablosuz (BLE/Zigbee/LoRaWAN/Matter TLV) | ayrı keşif brifi; Matter TLV'de plan notu gereği gerekirse Opus |
| RE / TA | feature fazları (§35 / §38) | ayrı keşif brifleri; TA bağlantı katmanına bağımlı |

5a-5c **Sonnet · high**: kurulu desene ekleme ama her birinde kaynak sentezi ve
birkaç dallanma var (blok CRC yürüyüşü, I/S/U bit ayrımı, DIF/VIF zinciri) —
medium değil. 5d **Opus · high**: plan satırı 32 açıkça sayar; bit düzeni
lisans nedeniyle ikincil kaynaklardan sentezlenecek, yanlış varsayımın maliyeti
sessiz-yanlış decode. 5e **Opus · xhigh**: BER walker `protocol-core`a giren
YENİ paylaşılan yardımcı — API'sindeki hata ileride MMS/SNMP'ye taşınır;
ödünleşimli tasarım + lisans sentezi bir arada. Fable gerekmez: kararların
hepsi dalga başında kullanıcıyla kapanacak kadar dar; spec keşfi bu brifte bitti.
