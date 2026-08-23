/**
 * OPC UA Binary DataEncoding — yerleşik (built-in) tip çözücüleri.
 *
 * Faz 10, dalga 13c. `opcua.ts` (UACP/UASC çerçeve katmanı) bu modülü tüketir;
 * ayrı dosya olmasının sebebi `dnsWire.ts` (12c) ve `iec104Asdu.ts` ile aynı:
 * yerleşik tip çözücüsü çerçeve katmanından BAĞIMSIZ bir dilbilgisidir ve kendi
 * fixture'larıyla ayrı sınanabilir.
 *
 * ── KAYNAK DURUMU — bu domain'in İSTİSNASI ────────────────────────────────
 * `brief-faz10-dalga13.md`nin 1. mimari bulgusu bu domain için "ticari
 * konsorsiyum spec'leri, çoğu ücretli" diyor. **OPC UA bu kuralın DIŞINDA:**
 * OPC Foundation'ın Part 6 (Mappings) metni reference.opcfoundation.org
 * üzerinden ÜCRETSİZ ve halka açıktır; tip tabloları ve servis id'leri ayrıca
 * MAKİNE-OKUNUR biçimde (MIT lisanslı `UA-Nodeset/Schema/`) yayımlanır.
 * Yani burada kaynak riski DÜŞÜK, HACİM riski YÜKSEK — kapsam kararı aşağıda.
 *
 * Aşağıdaki her alan yerleşimi ÜÇ bağımsız kaynakta ÇAPRAZ TEYİTLİDİR:
 *   P6 = OPC Foundation OPC 10000-6 (Part 6: Mappings) v1.05, §5.2.2/§5.2.5/
 *        §5.2.9 — https://reference.opcfoundation.org/Core/Part6/v105/docs/5.2.2
 *   WS = Wireshark `plugins/epan/opcua/opcua_simpletypes.c` +
 *        `opcua_transport_layer.c` (GPL-2.0, bağımsız implementasyon)
 *   O6 = open62541 `src/ua_types_encoding_binary.c` (MPL-2.0, bağımsız C
 *        implementasyonu)
 *   BSD= OPC Foundation `Schema/Opc.Ua.Types.bsd` + `NodeIds.csv` +
 *        `StatusCode.csv` + `AttributeIds.csv` (MIT, makine-okunur)
 *
 * Çakışma bulunmadı; her tip için en az iki kaynak birebir örtüştü.
 *
 * ── TUZAKLAR (brief'te işaretlenenler, kaynağından doğrulandı) ─────────────
 * 1. **DateTime epoch 1601-01-01 UTC, 100 ns tick** (P6 §5.2.2.5: "number of
 *    100 nanosecond intervals since January 1, 1601 (UTC)"). Bu depodaki
 *    `protocol-core/encoding/unixTimestamp.ts` SAHTE DOSTTUR ve KULLANILMADI:
 *    orası Unix epoch (1970) ve SANİYE taşır, buradaki değer 1601 ve 100 ns.
 *    İkisini karıştırmak 369 yıllık kayma demek. Dönüşüm sabiti burada AÇIKÇA
 *    türetildi (`TICKS_1601_TO_1970`), gizli bir yardımcıya devredilmedi —
 *    12d'nin NTP/PTP dersi: akraba görünen damga biçimleri farklı birim taşır.
 *    Sıfır değeri "1601" DEĞİL, "belirtilmemiş"tir (P6: DateTime.MinValue).
 * 2. **NodeId kodlaması tek biçimli DEĞİL.** İlk bayt biçimi seçer ve her biçim
 *    FARKLI uzunluktadır: TwoByte=toplam 2, FourByte=4, Numeric=7, String/
 *    Guid/ByteString değişken. Yanlış varyant sonraki HER alanı kaydırır
 *    (12f'nin chunked-length dersiyle aynı sınıf). P6 Tablo 17-20 ile WS
 *    `parseNodeId()` BİREBİR örtüşüyor — iki kaynak.
 * 3. **Uzunluk −1 = null, 0 = boş; AYNI ŞEY DEĞİL.** P6 §5.2.2.4/§5.2.2.7/
 *    §5.2.5. `-1`i işaretsiz okumak (4294967295) tamponu taşırır: bütün uzunluk
 *    alanları `readInt32` ile İŞARETLİ okunur.
 * 4. **Variant encoding mask:** bit 0-5 tip id, bit 6 ArrayDimensions var,
 *    bit 7 dizi (P6 Tablo 26). Dizi ise önce Int32 eleman sayısı gelir ve O DA
 *    −1 olabilir.
 * 5. **Guid iç yapısı düz 16 bayt DEĞİL:** Data1 UInt32-LE, Data2 UInt16-LE,
 *    Data3 UInt16-LE, Data4 8 bayt HAM (O6 `ENCODE_BINARY(Guid)`; WS
 *    `packet-windows-common` GUID'i `ENC_LITTLE_ENDIAN` ile okur — 2 kaynak).
 *    Düz bayt kopyası yazsaydık ilk üç grup ters basılırdı.
 *
 * ── HATA YOLU ─────────────────────────────────────────────────────────────
 * Okuyucular tampon taştığında `OpcUaDecodeError` FIRLATIR. `ProtocolParser`
 * sözleşmesi saf ve senkrondur; fırlatma iç kontrol akışıdır, `opcua.ts` en
 * üstte yakalar ve `ParseResult`a çevirir (`bitCursor.ts` de bayt sınırı
 * dışına çıkınca `RangeError` fırlatıyor — depoda kurulu desen).
 */

