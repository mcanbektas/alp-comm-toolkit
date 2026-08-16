# BRİF — ALP Comm Toolkit, Faz 10 dalga 6 (bina otomasyonu: BACnet MS/TP · BACnet/IP · KNX · DALI · DMX512 · Art-Net · sACN)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Bu brif dalga 5 bittikten sonra yazıldı. Son commit `7abc356` (dalga 5e GOOSE +
BER walker — dalga 5 tamam: 5a DNP3, 5b IEC-104, 5c M-Bus, 5d EtherCAT, 5e
GOOSE). Sayılar: **2511 birim testi (143 dosya — dosya sayısı `find` ile
doğrulandı, test sayısı son vitest koşusundan), 35 e2e dosyası, 36 kayıtlı
plugin**, katalog bekçisi 8/54/172 yeşil (`src/tests/catalog.test.ts:12-14`).
Registry (alfabetik, `src/protocols/index.test.ts:8-43`): ais, can-2-0a,
can-2-0b, can-fd, can-xl, canopen, coap, dnp3, doip, ethercat, ethernet-ii,
gnss-ubx, iec-60870-5-104, iec-61850, ieee-802-3, ipv4, ipv6, iso-14230,
iso-9141, iso-tp, j1939, lin, m-bus, mavlink, modbus-ascii, modbus-rtu,
modbus-tcp, mqtt, nmea-0183, nmea-2000, obd-ii, rtcm, tcp, udp, uds,
vlan-802-1q. Araya başka iş girerse başlamadan hash'i ve listeyi güncelle.

Bu dalga sonunda (6a-6g) 7 yeni plugin: dmx512, art-net, sacn, dali, knx,
bacnet-mstp, bacnet-ip → 43. **Yeni dizin GEREKİR:** `src/protocols/building/`
bugün YOK (`ls src/protocols/` = aerospace, automotive, industrial, marine,
network + index/pluginBinding) — CLAUDE.md §6 iskeletinde yeri zaten ayrılmış.
Kategori değeri HAZIR: `'building-automation'` `PROTOCOL_CATEGORIES` içinde
(`src/protocol-core/types.ts:206`); union'a dokunulmaz. Her yeni id
`index.test.ts:8-43` listesine + `:46` `EXPECTED_CATEGORY` haritasına +
`:112+` gerçek-plugin/örnek-çerçeve testine girer.

## Aday listesi doğrulaması — dalga 5 öngörüsüyle fark

Dalga 5 brifi dalga 6'yı "BACnet MS/TP + BACnet/IP, KNX, DALI, DMX512/Art-Net/
sACN" diye saymıştı (`docs/brief-faz10-dalga5.md:53-54`). Keşif doğruladı ve
netleştirdi:

- Katalogda DMX ailesi ÜÇ AYRI kayıttır (dmx512 :333, art-net :375, sacn :401,
  hepsi `building-automation.ts`) → üç ayrı plugin, tek değil. Toplam 7.
- **lonworks** (`building-automation.ts:302`) bu dalgaya GİRMEZ: spec'te yalnız
  NV/SNVT/XIF kavram düzeyi var, bayt düzeni yok; XIF definitions (:319) ayrı
  iş; kamuya açık ikincil kaynak zayıf → planned kalır (PROFINET emsali).
- m-bus dalga 5'te bitti; building-automation'daki alias'ı (:201) ve modbus
  alias'ları (:252, :288) devralma e2e'leriyle ZATEN yeşil — dokunulmaz.
- Bu dalganın 7 adayının HİÇBİRİ başka domain'de alias DEĞİL (grep: yalnız
  `interfaces-framing.ts:162` rs-485'in `related` listesi bacnet-mstp'yi
  gösterir — alias değil, link). **Dalga 5'in tersine alias devralma e2e'si bu
  dalgada GEREKMEZ.**

## Bu dalganın yedi rayı

```
A) 6a DMX512    : start code + 512'ye kadar slot; BREAK/MAB bayt DEĞİL (LIN
   break emsali). Checksum yok. building/ dizinini ilk bu açar. Kaynak KAMU.
B) 6b Art-Net   : UDP payload (CoAP emsali): "Art-Net" ID + OpCode + ProtVer +
   paket-özel alanlar; ArtDmx odaklı, ArtPoll/Reply dar. Kaynak KAMU.
C) 6c sACN      : UDP payload: Root → Framing → DMP katmanları, flags&length
   deseni (bitCursor), CID, priority/sequence/universe. Kaynak KAMU (E1.31).
D) 6d DALI      : 2-3 baytlık çerçeveler (forward/backward); address byte
   sınıflaması + dar opcode ad kümesi. IEC 62386 LİSANSLI → ikincil sentez.
E) 6e KNX       : TP1 L_Data telegramı: control/source/dest+AT/NPCI/TPCI-APCI/
   payload/checksum (terslenmiş XOR — teyitle). KNX Standard/ISO 22510 kısıtlı.
F) 6f BACnet MS/TP : 55 FF başlıklı çerçeve + Header CRC-8 (katalogda YOK,
   yeni girdi) + Data CRC (CRC16_X25 ADAYI) + paylaşılan NPDU/APDU çekirdeği.
G) 6g BACnet/IP : BVLL/BVLC başlığı + 6f'nin NPDU/APDU çekirdeğini yeniden
   kullanır (iec104 ASDU-ayrı-modül emsali).
```

