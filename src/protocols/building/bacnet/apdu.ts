/**
 * BACnet APDU (Application Protocol Data Unit) BAŞLIK çözüm çekirdeği.
 *
 * `npdu.ts` ile AYNI paylaşılan ailede (dosya başı gerekçesi orada) — NPDU
 * Network Layer Message DEĞİLSE kalan baytlar buraya girer. `decodeApdu` da
 * `decodeNpdu`/`decodeAsdu` gibi OUT-PARAMETER ACCUMULATOR deseni kullanır.
 *
 * ── KAPSAM ÇİZGİSİ (Karar 3, brief-faz10-dalga6.md) ─────────────────────────
 * PDU type + tipe göre başlık alt alanları (segmentasyon bayrakları) + Invoke
 * ID + (segmented ise) Sequence/Window + Service Choice ADI çözülür.
 * Max-segments-accepted / max-apdu-length-accepted yalnız HAM 4-bit KOD olarak
 * gösterilir (insan-okur bayt sayısına ÇEVRİLMEZ): nibble bölünmesinin 4+4
 * olduğu iki kaynakla teyitli ama kod→bayt-sayısı eşleme TABLOSU yalnız TEK
 * kaynakta (bacnet-stack) doğrulandı, ikinci kaynak yok — teyit edilemeyen
 * alan tahmin edilmez (brief kuralı), ham kod yeterlidir.
 *
 * **Servis parametreleri HER ZAMAN TEK HAM BLOK**: tag'li alan yürüyüşü
 * (ReadProperty'nin hangi property'yi istediği gibi) bu çekirdeğin kapsamı
 * DIŞINDA — aşağıdaki gerekçeyle.
 *
 * ── NEDEN berReader.ts KULLANILAMAZ (doğrulama, tahmin değil) ───────────────
 * `protocol-core/decoding/berReader.ts`nin kendi JSDoc'u (dosya başı, X.690
 * kaynak notu) tag oktetini `[class (bit7-6, 2 bit) | constructed (bit5, 1
 * bit) | number (bit4-0, 5 bit)]` olarak böler (`TAG_CLASS_MASK=0xc0`,
 * `TAG_CONSTRUCTED_MASK=0x20`, `TAG_NUMBER_MASK=0x1f` — berReader.ts:167-170)
 * ve uzunluğu AYRI bir oktette (`readBerLength`) okur. BACnet'in kendi
 * (ASHRAE 135 §20.2.1, kamuya açık ikincil kaynaklarda tekrarlanan tarif) tag
 * okteti İSE `[tag number (bit7-4, 4 bit) | class (bit3, 1 bit) | length/
 * value/type (bit2-0, 3 bit)]` böler — uzunluk BER'deki gibi ayrı bir oktette
 * değil, AYNI oktetin alt 3 bitinde taşınır (3 bit 5'e eşitse açık-form bir
 * uzunluk okteti İZLER, BER'in long-form'undan FARKLI bir kural). İki
 * bölümleme de FARKLI bit sınırlarında FARKLI anlamlar taşıyor —
 * `readBerTag`/`readBerLength`'i BACnet baytlarına çağırmak "TLV benzer
 * görünüyor" diye sessiz-yanlış çözüm üretirdi (brief tuzak notu, GOOSE'un
 * yalnız "walker'lı motor DESENİ" olarak emsal olduğu netleştirildi). Bu
 * yüzden servis parametre bloğu HAM bırakılıyor; yeni bir BACnet-özel tag
 * okuyucusu bu dalganın kapsamı DIŞINDA.
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * PDU type numaraları, Confirmed-Request/ComplexACK'in segmentasyon bayrak
 * yerleşimi ve Service Choice adları İKİ bağımsız kamuya açık kaynaktan
 * ÇAPRAZ TEYİTLE alındı (2026-08-18 taranarak), KOD KOPYALANMADI:
 *   1. Wireshark BACnet dissector (github.com/wireshark/wireshark,
 *      epan/dissectors/packet-bacapp.c) — `BACAPP_TYPE_*` sabitleri (PDU
 *      type 0-7), her PDU tipinin ASN.1-stili SEQUENCE yorumu (octet sırası),
 *      `BACnetConfirmedServiceChoice`/`BACnetUnconfirmedServiceChoice`
 *      value_string tabloları.
 *   2. bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT) —
 *      `src/bacdcode.c` (`decode_max_segs`/`decode_max_apdu`: nibble
 *      bölünmesinin TAM 4+4 bit olduğunu doğrular — 3+4 DEĞİL) ve
 *      `src/apdu.c` (Confirmed-Request başlık sırası: bayraklar → max-segs/
 *      max-apdu okteti → invoke id → [sequence+window] → service choice).
 * İki kaynak PDU type numaralarında ve Service Choice adlarında birebir
 * örtüşüyor. Örtüşmeyen TEK nokta SegmentACK/Abort'un bayrak nibble'ındaki
 * TEK TEK bit konumlarıydı (sıra teyitli, kesin bit index değil) — bu yüzden
 * o iki tipin bayrak oktetleri bit bit AYRIŞTIRILMAZ, PDU Type alanı zaten
 * tüm okteti `rawBytes`te taşır (aşağıda `decodeSegmentAck`/
 * `decodeRejectOrAbort`).
 *
 * ── SERVICE CHOICE ADLARI: İKİ-KAYNAK ÇAKIŞAN ALT KÜME ──────────────────────
 * Aşağıdaki `CONFIRMED_SERVICE_CHOICE_NAMES`/`UNCONFIRMED_SERVICE_CHOICE_NAMES`
 * yalnız Wireshark VE bacpypes'in (github.com/JoelBender/bacpypes,
 * `bacpypes/apdu.py` `ConfirmedServiceChoice`/`UnconfirmedServiceChoice`)
 * AYNI numarada AYNI adı verdiği değerleri taşır — daha yeni eklenen tekil-
 * kaynaklı değerler (ör. confirmed 30-34, unconfirmed 11-14) BİLEREK dışarıda
 * bırakıldı; dar kümenin dışında kalan her Service Choice ham + "tanınmayan"
 * uyarısıyla gösterilir (dar küme felsefesi, DALI opcode/MS/TP Frame Type ile
 * aynı disiplin).
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string, offset?: number, length?: number): ProtocolWarning {
  const warning: ProtocolWarning = { code: key, message: key };
  if (offset !== undefined) warning.offset = offset;
  if (length !== undefined) warning.length = length;
  return warning;
}

export const ERROR_APDU_TRUNCATED = 'protocol.bacnetMstp.error.apduTruncated';
export const WARN_UNKNOWN_PDU_TYPE = 'protocol.bacnetMstp.warning.unknownPduType';
export const WARN_UNKNOWN_SERVICE_CHOICE = 'protocol.bacnetMstp.warning.unknownServiceChoice';
export const WARN_SERVICE_PARAMETERS_NOT_DECODED = 'protocol.bacnetMstp.warning.serviceParametersNotDecoded';

/** APDU'nun ilk oktetinin üst 4 biti — dar, İKİ kaynak teyitli küme (dosya başı). */
const PDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'BACnet-Confirmed-Request-PDU'],
  [1, 'BACnet-Unconfirmed-Request-PDU'],
  [2, 'BACnet-SimpleACK-PDU'],
  [3, 'BACnet-ComplexACK-PDU'],
  [4, 'BACnet-SegmentACK-PDU'],
  [5, 'BACnet-Error-PDU'],
  [6, 'BACnet-Reject-PDU'],
  [7, 'BACnet-Abort-PDU'],
]);

