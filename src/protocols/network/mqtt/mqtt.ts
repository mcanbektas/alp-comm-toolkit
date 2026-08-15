/**
 * MQTT — TCP üzerinde broker aracılı yayınla/abone-ol (publish/subscribe)
 * mesajlaşma protokolü. OASIS MQTT Version 5.0 (Properties, Reason Code
 * yapıları) ve MQTT Version 3.1.1 (temel CONNECT/PUBLISH şekli, ikisinin ortak
 * paydası) standartlarına birebir dayanır — ikisi de kamuya açık OASIS
 * belgeleridir (brief-faz10-dalga4.md "Kaynak uyarısı" tablosu).
 *
 * ── GİRDİ: TEK KONTROL PAKETİ, TCP STREAM BİRLEŞTİRME YOK ───────────────────
 * MQTT teli TCP BYTE STREAM üzerinde taşınır (`tcp.ts`in "TCP paket değil byte
 * stream verir" notuyla aynı sınır). Bu motor bir TCP segmentini değil, ZATEN
 * segment sınırlarından ayrıştırılmış TEK bir MQTT Control Packet'in baytlarını
 * bekler — dalga 1 çizgisi ("motorlar zincir kurmaz", karar 1) burada da
 * geçerli: birden çok TCP segmentine yayılmış bir paketi birleştirmek stream
 * katmanının işidir, parser'a girmez.
 *
 * ── SÜRÜM DALLANMASI (karar 4, dalga başında onaylandı) ──────────────────────
 * TEK parser. CONNECT paketinde Protocol Level baytı (4 = v3.1.1, 5 = v5)
 * OKUNUR ve adlandırılır — MAVLink'in magic baytına göre v1/v2 dallanmasıyla
 * AYNI ailede bir karar (bkz. `mavlink.ts` dosya başı) ama farklı konumda: v1/v2
 * dallanması HEADER UZUNLUĞUNU belirler, MQTT'de Level yalnız Properties'in
 * VARLIĞINI belirler — header şekli (Fixed Header + Remaining Length) sürümden
 * BAĞIMSIZDIR.
 *
 * v5'e özgü Properties alanı YALNIZ CONNECT paketinde Level=5 görüldüğünde
 * KESİN olarak çözülür (zorunlu — CONNECT + Level=5 varsa Properties spec
 * gereği HER ZAMAN vardır, en azından "Property Length = 0" olarak). DİĞER
 * paket tiplerinde (PUBLISH, SUBSCRIBE, …) bu motor tek-paket parser'ıdır,
 * önceki bir CONNECT'i HİÇ hatırlamaz (oturum durumu tutulmaz — dalga 1
 * kararıyla tutarlı, `isotp.ts`nin "oturum/durum makinesi tutulmaz" kararıyla
 * aynı sınır). Bu yüzden PUBLISH'te Properties alanı VARSA YİNE DE v5 TLV
 * formatıyla çözülmeye ÇALIŞILIR — ama açık bir "sürüm varsayımı, doğrulanamadı"
 * uyarısıyla (`WARN_PROPERTIES_VERSION_ASSUMED`), ham göstermek yerine
 * dene-ama-uyar: v5 Properties TLV yapısı OASIS'te kamuya açık ve deterministik,
 * bu yüzden Property Length'in kalan tampona SIĞMADIĞI durumda motor bu
 * yorumu SESSİZCE TERK EDER ve baytları Payload sayar — yanlış bir zorlama
 * yerine "sığmıyorsa properties değildir" sezgisi kullanılır; sığan ama
 * gerçekte properties OLMAYAN nadir durumlar (payload'ın ilk baytları
 * tesadüfen geçerli bir TLV gibi görünürse) spec'in kendi öngördüğü riskitir
 * (brief karar 4: "yanlış parse edilirse zaten decode hatası/tutarsızlık
 * ortaya çıkar").
 *
 * AUTH (tip 15) yalnız v5'te tanımlıdır ama STANDALONE bir AUTH paketinden
 * hangi MQTT sürümüyle konuşulduğu BİLİNEMEZ (yukarıdaki "oturum durumu
 * tutulmaz" kararı) — bu yüzden AUTH her bağlamda aynı şekilde adlandırılır,
 * "v3.1.1 bağlamında görülürse uyar" fiilen uygulanamaz bir koşuldur (CONNECT
 * dışı paketlerde sürüm bilgisi hiç yok).
 *
 * ── VARIABLE BYTE INTEGER: TEK YARDIMCI, İKİ KULLANIM YERİ ───────────────────
 * `mqttVbi.ts`teki `decodeVariableByteInteger` hem Fixed Header'ın "Remaining
 * Length" alanında HEM DE v5 Properties bloğunun "Property Length" alanında
 * AYNI ÇAĞRIYLA kullanılır — iki ayrı kopya YOK (dosya başı tuzak notu,
 * brief-faz10-dalga4.md). En çok 4 bayt; beşinci bayt hâlâ devam biti taşırsa
 * `'malformed'` — Remaining Length için bu KISMİ ÇÖZÜM + hata olarak modellenir
 * (fixed header yine gösterilir, spec §47 "hatalı veride uygulamayı çökertme"),
 * Properties için ise yukarıdaki "sığmıyorsa vazgeç" sezgisiyle SESSİZCE
 * atlanır (çünkü orada zaten yalnız TAHMİN ediliyordu).
 *
 * ── PAKET TİPİ VE FLAGS ───────────────────────────────────────────────────────
 * Üst nibble (bit 7-4) paket tipi: 1-15 arası OASIS'in verdiği 15 isimden biri
 * (CONNECT…AUTH); 0 REZERVE'dir ve HATA üretir ama çerçeve yine de (Remaining
 * Length çözülebiliyorsa) ham bir "Body" alanıyla gösterilir — ISO-TP'nin
 * bilinmeyen PCI tipi kararıyla aynı ton (bkz. `isotp.ts` `decodeUnknownPciType`).
 * Alt nibble (bit 3-0) PUBLISH'te DUP/QoS/RETAIN bit alanlarına açılır
 * (QoS=3 → HATA, OASIS'in "reserved" değeri); diğer ON DÖRT tipin SABİT bir
 * flags değeri vardır (ör. PUBREL/SUBSCRIBE/UNSUBSCRIBE = 0b0010, gerisi
 * 0b0000) — ihlal HATA değil UYARI olarak basılır (çerçeve yine çözülmeye
 * devam eder, brief karar 4 tonu).
 *
 * ── VARIABLE HEADER: TİPE GÖRE DALLANIR ───────────────────────────────────────
 * §28.5 asgari kümesi CONNECT ve PUBLISH'i şart koşar, ikisi de TAM çözülür.
 * Packet Identifier taşıyan sekiz tip (PUBACK/PUBREC/PUBREL/PUBCOMP/SUBSCRIBE/
 * SUBACK/UNSUBSCRIBE/UNSUBACK) yalnız Packet Identifier'ı adlandırır, gerisini
 * ham "Body" bırakır (brief: "gerisi bonus, zorunlu değil"). CONNACK/PINGREQ/
 * PINGRESP/DISCONNECT/AUTH ve rezerve tip HİÇ alan adlandırmaz, tamamı ham
 * "Body".
 *
 * ── v5 PROPERTIES TLV: DAR, OASI'NİN KENDİ TABLOSUYLA SINIRLI ────────────────
 * Yalnız OASIS MQTT 5.0 §2.2.2.2 Property tablosundaki YİRMİ ALTI id
 * adlandırılır (`PROPERTY_DEFINITIONS`, dosyanın alt bölümünde tek tek
 * numaralandırılır). Tanınmayan bir id görülünce KALAN TÜM properties bloğu
 * tek bir ham alan olarak gösterilir + uyarı — id'den sonraki tipin ne kadar
 * bayt tuttuğunu bilmeden döngüye DEVAM ETMEK imkânsızdır (TLV'nin type'ı
 * length taşımaz, id'ye bakılarak BİLİNİR — bilinmeyen id demek "bundan
 * sonrası okunamaz" demektir).
 *
 * ── KAPSAM DIŞI (bilinçli) ────────────────────────────────────────────────────
 * • QoS 1/2 ACK zinciri, retained message durumu, keep-alive zaman aşımı,
 *   topic wildcard eşleşmesi: ÇOK PAKETLİK oturum/durum ister, analyzer işi.
 * • CONNACK Reason Code / dönüş kodu tablosu, SUBACK/UNSUBACK Reason Code
 *   listesi: brief'te bonus, bu turda YAZILMADI (yalnız Packet Identifier).
 * • Password UTF-8 olarak DEKODE EDİLMEZ — spec Binary Data tipinde tanımlar,
 *   ham bayt olarak gösterilir (kullanıcı sırrına anlam yakıştırmamak için).
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

import { decodeVariableByteInteger } from './mqttVbi';

const PROTOCOL_ID = 'mqtt';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'MQTT';

const PACKET_TYPE_CONNECT = 1;
const PACKET_TYPE_PUBLISH = 3;

/** OASIS'in verdiği 15 paket tipi adı (spec §2.1.2 Tablo) — dar, uydurma yasak. */
const PACKET_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'CONNECT'],
  [2, 'CONNACK'],
  [3, 'PUBLISH'],
  [4, 'PUBACK'],
  [5, 'PUBREC'],
  [6, 'PUBREL'],
  [7, 'PUBCOMP'],
  [8, 'SUBSCRIBE'],
  [9, 'SUBACK'],
  [10, 'UNSUBSCRIBE'],
  [11, 'UNSUBACK'],
  [12, 'PINGREQ'],
  [13, 'PINGRESP'],
  [14, 'DISCONNECT'],
  [15, 'AUTH'],
]);

