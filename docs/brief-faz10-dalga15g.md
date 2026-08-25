# BRİF — Faz 10 dalga 15g, `mil-std-1553` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.
Bu alt dalga **`avionics-data-buses` ailesini KAPATIR**.

**Bu kayıt dalganın en büyük mimari kararını taşıyor** (ana brif bulgu 6) ve o
karar bir **DUR-SOR** maddesidir (ana brif açık soru 4).

---

## BULGU 6 — sözcük tipi ÇERÇEVEDE YOKTUR

### Kanıt

MIL-STD-1553 sözcüğü **20 bittir**: 3 bit senkron + 16 bit yük + 1 bit tek parite.
Senkron darbesi **Manchester kodunda oluşamayan bir ihlal desenidir** ve
Command/Status ile Data sözcüklerinde **TERSTİR**:

> *"Each word is preceded by a 3 μs sync pulse (1.5 μs low plus 1.5 μs high for
> data words and the opposite for command and status words, **which cannot occur
> in the Manchester code**)… Practically each word could be considered as a 20 bit
> word: 3 bit for sync, 16 bit for payload and 1 bit for odd parity control."*
> — Wikipedia MIL-STD-1553, "Bus protocol"

Ve toolkit'in girdisi **Manchester dalgası DEĞİLDİR** — spec bunu açıkça yazıyor
(`06-havacilik-uav.md:311`):

> *"Toolkit ilk aşamada analog Manchester waveform acquisition zorunda değildir;
> girdiler: bus analyzer log, CSV, TXT, vendor adapter export, **raw decoded word
> list**."*

**Sonuç: 16 bitlik yükten sözcük tipi ÇIKARILAMAZ.**

### Neden bu kritik

Command Word ve Status Word'ün **ikisi de üst 5 bitte RT Address taşır**
(spec `:317-318`). Ayrımları YALNIZ senkrondadır. Bir parser tip tahmin ederse
**her çerçevede sessizce yanlış alan adı basar** — `TX/RX` biti aslında
`Message Error` bayrağı, `Word Count` aslında `Terminal Flags` olur.

Bu, depodaki en pahalı hata sınıfıdır: hata VERMEZ, test yeşil gelir, kullanıcı
yanlış bir uçuş verisi okur.

### Depoda çözülmüş emsal VAR

13h'te IO-Link'in aynı problemi **`messageSide`** adlı bir `decodeOptions` alanıyla
çözüldü — CLAUDE.md'nin kendi ifadesiyle *"alan YERLEŞİMİNİ değiştiren seçenek
(`ccLink.ts`/`iec101.ts` emsalinin genişletilmiş hâli)"*. Master ve Device
mesajları ayrı çözülüyor, tip kullanıcıdan geliyor.

`microwire.ts`in gerekçesi de birebir: *"aynı dört bayt, x8 profiliyle READ 0x2A,
x16 profiliyle bambaşka bir şey; tahmin etmek uydurmaktır."*

### [DUR-SOR] Karar — ana brif açık soru 4

**Öneri: `wordType` `decodeOptions` `select` alanı, VARSAYILANI YOK.**

| `wordType` | Davranış |
|---|---|
| seçilmemiş | 16 bit **HAM** basılır, alt alan ADLANDIRILMAZ, `wordTypeUnknown` uyarısı |
| `command` | RT Address · T/R · Subaddress/Mode · Word Count/Mode Code · Parity |
| `status` | RT Address · Status Flags · Message Error · Service Request · Subsystem · Terminal Flags · Parity |
| `data` | 16-bit Data · Parity |

Varsayılan `data` KONULMAZ: Data Word en yaygın olduğu için "makul" görünür, ama
tam da bu yüzden Command/Status çerçevelerini sessizce yanlış adlandırır.

**Rozet `ready` KALIR.** Gerekçe: parser çözemediği bir şey yok — çerçevede
olmayan bir bilgiyi kullanıcıdan istiyor. `ioLink.ts` bu yolla `ready` kapandı.
`arinc-429`ın `dataEncoding`i de aynı sınıf.

**Alternatif (kullanıcı seçerse): `partial`** — "tip çerçevede yok" bir eksiklik
sayılırsa. Bu durumda `mavlink`in gerekçe biçimi kullanılır.

