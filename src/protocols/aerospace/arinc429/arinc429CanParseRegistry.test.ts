import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { arinc429Parser, arinc429Plugin } from './arinc429';

/**
 * Faz 10 dalga 15f — `arinc-429` `canParse` bekçisi
 * (`j1850CanParseRegistry.test.ts` / `dronecanCanParseRegistry.test.ts` /
 * `rcPulseCanParseRegistry.test.ts` emsali).
 *
 * ── Bu bekçinin ölçtüğü şey nedir ──────────────────────────────────────────
 * `arinc429Parser.canParse` KASTEN zayıftır ve bunu gizlemiyor: 32-bit
 * word'ün ayırt edici bir imzası YOKTUR. `ProtocolParser.canParse(data:
 * Uint8Array)` imzası `decodeOptions`a asla ulaşamadığı için `wordByteOrder`
 * bilinemez; elde kalan tek bayt-sırası-bağımsız kanıt paritedir
 * (popcount baytların sırasına bakmaz). Kural:
 *   1. uzunluk 4'ün katı ve ≥ 4,
 *   2. TÜM word'lerde tek (odd) parite.
 *
 * ── 15d ve 15e'nin dersi: REGISTRY TARAMASININ SIFIRI HİÇBİR ŞEY KANITLAMAZ ─
 * Registry taraması yalnız *"bu depoda karşı örnek yok"* der; imzayı
 * KANITLAMAZ. Burada bu ders özellikle sert geçerli, çünkü imza zaten
 * olasılıksaldır: rastgele bir word paritesi 1/2 olasılıkla tutar, N word'lük
 * bir blokta 2⁻ᴺ. O yüzden asıl ölçüm registry'de DEĞİL, aşağıdaki
 * "EN ZAYIF HALKA" bloğunda: paritesi KASTEN doğru ayarlanmış rastgele
 * word'ler ELLE kurgulanır ve N=1 ile N=8 AYRI AYRI ölçülür — çünkü bekçinin
 * gücü tam olarak N'e bağlıdır ve bu bağımlılık sayıyla görünür olmalıdır.
 *
 * Ölçülen sayılar `it` başlıklarında ve `console.info` satırlarında raporlanır;
 * `expect`ler o sayıları SABİTLER, böylece ileride biri `canParse`ı
 * gevşetirse test kırılır.
 */

const REGISTRY_EXAMPLE_HEALTH_THRESHOLD = 700;

/**
 * SIFIR, ve bu bir tavan DEĞİL kesin bir beklentidir: `canParse` yapısal olarak
 * `false` döner (`arinc429.ts` dosya başı, "KARAR"), dolayısıyla hiçbir yabancı
 * çerçeve kabul edilemez.
 *
 * TARİHÇE — bu sayı neden burada duruyor: ilk uygulama `canParse`ı uzunluk +
 * parite ile kurmuştu ve bu registry'de **42 yanlış pozitif** ölçmüştü. Ölçüm
 * doğruydu; yorum yanlıştı. Aşağıdaki "yalnız parite" describe'ı 42'nin neden
 * kabul edilebilir bir tavan DEĞİL, ölçütü çöpe atmak için yeterli bir kanıt
 * olduğunu gösteriyor. Sayıyı tavan olarak bırakmak regresyonu GİZLERDİ.
 */
const REGISTRY_FALSE_POSITIVE_CEILING = 0;

/**
 * Deterministik PRNG — `Math.random()` her koşuda farklı sayı verirdi
 * (`rcPulseCanParseRegistry.test.ts` emsali). **LCG DEĞİL, xorshift32.**
 * İlk yazımda `state*1103515245+12345` kullanılmıştı ve N=8 için ölçülen kabul
 * oranı 0.0072 çıktı (teorik 2⁻⁸ = 0.0039'un neredeyse iki katı): LCG'nin
 * ardışık çıktılarının BİT PARİTESİ korelasyonlu, yani üreteç tam da bu
 * testin ölçtüğü büyüklüğü bozuyordu. Ölçüm aracının kendisi ölçtüğü şeyi
 * çarpıtıyorsa sayı bir kanıt değildir.
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

function popcount(byte: number): number {
  let value = byte;
  let count = 0;
  while (value !== 0) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

/**
 * `wordCount` word'lük, HER WORD'ÜN PARİTESİ KASTEN TEK olacak şekilde
 * ayarlanmış rastgele bir blok üretir — imzanın EN ZAYIF halkası.
 * Parite biti ARINC bit 32'dir; bayt sırası bilinmediği için bu üretici
 * onu keyfi olarak SON baytın en yüksek bitine koyar. Bu seçim ölçümü
 * etkilemez: `canParse` yalnız toplam popcount'a bakar.
 */
