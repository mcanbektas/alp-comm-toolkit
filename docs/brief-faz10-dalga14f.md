# BRİF — Faz 10 dalga 14f, `sae-j1850-pwm` + `sae-j1850-vpw` (karara bağlı)

## Bu dosyanın rolü

Ana brifin **bulgu 1**'ini ve **açık soru 1**'ini uygulamaya çevirir, ve
**`vehicle-network-protocols` ailesini BİTİRİR** (14e `flexray`i kapatmıştı).

> **KAPI: ana brifin açık soru 1'i karara bağlanmadan BU ALT DALGA BAŞLAMAZ.**
> Girdi sözleşmesi kararı bu üç alt dalganın (14f, 14g, 14h) ortak zeminidir.

**Nabız konteyneri BURADA tanımlanır** — 14g ve 14h bu tanımı devralır, yeniden
tasarlamaz. Bu yüzden nabız üçlüsünün EN BAŞINA kondu: spec bu iki kayıt için
ÇALIŞILMIŞ sayısal örnek veriyor, yani konteyner ilk gün doğrulanabilir bir fixture'la
sınanabiliyor.

## Nabız-günlüğü girdi sözleşmesi (14f/14g/14h ORTAK)

Spec bu kayıtların girdisini bayt olarak DEĞİL nabız günlüğü olarak veriyor:

- J1850 PWM `:397`: *"Toolkit pulse-log tabanlı decoder sağlamalıdır."*
- J1850 PWM `:399`: *"Pulse 1: 8 us, Pulse 2: 16 us, Pulse 3: 8 us → seçilen J1850
  profiline göre Bit 1, Bit 0, Bit 1."*
- J1850 VPW `:411`: *"Örnek raw capture: Active 64 us, Passive 128 us, Active 64 us…"*

`ProtocolParser.parse(data: Uint8Array)` **KİLİTLİDİR** (`protocol-core/types.ts:181`,
CLAUDE.md kararı, 172 kaydı etkiler). `types.ts`e DOKUNULMAZ.

### Konteyner tanımı

Nabız günlüğü `Uint8Array` içine **sabit genişlikli little-endian alanlarla** konur:

- **Nabız başına 2 bayt, `Uint16LE`, birim 0.1 µs.** Üst sınır 6553.5 µs — SENT
  senkron darbesi (spec `:151` örneğinde 168 µs) ve J1850 SOF'u bu aralığın çok
  içinde.
- **Girdi uzunluğu ÇİFT olmalıdır**; tek uzunluk `truncated-frame` hatasıdır.
- **Değer 0 rezervedir** ("ölçülemedi / boşluk") ve alan tablosunda ham gösterilir,
  süreye çevrilmez.
- **Nabızlar KESİN SIRAYLA ardışıktır**; zaman damgası taşınmaz (damga `RawFrame`in
  işi).

**Bu bir tel biçimi DEĞİL, bir YAKALAMA KONTEYNERİDİR** ve depoda emsali vardır:
`canFrame.ts`in 16 baytlık SocketCAN çerçevesi de telin kendisi değildir
(`CAN_CLASSIC_FRAME_LENGTH = 16`, `canFrame.ts:64`) — depo bunu 25 kayıtta sorunsuz
taşıyor ve `isotp`/`j1939`/`devicenet` üçü de bu konteyneri girdi sayıyor.

**Konteyner dosya başında AÇIKÇA belgelenir**, "spec'ten geliyormuş" gibi
sunulmaz — `microwire.ts:1-10`un *"Bu dosya neden ötekilerden farklı"* bölümünün tonu
birebir emsaldir.

### `canParse` TUZAĞI — bu sözleşmenin gerçek bedeli

`canParse` 172 parser'a sırayla sorulur (`types.ts:174`: *"Ucuz ön eleme"*). **Nabız
konteyneri herhangi bir çift uzunluklu bayt dizisine uyar** — naif bir
`data.length % 2 === 0` kontrolü otomatik algılamayı çöpe çevirir ve başka
protokollerin çerçevelerini çalar.

**Kural: `canParse` yalnız protokolün KENDİ senkron imzası bulunursa `true` döner.**
J1850'de SOF darbesi, SENT'te kalibrasyon darbesinin ötekilere oranı. İmza
bulunamıyorsa `false` — CRC gibi tam doğrulama `parse`a bırakılır (sözleşmenin kendi
kuralı, `types.ts:176`).

## `decodeOptions` — bu kayıtların kaçınılmaz kanalı

Katalog yorumu bunu ZATEN yazmış (`automotive.ts:326`): *"Bit eşiği profile bağlıdır;
'8 us = 1' gibi sabitler evrensel değildir, decoder eşiği seçilen J1850 profilinden
almalıdır."* Spec `:512` de: *"toolkit hiçbirinde tek sabit evrensel değer
varsaymamalı."*

