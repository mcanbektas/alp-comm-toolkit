# BRİF — Faz 10 dalga 17, `lonworks` (keşif + uygulamaya hazır)

**Tarih:** 2026-08-26 · **Depo HEAD:** `3969daf` (temiz) · **Domain:**
`building-automation` · **Kanonik kayıt:** 1 (`lonworks`)

> **DİKKAT — depo yolu.** Çalışılacak depo **`/Users/canbektas/dev/alp-comm-toolkit`**.
> `~/Desktop/alp-comm-toolkit` BOZUK (iCloud git nesnelerini evict etti); orada
> `git` komutu çalıştırma, oraya dosya yazma.

---

## Bu dosyanın rolü ve neden TEK brif

Dalga 16'nın üç kaydı üç ayrı brif almıştı çünkü hiçbir kod, kaynak ya da tel
biçimi paylaşmıyorlardı. **Bu dalgada kayıt bir tane**, tek bir tel biçimi ve tek
bir kaynak kümesi var. Ana brif + alt brif ayrımı burada aynı şeyi iki kez yazmak
olurdu. **Alt dalga bölünmesi de YOK** — iş tek commit: `17` (alt harf yok).

Kod yazacak model **YALNIZ bu dosyayı** okur. Emsal gerektiğinde
`docs/brief-faz10-dalga16c.md` (kapsam kararı + `canParse` `true` bekçisi) ve
`docs/brief-faz10-dalga16b.md` (iki kaynağın çelişmesi) açılır.

**Bu dalga `lonworks` ailesini VE `building-automation` DOMAİNİNİ KAPATIR** —
yedinci kapanan domain. Kanonik borç **5 → 4**.

---

## Kapsam — katalog ne vaat ediyor

`[KANIT]` `src/app/catalog/domains/building-automation.ts:296-326`

| Alan | Değer |
|---|---|
| `path` | `building-automation/lonworks/lonworks` |
| `layer` | `multi-layer` |
| `status` | `planned` → **`partial`** |
| `tabs` | `overview` · `decode` · `data` · `diagnostics` · `definitions` · `examples` |
| `tools` | `Device` · `Network Variables` · `SNVT` · `Configuration Properties` · `XIF Import` · `Gateway Mapping` |
| `definitions` | `['xif']` |

**`live` YOK, `build` YOK, `timing` YOK.**
→ **`encoder` YAZILMAZ** (16c/`iec-61162` gerekçesi: `build` sekmesi yok).
→ Zamanlama hesabı YAZILMAZ.

Katalogdaki kendi yorumu `[KANIT]` `:303-305`:
> *"Kapsam bilinçli olarak dar: ilk sürümde full stack implementasyonu
> hedeflenmiyor, temel mesaj görünümü yeterli. Bu yüzden `live` ve `build` yok."*

### `definitions: ['xif']` — panel YOK, ve bu MAYIN DEĞİL

`[KANIT]` `src/pages/ProtocolPage.tsx:104-107`:
```ts
const DEFINITION_PANELS: Partial<Record<DefinitionFormat, typeof DbcPanel>> = {
  dbc: DbcPanel,
  eds: EdsPanel,
};
```
`xif` bu tabloda **YOK**; `src/features/protocol-definitions/` altında yalnız
`DbcPanel.tsx` + `EdsPanel.tsx` var. `ProtocolPage.tsx:255-265`in yorumu:
> *"Motoru olmayan bir biçim (`gsd`, `ldf`, …) listede olsa da
> `DEFINITION_PANELS`te karşılığı yoksa `undefined` kalır ve 'planlandı' dalına
> düşülür."*

