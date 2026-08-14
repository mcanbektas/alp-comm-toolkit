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

## Faz 9 ne getirdi — Faz 10'un üstüne kuracağı ray

Faz 9'un asıl işi decoder yazmak değil, **desenleri kurmaktı**. Üçü de artık var:

```
katalog kaydı → resolvePluginId (alias zinciriyle) → registry (lazy import)
              → ProtocolPlugin.parser.parse(bytes) → ParseResult
              → parsedFrameToRegions() → ByteRegion[] → <ByteViewer>

katalog kaydı → definitions: ['dbc'] → <DbcPanel> (lazy) → parseDbc/decodeDbcMessage

ortak çekirdek + ince taşıma dosyaları  (modbusPdu+3 taşıma · nmeaSentences+nmea0183 ·
                                          canFrame+canClassic/canFd/canXl+j1939)
```

Faz 10 dalga 1'in dokunacağı hazır parçalar:

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

### Spec kapsam tablosu (karar turunda çıkarıldı, önden okumayı kısaltır)

Beş protokolün **dördünde** spec eksik veriyor — Faz 9'dakinden daha geniş bir alan.
Kod yazmadan önce bunu bil, yeniden keşfetme:

| Konu | Durum | Ne var / ne yok |
|---|---|---|
| ISO-TP PCI tipleri (SF/FF/CF/FC) | var | nibble eşlemesi tam |
| ISO-TP durum makinesi | **YOK** | DoIP için "state machine tutulmalı" yazan spec, ISO-TP için bu cümleyi hiç kurmuyor |
| ISO-TP STmin kodlama, BS=0, N_As/N_Bs/N_Cr, 4095 sınırı | **YOK** | tüm dokümanda grep sıfır |
| UDS SID | kısmi | 14 servis, başlığı "belgedeki **temel** servisler" — ISO 14229'un tamamı değil |
| UDS NRC tablosu | **YOK** | tüm dokümanda tek örnek: `7F 22 31` → `0x31` |
| OBD-II PID formülü | kısmi | yalnız 3: RPM, hız, sıcaklık |
| OBD-II PID tablosu/numaraları | **YOK** | 3 formülün PID numarası bile verilmemiş; J1979-DA'ya atıf var, içerik aktarılmamış |
| LIN PID parite | var | `P0`/`P1` formülü birebir |
| LIN checksum (classic/enhanced) | **YOK** | yalnız isim, hesap tarifi yok |
| CANopen OD (index/sub-index) | var | aralıklar + örnek girdiler |
| CANopen COB-ID kırılımı | **YOK** | tek satır: "COB-ID çözümleme aracı oluşturulmalı" — bit ayrımı, taban ID'ler yok |
| CANopen SDO expedited/segmented/block | kısmi | isim düzeyinde, komut byte/toggle bit/abort kodu yok |
| EDS dosya biçimi | **SIFIR** | 0 bölüm, 0 anahtar, 0 örnek — bkz. aşağıdaki karar |
| §43 fixture (bu beş protokol) | **YOK** | hiçbiri §43'te doğrulanmış referans olarak listelenmemiş |

Sonucu `status` alanına yansıt: `iso-tp` ve `uds` çerçeve/PDU düzeyinde tam olduğu için
`ready` adayı; **`obd-ii` ve `lin` `partial`** — `ready` demek spec'in vermediğini
vermiş gibi yapmak olur. `canopen` dalga 1b'nin kendi kararı.

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

### Kapsam bölmesi (karar turunda sonuçlandırıldı)
Beş protokol tek dalga için **fazla**. Dalga 3'te CAN'in dört varyantı + J1939 tek commit
oldu çünkü hepsi tek çekirdeği paylaşıyordu. Burada öyle değil: LIN'in CAN'le, CANopen'ın
UDS'le ortak hiçbir şeyi yok. Faz 10 dalga 1, dört alt dalgaya bölünüyor — her biri kendi
başına commit edilebilir:

- **1a**: ISO-TP + UDS + OBD-II (üçü aynı zinciri paylaşır: CAN → ISO-TP → UDS → OBD)
- **1b**: CANopen motoru
- **1c**: EDS (CANopen'dan sonra, kendi dalgası — bkz. karar aşağıda)
- **1d**: LIN

### Yapılacaklar

**1a — ISO-TP + UDS + OBD-II**
1. `src/protocols/automotive/isotp/` — ISO-TP **önce yazılmalı**, UDS ve OBD-II onun
   üstünde koşmaz, PDU düzeyinde ayrı girdi alır (bkz. karar aşağıda). Dört PCI tipi:
   Single Frame, First Frame, Consecutive Frame, Flow Control. Girdi SocketCAN
   `struct can_frame` (dalga 3 kararı, değiştirme). Çerçeve düzeyinde dördü de **tam**
   çözülür (SF_DL, FF_DL, SN, FS+BS+STmin-ham-bayt); birleştirme yapılmaz — J1939 TP
   deseni (`j1939.ts:35-37`, `WARN_TRANSPORT_SESSION`), aynı uyarı tonu.
   `status: 'ready'` — çerçeve düzeyinde eksik yok.
2. `src/protocols/automotive/uds/` — **girdi ham UDS PDU baytı** (SID + parametreler),
   CAN çerçevesi değil. SID tablosu (14, spec'in verdiği tam alt küme), pozitif/negatif
   yanıt (0x7F + NRC), response SID = request SID + 0x40. NRC tablosu spec'te yok — NRC
   ham bayt olarak alan, yanında `protocol.uds.warning.nrcNeedsDatabase` uyarısı
   (J1939'un `spnNeedsDatabase` deseni). `status: 'ready'`.
3. `src/protocols/automotive/obd/` — **girdi ham OBD PDU baytı**, CAN çerçevesi değil.
   Mode 01-0A çözümü, DTC sınıf harfi (P/C/B/U). PID formülü yalnız spec'in verdiği 3
   (RPM, hız, sıcaklık) — PID tablosunun geri kalanı **uydurulmaz**, J1939DA'daki gibi
   lisans/kaynak sorunu. `status: 'partial'`, `ready` DEĞİL.

**1b — CANopen**
4. `src/protocols/industrial/canopen/` — COB-ID = function code (4 bit) + node ID (7 bit).
   NMT, SYNC, EMCY, PDO, SDO, Heartbeat. SDO expedited/segmented/block. COB-ID taban
   ID'leri ve SDO komut byte/abort kodları spec'te yok, dış kaynak (CiA 301) + koda
   kaynak notu.
5. Kanonik `industrial-automation/cip-can-based/canopen` kaydına `pluginId`/`status`;
   `src/protocols/index.ts`'e kayıt.
6. `e2e/canopen-decode.spec.ts` — `can-decode.spec.ts` / `j1939-decode.spec.ts` desenini izle.

**1c — EDS** (bkz. karar aşağıda, 1b bitmeden başlama)
7. `src/protocol-core/definitions/eds/` — `dbc/` motorunun deseni birebir: `edsTypes`
   (model) · `edsParser` (INI bölümleri, hoşgörülü) · `edsDecoder` · `edsFixture`.
8. `src/features/protocol-definitions/EdsPanel.tsx` — `DbcPanel.tsx` deseni.
9. `src/pages/ProtocolPage.tsx` — bugünkü `showsDbcPanel` üçlü ternary'sini (`:227-233`,
   `:359-370`) `definitions[0] → lazy bileşen` seçici bir yapıya çevir, dördüncü kol
   eklemek yerine. Kablolamanın geri kalanı zaten hazır: `DEFINITION_FORMATS`'ta `'eds'`
   var, `DEFINITION_LABEL_KEYS.eds` var, çeviri `definition.eds` var, iki CANopen
   kaydında `definitions: ['eds']` zaten yazılı — katalog dosyalarına dokunma.
10. `e2e/eds-definitions.spec.ts` — `dbc-definitions.spec.ts` deseni.
11. Bekçi taşıma ve katalog borcu — bkz. aşağıdaki iki bölüm, 1c'nin İLK işi.

**1d — LIN**
12. `src/protocols/automotive/lin/` — sync break + sync byte 0x55 + PID (6 bit + 2 parite,
    spec'te tam formül var: `P0 = ID0⊕ID1⊕ID2⊕ID4`, `P1 = ¬(ID1⊕ID3⊕ID4⊕ID5)`).
    Klasik/geliştirilmiş checksum spec'te **yok** — dış kaynak (LIN 2.1) + kaynak notu,
    ya da yalnız PID çözümüyle `status: 'partial'` bırak. **LIN girdisi CAN değil**,
    kendi bayt düzeni.
13. Kanonik `automotive/vehicle-network-protocols/lin` kaydına `pluginId`/`status`;
    `src/protocols/index.ts`'e kayıt.
14. `e2e/lin-decode.spec.ts`.

### Karar: EDS ayrı dalga (1c), CANopen'dan (1b) sonra — SONUÇLANDI
DBC dalgası (3b) 14 dosya / 2278 satır / %100 ekleme oldu ve doğru boyuttaydı. EDS'in
INI ayrıştırıcısı DBC söz diziminden basit, ama üstüne Object Dictionary modeli
(16-bit index + 8-bit sub-index, erişim tipi, min/max/default) ve PDO mapping semantiği
biniyor — CANopen motoru + EDS aynı commit'te DBC'nin boyutunu geçer. Bağımlılık tek
yönlü: EDS decoder CANopen'ın OD/PDO modeline muhtaç, CANopen motoru EDS'e muhtaç değil
— motor önce (1b), tanım dosyası sonra (1c), 3 → 3b ile aynı yön. Spec EDS biçimi için
**sıfır** veriyor (0 bölüm, 0 anahtar, 0 örnek) — kaynak CiA 306'dan gelecek, bu ayrı
bir kaynak kararı ve CANopen motorunun kendi kaynak sorunuyla (COB-ID → CiA 301)
karışmamalı.

### Karar: ISO-TP nerede durur, UDS/OBD'nin girdisi ne — SONUÇLANDI
J1939 emsali birebir izlenir (`j1939.ts:35-37`, `WARN_TRANSPORT_SESSION`): **tanı, çöz,
birleştirme yok.**
- ISO-TP parser'ı SF/FF/CF/FC'nin dördünü de **çerçeve düzeyinde tam** çözer (SF_DL,
  FF_DL, SN, FS+BS+STmin-ham-bayt). STmin ms/µs'ye çevrilmez — kodlama tablosu spec'te
  yok, çevirmek uydurma olur.
- Oturum durumu, SN sıra doğrulaması, çok çerçeveli birleştirme, zamanlayıcı (N_As/
  N_Bs/N_Cr) **yapılmaz** — hepsi analyzer katmanının işi, spec de zaten bir durum
  makinesi tarif etmiyor (DoIP için ediyor, ISO-TP için etmiyor — bilinçli fark).
- **UDS ve OBD-II'nin girdisi CAN çerçevesi DEĞİL, ham PDU baytı** (SID+parametre /
  mod+PID+veri). Üç bağımsız parser, zincir parser katmanında kurulmaz — kurmak oturum
  durumu ister, o da J1939'da reddedilenin aynısı. Spec'in verdiği tüm örnekler zaten
  PDU düzeyinde (`22 F1 90`, `7F 22 31`, `02 10 01`). Bedeli açık: kullanıcı UDS
  sayfasına ham CAN çerçevesi yapıştırırsa çözülmez, bu üç motorun her birinin başlık
  yorumuna yazılacak bir sözleşmedir.

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

## Bekçi borcu — karar turunda netleştirildi

**`nmea-decode.spec.ts:28` ve `modbus-decode.spec.ts:36`'daki `PLANNED_DECODE_PATH`
(nmea-2000, psi5) bu dalgada KIRILMIYOR** — ikisi de bu beş protokolden motor almıyor,
taşıma gerekmez. Brifin önceki sürümündeki genel uyarı yanlış hedefliydi.

**Asıl kırılan, 1c'de (EDS) — `e2e/dbc-definitions.spec.ts:24-26`:**
```ts
const NON_DBC_DEFINITIONS_PATH =
  '/comm/automotive/vehicle-network-protocols/canopen?tab=definitions';
```
Bu bekçi tam olarak CANopen'ı gösterip orada `plannedNotice` bastığını iddia ediyor
(`:212`). EDS paneli açıldığı an düşer. **1c'nin ilk işi bu satırı başka bir "definitions
sekmesi var ama DBC de EDS de saymayan" kayda taşımak** — aday: `definitions: ['ldf']`
taşıyan LIN (`automotive.ts:261-291`, ama 1d'de o da motor alacaksa uygun değil, sırayı
kontrol et) veya `definitions: ['a2l']` taşıyan kayıtlar (`automotive.ts:751, 788, 823`).
PSI5'in dalga 3'teki taşınma gerekçesiyle aynı mantık: plan-fazlar.md'de yakın vadede
motor almayacak bir kayıt seç.

## Katalog borcu — 1c'ye ait (definitions kablolaması orada açılıyor)
Kanonik `automotive/vehicle-network-protocols/j1939` kaydında `definitions` alanı **YOK**,
ama alias'ı `marine-j1939`'da `['dbc', 'custom-schema']` var. Yani DBC paneli alias
sayfasında açılıyor, kanonik J1939'da açılmıyor. SPN çözümü DBC'den beslenecekse kanonik
kayda da `definitions: ['dbc']` + `tabs`'a `'definitions'` eklenmeli. 1c'de definitions
kablolamasına zaten dokunulacağı için bu borç oraya eklendi.

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

## Öneri (karar turu tamam, kararlar yukarıda yazılı — bir sonraki oturum doğrudan üretime girer)

| Dalga | İçerik | Model · effort |
|---|---|---|
| 1a | ISO-TP + UDS + OBD-II | Sonnet · high |
| 1b | CANopen motoru | Sonnet · high |
| 1c | EDS + bekçi taşıma + j1939 katalog borcu | Sonnet · medium |
| 1d | LIN | Sonnet · medium |

1a/1b **high**: desen üç dalgada kanıtlandı ama OBD PID'lerinde "spec vermiyorsa
uydurma" muhakemesi ve CANopen'ın kendi kaynak sorunu (COB-ID) var, medium bunu
kaçırabilir. 1c/1d **medium**: desen birebir kopya (DBC → EDS, dar tek çekirdek
dosya → LIN), karşılaştırılacak yol yok. Fable'a gerek yok — hiçbir dilimde Opus'un
yetmediği bir muhakeme yok. Ultracode'a gerek yok — iş zaten dalgalara bölünüyor, her
dalga tek başına commit edilebilir.
