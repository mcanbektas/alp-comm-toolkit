# BRİF — ALP Comm Toolkit, Reverse Engineering FEATURE fazı (spec §35 + §36)

Bu bir protokol dalgası DEĞİL: plugin eklenmez, katalog sayıları değişmez.
`src/features/` altına yeni bir çalışma alanı (Unknown Protocol Analyzer) açılır.
Dalga 5 keşfi böyle işaret etmişti (`docs/brief-faz10-dalga5.md:42,60-61,361`) —
bu keşif turunda DOĞRULANDI: §35 ana spec 39274'te.

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Son commit `7abc356` (dalga 5e GOOSE + BER walker — dalga 5 tamam).
Sayılar (verildi, bu keşifte yeniden koşulmadı): **2511 birim testi (143 dosya),
36 kayıtlı plugin** (dalga 5 ile eklenenler: dnp3, iec-60870-5-104, m-bus,
ethercat, iec-61850).

Reverse Engineering'in bugünkü ayak izi — hepsi doğrulandı:

- `src/features/reverse-engineering/` **YOK**. Mevcut feature'lar: calculators,
  live-monitor, packet-builder, projects, protocol-decode, protocol-definitions,
  protocol-studio.
- Router'da rota **YOK** (`src/app/router/AppRouter.tsx` rotaları: index,
  `calculators` :60, `calculators/:toolId` :61, `live-monitor` :66 lazy,
  `protocol-studio` :74 lazy, `packet-builder` :82 lazy + domain/family/protocol
  yakalayıcıları). Sayfa yok, çeviri anahtarı yok (`grep -i reverse` →
  src/app + src/pages + src/translations boş). "Planlandı" basan bir iskelet
  bile yok — sayfa sıfırdan açılacak.
- Worker tarafında tek örnek var: `src/workers/streamParser.worker.ts`. Spec
  RE için AYRI worker ister (`reverse-engineering.worker.ts`, ana spec 37498;
  ozet/10:133).
- Bekçi borcu **YOK**: plugin/katalog eklenmediği için `src/tests/catalog.test.ts`
  ve `src/protocols/index.test.ts` bekçileri bu fazdan etkilenmez.

## Spec kapsam analizi (ana spec 42 975 satır; satırlar doğrulandı)

§35 "Bilinmeyen protokol analizi" (39274-39316) kısa ve formül odaklı; özeti
`docs/spec/ozet/10-uygulama-spec.md:890-899`.

| Satır | İçerik | Not |
|---|---|---|
| 39274 | `# 35. Bilinmeyen protokol analizi` başlığı | |
| 39276 | "Unknown Protocol Analyzer geliştir." | tek cümlelik görev tanımı |
| 39280-39292 | **13 özellik maddesi:** sabit byte tespiti · değişen byte tespiti · sayaç tespiti · uzunluk alanı tespiti · checksum tahmini · CRC tahmini · timestamp tahmini · ASCII alanı tespiti · endianness tahmini · entropy analizi · mesaj kümelendirme · periyot analizi · korelasyon analizi | kapsamın TAMAMI bu liste; alt ayrıntı yok |
| 39294-39299 | Formül 1 — ChangeRate_i = Count(Byte_i(t) ≠ Byte_i(t-1)) / (N−1) | sütun bazlı |
| 39301-39304 | Formül 2 — Entropy H(X) = −Σ p(x)·log2 p(x) | |
| 39306-39309 | Formül 3 — Counter: Delta_t = Value_t − Value_(t−1) | genişlik/endian spec'te YOK → karar 5 |
| 39311-39316 | Formül 4 — Checksum Match Rate = Matching/Total × 100 | çok-çerçeve şartını ima eder |

İlişkili spec bölgeleri (kapsam çizgisini bunlar tamamlar):

