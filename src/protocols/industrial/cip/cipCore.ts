/**
 * CIP (Common Industrial Protocol) — media-independent nesne modeli çekirdeği.
 *
 * Faz 10, dalga 13d. `cip.ts` (çıplak CIP mesajı sayfası), `ethernetip.ts`
 * (SendRRData/SendUnitData içindeki CPF veri item'ları) ve `devicenet.ts`
 * (CAN payload'ı, kullanıcı "explicit message" seçtiğinde) BU dosyayı
 * TÜKETİR — brief-faz10-dalga13.md'nin 2. mimari bulgusu: ODVA'nın kendi
 * tanımı CIP'i media-independent bir uygulama katmanı nesne modeli sayıyor;
 * EtherNet/IP ve DeviceNet AYNI modeli FARKLI taşıyıcılar üzerinde taşıyor.
 * Desen `iec104Asdu.ts`/`opcUaBinary.ts` ile aynı: çekirdek `fields` dizisine
 * DOĞRUDAN alan basar, bir `Summary` nesnesi döner — motor kendi başına bir
 * `ProtocolParser` DEĞİLDİR, tüketici onu sarmalar.
 *
 * ── KAYNAK UYARISI ───────────────────────────────────────────────────────────
 * ODVA'nın resmi CIP Networks Library'si (Volume 1) ÜCRETLİdir ve bu depoda
 * YOK. Aşağıdaki alan yerleşimleri ÜÇ bağımsız kamuya açık kaynaktan ÇAPRAZ
 * TEYİTLE alındı:
 *   O = OpENer (EIPStackGroup/OpENer, Apache-2.0) — bağımsız açık kaynak
 *       EtherNet/IP adapter stack'i, gerçek çalışan C kodu (KOD KOPYALANMADI,
 *       yalnız alan yerleşimi/sabitler referans alındı):
 *       - `source/src/cip/ciperror.h` (`CipError` enum) — General Status.
 *       - `source/src/cip/ciptypes.h` (`CIPServiceCode` enum) — Service kodu.
 *       - `source/src/cip/cipepath.h` + `cipepath.c` — EPATH segment/format
 *         bitleri VE 16/32-bit'te PAD baytının atlandığı (`CipEpathGetLogicalValue`,
 *         yorum: "Pad byte needs to be skipped") KOD SEVİYESİNDE kanıtı.
 *       https://github.com/EIPStackGroup/OpENer
 *   W = Wireshark `epan/dissectors/packet-cip.c` (GPL-2.0, bağımsız
 *       implementasyon) — `cip_gs_vals` (General Status) OpENer'ın
 *       `CipError` enum'uyla İSİM İSİM örtüşüyor (Success/Connection
 *       failure/Resource unavailable/.../Service not supported/Object state
 *       conflict/Device state conflict/Not enough data/Attribute not
 *       supported/Too much data) — ÇAKIŞMA YOK.
 *       https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-cip.c
 *   S = scadaprotocols.com — "CIP Path Segments Explained" + "CIP Object
 *       Model Explained" + "CIP General Status Codes Reference" (tertiary,
 *       bu depoda IEC 60870-5-101'in S3 kaynağıyla AYNI ölçütle kabul edildi):
 *       segment tipi bitleri (7-5), lojik alt tip bitleri (4-2: Class/
 *       Instance/Member/Connection Point/Attribute/Special/Service ID), format
 *       bitleri (1-0: 8/16/32-bit) VE genel status tablosunun TAMAMI OpENer/
 *       Wireshark'la birebir örtüşüyor.
 *       https://scadaprotocols.com/cip-path-segments-explained/
 *       https://scadaprotocols.com/cip-general-status-codes-reference/
 *       https://scadaprotocols.com/cip-general-status-codes-reference/
 *
 * Çakışma bulunmadı: üç kaynak da aynı bit yerleşimini ve aynı isim kümesini
 * veriyor. **Yalnız EN AZ İKİ kaynakta AYNI adla geçen** General Status
 * kodları ve EPATH lojik alt tipleri adlandırıldı — hiçbiri uydurulmadı.
 *
 * ── TUZAK: 16/32-bit LOGICAL SEGMENT PAD BAYTI (brief'in vurguladığı) ───────
 * `20 01` (8-bit Class=1) ile `21 00 01 00` (16-bit Class=1) YAPISAL OLARAK
 * FARKLIDIR: ikincisinde segment baytından SONRA bir REZERVE/PAD baytı (`00`)
 * gelir, DEĞER ondan SONRA başlar. Pad baytını atlamadan okumak sonraki HER
 * segmenti bir bayt kaydırır ve küçük örneklerde (pad baytı da 0x00 olduğu
 * için değeri şans eseri "doğru" gösterebilir) geç fark edilir — 13c'nin
 * NodeId dersi, 12f'nin chunked-length dersiyle AYNI SINIF. `decodeCipEpath`
 * bunu OpENer'ın kod-seviyesi kanıtladığı şekilde uygular: 8-bit'te pad YOK,
 * 16/32-bit'te 1 bayt pad VAR (bkz. `LOGICAL_FORMAT_*` case'leri aşağıda).
 *
 * ── KAPSAM — neyin çözüldüğü, neyin HAM bırakıldığı ─────────────────────────
 * ÇÖZÜLÜR: EPATH'in Logical Segment'leri (Class/Instance/Member/Connection
 * Point/Attribute — brief'in "iki taşıyıcı önce CIP çekirdek" isteğinin tam
 * karşılığı), CIP Message Router Request (Service + Path Size + Path +
 * Request Data) ve Response (Reply Service + Reserved + General Status +
 * Additional Status Size + Additional Status + Response Data) çerçevesi,
 * dar bir Common Service kodu kümesi (ODVA'nın "CIP common services" adını
 * verdiği, sınıftan bağımsız servisler), TAM General Status tablosu, küçük
 * bir "iyi bilinen sınıf" adı kümesi (Identity/Message Router/Assembly/
 * Connection/Connection Manager/TCP-IP Interface/Ethernet Link).
 *
 * HAM BIRAKILIR (bilerek, dosya başında AÇIKÇA):
 *   - Port/Network/Symbolic/Data Segment'ler VE Logical Segment'in Special
 *     (Electronic Key, `0x34` başlar) ve Service ID alt tipleri: her birinin
 *     KENDİ, format-bitlerinden BAĞIMSIZ bir gövde yapısı vardır (ör.
 *     Electronic Key = Key Format + Vendor ID + Device Type + Product Code +
 *     Major/Minor Revision) ve bu depoda bunu doğrulayacak ikinci bağımsız
 *     kaynak YOK — tahmin etmek yerine EPATH'in KALANI tek bir ham blok
 *     olarak gösterilir, uyarı basılır, yürüyüş DURDURULUR (yanlış uzunluk
 *     varsayıp sonraki alanları kaydırmaktansa dürüstçe durmak — spec §47).
 *   - Additional Status'un (Extended Status) İÇERİĞİ: kod sınıfa/servise özel
 *     bir tablodur (ör. Connection Manager'ın kendi genişletilmiş status
 *     kodları), CIP çekirdeğinin DEĞİL. Bayt sayısı doğru hesaplanır
 *     (`Additional Status Size` WORD sayısıdır, BAYT DEĞİL — brief'in
 *     vurguladığı ikinci tuzak), içerik ham kalır.
 *   - Class-özel öznitelik (attribute) ADLARI: Attribute 7'nin "Product Name"
 *     olduğunu bilmek Identity Object'in KENDİ profiline aittir, CIP
 *     çekirdeğine değil — EDS/device profile gerektirir (CANopen'ın PDO
 *     mapping'i EDS'e bırakmasıyla AYNI sınır).
 *
 * ── İSTEK/YANIT AYRIMI — KANAL GEREKMEZ ─────────────────────────────────────
 * CIP yanıtının Reply Service baytında bit 7 (`0x80`) HER ZAMAN set'tir
 * (S: "Service code with bit 7 set"); ortak/sınıf servislerinin TAMAMI
 * `0x00-0x7F` aralığındadır (vendor-specific servisler bile `0x64-0x7F`'te
 * kalır). Yani istek/yanıt ayrımı ÇERÇEVENİN KENDİSİNDEN okunur, bir
 * `decodeOptions` kanalı GEREKMEZ (12f'nin WebSocket MASK-biti dersi).
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function readUint32Le(data: Uint8Array, offset: number): number {
  const value =
    byteAt(data, offset) |
    (byteAt(data, offset + 1) << 8) |
    (byteAt(data, offset + 2) << 16) |
    (byteAt(data, offset + 3) << 24);
  return value >>> 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function pushRawField(
  fields: ParsedField[],
  id: string,
  name: string,
  data: Uint8Array,
  offset: number,
  length: number,
  fieldWarnings: readonly string[] = [],
): void {
  if (length <= 0) return;
  fields.push({
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    unit: 'B',
    valid: fieldWarnings.length === 0,
    warnings: [...fieldWarnings],
  });
}

// ── Servis kodları (ODVA "CIP common services") — O+W çapraz teyitli ────────

/** Reply Service baytında istek servisiyle OR'lanan bit (S: "bit 7 set"). */
export const CIP_REPLY_SERVICE_BIT = 0x80;
const CIP_SERVICE_CODE_MASK = 0x7f;

