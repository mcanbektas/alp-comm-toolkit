# Brif — Monitör grafiğini ayrı chunk'a al

**Depo:** `~/dev/alp-comm-toolkit` · **Dal:** `main`, temiz, `origin` ile eşit
**Önerilen model/effort:** Sonnet · high (yol belli, desen mevcut, ölçüt sayısal)

---

## İş tek cümleyle

`LiveLineChart` (recharts) monitör sayfasının chunk'ından ÇIKSIN; çerçeve
tablosu grafik kütüphanesini beklemeden çizilsin.

## Neden — ölçüm

Bugün yapılan iki çeviri bölmesinden sonra kalan en büyük chunk bu:

```
enProtocols   157 kB gzip   (dil değişince iner)
trProtocols   161 kB gzip   (protokol rotalarında iner)
LiveMonitorPage 112 kB gzip ← ÇOĞU recharts
ProtocolStudioPage 41 kB
react-dom      41 kB
index          31 kB
```

`SignalPanel` monitör ekranında HER ZAMAN çiziliyor
(`src/features/live-monitor/LiveMonitorScreen.tsx:299`), yani kullanıcı monitöre
girdiğinde tablo + istatistikler recharts inene kadar bekliyor. Grafik lazy
sınıra alınırsa tablo erken çizilir; grafik yerine kısa süre yer tutucu görünür.

## Yapılacak

1. `src/components/charts/LiveLineChart.tsx` recharts'ı içe aktaran tek yer
   (`LiveLineChart.tsx:21`). Bileşeni `React.lazy` ile sarmalayan bir sınır ekle
   — `SignalPanel` içinde `<Suspense fallback={…}>` ile.
2. Yer tutucu GRAFİK ALANIYLA AYNI YÜKSEKLİKTE olmalı: yoksa grafik inince
   sayfa zıplar (layout shift) ve monitörün tablo satırları kayar.
3. Yer tutucu metni çeviriye girer (`monitor.*` anahtarı, tr + en).
4. Grafik paneli kapalıyken (varsa gizleme/duraklatma yolu) chunk hiç inmemeli;
   varsa bu tercih edilir, yoksa Suspense sınırı yeterli.

## Doğrulama — bunlar geçmeden iş bitmiş sayılmaz

```bash
npm run typecheck
npm test                      # şu an 6860 yeşil · 1 atlandı
npx playwright test           # şu an 1355 geçti · 2 atlandı
npm run build                 # chunk ölçümü için
ls -S dist/assets/*.js | head -6 | while read f; do \
  printf "%-38s %5s KB gzip\n" "$(basename $f)" "$(gzip -c $f | wc -c | awk '{print int($1/1024)}')"; done
```

**Kabul ölçütü:** `LiveMonitorPage` chunk'ı belirgin küçülmeli ve recharts ayrı
bir chunk'ta görünmeli. Tarayıcı turu (`e2e/live-monitor.spec.ts`) grafik
chunk'ının AYRI istendiğini ve tablonun ondan ÖNCE dolduğunu ölçmeli — desen
`e2e/smoke.spec.ts`teki `page.on('request', …)` sayaçlarında hazır (çeviri
chunk'ları için yazıldı, birebir uyarlanır).

## Bilinmesi gereken tuzaklar

- **Bu depoda "yeşil test" yetmez:** UI işi gerçek tarayıcıda açılmadan
  bitmiş sayılmıyor. jsdom chunk sınırlarını hiç görmüyor; bugün iki hata tam
  bu yüzden yalnız Playwright turunda çıktı.
- **Çeviri anahtarı eklerken** `tr.ts` ve `en.ts` (çekirdek sözlükler) — protokol
  metinleri artık `trProtocols.ts`/`enProtocols.ts`te ve AYRI chunk'ta. Yeni
  `monitor.*` anahtarı çekirdeğe girer.
- Testler/e2e tam sözlüğü `@/translations/all` (e2e'de
  `../src/translations/all`) üzerinden alır; uygulama kodu oraya DOKUNMAZ.
- Playwright iki `webServer` koşuyor (uygulama 4319 + WebSocket köprüsü 9099).
  Port doluysa `lsof -nP -iTCP:<port> -sTCP:LISTEN` ile bak.
- `reuseExistingServer: false` bilinçli; değiştirme.

## Bağlam — bugün ne yapıldı (hepsi push edildi)

| commit | iş |
|---|---|
| `32dbec2` | Modbus RTU/ASCII/TCP encoder'ları |
| `c0f0ca4` | MQTT PUBLISH + CAN 2.0A/2.0B encoder'ları |
| `5eb72a1` | J1939 + NMEA 2000 encoder'ları |
| `553398a` | BACnet/IP + MS/TP encoder'ları — §33'ün hedef tarafı tamam (10 motor) |
| `421e3fe` | §33 Protocol Converter EKRANI — spec §6'nın son feature klasörü açıldı |
| `6bf67c0` | WebSocket `ByteSource` + Packet Builder bağlantısı |
| `fd2c863` | WebSocket'i Live Monitor ve Test Automation'a da bağla |
| `f51ca48` | Çeviri paketini dile göre böl (379 → 199 kB gzip) |
| `18b5687` | Protokol metinlerini ayrı chunk'a al (199 → **34 kB gzip**) |

Ayrıntılı gerekçeler `CLAUDE.md` "Bilinen borçlar" 3–12. maddelerde;
ölçümler `docs/plan-fazlar.md` sonundaki bölümlerde.

## Bu işten sonraki adaylar

1. `connection/usb` + `bluetooth` (spec §8.1'in kalan ikisi) — **tarayıcı turu
   YOK**, headless Chromium'da WebUSB/Web Bluetooth yok; birim testle sınırlı.
2. `components/packet-viewer · signal-viewer · protocol-tree` (spec §6 klasör
   listesi) — işlevin çoğu `byte-viewer`/`DecodePanel`/`charts`ta var, ağırlıklı
   olarak yeniden düzenleme.
3. Converter köprüleri: çıktıyı Packet Builder'a/monitöre aktarmak.

Spec §45'in sürüm planı (V1.0–V1.5) TAMAMLANDI; sıradaki işler yol haritasından
değil ölçümden çıkıyor.