import { decodeFloat32, decodeFloat64 } from '@/protocol-core/encoding/ieee754';
import { utf8BytesToString } from '@/protocol-core/encoding/utf8Viewer';

/** Değişken uzunluk alanlarında "null" işaretçisi (P6 §5.2.2.4). */
export const NULL_LENGTH = -1;

const HEX_RADIX = 16;
const BYTE_HEX_WIDTH = 2;

/**
 * 1601-01-01 ile 1970-01-01 arasındaki 100 ns tick sayısı.
 *
 * Türetimi AÇIKÇA yazıldı, sihirli sabit bırakılmadı: iki tarih arası 134774
 * gündür (11644473600 saniye), saniyede 10^7 tick vardır.
 * 134774 × 86400 × 10^7 = 116444736000000000.
 */
export const TICKS_1601_TO_1970 = 11644473600n * 10_000_000n;

const TICKS_PER_MILLISECOND = 10_000n;

/** `Int64` üst sınırı — P6 §5.2.2.5'te "en geç tarih" işaretçisi. */
const INT64_MAX = 9_223_372_036_854_775_807n;

/**
 * `DiagnosticInfo` özyinelemelidir; P6 §5.2.2.12 "decoders shall support at
 * least 4 recursion levels and are not expected to support more than 10".
 * Üst sınır seçildi: daha derini reddetmek spec'in izin verdiği davranıştır ve
 * bozuk veride yığın taşmasını engeller.
 */
const MAX_DIAGNOSTIC_DEPTH = 10;

/** Çeviri anahtarı taşıyan çözümleme hatası. */
export class OpcUaDecodeError extends Error {
  readonly messageKey: string;
  readonly offset: number;

  constructor(messageKey: string, offset: number) {
    super(messageKey);
    this.name = 'OpcUaDecodeError';
    this.messageKey = messageKey;
    this.offset = offset;
  }
}

/** Bayt akışında ilerleyen imleç. `offset` çağıran tarafından okunabilir. */
export interface BinaryCursor {
  readonly data: Uint8Array;
  offset: number;
}

export function createCursor(data: Uint8Array, offset = 0): BinaryCursor {
  return { data, offset };
}

function ensure(cursor: BinaryCursor, count: number): void {
  if (cursor.offset + count > cursor.data.length) {
    throw new OpcUaDecodeError('protocol.opcua.error.truncatedField', cursor.offset);
  }
}

function takeBytes(cursor: BinaryCursor, count: number): Uint8Array {
  ensure(cursor, count);
  const slice = cursor.data.subarray(cursor.offset, cursor.offset + count);
  cursor.offset += count;
  return slice;
}

/** `noUncheckedIndexedAccess` açık: indeks erişimi guard'sız kullanılamaz. */
function byteAt(data: Uint8Array, index: number): number {
  return data[index] ?? 0;
}

export function formatHexBytes(bytes: Uint8Array, maxBytes = 16): string {
  const shown = bytes.subarray(0, maxBytes);
  const text = Array.from(shown, (b) =>
    b.toString(HEX_RADIX).toUpperCase().padStart(BYTE_HEX_WIDTH, '0'),
  ).join(' ');
  return bytes.length > maxBytes ? `${text} …` : text;
}

// ── Sayısal yerleşik tipler (P6 §5.2.2.2: HEPSİ little-endian) ──────────────

export function readByteValue(cursor: BinaryCursor): number {
  ensure(cursor, 1);
  const value = byteAt(cursor.data, cursor.offset);
  cursor.offset += 1;
  return value;
}

export function readSByte(cursor: BinaryCursor): number {
  const raw = readByteValue(cursor);
  return raw >= 0x80 ? raw - 0x100 : raw;
}

export function readBooleanValue(cursor: BinaryCursor): boolean {
  // P6 §5.2.2.1: kodlayıcı 1 yazar ama ÇÖZÜCÜ sıfırdan farklı her değeri true saymalı.
  return readByteValue(cursor) !== 0;
}

export function readUInt16(cursor: BinaryCursor): number {
  const slice = takeBytes(cursor, 2);
  return byteAt(slice, 0) | (byteAt(slice, 1) << 8);
}

