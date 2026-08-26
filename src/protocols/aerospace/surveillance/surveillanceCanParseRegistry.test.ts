import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { adsbParser, adsbPlugin } from '../adsb/adsb';
import { modeSBytesFromHex, modeSParser, modeSPlugin } from '../modeS/modeS';

/**
 * Faz 10 dalga 15h — `surveillance` ailesinin İKİ kaydının `canParse` bekçisi
 * (`sentSpcCanParseRegistry.test.ts` emsali: iki kayıt TEK dosyada, çünkü
 * ölçülmek istenen şey ikisinin İLİŞKİSİ).
 *
 * ── NE KANITLANIYOR ────────────────────────────────────────────────────────
 * `mode-s`in imzası ÜÇ kanıttan oluşur — uzunluk (tam 7 ya da 14) · DF'in
 * ATANMIŞ bir değer olması ve uzunlukla TUTARLI olması · ve DF ∈ {11,17,18}
 * ise CRC PASS. **Üçüncü kanıt her DF'te YOK**: DF0/4/5/16/20/21'de son 24 bit
 * AP = CRC ⊕ ICAO'dur ve pasif dinleyici ikisini ayıramaz (`modeS.ts` dosya
 * başı). O DF'lerde elde uzunluk + DF tutarlılığı kalıyor ve bu YANLIŞ POZİTİF
 * ÜRETİR. Test bunu gizlemez, **ÖLÇER ve bir tavana bağlar**.
 *
 * `ads-b`in imzası DAHA DARDIR: 14 bayt · DF ∈ {17,18} · her zaman CRC PASS.
 * Yani `ads-b`in kabul ettiği HER çerçeveyi `mode-s` de kabul eder ve bu
 * **BEKLENEN** davranıştır — aynı 14 bayt iki sayfada da açılır, biri çerçeveyi
 * biri ME'yi gösterir. Bekçi bu çakışmayı bir hata olarak DEĞİL, bir değişmez
 * olarak yazar.
 *
 * ── 14f/15f/15g'nin dersi: SIFIR bir imzayı KANITLAMAZ ────────────────────
 * Registry taramasının sıfırı yalnız *"bu depoda karşı örnek yok"* der. Bu
 * yüzden burada ayrıca **rastgele bayt** üzerinde kabul oranı ölçülüyor:
 * DF11/17/18'in 24 bitlik CRC'si teoride 2⁻²⁴'lük bir elek olmalı, AP sınıfında
 * ise elek YOK. İkisi de sayıyla gösteriliyor.
 */

const REGISTRY_EXAMPLE_HEALTH_THRESHOLD = 700;

/**
 * `mode-s`in registry'deki yanlış pozitif SAYISI — **dalga 18e'de yeniden
 * ölçüldü (916 yabancı örnek)**. Tavan değil, ÖLÇÜLMÜŞ değer: artarsa yeni
 * bir çerçeve imzaya sızmıştır, azalırsa imza daralmıştır; iki durumda da
 * bakılması gerekir.
 *
 * 916 örneğin **13'ü** (%1,42) kabul ediliyor ve on üçü de AP sınıfından
 * (DF0/4/5/16/20/21) geçiyor, yani üçüncü kanıtın (CRC) BULUNMADIĞI daldan:
 *   `hart/long-request-secondary-master` (14 bayt) ·
 *   `length-based-protocol/valid-frame` (7) · `mavlink/v2-large-message-id` (14) ·
 *   `profibus-dp/sd3-fixed-data` (14) · `telnet/terminal-type-subnegotiation` (14) ·
 *   `tftp/data-final-block` (7) · **`wifi/ack` (14) — dalga 18a'da eklendi** ·
 *   **`rf-telemetry-custom-frame`in ALTI 14 baytlık örneği — dalga 18e'de
 *   eklendi** (`default-profile`, `whitened`, `crc-mismatch`,
 *   `length-overflow`, `modbus-crc`, `length-includes-crc`)
 *
 * > **Ne yedinci ne de sonraki altı giriş bir REGRESYONDUR; bekçi İŞİNİ
 * > YAPIYOR.** Dalga 18a `wifi`nin 14 baytlık ACK örneğini, dalga 18e ise
 * > `rf-telemetry-custom-frame`in altı 14 baytlık örneğini registry'ye soktu.
 * > `mode-s`in imzası uzunluk + DF atanmışlığına dayanıyor ve bu çerçevelerin
 * > ilk baytı `0xAA` (DF = 21, Comm-B identity reply — ATANMIŞ bir DF ve
 * > 112 bitlik uzunlukla TUTARLI), dolayısıyla AP dalından geçiyorlar.
 * > Karşı tarafta düzeltme YOK ve gerekmiyor: her iki kaydın kendi bekçisi
 * > ters yönü **0** olarak ölçüyor (`wifi.canParse` FCS istiyor,
 * > `rf-telemetry.canParse` önbelleme + sync sözcüğü istiyor ve registry'nin
 * > 937 örneğinin hiçbirini almıyor). Ayrım sıralamada değil, KANITTA.
 *
 * Karşılaştırma: üç kanıttan yalnız uzunluk kalsaydı (7 ya da 14 bayt) **33**
 * örnek (%3,6) kabul edilirdi — DF'in atanmışlığı ve uzunlukla tutarlılığı
 * yanlış pozitifi hâlâ üçte birinden aşağı indiriyor, ama SIFIRA indiremiyor
 * ve indiremez: `modeS.ts` dosya başındaki AP tuzağı bunun matematiksel sebebi.
 */
