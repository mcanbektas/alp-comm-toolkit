# Test Automation Studio (spec §38) — yapılan iş ve kararlar

Bu dosya bir BRİF değil, yapılmış işin kaydıdır. `brief-ozellik-test-automation.md`
yazılmamış hâli tarif ediyordu; özellik yazıldı, o brifin "durum" bölümü artık çürük
(eski depo yolu `~/Desktop/...`, eski commit `7abc356`, "7 feature" sayımı).

Üç alt fazda yazıldı: **TA-a** motor + simüle cihaz, **TA-b** ekran + rota + e2e,
**TA-c** §40 proje dosyası bağı.

## Ne yazıldı

```
src/features/test-automation/
  scenario.ts          13 adım tipi + senaryo modeli + koşu öncesi doğrulama
  conditions.ts        operand/koşul modeli ve değerlendirici
  report.ts            §38 rapor alanları + satır bütçeli biriktirici
  runner.ts            adım makinesi (iptal edilebilir, ScenarioIo enjekte)
  byteSourceIo.ts      ScenarioIo'nun ByteSource üstündeki gerçeklemesi
  scenarioEdit.ts      ağaç düzenleme (ekle/sil/kaydır/kimlik) — saf
  scenarioStorage.ts   tarayıcı deposu; iki tüketicisi var (ekran + proje deposu)
  defaultScenario.ts   §38 örneğinin koşabilir hâli + simüle cihaz kuralı
  useTestAutomation.ts durum yönetimi, kaynak kurulumu, dosya turları
  TestAutomationScreen.tsx + components/ (senaryo · adım alanları · rapor)
src/connection/mock/simulatedDevice.ts   kural tabanlı, canWrite: true
src/pages/TestAutomationPage.tsx         rota /test-automation (lazy)
e2e/test-automation.spec.ts              gerçek tarayıcı turu
```

## Kararlar (koddan okunmayan kısım)

1. **Adım listesi KAPALI.** Spec 39405-39417 on üç adım veriyor; on dördüncüsü
   uydurulmadı. Rapor alanları da §38'in listesi (39433-39442) — fazlası yok.
   Rapor ikiye ayrıldı: ad/başlangıç/bitiş ve sayaçlar koşuya, alınan çerçeve ile
   beklenen/gerçekleşen değer ADIMA ait. Tek düzeyde tutmak, 100 turluk bir
   döngüde hangi turun hangi çerçeveyi aldığını gösterilemez kılardı.
2. **İfade dili değil yapılandırılmış koşul.** §41 39563-39564 `eval`i ve dinamik
   kod çalıştırmayı yasaklıyor; kullanıcının yazdığı bir ifadeyi sandbox'sız
   çalıştırmanın güvenli yolu yok ve küçük bir ayrıştırıcı yazmak yasağın harfini
   kurtarıp ruhunu çiğnerdi. §38'in örneği (39427 "Fail if temperature > 85")
   zaten tek bir karşılaştırma. Koşul: operand + operatör + operand, ya da bit
   maskesi. **`and`/`or`/`not` BİLEREK yok** — spec bir birleştirme istemedi;
   eklemek görünmeyen bir öncelik sırası icat etmek olurdu.
3. **Koşul üç cevap verir.** `true` / `false` / `unresolved`. "85'ten büyük
   değil" ile "sıcaklığı hiç okuyamadım" apayrı iki durumdur; ikincisini `false`
   saymak testi sessizce YEŞİL geçirebilirdi. Çerçeve gelmediyse, değişken
   tanımsızsa ya da alan çerçeveye sığmıyorsa adım HATA ile biter, `fail` ile
   değil. Aynı gerekçeyle tanımsız bir değişkeni artırmak da hata: 0'dan
   başlatmak, adı yanlış yazılmış bir değişkeni sessizce var ederdi.
4. **Sonsuz loop (§41 39570) İKİ sınırla kapatıldı.** Döngü sayısı üst sınırı
   `1_000_000` — `sendScheduler.ts`in `maxCount`uyla AYNI sayı, çünkü iki ayrı
   üst sınır birinde düzeltilen bir hatayı ötekinde yaşatırdı. Ayrıca koşunun
   TOPLAM adım bütçesi var: tek başına döngü sınırı yetmez, iç içe üç döngünün
   her biri sınırın altında kalıp çarpımda milyarlara çıkabilir. Bütçe aşılırsa
   koşu hata ile biter; sessizce kısaltmak eksik koşmuş bir testi tam gibi
   gösterirdi.
5. **Koşucu Worker'a taşınmadı ve dış dünya enjekte edildi.** Adımlar I/O
   bekler, CPU yakmaz; Worker'a taşımak Web Serial'in kullanıcı jesti zincirini
   (§41 39562) ekrandan koparırdı. `ScenarioIo` arkasında olması, birim testinin
   gerçek zaman beklemeden bütün dallardan geçmesini de sağlıyor.
6. **Kaynak koşudan önce, TIKLAMA İÇİNDE açılır.** `requestPort()` jest ister;
   koşucunun `connect` adımı yalnız `start()` çağırır.