→ **`definitions` sekmesi "planlandı" basar ve BU DOĞRU DAVRANIŞTIR.** Emsal
(dalga 16'nın mayın taramasında zaten doğrulanmış): `e2e/eds-definitions.spec.ts:145`
ve `e2e/arinc-429-decode.spec.ts:328` — hedefleri `lin` ve `arinc-429`, ikisi de
`ready`, sınanan şey tam da panelin BAĞLI OLMAMASI. **XIF parser'ı bu dalgada
YAZILMAZ** — biçim belgeli olsa bile (aşağıda `[KARAR 17-4]`).

---

## Kaynak durumu — keşif hipotezi TAMAMEN ÇÜRÜDÜ

Görev tanımının hipotezi: *"`lonworks` spec'i üyelik/paywall arkasında;
`seatalk`/`cc-link-ie` sınıfı bir kaynaksız-kayıt vakası."*

**ÇÜRÜDÜ.** Normatif spesifikasyon **serbestçe indirilebiliyor**, tam yığın
**MIT lisansıyla açık kaynak**, ve **12.028 çerçevelik gerçek bir yakalama** var.
Bu dalganın kaynak durumu **dalga 16'nın herhangi bir kaydından daha iyi**.
Rozeti belirleyen şey kaynak değil, **kapsam**.

### Kaynak 1 — Echelon LonTalk Protocol Specification v3.0 (NORMATİF, ÜCRETSİZ) 🏆

`https://scadahacker.com/library/Documents/ICS_Protocols/Echelon%20-%20LonTalk%20Protocol%20Specification%20v3.0.pdf`

**Bağımsız doğrulandı (2026-08-26):** HTTP **200**, **598.002 bayt**,
`application/pdf`, **112 sayfa**, Echelon doküman no `078-0125-01A`.
RC4 şifreli ama `pdftotext -layout` temiz çıkarıyor (**5907 satır**).

Bu, ISO/IEC 14908-1'in kaynağı olan normatif metindir. Aşağıdaki `[KANIT]`
atıflarında `spec.txt:NNN` = bu PDF'in `pdftotext -layout` çıktısındaki satır.
**Uygulama turu PDF'i YENİDEN indirir ve YENİDEN çıkarır** — brifteki satır
numaraları `pdftotext` sürümüne göre kayabilir, o zaman metinle ara.

### Kaynak 2 — EnOcean/Echelon LON yığını, MIT (BİRİNCİ SINIF UYGULAMA) 🏆

| Depo | Ne | Doğrulama |
|---|---|---|
| `https://github.com/izot/lon-stack-dx` | Temiz ISO/IEC 14908-1 C yığını | HTTP 200 |
| `https://github.com/izot/lon-stack-ex` | **Orijinal Echelon LonTalk Stack'in tamamı** (© Dialog Semiconductor, MIT) — IP-852 router + protokol analizörü dahil | HTTP 200 |
| `https://github.com/izot/shortstack` | Gerçek `.xif` örnekleri | HTTP 200 |

**OKUMA KURALI — `BITS<n>()` makrolarının YÖNÜ.** Bu yığındaki her bit alanı
`BITS<n>(ad, uzunluk, …)` makrosuyla yazılmıştır ve yönü **iki dosyanın
birlikte** okunmasıyla belirlenir:

`[KANIT]` `lon-stack-dx/include/common/bitfield.h:12-14` (dosyanın kendi başlığı):
> *"BITS\<n\>() arguments are listed in little endian order (LSB first).
> **If listed in big endian order, then define `BITF_DECLARED_BIG_ENDIAN`.**"*

`[KANIT]` `lon-stack-dx/include/lcs/lcs_platform.h:66-67`:
```c
// LON Stack DX defines bitfields MSB first.
#define BITF_DECLARED_BIG_ENDIAN
```

→ **Argümanlar MSB→LSB sırasıyla listelenir.** Yani
`BITS4(protocolVersion, 2, pduType, 2, addrFmt, 2, domainLength, 2)` =
`protocolVersion` bit 7:6, `pduType` 5:4, `addrFmt` 3:2, `domainLength` 1:0.
**Bu kuralı ters okumak tüm bit alanlarını ters çevirir ve hata VERMEZ.**
(Aynı dosyada `BITF_LITTLE_ENDIAN` de `#define` edilmiş görünüyor ama
`bitfield.h:32-36` onu `BITF_DECLARED_BIG_ENDIAN` varken **`#undef` ediyor** —
yalnız birine bakıp karar verme.)

**KOD KOPYALANMAZ.** Bu depolardan yalnız **biçim ve sabit** bilgisi alınır
(`bacnetip.ts` / `bacnet/npdu.ts` dosya başlarındaki disiplinin aynısı).

### Kaynak 3 — Wireshark dissector'ları (ÇAPRAZ TEYİT)

| Dosya | URL | Satır |
|---|---|---|
| `packet-lon.c` | `https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-lon.c` | 767 |
| `packet-cnip.c` | `https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-cnip.c` | 250 |

İkisi de `epan/dissectors/CMakeLists.txt`te kayıtlı (`:1188` ve `:622`).
**`packet-lontalk.c`, `packet-ansi709.c`, `packet-iso14908.c` YOKTUR (404)** —
bu adlarla arama, bulamazsın.

> Wireshark **birinci sınıf DEĞİL, üçüncü sıradadır** bu dalgada: üç yerde
> normatif spec'ten sapıyor (aşağıda SAPMA 1/2/4), AuthPDU maskeleri kendi
> `TODO`suyla bozuk, CRC'si `#if 0` içinde ve NM/ND yanıtlarını yanlış
> etiketliyor. **Çapraz teyit için mükemmel, tek referans olarak HAYIR.**

### Kaynak 4 — `cespedes/go-lon` (YALNIZ DESTEKLEYİCİ)

`https://github.com/cespedes/go-lon`, HEAD `d39a519` (2024-02-04, *"Archiving"*).
227 satır Go. **BOZUK**: adres biçimi 3'te `domain_offset`u 5'te bırakıyor
(11 olmalı) ve 6 baytlık dilimden `uint64` okumaya çalışıyor. **Referans
DEĞİL** — ama bir yerde (SAPMA 2) Wireshark'a karşı HAKLI çıktı.

### Kaynak 5 — GERÇEK YAKALAMA (12.028 datagram) 🏆

`https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/eia709.1-over-eia852.pcap`
— **1.062.555 bayt**, wiki başlığı *"Lontalk (EIA-709.1) encapsulated in EIA-852 —
Lots of button presses, temperature sensors, etc."*

Bu keşif turunda **indirildi ve 12.028 datagramın tamamı çözüldü**. Ölçümler
aşağıda. 16c'nin `.pcap` yöntemi birebir tekrarlandı.

### Kaynak 6 — LonMark SNVT kaynakları (AÇIK)

| Kaynak | Doğrulama | İçerik |
|---|---|---|
| `https://www.lonmark.org/nvs/` | HTTP 200 | Canlı HTML gezgini, girişsiz, **221 tip**: indeks, boy, Neuron C tipi, min/max/invalid, ölçek (A,B,C) |
| `https://www.lonmark.org/wp-content/uploads/2020/01/snvt.pdf` | HTTP 200, **7.011.663 bayt** | 413 sayfalık SNVT Master List — bağımsız ikinci kaynak |
| `https://www.lonmark.org/wp-content/uploads/2020/06/LonMarkResourceFiles1502.zip` | 359 KB | Gerçek `STANDARD.TYP/.FMT/.ENU/.FPT/.ENG` |

### Kaynak 7 — deponun KENDİ spec'i (kapsamı ZATEN daraltıyor)

`docs/spec/ozet/07-bina-otomasyonu.md:236`:
> *"İlk toolkit sürümünde full LonWorks stack implementasyonu zorunlu değildir;
> temel görünüm yeterlidir: Message, Source, Destination, Network Variable,
> Service, Payload, Timing."*

ve `:454` (spec'in kendi "dikkat çekenler" listesi):
> *"LonWorks bilinçli olarak eksik bırakılmış … diğer tüm protokollerin aksine
> burada kapsam açıkça daraltılmış, yalnız temel mesaj görünümü isteniyor."*

**Deponun 172 kaydı içinde kapsamı spec düzeyinde ÖNCEDEN daraltılmış TEK
kayıt budur.**

### Bulunamayanlar (bir sonraki dalga tekrar aramasın)

- **CEA-852/EIA-852 metninin kendisi** — tamamı paywall'lı, archive.org'da yok.
  (CN/IP başlığı yine de üç bağımsız kaynakta ve gerçek trafikte doğrulandı.)
- **Ham L2 için yakalama yolu YOK**: libpcap'te LonTalk için `DLT_`/`LINKTYPE_`
  **yok** (`pcap/dlt.h` tarandı), Wireshark'ın link katmanı girişi yok, kamuya
  açık ham-L2 yakalaması yok. Ham teli çözmek **satıcı donanımı** (U10/U60 USB)
  ve kendi yakalama yolunu yazmayı gerektirir.
- `LonMarkTech/lon-resources` GitHub deposu **BOŞ** (yalnız README + LICENSE).
- Bayt düzeyinde PDU diyagramı olan akademik makale yok; *The LonWorks Handbook*
  tam metin yok; bitsavers'ta Echelon yok.

---

## `[KARAR 17-1]` KAPSAM — HANGİ TEL ÇÖZÜLÜR (karara BAĞLANDI, DUR-SOR DEĞİL)

**ÇÖZÜLECEK:** CN/IP (ISO/IEC 14908-4 · ANSI/CEA-852) UDP datagramı **ve**
içindeki LonTalk (ISO/IEC 14908-1 · ANSI/EIA-709.1) PDU'su.

**KAPSAM DIŞI, ve sayfa bunu AÇIKÇA yazar:**
- **ISO/IEC 14908-2 (TP/FT-10)** ve **14908-3 (PL-20)** telleri —
  ham L2 çerçeveleme (preamble/bit-sync/byte-sync, kodlama, sondaki CRC).
- **XIF dosya çözümü** — `[KARAR 17-4]`.
- **SNVT tipinin çerçeveden ÇIKARILMASI** — `[KARAR 17-3]`.
- **Gateway Mapping** (BACnet Object ↔ LON NV) — analyzer işi, çözücünün değil.
  `bacnetip.ts`in BBMD/Foreign-Device tablo takibini reddetmesiyle aynı sınıf.

### Gerekçe 1 — YAKALAMA YOLU YOK, SPEC EKSİKLİĞİ YOK

**Bu, dalganın en ince ayrımıdır ve dosya başına AYNEN yazılır:** ham L2'nin
**biçimi** normatif spec'te tam olarak var (Figure 3.2 + CRC), yani "belgesiz"
DEĞİL. Sorun **tesisat**: libpcap'te `DLT_` yok, Wireshark'ın link girişi yok,
kamuya açık yakalama yok. **Bir `Uint8Array`e ham LonTalk L2 çerçevesinin
girmesinin kamuya açık bir yolu yoktur.**

Bunun kanıtı birinci sınıf kaynağın kendi mimarisidir
`[KANIT]` `packet-lon.c:751-754`:
```c
proto_reg_handoff_lon(void)
{
	dissector_add_uint("cnip.protocol", 0, lon_handle);
}
```
**Tek giriş noktası CN/IP datagramının `pcode == 0` yüküdür.**

### Gerekçe 2 — ÖLÇÜLDÜ: HAM TEL BAYTLARDAN TANINAMAZ

886 örnek üzerinde: CN/IP imzası **0** yanlış pozitif, ham LonTalk PDU imzası
**401** (naif) / **375** (daraltılmış). Ham telin sihirli sayısı, uzunluk alanı
ve sınırlayıcısı yok — `seatalk`in (16b) 27/870'inden **on beş kat kötü**.

### Gerekçe 3 — EMSAL

`iec-61162` `UdPbC`-only (16c) · `ads-b` 1090ES-only (15h) · `iec-61850`
GOOSE-only · `foundation-fieldbus` HSE-only · `cc-link-ie` 0x890F-only.
**"Doğrulanabilir teli seç, ötekini açıkça kapsam dışı yaz"** kuralının
yedinci uygulaması.

> **Ham L2 için kapı KAPALI DEĞİL:** kullanıcı başka bir yoldan ham PDU elde
> etmişse `payloadKind` kanalıyla çözebilir (aşağıda). Kapsam dışı olan
> **ham L2 ÇERÇEVELEMESİ** (preamble/sync/CRC katmanı), PDU'nun kendisi değil.

---

## Girdi sözleşmesi

**TEK UDP PAYLOAD'I.** `coap.ts` / `bacnetip.ts` girdi emsali:

- UDP datagramı mesaj sınırını zaten verir — **stream birleştirme YOK**.
- `data` uzunluğu CN/IP mesajının TAMAMIDIR; **"artakalan veri" kavramı YOK**.
- IP/UDP başlıkları girdide **YOKTUR** (`bacnetip.ts` ile aynı). Port numarası
  çerçevede taşınmaz → TUZAK 6.
- `udp.ts`ye **DOKUNULMAZ**.

---

## Çerçeve tablosu A — CN/IP başlığı (sabit 20 bayt)

`[KANIT]` `packet-cnip.c:99-133` (ofsetler `dissect_cnip` gövdesinden) ·
`izot/lon-stack-ex` `LtIpPackets.h` (`LtIpPktHeader`) · `go-lon/lon.go:14-26`
(`const CnipLen = 20`, `binary.BigEndian`) · **ve 12.028 gerçek datagram.**

| Ofset | Boy | Alan | Kodlama | Not |
|---|---|---|---|---|
| 0 | 2 | **Packet size** | uint16 BE | **TOPLAM datagram uzunluğu, başlığı DA sayar.** Kendini doğrulayan alan — `canParse`ın çapası. |
| 2 | 1 | **Version + version bits** | ⚠️ SAPMA 1 | **bit 4:0 = sürüm · bit 7 = "vendor-private paket izliyor" · bit 6:5 MBZ** |
| 3 | 1 | **Packet type** | uint8 | 14 değerli küme, aşağıda. |
| 4 | 1 | **Ext. header size** | uint8 | **32-bit SÖZCÜK sayısı** — atlanacak bayt = `4 × exth`. |
| 5 | 1 | **Protocol flags** | bit alanı | `0x20` = security · `0x1F` = **protocol code** (0 = EIA-709/LonTalk) |
| 6 | 2 | **Vendor code** | uint16 BE | |
| 8 | 4 | **Session ID** | uint32 BE | |
| 12 | 4 | **Sequence number** | uint32 BE | |
| 16 | 4 | **Time stamp** | uint32 BE | **Milisaniye** (kaynak aşağıda), ama EPOCH'u çerçevede yok — TUZAK 5. |
| 20 | 4×`exth` | Genişletilmiş başlık | ham | Echelon uzantısı (`exth == 3`, 12 bayt): localIP(4)+natIP(4)+port(2)+kullanılmayan(2). |
| 20+4×`exth` | … | **Yük** — `pcode == 0` ise LonTalk PDU'su | | |

**Alan adları ve yorumları birebir** `[KANIT]`
`lon-stack-ex/LonTalkStack/Source/ShareIp/include/LtIpPackets.h:257-272`
(`struct LtIpPktHeader`):
```c
STD_HDR_SIZE = (4*5),        // 20
EXT_HDR_ADD_SIZE = (4*3),    // 12
word  packetSize;    // total bytes in packet including header
byte  version;       // protocol version - lower 5 bits
byte  versionBits;   // bits 5-7 of version - bits 5-6 MBZ
                     //                     - bit 7 => vendor private packet follows
byte  packetType;
byte  extndHdrSize;  // size of header - 20 - MBZ for this version
byte  protocolFlags; // 0 for EIA-709 (LonTalk)
word  vendorCode;    // EIA852 uses 2 bytes, plus the previous field
ULONG session; ULONG sequence;
ULONG timestamp;     // milliseconds in wall clock time
```

> **`extndHdrSize`in BİRİMİ: 32-bit SÖZCÜK — ve struct yorumu YANILTICIDIR.**
> Başlıktaki *"size of header - 20"* yorumu bayt gibi okunuyor, ama **kod
> aksini söylüyor** `[KANIT]` `LtIpPackets.cpp` `LtIpPktHeader::parse` ve
> `::build`, birebir yorumuyla:
> ```c
> // extndHdrSize is a count of 4-byte values
> p += (extndHdrSize*4);
> ```
> **Wireshark ile Echelon burada ÖRTÜŞÜYOR** (`packet-cnip.c:130`
> `offset += 4 * exth_len;`). `go-lon` alanı okuyup **hiç kullanmıyor** —
> bu bir sapma değil, go-lon'un eksiği. **Motor `4 × exth` atlar.**
> Ders: *"aynı dosyadaki YORUM ile KOD ayrışabilir; kod kazanır."*

### CN/IP paket tipleri `[KANIT]` `packet-cnip.c:22-38`

| Kod | Ad | Kod | Ad |
|---|---|---|---|
| `0x01` | **Data Packet** | `0x07` | Acknowledge |
| `0x03` | Device Registration | `0x08` | Channel Routing |
| `0x04` | Channel Membership | `0x60` | Status/Health/Statistics Request |
| `0x06` | Send List | `0x63` | Device Configuration Request |
| `0x64` | Channel Membership Request | `0x66` | Send List Request |
| `0x68` | Channel Routing Request | `0x70` | Status/Health/Statistics Response |
| `0x71` | Device Configuration | `0x7F` | Segment |

**Yalnız `0x01` LonTalk yüküne dallanır** (`packet-cnip.c:16` `#define
DATA_PACKET 0x01`, `:134`). Kalan 13 tip **ADI BASILIR, gövdesi HAM kalır** —
Wireshark'ın kendisi de öyle (`:139-142` `ei_cnip_type_unknown`).
`bacnetip.ts`in dokuz BVLC fonksiyonunu "ad + ham gövde" bırakmasının aynısı.

### UDP portları — IANA'da KAYITLI (Wireshark'ın yorumu YANLIŞ)

`packet-cnip.c:20` `/* Not IANA registered */` diyor. **YANLIŞ.**
IANA `service-names-port-numbers` kaydı (birebir):
```
lontalk-norm       1628        udp    LonTalk normal
lontalk-urgnt      1629        udp    LonTalk urgent       [Bob_Dolin]   2008-04-10
```
1629 = **öncelikli/urgent kanal**. Bu bilgi motoru ETKİLEMEZ (port girdide yok),
ama dokümantasyon metninde doğru yazılır.

---

## Çerçeve tablosu B — LonTalk PDU

Tüm ofsetler **LonTalk PDU'sunun başına** görelidir (= `20 + 4×exth`).

### B.1 — L2/PPDU okteti (ofset 0)

| Bit | Maske | Alan |
|---|---|---|
| 7 | `0x80` | Priority |
| 6 | `0x40` | Alt path |
| 5..0 | `0x3F` | Delta backlog |

`[KANIT]` `lon-stack-dx/lcs/lcs_link.c:39` `BITS3(priority, 1, altPath, 1, deltaBL, 6)`
(MSB-first okuma kuralı) · `packet-lon.c:503-517` · `go-lon:93-95`.
**ÜÇ KAYNAK BİREBİR AYNI.**

### B.2 — NPDU okteti (ofset 1)

| Bit | Maske | Alan | Değerler |
|---|---|---|---|
| 7..6 | `0xC0` | Version | Yakalamada 12028/12028 **0** |
| 5..4 | `0x30` | PDU format | `0`=TPDU · `1`=SPDU · `2`=AuthPDU · `3`=APDU |
| 3..2 | `0x0C` | Address format | `0`=Broadcast · `1`=Multicast · `2`=2a/2b · `3`=UID |
| 1..0 | `0x03` | Domain length | `0`/`1`/`2`/`3` → **0 / 1 / 3 / 6 BAYT** |

`[KANIT]` `lon-stack-dx/lcs/lcs_network.c:31`
`BITS4(protocolVersion, 2, pduType, 2, addrFmt, 2, domainLength, 2)` ·
`packet-lon.c:229-232, 522-541` · normatif spec `spec.txt:697-700` (Figure 3.2
başlığı: `Ver(2) | PDU Fmt(2) | AddrFmt(2) | Length(2)`).
**ÜÇ KAYNAK BİREBİR AYNI.**

> **TUZAK 1 — versiyon PPDU oktetinde DEĞİL, NPDU oktetindedir.** İlk bayt
> tamamen öncelik/backlog'dur. Bu keşif turunda ilk `canParse` ölçümü yanlış
> bayta bakarak yapıldı (310 çıktı), doğru bayta geçince 401 oldu.
> **Yanlış bayt ölçümü de zehirliyor.**

### B.3 — Adres bölümü — NORMATİF FIGURE 3.2

`[KANIT]` `spec.txt:705-717`, birebir:
```
                     8      1         7         8
              0: SrcSubnet 1 SrcNode DstSubnet             { Broadcast }
              1: SrcSubnet 1 SrcNode DstGroup
                                                       1       7
             2a: SrcSubnet 1 SrcNode DstSubnet 1 DstNode
                                                                            8          8
             2b: SrcSubnet 0 SrcNode DstSubnet 1 DstNode               Group     GrpMemb
                                                                                               48
              3: SrcSubnet 1 SrcNode DstSubnet                             Neuron ID

  Figure 3.2 NPDU/TPDU/SPDU Addressing—Physical Address Formats
```
ve `spec.txt:719+`:
> *"The eighth bit in the source node field byte is the selector field…
> Address format #2 is the only address format using this capability."*

| `addr_fmt` | Boy | +2 | +3 | +4 | +5 | +6 | +7 | +8..+10 |
|---|---|---|---|---|---|---|---|---|
| **0** Broadcast | **3** | src subnet | `1`+src node(7) | dst subnet | — | — | — | — |
| **1** Multicast | **3** | src subnet | `1`+src node(7) | dst **group** | — | — | — | — |
| **2a** Unicast | **4** | src subnet | **`1`**+src node(7) | dst subnet | `1`+dst node(7) | — | — | — |
| **2b** Multicast-ACK | **6** | src subnet | **`0`**+src node(7) | dst **subnet** | `1`+dst node(7) | group | group member | — |
| **3** UID | **9** | src subnet | `1`+src node(7) | dst subnet | — | — | — | Neuron ID, **6 bayt** |

**2a mı 2b mi?** `addr_fmt == 2` iken ayrım **kaynak-düğüm baytının (+3) en
anlamlı bitidir**: `1` → 2a (4 bayt), `0` → 2b (6 bayt).
**DÖRT kaynak aynı:** normatif spec Figure 3.2 + `spec.txt:719`
(*"The eighth bit in the source node field byte is the selector field"*) ·
`packet-lon.c:265` `addr_a = tvb_get_uint8(tvb, offset+1) >> 7;` ·
`go-lon:115` `if b[CnipLen+3] & 0x80 == 0 { … }` ·
`lon-stack-dx/lcs/lcs_network.c:25-28` dosya yorumu, birebir:
> *"data[0] is source subnet. data[1] is source node. Based on the addrFmt
> field and **1st bit of data[1]**, the rest of the data array is used
> appropriately."*

### B.4 — Domain alanı (adres bölümünden hemen sonra)

`dom_len` `0/1/2/3` → **0 / 1 / 3 / 6 bayt**.
`[KANIT]` spec Figure 3.2 (*"0/8/24/48 … 0, 1, 3, or 6 bytes"*) ·
`lon-stack-dx/lcs/lcs_network.c` domain uzunluk kodlaması · `packet-lon.c:286-303` ·
`go-lon:124-144`. **DÖRT KAYNAK AYNI.**

> **TUZAK 10 — `2` ÜÇ bayttır, iki değil.** Tabloyu koddan yaz, kafadan üretme.

### B.5 — Transport/Session/Auth okteti

Adres + domain'in ardındaki tek oktet:

| `pdu_fmt` | Oktet düzeni | Tip alanı |
|---|---|---|
| **0** TPDU | `0x80`=auth · `0x70`=tip · `0x0F`=transaction no | `0`ACKD `1`UnACKD_RPT `2`ACK `4`REMINDER `5`REM/MSG |
| **1** SPDU | `0x80`=auth · `0x70`=tip · `0x0F`=transaction no | `0`REQUEST `2`RESPONSE `4`REMINDER `5`REM/MSG |
| **2** AuthPDU | `0xC0`=fmt (addrFmt ile aynı) · `0x30`=tip · `0x0F`=transaction no | `0`CHALLENGE `2`REPLY |
| **3** APDU | **oktet YOK** — doğrudan APDU'ya geçilir | — |

`[KANIT]` `lon-stack-dx/lcs/lcs_tsa.c:80` `BITS3(auth, 1, …)` ve `:89`
`BITS3(fmt, 2, …)` · `packet-lon.c:54-78, 306-320, 359-372, 397-410` ·
`go-lon:184-224`.

- **REMINDER (4) / REM/MSG (5)**: tip oktetinin ardında **1 bayt `M_Len`** +
  `M_Len` bayt `M_List`; REM/MSG'de sonra APDU başlar, REMINDER'da biter.
  `[KANIT]` `packet-lon.c:325-345`.
- **AuthPDU CHALLENGE/REPLY gövdesi 9 bayt** `[KANIT]` `packet-lon.c:414-417`.
  Yakalamada örnek YOK → `[BEKLENTİ]`.

> **TUZAK 2 — Wireshark'ın AuthPDU maskeleri BOZUK ve kaynak bunu KENDİSİ
> SÖYLÜYOR.** `packet-lon.c:395`:
> ```c
> /* TODO: these masks are not correct - have { 0xc0, 0x02, 0x0f } */
> ```
> Kayıtlı maskeler `0x0c` ve `0x02`. **`TODO`nun kendi önerisi de yanlış** —
> doğru değerler **`0xC0` ve `0x30`**, ve bunu `lcs_tsa.c:89`in
> `BITS3(fmt, 2, pduMsgType, 2, transNum, 4)` satırı veriyor. Wireshark'ın
> **çıkarım kodu** (`(b >> 4) & 0x03`, `:412`) doğru, **gösterim maskesi**
> yanlış. **Kodun hangi kısmını okuduğuna dikkat et.**

### B.6 — APDU dest&type — NORMATİF KOD UZAYI

`[KANIT]` `spec.txt:3716-3730`, birebir:
```
00xxxxxx       generic application message (64 codes)
1dxxxxxx       a network variable message; "d" indicates direction: 1 for
               outgoing, 0 for incoming. The remaining code bits are
               combined with the first data byte to form a 14 bit network
               variable selector.
011xxxxx       a network management message (32 codes)
0101xxxx       a diagnostic message (16 codes)
0100xxxx       foreign frame (16 codes)
```

| Aralık | Sınıf | Boy | Kod alanı |
|---|---|---|---|
| `0x80`–`0xFF` | **Network Variable** | **2 bayt** | bit14 = yön, bit13..0 = **14 bit selector** |
| `0x00`–`0x3F` | Application (generic) | 1 | `0x3F` |
| `0x40`–`0x4F` | Foreign Frame | 1 | `0x0F` |
| `0x50`–`0x5F` | Network Diagnostic | 1 | `0x0F` — 4 kod adı |
| `0x60`–`0x7F` | Network Management | 1 | `0x1F` — 20 kod adı |

`lon-stack-dx/include/izot/lcs_api.h` `DestinType` birliği aynı bölünmeyi
bağımsızca veriyor: `ap BITS2(2,6)` · `nv BITS3(1,1,6)` · `nm BITS2(3,5)` ·
`nd/ff BITS2(4,4)`.

**NV selector 14 bittir** `[KANIT]` `lon-stack-dx/lcs/lcs_app.c`:
`selector = (code.nv.nvCode << 8) | data[0]` — aralık 0–0x3FFF.

**`NM_MANUAL_SERVICE_REQUEST` (`0x7F`) özeldir**: kodun ardından **6 bayt Neuron
ID + 8 bayt Program ID** `[KANIT]` `packet-lon.c:466-472`.

**Network Management kodları (20)** `[KANIT]` `packet-lon.c:80-103`:
`0x61` NM_QUERY_ID · `0x62` NM_RESPOND_TO_QUERY · `0x63` NM_UPDATE_DOMAIN ·
`0x64` NM_LEAVE_DOMAIN · `0x65` NM_UPDATE_KEY · `0x66` NM_UPDATE_ADDR ·
`0x67` NM_QUERY_ADDR · `0x68` NM_QUERY_NV_CNFG · `0x69` NM_UPDATE_GROUP_ADDR ·
`0x6A` NM_QUERY_DOMAIN · `0x6B` NM_UPDATE_NV_CNFG · `0x6C` NM_SET_NODE_MODE ·
`0x6D` NM_READ_MEMORY · `0x6E` NM_WRITE_MEMORY · `0x6F` NM_CHECKSUM_RECALC ·
`0x70` NM_WINK · `0x71` NM_MEMORY_REFRESH · `0x72` NM_QUERY_SNVT ·
`0x73` NM_NV_FETCH · `0x7F` NM_MANUAL_SERVICE_REQUEST

**Network Diagnostic kodları (4)** `[KANIT]` `packet-lon.c:105-112`:
`0x51` ND_QUERY_STATUS · `0x52` ND_PROXY_COMMAND · `0x53` ND_CLEAR_STATUS ·
`0x54` ND_QUERY_XCVR

> **TUZAK 3 — Wireshark'ın "Shouldn't get here" dalı ULAŞILAMAZDIR.** Beş koşul
> `0x00`–`0xFF`in tamamını kaplar. `packet-lon.c:484-486` ölü koddur; ona karşılık
> gelen bir `ProtocolError` YAZMA.

---

## `[KARAR 17-5]` TUZAK 4 — NM/ND YANIT KODLARI ÇAKIŞIR, ve bu NORMATİFTİR

**Bu, dalganın en incelikli kararıdır ve `mode-s`in AP alanı kararının (15h)
birebir aynı sınıfıdır.**

`[KANIT]` `spec.txt:4394-4401` (NM yanıtı), birebir:
> *"Responses that have been generated by the execution of these NM commands are
> directed to the Application, as specified by the first byte of the APDU:*
> **`00pxxxxx`**
> *The `<p>` field is set to one if the operation succeeded, or zero if it failed…
> The `<xxxxx>` field echoes the original NM command code."*

`[KANIT]` `spec.txt:4406-4420` (ND yanıtı), birebir:
> *"ND responses have the following format, where `<p>` is the same as in NM
> responses and `<xxxx>` mirrors the original command:*
> **`00p1xxxx`**
> *The implications of this are that all NM/ND requests are delivered to the
> NM/ND layer …, while all NM/ND responses are delivered to the Application Layer."*

**Sonuç — ÜÇ KATLI ÇAKIŞMA:**
1. NM/ND yanıtları `0x00`–`0x3F` aralığındadır, yani **"generic application
   message" aralığının İÇİNDE**.
2. ND yanıt biçimi (`00p1xxxx`) NM yanıt biçiminin (`00pxxxxx`) **ALT KÜMESİDİR**.
   `0x30`–`0x3F` hem "NM başarı yanıtı (komut `0x70`–`0x7F`)" hem "ND başarı
   yanıtı" olarak okunabilir.
3. Ayrım **YALNIZ eşleşen isteğe bakılarak** yapılabilir — ve o istek **BU
   ÇERÇEVEDE YOKTUR**.

**GERÇEK YAKALAMA BUNU DOĞRULUYOR (ölçüldü):** 15 `NM_NV_FETCH` (`0x73`)
isteğinin 15 yanıtının **hepsi `0x33`**. Aritmetik: `0x73 & 0x1F = 0x13`,
`p=1` → `001 10011` = **`0x33`** ✓. Ama `0x33` aynı zamanda
`ND_CLEAR_STATUS` (`0x53`) başarı yanıtı olarak da geçerlidir.

**KARAR — motor ne yapar:**
- Alan **`Application code`** olarak basılır (ölçülebilir olan, üç kaynağın da
  yazdığı).
- SPDU **RESPONSE** içindeyken **`responseCodeAmbiguous` uyarısı** basılır ve
  metni **iki adayı da** listeler: *"NM komutu 0x?? başarı/başarısızlık yanıtı
  ya da ND komutu 0x?? yanıtı — ayrım eşleşen isteğe bakmayı gerektirir ve o
  istek bu çerçevede yok."*
- **Çerçeveler arası eşleştirme YAPILMAZ** (dalga 16 bulgu 12: *"Çerçeveler arası
  durum PARSER'A GİRMEZ"*). Transaction numarası **basılır** ki kullanıcı
  komşu çerçeveyle kendisi eşleştirebilsin.
- **Uydurma bir "NM yanıtı" adı BASILMAZ.**

> Wireshark bunu YAPMIYOR — her NM/ND yanıtını sessizce "Application message"
> etiketliyor. Motor birinci sınıf kaynaktan **daha doğru** davranır; gerekçesi
> dosya başında yazılıdır.

---

## İKİ KAYNAK KARŞILAŞTIRMASI — dört sapma, ÜÇÜ ÇÖZÜLDÜ

Görev tanımının uyarısı (*"iki kaynak örtüşüyor bir TAHMİNDİR"*) **haklı çıktı**:
alan alan karşılaştırıldığında **dört yerde ayrışıyorlar**. Normatif spec
üçünde hakem oldu.

### SAPMA 1 — CN/IP bayt 2'nin bölünmesi · **ÇÖZÜLDÜ (Echelon kodu)**

- Wireshark `hf_cnip_ver` maskesi **`0`** → tüm baytı sürüm sayıyor
  (`packet-cnip.c:155-159`).
- Echelon, `LtIpPktHeader::parse` içinde **açıkça bölüyor** `[KANIT]`:
  ```c
  PTOHB(p, version );
  versionBits = version & 0xE0;  // top three bits
  version     = version & 0x1F;  // bottom 5 bits
  ```
  ve `build` bunu geri birleştiriyor: `versionByte = version | versionBits;`

**HAKEM: Echelon** (CN/IP'nin yazarı, ve okuma KODLA kanıtlı — Wireshark'ta
yalnız bir maske değeri var). Motor 5/3 bölünmesini uygular; **bit 7 set ise
`vendorPrivatePacketFollows` uyarısı** basar (struct yorumu: *"bit 7 => vendor
private packet follows"*), bit 6:5 sıfır değilse `reservedBitsNotZero`.

Gerçek yakalamada bayt daima `0x01` olduğu için iki okuma da aynı sonucu verir
→ ayrımın kendisi `[BEKLENTİ — uygulamada doğrulanacak]`.

### SAPMA 2 — Adres biçimi 2b'de +4 baytının adı · **ÇÖZÜLDÜ (normatif spec)**

| Bayt | Wireshark `:277-282` | go-lon `:112-118` | **Figure 3.2 (NORMATİF)** |
|---|---|---|---|
| +4 | `dstgrp` — destination **group** | `DstSubnet` | **`DstSubnet`** ✓ |
| +5 | `dstnode` | `DstNode` (`&0x7F`) | `1`+DstNode(7) ✓ |
| +6 | `grp` | `Group` | `Group(8)` ✓ |
| +7 | `grpmem` | `GrpMemb` | `GrpMemb(8)` ✓ |

**HAKEM: normatif spec — go-lon HAKLI, Wireshark YANLIŞ.**
`spec.txt:711`: `2b: SrcSubnet 0 SrcNode DstSubnet 1 DstNode Group GrpMemb`.
Wireshark okumasında çerçevede hem "destination group" hem "group" olurdu ki
tekrarlıdır. **Motor spec'i izler, alan `Destination subnet` adını taşır ve
uyarı GEREKMEZ.**

> **Bu, dalganın en değerli tek bulgusudur:** normatif kaynak olmasaydı bu alan
> "belirsiz" damgasıyla ve bir uyarıyla yayınlanacaktı. **Kaynak hiyerarşisi
> kağıt üzerinde değil, alan alan işe yarıyor.**

### SAPMA 3 — Adres biçimi 3 (UID): go-lon BOZUK · **ÇÖZÜLDÜ (spec + aritmetik)**

- Spec + Wireshark `:284-290`: **9 bayt** — src subnet(+2), src node(+3),
  dst subnet(+4), **UID 6 bayt (+5..+10)**; domain +11'den.
- go-lon `:120-123`: 6 baytlık dilimden `uint64` okumaya çalışıyor
  (`io.ErrUnexpectedEOF`, `NeuronID` 0 kalır) **ve `domain_offset`u 5'te
  bırakıyor** — domain UID'nin ortasından okunur. `Dst()` `:166` hiç atanmayan
  `DstNode`u basıyor.

**HAKEM: spec + aritmetik (`1+1+1+6 = 9`).** Wireshark alınır.
Yakalamada örnek YOK → `[BEKLENTİ]`.

### SAPMA 4 — IP-852 yükünde kuyruk CRC'si var mı · **ÇÖZÜLMEDİ**

- **Ölçüldü:** 12.028 datagramın **HİÇBİRİNDE** kuyruk CRC'si yok. Bu keşif
  turunda 4 polinom × 3 init × yansıma × xorout × iki bayt sırası tarandı;
  **hiçbir yapılandırma tutmadı**. Bağımsız ikinci sürüm (3000 çerçeve,
  12 hipotez, 36.000 deneme) **2 tutma** verdi — şans düzeyi.
- **Gövde uzunlukları da doğruluyor:** 8 baytlık gövdeler tam olarak
  `PPDU + NPDU + src(2) + dst(2) + domain(1) + TPDU(1)`; CRC'ye yer yok.
- **AMA** `lon-stack-ex` `LtLreIpClient.cpp` alınan IP-852 yüklerinde bir kuyruk
  CRC'si DOĞRULUYOR (`if (m_pServer)` guard'ı ardında) ve changelog'unda
  *"EPRS FIXED: 37164 - all IP-852 packets are marked as having bad CRC"* yazıyor.

**KARAR: kuyruk CRC'si VARSAYILMAZ, ama VARSA doğrulanabilir.**
`cnip-tunnel` modunda CRC **hiç hesaplanmaz** (ölçüm: hiç yok; otomatik sezme
yalnız 1/65536 yanlış pozitif eklerdi). `payloadKind` kanalının üçüncü şıkkı
(`raw-lontalk-pdu-with-crc`) seçildiğinde GENIBUS PASS/FAIL **gerçekten**
doğrulanır. **"gösterilir ≠ doğrulanır" korunur.**

---

## Checksum — `CRC16_GENIBUS` katalogda YOK, ve en keskin sahte dost burada

### LonTalk'ın CRC'si TAM OLARAK ÇÖZÜLDÜ

Normatif spec **yalnız polinomu** veriyor `[KANIT]` `spec.txt:1424-1425`:
> *"The CRC is computed over the entire NPDU including the L2Hdr field. The CRC
> is generated using the polynomial X16 + X12 + X5 + 1 (the CCITT CRC-16
> standard)."*

**Init, yansıma ve xorout spec'te YOK.** Onları veren tek kaynak MIT yığınıdır
`[KANIT]` `lon-stack-ex/LonTalkStack/Source/Shared/LtCUtil.c:195-209`:
```c
void LtCRC16(byte bufInOut[], int sizeIn) {
    unsigned int crc = USHRT_MAX;              /* init = 0xFFFF */
    for (i = 0; i < sizeIn; i++)
       crc = (crc << CHAR_BIT) ^ crctable[(byte)(crc >> (16 - CHAR_BIT)) ^ *p++];
    crc = ~crc & USHRT_MAX;                    /* xorout = 0xFFFF */
    bufInOut[sizeIn]     = (crc >> 8);         /* BÜYÜK ENDIAN: önce yüksek */
    bufInOut[sizeIn + 1] = (crc & 0x00FF);
}
```
ve tablo üretimi `[KANIT]` aynı dosya `:87`:
`if (r & 0x8000U) r = (r << 1) ^ 0x1021U;` — **MSB-first, YANSIMA YOK.**

→ **CRC-16/GENIBUS**: `poly 0x1021 · init 0xFFFF · refin false · refout false ·
xorout 0xFFFF`.

### DOĞRULAMA — deponun KENDİ motorundan geçirildi

Bu keşif turunda `src/protocol-core/checksums/crcEngine.ts`in `crc()` fonksiyonu
`"123456789"` ile koşturuldu (tek kullanımlık vitest script'i):

| Parametre kümesi | `check("123456789")` | Katalogda? |
|---|---|---|
| **GENIBUS** `1021 / FFFF / -- / FFFF` | **`0xD64E`** ✓ (yayımlanmış değer) | **YOK** |
| `CRC16_CCITT_FALSE` `1021 / FFFF / -- / 0000` | `0x29B1` | var `:143` |
| `CRC16_X25` `1021 / FFFF / rr / FFFF` | `0x906E` | var `:159` |
| `CRC16_XMODEM` `1021 / 0000 / -- / 0000` | `0x31C3` | var `:151` |
| `CRC16_KERMIT` `1021 / 0000 / rr / 0000` | `0x2189` | var `:207` |

> **DEPONUN TARİHİNDEKİ EN KESKİN SAHTE DOST.** `CRC16_CCITT_FALSE` GENIBUS'tan
> **YALNIZ `xorout`ta** ayrılıyor — aynı polinom, aynı init, aynı yansıma
> (yok). 16a'nın dersi *"aynı POLİNOM aynı algoritma değildir"* idi; bu vaka
> **"aynı polinom + aynı init + aynı yansıma bile aynı algoritma değildir"**e
> indiriyor. `CRC16_X25` de aday gibi görünür (o da tümleyen alıyor) ama
> **yansıtıyor** — LonTalk yansıtmıyor.
> **`CRC16_CCITT_FALSE` ALINMAZ. `CRC16_X25` ALINMAZ.**

### `[KARAR 17-6]` Katalog eklemesi: **`CRC16_GENIBUS` EKLENİR**

Gerekçe:
1. `check = 0xD64E` **yayımlanmış** bir değerdir ve deponun kendi motorundan
   geçirilerek doğrulandı — katalogun kabul ölçütü budur (`crcCatalogue.ts`
   dosya başı: *"`check` fixture'ları tutmazsa parametreler yanlıştır"*).
2. Gerçek bir tüketicisi var: `payloadKind: 'raw-lontalk-pdu-with-crc'`.
3. Kalıcı bir sahte-dost boşluğunu kapatır.

**Sayılar:**
- `CRC_ALGORITHM_IDS` **29 → 30** (`crcCatalogue.ts:20-50`).
- `crcEngine.test.ts`e `0xD64E` fixture'ı eklenir.
- **`CrcCalculatorTool.test.tsx` `:81` sayısı 37 → 38** (bugün 37 = 29 katalog
  CRC'si + 7 basit toplam + 1 özel; dosyanın kendi yorumu bu kırılımı yazıyor).
  **Sayıyı brif'ten değil DOSYADAN doğrula** (dalga 15 çürüyen tahmin 1).

> **`payloadKind`ın üçüncü şıkkı yazılmazsa CRC de EKLENMEZ ve 37 kalır.**
> Tüketicisi olmayan katalog girdisi yazma.

---

## `canParse` — ÖLÇÜM, sonra karar

**Registry bugün: 143 kayıt, 886 örnek çerçeve** (2026-08-26, KODDAN ölçüldü —
`registeredProtocolIds()` + `loadProtocolPlugin`, tek kullanımlık vitest script'i).

| # | Denenen imza | Çakışma | Değerlendirme |
|---|---|---|---|
| **R1** | `n ≥ 20 && ((b[0]<<8)\|b[1]) === n` | **0 / 886** | TEMİZ |
| **R2** | R1 `&& (b[2] & 0x1F) === 1` | **0 / 886** | TEMİZ |
| **R3** | R1 `&& b[3] ∈ {14 paket tipi}` | **0 / 886** | TEMİZ |
| **R4** | R1 `&& (b[2]&0x1F)===1 && tip ∈ küme && 20+4·b[4] ≤ n` | **0 / 886** | **SEÇİLEN** |
| R5 | uzunluk alanı OLMADAN | 1 / 886 (`dmx512/oversizedSlotCount`, 522B) | uzunluk alanı ŞART |
| **L1** | ham LonTalk naif: `n ≥ 8 && (b[1]&0xC0)===0` | **401 / 886 (%45)** | KABUL EDİLEMEZ |
| **L2** | ham LonTalk dar: L1 + adres/domain uzunluğu tutarlı | **375 / 886 (%42)** | KABUL EDİLEMEZ |

**Bağlam:** 886 örneğin **301'i** ≥ 20 bayt, **651'i** ≥ 8 bayt. Uzunluk alanının
ofset taraması da yapıldı (0..10): gerçek ofset **0**'dır ve **0** çakışma verir
(ofset 1'de 1 — `mqtt-sn/extendedLength`; ofset 10'da 6 — `foundation-fieldbus`).

### → **KARAR: `canParse` `true` DÖNER.** İmza = R4.

Ölçüm **iki bağımsız kümede** temiz:
- deponun 886 örneği → **0 yanlış pozitif**,
- gerçek yakalamanın 12.028 datagramı → **12.028 doğru pozitif** (`len` alanı
  hiç sapmadı).

Emsal `iec-61162` (16c). **Ham LonTalk PDU'su için `canParse` ASLA `true`
olamaz** ve bu sayı (401/886) kapsam kararının ikinci ayağıdır.

### Bekçi — `lonworksCanParseRegistry.test.ts`, ÜÇ YÖNLÜ

1. **İleri:** tüm registry örneklerinde `lonworks.parser.canParse` → **0**
   (kayıt ve örnek sayısı `registeredProtocolIds()`ten TÜRETİLİR, sabit değil).
2. **Ters:** ham LonTalk imzası (L1) aynı kümede **`> 300`** çakışma — "yazılsaydı
   kaç çerçeve çalardı" kanıtı; `seatalk`in `> 0` bekçisinin sertleştirilmiş hâli.
3. **Kendi üzerinde:** `lonworks`ın TÜM örnek çerçevelerinde `canParse` `true`
   (türetilmiş bozuk örnekler dahil — `canParse` *"biçim bu mu"* sorusudur,
   *"geçerli mi"* değil).

---

## `[KARAR 17-3]` SNVT — TİP TELDE YOK, ama ÖLÇEK TABLOSU AÇIK

**İki ayrı olgu, karıştırma:**

### (a) SNVT TİPİ ÇERÇEVEDE YOKTUR — kesin

NV mesajı yalnız **14 bitlik bir selector** taşır. Selector, cihazın **bağlama
tablosundaki** bir indekstir; hangi SNVT'ye karşılık geldiği cihazın
XIF'inde/ağ yönetim aracındadır. Gerçek yakalamada 88 farklı selector var ve
hiçbirinin tipi çerçevede yok.

**Somut kanıt — aynı iki bayt, beş farklı mühendislik değeri.** Örnek
çerçeve 1)'in NV yükü `00 CA` (ham 202):

| Varsayılan tip | idx | A,B,C | Sonuç |
|---|---|---|---|
| `SNVT_temp` | 39 | 1, −1, −2740 | **−253.8 °C** |
| `SNVT_temp_p` | 105 | 1, −2, 0 | **2.02 °C** |
| `SNVT_lev_percent` | 81 | 5, −3, 0 | **1.01 %** |
| `SNVT_amp` | 1 | 1, −1, 0 | **20.2 A** |
| `SNVT_count` | 8 | 1, 0, 0 | **202** |

**Tipi tahmin etmek −253.8 °C ile 2.02 °C arasında seçim yapmaktır.**
Bu, deponun kendi spec'inin KNX ilkesinin birebir aynısı
`[KANIT]` `docs/spec/ozet/07-bina-otomasyonu.md:446`:
> *"KNX DPT bilinmiyorsa toolkit ham `uint16` değeri gösterip semantik anlam
> uydurmamalı ('Cannot determine engineering meaning without DPT')."*

**Karar:** NV mesajında **selector, yön biti ve HAM yük** basılır; **HER NV
çözümünde koşulsuz `nvTypeNotOnWire` uyarısı** basılır (`seatalk`in
`commandBitNotInBytes`i ile aynı sınıf: kapatılamayan uyarı).

### (b) ÖLÇEK TABLOSU AÇIK — kapı GEÇİLDİ

Görev tanımının koyduğu kapı ("iki bağımsız kaynakta teyitli 4+ tip") **geçildi**:

| Kaynak | Doğrulama |
|---|---|
| `https://www.lonmark.org/nvs/` | **221 tip**, indeks + boy + Neuron C tipi + min/max/invalid + ölçek (A,B,C). Bu keşif turunda tamamı çıkarıldı ve JSON'a döküldü. |
| `https://www.lonmark.org/wp-content/uploads/2020/01/snvt.pdf` | 413 sayfa, 219 kayıt — **bağımsız**, nokta kontrollerinde bayt-birebir aynı |
| `lon-stack-dx/include/izot/iap_types.h` (MIT) | Kod yorumları aynı değerleri **üçüncü kez** veriyor |

`[KANIT]` `iap_types.h`, birebir:
```c
// Structure: SNVT_switch (Index 95)
typedef struct {
    IzotByte value;   // Level in percent; 0 -- 200; <scaled value> = (<raw value> * 5) * (10^-1)
    toggle_state_t state;
} SNVT_switch;
// Structure: SNVT_temp_p (Index 105)
// Temperature (degrees Celsius; 2-byte signed long; scaled value = 1 * 10^-2 * (Raw + 0)).
```

> ### 🚨 ÖLÇEK FORMÜLÜ — `(Raw + C)`, `Raw + C` DEĞİL
> LonMark'ın kendi ifadesi: **`Scaled value: A * 10^B * (Raw + C)`**.
> Yani **`değer = A × 10^B × (ham + C)`**.
> `(A × 10^B) × ham + C` yazmak `SNVT_temp`te (A=1, B=−1, C=−2740) sonucu
> **~2466 °C** kaydırır. **Bu tuzağa düşmek hata VERMEDEN yanlış sıcaklık
> basar** — `arinc-429`in bit sırası tuzağıyla (15f) aynı sınıf.

**Doğrulanmış örnek tablo** (uygulama turu bunu yeniden çıkarır ve genişletir):

| SNVT | idx | boy | Neuron C tipi | A, B, C |
|---|---|---|---|---|
| `SNVT_amp` | 1 | 2 | signed long | 1, −1, 0 |
| `SNVT_count` | 8 | 2 | unsigned long | 1, 0, 0 |
| `SNVT_flow` | 15 | 2 | unsigned long | 1, 0, 0 |
| `SNVT_temp` | 39 | 2 | unsigned long | 1, −1, **−2740** |
| `SNVT_volt` | 44 | 2 | signed long | 1, −1, 0 |
| `SNVT_lux` | 79 | 2 | unsigned long | 1, 0, 0 |
| `SNVT_lev_percent` | 81 | 2 | signed long | 5, −3, 0 |
| `SNVT_state` | 83 | 2 | Structure | — |
| `SNVT_time_stamp` | 84 | **7** | Structure | — |
| `SNVT_switch` | 95 | 2 | Structure | value: 5, −1, 0 · state: signed |
| `SNVT_rpm` | 102 | 2 | unsigned long | 1, 0, 0 |
| `SNVT_angle_deg` | 104 | 2 | signed long | 2, −2, 0 |
| `SNVT_temp_p` | 105 | 2 | signed long | 1, −2, 0 |
| `SNVT_hvac_mode` | 108 | 1 | enum | — |

**Kapsam sınırı:** listeye **yalnız skaler tipler** (`signed long` /
`unsigned long` / `signed short` / `unsigned short`, ölçek üçlüsü DOLU olanlar)
girer. **`Structure` ve `enum` tipleri ALINMAZ** — bunların alan kırılımı ayrı
bir iş ve ölçek üçlüsü `null`. **`obsolete: yes` işaretli tipler ALINMAZ.**
Bu, `seatalk`in *"yalnız ikinci bağımsız kaynakta teyitli komutlar çözülür"*
disiplininin aynısı.

**Endianness: BÜYÜK ENDIAN**, iki kaynak:
- `lon-stack-dx/include/izot/lon_types.h`:
  `IZOT_GET_UNSIGNED_WORD(n) = ((n).msb << 8) + (n).lsb`
- normatif spec `spec.txt:3733-3734`: *"Any long or quad quantities stored in the
  APDU are stored with the most significant bit on the left."*

> **TUZAK 9 — spec Appendix A §13.1 "least significant first" diyor ve bu
> BAYT SIRASI DEĞİL.** O ifade **fiziksel katman** bit/bayt iletim sırasının
> çizim kuralıdır; §10.4, tüm çalışan kod ve gerçek yakalama **big-endian**
> diyor. Little-endian yazmak hata VERMEDEN ters sayı basar.

---

## `[KARAR 17-4]` XIF — biçim BELGELİ, ama BU DALGADA YAZILMAZ

Görev tanımının varsayımı ("XIF biçimi belgesiz olabilir") **ÇÜRÜDÜ**:

| Kaynak | Doğrulama |
|---|---|
| `https://www.lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf` | HTTP **200**, **429.052 bayt** — *LONMARK Device Interface File Reference Guide* rev 4.501, girişsiz, satır satır alan tabloları |
| `izot/shortstack/microserver/standard/*.xif` + `izot/smartserver-iot/apps/astroClock/Device Interface/astroClock.xif` | ~20 gerçek örnek |
| `g3gg0/LonScan/LonScan/XifFile.cs` | Açık C# parser (~250 satır), çalışıyor ama kırılgan (sabit satır atlamaları) |

Dilbilgisi: `VAR name index avgRate maxRate arraySize`, ardından
`snvtIndex * elementCount`, ardından `type offset size signedFlag arraySize`.
Örnekte `95 * 1` → `SNVT_switch`, `84 * 1` → `SNVT_time_stamp` — master
listeyle birebir tutuyor.

**KARAR: XIF parser'ı bu dalgada YAZILMAZ.** Gerekçe:
1. `DEFINITION_PANELS`e `xif` eklemek **yeni bir panel + yeni bir parser
   modülü + yeni bir UI akışı** demektir (`DbcPanel`/`EdsPanel` ölçeğinde iş).
2. **Domain'i kapatan dalgada ikinci bir motor riski artırır** —
   `[Karar 15h-1]`in (tek-bit CRC düzeltme motoru) ve 16c'nin (`R?UdP` ikinci
   teli) birebir aynı gerekçesi.
3. Python/JS XIF parser'ı **YOK** — sıfırdan yazılacak.

**Sayfa metni "ileride" der.** Bu karar `partial` rozetinin gerekçelerinden
biridir ve `plan-fazlar.md`ye **bilinen borç** olarak yazılır — kaynakları
burada listelendiği için bir sonraki nesil aramak zorunda kalmaz.

---

## Gerçek yakalamadan ölçülenler (12.028 datagram)

| Ölçüm | Sonuç |
|---|---|
| UDP port çifti | `39819 → 1628` (12028/12028) |
| Payload uzunluğu | min **25**, max **43**, ortalama 30.3 |
| **`len` alanı == payload uzunluğu** | **12028 / 12028 — SIFIR sapma** |
| CN/IP version baytı | `0x01` (hepsi) |
| CN/IP packet type | `0x01` Data Packet (hepsi) |
| CN/IP `exth` | **0** (hepsi) |
| CN/IP protocol code | **0** (hepsi) |
| CN/IP security bit | 0 (hepsi) |
| CN/IP vendor code | `0x0000` (hepsi) |
| CN/IP session id | `0x6B8B4567` (tek değer) |
| CN/IP sequence | 0 → 12027, **monoton artan** |
| CN/IP timestamp | **0** (hepsi) |
| LonTalk version | **0** (hepsi) |
| PDU format | TPDU **11325** · APDU **663** · SPDU **40** · AuthPDU **0** |
| Address format | 2a **12027** · Broadcast **1** · Multicast **0** · 2b **0** · UID **0** |
| Domain length | 1 bayt **12027** · 0 bayt **1** · 3 bayt **0** · 6 bayt **0** |
| TPDU tipleri | ACKD **5651** ↔ ACK **5673** |
| SPDU tipleri | REQUEST **20** ↔ RESPONSE **20** |
| APDU sınıfları | NV **5661** · NM **15** ↔ yanıt **15** · diğer |
| NM kodları | yalnız `NM_NV_FETCH` (`0x73`) |
| Farklı NV selector | **88** · en sık: 157(455×), 26(404×), 269(376×), 684(370×) |
| NV yön biti (`d`) | 0 (*incoming*) **6319** · 1 (*outgoing*) **5** |
| Kuyruk CRC'si | **YOK** (36.000 hipotez denemesi, şans düzeyi tutma) |

> **Dengeli eşleşmeler (ACKD↔ACK, REQUEST↔RESPONSE, NM istek↔yanıt) modelin
> DOĞRU olduğunun en güçlü kanıtıdır** — tek bir ofset yanlış olsa bu simetri
> bozulurdu.

### DOĞRULANAN yollar
CN/IP 20 baytlık başlık · `len` kendini doğrulaması · PPDU/NPDU bit düzeni ·
adres biçimi 0 ve 2a · domain 0 ve 1 bayt · TPDU ACKD/ACK · SPDU REQUEST/RESPONSE ·
APDU NV/NM/Application · transaction eşleşmesi · NM yanıt kodu aritmetiği.

### DOĞRULANMAYAN yollar — hepsi `[BEKLENTİ — uygulamada doğrulanacak]`
`exth > 0` · CN/IP bayt 2'nin 5/3 bölünmesi · `pcode != 0` · security bit ·
Data Packet dışındaki 13 tip · adres biçimi 1 / 2b / 3 · domain 3 ve 6 bayt ·
TPDU/SPDU REMINDER + REM/MSG (`M_Len`/`M_List`) · AuthPDU'nun tamamı ·
Network Diagnostic · Foreign Frame kod anlamı ·
`NM_MANUAL_SERVICE_REQUEST`in 6+8 baytlık kuyruğu · kuyruk CRC'li ham PDU.

**Bu liste dosya başına AYNEN yazılır.** Doğrulanmamış bir yolu "doğrulanmış
gibi" göstermek dalga 13 dersi 3'ün (*gösterilir ≠ doğrulanır*) ihlalidir.

---

## Örnek çerçeveler — GERÇEK yakalamadan (hex, birebir)

Yedi çerçeve `.pcap`ten çıkarıldı ve **elle çözüldü**.

```
1) TPDU ACKD + NV güncellemesi (32 B)
00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 00 00 00 00 00
01 09 01 AA 01 A9 01 03 81 0D 00 CA
   len=0x0020=32 ✓ ver=1 type=01 exth=0 flags=0 vendor=0 sess=6B8B4567 seq=0 stamp=0
   PPDU=01 (prio0 alt0 dBL=1) · NPDU=09 → ver0 fmt0(TPDU) addr2 dom1
   src 1/42 (0xAA→MSB=1 ⇒ 2a, node=0x2A) → dst 1/41 (0xA9&0x7F=0x29)
   domain=01 · TPDU=03 → ACKD, trans=3
   APDU=81 0D → NV, d=0(incoming), selector=0x010D=269 · yük = 00 CA

2) TPDU ACK — eşleşen onay (28 B)   ← 1) ile AYNI transaction, ters yön
00 1C 01 01 00 00 00 00 6B 8B 45 67 00 00 00 01 00 00 00 00
00 09 01 A9 01 AA 01 23
   seq=1 · src 1/41 → dst 1/42 · TPDU=23 → ACK, trans=3 ✓ · APDU YOK

3) SPDU REQUEST + NM_NV_FETCH (30 B)
00 1E 01 01 00 00 00 00 6B 8B 45 67 00 00 0E BD 00 00 00 00
01 19 01 C9 01 98 01 0B 73 07
   NPDU=19 → fmt1(SPDU) addr2 dom1 · src 1/73 → dst 1/24
   SPDU=0B → REQUEST, trans=0x0B · APDU=73 → NM_NV_FETCH · 07 = NV indeksi

4) SPDU RESPONSE — TUZAK 4'ün kanıtı (42 B)   ← 3) ile AYNI transaction
00 2A 01 01 00 00 00 00 6B 8B 45 67 00 00 0E BF 00 00 00 00
00 19 01 98 01 C9 01 2B 33 07 00 00 00 00 00 00 00 00 00 00 00 00
   src 1/24 → dst 1/73 · SPDU=2B → RESPONSE, trans=0x0B ✓
   APDU=33 → 0x33&0xC0==0 ⇒ "Application code 51"
   Aritmetik: 0x73&0x1F=0x13, p=1 ⇒ 001_10011 = 0x33 (NM başarı yanıtı)
   AMA 0x33 aynı zamanda ND_CLEAR_STATUS (0x53) yanıtı olarak da geçerli.
   → `responseCodeAmbiguous` uyarısı BURADA basılır.

5) APDU doğrudan (taşıma katmanı YOK) + NV (32 B)
00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 17 00 00 00 00
00 39 01 C9 01 9D 01 BF FF 00 00 02
   NPDU=39 → fmt3(APDU) addr2 dom1 · *PDU okteti YOK, doğrudan APDU

6) APDU + Foreign Frame — yakalamanın EN UZUNU (43 B)
00 2B 01 01 00 00 00 00 6B 8B 45 67 00 00 01 38 00 00 00 00
00 39 01 BD 01 8C 01 83 4D 0C 00 00 07 D0 0A 28 FF 08 0B 00 64 01 80
   APDU=4D → (0x4D&0xF0)==0x40 ⇒ Foreign Frame, kod=0x0D

7) Broadcast + domain-wide + PDU OKTETİ YOK (25 B)   ← truncated-frame vakası
00 19 01 01 00 00 00 00 6B 8B 45 67 00 00 04 F3 00 00 00 00
80 00 00 01 00
   PPDU=80 → prio=1 · NPDU=00 → ver0 fmt0(TPDU) addr0(broadcast) dom0
   adres 3 bayt (src 0/1, dst subnet 0) + domain 0 bayt ⇒ ofset 5 = PDU SONU
   *PDU okteti YOK. Yakalamanın 12.028 çerçevesinden TEK BÖYLE ÇERÇEVE.
```

### Türetilecek bozuk örnekler (4)

| # | Nasıl | Beklenen |
|---|---|---|
| 8 | 1)'in `len` alanı `00 21` yapılır | `length-mismatch` |
| 9 | 1)'in `type` alanı `0x63` yapılır | Data Packet DEĞİL → ad basılır, LonTalk çözümü YAPILMAZ |
| 10 | 1)'in `flags` alanı `0x01` yapılır (pcode=1) | **KAPSAM DIŞI**: `unsupported-encoding` + açık metin (16c'nin `R?UdP` kararının birebir biçimi — sessizce "geçersiz" DENMEZ) |
| 11 | 1)'in `exth` `0x01` yapılır ve 4 bayt eklenir | doğru atlama + `[BEKLENTİ]` uyarısı |

