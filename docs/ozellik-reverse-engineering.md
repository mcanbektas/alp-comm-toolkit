# Unknown Protocol Analyzer (spec §35 + §36) — yapılan iş ve kararlar

Bu dosya bir BRİF değil, yapılmış işin kaydıdır. `brief-ozellik-reverse-engineering.md`
yazılmamış hâli tarif ediyordu; özellik yazıldı, o brifin "durum" bölümü artık çürük.

Dört alt fazda yazıldı: **RE-a** alan analiz motorları (`12ddea2`), **RE-b** checksum/CRC
alan tarayıcısı (`383b479`), **RE-c** kümelendirme + §36 diff (`dd37010`), **RE-d** faz
motoru + Worker (`8d465d5`) ve ekran (`254f950`).

## Ne yazıldı

```
src/protocol-core/statistics/
  entropy.ts · correlation.ts       genel amaçlı: Shannon entropisi + Pearson
src/protocol-core/analysis/         saf motorlar (React yok, tarayıcı API'si yok)
  types.ts                          AnalysisFrame + alan genişliği/bayt sırası modeli
  readField.ts                      çok baytlı alan okuma + guard'ın TEK yeri
  byteColumns.ts                    ChangeRate (39294) + entropi (39301) + sabit/değişen
  counterDetect.ts                  Delta (39306), mod-2^n sarma
  lengthFieldDetect.ts · asciiFieldDetect.ts · timestampDetect.ts · endiannessGuess.ts
  periodAnalysis.ts                 çerçeve damgası deltaları
  checksumScan.ts                   Match Rate (39311); checksumFinder sarmalayıcısı
  messageClustering.ts              imza tabanlı kümeleme
  messageDiff.ts                    §36 fark tablosu + alan rolleri
  fieldCorrelation.ts               alan↔alan ve alan↔bilinen seri
  packedFrames.ts                   Worker'a kopyasız aktarım (üç tampon)
  report.ts                         10 fazlı, iptal edilebilir analiz koşucusu
src/workers/reverseEngineering.worker.ts   analyze/progress/result/cancelled/failed
src/workers/analyzeInWorker.ts             ana iş parçacığı istemcisi (oturum, Promise değil)
src/features/reverse-engineering/
  frameInput.ts                     yapıştırılan döküm → AnalysisFrame[]
  useReverseEngineering.ts          ekran durumu + geç gelen sonuç bekçisi
  ReverseEngineeringScreen.tsx + components/ (girdi · sütun tablosu · adaylar · küme · fark)
src/pages/ReverseEngineeringPage.tsx       rota /reverse-engineering (lazy)
e2e/reverse-engineering.spec.ts            gerçek tarayıcı turu (Worker ayağı YALNIZ burada)
```

§35'in 13 maddesinin hepsi ve §36'nın fark/rol tablosu karşılandı. Fixture uydurulmadı:
spec'in kendi örnekleri kullanıldı (35060 RF seti, 39339-39353 §36 örneği, 16283 gyro
çifti, §43 Modbus RTU).

## Kesişen değişmezler

1. **Girdi her zaman çerçeve KÜMESİdir.** Tek çerçeveden alan yapısı çıkarılamaz: "sabit
   bayt" ancak karşılaştırmayla, sayaç ancak ardışık değerlerle görülür.
2. **"Bilinmiyor" ile "sıfır" ayrı tutulur.** N=1'de `changeRate` `undefined`; sabit
   seride Pearson `undefined`; damgasız kümede `periodic` `undefined` — `false` DEĞİL.
   Üçünü 0/false'a çevirmek sessiz veri uydurmasıdır.
3. **Eksik bayt asla 0 ile doldurulmaz.** Alan çerçevelerden birinde bile sığmıyorsa
   okuma `undefined` döner; eksik örnekle hesaplanan sayaç adımı sahte seri olurdu.