Sıra bilinçli: kaynağı KAMU olan üçlü önce (6a-6c, ısınma + UDP-payload deseni),
lisans sentezi isteyenler sonra (6d-6e), en çok karara bağlı ve çekirdek
tasarımı içeren BACnet ikilisi en sonda (6f-6g).

Hazır parçalar:
- `src/protocol-core/checksums/crcCatalogue.ts:93` — `CRC16_X25` (poly 0x1021,
  refin/refout, init/xorout 0xFFFF). Dalga 5 brifinin düştüğü not (:86-87)
  DOĞRULANDI: MS/TP **Data CRC adayı** budur — kullanmadan önce iki bağımsız
  kaynakla teyit et, yeni CRC yazma.
- MS/TP **Header CRC-8 katalogda YOK**: mevcut CRC8 girdileri (0x07, SAE-J1850
  0x1D, AUTOSAR 0x2F, MAXIM 0x31 — `crcCatalogue.ts:43-60`) MS/TP header
  polinomu değildir → parametreleri iki kaynaktan teyitli YENİ katalog girdisi
  (kataloğun "değerler uydurulmadı" sözleşmesi `:4` aynen sürer).
- `src/protocol-core/decoding/berReader.ts` — **İNCELEME SONUCU: BACnet'te
  KULLANILAMAZ.** BACnet tag okteti `[tag no (4 bit) | class (1 bit) |
  length/value/type (3 bit)]` böler ve length AYNI oktettedir; BER ise
  `[class (2) | constructed (1) | number (5)]` + AYRI length okteti okur
  (berReader.ts:66'daki kendi JSDoc'u bölmelemenin BER'e özgü olduğunu söyler;
  long-form tag :29, indefinite length :40 zaten açık hatadır). Ne API ne bit
  düzeni uyar. GOOSE yalnız "walker'lı motor" DESENİ olarak emsaldir. BACnet
  tag walker'ı gerekirse AYRI yazılır — karar 3 kapsamı belirler.
- `src/protocol-core/checksums/simpleChecksums.ts:20` — `xor8Checksum`. KNX
  TP1 checksum'ı ikincil kaynaklarda terslenmiş (odd parity) XOR'dur: teyit et,
  `xor8` + tersleme ile kur, elle döngü yazma.
- `src/protocol-core/decoding/bitCursor.ts` — KNX control field bitleri, DALI
  address byte bölmesi, sACN flags&length (4 bit flags + 12 bit length) için.
- `src/protocols/network/coap/coap.ts` — UDP-PAYLOAD girdi emsali (dosya başı
  "GİRDİ: TEK CoAP MESAJI" bölümü): datagram sınırı mesaj sınırıdır, stream
  birleştirme yok. bacnet-ip / art-net / sacn girdi modeli birebir budur.
- `src/protocols/automotive/lin/lin.ts` — "fiziksel sinyal bayt değildir"
  emsali (dosya başı "NEDEN BREAK BİR BAYT DEĞİL"): DMX BREAK/MAB ve DALI
  Manchester kodlaması aynı gerekçeyle modellenmez; girdi bayt dizisidir.
- `src/protocols/network/transport/udp.ts` — DİKKAT: yol `network/udp` değil
  `network/transport/udp.ts`. Motorda port-adı/suggest mekanizması YOK ve
  CoAP dalgasında da EKLENMEDİ → bu dalgada da udp motoruna dokunulmaz
  (karar 7); 47808/3671/6454/5568 adlandırması yapılmaz.
- `doip` / `modbus-tcp` MBAP / `mqtt` — başlık-length tutarlılık kontrolü
  emsalleri (BVLC length, sACN flags&length, ArtDmx Length için ton).
- `mavlink` `crcNeedsDialect` deseni — "telden okunamayan şey varsayılmaz":
  DPT'siz KNX payload'u, profilsiz DMX slot anlamı, beklenen sACN priority.
- `src/connection/serial/serialSource.ts` bağlantı katmanıdır, motor emsali
  DEĞİLDİR — canlı DMX yakalama ileriki bağlantı işi; motor girdisi HEX.

## Spec kapsam tablosu (keşif turunda çıkarıldı; ana spec 42 975 satır)

Desen dalga 5'le aynı: spec alan ADLARINI ve UI beklentisini verir, bayt/bit
sabitlerini BİLEREK vermez; dört yerde açıkça "resmi spec'ten al" der (21698,
23903, 23985, 24211). Fark: DMX ailesinde resmi kaynağın kendisi KAMU.

