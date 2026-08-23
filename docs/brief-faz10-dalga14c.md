# BRİF — Faz 10 dalga 14c, `xcp-on-ethernet` + `ccp` (uygulamaya hazır)

## Bu dosyanın rolü

Ana brifin **bulgu 3**'ünü kapatır ve **`calibration` ailesini BİTİRİR**. İki kayıt
aynı ailede ve ikisi de "kalibrasyon" işi yapıyor — **ama kod paylaşımları
asimetriktir ve bu alt dalganın tek tuzağı budur:**

- `xcp-on-ethernet` → **14b'nin `xcpPacket.ts`ini TÜKETİR** (gerçek paylaşım)
- `ccp` → yalnız **CAN taşıyıcısını** paylaşır, XCP çekirdeğine DOKUNMAZ

**14b bitmeden başlama.** `xcpPacket.ts` orada doğuyor.

## `xcp-on-ethernet` — aynı çekirdek, başka taşıyıcı

Spec `:363` bunu tartışmaya kapatıyor: *"XCP base protokolü aynı kalır, transport:
Ethernet → IP → UDP veya TCP → XCP."* Analyzer katmanları `:367`: MAC, IP, UDP/TCP,
XCP Transport Header, XCP Packet, CTO/DTO, DAQ, Measurement.

### Girdi sözleşmesi

**Girdi XCP-on-Ethernet taşıma birimidir** (taşıma başlığı + XCP paketi), MAC/IP/UDP
çerçevesinin tamamı DEĞİL.

Gerekçe kodda: `ipv4.ts:8-11` üst katmanı ÇÖZMEZ, adlandırır ve *"şu sayfada çöz"*
uyarısı basar — `ethernetFrame.ts`in EtherType deseninin birebir emsali. MAC/IP/UDP/TCP
kayıtlarının hepsi zaten `ready` ve kendi sayfalarında çözülüyor. **Motorlar zincir
kurmaz** (12f WebSocket el sıkışması kararı: HTTP mesajı tanınır, HTTP sayfasına
YÖNLENDİRİLİR).

**TCP stream reassembly (spec `:373`) BU KAYDIN İŞİ DEĞİLDİR.** Depo "girdi tek mesaj"
çizgisinde duruyor; 12h'de FTP/Telnet bu çizgiden ayrılırken gerekçe TCP'nin doğal
mesaj sınırı olmamasıydı ve çözüm satır/IAC tabanlı tek geçişti, segment birleştirme
DEĞİL. Burada taşıma başlığının `LEN` alanı zaten mesaj sınırını veriyor — eksik veri
`consumedBytes: 0` + `recoverable: true` ile bildirilir (`types.ts:148` sözleşmesi:
*"Sıfır dönmek daha çok veri bekle demektir"*), akış katmanı stream katmanının işidir.

### UDP mü TCP mi — kanal AÇILMIYOR

XCP-on-Ethernet taşıma başlığı iki taşıyıcıda da AYNIDIR; ayrım pakete yazılmaz ve
alan tablosunu değiştirmez. **Kanal açmak bilgi getirmez** — 12f WebSocket
kararının aynısı (*"MASK biti yönün KENDİSİ"* → kanal açılmadı). Taşıyıcı bilgisi
istenirse `RawFrame.channel` alanı zaten var, önce O denenir.

**Açılan tek kanal 14b'nin `packetInterpretation`ıdır** (CTO/DTO/ham) — aynı gerekçe,
aynı varsayılan (`raw`), aynı çeviri anahtarları. İki kayıt aynı `DECODE_OPTIONS`
dizisini PAYLAŞIR, ikinci kez yazılmaz.

### Kaynak durumu — DOĞRULAMA ZORUNLU

Spec taşıma başlığının **alan ADLARINI bile vermiyor**, yalnız "XCP Transport Header"
diyor. Uzunluk ve sayaç alanlarının bayt genişlikleri, sırası ve endianness'ı
**eğitim verisinden hatırlanan bilgidir** — 14b'nin iki-bağımsız-kaynak kuralı burada
DAHA sıkı uygulanır. İki kaynak örtüşmezse alan ADLANDIRILMAZ, ham kalır.

## `ccp` — XCP DEĞİLDİR, karıştırma

Ana brifin bulgu 3'ü: spec ikisini ayrı ayrı tanımlıyor ve **nesne adları bile
farklı** — XCP **CTO/DTO** (`:353`), CCP **CRO/DTO** (`:383`). Komut akışı da ayrışıyor
(`:385`: `CONNECT → GET_CCP_VERSION → SET_MTA → UPLOAD/DOWNLOAD → DAQ`), CCP'nin her
CRO'sunda ayrıca bir **Counter** alanı var (`:385` "Alanlar: Command, Counter,
Parameters, Response, Status"), XCP'de yok.

**CCP'yi XCP tablosuyla çözmek dalga 12f'in MQTT/MQTT-SN tuzağının aynı cinsidir:**
akraba görünen, aynı yerde aynı sayıyı BAŞKA anlamda okuyan iki biçim. Orada
`mqttSn.ts` bilerek `mqtt.ts`in YANINA kondu ki fark görünsün — **burada da
`ccp.ts` `xcp/` klasörünün İÇİNE DEĞİL, `automotive/ccp/` altına yazılır.**

### Girdi sözleşmesi