const PDU_TYPE_CONFIRMED_REQUEST = 0;
const PDU_TYPE_UNCONFIRMED_REQUEST = 1;
const PDU_TYPE_SIMPLE_ACK = 2;
const PDU_TYPE_COMPLEX_ACK = 3;
const PDU_TYPE_SEGMENT_ACK = 4;
const PDU_TYPE_ERROR = 5;
const PDU_TYPE_REJECT = 6;
const PDU_TYPE_ABORT = 7;

/** §30 asgari listesi çizgisinde, İKİ kaynak (Wireshark+bacpypes) örtüşen alt küme — dosya başı. */
const CONFIRMED_SERVICE_CHOICE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'AcknowledgeAlarm'],
  [1, 'ConfirmedCOVNotification'],
  [2, 'ConfirmedEventNotification'],
  [3, 'GetAlarmSummary'],
  [4, 'GetEnrollmentSummary'],
  [5, 'SubscribeCOV'],
  [6, 'AtomicReadFile'],
  [7, 'AtomicWriteFile'],
  [8, 'AddListElement'],
  [9, 'RemoveListElement'],
  [10, 'CreateObject'],
  [11, 'DeleteObject'],
  [12, 'ReadProperty'],
  [13, 'ReadPropertyConditional'],
  [14, 'ReadPropertyMultiple'],
  [15, 'WriteProperty'],
  [16, 'WritePropertyMultiple'],
  [17, 'DeviceCommunicationControl'],
  [18, 'ConfirmedPrivateTransfer'],
  [19, 'ConfirmedTextMessage'],
  [20, 'ReinitializeDevice'],
  [21, 'VTOpen'],
  [22, 'VTClose'],
  [23, 'VTData'],
  [24, 'Authenticate'],
  [25, 'RequestKey'],
  [26, 'ReadRange'],
  [27, 'LifeSafetyOperation'],
  [28, 'SubscribeCOVProperty'],
  [29, 'GetEventInformation'],
]);

