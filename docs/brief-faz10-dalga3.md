# BRİF — ALP Comm Toolkit, Faz 10 dalga 3 (NMEA 2000 · AIS · UBX · RTCM · MAVLink)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Bu brif dalga 2 (DoIP + legacy diagnostics) ile AYNI anda yazıldı (son commit
`3cb0f5c`). **Dalga 2 bittikten sonra başla** ve başlamadan önce iki şeyi güncelle:
son commit hash'i ve registry'nin alfabetik id listesi (dalga 2 `doip`,
`iso-14230`, `iso-9141` ekleyecek). Dalga 1 sonu itibarıyla: 1988 birim testi,
130 Playwright testi, 14 kayıtlı plugin, tsc/build temiz.

## Bu dalganın üç ayrı ray üstünde koştuğunu bil — ortak çekirdek YOK

Spec katmanlamayı kendisi üç gruba ayırıyor (keşif turunda doğrulandı):

```
A) CAN üstünde        : NMEA 2000  → 29-bit id, J1939 formülüyle AYNI (spec 14701 = 38503)
B) NMEA 0183 üstünde  : AIS        → !AIVDM/!AIVDO cümlesi + 6-bit payload
C) kendi bayt akışı   : UBX (B5 62) · RTCM (D3) · MAVLink (FE/FD)
   UBX+RTCM aynı GNSS portunda multiplekslenir (spec 5563: "$ → NMEA, B5 62 → UBX,
   D3 → possible RTCM3"); MAVLink bu dedektöre DAHİL DEĞİL, taşıyıcısı UART/UDP.
```

Hazır parçalar:
- `src/protocols/automotive/j1939/j1939.ts:153` — `decodeJ1939Identifier` EXPORT
  edilmiş, saf fonksiyon. NMEA 2000 bunu doğrudan kullanır; §43 J1939 fixture'ı
  (`0x18F00401` → PGN 61444) bit düzeni aynı olduğu için NMEA 2000 identifier
  matematiğinin de çıpasıdır.
- `src/protocols/marine/nmea/` — NMEA 0183 cümle katmanı (checksum, ayrıştırma).
  AIS'in AIVDM taşıması bunun üstüne oturur; cümle çözümünü YENİDEN YAZMA, dalga 2
  başında bir Explore ajanıyla bu modülün dışa verdiği yardımcıları çıkar.
- `src/protocol-core/checksums/` — `fletcher.ts` (fletcher16/32), `crcCatalogue.ts`
  (CRC4…CRC64), `nmeaChecksum.ts`. İki tuzağı aşağıda: UBX ≠ Fletcher-16,
  mevcut CRC24 ≠ CRC-24Q.
- CAN 2.0B'nin `suggestHigherLayers` uyarısı zaten "29-bit id tek başına protokol
  kanıtı değildir; J1939/NMEA 2000/… aday" diyor — spec'in "otomatik karar verme"
  şartının (15877) yarısı hazır.

## Spec kapsam tablosu (keşif turunda çıkarıldı)

| Konu | Durum |
|---|---|
| NMEA 2000 identifier bit düzeni + PGN formülü | **VAR** (J1939 bölümünde; N2K bölümü 14701'de aynı tabloyu basıyor) |
| NMEA 2000 Fast Packet bayt düzeni (seq/counter/total-length kodlaması) | **YOK** — yalnız kavramsal çerçeve listesi (14742-14762) |
| NMEA 2000 PGN isim/numara tablosu | **YOK, LİSANSLI** — spec açıkça "lisanslı NMEA database import edilmeli" diyor (14667); tek somut PGN bile geçmiyor |
| AIS AIVDM cümle alanları + fragment birleştirme anahtarları | **VAR** (15165-15195, 15211-15252) |
| AIS 6-bit armoring tablosu/algoritması | **YOK** — yalnız adım adı; "Exact bit-field table … M.1371 revision'a bağlı" (15305) |
| AIS mesaj tipi numaraları / alan bit offset'leri | **YOK** — 5 tip ADI var, numara/offset yok (M.1371-6'ya devrediliyor) |
| MAVLink v1/v2 header offset tablosu, magic, truncation, seq-loss formülü | **VAR** (17232-17250, 17353-17379, 17493-17511, 17266-17297) |
| MAVLink CRC-16/MCRF4XX parametreleri | **YOK** — yalnız ad + kapsam kuralı (17415) |
| MAVLink CRC_EXTRA değerleri / mesaj alan düzenleri | **YOK, BİLİNÇLİ** — "official dialect definition yüklenmeli, hard-coded offset yasak" (17593, 17465) |
| UBX sync/class-id/LE length | **VAR** — üstelik spec'in bu beşlideki TEK tam bayt dizisi: `B5 62 0A 06 00 00 10 3A` (5355) |
| UBX checksum algoritması | **YOK** — "Fletcher" UBX bağlamında hiç geçmiyor; kapsam bile "sürüme göre, UI'da belirtilsin" (5401-5415) |
| UBX class/id numara tablosu, NAV-PVT alan düzeni | **YOK** — yalnız isim örnekleri |
| RTCM mesaj tipi numaraları (1005/1077/1087/1097/1127/1230…) | **VAR** (5490-5503) |
| RTCM 10-bit length, CRC-24Q polinomu | **YOK** — spec KASTEN vermiyor: "exact polynomial … resmi RTCM profile'a bağlı sabit tutulmalı" (5547); mesaj tabloları lisanslı (5447) |
| §43 fixture (beşi için) | **YOK** — kullanılabilir dolaylı çıpalar: J1939 fixture'ı (N2K identifier) ve UBX 5355 bayt dizisi (fixture ilan edilmemiş u-blox log alıntısı) |