| Konu | Durum |
|---|---|
| Bölüm 3.7 kapsam listesi (BACnet, KNX, DALI, M-Bus, Modbus, LonWorks, DMX512, Art-Net, sACN) + "analyzer, salt decoder değil" amacı | **VAR** (21444-21454; 25171 bütünleşik amaç) |
| BACnet standart kimliği: ANSI/ASHRAE 135-2024, ISO 16484-5 | **VAR** (21456) |
| BACnet katman ayrımı Objects/Services → NPDU/APDU → MS/TP → RS-485 ("karıştırılmamalı") | **VAR** (21622-21640) |
| MS/TP çerçeve alan sırası + ham düzen `55 FF \| TT \| DD \| SS \| LL LL \| HC \| DATA \| CRC CRC` | **VAR** (21642-21696; ham satır 21666) — "Exact constants ve CRC algoritmaları … BACnet revision database" (21698) → dış kaynak |
| MS/TP token dolaşımı, T_rotation ölçümü, error analyzer | **ANALYZER** (21700-21778 aralığı; ozet07:22-30, 79-86) — parser'a girmez |
| MAC Address ≠ Device Instance (ayrı kolon şartı) | **VAR** (21780-21798) — UI notu, motor alanı ayrımı |
| BACnet/IP katman listesi Ethernet→IP→UDP→BVLL→NPDU→APDU→Service | **VAR adlar** (22214-22262; BVLL 22222/22244) — BVLC type/function baytları, 47808 portu spec'te YOK (grep boş) → dış kaynak |
| BBMD / Foreign Device / discovery | **ANALYZER** (22274-22298; ozet07:93-103) — BVLC function ADI çözülür, davranış takibi yapılmaz |
| BACnet §30 asgari listesi: MS/TP, /IP, Device instance, Object type/instance, Property identifier, Service choice, APDU, NPDU | **VAR** (39066+; APDU 39079, NPDU 39080). Bu liste 6f/6g'nin kapsam ÇİZGİSİDİR |
| KNX kavram katmanı (Individual/Group Address, Group Object, DPT, ETS) | **VAR** (22402-22526; group addr 16 bit + 0 broadcast 22420) |
| KNX telegram alanları: Source, Destination, Dest Type, Priority, APCI Service, Payload, Checksum (+ §30: Control field, Routing counter, Length) | **VAR adlar** (22622-22676; §30 ≈39082-39092) — bit düzeni ve checksum ALGORİTMASI YOK → dış kaynak |
| "DPT yoksa kesin semantik decode MÜMKÜN DEĞİL" | **VAR şart** (22546-22550, 22618) — katalogdaki tuzak yorumuyla aynı (building-automation.ts:106-108) |
| KNX ETS import (CSV/XML group address) | **VAR şart** (22704-22706) — definitions `custom-schema` (:138) işi, bu dalgada planned (karar 5) |
| KNXnet/IP · cEMI · TP1 adları | spec'te HİÇ GEÇMİYOR (grep: knxnet/cemi/tp1/22510 → boş). §30 listesi checksum'lu TP1 telegramını tarif eder — karar 5 bunu netleştirir |
| DALI kavram: iki telli bus, 64 gear + 64 device, 16 group/16 scene, DT6/DT8 | **VAR** (22732-22744; 22964-22978) |
| DALI addressing sınıfları (Individual/Group/Broadcast) + komut kategorileri (Control/Configuration/Query, örnek adlar) + Query/Response | **VAR adlar** (22792-22824; 22826-22862; 22864-22902) — çerçeve BİT DÜZENİ (forward/backward genişlikleri, Y/S bitleri) YOK; §30 yalnız "Address, Command, Data, Forward frame, Backward frame, Timing" (39093-≈39100) → dış kaynak (IEC 62386 lisanslı) |
| DALI dimming eğrisi, fault monitor, network explorer | **ANALYZER** (22748-22790, 22904-22962, 22982+; ozet07:153-179) |
| DMX512: E1.11 kimliği, universe = start code + ≤512 slot, ~44 Hz tavanı | **VAR** (23608-23648) — kaynak KAMU (ESTA) |
| DMX signal/frame zaman çizgisi BREAK→MAB→START CODE→slots + ölçümler | **VAR** (23668-23714) — Break/MAB/refresh ölçümü ANALYZER/timing işi, motor bayt dizisi çözer |
| DMX slot yorumu, 16-bit MSB/LSB parametre, fixture personality | **VAR kavram** (23716-23830) — personality `custom-schema` definitions (:365), bu dalgada planned |
| DMX Alternate START Code'lar: ESTA public database | **VAR** (23837) — dar ad kümesi kamu kaynaktan |
| Art-Net: royalty-free, UDP; ortak başlık ID/OpCode/ProtVer; OpCode ad listesi | **VAR adlar** (23859-23913) — "Exact field offsets current Art-Net 4 specification'dan" (23903); kaynak KAMU |
| ArtDmx alanları: Sequence, Physical, Port-Address/Universe, Length, Data | **VAR adlar** (23969-23983) — "Exact field layout … official specification" (23985) |
| ArtPoll/ArtPollReply node alanları; Universe View; sequence analizi; gateway | ArtPoll dar ad kümesi çözülür; gerisi **ANALYZER** (24013-24141; ozet07:297-310) |
| sACN: E1.31-2025 kimliği (5 Oca 2026, +IPv6) | **VAR** (24143-24147) — kaynak KAMU (ESTA) |
| sACN katman ağacı Root(CID, Protocol Id) → Framing(Source Name, Priority, Sequence, Universe, Options) → DMP(DMX Values) | **VAR adlar** (24169-24209) — "Exact byte layout ANSI E1.31-2025" (24211) |
| sACN CID/universe/priority/merge/sync/sequence-wrap analizi | **ANALYZER** (24217-24345 aralığı; ozet07:327-345) — alanlar çözülür, kaynak birleştirme kurulmaz |
| Gateway analyzer'lar (KNX↔DALI 24419, BACnet↔KNX 24555, Art-Net/DMX 24109) | **FEATURE, dalga DIŞI** — çok-protokol korelasyonu |
| §30 DMX512 asgari listesi: Break, MAB, Start code, Channel values, Refresh rate, Universe, Art-Net packet, sACN packet | **VAR** (≈39102-39112) |
| §45 V1.3 bina otomasyonu adayları: BACnet, KNX, DALI, DMX512 | **VAR** (39742-39754) |
| §43 fixture (bu yedili için) | **YOK** — bacnet/knx/dali/dmx grep'leri §43 aralığında (39600-39700) isabet vermiyor |
| §6 navigasyon ağaçları (MS/TP araçları 41890-41898, BACnet/IP 41900-41908, 6.2 KNX / 6.3 DALI 41929 / 6.4 Metering) | **VAR** — katalog `tools` alanlarının kaynağı, motor işi değil |