const UNCONFIRMED_SERVICE_CHOICE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'I-Am'],
  [1, 'I-Have'],
  [2, 'UnconfirmedCOVNotification'],
  [3, 'UnconfirmedEventNotification'],
  [4, 'UnconfirmedPrivateTransfer'],
  [5, 'UnconfirmedTextMessage'],
  [6, 'TimeSynchronization'],
  [7, 'Who-Has'],
  [8, 'Who-Is'],
  [9, 'UTCTimeSynchronization'],
  [10, 'WriteGroup'],
]);

/**
 * APDU çözümünün özeti — `NpduSummary` ile AYNI disiplin: hiçbir alan
 * opsiyonel (`?:`) değil, hepsi `| undefined` ile hep-var alanlardır.
 */
export interface ApduSummary {
  readonly consumed: number;
  readonly pduType: number | undefined;
  readonly pduTypeLabel: string | undefined;
  readonly invokeId: number | undefined;
  readonly serviceChoice: number | undefined;
  readonly serviceChoiceLabel: string | undefined;
}

function pushBitField(
  fields: ParsedField[],
  id: string,
  name: string,
  offset: number,
  rawBytes: Uint8Array,
  rawValue: number,
): void {
  fields.push({ id, name, offset, length: 1, rawBytes, rawValue, valid: true, warnings: [] });
}

/** Kalan TÜM baytları TEK ham "Service Parameters" bloğu olarak basar (Karar 3). Boşsa hiçbir şey basmaz. */
function pushRemainderAsRawParameters(
  data: Uint8Array,
  pos: number,
  baseOffset: number,
  fields: ParsedField[],
): void {
  if (pos >= data.length) return;
  const remainder = data.slice(pos);
  fields.push({
    id: 'apdu-service-parameters',
    name: 'Service Parameters',
    offset: baseOffset + pos,
    length: remainder.length,
    rawBytes: remainder,
    unit: 'B',
    valid: true,
    warnings: [WARN_SERVICE_PARAMETERS_NOT_DECODED],
  });
}