## Katalog yolları (doğrulandı)

| Yol | Rol | Not |
|---|---|---|
| `marine-navigation/nmea-family/nmea-2000` | kanonik | 9 tab (definitions dahil), `definitions: ['custom-schema']` |
| `marine-navigation/ais/ais` | kanonik | 8 tab (build YOK), `definitions: ['custom-schema']` |
| `marine-navigation/gnss-corrections/gnss-ubx` | **kanonik** (id `gnss-ubx`!) | definitions alanı/sekmesi YOK |
| `interfaces-framing/framing-stream-protocols/ubx` | alias → gnss-ubx | |
| `aerospace-uav/gnss-navigation/gps-ubx` | alias → gnss-ubx | |
| `marine-navigation/gnss-corrections/rtcm` | **kanonik** | 8 tab (build YOK), `definitions: ['custom-schema']` |
| `interfaces-framing/framing-stream-protocols/rtcm` | alias → marine rtcm | yorum: "build yok: mesaj tabloları lisanslı" |
| `aerospace-uav/gnss-navigation/rtcm` | alias → marine rtcm | |
| `aerospace-uav/uav-telemetry/mavlink` | kanonik | `definitions: ['custom-schema']`, yorumu oku: "Sabit byte offset yasak — tanım yüklenmeli" |

Alias kaydına `pluginId`/`status` YAZMA — zincirden türer. `custom-schema` için
`DEFINITION_PANELS`te (ProtocolPage.tsx) motor YOK → definitions sekmesi "planlandı"
basar, bu DOĞRU davranış; bu dalga definitions kablolamasına dokunmaz.

## BEKÇİ BORCU — bu dalganın İLK işi

`e2e/nmea-decode.spec.ts:28`:
```ts
const PLANNED_DECODE_PATH = '/comm/marine-navigation/nmea-family/nmea-2000?tab=decode';
```
Kullanımı `:258-265` — `plannedNotice` görünür + `decode-panel`/`decode-field-table`
yok iddia ediyor. **NMEA 2000 motoru bağlandığı an ÜÇ assertion birden düşer.**
3a'nın ilk işi bu sabiti taşımak. Testin kendi iddiası "aynı ailedeki" motorsuz kayıt —
aday: `marine-navigation/nmea-family/iec-61162` (kalan hiçbir dalga listesinde yok;
taşımadan önce `tabs`inde `decode` olduğunu ve `planned` kaldığını DOĞRULA; uymuyorsa
seatalk gibi başka bir marine 'planned' kaydı seç, PSI5 gerekçesini kopyala).
Başka bekçi yok — beş kaydın yollarını e2e genelinde tek geçen bu.

## Kapsam bölmesi

Beş protokol, üç ray → dört alt dalga. Sıra bilinçli: en çok rayı hazır olandan başla.

- **3a**: NMEA 2000 (+ bekçi taşıma) — J1939 rayı hazır, en ucuz giriş
- **3b**: AIS — NMEA 0183 rayı hazır
- **3c**: UBX + RTCM — aynı GNSS akış bağlamı, iki motor tek commit
- **3d**: MAVLink — tamamen kendi başına, en çok karar taşıyan

### Yapılacaklar

**3a — NMEA 2000** (`src/protocols/marine/nmea2000/` öneri; marine dizin düzenine bak)
1. Girdi SocketCAN `struct can_frame` (CAN rayı). `decodeJ1939Identifier` ile
   Priority/PGN/SA/(DA) çöz — formül AYNI, yeniden yazma. Payload HAM +
   `pgnNeedsDatabase` uyarısı (SPN emsali; spec 14667 lisansı açıkça söylüyor).
