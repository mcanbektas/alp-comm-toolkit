# BRİF — Faz 10 dalga 14e, `flexray` (uygulamaya hazır)

## Bu dosyanın rolü

Ana brifin **bulgu 7**'sini ve **açık soru 4**'ünü kapatır. Dalga 14'ün en yüksek
görünmez-değişmez riskli kaydı: **iki CRC'si de katalogda YOK ve biri bayt hizasız.**

Bağımsız — 14a-14d'ye bağımlı değil, ama `protocol-core/checksums` yüzeyine dokunacağı
için erken koşulmaması iyi olur (kararın bedeli sonraki alt dalgalara yayılmasın).

## Girdi sözleşmesi

**Girdi tek bir FlexRay çerçevesidir** (Header + Payload + Trailer), kanal
yakalamasının tamamı değil.

Spec `:140` çerçeve ağacını veriyor:
`Header (Indicators, Frame ID, Payload Length, Header CRC, Cycle Count) → Payload →
Trailer (Frame CRC)`.

**Communication cycle (Static/Dynamic/Symbol Window/Network Idle Time) tek çerçevede
GÖRÜNMEZ** — spec `:132` bunu bir zaman çizelgesi görünümü olarak istiyor.
Slot/cycle korelasyonu, missing static frame, slot violation, cycle timing error
(`:142`) **analyzer işidir**, tek çerçeve çözümünün değil. Emsal iki kez kurulu ve
ikisinde de kayıt `ready` kapandı (12c DNS Transaction Matching, 12d PTP δ/θ).

Cycle Count ve Frame ID çerçevenin İÇİNDEDİR ve çözülür — desen filtreleme (`:138`)
onların üstünde koşacak ileriki iştir.

**Channel A/B çerçevenin içinde DEĞİLDİR** (yakalama metadata'sı). `decodeOptions`
açmadan ÖNCE `RawFrame.channel` alanı denenir — `types.ts:29` bu alanı zaten taşıyor
ve `ParseContext.channel` (`:127`) parser'a geçiriyor. Kanal açmak son çare.

## BULGU 7 — iki CRC de katalogda YOK

Bu, alt dalganın ilk adımıdır ve **kod yazmadan önce karara bağlanmalıdır.**

### Ne var, ne yok

`CRC_ALGORITHM_IDS` (`protocol-core/checksums/crcCatalogue.ts:13-37`) 24 giriş taşıyor.

- İçinde **`CRC24` VAR ama o OpenPGP'dir** — poly `0x864CFB`. `crcCatalogue.ts:221-226`
  bunu açıkça yazıyor ve dalga 3'te bir görev tarifinin *"farklı polinom"* iddiasının
  YANLIŞ olduğunu düzeltiyor. FlexRay'in frame CRC'si bu değildir.
- **`CRC24_Q` de FlexRay değildir** (`:230`, init `0x000000`).
- **`CRC11` diye bir giriş HİÇ YOK.** FlexRay header CRC'si 11 bittir.

### Bayt hizası sorunu

`crc(bytes: Uint8Array, params)` (`crcEngine.ts:80`) **bayt bayt döner**
(`for (const byte of bytes)`, `:87`). 8'in katı olmayan girdi alamaz.

FlexRay header CRC'si başlığın **tam 20 biti** üzerinden hesaplanır (gösterge bitleri +
Frame ID + Payload Length). Bu 2.5 bayttır — mevcut motorla DOĞRUDAN hesaplanamaz.

### Açık soru 4'ün iki cevabı

**(a) `crcEngine.ts`e bit-uzunluğu alan bir kardeş fonksiyon ekle.**
`crcBits(bytes, bitLength, params)` — son kısmi baytın yalnız üst `bitLength % 8`
bitini işler. `types.ts`e DOKUNMAZ, `protocol-core` yüzeyine additive ekleme yapar.
Emsal: `berReader.ts` 12e'de İKİ kardeşle büyümüştü (`decodeBerObjectIdentifier`,
`decodeBerUnsignedInteger`) ve dalga 12'nin dersi buydu — *"paylaşım gerçekse ayrı
modül değil, var olan dosyaya kardeş eklenir."*

**(b) 20 biti `bitCursor` ile paketleyip belgelenmiş bir dolgu kuralıyla besle.**
`readBits`/`writeBits` (`decoding/bitCursor.ts:48,112`) hazır ve sekiz protokol
tüketiyor. Ama **dolgu kuralı yanlışsa CRC sessizce yanlış çıkar** ve küçük
örneklerde doğru görünebilir — 12f'in "chunk boyutu onaltılık, ondalık okumak küçük
örneklerde doğru çalıştığı için geç fark edilir" tuzağının aynı sınıfı.

