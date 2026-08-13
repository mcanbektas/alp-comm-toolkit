# ALP Comm Toolkit

Haberleşme protokolleri için analiz, çözümleme ve protokol geliştirme ortamı. Seri
porttan CAN'a, Modbus'tan MAVLink'e kadar 8 alanda 172 protokolü tek çatı altında
toplar; ham baytı çerçeveye, çerçeveyi mühendislik değerine çevirir.

ALP süitinin üç ürününden biri. Hesap, veritabanı, API ve dağıtım
[alp-platform](https://github.com/mcanbektas/alp-platform) deposundadır.

> **Durum: Faz 2 — iskelet.** Navigasyon, tip sözleşmesi ve görüntüleyici çekirdeği
> ayakta; protokol motorları (CRC, framing, parser'lar, Web Serial) henüz yazılmadı.
> Katalogdaki 172 kaydın tamamı `planned` durumunda. Yol haritası aşağıda.

## Özellikler

- **172 protokol, 8 alan, 54 aile** — gezilebilir katalog, alan/aile/protokol kırılımı,
  global arama ve derin bağlantı.
- **Protocol Core** — bütün parser ve encoder'ların uyacağı tek sözleşme
  (`RawFrame` → `ParsedFrame` → `ParseResult`) ve tembel yüklenen eklenti kaydı.
- **ByteViewer** — ham baytları HEX + ASCII olarak, alan renklendirmesi ve hatalı
  alan vurgusuyla gösterir.
- **İki dil** — arayüz Türkçe açılır, İngilizceye geçilebilir; eksik çeviri anahtarı
  derleme hatasıdır.
- **İki tema** — açık ve koyu; `@mcanbektas/design` token'larından beslenir, sistem
  tercihine düşer.
- **Veriler yerelde kalır** — seri port trafiği, loglar, protokol tanımları ve
  anahtarlar sunucuya gönderilmez.

## Desteklenen protokoller

| Alan | Aile | Protokol | Örnekler |
|---|---:|---:|---|
| Interfaces & Framing | 5 | 40 | UART · RS-485 · SPI · I²C · USB · HDLC · COBS · AT |
| Industrial Automation | 8 | 25 | Modbus · PROFIBUS · PROFINET · EtherCAT · OPC UA · IEC 61850 |
| Automotive | 7 | 25 | CAN FD · J1939 · LIN · UDS · OBD-II · DoIP · SOME/IP · XCP |
| Marine & Navigation | 5 | 11 | NMEA 0183 · NMEA 2000 · AIS · RTCM · SeaTalk |
| Aerospace & UAV | 6 | 16 | MAVLink · DroneCAN · CRSF · ARINC 429 · MIL-STD-1553 · ADS-B |
| Building Automation | 7 | 11 | BACnet · KNX · DALI · M-Bus · DMX512 · sACN |
| Network & Ethernet | 8 | 28 | IPv4/IPv6 · TCP/UDP · DNS · PTP · HTTP · MQTT · CoAP |
| Wireless & IoT | 8 | 16 | BLE · Zigbee · Thread · Matter · LoRaWAN · ESP-NOW · NB-IoT |
| **Toplam** | **54** | **172** | |

172 sayısı **kasıtlı tekrarları** içerir: CANopen, Modbus, M-Bus, MQTT, CoAP, RTCM ve
NMEA birden çok alan sayfasında ayrı çalışma alanı olarak görünür. Tekrar eden kayıt
`aliasOf` ile kanonik kaydı gösterir.

## Mimari

```
src/
  app/            router · providers · store · catalog (8 domain veri dosyası)
  components/     byte-viewer · layout · navigation · packet-viewer · charts …
  connection/     serial · usb · bluetooth · websocket · file · mock
  protocol-core/  tipler · registry · streams · framing · checksums · timing …
  protocols/      alan başına protokol eklentileri
  features/       live-monitor · protocol-studio · packet-builder · log-analyzer …
  workers/ translations/ pages/ types/ utils/ tests/
```

**Protokol hesabı React bileşeninin içine yazılmaz.** Ayrıştırma, kodlama, checksum ve
mühendislik hesapları bağımsız saf TypeScript modülleridir; bileşen yalnız gösterir.
Testlerin tarayıcısız koşabilmesinin ve motorların yeniden kullanılabilmesinin sebebi bu.

Katman ayrımı: `protocol-core` katalogtan, katalog da bileşenlerden habersizdir.
Bağımlılık tek yöne akar.

## Kurulum

Ön koşul: Node 22+, ve `alp-platform` deposunun **kardeş dizinde** olması —
tasarım token'ları oradan `file:` bağıyla geliyor (paket henüz yayınlanmadı).

```bash
git clone https://github.com/mcanbektas/alp-platform.git
git clone https://github.com/mcanbektas/alp-comm-toolkit.git
cd alp-platform/design && npm ci && npm run build   # token CSS'i dist/'e üretir
cd ../../alp-comm-toolkit && npm install
```

## Geliştirme

```bash
npm run dev          # http://localhost:3001
npm run typecheck    # tsc --noEmit
npm test             # vitest run — 92 birim testi
npm run build        # tsc --noEmit && vite build
npx playwright test  # gerçek tarayıcıda duman testi
```

Port 3001'dir ve değişmez: PCB Toolkit 3000'i tuttuğu için ikisi aynı anda koşabilsin
diye ayrıldı. `/api` istekleri `localhost:5289`e vekillenir; platform API'si koşmuyorsa
uygulama açılır ama kimlik uçları sessizce 404 döner.

## Test

Üç katman, üçü de farklı bir soruya cevap verir:

| Katman | Araç | Neyi kanıtlar |
|---|---|---|
| Birim | Vitest | Saf mantık: katalog grafiği bütünlüğü, registry değişmezleri, ByteViewer yerleşimi, çeviri eşliği |
| Bileşen | Vitest + Testing Library | Rotalar doğru sayfayı basıyor, dil değişimi metni değiştiriyor |
| Duman | Playwright + Chromium | Uygulama **gerçekten açılıyor**: token'lar uygulanmış, konsol temiz, 360px'te taşma yok |

jsdom CSS'i hiç değerlendirmez — yani "birim testler yeşil" boş bir sayfayı da yeşil
gösterir. Playwright katmanı bu boşluğu kapatmak için var, süs değil.

Doğrulanmış referans değerler spec §43'ten alınır ve motorlar yazıldıkça fixture olarak
kullanılır: CRC (`123456789` → `0xF4` / `0x29B1` / `0x4B37` / `0xCBF43926`), UART timing
(115200 8N1, 20 bayt ≈ 1.736 ms), Modbus RTU (`01 03 00 00 00 02 C4 0B`), J1939
(`0x18F00401` → PGN 61444), IEEE-754 (25.75 → `41 CE 00 00`).

## Yeni protokol eklemek

1. **Kataloga yaz** — `src/app/catalog/domains/<alan>.ts` içine kaydı ekle. Aile ve
   protokol id'leri rota segmentidir, sonradan değiştirmek bağlantıları kırar.
2. **Motoru yaz** — `src/protocols/<alan>/<protokol>/` altında `ProtocolParser`
   uygulaması, saf TypeScript. Bileşen import etme.
3. **Fixture'ını yaz** — spec özetinde o protokol için verilmiş örnek çerçeveyi test
   haline getir. Fixture'sız parser kabul edilmez.
4. **Eklentiyi kaydet** — `registerProtocolPlugin(id, () => import('...'))`. Kayıt
   tembeldir; modül ancak kullanıcı o sayfayı açtığında yüklenir.
5. **Katalog kaydını bağla** — `pluginId` ver, `status`'ü `'partial'` ya da `'ready'`
   yap.

Protokolün alan kırılımları, formülleri ve örnek çerçeveleri
`docs/spec/ozet/` altındaki özet dosyalarındadır. Önce onu oku.

## Protokol tanım biçimi

Kullanıcı kendi protokolünü JSON şemasıyla tanımlar (Protocol Studio, Faz 7):

```json
{
  "name": "ALP Sensor Protocol",
  "framing": { "type": "startEnd", "startBytes": [170], "endBytes": [85] },
  "fields": [
    { "id": "address", "name": "Device Address", "type": "uint8", "byteOffset": 1, "length": 1 },
    { "id": "payload", "name": "Payload", "type": "rawBytes", "byteOffset": 4, "lengthFrom": "payloadLength" },
    { "id": "checksum", "type": "checksum", "algorithm": "xor8",
      "coverage": { "startField": "address", "endField": "payload" } }
  ]
}
```

Fiziksel değer dönüşümü `Physical = Raw × Scale + CalibrationOffset`. Spec'te "Offset"
adı iki farklı şeyi anlatıyor — çerçevedeki bayt konumu ve kalibrasyon sabiti; kodda
`byteOffset` ve `calibrationOffset` olarak ayrıldılar.

## Web Serial kullanımı

Canlı monitör `/live-monitor` adresindedir ve iki kaynakla çalışır.

**Simülasyon (donanım gerekmez).** Varsayılan kaynak. Spec §8.3'ün kanonik
çerçevesini (`AA 05 10 06 …`) üretir; parçalı chunk, bozuk checksum ve çöp bayt
da üretir, yani çerçeveleme ve hata kurtarma gerçekten sınanır. Uçtan uca
tarayıcı testleri de bu kaynağı kullanır.

**Web Serial (gerçek cihaz).** Gereksinimler:

- Chromium tabanlı tarayıcı (Chrome, Edge, Opera). Firefox ve Safari Web Serial
  desteklemez — bu durumda düğme kapalı kalır ve ekran sebebini yazar.
- **Güvenli bağlam**: `https://` ya da `http://localhost`. Ağdaki bir makineye
  düz `http` ile bağlanırsanız `navigator.serial` tanımsızdır.
- Portu tarayıcı seçtirir; **kullanıcı jesti** olmadan açılamaz (spec §41).

```
Kaynak: Web Serial → Baud/veri biti/parity/akış denetimi → Bağlan → port seç
```

Ayarlar spec §8.1 listesidir: baud (300…2 000 000 ve serbest giriş), veri biti
(7/8), stop biti (1/2), parity, akış denetimi, arabellek boyutu.

Çerçeveleme hazır ayarlardan seçilir: simülasyon telemetrisi (uzunluk alanı),
satır sonu (CR LF), Modbus RTU (sessiz aralık + CRC16/MODBUS), SLIP, COBS.
Doğrulama algoritması ayara bağlıdır; genişliği algoritmadan türetilir.

Kayıtlar CSV, JSON ve TXT olarak indirilebilir. **Dosya tarayıcıda üretilir,
hiçbir bayt sunucuya gitmez.**

### Yerel bridge kullanımı

Henüz yok. Web Serial'i olmayan tarayıcılar ve TCP/UDP kaynakları için yerel
bir agent (WebSocket köprüsü) sonraki fazlarda gelecek; `src/connection/`
altındaki `websocket/` klasörü aynı `ByteSource` sözleşmesini gerçekleyecek.

## Güvenlik ve gizlilik

- Seri port mesajları, CAN logları, ağ paketleri, protokol tanımları ve şifreleme
  anahtarları **sunucuya gönderilmez**; işlem tarayıcıda yapılır.
- `eval` ve dinamik kod çalıştırma yasak — kullanıcı tanımlı formül özelliği
  sandbox'sız yazılamaz.
- Port yalnız kullanıcı izniyle açılır (Web Serial'in kendi izin akışı).
- LoRaWAN ve benzeri anahtarların kalıcı saklanması varsayılan olarak kapalıdır.

## Yol haritası

| Faz | İçerik | Durum |
|---|---|---|
| 2 | İskelet: katalog, protocol-core, i18n, ByteViewer, routing | ✅ |
| 3 | Platform tarafında `Comm` API modülü ve `comm` DB şeması | sırada |
| 5 | Byte utils, conversion engine, CRC engine, timing hesapları | ✅ |
| 6 | Stream buffer, framing engine (15 yöntem), parser state machine, Worker | ✅ |
| 8 | Live Serial Monitor: Web Serial, ring buffer, grafik, istatistik | ✅ |
| 7 | Custom Protocol Studio + Packet Builder, kod üreticiler | atlandı, geri dönülecek |
| 9 | İlk protokoller: Modbus, NMEA 0183, CAN, DBC, J1939 | |
| 10+ | Kalan protokol dalgaları | |

## Lisans

Özel. ALP süiti dahili ürünüdür.