export function readInt16(cursor: BinaryCursor): number {
  const raw = readUInt16(cursor);
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

export function readUInt32(cursor: BinaryCursor): number {
  const slice = takeBytes(cursor, 4);
  // `<< 24` işaretli sonuç verir; `>>> 0` ile işaretsize çevrilir.
  return (
    ((byteAt(slice, 0) | (byteAt(slice, 1) << 8) | (byteAt(slice, 2) << 16) | (byteAt(slice, 3) << 24)) >>> 0)
  );
}

/**
 * İŞARETLİ 32-bit. Bütün uzunluk alanları (String/ByteString/dizi/
 * ExtensionObject Length) BUNUNLA okunur — `-1` null demektir ve işaretsiz
 * okunursa 4294967295 olarak tamponu taşırır (tuzak 3).
 */
export function readInt32(cursor: BinaryCursor): number {
  const raw = readUInt32(cursor);
  return raw >= 0x8000_0000 ? raw - 0x1_0000_0000 : raw;
}

export function readUInt64(cursor: BinaryCursor): bigint {
  const slice = takeBytes(cursor, 8);
  let value = 0n;
  for (let index = 7; index >= 0; index--) {
    value = (value << 8n) | BigInt(byteAt(slice, index));
  }
  return value;
}

export function readInt64(cursor: BinaryCursor): bigint {
  const raw = readUInt64(cursor);
  return raw >= 1n << 63n ? raw - (1n << 64n) : raw;
}

export function readFloatValue(cursor: BinaryCursor): number {
  // PAYLAŞIM: `protocol-core/encoding/ieee754.ts` — OPC UA float'ı düz IEEE 754
  // little-endian (P6 §5.2.2.3), yani gerçekten AYNI hesap. Ayrı yazılmadı.
  return decodeFloat32(takeBytes(cursor, 4), 'little');
}

export function readDoubleValue(cursor: BinaryCursor): number {
  return decodeFloat64(takeBytes(cursor, 8), 'little');
}

// ── Değişken uzunluklu tipler ──────────────────────────────────────────────

/** `null` = uzunluk −1; `''` = uzunluk 0. İkisi AYNI ŞEY DEĞİL (tuzak 3). */
export function readStringValue(cursor: BinaryCursor): string | null {
  const length = readInt32(cursor);
  if (length === NULL_LENGTH) return null;
  if (length < 0) {
    throw new OpcUaDecodeError('protocol.opcua.error.negativeLength', cursor.offset - 4);
  }
  if (length === 0) return '';
  // PAYLAŞIM: `utf8Viewer.utf8BytesToString` — P6 §5.2.2.4 "sequence of UTF-8
  // characters", aynı hesap.
  return utf8BytesToString(takeBytes(cursor, length));
}

export function readByteStringValue(cursor: BinaryCursor): Uint8Array | null {
  const length = readInt32(cursor);
  if (length === NULL_LENGTH) return null;
  if (length < 0) {
    throw new OpcUaDecodeError('protocol.opcua.error.negativeLength', cursor.offset - 4);
  }
  return takeBytes(cursor, length);
}

/**
 * Guid — DÜZ 16 bayt DEĞİL (tuzak 5): Data1 UInt32-LE, Data2 UInt16-LE,
 * Data3 UInt16-LE, Data4 8 bayt ham. Kanonik metin biçiminde döner.
 */
export function readGuidValue(cursor: BinaryCursor): string {
  const data1 = readUInt32(cursor);
  const data2 = readUInt16(cursor);
  const data3 = readUInt16(cursor);
  const data4 = takeBytes(cursor, 8);
  const hex = (value: number, width: number): string =>
    value.toString(HEX_RADIX).toUpperCase().padStart(width, '0');
  const tail = Array.from(data4, (b) => hex(b, BYTE_HEX_WIDTH)).join('');
  return `${hex(data1, 8)}-${hex(data2, 4)}-${hex(data3, 4)}-${tail.slice(0, 4)}-${tail.slice(4)}`;
}

/**
 * DateTime — 100 ns tick, 1601-01-01 UTC epoch'u (tuzak 1). Ham tick VE
 * çözülmüş ISO metni birlikte döner; ham değer `ParsedField.rawValue`,
 * ISO metni `physicalValue` olur.
 */
export interface OpcUaDateTime {
  ticks: bigint;
  /** `null` = spec'in "belirtilmemiş"/"sınır" değerleri (0 ya da Int64 max). */
  iso: string | null;
}

export function convertTicksToIso(ticks: bigint): string | null {
  // P6 §5.2.2.5: 0 = DateTime.MinValue ("belirtilmemiş"), Int64 max = "en geç".
  // İkisi de GERÇEK bir zaman damgası DEĞİLDİR, tarihe çevrilmez.
  if (ticks === 0n || ticks === INT64_MAX) return null;
  const unixMs = (ticks - TICKS_1601_TO_1970) / TICKS_PER_MILLISECOND;
  // JS `Date` ±8.64e15 ms ile sınırlı; dışına düşen değer için tarih iddia edilmez.
  if (unixMs > 8_640_000_000_000_000n || unixMs < -8_640_000_000_000_000n) return null;
  return new Date(Number(unixMs)).toISOString();
}

export function readDateTimeValue(cursor: BinaryCursor): OpcUaDateTime {
  const ticks = readInt64(cursor);
  return { ticks, iso: convertTicksToIso(ticks) };
}

// ── NodeId / ExpandedNodeId ────────────────────────────────────────────────

/** P6 Tablo 17 — ilk baytın alt nibble'ı biçimi seçer. */
export const NODE_ID_TWO_BYTE = 0x00;
export const NODE_ID_FOUR_BYTE = 0x01;
export const NODE_ID_NUMERIC = 0x02;
export const NODE_ID_STRING = 0x03;
export const NODE_ID_GUID = 0x04;
export const NODE_ID_BYTE_STRING = 0x05;
/** ExpandedNodeId bayrakları (P6 §5.2.2.10; WS `parseExpandedNodeId` teyitli). */
export const NODE_ID_FLAG_NAMESPACE_URI = 0x80;
export const NODE_ID_FLAG_SERVER_INDEX = 0x40;
const NODE_ID_ENCODING_MASK = 0x0f;

export type OpcUaNodeIdIdentifier =
  | { kind: 'numeric'; value: number }
  | { kind: 'string'; value: string | null }
  | { kind: 'guid'; value: string }
  | { kind: 'opaque'; value: Uint8Array | null };

export interface OpcUaNodeId {
  encodingByte: number;
  namespaceIndex: number;
  identifier: OpcUaNodeIdIdentifier;
  /** ExpandedNodeId'de bayrak 0x80 varsa dolu; NodeId'de her zaman `null`. */
  namespaceUri: string | null;
  /** ExpandedNodeId'de bayrak 0x40 varsa dolu; NodeId'de her zaman `null`. */
  serverIndex: number | null;
}

function readNodeIdBody(cursor: BinaryCursor, encodingByte: number): {
  namespaceIndex: number;
  identifier: OpcUaNodeIdIdentifier;
} {
  switch (encodingByte & NODE_ID_ENCODING_MASK) {
    case NODE_ID_TWO_BYTE:
      // Toplam 2 bayt: namespace örtük 0, tanımlayıcı tek bayt (P6 Tablo 19).
      return { namespaceIndex: 0, identifier: { kind: 'numeric', value: readByteValue(cursor) } };
    case NODE_ID_FOUR_BYTE: {
      // Toplam 4 bayt: namespace TEK bayt, tanımlayıcı UInt16 (P6 Tablo 20).
      const namespaceIndex = readByteValue(cursor);
      return { namespaceIndex, identifier: { kind: 'numeric', value: readUInt16(cursor) } };
    }
    case NODE_ID_NUMERIC: {
      const namespaceIndex = readUInt16(cursor);
      return { namespaceIndex, identifier: { kind: 'numeric', value: readUInt32(cursor) } };
    }
    case NODE_ID_STRING: {
      const namespaceIndex = readUInt16(cursor);
      return { namespaceIndex, identifier: { kind: 'string', value: readStringValue(cursor) } };
    }
    case NODE_ID_GUID: {
      const namespaceIndex = readUInt16(cursor);
      return { namespaceIndex, identifier: { kind: 'guid', value: readGuidValue(cursor) } };
    }
    case NODE_ID_BYTE_STRING: {
      const namespaceIndex = readUInt16(cursor);
      return { namespaceIndex, identifier: { kind: 'opaque', value: readByteStringValue(cursor) } };
    }
    default:
      throw new OpcUaDecodeError('protocol.opcua.error.unknownNodeIdEncoding', cursor.offset - 1);
  }
}

export function readNodeIdValue(cursor: BinaryCursor): OpcUaNodeId {
  const encodingByte = readByteValue(cursor);
  const body = readNodeIdBody(cursor, encodingByte);
  return { encodingByte, ...body, namespaceUri: null, serverIndex: null };
}

/**
 * ExpandedNodeId = NodeId + (bayrak varsa) NamespaceUri String + ServerIndex
 * UInt32 (P6 Tablo 21). Bayrak bitleri encoding baytının ÜST iki bitidir;
 * biçim seçimi alt nibble'dan yapılır — WS `parseExpandedNodeId` `& 0x0F`
 * maskesiyle aynısını yapıyor.
 */
export function readExpandedNodeIdValue(cursor: BinaryCursor): OpcUaNodeId {
  const encodingByte = readByteValue(cursor);
  const body = readNodeIdBody(cursor, encodingByte);
  const namespaceUri =
    (encodingByte & NODE_ID_FLAG_NAMESPACE_URI) !== 0 ? readStringValue(cursor) : null;
  const serverIndex = (encodingByte & NODE_ID_FLAG_SERVER_INDEX) !== 0 ? readUInt32(cursor) : null;
  return { encodingByte, ...body, namespaceUri, serverIndex };
}

/** P6 §5.1.12'nin metin biçimi: `ns=<idx>;i=<id>` / `s=` / `g=` / `b=`. */
export function formatNodeId(nodeId: OpcUaNodeId): string {
  const prefix = nodeId.namespaceIndex === 0 ? '' : `ns=${String(nodeId.namespaceIndex)};`;
  const uri = nodeId.namespaceUri === null ? '' : `nsu=${nodeId.namespaceUri};`;
  const server = nodeId.serverIndex === null ? '' : `svr=${String(nodeId.serverIndex)};`;
  const identifier = nodeId.identifier;
  switch (identifier.kind) {
    case 'numeric':
      return `${server}${uri}${prefix}i=${String(identifier.value)}`;
    case 'string':
      return `${server}${uri}${prefix}s=${identifier.value ?? ''}`;
    case 'guid':
      return `${server}${uri}${prefix}g=${identifier.value}`;
    case 'opaque':
      // Opak (ByteString) tanımlayıcı: ilk 8 bayt gösterilir, gerisi kısaltılır.
      const opaque = identifier.value === null ? '' : formatHexBytes(identifier.value, 8);
      return `${server}${uri}${prefix}b=${opaque}`;
    default:
      return '';
  }
}

// ── StatusCode ─────────────────────────────────────────────────────────────

/**
 * `StatusCode.csv`den (OPC Foundation, MIT) alınan alt küme. TAM tablo 274
 * satır; buraya UACP hata mesajlarında ve servis sonuçlarında fiilen görülen
 * kodlar alındı. Tanınmayan kod ADLANDIRILMAZ, yalnız üst iki bitten önem
 * derecesi (`Good`/`Uncertain`/`Bad`) söylenir — "iki bağımsız kaynak
 * çakışmazsa adlandır, yoksa ham bırak" ölçütünün StatusCode karşılığı.
 */
export const STATUS_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00000000, 'Good'],
  [0x40000000, 'Uncertain'],
  [0x80000000, 'Bad'],
  [0x80010000, 'BadUnexpectedError'],
  [0x80020000, 'BadInternalError'],
  [0x80030000, 'BadOutOfMemory'],
  [0x80040000, 'BadResourceUnavailable'],
  [0x80050000, 'BadCommunicationError'],
  [0x80060000, 'BadEncodingError'],
  [0x80070000, 'BadDecodingError'],
  [0x80080000, 'BadEncodingLimitsExceeded'],
  [0x800a0000, 'BadTimeout'],
  [0x800b0000, 'BadServiceUnsupported'],
  [0x800c0000, 'BadShutdown'],
  [0x800d0000, 'BadServerNotConnected'],
  [0x800e0000, 'BadServerHalted'],
  [0x800f0000, 'BadNothingToDo'],
  [0x80100000, 'BadTooManyOperations'],
  [0x80120000, 'BadCertificateInvalid'],
  [0x80130000, 'BadSecurityChecksFailed'],
  [0x80140000, 'BadCertificateTimeInvalid'],
  [0x80160000, 'BadCertificateHostNameInvalid'],
  [0x80170000, 'BadCertificateUriInvalid'],
  [0x801a0000, 'BadCertificateUntrusted'],
  [0x801b0000, 'BadCertificateRevocationUnknown'],
  [0x801d0000, 'BadCertificateRevoked'],
  [0x801f0000, 'BadUserAccessDenied'],
  [0x80200000, 'BadIdentityTokenInvalid'],
  [0x80210000, 'BadIdentityTokenRejected'],
  [0x80220000, 'BadSecureChannelIdInvalid'],
  [0x80250000, 'BadSessionIdInvalid'],
  [0x80260000, 'BadSessionClosed'],
  [0x80270000, 'BadSessionNotActivated'],
  [0x80280000, 'BadSubscriptionIdInvalid'],
  [0x802a0000, 'BadRequestHeaderInvalid'],
  [0x80310000, 'BadNoCommunication'],
  [0x80320000, 'BadWaitingForInitialData'],
  [0x80330000, 'BadNodeIdInvalid'],
  [0x80340000, 'BadNodeIdUnknown'],
  [0x80350000, 'BadAttributeIdInvalid'],
  [0x80360000, 'BadIndexRangeInvalid'],
  [0x80370000, 'BadIndexRangeNoData'],
  [0x80380000, 'BadDataEncodingInvalid'],
  [0x80390000, 'BadDataEncodingUnsupported'],
  [0x803a0000, 'BadNotReadable'],
  [0x803b0000, 'BadNotWritable'],
  [0x803c0000, 'BadOutOfRange'],
  [0x803d0000, 'BadNotSupported'],
  [0x80410000, 'BadMonitoringModeInvalid'],
  [0x80420000, 'BadMonitoredItemIdInvalid'],
  [0x80530000, 'BadRequestTypeInvalid'],
  [0x80550000, 'BadSecurityPolicyRejected'],
  [0x80560000, 'BadTooManySessions'],
  [0x80740000, 'BadTypeMismatch'],
  [0x80770000, 'BadTooManySubscriptions'],
  [0x80790000, 'BadNoSubscription'],
  [0x807d0000, 'BadTcpServerTooBusy'],
  [0x807e0000, 'BadTcpMessageTypeInvalid'],
  [0x807f0000, 'BadTcpSecureChannelUnknown'],
  [0x80800000, 'BadTcpMessageTooLarge'],
  [0x80810000, 'BadTcpNotEnoughResources'],
  [0x80820000, 'BadTcpInternalError'],
  [0x80830000, 'BadTcpEndpointUrlInvalid'],
  [0x80840000, 'BadRequestInterrupted'],
  [0x80850000, 'BadRequestTimeout'],
  [0x80860000, 'BadSecureChannelClosed'],
  [0x80870000, 'BadSecureChannelTokenUnknown'],
  [0x80ab0000, 'BadInvalidArgument'],
  [0x80ad0000, 'BadDisconnect'],
  [0x80ae0000, 'BadConnectionClosed'],
  [0x80b80000, 'BadRequestTooLarge'],
  [0x80b90000, 'BadResponseTooLarge'],
  [0x80be0000, 'BadProtocolVersionUnsupported'],
]);

