# BRİF — Faz 10 dalga 15d, `crsf` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra `15c`yi (bağımlılık:
`packedChannels.ts` orada doğar), sonra bu dosyayı okur.

Bu, dalganın **kaynak açısından en iyi durumdaki** kaydıdır: TBS'in resmî spec
deposu ile Betaflight'ın referans uygulaması **birbirini doğruluyor**.

---

## Girdi sözleşmesi

**HAM CRSF çerçeve baytları.** UART taşıyıcısı (416666 / 420000 / pazarlıklı baud,
8N1, non-inverted) parser'a girmez — `mavlink.ts`in taşıyıcı sınırı birebir.

### Çerçeve

Kaynak: spec `06-havacilik-uav.md:229-230` + TBS `crsf.md` + Betaflight
`rx/crsf_protocol.h`.

```
[0]        Device / Sync Address   (CRSF_SYNC_BYTE = 0xC8, crsf_protocol.h:138)
[1]        Frame Length            (Type + Payload + CRC baytlarının sayısı)
[2]        Type
[3..n-1]   Payload
[n]        CRC-8
```

Maksimum çerçeve **64 bayt** (spec `:230`).

**Adres değerleri** (`crsf_protocol.h:141-153`) — sabit bir sözlük ve doğrulanmış:
`0x00` Broadcast · `0x10` USB · `0x80` TBS Core PNP Pro · `0xC0` Current Sensor ·
`0xC2` GPS · `0xC4` TBS Blackbox · `0xC8` Flight Controller · `0xCC` Race Tag ·
`0xEA` Radio Transmitter · `0xEC` CRSF Receiver · `0xEE` CRSF Transmitter.

Katalogda `Device Info` aracı var (`aerospace-uav.ts:296`); adres alanı bu
sözlükten ADLANDIRILIR (sözlük iki bağımsız kaynakta aynı).

---

## CRC — iki tuzak, ikisi de ölçülmüş

### Tuzak 1: `CRC8_DVB_S2` katalogda YOK, eklenecek

`[KANIT]` Betaflight `common/crc.h:33`:
```c
#define crc8_dvb_s2(crc, a)   crc8_calc(crc, a, 0xD5)
```

Katalogdaki beş CRC8: `CRC8` (poly `0x07`), `CRC8_SAE_J1850` (`0x1D`),
`CRC8_AUTOSAR` (`0x2F`), `CRC8_MAXIM` (`0x31`), `CRC8_BACNET_MSTP` (`0x81`).
**`0xD5` YOK.**

