# BRİF — ALP Comm Toolkit, Faz 10 dalga 2 (DoIP · ISO 14230/KWP2000 · ISO 9141 · K-Line)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform` (tasarım token'ları `file:` ile), `~/Desktop/alp-pcb-toolkit`.

## Durum: son commit `3cb0f5c`, push edildi, çalışma ağacı temiz
- **Faz 10 dalga 1 TAMAM** — dört alt dalga, dört commit:

| Dalga | İş | Commit |
|---|---|---|
| 1a | ISO-TP + UDS + OBD-II | `7ee58d6` |
| 1b | CANopen | `2acb458` |
| 1c | EDS motoru + EdsPanel + DEFINITION_PANELS seçicisi | `9b136da` |
| 1d | LIN | `3cb0f5c` |

- **1988 birim testi (119 dosya), 130 Playwright testi, `tsc --noEmit` temiz, build çalışıyor.**
- Kayıtlı plugin sayısı 14 (`src/protocols/index.test.ts` alfabetik bekçiliyor):
  can-2-0a/b/fd/xl, canopen, iso-tp, j1939, lin, modbus-ascii/rtu/tcp, nmea-0183, obd-ii, uds.
- ⚠️ `docs/plan-fazlar.md`in "Sıradaki adım" bölümü GÜNCEL DEĞİL (hâlâ Faz 9 diyor,
  "172 kayıt planned" diyor) — dalga tablosuna (satır 32) güven, o bölüme değil.

## Dalga 1'in kurduğu, bu dalganın bineceği raylar

