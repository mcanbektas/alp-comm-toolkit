/**
 * Bilinmeyen protokol analizi ekranının durumu.
 *
 * `useLiveMonitor` ile aynı düzen (Worker köprüsü + istek kimliği bekçisi) ama
 * akış YOK: analiz tek atımlıktır, girdi kullanıcı "Analiz et" deyince donar.
 * Bu yüzden ayrıştırma her tuş vuruşunda DEĞİL, yalnız o düğmede koşar —
 * 100 bin satırlık bir yapıştırmayı yazarken çözmek arayüzü kilitlerdi.
 *
 * ── İKİ GİRDİ KAYNAĞI, TEK ÇERÇEVE KÜMESİ ─────────────────────────────────
 * Yapıştırılan metin (`frameInput.ts`) ve Log Analyzer'ın çözdüğü dosya
 * (`parseLogInWorker`) aynı `AnalysisFrame[]`e iner. Dosya yolu METNE
 * dönüştürülmez: 100 bin kaydı bir `<textarea>`ya basmak tarayıcıyı kilitler
 * ve kullanıcı zaten o metni düzenlemeyecek.
 *
 * Geç gelen sonuç bekçisi `useLogAnalyzer`daki ile aynı: kullanıcı ilk analiz
 * bitmeden ikincisini başlatırsa birincinin raporu ekranı EZMEMELİ.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { framesFromLogRecords, parseFrameInput } from './frameInput';
import { parseLogInWorker } from '../../workers/parseLogInWorker';
import { startAnalysis } from '../../workers/analyzeInWorker';
import type { AnalysisProgress, AnalysisSession } from '../../workers/analyzeInWorker';
import type { FrameInputIssue, FrameInputMode } from './frameInput';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { AnalysisFrame } from '../../protocol-core/analysis/types';
import type { ReverseEngineeringReport } from '../../protocol-core/analysis/report';

/**
 * Statik bir dökümde anlamlı olan çerçeveleme yöntemleri. Zaman tabanlı
 * yöntemler (`inter-frame-timeout`…) BİLEREK yok: yapıştırılmış metinde baytlar
 * arası süre YOKTUR, o seçeneği sunmak olmayan bir ölçümü varmış gibi
 * göstermek olurdu.
 */
export const RE_FRAMING_METHODS = ['start-byte', 'fixed-length', 'line-ending', 'slip', 'cobs', 'hdlc-flag'] as const;

export type ReFramingMethod = (typeof RE_FRAMING_METHODS)[number];

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'cancelled' | 'error';

export interface ReverseEngineeringState {
  readonly status: AnalysisStatus;
  readonly report: ReverseEngineeringReport | undefined;
  readonly progress: AnalysisProgress | undefined;
  readonly elapsedMs: number | undefined;
  readonly error: string | undefined;
  /** Analize giren çerçeve sayısı; rapor gelmeden de gösterilir. */
  readonly frameCount: number;
  /**
   * Analize GİREN çerçeveler. Rapor bunları taşımaz (Worker'a paketlenip
   * gönderiliyorlar, geri dönmeleri ikinci bir kopya olurdu) ama §36 fark
   * paneli iki çerçeveyi yan yana koymak için ham baytlara muhtaç.
   */
  readonly frames: readonly AnalysisFrame[];
  readonly issues: readonly FrameInputIssue[];
  readonly truncated: boolean;
  readonly fileName: string | undefined;
}

const INITIAL_STATE: ReverseEngineeringState = {
  status: 'idle',
  report: undefined,
  progress: undefined,
  elapsedMs: undefined,
  error: undefined,
  frameCount: 0,
  frames: [],
  issues: [],
  truncated: false,
  fileName: undefined,
};

export interface ReverseEngineeringInput {
  readonly text: string;
  readonly mode: FrameInputMode;
  readonly framingMethod: ReFramingMethod;
  /** Yönteme göre okunur: imza/ayraç için hex, sabit uzunluk için sayı. */
  readonly framingParameter: string;
  /** Korelasyon için bilinen değer serisi; boşsa o adım boş geçer. */
  readonly knownValuesText: string;
}

const DEFAULT_INPUT: ReverseEngineeringInput = {
  // Spec 35060'ın RF telemetri seti: ekran boş açılmaz, ilk turda gerçek bir
  // sonuç gösterir (sabit başlık, artan sayaç, kuyrukta checksum adayı).
  text: ['AA AA 10 00 01 53 21', 'AA AA 10 00 02 61 38', 'AA AA 10 00 03 14 B7', 'AA AA 10 00 04 8F 42'].join('\n'),
  mode: 'lines',
  framingMethod: 'start-byte',
  framingParameter: 'AA AA',
  knownValuesText: '',
};

function parseHexSequence(text: string): number[] {
  const bytes: number[] = [];
  for (const token of text.split(/[\s,:-]+/)) {
    const cleaned = token.startsWith('0x') || token.startsWith('0X') ? token.slice(2) : token;
    if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) continue;
    for (let index = 0; index < cleaned.length; index += 2) {
      bytes.push(Number.parseInt(cleaned.slice(index, index + 2), 16));
    }
  }
  return bytes;
}

/** Boş dizi dönerse çağıran akış modunu çalıştırmaz — bkz. `buildFraming`. */
function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((token) => Number.parseFloat(token))
    .filter((value) => Number.isFinite(value));
}