*"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR"* (dalga 13 dersi 2, 14g'de
`CRC4_ITU` reddi, 14h'te PSI5 CRC-3 vakası). Beş tane CRC-8 var ve hiçbiri işe
yaramıyor.

**Katalog eklemesi:**
```ts
CRC8_DVB_S2: { width: 8, poly: 0xd5n, init: 0x00n, refin: false, refout: false, xorout: 0x00n },
```

**`check` fixture'ı ZORUNLU** — `crcEngine.test.ts`teki 18 fixture'ın disiplini
(`crcEngine.ts:104` *"aşağıdaki 18 fixture bunun kanıtı"*). CRC-8/DVB-S2'nin
standart `check` değeri (`"123456789"` girdisi için) bağımsız kaynaktan alınır ve
teste yazılır. **Katalog girişi `check` doğrulanmadan eklenmez** — 14e'nin
`CRC24_FLEXRAY_A/B` disiplini.

**`CrcCalculatorTool.test.tsx:77` 34 → 35** olur; testin `:71-76`daki yorumu da
güncellenir (dalga adı + gerekçe eklenir, mevcut yorumun biçimi izlenir).

### Tuzak 2: CRC'nin KAPSAMI çerçevenin tamamı DEĞİL

`[KANIT]` Betaflight `rx/crsf.c:334-336`:
```c
uint8_t crc = crc8_dvb_s2(0, crsfFrame.frame.type);
for (…) crc = crc8_dvb_s2(crc, crsfFrame.frame.payload[ii]);
```

**CRC `Type` baytından başlar.** `Device Address` ve `Frame Length` baytları
HESABA GİRMEZ. "CRC'yi çerçevenin tamamına uygula" varsayımı burada sessizce
yanlış çıkar — çerçeve geçerliyken FAIL raporlar.

Doğrulama: bilinen bir CRSF çerçevesi üzerinde iki kapsamı da hesapla, yalnız
`Type…Payload` kapsamının PASS verdiğini teste yaz.

### Tuzak 3: frame CRC ≠ command CRC

Spec `:245`:
> *"Extended komutlarda komut-özel ek CRC yapıları olabileceğinden **frame CRC ile
> command CRC ayrı tutulmalıdır**."*

Katalog yorumu da yazılı (`aerospace-uav.ts:300-301`): *"tek bir 'CRC PASS'
göstergesine indirgenemez."*

→ `diagnostics` sekmesi ikisini AYRI raporlar. Frame CRC her çerçevede;
command CRC (varsa) yalnız o komut için ve **ayrı bir alan** olarak.
14e'nin *"iki CRC ayrı ayrı raporlanıyor"* ölçütünün aynısı; spec `04-otomotiv.md:509`
*"CAN Frame CRC ≠ Application E2E CRC"* dersinin bu domain'deki karşılığı.

**Command CRC'nin ALGORİTMASI doğrulanmadan uygulanmaz.** TBS spec'i incelenecek;
bulunamazsa alan HAM basılır + `commandCrcNotVerified` uyarısı.

---

## `0x16 RC Channels Packed` — 15c'nin yardımcısını TÜKETİR

`[KANIT]` TBS `crsf.md:517-531` ve Betaflight `crsf_protocol.h:113-131`:
16 kanal × 11 bit = 22 bayt, C bitfield → **`lsb-first`**.

```
readPackedChannels(payload, 0, 16, 11, 'lsb-first')
```

**Yeni bir okuyucu YAZILMAZ.** 15c'de doğan `protocol-core/decoding/packedChannels.ts`
çağrılır. `sbus.ts`ten import EDİLMEZ (protokoller birbirinden import etmez).

**Ölçek PAYLAŞILMAZ** (ana brif bulgu 5): CRSF'in merkezi 992 ve dönüşümü
`TICKS_TO_US(x) = (x−992)×5/8+1500` (`crsf.md:522-526`), SBUS'unki 173…1812.
Aynı bitler, farklı anlam.

**µs dönüşümü uygulanır mı?** TBS spec'i formülü açıkça veriyor ve *"Center
(1500µs) = 992"* diyor — bu, SBUS'un aksine **protokol tarafından tanımlanmış**
bir eşlemedir, kullanıcı kalibrasyonu değil. → **Ham değer + türetilmiş µs, İKİ
AYRI alan**; µs alanına `unit: 'µs'` verilebilir (gerçek fiziksel değer,
`types.ts:46` koşulunu sağlıyor), ham alana VERİLMEZ.

### `0x17 Subset RC Channels Packed` — kapsam DIŞI

TBS spec'i kendi uyarısını koymuş (`crsf.md:550-551`):
> **WARNING** — *"This frame is discouraged for implementation. Revision is in
> progress."*

→ Tip `0x17` TANINIR (alan olarak adlandırılır) ama **payload ÇÖZÜLMEZ**;
ham + `frameTypeDiscouragedByVendor` uyarısı. Kaynak kendisi kararsızsa uygulamak
uydurmaktır. Tip `0x18` de aynı ("Unused", `crsf.md:43`).

---

## Çerçeve tipleri — hangileri ADLANDIRILIR

`crsf_protocol.h:45-73` sabit bir sözlük veriyor ve TBS spec'i aynı listeyi
taşıyor (iki bağımsız kaynak):

`0x02` GPS · `0x03` GPS Time · `0x06` GPS Extended · `0x07` Vario ·
`0x08` Battery · `0x09` Baro Altitude · `0x0B` Heartbeat · `0x11` Baro ·
`0x12` Mag · `0x13` AccGyro · `0x14` Link Statistics · **`0x16` RC Channels
Packed** · `0x17` Subset (kapsam dışı) · `0x1C` Link Statistics RX ·
`0x1D` Link Statistics TX · `0x1E` Attitude · `0x1F` MAVLink FC ·
`0x21` Flight Mode · `0x28` Device Ping · `0x29` Device Info ·
`0x2B` Parameter Settings Entry · `0x2C` Parameter Read · `0x2D` Parameter Write ·
`0x32` Command · `0x7A/0x7B/0x7C` MSP · `0x7D` DisplayPort.

**Tip ADI basılır** (sözlük doğrulanmış), **payload'ın İÇİ yalnız `0x16` için
çözülür.** Diğer tiplerin payload'ı HAM + `payloadNotDecodedForFrameType` uyarısı.

Gerekçe `mavlink.ts`in *"PAYLOAD HAM"* kararının aynısı: telemetri
çerçevelerinin alan düzenlerini tek tek uygulamak bu alt dalganın kapsamını
katlar ve her biri ayrı doğrulama ister. **Kapsam daraltması DEĞİL** — kayıt
`ready` kapanır çünkü ÇERÇEVE düzeyi (adres, uzunluk, tip, CRC, RC kanalları)
tam ve doğrulanabilir. Bu ayrım dosya başında AÇIKÇA yazılır.

`0x14 Link Statistics` **isteğe bağlı ikinci hedef**: spec `:241` alanları
listeliyor (Uplink RSSI/LQ/SNR, Downlink RSSI/LQ, RF Mode, TX Power, Antenna) ve
Betaflight `crsf.c` bunları okuyor — iki kaynak örtüşüyorsa çözülebilir.
**Zorunlu değil**; süre kalırsa yapılır, yapılmazsa ham + uyarı.

---

## `canParse` — bekçi testi ZORUNLU

`rcCanParseRegistry.test.ts` (15c'de açıldı) **genişletilir**, yeni dosya açılmaz.

CRSF'in `canParse`ı **üç kanıta birden** bakar:
1. `data[0] === 0xC8` (ya da bilinen adres sözlüğünden biri — hangisi olduğu
   kaynak turunda kararlaştırılır; **her adresi kabul etmek `canParse`ı
   gevşetir**).
2. `data[1]` (Frame Length) ile gerçek uzunluk tutarlı **ve** ≤ 64.
3. **CRC-8 PASS.**

Üçüncüsü olmadan CRSF, `0xC8` ile başlayan her çerçeveyi kendine çeker.
14f'in "%54 yanlış pozitif" ölçümü (`pulseLog.ts:63-68`) bu dersin kaynağıdır.

---

## `decodeOptions`

| Seçenek | Şıklar | Etki |
|---|---|---|
| `baudProfile` | `standard` 416666 (varsayılan) · `fcCompatibility` 420000 · `negotiated` | **Yalnız `timing` görünümünü** etkiler, çerçeve çözümünü ETMEZ |

Spec `:227` üç preseti adıyla veriyor. `negotiated` seçilirse baud değeri
çağırandan gelir — `vehiclePhy.ts`in *"sabit gömülmez"* disiplini.

**Baud pazarlığı state machine'i PARSER'A GİRMEZ** (spec `:248`: `416666 → Speed
Proposal → Accepted → Guard Time → Switch`). Çerçeveler arası durum — analyzer işi.

---

## Uygulama görevleri

1. **Kaynak turu** — TBS `crsf.md`i AÇ: çerçeve düzeni, `0x16` payload,
   CRC kapsamı, adres/tip sözlükleri. Betaflight ile ÇAPRAZLA. Örtüşmeyen alan
   ADLANDIRILMAZ.
2. **`crcCatalogue.ts`e `CRC8_DVB_S2`** + `crcEngine.test.ts`e `check` fixture'ı.
   **Katalog girişi `check` doğrulanmadan eklenmez.**
3. **`CrcCalculatorTool.test.tsx:77`** 34 → 35, `:71-76` yorumu güncellenir.
4. **`src/protocols/aerospace/crsf/crsf.ts`** — dosya başı: CRC kapsamının neden
   Type'tan başladığı, `0x17`/`0x18`in neden çözülmediği, payload'ın neden yalnız
   `0x16`da açıldığı, `ready` rozetinin neden yanıltıcı olmadığı.
5. **`packedChannels.ts` tüketimi** — `lsb-first`, 16 × 11 bit.
6. **Ham + µs iki ayrı alan**; `unit` yalnız µs alanında.
7. **Frame CRC ve command CRC ayrı alanlar**, `diagnostics`te ayrı satırlar.
8. **Katalog** — `crsf` `'planned'` → `'ready'` (`:273`), `pluginId: 'crsf'`.
9. **Registry** — `registerOnce(registry, 'crsf', …)`.
10. **Çeviri** — `en.ts` + `tr.ts` (tip sözlüğü ve adres sözlüğü dahil).
11. **Test** — `crsf.test.ts` (CRC kapsam testi ZORUNLU: yanlış kapsamın FAIL
    verdiği gösterilir), `rcCanParseRegistry.test.ts` genişletmesi.
12. **e2e** — `e2e/crsf-decode.spec.ts`. Kanıtlanacak: `0x16` çerçevesi 16 kanal
    basıyor, CRC PASS görünüyor, `0x17` çerçevesi "vendor discouraged" uyarısıyla
    ham kalıyor.

---

## Devralınan tuzaklar

- **CRC `Type`tan başlar, `Device Address`ten DEĞİL.** En kolay kaçan hata.
- **`packedChannels.ts`e ölçek fonksiyonu EKLEME.** SBUS ve CRSF'in ölçekleri
  farklı; ortak bir dönüştürücü birini sessizce yanlış ölçekler
  (12d'nin `networkTimestamp` vakası: NTP 2⁻³² kesir vs PTP tam sayı ns,
  4295 kat hata).
- **`bitCursor` varsayılanı `msb-first`tir, burada `lsb-first` gerekir.**
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`);
  11-bit kanal için kapsayan bayt aralığı, bit ayrıntısı alan ADINDA.
- **`ParsedField.id` KENDİ offset'ini kullanır** — ardışık kanallar aynı baytı
  paylaşır, id'ye kanal indeksi girer.
- **`unit` yalnız gerçek fiziksel değere** — ham tick değeri birimsiz, türetilmiş
  µs birimli.
- **`ParsedFrame` DÜZ, `children` YOK.**
- **`ParsedField.warnings` `string[]`**, `ParsedFrame.warnings` `ProtocolWarning[]`.
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.
- **`CrcCalculatorTool.test.tsx` yolu `src/features/calculators/tools/`**
  (dalga 14 briflerindeki `src/app/components/tools/` YANLIŞ).

---

## Model/effort önerisi

**Sonnet · high.** Kaynak mükemmel ve iki bağımsız kaynak örtüşüyor; desen
(çerçeve + CRC + `packedChannels` tüketimi) emsalli. Ama `medium` DEĞİL: yeni bir
katalog girişi `check` doğrulaması ister, CRC kapsamı "apaçık" görünen ama yanlış
olan bir varsayıma açık, ve frame/command CRC ayrımı bir raporlama tasarımı
gerektiriyor.

**Tamamlanma ölçütü:** `crsf` **Hazır** rozetiyle açılıyor; `CRC8_DVB_S2` katalogda
ve `check` fixture'ıyla test edilmiş; `CrcCalculatorTool.test.tsx` 35'e güncellenmiş
ve yeşil; CRC'nin Type'tan başladığı ayrı bir testle kanıtlı; `0x16` çerçevesi
16 kanalı ham + µs olarak basıyor; `0x17` ham + vendor uyarısı; frame CRC ve
command CRC ayrı raporlanıyor; `rcCanParseRegistry.test.ts` üç kaydı da kapsıyor
ve yeşil; birim + e2e + build yeşil; `rc-control-links` ailesinde `planned` 3'ten
2'ye düşüyor.
