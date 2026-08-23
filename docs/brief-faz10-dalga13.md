# Faz 10, dalga 13 — Industrial Automation (keşif, 2026-08-22)

## Kapsam

`industrial-automation` domain'inin kalan **16 kanonik kaydı**. Domain toplamı 8 aile /
25 protokol (`src/app/catalog/domains/industrial-automation.ts:3`); **9'u zaten `ready`
veya `partial`**, kalan 16'sı `planned`. **Bu domain'de alias kaydı YOK** (dosyanın kendi
başlık yorumu: "Bu dosyadaki dört kayıt KANONİKTİR ve başka domain'lerdeki ikizleri buraya
`aliasOf` ile bağlanır" — yön BAŞKA domain → buraya, tersi değil). 16 ham `planned` = 16
gerçek iş; CLAUDE.md'nin borç sayımıyla birebir eşleşiyor ("industrial-automation 16").

Spec kaynağı: `docs/spec/ozet/03-endustriyel.md` (269 satır). Taksonomi doğrulayıcısı:
`docs/spec/ozet/11-domain-taksonomisi.md §2`.

### Aile aile döküm

| Aile | `ready`/`partial` | `planned` (bu dalga) |
|---|---|---|
| modbus | modbus-rtu, modbus-ascii, modbus-tcp | — (aile bitti) |
| classic-fieldbus | — | **profibus-dp, cc-link, as-interface, foundation-fieldbus** |
| industrial-ethernet | ethercat | **profinet, ethernet-ip, cc-link-ie, sercos-iii, powerlink** |
| cip-can-based | canopen | **cip, devicenet** |
| sensors-device-integration | — | **io-link** |
| process-instrumentation | — | **hart** |
| metering | m-bus | **wireless-m-bus** |
| scada-utility | iec-60870-5-104, dnp3, iec-61850 (partial) | **opc-ua, iec-60870-5-101** |

## Zaten var olan motorlar — kısmi ödeme, dalga 12'den daha küçük

| Motor | Yol | Bu dalgada kimi taşır | Doğrulama durumu |
|---|---|---|---|
| IEC 60870 ASDU çözücü | `protocols/industrial/iec104/iec104Asdu.ts:300` `decodeAsdu()` | **iec-60870-5-101** — spec'in kendi ifadesi "ASDU 101 ile ortak core" | **KANITLI** — `iec104.ts:46` bu fonksiyonu zaten import edip kullanıyor |
| M-Bus değişken veri çözücü | `protocols/industrial/mbus/mbusVariableData.ts:277` `decodeVariableData()` | **wireless-m-bus** — spec'in kendi ifadesi "wired M-Bus ile aynı application-data decoding motoru, radio/link-layer ayrı" | Kanıt güçlü — `mbus.ts`in `parseMbus`ından zaten ayrı dosyaya çıkarılmış, ama fiilen çağıran yok (yetim gibi hazır bekliyor) |
| LRC checksum | `protocol-core/checksums/lrc.ts:19` `lrcChecksum()` | **hart** adayı | **DOĞRULANMADI** — spec özeti HART'ın checksum algoritmasını açıklamıyor, şu an yalnız `modbusAscii.ts` kullanıyor |
| EDS tanım dosyası çözücü | `protocol-core/definitions/eds/edsDecoder.ts` `decodeEdsValue()` | `cip`/`ethernet-ip` EDS'e `related`/tool listesiyle işaret ediyor | **ŞÜPHELİ** — `grep -rl definitions/eds src/` hiçbir tüketici bulamadı; `canopen.ts` (ready) bile bu modülü çağırmıyor görünüyor, açık soru 1'e bak |
| CANopen OD/PDO/SDO çözücüsü | `protocols/industrial/canopen/canopen.ts` | `powerlink` adayı (spec: "CANopen ile ortak OD engine paylaşılabilir") | **KOD SEVİYESİNDE HENÜZ MÜMKÜN DEĞİL** — dosya yalnız tek bir `parseCanopen(data)` export ediyor (satır 646), iç OD/PDO/SDO alt-fonksiyonları private; paylaşım için `canopen.ts`e refactor gerekir |

**Cross-domain uyarı:** `ethercat.ts` (ready) `network-ethernet` domain'inin
`ethernetFrame.ts`/`walkTypeLengthChain`ından **hiçbir şey import etmiyor** — yalnız
`@/protocol-core/types`ten `createRawFrame` alıyor, kendi Ethernet header/EtherType
kontrolünü bağımsız yazmış. **Emsal: PROFINET/POWERLINK/CC-Link IE de aynı şekilde
bağımsız yazılacak, `network-ethernet`e bağımlılık açılmayacak.**

## Mimari bulgular

### 1) Spec kaynağı riski — dalga 12'den köklü fark

Dalga 12 IETF RFC'lerine dayandı: ücretsiz, halka açık, kesin, alan alan tablolanmış.
Bu dalganın protokollerinin çoğu (PROFIBUS, CC-Link, AS-Interface, FOUNDATION Fieldbus,
Sercos III, PROFINET/GSDML, EtherNet/IP/CIP/DeviceNet, POWERLINK, IO-Link) ticari
konsorsiyum spec'lerine dayanıyor (PI, CLPA, ODVA, FieldComm Group, EPSG/Sercos
International — çoğu üyelik/ücret arkasında). `03-endustriyel.md`nin kendisi bunu tekrar
tekrar vurguluyor: *"exact bit/byte alanları resmi spec revizyonundan alınmalı, tahmin
edilmemeli"*. Modbus/EtherCAT/CANopen/DNP3/IEC60870-104/IEC61850-GOOSE zaten `ready`
olmuş — yani imkansız değil, ama her alt dalganın **ilk adımı** "bu protokol için yeterli
halka açık wire-format kaynağı var mı" (Wireshark dissector kaynağı, konformans test
spec'i, vb.) sorgusu olmalı. Spec özeti tek başına yetmiyor.

