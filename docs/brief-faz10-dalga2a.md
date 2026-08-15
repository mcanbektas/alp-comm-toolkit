# BRİF — Faz 10 dalga 2a, DoIP (uygulamaya hazır)

## Bu dosyanın rolü

`docs/brief-faz10-dalga2.md`nin (dalga 2 ana brifi) 2a bölümünü ve "Verilmesi gereken
kararlar #1"i **kapatır**. Ana brif hâlâ geçerli — konum, durum, raylar, tuzaklar,
çalışma kuralları oradan okunur. Bu dosya yalnız DoIP'in payload tipi kapsamını
somutlaştırır; kod yazacak model önce ana brifi, sonra bunu okur.

**Karar zinciri (bu oturumda çıktı):** "hangi payload tipleri alan alan çözülür"
sorusu A/B ikilemi olarak soruldu (yapısal dördü tam / yalnız header+diag tam),
ama bu sahte bir kapsam sorusuydu — DoIP'in payload tipi listesi ~16 kayıt ve
neredeyse tamamı 0-17 baytlık sabit uzunluklu alan. Gerçek ayrım tip sayısı değil,
**sınıf**:

- **Yapısal alan düzeni** (ISO 13400-2'nin sabit offset'leri, enum kodları dahil) →
  çözülür, dış kaynak + dosya başı kaynak uyarısı. Payload tipi adları ve NACK/
  routing-activation-response kodları da bu sınıf — küçük sabit enum'lar, lookup
  DB değil.
- **Lisanslı kod→anlam lookup'ı** (J1939 SPN, OBD PID emsali) → DoIP'te YOK, bu
  motor için hiç gündeme gelmiyor.
- **UDS payload'ı** → dalga 1 kararı değişmedi: Diagnostic Message içindeki UDS
  kısmı HAM kalır + "UDS sayfasında çözülür" uyarısı.

VIN/EID/GID gibi alanlar da bu yüzden çözülür: bayt aralığını alan adına
ayırmak (VIN = bayt 0-16) lookup değil, yapısal bölme — CiA 301 COB-ID emsaliyle
aynı sınıf. VIN'i çözüp "bu araç X marka" demiyoruz, ham string olarak veriyoruz.

**Sonuç: `status: 'ready'`.** B (partial) değil, A'nın genişletilmiş hâli de değil —
tek bildirimsel tablo, tüm tipler kapsanır.

## Kaynak uyarısı — DOĞRULAMA ZORUNLU

Aşağıdaki payload tipi listesi ve alan düzenleri eğitim verisinden hatırlanıyor,
projenin `docs/spec/` dosyasından DEĞİL (ana brif zaten bu bölümde spec'in sıfır
verdiğini kanıtladı). ISO 13400-2 halka açık biçimde birçok bağımsız kaynakta
(Wireshark DoIP dissector, açık kaynak DoIP istemci/sunucu implementasyonları)
tekrarlanan, yaygın bilinen bir tablo — ama bayt-genişliği veya alan sırasında
hafıza hatası riski var, özellikle revizyonlar arası fark (2010/2012/2019).

**Kod yazan model, ExampleFrame'leri sabitlemeden önce en az bir bağımsız açık
kaynakla (ör. bir DoIP Wireshark dissector kaynağı, tanınmış açık kaynak DoIP
kütüphanesi) bu tabloyu çapraz kontrol eder.** Bu, LIN checksum'ın motor +
testin bağımsız ikinci hesabıyla kanıtlanması kuralının burdaki karşılığı —
burada "ikinci hesap" yok, "ikinci kaynak" var. Sapma bulunursa bu tablo
düzeltilir, körlemesine uygulanmaz.

## Payload tipi tablosu

Generic header (8 bayt, her mesajda sabit): protocol version (1) + inverse
version (1, `version ^ 0xFF` doğrulanır) + payload type (2, büyük uçlu) +
payload length (4, büyük uçlu, **`>>> 0` ile işaretsiz oku** — noUncheckedIndexedAccess
+ 32-bit işaretli JS operatör tuzağı, ana brifte de var).

| Kod | Ad | Payload alanları |
|---|---|---|
| `0x0000` | Generic NACK | NACK code (1) — 0x00 format hatalı, 0x01 bilinmeyen tip, 0x02 mesaj çok büyük, 0x03 bellek yetersiz, 0x04 geçersiz uzunluk |
| `0x0001` | Vehicle Identification Request | (boş) |
| `0x0002` | Vehicle Identification Request (EID ile) | EID (6) |
| `0x0003` | Vehicle Identification Request (VIN ile) | VIN (17, ASCII) |
| `0x0004` | Vehicle Announcement / Identification Response | VIN (17) + Logical Address (2) + EID (6) + GID (6) + Further Action (1) + [opsiyonel] VIN/GID Sync Status (1) |
| `0x0005` | Routing Activation Request | Source Address (2) + Activation Type (1) + Reserved-ISO (4) + [opsiyonel] Reserved-OEM (4) |
| `0x0006` | Routing Activation Response | Tester Logical Address (2) + Entity Logical Address (2) + Response Code (1) + Reserved-ISO (4) + [opsiyonel] Reserved-OEM (4) |
| `0x0007` | Alive Check Request | (boş) |
| `0x0008` | Alive Check Response | Source Address (2) |
| `0x4001` | DoIP Entity Status Request | (boş) |
| `0x4002` | DoIP Entity Status Response | Node Type (1) + Max Concurrent Sockets (1) + Currently Open Sockets (1) + [opsiyonel] Max Data Size (4) |
| `0x4003` | Diagnostic Power Mode Request | (boş) |
| `0x4004` | Diagnostic Power Mode Response | Power Mode (1) — 0x00 not ready, 0x01 ready, 0x02 not supported |
| `0x8001` | Diagnostic Message | Source Address (2) + Target Address (2) + UDS payload (kalan, **HAM**) |
| `0x8002` | Diagnostic Message ACK | Source Address (2) + Target Address (2) + ACK code (1) + [opsiyonel] echo |
| `0x8003` | Diagnostic Message NACK | Source Address (2) + Target Address (2) + NACK code (1) + [opsiyonel] echo |

