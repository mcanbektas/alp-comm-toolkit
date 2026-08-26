# BRİF — Faz 10 dalga 18a, `wifi` (1/2): IEEE 802.11 MAC katmanı

> **Ana brif: `docs/brief-faz10-dalga18.md`.** Kapsam kararı `[KARAR 18-2]`,
> `canParse` ölçümü ve devralınan tuzaklar orada — burada TEKRARLANMAZ, sayfa
> numarasıyla anılır. **ÖNCE ANA BRİFİ OKU.**
>
> **Model/effort: Opus · xhigh.**

---

## Bu alt dalganın işi

`wifi` kaydına **802.11 MAC katmanı** motorunu bağlamak. Üç sınıf da
(Management / Control / Data) BAŞLIK düzeyinde çözülür; **gövde bu dalgada
çözülmez** (18b'nin işi) ve ham kalır + uyarı.

**Kayıt bu dalganın sonunda `partial` rozetiyle AÇILIR.** Yönetim gövdesi ham
basıldığı için "yarım motor" gibi görünebilir — DEĞİL: 11 FC alt alanı, dört
adresin BAĞLAMA GÖRE rol çözümü, sıra/parça numarası, QoS/HT Control ve
FCS PASS/FAIL gerçek çıktılardır. Emsal `zigbee`: dalga 7'de MAC/NWK/APS,
dalga 8'de ZCL kütüphanesi — **aynı kayıt iki dalgada büyüdü**
`[KANIT]` `src/protocols/wireless/zigbee/zigbee.ts:38-41`.

---

## Girdi sözleşmesi (dosya başına BİREBİR yazılır)

> Girdi = **ÇIPLAK IEEE 802.11 MAC çerçevesi, 4 baytlık FCS DAHİL**
> (`LINKTYPE_IEEE802_11` = 105 gövdesi).
> Radiotap (127), PPI (192), Prism (119), AVS (163) başlıkları ve pcap zarfı
> **girdi DEĞİLDİR** — bunlar libpcap'in AYRI link-type'larıdır.
> `[KANIT]` `https://www.tcpdump.org/linktypes.html`

FCS'siz girdi `parse` edilebilir (`fcsPresent` kanalı `false`), ama
`canParse` **`false`** döner — auto-detection FCS'e dayanır (ana brif W12/W13).

---

## Çerçeve tablosu — MAC başlığı

### A.1 Frame Control (ofset 0-1)

| Bayt | Bit | Alan | Not |
|---|---|---|---|
| 0 | 0-1 | Protocol Version | **0 dışı = geçersiz**; `canParse` burada eler |
| 0 | 2-3 | Type | 0 Management · 1 Control · 2 Data · 3 Extension (kapsam dışı) |
| 0 | 4-7 | Subtype | tabloya göre |
| 1 | 0 | To DS | |
| 1 | 1 | From DS | |
| 1 | 2 | More Fragments | |
| 1 | 3 | Retry | "Sequence Control Analyzer" bunu kullanır |
| 1 | 4 | Power Management | |
| 1 | 5 | More Data | |
| 1 | 6 | **Protected Frame** | 1 ⇒ gövde ŞİFRELİ, öteye İNİLMEZ |
| 1 | 7 | +HTC / Order | 1 ⇒ HT Control alanı VAR (4 bayt) |

`[KANIT]` gerçek yakalama `wpa-Induction.pcap`: Beacon `80 00`, ProbeReq
`40 00`, ProbeResp `50 00`, Auth `b0 00`, AssocReq `00 00`, AssocResp `10 00`,
Disassoc `a0 00`, ACK `d4 00`, korumalı Data `08 42`.

**Alt tip adları (yönetim, type 0):** 0 Assoc Req · 1 Assoc Resp ·
2 Reassoc Req · 3 Reassoc Resp · 4 Probe Req · 5 Probe Resp · 6 Timing Adv ·
8 Beacon · 9 ATIM · 10 Disassoc · 11 Auth · 12 Deauth · 13 Action ·
14 Action No Ack. **Kontrol (type 1):** 8 Block Ack Req · 9 Block Ack ·
10 PS-Poll · 11 RTS · 12 CTS · 13 ACK · 14 CF-End · 15 CF-End+CF-Ack.
**Veri (type 2):** 0 Data · 4 Null · 8 QoS Data · 12 QoS Null (bit 3 set ⇒ QoS).

> **Bilinmeyen alt tip HATA DEĞİLDİR** — `valid: true` kalır, `physicalValue`
> boş. Alt tip uzayı 802.11 revizyonlarıyla büyüyor
> (`bleAdvertisement.ts`in bilinmeyen Company ID emsali, `zigbee.ts:52-58`).

### A.2 Sabit başlık

| Ofset | Uzunluk | Alan | Koşul |
|---|---|---|---|
| 0 | 2 | Frame Control | daima |
| 2 | 2 | Duration/ID (LE) | daima |
| 4 | 6 | **Address 1** = RA | daima |
| 10 | 6 | **Address 2** = TA | ACK/CTS'te **YOK** |
| 16 | 6 | **Address 3** | ACK/CTS/RTS/PS-Poll/CF-End'de **YOK** |
| 22 | 2 | Sequence Control (LE) | kontrol çerçevelerinde **YOK** |
| 24 | 6 | **Address 4** | YALNIZ ToDS=1 **ve** FromDS=1 |
| +0 | 2 | QoS Control (LE) | YALNIZ QoS veri alt tipleri (type 2, subtype bit 3) |
| +0 | 4 | HT Control | YALNIZ `+HTC/Order` biti 1 |

Sequence Control: **bit 0-3 Fragment Number, bit 4-15 Sequence Number**
(16 bit LE tek sayı okunur, sonra maskelenir).
`[KANIT]` gerçek Beacon `50 f8` → `0xf850` → frag 0, seq 0x0f85 = 3973.

### A.3 🚨 ADRES ROL MATRİSİ — "Address1 = Dest" VARSAYILMAZ

Deponun kendi spec'i bunu ayrıca uyarıyor: *"Address1–4 anlamı
type/ToDS/FromDS'e göre değişir (sabit 'Address1=Dest/Address2=Source'
varsayılmaz)"* `[KANIT]` `docs/spec/ozet/09-kablosuz-iot.md:147`.