function buildParityCorrectBlock(nextByte: () => number, wordCount: number): Uint8Array {
  const bytes = new Uint8Array(wordCount * 4);
  for (let word = 0; word < wordCount; word += 1) {
    const base = word * 4;
    let ones = 0;
    for (let index = 0; index < 4; index += 1) {
      const byte = index === 3 ? nextByte() & 0x7f : nextByte();
      bytes[base + index] = byte;
      ones += popcount(byte);
    }
    if (ones % 2 === 0) {
      bytes[base + 3] = (bytes[base + 3] ?? 0) | 0x80;
    }
  }
  return bytes;
}

describe('ARINC 429 canParse — registry çapında tarama (İLERİ YÖN, bekçi)', () => {
  it(
    'arinc-429 DIŞINDAKİ protokollerin örnekleri: yanlış pozitif SAYILIR (sıfır beklenmiyor, tavan sabitlenir)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      const byWordCount = new Map<number, number>();
      let totalExamples = 0;
      let wordAlignedExamples = 0;

      for (const id of ids) {
        if (id === arinc429Plugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          const aligned = example.bytes.length > 0 && example.bytes.length % 4 === 0;
          if (aligned) wordAlignedExamples += 1;
          if (arinc429Parser.canParse(example.bytes)) {
            const words = example.bytes.length / 4;
            byWordCount.set(words, (byWordCount.get(words) ?? 0) + 1);
            collisions.push(`${id}/${example.id} (${String(example.bytes.length)} bayt = ${String(words)} word)`);
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
          '[arinc-429 canParse ÖLÇÜMÜ / registry ileri yön]',
          `  taranan örnek           : ${String(totalExamples)}`,
          `  4 baytın katı olanlar   : ${String(wordAlignedExamples)}  (uzunluk elemesini geçen aday havuzu)`,
          `  yanlış pozitif          : ${String(collisions.length)}`,
          `  word sayısına göre      : ${[...byWordCount.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([words, count]) => `N=${String(words)}→${String(count)}`)
            .join(' ')}`,
        ].join('\n'),
      );

      // Yanlış pozitiflerin HEPSİ uzunluk elemesini geçmiş olmalı — bekçinin
      // ikinci kuralı (parite) tek başına asla kabul etmez.
      expect(collisions.length).toBeLessThanOrEqual(wordAlignedExamples);
      expect(
        collisions.length,
        `yanlış pozitif sayısı tavanı aştı (${String(collisions.length)}):\n${collisions.join('\n')}`,
      ).toBeLessThanOrEqual(REGISTRY_FALSE_POSITIVE_CEILING);
    },
    30000,
  );

  it('arinc-429’un KENDİ geçerli örnekleri de canParse’ı GEÇMEZ — kayıt otomatik algılamaya HİÇ girmiyor', () => {
    const accepted = arinc429Plugin.exampleFrames.filter((example) =>
      arinc429Parser.canParse(example.bytes),
    );
    expect(accepted.map((example) => example.id)).toEqual([]);
  });
});

/**
 * VARSAYIMSAL "yalnız parite" bekçisi — motorun ARTIK KULLANMADIĞI ölçüt.
 *
 * Aşağıdaki describe bunu ölçer, `canParse`ı değil. Sebep: bu ölçüm
 * `canParse`ın neden YAPISAL OLARAK `false` döndüğünün KANITIDIR
 * (`arinc429.ts` dosya başı, "KARAR" bölümü). Ölçüm silinirse gerekçe
 * dayanaksız kalır; `canParse`a bağlı bırakılırsa artık hiçbir şey ölçmez.
 * Bu yüzden ölçüt BURADA, motordan BAĞIMSIZ olarak yeniden yazıldı — aynı
 * zamanda motorun parite hesabının bağımsız bir çaprazlaması.
 */
