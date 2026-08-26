# BRİF — Faz 10 dalga 18b, `wifi` (2/2): yönetim gövdeleri + IE ayrıştırıcı

> **Ana brif: `docs/brief-faz10-dalga18.md`. Önkoşul: 18a bitmiş olmalı**
> (`dot11Frame.ts` var, `wifi` kaydı `partial` rozetiyle açık).
>
> **Model/effort: Opus · high.**

---

## Bu alt dalganın işi

18a'nın HAM bıraktığı **yönetim çerçevesi gövdelerini** açmak: sabit alanlar +
**Information Element (TLV) yürüyücüsü** + dar bir adlandırılmış IE kümesi.

Kayıt **`partial`** kalır (şifreleme, radiotap/PHY, A-MSDU/defrag, EAPOL ve
stateful panolar hâlâ kapsam dışı — ana brif `[KARAR 18-2]`).

**Control ve Data gövdeleri BU DALGADA DA AÇILMAZ.** Block Ack bitmap'i,
data yükü ve QoS TID semantiği kapsam dışıdır.

---

## Gövde tablosu — alt tip başına SABİT ALANLAR

Hepsi MAC başlığından hemen sonra, çok baytlı alanlar **little-endian**.

| Alt tip | Sabit alanlar | Bayt | Sonra |
|---|---|---|---|
| 8 Beacon | Timestamp(8) · Beacon Interval(2) · Capability(2) | **12** | IE'ler |
| 5 Probe Resp | Timestamp(8) · Beacon Interval(2) · Capability(2) | **12** | IE'ler |
| 4 Probe Req | — | **0** | IE'ler |
| 0 Assoc Req | Capability(2) · Listen Interval(2) | **4** | IE'ler |
| 2 Reassoc Req | Capability(2) · Listen Interval(2) · Current AP Address(6) | **10** | IE'ler |
| 1 Assoc Resp | Capability(2) · Status Code(2) · AID(2) | **6** | IE'ler |
| 3 Reassoc Resp | Capability(2) · Status Code(2) · AID(2) | **6** | IE'ler |
| 11 Auth | Auth Algorithm(2) · Auth Transaction Seq(2) · Status Code(2) | **6** | IE'ler |
| 10 Disassoc | Reason Code(2) | **2** | IE'ler (genelde yok) |
| 12 Deauth | Reason Code(2) | **2** | IE'ler (genelde yok) |
| 13/14 Action | Category(1) | **1** | **18c'nin işi** — burada Category basılır, gövde ham |

### ARİTMETİK ÇAPRAZLAMA (gerçek yakalamadan, HEPSİ TUTUYOR)

| Örnek | Toplam | 24 + sabit + IE + 4 |
|---|---|---|
| Auth | 34 | 24 + **6** + 0 + 4 ✓ |
| Disassoc | 30 | 24 + **2** + 0 + 4 ✓ |
| Assoc Resp | 58 | 24 + **6** + 24 + 4 ✓ |
| Assoc Req | 79 | 24 + **4** + 47 + 4 ✓ |
| Probe Req | 53 | 24 + **0** + 25 + 4 ✓ |
| Beacon | 144 | 24 + **12** + 104 + 4 ✓ |

> **Bu tablo brifin ELLE ÇÖZÜMÜDÜR ve altı çerçevede uzunluk aritmetiğiyle
> ÇAPRAZLANDI** (dalga 17'nin çürüyen tahmin 12'sinin dersi).
> **Yine de: UYGULAMADA YENİDEN ÇÖZ** ve toplam uzunluk tutmuyorsa brife
> DEĞİL çerçeveye inan.

### Capability Information (16 bit LE) — bit bit

| Bit | Ad | Bit | Ad |
|---|---|---|---|
| 0 | ESS | 8 | Spectrum Management |
| 1 | IBSS | 9 | QoS |
| 2 | CF Pollable | 10 | Short Slot Time |
| 3 | CF Poll Request | 11 | APSD |
| 4 | **Privacy** | 12 | Radio Measurement |
| 5 | Short Preamble | 13 | DSSS-OFDM |
| 6 | PBCC | 14 | Delayed Block Ack |
| 7 | Channel Agility | 15 | Immediate Block Ack |