function pushServiceChoiceField(
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  baseOffset: number,
  pos: number,
  data: Uint8Array,
  serviceChoice: number,
  serviceChoiceLabel: string | undefined,
): void {
  const field: ParsedField = {
    id: 'apdu-service-choice',
    name: 'Service Choice',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: serviceChoice,
    valid: serviceChoiceLabel !== undefined,
    warnings: [],
  };
  if (serviceChoiceLabel !== undefined) {
    field.physicalValue = serviceChoiceLabel;
  } else {
    field.warnings.push(WARN_UNKNOWN_SERVICE_CHOICE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_SERVICE_CHOICE, baseOffset + pos, 1));
  }
  fields.push(field);
}

function pushInvokeIdField(fields: ParsedField[], baseOffset: number, pos: number, data: Uint8Array): number {
  const invokeId = byteAt(data, pos);
  fields.push({
    id: 'apdu-invoke-id',
    name: 'Invoke ID',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: invokeId,
    valid: true,
    warnings: [],
  });
  return invokeId;
}

function pushTruncated(errors: ProtocolError[], baseOffset: number, pos: number, remaining: number): void {
  errors.push({ code: 'truncated-frame', message: ERROR_APDU_TRUNCATED, offset: baseOffset + pos, length: remaining });
}

/** Confirmed-Request (PDU type 0) — dosya başı: bayraklar + max-segs/max-apdu KOD + Invoke ID + [seq/window] + Service Choice. */
function decodeConfirmedRequest(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos;
  let invokeId: number | undefined;
  let serviceChoice: number | undefined;
  let serviceChoiceLabel: string | undefined;
  const summary = (): ApduSummary => ({ consumed: pos, pduType, pduTypeLabel, invokeId, serviceChoice, serviceChoiceLabel });

  // octet0 alt nibble: bit3=segmented(SEG), bit2=more-follows(MOR), bit1=segmented-response-accepted(SA), bit0=reserved.
  const octet0Bytes = data.slice(pos, pos + 1);
  const segmented = readBitsAsNumber(data, pos * 8 + 4, 1) === 1;
  pushBitField(fields, 'apdu-segmented-message', 'Segmented Message', baseOffset + pos, octet0Bytes, segmented ? 1 : 0);
  pushBitField(
    fields,
    'apdu-more-follows',
    'More Follows',
    baseOffset + pos,
    octet0Bytes,
    readBitsAsNumber(data, pos * 8 + 5, 1),
  );
  pushBitField(
    fields,
    'apdu-segmented-response-accepted',
    'Segmented Response Accepted',
    baseOffset + pos,
    octet0Bytes,
    readBitsAsNumber(data, pos * 8 + 6, 1),
  );
  pos += 1;

  if (data.length - pos < 2) {
    pushTruncated(errors, baseOffset, pos, data.length - pos);
    return summary();
  }
  const segmentationByte = byteAt(data, pos);
  const segByteBytes = data.slice(pos, pos + 1);
  fields.push({
    id: 'apdu-max-segments-accepted-code',
    name: 'Max Segments Accepted (code)',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: segByteBytes,
    rawValue: (segmentationByte >>> 4) & 0x0f,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'apdu-max-apdu-length-accepted-code',
    name: 'Max APDU Length Accepted (code)',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: segByteBytes,
    rawValue: segmentationByte & 0x0f,
    valid: true,
    warnings: [],
  });
  pos += 1;

  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;

  if (segmented) {
    if (data.length - pos < 2) {
      pushTruncated(errors, baseOffset, pos, data.length - pos);
      return summary();
    }
    fields.push({
      id: 'apdu-sequence-number',
      name: 'Sequence Number',
      offset: baseOffset + pos,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: byteAt(data, pos),
      valid: true,
      warnings: [],
    });
    pos += 1;
    fields.push({
      id: 'apdu-proposed-window-size',
      name: 'Proposed Window Size',
      offset: baseOffset + pos,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: byteAt(data, pos),
      valid: true,
      warnings: [],
    });
    pos += 1;
  }

  if (data.length - pos < 1) {
    pushTruncated(errors, baseOffset, pos, 0);
    return summary();
  }
  serviceChoice = byteAt(data, pos);
  serviceChoiceLabel = CONFIRMED_SERVICE_CHOICE_NAMES.get(serviceChoice);
  pushServiceChoiceField(fields, warnings, baseOffset, pos, data, serviceChoice, serviceChoiceLabel);
  pos += 1;

  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/** Unconfirmed-Request (PDU type 1) — octet0 alt nibble reserved, Invoke ID YOK. */
function decodeUnconfirmedRequest(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos + 1;
  let serviceChoice: number | undefined;
  let serviceChoiceLabel: string | undefined;
  const summary = (): ApduSummary => ({
    consumed: pos,
    pduType,
    pduTypeLabel,
    invokeId: undefined,
    serviceChoice,
    serviceChoiceLabel,
  });

  if (data.length - pos < 1) {
    pushTruncated(errors, baseOffset, pos, 0);
    return summary();
  }
  serviceChoice = byteAt(data, pos);
  serviceChoiceLabel = UNCONFIRMED_SERVICE_CHOICE_NAMES.get(serviceChoice);
  pushServiceChoiceField(fields, warnings, baseOffset, pos, data, serviceChoice, serviceChoiceLabel);
  pos += 1;

  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/** SimpleACK (PDU type 2) — Invoke ID + Service Choice (hangi CONFIRMED servis ACK'lendi), parametre yok. */
function decodeSimpleAck(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos + 1; // octet0 alt nibble reserved.
  let invokeId: number | undefined;
  let serviceChoice: number | undefined;
  let serviceChoiceLabel: string | undefined;
  const summary = (): ApduSummary => ({ consumed: pos, pduType, pduTypeLabel, invokeId, serviceChoice, serviceChoiceLabel });

  if (data.length - pos < 2) {
    pushTruncated(errors, baseOffset, pos, data.length - pos);
    return summary();
  }
  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;
  serviceChoice = byteAt(data, pos);
  serviceChoiceLabel = CONFIRMED_SERVICE_CHOICE_NAMES.get(serviceChoice);
  pushServiceChoiceField(fields, warnings, baseOffset, pos, data, serviceChoice, serviceChoiceLabel);
  pos += 1;

  // SimpleACK'in yapısal olarak parametresi yoktur; bozuk/uzatılmış girdide artakalan varsa yine ham gösterilir.
  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/** ComplexACK (PDU type 3) — Confirmed-Request'e simetrik ama max-segs/max-apdu okteti YOK. */
function decodeComplexAck(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos;
  let invokeId: number | undefined;
  let serviceChoice: number | undefined;
  let serviceChoiceLabel: string | undefined;
  const summary = (): ApduSummary => ({ consumed: pos, pduType, pduTypeLabel, invokeId, serviceChoice, serviceChoiceLabel });

  const octet0Bytes = data.slice(pos, pos + 1);
  const segmented = readBitsAsNumber(data, pos * 8 + 4, 1) === 1;
  pushBitField(fields, 'apdu-segmented-message', 'Segmented Message', baseOffset + pos, octet0Bytes, segmented ? 1 : 0);
  pushBitField(
    fields,
    'apdu-more-follows',
    'More Follows',
    baseOffset + pos,
    octet0Bytes,
    readBitsAsNumber(data, pos * 8 + 5, 1),
  );
  pos += 1;

  if (data.length - pos < 1) {
    pushTruncated(errors, baseOffset, pos, 0);
    return summary();
  }
  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;

  if (segmented) {
    if (data.length - pos < 2) {
      pushTruncated(errors, baseOffset, pos, data.length - pos);
      return summary();
    }
    fields.push({
      id: 'apdu-sequence-number',
      name: 'Sequence Number',
      offset: baseOffset + pos,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: byteAt(data, pos),
      valid: true,
      warnings: [],
    });
    pos += 1;
    fields.push({
      id: 'apdu-proposed-window-size',
      name: 'Proposed Window Size',
      offset: baseOffset + pos,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: byteAt(data, pos),
      valid: true,
      warnings: [],
    });
    pos += 1;
  }

  if (data.length - pos < 1) {
    pushTruncated(errors, baseOffset, pos, 0);
    return summary();
  }
  serviceChoice = byteAt(data, pos);
  serviceChoiceLabel = CONFIRMED_SERVICE_CHOICE_NAMES.get(serviceChoice);
  pushServiceChoiceField(fields, warnings, baseOffset, pos, data, serviceChoice, serviceChoiceLabel);
  pos += 1;

  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/**
 * SegmentACK (PDU type 4) — Invoke ID + Sequence Number + Actual Window Size,
 * Service Choice YOK. octet0'ın alt nibble'ı (negatif-ACK/server bayrakları)
 * BİLEREK bit bit ayrıştırılmaz (dosya başı: sıra teyitli, kesin bit index
 * değil) — PDU Type alanı zaten tüm okteti `rawBytes`te taşır.
 */
function decodeSegmentAck(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos + 1;
  let invokeId: number | undefined;
  const summary = (): ApduSummary => ({
    consumed: pos,
    pduType,
    pduTypeLabel,
    invokeId,
    serviceChoice: undefined,
    serviceChoiceLabel: undefined,
  });

  if (data.length - pos < 3) {
    pushTruncated(errors, baseOffset, pos, data.length - pos);
    return summary();
  }
  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;
  fields.push({
    id: 'apdu-sequence-number',
    name: 'Sequence Number',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;
  fields.push({
    id: 'apdu-actual-window-size',
    name: 'Actual Window Size',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;

  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/** Error (PDU type 5) — Invoke ID + Error Service Choice (CONFIRMED tablo) + Error Class/Code (ham, tag'li). */
function decodeErrorPdu(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos + 1; // octet0 alt nibble reserved.
  let invokeId: number | undefined;
  let serviceChoice: number | undefined;
  let serviceChoiceLabel: string | undefined;
  const summary = (): ApduSummary => ({ consumed: pos, pduType, pduTypeLabel, invokeId, serviceChoice, serviceChoiceLabel });

  if (data.length - pos < 2) {
    pushTruncated(errors, baseOffset, pos, data.length - pos);
    return summary();
  }
  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;
  serviceChoice = byteAt(data, pos);
  serviceChoiceLabel = CONFIRMED_SERVICE_CHOICE_NAMES.get(serviceChoice);
  pushServiceChoiceField(fields, warnings, baseOffset, pos, data, serviceChoice, serviceChoiceLabel);
  pos += 1;

  // Error Class + Error Code tag'li parametrelerdir — Karar 3 gereği ham.
  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/**
 * Reject (PDU type 6) / Abort (PDU type 7) — ikisi de Invoke ID + tek bir
 * "Reason" oktetini paylaşır, Service Choice YOK. Reason ADI teyit edilmedi
 * (araştırma kapsamı bu değere girmedi) — HAM sayı olarak kalır (dosya başı
 * felsefe: teyit edilemeyen alan tahmin edilmez).
 */
function decodeRejectOrAbort(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  pduType: number,
  pduTypeLabel: string,
  reasonFieldId: string,
  reasonFieldName: string,
  fields: ParsedField[],
  errors: ProtocolError[],
): ApduSummary {
  let pos = startPos + 1; // octet0 alt nibble: Reject'te reserved, Abort'ta "server" bayrağı VAR ama bit konumu teyitsiz.
  let invokeId: number | undefined;
  const summary = (): ApduSummary => ({
    consumed: pos,
    pduType,
    pduTypeLabel,
    invokeId,
    serviceChoice: undefined,
    serviceChoiceLabel: undefined,
  });

  if (data.length - pos < 2) {
    pushTruncated(errors, baseOffset, pos, data.length - pos);
    return summary();
  }
  invokeId = pushInvokeIdField(fields, baseOffset, pos, data);
  pos += 1;
  fields.push({
    id: reasonFieldId,
    name: reasonFieldName,
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;

  pushRemainderAsRawParameters(data, pos, baseOffset, fields);
  pos = data.length;
  return summary();
}

/**
 * APDU'yu çözer, alanları `fields`e PUSH eder. `data` APDU'nun BAŞLADIĞI
 * yerden (PDU Type okteti) itibaren kalan TÜM baytlardır; `baseOffset` bu
 * baytların ORİJİNAL çerçevedeki mutlak konumudur.
 */
export function decodeApdu(
  data: Uint8Array,
  baseOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): ApduSummary {
  const empty: ApduSummary = {
    consumed: 0,
    pduType: undefined,
    pduTypeLabel: undefined,
    invokeId: undefined,
    serviceChoice: undefined,
    serviceChoiceLabel: undefined,
  };

  if (data.length < 1) {
    pushTruncated(errors, baseOffset, 0, 0);
    return empty;
  }

  const pos = 0;
  const firstByte = byteAt(data, pos);
  const pduType = (firstByte >>> 4) & 0x0f;
  const pduTypeLabel = PDU_TYPE_NAMES.get(pduType);

  const pduTypeField: ParsedField = {
    id: 'apdu-pdu-type',
    name: 'PDU Type',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: pduType,
    valid: pduTypeLabel !== undefined,
    warnings: [],
  };
  if (pduTypeLabel !== undefined) {
    pduTypeField.physicalValue = pduTypeLabel;
  } else {
    pduTypeField.warnings.push(WARN_UNKNOWN_PDU_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_PDU_TYPE, baseOffset + pos, 1));
  }
  fields.push(pduTypeField);

  if (pduTypeLabel === undefined) {
    // Tanınmayan PDU type: alt bitlerin anlamı tipe göre değiştiği için yürünemez —
    // geri kalan HER ŞEY tek ham blok (dar küme felsefesi, brief tuzak notu).
    pushRemainderAsRawParameters(data, pos + 1, baseOffset, fields);
    return { ...empty, consumed: data.length, pduType };
  }

  switch (pduType) {
    case PDU_TYPE_CONFIRMED_REQUEST:
      return decodeConfirmedRequest(data, pos, baseOffset, pduType, pduTypeLabel, fields, warnings, errors);
    case PDU_TYPE_UNCONFIRMED_REQUEST:
      return decodeUnconfirmedRequest(data, pos, baseOffset, pduType, pduTypeLabel, fields, warnings, errors);
    case PDU_TYPE_SIMPLE_ACK:
      return decodeSimpleAck(data, pos, baseOffset, pduType, pduTypeLabel, fields, warnings, errors);
    case PDU_TYPE_COMPLEX_ACK:
      return decodeComplexAck(data, pos, baseOffset, pduType, pduTypeLabel, fields, warnings, errors);
    case PDU_TYPE_SEGMENT_ACK:
      return decodeSegmentAck(data, pos, baseOffset, pduType, pduTypeLabel, fields, errors);
    case PDU_TYPE_ERROR:
      return decodeErrorPdu(data, pos, baseOffset, pduType, pduTypeLabel, fields, warnings, errors);
    case PDU_TYPE_REJECT:
      return decodeRejectOrAbort(
        data,
        pos,
        baseOffset,
        pduType,
        pduTypeLabel,
        'apdu-reject-reason',
        'Reject Reason',
        fields,
        errors,
      );
    case PDU_TYPE_ABORT:
      return decodeRejectOrAbort(
        data,
        pos,
        baseOffset,
        pduType,
        pduTypeLabel,
        'apdu-abort-reason',
        'Abort Reason',
        fields,
        errors,
      );
    default:
      // PDU_TYPE_NAMES yalnız 0-7 taşır (dosya başı); pduTypeLabel tanımlıysa
      // buraya asla ulaşılmaz — TS'in switch kapsamı analizi için savunma dalı.
      pushRemainderAsRawParameters(data, pos + 1, baseOffset, fields);
      return { ...empty, consumed: data.length, pduType, pduTypeLabel };
  }
}