`microwire.ts`in gerekçesi birebir geçerli: *"Aynı dört bayt, 93xx46 x8 profiliyle
READ 0x2A, x16 profiliyle bambaşka bir şey. Tahmin etmek uydurmaktır."*

**PWM kanalı:**
- `bitThreshold` (`kind: 'number'`, birim µs, `min`/`max` ile) — kısa/uzun darbe ayrımı
- `profile` (`kind: 'select'`) — bir preset seçilirse sayı alanı YOK SAYILIR ve
  alan tablosunun İLK SATIRI yürürlükteki profili ADIYLA basar
  (`microwire.ts:20-26` deseni: *"bu sessiz bir davranış değil"*)

**VPW kanalı:**
- `bitThreshold` (aynı)
- `initialLevel` (`kind: 'select'`: `active | passive`, varsayılan `active`) —
  VPW'de bit anlamı *"aktif/passive state ile pulse duration'ın birlikte
  değerlendirilmesine bağlıdır"* (`:409`). Nabızlar KESİN ALTERNE ettiği için tek
  bilinmeyen ilk seviyedir; her nabıza seviye biti gömmek yerine tek şık sorulur.
  **Bu, konteynere bit çalmamak için bilinçli bir seçimdir.**
- `payloadInterpretation` (`raw | obd-ii`, varsayılan **`raw`**) — aşağı bak

**Varsayılanlar spec'in verdiği sayılardan alınır** (PWM 8/16 µs `:403`, VPW 64/128 µs
`:411`) ama **KODA SABİT OLARAK GÖMÜLMEZ**, `defaultValue` olarak bildirilir. Fark
önemli: varsayılan değiştirilebilir, sabit değiştirilemez.

## OBD-II zinciri — OPT-IN, sessiz DEĞİL

Spec `:413` zinciri açıkça istiyor: *"Toolkit zincirleme decode yapabilmelidir:
J1850 VPW → OBD-II → Mode → PID."*

Dalga 1/2 kararı ise üç dosyanın başında yazılı: *"üç motor (ISO-TP/UDS/OBD-II)
bağımsız çalışır, zincir parser katmanında kurulmaz"* (`obd.ts:4-6`, `iso9141.ts:7-10`,
`iso14230.ts:8-12`).

**Dalga 13d bu kuralı KOŞULLU olarak deldi ve emsal bıraktı:** `devicenet.ts` varsayılan
`raw`, kullanıcı `cip-explicit` seçerse AYNI `cipCore.ts` çağrılıyor
(`devicenet.ts:130-145`, `:331-336`). Gerekçe dosya başında (`:64-67`):
*"payload'ın explicit mesaj olduğu GERÇEKTEN çerçeveden çıkarılamıyor (kullanıcı sistem
bağlamından bilir)."*

