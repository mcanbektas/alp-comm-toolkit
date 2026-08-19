# BRİF — ALP Comm Toolkit, Faz 10 dalga 8 (Bluetooth LE ailesi: ATT/GATT çözümleyici · Web Bluetooth kaynağı)

## Konum

Dalga 7 (`afc4456`) `wireless/` dizinini açtı ve dört motor bıraktı: BLE
Advertisement (ready), LoRaWAN / Zigbee / Matter (partial). Çalışma ağacı temiz,
bekçi yeşil: katalog 8 domain / 54 aile / 172 protokol, registry 47 protokol.

Dalga 8 aynı aileyi bir kat yukarı taşır: BLE Advertisement bağlantısız yayını
çözüyor, `ble-gatt` bağlantılı trafiği çözecek. Dizin (`src/protocols/wireless/ble/`)
ve emsal (`bleAdvertisement.ts`) hazır — bu dalga sıfırdan iskele kurmuyor.

## Durum — keşif turunda doğrulananlar

Bu bölümdeki her satır bu depoda okunarak doğrulandı, hiçbiri varsayım değil.

### 1. `src/connection/bluetooth` YOK

`src/connection/` altında yalnız `mock/` ve `serial/` var. Dalga 7 brief'inin
"BLE live sekmesi = `src/connection/bluetooth`" notu bir **hedef yol**du, var olan
kod değil. Barrel bunu zaten yazıyor:

> `src/connection/index.ts`: *"`usb`, `bluetooth`, `websocket`, `file` alt
> klasörleri sonraki fazlarda aynı `ByteSource` sözleşmesini gerçekleyecek"*

Yani dalga 8'in canlı ayağı **yeni bir bağlantı kaynağı** demek, mevcut kaynağın
BLE'ye açılması değil. Emsal `serial/`: 4 dosya, 333 satır kaynak + 353 satır test.

### 2. `ByteSource` sözleşmesi GATT'a doğrudan OTURMUYOR — dalganın ana kararı

`src/connection/types.ts` bayt akışı modelliyor:

```ts
export type ByteSourceKind = 'web-serial' | 'simulated';
onChunk(chunk: Uint8Array, receivedAt: number): void;
```

Web Bluetooth GATT bayt akışı vermez. Verdiği şey **characteristic'e etiketli,
sınırı belli değerler**: `characteristicvaluechanged` olayı başına bir `DataView`,
kaynağı `(service UUID, characteristic UUID, handle)` üçlüsüyle kimlikli.

İki sonuç:

- **Kimlik kaybı.** `onChunk(bytes, t)` sözleşmesinde characteristic kimliği
  taşıyacak alan yok. Ham baytı geçirirsek "bu değer hangi characteristic'ten
  geldi" bilgisi kaybolur — GATT sayfasının bütün araçları (Handle & UUID Map,
  CCCD State Inspector, Property Bit Mask Decoder) tam olarak bu kimliğe dayanıyor.