### 2) CIP üçlüsü — `related` alanlarıyla teyitli, GERÇEK paylaşım adayı

ODVA'nın kendi spec'i "aynı object modelini paylaşır" diyor (CIP: media-independent).
Katalogdaki `related` çapraz referansları zaten bunu işaretliyor
(`ethernet-ip → cip`, `cip → ethernet-ip, devicenet`, `devicenet → cip`). Motor: Path/
Service/Class-Instance-Attribute segment encoding + Status code tablosu — taşıyıcı
(TCP/UDP vs CAN) farklı, üst katman ortak. Sıralama önemli: `cip` önce yazılıp diğer
ikisi tüketmeli (dalga 12c'nin `dnsWire.ts` deseninin aynısı).

### 3) wireless-m-bus → m-bus paylaşımı en düşük riskli, ama iec-60870-5-101 daha kanıtlı

İkisi de spec'in kendi ifadesiyle teyitli "gerçek paylaşım" vakası (dalga 12g'nin
`ntpTimestamp.ts` deseni). Aralarındaki fark: `decodeAsdu()` **şu an fiilen** kullanımda
(`iec104.ts` onu çağırıyor), `decodeVariableData()` ise yazılmış ama hiçbir yerden
çağrılmıyor — hazır duruyor ama ilk tüketicisi olmak biraz daha risk taşır (fonksiyon
imzası wireless-m-bus'un ihtiyacına tam uymayabilir, örn. link-layer'dan gelen ek
metadata'yı kabul etmiyor olabilir).

### 4) POWERLINK → CANopen paylaşımı spec seviyesinde önerilir, kod seviyesinde henüz yok

`canopen.ts` yalnız `parseCanopen()` export ediyor. Dalga 12'nin "akraba görünen tel
biçimi farklı çıktı" dersini hatırda tutarak (CANopen PDO ≤8 bayt/CAN frame sınırı,
POWERLINK Fast Ethernet üstünde farklı boyut sınırına sahip olabilir) — bu paylaşım
kanıtlanmadan varsayılmamalı. Gerekirse `canopen.ts`e refactor (iç fonksiyonları export
etme) 13f'nin kendi kapsamına girer, ayrı bir "ortak motor açma" işi olarak planlanmaz.

