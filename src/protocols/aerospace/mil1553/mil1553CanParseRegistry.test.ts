import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { mil1553Parser, mil1553Plugin } from './mil1553';

/**
 * Faz 10 dalga 15g — `mil-std-1553` `canParse` bekçisi
 * (`arinc429CanParseRegistry.test.ts` / `rcPulseCanParseRegistry.test.ts` /
 * `j1850CanParseRegistry.test.ts` emsali).
 *
 * ── Bu bekçinin kanıtladığı şey ────────────────────────────────────────────
 * `mil1553Parser.canParse` YAPISAL olarak `false` döner ve bu bir eksiklik
 * değil bir KARARdır (`mil1553.ts` dosya başı). Test iki şeyi ayrı ayrı
 * kanıtlıyor:
 *   1. registry'nin HİÇBİR örneği kabul edilmiyor (sağlık kontrolüyle: tarama
 *      gerçekten koştu ve örnek sayısı gerçekten büyük),
 *   2. kaydın KENDİ geçerli örnekleri de kabul edilmiyor — yani kayıt otomatik
 *      algılamaya gerçekten HİÇ girmiyor.
 *
 * ── VE KARARIN GEREKÇESİ ÖLÇÜLÜYOR ────────────────────────────────────────
 * 15d/15e/15f'in dersi: registry taramasının sıfırı imzayı KANITLAMAZ, yalnız
 * *"bu depoda karşı örnek yok"* der. Burada asıl ölçüm aşağıdaki
 * "elde kalan tek ölçüt" bloğunda: `mil-std-1553`ün 2 baytında HİÇBİR imza
 * yoktur — senkron yükün dışında, checksum yok, parite girdiye bile girmiyor.
 * Geriye YALNIZ `data.length % 2 === 0` kalıyor ve bu ölçütün ne kadar
 * işe yaramaz olduğu SAYIYLA gösteriliyor: hem registry'de hem rastgele
 * baytlarda kabul oranı ölçülüyor.
 *
 * 15f'te `arinc-429` için ölçülen rakam (42 yanlış pozitif, paritesi ayarlı
 * girdide N=8'de bile %100 kabul) burada bir üst sınır bile değil: ARINC'te
 * en azından parite bir elekti, burada elek YOK.
 */

const REGISTRY_EXAMPLE_HEALTH_THRESHOLD = 700;

/**
 * SIFIR, ve bu bir tavan DEĞİL kesin bir beklentidir: `canParse` yapısal
 * olarak `false` döner, dolayısıyla hiçbir yabancı çerçeve kabul edilemez.
 * Tavan olarak bırakmak bir regresyonu GİZLERDİ.
 */
const REGISTRY_FALSE_POSITIVE_CEILING = 0;

/**
 * Deterministik PRNG — xorshift32. `Math.random()` her koşuda farklı sayı
 * verirdi, LCG ise ardışık çıktıların bit istatistiğini bozardı (15f'in
 * `arinc429CanParseRegistry.test.ts`inde ÖLÇÜLDÜ ve üreteç değiştirildi).
 */
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

/**
 * VARSAYIMSAL "yalnız çift uzunluk" bekçisi — motorun ARTIK KULLANMADIĞI, ama
 * 2 baytlık bir sözcük için elde kalan TEK ölçüt. Ölçüm bunu sınar,
 * `canParse`ı değil: `canParse`ın neden yapısal olarak `false` döndüğünün
 * KANITI budur (`mil1553.ts` dosya başı, "canParse DAİMA false").
 */
function hypotheticalLengthOnlyGuard(data: Uint8Array): boolean {
  return data.length >= 2 && data.length % 2 === 0;
}

