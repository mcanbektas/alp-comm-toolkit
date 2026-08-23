# BRİF — Faz 10 dalga 14h, `psi5` (karara bağlı, DALGA 14'ÜN SON KAYDI)

## Bu dosyanın rolü

`sensor-interfaces` ailesini ve **`automotive` domain'inin tamamını KAPATIR.**
Ana brifin bulgu 1'ini üçüncü ve son kez uygular.

> **KAPI: ana brifin açık soru 1'i karara bağlanmadan BAŞLAMAZ.**
> **14g bitmiş olmalı** — konteyner okuma yardımcıları orada `protocol-core`a taşınmış
> olacak (14g'nin ilk kararı).

**Ana brifin önerisi bu kayıt için (a) yoluydu** — yani nabız konteyneri DEĞİL,
`partial` + `calculatorIds`. Gerekçe: spec bu kayıt için **doğrulanmış tek bir sayısal
fixture VERMİYOR** (SENT ve J1850'de veriyordu). Karar 1 (c) olarak onaylandıysa bu
brif o çizgide yazılmıştır; (b) olarak onaylandıysa aşağıdaki "genişletilmiş kapsam"
bölümü geçerlidir.

## Spec'in verdiği ve VERMEDİĞİ (`04-otomotiv.md:169-182`)

**VERİYOR:**
- Girdinin esnek olabileceği (`:171`): *"İlk sürümde fiziksel current waveform capture
  zorunlu olmayabilir; belgenin yaklaşımına uygun biçimde pulse/frame log import
  desteklenebilir."*
- Analyzer alan ADLARI (`:173`): Channel, Timestamp, Slot, Frame Type, Data, Parity,
  CRC, Sensor Address, Status, Sync Mode
- Senkron çalışma modeli (`:175`): ECU Sync Pulse → Time Slot 1→Sensor 1, TS2→Sensor 2,
  TS3→Sensor 3
- Asenkron mod (`:177`) ve ayrımın otomatik ya da kullanıcı seçimiyle yapılacağı
- Katman ayrımı (`:179`): *"Current modulation → Decoded Manchester/bit stream → PSI5
  frame → Sensor data"*
- Sürümleme (`:181`): PSI5 Revision + Application Profile (Airbag, Chassis/Safety,
  Powertrain, Custom) metadata olarak tutulmalı

**VERMİYOR:** hiçbir bit genişliği, hiçbir CRC parametresi, hiçbir slot süresi, hiçbir
çalışılmış örnek. Ve spec bunu KENDİSİ söylüyor (`:181`):

> *"Toolkit kesin CRC, frame-size ve slot kurallarını seçilen profile specification'dan
> yüklemeli; **tek global frame formatı varsaymamalıdır**."*

`:512` de tekrar ediyor: *"SENT (SAE J2716), SPC ve PSI5 için exact timing/pulse-width/
CRC/slot kuralları seçilen revizyon, profil veya vendor datasheet'ine bağlıdır;
toolkit hiçbirinde tek sabit evrensel değer varsaymamalı."*

## Durum kararı: `partial` — SORMADAN uygulanır

**Kaynaksız kayıt politikası (2026-08-23 kullanıcı kararı) tam olarak bu vaka için
yazıldı:** PSI5 Association spec'leri üyelik arkasında; `planned` bırakılmaz,
**`partial` yazılır** — iki bağımsız kaynakta teyitli olan çözülür, geri kalan HAM +
uyarı bırakılır, rozet `partial` olur ve **özet metni neyin çözülüp neyin
çözülmediğini AÇIKÇA yazar.**

Presedan zinciri: `iec-61850` GOOSE-only → `cc-link-ie` 0x890F-only → `cc-link`,
`as-interface`, `foundation-fieldbus` (13g) → **`psi5` (14h)**.

**Bu bir DUR-SOR maddesi DEĞİLDİR.** Politika kurulu, uygula ve geç.

## Katman kararı: Manchester DECODER'A GİRMEZ

Spec `:179` katmanları sayıyor: *"Current modulation → Decoded Manchester/bit stream →
PSI5 frame → Sensor data."*

**Depo bu ayrımı iki kez karara bağlamış ve ikisi de kodda yazılı:**

> `dali.ts:48-53` — *"GİRDİ: 1/2/3 BAYTLIK HAM DİZİ, MANCHESTER KODLAMASI DEĞİL.
> DALI fiziksel katmanda Manchester kodlu, çift telli bir bus sinyalidir; bit-genişliği
> ölçümüyle algılanan bu kodlama HİÇBİR DALI alıcısında uygulamaya 'bayt' olarak
> sızmaz — decoder Manchester'ı hiç görmez, girdi doğrudan çözülmüş bayt dizisidir."*
> (`lin.ts`in "NEDEN BREAK BİR BAYT DEĞİL" kararıyla AYNI gerekçe.)

**PSI5 için de aynısı geçerli ve spec buna İZİN VERİYOR** (`:171`: *"fiziksel current
waveform capture zorunlu olmayabilir… pulse/frame log import desteklenebilir"*).

**Karar: girdi ÇÖZÜLMÜŞ PSI5 çerçevesidir** (bayt dizisi), akım dalga biçimi ya da
Manchester bit akışı değil. Bu, PSI5'i 14f/14g'nin nabız konteynerinden AYIRIR ve
`dali.ts` emsaline oturtur.

**Sonuç: 14h nabız konteynerini KULLANMAZ.** Karar 1'in (c) önerisi bu ayrımın ta
kendisiydi.

### Akım modülasyonu tarafı — hesap aracı olarak

Akım seviyeleri `protocol-core/timing/currentLoop.ts`in konusudur ve dosya zaten
duruyor (`classifyLoopCurrent:147`, `normalizedFromCurrent:77`, `shuntVoltage:82`).
PSI5 4-20 mA DEĞİLDİR (farklı akım seviyeleri) — **`currentLoop.ts` SAHTE DOST**,
doğrudan çağrılmaz. `calculatorIds` istenirse ayrı bir hesap yazılır; **ilk sürümde
GEREKMİYOR**, kaydın `decode` yolu var.

## Slot yapısı: çerçeve mi, analyzer mı

Spec `:175` slot görünümünü istiyor: `SYNC → TS1[Sensor 1], TS2[Sensor 2],
TS3[Sensor 3]`.

**Bir slot penceresi TEK çerçevede görünmez** — sync darbesi ile birden çok sensör
yanıtı ayrı olaylardır. Emsal üç kez kurulu ve üçünde de kayıt rozetiyle kapandı
(12c DNS Transaction Matching, 12d PTP δ/θ, 14e FlexRay cycle timeline).

**Karar: girdi TEK PSI5 çerçevesidir.** Çerçevenin İÇİNDEKİ slot/sensör adresi alanı
çözülür (spec `:173` "Slot" ve "Sensor Address" alanlarını sayıyor); slot ZAMAN
ÇİZELGESİ analyzer işidir ve uyarıyla belirtilir.

**Sync/Async ayrımı** (`:177`): spec *"otomatik veya kullanıcı seçimiyle"* diyor —
çerçeveden çıkarılamıyorsa `decodeOptions`, çıkarılıyorsa türetilmiş alan. Kaynak
turu bunu belirler; **çıkarılabildiğini varsayma.**

## `decodeOptions` — bu kaydın kaçınılmaz kanalı

Spec `:181` doğrudan emrediyor. Kanal AÇILMADAN bu kayıt hiçbir alan üretemez.

- `applicationProfile` (`select`): `airbag | chassis-safety | powertrain | custom`
  — spec'in kendi listesi (`:181`)
- `psi5Revision` (`select`) — spec "metadata olarak tutulmalı" diyor
- `dataBitCount` (`number`, `min`/`max`) — `custom` profilinde geçerli
- `syncMode` (`select`: `sync | async | auto`) — yalnız çerçeveden çıkarılamıyorsa

**`microwire.ts`in profile-preset deseni birebir uygulanır:** preset seçilirse serbest
sayı alanları YOK SAYILIR ve **alan tablosunun İLK SATIRI yürürlükteki profili ADIYLA
ve KAYNAĞIYLA basar** (`microwire.ts:20-26`: *"bu sessiz bir davranış değil"*).

**Preset değerleri iki bağımsız kaynakta teyitli DEĞİLSE o preset EKLENMEZ.**
Yalnız `custom` sunulur ve kullanıcı sayıları kendisi verir — `microwire.ts`in
*"93xx66 gibi tablosu doğrulanmamış aileler bu yoldan kullanılır"* kararının aynısı.

## Kaynak durumu — DOĞRULAMA ZORUNLU, dalganın EN RİSKLİ kaydı

PSI5 spec'leri PSI5 Association üyeliği arkasındadır. Spec özeti kaynak olarak
Infineon AURIX dokümantasyonunu gösteriyor (`:171`) — **kamuya açık**, ama bu bir
mikrodenetleyici çevre birimi belgesidir, protokol spec'i değil; çerçeve biçimini tam
vermeyebilir.

**Alt dalganın İLK adımı kaynak bulunabilirliğini sınamaktır** (dalga 13 mimari
bulgu 1). Aranacaklar: Infineon/NXP/ST PSI5 çevre birimi kılavuzları, açık kaynak
sürücüler, konformans test belgeleri.

**Dalga 13 dersi 5 burada en yüksek riskle geçerli:** 13g iki, 13h bir kaynak iddiasını
REDDETTİ. *"Bir iddia iki bağımsız KODLA çelişiyorsa reddet ve gerekçeyi dosya başına
yaz."* Airbag alanı hayati bir uygulamadır; **uydurma alan tablosu ASLA yayınlanmaz.**

**Kaynak hiç bulunamazsa:** kapsam "çerçeve sınırları + kullanıcı profilinden gelen
alan genişlikleri" seviyesinde kalır, çözülen hiçbir alan ADLANDIRILMAZ ve rozet
`partial` olur. Bu bir başarısızlık değil, politikanın kendisidir.

## Uygulama görevleri

1. **Kaynak turu** (kod yazmadan): çerçeve biçimi, parity/CRC kuralı, sensör adresi
   alanı, sync/async ayrımının çerçevede görünüp görünmediği.
2. `src/protocols/automotive/psi5/psi5.ts` + test — `bitCursor` ile bit alanları
   (`readBitsAsNumber`, `bitCursor.ts:85`), `decodeOptions`tan gelen genişlikler,
   parity/CRC (doğrulanan ya da yalnız gösterilen), ham bölgeler + uyarılar.
3. `src/protocols/index.ts` — `registerOnce(registry, 'psi5', …)` + kapsam sınırını
   açıklayan yorum.
4. `automotive.ts:421` — `status: 'partial'`, `pluginId: 'psi5'`, `summary`
   **neyin çözülüp neyin çözülmediğini AÇIKÇA yazar**.
5. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
6. `e2e/psi5-decode.spec.ts` — kanıtlanacaklar: sayfa **Kısmi** rozetiyle açılıyor;
   profil şıkkı değişince alan tablosu değişiyor; alan tablosunun ilk satırı
   yürürlükteki profili adıyla basıyor; ham bölgeler uyarıyla işaretli.
7. **Domain kapanış işleri** (bu son alt dalga olduğu için burada yapılır):
   - `CLAUDE.md` "Bilinen borçlar" sayımını güncelle: 32 → **20 kanonik kayıt**
     (aerospace-uav 12, wireless-iot 4, marine-navigation 3, building-automation 1)
   - `docs/plan-fazlar.md`ye dalga 14 kapanış özeti (12/13 emsali)
   - `docs/brief-faz10-dalga14.md`ye çürüyen tahminlerin düzeltmesi (dalga 12/13'te
     kural haline geldi — brief'in yanlış çıkan öngörüleri dosyada işaretlenir)

## Devralınan tuzaklar

- **`currentLoop.ts` SAHTE DOST** — PSI5 4-20 mA değildir.
- **`CRC4_ITU`/`CRC8` sahte dost olabilir** — aynı genişlik aynı algoritma değildir
  (dalga 13 dersi 2).
- **`ParsedField.offset`/`length` BAYT cinsindendir**, bit değil — bit alanları için
  kapsayan bayt aralığı verilir, bit ayrıntısı alan ADINDA taşınır (`types.ts:34-36`,
  kilitli sözleşme; `rtp.ts`/`rtcp.ts` emsali).
- **`ParsedField.id` KENDİ offset'ini kullanır** (`ftp.ts`/`rtcp.ts` vakaları).
- **`unit` fiziksel değere YAPIŞTIRILIR** — "Encrypted"/biçimlenmiş değerlere verme.
- **`ParsedFrame` DÜZ, `children` YOK** — slot ağacı alan ADLARIYLA karşılanır.
- **DecodePanel tuzakları** — 14c brifindeki liste aynen geçerli.
- **Ajan takılırsa işi ATMA** (dalga 13 dersi 7): kaynak turu → motor → çeviri → test →
  e2e, biri bitmeden diğerine geçme. 13f'de 100KB kod yazıp çeviri/test/e2e'yi sona
  bırakan ajan akışı kopardı.

## Model/effort önerisi

**Opus · high.** Gerekçe: kaynak yetersizliğinde **kapsam daraltma kararı** gerekiyor
ve bu `iec-61850` GOOSE-only sınıfı muhakemedir, mekanik üretim değil. Ayrıca
"hangi preset eklenir, hangisi eklenmez" kararı iki-bağımsız-kaynak ölçütünün
uygulanmasını istiyor ve airbag alanında uydurma alan tablosunun bedeli asimetrik.

**Tamamlanma ölçütü:** `sensor-interfaces` ailesinde `planned` kayıt KALMIYOR;
**`automotive` domain'inin 25 kaydının tamamı `ready`/`partial`/alias**; CLAUDE.md ve
plan-fazlar güncellenmiş; birim + e2e + build yeşil; dalga 14 kapanış özeti yazılmış.
