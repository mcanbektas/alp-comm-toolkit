/**
 * DBC tanım dosyası motoru.
 *
 * Bu barrel `protocol-core/index.ts`e BİLEREK bağlanmaz: DBC yalnız CAN
 * sayfalarının `Definitions` sekmesinde gerekiyor ve ana barrel'a girmesi
 * açılış paketine taşınması demek olurdu (aynı gerekçeyle `schemas/` de
 * dışarıda tutuluyor). Tüketici derin yolla içe aktarır.
 */

export { findDbcMessage, parseDbc } from './dbcParser';
export { decodeDbcMessage, motorolaStartToAbsoluteBit, readDbcSignalRaw } from './dbcDecoder';
export { writeDbc } from './dbcWriter';
export type {
  DbcByteOrder,
  DbcDatabase,
  DbcDecodedSignal,
  DbcMessage,
  DbcMultiplexRole,
  DbcParseIssue,
  DbcParseResult,
  DbcSignal,
} from './dbcTypes';