7. **Varsayılan durma kuralı: dur.** Spec bir adım başarısız olunca ne olacağını
   söylemiyor. Bağlanamamış bir porta gönderilen 99 çerçevenin raporu ilk
   satırdan sonra bilgi taşımaz ve gerçek hatayı gürültüye gömer.
   `stopOnFailure: false` isteyen (dayanıklılık testi) bunu açıkça seçer.
   Koşmayan adımlar rapora YAZILMAZ; nereye kadar gidildiği `executedSteps`ten
   okunur.
8. **Geçersiz senaryo HİÇ koşmaz.** Yarısı koşmuş bir senaryo cihaza gerçek
   çerçeveler göndermiş olur ve raporu "hiç yapılmadı"dan yanıltıcıdır.
9. **Simüle cihaz eşleşmeyen isteğe SESSİZ kalır.** Uydurma bir "bilinmeyen
   komut" yanıtı, senaryodaki zaman aşımı adımını test edilemez kılardı; gerçek
   cihazlar da tanımadıkları komuta çoğunlukla susar. `ByteSourceKind` birliği
   GENİŞLETİLMEDİ (`kind` yine `'simulated'`): birliği büyütmek her tüketicide
   daralma etkisi yaratırdı ve kazancı yok.
10. **Beklemeden ÖNCE gelen çerçeve kaybolmaz.** Hızlı cihazda yanıt
    `waitForFrame` çağrılmadan gelir; kuyruk olmasaydı senaryo, cihaz doğru
    cevap verdiği hâlde zaman aşımına düşerdi — hata vermeden, yanlış
    raporlayarak. Filtreyi de IO uygular: araya giren ilgisiz bir çerçeve adımı
    düşürmemeli, beklemek eşleşen çerçeve gelene kadar sürer. Atılan çerçeve
    sayısı `droppedFrames`ten okunur, sessizce yutulmaz.
11. **Zaman tabanı `performance.timeOrigin + performance.now()`**
    (`connection/types.ts` başlık yorumu). `push` ve `tick` aynı tabandan
    beslenir; karışırsa zaman tabanlı çerçeveleme sessizce yanlış çerçeveler.
    Zaman tabanlı yöntemler için `tick()` 20 ms'de bir sürülüyor — sürülmezse o
    yöntemlerde son çerçeve hiç kapanmaz.
12. **Yeni adımın her alanı DOLU doğar.** `undefined` bırakılan bir alan,
    kullanıcı hiç dokunmadan "Çalıştır"a bastığında koşuyu ortasında düşürürdü.
    Bir bekçi testi 13 adım tipinin varsayılan hâlinin geçerli senaryo
    ürettiğini kanıtlıyor.
13. **Ağaç düzenleme bileşende değil.** `loop`/`conditional` çocuk taşıdığı için
    "şu adımı sil" bir ağaç yürüyüşü; bileşenin içinde yazılsaydı yalnız
    tarayıcıda sınanabilirdi. Dallar arası TAŞIMA yok: yarım yapılmış bir taşıma
    kullanıcının senaryosunu sessizce bozardı.
14. **§40 yuvası METİN taşır, `formatVersion` 1'de kaldı.** `protocols` zaten
    şema JSON metinleri saklıyor (aynı dosyanın kendi gerekçesi); senaryoyu
    burada ikinci kez doğrulamak, sessizce ayrışacak iki doğrulayıcı üretirdi.
    Sürümü 2'ye çıkarmak, salt EKLEME yapan bir değişiklik için var olan bütün
    proje dosyalarını reddetmek olurdu. Yuvası olmayan eski dosya açılmaya devam
    eder; geçersiz senaryo metni depodaki çalışan kaydı EZMEZ.
15. **Fixture uydurulmadı.** Simüle cihazın yanıtı §43'ün custom protocol
    çerçevesi `AA 05 10 03 34 12 7F 4F 55`; XOR'u bayt 1..6'yı kapsıyor ve
    doğrulandı. Eşik 85 §38'in kendi sayısı (39427), bekleme 500 ms yine onun
    (39424).

## Sınırlar — bilerek yapılmayanlar

- **Rapor yalnız JSON.** CSV, raporun ağaç yapısını (döngü turları)
  düzleştirmeyi gerektirir ve o düzleştirmenin kuralını spec vermiyor.
- **Şablondan gönderim modelde var, depo bağı yok.** `send-frame`in `template`
  varyantı `ScenarioIo.encodeTemplate`e devrediliyor; ekran bugün o kancayı
  bağlamıyor, ham bayt yolu çalışıyor.
- **`validate-field` alanı plugin decoder'ından çözmez**; çerçeveden ofset +
  genişlik + bayt sırası (+ ölçek) ile okur. Plugin çözümü lazy yükleme ve
  protokol seçimi ister; o ayrı bir tel.
- **Senaryo başına tek kayıt.** Ekran da proje dosyası da tek senaryo tutuyor
  (`protocols[0]` emsali). Senaryo kitaplığı ayrı bir iş.
- **e2e YALNIZ simüle cihaz üstünden.** Playwright'ta Web Serial yok
  (`connection/types.ts` başlık yorumu); gerçek cihaz turu elle yapılır.