---

## Girdi sözleşmesi

**16-bit sözcüklerin bayt dizisi** (çözülmüş word listesi). 3 bit senkron ve
Manchester kodlaması parser'a **HİÇ girmez** — `dali.ts` ve `psi5.ts:6-13`in
kararının birebir aynısı:

> *"GİRDİ: ÇÖZÜLMÜŞ ÇERÇEVE BİTLERİ, AKIM DALGASI YA DA MANCHESTER DEĞİL
> (`dali.ts:48-53`in 'GİRDİ HAM BAYT DİZİSİ, MANCHESTER KODLAMASI DEĞİL'
> kararının BİREBİR aynısı)"* — `psi5.ts:6-8`

**Depoda Manchester çözücü YOKTUR** ve bu bilinçlidir `[KANIT]`:
`grep -rli manchester src/` yalnız "Manchester'a girmez" kararı yazan altı dosyayı
buluyor (`dali.ts`, `psi5.ts`, `wirelessMbus.ts`, `asInterface.ts`,
`profibusDp.ts`, `foundationFieldbus.ts`). **Yedincisi bu kayıt olur.**

**Parite biti nerede?** Bu bir kaynak turu sorusudur:
- **(a)** Girdi yalnız 16 bit yük taşır, parite adapter tarafından tüketilmiş ve
  atılmıştır → parite alanı YOK, `parityNotPresentInInput` bilgisi basılır.
- **(b)** Girdi 17 biti bir 16-bit kelimede taşıyamaz; adapter'lar tipik olarak
  paritenin SONUCUNU ayrı bir bayrak olarak verir.

**Öneri: (a)** — ve girdi 2 baytın katı olmalıdır. Parite doğrulaması
`decodeOptions`la ayrı bir girdi olarak istenmez (aşırı mühendislik).
**Kaynak turu bunu netleştirsin**, sonuç dosya başına yazılır.

**Uzunluk:** 2 baytın katı, ≥ 2. Değilse `truncated-frame`.
**Bayt sırası:** `wordByteOrder` seçeneği (`arinc-429`la aynı gerekçe).

---

## Kaynak durumu

**MIL-STD-1553B kamuya açık bir ABD askerî standardıdır** — spec bunu doğruluyor
(`:311`): *"Aktif ABD askeri arayüz standardı… DLA ASSIST veritabanında 2026
itibarıyla aktif görünür."* ARINC 429'un aksine ÜCRETLİ DEĞİLDİR.

**Spec özetinin verdiği** (`:309-340`): roller (BC/RT/BM, `:313`), sözcük tipleri
ve ALAN ADLARI (`:316-319`), transaction tipleri (`:323-326`), RT/subaddress
ağacı (`:330`), mode code ayrımı (`:333`), redundant bus (`:336`), timing
alanları (`:339`).

**Vermediği:** hiçbir alanın **bit genişliğini**, mode code tablosunu, kabul
zamanlama limitlerini. Spec bunu kendi yazıyor (`:321`): *"Exact field'lar seçilen
MIL-STD-1553 standard revizyonuna göre decode edilmelidir"* ve `:545`te tekrar.

**Alt dalganın ilk adımı** (dalga 13 mimari bulgu 1): resmî MIL-STD-1553B metnini
ya da iki bağımsız kamuya açık referansı aç ve şu dört şeyi doğrula:

1. **Command Word alan sınırları** — RT Address kaç bit, T/R kaçıncı bit,
   Subaddress kaç bit, Word Count kaç bit, ve Subaddress'in hangi değerleri
   "mode command" anlamına geliyor.
2. **Status Word alan sınırları ve bayrak bitlerinin KONUMU.**
3. **Data Word'ün gerçekten 16 bit ham olduğu** (alt yapı yok).
4. **Parite kuralı** (tek/odd) ve girdide bulunup bulunmadığı.

**İki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ, 16 bit ham kalır + uyarılır.**

---

## `decodeOptions`

| Seçenek | Şıklar | Varsayılan | Neden |
|---|---|---|---|
| `wordType` | `command` · `status` · `data` | **YOK** | Bulgu 6 — tip çerçevede YOK |
| `wordByteOrder` | `little-endian` · `big-endian` | **YOK** | Adapter'a bağlı |

