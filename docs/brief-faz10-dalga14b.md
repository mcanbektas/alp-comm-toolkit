# BRİF — Faz 10 dalga 14b, `xcp-on-can` (uygulamaya hazır)

## Bu dosyanın rolü

Ana brif (`docs/brief-faz10-dalga14.md`) **bulgu 2 ve 3**'ünü uygulamaya çevirir.
Bu alt dalga **iki dosya doğurur**: taşıyıcıdan bağımsız `xcpPacket.ts` çekirdeği ve
onu CAN üzerinden tüketen `xcpOnCan.ts`. 14c bu çekirdeği İKİNCİ KEZ tüketecek —
**sıra önemlidir, çekirdek burada doğar.**

Emsal: dalga 13d'nin `cipCore.ts` + `ethernetip.ts` + `devicenet.ts` üçlüsü ve dalga
12c'nin `dnsWire.ts` + `dns.ts` + `mdns.ts` üçlüsü. İkisi de "önce çekirdek, sonra
taşıyıcılar" sırasıyla yürüdü ve sorun çıkmadı.

## Girdi sözleşmesi — TARTIŞMAYA KAPALI

**Girdi 16 baytlık SocketCAN klasik çerçevesidir**, çıplak XCP paketi değil.

Depoda bu üç dosyayla kanıtlı ve üçü de AYNI beş sembolü alıyor:

| Dosya | Satır |
|---|---|
| `automotive/isotp/isotp.ts` | `:49-55` |
| `automotive/j1939/j1939.ts` | `:57-64` |
| `industrial/devicenet/devicenet.ts` (cross-domain) | `:71-77` |

```ts
import { buildCanClassicFrame } from '../can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../can/canFrame';
```

`devicenet.ts:6-9` kuralı yazılı hale getirmiş: *"CAN veri-bağı motoru İKİNCİ KEZ
YAZILMADI — `canopen.ts:57`in `automotive/can/canClassic`i PAYLAŞMA emsali BİREBİR
izlendi."* **İkinci bir CAN çözücü YAZILMAYACAK.**

CAN FD desteği: spec (`:349`) XCP'nin CAN FD üzerinden de koştuğunu söylüyor.
`canFd.ts` ayrı bir çerçeve uzunluğu (`CAN_FD_FRAME_LENGTH = 72`, `canFrame.ts:66`) ve
DLC tablosu (`CAN_FD_DLC_LENGTHS`, `:114`) taşıyor. **İlk sürümde klasik CAN yeterli;
FD'yi girdi uzunluğundan ayırt et ve desteklenmiyorsa açık uyarı bas** — sessizce
yanlış çözme.

## `xcpPacket.ts` — çekirdeğin sınırı NEREDE biter

**Çekirdeğe girer:** PID (paket kimliği) çözümü, komut kodu → ad tablosu, yanıt/hata/
olay/servis ayrımı, hata kodu tablosu, komut parametrelerinin yapısal bölünmesi
(`SET_MTA`nın adres + adres uzantısı gibi).

**Çekirdeğe GİRMEZ:** CAN kimliği, Ethernet `LEN`/`CTR` başlığı, çerçeve uzunluğu
denetimi. Bunlar taşıyıcının işidir — `cipCore.ts`in imzası
(`decodeCipMessage(data, start, end, fields)`) tam olarak bu ayrımı taşıyor ve
**birebir emsal alınmalı**: çekirdek bir `Uint8Array` + aralık + `fields` dizisi alır,
kendi `ParseResult`unu üretmez.

**A2L'siz çözülemeyen her şey HAM kalır + uyarılır.** Spec `:359`'un "A2L varsa →
EngineSpeed: 1498 rpm" örneği A2L olmadan üretilemez; DTO yükü sahte alanlara
BÖLÜNMEZ (dalga 13 dersi 4: PROFINET çevrimsel I/O, IO-Link Process Data aynı sınıf).

## Kaynak durumu — DOĞRULAMA ZORUNLU

