/**
 * Test senaryosu modeli — spec §38'in 13 adım tipi (39405-39417).
 *
 * Liste KAPALIDIR: spec ne verdiyse o. On dördüncü bir adım tipi uydurmak,
 * kullanıcıya spec'te olmayan bir söz vermek olurdu; eksik gelen bir ihtiyaç
 * varsa önce spec'e bakılır.
 *
 * Model tamamen JSON'a serileşir (`Uint8Array` yok, fonksiyon yok, sınıf yok):
 * senaryo dosyaya yazılacak ve §40'ın proje dosyasına girecek. Baytlar bu
 * yüzden `readonly number[]`tir — `Uint8Array` `JSON.stringify`de nesneye
 * dönüşür ve geri okurken sessizce boş dizi olur.
 *
 * `formatVersion` ilk sürümde de yazılır. Sonradan eklenen bir sürüm alanı,
 * "sürümsüz" dosyaların hangi şemaya ait olduğunu tahmin etmeyi gerektirir;
 * baştan yazılan bir alan bunu hiç doğurmaz.
 */

import type { ChecksumAlgorithm } from '../../protocol-core/checksums/algorithmCatalogue';
import type { Condition, Operand } from './conditions';

export const SCENARIO_FORMAT_VERSION = 1;

/**
 * §41 39570 "sonsuz loop engelle"nin sayıya dökülmüş hâli. `sendScheduler.ts`
 * aynı maddeyi aynı sayıyla karşılıyor (`maxCount = 1_000_000`); iki yerde iki
 * ayrı üst sınır, birinde düzeltilen bir hatayı ötekinde yaşatırdı.
 */
export const MAX_LOOP_COUNT = 1_000_000;

/**
 * Koşunun TOPLAM adım bütçesi. Tek başına döngü sınırı yetmez: iç içe üç
 * döngünün her biri sınırın altında kalıp çarpımda milyarlara çıkabilir.
 * Bütçe aşılırsa koşu hata ile biter — sessizce kısaltmak, kullanıcıya eksik
 * koşmuş bir testi tam gibi gösterirdi.
 */
export const MAX_EXECUTED_STEPS = 1_000_000;

/** Çerçeve içeriğine göre bekleme filtresi: `offset`ten itibaren bu baytlar. */
export interface FrameMatch {
  readonly offset: number;
  readonly bytes: readonly number[];
}

/**
 * Gönderilecek çerçevenin kaynağı. İki yol var çünkü iki gerçek kullanım var:
 * sabit bir "status request" çoğu cihazda elle yazılan birkaç bayttır; alan
 * değerleri değişen bir komut ise şablondan üretilmelidir. Şablon çözümü
 * koşucunun değil `ScenarioIo`nun işi — senaryo modeli paket şablonu
 * deposunu tanımaz.
 */
export type FramePayload =
  | { readonly source: 'bytes'; readonly bytes: readonly number[] }
  | { readonly source: 'template'; readonly templateId: string }
  /**
   * Ham yük, protokolün KENDİ encoder'ının zarfına sarılarak gider (spec §7'nin
   * `payload` ailesi). Üçüncü bir kaynak gerekiyor çünkü `bytes` çerçeveyi elle
   * yazdırır — bayrak, kaçışlama ve FCS'i kullanıcının hesaplamasını istemek,
   * test senaryosunu protokolün kendi kodunun DIŞINDA ikinci bir gerçekleme
   * hâline getirirdi.
   */
  | { readonly source: 'plugin-frame'; readonly pluginId: string; readonly bytes: readonly number[] };

export interface StepBase {
  /** Senaryo içinde tekil; rapor satırları buna bağlanır. */
  readonly id: string;
  readonly label?: string;
}

export type TestStep =
  | (StepBase & { readonly kind: 'connect' })
  | (StepBase & { readonly kind: 'disconnect' })
  | (StepBase & { readonly kind: 'send-frame'; readonly payload: FramePayload })
  | (StepBase & { readonly kind: 'wait'; readonly durationMs: number })
  | (StepBase & {
      readonly kind: 'wait-for-frame';
      readonly timeoutMs: number;
      /** Verilmezse ilk gelen çerçeve kabul edilir. */
      readonly match?: FrameMatch;
    })
  | (StepBase & { readonly kind: 'validate-field'; readonly condition: Condition })
  | (StepBase & {
      readonly kind: 'validate-crc';
      readonly algorithm: ChecksumAlgorithm;
      /** Kapsanan verinin başladığı ofset (atlanan başlık baytı). */
      readonly dataStart: number;
      /** Checksum alanının çerçeve SONUNDAN geriye kaç bayt olduğu; 0 = son bayt(lar). */
      readonly trailingOffset: number;
      readonly endianness: 'big' | 'little';
    })
  | (StepBase & { readonly kind: 'set-variable'; readonly name: string; readonly value: Operand })
  | (StepBase & { readonly kind: 'increment-variable'; readonly name: string; readonly by: number })
  | (StepBase & { readonly kind: 'loop'; readonly count: number; readonly steps: readonly TestStep[] })
  | (StepBase & {
      readonly kind: 'conditional';
      readonly condition: Condition;
      readonly thenSteps: readonly TestStep[];
      readonly elseSteps: readonly TestStep[];
    })
  /** Mesajdaki `{ad}` yer tutucuları değişken değeriyle DOLDURULUR, çalıştırılmaz. */
  | (StepBase & { readonly kind: 'log'; readonly message: string })
  | (StepBase & { readonly kind: 'export-report' });