**`bus` (A/B) seçeneği AÇILMAZ.** Spec redundant bus karşılaştırması istiyor
(`:337`) ama bu **iki ayrı yakalamanın karşılaştırılmasıdır** — çerçeveler arası,
analyzer işi.

---

## Ne ADLANDIRILMAZ, ne HESAPLANMAZ

- **Mode code tablosu.** Spec `:334`: *"Exact mode-code veritabanı aktif standard
  revizyonundan yüklenmelidir."* → Mode Code alanı **sayı** basar, ad basmaz.
- **ICD engineering değerleri.** Spec `:319`: *"(+ yüklenen ICD varsa engineering
  field'a çevrilir)"* — **varsa**. Yok. Katalog `definitions: ['vendor-map',
  'custom-schema']` (`:437`) bildiriyor, **panel BOŞ kalır** (ana brif bulgu 9).
- **Transaction timeline.** Spec `:323-328` üç transaction tipini ve `:328`
  *"Timeline görünümü özellikle önemlidir"* diyor — ama transaction **birden çok
  sözcüktür**, çerçeveler arasıdır. **Parser'a GİRMEZ** (`mavlink.ts`in SEQ-LOSS
  kararı). Parser tek sözcük çözer.
- **RT/Subaddress Explorer** (`:330`), **Bus Utilization** (`:339`),
  **Response Time** (`:339`) — hepsi çok sözcüklü, analyzer işi.
- **Kabul limitleri.** Spec `:340`: *"Exact kabul limitleri seçilen
  standard/profile/ICD konfigürasyonundan alınır."* → `8.2 µs` gibi hiçbir sayı
  gömülmez (`kLine.ts`in "GÖMÜLMEYECEKLER" disiplini).
- **BC/RT/BM rolleri.** Spec `:313-314` rolleri anlatıyor ama bir sözcük hangi
  rolden geldiğini SÖYLEMEZ — bu da senkron/topoloji bilgisidir. Sayfa metninde
  anlatılır, alan olarak BASILMAZ.

---

## `canParse`

**ARINC 429'dan bile zayıf**: herhangi 2 bayt geçerli bir 1553 sözcüğü gibi
görünür. İmza yok, checksum yok, uzunluk kısıtı çok gevşek.

**Kural: `canParse` DAİMA `false` döner.** Bu kayıt otomatik algılamaya GİRMEZ;
kullanıcı sayfayı açıkça seçer ve `wordType`ını verir.

Emsal: `uavcan-compatibility` (15b, karar (a)), `ppm`/`pwm-servo` (15e,
kalibrasyonsuz `false`). Gerekçe dosya başına yazılır — bu bir eksiklik değil,
kaydın doğasından gelen bir sınırdır.

Yine de bekçi testi YAZILIR:
`src/protocols/aerospace/mil1553/mil1553CanParseRegistry.test.ts` —
`canParse`ın registry'nin **hiçbir** örnek çerçevesini kabul etmediğini kanıtlar.
Bu, ileride biri "otomatik algılama ekleyelim" derse önce bu testi kırmak zorunda
kalması demektir.

---

## `related` — çapraz bağlantı ARANMAZ (ana brif bulgu 8)

`interfaces-framing`de MIL-STD-1553 PHY kaydı **YOKTUR**
(`interfaces-framing.ts:677-756`, aile üç kayıt: `can-phy`, `lin-phy`,
`flexray-phy`). Yeni katalog kaydı AÇILMAZ.
`related: ['aerospace-uav/avionics-data-buses/arinc-429']` (`:438`) mevcut hâli
doğrudur.

---

## Uygulama görevleri

1. **Kaynak turu — ZORUNLU İLK ADIM.** Dört doğrulama noktası yukarıda.
   Sonuç dosya başına: neyin doğrulandığı, hangi kaynaktan, neyin ham bırakıldığı.
2. **[DUR-SOR] `wordType` kararını al** (açık soru 4). Kararsız kod YAZILMAZ.
3. **`src/protocols/aerospace/mil1553/mil1553.ts`** — dosya başı: girdinin neden
   Manchester olmadığı (`dali.ts`/`psi5.ts` referansıyla), sözcük tipinin neden
   çerçevede olmadığı, `wordType`ın neden varsayılansız olduğu, `canParse`ın neden
   daima `false` döndüğü, hangi alanların ICD'ye bağlı olduğu için
   adlandırılmadığı, hangi sayıların gömülmediği.
4. **Üç ayrı çözüm yolu** (`command` / `status` / `data`) — üçü de aynı dosyada,
   `wordType`a göre dallanır. `messageSide`'ın `ioLink.ts`teki biçimi emsal.
5. **Alanlar** — `ParsedField.offset`/`length` **BAYT**: 16-bit sözcüğün alt
   alanları için **kapsayan iki bayt** verilir, bit ayrıntısı **alan ADINDA**
   (`Command · RT Address (bit 15:11)`).
6. **`unit`** — hiçbir alanda YOK. RT Address, Subaddress, Word Count, Mode Code
   hepsi sayaç/kimlik, fiziksel değer değil (`types.ts:46`).
7. **Katalog** — `'planned'` → `'ready'` (`:410`; karar `partial` çıkarsa
   `'partial'`), `pluginId: 'mil-std-1553'`.
8. **Registry** — `registerOnce(registry, 'mil-std-1553', …)`.
9. **Çeviri** — `en.ts` + `tr.ts`.
10. **Test** — `mil1553.test.ts`: üç `wordType` için ayrı fixture, `wordType`
    seçilmediğinde ham + uyarı, aynı 2 baytın üç tipte **FARKLI** alan tablosu
    ürettiğinin kanıtı (seçeneğin gerçekten bağlı olduğu).
    `mil1553CanParseRegistry.test.ts`.
11. **e2e** — `e2e/mil-std-1553-decode.spec.ts`. Kanıtlanacak: sayfa rozetiyle
    açılıyor, `live` sekmesi **YOK** (`aerospace-uav.ts:411-420`'de zaten yok),
    `wordType` seçilmeden ham + uyarı görünüyor, seçilince alan tablosu değişiyor.

---

## Devralınan tuzaklar

- **Sözcük tipini TAHMİN ETME.** Bu brifin tamamının sebebi bu.
- **`crcBits()` ÇAĞRILMAZ** — bu protokolde CRC yok, tek parite var
  (ve o da muhtemelen girdide değil).
- **Manchester çözücü YAZILMAZ.** Depoda altı kayıt aynı kararı verdi.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
- **`ParsedField.id` KENDİ offset'ini kullanır** — çok sözcüklü girdide sözcük
  indeksi id'ye girer (`mil1553-word-2-rt-address`), yoksa alanlar çakışır.
- **`ParsedFrame` DÜZ, `children` YOK.** Transaction ağacı isteği (`:328`)
  parser'da KARŞILANMAZ (analyzer işi); sözcük içi yapı alan ADLARIYLA.
- **`unit` yalnız gerçek fiziksel değere** — bu kayıtta hiç yok.
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **Hiçbir zamanlama sayısı gömülmez** (`:340`, `:545`).

---

## Model/effort önerisi

**Opus · high.** Gerekçe: bulgu 6'nın kararı `decodeOptions` yüzeyini şekillendiren
bir tasarım kararıdır ve yanlış varsayım **her çerçevede yanlış alan adı basar** —
hata vermeyen, testte yakalanmayan, kullanıcıyı yanıltan bir hata sınıfı.
Ayrıca kaynak turu dört ayrı bit-sınırı doğrulaması taşıyor ve `canParse`ın
"daima `false`" kararı bir yüzey kararıdır. 14h'in (`psi5`) muhakeme sınıfı.

**Tamamlanma ölçütü:** `avionics-data-buses` ailesinde `planned` kayıt KALMIYOR;
`mil-std-1553` rozetiyle açılıyor; `wordType` seçilmeden 16 bit ham + uyarı
basılıyor; aynı girdinin üç tipte farklı alan tablosu ürettiği testle kanıtlı;
hiçbir mode-code adı ve hiçbir zamanlama limiti kodda gömülü değil;
`mil1553CanParseRegistry.test.ts` `canParse`ın sıfır kabul ettiğini kanıtlıyor;
birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → `wordType` kararı →
motor → çeviri → test → e2e.