/** Üst iki bit önem derecesini taşır (P6 Ek A.2 / `StatusCode.csv`). */
export function statusSeverity(code: number): 'Good' | 'Uncertain' | 'Bad' {
  const severity = (code >>> 30) & 0x03;
  if (severity === 0) return 'Good';
  if (severity === 1) return 'Uncertain';
  return 'Bad';
}

export function formatStatusCode(code: number): string {
  const name = STATUS_CODE_NAMES.get(code >>> 0);
  const hex = `0x${(code >>> 0).toString(HEX_RADIX).toUpperCase().padStart(8, '0')}`;
  return name === undefined ? `${statusSeverity(code)} (${hex})` : `${name} (${hex})`;
}

// ── QualifiedName / LocalizedText ──────────────────────────────────────────

export interface OpcUaQualifiedName {
  namespaceIndex: number;
  name: string | null;
}

export function readQualifiedNameValue(cursor: BinaryCursor): OpcUaQualifiedName {
  const namespaceIndex = readUInt16(cursor);
  return { namespaceIndex, name: readStringValue(cursor) };
}

export function formatQualifiedName(value: OpcUaQualifiedName): string {
  return value.namespaceIndex === 0
    ? (value.name ?? '')
    : `${String(value.namespaceIndex)}:${value.name ?? ''}`;
}

