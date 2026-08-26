# BRİF — Faz 10 dalga 18d, `thread`

> **Ana brif: `docs/brief-faz10-dalga18.md`.** Kapsam `[KARAR 18-3]`, çekirdek
> çıkarma `[KARAR 18-1]`, `canParse` ölçümü (T1-T7) orada.
>
> **Model/effort: Opus · xhigh.**
> 18a/18b/18c'den BAĞIMSIZDIR — sırayı bozabilir; ama `zigbee.ts`e DOKUNDUĞU
> için `npm test` TAM koşmadan bitirilmez.

---

## Bu alt dalganın işi

802.15.4 üstündeki Thread yığınının **okunabilir kısmını** çözmek:
MAC (+ Auxiliary Security Header) → 6LoWPAN → IPv6 → UDP → **MLE
sınıflandırması**. MLE gövdesi şifrelidir ve ÇÖZÜLMEZ.

---

## Görev 0 — 802.15.4 MAC ÇEKİRDEĞE ÇIKARILIR (İLK İŞ)

`[KARAR 18-1]`: `zigbee.ts`in MAC okuyucusu
**`src/protocol-core/framing/ieee802154Frame.ts`**e taşınır.

| Taşınır | Kalır (`zigbee.ts`te) |
|---|---|
| FCF bit sabitleri (`zigbee.ts:99-160`) | NWK / APS / ZCL'in tamamı |
| `macAddressLength` (:616), `formatMacAddress` (:622), `planMacAddressing` (:634) | `ZCL_CLUSTERS` kütüphanesi |
| `formatEui64` (:609) — EUI-64 ters/ayraçlı gösterim | Zigbee'ye özel uyarı metinleri |
| FCS hesabı (`fcsFor`, :1250-1253) | `zigbeeParser` / `zigbeePlugin` |
| **Başlık uzunluğu hesabı** (bugün `parseZigbeeFrame` içinde gömülü) | |

