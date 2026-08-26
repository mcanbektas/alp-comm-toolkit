import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';

import { registerBuiltInProtocols } from '../../index';
import { espNowPlugin } from '../espnow/espNow';
import { hasFcslessDot11Signature, hasStrictFcslessDot11Signature } from './dot11Frame';
import { wifiParser, wifiPlugin } from './wifi';

/**
 * Faz 10 dalga 18a — ZORUNLU bekçi (15f/15g/15h/16c/17'den beri kural), ve
 * bu dosya **ÜÇ YÖNLÜ** koşuyor:
 *
 *   1. **İleri** — `wifi.canParse` (imza W12) registry'deki BAŞKA hiçbir
 *      örneği kabul etmiyor mu? Ana brif ölçümü 899 örnek üzerinde SIFIR
 *      çakışma buldu; 18a onu 909 örnek üzerinde, 18b ise **913** örnek
 *      üzerinde YENİDEN üretti (dört yeni `wifi` örneği eklendi). Sayı
 *      kodda tekrar üretilmezse, registry büyüdükçe bir gün başka bir kaydın
 *      örneği bu imzayı geçebilir ve `wifi` otomatik algılamada onun
 *      çerçevesini SESSİZCE çalar.
 *
 *      🚨 **dalga 18c'den beri BİR İSTİSNA VAR ve KASITLI:** `esp-now`in
 *      TÜM örnekleri W12'yi geçer. Bu, `mode-s`in `wifi`nin ACK örneğini
 *      sahiplenmesi gibi RASTLANTISAL bir çakışma DEĞİL — `[KARAR 18-4]`
 *      `esp-now`u `wifi`nin PAYLAŞILAN 802.11 MAC+FCS çekirdeğinin
 *      TÜKETİCİSİ ilan ediyor, yani bir esp-now çerçevesi YAPISAL OLARAK
 *      da geçerli bir 802.11 çerçevesidir (aynı FC/adres/FCS alanları).
 *      Bu çakışma KALICIDIR ve gelecekte esp-now'a eklenecek her yeni
 *      örnek için de TEKRARLANACAKTIR — `foreignHits`ten AYRI bir
 *      `espNowHits` kovasında sayılır, `foreignHits` SIFIR'da kalmaya
 *      devam eder.
 *   2. **Ters** — FCS'SİZ imza YAZILSAYDI kaç çerçeve çalardı? Ana brif
 *      ölçümü **216 / 899**; bu tur onu BİREBİR yeniden üretti. En dar
 *      FCS'siz varyant bile **110**. `[KARAR 18-2]`nin ikinci ayağı budur:
 *      **FCS bu kaydın auto-detection'da var olabilmesinin TEK sebebidir.**
 *   3. **Kendi üzerinde** — `wifi`nin TÜM örneklerinde `canParse` `true`,
 *      bozuk-FCS örneği HARİÇ. O istisna SESSİZCE ATLANMAZ, AÇIKÇA `false`
 *      beklenir: imza FCS'e dayanıyor ve yakalamanın kendi bozuk çerçevesinin
 *      reddedilmesi DOĞRU davranıştır.
 *
 * Emsal: `lonworksCanParseRegistry.test.ts` (17), `iec61162CanParseRegistry.test.ts` (16c).
 */

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** `wifi` ve `esp-now` DIŞINDAKİ kayıtlardan W12'yi geçenler — boş olmalı. */
  readonly foreignHits: string[];
  /** `esp-now`dan W12'yi geçenler — `[KARAR 18-4]` gereği BEKLENEN, AYRI sayılır. */
  readonly espNowHits: string[];
  /** Aynı kümede FCS'siz imzayı geçenler — kabul edilemez sayı. */
  readonly fcslessForeignHits: string[];
  /** FCS'siz imzanın EN DAR biçimi — yine kabul edilemez. */
  readonly strictFcslessForeignHits: string[];
  readonly ownHits: string[];
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);

  const foreignHits: string[] = [];
  const espNowHits: string[] = [];
  const fcslessForeignHits: string[] = [];
  const strictFcslessForeignHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;

  const ids = registry.registeredProtocolIds();
  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    for (const example of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${example.id} (${String(example.bytes.length)}B)`;
      const accepted = wifiParser.canParse(example.bytes);
      if (id === 'wifi') {
        (accepted ? ownHits : ownMisses).push(label);
      } else if (id === 'esp-now') {
        // `[KARAR 18-4]`: esp-now `wifi`nin çekirdeğini TÜKETİR, bu yüzden
        // W12'yi geçmesi BEKLENEN bir sonuçtur — `foreignHits`e KARIŞMAZ.
        if (accepted) espNowHits.push(label);
        if (hasFcslessDot11Signature(example.bytes)) fcslessForeignHits.push(label);
        if (hasStrictFcslessDot11Signature(example.bytes)) strictFcslessForeignHits.push(label);
      } else {
        if (accepted) foreignHits.push(label);
        if (hasFcslessDot11Signature(example.bytes)) fcslessForeignHits.push(label);
        if (hasStrictFcslessDot11Signature(example.bytes)) strictFcslessForeignHits.push(label);
      }
    }
  }

  return {
    registeredProtocols: ids.length,
    totalExamples,
    foreignHits,
    espNowHits,
    fcslessForeignHits,
    strictFcslessForeignHits,
    ownHits,
    ownMisses,
  };
}

describe('wifi canParse — üç yönlü bekçi', () => {
  it(
    'İLERİ: registry’deki BAŞKA hiçbir örnek W12 imzasını geçmez',
    async () => {
      const sweep = await sweepRegistry();

      // Sağlık kontrolü: tarama gerçekten TAM registry üzerinde koştu mu?
      // Ana brif ölçümü 144 kayıt / 899 örnekti; 18a `wifi`yi ekledi (145 /
      // 909), 18b dört örnek daha ekledi (145 / 913).
      expect(
        sweep.totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama TAM registry üzerinde mi koştu?',
      ).toBeGreaterThan(900);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(145);

      // ÖLÇÜM: ana brifin 899 örnek üzerinde bulduğu 0 çakışma, bugün de 0
      // — `esp-now` HARİÇ (o AYRI bir kovada, aşağıda).
      expect(
        sweep.foreignHits.length,
        `yabancı çakışmalar (${String(sweep.foreignHits.length)}):\n${sweep.foreignHits.join('\n')}`,
      ).toBe(0);

      // `[KARAR 18-4]` (dalga 18c): `esp-now`in TÜM örnekleri W12'yi geçer,
      // çünkü bir esp-now çerçevesi YAPISAL OLARAK da geçerli bir 802.11
      // çerçevesidir — bu bir yanlış pozitif DEĞİL, PAYLAŞILAN çekirdeğin
      // doğal sonucu. Sayı esp-now'ın KENDİ plugin'inden TÜRETİLİR
      // (sabitlenmez): plugin büyüdükçe bu test KIRILMAZ.
      expect(
        sweep.espNowHits.length,
        `esp-now örneklerinin W12'yi geçme sayısı beklenenden farklı (${String(sweep.espNowHits.length)}):\n${sweep.espNowHits.join('\n')}`,
      ).toBe(espNowPlugin.exampleFrames.length);
    },
    30000,
  );

  it(
    'TERS: FCS`siz imza YAZILSAYDI yüzlerce çerçeve ÇALARDI — kapsam kararının kanıtı',
    async () => {
      const sweep = await sweepRegistry();

      // Brif ölçümü W13 = 216 / 899 (%24). Sayı registry büyüdükçe kayabilir
      // ama BÜYÜKLÜK SINIFI kaymaz: FCS'siz 802.11 imzasının ayırt edici
      // hiçbir çapası yok.
      expect(
        sweep.fcslessForeignHits.length,
        'FCS`siz imzanın çakışma sayısı beklenmedik biçimde DÜŞTÜ — kapsam kararının dayanağı yeniden ölçülmeli',
      ).toBeGreaterThanOrEqual(200);

      // EN DAR FCS'siz varyant (sınıf başına asgari uzunluk kapısı da olan)
      // bile 110 çakışıyor. İki sayı da aynı kararı veriyor.
      expect(sweep.strictFcslessForeignHits.length).toBeGreaterThanOrEqual(100);
      expect(sweep.strictFcslessForeignHits.length).toBeLessThan(
        sweep.fcslessForeignHits.length,
      );

      // Uçurum KARARIN kendisidir: 0'a karşı 200+.
      expect(sweep.fcslessForeignHits.length).toBeGreaterThan(sweep.foreignHits.length + 200);
    },
    30000,
  );

  it(
    'KENDİ ÜZERİNDE: on üç örnek imzayı geçer, bozuk-FCS örneği AÇIKÇA geçmez',
    async () => {
      const sweep = await sweepRegistry();
      // 18b'nin dört örneği de imzayı geçer; türetilmiş ikisinin FCS'i
      // motorun kendi CRC'siyle YENİDEN hesaplandığı için geçmesi ZORUNLU.
      expect(sweep.ownHits.length).toBe(13);

      // TEK istisna ve KASITLI: imzanın çapası FCS'tir, yakalamanın kendi
      // bozuk çerçevesinin reddedilmesi DOĞRU davranıştır. Sessizce atlanmaz.
      expect(sweep.ownMisses).toHaveLength(1);
      expect(sweep.ownMisses[0]).toContain('wifi/corrupt-fcs');

      // Aynı çerçeve `parse` edilebiliyor ve FAIL basıyor — `canParse`ın
      // reddi bir GÖRMEZDEN GELME değil, auto-detection kararı.
      const corrupt = wifiPlugin.exampleFrames.find((entry) => entry.id === 'corrupt-fcs');
      if (corrupt === undefined) throw new Error('missing corrupt-fcs example');
      const result = wifiParser.parse(corrupt.bytes);
      expect(result.success).toBe(true);
      if (result.success) expect(result.frame.valid).toBe(false);
    },
    30000,
  );

  it('W12 DÖRT koşulun TAMAMIDIR — üçü yetmez', () => {
    const base = wifiPlugin.exampleFrames.find((entry) => entry.id === 'beacon')?.bytes;
    if (base === undefined) throw new Error('missing beacon example');
    expect(wifiParser.canParse(base)).toBe(true);

    // 1) Protokol sürümü 0 olmalı.
    const version = Uint8Array.from(base);
    version[0] = (version[0] ?? 0) | 0x01;
    expect(wifiParser.canParse(version), 'protokol sürümü').toBe(false);

    // 2) Type 3 (Extension) elenir.
    const extension = Uint8Array.from(base);
    extension[0] = ((extension[0] ?? 0) & ~0x0c) | 0x0c;
    expect(wifiParser.canParse(extension), 'extension türü').toBe(false);

    // 3) Sınıf-farkındalıklı asgari uzunluk.
    expect(wifiParser.canParse(base.subarray(0, 27)), 'asgari uzunluk').toBe(false);

    // 4) FCS geçerli olmalı — tek başına en güçlü koşul.
    const fcs = Uint8Array.from(base);
    fcs[base.length - 2] = ((fcs[base.length - 2] ?? 0) ^ 0x01) & 0xff;
    expect(wifiParser.canParse(fcs), 'FCS').toBe(false);
  });

  it('`canParse` kaydın kendi örneklerinde `parse`la TUTARLIDIR', () => {
    for (const example of wifiPlugin.exampleFrames) {
      const accepted = wifiParser.canParse(example.bytes);
      const result = wifiParser.parse(example.bytes);
      // İmzayı geçen her örnek varsayılan seçeneklerle en azından ÇÖZÜLEBİLİR
      // olmalı (geçerli olmak zorunda değil — bozuk örnek de burada).
      if (accepted) expect(result.success, example.id).toBe(true);
    }
  });
});
