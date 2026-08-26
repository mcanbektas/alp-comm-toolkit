# BRİF — Faz 10 dalga 18c, `esp-now`

> **Ana brif: `docs/brief-faz10-dalga18.md`. Önkoşul: 18a VE 18b bitmiş olmalı**
> (`dot11Frame.ts` + `dot11Elements.ts` var).
>
> **Model/effort: Sonnet · high.**

---

## Bu alt dalganın işi

Espressif'in ESP-NOW'ını çözmek. **Yeni bir tel biçimi YOK** — ESP-NOW bir
802.11 **vendor-specific action frame**'idir; iş, 18a/18b'nin modüllerini
tüketip Action gövdesini açmaktır.

`[KARAR 18-4]` (ana brif): paylaşım ZORUNLU, çünkü Espressif'in kendi şeması
ilk 24 baytı 802.11 MAC başlığı, son 4 baytı 802.11 FCS diye tanımlıyor.

---

## Kaynak — BİRİNCİ TARAF, BAYT BAYT

`[KANIT]`
`https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html`
(çekildi 2026-08-26, "Frame Format" bölümü birebir):

```
| MAC Header | Category Code | Organization Identifier | Random Values | Vendor Specific Content |  FCS  |
   24 bytes       1 byte              3 bytes                4 bytes            7-x bytes        4 bytes
```

