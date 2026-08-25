# Faz 10, dalga 14 — Automotive (keşif, 2026-08-23)

## Kapsam

`automotive` domain'inin kalan **12 kanonik kaydı**. Domain toplamı 7 aile / 25 protokol
(`src/app/catalog/domains/automotive.ts:24`). Ham `planned` sayısı **13**, ama
`vehicle-network-protocols/canopen` bir ALIAS'tır
(`aliasOf: 'industrial-automation/cip-can-based/canopen'`, `automotive.ts:236`) ve
kanonik ikizi dalga 13'te `ready` oldu — `resolveStatus()` bunu çözer, rozet `ready`
basar. **13 ham `planned` − 1 alias = 12 gerçek iş**, CLAUDE.md'nin borç sayımıyla
birebir ("automotive 12").

Dalga 13'ün brief'inin aksine bu domain'de **alias VARDIR ve yönü dışarı bakar**;
sayım yaparken `status`'a değil `aliasOf`'a bakılır.

Domain'de ayrıca **üç `partial` kayıt** duruyor (`iso-9141`, `iso-14230`, `obd-ii`) —
bu dalganın kapsamında DEĞİL, ama üçünün dosya başı bu dalganın en önemli
kısıtlarını yazılı olarak taşıyor (bkz. bulgu 5 ve 6).

Spec kaynağı: `docs/spec/ozet/04-otomotiv.md` (518 satır).

### Aile aile döküm

| Aile | `ready`/`partial` | `planned` (bu dalga) |
|---|---|---|
| can-family | can-2-0a, can-2-0b, can-fd, can-xl | — (aile bitti) |
| vehicle-network-protocols | j1939, lin, canopen (alias→ready) | **flexray, sae-j1850-pwm, sae-j1850-vpw** |
| sensor-interfaces | — | **sent, spc, psi5** |
| legacy-diagnostics | iso-9141 (partial), iso-14230 (partial) | **k-line** |
| diagnostics | iso-tp, uds, doip, obd-ii (partial) | — (aile bitti) |
| automotive-ethernet | — | **automotive-ethernet, some-ip** |
| calibration | — | **xcp-on-can, xcp-on-ethernet, ccp** |

## Zaten var olan motorlar — dalga 13'ten BÜYÜK, çoğu KOD SEVİYESİNDE KANITLI

Aşağıdaki her satır grep'le doğrulandı. "Doğrulama durumu" sütunu tahmin taşımaz.

| Motor | Yol | Bu dalgada kimi taşır | Doğrulama durumu |
|---|---|---|---|
| SocketCAN çerçeve çözücü | `automotive/can/canFrame.ts` — `decodeSocketCanFrame`, `decodeCanId`, `readUint32Le`, `CAN_CLASSIC_FRAME_LENGTH`, `CAN_HEADER_LENGTH` | **xcp-on-can, ccp** | **KANITLI, ÜÇ TÜKETİCİLİ** — `isotp.ts:50-55`, `j1939.ts:58-64` ve CROSS-DOMAIN `devicenet.ts:71-77` aynı beş sembolü import ediyor |
| CAN çerçeve kurucu | `automotive/can/canClassic.ts` — `buildCanClassicFrame` | **xcp-on-can, ccp** (örnek çerçeve üretimi) | **KANITLI** — aynı üç dosya kullanıyor |
| Ethernet başlık/VLAN yürüyücüsü | `network/ethernet/ethernetFrame.ts` — `formatMac`, `classifyDestinationMac`, `walkTypeLengthChain`, `decodeEthernetFrame` | **automotive-ethernet** (yalnız çapraz-link olarak; bulgu 4) | **KANITLI, 8 CROSS-DOMAIN TÜKETİCİ** — ethercat, profinet, powerlink, sercos-iii, cc-link-ie, goose + network içi arp/dhcp/ipv4/ipv6/lldp |
| SAE J1850 CRC-8 | `protocol-core/checksums/crcCatalogue.ts:48` — `CRC8_SAE_J1850` (poly `0x1D`, init `0xFF`, xorout `0xFF`) | **sae-j1850-pwm, sae-j1850-vpw** | **KANITLI ama YETİM** — katalogda tanımlı, `crcEngine.test.ts:20` dışında TÜKETİCİSİ YOK. J1850 kayıtları İLK tüketici olur |
| Araç PHY hesap motoru | `protocol-core/timing/vehiclePhy.ts` — `calculateFlexrayChannels`, `calculateLinBreak`, `estimateBaudFromSyncSpan`, `UART_CHARACTER_BIT_TIMES` | **k-line** (init zamanlaması), **flexray** (kanal/topoloji hesabı) | **KANITLI** — `features/calculators/tools/vehiclePhyTools.tsx` üç `interfaces-framing` kaydına bağlıyor (`can-phy`, `lin-phy`, flexray PHY) |
| Single Pair Ethernet hesap motoru | `protocol-core/timing/singlePairEthernet.ts` — `SPE_BIT_RATES` (`100base-t1`, `1000base-t1` DAHİL), `calculateSpeFrameTime`, `calculatePlcaCycle` | **automotive-ethernet** | **KANITLI** — `interfaces-framing/host-network-interfaces/single-pair-ethernet` (`partial`, `calculatorIds`) zaten tüketiyor |
| UART zamanlama | `protocol-core/timing/uart.ts` — `calculateUartTiming` | **k-line** (bayt süresi, inter-byte gap) | **KANITLI** — `serial-interfaces/uart.ts` ve `uartLineCore.ts` tüketiyor |
| Bit imleci | `protocol-core/decoding/bitCursor.ts` — `readBits`, `readBitsAsNumber` | **flexray** (5 gösterge biti + 11-bit Frame ID + 7-bit Payload Length aynı bayta sığmıyor), **psi5** | **KANITLI** — rtp, rtcp, coap, rtcm, lorawan, zigbee, ble, opcUaBinary tüketiyor |
| CIP nesne modeli deseni | `industrial/cip/cipCore.ts` — `decodeCipMessage(data, start, end, fields)` | (motor değil) **DESEN**: taşıyıcıdan bağımsız çekirdek + iki taşıyıcı | **KANITLI** — `ethernetip.ts` ve `devicenet.ts` aynı çekirdeği tüketiyor. `xcpPacket.ts` bunun birebir analoğu olacak |
| OBD-II mod/PID motoru | `automotive/obd/obd.ts` — `parseObd`, `getObdModeInfo`, `OBD_MODES` | **sae-j1850-vpw** (yalnız `decodeOptions` ile OPT-IN; bulgu 5) | **KANITLI ama KISITLI** — girdisi HAM PDU baytıdır (CAN çerçevesi değil), `obd.ts:4-6` |

