# ALP Platform Süiti — Faz Planı ve Model Önerileri

> Karar tarihi: 2026-08-09. Mimari: Autodesk-tarzı süit — tek platform (hesap/API/DB/deploy/tasarım),
> N bağımsız ürün SPA'sı (PCB · Comm · Tool3…). Mikroservis YOK — modüler monolit.
> Ayrıntılı mimari: bu konuşma + `ozet/00-genel-ozet.md` (Comm spec özeti).

## Mimari özet (kilitli kararlar)

- **alp-platform** repo: `api/` (ASP.NET Core 9, tüm ürün modülleri) + `deploy/` (compose, nginx, env) + `landing/` + `design/` (token'lar + shell paketi `@mcanbektas/design`)
- **alp-pcb-toolkit** repo: sadece `web/` kalır (React 18 JS, 4 CSS tema — dokunulmaz, retrofit sonra)
- **alp-comm-toolkit** repo: Comm SPA (Vite + React 18 + TS strict + Tailwind, spec §6 klasör yapısı, tek app)
- **DB:** tek PostgreSQL, ürün başına şema (`platform`, `pcb`, `comm`); şemalar arası FK yasak (Identity/Audit hariç)
- **Auth:** mevcut ASP.NET Identity + JWT + refresh cookie — tüm ürünler aynı `/api/auth`
- **Backend modül kuralları:** modül = feature klasörü; modüller birbirini çağırmaz; ortak iş `Platform/`'a iner; ağır non-CRUD ihtiyaç doğarsa ürüne sidecar servis (aynı nginx+JWT arkası)
- **Canlı veri yolu backend'e girmez** (Comm gizlilik kuralı): cihaz ↔ tarayıcı (Web Serial/USB/BLE); bridge (yerel agent) sonraki faz
- **Routing:** path tabanlı — `/` landing, `/pcb`, `/comm`, `/api`; BrowserRouter + nginx fallback

## Fazlar

| Faz | İş | Model · Effort | Neden |
|---|---|---|---|
| **0** ✅ | **TAMAM (2026-08-09).** Platform ayrıştırma: PCB repo'dan `api/`+`deploy/` → yeni `alp-platform` repo; CI workflow'ları böl (pcb-web / platform-api); ghcr imaj adları; compose referansları; PCB repo'da web kalır | **Opus · high** | Çalışan ürünün CI/CD'sine cerrahi — görünmez bağımlılıklar (workflow path'leri, Dockerfile referansları, script yolları). Yanlışın bedeli: PCB pipeline kırılır |
| **1** ✅ | **TAMAM (2026-08-09).** Design tokens + shell: PCB'nin 4 temasından token damıtıldı (açık/koyu, `data-theme` + `prefers-color-scheme`); `@mcanbektas/design` paketi (`design/` altında, Header/AccountMenu/ProductSwitcher); CI'a `design` job'u eklendi. **Scope `@alp/design` değil `@mcanbektas/design`** — GitHub'da `alp` kullanıcı adı başkasına ait, GitHub Packages scope'u repo sahibiyle eşleşmek zorunda. Paket henüz yayınlanmadı (tüketen yoktu). | **Sonnet · high** | Desen bilinen (CSS custom properties, semantic token), kaynak mevcut (4 tema); birkaç yol var, biri seçilecek |
| **2** ✅ | **TAMAM (2026-08-09).** Comm iskeleti: `alp-comm-toolkit` deposu — Vite 8 + React 18 + TS 7 strict + Tailwind 4 (CSS-first, token'lar `@theme inline`) + RRv7 BrowserRouter + katalog (8/54/172, alias grafiği + arama) + tr/en çeviri (eksik anahtar = derleme hatası) + protocol-core (spec §7 aynen) + lazy plugin registry + ByteViewer + Vitest (92 test) + Playwright duman testi + CI. Tarayıcıda doğrulandı. | **Opus · ultracode** | Uzun, birbirine bağlı çok dosyalı üretim; her şeyin üstüne oturacağı temel — tek seferde tutmalı |
| **3** ✅ | **TAMAM (2026-08-10, alp-platform `cb5b28b`).** **API Comm modülü:** `Comm/` feature klasörü (mevcut Auth/Projects desenine birebir) + `comm` DB şeması (CommProjects, ProtocolSchemas) + EF migration + CORS'a comm origin + xunit testler | **Sonnet · high** | Var olan desene göre yeni endpoint; şema küçük ama birkaç geçerli biçim var |
| **4** ✅ | **TAMAM (2026-08-10, alp-platform `4541104`).** **Süit yüzü:** statik landing (token'lı, ürün kartları) + nginx path routing (SPA fallback'ler, cache header'lar) + compose'a comm servisi | **Sonnet · high** | Bilinen alan; nginx SPA fallback incelikleri var ama yol belli |
| **5** ✅ | **TAMAM.** **Comm motorları** (spec Phase 2): byte utils + conversion engine (28 araç) + CRC engine (28 algoritma + custom, fixture'lar spec §43'te hazır: `123456789` → 0xF4/0x29B1/0x4B37/0xCBF43926) + timing calculator'lar (UART/RS-485/SPI/I²C) | **Sonnet · medium** | Tarif eksiksiz, formüller spec'te, fixture'lar doğruluyor; hacim var ama her adım basit |
| **6** ✅ | **TAMAM.** **Stream/framing çekirdeği** (spec Phase 3): stream buffer (chunk birleştirme) + framing engine (15 yöntem: delimiter/length/COBS/SLIP/HDLC flag/timeout…) + 9 durumlu parser state machine + recovery/resync + Worker köprüsü (cancel'lı) | **Opus · xhigh** | Görünmez değişmezler (kısmi frame, resync, backpressure); buradaki bug 172 protokolün hepsini zehirler; API tasarımında ödünleşimler |
| **7** ✅ | **TAMAM.** İkiye bölündü: **7a motor** (33 alan tipi — §9.1 başlığı 32 der, listesi 33 ad taşır, liste esas alındı; dynamic length, koşullu alan, CRC coverage, yorumlayıcı parser + üç geçişli encoder) ve **7b UI** (§9.7'nin 4 paneli + Packet Builder + **6** kod üretici). Üretici sayısı 4 değil 6: §9.7'nin alt paneli JSON şema · C struct · C parser · Python parser · TypeScript parser · Markdown doküman sayıyor; "4 üretici" özeti C struct+parser'ı tek sayıyordu. **Kapsam dışı:** §10'un "WebSocket üzerinden gönderme" maddesi — `src/connection/websocket` yok, ekranda "planlandı" rozetiyle görünüyor | **Opus · ultracode** | Spec'in "en önemli modülü" — küçük bir protokol derleyicisi; uzun ve bütünsel |
| **8** ✅ | **TAMAM.** **Live Serial Monitor** (spec Phase 5): Web Serial bağlantı katmanı + canlı parse (Worker'da) + ring buffer + virtualized tablo + Recharts grafikler + istatistik | **Opus · high** | Perf değişmezleri (UI thread bloklamaz, 100k satır), worker sınırları; sebep-sonuç izleme gerek |
| **9** ✅ | **TAMAM.** **İlk protokoller** (spec Phase 6): Modbus RTU/ASCII/TCP + NMEA 0183 + CAN + DBC import + J1939 — plugin desenini kanıtlar | **Sonnet · high** | Tarifler net (ozet 03/04/05'te frame yapıları+fixture'lar); desen Faz 6-7'de kurulmuş olacak |
| **10+** 🔄 | **SÜRÜYOR** (2026-08-22 itibarıyla dalga 12 KAPANDI — `network-ethernet` domain'i de tamamen bitti, `interfaces-framing`ten sonra ikinci kapanan domain). Kalan iş **48 kanonik kayıt**: industrial-automation 16, automotive 12, aerospace-uav 12, wireless-iot 4, marine-navigation 3, building-automation 1 | **Sonnet · medium-high** (dalga başına) | Kurulu desene protokol ekleme; zor decoder'larda (EtherCAT, GOOSE, Matter TLV) gerekirse Opus'a çık |
| **P** | **PCB redesign retrofit** — paralel iz, ekran ekran token'lara geçiş | **Sonnet · medium** | Mekanik dönüşüm, tema→token eşlemesi Faz 1'de tanımlanmış olacak |

## Model geçiş kuralları

- Faz başında bu tabloya göre `/model` + `/effort` çek; faz bitince sıradakini söylerim
- Sonnet fazında beklenmedik mimari karar çıkarsa: dur, Opus'a çek, kararı ver, geri dön
- Fable: hiçbir fazda gerekmiyor (ayrı kota + 2x maliyet; muhakeme tavanı isteyen iş yok)

## Sıradaki adım

Comm SPA'sında **Faz 9 bitti; Faz 10 (protokol dalgaları) SÜRÜYOR** —
`interfaces-framing` VE `network-ethernet` domain'leri bitti, öteki altı
domain'de 48 kanonik kayıt duruyor. (Bu başlık 2026-08-21'de "Faz 10
TAMAMEN BİTTİ" diyordu; o cümle `interfaces-framing`in bittiğini
kastediyordu ama fazın tamamı gibi okunuyordu — 2026-08-22'de düzeltildi.)

**Dalga 12 (network-ethernet, 19 kayıt) 2026-08-22'de TAMAMEN KAPANDI**
(12a icmp/icmpv6 · 12b arp/lldp · 12c dns/mdns/dhcp · 12d ntp/ptp · 12e
snmp/syslog · 12f http/websocket/mqtt-sn · 12g rtp/rtcp · 12h
tftp/ftp/telnet — hepsi ayrı commit+push, ayrıntılar aşağıda ve
`docs/brief-faz10-dalga12.md`de).

**Dalga 13 (industrial-automation, 16 kayıt) 2026-08-22'de BAŞLADI — keşif
turu bitti, `docs/brief-faz10-dalga13.md` yazıldı, uygulama HENÜZ
BAŞLAMADI (onay bekliyor).** 8 alt dalga önerildi: 13a wireless-m-bus ·
13b iec-60870-5-101 · 13c opc-ua · 13d cip/ethernet-ip/devicenet · 13e
profinet · 13f powerlink/cc-link-ie/sercos-iii · 13g profibus-dp/cc-link/
as-interface/foundation-fieldbus · 13h io-link/hart. En önemli bulgu:
`iec104Asdu.ts`in `decodeAsdu()`su zaten `iec104.ts` tarafından kullanılan
KANITLI paylaşım (13b bunu tüketecek); `canopen.ts` ise yalnız tek
`parseCanopen()` export ediyor, powerlink'in CANopen paylaşımı iddiası
(13f) kod seviyesinde HENÜZ mümkün değil. classic-fieldbus (13g) dördü
büyük ölçüde ticari konsorsiyum spec'lerine (PI/CLPA/FieldComm Group)
dayanıyor — spec bulunabilirlik riski dalga 12'den köklü bir fark.

Dalga 9 TAMAMEN KAPANDI (`hayes-command-set → at-commands →
lte-modem-at → {nb-iot, gnss-modem}` zinciri + Karar 6 + Cellular
Initialization Dashboard), dalga 10'un 2026-08-21'de biten alt-dalgaları:
10a (SLIP + COBS), 10b (KISS + PPP), 10c (HDLC + SDLC), 10d (XMODEM +
YMODEM — paylaşılan `xmodemCore.ts`; ZMODEM — kendi çekirdeği
`zmodemCore.ts`, kanonik tanımı olmadığı için AYRI turda, kullanıcı
kararıyla **lrzsz profili** seçildi, sabitler Forsberg'in zmodem.txt/
zmodem.h/zm.c/crctab.c'sinden türetildi), 10e (Custom Binary/ASCII/
Delimiter-Based/Length-Based Protocol — kullanıcı kararıyla
`ProtocolFramingSchema` GENİŞLETİLMEDİ, 3'ü mevcut 5 framing türüyle,
Delimiter-Based Faz 6'nın hazır `hdlc-flag` motoruyla çözüldü).
`framing-stream-protocols` ailesindeki 17 kaydın tamamı artık `ready`/
alias.

**Dalga 11 (2026-08-22 kapandı)** — `interfaces-framing`in kalan dört ailesi,
23 protokol: 11a one-wire · 11b spi/quad-spi/octal-spi · 11c i2c · 11d
rs-485/rs-422 · 11e uart/rs-232 · 11f ttl-uart/cmos-uart · 11g current-loop/
4-20-ma · 11h can-phy/lin-phy/flexray-phy · 11i smbus/pmbus · 11j usb ·
11k ethernet-interface/single-pair-ethernet · #11 microwire/i3c. Son alt-dalga
paylaşılan bir kanal açtı: **`ProtocolPlugin.decodeOptions`** — çerçeveden
çıkarılamayan parametre (Microwire'ın opcode/adres/word genişlikleri, I3C'nin
çerçeve türü) artık kullanıcıdan alınıyor, tahmin edilmiyor. Kanal PMBus
VOUT_MODE üssü, quad-spi dummy cycle ve 1-Wire endianness için de açık duruyor.

**Katalog sayıları (alias'lar çözülmüş hâliyle):** 172 kaydın **89'u `ready`,
15'i `partial`, 68'i `planned`**. Ham `status` alanı 75/15/82 gösterir — aradaki
fark, kanonik kaydı `ready` olan 14 alias kaydından gelir. Durum rozeti her
zaman `resolveStatus()`ten okunur.

Dalga brifleri `docs/brief-faz10-dalga*.md` altında; dalga 10'un tam dökümü
`brief-faz10-dalga10.md`de, dalga 11'inki `brief-faz10-dalga11.md`de.

**Dalga 12 — `network-ethernet` (19 kayıt) SÜRÜYOR.** Keşif turu 2026-08-22'de
yapıldı, brief `brief-faz10-dalga12.md`de: 8 alt dalga (12a icmp/icmpv6 · 12b arp/
lldp · 12c dns/mdns/dhcp · 12d ntp/ptp · 12e snmp/syslog · 12f http/websocket/
mqtt-sn · 12g rtp/rtcp · 12h tftp/ftp/telnet), aile aile kapatma sırasıyla. Üç
mimari bulgu karara bağlandı: (1) `ParsedFrame` DÜZ — katman içiçeliği bu dalgada
ÇÖZÜLMEYECEK, "Network Packet Tree" ayrı iş; (2) `parsePcapFile` yazılmış ama
hiçbir UI'a bağlı değil, dalga sonrası `connection/file` işi; (3) `websocket`
kaydının `live` sekmesi kapsam dışı kalır.

**12a (2026-08-22 bitti, `5155650`) — icmp + icmpv6.** `internetChecksum.ts`
ICMP'yi hazır karşıladı (tam PASS/FAIL, pseudo-header istemez). ICMPv6 checksum'ı
`udp.ts`nin "pseudo-header olmadan doğrulanamaz" desenini izliyor. Neighbor
Discovery ailesi (RFC 4861) spec'in kendi kararıyla ADLANDIRILDI ama gövdesi
ÇÖZÜLMEDİ ("ileride ayrı decoder modülleri" — spec 08-ag-ethernet.md:176-178);
gerçek ND alan çözümü (Target Address, Flags, Options TLV) ayrı bir iş.
`berReader` (GOOSE'dan) henüz kullanılmadı — 12e'de SNMP'nin işi.

**12b (2026-08-22 bitti, `f42c390`) — arp + lldp.** `data-link` ailesi kapandı.
ARP'ta Hardware/Protocol Length teldeki değerden okunur, 6/4 sabitlenmez.
LLDP'nin TLV yürüyücüsü **LLDP'ye özel** yazıldı — 7+9 bit paketli başlık DHCP'nin
klasik TLV8 biçimiyle AYNI DEĞİL; 12a'nın "12c'nin DHCP option'ları aynısını
isteyecek" varsayımı bit düzeyinde YANLIŞ çıktı, `protocol-core/decoding`'e
paylaşılan bir modül AÇILMADI. Organizationally Specific TLV'ler OUI/Subtype
düzeyinde bırakıldı, vendor adı çözümü `definitions:['vendor-map']` kanalının
işi (henüz yok).

**12c (2026-08-22 bitti, `51338f4`) — dhcp + dns + mdns.** `addressing-
discovery` ailesi kapandı. `dnsWire.ts` (RFC 1035) `dns.ts` VE `mdns.ts`
tarafından PAYLAŞILDI — bu ikisi 12b'nin LLDP/DHCP durumunun TERSİ: mDNS
gerçekten DNS'in aynı telini okur (spec:715), tek fark CLASS alanının üst
biti (`variant:'dns'|'mdns'`). İsim sıkıştırması ziyaret edilen pointer
offset'leriyle döngü korumalı çözüldü. DHCP'nin TLV8 option yürüyücüsü
BİLEREK ayrı yazıldı (LLDP'ninkiyle PAYLAŞILMADI — 12b'nin düzeltmesinin
doğrulanmış devamı).

**12d (2026-08-22 bitti, `b149e76`) — ntp + ptp.** `time-management` ailesinin
saat yarısı kapandı. Brief'in öngördüğü ortak `networkTimestamp` kaldıracı
AÇILMADI: öngörü 12b'nin LLDP/DHCP "TLV" varsayımıyla aynı cinsten, bit
düzeyinde yanlış çıktı. NTP damgası 64 bit (32 bit saniye + 32 bit 2^-32
kesir, epoch 1900 UTC), PTP damgası 80 bit (48 bit saniye + 32 bit TAM SAYI
nanosaniye, epoch 1970 **TAI**) — paylaşılan motor kesrin birimini tek seçmek
zorunda kalır ve diğerini sessizce 4295 kat yanlış ölçeklerdi. İki ayrı
okuyucu (`ntpTimestamp.ts`, `ptpTimestamp.ts`) yan yana duruyor. NTP'de era
sarmalı RFC 4330 kuralıyla çözülüp VARSAYIM olduğu uyarılır, sıfır damga
"1900" değil "ayarlanmamış" basar, Reference ID'nin anlamı stratum'a göre üç
ayrı okunur; dört damga modelinden yalnız **T3−T2** türetilir (δ/θ T4'ü ister,
T4 pakete hiç yazılmaz). PTP'de messageType baytın **ALT** yarısıdır,
correctionField işaretli ve nanosaniye × 2^16 ölçeğindedir, twoStepFlag yalnız
Sync/Pdelay_Resp'te tanımlıdır. **PTP TLV'si ÜÇÜNCÜ lehçedir** — TLV16
(2B tip + 2B çift uzunluk), LLDP'nin 7+9 bitinden ve DHCP'nin TLV8'inden
farklı; paylaşılan yürüyücü üçüncü kez açılmadı. Brief'in **açık sorusu 1
karara bağlandı: PTP `ready`** — 12c'de DNS'in Transaction Matching / Response
Time / TTL Simulation araçları aynı gerekçeyle analyzer'a bırakılmışken `ready`
verilmişti; LoRa'nın `partial`ı parser'ı HİÇ OLMAYAN kayda aitti. Sıradaki:
**12e snmp/syslog**.

**12e (2026-08-22 bitti, `b35cbbd`) — snmp + syslog.** `time-management` ailesi
KAPANDI. `berReader.ts` (GOOSE için yazılmış, dalga 12 boyunca beklemişti)
NİHAYET KULLANILDI ve ona X.690'ın kendi tanımları olan iki kardeş eklendi:
`decodeBerObjectIdentifier` + `decodeBerUnsignedInteger`. **Bu, 12b/12c/12d'nin
"paylaşılan modülü speküle etme" dersinin TERS yönü** — burada paylaşım gerçek,
çünkü kodlama standardı ortak; SNMP'ye özel yeni bir modül açılmadı. OID'in ilk
iki arc'ı SAF BÖLMEYLE ayrılmaz (`40 × arc1 + arc2`, arc1=2 iken arc2 39'u
aşabilir — `first/40` yazmak 2.x ağacını yanlış çözer ve `1.3.6.1…`de doğru
çalıştığı için geç fark edilir). SNMP tarafında çözülen değişmezler: v1
Trap-PDU'nun gövdesi standart PDU'yla HİÇ ortak alan taşımaz ve yalnız v1'dedir;
GetBulk'un ikinci/üçüncü INTEGER'ı error-status/index DEĞİL non-repeaters/
max-repetitions'tır; sürüm alanı sıfır tabanlı ve 2 yoktur; Counter/Gauge/
TimeTicks işaretsizdir ve TimeTicks saniyenin yüzde biridir. Syslog tarafında:
PRI'da başta sıfır yasak, tavan 191; STRUCTURED-DATA'da `]` kaçışlı olabilir
(naif bölme mesajı ortadan keser); NILVALUE `-` "boş metin" değil "değer yok";
MSG'in BOM'u UTF-8 bildirimidir; RFC 3164 (BSD) biçimi tanınır ama ÇÖZÜLMEZ.
Brief'in **açık sorusu 2 kapatıldı — kapsam GENİŞLETİLEREK**: v3 zarfı ve USM
parametreleri (Engine ID, kullanıcı, Security Level) anahtar gerektirmediği ve
spec `:376` bunları açıkça istediği için çözülür; yalnız şifreli ScopedPDU
`:377`nin dediği gibi "Encrypted" bırakılır. Sıradaki: **12f http/websocket/mqtt-sn**.

**12f (2026-08-22 bitti, `39b7491`) — http + websocket + mqtt-sn.**
`web-messaging` ailesinin üç kaydı açıldı; üçü de aynı ailede ama HİÇBİR kodu
paylaşmıyor. **DÖRDÜNCÜ "akraba görünen tel biçimi farklı çıktı" vakası, bu kez
en sinsisi:** MQTT-SN'de `mqttVbi.ts` KULLANILAMAZ. MQTT'nin Remaining Length'i
1-4 baytlık VBI'dır, MQTT-SN'in Length'i ya tek bayttır ya `0x01` + 16 bittir —
`0x01` VBI'da "değer 1", MQTT-SN'de "uzunluk sonraki iki baytta" demektir.
Üstelik MQTT-SN'in Length'i **kendi baytlarını da sayar**, MQTT'ninki saymaz.
Aynı akrabalık QoS'ta da yanıltıyor: 0b11 MQTT'de rezerve/hata, MQTT-SN'de
QoS −1. `mqttSn.ts` bilerek `mqtt.ts`in yanına kondu ki fark görünsün.
HTTP'de gövde çerçevelemesi RFC 9112 §6.3 sırasıyla kararlaştırılıyor ve iki
**request smuggling vektörü çerçeve hatası basıyor**: Content-Length ile
Transfer-Encoding'in birlikte gelmesi, ve başlık adıyla `:` arasındaki boşluk.
Chunk boyutu ONALTILIK okunuyor. **Brief'in iki `decodeOptions` adayı da
düzeltildi:** HTTP'de "çerçeveleme kipi sorulmalı" yanlıştı — kip başlıklardan
çıkar, çıkarılamayan tek şey isteğin HEAD olup olmadığıdır, kanal ona
indirgendi; WebSocket'te "yön sorulmalı" ise GEREKSİZ — RFC 6455 §5.1 MASK
bitini yönün kendisi yapar, kanal açılmadı. WebSocket el sıkışması HTTP
mesajıdır ve HTTP sayfasına yönlendiriliyor; `Sec-WebSocket-Accept` asenkron
kripto istediği için (parse senkron sözleşme) hesap aracı olarak ayrı iş.
**websocket kaydının `live` sekmesi KALDIRILDI** — dalga 12'nin karar 3'ü.

**12g (2026-08-22 bitti) — rtp + rtcp.** `real-time-media` ailesi KAPANDI.
RTCP'nin Sender Report'undaki NTP Timestamp'i `ntpTimestamp.ts`nin 64-bit tel
biçimiyle BİREBİR AYNI (RFC 3550 §6.4.1) — 12b/12d'nin "paylaşılan kaldıraç
yanlış çıktı" derslerinin TERSİ, gerçek bir paylaşım (`readNtpTimestamp`,
`readNtpShortMilliseconds` DLSR için de kullanıldı). RTP tarafında Payload
Type için brief'in "SDP dışarıda kalır, tabloda yok" notu harfiyen uygulandı:
RFC 3551'in sabit tablosu (0-95 arası atanmış değerler) gösterilir, dinamik
(96-127) ve atanmamış aralık codec adı UYDURULMADAN uyarıyla bırakılır —
`decodeOptions` kanalı bilerek AÇILMADI. RTCP compound paket döngüsü kendi
`length` alanına güvenir: bir alt paketin İÇERİĞİ (rapor bloğu/SDES chunk'ı)
declared uzunluğa sığmasa bile `length` bozulmadıkça döngü SONRAKİ alt pakete
geçer — yalnız `length`in kendisi tampon dışına taşarsa FATAL olur, çünkü o
zaman bir sonraki paketin nerede başladığı bilinemez. SDES'in PRIV item'ı
(prefix uzunluğu + prefix + değer) ayrı ele alındı; `ParsedField` düz olduğu
için "her alt paket ayrı tree node" isteği (spec `:571`) alan adlarına
(`SR SSRC`, `RTCP Packet 1 Packet Type`) taşınarak karşılandı, şema
değişikliği YAPILMADI (dalga 10/11 kararı burada da geçerli). 43 birim testi
+ 13 e2e (gerçek tarayıcı) + 4199 toplam test + build yeşil.

**12h (2026-08-22 bitti) — tftp + ftp + telnet.** `file-terminal` ailesi
KAPANDI ve onunla birlikte **`network-ethernet` domain'inin 19 kaydı da
TAMAMEN BİTTİ** (dalga 12 kapandı). Üçü de birbirinden bağımsız, hiçbir kod
paylaşmıyor — dalganın "küçük ve bağımsız" öngörüsü doğru çıktı, 12b/12d'nin
yanlış çıkan paylaşım öngörülerinin aksine burada zaten baştan paylaşım
ADAY BİLE DEĞİLDİ.
TFTP tek UDP paketi (`rtp.ts`/`icmpv6.ts` ile aynı "girdi tek mesaj"
çizgisi): RRQ/WRQ'nun Filename+Mode SONRASI ve OACK'ın BAŞTAN İTİBAREN
paylaştığı RFC 2347 option-pair döngüsü GERÇEK bir paylaşım (tek yardımcı
fonksiyon ikisine hizmet etti). "Final Block" kararı klasik 512 baytlık
varsayılana dayanır ve OACK farklı negotiate etmiş olabileceği için bunu
açıkça uyarır — yalnız 512'den KISA bloklar her block size'da kesin.
FTP ve Telnet ise TCP'nin doğal mesaj sınırı OLMAMASI yüzünden `rtp.ts`nin
"girdi tek paket" kararından bilerek AYRILDI: FTP girdiyi yapıştırılan çok
satırlık bir control oturumu sayıp HER CRLF satırını (yanıt kodu mu, komut
mu, sınıflandırılamayan mı) kendi başına işler — RFC 959'un çok satırlı
yanıt devam satırlarını (öndeki boşluklu serbest metin) "şüpheli" diye
uyarmak her normal çok satırlı yanıtta yanlış alarm üretirdi, bu yüzden
sınıflandırılamayan satırlar SESSİZCE ham gösterilir. `PASS`ın argümanı
`physicalValue`de redakte edilir (`********`), `rawBytes` gerçek baytı
korur — kullanıcı verisi zaten yerelde kalıyor, maskeleme omuz sörfüne karşı
varsayılan ekran temkini, güvenlik kontrolü değil.
Telnet girdiyi "yapıştırılan TCP payload'u" sayar (brief'in açık sorusu 4
KARARA BAĞLANDI) ve düz metin ile IAC komutlarını TEK GEÇİŞTE ayrı alanlara
böler; `IAC IAC` kaçışlı literal 0xFF, komşu metin koşularıyla SESSİZCE
birleştirilmez — spec'in "byte-transparency" istediği yer tam burası, kaçışın
nerede geçtiği kendi alanında görünür kalır. `WILL/WONT/DO/DONT` spec'in
"DO ECHO → WILL ECHO → Accepted" örneğindeki gibi ÇAPRAZ yorumlanmaz (RTCP'nin
SR-RR eşleşmemesi, DNS Transaction Matching'in aynı cinsi) — her komut kendi
RFC 854 anlamıyla tek başına gösterilir. Plaintext güvenlik uyarısı (spec
`:676`) her başarılı çözümde SABİT basılır, çünkü temel protokolün şifresiz
olması içeriğe bakılmaksızın hep doğrudur.
60 birim testi + 19 e2e (gerçek tarayıcı) + 4259 toplam test + build yeşil.
**`network-ethernet` domain'i KAPANDI — dalga 12'de açık iş kalmadı.**

Sıradaki domain seçildi: **`industrial-automation`** (16 kanonik kayıt,
keşif turu `docs/brief-faz10-dalga13.md`), 8 alt dalgaya bölündü (13a-13h).

**13a (2026-08-22 bitti) — wireless-m-bus.** `metering` ailesi KAPANDI (m-bus
zaten `ready`ydi). Brief'in "en kanıtlı paylaşım" öngörüsü DOĞRULANDI:
CI=0x72 (TPL Long Header) yolu wired M-Bus'ın `mbusVariableData.ts`teki
`decodeVariableData()`sına baytların birebir seviyesinde uyuyor — wmbusmeters
(açık kaynak)'ın `parseLongTPL()`+`parseShortTPL()` zinciri CI=0x72'den
sonra TAM 12 bayt (Ident+Manufacturer+Version+Medium+AccessNo+Status+
Configuration Field) okuyup DIF/VIF'e geçiyor, `FIXED_HEADER_LENGTH=12` ile
BİREBİR aynı. `decodeVariableData()`nın imzası HİÇ DEĞİŞMEDİ — şifreli
payload'ı yalnız 12 baytlık header'ı vererek "kapatma" tekniği hiçbir
opsiyonel parametre gerektirmedi (fonksiyon zaten `data`yı çağıranın verdiği
kadarıyla işliyordu). `decodeManufacturerCode`/`decodeBcd`/`MEDIUM_NAMES`/
`FIXED_HEADER_LENGTH` de aynı dosyadan EXPORT edilerek DLL A-field'ı için
paylaşıldı — dalganın ilk tüketicisi olma riski (brief madde 3) gerçek
çıkmadı, motor birinci denemede tam uydu.

Link-layer wire format (EN 13757-4'ün resmi metni ücretli, depoda YOK) ÜÇ
bağımsız kamuya açık kaynaktan çapraz teyitle alındı: **rtl_433** (`m_bus.c`
— Block 1 bayt yerleşimi, CRC kapsamı, 16+2 baytlık veri blokları),
**wmbusmeters** (`wmbus.cc`/`.h` — C-field/CI-field tabloları, TPL
Configuration Field bit yerleşimi) ve **reveng.sourceforge.io CRC
kataloğu** + **Kamstrup `meter-system`** (CRC-16/EN-13757 parametreleri —
`crcCatalogue.ts`e YENİ `CRC16_EN13757` girdisi eklendi, `CRC16_DNP` ile
AYNI polinomu (0x3D65) paylaşıp YANSITMASI farklı olan bir tuzak
YAKALANDI ve ayrıştırıldı). Configuration Field'ın Security Mode bit
yerleşimi (bit 8-12) AYRICA resmi **OMS-Group Vol.2 Primary Communication**
spec'inin (oms-group.org, halka açık PDF) Table 18/19'uyla doğrulandı —
`pdftotext` ile indirilip okundu, wmbusmeters'ın kod-seviyesi yorumuyla
birebir örtüştüğü görüldü.

Kapsam bilinçli daraltıldı (IEC 61850 GOOSE-only kararının presedanı):
yalnız **Format A** çözülür (Format B fiziksel katmanda ayrı bir sync ile
ayrışır, girdi baytlarından güvenle ayırt edilemez); CI-field'ların yalnız
**0x72** yolu DIF/VIF zincirine kadar çözülür, diğerleri (0x73/0x78/0x79/
0x7A/0x7B/ELL/AFL) adlandırılır ama ham bırakılır. **AES şifre çözme
UYGULANMADI** — iki gerekçe: `ProtocolParser.parse()` saf/senkron olmalı
(protocol-core/types.ts) oysa WebCrypto'nun `SubtleCrypto.decrypt`i
tarayıcıda yalnız asenkron, senkron sözleşmeyi kırmadan gerçek AES-128-CBC
bağlanamazdı; senkron elle yazılmış bir AES çekirdeği de NIST KAT
vektörleriyle ayrı doğrulanması gereken, "kolay" alt dalganın kapsamını
aşan yeni bir kriptografi yüzeyi olurdu. Bunun yerine Configuration
Field'dan Security Mode (0/5/7/10/13) çıkarılıp "Encrypted Payload" olarak
gösteriliyor — SNMP'nin şifreli ScopedPDU kararıyla AYNI desen. Radio
metadata (Timestamp/Frequency/Mode/RSSI/LQI-SNR) telgraf baytlarının
İÇİNDE olmadığı için `decodeOptions` üzerinden opsiyonel bağlam olarak
sunuluyor (Device ID/Manufacturer/Direction/Encryption Status ise GERÇEKTEN
bayt akışından çözüldüğü için decodeOptions'a duplicate edilmedi).
Çoklu-blok (16 baytı aşan) çerçevelerde `decodeVariableData()`ya devredilen
alanların `offset`i ilk 16 bayttan sonra 2 bayt/blok kayabilir (çıkarılan
CRC baytları flat `baseOffset` sözleşmesine yansımıyor) — bu durumda
`multiBlockOffsetApproximate` uyarısı basılıyor, DEĞERLER yine doğru.

34 birim testi (`wirelessMbus.test.ts`) + 11 e2e (gerçek tarayıcı,
`wireless-mbus-decode.spec.ts` — kanonik sayfa + `wireless-iot/
wireless-metering` alias sayfası dahil) + 4294 toplam test + typecheck/build
yeşil. Değişen dosyalar: `protocols/industrial/mbus/wirelessMbus.ts` (yeni),
`wirelessMbus.test.ts` (yeni), `mbusVariableData.ts` (yalnız EXPORT ekleri —
davranış değişmedi), `protocol-core/checksums/crcCatalogue.ts` +
`crcEngine.test.ts` (`CRC16_EN13757` eklendi), `protocols/index.ts` (kayıt),
`app/catalog/domains/industrial-automation.ts` (`status: 'ready'`,
`pluginId`), `translations/{tr,en}.ts`, `e2e/wireless-mbus-decode.spec.ts`
(yeni). Sıradaki: **13b (iec-60870-5-101)** — `decodeAsdu()` paylaşımı,
brief'in "kod seviyesinde zaten kanıtlı" dediği ikinci en güvenli alt dalga.

**13b (2026-08-23 bitti) — iec-60870-5-101.** Brief'in "kod seviyesinde zaten
kanıtlı" dediği `decodeAsdu()` paylaşımı DOĞRULANDI: `iec104.ts`in ASDU
çekirdeği (`iec104Asdu.ts`teki `decodeAsdu()`) imzası HİÇ DEĞİŞMEDEN 101'e
devredildi, yalnız `AsduWidths`e üçüncü bir alan (`causeOfTransmissionLength`,
1=yalnız cause / 2=cause+originator address) EKLENDİ — kanıt: Wireshark'ın
`asdu_parms{cot_len;asdu_addr_len;ioa_len}` ile lib60870'in
`CS101_AppLayerParameters{sizeOfCOT;sizeOfCA;sizeOfIOA}`ı AYNI üç alanı
parametrize ediyor (2 bağımsız kaynak, tam örtüşme). Varsayılan `2` kaldığı
için 104'ün 21 testi DEĞİŞMEDEN yeşil kaldı.

101'in 104'te HİÇ olmayan gerçek farkı — SERİ link katmanı (IEC 60870-5-1
FT1.2: Tek Karakter Onayı 0xE5, Sabit/Değişken Uzunluklu çerçeve) — sıfırdan
yazıldı ve YEDİ bağımsız kamuya açık kaynaktan (Wireshark `packet-iec104.c`
— 101/104/ASDU dissector'larının HEPSİ bu TEK dosyada, ayrı
`packet-iec60870_101.c` YOK; lib60870-C `link_layer.c`/`iec60870_common.h`/
`link_layer_parameters.h`/`cs101_master.h`; scadaprotocols.com; Wikipedia)
çapraz teyitle alındı. Checksum PAYLAŞILDI: `sum8Checksum`
(`protocol-core/checksums/simpleChecksums.ts`) zaten GENEL bir yardımcıydı,
`mbus.ts` (wired M-Bus, EN 13757-2 → FT1.2'yi DOĞRUDAN miras alır) da AYNI
hesabı kendi link katmanında kullanıyordu — ayrı bir 101-özel checksum
fonksiyonu YAZILMADI.

Control field'ın PRM'ye göre çift-anlamlı bit yapısı (RES/DIR+PRM+FCB/ACD+
FCV/DFC+fonksiyon nibble'ı) `mbus.ts`in dalga 5c'de zaten kurduğu AYNI
ayrımla çözüldü — üstelik `mbus.ts`in C Field'ı (aynı FT1.2 mirası) ACD
bitinin FCB ile AYNI konumda olduğunu DOĞRULAYAN, Wireshark'ın eksik
bıraktığı bir yerel emsal olarak da işe yaradı. Fonksiyon kodu tabloları dar
tutuldu (`iec104Asdu.ts`in `ELEMENT_WIDTH_TABLE` disiplini): PRM=1 yönünde
kod 2 ve 7 Wireshark ("Reserved") ile lib60870 (gerçek handler'lı
`TEST_FUNCTION_FOR_LINK`/`RESET_FCB`) arasında ÇAKIŞTI, kod 8 TEK kaynaklı —
üçü de HAM bırakıldı; PRM=0 yönünde YEDİ kod çakışmadan örtüştü, hepsi
adlandırıldı. Broadcast link adresi (255/65535) TEK kaynaklı (yalnız
lib60870) — ADLANDIRILMADI.

`decodeOptions`a DÖRT genişlik kanalı açıldı — Link Address (0/1/2 bayt),
Common Address (1/2), Information Object Address (1/2/3), Cause of
Transmission (1/2) — dördü de brief'in öngördüğü gibi çerçeveden
ÇIKARILAMAYAN sistem parametreleri. Dengeli/dengesiz iletim modu SEÇİMİ ayrı
bir kanal olarak AÇILMADI: RES/DIR bitinin hangi yorumla okunacağı hiçbir
downstream çözümü etkilemiyor (fonksiyon tablosu seçimi yalnız PRM'ye
bakıyor), bu yüzden bit ham değeriyle nötr gösteriliyor (dalga 12f'nin
WebSocket MASK-biti dersiyle aynı disiplin — çerçeveden okunabilecek bir
şeyi sorma).

32 birim testi (`iec101.test.ts`, checksum'lar bağımsız bir toplama
döngüsüyle AYRICA doğrulanıyor) + 15 e2e (gerçek tarayıcı,
`iec101-decode.spec.ts`) + 4326 toplam test + typecheck/build yeşil;
`iec104`ün 21 testi DE yeşil kaldı (paylaşılan çekirdek bozulmadı).
Değişen/yeni dosyalar: `protocols/industrial/iec101/iec101.ts` (yeni) +
`iec101.test.ts` (yeni), `protocols/industrial/iec104/iec104Asdu.ts`
(`AsduWidths`e `causeOfTransmissionLength`, varsayılan 104 davranışını
KORUYARAK), `protocols/index.ts` (kayıt) + `index.test.ts` (kayıt sayacı
güncellendi), `app/catalog/domains/industrial-automation.ts` (`status:
'ready'`, `pluginId`), `translations/{tr,en}.ts`, `e2e/iec101-decode.spec.ts`
(yeni). Sıradaki: **13c (opc-ua)** — paylaşım YOK, bağımsız/en geniş araç
yüzeyi (12 araç), çok adımlı state machine — brief'in Opus·high önerisi.

**13c (2026-08-23 bitti) — opc-ua.** `scada-utility` ailesi KAPANDI (iec-60870-5-104,
dnp3, iec-61850 partial, iec-60870-5-101, opc-ua). Brief'in "paylaşım YOK, bağımsız,
en geniş araç yüzeyi" tahmini DOĞRULANDI; "kaynak riski yüksek" tahmini ise bu kayıtta
ÇÜRÜDÜ ve bunun kapsam üstünde doğrudan etkisi oldu. OPC Foundation'ın **Part 6
(Mappings) v1.05 metni halka açık**, üstelik tip/servis/durum tabloları MİT lisanslı ve
MAKİNE-OKUNUR (`UA-Nodeset/Schema/`: `NodeIds.csv`, `StatusCode.csv`,
`AttributeIds.csv`, `Opc.Ua.Types.bsd`). Yani domain'in "ticari konsorsiyum spec'i,
çoğu ücretli" kuralının İSTİSNASI. Risk kaynak bulmakta değil HACİMDE çıktı: karar
"nereye kadar" sorusuna verildi, "bulabildim mi" sorusuna değil.

Alan yerleşimlerinin tamamı **dört bağımsız kaynakta çapraz teyitli** (P6 + Wireshark
`plugins/epan/opcua/` + open62541 `ua_types_encoding_binary.c` + OPCF Schema); çelişki
BULUNMADI, tek kaynakta kalan hiçbir alan adlandırılmadı. Birim testlerin referans
baytları **Part 6'nın KENDİ örneklerinden** geliyor (Şekil 2 Int32 1e9, Şekil 3 Float
-6.5, Şekil 4 String "水Boy", Şekil 5 Guid 72962B91-…, Şekil 7-9 üç NodeId varyantı) —
uydurma bayt YOK.

**Kapsam (bilinçli, özet metninde de yazılı).** Girdi OPC UA TCP (UACP) binary
çerçevesi, TEK MessageChunk; HTTPS/SOAP/JSON mapping'leri kapsam dışı. ÇÖZÜLÜR: dört
UACP mesajı TAM (HEL/ACK/ERR/RHE), UASC zarfı TAM (OPN'in asimetrik başlığı —
SecurityPolicyUri/SenderCertificate/ReceiverCertificateThumbprint; MSG/CLO'nun simetrik
başlığı — TokenId; ikisinin SequenceHeader'ı), ChunkType F/C/A ayrımı, **78 servisin
tamamının ADI** ve HER serviste Request/ResponseHeader. **Dokuz servisin gövdesi alan
alan** çözülür: OpenSecureChannel istek/yanıt, CloseSecureChannel isteği, Read
istek/yanıt, Write isteği, Browse isteği, CreateSubscription istek/yanıt — seçim
ölçütü kaydın araç listesindeki her aracı (Secure Channel · Read · Write · Browse ·
Subscription) EN AZ BİR gerçek gövdeyle karşılamaktı. HAM BIRAKILIR: kalan 69 servisin
gövdesi (Session, Endpoint Discovery, Method/Call, MonitoredItems dâhil) — adı ve
header'ı basılır, gövde tek "Service Body" alanı olur ve alan uyarısı bunu SÖYLER.
[[IEC 61850 GOOSE-only]] ve 13a'nın Format-A-only presedanıyla aynı çizgi. Kayıt yine
de `ready`: 12 aracın hepsinin karşılığı ekranda var, daraltma gövde DERİNLİĞİNDE, araç
KAPSAMINDA değil.

**KRİPTO SINIRI — zarf EVET, kripto HAYIR.** Depoda kurulu dört presedan (`snmp.ts` v3
zarfı, `ntp.ts` MD5, `wirelessMbus.ts` AES, `websocket.ts` Accept) aynen sürdürüldü;
teknik gerekçe `ProtocolParser.parse()`in SAF+SENKRON, `SubtleCrypto`nun ASENKRON
olması. Kritik ayrıntı: şifreli bölgenin sınırı gövde DEĞİL **SequenceHeader**tır —
Wireshark `opcua.c`in kendi ASCII şeması bunu birebir söylüyor (Message Header +
Security Header açık; SequenceHeader + Body + Padding + Signature şifreli). Bu yüzden
SignAndEncrypt'te SequenceNumber bile BASILMAZ; okunuyormuş gibi göstermek uydurmak
olurdu. İmza yalnız gövdeden AYRILIR, DOĞRULANMAZ; sertifika yalnız GÖSTERİLİR, zinciri
ve iptal durumu DOĞRULANMAZ — ikisi de alan seviyesinde uyarı taşır.

**`decodeOptions` — İKİ kanal.** (1) `bodySecurity` (auto/plaintext/encrypted): brief
"muhtemelen kanal AÇILMAZ" diyordu, ama MessageSecurityMode SecureChannel açılışında
PAZARLIKLA belirlenir ve tek bir MSG çerçevesinin baytlarında YOKTUR — çerçeveden
çıkarılamayan parametrenin tanımı bu. Varsayılan `auto`, Wireshark'ın
`UA_MessageMode_MaybeEncrypted` sezgisinin AYNISIDIR (SequenceHeader'dan sonraki NodeId
tanınan bir servise çözülüyorsa gövde açıktır); OPN'de SecurityPolicyUri `#None` ile
bitiyorsa bilgi baytların İÇİNDEDİR ve sezgiyi EZER. (2) `signatureLength`: Sign
modunda gövdenin sonundaki imza bayt sayısı politikaya bağlıdır, çerçevede yazmaz —
Wireshark da bunu `g_opcua_default_sig_len` KULLANICI TERCİHİ olarak soruyor. Brief'in
öngördüğü "sertifika güven zinciri / trust store" kanalı ise AÇILMADI: doğrulama zaten
yapılmıyor, sormak kullanıcıya yapılmayacak bir işin sözünü vermek olurdu.

**Paylaşım kararı.** `protocol-core`tan GERÇEKTEN uyan ikisi paylaşıldı:
`encoding/ieee754.ts`in `decodeFloat32/64(…, 'little')` (P6 §5.2.2.3 düz IEEE 754
little-endian) ve `encoding/utf8Viewer.ts`in `utf8BytesToString` (P6 §5.2.2.4 UTF-8).
AYRI yazılanlar ve gerekçeleri: `buffers/endianness.ts`in `bytesToNumber`ı imleç
tutmuyor ve 64 bit taşımıyor (Int64/UInt64 `bigint` gerektiriyor);
`decoding/bitCursor.ts` bit hizasız okuma için, OPC UA ise tümüyle bayt hizalı.
**`encoding/unixTimestamp.ts` SAHTE DOST olarak işaretlendi ve KULLANILMADI** —
oradaki damga Unix epoch (1970) + saniye, buradaki 1601-01-01 UTC + 100 ns tick;
karıştırmak 369 yıl kaydırır (12d'nin NTP/PTP dersi). Dönüşüm sabiti
(`TICKS_1601_TO_1970`) türetimiyle birlikte açıkça yazıldı ve testle kilitlendi.
Yerleşik tip çözücüleri KENDİ dosyasını hak etti (`opcUaBinary.ts`, `dnsWire.ts`/
`iec104Asdu.ts` deseni): çerçeve katmanından bağımsız bir dilbilgisi ve kendi
fixture'larıyla ayrı sınanıyor. Spekülatif ortak modül AÇILMADI.

Yakalanan tuzaklar (hepsi teste bağlandı): NodeId'in altı varyantının FARKLI
uzunlukları (TwoByte 2 / FourByte 4 / Numeric 7 — yanlış varyant sonraki HER alanı
kaydırır); uzunluk −1 (null) ile 0 (boş) ayrımı ve uzunlukların İŞARETLİ okunması;
Variant mask'ının bit 6/bit 7 ayrımı ve dizi uzunluğunun da −1 olabilmesi; Guid'in düz
16 bayt OLMAMASI (Data1/2/3 little-endian, Data4 ham); DiagnosticInfo'da AKIŞ sırasının
MASK bit sırasından farklı olması (maskede LocalizedText 0x04 önce ama akışta Locale
önce — open62541 + Wireshark ikisi de teyit); MessageSize'ın başlığın KENDİSİNİ sayması;
HEL/ACK/ERR/RHE'de SequenceHeader OLMAMASI (12e'nin "aynı konum, başka anlam" dersi);
ChunkType 'A' gövdesinin servis DEĞİL StatusCode+Reason taşıması; ChunkType 'C'de
servis NodeId'sinin BULUNMAMASI. Dizi elemanı basan her fonksiyon alan id'sine KENDİ
offset'ini yazıyor (12g/12h'de iki kez ödenen ders), ve bir test bunu bütün örneklerde
bekçiliyor.

83 birim testi (`opcUaBinary.test.ts` 40 + `opcua.test.ts` 43) + 20 e2e (gerçek
tarayıcı, `opcua-decode.spec.ts`) + 4409 toplam test + typecheck/build yeşil.
Değişen/yeni dosyalar: `protocols/industrial/opcua/opcUaBinary.ts` (yeni) +
`opcUaBinary.test.ts` (yeni), `protocols/industrial/opcua/opcua.ts` (yeni) +
`opcua.test.ts` (yeni), `protocols/index.ts` (kayıt) + `index.test.ts` (kayıt sayacı),
`app/catalog/domains/industrial-automation.ts` (`status: 'ready'`, `pluginId`),
`translations/{tr,en}.ts` (69 anahtar), `e2e/opcua-decode.spec.ts` (yeni), `CLAUDE.md`
(borç sayımı). `protocol-core/types.ts`e DOKUNULMADI, encoder YAZILMADI, `live` sekmesi
KORUNDU. Sıradaki: **13d (cip, ethernet-ip, devicenet)** — `cip-can-based` ailesini
kapatır; `cipObjectModel` GERÇEK paylaşım adayı, sıralama önemli (cip önce yazılır,
iki taşıyıcı onu tüketir).

**13d (2026-08-23 bitti) — cip, ethernet-ip, devicenet.** `cip-can-based` ailesi
KAPANDI (canopen zaten `ready`ydi) + `industrial-ethernet`ten bir kayıt (ethernet-ip)
alındı. Brief'in 2. mimari bulgusu ("CIP GERÇEK bir paylaşım vakası") DOĞRULANDI:
`cipCore.ts` yeni ortak motor olarak yazıldı (`iec104Asdu.ts`/`opcUaBinary.ts`in "fields
dizisine doğrudan basan, kendi `ProtocolParser`ı OLMAYAN" deseniyle BİREBİR) ve HEM
`cip` kaydının kendi başına plugin'i HEM `ethernetip.ts`in SendRRData/SendUnitData CPF
Data Item'ları HEM `devicenet.ts`in (isteğe bağlı) payload yorumu TARAFINDAN AYNEN
tüketildi — üç dosya da `decodeCipMessage()`in ürettiği BİREBİR aynı alan adlarını
(`service`/`path-class`/`path-instance`/`general-status`…) yalnız farklı öneklerle basar.

Brief'in "cross-domain paylaşım emsali YOK" tahmini ÇÜRÜDÜ: ana session'ın işaret ettiği
gibi `canopen.ts:57` zaten `automotive/can/canClassic`i paylaşıyordu (dalga 1'den beri).
`devicenet.ts` AYNI emsali izledi — `canFrame.ts`/`canClassic.ts`ten `decodeCanId`/
`readUint32Le`/`CAN_HEADER_LENGTH`/`buildCanClassicFrame` alındı, İKİNCİ bir CAN
çözücü YAZILMADI. CAN ailesinin kendi testleri (canopen dahil) dokunulmadan yeşil kaldı.

**Kaynak durumu — ODVA'nın Volume 1/2/3'ü ücretli, depoda YOK.** Üç bağımsız kamuya açık
kaynaktan çapraz teyitle alan yerleşimleri kuruldu: **OpENer** (EIPStackGroup/OpENer,
Apache-2.0 — bağımsız açık kaynak EtherNet/IP stack'i; `ciperror.h`/`ciptypes.h`/
`cipepath.c` KOD SEVİYESİNDE okundu, kod kopyalanmadı), **Wireshark** `packet-cip.c`/
`packet-enip.c` (GPL-2.0, bağımsız implementasyon), **scadaprotocols.com** (tertiary,
101'in S3 kaynağıyla AYNI ölçütle kabul edildi — "CIP Path Segments Explained"/"CIP
General Status Codes Reference" sayfaları). Üçü de General Status tablosunda VE EPATH
segment/format bitlerinde birebir örtüştü, çelişki YOK. **En kritik doğrulama:**
OpENer'ın `cipepath.c`si `CipEpathGetLogicalValue()`da 16/32-bit logical segment'lerde
"Pad byte needs to be skipped" yorumuyla PAD BAYTINI KOD SEVİYESİNDE kanıtlıyor —
brief'in vurguladığı tuzak gerçekten var ve `cipCore.test.ts` bunu hem 16-bit hem 32-bit
için ayrı testle kilitliyor (16-bit Class segmentinde PAD atlanmasaydı Instance
segmenti bir bayt kayardı, test bunu doğruluyor).

**EDS sorusu** (brief açık soru 1) ana session tarafından zaten kapatılmıştı:
`ethernet-ip`e `definitions` sekmesi/listesi EKLENMEDİ, `tabs`/`tools` alanlarına
dokunulmadı.

**DeviceNet'in kapsam dışı bıraktığı, dosya başında açıkça yazılan iki nokta:** (1)
Group 3 ile Group 4'ün kesin sayısal sınırı — iki bağımsız ikincil kaynak (element14,
embien.com) Group 1 (`0x000-0x3FF`, 4-bit Message ID) ve Group 2'yi (`0x400-0x5FF`,
3-bit Message ID) birebir aynı aralıkta doğruluyor, ama `0x600-0x7FF`in Group 3/Group 4
arasında NASIL bölündüğünü veren ikinci kaynak bulunamadı — bu yüzden TEK "Group 3/4"
etiketiyle gösterilir, Message ID/MAC ID ham sayı kalır. (2) Message ID'nin SAYISAL
DEĞERİNİN anlamı (Predefined Master/Slave Connection Set tablosu) — CANopen'ın PDO
içeriğini EDS'e bırakmasıyla AYNI sınır, uydurulmadı. (3) Fragmentation Protocol
(>8 baytlık CIP mesajları) uygulanmadı.

**`decodeOptions` — TEK kanal, yalnız DeviceNet'te.** `payloadInterpretation`
(raw/cip-explicit, varsayılan raw): yukarıdaki Group 3/4 sınırı belirsizliği yüzünden
payload'ın I/O verisi mi CIP Explicit Message mi olduğu ÇERÇEVEDEN güvenilir
çıkarılamıyor — `iec-60870-5-101`in link adresi genişliği kanalıyla AYNI gerekçe sınıfı
(sistem bağlamı gerekiyor, tahmin edilmiyor). `cip` ve `ethernet-ip` HİÇBİR kanal
AÇMADI: istek/yanıt ayrımı Reply Service'in 7. bitinden (12f'nin WebSocket MASK-biti
dersiyle AYNI disiplin), command-specific data biçimi Command kodundan, CPF item
içeriği Type ID'den — hepsi çerçevenin kendisinden okunuyor, kanal GEREKMEDİ.

**Encoder YAZILMADI** (`modbus-tcp`/`iec-60870-5-101`/`opc-ua` emsali — `build` sekmesi
katalogda var ama plugin'de `encoder` alanı YOK), `protocol-core/types.ts`e
DOKUNULMADI, `live`/`tools`/`definitions` alanlarına DOKUNULMADI.

42 birim testi (`cip.test.ts` 17 + `ethernetip.test.ts` 12 + `devicenet.test.ts` 13) +
28 e2e (gerçek tarayıcı — `cip-decode.spec.ts` 11, `devicenet-decode.spec.ts` 9,
`ethernet-ip-decode.spec.ts` 8 — her dosyada `decode-parse-error` (`success:false`)
yolunu da AYRICA sınayan bir test var) + 4451 toplam test + typecheck/build yeşil; canopen +
CAN ailesinin mevcut testleri (paylaşılan `canClassic.ts`/`canFrame.ts` dokunuldu)
DOKUNULMADAN yeşil kaldı. Değişen/yeni dosyalar: `protocols/industrial/cip/cipCore.ts`
(yeni, paylaşılan motor), `cip.ts` (yeni) + `cip.test.ts` (yeni),
`protocols/industrial/ethernetip/ethernetip.ts` (yeni) + `ethernetip.test.ts` (yeni),
`protocols/industrial/devicenet/devicenet.ts` (yeni) + `devicenet.test.ts` (yeni),
`protocols/index.ts` (üç kayıt) + `index.test.ts` (kayıt sayacı, alfabetik sıra),
`app/catalog/domains/industrial-automation.ts` (üç kayıt `status: 'ready'` + `pluginId`),
`translations/{tr,en}.ts` (~90 anahtar), `e2e/{cip,devicenet,ethernet-ip}-decode.spec.ts`
(yeni), `CLAUDE.md` (borç sayımı: 45→42 kanonik, industrial-automation 13→10). Sıradaki:
**13e (profinet)** — `industrial-ethernet`in en yaygın/en çok araçlı kaydı, GSDML
definitions + DCP discovery + slot/subslot ağacı.

**13e (2026-08-23 bitti) — profinet.** `industrial-ethernet` ailesinin en yaygın ve en
çok araçlı kaydı; ailede 4 kayıt kaldı (cc-link-ie, sercos-iii, powerlink + classic
tarafı ayrı). Brief'in ana tahmini DOĞRULANDI: **PROFINET tek bir tel biçimi değil,
EtherType 0x8892 altında FrameID ile ayrışan bir AİLEdir**; dispatch alanı FrameID'dir
ve gövde ancak ondan sonra okunabilir. `profinetFrameId.ts` bandın tamamını
sınıflandırır, `profinetDcp.ts` ve `profinetAlarm.ts` iki büyük sınıfı `cipCore.ts`
deseniyle (çağıranın `fields` dizisine doğrudan basan, kendi `ProtocolParser`ı OLMAYAN
çekirdek) çözer, `profinet.ts` Ethernet katmanını ve dağıtımı yapar.

**Brief'in bir tespiti ÇÜRÜDÜ.** `brief-faz10-dalga13.md:38-42` "`ethercat.ts`
`network-ethernet`in `ethernetFrame.ts`inden HİÇBİR ŞEY import etmiyor, emsal budur"
diyordu; kod bunun tersini söylüyor (`ethercat.ts:96-105` `formatMac`,
`classifyDestinationMac`, `walkTypeLengthChain`, `MAC_LENGTH`, `MIN_HEADER_LENGTH`,
`TYPE_LENGTH_FIELD_LENGTH`, `VLAN_TPID`'yi AYNEN alıyor). Doğru emsal PAYLAŞIM olduğu
için `profinet.ts` de aynısını yaptı — **girdi sınırı ethercat.ts ile BİREBİR aynı: TAM
bir Ethernet çerçevesi** (DST/SRC MAC + opsiyonel VLAN tag'leri + EtherType + gövde).
Ailede iki farklı girdi sözleşmesi yok; ikinci bir MAC formatlayıcı ya da ikinci bir
VLAN yürüyüşü YAZILMADI. `ethernetFrame.ts`in `ETHER_TYPE_NAMES` tablosuna 0x8892
eklendi (5d'de 0x88A4, 5e'de 0x88B8 için kurulan "motoru OLAN her EtherType burada
ADLANDIRILIR" kuralının gereği); zincir yine KURULMAZ.

**Kaynak durumu — PI'nin IEC 61158-6-10 metni üyelik/ücret arkasında, depoda YOK.** İki
bağımsız kamuya açık kaynaktan çapraz teyit: **Wireshark PROFINET eklentisi**
(`plugins/epan/profinet/{packet-pn-rt.c, packet-pn-dcp.c, packet-pn.h,
packet-dcerpc-pn-io.c}`, GPL-2.0; `packet-pn-dcp.c` dosya başı kaynağını "IEC 61158-6-10
section 4.3" diye yazıyor) ve **p-net** (RT-Labs AB, GPLv3/ticari çift lisans —
`src/pf_types.h`, `src/common/pf_dcp.[ch]`, `src/common/pf_alarm.c`,
`include/pnet_api.h`). İkisi de KOD SEVİYESİNDE okundu, kod kopyalanmadı. Örtüşenler:
EtherType 0x8892, DCP başlığının 10 baytı, blok başlığının 4 baytı, çift hizalama
dolgusu, DCP Option/Suboption numaraları, DCP FrameID dörtlüsü (0xFEFC-0xFEFF), alarm
FrameID ikilisi (0xFC01/0xFE01), RTA sabit başlığının 12 baytı, PNIOStatus'un 4 baytı ve
**DataStatus'un sekiz biti** (W'nin `hf_pn_rt_data_status_*` maskeleri ile P'nin
`pnet_data_status_bits_t` bit numaraları BİREBİR aynı).

**Çakışan/tek kaynaklı olduğu için ADLANDIRILMAYANLAR** (`ethercat.ts`in 0xFF/"EXT"
emsali): AlarmType 0x0007 (W "Redundancy" / P `MEDIA_REDUNDANCY`) ve 0x000A (W "Plug
wrong submodule" / P `PLUG_WRONG_MODULE` — biri submodule, öteki module diyor) ÇAKIŞTI;
0x0014-0x001D bandını yalnız P adlandırıyor, W "reserved" diyor. FrameID 0xFC41/0xFE41/
0xFE02/0xFE03/0xFE42 ("with security", RSI, SXP) yalnız W'de — hem tek kaynaklı hem
kripto sınırının ötesinde, `reserved` sayılıp gövdeleri ham bırakıldı. DeviceRole
baytının BİT anlamları hiçbir kaynakta yok → ham bayt. Ayrıca W'nin kendi kaskadındaki
bir tutarsızlık (0xFF22 dalının KOŞULU `<= 0xFF22` iken YORUMU "0xFF22-0xFF3F Reserved"
diyor) yorumun lehine çözüldü ve birim testiyle kilitlendi.

**Tuzak 1 — DCP blokları ÇİFT uzunluğa hizalanır.** Blok başlığı 4 bayt (çift) olduğu
için toplamın tekliği yalnız DCPBlockLength'ten gelir; tek uzunluklu bloktan sonra 1
bayt `0x00` pad vardır. `cipCore.ts`in EPATH pad tuzağıyla AYNI SINIF: pad sıfır olduğu
için tek bloklu örneklerde hata GÖRÜNMEZ, ama zincirde sonraki HER blok bir bayt kayar.
İki örnek çerçeve bunu bilerek tetikliyor — `dcp-identify-response`ta ilk blok 11 baytlık
(TEK) bir değer taşır ve pad atlansaydı ikinci bloğun Option baytı `'c'` (0x63) okunurdu;
`dcp-set-response-padding`ta ART ARDA iki Control/Response bloğu (değer = Option +
Suboption + BlockError = 3 bayt, TEK) pad zincirini sınar. Hem birim testi hem e2e turu
ofseti SAYIYLA doğruluyor (blok 0 @26, pad @41, blok 1 @42) — e2e'de ofset sütunu
tarayıcıda okunuyor, yani hizalama gerçekten ekranda kanıtlanıyor.

**Tuzak 2 — APDU Status ÇERÇEVE SONUNDAN GERİ SAYILARAK bulunur.** Döngüsel çerçevede
I/O verisinin uzunluğu ÇERÇEVEDE YAZMAZ; çerçevenin sonunda sabit 4 bayt (CycleCounter 2
+ DataStatus 1 + TransferStatus 1) vardır ve konumu ancak sondan geri sayılarak bulunur.
İki kaynak da böyle yapıyor (W: `tvb_get_ntohs(tvb, pdu_len - 4)` / `pdu_len - 2` /
`pdu_len - 1` ve `data_len = pdu_len - 2 - 4`; P: `pf_iocr_t`in `cycle_counter_offset` /
`data_status_offset` / `transfer_status_offset` alanları). Bunun bedeli dosya başında
AÇIKÇA yazılı ve alan uyarısı olarak basılıyor: yakalamaya eklenmiş her fazladan bayt
(Ethernet dolgusu ya da yakalanmış FCS) kuyruğu kaydırır, çerçevede bunu yakalayacak bir
uzunluk alanı YOKTUR. Birim testi aynı gövdeyi iki farklı uzunlukta çerçeveyle çözüp
kuyruğun BİRLİKTE kaydığını gösteriyor.

**I/O verisi HAM bırakıldı — sahte kırılım UYDURULMADI.** IOPS/IOCS baytları submodule
verisiyle iç içe geçer ve konumları yalnız GSDML/AR bağlamından bilinir: P'de bu ofsetler
(`pf_iodata_object_t.data_offset / iops_offset / iocs_offset`) `pf_cmdev.c`de CONNECT
isteğindeki IOCR tanımlarından HESAPLANIR, döngüsel çerçeveden OKUNMAZ. Bölge tek parça
ham basılır ve nedeni alan uyarısıyla söylenir (`ethercat.ts`in datagram verisi emsali).
e2e turu I/O bölgesinde TEK satır olduğunu ayrıca doğruluyor.

**`decodeOptions` — HİÇBİR kanal AÇILMADI, üç ayrı gerekçeyle.** (1) "I/O veri uzunluğu"
/ "APDU Status var mı" çerçeveden ÇIKARILABİLİR (sınıf FrameID'den, uzunluk sondan geri
sayılarak) — dalga 12f'nin WebSocket MASK-biti dersiyle AYNI disiplin, kanal gereksiz.
(2) "IOPS/IOCS konumları" bir `select`/`number` alanına SIĞMAZ; slot/subslot ağacı ister,
yarım bir kanal yanlış kırılıma davet olurdu. (3) "time-aware (TSN) profili" 0x0100-
0x3FFF bandının anlamını değiştiriyor ama bilgi çerçevede DEĞİL OTURUMDA
(`packet-pn-rt.c:718` onu `conversation_get_proto_data(...)`ten alıyor); tek çerçeve
çözen bir motorda kullanıcı da bunu bilemez, bu yüzden klasik okuma uygulanıp belirsizlik
UYARIYLA bildirildi.

**Kapsam dışı bırakılanlar, dosya başında açıkça:** (1) **PN-IO acyclic**
(Connect/Release/Read/Write) DCE/RPC üzerinden UDP/IP'de taşınır — bu motorun girdisi ham
Ethernet çerçevesi, o ayrı ve büyük bir tel biçimi. (2) **PTCP** (Sync/Follow Up/Delay/
Announce) aynı EtherType altında gelir, bu yüzden SINIFLANDIRILIR ama gövdesi ham kalır
(`packet-pn-ptcp.c` Wireshark'ta bile ayrı bir dissector). (3) **GSDML ayrıştırıcısı**
yazılmadı — bu depoda tanım dosyası paneli yalnız `DbcPanel`/`EdsPanel`; `definitions`
sekmesi "planlandı" bildirimi basıyor (CLAUDE.md bunu açıkça meşru sayıyor) ve
`tabs`/`tools`/`definitions`/`live` alanlarına DOKUNULMADI. (4) AlarmSpecifier'dan
sonraki UserStructureIdentifier YÜKÜ (MaintenanceItem/AlarmItem/ChannelDiagnosis) AR
bağlamı ister; USI ADLANDIRILIR, yükü ham kalır.

**`ready` kararı ve araç sayımı.** Katalogdaki 9 aracın **2'si tam** (Device Discovery/
DCP, Alarms), **5'i kısmi** (IO Controller, IO Device, Cyclic I/O — çerçeve ve APDU
Status evet, yük semantiği hayır —, Slot/Subslot — alarmda slot/subslot numarası evet,
ağaç hayır —, Diagnostics — DataStatus/TransferStatus/BlockError/alarm tanı bitleri evet,
tanı kaydı kataloğu hayır), **2'si karşılanmadı** (Timing/Jitter çok çerçeve ister;
GSDML Explorer bilinçli kapsam dışı). Bu, `ethercat`in (`ready`) kendi tablosuyla AYNI
sınıfta: onun 10 aracından "Slave States", "Distributed Clocks", "PDO" ve "Mailbox"
dosya başında AÇIKÇA motorun dışında bırakılmış. `ready` ölçütü `ethercat.ts`in kendi
gerekçesinde yazılı: ham kalan bölge YAPISAL bir eksik değil TANIM-BAĞIMLI içerikse ve
protokolün KENDİ tanımladığı atlanmış bir doğrulama yoksa `ready`dir (MAVLink `partial`
çünkü CRC_EXTRA doğrulaması dialect olmadan YAPILAMIYOR). PROFINET ikinci gruba düşer:
çözülen her sınıfın HER başlık alanı adlandırıldı, PROFINET'in kendi tanımladığı bir
çerçeve checksum'ı YOKTUR (o iş Ethernet FCS'inindir), dolayısıyla atlanan doğrulama da
yoktur.

**Encoder YAZILMADI** (`modbus-tcp`/`opc-ua`/`ethernet-ip` emsali), `protocol-core/
types.ts`e DOKUNULMADI, `live`/`tools`/`definitions` alanlarına DOKUNULMADI.

39 birim testi (`profinet.test.ts`) + 14 e2e (gerçek tarayıcı, `profinet-decode.spec.ts`
— DCP pad hizalamasını ve APDU-Status geri saymasını OFSET SÜTUNUNDAN doğrulayan ayrı
testler, `decode-parse-error` (`success:false`) yolu ve 1440/390 px taşma turu dahil) +
4490 toplam test + typecheck/build yeşil; `ethercat`, `goose` ve `ethernet-ii`nin mevcut
testleri (paylaşılan `ethernetFrame.ts` dokunuldu) DOKUNULMADAN yeşil kaldı. Değişen/yeni
dosyalar: `protocols/industrial/profinet/profinetFrameId.ts` (yeni),
`profinetDcp.ts` (yeni), `profinetAlarm.ts` (yeni), `profinet.ts` (yeni) +
`profinet.test.ts` (yeni), `protocols/network/ethernet/ethernetFrame.ts`
(`ETHER_TYPE_NAMES`e 0x8892), `protocols/index.ts` (kayıt) + `index.test.ts` (kayıt
sayacı, alfabetik sıra + kategori haritası), `app/catalog/domains/industrial-automation.ts`
(`status: 'ready'` + `pluginId`), `translations/{tr,en}.ts` (66'şar anahtar),
`e2e/profinet-decode.spec.ts` (yeni), `CLAUDE.md` (borç sayımı KODDAN doğrulandı:
42→41 kanonik, industrial-automation 10→9). Sıradaki: **13f (powerlink, sercos-iii)**.

**13f (2026-08-23 bitti) — powerlink, sercos-iii.** `industrial-ethernet`in kalan üç
kaydından ikisi bitti; `cc-link-ie` BİLEREK YAZILMADI (gerekçe aşağıda), aile bu yüzden
HENÜZ KAPANMADI. Girdi modeli aynı: `ethercat.ts`/`profinet.ts` gibi TAM bir Ethernet
çerçevesi alınır ve `ethernetFrame.ts`in `formatMac`/`classifyDestinationMac`/
`walkTypeLengthChain`i PAYLAŞILIR; ikinci bir MAC biçimleyici ya da VLAN yürüyüşü
YAZILMADI. `ETHER_TYPE_NAMES`e 0x88AB (POWERLINK) ve 0x88CD (Sercos III) eklendi.

**POWERLINK'in CANopen paylaşım iddiası SINANDI ve BİT DÜZEYİNDE ÇÜRÜDÜ.** Spec özeti
(`docs/spec/ozet/03-endustriyel.md:107-111`) "CANopen benzeri model … ortak OD engine
paylaşılabilir" diyordu; brief bunu 13f'nin açık sorusu sayıyordu. Üç bağımsız kanıt
tersini gösterdi: (1) **NMT durum baytları KESİŞMİYOR** — `canopen.ts`in
`NMT_STATE_LABELS`i {0x00 Boot-up, 0x04 Stopped, 0x05 Operational, 0x7F
Pre-operational}, POWERLINK'inki {0x00, 0x19, 0x29, 0x39, 0x1C, 0x1D, 0x1E, 0x4D, 0x5D,
0x6D, 0xFD}; ortak görünen 0x00'ın ANLAMI FARKLI (CANopen "Boot-up", POWERLINK
"NMT_GS_OFF"). (2) **SDO çerçeveleri farklı** — CANopen'ın SDO'su tek baytlık command
specifier + Index(2) + SubIndex(1) + 4 bayt veri = CAN çerçevesinin TAMAMI (8 bayt);
POWERLINK'inki Sequence Layer (4 bayt) + Command Layer (8 baytlık sabit başlık) + gövde,
iki ayrı katman. (3) **PDO boyut sınırı GERÇEKTEN FARKLI** — CANopen'da PDO uzunluğu CAN
başlığının DLC'sidir, ≤ 8 bayt, ayrı bir uzunluk alanı YOKTUR; POWERLINK'in PReq/PRes'inde
uzunluk 16-bit, little-endian, ÇERÇEVEDE YAZAN bir `Size` alanıdır (ofset 22, tavan 1499
bayt) — birim testinde ve e2e turunda 200 baytlık `pres-large-pdo` örneğiyle kanıtlandı.
**`canopen.ts`e HİÇ DOKUNULMADI**; iç fonksiyonları private kaldı, mevcut testleri
değişmedi. Ortak olan tek şey (OD adresleme: 16-bit Index + 8-bit Sub-index) iki satırlık
bir okuma olduğu için modül açmaya değmedi (dalga 12'nin "spekülatif ortak modül açma"
dersi).

**POWERLINK kaynak durumu.** EPSG DS 301'in resmi metni depoda YOK. İki bağımsız kamuya
açık kaynaktan çapraz teyit: **Wireshark EPL dissector'ı** (`packet-epl.c`,
GPL-2.0-or-later) ve **openPOWERLINK V2** (B&R/Kalycito referans yığını, yalnız
dokümante sabitler alındı, KOD KOPYALANMADI); üçüncü bağımsız teyit IEEE EtherType kayıt
defterinin 0x88AB'yi "B&R Industrial Automation GmbH — ETHERNET Powerlink" olarak
listelemesi. **Tuzak — IdentResponse'un IP alanları İKİ KAYNAKTA BAYT SIRASINDA
ÇAKIŞIYOR**: Wireshark `ntohl()` ile big-endian okur, openPOWERLINK `ami_setUint32Le()`
ile little-endian yazar; yanlış yönde okunmuş bir IP ham baytlardan çok daha kötü olacağı
için üç alan (IPAddress/SubnetMask/DefaultGateway) ÇEVRİLMEDEN ham basılır ve
`WARN_IP_FIELD_BYTE_ORDER_CONFLICT` taşır. **Tuzak — MessageType baytının 7. biti**:
Wireshark maskeler (`& 0x7F`), openPOWERLINK MessageType'ı tam bayt sayar; bit set
olduğunda maskelenmiş değerle dispatch edilir ve `WARN_MESSAGE_TYPE_HIGH_BIT_SET`
basılır — birim testinde SoC örneğinin baytı bilerek bozulup dispatch'in yine SoC gövdesine
düştüğü doğrulandı.

**POWERLINK `ready` kararı.** Ham kalan tek bölgeler PDO yükü ve NMT/SDO komut verisidir;
ikisi de YAPISAL bir eksik değil TANIM-BAĞIMLI içeriktir (XDD/PDO eşlemesi ya da komut
başına değişen yapı gerektirir) — `ethercat.ts`in datagram verisiyle aynı sınıf. Buna
karşılık MessageType dispatch'i, iki node adresi, her mesaj tipinin bayrak bitleri,
NetTime/RelativeTime, PDOVersion, 16-bit Size, NMT durum baytı, ASnd'in altı servisi
(IdentResponse/StatusResponse/NMTRequest/NMTCommand/SDO/SyncResponse) ve SDO'nun iki
katmanı + abort kodu tam çözülür. POWERLINK'in KENDİ tanımladığı bir çerçeve checksum'ı
YOKTUR (Ethernet FCS'e bırakılır) — MAVLink'in `partial` gerekçesi burada GEÇERSİZ.
`decodeOptions` üç gerekçeyle AÇILMADI: PDO boyu ve MN/CN ayrımı zaten çerçeveden
çıkarılabiliyor (dalga 12f'nin WebSocket MASK-biti dersi), PDO eşlemesi bir `select`/
`number` alanına sığmıyor (`profinet.ts`in GSDML gerekçesinin aynısı).

**Sercos III kaynak durumu.** Sercos International'ın spec metni depoda YOK. İki bağımsız
kaynaktan çapraz teyit: **Wireshark Sercos III dissector'ı** (`packet-sercosiii.c`,
telif satırı "Bosch Rexroth/Hilscher" — protokolü tanımlayan firmaların dissector'ı,
EtherCAT'teki Beckhoff imzalı dissector'la aynı emsal) ve **Sercos Soft Master Core
Library** (SICE+CoSeMa, MIT, `aschiffler/linuxcnc-sercos3` — bir DISSECTOR değil bir
UYGULAMA, çerçeveyi KURAN taraf); üçüncü teyit IEEE EtherType kayıt defterinin 0x88CD'yi
"sercos international e.V." olarak listelemesi. 6 baytlık başlık iki kaynakta BİREBİR
(Wireshark `dissect_siii_mst()`ün 0-5 aralığı; Sercos Soft Master'ın
`SICE_SERC3_TEL_HEADER 20` = 14 Ethernet + 6 Sercos).

**Tuzak — telgraf numarasının BİT GENİŞLİĞİ konusunda kaynaklar ANLAŞMIYOR.** Wireshark
`type & 0x0F` ile 4 bit okur ama KENDİ YORUMUYLA "even though it's reserved (the V1.1
spec states that it is reserved for additional MDT/AT)" der; Sercos Soft Master
`SICE_TEL_NO_MASK (0x03)` ile yalnız 2 bit okur. Kaynaklar bit 0-1'de ANLAŞIYOR, bit
2-3'te ANLAŞMIYOR — numara yalnız bit 0-1'den okunur, bit 2-3 AYRI bir alan olarak basılır
ve `WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT` taşır; birim testi ve e2e turu bu ayrımı
`telegram-number-extended-bits` örneğiyle ofset ve değer üzerinden kilitler.

**CRC32 GÖSTERİLİR, ASLA DOĞRULANMAZ.** Başlıktaki 4 baytlık CRC32'nin üretici polinomu
(Sercos Soft Master `SICE_PRIV.h`: `0xEDB88320`) ve CRC'ye giren 16 baytlık bölge
(`SICE_TEL_LENGTH_HDR_FOR_CRC 0x10` = 14 Ethernet + 2 Sercos) TEK KAYNAKLI teyitli, ama
başlangıç değeri ve son XOR ikinci bir kaynakta YOK; Wireshark CRC32'yi yalnız GÖSTERİR,
hesaplamaz. `ethercat.ts`in Working Counter kararının aynısı: yanlış parametreyle
hesaplanmış bir "CRC hatalı" rozeti, hiç doğrulamamaktan çok daha kötüdür. Birim testi ve
e2e turu bunu İKİ FARKLI (gerçek olmayan) CRC değeri taşıyan iki örnek çerçeveyle
kanıtlıyor — ikisi de sıfır hatayla, doğrulanmadan kabul ediliyor.

**CP3/CP4 servis kanalı ofsetleri ÇERÇEVEDE YAZMAZ, tek kaynaklı değil PROTOKOLÜN
DOĞASI gereği bilinmez.** Operasyonel fazlarda servis kanalı, cihaz durumu ve bağlantı
ofsetleri CP2 sırasında pazarlanan konfigürasyondan gelir; referans dissector da AYNI
YERDE durur — Wireshark'ın `dissect_siii_{mdt,at}_cp3_4()`sinin kendi yorumu: *"offsets
of service channel, device status and connections are unknown / this data could be
extracted from svc communication during CP2"*. Yalnız telgraf 0'daki 8 baytlık Hot-Plug
alanı (Sercos adresi + kontrol/durum kelimesi + bilgi) çözülür; gerisi TEK PARÇA ham
basılır ve `WARN_CP34_LAYOUT_FROM_CP2` ile nedeni söylenir — birim testi ve e2e turu
Hot-Plug alanının ofsetlerini (20/22/24) ve ardından gelen ham bloğu ayrı ayrı kilitler.
CP1/CP2'nin 128 cihazlık servis kanalı (6 B/cihaz) ve cihaz kontrol/durum bölgesi (4
B/cihaz) YAPISI sabit olduğu için çözülür, ama ayrıntı 16 cihazla SINIRLI (`ethercat.ts`in
"analyzer sınırı" emsali); tam doldurulmamış bir cihaz listesi `WARN_DEVICE_LIST_TRUNCATED`
GERÇEKTEN bastığı birim testiyle kanıtlandı. CP0'ın MDT tarafı (Communication Version, bit
adları tek kaynaklı → hex ham) ve AT tarafı (511 girdilik sabit tanınan-cihaz listesi → tek
parça ham) da çözülür.

**Sercos III `ready` kararı.** Ham kalan tek bölge CP3/CP4'ün konfigürasyona bağlı
gövdesidir; bu YAPISAL bir eksik değil TANIM-BAĞIMLI içeriktir — `ethercat.ts`in datagram
verisiyle aynı sınıf. Protokolün kendi tanımladığı doğrulama (CRC32) ATLANMIYOR; kaynak
yetersizliği yüzünden BİLİNÇLİ OLARAK hesaplanmıyor ve bu kullanıcıya uyarıyla söyleniyor —
MAVLink'in `partial` gerekçesinden (doğrulama dialect olmadan YAPILAMIYOR) farklı: burada
doğrulama YAPILABİLİR ama YANLIŞ parametreyle yapmak susmaktan kötü olurdu.

**`cc-link-ie` BİLEREK YAZILMADI.** Gerekçe: CLPA'nın spec paketi üyelik/ücret arkasında;
spec özeti bunu AÇIKÇA söylüyor — `docs/spec/ozet/03-endustriyel.md:93` "Exact telgraf
alanları CLPA spec paketinden (tahmin edilmez)" (CC-Link için yazılmış ama CLPA aynı
kısıtı CC-Link IE'ye de uygular) ve aynı dosyanın 262. satırındaki genel uyarı CC-Link'i
"exact bit/byte alanları resmi spec revizyonundan alınmalı, tahmin edilmemeli" listesine
açıkça dahil ediyor. Katalogdaki `cc-link-ie` kaydı `status: 'planned'` bırakıldı,
DOKUNULMADI. **Sonuç: `industrial-ethernet` ailesi (6 kayıt) HENÜZ KAPANMADI** — profinet/
ethercat/ethernet-ip/sercos-iii/powerlink `ready`, yalnız `cc-link-ie` `planned` kaldı.

**Encoder YAZILMADI**, `protocol-core/types.ts`e DOKUNULMADI, `live`/`tools`/
`definitions`/`related` alanlarına DOKUNULMADI.

76 yeni birim testi (`powerlink.test.ts` 50 + `sercosIii.test.ts` 26) + 25 yeni e2e
(gerçek tarayıcı — `powerlink-decode.spec.ts` 13 + `sercos-iii-decode.spec.ts` 12; CANopen
paylaşımının ÇÜRÜDÜĞÜNÜ 200 baytlık PDO örneğiyle, CRC32'nin ASLA doğrulanmadığını iki
farklı CRC değeriyle, telgraf numarası bit çakışmasını ofset+değerle kanıtlayan turlar
dahil) + 4566 toplam birim test + 888 toplam e2e + typecheck/build yeşil; `ethercat`,
`profinet` ve `canopen`in mevcut testleri (paylaşılan `ethernetFrame.ts` dokunuldu, `canopen.ts`
DOKUNULMADI) DEĞİŞMEDEN yeşil kaldı. Değişen/yeni dosyalar: `translations/{tr,en}.ts`
(70 POWERLINK + 46 Sercos III = 116'şar anahtar), `e2e/powerlink-decode.spec.ts` (yeni),
`e2e/sercos-iii-decode.spec.ts` (yeni), `protocols/industrial/powerlink/powerlink.test.ts`
(yeni), `protocols/industrial/sercosiii/sercosIii.test.ts` (yeni), `CLAUDE.md` (borç
sayımı KODDAN doğrulandı: 41→39 kanonik, industrial-automation 9→7). Sıradaki:
**`cc-link-ie`** (CLPA spec erişimi sağlanınca) ya da **13g (classic-fieldbus:
profibus-dp/cc-link/as-interface/foundation-fieldbus)** — ikisi de aynı ticari konsorsiyum
spec-bulunabilirlik riskini taşıyor.

**13g (2026-08-23 bitti) — profibus-dp, cc-link, as-interface, foundation-fieldbus +
cc-link-ie.** Beş kayıt; **İKİ AİLE BİRDEN KAPANDI**: `classic-fieldbus` (4 kayıt) ve
`industrial-ethernet` (6 kayıt, 13f'de bilerek atlanan `cc-link-ie` bu dalgada yazıldı).
`industrial-automation` domain'inde artık yalnız **io-link** ve **hart** açık (13h).

Bu alt dalganın kuralı kullanıcı kararıydı: **kaynağı olmayan kayıt `planned` bırakılmaz,
`partial` yazılır** — iki bağımsız kamuya açık kaynakta teyitli olan ÇÖZÜLÜR, gerisi HAM
bırakılır ve neyin çözülüp neyin çözülmediği katalog özetinde AÇIKÇA yazılır
(`iec-61850`in GOOSE-only presedanı). Beş kaydın beşinde de karar ayrı ayrı verildi:

**profibus-dp — `ready`, ÜÇ bağımsız kaynak.** PI'nin FDL spec metni ücretli ve
Wireshark'ta PROFIBUS dissector'ı YOK (1826 dissector tarandı), ama İKİ BAĞIMSIZ AÇIK
KAYNAK YIĞIN var: **pyprofibus** (GPL-2.0, `pyprofibus/fdl.py`) ve **profirust**
(Apache-2.0, `src/fdl/telegram.rs`) — sınırlayıcılarda, FC bit maskelerinde, FCS
kapsamında ve SAP tablosunda BİREBİR aynılar; üçüncü teyit felser.ch'in kamuya açık
"PROFIBUS Manual — Telegram formats" sayfası. Beş telgraf sınıfı da (SC 0xE5 / SD1 0x10 /
SD2 0x68 / SD3 0xA2 / SD4 0xDC) tam çözülür: LE + LEr + tekrarlanan SD2, DA/SA'nın bit
7'sindeki adres uzantısı bayrağı, DAE/SAE zincirinden DSAP/SSAP ve segment adresi
(Set_Prm 61, Chk_Cfg 62, Slave_Diag 60, Global_Control 58, Rd_Inp 56, Rd_Outp 57,
Set_Slave_Add 55, MS1/MS2 …), FC'nin istek (FCB/FCV + SDA/SDN/SRD/FDL-status/ident/LSAP)
ve yanıt (istasyon tipi + OK/UE/RR/RS/DL/NR/DH/RDL/RDH) kırılımları, FCS ve ED.
Ham kalan tek bölge DU'dur ve bu YAPISAL bir eksik değil TANIM-BAĞIMLI içeriktir (GSD'siz
kırılamaz) — `ethercat.ts`in datagram verisiyle aynı sınıf, `ready` ölçütünü bozmaz.

**FT1.2 akrabalığı SINANDI — sonuç BÖLÜNMÜŞ.** Brief `iec101.ts` (13b) ile paylaşımı
sınamamı istemişti. ✔ **`sum8Checksum` PAYLAŞILDI**: PROFIBUS FCS'i FT1.2 checksum'ıyla
BİREBİR aynı hesap (kapsanan baytların 256 modunda toplamı); ikinci bir toplam fonksiyonu
yazılmadı, `simpleChecksums.ts`e DOKUNULMADI. ✘ **Çerçeveleme PAYLAŞILMADI** ve gerekçe
bit düzeyinde yazıldı: (1) FT1.2 sabit çerçevesi `10 C A CS 16` iken PROFIBUS SD1
`10 DA SA FC CS 16` — aynı 0x10 baytı, farklı alan sırası ve İKİ adres; (2) FT1.2'de adres
genişliği yapılandırılabilir (0/1/2 bayt), PROFIBUS'ta hep tek bayt ve bit 7 uzantı
bayrağı — FT1.2'de böyle bir bayrak yok; (3) SD3 ve SD4 FT1.2'de HİÇ YOK; (4) FT1.2'nin
L'si Control+Address+ASDU'yu sayar, PROFIBUS'un LE'si DA+SA+FC+DU'yu sayar ve 3-249 ile
sınırlıdır. `iec101.ts`e DOKUNULMADI. Dalga 12'nin iki yönlü dersi burada da geçerli:
gerçekten aynı olan paylaşıldı, akraba görünen ayrı yazıldı.

**cc-link-ie — `partial`, İKİ bağımsız kaynak, EtherType 0x890F.** 13f'de "CLPA spec'i
üyelik arkasında" diye atlanmıştı; bu dalgada İKİ kamuya açık kaynak bulundu: **CLPA'nın
KENDİ yayımladığı Wireshark Lua dissector'ı** (`CCLinkIE_TSN_Rev03.lua`, telif satırı
birebir "Copyright(C) CC-Link Partner Association") ve **NTT Communications'ın Zeek/Spicy
ayrıştırıcısı** (`zeek-parser-CCLinkIENoIP`, BSD-2-Clause). İkisi TestData/TestDataAck
tipinde AYNI ofsetleri veriyor; EtherType IEEE kayıt defterinde "Mitsubishi Electric
Nagoya Works" olarak listeli ve NTT'nin 860 çerçevelik yakalamalarının HEPSİ 0x890F.
Çözülen: 14 baytlık Field/Control başlığı (frameType, dataType/priority, tipe özel dört
bayt, srcNodeNumber, `protocolVerType`in AĞ TİPİNİ SÖYLEYEN iki nibble'ı, HEC) ve TSN'in
tipe göre 2/6/10/14 baytlık başlıkları (cyclicNo + kontrol bayrağı, sa/da, HEC) + 0xC3
acyclicData içindeki SLMP 3E zarfı. **HEC GÖSTERİLİR, DOĞRULANMAZ** (algoritma hiçbir
kaynakta yok — `sercosIii.ts`in CRC32 kararının aynısı); döngüsel gövde ağ parametresine
bağlı olduğu için HAM. **`partial` gerekçesi**: kayıt DÖRT ağ tipi vaat ediyor,
**Field Basic BU TELDE GELMEZ** (IPv4/UDP üstünde SLMP, master 61450 / cihaz 61451) ve
bilinçli kapsam dışı; IPv4 çerçevesi verilirse bunu uyarıyla SÖYLÜYOR. Ortadaki dört
baytın tipe özel kırılımı TEK kaynaklı olduğu için `WARN_MIDDLE_FIELDS_SINGLE_SOURCE`
taşır, iki kaynağın kesiştiği TestData'da BASILMAZ (`sercosIii.ts`in
`WARN_CYCLE_COUNT_SINGLE_SOURCE` emsali). `ETHER_TYPE_NAMES`e 0x890F eklendi;
`ethernetFrame.ts`in `formatMac`/`walkTypeLengthChain`i yine PAYLAŞILDI.

**cc-link (klasik) — `partial`, TELGRAF ÇÖZÜLMEDİ, gerekçesi belgelendi.** İlk adım
"yeterli kaynak var mı" sorgusuydu ve cevap HAYIR: Wireshark'ta dissector yok, CLPA veri
bağı spec'i üyelik arkasında, kamuya açık kaynaklar "HDLC tabanlı" düzeyinde kalıyor.
Bulunan tek "CC-Link çerçevesi" iddiası (`erikwang2013/industrial-protocols-cclink`, PHP)
UYDURMA çıktı — `StationNo(1)+Flags(1)+Len(1)+Data+CRC-16/XMODEM` diye bir yapı hiçbir
CLPA belgesinde yok, "Flags" baytı tamamen icat; KULLANILMADI ve dosya başında REDDEDİLDİ.
Bunun yerine protokolün kullanıcıya görünen yüzü çözüldü: **tek bir slave istasyonun
döngüsel LINK CİHAZI GÖRÜNTÜSÜ** (RX/RY bit alanı + RWr/RWw yazmaç alanı). 4×4'lük link
nokta tablosu İKİ BAĞIMSIZ BELGEDE teyitli — **Pro-face (Schneider) GP-Pro EX CC-Link
Intelligent Device Driver** kılavuzunun bağlanabilir birim formülleri tablonun TAMAMINI
veriyor (1 istasyon ×1 = 32 bit/4 yazmaç … 4 istasyon ×8 = 896 bit/128 yazmaç) ve
**Mitsubishi EMU4-VA2 CC-Link programlama kılavuzu** bir satırı doğrudan doğruluyor
(1 istasyon, octuple → RX/RY 128, RWw/RWr 32). Bu tablo birim testinde 16 satırın hepsiyle
kilitlendi. **`decodeOptions` AÇILDI, üç kanal** — yön (RX/RWr mi RY/RWw mi), işgal edilen
istasyon sayısı (1-4) ve genişletilmiş çevrim ayarı (×1/×2/×4/×8): üçü de ağ
parametresinde ayarlanır ve baytların İÇİNDE YOKTUR, yani 12f'nin "kanal yalnız gerçekten
çıkarılamayan parametre için" kuralına birebir uyar. Her çözümde
`WARN_LINK_LAYER_NOT_PUBLIC` basılır: kullanıcı TELGRAFI GÖRMEDİĞİNİ bilir.

**as-interface — `partial`, İKİ bağımsız kaynak, PARİTE GERÇEKTEN DOĞRULANIR.** Kaynak:
**ASI4U/ASI4U-E/ASI4U-F datasheet**'inin Table 3.2 "Master Calls and Related Slave
Responses"ı — AS-International Association'ın KENDİ sitesinde (`as-interface.net`)
yayımlanıyor ve "fully compliant with the AS-Interface Complete Specification V3.0" diyor —
ve bağımsız bir üreticinin kılavuzu (**Sense Eletrônica**, §5 "Estrutura do Telegrama"),
çerçeveyi BİREBİR aynı sırayla veriyor: master `ST SB A4..A0 I4..I0 PB EB` (14 bit), slave
`ST I3..I0 PB EB` (7 bit); üçüncü teyit Pepperl+Fuchs'un "The AS-interface" kitapçığı.
**`sercosIii.ts`/`ccLinkIe.ts`ten FARK: burada doğrulama GERÇEKTEN YAPILIR**, çünkü kural
harfi harfine belgeli — *"the sum of all information bits … (excluding start and end bits,
including the parity bit) must be even"*. Çift parite hesaplanır ve uyuşmazlıkta ÇERÇEVE
HATASI basılır; birim testi bunu 32 adres × 32 bilgi alanı × 2 kontrol biti = 2048
telgrafın hepsinde kilitliyor. Bilgi alanı çağrı tipine göre kırılır (SB=0∧I4=0 veri,
SB=0∧I4=1 parametre, adres 0∧SB=0 yeni adres, SB=1 komut: Rd_IO_Cfg/Read_ID/Read_ID_1/
Read_ID_2/Reset/Read_Status/Delete_Addr/Write_Ext_ID_1/Broadcast/EnterPmode).
**Tuzak — seçim bitinin POLARİTESİ tek belgenin İÇİNDE çelişiyor**: Table 3.2 I3 hücresini
`~Sel`, hemen ardındaki şemanın satır başlığı `I3=Sel` diyor. Bit ADLANDIRILIR ama
"A-slave mı B-slave mı" İDDİA EDİLMEZ; `WARN_SELECT_BIT_POLARITY_UNCONFIRMED` taşır ve
e2e turu physicalValue'da "A-slave"/"B-slave" geçmediğini doğruluyor (`sercosIii.ts`in
telgraf numarası çakışmasının aynı deseni). **`partial` gerekçesi**: kayıt İKİ NESİL vaat
ediyor (özet + araç listesindeki ayrı "ASi-5" maddesi); **ASi-5 OFDM tabanlı, tamamen
farklı bir katman** ve tel biçimi kamuya açık değil — her çözümde `WARN_CLASSIC_ASI_ONLY`
basılır ki iki nesil KARIŞMASIN (brief'in açık talebi).

**foundation-fieldbus — `partial`, TEK kaynaklı ve bu SAKLANMIYOR.** Çözülen katman
**HSE**: Wireshark'ın FF-HSE dissector'ı (`packet-ff.c`, GPL-2.0-or-later, telif satırı
Yokogawa mühendisi, kaynak olarak **FF-588-1.3 §6 "Field Device Access Agent Interface"**
gösteriliyor) 12 baytlık FDA mesaj başlığını veriyor: sürüm, seçenek bayrakları
(mesaj numarası/invoke id/zaman damgası/genişletilmiş kontrol + dolgu uzunluğu), protokol
kimliği (FDA/SM/FMS/LAN Redundancy), mesaj tipi, servis (onaylı bayrağı + protokole göre
adlandırılan servis kimliği), FDA adresi ve mesaj uzunluğu; ardından seçenek
bayraklarından çıkan trailer mesajın SONUNDAN çözülür. **İkinci bağımsız kaynak
BULUNAMADI ve her çözümde `WARN_LAYOUT_SINGLE_SOURCE` basılır.** İki aday REDDEDİLDİ:
`carbon-evolution/ot-nmap-blue-team`in FF-HSE NSE script'i + mock sunucusu ("Byte 0
protocol version, Byte 1 service code, little-endian") Wireshark'ın 12 baytlık big-endian
başlığıyla ÇELİŞİYOR ve hiçbir spec'e dayanmıyor; `erikwang2013`in FF paketi ise aynı
yazarın CC-Link paketindeki uydurma gerekçesiyle hiç incelenmedi. KISMİ bağımsız teyit:
IANA kayıt defteri `ff-annunc 1089` / `ff-fms 1090` / `ff-sm 1091` / `ff-lr-port 3622`
girdilerini Fieldbus Foundation'a atanmış olarak listeliyor — dört alt protokolü doğruluyor,
bayt ofsetlerini değil. **H1 KAPSAM DIŞI ve gerekçesi teknik**: veri bağı çerçevesi ücretli
standartta (IEC 61158-2 / FF-816) ve başlangıç/bitiş sınırlayıcıları Manchester kuralını
bilerek ihlal eden **N+/N− veri-olmayan sembolleridir — BAYT OLARAK TEMSİL EDİLEMEZLER**,
yani bu panelin bayt girdisiyle kaynak bulunsa bile çözülemez. Girdi sözleşmesi de bu
dalgada bir istisna: FF-HSE ham Ethernet DEĞİL normal bir TCP/UDP uygulamasıdır (kendi
EtherType'ı yoktur), bu yüzden girdi Ethernet çerçevesi değil TCP/UDP YÜKÜdür
(`opcua.ts`in girdi sözleşmesiyle aynı sınıf).

**Encoder YAZILMADI**, `protocol-core/types.ts`e DOKUNULMADI, `tabs`/`tools`/
`definitions`/`related` alanlarına DOKUNULMADI; `summary` yalnız dürüstlük gereği (neyin
çözülüp neyin çözülmediği) genişletildi. Paylaşılan dosyalardan yalnız
`network/ethernet/ethernetFrame.ts` değişti (`ETHER_TYPE_NAMES`e 0x890F) —
`simpleChecksums.ts`, `canopen.ts` ve `iec101.ts` DEĞİŞMEDEN kaldı ve mevcut testleri
yeşil geçti.

112 yeni birim testi (`profibusDp.test.ts` 25 + `asInterface.test.ts` 24 +
`ccLinkIe.test.ts` 25 + `ccLink.test.ts` 19 + `foundationFieldbus.test.ts` 19) + 57 yeni
e2e (gerçek tarayıcı: `profibus-dp` 11 + `cc-link-ie` 13 + `cc-link` 11 + `as-interface`
11 + `foundation-fieldbus` 11; `partial` rozetli dört kaydın hepsinde rozetin
`resolveStatus()`ten geldiği ve **Kısmi** bastığı ayrıca doğrulandı — dalga 11 kuralı) +
4678 toplam birim test + 945 toplam e2e + typecheck/build yeşil. Değişen/yeni dosyalar:
`protocols/industrial/profibus/profibusDp.ts` (+test, yeni),
`protocols/industrial/cclinkie/ccLinkIe.ts` (+test, yeni),
`protocols/industrial/cclink/ccLink.ts` (+test, yeni),
`protocols/industrial/asinterface/asInterface.ts` (+test, yeni),
`protocols/industrial/foundationfieldbus/foundationFieldbus.ts` (+test, yeni),
`protocols/network/ethernet/ethernetFrame.ts` (0x890F), `protocols/index.ts` (5 kayıt) +
`index.test.ts` (sayaç/alfabetik sıra/kategori haritası),
`app/catalog/domains/industrial-automation.ts` (5 kayıt: 1 `ready` + 4 `partial` +
`pluginId` + dürüst `summary`), `translations/{tr,en}.ts` (5×~45 = 224'er anahtar),
`e2e/{profibus-dp,cc-link-ie,cc-link,as-interface,foundation-fieldbus}-decode.spec.ts`
(yeni), `CLAUDE.md` (borç sayımı KODDAN doğrulandı: 39→34 kanonik, industrial-automation
7→2). Sıradaki: **13h (io-link, hart)** — bitince `industrial-automation` domain'i
TAMAMEN KAPANIR.

Platform deposunda **Faz 0–4'ün hepsi bitti** (son commit 2026-08-10). Comm feature
modülü, `comm` şeması, CORS ve edge yönlendirme yerinde; o depoda planlanmış başka faz
yok. Comm SPA'sı `/api` olmadan da çalışıyor, yalnız kimlik uçları 404 dönüyor.

Faz 3 öncesi açık işler — **hepsi kapandı**:
- ~~PCB PR #18 merge kararı~~ → **birleşti** 2026-08-10
- ~~`alp-platform` `design/` çalışması commit edilip PR'a dönmedi~~ → **birleşti**, PR #1 (`9904d3f`)
- ~~`alp-comm-toolkit` deposu yerelde; GitHub'a itilmedi~~ → **kapandı**, `origin/main` izliyor

Süitte bağlanmamış iki ürün var — `alp-aerospace` ve `alp-systemlab`. İkisi de tarayıcıda
kendi başına çalışıyor; platformda feature klasörleri, DB şemaları ve nginx yolları YOK.
Bu bir faz olarak planlanmadı.

## Faz 7 sonrası açık kalan boşluklar

Faz 9'a girmeden bilinmesi gerekenler — hiçbiri Faz 9'u engellemiyor:

- `src/features/` altında **log-analyzer · protocol-converter · reverse-engineering ·
  test-automation** klasörleri hiç açılmadı (spec §33/§34/§35/§38).
- `src/connection/` altında **usb · bluetooth · websocket · file** yok. `file` olmadan
  log dosyası içe aktarma yapılamaz, yani §48'in "büyük log dosyası" kriteri
  ölçülemiyor bile.
- `src/protocols/` klasörünün kendisi yok — Faz 9 onu açacak.
- `src/components/` altında **packet-viewer · signal-viewer · protocol-tree** yok.

## Faz 2'den çıkan kararlar ve borçlar

- **Comm portu 3001** — PCB 3000'i tuttuğu için ikisi aynı anda koşabilsin diye.
- **Token bağı `file:../alp-platform/design`** — paket yayınlanmadı, iki depo kardeş dizin
  olmak zorunda; CI iki checkout yapıyor. Faz 4'te yayınlanınca ikisi de sadeleşir.
- **TypeScript 7 `baseUrl`'ü kaldırdı** — `paths` göreli yazılıyor (`./src/*`).
- **Arayüz her zaman Türkçe açılır**, tarayıcı dili pazarlık edilmiyor (spec §4). Karar
  `LanguageProvider.detectInitialLanguage` içinde yorumla gerekçelendirildi.
- **Katalog metinleri İngilizce** — protokol/aile/alan adları teknik veri sayıldı. Alan ve
  protokol `summary` cümleleri de İngilizce kaldı; Türkçe karşılıkları Faz 3+ işi.
- **Playwright duman testi zorunlu katman** — jsdom CSS'i değerlendirmediği için birim
  testler boş sayfayı da yeşil gösterir. `reuseExistingServer: false`: 4173 gibi yaygın bir
  portta başka uygulama dinliyorsa Playwright sessizce onu test eder (bir kez yaşandı).
