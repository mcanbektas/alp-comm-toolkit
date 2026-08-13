# ALP Platform Süiti — Faz Planı ve Model Önerileri

> Karar tarihi: 2026-08-09. Mimari: Autodesk-tarzı süit — tek platform (hesap/API/DB/deploy/tasarım),
> N bağımsız ürün SPA'sı (PCB · Comm · Tool3…). Mikroservis YOK — modüler monolit.
> Ayrıntılı mimari: bu konuşma + `ozet/00-genel-ozet.md` (Comm spec özeti).

## Mimari özet (kilitli kararlar)

- **alp-platform** repo: `api/` (ASP.NET Core 9, tüm ürün modülleri) + `deploy/` (compose, nginx, env) + `landing/` + `design/` (token'lar + shell paketi `@alp/design`)
- **alp-pcb-toolkit** repo: sadece `web/` kalır (React 18 JS, 4 CSS tema — dokunulmaz, retrofit sonra)
- **alp-comm-toolkit** repo: Comm SPA (Vite + React 18 + TS strict + Tailwind, spec §6 klasör yapısı, tek app)
- **DB:** tek PostgreSQL, ürün başına şema (`platform`, `pcb`, `comm`); şemalar arası FK yasak (Identity/Audit hariç)
- **Auth:** mevcut ASP.NET Identity + JWT + refresh cookie — tüm ürünler aynı `/api/auth`
- **Backend modül kuralları:** modül = feature klasörü; modüller birbirini çağırmaz; ortak iş `Platform/`'a iner; ağır non-CRUD ihtiyaç doğarsa ürüne sidecar servis (aynı nginx+JWT arkası)
- **Canlı veri yolu backend'e girmez** (Comm gizlilik kuralı): cihaz ↔ tarayıcı (Web Serial/USB/BLE); bridge (yerel agent) sonraki faz
- **Routing:** path tabanlı — `/` landing, `/pcb`, `/comm`, `/api`; BrowserRouter + nginx fallback

## Fazlar

| Faz | İş | Model · Effort | Neden |
|---|---|---|---|
| **0** ✅ | **TAMAM (2026-08-09).** Platform ayrıştırma: PCB repo'dan `api/`+`deploy/` → yeni `alp-platform` repo; CI workflow'ları böl (pcb-web / platform-api); ghcr imaj adları; compose referansları; PCB repo'da web kalır | **Opus · high** | Çalışan ürünün CI/CD'sine cerrahi — görünmez bağımlılıklar (workflow path'leri, Dockerfile referansları, script yolları). Yanlışın bedeli: PCB pipeline kırılır |
| **1** ✅ | **TAMAM (2026-08-09).** Design tokens + shell: PCB'nin 4 temasından token damıtıldı (açık/koyu, `data-theme` + `prefers-color-scheme`); `@mcanbektas/design` paketi (`design/` altında, Header/AccountMenu/ProductSwitcher); CI'a `design` job'u eklendi. **Scope `@alp/design` değil `@mcanbektas/design`** — GitHub'da `alp` kullanıcı adı başkasına ait, GitHub Packages scope'u repo sahibiyle eşleşmek zorunda. Paket henüz yayınlanmadı (tüketen yoktu). | **Sonnet · high** | Desen bilinen (CSS custom properties, semantic token), kaynak mevcut (4 tema); birkaç yol var, biri seçilecek |
| **2** ✅ | **TAMAM (2026-08-09).** Comm iskeleti: `alp-comm-toolkit` deposu — Vite 8 + React 18 + TS 7 strict + Tailwind 4 (CSS-first, token'lar `@theme inline`) + RRv7 BrowserRouter + katalog (8/54/172, alias grafiği + arama) + tr/en çeviri (eksik anahtar = derleme hatası) + protocol-core (spec §7 aynen) + lazy plugin registry + ByteViewer + Vitest (92 test) + Playwright duman testi + CI. Tarayıcıda doğrulandı. | **Opus · ultracode** | Uzun, birbirine bağlı çok dosyalı üretim; her şeyin üstüne oturacağı temel — tek seferde tutmalı |
| **3** | **API Comm modülü:** `Comm/` feature klasörü (mevcut Auth/Projects desenine birebir) + `comm` DB şeması (CommProjects, ProtocolSchemas) + EF migration + CORS'a comm origin + xunit testler | **Sonnet · high** | Var olan desene göre yeni endpoint; şema küçük ama birkaç geçerli biçim var |
| **4** | **Süit yüzü:** statik landing (token'lı, ürün kartları) + nginx path routing (SPA fallback'ler, cache header'lar) + compose'a comm servisi | **Sonnet · high** | Bilinen alan; nginx SPA fallback incelikleri var ama yol belli |
| **5** | **Comm motorları** (spec Phase 2): byte utils + conversion engine (28 araç) + CRC engine (28 algoritma + custom, fixture'lar spec §43'te hazır: `123456789` → 0xF4/0x29B1/0x4B37/0xCBF43926) + timing calculator'lar (UART/RS-485/SPI/I²C) | **Sonnet · medium** | Tarif eksiksiz, formüller spec'te, fixture'lar doğruluyor; hacim var ama her adım basit |
| **6** | **Stream/framing çekirdeği** (spec Phase 3): stream buffer (chunk birleştirme) + framing engine (15 yöntem: delimiter/length/COBS/SLIP/HDLC flag/timeout…) + 9 durumlu parser state machine + recovery/resync + Worker köprüsü (cancel'lı) | **Opus · xhigh** | Görünmez değişmezler (kısmi frame, resync, backpressure); buradaki bug 172 protokolün hepsini zehirler; API tasarımında ödünleşimler |
| **7** | **Custom Protocol Studio + Packet Builder** (spec Phase 4): 32 alan tipi, dynamic length, koşullu alan, CRC coverage, JSON şema, 4 panel UI, 4 kod üretici (C/Python/TS/Markdown), `byteOffset`/`calibrationOffset` ayrımı | **Opus · ultracode** | Spec'in "en önemli modülü" — küçük bir protokol derleyicisi; uzun ve bütünsel |
| **8** | **Live Serial Monitor** (spec Phase 5): Web Serial bağlantı katmanı + canlı parse (Worker'da) + ring buffer + virtualized tablo + Recharts grafikler + istatistik | **Opus · high** | Perf değişmezleri (UI thread bloklamaz, 100k satır), worker sınırları; sebep-sonuç izleme gerek |
| **9** | **İlk protokoller** (spec Phase 6): Modbus RTU/ASCII/TCP + NMEA 0183 + CAN + DBC import + J1939 — plugin desenini kanıtlar | **Sonnet · high** | Tarifler net (ozet 03/04/05'te frame yapıları+fixture'lar); desen Faz 6-7'de kurulmuş olacak |
| **10+** | Kalan protokol dalgaları (spec Phase 7-10: CANopen/LIN/ISO-TP/UDS/OBD → NMEA2000/AIS/MAVLink/UBX/RTCM → Ethernet/TCP/MQTT/CoAP/PCAP → industrial/wireless/RE/test-automation) | **Sonnet · medium-high** (dalga başına) | Kurulu desene protokol ekleme; zor decoder'larda (EtherCAT, GOOSE, Matter TLV) gerekirse Opus'a çık |
| **P** | **PCB redesign retrofit** — paralel iz, ekran ekran token'lara geçiş | **Sonnet · medium** | Mekanik dönüşüm, tema→token eşlemesi Faz 1'de tanımlanmış olacak |

## Model geçiş kuralları

- Faz başında bu tabloya göre `/model` + `/effort` çek; faz bitince sıradakini söylerim
- Sonnet fazında beklenmedik mimari karar çıkarsa: dur, Opus'a çek, kararı ver, geri dön
- Fable: hiçbir fazda gerekmiyor (ayrı kota + 2x maliyet; muhakeme tavanı isteyen iş yok)

## Sıradaki adım

**Faz 3** → `/model sonnet` + `/effort high` → platform deposunda `Comm/` feature modülü,
`comm` DB şeması, CORS'a comm origin'i, auth mail yollarının ürün başına yapılandırmaya taşınması.

Faz 3'e girmeden kapatılacak açık işler:
- PCB PR #18 merge kararı (CI yeşil, onay bekliyor)
- `alp-platform` `design/` çalışması commit edilip PR'a dönmedi
- `alp-comm-toolkit` deposu yerelde; GitHub'a itilmedi

## Faz 2'den çıkan kararlar ve borçlar

- **Comm portu 3001** — PCB 3000'i tuttuğu için ikisi aynı anda koşabilsin diye.
- **Token bağı `file:../alp-platform/design`** — paket yayınlanmadı, iki depo kardeş dizin
  olmak zorunda; CI iki checkout yapıyor. Faz 4'te yayınlanınca ikisi de sadeleşir.
- **TypeScript 7 `baseUrl`'ü kaldırdı** — `paths` göreli yazılıyor (`./src/*`).
- **Arayüz her zaman Türkçe açılır**, tarayıcı dili pazarlık edilmiyor (spec §4). Karar
  `LanguageProvider.detectInitialLanguage` içinde yorumla gerekçelendirildi.
- **Katalog metinleri İngilizce** — protokol/aile/alan adları teknik veri sayıldı. Alan ve
  protokol `summary` cümleleri de İngilizce kaldı; Türkçe karşılıkları Faz 3+ işi.
- **Playwright duman testi zorunlu katman** — jsdom CSS'i değerlendirmediği için birim
  testler boş sayfayı da yeşil gösterir. `reuseExistingServer: false`: 4173 gibi yaygın bir
  portta başka uygulama dinliyorsa Playwright sessizce onu test eder (bir kez yaşandı).