/** P6 Tablo 24: 0x01 Locale, 0x02 Text. Bit yoksa alan AKIŞTA HİÇ YOKTUR. */
export const LOCALIZED_TEXT_HAS_LOCALE = 0x01;
export const LOCALIZED_TEXT_HAS_TEXT = 0x02;

export interface OpcUaLocalizedText {
  encodingMask: number;
  locale: string | null;
  text: string | null;
}

export function readLocalizedTextValue(cursor: BinaryCursor): OpcUaLocalizedText {
  const encodingMask = readByteValue(cursor);
  const locale = (encodingMask & LOCALIZED_TEXT_HAS_LOCALE) !== 0 ? readStringValue(cursor) : null;
  const text = (encodingMask & LOCALIZED_TEXT_HAS_TEXT) !== 0 ? readStringValue(cursor) : null;
  return { encodingMask, locale, text };
}

export function formatLocalizedText(value: OpcUaLocalizedText): string {
  if (value.text === null) return '';
  return value.locale === null || value.locale === '' ? value.text : `${value.text} [${value.locale}]`;
}

// ── ExtensionObject ────────────────────────────────────────────────────────

/** P6 Tablo 25: 0x00 gövde yok, 0x01 ByteString, 0x02 XmlElement. */
export const EXTENSION_BODY_NONE = 0x00;
export const EXTENSION_BODY_BYTE_STRING = 0x01;
export const EXTENSION_BODY_XML = 0x02;

