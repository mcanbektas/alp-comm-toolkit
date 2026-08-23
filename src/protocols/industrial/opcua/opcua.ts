/**
 * OPC UA — OPC UA Connection Protocol (UACP) + OPC UA Secure Conversation
 * (UASC) çerçeve çözücüsü. Faz 10, dalga 13c; `scada-utility` ailesini kapatır.
 *
 * ── KAYNAK UYARISI — bu kayıt domain'in İSTİSNASI ─────────────────────────
 * `brief-faz10-dalga13.md` bu domain için "ticari konsorsiyum spec'leri, çoğu
 * ücretli" diyor. **OPC UA bu kuralın DIŞINDA:** OPC Foundation'ın Part 6
 * (Mappings) metni halka açıktır ve tip/servis tabloları MİT lisanslı,
 * MAKİNE-OKUNUR biçimde yayımlanır. Kaynak riski DÜŞÜK, HACİM riski YÜKSEK —
 * bu yüzden aşağıdaki KAPSAM bölümü bir daraltma değil, bilinçli bir çizgidir.
 *
 * Aşağıdaki her alan yerleşimi ÜÇ bağımsız kaynakta ÇAPRAZ TEYİTLİDİR:
 *   P6  = OPC 10000-6 (Part 6: Mappings) v1.05 §6.7.2 (UASC) + §7.1.2 (UACP)
 *         https://reference.opcfoundation.org/Core/Part6/v105/docs/7.1.2
 *   WS  = Wireshark `plugins/epan/opcua/opcua_transport_layer.c` + `opcua.c`
 *         (GPL-2.0, bağımsız implementasyon)
 *   BSD = OPC Foundation `Schema/Opc.Ua.Types.bsd` + `NodeIds.csv` (MIT,
 *         makine-okunur servis gövdesi tanımları ve encoding id'leri)
 * Yerleşik tiplerin (NodeId/Variant/DataValue/…) kaynak dökümü `opcUaBinary.ts`
 * dosya başındadır; orada open62541 de dördüncü kaynak olarak kullanıldı.
 *
 * Çelişki bulunmadı. Tek kaynakta kalan hiçbir alan ADLANDIRILMADI.
 *
 * ── GİRDİ ─────────────────────────────────────────────────────────────────
 * Girdi = **OPC UA TCP (UACP) binary çerçevesi**, tek MessageChunk. HTTPS/SOAP/
 * JSON mapping'leri (P6 §7.3-§7.5) KAPSAM DIŞI: onlar aynı servis modelini
 * TAMAMEN BAŞKA bir tel biçiminde taşır, ortak çözücüsü yoktur.
 *
 * ── KAPSAM — neyin çözüldüğü, neyin HAM bırakıldığı ───────────────────────
 * ÇÖZÜLÜR:
 *   - UACP mesajları TAM: HEL / ACK / ERR / RHE (P6 Tablo 73-77).
 *   - UASC zarfı TAM: OPN'in asimetrik güvenlik başlığı (SecurityPolicyUri,
 *     SenderCertificate, ReceiverCertificateThumbprint), MSG/CLO'nun simetrik
 *     başlığı (TokenId), her ikisinin SequenceHeader'ı (SequenceNumber,
 *     RequestId). ChunkType F/C/A ayrımı ve Abort gövdesi.
 *   - Gövdenin servis kimliği: **78 kanonik servisin tamamı** ADLANDIRILIR
 *     (`NodeIds.csv`den `*_Encoding_DefaultBinary`).
 *   - RequestHeader / ResponseHeader HER serviste çözülür.
 *   - **DOKUZ servisin gövdesi alan alan çözülür:** OpenSecureChannel
 *     Request/Response, CloseSecureChannel Request, Read Request/Response,
 *     Write Request, Browse Request, CreateSubscription Request/Response.
 *     Seçim ölçütü: kaydın araç listesindeki (Secure Channel · Read · Write ·
 *     Browse · Subscription) her aracı EN AZ BİR gerçek gövdeyle karşılamak.
 * HAM BIRAKILIR (bilerek):
 *   - Kalan 69 servisin gövdesi. Adı ve header'ı basılır, gövde tek bir
 *     "Service Body" alanı olarak ham gösterilir. Gerekçe: her birinin BSD
 *     tanımı elde olsa da 69 gövdenin alan alan yazımı bu dalganın hacmini
 *     kat kat aşar ve karşılığında tek bir yeni tel-biçimi dersi vermez —
 *     [[IEC 61850 GOOSE-only]] ve 13a'nın Format-A-only presedanıyla aynı
 *     çizgi. Kullanıcı ne aldığını özet metninden okur.
 *   - Session (CreateSession/ActivateSession) ve Endpoint Discovery
 *     (GetEndpoints/FindServers) gövdeleri: ApplicationDescription +
 *     EndpointDescription + UserTokenPolicy ağaçları, sertifika ve nonce
 *     blobları taşır; adları ve header'ları basılır, gövdeleri ham kalır.
 *   - Method (Call) ve MonitoredItems (CreateMonitoredItems) gövdeleri: aynı
 *     gerekçe. Subscription tarafı CreateSubscription ile temsil edilir.
 *   - Çok parçalı (chunked) mesaj BİRLEŞTİRİLMEZ: bu parser tek çerçeve
 *     çözer, akış durumu stream katmanının işidir (`ProtocolParser`
 *     sözleşmesi: "parse çağrısı içeride durum biriktirmez").
 *
 * ── KRİPTO SINIRI — zarf EVET, kripto HAYIR ───────────────────────────────
 * Depoda kurulu presedan: `snmp.ts` (v3 zarfı çözülür, şifreli ScopedPDU
 * "Encrypted" bırakılır), `ntp.ts` (MD5 özeti DOĞRULANMAZ), `wirelessMbus.ts`
 * (Security Mode çıkarılır, AES ÇÖZÜLMEZ), `websocket.ts`
 * (`Sec-WebSocket-Accept` ayrı bir hesap aracı sayıldı). Teknik gerekçe:
 * `ProtocolParser.parse()` SAF ve SENKRONdur, tarayıcıda `SubtleCrypto`
 * yalnız ASENKRONdur.
 *
 * OPC UA karşılığı: SecurityPolicyUri, SenderCertificate,
 * ReceiverCertificateThumbprint, TokenId, SequenceNumber ÇÖZÜLÜR ve gösterilir;
 * **imza doğrulama, sertifika zinciri doğrulama ve şifre çözme YAPILMAZ.**
 * Şifreli bölge tek bir "Encrypted Payload" alanı olarak bırakılır.
 *
 * Şifreli bölgenin SINIRI (WS `opcua.c`in kendi ASCII şemasıyla teyitli):
 *   Message Header + Security Header  → HER ZAMAN açık
 *   Sequence Header + Body + Padding + Signature → SignAndEncrypt'te ŞİFRELİ
 * Yani SignAndEncrypt'te SequenceNumber bile okunamaz; onu okuyormuş gibi
 * basmak uydurmak olurdu.
 *
 * ── `decodeOptions` — neden GEREKLİ ───────────────────────────────────────
 * MessageSecurityMode ve imza uzunluğu SecureChannel açılışında PAZARLIKLA
 * belirlenir; tek bir MSG çerçevesinin BAYTLARINDA YOKTUR. Wireshark aynı
 * boşluğu aynı şekilde kapatıyor: `g_opcua_default_sig_len` bir KULLANICI
 * TERCİHİdir, `UA_MessageMode_MaybeEncrypted` ise bir SEZGİdir. İki kanal:
 *   1. `bodySecurity` — `auto` (varsayılan) / `plaintext` / `encrypted`.
 *      `auto`, WS'in `UA_MessageMode_MaybeEncrypted` sezgisinin aynısıdır:
 *      SequenceHeader'dan sonraki NodeId TANINAN bir servise çözülüyorsa
 *      gövde açıktır, çözülmüyorsa şifreli sayılır. OPN'de ayrıca
 *      SecurityPolicyUri `#None` ile bitiyorsa gövde KESİN açıktır —
 *      bu bilgi baytların İÇİNDEDİR, sezgiye gerek kalmaz.
 *   2. `signatureLength` — Sign modunda gövdenin SONUNDAKİ imza bayt sayısı.
 *      Politikaya bağlıdır (ör. HMAC-SHA256 → 32), çerçevede YAZMAZ.
 *      Varsayılan 0 = "imza yok/ayırma".
 *
 * ── ENCODER ───────────────────────────────────────────────────────────────
 * Encoder YAZILMADI. Bu depoda `ProtocolEncoder` yalnız framing ailesinde
 * (dalga 10) var; `modbus-rtu`/`iec-60870-5-101` gibi `build` sekmeli
 * protokoller de encoder göndermiyor, sekme jenerik Packet Builder ile
 * karşılanıyor. Aynı çizgide kalındı.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import type { BinaryCursor } from './opcUaBinary';
import {
  OpcUaDecodeError,
  createCursor,
  formatDataValue,
  formatHexBytes,
  formatNodeId,
  formatQualifiedName,
  formatStatusCode,
  readByteValue,
  readByteStringValue,
  readBooleanValue,
  readDataValueValue,
  readDateTimeValue,
  readDiagnosticInfoValue,
  readDoubleValue,
  readExtensionObjectValue,
  readInt32,
  readNodeIdValue,
  readQualifiedNameValue,
  readStringValue,
  readUInt32,
} from './opcUaBinary';

const PROTOCOL_ID = 'opc-ua';
const PROTOCOL_DISPLAY_NAME = 'OPC UA';

/** P6 Tablo 73: 3 bayt ASCII tip + 1 bayt chunk + UInt32 boyut. */
const MESSAGE_HEADER_LENGTH = 8;
const SEQUENCE_HEADER_LENGTH = 8;