| Satır | İçerik | Durum |
|---|---|---|
| 39320-39355 | **§36 Message Difference Analyzer**: değişen byte/bit, XOR/decimal/signed diff, sabit alan, muhtemel sayaç/CRC/payload, korelasyon (39326-39335); `AA 01 10 04 25…` / `AA 01 10 04 2A…` örneği + beklenen çıktı (39339-39353) | RE ile aynı girdi seti — karar 1: bu faza dahil mi |
| 39769-39778 | §45 V1.5 "İleri analiz": Unknown Protocol Analyzer, CRC Finder, Message clustering, Automatic field detection (+ Protocol Converter / TA / code gen / doc gen — AYRI işler) | RE fazı ilk dördü kapatır |
| 39845-39849 | §46 Phase 10 satırı: "Reverse engineering" | bu faz o satırın 3. kalemi |
| 40013 | Revize ana sayfa kategorisi 15: "Protocol Reverse Engineering — Unknown Protocol Analyzer, field detection, counter tespiti, CRC Finder, clustering, entropy/değişken byte analizi" | UI'nin vaadi bu cümle |
| 40059-40063 | Revize ana sayfa yerleşimi: ANALYSIS & TEST bloğu → Log & Capture Analyzer · **Protocol Reverse Engineering** · Test & Simulation | |
| 37489, 37498 | Klasör şartı: `features/reverse-engineering/` + `workers/reverse-engineering.worker.ts` | ozet/10:124,133 aynı |
| 16283-16316 | HDLC RE örneği: Fixed/Changing/Counter/Possible checksum/Possible CRC/Periodic fields + **bilinen sensör değeriyle sayısal korelasyon** (gyro Heading 90° → `23 28`, 100° → `27 10`) | korelasyon girdisi = kullanıcının verdiği değer serisi; ozet/05:272,378 "candidate" etiketi muhafazakâr kalır |
| 35060-35090 | RF telemetri örneği: 3 paket `AA AA 10 00 [ctr] [cs cs]` → Bytes 0-1 Constant, Byte 4 Monotonic counter candidate, Bytes 5-6 Possible checksum/CRC | **hazır fixture**; ozet/09:175 aynı heuristik |
| 39270 | §34 sonu: "Tablolar sanallaştırılmalıdır." | RE çerçeve tablosu için de geçerli |
| 39680-39692 | §44 performans: 100k satır dondurmaz, ağır analiz Worker'da, iptal edilebilir, progress göstergesi, tablolar virtualized | RE'nin zorunlu çerçevesi |
| 39606-39679 | §43 test gereksinimleri | **RE fixture'ı YOK** — fixture kaynağı spec'in kendi örnekleri (35060, 39339-39353, 16283) |

Spec'in vermediği (uydurulmayacak, karar ya da tasarım notu olacak): kümeleme
algoritması, sayaç genişlik/endian adayları, timestamp kodlamaları, uzunluk
alanı arama yöntemi, eşik değerleri (ör. "sabit" saymak için ChangeRate eşiği).

## Hazır parçalar (İNCELENDİ)

**1) `src/protocol-core/checksums/checksumFinder.ts` — CRC Finder çekirdeği ZATEN VAR.**
`findChecksumMatches({ dataHex, expectedHex })` (:81): TEK veri+beklenen-değer
çifti alır; `crcCatalogue.ts:13-33`'teki 19 adlı CRC'yi (CRC8 aileleri,
CRC16_MODBUS/CCITT_FALSE/XMODEM/X25/DNP/ARC, CRC24/Q, CRC32/C, CRC64) ve 9 basit
algoritmayı (XOR8…adler32; NMEA XOR bilerek dışarıda — string tabanlı, :45)
dener; genişlik eşleşmesi zorunlu, bayt sırası normal+swapped (:86-105).
Çeviri özeti "27 algoritma (18 CRC + 9 basit)" der (tr.ts:322) — CRC4/5/6/7
bayta bölünmeyen genişlikte olduğundan pratikte hiç eşleşemez (:93-94 yorumu),
sayım farkı bundan.
**Karşıladığı:** §35 "Checksum tahmini + CRC tahmini" maddelerinin algoritma
çekirdeği. **Karşılamadığı:** alan KONUMU arama (frame içinde nerede), veri
aralığı taraması (checksum neyin üstünden), çok-çerçeve Match Rate (39311).
RE-b bunları checksumFinder'ı sarmalayarak ekler — algoritma katmanı yeniden
yazılmaz. Calculators'ta UI'si de var: `ChecksumFinderTool.tsx`
(registry.ts:65 `checksum-finder`) — tek-çift kullanım orada kalır.

**2) `src/protocol-core/statistics/`** — signalStatistics (min/max/mean/rms/
stddev :31), commStatistics accumulator, downsampleLttb (grafik), rateMeter.
**Entropi ve Pearson korelasyonu YOK** (src'de `entropy` yalnız
wireless-iot.ts katalog metninde geçiyor) — ikisi de yeni yazılacak.

**3) `src/protocol-core/framing/`** — createExtractor + delimiter/
escapedDelimiter/fixedLength/lengthField/timeout/HDLC/SLIP/COBS/bitStuffing.
RE girdisinin "ham dökümü çerçevelere böl" adımı HAZIR; RE kendi framing kodu
yazmaz, kullanıcıya framing yöntemi seçtirir.

**4) `src/protocol-core/buffers/`** — hex dönüşümleri, endianness okuyucuları,
bitOps. Endianness/sayaç tahmininde okuma yardımcıları hazır.

