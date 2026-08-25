/**
 * SOME/IP — AUTOSAR Foundation "SOME/IP Protocol Specification" (Doc ID 696).
 *
 * Faz 10, dalga 14d (`docs/brief-faz10-dalga14d.md`). `automotive-ethernet`
 * ailesinin ikinci ve son kaydı.
 *
 * ── GİRDİ SÖZLEŞMESİ ─────────────────────────────────────────────────────────
 * Girdi TEK BİR SOME/IP MESAJIDIR (16 baytlık başlık + payload), MAC/IP/UDP/TCP
 * çerçevesinin tamamı DEĞİL — `ipv4.ts:1-11`in "üst katmanı çözmeyip adlandır,
 * şu sayfada çöz uyarısı bas" deseninin aynası. MAC/IP/UDP/TCP kayıtlarının
 * hepsi zaten `ready` ve kendi sayfalarında çözülüyor; motorlar zincir KURMAZ
 * (12f WebSocket, 14c XCP-on-Ethernet kararı).
 *
 * TCP'de birden çok SOME/IP mesajı aynı segmentte YAPIŞABİLİR. `Length` mesaj
 * sınırını verdiği için `consumedBytes` DOĞRU doldurulur (`types.ts:148`:
 * "stream parser bunu kullanarak buffer'ı ilerletir") — ama bu motor segment
 * BİRLEŞTİRMEZ: eksik veride `consumedBytes: 0` + `recoverable: true` döner,
 * artan baytlar için `trailingBytes` uyarısı basılır (12h FTP/Telnet çizgisi).
 *
 * ── `Length` NEREDEN SAYAR — ÜÇ KAYNAKLA DOĞRULANDI (2026-08-25) ────────────
 * Bu dalganın en olası SESSİZ hatası (12f MQTT-SN vakası: aynı sayıyı aynı
 * yerde farklı tabandan okumak mesaj başına bayt kaydırır). Üç bağımsız kaynak
 * AYNI tabanı veriyor:
 *
 *   1. AUTOSAR FO R23-11, PRS_SOMEIP_00042 (§4.1.2.3, Doc ID 696):
 *      "Length field shall contain the length in Byte starting from Request
 *      ID/Client ID until the end of the SOME/IP message."
 *   2. Wireshark `epan/dissectors/packet-someip.c` (GPL-2.0-or-later):
 *      `#define SOMEIP_HDR_PART1_LEN 8`, `get_someip_message_len()` →
 *      `return SOMEIP_HDR_PART1_LEN + tvb_get_ntohl(tvb, offset + 4);` ve
 *      `someip_payload_length = someip_length - SOMEIP_HDR_PART1_LEN;`
 *   3. Scapy `contrib/automotive/someip.py` (GPL-2.0-only):
 *      `LEN_OFFSET = 0x08`, `LenField("len", None, fmt=">I", adjust=x + 8)`.
 *
 * Yani: **Length KENDİ 4 baytını ve Message ID'yi SAYMAZ**; offset 8'den (Request
 * ID) mesajın sonuna kadar olan baytları sayar. Toplam mesaj = `8 + Length`.
 * Asgari geçerli değer 8'dir (payload'sız mesaj) — Wireshark `someip_length < 8`
 * durumunu açıkça hata sayar.
 *
 * ── ID BÖLÜNMELERİ VE BAYT SIRASI ───────────────────────────────────────────
 * PRS_SOMEIP_00755: Message ID = Service ID [16] | Method ID [16].
 * PRS_SOMEIP_00046: Request ID = Client ID [16] | Session ID [16].
 * PRS_SOMEIP_00031/00931: tüm başlık network byte order (BIG-ENDIAN).
 * Üç kaynak da örtüşüyor (Scapy `XShortField` network order, Wireshark
 * `ENC_BIG_ENDIAN`) — bu yüzden alanlar ADLANDIRILDI, ham bırakılmadı
 * (14c'deki XCP taşıma başlığı çelişkisinin AKSİNE).
 *
 * Method ID'nin 0x0000-0x7FFF (metot) / 0x8000-0xFFFF (olay) bölünmesi ise
 * PRS_SOMEIP_00245 NOTUdur: "It is common practise and recommended" — NORMATİF
 * DEĞİL. Bu yüzden `method-id-class` ayrı bir TÜRETİLMİŞ alandır ve tavsiye
 * olduğunu söyleyen kendi uyarısını taşır; `method-id`in kendisi ham sayıdır.
 *
 * ── PAYLOAD HAM KALIR, decodeOptions AÇILMAZ ────────────────────────────────
 * SOME/IP payload'ının yapısı TELDEN ÇIKMAZ, servis arayüzü tanımından
 * (ARXML / servis tanımı) gelir. 12g'nin RTP kararının birebir aynısı:
 * "kanal kullanıcıdan sorup tabloya yazmak aynı tahmini dolaylı yoldan yapmak
 * olurdu" — payload HAM gösterilir + `payloadNeedsServiceDefinition` uyarısı
 * basılır, sahte alan kırılımı UYDURULMAZ (dalga 13 dersi 4).
 * `DEFINITION_FORMATS`a ARXML EKLENMEDİ (spec `:516` yalnız DBC/LDF/A2L/EDS).
 *
 * **`decodeOptions` BİLEREK AÇILMADI** — bu bir eksiklik değil, karardır
 * (12f WebSocket emsali). Üç eksenin üçü de kanalsız çözülüyor:
 *   • SD ayrımı ÇERÇEVEDEN çıkar (Message ID = 0xFFFF8100, aşağı bak),
 *   • yön/rol ÇERÇEVEDEN çıkar (Message Type → `message-kind`),
 *   • payload yapısı kanal AÇMAKLA ÇÖZÜLMEZ (yukarıdaki RTP gerekçesi).
 * Kanal açmak, çözülmeyen tek eksende (payload) kullanıcıyı tahmin etmeye
 * zorlamak olurdu.
 *
 * ── SESSION KORELASYONU VE SERVICE BROWSER — ANALYZER İŞİ ───────────────────
 * Spec `:341` request-response korelasyonu, `:345` servis ağacı istiyor.
 * İkisi de TEK ÇERÇEVE çözümünün işi değildir; emsal iki kez kurulu ve ikisinde
 * de kayıt `ready` kapandı (12c DNS Transaction Matching, 12d PTP δ/θ). Burada
 * korelasyonun HAMMADDESİ `RawFrame.metadata`ya yazılır (`clientId`,
 * `sessionId`, `serviceId`, `methodId`) ki ileriki analyzer işi onu bulsun.
 * Ağaç görünümü YOK: `ParsedFrame` DÜZ, `children` yok (CLAUDE.md kilitli
 * kararı) — SD girdileri 12g RTCP emsaliyle alan ADLARINA taşınır
 * (`SD Entry 1 Service ID`, bkz. `someipSd.ts`).
 */

