# BRİF — Faz 10 dalga 15e, `ppm` + `pwm-servo` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.
Bu alt dalga **`rc-control-links` ailesini KAPATIR**.

Bu iki kaydın girdisi **BAYT DEĞİL NABIZDIR** — ama bu, dalga 14'ün büyük kararı
gibi bir DUR-SOR maddesi DEĞİLDİR: konteyner 14f/14g'de tanımlandı, `types.ts`e
dokunulmadı, iki kez uygulandı (`j1850Pwm`, `j1850Vpw` — ikisi de `ready` kapandı).
**Burada yalnız TÜKETİLİR.**

---

## Girdi sözleşmesi — `pulseLog.ts` konteyneri, olduğu gibi

`@/protocol-core/decoding/pulseLog` (dosya başı `:44-56` sözleşmenin tamamı):

| Kural | Değer |
|---|---|
| Nabız başına | 2 bayt, `Uint16LE` (`PULSE_STRIDE_BYTES`) |
| Birim | **0.1 µs** (`PULSE_UNIT_US`) |
| Üst sınır | 6553.5 µs (`MAX_PULSE_DURATION_US = 0xffff × 0.1`) |
| Girdi uzunluğu | **ÇİFT** olmalı; tek uzunluk `truncated-frame` |
| Değer `0` | **REZERVE** — "ölçülemedi/boşluk", HAM gösterilir, süreye ÇEVRİLMEZ |
| Sıra | Nabızlar kesin sırayla ardışık |

Alınacak semboller: `decodePulseLog`, `pulseByteSpan`, `isWithinPulseBand`,
`DecodedPulse`, `PULSE_UNIT_US`, `MAX_PULSE_DURATION_US`, `RESERVED_REGISTER_VALUE`.
(`encodePulseLog` yalnız test/örnek üretiminde.)

**Üst sınır kontrolü:** 6553.5 µs, PPM'in tipik çerçeve periyodundan (20 ms) KISADIR.
Yani **tek bir nabız olarak 20 ms'lik bir sync gap TEMSİL EDİLEMEZ.** Bu bir kısıttır
ve dosya başına AÇIKÇA yazılır: sync gap konteynerin üst sınırını aşarsa
`pulseExceedsContainerRange` uyarısı basılır ve o nabız ham kalır. Çözüm
UYDURULMAZ (konteyneri genişletmek `types.ts` sınıfı bir karardır ve bu alt
dalganın işi değil).

### Katalog ve spec bu girdiyi ZATEN söylüyor

- `ppm` `layer: 'physical'` (`aerospace-uav.ts:316`), summary: *"decoded from
  capture edges rather than from bytes"* (`:315`).
- `pwm-servo` `layer: 'physical'` (`:339`).
- Spec `:254`: *"Pulse capture edge'lerinden (örn. 0µs, 1502µs, 3001µs...) channel
  süreleri hesaplanır (CH1=1502µs, CH2=1499µs...)."*

### J1850'ye özel yardımcılar KULLANILMAZ (ana brif "✅ pulseLog" bölümü)

`j1850Pulse.ts`ten **hiçbir şey import EDİLMEZ**:

- `isShortPulse` (`:64`) — J1850'nin **ikili** kısa/uzun ayrımı içindir. PPM'in
  kanal süresi 1000–2000 µs arası **sürekli** bir değerdir. `pulseLog.ts:18-20`
  SENT için aynı gerekçeyi zaten yazmış.
- `deriveAlternatingLevels`/`PulseLevel` (`:83`) — yalnız VPW'nin aktif/pasif hat
  modeli. PPM/PWM tek yönlü darbe trenidir.
- `packBitsToBytes`/`unpackBytesToBits` (`:102`, `:112`) — CRC için bit→bayt
  paketleme. **PPM/PWM'de CRC yok, bit akışı yok.**

