# BRİF — Faz 10 dalga 14a, `automotive-ethernet` + `k-line` (uygulamaya hazır)

## Bu dosyanın rolü

`docs/brief-faz10-dalga14.md`nin (ana brif) **bulgu 4 ve bulgu 6**'sını, **açık soru 2
ve 3**'ünü kapatır. Ana brif hâlâ geçerli — kapsam, motor envanteri, çalışma kuralları
oradan okunur. Bu dosya iki kaydın uygulama tarifini somutlaştırır.

**Bu alt dalga hiç parser YAZMAZ.** İki kayıt da "tel biçimi bu sayfada yok" sınıfı;
`LoRa paterni` beşinci ve altıncı kez uygulanıyor. Kod yazımı azdır, karar zaten
verilmiştir — bu yüzden dalganın EN BAŞINA kondu.

## Durum kararı (ana brif açık soru 2 + 3)

Her ikisi de **`status: 'partial'`, `pluginId` YOK, `calculatorIds` VAR.**

Emsal beş kez uygulanmış ve hepsi kodda duruyor:

| Kayıt | Dosya | Motor |
|---|---|---|
| `can-phy` | `interfaces-framing.ts:686` | `timing/vehiclePhy.ts` |
| `lin-phy` | `interfaces-framing.ts:718` | `timing/vehiclePhy.ts` |
| `flexray-phy` | `interfaces-framing.ts:741` | `timing/vehiclePhy.ts` |
| `single-pair-ethernet` | `interfaces-framing.ts:656` | `timing/singlePairEthernet.ts` |
| `current-loop` / `4-20 ma` | `registry.ts:80` | `timing/currentLoop.ts` |

`registry.ts:81-83` bu deseni yazılı kural haline getirmiş: *"Araç içi PHY üçlüsü: üç
katalog kaydının decode'u yok, motor burada."*

## `automotive-ethernet` — neden parser YAZILMAZ

Spec'in verdiği stack (`04-otomotiv.md:325`):
`Ethernet → 802.1Q VLAN → IPv4/IPv6 → UDP/TCP → SOME/IP / DoIP / XCP`

Zincirin **yedi halkası da zaten `ready` ve plugin'li** (`network-ethernet.ts`):
`ethernet-ii` · `ieee-802-3` · `vlan-802-1q` · `ipv4` · `ipv6` · `udp` · `tcp`.

Fiziksel taraf da kapalı: `singlePairEthernet.ts:58` `SPE_BIT_RATES` **`100base-t1` ve
`1000base-t1`** değerlerini taşıyor — spec'in bu kayıt için istediği iki PHY sınıfı tam
olarak bunlar. Üst uçlar: `doip` (ready), `some-ip` (14d), `xcp-on-ethernet` (14c).

Yeni bir parser yazmak `ethernetFrame.ts` + `ipv4.ts` + `udp.ts` çözücülerini İKİNCİ KEZ
yazmak olurdu. Katalogdaki geri kalan araçlar (Communication Matrix, Bandwidth, Top
Talkers, Latency/Jitter, Packet Loss) **tek çerçeve çözümü değil analyzer işidir** —
12c'de DNS Transaction Matching, 12d'de PTP δ/θ aynı gerekçeyle analyzer'a bırakılıp
kayıtlar yine `ready`/`partial` kapanmıştı.

### Uygulama

`automotive.ts:675` bloğunda:

- `status: 'planned'` → **`'partial'`**
- `calculatorIds: ['spe-plca']` ekle (mevcut hesap; yeni motor YAZILMAZ)
- `tabs` bugün `['overview','live','decode','timing','data','diagnostics','examples']`
  (`automotive.ts:681`). **`live` ve `decode` ÇIKAR**, `timing` KALIR
  (`ProtocolPage.tsx:433` `timing` sekmesinde `calculatorIds`i basar; `decode`
  sekmesi `pluginId` yokken `protocol.plannedNotice` basar — yanlış vaat)