**5) Worker deseni: `src/workers/streamParser.worker.ts`** — saf
`createWorkerMessageHandler` (Worker global'i olmadan Vitest'te test edilir),
dar `self` declare (WebWorker lib ÇAKIŞMASI gerekçesi dosya başında), mesaj
tipleri init/push/tick/reset/**cancel**. RE worker'ı bu deseni birebir kopyalar.
`connection/mock/simulatedProtocol.ts:191`: postMessage'a giden parçalar
`subarray` değil `slice` — aynı tuzak RE'de de geçerli.

**6) Emsal feature:** **live-monitor en iyi emsal** (worker köprüsü
`useLiveMonitor.ts` + components/ FrameTable·StatisticsPanel + lazy sayfa) —
RE ile aynı iskelet: hook + worker + sanal tablo. packet-builder ikinci emsal
(saf pipeline + screen testleri). log-analyzer diye bir emsal YOK — o feature
da henüz yazılmadı (`plan-fazlar.md:62`), RE ondan girdi bekleyemez.

## UI iskeleti durumu ve eklenecek tel

- Rota: `AppRouter.tsx`'e `reverse-engineering` rotası, **lazy** (mevcut üç lazy
  sayfanın deseni; motorlar + olası grafik ana pakete binmemeli).
- Giriş: `src/components/layout/Sidebar.tsx` (live-monitor linki :81'de) — RE
  linki buraya. HomePage domain kartları katalog kaynaklı; RE bir domain değil,
  Sidebar yeterli (karar 7).
- Sayfa: `src/pages/ReverseEngineeringPage.tsx` (ince sarmalayıcı) +
  `src/features/reverse-engineering/ReverseEngineeringScreen.tsx`.
- Çeviri: tr.ts + en.ts (bugün 1967 anahtar; `re.*` önekiyle).
- e2e: `e2e/` 36 spec dosyalı, `smoke.spec.ts` + `live-monitor.spec.ts` desen;
  `reverse-engineering.spec.ts` eklenir.

## Kapsam bölmesi

### RE-a — Alan analiz motorları (saf TS, UI yok)
`features/reverse-engineering/engine/` (ya da genel olanlar protocol-core'a —
karar 3): byteColumnProfile (sabit/değişen + ChangeRate 39294), entropy (sütun
başına + mesaj geneli, 39301), counterDetect (Delta 39306; genişlik/endian
adayları karar 5), lengthFieldDetect (alan değeri ↔ çerçeve uzunluğu eşleşmesi),
asciiFieldDetect, timestampDetect, endiannessGuess, periodAnalysis (çerçeve
zaman damgası deltaları), correlation (Pearson; alan↔alan ve alan↔kullanıcı
değer serisi — gyro örneği 16283). Fixture: 35060 RF seti + gyro çifti.

### RE-b — Checksum/CRC alan tarayıcısı
`checksumFinder` sarmalayıcısı: aday alan konumu (son 1/2/4 bayt + kullanıcı
aralığı) × veri aralığı (baştan; başlık sonrası) × algoritmalar; N çerçevede
Match Rate (39311) raporu; bütçe + erken çıkış + iptal edilebilir API (worker'a
hazır imza). Algoritma katmanına DOKUNULMAZ.

### RE-c — Kümelendirme + Message Difference (§36)
Mesaj imzası tabanlı kümeleme (karar 4 kapatılmadan başlanmaz); §36 diff motoru:
byte/bit/XOR/decimal/signed fark + muhtemel sayaç/CRC/payload etiketi
(39326-39335). Fixture: §36'nın kendi örneği (39339-39353).

### RE-d — Worker + UI + e2e
`workers/reverseEngineering.worker.ts` (streamParser deseni: analyze/progress/
result/cancel; büyük diziler transfer listesiyle), lazy sayfa + Sidebar linki,
screen + components (girdi paneli: hex yapıştır / dosya içe aktar + framing
seçimi; sanallaştırılmış çerçeve tablosu + sütun renklendirme — sabit/sayaç/
checksum adayları; sonuç panelleri; §36 diff paneli), tr/en çevirileri,
`reverse-engineering.spec.ts` e2e. Sayfa ancak motorlar hazırken açılır
(boş kart yasak — CLAUDE.md).

## Verilmesi gereken kararlar (faz başında sor, kendiliğinden seçme)

1. **§36 dahil mi?** Öneri: dahil (aynı girdi seti, RE-c'de) — değilse ayrı mini faz.
2. **Girdi kaynakları v1:** hex yapıştırma + .txt/.log dosyası + framing seçimi
   mi; live-monitor oturumundan aktarım ve PCAP import bu fazın DIŞINDA mı?
   (log-analyzer feature'ı yok; RE girdisini kendi çözmeli.)
3. **Motorların yeri:** hepsi `features/reverse-engineering/engine/` mi, genel
   amaçlılar (entropy, pearson) `protocol-core/statistics/`e mi?
4. **Kümeleme algoritması:** imza tabanlı (uzunluk + sabit-bayt maskesi) mi,
   gerçek kümeleme (k-means/hiyerarşik) mi? Spec algoritma vermiyor.
5. **Sayaç/timestamp kapsam çizgisi:** hangi genişlik/endian adayları (8/16/32,
   LE/BE, mod-2^n sarma), hangi timestamp kodlamaları (Unix s/ms, monoton)?
6. **Şema köprüsü:** tespit edilen alanlar protocol-studio şemasına akar mı?
   Öneri: bu fazda yalnız JSON taslak dışa aktarımı; studio entegrasyonu sonra.
7. **Erişim:** Sidebar linki yeterli mi, HomePage'e de kart mı?
8. **Değişken uzunluklu çerçeveler:** sütun analizi küme BAŞINA mı (önce
   kümele, sonra analiz et) yoksa ortak-önek üzerinde mi?

## Tuzaklar

- **eval yasağı (CLAUDE.md):** korelasyonun "bilinen sensör değeri" girdisi SAYI
  DİZİSİ olarak alınır; kullanıcı tanımlı formül/ifade alanı bu fazda YOK —
  sandbox'sız yazılamaz. Formül isteği gelirse ayrı karar.
- **100k çerçeve (§44, 39680-39692):** motorlar tek geçişli/artımlı; ağır işler
  worker'da, progress + iptal zorunlu; tablo sanallaştırılır (39270).
- **Kombinatorik patlama (RE-b):** konum × aralık × algoritma × N çerçeve.
  Tarama uzayı sınırlı başlar; Match Rate eşiği altında erken çıkış.
- **postMessage kopyası:** Uint8Array'ler transfer listesiyle; `subarray`
  arabelleği paylaşır — `slice` (simulatedProtocol.ts:191 emsal yorumu).
- **noUncheckedIndexedAccess:** sütun erişimi `bytes[i]` → `number | undefined`,
  guard yaz (CLAUDE.md).
- **Sayısal kenarlar:** entropide p=0 terimi atlanır; N=1'de ChangeRate böleni
  0; sayaç mod-256/65536 sarması "delta sabit" kontrolünü bozar.
- **Fixture uydurma yasak:** §43'te RE fixture'ı yok; fixture = spec'in kendi
  örnekleri (35060 seti, §36 örneği 39339-39353, gyro 16283). Yeni sentetik veri
  gerekiyorsa üretim kuralı testin içinde görünür olmalı.
- **Lazy sınırı:** RE sayfası lazy; motorlar `protocol-core` barrel'ına girerse
  ana pakete binmesin (zod gerekçesiyle aynı — AppRouter.tsx:26-31 yorumu).
- **Makine notu:** 4173 portunu berkin-pms tutuyor; e2e koşarken
  `reuseExistingServer` kapalı, port çakışmasını lsof'la kontrol et.

## Çalışma kuralları
Önceki dalgalarla aynı: motor yazmadan önce `docs/spec/ozet/10-uygulama-spec.md`
§35-36 okunur (CLAUDE.md şartı); yorum Türkçe / tanımlayıcı İngilizce; her motor
fixture'ıyla gelir; keşif subagent'a; commit serbest / push onaylı; 200K'da
oturumu böl. Bu faza özgü: dış kaynak disclosure'ı GEREKMEZ (lisanslı standart
yok; formüller spec'te) — kümeleme gibi spec-dışı algoritma seçimleri dosya başı
JSDoc'ta gerekçelenir. UI alt fazında ekran GERÇEKTEN açılır: varsayılan
girdiyle tarayıcı turu, yeşil test + temiz review yetmez.

## Öneri

| Alt faz | İçerik | Model · effort |
|---|---|---|
| RE-a | alan analiz motorları (9 saf modül) | Sonnet · high |
| RE-b | checksum/CRC alan tarayıcısı | Sonnet · high |
| RE-c | kümeleme + §36 diff | karar 4 kapanırsa Sonnet · high; açık kalırsa **Opus · high** |
| RE-d | worker + UI + e2e | Sonnet · high |

RE-a/b/d **Sonnet · high**: formüller spec'te, desen repoda (streamParser +
live-monitor emsali), ama her birinde eşik/bütçe/hizalama gibi seçilecek birkaç
yol var — medium değil. RE-c'de tek gerçek tasarım riski kümeleme algoritması;
karar faz başında kullanıcıyla kapanırsa Sonnet yeter, "sen seç" kalırsa
ödünleşim tartması Opus işi. Fable gerekmez: muhakeme tavanı isteyen iş yok,
spec keşfi bu brifte bitti.
