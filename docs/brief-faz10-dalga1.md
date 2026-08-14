# BRİF — ALP Comm Toolkit, Faz 10 dalga 1 (CANopen · LIN · ISO-TP · UDS · OBD-II)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform` (tasarım token'ları buradan `file:` ile geliyor),
`~/Desktop/alp-pcb-toolkit`.

## Durum: son commit `e701ad9`, push edildi, çalışma ağacı temiz
- **Faz 9 TAMAM** — dört dalga bitti, plan tablosundaki dört maddenin dördü de kapandı:

| Dalga | İş | Commit |
|---|---|---|
| 1 | Modbus RTU/ASCII/TCP + parser→ekran zinciri | `1013bbe` |
| 2 | NMEA 0183 (GNSS 7'li semantik + generic envelope) | `f49ddc6` |
| 3 | CAN 2.0A/2.0B/FD/XL + J1939 | `c06c860` |
| 3b | DBC motoru + Definitions sekmesi paneli | `e701ad9` |

- **1867 birim testi (112 dosya), 92 Playwright testi, `tsc --noEmit` temiz, build çalışıyor.**
- Katalogda artık **10 kayıt `status: 'ready'`**: 3 Modbus, 1 NMEA 0183, 4 CAN, 1 J1939
  (+ alias'lardan devralan `gps-nmea`, `aerospace-uav/.../nmea`, `marine-j1939`, `marine-modbus`,
  `building-automation/.../modbus-rtu`).

## Faz 9 ne getirdi — dalga 4'ün üstüne kuracağı ray

Faz 9'un asıl işi decoder yazmak değil, **desenleri kurmaktı**. Üçü de artık var:

```
katalog kaydı → resolvePluginId (alias zinciriyle) → registry (lazy import)
              → ProtocolPlugin.parser.parse(bytes) → ParseResult
              → parsedFrameToRegions() → ByteRegion[] → <ByteViewer>

katalog kaydı → definitions: ['dbc'] → <DbcPanel> (lazy) → parseDbc/decodeDbcMessage

ortak çekirdek + ince taşıma dosyaları  (modbusPdu+3 taşıma · nmeaSentences+nmea0183 ·
                                          canFrame+canClassic/canFd/canXl+j1939)
```

Dalga 4'ün dokunacağı hazır parçalar:

- `src/protocols/index.ts` — `registerBuiltInProtocols(registry?)`. Yeni plugin buraya
  **dinamik import** ile eklenir; parser'lar açılış paketine girmemeli.
  `src/protocols/index.test.ts` kayıtlı id listesini **alfabetik** bekçiliyor, güncelle.
- `src/protocols/pluginBinding.ts` — `resolvePluginId` / `resolveStatus`. Dokunma;
  alias'lar bu zincirden otomatik devralıyor.
- `src/features/protocol-decode/DecodePanel.tsx` — `{ pluginId }` alır. **Yeni protokol
  için decode UI'ı YAZILMASI GEREKMİYOR.**
- `src/features/protocol-definitions/DbcPanel.tsx` — `definitions` sekmesi deseni.
  **CANopen'ın EDS'i için birebir kopyalanacak yer burası** (bkz. aşağıdaki karar).
- `src/protocol-core/definitions/dbc/` — tanım dosyası motorunun deseni:
  `dbcTypes` (model) · `dbcParser` (hoşgörülü, satır numaralı sorun listesi) ·
  `dbcDecoder` · `dbcWriter` (gidiş-dönüş testli) · `dbcFixture` (örnek + testlerin çıpası).
- `src/protocol-core/decoding/bitCursor.ts` — `readBits(bytes, pos, len, 'msb-first'|'lsb-first')`,
  `toSignedBits`, `writeBits`. Bit alanı çözen her şey buradan geçer, yeniden yazma.
- `src/protocols/automotive/can/canFrame.ts` — **SocketCAN çerçeve çekirdeği.**
  CANopen ve ISO-TP CAN üstünde koştuğu için ikisi de bunu kullanacak:
  `decodeCanId`, `decodeSocketCanFrame`, `CAN_HEADER_LENGTH`, `buildCanClassicFrame`.

## Sıradaki: Faz 10 dalga 1

Spec kaynağı: `docs/spec/ozet/04-otomotiv.md` (LIN, ISO-TP, UDS, OBD-II bölümleri) ve
`docs/spec/ozet/10-uygulama-spec.md` §19 (CANopen), §21 (UDS/ISO-TP/OBD-II). **Önce oku.**
Faz 9'da ölçüldü: spec'in verdiği ile vermediğini önden ayırmak dalganın en değerli ilk işi.

### Katalog yolları (doğrulandı)
| Yol | Rol |
|---|---|
| `industrial-automation/cip-can-based/canopen` | **KANONİK** — `pluginId` + `status` buraya |
| `automotive/vehicle-network-protocols/canopen` | alias → yukarıdaki |
| `automotive/vehicle-network-protocols/lin` | kanonik |
| `automotive/diagnostics/iso-tp` | kanonik |
| `automotive/diagnostics/uds` | kanonik |
| `automotive/diagnostics/obd-ii` | kanonik |
| `automotive/diagnostics/doip` | kanonik — **bu dalgada YOK**, sonraki dalgaya |
| `automotive/legacy-diagnostics/{iso-9141, kwp2000, k-line}` | **bu dalgada YOK** |

Alias kaydına `pluginId` ya da `status` YAZMA — ikisi de zincirden türetiliyor.

### Yapılacaklar
1. `src/protocols/automotive/isotp/` — ISO-TP **önce yazılmalı**, çünkü UDS ve OBD-II
   onun üstünde koşar. Dört PCI tipi: Single Frame, First Frame, Consecutive Frame,
   Flow Control. Girdi yine SocketCAN `struct can_frame` (dalga 3 kararı, değiştirme).
   **Tek çerçeve parser'ı çok çerçeveli oturumu birleştiremez** — J1939 TP'de olduğu gibi
   çerçevenin PCI'ı çözülür, birleştirme analyzer katmanının işi olarak bırakılır ve
   sebebi uyarıyla söylenir.
2. `src/protocols/automotive/uds/` — SID tablosu, pozitif/negatif yanıt (0x7F + NRC),
   response SID = request SID + 0x40. NRC tablosu.
3. `src/protocols/automotive/obd/` — Mode 01-0A, PID tablosu. **PID formülleri spec'te
   var mı önce bak**; yoksa J1939DA'daki gibi lisans/kaynak sorunu var demektir, uydurma.
4. `src/protocols/automotive/lin/` — sync break + sync byte 0x55 + PID (6 bit + 2 parite),
   klasik/geliştirilmiş checksum ayrımı. **LIN girdisi CAN değil**, kendi bayt düzeni.
5. `src/protocols/industrial/canopen/` — COB-ID = function code (4 bit) + node ID (7 bit).
   NMT, SYNC, EMCY, PDO, SDO, Heartbeat. SDO expedited/segmented/block.
6. Katalogda ilgili kanonik kayıtlara `pluginId`/`status`; `src/protocols/index.ts`'e kayıt.
7. `e2e/<protokol>-decode.spec.ts` — `can-decode.spec.ts` / `j1939-decode.spec.ts` desenini izle.

### Verilmesi gereken karar (dalga başında sor, kendiliğinden seçme)
**EDS dosyası nereye?** CANopen'ın tanım dosyası EDS'tir ve katalogda
`definitions: ['eds']` olarak zaten yazılı. DBC için verilen karar (Definitions sekmesi +
`protocol-core/definitions/` altında motor) buraya birebir uygulanabilir, ama EDS bir INI
türevi ve DBC'den bambaşka bir söz dizimi — ayrı bir dalga mı olmalı, yoksa CANopen'la
birlikte mi? Dalga 3b'de DBC tek başına bir dalgaydı ve doğru boyuttaydı.

### Kapsam uyarısı
Beş protokol tek dalga için **fazla**. Dalga 3'te CAN'in dört varyantı + J1939 tek commit
oldu çünkü hepsi tek çekirdeği paylaşıyordu. Burada öyle değil: LIN'in CAN'le, CANopen'ın
UDS'le ortak hiçbir şeyi yok. Önerilen bölme:
- **4a**: ISO-TP + UDS + OBD-II (üçü aynı zinciri paylaşır: CAN → ISO-TP → UDS → OBD)
- **4b**: CANopen (+ EDS kararı)
- **4c**: LIN

## Tuzaklar — hepsi bu depoda gerçekten tökezletti

- **`ParsedField` alanları `offset`/`length`**, `byteOrder`/`byteLength` DEĞİL.
- **`ProtocolErrorCode` KAPALI bir union** (`src/protocol-core/types.ts`). Yeni kod
  uyduramazsın; mevcutlardan seç (`truncated-frame`, `frame-too-long`, `length-mismatch`,
  `value-out-of-range`, `checksum-mismatch`, `unsupported-function-code`, `parser-timeout`…).
- **Eksik çeviri anahtarı `tsc`'yi kırar** (`en.ts` tipi `tr.ts`e bağlı) — bu iyi haber,
  dalga 3b'de 25 anahtarı derleyici saydırdı. Ama `t(x as TranslationKey)` ile daraltılan
  anahtarlar bu bekçiden KAÇAR; `messageKey`/`errorKey` sabitlerini ayrıca grep'le.
- **Çözümleyiciler saf TS, yerelleştirilmiş metin üretemez.** `ParsedField.warnings`,
  `ProtocolWarning.message`, `ProtocolError.message` alanlarına **çeviri anahtarı** konur;
  gösterim tarafı `translateDiagnostic` ile geçirir. Ham basmak dalga 1'de ekranda
  `protocol.modbus.rtu.warning.roleInferredRequest` olarak göründü.
- **Anahtar metnine yer tutucu KOYMA.** Sayılar `summaryParams`/`details` üzerinden ayrı
  taşınır; `t(key, vars)` eksik anahtarla çalışma zamanında fırlatır.
- **BYTE-VIEWER BÖLGE ÇAKIŞMASI — dalga 3'ün iki kusuru buradan çıktı.**
  `parsedFieldAdapter` çakışan aralıklarda **listede SONRA geleni** kazandırır. Aynı baytı
  paylaşan iki alana aynı aralığı verirsen ikincisi birincisini tamamen örter ve satıra
  tıklamak hiçbir baytı vurgulamaz. Bit alanına **gerçekten yaşadığı baytı** ver:
  RTR/IDE identifier'ın dördünü değil 3. baytı, CAN XL'de VCID `prio`nun dördünü değil
  2. baytı alır. Türetilmiş alanın (PGN gibi) bölgesi hiç olmayabilir, bu normaldir.
- **`ImplementationStatus` = `'planned' | 'partial' | 'ready'` — `'implemented'` YOK.**
- `src/tests/catalog.test.ts` **8/54/172** sayılarını, alias bütünlüğünü ve
  `definitions` sekmesi ⟺ `definitions` listesi eşitliğini bekçiliyor. Yeni katalog kaydı
  ekleme; var olana `pluginId`/`status` eklemek serbest ve testi kırmaz.
- `noUncheckedIndexedAccess` açık — `bytes[i]` tipi `number | undefined`, guard yaz.
- **JS bit işlemleri işaretli 32-bit üretir.** `0x80000000` maskesi negatife döner;
  `>>> 0` yazmayı unutma (dalga 3'te CAN ID bunu gerektirdi).
- `any` yok, `@ts-ignore` yok. Kod yorumları Türkçe, tanımlayıcılar İngilizce.
- Ham renk yasak, yalnız token utility'leri. **Tailwind sınıf adı şablonla üretilemez** —
  sabit `Record` tablosu kur.
- i18n: yeni metin hem `tr.ts` hem `en.ts`e; `translations.test.ts` küme eşitliğini denetliyor.
- **Playwright'ta rota öneki `/comm/` ZORUNLU**, port `4319`, `reuseExistingServer: false`
  bilinçli — değiştirme. Dev sunucusu `3001`.
- Protokol/servis/alan ADLARI **veridir, çevrilmez** ("Read Data By Identifier" iki dilde aynı).

## Bekçi borcu — bu dalgada kırılacak
`e2e/nmea-decode.spec.ts:28` içindeki `PLANNED_DECODE_PATH` şu an
`marine-navigation/nmea-family/nmea-2000?tab=decode`. NMEA 2000 dalgası gelince kırılır.
`e2e/modbus-decode.spec.ts` aynı sebeple dalga 3'te `can-2-0a`dan
`automotive/sensor-interfaces/psi5`e taşındı — aynısı gerekecek.
**Bu dalgada CANopen/LIN/ISO-TP/UDS/OBD motorlarından biri bir bekçi yoluna denk geliyorsa
önce onu taşı.**

## Katalog borcu
Kanonik `automotive/vehicle-network-protocols/j1939` kaydında `definitions` alanı **YOK**,
ama alias'ı `marine-j1939`'da `['dbc', 'custom-schema']` var. Yani DBC paneli alias
sayfasında açılıyor, kanonik J1939'da açılmıyor. SPN çözümü DBC'den beslenecekse kanonik
kayda da `definitions: ['dbc']` + `tabs`'a `'definitions'` eklenmeli.

## Çalışma kuralları

- `npm run dev` → localhost:3001/comm/ · `npm test` · `npm run build` · `npm run test:e2e`
- **Yeşil test ekranın açıldığını kanıtlamıyor.** UI'a dokunan her iş bitince gerçek
  tarayıcıda tur at: yatay taşma, konsol hatası, boş etiketli düğme, yinelenen başlık,
  **ham çeviri anahtarı kalıntısı** (`/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/`) tara.
  Ölçüldü: dalga 1'de iki, dalga 3'te iki kusur ancak bu turda görüldü ve dördü de
  testlerin göremediği cinstendi.
- **Bulunan kusur için yazılan bekçi testi, düzeltme geçici geri alınınca kırmızıya
  dönmeli.** Hep yeşil kalan test bekçi değil. Dalga 3'te bu doğrulandı, sen de doğrula.
- **Fixture'ı uydurma.** Spec §43'te doğrulanmış değer varsa çıpa odur. Yoksa (CAN'de
  yoktu, DBC'de yoktu) değeri gerçek algoritmayla hesapla ve testte kanıtla; kaynak
  uyarısını koda yaz.
- **Spec'in vermediğini vermiş gibi yapma.** Faz 9'da üç kez oldu: CAN FD'nin DLC tablosu,
  J1939 PGN isimleri, DBC söz dizimi. Üçünde de kaynak dışarıdan geldi ve bu koda yazıldı.
  J1939DA/SAE J1979-DA lisanslı — **OBD-II PID formüllerinde aynı sorun çıkabilir.**
- Commit serbest, **push için ayrıca onay iste**.
- Kota bu işte ajanları düşürdü. İş **dalgalara** bölünüyor; her dalga tek başına
  commit edilebilir olmalı.
- **Bağlam hijyeni:** keşif işini (dosya arama, kod tarama, "şu nerede tanımlı")
  subagent'a ver. Faz 9'da her dalganın başında iki paralel Explore ajanı koşturuldu ve
  işe yaradı. Bağlam 200K'yı geçince oturumu böl.

## Öneri
Model: **Sonnet**, effort: **high** — desen üç dalgada kanıtlandı, mimari karar
büyük ölçüde kalmadı. **İki istisna, ikisi de Opus'a çıkmayı hak eder:** EDS'in
yerleşimi (yukarıdaki karar) ve ISO-TP'nin çok çerçeveli oturum sınırı — tek çerçeve
parser'ının nerede durup analyzer katmanının nerede başladığı, J1939 TP'de de aynı
soruydu ve orada "tanı ama birleştirme" diye çözüldü; UDS bunun üstüne oturduğu için
burada bedeli daha yüksek.