`isWithinPulseBand` **konteynerde** (`pulseLog.ts`) olduğu için kullanılabilir —
14f onu bilerek oraya koydu (*"bant MUTLAK µs de olabilir… ikisi de bu tek
fonksiyonla ifade edilir"*).

---

## `ppm`

### Ne çözülür

Spec `:252-266`:
```
|CH1| gap |CH2| gap |CH3| gap |CH4| ... |SYNC GAP|
```
Durum makinesi: `SEARCH_SYNC → READ_CH1 → READ_CH2 → … → FRAME_COMPLETE` (`:266`).

Alanlar: her nabız için süre; sync gap tespiti; kanal indeksi; çerçeve periyodu.

Hatalar (spec `:266`): `Missing Sync`, `Too Many Channels`, `Too Few Channels`,
`Pulse Out Of Range`, `Frame Period Error`, `Jitter Excessive`, `Signal Timeout`.
Bunlar **tek çerçeve içinde** tespit edilebilenlerdir; `Signal Timeout` ve
`Jitter Excessive` çerçeveler arasıdır → **parser'a GİRMEZ** (aşağı bak).

### GÖMÜLMEYECEKLER — spec bunu ÜÇ yerde yasaklıyor

- `:254`: *"**Tek bir evrensel pulse-width mapping varsayılmamalı**; kullanıcı
  Channel Count, Frame Period, Minimum/Center/Maximum Pulse, Sync Gap, Polarity
  tanımlamalıdır."*
- `:263`: *"Bu **preset örneğidir**, protokol standardı olarak hard-code
  edilmemelidir."* (1000/1500/2000 µs kalibrasyonu için)
- Katalog `:330-331`: *"Evrensel bir pulse-width eşlemesi YOKTUR; Min/Center/Max ve
  sync gap kullanıcı kalibrasyonudur, preset olarak hard-code edilemez."*

**1000/1500/2000 µs, 20 ms, 50 Hz KODA GİRMEZ.** `vehiclePhy.ts`in `breakBits`
kararının ve `kLine.ts`in "GÖMÜLMEYECEKLER" listesinin aynısı.

### `decodeOptions` — bu kaydın çözümü BUNSUZ mümkün değil

| Seçenek | Tip | Varsayılan | Neden |
|---|---|---|---|
| `syncGapUs` | sayı | **YOK** | Çerçeve sınırını belirleyen tek şey. Verilmezse kanal ayrımı yapılamaz |
| `channelCount` | sayı | **YOK** (opsiyonel) | Verilirse `Too Many/Few Channels` sınanır; verilmezse sayılan kadar kanal basılır |
| `polarity` | `active-high` / `active-low` | `active-high` | Spec `:254` kullanıcıdan istiyor |
| `pulseEncoding` | `pulse-width` / `pulse-to-pulse` | **YOK** | Spec `:254` iki yorumun da mümkün olduğunu söylüyor: *"(veya implementasyona göre pulse-to-pulse interval)"*. Tahmin etmek uydurmaktır |
| `minPulseUs` / `centerPulseUs` / `maxPulseUs` | sayı | **YOK** | Yalnız normalizasyon alanı için; verilmezse normalize alan BASILMAZ |

**`syncGapUs` verilmediğinde:** nabızlar sırayla HAM listelenir, kanal ayrımı
YAPILMAZ, `syncGapRequiredForChannelSplit` uyarısı basılır. Kayıt yine `ready`dir
— çözemediği bir şey yok, kullanıcıdan gelmesi gereken bir şey var
(`microwire.ts`in profil gerekçesiyle aynı).

**Normalizasyon formülü** (spec `:260`) uygulanır **ama yalnız üç kalibrasyon
değeri de verildiğinde**:
```
x = (Pulse − Center) / (Maximum − Center)      [pozitif taraf]
```
negatif tarafta minimum–center aralığı. Normalize alan **birimsizdir** →
`unit` VERİLMEZ. Ham süre alanı `unit: 'µs'` alır (gerçek fiziksel değer).

---

## `pwm-servo`

### Ne çözülür

Spec `:270-284`. PPM'den farkı topoloji (`aerospace-uav.ts:309-311`): PPM tek hatta
çok kanal, PWM servo **kanal başına ayrı hat**.

Hesaplar (spec `:276-279`):
```
Frequency = 1 / Period
DutyCycle = (PulseWidth / Period) × 100
```

Alanlar: Pulse Width, Frame Period, Frequency, Duty Cycle, (kalibrasyon varsa)
Servo Position, Missing Pulse.

### Girdi yorumu — nabız ÇİFTLERİ

Bir PWM servo sinyali **HIGH süresi + LOW süresi** çiftidir; periyot ikisinin
toplamıdır. Konteyner sırayla nabız verdiği için yorum şudur:
`pulses[2k]` = HIGH (pulse width), `pulses[2k+1]` = LOW; `period = pulses[2k] +
pulses[2k+1]`.

**Bu bir YORUMDUR ve `decodeOptions`la sorulur** (`initialLevel`in J1850'deki
karşılığı, `j1850Pulse.ts:78-81`):

| Seçenek | Şıklar | Varsayılan |
|---|---|---|
| `initialPulseLevel` | `high` (varsayılan) · `low` | `high` |

`low` seçilirse ilk nabız LOW sayılır ve eşleştirme bir kayar. Yanlış seçim
duty cycle'ı tamamen ters çevirir — bu yüzden seçenek AÇIK ve varsayılanı
belgeli.

### GÖMÜLMEYECEKLER

Katalog `:352-353`: *"20 ms / 50 Hz **yalnız bir konfigürasyon örneğidir**; digital
ve high-speed servolar farklı refresh rate ve pulse aralığı kullanır."*
Spec `:281` aynısını söylüyor.

**50 Hz, 20 ms, 1000/1500/2000 µs KODA GİRMEZ.**

### `decodeOptions`

| Seçenek | Varsayılan | Neden |
|---|---|---|
| `initialPulseLevel` | `high` | Yukarıda |
| `minPulseUs` / `centerPulseUs` / `maxPulseUs` | **YOK** | Verilmezse Servo Position alanı BASILMAZ |
| `expectedPeriodUs` | **YOK** | Verilirse `Missing Pulse` / `Frame Period Error` sınanır |

---

## [Karar 15e-1] İki ayrı modül, ortak yardımcı YOK — ana brif açık soru 6

Katalog ikisini ayrı kayıt tutuyor ve gerekçesini yazmış (`:309-311`). Nabız okuma
aynı ama **yorum farklı**: PPM'de nabızlar kanal + gap dizisidir, PWM'de HIGH/LOW
çiftidir.

**Karar: `ppm.ts` ve `pwmServo.ts` ayrı dosyalar, aralarında import YOK, ortak
tek şey `pulseLog.ts`.**

Gerekçe 14g'nin kararının birebir tekrarı (`pulseLog.ts:11-12`, 12b'nin LLDP/DHCP
TLV dersi): *"yürüyücü LLDP'ye özel yazıldı, paylaşılan modül AÇILMADI."*
Konteynerin üstüne ikinci bir ortak katman koymak, iki yorumun ayrıştığı her yerde
sessiz yanlış çözüm üretir.