/**
 * Dar küme: yalnız ODVA'nın "CIP common services" diye adlandırdığı,
 * sınıftan bağımsız servisler — O'nun `CIPServiceCode` enum'u BİREBİR.
 * Sınıfa özel servisler (ör. Connection Manager'ın Forward_Open'ı) burada
 * YOK; onlar CIP çekirdeğinin değil, ilgili sınıfın sözlüğüdür.
 */
export const CIP_SERVICE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x01, 'Get_Attribute_All'],
  [0x02, 'Set_Attribute_All'],
  [0x03, 'Get_Attribute_List'],
  [0x04, 'Set_Attribute_List'],
  [0x05, 'Reset'],
  [0x06, 'Start'],
  [0x07, 'Stop'],
  [0x08, 'Create'],
  [0x09, 'Delete'],
  [0x0a, 'Multiple_Service_Packet'],
  [0x0d, 'Apply_Attributes'],
  [0x0e, 'Get_Attribute_Single'],
  [0x10, 'Set_Attribute_Single'],
  [0x11, 'Find_Next_Object_Instance'],
  [0x15, 'Restore'],
  [0x16, 'Save'],
  [0x17, 'No_Operation'],
  [0x18, 'Get_Member'],
  [0x19, 'Set_Member'],
  [0x1a, 'Insert_Member'],
  [0x1b, 'Remove_Member'],
  [0x1c, 'GroupSync'],
]);