**Öneri: (a).** Bit uzunluğu CRC tanımının parçasıdır, çağıranın uyduracağı bir dolgu
kuralı değil. Kararı uygulayan model verir ve **gerekçesini `crcEngine.ts` dosya başına
yazar.**

### Katalog eklemeleri

`CRC_ALGORITHM_IDS`e **iki yeni giriş**: FlexRay header CRC-11 ve FlexRay frame CRC-24.
Parametreleri (poly / init / refin / refout / xorout) **iki bağımsız kaynakla çapraz
doğrulanır** ve `crcEngine.test.ts`in `check` değeri deseniyle sınanır
(`crcEngine.test.ts:20`de `CRC8_SAE_J1850: 0x4bn` böyle duruyor).

**Kaynaklar örtüşmezse giriş EKLENMEZ** ve CRC "yalnız GÖSTERİLİR, doğrulanmaz"
sınıfına düşer — dalga 13 dersi 3'ün ayrımı: AS-i parity + PROFIBUS FCS + IO-Link
CKT/CKS + HART checksum GERÇEKTEN doğrulanır; Sercos CRC32 ve CC-Link IE HEC yalnız
GÖSTERİLİR (algoritma parametreleri kamuya açık değil). Bu ayrım **kullanıcıya
görünür** olmalı.

## Kaynak durumu — DOĞRULAMA ZORUNLU

Spec `:126-144` şunları **VERİYOR**: ISO 17458 ailesi, 10 Mbit/s'ye kadar, topolojiler,
çevrim segmentleri, **alan ADLARI** (Frame ID, Cycle Count, Payload Length, Header CRC,
Frame CRC, Channel A/B), çerçeve ağacının SIRASI, hata sınıfları.

**VERMİYOR**: hiçbir alanın bit genişliğini, CRC polinomlarını, payload uzunluğunun
biriminin bayt mı sözcük mü olduğunu, gösterge bitlerinin sırasını.

ISO 17458 **ücretlidir ve depoda YOKTUR**. FlexRay Consortium 2009'da dağıldı; spec'in
eski sürümleri bazı kamuya açık arşivlerde bulunabiliyor. **Alt dalganın ilk adımı
kaynak bulunabilirliğini sınamaktır** — dalga 13 mimari bulgu 1'in kuralı:
*"her alt dalganın ilk adımı 'bu protokol için yeterli halka açık wire-format kaynağı
var mı' sorgusu olmalı. Spec özeti tek başına yetmiyor."*

**Özellikle doğrulanacak dört şey:**

1. **Payload Length'in birimi.** Bayt mı, 2 baytlık sözcük mü? Yanlış okumak payload
   sınırını iki kat kaydırır ve Frame CRC'yi her çerçevede yanlış çıkarır.
2. **Header CRC'nin kapsadığı BİTLER.** Hangi gösterge bitleri dahil, hangileri değil.
3. **Frame CRC'nin başlangıç değerinin kanala göre değişip değişmediği.** (Kanal A ve
   B için farklı init kullanıldığı iddiası var — doğrulanmazsa tek init kullanılır ve
   uyarılır.)
4. **Gösterge bitlerinin sırası ve sayısı.**

**İki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır + uyarılır.**
Dalga 13 dersi 5: uydurma kaynak gerçek bir tehlike, üç iddia reddedildi.

## `bitCursor` — bu kaydın kaçınılmaz aracı

Header'ın alanları bayt sınırına oturmuyor (11 bit Frame ID + 7 bit Payload Length +
11 bit Header CRC + 6 bit Cycle Count + gösterge bitleri). `readBitsAsNumber`
(`bitCursor.ts:85`) tam bu iş için var ve sekiz protokol tüketiyor (rtp, rtcp, coap,
rtcm, lorawan, zigbee, ble, opcUaBinary).

**`BitOrder` seçimi doğrulanmalı** (`bitCursor.ts:26`: `'msb-first' | 'lsb-first'`).
Yanlış seçim `1.3.6.1…`de doğru çalışıp `2.x`te patlayan OID hatasının (12e) aynı
sınıfıdır: küçük Frame ID'lerde doğru görünüp büyüklerde bozulur.

**`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:34-36`, kilitli
sözleşme): bit alanları için **kapsayan bayt aralığı** verilir ve bit ayrıntısı
**alan ADINDA** taşınır. `rtp.ts`/`rtcp.ts` bunu zaten böyle yapıyor — emsal orada.

## FlexRay PHY kaydı ZATEN VAR — çapraz bağlantı kur

`interfaces-framing/vehicle-field-physical-layers/flexray-phy`
(`interfaces-framing.ts:735`) `partial` + `calculatorIds: ['flexray-phy-timing']` ile
duruyor ve `related`i zaten `automotive/vehicle-network-protocols/flexray`e bakıyor
(`:743`). Motor `vehiclePhy.ts:192` `calculateFlexrayChannels`.

