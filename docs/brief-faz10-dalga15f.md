# BRİF — Faz 10 dalga 15f, `arinc-429` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.

Bu kayıt bağımsızdır (hiçbir alt dalgaya bağlı değil, hiçbiri buna bağlı değil).
**Dalganın üç sessiz-yanlış-değer noktasını tek başına taşıyor** — bu yüzden
Opus önerilir.

---

## Girdi sözleşmesi

**32-bit ARINC 429 word'lerinin bayt dizisi.** Katalog `live` sekmesini bilerek
DIŞARIDA bırakmış ve gerekçesini yazmış (`aerospace-uav.ts:365-366`):

> *"`live` yok: ilk sürümde analog waveform yakalama hedeflenmiyor, girdi 32-bit
> raw word / HEX / CSV / adapter log dosyasıdır."*

Spec aynısını söylüyor (`06-havacilik-uav.md:290`): *"Toolkit ilk sürümde analog
ARINC waveform capture zorunda değildir; girdi: 32-bit raw word, HEX log, CSV log,
adapter log olabilir."*

→ **Fiziksel katman (bipolar RZ, 12.5/100 kbit/s) parser'a HİÇ girmez.**
`mavlink.ts`in ve `iso9141.ts`in taşıyıcı sınırı birebir.

**Uzunluk:** girdi 4 baytın katı olmalıdır. Değilse `truncated-frame`.
Birden fazla word gelirse hepsi çözülür (çerçeve başına bir word değil, bir
yakalama bloğu — `canFrame.ts`in konteyner mantığına benzer ama daha basit).

**Bayt sırası bir DECODEOPTION'dur, varsayılan UYDURULMAZ.** Adapter'lar word'ü
LE de BE de yazabilir. Aşağı bak.

---

## Kaynak durumu — SPEC ÜCRETLİ, iki-bağımsız-kaynak kuralı SIKI uygulanır

**ARINC Specification 429 SAE ITC tarafından SATILIYOR**
(aviation-ia.sae-itc.com), depoda YOKTUR. `flexray`ın ISO 17458 durumuyla aynı
sınıf (14e).

**Ama word formatı kaynaksız değildir** — üç bağımsız kamuya açık kaynakta aynı:

1. **Spec özeti** (`06-havacilik-uav.md:292-302`): alanlar (Label, SDI, Data, SSM,
   Parity), BNR/BCD/Discrete yorumları, `Physical = RawSigned × Resolution`
   formülü ve örneği (`Raw=12345, Resolution=0.1ft → 1234.5ft`), tek parite kuralı.
2. **Holt Integrated Circuits uygulama notları** — spec'in KENDİ referansı
   (`:290`, `:293`, `:305`): *"Holt'un güncel ARINC 429 arayüzleri word'leri 32-bit
   olarak buffer/FIFO'da işler, parity sonucunu 32. bit ile ilişkilendirir."*
3. **Genel kamuya açık kaynaklar** (Wikipedia ARINC 429, "Word format"): bit
   numaralandırması ve alan sınırları.

### Word düzeni (bit 1 = ilk gönderilen)

| Bitler | Alan | Genişlik |
|---|---|---|
| 1–8 | **Label** | 8 |
| 9–10 | **SDI** (Source/Destination Identifier) | 2 |
| 11–29 | **Data** | 19 |
| 30–31 | **SSM** (Sign/Status Matrix) | 2 |
| 32 | **Parity** (tipik olarak TEK/odd) | 1 |

---

## TUZAK 1 — bit numaralandırması TERSİNE yazılır

Wikipedia ARINC 429, "Bit numbering, transmission order, and bit significance":

> ARINC 429 word transmission begins with Bit 1 and ends with Bit 32… **it is
> common to diagram and describe ARINC 429 words in the order from Bit 32 to
> Bit 1.**

Yani **her ARINC diyagramı sağdan sola okunur.** Bir motorun tabloyu soldan sağa
`msb-first` sanıp `readBits(bytes, 0, 8)` demesi Label yerine parite+SSM+data'nın
üst bitlerini okur.

**Bu, 14e'nin `BitOrder` kararının ve 12e'nin OID vakasının aynı sınıfıdır:**
küçük değerlerde makul görünür, büyüklerde patlar.

## TUZAK 2 — Label alanı AYRICA terstir