const MESSAGE_TYPE_HELLO = 'HEL';
const MESSAGE_TYPE_ACKNOWLEDGE = 'ACK';
const MESSAGE_TYPE_ERROR = 'ERR';
const MESSAGE_TYPE_REVERSE_HELLO = 'RHE';
const MESSAGE_TYPE_OPEN = 'OPN';
const MESSAGE_TYPE_CLOSE = 'CLO';
const MESSAGE_TYPE_MESSAGE = 'MSG';

/**
 * P6 Tablo 73/57: HEL/ACK/ERR/RHE'de bu bayt "yok sayılır, 'F' olmalı";
 * MSG'de gerçek anlam taşır. AYNI KONUM, FARKLI ANLAM — 12e'nin GetBulk dersi.
 */
const CHUNK_FINAL = 'F';
const CHUNK_INTERMEDIATE = 'C';
const CHUNK_ABORT = 'A';

const MESSAGE_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
  [MESSAGE_TYPE_HELLO, 'Hello'],
  [MESSAGE_TYPE_ACKNOWLEDGE, 'Acknowledge'],
  [MESSAGE_TYPE_ERROR, 'Error'],
  [MESSAGE_TYPE_REVERSE_HELLO, 'ReverseHello'],
  [MESSAGE_TYPE_OPEN, 'OpenSecureChannel'],
  [MESSAGE_TYPE_CLOSE, 'CloseSecureChannel'],
  [MESSAGE_TYPE_MESSAGE, 'Message'],
]);

const CHUNK_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
  [CHUNK_FINAL, 'Final chunk'],
  [CHUNK_INTERMEDIATE, 'Intermediate chunk'],
  [CHUNK_ABORT, 'Abort (final, message aborted)'],
]);

/**
 * Servis gövdesi kimlikleri — `UA_Nodeset/Schema/NodeIds.csv`den
 * `*_Encoding_DefaultBinary` satırları (MIT, makine-okunur). WS'in
 * `g_requesttypes` tablosuyla örtüşüyor. Üç yapı (CallMethodRequest=706,
 * MonitoredItemCreateRequest=745, MonitoredItemModifyRequest=757) CSV'de aynı
 * ekle biter ama TOP-LEVEL SERVİS DEĞİLDİR (iç yapılardır) — bilerek
 * DIŞARIDA bırakıldı, yoksa gövdesi servis sanılırdı.
 */
const SERVICE_NAMES: ReadonlyMap<number, string> = new Map([
  [422, 'FindServersRequest'],
  [425, 'FindServersResponse'],
  [428, 'GetEndpointsRequest'],
  [431, 'GetEndpointsResponse'],
  [437, 'RegisterServerRequest'],
  [440, 'RegisterServerResponse'],
  [446, 'OpenSecureChannelRequest'],
  [449, 'OpenSecureChannelResponse'],
  [452, 'CloseSecureChannelRequest'],
  [455, 'CloseSecureChannelResponse'],
  [461, 'CreateSessionRequest'],
  [464, 'CreateSessionResponse'],
  [467, 'ActivateSessionRequest'],
  [470, 'ActivateSessionResponse'],
  [473, 'CloseSessionRequest'],
  [476, 'CloseSessionResponse'],
  [479, 'CancelRequest'],
  [482, 'CancelResponse'],
  [488, 'AddNodesRequest'],
  [491, 'AddNodesResponse'],
  [494, 'AddReferencesRequest'],
  [497, 'AddReferencesResponse'],
  [500, 'DeleteNodesRequest'],
  [503, 'DeleteNodesResponse'],
  [506, 'DeleteReferencesRequest'],
  [509, 'DeleteReferencesResponse'],
  [527, 'BrowseRequest'],
  [530, 'BrowseResponse'],
  [533, 'BrowseNextRequest'],
  [536, 'BrowseNextResponse'],
  [554, 'TranslateBrowsePathsToNodeIdsRequest'],
  [557, 'TranslateBrowsePathsToNodeIdsResponse'],
  [560, 'RegisterNodesRequest'],
  [563, 'RegisterNodesResponse'],
  [566, 'UnregisterNodesRequest'],
  [569, 'UnregisterNodesResponse'],
  [615, 'QueryFirstRequest'],
  [618, 'QueryFirstResponse'],
  [621, 'QueryNextRequest'],
  [624, 'QueryNextResponse'],
  [631, 'ReadRequest'],
  [634, 'ReadResponse'],
  [664, 'HistoryReadRequest'],
  [667, 'HistoryReadResponse'],
  [673, 'WriteRequest'],
  [676, 'WriteResponse'],
  [700, 'HistoryUpdateRequest'],
  [703, 'HistoryUpdateResponse'],
  [712, 'CallRequest'],
  [715, 'CallResponse'],
  [751, 'CreateMonitoredItemsRequest'],
  [754, 'CreateMonitoredItemsResponse'],
  [763, 'ModifyMonitoredItemsRequest'],
  [766, 'ModifyMonitoredItemsResponse'],
  [769, 'SetMonitoringModeRequest'],
  [772, 'SetMonitoringModeResponse'],
  [775, 'SetTriggeringRequest'],
  [778, 'SetTriggeringResponse'],
  [781, 'DeleteMonitoredItemsRequest'],
  [784, 'DeleteMonitoredItemsResponse'],
  [787, 'CreateSubscriptionRequest'],
  [790, 'CreateSubscriptionResponse'],
  [793, 'ModifySubscriptionRequest'],
  [796, 'ModifySubscriptionResponse'],
  [799, 'SetPublishingModeRequest'],
  [802, 'SetPublishingModeResponse'],
  [826, 'PublishRequest'],
  [829, 'PublishResponse'],
  [832, 'RepublishRequest'],
  [835, 'RepublishResponse'],
  [841, 'TransferSubscriptionsRequest'],
  [844, 'TransferSubscriptionsResponse'],
  [847, 'DeleteSubscriptionsRequest'],
  [850, 'DeleteSubscriptionsResponse'],
  [12208, 'FindServersOnNetworkRequest'],
  [12209, 'FindServersOnNetworkResponse'],
  [12211, 'RegisterServer2Request'],
  [12212, 'RegisterServer2Response'],
]);

const SERVICE_OPEN_SECURE_CHANNEL_REQUEST = 446;
const SERVICE_OPEN_SECURE_CHANNEL_RESPONSE = 449;
const SERVICE_CLOSE_SECURE_CHANNEL_REQUEST = 452;
const SERVICE_BROWSE_REQUEST = 527;
const SERVICE_READ_REQUEST = 631;
const SERVICE_READ_RESPONSE = 634;
const SERVICE_WRITE_REQUEST = 673;
const SERVICE_CREATE_SUBSCRIPTION_REQUEST = 787;
const SERVICE_CREATE_SUBSCRIPTION_RESPONSE = 790;

/** `Schema/AttributeIds.csv` (MIT). Read/Write gövdesinde AttributeId adı. */
const ATTRIBUTE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'NodeId'],
  [2, 'NodeClass'],
  [3, 'BrowseName'],
  [4, 'DisplayName'],
  [5, 'Description'],
  [6, 'WriteMask'],
  [7, 'UserWriteMask'],
  [8, 'IsAbstract'],
  [9, 'Symmetric'],
  [10, 'InverseName'],
  [11, 'ContainsNoLoops'],
  [12, 'EventNotifier'],
  [13, 'Value'],
  [14, 'DataType'],
  [15, 'ValueRank'],
  [16, 'ArrayDimensions'],
  [17, 'AccessLevel'],
  [18, 'UserAccessLevel'],
  [19, 'MinimumSamplingInterval'],
  [20, 'Historizing'],
  [21, 'Executable'],
  [22, 'UserExecutable'],
  [23, 'DataTypeDefinition'],
  [24, 'RolePermissions'],
  [25, 'UserRolePermissions'],
  [26, 'AccessRestrictions'],
  [27, 'AccessLevelEx'],
]);

/** `Opc.Ua.Types.bsd` numaralandırmaları (MIT). */
const TIMESTAMPS_TO_RETURN_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Source'],
  [1, 'Server'],
  [2, 'Both'],
  [3, 'Neither'],
  [4, 'Invalid'],
]);

const BROWSE_DIRECTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Forward'],
  [1, 'Inverse'],
  [2, 'Both'],
  [3, 'Invalid'],
]);

const MESSAGE_SECURITY_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Invalid'],
  [1, 'None'],
  [2, 'Sign'],
  [3, 'SignAndEncrypt'],
]);

const SECURITY_TOKEN_REQUEST_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Issue'],
  [1, 'Renew'],
]);

/**
 * `#None` politikası gövdenin açık olduğunu ÇERÇEVENİN İÇİNDEN söyler —
 * sezgiye gerek bırakmaz (P6 §6.1 SecurityPolicy URI'leri).
 */
const SECURITY_POLICY_NONE_SUFFIX = '#None';

const ERROR_EMPTY_FRAME = 'protocol.opcua.error.emptyFrame';
const ERROR_HEADER_TRUNCATED = 'protocol.opcua.error.headerTruncated';
const ERROR_UNKNOWN_MESSAGE_TYPE = 'protocol.opcua.error.unknownMessageType';
const ERROR_MESSAGE_SIZE_TOO_SMALL = 'protocol.opcua.error.messageSizeTooSmall';
const ERROR_FRAME_TOO_LONG = 'protocol.opcua.error.frameTooLong';
const ERROR_ABORTED = 'protocol.opcua.error.aborted';
const ERROR_BODY_TRUNCATED = 'protocol.opcua.error.bodyTruncated';