- **Çerçeveleme anlamsız.** Mevcut zincir baytı inter-character/inter-frame
  timeout ile çerçeveliyor (`types.ts`'in `receivedAt` yorumu bu yüzden var).
  GATT notification'ı ZATEN tam bir birimdir; timeout ile çerçevelemek iki
  notification'ı birleştirir ya da birini böler — **hata vermeden, sessizce yanlış**.

Bu, dalga başında karara bağlanmadan kod yazılamayacak bir çatlaktır. Seçenekler
aşağıda "Verilmesi gereken kararlar" bölümünde, önerisiyle.

### 3. MQTT / CoAP alias'ları — YAPILACAK İŞ YOK, zaten çalışıyor

Bu dalganın "ucuz kazanç" adayıydı, keşif çürüttü.

`src/protocols/pluginBinding.ts` iki çözücü veriyor ve **ikisi de `aliasOf`
zincirini kanoniğe kadar takip ediyor**: `resolvePluginId` motoru, `resolveStatus`
rozeti kanonik kayıttan türetiyor. Dosyanın kendi yorumu bunun neden böyle
olduğunu ölçümle anlatıyor (2026-08-14, Modbus alias'ları çalışan çözümleyicinin
altında "Planlandı" rozeti taşıyordu).

Kanonik kayıtlar `network-ethernet/web-messaging/mqtt` ve `.../coap`: ikisi de
`status: 'ready'` + `pluginId` taşıyor. Dolayısıyla
`wireless-iot/iot-messaging/mqtt` ve `.../coap` sayfaları **bugün** hazır rozet
gösteriyor ve decode panelini kanonik motorla açıyor.

`wireless-iot.ts` içindeki `status: 'planned'` alanı bu iki kayıtta **ölü veri** —
UI okumuyor. Dokunulmasına gerek yok; dokunmak da bir şeyi değiştirmez.

> **Planned sayısı düzeltmesi: 12 değil 10.** Kalan gerçek planned wireless-iot
> kayıtları: `ble-gatt`, `thread`, `lora`, `wifi`, `esp-now`,
> `rf-telemetry-custom-frame`, `wireless-m-bus`, `nb-iot`, `lte-modem-at`,
> `gnss-modem`. (`wireless-m-bus` alias ama kanoniği —
> `industrial-automation/metering/wireless-m-bus` — gerçekten planned, o iş duruyor.)

### 4. `ble-gatt` katalog kaydı bu dalganın kapasitesinden BÜYÜK

`src/app/catalog/domains/wireless-iot.ts:60-90` dokuz sekme vaat ediyor —
`overview, live, decode, build, timing, data, diagnostics, definitions, examples` —
artı `definitions: ['custom-schema']` ve dokuz araç. Dalga 7'nin dört protokolü
yalnız decode ekseninde çalışmıştı.

Kayıt bir **vaat**, dalga onu tek turda karşılamak zorunda değil; ama neyin bu
dalgada karşılandığı yazılı olmalı (aşağıda "Kapsam bölmesi").

## Katalog yolları (doğrulandı)

| Yol | Satır | Durum | Bu dalgada |
|---|---|---|---|
| `wireless-iot/bluetooth-le/ble-advertisement` | :37 | `ready`, `pluginId` var | dokunulmaz |
| `wireless-iot/bluetooth-le/ble-gatt` | :60 | `planned` | **`ready` + `pluginId: 'ble-gatt'`** |
| `wireless-iot/iot-messaging/mqtt` | :325 | alias → ready | dokunulmaz (§3) |
| `wireless-iot/iot-messaging/coap` | :345 | alias → ready | dokunulmaz (§3) |

## BEKÇİ BORCU — YOK

Katalog sayıları **değişmiyor**: `ble-gatt` kaydı zaten var, yalnız `status` ve
`pluginId` alanları işlenecek. `src/tests/catalog.test.ts`'in
`EXPECTED_DOMAIN_COUNT = 8` / `EXPECTED_FAMILY_COUNT = 54` /
`EXPECTED_PROTOCOL_COUNT = 172` üçlüsüne dokunulmaz.

Registry 47 → 48 olur (`ble-gatt` eklenir).

Yeni kayıt EKLENMEZ. Eklenirse bekçi kırmızıya döner ve bu brief yanlış demektir.

## Kaynaklar — dalga 7 karar 2 aynen geçerli (resmi + bir bağımsız çapraz)

| Konu | Resmi | Çapraz doğrulama |
|---|---|---|
| ATT PDU (opcode, format) | Bluetooth Core Spec 6.3, [Vol 3] Part F | Wireshark `packet-btatt.c`, Zephyr `att.h` (Apache-2.0) |
| GATT profil (service/characteristic/descriptor, CCCD) | Core Spec 6.3, [Vol 3] Part G | Wireshark `packet-btgatt.c`, Zephyr `gatt.h` |
| 16-bit SIG UUID'leri | Assigned Numbers (`uuids/*.yaml`) | BlueZ `src/shared/util.c` |
| L2CAP çerçevesi (CID 0x0004) | Core Spec 6.3, [Vol 3] Part A | Wireshark `packet-btl2cap.c` |
| Web Bluetooth API | W3C CG "Web Bluetooth" Draft | MDN + Chromium `bluetooth/` gerçeklemesi |

Core Spec 6.3 PDF'i dalga 7a'da (2026-08-17) indirildi ve BLE Advertisement için
kullanıldı — aynı belge, farklı Vol/Part. Yeni indirme gerekmeyebilir, önce
kontrol et.

## Kapsam bölmesi

Dört alt dalga. **8a bağımsız ve düşük riskli — 8b'nin kararı beklenirken
başlayabilir.** 8b'nin karar 1'i çözülmeden 8b/8c'ye girilmez.

### 8a — ATT/GATT çözümleyici motoru (decode sekmesi)

Dalga 7 deseninin birebir tekrarı: saf fonksiyon, hex girdi, `ProtocolPlugin`.
Tarayıcı API'si yok, risk düşük.

1. `src/protocols/wireless/ble/bleGatt.ts` + `.test.ts`. `bleAdvertisement.ts`
   emsali: dosya başı yorumunda kaynak, kapsam çizgisi, bit sırası, gösterim
   kararları yazılı olacak.
2. ATT opcode çözümü — dar küme, kalanı ham + opcode numarası:
   Error Response `0x01`, Exchange MTU Req/Rsp `0x02/0x03`,
   Find Information Req/Rsp `0x04/0x05`, Read By Type Req/Rsp `0x08/0x09`,
   Read Req/Rsp `0x0A/0x0B`, Read By Group Type Req/Rsp `0x10/0x11`,
   Write Req/Rsp `0x12/0x13`, Write Command `0x52`,
   Handle Value Notification `0x1B`, Indication `0x1D`, Confirmation `0x1E`.
3. Opcode bit alanları: Authentication Signature Flag (bit 7), Command Flag
   (bit 6), Method (bit 5:0). `bitCursor` **`lsb-first`** — BLE bit sırası
   (dalga 7a'da sabitlendi, LoRaWAN'ın tersi).
4. Error Response gövdesi: Request Opcode + Attribute Handle + Error Code
   (dar ad kümesi: `0x01` Invalid Handle … `0x11` Insufficient Resources).
5. 16-bit SIG UUID → isim eşlemesi, **dar küme**. 128-bit UUID: ham + "custom".
   Karışık uzunluk (Find Information Rsp Format 0x01/0x02) ayrımı testte sabitlenir.
6. CCCD (`0x2902`) değer çözümü: bit 0 Notification, bit 1 Indication.
7. Handle: 16-bit **little-endian** wire, ekranda `0x` + 4 hane büyük harf.
8. Örnek çerçeveler (`ExampleFrame`) — en az bir Notification, bir Write Request,
   bir Error Response.
9. `src/protocols/index.ts`'e `registerOnce(registry, 'ble-gatt', …)` + katalogda
   `status: 'ready'`, `pluginId: 'ble-gatt'`.

### 8b — Web Bluetooth kaynağı (live sekmesi) — KARAR 1 ÇÖZÜLMEDEN BAŞLAMA

10. Karar 1'in seçtiği sözleşme `src/connection/types.ts`'e işlenir.
11. `src/connection/bluetooth/webBluetoothTypes.ts` — `serial/webSerialTypes.ts`
    emsali: tarayıcı API'sinin bu depodaki tip yüzeyi, test edilebilmek için
    enjekte edilebilir.
12. `src/connection/bluetooth/bluetoothSource.ts` + `.test.ts`. `serialSource.ts`
    emsali **birebir**: cihazı bu modül SEÇTİRMEZ — `requestDevice()` kullanıcı
    jesti içinde çağrılmak zorunda, fabrika hazır `device` alır, testler sahte
    cihaz enjekte eder.
13. `stop()` yeniden çağrılabilir ve kapalı kaynakta no-op —
    `startNotifications()` / `stopNotifications()` çifti, `serialSource`'un
    `loopDone` kilit dansının GATT karşılığı.
14. `src/connection/bluetooth/index.ts` + barrel'a `export * from './bluetooth'`.
15. `ConnectionPanel.tsx:29` — `MonitorSourceKind = 'serial' | 'simulated'`
    üçüncü değeri alır. Çeviri anahtarları (`monitor.source.*`) eklenir.
16. Tarayıcı yokluğu: `navigator.bluetooth === undefined` →
    `ConnectionErrorCode: 'unsupported'` (kod zaten var). Safari ve Firefox'ta
    Web Bluetooth **yok** — panel bunu söylemeli, sessiz kalmamalı.

### 8c — GATT ağacı görünümü

17. Service / Characteristic / Descriptor ağacı, keşfedilen cihazdan.
18. Property bit maskesi çözümü (Read/Write/Notify/Indicate/Broadcast/
    WriteWithoutResponse/AuthenticatedSignedWrites/ExtendedProperties).
19. Handle ↔ UUID haritası.

### 8d — BU DALGAYA GİRMEZ, sonraki işe yazılır

- `build` sekmesi (ATT PDU üretici)
- `definitions: ['custom-schema']` — GATT şema içe aktarımı
- Engineering Value Converter
- Read/Write Latency ölçümü (`timing` sekmesi)

Bu dördü katalog kaydında vaat ediliyor; dalga 8 sonunda sayfa hâlâ eksik
vaat taşıyacak. **Bilinçli**, ve dalga 9 brief'inin girdisidir.

## Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

### Karar 1 — GATT canlı verisi hangi sözleşmeden akacak? (dalganın en pahalı kararı)

| # | Seçenek | Bedel | Risk |
|---|---|---|---|
| A | Yeni `MessageSource` sözleşmesi: `onMessage(channelId, bytes, receivedAt)`. `ByteSource` bayt akışları için olduğu gibi kalır. | Yeni arayüz + live-monitor'de ikinci yol | Düşük — model dürüst |
| B | `ByteSource.onChunk`'a opsiyonel `channelId?: string` eklenir | En az kod | **Yüksek** — çerçeveleme katmanı kanal-bilmez; karışık bayt tek framer'a gider, sessiz-yanlış |
| C | Her characteristic için ayrı `ByteSource` örneği | Sözleşme bozulmaz | Orta — çoklu kaynak yönetimi gerekir, ayrıca GATT değerine timeout-çerçeveleme uygulamak yine yanlış |

**Öneri: A.** GATT mesaj yönelimlidir, bayt yönelimli değil; sözleşmeyi bükmek
yerine kardeşini yazmak doğrusu. Ek gerekçe: Zigbee/Matter/LoRaWAN canlı ayakları
da mesaj yönelimli — A bir kez yazılır, üçü birden kullanır. B'nin ucuzluğu
görünürde; sessiz-yanlış çerçeveleme bu depoda `mavlink`/`canopen` tuzak
notlarının tam olarak kaçındığı hata sınıfı.

### Karar 2 — Decode girdisi ATT PDU mu, L2CAP çerçevesi mi?

BLE Advertisement'ta girdi "sniffer'ın verdiği seviye" seçilmişti (Preamble/
Access Address/CRC girdide yok, dalga 7 karar 4a). GATT'ın karşılığı:

- **2a**: Çıplak ATT PDU (Opcode + parametreler). Basit, Web Bluetooth'un verdiğine
  yakın.
- **2b**: L2CAP Basic çerçevesi (Length + CID 0x0004 + ATT PDU). Wireshark
  dökümüne yakın, CID doğrulaması yapılabilir.

**Öneri: 2a + 2b'yi opsiyonel önek olarak tanı** — ilk iki bayt geçerli bir
L2CAP Length ve üçüncü-dördüncü `04 00` ise soyup uyarı bas, değilse çıplak ATT
varsay. Tek girdi kutusu iki kaynağı da yer. (Emsal: `zigbee.ts` girdiyi tam
802.15.4 çerçevesi bekliyor, `artnet.ts` UDP payload — ikisi de tek seviye
sabitlemiş; burada belirsizlik gerçek olduğu için tanıma tercih ediliyor.)

### Karar 3 — 16-bit SIG UUID kümesi ne kadar geniş?

Assigned Numbers'da yüzlerce var. Dalga 7'nin "dar ad kümesi, kalanı ham"
politikası geçerli ama sınır çizilmeli: yalnız GATT yapısal UUID'leri
(`0x2800` Primary Service … `0x2902` CCCD … `0x2904` Presentation Format) mi,
yoksa yaygın profiller de mi (Heart Rate `0x180D`, Battery `0x180F`,
Device Information `0x180A`)?