| ToDS | FromDS | Addr1 | Addr2 | Addr3 | Addr4 |
|---|---|---|---|---|---|
| 0 | 0 | RA = **DA** | TA = **SA** | **BSSID** | — |
| 0 | 1 | RA = **DA** | TA = **BSSID** | **SA** | — |
| 1 | 0 | RA = **BSSID** | TA = **SA** | **DA** | — |
| 1 | 1 | RA | TA | **DA** | **SA** (WDS/mesh) |

**Yönetim çerçevelerinde ToDS=FromDS=0 ZORUNLUDUR** ve Addr3 daima BSSID'dir.

**GERÇEK YAKALAMADAN DOĞRULAMA:** korumalı Data çerçevesi `08 42 …`
→ `b[1] = 0x42` ⇒ ToDS=0, FromDS=1, Protected=1; Addr1 = `01 80 c2 00 00 00`
(STP çoklu yayın = **DA**), Addr2 = `00 0c 41 82 b2 55` (**BSSID**),
Addr3 = `00 0c 41 82 b2 55` (**SA**). Matris tutuyor.

Her adres için ayrıca **I/G biti** (ilk baytın bit 0) ve **U/L biti** (bit 1)
basılır: çoklu yayın / yerel yönetimli ayrımı. Broadcast
(`ff:ff:ff:ff:ff:ff`) ayrıca etiketlenir.

### A.4 FCS

Son 4 bayt, **little-endian**, `CRC32` (`crcCatalogue.ts:456-463`), kapsam =
FCS hariç TÜM çerçeve. **PASS/FAIL BASILIR** — anahtarsız, sade bir CRC
(`zigbee.ts:64-70`in FCS gerekçesiyle aynı sınıf).

🚨 **SAHTE DOST: `CRC32C`** (`crcCatalogue.ts:464-471`) — aynı genişlik, aynı
init, aynı yansıma, aynı xorout; **YALNIZ polinom** farklı (`0x1EDC6F41` ↔
`0x04C11DB7`). Hata VERMEDEN yanlış PASS/FAIL basar.

**Doğrulama:** `wpa-Induction.pcap`ın 1093 çerçevesinden **1080'i `CRC32` ile
PASS** (ölçüldü). Kalan 13 gerçekten bozuk (protokol sürümü 2/3 okunuyor).

---

## Uzunluk hesabı — SIRAYLA (ofset zinciri)