/** Reply Service baytından (bit 7 dahil) servis adını çözer. */
export function resolveCipServiceName(serviceByte: number): string | undefined {
  return CIP_SERVICE_NAMES.get(serviceByte & CIP_SERVICE_CODE_MASK);
}

// ── General Status — O+W+S ÜÇ kaynakta birebir örtüşen TAM tablo ────────────

export const CIP_GENERAL_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Success'],
  [0x01, 'Connection failure'],
  [0x02, 'Resource unavailable'],
  [0x03, 'Invalid parameter value'],
  [0x04, 'Path segment error'],
  [0x05, 'Path destination unknown'],
  [0x06, 'Partial transfer'],
  [0x07, 'Connection lost'],
  [0x08, 'Service not supported'],
  [0x09, 'Invalid attribute value'],
  [0x0a, 'Attribute list error'],
  [0x0b, 'Already in requested mode/state'],
  [0x0c, 'Object state conflict'],
  [0x0d, 'Object already exists'],
  [0x0e, 'Attribute not settable'],
  [0x0f, 'Privilege violation'],
  [0x10, 'Device state conflict'],
  [0x11, 'Reply data too large'],
  [0x12, 'Fragmentation of a primitive value'],
  [0x13, 'Not enough data'],
  [0x14, 'Attribute not supported'],
  [0x15, 'Too much data'],
  [0x16, 'Object does not exist'],
  [0x17, 'Service fragmentation sequence not in progress'],
  [0x18, 'No stored attribute data'],
  [0x19, 'Store operation failure'],
  [0x1a, 'Routing failure, request packet too large'],
  [0x1b, 'Routing failure, response packet too large'],
  [0x1c, 'Missing attribute list entry data'],
  [0x1d, 'Invalid attribute value list'],
  [0x1e, 'Embedded service error'],
  [0x1f, 'Vendor specific error'],
  [0x20, 'Invalid parameter'],
  [0x21, 'Write-once value or medium already written'],
  [0x22, 'Invalid reply received'],
  [0x23, 'Buffer overflow'],
  [0x24, 'Message format error'],
  [0x25, 'Key failure in path'],
  [0x26, 'Path size invalid'],
  [0x27, 'Unexpected attribute in list'],
  [0x28, 'Invalid member ID'],
  [0x29, 'Member not settable'],
  [0x2a, 'Group 2 only server general failure'],
  [0x2b, 'Unknown Modbus error'],
]);