## Alt dalga sıralaması önerisi

En kanıtlı paylaşımdan başlayıp en riskli/en büyük gruba doğru ilerler.

| # | Kayıtlar | Neden burada | Motor | Zorluk |
|---|---|---|---|---|
| **13a** | wireless-m-bus | metering ailesi kapanır; en güvenli paylaşım, en ucuz giriş | `decodeVariableData()` paylaşımı | kolay |
| **13b** | iec-60870-5-101 | scada-utility'nin en güvenli parçası; ASDU paylaşımı kod seviyesinde zaten kanıtlı | `decodeAsdu()` paylaşımı | kolay–orta |
| **13c** | opc-ua | scada-utility ailesi kapanır; bağımsız, en geniş araç yüzeyi (12 araç), çok adımlı state machine (Hello→SecureChannel→Session→Subscription) | — (paylaşım yok) | zor |
| **13d** | cip, ethernet-ip, devicenet | `cip-can-based` ailesi kapanır + `industrial-ethernet`ten biri; CIP çekirdek motoru ilk yazılıp iki taşıyıcı onu tüketir | `cipObjectModel` (yeni, paylaşım GERÇEK) | orta–zor |
| **13e** | profinet | `industrial-ethernet`in en yaygın/en çok araçlı kaydı; GSDML definitions + DCP discovery + slot/subslot ağacı | — (definitions deseni zaten var: gsd/gsdml/eds/iodd/scl) | zor |
| **13f** | powerlink, cc-link-ie, sercos-iii | `industrial-ethernet` ailesi kapanır; powerlink'in CANopen paylaşımı BU alt dalgada sınanır (kanıtlanırsa kullanılır, kanıtlanmazsa bağımsız yazılır) | `canopen.ts` (belirsiz, sınanacak) | orta |
| **13g** | profibus-dp, cc-link, as-interface, foundation-fieldbus | `classic-fieldbus` ailesi kapanır; dördü muhtemelen bağımsız, EN YÜKSEK spec-bulma riskini taşıyan grup (mimari bulgu 1) | GSD definitions (profibus) | zor (spec riski) |
| **13h** | io-link, hart | `sensors-device-integration` + `process-instrumentation`, ikisi tek-kayıtlı aile, birlikte kapatılabilir | IODD definitions, `lrc.ts` adayı (doğrulanacak) | orta |

**Toplam 8 alt dalga / 16 kayıt.** 13a ve 13b bilerek en başta: kanıtlı paylaşım, hızlı
yeşil, dalganın geri kalanına güven verir.

### Model önerisi (alt dalga başına)