4. **Guard tek yerde durur** (`readField.ts`). `noUncheckedIndexedAccess` altında her
   motor kendi kontrolünü yazsaydı, birinde unutulunca sessizce 0 okunurdu — ve 0 telde
   gerçekten bulunan bir değerdir.
5. **Alan genişlikleri 1/2/4; 8 bayt yok** (`number`ın tam sayı kesinliğine sığmaz).
   Hizalama VARSAYILMAZ, her bayt ofseti taranır. Tek baytlık alanda bayt sırası daima
   `'big'` yazılır ki aynı alan iki kez raporlanmasın.
6. **Determinizm şartı.** Aynı girdi aynı çıktıyı verir: örneklem baştan alınır, küme
   anahtarları sabit, rastgele başlangıçlı yöntem yok.
7. **`eval` ve kullanıcı formülü yok.** Korelasyon girdisi SAYI DİZİSİdir. Gerekmediği de
   gösterildi: ölçek ve ofset Pearson katsayısını değiştirmez.

## Motor kararları (koddan okunmayan kısım)

8. **Sayaçta fark mod 2^(8×genişlik)** — sarma hesaba katılmazsa 8 bitlik sayaç 255→0
   geçişinde −255 verir ve sayaç her turda kaybedilir. **En az 3 çerçeve**: iki çerçevede
   TEK fark vardır ve tek fark her zaman "sabit"tir. **Adım 0 olamaz** (sabit alanı
   `byteColumns` zaten raporluyor). `allowVariableStep` varsayılan KAPALI: "artıyor ama
   adımı değişiyor" ölçütü spec'in kendi RF setinde checksum baytlarını da yakalıyor.
9. **Uzunluk alanı için en az İKİ FARKLI çerçeve uzunluğu şart.** Sabit uzunluklu kümede
   her sabit alan testi geçer ve "uzunluk alanı buldum" uydurma olur.
10. **ASCII eşiği 0.9, 1.0 değil**: gerçek metin alanları boşluk/NUL dolguludur. Daha
    düşük de tutulamaz — rastgele bir baytın yazdırılabilir olma olasılığı ~%37, düşük
    eşik ikili payload'u metin ilan ederdi. Asgari dizi uzunluğu 4: üç harflik "metin"
    rastgele ikili veride sık görülür.
11. **Timestamp yalnız 32 bit Unix SANİYE.** Milisaniye epoch'u 2001'den beri 2^32'yi
    aşıyor; uydurulmuş 6 baytlık okuma eklemek yerine kapsam dışı bırakıldı. Makul
    pencere 2000-01-01…2100-01-01 olmasa 32 bitlik alanların çoğu testi geçerdi.
    Yakalama damgasıyla korelasyon RAPORLANIR ama adayı ELEMEZ: ipucu, kanıt değil.
12. **Bayt sırası tahmininin ölçütü değişim dağılımıdır**, eşitse `undefined`. Sabit
    alanda cevap `undefined`'dır ve doğru cevap budur: sabit bir sayının bayt sırası
    veriden okunamaz.
13. **Periyot ölçütü DEĞİŞİM KATSAYISI (sapma/ortalama), ham sapma değil.** 1 ms sapma
    10 ms periyotta düzensizlik, 10 s periyotta mükemmel düzenliliktir; mutlak eşik
    yalnız tek bir hız aralığında doğru olurdu. Eşik 0.1.
14. **Checksum'da ölçüt ORANDIR, tek çerçeve yetmez.** Tek çerçevede 8 bitlik alanda
    rastgele uyum 256'da 1 ve 28 algoritma × birkaç konum deneniyor — bilinen en büyük
    yanlış-pozitif tuzağı bu. Bütçe: genişlik 1/2/4, kuyruk ofseti 0, veri başlangıcı
    ≤ 4, örneklem 200 çerçeve, eşik %50, sonda 8 çerçeve. Sonda: ilk 8 çerçevede eşiği
    tutturan tek aday bile yoksa kalan örneklem denenmez, çünkü gerçek checksum her
    çerçevede tutar. Algoritma katmanına DOKUNULMADI.
