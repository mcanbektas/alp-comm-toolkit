# BRİF — Faz 10 dalga 15b, `cyphal` + `uavcan-compatibility` (uygulamaya hazır)

## Bu dosyanın rolü

Kod yazacak model **ÖNCE `brief-faz10-dalga15.md`i**, sonra `15a`yı (bağımlılık),
sonra bu dosyayı okur. Bu alt dalga **`distributed-uav-networks` ailesini KAPATIR**.

**İKİ DUR-SOR kararı taşır** (ana brif açık soru 2 ve 3). İkisi de karara
bağlanmadan kod yazılmaz.

---

## `cyphal` — aynı isim ailesi, BAŞKA tel biçimi

### Kritik uyarı: DroneCAN'in çözücüsü BURAYA KOPYALANMAZ

Cyphal (UAVCAN v1) ile DroneCAN (UAVCAN v0) **aynı adı paylaşan iki AYRI
protokoldür**. Tail byte'ın *şekli* benzer görünür (SOT/EOT/Toggle/Transfer ID)
ama **transfer ID genişliği, toggle semantiği ve CAN ID düzeni FARKLIDIR**.

Bu, `ccp.ts`in `xcpPacket.ts`ten ayrı tutulma kararının (14c) birebir aynısıdır:
> *"`xcpPacket.ts`i CCP için 'biraz genişletme' isteğine direnç göster. Ortak bir
> komut tablosu, iki protokolün ayrıştığı her kodu sessizce yanlış çözer."*

**`cyphal.ts` kendi dosyasında, kendi CAN ID çözücüsüyle yazılır.**
Paylaşılan tek şey `canFrame.ts`in SocketCAN konteyneridir — 15a'nın da paylaştığı
şey odur. `dronecan.ts`ten `import` YAPILMAZ.

### Kaynak durumu — DOĞRULAMA ZORUNLU