// ── İyi bilinen sınıflar — dar küme, S ile teyitli ───────────────────────────

/**
 * Yalnız spec'in/örneklerin bu dalgada fiilen değindiği yedi sınıf. Tam ODVA
 * nesne kütüphanesi çok daha geniştir; burada uydurmak yerine dar tutuldu.
 */
export const CIP_WELL_KNOWN_CLASS_NAMES: ReadonlyMap<number, string> = new Map([
  [0x01, 'Identity'],
  [0x02, 'Message Router'],
  [0x04, 'Assembly'],
  [0x05, 'Connection'],
  [0x06, 'Connection Manager'],
  [0xf5, 'TCP/IP Interface'],
  [0xf6, 'Ethernet Link'],
]);

// ── EPATH segment çözümü ─────────────────────────────────────────────────────

// Segment tipi (bit 7-5): Port=0x00, Logical=0x20, Network=0x40, Symbolic=0x60,
// Data=0x80 (S kaynağı). Yalnız Logical bu motoda çözülür (dosya başı KAPSAM
// notu); ötekiler ADLANDIRILMAZ, tek sabit (`SEGMENT_TYPE_LOGICAL`) yeter —
// "Logical mi değil mi" ayrımı ötesinde kullanılmayan sabit bırakmamak için.
const SEGMENT_TYPE_MASK = 0xe0;
const SEGMENT_TYPE_LOGICAL = 0x20;

const LOGICAL_TYPE_MASK = 0x1c;
const LOGICAL_TYPE_CLASS = 0x00;
const LOGICAL_TYPE_INSTANCE = 0x04;
const LOGICAL_TYPE_MEMBER = 0x08;
const LOGICAL_TYPE_CONNECTION_POINT = 0x0c;
const LOGICAL_TYPE_ATTRIBUTE = 0x10;

const LOGICAL_FORMAT_MASK = 0x03;
const LOGICAL_FORMAT_8_BIT = 0x00;
const LOGICAL_FORMAT_16_BIT = 0x01;
const LOGICAL_FORMAT_32_BIT = 0x02;

