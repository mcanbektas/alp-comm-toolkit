# BRİF — Faz 10 dalga 18, `wireless-iot` (keşif, 2026-08-26)

> **DEPONUN SON DOMAİNİ.** Bu dalga bitince katalogda `planned` KANONİK kayıt
> KALMAZ ve **katalog borcu SIFIRLANIR** (4 → 0). Kapanış görevleri bunu bir
> kilometre taşı olarak kaydeder (aşağıda "Domain kapanış görevleri").

Dört kanonik kayıt: `thread`, `wifi`, `esp-now`, `rf-telemetry-custom-frame`.
Hepsi `wireless-iot` domain'inde, üç ayrı ailede.

---

## Bu dosyanın rolü ve bölünme gerekçesi

Bu **ana brif**tir: domain ortak kararları, ölçümler, kaynak durumu, bağımlılık
zinciri, kapanış görevleri. Kayıt başına ayrıntı **alt briflerdedir**:

| Alt dalga | Kayıt | Neden ayrı |
|---|---|---|
| **18a** | `wifi` (1/2) — 802.11 MAC katmanı | 802.11 tek başına deponun en büyük kapsam kararı; MAC katmanı `esp-now`un ÖNKOŞULU ve kendi başına eksiksiz bir motor |
| **18b** | `wifi` (2/2) — yönetim gövdeleri + IE ayrıştırıcı | RSN/HT/VHT/HE IE'leri iç içe yapılardır; ayrı bir tur; **aynı kaydı iki dalgada büyütme emsali: `zigbee` (dalga 7 MAC/NWK/APS → dalga 8 ZCL kütüphanesi)** `[KANIT]` `src/protocols/wireless/zigbee/zigbee.ts:38-41` |
| **18c** | `esp-now` | 18a'nın MAC başlığını + 18b'nin element yürüyücüsünü TÜKETİR; kendi çerçevesi küçük |
| **18d** | `thread` | Bağımsız yığın (802.15.4 + 6LoWPAN); zigbee'nin MAC'ini ÇEKİRDEĞE ÇIKARMA riski burada |
| **18e** | `rf-telemetry-custom-frame` | Hiçbirine bağlı DEĞİL; var olan şema motorunun MONTAJI, yeni tel biçimi yok |

**Bağımlılık zinciri (AÇIK):**

```
18a  wifi/dot11Frame.ts  ──┬──► 18b  wifi/dot11Elements.ts ──┐
                           │                                  │
                           └──────────────────────────────────┴──► 18c esp-now
18d  thread   (bağımsız — ama zigbee'nin 802.15.4 MAC'ine DOKUNUR)
18e  rf-telemetry-custom-frame  (tamamen bağımsız)
```

18d ve 18e sırayı bozabilir; **18a → 18b → 18c sırası ZORUNLUDUR.**

---

## Kapsam — katalog ne vaat ediyor

`[KANIT]` `src/app/catalog/domains/wireless-iot.ts`

| Kayıt | `layer` | `tabs` | `definitions` | satır |
|---|---|---|---|---|
| `thread` | `network` | overview · **decode** · diagnostics · examples | — | :171-192 |
| `wifi` | `data-link` | overview · **decode** · timing · diagnostics · examples | — | :251-273 |
| `esp-now` | `data-link` | overview · **decode** · data · diagnostics · examples | — | :274-297 |
| `rf-telemetry-custom-frame` | `data-link` | overview · **decode** · **build** · data · diagnostics · **definitions** · examples | `['custom-schema']` | :304-329 |

**Okunacak üç şey:**

1. **`build` sekmesi YALNIZ `rf-telemetry-custom-frame`te var.** Öteki üçünde
   encoder YAZILMAZ (dalga 16 bulgu 11 emsali).
2. **`thread`te `timing` ve `data` YOK.** Yani "RSSI & Link Margin Trend"
   sekmesi bile açılmıyor — çerçeveler-arası araçlar zaten kapsam dışı.
3. **`rf-telemetry-custom-frame`in `definitions: ['custom-schema']`u BOŞ
   BASACAK** ve bu MAYIN DEĞİL — aşağıda `[KARAR 18-7]`.

### Domain dosyasının kendi kilitli kuralları (koddan okunamaz, uy)

`[KANIT]` `wireless-iot.ts:6-19`:
1. `live` yalnız tarayıcı API'siyle ulaşılabilen kayıtlarda açılır — **dördünde
   de `live` YOK**, doğrudur, harici sniffer donanımı ister.
2. **Anahtar gerektiren doğrulama tarayıcıda kalır; anahtar yoksa payload
   `encrypted` bırakılır, UYDURULMAZ.** Bu dalganın üç kaydını doğrudan
   bağlar (`thread` MLE, `esp-now` CCMP, `wifi` Protected).
3. `tabs` WORKSPACE_TABS sırasını korur.

---

## Zaten var olan makine — neyin YENİDEN YAZILMAYACAĞI

### ✅ BULGU 1 — 802.15.4 MAC ÇÖZÜCÜSÜ ZATEN VAR, ama `zigbee.ts`in İÇİNDE `[KANIT]`

`src/protocols/wireless/zigbee/zigbee.ts:99-160` tam bir IEEE 802.15.4 MAC
çerçeve çözücüsü barındırıyor: FCF bit alanları, sıra numarası, dört adresleme
kipi, PAN ID sıkıştırma, **FCS = `CRC16_KERMIT`** (`zigbee.ts:1250-1253`).
Girdi sözleşmesi de aynı: *"Girdi TAM 802.15.4 MAC çerçevesi (FCF'den FCS'e
kadar, sniffer/Wireshark seviyesi)"* (`zigbee.ts:3-4`).

**AMA paylaşılabilir DEĞİL:** `planMacAddressing` (:634), `macAddressLength`
(:616), `formatMacAddress` (:622) hepsi modül-yerel; hiçbiri `export`
edilmemiş (`zigbee.ts`in tek `export`ları :1218/:1232/:1400).

**Ve Thread'in ihtiyacı zigbee'ninkinden GENİŞ:** Thread çerçevelerinde MAC
katmanı güvenliği AÇIKTIR (`Security Enabled` = 1) ve arkasından **Auxiliary
Security Header** gelir (Security Control 1 B + Frame Counter 4 B + Key
Identifier 0-9 B). `zigbee.ts` bu biti yalnız OKUR ve alan olarak basar
(`zigbee.ts:743-744`), **başlığı AYRIŞTIRMAZ** — çünkü Zigbee MAC'te güvenlik
kullanmaz, NWK katmanında kullanır. `[KANIT]` `packet-ieee802154.c:3011`
*"Existence of the Auxiliary Security Header is controlled by the Security
Enabled Field"*.

→ **`[KARAR 18-1]`** aşağıda.

### ✅ BULGU 2 — Her iki FCS de KATALOGDA VAR ve GERÇEK YAKALAMAYLA DOĞRULANDI `[KANIT]`

| Tel | Algoritma | Katalog girdisi | Gerçek yakalama doğrulaması |
|---|---|---|---|
| 802.15.4 FCS | CRC-16/KERMIT (poly 0x1021, init 0, refin/refout, xorout 0) | `crcCatalogue.ts:237-244` **VAR** | **331/331** (`6LoWPAN.pcap`, ölçüldü) |
| 802.11 FCS | CRC-32/ISO-HDLC (poly 0x04C11DB7, init/xorout 0xFFFFFFFF, refin/refout) | `crcCatalogue.ts:456-463` **VAR** | **1080/1093** (`wpa-Induction.pcap`; kalan 13 GERÇEKTEN bozuk) |

→ **`[KARAR 18-6]` Katalog eklemesi: SIFIR.** Sayı **38**te kalır,
`CrcCalculatorTool.test.tsx:83` DEĞİŞMEZ (dosyadan doğrulandı: satır 83, değer
38). Dalga 16'dan beri ikinci sıfır-ekleme dalgası.

### ✅ BULGU 3 — Kullanıcı-tanımlı şema motoru TAM ve ÇALIŞIYOR `[KANIT]`

`rf-telemetry-custom-frame`in çekirdeği ZATEN YAZILMIŞ:

| Modül | Satır | Ne veriyor |
|---|---|---|
| `protocol-core/schemas/protocolSchema.ts` | 251 | §9.6'nın zod'lu tip karşılığı: `framing.{type,startBytes,endBytes,maximumFrameLength}`, `fields[].{id,type,offset,length,lengthFrom,enumValues,algorithm,coverage}`, `condition`, `repeatCount`, `bitOffset/bitLength/bitOrder`, `calibrationOffset` |
| `protocol-core/decoding/schemaParser.ts` | 615 | `parseWithSchema` + `createSchemaParser` |
| `protocol-core/encoding/schemaEncoder.ts` | 453 | `encodeWithSchema` — `build` sekmesinin motoru |
| `protocol-core/schemas/fieldTypes.ts` | 170 | 33 alan tipi |
| `protocol-core/checksums/checksumFinder.ts` | — | **"CRC Field Detector & Validator"** aracının motoru; 19 CRC + 9 basit toplam, normal VE ters bayt sırasıyla (`checksumFinder.ts:1-15`) |
| `protocol-core/decoding/pulseLog.ts` | — | **"Input Adapters → pulse durations"** konteyneri (`decodePulseLog`, `pulseByteSpan`) |
| `protocol-core/decoding/bitCursor.ts` | — | **"Input Adapters → bit stream"**; `lsb-first`/`msb-first` |
| `protocols/serial/framing/customBinaryProtocol.ts` | 80 | **BİREBİR EMSAL**: `createSchemaParser(SPEC_SENSOR_PROTOCOL)` + `encodeWithSchema` |

**18e'de yeniden yazılacak olan YALNIZ İKİSİ:** dewhitening (LFSR) ve
Manchester çözücü. İkisi de depoda YOK (`grep -ri "manchester|whiten|scrambl"
src/` → **sıfır dosya**).

### ⚠️ BULGU 4 — `createSchemaParser`in `canParse`i BOŞ `startBytes`te HER ŞEYE `true` DER `[KANIT]`

`schemaParser.ts:602-609`:
```ts
canParse(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  return startBytes.every((byte, index) => data[index] === byte);
}
```
`[].every(...)` **`true`** döner. **ÖLÇÜLDÜ:** `length-based-protocol`ın
`canParse`i registry'nin **899 örneğinin 899'unda** `true` dönüyor (%100).
Karşılaştırma: `custom-binary-protocol` 9 (çünkü `startBytes = [0xAA]`),
`delimiter-based-protocol` 10.

→ 18e bu tuzağa DÜŞMEMELİ: `[KARAR 18-5]`.

### ⚠️ BULGU 5 — `pcap.ts` VAR ama TÜKETİCİSİ YOK ve link-type tablosu ÜÇ GİRDİLİK `[KANIT]`