const WARN_MESSAGE_SIZE_EXCEEDS_BUFFER = 'protocol.opcua.warning.messageSizeExceedsBuffer';
const WARN_TRAILING_BYTES = 'protocol.opcua.warning.trailingBytes';
const WARN_CHUNK_TYPE_NOT_FINAL = 'protocol.opcua.warning.chunkTypeNotFinal';
const WARN_UNKNOWN_CHUNK_TYPE = 'protocol.opcua.warning.unknownChunkType';
const WARN_INTERMEDIATE_CHUNK_BODY = 'protocol.opcua.warning.intermediateChunkBody';
const WARN_ENCRYPTED_PAYLOAD = 'protocol.opcua.warning.encryptedPayload';
const WARN_UNKNOWN_SERVICE = 'protocol.opcua.warning.unknownService';
const WARN_SERVICE_BODY_NOT_DECODED = 'protocol.opcua.warning.serviceBodyNotDecoded';
const WARN_SIGNATURE_NOT_VERIFIED = 'protocol.opcua.warning.signatureNotVerified';
const WARN_CERTIFICATE_NOT_VALIDATED = 'protocol.opcua.warning.certificateNotValidated';
const WARN_ARRAY_TRUNCATED = 'protocol.opcua.warning.arrayTruncated';
const WARN_BODY_DECODE_FAILED = 'protocol.opcua.warning.bodyDecodeFailed';

const SUMMARY_CONNECTION = 'protocol.opcua.summary.connection';
const SUMMARY_SECURE_CONVERSATION = 'protocol.opcua.summary.secureConversation';
const SUMMARY_ENCRYPTED = 'protocol.opcua.summary.encrypted';

const OPTION_BODY_SECURITY = 'bodySecurity';
const OPTION_SIGNATURE_LENGTH = 'signatureLength';

type BodySecurity = 'auto' | 'plaintext' | 'encrypted';

const BODY_SECURITY_VALUES: readonly BodySecurity[] = ['auto', 'plaintext', 'encrypted'];
const DEFAULT_SIGNATURE_LENGTH = 0;
const MAX_SIGNATURE_LENGTH = 512;

/** Uzun dizilerde ekranı boğmamak için basılan azami eleman sayısı. */
const MAX_ARRAY_ITEMS = 8;

interface OpcUaParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  bodySecurity: BodySecurity;
  signatureLength: number;
}

interface FrameMetadata {
  messageType: string;
  chunkType: string;
  summaryKey: string;
  serviceName: string | null;
}

/** Alan/uyarı/hata biriktiren çözümleme bağlamı. */
interface DecodeState {
  cursor: BinaryCursor;
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  errors: ProtocolError[];
}

function pushWarningOnce(warnings: ProtocolWarning[], code: string, offset?: number): void {
  if (warnings.some((warning) => warning.code === code)) return;
  warnings.push(offset === undefined ? { code, message: code } : { code, message: code, offset });
}

interface FieldInit {
  id: string;
  name: string;
  offset: number;
  length: number;
  rawValue?: bigint | number | string;
  physicalValue?: bigint | number | string;
  unit?: string;
  valid?: boolean;
  warnings?: string[];
}

function addField(state: DecodeState, init: FieldInit): void {
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: state.cursor.data.slice(init.offset, init.offset + init.length),
    valid: init.valid ?? true,
    warnings: init.warnings ?? [],
  };
  if (init.rawValue !== undefined) field.rawValue = init.rawValue;
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  if (init.unit !== undefined) field.unit = init.unit;
  state.fields.push(field);
}

/** `<offset>`den okur, alanı basar ve okunan değeri döndürür. */
function readAndPushUInt32(
  state: DecodeState,
  id: string,
  name: string,
  options: { unit?: string } = {},
): number {
  const offset = state.cursor.offset;
  const value = readUInt32(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: 4,
    rawValue: value,
    // `unit` fiziksel değere YAPIŞTIRILIR; physicalValue boşsa birim TEK BAŞINA
    // basılmaz — birim isteniyorsa değeri de doldurmak gerekir.
    ...(options.unit === undefined ? {} : { physicalValue: value, unit: options.unit }),
  });
  return value;
}

function readAndPushString(state: DecodeState, id: string, name: string): string | null {
  const offset = state.cursor.offset;
  const value = readStringValue(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: state.cursor.offset - offset,
    // −1 (null) ile 0 (boş) AYNI ŞEY DEĞİL; ekranda da ayrılır.
    rawValue: value === null ? 'null' : `"${value}"`,
    ...(value === null ? {} : { physicalValue: value }),
  });
  return value;
}

function readAndPushByteString(
  state: DecodeState,
  id: string,
  name: string,
  extraWarnings: string[] = [],
): Uint8Array | null {
  const offset = state.cursor.offset;
  const value = readByteStringValue(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: state.cursor.offset - offset,
    rawValue: value === null ? 'null' : formatHexBytes(value, 12),
    ...(value === null ? {} : { physicalValue: value.length, unit: 'B' }),
    warnings: extraWarnings,
  });
  return value;
}

function readAndPushDateTime(state: DecodeState, id: string, name: string): void {
  const offset = state.cursor.offset;
  const value = readDateTimeValue(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: 8,
    // Ham tick 1601 epoch'lu; ISO metni onun ÇÖZÜLMÜŞ hâli. Sıfır "1601" değil
    // "belirtilmemiş" demektir, o yüzden physicalValue basılmaz.
    rawValue: value.ticks,
    ...(value.iso === null ? {} : { physicalValue: value.iso }),
  });
}

function readAndPushNodeId(state: DecodeState, id: string, name: string): void {
  const offset = state.cursor.offset;
  const nodeId = readNodeIdValue(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: state.cursor.offset - offset,
    rawValue: formatNodeId(nodeId),
  });
}

function readAndPushStatusCode(state: DecodeState, id: string, name: string): number {
  const offset = state.cursor.offset;
  const value = readUInt32(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: 4,
    rawValue: value,
    physicalValue: formatStatusCode(value),
  });
  return value;
}

function readAndPushEnum(
  state: DecodeState,
  id: string,
  name: string,
  names: ReadonlyMap<number, string>,
): number {
  const offset = state.cursor.offset;
  const value = readUInt32(state.cursor);
  const label = names.get(value);
  addField(state, {
    id,
    name,
    offset,
    length: 4,
    rawValue: value,
    // Tanınmayan numaralandırma değeri ADLANDIRILMAZ — ham kalır.
    ...(label === undefined ? {} : { physicalValue: label }),
  });
  return value;
}

// ── Çerçeve başlığı ────────────────────────────────────────────────────────

function readAscii(data: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index++) {
    text += String.fromCharCode(data[offset + index] ?? 0);
  }
  return text;
}

function detectMessageType(data: Uint8Array): string | undefined {
  if (data.length < 3) return undefined;
  const type = readAscii(data, 0, 3);
  return MESSAGE_TYPE_NAMES.has(type) ? type : undefined;
}

function readChoice(value: unknown, allowed: readonly BodySecurity[], fallback: BodySecurity): BodySecurity {
  if (typeof value !== 'string') return fallback;
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function readSignatureLength(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > MAX_SIGNATURE_LENGTH) {
    return DEFAULT_SIGNATURE_LENGTH;
  }
  return numeric;
}

function resolveParseOptions(context: ParseContext | undefined): OpcUaParseOptions {
  const options = context?.options;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    bodySecurity: readChoice(options?.[OPTION_BODY_SECURITY], BODY_SECURITY_VALUES, 'auto'),
    signatureLength: readSignatureLength(options?.[OPTION_SIGNATURE_LENGTH]),
  };
}

function buildRawFrame(
  data: Uint8Array,
  options: OpcUaParseOptions,
  metadata: FrameMetadata,
): ReturnType<typeof createRawFrame> {
  return createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata: { ...metadata },
  });
}

// ── UACP gövdeleri (HEL / ACK / ERR / RHE) ─────────────────────────────────

function decodeHello(state: DecodeState): void {
  readAndPushUInt32(state, 'protocol-version', 'ProtocolVersion');
  readAndPushUInt32(state, 'receive-buffer-size', 'ReceiveBufferSize', { unit: 'B' });
  readAndPushUInt32(state, 'send-buffer-size', 'SendBufferSize', { unit: 'B' });
  readAndPushUInt32(state, 'max-message-size', 'MaxMessageSize', { unit: 'B' });
  readAndPushUInt32(state, 'max-chunk-count', 'MaxChunkCount');
  readAndPushString(state, 'endpoint-url', 'EndpointUrl');
}

function decodeAcknowledge(state: DecodeState): void {
  readAndPushUInt32(state, 'protocol-version', 'ProtocolVersion');
  readAndPushUInt32(state, 'receive-buffer-size', 'ReceiveBufferSize', { unit: 'B' });
  readAndPushUInt32(state, 'send-buffer-size', 'SendBufferSize', { unit: 'B' });
  readAndPushUInt32(state, 'max-message-size', 'MaxMessageSize', { unit: 'B' });
  readAndPushUInt32(state, 'max-chunk-count', 'MaxChunkCount');
}

function decodeError(state: DecodeState): void {
  readAndPushStatusCode(state, 'error-code', 'Error');
  readAndPushString(state, 'error-reason', 'Reason');
}

function decodeReverseHello(state: DecodeState): void {
  readAndPushString(state, 'server-uri', 'ServerUri');
  readAndPushString(state, 'endpoint-url', 'EndpointUrl');
}

// ── Servis gövdeleri ───────────────────────────────────────────────────────

function decodeRequestHeader(state: DecodeState): void {
  readAndPushNodeId(state, 'request-authentication-token', 'RequestHeader.AuthenticationToken');
  readAndPushDateTime(state, 'request-timestamp', 'RequestHeader.Timestamp');
  readAndPushUInt32(state, 'request-handle', 'RequestHeader.RequestHandle');
  readAndPushUInt32(state, 'request-return-diagnostics', 'RequestHeader.ReturnDiagnostics');
  readAndPushString(state, 'request-audit-entry-id', 'RequestHeader.AuditEntryId');
  readAndPushUInt32(state, 'request-timeout-hint', 'RequestHeader.TimeoutHint', { unit: 'ms' });

  const offset = state.cursor.offset;
  const additional = readExtensionObjectValue(state.cursor);
  addField(state, {
    id: 'request-additional-header',
    name: 'RequestHeader.AdditionalHeader',
    offset,
    length: state.cursor.offset - offset,
    rawValue: formatNodeId(additional.typeId),
    physicalValue: additional.body === null ? 'no body' : `${String(additional.body.length)} B body`,
  });
}