**TAŞINMAZ:** Auxiliary Security Header — `zigbee.ts` onu ayrıştırmıyor
(Zigbee MAC'te güvenlik kullanmaz), Thread'e özeldir, `thread/` altında yaşar.
Emsal `pulseLog.ts:6-30`: *"yalnız KONTEYNERİN KENDİSİ taşındı; türetme
protokole özeldir ve TAŞINMADI."*

> **GERİ DÖNÜŞ ŞARTI:** taşımadan sonra `npm test` TAM koşar. `zigbee.test.ts`
> (106 örnek çerçeve) kırılırsa **taşımadan VAZGEÇ**, Thread kendi okuyucusunu
> yazsın ve gerekçe dosya başına yazılsın. Zorlama birleştirme `ccp.ts`in
> reddettiği şeydir (CLAUDE.md dalga 16a notu).

---

## Girdi sözleşmesi

> Girdi = **TAM IEEE 802.15.4 MAC çerçevesi + FCS** — `zigbee` ile AYNI
> sözleşme. libpcap'te bu `LINKTYPE_IEEE802_15_4_WITHFCS` = **195**
> (`LINKTYPE_IEEE802_15_4_NOFCS` = 230, TAP = 283, Linux = 191, NONASK_PHY = 215).
> `[KANIT]` `https://www.tcpdump.org/linktypes.html`
>
> **OpenThread'in kendi sniffer'ı VARSAYILAN OLARAK 195 yazar**, `--tap` ile
> 283 `[KANIT]` `openthread/pyspinel/sniffer.py:52-53, 251`.
> TAP (283) sözde başlığı ve ZEP kapsüllemesi **KAPSAM DIŞI** — ayrı konteyner.

---

## Çerçeve tablosu

### A — IEEE 802.15.4 MAC (çekirdekten)

`[KANIT]` gerçek yakalamadan doğrulanmış FCF: `41 cc` → `0xCC41` →
type = 1 (Data), Security = 0, PAN ID Compression = 1, destMode = 3 (64 bit),
frameVersion = 0, srcMode = 3 (64 bit) ⇒ başlık = 3 + 2 + 8 + 0 + 8 = **21 B**.

### B — Auxiliary Security Header (YALNIZ `Security Enabled = 1`)

`[KANIT]` `packet-ieee802154.c:3011` *"Existence of the Auxiliary Security
Header is controlled by the Security Enabled Field"*.

| Alan | Bayt | Not |
|---|---|---|
| Security Control | 1 | bit 0-2 **Security Level** (0-7), bit 3-4 **Key Identifier Mode** (0-3), bit 5 Frame Counter Suppression, bit 6 ASN in Nonce |
| Frame Counter | 4 (LE) | Suppression = 1 ise YOK |
| Key Identifier | 0 / 1 / 5 / 9 | Key ID Mode 0 ⇒ 0 · 1 ⇒ 1 (Key Index) · 2 ⇒ 5 (4 kaynak + 1 indeks) · 3 ⇒ 9 (8 kaynak + 1 indeks) |

**MIC uzunluğu Security Level'dan gelir:** 0 → 0 · 1 → 4 · 2 → 8 · 3 → 16 ·
4 → 0 · 5 → 4 · 6 → 8 · 7 → 16. Level ≥ 4 ⇒ **şifreli**.
Şifreliyse yük ham + `encryptedPayload`; MIC ayrı bir alan olarak basılır ama
**PASS/FAIL BASILMAZ** (anahtar yok — dalga 13 dersi 3, `mode-s` AP emsali).

> **TUZAK:** MIC çerçevenin SONUNDA, FCS'ten ÖNCE durur. Yük uzunluğu
> hesaplanırken `MIC` çıkarılmazsa şifreli yük 4-16 bayt uzun görünür,
> HATA VERMEDEN.

### C — 6LoWPAN dispatch (RFC 4944 §5.1, birebir)

```
| 00  xxxxxx | NALP       - Not a LoWPAN frame               |
| 01  000001 | IPv6       - Uncompressed IPv6 Addresses      |
| 01  000010 | LOWPAN_HC1 - LOWPAN_HC1 compressed IPv6       |
| 01  010000 | LOWPAN_BC0 - LOWPAN_BC0 broadcast             |
| 01  111111 | ESC        - Additional Dispatch byte follows |
| 10  xxxxxx | MESH       - Mesh Header                      |
| 11  000xxx | FRAG1      - Fragmentation Header (first)     |
| 11  100xxx | FRAGN      - Fragmentation Header (subsequent)|
```
RFC 6282 §3.1 **IPHC** için `011 xxxxx`i ayırıyor (RFC 4944'ün ESC'sini
`01 000000`a taşıyarak).

Wireshark'ın sabitleri örtüşüyor `[KANIT]` `packet-6lowpan.c:50-58`:
`LOWPAN_PATTERN_IPHC 0x03` (3 bit) · `MESH 0x02` (2 bit) ·
`FRAG1 0x18` / `FRAGN 0x1c` (5 bit).

**Başlık yığını SIRALI okunur:** Mesh → Broadcast → Fragment → IPHC/IPv6.

#### C.1 — Mesh Addressing Header (`10 xxxxxx`)

bit 5 **V** (0 = Originator EUI-64, 1 = 16 bit) · bit 4 **F** (aynısı Final
Destination için) · bit 0-3 **Hops Left**; **`0xF` ⇒ hemen ardından 8 bitlik
"Deep Hops Left"** `[KANIT]` RFC 4944 §5.2.

#### C.2 — FRAG1 / FRAGN

```
FRAG1: |1 1 0 0 0| datagram_size (11) | datagram_tag (16) |
FRAGN: |1 1 1 0 0| datagram_size (11) | datagram_tag (16) | datagram_offset (8) |
```
`datagram_offset` **8 oktet katları**dır.

> **🏆 GERÇEK YAKALAMAYLA ÇAPRAZLANDI:** aynı yakalamanın FRAG1'i
> `c1 09 00 02` → size = `((0xC1 & 0x07) << 8) | 0x09` = **265**, tag = **2**,
> yük **96 B**. Aynı tag'li FRAGN `e1 09 00 02 0c` → size **265** ✓,
> tag **2** ✓, offset `0x0C` × 8 = **96** ✓ — **FRAG1'in yük uzunluğuyla
> BİREBİR.** Üç bağımsız sayı tutuyor.

**Yeniden birleştirme YAPILMAZ** (çerçeveler arası durum, dalga 16 bulgu 12);
başlıklar çözülür, "bu çerçeve N/M" bilgisi basılır.

#### C.3 — LOWPAN_IPHC (RFC 6282 §3.1)

```
  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
+---+---+---+---+---+---+---+---+---+---+---+---+---+---+---+---+
| 0 | 1 | 1 |  TF   |NH | HLIM  |CID|SAC|  SAM  | M |DAC|  DAM  |
+---+---+---+---+---+---+---+---+---+---+---+---+---+---+---+---+
```
- **TF**: 00 → ECN+DSCP+pad+FlowLabel (4 B) · 01 → ECN+pad+FL (3 B) ·
  10 → ECN+DSCP (1 B) · 11 → tümü elenmiş (0 B)
- **NH**: 0 ⇒ Next Header satır içinde (1 B) · 1 ⇒ NHC ile sıkıştırılmış
- **HLIM**: 00 satır içi (1 B) · 01 = 1 · 10 = 64 · 11 = 255
- **CID**: 1 ⇒ DAM'dan sonra 1 baytlık Context Identifier Extension
- **SAC/SAM**, **M/DAC/DAM**: adres kipleri
`[KANIT]` RFC 6282 §3.1, birebir alıntı.

> **KAPSAM:** IPHC **çözülür** ve alanlar basılır; **IPv6 başlığının TAM
> YENİDEN KURULMASI** (dekompresyon) *"6LoWPAN Header Decompression &
> Compression Saving"* aracının işidir ve **YAPILIR** — ama yalnız
> bağlamsız hâller (SAC/DAC = 0). **Bağlam tabanlı sıkıştırma (SAC/DAC = 1)
> bağlam tablosunu gerektirir; tablo TELDE YOKTUR** → `iphcContext`
> `decodeOptions` kanalı; seçilmezse adres HAM kalır + uyarı.
> Dalga 17'nin *"Semantik tip telde olmayabilir"* dersinin adres düzeyindeki eşi.

#### C.4 — LOWPAN_NHC (RFC 6282 §4) — UDP sıkıştırması

`NH = 1` ise sonraki başlık NHC ile kodlanır. UDP için `11110CPP`:
`C` = checksum elenmiş, `PP` = port sıkıştırma kipi.
**`C = 1` ⇒ UDP checksum TELDE YOK ⇒ PASS/FAIL BASILMAZ** (dalga 13 dersi 3).

### D — MLE

**UDP portu 19788 = `0x4D4C` = ASCII `"ML"`** `[KANIT]` OpenThread
`src/core/thread/mle_types.hpp:81` (`constexpr uint16_t kUdpPort = 19788`),
Wireshark `packet-mle.c:202`, MLE draft §8.
*(Görev tanımının `0xF0BF` tahmini ÇÜRÜDÜ — 61631, alakasız. Ana brif
"Çürüyen tahminler" 1.)*

**MLE mesajı = Security Suite baytı + …**

```
+-----+------------+---------+-----+          +-----+---------+
|  0  | Aux Header | Command | MIC |          | 255 | Command |
+-----+------------+---------+-----+          +-----+---------+
   ŞİFRELİ (802.15.4 Security)                    ŞİFRESİZ
```
`[KANIT]` `draft-kelsey-intarea-mesh-link-establishment-06` §5 + §14.1 IANA
alt kaydı; Wireshark `packet-mle.c:209-213`
(`{0, "802.15.4 Security"}, {255, "No Security"}`).

### 🚨🚨 TUZAK — OpenThread'in KENDİ YORUMLARI TERS

`openthread/src/core/thread/mle.hpp:1498-1502`:
```cpp
k154Security = 0,   // "MLE message is not secured."   ← YORUM YANLIŞ
kNoSecurity  = 255, // "MLE message is secured."       ← YORUM YANLIŞ
```
**Adlar doğru, yorumlar takas edilmiş.** Doğrusu koddan okunur:
`mle.cpp:3575` `if (securitySuite == k154Security) { SecurityHeader …; }`
(aux başlığı YALNIZ 0 için ekliyor) ve `mle.cpp:1593`
`if (securitySuite == kNoSecurity)` (komutu doğrudan okuyor).

> **Yorumu kopyalayan bir uygulama, ŞİFRELİ çerçeveyi "şifresiz" sanıp
> ciphertext'i MLE komutu diye BASARDI — hata VERMEDEN.**
> Dalga 17'nin "YORUM ile KOD ayrışabilir; KOD kazanır" dersinin ÜÇÜNCÜ vakası.

**Şifresiz gönderilen SADECE İKİ komut var** `[KANIT]` `mle.cpp:3565-3568`:
```cpp
if ((aCommand == kCommandDiscoveryRequest) || (aCommand == kCommandDiscoveryResponse))
{ securitySuite = kNoSecurity; }
```
Yani **Discovery Request (16) ve Discovery Response (17)**. Parent Request/
Response, Child ID Request/Response, Advertisement, Link Request/Accept,
Data Request/Response, Announce — **hepsi şifreli.**

**Sonuç:** katalogun *"MLE Message Classifier (Parent Request / Response,
Child ID, Advertisement, Link Request)"* vaadi anahtar olmadan
KARŞILANAMAZ. Motor Security Suite'i, Aux Security Header'ı ve iki Discovery
mesajını çözer; gerisinde "şifreli MLE, komut tipi çerçevede OKUNAMAZ" der.
**Rozetin `partial` olmasının BİRİNCİ sebebi budur.**

