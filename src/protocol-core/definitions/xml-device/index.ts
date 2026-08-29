/**
 * XML tabanlı aygıt tanım motoru — GSDML, IODD, SCL.
 *
 * Öteki tanım motorlarıyla aynı gerekçeyle ana `protocol-core/index.ts`e
 * BAĞLANMAZ: yalnız `Definitions` sekmesinde gerekiyor.
 */

export { parseDeviceDescription } from './deviceDescriptionParser';
export { decodeDeviceItem, isDecodable, itemBitLength } from './deviceItemDecoder';
export type { DeviceItemDecodeResult } from './deviceItemDecoder';
export {
  SAMPLE_GSDML_TEXT,
  SAMPLE_IODD_PROCESS_DATA,
  SAMPLE_IODD_TEXT,
  SAMPLE_SCL_TEXT,
} from './deviceDescriptionFixture';
export type {
  DeviceDescription,
  DeviceDescriptionFormat,
  DeviceDescriptionIssue,
  DeviceDescriptionResult,
  DeviceIdentityEntry,
  DeviceItem,
  DeviceItemGroup,
} from './deviceDescriptionTypes';
export { parseXml } from './xmlReader';
export type { XmlElement, XmlParseResult } from './xmlReader';