15. **Kümelemede k-means/hiyerarşik AÇIKÇA REDDEDİLDİ.** (a) Bayt değerleri metrik
    uzayda anlamsız: 0x05↔0x06 uzaklığı 1, 0x05↔0xF0 uzaklığı 235, oysa ikisi de sadece
    farklı mesaj tipi. (b) Rastgele merkez başlangıcı determinizmi bozar. (c) `k`
    önceden bilinmiyor. (d) Her yineleme tüm kümeyi dolaşır, tek geçiş şartını bozar.
    Seçilen: imza tabanlı anahtar (uzunluk + ayırt edici başlık baytları) — tek geçişli,
    deterministik ve AÇIKLANABİLİR.
16. **İmzaya girecek sütun ölçütü**: 2 ≤ farklı değer ≤ 8, ilk 4 bayt içinde, en çok 2
    bayt. Sayaç sütunları AYRICA elenir (az çerçevede sayaç da eşiği geçer ve imzaya
    girerse her çerçeve tek başına kümelenir) — eleme `counterDetect` ile yapılır,
    kümeleme kendi sayaç ölçütünü uydurmaz. Seçim TÜM küme üzerinde bir kez yapılır.
17. **Fark çiftten, ROLLER kümeden gelir.** İki mesajdan "muhtemel sayaç" etiketi
    çıkmaz. Rol önceliği: doğrulanmış checksum (Match Rate ≥ %90) → sabit → sayaç adayı
    → sezgisel checksum (son 2 bayt) → payload. **Sabitlik sayaçtan ÖNDE**, çünkü çok
    baytlı sayaç okuması sabit üst baytı kapsayabilir (`AA 10 00 01` → sahte 4 baytlık
    sayaç). `reason` alanı doğrulanmışı sezgiselden açıkça ayırır: spec'in RF örneğinde
    hiçbir CRC tutmuyor, etiket yalnız konumdan geliyor.
18. **Korelasyonda en az 3 örnek** — Pearson iki noktada HER ZAMAN ±1 verir. Bilinen
    değer serisinin uzunluğu çerçeve sayısına EŞİT olmalı; kısa seriyi hizalamak hangi
    ölçümün hangi çerçeveye ait olduğunu uydurmak olurdu. Üst üste binen okumalar elenir:
    aynı baytları paylaşan alanlar kendileriyle korele çıkar, bu bulgu değildir.
19. **Entropide `p = 0` terimi toplama HİÇ girmez.** Matematikte `0 × log2 0 = 0` ama
    JavaScript'te `0 * -Infinity = NaN`; tek bir görülmeyen bayt değeri bütün sonucu
    NaN yapardı.
20. **Spec metni ile veri çelişirse VERİ kazanır.** 35060 "Bytes 0-1: Constant" diyor
    ama aynı üç pakette 2. ve 3. baytlar da sabit; motor dördünü sabit sayar ve test
    bunu açıkça yazar.

## Worker ve ekran kararları (RE-d)

21. **Analiz ADIMLARA bölündü.** Tek parça senkron bir çağrı olsaydı Worker başladıktan
    sonra `cancel` mesajını GÖREMEZDİ — bir Worker gelen mesajı ancak boştayken işler
    (`logAnalyzer.worker.ts` bu sınırı dürüstçe not ediyor). `createAnalysisRunner` 10
    fazı kurar ama koşturmaz; sırayı ve iptali çağıran yönetir. Karşılığında iptal edilen
    analiz KISMİ raporla döner.
22. **Çerçeveler `PackedFrames` olarak gider** (data + offsets + timestamps), transfer
    listesiyle kopyasız. Çözerken `subarray` değil `slice`: transfer edilen tampondan
    pay alan görünüm ana iş parçacığında ölür. Damgası olmayan çerçeve `NaN` ile yazılır
    — 0 gerçek bir zaman damgasıdır.
