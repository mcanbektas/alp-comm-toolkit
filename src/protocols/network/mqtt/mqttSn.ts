/**
 * MQTT-SN 1.2 — kısıtlı sensör ağları için MQTT ile İLİŞKİLİ mesajlaşma.
 * Girdi TEK bir MQTT-SN mesajıdır (UDP sarmalayıcısı YOK).
 *
 * **Profil notu (katalog tuzağı):** MQTT-SN 1.2 OASIS MQTT-SN Subcommittee
 * tarafından *input specification* olarak kabul edilmiştir; MQTT 5 gibi resmen
 * onaylanmış bir OASIS Standard DEĞİLDİR (spec `:477`).
 *
 * ── `mqttVbi.ts` BURADA KULLANILAMAZ ────────────────────────────────────────
 * Dosya `mqtt.ts`in YANINDA duruyor ve bu bilerek: iki protokolün adı akraba,
 * tel biçimleri DEĞİL. En kolay hata `mqttVbi.ts`i (MQTT'nin Variable Byte
 * Integer'ı — 7 bit + devam biti, en çok dört bayt) buraya uygulamaktır.
 *
 *   MQTT Remaining Length : 1-4 bayt VBI, her baytın üst biti devam işareti.
 *   MQTT-SN Length        : ya TEK bayt (1-255) ya da ÜÇ bayt — ilki `0x01`,
 *                           ardından 16 bitlik uzunluk (MQTT-SN 1.2 §5.2.1).
 *
 * `0x01` ön eki VBI'da "değer 1, devam yok" demektir; MQTT-SN'de "uzunluk
 * sonraki iki baytta" demektir. Aynı bayt, iki farklı anlam. 12b'nin
 * LLDP/DHCP "TLV", 12d'nin NTP/PTP "zaman damgası" vakalarının üçüncüsü.
 *
 * ── UZUNLUK KENDİNİ DE SAYAR ────────────────────────────────────────────────
 * İkinci ve daha sinsi fark: MQTT-SN'in `Length`i **kendi baytlarını da içeren
 * TOPLAM mesaj uzunluğudur**. MQTT'nin `Remaining Length`i ise sabit başlıktan
 * SONRAKİ baytları sayar. Aynı sayıyı aynı yerde okuyup aynı şekilde
 * yorumlamak mesaj başına 1 (ya da 3) bayt kaydırır — kısa mesajlarda çoğu
 * alan yine "geçerli" görünür.
 *
 * ── QoS 0b11 BURADA GEÇERLİDİR VE −1 DEMEKTİR ───────────────────────────────
 * `mqtt.ts` QoS bitleri 0b11 gelince `invalid-qos` hatası basar; OASIS orada
 * bu değeri rezerve etmiştir. MQTT-SN'de 0b11 **QoS −1**'dir: istemcinin
 * CONNECT yapmadan, önceden tanımlı topic id ile yayın yapması. Aynı iki bit,
 * birinde hata, ötekinde bir özellik.
 *
 * ── TOPIC ID TİPİ TOPIC ALANININ NE OLDUĞUNU BELİRLER ───────────────────────
 * Flags'in alt iki biti (`TopicIdType`) 0b00 normal topic id, 0b01 önceden
 * tanımlı id, 0b10 KISA TOPIC ADI (iki ASCII karakter, sayı değil), 0b11
 * rezerve. Aynı iki bayt ya sayıdır ya metin — tipe bakmadan sayı basmak
 * `"ab"`yi `0x6162` diye gösterir.
 *
 * ── TOPIC ID EŞLEME VE OTURUM GÖRÜNÜMÜ ÇOK-MESAJ İŞİDİR ─────────────────────
 * `REGISTER → REGACK` ile kurulan `topic adı ↔ 0x0012` eşlemesi (spec `:494`)
 * ve gateway topolojisi bir mesaj KÜMESİNİN işidir; tek mesaj çözücüsü
 * PUBLISH'in topic id'sini ham gösterir (12c/12d/12e'nin aynı sınırı).
 */

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

const PROTOCOL_ID = 'mqtt-sn';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'MQTT-SN';

/** Length(1) + MsgType(1). */
const MIN_FRAME_LENGTH = 2;

