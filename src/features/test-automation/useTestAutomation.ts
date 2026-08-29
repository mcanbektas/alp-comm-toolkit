/**
 * Test Automation Studio'nun durum yönetimi (spec §38).
 *
 * Senaryo modeli, koşul değerlendirici ve adım makinesi burada DEĞİL — hepsi
 * aynı klasördeki saf modüllerde (CLAUDE.md: "Protokol hesabı React
 * bileşeninin içine yazılmaz"). Bu dosya onları React yaşam döngüsüne,
 * bağlantı kaynağına ve tarayıcı deposuna bağlar.
 *
 * ── KAYNAK KOŞUDAN ÖNCE, TIKLAMA İÇİNDE AÇILIR ────────────────────────────
 * `requestPort()` kullanıcı jesti ister (§41 39562, `serialSource.ts:4`).
 * Koşucu bir port açmaya kalksaydı jest zinciri kopardı; bu yüzden kaynak
 * "Çalıştır" tıklamasının İÇİNDE kurulur ve koşucunun `connect` adımı yalnız
 * `start()` çağırır. Aynı sebeple koşucu Worker'a da taşınmadı.
 *
 * ── CANLI ADIM LİSTESİ RAPORDAN AYRI ──────────────────────────────────────
 * Koşu sürerken ekran adımları anında göstermeli, ama rapor ancak koşu
 * bitince oluşur. `steps` bu yüzden ayrı bir durum; `onStep` her satırda
 * ekliyor ve rapor bütçesiyle AYNI üst sınırda kesiliyor — 100 turluk bir
 * döngü React'e yüz binlerce satır itmemeli.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createByteSourceIo } from './byteSourceIo';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { createSimulatedDevice } from '@/connection/mock/simulatedDevice';
import { encodeTemplateFrame } from '@/features/packet-builder/packetTemplates';
import type { TemplateFrameFailure } from '@/features/packet-builder/packetTemplates';
import { createSerialSource } from '@/connection/serial/serialSource';
import { DEFAULT_SERIAL_OPTIONS } from '@/connection/serial/serialOptions';
import { getWebSerial, isWebSerialSupported } from '@/connection/serial/webSerialTypes';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { DEFAULT_DEVICE_RULES, DEFAULT_SCENARIO } from './defaultScenario';
import { MAX_RECORDED_STEP_RESULTS, reportToJson } from './report';
import { runScenario } from './runner';
import { SCENARIO_FORMAT_VERSION, validateScenario } from './scenario';
import { readStoredScenario, writeStoredScenario } from './scenarioStorage';
import type { ByteSourceScenarioIo } from './byteSourceIo';
import type { FramingMethodConfig } from '@/protocol-core/framing/createExtractor';
import type { StepResult, TestReport } from './report';
import type { TestRun } from './runner';
import type { TestScenario } from './scenario';

export { SCENARIO_STORAGE_KEY } from './scenarioStorage';

export type TestSourceKind = 'simulated-device' | 'serial';

/**
 * Statik bir cihaz akışında anlamlı çerçeveleme yöntemleri — RE ekranındaki
 * listeyle aynı gerekçe, bir farkla: burada gerçek bir tel var, o yüzden
 * zaman tabanlı yöntemler de anlamlı ve `byteSourceIo` `tick()`i sürüyor.
 */
export const TEST_FRAMING_METHODS = [
  'fixed-length',
  'start-byte',
  'line-ending',
  'inter-frame-timeout',
  'slip',
  'cobs',
  'hdlc-flag',
] as const;

export type TestFramingMethod = (typeof TEST_FRAMING_METHODS)[number];

export interface ConnectionConfig {
  readonly sourceKind: TestSourceKind;
  readonly framingMethod: TestFramingMethod;
  /** Yönteme göre okunur: imza/ayraç için hex, uzunluk ve süre için sayı. */
  readonly framingParameter: string;
}

export const DEFAULT_CONNECTION: ConnectionConfig = {
  sourceKind: 'simulated-device',
  framingMethod: 'fixed-length',
  framingParameter: '9',
};

/**
 * Ekranın koşu EVRESİ. `report.ts`teki `RunStatus`tan ayrı bir sorudur ve adı
 * da ayrı olmalı: o "test geçti mi", bu "koşu sürüyor mu".
 */
export type RunPhase = 'idle' | 'running' | 'finished';

