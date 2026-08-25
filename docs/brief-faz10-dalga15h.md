# BRİF — Faz 10 dalga 15h, `mode-s` + `ads-b` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.
Bu alt dalga **`surveillance` ailesini ve `aerospace-uav` DOMAIN'İNİ KAPATIR** —
dalga 15'in son işi.

**SIRA ZORUNLU: önce `mode-s`, sonra `ads-b`.** İkincisi birincinin DF17
çıktısını tüketir (ana brif bulgu 2).

---

## BULGU 2 — bu GERÇEK bir paylaşımdır, `ccp` tuzağı DEĞİL

Depo iki sınıf ayırt ediyor:
- **`xcpPacket.ts`/`dnsWire.ts` sınıfı:** iki kayıt aynı teli okuyor, çekirdek
  gerçekten ortak → paylaş.
- **`ccp.ts` sınıfı:** iki kayıt benzer GÖRÜNÜYOR, çekirdek ortak DEĞİL →
  ayrı tut (14c: *"ortak bir komut tablosu, iki protokolün ayrıştığı her kodu
  sessizce yanlış çözer"*).

**Burası birincisidir ve kanıtı üç yerde:**
- Katalog `mode-s` summary'si: *"whose DF17 extended squitter is what ADS-B 1090ES
  rides on"* (`aerospace-uav.ts:477`).
- Katalog tool listesi: **`DF17 → ADS-B Handoff`** (`:489`).
- Spec `:361`: *"ADS-B 1090ES → Mode S Extended Squitter'ı kullanır."*

**Ama iki AYRI MODÜL yazılır** (14d'nin SOME/IP + SD kararı emsal: *"tek kayıt,
iki modül"* — burada iki kayıt, iki modül, tek yönlü tüketim):

```
modeS.ts     → çerçeve düzeyi: uzunluk, DF, CA, ICAO, ME (ham), PI/CRC
adsb.ts      → ME alanının yorumu: Type Code → identification / position / velocity
```

`adsb.ts` `modeS.ts`ten **ME alanını ve DF numarasını** alır. `modeS.ts`
`adsb.ts`i **BİLMEZ** (tek yönlü bağımlılık — `xcpPacket.ts`in `xcpOnCan`/
`xcpOnEthernet` ilişkisinin aynısı).

---

## `mode-s`

### Girdi sözleşmesi

**HAM Mode S mesaj baytları** — 7 bayt (56 bit, kısa) veya 14 bayt (112 bit, uzun).

RF/demodülasyon parser'a **HİÇ girmez**. Spec `:349`: *"Toolkit'in doğrudan SDR
demodulator olması gerekmez; girdi: raw hex, Beast binary, SBS/BaseStation log,
dump1090 JSON, PCAP/custom receiver export olabilir."*

**Bu alt dalgada kapsam: HAM HEX (7/14 bayt).** Beast binary, SBS ve dump1090 JSON
**konteyner biçimleridir**, tel değildir — kapsam dışı, sayfa metninde belirtilir.

### DF tablosu — kaynak: mode-s.org, "Mode S format"

| UF/DF | Bit | Downlink tipi |
|---|---|---|
| 0 | 56 | Short air-air surveillance (ACAS) |
| 4 | 56 | Surveillance, altitude reply |
| 5 | 56 | Surveillance, identity reply |
| 11 | 56 | All-Call reply |
| 16 | 112 | Long air-air surveillance (ACAS) |
| **17** | **112** | **Extended squitter** ← ADS-B |
| 18 | 112 | Extended squitter / non-transponder |
| 19 | 112 | Military extended squitter |
| 20 | 112 | Comm-B, altitude reply |
| 21 | 112 | Comm-B, identity reply |
| 24 | 112 | Comm-D (ELM) |

**DF24 TUZAĞI — kaynak kendisi uyarıyor:**
> *"Format number 24 is an exception. It is identified using only the first two
> bits, which must be `11` in binary. All following bits are used for encoding
> other information."*

→ DF çözümü **önce ilk iki bite bakar**: `11` ise DF24, değilse ilk beş bit.
Naif `readBits(bytes, 0, 5)` DF24'ü 24…31 arası rastgele bir sayı olarak okur.
Spec özeti bu istisnayı **VERMİYOR** (`:364` yalnız *"İlk bit'ler mesajın DF
tipini belirler"* diyor) — dış kaynaktan geldi, dosya başına yazılır.

**Uzunluk ↔ DF tutarlılığı:** 7 baytlık girdide DF17 gelirse çelişki vardır →
`lengthDoesNotMatchDownlinkFormat` uyarısı.

### CRC-24 — YENİ KATALOG GİRİŞİ, sahte dost vakası

`[KANIT]` `dump1090.c:683-695`'teki `modes_checksum_table`ın son sıfır olmayan
girdisi **`0xfff409`**tur; bu tabloyu üreten generator polinomudur. Aynı dosya
`:718`: `return crc & 0x00FFFFFF;` → init `0`, yansıtma yok, xorout yok.

**Katalogdaki DÖRT 24-bit CRC'nin hiçbiri bu değildir:**

| Giriş | poly | init |
|---|---|---|
| `CRC24` (OpenPGP) `crcCatalogue.ts:239` | `0x864cfb` | `0xb704ce` |
| `CRC24_Q` `:258` | `0x864cfb` | `0x000000` |
| `CRC24_FLEXRAY_A` `:285` | `0x5d6dcb` | `0xfedcba` |
| `CRC24_FLEXRAY_B` `:293` | `0x5d6dcb` | `0xabcdef` |

*"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR"* (dalga 13 dersi 2) —
**dört sahte dost, hepsi reddedilir.**

**Ekleme:**
```ts
CRC24_MODE_S: { width: 24, poly: 0xfff409n, init: 0x000000n, refin: false, refout: false, xorout: 0x000000n },
```

**`check` fixture'ı ZORUNLU** (`crcEngine.ts:104`'ün 18-fixture disiplini).
Bağımsız doğrulama: bilinen geçerli bir DF17 mesajının ilk 11 baytı üzerinde
hesaplanan CRC, son 3 baytla (PI) EŞİT çıkmalı. Bu fixture mode-s.org veya
`pyModeS` örneklerinden alınır ve **elle kontrol edilir**.

**`crcBits()` ÇAĞRILMAZ** — 56 ve 112 bit, ikisi de tam bayt (7 ve 14).
`crc()` yeter.

**`CrcCalculatorTool.test.tsx:77`** 15d'de 35 olmuştu → **36**. Yorum güncellenir.

### TUZAK — parite alanının ANLAMI DF'e göre DEĞİŞİR

Bu, bu alt dalganın en incelikli noktasıdır ve **spec özeti bunu VERMİYOR**.

Mode S'te son 24 bit "Parity/Interrogator" (PI) alanıdır ve içeriği
**CRC ⊕ (adres alanı)** şeklindedir:

- **DF11, DF17, DF18** — PI = CRC ⊕ (Interrogator ID / genelde 0).
  → CRC **DOĞRUDAN DOĞRULANABİLİR**. ICAO adresi ayrıca bit 9–32'de AÇIK durur.
- **DF0, DF4, DF5, DF16, DF20, DF21** — AP (Address/Parity) = CRC ⊕ **ICAO adresi**.
  → Mesajda ICAO adresi **AÇIK DEĞİLDİR**; hesaplanan CRC ile AP XOR'lanarak
  **çıkarılır**. Ama bu çıkarım **doğrulanamaz**: her mesaj bir "geçerli" adres
  üretir.

`[BEKLENTİ — kaynak turunda doğrulanacak]` mode-s.org'un ilgili bölümü ve
`pyModeS`in `icao()` fonksiyonu bu ayrımı gösterir.

**Uygulama kuralı:**

| DF | ICAO alanı | CRC alanı |
|---|---|---|
| 11, 17, 18 | bit 9–32'den DOĞRUDAN okunur | **PASS/FAIL doğrulanır** |
| 0, 4, 5, 16, 20, 21 | AP ⊕ CRC ile **ÇIKARILIR**, `icaoRecoveredNotVerified` uyarısı | **DOĞRULANAMAZ**, "gösterildi" olarak basılır |

**"Gösterilir" ile "doğrulanır" ayrımı kullanıcıya görünür olmalı**
(dalga 13 dersi 3). Bu kayıtta ayrım DF'e göre DEĞİŞTİĞİ için her çerçevede
ayrıca belirtilir.

**ICAO adresi Callsign ile KARIŞTIRILMAZ** — spec `:370` özellikle uyarıyor:
*"ICAO Address ile Callsign/Registration/Flight Number karıştırılmamalıdır."*

### [Karar 15h-1] CRC düzeltme motoru — ana brif açık soru 7

Katalog istiyor (`:488` `CRC Correction Candidates`), spec örnek veriyor
(`:373`): *"Original: CRC FAIL → Candidate Correction: Bit 42 → Corrected: CRC
PASS, Confidence: Low/Corrected."*

**Ve spec bir TASARIM KISITI koyuyor** (`:373`, `:541`te tekrar):
> ***"Corrected mesaj hiçbir zaman native-valid frame ile aynı confidence
> seviyesinde gösterilmemelidir."***

Katalog yorumu da yazılı (`aerospace-uav.ts:491-493`): *"bit düzeltilerek
kurtarılan bir mesaj, native-valid frame ile aynı confidence seviyesinde
gösterilemez — sahte kesinlik riski."*

**Karar (DUR-SOR değil, alt dalga içinde verilebilir):**
`attemptCrcCorrection` `decodeOptions` bayrağı, **varsayılan `false`**.
Açıldığında yalnız **tek-bit** düzeltme denenir (112 pozisyon, ucuz), sonuç
**AYRI bir alan** olarak ve **koşulsuz** bir `crcCorrectedLowConfidence`
uyarısıyla basılır. Düzeltilmiş baytlar `ads-b` yorumuna **GEÇMEZ** — sahte
kesinliğin kapısı tam orasıdır.

**Öneri: bu dalgada YAPILMASIN.** Gerekçe: domain'i kapatan alt dalgada opsiyonel
bir motor riski artırır; kayıt onsuz da `ready` kapanır (çerçeve tam çözülüyor).
Yapılmazsa `attemptCrcCorrection` seçeneği de açılmaz ve sayfa metni bunu
"ileride" olarak yazar. **Yapılırsa** yukarıdaki kısıtlar harfiyen uygulanır.

### Beklenen rozet: `ready`

Çerçeve düzeyi tam çözülüyor, CRC (DF11/17/18'de) gerçekten doğrulanıyor,
kaynak mükemmel. DF'e göre değişen parite semantiği bir eksiklik değil, protokolün
kendisi — ve dürüstçe raporlanıyor.

---

## `ads-b`

### Girdi sözleşmesi

**`mode-s`in çözdüğü DF17/DF18 mesajının 56 bitlik ME alanı** (+ DF numarası).

`adsb.ts` bağımsız bir parser olarak da kaydedilir (kendi `pluginId`'siyle) ve
girdi olarak **tam 14 baytlık DF17/18 mesajını** alır; içeride `modeS.ts`in
çerçeve ayrıştırıcısını ÇAĞIRIR, kod kopyalamaz.

### ME alanı — Type Code tablosu

Kaynak: mode-s.org, "ADS-B message types". TC bit 33–37 (ME'nin ilk 5 biti):

| Type Code | İçerik |
|---|---|
| 1–4 | Aircraft identification |
| 5–8 | Surface position |
| 9–18 | Airborne position (Baro altitude) |
| 19 | Airborne velocities |
| 20–22 | Airborne position (GNSS height) |
| 23–27 | Reserved |
| 28 | Aircraft status |
| 29 | Target state and status |
| 31 | Aircraft operation status |

Spec `:367` aynı yapıyı veriyor ve **bir kısıt ekliyor**: *"Exact type-code alan
tahsisi ICAO/DO-260 revizyon veritabanına bağlı tutulmalıdır."*

**Kapsam kararı:** TC 1–4 (identification), 9–18 + 20–22 (airborne position) ve
19 (velocity) çözülür — bunlar mode-s.org'da tam belgeli. **TC 5–8, 28, 29, 31
TANINIR ama payload ÇÖZÜLMEZ** (ham + `typeCodeNotDecoded` uyarısı).
`crsf`in çerçeve tipi kararının aynı biçimi (15d).

### TUZAK — CPR global pozisyon HESAPLANMAZ

Compact Position Reporting **iki mesaj gerektirir**: bir Even (F=0) ve bir Odd
(F=1) çerçevesi. Tek çerçeveden global enlem/boylam **üretilemez**.

Spec `:376` zaten ara veriyi istiyor:
> *"CPR kullanıldığında ara veri de gösterilebilir: CPR Format (Even/Odd), Raw
> Latitude/Longitude, Reference/Pair."*

→ **BASILAN:** CPR Format biti, ham 17-bit LAT-CPR, ham 17-bit LON-CPR, altitude.
→ **BASILMAYAN:** global lat/lon.

Gerekçe `mavlink.ts`in kararının birebir aynısı: *"SEQ-LOSS HESABI PARSER'A
GİRMEZ… ÇERÇEVELER ARASI durum."* Bir çerçeveden üretilemeyen bir sayıyı üretmek,
depoda reddedilmiş bir davranıştır.

**Ham CPR alanına `unit` VERİLMEZ** — CPR değeri derece değildir, kodlanmış bir
tam sayıdır. `types.ts:46`nın *"yalnız gerçek fiziksel değere"* kuralı.

Aynı gerekçeyle **`Aircraft Table`** (`:457`) ve **`Message Age`** (`:465`) de
parser'a girmez (çok çerçeveli, analyzer işi). Spec `:379`un "Position/Velocity/
Callsign yaşları AYRI tutulmalı" kuralı ve katalog yorumu (`:469-470`) doğrudur
ama **analyzer katmanının** kuralıdır.

### [DUR-SOR] 1090ES-only → rozet `partial` — ana brif açık soru 1

Katalog iki veri bağlantısı vadediyor: `1090ES / UAT Source` (`:467`) ve summary
*"over 1090ES or 978 MHz UAT"* (`:452`).

**Spec kapsam daraltmasına AÇIKÇA izin veriyor** (`:346`):
> *"Toolkit bu ikisini ayrı parser olarak ele almalı; **ilk kapsam olarak
> 1090ES/Mode S'e odaklanılabilir**."*

978 MHz UAT tamamen ayrı bir tel biçimidir (farklı çerçeve, farklı FEC) ve ayrı
bir kaynak turu gerektirir.

**Öneri: 1090ES-only, rozet `partial`**; UAT sayfada **"kapsam dışı"** olarak
listelenir ve özet AÇIKÇA yazar. Emsal: `cc-link-ie` 0x890F-only, `iec-61850`
GOOSE-only, `foundation-fieldbus` HSE-only.

### `decodeOptions`

**Açılmaz.** DF17 ME'sinin Type Code'u kendini anlatır; profil seçimi gerekmiyor.
(`mode-s`te `attemptCrcCorrection` açılırsa yalnız orada.)

---

## `canParse`

**`mode-s` için:** uzunluk **tam 7 veya 14** **ve** DF ile uzunluk tutarlı
**ve** (DF 11/17/18 ise) **CRC PASS**.

DF 0/4/5/16/20/21'de CRC doğrulanamadığı için üçüncü kanıt yoktur → o DF'ler
için `canParse` yalnız uzunluk + DF tutarlılığına dayanır. **Bu ölçülür**: test
registry'nin tüm örnekleri üzerinde kaç yanlış pozitif çıktığını sayar.
14 baytlık çerçeve depoda yaygındır (`canFrame.ts` konteyneri 16, ama başkaları
14 olabilir) — çakışma gerçek bir risktir.

**`ads-b` için:** `mode-s`in kabul ettiği **ve** DF ∈ {17, 18} olan mesajlar.
Yani `ads-b`in `canParse`ı `mode-s`inkinden **daha dardır** — bu kasıtlıdır ve
registry'de ikisinin çakışması normaldir (aynı çerçeveyi iki sayfa da açabilir).
Bekçi testi bunu **beklenen davranış** olarak yazar, düzeltmeye çalışmaz.

Yeni dosya: `src/protocols/aerospace/surveillance/surveillanceCanParseRegistry.test.ts`
(`sentSpcCanParseRegistry.test.ts` emsali — iki kaydı tek dosyada).

---

## Uygulama görevleri

1. **Kaynak turu** — mode-s.org'un DF tablosunu, ADS-B çerçeve yapısını ve
   Type Code tablosunu AÇ. `pyModeS` ile ÇAPRAZLA. **Özellikle doğrula:**
   (a) DF24'ün iki-bit istisnası, (b) DF'e göre değişen parite semantiği,
   (c) CRC generator `0xFFF409`, init 0, (d) ME içinde TC'nin bit 33–37 olduğu.
2. **`crcCatalogue.ts`e `CRC24_MODE_S`** + `crcEngine.test.ts`e `check` fixture'ı
   (gerçek bir DF17 mesajıyla doğrulanmış). **`check` doğrulanmadan giriş
   EKLENMEZ.**
3. **`CrcCalculatorTool.test.tsx:77`** 35 → 36, yorum güncellenir.
4. **`src/protocols/aerospace/modeS/modeS.ts`** — dosya başı: girdinin neden ham
   hex olduğu, DF24 istisnası, DF'e göre parite semantiği, hangi DF'lerde CRC'nin
   doğrulanabildiği, dört sahte-dost CRC24'ün neden reddedildiği,
   `attemptCrcCorrection` kararı.
5. **`src/protocols/aerospace/adsb/adsb.ts`** — dosya başı: neden `modeS.ts`i
   tüketip kopyalamadığı, hangi Type Code'ların çözüldüğü, **CPR'ın neden global
   pozisyona çevrilmediği**, UAT'ın neden kapsam dışı olduğu.
6. **Katalog** — `mode-s` `'planned'` → `'ready'` (`:479`);
   `ads-b` `'planned'` → `'partial'` (`:454`). İkisine de `pluginId`.
7. **Registry** — `registerOnce` iki kayıt.
8. **Çeviri** — `en.ts` + `tr.ts`.
9. **Test** — `modeS.test.ts` (DF24 istisnası, iki parite sınıfı, CRC PASS/FAIL),
   `adsb.test.ts` (identification/position/velocity + çözülmeyen TC'ler +
   CPR'ın ham kaldığı), `surveillanceCanParseRegistry.test.ts`.
10. **e2e** — `e2e/mode-s-decode.spec.ts`, `e2e/ads-b-decode.spec.ts`.
    Kanıtlanacak: DF17'de CRC PASS görünüyor; DF4'te "doğrulanamadı" uyarısı
    görünüyor; ADS-B sayfası **Kısmi** rozetiyle açılıyor ve UAT kapsam-dışı
    notu görünüyor; CPR alanları ham basılıyor ve global pozisyon YOK.

---

## Devralınan tuzaklar

- **Katalogdaki hiçbir CRC24 Mode S'inki DEĞİLDİR.** Dört sahte dost.
- **DF24 ilk İKİ bitten tanınır**, ilk beşten değil.
- **DF'e göre parite semantiği değişir** — tek bir "CRC PASS" göstergesi yanlıştır.
- **CPR global pozisyon HESAPLANMAZ** (çerçeveler arası).
- **Düzeltilmiş mesaj native-valid ile aynı güvende gösterilemez** — spec'in
  kendi tasarım kısıtı (`:373`, `:541`).
- **`modeS.ts` `adsb.ts`i BİLMEZ** (tek yönlü bağımlılık).
- **`adsb.ts`e Mode S çerçeve ayrıştırması KOPYALANMAZ.** İki kopya sessizce
  ayrışır (12d'nin `networkTimestamp` vakası).
- **`crcBits()` ÇAĞRILMAZ** — 56/112 bit tam bayt.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`);
  5/3/24/56/24 bitlik alanlar için kapsayan bayt aralığı, bit ayrıntısı alan
  ADINDA (`ICAO Address (bit 9:32)`).
- **`ParsedField.id` KENDİ offset'ini kullanır** — ME alt alanları ME ile aynı
  baytları paylaşır; id'ye alan adı girer, offset değil.
- **`ParsedFrame` DÜZ, `children` YOK.** DF17 → ME → TC hiyerarşisi alan
  ADLARIYLA (`ME · Type Code`, `ME · CPR Latitude`).
- **`unit` yalnız gerçek fiziksel değere** — ham CPR, ICAO adresi, TC, DF
  BİRİMSİZ; çözülmüş altitude birim alabilir (kaynak birimi veriyorsa).
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.

---

## Model/effort önerisi

**Opus · high.** Gerekçe: dalganın görünmez-değişmez riski en yüksek işi.
Dört ayrı sessiz-yanlış-çözüm noktası var — sahte-dost CRC (dört aday, hepsi
yanlış), DF24'ün iki-bit istisnası, DF'e göre değişen parite semantiği,
CPR'ın çerçeveler arası sınırı — ve her biri test yeşilken yanlış sonuç üretebilir.
Üstelik iki kayıt arasındaki paylaşım sınırının doğru çizilmesi
(`xcpPacket.ts` sınıfı mı, `ccp.ts` sınıfı mı) aktif muhakeme gerektiriyor.
Bir de domain'i kapatan alt dalga olması hata maliyetini artırıyor.

**Tamamlanma ölçütü:** `surveillance` ailesinde `planned` kayıt KALMIYOR ve
**`aerospace-uav` domain'inde `planned` KALMIYOR** (12 kanonik kayıt kapandı,
deponun borcu 20 → 8); `mode-s` **Hazır**, `ads-b` **Kısmi** rozetiyle açılıyor;
`CRC24_MODE_S` katalogda ve gerçek bir DF17 mesajıyla doğrulanmış;
`CrcCalculatorTool.test.tsx` 36'ya güncellenmiş ve yeşil; DF24 istisnası ayrı
testle kanıtlı; DF11/17/18 ile DF0/4/5/16/20/21'in parite raporlaması FARKLI ve
e2e'de görünüyor; CPR ham basılıyor ve global pozisyon üretilmiyor; UAT kapsam-dışı
notu sayfada; `surveillanceCanParseRegistry.test.ts` yeşil ve yanlış pozitifleri
ÖLÇÜYOR; birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → CRC girişi → `modeS.ts`
tamamen (motor → çeviri → test → e2e) → sonra `adsb.ts`. `mode-s` bitmeden
`ads-b`e geçme.

---

## Dalga kapanışı — bu alt dalga bitince yapılacaklar

1. **`CLAUDE.md` "Bilinen borçlar"** güncellenir: `aerospace-uav` TAMAMEN KAPANDI,
   kalan kanonik borç **8** (wireless-iot 4, marine-navigation 3,
   building-automation 1). Ham sayım KODDAN yeniden doğrulanır (tek kullanımlık
   sayım script'i — dalga 14'ün yöntemi).
2. **`docs/plan-fazlar.md`** — dalga 15 kapanış özeti (14'ün `:246` biçimi emsal),
   `:32`deki faz tablosu satırı güncellenir.
3. **`docs/brief-faz10-dalga15.md`** — "Çürüyen tahminler" bölümü DOLDURULUR.
   Keşif turunda zaten çürüyen iki hipotez orada yazılı; uygulama sırasında
   çürüyenler eklenir. **Yanlış öngörüler SİLİNMEZ, İŞARETLENİR.**
4. **Sıradaki domain seçimi** — üç aday kalıyor (`wireless-iot` 4,
   `marine-navigation` 3, `building-automation` 1). Seçim gerekçesiyle yazılır.
