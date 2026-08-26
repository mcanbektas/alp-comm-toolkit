# BRİF — Faz 10 dalga 18e, `rf-telemetry-custom-frame` — **DOMAİNİ VE KATALOG BORCUNU KAPATAN DALGA**

> **Ana brif: `docs/brief-faz10-dalga18.md`.** Kapsam `[KARAR 18-5]`,
> `canParse` mayını `[BULGU 4]`, `definitions` paneli `[KARAR 18-7]` orada.
>
> **Model/effort: Opus · high.**
> Öteki dört alt dalgadan BAĞIMSIZDIR. **Bu alt dalga bitince katalogda
> `planned` kanonik kayıt KALMAZ — kapanış görevleri ana brifte.**

---

## Bu alt dalganın işi

`rf-telemetry-custom-frame` **bir protokol değil, bir profil çalıştırıcısıdır.**
Yayımlanmış tel biçimi yoktur; kayıt kullanıcı tanımlı bir şemayı çalıştırır.

**Yeni yazılacak KOD azdır** — çekirdek zaten var (ana brif BULGU 3):
`protocolSchema.ts` (251), `schemaParser.ts` (615), `schemaEncoder.ts` (453),
`fieldTypes.ts` (170), `checksumFinder.ts`, `pulseLog.ts`, `bitCursor.ts`.
Birebir emsal: `customBinaryProtocol.ts` (80 satır) —
`createSchemaParser(SPEC_SENSOR_PROTOCOL)` + `encodeWithSchema`.

**GERÇEKTEN YENİ OLAN İKİ ŞEY:** dewhitening (LFSR) ve Manchester çözücü.
`grep -ri "manchester|whiten|scrambl" src/` → **sıfır dosya.**

---

## 🚨 EN ÖNEMLİ UYARI — SPEC'İN KENDİ ÖRNEKLERİ DOĞRULANAMADI

`docs/spec/ozet/09-kablosuz-iot.md:171` şu çerçeveyi veriyor:

```
AA AA AA 2D D4 01 14 04 34 12 78 56 C9 21
```
ve `:173`te şu whitening örneğini: `wire A7 39 → dewhitened 01 10`.

**Bu keşif turunda İKİSİ DE aritmetik olarak reddedildi:**

| Deneme | Sonuç |
|---|---|
| 17 standart CRC-16 × 6..12 arası TÜM bayt aralıkları × `C9 21` ve `21 C9` | **0 eşleşme** |
| 65.535 polinomun TAMAMI × {init 0, FFFF} × {refl, no-refl} × {xorout 0, FFFF} × 5 makul aralık | 67 eşleşme, hepsi **tanınmayan** polinom (0x06A9, 0x2059, 0x4573 …) |
| Whitening dizisi `A6 29` için 512 seed × 8 tap × LSB/MSB çıkış = **8.192** 9-bit LFSR | **0 eşleşme** |
| 40 BLE kanalının whitening dizisi | **0 eşleşme** |

> **KARAR:** spec'in bu iki sayısal örneği **AÇIKLAYICIDIR, FIXTURE DEĞİLDİR.**
> **ALAN YERLEŞİMİ KORUNUR** (Preamble · Sync · Device · Type · Length · Data ·
> CRC — bu bilgi geçerlidir), **SAYILAR MOTORDAN YENİDEN ÜRETİLİR.**
>
> **Dalga 17'nin "keşfin elle çözdüğü her çerçeve şüphelidir" dersinin
> DÖRDÜNCÜ vakası — ve ilk kez şüpheli olan şey DEPONUN KENDİ SPEC'İ.**

---

## Varsayılan profil — ARİTMETİĞİ DOĞRULANMIŞ

Alan yerleşimi spec'ten, CRC değeri **hesaplandı**:

| Alan | Ofset | Uzunluk | Değer |
|---|---|---|---|
| Preamble | 0 | 3 | `AA AA AA` |
| Sync Word | 3 | 2 | `2D D4` |
| Device ID | 5 | 1 | `01` |
| Packet Type | 6 | 1 | `14` |
| Length | 7 | 1 | `04` (Data uzunluğu) |
| Data | 8 | `Length` | `34 12 78 56` |
| CRC-16 | 8+`Length` | 2 | **hesaplanır** |