**7) numaralı GERÇEK çerçeve `truncated-frame` hatasını türetilmiş veriyle
değil, GERÇEK YAKALAMAYLA kanıtlar** — mutlaka `exampleFrames`e girer.

---

## `decodeOptions` — SEKİZ kanal

Dalga 15/16'nın dersi: **brifler `decodeOptions` yüzeyini SİSTEMATİK olarak AZ
tahmin ediyor** (16c 5 tahmin / **7** gerçek). Bu liste bilerek CÖMERT.

| # | `id` | `kind` | Neden ÇERÇEVEDEN çıkarılamaz | Emsal |
|---|---|---|---|---|
| 1 | `payloadKind` | select: `cnip-tunnel` (varsayılan) / `raw-lontalk-pdu` / `raw-lontalk-pdu-with-crc` | Kullanıcının elinde CN/IP başlığı SOYULMUŞ bir PDU olabilir. Alan YERLEŞİMİNİ tümden değiştirir; üçüncü şık GENIBUS kuyruk CRC'sini doğrular. | `io-link`in `messageSide`i (13h) |
| 2 | `nvPayloadType` | select: `raw` (varsayılan) + **doğrulanmış skaler SNVT listesi** | NV selector bir bağlama indeksidir, TİP DEĞİLDİR — `[KARAR 17-3]`. | `mil-std-1553`ün `wordType`ı (15g) |
| 3 | `timestampEpoch` | select: `raw-milliseconds` (varsayılan) / `epoch-1900` / `epoch-1970` | **BİRİM biliniyor** (`LtIpPackets.h:272` *"milliseconds in wall clock time"*) ama **EPOCH bilinmiyor**: aynı dosya `getTd1970()` *"time delta from 1900 to 1970"* yardımcısını taşıyor, yani iki taban da dolaşımda. Yakalamada 12028/12028 sıfır → çıkarım da yapılamıyor. Varsayılanda **ham ms basılır, tarihe ÇEVRİLMEZ.** | `iec-61162`nin `timestampScale`i (16c) |
| 4 | `strictLength` | select: `strict` (varsayılan) / `lenient` | `len` ile gerçek uzunluk ayrışırsa: hata mı, dolgu mu? | `iec-61162`nin `strictTerminator`ı (16c) |
| 5 | `neuronIdByteOrder` | select: `as-transmitted` (varsayılan) / `reversed` | Adres biçimi 3'ün 6 baytlık UID'i; yakalamada örnek YOK. | SAPMA 3 |
| 6 | `unknownPacketTypeHandling` | select: `name-and-raw` (varsayılan) / `reject` | 13 CN/IP tipinin gövdesi belgesiz. | `bacnetip.ts`in dokuz fonksiyonu |
| 7 | `versionByteSplit` | select: `echelon-5bit` (varsayılan) / `whole-byte` | SAPMA 1 — iki kaynak ayrışıyor ve yakalama ayırt etmiyor. | 16a'nın `controlFieldBytes`ı |
| 8 | `foreignFrameCodeLabels` | select: `numeric` (varsayılan) / `hide` | Foreign Frame kodunun ANLAM tablosu hiçbir kaynakta yok. | `seatalk`in çözülmeyen 37 komutu (16b) |