export type TestStepKind = TestStep['kind'];

export const TEST_STEP_KINDS: readonly TestStepKind[] = [
  'connect',
  'disconnect',
  'send-frame',
  'wait',
  'wait-for-frame',
  'validate-field',
  'validate-crc',
  'set-variable',
  'increment-variable',
  'loop',
  'conditional',
  'log',
  'export-report',
];

export interface TestScenario {
  readonly formatVersion: number;
  readonly name: string;
  readonly steps: readonly TestStep[];
}

export function createEmptyScenario(name: string): TestScenario {
  return { formatVersion: SCENARIO_FORMAT_VERSION, name, steps: [] };
}

export interface ScenarioIssue {
  /** Sorunlu adımın kimliği; senaryo düzeyindeki sorunlarda `undefined`. */
  readonly stepId: string | undefined;
  readonly message: string;
}

function walkSteps(steps: readonly TestStep[], visit: (step: TestStep) => void): void {
  for (const step of steps) {
    visit(step);
    if (step.kind === 'loop') walkSteps(step.steps, visit);
    if (step.kind === 'conditional') {
      walkSteps(step.thenSteps, visit);
      walkSteps(step.elseSteps, visit);
    }
  }
}

/**
 * Koşudan ÖNCE yakalanabilecek hataları toplar. Koşucu bunu çağırır ve sorun
 * varsa hiç başlamaz: yarısı koşmuş bir senaryonun raporu, hiç koşmamış bir
 * senaryonunkinden daha yanıltıcıdır — cihaza gerçekten çerçeve gönderilmiş
 * olur.
 */
export function validateScenario(scenario: TestScenario): ScenarioIssue[] {
  const issues: ScenarioIssue[] = [];

  if (scenario.name.trim().length === 0) {
    issues.push({ stepId: undefined, message: 'senaryo adı boş' });
  }
  if (scenario.formatVersion !== SCENARIO_FORMAT_VERSION) {
    issues.push({
      stepId: undefined,
      message: `bilinmeyen biçim sürümü: ${scenario.formatVersion} (beklenen ${SCENARIO_FORMAT_VERSION})`,
    });
  }

  const seen = new Set<string>();
  walkSteps(scenario.steps, (step) => {
    if (seen.has(step.id)) {
      issues.push({ stepId: step.id, message: `adım kimliği tekrar ediyor: ${step.id}` });
    }
    seen.add(step.id);

    switch (step.kind) {
      case 'wait':
        if (!Number.isFinite(step.durationMs) || step.durationMs < 0) {
          issues.push({ stepId: step.id, message: 'bekleme süresi negatif ya da sayı değil' });
        }
        break;
      case 'wait-for-frame':
        if (!Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) {
          issues.push({ stepId: step.id, message: 'zaman aşımı pozitif olmalı' });
        }
        break;
      case 'loop':
        if (!Number.isInteger(step.count) || step.count < 1) {
          issues.push({ stepId: step.id, message: 'döngü sayısı 1 ya da daha büyük bir tam sayı olmalı' });
        } else if (step.count > MAX_LOOP_COUNT) {
          issues.push({ stepId: step.id, message: `döngü sayısı üst sınırı ${MAX_LOOP_COUNT}` });
        }
        if (step.steps.length === 0) {
          issues.push({ stepId: step.id, message: 'döngü boş' });
        }
        break;
      case 'send-frame':
        if (step.payload.source === 'bytes' && step.payload.bytes.length === 0) {
          issues.push({ stepId: step.id, message: 'gönderilecek bayt yok' });
        }
        if (step.payload.source === 'template' && step.payload.templateId.length === 0) {
          issues.push({ stepId: step.id, message: 'şablon seçilmedi' });
        }
        if (step.payload.source === 'plugin-frame') {
          if (step.payload.pluginId.length === 0) {
            issues.push({ stepId: step.id, message: 'protokol encoder\'ı seçilmedi' });
          }
          // Boş yük geçerlidir: bazı zarflar (HDLC) yüksüz de anlamlı bir
          // çerçeve üretir. Aralık dışı bayt ise sessizce kırpılamaz.
          if (step.payload.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) {
            issues.push({ stepId: step.id, message: 'yük baytı 0-255 aralığında olmalı' });
          }
        }
        break;
      case 'set-variable':
      case 'increment-variable':
        if (step.name.trim().length === 0) {
          issues.push({ stepId: step.id, message: 'değişken adı boş' });
        }
        break;
      default:
        break;
    }
  });

  return issues;
}