- **Category Code = 127** (vendor-specific action kategorisi)
- **Organization Identifier = `0x18fe34`** ("first three bytes of MAC address
  applied by Espressif")
- **Random Value = 4 bayt** — *"used to prevents relay attacks"*
- **Vendor Specific Content** = *"several (at least one) vendor-specific element
  fields"*; v2.0 için `x = 1512 (1470 + 6*7)`, v1.0 için `x = 257 (250 + 7)`

**Vendor-specific element:**

```
v1.0: | Element ID | Length | Organization Identifier | Type | Reserved(7~4) | Version(3~0) |   Body    |
v2.0: | Element ID | Length | Organization Identifier | Type | Reserved(7~5) | More data(4) | Version(3~0) | Body |
          1 byte     1 byte          3 bytes            1 byte  ─────────── 1 byte ───────────    0-250 bytes
```

- **Element ID = 221** · **Type = 4** (ESP-NOW)
- **Length** = OUI + Type + Version + Body toplamı, azami 255 ⇒ **gövde ≤ 250**
- **v1.0 azami yük 250 B** (`ESP_NOW_MAX_DATA_LEN`) ·
  **v2.0 azami 1470 B** (`ESP_NOW_MAX_DATA_LEN_V2`) ·
  **`ESP_NOW_MAX_IE_DATA_LEN` = 250** (v1.0 cihazın v2.0 paketinden okuyabildiği)
  `[KANIT]` `esp-idf/components/esp_wifi/include/esp_now.h` (Apache-2.0)

### 🔎 İÇ TUTARLILIK KONTROL EDİLDİ VE TUTUYOR

Element başına ek yük = ID 1 + Len 1 + OUI 3 + Type 1 + Ver 1 = **7 B**.
- v1.0: `x = 250 + 7 = 257` ✓
- v2.0: `x = 1470 + 6×7 = 1512` ✓ ⇒ **azami ALTI element**
- `Length = 5 + gövde ≤ 255` ⇒ gövde ≤ 250 ✓

> Metin *"Length is the total length of Organization Identifier, Type, Version
> and Body"* derken "Reserved"ı saymıyor — **çünkü Reserved, Version'la AYNI
> BAYTI paylaşıyor.** Bu bir çelişki değil; şemayla birlikte okununca tutarlı.
> (Dalga 17'nin "yorum ile kod ayrışabilir" tuzağı burada YOK — kontrol edildi.)

### MAC başlığı — Espressif'in KENDİ tarifi

*"the FromDS and ToDS bits of FrameControl field are both 0. The first address
field is set to the destination address. The second address field is set to
the source address. The third address field is set to broadcast address
(0xff:0xff:0xff:0xff:0xff:0xff)."*

Bu **18a'nın adres rol matrisinin ToDS=0/FromDS=0 satırıdır** (Addr1 = DA,
Addr2 = SA, Addr3 = BSSID) — Espressif BSSID yerine broadcast koyuyor.
**Matris DEĞİŞTİRİLMEZ**; `esp-now` yalnız Addr3'ün broadcast olmasını
"bağlantısız" göstergesi olarak ETİKETLER.

### Güvenlik

*"ESP-NOW uses the CCMP method… PMK and several LMKs… lengths of both PMK and
LMK are 16 bytes."* Anahtar yoksa **gövde çözülmez** — CLAUDE.md kuralı ve
katalogun KENDİ vaadi (`wireless-iot.ts:293`: *"payload unavailable without
keys"*).

---

## `canParse` — ana brifin E1'i

```
n ≥ 39
&& b[0] === 0xD0                            // ver 0, type 0 (Mgmt), subtype 13 (Action)
&& (b[1] & 0x03) === 0                      // ToDS = FromDS = 0
&& b[24] === 0x7F                           // Category 127
&& b[25..27] === 18 FE 34                   // Espressif OUI
```

**Ölçüm: 0 / 899.** Yalnız `b[24] === 0x7F` bile 0/899; yalnız `b[0] === 0xD0`
3/899 (`sae-j1850-vpw`). Element ofsetini (32) İMZAYA EKLEME — v2.0 çerçevesi
altı element taşıyabilir ve ilk element'in ofseti yalnız "tek element"
varsayımında sabittir. `canParse` **ucuz ön elemedir**
(`schemaParser.ts:606-607`).

### 🚨 KORUMALI ÇERÇEVE `canParse`'ı GEÇMEZ — ve bu DOĞRUDUR

`Protected = 1` olduğunda **Category baytı da şifrelenmiş gövdenin
içindedir**; `b[24]` artık CCMP başlığının ilk baytıdır. Yani korumalı bir
ESP-NOW çerçevesi imzayı GEÇEMEZ.

**Bu bir eksiklik değil, protokolün kendisidir** — dışarıdan bakan biri
korumalı bir vendor action frame'inin ESP-NOW olduğunu ÇERÇEVEDEN BİLEMEZ.
`parse` yine de çalışır (kullanıcı sayfayı kendisi açmıştır) ve
"korumalı — ESP-NOW olduğu ÇERÇEVEDEN doğrulanamıyor" uyarısı basar.
**Bekçi testinin "kendi örnekleri üzerinde `true`" ayağı bu örneği AÇIKÇA
DIŞARIDA BIRAKIR ve bunu `false` bekleyerek test eder** — sessizce atlamaz.
(Dalga 15h'in `mode-s` AP alanı dersinin aynı sınıfı: *bir ölçüm yoksa varmış
gibi gösterilmez.*)

---

## `decodeOptions` — DÖRT kanal

| # | Kanal | Tip | Neden çerçevede yok |
|---|---|---|---|
| 1 | `espNowVersion` | select `auto`/`v1`/`v2` | Version nibble telde VAR ama **Reserved/More-data bit yerleşimi v1↔v2'de FARKLI**; sürüm yanlış varsayılırsa "More data" biti Reserved sanılır. `auto` = nibble'dan oku |
| 2 | `fcsPresent` | select `auto`/`yes`/`no` | 18a ile aynı gerekçe (radiotap bayrağı) |
| 3 | `payloadSchema` | select `none`/`ascii`/`hex`/`custom` | Gövde uygulama verisidir; hiçbir tip bilgisi telde YOK — *"Semantik tip telde olmayabilir"* (dalga 17, LonTalk selector dersi) |
| 4 | `unknownVendorElementDisplay` | select `warn`/`raw` | OUI'si Espressif olmayan 221 element'i çerçevede olabilir |

### KANAL YAPILMAYACAKLAR

- **PMK/LMK girişi** — anahtar tarayıcıda kalır kuralı şifre ÇÖZMEYİ değil
  ANAHTARIN GİTMEMESİNİ garanti eder; şifre çözme bu dalgada YOK, kanal
  açmak var olmayan bir yetenek vaat eder.
- **RSSI / kanal / veri hızı** — radiotap, kapsam dışı.
- **Peer listesi** — çerçeveler arası durum.
- **Random Value doğrulama** — tekrar saldırısı tespiti çok-çerçeveli.

---

## Örnek çerçeveler — TÜRETİLMİŞ (gerçek ESP-NOW yakalaması BULUNAMADI)

> ⚠️ **HEPSİ `[BEKLENTİ — uygulamada YENİDEN DOĞRULA]`.** Alan yerleşimi
> Espressif'in şemasından; **FCS'ler bu keşif turunda `zlib.crc32` ile
> hesaplandı ve doğrulandı**, ama uygulamada `computeNamedCrc(…, 'CRC32')`
> ile YENİDEN üretilmelidir.
> **Gerçek yakalama BULUNAMADI** ve bu, `esp-now`un `ready` rozetinin ÇÜRÜTME
> KOŞULUDUR (ana brif): doğrulayıcı bir örnek bulunamazsa rozet `partial`e düşer.

**1) v1.0 broadcast, tek element, şifresiz — 55 B**
```
d0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 10 00
7f 18 fe 34 de ad be ef dd 11 18 fe 34 04 00 41 4c 50 20 43 6f 6d 6d 20
31 38 63 1b 46 24 89
```
Element `Length = 0x11 = 17 = 5 + 12` (gövde `"ALP Comm 18c"`).
**ARİTMETİK:** 24 + 1 + 3 + 4 + (2 + 17) + 4 = **55** ✓

**2) v2.0 unicast, İKİ element, `More data = 1` — 78 B**
```
d0 00 3a 01 30 ae a4 11 22 33 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 20 00
7f 18 fe 34 01 23 45 67 dd 19 18 fe 34 04 11 40 41 42 43 44 45 46 47 48
49 4a 4b 4c 4d 4e 4f 50 51 52 53 dd 0d 18 fe 34 04 01 60 61 62 63 64 65
66 67 5e 1c fc e6
```
İlk element `Ver|More = 0x11` → More data = 1, Version = 1; ikincisi `0x01` →
More data = 0. **Çok elementli yükün birleştirilmesi ÇERÇEVE İÇİDİR** (aynı
çerçevede), çerçeveler arası durum DEĞİL — bu yüzden yapılır.
**ARİTMETİK:** 24 + 8 + (2+25) + (2+13) + 4 = **78** ✓