## Kaynak uyarısı — lisans tablosu

Dalga 5'in politikası devam eder ama tablo İKİYE bölünür: BACnet/KNX/DALI
lisanslı-kısıtlı, DMX ailesi KAMU. Dalga 5 karar 2'nin onayı buraya taşınır.

| Konu | Resmi kaynak | Erişim | Kamuya açık ikincil yol | Güven |
|---|---|---|---|---|
| BACnet MS/TP çerçeve sabitleri, Header CRC-8 / Data CRC-16 parametreleri, NPDU/APDU baytları | ANSI/ASHRAE 135-2024 / ISO 16484-5 (spec 21456) | ÜCRETLİ | bacpypes/BAC0 (MIT) dokümantasyonu, Wireshark mstp+bacapp dissector davranışı, BACnet International açık materyali | Orta-yüksek |
| KNX TP1 telegram bit düzeni, checksum, APCI kodları | KNX Standard (KNX Association) / ISO 22510 | KAYIT şartlı / ÜCRETLİ | knxd, Calimero, XKNX dokümanları; Wireshark knxnet/ip dissector'ı TP1 için sınırlı yardım | Orta |
| DALI forward/backward çerçeve düzeni, opcode'lar | IEC 62386 serisi | ÜCRETLİ | yarıiletken appnote'ları (Microchip/NXP/ST), python-dali dokümantasyonu, DALI Alliance açık tanıtımları | Orta |
| DMX512 start code + slot yapısı | ANSI E1.11 (ESTA) | KAMU (ESTA TSP ücretsiz yayın) | gerekmez; Alternate START Code database (spec 23837) | Yüksek |
| Art-Net başlık/ArtDmx/ArtPoll düzeni | Art-Net 4 (Artistic Licence; spec 23861 "royalty-free") | KAMU | Wireshark artnet dissector, OLA (Open Lighting) dokümantasyonu | Yüksek |
| sACN Root/Framing/DMP bayt düzeni | ANSI E1.31-2025 (ESTA; spec 24147) | KAMU | Wireshark acn dissector, OLA | Yüksek |

Kurallar:
- **Erişim iddiaları bu keşif turunda dışarıdan DOĞRULANMADI** (ağ taraması
  yapılmadı). Her alt dalganın ilk adımı: kaynağa gerçekten eriş, JSDoc'a yaz.
- GPL'li projelerden (knxd, Calimero GPL sürümleri, OLA'nın GPL parçaları) KOD
  ALINMAZ; yalnız format bilgisi çapraz doğrulanır. Lisanslı üçlüde (BACnet/
  KNX/DALI) sabitler en az İKİ bağımsız kaynaktan teyit edilir; kamu üçlüde
  (DMX/Art-Net/sACN) resmi spec tek başına yeter, JSDoc sürümü anar.
- Teyit edilemeyen alan tahmin EDİLMEZ: ham + uyarı. Fixture uydurma yasağı
  sürer; checksum'lu protokollerde (MS/TP, KNX) sentetik çerçevenin CRC/
  checksum'ı motordan bağımsız hesapla kanıtlanır (UBX 3c emsali);
  checksum'suzlarda (DALI, DMX, Art-Net, sACN) kaynağı JSDoc'ta anılan gerçek
  capture (Wireshark örnekleri) ya da resmi spec'in kendi örneği kullanılır.

## Katalog yolları (doğrulandı — `src/app/catalog/domains/building-automation.ts`)

