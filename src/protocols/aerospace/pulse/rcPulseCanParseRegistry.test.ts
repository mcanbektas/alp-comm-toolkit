import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { ppmParser, ppmPlugin } from '../ppm/ppm';
import { pwmServoParser, pwmServoPlugin } from '../pwmServo/pwmServo';
import type { ExampleFrame } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15e — `ppm`/`pwm-servo` `canParse` bekçisi
 * (`j1850CanParseRegistry.test.ts`/`dronecanCanParseRegistry.test.ts` emsali,
 * brif "canParse — bu dalganın EN RİSKLİ bekçisi" bölümü).
 *
 * **Bu dosya `rc/rcCanParseRegistry.test.ts` (15c/15d, sbus/ibus/crsf) İLE
 * AYRI kalır — ona dokunulmadı.** `ppm`/`pwm-servo` `pulseLog.ts` paylaşıyor
 * (`packedChannels.ts` DEĞİL), o dosyanın kendi başı bunu zaten önceden not
 * etmişti (*"RC ailesinin son iki kardeşi geldiğinde bu ölçüm YENİDEN
 * alınmalı"*) — ama `pulseLog.ts` tüketicileri için bekçi zaten AYRI bir
 * dosyada yaşıyor (`j1850CanParseRegistry.test.ts`, `sentSpcCanParseRegistry
 * .test.ts`), bu yüzden burada da YENİ, AYRI bir dosya açılıyor (brifin
 * verdiği yol: `src/protocols/aerospace/pulse/rcPulseCanParseRegistry.test.ts`).
 *
 * ── Bu bekçi NEDEN sbus/ibus/crsf'inkinden FARKLI bir sınıf ─────────────────
 * `ppmParser.canParse`/`pwmServoParser.canParse` **KALİBRASYONSUZ DAİMA
 * `false`** döner (`ppm.ts`/`pwmServo.ts` dosya başı, `uavcanCompatibility
 * .ts`in "canParse DAİMA false" kararıyla AYNI SINIF) — `ProtocolParser
 * .canParse(data: Uint8Array): boolean` imzası `decodeOptions`a hiçbir zaman
 * ulaşamadığı için bu SABİT bir fonksiyondur, girdiye bakmaz. Yani:
 *
 *  1. İLERİ YÖN (registry'nin geri kalanı → ppm/pwm-servo): SONUÇ ÖNCEDEN
 *     BELLİDİR — sıfır, HER ZAMAN. Yine de ÖLÇÜLÜR (varsayılmaz): tarama
 *     gerçekten TÜM registry'yi geziyor mu, `canParse` gerçekten çağrılıyor
 *     mu — bunlar test edilmeden "zaten false dönüyor" savı KANITSIZ kalırdı.
 *  2. TERS YÖN (ppm/pwm-servo'nun KENDİ örnekleri → kendi canParse'ı):
 *     AYNI SEBEPLE sıfır — kendi geçerli örnek çerçeveleri bile canParse'ı
 *     GEÇEMEZ. Bu, "otomatik algılamaya HİÇ girmeyen" kararın kanıtıdır.
 *  3. "EN ZAYIF HALKA" (ana thread'in ek uyarısı — bekçi ölçümüne güvenme,
 *     KALIBI sına): sbus/ibus/crsf'in dersi *"registry'nin sıfırı imzayı
 *     KANITLAMAZ"* — burada imza zaten YOK (sabit `false`), o yüzden asıl
 *     risk BAŞKA bir yerde: birileri ileride "kalibrasyon varsa canParse
 *     içerik kontrolü yapabilir" diye bu fonksiyonu GENİŞLETİRSE, en kolay
 *     kandırılacak girdiler NELERDİR? Üç kategori ELLE kurgulanır ve HER
 *     BİRİNİN sıfır kabul ettiği ayrıca doğrulanır: (a) rastgele-ama-çift-
 *     uzunluklu arabellekler, (b) TÜM nabızları makul bir RC kanal bandında
 *     (1000-2000 µs) olan "kalibrasyona uyar gibi görünen" uydurma nabız
 *     dizileri, (c) konteynerin kendi sınır değerleri (tümü rezerve, tümü
 *     doygun, asgari/azami uzunluk, gerçek ppm/pwm-servo örnek baytları).
 */

const REGISTRY_EXAMPLE_HEALTH_THRESHOLD = 700;

function ownExamples(): readonly { readonly source: 'ppm' | 'pwm-servo'; readonly example: ExampleFrame }[] {
  return [
    ...ppmPlugin.exampleFrames.map((example) => ({ source: 'ppm' as const, example })),
    ...pwmServoPlugin.exampleFrames.map((example) => ({ source: 'pwm-servo' as const, example })),
  ];
}

describe('PPM/PWM Servo canParse — registry çapında tarama (İLERİ YÖN, bekçi)', () => {
  it(
    'ppm/pwm-servo DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === ppmPlugin.id || id === pwmServoPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (ppmParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → ppm canParse=true (${String(example.bytes.length)} bayt)`);
          }
          if (pwmServoParser.canParse(example.bytes)) {
            collisions.push(
              `${id}/${example.id} → pwm-servo canParse=true (${String(example.bytes.length)} bayt)`,
            );
          }
        }
      }

      // Sağlık kontrolü — tarama gerçekten TAM registry üzerinde koştu mu (14f'in dersi).
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(REGISTRY_EXAMPLE_HEALTH_THRESHOLD);
      expect(collisions, `beklenmeyen kabuller (${String(collisions.length)}):\n${collisions.join('\n')}`).toEqual(
        [],
      );
    },
    20000,
  );

  it(
    'ppm/pwm-servo’nun KENDİ örnekleri de kendi (ve birbirinin) canParse’ını GEÇEMEZ (TERS YÖN)',
    () => {
      const candidates = ownExamples();
      const collisions: string[] = [];

      for (const { source, example } of candidates) {
        if (ppmParser.canParse(example.bytes)) {
          collisions.push(`${source}/${example.id} → ppm canParse=true`);
        }
        if (pwmServoParser.canParse(example.bytes)) {
          collisions.push(`${source}/${example.id} → pwm-servo canParse=true`);
        }
      }

      expect(candidates.length, 'örnek sayısı beklenenden düşük — ppm/pwm-servo örnekleri gerçekten yüklendi mi?').toBeGreaterThan(
        6,
      );
      expect(collisions).toEqual([]);
    },
  );
});

