/**
 * GSD tanım dosyası motoru.
 *
 * `eds/index.ts` ve `xif/index.ts` ile aynı gerekçeyle ana
 * `protocol-core/index.ts`e BAĞLANMAZ: GSD yalnız PROFIBUS DP'nin
 * `Definitions` sekmesinde gerekiyor, açılış paketine girmemeli. Tüketici derin
 * yolla içe aktarır.
 */

export { decodeGsdConfigBytes, findGsdModule, parseGsd, resolveGsdPrmTextValues } from './gsdParser';
export {
  SAMPLE_COMPACT_GSD_IDENT_NUMBER,
  SAMPLE_COMPACT_GSD_TEXT,
  SAMPLE_GSD_DIAGNOSIS_TEXT_COUNT,
  SAMPLE_GSD_IDENT_NUMBER,
  SAMPLE_GSD_MODULE_COUNT,
  SAMPLE_GSD_PARAMETER_COUNT,
  SAMPLE_GSD_PROFISAFE_REFERENCE,
  SAMPLE_GSD_TELEGRAM_20_REFERENCE,
  SAMPLE_GSD_TEXT,
} from './gsdFixture';
export type {
  GsdBaudRate,
  GsdConfigDecode,
  GsdConsistency,
  GsdDataDirection,
  GsdDataUnit,
  GsdDatabase,
  GsdDevice,
  GsdDiagnosisText,
  GsdExtUserPrmData,
  GsdIdentifierFormat,
  GsdIoBlock,
  GsdModule,
  GsdParseIssue,
  GsdParseResult,
  GsdPrmDataConst,
  GsdPrmDataRef,
  GsdPrmDataType,
  GsdPrmText,
  GsdPrmTextValue,
} from './gsdTypes';