import { decodeSomeIpSdPayload, SOMEIP_SD_MESSAGE_ID } from './someipSd';
import { createRawFrame } from '@/protocol-core/types';
import type {
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

const PROTOCOL_ID = 'some-ip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SOME/IP';

/** Sabit başlık: Message ID(4) + Length(4) + Request ID(4) + 4×1 bayt. */
const HEADER_LENGTH = 16;
/**
 * `Length`in SAYMADIĞI önek: Message ID(4) + Length'in kendisi(4).
 * Toplam mesaj = `LENGTH_COVERAGE_BASE + Length` (dosya başı, üç kaynak).
 */
const LENGTH_COVERAGE_BASE = 8;
/** `Length`in alabileceği en küçük değer: payload'sız mesajın kalan 8 baytı. */
const MIN_DECLARED_LENGTH = 8;
/** SOME/IP-TP segmentlerinde başlıktan sonra gelen ek 4 bayt. */
const TP_HEADER_LENGTH = 4;
/** TP segmentinde `Length`in alabileceği en küçük değer: 8 + TP başlığı. */
const MIN_DECLARED_LENGTH_TP = MIN_DECLARED_LENGTH + TP_HEADER_LENGTH;

const OFFSET_SERVICE_ID = 0;
const OFFSET_METHOD_ID = 2;
const OFFSET_LENGTH = 4;
const OFFSET_CLIENT_ID = 8;
const OFFSET_SESSION_ID = 10;
const OFFSET_PROTOCOL_VERSION = 12;
const OFFSET_INTERFACE_VERSION = 13;
const OFFSET_MESSAGE_TYPE = 14;
const OFFSET_RETURN_CODE = 15;

/** PRS_SOMEIP_00051: "The Protocol Version shall be 1." */
const EXPECTED_PROTOCOL_VERSION = 0x01;

/**
 * PRS_SOMEIP_00367: Message Type'ın 3. en yüksek biti (0x20) TP-Flag'dir.
 * Wireshark `SOMEIP_MSGTYPE_TP_MASK 0x20` ile birebir aynı.
 */
const MESSAGE_TYPE_TP_FLAG = 0x20;

/** Method ID'nin tavsiye edilen (NORMATİF OLMAYAN) olay eşiği. */
const METHOD_ID_EVENT_THRESHOLD = 0x8000;

/**
 * PRS_SOMEIP_00055, Tablo 4.4 (AUTOSAR FO R23-11). Wireshark'ın
 * `SOMEIP_MSGTYPE_*` define'ları ve Scapy'nin `ByteEnumField("msg_type", …)`
 * sözlüğü aynı on değeri veriyor.
 *
 * NOT: Scapy ve Wireshark ayrıca 0x40 ACK bitini tanır (`TYPE_REQUEST_ACK`,
 * `SOMEIP_MSGTYPE_ACK_MASK`), AMA AUTOSAR R23-11'in Tablo 4.4'ünde ACK
 * varyantları YOKTUR. İki kaynak örtüşmediği için ACK varyantları
 * ADLANDIRILMADI: tabloda olmayan her değer `unknownMessageType` uyarısıyla
 * ham kalır (brief `:52-54` kuralı).
 */
const MESSAGE_TYPE_NAMES = new Map<number, string>([
  [0x00, 'REQUEST'],
  [0x01, 'REQUEST_NO_RETURN'],
  [0x02, 'NOTIFICATION'],
  [0x80, 'RESPONSE'],
  [0x81, 'ERROR'],
  [0x20, 'TP_REQUEST'],
  [0x21, 'TP_REQUEST_NO_RETURN'],
  [0x22, 'TP_NOTIFICATION'],
  [0xa0, 'TP_RESPONSE'],
  [0xa1, 'TP_ERROR'],
]);

/**
 * Message Type'tan TÜRETİLEN mesaj sınıfı — TP bayrağı düşürülerek. 12f
 * WebSocket `direction` alanının (MASK bitinden türetilmişti) aynı sınıfı:
 * "Notification/Event ayrımı ÇERÇEVEDEN ÇIKAR", tahmin edilmez.
 */
const MESSAGE_KINDS = new Map<number, { label: string; summarySuffix: string }>([
  [0x00, { label: 'Request', summarySuffix: 'request' }],
  [0x01, { label: 'Fire & Forget Request', summarySuffix: 'requestNoReturn' }],
  [0x02, { label: 'Notification / Event', summarySuffix: 'notification' }],
  [0x80, { label: 'Response', summarySuffix: 'response' }],
  [0x81, { label: 'Error', summarySuffix: 'error' }],
]);

/**
 * PRS_SOMEIP_00191, Tablo 4.11 (AUTOSAR FO R23-11). 0x00-0x0a aralığı
 * Wireshark (`SOMEIP_RETCODE_*`) ve Scapy (`RET_E_*`) ile birebir örtüşüyor;
 * 0x0b-0x0f E2E kodları YALNIZ AUTOSAR'da var (iki açık kaynak kütüphane
 * onları tanımıyor) — spec birincil kaynak olduğu için adlandırıldılar.
 */
const RETURN_CODE_NAMES = new Map<number, string>([
  [0x00, 'E_OK'],
  [0x01, 'E_NOT_OK'],
  [0x02, 'E_UNKNOWN_SERVICE'],
  [0x03, 'E_UNKNOWN_METHOD'],
  [0x04, 'E_NOT_READY'],
  [0x05, 'E_NOT_REACHABLE'],
  [0x06, 'E_TIMEOUT'],
  [0x07, 'E_WRONG_PROTOCOL_VERSION'],
  [0x08, 'E_WRONG_INTERFACE_VERSION'],
  [0x09, 'E_MALFORMED_MESSAGE'],
  [0x0a, 'E_WRONG_MESSAGE_TYPE'],
  [0x0b, 'E_E2E_REPEATED'],
  [0x0c, 'E_E2E_WRONG_SEQUENCE'],
  [0x0d, 'E_E2E'],
  [0x0e, 'E_E2E_NOT_AVAILABLE'],
  [0x0f, 'E_E2E_NO_NEW_DATA'],
]);

/** Tablo 4.11'in ayrılmış aralıkları — bilinmeyen değil, "ayrılmış". */
const RETURN_CODE_RESERVED_GENERIC_START = 0x10;
const RETURN_CODE_RESERVED_GENERIC_END = 0x1f;
const RETURN_CODE_RESERVED_SERVICE_START = 0x20;
const RETURN_CODE_RESERVED_SERVICE_END = 0x5e;

/**
 * PRS_SOMEIP_00757, Tablo 4.5: REQUEST / REQUEST_NO_RETURN / NOTIFICATION
 * için Return Code 0x00 (E_OK) OLMAK ZORUNDA; ERROR için 0x00 OLAMAZ.
 */
const MESSAGE_TYPES_REQUIRING_E_OK = new Set<number>([0x00, 0x01, 0x02]);
const MESSAGE_TYPE_ERROR = 0x81;
const RETURN_CODE_E_OK = 0x00;

const ERROR_ABORTED = 'protocol.someip.error.aborted';
const ERROR_HEADER_TOO_SHORT = 'protocol.someip.error.headerTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.someip.error.frameTooLong';
const ERROR_LENGTH_TOO_SMALL = 'protocol.someip.error.lengthTooSmall';
const ERROR_TP_LENGTH_TOO_SMALL = 'protocol.someip.error.tpLengthTooSmall';
const ERROR_MESSAGE_INCOMPLETE = 'protocol.someip.error.messageIncomplete';

const WARN_PAYLOAD_NEEDS_SERVICE_DEFINITION =
  'protocol.someip.warning.payloadNeedsServiceDefinition';
const WARN_TRAILING_BYTES = 'protocol.someip.warning.trailingBytes';
const WARN_UNKNOWN_MESSAGE_TYPE = 'protocol.someip.warning.unknownMessageType';
const WARN_UNKNOWN_RETURN_CODE = 'protocol.someip.warning.unknownReturnCode';
const WARN_RESERVED_RETURN_CODE = 'protocol.someip.warning.reservedReturnCode';
const WARN_UNEXPECTED_PROTOCOL_VERSION = 'protocol.someip.warning.unexpectedProtocolVersion';
const WARN_RETURN_CODE_SHOULD_BE_E_OK = 'protocol.someip.warning.returnCodeShouldBeEOk';
const WARN_ERROR_RETURN_CODE_IS_E_OK = 'protocol.someip.warning.errorReturnCodeIsEOk';
const WARN_METHOD_EVENT_SPLIT_RECOMMENDED = 'protocol.someip.warning.methodEventSplitRecommended';
const WARN_SD_TP_SEGMENT = 'protocol.someip.warning.serviceDiscoveryTpSegment';

const SUMMARY_PREFIX = 'protocol.someip.summary.';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/**
 * `>>> 0` şart: 32-bit değerin en yüksek biti set olduğunda `<<` işaretli
 * sayı üretir ve `Length` negatife döner (klasik JS tuzağı).
 */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function toHex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

export type SomeIpFrameMetadata = {
  serviceId: number;
  methodId: number;
  clientId: number;
  sessionId: number;
  messageType: number;
  returnCode: number;
  /** Korelasyon analyzer'ı bunu görüp SD trafiğini ayırabilsin diye. */
  serviceDiscovery: boolean;
  tpSegment: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface SomeIpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function resolveParseOptions(context: ParseContext | undefined): SomeIpParseOptions {
  // `decodeOptions` YOK (dosya başı kararı) — bağlamdan yalnız ortak alanlar okunur.
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
  };
}

/** Return Code'un görünen değeri: adlandırılmış / ayrılmış / bilinmeyen. */
function describeReturnCode(code: number): { physical?: string; warning?: string } {
  const name = RETURN_CODE_NAMES.get(code);
  if (name !== undefined) return { physical: name };
  if (code >= RETURN_CODE_RESERVED_GENERIC_START && code <= RETURN_CODE_RESERVED_GENERIC_END) {
    return { physical: 'RESERVED (generic)', warning: WARN_RESERVED_RETURN_CODE };
  }
  if (code >= RETURN_CODE_RESERVED_SERVICE_START && code <= RETURN_CODE_RESERVED_SERVICE_END) {
    return { physical: 'RESERVED (service specific)', warning: WARN_RESERVED_RETURN_CODE };
  }
  return { warning: WARN_UNKNOWN_RETURN_CODE };
}

function pushHeaderFields(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  declaredLength: number,
): void {
  const serviceId = readUint16BE(data, OFFSET_SERVICE_ID);
  const methodId = readUint16BE(data, OFFSET_METHOD_ID);
  const messageType = byteAt(data, OFFSET_MESSAGE_TYPE);
  const returnCode = byteAt(data, OFFSET_RETURN_CODE);
  const protocolVersion = byteAt(data, OFFSET_PROTOCOL_VERSION);

  fields.push({
    id: 'service-id',
    name: 'Service ID',
    offset: OFFSET_SERVICE_ID,
    length: 2,
    rawBytes: data.slice(OFFSET_SERVICE_ID, OFFSET_SERVICE_ID + 2),
    rawValue: serviceId,
    physicalValue: toHex(serviceId, 4),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'method-id',
    name: 'Method / Event ID',
    offset: OFFSET_METHOD_ID,
    length: 2,
    rawBytes: data.slice(OFFSET_METHOD_ID, OFFSET_METHOD_ID + 2),
    rawValue: methodId,
    physicalValue: toHex(methodId, 4),
    valid: true,
    warnings: [],
  });

  // TÜRETİLMİŞ: bölünme PRS_SOMEIP_00245'in NOTUdur, normatif değil — uyarı
  // alanın kendisinde durur ki tabloyu okuyan kişi tavsiyeyi kurala sanmasın.
  fields.push({
    id: 'method-id-class',
    name: 'Method / Event Class (recommended split, PRS_SOMEIP_00245 note)',
    offset: OFFSET_METHOD_ID,
    length: 2,
    rawBytes: data.slice(OFFSET_METHOD_ID, OFFSET_METHOD_ID + 2),
    physicalValue:
      methodId < METHOD_ID_EVENT_THRESHOLD ? 'Method (0x0000–0x7FFF)' : 'Event (0x8000–0xFFFF)',
    valid: true,
    warnings: [WARN_METHOD_EVENT_SPLIT_RECOMMENDED],
  });

  fields.push({
    id: 'length',
    name: 'Length (from Request ID to end of message)',
    offset: OFFSET_LENGTH,
    length: 4,
    rawBytes: data.slice(OFFSET_LENGTH, OFFSET_LENGTH + 4),
    rawValue: declaredLength,
    physicalValue: LENGTH_COVERAGE_BASE + declaredLength,
    unit: 'B',
    valid: declaredLength >= MIN_DECLARED_LENGTH,
    warnings: [],
  });

  fields.push({
    id: 'client-id',
    name: 'Client ID',
    offset: OFFSET_CLIENT_ID,
    length: 2,
    rawBytes: data.slice(OFFSET_CLIENT_ID, OFFSET_CLIENT_ID + 2),
    rawValue: readUint16BE(data, OFFSET_CLIENT_ID),
    physicalValue: toHex(readUint16BE(data, OFFSET_CLIENT_ID), 4),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'session-id',
    name: 'Session ID',
    offset: OFFSET_SESSION_ID,
    length: 2,
    rawBytes: data.slice(OFFSET_SESSION_ID, OFFSET_SESSION_ID + 2),
    rawValue: readUint16BE(data, OFFSET_SESSION_ID),
    physicalValue: toHex(readUint16BE(data, OFFSET_SESSION_ID), 4),
    valid: true,
    warnings: [],
  });

  const protocolVersionField: ParsedField = {
    id: 'protocol-version',
    name: 'Protocol Version',
    offset: OFFSET_PROTOCOL_VERSION,
    length: 1,
    rawBytes: data.slice(OFFSET_PROTOCOL_VERSION, OFFSET_PROTOCOL_VERSION + 1),
    rawValue: protocolVersion,
    valid: protocolVersion === EXPECTED_PROTOCOL_VERSION,
    warnings: [],
  };
  if (protocolVersion !== EXPECTED_PROTOCOL_VERSION) {
    protocolVersionField.warnings.push(WARN_UNEXPECTED_PROTOCOL_VERSION);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_PROTOCOL_VERSION));
  }
  fields.push(protocolVersionField);

  fields.push({
    id: 'interface-version',
    name: 'Interface Version (service major version)',
    offset: OFFSET_INTERFACE_VERSION,
    length: 1,
    rawBytes: data.slice(OFFSET_INTERFACE_VERSION, OFFSET_INTERFACE_VERSION + 1),
    rawValue: byteAt(data, OFFSET_INTERFACE_VERSION),
    valid: true,
    warnings: [],
  });

  const messageTypeName = MESSAGE_TYPE_NAMES.get(messageType);
  const messageTypeField: ParsedField = {
    id: 'message-type',
    name: 'Message Type',
    offset: OFFSET_MESSAGE_TYPE,
    length: 1,
    rawBytes: data.slice(OFFSET_MESSAGE_TYPE, OFFSET_MESSAGE_TYPE + 1),
    rawValue: messageType,
    valid: messageTypeName !== undefined,
    warnings: [],
  };
  if (messageTypeName === undefined) {
    messageTypeField.warnings.push(WARN_UNKNOWN_MESSAGE_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_MESSAGE_TYPE));
  } else {
    messageTypeField.physicalValue = messageTypeName;
  }
  fields.push(messageTypeField);

  // TÜRETİLMİŞ (12f WebSocket `direction` sınıfı): TP bayrağı düşürülünce
  // geriye taban sınıf kalır — Notification/Event ayrımı BURADAN çıkar.
  const baseMessageType = messageType & ~MESSAGE_TYPE_TP_FLAG;
  const kind = MESSAGE_KINDS.get(baseMessageType);
  fields.push({
    id: 'message-kind',
    name: 'Message Kind (derived from Message Type)',
    offset: OFFSET_MESSAGE_TYPE,
    length: 1,
    rawBytes: data.slice(OFFSET_MESSAGE_TYPE, OFFSET_MESSAGE_TYPE + 1),
    // Protokol terimleri veridir, çeviriye girmez (CLAUDE.md) — `physicalValue`
    // DecodePanel'de olduğu gibi basılır, `translateDiagnostic`ten geçmez.
    physicalValue: kind?.label ?? 'Unknown',
    valid: kind !== undefined,
    warnings: [],
  });

  const returnCodeField: ParsedField = {
    id: 'return-code',
    name: 'Return Code',
    offset: OFFSET_RETURN_CODE,
    length: 1,
    rawBytes: data.slice(OFFSET_RETURN_CODE, OFFSET_RETURN_CODE + 1),
    rawValue: returnCode,
    valid: true,
    warnings: [],
  };
  const described = describeReturnCode(returnCode);
  if (described.physical !== undefined) returnCodeField.physicalValue = described.physical;
  if (described.warning !== undefined) {
    returnCodeField.valid = described.warning !== WARN_UNKNOWN_RETURN_CODE;
    returnCodeField.warnings.push(described.warning);
    warnings.push(toProtocolWarning(described.warning));
  }
  // Tablo 4.5 tutarlılığı: adlandırılmış tipler için Return Code kısıtlı.
  if (MESSAGE_TYPES_REQUIRING_E_OK.has(baseMessageType) && returnCode !== RETURN_CODE_E_OK) {
    returnCodeField.warnings.push(WARN_RETURN_CODE_SHOULD_BE_E_OK);
    warnings.push(toProtocolWarning(WARN_RETURN_CODE_SHOULD_BE_E_OK));
  }
  if (baseMessageType === MESSAGE_TYPE_ERROR && returnCode === RETURN_CODE_E_OK) {
    returnCodeField.warnings.push(WARN_ERROR_RETURN_CODE_IS_E_OK);
    warnings.push(toProtocolWarning(WARN_ERROR_RETURN_CODE_IS_E_OK));
  }
  fields.push(returnCodeField);
}