export function buildFraming(input: ReverseEngineeringInput): FramingMethodConfig | undefined {
  switch (input.framingMethod) {
    case 'start-byte': {
      const startSequence = parseHexSequence(input.framingParameter);
      // İmzasız bir "başlangıç baytı" yöntemi çerçeve sınırı çizemez.
      return startSequence.length === 0 ? undefined : { method: 'start-byte', startSequence };
    }
    case 'fixed-length': {
      const frameLength = Number.parseInt(input.framingParameter, 10);
      return Number.isFinite(frameLength) && frameLength > 0 ? { method: 'fixed-length', frameLength } : undefined;
    }
    case 'line-ending': {
      const endSequence = parseHexSequence(input.framingParameter);
      return endSequence.length === 0 ? undefined : { method: 'line-ending', endSequence };
    }
    case 'slip':
      return { method: 'slip' };
    case 'cobs':
      return { method: 'cobs' };
    case 'hdlc-flag':
      return { method: 'hdlc-flag' };
  }
}

export interface ReverseEngineering {
  readonly input: ReverseEngineeringInput;
  readonly state: ReverseEngineeringState;
  readonly setInput: (patch: Partial<ReverseEngineeringInput>) => void;
  readonly analyze: () => void;
  readonly cancel: () => void;
  readonly loadFile: (file: File) => Promise<void>;
  /** Dosya kaynağını bırakıp yapıştırılan metne döner. */
  readonly clearFile: () => void;
}

export function useReverseEngineering(): ReverseEngineering {
  const [input, setInputState] = useState<ReverseEngineeringInput>(DEFAULT_INPUT);
  const [state, setState] = useState<ReverseEngineeringState>(INITIAL_STATE);

  const sessionRef = useRef<AnalysisSession | undefined>(undefined);
  const fileFramesRef = useRef<readonly AnalysisFrame[] | undefined>(undefined);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current?.cancel();
      sessionRef.current = undefined;
    };
  }, []);

  const setInput = useCallback((patch: Partial<ReverseEngineeringInput>) => {
    setInputState((current) => ({ ...current, ...patch }));
  }, []);

  const runAnalysis = useCallback(
    (frames: readonly AnalysisFrame[], issues: readonly FrameInputIssue[], truncated: boolean, knownValues: readonly number[]) => {
      sessionRef.current?.cancel();
      const requestId = ++requestIdRef.current;

      setState((current) => ({
        ...current,
        status: 'analyzing',
        report: undefined,
        progress: undefined,
        elapsedMs: undefined,
        error: undefined,
        frameCount: frames.length,
        frames,
        issues,
        truncated,
      }));

      // Seri uzunluğu çerçeve sayısına eşit değilse motor zaten boş döner;
      // burada da geçirmemek kullanıcıya sessiz bir "sonuç yok" yerine
      // hiç istenmemiş bir adım göstermez.
      const options = knownValues.length === frames.length && knownValues.length > 0 ? { knownValues } : {};

      sessionRef.current = startAnalysis(frames, options, {
        onProgress: (progress) => {
          if (!mountedRef.current || requestIdRef.current !== requestId) return;
          setState((current) => ({ ...current, progress }));
        },
        onResult: (report, elapsedMs) => {
          if (!mountedRef.current || requestIdRef.current !== requestId) return;
          setState((current) => ({ ...current, status: 'ready', report, elapsedMs, progress: undefined }));
        },
        onCancelled: (report) => {
          if (!mountedRef.current || requestIdRef.current !== requestId) return;
          setState((current) => ({ ...current, status: 'cancelled', report, progress: undefined }));
        },
        onFailed: (message) => {
          if (!mountedRef.current || requestIdRef.current !== requestId) return;
          setState((current) => ({ ...current, status: 'error', error: message, progress: undefined }));
        },
      });
    },
    [],
  );

  const analyze = useCallback(() => {
    const knownValues = parseNumberList(input.knownValuesText);
    const fileFrames = fileFramesRef.current;
    if (fileFrames !== undefined) {
      runAnalysis(fileFrames, [], false, knownValues);
      return;
    }

    const framing = input.mode === 'stream' ? buildFraming(input) : undefined;
    const parsed = parseFrameInput(input.text, {
      mode: input.mode,
      ...(framing === undefined ? {} : { framing }),
    });
    runAnalysis(parsed.frames, parsed.issues, parsed.truncated, knownValues);
  }, [input, runAnalysis]);

  const cancel = useCallback(() => {
    sessionRef.current?.cancel();
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, status: 'analyzing', error: undefined, fileName: file.name }));

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { result } = await parseLogInWorker(bytes, file.name);
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      if (result.status === 'error') {
        // Log çekirdeğinin kendi hata mesajı taşınır; RE katmanı onu yeniden
        // yazarsa kullanıcı "PCAPNG desteklenmiyor" gibi yönlendirici bilgiyi
        // kaybeder.
        fileFramesRef.current = undefined;
        setState((current) => ({ ...current, status: 'error', error: result.message, frameCount: 0, frames: [] }));
        return;
      }

      const converted = framesFromLogRecords(result.records);
      fileFramesRef.current = converted.frames;
      setState((current) => ({
        ...current,
        status: 'idle',
        report: undefined,
        progress: undefined,
        error: undefined,
        frameCount: converted.frames.length,
        frames: converted.frames,
        issues: [],
        truncated: converted.truncated,
      }));
    } catch (cause) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      fileFramesRef.current = undefined;
      setState((current) => ({
        ...current,
        status: 'error',
        error: cause instanceof Error ? cause.message : String(cause),
      }));
    }
  }, []);

  const clearFile = useCallback(() => {
    fileFramesRef.current = undefined;
    setState((current) => ({ ...current, fileName: undefined, frameCount: 0, frames: [], truncated: false }));
  }, []);

  return { input, state, setInput, analyze, cancel, loadFile, clearFile };
}