---

## `canParse` — ana brifin T4'ü

```
n ≥ 6 && (b[0] & 0x07) === 1                     // 802.15.4 Data çerçevesi
&& başlıkUzunluğu(b) tanımlı && h + 2 < n
&& b[h] ∈ {0x41, 011xxxxx, 10xxxxxx, 11000xxx, 11100xxx}
&& CRC16_KERMIT(b[0..n-3]) === LE16(b[n-2..n-1])
```

**Ölçüm: 0 / 899 yanlış pozitif; 298 / 331 doğru pozitif** (gerçek yakalama).
Reddedilen 33'ün TAMAMI dispatch `0x42` = **LOWPAN_HC1** — `[KARAR 18-3]`ün
bilinçli kapsam dışısı, yanlış negatif DEĞİL.

FCS'siz aynı imza 18; yalnız MAC frame type 138; yalnız 6LoWPAN yükü 245.

### Bekçi — `threadCanParseRegistry.test.ts` (DÖRT ayaklı)

1. **İleri:** tüm registry örneklerinde `threadParser.canParse` → **0**.
2. **Ters:** yalnız-MAC-frame-type imzası (T1) aynı kümede **≥ 130** çakışma.
3. **Kendi üzerinde:** `thread`in tüm örneklerinde `true` (HC1 örneği HARİÇ,
   AÇIKÇA `false` beklenir).
