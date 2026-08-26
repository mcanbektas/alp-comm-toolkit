# CLAUDE.md

Bu dosya, bu depoda çalışan Claude Code'a (claude.ai/code) yol gösterir.

## Depo ne, ne değil

**ALP Comm Toolkit** — haberleşme protokolleri için analiz, çözümleme ve protokol
geliştirme SPA'sı. ALP süitinin üç ürününden biri; hesap, veritabanı, API ve dağıtım
burada **değil**, `alp-platform` deposundadır.

| Depo | İçerik |
|---|---|
| **alp-comm-toolkit** (burası) | Comm SPA'sı — Vite + React 18 + TypeScript |
| **alp-platform** | `api/` (ASP.NET Core 9), `deploy/`, `design/` (tasarım token'ları + `@mcanbektas/design`) |
| **alp-pcb-toolkit** | PCB SPA'sı |

Kaynak spesifikasyon bu deponun `docs/spec/` klasöründedir: 43 bin satırlık ana doküman ve
12 parçalı özeti (`docs/spec/ozet/`). **Protokol ekleyecek ya da bir motoru yazacaksan önce
ilgili özet dosyasını oku** — alan kırılımları, formüller ve doğrulama fixture'ları oradadır.
Faz planı: `docs/plan-fazlar.md`.

## Komutlar

```bash
npm run dev          # http://localhost:3001
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # tsc --noEmit && vite build
```

**Port 3001'dir ve tek yerde değişmez** (`vite.config.ts`). PCB 3000'i tuttuğu için ikisi
aynı anda koşabilsin diye ayrıldı. `/api` istekleri `localhost:5289`e vekillenir — yani
platform deposunda `dotnet run --project api/Alp.Api` koşuyor olmalı; koşmuyorsa uygulama
açılır ama kimlik uçları sessizce 404 döner.

**Tasarım token'ları `@mcanbektas/design`dan gelir** ve paket henüz yayınlanmadığı için
`file:../alp-platform/design` ile bağlıdır. İki depo **kardeş dizin** olmak zorunda
(`~/Desktop/alp-comm-toolkit` ve `~/Desktop/alp-platform`). Token'ları değiştirdiysen
platform tarafında `npm run build` koşmadan burada göremezsin — `dist/` okunuyor,
kaynak değil.

## Mimari

Klasör yapısı spec §6'dan birebir alındı; boş klasörler ileride dolacak yerlerdir,
temizlik diye silme:

```
src/
  app/        router · providers · store · configuration · catalog
  components/ common · layout · navigation · forms · byte-viewer · packet-viewer ·
              signal-viewer · protocol-tree · charts · virtualized-tables
  connection/ serial · usb · bluetooth · websocket · file · mock
  protocol-core/ streams · buffers · framing · encoding · decoding · checksums ·
                 validation · statistics · timing · schemas
  protocols/  serial · industrial · automotive · marine · aerospace · building ·
              network · wireless
  features/   live-monitor · protocol-studio · packet-builder · log-analyzer ·
              protocol-converter · reverse-engineering · test-automation ·
              calculators · projects
  workers/ types/ constants/ utils/ translations/ pages/ styles/ tests/
```

**Protokol hesabı React bileşeninin içine yazılmaz.** Ayrıştırma, kodlama, checksum ve
mühendislik hesapları bağımsız, saf TypeScript modülleridir; bileşen yalnız gösterir.
Bu kural spec §6'nın tek zorunlu mimari maddesidir ve testlerin çalışabilmesinin sebebidir.

### Katalog

`src/app/catalog/` uygulamanın navigasyon iskeletidir: **8 domain → 54 aile → 172 protokol**,
saf veri. Her domain kendi dosyasında (`domains/<domainId>.ts`); `index.ts` bunları birleştirir
ve arama/çözümleme yardımcılarını verir.

Bu sayılar `src/tests/catalog.test.ts` tarafından bekçilenir. **172 sayısı kasıtlı tekrarları
içerir** — CANopen, Modbus, M-Bus, MQTT, CoAP, RTCM, NMEA gibi protokoller birden çok domain
sayfasında ayrı workspace olarak görünür. Tekrar eden kayıt `aliasOf` ile kanonik kaydı
gösterir; kanonik kayıtta bu alan yoktur. Yeni protokol eklerken alias yönünü ters çevirme,
arama sonuçları ikizlenir.

### Protocol Core

`src/protocol-core/types.ts` spec §7'nin **birebir** karşılığıdır: `RawFrame`, `ParsedField`,
`ParsedFrame`, `ParseResult` (discriminated union), `ProtocolParser`, `ProtocolEncoder<T>`,
`ProtocolPlugin`. Alan adlarını ve opsiyonellikleri değiştirme — 172 protokolün hepsi bu tek
sözleşmeye yazılacak, sonradan değiştirmenin bedeli her parser'a dokunmaktır.

`registry.ts` **lazy**'dir: plugin kayıt anında modülü yüklemez, bir loader saklar. 172
protokolün tamamı açılış bundle'ına giremez; kayıt ucuz, yükleme talep üzerine olmalı.

### Tema ve token

Tailwind 4 CSS-first kullanılıyor. Token'lar `src/styles/index.css` içinde `@theme inline`
ile utility'ye çevrilir; `inline` olması önemli — üretilen sınıflar değeri kopyalamak yerine
`var()`a başvurur, böylece `data-theme` değişince renk yeniden derlemeye gerek kalmadan döner.

**Ham renk yazma.** `#1f2937`, `bg-slate-800`, `text-gray-500` yasak; yalnız token
utility'leri (`bg-surface`, `text-muted`, `border-line`, `text-series-1` …). Tema
`<html data-theme="light|dark">` ile seçilir; attribute yoksa `prefers-color-scheme` geçerlidir.

### Çeviri

Arayüz varsayılanı Türkçe, İngilizce desteklenir. `src/translations/tr.ts` **kaynak
sözlüktür**; `en.ts` tipi ona bağlıdır, yani eksik İngilizce anahtar derleme hatasıdır.
Görünen hiçbir metin koda gömülmez. Protokol ve araç adları veridir, çeviriye girmez.

## Kurallar

- **Kod yorumları Türkçe, tanımlayıcılar İngilizce.** Değişken, fonksiyon, dosya, tip ve
  test adları İngilizce; yorumlar Türkçe. Yorum "ne yaptığını" değil, koddan okunamayanı
  yazar: değişmez, tuzak, neden bu seçim.
- **`any` yok, `@ts-ignore` yok.** tsconfig `strict` + `noUncheckedIndexedAccess` +
  `verbatimModuleSyntax` ile koşar. `noUncheckedIndexedAccess` bayt dizisi işleyen kodda
  bilerek açık: `bytes[i]` tipi `number | undefined`, guard yaz.
- **Yeni bir motor yazarken fixture'ını da yaz.** Spec §43'te doğrulanmış referans değerler
  var: CRC (`123456789` → 0xF4 / 0x29B1 / 0x4B37 / 0xCBF43926), UART timing (115200 8N1,
  20 bayt ≈ 1.736 ms), Modbus RTU (`01 03 00 00 00 02 C4 0B`), NMEA GGA, J1939
  (`0x18F00401` → PGN 61444), IEEE-754 (25.75 → `41 CE 00 00`).
- **Kullanıcı verisi yerelde kalır.** Seri port mesajları, CAN logları, protokol tanımları,
  ağ paketleri ve şifreleme anahtarları sunucuya gönderilmez. `eval` ve dinamik kod
  çalıştırma yasak — kullanıcı tanımlı formül özelliği sandbox'sız yazılamaz.
- **Ağır iş Web Worker'a.** 100 bin satırlık log arayüzü dondurmamalı; canlı akış UI
  thread'ini bloklamamalı; büyük tablolar sanallaştırılmalı; uzun analizler iptal edilebilmeli.
- **Sırlar depoya girmez.**

## Bilinen borçlar

- `@mcanbektas/design` GitHub Packages'a yayınlanmadı; `file:` bağı ve CI'daki iki-checkout
  düzeni bunun sonucudur. Faz 4'te yayınlanınca ikisi de sadeleşir.
- Katalogdaki 172 kaydın **ham `status` dağılımı (2026-08-26, dalga 17'den sonra,
  KODDAN doğrulandı — tek kullanımlık sayım script'i)
  124 `ready` / 19 `planned` / 29 `partial`**, ama ham sayı yanıltıcı: 15 alias kaydın
  hepsinde `status` `planned` yazarken kanonik kayıt `ready`. Alias zinciri çözülünce
  **139 `ready` / 4 `planned` / 29 `partial`**; gerçekten yapılacak iş **4 kanonik
  kayıt** ve dördü de AYNI domain'de (wireless-iot — thread, wifi, esp-now,
  rf-telemetry-custom-frame). **Geriye TEK domain kaldı.** **`network-ethernet` (19 kayıt) dalga 12 ile TAMAMEN
  KAPANDI** (12a-12h, `docs/plan-fazlar.md`); **`industrial-automation` (25 kayıt) dalga
  13 ile TAMAMEN KAPANDI** (13a wireless-m-bus + 13b iec-60870-5-101 + 13c opc-ua + 13d
  cip/ethernet-ip/devicenet + 13e profinet + 13f powerlink/sercos-iii/cc-link-ie + 13g
  profibus-dp/cc-link/as-interface/foundation-fieldbus + 13h io-link/hart — 8 alt dalga,
  16 kanonik kayıt, 12 `ready` + 4 `partial`); domain'in 8 ailesi de (`modbus`,
  `metering`, `scada-utility`, `cip-can-based`, `industrial-ethernet`,
  `classic-fieldbus`, `sensors-device-integration`, `process-instrumentation`) kapandı.
  **`automotive` (25 kayıt) dalga 14 ile TAMAMEN KAPANDI** (14a automotive-ethernet/
  k-line + 14b xcp-on-can + 14c xcp-on-ethernet/ccp + 14d some-ip + 14e flexray +
  14f sae-j1850-pwm/vpw + 14g sent/spc + 14h psi5 — 8 alt dalga, 12 kanonik kayıt;
  domain toplamı 18 `ready` + 6 `partial` + 1 alias, `planned` KALMADI); domain'in 7
  ailesi de (`can-family`, `vehicle-network-protocols`, `sensor-interfaces`,
  `legacy-diagnostics`, `diagnostics`, `automotive-ethernet`, `calibration`) kapandı.
  **`aerospace-uav` (16 kayıt) dalga 15 ile TAMAMEN KAPANDI** (15a dronecan + 15b
  cyphal/uavcan-compatibility + 15c sbus/ibus + 15d crsf + 15e ppm/pwm-servo +
  15f arinc-429 + 15g mil-std-1553 + 15h mode-s/ads-b — 8 alt dalga, 12 kanonik
  kayıt, 8 `ready` + 4 `partial`); domain toplamı 11 `ready` + 5 `partial` +
  3 alias, `planned` KALMADI. Dokunulmayan tek aile `gnss-navigation`dı: üç kaydı
  da ALIAS'tır ve yönü `marine-navigation`a bakar, `resolveStatus()` `ready` çözer.
  **`marine-navigation` (11 kayıt) dalga 16 ile TAMAMEN KAPANDI** (16a
  hdlc-based-marine + 16b seatalk + 16c iec-61162 — 3 alt dalga, 3 kanonik
  kayıt, 1 `ready` + 2 `partial`); domain toplamı **6 `ready` + 2 `partial` +
  3 alias**, `planned` KALMADI.
  **`building-automation` (11 kayıt) dalga 17 ile TAMAMEN KAPANDI** — YEDİNCİ
  kapanan domain (tek commit, alt dalga YOK, 1 kanonik kayıt: `lonworks`,
  `partial`); domain toplamı **7 `ready` + 1 `partial` + 3 alias**, `planned`
  KALMADI. Kalan TEK domain `wireless-iot` (4 kanonik kayıt); sıradaki domain
  seçimi YAPILMADI ve zaten seçenek kalmadı. **`partial` rozetli kayıtların ÇOĞU bilinçli kapsam kararıdır, eksik
  iş değil**: `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only (Field Basic ayrı
  taşıyıcı), `cc-link` link-cihazı görüntüsü (telgraf biçimi kamuya açık değil),
  `as-interface` klasik-only (ASi-5 ayrı katman), `foundation-fieldbus` HSE-only (H1'in
  sınırlayıcıları bayt bile değil), `psi5` yukarı-yön-tek-çerçeve (slot zaman çizelgesi
  çerçevede YOK), `ads-b` 1090ES-only (978 MHz UAT ayrı bir tel biçimi: farklı
  çerçeveleme, farklı FEC), `iec-61162` `UdPbC`-only (`-450`nin İKİNCİ teli olan
  `RaUdP`/`RpUdP`/`RrUdP` binary dosya transferi ayrı bir tel biçimidir; Ed.2'nin
  PGN kapsüllemesinin token'ı ve `a:` authentication tag'inin biçimi kamuya açık
  DEĞİL), `lonworks` ISO/IEC 14908-4 (CN/IP) tek-tel — gerekçeler ilgili `.ts`
  dosyalarının başında ve `docs/plan-fazlar.md`nin 13g/14h/15h/16c/17
  notlarında.
  **`lonworks`un kapsam gerekçesi bu listedeki ötekilerden FARKLI bir cinstir
  ve ayrımı korumak şart** (dalga 17): 14908-2/-3'ün ham L2 çerçevelemesi
  **belgesiz DEĞİL** — biçimi normatif Echelon spec'inin Figure 3.2'sinde ve
  CRC bölümünde TAM olarak var. Eksik olan **YAKALAMA YOLU**: libpcap'te
  LonTalk için `DLT_` yok, Wireshark'ın link katmanı girişi yok, kamuya açık
  ham L2 yakalaması yok — bir `Uint8Array`e ham LonTalk L2 çerçevesinin
  girmesinin kamuya açık bir yolu yoktur. Birinci sınıf kaynağın kendi
  mimarisi bunu doğruluyor: `packet-lon.c`in TEK giriş noktası
  `dissector_add_uint("cnip.protocol", 0, lon_handle)`. **"Belgesiz" ile
  "erişilemez" ayrı gerekçelerdir**; ikincisi bir sonraki nesle "ara, bulunur"
  demez. `lonworks`un rozetine katkı veren öteki üç kalem: SNVT tipi telde YOK,
  XIF paneli yazılmadı (aşağıdaki borç), Gateway Mapping analyzer işi.
  **XIF parser'ı + `xif` `definitions` paneli YAZILMADI ve bu bir BORÇTUR**
  (dalga 17). Biçim BELGELİ; kaynakları burada listeli ki bir sonraki nesil
  aramak zorunda kalmasın: LONMARK Device Interface File Reference Guide rev
  4.501 (`lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf`, girişsiz,
  429 KB), `izot/shortstack`ta ~20 gerçek `.xif` örneği, `g3gg0/LonScan`ın
  açık C# parser'ı (~250 satır, sabit satır atlamalarıyla kırılgan).
  Yazılmama gerekçesi `[Karar 15h-1]`in aynısı: domain'i KAPATAN dalgada
  ikinci bir motor riski artırır. `definitions` sekmesi bu yüzden "planlandı"
  basıyor ve BU DOĞRU DAVRANIŞTIR (`ProtocolPage.tsx`in `DEFINITION_PANELS`inde
  `xif` yok; emsal `lin` ve `arinc-429`, ikisi de `ready`);
  `e2e/lonworks-decode.spec.ts` bunu sınıyor. `seatalk` bu sınıftan
  DEĞİLDİR: rozeti kaynak güvenilirliğinden ve komut bitinin çerçevede
  taşınmamasından geliyor (aşağıda).
  **Aynı 24 bitin ANLAMI çerçeveden çerçeveye değişebilir ve tek bir gösterge
  ikisini de yanlış anlatır** (dalga 15h): Mode S'te DF11/17/18'in PI alanı düz
  CRC'dir ve PASS/FAIL doğrulanır, ama DF0/4/5/16/20/21'in AP alanı
  CRC ⊕ ICAO adresidir ve pasif dinleyici ikisini AYIRAMAZ — adres çıkarılır ama
  çürütülemediği için doğrulanmış da değildir. O çerçevelerde `mode-s`
  CRC PASS/FAIL alanını HİÇ BASMAZ; basıp "doğrulanamadı" demek olmayan bir
  ölçümü varmış gibi göstermek olurdu. Dalga 13 dersi 3'ün (`gösterilir ≠
  doğrulanır`) en sert biçimi ve `modeS.ts` dosya başında yazılı. `hart` ve `io-link` (13h) ikisi de `ready`:
  HART'ın checksum'ı `lrc.ts` DEĞİL, paylaşılan `xor8Checksum`; IO-Link'in 6-bit
  checksum'ı resmi spec formülüyle (seed+XOR+8→6 bit sıkıştırma) doğrulanır ve
  `messageSide` adlı yeni bir `decodeOptions` deseniyle (alan YERLEŞİMİNİ değiştiren
  seçenek — `ccLink.ts`/`iec101.ts` emsalinin genişletilmiş hâli) Master/Device
  mesajları ayrı çözülür — ikisinin gerekçesi `hart.ts`/`ioLink.ts` dosya başında ve
  `docs/plan-fazlar.md`nin 13h notunda.
  **Aynı bit genişliği aynı CRC algoritması DEĞİLDİR ve bu artık ÖLÇÜLMÜŞ bir kural**
  (dalga 13 dersi 2'nin 14g/14h'teki iki uygulaması): 14g'de `CRC4_ITU` SENT'in
  nibble-özyinelemeli CRC-4'ü için reddedildi; 14h'te PSI5'in 3 bitlik CRC'si
  `crcEngine.ts`in "direct" döngüsüne aynı polinom ve aynı seed'le konulduğunda 1024
  olası yükün SIFIRINDA doğru sonuç veriyor (`psi5.test.ts` bu sayıyı bekçiliyor) —
  doğru karşılık augmented topoloji ya da seed `010`. **15h aynı kuralın
  yedinci vakasıdır ve tek seferde DÖRT sahte dost reddetti**: Mode S'in CRC-24'ü
  (`CRC24_MODE_S`, poly 0xFFF409, init 0) katalogdaki dört 24-bit girdinin
  (`CRC24`, `CRC24_Q`, `CRC24_FLEXRAY_A/B`) HİÇBİRİ değildir ve dördü de burada
  hata VERMEDEN yanlış sonuç üretirdi. Yeni bir CRC'yi
  `crcCatalogue.ts`ten almadan önce YAYIMLANMIŞ bir test vektörüyle sına —
  **topolojiyi de sına**: 15h'te motorun direct (non-augmented) döngüsü, aynı
  çağrıdan geçen CRC-24/OPENPGP'nin yayımlanmış check değerini (0x21CF02)
  üretmesiyle kanıtlandı; Mode S'te `init = 0` olduğu için augmented ve direct
  aynı sonucu veriyor ama bu bir ŞANS, bir kanıt değil.
  **Paylaşılan çekirdek deseni ÜÇÜNCÜ kez kanıtlandı** (dalga 16a):
  `hdlcCore.ts` dalga 10c'de "paylaşılan çekirdek" ilan edilmişti ve
  `hdlc-based-marine` onun üçüncü tüketicisi oldu — kod KOPYALANMADI, çekirdeğe
  DOKUNULMADI, iki mevcut tüketici yeşil kaldı. Aynı dalga bunun negatifini de
  gösterdi: `seatalk` HİÇBİR çekirdeği tüketmez ve bu bir eksiklik değil,
  protokolün kendisidir (`ccp.ts`in reddettiği türden bir birleştirme aranmadı).
  **Aynı POLİNOM aynı algoritma değildir** (16a): katalogda poly `0x1021` olan
  DÖRT giriş var ve yalnız `CRC16_X25` HDLC'dir — `CRC16_KERMIT`
  (`init=0 xorout=0`, check `0x2189`) ve `CRC16_CCITT_FALSE` sahte dosttur.
  "Aynı bit genişliği aynı algoritma değildir" kuralının polinom düzeyindeki eşi.
  **İki kaynak çelişirse KAZANAN kendi içinde ARİTMETİK olarak doğrulanabilendir**
  (dalga 16b): SeaTalk'ta Knauf ile SignalK ÜÇ yerde çelişti (0x85 XTE nibble
  sırası, 0x20 hızın bayt sırası, 0x84/0x9C başlık düzeltme terimi) ve üçünde de
  kaynağın KENDİ worked example'ıyla tutarlı okuma alındı; iki okuma gerçekten
  ayrıştığında alan `headingCorrectionAmbiguous` gibi bir uyarı TAŞIR. Aynı
  dalgada `C7` fantom komutu reddedildi — kaynağın metninde geçen her bayt bir
  komut DEĞİLDİR.
  **`canParse` yanlış pozitifi BRİF AŞAMASINDA ölçülebilir** ve dalga 16'da
  ölçüldü: 870 örnek üzerinde `seatalk` naif imza 27 / dar imza 7,
  `hdlc-based-marine` 6, `iec-61162` **0**. Üç kayıttan ikisi bu yüzden DAİMA
  `false` döner, üçüncüsü `true` döner — karar tahminle değil SAYIYLA verildi ve
  üçünün de bekçi testi ölçümü kodda TEKRARLAR. **Bekçi testi artık iki yönlü
  çalışıyor**: `false` dönenlerde "yazılsaydı kaç çerçeve çalardı", `true`
  dönende "bugün hâlâ sıfır mı" (16c, 143 kayıt / 886 örnek → 0).
  **"Paywall" bir arama-durdurma gerekçesi DEĞİLDİR** (dalga 17): `lonworks`
  "spec'i üyelik arkasında, `seatalk` sınıfı kaynaksız kayıt" hipoteziyle
  girildi ve hipotez TAMAMEN çürüdü — normatif Echelon LonTalk Protocol
  Specification v3.0 ücretsiz (112 sayfa), tam yığın MIT
  (`izot/lon-stack-ex` = orijinal Echelon LonTalk Stack), SNVT master listesi
  açık (221 tip), XIF referans kılavuzu açık, 12.028 çerçevelik gerçek
  yakalama açık. Keşif turu "spec ücretli" diye kaynak aramayı BIRAKMAZ.
  **Kaynak hiyerarşisi kağıt üzerinde değil ALAN ALAN işler ve Wireshark
  ÜÇÜNCÜ sınıf olabilir** (dalga 17): `packet-lon.c`/`packet-cnip.c` birinci
  sınıf sanılıyordu; normatif spec gelince ÜÇ yerde ondan sapıldı, AuthPDU
  maskeleri kaynağın KENDİ `TODO`suyla bozuk çıktı, CRC'si `#if 0` içindeydi
  ve NM/ND yanıtlarını yanlış etiketliyordu. Üstelik bir yerde (adres biçimi
  2b'nin +4 alanı) **bozuk sanılan `go-lon` HAKLI** çıktı — hakem Figure 3.2.
  Bir çelişkide hakem daima normatif metindir; "hangi kaynak birinci sınıf"
  sorusu KAYIT BAŞINA değil ALAN BAŞINA cevaplanır.
  **Aynı dosyadaki YORUM ile KOD ayrışabilir; KOD kazanır** (dalga 17, İKİ
  KEZ): `LtIpPackets.h:264`ün yorumu `extndHdrSize` için *"size of header -
  20"* derken aynı sınıfın `.cpp`si *"a count of 4-byte values"* deyip `*4`
  yapıyor; `packet-lon.c:395`in `TODO`su maskeyi yanlış öneriyor ama çıkarım
  kodu doğru. **Alan tarifini yorumdan değil çalışan koddan al** — birincisi
  LonTalk PDU'sunu üç bayt kaydırırdı, hata VERMEDEN.
  **Aynı polinom + aynı init + aynı yansıma bile aynı algoritma değildir**
  (dalga 17, 16a dersinin en keskin hâli): LonTalk'ın CRC'si `CRC16_GENIBUS`
  (check `0xD64E`) ve `CRC16_CCITT_FALSE`tan **YALNIZ `xorout`ta** ayrılıyor
  (check `0x29B1`). Katalogda ikisi de var; birini ötekinin yerine almak hata
  VERMEDEN yanlış PASS/FAIL basar. `CRC16_X25` de aday gibi görünür ama
  YANSITIR.
  **Semantik tip telde olmayabilir** (dalga 17, KNX DPT ilkesinin İKİNCİ
  vakası): LonTalk NV mesajı yalnız 14 bitlik bir SELECTOR taşır ve selector
  cihazın bağlama tablosundaki bir İNDEKSTİR, tip DEĞİLDİR. Aynı iki bayt
  (`00 CA`) beş ayrı mühendislik değeri veriyor (−253.8 °C / 2.02 °C / %1.01 /
  20.2 A / 202). Tip `decodeOptions` kanalıdır, seçilmediğinde değer HAM kalır
  ve seçildikten SONRA DA `nvTypeNotOnWire` uyarısı düşer — seçim bir ölçüm
  değil, bir bildirimdir.
  **Bir kaydın "kendi teli var mı" sorusu KEŞİFTE cevaplanmalıdır** (16c):
  `iec-61162` sınıflandırıcı sanılıyordu (`uavcan-compatibility` emsali,
  `canParse` daima `false`), keşif turu `-450`nin gerçek telini beş bağımsız
  uygulamada bulunca kayıt gerçek bir parser'a döndü ve `canParse` `true` oldu.
  Yanlış sınıflandırma yalnız bir motoru değil, rozeti, `decodeOptions` yüzeyini
  ve bekçi testinin YÖNÜNÜ de değiştirirdi.
  **Aynı çerçevede İKİ checksum farklı bayt aralığı kapsayabilir** (16c):
  IEC 61162-450'de TAG bloğunun `*hh`si `\`…`*` arasını, gömülü cümleninki
  `$`/`!`…`*` arasını kapsar; algoritma AYNI (NMEA XOR), kapsam FARKLI. Tek bir
  "cümleyi bul, checksum'ını doğrula" fonksiyonuyla çözmek HATA VERMEDEN yanlış
  PASS/FAIL basar. İki aralık iki AYRI modülde yaşar (`lweTagBlock.ts` ve
  `iec61162.ts`) ve iki örnek çerçeve (biri TAG'i, öteki cümleyi bozuk) ayrımı
  ekranda kanıtlar.
  **Durum rozeti her zaman `resolveStatus()`ten okunur, ham `protocol.status`tan değil** —
  aksi hâlde çalışan bir motorun üstünde "Planlandı" yazar (`FamilyPage` bunu yapıyordu,
  dalga 11 sonunda düzeltildi; `FamilyPage.test.tsx` bekçilik ediyor).
  O sekmeler görünür ama içleri "planlandı" bildirimi taşır. **Boş kart basmak yasak** —
  bir sekme açılıyorsa ya gerçek bir motoru vardır ya da neyin geleceğini söyler.