export interface OpcUaExtensionObject {
  typeId: OpcUaNodeId;
  encoding: number;
  body: Uint8Array | null;
}

export function readExtensionObjectValue(cursor: BinaryCursor): OpcUaExtensionObject {
  const typeId = readNodeIdValue(cursor);
  const encoding = readByteValue(cursor);
  if (encoding === EXTENSION_BODY_NONE) return { typeId, encoding, body: null };
  if (encoding !== EXTENSION_BODY_BYTE_STRING && encoding !== EXTENSION_BODY_XML) {
    throw new OpcUaDecodeError('protocol.opcua.error.unknownExtensionEncoding', cursor.offset - 1);
  }
  return { typeId, encoding, body: readByteStringValue(cursor) };
}

// ── Variant ────────────────────────────────────────────────────────────────

/** P6 Tablo 1 — yerleşik tip id'leri (BSD `Opc.Ua.Types.bsd` ile teyitli). */
export const BUILT_IN_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Null'],
  [1, 'Boolean'],
  [2, 'SByte'],
  [3, 'Byte'],
  [4, 'Int16'],
  [5, 'UInt16'],
  [6, 'Int32'],
  [7, 'UInt32'],
  [8, 'Int64'],
  [9, 'UInt64'],
  [10, 'Float'],
  [11, 'Double'],
  [12, 'String'],
  [13, 'DateTime'],
  [14, 'Guid'],
  [15, 'ByteString'],
  [16, 'XmlElement'],
  [17, 'NodeId'],
  [18, 'ExpandedNodeId'],
  [19, 'StatusCode'],
  [20, 'QualifiedName'],
  [21, 'LocalizedText'],
  [22, 'ExtensionObject'],
  [23, 'DataValue'],
  [24, 'Variant'],
  [25, 'DiagnosticInfo'],
]);

/** P6 Tablo 26 — mask bitleri. */
export const VARIANT_TYPE_MASK = 0x3f;
export const VARIANT_HAS_DIMENSIONS = 0x40;
export const VARIANT_IS_ARRAY = 0x80;

export interface OpcUaVariant {
  encodingMask: number;
  builtInTypeId: number;
  builtInTypeName: string;
  isArray: boolean;
  /** `null` = skaler; `-1` = null dizi; ≥0 = eleman sayısı. */
  arrayLength: number | null;
  /** Çok boyutlu dizide boyut uzunlukları; yoksa `null`. */
  dimensions: readonly number[] | null;
  /** İnsan-okunur değer(ler). NULL variant'ta `null`. */
  formatted: string | null;
  /** Skaler VE sayısalsa ham sayı — `ParsedField.physicalValue` için. */
  scalarNumber: number | bigint | null;
}

const MAX_FORMATTED_ELEMENTS = 8;

