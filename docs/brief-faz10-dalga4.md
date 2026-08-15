# BRİF — ALP Comm Toolkit, Faz 10 dalga 4 (Ethernet · TCP/IP ailesi · MQTT · CoAP · PCAP)

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform`, `~/Desktop/alp-pcb-toolkit`.

## Durum
Bu brif dalga 3 bittikten sonra yazıldı. Son commit `4f2b55a` (dalga 3d MAVLink —
dalga 3 tamam). Sayılar: **2133 birim testi (127 dosya), 193 Playwright testi
(23 e2e dosyası), 22 kayıtlı plugin**, katalog bekçisi 8/54/172 yeşil
(`src/tests/catalog.test.ts:13-19` — dosya `src/app/catalog/` altında DEĞİL).
Registry (alfabetik): ais, can-2-0a, can-2-0b, can-fd, can-xl, canopen, doip,
gnss-ubx, iso-14230, iso-9141, iso-tp, j1939, lin, mavlink, modbus-ascii,
modbus-rtu, modbus-tcp, nmea-0183, nmea-2000, obd-ii, rtcm, uds.
Araya başka iş girerse başlamadan hash'i ve listeyi güncelle.

Bu dalga sonunda (4a-4d) 9 yeni plugin: ethernet-ii, ieee-802-3, vlan-802-1q,
ipv4, ipv6, udp, tcp, mqtt, coap → 31. PCAP plugin DEĞİLDİR (aşağıda).
Yeni dizin gerekir: `src/protocols/network/` (mevcutlar: aerospace, automotive,
industrial, marine). Kategori deseni `plugin.category = domain id` →
`'network-ethernet'` (`src/protocols/index.test.ts:32` EXPECTED_CATEGORY).

## Bu dalganın dört rayı + bir dosya formatı — PCAP'ın türü FARKLI

```
A) Ethernet katmanı  : ethernet-ii · ieee-802-3 · vlan-802-1q — TEK parser, ÜÇ
   plugin (canClassic'in iki-plugin-tek-parser emsali). Ayrım mekanik: MAC
   header'daki 2 baytlık alan ≤ 0x05DC ise 802.3 length, ≥ 0x0600 ise EtherType
   (spec 25547-25601); 0x8100 görülürse VLAN tag araya girer.
B) IP ailesi         : ipv4 · ipv6 · udp · tcp — ortak YENİ yardımcı: RFC 1071
   16-bit internet checksum (aşağıda: mevcut onesComplementChecksum 8-BİT, o değil).
C) TCP üstü uygulama : MQTT — YENİ yardımcı: Variable Byte Integer (repo'da
   varint/VBI YOK, grep boş döndü).
D) UDP üstü uygulama : CoAP — bit alanları için `protocol-core/decoding/bitCursor.ts`
   HAZIR (dalga 3'te RTCM'de kullanıldı).