| Yol | Rol | Not |
|---|---|---|
| `building-automation/lighting-networks/dmx512` | kanonik (:333) | tabs 9'lu (timing + definitions dahil, :341-364); definitions `custom-schema` = fixture personality (:365) planned kalır; related → art-net, sacn (:366-370) |
| `building-automation/lighting-networks/art-net` | kanonik (:375) | tabs 8'li (:381); üstündeki yorum: sequence boşluğu ≠ paket kaybı (opsiyonel özellik) — uyarı tonu |
| `building-automation/lighting-networks/sacn` | kanonik (:401) | tabs 8'li (:407) |
| `building-automation/dali/dali` | kanonik (:152) | tabs 7'li (:158), definitions yok |
| `building-automation/knx/knx` | kanonik (:109) | tabs 8'li (definitions dahil, :115-137); definitions `custom-schema` = ETS import (:138) planned; üstündeki yorum (:106-108): "DPT bilinmiyorsa semantik değer UYDURULMAZ — `00 64` → raw uint16: 100" |
| `building-automation/bacnet/bacnet-mstp` | kanonik (:34) | tabs 8'li (timing dahil, :42); üstündeki yorum: dört katman ayrı açılır, tek yığın değil; related → interfaces-framing rs-485; rs-485'in related'ı da bunu gösterir (`interfaces-framing.ts:162`) — alias DEĞİL |
| `building-automation/bacnet/bacnet-ip` | kanonik (:69) | tabs 7'li (:75); üstündeki yorum: multi-layer, vaat tam yığını katman katman açmak |
| `building-automation/lonworks/lonworks` | planned KALIR (:302) | definitions `xif` (:319); bu dalga dışı |
| `building-automation/metering/m-bus` (:184, aliasOf :201) · modbus-rtu (:215, aliasOf :252) · modbus-tcp (:255, aliasOf :288) | dalga 5'te bitti | e2e'leri yeşil, dokunulmaz |

Alias kaydına `pluginId`/`status` YAZMA kuralı geçerli ama bu dalgada alias
zaten yok — 7 kayıt da kanonik; yalnız kanonik kayda pluginId/status işlenir.

## BEKÇİ BORCU — YOK

İki `PLANNED_DECODE_PATH` sabiti var, ikisi de bu dalganın dışında:
`e2e/modbus-decode.spec.ts:36` → psi5 (automotive), `e2e/nmea-decode.spec.ts:35`
→ iec-61162 (marine). e2e genelinde bacnet/knx/dali/dmx/art-net/sacn yalnız
`e2e/mbus-decode.spec.ts` ve `e2e/modbus-decode.spec.ts`in building-automation
ALIAS yollarında geçiyor (:22, :25) — dalga 5 devralma testleri, dokunulmaz.

## Kapsam bölmesi

Yedi alt dalga; her biri dalga 2-5 deseninde tek oturumluk iş (motor + plugin +
kayıt + katalog pluginId/status + çeviri + birim test + e2e + tarayıcı turu).

- **6a**: DMX512 — kamu kaynak, checksum yok, `building/` dizinini açar
- **6b**: Art-Net — UDP-payload deseni (CoAP emsali), kamu spec
- **6c**: sACN — üç katmanlı başlık, bitCursor, kamu spec
- **6d**: DALI — lisanslı ama yüzeyi küçük; ikincil sentez
- **6e**: KNX TP1 — lisanslı; bit alanları + checksum teyidi
- **6f**: BACnet MS/TP + paylaşılan NPDU/APDU çekirdeği + CRC8 katalog girdisi
- **6g**: BACnet/IP — BVLL + 6f çekirdeğinin yeniden kullanımı

### Yapılacaklar

**6a — DMX512** (`src/protocols/building/dmx512/`)
1. `src/protocols/building/` dizinini aç (index.ts kayıt zinciri; industrial
   emsali). Motor girdisi START CODE ile başlayan bayt dizisi: BREAK/MAB bayt
   değildir (lin.ts gerekçesi JSDoc'a taşınır); slot 0 = start code (0x00
   standart lighting — dar ad kümesi ESTA Alternate START Code database'inden,
   spec 23837), sonrası slot 1..N (N ≤ 512; aşımı uyarı).
2. Alan modeli: start code + slot dizisi (offset/length'li ParsedField'lar;
   büyük slot listesi için özet alan + ham blok — 100k satır kuralı). 16-bit
   parametre birleştirme ve fixture personality YOK (definitions planned;
   profil olmadan slot anlamı uydurulmaz — mavlink tonu).
3. Plugin kaydı + registry + katalog pluginId/status + çeviri +
   `e2e/dmx-decode.spec.ts` + tarayıcı turu.

**6b — Art-Net** (`src/protocols/building/artnet/`)
4. Girdi UDP payload'ı (coap.ts girdi bölümü emsali). Ortak başlık: 8 baytlık
   "Art-Net" ID (null dahil — teyitle), OpCode, ProtVer; alan endianlıkları
   KARIŞIKTIR (ikincil kaynaklarda OpCode LE, ProtVer BE geçer) — alan alan
   resmi Art-Net 4 spec'inden teyit et, tek kural varsayma.