const WARN_CIP_EXTENDED_PATH_NOT_DECODED = 'protocol.cip.warning.extendedPathNotDecoded';
const WARN_CIP_PATH_TRUNCATED = 'protocol.cip.warning.pathTruncated';
const WARN_CIP_UNKNOWN_SERVICE = 'protocol.cip.warning.unknownService';
const WARN_CIP_RESERVED_NONZERO = 'protocol.cip.warning.reservedByteNonzero';
const WARN_CIP_UNKNOWN_GENERAL_STATUS = 'protocol.cip.warning.unknownGeneralStatus';
const WARN_CIP_ADDITIONAL_STATUS_TRUNCATED = 'protocol.cip.warning.additionalStatusTruncated';

const ERROR_CIP_MESSAGE_EMPTY = 'protocol.cip.error.messageEmpty';
const ERROR_CIP_RESPONSE_HEADER_TRUNCATED = 'protocol.cip.error.responseHeaderTruncated';
const ERROR_CIP_REQUEST_HEADER_TRUNCATED = 'protocol.cip.error.requestHeaderTruncated';

export interface CipEpathSummary {
  readonly classId: number | undefined;
  readonly instanceId: number | undefined;
  readonly attributeId: number | undefined;
  readonly memberId: number | undefined;
  readonly connectionPoint: number | undefined;
  /** Segment yürüyüşünün tükettiği bayt sayısı — HER ZAMAN çağrılan `byteLength`e eşittir. */
  readonly consumedBytes: number;
  /** Port/Network/Symbolic/Data ya da Special/Service ID segmentiyle karşılaşılıp yürüyüşün ham bırakıldığını işaretler. */
  readonly stoppedAtUnsupportedSegment: boolean;
}

/**
 * EPATH'i baştan sona yürür, yalnız Logical Segment'in Class/Instance/Member/
 * Connection Point/Attribute alt tiplerini alan alan çözer. Tanınmayan bir
 * segment tipiyle karşılaşınca (Port/Network/Symbolic/Data/Special/Service
 * ID) KALAN TÜM path'i tek bir ham blok olarak basar ve DURUR — yanlış
 * uzunluk varsayıp sonraki baytları kaydırmaktansa dürüstçe durmak (dosya
 * başı KAPSAM notu).
 *
 * `offset`/`byteLength` ÇAĞIRANIN buffer'ındaki MUTLAK konumlardır (canopen.ts/
 * iec104Asdu.ts emsali) — `fields` içine basılan `offset` değerleri doğrudan
 * bu değerlerden türer, byte-viewer vurgusu bu yüzden doğru hizalanır.
 */
