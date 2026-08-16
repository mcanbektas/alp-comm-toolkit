# BRİF — ALP Comm Toolkit, ÖZELLİK fazı: Test Automation Studio (spec §38)

## Konum

Depo: `/Users/canbektas/Desktop/alp-comm-toolkit` (yalnız bu depo). Bu bir protokol
dalgası DEĞİL, feature fazıdır — hedef dizin `src/features/test-automation/`
(**şu an YOK**, doğrulandı). Dalga 5 brifi bu fazı ayrı keşif turuna havale
etmişti (`docs/brief-faz10-dalga5.md:58-59` ve karar 1, satır 269-271); bu brif
o turun çıktısıdır.

## Durum

- Son commit `7abc356` — "GOOSE çözümleyicisi + BER walker (Faz 10, dalga 5e) —
  dalga 5 tamam". Çalışma ağacı temiz (doğrulandı).
- 2511 birim testi / 143 dosya, 36 plugin (verili sayılar, yeniden koşulmadı).
  `e2e/` altında 35 Playwright spec (sayıldı).
- `src/features/` bugün 7 feature içeriyor: calculators, live-monitor,
  packet-builder, projects, protocol-decode, protocol-definitions,
  protocol-studio. `test-automation`, `log-analyzer`, `protocol-converter`,
  `reverse-engineering` hiç açılmadı (`docs/plan-fazlar.md:62-63`).
- Kaynak kodda "test-automation" geçen SIFIR satır var (grep, doğrulandı).

## ANA SONUÇ — bu faz şimdi yapılabilir mi?

**EVET, şimdi yapılabilir — bağlantı katmanı fazını beklemek GEREKMİYOR.**
Dalga 5 keşfinin "TA bağlantı katmanına bağımlı" notu doğru ama eksikti; bu tur
bağımlılığı parça parça doğruladı:

| §38 ihtiyacı | Bugünkü karşılığı | Durum |
|---|---|---|
| Connect/Disconnect (seri) | `src/connection/serial/serialSource.ts` (133 satır, gerçek Web Serial) | **VAR** |
| Send frame (TX) | `usePacketBuilder.ts:713` `source.write(bytes)` — packet-builder gerçek porta yazıyor | **VAR (emsal)** |
| Çerçeve üretimi | `src/protocol-core/encoding/schemaEncoder.ts:355` `encodeWithSchema` + `packetPipeline.ts` (framing+checksum zinciri) | **VAR** |
| Wait for frame (RX parse) | `src/workers/streamParser.worker.ts` + live-monitor deseni | **VAR** |
| Validate CRC | `src/protocol-core/checksums/` (Faz 5 motoru) | **VAR** |
| Test edilebilir mock cihaz | `src/connection/mock/simulatedSource.ts:48` **`canWrite: false`** — RX-only, TX'e cevap veremez | **YOK — tek gerçek eksik** |
| USB/BLE/WebSocket/dosya | `src/connection/` altında yok (`plan-fazlar.md:64`) | YOK ama §38 için **GEREKMİYOR** |

Tek gerçek boşluk: simülasyon kaynağı yazma yönünü desteklemiyor, dolayısıyla
senaryo koşusu bugün yalnız gerçek cihazla uçtan uca denenebilir — Playwright'ta
Web Serial yok (`src/connection/types.ts` başlık yorumu bu gerekçeyi zaten
yazıyor). Çözüm ayrı bir bağlantı fazı değil, BU fazın içinde küçük bir iş:
mock'a kural tabanlı istek→yanıt veren, `canWrite: true` bir "simüle cihaz"
kaynağı eklemek. USB/BLE/WebSocket ayrı faz olarak kalır; TA `ByteSource`
sözleşmesine yazıldığı sürece o kaynaklar gelince bedavaya takılır.

## Spec kapsam analizi — §38 satır satır

Ana spec: `docs/spec/ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve
Protokol Geliştirme Platformu.md`. §38 = satır 39399-39442 (sonraki bölüm §39
istatistikler, 39446). Özet kopyası: `docs/spec/ozet/10-uygulama-spec.md:927-944`.