5. ArtDmx gövdesi: Sequence (0 = devre dışı — katalog yorumundaki uyarı tonu),
   Physical, Port-Address/Universe, Length, DMX data (6a'nın slot özet deseni).
   ArtPoll/ArtPollReply dar ad kümesi; diğer OpCode'lar ad + ham gövde.
6. Plugin + e2e (`artnet-decode.spec.ts`).

**6c — sACN** (`src/protocols/building/sacn/`)
7. Girdi UDP payload'ı. Root Layer (preamble/postamble boyutları, ACN packet
   identifier, flags&length, vector, CID — 16 bayt UUID gösterimi), Framing
   Layer (vector, Source Name UTF-8 64B, Priority, SyncAddr, Sequence,
   Options bitleri, Universe), DMP Layer (vector, adres tipleri, property
   value count, start code + slotlar). flags&length deseni (4 bit flags + 12
   bit length) üç katmanda tekrar eder — bitCursor + katman-length tutarlılık
   kontrolü (MBAP emsali). Sabitler E1.31-2025'ten, JSDoc sürüm anar.
8. Sequence/priority/merge/sync ANALİZİ YOK (24217-24345 analyzer; ozet07:
   327-345) — alanlar + metadata. Plugin + e2e.

**6d — DALI** (`src/protocols/building/dali/`)
9. Girdi 2-3 baytlık HEX çerçeve. Forward frame (ikincil kaynaklarda 16 bit:
   address byte + opcode — genişlikleri ve Y/S bit anlamlarını İKİ kaynaktan
   teyit et): address sınıfı Individual/Group/Broadcast (spec 22792-22824
   sınıflaması), DACP (Direct Arc Power) ile komut ayrımı; opcode dar ad
   kümesi = spec'in kendi örnek adları (OFF, Go To Scene, Set Fade Time,
   Store Scene, Query Actual Level, Query Lamp Failure — 22826-22862) +
   Control/Configuration/Query kategorisi. Tanınmayan opcode ham + kategori.
10. Backward frame (8 bit): yanıt değeri ham + yorum notu (Query bağlamı
    telden bilinemez — mavlink tonu). DALI-2 24-bit control-device çerçevesi
    bu dalgaya GİRMEZ (karar 6): uzunluk 3 baytsa "DALI-2 device frame,
    planned" uyarısıyla ham. Checksum YOK — doğrulama alanı basma.
11. Plugin + e2e.

**6e — KNX** (`src/protocols/building/knx/`)
12. Girdi TP1 L_Data STANDART telegramı (karar 5): Control Field (frame type/
    repeat/priority bitleri — bitCursor), Source Address (area.line.device
    gösterimi), Destination Address + AT biti (group `a/b/c` vs individual
    `a.b.c` — gösterim bite bağlı), NPCI (routing counter + length), TPCI/APCI
    (dar ad kümesi: GroupValueRead/GroupValueWrite/GroupValueResponse — spec
    22636-22660 vurgusu), payload, Checksum (terslenmiş XOR teyidiyle
    `xor8Checksum` üstüne).
13. Payload DPT'siz HAM kalır: katalog yorumunun emri (:106-108) — "raw
    uint16: 100, engineering meaning unknown" tonu; DPT tahmini YASAK. ETS
    import/definitions bu dalgada YOK (karar 5). Extended frame / poll /
    acknowledge biçimleri: tanı + ham + uyarı.
14. Plugin + e2e.

**6f — BACnet MS/TP** (`src/protocols/building/bacnet/` altında `mstp` motoru)
15. Çerçeve: Preamble 55 FF, Frame Type (dar ad kümesi: Token, Poll For
    Master, Data Expecting Reply vb. — adları iki kaynaktan), Destination/
    Source MAC (Device Instance İLE KARIŞTIRMA — 21780: ayrı alanlar), Length,
    Header CRC-8 (YENİ katalog girdisi, teyitli parametre), Data, Data CRC-16
    (CRC16_X25 adayı, teyitle). **Data yoksa Data CRC alanı da YOKTUR**
    (Token/Poll çerçeveleri) — length'e bağlı koşul.
16. Paylaşılan çekirdek `bacnet/npdu.ts` (+ gerekirse `apdu.ts`): NPDU version,
    control biti yürüyüşü (DNET/DLEN/DADR/SNET/SLEN/SADR/hop count — düzen
    ikincil kaynak teyitli), APDU başlığı: PDU type + service choice ADI (dar
    küme, §30 listesi çizgi: Who-Is/I-Am/ReadProperty/WriteProperty/COV
    düzeyinde AD), invoke ID. **Tag'li servis parametreleri HAM** (karar 3):
    berReader kullanılamaz (yukarıdaki tespit), yeni tag walker bu dalgada
    yazılmaz. Çekirdek iec104 ASDU-ayrı-modül emsalinde iki motora servis eder.
17. Plugin + e2e. Token rotation/timing analyzer işi girmez (ozet07:22-30).

**6g — BACnet/IP** (`bacnet/` altında `bacnetIp` motoru)
18. Girdi UDP payload'ı = BVLL: type baytı, function (dar ad kümesi:
    Original-Unicast/Broadcast-NPDU, Forwarded-NPDU, Register-Foreign-Device
    vb. — adlar teyitli), length (toplam — MBAP tutarlılık emsali);
    Forwarded-NPDU'da 6 baytlık B/IP adresi. Sonra 6f çekirdeğiyle NPDU/APDU.
    BBMD/FDT tablo takibi YOK (22274+ analyzer) — function adı çözülür, yeter.
19. Plugin + e2e + iki dilli tarayıcı turu (dalga kapanışı).

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **Bölme onayı:** 7 alt dalga (6a-6g) bu sırayla; lonworks planned kalır;
   alias devralma e2e'si gerekmez (bu dalganın 7'si de kanonik). Onay.