/**
 * SOME/IP-TP başlığı (PRS_SOMEIP_00723-00727): Offset[28] + Reserved[3] +
 * More Segments[1], network byte order. Wireshark'ın `SOMEIP_TP_OFFSET_MASK
 * 0xfffffff0` / `..._RESERVED 0x0000000e` / `..._MORE_SEGMENTS 0x00000001`
 * maskeleri ve Scapy'nin `BitScalingField("offset", 0, 28, scaling=16)` +
 * `BitField("res", 0, 3)` + `BitField("more_seg", 0, 1)` tanımı ile birebir.
 */
function pushTpFields(data: Uint8Array, fields: ParsedField[]): void {
  const tpWord = readUint32BE(data, HEADER_LENGTH);
  const offsetUnits = tpWord >>> 4;
  const lastByteOffset = HEADER_LENGTH + TP_HEADER_LENGTH - 1;
  const lastByte = byteAt(data, lastByteOffset);

  fields.push({
    id: 'tp-offset',
    name: 'TP Offset (upper 28 bits, unit = 16 B)',
    offset: HEADER_LENGTH,
    length: 4,
    rawBytes: data.slice(HEADER_LENGTH, HEADER_LENGTH + 4),
    rawValue: offsetUnits,
    // PRS_SOMEIP_00724: taşınan değer 16 baytın katıdır, gerçek ofset ×16.
    physicalValue: offsetUnits * 16,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'tp-reserved',
    name: 'TP Reserved',
    offset: lastByteOffset,
    length: 1,
    rawBytes: data.slice(lastByteOffset, lastByteOffset + 1),
    rawValue: (lastByte & 0x0e) >>> 1,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'tp-more-segments',
    name: 'TP More Segments Flag',
    offset: lastByteOffset,
    length: 1,
    rawBytes: data.slice(lastByteOffset, lastByteOffset + 1),
    rawValue: lastByte & 0x01,
    physicalValue: (lastByte & 0x01) === 1 ? 'More segments follow' : 'Last segment',
    valid: true,
    warnings: [],
  });
}