- **39399** başlık: "Test Automation Studio".
- **39401** tek cümlelik gereksinim: kullanıcı haberleşme test senaryoları
  oluşturabilmeli.
- **39405-39417** 13 adım tipi: Connect · Disconnect · Send frame · Wait ·
  Wait for frame · Validate field · Validate CRC · Set variable · Increment
  variable · Loop · Conditional branch · Log result · Export report.
- **39421-39429** örnek senaryo: COM4 115200'e bağlan → status request gönder →
  500 ms bekle → komut 0x31 bekle → CRC doğrula → sıcaklık oku → 85 °C üstünde
  FAIL → 100 kez tekrarla → rapor dışa aktar. (Örnek, ifade dilinin karşılaştırma
  düzeyinde kaldığını gösteriyor — script istemiyor.)
- **39431-39442** rapor alanları: Test name, Start time, End time, Pass, Fail,
  Timeout, Received frame, Expected value, Actual value, Error details.

Komşu bölümlerden bağlayıcı şartlar:

- **§41 güvenlik (39560-39571):** 39562 kullanıcı izni olmadan port açma yasak;
  **39563 `eval` yasak; 39564 dinamik kod çalıştırma yasak**; 39567 parser
  timeout; **39570 sonsuz loop engelle**. Loop adımı ve kullanıcı tanımlı
  doğrulama ifadeleri bu dört maddeye doğrudan çarpıyor — aşağıda karar 2.
- **§40 proje (39513, 39529):** proje dosyası "Test scenarios" saklamalı; örnek
  JSON'da `"tests": []` yuvası var. `src/features/projects/projectFile.ts`'de
  bugün `tests`/`scenario` alanı YOK (grep, doğrulandı) — aşağıda karar 3.
- **§43 (39608):** bütün motorlar için birim testi şart — senaryo motoru dahil.
- **§39 (39446-39497):** istatistik alanları `src/protocol-core/statistics/commStatistics.ts`'de
  zaten var; rapor Response time gibi alanları oradan besleyebilir.
- Sürüm konumu: TA Studio spec'te **Version 1.5** listesinde
  (`ozet/10-uygulama-spec.md:1065`) — MVP kapsamını dar tutmak meşru.

## Hazır parçalar (bu turda tek tek doğrulandı)

- **`src/connection/types.ts` (55 satır):** `ByteSource` sözleşmesi —
  `start/stop/write`, `canWrite`, durum ve hata modeli. `ByteSourceKind`
  bugün `'web-serial' | 'simulated'` (satır 12). Zaman tabanı kuralı dosyanın
  yorumunda: `performance.timeOrigin + performance.now()`, `Date.now()` DEĞİL.
- **`src/connection/serial/`:** gerçek Web Serial gerçeklemesi.
  `createSerialSource(port, options)` (serialSource.ts:19); portu kullanıcı
  jesti içinde `requestPort()` seçer (satır 4 yorumu).
- **`src/connection/mock/`:** `simulatedSource.ts` (112 satır) RX-only,
  `canWrite: false` (satır 48), `write()` reddediyor (satır 108).
  `simulatedProtocol.ts` (199 satır) deterministik telemetri üreteci: LCG seed,
  0xAA…0x55 çerçevesi, çöp bayt enjeksiyonu, chunk bölme — simüle CİHAZ
  (istek→yanıt) değil, yayın kaynağı.
- **Çerçeve üretimi:** `encodeWithSchema` (schemaEncoder.ts:355) +
  `packetPipeline.ts`'nin post-framing zinciri (COBS/SLIP/escape/bit stuffing,
  checksum'un ham çerçevede hesaplandığı yorumla gerekçeli). DİKKAT:
  `ProtocolPlugin.encoder` alanı opsiyonel (`protocol-core/types.ts:257`) ve
  **36 plugin'in HİÇBİRİ encoder vermiyor** (grep: `src/protocols` altında
  'encoder' sıfır eşleşme). Send frame adımı plugin'e değil, şema tabanlı
  üretime (Protocol Studio tanımları / packet template) yaslanmak zorunda.
