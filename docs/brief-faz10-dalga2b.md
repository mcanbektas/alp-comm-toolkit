# BRİF — Faz 10 dalga 2b, KWP2000 (ISO 14230) + ISO 9141 (uygulamaya hazır)

## Bu dosyanın rolü

`docs/brief-faz10-dalga2.md`nin (dalga 2 ana brifi) 2b bölümünü somutlaştırır.
Ana brif hâlâ geçerli — konum, durum, raylar, tuzaklar, çalışma kuralları oradan
okunur. Bu dosya yalnız KWP2000/ISO 9141'in bayt düzeni kararlarını çözer;
kod yazacak model önce ana brifi, sonra bunu okur. `brief-faz10-dalga2a.md`
(DoIP, TAMAM — commit `451d3cd`) ile aynı desen: hazırlık turu ayrı oturumda
yapıldı, kod yazımı bu brifi okuyan YENİ bir oturumda başlar.

**Zaten kapanmış kararlar (dalga 2 başında soruldu, değişmedi):**
- K-Line motor ALMAZ — `planned` kalır, bu dalgada K-Line'a hiç dokunulmaz.
- KWP2000 vs UDS karşılaştırma ekranı bu dalgada YAPILMAZ.

## Kaynak uyarısı — DOĞRULAMA YAPILDI

