# Log Analyzer (spec §34) — yapılan iş ve kararlar

Bu dosya bir BRİF değil, yapılmış işin kaydıdır. `brief-ozellik-*.md` dosyaları
yazılmamış özellikleri tarif eder; Log Analyzer yazıldı.

## Ne yazıldı

```
src/protocol-core/logs/        saf çekirdek (biçim ayrıştırıcıları + filtre + istatistik + dışa aktarım)
  types.ts                     ortak LogRecord modeli
  textTokens.ts                paylaşılan hex/zaman/yön okuyucuları
  columnRoles.ts               sütun/anahtar adı → rol sözlüğü (CSV ve JSON ortak)
  warnings.ts                  kod başına toplayan uyarı biriktirici
  candump.ts · vectorAsc.ts · delimited.ts · jsonLog.ts · hexTextLog.ts
  pcapSource.ts                capture/pcap.ts adaptörü
  binaryLog.ts                 ham ikili
  parseLog.ts                  biçim saptama + giriş noktası
  logFilter.ts · logStatistics.ts · logExport.ts · logDecode.ts
src/workers/logAnalyzer.worker.ts
src/features/log-analyzer/     ekran, hook, beş panel
src/pages/LogAnalyzerPage.tsx  rota /log-analyzer
e2e/log-analyzer.spec.ts       gerçek tarayıcı turu (Worker ayağı YALNIZ burada sınanır)
```

Okunan biçimler: **pcap · candump · Vector ASC · CSV/ayraçlı · JSON/NDJSON ·
hex metin dökümü · ham ikili**.

## Kararlar (koddan okunmayan kısım)

1. **`LogRecord`, `RawFrame` DEĞİLDİR.** `RawFrame.direction` zorunludur; logda
   yön çoğu zaman yoktur. Eksik yönü `'rx'` diye doldurmak rx/tx dağılımını
   sessizce uydururdu. `LogRecord` bilinmeyeni `undefined` saklar.
2. **`commStatistics.ts` kullanılmadı.** O motor canlı akış içindir: yön zorunlu,
   saat `performance.now()`. Log damgası epoch/görelidir. Sayısal özetler yine
   ortak `computeSignalStatistics`ten gelir; yalnız sayımlar yeniden yazıldı.
3. **`canParse` ile protokol tahmini YAPILMAZ.** Deponun ölçülmüş gerçeği naif
   `canParse`ın örnek çerçevelerin %54'ünde yanlış pozitif verdiğidir. Ölçüt
   `parse()`in gerçekten başarılı olmasıdır ve panel bunun bir KANIT değil ipucu
   olduğunu yazar.
4. **Zaman damgasının cinsi taşınır** (`absolute` / `relative` / `none`). Göreli
   bir damgayı saat gibi basmak 1970 gösterir; mutlak damgayı süre gibi basmak
   56 yıllık bir yakalama uydurur.
5. **Vector ASC'nin `timestamps absolute|relative`i epoch'la ilgili değildir**:
   `absolute` ölçüm başından, `relative` bir önceki olaydan geçen süredir
   (delta). Deltalar birikimli toplanır. Epoch'a çevrim yalnız `date …` başlığı
   İngilizce ay/gün adıyla yazılmışsa yapılır — `Date.parse` tanımadığı sözcüğü
   sessizce atladığı için (`Date.parse('Die Sep 21 …')` NaN dönmez) önce kalıp
   doğrulanır.
6. **candump'ta kimlik hane sayısı çerçeve tipidir** (3 → standart, 8 →
   genişletilmiş); bu yüzden `frameId` metin olarak saklanır. `##` CAN FD'dir ve
   sonrasındaki TEK hane bayraktır, veri değil. `#R8` uzaktan çerçevede 8, veri
   değil istenen uzunluktur.
7. **Ayraç seçimi "en çok görülen"le değil "en tutarlı sütun sayısı"yla yapılır.**
   Veri alanındaki bir virgül tek satırda çok görünür ama dosya boyunca sütun
   sayısını oynatır.
8. **Başlık satırı önce rol ADLARINA bakılarak tanınır.** `Time;ID;D0;D1`
   başlığında "D0" geçerli bir hex bayttır; yalnız "veri gibi mi duruyor"
   ölçütüyle bu satır VERİ sanılırdı.
9. **PCAPNG tanınır ve reddedilir.** Ayrı bir formattır; "bilinmeyen dosya"
   demek kullanıcıyı yanlış yere baktırırdı.
