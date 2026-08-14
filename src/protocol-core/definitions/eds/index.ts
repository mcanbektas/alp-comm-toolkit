/**
 * EDS tanım dosyası motoru.
 *
 * `dbc/index.ts` ile aynı gerekçeyle ana `protocol-core/index.ts`e BAĞLANMAZ:
 * EDS yalnız CANopen'ın `Definitions` sekmesinde gerekiyor, açılış paketine
 * girmemeli. Tüketici derin yolla içe aktarır.
 */

export { findEdsObject, parseEds } from './edsParser';
export { EDS_DATA_TYPES, decodeEdsValue, getEdsDataTypeInfo } from './edsDecoder';
export type {
  EdsDatabase,
  EdsDecodedValue,
  EdsDeviceInfo,
  EdsFileInfo,
  EdsObject,
  EdsParseIssue,
  EdsParseResult,
} from './edsTypes';