23. **İstemci Promise değil OTURUM verir**: analiz süren bir iştir, ilerleme bildirir ve
    iptal edilebilir. Worker'sız ortamda (jsdom) aynı adımlar ana iş parçacığında, yine
    makro görevlere bölünerek koşar — tek senkron döngü olsaydı çağıran oturumu eline
    almadan analiz biter, `cancel()` hiç işe yaramaz ve geri çağrımlar React'te render
    sırasında düşerdi.
24. **Girdi iki kaynaktan gelir, tek kümeye iner.** Dosya yolu METNE çevrilmez: 100 bin
    kaydı bir `<textarea>`ya basmak tarayıcıyı kilitler ve kullanıcı o metni zaten
    düzenlemeyecek.
25. **Yapıştırmada iki mod**: `lines`ta çerçeve sınırı satır sonudur ve çerçeveleme
    yöntemi SORULMAZ; `stream`de satır sonu bir sınır değildir ve yöntem seçmek
    zorunludur. Yöntem seçilmezse boş sonuç döner — rastgele bir varsayılanla yanlış
    çerçeve üretmektense. Çerçeveleme `createStreamBuffer` üstünden koşar, elle bir
    çıkarım döngüsü yazılmaz.
26. **Zaman damgası yalnız köşeli parantezle** (`[1712.5] AA BB`): iki nokta bir hex
    ayracıdır (`AA:BB:CC`), `1712.5:` biçimi ayırt edilemez ve `1712` sessizce iki bayt
    okunurdu.
27. **Bozuk satır ATLANIR ama satır numarasıyla RAPORLANIR.** 900 satırın 3'ü bozuksa
    analiz yapılabilir, ama kullanıcı hangi satırların düştüğünü görmeden sonuca
    güvenmemeli.
28. **Ekran boş AÇILMAZ**: girdi kutusu spec 35060'ın RF setiyle dolu gelir ve ilk
    tıklamada gerçek rapor üretir (0-3 sabit, 4 sayaç adayı, 5-6 checksum adayı). "Boş
    kart basmak yasak" kuralının bu ekrandaki karşılığı budur.
29. **Sütun tablosu sanallaştırılmış, aday tabloları değil.** Sütun sayısı çerçeve
    uzunluğuyla (4096'ya kadar) büyür; aday sayısı bulgu sayısıyla orantılıdır. Boş aday
    listesi gizlenmez, "aday bulunamadı" der — gizlenen bölüm motorun hiç mi koşmadığını
    yoksa bir şey mi bulamadığını belirsiz bırakır.

## Sınırlar — bilerek yapılmayanlar

- **Şema köprüsü yok.** Tespit edilen alanlar protocol-studio şemasına AKMAZ; bu fazda
  yalnız raporun JSON dışa aktarımı var (brifin 6. kararının önerdiği çizgi).
- **Zaman tabanlı çerçeveleme yöntemleri listede yok** (`inter-frame-timeout`,
  `modbus-silent-interval`…): yapıştırılmış metinde baytlar arası süre YOKTUR, o
  seçeneği sunmak olmayan bir ölçümü varmış gibi göstermek olurdu.
- **Kullanıcı tanımlı formül alanı yok** — `eval` yasağı (yukarıda 7).
- **Değişken uzunlukta sütun analizi küme BAŞINA yapılmıyor**; ortak ofset üzerinden
  yürüyor ve o ofsete sahip çerçeve sayısı (`presentCount`) raporda taşınıyor. Küme
  başına analiz brifin 8. kararıydı, açık bırakıldı.
- **Canlı monitör oturumundan doğrudan aktarım yok.** Girdi ya yapıştırılır ya dosyadan
  okunur; monitörden aktarım ayrı bir tel gerektirir.
