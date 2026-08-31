/**
 * XIF tanım dosyası motoru.
 *
 * `eds/index.ts` ile aynı gerekçeyle ana `protocol-core/index.ts`e BAĞLANMAZ:
 * XIF yalnız LonWorks'ün `Definitions` sekmesinde gerekiyor, açılış paketine
 * girmemeli. Tüketici derin yolla içe aktarır.
 */

export { findXifNetworkVariable, parseXif, selectXifConfigProperties } from './xifParser';
export {
  SAMPLE_MICROSERVER_XIF_TEXT,
  SAMPLE_XIF_CONFIG_PROPERTY_COUNT,
  SAMPLE_XIF_DEMAND_PERIOD_NV_INDEX,
  SAMPLE_XIF_NV_COUNT,
  SAMPLE_XIF_PROGRAM_ID,
  SAMPLE_XIF_STATUS_NV_INDEX,
  SAMPLE_XIF_TEXT,
} from './xifFixture';
export type {
  XifConfigFile,
  XifDatabase,
  XifDevice,
  XifFileInfo,
  XifMessageTag,
  XifNetworkVariable,
  XifNvDirection,
  XifParseIssue,
  XifParseResult,
  XifServiceType,
  XifTypeElement,
} from './xifTypes';