```
n = 2 (FC) + 2 (Duration) + 6 (A1)
type == Control:
    subtype ∈ {12 CTS, 13 ACK}      → n += 0            (A2 YOK, SeqCtl YOK)
    subtype ∈ {10,11,14,15}         → n += 6            (A2 var, SeqCtl YOK)
    subtype ∈ {8 BAR, 9 BA}         → n += 6            (+ gövde 18b/kapsam dışı)
else (Management / Data):
    n += 6 (A2) + 6 (A3) + 2 (SeqCtl)
    if (ToDS && FromDS)             → n += 6 (A4)
    if (type == Data && (subtype & 0x8)) → n += 2 (QoS Control)
    if (FC.order)                   → n += 4 (HT Control)
gövde = uzunluk - n - (fcsPresent ? 4 : 0)
```

> **TUZAK:** `+HTC/Order` biti VERİ çerçevelerinde "Order" (strictly ordered),
> QoS Data ve Yönetim çerçevelerinde "+HTC" anlamına gelir. HT Control alanı
> **yalnız QoS Data ve Yönetim**de vardır; QoS-olmayan Data çerçevesinde aynı
> bit 1 olsa bile HT Control **YOKTUR**. Bu ayrımı kaçırmak gövdeyi 4 bayt
> kaydırır, HATA VERMEDEN.

---

## `canParse` — ana brifin W12'si

```
n ≥ 10
&& (b[0] & 0x03) === 0                          // protokol sürümü 0
&& type ≠ 3                                     // Extension kapsam dışı
&& n ≥ (type===1 && subtype∈{12,13} ? 14 : type===1 ? 20 : 28)
&& CRC32(b[0..n-5]) === LE32(b[n-4..n-1])       // FCS
```

**Ölçüm: 0 / 899 yanlış pozitif; 1080 / 1093 doğru pozitif.**
FCS'siz aynı imza **216 / 899**. `canParse` **`true`** döner.

### Bekçi — `wifiCanParseRegistry.test.ts` (ÜÇ YÖNLÜ)

1. **İleri:** tüm registry örneklerinde `wifiParser.canParse` → **0**.
   Kayıt/örnek sayısı `registeredProtocolIds()`ten TÜRETİLİR.
2. **Ters:** FCS'siz sınıf imzası aynı kümede **≥ 200** çakışma
   ("yazılsaydı kaç çerçeve çalardı"). Sıfırlanırsa ölçüm bayatlamıştır.
3. **Kendi üzerinde:** `wifi`nin TÜM örneklerinde `canParse` `true` —
   bozuk-FCS örneği HARİÇ (o örnekte `canParse` `false` döner **ve bu
   BEKLENEN**: imza FCS'e dayanıyor; testte AÇIKÇA `false` beklenir, sessizce
   atlanmaz).

---

## `decodeOptions` — ALTI kanal

Hepsi ÇERÇEVEDEN ÇIKARILAMAYAN parametrelerdir.

| # | Kanal | Tip | Neden çerçevede yok |
|---|---|---|---|
| 1 | `fcsPresent` | select `auto`/`yes`/`no` | FCS varlığı bir **radiotap bayrağıdır** (`IEEE80211_RADIOTAP_FLAGS` bit 0x10) ve radiotap kapsam dışı. Wireshark bunu iki ayrı dissector'la çözüyor: `register_dissector("wlan_withfcs"…)` / `("wlan_withoutfcs"…)` `[KANIT]` `packet-ieee80211.c:63466-63467`. `auto` = son 4 bayt CRC-32 tutuyorsa var say. |
| 2 | `addressRoleDisplay` | select `resolved`/`raw`/`both` | Rol matrisi ToDS/FromDS'ten ÇIKAR ama kullanıcı ham A1..A4 görmek isteyebilir |
| 3 | `qosControlPresent` | select `auto`/`yes`/`no` | Alt tipten çıkar ama tescilli/eski cihazlar sapabiliyor; `auto` varsayılan |
| 4 | `htControlPresent` | select `auto`/`yes`/`no` | `+HTC` bitinin anlamı türe bağlı (yukarıdaki tuzak); elle geçersiz kılma |
| 5 | `protectedPayloadDisplay` | select `marked`/`hex` | Şifreli gövdenin nasıl basılacağı bir GÖSTERİM tercihi |
| 6 | `vendorAddressLabels` | select `show`/`hide` | MAC OUI → üretici adı sözlüğü çerçevede YOK; deponun OUI sözlüğü yok, dar bir liste taşınırsa kapatılabilir olmalı |

### KANAL YAPILMAYACAKLAR (ve neden)

- **Kanal/frekans/RSSI/MCS** — radiotap'in işi, kapsam dışı; kanal AÇMAK
  "bu bilgiyi biliyoruz" demek olurdu.
