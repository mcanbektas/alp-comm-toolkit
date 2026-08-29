/**
 * Bilinmeyen protokol analizinin BÜTÜN raporu — §35'in 13 maddesi ve §36'nın
 * etiketleri tek bir sonuç nesnesinde.
 *
 * ── NEDEN FAZ LİSTESİ ─────────────────────────────────────────────────────
 * Analiz tek parça senkron bir çağrı olsaydı Worker onu başlattıktan sonra
 * `cancel` mesajını GÖREMEZDİ: bir Worker gelen mesajı ancak boşta işler
 * (`logAnalyzer.worker.ts` bu sınırı dürüstçe not eder). Bu yüzden analiz
 * ADIMLARA bölünür ve adım arasında kontrol çağırana geri verilir — iptal ve
 * ilerleme göstergesi (§44, 39680-39692) böyle gerçek olur.
 *
 * Adım sırası ucuzdan pahalıya değil, BAĞIMLILIĞA göre: sütun profili en
 * pahalı adımdır ama ASCII tespiti ve rol etiketleri onu bekler; bir kez
 * hesaplanıp paylaşılır (`detectAsciiFieldsFromProfiles` tam bunun için var).
 *
 * Rapor hiçbir adımda "sonuç yok" diye çökmez: her alan boş dizi ya da
 * `undefined` ile başlar, iptal edilen analiz KISMİ raporla döner.
 */

import { detectAsciiFieldsFromProfiles } from './asciiFieldDetect';
import { profileByteColumns } from './byteColumns';
import { scanChecksumFields } from './checksumScan';
import { detectCounters } from './counterDetect';
import { correlateFieldsWithSeries } from './fieldCorrelation';
import { detectLengthFields } from './lengthFieldDetect';
import { clusterMessages } from './messageClustering';
import { assignFieldRoles } from './messageDiff';
import { analyzePeriod } from './periodAnalysis';
import { frameLengthRange } from './readField';
import { detectTimestampFields } from './timestampDetect';
import type { AsciiFieldCandidate } from './asciiFieldDetect';
import type { ByteColumnProfile } from './byteColumns';
import type { ChecksumScanCandidate, ChecksumScanOptions } from './checksumScan';
import type { CounterCandidate } from './counterDetect';
import type { FieldCorrelationOptions, SeriesCorrelation } from './fieldCorrelation';
import type { LengthFieldCandidate } from './lengthFieldDetect';
import type { MessageCluster, MessageClusterOptions } from './messageClustering';
import type { FieldRoleAssignment, FieldRoleOptions } from './messageDiff';
import type { PeriodAnalysis } from './periodAnalysis';
import type { TimestampFieldCandidate } from './timestampDetect';
import type { AnalysisFrame } from './types';

export const ANALYSIS_PHASES = [
  'columns',
  'clusters',
  'counters',
  'lengthFields',
  'asciiFields',
  'timestampFields',
  'period',
  'checksums',
  'roles',
  'correlation',
] as const;

export type AnalysisPhase = (typeof ANALYSIS_PHASES)[number];

export interface ReverseEngineeringOptions {
  readonly checksumScan?: ChecksumScanOptions;
  readonly roles?: FieldRoleOptions;
  readonly clustering?: MessageClusterOptions;
  /** Bilinen değer serisi (spec 16283 gyro örneği); yoksa korelasyon adımı boş geçer. */
  readonly knownValues?: readonly number[];
  readonly correlation?: FieldCorrelationOptions;
}

export interface ReverseEngineeringReport {
  readonly frameCount: number;
  readonly lengthRange: { readonly min: number; readonly max: number };
  readonly columns: readonly ByteColumnProfile[];
  readonly clusters: readonly MessageCluster[];
  readonly counters: readonly CounterCandidate[];
  readonly lengthFields: readonly LengthFieldCandidate[];
  readonly asciiFields: readonly AsciiFieldCandidate[];
  readonly timestampFields: readonly TimestampFieldCandidate[];
  readonly period: PeriodAnalysis | undefined;
  readonly checksums: readonly ChecksumScanCandidate[];
  readonly roles: readonly FieldRoleAssignment[];
  readonly seriesCorrelations: readonly SeriesCorrelation[];
  /** Tamamlanan adımlar; iptal edilen analizde eksik kalır. */
  readonly completedPhases: readonly AnalysisPhase[];
}

