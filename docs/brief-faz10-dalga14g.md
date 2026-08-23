# BRİF — Faz 10 dalga 14g, `sent` + `spc` (karara bağlı)

## Bu dosyanın rolü

Ana brifin **bulgu 1**'ini ikinci kez uygular ve `sensor-interfaces` ailesinin
üç kaydından İKİSİNİ kapatır (üçüncüsü `psi5`, 14h).

> **KAPI: ana brifin açık soru 1'i karara bağlanmadan BAŞLAMAZ.**
> **14f bitmiş olmalı** — nabız konteyneri orada tanımlanıyor ve burada DEVRALINIYOR,
> yeniden tasarlanmıyor.

**Bu alt dalganın paylaşımı GERÇEKTİR ve spec'in kendi ifadesiyle teyitlidir** —
dalga 12c'nin `dnsWire.ts` ve 13d'nin `cipCore.ts` sınıfı.

## Nabız konteyneri: 14f'ten DEVRALINIR

`Uint16LE` dizisi, birim 0.1 µs, çift uzunluk zorunlu, değer 0 rezerve.
Tam tanım `docs/brief-faz10-dalga14f.md` "Nabız-günlüğü girdi sözleşmesi" bölümünde.

**İkinci bir konteyner tanımlamayın.** 12b/12c/12d'nin dersi tersine de işler
(12e'de kanıtlandı): *"paylaşım gerçekse ayrı modül değil, var olan dosyaya kardeş
eklenir."* Konteyner okuma yardımcıları 14f'in `j1850Pulse.ts`inde yaşıyor — ortak
kısım (nabız dizisini okuma, uzunluk denetimi, 0 değeri) oradan **`protocol-core`a
TAŞINMALI mı** sorusu 14g'nin ilk kararıdır.

**Öneri: taşı.** Üç alt dalga (14f, 14g, 14h) aynı konteyneri okuyacaksa yeri
`protocol-core/` altıdır — `bitCursor.ts`/`berReader.ts` ile aynı sınıf. Ama
**yalnız GERÇEKTEN ortak olan kısım taşınır**: nabız okuma + uzunluk denetimi.
Bit/nibble türetimi protokole özeldir ve taşınmaz (12b'nin LLDP/DHCP TLV dersi:
*"yürüyücü LLDP'ye özel yazıldı, paylaşılan bir modül AÇILMADI"*).

## `sent` — SENT nibble çözücü

### Spec'in verdiği (`04-otomotiv.md:145-158`)

- Girdinin nabız günlüğü olduğu, açık örnekle (`:151`):
  *"Pulse 0: 168 us, Pulse 1: 45 us, Pulse 2: 63 us…"*
- **Çözüm zinciri**: *"Önce calibration/sync pulse'tan Estimated Tick Time çıkarılır;
  ardından her nibble Pulse duration → Tick count → Nibble value olarak decode
  edilir."*
- **Çalışılmış fixture** (`:151`): *"Pulse 45.0 us, Tick 3.0 us → Pulse Ticks 15 →
  Decoded Nibble 0x3."* — **15 tick = nibble 0x3**, yani nibble değeri tick sayısından
  sabit bir taban çıkarılarak bulunuyor. Taban bu örnekten türetilebilir ama
  **DOĞRULANMALIDIR** (aşağı bak).
- Fast Channel çerçeve sırası (`:149`): Sync/Calibration Pulse → Status/Communication
  Nibble → Data Nibble 1,2,… → CRC Nibble → Optional Pause Pulse
- Slow Channel'ın fast channel'ın communication/status bitlerinden taşındığı (`:153`)
- CRC'nin Received / Calculated / PASS-FAIL gösterileceği (`:155`)

### Spec'in VERMEDİĞİ

Nibble sayısı, tick tabanı, tolerans yüzdeleri, CRC polinomu/başlangıcı, senkron
darbesinin tick sayısı. Spec bunu kendisi söylüyor (`:151`): *"Kesin timing sabitleri ve
toleranslar seçilen SAE J2716 revizyon/profiline göre değişir; toolkit bunları evrensel
sabit varsaymamalıdır."*

**SAE J2716 ücretlidir ve depoda YOKTUR.** İki-bağımsız-kaynak kuralı geçerli;
örtüşmeyen hiçbir sayı koda girmez.

### Tick time: ÇIKARILIR, sorulmaz

Spec `:151` bunu net söylüyor — tick time **kalibrasyon darbesinden hesaplanır**,
kullanıcıdan istenmez. Bu, 12d'nin PTP kararının tersi yönde bir örnektir: orada T4
*"kullanıcının bildiği ayar değil, yakalama anında ölçülen değer"* olduğu için kanal
AÇILMAMIŞTI; burada da tick time telin İÇİNDEN çıkıyor, kanal gerekmez.

**`decodeOptions`a giren tick time DEĞİL, profildir** (aşağı).

### CRC: doğrulanır mı, yalnız gösterilir mi

Dalga 13 dersi 3'ün ayrımı burada karara bağlanır:
- CRC polinomu/başlangıcı iki bağımsız kaynakta teyitliyse → **GERÇEKTEN doğrulanır**,
  Received / Calculated / PASS-FAIL üçü de basılır (spec `:155` bunu istiyor)
- Teyitli değilse → **yalnız GÖSTERİLİR**, hesaplanmaz, ve bu kullanıcıya AÇIKÇA
  söylenir (Sercos CRC32 / CC-Link IE HEC emsali)

**`crcCatalogue.ts`e yeni giriş gerekirse** 14e'nin yolu izlenir: `check` değeriyle
`crcEngine.test.ts`te sınanır. CRC 4 bit olduğu için `CRC4_ITU` (`crcCatalogue.ts:42`)
**SAHTE DOST OLABİLİR** — aynı genişlik aynı polinom demek değildir. Dalga 13 dersi 2'nin
tam olarak bu sınıfı: *"`lrc.ts`in `lrcChecksum`ı iki'nin tümleyenidir, XOR DEĞİL."*

## `spc` — SENT'i TÜKETİR, GERÇEK paylaşım

Spec `:159-168` bunu tartışmaya kapatıyor:

- `:161`: *"SENT ile ilişkili bidirectional/request-triggered kullanım biçimi.
  Receiver/ECU SENT hattında belirli bir pulse oluşturarak transmitter/sensor'dan
  response veya belirli davranış talep eder."*
- `:163` işlem sırası: *"ECU → SPC Trigger Pulse → Sensor recognizes request → SENT
  Response Frame. Zaman çizelgesi: Idle → SPC Trigger → Response Delay → SENT Sync →
  SENT Data."*

**Yani SPC = tetik darbesi + gecikme + BİR SENT ÇERÇEVESİ.** Yanıt çerçevesi
`sent`in çözücüsünün ta kendisidir.

**Bu, 12g'nin RTCP→`ntpTimestamp.ts` vakasının aynı sınıfı** (*"bu kez paylaşım GERÇEK
çıktı"*): iki kayıt aynı teli okuyor, tek fark girişteki tetik darbesi.

`sent.ts`in nibble çözücüsü **dışa açık bir fonksiyon olarak** yazılır ve `spc.ts` onu
çağırır — `cipCore.ts`in `decodeCipMessage(data, start, end, fields)` imzası emsal:
çekirdek `ParseResult` üretmez, `fields` dizisine yazar.

### SPC'nin hata sınıfları çerçevededir, analyzer'da değil

Spec `:167`: Trigger too short, Trigger too long, No response, Response timeout,
Invalid SENT CRC, Unexpected sensor, Line not idle before trigger.

**Bunların çoğu tek yakalamada GÖRÜNÜR** (tetik süresi, yanıt gecikmesi, CRC) ve
çözülür. "Unexpected sensor" ise profil bilgisi ister → `decodeOptions`.

## `decodeOptions`

**`sent`:**
- `profile` (`select`) — J2716 revizyonu/profili: nibble sayısı, pause pulse var mı,
  CRC varyantı. `microwire.ts`in profile-preset deseni birebir: preset seçilirse
  serbest sayılar YOK SAYILIR ve **alan tablosunun ilk satırı yürürlükteki profili
  ADIYLA basar** (sessiz davranış yok).
- `dataNibbleCount` (`number`, `min`/`max`) — `custom` profilinde geçerli.

**`spc`:**
- `sensorProfile` (`select`) — spec `:167`: *"SPC profile-specific pulse width
  semantikleri sensor/vendor datasheet'ine bağlı tutulmalıdır."*
- SENT yanıt çerçevesinin profili: `sent`in `profile` şıkkı ile **AYNI çeviri
  anahtarlarını PAYLAŞIR** (ikinci kez yazılmaz).

**Tick time kanalı AÇILMAZ** (yukarı bak — telden çıkıyor).

## Kaynak durumu

SAE J2716 ücretli; SPC ise bir vendor uygulaması (spec `:161` Microchip SENT peripheral
dokümanını kaynak gösteriyor — **kamuya açık**, bu iyi haber). Yine de:

**İki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ.** Dalga 13 dersi 5: uydurma
kaynak gerçek bir tehlike; 13g/13h üç kaynak iddiasını reddetti.

Yetersizse **kaynaksız kayıt politikası SORMADAN uygulanır**: `partial`, çerçeve
sınırları (sync darbesi, nibble sayımı, pause) çözülür, CRC ve profil-bağımlı alanlar
ham + uyarı kalır, özet metni açıkça yazar.

## Uygulama görevleri

1. Konteyner okuma yardımcılarının `protocol-core`a taşınması kararı (yukarı) —
   taşınıyorsa 14f'in dosyası da güncellenir ve testleri yeşil kalır.
2. `src/protocols/automotive/sent/sent.ts` + test — kalibrasyon darbesinden tick
   türetimi, nibble çözümü, CRC (doğrulanan ya da yalnız gösterilen), slow channel
   bitlerinin toplanması.
3. `src/protocols/automotive/sent/spc.ts` + test — tetik darbesi, yanıt gecikmesi,
   `sent`in nibble çözücüsünü çağırma, yedi hata sınıfı.
4. `src/protocols/index.ts` — iki `registerOnce` + paylaşımı açıklayan yorum.
5. `automotive.ts:378` ve `:402` — `status`, `pluginId`.
6. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
7. `e2e/sent-decode.spec.ts` + `e2e/spc-decode.spec.ts` — kanıtlanacaklar: tick time'ın
   TÜRETİLMİŞ bir alan olarak göründüğü; profil şıkkını değiştirmenin nibble sayısını
   değiştirdiği; SPC sayfasında tetik + yanıt çerçevesinin AYNI alan tablosunda
   göründüğü; CRC satırının doğrulanma durumunu açıkça bildirdiği.

## Devralınan tuzaklar

- **`CRC4_ITU` sahte dost olabilir** — aynı bit genişliği aynı algoritma değildir
  (dalga 13 dersi 2).
- **`canParse` imzasız `true` dönmesin** (14f tuzağı, burada da geçerli: SENT'in
  imzası kalibrasyon darbesinin ötekilere ORANIdır, mutlak süresi değil).
- **Slow Channel ayrı bir STREAM'dir** (spec `:153`: *"Toolkit ayrı stream
  üretmeli"*), ama `ParsedFrame` DÜZ (`types.ts:61-69`, kilitli). Çözüm 12g'nin RTCP
  yöntemi: alan ADLARINA taşı (`Slow Channel Bit 1`), şema DEĞİŞTİRME. Tek çerçevede
  slow channel'ın yalnız 1-2 biti görünür — **tam slow channel mesajı çok çerçeve
  ister ve ANALYZER işidir**, uyarıyla belirtilir.
- **`unit` fiziksel değere YAPIŞTIRILIR** — "0x3" gibi biçimlenmiş nibble değerine
  `unit` verme.
- **`ParsedField.id` KENDİ offset'ini kullanır** — nibble döngüsü tam olarak bu hatanın
  doğduğu yapıdır (`ftp.ts`/`rtcp.ts` vakaları, üçüncü hatırlatma).
- **DecodePanel tuzakları** — 14c brifindeki liste aynen geçerli.

## Model/effort önerisi

**Sonnet · high.** Karar 1 onaylandıktan ve 14f konteyneri kurulduktan sonra tarif
netleşir; paylaşım spec'in kendi ifadesiyle teyitli ve `cipCore.ts` imza deseni
kurulu. Muhakeme gerektiren yerler (CRC doğrulanır mı, konteyner taşınır mı, slow
channel sınırı) bu brifte listelenmiş.

**Karar 1 REDDEDİLİRSE** iki kayıt `partial` + `calculatorIds` olur (14a deseni) ve
model önerisi **Sonnet · medium**'a düşer.

**Tamamlanma ölçütü:** iki kayıt rozetleriyle açılıyor; `spc` `sent`in çözücüsünü
GERÇEKTEN çağırıyor (ikinci nibble çözücü yok, testte kanıtlı); profil şıkkı alan
tablosunu değiştiriyor; birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): `sent` tamamen bitmeden `spc`ye geçme —
`spc` zaten `sent`e bağımlı.