const MODE_S_REGISTRY_FALSE_POSITIVE_COUNT = 13;

/**
 * `ads-b` için beklenen SIFIR ve bu bir tavan DEĞİL kesin bir beklentidir:
 * `ads-b`in üçüncü kanıtı (CRC-24) HER çerçevede var, dolayısıyla yabancı bir
 * çerçevenin kabul edilmesi 2⁻²⁴'lük bir tesadüf olurdu.
 */
const ADS_B_REGISTRY_FALSE_POSITIVE_COUNT = 0;

/** Deterministik PRNG — xorshift32 (15f'te ölçülüp seçilmişti, LCG bit istatistiğini bozuyordu). */
function createRandomByteSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 24) & 0xff;
  };
}

interface RegistryScan {
  totalExamples: number;
  modeSCollisions: string[];
  adsbCollisions: string[];
  lengthOnlyCollisions: number;
}

async function scanRegistry(): Promise<RegistryScan> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);

  const scan: RegistryScan = {
    totalExamples: 0,
    modeSCollisions: [],
    adsbCollisions: [],
    lengthOnlyCollisions: 0,
  };

  for (const id of registry.registeredProtocolIds()) {
    if (id === modeSPlugin.id || id === adsbPlugin.id) continue;
    const plugin = await registry.loadProtocolPlugin(id);
    for (const example of plugin.exampleFrames) {
      scan.totalExamples += 1;
      // VARSAYIMSAL "yalnız uzunluk" bekçisi — motorun KULLANMADIĞI, ama üç
      // kanıttan ikisi düşseydi elde kalacak olan ölçüt.
      if (example.bytes.length === 7 || example.bytes.length === 14) {
        scan.lengthOnlyCollisions += 1;
      }
      if (modeSParser.canParse(example.bytes)) {
        scan.modeSCollisions.push(`${id}/${example.id} (${String(example.bytes.length)} bayt)`);
      }
      if (adsbParser.canParse(example.bytes)) {
        scan.adsbCollisions.push(`${id}/${example.id} (${String(example.bytes.length)} bayt)`);
      }
    }
  }
  return scan;
}