function hypotheticalParityOnlyGuard(data: Uint8Array): boolean {
  if (data.length === 0 || data.length % 4 !== 0) return false;
  for (let offset = 0; offset < data.length; offset += 4) {
    let bits = 0;
    for (let index = 0; index < 4; index += 1) bits += popcount(data[offset + index] ?? 0);
    if (bits % 2 === 0) return false; // tek (odd) parite şartı
  }
  return true;
}

describe('“yalnız parite” ölçütü NEDEN yetmez — canParse’ın yapısal false gerekçesi', () => {
  const SAMPLE_COUNT = 20000;

  it('kendi geçerli örneklerini AYIRT EDEBİLİYOR — yani ölçüt bozuk değil, YETERSİZ', () => {
    const rejected = arinc429Plugin.exampleFrames
      .filter((example) => !hypotheticalParityOnlyGuard(example.bytes))
      .map((example) => example.id)
      .sort();
    // Kasten bozuk iki örnek reddediliyor, geri kalan altısı geçiyor. Ölçütün
    // kendisi ÇALIŞIYOR; sorun ayırt ediciliğinin düşük olması.
    expect(rejected).toEqual(['not-word-aligned', 'parity-error']);
  });

  it('N=1: paritesi kasten ayarlanmış rastgele 4 bayt → %100 geçer (ölçüt hiçbir şey elemiyor)', () => {
    const nextByte = createRandomByteSource(0x1f3a55);
    let accepted = 0;
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      if (hypotheticalParityOnlyGuard(buildParityCorrectBlock(nextByte, 1))) accepted += 1;
    }
    expect(accepted).toBe(SAMPLE_COUNT);
  });

  it('N=8: parite ZATEN ayarlıysa 2⁻⁸ koruması ÇALIŞMAZ → yine %100 geçer', () => {
    const nextByte = createRandomByteSource(0x2b7c11);
    let accepted = 0;
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      if (hypotheticalParityOnlyGuard(buildParityCorrectBlock(nextByte, 8))) accepted += 1;
    }
    // İşte kararın çekirdeği: word sayısını artırmak KORUMA SAĞLAMIYOR.
    expect(accepted).toBe(SAMPLE_COUNT);
  });

  it('KARŞILAŞTIRMA — parite AYARLANMAMIŞ rastgele bloklarda oran 2⁻ᴺ’ye oturuyor', () => {
    // Ölçütün TEK gerçek gücü bu ve yalnız pariteyi ayarlamayan girdiye karşı.
    const RATE_SAMPLE_COUNT = 60000;
    for (const wordCount of [1, 2, 4, 8]) {
      const nextByte = createRandomByteSource(0x3d91a7 + wordCount);
      let accepted = 0;
      for (let index = 0; index < RATE_SAMPLE_COUNT; index += 1) {
        const bytes = new Uint8Array(wordCount * 4);
        for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) bytes[byteIndex] = nextByte();
        if (hypotheticalParityOnlyGuard(bytes)) accepted += 1;
      }
      const rate = accepted / RATE_SAMPLE_COUNT;
      expect(rate, `N=${String(wordCount)} kabul oranı`).toBeGreaterThan(2 ** -wordCount * 0.75);
      expect(rate, `N=${String(wordCount)} kabul oranı`).toBeLessThan(2 ** -wordCount * 1.25);
    }
  });

  it('canParse bunların HİÇBİRİNİ kabul etmiyor — ölçüt motora BAĞLI DEĞİL', () => {
    const nextByte = createRandomByteSource(0x55aa33);
    let parityOnlyAccepted = 0;
    let canParseAccepted = 0;
    for (let index = 0; index < 2000; index += 1) {
      const block = buildParityCorrectBlock(nextByte, 1 + (index % 8));
      if (hypotheticalParityOnlyGuard(block)) parityOnlyAccepted += 1;
      if (arinc429Parser.canParse(block)) canParseAccepted += 1;
    }
    // Sağlık kontrolü: ölçüt gerçekten koştu ve gerçekten kabul etti…
    expect(parityOnlyAccepted).toBe(2000);
    // …ama canParse hiçbirini almadı.
    expect(canParseAccepted).toBe(0);
  });
});