Spec özeti (`06-havacilik-uav.md:159-177`) **hiçbir bit genişliği VERMİYOR**.
Verdiği: transport bağımsızlığı (`:164`), Subject/Service kavramları (`:167`),
Heartbeat alanları (`:170`), DSDL versiyonlama (`:173`), sürüm durumu
(`:161`: **v1.0 stable Mayıs 2025, v1.1 deneysel — parser default'u v1.0**).

**Kaynak: `opencyphal.org/specification/` (Cyphal Specification v1.0 PDF).**
İkinci kaynak: `github.com/OpenCyphal/pycyphal` (referans uygulama) ve
`OpenCyphal/public_regulated_data_types` (DSDL tanımları).

**Alt dalganın İLK adımı kaynak turudur** (dalga 13 mimari bulgu 1). Doğrulanacak
beş şey:

1. **Cyphal/CAN'in 29-bit CAN ID alan düzeni** — Priority, Subject-ID/Service-ID,
   Source Node-ID, Destination Node-ID, Service-not-message, Request-not-response,
   Anonymous biti. Genişlikler DroneCAN'inkinden FARKLIDIR; DroneCAN tablosu
   kopyalanmaz.
2. **Node-ID aralığı** — v0'da 1…127'ydi; v1'de Cyphal/CAN için farklı olabilir.
3. **Transfer-ID genişliği** — v0'da 5 bit. v1'de Cyphal/CAN için farklı olduğu
   iddiası var; doğrulanmadan uygulanmaz.
4. **Transfer CRC algoritması.** DroneCAN CRC-16-CCITT-FALSE kullanıyordu
   (15a'da kanıtlandı, katalogda VAR). **Cyphal'ın aynısını kullandığı
   VARSAYILMAZ** — CRC-32C iddiası vardır ve `CRC32C` katalogda ZATEN var
   (`crcCatalogue.ts:309`), ama hangi ikisi olduğu doğrulanmadan seçilmez.
   *"Aynı bit genişliği aynı CRC algoritması DEĞİLDİR"* kuralının bu dalgadaki
   üçüncü uygulaması.
5. **Toggle bitinin başlangıç değeri.** v0'da ilk çerçevede Toggle=0; v1'de
   ters olduğu iddiası var. Yanlış seçim her multi-frame transferi hatalı gösterir.

**İki bağımsız kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır + uyarılır.**
Dalga 13 dersi 5: uydurma kaynak gerçek bir tehlike, üç iddia reddedildi.

### [DUR-SOR] Kapsam kararı — ana brif açık soru 2

Katalog üç taşıyıcı vadediyor (`aerospace-uav.ts:151-153`: `Cyphal/CAN`,
`Cyphal/UDP`, `Cyphal/Serial`). Spec de öyle (`:164`).

**Öneri: Cyphal/CAN classic-only, rozet `partial`.**

Gerekçe: üç taşıyıcı üç ayrı tel biçimidir; üçünü yapmak alt dalganın kapsamını
üçe katlar. Emsal bol ve hepsi `partial` kapandı: `iec-61850` GOOSE-only,
`cc-link-ie` 0x890F-only, `foundation-fieldbus` HSE-only, `as-interface`
klasik-only.

**CAN FD ayrı bir sorudur.** `canFd.ts` depoda hazır ve `CAN_FD_FRAME_LENGTH`
(72 bayt, `canFrame.ts:66`) tanımlı — bu yüzden FD desteği *ucuz görünüyor*.
Ama Cyphal/CAN FD'nin transfer CRC'si ve dolgu kuralı classic'ten farklıysa ucuz
DEĞİLDİR. **Kaynak turu bunu ilk sırada cevaplasın**, sonra karar verilsin:

- **(a)** Classic-only, FD gelirse `xcpOnCan.ts:169`in yaptığı gibi AÇIKÇA reddet.
- **(b)** Classic + FD, ikisi de aynı `transport: 'can'` altında, uzunluğa göre
  dallan.

**(a) önerilir** — kapsamı dar tutmak, yanlış çözmekten iyidir; ve `partial` rozeti
zaten dürüstlüğü taşıyor.

### `decodeOptions`

| Seçenek | Şıklar | Neden |
|---|---|---|
| `transport` | yalnız `can` (diğer ikisi "kapsam dışı" olarak LİSTELENİR, seçilemez) | Kullanıcı ne çözdüğünü bilir; kapsam sınırı görünür olur |
| `specVersion` | `v1.0` (varsayılan) · `v1.1` **experimental** | Spec bunu ZORUNLU kılıyor (`:161`, `:537`): *"v1.0 stable default, v1.1 yalnız explicit opt-in ile Experimental"*. Katalog yorumu da yazılı (`:157-158`) |

`v1.1` seçildiğinde **koşulsuz** bir `experimentalSpecVersion` uyarısı basılır.
`ccp.ts`in legacy uyarısının aynı biçimi.

---

## `uavcan-compatibility` — ana brif bulgu 4, `automotive-ethernet` DEĞİLDİR

### Neden 14a'nın "parser yazma" yolu buraya OTURMUYOR

`automotive-ethernet` (14a) parser almadan kapandı çünkü **gösterilecek hiçbir şey
yoktu** — kendi tel biçimi yoktu ve komşularının çıktısı da onun sayfasında bir
anlam ifade etmiyordu.

Burada durum farklı, ve fark KATALOGDA yazılı `[KANIT]`:

- `tabs: ['overview', 'decode', 'diagnostics', 'examples']` (`:176`) — **`decode`
  AÇIK**.
- `tools` (`:177-183`): `Naming Disambiguation Panel`, `Protocol Selector Guard`,
  **`Auto-Detection Candidates`**, `DroneCAN / Cyphal Feature Matrix`,
  `Legacy Migration Notes`.
- Katalog yorumu (`:166-169`): *"Belirsiz `Protocol: UAVCAN` seçimi kabul edilmez;
  kullanıcı hattı açıkça seçmek zorundadır."*
- Spec bunu bir **ürün gereksinimi** olarak yazıyor (`:111`, `:182`):
  *"auto-detection sonucu `Legacy UAVCAN / DroneCAN candidate` veya `Cyphal/CAN
  candidate` şeklinde gösterilmelidir"* ve *"belirsiz `Protocol: UAVCAN`
  seçeneği kabul edilmemeli"*.
- `:536` "Dikkat çekenler"de tekrar: *"tek bir 'UAVCAN' parser'ının kabul edilemez
  olduğunu özellikle vurguluyor."*

### [DUR-SOR] Karar — ana brif açık soru 3

**(a) Sınıflandırıcı parser** *(ÖNERİLEN)*
Ham SocketCAN çerçevesini alır, **kendi tel biçimini tanımlamaz**, 15a'nın ve
`cyphal.ts`in ayrım kurallarını uygulayarak aday listesi döndürür:

```
Candidate: DroneCAN / UAVCAN v0   — confidence HIGH   (SNM=0, node ID 1..127, tail SOT+EOT)
Candidate: Cyphal/CAN v1.0        — confidence LOW    (…)
Ambiguous: her iki düzene de uyuyor → kullanıcı SEÇMELİ
```

`decode` sekmesi kalır ve gerçekten bir şey gösterir. Rozet **`partial`** —
çünkü *çözmüyor*, **sınıflandırıyor**; alan tablosu üretmez, aday tablosu üretir.

**(b) 14a yolu:** parser YOK, `decode` sekmesi katalogdan DÜŞÜRÜLÜR, kayıt bilgi
sayfası olarak `partial` kapanır, `related` genişletilir.

**(a) önerilir.** İş 15a + `cyphal` bittikten sonra neredeyse bedava, ve spec'in
açık bir gereksinimini karşılıyor. **Ama bu bir rozet ve kapsam kararıdır →
kullanıcıya sorulur.**

### (a) seçilirse — uygulama sınırı

- **Sınıflandırıcı ne YAPMAZ:** alan çözmez, CRC hesaplamaz, payload'a dokunmaz.
  Alan tablosu yerine **aday satırları** basar.
- **Ne YAPAR:** CAN ID'yi iki düzene göre okur, hangi düzenin tutarlı olduğunu
  raporlar, tutarsızlıkları uyarı olarak listeler.
- **Nereden okur:** `dronecan.ts` ve `cyphal.ts` **ayrım fonksiyonlarını dışa
  aktarır** (ör. `classifyDroneCanId(identity): DroneCanIdShape | undefined`),
  `uavcanCompatibility.ts` bunları ÇAĞIRIR. Kod kopyalanmaz —
  `cipCore.ts`/`xcpPacket.ts` sınıfı bir tüketim, `ccp.ts` sınıfı bir birleştirme
  DEĞİL.
- **`canParse` DAİMA `false` döner.** Bu kayıt otomatik algılamaya GİRMEZ —
  girerse her CAN çerçevesini kendine çeker ve registry'yi çöpe çevirir.
  Kullanıcı bu sayfayı **açıkça seçer**. Bu, kaydın varlık sebebinin
  (`Protocol Selector Guard`) doğrudan karşılığıdır.

---

## Uygulama görevleri

1. **Kaynak turu (`cyphal`)** — beş doğrulama noktası yukarıda. Sonuç dosya başına
   yazılır: neyin doğrulandığı, neyin doğrulanamadığı, hangi kaynaktan.
2. **[DUR-SOR] İki kararı al** (açık soru 2 ve 3) — kararsız kod YAZILMAZ.
3. **`src/protocols/aerospace/cyphal/cyphal.ts`** — kendi CAN ID çözücüsü,
   kendi tail byte yorumu, `decodeOptions` iki alanla. Dosya başı: DroneCAN'den
   neden ayrı olduğu, hangi taşıyıcıların kapsam dışı olduğu, v1.1'in neden
   opt-in olduğu.
4. **`src/protocols/aerospace/uavcanCompatibility/uavcanCompatibility.ts`**
   (karar (a) ise) — sınıflandırıcı, `canParse` daima `false`.
5. **Katalog** — `cyphal` `status` `'planned'` → `'partial'` (`:133`);
   `uavcan-compatibility` `'planned'` → `'partial'` (`:175`). İkisine de
   `pluginId` eklenir. Karar (b) ise `uavcan-compatibility`in `tabs`ından
   `'decode'` ÇIKARILIR.
6. **Registry** — `registerOnce(registry, 'cyphal', …)` ve (karar (a) ise)
   `'uavcan-compatibility'`.
7. **Çeviri** — `en.ts` + `tr.ts`.
8. **Test** — `cyphal.test.ts`, `cyphalCanParseRegistry.test.ts`,
   `uavcanCompatibility.test.ts` (aday sınıflandırması + belirsiz vaka +
   `canParse === false` iddiası).
9. **e2e** — `e2e/cyphal-decode.spec.ts` ve `e2e/uavcan-compatibility.spec.ts`.
   İkincisinde kanıtlanacak: sayfa **Kısmi** rozetiyle açılıyor, aday tablosu
   görünüyor, belirsiz girdide "kullanıcı seçmeli" uyarısı basılıyor.

---

## Devralınan tuzaklar

- **`cyphal.ts` `dronecan.ts`ten import ETMEZ.** Ortak görünen tail byte iki ayrı
  protokolün ayrı kararıdır (14c'nin `ccp` dersi).
- **DroneCAN'in CRC'si Cyphal'ınki VARSAYILMAZ.** Katalogda `CRC16_CCITT_FALSE` de
  `CRC32C` de var; hangisi olduğu doğrulanmadan seçilirse test yeşil gelir ve
  gerçek veride sessizce patlar.
- **`ParsedField.offset`/`length` BAYT cinsindendir** (`types.ts:41-42`).
- **`ParsedField.id` KENDİ offset'ini kullanır** (`ftp.ts`/`rtcp.ts` vakaları).
- **`ParsedFrame` DÜZ, `children` YOK.**
- **`unit` yalnız gerçek fiziksel değere** — Subject-ID, Node-ID, Transfer-ID
  birimsiz.
- **DSDL derleyicisi YAZILMAZ** (ana brif bulgu 9). `definitions: ['dsdl']`
  katalogda kalır, panel boş (`snmp.ts:46` emsali).
- **DecodePanel e2e tuzakları** — ana brifin listesi aynen geçerli.

---

## Model/effort önerisi

**Opus · high.** Gerekçe: iki DUR-SOR kararı var ve ikisi de kayıt rozetini
değiştiriyor; kaynak turu beş ayrı doğrulama noktası taşıyor ve her biri sessiz
yanlış çözüm üretebilir (özellikle transfer CRC seçimi ve toggle başlangıcı);
`uavcan-compatibility`in "sınıflandırıcı mı, bilgi sayfası mı" sorusu depoda
emsali OLMAYAN bir yüzey kararıdır. `iec-61850` GOOSE-only sınıfı muhakeme,
mekanik üretim değil.

**Tamamlanma ölçütü:** `distributed-uav-networks` ailesinde `planned` kayıt
KALMIYOR; `cyphal` **Kısmi** rozetiyle açılıyor ve kapsam dışı taşıyıcılar
sayfada AÇIKÇA listeleniyor; `v1.1` seçilince deneysel uyarısı basılıyor;
`uavcan-compatibility` (karar (a) ise) aday tablosu üretiyor ve `canParse`
daima `false`; `cyphalCanParseRegistry.test.ts` registry'nin tüm örnekleri
üzerinde yeşil ve `dronecan` örneklerini kabul ETMİYOR (ters yön de sınanır);
birim + e2e + build yeşil.

**KAYIT KAYIT bitir:** önce `cyphal` tamamen (kaynak → motor → test → e2e), sonra
`uavcan-compatibility`.