**CRC kapsamı = Device ID … Data** (`coverage.startField = 'deviceId'`,
`endField = 'data'` — `protocolSchema.ts`in `coverage` alanı ALAN KİMLİĞİ
aralığı alır, bayt ofseti değil).

**`CRC16_CCITT_FALSE` ile hesaplandı:**
`crc16(01 14 04 34 12 78 56)` = **`0xAC54`**.

> **Bu değerin GÜVENİLİRLİĞİ ölçüldü:** aynı hesaplayıcı, YAYIMLANMIŞ `check`
> değerlerini (`"123456789"`) **beşte beş** birebir üretti —
> CCITT_FALSE `0x29B1` · MODBUS `0x4B37` · XMODEM `0x31C3` · KERMIT `0x2189` ·
> ARC `0xBB3D`. (Dalga 15h'in "topolojiyi de sına" kuralı.)
> **Uygulamada `computeNamedCrc(…, 'CRC16_CCITT_FALSE')` ile YENİDEN üret** —
> tutmazsa brife değil motora inan.

---

## Dewhitening — PN9 LFSR

**Yeni modül:** `src/protocol-core/decoding/lfsrWhitening.ts`

Standart PN9 (TI CC1101/CC2500 ailesi): 9-bit LFSR, `x⁹ + x⁵ + 1`,
seed `0x1FF`, çıkış biti = LFSR'ın en düşük biti, bayt başına 8 kaydırma,
çıkış LSB-first paketlenir. Dewhitening = whitening (XOR kendi tersidir).

**Doğrulama:** seed `0x1FF` ile üretilen ilk baytlar
**`FF E1 1D 9A ED 85 33 24 EA …`** — TI'ın yayımladığı PN9 dizisi.
Bu dizi bir **fixture**tır ve `lfsrWhitening.test.ts` onu ASSERT eder.

**Polinom ve seed ŞEMADAN gelir** (`decodeOptions`), sabit değil:
Semtech SX12xx, Nordic nRF ve tescilli radyolar farklı seed/tap kullanır.
Tanınmayan bir yapılandırma HATA DEĞİLDİR — kullanıcının bildirimidir.

---

## Manchester çözücü

**Yeni modül:** `src/protocol-core/decoding/manchester.ts`

Her veri biti iki tel bitine açılır. **Polarite PROFİLE BAĞLIDIR ve iki
gelenek TERSTİR:**

| Gelenek | 1 | 0 |
|---|---|---|
| **IEEE 802.3** | `01` | `10` |
| **G. E. Thomas** | `10` | `01` |

**Polarite `decodeOptions` kanalıdır ve varsayılan seçilemez** — spec
*"polarity profile'a bağlı"* diyor (`ozet/09:173`). Yanlış polarite tüm bitleri
ters çevirir, **HATA VERMEDEN.**

**Fixture (IEEE 802.3 polaritesi, bu turda hesaplandı):**
`2D D4` → **`A6 59 59 9A`** (2 bayt → 4 bayt, 2× şişme).
Geçersiz çift (`00` ya da `11`) ⇒ **kodlama hatası**, konumu bildirilir.

---

## `canParse` — ana brifin R1+R2'si, ve MAYIN

```
n ≥ 10
&& b[0] === 0xAA && b[1] === 0xAA && b[2] === 0xAA
&& b[3] === 0x2D && b[4] === 0xD4
```
**Ölçüm: 0 / 899.** (`AA AA` öneki tek başına da 0; `2D D4` sync'i ilk 12
baytta arayan imza da 0.)

### 🚨🚨 MAYIN — `createSchemaParser` DOĞRUDAN KULLANILAMAZ

`schemaParser.ts:602-609`:
```ts
canParse(data) {
  if (data.length === 0) return false;
  return startBytes.every((byte, index) => data[index] === byte);
}
```
`startBytes` boşsa `[].every(...)` **`true`** döner.
**ÖLÇÜLDÜ:** `length-based-protocol` bu yüzden registry'nin **899 örneğinin
899'unda** `canParse` `true` diyor (%100).

**İKİ KABUL EDİLEBİLİR ÇÖZÜM (biri seçilir, gerekçesi dosya başına yazılır):**
1. Şemaya `framing.startBytes = [0xAA, 0xAA, 0xAA, 0x2D, 0xD4]` konur ve
   `createSchemaParser`in `canParse`i olduğu gibi kullanılır. *(En az kod.)*
2. `createSchemaParser`in döndürdüğü parser sarılır, `canParse` AÇIKÇA yazılır.
   *(Kullanıcı şeması `startBytes`ı değiştirse bile auto-detect imzası
   VARSAYILAN PROFİLE sabit kalır — daha savunulabilir.)*

**`length-based-protocol`ın 899/899'u BU DALGADA DÜZELTİLMEZ** — ayrı bir
kayıt, ayrı bir borç. Ana brifin kapanış görevleri onu CLAUDE.md'ye borç
olarak KAYDEDER.

### Bekçi — `rfTelemetryCanParseRegistry.test.ts` (ÜÇ YÖNLÜ)

1. **İleri:** tüm registry örneklerinde `canParse` → **0**.
2. **Ters:** `createSchemaParser`in boş-`startBytes` davranışı aynı kümede
   **örnek sayısının TAMAMI** kadar çakışır — mayının hâlâ orada olduğunun
   ve bu kaydın ondan KAÇINDIĞININ kanıtı. *(Bu ayak deponun tarihinde ilk kez
   BAŞKA BİR KAYDIN hatasını bekçiliyor; gerekçe test dosyasına yazılır.)*
3. **Kendi üzerinde:** tüm örneklerde `true` — beyazlatılmış/Manchester
   örnekler HARİÇ (onlarda preamble ham telde YOKTUR; AÇIKÇA `false` beklenir).

---

## `decodeOptions` — ON kanal

Kaydın TAMAMI `decodeOptions`la sürülür — bu, kaydın **doğası**dır.

| # | Kanal | Tip | Not |
|---|---|---|---|
| 1 | `profile` | select `spec`/`cc1101`/`nrf`/`custom` | Hazır profiller; `custom` ötekileri açar |
| 2 | `preambleBytes` | text hex, vars. `AA AA AA` | |
| 3 | `syncWord` | text hex, vars. `2D D4` | |
| 4 | `lengthFieldSemantics` | select `payload-only`/`includes-crc`/`includes-header` | **En sık hata kaynağı**; `Length`in neyi saydığı telde YOK |
| 5 | `endianness` | select `big`/`little` | Çok baytlı alanlar |
| 6 | `bitOrder` | select `msb-first`/`lsb-first` | `bitCursor`ın `BitOrder`ı |
| 7 | `whiteningPolynomial` | text, vars. `x^9+x^5+1` | Boş ⇒ whitening YOK |
| 8 | `whiteningSeed` | text hex, vars. `1FF` | |
| 9 | `manchesterPolarity` | select `none`/`ieee802.3`/`thomas` | Varsayılan `none` |
| 10 | `crcAlgorithm` + `crcCoverage` | select (38 katalog girdisi) + select alan aralığı | **İkisi AYRI alan ama TEK kanal sayılır** — ayrı sayılırsa 11 |

### KANAL YAPILMAYACAKLAR

- **RF metadata** (frekans, modülasyon, veri hızı, sapma, bant genişliği,
  RSSI, SNR) — bunlar YAKALAMA metadata'sıdır, çerçevede yoktur ve
  ÇÖZÜMÜ DEĞİŞTİRMEZ. Katalogun "RF Metadata View" aracı `tools` metin
  listesiyle "planlandı" kalır. **Kanal açmak, kullanıcıya çözümü etkilemeyen
  bir şey sordurmak olurdu.**
- **"Unknown RF Protocol Analyzer"** (sabit baytlar, sayaç adayı, checksum
  adayı) — **ÇOK ÇERÇEVELİ**, çerçeveler arası durum (dalga 16 bulgu 12).
  `checksumFinder.ts` bunun tek-çerçevelik parçasını zaten veriyor ve
  `/calculators` altında koşuyor; sayfa ona BAĞLANTI basar (`lora`nın
  `calculatorIds` emsali, `wireless-iot.ts:212-227`).
- **Girdi adaptörü seçimi** (demodüle bayt / bit akışı / nabız süresi /
  logic analyzer / SDR / UART) — **bu bir kanal DEĞİL, bir GİRDİ
  DÖNÜŞÜMÜDÜR** ve `parse`ın ÖNÜNDE olur. Bu dalgada YALNIZ "demodüle bayt"
  yolu bağlanır; bit akışı `bitCursor`la, nabız `pulseLog`la ayrı bir turda.
  Gerekçe dosya başına yazılır.
- **Şema dosyası yükleme** — `definitions` paneli YOK (`[KARAR 18-7]`).

---

## `build` sekmesi — TEK ENCODER'LI KAYIT

Dört kaydın YALNIZ bunda `build` var (`wireless-iot.ts:308`).
`encodeWithSchema(schema, values)` kullanılır; `customBinaryProtocol.ts:36-42`
birebir emsal (hata yolu dahil). **CRC alanı encoder tarafından HESAPLANIR**,
kullanıcıdan istenmez.

---

## Örnek çerçeveler (8)

**1) Varsayılan profil, CRC hesaplanmış — 14 B**
```
aa aa aa 2d d4 01 14 04 34 12 78 56 ac 54
```
`Device 01 · Type 0x14 · Length 4 · Data 34 12 78 56 · CRC16_CCITT_FALSE
0xAC54 (big-endian)`.
> Açıklamasında AÇIKÇA yazılır: *"Alan yerleşimi spec §3.9'dan; CRC değeri
> spec'in `C9 21`i DEĞİL — o değer hiçbir bilinen CRC-16 ile yeniden
> üretilemedi (65.535 polinom tarandı). Buradaki `AC54` motorun kendi
> `CRC16_CCITT_FALSE` çıktısıdır."*