E) PCAP              : protokol değil DOSYA formatı. Katalogda kaydı YOK (172'nin
   içinde pcap id'si yok); spec'te yalnız "PCAP import" olarak geçer. Decode
   sekmesine bağlanacak bir motor değil — kapsam kararı aşağıda (karar 5).
```

Hazır parçalar:
- `src/protocol-core/checksums/crcCatalogue.ts:136` — `CRC32` girdisi (check
  0xCBF43926, reflected). Ethernet FCS algoritması BUDUR — yeni CRC yazma.
- `src/protocol-core/checksums/simpleChecksums.ts:62` — `onesComplementChecksum`
  8-bit'tir (test: 01 02 03 → 0xF9). Internet checksum İÇİN KULLANMA; RFC 1071
  16-bit yardımcıyı `checksums/`a yeni ekle + katalog/test.
- `src/protocols/aerospace/mavlink/mavlink.ts:65-69,151` — "doğrulanamayan
  checksum" deseni (`crcNeedsDialect`, alan `valid: true` + uyarı, mismatch
  ASLA basılmaz). TCP/UDP pseudo-header checksum'ının birebir emsali.
- CAN `suggestHigherLayers` uyarı tonu — EtherType/IPv4-Protocol alanlarının
  "üst katmanı şu sayfada çöz" yönlendirmesinin emsali.
- `doip.ts` (1465 satır) — TCP üstü mesaj motoru iskelet emsali; `modbus-tcp` —
  MBAP emsali.

## Spec kapsam tablosu (keşif turunda çıkarıldı; ana spec 42 975 satır)

| Konu | Durum |
|---|---|
| Ethernet II alan düzeni (DST 6 / SRC 6 / TYPE 2 / payload / FCS 4) | **VAR** (25326-25330 tablo; 38933 §28.1 listesi) |
| EtherType değerleri 0x0800/0x0806/0x86DD/0x8100 | **VAR** (25410-25416) |
| Ethernet çerçeve örneği (broadcast ARP) | **KISMİ** — payload `...` ile kesik (25430-25460); ilan edilmiş fixture değil |
| Ethernet FCS: CRC-32 doğrulama + "FCS not captured" üçlü durumu | **VAR** (25462-25497) — spec YES/NO/Unknown ayrımını ve "not captured" ifadesini kendisi şart koşuyor |
| IEEE 802.3 length yorumu (2 baytlık alanın iki okunuşu) | **VAR** (25547-25601) |
| VLAN TCI bit düzeni (PCP 3 / DEI 1 / VID 12) + TPID + stacking şartı | **VAR** (25678-25696; stacking 25781-25812) |
| IPv4 başlık alan listesi + IHL/Version ayrıntısı | **VAR** (25963-25990; 25995-26059); tam bit genişlikleri RFC 791'den |
| IPv4 header checksum doğrulama şartı (PASS/FAIL) | **VAR** (26157-26179; 38955) |
| IPv4 Protocol numaraları 1/6/17 | **VAR** (26131-26144) |
| IPv4/IPv6 fragmentation + reassembly görünümü | **VAR ama ANALYZER işi** (26181-26277) — çok paket ister, parser'a girmez |
| IPv6 başlık alanları + "checksum yok, N/A göster" | **VAR** (26333-26358; 26427-26441) |
| TCP başlık alan listesi (min 20 B) + 8 flag | **VAR** (26838-26868; 26870-26906); bit offset'leri RFC 9293'ten |
| UDP başlığı ASCII diyagram + length semantiği | **VAR** (26689-26706; 26709-26726) |
| TCP/UDP checksum = pseudo-header + header + payload | **VAR kavramsal** (26728-26734; 31052-31074 Pseudo-Header Görünümü) — tek segmentten DOĞRULANAMAZ, karar 2 |
| MQTT fixed header (type+flags, Remaining Length "variable-byte") | **VAR kavramsal** (28583-28627) — bit konumları ve VBI algoritması YOK → OASIS |
| MQTT 15 paket tipi adı (CONNECT…AUTH) + §28.5 asgari küme | **VAR** (28631-28661; 38994-39018) — sayısal tip değerleri YOK → OASIS |
| MQTT CONNECT/v5 Properties alan ADLARI | **VAR** (28667-28700; 28859-28886) — bayt düzeni/property id'leri YOK → OASIS |
| MQTT sürüm: "v5 profile'ına göre desteklenmeli", 3.1.1 "pratikte önemli" | **VAR** (28663; 28561) |
| CoAP 4 bayt başlık BİT DİYAGRAMI (Ver/T/TKL, Code, MID) + Token/Options/0xFF sırası | **VAR** (29073-29100) — bu beşlinin spec'teki en eksiksiz bayt düzeni |
| CoAP mesaj tipleri CON/NON/ACK/RST + Code=class.detail gösterimi | **VAR adlar** (29119-29138; 29177-29198) — sayısal değerler/registry YOK → RFC 7252 |
| CoAP Options: ad listesi + "delta/length compact encoding bit/byte açılmalı" | **ŞART VAR, KODLAMA YOK** (29221-29246) — delta/extended kuralları RFC 7252'den |
| CoAP 0xFF payload marker | **VAR** (29249-29268) |
| PCAP: global header / magic 0xA1B2C3D4 / endianness / per-packet header | **YOK tamamen** — spec'te pcap yalnız import formatı adı (25204; 38931; 39245-39249 §34; 39767 V1.4; 39843 Phase 9) → libpcap dokümanı |
| PCAPNG | **ADI VAR** (39249; 34308) — yapısı yok; kapsam kararı 5 |
| §43 fixture (bu beşli için) | **YOK** — §43 başlıkları CRC/UART/Modbus RTU/NMEA/Custom/J1939/IEEE-754 (39606-39679); ağ protokolü fixture'ı yok |

Spec'in ağ bölümüne özgü GERİLİM: §3.8 girişi "aynı paketi katman katman
açıklamalı" der (25204), EtherType için "recursive parser'a geçmelidir" (25418),
IPv4 Protocol için "sonra UDP parser'a geçmelidir" (26144). Bu, dalga 1'in
"motorlar zincir KURMAZ" kararıyla (brief-faz10-dalga2.md:25) çelişir → karar 1.

## Kaynak uyarısı — dış kaynaklar bu dalgada HEPSİ açık standart

Dalga 2b'nin lisans tablosundan farklı olarak burada lisanslı/kapalı içerik YOK:

| Konu | Kaynak | Erişim | Güven |
|---|---|---|---|
| IPv4/IPv6/TCP/UDP bit düzenleri, internet checksum | RFC 791, 8200, 9293, 768, 1071 | IETF, kamuya açık | En yüksek |
| MQTT tip numaraları, flags bitleri, VBI algoritması, v5 property id'leri | OASIS MQTT 5.0 + 3.1.1 standardı | Kamuya açık HTML | Yüksek |
| CoAP tip/kod değerleri, option numaraları, delta/extended kodlama | RFC 7252 | IETF, kamuya açık | Yüksek |
| Ethernet II/802.3 alan düzeni | Spec zaten veriyor; IEEE 802.3 metni ücretlidir ama gereken her şey spec'te + kamu kaynaklarında | — | Yüksek |
| PCAP global/per-packet header, magic varyantları (µs/ns, endian-swapped) | libpcap/tcpdump dokümanı + IETF opsawg pcap belgesi | Kamuya açık | Yüksek; ns-magic ve varyant ayrıntısını iki kaynaktan çapraz doğrula |

Dalga 2 kuralı geçerli: dış kaynaktan alınan her sabit dosya başı JSDoc'ta
kaynağıyla anılır; fixture uydurma yasak — sentetik örnek çerçevelerin
checksum'ları motordan BAĞIMSIZ hesapla kanıtlanır (UBX 3c emsali).

## Katalog yolları (doğrulandı — `src/app/catalog/domains/`)

| Yol | Rol | Not |
|---|---|---|
| `network-ethernet/data-link/ethernet-ii` | kanonik (network-ethernet.ts:32) | tabs: overview, decode, build, timing, diagnostics, examples |
| `network-ethernet/data-link/ieee-802-3` | kanonik (:56) | tabs: overview, decode, build, diagnostics, examples |
| `network-ethernet/data-link/vlan-802-1q` | kanonik (:74) | tabs: overview, decode, build, diagnostics, examples |
| `network-ethernet/internet-layer/ipv4` | kanonik (:156) | tabs: overview, decode, build, diagnostics, examples |
| `network-ethernet/internet-layer/ipv6` | kanonik (:179) | aynı tab kümesi |
| `network-ethernet/transport/udp` | kanonik (:257) | + timing sekmesi |
| `network-ethernet/transport/tcp` | kanonik (:280) | + timing sekmesi |
| `network-ethernet/web-messaging/mqtt` | kanonik (:528) | tabs: overview, live, decode, build, timing, data, diagnostics, examples |
| `network-ethernet/web-messaging/coap` | kanonik (:573) | aynı tab kümesi |
| `wireless-iot/iot-messaging/mqtt` | alias → `network-ethernet/web-messaging/mqtt` (wireless-iot.ts:321) | |
| `wireless-iot/iot-messaging/coap` | alias → `network-ethernet/web-messaging/coap` (:341) | |
| PCAP | **katalogda YOK** | network-ethernet.ts:8 yorumu: domain'in varsayılan çalışma biçimi "PCAP/HEX içe aktarımı üzerinden decode" — pcap bir sayfa değil |

Hiçbirinde `definitions` alanı/sekmesi YOK → bu dalga definitions kablolamasına
dokunmaz. Alias kaydına `pluginId`/`status` YAZMA — zincirden türer; iki alias'ın
sayfa devralma testi (j1939-decode'un alias testi emsali) e2e'ye girer.

Kapsam DIŞI kalan komşular (planned kalır, dokunma): `mqtt-sn` (:553), `arp`,
`lldp`, `icmp`, `icmpv6`, `interfaces-framing/.../ethernet-interface` ve
`single-pair-ethernet`, `automotive/.../automotive-ethernet`, `xcp-on-ethernet`,
`industrial-automation/.../ethernet-ip` (bu sonuncusu EtherNet/IP = CIP —
adı bu dalganın "Ethernet+IP"i DEĞİL, karıştırma).

## BEKÇİ BORCU — YOK

e2e genelinde beş konunun hiçbir katalog yolu geçmiyor (grep boş). İki
`PLANNED_DECODE_PATH` sabiti var ve ikisi de bu dalganın dışında:
`e2e/modbus-decode.spec.ts:36` → psi5, `e2e/nmea-decode.spec.ts:35` → iec-61162
(dalga 3'te taşınmıştı). İkisine de dokunulmaz; yeni taşıma gerekmez.

## Kapsam bölmesi

Dört motor dalgası + karara bağlı bir dosya-formatı dalgası. Sıra bilinçli:
adlandırma zinciri yukarıdan aşağı tutarlı kalsın diye katmandan yukarı çıkılır.

- **4a**: Ethernet II + IEEE 802.3 + VLAN 802.1Q — tek parser, üç plugin
- **4b**: IPv4 + IPv6 + UDP + TCP — internet checksum yardımcısı burada doğar
- **4c**: MQTT — VBI yardımcısı burada doğar
- **4d**: CoAP — bitCursor hazır, en kapalı iş
- **4e**: PCAP — karar 5'e bağlı; yapılırsa `protocol-core` saf parser + test

### Yapılacaklar

**4a — Ethernet ailesi** (`src/protocols/network/ethernet/`)
1. Tek `parseEthernetFrame`: DST/SRC MAC (format `AA:BB:..`, broadcast/multicast
   türü — spec 25378), 2 baytlık alan dallanması (EtherType ≥ 0x0600 / length
   ≤ 0x05DC; 1501-1535 arası tanımsız → uyarı, hata değil), 0x8100'de TCI çöz
   (PCP/DEI/VID) ve iç EtherType'a kay; stacked tag desteği sınırlı (en çok 2-3,
   sonrası uyarı — spec 25781 recursive der ama sınır koy). EtherType adlandırma
   dar küme (0x0800/0x0806/0x86DD/0x8100 + görülen yaygınlar); payload HAM +
   üst-katman-adayı uyarısı (karar 1'e göre ton).
2. FCS: karar 3'e göre. Spec'in üçlü durumu (Present YES/NO/Unknown) alan
   olarak modellenir; doğrulama yapılırsa `CRC32` katalog girdisiyle.
3. Üç plugin kaydı + registry + katalog pluginId/status + `e2e/ethernet-decode.spec.ts`.

**4b — IP ailesi** (`src/protocols/network/ip/`, `.../transport/` ya da tek dizin —
dizin düzenini marine'deki komşuluklara bakıp seç)
4. YENİ `internetChecksum` (RFC 1071): 16-bit one's-complement, tek bayt kalanda
   sıfır dolgu; `checksums/`a + katalog + bağımsız test vektörü.
5. IPv4: Version/IHL (IHL<5 → hata; total length < IHL·4 → hata), DSCP/ECN,
   Identification/Flags/FragmentOffset (alan olarak çözülür; REASSEMBLY YOK —
   çok paket analyzer işi, spec 26219), TTL, Protocol (1/6/17 adlandırma +
   üst-katman uyarısı), header checksum TAM DOĞRULANIR (PASS/FAIL — spec 26157
   açık şart), adresler, Options ham. `status: 'ready'`.
6. IPv6: sabit 40 bayt başlık; checksum alanı YOK — spec 26427 "N/A göster" der.
   Extension header ZİNCİRİ: yalnız Next Header numarası adlandırılır, zincir
   yürüyüşü dar tutulur (bilinen ext başlıklarında uzunluk alanıyla atla,
   bilinmeyende dur + uyarı — sonsuz döngü koruması, spec 26397). `'ready'`.
7. UDP: 8 bayt başlık, length tutarlılığı (min 8, payload = length−8);
   checksum karar 2'ye göre ham + uyarı. IPv4'te checksum 0x0000 = "yok"
   bilgisi alan notu olur. `status` karar 2'ye bağlı.
8. TCP: sabit alanlar + Data Offset (min 5; buffer'la tutarlılık), 8 flag bit
   paneli + anlam satırı (spec 26890-26906), Window/Urgent, Options ham
   (kind adlandırma dar küme opsiyonel). Checksum karar 2. Seq/ack İLİŞKİSİ
   kurulmaz — handshake/retransmission/stream reassembly (26908-27155)
   analyzer işi, parser'a koyma.
9. Dört plugin + e2e'ler; tek commit büyükse ip/transport diye ikiye böl.

**4c — MQTT** (`src/protocols/network/mqtt/`)
10. YENİ VBI yardımcısı: 7 bit + devam biti, EN ÇOK 4 bayt (üst sınır
    268 435 455); 4 bayttan sonra devam biti → `malformed`. Hem Remaining
    Length hem v5 Properties Length bunu kullanır. Bağımsız test vektörleri
    (OASIS'teki 0x7F/0x80,0x01 örnekleri).
11. Fixed header: üst nibble tip (1-15 adlandır; 0 → hata), alt nibble flags
    (PUBLISH'te DUP/QoS/RETAIN aç; QoS=3 → hata; diğer tiplerde sabit-flags
    kuralı ihlali → uyarı/hata karar 4 tonu). Variable header çözümü tipe göre:
    en az CONNECT (Protocol Name/Level, Connect Flags, Keep Alive) ve PUBLISH
    (Topic, Packet Id QoS>0'da) — §28.5 asgari kümesi (38994). Kalan tiplerde
    yapı ham + adlandırılmış tip. Sürüm dallanması karar 4.
12. Girdi TEK kontrol paketi baytlarıdır (TCP stream birleştirme YOK — dalga 1
    çizgisi); "TCP akışından tek paket" notu overview/uyarı tonunda.

**4d — CoAP** (`src/protocols/network/coap/`)
13. 4 bayt başlık bitCursor'la: Ver (≠1 → uyarı), Type (0-3 CON/NON/ACK/RST),
    TKL (9-15 → format hatası — RFC kuralı), Code (class.detail gösterimi —
    spec 29177 raw+semantic ikisini de ister), Message ID. Token (TKL bayt).
14. Options döngüsü: delta/length nibble; 13 → +1 bayt ext (−13), 14 → +2 bayt
    ext (−269), 15 → yalnız 0xFF payload marker bağlamında geçerli, aksi hata
    (RFC 7252 kuralları — dış kaynak, dosya başında anılır). Option numarası →
    dar ad kümesi (spec 29221'deki liste: Uri-Host/Uri-Path/Content-Format…).
15. 0xFF sonrası boş payload → hata (RFC: marker varsa payload zorunlu).
    Observe/Block çözümü YOK (spec kendisi "extension enabled where" der) —
    yalnız option adı. `status: 'ready'` (başlık+options tam çözülür).

**4e — PCAP** (karar 5 kabulüne göre; öneri `src/protocol-core/capture/pcap.ts`)
16. Saf fonksiyon: magic'ten endianness + zaman birimi (0xA1B2C3D4 µs,
    0xA1B23C4D ns, swapped varyantlar), version, snaplen, linktype; per-packet
    header (ts, incl_len, orig_len; incl_len < orig_len → "truncated" işareti);
    paket listesi `Uint8Array` dilimleri. PCAPNG (0x0A0D0D0A) TANINIR ve
    "pcapng desteklenmiyor" hatasıyla reddedilir. UI entegrasyonu BU DALGADA
    YOK (karar 5 aksini demezse) — motor/katalog/e2e dokunulmaz, yalnız birim test.

### Verilmesi gereken kararlar (dalga başında sor, kendiliğinden seçme)

1. **Katman zinciri istisnası var mı?** Spec ağ bölümünde recursive decode ister
   (25204/25418/26144); dalga 1 kararı "motorlar zincir kurmaz". Eğilim: karar
   KORUNUR — her motor kendi PDU'sunu çözer (ethernet-ii girdisi Ethernet
   çerçevesi, ipv4 girdisi IP paketi, tcp girdisi TCP segmenti); EtherType/
   Protocol/Next Header alanları adlandırılır + "payload'ı şu sayfada çöz"
   uyarısı (suggestHigherLayers emsali). Katman katman tek görünüm §34 Log
   Analyzer'ın işidir, bu dalgada kurulmaz. Bu karar 2'yi de belirler.
2. **TCP/UDP checksum:** pseudo-header IP başlığı ister; standalone segment
   girdisinde yok → doğrulama İMKÂNSIZ. Eğilim: MAVLink emsali —
   checksum ham + `checksumNeedsPseudoHeader` uyarısı, `checksum-mismatch`
   ASLA basılmaz; TCP/UDP `status` yine 'ready' tartışılır çünkü eksik olan
   motor değil girdinin doğası (MAVLink'ten farkı: orada dialect YÜKLENEBİLİR,
   burada tek-PDU sözleşmesi gereği pseudo-header hiç gelmeyecek). Karar:
   'ready' mi 'partial' mı + zincir istisnası seçilirse doğrulama geri gelir mi.
3. **Ethernet FCS varsayılanı:** son 4 baytın FCS mi payload mu olduğu tek
   çerçeveden bilinemez; çoğu capture FCS'siz gelir. Spec tonu hazır (25462:
   YES/NO/Unknown, "FCS not captured"). Seçenekler: (a) FCS hiç varsayılmaz,
   "FCS not captured" bilgisi basılır; (b) son 4 bayt CRC-32'yle tutuyorsa
   fırsatçı "FCS present, PASS". Eğilim: (a) + fırsatçı eşleşmede yalnız
   BİLGİ notu ("son 4 bayt CRC-32 ile uyuşuyor") — yanlış pozitif riski
   (2⁻³²) hatayı değil notu hak eder.
4. **MQTT sürüm kapsamı:** spec v5 profili der (28663), 3.1.1 "pratikte
   önemli" (28561). Eğilim: tek parser; CONNECT'te Protocol Level (4/5)
   okunur, v5'e özgü alanlar (properties) yalnız Level 5'te aranır; CONNECT
   dışındaki paketlerde sürüm bilinemez → properties çözümü "v5 varsayımı"
   uyarısıyla mı, ham mı? İkincil soru: v5 Properties TLV'si alan alan mı
   (dar id kümesi, OASIS açık) yoksa ham blok mu? Eğilim: alan alan.
5. **PCAP kapsamı ve yeri:** katalogda kaydı yok, motor olamaz. Seçenekler:
   (a) 4e olarak yalnız `protocol-core/capture` saf parser + birim test
   (UI'sız temel taş); (b) decode sekmesine "dosyadan içe aktar" UI'sıyla
   birlikte; (c) tamamen sonraya (Log Analyzer §34 fazına) erteleme.
   Eğilim: (a) — Phase 9 listesi PCAP'ı sayıyor (39843), ama UI entegrasyonu
   §34'ün bütünüyle gelmeli. PCAPNG her durumda tanı-ve-reddet.

## Tuzaklar — önceki dalgalardan taşınanlar + bu dalgaya özgüler

- **`onesComplementChecksum` internet checksum DEĞİL** — 8-bit'tir. RFC 1071
  16-bit yardımcıyı yeni yaz; tek bayt kalan (odd length) sıfır dolgusu ve
  "checksum alanı hesapta 0 sayılır" kuralını teste bağla.
- **UDP checksum özel durumları:** IPv4'te 0x0000 = "checksum yok" (hata değil);
  hesap sonucu 0 çıkarsa telde 0xFFFF taşınır. Doğrulama yazılırsa (karar 2)
  iki özel durum da şarttır.
- **VLAN tag EtherType'ı 4 bayt kaydırır** — tag'li çerçevede payload offset'i
  ve "gerçek" EtherType içteki alandır; ParsedField offset'lerini kaydırmayı
  unutma (bayt-viewer çakışmasında sonra gelen kazanır).
- **802.3'ün 2 baytlık alanı:** 1501-1535 aralığı ne length ne EtherType —
  uyarı bas, hata basma; çerçeveyi çözmeye devam et.
- **EtherNet/IP ≠ Ethernet+IP** — industrial-automation'daki `ethernet-ip`
  CIP protokolüdür; katalog/çeviri/e2e'de bu ada dokunma.
- **MQTT VBI en çok 4 bayt** — 5. devam baytı malformed; VBI'yi hem remaining
  length hem property length yolunda aynı yardımcıdan kullan (iki kopya yazma).
- **MQTT tip 0 reserved** → hata; PUBLISH dışındaki tiplerin sabit flags
  nibble'ı vardır (ör. PUBREL 0b0010) — ihlali sessiz geçme.
- **CoAP nibble 15:** option delta/length'te 15, payload marker dışında
  "message format error"dur; 0xFF'ten sonra boş payload da hatadır.
- **CoAP TKL 9-15 reserved** → hata; Ver ≠ 1 → uyarı (sessiz ret yok).
- **PCAP dosyadır, çerçeve değil** — decode sekmesi tek PDU bekler; pcap'ı
  motor olarak kaydetme, katalog 172 bekçisi ve `pluginBinding` buna göre
  kurulmadı. Endianness magic'ten türetilir; ns-magic varyantını unutma.
- **Fragmentation/handshake/reassembly analyzer işidir** — IPv4 fragment
  birleştirme (26219), TCP stream reassembly (27082), MQTT oturum analizi
  (28889) parser'a KONMAZ; alanlar + metadata yeter (MAVLink seq emsali).
- 32-bit alan okumalarında `>>> 0` (TCP seq/ack, CRC-32); IPv6 adresi bigint'e
  çevirme, string formatla (RFC 5952 kısaltması opsiyonel, abartma).
- Çeviri anahtarı segmentinde tire olamaz (canopen `SUMMARY_KEY_SUFFIXES`
  emsali); `ieee-802-3`/`vlan-802-1q` gibi id'lerden anahtar üretirken dikkat.
- `ParsedField` = `offset`/`length`; `ProtocolErrorCode` kapalı union (yeni hata
  kodu eklerken union'ı genişlet); uyarı kodu serbest metin anahtarı.
- `src/tests/catalog.test.ts` 8/54/172 + alias bütünlüğü + definitions↔formats
  bekçileri; alias'a pluginId/status yazma. `index.test.ts:94` her plugin'e
  örnek çerçeve şart — örnekler bağımsız checksum kanıtıyla gelir.
- `noUncheckedIndexedAccess`; yorum TR / tanımlayıcı EN; ham renk yok;
  protokol adları veridir.
- Playwright `/comm/` + 4319 + `reuseExistingServer: false`; dev 3001.
- Her alt dalga sonunda iki dilli, tüm örnekli tarayıcı turu (geçici
  `_tour.spec.ts` deseni — sonunda silinir).

## Çalışma kuralları
Dalga 2-3 brifleriyle aynı: fixture uydurma yasağı, dış kaynak disclosure'ı
(dosya başı JSDoc), commit serbest / push onaylı, keşif subagent'a, 200K'da
oturumu böl.

## Öneri

| Dalga | İçerik | Model · effort |
|---|---|---|
| 4a | Ethernet II + 802.3 + VLAN (tek parser, üç plugin) | Sonnet · high |
| 4b | IPv4 + IPv6 + UDP + TCP (+ internetChecksum) | Sonnet · high |
| 4c | MQTT (+ VBI yardımcısı) | Sonnet · high |
| 4d | CoAP | Sonnet · medium |
| 4e | PCAP saf parser (karar 5 kabulünde) | Sonnet · high |

4a/4b **high**: tarif net ama dallanma seçenekleri var (802.3/EtherType eşiği,
VLAN stacking sınırı, checksum karar uygulaması dört motora yayılıyor). 4c
**high**: VBI + tip-başına variable header dallanması + sürüm sorusu. 4d
**medium**: kararlar dalga başında kapanınca CoAP tek yollu mekanik üretim —
bit düzeni spec'te, options kuralları RFC'de eksiksiz. 4e **high**: iş küçük
ama tür yeni (repo'daki ilk dosya-formatı parser'ı), yerleşim emsalsiz.
Opus gerekmez: beş karar da dalga başında kullanıcıyla kapanacak kadar dar;
spec keşfi bu brifte bitti.