14b ile aynı: **16 baytlık SocketCAN klasik çerçevesi**, `canFrame.ts`ten beş sembol.
CCP CAN'e özgüdür (`:379`), başka taşıyıcısı yoktur — çekirdek/taşıyıcı ayrımına
gerek YOK, tek dosya.

### `decodeOptions`

Aynı belirsizlik: bir çerçevenin CRO mu DTO mu olduğu CAN ID ayrımından gelir, içerikten
değil. Kanal açılır — ama **CCP'nin kendi çeviri anahtarlarıyla**
(`protocol.ccp.option.*`), XCP'ninkini paylaşarak değil. Şıklar: `raw | cro | dto`.

### Legacy uyarısı — KOŞULSUZ basılır

Spec iki kez söylüyor (`:379`, `:506`): ASAM CCP'yi legacy/obsolete ilan etmiş, XCP
"recommended successor". Katalog yorumu da bunu istiyor (`automotive.ts:838`:
*"karşılaştırma paneli bu geçişi görünür kılmak için var"*).

**Her başarılı çözümde bir uyarı basılır** — 12h'in Telnet plaintext uyarısının
(koşulsuz, her başarılı çözümde) birebir emsali. Uyarı metni "bu protokol legacy,
yeni tasarımlarda XCP" der ve `related` üzerinden `xcp-on-can`a yönlendirir.

### Kaynak durumu

ASAM MCD-1 CCP 2.1.0 spec'i **ücretlidir ve depoda YOKTUR**. Spec özeti komut
ADLARINI veriyor (`CONNECT`, `GET_CCP_VERSION`, `SET_MTA`, `UPLOAD`, `DOWNLOAD`,
`DAQ`), **sayısal kod VERMİYOR.** İki-bağımsız-kaynak kuralı burada da geçerli.
CCP eski bir protokol olduğu için kamuya açık ikincil kaynak XCP'den DAHA AZ
olabilir — **yetersizse `partial`, kaynaksız kayıt politikası (2026-08-23 kullanıcı
kararı) gereği SORMADAN uygula**: çerçeve sınırları + CRO/DTO ayrımı + Counter alanı
çözülür, komut kodları HAM + uyarı kalır, özet metni neyin çözülmediğini AÇIKÇA yazar.
Presedan: `iec-61850` GOOSE-only, `cc-link-ie` 0x890F-only.

## Uygulama görevleri

1. `src/protocols/automotive/xcp/xcpOnEthernet.ts` + test — `xcpPacket.ts`i tüketir,
   `DECODE_OPTIONS` 14b'den PAYLAŞILIR (import, kopya değil).
2. `src/protocols/automotive/ccp/ccp.ts` + test — bağımsız komut kümesi, CAN taşıyıcı
   paylaşımı, koşulsuz legacy uyarısı, kendi `DECODE_OPTIONS`ı.
3. `src/protocols/index.ts` — iki `registerOnce` + paylaşımı açıklayan yorumlar.
4. `automotive.ts:770` ve `:807` — `status` (`ready` ya da kaynak yetersizse `partial`),
   `pluginId`. `definitions: ['a2l']` kalır, ayrıştırıcı YAZILMAZ (14b'deki gerekçe).
5. Çeviriler `en.ts` + `tr.ts`, İKİSİNE DE.
6. `e2e/xcp-on-ethernet-decode.spec.ts` + `e2e/ccp-decode.spec.ts`.

## Devralınan tuzaklar

- **`ccp.ts`yi `xcp/` klasörüne koyma.** Ayrı klasör kararın kendisidir.
- **`xcpPacket.ts`i CCP için "biraz genişletme" isteğine direnc göster.** Ortak bir
  komut tablosu, iki protokolün ayrıştığı her kodu sessizce yanlış çözer —
  12d'nin `networkTimestamp` vakası (NTP 2⁻³² kesir vs PTP tam sayı ns; ortak motor
  birini 4295 kat yanlış ölçeklerdi).
- **DecodePanel tuzakları** (12d+12e'de bulundu): alan uyarısı ayrı `<tr>`de basılır
  (`fieldRow(...).getByTestId('decode-field-warning')` BOŞ döner, kökten
  `[data-testid="decode-field-warning"][data-field-id="X"]` ara); `success:false`
  `decode-parse-error` kartı basar, `decode-frame-error` DEĞİL; `decode-field-raw`
  sayıyı `0x22 (34)` diye biçimler; çerçeve uyarısı birden çoksa
  `getByTestId('decode-frame-warning')` strict-mode ihlali verir, `.filter({ hasText })`
  ile süz.
- **`ParsedField.id` KENDİ offset'ini kullanır** (üçüncü hatırlatma; `ftp.ts`/`rtcp.ts`
  vakaları).

## Model/effort önerisi

**Sonnet · high.** İki kayıt, biri kanıtlı paylaşımı tüketiyor, diğeri bağımsız —
ama "neyin paylaşılmayacağı" kararı aktif muhakeme gerektiriyor ve yanlış birleştirmenin
bedeli sessiz yanlış çözümdür. Kaynak yetersizliğinde `partial` kararı da burada
verilebilir (politika kurulu, sorma gerekmiyor).

**Tamamlanma ölçütü:** `calibration` ailesinde `planned` kayıt KALMIYOR; üç kayıt da
(14b'nin `xcp-on-can`ı dahil) rozetleriyle açılıyor; `xcpPacket.ts`in İKİ tüketicisi
var ve testleri ayrı ayrı yeşil; CCP'nin legacy uyarısı e2e'de görünüyor.
