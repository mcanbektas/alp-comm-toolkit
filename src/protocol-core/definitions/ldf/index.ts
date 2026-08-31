/**
 * LDF tanım dosyası motoru.
 *
 * `eds/index.ts`, `xif/index.ts` ve `gsd/index.ts` ile aynı gerekçeyle ana
 * `protocol-core/index.ts`e BAĞLANMAZ: LDF yalnız LIN'in `Definitions`
 * sekmesinde gerekiyor, açılış paketine girmemeli. Tüketici derin yolla içe
 * aktarır.
 */

export {
  buildLdfSampleData,
  chooseDefaultLdfFrame,
  decodeLdfFrame,
  findLdfFrame,
  findLdfSignal,
  LDF_MAX_SCALAR_BITS,
  ldfFrameDataLength,
  parseLdf,
  resolveLdfChecksumModel,
  stripLdfComments,
  tokenizeLdf,
} from './ldfParser';
export {
  SAMPLE_LDF_ALIGNED_FRAME,
  SAMPLE_LDF_DIAGNOSTIC_SIGNAL_COUNT,
  SAMPLE_LDF_FRAME_COUNT,
  SAMPLE_LDF_NODE_ATTRIBUTE_COUNT,
  SAMPLE_LDF_SCHEDULE_TABLE_COUNT,
  SAMPLE_LDF_SIGNAL_COUNT,
  SAMPLE_LDF_TEXT,
  SAMPLE_LDF_UNALIGNED_FRAME,
  SAMPLE_LDF_UNCONDITIONAL_FRAME_COUNT,
  SAMPLE_LIN13_FRAME_COUNT,
  SAMPLE_LIN13_LDF_TEXT,
  SAMPLE_LIN13_SIGNAL_COUNT,
  SAMPLE_LIN13_UNSIZED_FRAME,
} from './ldfFixture';
export type {
  LdfChecksumModel,
  LdfChecksumReason,
  LdfChecksumResolution,
  LdfCluster,
  LdfConfigurableFrame,
  LdfDecodedSignal,
  LdfDiagnosticAddress,
  LdfEncodingEntry,
  LdfFrame,
  LdfFrameKind,
  LdfFrameSignal,
  LdfMaster,
  LdfNodeAttributes,
  LdfParseIssue,
  LdfParseResult,
  LdfScheduleEntry,
  LdfScheduleTable,
  LdfSignal,
  LdfSignalEncodingType,
  LdfSignalGroup,
  LdfSignalKind,
} from './ldfTypes';
