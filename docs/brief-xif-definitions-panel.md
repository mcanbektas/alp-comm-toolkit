# Brif — XIF (LonWorks) tanım paneli

**Depo:** `~/dev/alp-comm-toolkit` · **Dal:** `main`, temiz, `origin` ile eşit
**Önerilen model/effort:** Opus · high (yeni format grameri okunup modellenecek,
seçenek yok ama yorum gerekiyor — mekanik değil)

---

## İş tek cümleyle

`lonworks` kaydının (building-automation/lonworks-family) `definitions`
sekmesindeki "planlandı" bildirimini gerçek bir XIF ayrıştırıcısı + panelle
değiştir — spec §6'nın 9 tanım panelinden eksik kalan üç biçimin (`gsd` ·
`ldf` · `xif`) ilki.

## Neden bu üçü arasında XIF

CLAUDE.md'nin "Bilinen borçlar" bölümü (dalga 17 notu) XIF için kaynak
araştırmasını ZATEN bitirmiş — GSD (Profibus) ve LDF (LIN) için böyle bir
araştırma bu depoda hiç yapılmadı, format grameri sıfırdan çıkarılmalı.
Üçü de aynı boyutta iş (bkz. "Sıradaki adaylar"), ama XIF'in araştırma
riski en düşük.

## Kaynaklar (CLAUDE.md'den taşındı, doğrulanmadı — ilk iş bunları açıp
gerçekten okumak)

- **LONMARK Device Interface File Reference Guide rev 4.501** —
  `lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf` (girişsiz, 429 KB).
  Normatif söz dizimi kaynağı bu olmalı — EDS'in CiA 306'dan, DBC'nin
  Vector'ın kendi spec'inden alınmasıyla AYNI disclosure deseni
  (`edsTypes.ts` dosya başı yorumuna bak, örnek alıntı aşağıda).
- **`izot/shortstack`** (GitHub) — ~20 gerçek `.xif` örneği. Fixture ve test
  vektörleri buradan, UYDURULMAMALI.
- **`g3gg0/LonScan`** (GitHub) — açık C# XIF ayrıştırıcısı, ~250 satır.
  UYARI: kaynağın kendi notuna göre "sabit satır atlamalarıyla kırılgan" —
  birebir port ETME, yalnız alan/bölüm listesi için çapraz referans kullan.

## Mevcut desen — hangi dosyayı kopyalama şablonu olarak kullan