- **Girdi sözleşmesi kararı (karar turu, dalga 1):** motorlar zincir KURMAZ. UDS ham PDU
  baytı alır, ISO-TP CAN çerçevesi alır, ikisi bağımsız. DoIP da aynı deseni izler:
  **girdi ham DoIP mesaj baytıdır** (TCP/UDP payload'ı: generic header + payload),
  içindeki UDS payload'ı HAM alan olarak bırakılır + "UDS sayfasında çözülür" tonunda
  uyarı. Parser'da bağlantı/oturum durumu tutulmaz — spec'in 5 durumlu state machine'i
  (TCP Connected/Routing Active/Diagnostic Active/Idle/Disconnected, ana dok.
  12763-12775) BAĞLANTI durumudur, analyzer katmanının işi (J1939 TP emsali).
- **Dış kaynak disclosure deseni:** spec'in vermediği yapısal tablo dış kaynaktan alınır
  ve dosya başına KAYNAK UYARISI yazılır. Emsaller: CAN FD DLC (ISO 11898-1),
  CiA 301 COB-ID/SDO, LIN 2.1 checksum. İçerik tablosu (lisanslı DB) ise ALINMAZ,
  ham + `…NeedsDatabase` uyarısı: J1939 SPN, UDS NRC, OBD PID.
- **Motor iskeleti:** `j1939.ts`/`uds.ts` deseni birebir — dosya başı JSDoc (kararlar +
  tuzaklar), `toProtocolWarning`, `ParseResult` discriminated union, `canParse` ucuz,
  `ExampleFrame` + çeviri anahtarlı adlar, plugin nesnesi, `registerBuiltInProtocols`e
  dinamik import, kanonik katalog kaydına `pluginId`/`status`.
- `src/features/protocol-decode/DecodePanel.tsx` — `{ pluginId }` alır, **UI yazılmaz.**

## Spec kapsam tablosu (keşif turunda çıkarıldı — bu dalganın en sert gerçeği)

**Dört kaydın DÖRDÜ için de spec bayt düzeyinde NEREDEYSE HİÇBİR ŞEY vermiyor.**
Dalga 1'de dört motorun eksiği vardı; burada eksik olan motorların tamamı:

| Konu | Durum |
|---|---|
| DoIP generic header (versiyon/inverse/payload type/length) | **YOK** — bölümde `0x` geçen tek satır bile yok (ana dok. 12677-12793 tarandı) |
| DoIP payload type kod tablosu | **YOK** — 0 kod |
| DoIP Routing Activation / Announcement alan düzenleri | **YOK** — yalnız 4 kavramsal alan adı (Tester LA, Gateway LA, Activation Type, Response) |
| DoIP NACK kodları | **YOK** |
| DoIP state machine | var ama BAĞLANTI durumu (5 ad, geçiş koşulu yok) — parser'a girmez |
| ISO 9141 header/key bytes/checksum algoritması | **YOK** — 0x08 0x08 / 0x94 0x94 hiç geçmiyor; "Exact timing selected revision'a göre doğrulanmalı" (12031) |
| KWP2000 format byte (A1A0+len) anlamı | **YOK** — spec "seçilen header formatına göre" deyip açık bırakıyor |
| KWP2000 checksum algoritması / fast init süreleri | **YOK** |
| KWP2000 servis tablosu | **YOK** — model yalnız 4 kalem: Request SID / Response SID / Parameters / Negative response (12103-12109); UDS eşleme tablosu da verilmiyor, "karşılaştırma ekranı olsun" deniyor |
| K-Line çerçeve biçimi | **YOK ve OLMAYACAK** — spec net: "K-Line = physical/data transport environment … karıştırılmamalıdır" (11947-11953); istenen tek şey zaman ekseni + init dedektörü |
| §43 fixture (dördü için) | **YOK** — §43'ün 7 fixture'ının hiçbiri bu dalgaya ait değil |

Sonuç: bu dalganın her motoru dış kaynak + kaynak uyarısı gerektirir; fixture'lar gerçek
algoritmayla hesaplanıp testte kanıtlanır (LIN emsali — checksum'ı motor + testin kendi
bağımsız hesabı iki koldan doğrulamıştı).

## Katalog yolları (doğrulandı — dalga 1 brifindeki adlar YANLIŞTI)

| Yol | Rol | Bugünkü durum |
|---|---|---|
| `automotive/diagnostics/doip` | kanonik | `planned`, 7 tab, definitions YOK |
| `automotive/legacy-diagnostics/k-line` | kanonik | `planned`, `layer: 'physical'` |
| `automotive/legacy-diagnostics/iso-9141` | kanonik | `planned` |
| `automotive/legacy-diagnostics/iso-14230` | kanonik — **id `kwp2000` DEĞİL** | `planned`, ailenin tek `data` sekmelisi |

Dördünde de `definitions` alanı/sekmesi yok — bu dalga definitions kablolamasına
DOKUNMAZ. Alias yok. Bekçi taraması yapıldı: **e2e'de bu dört yola işaret eden hiçbir
sabit yok** — bu dalgada bekçi taşıma işi YOK.

## Kapsam bölmesi

- **2a**: DoIP (kendi başına ayakta, tek commit)
- **2b**: ISO 14230 (KWP2000) + ISO 9141 (+ K-Line kararı) — üçü aynı K-Line
  bağlamını paylaşır, tek commit

### Yapılacaklar

**2a — DoIP** (`src/protocols/automotive/doip/`)
1. Girdi: ham DoIP mesajı (generic header + payload). Generic header (protocol
   version, inverse version, payload type, payload length) ve payload type kod
   tablosu ISO 13400-2'den DIŞ KAYNAK + dosya başı kaynak uyarısı — CiA 301
   COB-ID emsali (orada da spec sıfır vermişti). Inverse version tutarlılığı
   doğrulanır (version ^ 0xFF).
2. Payload tipi ADLANDIRILIR (Vehicle Identification / Routing Activation /
   Alive Check / Diagnostic Message / ACK-NACK…); Diagnostic Message (SA + TA +
   UDS payload) alan alan çözülür, **UDS payload'ı HAM kalır** + uyarı ("UDS
   sayfasında çözülür" tonunda — zincir parser'da kurulmaz, dalga 1 kararı).
   Diğer payload tiplerinin iç düzeni için aşağıdaki karara bak.
3. Kanonik kayda `pluginId: 'doip'` + `status`; registry + `index.test.ts`
   (alfabetik listeye `doip` girer); `e2e/doip-decode.spec.ts`.

**2b — ISO 14230 (KWP2000) + ISO 9141** (`src/protocols/automotive/iso14230/`, `iso9141/`)
4. KWP2000: Format byte (adres kipi + length bitleri), gerekirse ayrı Len baytı,
   Tgt/Src, SID, veri, checksum (8-bit sum — dış kaynak, kaynak uyarısı; LIN'deki
   gibi testin kendi bağımsız hesabıyla çivile). **SID tablosu YAZILMAZ** — spec
   vermiyor, UDS tablosunu kopyalamak uydurma olur; SID ham + `serviceNeedsTable`
   uyarısı (NRC/SPN deseni). Uzunluğun iki taşınma yolu (Fmt içi / ayrı bayt) iki
   ayrı örnekle kanıtlanır. `status: 'partial'`.
5. ISO 9141: 3 baytlık header + veri + checksum (8-bit sum, aynı dış kaynak
   notu). Key bytes/init zamanlaması decoder'a GİRMEZ (init bir bayt akışı değil,
   hat olayıdır — K-Line kararına bak). `status: 'partial'`.
6. Registry (alfabetik: `iso-14230`, `iso-9141`), katalog `pluginId`/`status`,
   `e2e/iso14230-decode.spec.ts` + `e2e/iso9141-decode.spec.ts`.

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **DoIP'te hangi payload tipleri alan alan çözülür?** Eğilim: generic header +
   Diagnostic Message tam; Routing Activation ve Vehicle Announcement'ın alan
   düzenleri de yapısaldır (dış kaynak sınıfı) ama içerik kokusu artar (VIN/EID/GID).
   Çizgiyi çek: ya "yapısal dördü tam + gerisi ham", ya "yalnız header + diag tam,
   gerisi adlandırılıp ham". Seçime göre `status` `ready`/`partial` olur.