**Paylaşım OLMAYAN, sıfırdan yazılacaklar:** XCP paket motoru, CCP komut kümesi,
SOME/IP başlığı + SD, FlexRay çerçevesi, SENT nibble çözücü, PSI5 slot çözücü,
J1850 nabız çözücü. Bunların hiçbiri için depoda kod YOK — `grep -rli
"flexray\|someip\|xcp\|j1850\|psi5"` yalnız katalog, çeviri ve `vehiclePhy.ts`
(FlexRay PHY hesabı) döndürüyor, motor döndürmüyor.

## Mimari bulgular

### 1) BEŞ KAYDIN GİRDİSİ BAYT DEĞİL NABIZ — dalganın en büyük kararı

`sent`, `spc`, `psi5`, `sae-j1850-pwm`, `sae-j1850-vpw`. Spec bunu tahmin bırakmıyor,
girdiyi AÇIKÇA nabız günlüğü olarak veriyor:

- SENT (`:151`): *"Girdi log örneği: Pulse 0: 168 us, Pulse 1: 45 us, Pulse 2: 63 us…
  Önce calibration/sync pulse'tan Estimated Tick Time çıkarılır"*
- J1850 PWM (`:397`): *"Toolkit pulse-log tabanlı decoder sağlamalıdır"*
- J1850 VPW (`:411`): *"Örnek raw capture: Active 64 us, Passive 128 us, Active 64 us…"*
- PSI5 (`:171`): *"İlk sürümde fiziksel current waveform capture zorunlu olmayabilir;
  belgenin yaklaşımına uygun biçimde pulse/frame log import desteklenebilir"*

`ProtocolParser.parse(data: Uint8Array)` sözleşmesi KİLİTLİ
(`protocol-core/types.ts:181`, CLAUDE.md kararı, 172 kaydı etkiler). Üç yol var:

**(a) `partial` + `calculatorIds`, parser YOK.** Emsal bol ve dört kez uygulandı:
`can-phy`, `lin-phy` (`interfaces-framing.ts:686,718`), `current-loop`,
`single-pair-ethernet` (`:656`), `lora`. Ucuz ve dürüst. Bedeli: beş kaydın `decode`
sekmesi katalogdan düşer, domain "çözücüsüz" kapanır.

