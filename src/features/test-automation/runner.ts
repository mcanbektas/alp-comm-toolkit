/**
 * Senaryo koşucusu — spec §38'in adım makinesi.
 *
 * ── DIŞ DÜNYA ENJEKTE EDİLİR ──────────────────────────────────────────────
 * Koşucu ne bir porta ne bir zamanlayıcıya doğrudan dokunur; hepsi
 * `ScenarioIo` arkasında. İki sebep: (1) birim testi gerçek zaman
 * beklemeden bütün dallardan geçebiliyor, (2) Web Serial'in kullanıcı jesti
 * zinciri ekranda kalıyor — koşucu `requestPort()` çağırmaya kalksaydı
 * §41 39562'nin izin kuralını ekrandan koparırdı.
 *
 * Aynı gerekçe koşucunun Worker'a TAŞINMAMASININ da sebebi: adımlar I/O
 * bekler, CPU yakmaz; Worker'a taşımak port sahipliğini ve jest zincirini
 * bölerdi (brif karar 1).
 *
 * ── DURMA KURALI ──────────────────────────────────────────────────────────
 * Spec bir adım başarısız olunca ne olacağını SÖYLEMİYOR. Varsayılan durmak:
 * bağlanamamış bir porta gönderilen 99 çerçevenin raporu, ilk satırdan sonra
 * bilgi taşımaz ve gerçek hatayı gürültüye gömer. `stopOnFailure: false`
 * isteyen (ör. 100 turun kaçında hata çıktığını sayan bir dayanıklılık testi)
 * bunu açıkça seçer.
 *
 * Koşmayan adımlar rapora YAZILMAZ. "Atlandı" satırları döngü içinde
 * milyonlarca satır üretebilirdi; nereye kadar koşulduğu `executedSteps`ten
 * okunur.
 *
 * ── ZAMAN TABANI ──────────────────────────────────────────────────────────
 * `now()` de enjekte: ölçüm `performance.timeOrigin + performance.now()`
 * tabanında olmalı (`connection/types.ts` başlık yorumu), `Date.now()` NTP
 * düzeltmesiyle geriye sıçrayabilir ve süreler negatife düşerdi.
 */

import { createReportBuilder, formatFrame } from './report';
import { describeCondition, evaluateCondition, evaluateOperand } from './conditions';
import { MAX_EXECUTED_STEPS, validateScenario } from './scenario';
import { checksumWidthBytes, computeChecksum, readStoredChecksum } from '../../protocol-core/checksums/algorithmCatalogue';
import type { EvaluationContext } from './conditions';
import type { RunStatus, StepOutcome, StepResult, TestReport } from './report';
import type { FrameMatch, TestScenario, TestStep } from './scenario';

export interface ReceivedFrame {
  readonly bytes: Uint8Array;
  readonly receivedAt: number;
}

export interface WaitForFrameRequest {
  readonly timeoutMs: number;
  /** Verilmezse ilk gelen çerçeve kabul edilir. */
  readonly match: FrameMatch | undefined;
}

export interface ScenarioIo {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  /** Zaman aşımında `undefined` döner — bu bir hata değil, bir SONUÇTUR. */
  waitForFrame(request: WaitForFrameRequest): Promise<ReceivedFrame | undefined>;
  sleep(durationMs: number): Promise<void>;
  /** Paket şablonundan çerçeve üretir; şablon deposunu koşucu tanımaz. */
  encodeTemplate(templateId: string): Promise<Uint8Array>;
  /**
   * Yükü protokolün kendi encoder'ının zarfına sarar. `Promise` döner çünkü
   * motor registry'de LAZY durur; koşucu registry'yi tanımaz, io katmanı tanır.
   */
  encodePluginFrame(pluginId: string, payload: Uint8Array): Promise<Uint8Array>;
  /** Bekleyen `sleep`/`waitForFrame` çağrılarını erken bitirir (iptal). */
  abort(): void;
  now(): number;
}

export interface RunOptions {
  readonly stopOnFailure?: boolean;
  readonly maxExecutedSteps?: number;
  readonly maxRecordedSteps?: number;
  /** Her adım kaydedildiğinde çağrılır; ekran ilerlemeyi böyle gösterir. */
  readonly onStep?: (result: StepResult) => void;
}