2. **Lisans politikası devri:** dalga 5 karar 2'nin aynısı BACnet/KNX/DALI
   için: resmi metin satın alınmaz, iki bağımsız ikincil kaynak, teyitsiz alan
   ham. DMX/Art-Net/sACN'de resmi spec kamu — tek kaynak yeter mi? Eğilim:
   evet (RFC emsali — CoAP 4d). Onay + 'ready' rozet eşiği.
3. **BACnet derinliği:** NPDU tam + APDU başlık düzeyi (PDU type, service
   choice adı, invoke ID); tag'li parametre çözümü ve BACnet tag walker'ı
   İLERİKİ İŞ (berReader uymuyor — tespit yukarıda). Object
   Identifier/Property çözümü de o walker'a bağlı → bu dalgada ham. Eğilim:
   başlık düzeyi; §30 listesi "Property identifier"ı sayar ama walker'sız
   basılamaz — sekme metni dürüst yazılır (boş kart yasağı).
4. **BACnet çekirdek yerleşimi:** `src/protocols/building/bacnet/` içinde
   npdu/apdu modülleri + iki plugin (bacnet-mstp, bacnet-ip). protocol-core'a
   GİRMEZ (yalnız BACnet ailesi kullanıyor; berReader'ın tersine genel değil).
   Onay.
5. **KNX kapsamı:** yalnız TP1 standart L_Data; KNXnet/IP YAPILMAZ (spec'te
   hiç geçmiyor, katalogda kaydı yok); extended frame ham + uyarı; ETS
   import/definitions planned. Onay.
6. **DALI kapsamı:** 16-bit forward + 8-bit backward; DALI-2 24-bit device
   çerçevesi planned; opcode dar ad kümesi spec örnekleriyle sınırlı. Onay.
7. **UDP motoru bağlantısı:** udp.ts'ye port adlandırma/yönlendirme EKLENMEZ
   (CoAP emsali — hiç eklenmedi; motorlar zincir kurmaz çizgisi). Girdi her
   üç IP-tabanlı motorda UDP payload'ıdır. Onay.
8. **Status kararı:** 7 kayıt da decode-only motorla 'ready' rozeti alır mı
   (build/definitions/timing sekmeleri planned bildirimli kalırken)? Dalga 5
   karar 4 emsali: sekme içinde ne çözüldüğü dürüstçe yazılır. Eğilim: evet,
   m-bus/dnp3 ile aynı muamele.

## Tuzaklar — önceki dalgalardan taşınanlar + bu dalgaya özgüler

- **CRC16_X25 hazır** (crcCatalogue.ts:93) — MS/TP Data CRC için yeniden
  yazma; ama İKİ kaynak teyidi olmadan da bağlama. Header CRC-8 katalogda YOK:
  mevcut CRC8'lerden birini "yakındır" diye SEÇME — parametre teyidiyle yeni
  girdi ekle (katalog `:4` sözleşmesi).
- **MS/TP'de Data CRC koşullu:** Data alanı boşsa (Token, Poll For Master)
  Data CRC baytları da yoktur — sabit uzunluk varsayma; Length alanı Data'nın
  uzunluğudur, çerçevenin değil (off-by-one klasiği, teyitle).
- **MAC ≠ Device Instance** (spec 21780-21798): MS/TP MAC 1 bayttır, Device
  Instance NPDU/APDU katmanından gelir; alan adlarını karıştırma, iki ayrı
  alan bas.
- **BVLC length TOPLAM uzunluktur** (MBAP'ın tersine kendisini de kapsar —
  ikincil kaynaktan teyitle); tutarsızlıkta doip/modbus-tcp uyarı tonu.
- **berReader'ı BACnet'e sokma:** tag bölmesi uymaz (yukarıdaki tespit).
  "TLV benzer" diye readBerTag çağıran kod sessiz-yanlış çözer — en kötü mod.
- **KNX AT biti gösterimi değiştirir:** hedef adres group ise `2/1/5`,
  individual ise `1.1.10` — tek formatter yazma. Checksum'ın terslenmiş XOR
  olduğu teyit edilmeden `xor8Checksum` sonucunu doğrudan karşılaştırma.
- **DPT uydurma yasak** (katalog :106-108 + spec 22618): payload ham + "DPT
  bilinmiyor" notu; örnek çerçeve çevirilerinde de tahmini mühendislik değeri
  yazma.
- **DALI'de checksum YOK, DMX'te checksum YOK:** doğrulama alanı/PASS rozeti
  basma; "valid" kavramı yalnız yapısal (uzunluk/sınıf) kontrollerden gelir.
- **DALI 2 bayt mı 3 bayt mı:** uzunluğa göre forward/backward/DALI-2 ayrımı
  yapılır; 24-bit çerçeveyi 16-bit gibi çözme — planned uyarısıyla ham bırak.
- **DMX slot indeksi:** bayt 0 = START CODE, slot numaraları 1'den başlar —
  UI'da slot 1 = bayt 1; kayma klasiği. 512 slot aşımı hata değil UYARI.
- **Art-Net endianlığı alan alan farklıdır** (OpCode LE, ProtVer BE ikincil
  kaynak uzlaşısı) — tek readUint16 yardımcısına bağlanıp kalma, her alanı
  spec'ten teyit et. Sequence 0 = "devre dışı" (katalog yorumu) — boşluğu
  "paket kaybı" diye kesinleştirme.
- **sACN flags&length:** üst 4 bit flags (0x7 beklenir), alt 12 bit length —
  bitCursor kullan; üç katmanın length'leri iç içe tutarlı olmalı (MBAP
  emsali); Source Name UTF-8 null-padded 64 bayt — trailing null'ları alanda
  gösterme, ham blokta tut.