2. **Fast Packet birleştirme YOK, tanıma da İDDİALI DEĞİL:** hangi PGN'lerin
   fast-packet olduğu DB'ye bağlı — tek çerçeveden anlaşılamaz. Bayt0/bayt1'e
   seq/length anlamı YAKIŞTIRMA (spec kodlamayı vermiyor). Çerçeve düzeyinde
   dürüst kal; "tam anlam oturum + DB ister" tonlu uyarı (J1939 transportSession
   emsali ama sebep farklı — anahtarı ayrı yaz).
3. J1939 ayrımı: spec "otomatik kesin karar verme" diyor (15877) — N2K sayfası
   çerçeveyi çözer, "bu J1939 da olabilir" uyarısını basar (higherLayerCandidates
   tonunda, kendi anahtarıyla). `status: 'ready'` (çerçeve düzeyi tam, J1939 emsali).
4. Bekçi taşıma (yukarıda), katalog `pluginId`/`status`, registry, e2e.

**3b — AIS** (`src/protocols/marine/ais/`)
5. Girdi: `!AIVDM`/`!AIVDO` cümle baytları (NMEA 0183 taşıması). Cümle alanları
   spec'ten TAM: fragment count/number, sequence id, channel, payload, fill bits,
   NMEA checksum. Fragment BİRLEŞTİRME yok — tek cümle parser'ı; çok parçalıda
   oturum uyarısı (ISO-TP FF emsali birebir).
6. 6-bit armoring: karar aşağıda. Karara göre payload ya ham kalır ya bit
   akışına açılıp yalnız Message Type (ilk 6 bit) adlandırılır; alan tabloları
   (MMSI offset, lat/lon ölçek) M.1371 DB'sine bağlı — YAZILMAZ,
   `fieldsNeedDatabase` uyarısı. `status: 'partial'` (armoring yoksa) ya da
   `'ready'` tartışılır — karara bağla.