`[KANIT]` gerçek Beacon: `11 04` → LE `0x0411` → ESS=1, **Privacy=1**,
Short Slot Time=1. WPA'lı bir ağ için tutarlı.

---

## Information Element yürüyücüsü — `dot11Elements.ts`

Biçim: **`Element ID (1) · Length (1) · Data (Length)`**, ardışık.
Bilinmeyen ID **HATA DEĞİLDİR** — ham hex + ad yok (`zigbee.ts:52-58` emsali,
IE uzayı her revizyonla büyüyor).

### Adlandırılacak dar küme

| ID | Ad | Çözülür mü |
|---|---|---|
| 0 | SSID | ✅ UTF-8; uzunluk 0 ⇒ "wildcard/gizli SSID" |
| 1 | Supported Rates | ✅ her bayt: bit7 = "basic", değer × 0,5 Mbit/s |
| 3 | DS Parameter Set | ✅ kanal numarası |
| 5 | TIM | ✅ DTIM Count/Period/Bitmap Control + ham bitmap |
| 7 | Country | ✅ ülke kodu + ham üçlüler |
| 32 | Power Constraint | ✅ dB |
| 42 | ERP Information | ✅ bit alanları |
| 45 | HT Capabilities | ⚠️ ham + uzunluk denetimi (26 B), **alt alanlar kapsam dışı** |
| 48 | **RSN** | ✅ TAM (aşağıda) |
| 50 | Extended Supported Rates | ✅ 1 gibi |
| 61 | HT Operation | ⚠️ birincil kanal basılır, gerisi ham |
| 127 | Extended Capabilities | ⚠️ ham bit dizisi |
| 191 | VHT Capabilities | ⚠️ ham |
| 192 | VHT Operation | ⚠️ ham |
| 221 | **Vendor Specific** | ✅ OUI + tip ayrılır; **WPA (00-50-F2, tip 1) RSN gibi çözülür** |
| 255 | Element ID Extension | ⚠️ uzantı ID'si basılır (35 = HE Cap, 36 = HE Op), gövde ham |

> **⚠️ Element ID 47:** gerçek Beacon'da `2f 01 02` var. 47 kimi kaynaklarda
> "ERP Information (deprecated)" diye geçiyor, kimi revizyonda "Reserved".
> **`[BEKLENTİ — uygulamada `packet-ieee80211.c`ten doğrulanacak]`**;
> doğrulanamazsa bilinmeyen ID dalına düşer, uydurulmaz.

### RSN IE (48) — İÇ İÇE SAYAÇ ZİNCİRİ, bu dalganın tek incelikli yeri

```
Version                (2, LE)  — 1 dışı ⇒ uyarı, çözüme devam edilmez
Group Data Cipher Suite(4)      — OUI(3) + Suite Type(1)
Pairwise Cipher Count  (2, LE)  → N
Pairwise Cipher Suites (4×N)
AKM Suite Count        (2, LE)  → M
AKM Suites             (4×M)
RSN Capabilities       (2, LE)  — opsiyonel
[PMKID Count(2) + PMKID(16×K) + Group Management Cipher(4)]  — opsiyonel
```

**TUZAK:** her sayaçtan sonra kalan uzunluk KONTROL EDİLİR; `N`/`M` bozuksa
zincir HATA VERMEDEN kayar. `IE.Length` ile tüketilen bayt sayısı SONUNDA
karşılaştırılır, sapma varsa uyarı.

**Süit seçicileri (OUI `00-0F-AC`):** cipher 0 Use-Group · 1 WEP-40 · 2 TKIP ·
4 CCMP-128 · 5 WEP-104 · 6 BIP-CMAC-128 · 8 GCMP-128 · 9 GCMP-256 ·
10 CCMP-256 · 11 BIP-GMAC-128 · 12 BIP-GMAC-256 · 13 BIP-CMAC-256.
AKM 1 802.1X · 2 PSK · 3 FT-802.1X · 4 FT-PSK · 5 802.1X-SHA256 ·
6 PSK-SHA256 · **8 SAE** · 9 FT-SAE · 18 OWE.
**Farklı OUI ⇒ tescilli süit**; ham OUI + tip basılır, ad UYDURULMAZ.