- **13a, 13b** → Sonnet · medium (paylaşım kanıtlı, tarif net)
- **13h** → Sonnet · medium-high (iki bağımsız protokol ama definitions deseni kurulu)
- **13d, 13f** → Sonnet · high (paylaşım tasarımı var ama sıralama/doğrulama kararı gerekiyor)
- **13c (opc-ua), 13e (profinet)** → Opus · high (geniş state machine + büyük araç
  yüzeyi + görünmez değişmez riski yüksek — dalga 12'nin HTTP/PTP gerekçesinin aynısı)
- **13g (classic-fieldbus)** → Opus · high (spec bulunabilirlik riski — kaynak
  yetersizse kapsamı daraltma kararı [[IEC 61850 GOOSE-only presedanı]] gibi muhakeme
  gerektirir, mekanik üretim değil)

## `decodeOptions` kanalı — bu domain'deki adaylar

- **wireless-m-bus** — şifreleme anahtarı (opsiyonel kullanıcı girdisi; spec "anahtar
  dışa gönderilmez" diyor açıkça — GEREKLİ kanal, "yerelde kalan sır" deseni bu domain'de
  ilk kez görülüyor).
- **opc-ua** — sertifika güven zinciri / trust store (spec "Untrusted/Expired/Hostname
  mismatch/Revoked" hatalarını listeliyor). Muhtemelen kanal AÇILMAZ, "Unable to verify"
  ile bırakılır (dalga 12'nin şifreli SNMP ScopedPDU / WebSocket kripto ayrımı emsali) —
  13c'de karara bağlanmalı.
- **hart** — uzun/kısa adres modu (HART revizyonuna göre değişebilir); çerçeveden
  çıkarılabilir mi belirsiz, 13h'de doğrulanmalı.
- **iec-60870-5-101** — IOA (Information Object Address) ve Common Address bayt
  genişliği (1/2/3 bayt, profile bağlı). `iec-60870-5-104`ün (ready) bunu nasıl çözdüğü
  bilinmiyor — 13b'nin ilk adımı bu kodu okumak olmalı.

## Açık sorular

1. **CANopen (ready) gerçekten EDS dosyası tüketiyor mu?** `grep -rl definitions/eds
   src/` hiçbir tüketici bulamadı — `definitions: ['eds']` yalnız katalog metadata'sı
   olabilir. 13d/13f öncesi netleştirilmeli, çünkü CIP/POWERLINK'in definitions deseni
   buna emsal teşkil edecek.
2. **HART checksum algoritması `lrc.ts`teki `lrcChecksum` ile birebir mi?** FieldComm
   Group spec'i olmadan özet net değil; HART'ın BCC'si klasik LRC'den farklı olabilir
   (XOR tabanlı ihtimali var). 13h'de doğrulanmalı.
3. **classic-fieldbus dördü (özellikle CC-Link, AS-Interface, FOUNDATION Fieldbus)
   için wire-level alan tabloları nereden gelecek?** 13g başlamadan araştırılmalı;
   kaynak yetersizse kapsam "genel çerçeve + alan adları" seviyesinde mi kalacak
   (IEC 61850 GOOSE-only kararının presedanı: kapsam bilinçli daraltılıp özet metinde
   açıkça yazılabilir) — bu bir karar gerektirir, mekanik üretim değil.
4. **`iec-60870-5-104` (ready) IOA/Common Address bayt genişliğini nasıl çözüyor?**
   Kod okunmadan bilinmiyor; 13b'nin başlangıç noktası.

## Kaynak satır haritası (spec `03-endustriyel.md`)

modbus-rtu `:5-19` (ready) · modbus-ascii `:21-27` (ready) · modbus-tcp `:29-33` (ready) ·
profibus-dp `:35-41` · profinet `:43-49` · ethercat `:51-57` (ready) · ethernet-ip `:59-65` ·
cip `:67-73` · devicenet `:75-79` · canopen `:81-87` (ready) · cc-link `:89-93` ·
cc-link-ie `:95-99` · sercos-iii `:101-105` · powerlink `:107-111` · io-link `:113-117` ·
as-interface `:119-123` · hart `:125-129` · foundation-fieldbus `:131-135` ·
m-bus `:137-141` (ready) · wireless-m-bus `:143-147` · opc-ua `:149-153` ·
iec-60870-5-101 `:155-159` · iec-60870-5-104 `:161-165` (ready) · dnp3 `:167-171` (ready) ·
iec-61850 `:173-183` (partial) · Ortak Industrial Transaction Analyzer `:187-257`.

Domain geneli araçlar (kayıt başına değil, ileride ayrı iş): Device/Node Table, Cyclic
Data Statistics, Request/Response Statistics, Process Value görünümü, Quality/Status,
Device Description Integration, Industrial Error Correlation, Layer Drill-Down
(`:187-257`) — dalga 12'nin Flow Analyzer/Checksum Validation Engine/Topology Builder
domain-geneli araçlarının analoğu, kayıt başına değil ayrı iş olarak planlanmalı.

Bağlam: [[alp-comm-dalga12-network]]. Bu dosya henüz kapanmamış bir dalganın keşif
turudur — uygulama başlamadı, onay bekliyor.