/** Üç baytlık uzunluk biçiminin ön eki (dosya başı). */
const EXTENDED_LENGTH_PREFIX = 0x01;
const EXTENDED_LENGTH_SIZE = 3;
const SHORT_LENGTH_SIZE = 1;

const HEX_RADIX = 16;
const TOPIC_ID_LENGTH = 2;
const MESSAGE_ID_LENGTH = 2;

const MSG_ADVERTISE = 0x00;
const MSG_SEARCHGW = 0x01;
const MSG_GWINFO = 0x02;
const MSG_CONNECT = 0x04;
const MSG_CONNACK = 0x05;
const MSG_WILLTOPICREQ = 0x06;
const MSG_WILLTOPIC = 0x07;
const MSG_WILLMSGREQ = 0x08;
const MSG_WILLMSG = 0x09;
const MSG_REGISTER = 0x0a;
const MSG_REGACK = 0x0b;
const MSG_PUBLISH = 0x0c;
const MSG_PUBACK = 0x0d;
const MSG_PUBCOMP = 0x0e;
const MSG_PUBREC = 0x0f;
const MSG_PUBREL = 0x10;
const MSG_SUBSCRIBE = 0x12;
const MSG_SUBACK = 0x13;
const MSG_UNSUBSCRIBE = 0x14;
const MSG_UNSUBACK = 0x15;
const MSG_PINGREQ = 0x16;
const MSG_PINGRESP = 0x17;
const MSG_DISCONNECT = 0x18;
const MSG_WILLTOPICUPD = 0x1a;
const MSG_WILLTOPICRESP = 0x1b;
const MSG_WILLMSGUPD = 0x1c;
const MSG_WILLMSGRESP = 0x1d;
const MSG_ENCAPSULATED = 0xfe;

const MESSAGE_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [MSG_ADVERTISE, 'ADVERTISE'],
  [MSG_SEARCHGW, 'SEARCHGW'],
  [MSG_GWINFO, 'GWINFO'],
  [MSG_CONNECT, 'CONNECT'],
  [MSG_CONNACK, 'CONNACK'],
  [MSG_WILLTOPICREQ, 'WILLTOPICREQ'],
  [MSG_WILLTOPIC, 'WILLTOPIC'],
  [MSG_WILLMSGREQ, 'WILLMSGREQ'],
  [MSG_WILLMSG, 'WILLMSG'],
  [MSG_REGISTER, 'REGISTER'],
  [MSG_REGACK, 'REGACK'],
  [MSG_PUBLISH, 'PUBLISH'],
  [MSG_PUBACK, 'PUBACK'],
  [MSG_PUBCOMP, 'PUBCOMP'],
  [MSG_PUBREC, 'PUBREC'],
  [MSG_PUBREL, 'PUBREL'],
  [MSG_SUBSCRIBE, 'SUBSCRIBE'],
  [MSG_SUBACK, 'SUBACK'],
  [MSG_UNSUBSCRIBE, 'UNSUBSCRIBE'],
  [MSG_UNSUBACK, 'UNSUBACK'],
  [MSG_PINGREQ, 'PINGREQ'],
  [MSG_PINGRESP, 'PINGRESP'],
  [MSG_DISCONNECT, 'DISCONNECT'],
  [MSG_WILLTOPICUPD, 'WILLTOPICUPD'],
  [MSG_WILLTOPICRESP, 'WILLTOPICRESP'],
  [MSG_WILLMSGUPD, 'WILLMSGUPD'],
  [MSG_WILLMSGRESP, 'WILLMSGRESP'],
  [MSG_ENCAPSULATED, 'ENCAPSULATED'],
]);

const FLAG_DUP = 0x80;
const FLAG_QOS_MASK = 0x60;
const FLAG_QOS_SHIFT = 5;
const FLAG_RETAIN = 0x10;
const FLAG_WILL = 0x08;
const FLAG_CLEAN_SESSION = 0x04;
const FLAG_TOPIC_ID_TYPE_MASK = 0x03;

const QOS_MINUS_ONE_CODE = 0b11;