/**
 * "EN ZAYIF HALKA" — ana thread'in ek uyarısı (bekçi ölçümüne güvenme, KALIBI
 * sına). `canParse` sabit `false` olduğu için sonuç HER ZAMAN sıfırdır; bu
 * describe blok bunu VARSAYMAK yerine üç kategoride ELLE kurgulanmış girdiyle
 * ÖLÇER ve sayıyı raporlar (`it` başlıkları taranan N'i taşır).
 */
describe('PPM/PWM Servo canParse — en zayıf halka (ana thread ek uyarısı)', () => {
  it(
    '200.000 rastgele-ama-çift-uzunluklu arabellek — sıfır kabul',
    () => {
      // Basit, tohum'lu (deterministik) bir PRNG — testin her koşuda AYNI
      // diziyi üretmesi için `Math.random()` yerine.
      let state = 0x2f6e2b1;
      function nextByte(): number {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state & 0xff;
      }

      const SAMPLE_COUNT = 200000;
      let ppmAccepted = 0;
      let pwmServoAccepted = 0;
      for (let i = 0; i < SAMPLE_COUNT; i += 1) {
        // Uzunluk 2-32 bayt arası, HER ZAMAN çift (nabız konteyneri madde 2).
        const pulseCount = 1 + (nextByte() % 16);
        const bytes = new Uint8Array(pulseCount * 2);
        for (let b = 0; b < bytes.length; b += 1) bytes[b] = nextByte();
        if (ppmParser.canParse(bytes)) ppmAccepted += 1;
        if (pwmServoParser.canParse(bytes)) pwmServoAccepted += 1;
      }

      expect(ppmAccepted, `ppm kabul sayısı (${String(SAMPLE_COUNT)} arabellek üzerinden)`).toBe(0);
      expect(
        pwmServoAccepted,
        `pwm-servo kabul sayısı (${String(SAMPLE_COUNT)} arabellek üzerinden)`,
      ).toBe(0);
    },
    20000,
  );

  it('hepsi makul bir RC kanal bandında (1000-2000 µs) olan uydurma nabız dizileri — sıfır kabul', () => {
    // "Kalibrasyona uyar gibi görünen" en zayıf halka: 2..16 kanal, her
    // nabız 1000-2000 µs bandında (tipik RC kalibrasyonu) + isteğe bağlı
    // uzun bir "sync gap benzeri" son nabız. Bu içerik BİR İNSANA "geçerli
    // bir PPM/PWM-servo yakalaması" gibi görünür — canParse YİNE DE reddeder.
    const buffers: Uint8Array[] = [];
    for (let channelCount = 2; channelCount <= 16; channelCount += 1) {
      const durations: number[] = [];
      for (let ch = 0; ch < channelCount; ch += 1) {
        durations.push(1000 + ((ch * 137) % 1000)); // 1000..1999 µs arası deterministik dağılım.
      }
      // (a) yalnız kanal nabızları, sync gap YOK.
      buffers.push(buildPulseBytes(durations));
      // (b) sonuna gerçekçi bir sync-gap-benzeri nabız eklenmiş hâli.
      buffers.push(buildPulseBytes([...durations, 4000]));
    }

    let ppmAccepted = 0;
    let pwmServoAccepted = 0;
    for (const bytes of buffers) {
      if (ppmParser.canParse(bytes)) ppmAccepted += 1;
      if (pwmServoParser.canParse(bytes)) pwmServoAccepted += 1;
    }

    expect(buffers.length, 'taranan uydurma nabız dizisi sayısı').toBeGreaterThan(20);
    expect(ppmAccepted).toBe(0);
    expect(pwmServoAccepted).toBe(0);
  });

  it('konteynerin kendi sınır değerleri (tümü rezerve, tümü doygun, asgari/azami) — sıfır kabul', () => {
    const boundaryBuffers: Uint8Array[] = [
      new Uint8Array(2), // asgari geçerli uzunluk: TEK nabız, REZERVE (0x0000).
      new Uint8Array(2).fill(0xff), // TEK nabız, DOYGUN (0xFFFF = 6553.5 µs).
      new Uint8Array(64).fill(0x00), // 32 nabız, HEPSİ rezerve.
      new Uint8Array(64).fill(0xff), // 32 nabız, HEPSİ doygun.
      buildPulseBytes([0.1]), // en küçük ölçülebilir süre (1 tik, 0.1 µs).
      buildPulseBytes(Array.from({ length: 32 }, () => 6553.5)), // konteynerin üst sınırında 32 nabız.
    ];

    let ppmAccepted = 0;
    let pwmServoAccepted = 0;
    for (const bytes of boundaryBuffers) {
      if (ppmParser.canParse(bytes)) ppmAccepted += 1;
      if (pwmServoParser.canParse(bytes)) pwmServoAccepted += 1;
    }

    expect(boundaryBuffers.length).toBeGreaterThanOrEqual(6);
    expect(ppmAccepted).toBe(0);
    expect(pwmServoAccepted).toBe(0);
  });

  it('ppm’in KENDİ “tipik 8 kanal” örneği pwm-servo’yu, pwm-servo’nun KENDİ örneği ppm’i YANLIŞLIKLA geçmez (çapraz kontrol)', () => {
    // 14f'in ölçtüğü "yalnız ilk nabza bakmak" tuzağı — burada zaten mümkün
    // DEĞİL (sabit false), ama çapraz kontrol yine de AÇIKÇA yazılır.
    for (const example of ppmPlugin.exampleFrames) {
      expect(pwmServoParser.canParse(example.bytes), `ppm/${example.id} → pwm-servo`).toBe(false);
    }
    for (const example of pwmServoPlugin.exampleFrames) {
      expect(ppmParser.canParse(example.bytes), `pwm-servo/${example.id} → ppm`).toBe(false);
    }
  });
});

/** Testin KENDİ nabız-günlüğü kurucusu — `ppm.ts`/`pwmServo.ts`teki `buildPulseLog`e BAĞIMLI DEĞİL (bu dosya ikisinden de bağımsız kalmalı). */
function buildPulseBytes(durationsUs: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(durationsUs.length * 2);
  durationsUs.forEach((durationUs, index) => {
    const register = Math.min(0xffff, Math.max(1, Math.round(durationUs / 0.1)));
    bytes[index * 2] = register & 0xff;
    bytes[index * 2 + 1] = (register >>> 8) & 0xff;
  });
  return bytes;
}