export interface TestRun {
  readonly report: Promise<TestReport>;
  cancel(): void;
}

interface StepOutcomeDetail {
  readonly outcome: StepOutcome;
  readonly receivedFrame?: string;
  readonly expectedValue?: string;
  readonly actualValue?: string;
  readonly errorDetails?: string;
  readonly message?: string;
}

/** Adım koşmadan biten bir dal: iptal ya da bütçe. Rapora satır yazılmaz. */
type ControlSignal = 'continue' | 'stop';

function matches(frame: Uint8Array, match: FrameMatch | undefined): boolean {
  if (match === undefined) return true;
  if (match.offset + match.bytes.length > frame.length) return false;
  return match.bytes.every((byte, index) => frame[match.offset + index] === byte);
}

/**
 * `{ad}` yer tutucularını değişken değeriyle doldurur. Tanımsız değişken
 * yerinde BIRAKILIR: bir günlük satırı testi düşürmemeli, ama eksik değeri
 * de sessizce boşluğa çevirmemeli — okuyan `{sicaklik}` görüp fark eder.
 */
function interpolate(message: string, variables: ReadonlyMap<string, number>): string {
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = variables.get(name);
    return value === undefined ? whole : String(value);
  });
}

export function runScenario(scenario: TestScenario, io: ScenarioIo, options: RunOptions = {}): TestRun {
  const stopOnFailure = options.stopOnFailure ?? true;
  const maxExecutedSteps = options.maxExecutedSteps ?? MAX_EXECUTED_STEPS;

  const startedAt = io.now();
  const builder = createReportBuilder(scenario.name, startedAt, options.maxRecordedSteps);

  const variables = new Map<string, number>();
  let lastFrame: Uint8Array | undefined;
  let cancelled = false;
  let failed = false;
  let errored = false;
  let budgetExceeded = false;

  const context = (): EvaluationContext => ({ variables, lastFrame });

  function record(step: TestStep, iteration: number | undefined, stepStartedAt: number, detail: StepOutcomeDetail): void {
    const result: StepResult = {
      stepId: step.id,
      kind: step.kind,
      label: step.label,
      startedAt: stepStartedAt,
      endedAt: io.now(),
      outcome: detail.outcome,
      receivedFrame: detail.receivedFrame,
      expectedValue: detail.expectedValue,
      actualValue: detail.actualValue,
      errorDetails: detail.errorDetails,
      message: detail.message,
      iteration,
    };
    builder.record(result);
    options.onStep?.(result);

    if (detail.outcome === 'error') errored = true;
    if (detail.outcome === 'fail' || detail.outcome === 'timeout') failed = true;
  }

  async function payloadBytes(step: Extract<TestStep, { kind: 'send-frame' }>): Promise<Uint8Array> {
    if (step.payload.source === 'bytes') return Uint8Array.from(step.payload.bytes);
    if (step.payload.source === 'plugin-frame') {
      return io.encodePluginFrame(step.payload.pluginId, Uint8Array.from(step.payload.bytes));
    }
    return io.encodeTemplate(step.payload.templateId);
  }

  function runValidateCrc(step: Extract<TestStep, { kind: 'validate-crc' }>): StepOutcomeDetail {
    const frame = lastFrame;
    if (frame === undefined) {
      return { outcome: 'error', errorDetails: 'henüz çerçeve alınmadı' };
    }
    const width = checksumWidthBytes(step.algorithm);
    if (width === 0) {
      return { outcome: 'error', errorDetails: `checksum algoritması seçilmedi (${step.algorithm})` };
    }
    const checksumStart = frame.length - step.trailingOffset - width;
    if (step.dataStart < 0 || checksumStart < step.dataStart) {
      return {
        outcome: 'error',
        receivedFrame: formatFrame(frame),
        errorDetails: `checksum alanı çerçeveye sığmıyor: ${frame.length} bayt, veri ${step.dataStart}, kuyruk ${step.trailingOffset}`,
      };
    }

    const computed = computeChecksum(frame.subarray(step.dataStart, checksumStart), step.algorithm);
    if (computed === undefined) {
      return { outcome: 'error', errorDetails: `checksum hesaplanamadı: ${step.algorithm}` };
    }
    const stored = readStoredChecksum(frame.subarray(checksumStart, checksumStart + width), step.endianness);

    return {
      outcome: computed === stored ? 'pass' : 'fail',
      receivedFrame: formatFrame(frame),
      expectedValue: `0x${stored.toString(16).toUpperCase()}`,
      actualValue: `0x${computed.toString(16).toUpperCase()}`,
    };
  }

  async function executeStep(step: TestStep, iteration: number | undefined): Promise<ControlSignal> {
    if (cancelled) return 'stop';
    if (builder.executedSteps >= maxExecutedSteps) {
      budgetExceeded = true;
      return 'stop';
    }

    const stepStartedAt = io.now();

    // Döngü ve koşul KENDİLERİ bir sonuç üretmez; içlerindeki adımlar üretir.
    // Yine de rapora bir satır yazılır, yoksa iç adımların hangi döngüye ait
    // olduğu okunamaz.
    if (step.kind === 'loop') {
      record(step, iteration, stepStartedAt, { outcome: 'pass', actualValue: `${step.count} tur` });
      for (let turn = 1; turn <= step.count; turn += 1) {
        for (const child of step.steps) {
          const signal = await executeStep(child, turn);
          if (signal === 'stop') return 'stop';
        }
      }
      return 'continue';
    }

    if (step.kind === 'conditional') {
      const result = evaluateCondition(step.condition, context());
      if (result.status === 'unresolved') {
        record(step, iteration, stepStartedAt, {
          outcome: 'error',
          expectedValue: describeCondition(step.condition),
          errorDetails: result.reason,
        });
        return stopOnFailure ? 'stop' : 'continue';
      }
      const branch = result.status === 'true' ? step.thenSteps : step.elseSteps;
      record(step, iteration, stepStartedAt, {
        outcome: 'pass',
        expectedValue: describeCondition(step.condition),
        actualValue: result.status === 'true' ? 'then' : 'else',
      });
      for (const child of branch) {
        const signal = await executeStep(child, iteration);
        if (signal === 'stop') return 'stop';
      }
      return 'continue';
    }

    let detail: StepOutcomeDetail;
    try {
      detail = await executeLeafStep(step);
    } catch (cause) {
      detail = { outcome: 'error', errorDetails: cause instanceof Error ? cause.message : String(cause) };
    }

    record(step, iteration, stepStartedAt, detail);

    if (cancelled) return 'stop';
    if (stopOnFailure && detail.outcome !== 'pass') return 'stop';
    return 'continue';
  }

  async function executeLeafStep(step: TestStep): Promise<StepOutcomeDetail> {
    switch (step.kind) {
      case 'connect':
        await io.connect();
        return { outcome: 'pass' };

      case 'disconnect':
        await io.disconnect();
        return { outcome: 'pass' };

      case 'send-frame': {
        const bytes = await payloadBytes(step);
        await io.write(bytes);
        return { outcome: 'pass', actualValue: formatFrame(bytes) };
      }

      case 'wait':
        await io.sleep(step.durationMs);
        return { outcome: 'pass' };

      case 'wait-for-frame': {
        const frame = await io.waitForFrame({ timeoutMs: step.timeoutMs, match: step.match });
        if (frame === undefined) {
          return {
            outcome: 'timeout',
            expectedValue: step.match === undefined ? 'herhangi bir çerçeve' : formatFrame(Uint8Array.from(step.match.bytes)),
            errorDetails: `${step.timeoutMs} ms içinde çerçeve gelmedi`,
          };
        }
        // Filtre `ScenarioIo`da da uygulanabilir ama BURADA da uygulanır:
        // sözleşme "eşleşen çerçeve" demiyor, "bir çerçeve" diyor; eşleşmeyi
        // koşucunun garanti etmesi gerekir.
        if (!matches(frame.bytes, step.match)) {
          return {
            outcome: 'fail',
            receivedFrame: formatFrame(frame.bytes),
            expectedValue: formatFrame(Uint8Array.from(step.match?.bytes ?? [])),
            errorDetails: 'gelen çerçeve filtreye uymuyor',
          };
        }
        lastFrame = frame.bytes;
        return { outcome: 'pass', receivedFrame: formatFrame(frame.bytes) };
      }

      case 'validate-field': {
        const result = evaluateCondition(step.condition, context());
        const expected = describeCondition(step.condition);
        if (result.status === 'unresolved') {
          return { outcome: 'error', expectedValue: expected, errorDetails: result.reason };
        }
        return {
          outcome: result.status === 'true' ? 'pass' : 'fail',
          receivedFrame: lastFrame === undefined ? undefined : formatFrame(lastFrame),
          expectedValue: expected,
          actualValue: String(result.left),
        };
      }

      case 'validate-crc':
        return runValidateCrc(step);

      case 'set-variable': {
        const value = evaluateOperand(step.value, context());
        if (value.status === 'unresolved') {
          return { outcome: 'error', errorDetails: value.reason };
        }
        variables.set(step.name, value.value);
        return { outcome: 'pass', actualValue: `${step.name} = ${value.value}` };
      }

      case 'increment-variable': {
        const current = variables.get(step.name);
        if (current === undefined) {
          // Tanımsız değişkeni 0'dan artırmak, adı yanlış yazılmış bir
          // değişkeni sessizce var edip sayacı baştan başlatırdı.
          return { outcome: 'error', errorDetails: `değişken tanımsız: ${step.name}` };
        }
        const next = current + step.by;
        variables.set(step.name, next);
        return { outcome: 'pass', actualValue: `${step.name} = ${next}` };
      }

      case 'log':
        return { outcome: 'pass', message: interpolate(step.message, variables) };

      case 'export-report':
        // Adımın kendisi bir işaret: raporu ekran dışa aktarır, koşucu değil
        // (indirme bir DOM işi ve koşucu DOM'a dokunmuyor).
        return { outcome: 'pass' };

      // Döngü ve koşul `executeStep`te ele alınır; buraya düşmezler.
      case 'loop':
      case 'conditional':
        return { outcome: 'error', errorDetails: 'iç adım yanlış yolda' };
    }
  }

  function finalStatus(): RunStatus {
    if (cancelled) return 'cancelled';
    if (errored || budgetExceeded) return 'error';
    if (failed) return 'failed';
    return 'passed';
  }

  const report = (async (): Promise<TestReport> => {
    const issues = validateScenario(scenario);
    if (issues.length > 0) {
      // Geçersiz senaryo HİÇ koşmaz: yarısı koşmuş bir senaryo cihaza gerçek
      // çerçeveler göndermiş olur ve raporu "yapılmadı"dan daha yanıltıcıdır.
      errored = true;
      for (const issue of issues) {
        builder.record({
          stepId: issue.stepId ?? scenario.name,
          kind: 'log',
          label: undefined,
          startedAt,
          endedAt: startedAt,
          outcome: 'error',
          receivedFrame: undefined,
          expectedValue: undefined,
          actualValue: undefined,
          errorDetails: issue.message,
          message: undefined,
          iteration: undefined,
        });
      }
      return builder.finish('error', io.now());
    }

    for (const step of scenario.steps) {
      const signal = await executeStep(step, undefined);
      if (signal === 'stop') break;
    }

    if (budgetExceeded) {
      builder.record({
        stepId: scenario.name,
        kind: 'log',
        label: undefined,
        startedAt: io.now(),
        endedAt: io.now(),
        outcome: 'error',
        receivedFrame: undefined,
        expectedValue: undefined,
        actualValue: undefined,
        errorDetails: `adım bütçesi aşıldı (${maxExecutedSteps})`,
        message: undefined,
        iteration: undefined,
      });
    }

    return builder.finish(finalStatus(), io.now());
  })();

  return {
    report,
    cancel(): void {
      cancelled = true;
      // Bekleyen `sleep`/`waitForFrame` çözülmezse iptal ancak o adım bitince
      // görünürdü — 30 saniyelik bir beklemede kullanıcı 30 saniye bekler.
      io.abort();
    },
  };
}

/** Koşunun `export-report` adımına ulaşıp ulaşmadığı raporun dışında taşınır. */
export function reportRequestsExport(report: TestReport): boolean {
  return report.steps.some((step) => step.kind === 'export-report' && step.outcome === 'pass');
}
