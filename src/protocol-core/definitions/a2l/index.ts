/**
 * A2L (ASAM MCD-2 MC) tanım dosyası motoru.
 *
 * `dbc`/`eds`/`vendor-map` ile aynı gerekçeyle ana `protocol-core/index.ts`e
 * BAĞLANMAZ: yalnız `Definitions` sekmesinde gerekiyor, açılış paketine
 * girmemeli. Tüketici derin yolla içe aktarır.
 */

export { findCompuMethod, findVerbalTable, parseA2l, tokenizeA2l } from './a2lParser';
export { dataTypeWidth, decodeA2lMeasurement } from './a2lDecoder';
export type { A2lDecodeResult } from './a2lDecoder';
export { SAMPLE_A2L_BYTES, SAMPLE_A2L_TEXT } from './a2lFixture';
export type {
  A2lByteOrder,
  A2lCharacteristic,
  A2lCompuMethod,
  A2lConversionType,
  A2lDataType,
  A2lDatabase,
  A2lMeasurement,
  A2lParseIssue,
  A2lParseResult,
  A2lVerbalTable,
} from './a2lTypes';