- `related` listesini **yediye genişlet**: mevcut üçe ek olarak
  `network-ethernet/data-link/ethernet-ii`, `network-ethernet/data-link/vlan-802-1q`,
  `network-ethernet/internet-layer/ipv4`, `network-ethernet/transport/udp`,
  `network-ethernet/transport/tcp`,
  `interfaces-framing/host-network-interfaces/single-pair-ethernet`
- `summary`'yi **neyin nerede çözüldüğünü AÇIKÇA söyleyecek** biçimde güncelle
  (kaynaksız-kayıt politikasının "özet metni neyin çözülüp neyin çözülmediğini açıkça
  yazar" kuralı burada da geçerli)
- Kayıt bloğuna gerekçe yorumu yaz — `single-pair-ethernet.ts:649-655` yorumunun tonu
  emsal

## `k-line` — depo ZATEN karar vermiş

İki motor dosyasının başında birebir yazılı:

> `iso9141.ts:4-7` — *"K-Line'ın fiziksel katmanı (5-baud init, key bytes, hat
> zamanlaması) bir bayt akışı DEĞİLDİR — decoder'a HİÇ girmez (K-Line kararı,
> brief-faz10-dalga2.md: motor ALMAZ, `planned` kalır; init bir bayt akışı değil hat
> olayıdır)."*
>
> `iso14230.ts:5-8` — aynı cümle, "5-baud/fast init" ile.

Dalga 14'ün yaptığı **kararı değiştirmek değil, kaydın rozetini kararla
hizalamaktır**: `planned` "yapılacak iş" demektir, oysa burada yapılacak parser işi
YOK. `partial` + `calculatorIds` doğru rozettir ve domain dürüstçe kapanır.

### Yeni hesap motoru: `protocol-core/timing/kLine.ts`

**Bu alt dalganın TEK yeni kod dosyası.** `vehiclePhy.ts`in dosya başı disiplinini
birebir izler (kaynağın verdiği/vermediği ayrımı yazılır, sabit gömülmez).

Spec'in verdiği (`04-otomotiv.md:183-190`): görünüm alanları (Idle, Initialization,
Request, Response, Inter-byte gap, Inter-message gap) ve üç başlatma sınıfı (5-baud,
Fast, Unknown/OEM). Spec **hiçbir zamanlama sayısı VERMİYOR**.

Hesaplanacaklar — hepsi çağırandan gelen girdiyle, sabit gömmeden:

- **5-baud bit süresi ve toplam adres süresi** — 5 baud tanımın kendisidir
  (1/5 s = 200 ms/bit); karakter uzunluğu `UART_CHARACTER_BIT_TIMES`
  (`vehiclePhy.ts:43`) üzerinden. `calculateUartTiming` (`timing/uart.ts:58`)
  ÇAĞRILIR, ikinci bir UART hesabı YAZILMAZ (`vehiclePhy.ts`in
  `calculateRs485Propagation`ı çağırma emsali).
- **Bayt süresi ve inter-byte gap bütçesi** — verilen baud + çerçeve biçiminden.
- **Inter-message gap / P3 bekleme** — çağırandan gelen değerle bütçe kontrolü.
- **Fast init darbe bütçesi** — Wake-up pattern süresi çağırandan gelir; ISO 14230-2'nin
  25 ms/25 ms değerleri **KODA GÖMÜLMEZ**, `breakBits` kararının aynısı.

**GÖMÜLMEYECEKLER (spec vermiyor, uydurmayın):** 0x33 adres baytı, W1-W5 / P1-P4
zamanlama pencereleri, keyword bayt değerleri. Bunlar istenirse çağıran verir.

### Uygulama

- `src/protocol-core/timing/kLine.ts` + `kLine.test.ts` yaz
- `timing/index.ts`e `export * from './kLine'` ekle
- `features/calculators/registry.ts`e `{ id: 'k-line-timing', category: 'timing', … }`
  ekle (`can-phy-timing` satırının hemen altı, yorumuyla)
