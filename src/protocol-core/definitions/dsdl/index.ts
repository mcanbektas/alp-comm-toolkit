/**
 * DSDL tanım motoru (Cyphal / DroneCAN).
 *
 * Öteki tanım motorlarıyla aynı gerekçeyle ana `protocol-core/index.ts`e
 * BAĞLANMAZ: yalnız `Definitions` sekmesinde gerekiyor.
 */

export { lengthPrefixBits, parseDsdl } from './dsdlParser';
export { decodeDsdlField, isDecodableField } from './dsdlDecoder';
export type { DsdlDecodeResult } from './dsdlDecoder';
export { SAMPLE_DSDL_BYTES, SAMPLE_DSDL_TEXT } from './dsdlFixture';
export type {
  DsdlArraySpec,
  DsdlConstant,
  DsdlDefinition,
  DsdlField,
  DsdlParseIssue,
  DsdlParseResult,
  DsdlPrimitive,
  DsdlSection,
  DsdlSectionKind,
} from './dsdlTypes';