4. **🚨 ZİGBEE AYRIMI (yeni ayak):** `zigbeeParser.canParse` bugün 899 örneğin
   **524'ünde** `true` diyor ve **her Thread çerçevesini de sahiplenir** —
   ikisi AYNI MAC'i paylaşıyor. Ayırıcı YALNIZ MAC yükünün ilk baytıdır
   (Zigbee NWK Frame Control baytı yapısal olarak `00xxxxxx` = NALP aralığında).
   Test bunu AÇIKÇA ölçer: `zigbee`nin TÜM örneklerinde `thread.canParse`
   `false`, `thread`in tüm örneklerinde `zigbee.canParse` `true`.
   **İkincisi bir HATA DEĞİL, kaydedilmiş bir OLGUDUR** — ve bir gün Zigbee
   NWK FC baytı IPHC aralığına düşerse test HABER VERİR.

---

## `decodeOptions` — SEKİZ kanal

| # | Kanal | Tip | Neden çerçevede yok |
|---|---|---|---|
| 1 | `fcsPresent` | select `auto`/`yes`/`no` | libpcap'in **195 ↔ 230** ayrımı; yakalama-zamanı olgusu |
| 2 | `securityLevelOverride` | select `auto`/`0..7` | Security Control telde VAR ama Suppression bitleri okumayı belirsizleştirebilir; `auto` varsayılan |
| 3 | `iphcContext` | text (context id → prefix) | **Bağlam tablosu TELDE YOK**; SAC/DAC = 1'de adres onsuz kurulamaz |
| 4 | `mlePort` | number, varsayılan 19788 | Port telde var ama tescilli dağıtımlar sapabilir; sınıflandırma kapısı |
| 5 | `dispatchProfile` | select `thread`/`rfc4944-full` | `thread` = HC1 reddedilir; `rfc4944-full` = HC1 tanınır ama ÇÖZÜLMEZ, adlandırılır |
| 6 | `encryptedPayloadDisplay` | select `marked`/`hex` | Gösterim tercihi |
| 7 | `addressDisplay` | select `eui64`/`raw` | EUI-64 telde LE, ekranda geleneksel ters/ayraçlı (`zigbee.ts:71-76` emsali) |
| 8 | `udpChecksumElided` | select `auto`/`present`/`elided` | NHC'nin `C` biti söyler, ama NHC'siz UDP'de bilgi yok |

