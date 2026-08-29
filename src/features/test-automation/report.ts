/**
 * Test raporu — spec §38'in rapor alanları (39433-39442): Test name, Start
 * time, End time, Pass, Fail, Timeout, Received frame, Expected value, Actual
 * value, Error details.
 *
 * İlk üçü ve sayaçlar koşunun tamamına, son dördü ADIMA aittir: "alınan
 * çerçeve" ya da "beklenen değer" bir koşunun değil tek bir doğrulamanın
 * özelliğidir. Spec bunu ayırmıyor ama tek düzeyde tutmak, 100 turluk bir
 * döngüde hangi turun hangi çerçeveyi aldığını GÖSTERİLEMEZ kılardı.
 *
 * ── SATIR BÜTÇESİ ─────────────────────────────────────────────────────────
 * Bir milyon adımlık bütçe (`MAX_EXECUTED_STEPS`) bir milyon rapor satırı
 * demek olabilir. Kaydedilen satır sayısı bu yüzden sınırlı, ama SAYAÇLAR
 * sınırsız sayar: kesilen şey ayrıntı, ölçüm değil. Kesildiği de raporda
 * yazar — sessizce kısaltılmış bir rapor, eksik olduğunu söylemeyen bir
 * rapordur.
 */

import { bytesToHex } from '../../protocol-core/buffers/representation';
import type { TestStepKind } from './scenario';

export type StepOutcome = 'pass' | 'fail' | 'timeout' | 'error';

export type RunStatus = 'passed' | 'failed' | 'cancelled' | 'error';

export interface StepResult {
  readonly stepId: string;
  readonly kind: TestStepKind;
  readonly label: string | undefined;
  /** `performance.timeOrigin + performance.now()` tabanında (bkz. `connection/types.ts`). */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly outcome: StepOutcome;
  /** Doğrulamanın gördüğü çerçeve; boşluklu onaltılık. */
  readonly receivedFrame: string | undefined;
  readonly expectedValue: string | undefined;
  readonly actualValue: string | undefined;
  readonly errorDetails: string | undefined;
  /** `log` adımının çözülmüş metni. */
  readonly message: string | undefined;
  /** Döngü içindeyse 1 tabanlı tur numarası; döngü dışında `undefined`. */
  readonly iteration: number | undefined;
}

export interface TestReport {
  readonly testName: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly status: RunStatus;
  readonly passCount: number;
  readonly failCount: number;
  readonly timeoutCount: number;
  readonly errorCount: number;
  /** Yürütülen toplam adım — kaydedilen satırdan fazla olabilir. */
  readonly executedSteps: number;
  readonly steps: readonly StepResult[];
  /** Satır bütçesi yüzünden kesildiyse `true`. */
  readonly truncated: boolean;
}

/**
 * Kaydedilen azami satır. 5000 seçildi: 100 turluk bir döngünün 50 adımını
 * tamamen taşır (spec örneği 9 adım × 100 tur = 900) ve sanallaştırılmış bir
 * tabloda hâlâ akıcıdır.
 */
export const MAX_RECORDED_STEP_RESULTS = 5000;

/** Çerçeveyi rapor satırında okunur hâle getirir: `AA 05 10`. */
export function formatFrame(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/../g) ?? []).join(' ').toUpperCase();
}

export interface ReportBuilder {
  record(result: StepResult): void;
  readonly executedSteps: number;
  finish(status: RunStatus, endedAt: number): TestReport;
}

export function createReportBuilder(
  testName: string,
  startedAt: number,
  maxRecorded: number = MAX_RECORDED_STEP_RESULTS,
): ReportBuilder {
  const steps: StepResult[] = [];
  const counts: Record<StepOutcome, number> = { pass: 0, fail: 0, timeout: 0, error: 0 };
  let executed = 0;
  let truncated = false;

  return {
    record(result: StepResult): void {
      executed += 1;
      counts[result.outcome] += 1;
      if (steps.length < maxRecorded) steps.push(result);
      else truncated = true;
    },
    get executedSteps(): number {
      return executed;
    },
    finish(status: RunStatus, endedAt: number): TestReport {
      return {
        testName,
        startedAt,
        endedAt,
        status,
        passCount: counts.pass,
        failCount: counts.fail,
        timeoutCount: counts.timeout,
        errorCount: counts.error,
        executedSteps: executed,
        steps,
        truncated,
      };
    },
  };
}

/**
 * Raporun dosyaya yazılabilir hâli. MVP'de yalnız JSON: CSV bir raporun ağaç
 * yapısını (döngü turları) düzleştirmeyi gerektirir ve o düzleştirmenin
 * kuralını spec vermiyor.
 */
export function reportToJson(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}