- **Protokol sürümü geçersiz kılma** — 0 dışı GEÇERSİZDİR, seçenek değil.
- **Bayt sırası** — 802.11 çok baytlı alanları DAİMA little-endian; seçenek
  yaratmak olmayan bir belirsizlik uydurmak olur.
- **BSSID elle verme** — matris zaten çözüyor.

---

## Örnek çerçeveler — GERÇEK YAKALAMADAN (hex, birebir)

Kaynak: `wpa-Induction.pcap` (Wireshark SampleCaptures, DLT 127), **radiotap
24 baytı SOYULDU**. Hepsinin FCS'i `CRC32` ile PASS (ölçüldü).

**1) ACK (Control, subtype 13) — 14 B, EN KISA ÇERÇEVE**
```
d4 00 00 00 00 0c 41 82 b2 55 b3 33 6b 7c
```
FC `d4 00` → type 1, subtype 13; Duration `00 00`; RA `00:0c:41:82:b2:55`;
FCS `b3 33 6b 7c`. **A2 ve SeqCtl YOK** — ofset zincirinin en sert sınavı.

**2) Beacon (Management, subtype 8) — 144 B**
```
80 00 00 00 ff ff ff ff ff ff 00 0c 41 82 b2 55 00 0c 41 82 b2 55 50 f8
89 f1 d4 1b 01 00 00 00 64 00 11 04 00 07 43 6f 68 65 72 65 72 01 08 82
84 8b 96 24 30 48 6c 03 01 01 05 04 00 01 00 00 2a 01 02 2f 01 02 30 18
01 00 00 0f ac 02 02 00 00 0f ac 04 00 0f ac 02 01 00 00 0f ac 02 00 00
32 04 0c 12 18 60 dd 06 00 10 18 02 00 04 dd 1c 00 50 f2 01 01 00 00 50
f2 02 02 00 00 50 f2 04 00 50 f2 02 01 00 00 50 f2 02 00 00 9f 61 c9 5c
```
18a'da: MAC başlığı çözülür (24 B), **gövde 116 B HAM + `bodyNotDecoded`
uyarısı**, FCS PASS. 18b'de gövde açılır.
**ARİTMETİK ÇAPRAZLAMA:** 24 (MAC) + 12 (sabit) + 104 (IE'ler) + 4 (FCS)
= **144** ✓ (IE uzunlukları: 9+10+3+6+3+3+26+6+8+30 = 104).

**3) Korumalı Data (type 2, subtype 0) — 94 B**
```
08 42 00 00 01 80 c2 00 00 00 00 0c 41 82 b2 55 00 0c 41 82 b2 55 70 f8
02 22 cd a0 00 00 00 00 94 1c 1e be e0 4c b1 71 60 98 40 d1 66 cf 56 84
a1 20 9a f1 d5 e1 e9 4c cc d5 6a a0 68 33 1e cd 8d d1 2e f9 eb 8d 93 21
36 28 1b 8c c2 33 ff 69 42 4e 90 13 c7 9f 02 84 77 59 71 3e e0 e5
```
**Protected = 1** → gövde `encryptedPayload` damgasıyla ham kalır, öteye
İNİLMEZ (CLAUDE.md anahtar kuralı). ToDS=0/FromDS=1 matris dalı burada
kanıtlanır.

**4) Probe Request (Management, subtype 4) — 53 B**
```
40 00 00 00 ff ff ff ff ff ff 00 0d 93 82 36 3a ff ff ff ff ff ff 10 00
00 07 43 6f 68 65 72 65 72 01 08 02 04 0b 16 24 30 48 6c 32 04 0c 12 18
60 f7 89 66 6d
```
Addr3 = broadcast (**wildcard BSSID**) — `W5` imzasının neden REDDEDİLDİĞİNİ
gösteren örneklerin ilki.

**5) Authentication (Management, subtype 11) — 34 B**
```
b0 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 70 01
00 00 01 00 00 00 0d f2 fd 2d
```
**Addr3 (`00:0c:41:82:b2:55`) ≠ Addr2 (`00:0d:93:82:36:3a`)** — `W5`'in
yanlış NEGATİF ürettiği çerçeve TAM BUDUR.
**ARİTMETİK:** 24 + 6 (gövde) + 4 = **34** ✓

**6) Association Response (Management, subtype 1) — 58 B**
```
10 00 3a 01 00 0d 93 82 36 3a 00 0c 41 82 b2 55 00 0c 41 82 b2 55 a0 fc
11 04 00 00 01 c0 01 08 82 84 8b 96 24 30 48 6c 32 04 0c 12 18 60 dd 06
00 10 18 02 00 04 4e a3 d6 0e
```
**ARİTMETİK:** 24 + 30 (6 sabit + 24 IE) + 4 = **58** ✓