**KANAL YAPILMAYACAKLAR** (kullanıcıya olmayan bir karar sordurmak olurdu —
16c'nin `sentenceStartChars` gerekçesi):
- Adres biçimi 2b'nin +4 alanının adı → **normatif spec çözdü**, seçenek gereksiz.
- NM/ND yanıt kodu ayrımı → **çerçevede yok**, uyarı basılır (`[KARAR 17-5]`).
- Protokol kodu filtresi → kapsam kararı.

`[BEKLENTİ]` Sekiz kanal **AZ çıkabilir**; dalga 15/16 bunu üç kez yaşadı.

---

## `[KARAR 17-2]` Beklenen rozet: **`partial`**

Katalogda `status: 'partial'`, ve **`summary` metni neyin çözülüp neyin
çözülmediğini AÇIKÇA söyler** (dar-kapsam kayıt politikasının şartı; sayfa
başlığının altında görünen metin budur — `ProtocolPage.tsx:274`).

Altı gerekçe, ağırlık sırasıyla:

1. **Kapsam: yalnız 14908-4 (CN/IP) teli.** 14908-2/-3'ün ham L2 çerçevelemesi
   kapsam dışı — `[KARAR 17-1]`.
2. **SNVT TİPİ telde yok**; semantik çözüm kullanıcının bildirmesine bağlı —
   `[KARAR 17-3]`.
3. **XIF paneli yazılmadı** — `[KARAR 17-4]`; `definitions` sekmesi "planlandı" basar.
4. **Gateway Mapping yok** — analyzer işi.
5. **Doğrulanmamış yolların listesi uzun** — adres biçimleri 1/2b/3 ve AuthPDU'nun
   tamamı yalnız kaynak metninden geliyor.
6. **Kuyruk CRC'si sorusu açık** (SAPMA 4) — ölçüm "yok" diyor, bir uygulama
   "olabilir" diyor.

**`partial` sınıfı:** bu kayıt `iec-61850`/`ads-b`/`iec-61162` sınıfına girer
(**bilinçli kapsam kararı**), `seatalk` sınıfına DEĞİL. Kaynak burada
**normatif ve ücretsiz**, üstelik gerçek yakalamayla doğrulanmış.

> **`ready` NEDEN DEĞİL:** `hdlc-based-marine` (16a) `ready` oldu çünkü ZARFI
> tam çözüyordu ve payload'ın tanımsızlığı protokolün kendisiydi. Burada
> katalogdaki altı `tools` vaadinin üçü (SNVT, XIF Import, Gateway Mapping)
> tam karşılanmıyor ve zarfın adres biçimlerinin yarısı yakalamayla
> doğrulanmadı.

---

## Fixture zinciri — ÖLÇÜLDÜ, kayması BEKLENEN davranıştır

**BUGÜN (KODDAN doğrulandı, `allEntries()` üzerinde koşturuldu):**

| Bekçi | Bugünkü hedefi |
|---|---|
| `src/pages/ProtocolPage.test.tsx:33-40` | **`building-automation/lonworks/lonworks`** |
| `e2e/nmea-decode.spec.ts:34-46` | **`building-automation/lonworks/lonworks`** |

İkisi de "motorsuz + alias değil + `pluginId`siz + `decode` sekmeli ilk
`planned` kayıt" ölçütüyle katalogdan TÜRETİLİYOR (dalga 16a Görev 0).
`e2e/nmea-decode.spec.ts` önce `marine-navigation`da arıyor; orada aday
kalmadığı için katalog geneline düşüyor.

**`lonworks` motor alınca ikisi de şuraya KAYAR (ölçüldü):**
→ **`wireless-iot/mesh-smart-home/thread`**

Bugünkü aday sırası (KODDAN):
```
1. building-automation/lonworks/lonworks     ← bu dalgada motor alacak
2. wireless-iot/mesh-smart-home/thread       ← ikisi de buraya kayar
3. wireless-iot/wifi-wireless/wifi
4. wireless-iot/wifi-wireless/esp-now
5. wireless-iot/custom-rf/rf-telemetry-custom-frame
```

> **KAYMASI BEKLENEN DAVRANIŞTIR. KIRILIRSA RAPOR ET, DÜZELTME.**
> Bekçinin işi *"motoru olmayan bir sayfa hâlâ 'planlandı' basıyor mu"*dur;
> hangi sayfa olduğu önemsizdir. Bekçiyi ELLE bir yola sabitleme — o mayın
> dalga 16a'da yapısal olarak söküldü ve dördüncü kez taşınmayacak.
> **Depoda kalan sabit-yol mayını: SIFIR** (dalga 16'nın tam taraması).
> Bu dalga yeni bir tane EKLEMEZ.

---

## TUZAKLAR — özet liste

1. **Versiyon PPDU'da değil NPDU'da.** Yanlış bayt ölçümü de zehirler.
2. **Wireshark'ın AuthPDU maskeleri BOZUK** ve `TODO`sunun önerisi de yanlış;
   doğrusu `0xC0`/`0x30` (`lcs_tsa.c:89`).
3. **`dissect_apdu`nun "Shouldn't get here" dalı ULAŞILAMAZ** — taklit etme.
4. **NM/ND yanıt kod uzayı ÜÇ KATLI ÇAKIŞIR** (`[KARAR 17-5]`) ve bu normatiftir.
5. **CN/IP `Time Stamp`inin BİRİMİ biliniyor (ms) ama EPOCH'u bilinmiyor.**
   `unit: 'ms'` atanabilir (kaynaklı), **ama tarihe ÇEVRİLMEZ** — `getTd1970()`
   yardımcısının varlığı iki tabanın da dolaşımda olduğunu gösteriyor.
   Çevrilmiş bir tarih basmak, ölçülmemiş bir epoch'u varmış gibi göstermektir.
6. **Öncelik bilgisi UDP PORTUNDADIR, çerçevede DEĞİL.** `packet-cnip.c:87`
   önceliği `destport == 1629` diye yazıyor; **port bu motorun girdisinde YOK.**
   CN/IP düzeyinde öncelik alanı **BASILMAZ**. (LonTalk PPDU'sunun kendi `0x80`
   priority biti ayrıdır ve o basılır.) `mode-s`in AP kararıyla (15h) aynı sınıf.
7. **`exth` BAYT değil 32-BİT SÖZCÜK sayar** — `4 × exth`.
8. **`len` KENDİNİ DE SAYAR** (BVLC gibi, MBAP'ın TERSİNE). `bacnetip.ts`in
   aynı tuzak notu **aynı domain'de** duruyor — ikisini karıştırma.
9. **"Least significant first" BAYT SIRASI DEĞİLDİR** — fiziksel katman çizim
   kuralı. Çok baytlı alanlar **big-endian**.
10. **Domain uzunluğu `0/1/2/3 → 0/1/3/6` bayttır** — `2` üç bayttır.
11. **SNVT ölçeği `A×10^B×(ham+C)`** — `(A×10^B)×ham + C` DEĞİL.
12. **`building/bacnet/npdu.ts` LonTalk'ın NPDU'su DEĞİLDİR.** Aynı ad, başka
    protokol. **IMPORT EDİLMEZ**; `hdlcCore` benzeri bir paylaşım burada
    YOKTUR ve aranmaz (`seatalk`in kararının aynısı, 16a).
13. **`ParsedField.id` çakışması** — çok alanlı düz tabloda gerçek risk
    (`ftp.ts`/`rtcp.ts`/15h/16c vakaları). Id'ye **sıra numarası** girer ve
    üstüne `Set` tabanlı benzersizlik garantisi konur.
14. **`ProtocolErrorCode` KİLİTLİ BİRLİK TİPTİR** (`types.ts:76-96`).
    `invalid-header` / `unsupported-version` **YOKTUR**. Karşılıklar:
    `len` uyuşmazlığı → `length-mismatch`; kapsam dışı pcode / Data Packet
    olmayan tip → `unsupported-encoding`; PDU okteti kalmadan biten çerçeve →
    `truncated-frame`; GENIBUS FAIL → `crc-mismatch`.
    **Yeni kod EKLENMEZ** (16c çürüyen tahmin 16).

---

## Uygulama görevleri (sırayla)

1. **Kaynak turu (yeniden).** Spec PDF indirilir ve `pdftotext -layout` ile
   çıkarılır; **yukarıdaki tabloların HER SATIRI yeniden doğrulanır.**
   `packet-cnip.c` + `packet-lon.c` indirilir. `izot/lon-stack-dx` ve
   `lon-stack-ex` klonlanır. **Brife güvenme, kaynağa bak.**
2. **`.pcap` indirilir**, UDP payload'ları çıkarılır, yedi örnek çerçeve
   yeniden bulunur ve `len` alanının 12028/12028 tuttuğu **yeniden ölçülür**.
3. **SNVT tablosu çıkarılır** — `lonmark.org/nvs/` + `snvt.pdf` ÇAPRAZ TEYİTLE.
   Yalnız **skaler + ölçek üçlüsü dolu + `obsolete: no`** tipler alınır.
   `nvPayloadType`ın şık listesi budur.
4. **`CRC16_GENIBUS` eklenir** — `crcCatalogue.ts` (29→30), `crcEngine.test.ts`e
   `0xD64E` fixture'ı, `CrcCalculatorTool.test.tsx:81` (37→38).
   **`payloadKind`ın CRC'li şıkkı yazılmazsa BU ADIM ATLANIR.**
5. **`src/protocols/building/lonworks/cnip.ts`** — CN/IP başlığı çekirdeği.
   **AYRI MODÜL**, gerekçesi dosya başında: kaynaklar da iki ayrı dissector
   kullanıyor; CN/IP başka yükler taşıyabilir (`pcode != 0`); domain içi emsal
   `building/bacnet/npdu.ts` + `bacnetip.ts` ayrımıdır.
   **out-parameter accumulator** deseni (`npdu.ts`in `decodeNpdu`si gibi).
6. **`src/protocols/building/lonworks/lonTalk.ts`** — PPDU/NPDU/adres/domain/
   *PDU/APDU zinciri. **`cnip.ts`i BİLMEZ** (16c'nin `lweTagBlock.ts` ↔
   `iec61162.ts` ayrımı: iki modül birbirini çağırmaz).
7. **`src/protocols/building/lonworks/snvtTypes.ts`** — doğrulanmış SNVT
   tablosu, saf veri. **Kaynak URL'leri ve çıkarma tarihi dosya başında.**
8. **`src/protocols/building/lonworks/lonworks.ts`** — plugin. `parser`
   (`canParse` = R4), `exampleFrames` (7 gerçek + 4 türetilmiş),
   `decodeOptions` (8 kanal), `documentation`. **`encoder` YOK.**
   Dosya başı: kapsam çizgisi, dört sapma, doğrulanmayan yolların listesi,
   CRC'nin neden tünelde olmadığı, SNVT'nin neden telde olmadığı.
9. **Çeviri** — `tr.ts` kaynak, `en.ts` zorunlu.
10. **Katalog** — `building-automation.ts:306-324`: `status` → `'partial'`,
    `pluginId: 'lonworks'`, **`summary` kapsamı AÇIKÇA yazacak biçimde** güncellenir.
11. **`src/protocols/index.ts`** + `index.test.ts` — lazy kayıt.
12. **Birim testler** — `cnip.test.ts`, `lonTalk.test.ts`, `snvtTypes.test.ts`,
    `lonworks.test.ts`.
13. **Bekçi** — `lonworksCanParseRegistry.test.ts`, ÜÇ yönlü.
14. **e2e** — `e2e/lonworks-decode.spec.ts`. Ekranda kanıtlanacaklar:
    (a) 1) ve 2) çerçevelerinin **aynı transaction numarasını** taşıdığı;
    (b) 4)'te `responseCodeAmbiguous` uyarısının göründüğü;
    (c) 7)'nin `truncated-frame` bastığı;
    (d) 10)'un **kapsam dışı** metnini bastığı;
    (e) her NV çözümünde `nvTypeNotOnWire` göründüğü;
    (f) `nvPayloadType` `SNVT_temp_p` seçilince `00 CA`nın **2.02 °C** okunduğu
        ve `SNVT_temp` seçilince **−253.8 °C** okunduğu (ölçek formülünün
        ekrandaki kanıtı);
    (g) `definitions` sekmesinin "planlandı" bastığı.