ARINC dünyasının en bilinen tuzağı: **oktal Label, telin ilk sekiz bitinin TERS
sırada okunmasıyla elde edilir.** Yani Label bit 8'den bit 1'e doğru okunur, geri
kalan alanlar bit 1'den 32'ye.

**`[BEKLENTİ] — BU DOĞRULANMADAN UYGULANMAZ.** Alt dalganın **ilk görevi**
budur: iki bağımsız kaynakta (Holt uygulama notu + genel bir ARINC 429 referansı)
Label'in oktal gösterimi ile ham bitler arasındaki ilişkiyi **sayısal bir örnek
üzerinden** doğrula.

Spec `:295` bir örnek veriyor: *"Octal 203 → Database Name: Altitude/example
profile."* `:293`teki Wikipedia örnek tablosu da (`Label` sütunu `0 0 6 2` gibi
oktal gruplar gösteriyor) çaprazlama için kullanılabilir.

**İki kaynak örtüşmezse:** Label alanı **HAM 8 bit** olarak basılır, oktal gösterim
**BASILMAZ**, `labelBitOrderNotVerified` uyarısı çıkar. Dalga 13 dersi 5:
*"uydurma kaynak gerçek bir tehlike, üç iddia reddedildi."*

**`bitReverse` hesaplayıcısı registry'de VAR** (`features/calculators/registry.ts:37`,
`id: 'bit-reverse'`) ama motor onu ÇAĞIRMAZ — dönüşüm `bitCursor` üzerinden yapılır
(hesaplayıcılar kullanıcı aracıdır, motor bağımlılığı değil).

## TUZAK 3 — SSM'in ANLAMI data encoding'e BAĞLIDIR

Spec `:301`:
> *"SSM (Sign/Status Matrix): Anlamı data encoding türüne bağlıdır (örn. BNR
> encoding altında farklı SSM anlamı); seçilen data-format kuralına göre decode
> edilmelidir."*

Katalog yorumu da yazılı (`aerospace-uav.ts:399-400`): *"SSM yorumu da seçilen data
encoding'e (BNR/BCD/Discrete) göre değişir."*

→ **SSM'in iki biti HER ZAMAN basılır, ANLAMI yalnız `dataEncoding` seçildiğinde
adlandırılır.** Seçilmezse ham + `ssmMeaningRequiresEncoding` uyarısı.

`ioLink.ts`in `messageSide` çözümüyle aynı biçim (13h).

---

## `decodeOptions`

| Seçenek | Şıklar | Varsayılan | Neden |
|---|---|---|---|
| `wordByteOrder` | `little-endian` · `big-endian` | **YOK** | Adapter'a bağlı; tahmin etmek Label'i tamamen kaydırır. Seçilmezse ham 4 bayt + uyarı |
| `dataEncoding` | `bnr` · `bcd` · `discrete` · `raw` | `raw` | Data alanının ve SSM'in yorumu buna bağlı (tuzak 3) |
| `resolution` | sayı | **YOK** | BNR için `Physical = RawSigned × Resolution` (`spec:298`). Verilmezse fiziksel değer BASILMAZ |
| `dataBitRange` | iki sayı (opsiyonel) | **YOK** | Bazı Label'lerde anlamlı bitler 11–29'un alt kümesidir; ICD'den gelir |

**`resolution` KODA GÖMÜLMEZ.** Spec `:298`in `0.1 ft` örneği bir ÖRNEKTİR.
`kLine.ts`in "GÖMÜLMEYECEKLER" disiplini.

---

## Ne ADLANDIRILMAZ

- **Label ANLAMI.** Spec `:295` açıkça yasaklıyor: *"Anlamı equipment ICD'sine
  bağlıdır — **global olarak aynı anlamı taşıdığı varsayılmamalıdır**."*
  Katalog yorumu da yazılı (`:399`). `:545` "Dikkat çekenler"de tekrar.
  → Label **sayı/oktal** olarak basılır; "Altitude" gibi bir ad **ASLA**.
  `mavlink.ts`in *"MESSAGE ID ADLANDIRILMAZ"* kararının birebir aynısı.
- **SDI'nin semantik adı.** Spec `:296`: *"configured equipment mapping varsa
  semantik isim verilebilir (örn. SDI 01 → IRS #1)"* — **varsa**. Yok, çünkü
  ICD veritabanı bu dalganın kapsamı dışında (ana brif bulgu 9).
- **Discrete bit anlamları.** Spec `:300`: *"Bit-bazlı ICD mapping (örn. Bit11 =
  Landing Gear Down)"* — ICD'ye bağlı, gömülmez.
- **Equipment ICD veritabanı.** Katalog `definitions: ['vendor-map',
  'custom-schema']` (`:401`) bildiriyor; **panel BOŞ kalır**
  (`snmp.ts:46` / `bleGatt.ts:34` / 14'ün `a2l`/`ldf` emsali).

---

## Parite — DOĞRULANABİLİR, ve bu kaydın `ready` gerekçesi

Spec `:302`: *"Word parity kontrolü yapılır (Odd/Valid → PASS, aksi `PARITY
ERROR`)."* Bit 32 üzerinden, 32 bitin tamamı için tek parite.

**CRC YOKTUR** (ana brif "❌ `crcBits`" bölümü). `crcEngine.ts`/`crcBits`
**ÇAĞRILMAZ**. Parite bir XOR-popcount hesabıdır ve motorda doğrudan yazılır;
`checksums/` altına yeni bir dosya AÇILMAZ (tek satırlık bir hesap için modül
açmak `berReader.ts` dersinin tersidir).

**Parite ÇİFT (even) olabilir mi?** Spec `:302` *"Every ARINC 429 channel typically
uses odd parity"* diyor — **typically**. Bu bir varsayılan, bir garanti değil.
→ `parityMode` seçeneği **açılmaz** (aşırı mühendislik), ama parite alanının
uyarı metni *"odd parity varsayıldı"* der ve bu dosya başında yazılır.
Kaynak turu ters bir kanal biçimi bulursa seçenek eklenir.

---

## `canParse`

**32-bit word'ün ayırt edici bir imzası YOKTUR** — herhangi 4 bayt geçerli bir
ARINC word'ü gibi görünür. `sbus`tan (25 bayt + `0x0F`) bile zayıf.

**Kural: `canParse` `wordByteOrder` seçeneği OLMADAN `false` döner**, ve
seçenekle bile yalnız şunlara bakar:
1. Uzunluk 4'ün katı ve ≥ 4.
2. **Parite PASS** — tüm word'lerde.

Parite tek başına 1/2 olasılıkla rastgele geçer; N word'de 2⁻ᴺ. Bu yüzden test
**ölçer**: registry'nin tüm örnek çerçeveleri üzerinde kaç yanlış pozitif
üretildiği sayılır ve brife yazılır.

Yeni dosya: `src/protocols/aerospace/arinc429/arinc429CanParseRegistry.test.ts`.

---

## `related` — çapraz bağlantı ARANMAZ (ana brif bulgu 8)

14e'de `flexray` ile `interfaces-framing/vehicle-field-physical-layers/flexray-phy`
arasında çift yönlü bağlantı kurulmuştu. **Burada karşılığı YOKTUR** `[KANIT]`:
`interfaces-framing.ts:677-756` — aile üç kayıttır (`can-phy` `:683`,
`lin-phy` `:715`, `flexray-phy` `:735`), ARINC 429 PHY kaydı YOK.

**Yeni katalog kaydı AÇILMAZ** (bu dalganın kapsamı dışı).
`related: ['aerospace-uav/avionics-data-buses/mil-std-1553']` (`:402`) mevcut hâli
doğrudur, DEĞİŞTİRİLMEZ.

---

## Uygulama görevleri

1. **Kaynak turu — ZORUNLU İLK ADIM.** Label bit sırasını iki bağımsız kaynakta
   **sayısal örnekle** doğrula. Doğrulanamazsa oktal gösterim BASILMAZ.
   Ayrıca doğrula: SDI'nin bit 9–10 olduğu, Data'nın 11–29 olduğu, SSM'in 30–31
   olduğu, paritenin bit 32 olduğu.
2. **`src/protocols/aerospace/arinc429/arinc429.ts`** — dosya başı: spec'in ücretli
   olduğu ve hangi kaynakların kullanıldığı, Label bit sırasının nasıl
   doğrulandığı (ya da doğrulanamadığı), neden Label ANLAMI verilmediği, neden
   `live` sekmesi olmadığı, neden CRC olmadığı, `canParse`ın neden zayıf olduğu.
   `mavlink.ts` ve `psi5.ts` dosya başları ton emsali.
3. **`bitCursor` kullanımı** — bit numaralandırma tersliği tek bir yerde,
   **belgelenmiş bir dönüşüm fonksiyonunda** ele alınır; her alan okumasında
   tekrar edilmez.
4. **Alanlar** — `ParsedField.offset`/`length` **BAYT**: hepsi 4 baytlık word'ün
   içindedir, kapsayan aralık verilir, bit ayrıntısı **alan ADINDA**
   (`Label (bit 8:1)`, `SDI (bit 10:9)`, `Data (bit 29:11)`, `SSM (bit 31:30)`,
   `Parity (bit 32)`).
5. **`unit`** — yalnız `resolution` verilip BNR hesaplandığında türetilmiş fiziksel
   alan birim alır (birim de çağırandan gelir, gömülmez). Label/SDI/SSM/ham Data
   **BİRİMSİZ**.
6. **Katalog** — `'planned'` → `'ready'` (`:372`), `pluginId: 'arinc-429'`.
7. **Registry** — `registerOnce(registry, 'arinc-429', …)`.
8. **Çeviri** — `en.ts` + `tr.ts`.
9. **Test** — `arinc429.test.ts`: Label bit sırası testi (ters sıranın FARKLI
   sonuç verdiği gösterilir), parite PASS/FAIL, BNR örneği
   (`Raw=12345 × 0.1 → 1234.5`, spec `:298`), `dataEncoding` seçilmeden SSM'in
   ham kaldığı. `arinc429CanParseRegistry.test.ts`.
10. **e2e** — `e2e/arinc-429-decode.spec.ts`. Kanıtlanacak: sayfa **Hazır**
    rozetiyle açılıyor, `live` sekmesi **YOK**, `dataEncoding` değiştirilince
    SSM ve Data alanlarının yorumu DEĞİŞİYOR, Label'e semantik ad basılmıyor.

---

## Devralınan tuzaklar

- **`bitCursor` varsayılanı `msb-first`tir** (`bitCursor.ts:37`) ve ARINC'in
  diyagram yönü onu tersine düşündürür. Dönüşüm TEK yerde, belgeli.
- **`crcBits()` ÇAĞRILMAZ** — bu protokolde CRC yok, parite var.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
- **`ParsedField.id` KENDİ offset'ini kullanır** — çok word'lü girdide word
  indeksi id'ye girer (`arinc429-word-3-label`), yoksa ikinci word'ün alanları
  birincininkiyle çakışır. `ftp.ts`/`rtcp.ts` vakalarının doğrudan mirasçısı.
- **`ParsedFrame` DÜZ, `children` YOK.** Spec'in *"Bit tree: ARINC Word →
  {Label, SDI, Data, SSM, Parity}"* isteği (`:293`) alan ADLARIYLA karşılanır
  (12g'nin RTCP çözümü).
- **`unit` yalnız gerçek fiziksel değere** (`types.ts:46`).
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **Parite "gösterilir" ile "doğrulanır" ayrımı** — burada gerçekten doğrulanıyor,
  ve bu sayfada görünür olmalı (dalga 13 dersi 3'ün pozitif yönü).

---

## Model/effort önerisi

**Opus · high.** Gerekçe: üç ayrı sessiz-yanlış-değer noktası var (diyagram yönü,
Label bit sırası, SSM'in kodlamaya bağımlılığı) ve üçü de yanlışken test yeşil
gelebilir; spec ÜCRETLİ olduğu için iki-bağımsız-kaynak kuralı bir formalite değil
gerçek bir engel; `canParse`ın zayıflığı bir tasarım kararı gerektiriyor.
14e'nin (`flexray`) muhakeme sınıfı — mekanik üretim değil.

**Tamamlanma ölçütü:** `arinc-429` **Hazır** rozetiyle açılıyor; `live` sekmesi
yok; Label bit sırası iki bağımsız kaynakla doğrulanmış (ya da doğrulanamadığı
için oktal BASILMIYOR ve uyarı görünüyor); ters bit sırasının farklı sonuç verdiği
testle kanıtlı; parite PASS/FAIL çalışıyor; `dataEncoding` seçilmeden SSM ham
kalıyor; hiçbir Label anlamı ve hiçbir `resolution` değeri kodda gömülü değil;
`arinc429CanParseRegistry.test.ts` yanlış pozitif sayısını ÖLÇÜYOR;
birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → bit sırası kararı →
motor → çeviri → test → e2e.