export interface TestAutomationState {
  readonly status: RunPhase;
  readonly steps: readonly StepResult[];
  readonly report: TestReport | undefined;
  readonly errorMessage: string | undefined;
  /** Filtreye uymadığı için atılan çerçeve sayısı; koşu bitince yazılır. */
  readonly droppedFrames: number;
}

const INITIAL_STATE: TestAutomationState = {
  status: 'idle',
  steps: [],
  report: undefined,
  errorMessage: undefined,
  droppedFrames: 0,
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

export function buildFraming(connection: ConnectionConfig): FramingMethodConfig | undefined {
  const numeric = Number.parseInt(connection.framingParameter, 10);
  switch (connection.framingMethod) {
    case 'fixed-length':
      return Number.isFinite(numeric) && numeric > 0 ? { method: 'fixed-length', frameLength: numeric } : undefined;
    case 'inter-frame-timeout':
      return Number.isFinite(numeric) && numeric > 0 ? { method: 'inter-frame-timeout', timeoutMs: numeric } : undefined;
    case 'start-byte': {
      const startSequence = parseHexSequence(connection.framingParameter);
      return startSequence.length === 0 ? undefined : { method: 'start-byte', startSequence };
    }
    case 'line-ending': {
      const endSequence = parseHexSequence(connection.framingParameter);
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

export interface UseTestAutomationResult {
  readonly scenario: TestScenario;
  readonly connection: ConnectionConfig;
  readonly state: TestAutomationState;
  readonly issues: ReturnType<typeof validateScenario>;
  readonly serialSupported: boolean;
  readonly setScenario: (next: TestScenario) => void;
  readonly setConnection: (patch: Partial<ConnectionConfig>) => void;
  readonly run: () => Promise<void>;
  readonly cancel: () => void;
  readonly resetScenario: () => void;
  readonly importScenario: (file: File) => Promise<void>;
  readonly exportScenario: () => void;
  readonly exportReport: () => void;
}

/**
 * Şablon çözülemediğinde adım raporuna düşen tanı metni. Bu katmanın öteki
 * metinleri gibi (`runner.ts`: "değişken tanımsız: …") arayüz metni DEĞİL,
 * rapor satırındaki tanıdır; kullanıcı hangi şablonun neden çözülmediğini
 * görmeden koşuyu düzeltemez.
 */
const TEMPLATE_FAILURE_MESSAGES: Readonly<
  Record<TemplateFrameFailure, (detail: string | undefined) => string>
> = {
  'template-not-found': (detail) => `paket şablonu bulunamadı: ${detail ?? ''}`,
  'invalid-schema': () => 'Studio şeması çözülemedi',
  'schema-mismatch': (detail) =>
    `şablon başka bir şemaya ait: ${detail ?? ''} (Studio şeması değişmiş olabilir)`,
  'invalid-values': (detail) => `şablon değerleri çevrilemedi: ${detail ?? ''}`,
  'encode-failed': (detail) => `şablon kodlanamadı: ${detail ?? ''}`,
};

export function useTestAutomation(): UseTestAutomationResult {
  const [scenario, setScenarioState] = useState<TestScenario>(() => readStoredScenario() ?? DEFAULT_SCENARIO);
  const [connection, setConnectionState] = useState<ConnectionConfig>(DEFAULT_CONNECTION);
  const [state, setState] = useState<TestAutomationState>(INITIAL_STATE);

  const packetTemplates = useProtocolSchemaStore((store) => store.packetTemplates);
  const schemaJson = useProtocolSchemaStore((store) => store.schemaJson);

  const runRef = useRef<TestRun | undefined>(undefined);
  const ioRef = useRef<ByteSourceScenarioIo | undefined>(undefined);
  const mountedRef = useRef(true);
  /** Şablon deposunun EN SON hâli; `run` uzun ömürlü bir kapanış kuruyor. */
  const templateSourceRef = useRef({ templates: packetTemplates, schemaJson });
  useEffect(() => {
    templateSourceRef.current = { templates: packetTemplates, schemaJson };
  }, [packetTemplates, schemaJson]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current?.cancel();
      void ioRef.current?.dispose();
    };
  }, []);

  const setScenario = useCallback((next: TestScenario) => {
    setScenarioState(next);
    writeStoredScenario(next);
  }, []);

  const setConnection = useCallback((patch: Partial<ConnectionConfig>) => {
    setConnectionState((current) => ({ ...current, ...patch }));
  }, []);

  const issues = useMemo(() => validateScenario(scenario), [scenario]);

  const run = useCallback(async (): Promise<void> => {
    if (runRef.current !== undefined) return;

    const framing = buildFraming(connection);
    if (framing === undefined) {
      setState({ ...INITIAL_STATE, status: 'idle', errorMessage: 'framing-parameter' });
      return;
    }

    /**
     * Şablon deposu ADIM ÇALIŞIRKEN okunur, kapanış kurulurken değil: koşu
     * dakikalarca sürebilir ve kullanıcı bu sırada Packet Builder'da şablonu
     * güncelleyebilir. Donmuş bir liste, ekranda görünen şablonla gönderilen
     * çerçevenin ayrışması demekti — ref bunu tek satırla kapatıyor.
     */
    const encodeTemplate = async (templateId: string): Promise<Uint8Array> => {
      const { templates, schemaJson } = templateSourceRef.current;
      const result = encodeTemplateFrame(templateId, templates, schemaJson);
      if (!result.ok) {
        throw new Error(TEMPLATE_FAILURE_MESSAGES[result.reason](result.detail));
      }
      return result.bytes;
    };

    let io: ByteSourceScenarioIo;
    try {
      if (connection.sourceKind === 'serial') {
        const serial = getWebSerial();
        if (serial === undefined) throw new Error('unsupported');
        // Tıklama işleyicisinden SENKRON başlayan zincir: port seçimi burada.
        const port = await serial.requestPort({});
        io = createByteSourceIo({
          source: createSerialSource(port, DEFAULT_SERIAL_OPTIONS),
          framing,
          encodeTemplate,
        });
      } else {
        io = createByteSourceIo({
          source: createSimulatedDevice({ rules: DEFAULT_DEVICE_RULES }),
          framing,
          encodeTemplate,
        });
      }
    } catch (cause) {
      setState({ ...INITIAL_STATE, errorMessage: cause instanceof Error ? cause.message : String(cause) });
      return;
    }

    ioRef.current = io;
    setState({ status: 'running', steps: [], report: undefined, errorMessage: undefined, droppedFrames: 0 });

    const collected: StepResult[] = [];
    const testRun = runScenario(scenario, io, {
      onStep: (result) => {
        if (collected.length < MAX_RECORDED_STEP_RESULTS) collected.push(result);
        if (!mountedRef.current) return;
        // Dizi kopyalanarak veriliyor: React aynı referansı değişmemiş sayar.
        setState((current) => ({ ...current, steps: [...collected] }));
      },
    });
    runRef.current = testRun;

    const report = await testRun.report;
    runRef.current = undefined;
    await io.dispose();
    ioRef.current = undefined;

    if (!mountedRef.current) return;
    setState({
      status: 'finished',
      steps: report.steps,
      report,
      errorMessage: undefined,
      droppedFrames: io.droppedFrames,
    });
  }, [connection, scenario]);

  const cancel = useCallback(() => {
    runRef.current?.cancel();
  }, []);

  const resetScenario = useCallback(() => {
    setScenario(DEFAULT_SCENARIO);
  }, [setScenario]);

  const importScenario = useCallback(
    async (file: File): Promise<void> => {
      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (typeof parsed !== 'object' || parsed === null) throw new Error('scenario-invalid');
        const candidate = parsed as TestScenario;
        if (candidate.formatVersion !== SCENARIO_FORMAT_VERSION || !Array.isArray(candidate.steps)) {
          throw new Error('scenario-version');
        }
        setScenario(candidate);
        setState((current) => ({ ...current, errorMessage: undefined }));
      } catch (cause) {
        setState((current) => ({
          ...current,
          errorMessage: cause instanceof Error ? cause.message : String(cause),
        }));
      }
    },
    [setScenario],
  );

  const exportScenario = useCallback(() => {
    downloadTextFile(`${scenario.name || 'senaryo'}.json`, JSON.stringify(scenario, null, 2), 'application/json');
  }, [scenario]);

  const exportReport = useCallback(() => {
    const report = state.report;
    if (report === undefined) return;
    downloadTextFile(`${report.testName || 'rapor'}-rapor.json`, reportToJson(report), 'application/json');
  }, [state.report]);

  return {
    scenario,
    connection,
    state,
    issues,
    serialSupported: isWebSerialSupported(),
    setScenario,
    setConnection,
    run,
    cancel,
    resetScenario,
    importScenario,
    exportScenario,
    exportReport,
  };
}