**Bu kayıt çift kanal/topoloji hesabını ZATEN karşılıyor.** `flexray` kaydı
`calculatorIds` ALMAZ (decode'u var, hesap kaydı ayrı), ama `related`ine
`interfaces-framing/vehicle-field-physical-layers/flexray-phy` **EKLENİR** — bağlantı
şu an tek yönlü.

## `decodeOptions`

**Önce AÇMA.** Channel A/B için `RawFrame.channel` denenir (yukarı bak). Payload
Length'in birimi doğrulanırsa kanal gerekmez.

Kanal açılması gereken tek olası durum: **kaynak doğrulaması Frame CRC init'inin
kanala göre değiştiğini kanıtlarsa** — o zaman `channel: 'a' | 'b'` bir `select`
kanalı olur, çünkü CRC doğrulaması buna bağlıdır ve `RawFrame.channel` serbest
string'dir. Bu karar kaynak turundan SONRA verilir, önce değil.

## Uygulama görevleri

1. **Kaynak turu** (kod yazmadan): dört doğrulama maddesi + CRC parametreleri.
   Bulunamazsa kapsam daraltma kararı — bkz. aşağı.
2. `protocol-core/checksums/crcEngine.ts` — açık soru 4 kararı (öneri: `crcBits`
   kardeşi), dosya başına gerekçe.
3. `protocol-core/checksums/crcCatalogue.ts` — iki yeni giriş + `crcEngine.test.ts`e
   `check` değerleri.
4. `src/protocols/automotive/flexray/flexray.ts` + test — `bitCursor` ile başlık,
   payload sınırı, iki CRC, hata/uyarı ayrımı.
5. `src/protocols/index.ts` — `registerOnce(registry, 'flexray', …)` + yorum.
6. `automotive.ts:299` — `status`, `pluginId: 'flexray'`, `related`e `flexray-phy`.
7. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
8. `e2e/flexray-decode.spec.ts` — kanıtlanacaklar: başlık alanları görünüyor,
   Header CRC ve Frame CRC AYRI satırlar ve **doğrulanma durumları ayrı gösteriliyor**,
   bozuk CRC'li fixture `decode-parse-error` DEĞİL alan seviyesinde hata basıyor.

### Kaynak yetersizse

**Kaynaksız kayıt politikası (2026-08-23 kullanıcı kararı) SORMADAN uygulanır:**
`planned` bırakılmaz, **`partial` yazılır** — iki bağımsız kaynakta teyitli olan
çözülür (çerçeve sınırları, alan sırası, Cycle Count), geri kalan HAM + uyarı kalır,
özet metni neyin çözülüp neyin çözülmediğini AÇIKÇA yazar. Presedan: `iec-61850`
GOOSE-only, `cc-link-ie` 0x890F-only.

## Devralınan tuzaklar

- **`crc()`ye 2.5 baytlık veri verme.** Bayt bayt döner, sessizce yanlış sonuç verir.
- **CRC "gösterilir" ile "doğrulanır" ayrımı kullanıcıya görünür olmalı** (dalga 13
  dersi 3).
- **`ParsedField.offset` BAYT cinsindendir**, bit değil (kilitli sözleşme).
- **`ParsedField.id` KENDİ offset'ini kullanır** — `bitCursor` ile çalışırken bit
  konumunu bayt offset'ine çevirirken bu kolayca kaçar (`ftp.ts`/`rtcp.ts` vakaları).
- **`ParsedFrame` DÜZ, `children` YOK.** Spec'in "Frame ağacı" isteği alan ADLARIYLA
  karşılanır (`Header Frame ID`, `Trailer Frame CRC`) — 12g'nin RTCP çözümü.
- **DecodePanel tuzakları** — 14c brifindeki liste aynen geçerli.

## Model/effort önerisi

**Opus · high.** Gerekçe: bayt hizasız CRC bir `protocol-core` yüzey kararı gerektiriyor
(açık soru 4), iki katalog girişi kaynak doğrulamasına bağlı, bit düzeyinde başlık
`BitOrder` seçimi taşıyor ve dört ayrı doğrulama noktasının her biri sessiz yanlış
çözüm üretebilir. Dalganın görünmez değişmez riski en yüksek kaydı.

**Tamamlanma ölçütü:** `flexray` rozetiyle açılıyor, iki CRC ayrı ayrı raporlanıyor,
`crcCatalogue` eklemeleri `check` değeriyle test edilmiş, `flexray-phy` ile çift yönlü
bağlantı kurulmuş, birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): kaynak turu → CRC kararı → motor → çeviri →
test → e2e, biri bitmeden diğerine geçme.