Spec özeti (`04-otomotiv.md:347-362`) şunları **VERİYOR**: XCP'nin bus-bağımsız
olduğu, güncel sürümün **1.5.0** olduğu, CTO/DTO ayrımı, komut ADLARI
(`CONNECT`, `GET_STATUS`, `SET_MTA`, `UPLOAD`, `DOWNLOAD`), DAQ/ODT/Event Channel
kavramları, işlem ağacı (`CONNECT → SET_MTA → UPLOAD → Modify → DOWNLOAD`).

**VERMİYOR**: hiçbir komut kodunun SAYISAL değerini, PID uzayının bölünmesini, hata
kodlarını, paket başlığının bayt genişliklerini.

ASAM MCD-1 XCP spec'i **üyelik/ücret arkasındadır ve bu depoda YOKTUR** — dalga 5'in
"lisanslı standart, satın alınmaz" kararı geçerli.

**Uygulayan model, tek bir sayısal sabiti koda yazmadan önce en az İKİ BAĞIMSIZ
kamuya açık kaynakla çapraz doğrular** (ör. bir Wireshark XCP dissector kaynağı,
tanınmış bir açık kaynak XCP kütüphanesi, ASAM'ın kamuya açık tanıtım belgeleri).
`dali.ts:10-45` ve `doip.ts` üç-kaynak yöntemi tonu emsaldir; **kod KOPYALANMAZ**,
yalnız dokümante edilmiş sabitler referans alınır (`iec104.ts`in lib60870/GPLv3
emsali).

**İki kaynak aynı sayıyı aynı adla vermiyorsa o alan ADLANDIRILMAZ, ham kalır.**
Dalga 13 dersi 5: bir iddia iki bağımsız KODLA çelişiyorsa reddet ve gerekçeyi dosya
başına yaz.

## `decodeOptions` — bu kaydın kaçınılmaz kanalı

**Bir XCP paketinin CTO mu DTO mu olduğu ÇERÇEVEDEN ÇIKMAZ.** Ayrım, A2L'de
yapılandırılmış CAN ID ayrımından gelir; aynı bayt dizisi bir CAN ID'de komut, başka
bir CAN ID'de ölçüm akışıdır. Tahmin etmek uydurmaktır.

`devicenet.ts:130-145`in `payloadInterpretation` kanalıyla **aynı gerekçe sınıfı ve
aynı varsayılan**:

```ts
const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: 'packetInterpretation',
    label: 'protocol.xcp.option.packetInterpretation',
    kind: 'select',
    defaultValue: 'raw',          // ← devicenet'in raw varsayılanı birebir
    description: 'protocol.xcp.option.packetInterpretation.description',
    choices: [ /* raw | cto | dto */ ],
  },
];
```

**Bu, automotive domain'inde `decodeOptions` kanalını AÇAN ilk kayıttır.** Bugün
hiçbir automotive plugin'i bildirmiyor (`canClassic.ts:132`'deki `decodeOptions` bir
YEREL DEĞİŞKEN ADI — sahte dost, plugin kanalı değil).

İkinci aday: **byte order / address granularity**. İkisi de A2L'den gelir. Kanal
şişirmemek için ilk sürümde AÇMA — CTO/DTO ayrımı olmadan zaten hiçbir alan
üretilemiyor, ötekiler onun ardından gelir. Gerekirse 14c'de eklenir.

## Uygulama görevleri

1. `src/protocols/automotive/xcp/xcpPacket.ts` — çekirdek, `ParseResult` ÜRETMEZ,
   `fields` dizisine yazar. Dosya başında kaynak uyarısı + iki bağımsız kaynağın URL'si.
2. `src/protocols/automotive/xcp/xcpPacket.test.ts` — komut tablosunun her satırı için
   fixture; **CRC/kod hesaplayan hiçbir şey yok, tablo doğrulaması var.**
3. `src/protocols/automotive/xcp/xcpOnCan.ts` — SocketCAN girdisi, `decodeCanId`,
   `decodeOptions`, `xcpPacket` çağrısı, `xcpOnCanPlugin` + `xcpOnCanParser` +
   `EXAMPLE_FRAMES` (`buildCanClassicFrame` ile üretilir).