/** Packet Identifier taşıyan (ve yalnız onu adlandırdığımız) sekiz tip. */
const PACKET_ID_ONLY_TYPES: ReadonlySet<number> = new Set([4, 5, 6, 7, 8, 9, 10, 11]);

/**
 * PUBLISH DIŞINDAKİ ON DÖRT tipin sabit flags nibble'ı (spec §2.1.3 Tablo).
 * İhlal hata değil uyarıdır (dosya başı).
 */
const EXPECTED_FIXED_FLAGS: ReadonlyMap<number, number> = new Map([
  [1, 0b0000], // CONNECT
  [2, 0b0000], // CONNACK
  [4, 0b0000], // PUBACK
  [5, 0b0000], // PUBREC
  [6, 0b0010], // PUBREL
  [7, 0b0000], // PUBCOMP
  [8, 0b0010], // SUBSCRIBE
  [9, 0b0000], // SUBACK
  [10, 0b0010], // UNSUBSCRIBE
  [11, 0b0000], // UNSUBACK
  [12, 0b0000], // PINGREQ
  [13, 0b0000], // PINGRESP
  [14, 0b0000], // DISCONNECT
  [15, 0b0000], // AUTH
]);

type PropertyValueType = 'byte' | 'twoByteInt' | 'fourByteInt' | 'utf8String' | 'utf8StringPair' | 'binaryData';

interface PropertyDefinition {
  readonly name: string;
  readonly type: PropertyValueType;
}

/**
 * OASIS MQTT 5.0 §2.2.2.2 Property tablosunun TAMAMI — yirmi altı id. Dosya
 * başı "v5 PROPERTIES TLV" bölümüne bak: bu liste DIŞINDA hiçbir id adlandırılmaz.
 */