**2) BEYAZLATILMIŞ — aynı çerçeve, PN9 seed `0x1FF` — 14 B**
```
aa aa aa 2d d4 fe f5 19 ae ff fd 65 88 be
```
Preamble ve sync **beyazlatılmaz** (senkronizasyon onlara dayanır); gövde
PN9 dizisi (`FF E1 1D 9A ED 85 33 24 EA`) ile XOR'lanmıştır.
Dewhitening açıkken **1'in gövdesine dönüşür ve CRC PASS olur** — bu turda
geri doğrulandı. `canParse` bu örnekte de `true` (preamble+sync ham).

**3) MANCHESTER — sync sözcüğünün kodlanmış hâli**
`2D D4` → `A6 59 59 9A` (IEEE 802.3 polaritesi). Ters polariteyle çözülürse
tüm bitler ters çıkar; iki polarite şıkkı ekranda ayrışır.
`canParse` **`false`** (ham telde preamble yok) — AÇIKÇA test edilir.

**4) BOZUK CRC** — 1'in son baytı `55`e çevrilir. `expectedValid: false`.

**5) BOZUK Length** — `Length = 0xFF`, çerçeve kısa. `expectedValid: false`.

**6) SIFIR uzunluklu yük** — `Length = 0`, Data yok, CRC hemen gelir
(hesaplanır). Sınır durumu, `expectedValid: true`.