describe('MIL-STD-1553 canParse — registry çapında tarama (bekçi)', () => {
  it(
    'mil-std-1553 DIŞINDAKİ protokollerin HİÇBİR örneği kabul edilmiyor',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;
      let evenLengthExamples = 0;

      for (const id of ids) {
        if (id === mil1553Plugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (hypotheticalLengthOnlyGuard(example.bytes)) evenLengthExamples += 1;
          if (mil1553Parser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} (${String(example.bytes.length)} bayt)`);
          }
        }
      }

      // Sağlık kontrolü — tarama gerçekten TAM registry üzerinde koştu mu (14f'in dersi).
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(REGISTRY_EXAMPLE_HEALTH_THRESHOLD);

      console.info(
        [
          '[mil-std-1553 canParse ÖLÇÜMÜ / registry]',
          `  taranan örnek                     : ${String(totalExamples)}`,
          `  canParse kabulü                   : ${String(collisions.length)}`,
          `  "yalnız çift uzunluk" ölçütü olsaydı: ${String(evenLengthExamples)} yanlış pozitif` +
            ` (%${((evenLengthExamples / totalExamples) * 100).toFixed(1)})`,
        ].join('\n'),
      );

      expect(
        collisions.length,
        `yanlış pozitif (sıfır bekleniyordu):\n${collisions.join('\n')}`,
      ).toBe(REGISTRY_FALSE_POSITIVE_CEILING);

      // Kararın gerekçesi: elde kalan TEK ölçüt registry'nin yarısından
      // fazlasını kabul ederdi. Sayı bir tavan değil bir KANIT.
      expect(evenLengthExamples).toBeGreaterThan(totalExamples / 2);
    },
    30000,
  );

  it('mil-std-1553’ün KENDİ geçerli örnekleri de canParse’ı GEÇMEZ', () => {
    const accepted = mil1553Plugin.exampleFrames.filter((example) =>
      mil1553Parser.canParse(example.bytes),
    );
    expect(accepted.map((example) => example.id)).toEqual([]);
    // Sağlık kontrolü: örnek sayısı gerçekten sıfırdan büyük — boş bir liste
    // üzerinde "hiçbiri kabul edilmedi" demek hiçbir şey kanıtlamaz.
    expect(mil1553Plugin.exampleFrames.length).toBeGreaterThan(0);
  });
});

describe('“yalnız çift uzunluk” ölçütü NEDEN yetmez — yapısal false’un gerekçesi', () => {
  const SAMPLE_COUNT = 20000;

  it('rastgele çift uzunluklu baytlarda ölçüt %100 kabul ediyor — hiçbir şey elemiyor', () => {
    const nextByte = createRandomByteSource(0x51d3a7);
    let accepted = 0;
    let canParseAccepted = 0;
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const wordCount = 1 + (index % 8);
      const bytes = new Uint8Array(wordCount * 2);
      for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) bytes[byteIndex] = nextByte();
      if (hypotheticalLengthOnlyGuard(bytes)) accepted += 1;
      if (mil1553Parser.canParse(bytes)) canParseAccepted += 1;
    }
    // Ölçüt GERÇEKTEN koştu ve GERÇEKTEN kabul etti…
    expect(accepted).toBe(SAMPLE_COUNT);
    // …ama `canParse` hiçbirini almadı. Ölçüt motora BAĞLI DEĞİL.
    expect(canParseAccepted).toBe(0);
  });

  it('sözcük sayısını artırmak KORUMA SAĞLAMIYOR — 1 sözcükte de 64 sözcükte de %100', () => {
    // ARINC 429'da parite 2⁻ᴺ'lik bir koruma veriyordu (ve o bile paritesi
    // ayarlanmış girdiye karşı çökmüştü). Burada N'e bağlı HİÇBİR koruma yok.
    const nextByte = createRandomByteSource(0x2ac41b);
    for (const wordCount of [1, 2, 8, 64]) {
      let accepted = 0;
      for (let index = 0; index < 2000; index += 1) {
        const bytes = new Uint8Array(wordCount * 2);
        for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
          bytes[byteIndex] = nextByte();
        }
        if (hypotheticalLengthOnlyGuard(bytes)) accepted += 1;
      }
      expect(accepted, `N=${String(wordCount)}`).toBe(2000);
    }
  });
});
