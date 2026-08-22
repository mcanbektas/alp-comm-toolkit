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
`docs/brief-faz10-dalga12.md`de). Sıradaki domain seçimi henüz YAPILMADI —
altı domain arasından (industrial-automation 16 · automotive 12 ·
aerospace-uav 12 · wireless-iot 4 · marine-navigation 3 ·
building-automation 1) bir keşif turuyla karara bağlanacak.

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
Sıradaki: yeni bir domain seçimi (keşif turu gerekiyor, `docs/brief-faz10-
dalga12.md`nin dalga başı yaptığı gibi).

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