### KANAL YAPILMAYACAKLAR

- **Ağ anahtarı / MLE anahtarı girişi** — şifre çözme bu dalgada YOK; kanal
  açmak olmayan bir yetenek vaat eder.
- **RLOC16 → düğüm rolü eşlemesi** — çerçeveler arası (Network Data gerekir).
- **Fragment birleştirme tamponu** — çerçeveler arası durum.
- **Kanal / RSSI / LQI** — TAP (283) ve ZEP sözde başlıklarının işi, kapsam dışı.
- **Thread sürümü (1.1/1.3/1.4)** — çerçeveden çıkarılamaz ve hiçbir alanın
  yorumunu bu dalgada değiştirmiyor.

---

## Örnek çerçeveler

### GERÇEK YAKALAMADAN (4) — `6LoWPAN.pcap`, ZEP v2 soyuldu, FCS 4/4 PASS

> **Kaynak notu:** `6LoWPAN.pcap.gz` (Wireshark SampleCaptures) global
> başlığında `LINKTYPE = 1` (Ethernet) yazar ve bu yüzden "802.15.4 yakalaması
> değil" diye ELENEBİLİR. **Elenmemeli** — çerçeveler **ZEP v2** ile UDP içinde
> taşınıyor (`"EX"` sihri + 32 baytlık başlık). Bu keşif turu 331 çerçeveyi
> çıkardı; **FCS'leri 331/331 DOĞRU.**
> Yakalama Thread DEĞİL, jenerik 6LoWPAN'dır (UDP portu 0xF0B1) — **802.15.4
> MAC, FRAG ve sıkıştırılmamış IPv6 yollarını doğrular, IPHC ve MLE yollarını
> DOĞRULAMAZ.**