En yakın YAPISAL emsal `eds` (ikisi de düz metin, anahtar/bölüm tabanlı bir
tanım dosyası — DBC'nin de aynı ailede ama EDS biraz daha yakın). Dosyalar:

```
src/protocol-core/definitions/eds/
  edsTypes.ts     — veri modeli (EdsDatabase, EdsObject, EdsParseIssue, EdsParseResult)
  edsParser.ts    — düz metni EdsDatabase'e çevirir, satır numaralı hata listesi üretir
  edsDecoder.ts   — bir Object'in ham baytını DataType'a göre yorumlar
  edsFixture.ts   — SAMPLE_EDS_TEXT — ekran BOŞ açılmasın diye gömülü örnek
  index.ts        — barrel; ana protocol-core/index.ts'e BAĞLANMAZ (zorunlu
                    değil, definitions sekmesi lazy)

src/features/protocol-definitions/EdsPanel.tsx
  — dosya yükleme (data-testid="eds-import") + hata durumu + özet (dl) +
    nesne tablosu + "hex çöz" alt aracı (decodeEdsValue çağırır)
```

**XIF için birebir kopyala:** `xifTypes.ts` (muhtemelen `XifDevice`,
`XifNetworkVariable`, `XifConfigProperty`, `XifParseIssue`, `XifParseResult`
— gerçek alan listesi LONMARK rehberinden çıkar, uydurma), `xifParser.ts`,
`xifFixture.ts` (izot/shortstack'ten GERÇEK bir `.xif`, kısaltılmış olabilir
ama UYDURULMAMIŞ), `index.ts`, ve `XifPanel.tsx`.

## Yapılacak

1. LONMARK rehberini oku, `izot/shortstack`ten 2-3 gerçek `.xif` dosyasını
   incele — söz dizimini (bölüm başlıkları, NV/config property bildirim
   biçimi) ELLE çıkar.
2. `xifTypes.ts` — veri modeli. `EdsParseIssue`/`EdsParseResult` şeklini
   birebir taşı (satır numaralı hata listesi, `success: false` yalnız hiç
   NV çıkarılamadığında).
3. `xifParser.ts` — saf, senkron ayrıştırıcı. `g3gg0/LonScan`ı ALAN
   LİSTESİ için oku, satır atlama mantığını KOPYALAMA (kaynağın kendi
   itirafı: kırılgan).
4. `xifFixture.ts` — `izot/shortstack`ten gerçek bir XIF, `SAMPLE_XIF_TEXT`.
5. `XifPanel.tsx` — `EdsPanel.tsx`nin iskeletini izle: import + özet + NV/
   config property tablosu. "Hex çöz" alt aracı XIF'te ANLAMSIZ olabilir
   (bkz. tuzak 3) — varsa/yoksa karar ayrıştırma bittikten sonra netleşir.
6. `src/pages/ProtocolPage.tsx`teki `DEFINITION_PANELS`e `xif: XifPanel`
   ekle (bkz. `ProtocolPage.tsx:160-170`, dokuzu zaten orada).
7. Çeviri anahtarları: `definition.xif.*` (tr.ts + en.ts, `definition.eds.*`
   ile aynı desende — line/table/column anahtarları).
8. `e2e/xif-definitions.spec.ts` — `e2e/eds-definitions.spec.ts`i şablon al.

## Doğrulama — bunlar geçmeden iş bitmiş sayılmaz

```bash
npm run typecheck
npm test                      # şu an 6897 yeşil · 1 atlandı — bu sayı artmalı, düşmemeli
npx playwright test           # şu an 1359 geçti · 2 atlandı
```

**Kabul ölçütü:** `lonworks` kaydının `definitions` sekmesi "planlandı"
bildirimi DEĞİL gerçek bir NV/config property tablosu basmalı. Tarayıcı
turu (`e2e/xif-definitions.spec.ts`) ekranın gerçekten açıldığını ve ham
anahtar basmadığını kanıtlamalı (`e2e/xml-device-definitions.spec.ts`teki
"motoru olmayan biçimde panel AÇILMAZ" testiyle karşılaştır — o test artık
xif için YANLIŞ olacak, ekranı GÜNCELLEMEK gerekebilir).

## Bilinmesi gereken tuzaklar

- **Bu depoda "yeşil test" yetmez** — UI işi gerçek tarayıcıda açılmadan
  bitmiş sayılmıyor (bkz. [[ekrani-gercekten-ac]] hafıza kaydı).
- **Söz dizimi kaynağı NET olmalı, spec değil**: spec bu biçimi hiç
  tarif etmiyor (EDS ile aynı durum — `edsTypes.ts` dosya başına BAK).
  XIF için LONMARK rehberi + gerçek örnekler; g3gg0/LonScan yalnız ÇAPRAZ
  REFERANS, birincil kaynak değil.
- **NV mesajının SNVT tipi telde yoktur** (CLAUDE.md dalga 17 notu) — XIF
  dosyası bir NV'nin bildirim/config bilgisini taşır ama çalışma zamanı
  mesajı yalnız 14 bitlik bir SELECTOR taşır; XIF paneli tip bilgisini
  GÖSTERİR ama bu bilginin telde DOĞRULANAMAYACAĞINI da açık yazmalı —
  `lonworks.ts`in kendi `nvTypeNotOnWire` uyarısıyla AYNI disiplin.
- **`e2e/xml-device-definitions.spec.ts:130`teki "motoru olmayan biçimde
  panel AÇILMAZ, 'planlandı' bildirimi durur" testi DOĞRULANDI — `lin`i
  (`NON_XML_PATH`, LDF borcu) örnek alıyor, `lonworks`u DEĞİL. XIF paneli
  bu testi KIRMAZ. Ama LDF ileride yazılınca bu test `gsd`ye taşınmalı,
  gsd de bitince BAŞKA bir "hâlâ planlandı" biçim kalmayacağı için testin
  KENDİSİ (varsayımı: her zaman planlandı bir biçim var) elden geçmeli —
  bu notu LDF/GSD brifine taşı.
- **`ProtocolPage.tsx`teki `DEFINITION_PANELS`in birden çok biçimi olan
  kayıtlarda İLK eşleşen kazanır** yorumunu oku (satır ~319) — `lonworks`
  yalnız `['xif']` taşıyor, çakışma riski yok ama deseni bil.

## Bağlam

Bu brif [[alp-comm-converter-builder-koprusu]] hafıza kaydının kapattığı
zincirin devamı — `docs/brief-monitor-grafik-ayirma.md`nin (2026-08-30)
üç adayı (usb/bluetooth, packet/signal/protocol-tree, converter köprüsü)
TÜKENDİ ve kullanıcı bunun yerine `gsd`/`ldf`/`xif`den XIF'i seçti (diğer
ikisi araştırılmadığı için ertelendi). CLAUDE.md'nin "Bilinen borçlar"
bölümündeki dalga 17 notu ve "custom-schema definitions paneli YAZILDI"
maddesi (2. borç) ayrıntılı arka plan taşıyor — ikisini de oku.

## Bu işten sonraki adaylar

1. **GSD (Profibus DP)** — `industrial-automation/classic-fieldbus/
   profibus-dp` kaydı. Format grameri bu depoda HİÇ araştırılmadı; resmi
   kaynak PROFIBUS Profile Guidelines / GSD söz dizimi spesifikasyonu
   (PNO/PI yayını). Aynı desen (EDS/XIF gibi düz metin, anahtar=değer).
2. **LDF (LIN)** — `automotive/vehicle-network-protocols/lin` kaydı.
   Format grameri bu depoda HİÇ araştırılmadı; resmi kaynak LIN
   Consortium'un LDF spesifikasyonu (ISO 17987-6). Şema tabloları
   (frame/signal/schedule) EDS'ten daha karmaşık olabilir — brif turu
   gerektirir.
3. Converter → Monitör köprüsü — bilinçli ertelendi
   ([[alp-comm-converter-builder-koprusu]] gerekçeli), gerçek ihtiyaç
   çıkmadan tekrar açılmamalı.