10. **Worker iptali sonucu ATAR, hesabı kesmez.** `parseLogFile` tek parça
    senkron bir çağrıdır; gerçek kesinti `terminate()` ile çağıranın kararıdır.
    Kullanıcı açısından fark eden şey UI'ın donmamasıdır ve o sağlanır.
11. **`Worker` yoksa ana iş parçacığına düşülür** (jsdom, Worker'ı kapatan
    WebView). Davranış aynı, büyük dosyada arayüz o süre donar. Bu yüzden
    Worker ayağının tek gerçek sınavı `e2e/log-analyzer.spec.ts`tir.

## Sınırlar — bilerek yapılmayanlar

- **PCAPNG** okunmuyor (ayrı format, ayrı ayrıştırıcı işi).
- **Ham ikili dosyada çerçeve çıkarımı** yok: `frameLength` verilmezse dosya tek
  kayıttır. Sabit 8 bayt varsaymak inandırıcı ama yanlış bir liste üretirdi;
  ayraç/uzunluk alanına göre çıkarım `protocol-core/framing`in işidir ve bu
  katmana henüz bağlı değildir.
- **Otomatik protokol tanıma** registry'nin tamamı üzerinde koşmuyor: 170+ motor
  lazy yüklenir, hepsini indirmek açılış bedelidir. Kullanıcı motoru seçer,
  "örneklemde dene" oranı ölçer.
- **CRC doğrulama** ayrı bir sütun değildir; seçilen motorun `parse()` sonucunun
  içinde gelir.
- Dosya boyutu sınırı **64 MB**, kayıt sınırı **200 bin** (spec §41 "dosya boyutu
  sınırı uygula"). İkisi ayrıdır: bir dosya az kayıtla da devasa olabilir.

## Ek: dosya oynatma kaynağı (spec §8.1, aynı çekirdek)

`src/connection/file/` — `logs` çekirdeğinden çıkan kayıtları monitörün CANLI
zincirine besleyen `ByteSource`. `replaySchedule.ts` saf çizelge üretir,
`fileSource.ts` onu tek bir `setInterval` ile sürer.

Kararlar:

- **Dosyayı kendi ayrıştırmaz.** `createSerialSource` gibi: fabrika çözümlenmiş
  kayıtları alır, okuma ve biçim saptama çağıranın işidir. Ayrıştırma
  `src/workers/parseLogInWorker.ts` üzerinden gider — Log Analyzer ekranı ve
  monitör aynı istemciyi paylaşır.
- **Zaman damgası yeniden yazılmaz.** `onChunk`in `receivedAt`i sözleşme gereği
  ŞU ANIN saatidir. Logun özgün damgasını geçirmek zaman tabanlı çerçevelemeyi
  ve zaman aşımı gözcüsünü iki farklı saatle karşılaştırmaya zorlardı. Logun
  zamanlaması damgaya değil TEMPOYA yazılır.
- **Kayıt sınırı çerçeve sınırıdır.** İki kaydı çerçeveleyicinin zaman
  aşımından yakın göndermek ikisini tek çerçeveye yapıştırır;
  `minimumGapForFraming()` seçili ayarın zaman aşımının iki katını garanti eder.
  `record-replay` hazır ayarı (`inter-frame-timeout`, 5 ms) bunun karşılığıdır.
- **Kayıt başına zamanlayıcı kurulmaz**: 200 bin kayıt 200 bin `setTimeout`
  demekti. Tek `setInterval`, her turda vakti gelmiş kayıtları boşaltır.
- **Uzun sessizlik kırpılır** (`maxGapMs`), damgalar değişmeden — dakikalarca
  sessiz bir logu birebir oynatmak kullanıcıyı boş ekrana baktırırdı.
- **Oynatma bitince kaynak AÇIK kalır.** Sözleşmede "bitti" durumu yok;
  uydurulmuş bir `idle` bildirimi ekranda "hiç bağlanmadı" gibi okunurdu.
  Bitiş `onCompleted` ile ayrı bir kanaldan bildirilir, bağlantıyı kullanıcı
  kapatır (son çerçevenin zaman aşımıyla kapanmasına da bu sayede vakit kalır).
- **Bus load hesaplanmaz**: dosya baud hızı taşımaz, uydurulmuş bir değer yüzdeyi
  uydururdu.