const PROPERTY_DEFINITIONS: ReadonlyMap<number, PropertyDefinition> = new Map([
  [1, { name: 'Payload Format Indicator', type: 'byte' }],
  [2, { name: 'Message Expiry Interval', type: 'fourByteInt' }],
  [3, { name: 'Content Type', type: 'utf8String' }],
  [8, { name: 'Response Topic', type: 'utf8String' }],
  [9, { name: 'Correlation Data', type: 'binaryData' }],
  [17, { name: 'Session Expiry Interval', type: 'fourByteInt' }],
  [18, { name: 'Assigned Client Identifier', type: 'utf8String' }],
  [19, { name: 'Server Keep Alive', type: 'twoByteInt' }],
  [21, { name: 'Authentication Method', type: 'utf8String' }],
  [22, { name: 'Authentication Data', type: 'binaryData' }],
  [23, { name: 'Request Problem Information', type: 'byte' }],
  [24, { name: 'Will Delay Interval', type: 'fourByteInt' }],
  [25, { name: 'Request Response Information', type: 'byte' }],
  [26, { name: 'Response Information', type: 'utf8String' }],
  [28, { name: 'Server Reference', type: 'utf8String' }],
  [31, { name: 'Reason String', type: 'utf8String' }],
  [33, { name: 'Receive Maximum', type: 'twoByteInt' }],
  [34, { name: 'Topic Alias Maximum', type: 'twoByteInt' }],
  [35, { name: 'Topic Alias', type: 'twoByteInt' }],
  [36, { name: 'Maximum QoS', type: 'byte' }],
  [37, { name: 'Retain Available', type: 'byte' }],
  [38, { name: 'User Property', type: 'utf8StringPair' }],
  [39, { name: 'Maximum Packet Size', type: 'fourByteInt' }],
  [40, { name: 'Wildcard Subscription Available', type: 'byte' }],
  [41, { name: 'Subscription Identifiers Available', type: 'byte' }],
  [42, { name: 'Shared Subscription Available', type: 'byte' }],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.mqtt.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.mqtt.error.frameTooLong';
const ERROR_ABORTED = 'protocol.mqtt.error.aborted';
const ERROR_RESERVED_PACKET_TYPE = 'protocol.mqtt.error.reservedPacketType';
const ERROR_INVALID_QOS = 'protocol.mqtt.error.invalidQos';
const ERROR_REMAINING_LENGTH_MALFORMED = 'protocol.mqtt.error.remainingLengthMalformed';
const ERROR_REMAINING_LENGTH_TRUNCATED = 'protocol.mqtt.error.remainingLengthTruncated';
const ERROR_BODY_TRUNCATED = 'protocol.mqtt.error.bodyTruncated';
const ERROR_CONNECT_FIELD_TRUNCATED = 'protocol.mqtt.error.connectFieldTruncated';
const ERROR_CONNECT_PROPERTIES_TRUNCATED = 'protocol.mqtt.error.connectPropertiesTruncated';
const ERROR_PUBLISH_FIELD_TRUNCATED = 'protocol.mqtt.error.publishFieldTruncated';
const ERROR_PACKET_ID_TRUNCATED = 'protocol.mqtt.error.packetIdentifierTruncated';

const WARN_FIXED_FLAGS_VIOLATION = 'protocol.mqtt.warning.fixedFlagsViolation';
const WARN_UNKNOWN_PROTOCOL_LEVEL = 'protocol.mqtt.warning.unknownProtocolLevel';
const WARN_UNEXPECTED_PROTOCOL_NAME = 'protocol.mqtt.warning.unexpectedProtocolName';
const WARN_CONNECT_FLAGS_RESERVED_BIT = 'protocol.mqtt.warning.connectFlagsReservedBit';
const WARN_UNKNOWN_PROPERTY_ID = 'protocol.mqtt.warning.unknownPropertyId';
const WARN_PROPERTY_TRUNCATED = 'protocol.mqtt.warning.propertyTruncated';
const WARN_PROPERTIES_VERSION_ASSUMED = 'protocol.mqtt.warning.propertiesVersionAssumed';
const WARN_TRAILING_BYTES = 'protocol.mqtt.warning.trailingBytes';

const SUMMARY_FRAME = 'protocol.mqtt.summary.frame';

const UTF8_DECODER = new TextDecoder('utf-8');

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** 32-bit alan: fourByteInt property tipi. Sol kaydırma taşabileceği için `>>> 0`. */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

/** Sıralı okuma imleci — `data` HER ZAMAN `totalFrameLength`e sınırlanmış bir
 * `subarray` olduğundan (bkz. `parseMqttFrame`), indeksler orijinal tamponla
 * BİREBİR aynı kalır; ayrı bir offset düzeltmesi gerekmez. */
interface Cursor {
  readonly data: Uint8Array;
  pos: number;
}

function cursorRemaining(cursor: Cursor): number {
  return cursor.data.length - cursor.pos;
}

function readCursorUint8(cursor: Cursor): number | undefined {
  if (cursorRemaining(cursor) < 1) return undefined;
  const value = byteAt(cursor.data, cursor.pos);
  cursor.pos += 1;
  return value;
}

function readCursorUint16BE(cursor: Cursor): number | undefined {
  if (cursorRemaining(cursor) < 2) return undefined;
  const value = readUint16BE(cursor.data, cursor.pos);
  cursor.pos += 2;
  return value;
}

function readCursorBytes(cursor: Cursor, length: number): Uint8Array | undefined {
  if (cursorRemaining(cursor) < length) return undefined;
  const bytes = cursor.data.slice(cursor.pos, cursor.pos + length);
  cursor.pos += length;
  return bytes;
}

interface Utf8StringRead {
  readonly text: string;
  readonly offset: number;
  readonly length: number;
}

/** UTF-8 Encoded String (spec §1.5.4): 2 baytlık BE uzunluk + UTF-8 bayt dizisi. */
function readCursorUtf8String(cursor: Cursor): Utf8StringRead | undefined {
  const offset = cursor.pos;
  const stringLength = readCursorUint16BE(cursor);
  if (stringLength === undefined) return undefined;
  const bytes = readCursorBytes(cursor, stringLength);
  if (bytes === undefined) return undefined;
  return { text: UTF8_DECODER.decode(bytes), offset, length: 2 + stringLength };
}

interface PropertyValueDecode {
  readonly rawValue?: bigint | number | string;
  readonly physicalValue?: bigint | number | string;
  readonly length: number;
}

/**
 * Bir property değerini TİPİNE göre okur. `end`i aşarsa `undefined` — çağıran
 * bunu "bilinen id ama değer sığmıyor" olarak yorumlar (dosya başı).
 */
function readPropertyValue(
  data: Uint8Array,
  start: number,
  end: number,
  type: PropertyValueType,
): PropertyValueDecode | undefined {
  switch (type) {
    case 'byte': {
      if (start + 1 > end) return undefined;
      return { rawValue: byteAt(data, start), length: 1 };
    }
    case 'twoByteInt': {
      if (start + 2 > end) return undefined;
      return { rawValue: readUint16BE(data, start), length: 2 };
    }
    case 'fourByteInt': {
      if (start + 4 > end) return undefined;
      return { rawValue: readUint32BE(data, start), length: 4 };
    }
    case 'utf8String': {
      if (start + 2 > end) return undefined;
      const stringLength = readUint16BE(data, start);
      if (start + 2 + stringLength > end) return undefined;
      const bytes = data.slice(start + 2, start + 2 + stringLength);
      return { rawValue: UTF8_DECODER.decode(bytes), length: 2 + stringLength };
    }
    case 'utf8StringPair': {
      const key = readPropertyValue(data, start, end, 'utf8String');
      if (key === undefined) return undefined;
      const value = readPropertyValue(data, start + key.length, end, 'utf8String');
      if (value === undefined) return undefined;
      return { rawValue: `${String(key.rawValue)}=${String(value.rawValue)}`, length: key.length + value.length };
    }
    case 'binaryData': {
      if (start + 2 > end) return undefined;
      const dataLength = readUint16BE(data, start);
      if (start + 2 + dataLength > end) return undefined;
      return { physicalValue: dataLength, length: 2 + dataLength };
    }
  }
}

interface PropertiesParseOutcome {
  readonly lengthField: ParsedField;
  readonly propertyFields: ParsedField[];
  readonly warnings: ProtocolWarning[];
}

/**
 * Properties Length (VBI) + tekrar eden [Property Identifier (1 bayt, VBI
 * DEĞİL) + tip-bağımlı değer] döngüsü. Tanınmayan id'de kalan blok ham +
 * uyarı olarak gösterilip döngü DURDURULUR (dosya başı: tip bilinmeden
 * ilerlemek imkânsız). Declared uzunluk `cursor.data`ya sığmazsa `undefined`
 * döner — çağıran (CONNECT'te zorunlu, PUBLISH'te sezgisel) buna göre karar verir.
 */
function tryParseProperties(cursor: Cursor, idPrefix: string): PropertiesParseOutcome | undefined {
  const vbiStart = cursor.pos;
  const vbi = decodeVariableByteInteger(cursor.data, vbiStart);
  if (!vbi.success) return undefined;

  const propertiesStart = vbiStart + vbi.length;
  const propertiesEnd = propertiesStart + vbi.value;
  if (propertiesEnd > cursor.data.length) return undefined;

  const lengthField: ParsedField = {
    id: `${idPrefix}properties-length`,
    name: 'Properties Length',
    offset: vbiStart,
    length: vbi.length,
    rawBytes: cursor.data.slice(vbiStart, propertiesStart),
    rawValue: vbi.value,
    unit: 'B',
    valid: true,
    warnings: [],
  };

  const propertyFields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  let pos = propertiesStart;

  while (pos < propertiesEnd) {
    const idOffset = pos;
    const idByte = byteAt(cursor.data, idOffset);
    const definition = PROPERTY_DEFINITIONS.get(idByte);

    if (definition === undefined) {
      const remaining = cursor.data.slice(idOffset, propertiesEnd);
      propertyFields.push({
        id: `${idPrefix}property-unknown-${String(idOffset)}`,
        name: 'Unknown Property',
        offset: idOffset,
        length: remaining.length,
        rawBytes: remaining,
        valid: true,
        warnings: [WARN_UNKNOWN_PROPERTY_ID],
      });
      warnings.push(toProtocolWarning(WARN_UNKNOWN_PROPERTY_ID));
      break;
    }

    const valueStart = idOffset + 1;
    const decoded = readPropertyValue(cursor.data, valueStart, propertiesEnd, definition.type);
    if (decoded === undefined) {
      const remaining = cursor.data.slice(idOffset, propertiesEnd);
      propertyFields.push({
        id: `${idPrefix}property-truncated-${String(idOffset)}`,
        name: definition.name,
        offset: idOffset,
        length: remaining.length,
        rawBytes: remaining,
        valid: false,
        warnings: [WARN_PROPERTY_TRUNCATED],
      });
      warnings.push(toProtocolWarning(WARN_PROPERTY_TRUNCATED));
      break;
    }

    const field: ParsedField = {
      id: `${idPrefix}property-${String(idByte)}-${String(idOffset)}`,
      name: definition.name,
      offset: idOffset,
      length: 1 + decoded.length,
      rawBytes: cursor.data.slice(idOffset, valueStart + decoded.length),
      valid: true,
      warnings: [],
    };
    if (decoded.rawValue !== undefined) field.rawValue = decoded.rawValue;
    if (decoded.physicalValue !== undefined) field.physicalValue = decoded.physicalValue;
    propertyFields.push(field);

    pos = valueStart + decoded.length;
  }

  cursor.pos = propertiesEnd;
  return { lengthField, propertyFields, warnings };
}

function pushBodyField(cursor: Cursor, fields: ParsedField[]): void {
  if (cursor.pos >= cursor.data.length) return;
  const body = cursor.data.slice(cursor.pos, cursor.data.length);
  fields.push({
    id: 'body',
    name: 'Body',
    offset: cursor.pos,
    length: body.length,
    rawBytes: body,
    unit: 'B',
    valid: true,
    warnings: [],
  });
}

function pushTrailingField(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const trailing = data.slice(offset);
  fields.push({
    id: 'trailing-data',
    name: 'Trailing Data',
    offset,
    length: trailing.length,
    rawBytes: trailing,
    valid: false,
    warnings: [WARN_TRAILING_BYTES],
  });
  warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
}

function connectFlagBitField(id: string, name: string, offset: number, rawBytes: Uint8Array, value: number): ParsedField {
  return { id, name, offset, length: 1, rawBytes, rawValue: value, valid: true, warnings: [] };
}

/**
 * CONNECT değişken başlık + payload'ı çözer (spec §3.1). Herhangi bir alan
 * tamponda eksikse `ERROR_CONNECT_FIELD_TRUNCATED` basılır ve fonksiyon durur
 * — o ana kadar üretilen alanlar (kısmi çözüm) kalır.
 */
function parseConnectBody(
  cursor: Cursor,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  const protocolName = readCursorUtf8String(cursor);
  if (protocolName === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  const protocolNameField: ParsedField = {
    id: 'protocol-name',
    name: 'Protocol Name',
    offset: protocolName.offset,
    length: protocolName.length,
    rawBytes: cursor.data.slice(protocolName.offset, protocolName.offset + protocolName.length),
    rawValue: protocolName.text,
    valid: true,
    warnings: [],
  };
  if (protocolName.text !== 'MQTT') {
    protocolNameField.warnings.push(WARN_UNEXPECTED_PROTOCOL_NAME);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_PROTOCOL_NAME));
  }
  fields.push(protocolNameField);

  const levelOffset = cursor.pos;
  const level = readCursorUint8(cursor);
  if (level === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  const levelName = level === 4 ? 'MQTT 3.1.1' : level === 5 ? 'MQTT 5.0' : undefined;
  const levelField: ParsedField = {
    id: 'protocol-level',
    name: 'Protocol Level',
    offset: levelOffset,
    length: 1,
    rawBytes: cursor.data.slice(levelOffset, levelOffset + 1),
    rawValue: level,
    valid: levelName !== undefined,
    warnings: [],
  };
  if (levelName !== undefined) {
    levelField.physicalValue = levelName;
  } else {
    levelField.warnings.push(WARN_UNKNOWN_PROTOCOL_LEVEL);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_PROTOCOL_LEVEL));
  }
  fields.push(levelField);

  const flagsOffset = cursor.pos;
  const connectFlagsByte = readCursorUint8(cursor);
  if (connectFlagsByte === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  const flagsBytes = cursor.data.slice(flagsOffset, flagsOffset + 1);
  const userNameFlag = (connectFlagsByte & 0x80) !== 0;
  const passwordFlag = (connectFlagsByte & 0x40) !== 0;
  const willRetain = (connectFlagsByte & 0x20) !== 0;
  const willQos = (connectFlagsByte & 0x18) >>> 3;
  const willFlag = (connectFlagsByte & 0x04) !== 0;
  const cleanStartOrSession = (connectFlagsByte & 0x02) !== 0;
  const reservedBit = connectFlagsByte & 0x01;

  fields.push(connectFlagBitField('connect-flag-username', 'User Name Flag', flagsOffset, flagsBytes, userNameFlag ? 1 : 0));
  fields.push(connectFlagBitField('connect-flag-password', 'Password Flag', flagsOffset, flagsBytes, passwordFlag ? 1 : 0));
  fields.push(connectFlagBitField('connect-flag-will-retain', 'Will Retain', flagsOffset, flagsBytes, willRetain ? 1 : 0));
  fields.push({
    id: 'connect-flag-will-qos',
    name: 'Will QoS',
    offset: flagsOffset,
    length: 1,
    rawBytes: flagsBytes,
    rawValue: willQos,
    valid: true,
    warnings: [],
  });
  fields.push(connectFlagBitField('connect-flag-will', 'Will Flag', flagsOffset, flagsBytes, willFlag ? 1 : 0));
  fields.push(
    connectFlagBitField(
      'connect-flag-clean-start',
      level === 5 ? 'Clean Start' : 'Clean Session',
      flagsOffset,
      flagsBytes,
      cleanStartOrSession ? 1 : 0,
    ),
  );
  const reservedField: ParsedField = {
    id: 'connect-flag-reserved',
    name: 'Reserved',
    offset: flagsOffset,
    length: 1,
    rawBytes: flagsBytes,
    rawValue: reservedBit,
    valid: reservedBit === 0,
    warnings: [],
  };
  if (reservedBit !== 0) {
    reservedField.warnings.push(WARN_CONNECT_FLAGS_RESERVED_BIT);
    warnings.push(toProtocolWarning(WARN_CONNECT_FLAGS_RESERVED_BIT));
  }
  fields.push(reservedField);

  const keepAliveOffset = cursor.pos;
  const keepAlive = readCursorUint16BE(cursor);
  if (keepAlive === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  fields.push({
    id: 'keep-alive',
    name: 'Keep Alive',
    offset: keepAliveOffset,
    length: 2,
    rawBytes: cursor.data.slice(keepAliveOffset, keepAliveOffset + 2),
    rawValue: keepAlive,
    unit: 's',
    valid: true,
    warnings: [],
  });

  // v5'e özgü Properties — YALNIZ Level=5 KESİN olarak görüldüğünde (dosya başı, karar 4).
  if (level === 5) {
    const properties = tryParseProperties(cursor, '');
    if (properties === undefined) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_CONNECT_PROPERTIES_TRUNCATED,
        offset: cursor.pos,
        length: 0,
      });
      return;
    }
    fields.push(properties.lengthField, ...properties.propertyFields);
    warnings.push(...properties.warnings);
  }

  const clientIdentifier = readCursorUtf8String(cursor);
  if (clientIdentifier === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  fields.push({
    id: 'client-identifier',
    name: 'Client Identifier',
    offset: clientIdentifier.offset,
    length: clientIdentifier.length,
    rawBytes: cursor.data.slice(clientIdentifier.offset, clientIdentifier.offset + clientIdentifier.length),
    rawValue: clientIdentifier.text,
    valid: true,
    warnings: [],
  });

  if (willFlag) {
    if (level === 5) {
      const willProperties = tryParseProperties(cursor, 'will-');
      if (willProperties === undefined) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_CONNECT_PROPERTIES_TRUNCATED,
          offset: cursor.pos,
          length: 0,
        });
        return;
      }
      fields.push(willProperties.lengthField, ...willProperties.propertyFields);
      warnings.push(...willProperties.warnings);
    }

    const willTopic = readCursorUtf8String(cursor);
    if (willTopic === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    fields.push({
      id: 'will-topic',
      name: 'Will Topic',
      offset: willTopic.offset,
      length: willTopic.length,
      rawBytes: cursor.data.slice(willTopic.offset, willTopic.offset + willTopic.length),
      rawValue: willTopic.text,
      valid: true,
      warnings: [],
    });

    const willPayloadOffset = cursor.pos;
    const willPayloadLength = readCursorUint16BE(cursor);
    if (willPayloadLength === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    const willPayloadBytes = readCursorBytes(cursor, willPayloadLength);
    if (willPayloadBytes === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    fields.push({
      id: 'will-payload',
      name: 'Will Payload',
      offset: willPayloadOffset,
      length: 2 + willPayloadLength,
      rawBytes: cursor.data.slice(willPayloadOffset, willPayloadOffset + 2 + willPayloadLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  if (userNameFlag) {
    const userName = readCursorUtf8String(cursor);
    if (userName === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    fields.push({
      id: 'user-name',
      name: 'User Name',
      offset: userName.offset,
      length: userName.length,
      rawBytes: cursor.data.slice(userName.offset, userName.offset + userName.length),
      rawValue: userName.text,
      valid: true,
      warnings: [],
    });
  }

  if (passwordFlag) {
    // Spec Password'ü Binary Data olarak tanımlar — UTF-8 metin gibi dekode
    // EDİLMEZ (dosya başı, kullanıcı sırrına anlam yakıştırılmaz).
    const passwordOffset = cursor.pos;
    const passwordLength = readCursorUint16BE(cursor);
    if (passwordLength === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    const passwordBytes = readCursorBytes(cursor, passwordLength);
    if (passwordBytes === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_CONNECT_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    fields.push({
      id: 'password',
      name: 'Password',
      offset: passwordOffset,
      length: 2 + passwordLength,
      rawBytes: cursor.data.slice(passwordOffset, passwordOffset + 2 + passwordLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

/**
 * PUBLISH değişken başlık + payload'ı çözer (spec §3.3). Properties'i her
 * zaman DENER — dosya başı "SÜRÜM DALLANMASI" bölümündeki sezgiyle: yalnız
 * declared uzunluk kalan tampona SIĞARSA "Properties" olarak etiketlenir
 * (`WARN_PROPERTIES_VERSION_ASSUMED` ile), sığmazsa sessizce vazgeçilir ve
 * kalan tüm baytlar Payload sayılır.
 */
function parsePublishBody(
  cursor: Cursor,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  qos: number,
): void {
  const topicName = readCursorUtf8String(cursor);
  if (topicName === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_PUBLISH_FIELD_TRUNCATED, offset: cursor.pos, length: 0 });
    return;
  }
  fields.push({
    id: 'topic-name',
    name: 'Topic Name',
    offset: topicName.offset,
    length: topicName.length,
    rawBytes: cursor.data.slice(topicName.offset, topicName.offset + topicName.length),
    rawValue: topicName.text,
    valid: true,
    warnings: [],
  });

  if (qos > 0) {
    const packetIdOffset = cursor.pos;
    const packetId = readCursorUint16BE(cursor);
    if (packetId === undefined) {
      errors.push({ code: 'truncated-frame', message: ERROR_PACKET_ID_TRUNCATED, offset: cursor.pos, length: 0 });
      return;
    }
    fields.push({
      id: 'packet-identifier',
      name: 'Packet Identifier',
      offset: packetIdOffset,
      length: 2,
      rawBytes: cursor.data.slice(packetIdOffset, packetIdOffset + 2),
      rawValue: packetId,
      valid: true,
      warnings: [],
    });
  }

  const properties = tryParseProperties(cursor, '');
  if (properties !== undefined) {
    properties.lengthField.warnings.push(WARN_PROPERTIES_VERSION_ASSUMED);
    for (const propertyField of properties.propertyFields) {
      propertyField.warnings.push(WARN_PROPERTIES_VERSION_ASSUMED);
    }
    fields.push(properties.lengthField, ...properties.propertyFields);
    warnings.push(...properties.warnings, toProtocolWarning(WARN_PROPERTIES_VERSION_ASSUMED));
  }

  if (cursor.pos < cursor.data.length) {
    const payload = cursor.data.slice(cursor.pos, cursor.data.length);
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: cursor.pos,
      length: payload.length,
      rawBytes: payload,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

function parsePacketIdBody(
  cursor: Cursor,
  fields: ParsedField[],
  errors: ProtocolError[],
): void {
  const offset = cursor.pos;
  const packetId = readCursorUint16BE(cursor);
  if (packetId === undefined) {
    errors.push({ code: 'truncated-frame', message: ERROR_PACKET_ID_TRUNCATED, offset, length: cursorRemaining({ data: cursor.data, pos: offset }) });
    return;
  }
  fields.push({
    id: 'packet-identifier',
    name: 'Packet Identifier',
    offset,
    length: 2,
    rawBytes: cursor.data.slice(offset, offset + 2),
    rawValue: packetId,
    valid: true,
    warnings: [],
  });
  pushBodyField(cursor, fields);
}

interface FixedHeaderResult {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
  readonly packetType: number;
  readonly packetTypeValid: boolean;
  readonly qos: number | undefined;
}

/** Fixed Header'ın (byte 0) paket tipi + flags kısmını çözer — Remaining Length HARİÇ. */
function buildFixedHeaderFields(data: Uint8Array): FixedHeaderResult {
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const firstByte = byteAt(data, 0);
  const packetType = (firstByte >>> 4) & 0x0f;
  const flagsNibble = firstByte & 0x0f;
  const firstByteBytes = data.slice(0, 1);

  const packetTypeName = PACKET_TYPE_NAMES.get(packetType);
  const packetTypeValid = packetTypeName !== undefined;
  const packetTypeField: ParsedField = {
    id: 'packet-type',
    name: 'Packet Type',
    offset: 0,
    length: 1,
    rawBytes: firstByteBytes,
    rawValue: packetType,
    valid: packetTypeValid,
    warnings: [],
  };
  if (packetTypeValid) {
    // Protokol terimi — veridir, çevrilmez (CLAUDE.md).
    packetTypeField.physicalValue = packetTypeName;
  } else {
    packetTypeField.warnings.push(ERROR_RESERVED_PACKET_TYPE);
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_RESERVED_PACKET_TYPE,
      offset: 0,
      length: 1,
      details: { packetType },
    });
  }
  fields.push(packetTypeField);

  let qos: number | undefined;
  if (packetType === PACKET_TYPE_PUBLISH) {
    const dup = (flagsNibble & 0x08) !== 0 ? 1 : 0;
    const qosValue = (flagsNibble & 0x06) >>> 1;
    const retain = (flagsNibble & 0x01) !== 0 ? 1 : 0;
    qos = qosValue;

    fields.push({
      id: 'publish-flag-dup',
      name: 'DUP',
      offset: 0,
      length: 1,
      rawBytes: firstByteBytes,
      rawValue: dup,
      valid: true,
      warnings: [],
    });

    const qosField: ParsedField = {
      id: 'publish-flag-qos',
      name: 'QoS',
      offset: 0,
      length: 1,
      rawBytes: firstByteBytes,
      rawValue: qosValue,
      valid: qosValue !== 3,
      warnings: [],
    };
    if (qosValue === 3) {
      qosField.warnings.push(ERROR_INVALID_QOS);
      errors.push({ code: 'value-out-of-range', message: ERROR_INVALID_QOS, offset: 0, length: 1, details: { qos: qosValue } });
    }
    fields.push(qosField);

    fields.push({
      id: 'publish-flag-retain',
      name: 'RETAIN',
      offset: 0,
      length: 1,
      rawBytes: firstByteBytes,
      rawValue: retain,
      valid: true,
      warnings: [],
    });
  } else {
    const expected = EXPECTED_FIXED_FLAGS.get(packetType);
    const flagsField: ParsedField = {
      id: 'flags',
      name: 'Flags',
      offset: 0,
      length: 1,
      rawBytes: firstByteBytes,
      rawValue: flagsNibble,
      valid: true,
      warnings: [],
    };
    if (expected !== undefined && expected !== flagsNibble) {
      flagsField.warnings.push(WARN_FIXED_FLAGS_VIOLATION);
      warnings.push(toProtocolWarning(WARN_FIXED_FLAGS_VIOLATION));
    }
    fields.push(flagsField);
  }

  return { fields, warnings, errors, packetType, packetTypeValid, qos };
}

interface MqttParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

export type MqttFrameMetadata = {
  packetType: number;
  packetTypeName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: MqttParseOptions,
  metadata: MqttFrameMetadata,
): ParseResult {
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

  return { success: true, frame, consumedBytes: data.length };
}

function parseMqttFrame(data: Uint8Array, options: MqttParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  // En az Fixed Header baytı (tip+flags) + Remaining Length'in tek baytlık asgari hâli.
  if (data.length < 2) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const header = buildFixedHeaderFields(data);
  const fields: ParsedField[] = [...header.fields];
  const warnings: ProtocolWarning[] = [...header.warnings];
  const errors: ProtocolError[] = [...header.errors];

  const packetTypeName = PACKET_TYPE_NAMES.get(header.packetType);
  const metadata: MqttFrameMetadata = {
    packetType: header.packetType,
    packetTypeName,
    summaryKey: SUMMARY_FRAME,
    summaryParams: { packetType: packetTypeName ?? String(header.packetType) },
  };

  // Remaining Length — mqttVbi.ts'teki TEK yardımcı (dosya başı tuzak notu).
  const vbi = decodeVariableByteInteger(data, 1);
  if (!vbi.success) {
    const malformed = vbi.reason === 'malformed';
    fields.push({
      id: 'remaining-length',
      name: 'Remaining Length',
      offset: 1,
      length: data.length - 1,
      rawBytes: data.slice(1),
      valid: false,
      warnings: [malformed ? ERROR_REMAINING_LENGTH_MALFORMED : ERROR_REMAINING_LENGTH_TRUNCATED],
    });
    errors.push({
      code: malformed ? 'value-out-of-range' : 'truncated-frame',
      message: malformed ? ERROR_REMAINING_LENGTH_MALFORMED : ERROR_REMAINING_LENGTH_TRUNCATED,
      offset: 1,
      length: data.length - 1,
    });
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  const remainingLength = vbi.value;
  const vbiLength = vbi.length;
  fields.push({
    id: 'remaining-length',
    name: 'Remaining Length',
    offset: 1,
    length: vbiLength,
    rawBytes: data.slice(1, 1 + vbiLength),
    rawValue: remainingLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const totalFrameLength = 1 + vbiLength + remainingLength;
  if (data.length < totalFrameLength) {
    // Kısmi çözüm: fixed header yine gösterilir (spec §47, MAVLink emsali).
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: 1 + vbiLength,
      length: totalFrameLength - data.length,
      details: { remainingLength, availableAfterHeader: data.length - 1 - vbiLength },
    });
    return finishFrame(data, fields, warnings, errors, options, metadata);
  }

  // Bu noktadan sonra HER okuma bu paketin sınırına (totalFrameLength) hapsedilir —
  // arkasında başka bir MQTT paketi/artık bayt varsa değişken başlık onu asla sızdırmaz.
  const bounded = data.subarray(0, totalFrameLength);
  const cursor: Cursor = { data: bounded, pos: 1 + vbiLength };

  if (!header.packetTypeValid) {
    pushBodyField(cursor, fields);
  } else if (header.packetType === PACKET_TYPE_CONNECT) {
    parseConnectBody(cursor, fields, warnings, errors);
  } else if (header.packetType === PACKET_TYPE_PUBLISH) {
    parsePublishBody(cursor, fields, warnings, errors, header.qos ?? 0);
  } else if (PACKET_ID_ONLY_TYPES.has(header.packetType)) {
    parsePacketIdBody(cursor, fields, errors);
  } else {
    pushBodyField(cursor, fields);
  }

  if (data.length > totalFrameLength) {
    pushTrailingField(data, totalFrameLength, fields, warnings);
  }

  return finishFrame(data, fields, warnings, errors, options, metadata);
}

export function parseMqtt(data: Uint8Array): ParseResult {
  return parseMqttFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): MqttParseOptions {
  const options: MqttParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const mqttParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + paket tipi nibble'ının rezerve (0) olmaması. */
  canParse(data: Uint8Array): boolean {
    if (data.length < 2) return false;
    const packetType = (byteAt(data, 0) >>> 4) & 0x0f;
    return packetType !== 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseMqttFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'connect-v311',
    name: 'protocol.mqtt.example.connectV311.name',
    // CONNECT, Protocol Level=4 (v3.1.1), Clean Session=1, Keep Alive=60,
    // Client ID "sensor-01" — will/user/pass YOK. Byte'lar elle hesaplandı,
    // Remaining Length=21 bağımsız olarak doğrulandı (mqtt.test.ts).
    bytes: Uint8Array.from([
      0x10, 0x15, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, 0x09, 0x73, 0x65,
      0x6e, 0x73, 0x6f, 0x72, 0x2d, 0x30, 0x31,
    ]),
    description: 'protocol.mqtt.example.connectV311.description',
    expectedValid: true,
  },
  {
    id: 'connect-v5-properties',
    name: 'protocol.mqtt.example.connectV5Properties.name',
    // CONNECT, Protocol Level=5, Properties: Session Expiry Interval=3600 (id 17,
    // fourByteInt) + Receive Maximum=20 (id 33, twoByteInt) — properties uzunluğu 8.
    // Client ID "sensor-02". Remaining Length=30, bağımsız hesaplandı (mqtt.test.ts).
    bytes: Uint8Array.from([
      0x10, 0x1e, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x05, 0x02, 0x00, 0x3c, 0x08, 0x11, 0x00, 0x00,
      0x0e, 0x10, 0x21, 0x00, 0x14, 0x00, 0x09, 0x73, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x2d, 0x30, 0x32,
    ]),
    description: 'protocol.mqtt.example.connectV5Properties.description',
    expectedValid: true,
  },
  {
    id: 'publish-qos0',
    name: 'protocol.mqtt.example.publishQos0.name',
    // PUBLISH, QoS=0 (Packet Identifier YOK), Topic "sensors/temp", Payload "23.5".
    bytes: Uint8Array.from([
      0x30, 0x12, 0x00, 0x0c, 0x73, 0x65, 0x6e, 0x73, 0x6f, 0x72, 0x73, 0x2f, 0x74, 0x65, 0x6d, 0x70,
      0x32, 0x33, 0x2e, 0x35,
    ]),
    description: 'protocol.mqtt.example.publishQos0.description',
    expectedValid: true,
  },
  {
    id: 'publish-qos1',
    name: 'protocol.mqtt.example.publishQos1.name',
    // PUBLISH, QoS=1 + RETAIN=1, Packet Identifier=0x1234, Topic "cmd/set", Payload "ON".
    bytes: Uint8Array.from([
      0x33, 0x0d, 0x00, 0x07, 0x63, 0x6d, 0x64, 0x2f, 0x73, 0x65, 0x74, 0x12, 0x34, 0x4f, 0x4e,
    ]),
    description: 'protocol.mqtt.example.publishQos1.description',
    expectedValid: true,
  },
  {
    id: 'reserved-packet-type',
    name: 'protocol.mqtt.example.reservedPacketType.name',
    // Üst nibble 0x0: OASIS'in 15 tipinden hiçbiri değil (reserved) — hata yolu.
    // Fixed Header yine de gösterilir, Remaining Length=2'lik ham "Body" eklenir.
    bytes: Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]),
    description: 'protocol.mqtt.example.reservedPacketType.description',
    expectedValid: false,
  },
  {
    id: 'remaining-length-malformed',
    name: 'protocol.mqtt.example.remainingLengthMalformed.name',
    // CONNECT tipi geçerli ama Remaining Length dört bayt boyunca (0xFF x4)
    // devam bitini hiç bırakmıyor — OASIS'in "en çok 4 bayt" kuralı ihlali.
    bytes: Uint8Array.from([0x10, 0xff, 0xff, 0xff, 0xff]),
    description: 'protocol.mqtt.example.remainingLengthMalformed.description',
    expectedValid: false,
  },
  {
    id: 'subscribe-fixed-flags-violation',
    name: 'protocol.mqtt.example.subscribeFixedFlagsViolation.name',
    // SUBSCRIBE'ın sabit flags'i 0b0010 olmalı, burada 0b0000 — uyarı yolu
    // (hata değil): Packet Identifier=7 + ham gövde yine de çözülür.
    bytes: Uint8Array.from([0x80, 0x0a, 0x00, 0x07, 0x00, 0x05, 0x61, 0x2f, 0x62, 0x2f, 0x63, 0x01]),
    description: 'protocol.mqtt.example.subscribeFixedFlagsViolation.description',
    expectedValid: true,
  },
];

export const mqttPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: mqttParser,
  documentation: {
    summary: 'protocol.mqtt.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