**7) Disassociation (Management, subtype 10) — 30 B**
```
a0 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 50 0b
08 00 fe aa 65 ac
```
**ARİTMETİK:** 24 + 2 (Reason Code) + 4 = **30** ✓

**8) BOZUK FCS — gerçek yakalamanın KENDİ bozuk çerçevesi (65 B)**
```
40 00 00 64 ef bf b9 f8 fe 3b 4a 91 5a a3 e4 0b f4 9f 8f ea 7b e6 d5 22
e1 1f 8b 1f 60 59 82 57 60 70 30 ca dd 2b b3 e0 49 13 b3 36 76 81 6e 83
84 0b 16 23 79 ef d3 c6 1d 7a 79 cb c9 10 fd 3f 58
```
`expectedValid: false`. **Uydurulmuş değil — yakalamanın kendisinde bozuk.**

### Türetilecek örnekler (2)

**9)** ToDS=1 & FromDS=1 (dört adresli WDS) — matrisin dördüncü dalı gerçek
yakalamada YOK, 3)'ten türetilir. `[BEKLENTİ — uygulamada FCS YENİDEN
HESAPLANACAK]`
**10)** QoS Data (subtype 8) — QoS Control alanının varlığını kanıtlar; aynı
yolla türetilir. `[BEKLENTİ]`

> **ZORUNLU:** türetilen her çerçevenin FCS'i `computeNamedCrc(…, 'CRC32')`
> ile YENİDEN HESAPLANIR, elle yazılmaz.

---

## Modül bölünmesi

```
src/protocols/wireless/wifi/
  dot11Frame.ts        MAC başlığı çözücüsü — 18b ve 18c'nin ORTAK tüketeceği
  dot11Frame.test.ts
  wifi.ts              ProtocolPlugin + örnekler + decodeOptions
  wifi.test.ts
  wifiCanParseRegistry.test.ts
```

`dot11Frame.ts`in dışa açtığı yüzey **18b ve 18c tarafından tüketilecek**;
API'yi ona göre tasarla (bu, alt dalganın `xhigh` olmasının sebebi):
- `decodeDot11Header(bytes, options) → { fields, headerLength, frameClass,
  subtype, protectedFrame, addresses, fcsValid }`
- Bit maskeleri ve alt tip adları **`export`** edilir (`zigbee.ts`in
  etmediği hata TEKRARLANMAZ).

---

## Uygulama görevleri (sırayla)

1. `dot11Frame.ts` — FC bit alanları, sabit başlık, **ofset zinciri**, adres
   rol matrisi, SeqCtl, QoS/HT Control, FCS.
2. `dot11Frame.test.ts` — sekiz gerçek çerçevenin HEPSİ + iki türetilmiş;
   ACK'in 14 baytında A2/SeqCtl'in YOKLUĞU AYRICA sınanır.
3. `wifi.ts` — `ProtocolPlugin`, `canParse` (W12), altı `decodeOptions`
   kanalı, 10 örnek çerçeve. Gövde ham + `bodyNotDecoded` uyarısı.
4. `wifiCanParseRegistry.test.ts` — üç yönlü bekçi.
5. Katalogda `wifi`ye `pluginId: 'wifi'` ve `status: 'partial'`; dosya başına
   kapsam gerekçesi (`[KARAR 18-2]`nin özeti + link-type kanıtı).
6. `src/protocols/index.ts`e `registerOnce(registry, 'wifi', …)`.
7. `tr.ts` + `en.ts` (~80 anahtar). **IE adları, alt tip adları ve OUI adları
   VERİDİR, çevrilmez.**
8. `npm run typecheck` + `npm test` TAM koşar.
9. **Fixture zinciri kayması RAPOR EDİLİR, DÜZELTİLMEZ** (ana brif).

## Tamamlanma ölçütü

- `wifi` sayfası `decode` sekmesinde gerçek Beacon'ı çözüyor; FC alt alanları,
  dört adres ROLLERİYLE, SeqCtl ve **FCS PASS** ekranda.
- Bozuk-FCS örneği **FAIL** basıyor.
- ACK örneği 14 baytta doğru çözülüyor (A2/SeqCtl yok).
- Korumalı Data örneği gövdeyi ham + "şifreli" damgasıyla bırakıyor.
- Bekçi testi üç yönde de yeşil.
- `npm test` TAM yeşil; `zigbee` dahil hiçbir mevcut test kırılmadı.