**3) Korumalı (CCMP) — 60 B, gövde ÇÖZÜLMEZ**
```
d0 40 3a 01 30 ae a4 11 22 33 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 30 00
0b 00 20 00 00 00 00 00 9a 4c 1f d3 77 02 be 51 64 30 c8 aa 1d 9e 42 76
11 22 33 44 55 66 77 88 2d 2c fa 6c
```
`b[1] = 0x40` → **Protected = 1**. 8 baytlık CCMP başlığı + ciphertext + MIC.
`canParse` **`false`** döner (yukarıdaki gerekçe). Gövde ham + "şifreli" damgası.

**4) BOZUK: element OUI Espressif DEĞİL — 48 B**
```
d0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 40 00
7f 18 fe 34 de ad be ef dd 0a 00 50 f2 04 00 58 58 58 58 58 fa 07 99 03
```
Action başlığının OUI'si Espressif ama **element'inki `00:50:F2`** (Microsoft).
Uyarı basılır, element ham kalır. `expectedValid: false`.

**5) BOZUK: element `Length` çerçeveyi aşıyor — 47 B**
```
d0 00 00 00 ff ff ff ff ff ff 24 6f 28 a1 b2 c3 ff ff ff ff ff ff 50 00
7f 18 fe 34 de ad be ef dd f0 18 fe 34 04 00 6b 69 73 61 af 9a 55 85
```
`Length = 0xF0 = 240` ama kalan 4 bayt. `expectedValid: false`.

**6)** `[BEKLENTİ]` — mümkünse **gerçek bir ESP32'den üretilmiş** çerçeve
eklenir (`esp_now_send` + monitor-mode yakalama). Bulunursa rozet `ready`
kalır; bulunmazsa `partial`e düşülür ve gerekçe dosya başına yazılır.

---

## Modül bölünmesi

```
src/protocols/wireless/espnow/
  espNow.ts                    Action gövdesi + element zinciri; dot11Frame + dot11Elements TÜKETİR
  espNow.test.ts
  espNowCanParseRegistry.test.ts
```

**`dot11Frame.ts` ve `dot11Elements.ts`e DOKUNULMAZ.** İhtiyaç çıkarsa
çekirdeğe alan EKLENİR, `wifi`ye özel bir şey TAŞINMAZ (`hdlcCore.ts`
disiplini). Değişiklik olursa `wifi`nin testleri de TAM koşar.

---

## Uygulama görevleri (sırayla)

1. `espNow.ts` — `dot11Frame.decodeDot11Header` çağrısı; Action gövdesi
   (Category · OUI · Random Value); `dot11Elements` yürüyücüsüyle element
   zinciri; her element'te OUI/Type/Reserved/More/Version/Body.
2. Sürüm ayrımı: v1.0'da Reserved = bit 7-4, v2.0'da Reserved = bit 7-5 +
   More data = bit 4. `espNowVersion` `auto` ise Version nibble'ından türet.
3. `canParse` = E1.
4. Yük sınırı denetimi: v1.0'da gövde > 250 ⇒ uyarı; v2.0'da toplam > 1470 ⇒
   uyarı; element sayısı > 6 ⇒ uyarı.
5. `espNow.test.ts` — beş örneğin hepsi; korumalı örnekte `canParse` `false`
   AÇIKÇA beklenir.
6. `espNowCanParseRegistry.test.ts` — üç yönlü bekçi (ters ayak: yalnız
   `b[0] === 0xD0` imzasının **≥ 3** çakışması).
7. Katalogda `esp-now`a `pluginId: 'esp-now'` + rozet; dosya başına kapsam ve
   `[KARAR 18-4]` gerekçesi.
8. `src/protocols/index.ts` kaydı, `tr.ts`/`en.ts` (~50 anahtar).
9. `npm run typecheck` + `npm test` TAM.

## Tamamlanma ölçütü

- Örnek 1 çözülüp gövdesi `"ALP Comm 18c"` olarak ekranda (ASCII şeması seçili).
- Örnek 2'nin İKİ element'i ayrı ayrı, `More data` biti görünür.
- Örnek 3 "şifreli" damgasıyla duruyor, çökmüyor, gövdeyi UYDURMUYOR.
- Örnek 4 ve 5 uyarı basıyor.
- `wifi`nin hiçbir testi kırılmadı.