describe('surveillance canParse — registry çapında yanlış pozitif ÖLÇÜMÜ', () => {
  it(
    'mode-s ve ads-b DIŞINDAKİ protokollerin örnekleri ölçülür ve sayıya bağlanır',
    async () => {
      const scan = await scanRegistry();

      // Sağlık kontrolü — tarama gerçekten TAM registry üzerinde koştu mu (14f dersi).
      expect(
        scan.totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(REGISTRY_EXAMPLE_HEALTH_THRESHOLD);

      console.info(
        [
          '[surveillance canParse ÖLÇÜMÜ / registry]',
          `  taranan örnek                      : ${String(scan.totalExamples)}`,
          `  mode-s yanlış pozitif              : ${String(scan.modeSCollisions.length)}` +
            ` (%${((scan.modeSCollisions.length / scan.totalExamples) * 100).toFixed(2)})`,
          `  ads-b  yanlış pozitif              : ${String(scan.adsbCollisions.length)}`,
          `  "yalnız 7/14 bayt" ölçütü olsaydı  : ${String(scan.lengthOnlyCollisions)} yanlış pozitif` +
            ` (%${((scan.lengthOnlyCollisions / scan.totalExamples) * 100).toFixed(1)})`,
          scan.modeSCollisions.length === 0
            ? '  (mode-s çakışması yok)'
            : `  mode-s çakışmaları:\n    ${scan.modeSCollisions.join('\n    ')}`,
        ].join('\n'),
      );

      expect(
        scan.modeSCollisions.length,
        `mode-s yanlış pozitifleri:\n${scan.modeSCollisions.join('\n')}`,
      ).toBe(MODE_S_REGISTRY_FALSE_POSITIVE_COUNT);

      expect(
        scan.adsbCollisions.length,
        `ads-b yanlış pozitifleri:\n${scan.adsbCollisions.join('\n')}`,
      ).toBe(ADS_B_REGISTRY_FALSE_POSITIVE_COUNT);

      // KARARIN GEREKÇESİ: üç kanıttan yalnız uzunluk kalsaydı yanlış pozitif
      // sayısı kat kat artardı. Sayı bir gözlem değil, imzanın dayanağı.
      expect(scan.lengthOnlyCollisions).toBeGreaterThan(scan.modeSCollisions.length * 2);
    },
    60000,
  );

  it('her iki kaydın KENDİ geçerli örnekleri canParse’ı GEÇER', () => {
    // İmzanın aşırı daraltılıp kendi kaydını kaybetmediğinin kanıtı.
    const modeSExpectedRejects = ['df17-crc-fail', 'length-mismatch', 'invalid-length'];
    for (const example of modeSPlugin.exampleFrames) {
      if (modeSExpectedRejects.includes(example.id)) {
        expect(modeSParser.canParse(example.bytes), `mode-s/${example.id}`).toBe(false);
        continue;
      }
      expect(modeSParser.canParse(example.bytes), `mode-s/${example.id}`).toBe(true);
    }

    const adsbExpectedRejects = ['crc-fail', 'not-extended-squitter'];
    for (const example of adsbPlugin.exampleFrames) {
      const expected = !adsbExpectedRejects.includes(example.id);
      expect(adsbParser.canParse(example.bytes), `ads-b/${example.id}`).toBe(expected);
    }
  });

  it('ads-b ⊂ mode-s — çakışma BEKLENEN davranıştır, düzeltilmez', () => {
    // `ads-b`in kabul ettiği HER çerçeveyi `mode-s` de kabul eder. Aynı 14 bayt
    // iki sayfada da açılır: biri çerçeveyi, biri ME'yi gösterir.
    for (const example of adsbPlugin.exampleFrames) {
      if (!adsbParser.canParse(example.bytes)) continue;
      expect(modeSParser.canParse(example.bytes), `ads-b/${example.id}`).toBe(true);
    }
    // Ters yön DOĞRU DEĞİL: `mode-s` DF11/DF4/DF24 kabul eder, `ads-b` etmez.
    for (const hex of ['5D4840D6F8740F', '20001030219677', 'E7123456789ABCDEF01122E38FB8']) {
      expect(modeSParser.canParse(modeSBytesFromHex(hex)), hex).toBe(true);
      expect(adsbParser.canParse(modeSBytesFromHex(hex)), hex).toBe(false);
    }
  });
});

describe('rastgele baytta imzanın gücü — üçüncü kanıt VAR ile YOK arasındaki fark', () => {
  const SAMPLE_COUNT = 40000;

  it('CRC kanıtı olan DF’lerde (11/17/18) rastgele bayt PRATİKTE hiç geçmiyor', () => {
    const nextByte = createRandomByteSource(0x7f3ac1);
    let acceptedByAdsb = 0;
    let df17Candidates = 0;
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const bytes = new Uint8Array(14);
      for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) bytes[byteIndex] = nextByte();
      // İlk baytı DF17'ye zorla: elek artık YALNIZ CRC-24.
      bytes[0] = 0x88 | ((bytes[0] ?? 0) & 0x07);
      df17Candidates += 1;
      if (adsbParser.canParse(bytes)) acceptedByAdsb += 1;
    }
    expect(df17Candidates).toBe(SAMPLE_COUNT);
    // 2⁻²⁴ × 40 000 ≈ 0,0024 — sıfır beklenir ve tesadüfen bir tane çıksa bile
    // ölçüm bozulmasın diye üst sınır 1 bırakıldı.
    expect(acceptedByAdsb).toBeLessThanOrEqual(1);
  });

  it('CRC kanıtı OLMAYAN DF’lerde (AP sınıfı) rastgele bayt %100 geçiyor', () => {
    // Kararın gerekçesi burada: aynı motorun aynı `canParse`ı, yalnız DF sınıfı
    // değişince eleğini tamamen kaybediyor. Bu bir kusur değil, protokolün
    // pasif dinlemedeki sınırı (`modeS.ts` dosya başı).
    const nextByte = createRandomByteSource(0x2bd914);
    let accepted = 0;
    const total = 10000;
    for (let index = 0; index < total; index += 1) {
      const bytes = new Uint8Array(7);
      for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) bytes[byteIndex] = nextByte();
      // İlk baytı DF4'e zorla (kısa çerçeve, AP sınıfı).
      bytes[0] = 0x20 | ((bytes[0] ?? 0) & 0x07);
      if (modeSParser.canParse(bytes)) accepted += 1;
    }
    expect(accepted).toBe(total);
  });
});
