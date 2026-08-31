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
(`~/dev/alp-comm-toolkit` ve `~/dev/alp-platform`). Token'ları değiştirdiysen
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
- **🏁 KATALOG BORCU SIFIRLANDI (2026-08-27, dalga 18e) — kanonik `planned`
  kayıt KALMADI.** Bu, deponun tarihinde ilk kez katalogdaki her kaydın ya bir
  motoru olduğu ya da kanonik bir kayda alias'landığı anlamına gelir.
  **8 domain · 54 aile · 172 kayıt**, hepsi kapalı; dalga 10'dan 18'e uzanan
  zincirin sonu.

  Katalogdaki 172 kaydın **ham `status` dağılımı (2026-08-27, dalga 18e'den
  sonra, KODDAN doğrulandı — tek kullanımlık sayım script'i)
  125 `ready` / 15 `planned` / 32 `partial`**, ama ham sayı yanıltıcı: **15 alias
  kaydın hepsinde `status` `planned` yazarken kanonik kayıt `ready` ya da
  `partial`dır** — ham `planned` sayısının sıfır OLMAMASININ tek sebebi budur ve
  bir borç DEĞİLDİR (`resolveStatus()` rozeti kanonik kayıttan okur, `FamilyPage`
  ve `ProtocolPage` ikisi de oradan basar). Alias zinciri çözülünce
  **140 `ready` / 0 `planned` / 32 `partial`**; **gerçekten yapılacak kanonik iş
  SIFIR.** Domain dağılımı (çözülmüş, ready+partial):
  `interfaces-framing` 34+6 · `industrial-automation` 20+5 · `automotive` 19+6 ·
  `marine-navigation` 9+2 · `aerospace-uav` 11+5 · `building-automation` 10+1 ·
  `network-ethernet` 28+0 · `wireless-iot` 9+7. **`network-ethernet` (19 kayıt) dalga 12 ile TAMAMEN
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
  KALMADI.
  **`wireless-iot` (16 kayıt) dalga 18 ile TAMAMEN KAPANDI — SEKİZİNCİ ve SON
  kapanan domain** (18a wifi MAC katmanı + 18b wifi yönetim gövdeleri/IE +
  18c esp-now + 18d thread + 18e rf-telemetry-custom-frame — 5 alt dalga,
  4 kanonik kayıt: 1 `ready` (`esp-now`) + 3 `partial`); domain toplamı
  **9 `ready` + 7 `partial` + 3 alias**, `planned` KALMADI.
  Sıradaki domain seçimi YAPILMADI ve **zaten seçenek kalmadı**: bir sonraki iş
  sınıfı katalog DIŞIDIR (çerçeveler-arası panolar, `custom-schema` paneli) ve
  seçim kullanıcınındır. **Log Analyzer (§34) YAZILDI** ve `pcap.ts` artık
  tüketicisiz değil: `src/protocol-core/logs/` (biçim ayrıştırıcıları + filtre +
  istatistik + dışa aktarım), `src/workers/logAnalyzer.worker.ts`,
  `src/features/log-analyzer/`, rota `/log-analyzer`. Okunan biçimler: pcap,
  candump, Vector ASC, CSV/ayraçlı, JSON/NDJSON, hex metin dökümü, ham ikili.
  **PCAPNG hâlâ desteklenmiyor** — ayrı bir dosya formatıdır, tanınır ve
  yönlendirici bir mesajla reddedilir.
  **Dosya oynatma (spec §8.1) da yazıldı**: `src/connection/file/` aynı
  `ByteSource` sözleşmesini gerçekler ve `logs` çekirdeğinden çıkan kayıtları
  monitörün canlı zincirine besler. (Bu satır 2026-08-30'da çürüdü: `usb` ve
  `bluetooth` de doldu, aşağıdaki 13. maddeye bak — `connection/`de boş
  klasör KALMADI.)
  **Unknown Protocol Analyzer (spec §35 + §36) YAZILDI**: `src/protocol-core/analysis/`
  (11 saf motor + ortak okuma/tip modülleri + 10 fazlı iptal edilebilir koşucu +
  Worker'a kopyasız aktarım),
  `src/workers/reverseEngineering.worker.ts` + `analyzeInWorker.ts`,
  `src/features/reverse-engineering/`, rota `/reverse-engineering`. §35'in 13
  maddesinin hepsi ve §36'nın fark/rol tablosu karşılandı; fixture uydurulmadı,
  spec'in kendi örnekleri (35060 RF seti, 39339-39353, 16283 gyro) kullanıldı.
  Kararlar ve eşikler `docs/ozellik-reverse-engineering.md`de — özellikle
  **k-means'in reddi** (bayt değeri metrik uzayda anlamsız, rastgele başlangıç
  determinizmi bozar), **checksum'da ölçütün tek çerçeve değil ORAN olması**
  (28 algoritma × konum denendiği için tek çerçevelik uyum tesadüftür) ve
  **"bilinmiyor" ile "sıfır"un her yerde ayrı tutulması**.
  **Test Automation Studio (spec §38) YAZILDI**: `src/features/test-automation/`
  (13 adım tipi, yapılandırılmış koşul modeli, iptal edilebilir adım makinesi,
  `ByteSource` köprüsü, §40 proje dosyası bağı), `src/connection/mock/
  simulatedDevice.ts` (kural tabanlı, `canWrite: true`), rota
  `/test-automation`. Kararlar `docs/ozellik-test-automation.md`de — özellikle
  **ifade dili yerine yapılandırılmış koşul** (§41 39563-39564 `eval` ve dinamik
  kod yasağı; küçük bir ayrıştırıcı yazmak yasağın harfini kurtarıp ruhunu
  çiğnerdi), **koşulun üç cevabı** (`unresolved`u `false` saymak testi sessizce
  yeşil geçirirdi) ve **sonsuz loop'un İKİ sınırı** (döngü sayısı + toplam adım
  bütçesi; iç içe üç döngü tek tek sınırın altında kalıp çarpımda milyarlara
  çıkabilir). §40'ın "Test scenarios" yuvası METİN taşır ve `formatVersion` 1'de
  KALDI: sürümü artırmak, salt ekleme yapan bir değişiklik için var olan bütün
  proje dosyalarını reddetmek olurdu.
  `features/` altında hiç açılmamış TEK klasör kaldı: `protocol-converter`
  (§33). Bekletilmesi bilinçli: 191 plugin dosyasından yalnız 14'ünde `encoder`
  var (13'ü `serial/framing`, biri `wireless/rftelemetry`; TÜKETİCİLERİ
  2026-08-29'da yazıldı, aşağıdaki 3. madde), yani §33'ün saydığı sekiz dönüşümün HEDEF tarafı
  (Modbus, MQTT, NMEA, DBC, J1939, BACnet) yazılmamış; üstüne iki bağlantıyı
  aynı anda tutan köprü katmanı ve MQTT/UDP taşıması da yok. §33 ayrıca §46'nın
  geliştirme sırasında ve §50'nin revize ana sayfa kategorilerinde HİÇ geçmiyor,
  §38 ikisinde de adıyla var.
  **`partial` rozetli kayıtların ÇOĞU bilinçli kapsam kararıdır, eksik
  iş değil**: `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only (Field Basic ayrı
  taşıyıcı), `cc-link` link-cihazı görüntüsü (telgraf biçimi kamuya açık değil),
  `as-interface` klasik-only (ASi-5 ayrı katman), `foundation-fieldbus` HSE-only (H1'in
  sınırlayıcıları bayt bile değil), `psi5` yukarı-yön-tek-çerçeve (slot zaman çizelgesi
  çerçevede YOK), `ads-b` 1090ES-only (978 MHz UAT ayrı bir tel biçimi: farklı
  çerçeveleme, farklı FEC), `iec-61162` `UdPbC`-only (`-450`nin İKİNCİ teli olan
  `RaUdP`/`RpUdP`/`RrUdP` binary dosya transferi ayrı bir tel biçimidir; Ed.2'nin
  PGN kapsüllemesinin token'ı ve `a:` authentication tag'inin biçimi kamuya açık
  DEĞİL), `lonworks` ISO/IEC 14908-4 (CN/IP) tek-tel, `wifi` FCS'li çıplak 802.11 MAC + yönetim gövdeleri (radiotap/PPI/Prism/AVS AYRI link-type'lardır, şifreli gövde AÇILMAZ), `thread` şifresiz MLE Discovery-only (öteki MLE komutları anahtar olmadan OKUNAMAZ, `[KARAR 18-3]`), `rf-telemetry-custom-frame` demodüle-bayt-only (bit akışı / nabız süresi / SDR dışa aktarımı birer GİRDİ DÖNÜŞÜMÜdür, `decodeOptions` şıkkı değil) — gerekçeler ilgili `.ts`
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
  demez. `lonworks`un rozetine katkı veren öteki iki kalem: SNVT tipi telde
  YOK, Gateway Mapping analyzer işi.
  **✅ KAPANDI: XIF parser'ı + `xif` `definitions` paneli YAZILDI** (2026-08-31,
  `docs/brief-xif-definitions-panel.md`). Eski not "YAZILMADI, BORÇTUR" diyordu;
  artık geçersiz. Söz dizimi kaynağı LONMARK Device Interface File Reference
  Guide rev 4.501 (`lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf`,
  girişsiz) + `g3gg0/LonScan`ın açık C# parser'ı (yalnız alan listesi için
  çapraz referans; satır atlama mantığı KOPYALANMADI, kaynağın kendi notuna
  göre kırılgan). **Brifin fixture kaynağı varsayımı ÇÜRÜDÜ**: `izot/shortstack`
  deposundaki 20 `.xif` dosyasının HEPSİ okundu ve hepsi ShortStack microserver
  arayüzü — statik NV sayısı hepsinde 0, bir NV tablosu panelinin açılış örneği
  olamazlardı (ölçüm `xifFixture.ts` dosya başında). Fixture bunun yerine
  Continental Control Systems'in gerçek, üretici-yayımlı `WNC-FT-B-303.XIF`
  dosyası (WattNode güç ölçer, 28 NV, 6 config-class, kısaltılmadı); bir
  `izot/shortstack` dosyası da "sıfır NV geçerlidir" testi için ayrıca tutuldu.
  `ProtocolPage.tsx`in `DEFINITION_PANELS`inde `xif` artık VAR (onuncu panel);
  `e2e/lonworks-decode.spec.ts`in eski "planlandı basar" testi bu yüzden
  güncellendi, ayrıntılı tur `e2e/xif-definitions.spec.ts`te. Rozet yine
  `partial` ve ÖYLE KALMALI: XIF borcu kapandı ama SNVT tipi telde yok +
  Gateway Mapping analyzer maddeleri duruyor. **Hex çöz alt aracı BİLİNÇLİ
  EKLENMEDİ** (EDS panelinin aksine): NV mesajı telde yalnız 14 bitlik selector
  taşır, tip bilgisi taşımaz; üstelik gerçek fixture'da NV'lerin yalnız
  %14'ü (4/28) skaler SNVT tablosunda çözülebiliyor — ölçüldü. Yetenek zaten
  `lonworks`un `decode` sekmesindeki `nvType` `decodeOptions` kanalında var,
  ikinci bir bildirim noktası ayrışma riski olurdu. Gerekçenin tamamı
  `XifPanel.tsx` dosya başında. `seatalk` bu sınıftan DEĞİLDİR: rozeti kaynak
  güvenilirliğinden ve komut bitinin çerçevede taşınmamasından geliyor
  (aşağıda).
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

  ### Dalga 18'in kalıcı dersleri

  **Bir yakalamanın LINK-TYPE'ı içinde ne olduğunun cevabı DEĞİLDİR** (18d):
  `6LoWPAN.pcap` DLT 1'dir (Ethernet) ama içinde ZEP v2 ile taşınan 331 gerçek
  802.15.4 çerçevesi vardır ve FCS'leri **331/331** doğrudur. Bir kaynağı zarf
  tipine bakıp elemek, dalga 17'nin "spec ücretli diye aramayı bırakma"sının
  konteyner düzeyindeki eşidir.
  **Kapsam çizgisini libpcap'in link-type tablosu ÇİZEBİLİR** (18a): radiotap
  802.11'den ayrı bir DLT'dir (105 ↔ 127) ve FCS varlığı 802.15.4'te bir DLT
  ayrımıdır (195 ↔ 230). *"Bu ayrı bir konteyner"* iddiası artık
  KANITLANABİLİR bir iddiadır.
  **`canParse`ı CHECKSUM taşıyabilir** (18a/18d): hem `thread` (T4) hem `wifi`
  (W12) yalnız FCS sayesinde 0 çakışmaya iniyor; FCS'siz aynı imzalar 18 ve
  216. **Checksum bir doğrulama alanı OLMAKLA KALMAZ, bir KİMLİK alanıdır.**
  **Yorum ile kod ayrışırsa KOD kazanır — ÜÇÜNCÜ vaka ve ilk kez BİRİNCİ SINIF
  bir uygulamada** (18d): OpenThread'in `SecuritySuite` enum yorumları takas
  edilmiş (`mle.hpp:1498-1502`); doğru anlam yalnız `mle.cpp`nin kullanımından
  okunur. Yanlış okuma "şifreli"yi "şifresiz" sanıp ciphertext'i alan olarak
  basardı.
  **DEPONUN KENDİ SPEC'İ DE BİR KAYNAKTIR VE ÇÜRÜYEBİLİR** (18e, yeni sınıf):
  `docs/spec/ozet/09-kablosuz-iot.md:171`in CRC'si (`C9 21`) **65.535 polinomun
  hiçbiriyle** (init/yansıma/xorout çarpanları ve 6..12 arası tüm bayt
  aralıklarıyla), `:173`ün whitening örneği **8.192 LFSR kombinasyonunun ve 40
  BLE kanalının hiçbiriyle** yeniden üretilemedi. **Spec'in sayısal örneği bir
  fixture DEĞİLDİR** — aritmetiği kontrol edilene kadar. Doğru davranış:
  ALAN YERLEŞİMİNİ koru (o bilgi geçerli), SAYILARI motordan üret ve nereden
  geldiğini örnek açıklamasına YAZ. Dalga 17'nin "keşfin elle çözdüğü her
  çerçeve şüphelidir" dersinin dördüncü vakası ve ilk kez şüpheli olan şey
  deponun kendi belgesi.
  **Paylaşılan çekirdek deseni DÖRDÜNCÜ ve BEŞİNCİ kez uygulandı** (18a/18d):
  `wifi/dot11Frame.ts` üç tüketiciye (18a `wifi`, 18b yönetim gövdeleri,
  18c `esp-now`) ve `protocol-core/framing/ieee802154Frame.ts` iki tüketiciye
  (`zigbee`, `thread`) hizmet ediyor. İkincisi bir ÇIKARMA işlemiydi: MAC
  çözücüsü `zigbee.ts`in İÇİNDEydi ve hiçbir yardımcısı `export` edilmemişti;
  çıkarma "kes-yapıştır" değil, `pulseLog.ts` biçiminde **konteyner/türetme
  ayrımı** gerektirdi (çekirdek `payloadStart`/`payloadEnd` döndürür, gövdeyi
  TÜKETİCİ araya sokar) — ve `zigbee`nin FCS'i NWK'dan ÖNCE, `thread`inki EN
  SONDA basıldığı için alan SIRASI tüketiciye bırakıldı.
  **`DecodeOption.kind` yalnız `'select' | 'number'`dır ve bu bir KAPSAM
  KISITIDIR** (18d'de bir kanalı, 18e'de DÖRT kanalı kapattı): serbest metin
  (hex önbelleme, sync sözcüğü, whitening polinomu) isteyen bir kanal
  `protocol-core/types.ts` genişletilmeden YAZILAMAZ. 18e bunları uzunluk ve
  tohum `number` kanallarına çevirdi, polinomu PN9'a sabitledi ve **kapatılan
  kanalı dosya başındaki "KANAL YAPILMAYACAKLAR" listesine gerekçesiyle
  yazdı** — "unutulmuş" ile "yazılamamış" ayrı şeylerdir.
  **Bir bağlantı GÖRÜNMÜYORSA yoktur** (18e): `calculatorIds` bağlantısı
  `ProtocolPage.tsx:433`te YALNIZ `timing` sekmesinde basılıyor;
  `rf-telemetry-custom-frame`in `timing` sekmesi olmadığı için brifin önerdiği
  `/calculators` bağı hiç görünmezdi ve EKLENMEDİ.

  ### Dalga 18'den KALAN İKİ BORÇ — BİRİNCİSİ KAPANDI

  **1. ✅ KAPANDI (2026-08-27): `createSchemaParser`in `canParse`i BOŞ
  `startBytes`te HER ŞEYE `true` demiyor artık.** Hata `[].every(...)`in boş
  dizide `true` dönmesiydi: `startBytes`i olmayan bir şema SIFIR bayt
  karşılaştırıp her çerçeveyi sahipleniyordu.

  **Düzeltme.** `startBytes` DOLU dal KOD YOLU OLARAK DEĞİŞMEDİ. Boş `startBytes`
  dalı, şemanın KENDİ bildirdiği yapısal kısıtlara düşüyor: (a) `startEnd` ise
  bitiş baytları — `verifyFraming` de yalnız orada bakar, (b) şemadan türeyen
  TOPLAM çerçeve boyu `data.length`a eşit mi ve azami boyu aşıyor mu (`lengthFrom`
  taşıyan alanlar teldeki uzunluk alanından OKUNARAK), (c) `ascii` alanlarının
  yazdırılabilirliği. **Değişmez ilke: hiçbir koşul denetlenemiyorsa cevap
  `true` değil `false`tur** — bir `lengthField` şemasında uzunluk kaynağı yoksa,
  ya da koşullu/tekrarlı/bileşik alan yüzünden boy türetilemiyorsa, kayıt hiçbir
  çerçeveyi sahiplenmez. `parseWithSchema` `canParse` içinde ÇAĞRILMAZ;
  alan başına iş şemadan bir kez çıkarılır (`buildCanParsePlan`).

  **ÖLÇÜM (aynı 148 kayıt / 937 örnek, önce → sonra, toplam/kendi/yabancı):**

  | tüketici | framing | `startBytes` | önce | sonra |
  |---|---|---|---|---|
  | `custom-binary-protocol` | `startEnd` | VAR | 16/2/14 | **16/2/14 (BİREBİR AYNI)** |
  | `length-based-protocol` | `lengthField` | yok | 937/2/935 | **1/1/0** |
  | `ascii-protocol` | `none` | yok | 937/2/935 | **5/1/4** |
  | uzunluk alanı olmayan sonda | `lengthField` | yok | 937 | **0** |

  Kaybedilen İKİ kendi örneği bilinçlidir ve ikisi de `expectedValid: false`
  olan, TANIMI GEREĞİ bozuk çerçevelerdir: `length-based-protocol/
  oversized-length` (bildirilen 1000, telde 3 bayt) ve `ascii-protocol/
  missing-line-ending` (CRLF kesik, 16 yerine 14 bayt). Bir ön elemenin bozuk
  çerçeveyi sahiplenmemesi doğru davranıştır. `ascii-protocol`ün kalan 4 yabancı
  isabeti hata DEĞİL gerçek belirsizliktir: dördü de 16 baytlık yazdırılabilir
  AT-komut satırıdır (`at-commands` ×2, `hayes-command-set`, `lte-modem-at`).

  **Eski notun İKİ sayısı ÇÜRÜDÜ.** (a) `custom-binary-protocol` "9 çakışma"
  değil **14**tü — ve zaten değişmedi, çünkü `startBytes`i dolu. (b)
  `delimiter-based-protocol` bu düzeltmeden HİÇ etkilenmez: `createSchemaParser`i
  kullanmaz, `canParse`ını elle yazar (`data[0] === HDLC_FLAG`) ve 10/1/9 ölçümü
  önce de sonra da aynıdır. `createSchemaParser`in üretimdeki tüketicisi ÜÇ
  tanedir, dördüncüsü yoktur.

  **`rf-telemetry-custom-frame`in KAÇINMA gerekçesi hâlâ geçerli** ve bu turda
  ÖLÇÜLDÜ: `createSchemaParser(buildRfTelemetrySchema(...))` aynı kümede
  `dataLength`e göre 12–33 YABANCI isabet alır ve kendi 8 örneğinin 2–8'ini
  kaybeder — şemanın `Data` uzunluğu ÇÖZÜLEN çerçeveden geldiği için tek bir
  sabit parser örneği auto-detection'a hizmet edemez. Elle yazılan imza 0
  yabancı ölçüyor. `rfTelemetry.ts` bu turda YENİDEN YAZILMADI.

  **Bekçiler.** `rfTelemetryCanParseRegistry.test.ts`in ikinci ayağı sözü
  tutularak GÜNCELLENDİ (silinmedi): artık mayının VARLIĞINI değil YOKLUĞUNU
  bekçiliyor ve `startBytes` DOLU dalın değişmediğini ESKİ GÖVDEYİ çerçeve
  çerçeve yeniden koşturarak kanıtlıyor (registry büyüse de geçerli bir kanıt).
  `schemaParser.test.ts`e beş `framing.type`ı da doğrudan sınayan 11 bekçi
  eklendi. `parse()` çıktısının değişmediği ayrıca 5625 çağrılık önce/sonra
  anlık görüntüsüyle doğrulandı: rastgele `RawFrame.id` dışında BİREBİR aynı.

  **2. ✅ KAPANDI: `custom-schema` `definitions` paneli YAZILDI** (`ddc0d9d`).
  Eski not "panel YOK, 19 kayıt bekliyor" diyordu; **o ölçüm ÇÜRÜDÜ**.
  `ProtocolPage.tsx`in `DEFINITION_PANELS`inde bugün **DOKUZ panel** var:
  `dbc · eds · custom-schema · vendor-map · a2l · gsdml · iodd · scl · dsdl`.

  **Panel borcunun bugünkü ölçümü (2026-08-31, KODDAN sayıldı — gsd kapanışıyla
  GÜNCELLENDİ, 12 biçimin kayıt dağılımı ve panel durumu):** paneli olmayan
  TEK biçim kaldı — **`ldf` (1 kayıt)**, toplam **1 kayıt**. `custom-schema`
  21, `vendor-map` 9, `dbc` 6, `a2l` 3, `dsdl` 2, `eds` 2, `xif` 1, `gsd` 1
  kayıt taşıyor ve hepsinin paneli var. `ldf` bu depoda HİÇ araştırılmadı
  (format grameri sıfırdan çıkarılmalı — şema tabloları frame/signal/schedule
  EDS/XIF/GSD'den daha karmaşık olabilir, kendi brif turunu gerektirir).

  **✅ KAPANDI: GSD parser'ı + `gsd` `definitions` paneli YAZILDI** (2026-08-31,
  aynı oturumda XIF'in hemen ardından). `profibus-dp` kaydının `definitions`
  sekmesi artık gerçek bir modül/parametre tablosu basıyor. Söz dizimi kaynağı
  ÜÇ bağımsız ikincil kaynaktan (PI'nin kendi normatif belgesi ÜCRETLİ ve bu
  depoda YOK — `profibusDp.ts`in FDL notuyla aynı durum): Siemens/ComDeC'in
  GSD-file v2.2 kılavuzu, felser.ch PROFIBUS Manual (`profibusDp.ts`nin
  zaten kullandığı kaynak), `pyprofibus`in açık parser'ı (yalnız çapraz
  referans, KOD KOPYALANMADI — üstelik pyprofibus'un okumadığı iki şey,
  `ExtUserPrmData` tip satırı ve `Module_Reference`, burada okunuyor).
  Kimlik baytı çözümü (giriş/çıkış uzunluğu + yön) **14 gerçek `.gsd` dosyası
  / 288 modül** üzerinde ölçüldü: hiçbir modül yarım kalmadı, hiçbiri
  dosyanın kendi azami uzunluğunu aşmadı, çözüm üreticinin kendi metniyle
  birebir tuttu. Fixture Siemens SINAMICS G120 (`SI028158.gsd`, açık kaynak
  Proview aynasından, üreticinin kendi portalından DEĞİL) — üç iç tutarlılıkla
  doğrulandı, hiçbir alan uydurulmadı (ayrıntı `gsdFixture.ts` dosya başında).
  **Hex çöz alt aracı XIF'inkinden FARKLI gerekçeyle eklenmedi**: eksik olan
  tip değil YERLEŞİM — modül tablosu zaten giriş/çıkış uzunluğunu ve yönünü
  veriyor, ama hangi modüllerin gerçekten takılı olduğu GSD'de yazmıyor
  (Chk_Cfg telgrafıyla taşınır, ölçüldü: fixture `Max_Module = 2` derken 7
  modül tanımlıyor). Gerekçenin tamamı `GsdPanel.tsx` dosya başında. Stale
  "planlandı" testi YOKTU: `e2e/profibus-dp-decode.spec.ts`teki tek
  `plannedNotice` iddiası `decode` sekmesi içindi (zaten `ready`), definitions
  sekmesiyle ilgisizdi; `e2e/xml-device-definitions.spec.ts` ve
  `e2e/xif-definitions.spec.ts` ikisi de `lin`/LDF'i örnekliyordu, dokunulmadı.

  **Ders (yazılı borç çürür):** bu not aylarca "19 kayıt bekliyor" dedi ve
  yanlıştı. Yukarıdaki `createSchemaParser` maddesinde de aynısı olmuştu
  ("9 çakışma" gerçekte 14'tü). **Yazılı bir borç ölçümünü KULLANMADAN ÖNCE
  yeniden ölç** — bu depoda kural hâline geldi.

  **3. ✅ KAPANDI: `ProtocolPlugin.encoder`in TÜKETİCİSİ YAZILDI** (2026-08-29).
  Eski not "191 plugin dosyasının 14'ünde `encoder:` var ama `plugin.encoder`ı
  OKUYAN tek yer `types.ts`teki tanımın kendisi" diyordu; ölçüm doğruydu ve
  artık geçerli DEĞİL. Bugün alanı okuyan üç yer var: `usePacketBuilder`
  (iki yol), `test-automation/byteSourceIo` ve rol defteri testi.

  **Rol defteri: `src/protocols/encoderCatalog.ts`.** `ProtocolEncoder<TMessage>`
  bir mesajı bayta çevirdiğini söyler, o mesajın NE olduğunu söylemez; iki aile
  boru hattının FARKLI aşamalarına düşer (`payload` 10 kayıt = zarf,
  `values` 4 kayıt = üretici). Ayrım TİPE değil BİLDİRİME yazıldı —
  `types.ts` kilitli karar, açılmadı. `PROTOCOL_CATEGORIES` ↔ `DOMAIN_IDS`
  ile aynı disiplin: kopya liste + iki yönlü test (`encoderCatalog.test.ts`),
  ayrışma derlemede değil TESTTE kırmızıya döner.

  **Tüketici 1 — Packet Builder çerçeveleme.** `PostProcessing` artık
  `'plugin'` dalını da taşıyor ve `PacketBuildOptions` AYRIK BİRLİK: `'plugin'`
  seçilip encoder'ın verilmediği durum temsil edilemez. Yerleşik beş dal
  DEĞİŞMEDİ (senkron, chunk indirmez); listeye 8 yeni zarf eklendi (hdlc, sdlc,
  ppp, kiss, delimiter-based, xmodem, ymodem, zmodem). `cobs`/`slip` defterde
  `builtInEquivalent` taşır ve listede İKİ KEZ GÖRÜNMEZ: `packetPipeline` o iki
  fonksiyonu zaten doğrudan çağırıyor, defter testi ikisinin aynı baytı
  ürettiğini bayt bayt kanıtlıyor.

  **Tüketici 2 — Packet Builder üretim kaynağı.** Şema tabanlı yolun YANINDA
  ikinci bir kaynak (`builder.setEncoderPlugin`): form alanları plugin'in kendi
  şemasından çizilir, çerçeveyi `plugin.encoder.encode` üretir
  (`buildPacketWithEncoder`). `rf-telemetry`de fark somut: encoder preamble ve
  sync sözcüğünü kendi varsayılanıyla doldurur, `encodeWithSchema` doldurmaz.
  Bu yüzden defter TOHUM taşır (`seedValues`) ve tohum plugin'in dışa açtığı
  SABİTLERDEN türetilir — boş bir bayt alanı varsayılanı EZERDİ.

  **Tüketici 3 — Test Automation `send-frame`.** Üçüncü kaynak
  `{ source: 'plugin-frame', pluginId, bytes }`: ham yük protokolün kendi
  zarfıyla gider. Salt EKLEME; `SCENARIO_FORMAT_VERSION` 1'de KALDI (§40'ın
  `testScenarios` kararıyla aynı gerekçe) ve `parseScenarioJson` sığ doğruladığı
  için eski senaryolar etkilenmedi.

  **Registry LAZY olduğu için motor FONKSİYON olarak enjekte edilir**,
  `pluginId` olarak değil: `buildPacket` saf ve senkron, her tuş vuruşunda
  çağrılıyor. Motor inene kadar paket ÜRETİLMEZ ve yerleşik dala DÜŞÜLMEZ —
  seçilen zarf olmadan bayt göndermek sessiz bir hata olurdu.

  **Kalan kayıp — tek parametreli `encode` sözleşmesi KAYIPLI.**
  `xmodem`/`ymodem` blok numarasını 1'e ve CRC modunu, `zmodem` ZDATA + sıfır
  konum + binary16'yı SABİTLER; `kiss`in encoder'ı `encodeSlip`in KENDİSİDİR ve
  KISS komut baytını EKLEMEZ. Bu dördü defterde `fixedParametersKey` taşır ve
  ekranda uyarı olarak GÖRÜNÜR. Düzeltmek `encode(message, options)` demektir,
  yani `types.ts` sözleşmesini açmak — bilinçli olarak YAPILMADI.

  **§33 Protocol Converter'ın ön koşulu bu maddeydi ve artık karşılandı**;
  hedef tarafın motorları hâlâ yazılmamış olduğu için §33 yine de açılmadı.

  **4. ✅ KAPANDI: Test Automation'ın ŞABLON koltuğu bağlandı** (2026-08-29,
  encoder tüketicisiyle aynı gün, ayrı commit). `byteSourceIo`nun
  `encodeTemplate` seçeneği testler dışında HİÇ verilmiyordu:
  `send-frame` + `source: 'template'` gerçek ekranda "şablon deposu bağlı
  değil" fırlatırdı — model, koşucu ve doğrulayıcı yazılmış ama ucu boşta
  kalmış bir yoldu.

  Bağlantı `useTestAutomation`da; çeviri `features/packet-builder/
  packetTemplates.ts`te (saf, senkron). Metin→`EncodeValues` dönüşümü
  `usePacketBuilder`dan `formValues.ts`e ÇIKARILDI: iki tüketici aynı
  fonksiyonu çağırdığı için "Builder'da gördüğüm paket testin gönderdiğinden
  farklı" sınıfı bir hata yapısal olarak imkânsız. Mantık değişmedi, yer
  değiştirdi.

  **Şablon `schemaName` taşır ama şemanın KENDİSİNİ taşımaz** (`projectFile.ts`).
  Studio'daki şema o günden beri değişmiş olabilir; ad tutmuyorsa üretim
  REDDEDİLİR (`schema-mismatch`). Sessizce üretmek, alan kimlikleri tutmadığı
  için sıfırlarla dolu bir çerçeve göndermek olurdu. Şablon kimliğini store
  üretir (`template-1`), o yüzden adım formunda serbest metin değil SEÇİM var;
  depo boşken seçenek yerine "Packet Builder'da kaydedin" yazar.

  **5. ✅ Modbus'un ÜÇ taşıyıcısına encoder YAZILDI** (2026-08-30). 3. madde
  tüketiciyi yazmıştı, bu madde §33'ün hedef tarafına ilk motorları koyuyor:
  `industrial/modbus/modbusEncoders.ts` — RTU · ASCII · TCP tek dosyada ve üçü
  de AYNI girdiyi alır: **adres/unit baytı + PDU**. Modbus'ta değişen PDU değil
  ZARFTIR; ayrı girdi tipleri seçilseydi taşıyıcılar arası dönüşüm her çift için
  ayrı bir uyarlama katmanı isterdi.

  **Girdi ADU'nun KENDİSİ DEĞİL gövdesidir** — CRC · LRC · MBAP burada
  HESAPLANIR. Kullanıcıdan gelen hazır bir çerçeveyi sarmak checksum'u iki kez
  yazmak olurdu. Kısıtlar çözücülerle aynı yerden okundu: RTU'da CRC telde LOW
  bayt önce gider (veri alanları big-endian olsa da), ASCII'de hex BÜYÜK harf
  (spec'in kendi dizgesi `:010300000002FA`), TCP'de **CRC YOKTUR** ve `Length`
  alanı unit ID'yi SAYAR.

  **Sabitlenen parametre: MBAP transaction ID = 0.** 3. maddedeki tek parametreli
  `encode` sözleşmesinin bedeli burada da vuruyor; `fixedParametersKey` ile
  defterde ilan edilip ekranda uyarı olarak gösteriliyor.

  **Encoder yazma ölçütü korundu:** üç kaydın da katalogda `build` sekmesi VAR
  (dalga 16 bulgu 11'in kuralı). `protocol-core/types.ts` yine AÇILMADI.

  **İki mevcut test iddiası güncellendi**, ikisi de "modbus encoder taşımaz"
  varsayımına dayanıyordu: `encoderCatalog.test.ts`in negatif örneği ve
  `byteSourceIo.test.ts`in "encoder taşımayan protokol" fixture'ı `nmea-0183`e
  taşındı. Davranış regresyonu değil, varsayımın eskimesi — encoder kazanan bir
  plugin'i negatif örnek olarak bırakmak testi kendi kısıtını ölçer hâle
  getiriyordu.

  **§33 yine de AÇILMADI:** sekiz dönüşümün hedef tarafında şimdilik üç motor
  var.

  **6. ✅ §33'ün İKİ HEDEFİ DAHA: MQTT PUBLISH ve Classical CAN** (2026-08-30,
  modbus üçlüsüyle aynı gün, ayrı commit). `network/mqtt/mqttEncoders.ts` ve
  `automotive/can/canClassic.ts`teki iki sarmal. Disiplin modbus'la AYNI:
  **çağıran GÖVDEYİ verir, encoder ZARFI hesaplar.**

  MQTT'de gövde `topic uzunluğu (2) + topic + payload`; encoder Fixed Header'ı
  ve **Remaining Length**i yazar. Uzunluğu çağırana bırakmak, gövdeyle çelişen
  bir değer yazma imkânı vermek olurdu ve MQTT'de o alan yanlışsa akış bir
  sonraki pakette değil ORTASINDA kayar. Topic'i sabitleyip yalnız payload almak
  ise §33'ün dönüşümünü (topic seçmek) anlamsız kılardı. Sabitlenenler:
  PUBLISH · DUP=0 · QoS=0 · RETAIN=0 — QoS 0 gövdeyi de belirler, Packet
  Identifier YALNIZ QoS ≥ 1'de vardır.

  CAN'de gövde `identifier sözcüğü (4 bayt, SocketCAN düzeni) + en çok 8 veri
  baytı`; DLC ve 16 baytlık dolgu hesaplanır. **Format biti çağırandan
  ALINMAZ, sayfadan gelir**: 2.0A base, 2.0B extended üretir. Aksi hâlde 2.0B
  sayfası base çerçeve üretebilir ve kendi ürettiğimiz çerçeveye kendi
  `can20bParser`ımız "biçim uyuşmuyor" uyarısı basardı. Base'de 11 bite
  sığmayan identifier sessizce KIRPILMAZ, hata fırlatır — kırpmak kullanıcının
  yazdığından başka bir ID'yi kabloya çıkarmak olurdu. RTR biti çağıranındır.

  `canFrame.ts`in `CAN_SFF_MASK`/`CAN_EFF_MASK`/`CAN_RTR_FLAG` sabitleri DIŞA
  AÇILDI: encoder çözücüyle aynı bit tanımlarını kullanmak zorunda, ikinci bir
  kopya ayrışmanın davetiyesiydi.

  Üçünün de katalog kaydında `build` sekmesi var (kural 5. maddede). §33 hâlâ
  açılmadı; hedef taraf artık altı motor taşıyor.

  **7. ✅ J1939 ve NMEA 2000 encoder'ları — §33'ün hedef tarafı SEKİZ MOTOR**
  (2026-08-30). `encodeJ1939Identifier`, `decodeJ1939Identifier`in TERSİ olarak
  yazıldı ve testi de tam olarak bunu ölçüyor: her iddia ya spec'in kendi
  identifier'ıyla ya çözücünün çıktısıyla karşılaştırılıyor.

  **Girdi ham identifier sözcüğü DEĞİL, ALANLAR:** `öncelik (1) + PGN (3, BE) +
  hedef adresi (1) + kaynak adresi (1) + veri (≤8)`. Ham sözcük isteseydik
  `can-2-0b` ile aynı işi ikinci bir adla listelemiş olurduk; bu encoder'ın
  eklediği şey identifier'ı ALANLARDAN kurmak — PDU1/PDU2 ayrımını ve hedef
  adresin nereye gittiğini bilerek.

  Reddedilen üç durum, üçü de SESSİZ HATA olurdu: PDU2 (yayın) PGN'ine hedef
  adresi verilmesi (identifier'da o alan yok, değer düşerdi), PDU1'de hedefin
  verilmemesi, PDU1 PGN'inin alt baytının sıfır olmaması (çözücüde PGN başka
  bir PGN'e dönerdi). `reserved` biti 0 sabit.

  **NMEA 2000 encoder'ı J1939'unkinin KENDİSİDİR, kopyası değil** — N2K
  identifier'ı J1939-21'in identifier'ıdır ve `nmea2000.ts` çözerken zaten
  `decodeJ1939Identifier`i çağırıyor. Testi bu kararı koruyor: iki plugin aynı
  gövdede aynı baytı üretmeli. Defterde ikisi AYRI kayıt ama aynı
  `fixedParametersKey`i paylaşıyor.

  Transport Protocol (çok çerçeveli aktarım) ÜRETİLMEZ: 8 baytı aşan veri
  reddedilir. TP bir oturum protokolüdür, tek atımlık `encode` sözleşmesine
  sığmaz.

  **8. ✅ BACnet/IP ve BACnet MS/TP encoder'ları — §33'ün SEKİZ dönüşümünün
  hedef tarafı TAMAM** (2026-08-30). İkisi de kendi dosyalarındaki yazılı
  tuzakların tam üstünde duruyor, o yüzden uzunluk ve CRC alanlarının HİÇBİRİ
  çağırana sorulmuyor:

  - **BVLC Length KENDİNİ DE SAYAR** (MBAP'ın tersine): gövde uzunluğu değil
    `4 + gövde`. Yanlış yazılan bir Length çözücüde uyarı, gerçek ağda kayma
    demekti. Sabitlenen parametre: Function = Original-Unicast-NPDU (0x0A).
    Forwarded-NPDU (0x04) BİLEREK dışarıda — başlıktan sonraki 6 baytlık B/IP
    adresi gövdenin değil ZARFIN parçası, tek parametreyle doğru üretilemez.
  - **MS/TP Length YALNIZ VERİYİ sayar** ve **Data CRC KOŞULLUDUR**: Length 0
    ise o iki bayt hiç yazılmaz (Token, Poll For Master). Sabit uzunluk varsayan
    bir üretici Token çerçevesine iki bayt çöp eklerdi. Data CRC LSB-first.
    MS/TP'de sabitlenen parametre YOK: Frame Type, adresler ve veri gövdeden.

  §33'ün sekiz örnek dönüşümünün hedef tarafı artık eksiksiz: 10 motor
  (3 Modbus · MQTT · 2 CAN · J1939 · NMEA 2000 · 2 BACnet) + JSON/CSV hedefleri
  encoder istemiyor. **Ekranın kendisi (`features/protocol-converter`) hâlâ
  yazılmadı** — sıradaki iş odur.

  **9. ✅ §33 PROTOCOL CONVERTER EKRANI YAZILDI** (2026-08-30). Spec §6'nın
  açılmamış son feature klasörü açıldı: `src/features/protocol-converter`.
  Zincir tek ekranda — kaynak protokolün ÇÖZÜCÜSÜ baytları alanlara açar,
  kullanıcı alanları hedef adlara eşler, hedef biçimi çıktıyı üretir.

  **Kaynak bir ALAN KİMLİĞİDİR, bayt aralığı değil.** Girdi ham bayt olsaydı
  kullanıcı her protokolün yerleşimini elle bilmek zorunda kalırdı; oysa alanı
  zaten parser adlandırıyor. Çeviri bu yüzden `ParsedFrame` ÜZERİNDE çalışır.

  **Değer `physicalValue ?? rawValue` sırasıyla okunur.** Alan zaten bir ölçek
  uyguluyorsa ham sayıyı çarpmak sessizce başka bir sonuç üretirdi. `physicalValue`
  METİN de olabilir (enum etiketleri); o durumda aritmetik UYGULANMAZ, değer
  taşınır ve kullanıcı nedenini sorun listesinde görür — metni sayıya zorlamak
  `NaN` üretirdi.

  **MQTT hedefi METİN DEĞİL GERÇEK PAKET üretir** ve baytları `mqtt` plugin'inin
  kendi encoder'ı yazar (6. madde). Ekran kendi kodlayıcısını yazsaydı monitörün
  çözdüğü paketten ayrışabilirdi. JSON/CSV hedefleri encoder istemez (saf
  serileştirme; CSV'de virgüllü değer RFC 4180'e göre tırnaklanır).

  **Açılış çerçevesi motorun İLK örneği DEĞİL**, Modbus RTU'nun kayıt YANITIDIR:
  ilk örnek bir İSTEKTİR ve isteğin alanları arasında register YOKTUR — §33'ün
  "Modbus Register 40001" örneği ancak yanıtta karşılık bulur. Protokol
  değişince motorun kendi ilk geçerli örneği tohumlanır, ama kullanıcı hex
  kutusuna dokunduysa yazdığı EZİLMEZ.

  **Kaybolan alan bir HATA değil DURUMDUR:** kaynak protokol değişince eski
  eşlemeler ayakta kalır ve kimlik artık yoktur. O satır düşer, sorun listesine
  iner, ÖTEKİ satırlar üretilmeye devam eder. Hiç değer üretilmese bile sorun
  listesi BASILIR — "çıktı yok" deyip nedenini saklamak sessiz bir boşluk
  bırakırdı (tarayıcı turu tam olarak bunu yakaladı).

  **10. ✅ WebSocket `ByteSource` YAZILDI** (2026-08-30). `connection/`ın üç
  eksik kaynağından biri kapandı (`usb` ile `bluetooth` duruyor). Packet
  Builder'daki "planlandı" rozeti kalktı: seçenek artık gerçekten bağlanıyor.

  **Soket bu modülde AÇILIR ama SEÇTİRİLMEZ.** `createSerialSource` hazır bir
  port tutamağı alır çünkü `requestPort()` kullanıcı jesti ister; WebSocket'te
  öyle bir kısıt yok, adres bir metindir. Buna karşılık soketi ÜRETEN fabrika
  dışa açık (`socketFactory`) — testler bir tarayıcı sınıfını taklit etmeden
  sahte soket enjekte edebilsin diye.

  **Metin çerçeveleri de BAYTTIR:** köprülerin bir kısmı (satır tabanlı NMEA
  köprüleri) metin çerçevesi yollar; atmak sessiz veri kaybı olurdu, UTF-8'e
  çevrilip aynı `onChunk`a veriliyor. `binaryType = 'arraybuffer'` ZORUNLU:
  `'blob'` asenkron okuma ister ve `onChunk`ın senkron sözleşmesini bozardı.

  **`stop()` sonrası gelen `onclose` HATA DEĞİLDİR** — kapanışı biz istedik;
  bayrak olmadan her normal kapanış ekranda kırmızıya dönerdi. Karşı taraf
  kapattığında da hata değil `'idle'` yazılır: hattın bitmesi bir arıza değil.

  **Builder'da `connect()` WebSocket dalında "bağlandı" YAZMAZ.** `start()`
  soketi açmaz, açılışı BAŞLATIR; durumu `onopen` yazar. Zorla yazmak, el
  sıkışma sürerken bağlanmış gibi göstermek olurdu (seri portta böyle bir
  aralık yok).

  **Tarayıcı turu için elle yazılmış bir köprü var** (`e2e/support/
  wsBridgeServer.mjs`): depoda `ws` paketi yok ve tek tur için üretim
  bağımlılığı eklemek pahalıydı. RFC 6455'in gereken dar kısmı (SHA-1 el
  sıkışma + tek parçalı çerçeve) yazıldı; `playwright.config.ts` artık İKİ
  `webServer` koşuyor. Tur yalnız bağlantıyı değil veri yolunu da ölçüyor:
  köprü gönderileni yankılıyor, ekranda "son yanıt" olarak görünüyor.

  **✅ Aynı gün kapandı: Live Monitor ve Test Automation da bağlandı.** Üç ekran
  da aynı kaynağı kullanıyor; sözleşmenin vaat ettiği "bir kez yaz, üçü de
  kullansın" ölçüldü.

  Monitörde **bus load HESAPLANMAZ**: WebSocket yalnız baytları taşır, hattın
  fiziğini taşımaz — köprünün ardındaki baud hızı bilinmiyor. Uydurulmuş bir
  değer yüzdeyi de uydururdu (dosya kaynağının gerekçesiyle aynı).

  Monitör YALNIZ DİNLER, o yüzden köprüye **itme kipi** eklendi
  (`?push=<hex>&interval=<ms>`): yankı kipi gönderim yolunu ölçer, itme kipi
  dinleme yolunu. Turdaki baytları test ELLE YAZMIYOR — `buildSimulatedFrame`
  üretiyor; elle yazılmış bir çerçeve, çerçeveleme ayarıyla sessizce
  ayrışabilirdi.

  **11. ✅ ÇEVİRİ PAKETİ BÖLÜNDÜ — ilk yükten 190 kB gzip düştü** (2026-08-30).
  Ölçüm önce: `LanguageProvider` chunk'ı **1,4 MB ham / 379 kB gzip** ve
  içindeki `en` sözlüğü, Türkçe açılan arayüzde dil değiştirilmedikçe HİÇ
  okunmuyordu. Sonra: chunk **712 kB / 199 kB gzip**, `en` kendi chunk'ında
  (704 kB / 190 kB gzip) ve YALNIZ dil değişince iniyor.

  **`translations` kaydı `translations/all.ts`e taşındı** ve `index.ts`ten
  çıkarıldı. Sebep teknik: bir modül hem STATİK hem DİNAMİK içe aktarılırsa
  paketleyici onu statik chunk'a koyar — `index.ts`te duran tek bir
  `import { en }` satırı, dinamik dalı da anlamsız kılıyordu. `all.ts` yalnız
  testlerin ve dil eşitliği denetiminin girişi; uygulama kodu ORAYA DOKUNMAZ.

  **`tr` tembelleştirilmedi:** varsayılan dil ilk boyada gerekli (spec §4), onu
  da indirmeye bırakmak uygulamayı boş bir kabukla açardı.

  **`t` artık `lang`e değil İNEN SÖZLÜĞE bağlı.** Dil değişimi ile metin
  değişimi ARTIK AYRI ANLARDA olur: seçim anında geçerli, metinler chunk inince
  değişir; arada eski sözlük durur (ekranı boşaltmak ya da ham anahtar basmak
  yarım saniyelik indirme için ödenecek bedel değil). Üç test bu yüzden asenkron
  oldu — davranış regresyonu değil, zamanlamanın gerçeği.

  **Tarayıcı turu ölçümü ağdan yapıyor** (`smoke.spec.ts`): Türkçe açılışta
  `assets/en-*.js` isteği HİÇ YOK, dil düğmesine basınca TAM BİR tane var.
  Birim test bunu kanıtlayamazdı — ölçülen şey inen bayt.

  **12. ✅ PROTOKOL METİNLERİ KENDİ CHUNK'INA ÇIKTI — ilk yük 199 → 34 kB gzip**
  (2026-08-30, 11. maddenin devamı). Ölçüm: Türkçe sözlüğün 6009 anahtarının
  **4314'ü** ve 624 kB ham metnin **536 kB'ı (%86)** `protocol.*` altındaydı ve
  yalnız parser çıktısı basan ekranlarda okunuyordu.

  Sonuç: `LanguageProvider` chunk'ı **34 kB gzip**; `trProtocols` (161 kB) ve
  `enProtocols` (157 kB) ayrı chunk'lar ve `index.html`de ÖN YÜKLEME YOK.
  Günün toplamı: ilk yükteki çeviri maliyeti **379 → 34 kB gzip**.

  **Yükleme ROTALARIN lazy sınırına bağlandı** (`AppRouter.withProtocolStrings`):
  sayfa chunk'ı ile sözlük AYNI `Promise.all`da bekleniyor, böylece ekranda ham
  anahtar görünen bir aralık yok. Bağlanan rotalar: protokol sayfası, monitör,
  log analizi, tersine mühendislik, dönüştürücü — yani parser çıktısı basan
  ekranlar. Ana sayfa, katalog ve hesap araçları bu chunk'ı HİÇ indirmiyor.

  **`protocol.` önekli 11 anahtar çekirdekte KALDI** (`protocol.status`,
  `protocol.canonical`, `protocol.plannedNotice`…): önek aynı ama bunlar
  protokol METNİ değil, aile/alan sayfalarının KABUĞU ve o rotalar namespace'i
  indirmiyor. Prefix'e bakıp toptan taşımak FamilyPage'i kırdı; testler yakaladı.

  **`t` karşılığı olmayan anahtarı ANAHTARIN KENDİSİYLE basar** — yedek çeviri
  değil, GÖRÜNÜR arıza. Namespace'i beklemeden çizen bir rota eklenirse ekranda
  `protocol.foo.bar` yazar; boş string aynı hatayı görünmez kılardı.

  **TUZAK, tarayıcı turu yakaladı:** `isTranslationKey` yalnız `tr`ye bakıyordu.
  Arayüz İngilizce açıldığında Türkçe namespace hiç inmez, dolayısıyla
  `parseDiagnostics` her protokol anahtarına "bu bir anahtar değil" deyip mesajı
  HAM basıyordu. Artık YÜKLÜ OLAN her dile bakıyor (anahtar kümesi iki dilde
  derleyici zoruyla aynı). Birim testler bunu göremezdi: jsdom'da chunk sınırı
  yok.

  **İkinci tuzak:** `loadDictionary` "harita var mı" diye bakıyordu, oysa harita
  PARÇALI — protokol namespace'i çekirdekten önce inebiliyor. Artık ayrı bir
  `loadedCoreLanguages` kümesi var.

  **13. ✅ WebUSB ve Web Bluetooth `ByteSource`ları YAZILDI, Live Monitor'a
  BAĞLANDI** (2026-08-30). `connection/`ın son iki boş klasörü kapandı — spec
  §8.1'in yedi kaynağının HEPSİ artık aynı `ByteSource` sözleşmesini
  gerçekliyor.

  **WebUSB'nin okuma döngüsünün KAPANMA SIRASI seri porttan TERSTİR.**
  `createSerialSource`ta sıra `reader.cancel()` → `port.close()`: kilitli
  stream'de `close()` reddedilir, önce cancel gerekir. WebUSB'de `transferIn`in
  bekleyen çağrısını doğrudan iptal eden bir API YOK — spec'in kendi davranışı
  `releaseInterface`/`close()`in bekleyen transferi REDDETTİRMESİ. Sırayı seri
  porttakiyle aynı yazmak `stop()`u sonsuza kadar askıda bırakırdı: cihaz veri
  göndermeyi keserse `transferIn` süresiz bekler. `usbSource.test.ts`teki
  "stop() bekleyen transferIn çağrısını takılmadan çözer" testi tam bunu
  bekçiliyor.

  **Web Bluetooth'ta `optionalServices` unutmak, cihaz seçildikten SONRA
  patlar.** `requestDevice`e bildirilmeyen bir servise `getPrimaryService`
  sonradan `SecurityError` verir — kullanıcı cihazı seçmiş olsa bile.
  `LiveMonitorScreen.tsx` bu yüzden
  `requestBluetoothDevice({ acceptAllDevices: true, optionalServices:
  [bluetoothOptions.serviceUuid] })` çağırıyor; `acceptAllDevices` de ayrı bir
  zorunluluk — `filters` boşken Web Bluetooth `requestDevice` TypeError atar.

  **Bağlantı ayarları spec'ten DEĞİL, API'nin kendi zorunlu parametrelerinden
  türetildi** — §8.1'in "Bağlantı ayarları" listesi (Baud rate, Parity…)
  UART'a özgü, WebUSB'nin `selectConfiguration`/`claimInterface`/`transferIn`
  ve Web Bluetooth'un `getPrimaryService`/`getCharacteristic` ikilisinin
  karşılığı yok (WebSocket'in "adres" alanıyla aynı durum, 10. madde). USB
  tarafı `configurationValue`/`interfaceNumber`/`endpointIn`/`endpointOut`/
  `transferSize`, Bluetooth tarafı `serviceUuid`/`notifyCharacteristicUuid`/
  `writeCharacteristicUuid` — varsayılan Bluetooth UUID'leri Nordic UART
  Service'in (en yaygın "GATT üzerinden seri" köprüsü).

  **İkisinin de bus load'u YOK** — `connectUsb`/`connectBluetooth`
  `ingestor.setLink(undefined)` çağırır, dosya/WebSocket kaynaklarıyla aynı
  gerekçeyle (hattın fiziği bilinmiyor, uydurulmuş baud değeri yüzdeyi de
  uydururdu).

  **Bağlantının KENDİSİ turlanamaz, FORMU turlanabilir.** headless
  Chromium'da `navigator.usb`/`navigator.bluetooth`ın cihaz seçtirme akışı
  otomatikleştirilemez (işletim sistemi seçicisi ister) — bu spec §8.1'in
  kalan iki kaynağının "tarayıcı turu YOK" notunun gerekçesiydi. `e2e/
  live-monitor.spec.ts`teki iki yeni test bu sınırın içinde kalıp yalnız
  kaynak seçilince doğru alanların/varsayılanların gerçek tarayıcıda
  çizildiğini ölçüyor; bağlanma turlanmadı.

  Ölçüm: birim 6891/1 atlandı (+25 yeni: 12 usb + 13 bluetooth), e2e 1358/2
  atlandı (+2 yeni, form-seviyesi).

  `connection/` KLASÖR BORCU SIFIRLANDI: `serial`/`usb`/`bluetooth`/
  `websocket`/`file`/`mock` hepsi dolu, spec §6'nın `connection/` iskeleti
  tamamlandı.

  **14. ✅ Protocol Converter → Packet Builder KÖPRÜSÜ YAZILDI** (2026-08-31).
  `mqtt-publish` hedefinde üretilen GERÇEK paket artık tek tıkla Packet
  Builder'ın HEX override'ına taşınabiliyor — spec §33'ün "çıktıyı Packet
  Builder'a/monitöre aktarmak" adayının ilk yarısı.

  **Feature'lar arası import YASAĞI köprüyü `app/store/`e itti** —
  `protocolSchemaStore.ts`nin Studio↔Builder deseninin AYNISI: yeni
  `app/store/converterHandoffStore.ts` (Zustand, KALICI DEĞİL — `uiStore.ts`
  ile aynı gerekçe, bekleyen bir aktarım yeniden yüklemeyi hak etmiyor).
  Converter yazar (`setPendingPacket(hex, topic)`), Builder okur ve
  TÜKET-VE-SİL uygular (`useEffect` içinde `setHexOverride` + hemen
  `clearPendingPacket` — silinmeseydi ekrana sonradan dönüldüğünde ESKİ paket
  sessizce yeniden uygulanırdı).

  **Landing yeri `hexOverride`, yeni bir "manuel mod" DEĞİL** —
  `PacketBuilderApi.hexOverride: string | null` zaten vardı (spec §10 "HEX
  düzenleme"); köprü onu DIŞARIDAN dolduran ikinci bir yazardan ibaret.
  Yeni bir üretim yolu icat etmek yerine var olanı kullanmak riski oldukça
  düşürdü.

  **`bytesToHex`/`hexToBytes` biçim uyumu KONTROL EDİLDİ, varsayılmadı**:
  `bytesToHex` boşluksuz büyük harf üretir, `hexToBytes` boşlukları
  temizleyip çift hane sayısını doğrular — round-trip birebir çalışıyor,
  ayrı bir ayrıştırıcı yazmaya gerek kalmadı.

  **Converter → MONİTÖR köprüsü BİLEREK YAPILMADI.** İlk bakışta dosya
  oynatma kaynağı (`createFileSource`, tek `LogRecord`) üzerinden mümkün
  görünüyordu, ama monitörün `FrameTable`ı PROTOKOL ÇÖZMEZ — yalnız genel
  çerçeveleme + sayısal musluklar (`monitorIngestor.ts`, `ProtocolPlugin`/
  `parser.parse` HİÇ geçmiyor). Dönüştürülmüş TEK bir paketi "dosya oynatma"
  gibi enjekte etmek hem mekanizma uyuşmazlığı (oynatma hızı/tempo tek kayıt
  için anlamsız) hem de kazanç getirmiyordu: monitörde adlandırılmış alan
  görünmeyecekti, Converter'ın kendi hex çıktısından fazlasını vermezdi.
  Değer/risk dengesi olumsuz çıkınca YAPILMADI — spec'in "monitöre aktarmak"
  adayı hâlâ açık, gerçek bir ihtiyaç/tasarım çıkarsa buraya dönülmeli.

  Doğrulama: typecheck temiz, birim 6897/1 atlandı (+6 yeni), e2e 1359/2
  atlandı (+1 yeni — gerçek tarayıcıda uçtan uca gezinme + hex override).
