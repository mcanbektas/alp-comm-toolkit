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
- Katalogdaki 172 kaydın **122'si hâlâ `status: 'planned'`** (41 `ready`, 9 `partial`).
  O sekmeler görünür ama içleri "planlandı" bildirimi taşır. **Boş kart basmak yasak** —
  bir sekme açılıyorsa ya gerçek bir motoru vardır ya da neyin geleceğini söyler.
