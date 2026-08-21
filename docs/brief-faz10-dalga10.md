# Faz 10, dalga 10 — Framing & Stream Protocols ailesi (keşif, 2026-08-21)

Dalga 9 kapandı (`hayes-command-set → at-commands → lte-modem-at → {nb-iot,
gnss-modem}` + Karar 6 + Cellular Dashboard, commit `141309b`+`eefff59`).
`plan-fazlar.md` sıradaki dalgayı tanımlamıyordu — bu brief onu tanımlamak
için yazıldı. Kod YOK, yalnız keşif.

**Kapsam:** `interfaces-framing/framing-stream-protocols` ailesindeki 17
kayıttan 13'ü hâlâ `planned`: `custom-binary-protocol`, `ascii-protocol`,
`delimiter-based-protocol`, `length-based-protocol`, `slip`, `cobs`, `hdlc`,
`sdlc`, `ppp`, `kiss`, `xmodem`, `ymodem`, `zmodem`. (Kalan 4: `ubx`/`rtcm`
alias — kanonik kayıtları marine-navigation'da zaten `ready`; `at-commands`/
`hayes-command-set` dalga 9'da bitti.)

**Kaynak:** `docs/spec/ozet/02-framing-protokolleri.md` (451 satır, ailenin
17 kaydının 17'sini de kapsıyor, ham spec satır 3629–6253'ün 1:1 damıtımı) +
`docs/spec/ozet/11-domain-taksonomisi.md:76-100` (ailenin kendi 5 alt-aile
kırılımı). Framing motoru **Faz 6**'da yazıldı (`plan-fazlar.md:28`,
`dalga` numaralamasından ÖNCE — dalga6 brief'i BİNA OTOMASYONU'yla ilgili,
framing motoruyla karıştırılmasın), belgesi `src/protocol-core/framing/*.ts`
dosyalarının kendi başlık yorumlarında + `02-framing-protokolleri.md`de.

## Framing motoru — 15 yöntem, zaten yazılı ve test edilmiş

`src/protocol-core/framing/` — `createExtractorFromConfig(config)`,
`@/protocol-core`den import edilir (`at-commands`ın zaten kullandığı emsal).
`FRAMING_METHOD_IDS` (15): `fixed-length · start-byte · multiple-start-bytes
· start-end-delimiter · length-field · line-ending · inter-character-timeout
· inter-frame-timeout · escape-based · bit-stuffing · byte-stuffing · cobs ·
slip · hdlc-flag · modbus-silent-interval`. `bit-stuffing` KASITLI OLARAK
`FrameExtractor` üretmiyor (bit-hizasız akış, ayrı primitive —
`bitStuffing.ts`), gerisi (`FramingMethodConfig`, 14 varyant) çalışır
switch'le `createExtractor.ts`de.

**Kritik bulgu — SLIP ve COBS yalnız kesmiyor, ÇÖZÜYOR da:**
`slipExtractor`/`cobsExtractor`in `extract()`i unescape/decode'u kendi
İÇİNDE yapıp çözülmüş payload'ı döndürüyor (`escapedDelimiterFraming.ts`,
`cobs.ts:128`). `encodeSlip()`/`encodeCobs()` ters yön için hazır. Bu iki
protokol için "motor yaz" diye bir iş YOK — yalnız `ProtocolPlugin` sarmalı.

**PPP ve KISS motor gerektirmiyor, DOĞRULANMIŞ fixture'la:**
- PPP = `hdlc-flag` METODUNUN AYNISI (Flag 0x7E/Escape 0x7D/XOR 0x20 birebir
  eşit). İki testte doğrulanmış: `escaping.test.ts:41`,
  `hdlcFraming.test.ts:12` — `01 7E 02 → 01 7D 5E 02` (spec satır 206).
- KISS = SLIP'in AYNI dört baytı (FEND=0xC0/FESC=0xDB/TFEND=0xDC/TFESC=0xDD).
  Doğrulanmış: `escaping.test.ts:27,51` — `11 C0 22 DB 33 → 11 DB DC 22 DB
  DD 33` (spec satır 226).