**1) Sıkıştırılmamış IPv6 (dispatch `0x41`) — 89 B**
```
41 cc a4 ff ff 8a 18 00 ff ff da 1c 00 88 18 00 ff ff da 1c 00 41 60 00
00 00 00 19 11 40 fe 80 00 00 00 00 00 00 00 1c da ff ff 00 18 88 fe 80
00 00 00 00 00 00 00 1c da ff ff 00 18 8a 04 01 f0 b1 00 19 ea 8a 48 65
6c 6c 6f 20 30 30 33 20 30 78 43 35 39 41 0a f9 31
```
**ÜÇLÜ ARİTMETİK ÇAPRAZLAMA:**
- 21 (MAC) + 1 (dispatch) + 40 (IPv6) + 8 (UDP) + 17 (yük) + 2 (FCS) = **89** ✓
- IPv6 Payload Length `00 19` = **25** = UDP toplamı (8 + 17) ✓
- UDP Length `00 19` = **25** ✓

**2) FRAG1 — 123 B**
```
41 cc a6 ff ff 8a 18 00 ff ff da 1c 00 88 18 00 ff ff da 1c 00 c1 09 00
02 42 fa 40 04 01 f0 b1 01 06 6f af 48 65 6c 6c 6f 20 30 30 36 20 30 78
46 46 33 43 0a 00 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23
24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 32 33 34 35 36 37 38 39 3a 3b
3c 3d 3e 3f 40 41 42 43 44 45 46 47 48 49 4a 4b 4c 4d 4e 4f 50 51 52 53
54 68 79
```
`datagram_size = 265`, `tag = 2`, yük 96 B.

**3) FRAGN (2 ile AYNI datagram) — 124 B**
```
41 cc a7 ff ff 8a 18 00 ff ff da 1c 00 88 18 00 ff ff da 1c 00 e1 09 00
02 0c 55 56 57 58 59 5a 5b 5c 5d 5e 5f 60 61 62 63 64 65 66 67 68 69 6a
6b 6c 6d 6e 6f 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f 80 81 82
83 84 85 86 87 88 89 8a 8b 8c 8d 8e 8f 90 91 92 93 94 95 96 97 98 99 9a
9b 9c 9d 9e 9f a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 aa ab ac ad ae af b0 b1 b2
b3 b4 55 21
```
`size = 265` ✓ · `tag = 2` ✓ · `offset = 0x0C × 8 = 96` ✓ **2'nin yüküyle birebir.**

**4) LOWPAN_HC1 (dispatch `0x42`) — 49 B, KAPSAM DIŞI dalı kanıtlar**
```
41 cc a5 ff ff 8a 18 00 ff ff da 1c 00 88 18 00 ff ff da 1c 00 42 fb 60
40 04 01 1f 88 c0 48 65 6c 6c 6f 20 30 30 35 20 30 78 36 32 36 42 0a a5
0b
```
`canParse` **`false`** döner (`expectedValid: false` DEĞİL — çerçeve geçerli,
sadece bu motorun kapsamında değil). Ekranda: "LOWPAN_HC1 — RFC 4944 §10, RFC
6282 IPHC'siyle DEĞİŞTİRİLDİ, Thread KULLANMAZ; çözülmedi."
**Boş kart değil, açık bir kapsam bildirimi.**

### TÜRETİLMİŞ (5) — `[BEKLENTİ — uygulamada YENİDEN DOĞRULA]`

**5) IPHC + UDP 19788 + MLE (Security Suite 255, Discovery Request) — 41 B**
```
41 cc 5a ff ff 8a 18 00 ff ff da 1c 00 88 18 00 ff ff da 1c 00 7b 33 11
4d 4c 4d 4c 00 0d 00 00 ff 10 0d 02 00 02 01 10 cf
```
Dispatch `0x7B` = `011 11011` → IPHC (TF = 11, NH = 0, HLIM = 11);
`0x33` = CID 0, SAC 0, SAM 11, M 0, DAC 0, DAM 11; sonraki başlık `0x11` = UDP;
portlar `4d 4c` / `4d 4c` = **19788** ikisi de; MLE `ff` = **Security Suite 255
(No Security)**, komut `0x10` = **16 (Discovery Request)**.
**FCS bu keşif turunda CRC16/KERMIT ile hesaplandı ve doğrulandı** —
uygulamada `computeNamedCrc(…, 'CRC16_KERMIT')` ile YENİDEN üretilecek.