- **Analyzer işleri parser'a KONMAZ:** MS/TP token rotation (21700+;
  ozet07:22-30), BBMD/discovery (22274+), KNX Group Monitor (22680+), DALI
  dimming/fault (22904+, 22982+), DMX refresh ölçümü (23668+), Art-Net
  sequence/universe view (24013+, 24047+), sACN merge/sync/priority (24273+),
  gateway analyzer'lar (24109, 24419, 24555). Alanlar + metadata yeter.
- **'build' sekmesi** yedi kayıtta da var — encoder yazma; 'timing' sekmeleri
  (bacnet-mstp, dmx512, art-net, sacn) sinyal ölçümü ister — motor işi değil,
  planned bildirimli kalır. 'definitions' (knx, dmx512) planned.
- **Çeviri anahtarı tire tuzağı:** bacnet-mstp / bacnet-ip / art-net
  id'lerinden anahtar üretirken segmentte tire olamaz (canopen
  `SUMMARY_KEY_SUFFIXES` emsali).
- **Kategori değeri hazır** (types.ts:206) — PROTOCOL_CATEGORIES union'ına
  ekleme yapma; yanlışlıkla 'building' yazma, değer 'building-automation'.
- Fixture uydurma yasak; §43'te bu yedili için fixture YOK — checksum'lu
  motorlarda bağımsız hesap kanıtı, checksum'suzlarda kaynaklı capture.
- `ParsedField` = `offset`/`length`; `ProtocolErrorCode` kapalı union (yeni
  hata kodunda union'ı genişlet); `noUncheckedIndexedAccess`; yorum TR /
  tanımlayıcı EN; ham renk yok; protokol adları veridir.
- Playwright `/comm/` + 4319 + `reuseExistingServer: false`; dev 3001.
- Her alt dalga sonunda iki dilli, tüm örnekli tarayıcı turu (geçici
  `_tour.spec.ts` deseni — sonunda silinir).

## Çalışma kuralları
Dalga 2-5 brifleriyle aynı: fixture uydurma yasağı, dış kaynak disclosure'ı
(dosya başı JSDoc — lisanslı üçlüde İKİ bağımsız kaynak şartı), commit serbest /
push onaylı, keşif subagent'a, 200K'da oturumu böl. Motor yazmadan önce
`docs/spec/ozet/07-bina-otomasyonu.md` okunur (CLAUDE.md şartı; özellikle
"Dikkat çekenler" 446-457).

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 6a | DMX512 (start code + slot; yeni building/ dizini) | Sonnet · medium |
| 6b | Art-Net (başlık + ArtDmx + dar ArtPoll) | Sonnet · high |
| 6c | sACN (Root/Framing/DMP + flags&length) | Sonnet · high |
| 6d | DALI (forward/backward + dar opcode) | Sonnet · high |
| 6e | KNX TP1 (bit alanları + checksum teyidi) | Sonnet · high |
| 6f | BACnet MS/TP + NPDU/APDU çekirdeği + CRC8 girdisi | **Sonnet · xhigh** (çekirdek API'de tıkanırsa Opus · high) |
| 6g | BACnet/IP (BVLL + çekirdek yeniden kullanımı) | Sonnet · medium |
| 7 | Kablosuz (BLE/Zigbee/LoRaWAN/Matter TLV) | ayrı keşif brifi; Matter TLV'de plan notu gereği gerekirse Opus |

6a **medium**: kurulu desene ekleme, karşılaştırılacak yol yok (checksum'suz
düz slot dizisi); tek yeniliği dizin açmak. 6b-6e **high**: her birinde kaynak
sentezi ve birkaç dallanma var (endianlık teyidi, katman-length tutarlılığı,
çerçeve sınıfı ayrımı, bit alanı + checksum teyidi) — medium değil. 6f
**xhigh**: iki motorun paylaşacağı NPDU/APDU çekirdeğinin API'si + koşullu CRC
yerleşimi + lisans sentezi bir arada; yanlış çekirdek tasarımı 6g'yi de bozar.
Ama protocol-core'a giren genel bir yardımcı YOK (BER walker'ın tersine aile
içi modül) — bu yüzden varsayılan Opus değil; plan satırı 32'nin "zor decoder"
listesinde de bu aile yok. 6g **medium**: çekirdek hazırsa BVLL dar iş, desen
6b-6c'de kurulmuş olacak. Fable gerekmez: kararların hepsi dalga başında
kullanıcıyla kapanacak kadar dar; spec keşfi bu brifte bitti.