**GERÇEK YAKALAMADAN DOĞRULANMIŞ ÇÖZÜM** (Beacon'ın RSN IE'si):
```
30 18 | 01 00 | 00 0f ac 02 | 02 00 | 00 0f ac 04  00 0f ac 02 | 01 00 | 00 0f ac 02 | 00 00
 ID=48 len=24  v1    Group=TKIP  N=2      CCMP-128      TKIP      M=1        PSK        caps=0
```
**ARİTMETİK:** 2 + 4 + 2 + 8 + 2 + 4 + 2 = **24** = `len` ✓

**Vendor WPA IE (aynı Beacon'da, RSN'in eski eşi):**
```
dd 1c | 00 50 f2 | 01 | 01 00 | 00 50 f2 02 | 02 00 | 00 50 f2 04  00 50 f2 02 | 01 00 | 00 50 f2 02 | 00 00
ID=221 len=28  OUI    type=1(WPA) v1  Group=TKIP  N=2      CCMP        TKIP      M=1        PSK
```
**ARİTMETİK:** 3 + 1 + 2 + 4 + 2 + 8 + 2 + 4 + 2 = **28** = `len` ✓

> **İki IE aynı ağı iki kez tarif ediyor** (WPA ve WPA2) ve **süit numaraları
> AYNI ama OUI FARKLI** (`00-50-F2` ↔ `00-0F-AC`). Tek bir "süit adı" tablosu
> yazıp OUI'yi yok saymak HATA VERMEDEN yanlış ad basar — dalga 16a'nın
> "aynı polinom aynı algoritma değildir" dersinin OUI düzeyindeki eşi.

---

## `decodeOptions` — DÖRT yeni kanal (18a'nın altısına EK)

| # | Kanal | Tip | Neden çerçevede yok |
|---|---|---|---|
| 7 | `ieNameSet` | select `narrow`/`all-known`/`none` | Hangi IE kümesinin adlandırılacağı bir GÖSTERİM kararı |
| 8 | `vendorIeProfile` | select `auto`/`wpa-only`/`raw` | 221'in içeriği OUI'ye bağlı; sözlük dışı OUI ham kalır |
| 9 | `rsnSuiteLabels` | select `show`/`hide` | Süit adı tablosu telde yok; tescilli süitlerde etiket yanıltıcı olabilir |
| 10 | `unknownIeDisplay` | select `hex`/`hidden` | Bilinmeyen IE'nin nasıl basılacağı |

### KANAL YAPILMAYACAKLAR

- **802.11 revizyon seçimi** (`802.11n/ac/ax`) — IE varlığı zaten revizyonu
  ima ediyor; kanal açmak kullanıcıya çerçeveden okunabilen bir şey sordurur.
- **Ülke/regülasyon alanı** — Country IE (7) telde VAR.
- **Status/Reason code sözlüğü açma-kapama** — kapalı, dar enum'lar; kanal gereksiz.

---

## Örnek çerçeveler — 18a'nınkilere EK

18a'nın 10 örneği KORUNUR (aynı `exampleFrames` dizisi büyür). Yeni:

**11)** Gerçek **Probe Response** (138 B) — Beacon'la aynı sabit alanlar ama
farklı adres rolleri (Addr1 = STA, `3a 01` Duration).
```
50 00 3a 01 00 0d 93 82 36 3a 00 0c 41 82 b2 55 00 0c 41 82 b2 55 f0 fb
61 ff 23 1c 01 00 00 00 64 00 11 04 00 07 43 6f 68 65 72 65 72 01 08 82
84 8b 96 24 30 48 6c 03 01 01 2a 01 02 2f 01 02 30 18 01 00 00 0f ac 02
02 00 00 0f ac 04 00 0f ac 02 01 00 00 0f ac 02 00 00 32 04 0c 12 18 60
dd 06 00 10 18 02 00 04 dd 1c 00 50 f2 01 01 00 00 50 f2 02 02 00 00 50
f2 04 00 50 f2 02 01 00 00 50 f2 02 00 00 0b bc 2c 14
```