**Bu DUR-SOR değildir** — 14d'nin SOME/IP-SD kararı emsal, alt dalga içinde
verilebilir. Ama gerekçe dosya başlarına yazılır.

---

## `canParse` — bu dalganın EN RİSKLİ bekçisi

Yeni dosya: **`src/protocols/aerospace/pulse/rcPulseCanParseRegistry.test.ts`**
(`j1850CanParseRegistry.test.ts` emsali).

**Sorun** (`pulseLog.ts:63-68`, 14f'in ÖLÇÜMÜ):
> *"Nabız konteyneri herhangi bir çift uzunluklu bayt dizisine uyar — naif bir
> `data.length % 2 === 0` kontrolü otomatik algılamayı çöpe çevirir. 14f ÖLÇTÜ:
> yalnız SOF'a (pulses[0]) bakmak registry'nin 761 örnek çerçevesinin 413'ünü
> (%54) yanlış pozitif kabul ediyordu."*

Ve burada durum **J1850'den DAHA KÖTÜ**: J1850'nin bilinen kısa/uzun bantları
vardı (PWM 8/16 µs, VPW 64/128 µs). **PPM/PWM'in bilinen tek bir bandı YOKTUR** —
spec bunu açıkça yasaklıyor.

**Kural: `canParse` `decodeOptions` OLMADAN `false` döner.**

Yani PPM ve PWM Servo **otomatik algılamaya girmez**; kullanıcı sayfayı açıkça
seçer ve kalibrasyonunu verir. Bu, `uavcan-compatibility`nin (15b) `canParse`
kararıyla aynı sınıftır ve kaydın doğasından gelir.

`decodeOptions` VARSA `canParse` şunlara bakar:
1. Uzunluk çift ve ≥ 4 bayt (en az iki nabız).
2. Tüm nabızlar `isWithinPulseBand(…)` ile verilen min/max aralığında
   (rezerve `0` hariç).
3. PPM'de: en az bir nabız `syncGapUs` bandında.

**Ölçüm ZORUNLU:** test registry'nin tüm örnek çerçeveleri üzerinde koşar ve
kalibrasyonsuz `canParse`ın **sıfır** kabul ettiğini kanıtlar. Ters yön de sınanır.

---

## Çerçeveler arası olanlar — PARSER'A GİRMEZ

`mavlink.ts`in SEQ-LOSS kararı burada üç yerde uygulanır:

| İstenen | Nerede |
|---|---|
| Jitter (Mean, Peak-to-Peak, Std Dev) | Spec `:284` — **çok çerçeveli**, analyzer işi |
| `Signal Timeout` | Spec `:266` — çerçeveler arası |
| RC Failsafe state machine | Spec `:409` — çerçeveler arası |
| `Missing Pulse` | Spec `:272` — **tek çerçeve içinde** rezerve `0` olarak görülebilir → parser BASAR |

Jitter tek bir çerçeve içindeki nabızlar üzerinden hesaplanabilir ve **bu kadarı
basılabilir** (aynı yakalamadaki N nabzın ortalaması/tepe-tepe farkı). Ama
"çerçeveler arası jitter" hesaplanmaz. Ayrım dosya başında yazılır.

---

## Uygulama görevleri

1. **`src/protocols/aerospace/ppm/ppm.ts`** — dosya başı: girdinin neden nabız
   olduğu, konteynerin nereden geldiği (TEKRAR EDİLMEZ, `pulseLog.ts`e referans),
   J1850 yardımcılarının neden kullanılmadığı, hangi sabitlerin GÖMÜLMEDİĞİ,
   `canParse`ın neden kalibrasyonsuz `false` döndüğü, 6553.5 µs üst sınırı kısıtı.
2. **`src/protocols/aerospace/pwmServo/pwmServo.ts`** — aynı disiplin +
   `initialPulseLevel` gerekçesi.
3. **Katalog** — ikisi de `'planned'` → `'ready'` (`:317`, `:340`), `pluginId`
   eklenir.
4. **Registry** — `registerOnce` iki kayıt.
5. **Çeviri** — `en.ts` + `tr.ts`.
6. **Test** — `ppm.test.ts`, `pwmServo.test.ts`. Fixture'lar spec'in KENDİ
   sayısal örneklerinden türetilir (`:254`: 0/1502/3001 µs → CH1=1502, CH2=1499;
   `:281`: Period=20 ms, Pulse=1.5 ms → f=50 Hz, Duty=7.5%; `:263`: Pulse=1750 µs,
   Min=1000/Center=1500/Max=2000 → +0.5). **Elle hesaplanıp teste yazılır.**
7. **`rcPulseCanParseRegistry.test.ts`** — kalibrasyonsuz sıfır kabul + ters yön.
8. **e2e** — `e2e/ppm-decode.spec.ts`, `e2e/pwm-servo-decode.spec.ts`.
   Kanıtlanacak: kalibrasyon verilmeden nabızlar ham listeleniyor ve uyarı
   görünüyor; `syncGapUs` girilince kanallar ayrılıyor; normalize alan yalnız üç
   kalibrasyon değeri verilince beliriyor.

---

## Devralınan tuzaklar

- **`j1850Pulse.ts`ten HİÇBİR ŞEY import etme.** Konteyner `protocol-core`da.
- **Rezerve `0` değeri süreye ÇEVRİLMEZ** (`pulseLog.ts:51-53`, `DecodedPulse.reserved`).
  Duty cycle hesabına da girmez.
- **Tek uzunluklu girdi `truncated-frame`dir**, sessizce kırpılmaz.
- **`unit` yalnız gerçek fiziksel değere** (`types.ts:46`): süre alanı `µs`,
  frekans `Hz`, duty cycle `%`; **normalize edilmiş konum ve kanal indeksi
  BİRİMSİZ**; ham `Uint16LE` kaydı BİRİMSİZ (0.1 µs'lik ham tick).
- **`ParsedField.offset`/`length` BAYT cinsindendir** — nabız *k* için
  `pulseByteSpan(k)` kullanılır, elle `k*2` hesaplanmaz.
- **`ParsedField.id` KENDİ offset'ini kullanır** — nabız indeksi id'ye girer.
- **`ParsedFrame` DÜZ, `children` YOK.** Kanal ağacı alan ADLARIYLA
  (`CH1 · Pulse`, `CH1 · Normalized`).
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **Konteyner bir YAKALAMA biçimidir, spec'ten gelmiş gibi SUNULMAZ**
  (`pulseLog.ts:58-61`). Sayfa metni bunu söylemeli.

---

## Model/effort önerisi

**Sonnet · high.** Konteyner hazır ve iki kez uygulanmış (`j1850Pwm`/`j1850Vpw`
ikisi de `ready` kapandı), tarif net. `medium` DEĞİL çünkü: `canParse`ın
"kalibrasyonsuz `false`" kararı depoda yeni bir davranıştır ve ölçülmesi gerekiyor;
*"tek evrensel sabit varsayma"* disiplini her satırda geçerli ve ihlali sessizce
yanlış sayı üretir; 6553.5 µs üst sınırı bir kısıt olarak dürüstçe raporlanmalı.

**Tamamlanma ölçütü:** `rc-control-links` ailesinde `planned` kayıt KALMIYOR;
iki kayıt da **Hazır** rozetiyle açılıyor; kalibrasyonsuz durumda ham nabız listesi
+ uyarı görünüyor ve `canParse` sıfır kabul ediyor (testle ölçülü); spec'in üç
sayısal örneği de elle hesaplanmış fixture olarak yeşil; hiçbir zamanlama sabiti
kodda gömülü değil (gözle doğrulanır); birim + e2e + build yeşil.

**KAYIT KAYIT bitir:** önce `ppm` tamamen, sonra `pwm-servo`.