2. **K-Line motor ALIR MI?** Eğilim: HAYIR — `planned` kalır. Spec'in kendisi
   çerçeve tanımlamıyor; istenen timeline/init-dedektörü live-monitor/analyzer
   işi. "Decode sekmesi var ama motor yok" durumu zaten meşru (planned bildirimi).
   Karşı görüş çıkarsa: k-line'a motor yazmak = olmayan bir çerçeveyi uydurmak.
3. **KWP2000'in UDS karşılaştırma ekranı** (katalogda `KWP2000 vs UDS Comparison`
   aracı) bu dalgada mı, ileride mi? Eğilim: bu dalgada DEĞİL — decoder işi değil,
   ayrı bir görünüm; kapsam şişirir.

## Tuzaklar — dalga 1'de gerçekten tökezletenler + kalıcılar

- **`ParsedField` alanları `offset`/`length`**; `ProtocolErrorCode` KAPALI union
  (`truncated-frame`, `frame-too-long`, `value-out-of-range`, `checksum-mismatch`,
  `start-delimiter-not-found`, `parser-timeout`… — `src/protocol-core/types.ts:76`).
  Uyarı kodu serbest string, hata kodu değil.
- **Çeviri anahtarı segmentinde TİRE OLAMAZ.** Dalga 1b'de `'pdo1-tx'` doğrudan
  anahtara yazılamadı, `SUMMARY_KEY_SUFFIXES` camelCase tablosu gerekti
  (`canopen.ts`). Üstelik e2e ham-anahtar taraması `[a-zA-Z0-9]+` bekler — tireli
  anahtar sızarsa REGEX YAKALAMAZ, çıplak gözle de bakılmalı.
- Çözümleyiciler saf TS; `warnings`/`errors` alanlarına ÇEVİRİ ANAHTARI konur,
  yer tutucu KONMAZ (sayılar `summaryParams`/`details`). Eksik anahtar `tsc`yi
  kırar ama `t(x as TranslationKey)` daraltması bekçiden kaçar.
- **Bayt-viewer bölge çakışması:** çakışan aralıkta listede SONRA gelen kazanır.
  Bit alanına gerçekten yaşadığı baytı ver. DoIP'te SA/TA 2'şer bayt — payload
  type ile üst üste bindirme.
- `src/tests/catalog.test.ts` 8/54/172'yi VE `definitions` sekmesi ⟺ liste
  eşitliğini bekçiliyor. Yeni kayıt ekleme; var olana `pluginId`/`status` serbest.
- `noUncheckedIndexedAccess` açık — `bytes[i]` tipi `number | undefined`; motorlar
  `byteAt()` yardımcıyla okuyor, deseni kopyala. JS bit işlemleri işaretli 32-bit
  üretir; DoIP'in 4 baytlık payload length'i için `>>> 0` unutma.
- Kod yorumları Türkçe, tanımlayıcılar İngilizce. `any`/`@ts-ignore` yok. Ham renk
  yok. Protokol/servis/alan adları VERİDİR, çevrilmez.
- Playwright: rota öneki `/comm/`, port 4319, `reuseExistingServer: false`,
  dev 3001. `buildCanClassicFrame` yalnız CAN taşımalı motorlar için — DoIP/KWP
  kendi bayt dizisini `new Uint8Array([...])` ile kurar (UDS/OBD emsali).

## Çalışma kuralları

- `npm run dev` → localhost:3001/comm/ · `npm test` · `npm run build` · `npm run test:e2e`
- **Yeşil test ekranın açıldığını kanıtlamıyor.** Her motor bitince gerçek tarayıcı
  turu: her örnek + İKİ DİL, ham anahtar deseni `/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/`
  taraması (dalga 1'de bu tur geçici `e2e/_tour.spec.ts` ile otomatize edildi ve işe
  yaradı — aynısını yap, sonunda sil).
- **Fixture'ı uydurma.** §43'te bu dalga için hiçbir şey yok; değerleri gerçek
  algoritmayla hesapla ve testte BAĞIMSIZ ikinci hesapla kanıtla (LIN checksum emsali).
- **Spec'in vermediğini vermiş gibi yapma.** Bu dalgada bu kural her motora
  dokunuyor — her dış kaynak dosya başına yazılır, her lisanslı içerik ham kalır.
- Commit serbest (alt dalga başına bir), **push için ayrıca onay iste**.
- Keşif işini subagent'a ver; bağlam 200K'yı geçince oturumu böl.

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 2a | DoIP | Sonnet · high |
| 2b | KWP2000 + ISO 9141 (+ K-Line kararı) | Sonnet · high |

İkisi de **high**: spec bayt düzeyinde hiçbir şey vermediği için "dış kaynak sınıfı
mı, lisanslı içerik mi" muhakemesi her alanda tekrar ediyor; medium bu çizgiyi
kaçırıp ya fazla çözer (uydurma) ya az çözer (gereksiz `partial`). Opus'a çıkmayı
hak eden tek yer üç açık karar — onları dalga başında kullanıcıya sorup Sonnet'te
kalmak yeterli; dalga 1'in karar turu emsalleri (zincir yok, bağlantı durumu
analyzer'a) büyük kararları zaten kapattı.