**6)** MLE **Security Suite 0** (şifreli) + Aux Security Header
(Key ID Mode 2, Security Level 5) — komutun OKUNAMADIĞI dal ekranda kanıtlanır.
**7)** MAC `Security Enabled = 1`, Level 5 → MIC 4 bayt; yük uzunluğu
hesabının MIC'i çıkardığı kanıtlanır.
**8)** Mesh Addressing Header (`10 xxxxxx`), `Hops Left = 0xF` → Deep Hops Left
alanı — koşullu ofset dalı.
**9)** BOZUK FCS (1'in son baytı değiştirilir) — `expectedValid: false`.

> **ZORUNLU:** türetilen her çerçevenin FCS'i motordan YENİDEN hesaplanır.

---

## Modül bölünmesi

```
src/protocol-core/framing/ieee802154Frame.ts        ← Görev 0'da OLUŞUR
src/protocol-core/framing/ieee802154Frame.test.ts
src/protocols/wireless/thread/
  lowpan.ts        dispatch zinciri: Mesh · BC0 · FRAG1/FRAGN · IPHC · NHC
  lowpan.test.ts
  mle.ts           Security Suite · Aux Security Header · iki Discovery komutu
  mle.test.ts
  thread.ts        ProtocolPlugin + örnekler + 8 kanal
  thread.test.ts
  threadCanParseRegistry.test.ts
```

`lowpan.ts` ile `mle.ts` **birbirini import ETMEZ**; `thread.ts` ikisini
sıralar (dalga 17'nin `cnip.ts`/`lonTalk.ts` ayrımı emsal).

---

## Uygulama görevleri (sırayla)

0. **`ieee802154Frame.ts` çekirdeğini çıkar; `zigbee.ts`i ona bağla;
   `npm test` TAM koş.** Kırılırsa geri dön (yukarıdaki şart).
1. Auxiliary Security Header (`thread/` altında) + MIC uzunluğu tablosu.
2. `lowpan.ts` — dispatch zinciri, koşullu ofsetler, IPHC bit alanları,
   NHC-UDP; **HC1 tanınır ama çözülmez.**
3. `mle.ts` — Security Suite, iki Discovery komutu, şifreli dal.
4. `thread.ts` — plugin, `canParse` (T4), 8 kanal, 9 örnek.
5. `threadCanParseRegistry.test.ts` — dört ayaklı bekçi (zigbee ayrımı dahil).
6. Katalogda `thread`e `pluginId: 'thread'` + `status: 'partial'`; dosya
   başına kapsam gerekçesi + **MLE şifreliliği** + **OpenThread yorum tuzağı**.
7. `src/protocols/index.ts` kaydı; `tr.ts`/`en.ts` (~90 anahtar).
   **MLE komut adları, dispatch adları, süit adları VERİDİR — çevrilmez.**
8. `npm run typecheck` + `npm test` TAM.
9. **Fixture zinciri kayması RAPOR EDİLİR, DÜZELTİLMEZ.**

## Tamamlanma ölçütü

- Örnek 1'in IPv6 kaynak/hedefi, UDP portları ve `"Hello 003 0xC59A"` yükü
  ekranda; FCS PASS.
- Örnek 2 ve 3 aynı `datagram_tag`ı gösteriyor; 3'ün offset'i 96 diyor.
- Örnek 4 "HC1 — kapsam dışı" diyor, çökmüyor, UYDURMUYOR.
- Örnek 5'te Security Suite 255 ve "Discovery Request" ekranda.
- Örnek 6'da "şifreli MLE — komut tipi çerçevede okunamaz" basılıyor,
  MIC PASS/FAIL **BASILMIYOR**.
- `zigbee`nin 106 örneği DAHİL `npm test` TAM yeşil.