function decodeResponseHeader(state: DecodeState): void {
  readAndPushDateTime(state, 'response-timestamp', 'ResponseHeader.Timestamp');
  readAndPushUInt32(state, 'response-handle', 'ResponseHeader.RequestHandle');
  readAndPushStatusCode(state, 'response-service-result', 'ResponseHeader.ServiceResult');

  const diagnosticsOffset = state.cursor.offset;
  const diagnostics = readDiagnosticInfoValue(state.cursor);
  addField(state, {
    id: 'response-diagnostics',
    name: 'ResponseHeader.ServiceDiagnostics',
    offset: diagnosticsOffset,
    length: state.cursor.offset - diagnosticsOffset,
    rawValue: diagnostics.encodingMask,
    ...(diagnostics.additionalInfo === null ? {} : { physicalValue: diagnostics.additionalInfo }),
  });

  const tableOffset = state.cursor.offset;
  const tableLength = readInt32(state.cursor);
  const entries: string[] = [];
  if (tableLength > 0) {
    for (let index = 0; index < tableLength; index++) {
      const entry = readStringValue(state.cursor);
      if (index < MAX_ARRAY_ITEMS) entries.push(entry ?? 'null');
    }
  }
  addField(state, {
    id: 'response-string-table',
    name: 'ResponseHeader.StringTable',
    offset: tableOffset,
    length: state.cursor.offset - tableOffset,
    rawValue: tableLength,
    ...(entries.length === 0 ? {} : { physicalValue: entries.join(', ') }),
  });

  const additionalOffset = state.cursor.offset;
  const additional = readExtensionObjectValue(state.cursor);
  addField(state, {
    id: 'response-additional-header',
    name: 'ResponseHeader.AdditionalHeader',
    offset: additionalOffset,
    length: state.cursor.offset - additionalOffset,
    rawValue: formatNodeId(additional.typeId),
    physicalValue: additional.body === null ? 'no body' : `${String(additional.body.length)} B body`,
  });
}

/**
 * Dizi başlığını okur ve basar; `-1` (null dizi) ile `0` (boş dizi) AYRI
 * gösterilir. Dönen değer basılacak eleman sayısıdır (üst sınır uygulanmış).
 */
function readAndPushArrayLength(
  state: DecodeState,
  id: string,
  name: string,
): { declared: number; visible: number } {
  const offset = state.cursor.offset;
  const declared = readInt32(state.cursor);
  addField(state, {
    id,
    name,
    offset,
    length: 4,
    rawValue: declared,
    physicalValue: declared < 0 ? 'null array' : `${String(declared)} item(s)`,
  });
  const visible = declared < 0 ? 0 : Math.min(declared, MAX_ARRAY_ITEMS);
  if (declared > MAX_ARRAY_ITEMS) pushWarningOnce(state.warnings, WARN_ARRAY_TRUNCATED, offset);
  return { declared, visible };
}

function decodeOpenSecureChannelRequest(state: DecodeState): void {
  decodeRequestHeader(state);
  readAndPushUInt32(state, 'client-protocol-version', 'ClientProtocolVersion');
  readAndPushEnum(state, 'security-token-request-type', 'RequestType', SECURITY_TOKEN_REQUEST_TYPE_NAMES);
  readAndPushEnum(state, 'message-security-mode', 'SecurityMode', MESSAGE_SECURITY_MODE_NAMES);
  readAndPushByteString(state, 'client-nonce', 'ClientNonce');
  readAndPushUInt32(state, 'requested-lifetime', 'RequestedLifetime', { unit: 'ms' });
}

function decodeOpenSecureChannelResponse(state: DecodeState): void {
  decodeResponseHeader(state);
  readAndPushUInt32(state, 'server-protocol-version', 'ServerProtocolVersion');
  readAndPushUInt32(state, 'token-channel-id', 'SecurityToken.ChannelId');
  readAndPushUInt32(state, 'token-id-issued', 'SecurityToken.TokenId');
  readAndPushDateTime(state, 'token-created-at', 'SecurityToken.CreatedAt');
  readAndPushUInt32(state, 'token-revised-lifetime', 'SecurityToken.RevisedLifetime', { unit: 'ms' });
  readAndPushByteString(state, 'server-nonce', 'ServerNonce');
}

function decodeReadRequest(state: DecodeState): void {
  decodeRequestHeader(state);

  const maxAgeOffset = state.cursor.offset;
  const maxAge = readDoubleValue(state.cursor);
  addField(state, {
    id: 'read-max-age',
    name: 'MaxAge',
    offset: maxAgeOffset,
    length: 8,
    rawValue: maxAge,
    physicalValue: maxAge,
    unit: 'ms',
  });

  readAndPushEnum(state, 'read-timestamps-to-return', 'TimestampsToReturn', TIMESTAMPS_TO_RETURN_NAMES);
  const { visible } = readAndPushArrayLength(state, 'read-node-count', 'NodesToRead (count)');

  for (let index = 0; index < visible; index++) {
    // Her alanın id'si KENDİ offset'ini taşır: aynı fonksiyon birden çok alan
    // basıyorsa sabit id çakışır (12g/12h'de iki kez yakalandı).
    const nodeOffset = state.cursor.offset;
    readAndPushNodeId(state, `read-node-id-${String(nodeOffset)}`, 'ReadValueId.NodeId');

    const attributeOffset = state.cursor.offset;
    const attributeId = readUInt32(state.cursor);
    const attributeName = ATTRIBUTE_NAMES.get(attributeId);
    addField(state, {
      id: `read-attribute-id-${String(attributeOffset)}`,
      name: 'ReadValueId.AttributeId',
      offset: attributeOffset,
      length: 4,
      rawValue: attributeId,
      ...(attributeName === undefined ? {} : { physicalValue: attributeName }),
    });

    readAndPushString(state, `read-index-range-${String(state.cursor.offset)}`, 'ReadValueId.IndexRange');

    const encodingOffset = state.cursor.offset;
    const dataEncoding = readQualifiedNameValue(state.cursor);
    addField(state, {
      id: `read-data-encoding-${String(encodingOffset)}`,
      name: 'ReadValueId.DataEncoding',
      offset: encodingOffset,
      length: state.cursor.offset - encodingOffset,
      rawValue: dataEncoding.name === null ? 'null' : formatQualifiedName(dataEncoding),
    });
  }
}

function decodeReadResponse(state: DecodeState): void {
  decodeResponseHeader(state);
  const { visible } = readAndPushArrayLength(state, 'read-results-count', 'Results (count)');
  for (let index = 0; index < visible; index++) {
    const offset = state.cursor.offset;
    const dataValue = readDataValueValue(state.cursor);
    addField(state, {
      id: `read-result-${String(offset)}`,
      name: 'Results[].DataValue',
      offset,
      length: state.cursor.offset - offset,
      rawValue: dataValue.encodingMask,
      physicalValue: formatDataValue(dataValue),
    });
  }
  readAndPushArrayLength(state, 'read-diagnostics-count', 'DiagnosticInfos (count)');
}

function decodeWriteRequest(state: DecodeState): void {
  decodeRequestHeader(state);
  const { visible } = readAndPushArrayLength(state, 'write-node-count', 'NodesToWrite (count)');
  for (let index = 0; index < visible; index++) {
    readAndPushNodeId(state, `write-node-id-${String(state.cursor.offset)}`, 'WriteValue.NodeId');

    const attributeOffset = state.cursor.offset;
    const attributeId = readUInt32(state.cursor);
    const attributeName = ATTRIBUTE_NAMES.get(attributeId);
    addField(state, {
      id: `write-attribute-id-${String(attributeOffset)}`,
      name: 'WriteValue.AttributeId',
      offset: attributeOffset,
      length: 4,
      rawValue: attributeId,
      ...(attributeName === undefined ? {} : { physicalValue: attributeName }),
    });

    readAndPushString(state, `write-index-range-${String(state.cursor.offset)}`, 'WriteValue.IndexRange');

    const valueOffset = state.cursor.offset;
    const dataValue = readDataValueValue(state.cursor);
    addField(state, {
      id: `write-value-${String(valueOffset)}`,
      name: 'WriteValue.Value',
      offset: valueOffset,
      length: state.cursor.offset - valueOffset,
      rawValue: dataValue.encodingMask,
      physicalValue: formatDataValue(dataValue),
    });
  }
}

function decodeBrowseRequest(state: DecodeState): void {
  decodeRequestHeader(state);
  readAndPushNodeId(state, 'browse-view-id', 'View.ViewId');
  readAndPushDateTime(state, 'browse-view-timestamp', 'View.Timestamp');
  readAndPushUInt32(state, 'browse-view-version', 'View.ViewVersion');
  readAndPushUInt32(state, 'browse-max-references', 'RequestedMaxReferencesPerNode');

  const { visible } = readAndPushArrayLength(state, 'browse-node-count', 'NodesToBrowse (count)');
  for (let index = 0; index < visible; index++) {
    readAndPushNodeId(state, `browse-node-id-${String(state.cursor.offset)}`, 'BrowseDescription.NodeId');
    readAndPushEnum(
      state,
      `browse-direction-${String(state.cursor.offset)}`,
      'BrowseDescription.BrowseDirection',
      BROWSE_DIRECTION_NAMES,
    );
    readAndPushNodeId(
      state,
      `browse-reference-type-${String(state.cursor.offset)}`,
      'BrowseDescription.ReferenceTypeId',
    );

    const subtypesOffset = state.cursor.offset;
    const includeSubtypes = readBooleanValue(state.cursor);
    addField(state, {
      id: `browse-include-subtypes-${String(subtypesOffset)}`,
      name: 'BrowseDescription.IncludeSubtypes',
      offset: subtypesOffset,
      length: 1,
      rawValue: includeSubtypes ? 1 : 0,
      physicalValue: includeSubtypes ? 'true' : 'false',
    });

    readAndPushUInt32(
      state,
      `browse-node-class-mask-${String(state.cursor.offset)}`,
      'BrowseDescription.NodeClassMask',
    );
    readAndPushUInt32(
      state,
      `browse-result-mask-${String(state.cursor.offset)}`,
      'BrowseDescription.ResultMask',
    );
  }
}