function parseSomeIpFrame(data: Uint8Array, options: SomeIpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  // Sabit başlık okunamıyorsa `Length` de okunamaz → sınır bilinmiyor.
  // `consumedBytes: 0` + `recoverable: true` = "daha çok veri bekle"
  // (`types.ts:148`), akış katmanı buffer'ı ilerletmez.
  if (data.length < HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { headerLength: HEADER_LENGTH, available: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const declaredLength = readUint32BE(data, OFFSET_LENGTH);
  const messageType = byteAt(data, OFFSET_MESSAGE_TYPE);
  const isTpSegment = (messageType & MESSAGE_TYPE_TP_FLAG) !== 0;

  // Bildirilen uzunluk yapısal olarak imkânsızsa mesaj sınırı hiç kurulamaz —
  // ama sabit ofsetli başlık alanları YİNE DE gösterilir (ipv4.ts'in IHL<5
  // kısmi çözümü, spec §47). `success:true` + `valid:false` bilerek:
  // kullanıcı `decode-parse-error` yerine dolu bir tablo + hata görür.
  if (declaredLength < MIN_DECLARED_LENGTH) {
    const fields: ParsedField[] = [];
    const warnings: ProtocolWarning[] = [];
    pushHeaderFields(data, fields, warnings, declaredLength);
    const errors: ProtocolError[] = [
      {
        code: 'value-out-of-range',
        message: ERROR_LENGTH_TOO_SMALL,
        offset: OFFSET_LENGTH,
        length: 4,
        details: { declaredLength, minimum: MIN_DECLARED_LENGTH },
      },
    ];
    return finishFrame(data, data.length, fields, warnings, errors, options, {
      declaredLength,
      isTpSegment,
      serviceDiscovery: false,
    });
  }

  const messageEnd = LENGTH_COVERAGE_BASE + declaredLength;
  if (messageEnd > data.length) {
    // TCP'de yarım segment — segment BİRLEŞTİRİLMEZ, çağıran daha çok veri
    // toplasın diye `consumedBytes: 0` + `recoverable: true`.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_MESSAGE_INCOMPLETE,
        offset: data.length,
        length: messageEnd - data.length,
        details: { declaredLength, expectedTotal: messageEnd, available: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  pushHeaderFields(data, fields, warnings, declaredLength);

  let payloadStart = HEADER_LENGTH;
  if (isTpSegment) {
    if (declaredLength < MIN_DECLARED_LENGTH_TP || messageEnd < HEADER_LENGTH + TP_HEADER_LENGTH) {
      // TP bayrağı var ama Length TP başlığını kapsamıyor — TP alanları
      // basılmaz, kalan baytlar payload olarak ham gösterilir.
      errors.push({
        code: 'length-mismatch',
        message: ERROR_TP_LENGTH_TOO_SMALL,
        offset: OFFSET_LENGTH,
        length: 4,
        details: { declaredLength, minimum: MIN_DECLARED_LENGTH_TP },
      });
    } else {
      pushTpFields(data, fields);
      payloadStart = HEADER_LENGTH + TP_HEADER_LENGTH;
    }
  }

  const messageId = (readUint16BE(data, OFFSET_SERVICE_ID) * 0x10000 + readUint16BE(data, OFFSET_METHOD_ID)) >>> 0;
  // SD ayrımı ÇERÇEVEDEN çıkar, `decodeOptions` gerekmez (dosya başı):
  // PRS_SOMEIPSD_00151/00152 Service-ID 0xFFFF + Method-ID 0x8100.
  // TP segmenti hâlindeki bir SD mesajı spec dışıdır (SD yalnız UDP,
  // PRS_SOMEIPSD_00220) — çözülmez, ham kalır.
  const isServiceDiscovery = messageId === SOMEIP_SD_MESSAGE_ID;
  const decodeAsSd = isServiceDiscovery && !isTpSegment;
  if (isServiceDiscovery && isTpSegment) {
    warnings.push(toProtocolWarning(WARN_SD_TP_SEGMENT));
  }

  if (decodeAsSd) {
    decodeSomeIpSdPayload(data, payloadStart, messageEnd, fields, warnings, errors);
  } else if (messageEnd > payloadStart) {
    // Payload HAM: yapısı servis arayüzü tanımından gelir, telden çıkmaz
    // (dosya başı, 12g RTP kararı). Sahte alan kırılımı UYDURULMAZ.
    fields.push({
      id: 'payload',
      name: 'Payload (raw)',
      offset: payloadStart,
      length: messageEnd - payloadStart,
      rawBytes: data.slice(payloadStart, messageEnd),
      valid: true,
      warnings: [WARN_PAYLOAD_NEEDS_SERVICE_DEFINITION],
    });
    warnings.push(toProtocolWarning(WARN_PAYLOAD_NEEDS_SERVICE_DEFINITION));
  }

  if (data.length > messageEnd) {
    // TCP yapışması: sonraki mesajın baytları. `consumedBytes` doğru
    // döndüğü için akış katmanı buffer'ı kendisi ilerletir.
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  return finishFrame(data, messageEnd, fields, warnings, errors, options, {
    declaredLength,
    isTpSegment,
    serviceDiscovery: isServiceDiscovery,
  });
}

function finishFrame(
  data: Uint8Array,
  consumedBytes: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: SomeIpParseOptions,
  info: { declaredLength: number; isTpSegment: boolean; serviceDiscovery: boolean },
): ParseResult {
  const serviceId = readUint16BE(data, OFFSET_SERVICE_ID);
  const methodId = readUint16BE(data, OFFSET_METHOD_ID);
  const clientId = readUint16BE(data, OFFSET_CLIENT_ID);
  const sessionId = readUint16BE(data, OFFSET_SESSION_ID);
  const messageType = byteAt(data, OFFSET_MESSAGE_TYPE);
  const returnCode = byteAt(data, OFFSET_RETURN_CODE);

  const summarySuffix = info.serviceDiscovery
    ? 'serviceDiscovery'
    : (MESSAGE_KINDS.get(messageType & ~MESSAGE_TYPE_TP_FLAG)?.summarySuffix ?? 'unknown');

  /**
   * Korelasyonun HAMMADDESİ burada — request/response eşleştirmesi ileriki
   * analyzer'ın işi (12c DNS / 12d PTP emsali), ama Client/Session kimliği
   * çerçeveden çıkarıldığı için burada yazılır ki analyzer onu bulsun.
   */
  const metadata: SomeIpFrameMetadata = {
    serviceId,
    methodId,
    clientId,
    sessionId,
    messageType,
    returnCode,
    serviceDiscovery: info.serviceDiscovery,
    tpSegment: info.isTpSegment,
    summaryKey: `${SUMMARY_PREFIX}${summarySuffix}`,
    summaryParams: {
      serviceId: toHex(serviceId, 4),
      methodId: toHex(methodId, 4),
      clientId: toHex(clientId, 4),
      sessionId: toHex(sessionId, 4),
    },
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes };
}

export function parseSomeIp(data: Uint8Array): ParseResult {
  return parseSomeIpFrame(data, {});
}

export const someIpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme, Wireshark'ın `test_someip()` sezgiselinin sadeleşmiş hâli
   * (`packet-someip.c:4300-4305`): sabit başlık tam, Protocol Version 1,
   * `Length` yapısal alt sınırın üstünde ve mesaj tamponu aşmıyor.
   * Wireshark eşitlik ararken (`length == someip_length + 8`) burada `<=`
   * kullanılır — TCP'de yapışmış mesajların ilki de tanınmalı.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    if (byteAt(data, OFFSET_PROTOCOL_VERSION) !== EXPECTED_PROTOCOL_VERSION) return false;
    const declaredLength = readUint32BE(data, OFFSET_LENGTH);
    if (declaredLength < MIN_DECLARED_LENGTH) return false;
    return LENGTH_COVERAGE_BASE + declaredLength <= data.length;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSomeIpFrame(data, resolveParseOptions(context));
  },
};

/**
 * Örnek çerçeveler. Hepsi elle kurulmuş, `Length` alanı `8 + payload` kuralına
 * göre HESAPLANMIŞ değerlerdir (dosya başı doğrulaması) — birim testleri aynı
 * baytları bağımsız olarak yeniden sayar.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'request',
    name: 'protocol.someip.example.request.name',
    // Service 0x1234 / Method 0x0421 / Length 0x0C (=8+4 payload) /
    // Client 0x0001 / Session 0x0001 / v1 / iface 1 / type 0x00 / rc 0x00.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x04, 0x21, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x00, 0xde, 0xad, 0xbe, 0xef,
    ]),
    description: 'protocol.someip.example.request.description',
    expectedValid: true,
  },
  {
    id: 'response',
    name: 'protocol.someip.example.response.name',
    // AYNI Request ID (0x0001/0x0001), Message Type 0x80 = RESPONSE.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x04, 0x21, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x80,
      0x00, 0x00, 0x2a,
    ]),
    description: 'protocol.someip.example.response.description',
    expectedValid: true,
  },
  {
    id: 'notification',
    name: 'protocol.someip.example.notification.name',
    // Event ID 0x8001 (tavsiye edilen olay aralığı), Message Type 0x02.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x80, 0x01, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x07, 0x01, 0x01, 0x02,
      0x00, 0x01, 0xf4,
    ]),
    description: 'protocol.someip.example.notification.description',
    expectedValid: true,
  },
  {
    id: 'error',
    name: 'protocol.someip.example.error.name',
    // Message Type 0x81 = ERROR, Return Code 0x03 = E_UNKNOWN_METHOD.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x0f, 0xff, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x00, 0x02, 0x01, 0x01, 0x81,
      0x03,
    ]),
    description: 'protocol.someip.example.error.description',
    expectedValid: true,
  },
  {
    id: 'tp-segment',
    name: 'protocol.someip.example.tpSegment.name',
    // Message Type 0x20 = TP_REQUEST; TP başlığı 0x00000011 →
    // offset birimleri 0x1 (=16 B), More Segments = 1.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x04, 0x21, 0x00, 0x00, 0x00, 0x10, 0x00, 0x01, 0x00, 0x03, 0x01, 0x01, 0x20,
      0x00, 0x00, 0x00, 0x00, 0x11, 0xaa, 0xbb, 0xcc, 0xdd,
    ]),
    description: 'protocol.someip.example.tpSegment.description',
    expectedValid: true,
  },
  {
    id: 'sd-offer-service',
    name: 'protocol.someip.example.sdOfferService.name',
    // Message ID 0xFFFF8100 = SOME/IP-SD. Flags 0xC0 (Reboot+Unicast),
    // 1 Offer Service girdisi + 1 IPv4 Endpoint opsiyonu.
    bytes: Uint8Array.from([
      // SOME/IP başlığı: Length 0x30 = 8 + 40 (SD payload).
      0xff, 0xff, 0x81, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x02,
      0x00,
      // SD: Flags 0xC0, Reserved 000000, Entries Array Length 0x10.
      0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10,
      // Entry: Offer Service (0x01), opt run 0/0, #opt 1/0, Service 0x1234,
      // Instance 0x0001, Major 0x01, TTL 0x000003, Minor 0x00000000.
      0x01, 0x00, 0x00, 0x10, 0x12, 0x34, 0x00, 0x01, 0x01, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x00,
      // Options Array Length 0x0C.
      0x00, 0x00, 0x00, 0x0c,
      // IPv4 Endpoint: Length 0x0009, Type 0x04, flags 0x00,
      // 192.168.1.10, reserved 0x00, L4 0x11 (UDP), port 30509.
      0x00, 0x09, 0x04, 0x00, 0xc0, 0xa8, 0x01, 0x0a, 0x00, 0x11, 0x77, 0x2d,
    ]),
    description: 'protocol.someip.example.sdOfferService.description',
    expectedValid: true,
  },
  {
    id: 'sd-find-service',
    name: 'protocol.someip.example.sdFindService.name',
    // Find Service girdisi, opsiyon YOK — Options Array Length 0.
    bytes: Uint8Array.from([
      0xff, 0xff, 0x81, 0x00, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00, 0x02, 0x01, 0x01, 0x02,
      0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x12, 0x34,
      0xff, 0xff, 0xff, 0x00, 0x00, 0x0a, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
    ]),
    description: 'protocol.someip.example.sdFindService.description',
    expectedValid: true,
  },
  {
    id: 'truncated-message',
    name: 'protocol.someip.example.truncatedMessage.name',
    // Length 0x0C toplam 20 bayt vaat ediyor, tamponda 18 var → eksik veri.
    bytes: Uint8Array.from([
      0x12, 0x34, 0x04, 0x21, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x01, 0x00, 0x04, 0x01, 0x01, 0x00,
      0x00, 0xde, 0xad,
    ]),
    description: 'protocol.someip.example.truncatedMessage.description',
    expectedValid: false,
  },
];

export const someIpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: someIpParser,
  documentation: {
    summary: 'protocol.someip.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'AUTOSAR FO R23-11 — SOME/IP Protocol Specification (Doc ID 696)',
        url: 'https://www.autosar.org/fileadmin/standards/R23-11/FO/AUTOSAR_FO_PRS_SOMEIPProtocol.pdf',
      },
      {
        title:
          'AUTOSAR FO R23-11 — SOME/IP Service Discovery Protocol Specification (Doc ID 802)',
        url: 'https://www.autosar.org/fileadmin/standards/R23-11/FO/AUTOSAR_FO_PRS_SOMEIPServiceDiscoveryProtocol.pdf',
      },
      {
        title: 'Wireshark — epan/dissectors/packet-someip.c (GPL-2.0-or-later)',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-someip.c',
      },
      {
        title: 'Scapy — contrib/automotive/someip.py (GPL-2.0-only)',
        url: 'https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/someip.py',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  // `decodeOptions` YOK — bir eksiklik değil, karar (dosya başı gerekçesi).
};