Routing Activation Response code'ları (yapısal enum, çözülür): `0x00` bilinmeyen SA,
`0x01` boş soket yok, `0x02` SA farklı, `0x03` SA zaten aktif, `0x04` yetki eksik,
`0x05` doğrulama reddedildi, `0x06` desteklenmeyen activation type, `0x10` başarılı,
`0x11` onay gerekli.

## Uygulama görevleri

`src/protocols/automotive/doip/` altında, **önce `uds.ts` ve `j1939.ts`yi oku**,
iskeleti birebir kopyala (ana brif "Motor iskeleti" maddesi):

1. Dosya başı JSDoc: kararlar (girdi ham DoIP mesajı, UDS payload'ı ham, tüm
   payload tipleri `ready`) + kaynak uyarısı (ISO 13400-2, dış kaynak, doğrulama
   notu) + tuzaklar (payload length işaretsiz okuma, VIN/GID Sync Status'un
   opsiyonel oluşu).
2. `canParse`: en az 8 bayt (generic header) + inverse version tutarlılığı ucuz
   kontrol.
3. Payload tipi → parse fonksiyonu eşlemesi **tek bildirimsel tablo** (switch
   yığını değil) — yukarıdaki 16 kaydın hepsi, tip eklemek ileride tek satır.
4. Diagnostic Message: SA/TA ayrı `ParsedField`, kalan bayt dizisi ham +
   `doipUdsPayloadNeedsUdsPage` tonunda uyarı anahtarı (isim örnek, çeviri
   tablosuna gerçek anahtar eklenir).
5. `ExampleFrame` seti — 16 tipin hepsini değil, temsili küme: Vehicle
   Announcement (VIN/EID/GID görünür), Routing Activation Request+Response
   çifti (başarılı + bir hata kodu), Diagnostic Message (SA/TA + ham UDS),
   Generic NACK, Alive Check çifti. Her örnek doğrulanmış kaynağa göre elle
   hesaplanır, uydurulmaz (ana brif "Fixture'ı uydurma" kuralı).
6. Kanonik kayda (`automotive/diagnostics/doip`) `pluginId: 'doip'`,
   `status: 'ready'`; `registry.ts` + `src/protocols/index.test.ts` (alfabetik
   listeye `doip` girer, `can-2-0a` ile `canopen` arasına).
7. `e2e/doip-decode.spec.ts` — her örnek + iki dil, ham çeviri anahtarı taraması
   (`/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/`), tireli anahtar yok kontrolü.

## Devralınan tuzaklar (ana briften, DoIP'e özel olanlar öne çıkarıldı)

- `ParsedField` `offset`/`length` zorunlu; `ProtocolErrorCode` kapalı union,
  uyarı kodu serbest string.
- Payload length 4 bayt → JS bit işlemi işaretli 32-bit üretir, `>>> 0` şart.
- Bayt-viewer çakışması: SA/TA (2'şer bayt) payload type ile üst üste binmesin,
  offset'leri payload başlangıcına göre değil TÜM mesaja göre ver.
- Çeviri anahtarı segmentinde tire yok (`routing-activation` değil
  `routingActivation` kalıbı, canopen emsali).
- `buildCanClassicFrame` kullanılmaz, DoIP kendi baytını `new Uint8Array([...])`
  ile kurar (UDS emsali).
- `src/tests/catalog.test.ts` sayıları bekçiliyor — yeni kayıt eklenmez, var
  olan `automotive/diagnostics/doip`e `pluginId`/`status` yazılır.

## Model/effort önerisi

**Sonnet · medium.** Ana brifin "high" gerekçesi ("dış kaynak mı lisanslı mı"
muhakemesi her alanda tekrar ediyor) bu dosyayla kapandı — sınıflandırma
kararı yukarıda net, tablo somut, iskelet kopyalanacak desen. Tek dikkat
noktası kaynak doğrulama adımı (yukarıdaki "DOĞRULAMA ZORUNLU" böl.) — bu
Sonnet'in muhakeme sınıfında, effort'u yükseltmeyi gerektirmiyor, adım adım
talimat zaten burada.