function readVariantScalar(
  cursor: BinaryCursor,
  typeId: number,
  depth: number,
): { text: string; numeric: number | bigint | null } {
  switch (typeId) {
    case 0:
      return { text: '', numeric: null };
    case 1:
      return { text: readBooleanValue(cursor) ? 'true' : 'false', numeric: null };
    case 2: {
      const value = readSByte(cursor);
      return { text: String(value), numeric: value };
    }
    case 3: {
      const value = readByteValue(cursor);
      return { text: String(value), numeric: value };
    }
    case 4: {
      const value = readInt16(cursor);
      return { text: String(value), numeric: value };
    }
    case 5: {
      const value = readUInt16(cursor);
      return { text: String(value), numeric: value };
    }
    case 6: {
      const value = readInt32(cursor);
      return { text: String(value), numeric: value };
    }
    case 7: {
      const value = readUInt32(cursor);
      return { text: String(value), numeric: value };
    }
    case 8: {
      const value = readInt64(cursor);
      return { text: value.toString(), numeric: value };
    }
    case 9: {
      const value = readUInt64(cursor);
      return { text: value.toString(), numeric: value };
    }
    case 10: {
      const value = readFloatValue(cursor);
      return { text: String(value), numeric: value };
    }
    case 11: {
      const value = readDoubleValue(cursor);
      return { text: String(value), numeric: value };
    }
    case 12: {
      const value = readStringValue(cursor);
      return { text: value ?? 'null', numeric: null };
    }
    case 13: {
      const value = readDateTimeValue(cursor);
      return { text: value.iso ?? value.ticks.toString(), numeric: null };
    }
    case 14:
      return { text: readGuidValue(cursor), numeric: null };
    case 15:
    case 16: {
      // 16 (XmlElement) tel üzerinde ByteString ile AYNI kodlanır (P6 §5.2.2.8).
      const value = readByteStringValue(cursor);
      return { text: value === null ? 'null' : formatHexBytes(value), numeric: null };
    }
    case 17:
      return { text: formatNodeId(readNodeIdValue(cursor)), numeric: null };
    case 18:
      return { text: formatNodeId(readExpandedNodeIdValue(cursor)), numeric: null };
    case 19: {
      const value = readUInt32(cursor);
      return { text: formatStatusCode(value), numeric: value };
    }
    case 20:
      return { text: formatQualifiedName(readQualifiedNameValue(cursor)), numeric: null };
    case 21:
      return { text: formatLocalizedText(readLocalizedTextValue(cursor)), numeric: null };
    case 22: {
      const value = readExtensionObjectValue(cursor);
      const size = value.body === null ? 0 : value.body.length;
      return { text: `${formatNodeId(value.typeId)} (${String(size)} B)`, numeric: null };
    }
    case 23: {
      const value = readDataValueValue(cursor, depth + 1);
      return { text: formatDataValue(value), numeric: null };
    }
    case 24: {
      const value = readVariantValue(cursor, depth + 1);
      return { text: value.formatted ?? 'null', numeric: null };
    }
    case 25: {
      readDiagnosticInfoValue(cursor, depth + 1);
      return { text: 'DiagnosticInfo', numeric: null };
    }
    default:
      // P6 §5.2.2.16: 26-31 atanmamıştır, çözücü onları ByteString saymalı.
      if (typeId >= 26 && typeId <= 31) {
        const value = readByteStringValue(cursor);
        return { text: value === null ? 'null' : formatHexBytes(value), numeric: null };
      }
      throw new OpcUaDecodeError('protocol.opcua.error.unknownVariantType', cursor.offset - 1);
  }
}

export function readVariantValue(cursor: BinaryCursor, depth = 0): OpcUaVariant {
  if (depth > MAX_DIAGNOSTIC_DEPTH) {
    throw new OpcUaDecodeError('protocol.opcua.error.recursionLimit', cursor.offset);
  }
  const encodingMask = readByteValue(cursor);
  const builtInTypeId = encodingMask & VARIANT_TYPE_MASK;
  const builtInTypeName = BUILT_IN_TYPE_NAMES.get(builtInTypeId) ?? `Reserved(${String(builtInTypeId)})`;
  const isArray = (encodingMask & VARIANT_IS_ARRAY) !== 0;

  // Mask 0 => NULL variant, BAŞKA HİÇBİR ALAN kodlanmaz (P6 Tablo 26).
  if (encodingMask === 0) {
    return {
      encodingMask,
      builtInTypeId,
      builtInTypeName,
      isArray: false,
      arrayLength: null,
      dimensions: null,
      formatted: null,
      scalarNumber: null,
    };
  }

  if (!isArray) {
    const scalar = readVariantScalar(cursor, builtInTypeId, depth);
    return {
      encodingMask,
      builtInTypeId,
      builtInTypeName,
      isArray: false,
      arrayLength: null,
      dimensions: null,
      formatted: scalar.text,
      scalarNumber: scalar.numeric,
    };
  }

  const arrayLength = readInt32(cursor);
  if (arrayLength === NULL_LENGTH) {
    // Null dizi: eleman YOK. Boş dizi (uzunluk 0) ile aynı şey değil (tuzak 3).
    return {
      encodingMask,
      builtInTypeId,
      builtInTypeName,
      isArray: true,
      arrayLength,
      dimensions: null,
      formatted: null,
      scalarNumber: null,
    };
  }
  if (arrayLength < 0) {
    throw new OpcUaDecodeError('protocol.opcua.error.negativeLength', cursor.offset - 4);
  }

  const parts: string[] = [];
  for (let index = 0; index < arrayLength; index++) {
    const scalar = readVariantScalar(cursor, builtInTypeId, depth);
    if (index < MAX_FORMATTED_ELEMENTS) parts.push(scalar.text);
  }

  let dimensions: number[] | null = null;
  if ((encodingMask & VARIANT_HAS_DIMENSIONS) !== 0) {
    const dimensionCount = readInt32(cursor);
    if (dimensionCount > 0) {
      dimensions = [];
      for (let index = 0; index < dimensionCount; index++) dimensions.push(readInt32(cursor));
    }
  }

  const suffix = arrayLength > MAX_FORMATTED_ELEMENTS ? ', …' : '';
  return {
    encodingMask,
    builtInTypeId,
    builtInTypeName,
    isArray: true,
    arrayLength,
    dimensions,
    formatted: `[${parts.join(', ')}${suffix}]`,
    scalarNumber: null,
  };
}

// ── DataValue ──────────────────────────────────────────────────────────────

/** P6 Tablo 27 — hangi alanın AKIŞTA olduğunu söyleyen maske. */
export const DATA_VALUE_HAS_VALUE = 0x01;
export const DATA_VALUE_HAS_STATUS = 0x02;
export const DATA_VALUE_HAS_SOURCE_TIMESTAMP = 0x04;
export const DATA_VALUE_HAS_SERVER_TIMESTAMP = 0x08;
export const DATA_VALUE_HAS_SOURCE_PICOSECONDS = 0x10;
export const DATA_VALUE_HAS_SERVER_PICOSECONDS = 0x20;