function decodeCreateSubscriptionRequest(state: DecodeState): void {
  decodeRequestHeader(state);

  const intervalOffset = state.cursor.offset;
  const interval = readDoubleValue(state.cursor);
  addField(state, {
    id: 'subscription-publishing-interval',
    name: 'RequestedPublishingInterval',
    offset: intervalOffset,
    length: 8,
    rawValue: interval,
    physicalValue: interval,
    unit: 'ms',
  });

  readAndPushUInt32(state, 'subscription-lifetime-count', 'RequestedLifetimeCount');
  readAndPushUInt32(state, 'subscription-max-keep-alive', 'RequestedMaxKeepAliveCount');
  readAndPushUInt32(state, 'subscription-max-notifications', 'MaxNotificationsPerPublish');

  const enabledOffset = state.cursor.offset;
  const enabled = readBooleanValue(state.cursor);
  addField(state, {
    id: 'subscription-publishing-enabled',
    name: 'PublishingEnabled',
    offset: enabledOffset,
    length: 1,
    rawValue: enabled ? 1 : 0,
    physicalValue: enabled ? 'true' : 'false',
  });

  const priorityOffset = state.cursor.offset;
  const priority = readByteValue(state.cursor);
  addField(state, {
    id: 'subscription-priority',
    name: 'Priority',
    offset: priorityOffset,
    length: 1,
    rawValue: priority,
  });
}

function decodeCreateSubscriptionResponse(state: DecodeState): void {
  decodeResponseHeader(state);
  readAndPushUInt32(state, 'subscription-id', 'SubscriptionId');

  const intervalOffset = state.cursor.offset;
  const interval = readDoubleValue(state.cursor);
  addField(state, {
    id: 'subscription-revised-interval',
    name: 'RevisedPublishingInterval',
    offset: intervalOffset,
    length: 8,
    rawValue: interval,
    physicalValue: interval,
    unit: 'ms',
  });

  readAndPushUInt32(state, 'subscription-revised-lifetime', 'RevisedLifetimeCount');
  readAndPushUInt32(state, 'subscription-revised-keep-alive', 'RevisedMaxKeepAliveCount');
}

/** Alan alan çözülen dokuz servis. Kalanlar ad + header + ham gövde. */
function decodeKnownServiceBody(state: DecodeState, serviceId: number): boolean {
  switch (serviceId) {
    case SERVICE_OPEN_SECURE_CHANNEL_REQUEST:
      decodeOpenSecureChannelRequest(state);
      return true;
    case SERVICE_OPEN_SECURE_CHANNEL_RESPONSE:
      decodeOpenSecureChannelResponse(state);
      return true;
    case SERVICE_CLOSE_SECURE_CHANNEL_REQUEST:
      // Gövdesi YALNIZ RequestHeader'dır (BSD ile teyitli) — ham kalan bir şey yok.
      decodeRequestHeader(state);
      return true;
    case SERVICE_READ_REQUEST:
      decodeReadRequest(state);
      return true;
    case SERVICE_READ_RESPONSE:
      decodeReadResponse(state);
      return true;
    case SERVICE_WRITE_REQUEST:
      decodeWriteRequest(state);
      return true;
    case SERVICE_BROWSE_REQUEST:
      decodeBrowseRequest(state);
      return true;
    case SERVICE_CREATE_SUBSCRIPTION_REQUEST:
      decodeCreateSubscriptionRequest(state);
      return true;
    case SERVICE_CREATE_SUBSCRIPTION_RESPONSE:
      decodeCreateSubscriptionResponse(state);
      return true;
    default:
      return false;
  }
}

/**
 * Gövdenin başındaki NodeId'yi okuyup servis adını çözer.
 *
 * P6 §5.2.9: "Messages are Structures encoded as sequence of bytes prefixed by
 * the NodeId of the OPC UA Binary DataTypeEncoding" — ExtensionObject GİBİ
 * DEĞİL: encoding baytı ve uzunluk alanı YOKTUR, NodeId'den hemen sonra
 * gövde başlar. (WS `parseService` de tam bunu yapıyor.)
 */
function peekServiceId(data: Uint8Array, offset: number): number | undefined {
  try {
    const cursor = createCursor(data, offset);
    const nodeId = readNodeIdValue(cursor);
    if (nodeId.identifier.kind !== 'numeric' || nodeId.namespaceIndex !== 0) return undefined;
    return SERVICE_NAMES.has(nodeId.identifier.value) ? nodeId.identifier.value : undefined;
  } catch {
    return undefined;
  }
}

function decodeServiceBody(state: DecodeState, bodyEnd: number): void {
  const typeIdOffset = state.cursor.offset;
  const typeId = readNodeIdValue(state.cursor);
  const serviceId =
    typeId.identifier.kind === 'numeric' && typeId.namespaceIndex === 0 ? typeId.identifier.value : undefined;
  const serviceName = serviceId === undefined ? undefined : SERVICE_NAMES.get(serviceId);

  addField(state, {
    id: 'service-type-id',
    name: 'Message.TypeId',
    offset: typeIdOffset,
    length: state.cursor.offset - typeIdOffset,
    rawValue: formatNodeId(typeId),
    ...(serviceName === undefined ? {} : { physicalValue: serviceName }),
    valid: serviceName !== undefined,
    warnings: serviceName === undefined ? [WARN_UNKNOWN_SERVICE] : [],
  });

  if (serviceName === undefined) {
    pushWarningOnce(state.warnings, WARN_UNKNOWN_SERVICE, typeIdOffset);
    pushRemainingBody(state, bodyEnd, 'service-body', 'Service Body (not decoded)', []);
    return;
  }

  const decoded = serviceId === undefined ? false : decodeKnownServiceBody(state, serviceId);
  if (!decoded) {
    // Ad TANINDI ama gövde alan alan çözülmüyor (kapsam kararı) — header'ı
    // yine de çözeriz, gerisini ham bırakırız.
    if (serviceName.endsWith('Request')) decodeRequestHeader(state);
    else if (serviceName.endsWith('Response')) decodeResponseHeader(state);
    pushWarningOnce(state.warnings, WARN_SERVICE_BODY_NOT_DECODED, state.cursor.offset);
    pushRemainingBody(state, bodyEnd, 'service-body', 'Service Body (not decoded)', [
      WARN_SERVICE_BODY_NOT_DECODED,
    ]);
    return;
  }

  if (state.cursor.offset < bodyEnd) {
    pushRemainingBody(state, bodyEnd, 'service-body-remainder', 'Service Body (remainder)', []);
  }
}

function pushRemainingBody(
  state: DecodeState,
  bodyEnd: number,
  id: string,
  name: string,
  warnings: string[],
): void {
  const offset = state.cursor.offset;
  const length = Math.max(0, bodyEnd - offset);
  if (length === 0) return;
  addField(state, {
    id,
    name,
    offset,
    length,
    rawValue: formatHexBytes(state.cursor.data.subarray(offset, offset + length), 12),
    physicalValue: length,
    unit: 'B',
    warnings,
  });
  state.cursor.offset = offset + length;
}

// ── UASC gövdesi ───────────────────────────────────────────────────────────

/**
 * `auto` modun sezgisi: SequenceHeader'dan sonraki NodeId TANINAN bir servise
 * çözülüyorsa gövde açıktır. WS `opcua.c`in `UA_MessageMode_MaybeEncrypted`
 * dalında yaptığı hesabın AYNISI (`getServiceNodeId(tvb, offset + 8)`).
 */
function resolveBodySecurity(
  options: OpcUaParseOptions,
  data: Uint8Array,
  securityHeaderEnd: number,
  chunkType: string,
  securityPolicyUri: string | null,
): 'plaintext' | 'encrypted' {
  if (options.bodySecurity !== 'auto') return options.bodySecurity;
  // Baytların İÇİNDEKİ kesin bilgi sezgiyi ezer.
  if (securityPolicyUri !== null && securityPolicyUri.endsWith(SECURITY_POLICY_NONE_SUFFIX)) {
    return 'plaintext';
  }
  // Ara parça ve abort gövdesinde servis NodeId'si YOKTUR; sezgi çalışmaz,
  // bu yüzden "açık" varsayılır ve gövde ham/abort olarak ele alınır.
  if (chunkType !== CHUNK_FINAL) return 'plaintext';
  return peekServiceId(data, securityHeaderEnd + SEQUENCE_HEADER_LENGTH) === undefined
    ? 'encrypted'
    : 'plaintext';
}

function decodeAbortBody(state: DecodeState): void {
  // P6 Tablo 57: ChunkType 'A' gövdesi normal servis gövdesi DEĞİL; Error
  // (StatusCode) + Reason (String) taşır — WS `parseAbort` ile birebir aynı.
  readAndPushStatusCode(state, 'abort-status', 'Abort.Error');
  readAndPushString(state, 'abort-reason', 'Abort.Reason');
}

interface SecureFrameLayout {
  securityHeaderEnd: number;
  securityPolicyUri: string | null;
}

function decodeAsymmetricSecurityHeader(state: DecodeState): SecureFrameLayout {
  readAndPushUInt32(state, 'secure-channel-id', 'SecureChannelId');
  const securityPolicyUri = readAndPushString(state, 'security-policy-uri', 'SecurityPolicyUri');
  readAndPushByteString(state, 'sender-certificate', 'SenderCertificate', [WARN_CERTIFICATE_NOT_VALIDATED]);
  readAndPushByteString(state, 'receiver-certificate-thumbprint', 'ReceiverCertificateThumbprint');
  return { securityHeaderEnd: state.cursor.offset, securityPolicyUri };
}

