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
| **10+** ✅ | **TAMAM (2026-08-27, dalga 18 KAPANDI).** `wireless-iot` de bitti — `interfaces-framing`, `network-ethernet`, `industrial-automation`, `automotive`, `aerospace-uav`, `marine-navigation` ve `building-automation`dan sonra **SEKİZİNCİ ve SON kapanan domain**. **Kalan kanonik iş: SIFIR.** Katalogdaki 172 kaydın tamamı ya motorlu ya alias (KODDAN doğrulandı: çözülmüş **140 `ready` / 0 `planned` / 32 `partial`**; ham 125/15/32, ham `planned`ın tamamı alias). Bir sonraki iş sınıfı katalog DIŞIDIR ve seçim kullanıcınındır | **Sonnet · medium-high** (dalga başına) | Kurulu desene protokol ekleme; zor decoder'larda (EtherCAT, GOOSE, Matter TLV) gerekirse Opus'a çık |
| **P** | **PCB redesign retrofit** — paralel iz, ekran ekran token'lara geçiş | **Sonnet · medium** | Mekanik dönüşüm, tema→token eşlemesi Faz 1'de tanımlanmış olacak |

## Model geçiş kuralları

- Faz başında bu tabloya göre `/model` + `/effort` çek; faz bitince sıradakini söylerim
- Sonnet fazında beklenmedik mimari karar çıkarsa: dur, Opus'a çek, kararı ver, geri dön
- Fable: hiçbir fazda gerekmiyor (ayrı kota + 2x maliyet; muhakeme tavanı isteyen iş yok)

## Sıradaki adım

## ✅ Plugin encoder tüketicisi YAZILDI (2026-08-29)

`ProtocolPlugin.encoder` artık ölü alan değil. Üç tüketici: Packet Builder'ın
çerçeveleme aşaması (`payload` ailesi, 8 yeni zarf), Packet Builder'ın ikinci
üretim kaynağı (`values` ailesi, 4 kayıt) ve Test Automation `send-frame`in
üçüncü kaynağı (`plugin-frame`). Rol defteri `src/protocols/encoderCatalog.ts`,
iki yönlü testiyle birlikte.

**Üç karar, gerekçeleriyle CLAUDE.md "Bilinen borçlar" 3. maddesinde:**
(1) iki aile tek arayüzde BİRLEŞTİRİLMEDİ — boru hattının farklı aşamalarına
düşüyorlar; (2) tüketici İKİ ekranda; (3) `protocol-core/types.ts`in
`ProtocolEncoder<TMessage>` sözleşmesine DOKUNULMADI (kilitli karar) — bedeli
xmodem/ymodem/zmodem/kiss'te sabitlenen parametrelerdir ve ekranda uyarı olarak
görünür.

**Ölçüm:** birim 6748 → 6777 (hepsi yeşil), e2e'ye 5 test eklendi ve tam
süit yeşil koştu (1340 geçti · 2 atlandı).

**Aynı gün, ayrı commit — Test Automation'ın ŞABLON koltuğu da bağlandı.**
`byteSourceIo.encodeTemplate` testler dışında hiç verilmiyordu; `send-frame` +
`template` gerçek ekranda "şablon deposu bağlı değil" fırlatırdı. Metin→değer
dönüşümü `usePacketBuilder`dan `formValues.ts`e çıkarıldı (iki tüketici artık
AYNI fonksiyonu çağırıyor), şablon→çerçeve `packetTemplates.ts`te. Adım
formunda serbest metin yerine şablon SEÇİMİ var; şema adı tutmuyorsa üretim
REDDEDİLİR. İki ekranı bağlayan e2e turu yazıldı (Builder'da kaydet →
senaryodan gönder). Birim 6777 → 6782.

## ✅ Modbus'un üç taşıyıcısına encoder (2026-08-30)

§7'nin tüketicisi hazır olduğu için hedef tarafın ilk taşı: `modbusEncoders.ts`
— RTU · ASCII · TCP, üçü de AYNI girdiyi alır (adres/unit baytı + PDU) ve yalnız
zarfta ayrışır. Ortak girdi §33'ün ön koşuludur: ayrı girdi tipleriyle her
taşıyıcı çifti için ayrı bir uyarlama katmanı gerekirdi.

Girdi ADU'nun kendisi DEĞİL gövdesidir; CRC · LRC · MBAP burada HESAPLANIR. Hazır
bir çerçeveyi sarmak checksum'u iki kez yazmak olurdu. Kısıtlar: RTU'da CRC telde
LOW bayt önce, ASCII'de hex BÜYÜK harf (spec'in kendi dizgesi `:010300000002FA`),
TCP'de CRC YOK ve `Length` alanı unit ID'yi SAYAR. Sabitlenen tek parametre MBAP
transaction ID'dir (0) — üçüncü maddedeki tek parametreli `encode` sözleşmesinin
bedeli; defterde ilan ediliyor, ekranda uyarı olarak görünüyor.

**Ölçüm:** birim 6782 → 6794 (yeşil), e2e 1342 → 1343 (2 atlandı).

## ✅ MQTT PUBLISH ve Classical CAN encoder'ları (2026-08-30)

§33'ün sekiz dönüşümünden dördünün hedefi bu ikisi (Modbus register → MQTT,
BACnet property → MQTT, NMEA heading → CAN signal, Modbus TCP → Modbus RTU).
Modbus'takiyle aynı disiplin: gövde çağırandan, zarf encoder'dan.

MQTT: gövde `topic uzunluğu + topic + payload`, encoder Fixed Header + Remaining
Length yazar; PUBLISH · QoS 0 · DUP 0 · RETAIN 0 sabit. CAN: gövde `identifier
sözcüğü + veri`, DLC ve dolgu hesaplanır; format biti SAYFADAN gelir (2.0A base,
2.0B extended), base'de 11 bite sığmayan identifier kırpılmaz, reddedilir.

**Ölçüm:** birim 6794 → 6809 (yeşil), e2e 1343 → 1344.

## ✅ J1939 ve NMEA 2000 encoder'ları (2026-08-30)

`encodeJ1939Identifier` = `decodeJ1939Identifier`in tersi. Encoder girdisi ham
identifier sözcüğü değil ALANLAR (öncelik + PGN + hedef + kaynak + veri); ham
sözcük `can-2-0b`nin işiydi, bunun eklediği identifier'ı alanlardan kurmak.
NMEA 2000'in encoder'ı J1939'unkinin kendisidir — N2K identifier'ı J1939-21'in
identifier'ı; kopya üretici sızarsa test ayrıştırır. TP (çok çerçeveli aktarım)
üretilmez, 8 baytı aşan veri reddedilir.

§33'ün hedef tarafı artık SEKİZ motor taşıyor: 3 Modbus · MQTT · 2 CAN · J1939 ·
NMEA 2000. §33'ün sekiz örnek dönüşümünden JSON/CSV hedefli ikisi encoder
istemiyor (saf serileştirme); kalan tek eksik BACnet.

**Ölçüm:** birim 6809 → 6822 (yeşil), e2e 1344 → 1345.

## ✅ BACnet encoder'ları — §33'ün hedef tarafı tamamlandı (2026-08-30)