4. `xcpOnCan.test.ts` — girdi uzunluğu sınırları, CAN FD reddi/uyarısı, üç
   `packetInterpretation` şıkkının farklı alan tablosu ürettiği.
5. `src/protocols/index.ts` — `registerOnce(registry, 'xcp-on-can', …)` + üstüne
   ne paylaşıldığını söyleyen yorum (`index.ts:331-335` DeviceNet yorumu emsal).
6. `src/app/catalog/domains/automotive.ts:731` — `status: 'ready'`,
   `pluginId: 'xcp-on-can'`. `definitions: ['a2l']` **KALIR** ama A2L ayrıştırıcısı
   YAZILMAZ (aşağı bak).
7. `src/translations/en.ts` + `tr.ts` — `protocol.xcp.*` anahtarları, İKİSİNE DE.
8. `e2e/xcp-on-can-decode.spec.ts` — `devicenet-decode.spec.ts` birebir emsal
   (o da `decodeOptions` şıkkının alan tablosunu değiştirdiğini kanıtlıyor).

### A2L: panel YOK, bu meşru

`DEFINITION_FORMATS` (`app/catalog/types.ts:51`) `a2l` içeriyor ama depoda yalnız İKİ
tanım paneli var (`DbcPanel`, `EdsPanel`). `lin` kaydı `definitions: ['ldf']` bildirip
`ready` olmuş (`automotive.ts:296`) — **panelsiz tanım bildirimi bu domain'de zaten
emsal ve `ready` engellemiyor.** Sekme "planlandı" bildirimi basar, CLAUDE.md bunu
meşru sayar. **A2L ayrıştırıcısı yazmak AYRI ve BÜYÜK iştir, bu dalganın kapsamı
değildir.**

## Devralınan tuzaklar

- **`ParsedField.id` her alan için KENDİ offset'ini kullanır**, fonksiyonun aldığı sabit
  base offset'i değil. `ftp.ts`de (12h) ve `rtcp.ts`de (12g) İKİ KEZ yakalandı;
  `xcpPacket.ts` birden çok alan push eden bir fonksiyon olduğu için **üçüncü vaka
  adayı tam olarak burasıdır.**
- **`unit` fiziksel değere YAPIŞTIRILIR** (`formatPhysicalCell`). Zaten biçimlenmiş bir
  `physicalValue`ya `unit` verme.
- **Motorlar zincir KURMAZ** — ama `decodeOptions` arkasında OPT-IN zincir meşru
  (bulgu 5). XCP'de zincirlenecek bir alt protokol yok; kural yalnız "DTO yükünü A2L
  varmış gibi çözme" olarak geçerli.
- **CCP'yi buraya karıştırma.** XCP **CTO/DTO**, CCP **CRO/DTO** (`:353` vs `:383`) ve
  komut kümeleri ayrışır. 14c'de AYRI dosyaya yazılacak — `mqtt.ts` / `mqttSn.ts`
  ayrımının (12f) aynı gerekçesi.

## Model/effort önerisi

**Sonnet · high.** Paylaşım kanıtlı ve tarif net, ama `xcpPacket.ts`in taşıyıcıdan
ayrılma sınırı bir TASARIM kararıdır (imza `cipCore.ts`ten alınacak ama XCP'nin PID
uzayı CIP'inkinden farklı şekillenir) ve kaynak doğrulaması muhakeme ister. Mekanik
üretim değil.

**Tamamlanma ölçütü:** `xcp-on-can` `ready` rozetiyle açılıyor, `decodeOptions` formu
panelde görünüyor ve şık değişimi alan tablosunu değiştiriyor, `xcpPacket.ts` 14c'nin
tüketebileceği biçimde dışa açık, birim + e2e + build yeşil.

**KAYIT KAYIT bitir** (dalga 13 dersi 7): çekirdek + taşıyıcı + çeviri + test + e2e
biri bitmeden diğerine geçme.