**12)** Gerçek **Association Request** (79 B) — RSN IE'nin **len 20** hâli
(tek pairwise süit); 18a'da hex'i var, burada gövdesi açılır.
```
00 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 80 01
31 04 0a 00 00 07 43 6f 68 65 72 65 72 01 08 82 84 8b 96 24 30 48 6c 30
14 01 00 00 0f ac 02 01 00 00 0f ac 04 01 00 00 0f ac 02 00 00 32 04 0c
12 18 60 21 19 2e ed
```
**ARİTMETİK:** RSN len 0x14 = 20 = 2+4+2+4+2+4+2 ✓

**13)** TÜRETİLMİŞ: **bozuk RSN sayacı** — 12)'nin Pairwise Count'u `02 00`a
çevrilir ama liste büyütülmez ⇒ zincir `len`i aşar, uyarı basılır.
`expectedValid: false`. **FCS YENİDEN HESAPLANIR.**

**14)** TÜRETİLMİŞ: **gizli SSID** — 11)'in SSID IE'si `00 00`a indirilir
(uzunluk 0). "Wildcard/gizli" dalı ekranda kanıtlanır. **FCS YENİDEN HESAPLANIR.**

---

## Modül bölünmesi

```
src/protocols/wireless/wifi/
  dot11Frame.ts        (18a'dan — DOKUNULMAZ, yalnız tüketilir)
  dot11Elements.ts     IE yürüyücüsü + adlandırılmış küme + RSN/WPA çözücüsü   ← YENİ
  dot11Elements.test.ts                                                        ← YENİ
  dot11Management.ts   alt tip başına sabit alanlar                            ← YENİ
  dot11Management.test.ts                                                      ← YENİ
  wifi.ts              (büyür: gövde bağlanır, 4 kanal + 4 örnek eklenir)
```

> `dot11Elements.ts` **18c tarafından da tüketilecek** (ESP-NOW'ın
> vendor-specific element'i AYNI TLV biçimidir: ID 221 · Length · OUI · …).
> Yürüyücüyü ESP-NOW'a özel hiçbir şey bilmeden yaz.

---

## Uygulama görevleri (sırayla)

1. `dot11Elements.ts` — TLV yürüyücüsü + dar ad kümesi + RSN/WPA iç zinciri.
2. `dot11Elements.test.ts` — gerçek Beacon'ın 10 IE'si tek tek; RSN'in
   24 baytlık aritmetiği ASSERT edilir; bozuk sayaç dalı sınanır.
3. `dot11Management.ts` — 11 alt tipin sabit alanları + Capability bitleri +
   Status/Reason kod sözlükleri (dar).
4. `dot11Management.test.ts` — altı gerçek çerçevenin aritmetik çaprazlaması
   TEST OLARAK yazılır (`24 + sabit + IE + 4 === len`).
5. `wifi.ts` — gövde bağlanır, `bodyNotDecoded` uyarısı **yalnız Control/Data**
   için kalır; 4 yeni kanal, 4 yeni örnek.
6. `tr.ts` + `en.ts` (~60 yeni anahtar). **IE adları, süit adları, alt tip
   adları VERİDİR — çevrilmez.**
7. `npm run typecheck` + `npm test` TAM.

## Tamamlanma ölçütü

- Gerçek Beacon'ın SSID'si ("Coherer"), kanalı (1), beacon aralığı (100 TU),
  Privacy biti ve **RSN'in CCMP+TKIP / PSK üçlüsü** ekranda.
- Aynı Beacon'ın WPA vendor IE'si AYRI ve OUI'siyle basılıyor.
- Auth örneğinin "Open System / seq 1 / Successful" üçlüsü ekranda.
- Bozuk RSN sayacı örneği uyarı basıyor, çökmüyor.
- Gizli SSID örneği "wildcard" diyor, boş kart basmıyor.
- `npm test` TAM yeşil.