BACnet/IP: gövde BVLC başlığından sonraki NPDU; Type/Function/Length encoder'da.
BVLC Length KENDİNİ sayar (MBAP'ın tersine) — bu yüzden çağırana sorulmuyor.
Function sabit: Original-Unicast-NPDU. MS/TP: gövde `Frame Type + hedef + kaynak
+ veri`; Preamble, Length ve iki CRC hesaplanıyor. Length yalnız veriyi sayar ve
veri yoksa Data CRC hiç yazılmaz (Token çerçevesi Header CRC'de biter).

Hedef tarafta artık 10 motor var; §33'ün sekiz örnek dönüşümünün hepsi
karşılanabiliyor (JSON/CSV hedefleri encoder istemiyor). Eksik olan tek şey
`src/features/protocol-converter` — spec §6'nın açılmamış TEK feature klasörü.

**Ölçüm:** birim 6822 → 6832 (yeşil), e2e 1345 → 1346.

## ✅ §33 Protocol Converter ekranı (2026-08-30)

`src/features/protocol-converter` açıldı — spec §6'nın açılmamış SON feature
klasörü. Motor (`converterEngine.ts`) saf ve senkron; ekran hesap yapmaz.

Kaynak alan kimliğiyle eşlenir (bayt aralığıyla değil), değer
`physicalValue ?? rawValue` sırasıyla okunur, dönüşüm `value × k + c`nin dört
hâli. Hedefler: MQTT PUBLISH (gerçek paket, `mqtt` encoder'ıyla), JSON, CSV.
Ekran boş açılmaz: §33'ün kendi örneği (Modbus Register × 0.1 →
`sensors/temperature`) hazır gelir ve ilk açılışta gerçek bir paket üretir.

Tarayıcı turu bir eksik yakaladı: hiç değer üretilmediğinde sorun listesi
basılmıyordu, yani kaynak protokolü değiştiren kullanıcı sessiz bir boşluk
görüyordu. Düzeltildi.

**Ölçüm:** birim 6832 → 6848 (yeşil), e2e 1346 → 1351.

## ✅ WebSocket ByteSource (2026-08-30)

`src/connection/websocket` — spec §8.1'in kaynak listesindeki WebSocket maddesi.
Sözleşme aynı olduğu için monitör/Builder/TA üçü de kullanabilir; bu turda
Packet Builder bağlandı (rozet kalktı, adres kutusu yalnız o kaynak seçiliyken
görünüyor).

Kararlar: soketi üreten fabrika dışa açık (sahte soket enjekte edilebilsin),
metin çerçeveleri UTF-8 bayta çevrilir (atmak sessiz veri kaybı olurdu),
`binaryType = 'arraybuffer'` zorunlu, `stop()` sonrası kapanış hata sayılmaz,
karşı tarafın kapatması `'idle'`dır. Builder'ın `connect()`i WebSocket dalında
"bağlandı" yazmaz — onu `onopen` yazar.

Tarayıcı turu için `e2e/support/wsBridgeServer.mjs` elle yazıldı (depoda `ws`
paketi yok): SHA-1 el sıkışma + tek parçalı çerçeve, yankı köprüsü.
`playwright.config.ts` artık iki `webServer` koşuyor.

**Ölçüm:** birim 6848 → 6860 (yeşil), e2e 1351 → 1353.

## ✅ Çeviri paketi bölündü (2026-08-30)

Ölçüm: `LanguageProvider` chunk'ı 1,4 MB ham / **379 kB gzip**'ti ve yarısı
(`en`) Türkçe açılan arayüzde hiç okunmuyordu. Şimdi 712 kB / **199 kB gzip**;
`en` kendi chunk'ında (190 kB gzip) ve yalnız dil değişince iniyor.

Kritik ayrıntı: `translations` kaydı `translations/all.ts`e taşındı. Bir modül
hem statik hem dinamik içe aktarılırsa paketleyici onu statik chunk'a koyar —
`index.ts`teki tek bir `import { en }` satırı dinamik dalı anlamsız kılıyordu.
163 test/e2e dosyasının importu buna göre taşındı; uygulama kodu `all.ts`e
dokunmaz.

Bedeli: dil değişimi ile metin değişimi ayrı anlarda oluyor (seçim anında,
metinler chunk inince). Üç test asenkron oldu. Tarayıcı turu ölçümü ağdan
yapıyor: Türkçe açılışta `assets/en-*.js` isteği yok, dil değişince bir tane.

**Ölçüm:** birim 6860 (yeşil), e2e 1353 → 1354.

Monitör yalnız dinlediği için köprüye İTME kipi eklendi
(`?push=<hex>&interval=<ms>`); turdaki baytları `buildSimulatedFrame` üretiyor,
test elle çerçeve yazmıyor. Monitörde bus load hesaplanmaz: köprünün ardındaki
baud hızı bilinmiyor.


## 🏁 **Faz 10 KAPANDI — katalog borcu SIFIR (2026-08-27).**

Comm SPA'sında **Faz 9 bitti ve Faz 10 (protokol dalgaları) da BİTTİ.**
Sekiz domain'in sekizi de kapandı: `interfaces-framing` (dalga 10-11),
`network-ethernet` (12), `industrial-automation` (13), `automotive` (14),
`aerospace-uav` (15), `marine-navigation` (16), `building-automation` (17),
`wireless-iot` (18). **Katalogda kanonik `planned` kayıt KALMADI** — deponun
tarihinde ilk kez 172 kaydın tamamının ya bir motoru var ya da kanonik bir
kayda alias'lanıyor. KODDAN doğrulandı (tek kullanımlık sayım script'i,
2026-08-27): 172 kayıt · 8 domain · 54 aile · 15 alias; ham
**125 `ready` / 15 `planned` / 32 `partial`**, alias zinciri çözülünce
**140 `ready` / 0 `planned` / 32 `partial`**. Ham `planned` sayısının sıfır
olmaması bir borç DEĞİLDİR: 15 alias kaydın hepsi `planned` yazar ve rozet
`resolveStatus()` üzerinden kanonik kayıttan okunur.

**Sıradaki iş sınıfı KATALOG DIŞIDIR ve seçim kullanıcınındır:**
çerçeveler-arası (stateful) panolar, `custom-schema` `definitions` paneli
(19 kayıt bekliyor), Log Analyzer, `protocol-core/capture/pcap.ts`in ilk
tüketicisi. (`length-based-protocol`ın `canParse` borcu bu listeden ÇIKTI —
2026-08-27'de `39980be` ile kapandı, ayrıntı aşağıda.)

(Bu başlık 2026-08-21'de "Faz 10 TAMAMEN BİTTİ" diyordu; o cümle
`interfaces-framing`in bittiğini kastediyordu ama fazın tamamı gibi okunuyordu
— 2026-08-22'de düzeltildi. Sayım 2026-08-23'te dalga 13 kapanışıyla 48'den
32'ye, 2026-08-24'te dalga 14 kapanışıyla 32'den 20'ye, dalga 15-17 ile 4'e ve
2026-08-27'de dalga 18 ile **0**'a indi; sayımların hepsi KODDAN doğrulandı.)

**Dalga 12 (network-ethernet, 19 kayıt) 2026-08-22'de TAMAMEN KAPANDI**
(12a icmp/icmpv6 · 12b arp/lldp · 12c dns/mdns/dhcp · 12d ntp/ptp · 12e
snmp/syslog · 12f http/websocket/mqtt-sn · 12g rtp/rtcp · 12h
tftp/ftp/telnet — hepsi ayrı commit+push, ayrıntılar aşağıda ve
`docs/brief-faz10-dalga12.md`de).

**Dalga 13 (industrial-automation, 16 kayıt) 2026-08-22'de BAŞLADI, 2026-08-23'te
TAMAMEN KAPANDI** (kapanış özeti aşağıda, `046b914`; keşif turu
`docs/brief-faz10-dalga13.md`). 8 alt dalga koştu: 13a wireless-m-bus ·
13b iec-60870-5-101 · 13c opc-ua · 13d cip/ethernet-ip/devicenet · 13e
profinet · 13f powerlink/cc-link-ie/sercos-iii · 13g profibus-dp/cc-link/
as-interface/foundation-fieldbus · 13h io-link/hart. En önemli bulgu:
`iec104Asdu.ts`in `decodeAsdu()`su zaten `iec104.ts` tarafından kullanılan
KANITLI paylaşım (13b bunu tüketecek); `canopen.ts` ise yalnız tek
`parseCanopen()` export ediyor, powerlink'in CANopen paylaşımı iddiası
(13f) kod seviyesinde HENÜZ mümkün değil. classic-fieldbus (13g) dördü
büyük ölçüde ticari konsorsiyum spec'lerine (PI/CLPA/FieldComm Group)
dayanıyor — spec bulunabilirlik riski dalga 12'den köklü bir fark.

**Dalga 14 (automotive, 12 kanonik kayıt) 2026-08-23'te BAŞLADI, 2026-08-24'te
TAMAMEN KAPANDI** (kapanış özeti aşağıda; keşif turu `docs/brief-faz10-dalga14.md`). Ham `planned` 13'tür ama `canopen` bir ALIAS'tır
(`aliasOf: industrial-automation/cip-can-based/canopen`, dalga 13'te `ready`
oldu) — gerçek iş 12 kayıt. 8 alt dalga önerildi: 14a automotive-ethernet/
k-line · 14b xcp-on-can · 14c xcp-on-ethernet/ccp · 14d some-ip · 14e flexray ·
14f sae-j1850-pwm/vpw · 14g sent/spc · 14h psi5. Keşfin dört ana bulgusu:
(1) **beş kaydın girdisi bayt değil NABIZ günlüğü** (sent/spc/psi5/j1850×2) —
`parse(Uint8Array)` sözleşmesi kilitli olduğu için bu dalganın tek büyük
kararı, brief'in açık soru 1'i; (2) **CAN taşıyıcı paylaşımı KOD SEVİYESİNDE
KANITLI** — `isotp.ts`, `j1939.ts` ve cross-domain `devicenet.ts` aynı beş
sembolü `automotive/can/canFrame.ts`ten alıyor, xcp-on-can ile ccp de alacak,
ikinci bir CAN çözücü yazılmayacak; (3) **`automotive-ethernet`in kendine ait
tel biçimi YOK** — stack'in yedi halkası (ethernet-ii, vlan-802-1q, ipv4,
ipv6, udp, tcp + PHY tarafında single-pair-ethernet) zaten `ready`, kayıt
parser almadan `partial` + `calculatorIds` ile kapanmalı; (4) **`k-line` için
depo 2. dalgada zaten "motor ALMAZ" kararı vermiş** ve bunu `iso9141.ts:4-7`
ile `iso14230.ts:5-8`e yazmış. `CRC8_SAE_J1850` katalogda hazır ve YETİM
duruyor (ilk tüketici J1850 kayıtları olacak); FlexRay'in İKİ CRC'si de
katalogda YOK ve header CRC'si 20 bit — bayt hizalı `crc()` ile doğrudan
hesaplanamıyor.

**Sekiz alt dalganın uygulama brifleri de yazıldı**
(`docs/brief-faz10-dalga14a.md` … `14h.md`, `brief-faz10-dalga2a/2b` emsali).
Bağımlılık zinciri: 14c → 14b (`xcpPacket.ts` 14b'de doğar) · 14g → 14f (nabız
konteyneri 14f'te tanımlanır) · 14h → 14g · 14d → 14a (aile kapanış sayımı) ·
14e bağımsız. **14f/14g/14h ana brifin açık soru 1'i (nabız-günlüğü girdi
sözleşmesi) karara bağlanmadan başlamaz.** Açık soru 1 kullanıcı tarafından
**karma (c)** olarak karara bağlandı ve üçü de o çizgide koştu. Domain kapanış
işleri (CLAUDE.md borç sayımı 32 → 20, plan kapanış özeti, çürüyen tahminlerin
işaretlenmesi) 14h'te YAPILDI.

**14a (automotive-ethernet + k-line) BİTTİ** (uygulama; brief
`docs/brief-faz10-dalga14a.md`). İkisi de brief'in önerdiği gibi HİÇ parser
almadan kapandı — LoRa paterni beşinci/altıncı kez uygulandı. `automotive-
ethernet`: stack'in yedi halkası (Ethernet II, VLAN 802.1Q, IPv4, UDP, TCP +
Single Pair Ethernet PHY'si) zaten başka sayfalarda `ready`/`partial`; `related`
bu yediye genişletildi ve `summary` neyin nerede çözüldüğünü açıkça yazıyor;
motor `calculatorIds: ['spe-plca']` ile var olan `singlePairEthernet.ts`e
bağlandı, ikinci bir çözücü YAZILMADI. `k-line`: `iso9141.ts`/`iso14230.ts`
dosya başlarının "init bir bayt akışı değil hat olayıdır" kararı korunarak
rozet karara hizalandı (`planned` → `partial`); TEK yeni dosya
`protocol-core/timing/kLine.ts` — 5-baud init süresini `calculateUartTiming`i
`baudRate: 5` ile çağırarak hesaplar (ikinci bir UART formülü YAZILMADI), fast
init darbe toplamını alır, inter-byte/inter-message gap'i TEK parametrik
`evaluateTimingWindow` fonksiyonuyla değerlendirir (üç ayrı eşik fonksiyonu
yerine). ISO 14230-2'nin W1-W5/P1-P4 pencere değerleri ve 0x33 adres baytı
kaynakta olmadığı için KODA GÖMÜLMEDİ, hepsi çağırandan gelir (LIN `breakBits`
kararının aynı gerekçesi). 12 birim testi + 9 e2e (gerçek tarayıcı,
`e2e/k-line-calculator.spec.ts`) + `npm run typecheck` + tam paket (4757 test)
yeşil. `legacy-diagnostics` ve `automotive-ethernet` ailelerinde `planned`
kayıt kalmadı (yalnız `some-ip`, 14d'de kapanacak).

**14b (xcp-on-can) BİTTİ** (uygulama; brief `docs/brief-faz10-dalga14b.md`).
İki yeni dosya: `automotive/xcp/xcpPacket.ts` (taşıyıcıdan bağımsız CTO paket
çekirdeği, `cipCore.ts`in `decodeCipMessage` imza deseni) + `xcpOnCan.ts`
(CAN taşıyıcı — `canFrame.ts`/`canClassic.ts` `devicenet.ts` emsaliyle
PAYLAŞILDI, ikinci CAN çözücü YAZILMADI). Komut tablosu (57 kod, 0xC7-0xFF),
hata kodu tablosu (19 kod) ve olay kodu tablosu (14 kod) İKİ BAĞIMSIZ açık
kaynak XCP implementasyonundan (Scapy GPL-2.0, pyxcp LGPL) bayt bayt çapraz
doğrulandı — dalga 13'ün "iki bağımsız kaynak" disiplini bu dalgada web
araştırmasıyla gerçek zamanlı uygulandı. CONNECT/SET_MTA/GET_STATUS yapısal
çözülür (SET_MTA'nın bayt sırası pyxcp'nin `request(SET_MTA,0,0,ext,*addr)`
çağrısıyla BİREBİR örtüştü); UPLOAD/DOWNLOAD/DAQ/PGM komutları ad gösterilir,
parametreleri A2L olmadan HAM kalır.

**Ana brifin (14b) iki önerisi kaynak taramasıyla ÇÜRÜDÜ, ikisi de dosya
başında gerekçeli:** (1) tek bir `packetInterpretation: raw|cto|dto` kanalı
yerine, CTO/DTO ayrımının PID baytının SAYISAL ARALIĞINDAN (Scapy'nin kendi
`bind_layers` eşiği) çerçeveden çıktığı, ama asıl belirsizliğin `role`
(komut mu yanıt mı — AYNI bayt 0xFF hem CONNECT hem RES) olduğu ortaya
çıktı; (2) "byte order ilk sürümde açılmasın, A2L'den gelir" varsayımı
YANLIŞ çıktı — byte order CONNECT yanıtının `comm_mode_basic` bayrağından
müzakere edilir (Scapy VE pyxcp'nin ikisi de aynı `INTEL=0/MOTOROLA=1`
kodlamasını taşıyor) ve HER çok baytlı alanı etkiler; kanal AÇILDI. Bu,
automotive domain'inde `decodeOptions` kanalını AÇAN ilk kayıt —
`role`/`byteOrder` ikisi de `devicenet.ts`in `payloadInterpretation`
kararıyla aynı gerekçe sınıfı (GERÇEKTEN çerçeveden çıkarılamıyor).
CAN FD girdisi (72 bayt) AÇIKÇA `unsupported-encoding` ile reddedilir,
sessizce yanlış çözülmez. 125 birim testi (komut/hata/olay tablosunun HER
satırı `it.each` ile ayrı fixture) + 8 e2e (gerçek tarayıcı,
`e2e/xcp-on-can-decode.spec.ts` — `role`in AYNI PID'i farklı çözdüğü,
`byteOrder`ın SET_MTA adresini farklı çözdüğü kanıtlı) + typecheck + tam
paket (4882 test) yeşil. `calibration` ailesinde iki kayıt kaldı
(xcp-on-ethernet, ccp — 14c'de kapanacak, `xcpPacket.ts`in ikinci tüketicisi
orada doğacak).

**14c (xcp-on-ethernet + ccp) BİTTİ — `calibration` KAPANDI** (`2ec57da`).
`xcpPacket.ts` iki tüketicili oldu: `xcpOnEthernet.ts` `decodeXcpPacket`i ve
`role`/`byteOrder` seçenek dizisini `xcpOnCan.ts` ile AYNI REFERANSTAN paylaşıyor
(test `toBe` ile kanıtlıyor). Taşıma başlığının LEN/CTR alanları HAM kaldı: konum ve
genişlik iki kaynakta örtüşüyor ama BAYT SIRASI çelişiyor (Scapy big-endian, pyxcp
little-endian) — "iki kaynak örtüşmezse alan adlandırılmaz" kuralı burada işledi.

**14d (some-ip + some-ip-sd) BİTTİ — `automotive-ethernet` KAPANDI** (`05492fd`).
Ana brifin açık soru 5'i (ayrı kayıt mı, alt çözücü mü) kodla sınandı ve önerisi
doğrulandı: TEK katalog kaydı, İKİ modül (`someip.ts` + `someipSd.ts`).

**14e (flexray) BİTTİ** (`781166e`). Dalganın görünmez-değişmez riski en yüksek
kaydı; açık soru 4 **(a)** olarak kapandı: `crcEngine.ts`e
`crcBits(bytes, bitLength, params)` kardeşi eklendi ve `crc()` ona delege ediyor
(gövde kopyalanmadı). Katalogda ÜÇ yeni CRC girdisi (brief İKİ diyordu — kanal A/B
ayrı `init` taşıdığı için üç oldu): `CRC11_FLEXRAY`, `CRC24_FLEXRAY_A`,
`CRC24_FLEXRAY_B`; üçü de CRC RevEng'de attested ve 14 conformance codeword'ü
fixture olarak duruyor. İkisi de GERÇEKTEN doğrulanıyor.

**14f (sae-j1850-pwm + sae-j1850-vpw) BİTTİ — `vehicle-network-protocols` KAPANDI**
(`a48db80`). Nabız günlüğü konteyneri BU alt dalgada tanımlandı (nabız başına
2 bayt `Uint16LE`, birim 0.1 µs, 0 rezerve); `types.ts`e DOKUNULMADI. `canParse`
tuzağı ÖLÇÜLDÜ: naif imza (yalnız `pulses[0]`) 761 örneğin 413'ünü yanlış pozitif
kabul ediyordu; ölçüm kalıcı bir teste dönüştü (`j1850CanParseRegistry.test.ts`).

**14g (sent + spc) BİTTİ** (`c210e36`). Konteyner `protocol-core/decoding/
pulseLog.ts`e TAŞINDI (yalnız gerçekten ortak olan kısım). SENT sabitleri dört
bağımsız kaynakta örtüştü; CRC-4 ise yalnız GÖSTERİLİYOR — algoritma tek açık
kaynak koduyla görülebildi, üç çakışmayan varyantı var ve `CRC4_ITU` sahte dost
olarak REDDEDİLDİ. `spc.ts` `decodeSentNibbles`ı GERÇEKTEN çağırıyor.

**14h (psi5) BİTTİ — `sensor-interfaces` ve `automotive` domain'i KAPANDI**
(uygulama; brief `docs/brief-faz10-dalga14h.md`). Ana brifin bu kayıt için önerisi
"partial + `calculatorIds`, motor YOK"tu; **kaynak turu bu kötümserliği ÇÜRÜTTÜ**
ve kayıt gerçek bir motorla `partial` oldu. PSI5 nabız konteynerini KULLANMIYOR:
`dali.ts`in "Manchester decoder'a girmez" kararı birebir uygulandı, girdi çözülmüş
çerçeve bitleridir (spec `:171` buna açıkça izin veriyor); `currentLoop.ts` sahte
dost olarak çağrılmadı (PSI5 4-20 mA değil, taban akımın üstüne ΔI_S).

Kaynak turu beş bağımsız kamuya açık kaynağa ulaştı — PSI5 Technical Specification
V2.1 metni, Infineon KP405 datasheet'i, Infineon iLLD `IfxPsi5_Psi5.h` +
PSI5 sensör emülatörü kod örneği, NXP MMA51xxKW datasheet'i, Pico Technology
decoder belgesi — ve **çerçeve biçimi ikiden fazla kaynakta örtüştü**: iki start
biti (daima 0), 10-28 bitlik yük bölgesi (LSB-first), 1 bit çift parite ya da
3 bit CRC. **3 bitlik CRC İKİ SATICININ YAYIMLADIĞI test vektörüyle (NXP'nin
dokuz 10-bit vektörü + KP405'in 16-bit `0xAD2C → 0b100` örneği) hesapla
doğrulandı**, bu yüzden 14g'nin tersine CRC yalnız gösterilmiyor, GERÇEKTEN
doğrulanıp PASS/FAIL basılıyor. Parite ayrıca AURIX kod örneğinin çalışılmış
çerçevesiyle (`0001110000` → `RD = 0x38`, parity 1) doğrulandı — aynı fixture
LSB-first okumanın da kanıtı.

**REDDEDİLEN İDDİA:** psi5.org/overview'in (ve onu kopyalayan Wikipedia'nın)
*"8…24 data bits"* cümlesi. Aynı paragraf *"fixed 125kbps"* ve *"unidirectional"*
da diyor; ikisi de V2.x'te geçersiz. O özet V1.3 dönemi kalıntısı — V2.x'in gerçek
aralığı `k = 10…28`, `8` yalnız V1.3 mirası. Aralık bu yüzden REVİZYONA BAĞLI
yapıldı ve dışına çıkan değer uyarı basıyor. Dolaşımdaki "8/10/12/16/20/24"
listesindeki **12 hiçbir kaynakta yok** ve kullanılmadı.

**KAPSAM SINIRI (rozet `partial`, `iec-61850` GOOSE-only sınıfı):** slot zaman
çizelgesi ve sensör kimliği ÇÖZÜLMÜYOR — yukarı yön çerçevesinde sensör adresi
alanı YOK, kimlik zaman slotuyla belirleniyor ve slot sayacı ALICININ verisi
(iLLD `slotCounter : 3`, `timestamp : 24`). Application profile YALNIZ METADATA:
üç substandard belgesi (airbag / vehicle dynamics control / powertrain) kamuya
açık olmadığı için **hiçbir preset gönderilmedi** — `microwire.ts`in "93xx66 gibi
tablosu doğrulanmamış aileler yalnız `custom` yolundan kullanılır" kararının
genelleştirilmiş hâli. Aşağı yön (ECU → sensör) çerçeveleri kapsam dışı (3 ya da
9 start biti, ayrı biçim, 6 bit CRC'si tek kaynaklı ve test vektörsüz).

**`canParse` CRC-ONLY ve bu ÖLÇÜLMÜŞ bir karar:** 1 bitlik parite eleği 777 kayıt
örneğinden İKİSİNİ yanlış pozitif kabul ediyordu (`as-interface/end-bit-error`,
`ble-advertisement/unknown-pdu-type` — ikisi de bayt bayt geçerli birer PSI5-10P
çerçevesi, yapısal olarak ayrılamazlar). 3 bitlik CRC eleği aynı taramada SIFIR
çarpışma veriyor; `psi5CanParseRegistry.test.ts` her iki ölçümü de bekçiliyor.
**`crcEngine.ts` KULLANILMADI ve gerekçesi ölçüldü:** PSI5'in CRC'si augmented
(non-direct) topolojidir; aynı polinom ve aynı seed "direct" döngüye konulduğunda
1024 olası 10-bit yükün SIFIRINDA doğru sonuç veriyor (doğru direct karşılığı
seed `010`). `crcCatalogue.ts`e giriş de AÇILMADI — `CrcParams` bu bit-seviyesi
LSB-first beslemeyi ifade edemiyor, sahte bir satır tuzağı yayınlamak olurdu.

Yeni/değişen dosyalar: `protocols/automotive/psi5/psi5.ts` (+`psi5.test.ts`,
+`psi5CanParseRegistry.test.ts`, üçü de yeni), `protocols/index.ts` (1 kayıt) +
`index.test.ts` (sayaç + kategori haritası), `app/catalog/domains/automotive.ts`
(`planned` → `partial` + `pluginId` + dürüst `summary`), `translations/{tr,en}.ts`
(2×43 anahtar), `e2e/psi5-decode.spec.ts` (yeni, 8 test), `CLAUDE.md` (borç sayımı
KODDAN doğrulandı: 32 → 20 kanonik, automotive 1 → 0). 37 yeni birim testi +
8 e2e + `npm run typecheck` + tam paket (5249 test) yeşil.

**`automotive` domain'i TAMAMEN BİTTİ — dalga 14 kapandı.**

**Dalga 14 kapanış özeti (14a-14h, 8 alt dalga / 12 kanonik kayıt, 2026-08-23 →
2026-08-24):** `automotive`in 7 ailesinin HEPSİ kapandı — can-family,
vehicle-network-protocols (14e flexray + 14f j1850×2), sensor-interfaces
(14g sent/spc + 14h psi5), legacy-diagnostics (14a k-line), diagnostics,
automotive-ethernet (14a automotive-ethernet + 14d some-ip), calibration
(14b xcp-on-can + 14c xcp-on-ethernet/ccp). 12 kayıttan **9'u `ready`**
(xcp-on-can, xcp-on-ethernet, ccp, some-ip, flexray, sae-j1850-pwm,
sae-j1850-vpw, sent, spc), **3'ü `partial`** (automotive-ethernet ve k-line —
ikisi de bilinçli olarak parser ALMADAN kapandı, LoRa paterni; psi5 — kapsam
kararı). Domain toplamı: 25 kayıt = 18 `ready` + 6 `partial` + 1 alias, `planned`
KALMADI.

Dalganın kalıcı dersleri: (1) **`decodeOptions` bu domain'de kural oldu** — 14b
`role`/`byteOrder` ile açtı, 14f/14g profil, 14h dokuz seçenekle en uç örneği
verdi; ortak ölçüt hep aynı: parametre çerçeveden ÇIKARILAMIYORSA sorulur,
çıkarılıyorsa sorulmaz (14g'nin tick süresi TELDEN çıktığı için kanala GİRMEDİ).
(2) **"İki kaynak örtüşmezse alan adlandırılmaz" kuralı üç kez işledi** —
14c'nin LEN/CTR bayt sırası, 14g'nin CRC-4 varyantları, 14h'in psi5.org bayat
özeti. (3) **CRC sahte dostluğu ölçülebilir bir şeydir**: 14e üç CRC'yi
katalogda attested değerlerle açtı, 14g `CRC4_ITU`yu reddetti, 14h `crcEngine`in
direct döngüsünün 1024/1024 yanlış verdiğini SAYIYLA gösterdi. (4) **`canParse`
imzası ölçülmeden yazılmaz** — 14f'in 413 yanlış pozitifi kalıcı bir test
desenine dönüştü ve 14g/14h onu devraldı.

**`aerospace-uav` domain'i TAMAMEN BİTTİ — dalga 15 kapandı.**

**Dalga 15 kapanış özeti (15a-15h, 8 alt dalga / 12 kanonik kayıt, 2026-08-25 →
2026-08-26):** `aerospace-uav`in altı ailesinden dördü bu dalgada kapandı
(`distributed-uav-networks` 15a dronecan + 15b cyphal/uavcan-compatibility,
`rc-control-links` 15c sbus/ibus + 15d crsf + 15e ppm/pwm-servo,
`avionics-data-buses` 15f arinc-429 + 15g mil-std-1553, `surveillance` 15h
mode-s/ads-b); `uav-telemetry` zaten `mavlink` ile doluydu ve
`gnss-navigation`ın üç kaydı ALIAS'tır (yönü `marine-navigation`a bakar,
`resolveStatus()` `ready` çözer) — dalgada hiç dokunulmadı. 12 kayıttan
**8'i `ready`** (dronecan, sbus, crsf, ppm, pwm-servo, arinc-429,
mil-std-1553, mode-s), **4'ü `partial`** (cyphal — CAN FD kapsam kararı;
uavcan-compatibility — sınıflandırıcı, tel çözücüsü değil; ibus; ads-b —
1090ES-only). Domain toplamı: 16 kayıt = **11 `ready` + 5 `partial` + 3 alias**,
`planned` KALMADI (KODDAN doğrulandı, tek kullanımlık sayım script'i).

**15h (`mode-s` + `ads-b`, 2026-08-26)** aileyi VE domain'i kapattı. Dört ayrı
sessiz-yanlış-çözüm noktası vardı ve dördü de teste bağlandı: (1) **katalogdaki
DÖRT 24-bit CRC'nin hiçbiri Mode S'inki değil** — yeni giriş `CRC24_MODE_S`
(poly 0xFFF409, init 0, `check("123456789") = 0x054268`), polinom ÜÇ bağımsız
yoldan doğrulandı (ICAO Annex 10 Vol IV §3.1.2.6'nın belgeli üreteci + dump1090'ın
`modes_checksum_table`ı + `pyModeS` `_bits.py:70`), topoloji **direct
(non-augmented)** olarak kanıtlandı (aynı motorun CRC-24/OPENPGP için
YAYIMLANMIŞ 0x21CF02'yi üretmesiyle — 14h'in PSI5 dersi); (2) **DF24 ilk İKİ
bitten tanınır**, ilk beşten değil — naif okuma 24…31 arası SEKİZ farklı değer
üretirdi ve test 256 ilk baytın hepsini tarıyor; (3) **parite alanının anlamı
DF'e göre değişir** — DF11/17/18'de PI düz CRC'dir ve PASS/FAIL doğrulanır,
DF0/4/5/16/20/21'de AP = CRC ⊕ ICAO'dur ve *"a casual listener can't split the
address from the checksum"* (dump1090), yani adres ÇIKARILIR ama doğrulanamaz;
o çerçevelerde CRC PASS/FAIL alanı HİÇ BASILMAZ, çünkü basıp "doğrulanamadı"
demek olmayan bir ölçümü varmış gibi göstermek olurdu; (4) **CPR global pozisyona
ÇEVRİLMEZ** — ham 17-bit LAT/LON-CPR basılır, `physicalValue` ve `unit`
VERİLMEZ, çünkü global konum bir Even + bir Odd çerçevesi ister (`mavlink.ts`in
SEQ-LOSS sınırının aynısı).

İki AYRI MODÜL yazıldı ve bağımlılık TEK YÖNLÜ: `adsb.ts` `modeS.ts`in
`parseModeSFrameLayout()`unu ÇAĞIRIR, çerçeve ayrıştırmayı kopyalamaz
(`xcpPacket.ts` sınıfı paylaşım; 12d'nin `networkTimestamp` vakası bu kopyanın
bedelini ölçmüştü) ve `modeS.ts` `adsb.ts`i BİLMEZ. `ads-b` DF17/18 dışını
`unsupported-encoding` ile REDDEDER — gerekçe somut: gerçek bir DF20 Comm-B
yanıtının MB alanının ilk baytı 0x20'dir ve naif bir `>>> 3` okuması "TC 4, uçak
kimliği" verir. `attemptCrcCorrection` motoru [Karar 15h-1] ile bu dalgada
YAZILMADI (spec `:373`ün *"corrected mesaj native-valid ile aynı confidence
seviyesinde gösterilemez"* kısıtı brifte yazılı, sayfa metni "ileride" diyor) ve
iki kayıtta da `decodeOptions` AÇILMADI. `canParse` yanlış pozitifi ÖLÇÜLDÜ:
849 registry örneğinin **6'sı** (%0,71) `mode-s`i geçiyor — altısı da AP
sınıfından, yani üçüncü kanıtın bulunmadığı daldan; yalnız uzunluk ölçütü
kalsaydı 25 (%2,9) olurdu. `ads-b` **0** yanlış pozitif veriyor (CRC-24 her
çerçevede elek). `ads-b ⊂ mode-s` çakışması bir hata DEĞİL, teste yazılmış bir
değişmezdir. Dokunulan dosyalar: `crcCatalogue.ts` + `crcEngine.test.ts`
(`CRC24_MODE_S`), `CrcCalculatorTool.test.tsx` (36 → 37), `modeS.ts`/`adsb.ts`
(+ üç test dosyası), `aerospace-uav.ts` (iki kayıt `planned` → `ready`/`partial`
+ `pluginId`), `protocols/index.ts`, `index.test.ts`, `tr.ts`/`en.ts`
(2×85 anahtar: 42 `modeS` + 43 `adsb`), `e2e/mode-s-decode.spec.ts` (8 test) +
`e2e/ads-b-decode.spec.ts` (10 test). Tam paket yeşil: **5634 birim** (5578 →
+56) · **1184 e2e** (1166 → +18) · `npm run typecheck` · `npm run build`.

Dalganın kalıcı dersleri: (1) **Bir alanın ANLAMI çerçeve içinde değişebilir ve
bu bir kapsam sorunu değil, raporlama sorunudur** — 15h'in DF'e göre değişen
parite semantiği, dalga 13 dersi 3'ün (*"gösterilir ≠ doğrulanır"*) en sert
biçimi: aynı 24 bit bir çerçevede doğrulanabilir bir CRC, ötekinde
doğrulanamaz bir adres karışımıdır ve tek bir gösterge ikisini de yanlış
anlatır. (2) **Girdi sözleşmesi kapsamın kendisidir** — 15g'nin Manchester'ı,
15f'in bayt sırası, 15h'in Beast/SBS/dump1090 JSON konteynerleri: hepsinde
parser'ın önüne gelen bir katman kapsam dışı bırakıldı ve sayfa metnine yazıldı.
(3) **`canParse` bekçisi artık istisnasız bir görev kalemidir** — dalga 14f'in
413 yanlış pozitifiyle başlayan desen bu dalgada altı kez tekrarlandı ve 15h'te
İKİ kaydın İLİŞKİSİNİ (dar imza ⊂ geniş imza) ölçen bir biçime evrildi.
(4) **`crcBits()` bu domain'de HİÇ tüketici bulamadı** — keşif turunun öngörüsü
çürüdü, gerekçe `brief-faz10-dalga15.md`nin "Çürüyen tahminler" bölümünde.

~~Sıradaki domain seçimi HENÜZ YAPILMADI — kalan üç domain'de (`wireless-iot` 4,
`marine-navigation` 3, `building-automation` 1) hiç iş başlamadı, toplam
**8 kanonik kayıt** açık.~~ (Dalga 15'in kapanış notu; dalga 16
`marine-navigation`ı kapattı — aşağı.)

**`marine-navigation` domain'i TAMAMEN BİTTİ — dalga 16 kapandı.**

**Dalga 16 kapanış özeti (16a-16c, 3 alt dalga / 3 kanonik kayıt, 2026-08-26):**
`marine-navigation`ın beş ailesinden ikisi bu dalgada kapandı
(`legacy-proprietary-marine` 16a hdlc-based-marine + 16b seatalk,
`nmea-family` 16c iec-61162); `ais`, `gnss-corrections` ve `marine-machinery`
zaten doluydu. Üç kayıttan **1'i `ready`** (hdlc-based-marine), **2'si
`partial`** (seatalk — kaynak güvenilirliği + komut biti çerçevede yok;
iec-61162 — `UdPbC`-only kapsam kararı). Domain toplamı: 11 kayıt =
**6 `ready` + 2 `partial` + 3 alias**, `planned` KALMADI (KODDAN doğrulandı,
tek kullanımlık sayım script'i: 172 kayıt ham 124 `ready` / 20 `planned` /
28 `partial`, alias çözülünce 139 / 5 / 28). Deponun kanonik borcu **8 → 5**
indi (wireless-iot 4, building-automation 1).

Üç kayıt AYRI briflerle yürütüldü çünkü **hiçbir kod, kaynak ya da tel biçimi
paylaşmıyorlar** — 15c'nin (`sbus`+`ibus`) birleştirme gerekçesi olan "ortak
yardımcı burada doğuyor" durumu bu dalgada hiç doğmadı. Dalganın **Görev 0**'ı
kod yazılmadan ÖNCE koştu: `ProtocolPage.test.tsx` (seatalk'a sabit) ve
`e2e/nmea-decode.spec.ts` (iec-61162'ye sabit) fixture'ları katalogdan
türetilir hâle getirildi — 15b'nin "mayını patlamadan sök" dersi. İkisi de bu
dalgada kendiliğinden `building-automation/lonworks/lonworks`a kaydı; hiçbiri
kırılmadı.

**16a (`hdlc-based-marine`, `ready`)** — `hdlcCore.ts`in (dalga 10c'de
"paylaşılan çekirdek" ilan edilmişti) **ÜÇÜNCÜ tüketicisi**; `hdlc.ts`/`sdlc.ts`
şablon alındı, kod KOPYALANMADI, çekirdeğe DOKUNULMADI. Katalog checksum
eklemesi YOK: `CRC16_X25` zaten katalogda ve `check = 0x906E` fixture'ı
doğrulanmış. **Aynı poly aynı algoritma DEĞİLDİR**: katalogda poly `0x1021`
taşıyan dört giriş var, `CRC16_KERMIT` (`init=0 xorout=0`, check `0x2189`) ve
`CRC16_CCITT_FALSE` sahte dost olarak dosya başında AÇIKÇA reddedildi. Yedi
`decodeOptions` kanalı açıldı ve üçünün gerekçesi belgelenmiş bir denizcilik
vakası: AIS'in VDL katmanı (ITU-R M.1371-6 Annex 2 §A2-3.2.2) control alanını
TAMAMEN atıyor ve FCS'i yalnız 168 veri bitini kapsıyor — `controlFieldBytes: 0`
ve `fcsCoverage: 'information-only'` uydurma esneklik değil. `canParse` DAİMA
`false`: `0x7E…0x7E` zarfı 141 kayıt / 873 örnekte `hdlc`/`sdlc` ile çakışıyor.
Brifte olmayan iki karar: `rfc1662-octet-stuffed` modunda alan offset'leri
MANTIKSAL ve `asyncEscapingAssumed` uyarısıyla söyleniyor; `iso-13239-modulo8`
+ 2 baytlık control'de ikinci bayt ayrı bir `control-extended` candidate alanı,
uydurma modulo-128 yorumu YOK.

**16b (`seatalk`, `partial`)** `legacy-proprietary-marine` ailesini kapattı ve
dalganın kaynak-disiplini açısından en zorlu işi oldu. **HİÇBİR paylaşılan
çekirdek tüketilmedi ve bu bilinçli**: SeaTalk ASCII değil, `$`/`*`
sınırlayıcısı yok, CAN değil, **checksum'ı HİÇ YOK** (Knauf Part 1/2/3'ün tam
metninde `checksum`/`CRC` araması sıfır sonuç). **59 komut TANINIR, 22'si
ÇÖZÜLÜR** — yalnız ikinci bir bağımsız uygulamada da teyitli olanlar (SignalK
`nmea0183-signalk`in 21 hook'u + canboat'ın PGN 126720 tüneli); kalan 37'de
payload HAM kalır ve `commandPayloadNeedsVendorMap` basılır (`ads-b`nin Type
Code kararının birebir biçimi). Brifin "60 komut" sayısı ÇÜRÜDÜ: `C7` fantom —
Knauf Part 2'nin metninde yalnız `C1…C8` waypoint adı yer tutucusunun
sarmalanmış devamında geçiyor, komut baytı değil. **İki kaynak ÜÇ yerde
çelişti** ve üçünde de kaynağın KENDİ worked example'ıyla aritmetik olarak
doğrulanan okuma alındı (0x85 XTE nibble sırası `(XX<<4)|X`; 0x20 hız
little-endian; 0x84/0x9C başlık düzeltme terimi popcount) — üçüncüsünde iki
okuma ayrıştığı için alan `headingCorrectionAmbiguous` uyarısı TAŞIYOR.
**Komut biti çerçevede YOKTUR**: datagram sınırını belirleyen dokuzuncu bit
UART'ın parity bitindedir ve `Uint8Array`de yer almaz — komut alanı
`Command (assumed)` adını taşır, HER çözümde koşulsuz `commandBitNotInBytes` ve
`noIntegrityCheckOnWire` uyarıları basılır (`mil-std-1553`ün 15g'deki "sözcük
tipi çerçevede yok" bulgusunun aynı sınıfı). `canParse` DAİMA `false` ve bu
ÖLÇÜLMÜŞ: naif uzunluk imzası 27/870, Knauf'un 59 komutuyla daraltılmış imza
bile 7/870 yanlış pozitif veriyor; bekçi testi iki sayıyı ALT SINIR olarak
sabitliyor.

**16c (`iec-61162`, `partial`)** aileyi VE domain'i kapattı ve **keşif
hipotezinin çürüdüğü kayıt** oldu: "kendi teli yok, `uavcan-compatibility`
emsali, `canParse` daima `false`" öngörüsü yanlış çıktı. `-450` profilinin
gerçek bir teli var (`55 64 50 62 43 00` = `"UdPbC"`+NUL + TAG block + cümle +
CRLF) ve tel BEŞ bağımsız uygulamada birebir aynı (FKIE `maritime-dissector`,
`ipal_transcriber`, `PyLWE`, `gosk`, `EsDemo`). Üç gerçek `.pcap` yakalaması bu
alt dalgada doğrudan indirildi, UDP payload'ları çıkarıldı ve **her iki
checksum'ı da bağımsız yeniden hesaplandı**; üçü de `exampleFrames` oldu.
`canParse` bu yüzden **`true` döner** ve bekçi testi ilk kez TERS yönde koşuyor:
kanıtlanan şey yanlış pozitifin **SIFIR** olduğu (143 kayıt / 886 örnek, 0
çakışma).

Alt dalganın en incelikli noktası **aynı datagramda İKİ checksum'ın FARKLI bayt
aralıkları kapsamasıydı**: TAG bloğunun `*hh`si `\` ile `*` arasını
(`XOR("s:HE0001") = 0x45`), gömülü cümlenin `*hh`si `$`/`!` ile `*` arasını
(`XOR("HEROT,+000.05,A") = 0x35`) kapsar — algoritma AYNI, kapsam FARKLI ve tek
bir fonksiyonla çözmek HATA VERMEDEN yanlış PASS/FAIL basardı. İki aralık İKİ
AYRI modülde yaşıyor (`lweTagBlock.ts` TAG'i, `iec61162.ts` cümleyi bilir) ve
iki türetilmiş örnek çerçeve (biri TAG checksum'ı, öteki cümleninki tek hane
bozuk) ayrımı ekranda kanıtlıyor: biri FAIL basarken öteki PASS kalıyor.
`nmeaXorChecksum`/`formatNmeaChecksum` `nmeaChecksum.ts`ten DOĞRUDAN import
edildi, `parseNmeaSentence` KULLANILMADI (`$` başlangıcını sabit varsayıyor —
`ais.ts:10-20`in birebir emsali) ve `nmeaChecksum.ts`e DOKUNULMADI.

Üç bilgi çerçevede YOK ve üçü de farklı biçimde raporlanıyor: (1)
**çok-noktaya-yayın grubu UDP/IP başlığındadır**, payload'da hiç yok —
seçilmezse alan HİÇ BASILMAZ (`mode-s`in DF-bağımlı CRC alanını hiç basmaması
emsali), seçilirse koşulsuz `groupFromUserNotWire` uyarısı düşer; (2) **`c:`
zaman damgasının ÖLÇEĞİ** çerçeveden anlaşılmaz (gerçek yakalamada 13 hane =
ms, gpsd'nin örneğinde 10 hane = s) — hane sayısından ÇIKARILIR,
`timestampScaleInferred` basılır ve **`unit` ATANMAZ**, çünkü çıkarılmış bir
ölçek ölçüm değildir; (3) **`a:` authentication tag'inin biçimi kamuya açık
değil** — TANINIR, ÇÖZÜLMEZ, yeni kripto yüzeyi AÇILMAZ. Ayrıca `-1`/`-2`/`-3`/
`-460` profilleri `transportProfile` ile seçilince motor **çerçeve ÇÖZMEZ**,
`uavcanCompatibility.ts` biçiminde bir yönlendirme tablosu basar ve kullanıcıyı
`nmea-0183`/`nmea-2000` sayfalarına yollar.

Brifte yazmayan üç karar: (1) `decodeOptions` **5 → 7**'ye çıktı — brifin kendi
"görünen adaylar" listesindeki `timestampScale` (ölçek çerçevede yok, kullanıcı
vendor'unu biliyor olabilir) ve `strictTerminator` (`ipal_transcriber` ve FKIE
CRLF'i ŞART koşuyor, PyLWE koşmuyor; varsayılan PERMİSİF çünkü CRLF'siz datagram
tam çözülebiliyor) eklendi; (2) transmission group'un **düz metin anlamsal
açıklaması BASILMADI** — o açıklama standardın paywall'lı Tablo 4'ünde ve
ikinci elden aktarmak "uydurma kaynak" hatası olurdu; onun yerine iki bağımsız
kaynakta birebir örtüşen **talker kümesi** basılıyor ve motor datagramdaki
gerçek talker ID'lerini o kümeyle KARŞILAŞTIRIP çelişkide `groupTalkerMismatch`
uyarıyor — kullanıcının iddiası telle SINANIYOR; (3) `R?UdP` binary teli
**TANINIR ve AÇIKÇA "kapsam dışı" der**, sessizce "geçersiz önek" demez —
FKIE'nin gerçek binary yakalamasının 38 baytlık başlığı bunun örnek çerçevesi.
`ParsedField.id` çakışması (sekiz cümle aynı düz tabloda) hem sıra numarasıyla
hem de bir `Set` üzerinden yapısal olarak garantiye alındı ve iki testle
bekçilendi.

Dokunulan dosyalar (16c): `iec61162.ts` + `lweTagBlock.ts` (+ üç test dosyası),
`marine-navigation.ts` (`iec-61162` `planned` → `partial` + `pluginId` + domain
yorumu), `protocols/index.ts`, `index.test.ts`, `tr.ts`/`en.ts` (2×73 anahtar —
brif ~35-45 bekliyordu), `e2e/iec-61162-decode.spec.ts` (8 test). Tam paket
yeşil: **5782 birim** (5719 → +63) · **1203 e2e** (1195 → +8) ·
`npm run typecheck` · `npm run build`. **Katalog checksum eklemesi dalga
BOYUNCA SIFIR** — `CrcCalculatorTool.test.tsx` 37'de kaldı, `crcCatalogue.ts` ve
`nmeaChecksum.ts` hiç değişmedi. Dalga 13'ten beri `crcCatalogue.ts`e
dokunmayan ilk dalga.

Dalganın kalıcı dersleri: (1) **Paylaşılan çekirdek deseni üçüncü kez
kanıtlandı ve negatifi de gösterildi** — `hdlcCore.ts` üçüncü tüketicisini
aldı (16a), `nmeaChecksum.ts`+`nmeaSentences.ts` dördüncü/ikinci tüketicisini
aldı (16c), ama `seatalk` HİÇBİRİNİ tüketmedi ve bu bir eksiklik değil
protokolün kendisi; paylaşım aramak `ccp.ts`in reddettiği şeydir. (2) **Aynı
POLİNOM aynı algoritma değildir** (16a) — "aynı bit genişliği aynı algoritma
değildir" kuralının polinom düzeyindeki eşi; katalogda poly `0x1021` taşıyan
dört girişten yalnız biri HDLC'dir. (3) **İki kaynak çelişirse kazanan kendi
içinde ARİTMETİK olarak doğrulanabilendir** (16b) ve gerçekten ayrıştıklarında
alan bir uyarı TAŞIR; ayrıca kaynağın metninde geçen her bayt bir komut değildir
(`C7` fantomu). (4) **`canParse` yanlış pozitifi BRİF AŞAMASINDA ölçülebilir** —
bu dalgada üç imza brif yazılırken 870 örnek üzerinde ölçüldü (27/7/6/0) ve üç
kararın üçü de tahminle değil SAYIYLA verildi; bekçi testi artık iki yönlü
(`false` dönende "yazılsaydı ne çalardı", `true` dönende "hâlâ sıfır mı").
(5) **Bir kaydın "kendi teli var mı" sorusu KEŞİFTE cevaplanmalıdır** (16c) —
yanlış sınıflandırma yalnız motoru değil, rozeti, `decodeOptions` yüzeyini ve
bekçi testinin YÖNÜNÜ de değiştirirdi.

~~Sıradaki domain seçimi HENÜZ YAPILMADI — kalan İKİ domain'de
(`wireless-iot` 4, `building-automation` 1) hiç iş başlamadı, toplam
**5 kanonik kayıt** açık.~~ (Dalga 16'nın kapanış notu; dalga 17
`building-automation`ı kapattı — aşağı.)

**`building-automation` domain'i TAMAMEN BİTTİ — dalga 17 kapandı.**

**Dalga 17 kapanış özeti (tek commit, alt dalga YOK, 1 kanonik kayıt,
2026-08-26):** `building-automation`ın dört ailesinden `lonworks` bu dalgada
kapandı; `lighting-control`, `lighting-networks` ve `hvac-metering` zaten
doluydu. Tek kayıt **`partial`** rozetiyle açıldı. Domain toplamı: 11 kayıt =
**7 `ready` + 1 `partial` + 3 alias**, `planned` KALMADI (KODDAN doğrulandı,
tek kullanımlık sayım script'i: 172 kayıt ham **124 `ready` / 19 `planned` /
29 `partial`**, alias çözülünce **139 / 4 / 29**). Deponun kanonik borcu
**5 → 4** indi ve dördü de `wireless-iot`ta.

**Keşif hipotezi TAMAMEN ÇÜRÜDÜ.** Görev tanımı `lonworks`u
"`seatalk`/`cc-link-ie` sınıfı bir kaynaksız-kayıt vakası, spec'i paywall
arkasında" diye çerçevelemişti. Gerçekte normatif **Echelon LonTalk Protocol
Specification v3.0** ücretsiz indirilebiliyor (598 KB, 112 sayfa), tam yığın
**MIT** (`izot/lon-stack-ex` — orijinal Echelon LonTalk Stack'in tamamı) ve
Wireshark wiki'sinde **12.028 çerçevelik gerçek bir yakalama** duruyor. Bu,
dalga 16'nın herhangi bir kaydından daha iyi bir kaynak durumu. **Rozeti
belirleyen şey kaynak değil, KAPSAM oldu.**

**Kapsam çizgisi ve gerekçesinin İNCELİĞİ.** Çözülen tel: CN/IP
(ISO/IEC 14908-4 · ANSI/CEA-852) UDP datagramı + içindeki LonTalk
(ISO/IEC 14908-1) PDU'su. Kapsam dışı: 14908-2 (TP/FT-10) ve 14908-3 (PL-20)
ham L2 çerçevelemesi, XIF dosya çözümü, Gateway Mapping. Ham L2'nin gerekçesi
**"belgesiz" DEĞİL** — biçimi normatif spec'in Figure 3.2'sinde ve CRC
bölümünde TAM olarak var; eksik olan **YAKALAMA YOLU**: libpcap'te LonTalk
için `DLT_` yok, Wireshark'ın link katmanı girişi yok, kamuya açık ham L2
yakalaması yok. Birinci sınıf kaynağın kendi mimarisi bunu doğruluyor:
`packet-lon.c`in TEK giriş noktası `dissector_add_uint("cnip.protocol", 0,
lon_handle)`. *"Belgesiz"* ile *"erişilemez"*i ayırmak bu dalganın en ince
ayrımıydı ve dosya başına aynen yazıldı. Emsal: `iec-61162` `UdPbC`-only (16c),
`ads-b` 1090ES-only (15h), `iec-61850` GOOSE-only, `foundation-fieldbus`
HSE-only, `cc-link-ie` 0x890F-only — **kuralın yedinci uygulaması.**

`canParse` **`true` döner** ve karar tahminle değil SAYIYLA verildi: CN/IP tam
imzası (uzunluk alanı KENDİNİ doğrular + sürüm 1 + paket tipi 14'lük kümede +
`20 + 4×exth ≤ n`) 143 kayıt / 886 örnekte **0** çakışma ölçtü; aynı imza
gerçek yakalamanın 12.028 datagramında 12.028 doğru pozitif verdi. Ham LonTalk
PDU imzası aynı kümede **401 (%45)** çakışıyor — `seatalk`in (16b) 27/870'inden
on beş kat kötü. Bu iki sayı arasındaki uçurum **kapsam kararının ikinci
ayağıdır** ve bekçi testi (`lonworksCanParseRegistry.test.ts`) ÜÇ YÖNÜ de kodda
tekrarlıyor: ileri (yabancı çakışma bugün de 0), ters (naif ham imza hâlâ
> 300 çalardı), kendi üzerinde (CN/IP teli taşıyan tüm örnekler geçiyor).

**Kaynak hiyerarşisi alan alan işledi ve Wireshark ÜÇÜNCÜ sınıf çıktı.** Dört
kaynak alan alan karşılaştırıldı ve **dört yerde ayrıştılar**; üçünde normatif
spec hakem oldu. (1) CN/IP bayt 2'nin bölünmesi: Wireshark tüm baytı sürüm
sayıyor, Echelon `LtIpPktHeader::parse` içinde `version & 0x1F` / `& 0xE0` diye
AÇIKÇA bölüyor — hakem Echelon, çünkü okuma bir maske değeriyle değil KODLA
kanıtlı. (2) Adres biçimi 2b'nin +4 baytı: Wireshark `dstgrp` diyor, `go-lon`
`DstSubnet` diyor; Figure 3.2 (`2b: SrcSubnet 0 SrcNode DstSubnet 1 DstNode
Group GrpMemb`) **go-lon'u haklı çıkardı** — bozuk sanılan kaynak burada
doğruydu. Bu dalganın en değerli tek bulgusu: normatif kaynak olmasaydı o alan
"belirsiz" damgasıyla ve gereksiz bir uyarıyla yayınlanacaktı. (3) Adres biçimi
3 (UID): `go-lon` 6 baytlık dilimden `uint64` okumaya çalışıyor ve
`domain_offset`u 5'te bırakıyor, yani domain'i UID'nin ORTASINDAN okuyor —
hakem spec + aritmetik (`1+1+1+6 = 9`), Wireshark alındı. (4) IP-852 yükünde
kuyruk CRC'si — ÇÖZÜLMEDİ, aşağıda.

**Aynı polinom + aynı init + aynı yansıma bile aynı algoritma değildir.**
LonTalk'ın CRC'si **CRC-16/GENIBUS**tur ve katalogda YOKTU. Normatif spec
yalnız polinomu veriyor (*"X16 + X12 + X5 + 1, the CCITT CRC-16 standard"*);
init/yansıma/xorout'u veren tek kaynak Echelon'un `LtCUtil.c`sindeki `LtCRC16`
(init `0xFFFF`, MSB-first tablo, `crc = ~crc`, büyük endian yazım). O uygulama
bu dalgada bağımsızca yeniden kuruldu ve reveng'in yayımlı `check = 0xD64E`
değerini üretti. **`CRC16_CCITT_FALSE` bundan YALNIZ `xorout`ta ayrılıyor**
(check `0x29B1`) — aynı poly, aynı init, aynı yansıma. 16a'nın *"aynı POLİNOM
aynı algoritma değildir"* dersinin en keskin hâli ve deponun tarihindeki en
keskin sahte dost; `CRC16_X25` de aday gibi görünür ama YANSITIR.
`CRC_ALGORITHM_IDS` **29 → 30**, `crcEngine.test.ts`e `0xD64E` fixture'ı,
`CrcCalculatorTool.test.tsx` **37 → 38**.

**Kuyruk CRC'si VARSAYILMAZ ama VARSA doğrulanır.** 12.028 datagramın
HİÇBİRİNDE kuyruk CRC'si yok (4 polinom × 3 init × yansıma × xorout × iki bayt
sırası tarandı; bağımsız ikinci sürüm 36.000 denemede 2 tutma verdi — şans
düzeyi) ve gövde uzunlukları da doğruluyor: 8 baytlık gövdeler tam olarak
`PPDU + NPDU + src(2) + dst(2) + domain(1) + TPDU(1)`. Ama `lon-stack-ex`in
`LtLreIpClient.cpp`si alınan IP-852 yüklerinde bir kuyruk CRC'si doğruluyor.
Karar: `cnip-tunnel` modunda CRC **HİÇ hesaplanmaz** (otomatik sezme yalnız
1/65536 yanlış pozitif eklerdi) ve motor bunu `tunnelCarriesNoCrc` uyarısıyla
SÖYLER; `payloadKind` `raw-lontalk-pdu-with-crc`ye çevrilince GENIBUS
GERÇEKTEN doğrulanır. *"gösterilir ≠ doğrulanır"* korundu.

**Semantik tip telde olmayabilir — KNX DPT ilkesinin ikinci vakası.** LonTalk
NV mesajı yalnız 14 bitlik bir **selector** taşır ve selector cihazın bağlama
tablosundaki bir İNDEKSTİR, tip değildir; tip cihazın XIF'inde ya da ağ
yönetim aracındadır. Aynı iki bayt (`00 CA`) beş ayrı mühendislik değeri
veriyor: `SNVT_temp` −253.8 °C · `SNVT_temp_p` 2.02 °C · `SNVT_lev_percent`
1.01 % · `SNVT_amp` 20.2 A · `SNVT_count` 202. Tip `nvPayloadType` kanalıdır,
seçilmediğinde değer HAM kalır ve **HER NV çözümünde `nvTypeNotOnWire` uyarısı
KOŞULSUZ basılır** (`seatalk`in `commandBitNotInBytes`i ile aynı sınıf:
kapatılamayan uyarı, seçim yapıldıktan sonra da durur). Ölçek tablosu
`lonmark.org/nvs/`nin **221 tip sayfasının hepsi indirilerek** çıkarıldı ve
skaler + ölçek üçlüsü dolu + `obsolete: no` süzgeciyle **75 tipe** indirildi.
🚨 **Ölçek formülü `A × 10^B × (ham + C)`** — parantez KRİTİK:
`(A × 10^B) × ham + C` yazmak `SNVT_temp`te sonucu ~2466 °C kaydırır ve HATA
VERMEZ. `snvtTypes.test.ts` iki formülü de hesaplayıp ayrıştıklarını assert
ediyor; e2e ise aynı iki baytın ekranda `SNVT_temp_p`de **2.02 °C**,
`SNVT_temp`te **−253.8 °C** okunduğunu kanıtlıyor. Tuzağın gizlendiği yer de
teste bağlandı: 75 tipin **yalnız birinde** `C ≠ 0`, yani yanlış formül 74
tipte doğru sonuç verir.

**NM/ND yanıt kodu ÜÇ KATLI ÇAKIŞIR ve bu NORMATİFTİR.** Spec NM yanıtını
`00pxxxxx`, ND yanıtını `00p1xxxx` diye tanımlıyor. Sonuç: yanıtlar
`0x00`–`0x3F` aralığında, yani "generic application message" aralığının
İÇİNDE; ND biçimi NM biçiminin ALT KÜMESİ; ve ayrım YALNIZ eşleşen isteğe
bakılarak yapılabilir — o istek çerçevede YOK. Gerçek yakalama bunu doğruluyor:
15 `NM_NV_FETCH` (`0x73`) isteğinin 15 yanıtı da `0x33` ve `0x33` aynı zamanda
`ND_CLEAR_STATUS` (`0x53`) yanıtı olarak da geçerli. Motor alanı
**`Application Code`** olarak basıyor, SPDU RESPONSE içindeyken
`responseCodeAmbiguous` uyarısı basıyor ve **İKİ ADAYI DA alanın kendi
metninde listeliyor**; transaction numarası basılıyor ki kullanıcı komşu
çerçeveyle kendisi eşleştirebilsin. Çerçeveler arası eşleştirme YAPILMIYOR
(dalga 16 bulgu 12) ve **uydurma bir "NM yanıtı" adı BASILMIYOR** —
Wireshark bunu yapmıyor, her NM/ND yanıtını sessizce "Application message"
etiketliyor; **motor birinci sınıf kaynaktan daha doğru davranıyor.**
`mode-s`in AP alanı kararının (15h) birebir aynı sınıfı.

**AYNI DOSYADAKİ YORUM İLE KOD AYRIŞABİLİR; KOD KAZANIR** — ve bu dalgada İKİ
KEZ yaşandı. (1) `LtIpPackets.h:264`ün yorumu `extndHdrSize` için *"size of
header - 20"* diyor (bayt gibi okunuyor), ama `LtIpPackets.cpp`nin KODU
*"extndHdrSize is a count of 4-byte values"* deyip `p += (extndHdrSize*4)`
yapıyor; Wireshark da `offset += 4 * exth_len`. Motor `4 × exth` atlıyor ve
türetilmiş bir örnek çerçeve bunu ekranda kanıtlıyor — bayt sayılsaydı LonTalk
PDU'su üç bayt kayardı, hata vermeden. (2) `packet-lon.c:395`in kendi `TODO`su
AuthPDU maskelerinin bozuk olduğunu SÖYLÜYOR ve önerdiği düzeltme de yanlış;
doğru maskeler `0xC0`/`0x30` ve onları `lcs_tsa.c:89`in `BITS3(fmt, 2,
pduMsgType, 2, transNum, 4)` satırı veriyor. Wireshark'ın ÇIKARIM kodu doğru,
GÖSTERİM maskesi yanlış. **Alan tarifini yorumdan değil çalışan koddan al.**
Aynı disiplin `BITS<n>()` makrolarının yönünde de gerekti: yön `bitfield.h` ile
`lcs_platform.h`in BİRLİKTE okunmasıyla belirleniyor
(`BITF_DECLARED_BIG_ENDIAN` → argümanlar MSB→LSB) ve tek dosyaya bakmak tüm bit
alanlarını ters çevirirdi, hata VERMEDEN.

**Doğrulanmamış yollar tek tek işaretlendi.** Gerçek yakalama şunları
doğruladı: 20 baytlık başlık, `len` kendini doğrulaması, PPDU/NPDU bit düzeni,
adres biçimi 0 ve 2a, domain 0 ve 1 bayt, TPDU ACKD/ACK, SPDU
REQUEST/RESPONSE, APDU NV/NM/Application, transaction eşleşmesi, NM yanıt kodu
aritmetiği. Doğrulanmayanlar (`exth > 0`, bayt 2'nin 5/3 bölünmesi,
`pcode != 0`, security bit, Data Packet dışındaki 13 tip, adres biçimi 1/2b/3,
domain 3 ve 6 bayt, REMINDER/REM-MSG, AuthPDU'nun tamamı, Network Diagnostic,
Foreign Frame kod anlamı, `NM_MANUAL_SERVICE_REQUEST` kuyruğu, kuyruk CRC'li
ham PDU) ilgili ALANLARINDA `pathNotVerifiedInCapture` uyarısı taşıyor ve
çerçeve düzeyinde tek bir `decodePathNotVerified` uyarısı düşüyor.

**Öncelik bilgisi ULAŞIM KATMANINDA.** `packet-cnip.c` CN/IP önceliğini
`destport == 1629` diye yazıyor (IANA kaydı: `lontalk-norm` 1628/udp,
`lontalk-urgnt` 1629/udp — Wireshark'ın *"Not IANA registered"* yorumu YANLIŞ),
ama **port bu motorun girdisinde YOK** (`bacnetip.ts` ile aynı: IP/UDP başlığı
parser'a girmez). CN/IP düzeyinde öncelik alanı HİÇ BASILMIYOR; LonTalk
PPDU'sunun kendi `0x80` priority biti ayrıdır ve o basılıyor.

**Modül bölünmesi ve XIF kararı.** `cnip.ts` (zarf) ile `lonTalk.ts` (PDU)
birbirini HİÇ çağırmıyor — kaynaklar da iki ayrı dissector kullanıyor ve CN/IP
`pcode != 0` ile başka yükler taşıyabilir; domain içi emsal
`bacnet/npdu.ts` ↔ `bacnetip.ts`. `snvtTypes.ts` saf veri, üçüncü modül.
**XIF parser'ı YAZILMADI** ve bu bilinçli: `[Karar 15h-1]`in ve 16c'nin
"domain'i kapatan dalgada ikinci motor riski artırır" gerekçesinin aynısı.
`definitions` sekmesi bu yüzden "planlandı" basıyor ve BU DOĞRU DAVRANIŞTIR
(`ProtocolPage.tsx`in `DEFINITION_PANELS`inde `xif` yok; emsal `lin` ve
`arinc-429`, ikisi de `ready`). e2e bunu sınıyor. **Yeni bilinen borç:** XIF
parser'ı + `xif` `definitions` paneli — kaynakları burada listeli, bir sonraki
nesil aramak zorunda kalmasın: LONMARK Device Interface File Reference Guide
rev 4.501 (`lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf`, girişsiz,
429 KB), `izot/shortstack`ta ~20 gerçek `.xif` örneği, `g3gg0/LonScan`ın açık
C# parser'ı (~250 satır, kırılgan).

Brifte yazmayan kararlar: (1) `decodeOptions` **8'de kaldı** — dalga 15/16'da üç
kez üst üste büyüyen kanal sayısı bu dalgada brifin cömert tahminini
DOĞRULADI; (2) `nvPayloadType`ın şık listesi **75 SNVT** oldu ve şık etiketleri
VERİ (`SNVT_temp (39)`), çeviriye girmedi; (3) Foreign Frame kodu için
`numeric`/`hide` seçeneği açıldı ama sınıf adı HER İKİ ŞIKTA da basılıyor —
boş kart yasağı; (4) `timestampEpoch` varsayılanında `unit: 'ms'` ATANIYOR
(birim `LtIpPackets.h:272`den KAYNAKLI) ama epoch bildirilince birim DÜŞÜYOR,
çünkü ISO tarih metninin birimi yoktur; (5) ham PDU + kuyruk CRC'li 13. bir
örnek çerçeve eklendi ki katalog eklemesinin GERÇEK bir tüketicisi olsun.

Dokunulan dosyalar (17): `building/lonworks/` (`cnip.ts`, `lonTalk.ts`,
`snvtTypes.ts`, `lonworks.ts` + dört test dosyası),
`app/catalog/domains/building-automation.ts` (`planned` → `partial` +
`pluginId` + kapsamı AÇIKÇA yazan `summary`), `protocols/index.ts`,
`protocols/index.test.ts`, `protocol-core/checksums/crcCatalogue.ts` +
`crcEngine.test.ts`, `features/calculators/tools/CrcCalculatorTool.test.tsx`
(37 → 38), `tr.ts`/`en.ts` (2×100 anahtar — brif ~110 bekliyordu),
`e2e/lonworks-decode.spec.ts` (11 test). Tam paket yeşil: **5880 birim**
(5782 → +98) · **1212 e2e** (1203 → +9) · `npm run typecheck` ·
`npm run build`. İki türetilmiş fixture (`ProtocolPage.test.tsx` ve
`e2e/nmea-decode.spec.ts`) kendiliğinden
**`wireless-iot/mesh-smart-home/thread`**e kaydı ve ikisi de yeşil kaldı —
dalga 16a'da yapısal olarak sökülen mayın dördüncü kez de patlamadı.

Dalganın kalıcı dersleri: (1) **"Paywall" bir arama-durdurma gerekçesi
DEĞİLDİR** — normatif spec ücretsiz, tam yığın MIT, SNVT master listesi açık,
XIF referans kılavuzu açık, 12 bin çerçevelik yakalama açık. (2) **Kaynak
hiyerarşisi kağıt üzerinde değil ALAN ALAN işler** — Wireshark birinci sınıf
sanılıyordu, normatif spec gelince üç yerde ondan sapıldı ve bir yerde bozuk
sanılan `go-lon` haklı çıktı. (3) **Birinci sınıf kaynak kendi hatasını
yazabilir** (`packet-lon.c:395`in `TODO`su) ve **çıkarım kodu ile gösterim
metadata'sı ayrışabilir**. (4) **Aynı dosyadaki YORUM ile KOD ayrışabilir; KOD
kazanır** — bu dalgada iki kez. (5) **Aynı polinom + aynı init + aynı yansıma
bile aynı algoritma değildir** (`CRC16_GENIBUS` vs `CRC16_CCITT_FALSE`,
yalnız `xorout`). (6) **Semantik tip telde olmayabilir** — NV selector bir
bağlama indeksidir; KNX DPT ilkesinin ikinci vakası. (7) **`canParse` yanlış
pozitifi üçüncü kez brif aşamasında ölçüldü** ve ilk kez `true`/`false`
kararının ötesine geçip **KAPSAM kararını** belirledi (0 vs 401).

~~Sıradaki domain seçimi YAPILMADI ve YAPILMAYACAK — geriye **TEK domain**
kaldı (`wireless-iot`: thread, wifi, esp-now, rf-telemetry-custom-frame),
toplam **4 kanonik kayıt** açık.~~ (Dalga 17'nin kapanış notu; dalga 18 o dört
kaydın dördünü de kapattı — aşağı.)

---

## 🏁 Dalga 18 — `wireless-iot` KAPANDI, **SEKİZİNCİ ve SON domain** (2026-08-27)

**Katalog borcu SIFIRLANDI.** Bu dalga bittiğinde katalogda kanonik `planned`
kayıt kalmadı; deponun tarihinde ilk kez 172 kaydın tamamının ya bir motoru var
ya da kanonik bir kayda alias'lanıyor. Keşif turu `docs/brief-faz10-dalga18.md`
(ana brif) + `18a`…`18e` alt briflerinde; beş alt dalga koştu.

| Alt dalga | Kayıt | Sonuç | Birim | e2e |
|---|---|---|---|---|
| **18a** | `wifi` (1/2) — 802.11 MAC katmanı | `partial` | 5880 → 5943 | 1214 → 1226 |
| **18b** | `wifi` (2/2) — yönetim gövdeleri + IE ayrıştırıcı | `partial` | 5943 → 6004 | 1226 → 1232 |
| **18c** | `esp-now` | **`ready`** | 6004 → 6024 | 1232 → 1244 |
| **18d** | `thread` | `partial` | 6024 → 6147 | 1244 → 1260 |
| **18e** | `rf-telemetry-custom-frame` | `partial` | 6147 → **6209** | 1260 → **1269** |

Domain toplamı: 16 kayıt = **9 `ready` + 7 `partial` + 3 alias**, `planned`
KALMADI. Katalog CRC sayısı **38'de KALDI** — dalga 16'dan sonra ikinci kez
sıfır-ekleme dalgası; `crcCatalogue.ts`, `crcEngine.test.ts` ve
`CrcCalculatorTool.test.tsx` beş alt dalganın hiçbirinde AÇILMADI
(`[KARAR 18-6]`, iki FCS de katalogda VARDI ve gerçek yakalamayla doğrulandı:
802.15.4 `CRC16_KERMIT` **331/331**, 802.11 `CRC32` **1080/1093**).

**Paylaşılan çekirdek deseni dördüncü ve beşinci kez uygulandı.**
`wifi/dot11Frame.ts` ÜÇ tüketiciye hizmet ediyor (18a `wifi`, 18b yönetim
gövdeleri, 18c `esp-now`) ve `protocol-core/framing/ieee802154Frame.ts` İKİYE
(`zigbee`, `thread`). İkincisi bir ÇIKARMA işlemiydi ve riski gerçekti: MAC
çözücüsü `zigbee.ts`in İÇİNDEYDİ, hiçbir yardımcısı `export` edilmemişti ve
Thread MAC katmanı GÜVENLİĞİ kullanıyor (Auxiliary Security Header), Zigbee
kullanmıyor. Çıkarma "kes-yapıştır" olmadı: çekirdek bir ÖZET döndürüyor
(`payloadStart`/`payloadEnd`), gövdeyi TÜKETİCİ araya sokuyor — çünkü `zigbee`
FCS'i NWK'dan ÖNCE, `thread` EN SONDA basıyor ve `zigbee`nin
`data-field-id` seçicileri dalga 7'den beri o sıraya bağlı. İki tüketici de
yeşil kaldı.

**`canParse` yanlış pozitifi DÖRDÜNCÜ kez brif aşamasında ölçüldü ve ilk kez
DÖRT kayıt için AYNI ANDA karar verdi.** Dördü de `true` döner ve dördünün de
imzası SAYIYLA seçildi: `thread` T4 (802.15.4 Data + Thread dispatch + GEÇERLİ
FCS) **0/929**, `wifi` W12 **0**, `esp-now` E1 (Category 127 + Espressif OUI)
**0/899**, `rf-telemetry` (önbelleme + sync sözcüğü) **0/929**. Reddedilen naif
imzalar aynı kümede sırasıyla 138, 216, 3 ve 0 çalıyor; her bekçi testi kendi
ölçümünü KODDA tekrarlıyor. **`canParse`ı CHECKSUM taşıyabilir:** `thread` ve
`wifi` yalnız FCS sayesinde sıfıra iniyor — FCS'siz aynı imzalar 18 ve 216.

**18a — 802.11 MAC.** Kapsam `[KARAR 18-2]`: girdi ÇIPLAK 802.11 çerçevesi +
4 baytlık FCS (`LINKTYPE_IEEE802_11` = 105); radiotap (127), PPI, Prism, AVS ve
pcap zarfı AYRI link-type'lardır ve kapsam DIŞIDIR. Kapsam çizgisini libpcap'in
link-type tablosunun ÇİZEBİLMESİ bu dalganın kalıcı bir dersi oldu:
*"bu ayrı bir konteyner"* iddiası artık KANITLANABİLİR bir iddiadır. Brifin
ofset zinciri SÖZDE-KODU çürüdü (`if (FC.order) → n += 4` tür kapısı YOK); HT
Control yalnız QoS Data ve Yönetim çerçevelerinde vardır ve sözde-kod
uygulansaydı QoS-olmayan bir Data çerçevesinin gövdesi **4 bayt kayardı, hata
VERMEDEN.** Uygulama brifin KENDİ tuzak notunu izledi (`htControlIsMeaningful`).

**18b — yönetim gövdeleri + IE.** RSN sayaç zinciri TEK bir kapıdan geçiyor
(`counterFits`, pairwise + AKM + PMKID); brif yalnız ikisini işaret ediyordu.
WPA vendor IE'si RSN gibi çözülüyor ama **süit tablosu PAYLAŞILMADI** —
Wireshark'ın kendisi de iki AYRI tablo taşıyor ve WPA'nınki 7'de bitiyor; tek
tablo yazılsaydı bir gün RSN'e eklenen 18 (OWE) WPA IE'sinde de basılırdı,
hata VERMEDEN. Element ID 47 "Reserved" DEĞİLmiş: `packet-ieee80211.h:408`
`TAG_ERP_INFO_OLD` ve 42 ile AYNI çözücüye bağlı.

**18c — `esp-now`.** Tek `ready` kayıt. Brif rozeti `partial` öngörmüştü;
gerçek yakalama bulununca `ready` oldu. Espressif'in KENDİ şeması ilk 24 baytı
802.11 MAC başlığı, son 4 baytı FCS diye tanımlıyor, yani yeni tel biçimi YOK.
🚨 **`Protected = 1` olan bir ESP-NOW çerçevesi `canParse`ı GEÇEMEZ ve bu bir
eksiklik değil, protokolün kendisidir:** Category baytı da şifreli gövdenin
İÇİNDEDİR, yani dışarıdan bakan biri korumalı bir vendor action frame'inin
ESP-NOW olduğunu ÇERÇEVEDEN BİLEMEZ.

**18d — `thread`.** Zincir MAC → (Auxiliary Security Header) → 6LoWPAN → IPv6 →
UDP → MLE SINIFLANDIRMASI. **MLE gövdesi ŞİFRELİDİR** ve şifresiz gönderilen
SADECE Discovery Request (16) ile Discovery Response (17); ötekilerde komut tipi
ÇERÇEVEDE OKUNAMAZ, "şifreli MLE" damgası basılır ve MIC PASS/FAIL BASILMAZ
(`[KARAR 18-3]`, CLAUDE.md anahtar kuralı). İki brif tahmini çürüdü: MLE'nin UDP
portu `0xF0BF` değil **`0x4D4C`** (= ASCII `"ML"`, 19788) ve MLE dissector'ı
`packet-thread.c`de değil **`packet-mle.c`**te. **Bir yakalamanın LINK-TYPE'ı
içinde ne olduğunun cevabı DEĞİLDİR:** `6LoWPAN.pcap` DLT 1'dir (Ethernet) ama
ZEP v2 kapsüllemesi çıkarılınca içinden 331 gerçek 802.15.4 çerçevesi ve
**331/331 doğru FCS** çıktı. Ve *"yorum ile kod ayrışırsa KOD kazanır"*
üçüncü kez, ilk kez BİRİNCİ SINIF bir uygulamada: OpenThread'in `SecuritySuite`
enum yorumları takas edilmiş (`mle.hpp:1498-1502`) ve yanlış okuma "şifreli"yi
"şifresiz" sanıp ciphertext'i alan olarak basardı.

**18e — `rf-telemetry-custom-frame`, kaydın SINIFI ötekilerden farklı.** Bu bir
protokol değil, bir **profil çalıştırıcısıdır** (`[KARAR 18-5]`): yayımlanmış
tel biçimi yoktur, motor `protocol-core`un şema yorumlayıcısı üstüne kurulur ve
alan yerleşimi kullanıcının BİLDİRDİĞİ parametrelerden üretilir. İki YENİ
`protocol-core` modülü yazıldı — `decoding/lfsrWhitening.ts` (PN9, 9 bit,
x⁹+x⁵+1, tohum `0x1FF`; TI'ın yayımladığı `FF E1 1D 9A ED 85 33 24 EA` dizisi
FIXTURE olarak ASSERT ediliyor ve 511 baytlık periyot da sınanıyor) ve
`decoding/manchester.ts` (IEEE 802.3 ↔ G. E. Thomas, geçersiz çift konumuyla
hata). İkisinin de bugün TEK tüketicisi var ve bu dosya başlarına DÜRÜSTÇE
yazıldı.

🚨 **DEPONUN KENDİ SPEC'İ ÇÜRÜDÜ — yeni bir ders sınıfı.**
`docs/spec/ozet/09-kablosuz-iot.md:171`in verdiği çerçevenin CRC'si (`C9 21`)
**65.535 polinomun tamamıyla** (init/yansıma/xorout çarpanları × 6..12 arası tüm
bayt aralıkları) taranıp ÜRETİLEMEDİ; `:173`ün whitening örneği de 8.192 LFSR
kombinasyonunun ve 40 BLE kanalının hiçbiriyle çıkmadı. **Spec'in sayısal
örneği bir fixture DEĞİLDİR** — aritmetiği kontrol edilene kadar. Doğru
davranış uygulandı: ALAN YERLEŞİMİ korundu (o bilgi geçerli), SAYILAR motordan
üretildi ve örnek açıklamasına *"spec'in `C9 21`i DEĞİL, motorun kendi
`CRC16_CCITT_FALSE` çıktısı `AC54`"* diye YAZILDI. Dalga 17'nin *"keşfin elle
çözdüğü her çerçeve şüphelidir"* dersinin dördüncü vakası ve ilk kez şüpheli
olan şey deponun KENDİ belgesi.

✅ **DEVRALINAN MAYIN KAPANDI (2026-08-27).** `createSchemaParser`in `canParse`i
boş `startBytes`te `[].every()` yüzünden HER ŞEYE `true` diyordu; ölçüldü,
`length-based-protocol` registry'nin **937 örneğinin 937'sini** sahipleniyordu
(%100). Dalga 18e bunu DÜZELTMEMİŞ ama ondan KAÇINMIŞTI: şemaya sabit
`startBytes` KONULMADI, `canParse` `rfTelemetry.ts`te AÇIKÇA yazıldı; gerekçe
önbelleme ve sync sözcüğünün bu kayıtta KULLANICI PARAMETRESİ olmasıydı —
şemaya sabitlenseydi 4 baytlık sync kullanan biri kendi çerçevesini çözemezdi.
Borç `CLAUDE.md`ye kaydedilmiş, `rfTelemetryCanParseRegistry.test.ts`in ikinci
ayağı mayının orada olduğunu HER KOŞUDA yeniden ölçmüştü.

Borç kendi turunda kapatıldı. Boş `startBytes` dalı artık şemanın KENDİ
bildirdiği yapısal kısıtlara düşüyor (bitiş baytları · şemadan türeyen çerçeve
boyunun teldeki boya eşitliği · `ascii` alanlarının yazdırılabilirliği) ve
**hiçbir koşul denetlenemiyorsa `false` dönüyor**. `startBytes` DOLU dal kod
yolu olarak DEĞİŞMEDİ. Aynı 937 örnekte önce → sonra (toplam/kendi/yabancı):
`custom-binary-protocol` 16/2/14 → 16/2/14 (birebir aynı), `length-based-protocol`
937/2/935 → 1/1/0, `ascii-protocol` 937/2/935 → 5/1/4, uzunluk alanı olmayan
`lengthField` sonda 937 → 0. `parse()` çıktısı 5625 çağrılık önce/sonra
karşılaştırmasında BİREBİR aynı kaldı. Bu dalganın kaydı için gerekçe, kaybedilen
iki bozuk-çerçeve örneği ve `rf-telemetry`nin kaçınmasının HÂLÂ doğru olduğunun
ölçümü: `CLAUDE.md` "Dalga 18'den KALAN İKİ BORÇ" bölümü, madde 1.

**`decodeOptions` ON kanal, ama brifin öngördüğü on DEĞİL.** Brifin dört `text
hex` kanalı (`preambleBytes`, `syncWord`, `whiteningPolynomial`,
`whiteningSeed`) AÇILAMADI: `DecodeOption.kind` yalnız `'select' | 'number'`
(`protocol-core/types.ts:278`) ve o dosya dokunulmaz. Karşılığı yazıldı —
uzunluklar ve tohum `number` kanalı oldu, polinom PN9'a sabitlendi. Brifin
BİRİNCİ kanalı (`profile`: spec/cc1101/nrf/custom) da çürüdü: belgelenmiş TEK
çerçeve yerleşimi spec §3.9'unkidir, CC1101 ve nRF bir RADYO yapılandırmasıdır
ve o üçü zaten ayrı kanaldır. Uygulanan on kanal: `manchesterPolarity`,
`manchesterBitOrder`, `whitening`, `whiteningSeed`, `preambleLength`,
`syncWordLength`, `lengthFieldSemantics`, `crcAlgorithm`, `crcCoverage`,
`crcByteOrder` — **onu da çıktıyı BAYT DÜZEYİNDE değiştiriyor** ve dördünün
etkisi e2e'de ekranda kanıtlanıyor (aynı tel, farklı bildirim, farklı çözüm).
Kanal YAPILMAYANLAR gerekçeleriyle dosya başında: RF metadata (çerçevede yok),
Unknown RF Protocol Analyzer (çok çerçeveli), girdi adaptörü seçimi (kanal
değil, `parse`ın önünde koşan bir GİRDİ DÖNÜŞÜMÜ), `custom-schema` paneli
(`[KARAR 18-7]`), ve **`calculatorIds` bağlantısı** — `ProtocolPage.tsx:433`
onu YALNIZ `timing` sekmesinde basıyor, bu kaydın `timing` sekmesi yok, yani
bağlantı hiç görünmezdi. *Görünmeyen bir bağ, olmayan bir bağdır.*

**Manchester ofsetleri TELE göre ölçekleniyor.** Manchester çözüldüğünde tel iki
kat uzundur; `ParsedField.offset/length` DAİMA kullanıcının yapıştırdığı tel
baytlarına göre verilir (`DecodePanel` bayt görüntüleyiciye kullanıcının
girdisini basıyor, çözülmüşü değil) ve `rawBytes` tel dilimidir, çözülmüş değer
`rawValue`da durur. Eşleme kesin: her çözülmüş bayt tam iki tel baytıdır.

**ÜÇ türetilmiş fixture bekçisi AÇIKÇA `skip`e düştü** — dalga 16a'nın yapısal
olarak söktüğü mayının son hâli. `src/pages/ProtocolPage.test.tsx`,
`e2e/nmea-decode.spec.ts` ve `e2e/modbus-decode.spec.ts` hepsi *"motoru
olmayan, alias olmayan, `decode` sekmesi olan ilk `planned` kayıt"*ı
KATALOGDAN türetiyordu; artık öyle bir kayıt YOK ve üçü de sessiz yeşil
DEĞİL, `skipped` raporluyor (birim: `1 skipped`; e2e: `2 skipped`).
Görev tanımı İKİ bekçi bekliyordu — üçüncüsü (`modbus-decode.spec.ts`, dalga
15b'nin yapısal çözümü) de aynı sınıftaydı ve o da düştü.

**Başka bir kaydın ölçümü GÜNCELLENDİ, gerekçesiyle.**
`surveillanceCanParseRegistry.test.ts`teki `mode-s` yanlış pozitif sayısı
**7 → 13** oldu: bu kaydın altı 14 baytlık örneğinin ilk baytı `0xAA`, yani
DF = 21 (Comm-B identity reply — ATANMIŞ bir DF ve 112 bitlik uzunlukla
TUTARLI) ve `modeS.ts`in AP tuzağı yüzünden CRC eleği olmayan daldan geçiyorlar.
Bir regresyon DEĞİL, bekçinin İŞİNİ YAPMASI; ters yön TEMİZ
(`rf-telemetry.canParse` registry'nin 937 örneğinin hiçbirini almıyor) ve
"yalnız 7/14 bayt" karşılaştırması 27 → 33'e çıktı.

Dokunulan dosyalar (18e, 13): `protocol-core/decoding/lfsrWhitening.ts` +
testi, `protocol-core/decoding/manchester.ts` + testi,
`protocols/wireless/rftelemetry/` (`rfTelemetryProfiles.ts`, `rfTelemetry.ts`,
`rfTelemetry.test.ts`, `rfTelemetryCanParseRegistry.test.ts`),
`app/catalog/domains/wireless-iot.ts` (`planned` → `partial` + `pluginId` +
kapsamı AÇIKÇA yazan yorum), `protocols/index.ts`, `protocols/index.test.ts`,
`protocols/aerospace/surveillance/surveillanceCanParseRegistry.test.ts`
(7 → 13), `tr.ts`/`en.ts` (2×52 anahtar — brif ~85 bekliyordu; fark yine
"alan/algoritma/profil adları VERİDİR, çevrilmez" kuralından),
`e2e/rf-telemetry-decode.spec.ts` (9 test). Tam paket yeşil:
**6209 birim** (6147 → +62, 1 `skipped`) · **1269 e2e** (1260 → +9,
2 `skipped`) · `npm run typecheck` · `npm run build`.


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

**13h (2026-08-23 bitti) — io-link, hart.** `sensors-device-integration` VE
`process-instrumentation` aileleri KAPANDI — ikisi de tek kayıtlı aile olduğu için bu iki
kaydın bitmesi doğrudan iki aile kapanışı demekti.

**HART — brief'in 2. açık sorusu ÇÖZÜLDÜ, cevap HAYIR:** `protocol-core/checksums/
lrc.ts`teki `lrcChecksum` HART'ın checksum'ı DEĞİL — kaynağında `twosComplementChecksum`a
delege ettiği doğrulandı (Modbus ASCII'nin iki'nin tümleyeni LRC'si). Gerçek checksum
`simpleChecksums.ts`teki `xor8Checksum`, PAYLAŞILDI. Kapsadığı baytlar Start Delimiter'dan
(dahil) son veri baytına (dahil) — preamble ve checksum'ın kendisi HARİÇ; bu, İKİ bağımsız,
GERÇEKTEN ÇALIŞAN açık kaynak uygulamasından (`yaq-project/hart-protocol` Python,
`jszumigaj/hart` Go) ve o kütüphanelerin KENDİ birim testlerindeki ÜÇ elle-doğrulanmış
vektörden (kısa istek→0x02, kısa yanıt→0xA3, uzun istek→0x07) teyitlendi. Bir web
kaynağının "delimiter 0 ile başlarsa uzun, 8 ile başlarsa kısa" iddiası KENDİ TABLOSUYLA
ve iki bağımsız kodla ÇELİŞTİĞİ için REDDEDİLDİ. Preamble bu ailede İSTİSNA: PROFIBUS/
AS-i'nin "fiziksel katman decoder'a sızmaz" kuralının TERSİNE, HART'ın 0xFF tekrarı
bayt-seviyesinde gerçekten var olduğu için bir ALAN olarak çözülür. Komut sınıflandırması
(Universal 0-30/Common Practice 32-126/Device-Specific 128-253) doğrulandı, Data alanı
komuta özel olduğu için (~200 komut) ham bırakıldı — `profibusDp.ts`in DU kararının aynısı.
`ready` — envelope'un HER alanı adlandırılıp checksum GERÇEKTEN doğrulanıyor.

**IO-Link — RESMİ, ÜCRETSİZ spec doğrudan indirildi (13g'nin GSD/spec-bulma sıkıntısı
burada YOK):** IO-Link Interface and System Specification V1.1.4 (Haziran 2024),
io-link.com'da herkese açık — 314 sayfa, `pdftotext` ile metne çevrilip Annex A (Codings,
timing constraints and errors) birebir kullanıldı. M-sequence checksum (0x52 tohum + XOR +
8→6 bit sıkıştırma denklemleri, Figure A.4 + denklem A.1) resmi formülle GERÇEKTEN
doğrulanıyor; ISDU kanalında (Annex A.5) tek çerçeveye sığan bir parametre isteği/yanıtı
varsa Index/Subindex/Data VE kendi bağımsız CHKPDU checksum'ı da çözülüyor. **Yeni bir
mimari desen: `messageSide` decodeOptions kanalı.** Master mesajı (`MC,CKT,…`) ile Device
mesajı (`…,CKS`) AYRI UART patlamaları ve hangisinin gönderildiği baytların içinde
yazmıyor — kısa girdilerde gerçek bir çakışma (2 baytlık girdi hem "TYPE_0 okuma isteği"
hem "TYPE_0 okuma yanıtı" olabilir). `ccLink.ts`in `direction`ı ve `iec101.ts`in genişlik
seçeneklerinin "alan YERLEŞİMİNİ değiştiren decodeOptions" emsalini BÜYÜTÜYOR: burada
seçenek hangi BAYTIN hangi ALANA karşılık geldiğini bile değiştiriyor. Process Data
içeriği, Type 2'nin PD/OD sınırı (alt tip MC/CKT'de yazmıyor) ve segmentli ISDU ham
bırakıldı. `ready` — aynı `profibusDp.ts`/`hart.ts` ölçütü: envelope'un HER alanı
doğrulanıyor, ham kalanlar YAPISAL eksik değil IODD/eşleşen çerçeve/önceden-anlaşılmış-
parametre bağımlı içerik.

67 yeni birim testi (`hart.test.ts` 36 + `ioLink.test.ts` 31) + 23 yeni e2e (gerçek
tarayıcı: `hart-decode` 12 + `io-link-decode` 11; IO-Link e2e'si `messageSide`in
GERÇEKTEN alan yerleşimini değiştirdiğini AYRICA doğruluyor) + 4745 toplam birim test +
968 toplam e2e + typecheck/build yeşil. Değişen/yeni dosyalar:
`protocols/industrial/hart/hart.ts` (+test, yeni),
`protocols/industrial/iolink/ioLink.ts` (+test, yeni), `protocols/index.ts` (2 kayıt) +
`index.test.ts` (sayaç/alfabetik sıra/kategori haritası),
`app/catalog/domains/industrial-automation.ts` (2 kayıt: ikisi de `ready` + `pluginId` +
dürüst `summary`), `translations/{tr,en}.ts` (2×~50 anahtar),
`e2e/{hart,io-link}-decode.spec.ts` (yeni), `CLAUDE.md` (borç sayımı KODDAN doğrulandı:
34→32 kanonik, industrial-automation 2→0).

**`industrial-automation` domain'i TAMAMEN BİTTİ — dalga 13 kapandı.**

**Dalga 13 kapanış özeti (13a-13h, 8 alt dalga / 16 kanonik kayıt, 2026-08-22 →
2026-08-23):** `industrial-automation`ın 8 ailesinin HEPSİ kapandı — modbus, metering
(13a wireless-m-bus), scada-utility (13b iec-60870-5-101 + 13c opc-ua), cip-can-based
(13d cip/ethernet-ip/devicenet), industrial-ethernet (13d ethernet-ip + 13e profinet +
13f powerlink/sercos-iii/cc-link-ie), classic-fieldbus (13g profibus-dp/cc-link/
as-interface/foundation-fieldbus), sensors-device-integration (13h io-link),
process-instrumentation (13h hart). 16 kayıttan **12'si `ready`** (wireless-m-bus,
iec-60870-5-101, opc-ua, cip, ethernet-ip, devicenet, profinet, powerlink, sercos-iii,
profibus-dp, io-link, hart), **4'ü `partial`** (cc-link-ie, cc-link, as-interface,
foundation-fieldbus — dördü de `classic-fieldbus`/`industrial-ethernet`in en
kaynak-kısıtlı köşesinde, hepsi bilinçli kapsam kararı, eksik iş değil).

Brief'in (`docs/brief-faz10-dalga13.md`) tahminlerinden: **"spec kaynağı riski dalga
12'den köklü fark" tahmini tam DOĞRULANDI** — 13g'nin dört kaydı (classic-fieldbus'un
profibus-dp DIŞINDAKİ tamamı) gerçekten kaynak yetersizliğinden `partial` kaldı, brief'in
öngördüğü "IEC 61850 GOOSE-only presedanı" senaryosu birebir gerçekleşti. **POWERLINK'in
CANopen paylaşımı "sınanacak, kanıtlanmazsa bağımsız yazılır" kararı ÇÜRÜME yönünde
sonuçlandı** — paylaşım bit düzeyinde test edilip üç somut farkla (NMT durum kodları, SDO
çerçeve biçimi, PDO boyut sınırı) reddedildi, dalga 12'nin "akraba görünen tel biçimi
farklı çıkabilir" dersini bir kez daha doğruladı. **HART checksum sorusu (açık soru 2) bu
alt dalgada ÇÖZÜLDÜ**, cevap `lrc.ts` değil `xor8Checksum` — yukarı. **EDS sorusu (açık
soru 1) ana session tarafından erken kapatılmıştı**: `ethernet-ip`e `definitions` sekmesi
eklenmedi, motor EDS okumuyor. Alt dalga zorluk sıralaması (13a/13b kolay başta, 13c/13e
Opus-seviyesi, 13g en yüksek spec-riski) da fiilen doğru çıktı: 13g gerçekten dalganın en
çok `partial` üreten alt dalgası oldu.

Sıradaki domain seçimi HENÜZ YAPILMADI — kalan beş domain'de (`automotive` 12,
`aerospace-uav` 12, `wireless-iot` 4, `marine-navigation` 3, `building-automation` 1) hiç
iş başlamadı, toplam 32 kanonik kayıt açık.

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

- ~~`src/features/` altında **log-analyzer · protocol-converter ·
  reverse-engineering · test-automation** klasörleri hiç açılmadı~~ →
  **üçü yazıldı** (log-analyzer §34 `b39fc2e`, reverse-engineering §35+§36
  `61233e0`, test-automation §38 `af1f975`). Açılmamış TEK klasör
  ~~**`protocol-converter` (§33)**~~ → **YAZILDI** (2026-08-30): önce hedef
  tarafın on encoder'ı, sonra ekranın kendisi. Bekletilme gerekçesi
  (`plugin.encoder`in tüketicisi yoktu) ortadan kalktı; ayrıntı `CLAUDE.md`
  "Bilinen borçlar" 3. ve 9. maddelerde. **Spec §6'nın feature klasörlerinin
  hepsi artık açık.**
- ~~`src/connection/` altında **usb · bluetooth · websocket · file** yok~~ →
  **`file` yazıldı** (§8.1, `5c04ebd`) ve **`websocket` yazıldı** (2026-08-30):
  Packet Builder'ın "planlandı" rozeti kalktı, seçenek gerçek bir köprüye
  bağlanıyor ve tarayıcı turu elle yazılmış bir RFC 6455 köprüsüyle veri yolunu
  ölçüyor. **Üç ekran da bağlandı** (Packet Builder · Live Monitor · Test
  Automation): sözleşmenin "bir kez yaz, üçü de kullansın" vaadi ölçüldü.
  Kalan ikisi (**usb · bluetooth**) hâlâ yok ve ikisi de headless tarayıcıda
  sınanamaz, o yüzden birim testle sınırlı kalacak.
- ~~`src/protocols/` klasörünün kendisi yok~~ → **açıldı ve doldu**: 8 domain
  klasörü + `pluginBinding.ts`, 191 plugin dosyası (2026-08-29 sayımı).
- `src/components/` altında **packet-viewer · signal-viewer · protocol-tree**
  hâlâ yok (bugün: `byte-viewer · charts · common · forms · layout ·
  navigation · virtualized-tables`). Spec §6'nın klasör listesindeki bu üç
  görüntüleyici yazılmadı; işlevlerinin bir kısmını `byte-viewer` ve
  `DecodePanel` karşılıyor.

**Bu bölümün satırları 2026-08-29'da KODDAN yeniden ölçüldü.** Öncesinde dört
maddenin üçü çürüktü (feature klasörleri, `connection/file`, `src/protocols/`);
bir sonraki okuyan da kullanmadan önce ölçsün.

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
