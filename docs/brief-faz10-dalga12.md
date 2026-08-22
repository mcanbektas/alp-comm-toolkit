# Faz 10, dalga 12 — Network & Ethernet (keşif, 2026-08-22)

## Kapsam

`network-ethernet` domain'inin kalan **19 kanonik kaydı**. Domain toplamı 8 aile /
28 protokol (`src/app/catalog/domains/network-ethernet.ts:4`); **9'u zaten `ready`**,
kalan 19'u `planned`. **Bu domain'de alias kaydı YOK** — 19 ham `planned` = 19 gerçek iş.
(`resolveStatus()` bu domain'de ham `status` ile aynı sonucu verir; yine de rozet
her zaman `resolveStatus()`ten okunur — dalga 11 kuralı.)

Spec kaynağı: `docs/spec/ozet/08-ag-ethernet.md` (873 satır). Taksonomi doğrulayıcısı:
`docs/spec/ozet/11-domain-taksonomisi.md §7`.

### Aile aile döküm

| Aile | `ready` | `planned` (bu dalga) |
|---|---|---|
| data-link | ethernet-ii, ieee-802-3, vlan-802-1q | **arp, lldp** |
| internet-layer | ipv4, ipv6 | **icmp, icmpv6** |
| transport | udp, tcp | — (aile bitti) |
| addressing-discovery | — | **dhcp, dns, mdns** |
| time-management | — | **ntp, ptp, snmp, syslog** |
| web-messaging | mqtt, coap | **http, websocket, mqtt-sn** |
| real-time-media | — | **rtp, rtcp** |
| file-terminal | — | **tftp, ftp, telnet** |

## Zaten var olan motorlar — bu dalganın yükünün büyük kısmı ödenmiş