15. **Fixture zinciri doğrulanır**: iki bekçi de `thread`e kaydı, ikisi de yeşil.
16. **Dört kapı**: `npm test` · `npx playwright test` · `npm run typecheck` ·
    `npm run build`.
17. **Domain kapanışı** (aşağıda).

### Çeviri anahtarı tahmini: **~110** `[BEKLENTİ]`

Ölçek kuralı (16c'nin kalıcı düzeltmesi): **~4 anahtar / kanal + 2 / örnek**,
üstüne hata ve uyarı metinleri.

| Kalem | Hesap |
|---|---|
| 8 kanal × 4 | 32 |
| `nvPayloadType`ın uzun şık listesi (ek) | ~15 |
| 11 örnek × 2 | 22 |
| Hata metinleri | ~10 |
| Uyarı metinleri | ~20 |
| Alan/grup adları | ~10 |
| **Toplam** | **~105-115** |

**Bu tahmin bilerek YÜKSEK.** Son üç alt dalgada tahmin üst üste az çıktı
(16a 20-25→44, 16c 35-45→73). 110'un altına düşerse bu da bir çürüyen tahmindir
ve yazılır.

---

## Devralınan tuzaklar (her dalgada tekrarlanır)

- **Ham renk yazma.** Yalnız token utility'leri.
- **Görünen metin koda gömülmez.** Protokol ve araç adları veridir.
- **`any` yok, `@ts-ignore` yok.** `noUncheckedIndexedAccess` açık: `bytes[i]`
  tipi `number | undefined` — guard yaz. Bu motorda **çok sayıda koşullu ofset**
  var, guard disiplini kritik.
- **Kod yorumları Türkçe, tanımlayıcılar İngilizce.** Yorum koddan okunamayanı yazar.
- **`protocol-core/types.ts`e DOKUNULMAZ.**
- **Katalog sayıları değişmez**: 8 domain / 54 aile / 172 protokol
  (`src/tests/catalog.test.ts` bekçiliyor). Bu dalga yalnız `status` ve
  `pluginId` değiştirir.
- **Rozet `resolveStatus()`ten okunur**, ham `protocol.status`tan değil.
- **Boş kart basmak yasak.**
- **KOD KOPYALANMAZ.** Wireshark GPL-2.0, izot MIT — ikisinden de yalnız
  **biçim ve sabit** bilgisi alınır, satır kopyalanmaz. Spec PDF'i telifli;
  **kısa alıntılar** kaynak gösterilerek kullanılır, tablolar yeniden yazılır.

---

## Model/effort önerisi

### **Opus · high**

**Model = Opus** — yol belli değil, seçenekleri tartıp birini seçmek gerekiyor
(CLAUDE.md model tablosu, Opus satırı). Altı ayrı **sessiz-yanlış** noktası:

1. **Koşullu ofset zinciri.** Adres uzunluğu `addr_fmt`e VE bir seçici bite
   bağlı; domain uzunluğu ayrı bir alana; *PDU okteti `pdu_fmt`e göre var ya da
   yok; REMINDER/REM/MSG'de araya değişken `M_List` giriyor. **Tek bir yanlış
   ofset hata VERMEDEN yanlış alan basar** ve jsdom testinde sessiz kalır.
2. **SNVT ölçek formülü** — `A×10^B×(ham+C)` yerine `(A×10^B)×ham+C` yazmak
   `SNVT_temp`te sonucu 2466 °C kaydırır ve **hata vermez**. `arinc-429`in bit
   sırası tuzağıyla (15f) aynı sınıf.
3. **Dört kaynağın DÖRT yerde ayrışması** ve hakem seçimi (normatif spec / MIT
   kod / aritmetik / "hakem yok"). Nitel yargı gerektiriyor.
4. **NM/ND yanıt kodu çakışması** (`[KARAR 17-5]`) — birinci sınıf kaynağın
   kendisi burada sadeleştiriyor; onu izlemek de uydurmak da yanlış.
5. **SNVT tipinin telde olmaması** görünmez bir değişmez: sayfa "SNVT" araç
   etiketini gösteriyor; motor bir tip UYDURURSA kullanıcı ölçülmemiş bir
   mühendislik değeri görür.
6. **Domain'i kapatan dalgadır**, hata maliyeti artmıştır.

**Effort = high (`xhigh`/`max` DEĞİL):**
- `max` *"problemi tarif etmek bile zor"* durumu içindir; burada problem tam
  tarifli — normatif spec elde, dört kaynak, gerçek yakalama.
- `xhigh` geri dönüşü pahalı bir **ödünleşim** gerektirir. Burada
  `protocol-core/types.ts`e dokunulmuyor, **yeni bir paylaşılan çekirdek
  doğmuyor**, katalog kayıt sayısı değişmiyor. Tek geri-dönüşü-olan iş
  `crcCatalogue.ts`e bir giriş eklemek ve o da `check` fixture'ıyla
  bekçileniyor. Belirsizlik **kapsamda**, sözleşmede değil.

**Alt dalga bölünmesi: YOK.** Tek kayıt, tek tel, tek commit (`17`).

---

## Tamamlanma ölçütü

- `lonworks` ailesinde `planned` KALMIYOR **ve `building-automation`
  domain'inde `planned` KALMIYOR** — **yedinci kapanan domain**.
- Kanonik borç **5 → 4** (hepsi `wireless-iot`), **KODDAN doğrulanır**.
- `lonworks` **Kısmi** rozetiyle açılıyor; `summary` hangi telin çözüldüğünü ve
  hangilerinin kapsam dışı olduğunu AÇIKÇA yazıyor.
- Gerçek yakalamanın yedi çerçevesi alan alan çözülüyor; **1) ve 2)'nin
  transaction eşleşmesi** ekranda görünüyor.
