/**
 * Üretici kayıt haritası motoru.
 *
 * `dbc/index.ts` ve `eds/index.ts` ile aynı gerekçeyle ana
 * `protocol-core/index.ts`e BAĞLANMAZ: harita yalnız `Definitions` sekmesinde
 * gerekiyor, açılış paketine girmemeli. Tüketici derin yolla içe aktarır.
 */

export { parseVendorMap, parseVendorMapCsv, parseVendorMapJson } from './vendorMapParser';
export { decodeVendorMapEntry, requiredByteLength } from './vendorMapDecoder';
export type { DecodedBit, VendorMapDecodeResult } from './vendorMapDecoder';
export { SAMPLE_VENDOR_MAP_BYTES, SAMPLE_VENDOR_MAP_CSV } from './vendorMapFixture';
export type {
  VendorMap,
  VendorMapAddressSpace,
  VendorMapBit,
  VendorMapEntry,
  VendorMapIssue,
  VendorMapParseResult,
  VendorMapValueType,
  VendorMapWordOrder,
} from './vendorMapTypes';