export interface OpcUaDataValue {
  encodingMask: number;
  value: OpcUaVariant | null;
  statusCode: number | null;
  sourceTimestamp: OpcUaDateTime | null;
  sourcePicoseconds: number | null;
  serverTimestamp: OpcUaDateTime | null;
  serverPicoseconds: number | null;
}

export function readDataValueValue(cursor: BinaryCursor, depth = 0): OpcUaDataValue {
  if (depth > MAX_DIAGNOSTIC_DEPTH) {
    throw new OpcUaDecodeError('protocol.opcua.error.recursionLimit', cursor.offset);
  }
  const encodingMask = readByteValue(cursor);
  // Alan sırası maskenin bit sırası DEĞİL, P6 Tablo 27'nin SATIR sırasıdır:
  // Value, Status, SourceTimestamp, SourcePicoseconds, ServerTimestamp,
  // ServerPicoseconds. O6 `DataValue_encodeBinary` de bu sırayla yazıyor.
  const value = (encodingMask & DATA_VALUE_HAS_VALUE) !== 0 ? readVariantValue(cursor, depth + 1) : null;
  const statusCode = (encodingMask & DATA_VALUE_HAS_STATUS) !== 0 ? readUInt32(cursor) : null;
  const sourceTimestamp =
    (encodingMask & DATA_VALUE_HAS_SOURCE_TIMESTAMP) !== 0 ? readDateTimeValue(cursor) : null;
  const sourcePicoseconds =
    (encodingMask & DATA_VALUE_HAS_SOURCE_PICOSECONDS) !== 0 ? readUInt16(cursor) : null;
  const serverTimestamp =
    (encodingMask & DATA_VALUE_HAS_SERVER_TIMESTAMP) !== 0 ? readDateTimeValue(cursor) : null;
  const serverPicoseconds =
    (encodingMask & DATA_VALUE_HAS_SERVER_PICOSECONDS) !== 0 ? readUInt16(cursor) : null;
  return {
    encodingMask,
    value,
    statusCode,
    sourceTimestamp,
    sourcePicoseconds,
    serverTimestamp,
    serverPicoseconds,
  };
}

export function formatDataValue(dataValue: OpcUaDataValue): string {
  const parts: string[] = [];
  if (dataValue.value !== null) {
    parts.push(`${dataValue.value.builtInTypeName}=${dataValue.value.formatted ?? 'null'}`);
  }
  if (dataValue.statusCode !== null) parts.push(formatStatusCode(dataValue.statusCode));
  if (dataValue.sourceTimestamp?.iso != null) parts.push(`src=${dataValue.sourceTimestamp.iso}`);
  if (dataValue.serverTimestamp?.iso != null) parts.push(`srv=${dataValue.serverTimestamp.iso}`);
  return parts.length === 0 ? '—' : parts.join(' · ');
}

// ── DiagnosticInfo ─────────────────────────────────────────────────────────

/** P6 Tablo 22 maskesi. */
export const DIAGNOSTIC_HAS_SYMBOLIC_ID = 0x01;
export const DIAGNOSTIC_HAS_NAMESPACE = 0x02;
export const DIAGNOSTIC_HAS_LOCALIZED_TEXT = 0x04;
export const DIAGNOSTIC_HAS_LOCALE = 0x08;
export const DIAGNOSTIC_HAS_ADDITIONAL_INFO = 0x10;
export const DIAGNOSTIC_HAS_INNER_STATUS = 0x20;
export const DIAGNOSTIC_HAS_INNER_DIAGNOSTIC = 0x40;

export interface OpcUaDiagnosticInfo {
  encodingMask: number;
  additionalInfo: string | null;
  innerStatusCode: number | null;
}

export function readDiagnosticInfoValue(cursor: BinaryCursor, depth = 0): OpcUaDiagnosticInfo {
  if (depth > MAX_DIAGNOSTIC_DEPTH) {
    throw new OpcUaDecodeError('protocol.opcua.error.recursionLimit', cursor.offset);
  }
  const encodingMask = readByteValue(cursor);
  // Alan SIRASI maskenin bit sırasından farklıdır: SymbolicId, NamespaceUri,
  // Locale, LocalizedText (P6 Tablo 22 satır sırası — maskede LocalizedText
  // 0x04, Locale 0x08 ama AKIŞTA Locale ÖNCE gelir). Bu ters çevrim
  // atlanırsa iki Int32 yer değiştirir ve hata sessiz kalır.
  if ((encodingMask & DIAGNOSTIC_HAS_SYMBOLIC_ID) !== 0) readInt32(cursor);
  if ((encodingMask & DIAGNOSTIC_HAS_NAMESPACE) !== 0) readInt32(cursor);
  if ((encodingMask & DIAGNOSTIC_HAS_LOCALE) !== 0) readInt32(cursor);
  if ((encodingMask & DIAGNOSTIC_HAS_LOCALIZED_TEXT) !== 0) readInt32(cursor);
  const additionalInfo =
    (encodingMask & DIAGNOSTIC_HAS_ADDITIONAL_INFO) !== 0 ? readStringValue(cursor) : null;
  const innerStatusCode = (encodingMask & DIAGNOSTIC_HAS_INNER_STATUS) !== 0 ? readUInt32(cursor) : null;
  if ((encodingMask & DIAGNOSTIC_HAS_INNER_DIAGNOSTIC) !== 0) {
    readDiagnosticInfoValue(cursor, depth + 1);
  }
  return { encodingMask, additionalInfo, innerStatusCode };
}