`protocol-core/capture/pcap.ts` (361 satır) klasik pcap dosya zarfını söküyor
ama `LINK_TYPE_NAMES` yalnız `{0: Null/Loopback, 1: Ethernet, 101: Raw IP}`
(`pcap.ts:88-92`), ve **`grep -rn "capture/pcap" src/` → HİÇBİR TÜKETİCİ YOK.**
Bu dalga onu tüketmez (Log Analyzer'ın işi, `pcap.ts:6-7`) ve **genişletmez.**
Ama link-type numaraları bu dalganın kapsam kararlarının KANITIDIR (aşağıda).

### ❌ BULGU 6 — 802.11 makinesi SIFIR `[KANIT]`

`grep -rni "802\.11|radiotap|dot11" src/ --include=*.ts` → **sıfır dosya.**
`wifi` ve `esp-now` tamamen yeni kod.

---

## `[KARAR 18-2]` KAPSAM — `wifi` (BU DALGANIN EN ÖNEMLİ KARARI)

### Karar

> **Girdi = ÇIPLAK IEEE 802.11 MAC çerçevesi, 4 baytlık FCS DAHİL.**
> Radiotap / PPI / Prism / AVS başlıkları ve pcap zarfı **KAPSAM DIŞI**.
> Üç sınıf da (Management / Control / Data) **BAŞLIK düzeyinde** çözülür;
> **GÖVDE yalnız Management çerçevelerinde** çözülür (18b).
> Data yükü ham kalır; `Protected = 1` ise "şifreli" damgası basılır ve
> ÖTEYE İNİLMEZ.

### Gerekçe 1 — RADİOTAP AYRIMI BİZİM İCADIMIZ DEĞİL, libpcap'in MİMARİSİ `[KANIT]`

`https://www.tcpdump.org/linktypes.html` (çekildi, tablo satırları birebir):

| LINKTYPE | № | Anlam |
|---|---|---|
| `LINKTYPE_IEEE802_11` | **105** | "IEEE 802.11 wireless LAN" — ÇIPLAK çerçeve |
| `LINKTYPE_IEEE802_11_PRISM` | 119 | Prism monitor bilgisi + 802.11 |
| `LINKTYPE_IEEE802_11_RADIOTAP` | **127** | "Radiotap link-layer information **followed by** an 802.11 header" |
| `LINKTYPE_IEEE802_11_AVS` | 163 | AVS monitor bilgisi + 802.11 |
| `LINKTYPE_PPI` | 192 | Per-Packet Information başlığı + paket |

**Beş ayrı link-type**, ve dördü "metadata + 802.11". Yani "802.11 çerçevesi"
ile "yakalama metadata'sı" AYRI KATMANLARDIR ve bunu libpcap söylüyor.
Wireshark'ın kendi mimarisi de ikiye ayırıyor: `packet-ieee80211.c` ve **ayrı
bir dosya** `packet-ieee80211-radiotap.c` (7.480 satır). Bu, dalga 17'nin
`dissector_add_uint("cnip.protocol", 0, lon_handle)` argümanının aynı biçimi:
**birinci sınıf kaynağın KENDİ mimarisi kapsam çizgisini çiziyor.**

Deponun spec'i de aynı yerden ayırıyor: *"RSSI/Channel/Center Freq/Bandwidth/
MCS/Spatial Streams/Guard Interval/PHY = capture adaptör metadata'sı (802.11
frame'in kendisi değil, **ayrı gösterilir**)"* `[KANIT]`
`docs/spec/ozet/09-kablosuz-iot.md:153`.

### Gerekçe 2 — ÖLÇÜLDÜ: FCS OLMADAN `canParse` YAZILAMAZ

899 örnek üzerinde (ayrıntı aşağıdaki tablo):

| İmza | Çakışma |
|---|---|
| Sınıf-farkındalıklı, **FCS'siz** (`W13`) | **216 / 899 (%24)** — KABUL EDİLEMEZ |
| Sınıf-farkındalıklı, **FCS'li** (`W12`) | **0 / 899** — TEMİZ |

**FCS bu kaydın var olabilmesinin TEK sebebidir.** Radiotap kapsama alınsaydı
girdi sözleşmesi belirsizleşir (radiotap uzunluğu değişken, FCS varlığı bir
radiotap BAYRAĞIDIR) ve ölçülebilir bir imza kalmazdı.

### Gerekçe 3 — ÖLÇEK: `packet-ieee80211.c` Wireshark'ın EN BÜYÜK dissector'ü

Çekilip satır sayıldı (2026-08-26):

| Dosya | Satır |
|---|---|
| **`packet-ieee80211.c`** | **64.051** |
| `packet-nas_5gs.c` | 18.393 |
| `packet-btatt.c` | 18.177 |
| `packet-bthci_cmd.c` | 14.031 |
| `packet-ieee802154.c` | 7.653 |
| `packet-ieee80211-radiotap.c` | 7.480 |

Karşılaştırma için dalga 17'nin TAMAMI (9 dosya, test dahil) **3.900 satır**.
802.11'i "hepsi" diye açmak, bir dalgada deponun 16 katını yazmaya kalkışmaktır.

### Gerekçe 4 — EMSAL

`ads-b` 1090ES-only · `iec-61162` `UdPbC`-only · `iec-61850` GOOSE-only ·
`lonworks` ISO/IEC 14908-4-only · `as-interface` klasik-only. Dar-kapsam
politikası kurulu: **SORMA, UYGULA** (CLAUDE.md "Bilinen borçlar").

### KAPSAM DIŞI — açıkça (18a/18b dosya başlarına yazılır)

- Radiotap / PPI / Prism / AVS başlıkları ve pcap zarfı (ayrı link-type)
- HT/VHT/HE/EHT **PHY** parametreleri (MCS, spatial stream, GI) — yakalama metadata'sı
- WPA/WPA2/WPA3 el sıkışması (EAPOL), PMKID, SAE — ayrı bir uygulama katmanı
- Şifre çözme (WEP/TKIP/CCMP/GCMP) — CLAUDE.md'nin anahtar kuralı
- A-MSDU / A-MPDU ayrıştırma, defragmentation — çerçeveler arası durum
  (dalga 16 bulgu 12: "çerçeveler arası durum PARSER'A GİRMEZ")
- Connection Timeline, Airtime & Channel Occupancy, Coexistence Analyzer —
  hepsi çok-çerçeveli; `tools` metin listesiyle "planlandı" kalır
  (`nb-iot`/`lte-modem-at` emsali, `wireless-iot.ts:398-408`)

---

## `[KARAR 18-1]` 802.15.4 MAC — ÇEKİRDEĞE ÇIKARILIR, ama YALNIZ KONTEYNER

> `zigbee.ts`in 802.15.4 MAC okuyucusu
> **`src/protocol-core/framing/ieee802154Frame.ts`**e taşınır ve `zigbee.ts` o
> modülü TÜKETİR. Taşınan: FCF bit alanları, sıra numarası, adresleme planı
> (`planMacAddressing`), adres biçimleme, **başlık uzunluğu hesabı**, FCS
> doğrulaması. **TAŞINMAYAN:** Zigbee'ye özel her şey (NWK/APS/ZCL) ve Thread'e
> özel **Auxiliary Security Header** — o `thread`in kendi modülünde yaşar.

**Emsal ve gerekçe:** `pulseLog.ts`in dalga 14g'deki taşınması birebir bu
biçim — *"yalnız KONTEYNERİN KENDİSİ taşındı; bit/nibble TÜREMESİ protokole
özeldir ve TAŞINMADI"* `[KANIT]` `protocol-core/decoding/pulseLog.ts:6-11`.
`hdlcCore.ts` de üç tüketicili bir çekirdek (CLAUDE.md dalga 16a notu).

**RİSK ve emniyet:** `zigbee` bugün `partial` ve **106 örnek çerçevesi** var;
taşımanın `zigbee.test.ts`i KIRMAMASI şarttır. 18d'nin ilk görevi taşımadır ve
taşımadan SONRA `npm test` TAM koşar. Kırılırsa **taşımadan vazgeç**, Thread
kendi okuyucusunu yazsın — `ccp.ts`in reddettiği zorlama birleştirme
(CLAUDE.md dalga 16a notu) burada da geçerlidir.

---

## `[KARAR 18-3]` KAPSAM — `thread`

> **Girdi = TAM 802.15.4 MAC çerçevesi + FCS** (zigbee ile AYNI sözleşme).
> Zincir: 802.15.4 MAC (+ Aux Security Header) → **6LoWPAN** (Mesh / FRAG1 /
> FRAGN / IPHC / sıkıştırılmamış IPv6) → IPv6 → UDP → **MLE SINIFLANDIRMASI**.
> **MLE gövdesi ŞİFRELİDİR ve ÇÖZÜLMEZ** — yalnız Security Suite baytı,
> Auxiliary Security Header ve şifresiz iki mesaj (Discovery Request /
> Discovery Response) çözülür.

### Gerekçe — MLE şifreliliği ÖLÇÜLMÜŞ bir olgudur

Normatif kaynak `draft-kelsey-intarea-mesh-link-establishment-06` §5/§14.1:
Security Suite baytı **`0` = 802.15.4 Security (ŞİFRELİ)**, **`255` = No
Security**. Wireshark aynısını söylüyor `[KANIT]` `packet-mle.c:209-213`
(`{0, "802.15.4 Security"}, {255, "No Security"}`).

**OpenThread'de şifresiz gönderilen SADECE İKİ komut var** `[KANIT]`
`openthread/src/core/thread/mle.cpp:3565-3568`:
```cpp
if ((aCommand == kCommandDiscoveryRequest) || (aCommand == kCommandDiscoveryResponse))
{ securitySuite = kNoSecurity; }
```

Yani Parent Request/Response, Child ID Request/Response, Advertisement, Link
Request/Accept — **katalog `tools`unun saydığı MLE sınıflandırıcısının tüm
kalemleri şifrelidir.** Anahtar olmadan çözülemez, CLAUDE.md kuralı gereği
UYDURULMAZ.

### 🚨 TUZAK — OpenThread'in KENDİ YORUMLARI TERS `[KANIT]`

`openthread/src/core/thread/mle.hpp:1498-1502`:
```cpp
enum SecuritySuite : uint8_t
{
    k154Security = 0,   // "...MLE message is not secured."   ← YORUM YANLIŞ
    kNoSecurity  = 255, // "...MLE message is secured."       ← YORUM YANLIŞ
};
```
**Adlar doğru, yorumlar takas edilmiş.** Kod doğruyu söylüyor:
`mle.cpp:3575` `if (securitySuite == k154Security) { SecurityHeader ...; }`
(aux başlığı YALNIZ 0 için ekliyor), `mle.cpp:1593`
`if (securitySuite == kNoSecurity)` (komut baytını doğrudan okuyor).

> **Bu, dalga 17'nin "aynı dosyadaki YORUM ile KOD ayrışabilir; KOD kazanır"
> dersinin ÜÇÜNCÜ vakasıdır** (`LtIpPackets.h:264` ve `packet-lon.c:395`ten
> sonra). Ders artık üç bağımsız kaynakta gerçekleşti — kural, tavsiye değil.

### Kapsam dışı — açıkça

- **MLE/802.15.4 şifre çözme** (anahtar gerekir)
- **Fragment reassembly** — çerçeveler arası durum (dalga 16 bulgu 12); FRAG1/
  FRAGN başlıkları ÇÖZÜLÜR, birleştirme YAPILMAZ
- **Mesh Topology Graph, Border Router Analyzer, RSSI/Link Margin Trend** —
  `tabs`ta `timing`/`data` zaten YOK
- **LOWPAN_HC1 (dispatch `0x42`)** — RFC 4944 §10'un ESKİ sıkıştırması, RFC 6282
  IPHC'siyle DEĞİŞTİRİLDİ, Thread KULLANMAZ. Gerçek yakalamada **331 çerçevenin
  33'ü** HC1; ham + uyarı bırakılır (ölçüm aşağıda)
- **Thread Network Data / MeshCoP / TMF CoAP TLV'leri** — `packet-thread.c`in
  202 KB'lık alanı; ayrı bir dalga, bu dalgada YOK

---

## `[KARAR 18-4]` KAPSAM — `esp-now`: `wifi` ile PAYLAŞIR

> `esp-now` 18a'nın `dot11Frame.ts`ini ve 18b'nin element yürüyücüsünü
> **TÜKETİR**; 802.11 MAC başlığını yeniden yazmaz.
> `xcpPacket.ts` sınıfı PAYLAŞIM, `ccp.ts` sınıfı AYRILIK DEĞİL.

**Gerekçe — paylaşım bir tercih değil, protokolün tanımı:** Espressif'in kendi
çerçeve şeması `[KANIT]`
`https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html`:

```
| MAC Header | Category Code | Organization Identifier | Random Values | Vendor Specific Content | FCS |
   24 bytes       1 byte              3 bytes                4 bytes            7-x bytes       4 bytes
```

İlk 24 bayt **birebir 802.11 MAC başlığıdır** (FC 2 + Duration 2 + A1/A2/A3
6×3 + SeqCtl 2 = 24) ve son 4 bayt **birebir 802.11 FCS'idir**. Kaynak metin
bunu ayrıca yazıyor: *"the FromDS and ToDS bits of FrameControl field are both
0. The first address field is set to the destination address. The second …
source address. The third … broadcast (0xff:…:ff)"*. `ccp.ts`in reddettiği
"benzer görünen ama ayrı tel" durumu DEĞİL — **aynı telin ta kendisi.**

---

## `[KARAR 18-5]` KAPSAM — `rf-telemetry-custom-frame`: MOTOR DEĞİL, YAPILANDIRILABİLİR ÇERÇEVE

> Bu bir protokol **değil**, bir **profil çalıştırıcısıdır**. Motor
> `createSchemaParser`/`encodeWithSchema` üstüne kurulur; kayıt bir
> **varsayılan profil** (spec §3.9'un çerçevesi) ve `decodeOptions`la
> seçilebilen bir profil kümesi taşır.
> **`canParse` VARSAYILAN PROFİLİN imzasına bağlanır** (`custom-binary-protocol`
> emsali), `startBytes` BOŞ BIRAKILMAZ.

### 🚨 TUZAK — SPEC'İN KENDİ ÖRNEĞİ ARİTMETİK OLARAK DOĞRULANAMIYOR

Spec `docs/spec/ozet/09-kablosuz-iot.md:171` şu çerçeveyi veriyor:

```
AA AA AA 2D D4 01 14 04 34 12 78 56 C9 21
Preamble AA AA AA · Sync 2D D4 · Device 01 · Type 14 · Length 04 ·
Data 34 12 78 56 · CRC C9 21
```

**ÖLÇÜLDÜ (bu keşif turunda, brute force):**

| Deneme | Sonuç |
|---|---|
| 17 standart CRC-16 (katalogdakiler + MCRF4XX/RIELLO/AUG-CCITT/TELEDISK/T10DIF/CDMA2000) × 6..12 arası **tüm** bayt aralıkları × `C9 21` ve `21 C9` hedefleri | **SIFIR eşleşme** |
| 65.535 polinomun TAMAMI × {init 0, FFFF} × {refl, no-refl} × {xorout 0, FFFF} × 5 makul aralık | 67 eşleşme, **hepsi rastgele/tanınmayan polinom** (0x06A9, 0x2059, 0x4573 …) |

Aynı bölümün whitening örneği (`wire A7 39 → dewhitened 01 10`, yani whitening
dizisi `A6 29`) de **hiçbir 9-bit LFSR PN9 varyantıyla** (512 seed × 8 tap ×
LSB/MSB çıkış = 8.192 kombinasyon) ve **hiçbir BLE kanal whitening'iyle**
(40 kanal) üretilemiyor: **0 eşleşme.**

> **KARAR:** spec'in bu iki örneği **AÇIKLAYICIDIR, DOĞRULANMIŞ FIXTURE
> DEĞİLDİR.** 18e onları `expectedValid: true` bir CRC fixture'ı olarak
> KULLANAMAZ. Doğru yol: aynı ALAN YERLEŞİMİNİ koru, CRC'yi katalogdan seçilen
> bir algoritmayla **kendin hesapla**, örnek çerçeveyi o değerle üret ve
> açıklamasına *"spec'in `C9 21`i yeniden üretilemedi; alan düzeni spec'ten,
> CRC değeri motordan"* yaz.
>
> **Bu, dalga 17'nin "keşfin elle çözdüğü her çerçeve şüphelidir" dersinin
> DÖRDÜNCÜ vakası ve ilk kez ŞÜPHELİ OLAN ŞEY DEPONUN KENDİ SPEC'İ.**

---

## `[KARAR 18-7]` `definitions: ['custom-schema']` — panel YOK, ve bu MAYIN DEĞİL

`ProtocolPage.tsx:106-109`:
```ts
const DEFINITION_PANELS: Partial<Record<DefinitionFormat, typeof DbcPanel>> = {
  dbc: DbcPanel,
  eds: EdsPanel,
};
```

`custom-schema` YOK. Katalogda **19 kayıt** `definitions: ['custom-schema']`
taşıyor ve **hepsi** "planlandı" basıyor — `ble-gatt` (`ready`!),
`marine-j1939`, `interfaces-framing`in dört jenerik kaydı, `aerospace`in
kayıtları… `[KANIT]` `grep -rn "custom-schema" src/`.

→ `rf-telemetry-custom-frame`in `definitions` sekmesi de "planlandı" basacak ve
**BU DOĞRU DAVRANIŞTIR.** `lonworks`un `xif`i ile birebir aynı sınıf
(CLAUDE.md dalga 17 notu); emsal `ble-gatt`, `ready` rozetli ve aynı boş
paneli taşıyor. **18e bir `CustomSchemaPanel` YAZMAZ** — bu ayrı bir iş ve
19 kaydı birden etkiler; domain'i KAPATAN dalgada ikinci bir motor riski
artırır (`[Karar 15h-1]` gerekçesi).

---

## `canParse` — ÖLÇÜM, sonra karar

**Registry bugün: 144 kayıt, 899 örnek çerçeve** (2026-08-26, KODDAN ölçüldü;
`createProtocolRegistry` + `registerBuiltInProtocols` + `loadProtocolPlugin`,
tek kullanımlık vitest script'i — dalga 17'nin uygulama turu ölçümüyle BİREBİR
aynı, çünkü o turdan sonra registry'ye ekleme olmadı).
Uzunluk bağlamı: **746** örnek ≥ 5 B, **275** ≥ 24 B, **188** ≥ 36 B.

### `thread`

| # | İmza | Çakışma | Değerlendirme |
|---|---|---|---|
| T1 | 802.15.4 Data çerçevesi (`(b0 & 7) === 1`, n ≥ 5) — *`zigbee.canParse`in bugünkü hâli* | **138 / 899** | KABUL EDİLEMEZ |
| T2 | T1 + MAC yükünün ilk baytı herhangi bir 6LoWPAN dispatch (NALP değil) | 19 / 899 | KABUL EDİLEMEZ |
| T3 | T1 + dispatch ∈ {IPv6 0x41, IPHC 011x, MESH 10xx, FRAG1 11000x, FRAGN 11100x} | 18 / 899 | KABUL EDİLEMEZ |
| **T4** | **T3 + FCS (`CRC16_KERMIT`) GEÇERLİ** | **0 / 899** | **SEÇİLEN** |
| T4b | T4 ama MAC frame type serbest | 0 / 899 | (T4 daha dar, T4 seçildi) |
| T5 | 6LoWPAN yükü TEK BAŞINA, IPHC | 67 / 899 | girdi sözleşmesi 6LoWPAN OLAMAZ |
| T6 | 6LoWPAN yükü TEK BAŞINA, herhangi Thread dispatch'i | **245 / 899 (%27)** | girdi sözleşmesi 6LoWPAN OLAMAZ |
| T7 | YALNIZ FCS geçerliliği | 8 / 899 | (7'si `zigbee`in KENDİ örneği) |

### → **KARAR: `thread.canParse` `true` DÖNER.** İmza = T4.

**İki bağımsız kümede doğrulandı:**
- deponun 899 örneği → **0 yanlış pozitif**
- gerçek yakalamanın 331 çerçevesi → **298 doğru pozitif (%90,0)**;
  reddedilen **33'ün TAMAMI** dispatch `0x42` = LOWPAN_HC1, yani
  `[KARAR 18-3]`ün bilinçli kapsam dışısı. Yanlış negatif YOK.

> **T5/T6 kapsam kararının İKİNCİ AYAĞIDIR** (dalga 17'nin 0-vs-401 deseni):
> girdi "yalnız 6LoWPAN yükü" olsaydı `canParse` YAZILAMAZDI (245 çakışma).
> 802.15.4 MAC + FCS sözleşmesi bu yüzden zorunludur.

> **T1 ile T4 arasındaki fark bir UYARIDIR:** `zigbee.canParse` bugün 899
> örneğin **524'ünde** `true` diyor ve **her Thread çerçevesini de sahiplenir.**
> Bu bir HATA DEĞİL (ikisi aynı MAC'i paylaşıyor) ama 18d'nin bekçi testi bunu
> AÇIKÇA ölçmeli: ayırıcı YALNIZ MAC yükünün ilk baytıdır. Zigbee NWK Frame
> Control baytı yapısal olarak `00xxxxxx` (NALP) aralığına düşüyor — ölçüldü,
> ama bu bir GARANTİ değil, bir GÖZLEMDİR.

### `wifi`

| # | İmza | Çakışma | Değerlendirme |
|---|---|---|---|
| W1 | n ≥ 24 && protokol sürümü 0 | **110 / 899** | KABUL EDİLEMEZ |
| W2 | W1 + type ∈ {0,1,2} | 102 / 899 | KABUL EDİLEMEZ |
| W3 | n ≥ 36, yönetim, ToDS=FromDS=0 | 27 / 899 | KABUL EDİLEMEZ |
| W4 | W3 + alt tip bilinen kümede | 22 / 899 | KABUL EDİLEMEZ |
| W11 | W4 + Duration < 0x8000 + öteki FC bayrakları 0 | 10 / 899 | KABUL EDİLEMEZ |
| W13 | **Sınıf-farkındalıklı, FCS'SİZ** | **216 / 899 (%24)** | KABUL EDİLEMEZ |
| W5 | W4 + A3 broadcast ya da A3 = A2 | 0 / 899 | **REDDEDİLDİ** — Auth/AssocReq'te A3 ≠ A2, yanlış NEGATİF üretir (gerçek yakalamada doğrulandı) |
| W6 | W4 + FCS CRC-32 | 0 / 899 | (W12 daha geniş) |
| W14 | Yönetim + FCS, alt tip kapısı yok | 0 / 899 | (W12 daha geniş) |
| W9/W10 | Yalnız FCS CRC-32 | 1 / 899 (`ethernet-ii/fcs-opportunistic-match`) | tek başına yetmez |
| **W12** | **Protokol sürümü 0 + sınıf-farkındalıklı asgari uzunluk (Mgmt/Data 28, Ctrl ACK/CTS 14, öteki Ctrl 20) + FCS CRC-32 GEÇERLİ** | **0 / 899** | **SEÇİLEN** |

### → **KARAR: `wifi.canParse` `true` DÖNER.** İmza = W12.

**İki bağımsız kümede doğrulandı:**
- deponun 899 örneği → **0 yanlış pozitif**
- `wpa-Induction.pcap`ın 1093 çerçevesi → **1080 doğru pozitif (%98,8)**;
  reddedilen 13'ün hepsi GERÇEKTEN bozuk (protokol sürümü 2/3, FCS FAIL).
  Yakalamanın kendisinde bozuk çerçeve var; imza onları doğru reddediyor.

> `W9/W10`'un tek çakışması olan `ethernet-ii/fcs-opportunistic-match` 26 B ve
> W12'nin asgari uzunluğunu (28) geçemiyor. **Bu ince bir marj:** 28+ baytlık
> bir Ethernet çerçevesi tesadüfen geçerli CRC-32 kuyruğu taşırsa W12 de onu
> alır. Olasılık 2⁻³²'dir; bekçi testi sayıyı SABİTLER, sıfırlanırsa haber verir.

### `esp-now`

| # | İmza | Çakışma |
|---|---|---|
| E4 | Yalnız `b0 === 0xD0` (Action alt tipi) | 3 / 899 (`sae-j1850-vpw` ×3) |
| E3 | Yalnız `b[24] === 0x7F` (Category 127) | **0 / 899** |
| **E1** | **`b0 = 0xD0` + ToDS=FromDS=0 + `b[24] = 0x7F` + `b[25..27] = 18 FE 34` + n ≥ 39** | **0 / 899** |
| E2 | E1 + `b[32] = 0xDD` + `b[34..36] = 18 FE 34` + `b[37] = 0x04` | **0 / 899** |

### → **KARAR: `esp-now.canParse` `true` DÖNER.** İmza = **E1**.

E2 de temiz ama **E1 SEÇİLİYOR**: E2 tek bir vendor-specific element'in
konumunu sabitler; Espressif'in v2.0 çerçevesi **altıya kadar** element
taşıyabilir ve `Random Value`dan sonraki ilk element'in ofseti (32) yalnız
"tek element" varsayımında sabittir. E1 zaten Category + OUI ile 0 çakışma
veriyor; ofset varsayımı EKLEMEYE gerek yok. *(`canParse` ucuz ön elemedir —
`schemaParser.ts:606-607`in kendi kuralı.)*

**Not:** E1 **FCS gerektirmiyor** ve yine de 0. Yani `esp-now`, `wifi`den farklı
olarak FCS'siz girdide de auto-detect edilebilir. **Buna rağmen girdi sözleşmesi
FCS'li kalır** — Espressif'in şeması FCS'i çerçevenin parçası sayıyor ve
`wifi` ile aynı sözleşmede kalmak `dot11Frame.ts` paylaşımını mümkün kılar.

### `rf-telemetry-custom-frame`

| # | İmza | Çakışma |
|---|---|---|
| R1 | `b0 = 0xAA && b1 = 0xAA` (varsayılan profilin preamble'ı) | **0 / 899** |
| R2 | İlk 12 baytta `2D D4` sync sözcüğü | **0 / 899** |
| R3 | Yalnız spec'in uzunluk formülü (`n === 3+2+3+b[7]+2`) | 12 / 899 |
| R4 | `createSchemaParser` varsayılanı (boş `startBytes`) | **899 / 899 (%100)** 🚨 |

### → **KARAR: `rf-telemetry-custom-frame.canParse` `true` DÖNER**, imza = **R1 + R2** (preamble VE sync sözcüğü), **`false` DEĞİL.**

Gerekçe: `custom-binary-protocol` emsali — o da yapılandırılabilir bir kayıttır
ve `startBytes = [0xAA]`la `canParse` yazar (9 çakışma). Buradaki varsayılan
profil DAHA DAR bir imza veriyor (0 çakışma). **Kullanıcı şemayı değiştirince
`parse` değişir ama `canParse` VARSAYILAN PROFİLİN imzası olarak kalır** —
`canParse` auto-detection içindir, `DecodePanel` zaten `parser.parse`ı doğrudan
çağırır (`DecodePanel.tsx:389-390`), `canParse`ı hiç sormaz.

> **R4 bir MAYIN ve 18e onu ETKİSİZLEŞTİRMEK ZORUNDA.** `createSchemaParser`
> doğrudan kullanılırsa (`length-based-protocol` gibi) kayıt registry'nin
> **tamamını** sahiplenir. 18e ya kendi `canParse`ını yazar ya da şemaya
> `framing.startBytes = [0xAA, 0xAA, 0xAA, 0x2D, 0xD4]` koyar.
> **`length-based-protocol`ın 899/899'u bu dalgada DÜZELTİLMEZ** — ayrı bir
> kayıt, ayrı bir borç; bu brif onu yalnız KAYDEDER.

### Bekçi testleri — dört dosya, ÜÇ YÖNLÜ (dalga 16c/17 deseni)

Her kayıt için `<x>CanParseRegistry.test.ts` (`lonworksCanParseRegistry.test.ts`
emsali, 153 satır):

1. **İleri:** registry'nin TÜM örneklerinde seçilen imza → **0** çakışma
   (kayıt/örnek sayısı `registeredProtocolIds()`ten TÜRETİLİR, sabit değil).
2. **Ters:** reddedilen naif imza AYNI kümede eşiği aşıyor — `thread` için
   T1 `≥ 130`, `wifi` için W13 `≥ 200`, `rf-telemetry` için R4 `= örnek sayısı`.
   *"Yazılsaydı kaç çerçeve çalardı"* kanıtı.
3. **Kendi üzerinde:** kaydın TÜM örneklerinde `canParse` `true` — bozuk
   örnekler dahil (`canParse` *"biçim bu mu"*dur, *"geçerli mi"* değil).

---

## Kaynak durumu — kayıt kayıt

### `thread` — spec FORM-KAPILI, ama uygulama BSD-3 ve AÇIK

| # | Kaynak | Sınıf | Not |
|---|---|---|---|
| 1 | **OpenThread**, BSD-3-Clause 🏆 | **BİRİNCİ (uygulama)** | `openthread/openthread/main` — `src/core/thread/mle_types.hpp` (35 KB, `kUdpPort`, `SecuritySuite`), `mle.hpp` (110 KB), `mle.cpp` (182 KB), `mac/mac_frame.hpp` (36 KB), `thread/lowpan.hpp/.cpp` (26+37 KB), `key_manager.hpp` |
| 2 | **RFC 4944** (6LoWPAN çerçeveleme) 🏆 | **NORMATİF** | Dispatch tablosu §5.1, Mesh Header §5.2, FRAG1/FRAGN §5.3 — hepsi bu brifte alıntılı |
| 3 | **RFC 6282** (IPHC) 🏆 | **NORMATİF** | `011 TF NH HLIM CID SAC SAM M DAC DAM` taban kodlaması §3.1 |
| 4 | **`draft-kelsey-intarea-mesh-link-establishment-06`** 🏆 | **NORMATİF (MLE)** | §5 Security Suite, §8 UDP 19788 + Hop Limit 255, §14.1 IANA alt kaydı |
| 5 | **Wireshark `packet-mle.c`** (99 KB) | ÇAPRAZ TEYİT | ⚠️ MLE **BURADADIR**, `packet-thread.c`te DEĞİL |
| 6 | Wireshark `packet-6lowpan.c` (162 KB) / `packet-ieee802154.c` (337 KB) | ÇAPRAZ TEYİT | dispatch sabitleri `packet-6lowpan.c:50-58` |
| 7 | **GERÇEK YAKALAMA — `6LoWPAN.pcap.gz`** 🏆 | **DOĞRULAMA** | Wireshark SampleCaptures; **331 gerçek 802.15.4 çerçevesi**, FCS 331/331 DOĞRU |
| 8 | `6lowpan-rfrag-icmpv6.pcapng` (DLT 283 TAP) | DOĞRULAMA | 6LoWPAN RFRAG + ICMPv6 |
| 9 | `zigbee-join-authenticate.pcap.gz` (DLT 195) | DOĞRULAMA | 802.15.4 + güvenlik başlıkları (Zigbee, Thread değil) |
| — | **Thread Specification 1.4.1** | **ULAŞILAMADI** | `threadgroup.org/ThreadSpec` bir **KAYIT FORMU**dur: ad/soyad/e-posta/şirket/telefon + CAPTCHA + EULA; PDF **filigranlı** ve **yeniden dağıtımı YASAK** (*"you shall not: 1) loan, rent, lease, sublicense, sell…"*). Ücretsiz ama ANONİM URL YOK. |

> **⚠️ 7 numaralı satır bir DÜZELTMEDİR ve önemlidir.** `6LoWPAN.pcap`in pcap
> global başlığı `LINKTYPE = 1` (Ethernet) der ve bu yüzden "802.15.4 yakalaması
> değil" diye ELENEBİLİR. **Elenmemeli:** 802.15.4 çerçeveleri **ZEP (Zigbee
> Encapsulation Protocol) v2** ile UDP içinde taşınıyor — `"EX"` sihirli
> sözcüğü + 32 baytlık ZEP başlığı, sonra ham 802.15.4 çerçevesi.
> Bu keşif turu 331 çerçevenin hepsini çıkardı ve **FCS'lerini doğruladı.**
> **Ders: bir yakalamanın link-type'ı "içinde ne var" sorusunun cevabı DEĞİLDİR.**

> **GERÇEK THREAD MESH YAKALAMASI YOKTUR.** Wireshark wiki'sindeki
> `ThreadCommissioning-JPAKE-DTLS-*.pcapng` dosyaları **DLT 1 (Ethernet)** ve
> içleri DTLS-JPAKE el sıkışmasıdır — sıfır 802.15.4 çerçevesi, sıfır MLE.
> OpenThread depoları, Wireshark `test/captures/` (227 dosya) ve
> `Holy-Grail-PCAP` tarandı: yok. Üretmenin yolu `openthread/pyspinel`in
> sniffer'ı + gerçek 802.15.4 donanımıdır. **Bu bir sonraki nesil için
> yazılıyor: TEKRAR ARAMA.**

### `wifi` — kaynak BOL, sorun ölçek

| # | Kaynak | Sınıf | Not |
|---|---|---|---|
| 1 | **IEEE Std 802.11** (2020/2024) | NORMATİF | IEEE GET Program'dan ücretsiz; `standards.ieee.org` ve `ieeexplore` bot filtresi döndürüyor (403/418), **elle indirilebilir** `[BEKLENTİ — uygulamada doğrulanacak]` |
| 2 | **Wireshark `packet-ieee80211.c`** (64.051 satır) 🏆 | BİRİNCİ (uygulama) | Deponun karşılaştığı en büyük dissector; **`register_dissector("wlan_withfcs"/"wlan_withoutfcs")` :63466-63467** FCS ikiliğini KAYNAK DÜZEYİNDE kanıtlıyor |
| 3 | **`www.tcpdump.org/linktypes.html`** 🏆 | NORMATİF (kapsam) | 105/119/127/163/192 — radiotap ayrımının kanıtı |
| 4 | **GERÇEK YAKALAMA — `wpa-Induction.pcap`** 🏆 | **DOĞRULAMA** | DLT 127, **1093 çerçeve**, FCS 1080 DOĞRU; Beacon 398 · ProbeReq 13 · ProbeResp 26 · Auth 2 · AssocReq 1 · AssocResp 1 · Disassoc 1 · Data 286 · Ctrl 356 — **tam bağlantı zinciri tek dosyada** |
| 5 | Deponun kendi spec'i | KAPSAM | `ozet/09:141-155` — zaten "PCAP/monitor-mode log analizi YETERLİ, full RF demod ŞART DEĞİL" diyor |

### `esp-now` — tescilli ama BİRİNCİ TARAFTAN TAM BELGELİ

| # | Kaynak | Sınıf | Not |
|---|---|---|---|
| 1 | **ESP-IDF Programming Guide "ESP-NOW → Frame Format"** 🏆 | **BİRİNCİ TARAF, NORMATİF** | Bayt bayt şema; bu brifte birebir alıntılı |
| 2 | **`esp-idf/components/esp_wifi/include/esp_now.h`**, Apache-2.0 | BİRİNCİ TARAF (kod) | `ESP_NOW_MAX_DATA_LEN` / `_V2` / `ESP_NOW_MAX_IE_DATA_LEN`, `esp_now_set_pmk`, `esp_now_get_version` |
| 3 | Deponun kendi spec'i `ozet/09:157-165` | ÇAPRAZ TEYİT | Category 127, OUI 18:FE:34, Element 221, Type 4 — **hepsi Espressif'le ÖRTÜŞÜYOR** |
| — | Gerçek ESP-NOW yakalaması | **BULUNAMADI** | Örnek çerçeveler TÜRETİLECEK ve `[BEKLENTİ]` işaretlenecek |

**Espressif belgesinin İÇ TUTARLILIĞI kontrol edildi ve TUTUYOR:**
element başına ek yük 7 B (ID 1 + Len 1 + OUI 3 + Type 1 + Ver 1);
v1.0 `x = 250 + 7 = 257` ✓; v2.0 `x = 1470 + 6×7 = 1512` ✓ (altı element).
`Length` alanı = OUI + Type + Ver + Body = **5 + gövde**, azami 255 → gövde ≤ 250 ✓.

### `rf-telemetry-custom-frame` — "kaynak" sorusu YANLIŞ SORU

Yayımlanmış bir tel biçimi YOKTUR (kaydın tanımı bu). Kaynaklar:
- Deponun spec'i `ozet/09:167-175` — alan yerleşimi, metadata listesi,
  whitening/Manchester tanımları. **Sayısal örnekleri DOĞRULANAMADI**
  (`[KARAR 18-5]`).
- Deponun KENDİ şema motoru (`protocolSchema.ts` başı §9.6'nın "AYNEN" kilidi).
- PN9/CC1101 whitening ve Manchester kodlaması için **açık, standart** LFSR
  tanımları — 18e brifinde.

---

## Checksum — katalog eklemesi **SIFIR**, ama ÜÇ SAHTE DOST VAR

Katalog bugün **38 giriş** (`CrcCalculatorTool.test.tsx:83`, DOSYADAN
doğrulandı — dalga 15'in "satır numarası kayar" uyarısı burada da geçerliydi ve
kaymamış).

| Kayıt | Gereken | Katalogda | Sahte dost |
|---|---|---|---|
| `thread` | 802.15.4 FCS | ✅ `CRC16_KERMIT` | poly `0x1021` katalogda **BEŞ** girdide: `CCITT_FALSE`, `GENIBUS`, `XMODEM`, `X25`, `KERMIT`. **Yalnız KERMIT** 802.15.4 FCS'idir (init 0, refin/refout, xorout 0). CLAUDE.md dalga 16a dersinin aynısı. |
| `wifi`, `esp-now` | 802.11 FCS | ✅ `CRC32` | **`CRC32C`** (Castagnoli, poly `0x1EDC6F41`) katalogda hemen yanında (`crcCatalogue.ts:464-471`) ve **aynı genişlik, aynı init, aynı yansıma, aynı xorout** — YALNIZ polinomda ayrılıyor. Hata VERMEDEN yanlış PASS/FAIL basar. |
| `rf-telemetry` | kullanıcı seçer | ✅ 38'i de | spec'in `C9 21`i **hiçbirini** üretmiyor (`[KARAR 18-5]`) |

**Doğrulama zaten yapıldı:** ikisi de gerçek yakalamada ölçüldü (331/331 ve
1080/1093). Yeni bir `check` fixture'ı gerekmiyor; **`CrcCalculatorTool.test.tsx:83`
38'de KALIR ve dokunulmaz.**

---

## Fixture zinciri — SON KAYITLAR ve `skip`e DÜŞÜŞ

**BUGÜN (KODDAN doğrulandı, `allEntries()` üzerinde koşturuldu):**

Motorsuz aday sırası — TAM LİSTE, dördü de bu dalganın konusu:
```
1. wireless-iot/mesh-smart-home/thread          ← iki bekçinin BUGÜNKÜ hedefi
2. wireless-iot/wifi-wireless/wifi
3. wireless-iot/wifi-wireless/esp-now
4. wireless-iot/custom-rf/rf-telemetry-custom-frame
```

| Bekçi | Bugünkü hedef | Dalga 18 bitince |
|---|---|---|
| `src/pages/ProtocolPage.test.tsx:33-40` | `wireless-iot/mesh-smart-home/thread` | **AÇIKÇA `skip`** |
| `e2e/nmea-decode.spec.ts:34-46` | `wireless-iot/mesh-smart-home/thread` | **AÇIKÇA `skip`** |

`e2e` bekçisi önce `marine-navigation`da arıyor; **orada aday KALMADI** (KODDAN
ölçüldü) ve katalog geneline düşüyor.

### ✅ `skip` yolu KODDAN DOĞRULANDI — sessiz yeşile DÜŞMÜYOR

```
ProtocolPage.test.tsx:79   it.skipIf(PLANNED_PATH === undefined)(
e2e/nmea-decode.spec.ts:279  test.skip(
e2e/nmea-decode.spec.ts:280    PLANNED_DECODE_PATH === undefined,
```

İkisi de `undefined` olduğunda **rapor edilen bir `skipped`** üretir; testin
gövdesi hiç koşmaz, `expect` sayısı sıfırlanmaz, "yeşil" görünmez —
**"skipped" görünür.** Dalga 16a'nın kurduğu türetme bunu KAPSIYOR.

> **Alt dalga sırası boyunca hedef KAYAR** (thread → wifi → esp-now →
> rf-telemetry, hangi sırayla motor alırlarsa) ve **SONUNCUSU alınınca ikisi de
> `skip`e düşer. KAYMASI ve SONUNDA SKIP OLMASI BEKLENEN DAVRANIŞTIR.**
> **KIRILIRSA RAPOR ET, DÜZELTME. Bekçiyi ELLE bir yola SABİTLEME.**
> Deponun kalan sabit-yol mayını: **SIFIR** (dalga 16'nın taraması). Bu dalga
> yeni bir tane EKLEMEZ.

> **Dalga 18'in SON alt dalgasında ZORUNLU GÖREV:** iki bekçinin GERÇEKTEN
> `skipped` raporladığını KOŞTURARAK doğrula (`npx vitest run
> src/pages/ProtocolPage.test.tsx` çıktısında `skipped`, `npx playwright test
> e2e/nmea-decode.spec.ts` çıktısında `skipped`). **Yeşil geçmesi YETMEZ** —
> `skipIf` yanlış çalışsa da yeşil geçerdi.

---

## Beklenen rozetler

| Kayıt | Rozet | Gerekçe (ilgili `.ts` dosya başına yazılır) |
|---|---|---|
| `wifi` | **`partial`** | Şifreli gövde çözülmez · radiotap/PHY metadata ayrı link-type · A-MSDU/A-MPDU/defrag çerçeveler arası · EAPOL el sıkışması yok · Connection Timeline/Airtime/Coexistence stateful |
| `esp-now` | **`ready`** | Tel biçimi birinci taraftan TAM belgeli, çözüm eksiksiz; CCMP'li gövdenin çözülememesi **katalogun KENDİ vaadidir** (*"payload unavailable without keys"*, `wireless-iot.ts:293`) — eksik iş değil. **Çürütme koşulu:** uygulama turu doğrulayıcı bir örnek (gerçek yakalama ya da ESP32'den üretilmiş) BULAMAZSA **`partial`e düş** ve gerekçeyi yaz. |
| `thread` | **`partial`** | MLE gövdesi şifreli (yalnız Discovery Req/Resp okunur) · fragment reassembly çerçeveler arası · HC1 desteklenmez · gerçek Thread yakalaması YOK · topoloji/border-router analizörleri stateful |
| `rf-telemetry-custom-frame` | **`partial`** | `custom-schema` `definitions` paneli YOK (19 kaydın ortak borcu) · Unknown RF Protocol Analyzer çok-çerçeveli · RF metadata çerçevede yok, `decodeOptions` kanalı · spec'in sayısal örnekleri doğrulanamadı |

**Domain toplamı (dalga 18 sonrası, BEKLENTİ):**
16 kayıt = **6 `ready` + 7 `partial` + 3 alias**, `planned` **SIFIR**.
Bugün: 5 `ready` / 7 `planned` / 4 `partial` / 3 alias (KODDAN ölçüldü).
`[BEKLENTİ — kapanışta KODDAN doğrulanacak]`

---

## Alt dalga sıralaması + model/effort

| # | Kayıt | Neden bu effort | Öneri |
|---|---|---|---|
| **18a** | `wifi` (1/2) — MAC katmanı | Kapsam kararı VERİLDİ ama girdi sözleşmesi, adres rol matrisi (ToDS×FromDS×type), sınıf başına değişken başlık uzunluğu ve `dot11Frame.ts`in **iki tüketicili** API'si tasarım kararıdır; yanlış API 18b ve 18c'yi de zehirler | **Opus · xhigh** |
| **18b** | `wifi` (2/2) — yönetim gövdeleri + IE | Tarif net (IE = TLV), yol belli; hacim var ama her adım basit. RSN IE'nin iç içe sayaç zinciri tek incelikli yer | **Opus · high** |
| **18c** | `esp-now` | Tel biçimi bayt bayt belgeli, iki modülü tüketiyor; tek karar "hangi element'e kadar" | **Sonnet · high** |
| **18d** | `thread` | `zigbee.ts`ten çekirdek ÇIKARMA (regresyon riski) + beş dallı 6LoWPAN dispatch zinciri + şifreli/şifresiz MLE ayrımı + doğrulama yakalamasının olmaması | **Opus · xhigh** |
| **18e** | `rf-telemetry-custom-frame` | Var olan motorun montajı, ama iki yeni parça (dewhitening, Manchester) + `canParse` mayını + spec örneklerinin çürümesi karar gerektiriyor | **Opus · high** |

**Fable: GEREKMİYOR** — hiçbir alt dalgada Opus'un yetmediği bir muhakeme yok.

---

## `decodeOptions` — kanal tahminleri (CÖMERT, dalga 17 dersi)

| Alt dalga | Kanal | Tahmin | Örnek kanallar |
|---|---|---|---|
| 18a | 4-6 | **6** | `fcsPresent`, `addressFormat`, `qosPresent`, `htControlPresent`, `frameClassFilter`, `protectedPayloadDisplay` |
| 18b | 2-4 | **4** | `ieProfile` (hangi IE kümesi adlandırılsın), `vendorOuiLabels`, `rsnCipherLabels`, `unknownIeDisplay` |
| 18c | 3-5 | **4** | `espNowVersion` (v1.0/v2.0/otomatik), `fcsPresent`, `payloadSchema`, `encryptedPayloadDisplay` |
| 18d | 6-9 | **8** | `fcsPresent`, `auxSecurityHeaderPresent`, `dispatchProfile`, `iphcContext`, `mlePortOverride`, `hopsLeftDeepField`, `encryptedPayloadDisplay`, `addressDisplay` |
| 18e | 8-12 | **10** | `profile`, `preambleBytes`, `syncWord`, `endianness`, `bitOrder`, `whiteningPolynomial`, `whiteningSeed`, `manchesterPolarity`, `crcAlgorithm`, `crcCoverage` |

**KANAL YAPILMAYACAKLAR listesi her alt brifte ZORUNLUDUR** — dalga 17'nin
çürüyen tahmin 14'ü bunun eksikliğinin kanal sayısını şişirdiğini gösterdi.

### Çeviri anahtarı tahmini

Kalibrasyon: `lonworks` **100**, `iec-61162` **73**, `seatalk` **49**
(KODDAN sayıldı: `grep -c` `src/translations/tr.ts`).
Formül: ~4 / `decodeOptions` kanalı + 2 / örnek çerçeve + hata + uyarı.

| Alt dalga | Tahmin |
|---|---|
| 18a | **~80** |
| 18b | **~60** |
| 18c | **~50** |
| 18d | **~90** |
| 18e | **~85** |
| **Toplam** | **~365** `[BEKLENTİ]` |

**Bilerek YÜKSEK.** Ama dalga 17'de tahminin İLK KEZ fazla çıkma sebebi
"protokol adları çeviriye girmez" kuralıydı; burada da 802.11 IE adları,
MLE komut adları, SNVT benzeri sabitler **VERİDİR, çevrilmez** — tahmin bu
yüzden aşağı sapabilir.

---

## Devralınan tuzaklar (her alt brifte TEKRARLANIR)

1. **`noUncheckedIndexedAccess` açık** — `bytes[i]` tipi `number | undefined`,
   guard yaz. `any` yok, `@ts-ignore` yok.
2. **Yorumlar Türkçe, tanımlayıcılar İngilizce.** Yorum "ne yaptığını" değil
   koddan okunamayanı yazar.
3. **Ham renk yasak** — yalnız token utility'leri.
4. **`en.ts` eksik anahtar = DERLEME HATASI.** `tr.ts` kaynak sözlüktür.
5. **Protokol/alan/araç adları VERİDİR, çeviriye girmez.**
6. **Rozet `resolveStatus()`ten okunur**, ham `protocol.status`tan değil.
7. **Boş kart basmak yasak** — sekme açılıyorsa ya motoru vardır ya neyin
   geleceğini söyler.
8. **Anahtar yoksa payload `encrypted` bırakılır, UYDURULMAZ.**
9. **Çerçeveler arası durum PARSER'A GİRMEZ** (dalga 16 bulgu 12).
10. **`gösterilir ≠ doğrulanır`** (dalga 13 dersi 3): doğrulanamayan bir
    checksum için PASS/FAIL alanı HİÇ BASILMAZ (`modeS.ts`in AP alanı emsali).
11. **Aynı polinom / aynı bit genişliği / aynı init aynı algoritma DEĞİLDİR.**
12. **Yorum ile kod ayrışırsa KOD kazanır** — bu dalgada `mle.hpp:1498-1502`
    üçüncü vaka.
13. **Yeni motor yazarken fixture'ını da yaz.**

---

## Domain kapanış görevleri (18e bitince) — **KİLOMETRE TAŞI**

> ✅ **UYGULANDI (2026-08-27, dalga 18e).** Aşağıdaki dört görevin dördü de
> koştu: `CLAUDE.md` borç bölümü KODDAN doğrulanmış sayımla yeniden yazıldı
> (**140 `ready` / 0 `planned` / 32 `partial`**), `docs/plan-fazlar.md`ye
> dalga 18 kapanış özeti ve Faz 10'un kendi kapanışı eklendi, bu dosyanın
> "Uygulama sırasında çürüyenler" bölümü 18a-18e için TAMAMLANDI ve sıradaki
> domain seçimi YAPILMADI çünkü seçenek kalmadı. **Beklenti tuttu:** ham
> **125 `ready` / 15 `planned` / 32 `partial`** (brif 125/15/32 öngörmüştü —
> tam isabet), çözülmüş **140 / 0 / 32** (brif 140/0/32 öngörmüştü — tam
> isabet). Dördün rozet dağılımı da tuttu: **1 `ready` + 3 `partial`**.

### 1. `CLAUDE.md` "Bilinen borçlar"

- **`wireless-iot` TAMAMEN KAPANDI — SEKİZİNCİ ve SON domain.**
- **KATALOG BORCU SIFIRLANDI: 4 → 0.** Bu cümle AÇIKÇA yazılır.
  Şu an listedeki *"gerçekten yapılacak iş 4 kanonik kayıt"* ifadesi
  **"kanonik `planned` kayıt KALMADI"**la değiştirilir; alias kaynaklı ham
  `planned` sayısı (15) korunur ve **neden ham sayının sıfır OLMADIĞI** yazılır.
- **Ham sayım KODDAN yeniden doğrulanır.** Bugünkü değerler (2026-08-26,
  ölçüldü): 172 kayıt, ham **124 `ready` / 19 `planned` / 29 `partial`**,
  15 alias; çözülünce **139 / 4 / 29**.
  Dalga 18'den sonra beklenen: ham **125 `ready` / 15 `planned` / 32 `partial`**,
  çözülmüş **140 / 0 / 32** `[BEKLENTİ — KODDAN doğrulanacak]`
  (dördü `planned`tan çıkıyor: 1 `ready` + 3 `partial`).
- **Dört kayıt da `partial` gerekçeler listesine** eklenir (`lonworks`
  maddesinin ardına), `esp-now` `ready` kaldıysa hariç.
- **Yeni kalıcı dersler:**
  - *"Bir yakalamanın LINK-TYPE'ı içinde ne olduğunun cevabı DEĞİLDİR."*
    `6LoWPAN.pcap` DLT 1'dir ama içinde ZEP v2 ile taşınan 331 gerçek 802.15.4
    çerçevesi vardır ve FCS'leri 331/331 doğrudur. Bir kaynağı zarf tipine
    bakıp elemek, dalga 17'nin "spec ücretli diye aramayı bırakma"sının
    konteyner düzeyindeki eşidir.
  - *"Kapsam çizgisini libpcap'in link-type tablosu çizebilir."* Radiotap
    802.11'den ayrı bir DLT'dir (105 ↔ 127) ve FCS varlığı 802.15.4'te bir
    DLT ayrımıdır (195 ↔ 230). **"Bu ayrı bir konteyner" iddiası artık
    KANITLANABİLİR bir iddiadır.**
  - *"Yorum ile kod ayrışırsa KOD kazanır" — ÜÇÜNCÜ vaka ve ilk kez BİRİNCİ
    SINIF bir uygulamada:* OpenThread'in `SecuritySuite` enum yorumları
    takas edilmiş (`mle.hpp:1498-1502`); doğru anlam yalnız `mle.cpp`nin
    kullanımından okunur. Yanlış okuma "şifreli"yi "şifresiz" sanıp
    ciphertext'i alan olarak basardı.
  - *"Deponun KENDİ spec'i de bir kaynaktır ve ÇÜRÜYEBİLİR."*
    `ozet/09:171`in CRC'si (`C9 21`) 65.535 polinomun hiçbiriyle, whitening
    örneği 8.192 LFSR kombinasyonunun hiçbiriyle üretilemiyor. **Spec'in
    sayısal örneği bir fixture DEĞİLDİR** — aritmetiği kontrol edilene kadar.
  - *"`canParse`ı FCS taşıyabilir."* Hem `thread` (T4) hem `wifi` (W12) yalnız
    FCS sayesinde 0 çakışmaya iniyor; FCS'siz aynı imzalar 18 ve 216.
    **Checksum bir doğrulama alanı OLMAKLA KALMAZ, bir KİMLİK alanıdır.**
  - `canParse` yanlış pozitifi **DÖRDÜNCÜ kez brif aşamasında ölçüldü** ve
    ilk kez **dört kayıt için AYNI ANDA** karar verdi.
  - **KATALOG BORCU SIFIRLANDI** — 8 domain, 54 aile, 172 kayıt; dalga 10'dan
    18'e kadarki tüm turların kapanışı.
- **Yeni bilinen borç (kaydedilir, kapatılmaz):**
  - `length-based-protocol`ın `canParse`i registry'nin **899/899 örneğini**
    sahipleniyor (`createSchemaParser`in boş `startBytes` davranışı,
    `schemaParser.ts:602-609`). Bu dalgada DÜZELTİLMEDİ.
  - `custom-schema` `definitions` paneli YOK ve **19 kayıt** onu bekliyor
    (`ble-gatt` `ready` olduğu hâlde dahil). `xif` borcuyla aynı sınıf.

### 2. `docs/plan-fazlar.md`

- **`:32` satırındaki faz tablosu** — `10+` satırı **`✅ TAMAM`**a çevrilir:
  *"dalga 18 KAPANDI — `wireless-iot` de bitti, **SEKİZİNCİ ve SON kapanan
  domain**. **Kalan kanonik iş: SIFIR.** Katalogdaki 172 kaydın tamamı ya
  motorlu ya alias."*
- Dalga 18 kapanış özeti (dalga 17'nin `:496-…` biçimi emsal), alt dalga alt
  dalga.
- **Faz 10'un KENDİSİNİN kapanışı** ayrı bir başlıkla yazılır — bu, dalga
  10'dan beri süren zincirin sonudur.

### 3. `docs/brief-faz10-dalga18.md` (bu dosya)

"Çürüyen tahminler → Uygulama sırasında çürüyenler" bölümü DOLDURULUR.

### 4. Sıradaki domain seçimi

**YOK. Seçilecek domain KALMADI.** Bir sonraki iş sınıfı katalog dışıdır
(stateful panolar, `custom-schema` paneli, Log Analyzer, `pcap.ts` tüketicisi)
ve **seçim kullanıcınındır.**

---

## Çürüyen tahminler

*(Dalga 12'den beri kural: brifin yanlış çıkan öngörüleri dosyada İŞARETLENİR,
SİLİNMEZ.)*

### Keşif turunda ZATEN çürüyenler

1. **"MLE'nin UDP portu 19788 = `0xF0BF`."** (Görev tanımı ve bu brifin ilk
   taslağı.) **ÇÜRÜDÜ.** 19788 = **`0x4D4C`** = ASCII `"ML"`. `0xF0BF` = 61631,
   alakasız. `[KANIT]` OpenThread `mle_types.hpp:81`, Wireshark
   `packet-mle.c:202`, MLE draft §8.

2. **"Wireshark'ın Thread dissector'ları `packet-thread*.c`dir."** (Görev
   tanımı.) **YARISI ÇÜRÜDÜ ve yanlış yarısı KRİTİK.** MLE
   **`packet-mle.c`**tedir (99 KB); `packet-thread.c` (202 KB) MLE'yi HİÇ
   çözmez — Thread Address/Diagnostics/MeshCoP/Network Data/Beacon/Backbone
   Link/Network Management/CoAP olmak üzere DOKUZ ayrı protokol kaydeder.
   Brif `packet-thread.c`e yönlendirseydi uygulayıcı yanlış dosyayı okurdu.

3. **"Thread'in kaynağı bol; asıl soru hangi katmanın çözüleceği."** (Görev
   tanımı.) **KISMEN ÇÜRÜDÜ.** Uygulama kaynağı gerçekten bol (OpenThread
   BSD-3, ~600 KB ilgili başlık). Ama **spec FORM-KAPILI** (kayıt + CAPTCHA +
   filigran + yeniden dağıtım yasağı) ve **gerçek Thread mesh yakalaması
   HİÇ YOK.** "Hangi katman" sorusunun cevabı da kaynaktan değil
   **ŞİFRELEMEDEN** çıktı: MLE gövdesi anahtar olmadan okunamaz.

4. **"`zigbee`nin 802.15.4 MAC'i doğrudan tüketilebilir."** (Bu brifin ilk
   taslağı.) **ÇÜRÜDÜ İKİ KEZ:** (a) hiçbir yardımcı `export` edilmemiş,
   (b) Thread MAC katmanı GÜVENLİĞİ kullanıyor ve `zigbee.ts` Auxiliary
   Security Header'ı AYRIŞTIRMIYOR — Zigbee MAC'te güvenlik kullanmadığı için.
   Çekirdek çıkarma "kes-yapıştır" değil, `pulseLog.ts` biçiminde
   **konteyner/türetme ayrımı** gerektiriyor.

5. **"802.11 FCS CRC-32'dir; katalogdaki `CRC32` ile örtüşüyor mu kontrol et."**
   (Görev tanımı.) **DOĞRU ÇIKTI ve gerçek yakalamayla ÖLÇÜLDÜ:** 1093
   çerçevenin 1080'i `crcCatalogue.ts:456-463`teki `CRC32` ile PASS.
   Sahte dost `CRC32C` katalogda **hemen yanında** ve yalnız polinomda
   ayrılıyor.

6. **"`rf-telemetry-custom-frame` yapılandırılabilir bir motorsa `canParse`
   neredeyse kesin `false` olur."** (Görev tanımı.) **ÇÜRÜDÜ.** Varsayılan
   profilin preamble + sync sözcüğü imzası **0 / 899** veriyor ve
   `custom-binary-protocol` emsali (aynı sınıf kayıt, `canParse` YAZILI)
   `true`yu meşrulaştırıyor. Asıl tehlike `false` değil, `createSchemaParser`in
   varsayılanının **899/899** demesiydi.

7. **"`6LoWPAN.pcap` bir 802.15.4 yakalaması değil (link-type 1 = Ethernet)."**
   (Bir ara bulgunun sonucu.) **ÇÜRÜDÜ.** ZEP v2 kapsüllemesi çıkarılınca
   331 gerçek 802.15.4 çerçevesi ve **331/331 doğru FCS** çıktı.

8. **"`wifi` kapsam kararı iki seçenek arasında TARTIŞILARAK verilecek."**
   **KISMEN ÇÜRÜDÜ — tartışılacak ödünleşim çıkmadı.** Üç bağımsız olgu tek
   cevaba işaret etti: (a) libpcap'in beş ayrı 802.11 link-type'ı,
   (b) `packet-ieee80211.c`in 64.051 satırı, (c) FCS'siz `canParse`ın
   216/899'u. Dalga 17'nin 2 numaralı çürüyen tahmininin aynısı.

9. **"Checksum katalogunda ekleme gerekebilir (sayı 38 → 39)."**
   **ÇÜRÜDÜ.** İki FCS de katalogda VAR ve ikisi de gerçek yakalamayla
   doğrulandı. Sayı **38**te kalıyor.

10. **"Alt dalga sayısı 4 (kayıt başına bir)."** (Bu brifin ilk taslağı.)
    **ÇÜRÜDÜ.** `wifi` ikiye bölündü (18a/18b) — beş alt dalga.

### Uygulama sırasında çürüyenler (18a-18e)

*(Uygulama turları koştukça DOLDURULUR. Yanlış öngörüler SİLİNMEZ, işaretlenir.)*

#### 18a (`wifi` MAC katmanı)

11. **"18a'nın ofset zinciri sözde-kodu uygulanabilir."**
    `docs/brief-faz10-dalga18a.md:141`in Management/Data dalı
    `if (FC.order) → n += 4 (HT Control)` diyor, **tür kapısı YOK.**
    **ÇÜRÜDÜ — ve brifin KENDİ TUZAK NOTU (`:145-149`) doğruyu yazıyor:**
    HT Control yalnız **QoS Data ve Yönetim** çerçevelerinde vardır;
    QoS-olmayan bir Data çerçevesinde aynı bit "Order"dır ve alan YOKTUR.
    Sözde-kod uygulanmış olsaydı böyle bir çerçevenin gövdesi **4 bayt
    kayardı, HATA VERMEDEN.** Uygulama tuzak notunu izledi
    (`dot11Frame.ts` `htControlIsMeaningful`), sözde-kodu değil.
    *Bu, dalga 17'nin "yorum ile kod ayrışırsa KOD kazanır" dersinin bir
    BRİF üzerindeki karşılığıdır: aynı belgenin iki cümlesi çelişince
    kazanan, ölçülebilir sonucu olan cümledir.*

12. **"W13 = sınıf-farkındalıklı, FCS'siz imza = 216 / 899."**
    **SAYI DOĞRU, ETİKET YANLIŞ.** 216 bu turda BİREBİR yeniden üretildi,
    ama yalnız **sınıf başına asgari uzunluk kapısı OLMADAN** (protokol
    sürümü 0 + type ≠ 3 + n ≥ 10). Sınıf kapısı da eklenince sayı
    **110**'a düşüyor — ki o da brifin `W1` satırıyla (110 / 899) birebir
    aynı. **Karar iki sayıda da AYNI** (0'a karşı 110 ya da 216, ikisi de
    kabul edilemez); bekçi `wifiCanParseRegistry.test.ts` İKİSİNİ DE ölçer
    ki gelecek nesil etiketten değil ÖLÇÜMDEN beslensin.

13. **"`fcsPresent` `auto` = son 4 bayt CRC-32 tutuyorsa var say."**
    (`docs/brief-faz10-dalga18a.md:185`.) **ÇÜRÜDÜ — aynı brifin
    TAMAMLANMA ÖLÇÜTÜYLE çelişiyor:** `:335` *"Bozuk-FCS örneği FAIL
    basıyor"* diyor, ama "tutmuyorsa yok say" kuralı o örnekte FCS alanını
    HİÇ BASMAZ ve FAIL görünmez. İkisi aynı anda doğru olamaz.
    **Ölçüt kazandı:** `auto` girdi sözleşmesine uyar (FCS VAR sayar),
    PASS/FAIL basar ve tutmadığında *"çerçeve bozuk olabilir ya da girdi
    FCS'siz olabilir, `fcsPresent = no` ile deneyin"* uyarısını düşürür.
    Bir FAIL'i gizlemek, bir belirsizliği yanlış tarafa çözmekten ağırdır.

14. **"Keşif turunun elle çözdüğü çerçeveler ŞÜPHELİDİR" (dalga 17 dersi).**
    **BU TURDA ÇÜRÜMEDİ — sekiz gerçek çerçevenin HEPSİ tuttu.** Uzunluk
    aritmetiği (`başlık + gövde + FCS === n`), IE zincirlerinin bayt
    toplamları (Beacon 104, AssocResp 24, ProbeReq 25), Sequence Control
    okuması (`50 f8` → frag 0 / seq 3973) ve sekiz FCS'in hepsi bağımsızca
    yeniden hesaplandı; **sapma YOK.** Brifin `[KANIT]` etiketleri
    gerçekten kanıta bağlıymış.

15. **"Katalog eklemesi SIFIR, sayı 38'de kalır."** **DOĞRU ÇIKTI ve
    kanıtlandı:** gerçek ACK çerçevesinde `computeNamedCrc(…, 'CRC32')`
    FCS'i birebir üretiyor, sahte dost `CRC32C` aynı baytlarda BAŞKA
    sonuç veriyor (`dot11Frame.test.ts` ikisini de ASSERT ediyor).
    `crcCatalogue.ts` / `crcEngine.test.ts` / `CrcCalculatorTool.test.tsx`
    dosyalarına DOKUNULMADI.

16. **`mode-s`in registry yanlış pozitif sayısı 6 → 7 oldu.**
    **Bir regresyon DEĞİL, bekçinin İŞİNİ YAPMASI:** `wifi`nin 14 baytlık
    ACK örneği registry'ye girdi ve `mode-s`in uzunluk + DF tabanlı imzası
    onu sahiplendi (`modeS.ts`in AP tuzağının matematiksel sonucu).
    Ters yön TEMİZ: `wifi.canParse` `mode-s`in hiçbir örneğini almıyor.
    `surveillanceCanParseRegistry.test.ts`teki ölçüm 7'ye güncellendi ve
    gerekçesi oraya yazıldı.

17. **Tahmin kalibrasyonu.** `decodeOptions` kanal sayısı **6 tahmin →
    6 gerçek** (tam isabet). Çeviri anahtarı **~80 tahmin → 71 gerçek**
    (%11 aşağı) — sebep yine "protokol adları veridir, çevrilmez" kuralı:
    alt tip adları, adres rolleri (RA/TA/DA/SA/BSSID) ve OUI adlarının
    hiçbiri sözlüğe girmedi.

#### 18b (`wifi` yönetim gövdeleri + IE)

18. **"18b'nin aritmetik çaprazlama tablosu (Auth 34 · Disassoc 30 ·
    AssocResp 58 · AssocReq 79 · ProbeReq 53 · Beacon 144) uygulamada
    tutar."** **TUTTU — ve bu turda bir SAPMA BULUNMADI.** Yedi çerçevenin
    (tablodaki altı + Probe Response 138) `24 + sabit + IE + 4 === n`
    aritmetiği element element yeniden hesaplandı; brifin verdiği üç element
    toplamı (Beacon **104**, AssocResp **24**, ProbeReq **25**) birebir
    doğrulandı ve brifte sayı verilmeyen üçü de ölçüldü (AssocReq **47**,
    ProbeResp **98**, Auth/Disassoc **0**). Ölçüm `dot11Management.test.ts`te
    her koşuda YENİDEN üretiliyor; sabit sayı ezberlenmiyor.

19. **`[BEKLENTİ]` "Element ID 47 ERP Information (deprecated) olabilir,
    `packet-ieee80211.c`ten doğrulanacak."** **DOĞRULANDI.**
    `packet-ieee80211.h:408` → `#define TAG_ERP_INFO_OLD 47 /* IEEE Std
    802.11g/D4.0 */` ve `packet-ieee80211.c:63843` bu ID'yi **42 ile AYNI**
    `ieee80211_tag_erp_info` çözücüsüne bağlıyor. 47 "Reserved" DEĞİLDİR;
    bilinmeyen ID dalına düşmedi, adlandırıldı ve 42 ile aynı biçimde
    çözülüyor (gerçek Beacon'da ikisi de `02` = Use Protection).

20. **"`decodeOptions` DÖRT kanal: `ieNameSet` (narrow/all-known/none),
    `vendorIeProfile` (auto/wpa-only/raw), `rsnSuiteLabels`,
    `unknownIeDisplay`."** **KANAL SAYISI TUTTU (4 → 4), İKİSİNİN DEĞER
    KÜMESİ ÇÜRÜDÜ.** `narrow` ile `all-known` bu sürümde **BAYT BAYT AYNI**
    çıktı verirdi (tek ad tablosu var); `auto` ile `wpa-only` de aynı
    (tek vendor çözücüsü var: `00-50-F2` type 1). Bir şey değiştirmeyen
    şık, brifin KENDİ "kanal yapılmayacaklar" mantığıyla kanal DEĞİLDİR.
    Uygulanan: `ieNameSet` = `named`/`none`, `vendorIeProfile` =
    `decode`/`label-only`/`raw`. Gerekçe `wifi.ts` dosya başında.

21. **"RSN sayaç zinciri bozulduğunda uyarı basılmalı."** Uygulandı
    **ve bir adım öteye gitti**: uyarının yanına `length-mismatch` HATASI
    da düşüyor, çünkü örnek çerçevenin `expectedValid: false` olması bir
    hata gerektiriyor ve zincirin tutarsızlığı gerçekten bir uzunluk
    uyuşmazlığıdır. Sayaç kapısı TEK bir yardımcıda toplandı
    (`counterFits`) ve pairwise / AKM / PMKID üçünde de aynı kapıdan
    geçiliyor — brif yalnız pairwise ve AKM'yi işaret ediyordu.

22. **"WPA vendor IE'si RSN gibi çözülür."** Doğru, **ama süit tablosu
    PAYLAŞILMADI.** Wireshark'ın kendisi de iki AYRI tablo taşıyor
    (`ieee80211_rsn_cipher_vals` `:19487` ↔ `ieee80211_wfa_ie_wpa_cipher_vals`
    `:19722`) ve ikincisi 7'de bitiyor. Tek tablo yazılsaydı bir gün RSN'e
    eklenen 18 (OWE) WPA IE'sinde de basılırdı — hata VERMEDEN.

23. **Tahmin kalibrasyonu.** `decodeOptions` **4 tahmin → 4 gerçek**;
    örnek çerçeve **4 tahmin → 4 gerçek** (10 → 14); çeviri anahtarı
    **~60 tahmin → 46 gerçek** (%23 aşağı) — sebep 18a'nınkiyle aynı:
    element adları, süit adları, OUI etiketleri ve kod sözlükleri VERİDİR,
    sözlüğe girmedi. Kayıt toplamı 71 → **117** anahtar.

#### 18c (`esp-now`)

24. **`[BEKLENTİ]` "Gerçek ESP-NOW yakalaması BULUNAMADI; rozet `partial`
    olacak."** **ÇÜRÜDÜ.** `espressif/esp-idf#2833` (2018) **iki gerçek ESP32
    monitor-mode yakalaması** taşıyor; radiotap soyulunca 48 bayt kalıyor ve
    baytlar Espressif'in belgelediği şemayla **SIFIR sapmayla** çaprazlandı,
    kalıntı yok. Kayıt **`ready`** açıldı. Kaynağın TEK ve 2018 tarihli olduğu
    dosya başında ve katalog özetinde AÇIKÇA yazılı — "bulundu" ile "bol"
    ayrı şeylerdir.

25. **"Espressif'in şeması üçüncü adresi hep broadcast der."** **ÇÜRÜDÜ ve
    çürüten şey KAYNAĞIN KENDİ YAKALAMASI oldu:** unicast hedefli çerçevede
    `Addr3 = Addr1`. `resolveAddressRoles` (18a'da yazılan matris) yalnız ROL
    adı verir, DEĞER garantisi vermez — matrise DOKUNULMADI ve iddia örnek
    açıklamasına not olarak düştü. *Birinci taraf belgesi bile kendi
    yakalamasıyla çelişebilir; hakem baytlardır.*

26. **"v1.0'da gövde > 250 bayt ⇒ uyarı basılmalı" (brifin ZORUNLU tuttuğu
    denetim).** **KISMEN ÇÜRÜDÜ: denetim pratikte TETİKLENEMEZ**, çünkü
    `Length` tek bayttır ve 5 + gövde ≤ 255 zaten gövdeyi 250'ye kapatıyor.
    Savunma amaçlı KORUNDU ve neden asla ateşlenmeyeceği koda yazıldı — sessiz
    ölü kod bırakmak yerine ölü olduğunu SÖYLEYEN kod.

27. **`wifi`nin bekçi ölçümü değişti — ve bu KARARIN SONUCU.** `esp-now`ın
    ALTI örneğinin altısı da `wifi`nin W12 imzasını geçiyor, çünkü bir ESP-NOW
    çerçevesi **yapısal olarak zaten geçerli bir 802.11 çerçevesidir**
    (`[KARAR 18-4]`nin ta kendisi). `wifi.canParse`a DOKUNULMADI; bekçinin
    yabancı çakışma kovası `esp-now`u ayrı sayıyor ve sayı SABİTLENMEYİP
    `espNowPlugin.exampleFrames.length`ten TÜRETİLİYOR — ölçüm ezberlenmiyor.

#### 18d (`thread`)

28. **"`decodeOptions` SEKİZ kanal olacak; sekizincisi `iphcContext`."**
    **ÇÜRÜDÜ — ve sebebi bir KAPSAM KISITI:** `DecodeOption.kind` yalnız
    `'select' | 'number'` (`protocol-core/types.ts:278`) ve bir IPv6 prefix'i
    ikisine de sığmıyor; `types.ts`e dokunmak bu dalgada YASAK. Kanal
    AÇILMADI ve davranış zaten brifin *"seçilmezse ham + uyarı"* dalı oldu.
    **Kapatılan kanal `thread.ts` dosya başındaki "KANAL YAPILMAYACAKLAR"
    listesine gerekçesiyle YAZILDI** — "unutulmuş" ile "yazılamamış" ayrı
    şeylerdir. *(18e aynı kısıtla DÖRT kanal birden kaybetti; aşağı.)*

29. **🚨 "Keşfin elle çözdüğü çerçeveler ŞÜPHELİDİR" dersi ÜÇÜNCÜ kez işe
    yaradı.** 18d brifinin BEŞİNCİ çerçevesi aritmetik sapma taşıyordu:
    UDP Length **13** yazıyordu, başlık + yük **15**ti. Çerçeve bu yüzden
    programatik kuruldu (uzunluk yükten TÜRETİLİYOR, FCS motorla üretiliyor).
    Brifin DÖRT gerçek çerçevesi ise 4/4 FCS PASS verdi ve elle yeniden
    çözüldü — sapma yok. *(Dalga 17'de brifin çözümü bir bayt atlamıştı;
    burada bir uzunluk tutmadı. Aramaya devam.)*

30. **"OpenThread birinci sınıf kaynaktır, yorumları okunabilir."**
    **YARISI ÇÜRÜDÜ ve yanlış yarısı KRİTİK:** `mle.cpp:1593/1616/3575`
    Security Suite **0 = ŞİFRELİ**, **255 = şifresiz** diyor;
    `mle.hpp:1498-1502`in yorumları TERSİNİ yazıyor. Yorum izlenseydi
    **ciphertext, MLE komutu diye basılacaktı.** Dalga 17'nin
    `LtIpPackets.h` dersinin birebir tekrarı — *yorum ile kod ayrışırsa
    KOD kazanır*, ve bu ilk kez BİRİNCİ SINIF bir uygulamada oldu.

31. **"802.15.4 MAC çekirdeğe çıkarılırsa `zigbee` kırılabilir."**
    **ÇÜRÜDÜ, ama ancak DOĞRU BÖLÜNMEYLE:** çekirdek YALNIZ KONTEYNER biliyor
    (FCF, adresleme modları, PAN ID sıkıştırma, Aux Security Header VARLIĞI)
    ve gövdeyi TÜKETİCİ araya sokuyor — çünkü `zigbee` FCS'i NWK'dan ÖNCE,
    `thread` EN SONDA basıyor. `zigbee.ts` **299 satır inceldi**, 37 testi ve
    106 örneği **bit düzeyinde aynı** çıktıyı verdi. Çekirdeğe eklenen tek
    seçenek (`fcsPresent`) ölçülebilir bir gerekçe taşıyor: `payloadEnd` hem
    yükün sonunu hem adresleme taşmasını belirliyor, tüketicide düzeltilseydi
    FCS'siz kısa çerçevede **sahte `truncated-frame`** basılırdı.

#### 18e (`rf-telemetry-custom-frame`) — **domain'i ve katalog borcunu kapatan alt dalga**

32. **🚨 "Spec'in kendi örnekleri açıklayıcıdır, fixture değildir"
    `[KARAR 18-5]`.** **KEŞİF TURU HAKLIYDI ve uygulama turu bunu bağımsızca
    DOĞRULADI.** Bu turda `"123456789"` üzerinde beş yayımlanmış `check`
    değeri (CCITT-FALSE `0x29B1` · MODBUS `0x4B37` · KERMIT `0x2189` ·
    XMODEM `0x31C3` · ARC `0xBB3D`) **beşte beş** yeniden üretildi — yani
    hesaplayıcının kendisi doğru; buna rağmen `C9 21` çıkmıyor. Yayımlanan
    çerçevenin CRC'si motorun kendi `CRC16_CCITT_FALSE` çıktısı **`0xAC54`**
    ve bu, örnek açıklamasında AÇIKÇA söyleniyor. **Deponun KENDİ spec'i de
    bir kaynaktır ve çürüyebilir** — dalga 17 dersinin dördüncü vakası,
    ilk kez şüpheli olan şey deponun kendi belgesi.

33. **"`decodeOptions` ON kanal: `profile`, `preambleBytes`, `syncWord`,
    `lengthFieldSemantics`, `endianness`, `bitOrder`, `whiteningPolynomial`,
    `whiteningSeed`, `manchesterPolarity`, `crcAlgorithm`+`crcCoverage`."**
    **SAYI TUTTU (10 → 10), BİLEŞİM ÇÜRÜDÜ — beş kanal başka bir şeye
    dönüştü.**
    - Dört `text hex` kanalı (`preambleBytes`, `syncWord`,
      `whiteningPolynomial`, `whiteningSeed`) **AÇILAMADI**: `DecodeOption.kind`
      yalnız `'select' | 'number'` ve `types.ts` dokunulmaz. **28 numaralı
      çürümenin ikinci ve daha büyük vakası.** Karşılıkları: uzunluklar
      (`preambleLength`, `syncWordLength`) ve tohum (`whiteningSeed`) `number`
      kanalı oldu; polinom PN9'un tap kümesine SABİTLENDİ.
    - `profile` (spec/cc1101/nrf/custom) **ÇÜRÜDÜ**: belgelenmiş TEK çerçeve
      yerleşimi spec §3.9'unkidir; CC1101 ve nRF bir çerçeve yerleşimi değil
      bir RADYO yapılandırmasıdır (whitening, Manchester, CRC) ve o üçü zaten
      ayrı kanaldır. İkinci bir yerleşim UYDURMAK, deponun
      "doğrulanamayanı yayımlama" kuralını çiğnerdi.
    - `endianness` **DARALDI**: bu profilde tek çok baytlı sayısal alan CRC'dir,
      kanal `crcByteOrder` adıyla ve o kapsamla yazıldı — genel bir
      "endianness" etiketi olmayan bir yetenek vaat ederdi.
    - `bitOrder` **DARALDI**: PN9'un LSB-first paketlemesi TI'ın yayımladığı
      BAYT dizisinin parçasıdır, çevrilirse PN9 olmayan bir dizi çıkar ve
      fixture geçersizleşir. Kanal yalnız Manchester'a bağlandı
      (`manchesterBitOrder`).

34. **"`crcAlgorithm` şıkları 38 katalog girdisidir."** **ÇÜRÜDÜ.** Şemanın
    `algorithm` alanı `crcCatalogue.ts`in 38'ine değil
    `algorithmCatalogue.ts`in **`CHECKSUM_ALGORITHMS`** listesine bağlıdır
    (basit toplamlar dahil, CRC katalogunun bir ALT KÜMESİ + `none`). Şıklar
    bu yüzden sabit yazılmadı, listeden TÜRETİLDİ. **Katalog eklemesi SIFIR:**
    `crcCatalogue.ts`, `crcEngine.test.ts` ve `CrcCalculatorTool.test.tsx`
    üçüne de DOKUNULMADI, sayı **38**te kaldı (`[KARAR 18-6]` beş alt dalgada
    da tuttu).

35. **"`canParse` `true` döner ve imza 0 çakışma verir" (6 numaralı keşif
    çürümesinin devamı).** **DOĞRU ÇIKTI ve YENİDEN ölçüldü:** 148 kayıt /
    937 örnek → **0** yabancı çakışma. Reddedilen iki gevşek imza (yalnız
    `AA AA AA` önbellemesi; sync sözcüğünü ilk 12 baytta ARAMAK) de bugünkü
    kümede **0** çalıyor — yani sync ayağı bugün imzayı DARALTMIYOR. Ayak yine
    de KORUNDU ve gerekçesi bekçi testine yazıldı: `AA AA AA` yaygın bir
    önbelleme desenidir ve tek başına bir KİMLİK taşımaz.

36. **🚨 MAYIN — "`createSchemaParser` doğrudan kullanılabilir mi" sorusu.**
    Brifin İKİ kabul edilebilir çözümünden **İKİNCİSİ** seçildi (`canParse`
    elle yazılır). Gerekçe brifin öngördüğünden daha güçlü çıktı: önbelleme ve
    sync sözcüğü bu kayıtta KULLANICI PARAMETRESİDİR; şemaya sabit
    `startBytes` konulsaydı `verifyFraming` 4 baytlık sync kullanan bir
    kullanıcının kendi çerçevesini REDDEDERDİ. Mayın bu turda yeniden ölçüldü:
    boş `startBytes`li bir şema parser'ı **937/937** (%100) sahipleniyor ve
    `length-based-protocol` bugün tam olarak o durumda. `schemaParser.ts`
    DÜZELTİLMEDİ (brif: *"ayrı bir kayıt, ayrı bir borç"*); borç `CLAUDE.md`ye
    kaydedildi ve `rfTelemetryCanParseRegistry.test.ts`in ikinci ayağı
    mayının varlığını HER KOŞUDA yeniden ölçüyor.

37. **"`calculatorIds` ile `/calculators`a bağlantı basılır (`lora` emsali)."**
    **ÇÜRÜDÜ.** `ProtocolPage.tsx:433` bu bağlantıyı YALNIZ `timing`
    sekmesinde basıyor ve bu kaydın `timing` sekmesi YOK — bağlantı hiç
    görünmezdi. EKLENMEDİ ve gerekçesi dosya başına yazıldı.
    ***Görünmeyen bir bağ, olmayan bir bağdır*** — 18b'nin "çıktıyı
    değiştirmeyen şık kanal değildir" kuralının navigasyon düzeyindeki eşi.

38. **"İKİ türetilmiş fixture bekçisi `skip`e düşecek."** **SAYI ÇÜRÜDÜ:
    ÜÇ bekçi düştü.** Görev tanımı `src/pages/ProtocolPage.test.tsx` ve
    `e2e/nmea-decode.spec.ts`i sayıyordu; **`e2e/modbus-decode.spec.ts`**
    (dalga 15b'nin yapısal çözümü) de AYNI sınıftaydı ve o da atlandı.
    Üçü de sessiz yeşil DEĞİL, AÇIKÇA `skipped` raporluyor (birim:
    `1 skipped`, e2e: `2 skipped`). Dalga 16a'nın söktüğü mayın beşinci kez de
    patlamadı — ve artık PATLAYACAK bir hedefi kalmadı.

39. **Başka bir kaydın ölçümü değişti: `mode-s` 7 → 13.** Bu kaydın ALTI
    14 baytlık örneğinin ilk baytı `0xAA`, yani DF = 21 (Comm-B identity
    reply — ATANMIŞ bir DF ve 112 bitlik uzunlukla TUTARLI) ve `modeS.ts`in
    AP tuzağı yüzünden CRC eleği OLMAYAN daldan geçiyorlar. **Bir regresyon
    DEĞİL, bekçinin İŞİNİ YAPMASI** (18a'daki 6 → 7'nin aynısı, bu kez altı
    çerçeveyle). Ters yön TEMİZ: `rf-telemetry.canParse` registry'nin 937
    örneğinin hiçbirini almıyor. Ölçüm ve gerekçesi
    `surveillanceCanParseRegistry.test.ts`e yazıldı.

40. **Tahmin kalibrasyonu (18e).** `decodeOptions` **10 tahmin → 10 gerçek**
    (bileşim tuttu değil, SAYI tuttu — 33'e bakın); örnek çerçeve
    **8 tahmin → 8 gerçek** (tam isabet); çeviri anahtarı **~85 tahmin →
    52 gerçek** (%39 aşağı) — sebep 18a/18b'nin aynısı ve bu kayıtta daha da
    baskın: alan adları, profil adları, CRC algoritma adları ve polarite
    gelenek adları VERİDİR, sözlüğe girmedi.

41. **Dalga 18'in toplam kalibrasyonu.** Alt dalga sayısı **4 tahmin → 5
    gerçek** (10 numaralı çürüme), katalog CRC eklemesi **0 tahmin → 0
    gerçek** (9 numaralı doğrulama), `canParse` kararı **4 kayıt için de brif
    aşamasında ölçüldü ve dördü de değişmeden uygulandı**. En büyük sapma
    ÇEVİRİ ANAHTARI sayısında ve sapmanın YÖNÜ beş alt dalgada da AYNI:
    tahminler yüksek çıkıyor, çünkü *"protokol/alan/algoritma adları veridir,
    çevrilmez"* kuralı her turda tahminden fazlasını sözlüğün dışında
    bırakıyor. **Bir sonraki nesle: çeviri anahtarı tahminini %25-40 aşağı
    çek.**

---

## Açık sorular

### `[DUR-SOR]` — kullanıcıya sorulacaklar: **YOK**

Yedi kararın hepsi keşif turunda kanıta bağlandı:

| Karar | Neden DUR-SOR değil |
|---|---|
| `[KARAR 18-1]` 802.15.4 MAC çekirdeğe çıkarılır | `pulseLog.ts`/`hdlcCore.ts` emsali kurulu; geri dönüş şartı da yazılı (test kırılırsa vazgeç) |
| `[KARAR 18-2]` `wifi` kapsamı | Üç bağımsız olgu tek cevap veriyor; dar-kapsam politikası "SORMA, UYGULA" |
| `[KARAR 18-3]` `thread` kapsamı | MLE şifreliliği ÖLÇÜLMÜŞ olgu; CLAUDE.md'nin anahtar kuralı zaten bağlıyor |
| `[KARAR 18-4]` `esp-now` paylaşımı | Espressif'in kendi şeması ilk 24 baytı 802.11 MAC başlığı diye tanımlıyor |
| `[KARAR 18-5]` `rf-telemetry` motor sınıfı + spec örneklerinin reddi | Aritmetik ölçüm; `custom-binary-protocol` emsali |
| `[KARAR 18-6]` katalog eklemesi sıfır | İki algoritma da katalogda ve gerçek yakalamayla doğrulandı |
| `[KARAR 18-7]` `custom-schema` paneli yazılmaz | `lonworks`/`xif` gerekçesinin birebir aynısı; 19 kaydı birden etkileyen ayrı iş |

### Alt dalga içinde karara bağlanabilir (DUR-SOR DEĞİL)

- `dot11Frame.ts`in tam API şekli (tek fonksiyon mu, `FieldSink` mi).
- 18b'de adlandırılacak IE kümesinin genişliği (dar liste mi, 30+ mı).
- `thread`in MLE komut adlarının kaç tanesinin etikete girdiği.
- `esp-now`da kaç vendor-specific element'in çözüleceği (v2.0'da azami 6).
- 18e'nin kaç hazır profil taşıyacağı (yalnız spec profili mi, +CC1101/nRF mi).
- `decodeOptions` kanal sayılarının tahminden sapması.
- Örnek çerçeve sayılarının tahminden sapması.