Ana brif bu iki protokol için de spec'in bayt düzeyinde sıfır verdiğini
kanıtlamıştı (satır 54-58). Aşağıdaki bayt düzeni, **freediag** projesinin
gerçek, yol testinden geçmiş çözümleyici kaynağıyla (`diag_l2_iso14230.c`,
`diag_l2_iso9141.c`, `diag_iso14230.h`) ve bağımsız ikinci kaynaklarla
(Wikipedia KWP2000/ISO 9141 maddeleri, OBD9141 Arduino kütüphanesi,
Python-OBD-Scanner, bir Arduino forumu checksum konusu) çapraz doğrulandı —
DoIP'teki üç-kaynak yöntemiyle aynı titizlikte. Tek düşük güvenli nokta: iki
PDF kaynağı (ISO/DIS 14230-2 taslağı, "KWP2000 Data Link Layer Recommended
Practice") metne çevrilemedi, yalnız WebSearch özetiyle dolaylı destekledi —
kod kanıtı (freediag) asıl dayanak.

## KWP2000 (ISO 14230-2) bayt düzeni

Mesaj: `FMT [TGT] [SRC] [LEN] SID veri... CHECKSUM`

**FMT baytı (1 bayt, her mesajda ilk bayt):**
- Bit 5-0: veri uzunluğu (SID+parametreler, HEADER VE CHECKSUM HARİÇ), 0-63.
  **0 ise** hemen ardından ayrı bir **LEN baytı** gelir (TGT/SRC varsa onlardan
  sonra) ve gerçek uzunluk odur.
- Bit 7-6 (adres kipi):
  - `00` (0x00): adres baytı YOK — TGT/SRC üretilmez.
  - `10` (0x80): adres baytları VAR, **fiziksel adresleme**.
  - `11` (0xC0): adres baytları VAR, **fonksiyonel adresleme**.
  - `01` (0x40): "CARB mode" — ISO 14230'un PARÇASI DEĞİL, freediag bunu
    REDDEDİYOR. Karar: hata değil UYARI (bilinmeyen/desteklenmeyen adres kipi),
    en iyi çaba ile adres baytı YOK varsayılır — DoIP'in "unknown payload type"
    deseniyle aynı tonda (spec dışı ama parser'ı çökertmez).

**TGT/SRC (1'er bayt):** yalnız FMT bit7-6 ∈ {`10`,`11`} ise üretilir.

**LEN (1 bayt, opsiyonel):** yalnız FMT bit5-0 == 0 ise üretilir, TGT/SRC'den
(varsa) hemen sonra. DoIP'in payload-length alanı gibi ayrı bir `ParsedField`.

**SID (1 bayt):** veri bölümünün ilk baytı. **SID TABLOSU YAZILMAZ** —
freediag'ın kendi SID listesi bile kaynak yorumunda *"names made up"* diyor;
bazı düşük kodlar UDS ile örtüşse de (0x10 DiagnosticSessionControl, 0x11
ECUReset, 0x14 ClearDiagnosticInformation, 0x3E TesterPresent — UDS zaten
KWP2000'in SID uzayından evrildi) bazıları tamamen ayrışıyor (KWP `0x13`
ReadDiagnosticTroubleCodes'un UDS'te `0x19` karşılığı var, KWP `0x21`
ReadDataByLocalIdentifier'ın UDS'te `0x22`'si var — kod numaraları FARKLI).
UDS tablosunu buraya taşımak uydurma olur. SID HAM + `serviceNeedsTable`
tonunda uyarı (NRC/SPN deseni, ana brif zaten bunu söylüyor).

**Veri:** SID'den sonraki, checksum'dan önceki baytlar — ham blok (UDS'in
`parameters` alanı emsali).

**Checksum (1 bayt, son bayt):** tüm önceki baytların (header+veri) 8-bit
toplamı mod 256. LIN checksum emsali: motor hesaplar, test bağımsız ikinci
hesapla doğrular. Tutmazsa `checksum-mismatch` hatası (ProtocolErrorCode'da
zaten var, DoIP'te kullanılmadı ama burada tam yeri).

**Fast-init/5-baud-init:** bayt alanı DEĞİL, hat seviyesi zamanlama olayı —
decoder'a HİÇ girmez (K-Line kararıyla aynı gerekçe, ana brif zaten söylüyor).

## ISO 9141-2 bayt düzeni

Mesaj: `0x68 0x6A SRC veri... CHECKSUM` (3 baytlık sabit header + veri + checksum)

- Bayt 0: **0x68** — freediag kaynağında `//defined by spec` yorumuyla sabit.
  Farklı değer görülürse UYARI (spec-dışı, hata değil — DoIP'in payload-type
  adı gibi, hâlâ ham gösterilip devam edilir).
- Bayt 1: **0x6A** — aynı gerekçeyle sabit ("tüm OBD cihazları" fonksiyonel
  adresi). Farklı değerde aynı UYARI deseni.
- Bayt 2: Source Address — freediag'da bu alan TEKNİK OLARAK DEĞİŞKEN
  (`dp->srcaddr`), `0xF1` yalnız SAE'nin "harici test cihazı" KONVANSİYONU.
  **Bu baytta sabitlik varsayılmaz, uyarı da üretilmez** — ham alan, tıpkı
  DoIP'in Source Address'i gibi.
- Veri: Mode+PID+parametreler (SAE J1979 modeli) — **HAM KALIR**, mevcut
  `obd-ii` motoru zaten bu içeriği çözüyor; zincir parser seviyesinde
  KURULMAZ (dalga 1 kararının aynısı, DoIP'in UDS payload'ı gibi). Uyarı
  anahtarı DoIP'in `udsPayloadNeedsUdsPage`siyle aynı tonda.
- Checksum (1 bayt, son bayt): aynı 8-bit toplam mod 256.

## Uygulama görevleri

`src/protocols/automotive/iso14230/iso14230.ts` ve
`src/protocols/automotive/iso9141/iso9141.ts` — **önce `doip.ts`yi oku**
(dalga 2a'da yazıldı, aynı iskelet: dosya başı JSDoc + kaynak uyarısı,
`toProtocolWarning`, `byteAt`, `ParsedField` inşa deseni, `ExampleFrame` +
çeviri anahtarlı adlar, plugin nesnesi). `uds.ts`/`j1939.ts` de hâlâ geçerli
ikincil emsal.

**iso14230.ts:**
1. FMT baytını çöz: uzunluk (bit5-0) + adres kipi (bit7-6, dört değerin
   dördü de field'a yansır — `physicalValue` ile "No Address"/"Physical"/
   "Functional"/bilinmeyen-uyarı).
2. TGT/SRC koşullu üret (adres kipine göre), LEN koşullu üret (uzunluk
   bit'lerine göre) — DoIP'in Vehicle Announcement'ındaki opsiyonel Sync
   Status alanı gibi "varsa üret" deseni birebir uygulanabilir.
3. SID ham + `serviceNeedsTable` uyarısı, veri ham blok, checksum doğrulanır
   (hesapla, mesajdaki son baytla karşılaştır, tutmazsa `checksum-mismatch`).
4. **En az iki örnek uzunluk taşıma yolunu kanıtlar** (FMT içi vs ayrı LEN
   baytı) — ana brifin açık şartı. Önerilen tam küme: fiziksel adresleme +
   FMT-içi uzunluk (mutlu yol), ayrı LEN baytı, adressiz kip (`00`), CARB
   kipi (`01`, uyarı yolu), bozuk checksum (hata yolu) — DoIP'in 8 örneklik
   temsili küme mantığı.
5. `status: 'partial'` (SID adlandırılmadı, ana brif zaten bunu söylüyor).
6. Kanonik kayıt `automotive/legacy-diagnostics/iso-14230` — **id `kwp2000`
   DEĞİL**, ana brif satır 72'de doğrulanmış. `pluginId: 'iso-14230'`.

**iso9141.ts:**
7. Sabit header (0x68/0x6A uyarılı-ama-ham, Source ham), veri ham +
   `NeedsObdPage` tonunda uyarı, checksum doğrulanır.
8. `status: 'partial'`. Kanonik kayıt `automotive/legacy-diagnostics/iso-9141`.

**Ortak:**
9. Registry (`src/protocols/index.ts`) + `index.test.ts` alfabetik listeye
   ikisi de girer: sıra `canopen, doip, iso-14230, iso-9141, iso-tp, j1939…`
   (`'1' < '9' < 't'` — ana brif satır 110'da zaten doğrulanmış).
10. `e2e/iso14230-decode.spec.ts` + `e2e/iso9141-decode.spec.ts` — DoIP'in
    e2e desenini (`fieldRow`, `expectNoRawTranslationKeys`, viewport testi)
    kopyala.
11. Motor bitince gerçek tarayıcı turu: her örnek + iki dil, geçici
    `e2e/_tour.spec.ts` ile (dalga 2a'da işe yaradı, sonunda sil).

## Devralınan tuzaklar (DoIP'ten, burada da geçerli)

- `ParsedField` `offset`/`length` zorunlu; `ProtocolErrorCode` kapalı union —
  bu motorda `checksum-mismatch` İLK KEZ gerçekten kullanılacak (DoIP'te hiç
  kullanılmadı, KWP2000/ISO9141'in checksum'ı var).
- Çeviri anahtarı segmentinde tire yok, camelCase (`canopen.ts` /
  `SUMMARY_KEY_SUFFIXES` deseni, gerekirse).
- `noUncheckedIndexedAccess` — `byteAt()` deseni kopyala.
- `src/tests/catalog.test.ts` sayı bekçisi — yeni kayıt eklenmez, var olana
  `pluginId`/`status` yazılır.
- Kod yorumları Türkçe, tanımlayıcılar İngilizce, `any`/`@ts-ignore` yok.
- Playwright: `/comm/` öneki, port 4319 (build+preview), dev 3001.

## Model/effort önerisi

**Sonnet · medium.** Ana brifin "high" gerekçesi (dış kaynak/lisanslı ayrımı
her alanda tekrar ediyordu) bu dosyayla kapandı — sınıflandırma net, bayt
düzeni üç bağımsız kaynakla doğrulandı, iskelet (`doip.ts`) kopyalanacak
somut bir örnek. Tek dikkat noktası: checksum doğrulamasının bu motorda
İLK KEZ gerçek bir `checksum-mismatch` yoluna çıkması — LIN'in bağımsız
ikinci hesap deseni burada da uygulanmalı, effort'u yükseltmeyi gerektirmez.