**Öneri: yapısal UUID'ler TAM + yaygın profillerden en çok 15 tane.** Gerekçe:
yapısal olanlar olmadan ağaç okunamaz (zorunlu); profil isimleri konfordur ve
listesi sonsuza uzar. Tam Assigned Numbers kütüphanesi Zigbee ZCL borcuyla aynı
sınıfta — mekanik veri girişi, ayrı ve ucuz bir turda yapılır.

### Karar 4 — Web Bluetooth'un yokluğu testte nasıl karşılanır?

`serialSource.test.ts` sahte port enjekte ediyor (264 satır). GATT'ın yüzeyi
daha geniş: device → server → service → characteristic → descriptor zinciri.
Sahte nesne ağacı yazmak mı, yoksa `mock/simulatedSource.ts` emsaliyle bir
`simulatedGattDevice` mi?

**Öneri: `mock/` altına simüle GATT cihazı.** `connection/types.ts`'in kendi
yorumu bu gerekçeyi zaten kuruyor: *"Monitörün gerçek tarayıcıda uçtan uca
sınanabilmesi, simüle edilmiş bir kaynağın aynı sözleşmeyi gerçeklemesine
bağlı"*. Playwright turu (aşağıda) sahte nesneyle koşamaz.

## Tuzaklar

**Dalga 7'den taşınanlar:**