- `features/calculators/tools/kLineTools.tsx` — `vehiclePhyTools.tsx` deseni
- `pages/CalculatorPage.tsx` haritasına `'k-line-timing': () => <KLineTool />`
- `automotive.ts:453` bloğu: `status: 'partial'`, `calculatorIds: ['k-line-timing']`,
  `tabs` bugün `['overview','live','decode','timing','diagnostics','examples']`
  (`automotive.ts:459`) —
  **`live` ve `decode` ÇIKAR**, `timing` zaten var ve KALIR;
  `related`e `automotive/diagnostics/uds` ekle
  (spec `:185` K-Line üzerinde UDS'in de koştuğunu söylüyor)
- `translations/en.ts` + `tr.ts`: `calc.kLine.*` anahtarları

## `decodeOptions`

**İkisinde de YOK.** Parser yok, kanal da yok. Bu bir eksik değil, tanımın sonucu.

## Test ve e2e kapsamı

- **Birim:** `kLine.test.ts` — her hesap için en az bir bağımsız ikinci hesapla
  doğrulanmış fixture (LIN checksum kuralı). 5-baud toplam süresi elle hesaplanıp
  yazılır.
- **Katalog testi:** `catalog.test.ts` zaten `pluginId` ve `calculatorIds`
  tutarlılığını sınıyor — `calculatorIds`teki her id `registry.ts`te bulunmalı.
  Yeni id eklenince bu test kendiliğinden kapsar; kırmızı gelirse registry
  eksiktir.
- **e2e (gerçek tarayıcı, ZORUNLU):** `e2e/k-line-calculator.spec.ts` —
  `current-loop-calculator.spec.ts` birebir emsal. Kanıtlanacaklar: (1) kayıt sayfası
  **Kısmi** rozetiyle açılıyor, (2) `timing` sekmesinde hesap aracı görünüyor,
  (3) **`decode` sekmesi YOK** (yanlış vaat yok), (4) `automotive-ethernet` sayfasında
  yedi çapraz bağlantı tıklanabilir.
  `[[ekrani-gercekten-ac]]` — yeşil test + temiz review yetmez, tarayıcı turu şart.

## Devralınan tuzaklar

- **`tabs`ten `decode` çıkarmayı UNUTMA.** `ProtocolPage.tsx:409` `pluginId` yokken
  `decode` sekmesinde "planlandı" bildirimi basar. `partial` rozetiyle "planlandı"
  bildirimi yan yana gelirse kullanıcı çelişki görür.
- **`spe-plca` hesabını KOPYALAMA**, aynı id'yi `calculatorIds`e yaz. İkinci bir
  PLCA/bit-süresi motoru yazmak `vehiclePhy.ts`in "kopyalamak değil, çağırmak"
  kuralını çiğner.
- **`k-line` için parser yazma isteğine direnc göster.** İki motor dosyası bunun
  neden yapılmadığını yazıyor; kararı değiştirmek istiyorsan ana brifin açık soru
  2'sine dön, sessizce parser yazma.
- Çeviri anahtarları **iki dosyaya da** eklenir (`en.ts` 6098 satır, `tr.ts` 6093) —
  biri unutulursa arayüz ham anahtar basar.

## Model/effort önerisi

**Sonnet · medium.** Desen beş kez uygulanmış, tarif net, tek yeni dosya küçük bir
hesap motoru. Muhakeme gerektiren tek yer `kLine.ts`in "neyi gömmeyeceği" — o da bu
brifte listelenmiş.

**Tamamlanma ölçütü:** iki kayıt da `partial` rozetiyle açılıyor, `timing` sekmesinde
hesap çalışıyor, `decode` sekmesi yok, birim + e2e + build yeşil, `legacy-diagnostics`
ve `automotive-ethernet` ailelerinde `planned` kayıt sayısı 1'e (yalnız `some-ip`)
düşüyor.