interface MutableReport {
  frameCount: number;
  lengthRange: { min: number; max: number };
  columns: ByteColumnProfile[];
  clusters: MessageCluster[];
  counters: CounterCandidate[];
  lengthFields: LengthFieldCandidate[];
  asciiFields: AsciiFieldCandidate[];
  timestampFields: TimestampFieldCandidate[];
  period: PeriodAnalysis | undefined;
  checksums: ChecksumScanCandidate[];
  roles: FieldRoleAssignment[];
  seriesCorrelations: SeriesCorrelation[];
  completedPhases: AnalysisPhase[];
}

export interface AnalysisStep {
  readonly phase: AnalysisPhase;
  readonly run: () => void;
}

export interface AnalysisRunner {
  readonly steps: readonly AnalysisStep[];
  /** O ana kadar tamamlanmış adımların raporu; her çağrıda anlık kopya verir. */
  readonly snapshot: () => ReverseEngineeringReport;
}

/**
 * Adımları kurar ama HİÇBİRİNİ koşturmaz — sırayı ve iptali çağıran yönetir
 * (Worker adım arasında mesaj kuyruğunu boşaltır, test adım adım ilerler).
 */
export function createAnalysisRunner(
  frames: readonly AnalysisFrame[],
  options: ReverseEngineeringOptions = {},
  hooks: { readonly shouldCancel?: () => boolean } = {},
): AnalysisRunner {
  const report: MutableReport = {
    frameCount: frames.length,
    lengthRange: frameLengthRange(frames),
    columns: [],
    clusters: [],
    counters: [],
    lengthFields: [],
    asciiFields: [],
    timestampFields: [],
    period: undefined,
    checksums: [],
    roles: [],
    seriesCorrelations: [],
    completedPhases: [],
  };

  function step(phase: AnalysisPhase, run: () => void): AnalysisStep {
    return {
      phase,
      run: () => {
        run();
        report.completedPhases.push(phase);
      },
    };
  }

  const steps: AnalysisStep[] = [
    step('columns', () => {
      report.columns = profileByteColumns(frames);
    }),
    step('clusters', () => {
      report.clusters = clusterMessages(frames, options.clustering);
    }),
    step('counters', () => {
      report.counters = detectCounters(frames);
    }),
    step('lengthFields', () => {
      report.lengthFields = detectLengthFields(frames);
    }),
    step('asciiFields', () => {
      // Sütun profili zaten hesaplandı; ikinci kez gezmenin anlamı yok.
      report.asciiFields = detectAsciiFieldsFromProfiles(report.columns);
    }),
    step('timestampFields', () => {
      report.timestampFields = detectTimestampFields(frames);
    }),
    step('period', () => {
      report.period = analyzePeriod(frames);
    }),
    step('checksums', () => {
      report.checksums = scanChecksumFields(frames, {
        ...options.checksumScan,
        ...(hooks.shouldCancel === undefined ? {} : { shouldCancel: hooks.shouldCancel }),
      });
    }),
    step('roles', () => {
      report.roles = assignFieldRoles(frames, options.roles);
    }),
    step('correlation', () => {
      const values = options.knownValues;
      if (values === undefined || values.length === 0) return;
      report.seriesCorrelations = correlateFieldsWithSeries(frames, values, options.correlation);
    }),
  ];

  return {
    steps,
    snapshot: () => ({
      frameCount: report.frameCount,
      lengthRange: { ...report.lengthRange },
      columns: [...report.columns],
      clusters: [...report.clusters],
      counters: [...report.counters],
      lengthFields: [...report.lengthFields],
      asciiFields: [...report.asciiFields],
      timestampFields: [...report.timestampFields],
      period: report.period,
      checksums: [...report.checksums],
      roles: [...report.roles],
      seriesCorrelations: [...report.seriesCorrelations],
      completedPhases: [...report.completedPhases],
    }),
  };
}

/** Bütün adımları sırayla koşturur — küçük kümeler ve testler için. */
export function analyzeFrames(
  frames: readonly AnalysisFrame[],
  options: ReverseEngineeringOptions = {},
): ReverseEngineeringReport {
  const runner = createAnalysisRunner(frames, options);
  for (const step of runner.steps) step.run();
  return runner.snapshot();
}