const TOPIC_ID_TYPE_NORMAL = 0b00;
const TOPIC_ID_TYPE_PREDEFINED = 0b01;
const TOPIC_ID_TYPE_SHORT_NAME = 0b10;

const TOPIC_ID_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [TOPIC_ID_TYPE_NORMAL, 'Normal topic ID'],
  [TOPIC_ID_TYPE_PREDEFINED, 'Pre-defined topic ID'],
  [TOPIC_ID_TYPE_SHORT_NAME, 'Short topic name'],
]);

const RETURN_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Accepted'],
  [0x01, 'Rejected: congestion'],
  [0x02, 'Rejected: invalid topic ID'],
  [0x03, 'Rejected: not supported'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.mqttSn.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.mqttSn.error.frameTooLong';
const ERROR_ABORTED = 'protocol.mqttSn.error.aborted';
const ERROR_LENGTH_TRUNCATED = 'protocol.mqttSn.error.lengthTruncated';
const ERROR_BODY_TRUNCATED = 'protocol.mqttSn.error.bodyTruncated';
const ERROR_LENGTH_TOO_SMALL = 'protocol.mqttSn.error.lengthTooSmall';

const WARN_UNKNOWN_MESSAGE_TYPE = 'protocol.mqttSn.warning.unknownMessageType';
const WARN_LENGTH_MISMATCH = 'protocol.mqttSn.warning.lengthMismatch';
const WARN_QOS_MINUS_ONE = 'protocol.mqttSn.warning.qosMinusOne';
const WARN_TOPIC_ID_TYPE_RESERVED = 'protocol.mqttSn.warning.topicIdTypeReserved';
const WARN_UNKNOWN_RETURN_CODE = 'protocol.mqttSn.warning.unknownReturnCode';
const WARN_TOPIC_MAPPING_NEEDS_STREAM = 'protocol.mqttSn.warning.topicMappingNeedsStream';
const WARN_NON_MINIMAL_LENGTH = 'protocol.mqttSn.warning.nonMinimalLength';
const WARN_ENCAPSULATED_OPAQUE = 'protocol.mqttSn.warning.encapsulatedOpaque';
const WARN_PROFILE_NOT_OASIS_STANDARD = 'protocol.mqttSn.warning.profileNotOasisStandard';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

function readAscii(data: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(byteAt(data, offset + index));
  return text;
}

interface MqttSnParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface Sink {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function pushWarning(sink: Sink, key: string): void {
  sink.warnings.push(toProtocolWarning(key));
}

function pushUint16Field(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  sink: Sink,
): number {
  const value = readUint16BE(data, offset);
  sink.fields.push({
    id,
    name,
    offset,
    length: TOPIC_ID_LENGTH,
    rawBytes: data.slice(offset, offset + TOPIC_ID_LENGTH),
    rawValue: value,
    valid: true,
    warnings: [],
  });
  return value;
}

function pushByteField(
  data: Uint8Array,
  id: string,
  name: string,
  offset: number,
  sink: Sink,
  physical?: string,
): number {
  const value = byteAt(data, offset);
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: value,
    valid: true,
    warnings: [],
  };
  if (physical !== undefined) field.physicalValue = physical;
  sink.fields.push(field);
  return value;
}

function pushReturnCodeField(data: Uint8Array, offset: number, sink: Sink): void {
  const value = byteAt(data, offset);
  const name = RETURN_CODE_NAMES.get(value);
  const field: ParsedField = {
    id: 'return-code',
    name: 'Return Code',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: value,
    valid: name !== undefined,
    warnings: [],
  };
  if (name !== undefined) field.physicalValue = name;
  else {
    field.warnings = [WARN_UNKNOWN_RETURN_CODE];
    pushWarning(sink, WARN_UNKNOWN_RETURN_CODE);
  }
  sink.fields.push(field);
}

/** Flags baytı: DUP · QoS · Retain · Will · CleanSession · TopicIdType. */
function pushFlagsField(data: Uint8Array, offset: number, sink: Sink): number {
  const flags = byteAt(data, offset);
  const flagBytes = data.slice(offset, offset + 1);

  const names: string[] = [];
  if ((flags & FLAG_DUP) !== 0) names.push('DUP');
  if ((flags & FLAG_RETAIN) !== 0) names.push('Retain');
  if ((flags & FLAG_WILL) !== 0) names.push('Will');
  if ((flags & FLAG_CLEAN_SESSION) !== 0) names.push('CleanSession');

  sink.fields.push({
    id: 'flags',
    name: 'Flags',
    offset,
    length: 1,
    rawBytes: flagBytes,
    rawValue: flags,
    physicalValue: names.length === 0 ? 'none' : names.join(', '),
    valid: true,
    warnings: [],
  });

  const qosCode = (flags & FLAG_QOS_MASK) >>> FLAG_QOS_SHIFT;
  const qosField: ParsedField = {
    id: 'qos',
    name: 'QoS',
    offset,
    length: 1,
    rawBytes: flagBytes,
    rawValue: qosCode,
    // 0b11 MQTT'de HATA, MQTT-SN'de −1 (dosya başı).
    physicalValue: qosCode === QOS_MINUS_ONE_CODE ? '-1' : String(qosCode),
    valid: true,
    warnings: [],
  };
  if (qosCode === QOS_MINUS_ONE_CODE) {
    qosField.warnings = [WARN_QOS_MINUS_ONE];
    pushWarning(sink, WARN_QOS_MINUS_ONE);
  }
  sink.fields.push(qosField);

  const topicIdType = flags & FLAG_TOPIC_ID_TYPE_MASK;
  const topicIdTypeName = TOPIC_ID_TYPE_NAMES.get(topicIdType);
  const topicIdTypeField: ParsedField = {
    id: 'topic-id-type',
    name: 'Topic ID Type',
    offset,
    length: 1,
    rawBytes: flagBytes,
    rawValue: topicIdType,
    valid: topicIdTypeName !== undefined,
    warnings: [],
  };
  if (topicIdTypeName !== undefined) topicIdTypeField.physicalValue = topicIdTypeName;
  else {
    topicIdTypeField.warnings = [WARN_TOPIC_ID_TYPE_RESERVED];
    pushWarning(sink, WARN_TOPIC_ID_TYPE_RESERVED);
  }
  sink.fields.push(topicIdTypeField);

  return topicIdType;
}

/**
 * İki baytlık topic alanını TİPİNE göre basar: kısa topic adında bunlar sayı
 * değil İKİ ASCII KARAKTERDİR (dosya başı).
 */
function pushTopicField(data: Uint8Array, offset: number, topicIdType: number, sink: Sink): void {
  const bytes = data.slice(offset, offset + TOPIC_ID_LENGTH);
  const field: ParsedField = {
    id: 'topic-id',
    name: topicIdType === TOPIC_ID_TYPE_SHORT_NAME ? 'Short Topic Name' : 'Topic ID',
    offset,
    length: TOPIC_ID_LENGTH,
    rawBytes: bytes,
    valid: true,
    warnings: [],
  };
  if (topicIdType === TOPIC_ID_TYPE_SHORT_NAME) {
    field.rawValue = readAscii(data, offset, TOPIC_ID_LENGTH);
  } else {
    field.rawValue = readUint16BE(data, offset);
    field.physicalValue = `0x${formatHex(bytes)}`;
  }
  sink.fields.push(field);
}

function parseBody(data: Uint8Array, messageType: number, bodyOffset: number, messageEnd: number, sink: Sink): void {
  const remaining = messageEnd - bodyOffset;

  switch (messageType) {
    case MSG_ADVERTISE:
      pushByteField(data, 'gateway-id', 'Gateway ID', bodyOffset, sink);
      pushUint16Field(data, 'duration', 'Advertisement Duration', bodyOffset + 1, sink);
      return;

    case MSG_SEARCHGW:
      pushByteField(data, 'radius', 'Radius', bodyOffset, sink);
      return;

    case MSG_GWINFO: {
      pushByteField(data, 'gateway-id', 'Gateway ID', bodyOffset, sink);
      if (remaining > 1) {
        sink.fields.push({
          id: 'gateway-address',
          name: 'Gateway Address',
          offset: bodyOffset + 1,
          length: remaining - 1,
          rawBytes: data.slice(bodyOffset + 1, messageEnd),
          rawValue: `0x${formatHex(data.slice(bodyOffset + 1, messageEnd))}`,
          valid: true,
          warnings: [],
        });
      }
      return;
    }

    case MSG_CONNECT: {
      pushFlagsField(data, bodyOffset, sink);
      pushByteField(data, 'protocol-id', 'Protocol ID', bodyOffset + 1, sink);
      pushUint16Field(data, 'duration', 'Keep-Alive Duration', bodyOffset + 2, sink);
      const clientIdOffset = bodyOffset + 4;
      if (messageEnd > clientIdOffset) {
        sink.fields.push({
          id: 'client-id',
          name: 'Client ID',
          offset: clientIdOffset,
          length: messageEnd - clientIdOffset,
          rawBytes: data.slice(clientIdOffset, messageEnd),
          rawValue: readAscii(data, clientIdOffset, messageEnd - clientIdOffset),
          valid: true,
          warnings: [],
        });
      }
      return;
    }

    case MSG_CONNACK:
    case MSG_WILLTOPICRESP:
    case MSG_WILLMSGRESP:
      pushReturnCodeField(data, bodyOffset, sink);
      return;

    case MSG_REGISTER: {
      pushUint16Field(data, 'topic-id', 'Topic ID', bodyOffset, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + TOPIC_ID_LENGTH, sink);
      const nameOffset = bodyOffset + TOPIC_ID_LENGTH + MESSAGE_ID_LENGTH;
      sink.fields.push({
        id: 'topic-name',
        name: 'Topic Name',
        offset: nameOffset,
        length: Math.max(messageEnd - nameOffset, 0),
        rawBytes: data.slice(nameOffset, messageEnd),
        rawValue: readAscii(data, nameOffset, Math.max(messageEnd - nameOffset, 0)),
        valid: true,
        warnings: [],
      });
      // Eşleme tablosu bir mesaj KÜMESİNİN işi (dosya başı).
      pushWarning(sink, WARN_TOPIC_MAPPING_NEEDS_STREAM);
      return;
    }

    case MSG_REGACK:
      pushUint16Field(data, 'topic-id', 'Topic ID', bodyOffset, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + TOPIC_ID_LENGTH, sink);
      pushReturnCodeField(data, bodyOffset + TOPIC_ID_LENGTH + MESSAGE_ID_LENGTH, sink);
      pushWarning(sink, WARN_TOPIC_MAPPING_NEEDS_STREAM);
      return;

    case MSG_PUBLISH: {
      const topicIdType = pushFlagsField(data, bodyOffset, sink);
      pushTopicField(data, bodyOffset + 1, topicIdType, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + 1 + TOPIC_ID_LENGTH, sink);
      const dataOffset = bodyOffset + 1 + TOPIC_ID_LENGTH + MESSAGE_ID_LENGTH;
      if (messageEnd > dataOffset) {
        sink.fields.push({
          id: 'payload',
          name: 'Payload',
          offset: dataOffset,
          length: messageEnd - dataOffset,
          rawBytes: data.slice(dataOffset, messageEnd),
          rawValue: `0x${formatHex(data.slice(dataOffset, messageEnd))}`,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      // Topic id'nin ADI REGISTER akışındadır (dosya başı).
      if (topicIdType !== TOPIC_ID_TYPE_SHORT_NAME) pushWarning(sink, WARN_TOPIC_MAPPING_NEEDS_STREAM);
      return;
    }

    case MSG_PUBACK:
      pushUint16Field(data, 'topic-id', 'Topic ID', bodyOffset, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + TOPIC_ID_LENGTH, sink);
      pushReturnCodeField(data, bodyOffset + TOPIC_ID_LENGTH + MESSAGE_ID_LENGTH, sink);
      return;

    case MSG_PUBREC:
    case MSG_PUBREL:
    case MSG_PUBCOMP:
    case MSG_UNSUBACK:
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset, sink);
      return;

    case MSG_SUBSCRIBE:
    case MSG_UNSUBSCRIBE: {
      const topicIdType = pushFlagsField(data, bodyOffset, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + 1, sink);
      const topicOffset = bodyOffset + 1 + MESSAGE_ID_LENGTH;
      if (topicIdType === TOPIC_ID_TYPE_NORMAL) {
        // Normal tipte SUBSCRIBE topic ADI taşır, id değil (§5.4.15).
        sink.fields.push({
          id: 'topic-name',
          name: 'Topic Name',
          offset: topicOffset,
          length: Math.max(messageEnd - topicOffset, 0),
          rawBytes: data.slice(topicOffset, messageEnd),
          rawValue: readAscii(data, topicOffset, Math.max(messageEnd - topicOffset, 0)),
          valid: true,
          warnings: [],
        });
      } else {
        pushTopicField(data, topicOffset, topicIdType, sink);
      }
      return;
    }

    case MSG_SUBACK: {
      const topicIdType = pushFlagsField(data, bodyOffset, sink);
      pushTopicField(data, bodyOffset + 1, topicIdType, sink);
      pushUint16Field(data, 'message-id', 'Message ID', bodyOffset + 1 + TOPIC_ID_LENGTH, sink);
      pushReturnCodeField(data, bodyOffset + 1 + TOPIC_ID_LENGTH + MESSAGE_ID_LENGTH, sink);
      return;
    }

    case MSG_WILLTOPIC:
    case MSG_WILLTOPICUPD: {
      if (remaining === 0) return; // Boş WILLTOPIC "will'i sil" demektir (§5.4.7).
      const topicIdType = pushFlagsField(data, bodyOffset, sink);
      void topicIdType;
      sink.fields.push({
        id: 'will-topic',
        name: 'Will Topic',
        offset: bodyOffset + 1,
        length: Math.max(messageEnd - bodyOffset - 1, 0),
        rawBytes: data.slice(bodyOffset + 1, messageEnd),
        rawValue: readAscii(data, bodyOffset + 1, Math.max(messageEnd - bodyOffset - 1, 0)),
        valid: true,
        warnings: [],
      });
      return;
    }

    case MSG_WILLMSG:
    case MSG_WILLMSGUPD:
      sink.fields.push({
        id: 'will-message',
        name: 'Will Message',
        offset: bodyOffset,
        length: remaining,
        rawBytes: data.slice(bodyOffset, messageEnd),
        rawValue: `0x${formatHex(data.slice(bodyOffset, messageEnd))}`,
        unit: 'B',
        valid: true,
        warnings: [],
      });
      return;

    case MSG_DISCONNECT:
      // Duration OPSİYONELDİR: varsa uyuma süresi, yoksa düz kopuş (§5.4.21).
      if (remaining >= 2) pushUint16Field(data, 'duration', 'Sleep Duration', bodyOffset, sink);
      return;

    case MSG_ENCAPSULATED:
      // İçindeki mesaj ayrı bir MQTT-SN mesajıdır; motorlar zincir KURMAZ.
      pushWarning(sink, WARN_ENCAPSULATED_OPAQUE);
      sink.fields.push({
        id: 'encapsulated-body',
        name: 'Encapsulated Body',
        offset: bodyOffset,
        length: remaining,
        rawBytes: data.slice(bodyOffset, messageEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_ENCAPSULATED_OPAQUE],
      });
      return;

    case MSG_PINGREQ:
      if (remaining > 0) {
        // Uyuyan istemci PINGREQ'te Client ID taşır (§5.4.19).
        sink.fields.push({
          id: 'client-id',
          name: 'Client ID',
          offset: bodyOffset,
          length: remaining,
          rawBytes: data.slice(bodyOffset, messageEnd),
          rawValue: readAscii(data, bodyOffset, remaining),
          valid: true,
          warnings: [],
        });
      }
      return;

    default:
      if (remaining > 0) {
        sink.fields.push({
          id: 'body',
          name: 'Body',
          offset: bodyOffset,
          length: remaining,
          rawBytes: data.slice(bodyOffset, messageEnd),
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      return;
  }
}

function parseMqttSnFrame(data: Uint8Array, options: MqttSnParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
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

  const sink: Sink = { fields: [], warnings: [], errors: [] };

  // ── Length: MQTT'nin VBI'ı DEĞİL; ya 1 bayt ya 0x01 + 16 bit (dosya başı).
  const firstByte = byteAt(data, 0);
  const extended = firstByte === EXTENDED_LENGTH_PREFIX;
  const lengthFieldSize = extended ? EXTENDED_LENGTH_SIZE : SHORT_LENGTH_SIZE;

  if (extended && data.length < EXTENDED_LENGTH_SIZE) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_LENGTH_TRUNCATED, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const declaredLength = extended ? readUint16BE(data, 1) : firstByte;

  sink.fields.push({
    id: 'length',
    name: extended ? 'Length (3-byte form)' : 'Length',
    offset: 0,
    length: lengthFieldSize,
    rawBytes: data.slice(0, lengthFieldSize),
    rawValue: declaredLength,
    // Uzunluk KENDİNİ DE sayar — MQTT'nin Remaining Length'inin tersi.
    // `unit` VERİLMEZ: panel birimi fiziksel değere yapıştırıyor ve bu cümlenin
    // sonuna " B" eklerdi (12e'de bulunan tuzak).
    physicalValue: 'Total message length, including this field',
    valid: true,
    warnings: [],
  });

  if (extended && declaredLength <= 0xff) {
    // Üç baytlık biçim yalnız 255'i aşan mesajlar için gerekir.
    pushWarning(sink, WARN_NON_MINIMAL_LENGTH);
  }

  if (declaredLength < lengthFieldSize + 1) {
    sink.errors.push({
      code: 'length-mismatch',
      message: ERROR_LENGTH_TOO_SMALL,
      offset: 0,
      length: lengthFieldSize,
      details: { declaredLength, minimum: lengthFieldSize + 1 },
    });
    return finish(data, sink, options);
  }

  if (declaredLength > data.length) {
    sink.errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: lengthFieldSize,
      length: declaredLength - data.length,
      details: { declaredLength, availableBytes: data.length },
    });
    return finish(data, sink, options);
  }
  if (declaredLength < data.length) {
    // Fazlalık büyük olasılıkla datagramdaki BİR SONRAKİ mesaj.
    pushWarning(sink, WARN_LENGTH_MISMATCH);
  }

  const messageEnd = declaredLength;
  const typeOffset = lengthFieldSize;
  const messageType = byteAt(data, typeOffset);
  const messageTypeName = MESSAGE_TYPE_NAMES.get(messageType);
  const typeField: ParsedField = {
    id: 'message-type',
    name: 'Message Type',
    offset: typeOffset,
    length: 1,
    rawBytes: data.slice(typeOffset, typeOffset + 1),
    rawValue: messageType,
    valid: messageTypeName !== undefined,
    warnings: [],
  };
  if (messageTypeName !== undefined) typeField.physicalValue = messageTypeName;
  else {
    typeField.warnings = [WARN_UNKNOWN_MESSAGE_TYPE];
    pushWarning(sink, WARN_UNKNOWN_MESSAGE_TYPE);
  }
  sink.fields.push(typeField);

  parseBody(data, messageType, typeOffset + 1, messageEnd, sink);

  // Profil metadata'sı (spec `:477`) — katalogdaki tuzağın kayda geçmesi.
  pushWarning(sink, WARN_PROFILE_NOT_OASIS_STANDARD);

  return finish(data, sink, options);
}

function finish(data: Uint8Array, sink: Sink, options: MqttSnParseOptions): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: sink.errors.length === 0,
    errors: sink.errors,
    warnings: sink.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseMqttSn(data: Uint8Array): ParseResult {
  return parseMqttSnFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): MqttSnParseOptions {
  const options: MqttSnParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const mqttSnParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: uzunluk alanı okunabiliyor ve iddiası tampona sığıyor mu.
   * Mesaj tipi YOKLANMAZ — tanınmayan tip `parse`de uyarıyla geçer. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    const firstByte = byteAt(data, 0);
    if (firstByte === EXTENDED_LENGTH_PREFIX) {
      return data.length >= EXTENDED_LENGTH_SIZE && readUint16BE(data, 1) <= data.length;
    }
    return firstByte >= MIN_FRAME_LENGTH && firstByte <= data.length;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseMqttSnFrame(data, readContextOptions(context));
  },
};

/** Kısa biçimde mesaj kurar: uzunluk KENDİNİ DE sayar (dosya başı). */
function message(messageType: number, body: readonly number[]): number[] {
  return [body.length + 2, messageType, ...body];
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function word(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'advertise',
    name: 'protocol.mqttSn.example.advertise.name',
    bytes: Uint8Array.from(message(MSG_ADVERTISE, [7, ...word(900)])),
    description: 'protocol.mqttSn.example.advertise.description',
    expectedValid: true,
  },
  {
    id: 'connect',
    name: 'protocol.mqttSn.example.connect.name',
    bytes: Uint8Array.from(
      message(MSG_CONNECT, [FLAG_CLEAN_SESSION, 0x01, ...word(60), ...ascii('sensor-01')]),
    ),
    description: 'protocol.mqttSn.example.connect.description',
    expectedValid: true,
  },
  {
    id: 'register',
    name: 'protocol.mqttSn.example.register.name',
    // Spec `:494`in örneği: `room/temperature ↔ 0x0012`.
    bytes: Uint8Array.from(message(MSG_REGISTER, [...word(0x0012), ...word(1), ...ascii('room/temperature')])),
    description: 'protocol.mqttSn.example.register.description',
    expectedValid: true,
  },
  {
    id: 'publish-qos1',
    name: 'protocol.mqttSn.example.publishQos1.name',
    // Spec `:490`in örneği: Topic ID 0x0012, Message ID 42, QoS 1.
    bytes: Uint8Array.from(
      message(MSG_PUBLISH, [1 << FLAG_QOS_SHIFT, ...word(0x0012), ...word(42), ...ascii('23.4')]),
    ),
    description: 'protocol.mqttSn.example.publishQos1.description',
    expectedValid: true,
  },
  {
    id: 'publish-qos-minus-one',
    name: 'protocol.mqttSn.example.publishQosMinusOne.name',
    // QoS bitleri 0b11: MQTT'de HATA, MQTT-SN'de −1 (bağlantısız yayın).
    bytes: Uint8Array.from(
      message(MSG_PUBLISH, [
        (QOS_MINUS_ONE_CODE << FLAG_QOS_SHIFT) | TOPIC_ID_TYPE_PREDEFINED,
        ...word(0x0001),
        ...word(0),
        ...ascii('42'),
      ]),
    ),
    description: 'protocol.mqttSn.example.publishQosMinusOne.description',
    expectedValid: true,
  },
  {
    id: 'publish-short-topic',
    name: 'protocol.mqttSn.example.publishShortTopic.name',
    // TopicIdType 0b10: iki bayt SAYI değil, iki ASCII karakter ("ab").
    bytes: Uint8Array.from(
      message(MSG_PUBLISH, [TOPIC_ID_TYPE_SHORT_NAME, ...ascii('ab'), ...word(7), ...ascii('on')]),
    ),
    description: 'protocol.mqttSn.example.publishShortTopic.description',
    expectedValid: true,
  },
  {
    id: 'extended-length',
    name: 'protocol.mqttSn.example.extendedLength.name',
    // Üç baytlık uzunluk biçimi: 0x01 + 16 bit. VBI olarak okunursa "1" çıkar.
    bytes: Uint8Array.from([
      EXTENDED_LENGTH_PREFIX,
      // 3 (uzunluk) + 1 (tip) + 1 (flags) + 2 (topic) + 2 (msgId) + 259 = 268.
      ...word(268),
      MSG_PUBLISH,
      1 << FLAG_QOS_SHIFT,
      ...word(0x0012),
      ...word(9),
      ...new Array<number>(259).fill(0x5a),
    ]),
    description: 'protocol.mqttSn.example.extendedLength.description',
    expectedValid: true,
  },
  {
    id: 'length-too-small',
    name: 'protocol.mqttSn.example.lengthTooSmall.name',
    // Uzunluk 1: kendi baytını bile karşılamıyor. Hata yolu.
    bytes: Uint8Array.from([0x01, 0x00, 0x00, MSG_PINGREQ]),
    description: 'protocol.mqttSn.example.lengthTooSmall.description',
    expectedValid: false,
  },
];

export const mqttSnPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: mqttSnParser,
  documentation: {
    summary: 'protocol.mqttSn.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
