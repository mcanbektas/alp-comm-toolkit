# BRİF — Faz 10 dalga 14d, `some-ip` (uygulamaya hazır)

## Bu dosyanın rolü

Ana brifin **açık soru 5**'ini karara bağlar ve **`automotive-ethernet` ailesini
BİTİRİR** (14a diğer kaydı kapatmıştı). Bu, dalga 14'ün paylaşımı olmayan, en geniş
araç yüzeyli kaydı — dalga 12'nin HTTP'si, dalga 13'ün OPC UA'sı sınıfı.

**14a bitmiş olmalı** (aile kapanış sayımı için), 14b/14c'ye bağımlı DEĞİL.

## Girdi sözleşmesi

**Girdi tek bir SOME/IP mesajıdır** — MAC/IP/UDP çerçevesi DEĞİL.

Gerekçe 14c ile aynı: `ipv4.ts:8-11` üst katmanı adlandırır ve *"şu sayfada çöz"*
uyarısı basar; MAC/IP/UDP/TCP kayıtlarının hepsi `ready`. **Motorlar zincir kurmaz.**

TCP üzerinde birden çok mesajın yapışması: taşıma başlığının `Length` alanı mesaj
sınırını verir. `consumedBytes` DOĞRU doldurulur (`types.ts:148`: *"stream parser bunu
kullanarak buffer'ı ilerletir"*) — böylece akış katmanı işini yapabilir, ama bu motor
segment BİRLEŞTİRMEZ.

## Açık soru 5 kararı: TEK kayıt, İKİ modül

Katalogda SOME/IP-SD için **ayrı kayıt YOK** (`automotive.ts:702`, tek `some-ip`), ama
spec `:343` *"ayrı decoder modülüyle gösterilmelidir"* diyor.

**Karar: `someip.ts` + `someipSd.ts`, tek plugin.** Emsal ikili:

- `dnsWire.ts` (12c) — `dns.ts` ve `mdns.ts` AYNI teli okur, tek motor paylaşılır
- `iec104Asdu.ts` (dalga 5) — ASDU çekirdeği ayrı dosyada, `iec104.ts` çağırır

SD, SOME/IP'nin **kendi başlığını kullanan bir payload'dır**; ayrı bir tel biçimi
değildir. Bu yüzden ayrı kayıt AÇILMAZ (katalog `ProtocolRecord` eklemek 172 kaydı
etkileyen bir taksonomi kararıdır ve bu dalganın kapsamı değil), ama ayrı DOSYA açılır.

**SD'ye giriş çerçeveden çıkar, `decodeOptions` gerekmez** — spec `:343` SD'yi ayrı bir
mesaj sınıfı olarak tanımlıyor ve ayrımı sabit bir Service/Method kimliği taşıyor.
**Bu kimliğin sayısal değeri DOĞRULANMALI** (aşağı bak); doğrulanamazsa SD çözümü
yapılmaz ve payload ham kalır — uydurma ayrım kriteri YAZILMAZ.

## Kaynak durumu — DOĞRULAMA ZORUNLU, ama bu dalganın EN İYİ durumu

Spec `:337` **alan adlarını sırasıyla veriyor**: Service ID, Method/Event ID, Length,
Client ID, Session ID, Protocol Version, Interface Version, Message Type, Return Code,
Payload. Kavramsal yerleşimi de veriyor:
`Service ID | Method ID` / `Client ID | Session ID` / Length / Version / Message Type /
Return Code / Payload.

Ama hemen ardından uyarıyor: *"Kesin bit/byte tahsisi seçilen AUTOSAR SOME/IP spec
revizyonundan uygulanmalıdır."*

**AUTOSAR Foundation spec'leri KAMUYA AÇIKTIR** (`:335`: *"AUTOSAR resmi Foundation
specification setinde SOME/IP Protocol Specification yayınlanır"*) — bu, dalga 13'ün
PI/CLPA/FieldComm Group durumundan KÖKLÜ FARK. Bu dalganın kaynak riski EN DÜŞÜK
kaydıdır.

Yine de kural aynı: **bayt genişlikleri iki bağımsız kaynakla çapraz doğrulanır**
(AUTOSAR'ın kendi yayımı + bir Wireshark SOME/IP dissector kaynağı ya da tanınmış
açık kaynak kütüphane). `doip.ts`in üç-kaynak yöntemi emsal.

**Özellikle doğrulanacak üç şey** — üçü de klasik hata noktası:

1. **`Length` alanının NEREDEN saydığı.** Kendi baytlarını sayıyor mu, başlığın
   tamamını mı, yoksa belirli bir alandan sonrasını mı? 12f'in MQTT-SN vakası tam
   olarak buydu: *"MQTT-SN'in Length'i KENDİ baytlarını da sayar, MQTT'ninki saymaz —
   aynı yerde aynı sayıyı aynı okumak mesaj başına 1 (ya da 3) bayt kaydırır."*
2. **Message ID ve Request ID'nin İÇ BÖLÜNMESİ.** Spec bunları `Service|Method` ve
   `Client|Session` olarak ikiye böldüğünü söylüyor; bölme noktası ve endianness
   doğrulanmalı.
3. **Message Type kod tablosu** (request / request-no-return / notification /
   response / error ve TP varyantları). Ad listesi spec'te yok, yalnız kavram var.

**İki kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır + uyarılır.**

## Payload: HAM KALIR

Spec `:337` payload'ı bir alan olarak sayıyor ama içeriğini tanımlamıyor — SOME/IP
payload'ının yapısı **servis arayüzü tanımından** (ARXML / servis tanımı) gelir,
telden çıkmaz.

**Kanal AÇILMAZ.** 12g'nin RTP kararının birebir aynısı: dinamik payload type için
*"kanal kullanıcıdan sorup tabloya yazmak aynı tahmini dolaylı yoldan yapmak
olurdu"* — kanal bilerek açılmadı, uyarı basıldı. Burada da payload ham gösterilir ve
"servis tanımı olmadan çözülemez" uyarısı basılır. Sahte alan kırılımı UYDURULMAZ
(dalga 13 dersi 4).

`DEFINITION_FORMATS`ta ARXML **YOK** ve eklenmez — spec `:516` bu bölümde yalnız
**DBC, LDF, A2L, EDS** entegrasyonlarının geçtiğini söylüyor.

## Session korelasyonu ve servis ağacı — analyzer işi

Spec `:341` *"Toolkit session ID üzerinden request-response correlation yapmalıdır"*,
`:345` Service Browser ağacı istiyor. Katalog araç listesi de bunları sayıyor.

**Bunlar tek çerçeve çözümünün işi DEĞİLDİR.** Emsal iki kez kurulu ve ikisinde de
kayıt `ready` kapandı:

- 12c: DNS'in Transaction Matching / Response Time / TTL Simulation araçları analyzer'a
  bırakıldı, `dns` yine `ready`
- 12d: PTP'nin δ/θ hesabı T4'ü ister, T4 pakete hiç yazılmaz — `ptp` yine `ready`
  (dalga 12 açık soru 1 kararı, gerekçesi yazılı)

**Bu kayıt bu yüzden `ready` kapanır**, `partial` değil. Tek çerçevede görünen her şey
çözülür; korelasyon `RawFrame.metadata`ya Session/Client kimliği olarak yazılır ki
ileriki analyzer işi onu bulsun.

**Notification/Event ayrımı ise ÇERÇEVEDEN ÇIKAR** (Message Type alanı) — türetilmiş
bir `Kind` alanı üretilir. 12f'in WebSocket `direction` alanının aynı sınıfı
(MASK bitinden türetildi).

## `decodeOptions`

**AÇILMAZ.** Gerekçe yukarıda üç kez: SD ayrımı çerçeveden çıkar, yön/rol Message
Type'ta, payload yapısı ise kanal açmakla çözülmez (RTP kararı).

Bu, 12f'in WebSocket kararının tekrarıdır ve brief'te GEREKÇELİ yazılması önemlidir —
"kanal açılmadı" bir eksiklik değil, bir karardır.

## Uygulama görevleri

1. `src/protocols/automotive/someip/someip.ts` — başlık çözümü, Message Type türetimi,
   `Length` sınır denetimi, payload ham + uyarı.
2. `src/protocols/automotive/someip/someipSd.ts` — SD giriş/opsiyon/eventgroup
   yapıları. **Ayrım kriteri doğrulanamazsa bu dosya YAZILMAZ** ve payload ham kalır.
3. İki test dosyası — `Length` sınır vakaları (eksik veri → `consumedBytes: 0` +
   `recoverable: true`), Message Type tablosu, SD ayrımı.
4. `src/protocols/index.ts` — `registerOnce(registry, 'some-ip', …)` + yorum.
5. `automotive.ts:702` — `status: 'ready'`, `pluginId: 'some-ip'`.
6. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
7. `e2e/some-ip-decode.spec.ts` — kanıtlanacaklar: başlık alanları görünüyor, bir
   request ile bir notification FARKLI `Message Type` fiziksel değeri basıyor, payload
   ham + uyarılı, SD mesajı ayrı alan kümesi üretiyor.

## Devralınan tuzaklar

- **`Length` alanının sayım tabanı** — yukarıdaki doğrulama maddesi 1. Bu dalganın en
  olası sessiz hatası.
- **`ParsedField.id` KENDİ offset'ini kullanır**, base offset'i değil (`ftp.ts`,
  `rtcp.ts` vakaları).
- **`ParsedFrame` DÜZ, `children` YOK** (`protocol-core/types.ts:61-69`, CLAUDE.md
  kilitli kararı). Spec'in istediği "Service Browser tree view" ŞEMA DEĞİŞİKLİĞİ
  gerektirir ve YAPILMAZ. 12g'de RTCP aynı durumda alan ADLARINA taşıyarak çözmüştü
  (`SR SSRC`, `RTCP Packet 1 Packet Type`) — burada da `SD Entry 1 Service ID` gibi
  adlandırma kullanılır.
- **DecodePanel tuzakları** — 14c brifindeki liste aynen geçerli.
- **`unit` fiziksel değere yapıştırılır**; "Encrypted"/biçimlenmiş değerlere `unit`
  verme.

## Model/effort önerisi

**Opus · high.** Gerekçe: iki alt protokol (SOME/IP + SD), üç ayrı doğrulama noktası
(`Length` tabanı, ID bölünmeleri, Message Type tablosu), ve "neyin çözülmeyeceği"
kararları (payload, korelasyon, ağaç görünümü) — hepsi görünmez değişmez riski taşıyor.
Dalga 12'nin HTTP gerekçesinin aynısı: alan sayısı az ama yanlış okumanın bedeli
sessiz.

**Tamamlanma ölçütü:** `automotive-ethernet` ailesinde `planned` kayıt KALMIYOR;
`some-ip` `ready` rozetiyle açılıyor; SD mesajı ile normal mesaj e2e'de ayrı alan
tabloları basıyor; birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7).