- **RX hattı:** `src/workers/streamParser.worker.ts` (cancel'lı) — Wait for
  frame / Validate field aynı worker hattından dinler; live-monitor deseni emsal.
- **TX emsali:** packet-builder (3367 satır, 10 dosya) — bağlantı yönetimi
  (`usePacketBuilder.ts:619-654`), `canWrite` bekçisi (:684), `write` (:713),
  `sendScheduler.ts` (zamanlanmış/tekrarlı gönderim — Loop adımının atası).
- **İstatistik/rapor:** `protocol-core/statistics/` (commStatistics, rateMeter).

## UI iskeleti durumu

- Router'da ve katalogda test-automation YOK. Emsal desen: `AppRouter.tsx`
  lazy üst-düzey rotalar (`live-monitor`:66, `protocol-studio`:74,
  `packet-builder`:82) — TA da katalog protokolü değil, `/test-automation`
  üst-düzey araç rotası olacak.
- Sayfa deseni: `src/pages/<Ad>Page.tsx` ince sarmalayıcı →
  `src/features/<ad>/<Ad>Screen.tsx`. Sol menü kaydı: `src/components/layout/Sidebar.tsx`
  (packet-builder örneği :107).
- i18n: `src/translations/tr.ts` + `en.ts` — arayüz Türkçe açılır
  (plan-fazlar.md Faz 2 kararı); bütün TA metinleri iki dosyaya girer.

## Kapsam bölmesi — üç alt faz

**TA-a — Senaryo motoru + simüle cihaz (UI YOK):**
- `src/features/test-automation/` altında: senaryo modeli (13 adım tipinin
  ayrımcı birliği + `formatVersion`'lı JSON şema), değişken deposu, bildirimsel
  koşul değerlendirici (karar 2), koşucu (adım makinesi: async, iptal edilebilir,
  Loop üst sınırı), rapor modeli (39433-39442 alanları).
- `src/connection/mock/` genişletmesi: kural tabanlı istek→yanıt "simüle cihaz"
  kaynağı (`canWrite: true`; eşleşme kuralı → yanıt çerçevesi + gecikme).
- Birim testleri (§43 39608). Playwright yok bu alt fazda.

**TA-b — UI + rota + duman testi:**
- `TestAutomationPage.tsx` + `TestAutomationScreen.tsx` + adım editörü +
  koşu paneli + rapor görünümü; `AppRouter` lazy rota + `Sidebar` kaydı +
  tr/en çeviriler; rapor dışa aktarma (JSON — biçim genişletmesi karar 6).
- Playwright duman testi simüle cihaz üstünden (gerçek port e2e'de imkânsız).

**TA-c — Entegrasyon (küçük, ertelenebilir):**
- §40 bağı: `projectFile.ts`'e `tests` yuvası + migration (formatVersion).
- Rapor CSV/TXT biçimleri; gerçek cihazla manuel tur; kalan cilalar.

TA-a ile TA-b ayrı oturumlar; TA-c istenirse TA-b'ye eklenebilir ama proje
dosyası migration'ı ayrı dikkat ister.

## Verilmesi gereken kararlar

1. **Koşucunun konumu:** ana thread'de orkestrasyon (kaynaklar + worker köprüsü
   zaten orada; adımlar I/O-bound, CPU değil) ÖNERİLİR — worker'a taşımak
   Web Serial jest zincirini koparır. Onay.
2. **Doğrulama ifadeleri — eval yasağının çözümü:** §41 39563-39564 script
   yolunu kapatıyor; §38 örneği (39427 "Fail if temperature > 85") zaten yalnız
   karşılaştırma istiyor. Öneri: serbest metin ifade DEĞİL, yapılandırılmış
   koşul modeli — operand (çözülmüş alan · değişken · sabit) + operatör
   (== != < > <= >= maske) + değer; Conditional branch ve Validate field aynı
   modeli kullanır. Kod yorumuna "bilinçli olarak script dili değil" gerekçesi
   yazılır. Onay + operatör listesi yeterli mi?
3. **Senaryo kalıcılığı:** MVP'de senaryo JSON'u localStorage + dosya
   içe/dışa aktarma mı, yoksa hemen §40 proje dosyasına mı? Öneri: MVP
   localStorage+dosya; proje yuvası TA-c (migration maliyeti ayrışsın).
4. **Send frame kaynağı:** plugin encoder YOK (doğrulandı) — adım, kayıtlı
   paket şablonu / şema+alan değerleri üzerinden `encodeWithSchema` +
   `packetPipeline` zinciriyle üretir. Ham hex bayt girişi de alternatif adım
   varyantı olsun mu? Öneri: evet (en ucuz yol, örnekteki "Send status request"
   çoğu cihazda sabit bayt dizisi).
5. **Mock cihaz sözleşmesi:** `ByteSourceKind` birliğine yeni tür eklemek
   (`types.ts:12` değişir — tüketicilerde tip daralması etkilenir) mi, mevcut
   `'simulated'` türünü opsiyonla zenginleştirmek mi? Öneri: opsiyonla
   zenginleştir, birliği genişletme.
6. **Rapor biçimi:** MVP JSON; CSV/TXT TA-c. Onay.

## Tuzaklar

- **Playwright'ta Web Serial yok** — e2e YALNIZ simüle cihaz üstünden.
  `types.ts` başlık yorumu bu mimari gerekçeyi koyuyor; bozma.
- **`requestPort()` kullanıcı jesti ister** (serialSource.ts:4) — Connect adımı
  kendiliğinden port açamaz; senaryo başlatma akışı port seçimini jest içinde
  yaptırmalı. §41 39562 de aynı şeyi emreder.
- **Zaman tabanı:** Wait/timeout ölçümü `performance.timeOrigin + now()`
  tabanında olmalı (`types.ts` yorumundaki worker saat kayması tuzağı);
  `Date.now()` karışırsa zamanlama sessizce yanlışlar. Birim testinde fake
  timer kullanılıyorsa iki taban birlikte mock'lanmalı.
- **Sonsuz loop (39570):** Loop adımına zorunlu üst sınır + koşucuya iptal
  jetonu; worker cancellation deseni `streamParser.worker.ts`'de emsal.
- **`simulatedSource.canWrite === false`:** mock genişletilmeden Send adımı
  simülasyonda patlar — TA-b UI'ı TA-a'nın simüle cihazı bitmeden bağlanamaz.
- **Port tekeli:** aynı portu live-monitor/packet-builder ile aynı anda açmak
  `open-failed` üretir; TA ekranı "port meşgul" hatasını ayrı anlatmalı
  (emsal: `usePacketBuilder.ts:347` yorumu).
- **Plugin'ler lazy** (`registry.ts:73-128`): Validate field çözümü decode
  plugin'ini await ile yükler; koşucu ilk adımda değil senaryo derlenirken
  yüklesin ki Wait for frame süresine yükleme karışmasın.
- **Makine notları:** 4173 portunu berkin-pms tutuyor; Playwright
  `reuseExistingServer` kapalı kalsın (kullanıcı hafıza notu). UI işinde yeşil
  test yetmez — ekran gerçekten açılıp varsayılan girdiyle gezilecek.

## Çalışma kuralları

- Önce TA-a; motor birim testleriyle yeşilken TA-b'ye geç.
- Mevcut 2511 test yeşil kalır; `npm test` / Playwright bu keşif turunda
  koşulmadı, uygulama oturumunda koşulur.
- Spec'te olmayan hiçbir adım tipi/rapor alanı uydurulmaz; MVP dar tutulur
  (V1.5 maddesi, `ozet/10:1065`).
- Commit istenmeden yapılmaz; brif dışı dosyaya dokunulmaz (bu tur öyle yaptı).

## Öneri (model · effort)

| Alt faz | Öneri | Gerekçe |
|---|---|---|
| TA-a motor + mock | **Opus · high** | Görünmez değişmezler var (iptal, zaman tabanı, adım makinesi) ama ölçek Faz 6/7'den küçük; yol büyük ölçüde emsallerle çizili |
| TA-b UI | **Sonnet · high** | Desen hazır (packet-builder emsal); birkaç yerleşim seçimi var |
| TA-c entegrasyon | **Sonnet · medium** | Mekanik genişletme + migration, tarif net |

Fable hiçbir alt fazda gerekmiyor (plan-fazlar.md model kuralıyla uyumlu).