**Uygulama:** varsayılan HAM + *"OBD-II sayfasında çözülür"* uyarısı; `obd-ii` şıkkı
seçilirse `parseObd`ın çözdüğü içerik alan tablosuna eklenir.
`obd.ts`in girdisi **HAM PDU baytıdır** (`obd.ts:4-6`: *"GİRDİ CAN ÇERÇEVESİ
DEĞİLDİR"*) — J1850 çerçevesinden çıkarılan veri alanı tam olarak budur, uyum var.
**Sessiz zincir YOK.**

`sae-j1850-pwm` için bu kanal AÇILMAZ — spec zinciri yalnız VPW için istiyor (`:413`),
PWM bölümü `:391-404` OBD'den hiç söz etmiyor.

## `CRC8_SAE_J1850` — hazır ve YETİM, ilk tüketici burası

`crcCatalogue.ts:48`: poly `0x1D`, init `0xFF`, refin/refout `false`, xorout `0xFF`.
`crcEngine.test.ts:20` `check` değerini (`0x4b`) zaten sınıyor.

**Tüketicisi YOK.** `grep -rn "CRC8_SAE_J1850" src/` yalnız katalog + test döndürüyor.
Bu kayıtlar İLK tüketici olur — dalga 12e'nin `berReader.ts` vakasının aynısı
(*"GOOSE için yazılmış, dalga 12 boyunca beklemişti, 12e'de NİHAYET kullanıldı"*).

**Ama: CRC'nin BAYTLAR üzerinde hesaplandığını unutma.** Nabızlardan çözülen bit
akışı önce baytlara paketlenir, CRC ondan sonra hesaplanır. Paketleme bit sırası
(MSB-first / LSB-first) **doğrulanmalıdır** — `bitCursor.ts:26` `BitOrder` bunu
parametreleştiriyor. Yanlış sıra küçük örneklerde doğru çıkıp uzun çerçevelerde
patlar (12e'nin OID tuzağının aynı sınıfı).

## Kaynak durumu

Spec `:391-414` bu ikili için **dalganın en iyi durumunu** veriyor: iki hız
(41.6 kbit/s PWM, 10.4 kbit/s VPW), çerçeve alanları (SOF, Header, Data, CRC, EOD,
EOF), **çalışılmış sayısal örnekler** (8.1 µs → Bit 1; 15.9 µs → Bit 0; Active 64 µs,
Passive 128 µs), hata sınıfları.

**VERMİYOR**: header semantiğini. Spec bunu kendisi söylüyor (`:401`): *"Exact header
semantics mesaj/uygulama standardına göre değişebileceğinden J2178/J1979 gibi üst
dokümanlarla eşlenmelidir."*

**Karar: header HAM kalır + uyarılır.** `j1939.ts`in SPN'i ham bırakmasıyla ve
`obd.ts`in PID'i isme bağlamamasıyla (`obd.ts:20-22`) aynı gerekçe: *"bağlamak,
spec'in vermediği eşlemeyi uydurmak olurdu."* J2178 tablosu bu dalganın kapsamı
değildir.

SAE J1850 **stabilized** durumda (`:393`) ve eski bir standart — kamuya açık ikincil
kaynak (Wireshark dissector, açık kaynak OBD kütüphaneleri) beklenenden az olabilir.
Yetersizse **kaynaksız kayıt politikası SORMADAN uygulanır**: `partial`, çerçeve
sınırları + CRC + bit çözümü çözülür, header ham kalır, özet metni açıkça yazar.

## Uygulama görevleri

1. `src/protocols/automotive/j1850/j1850Pulse.ts` — **konteyner çözücü**, iki kayıt
   PAYLAŞIR (nabız okuma, alterne seviye türetimi, bit akışı → bayt paketleme).
   Dosya başında konteyner sözleşmesinin TAM tanımı + neden icat edildiği.
2. `j1850Pulse.test.ts` — spec'in çalışılmış örnekleri fixture olarak
   (`8.1 µs → Bit 1`, `15.9 µs → Bit 0`, `Active 64 / Passive 128`).
3. `src/protocols/automotive/j1850/j1850Pwm.ts` + `j1850Vpw.ts` + testleri —
   **AYRI dosyalar** (12f'in `mqtt.ts` / `mqttSn.ts` kararı: akraba görünen iki biçim
   yan yana konur ki fark görünsün).
4. `src/protocols/index.ts` — iki `registerOnce` + yorum.
5. `automotive.ts:321` ve `:345` — `status`, `pluginId`.
6. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
7. `e2e/j1850-decode.spec.ts` — kanıtlanacaklar: eşik şıkkını değiştirmek ÇÖZÜLEN
   BİTİ değiştiriyor; `initialLevel` değişimi VPW'de alan tablosunu değiştiriyor;
   `payloadInterpretation: obd-ii` seçilince Data alanı kaybolup OBD alanları beliriyor
   (`devicenet-decode.spec.ts` birebir emsal); CRC PASS/FAIL ayrı satır.

## Devralınan tuzaklar

- **`canParse` imzasız `true` dönmesin** — yukarıdaki tuzak bölümü.
- **Bit → bayt paketleme sırası doğrulanmalı** (CRC bölümü).
- **`unit` fiziksel değere YAPIŞTIRILIR** — nabız süresi alanlarında `physicalValue`
  zaten "64.0" ise `unit: 'µs'` doğru; ama biçimlenmiş bir metne (`"Bit 1"`) `unit`
  VERME (12d/12e tuzağı: `"0d 01:00:00.00 cs"`).
- **`ParsedField.offset`/`length` BAYT cinsindendir** — nabız indeksi değil, o nabzın
  konteynerdeki 2 baytlık aralığı.
- **`ParsedField.id` KENDİ offset'ini kullanır** (`ftp.ts`/`rtcp.ts` vakaları).
- **DecodePanel tuzakları** — 14c brifindeki liste aynen geçerli.

## Model/effort önerisi

**Sonnet · high.** Karar 1 onaylandıktan sonra tarif netleşir: konteyner tanımlı,
`decodeOptions` deseni kurulu (`microwire.ts`), opt-in zincir deseni kurulu
(`devicenet.ts`), CRC hazır. Muhakeme gerektiren yerler (canParse imzası, bit sırası,
header'ın ham bırakılması) bu brifte listelenmiş.

**Karar 1 REDDEDİLİRSE** bu alt dalga kapsamı değişir: iki kayıt `partial` +
`calculatorIds` olur (14a deseni), motor `timing/` altına bir nabız-eşik hesabı olarak
yazılır ve model önerisi **Sonnet · medium**'a düşer.

**Tamamlanma ölçütü:** `vehicle-network-protocols` ailesinde `planned` kayıt KALMIYOR;
iki kayıt rozetleriyle açılıyor; `CRC8_SAE_J1850`in ilk tüketicisi testte doğrulanmış;
opt-in OBD zinciri e2e'de görünüyor; birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): konteyner → PWM → VPW, her biri çeviri +
test + e2e ile birlikte.