- BLE bit sırası **`lsb-first`**, çok baytlı alanlar **little-endian**. LoRaWAN'ın
  (`msb-first`) tersi — aynı dizinde iki farklı kural var, karıştırma.
- Çeviri anahtarı segmentlerinde tire olamaz: `ble-gatt` → `protocol.bleGatt`
  (`bleAdvertisement.ts`'teki `TRANSLATION_KEY_PREFIX` emsali).
- Protokol adı **veridir, çeviriye girmez** (CLAUDE.md).
- Şifreli/doğrulanamayan içerikte PASS/FAIL **asla** basılmaz. GATT'ın karşılığı:
  Authentication Signature Flag set ise imza **doğrulanmaz** — "signed, cannot
  verify without CSRK" denir.
- Uzunluk alanı arabelleği aşıyorsa hata, zincir sınırı koy (`ipv6` ext-header
  emsali).

**Bu dalgaya özgüler:**

- **Web Bluetooth yalnız güvenli bağlamda ve kullanıcı jestiyle.** `requestDevice()`
  React olay işleyicisinden çağrılmalı; fabrikaya hazır cihaz geçir
  (`serialSource.ts`'in port kararının birebir aynısı, sebebi de aynı).
- **jsdom'da `navigator.bluetooth` yok.** Birim testleri gerçek API'ye
  dokunamaz — karar 4 bunu çözer.
- **`characteristicvaluechanged` olayı `DataView` verir, `Uint8Array` değil.**
  Dönüşümde `byteOffset`/`byteLength` atlanırsa ham bayt kayar; `new
  Uint8Array(view.buffer)` **yanlış**, `new Uint8Array(view.buffer,
  view.byteOffset, view.byteLength)` doğru. Sessiz-yanlış üretir, testte sabitle.
- **`receivedAt` tabanı `performance.timeOrigin + performance.now()`** —
  `Date.now()` değil. `ByteSourceHandlers` yorumu sebebini uzun uzun anlatıyor
  (Worker'ın `performance.now()` sıfır noktası ana thread'inkinden farklı).
- **Safari ve Firefox'ta Web Bluetooth yok.** Panel "desteklenmiyor" demeli;
  boş liste gösterip sessiz kalmak kullanıcıyı yanıltır.
- **`resolveStatus`/`resolvePluginId` alias'ı takip eder.** `ble-gatt` alias
  değil, doğrudan etkilenmiyor — ama katalog kaydına elle `status` yazarken
  alias'ları da güncelleme dürtüsüne kapılma; alias'lar türetiyor (§3).

## Çalışma kuralları

- Komutlar: `npm run typecheck` · `npm test` · `npm run test:e2e`.
- Her alt dalga kendi commit'i: `feat: … (Faz 10, dalga 8a)` biçimi, dalga 7
  commit'lerinin birebir aynısı.
- Dosya başı yorumu **zorunlu**: kaynak, kapsam çizgisi, bit sırası, gösterim
  kararları. `bleAdvertisement.ts` / `zigbee.ts` ölçüsünde.
- 8a testsiz commit edilmez; 8b'nin canlı ayağı için **tarayıcı turu şart** —
  yeşil test + temiz review yetmez, varsayılan girdiyle ekranı gerçekten aç.

## Öneri

**8a'yı hemen başlat** — karar 1'den bağımsız, dalga 7 deseninin tekrarı, riski
düşük. Model: Sonnet · medium (tarif net, emsal elde).

**8b'yi karar 1 verilmeden açma.** Karar verildiğinde Opus · high — sözleşme
kararı geri dönüşü pahalı ve Web Bluetooth yüzeyi bu depoda ilk kez açılıyor.

8c 8b'ye bağlı; 8d bilinçli olarak dalga 9'a bırakıldı.