**7) FARKLI CRC algoritması** — aynı gövde, `CRC16_MODBUS` (`0x1FF5`,
little-endian `F5 1F`). `crcAlgorithm` kanalının gerçekten çalıştığını ve
**aynı gövdenin farklı algoritmayla farklı CRC verdiğini** ekranda kanıtlar.
*(CLAUDE.md'nin "aynı bit genişliği aynı algoritma değildir" dersinin
kullanıcıya GÖSTERİLEN hâli.)*

**8) `lengthFieldSemantics` tuzağı** — 1 ile aynı baytlar ama `Length`
CRC'yi de sayacak şekilde (`06`) yazılmış. Varsayılan yorumla `expectedValid:
false`, `includes-crc` seçilince `true`. **Aynı baytların iki farklı anlamı**
— dalga 17'nin SNVT selector dersinin bu kayıttaki karşılığı.

> **ZORUNLU:** 1, 2, 6, 7'nin CRC'leri uygulamada `computeNamedCrc` ile
> YENİDEN üretilir. Brifin verdiği hex bir BAŞLANGIÇ noktasıdır, bir
> otorite değil.

---

## Modül bölünmesi

```
src/protocol-core/decoding/lfsrWhitening.ts        ← YENİ (PN9 + yapılandırılabilir LFSR)
src/protocol-core/decoding/lfsrWhitening.test.ts   ← YENİ (PN9 dizisi fixture)
src/protocol-core/decoding/manchester.ts           ← YENİ
src/protocol-core/decoding/manchester.test.ts      ← YENİ
src/protocols/wireless/rftelemetry/
  rfTelemetryProfiles.ts    hazır profiller (ProtocolSchema nesneleri)
  rfTelemetry.ts            plugin: parser + encoder + 10 kanal + 8 örnek
  rfTelemetry.test.ts
  rfTelemetryCanParseRegistry.test.ts