| Motor | Yol | Bu dalgada kimi taşır |
|---|---|---|
| Internet checksum | `protocol-core/checksums/internetChecksum.ts:55,65,81` (`computeInternetChecksum`, `...WithFieldZeroed`, `verify...`) | icmp, icmpv6, (dhcp/dns/tftp'nin UDP kabuğu) |
| BER / ASN.1 okuyucu | `protocol-core/decoding/berReader.ts` (`readBerTlv:286`, `decodeBerInteger:343`, `decodeBerVisibleString:398`) — GOOSE için yazıldı | **snmp** — spec `:353` "SNMP ASN.1 / BER" tam karşılığı |
| EtherType/Length zinciri | `protocols/network/ethernet/ethernetFrame.ts:197` `walkTypeLengthChain` (VLAN stack dâhil) | arp (0x0806), lldp (0x88cc) taşıyıcı bağlamı |
| IP protokol tablosu | `protocols/network/ip/ipv4.ts:101-105` — **şu an sadece 1/6/17** | icmp (1) var; **icmpv6 (58) ve IPv6 Next Header YOK, eklenecek** |
| Delimiter framing | `protocol-core/framing/delimiterFraming.ts` + `createExtractor.ts` | http (CRLF/CRLFCRLF), ftp, telnet satır kırma, syslog |
| Bit cursor | `protocol-core/decoding/bitCursor.ts` | rtp/rtcp (2-bit V, 1-bit P/X, 4-bit CC), ptp (nibble alanlar), websocket (FIN/RSV/opcode) |
| Değişken uzunluk tamsayı | `protocols/network/mqtt/mqttVbi.ts` | mqtt-sn'e **doğrudan uymaz** (MQTT-SN 1/3 bayt uzunluk kullanır, VBI değil) — komşu ama ayrı |
| PCAP okuyucu | `protocol-core/capture/pcap.ts:320` `parsePcapFile` | **hiçbiri — aşağıya bak** |

## Üç mimari bulgu — dalga başlamadan karara bağlanmalı

### 1) `ParsedFrame` DÜZ; katman içiçeliği (nesting) yok

`protocol-core/types.ts:61-69` → `fields: ParsedField[]`, ve `ParsedField` (`:38`)
`children` taşımıyor. Var olan çözücüler içiçe geçmiyor, yalnız **uyarı** bırakıyor:
`WARN_ETHERTYPE_HIGHER_LAYER` (ethernet), `WARN_PROTOCOL_HIGHER_LAYER` (ipv4).

Spec `08-ag-ethernet.md:731` "Ortak Network Packet Tree" ve `:850` "Network Layer
Drill-Down" bunun tersini istiyor (Ethernet→IP→TCP→HTTP tek ağaç).

**Öneri: bu dalgada ÇÖZME.** Var olan 9 `ready` kaydın presedanı "kullanıcı o
katmanın baytlarını yapıştırır, çözücü o katmanı çözer". 19 kaydın hepsi bu desenle
yazılabilir. Nesting `ParsedFrame` şemasını, `protocol-decode` UI'ını, packet-builder'ı
ve 172 kaydın tümünü ilgilendiren ayrı bir karardır — dalga 12'ye bağlanırsa dalga
tek bir şema tartışmasında kilitlenir. Ayrı bir "Network Packet Tree" işi olarak
planlansın.

### 2) `parsePcapFile` yetim

Motor yazılmış ve test edilmiş, ama `grep -rl parsePcapFile src/` yalnız kendi
test dosyasını buluyor — **hiçbir UI'a bağlı değil**. Domain yorumu (`:6-9`) ise
"varsayılan çalışma biçimi PCAP/HEX içe aktarımı üzerinden decode" diyor.
`src/connection/` altında `file` yok (Faz 7 boşluk listesinde de yazılı).

**Öneri:** dalgayı engellemiyor (HEX yapıştırma yolu çalışıyor). Ayrı küçük iş:
`connection/file` + decode panelinde PCAP içe aktarma. Dalga 12 bittikten sonra,
çünkü o zaman 28 kaydın hepsi çözücülü olur ve PCAP'in getirisi en yüksek olur.

### 3) `websocket` kaydında `live` sekmesi var, `connection/websocket` YOK

`src/connection/` = `serial` + `mock` + `types.ts`. `websocket` kaydının
`tabs`ı `['overview','live','decode',...]`. Dalga 11'de `i2c`/`usb` için aynı
şüphe not edilmişti ve çözülmemişti.

**Öneri:** WebSocket burada özel — tarayıcının **yerleşik** `WebSocket` API'si var,
Web Serial gibi izin/donanım gerektirmiyor, ve Comm gizlilik kuralını da çiğnemiyor
(cihaz↔tarayıcı doğrudan). Yani `connection/websocket` bu domain'de gerçekten
yapılabilir tek `live`. **12f'de KARAR UYGULANDI: `live` sekmesi katalogdan
KALDIRILDI** (boş kart basmak yasak, CLAUDE.md). Özgün not: kapsam dışı tut, `live` sekmesini
"planlandı" rozetiyle bırak (Faz 7'nin §10 WebSocket maddesinde kurulan presedan).

## Alt dalga sıralaması önerisi

Aile aile kapatma + motor kaldıracı. Her alt dalga bir aileyi ya bitirir ya da
bir sonraki alt dalganın kullanacağı paylaşılan motoru açar.

| # | Kayıtlar | Neden burada | Yeni paylaşılan motor | Zorluk |
|---|---|---|---|---|
| **12a** | icmp, icmpv6 | En ucuz giriş: IP katmanı + `internetChecksum` hazır, ikisi kardeş, `internet-layer` ailesi kapanır | — (ipv4 tablosuna 58, ipv6 Next Header eklenir) | kolay |
| **12b** | arp, lldp | `data-link` kapanır. LLDP jenerik **TLV yürüyücüsü**nü açar (12c'nin DHCP option'ları aynısını ister) | `tlvWalker` | kolay–orta |
| **12c** | dns, mdns, dhcp | `addressing-discovery` kapanır. dns↔mdns aynı tel biçimi (mDNS = multicast DNS + `.local`), **name compression** tek yerde yazılır; dhcp 12b'nin TLV'sini yer | `dnsWire` (compression pointer dâhil) | orta |
| ~~**12d**~~ | ~~ntp, ptp~~ | **BİTTİ (`b149e76`).** Öngörülen ortak kaldıraç YANLIŞ ÇIKTI: NTP damgası 64 bit (32 s + 32 bit 2^-32 kesir, epoch 1900 UTC), PTP damgası 80 bit (48 bit s + 32 bit tam sayı ns, epoch 1970 TAI). Paylaşılan motor kesrin birimini tek seçip diğerini 4295 kat yanlış ölçeklerdi — 12b'nin LLDP/DHCP "TLV" hatasının aynı cinsi | ~~`networkTimestamp`~~ → `ntpTimestamp.ts` + `ptpTimestamp.ts` AYRI | orta (ptp zor) |
| ~~**12e**~~ | ~~snmp, syslog~~ | **BİTTİ (`b35cbbd`).** `time-management` KAPANDI. berReader gerçekten hazır bulundu; `oidCodec` AYRI MODÜL OLARAK açılmadı — OID ve işaretsiz tam sayı çözücüleri X.690'ın kendi tanımları olduğu için `berReader.ts`in İÇİNE kondu | ~~`oidCodec`~~ → `berReader.ts`e iki kardeş | orta |
| ~~**12f**~~ | ~~http, websocket, mqtt-sn~~ | **BİTTİ (`39b7491`).** "mqtt-sn mqtt komşusu" varsayımı KOD PAYLAŞIMI anlamına GELMİYOR: `mqttVbi.ts` uygulanamaz (MQTT-SN Length'i ya 1 bayt ya `0x01`+16 bit ve KENDİNİ DE sayar), QoS 0b11 MQTT'de hata burada −1. HTTP body framing'de iki smuggling vektörü çerçeve hatası basıyor. WS el sıkışması HTTP'ye YÖNLENDİRİLİR, zincir kurulmaz | — (paylaşım yok) | orta–zor |
| ~~**12g**~~ | ~~rtp, rtcp~~ | **BİTTİ.** `real-time-media` kapandı. `bitCursor` V/P/X/CC/M/PT için kullanıldı; jitter/loss/gap analizi calculator'a bırakıldı (12c/12d'nin çok-paketli korelasyon precedent'i). SR'nin NTP Timestamp'i `ntpTimestamp.ts`yi GERÇEKTEN paylaştı (DLSR için `readNtpShortMilliseconds` dâhil) — 12b/12d'nin ters yönü | `ntpTimestamp.ts` (paylaşım GERÇEK, yeni motor açılmadı) | orta |
| ~~**12h**~~ | ~~tftp, ftp, telnet~~ | **BİTTİ. `file-terminal` kapandı — dalga 12'nin TAMAMI bitti, `network-ethernet` domain'i kapandı.** Üçü gerçekten bağımsız çıktı (öngörülen "küçük" doğruydu); FTP/Telnet TCP'nin mesaj sınırı olmaması yüzünden `rtp.ts`nin "tek paket" kararından bilerek ayrıldı — FTP çok satırlı oturumu satır satır, Telnet tüm payload'u tek geçişte metin+IAC dizisi olarak işler | tftp'nin RRQ/WRQ↔OACK option-pair döngüsü (GERÇEK paylaşım) | kolay–orta |

**Toplam 8 alt dalga / 19 kayıt.** 12a ve 12b bilerek en başta: ucuz, hızlı yeşil,
ve 12c'nin ihtiyacı olan TLV motorunu getiriyor.

### Model önerisi (alt dalga başına)

- **12a, 12b, 12h** → Sonnet · medium (desen kurulu, tarif net)
- **12c, 12e, 12g** → Sonnet · high (paylaşılan motor tasarımı var, birkaç yol)
- **12d, 12f** → Opus · high (PTP saat modeli ve HTTP body framing'de görünmez
  değişmezler; chunked encoding + Content-Length çelişkisi klasik hata kaynağı)

## `decodeOptions` kanalı — bu domain'deki adaylar

Dalga 11 sonunda açılan kanal (`protocol-core/types.ts:308`). Çerçeveden
çıkarılamayan parametreler:

- ~~**websocket** — yön~~ → **12f: KANAL AÇILMADI, GEREK YOK.** RFC 6455 §5.1
  istemci→sunucu maskelemeyi ZORUNLU, sunucu→istemci maskelemeyi YASAK kılar;
  yani `MASK` biti yönün KENDİSİDİR, tahmin değil. Türetilmiş `direction`
  alanı bu kuralla üretiliyor ve dayanağı alan adında yazılı.
- ~~**http** — gövde çerçeveleme kipi~~ → **12f: SORU YANLIŞ KONMUŞTU.** Kip
  yanıtın KENDİ başlıklarından çıkar (`Transfer-Encoding`/`Content-Length`,
  RFC 9112 §6.3). Çerçeveden ÇIKARILAMAYAN tek şey isteğin **HEAD** olup
  olmadığıdır: HEAD yanıtı `Content-Length` taşır ama gövde TAŞIMAZ
  (RFC 9110 §9.3.2). Kanal bu tek soruya indirgendi.
- ~~**rtp** — payload type → codec eşlemesi~~ → **12g: KANAL AÇILMADI.** "SDP
  dışarıda kalır, tabloda yok" notu harfiyen uygulandı: RFC 3551 sabit tablosu
  (0-95) doğrudan gösterilir, dinamik (96-127) ve atanmamış aralık spec'in
  kendi örneğiyle (`:566`, "Unknown unless SDP/profile supplied") uyarıya
  bırakılır — kullanıcıdan codec sorup tabloya yazmak aynı tahmini dolaylı
  yoldan yapmak olurdu.
- **icmpv6** — pseudo-header için kaynak/hedef IPv6 adresi (checksum ZORUNLU,
  UDP'deki "0 = kapalı" kısayolu yok).
- **snmp** — sürüm (v1/v2c/v3); v3 tamamen farklı zarf (`spec:376`).

## Açık sorular

1. ~~**PTP `ready` olabilir mi?**~~ → **12d'de KARARA BAĞLANDI: EVET, `ready`.**
   BMCA (`spec:614`) ve PTP Analyzer (`:609`) gerçekten çoklu mesaj korelasyonu
   istiyor ve verilmedi — ama 12c'de DNS'in "Transaction Matching / Response Time /
   TTL Simulation" araçları TAM AYNI gerekçeyle analyzer'a bırakılmışken kayda
   `ready` verilmişti. LoRa presedanı (`wireless-iot.ts:169-187`) buraya UYMUYOR:
   orada parser HİÇ YOKTU ve kaydın bütün değeri hesap aracındaydı. PTP'de
   Announce'un BMCA veri kümesi alan alan çözülüyor, eksik olan yalnız
   Announce'ları KARŞILAŞTIRMA kararı — o da uyarıyla bildiriliyor.
2. ~~**SNMPv3** kapsamda mı?~~ → **12e'de KARARA BAĞLANDI: v3 DE KAPSAMDA,
   ama yalnız zarf düzeyinde.** Öneri "v3 uyarıyla dışarıda"ydı; kapsam
   GENİŞLETİLDİ çünkü spec `:376` açıkça "Security Model, Security Level,
   Engine ID, User" istiyor ve bunların hiçbiri ANAHTAR GEREKTİRMİYOR —
   msgGlobalData ile USM güvenlik parametreleri düz BER'dir. Anahtar isteyen
   tek şey şifreli ScopedPDU'dur ve o da spec `:377`nin dediği gibi
   "Encrypted / Unable to decode payload" bırakıldı. Kimlik doğrulama ve şifre
   çözme YAPILMIYOR (`ntp.ts`in MD5 özetini doğrulamama kararının aynı cinsi).
3. **`ipv4.ts` PROTOCOL_NAMES tablosu genişletilecek mi, ayrı modüle mi taşınacak?**
   12a iki numara ekliyor; 12c/12g daha fazlasını isteyecek. Öneri: 12a'da
   `ipProtocolNumbers.ts`'e taşı, ipv4+ipv6 ortak kullansın.
4. ~~**Telnet `live`?**~~ → **12h: KARARA BAĞLANDI.** `tabs`ında `live` yok,
   doğru kalıyor. Decode girdisi "yapıştırılan TCP payload'u" varsayıldı —
   `telnet.ts` dosya başı yorumunda yazılı; düz metin ile IAC komutları tek
   geçişte, satır kavramı OLMADAN (FTP'nin satırlarından farklı olarak)
   ayrıştırılıyor.

## Kaynak satır haritası (spec `08-ag-ethernet.md`)

arp `:80-93` · lldp `:695-712` · icmp `:158-169` · icmpv6 `:170-178` ·
dhcp `:270-290` · dns `:291-314` · mdns `:713-730` · ntp `:315-349` ·
ptp `:582-616` · snmp `:350-378` · syslog `:677-694` · http `:379-401` ·
websocket `:402-435` · mqtt-sn `:477-494` · rtp `:529-569` · rtcp `:570-581` ·
tftp `:617-634` · ftp `:635-661` · telnet `:662-676`

Domain geneli araçlar (kayıt başına değil, ileride ayrı iş): `:731` Packet Tree ·
`:757` Flow Analyzer · `:773` Checksum Validation Engine · `:776` Pseudo-Header
görünümü · `:824` TCP Stream Viewer · `:836` Topology Builder