function decodeSymmetricSecurityHeader(state: DecodeState): SecureFrameLayout {
  readAndPushUInt32(state, 'secure-channel-id', 'SecureChannelId');
  readAndPushUInt32(state, 'token-id', 'TokenId');
  return { securityHeaderEnd: state.cursor.offset, securityPolicyUri: null };
}

function decodeSequenceHeader(state: DecodeState): void {
  readAndPushUInt32(state, 'sequence-number', 'SequenceNumber');
  readAndPushUInt32(state, 'request-id', 'RequestId');
}

function pushEncryptedPayload(state: DecodeState, frameEnd: number): void {
  const offset = state.cursor.offset;
  const length = Math.max(0, frameEnd - offset);
  if (length === 0) return;
  addField(state, {
    id: 'encrypted-payload',
    name: 'Encrypted Payload (SequenceHeader + Body + Padding + Signature)',
    offset,
    length,
    rawValue: formatHexBytes(state.cursor.data.subarray(offset, offset + length), 12),
    physicalValue: length,
    unit: 'B',
    valid: false,
    warnings: [WARN_ENCRYPTED_PAYLOAD],
  });
  state.cursor.offset = offset + length;
  pushWarningOnce(state.warnings, WARN_ENCRYPTED_PAYLOAD, offset);
}

/**
 * İmza gövdenin SONUNDADIR (WS `opcua.c`in şeması). Gövde sınırını önce
 * daraltırız; alan en sonda basılır ki tablo tel sırasını izlesin.
 */
function resolveBodyEnd(state: DecodeState, frameEnd: number, signatureLength: number): number {
  if (signatureLength <= 0) return frameEnd;
  const candidate = frameEnd - signatureLength;
  // İmza gövdeden büyük olamaz; olursa kullanıcı yanlış uzunluk vermiştir ve
  // sessizce gövdeyi yutmasındansa yok sayılır.
  return candidate <= state.cursor.offset ? frameEnd : candidate;
}

function pushSignature(state: DecodeState, frameEnd: number, bodyEnd: number): void {
  if (bodyEnd >= frameEnd) return;
  addField(state, {
    id: 'signature',
    name: 'Signature',
    offset: bodyEnd,
    length: frameEnd - bodyEnd,
    rawValue: formatHexBytes(state.cursor.data.subarray(bodyEnd, frameEnd), 12),
    physicalValue: frameEnd - bodyEnd,
    unit: 'B',
    // İmza ÇÖZÜLMEZ, DOĞRULANMAZ — yalnız gövdeden ayrılır (kripto sınırı).
    valid: false,
    warnings: [WARN_SIGNATURE_NOT_VERIFIED],
  });
  pushWarningOnce(state.warnings, WARN_SIGNATURE_NOT_VERIFIED, bodyEnd);
}

// ── Ana çözümleme ──────────────────────────────────────────────────────────

export function parseOpcUa(data: Uint8Array, context?: ParseContext): ParseResult {
  return parseOpcUaFrame(data, resolveParseOptions(context));
}

function parseOpcUaFrame(data: Uint8Array, options: OpcUaParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const messageType = detectMessageType(data);
  if (messageType === undefined) {
    return {
      success: false,
      error: {
        code: 'start-delimiter-not-found',
        message: ERROR_UNKNOWN_MESSAGE_TYPE,
        offset: 0,
        length: Math.min(3, data.length),
        details: { messageType: readAscii(data, 0, Math.min(3, data.length)) },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (data.length < MESSAGE_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const headerCursor = createCursor(data, 4);
  const messageSize = readUInt32(headerCursor);

  if (messageSize < MESSAGE_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'length-mismatch',
        message: ERROR_MESSAGE_SIZE_TOO_SMALL,
        offset: 4,
        length: 4,
        details: { messageSize },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (options.maxFrameLength !== undefined && messageSize > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: 4,
        length: 4,
        details: { messageSize, maxFrameLength: options.maxFrameLength },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  // MessageSize BAŞLIĞIN KENDİSİNİ de sayar (P6 Tablo 73) — tamponu bununla
  // kısıtlıyoruz ki fazladan bayt gövdeye karışmasın.
  const frameEnd = Math.min(messageSize, data.length);
  const view = data.subarray(0, frameEnd);
  const state: DecodeState = { cursor: createCursor(view, 0), fields: [], warnings: [], errors: [] };

  const chunkType = readAscii(data, 3, 1);
  const chunkName = CHUNK_TYPE_NAMES.get(chunkType);

  addField(state, {
    id: 'message-type',
    name: 'MessageType',
    offset: 0,
    length: 3,
    rawValue: messageType,
    physicalValue: MESSAGE_TYPE_NAMES.get(messageType) ?? messageType,
  });
  addField(state, {
    id: 'chunk-type',
    name: 'IsFinal (ChunkType)',
    offset: 3,
    length: 1,
    rawValue: chunkType,
    // Tanınmayan chunk baytı ADLANDIRILMAZ — ama sessiz de bırakılmaz
    // (iec101'in tanınmayan fonksiyon kodu emsali: ham göster + uyar).
    ...(chunkName === undefined ? {} : { physicalValue: chunkName }),
    valid: chunkName !== undefined,
    warnings:
      chunkName === undefined
        ? [WARN_UNKNOWN_CHUNK_TYPE]
        : chunkType === CHUNK_FINAL
          ? []
          : [WARN_CHUNK_TYPE_NOT_FINAL],
  });
  addField(state, {
    id: 'message-size',
    name: 'MessageSize',
    offset: 4,
    length: 4,
    rawValue: messageSize,
    physicalValue: messageSize,
    unit: 'B',
    valid: messageSize <= data.length,
    warnings: messageSize > data.length ? [WARN_MESSAGE_SIZE_EXCEEDS_BUFFER] : [],
  });
  state.cursor.offset = MESSAGE_HEADER_LENGTH;

  if (messageSize > data.length) {
    pushWarningOnce(state.warnings, WARN_MESSAGE_SIZE_EXCEEDS_BUFFER, 4);
  } else if (messageSize < data.length) {
    pushWarningOnce(state.warnings, WARN_TRAILING_BYTES, messageSize);
  }
  if (chunkName === undefined) {
    pushWarningOnce(state.warnings, WARN_UNKNOWN_CHUNK_TYPE, 3);
  } else if (chunkType !== CHUNK_FINAL) {
    pushWarningOnce(state.warnings, WARN_CHUNK_TYPE_NOT_FINAL, 3);
  }

  let serviceName: string | null = null;
  let summaryKey = SUMMARY_CONNECTION;

  try {
    switch (messageType) {
      case MESSAGE_TYPE_HELLO:
        decodeHello(state);
        break;
      case MESSAGE_TYPE_ACKNOWLEDGE:
        decodeAcknowledge(state);
        break;
      case MESSAGE_TYPE_ERROR:
        decodeError(state);
        break;
      case MESSAGE_TYPE_REVERSE_HELLO:
        decodeReverseHello(state);
        break;
      default: {
        // OPN asimetrik, MSG/CLO simetrik güvenlik başlığı taşır (P6 §6.7.2.3).
        const layout =
          messageType === MESSAGE_TYPE_OPEN
            ? decodeAsymmetricSecurityHeader(state)
            : decodeSymmetricSecurityHeader(state);
        if (messageType === MESSAGE_TYPE_OPEN) {
          pushWarningOnce(state.warnings, WARN_CERTIFICATE_NOT_VALIDATED, layout.securityHeaderEnd);
        }

        const security = resolveBodySecurity(
          options,
          view,
          layout.securityHeaderEnd,
          chunkType,
          layout.securityPolicyUri,
        );
        summaryKey = security === 'encrypted' ? SUMMARY_ENCRYPTED : SUMMARY_SECURE_CONVERSATION;

        if (security === 'encrypted') {
          pushEncryptedPayload(state, frameEnd);
          break;
        }

        decodeSequenceHeader(state);
        const bodyEnd = resolveBodyEnd(state, frameEnd, options.signatureLength);

        if (chunkType === CHUNK_ABORT) {
          decodeAbortBody(state);
        } else if (chunkType === CHUNK_INTERMEDIATE) {
          // Servis NodeId'si YALNIZ İLK parçadadır; ara parçanın gövdesi bir
          // kesittir, ona servis alanı basmak uydurmak olurdu.
          pushWarningOnce(state.warnings, WARN_INTERMEDIATE_CHUNK_BODY, state.cursor.offset);
          pushRemainingBody(state, bodyEnd, 'chunk-body', 'Chunk Body (message fragment)', [
            WARN_INTERMEDIATE_CHUNK_BODY,
          ]);
        } else {
          decodeServiceBody(state, bodyEnd);
          serviceName =
            state.fields.find((field) => field.id === 'service-type-id')?.physicalValue?.toString() ?? null;
        }
        pushSignature(state, frameEnd, bodyEnd);
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof OpcUaDecodeError)) throw error;
    // Kısmi çözüm KORUNUR (spec §47: hatalı veride uygulamayı çökertme).
    state.errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: error.offset,
      length: Math.max(0, frameEnd - error.offset),
      details: { failedAt: error.messageKey },
    });
    pushWarningOnce(state.warnings, WARN_BODY_DECODE_FAILED, error.offset);
  }

  const metadata: FrameMetadata = {
    messageType,
    chunkType,
    summaryKey,
    serviceName,
  };
  const rawFrame = buildRawFrame(view, options, metadata);
  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: state.fields,
    valid: state.errors.length === 0,
    errors: state.errors,
    warnings: state.warnings,
  };
  return { success: true, frame, consumedBytes: frameEnd };
}

export const opcUaParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız ilk üç bayt tanınan bir mesaj tipi mi. */
  canParse(data: Uint8Array): boolean {
    return detectMessageType(data) !== undefined;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseOpcUaFrame(data, resolveParseOptions(context));
  },
};

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_BODY_SECURITY,
    label: 'protocol.opcua.option.bodySecurity',
    kind: 'select',
    defaultValue: 'auto',
    description: 'protocol.opcua.option.bodySecurity.description',
    choices: [
      { value: 'auto', label: 'protocol.opcua.option.bodySecurity.auto' },
      { value: 'plaintext', label: 'protocol.opcua.option.bodySecurity.plaintext' },
      { value: 'encrypted', label: 'protocol.opcua.option.bodySecurity.encrypted' },
    ],
  },
  {
    id: OPTION_SIGNATURE_LENGTH,
    label: 'protocol.opcua.option.signatureLength',
    kind: 'number',
    defaultValue: DEFAULT_SIGNATURE_LENGTH,
    min: 0,
    max: MAX_SIGNATURE_LENGTH,
    description: 'protocol.opcua.option.signatureLength.description',
  },
];

