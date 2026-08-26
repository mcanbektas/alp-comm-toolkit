# BRİF — Faz 10 dalga 16a, `hdlc-based-marine` + **iki fixture mayını** (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga16.md`i**, sonra bu dosyayı okur.

Bu alt dalga **hiçbir aileyi kapatmaz** (`legacy-proprietary-marine`in ikinci
kaydı `seatalk` 16b'de kapanır) ama **dalganın ilk işi olmak ZORUNDADIR**:
16b ve 16c'nin patlatacağı iki sabit fixture burada, henüz hiçbir motor
yazılmadan sökülür.

**SIRA ZORUNLU: önce Görev 0 (fixture), sonra motor.** Görev 0 tek başına
yeşil bırakılabilir bir iştir ve öyle bırakılmalıdır.

---

## GÖREV 0 — iki zamanlanmış mayın (motordan ÖNCE)

Dalga 15b'de tam bu sınıf bir tuzak yaşandı ve **iki alt dalga boyunca fark
edilmedi**. Yapısal olarak ödendi; o düzeltme burada iki dosyaya daha uygulanır.

### Emsal kod — `e2e/modbus-decode.spec.ts`, dosya başı `[KANIT]`

Dosya başı gerekçeyi yazıyor:
> *"Bu bekçinin bir tarihi var, ve ders yapısal: hedef iki kez motor aldı
> (`can-2-0a` dalga 3'te, `psi5` dalga 14h'de) ve ikincisinde test iki alt dalga
> boyunca sessizce kırmızı kaldı, çünkü dalgalar yalnız kendi yeni spec'ini
> koşturuyordu. Hedef artık KATALOGDAN TÜRETİLİYOR: motoru olmayan, alias
> olmayan, `decode` sekmesi olan ilk `planned` kayıt. Bir sonraki dalga o kaydı
> da bağlarsa bekçi kendiliğinden bir sonrakine geçer; hiç `planned` kayıt
> kalmazsa test AÇIKÇA atlanır, sessizce yeşil kalmaz."*

```ts
import { allEntries } from '../src/app/catalog';

const plannedEntry = allEntries().find(
  (entry) =>
    entry.protocol.status === 'planned' &&
    entry.protocol.aliasOf === undefined &&
    entry.protocol.pluginId === undefined &&
    entry.protocol.tabs.includes('decode'),
);
const PLANNED_DECODE_PATH =
  plannedEntry === undefined ? undefined : `/comm/${plannedEntry.path}?tab=decode`;
```
ve `:304`:
```ts
test.skip(
  PLANNED_DECODE_PATH === undefined,
  'katalogda motorsuz `planned` kayıt kalmadı — bekçinin koruduğu durum artık yok',
);
```

**Dört süzgecin hepsi gerekli** ve her biri ayrı bir hatayı önlüyor:
`status === 'planned'` (kaydın kendisi planlı) · `aliasOf === undefined`
(alias'ın ham `status`u kalıcı `planned`dır, `resolveStatus()` `ready` çözer —
alias seçilirse test yanlış sayfayı sınar) · `pluginId === undefined`
(katalogda `pluginId` var ama motor bağlıysa "planlandı" basmaz) ·
`tabs.includes('decode')` (sekme yoksa sayfa açılmaz).

### Mayın M1 — `src/pages/ProtocolPage.test.tsx:36`

**Şu an:**
```ts
const PLANNED_PATH = 'marine-navigation/legacy-proprietary-marine/seatalk';
```
`:74-82`teki test bunu kullanıyor:
```ts
it('keeps the planned notice and the placeholder frame when no plugin is bound', () => {
  renderAt(`/${PLANNED_PATH}?tab=decode`);
  expect(screen.getByText(translations.tr['protocol.plannedNotice'])).toBeInTheDocument();
  expect(screen.getByTestId('byte-viewer')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
  expect(screen.queryByTestId('decode-panel')).not.toBeInTheDocument();
});
```

**16b'de `seatalk` motora bağlanınca bu test KIRILIR.**

Yorum geçmişi mayının kaç kez elle taşındığını gösteriyor (`:24-35`):
`uart` → `microwire` → `flexray` → `seatalk`. **Beşinci taşıma yapılmaz.**

**Yapılacak:**
```ts
import { allEntries } from '@/app/catalog';

/**
 * Motoru OLMAYAN kayıt KATALOGDAN TÜRETİLİR — elle taşınmaz.
 * Bu fixture dört kez elle taşındı (uart → microwire → flexray → seatalk) ve her
 * seferinde bir sonraki dalga onu da bağladı. `e2e/modbus-decode.spec.ts`in
 * (dalga 15b) yapısal çözümünün aynısı: motoru olmayan, alias olmayan,
 * `decode` sekmesi olan ilk `planned` kayıt. Hiç kalmazsa test AÇIKÇA atlanır,
 * sessizce yeşil kalmaz.
 */
const plannedEntry = allEntries().find(
  (entry) =>
    entry.protocol.status === 'planned' &&
    entry.protocol.aliasOf === undefined &&
    entry.protocol.pluginId === undefined &&
    entry.protocol.tabs.includes('decode'),
);
const PLANNED_PATH = plannedEntry?.path;
```
ve test `it.skipIf(...)` olur (vitest 4, `package.json:37`):
```ts
it.skipIf(PLANNED_PATH === undefined)(
  'keeps the planned notice and the placeholder frame when no plugin is bound',
  () => {
    renderAt(`/${PLANNED_PATH as string}?tab=decode`);
    …
  },
);
```

**TUZAK — yol biçimi FARKLI.** `modbus-decode.spec.ts` `/comm/${path}` kullanıyor
(Playwright gerçek router'da koşuyor); `ProtocolPage.test.tsx` **`/comm` öneki
KULLANMAZ** çünkü `MemoryRouter` rotası `:domainId/:familyId/:protocolId`
(`:41-46`). `CatalogEntry.path` zaten `domain/family/protocol` biçimindedir.
Öneki kopyalarsan test sessizce 404 render eder.

**`AA 05 10 03 34 12 7F 4F 55` iddiası KALIR** — o bayt dizisi kayda özgü
DEĞİL, `ProtocolPage.tsx:119`daki `SAMPLE_FRAME_BYTES` sabitidir (spec §43'ün
custom binary fixture'ı, `:112`de gerekçesi yazılı). Hangi `planned` kayıt
seçilirse seçilsin aynı baytlar basılır.

### Mayın M2 — `e2e/nmea-decode.spec.ts:35`

**Şu an:**
```ts
const PLANNED_DECODE_PATH = '/comm/marine-navigation/nmea-family/iec-61162?tab=decode';
```
`:262-269`teki test:
```ts
test('aynı ailedeki eklentisi olmayan protokol hâlâ "planlandı" bildirimi basıyor', async ({ page }) => {
  await openPage(page, PLANNED_DECODE_PATH);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toHaveCount(0);
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);
  await expect(page.getByTestId('byte-viewer')).toBeVisible();
});
```

**16c'de `iec-61162` motora bağlanınca bu test KIRILIR.**

Bu mayın da bir kez taşınmış (`:28-34`): `nmea-2000` → `iec-61162`, ve yorum
*"plan-fazlar.md'deki hiçbir dalga listesinde geçmiyor"* diyor — o gerekçe
artık geçersiz.

**Ek zorluk:** testin adı ve gerekçesi *"AYNI AİLEDEKİ"* diyor. 16c bittiğinde
`nmea-family`de `planned` kayıt SIFIRDIR — aynı-aile kısıtı sağlanamaz hâle
gelir.

**Yapılacak** — kısıt gevşetilir, öncelik korunur:
```ts
import { allEntries } from '../src/app/catalog';

/**
 * Regresyon bekçisi: motoru olmayan bir protokol sayfası, komşusunun motoru
 * bağlandıktan sonra da "planlandı" basmalı.
 *
 * Hedef KATALOGDAN TÜRETİLİR (dalga 15b'nin `modbus-decode.spec.ts`teki yapısal
 * çözümü). Bu bekçi bir kez elle taşındı (`nmea-2000` → `iec-61162`) ve
 * ikincisi de dalga 16c'de motor aldı. Aynı AİLEDE aday kalmayabileceği için
 * seçim şu sırayla daralır: önce aynı domain, sonra katalog geneli. Hiç aday
 * yoksa test AÇIKÇA atlanır, sessizce yeşil kalmaz.
 */
const isEngineless = (entry: { protocol: { status: string; aliasOf?: string; pluginId?: string; tabs: readonly string[] } }) =>
  entry.protocol.status === 'planned' &&
  entry.protocol.aliasOf === undefined &&
  entry.protocol.pluginId === undefined &&
  entry.protocol.tabs.includes('decode');

const entries = allEntries();
const plannedEntry =
  entries.find((e) => e.domain.id === 'marine-navigation' && isEngineless(e)) ??
  entries.find(isEngineless);
const PLANNED_DECODE_PATH =
  plannedEntry === undefined ? undefined : `/comm/${plannedEntry.path}?tab=decode`;
```
ve testin başına `test.skip(PLANNED_DECODE_PATH === undefined, '…')`.
Test adındaki *"aynı ailedeki"* ifadesi *"motorsuz"* olarak düzeltilir.

**`allEntries()` bir `CatalogEntry` döndürür ve `.domain.id` taşır** `[KANIT]`
`FamilyPage.test.tsx:66-69` bunu kullanıyor (`candidate.domain.id === domainId`).

### Görev 0'ın tamamlanma ölçütü

`npm test` ve **`ProtocolPage.test.tsx` + `nmea-decode.spec.ts` yeşil**,
**hiçbir motor yazılmadan.** Bu noktada `PLANNED_PATH` `iec-61162`yi ya da
`seatalk`i seçiyor olacak (katalog sırası hangisini önce veriyorsa) — ikisi de
hâlâ `planned`, yani davranış değişmiyor. **Görev 0 ayrı commit'lenebilir.**

### Taranan ve mayın OLMADIĞI doğrulanan yerler

Ana brif §"Mayın OLMADIĞI doğrulanan yerler"deki listeye bak. **Yeniden tarama
yapma** — `e2e/{dbc,eds}-definitions`, `e2e/{xcp-on-can,xcp-on-ethernet,arinc-429}-decode`,
`e2e/{ais,nmea2000,rtcm,ubx,j1939}-decode`, `src/pages/FamilyPage.test.tsx`,
`src/protocols/pluginBinding.test.ts`, `src/tests/catalog.test.ts` hepsi
denetlendi ve temiz.

**`CrcCalculatorTool.test.tsx`e DOKUNMA.** Bu dalga CRC eklemiyor, sayı **37**
kalır (gerçek satır `:81`).

---

## `hdlc-based-marine`

### Girdi sözleşmesi

**Bit-destuff edilmiş MANTIKSAL çerçeve** — `7E … 7E` arasındaki bayt-hizalı
diziden ibaret. Bu, `hdlc.ts`/`sdlc.ts` ile **BİREBİR AYNI** girdi sözleşmesidir
ve gerekçesi zaten `hdlcCore.ts:5-20`de yazılı `[KANIT]`:

> *"gerçek bit-senkron HDLC'nin bit-stuffing'i (`bitStuffing.ts`) canlı bir bayt
> akışından bit-hizasız çerçeve çıkarmıyor… Decode sekmesinin girdisi (hex
> yapıştırma, TEK çerçeve) spec'in kendi ayrımıyla
> (`02-framing-protokolleri.md` satır 163-164) zaten 'Logical Frame':
> bit-stuffing gerçek donanımda/sürücüde temizlenir… Bu YÜZDEN
> `hdlcFlagExtractor` burada YANLIŞ araç: o `0x7D`'yi kaçış baytı sayıp XOR
> çözer, ama gerçek bit-senkron veride `0x7D` sıradan bir veri baytıdır."*

Spec'in kendi örnek yakalaması (`05-denizcilik.md:270`), birebir:
> *"Unknown marine HDLC protocol örneği: capture `7E 12 03 18 04 20 10 33 88 XX
> XX 7E` → Flag Valid, Address `0x12` candidate, Control `0x03` candidate,
> Payload `18 04 20 10 33 88`, FCS candidate CRC-16 (conservative
> interpretation)."*

**Bu örnek doğrudan bir `exampleFrame` olarak kullanılır** — `XX XX`ler
motorun kendi `CRC16_X25` hesabıyla doldurulur (`hdlcCore.ts:43-48`in fixture
disiplini: *"bu dalganın kendi örnek/test çerçeveleri motorun KENDİSİYLE
(`computeNamedCrc`) hesaplanır… bu dosyanın test ettiği şey BAYT SINIRLARI,
CRC algoritmasının kendisi değil"*).

### Neden `hdlcCore.ts` PAYLAŞILIR — `xcpPacket.ts` sınıfı `[KANIT]`

Depo iki sınıf ayırt ediyor:
- **`xcpPacket.ts`/`dnsWire.ts` sınıfı:** iki kayıt aynı teli okuyor, çekirdek
  gerçekten ortak → **PAYLAŞ**.
- **`ccp.ts` sınıfı:** iki kayıt benzer GÖRÜNÜYOR, çekirdek ortak DEĞİL →
  ayrı tut (14c: *"ortak bir komut tablosu, iki protokolün ayrıştığı her kodu
  sessizce yanlış çözer"*).

**Burası birincisidir ve kanıt üç yerde:**

1. `hdlcCore.ts:2-3` kendini **PAYLAŞILAN ÇEKİRDEK** ilan ediyor ve şablonu
   tarif ediyor: *"`hdlc.ts`/`sdlc.ts` bunun üstüne ince, protokole özgü
   sarmal."*
2. **İki tüketicisi zaten var:** `hdlc.ts:2`, `sdlc.ts:2`. `qspiCore.ts:4` bu
   deseni emsal gösteriyor.
3. `sdlc.ts:2-10` bir **ÜÇÜNCÜ tüketicinin nasıl yazılacağını** birebir
   gösteriyor: *"Çerçeve şekli HDLC ile BİREBİR AYNI (Flag/Address/Control/
   Information/FCS)… Bu yüzden `hdlc.ts` ile aynı çekirdeği paylaşıyor, yalnız
   Address alanının adı/yorumu 'Station Address' olarak değişiyor."*

**`hdlcBasedMarine.ts` ÜÇÜNCÜ tüketicidir.** Değişen: her alan
**"candidate"** olarak adlanır ve vendor şeması yüklenmeden kesin ad
ÜRETİLMEZ.

**KOPYALAMA YOK.** `sdlc.ts`in importunu birebir izle (`sdlc.ts:30-38`):
```ts
import {
  byteAt, decodeControlByte, encodeHdlcSyncFrame, hdlcSyncExtractor,
  hexByte, hexString, hexWord, validateHdlcFcs,
} from '../../serial/framing/hdlcCore';
import { mapFramingError } from '../../serial/framing/framingErrorMapping';
```

### FCS — katalog eklemesi YOK, ama `residue` YENİ bir yetenek

`validateHdlcFcs` (`hdlcCore.ts:133-137`) şunu yapıyor:
```ts
const received = byteAt(fcsBytes, 0) | (byteAt(fcsBytes, 1) << 8);
const calculated = Number(computeNamedCrc(coveredBytes, 'CRC16_X25'));
return { received, calculated, valid: received === calculated };
```
**Bu yeterlidir ve varsayılan yoldur.** `CRC16_X25` katalogda
(`crcCatalogue.ts:159`), `check = 0x906E` fixture'lı (`crcEngine.test.ts:36`).

Dış doğrulama, reveng kataloğu birebir
(https://reveng.sourceforge.io/crc-catalogue/16.htm):
```
width=16 poly=0x1021 init=0xffff refin=true refout=true xorout=0xffff
check=0x906e residue=0xf0b8 name="CRC-16/IBM-SDLC"
Alias: CRC-16/ISO-HDLC, CRC-16/ISO-IEC-14443-3-B, CRC-16/X-25, CRC-B, X-25
HDLC is defined in ISO/IEC 13239.
```

#### TUZAK 1 — SAHTE DOSTLAR: aynı polinom, başka model

Katalogda poly `0x1021` olan **ÜÇ** giriş var ve **yalnız biri** HDLC'dir:

| Giriş | satır | poly | init | xorout | check | HDLC mi? |
|---|---|---|---|---|---|---|
| `CRC16_CCITT_FALSE` | `:143` | `0x1021` | `0xffff` | `0x0000` | `0x29b1` | **HAYIR** |
| `CRC16_XMODEM` | `:151` | `0x1021` | `0x0000` | `0x0000` | `0x31c3` | **HAYIR** |
| **`CRC16_X25`** | **`:159`** | `0x1021` | `0xffff` | `0xffff` | `0x906e` | **EVET** |
| `CRC16_KERMIT` | `:207` | `0x1021` | `0x0000` | `0x0000` | `0x2189` | **HAYIR** |

*"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR"* (dalga 13 dersi 2) —
burada kural **aynı polinom** biçiminde. Dördü de hata VERMEDEN yanlış sonuç
üretir. **`CRC16_X25` DIŞINDA hiçbiri kullanılmaz.**

#### TUZAK 2 — `0xF0B8` residue'sü bir CHECK DEĞİLDİR

Bu, alt dalganın en incelikli sayısal noktasıdır ve **karıştırılması kolaydır.**

RFC 1662 Appendix C.2, birebir (https://www.rfc-editor.org/rfc/rfc1662):
```c
#define PPPINITFCS16    0xffff  /* Initial FCS value */
#define PPPGOODFCS16    0xf0b8  /* Good final FCS value */
```
reveng legend'ın tanımı (https://reveng.sourceforge.io/crc-catalogue/legend.htm),
birebir:
> **check** = *"…reading the UTF-8 string '123456789'… and **applying the final
> XOR**."*
> **residue** = *"…reading an **error-free codeword**… **but not applying the
> final XOR**."*

Yani `0xF0B8` = "FCS DAHİL tüm çerçeve üzerinde, son XOR UYGULANMADAN kalan
kayıt değeri". Üç ayrı sayı ve üçü de karıştırılabilir:

| Sayı | Ne | Nerede kullanılır |
|---|---|---|
| `0x906E` | **check** — `"123456789"` üzerinde | `crcEngine.test.ts:36`, motor doğrulaması |
| `0xF0B8` | **residue** (yansıtılmış) | FCS-dahil doğrulama |
| `0x1D0F` | aynı residue, **yansıtılmamış** konvansiyonda (`bitrev16(0xF0B8)`) | `CRC16_GENIBUS`, BURADA DEĞİL |
| `0x0F47` | residue'ye yanlışlıkla xorout uygulanmış hâli | **HİÇBİR YERDE — hatadır** |

**Uygulama kuralı:** `validateHdlcFcs` **hesapla-ve-karşılaştır** yolunu
kullanıyor ve o yol DOĞRUDUR; residue yolu bir **ALTERNATİF doğrulamadır**,
zorunlu değildir. Eğer residue kontrolü de eklenirse `crc()`
(`crcEngine.ts:106`) `xorout` uyguladığı için **doğrudan `0xF0B8` çıkmaz** —
`0x0F47` çıkar. **Bu yüzden residue yolunu EKLEME.** Var olan
`validateHdlcFcs` kullanılır; residue yalnız dosya başı yorumunda **niçin
kullanılmadığı** anlatılarak anılır.

`[KANIT — dış, bağımsız hesaplandı]` X.25 Appendix I (s.145) dört örnek
çerçevesi bit-unstuff + LSB-first çözülünce reveng'in kod sözcükleriyle birebir
çıkıyor: `033F5BEC`, `01738357`, `013FEBDF`, `03733364`; dördünün de residue'sü
`0xF0B8`. Tek test aynı anda CRC parametrelerini, LSB-first bit sırasını,
FCS'in düşük-oktet-önce taşınmasını ve LAPB adreslerini (A=0x03, B=0x01)
doğruluyor.

#### FCS tel sırası

`hdlcCore.ts:132` zaten yazıyor: *"tel sırası little-endian
(`bacnetmstp.ts:358` emsali)"*. Dış kaynak doğruluyor — RFC 1662 §3.1, birebir:
> *"The FCS is transmitted **least significant octet first**, which contains the
> coefficient of the highest term."*

**Ama vendor çerçeveleri sapabilir** → `fcsByteOrder` seçeneği (aşağıda).

### Control field — `decodeControlByte` VAR ama VARSAYILAN OLARAK KULLANILMAZ

`hdlcCore.ts:113-124` modulo-8 I/S/U çözümünü veriyor ve `:22-30` gerekçesini
yazıyor (ISO 13239 / ITU-T Q.921 temel profili).

**Wireshark sabitleriyle bağımsız doğrulandı** `[KANIT]`
`epan/dissectors/packet-xdlc.h` (commit `9f54bc5`):
`XDLC_I_MASK 0x01` (`:25`) · `XDLC_S_U_MASK 0x03`, `XDLC_S 0x01`, `XDLC_U 0x03`
(`:27-29`) · `XDLC_N_R_MASK 0xE0`»5, `XDLC_N_S_MASK 0x0E`»1 (`:34-41`) ·
`XDLC_P_F 0x10` (`:46`) · `XDLC_S_FTYPE_MASK 0x0C`, RR `0x00` RNR `0x04`
REJ `0x08` SREJ `0x0C` (`:52-56`). **`hdlcCore.ts`in çözümü bunlarla birebir
örtüşüyor** — bağımsız ikinci kaynak sağlandı, kod değişmeyecek.

`:99` genişletilmiş mod kuralını da veriyor:
```c
XDLC_CONTROL_LEN(control,is_extended) ((((control)&XDLC_S_U_MASK)==XDLC_U || !(is_extended)) ? 1 : 2)
```
→ **modulo-128'de control 2 bayttır AMA U-frame'ler 1 bayt kalır.**
`controlFieldBytes: 2` seçildiğinde bu istisna UYGULANIR.

#### KARAR 16a-1 — bu kayıtta control field VARSAYILAN OLARAK "candidate" kalır

Katalog bunu şart koşuyor `[KANIT]` `marine-navigation.ts:486-487`:
> *"Şema yüklenmeden alan adı ÜRETİLMEZ — yanlış kesinlik bu bölümde en büyük
> risk; her alan 'candidate' olarak işaretli kalır."*

ve summary (`:467-468`): *"read conservatively as flag/address/control/
information/FCS **candidates** until a vendor schema names the fields."*

Spec de aynısını söylüyor (`05-denizcilik.md:264`): *"Toolkit exact vendor
protokolü bilmeden HDLC frame'i **yanlış isimlendirmemeli**."* ve `:377`
"Dikkat çekenler"de: *"HDLC bölümü kasıtlı olarak muhafazakâr."*

**Karar:** `controlFieldProfile` seçeneği:
- **`raw-candidate` (VARSAYILAN):** control baytı `Control (candidate)` adıyla
  HAM basılır, I/S/U çözümü YAPILMAZ, `controlFieldNotInterpreted` uyarısı.
- **`iso-13239-modulo8`:** `decodeControlByte` çağrılır, alanlar
  `Control · Frame Format`, `Control · N(S)`, `Control · N(R)`,
  `Control · P/F`, `Control · S-Type` olarak basılır.

Bu, **`hdlc.ts`ten farkın TAMAMIDIR** ve dosya başında böyle yazılır.
`mode-s`in "DF'e göre CRC alanını hiç basmama" kararının (15h) aynı biçimi:
**doğrulanamayan bir yorumu varsayılan yapmamak.**

### AIS — denizcilikte HDLC'nin BULUNAN TEK sağlam örneği `[KANIT]`

Kaynak turu denizcilikte HDLC arayışını kapsamlı yaptı ve tek somut bağ
**AIS'in VDL katmanı** çıktı. ITU-R M.1371-6 (02/2026), Annex 2 §A2-3.2.2,
birebir
(https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1371-6-202602-I!!PDF-E.pdf):
> *"Data transfer should use a bit-oriented protocol which is based on the
> high-level data link control (HDLC) as specified by **ISO/IEC 13239:2002**…
> **Information packets (I-Packets) should be used with the exception that the
> control field is omitted**"*

Tablo 12 — tam slot (256 bit, 26.67 ms):
`Ramp up 8 | Training 24 | Start flag 8 (7Eh) | Data 168 | CRC 16 | End flag 8 | Buffer 24`

§A2-3.2.2.6: *"**Only the data portion should be included in the CRC
calculation**"* ve CRC bitleri *"pre-set to one (1)"*.
§A2-3.3: *"Each byte should be output with **least significant bit first**"* +
NRZI.

**Bu bulgunun ÜÇ sonucu var:**

1. **`addressFieldBytes: 0` ve `controlFieldBytes: 0` GERÇEK şıklardır** —
   uydurma esneklik değil, belgelenmiş bir denizcilik vakası. Sayfa metni bunu
   örnekle anlatır.
2. **`fcsCoverage: 'information-only'` GERÇEK bir şıktır** — AIS FCS'i yalnız
   168 veri bitini kapsıyor, bayrakları değil.
3. **`ais.ts` MOTORU DEĞİŞMEZ, `related` de EKLENMEZ.** Depodaki `ais.ts`
   girdisi `!AIVDM` **NMEA taşıma cümlesidir**, VDL bit akışı DEĞİL
   (`ais.ts` dosya başı: *"Girdi `!AIVDM`/`!AIVDO` cümle baytlarıdır"*).
   İkisi AYRI katmanlardır ve karıştırılmaları `ccp.ts` sınıfı bir hata olurdu.
   Bağ yalnız **sayfa metninde** anlatılır.

`[BEKLENTİ — uygulamada doğrulanacak]` AIS VDL'inin ham bit akışını bir
`exampleFrame` yapmak CAZİP ama **YAPILMAMALI**: girdi bit-hizasız (168 bit
tam bayt değil, LSB-first oktet + NRZI) ve bu motorun sözleşmesi bayt-hizalı
mantıksal çerçevedir. Sayfa metninde "kapsam dışı" olarak anılır.

### `canParse` — DAİMA `false`, ve bu ÖLÇÜLMÜŞ bir karardır

Doğal imza `n ≥ 5 && b[0] === 0x7E && b[n-1] === 0x7E`tir — **bu, `hdlc.ts`in
ve `sdlc.ts`in imzasının AYNISIDIR.**

**Ölçüldü** (ana brif bulgu 10; 140 kayıt / 870 örnek çerçeve):
```
çakışma: 6 — hepsi kardeş kayıtlar
hdlc/i-frame(8B) · hdlc/s-frame(6B) · hdlc/u-frame(6B)
sdlc/i-frame(8B) · sdlc/poll(6B)    · sdlc/u-frame(6B)
```

**Karar: `canParse(): boolean { return false; }`**

Gerekçe `uavcanCompatibility.ts:27-34`ün emsali ama **sebep farklı** ve dosya
başında böyle yazılır:
> `uavcan-compatibility`de sebep *"bu kaydın kendi tel biçimi YOKTUR"*tı.
> Burada tel biçimi VAR — sorun onun `hdlc`inkiyle **AYIRT EDİLEMEZ** olması.
> `true` dönmek, çalışan iki kaydın (`hdlc`, `sdlc`) çerçevesini otomatik
> algılamada ÇALMAK olurdu; kullanıcı bu sayfayı **açıkça seçer**, çünkü
> sayfanın varlık sebebi zaten *"vendor'ı bilinmeyen çerçeve"*dir.

**Bekçi testi ZORUNLU** (15f/15g/15h'te zorunlu hâle geldi):
`src/protocols/marine/hdlcMarine/hdlcMarineCanParseRegistry.test.ts`,
`uavcanCompatibility.test.ts` emsali. Kanıtlayacağı iki şey:
1. **`hdlc`in ve `sdlc`in KABUL ETTİĞİ çerçevelerde bile `canParse` `false`
   döner** — "hiç çerçeve gelmediği için false dönüyor" yanılgısına yer
   bırakmaz.
2. Kendi `exampleFrames`i üzerinde de `false` döner (kasıt kanıtı).
3. `totalExamples > 800` sağlık kontrolü (`sentSpcCanParseRegistry.test.ts`
   emsali — tarama gerçekten TAM registry üzerinde koştu mu).

### `decodeOptions` — YEDİ kanal

Dalga 15'in dersi (*"`decodeOptions` tablosu SİSTEMATİK olarak AZ tahmin
etti"*) gereği cömert. Her satırın kaynağı var.

| Seçenek | Şıklar | Neden | Kaynak |
|---|---|---|---|
| `fcsProfile` | `crc16-x25` (vars.) · `crc32-iso-hdlc` · `none` | Spec **üç şıkkı da adıyla sayıyor** | `02-framing-protokolleri.md` §HDLC/FCS: *"Profile'a göre değişebileceğinden seçenekler: CRC-16 profile, CRC-32 profile, Custom HDLC FCS"* |
| `fcsByteOrder` | `little-endian` (vars.) · `big-endian` | Standart LSB-önce der, vendor sapar | RFC 1662 §3.1 |
| `addressFieldBytes` | `1` (vars.) · `2` · `0` | Q.921 EA biti 2 bayta çıkarır; **AIS hiç kullanmaz** | Q.921 §3.3.1 · M.1371-6 §A2-3.2.2 |
| `controlFieldBytes` | `1` (vars.) · `2` · `0` | modulo-8/128; **AIS control'ü ATIYOR** | `packet-xdlc.h:99` · M.1371-6 |
| `controlFieldProfile` | `raw-candidate` (vars.) · `iso-13239-modulo8` | **Karar 16a-1** | katalog `:486-487` |
| `escaping` | `none` (vars.) · `rfc1662-octet-stuffed` | Async HDLC `0x7D`+XOR`0x20`, senkron kullanmaz | RFC 1662 §4.2 |
| `fcsCoverage` | `address-control-information` (vars.) · `information-only` | **AIS FCS'i yalnız veriyi kapsıyor** | M.1371-6 §A2-3.2.2.6 |

**TUZAK — `escaping: 'rfc1662-octet-stuffed'` seçilirse `hdlcSyncExtractor`
YANLIŞ araçtır.** O modda `hdlcFlagExtractor`
(`protocol-core/framing/hdlcFraming.ts:33`) doğru araçtır. `hdlcCore.ts:14-18`
bunun tersini (senkron modda `hdlcFlagExtractor` kullanmanın yanlışlığını)
yazıyor; **iki yön de doğru ve seçenek bunu görünür kılıyor.** İki extractor
arasında geçiş `ppp.ts` ile `hdlc.ts` arasındaki farkın ta kendisidir.

`escaping` şıkkı seçildiğinde **koşulsuz** bir `asyncEscapingAssumed` uyarısı
basılır: kaçış çözümü veriyi DEĞİŞTİRİR ve tel offsetleri ile mantıksal
offsetler AYRIŞIR (`delimiterBasedProtocol.ts:59-70`in `wireOffsets` deseni
bunu nasıl raporladığını gösteriyor).

### Beklenen rozet: `ready`

`hdlc` (`interfaces-framing.ts:962`) ve `sdlc` (`:989`) **ikisi de `ready`** ve
aynı sınırları taşıyorlar (bit-stuffing görünümü yok, U-frame komut adları yok).
Bu kayıt aynı zarfı çözüyor, FCS'i gerçekten doğruluyor, kaynak mükemmel.

Ölçüt `plan-fazlar.md`nin 13h notundaki `profibusDp.ts`/`hart.ts` ölçütüdür:
*"envelope'un HER alanı doğrulanıyor, ham kalanlar YAPISAL eksik değil,
şema bağımlı içerik."* **Burada ham kalan şey vendor semantiğidir ve onun
bilinmemesi protokolün KENDİSİDİR** — motorun eksiği değil.

**Karşı argüman ve neden kabul edilmiyor:** "her alan candidate ise hiçbir şey
çözülmemiş demektir." Hayır — çerçeve SINIRLARI, FCS DOĞRULAMASI ve alan
OFSETLERİ kesin çözülüyor; belirsiz olan yalnız alanların ANLAMI ve bu
belirsizlik açıkça raporlanıyor. `mode-s`in DF0/4/5'te ICAO adresini
"çıkarıldı ama doğrulanmadı" diye basması (15h) aynı dürüstlük biçimidir ve
o kayıt da `ready` kapandı.

**Bu bir `[DUR-SOR]`dur** (ana brif açık soru 5) — kod yazmadan önce onaylanır.

---

## Uygulama görevleri

0. **GÖREV 0 — iki fixture mayını** (yukarıda). Motordan ÖNCE, ayrı commit.
   Tamamlanma: `npm test` + `nmea-decode.spec.ts` yeşil, motor yok.
1. **[DUR-SOR] Rozet kararını al** (ana brif açık soru 5). Kararsız kod
   YAZILMAZ.
2. **`src/protocols/marine/hdlcMarine/hdlcBasedMarine.ts`** — `sdlc.ts` şablonu.
   Dosya başı ZORUNLU olarak yazacakları:
   - Neden `hdlcCore.ts` PAYLAŞILIYOR (`xcpPacket.ts` sınıfı) ve `hdlc.ts`ten
     tek farkın ne olduğu (candidate disiplini).
   - Katalogdaki poly `0x1021` olan **dört** girişten neden yalnız
     `CRC16_X25`in seçildiği (sahte dostlar, satır numaralarıyla).
   - `0xF0B8` residue'sünün ne olduğu, `0x906E`/`0x1D0F`/`0x0F47` ile farkı ve
     **neden residue yolunun EKLENMEDİĞİ** (`crc()` xorout uyguluyor).
   - `canParse`ın neden DAİMA `false` olduğu — `uavcan-compatibility` emsali,
     FARKLI sebep, ve **ölçülen 6 çakışma**.
   - Karar 16a-1: control field neden varsayılan olarak yorumlanmıyor.
   - AIS'in denizcilikte bulunan tek HDLC bağı olduğu, ve `ais.ts`in girdisinin
     bu motorun girdisiyle AYNI OLMADIĞI.
   - Yedi `decodeOptions` kanalının her birinin kaynağı.
3. **Katalog** — `hdlc-based-marine` `status` `'planned'` → `'ready'`
   (`marine-navigation.ts:470`), `pluginId: 'hdlc-based-marine'` eklenir.
   `definitions: ['vendor-map','custom-schema']` (`:488`) **KALIR, panel
   YAZILMAZ** (`snmp.ts:46` emsali). `tabs`a DOKUNULMAZ — `'build'` yok,
   `encoder` yazılmaz.
4. **Registry** — `src/protocols/index.ts`e `registerOnce(registry,
   'hdlc-based-marine', …)`. Marine bloğuna (`:45-58`) eklenir; yorumda
   `hdlcCore.ts` paylaşımı ve `canParse === false` anılır. 140 → 141.
5. **Çeviri** — `en.ts` + `tr.ts`. `hdlc` 13 anahtar kullanmıştı; bu kayıt
   yedi seçenek + candidate uyarıları taşıdığı için **~20-25 anahtar**
   beklenir. `tr.ts` KAYNAK sözlüktür, eksik `en.ts` anahtarı DERLEME
   HATASIDIR.
6. **Test** — `hdlcBasedMarine.test.ts`:
   - Spec'in `7E 12 03 18 04 20 10 33 88 XX XX 7E` örneği alan alan çözülüyor.
   - Yedi seçeneğin her biri için en az bir dal (özellikle
     `addressFieldBytes: 0` + `controlFieldBytes: 0` = AIS düzeni,
     `fcsCoverage: 'information-only'`, `fcsProfile: 'crc32-iso-hdlc'`).
   - `controlFieldProfile: 'raw-candidate'` (varsayılan) I/S/U **BASMIYOR**;
     `'iso-13239-modulo8'` basıyor.
   - Bozuk FCS → `frame.valid: false` ama alanlar YİNE çözülüyor
     (`nmea0183.ts` ve `modbusRtu.ts`in CRC deseni).
   - `fcsByteOrder: 'big-endian'` ters bayt sırasını doğru okuyor.
7. **Bekçi** — `hdlcMarineCanParseRegistry.test.ts` (yukarıda, üç iddia).
8. **e2e** — `e2e/hdlc-based-marine-decode.spec.ts`. Kanıtlanacak: sayfa
   **Hazır** rozetiyle açılıyor · varsayılan örnek çerçeve ilk render'da
   girdide · alanlar `(candidate)` etiketiyle görünüyor · FCS PASS görünüyor ·
   `controlFieldProfile` değiştirilince I/S/U alanları BELİRİYOR ·
   konsola hata basmıyor · 1440 ve 390 pikselde yatay taşma yok.

---

## Devralınan tuzaklar

- **`hdlcCore.ts`e DOKUNULMAZ.** İki mevcut tüketicisi var; imzasını
  değiştirmek `hdlc`/`sdlc`i sessizce bozar. Gerekiyorsa **ek** export yaz,
  var olanı DEĞİŞTİRME.
- **Katalogda poly `0x1021` olan DÖRT giriş var, yalnız `CRC16_X25` HDLC'dir.**
- **`0xF0B8` bir residue'dür, check DEĞİL.** `crc()` xorout uyguladığı için
  doğrudan çıkmaz.
- **`hdlcSyncExtractor` (kaçışsız) ile `hdlcFlagExtractor` (kaçışlı) AYRI
  araçlardır** ve `escaping` seçeneği hangisinin kullanılacağını belirler.
- **`canParse` DAİMA `false`** — ölçüldü, 6 çakışma, hepsi kardeş kayıt.
- **Vendor alanı ADLANDIRILMAZ.** Katalog `:486-487` ve spec `:264`/`:377`.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
  Control field bit alanları için kapsayan bayt aralığı, bit ayrıntısı alan
  ADINDA (`Control · N(S) (bit 1:3)`).
- **`ParsedField.id` KENDİ offset'ini kullanır** (`ftp.ts`/`rtcp.ts` vakaları).
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings`
  `ProtocolWarning[]`.
- **`ParsedFrame` DÜZ, `children` YOK.** Hiyerarşi alan ADLARIYLA.
- **`unit` yalnız gerçek fiziksel değere** — N(S), N(R), adres, FCS BİRİMSİZ.
- **`'build'` sekmesi YOK → `encoder` YAZILMAZ.** `encodeHdlcSyncFrame` yalnız
  örnek/test kurmak için çağrılır.
- **`definitions` paneli YAZILMAZ** (`snmp.ts:46` emsali).
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **`CrcCalculatorTool.test.tsx`e DOKUNMA** — bu dalga CRC eklemiyor, 37 kalır.

---

## Model/effort önerisi

**Sonnet · high.**

**Model = Sonnet:** tarif net ve şablon elde. `sdlc.ts` bu dosyanın birebir
iskeletidir, `hdlcCore.ts` çekirdeği hazır ve iki kez kanıtlı, CRC katalogda ve
fixture'lı, kaynak (X.25 + Q.921 + RFC 1662 + reveng + Wireshark sabitleri)
mükemmel ve çelişkisiz. Tartılacak bir mimari seçenek yok — Opus'un çözdüğü
sınıf bir belirsizlik burada YOK.

**Effort = high (medium DEĞİL):** iki sebep. (1) **Yedi `decodeOptions`
kanalının varsayılanları** yanlış seçilirse motor hata VERMEDEN yanlış alan
basar — özellikle `controlFieldProfile`ın varsayılanı, çünkü `hdlc.ts`ten
kopyalamak kolay ve o kopya bu kaydın varlık sebebini (candidate disiplini)
sessizce iptal eder. (2) **Görev 0 iki ayrı test dosyasında iki FARKLI yol
biçimi** istiyor (`/comm` önekli ve öneksiz) ve yanlış kopya testi sessizce
404'e düşürür.

**Tamamlanma ölçütü:** Görev 0 ayrı ve yeşil — `ProtocolPage.test.tsx` ve
`nmea-decode.spec.ts` artık **katalogdan türetiyor** ve hiç aday kalmazsa
AÇIKÇA atlıyor; `hdlc-based-marine` **Hazır** rozetiyle açılıyor;
`hdlcCore.ts` **DEĞİŞMEDİ** ve `hdlc`/`sdlc` testleri hâlâ yeşil;
yedi `decodeOptions` kanalının her biri en az bir testle kanıtlı;
`hdlcMarineCanParseRegistry.test.ts` `hdlc`/`sdlc`in kabul ettiği çerçevelerde
de `false` kanıtlıyor ve `totalExamples > 800`; alanlar e2e'de `(candidate)`
etiketiyle görünüyor; **`crcCatalogue.ts` ve `CrcCalculatorTool.test.tsx`
DEĞİŞMEDİ**; birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): Görev 0 → kaynak turu (kısa, kaynak
bu brifte) → karar → motor → çeviri → test → e2e.
