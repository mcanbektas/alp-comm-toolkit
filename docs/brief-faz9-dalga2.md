# BRİF — ALP Comm Toolkit, Faz 9 dalga 2 (NMEA 0183) ile devam

## Konum
`~/Desktop/alp-comm-toolkit` — tek çalışılan yer. Kardeş depolar (dokunulmuyor):
`~/Desktop/alp-platform` (tasarım token'ları buradan `file:` ile geliyor),
`~/Desktop/alp-pcb-toolkit`.

## Durum: son commit `1013bbe`, push edildi, çalışma ağacı temiz
- Faz 0-8 tamam. Faz 7 (Studio + Packet Builder + 6 kod üretici) tamam.
- Faz 9 **dalga 1 (Modbus) tamam** — bu brifin dayandığı iş.
- **1657 birim testi (102 dosya), 43 Playwright testi, `tsc --noEmit` temiz, build çalışıyor.**

## Dalga 1 ne getirdi — dalga 2'nin üstüne kuracağı ray

Faz 9'un asıl işi decoder yazmak değil, **parser→ekran zincirini kurmaktı**. O zincir artık var:

```
katalog kaydı → resolvePluginId (alias zinciriyle) → registry (lazy import)
              → ProtocolPlugin.parser.parse(bytes) → ParseResult
              → parsedFrameToRegions() → ByteRegion[] → <ByteViewer>
```

Dalga 2'nin dokunacağı hazır parçalar:

- `src/protocols/index.ts` — `registerBuiltInProtocols(registry?)`. Yeni plugin buraya
  **dinamik import** ile eklenir; parser'lar açılış paketine girmemeli. Fonksiyon
  birden çok kez çağrılabilir (StrictMode), `isProtocolRegistered` ile atlıyor.
- `src/protocols/pluginBinding.ts` — `resolvePluginId(protocol, catalog?)` ve
  `resolveStatus(protocol, catalog?)`. İkisi de alias zincirini kanonik kayda kadar iner.
- `src/features/protocol-decode/DecodePanel.tsx` — `{ pluginId: string }` alır, gerisini
  kendi yapar. **Yeni protokol için UI YAZILMASI GEREKMİYOR.**
- `src/pages/ProtocolPage.tsx` — decode sekmesi `resolvePluginId` null dönerse eski
  "planlandı" bildirimini basar, doluysa `<DecodePanel>` çizer.
- `src/protocols/industrial/modbus/` — **kopyalanacak desen.** Ortak PDU çekirdeği +
  taşıma katmanı + `ProtocolPlugin` nesnesi + fixture'lı testler.

## Sıradaki: Faz 9 dalga 2 — NMEA 0183

Spec kaynağı: `docs/spec/ozet/05-denizcilik.md` (NMEA bölümünün tamamı) ve
`docs/spec/ozet/10-uygulama-spec.md` §43 (doğrulanmış GGA fixture'ı). **Önce oku.**

### Katalog yolları (doğrulandı)
| Yol | Rol |
|---|---|
| `marine-navigation/nmea-family/nmea-0183` | **KANONİK** — `pluginId` + `status: 'ready'` buraya |
| `marine-navigation/gnss-corrections/gps-nmea` | alias → nmea-0183 |
| `aerospace-uav/gnss-navigation/nmea` | alias → nmea-0183 |

Tek motor **üç sayfayı** besleyecek. Alias kayıtlarına `pluginId` ya da `status`
YAZMA — ikisi de zincirden türetiliyor.

### Yapılacaklar
1. `src/protocols/marine/nmea/` — `nmea0183.ts` (cümle çözümleyici) + cümle tipi başına
   alan tabloları. Checksum `src/protocol-core/checksums/nmeaChecksum.ts`ten gelir,
   yeniden yazma; **kapsamı doğrula** (`$` ve `*` dahil mi).
2. Cümle tipleri: spec kaçını sayıyorsa o kadar (GGA, RMC, GSA, GSV, VTG…). Her biri
   alan alan. Koordinat `ddmm.mmmm` → ondalık derece dönüşümü.
3. `nmea0183Plugin: ProtocolPlugin` — `exampleFrames`'e §43'ün GGA cümlesi **mutlaka**.
4. `src/protocols/index.ts`'e kayıt + katalogda kanonik kayda `pluginId`/`status`.
5. `e2e/nmea-decode.spec.ts` — modbus-decode.spec.ts desenini birebir izle.

### Dalga 3 (sonraki): CAN + J1939 + DBC
- `automotive/can-family/{can-2-0a,can-2-0b,can-fd,can-xl}` (hepsi kanonik)
- `automotive/vehicle-network-protocols/j1939` kanonik, `marine-navigation/marine-machinery/marine-j1939` alias
- **DBC'nin katalog kaydı YOK** — dosya biçimi, protokol değil. Nereye konacağı ayrı bir
  karar (hesap aracı mı, CAN decode panelinin bir sekmesi mi).
- ⚠️ `e2e/modbus-decode.spec.ts` içindeki `PLANNED_DECODE_PATH` şu an
  `automotive/can-family/can-2-0a?tab=decode` — "motorsuz protokol hâlâ planlandı basıyor"
  regresyon bekçisi. **Dalga 3 CAN'i yapınca bu bekçi kırılır**, hâlâ motorsuz başka bir
  protokole yönlendirilmeli.

## Tuzaklar — hepsi bu depoda gerçekten tökezletti

- **`ParsedField` alanları `offset`/`length`**, `byteOffset`/`byteLength` DEĞİL.
- **Eksik çeviri anahtarı ekranı BOŞ çizer, testleri yeşil bırakır.** `t()` sözlükte
  olmayan anahtar için `undefined` döndürür, React hiçbir şey basmaz; `data-testid` ile
  seçen testler yeşil kalır. Ayrıca `t(key, vars)` eksik anahtarla **çalışma zamanında
  fırlatır** — yeni anahtarlarda yer tutucu kullanma, sayıyı ayrı `<span>`'e bas.
- **`as TranslationKey` ile daraltılan anahtarlar tsc'den kaçar.** `messageKey`/`errorKey`
  sabitlerini ayrıca grep'le.
- **Çözümleyiciler saf TS, yerelleştirilmiş metin üretemez.** `ParsedField.warnings`,
  `ProtocolWarning.message` ve `ProtocolError.message` alanlarına **çeviri anahtarı**
  konur; gösterim tarafı `translateDiagnostic(text, t)` ile geçirir
  (`isTranslationKey` `src/translations/index.ts`te). Ham basmak dalga 1'de ekranda
  `protocol.modbus.rtu.warning.roleInferredRequest` olarak göründü.
- `ImplementationStatus` = `'planned' | 'partial' | 'ready'` — **`'implemented'` YOK**.
- `src/tests/catalog.test.ts` **8/54/172** sayılarını ve alias bütünlüğünü bekçiliyor.
  Yeni katalog kaydı ekleme; var olana `pluginId`/`status` eklemek serbest ve testi kırmaz.
- `noUncheckedIndexedAccess` açık — `bytes[i]` tipi `number | undefined`, guard yaz.
- `any` yok, `@ts-ignore` yok. Kod yorumları Türkçe, tanımlayıcılar İngilizce.
- Ham renk yasak, yalnız token utility'leri (`bg-surface`, `text-series-1`…).
  **Tailwind sınıf adı şablonla üretilemez** — sabit `Record` tablosu kur.
- i18n: yeni metin hem `tr.ts` hem `en.ts`e; `translations.test.ts` küme eşitliğini ve
  `{yerTutucu}` kümesinin iki dilde aynı olmasını denetliyor.
- **Playwright'ta rota öneki `/comm/` ZORUNLU**, port `4319`, `reuseExistingServer: false`
  bilinçli — değiştirme.
- Protokol/function code/alan ADLARI **veridir, çevrilmez** ("Read Holding Registers"
  iki dilde de aynı).

## Çalışma kuralları

- `npm run dev` → localhost:3001/comm/ · `npm test` · `npm run build` · `npm run test:e2e`
- **Yeşil test ekranın açıldığını kanıtlamıyor.** UI'a dokunan her iş bitince gerçek
  tarayıcıda tur at: yatay taşma, konsol hatası, boş etiketli düğme, yinelenen başlık,
  **ham çeviri anahtarı kalıntısı** (`/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/`) tara.
  Dalga 1'de iki kusur ancak bu turda görüldü.
- **Bulunan kusur için yazılan bekçi testi, düzeltme geçici geri alınınca kırmızıya
  dönmeli.** Hep yeşil kalan test bekçi değil.
- Commit serbest, **push için ayrıca onay iste**.
- Kota bu işte üç kez ajanları düşürdü. İş **dalgalara** bölünüyor; her dalga tek başına
  commit edilebilir olmalı.

## Öneri
Model: **Sonnet**, effort: **high** — tarifler net (spec'te cümle yapıları + fixture'lar),
desen dalga 1'de kuruldu, mimari karar kalmadı. Beklenmedik bir mimari karar çıkarsa dur,
Opus'a çık, kararı ver, geri dön.
