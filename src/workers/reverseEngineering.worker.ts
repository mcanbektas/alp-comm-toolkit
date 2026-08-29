/**
 * Bilinmeyen protokol analizi Worker köprüsü — spec §35/§36, §44 (39680-39692:
 * "ağır analiz Worker'da, iptal edilebilir, progress göstergesi").
 *
 * Analizin kendisi (`protocol-core/analysis`) burada TEKRAR YAZILMAZ; bu dosya
 * yalnız `postMessage` protokolüdür — `streamParser.worker.ts` ve
 * `logAnalyzer.worker.ts` ile aynı düzen, `self` yine dar `declare` ile
 * tanımlanır (`WebWorker` kitaplığı `DOM` ile çakışır).
 *
 * ── İPTAL BURADA GERÇEKTİR ────────────────────────────────────────────────
 * `logAnalyzer.worker.ts` iptali "sonucu at" diye tanımlamak zorundaydı, çünkü
 * `parseLogFile` tek parça senkron bir çağrı. Analiz öyle değil: adımlara
 * bölünmüş (`createAnalysisRunner`) ve adımlar arasında kontrol makro göreve
 * (`schedule`) bırakılıyor. Worker o aralıkta mesaj kuyruğunu boşaltır, `cancel`
 * mesajı GÖRÜLÜR ve kalan adımlar hiç koşmaz. Karşılığında kısmi rapor döner —
 * kullanıcı iptal ettiği analizden tamamlanmış adımları yine de görür.
 *
 * Adım içindeki tek pahalı iş checksum taramasıdır; ona ayrıca `shouldCancel`
 * geçiliyor, o da kendi içinde erken çıkıyor.
 *
 * ── ÇERÇEVELER PAKETLİ GELİR ──────────────────────────────────────────────
 * Girdi `AnalysisFrame[]` değil `PackedFrames`: üç tampon, transfer listesiyle
 * kopyasız aktarılır (`packedFrames.ts`).
 */

import { createAnalysisRunner } from '../protocol-core/analysis/report';
import { unpackFrames } from '../protocol-core/analysis/packedFrames';
import type { PackedFrames } from '../protocol-core/analysis/packedFrames';
import type {
  AnalysisPhase,
  ReverseEngineeringOptions,
  ReverseEngineeringReport,
} from '../protocol-core/analysis/report';

export interface ReverseEngineeringAnalyzeMessage {
  readonly type: 'analyze';
  /** İstek kimliği: geç gelen sonucun hangi analize ait olduğu buradan bilinir. */
  readonly requestId: number;
  readonly frames: PackedFrames;
  readonly options?: ReverseEngineeringOptions;
}

export interface ReverseEngineeringCancelMessage {
  readonly type: 'cancel';
  /** Verilmezse KOŞAN analiz iptal edilir. */
  readonly requestId?: number;
}

export type ReverseEngineeringInMessage = ReverseEngineeringAnalyzeMessage | ReverseEngineeringCancelMessage;

export interface ReverseEngineeringProgressMessage {
  readonly type: 'progress';
  readonly requestId: number;
  readonly phase: AnalysisPhase;
  readonly completed: number;
  readonly total: number;
}

export interface ReverseEngineeringResultMessage {
  readonly type: 'result';
  readonly requestId: number;
  readonly report: ReverseEngineeringReport;
  readonly elapsedMs: number;
}

export interface ReverseEngineeringCancelledMessage {
  readonly type: 'cancelled';
  readonly requestId: number;
  /** İptal anına kadar tamamlanan adımların raporu. */
  readonly report: ReverseEngineeringReport;
}

export interface ReverseEngineeringFailedMessage {
  readonly type: 'failed';
  readonly requestId: number;
  readonly message: string;
}

export type ReverseEngineeringOutMessage =
  | ReverseEngineeringProgressMessage
  | ReverseEngineeringResultMessage
  | ReverseEngineeringCancelledMessage
  | ReverseEngineeringFailedMessage;

export type PostAnalysisMessageFn = (message: ReverseEngineeringOutMessage) => void;

export interface AnalysisWorkerHooks {
  /** Adımlar arasında kontrolü bırakma yolu; testte senkron bir kuyruk verilir. */
  readonly schedule?: (task: () => void) => void;
  readonly now?: () => number;
}

/**
 * Mesaj işleyicisi — `self` bağlamından KOPARILMIŞ saf fabrika; gerçek bir
 * Worker global'i olmadan (Vitest) doğrudan test edilir.
 */
export function createReverseEngineeringHandler(
  post: PostAnalysisMessageFn,
  hooks: AnalysisWorkerHooks = {},
): (message: ReverseEngineeringInMessage) => void {
  const schedule = hooks.schedule ?? ((task: () => void) => setTimeout(task, 0));
  const now = hooks.now ?? (() => Date.now());

  let activeRequestId: number | undefined;
  let cancelledRequestId: number | undefined;

  return function handleMessage(message: ReverseEngineeringInMessage): void {
    if (message.type === 'cancel') {
      cancelledRequestId = message.requestId ?? activeRequestId;
      return;
    }

    const { requestId } = message;
    activeRequestId = requestId;
    if (cancelledRequestId === requestId) cancelledRequestId = undefined;
    const startedAt = now();

    let runner;
    try {
      const frames = unpackFrames(message.frames);
      runner = createAnalysisRunner(frames, message.options ?? {}, {
        shouldCancel: () => cancelledRequestId === requestId,
      });
    } catch (cause) {
      // Motorların sözleşmesi "çökme yok"tur; yine de beklenmedik bir istisna
      // ana iş parçacığını sonsuza kadar "analiz ediliyor"da bırakmasın.
      post({ type: 'failed', requestId, message: cause instanceof Error ? cause.message : String(cause) });
      return;
    }

    const total = runner.steps.length;
    let index = 0;

    const runNext = (): void => {
      if (cancelledRequestId === requestId) {
        cancelledRequestId = undefined;
        activeRequestId = undefined;
        post({ type: 'cancelled', requestId, report: runner.snapshot() });
        return;
      }

      const step = runner.steps[index];
      if (step === undefined) {
        activeRequestId = undefined;
        post({ type: 'result', requestId, report: runner.snapshot(), elapsedMs: now() - startedAt });
        return;
      }

      try {
        step.run();
      } catch (cause) {
        activeRequestId = undefined;
        post({ type: 'failed', requestId, message: cause instanceof Error ? cause.message : String(cause) });
        return;
      }

      index += 1;
      post({ type: 'progress', requestId, phase: step.phase, completed: index, total });
      // Kontrol burada bırakılır: Worker bu aralıkta `cancel` mesajını görür.
      schedule(runNext);
    };

    schedule(runNext);
  };
}

declare const self: {
  onmessage: ((event: { data: ReverseEngineeringInMessage }) => void) | null;
  postMessage: (message: ReverseEngineeringOutMessage) => void;
};

const handleMessage = createReverseEngineeringHandler((message) => {
  self.postMessage(message);
});
self.onmessage = (event) => {
  handleMessage(event.data);
};