**(b) Belgelenmiş nabız-günlüğü konteyneri + `decodeOptions`.** Emsal `canFrame.ts`:
SocketCAN'in 16 baytlık çerçevesi de "telin kendisi" değil, bir YAKALAMA
KONTEYNERİDİR — depo bunu 25 kayıtta sorunsuz taşıyor. Aynı disiplinle nabız günlüğü
`Uint8Array` içine sabit genişlikli LE alanlarla konur (ör. nabız başına 2 bayt,
0.1 µs birimi; VPW'de aktif/pasif biti en üst bitte). `types.ts`e DOKUNULMAZ.
Tick time / eşik / profil `decodeOptions` kanalından gelir — `microwire.ts`in
gerekçesi birebir aynı ("aynı dört bayt, x8 profiliyle READ 0x2A, x16 profiliyle
bambaşka bir şey; tahmin etmek uydurmaktır").

**(c) Karma:** J1850 ikilisi + SENT/SPC (b) ile çözülür — spec bu üçü için ÇALIŞILMIŞ
sayısal örnek veriyor (`45.0 µs / tick 3.0 µs → 15 tick → nibble 0x3`, `8.1 µs → Bit 1`),
yani doğrulanabilir fixture var. PSI5 (a) ile bırakılır — spec'in kendisi
"tek global frame formatı varsayma, CRC/frame-size/slot kuralları profile'dan gelir"
diyor ve doğrulanmış tek bir fixture VERMİYOR.

**Öneri: (c).** Gerekçe: konteyner icat etmenin bedeli yalnız fixture'ı doğrulanabilir
olan kayıtlarda ödenmeye değer. Bu bir DUR-SOR maddesidir (açık soru 1).

### 2) CAN taşıyıcılı üst katman emsali KANITLI ve CROSS-DOMAIN

`xcp-on-can` ve `ccp` için karar verilecek bir şey yok: üç dosya (`isotp.ts`,
`j1939.ts`, `devicenet.ts`) aynı beş sembolü aynı biçimde import ediyor ve
`devicenet.ts:6-9` bunu yazılı kural haline getirmiş: *"CAN veri-bağı motoru İKİNCİ
KEZ YAZILMADI — `canopen.ts:57`in `automotive/can/canClassic`i PAYLAŞMA emsali
BİREBİR izlendi"*. XCP on CAN ve CCP girdiyi **16 baytlık SocketCAN klasik
çerçevesi** olarak alır, CAN ID'yi `decodeCanId` ile çözer, yükü kendi katmanı
olarak ayrıştırır. İkinci bir CAN çözücü YAZILMAYACAK.

### 3) XCP çekirdeği GERÇEK paylaşım, CCP ise DEĞİL

`xcp-on-can` + `xcp-on-ethernet` spec'in kendi ifadesiyle aynı temel protokoldür
(`:363` *"XCP base protokolü aynı kalır, transport: Ethernet → IP → UDP veya TCP →
XCP"*). Bu, dalga 12c'nin `dnsWire.ts` ve dalga 13d'nin `cipCore.ts` vakasıyla aynı
sınıf: **önce `protocols/automotive/xcp/xcpPacket.ts` yazılır (CTO/DTO ayrımı, komut
kümesi, PID/hata kodları), sonra iki taşıyıcı onu tüketir.** Sıra önemli — 13d'de CIP
önce yazılıp iki taşıyıcı onu tükettiği için sorun çıkmadı.

**CCP bu paylaşıma DAHİL DEĞİL.** Spec ikisini ayrı ayrı tanımlıyor ve nesne adları
bile farklı: XCP **CTO/DTO** (`:353`), CCP **CRO/DTO** (`:383`). Komut kümesi de
ayrışıyor (CCP: `CONNECT → GET_CCP_VERSION → SET_MTA → UPLOAD/DOWNLOAD → DAQ`;
XCP: `CONNECT/GET_STATUS/SET_MTA/UPLOAD/DOWNLOAD`), CCP'de ayrıca her CRO'da bir
**Counter** alanı var, XCP'de yok. ASAM CCP'yi legacy ilan etmiş (`:379`, `:506`).
**CCP'yi XCP tablosuyla çözmek dalga 12f'in MQTT/MQTT-SN tuzağının aynısı olur** —
akraba görünen, aynı yerde aynı sayıyı BAŞKA anlamda okuyan iki biçim. CCP kendi
dosyasına yazılır, yalnız CAN taşıyıcısını paylaşır.

### 4) `automotive-ethernet` kaydının KENDİNE AİT TEL BİÇİMİ YOK

Spec'in verdiği stack (`:325`): `Ethernet → 802.1Q VLAN → IPv4/IPv6 → UDP/TCP →
SOME/IP / DoIP / XCP`. Bu zincirin **her halkası zaten `ready` ve plugin'li**:

`ethernet-ii` · `ieee-802-3` · `vlan-802-1q` · `ipv4` · `ipv6` · `udp` · `tcp`
(hepsi `network-ethernet.ts`, hepsi `status: 'ready'`).

Fiziksel taraf da kapalı: `single-pair-ethernet` (`interfaces-framing`, `partial`,
`calculatorIds`) motorunda `SPE_BIT_RATES` `100base-t1` ve `1000base-t1` değerlerini
zaten taşıyor — spec'in bu kayıt için istediği iki PHY sınıfı bunlar.
Üst uçlar da hazır ya da bu dalgada: `doip` (ready), `some-ip` (14d), `xcp-on-ethernet`
(14c).

Geriye kalan araç listesi (Communication Matrix, Bandwidth, Top Talkers,
Latency/Jitter, Packet Loss) **tek çerçeve çözümü değil, analyzer işidir** — dalga 12c'de
DNS'in Transaction Matching'i, 12d'de PTP'nin δ/θ'sı aynı gerekçeyle analyzer'a
bırakılmıştı.

**Öneri: `automotive-ethernet` yeni parser ALMAZ.** `status: 'partial'`,
`pluginId` YOK, `calculatorIds` ile `singlePairEthernet.ts` hesaplarına bağlanır,
`related` yedi `ready` kayda genişletilir, özet metni neyin nerede çözüldüğünü
AÇIKÇA yazar. Bu, LoRa/can-phy/current-loop/single-pair-ethernet deseninin
BEŞİNCİ uygulaması. DUR-SOR maddesi (açık soru 3).

### 5) ZİNCİR KURALI DEĞİŞTİ — dalga 13d "opt-in zincir"i emsal yaptı

Dalga 1/2 kararı ÜÇ dosyanın başında yazılı: *"üç motor (ISO-TP/UDS/OBD-II) bağımsız
çalışır, zincir parser katmanında kurulmaz"* (`obd.ts:4-6`, `iso9141.ts:7-10`,
`iso14230.ts:8-12`; DoIP'in UDS yükü de aynı gerekçeyle ham).

Ama dalga 13d bunu **koşullu olarak deldi ve emsal bıraktı:** `devicenet.ts`
`decodeOptions` ile `payloadInterpretation` kanalı açıyor — varsayılan `raw`,
kullanıcı `cip-explicit` seçerse AYNI `cipCore.ts` çağrılıyor
(`devicenet.ts:130-145`, `:331-336`). Dosya başı gerekçeyi yazıyor: *"payload'ın
explicit mesaj olduğu GERÇEKTEN çerçeveden çıkarılamıyor (kullanıcı sistem
bağlamından bilir)"*.

Spec `sae-j1850-vpw` için zinciri AÇIKÇA istiyor (`:413`: *"Toolkit zincirleme decode
yapabilmelidir: J1850 VPW → OBD-II → Mode → PID"*). **Kural:** varsayılan HAM +
"OBD-II sayfasında çözülür" uyarısı; zincir yalnız açık bir `decodeOptions` şıkkının
arkasında kurulur. Sessiz zincir YOK.

### 6) `k-line` için depo ZATEN karar vermiş — ve karar "parser yazma"

İki motor dosyasının başında birebir yazılı:

> `iso9141.ts:4-7` — *"K-Line'ın fiziksel katmanı (5-baud init, key bytes, hat
> zamanlaması) bir bayt akışı DEĞİLDİR — decoder'a HİÇ girmez (K-Line kararı,
> brief-faz10-dalga2.md: motor ALMAZ, `planned` kalır; init bir bayt akışı değil hat
> olayıdır)."*
>
> `iso14230.ts:5-8` — aynı cümle, "5-baud/fast init" ile.

Yani `k-line` bugün `planned` çünkü **öyle karar verildi**, unutulduğu için değil.
Dalga 14'ün seçeneği: kararı koru (domain kapanmaz) ya da bulgu 1'in (a) yoluna taşı —
`partial` + `calculatorIds`, motor `vehiclePhy.ts` + `timing/uart.ts` üzerinden
(5-baud init = 200 ms/bit, inter-byte / inter-message gap, fast-init darbe süresi).
Emsal bol; ama `ready`→`partial` sınıfı bir karar olduğu için DUR-SOR (açık soru 2).

### 7) FlexRay'in İKİ CRC'si de katalogda YOK, üstelik biri bayt hizasız

- `CRC_ALGORITHM_IDS` (`crcCatalogue.ts:13-37`) 24 giriş taşıyor. İçinde `CRC24` VAR
  ama o **OpenPGP** (poly `0x864CFB`, `crcCatalogue.ts:211-228` bunu açıkça yazıyor),
  `CRC24_Q` da FlexRay değil. **FlexRay frame CRC-24 (poly `0x5D6DCB`) katalogda YOK.**
- **CRC-11 diye bir giriş hiç YOK.** FlexRay header CRC 11 bittir.
- `crc(bytes: Uint8Array, params)` (`crcEngine.ts:80`) **bayt bayt döner** — 8'in katı
  olmayan girdi alamaz. FlexRay header CRC'si tam **20 bit** üzerinden hesaplanır
  (1+1+11+7). Mevcut motorla doğrudan hesaplanamaz.

Sonuç: 14e iki katalog girişi ekler (additive, `types.ts`e dokunmaz) ve ya `crcEngine`e
bit-uzunluğu alan bir kardeş fonksiyon ekler ya da 20 biti `bitCursor` ile paketleyip
belgelenmiş bir dolgu kuralıyla besler. Bu, 14e'nin Opus gerekçesinin somut karşılığı.

### 8) `a2l` ve `ldf` panelSİZ — ve bu bu domain'de ZATEN emsal

`DEFINITION_FORMATS` (`app/catalog/types.ts:51-52`) `a2l` ve `ldf` içeriyor, ama depoda
yalnız **iki** tanım paneli var (`DbcPanel`, `EdsPanel` — dalga 13 dersi 4). `lin`
kaydı `definitions: ['ldf']` bildirip `ready` olmuş (`automotive.ts:296`) — yani
panelsiz tanım bildirimi bu domain'de zaten meşru ve `ready` engellemiyor.

**xcp-on-can / xcp-on-ethernet / ccp `definitions: ['a2l']` bildirir, A2L
AYRIŞTIRICISI YAZILMAZ.** Spec'in "A2L varsa → EngineSpeed: 1498 rpm" örneği
(`:359`) A2L olmadan üretilemez; DTO yükü **HAM kalır + uyarılır**, sahte alan kırılımı
UYDURULMAZ (dalga 13 dersi 4'ün birebir aynısı: PROFINET çevrimsel I/O, IO-Link
Process Data).

## Alt dalga sıralaması önerisi

Dalga 13'ün dersi uygulandı: en kanıtlı ve en ucuz olan başta, kararı beklenen ve
riskli olan sonda.

| # | Kayıtlar | Neden burada | Motor | Zorluk |
|---|---|---|---|---|
| **14a** | automotive-ethernet, k-line | İkisi de "tel biçimi yok" sınıfı; parser YAZILMAZ, desen beş kez uygulanmış. En ucuz giriş, `legacy-diagnostics`in `planned`ı biter | `singlePairEthernet.ts` + `vehiclePhy.ts`/`uart.ts` (`calculatorIds`) | kolay |
| **14b** | xcp-on-can | CAN taşıyıcı paylaşımı üç tüketiciyle kanıtlı; `xcpPacket.ts` burada doğar | `canFrame.ts` paylaşımı + yeni `xcpPacket.ts` | orta |
| **14c** | xcp-on-ethernet, ccp | `calibration` ailesi KAPANIR; xcp-on-ethernet 14b'nin çekirdeğini tüketir, ccp yalnız CAN taşıyıcısını paylaşır | `xcpPacket.ts` + `canFrame.ts` | orta |
| **14d** | some-ip | `automotive-ethernet` ailesi KAPANIR; bağımsız, iki parçalı (SOME/IP + SD), en geniş araç yüzeyi | — (paylaşım yok) | zor |
| **14e** | flexray | Bağımsız; iki yeni CRC + bayt hizasız header CRC + `bitCursor` (bulgu 7) | `bitCursor.ts`, `crcCatalogue`e iki ek | zor |
| **14f** | sae-j1850-pwm, sae-j1850-vpw | `vehicle-network-protocols` ailesi KAPANIR; `CRC8_SAE_J1850`in ilk tüketicisi; nabız kararına bağımlı | `CRC8_SAE_J1850` (yetim, hazır) | orta–zor |
| **14g** | sent, spc | SPC spec'in kendi ifadesiyle SENT yanıt çerçevesini tüketir — GERÇEK paylaşım; nabız kararına bağımlı | `sentNibble` (yeni, paylaşım gerçek) | orta–zor |
| **14h** | psi5 | `sensor-interfaces` ailesi KAPANIR; profile bağımlı, doğrulanmış fixture YOK — kaynaksız-kayıt politikası gereği `partial` | `bitCursor.ts` | zor (kaynak riski) |

**Toplam 8 alt dalga / 12 kayıt.** 14a bilerek en başta: hiç parser yazılmadan iki kayıt
kapanır, dalganın geri kalanına güven verir. 14f/14g/14h açık soru 1 karara bağlanmadan
BAŞLAMAZ.

**Her alt dalganın uygulama brifi ayrı dosyada** (`brief-faz10-dalga2a/2b` emsali):
`brief-faz10-dalga14a.md` … `brief-faz10-dalga14h.md`. Kod yazacak model ÖNCE bu ana
brifi, SONRA kendi alt dalga brifini okur. Bağımlılıklar: 14c → 14b (`xcpPacket.ts`
orada doğar) · 14g → 14f (nabız konteyneri orada tanımlanır) · 14h → 14g (konteyner
yardımcılarının `protocol-core`a taşınma kararı orada verilir) · 14d → 14a (yalnız aile
kapanış sayımı için). 14e bağımsızdır.

### Model önerisi (alt dalga başına)

- **14a** → Sonnet · medium (desen beş kez uygulanmış, kod yazımı yok denecek kadar az)
- **14b, 14c** → Sonnet · high (paylaşım kanıtlı ama `xcpPacket.ts`in taşıyıcıdan
  ayrılma sınırı bir tasarım kararı — `cipCore.ts` emsali var, mekanik değil)
- **14f, 14g** → Sonnet · high (karar 14 onaylandıktan sonra tarif netleşir; nabız
  konteyneri + `decodeOptions` formu kurulu desenler)
- **14d (some-ip)** → Opus · high (iki alt protokol, session korelasyonu, servis ağacı;
  dalga 12'nin HTTP gerekçesinin aynısı)
- **14e (flexray)** → Opus · high (bayt hizasız CRC + iki yeni katalog girişi + bit
  düzeyinde başlık — görünmez değişmez riski en yüksek kayıt)
- **14h (psi5)** → Opus · high (kaynak yetersizliğinde kapsam daraltma kararı
  gerektirir; `iec-61850` GOOSE-only sınıfı muhakeme, mekanik üretim değil)

## `decodeOptions` kanalı — bu domain'deki adaylar

Dalga 12'nin dersi: kanalı SPEKÜLE ETME, sorunun frame'den çıkarılıp çıkarılamadığını
önce sına (WebSocket'te MASK biti yönün KENDİSİYDİ, kanal açılmadı).

**Bu domain'de bugün hiçbir plugin `decodeOptions` bildirmiyor.** (`grep -rn
"decodeOptions:" src/protocols` dokuz dosya buluyor, hiçbiri automotive değil.
`canClassic.ts:132`'deki `decodeOptions` YEREL BİR DEĞİŞKEN ADI — sahte dost,
plugin kanalı değil.) Yani bu dalga automotive'de kanalı İLK KEZ açar.

**GÜÇLÜ adaylar (spec açıkça "evrensel sabit varsayma" diyor, `:512`):**

- **sent** — tick time (µs) + J2716 revizyonu/profili (nibble sayısı, pause pulse var mı).
  Spec `:151`: *"Kesin timing sabitleri ve toleranslar seçilen SAE J2716
  revizyon/profiline göre değişir; toolkit bunları evrensel sabit varsaymamalıdır."*
- **sae-j1850-pwm / vpw** — bit eşiği ve profil. Katalog yorumu (`automotive.ts:326`)
  bunu zaten yazmış: *"Bit eşiği profile bağlıdır; '8 us = 1' gibi sabitler evrensel
  değildir."*
- **psi5** — Application Profile (Airbag / Chassis-Safety / Powertrain / Custom) +
  PSI5 revizyonu + sync/async kipi. Spec `:181`: *"toolkit kesin CRC, frame-size ve slot
  kurallarını seçilen profile specification'dan yüklemeli."*
- **spc** — sensör profili (trigger darbe genişliği semantiği vendor datasheet'ine bağlı,
  spec `:167`).
- **xcp-on-can, xcp-on-ethernet, ccp** — **paket yorumu: CTO/CRO | DTO | ham.** XCP'de
  bir paketin CTO mu DTO mu olduğu ÇERÇEVEDEN ÇIKMAZ; ayrım A2L'de yapılandırılmış CAN
  ID / port ayrımından gelir. `devicenet.ts`in `payloadInterpretation` kanalıyla AYNI
  gerekçe sınıfı ve varsayılanı da aynı olmalı: **ham**.
- **sae-j1850-vpw** — ayrıca "yükü OBD-II olarak yorumla" şıkkı (bulgu 5; opt-in zincir).

**KANAL AÇILMAMASI beklenenler (gerekçeli):**

- **some-ip** — SOME/IP-SD ayrımı çerçeveden çıkar (Service ID `0xFFFF` + Method
  `0x8100`); yön/rol `Message Type` alanında. Payload yapısı ise ARXML/servis tanımı
  ister — kanal AÇMAK yerine HAM bırakılır + uyarılır (RTP'nin dinamik payload type
  kararının aynısı: *"kanal kullanıcıdan sorup tabloya yazmak aynı tahmini dolaylı
  yoldan yapmak olurdu"*).
- **automotive-ethernet, k-line** — parser yok, kanal da yok.
- **flexray** — Channel A/B çerçevenin İÇİNDE değil (yakalama metadata'sı). Kanal
  açmak yerine `RawFrame.channel` alanı zaten var; 14e önce ONU denemeli.

## Açık sorular

1. ~~**Nabız-günlüğü girdi sözleşmesi (bulgu 1) — dalganın tek büyük kararı.**~~
   → **KULLANICI KARARI: karma (c).** Konteyner 14f'te tanımlandı, 14g'de
   `protocol-core/decoding/pulseLog.ts`e taşındı, `types.ts`e DOKUNULMADI.
   **AMA "beş kaydı ilgilendiriyor" ÖNGÖRÜSÜ ÇÜRÜDÜ: dördünü ilgilendirdi.**
   PSI5 (14h) konteyneri HİÇ KULLANMADI — `dali.ts`in "Manchester decoder'a
   girmez" kararı oraya birebir oturdu ve girdi çözülmüş çerçeve bitleri oldu.
   PSI5 için önerilen "`partial` + `calculatorIds`, motor YOK" yolu da çürüdü;
   aşağı bak.
2. ~~**`k-line` `partial` + `calculatorIds` olarak mı kapansın?**~~ → **14a'da
   KARARA BAĞLANDI: EVET.** `timing/kLine.ts` yazıldı, rozet `partial` oldu,
   parser YAZILMADI.
3. ~~**`automotive-ethernet` parser almadan `partial` kapansın mı?**~~ → **14a'da
   KARARA BAĞLANDI: parser YOK.** `related` yedi halkaya genişletildi, motor
   `calculatorIds: ['spe-plca']` ile var olan `singlePairEthernet.ts`e bağlandı.
4. ~~**`crcEngine.ts`e bit-uzunluğu alan bir kardeş fonksiyon eklenecek mi?**~~ →
   **14e'de KARARA BAĞLANDI: EVET, (a).** `crcBits(bytes, bitLength, params)`
   eklendi, `crc()` ona delege ediyor, `refin` + kısmi bayt bileşimi ATIYOR.
5. ~~**SOME/IP-SD ayrı bir kayıt mı, `some-ip` içinde bir alt çözücü mü?**~~ →
   **14d'de KARARA BAĞLANDI: tek kayıt, iki modül.** Öneri kodla sınandı ve
   doğrulandı.

## Çürüyen tahminler — dalga 14 kapanışında (2026-08-24) yazıldı

Dalga 12/13'te kural hâline gelen bölüm: brief'in yanlış çıkan öngörüleri dosyada
İŞARETLENİR, silinmez. Bir sonraki keşif turu bu listeye bakarak kendi
kesinliğini kalibre eder.

**14b — `decodeOptions` kanalının ŞEKLİ.** Brief tek bir
`packetInterpretation: raw|cto|dto` kanalı öngörüyordu. Kaynak taraması bunu
çürüttü: CTO/DTO ayrımı PID baytının SAYISAL ARALIĞINDAN çerçeveden zaten
çıkıyor; asıl belirsizlik `role`dür (AYNI 0xFF baytı hem CONNECT hem RES).
Kanal `role` + `byteOrder` olarak açıldı.

**14b — "byte order ilk sürümde açılmasın, A2L'den gelir".** YANLIŞ. Byte
order CONNECT yanıtının `comm_mode_basic` bayrağından müzakere edilir (Scapy ve
pyxcp aynı `INTEL=0/MOTOROLA=1` kodlamasını taşıyor) ve HER çok baytlı alanı
etkiler; kanal AÇILDI.

**14c — CCP için "kaynak yetersiz, `partial` kalabilir" kötümserliği.** ÇÜRÜDÜ.
İki bağımsız açık kaynak uygulama komut ve hata tablolarında 28/28 ve 18/18
örtüştü; kayıt `ready` oldu.

**14e — FlexRay Header CRC'sinin kapsamı.** Brief CRC'nin "gösterge bitlerini"
de kapsadığını varsayıyordu; YANLIŞ — yalnız Sync Frame Indicator ve Startup
Frame Indicator girer. Ayrıca brief "katalogda İKİ yeni CRC girdisi" diyordu,
gerçekte ÜÇ gerekti: kanal A ve kanal B aynı polinomu farklı `init` ile
kullanıyor.

**14f — `canParse`in naif imzası.** Yalnız `pulses[0]`a bakan ilk sürüm 761
örnek çerçevenin 413'ünü (%54) yanlış pozitif kabul etti. Ölçüm bir defalık
düzeltme olarak kalmadı, KALICI BİR TESTE dönüştü ve 14g/14h onu devraldı.

**14h — "spec bu kayıt için doğrulanmış tek bir sayısal fixture VERMİYOR".**
ÇÜRÜDÜ, hem de dalganın en güçlü doğrulamasıyla. PSI5 Association spec'i kayıt
duvarının arkasında olsa da İKİ SATICI kendi veri sayfasında YAYIMLANMIŞ CRC
test vektörü veriyor: NXP MMA51xxKW'nin dokuz 10-bit vektörü ve Infineon
KP405'in `0xAD2C → 0b100` 16-bit örneği. Onu da ayrıca Infineon'un AURIX kod
örneği çalışılmış bir parite/LSB-first fixture'ıyla (`0001110000` → `RD = 0x38`)
destekliyor. **Sonuç: brief'in "PSI5 için (a) yolu — `partial` + `calculatorIds`,
motor YOK" önerisi uygulanmadı; kayıt gerçek bir motorla, GERÇEKTEN doğrulanan
CRC ve parite ile `partial` oldu.** Ders: "spec kapalı" ile "sayı bulunamaz"
aynı şey değildir — kapalı spec'in sayıları satıcı belgelerinde yaşar.

**14h — `decodeOptions` listesinin içeriği.** Alt brief `applicationProfile`ın
`airbag | chassis-safety | powertrain` preset'leri taşıyacağını varsayıyordu.
Üçü de ÇÜRÜDÜ: (a) resmî üçüncü profil adı **"vehicle dynamics control"**,
"chassis & safety" resmî ad DEĞİL (DigiKey soyundan geliyor); (b) üç substandard
belgesinin HİÇBİRİ kamuya açık değil ve base standard onları KASITLI olarak
dışarıda bırakıyor, dolayısıyla **hiçbir preset gönderilemedi** — profil yalnız
metadata; (c) `syncMode`un `auto` şıkkı İMKÂNSIZ çıktı: sync/async ayrımı
çerçevede hiçbir bitle temsil edilmiyor, ECU'nun GERİLİM darbesiyle yapılıyor.
Onun yerine spec'in KENDİ beş harfli mod taksonomisi (`A/P/U/D/V`) kullanıldı.

**14h — `dataBitCount` tek başına yetmez.** Alt brief yalnız veri bit sayısını
sayıyordu; Infineon iLLD `crcOrParity[slot]` ile parity/CRC seçiminin de SLOT
BAŞINA yazmaç olduğunu, yani telden çıkarılamadığını kanıtladı. `errorCheck`
kanalı bu yüzden eklendi.

**14h — spec özetinin "Sensor Address" analyzer alanı** (`04-otomotiv.md:173`)
yukarı yön çerçevesinde YOKTUR. Kimlik zaman slotuyla belirlenir; çerçevede
sensörü tanımlayabilecek tek şey OPSİYONEL `Frame Control` alanıdır ve genişliği
yapılandırmadan gelir.

## Kaynak satır haritası (spec `04-otomotiv.md`)

can-2-0a `:5-22` (ready) · can-2-0b `:23-32` (ready) · can-fd `:33-46` (ready) ·
can-xl `:47-59` (ready) · j1939 `:60-93` (ready) · canopen `:94-109` (alias→ready) ·
lin `:110-125` (ready) · **flexray `:126-144`** · **sent `:145-158`** ·
**spc `:159-168`** · **psi5 `:169-182`** · **k-line `:183-190`** ·
iso-9141 `:191-200` (partial) · iso-14230 `:201-214` (partial) · iso-tp `:215-239`
(ready) · uds `:240-276` (ready) · obd-ii `:277-304` (partial) · doip `:305-320`
(ready) · **automotive-ethernet `:321-332`** · **some-ip `:333-346`** ·
**xcp-on-can `:347-362`** · **xcp-on-ethernet `:363-376`** · **ccp `:377-390`** ·
**sae-j1850-pwm `:391-404`** · **sae-j1850-vpw `:405-414`** ·
Ortak Automotive Network Analyzer `:415-503` · Dikkat çekenler `:504-518`.

Domain geneli araçlar (kayıt başına değil, ileride ayrı iş — dalga 12/13'ün aynı
sınıftaki kararı): ECU/Node Explorer, Network Matrix, Period Analysis, Missing Message
Detector, Counter Analysis, Rolling Counter/Alive Counter, Application CRC/E2E,
DBC/A2L/LDF/EDS Integration, Diagnostic Timeline, Gateway Correlation, Multi-Bus Time
Correlation, Trigger sistemi, Otomatik Hata Korelasyonu (`:415-503`).

**Spec'in kendi uyardığı üç tuzak, bu dalgada geçerli:**
- *"CAN Frame CRC ≠ Application E2E CRC"* (`:509`) — `diagnostics` sekmesi ikisini AYRI
  raporlamak zorunda; XCP/CCP'nin E2E'si CAN çerçeve CRC'siyle karıştırılmayacak.
- *"K-Line ≠ KWP/UDS/OBD"* (`:508`) — 14a'nın tüm gerekçesi bu.
- *"Zamanlama sabitleri evrensel değildir"* (`:512`) — 14f/14g/14h'in `decodeOptions`
  gerekçesi bu.

Bağlam: [[alp-comm-dalga13-industrial]], [[alp-comm-dalga12-network]]. **Bu dalga
2026-08-24'te TAMAMEN KAPANDI** (14a-14h, 12 kanonik kayıt; kapanış özeti
`docs/plan-fazlar.md`de). Yukarıdaki keşif metni tarihsel olarak korunuyor;
yanlış çıkan öngörüler "Çürüyen tahminler" bölümünde işaretli.