**HDLC iki AYRI, birbirine bağlanmamış parça olarak var:**
`hdlcFraming.ts` (`hdlc-flag`, ASENKRON bayt-kaçışlı — PPP'nin de kullandığı)
ve `bitStuffing.ts` (GERÇEK bit-senkron HDLC stuffing, `FrameExtractor`
DEĞİL, bilerek ayrı — logic-analyzer/import girdisi için). İkisi de FCS
(CRC) ve I/S/U çerçeve sınıflandırması YAPMIYOR — bu protokol katmanının
işi, hiç yazılmadı. Katalog kaydının kendi yorumu zaten `'live'` sekmesini
çıkarmış: *"bit-senkron çerçeveleme sıradan seri portla yakalanamaz"*.

**SDLC'nin sıfır kodu var**, spec'e göre HDLC'yle "çok benzer" çerçeve
yapısı, tek farkı primary/secondary istasyon + poll/final. HDLC'nin
üreteceği bit-stuffing/FCS altyapısını doğrudan paylaşabilir.

**XMODEM/YMODEM/ZMODEM'in HİÇBİRİ framing motoruna uymuyor** — stop-and-wait
ACK/NAK oturumlu bir dosya transferi, motorun 15 yönteminden hiçbiri bu
şekli karşılamıyor, üçü de sıfırdan. İki somut yeniden-kullanım noktası
VAR: `CRC16_XMODEM` zaten `crcCatalogue.ts`de kayıtlı (fixture:
`0x31c3n`, `crcEngine.test.ts:31`); checksum modu SUM-8 (`(Σ byte) mod
256`) — `simpleChecksums.ts`/`algorithmCatalogue.ts`de muhtemelen zaten var,
uygulama turunda adı doğrulanmalı. **Spec XMODEM için HESAPLANMIŞ bir
checksum fixture'ı VERMİYOR** (yalnız sembolik `CHECKSUM` yazıyor) — dalga6
emsali gibi (*"sentetik çerçevenin CRC/checksum'ı motordan bağımsız
hesapla kanıtlanır"*) sentetik bir 128 baytlık payload için checksum'ı
bağımsız hesaplayıp kanıtlamak gerekecek.

**XMODEM+YMODEM paylaşılan modül adayı** (`canClassic.ts`/`ethernet.ts`
emsali — tek `parse` fonksiyonu, N plugin): YMODEM = XMODEM + Block-0
metadata (dosya adı/boyut/zaman) + batch oturum. **ZMODEM AYRI kalmalı** —
wire seviyesinde XMODEM/YMODEM'le HİÇBİR ortak yanı yok, kendi frame
adları (ZRQINIT/ZRINIT/ZFILE/ZRPOS/ZDATA/ZEOF/ZFIN), kanonik tek bir
ZMODEM tanımı yok (katalog kaydının kendi notu + spec'in "Dikkat çekenler
#9"u bunu ayrıca doğruluyor).

## Karar gereken tek gerçek çatal: 4 "jenerik" sayfa

`custom-binary-protocol` / `ascii-protocol` / `delimiter-based-protocol` /
`length-based-protocol` — dördü de tek bir sabit spec'i olan protokol
DEĞİL, kullanıcı tanımlı bir SINIF (hepsi `definitions: ['custom-schema']`
taşıyor). Alan çözme/kodlama motoru Faz 7'de ZATEN yazıldı
(`protocol-core/schemas/protocolSchema.ts` + `decoding/schemaParser.ts` +
`encoding/schemaEncoder.ts`, Protocol Studio'yu besliyor) ve çerçeve kesme
motoru (yukarıdaki 15 yöntem) da hazır — teoride bu dört sayfa "motor yaz"
değil "iki hazır motoru bağla" işi.

**Ama:** `ProtocolSchema.framing` kendi DAR tipini kullanıyor —
`'startEnd' | 'startOnly' | 'fixedLength' | 'lengthField' | 'none'`, yalnız
5 tür — `FramingMethodId`e (15 tür) hiç referans vermiyor: COBS yok, SLIP
yok, escape-based/byte-stuffing yok, timeout tabanlı yok, bit-stuffing yok.
`delimiter-based-protocol`ın kendi `tools` listesi ("Escape Rule Editor",
"Byte Stuffing View") tam da `ProtocolFramingSchema`nın İFADE EDEMEDİĞİ bir
şey vaat ediyor. Repo'da bunu çözen hiçbir şey yok — gerçek bir karar
noktası, varsayılmadı.

**Seçenekler** (aşağıda kullanıcıya soruluyor):
- **(a) `ProtocolFramingSchema`yı genişlet** — `FramingMethodConfig`in
  geri kalan 10 türünü de kapsasın, tek şema iki motoru da sürsün. Doğrusu
  ama `ProtocolSchema` şu an Protocol Studio'nun ÜZERİNE oturduğu tip —
  değiştirmek o özelliği de dolaylı etkiler, gözden geçirme ister.
- **(b) İkisini AYRI tut** — bu dört plugin `schema.framing`i hiç
  KULLANMAZ, çerçeve kesme için doğrudan `createExtractorFromConfig`
  çağırır (kullanıcı hangi yöntemi seçtiyse), alan çözme için
  `schemaParser`/`schemaEncoder`i (yalnız `ProtocolFieldSchema[]`, framing
  kısmı yok sayılır) kullanır. Küçük, geri dönüşü kolay, ama iki ayrı
  "protokol tanımı" kavramı kullanıcıya nasıl gösterilir (`definitions`
  sekmesinde tek bir JSON şeması mı, iki ayrı form mu) belirsiz kalır.
- **(c) Bu dördünü ERTELE**, önce Encapsulation/Data-Transfer alt
  ailelerini bitir — motor tarafında hiçbir belirsizlik yok, en hızlı somut
  ilerleme oradan gelir; jenerik sayfalar kendi turunu (ya da (a)'nın
  gerektirdiği Protocol Studio gözden geçirmesini) bekler.

## Sıralama önerisi (motor-hazırlık sırasına göre, en ucuzdan en pahalıya)

- **10a — SLIP + COBS.** Sıfır yeni ayrıştırma mantığı, yalnız
  `ProtocolPlugin` sarmalı + örnek çerçeveler + e2e. En ucuz, deseni
  kanıtlar (framing motorunu DOĞRUDAN bir protokol sayfasına bağlamanın
  ilk örneği — `at-commands` bile kendi `createAtLineExtractor`ını
  sarmalamıştı, bu ikisi daha da ince).
- **10b — KISS + PPP.** Çerçeveleme SLIP/hdlc-flag'ten AYNEN miras, ama
  gerçek bir çözme katmanı ister (KISS: Command/Port baytı + AX.25'e
  devir — AX.25 hiç yok, v1 ham kalabilir; PPP: Protocol-field demux + LCP
  müzakere durum makinesi, bu ikisinin en incelikli parçası).
- **10c — HDLC + SDLC.** Paylaşılan modül adayı (I/S/U sınıflandırma + FCS
  + bit-stuffing bağlama kararı ikisi için ortak), SDLC yalnız istasyon/
  poll-final modelini üstüne ekler. `'live'` sekmesi kasıtlı yok (bit-senkron
  yakalama donanımı ister).
- **10d — XMODEM + YMODEM (paylaşılan modül) → ZMODEM (ayrı).** Sıfırdan
  oturum/ACK-NAK/checksum-CRC state machine; sentetik fixture'ı bağımsız
  hesapla kanıtlamak gerekiyor (spec vermiyor).
- **10e — 4 jenerik sayfa.** Yukarıdaki karar VERİLMEDEN başlanmaz.

## Tuzaklar

- **`bit-stuffing` `createExtractorFromConfig`e YAZILAMAZ** — bilerek
  dışarıda, `FrameExtractor` sözleşmesine uymuyor. HDLC/SDLC'de bu yolu
  seçersen doğrudan `bitStuffing.ts`in `stuffBits`/`destuffBits`ını çağır.
- **XMODEM checksum fixture'ı spec'te YOK** — sembolik. Uydurmadan, sentetik
  payload için bağımsız hesapla, dalga6'nın UBX emsaliyle aynı disiplin.
- **ZMODEM'i XMODEM/YMODEM'in üçüncü üyesi SANMA** — wire formatı tamamen
  ayrı, paylaşılan modüle SOKMA (katalog kaydının kendi notu + spec'in
  "Dikkat çekenler #9"u ikisi de bunu doğruluyor).
- **`ubx`/`rtcm` alias kayıtlarının `status: 'planned'` taşıması** —
  `aliasOf` olan bir kayıtta `status`/`pluginId` YAZILMAMASI beklenirdi
  (`at-commands`/`hayes-command-set` gibi diğer emsallerde alias yok, bu
  yüzden karşılaştırma net değil); bu dalganın kapsamı dışında ama
  ileride dokunulursa önce bu tutarsızlık ayrıca sorulmalı.

## Öneri

**10a'yı (SLIP + COBS) başlat** — en düşük risk, framing-motorunu-doğrudan-
bağlama desenini kanıtlar, 10b/10c'nin üstüne oturacağı temeli kurar. 4
jenerik sayfanın karar noktası (yukarı) 10a'dan bağımsız, ayrı sorulabilir.
Model önerisi: **Sonnet · high** (mimari fork yok bu alt-dalgada — motor
zaten var, yalnız sarmalama — ama SLIP/COBS'un "hiç" belirsizliği yok
diye Sonnet·medium'a da inilebilir; KISS/PPP'ye geçince LCP state machine
nedeniyle high'a çık).

## 10a — UYGULANDI (2026-08-21)

`src/protocols/serial/framing/slip.ts` + `cobs.ts` (yeni) — ikisi de
`protocol-core/framing`in ilgili modülünü (Faz 6) İÇERİDEN çağırıp sonucu
`ParsedField`a çeviren ince `ProtocolPlugin` sarmalı, karar VERİLDİ notuyla
birebir: "motor zaten kesiyor VE çözüyor, yeni bir ayrıştırma algoritması
YOK." Paylaşılan `framingErrorMapping.ts` (yeni) — `FramingErrorCode` →
`ProtocolErrorCode` köprüsü, yalnız SLIP/COBS'un ürettiği kodlarla sınırlı
(HDLC/SDLC/PPP/KISS gelince genişler).

**Motorun döndürmediği, yalnız GÖSTERİM için eklenen iki şey:**
- SLIP: `findEscapeEvents` — her kaçış çiftinin (`0xDB 0xDC`/`0xDB 0xDD`)
  ORİJİNAL bayt konumunu işaretler, `SLIP_ESCAPE_RULE.substitutions`in
  TERSİNİ alarak (kod tekrar yazılmadı, veri yeniden kullanıldı).
  `slipExtractor` zaten doğruladığı için bu yürüyüş kendi doğrulamasını
  TEKRARLAMAZ, yalnız `status:'complete'` sonrası çağrılır.
- COBS: `findCodeByteEvents` — her kod baytının konumunu + taşıdığı blok
  uzunluğunu (+ 0xFF taşırma bloğu / sıfır-geri-gelme ayrımını) işaretler,
  aynı disiplin.

**Encoder de eklendi** (`encoder: {encode: encodeSlip}` / `encodeCobsFrame`)
— `'build'` sekmesi bunu henüz OKUMUYOR (ProtocolPage'de jenerik bir
BuildPanel yok, yalnız `decode` sekmesi `plugin.parser`ı okuyor) ama
fonksiyon gerçek ve test edilmiş (round-trip testleri var); ileride bu
sekme geldiğinde SLIP/COBS hazır olacak.

**COBS'un `documentation.references`i YOK** — RFC'si yok (Cheshire & Baker,
IEEE/ACM ToN 1999), doğrulanmış kalıcı bir URL elde edilemedi, uydurulmadı.
SLIP RFC 1055'i kaynak gösteriyor (`rfc-editor.org/rfc/rfc1055`, kanonik
IETF arşiv biçimi).

**Test sırasında yakalanan bir bug:** `index.test.ts`in "loads the real
plugin behind each id" testi tam paket koşusunda (worker rekabeti altında)
5000ms varsayılan zaman aşımına yaklaşıyordu (izolasyonda <500ms) — kayıt
53→55 büyüyünce eşiği aştı. Zaman aşımı 15000ms'ye çekildi; bu test her
yeni dalgada BÜYÜMEYE devam edecek (sıralı N `import()`), ileride tekrar
gündeme gelebilir.

Katalog: `slip`/`cobs` → `status: 'ready'`, `pluginId` verildi. Registry
53 → 55. Bekçiler: `slip.test.ts` (14 test) + `cobs.test.ts` (15 test),
`e2e/slip-decode.spec.ts` + `e2e/cobs-decode.spec.ts` (5+5 test).
`tr.ts`/`en.ts` tam.

Doğrulama: `npm run typecheck` temiz, `npm test` 3168/3168, `npm run
test:e2e` 472/472. Tarayıcıda elle açıldı (decode + overview sekmeleri,
her ikisi de): Hazır rozeti, hex viewer bayt aralıklarını doğru
renklendiriyor, kod baytı/kaçış olayı alanları doğru konumda, overview'da
5 `tools`un 5'i de listeli, konsol hatasız.

## 10b — UYGULANDI (2026-08-21)

`src/protocols/serial/framing/kiss.ts` + `ppp.ts` (yeni) — 10a'nın aynı
ilkesiyle: `slipExtractor`/`hdlcFlagExtractor`i (Faz 6) İÇERİDEN çağırıp
sonucu `ParsedField`a çeviren ince `ProtocolPlugin` sarmalı, YENİ bir
çerçeveleme algoritması yazılmadı. Ama 10a'dan farklı olarak ikisi de
çözülmüş içeriğin KENDİ yapısını çözüyor (10a'da tek bir "Decoded Payload"
alanıydı, burada birden çok adlanmış alt-alan var):

- **KISS**: `slipExtractor`i (SLIP'in AYNISI — FEND/FESC/TFEND/TFESC)
  kullanıyor. İlk çözülmüş bayt "Type Indicator" (port yarım baytı + komut
  yarım baytı) olarak adlanıyor; TXDELAY/SlotTime/TXtail 10ms biriminden
  ms'ye çevriliyor, FullDuplex/Persistence/SetHardware adlanıyor, 0xFF
  Return sentinel'i ayrı ele alınıyor. Data Frame'in payload'ı (AX.25) v1'de
  HAM — brief'in kendi kararıyla birebir.
- **PPP**: `hdlcFlagExtractor`i (PPP'nin AYNISI — Flag/Escape/XOR 0x20)
  kullanıyor. Address/Control içerikten algılanıyor (0xFF 0x03 varsa
  standart, yoksa ACFC varsayılıyor — DALI'nin 1/2/3-bayt biçim algılama
  emsaliyle aynı disiplin), Protocol field RFC 1661 §2'nin LSB-tek/çift
  kuralıyla PFC algılanarak demux ediliyor. Protocol=LCP (0xC021) olduğunda
  Code/Identifier/Length + Configure-*'ın seçenek TLV zinciri (MRU/ACCM/
  Auth-Protocol/Magic-Number/PFC/ACFC, RFC 1661 §6) çözülüyor; bilinmeyen
  seçenek türü ve bozuk (truncated) zincir uyarıyla ham gösteriliyor,
  çökmüyor.

**Motorun döndürmediği, yalnız GÖSTERİM için eklenen ortak bir mekanizma:**
her iki dosyada da `mapDecodedPositions`/`decodedRangeToWire` (ve onu saran
`buildField`) — çözülmüş herhangi bir bayt ARALIĞININ (Address, Protocol,
LCP Length, bir seçenek…) tel (escaped) konumunu/uzunluğunu hesaplıyor.
10a'nın tek-olaylık `findEscapeEvents`i (SLIP'in `substitutions` tersi,
KISS'te AYNI kopyalanmıştı) YETMEZDİ — PPP'de BİRDEN ÇOK çözülmüş baytı
kapsayan alanlar var (ör. Magic-Number seçeneği 4 bayt) ve Magic-Number
RASTGELE bir değer olduğu için çoğu gerçek çerçevede en az bir kaçış
bekleniyor; bu yüzden byte-viewer'ın DOĞRU vurgulaması için bu genel eşleme
şart görüldü, kısayol yapılmadı. PPP'nin kaçış tersi SLIP'ten FARKLI: XOR
kendi tersidir (`escaped XOR 0x20`), `substitutions` haritası yok —
`escaping.ts` doğrudan okunarak doğrulandı, tersine göre "geçersiz kaçış"
(`invalid-escape`) PPP için YAPISAL OLARAK İMKANSIZ (XOR total bir işlem);
yalnız kaçış baytının hemen ardından veri kesilmesi (`truncated-frame`)
mümkün — testler buna göre yazıldı, imkansız bir hata kodu için sahte test
YAZILMADI.

**FCS (PPP) — ayrılır, DOĞRULANMAZ:** LCP dalında Length alanı bittikten
sonra kalan bayt `'fcs'` alanında gösterilir ama CRC16/X25 ile
karşılaştırılmaz — motor var (`crcCatalogue.ts`) ama bağımsız doğrulanmış
bir PPP FCS fixture'ı elde yoktu, uydurulmadı (XMODEM checksum'ın 10a
öncesi aynı gerekçesi, CLAUDE.md fixture disiplini). Non-LCP protokoller
(IPv4 vb.) için Information hiç bölünmez — PPP başlığında bir uzunluk alanı
yok, FCS'i payload'dan ayırmanın güvenilir bir yolu yok. "Negotiation
Timeline" (çok çerçeveli LCP oturumu) ve KISS'in "AX.25 Chain Decode"'u
aynı disiplinle ERTELENDİ — COBS'un kendi "COBS + CRC Pipeline"
ertelemesiyle birebir (katalogdaki `tools` listesi ASPİRASYONEL, o dalganın
hepsini kapsaması gerekmiyor).

Katalog: `ppp`/`kiss` → `status: 'ready'`, `pluginId` verildi. Registry
55 → 57. Bekçiler: `kiss.test.ts` (17 test) + `ppp.test.ts` (21 test — LCP
Configure-Ack/Reject/Protocol-Reject, bozuk seçenek zinciri, ACFC/PFC,
kaçışlı Information dahil), `e2e/kiss-decode.spec.ts` + `e2e/ppp-decode.spec.ts`.
`tr.ts`/`en.ts` tam (KISS 12, PPP 14 yeni anahtar — PPP'nin 3 fazla hata/
uyarı kodu: `noProtocolField`/`unknownLcpOption`/`malformedLcpOptions`).

Doğrulama: `npm run typecheck` temiz, `npm test` 3206/3206.

## 10c — UYGULANDI (2026-08-21)

`src/protocols/serial/framing/hdlcCore.ts` (yeni, PAYLAŞILAN çekirdek) +
`hdlc.ts` + `sdlc.ts` (ince sarmallar) — 10a/10b'nin aksine GERÇEK yeni iş:
FCS + I/S/U çerçeve sınıflandırması motorda hiç yoktu, burada yazıldı.

**Çerçeveleme kararı (brief'in "bit-stuffing bağlama kararı" diye
işaretlediği açık uç) — `hdlcFlagExtractor` (PPP'nin/dalga 10b'nin motoru)
KULLANILMADI, YANLIŞ araç olduğu için:** o motor `0x7D`'yi kaçış baytı
sayıp XOR çözer (async HDLC/PPP kuralı), ama gerçek bit-senkron HDLC/
SDLC'de bayt-seviyeli kaçış hiç YOK (bit-stuffing yalnız 5 ardışık `1`
bitini hedefler) — kullansaydık rastgele bir Address/Control/Info baytını
bozardık. `bitStuffing.ts` da uygun değildi (`BitStream` alır, bayt
arabelleği değil — bilerek `FrameExtractor` DEĞİL, log/import ayrı bir yol
için). Seçilen yol: decode sekmesinin girdisi (hex yapıştırma) spec'in
kendi ayrımıyla (`02-framing-protokolleri.md` satır 163-164) zaten
"Logical Frame" — bit-stuffing gerçek donanımda/sürücüde temizlenmiş
sayılır. Bu yüzden KAÇIŞSIZ `createBoundedDelimiterExtractor`
(`delimiterFraming.ts`, zaten var, start=end=0x7E) doğrudan kullanıldı —
`framingErrorMapping.ts`e `'no-sync' → 'start-delimiter-not-found'`
eşlemesi eklendi (bu motorun ürettiği, daha önce hiç eşlenmemiş bir kod).

**Test sırasında yakalanan bir varsayım hatası (benim, kod bugu DEĞİL):**
`createBoundedDelimiterExtractor`, `createEscapedDelimiterExtractor`den
(SLIP/PPP/KISS'in motoru) FARKLI davranıyor — art arda iki delimiter'ı
(`7E 7E`) HATA saymıyor, boş bir `frame` ile `'complete'` dönüyor
(`delimiterFraming.ts:90`). İlk yazdığım test bunun tersini varsaymıştı,
BAŞARISIZ oldu, düzeltildi (`hdlcCore.test.ts`). Gerçek güvenlik ağı motor
DEĞİL — `hdlc.ts`/`sdlc.ts`in kendi `MIN_CONTENT_LENGTH` (4 bayt: Address+
Control+FCS) kontrolü.

**Control field — ISO 13239/Q.921 TEMEL/modulo-8 mod seçildi** (spec bit
pozisyonlarını "profile-bağımlı" diye kasıtlı açık bırakıyor, PPP'nin RFC
1662 varsayılanı seçmesiyle aynı disiplin): bit0=0→I-frame, bit0-1=01→
S-frame (RR/REJ/RNR/SREJ adlanır), bit0-1=11→U-frame. **U-frame KOMUT
adları (SABM/DISC/UA/FRMR vb.) BİLEREK adlanmadı** — repoda doğrulanmış
bir bit-deseni↔ad tablosu yok, ezberden uydurmak yanlış ad basma riski
taşır (LCP 12+/KISS persistence formülünün aynı disiplini, dalga 10b);
yalnız format + P/F gösterilir.

**FCS — HESAPLANIR VE DOĞRULANIR** (PPP'nin (10b) fixture'sızlıkla
ERTELEMESİNİN AKSİNE): `CRC16_X25`, `bacnetmstp.ts`/`zigbee.ts`in PASS/FAIL
deseniyle birebir. Fixture: `crcEngine.test.ts`teki doğrulanmış check değeri
(`"123456789"` → `0x906E`) + bu dalganın örnek/test çerçeveleri motorun
KENDİSİYLE (`computeNamedCrc`) hesaplanır — `bacnetmstp.test.ts`in "motorun
kendi hesabından bağımsız" gerekçesiyle aynı: `crcCatalogue` ayrıca
doğrulanmış, test edilen şey bayt sınırları (offset/uzunluk), CRC
algoritmasının kendisi değil.

Katalog: `hdlc`/`sdlc` → `status: 'ready'`, `pluginId` verildi. Registry
57 → 59. Bekçiler: `hdlcCore.test.ts` (14, çekirdek bit-aritmetiği) +
`hdlc.test.ts` (16) + `sdlc.test.ts` (14) + `e2e/hdlc-decode.spec.ts` +
`e2e/sdlc-decode.spec.ts`. `tr.ts`/`en.ts` tam (HDLC 13, SDLC 13 yeni
anahtar).

Doğrulama: `npm run typecheck` temiz, `npm test` 3250/3250, `npm run
test:e2e` 492/492, `npm run build` temiz. Tarayıcıda elle açıldı (decode +
overview, HDLC+SDLC), FCS PASS gösterimi ve Station Address broadcast
notu doğru, konsol hatasız.

## 10d/1 — XMODEM + YMODEM UYGULANDI, ZMODEM AYRI TUTULDU (2026-08-21)

`src/protocols/serial/framing/xmodemCore.ts` (yeni, PAYLAŞILAN çekirdek —
XMODEM+YMODEM'in blok yapısı birebir aynı, brief'in kendi önerisi) +
`xmodem.ts` + `ymodem.ts` (ince sarmallar). 10a/10b/10c'nin HİÇBİRİNE
benzemez: framing motoruna (Faz 6) hiç UĞRAMAZ, hiçbir `createExtractor*`
çağrısı YOK — çerçeve sınırı Header baytının (SOH/STX) taşıdığı SABİT veri
uzunluğundan (128/1024) türetilir, delimiter/length-field yok.

**Uygulama öncesi ayrı bir keşif turu yapıldı** (kullanıcı "brief hazır mı"
diye sordu) — `docs/spec/ozet/02-framing-protokolleri.md`nin XMODEM/YMODEM/
ZMODEM bölümleri (234-287) okundu, NET/BELİRSİZ ayrımı çıkarıldı:

- **NET:** XMODEM'in tam blok yapısı (`Header Block ~Block Data Trailer`),
  checksum formülü (`SUM-8`), CRC-mod el sıkışması (`Receiver→C`), kontrol
  baytları (SOH/EOT/ACK/NAK/CAN), retry akışı. Checksum motorları
  (`sum8Checksum` + `CRC16_XMODEM`) KODDA ZATEN vardı, test fixture'lı
  (`crcEngine.test.ts` `"123456789"→0x31C3`) — sıfırdan yazılmadı, yalnız
  kablolandı.
- **BELİRSİZ (spec'te yok, genel/evrensel XMODEM-YMODEM konvansiyonundan
  dolduruldu, UYDURULMADI):** checksum-modu el sıkışması (spec yalnız
  CRC-modunu belgeliyor — bu yüzden decode tek çerçeve aldığı için el
  sıkışma baytına HİÇ bakılmadı, mod ÇERÇEVE UZUNLUĞUNDAN türetildi:
  1 baytlık trailer→checksum, 2 baytlık→CRC); STX(0x02)'nin 1024-baytlık
  bloğu işaretlemesi (evrensel XMODEM-1K konvansiyonu); YMODEM Block 0'ın
  filename+filesize encoding'i (ASCII, NUL/boşluk ayraçlı — bu iki alan
  ÇÖZÜLDÜ, ama mtime/mode/serial alanlarının genişliği/tabanı (octal mi
  decimal mi) spec'te YOK ve gerçek YMODEM implementasyonları arasında da
  TUTARSIZ — bu yüzden ÇÖZÜLMEDİ, `metadata-remainder` alanında ham+dürüst
  notla bırakıldı, ezberden formatı uydurmak yanlış değer basma riski
  taşırdı).

**CRC bayt sırası — BÜYÜK-UÇLU, HDLC'nin (10c) KÜÇÜK-UÇLU FCS'inin TAM
TERSİ:** `CRC16_XMODEM` `refin=false/refout=false` (yansıtılmamış) —
`CRC16_X25`nin (`refin=true/refout=true`) tam tersi profil, CRC teorisinin
standart eşleşmesi (yansıtılmamış CRC'ler geleneksel olarak büyük-uçlu
iletilir). Bu ayrım testte (`xmodemCore.test.ts`) AÇIKÇA doğrulandı.

**Session/batch takibi YOK** (kullanıcı "ayrı yapalım" dedi, ZMODEM'in yanı
sıra bu da bilinçli bir sınır) — `ProtocolParser.parse()` tek bir blok/
kontrol baytını saf/stateless çözer, canlı oturum durumu (kaç dosya, hangi
sırada) tutmaz — PPP'nin (10b) LCP oturum takibini ERTELEMESİYLE aynı
disiplin. "Transfer Session View"/"Batch Session Tree"/"ACK-NAK Timeline"
katalog `tools` listesinde kalır ama bu dalgada YOK.

Katalog: `xmodem`/`ymodem` → `status: 'ready'`, `pluginId` verildi.
Registry 59 → 61. Bekçiler: `xmodemCore.test.ts` (paylaşılan çekirdek,
kontrol baytları + blok çözümü + round-trip) + `xmodem.test.ts` +
`ymodem.test.ts` (44 test toplam) + `e2e/xmodem-decode.spec.ts` +
`e2e/ymodem-decode.spec.ts`. `tr.ts`/`en.ts` tam (XMODEM 14, YMODEM 14 yeni
anahtar).

Doğrulama: `npm run typecheck` temiz, `npm test` 3294/3294, `npm run
test:e2e` 502/502, `npm run build` temiz. Tarayıcıda elle açıldı
(screenshot + görsel inceleme) — Block 0'ın filename/filesize/metadata-
remainder gösterimi ve PASS rozetleri doğru, konsol hatasız.

**10d/2 (ZMODEM) — commit'lendi (c3c6e51, 2026-08-21):** kanonik tek tanım
yoktu, çözüm önce kullanıcıya profil sorusu olarak sunuldu —
AskUserQuestion'la **lrzsz profili** seçildi (3 seçenek: lrzsz tam
bit-seviyesi / spec-literal minimal / ertele — kullanıcı ilkini seçti).
Projenin kendi speci ZMODEM'de SIFIR bit-detay veriyordu (yalnız 7 frame
adı + state machine + resume örneği) — tüm sabitler dış kaynaktan:
Forsberg'in `zmodem.txt`si (Rev Oct-14-88) + `zmodem.h` (İKİ bağımsız
mirror, stuff.mit.edu 1987 + coderfordev/rzsz 1993, birebir aynı
`#define`ler) + `zm.c`/`crctab.c` (CRC init/tel-sırası kaynak koddan).