```

> İki yeni modül **`protocol-core`a** girer, `protocols/`e değil: ikisi de
> protokolden bağımsız dönüşümlerdir ve ileride başka kayıtlar tüketebilir
> (`hdlcCore.ts`/`pulseLog.ts` disiplini). **Ama bu dalgada TEK tüketicileri
> vardır ve bu dürüstçe yazılır** — "ileride paylaşılır" diye API şişirilmez.

---

## Uygulama görevleri (sırayla)

1. `lfsrWhitening.ts` + testi. **PN9 `FF E1 1D 9A ED 85 33 24 EA` fixture'ı
   ASSERT edilir.**
2. `manchester.ts` + testi. İki polarite, geçersiz çift hatası,
   `2D D4 ↔ A6 59 59 9A` fixture'ı.
3. `rfTelemetryProfiles.ts` — varsayılan (spec) profili `ProtocolSchema`
   olarak; `coverage` ALAN KİMLİĞİ aralığıyla.
4. `rfTelemetry.ts` — `createSchemaParser` üstüne **`canParse` MAYINI
   ETKİSİZLEŞTİRİLEREK**; `encodeWithSchema` ile `build`; 10 kanal; 8 örnek.
   Dewhitening ve Manchester `parse`ın ÖNÜNDE, girdi dönüşümü olarak koşar.
5. `rfTelemetryCanParseRegistry.test.ts` — üç yönlü bekçi.
6. Katalogda `rf-telemetry-custom-frame`e `pluginId` + `status: 'partial'`;
   dosya başına: kapsam, **spec örneklerinin çürümesi**, `definitions`
   panelinin neden boş bastığı, girdi adaptörü sınırı.
7. `src/protocols/index.ts` kaydı; `tr.ts`/`en.ts` (~85 anahtar).
   **Alan adları, profil adları, CRC algoritma adları VERİDİR — çevrilmez.**
8. `npm run typecheck` + `npm test` TAM.

---

## ⭐ DOMAIN VE FAZ KAPANIŞI — bu alt dalganın SON görevleri

**Ana brifin "Domain kapanış görevleri" bölümü BURADA UYGULANIR:**

1. **İki fixture bekçisinin GERÇEKTEN `skipped` raporladığını KOŞTURARAK
   doğrula.** Yeşil geçmesi YETMEZ:
   ```
   npx vitest run src/pages/ProtocolPage.test.tsx      → "skipped" görünmeli
   npx playwright test e2e/nmea-decode.spec.ts          → "skipped" görünmeli
   ```
2. **`CLAUDE.md`** — borç **4 → 0**, ham sayım KODDAN, dört kaydın `partial`
   gerekçeleri, yeni kalıcı dersler, iki yeni borç
   (`length-based-protocol` `canParse`i, `custom-schema` paneli).
3. **`docs/plan-fazlar.md`** — `:32` faz tablosunda `10+` satırı **`✅ TAMAM`**;
   *"SEKİZİNCİ ve SON kapanan domain; kalan kanonik iş SIFIR"*; dalga 18
   kapanış özeti; **Faz 10'un kendisinin kapanışı.**
4. **`docs/brief-faz10-dalga18.md`** — "Uygulama sırasında çürüyenler" doldurulur.
5. **Sıradaki domain seçimi YAPILMAZ** — seçenek kalmadı.

## Tamamlanma ölçütü

- Örnek 1 çözülüyor, CRC **PASS**.
- Örnek 2 dewhitening açıkken 1 ile AYNI alanları veriyor ve CRC **PASS**.
- Örnek 3'te iki polarite farklı sonuç veriyor; geçersiz çift hata basıyor.
- Örnek 7 aynı gövdeye FARKLI CRC basıyor (algoritma kanalı çalışıyor).
- Örnek 8 `lengthFieldSemantics`e göre geçerli/geçersiz değişiyor.
- `build` sekmesinden üretilen çerçeve `parse`la geri okunuyor (round-trip).
- **`length-based-protocol` gibi 899/899 çakışması YOK** — bekçi kanıtlıyor.
- `npm test` TAM yeşil; **iki fixture bekçisi `skipped`.**
- **Katalogda `planned` kanonik kayıt: SIFIR.**