- **`nvTypeNotOnWire` HER NV çözümünde** basılıyor ve e2e'de görünüyor.
- **`nvPayloadType` seçimi `00 CA`yı `SNVT_temp_p`de 2.02 °C, `SNVT_temp`te
  −253.8 °C okuyor** — ölçek formülü ekranda kanıtlı.
- **7) gerçek çerçevesi `truncated-frame` basıyor.**
- **Kapsam dışı pcode TANINIP AÇIKÇA reddediliyor** (`unsupported-encoding` +
  metin), sessizce "geçersiz" DENMİYOR.
- `lonworksCanParseRegistry.test.ts` yeşil, **üç yönü de** kanıtlıyor.
- `crcCatalogue.ts`e **yalnız `CRC16_GENIBUS`** eklendi, `check = 0xD64E`
  fixture'ı yeşil, `CrcCalculatorTool.test.tsx:81` **38**.
  (Ya da CRC'li şık yazılmadıysa: `crcCatalogue.ts` DEĞİŞMEDİ, sayı **37**.)
- İki türetilmiş fixture **kendiliğinden `wireless-iot/mesh-smart-home/thread`e
  kaydı** ve ikisi de yeşil.
- `definitions` sekmesi "planlandı" basıyor ve e2e bunu sınıyor.
- Dört kapı yeşil.

---

## Domain kapanış görevleri (17 bitince)

1. **`CLAUDE.md` "Bilinen borçlar"**:
   - `building-automation` TAMAMEN KAPANDI (yedinci domain); kalan kanonik borç
     **4** (hepsi `wireless-iot`).
   - Ham sayım **KODDAN yeniden doğrulanır**. Bugünkü değerler (2026-08-26,
     ölçüldü): 172 kayıt, ham **124 `ready` / 20 `planned` / 28 `partial`**;
     alias çözülünce **139 / 5 / 28**. Dalga 17'den sonra beklenen: ham
     **124 / 19 / 29**, çözülmüş **139 / 4 / 29** `[BEKLENTİ — koddan doğrulanacak]`.
   - `lonworks` **`partial` gerekçeler listesine** eklenir (ISO/IEC 14908-4
     CN/IP-only; 14908-2/-3'ün ham L2 çerçevelemesi için **kamuya açık bir
     yakalama yolu yok** — libpcap `DLT_` yok), `iec-61162` maddesinin ardına.
   - **Yeni kalıcı dersler:**
     - *"Paywall ≠ kaynaksız."* Normatif Echelon spec'i ücretsiz indirilebiliyor
       ve tam yığın MIT. Keşif turu **"spec ücretli" diye kaynak aramayı
       BIRAKMAZ.**
     - *"Kaynak hiyerarşisi alan alan işler."* Wireshark birinci sınıf sanılıyordu;
       normatif spec gelince **üç yerde** ondan sapıldı ve bir yerde
       (`2b` adres biçimi) **hatalı sanılan go-lon HAKLI** çıktı.
     - *"Birinci sınıf kaynak kendi hatasını yazabilir"* — `packet-lon.c:395`in
       `TODO`su; **çıkarım kodu ile gösterim maskesi ayrışabilir**.
     - *"Aynı dosyadaki YORUM ile KOD ayrışabilir; KOD kazanır."* Bu dalgada
       **iki kez** yaşandı: `LtIpPackets.h:264` *"size of header - 20"* derken
       `LtIpPackets.cpp` *"count of 4-byte values"* deyip `*4` yapıyor;
       `packet-lon.c:395`in `TODO`su maskeyi yanlış öneriyor ama çıkarım kodu
       doğru. **Alan tarifini yorumdan değil, çalışan koddan al.**
     - *"Aynı polinom + aynı init + aynı yansıma bile aynı algoritma değildir"* —
       `CRC16_GENIBUS` ile `CRC16_CCITT_FALSE` **yalnız `xorout`ta** ayrılıyor
       (`0xD64E` vs `0x29B1`). 16a'nın polinom-düzeyi dersinin en keskin hâli.
     - *"Öncelik/kanal bilgisi ULAŞIM KATMANINDA olabilir"* — CN/IP önceliği UDP
       portundadır (1628 normal / 1629 urgent); motor onu BASMAZ.
     - *"Semantik tip telde olmayabilir"* — NV selector bir bağlama indeksidir;
       KNX DPT ilkesinin ikinci vakası. Aynı iki bayt beş farklı mühendislik
       değeri verebiliyor.
     - `canParse` yanlış pozitifi **üçüncü kez brif aşamasında ölçüldü** ve ilk
       kez **kapsam kararını** belirledi (0 vs 401).
2. **`docs/plan-fazlar.md`**:
   - Dalga 17 kapanış özeti (dalga 16'nın `:346-…` biçimi emsal).
   - **`:32` satırındaki faz tablosu**: "dalga 17 KAPANDI — `building-automation`
     … **yedinci kapanan domain**. Kalan iş **4 kanonik kayıt**: wireless-iot 4".
   - **Yeni bilinen borç:** XIF parser'ı + `xif` `definitions` paneli;
     kaynakları (LmXif4501.pdf, izot `.xif` örnekleri, `g3gg0/LonScan`) yazılır.
3. **`docs/brief-faz10-dalga17.md`** (bu dosya) — "Çürüyen tahminler → Uygulama
   sırasında çürüyenler" bölümü DOLDURULUR.
4. **Sıradaki domain seçimi YAPILMAZ.** Geriye tek domain kalıyor
   (`wireless-iot`, 4 kayıt) ve seçim kullanıcınındır.

---

## Çürüyen tahminler

*(Dalga 12'den beri kural: brifin yanlış çıkan öngörüleri dosyada İŞARETLENİR,
SİLİNMEZ.)*

### Keşif turunda ZATEN çürüyenler

1. **"`lonworks` spec'i paywall arkasında; `seatalk`/`cc-link-ie` sınıfı bir
   kaynaksız-kayıt vakası."** (Görev tanımının açık hipotezi.)
   **TAMAMEN ÇÜRÜDÜ.** Normatif Echelon spec'i **ücretsiz** (598 KB, 112 sayfa),
   tam yığın **MIT** (`izot/lon-stack-ex`), SNVT master listesi **açık**,
   XIF referans kılavuzu **açık**, 12.028 çerçevelik yakalama **açık**.
   Bu, dalga 16'nın herhangi bir kaydından daha iyi bir kaynak durumu.
   **Kalıcı ders: "spec ücretli" bir arama-durdurma gerekçesi DEĞİLDİR.**

2. **"Kapsam sorusu (ham tel mi IP-852 mi) brifte TARTIŞILARAK karara
   bağlanmalı."** **KISMEN ÇÜRÜDÜ — tartışılacak ödünleşim çıkmadı.** Beklenti
   "iki seçenek tartılacak" idi; gerçekte üç bağımsız olgu tek cevaba işaret
   etti: (a) `dissector_add_uint("cnip.protocol", 0, …)`, (b) libpcap'te
   LonTalk `DLT_`i YOK, (c) `canParse` 0 vs 401. **Ayrım ayrıca beklenenden
   İNCE çıktı:** ham L2 *belgesiz* değil (spec Figure 3.2 + CRC tam), **yakalama
   YOLU yok**. "Belgesiz" ile "erişilemez"i ayırmak gerekti.

3. **"Wireshark dissector'ı varsa BİRİNCİ SINIF kaynaktır."** (Görev tanımının
   varsayımı.) **ÇÜRÜDÜ — ÜÇÜNCÜ SINIF çıktı.** Dissector var ve çok değerli,
   ama normatif spec'ten **üç yerde** sapıyor, AuthPDU maskeleri kendi
   `TODO`suyla bozuk, CRC'si `#if 0` içinde ve NM/ND yanıtlarını yanlış
   etiketliyor. Ayrıca **arama adı da yanlıştı**: `packet-lontalk.c` /
   `packet-iso14908.c` YOK; doğru adlar **`packet-lon.c`** ve **`packet-cnip.c`**.

4. **"LonTalk'ın CRC'si katalogda var mı yok mu karşılaştırılmalı; sahte dost
   ara."** **DOĞRU ÇIKTI ve deponun en keskin sahte dostunu buldu.** LonTalk'ın
   CRC'si **CRC-16/GENIBUS**tur (`check = 0xD64E`) ve katalogda YOK;
   `CRC16_CCITT_FALSE` ondan **yalnız `xorout`ta** ayrılıyor. Ama tünelde CRC
   TAŞINMADIĞI için ekleme yalnız `raw-lontalk-pdu-with-crc` şıkkına bağlı.

5. **"SNVT tipleri muhtemelen kapalı/erişilemez."** (Bu brifin ilk taslağının
   varsayımı — `lonmark.org/nvs/`nin tekil tip sayfası SPA olduğu için.)
   **ÇÜRÜDÜ.** Statik listede 221 tipin **indeksi, boyu, Neuron C tipi ve ölçek
   üçlüsü** var; ayrıca 413 sayfalık master list PDF'i ve MIT kodundaki yorumlar
   **üçüncü** bir teyit veriyor. Kapı geçildi, kanal açılıyor.
   **Ders: bir sayfanın "SPA" olması verinin kapalı olduğu anlamına gelmez —
   aynı verinin başka bir yayını olabilir.**

6. **"Ölçek formülü `(A×10^B)×ham + C`."** (Bu brifin ilk taslağının yazdığı.)
   **ÇÜRÜDÜ.** LonMark'ın kendi ifadesi `A * 10^B * (Raw + C)`.
   `SNVT_temp`te fark **~2466 °C**.

7. **"`canParse` yanlış pozitifi brif aşamasında ölçülmeli."** **DOĞRU ÇIKTI ve
   beklenenden DAHA ÇOK iş gördü** — ilk kez `true`/`false` kararının ötesine
   geçip **kapsam kararının ikinci ayağı** oldu.

8. **"Fixture zinciri `lonworks`ı seçiyor olmalı."** **DOĞRU ÇIKTI, koddan
   doğrulandı** — ikisi de bugün `lonworks`ı seçiyor, motor alınca ikisi de
   `thread`e kayıyor.

9. **"CN/IP `Time Stamp`inin ölçeği tamamen bilinmiyor."** (Bu brifin ilk
   taslağı.) **YARISI ÇÜRÜDÜ.** Birim **milisaniye** — `LtIpPackets.h:272`
   *"milliseconds in wall clock time"*. Bilinmeyen **epoch**; aynı dosyada
   `getTd1970()` (*"time delta from 1900 to 1970"*) yardımcısı var, yani iki
   taban da dolaşımda. Kanal `timestampScale`ten `timestampEpoch`e döndü.

10. **"`extndHdrSize`in birimi Wireshark ile Echelon arasında tartışmalı."**
    (Bu brifin ilk taslağı SAPMA sayıyordu.) **ÇÜRÜDÜ — İKİSİ ÖRTÜŞÜYOR.**
    Kafa karışıklığının kaynağı `LtIpPackets.h:264`ün *"size of header - 20"*
    yorumu; `LtIpPackets.cpp`in **kodu** ise iki yerde
    *"extndHdrSize is a count of 4-byte values"* diyor ve `*4` yapıyor.
    **Kalıcı ders: aynı dosyadaki YORUM ile KOD ayrışabilir; kod kazanır.**
    (`packet-lon.c:395`in `TODO`su bunun tersi vakası: orada da kod doğru,
    metadata yanlıştı. Aynı dalgada iki kez.)

11. **"Tek kayıt olduğu için tek brif yeter."** **DOĞRU ÇIKTI**, ama beklenenden
    uzun: çerçeve **iki katmanlı** (CN/IP + LonTalk) ve LonTalk katmanının
    **beş dallı** bir ofset zinciri var.

### Uygulama sırasında çürüyenler (17)

*(Alt dalga bitince BURAYA yazılır. Yanlış öngörüler silinmez, işaretlenir.)*

---

## Açık sorular

### `[DUR-SOR]` — kullanıcıya sorulacaklar: **YOK**

Dalga 16'nın beş `[DUR-SOR]`u vardı ve beşi de keşfin önerdiği şıkla kapandı.
Bu dalgada **hiç `[DUR-SOR]` yok** — altı kararın hepsi keşif turunda kanıta
bağlandı:

| Karar | Neden DUR-SOR değil |
|---|---|
| `[KARAR 17-1]` kapsam (CN/IP-only) | Üç bağımsız olgu tek cevap veriyor; tartışılacak ödünleşim yok. |
| `[KARAR 17-2]` rozet `partial` | Kurulu dar-kapsam politikası ("SORMA, UYGULA") + spec'in KENDİ kapsam daraltması (`ozet/07:454`). |
| `[KARAR 17-3]` SNVT tipi çözülmez, ölçek tablosu yayınlanır | Tipin telde olmaması ölçülmüş bir olgu; ölçek tablosunun kapısı (2 bağımsız kaynak) geçildi. |
| `[KARAR 17-4]` XIF yazılmaz | `[Karar 15h-1]` ve 16c'nin "domain kapatan dalgada ikinci motor yok" gerekçesinin birebir aynısı. |
| `[KARAR 17-5]` yanıt kodu belirsiz basılır | Normatif spec'in kendisi çakışmayı yazıyor; çerçeveler arası durum parser'a girmez (dalga 16 bulgu 12). |
| `[KARAR 17-6]` `CRC16_GENIBUS` eklenir | `check = 0xD64E` yayımlanmış ve deponun motoruyla doğrulandı — katalogun kabul ölçütü budur. |

### Alt dalga içinde karara bağlanabilir (DUR-SOR DEĞİL)

- `nvPayloadType` şık listesinin kaç tip içereceği (skaler + ölçekli + güncel).
- `payloadKind`ın CRC'li üçüncü şıkkının yazılıp yazılmayacağı — yazılmazsa
  `crcCatalogue.ts` de değişmez ve sayı 37 kalır.
- `decodeOptions` kanal sayısının 8'den sapması.
- Modül bölünmesinin 3'ten sapması.
- Örnek çerçeve sayısının 11'den sapması.
