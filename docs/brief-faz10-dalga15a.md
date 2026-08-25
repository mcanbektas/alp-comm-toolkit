# BRİF — Faz 10 dalga 15a, `dronecan` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra bu dosyayı okur.
Ana brifteki bulgular burada tekrar edilmez, referans verilir.

Bu, dalga 15'in **açılış** alt dalgasıdır: kaynak mükemmel, taşıyıcı altı kez
kanıtlı, **katalog eklemesi YOK**. Dalganın geri kalanına güven vermek için
bilerek en başa konuldu.

---

## Girdi sözleşmesi

**Girdi, `canFrame.ts`in SocketCAN yakalama konteyneridir** — telin kendisi değil.
`isotp`, `j1939`, `canopen`, `devicenet`, `xcpOnCan`, `ccp`, `nmea2000` yedi
tüketicinin hepsi aynı girdiyi alıyor; sekizincisi olmak yeni bir karar DEĞİL.

Alınacak semboller (`@/protocols/automotive/can/canFrame`):

```
decodeSocketCanFrame  CanIdentity  decodeCanId  formatHex
CAN_CLASSIC_FRAME_LENGTH (=16)  CAN_HEADER_LENGTH (=8)  CAN_CLASSIC_MAX_PAYLOAD (=8)
```

**CAN FD ALINMAZ.** DroneCAN yalnız CAN 2.0B'dir (spec `06-havacilik-uav.md:117`:
*"Yalnız 29-bit CAN identifier kullanılır"*). `CAN_FD_FRAME_LENGTH` (72 bayt) gelen
bir girdi `xcpOnCan.ts:169`in yaptığı gibi AÇIKÇA reddedilir ve gerekçesi dosya
başına yazılır.

**29-bit ZORUNLUDUR.** `decodeCanId` (`canFrame.ts:144`) `CanIdentity` döndürür;
`extended` alanı `false` gelirse çerçeve DroneCAN DEĞİLDİR — `canParse` `false`
döner, `parse` uyarır.

---

## Kaynak durumu — bu dalganın EN İYİ durumu, ama yine de çaprazlanır

**İki bağımsız kaynak örtüştü** (ana brif bulgu 1):