export function decodeCipEpath(
  data: Uint8Array,
  offset: number,
  byteLength: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  fieldIdPrefix: string,
): CipEpathSummary {
  let classId: number | undefined;
  let instanceId: number | undefined;
  let attributeId: number | undefined;
  let memberId: number | undefined;
  let connectionPoint: number | undefined;
  let stoppedAtUnsupportedSegment = false;

  const pathEnd = offset + byteLength;
  let cursor = offset;

  while (cursor < pathEnd) {
    const segmentByte = byteAt(data, cursor);
    const segmentType = segmentByte & SEGMENT_TYPE_MASK;

    if (segmentType !== SEGMENT_TYPE_LOGICAL) {
      // Port(0x00)/Network(0x40)/Symbolic(0x60)/Data(0x80) ve üstü: dosya başı
      // KAPSAM notu — kendi format kuralları var, burada çözülmez.
      stoppedAtUnsupportedSegment = true;
      break;
    }

    const logicalType = segmentByte & LOGICAL_TYPE_MASK;
    const format = segmentByte & LOGICAL_FORMAT_MASK;

    if (
      logicalType !== LOGICAL_TYPE_CLASS &&
      logicalType !== LOGICAL_TYPE_INSTANCE &&
      logicalType !== LOGICAL_TYPE_MEMBER &&
      logicalType !== LOGICAL_TYPE_CONNECTION_POINT &&
      logicalType !== LOGICAL_TYPE_ATTRIBUTE
    ) {
      // Special (Electronic Key, 0x34 ile başlar) / Service ID / Reserved:
      // format bitlerinden BAĞIMSIZ kendi gövdesi var, dosya başı KAPSAM notu.
      stoppedAtUnsupportedSegment = true;
      break;
    }

    let value: number;
    let segmentLength: number;
    if (format === LOGICAL_FORMAT_8_BIT) {
      // TUZAK (dosya başı): 8-bit'te PAD YOK, değer doğrudan sonraki bayttadır.
      if (cursor + 2 > pathEnd) {
        stoppedAtUnsupportedSegment = true;
        break;
      }
      value = byteAt(data, cursor + 1);
      segmentLength = 2;
    } else if (format === LOGICAL_FORMAT_16_BIT) {
      // TUZAK (dosya başı): segment baytından SONRA 1 PAD baytı var, değer ondan sonra.
      if (cursor + 4 > pathEnd) {
        stoppedAtUnsupportedSegment = true;
        break;
      }
      value = readUint16Le(data, cursor + 2);
      segmentLength = 4;
    } else if (format === LOGICAL_FORMAT_32_BIT) {
      if (cursor + 6 > pathEnd) {
        stoppedAtUnsupportedSegment = true;
        break;
      }
      value = readUint32Le(data, cursor + 2);
      segmentLength = 6;
    } else {
      // Format 0b11: reserved, uzunluğu bilinmiyor.
      stoppedAtUnsupportedSegment = true;
      break;
    }

    const rawBytes = data.slice(cursor, cursor + segmentLength);
    const knownClassName =
      logicalType === LOGICAL_TYPE_CLASS ? CIP_WELL_KNOWN_CLASS_NAMES.get(value) : undefined;

    let fieldId: string;
    let fieldName: string;
    if (logicalType === LOGICAL_TYPE_CLASS) {
      classId = value;
      fieldId = `${fieldIdPrefix}class`;
      fieldName = 'Class';
    } else if (logicalType === LOGICAL_TYPE_INSTANCE) {
      instanceId = value;
      fieldId = `${fieldIdPrefix}instance`;
      fieldName = 'Instance';
    } else if (logicalType === LOGICAL_TYPE_MEMBER) {
      memberId = value;
      fieldId = `${fieldIdPrefix}member`;
      fieldName = 'Member';
    } else if (logicalType === LOGICAL_TYPE_CONNECTION_POINT) {
      connectionPoint = value;
      fieldId = `${fieldIdPrefix}connection-point`;
      fieldName = 'Connection Point';
    } else {
      attributeId = value;
      fieldId = `${fieldIdPrefix}attribute`;
      fieldName = 'Attribute';
    }

    fields.push({
      id: fieldId,
      name: fieldName,
      offset: cursor,
      length: segmentLength,
      rawBytes,
      rawValue: value,
      ...(knownClassName === undefined ? {} : { physicalValue: knownClassName }),
      valid: true,
      warnings: [],
    });

    cursor += segmentLength;
  }

  if (stoppedAtUnsupportedSegment && cursor < pathEnd) {
    pushRawField(
      fields,
      `${fieldIdPrefix}extended-path`,
      'Extended Path',
      data,
      cursor,
      pathEnd - cursor,
      [WARN_CIP_EXTENDED_PATH_NOT_DECODED],
    );
    warnings.push(toProtocolWarning(WARN_CIP_EXTENDED_PATH_NOT_DECODED));
    cursor = pathEnd;
  }

  return {
    classId,
    instanceId,
    attributeId,
    memberId,
    connectionPoint,
    consumedBytes: cursor - offset,
    stoppedAtUnsupportedSegment,
  };
}

// ── CIP Message Router Request/Response ──────────────────────────────────────

export interface CipMessageSummary {
  readonly isResponse: boolean;
  readonly service: number | undefined;
  readonly serviceName: string | undefined;
  readonly generalStatus: number | undefined;
  readonly generalStatusName: string | undefined;
  readonly path: CipEpathSummary | undefined;
  readonly consumedBytes: number;
}