// ── Örnek üreticileri ──────────────────────────────────────────────────────
//
// Elle bayt saymak yerine küçük bir kurucu kullanılıyor: örneklerin uzunluk
// alanları (MessageSize, String uzunlukları) TÜRETİLİR, yazılmaz — yanlış
// uzunluk yazma riski tümüyle ortadan kalkar.

class ByteBuilder {
  private readonly parts: number[] = [];

  byte(value: number): this {
    this.parts.push(value & 0xff);
    return this;
  }

  uint16(value: number): this {
    return this.byte(value).byte(value >>> 8);
  }

  uint32(value: number): this {
    return this.byte(value).byte(value >>> 8).byte(value >>> 16).byte(value >>> 24);
  }

  int64(value: bigint): this {
    let remaining = BigInt.asUintN(64, value);
    for (let index = 0; index < 8; index++) {
      this.byte(Number(remaining & 0xffn));
      remaining >>= 8n;
    }
    return this;
  }

  double(value: number): this {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    for (const b of new Uint8Array(buffer)) this.byte(b);
    return this;
  }

  ascii(text: string): this {
    this.uint32(text.length);
    for (let index = 0; index < text.length; index++) this.byte(text.charCodeAt(index));
    return this;
  }

  /** `-1` uzunluk = null String/ByteString (uzunluk 0'dan FARKLI). */
  nullValue(): this {
    return this.uint32(0xffffffff);
  }

  byteString(values: readonly number[]): this {
    this.uint32(values.length);
    for (const value of values) this.byte(value);
    return this;
  }

  raw(values: readonly number[]): this {
    for (const value of values) this.byte(value);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.parts);
  }
}

/** `<msgType><chunk><size><body>` — size TÜRETİLİR. */
function withHeader(messageType: string, chunkType: string, body: Uint8Array): Uint8Array {
  const total = MESSAGE_HEADER_LENGTH + body.length;
  const builder = new ByteBuilder();
  for (let index = 0; index < 3; index++) builder.byte(messageType.charCodeAt(index));
  builder.byte(chunkType.charCodeAt(0));
  builder.uint32(total);
  builder.raw(Array.from(body));
  return builder.toBytes();
}

/** FourByte NodeId (encoding 0x01, ns=0) — servis id'leri hep bu biçimde gelir. */
function serviceTypeId(builder: ByteBuilder, serviceId: number): ByteBuilder {
  return builder.byte(0x01).byte(0x00).uint16(serviceId);
}

/**
 * Örneklerde kullanılan sabit zaman damgası: 2024-01-01T00:00:00Z.
 * Türetimi: 1704067200000 ms × 10 000 tick/ms + TICKS_1601_TO_1970
 * (116 444 736 000 000 000) = 133 485 408 000 000 000.
 */
const EXAMPLE_TIMESTAMP_TICKS = 133485408000000000n;

function requestHeader(builder: ByteBuilder, requestHandle: number, timeoutHint: number): ByteBuilder {
  return builder
    .byte(0x00) // AuthenticationToken: TwoByte NodeId, i=0
    .byte(0x00)
    .int64(EXAMPLE_TIMESTAMP_TICKS)
    .uint32(requestHandle)
    .uint32(0) // ReturnDiagnostics
    .nullValue() // AuditEntryId (null String)
    .uint32(timeoutHint)
    .byte(0x00) // AdditionalHeader: TwoByte NodeId i=0
    .byte(0x00)
    .byte(0x00); // ExtensionObject encoding = gövde yok
}

function responseHeader(builder: ByteBuilder, requestHandle: number, serviceResult: number): ByteBuilder {
  return builder
    .int64(EXAMPLE_TIMESTAMP_TICKS)
    .uint32(requestHandle)
    .uint32(serviceResult)
    .byte(0x00) // ServiceDiagnostics: boş maske
    .nullValue() // StringTable: null dizi
    .byte(0x00) // AdditionalHeader
    .byte(0x00)
    .byte(0x00);
}

function buildOpenSecureChannelRequestNone(): Uint8Array {
  const body = new ByteBuilder()
    .uint32(0) // SecureChannelId (henüz atanmadı)
    .ascii('http://opcfoundation.org/UA/SecurityPolicy#None')
    .nullValue() // SenderCertificate (None politikasında yok)
    .nullValue() // ReceiverCertificateThumbprint
    .uint32(1) // SequenceNumber
    .uint32(1); // RequestId
  serviceTypeId(body, SERVICE_OPEN_SECURE_CHANNEL_REQUEST);
  requestHeader(body, 1, 10000)
    .uint32(0) // ClientProtocolVersion
    .uint32(0) // RequestType = Issue
    .uint32(1) // SecurityMode = None
    .nullValue() // ClientNonce
    .uint32(3600000); // RequestedLifetime
  return withHeader(MESSAGE_TYPE_OPEN, CHUNK_FINAL, body.toBytes());
}