**3c — UBX + RTCM** (`src/protocols/marine/ubx/`, `src/protocols/marine/rtcm/` —
kanonik marine'de; interfaces-framing/aerospace alias'ları zincirden devralır)
7. UBX: sync B5 62, class/id, LE length, payload, CK_A/CK_B. **Checksum 8-bit
   iki akümülatör MOD 256 — `fletcher16` DEĞİL (o mod 255!)**, kendi küçük saf
   fonksiyonunu yaz, dış kaynak (u-blox arayüz kılavuzu) + kaynak uyarısı; kapsam
   (class'tan length sonuna, sync hariç) nota yaz. Spec 5355 dizisi (`B5 62 0A 06
   00 00 10 3A`) örnek + testte checksum'ı iki koldan kanıtla. Class adları
   (NAV/RXM/CFG/ACK/INF/MON gibi dar yapısal küme) adlandırılabilir; NAV-PVT alan
   düzeni YAZILMAZ (payload ham + uyarı). `status: 'ready'` (çerçeve tam).
8. RTCM: D3 preamble, 6-bit reserved + 10-bit length (dış kaynak), payload,
   CRC-24Q. **`crcCatalogue.ts:107` CRC24 girişi OpenPGP'dir (init 0xB704CE) —
   RTCM'inki init 0x000000. Mevcut girdiyi DEĞİŞTİRME (başka tüketici olabilir),
   kataloğa `CRC-24/Q` olarak AYRI ekle** + katalog testine satır. Mesaj numarası
   (payload'ın ilk 12 biti — `readBits` kullan, `bitCursor` hazır) çözülür; spec
   somut numara listesi veriyor (1005/1077/…) ama İSİM/alan tabloları lisanslı —
   numara ham/adlandırılmamış mı, dar bir kategori eşlemesi mi karar aşağıda.
   `status: 'ready'` (çerçeve + CRC tam).
9. İki motor tek commit; her ikisi için `e2e/*-decode.spec.ts` + alias sayfası
   devralma testi (j1939-decode'un marine alias testi emsal).

**3d — MAVLink** (`src/protocols/aerospace/mavlink/`)
10. v1 (0xFE) ve v2 (0xFD) tek modülde (canClassic'in iki-plugin-tek-parser
    emsali DEĞİL — burada tek kayıt var, tek plugin; magic'e göre dallan).
    Header alanları spec'ten TAM (offset tablosu 17232/17353), v2'de 24-bit
    msgid + incompat/compat flags + imza varlığı (incompat bit 0x01).
    Payload HAM + `payloadNeedsDialect` uyarısı (spec 17593 hard-coded offset'i
    açıkça yasaklıyor).
11. **CRC DOĞRULANAMAZ:** MCRF4XX parametreleri spec'te yok VE CRC_EXTRA mesaj
    tanımına bağlı — dialect yüklenmeden doğrulama matematiksel olarak imkânsız.
    Checksum alanı ham gösterilir + `crcNeedsDialect` uyarısı. `checksum-mismatch`
    HATASI ASLA basılmaz (yanlış pozitif üretirdin). `status: 'partial'`
    (bütünlüğü doğrulayamayan çerçeve çözücü — dürüst etiket; karar aşağıda).
12. Seq-loss formülü (Δ mod 256) spec'te VAR ama ÇERÇEVELER ARASI durum ister —
    analyzer işi, parser'a koyma (metadata'ya seq'i koy, yeter).

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **AIS 6-bit armoring implementte mi?** Tablo (char−48, >40 ise −8) M.1371'in
   mekanik, kamuya açık kuralı — LIN checksum sınıfı dış kaynak. Eğilim: EVET,
   armoring + Message Type numarası çözülür (dar yapısal), alan tabloları DB'ye
   kalır. Hayır denirse payload tamamen ham kalır ve 'partial' kesinleşir.
2. **RTCM mesaj numarası adlandırması:** spec numaraları sayıyor (1005, 1077…)
   ama isimleri lisanslı tablodan. Eğilim: numara + spec'in verdiği KATEGORİ
   eşlemesi kadar (Reference Station / MSM / SSR…), mesaj adı YOK.
3. **MAVLink `status`:** header tam ama CRC doğrulanamıyor — `partial` mı
   `ready` mi? Eğilim: `partial` (OBD-II emsali: eksik doğrulama yeteneği
   `ready` etiketiyle örtülmez).
4. **Dizin yerleşimi:** UBX/RTCM kanonik kayıtları marine'de ama kullanım üç
   domain'e yayılıyor — `src/protocols/marine/` altında mı, yoksa spec'in
   "ortak binary parser" direktifi (15527/20409/20491) gereği çekirdek
   `protocol-core`a yakın bir yerde mi? Eğilim: motor `src/protocols/marine/`
   (kanonik domain), çekirdek yardımcılar zaten `protocol-core/checksums`ta.

## Tuzaklar — dalga 1-2'den taşınanlar + bu dalgaya özgüler

- **UBX checksum ≠ Fletcher-16.** Mod 256 vs mod 255 — `fletcher16`ı çağırırsan
  değerler ÇOĞU ZAMAN tutar, bazen tutmaz; sessiz yanlış. Kendi fonksiyonun + 5355
  fixture'ı + bağımsız test hesabı.
- **crcCatalogue'daki CRC24'e DOKUNMA** — OpenPGP init'i başkasının doğrusu.
  CRC-24/Q ayrı girdi.
- **MAVLink'te checksum-mismatch hatası basma** — doğrulayamadığın şeyi yanlış
  ilan etme. Uyarı ≠ hata ayrımı burada kritik.
- **NMEA 2000'de fast-packet alanı üretme** — tek çerçeveden fast-packet olduğu
  bilinemez; bayt0/bayt1'e alan adı yakıştırmak "spec'in vermediğini vermek".
- Çeviri anahtarı segmentinde tire olamaz (canopen `SUMMARY_KEY_SUFFIXES` emsali);
  e2e ham-anahtar regex'i tireli anahtarı YAKALAMAZ.
- `ParsedField` = `offset`/`length`; `ProtocolErrorCode` kapalı union; uyarı kodu
  serbest. Bayt-viewer çakışmasında sonra gelen kazanır — MAVLink v2'nin 24-bit
  msgid'i 3 bayt, flags'la üst üste bindirme.
- `catalog.test.ts` 8/54/172 + definitions eşitliği; alias'a pluginId yazma.
- `noUncheckedIndexedAccess`; `>>> 0` (RTCM CRC-24 hesabında ve UBX length'te değil
  ama MAVLink 24-bit msgid birleştirmede dikkat); yorum TR / tanımlayıcı EN;
  ham renk yok; protokol adları veridir.
- Playwright `/comm/` + 4319 + `reuseExistingServer: false`; dev 3001.
- Her alt dalga sonunda iki dilli, tüm örnekli tarayıcı turu (geçici `_tour.spec.ts`
  deseni — dalga 1'de dört kez işe yaradı, sonunda silinir).

## Çalışma kuralları
Dalga 2 brifiyle aynı (fixture uydurma yasağı, dış kaynak disclosure'ı, commit
serbest / push onaylı, keşif subagent'a, 200K'da oturumu böl).

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 3a | NMEA 2000 + bekçi taşıma | Sonnet · medium |
| 3b | AIS | Sonnet · high |
| 3c | UBX + RTCM | Sonnet · high |
| 3d | MAVLink | Sonnet · high |

3a **medium**: J1939 rayının üstüne ince katman, karar kalmadı (fast-packet çizgisi
bu brifte kapandı). 3b/3c/3d **high**: her birinde "yapısal dış kaynak mı lisanslı
içerik mi" çizgisi + birer açık karar var. Fable/Opus gerekmez — dört karar da
dalga başında kullanıcıya sorulacak kadar dar; spec keşfi bu brifte bitti.