const EMPTY_MESSAGE_SUMMARY: CipMessageSummary = {
  isResponse: false,
  service: undefined,
  serviceName: undefined,
  generalStatus: undefined,
  generalStatusName: undefined,
  path: undefined,
  consumedBytes: 0,
};

/**
 * Bir CIP Message Router isteğini ya da yanıtını çözer — ayrım Reply Service
 * baytının 7. bitinden okunur (dosya başı "İSTEK/YANIT AYRIMI" notu, kanal
 * GEREKMEZ). `data`/`offset`/`messageEnd` MUTLAK indekslerdir: `messageEnd`
 * çağıranın (EtherNet/IP CPF item'ının `Length` alanı gibi) belirlediği
 * sınırdır — bu sayede aynı buffer'daki bir SONRAKİ CPF item'ının baytlarına
 * taşmaz.
 */
export function decodeCipMessage(
  data: Uint8Array,
  offset: number,
  messageEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  fieldIdPrefix: string,
): CipMessageSummary {
  if (offset >= messageEnd) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CIP_MESSAGE_EMPTY,
      offset,
      length: 0,
    });
    return EMPTY_MESSAGE_SUMMARY;
  }

  const serviceByte = byteAt(data, offset);
  const isResponse = (serviceByte & CIP_REPLY_SERVICE_BIT) !== 0;
  const serviceName = resolveCipServiceName(serviceByte);

  if (isResponse) {
    if (offset + 4 > messageEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_CIP_RESPONSE_HEADER_TRUNCATED,
        offset,
        length: messageEnd - offset,
      });
      return { ...EMPTY_MESSAGE_SUMMARY, isResponse: true, consumedBytes: messageEnd - offset };
    }

    fields.push({
      id: `${fieldIdPrefix}reply-service`,
      name: 'Reply Service',
      offset,
      length: 1,
      rawBytes: data.slice(offset, offset + 1),
      rawValue: serviceByte,
      ...(serviceName === undefined ? {} : { physicalValue: `${serviceName} (Reply)` }),
      // Adlandırılmamış servis GEÇERSİZ demek değildir: dar küme yalnız ortak
      // servisleri kapsar, sınıfa özel/vendor-specific servisler de LEGAL'dir.
      valid: true,
      warnings: serviceName === undefined ? [WARN_CIP_UNKNOWN_SERVICE] : [],
    });
    if (serviceName === undefined) warnings.push(toProtocolWarning(WARN_CIP_UNKNOWN_SERVICE));

    const reservedByte = byteAt(data, offset + 1);
    fields.push({
      id: `${fieldIdPrefix}reserved`,
      name: 'Reserved',
      offset: offset + 1,
      length: 1,
      rawBytes: data.slice(offset + 1, offset + 2),
      rawValue: reservedByte,
      valid: reservedByte === 0,
      warnings: reservedByte === 0 ? [] : [WARN_CIP_RESERVED_NONZERO],
    });
    if (reservedByte !== 0) warnings.push(toProtocolWarning(WARN_CIP_RESERVED_NONZERO));

    const statusByte = byteAt(data, offset + 2);
    const statusName = CIP_GENERAL_STATUS_NAMES.get(statusByte);
    fields.push({
      id: `${fieldIdPrefix}general-status`,
      name: 'General Status',
      offset: offset + 2,
      length: 1,
      rawBytes: data.slice(offset + 2, offset + 3),
      rawValue: statusByte,
      ...(statusName === undefined ? {} : { physicalValue: statusName }),
      valid: true,
      warnings: statusName === undefined ? [WARN_CIP_UNKNOWN_GENERAL_STATUS] : [],
    });
    if (statusName === undefined) warnings.push(toProtocolWarning(WARN_CIP_UNKNOWN_GENERAL_STATUS));

    // TUZAK (dosya başı): bu alan WORD (2 bayt) SAYISIDIR, bayt sayısı değil.
    const additionalStatusSizeWords = byteAt(data, offset + 3);
    fields.push({
      id: `${fieldIdPrefix}additional-status-size`,
      name: 'Additional Status Size',
      offset: offset + 3,
      length: 1,
      rawBytes: data.slice(offset + 3, offset + 4),
      rawValue: additionalStatusSizeWords,
      physicalValue: additionalStatusSizeWords * 2,
      unit: 'B',
      valid: true,
      warnings: [],
    });

    let cursor = offset + 4;
    const additionalStatusByteLength = additionalStatusSizeWords * 2;
    if (additionalStatusByteLength > 0) {
      const available = Math.max(0, Math.min(additionalStatusByteLength, messageEnd - cursor));
      const truncated = available < additionalStatusByteLength;
      pushRawField(
        fields,
        `${fieldIdPrefix}additional-status`,
        'Additional Status',
        data,
        cursor,
        available,
        truncated ? [WARN_CIP_ADDITIONAL_STATUS_TRUNCATED] : [],
      );
      if (truncated) warnings.push(toProtocolWarning(WARN_CIP_ADDITIONAL_STATUS_TRUNCATED));
      cursor += available;
    }

    if (cursor < messageEnd) {
      pushRawField(fields, `${fieldIdPrefix}response-data`, 'Response Data', data, cursor, messageEnd - cursor);
    }

    return {
      isResponse: true,
      service: serviceByte & CIP_SERVICE_CODE_MASK,
      serviceName,
      generalStatus: statusByte,
      generalStatusName: statusName,
      path: undefined,
      consumedBytes: messageEnd - offset,
    };
  }

  // İstek: Service(1) + Request Path Size(1, WORD) + Request Path + Request Data.
  if (offset + 2 > messageEnd) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CIP_REQUEST_HEADER_TRUNCATED,
      offset,
      length: messageEnd - offset,
    });
    return { ...EMPTY_MESSAGE_SUMMARY, consumedBytes: messageEnd - offset };
  }

  fields.push({
    id: `${fieldIdPrefix}service`,
    name: 'Service',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: serviceByte,
    ...(serviceName === undefined ? {} : { physicalValue: serviceName }),
    // Adlandırılmamış servis GEÇERSİZ demek değildir (yukarıdaki yanıt dalıyla aynı gerekçe).
    valid: true,
    warnings: serviceName === undefined ? [WARN_CIP_UNKNOWN_SERVICE] : [],
  });
  if (serviceName === undefined) warnings.push(toProtocolWarning(WARN_CIP_UNKNOWN_SERVICE));

  const pathSizeWords = byteAt(data, offset + 1);
  fields.push({
    id: `${fieldIdPrefix}path-size`,
    name: 'Request Path Size',
    offset: offset + 1,
    length: 1,
    rawBytes: data.slice(offset + 1, offset + 2),
    rawValue: pathSizeWords,
    physicalValue: pathSizeWords * 2,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const pathStart = offset + 2;
  const declaredPathByteLength = pathSizeWords * 2;
  const availablePathLength = Math.max(0, Math.min(declaredPathByteLength, messageEnd - pathStart));
  if (availablePathLength < declaredPathByteLength) {
    warnings.push(toProtocolWarning(WARN_CIP_PATH_TRUNCATED));
  }

  const path = decodeCipEpath(
    data,
    pathStart,
    availablePathLength,
    fields,
    warnings,
    `${fieldIdPrefix}path-`,
  );

  const dataStart = pathStart + path.consumedBytes;
  if (dataStart < messageEnd) {
    pushRawField(fields, `${fieldIdPrefix}request-data`, 'Request Data', data, dataStart, messageEnd - dataStart);
  }

  return {
    isResponse: false,
    service: serviceByte,
    serviceName,
    generalStatus: undefined,
    generalStatusName: undefined,
    path,
    consumedBytes: messageEnd - offset,
  };
}