function buildReadRequest(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(51).uint32(7);
  serviceTypeId(body, SERVICE_READ_REQUEST);
  requestHeader(body, 51, 5000)
    .double(0) // MaxAge
    .uint32(2) // TimestampsToReturn = Both
    .uint32(1) // NodesToRead sayısı
    // ReadValueId: String NodeId ns=2 s="Machine1.Temperature", AttributeId=13 (Value)
    .byte(0x03)
    .uint16(2)
    .ascii('Machine1.Temperature')
    .uint32(13)
    .nullValue() // IndexRange
    .uint16(0) // DataEncoding.NamespaceIndex
    .nullValue(); // DataEncoding.Name
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

function buildReadResponse(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(52).uint32(7);
  serviceTypeId(body, SERVICE_READ_RESPONSE);
  responseHeader(body, 51, 0)
    .uint32(1) // Results sayısı
    // DataValue: mask 0x07 = Value + Status + SourceTimestamp (0x01|0x02|0x04)
    .byte(0x07)
    .byte(11) // Variant: skaler Double
    .double(25.73)
    .uint32(0) // StatusCode = Good
    .int64(EXAMPLE_TIMESTAMP_TICKS)
    .nullValue(); // DiagnosticInfos: null dizi
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

function buildCreateSubscriptionRequest(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(70).uint32(9);
  serviceTypeId(body, SERVICE_CREATE_SUBSCRIPTION_REQUEST);
  requestHeader(body, 70, 5000)
    .double(100) // RequestedPublishingInterval = 100 ms
    .uint32(1200) // RequestedLifetimeCount
    .uint32(10) // RequestedMaxKeepAliveCount
    .uint32(0) // MaxNotificationsPerPublish
    .byte(0x01) // PublishingEnabled = true
    .byte(0); // Priority
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

function buildBrowseRequest(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(80).uint32(11);
  serviceTypeId(body, SERVICE_BROWSE_REQUEST);
  requestHeader(body, 80, 5000)
    .byte(0x00) // View.ViewId: TwoByte i=0
    .byte(0x00)
    .int64(0n) // View.Timestamp = belirtilmemiş
    .uint32(0) // View.ViewVersion
    .uint32(0) // RequestedMaxReferencesPerNode
    .uint32(1) // NodesToBrowse sayısı
    .byte(0x01) // BrowseDescription.NodeId: FourByte ns=0 i=85 (ObjectsFolder)
    .byte(0x00)
    .uint16(85)
    .uint32(0) // BrowseDirection = Forward
    .byte(0x01) // ReferenceTypeId: FourByte ns=0 i=33 (HierarchicalReferences)
    .byte(0x00)
    .uint16(33)
    .byte(0x01) // IncludeSubtypes = true
    .uint32(0) // NodeClassMask
    .uint32(63); // ResultMask = All
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

function buildAbortChunk(): Uint8Array {
  const body = new ByteBuilder()
    .uint32(1) // SecureChannelId
    .uint32(2) // TokenId
    .uint32(99) // SequenceNumber
    .uint32(7) // RequestId
    .uint32(0x80b90000) // BadResponseTooLarge
    .ascii('Response too large');
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_ABORT, body.toBytes());
}

function buildEncryptedMessage(): Uint8Array {
  // Güvenlik başlığından SONRASI YER TUTUCUdur — GERÇEK AES çıktısı DEĞİL.
  // Amaç, `auto` sezgisinin "servis id'si çözülmüyor → şifreli" dalını ve
  // kripto sınırının ekranda nasıl göründüğünü göstermek.
  const body = new ByteBuilder()
    .uint32(1)
    .uint32(2)
    .raw([
      0x7b, 0x1c, 0x9e, 0x44, 0xa2, 0x05, 0xd1, 0x63, 0x8f, 0x2a, 0x40, 0xbb, 0x11, 0x77, 0xe9, 0x30,
      0x5c, 0xd8, 0x6a, 0x93, 0x0e, 0xf5, 0x21, 0xac,
    ]);
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

function buildWriteRequest(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(60).uint32(8);
  serviceTypeId(body, SERVICE_WRITE_REQUEST);
  requestHeader(body, 60, 5000)
    .uint32(1) // NodesToWrite sayısı
    .byte(0x03) // WriteValue.NodeId: String NodeId
    .uint16(2)
    .ascii('Machine1.Setpoint')
    .uint32(13) // AttributeId = Value
    .nullValue() // IndexRange
    .byte(0x01) // DataValue maskesi: yalnız Value
    .byte(11) // Variant: skaler Double
    .double(42.5);
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

/**
 * Kapsam kararının ekrandaki karşılığı: servis ADI tanınır (CreateSessionRequest,
 * id 461), RequestHeader ÇÖZÜLÜR, gövde HAM kalır. Gövde baytları YER TUTUCUdur.
 */
function buildCreateSessionRequestStub(): Uint8Array {
  const body = new ByteBuilder().uint32(1).uint32(2).uint32(90).uint32(12);
  serviceTypeId(body, 461);
  requestHeader(body, 90, 10000).raw([0x00, 0x00, 0x00, 0x00, 0x10, 0x20, 0x30, 0x40]);
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_FINAL, body.toBytes());
}

/**
 * ChunkType 'C': servis NodeId'si YALNIZ ilk parçadadır, bu yüzden gövde
 * kesit olarak ham bırakılır (tuzak 5/6'nın ekrandaki karşılığı).
 */
function buildIntermediateChunk(): Uint8Array {
  const body = new ByteBuilder()
    .uint32(1)
    .uint32(2)
    .uint32(41)
    .uint32(9)
    .raw([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
  return withHeader(MESSAGE_TYPE_MESSAGE, CHUNK_INTERMEDIATE, body.toBytes());
}

function buildHello(): Uint8Array {
  const body = new ByteBuilder()
    .uint32(0) // ProtocolVersion
    .uint32(65536) // ReceiveBufferSize
    .uint32(65536) // SendBufferSize
    .uint32(16777216) // MaxMessageSize
    .uint32(5) // MaxChunkCount
    .ascii('opc.tcp://localhost:4840');
  return withHeader(MESSAGE_TYPE_HELLO, CHUNK_FINAL, body.toBytes());
}

function buildAcknowledge(): Uint8Array {
  const body = new ByteBuilder().uint32(0).uint32(65536).uint32(65536).uint32(16777216).uint32(5);
  return withHeader(MESSAGE_TYPE_ACKNOWLEDGE, CHUNK_FINAL, body.toBytes());
}

function buildErrorMessage(): Uint8Array {
  // 0x80830000 = BadTcpEndpointUrlInvalid (`StatusCode.csv`).
  const body = new ByteBuilder().uint32(0x80830000).ascii('Endpoint URL invalid');
  return withHeader(MESSAGE_TYPE_ERROR, CHUNK_FINAL, body.toBytes());
}

function buildReverseHello(): Uint8Array {
  const body = new ByteBuilder().ascii('urn:demo:server').ascii('opc.tcp://localhost:4840');
  return withHeader(MESSAGE_TYPE_REVERSE_HELLO, CHUNK_FINAL, body.toBytes());
}

function buildNullVersusEmptyString(): Uint8Array {
  // Tuzak 3'ün ekrandaki karşılığı: ServerUri BOŞ (uzunluk 0), EndpointUrl
  // NULL (uzunluk -1). İkisi AYNI ŞEY DEĞİL ve ayrı basılmalı.
  const body = new ByteBuilder().ascii('').nullValue();
  return withHeader(MESSAGE_TYPE_REVERSE_HELLO, CHUNK_FINAL, body.toBytes());
}

function buildTruncatedHello(): Uint8Array {
  // MessageSize 32 diyor ama tampon 20 baytta bitiyor: EndpointUrl uzunluğu
  // okunamadan gövde kesiliyor.
  const builder = new ByteBuilder();
  for (const character of MESSAGE_TYPE_HELLO) builder.byte(character.charCodeAt(0));
  builder.byte(CHUNK_FINAL.charCodeAt(0)).uint32(32).uint32(0).uint32(65536).uint32(65536);
  return builder.toBytes();
}

/**
 * Örnek çerçeveler. HEPSİ P6'nın alan tablolarına göre KURUCUYLA üretilmiştir
 * — gerçek bir yakalamadan alınmış DEĞİLDİR. Uzunluk alanları (MessageSize,
 * String uzunlukları) elle yazılmaz, kurucudan TÜRETİLİR.
 *
 * Sertifika/nonce/şifreli gövde alanları GERÇEK X.509, rastgele ya da AES
 * değeri taşımaz; YER TUTUCUdur (13a'nın "YER TUTUCU şifreli blok, GERÇEK AES
 * çıktısı DEĞİL" notuyla aynı dürüstlük). Alan YERLEŞİMİ spec'ten birebirdir
 * ve birim testler bayt bayt doğrular.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'hello',
    name: 'protocol.opcua.example.hello.name',
    bytes: buildHello(),
    description: 'protocol.opcua.example.hello.description',
    expectedValid: true,
  },
  {
    id: 'acknowledge',
    name: 'protocol.opcua.example.acknowledge.name',
    bytes: buildAcknowledge(),
    description: 'protocol.opcua.example.acknowledge.description',
    expectedValid: true,
  },
  {
    id: 'error-endpoint-url-invalid',
    name: 'protocol.opcua.example.errorEndpointUrlInvalid.name',
    bytes: buildErrorMessage(),
    description: 'protocol.opcua.example.errorEndpointUrlInvalid.description',
    expectedValid: true,
  },
  {
    id: 'reverse-hello',
    name: 'protocol.opcua.example.reverseHello.name',
    bytes: buildReverseHello(),
    description: 'protocol.opcua.example.reverseHello.description',
    expectedValid: true,
  },
  {
    id: 'null-versus-empty-string',
    name: 'protocol.opcua.example.nullVersusEmptyString.name',
    bytes: buildNullVersusEmptyString(),
    description: 'protocol.opcua.example.nullVersusEmptyString.description',
    expectedValid: true,
  },
  {
    id: 'open-secure-channel-request-none',
    name: 'protocol.opcua.example.openSecureChannelRequestNone.name',
    bytes: buildOpenSecureChannelRequestNone(),
    description: 'protocol.opcua.example.openSecureChannelRequestNone.description',
    expectedValid: true,
  },
  {
    id: 'read-request',
    name: 'protocol.opcua.example.readRequest.name',
    bytes: buildReadRequest(),
    description: 'protocol.opcua.example.readRequest.description',
    expectedValid: true,
  },
  {
    id: 'read-response',
    name: 'protocol.opcua.example.readResponse.name',
    bytes: buildReadResponse(),
    description: 'protocol.opcua.example.readResponse.description',
    expectedValid: true,
  },
  {
    id: 'write-request',
    name: 'protocol.opcua.example.writeRequest.name',
    bytes: buildWriteRequest(),
    description: 'protocol.opcua.example.writeRequest.description',
    expectedValid: true,
  },
  {
    id: 'browse-request',
    name: 'protocol.opcua.example.browseRequest.name',
    bytes: buildBrowseRequest(),
    description: 'protocol.opcua.example.browseRequest.description',
    expectedValid: true,
  },
  {
    id: 'create-subscription-request',
    name: 'protocol.opcua.example.createSubscriptionRequest.name',
    bytes: buildCreateSubscriptionRequest(),
    description: 'protocol.opcua.example.createSubscriptionRequest.description',
    expectedValid: true,
  },
  {
    id: 'create-session-request-body-raw',
    name: 'protocol.opcua.example.createSessionRequestBodyRaw.name',
    bytes: buildCreateSessionRequestStub(),
    description: 'protocol.opcua.example.createSessionRequestBodyRaw.description',
    expectedValid: true,
  },
  {
    id: 'message-abort-chunk',
    name: 'protocol.opcua.example.messageAbortChunk.name',
    bytes: buildAbortChunk(),
    description: 'protocol.opcua.example.messageAbortChunk.description',
    expectedValid: true,
  },
  {
    id: 'message-intermediate-chunk',
    name: 'protocol.opcua.example.messageIntermediateChunk.name',
    bytes: buildIntermediateChunk(),
    description: 'protocol.opcua.example.messageIntermediateChunk.description',
    expectedValid: true,
  },
  {
    id: 'message-encrypted-body',
    name: 'protocol.opcua.example.messageEncryptedBody.name',
    bytes: buildEncryptedMessage(),
    description: 'protocol.opcua.example.messageEncryptedBody.description',
    expectedValid: true,
  },
  {
    id: 'unknown-message-type',
    name: 'protocol.opcua.example.unknownMessageType.name',
    bytes: Uint8Array.from([0x58, 0x59, 0x5a, 0x46, 0x08, 0x00, 0x00, 0x00]),
    description: 'protocol.opcua.example.unknownMessageType.description',
    expectedValid: false,
  },
  {
    id: 'truncated-body',
    name: 'protocol.opcua.example.truncatedBody.name',
    bytes: buildTruncatedHello(),
    description: 'protocol.opcua.example.truncatedBody.description',
    expectedValid: false,
  },
];

export const opcUaPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: opcUaParser,
  documentation: {
    summary: 'protocol.opcua.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'OPC 10000-6 (Part 6: Mappings) v1.05 — §5.2 OPC UA Binary, §6.7 Secure Conversation, §7.1 Connection Protocol',
        url: 'https://reference.opcfoundation.org/Core/Part6/v105/docs/7.1.2',
      },
      {
        title: 'OPC Foundation UA-Nodeset Schema — NodeIds.csv / StatusCode.csv / AttributeIds.csv / Opc.Ua.Types.bsd (MIT)',
        url: 'https://github.com/OPCFoundation/UA-Nodeset/tree/latest/Schema',
      },
      {
        title: 'Wireshark OPC UA dissector (plugins/epan/opcua) — transport layer and simple type parsers',
        url: 'https://github.com/wireshark/wireshark/tree/master/plugins/epan/opcua',
      },
      {
        title: 'open62541 ua_types_encoding_binary.c — independent open-source binary encoder/decoder',
        url: 'https://github.com/open62541/open62541/blob/master/src/ua_types_encoding_binary.c',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