`src/protocols/serial/framing/zmodemCore.ts` (yeni, kendi çekirdeği —
XMODEM'inkiyle wire seviyesinde HİÇ ortak yanı yok) + `zmodem.ts` (ince
sarmal). ZDLE'den sonraki bayt ÜÇ ayrı anlam taşıdığından (XOR-kaçış /
ZRUB0-1 literal / ZCRCE-G-Q-W terminatör) `escaping.ts`nin jenerik motoru
KULLANILMADI (HDLC'nin `hdlcFlagExtractor`i reddetmesiyle aynı gerekçe
kalıbı, dalga 10c).

**CRC16 parametreleri (poly 0x1021, init 0x0000) kaynakta AÇIK yazmıyordu
— DOLAYLI ama sağlam kanıtla türetildi:** `zm.c`nin residue-check
yöntemi CRC32 için `if (crc != 0xDEBB20E3)` (init≠0 → residue sıfırDIŞI,
spec'in "-1 preset, inversion" notuyla uyumlu), CRC16 için
`if (crc & 0xFFFF)` (residue SIFIR bekliyor) — aynı matematiksel
zorunluluk ters yönde CRC16'nın init'inin 0 olduğunu kanıtlıyor. Sonuç:
mevcut `CRC16_XMODEM` kaydıyla BİREBİR aynı, ayrı katalog kaydı AÇILMADI.

**Kapsam dışı (dosya başı yorumlarında gerekçeli, uydurulmadı):** RLE'li
header varyantları (ZBINR32/ZVBIN/ZVHEX/ZVBIN32/ZVBINR32 — yalnız rzsz'nin
1993 header'ında, 1988 taban specinde yok); ZFILE'ın ZF0-ZF2 option
baytları (Conversion/Management/Transport — enum değerleri kaynaktan
doğrulanmadı, ham gösterilir, YMODEM'in mtime/mode ertelemesiyle aynı
disiplin); session/batch takibi (kullanıcının kendi "ayrı yapalım"
kararıyla zaten dalga 10d/1'de sınırlanmıştı).

Doğrulama: `npm run typecheck` temiz, `npm test` 3322/3322, `npm run
test:e2e` 508/508 (tam paket, build dahil). Tarayıcıda elle açıldı (4
örnek — ZRQINIT/ZRINIT/ZFILE/ZDATA, screenshot + görsel inceleme), PASS
rozetleri + hex viewer renk hizası doğru, konsol hatasız.

**Sonra 10e** — 4 "jenerik" sayfanın mimari kararı (`ProtocolFramingSchema`
vs `FramingMethodConfig`, brief'te a/b/c) HÂLÂ SORULMADI, dalga 10'un son
açık ucu.