1. **Spec özeti** `06-havacilik-uav.md:115-156` — alan ADLARI, tail byte bit tablosu
   (`:134-139`), örnek `0xC5 = 11000101 → SOT=1, EOT=1, Toggle=0, Transfer ID=5`
   (`:141`), 4-frame toggle dizisi `0 1 0 1` (`:146`), transfer ID wrap kuralı
   (`:149`).
   **Vermediği:** CAN ID alanlarının bit GENİŞLİKLERİ (`:126` açıkça "resmi
   spec'te tanımlıdır" diyor), transfer CRC'nin parametreleri.
2. **Resmî DroneCAN/UAVCAN v0 CAN taşıma spec'i** (dronecan.github.io Bölüm 4,
   aynı metin legacy.uavcan.org'da) — bit genişliklerini ve CRC'yi veriyor.

Örtüşme noktaları (tail byte bit düzeni, toggle semantiği, transfer ID genişliği)
BİREBİR. Bu yüzden bit genişlikleri güvenle uygulanır.

### CAN ID alan düzeni (29 bit, yüksekten alçağa)

| Transfer | Alanlar |
|---|---|
| **Message broadcast** | Priority(5) · Message type ID(16) · Service-not-message(1)=**0** · Source node ID(7)=**1…127** |
| **Anonymous message** | Priority(5) · Discriminator(14) · Msg type ID alt bitleri(2) · SNM(1)=**0** · Source node ID(7)=**0** |
| **Service** | Priority(5) · Service type ID(8) · Request-not-response(1) · Destination node ID(7) · SNM(1)=**1** · Source node ID(7) |

**Ayrım kuralı — SIRA ÖNEMLİ:**
1. `SNM` biti (bit 7) **1** ise → Service transfer.
2. `SNM` **0** ve Source node ID **0** ise → Anonymous message.
3. `SNM` **0** ve Source node ID **1…127** ise → Message broadcast.

Bu sırayı bozmak (önce node ID'ye bakmak) anonim mesajları normal mesaj sanır.

### Tail byte (`data[length-1]`, MSB'den)

| Bit | Alan |
|---|---|
| 7 | Start Of Transfer |
| 6 | End Of Transfer |
| 5 | Toggle |
| 4:0 | Transfer ID (5 bit, 0–31) |

### Transfer CRC — KATALOG EKLEMESİ YOK

Resmî spec: `CRC-16-CCITT-FALSE`, init `0xFFFF`, poly `0x1021`, reverse: no,
xorout: yok. Depodaki `CRC16_CCITT_FALSE` (`crcCatalogue.ts`) **birebir aynı**.
`computeNamedCrc('CRC16_CCITT_FALSE', bytes)` çağrılır, **yeni giriş EKLENMEZ**,
`CrcCalculatorTool.test.tsx`in 34 sayısı DEĞİŞMEZ.

**AMA CRC DOĞRULANAMAZ ve bu dürüstçe yazılır:** transfer CRC girdisi
*"transfer payload, prepended with a data type signature"*tır. Data type signature
DSDL tanımından gelir ve depoda DSDL derleyicisi YOKTUR (ana brif bulgu 9). Yani:

- **Single-frame transfer'de transfer CRC HİÇ YOKTUR** → doğrulanacak bir şey yok,
  çerçeve TAM çözülür.
- **Multi-frame transfer'de CRC vardır** → ilk çerçevenin ilk 2 baytıdır,
  **GÖSTERİLİR ama DOĞRULANMAZ**, uyarı basılır
  (`transferCrcNeedsDataTypeSignature`).

Bu, `mavlink.ts`in CRC_EXTRA durumundan **farklıdır**: MAVLink'te her çerçevede
doğrulanamayan bir CRC var; DroneCAN'de single-frame çerçevelerde doğrulanacak CRC
YOK. Bu yüzden `status: 'ready'` yanıltıcı DEĞİLDİR — ama dosya başında ayrım
açıkça yazılır. **CRC "gösterilir" ile "doğrulanır" ayrımı kullanıcıya görünür
olmalı** (dalga 13 dersi 3).

---

## `canParse` — bekçi testi ZORUNLU

Emsal: `j1850CanParseRegistry.test.ts`, `sentSpcCanParseRegistry.test.ts`,
`psi5CanParseRegistry.test.ts`.

DroneCAN'in `canParse`ı **yalnız uzunluğa bakamaz** — `isotp`, `j1939`, `canopen`,
`devicenet`, `ccp`, `xcpOnCan`, `nmea2000` ile AYNI 16 baytlık konteyneri
paylaşıyor. En az şu üçü birlikte sınanmalı:

1. Uzunluk `CAN_CLASSIC_FRAME_LENGTH` (16) ve payload uzunluğu 1…8.
2. `decodeCanId(...).extended === true` (29-bit zorunlu).
3. Tail byte tutarlılığı: single-frame ise SOT=1 **ve** EOT=1 **ve** Toggle=0
   (spec `:144`).

**Ölçüm ZORUNLU** (14f'in "%54 yanlış pozitif" dersi): yeni test registry'nin
tüm örnek çerçeveleri üzerinden koşar ve DroneCAN'in başka hiçbir protokolün
örneğini kabul etmediğini kanıtlar. Özellikle `j1939` ve `canopen` çakışma riski
yüksektir (ikisi de 29-bit/11-bit CAN kullanıyor).

Ters yön de sınanır: DroneCAN örnek çerçevelerinin başka bir parser tarafından
kabul EDİLMEDİĞİ. Kabul ediliyorsa bu bir bulgu olarak brife yazılır, sessizce
düzeltilmez.

---

## Uygulama görevleri

1. **Kaynak turu** — resmî DroneCAN CAN taşıma spec'ini AÇ, yukarıdaki üç tabloyu
   ve CRC parametrelerini SATIR SATIR doğrula. Örtüşmeyen tek alan bile
   ADLANDIRILMAZ, ham kalır + uyarılır.
2. **`src/protocols/aerospace/dronecan/dronecan.ts`** — dosya başı, `mavlink.ts`in
   disiplinini izler: spec'in verdiği/vermediği ayrımı, CRC'nin neden
   doğrulanmadığı, DSDL'in neden kapsam dışı olduğu, CAN FD'nin neden reddedildiği.
3. **Alanlar** — `ParsedField.offset`/`length` **BAYT** cinsinden. CAN ID'nin bit
   alanları için **kapsayan bayt aralığı** verilir (SocketCAN konteynerinde ID
   offset 0'da 4 bayttır, `readUint32Le` `canFrame.ts:163`), bit ayrıntısı **alan
   ADINDA** taşınır: `CAN ID · Priority (bit 28:24)`, `CAN ID · Message Type ID
   (bit 23:8)`, vb. `rtp.ts`/`rtcp.ts` emsali.
4. **Tail byte** ayrı dört alan olarak çözülür; `Transfer ID` alanına **`unit`
   VERİLMEZ** (sayaç, fiziksel değer değil).
5. **Payload HAM** — DSDL yok, alan adı yakıştırılmaz. `dsdlRequiredForPayload`
   uyarısı basılır. `definitions: ['dsdl']` katalogda ZATEN yazılı (`:121`),
   panel BOŞ kalır (`snmp.ts:46` / `bleGatt.ts:34` emsali).
6. **Toggle wrap uyarısı DEĞİL, BİLGİ** — transfer ID'nin 31→0 wrap'i **geçerlidir**
   (spec `:149`, `:543`). Hata olarak raporlanırsa yanlış pozitif üretilir.
   Çerçeveler arası toggle sırası takibi **parser'a GİRMEZ** (`mavlink.ts`in
   SEQ-LOSS kararı) — tek çerçevede yalnız tail byte alanları çözülür.
7. **Multi-frame reassembly YAZILMAZ.** Katalog `Multi-Frame Reassembly` aracını
   listeliyor (`:112`) ama bu çerçeveler arası durumdur — analyzer işi.
   Parser yalnız `SOT`/`EOT`/`Toggle`ı çözer ve çerçeveyi
   `single-frame` / `multi-frame first` / `multi-frame middle` / `multi-frame last`
   olarak SINIFLAR.
8. **Registry** — `src/protocols/index.ts`e `registerOnce(registry, 'dronecan', ...)`.
   Katalogda `pluginId: 'dronecan'` alanı **eklenir** (şu an YOK, `:89-126`).
9. **Katalog** — `status: 'planned'` → `'ready'` (`:94`).
10. **Çeviri** — `src/translations/en.ts` ve `tr.ts`e uyarı/alan anahtarları.
11. **Test** — `dronecan.test.ts` (üç transfer tipi + tail byte + CRC gösterimi +
    ret vakaları) ve `dronecanCanParseRegistry.test.ts`.
12. **e2e** — `e2e/dronecan-decode.spec.ts`. `can-decode.spec.ts` ve
    `canopen-decode.spec.ts` birebir emsal.

---

## `decodeOptions`

**AÇILMAZ.** DroneCAN'in çerçeve yorumu için seçenek gerekmiyor: CAN ID düzeni
SNM bitinden kesin türer, tail byte sabittir. Seçenek eklemek "gerekmediği hâlde
kanal açmak" olurdu.

---

## Devralınan tuzaklar

- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`), bit değil.
- **`ParsedField.id` KENDİ offset'ini kullanır** — `bitCursor` ile çalışırken bit
  konumunu bayt offset'ine çevirirken kolayca kaçar (`ftp.ts`/`rtcp.ts` vakaları).
- **`ParsedFrame` DÜZ, `children` YOK.** "Transfer ağacı" isteği alan ADLARIYLA
  karşılanır (`CAN ID · Priority`, `Tail · Transfer ID`).
- **`unit` yalnız gerçek fiziksel değere** — Node ID, Transfer ID, Priority birimsiz.
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin "Devralınan tuzaklar" listesi aynen
  geçerli.
- **`canFrame.ts`i "biraz genişletme" isteğine direnç göster** — DroneCAN'e özel
  hiçbir şey oraya gitmez (12d'nin `networkTimestamp` vakası).

---

## Model/effort önerisi

**Sonnet · high.** Tarif net ve iki bağımsız kaynak örtüşüyor; katalog eklemesi yok,
taşıyıcı altı kez kanıtlı. Muhakeme gerektiren tek yer *"multi-frame reassembly
parser'a girer mi"* sınırı ve `canParse` bekçisinin kapsamı — ikisi de bu brifte
yazılı ama emsale bakarak uygulanacak. `medium` değil: yedi komşuyla paylaşılan bir
konteynerde `canParse` yanlış-pozitifi ölçülmüş bir risk.

**Tamamlanma ölçütü:** `dronecan` **Hazır** rozetiyle açılıyor; üç transfer tipi de
`decode` sekmesinde ayrı ayrı çözülüyor; multi-frame CRC "gösterildi, doğrulanmadı"
uyarısıyla görünüyor; `dronecanCanParseRegistry.test.ts` registry'nin tüm örnek
çerçeveleri üzerinde yeşil ve **hiçbir yabancı çerçeveyi kabul etmiyor**;
`CrcCalculatorTool.test.tsx`in 34 sayısı **değişmemiş**; birim + e2e + build yeşil;
`distributed-uav-networks` ailesinde `planned` kayıt 3'ten 2'ye düşüyor.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → motor → çeviri → test →
e2e; biri bitmeden diğerine geçme.
