/**
 * LonTalk PDU'su — ISO/IEC 14908-1 (ANSI/EIA-709.1) (Faz 10, dalga 17).
 *
 * `cnip.ts`i BİLMEZ ve onu hiç çağırmaz (16c'nin `lweTagBlock.ts` ↔
 * `iec61162.ts` ayrımı). Girdisi bir `Uint8Array` ve PDU'nun başladığı
 * ofsettir; o ofseti kimin hesapladığı bu modülü ilgilendirmez — `payloadKind`
 * `raw-lontalk-pdu` seçildiğinde ofset SIFIRDIR ve zarf hiç yoktur.
 *
 * ── ⚠ SÜRÜM PPDU OKTETİNDE DEĞİL, NPDU OKTETİNDEDİR ───────────────────────
 * İlk bayt TAMAMEN öncelik/alt-path/delta-backlog'dur. Sürüm ikinci baytın
 * 7:6 bitleridir. Keşif turunda `canParse` ölçümü bir kez yanlış bayta bakarak
 * yapıldı ve 310 çıktı; doğru bayta geçince 401 oldu — **yanlış bayt ölçümü
 * de zehirler.**
 *
 * ── BİT YÖNÜ: MSB-FIRST, ve bu İKİ DOSYAYLA belirlenir ────────────────────
 * MIT yığınının her bit alanı `BITS<n>(ad, uzunluk, …)` makrosuyla yazılmış.
 * `bitfield.h:12-14` yönün `BITF_DECLARED_BIG_ENDIAN` ile belirlendiğini
 * söylüyor, `lcs_platform.h:66-67` onu `#define` ediyor (*"LON Stack DX
 * defines bitfields MSB first"*). → argümanlar MSB→LSB. Aynı dosyada
 * `BITF_LITTLE_ENDIAN` de görünüyor ama `bitfield.h:32-36` onu `#undef`
 * ediyor; **yalnız birine bakıp karar vermek tüm bit alanlarını ters çevirir
 * ve hata VERMEZ.**
 *
 * ── ADRES BÖLÜMÜ — NORMATİF Figure 3.2 ────────────────────────────────────
 * `addrFmt` 0/1 → 3 bayt · 2a → 4 · 2b → 6 · 3 (UID) → 9.
 * **2a mı 2b mi ayrımı KAYNAK-DÜĞÜM baytının en anlamlı bitidir** (`1` → 2a,
 * `0` → 2b); spec'in kendi cümlesi: *"The eighth bit in the source node field
 * byte is the selector field… Address format #2 is the only address format
 * using this capability."* Dört kaynak aynı: normatif Figure 3.2,
 * `packet-lon.c:265`, `go-lon:115`, `lcs_network.c:25-28`.
 *
 * **SAPMA — 2b'nin +4 baytı.** Wireshark ona `dstgrp` (destination GROUP)
 * diyor, `go-lon` `DstSubnet` diyor. **HAKEM normatif spec ve go-lon HAKLI:**
 * Figure 3.2 satırı `2b: SrcSubnet 0 SrcNode DstSubnet 1 DstNode Group
 * GrpMemb`. Wireshark okumasında aynı çerçevede hem "destination group" hem
 * "group" olurdu — tekrarlı. Motor spec'i izler ve bu alan uyarı TAŞIMAZ.
 * (Dalganın en değerli bulgusu: normatif kaynak olmasa bu alan "belirsiz"
 * damgasıyla yayınlanacaktı.)
 *
 * **SAPMA — adres biçimi 3 (UID).** `go-lon` BOZUK: 6 baytlık dilimden
 * `uint64` okumaya çalışıyor ve `domain_offset`u 5'te bırakıyor, yani domain'i
 * UID'nin ortasından okuyor. Hakem spec + aritmetik (`1+1+1+6 = 9`);
 * Wireshark alınır. Yakalamada örnek YOK → doğrulanmamış yol.
 *
 * ── ⚠ DOMAİN UZUNLUĞU `0/1/2/3 → 0/1/3/6` BAYTTIR ─────────────────────────
 * `2` ÜÇ bayttır, iki değil. Dört kaynak aynı; tabloyu kafadan üretmek
 * sonraki her ofseti kaydırır ve hata VERMEZ.
 *
 * ── ⚠ WIRESHARK'IN AuthPDU MASKELERİ BOZUK, ve KAYNAK BUNU KENDİSİ SÖYLÜYOR ─
 * `packet-lon.c:395` kendi kaynağında şu `TODO`yu taşıyor: *"these masks are not
 * correct - have { 0xc0, 0x02, 0x0f }"*. Kayıtlı maskeler `0x0c`/`0x02`, TODO'nun kendi
 * önerisi de yanlış. Doğrusu **`0xC0` (fmt) ve `0x30` (tip)** ve bunu
 * `lcs_tsa.c:89`in `BITS3(fmt, 2, pduMsgType, 2, transNum, 4)` satırı veriyor.
 * Wireshark'ın ÇIKARIM kodu (`(b >> 4) & 0x03`) doğru, GÖSTERİM maskesi
 * yanlış — **kodun hangi kısmına baktığın önemli.**
 *
 * ── ⚠ `dissect_apdu`nun "Shouldn't get here" DALI ULAŞILAMAZDIR ───────────
 * Beş koşul `0x00`–`0xFF`in tamamını kaplıyor; `packet-lon.c:484-486` ölü
 * koddur. Ona karşılık gelen bir `ProtocolError` YAZILMAZ.
 *
 * ── ⚠ NM/ND YANIT KODLARI ÜÇ KATLI ÇAKIŞIR — ve bu NORMATİFTİR ────────────
 * Spec: NM yanıtı `00pxxxxx`, ND yanıtı `00p1xxxx` (`<p>` başarı biti,
 * `<xxxxx>`/`<xxxx>` orijinal komutu yankılar). Sonuç: (1) yanıtlar
 * `0x00`–`0x3F` aralığındadır, yani "generic application message" aralığının
 * İÇİNDE; (2) ND biçimi NM biçiminin ALT KÜMESİDİR; (3) ayrım YALNIZ eşleşen
 * isteğe bakılarak yapılabilir ve **o istek bu çerçevede YOKTUR.**
 *
 * Motor: alanı **`Application code`** basar (üç kaynağın da yazdığı, ölçülebilir
 * olan), SPDU RESPONSE içindeyken `responseCodeAmbiguous` uyarısı basar ve
 * İKİ ADAYI DA alanın kendi metninde listeler. **Çerçeveler arası eşleştirme
 * YAPILMAZ** (dalga 16 bulgu 12); transaction numarası basılır ki kullanıcı
 * komşu çerçeveyle kendisi eşleştirebilsin. **Uydurma bir "NM yanıtı" adı
 * BASILMAZ.** Wireshark bunu yapmıyor — her NM/ND yanıtını sessizce
 * "Application message" etiketliyor; motor birinci sınıf kaynaktan daha doğru
 * davranır. `mode-s`in AP alanı kararının (15h) birebir aynı sınıfı.
 *
 * ── `building/bacnet/npdu.ts` BU DEĞİLDİR ─────────────────────────────────
 * Aynı ad, başka protokol. IMPORT EDİLMEZ; `hdlcCore` benzeri bir paylaşım
 * burada YOKTUR ve aranmaz (`seatalk`in kararının aynısı, 16a).
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import { SNVT_RAW, applySnvtScale, findSnvtType, readSnvtRawValue } from './snvtTypes';

/** `cnip.ts`teki ile AYNI şekil; iki modül birbirini import ETMEZ (yapısal tipleme). */
export interface FieldSink {
  readonly fields: ParsedField[];
  readonly usedIds: Set<string>;
}

function uniqueFieldId(sink: FieldSink, base: string): string {
  if (!sink.usedIds.has(base)) {
    sink.usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (sink.usedIds.has(`${base}-${String(suffix)}`)) suffix += 1;
  const id = `${base}-${String(suffix)}`;
  sink.usedIds.add(id);
  return id;
}

function pushField(sink: FieldSink, field: ParsedField): void {
  sink.fields.push({ ...field, id: uniqueFieldId(sink, field.id) });
}

function toProtocolWarning(
  code: string,
  message: string,
  offset?: number,
  length?: number,
): ProtocolWarning {
  return {
    code,
    message,
    ...(offset === undefined ? {} : { offset }),
    ...(length === undefined ? {} : { length }),
  };
}

const TRANSLATION_KEY_PREFIX = 'protocol.lonworks';

export const ERROR_PDU_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.pduTruncated`;
export const ERROR_ADDRESS_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.addressTruncated`;
export const ERROR_DOMAIN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.domainTruncated`;
export const ERROR_TRANSPORT_OCTET_MISSING = `${TRANSLATION_KEY_PREFIX}.error.transportOctetMissing`;

export const WARN_NV_TYPE_NOT_ON_WIRE = `${TRANSLATION_KEY_PREFIX}.warning.nvTypeNotOnWire`;
export const WARN_RESPONSE_CODE_AMBIGUOUS = `${TRANSLATION_KEY_PREFIX}.warning.responseCodeAmbiguous`;
export const WARN_DECODE_PATH_NOT_VERIFIED = `${TRANSLATION_KEY_PREFIX}.warning.decodePathNotVerified`;
export const WARN_NV_PAYLOAD_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.nvPayloadLengthMismatch`;
export const WARN_FOREIGN_FRAME_CODE_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.foreignFrameCodeUnknown`;
export const WARN_UNEXPECTED_LONTALK_VERSION = `${TRANSLATION_KEY_PREFIX}.warning.unexpectedLonTalkVersion`;

const FIELD_WARN_PATH_NOT_VERIFIED = `${TRANSLATION_KEY_PREFIX}.field.pathNotVerifiedInCapture`;
const FIELD_WARN_NV_TYPE_NOT_ON_WIRE = `${TRANSLATION_KEY_PREFIX}.field.nvTypeNotOnWire`;
const FIELD_WARN_RESPONSE_CODE_AMBIGUOUS = `${TRANSLATION_KEY_PREFIX}.field.responseCodeAmbiguous`;
const FIELD_WARN_NV_PAYLOAD_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.field.nvPayloadLengthMismatch`;
const FIELD_WARN_FOREIGN_FRAME_CODE_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.field.foreignFrameCodeUnknown`;
const FIELD_WARN_BODY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.bodyNotDecoded`;

// ── PPDU (ofset 0) — `lcs_link.c:39` `BITS3(priority, 1, altPath, 1, deltaBL, 6)`
const PPDU_PRIORITY_MASK = 0x80;
const PPDU_ALT_PATH_MASK = 0x40;
const PPDU_DELTA_BACKLOG_MASK = 0x3f;

// ── NPDU (ofset 1) — `lcs_network.c:31` `BITS4(2,2,2,2)`
const NPDU_VERSION_SHIFT = 6;
const NPDU_PDU_FORMAT_SHIFT = 4;
const NPDU_ADDRESS_FORMAT_SHIFT = 2;
const TWO_BIT_MASK = 0x03;

export const PDU_FORMAT_TPDU = 0;
export const PDU_FORMAT_SPDU = 1;
export const PDU_FORMAT_AUTHPDU = 2;
export const PDU_FORMAT_APDU = 3;

const PDU_FORMAT_NAMES = ['TPDU', 'SPDU', 'AuthPDU', 'APDU'] as const;

export const ADDRESS_FORMAT_BROADCAST = 0;
export const ADDRESS_FORMAT_MULTICAST = 1;
export const ADDRESS_FORMAT_UNICAST = 2;
export const ADDRESS_FORMAT_UID = 3;

const ADDRESS_FORMAT_NAMES = ['Broadcast', 'Multicast', 'Unicast (2a/2b)', 'Neuron ID (UID)'] as const;

/** `0/1/2/3 → 0/1/3/6` — `2` ÜÇ bayttır (dosya başı). */
const DOMAIN_LENGTHS = [0, 1, 3, 6] as const;

const NODE_SELECTOR_MASK = 0x80;
const NODE_NUMBER_MASK = 0x7f;
const NEURON_ID_LENGTH = 6;
const PROGRAM_ID_LENGTH = 8;

/** `lcs_tsa.c:80` `BITS3(auth, 1, pduMsgType, 3, transNum, 4)`. */
const TSA_AUTH_MASK = 0x80;
const TSA_TYPE_SHIFT = 4;
const TSA_TYPE_MASK = 0x07;
const TSA_TRANSACTION_MASK = 0x0f;
/** AuthPDU: `lcs_tsa.c:89` `BITS3(fmt, 2, pduMsgType, 2, transNum, 4)` — TUZAK 2. */
const AUTH_FMT_SHIFT = 6;
const AUTH_TYPE_SHIFT = 4;
const AUTH_BODY_LENGTH = 9;

const TPDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'ACKD'],
  [1, 'UnACKD_RPT'],
  [2, 'ACK'],
  [4, 'REMINDER'],
  [5, 'REM/MSG'],
]);

const SPDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'REQUEST'],
  [2, 'RESPONSE'],
  [4, 'REMINDER'],
  [5, 'REM/MSG'],
]);

const AUTHPDU_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'CHALLENGE'],
  [2, 'REPLY'],
]);

const TPDU_TYPE_REMINDER = 4;
const TPDU_TYPE_REM_MSG = 5;
const SPDU_TYPE_RESPONSE = 2;

/** `packet-lon.c:80-103` — 20 kod. Adlar PROTOKOL VERİSİDİR, çeviriye girmez. */
const NM_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x61, 'NM_QUERY_ID'],
  [0x62, 'NM_RESPOND_TO_QUERY'],
  [0x63, 'NM_UPDATE_DOMAIN'],
  [0x64, 'NM_LEAVE_DOMAIN'],
  [0x65, 'NM_UPDATE_KEY'],
  [0x66, 'NM_UPDATE_ADDR'],
  [0x67, 'NM_QUERY_ADDR'],
  [0x68, 'NM_QUERY_NV_CNFG'],
  [0x69, 'NM_UPDATE_GROUP_ADDR'],
  [0x6a, 'NM_QUERY_DOMAIN'],
  [0x6b, 'NM_UPDATE_NV_CNFG'],
  [0x6c, 'NM_SET_NODE_MODE'],
  [0x6d, 'NM_READ_MEMORY'],
  [0x6e, 'NM_WRITE_MEMORY'],
  [0x6f, 'NM_CHECKSUM_RECALC'],
  [0x70, 'NM_WINK'],
  [0x71, 'NM_MEMORY_REFRESH'],
  [0x72, 'NM_QUERY_SNVT'],
  [0x73, 'NM_NV_FETCH'],
  [0x7f, 'NM_MANUAL_SERVICE_REQUEST'],
]);

/** `packet-lon.c:105-112` — 4 kod. */
const ND_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x51, 'ND_QUERY_STATUS'],
  [0x52, 'ND_PROXY_COMMAND'],
  [0x53, 'ND_CLEAR_STATUS'],
  [0x54, 'ND_QUERY_XCVR'],
]);

const NM_MANUAL_SERVICE_REQUEST = 0x7f;

export const NEURON_ID_AS_TRANSMITTED = 'as-transmitted';
export const NEURON_ID_REVERSED = 'reversed';
export const FOREIGN_FRAME_LABELS_NUMERIC = 'numeric';
export const FOREIGN_FRAME_LABELS_HIDE = 'hide';

export interface LonTalkDecodeOptions {
  readonly nvPayloadType: string;
  readonly neuronIdByteOrder: string;
  readonly foreignFrameCodeLabels: string;
}

export interface LonTalkSummary {
  readonly readable: boolean;
  readonly pduFormat: number;
  readonly addressFormat: number;
  /** 2a → `true`, 2b → `false`; başka biçimlerde `undefined`. */
  readonly unicastSelector: boolean | undefined;
  readonly domainLength: number;
  readonly transactionNumber: number | undefined;
  readonly pduTypeName: string | undefined;
  /** PDU'nun sonundan sonraki mutlak ofset. */
  readonly end: number;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function hex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * NM/ND yanıt kodu ÇAKIŞMASININ iki adayını hesaplar (dosya başı).
 * NM: `00pxxxxx` → komut `0x60 | xxxxx`. ND: `00p1xxxx` → komut `0x50 | xxxx`.
 * İkisi de KATALOGDA varsa çakışma gerçektir; yoksa aday sayısı düşer.
 */
export function responseCodeCandidates(applicationCode: number): readonly string[] {
  const success = (applicationCode & 0x20) !== 0;
  const outcome = success ? 'success' : 'failure';
  const candidates: string[] = [];

  const nmCommand = 0x60 | (applicationCode & 0x1f);
  const nmName = NM_CODE_NAMES.get(nmCommand);
  if (nmName !== undefined) {
    candidates.push(`${nmName} (${hex(nmCommand, 2)}) ${outcome} response`);
  }

  if ((applicationCode & 0x10) !== 0) {
    const ndCommand = 0x50 | (applicationCode & 0x0f);
    const ndName = ND_CODE_NAMES.get(ndCommand);
    if (ndName !== undefined) {
      candidates.push(`${ndName} (${hex(ndCommand, 2)}) ${outcome} response`);
    }
  }

  return candidates;
}

/**
 * LonTalk PDU'sunu çözer. `baseOffset` PDU'nun MUTLAK başlangıcıdır; tüm
 * `ParsedField.offset` değerleri mutlaktır (byte-viewer bunu vurguluyor).
 */
export function decodeLonTalkPdu(
  data: Uint8Array,
  baseOffset: number,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: LonTalkDecodeOptions,
): LonTalkSummary {
  const truncated = (offset: number, message: string): LonTalkSummary => {
    errors.push({
      code: 'truncated-frame',
      message,
      offset,
      length: Math.max(0, data.length - offset),
    });
    return {
      readable: false,
      pduFormat: -1,
      addressFormat: -1,
      unicastSelector: undefined,
      domainLength: 0,
      transactionNumber: undefined,
      pduTypeName: undefined,
      end: data.length,
    };
  };

  // PPDU + NPDU için asgari iki bayt.
  if (baseOffset + 2 > data.length) {
    return truncated(baseOffset, ERROR_PDU_TRUNCATED);
  }

  // ── PPDU okteti ─────────────────────────────────────────────────────────
  const ppdu = byteAt(data, baseOffset);
  const ppduBytes = data.slice(baseOffset, baseOffset + 1);
  const priority = (ppdu & PPDU_PRIORITY_MASK) !== 0;
  pushField(sink, {
    id: 'lontalk-priority',
    name: 'LonTalk · L2 · Priority',
    offset: baseOffset,
    length: 1,
    rawBytes: ppduBytes,
    rawValue: priority ? 1 : 0,
    physicalValue: priority ? 'priority slot' : 'non-priority',
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: 'lontalk-alt-path',
    name: 'LonTalk · L2 · Alternate Path',
    offset: baseOffset,
    length: 1,
    rawBytes: ppduBytes,
    rawValue: (ppdu & PPDU_ALT_PATH_MASK) !== 0 ? 1 : 0,
    physicalValue: (ppdu & PPDU_ALT_PATH_MASK) !== 0 ? 'alternate path' : 'primary path',
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: 'lontalk-delta-backlog',
    name: 'LonTalk · L2 · Delta Backlog',
    offset: baseOffset,
    length: 1,
    rawBytes: ppduBytes,
    rawValue: ppdu & PPDU_DELTA_BACKLOG_MASK,
    physicalValue: String(ppdu & PPDU_DELTA_BACKLOG_MASK),
    valid: true,
    warnings: [],
  });

  // ── NPDU okteti ─────────────────────────────────────────────────────────
  const npduOffset = baseOffset + 1;
  const npdu = byteAt(data, npduOffset);
  const npduBytes = data.slice(npduOffset, npduOffset + 1);
  const version = (npdu >> NPDU_VERSION_SHIFT) & TWO_BIT_MASK;
  const pduFormat = (npdu >> NPDU_PDU_FORMAT_SHIFT) & TWO_BIT_MASK;
  const addressFormat = (npdu >> NPDU_ADDRESS_FORMAT_SHIFT) & TWO_BIT_MASK;
  const domainCode = npdu & TWO_BIT_MASK;
  const domainLength = DOMAIN_LENGTHS[domainCode] ?? 0;

  pushField(sink, {
    id: 'lontalk-npdu-version',
    name: 'LonTalk · NPDU · Version',
    offset: npduOffset,
    length: 1,
    rawBytes: npduBytes,
    rawValue: version,
    physicalValue: String(version),
    valid: true,
    warnings: version === 0 ? [] : [FIELD_WARN_PATH_NOT_VERIFIED],
  });
  if (version !== 0) {
    warnings.push(
      toProtocolWarning('unexpectedLonTalkVersion', WARN_UNEXPECTED_LONTALK_VERSION, npduOffset, 1),
    );
  }

  pushField(sink, {
    id: 'lontalk-pdu-format',
    name: 'LonTalk · NPDU · PDU Format',
    offset: npduOffset,
    length: 1,
    rawBytes: npduBytes,
    rawValue: pduFormat,
    physicalValue: PDU_FORMAT_NAMES[pduFormat] ?? 'unknown',
    valid: true,
    warnings: pduFormat === PDU_FORMAT_AUTHPDU ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
  });

  const addressVerified = addressFormat === ADDRESS_FORMAT_BROADCAST || addressFormat === ADDRESS_FORMAT_UNICAST;
  pushField(sink, {
    id: 'lontalk-address-format',
    name: 'LonTalk · NPDU · Address Format',
    offset: npduOffset,
    length: 1,
    rawBytes: npduBytes,
    rawValue: addressFormat,
    physicalValue: ADDRESS_FORMAT_NAMES[addressFormat] ?? 'unknown',
    valid: true,
    warnings: addressVerified ? [] : [FIELD_WARN_PATH_NOT_VERIFIED],
  });

  pushField(sink, {
    id: 'lontalk-domain-length',
    name: 'LonTalk · NPDU · Domain Length',
    offset: npduOffset,
    length: 1,
    rawBytes: npduBytes,
    rawValue: domainCode,
    physicalValue: `${String(domainLength)} B`,
    valid: true,
    warnings: domainLength <= 1 ? [] : [FIELD_WARN_PATH_NOT_VERIFIED],
  });

  let unverifiedPath = !addressVerified || domainLength > 1 || pduFormat === PDU_FORMAT_AUTHPDU;

  // ── Adres bölümü ────────────────────────────────────────────────────────
  const addressOffset = baseOffset + 2;
  const sourceNodeByte = byteAt(data, addressOffset + 1);
  const selectorBit = (sourceNodeByte & NODE_SELECTOR_MASK) !== 0;
  let unicastSelector: boolean | undefined;
  let addressLength: number;
  if (addressFormat === ADDRESS_FORMAT_UNICAST) {
    unicastSelector = selectorBit;
    addressLength = selectorBit ? 4 : 6;
  } else if (addressFormat === ADDRESS_FORMAT_UID) {
    addressLength = 3 + NEURON_ID_LENGTH;
  } else {
    addressLength = 3;
  }
  if (addressOffset + addressLength > data.length) {
    return truncated(addressOffset, ERROR_ADDRESS_TRUNCATED);
  }

  pushField(sink, {
    id: 'lontalk-src-subnet',
    name: 'LonTalk · Source Subnet',
    offset: addressOffset,
    length: 1,
    rawBytes: data.slice(addressOffset, addressOffset + 1),
    rawValue: byteAt(data, addressOffset),
    physicalValue: String(byteAt(data, addressOffset)),
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: 'lontalk-src-node',
    name: 'LonTalk · Source Node',
    offset: addressOffset + 1,
    length: 1,
    rawBytes: data.slice(addressOffset + 1, addressOffset + 2),
    // Ham bayt SELEKTÖR bitini de taşır; maskelenen bit `rawValue`da görünür kalır.
    rawValue: hex(sourceNodeByte, 2),
    physicalValue:
      addressFormat === ADDRESS_FORMAT_UNICAST
        ? `${String(sourceNodeByte & NODE_NUMBER_MASK)} (selector bit ${selectorBit ? '1 → format 2a' : '0 → format 2b'})`
        : String(sourceNodeByte & NODE_NUMBER_MASK),
    valid: true,
    warnings: [],
  });

  const thirdOffset = addressOffset + 2;
  if (addressFormat === ADDRESS_FORMAT_MULTICAST) {
    pushField(sink, {
      id: 'lontalk-dst-group',
      name: 'LonTalk · Destination Group',
      offset: thirdOffset,
      length: 1,
      rawBytes: data.slice(thirdOffset, thirdOffset + 1),
      rawValue: byteAt(data, thirdOffset),
      physicalValue: String(byteAt(data, thirdOffset)),
      valid: true,
      warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
    });
  } else {
    pushField(sink, {
      id: 'lontalk-dst-subnet',
      name: 'LonTalk · Destination Subnet',
      offset: thirdOffset,
      length: 1,
      rawBytes: data.slice(thirdOffset, thirdOffset + 1),
      rawValue: byteAt(data, thirdOffset),
      physicalValue:
        byteAt(data, thirdOffset) === 0 && addressFormat === ADDRESS_FORMAT_BROADCAST
          ? '0 (domain-wide broadcast)'
          : String(byteAt(data, thirdOffset)),
      valid: true,
      warnings: [],
    });
  }

  if (addressFormat === ADDRESS_FORMAT_UNICAST) {
    const dstNodeOffset = addressOffset + 3;
    const dstNodeByte = byteAt(data, dstNodeOffset);
    pushField(sink, {
      id: 'lontalk-dst-node',
      name: 'LonTalk · Destination Node',
      offset: dstNodeOffset,
      length: 1,
      rawBytes: data.slice(dstNodeOffset, dstNodeOffset + 1),
      rawValue: hex(dstNodeByte, 2),
      physicalValue: String(dstNodeByte & NODE_NUMBER_MASK),
      valid: true,
      warnings: [],
    });
    if (!selectorBit) {
      // 2b: +6 Group, +7 GrpMemb — Figure 3.2 (Wireshark burada YANLIŞ).
      const groupOffset = addressOffset + 4;
      pushField(sink, {
        id: 'lontalk-group',
        name: 'LonTalk · Group',
        offset: groupOffset,
        length: 1,
        rawBytes: data.slice(groupOffset, groupOffset + 1),
        rawValue: byteAt(data, groupOffset),
        physicalValue: String(byteAt(data, groupOffset)),
        valid: true,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
      pushField(sink, {
        id: 'lontalk-group-member',
        name: 'LonTalk · Group Member',
        offset: groupOffset + 1,
        length: 1,
        rawBytes: data.slice(groupOffset + 1, groupOffset + 2),
        rawValue: byteAt(data, groupOffset + 1),
        physicalValue: String(byteAt(data, groupOffset + 1)),
        valid: true,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
    }
  } else if (addressFormat === ADDRESS_FORMAT_UID) {
    const uidOffset = addressOffset + 3;
    const uidBytes = data.slice(uidOffset, uidOffset + NEURON_ID_LENGTH);
    const ordered =
      options.neuronIdByteOrder === NEURON_ID_REVERSED
        ? Uint8Array.from([...uidBytes].reverse())
        : uidBytes;
    pushField(sink, {
      id: 'lontalk-neuron-id',
      name: 'LonTalk · Destination Neuron ID',
      offset: uidOffset,
      length: NEURON_ID_LENGTH,
      rawBytes: uidBytes,
      rawValue: hexBytes(uidBytes),
      physicalValue:
        options.neuronIdByteOrder === NEURON_ID_REVERSED
          ? `${hexBytes(ordered)} (reversed by user)`
          : hexBytes(ordered),
      valid: true,
      warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
    });
  }

  // ── Domain alanı ────────────────────────────────────────────────────────
  const domainOffset = addressOffset + addressLength;
  if (domainOffset + domainLength > data.length) {
    return truncated(domainOffset, ERROR_DOMAIN_TRUNCATED);
  }
  if (domainLength > 0) {
    const domainBytes = data.slice(domainOffset, domainOffset + domainLength);
    pushField(sink, {
      id: 'lontalk-domain',
      name: 'LonTalk · Domain',
      offset: domainOffset,
      length: domainLength,
      rawBytes: domainBytes,
      rawValue: hexBytes(domainBytes),
      physicalValue: `${String(domainLength)}-byte domain`,
      valid: true,
      warnings: domainLength > 1 ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
    });
  } else {
    pushField(sink, {
      id: 'lontalk-domain',
      name: 'LonTalk · Domain',
      offset: domainOffset,
      length: 0,
      rawBytes: new Uint8Array(0),
      rawValue: 0,
      physicalValue: 'zero-length domain (domain-wide)',
      valid: true,
      warnings: [],
    });
  }

  // ── Transport / Session / Auth okteti ───────────────────────────────────
  let cursor = domainOffset + domainLength;
  let transactionNumber: number | undefined;
  let pduTypeName: string | undefined;
  let pduType: number | undefined;

  if (pduFormat !== PDU_FORMAT_APDU) {
    if (cursor >= data.length) {
      // Gerçek yakalamanın 12.028 çerçevesinden TEK böyle çerçeve var.
      return truncated(cursor, ERROR_TRANSPORT_OCTET_MISSING);
    }
    const octet = byteAt(data, cursor);
    const octetBytes = data.slice(cursor, cursor + 1);
    transactionNumber = octet & TSA_TRANSACTION_MASK;

    if (pduFormat === PDU_FORMAT_AUTHPDU) {
      const authFmt = (octet >> AUTH_FMT_SHIFT) & TWO_BIT_MASK;
      pduType = (octet >> AUTH_TYPE_SHIFT) & TWO_BIT_MASK;
      pduTypeName = AUTHPDU_TYPE_NAMES.get(pduType);
      pushField(sink, {
        id: 'lontalk-auth-format',
        name: 'LonTalk · AuthPDU · Address Format Echo',
        offset: cursor,
        length: 1,
        rawBytes: octetBytes,
        rawValue: authFmt,
        physicalValue: ADDRESS_FORMAT_NAMES[authFmt] ?? 'unknown',
        valid: true,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
    } else {
      pduType = (octet >> TSA_TYPE_SHIFT) & TSA_TYPE_MASK;
      pduTypeName =
        pduFormat === PDU_FORMAT_TPDU ? TPDU_TYPE_NAMES.get(pduType) : SPDU_TYPE_NAMES.get(pduType);
      pushField(sink, {
        id: 'lontalk-tsa-auth',
        name: `LonTalk · ${pduFormat === PDU_FORMAT_TPDU ? 'TPDU' : 'SPDU'} · Authenticated`,
        offset: cursor,
        length: 1,
        rawBytes: octetBytes,
        rawValue: (octet & TSA_AUTH_MASK) !== 0 ? 1 : 0,
        physicalValue: (octet & TSA_AUTH_MASK) !== 0 ? 'authenticated' : 'not authenticated',
        valid: true,
        warnings: [],
      });
    }

    pushField(sink, {
      id: 'lontalk-tsa-type',
      name: `LonTalk · ${PDU_FORMAT_NAMES[pduFormat] ?? 'PDU'} · Type`,
      offset: cursor,
      length: 1,
      rawBytes: octetBytes,
      rawValue: pduType,
      physicalValue: pduTypeName ?? 'unknown type',
      valid: pduTypeName !== undefined,
      warnings: pduTypeName === undefined ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
    });
    pushField(sink, {
      id: 'lontalk-transaction',
      name: 'LonTalk · Transaction Number',
      offset: cursor,
      length: 1,
      rawBytes: octetBytes,
      rawValue: transactionNumber,
      physicalValue: String(transactionNumber),
      valid: true,
      warnings: [],
    });
    cursor += 1;

    // REMINDER / REM-MSG: `M_Len` + `M_List` (`packet-lon.c:325-345`).
    if (
      pduFormat !== PDU_FORMAT_AUTHPDU &&
      (pduType === TPDU_TYPE_REMINDER || pduType === TPDU_TYPE_REM_MSG)
    ) {
      unverifiedPath = true;
      if (cursor >= data.length) {
        return truncated(cursor, ERROR_PDU_TRUNCATED);
      }
      const mLen = byteAt(data, cursor);
      pushField(sink, {
        id: 'lontalk-m-len',
        name: 'LonTalk · M_Len',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: mLen,
        physicalValue: `${String(mLen)} B M_List follows`,
        valid: true,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
      cursor += 1;
      const mListEnd = Math.min(data.length, cursor + mLen);
      if (mLen > 0) {
        pushField(sink, {
          id: 'lontalk-m-list',
          name: 'LonTalk · M_List',
          offset: cursor,
          length: mListEnd - cursor,
          rawBytes: data.slice(cursor, mListEnd),
          rawValue: hexBytes(data.slice(cursor, mListEnd)),
          valid: mListEnd - cursor === mLen,
          warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
        });
      }
      cursor = mListEnd;
      if (pduType === TPDU_TYPE_REMINDER) {
        // REMINDER'da APDU YOKTUR.
        pushUnverifiedWarning(warnings, unverifiedPath);
        return summaryOf(pduFormat, addressFormat, unicastSelector, domainLength, transactionNumber, pduTypeName, data.length);
      }
    }

    // AuthPDU gövdesi 9 bayt (`packet-lon.c:414-417`); yakalamada örnek YOK.
    if (pduFormat === PDU_FORMAT_AUTHPDU) {
      const bodyEnd = Math.min(data.length, cursor + AUTH_BODY_LENGTH);
      if (bodyEnd > cursor) {
        pushField(sink, {
          id: 'lontalk-auth-body',
          name: 'LonTalk · AuthPDU · Challenge/Reply Body',
          offset: cursor,
          length: bodyEnd - cursor,
          rawBytes: data.slice(cursor, bodyEnd),
          rawValue: hexBytes(data.slice(cursor, bodyEnd)),
          valid: bodyEnd - cursor === AUTH_BODY_LENGTH,
          warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
        });
      }
      pushUnverifiedWarning(warnings, unverifiedPath);
      return summaryOf(pduFormat, addressFormat, unicastSelector, domainLength, transactionNumber, pduTypeName, data.length);
    }
  }

  // ── APDU ────────────────────────────────────────────────────────────────
  if (cursor < data.length) {
    const apduUnverified = decodeApdu(
      data,
      cursor,
      sink,
      warnings,
      options,
      pduFormat === PDU_FORMAT_SPDU && pduType === SPDU_TYPE_RESPONSE,
    );
    unverifiedPath = unverifiedPath || apduUnverified;
  }

  pushUnverifiedWarning(warnings, unverifiedPath);
  return summaryOf(pduFormat, addressFormat, unicastSelector, domainLength, transactionNumber, pduTypeName, data.length);
}

function summaryOf(
  pduFormat: number,
  addressFormat: number,
  unicastSelector: boolean | undefined,
  domainLength: number,
  transactionNumber: number | undefined,
  pduTypeName: string | undefined,
  end: number,
): LonTalkSummary {
  return {
    readable: true,
    pduFormat,
    addressFormat,
    unicastSelector,
    domainLength,
    transactionNumber,
    pduTypeName,
    end,
  };
}

function pushUnverifiedWarning(warnings: ProtocolWarning[], unverified: boolean): void {
  if (!unverified) return;
  warnings.push(toProtocolWarning('decodePathNotVerified', WARN_DECODE_PATH_NOT_VERIFIED));
}

/**
 * APDU'nun `dest&type` baytı — NORMATİF kod uzayı (`spec.txt:3716-3730`):
 * `1dxxxxxx` NV (2 bayt, 14 bit selector) · `011xxxxx` NM · `0101xxxx` ND ·
 * `0100xxxx` Foreign Frame · `00xxxxxx` generic application message.
 * Beş dal `0x00`–`0xFF`in TAMAMINI kaplar — "buraya düşemez" dalı yazılmaz.
 *
 * Dönüş: doğrulanmamış bir yola girildi mi.
 */
function decodeApdu(
  data: Uint8Array,
  offset: number,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  options: LonTalkDecodeOptions,
  insideSpduResponse: boolean,
): boolean {
  const code = byteAt(data, offset);
  const codeBytes = data.slice(offset, offset + 1);

  if (code >= 0x80) {
    // ── Network Variable ──────────────────────────────────────────────────
    const outgoing = (code & 0x40) !== 0;
    const selectorLow = byteAt(data, offset + 1);
    const selector = ((code & 0x3f) << 8) | selectorLow;
    const hasSecondByte = offset + 1 < data.length;
    pushField(sink, {
      id: 'lontalk-apdu-class',
      name: 'LonTalk · APDU · Class',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: hex(code, 2),
      physicalValue: 'Network Variable',
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: 'lontalk-nv-direction',
      name: 'LonTalk · NV · Direction',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: outgoing ? 1 : 0,
      physicalValue: outgoing ? 'outgoing' : 'incoming',
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: 'lontalk-nv-selector',
      name: 'LonTalk · NV · Selector (14 bit)',
      offset,
      length: hasSecondByte ? 2 : 1,
      rawBytes: data.slice(offset, offset + (hasSecondByte ? 2 : 1)),
      rawValue: selector,
      physicalValue: `${String(selector)} (${hex(selector, 4)}) — binding index, NOT a type`,
      valid: hasSecondByte,
      warnings: [FIELD_WARN_NV_TYPE_NOT_ON_WIRE],
    });

    const payloadOffset = offset + 2;
    const payload = data.slice(payloadOffset);
    if (payload.length > 0) {
      pushField(sink, {
        id: 'lontalk-nv-payload',
        name: 'LonTalk · NV · Value (raw)',
        offset: payloadOffset,
        length: payload.length,
        rawBytes: payload,
        rawValue: hexBytes(payload),
        valid: true,
        warnings: [FIELD_WARN_NV_TYPE_NOT_ON_WIRE],
      });
      decodeNvPayload(payload, payloadOffset, sink, warnings, options);
    }

    // KOŞULSUZ: tip telde YOK (`seatalk`in `commandBitNotInBytes`i ile aynı sınıf).
    warnings.push(
      toProtocolWarning('nvTypeNotOnWire', WARN_NV_TYPE_NOT_ON_WIRE, offset, hasSecondByte ? 2 : 1),
    );
    return false;
  }

  if (code < 0x40) {
    // ── Generic application message (NM/ND yanıtları da BU ARALIKTADIR) ───
    const candidates = insideSpduResponse ? responseCodeCandidates(code) : [];
    const ambiguous = candidates.length > 1;
    pushField(sink, {
      id: 'lontalk-apdu-class',
      name: 'LonTalk · APDU · Class',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: hex(code, 2),
      physicalValue: 'Application (generic)',
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: 'lontalk-app-code',
      name: 'LonTalk · Application Code',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: code & 0x3f,
      // Adaylar VERİDİR: uydurma bir "NM yanıtı" ADI basılmaz, iki okuma da yazılır.
      physicalValue:
        candidates.length === 0
          ? String(code & 0x3f)
          : `${String(code & 0x3f)} — ${candidates.join(' OR ')}`,
      valid: true,
      warnings: ambiguous ? [FIELD_WARN_RESPONSE_CODE_AMBIGUOUS] : [],
    });
    if (ambiguous) {
      warnings.push(
        toProtocolWarning('responseCodeAmbiguous', WARN_RESPONSE_CODE_AMBIGUOUS, offset, 1),
      );
    }
    pushApduBody(data, offset + 1, sink, 'lontalk-app-body', 'LonTalk · Application Body');
    return false;
  }

  if (code < 0x50) {
    // ── Foreign Frame — kodun ANLAM tablosu hiçbir kaynakta YOK ───────────
    pushField(sink, {
      id: 'lontalk-apdu-class',
      name: 'LonTalk · APDU · Class',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: hex(code, 2),
      physicalValue: 'Foreign Frame',
      valid: true,
      warnings: [],
    });
    if (options.foreignFrameCodeLabels !== FOREIGN_FRAME_LABELS_HIDE) {
      pushField(sink, {
        id: 'lontalk-foreign-code',
        name: 'LonTalk · Foreign Frame Code',
        offset,
        length: 1,
        rawBytes: codeBytes,
        rawValue: code & 0x0f,
        physicalValue: `${String(code & 0x0f)} — meaning not published in any source`,
        valid: true,
        warnings: [FIELD_WARN_FOREIGN_FRAME_CODE_UNKNOWN],
      });
    }
    warnings.push(
      toProtocolWarning('foreignFrameCodeUnknown', WARN_FOREIGN_FRAME_CODE_UNKNOWN, offset, 1),
    );
    pushApduBody(data, offset + 1, sink, 'lontalk-foreign-body', 'LonTalk · Foreign Frame Body');
    return true;
  }

  if (code < 0x60) {
    // ── Network Diagnostic ────────────────────────────────────────────────
    const name = ND_CODE_NAMES.get(code);
    pushField(sink, {
      id: 'lontalk-apdu-class',
      name: 'LonTalk · APDU · Class',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: hex(code, 2),
      physicalValue: 'Network Diagnostic',
      valid: true,
      warnings: [],
    });
    pushField(sink, {
      id: 'lontalk-nd-code',
      name: 'LonTalk · Network Diagnostic Code',
      offset,
      length: 1,
      rawBytes: codeBytes,
      rawValue: hex(code, 2),
      physicalValue: name ?? `unnamed diagnostic code ${String(code & 0x0f)}`,
      valid: name !== undefined,
      warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
    });
    pushApduBody(data, offset + 1, sink, 'lontalk-nd-body', 'LonTalk · Network Diagnostic Body');
    return true;
  }

  // ── Network Management ──────────────────────────────────────────────────
  const name = NM_CODE_NAMES.get(code);
  pushField(sink, {
    id: 'lontalk-apdu-class',
    name: 'LonTalk · APDU · Class',
    offset,
    length: 1,
    rawBytes: codeBytes,
    rawValue: hex(code, 2),
    physicalValue: 'Network Management',
    valid: true,
    warnings: [],
  });
  pushField(sink, {
    id: 'lontalk-nm-code',
    name: 'LonTalk · Network Management Code',
    offset,
    length: 1,
    rawBytes: codeBytes,
    rawValue: hex(code, 2),
    physicalValue: name ?? `unnamed management code ${String(code & 0x1f)}`,
    valid: name !== undefined,
    warnings: name === undefined ? [FIELD_WARN_PATH_NOT_VERIFIED] : [],
  });

  if (code === NM_MANUAL_SERVICE_REQUEST) {
    // Kodun ardından 6 bayt Neuron ID + 8 bayt Program ID (`packet-lon.c:466-472`).
    const idOffset = offset + 1;
    const idEnd = Math.min(data.length, idOffset + NEURON_ID_LENGTH);
    if (idEnd > idOffset) {
      pushField(sink, {
        id: 'lontalk-service-neuron-id',
        name: 'LonTalk · Manual Service Request · Neuron ID',
        offset: idOffset,
        length: idEnd - idOffset,
        rawBytes: data.slice(idOffset, idEnd),
        rawValue: hexBytes(data.slice(idOffset, idEnd)),
        valid: idEnd - idOffset === NEURON_ID_LENGTH,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
    }
    const programOffset = idOffset + NEURON_ID_LENGTH;
    const programEnd = Math.min(data.length, programOffset + PROGRAM_ID_LENGTH);
    if (programEnd > programOffset) {
      pushField(sink, {
        id: 'lontalk-program-id',
        name: 'LonTalk · Manual Service Request · Program ID',
        offset: programOffset,
        length: programEnd - programOffset,
        rawBytes: data.slice(programOffset, programEnd),
        rawValue: hexBytes(data.slice(programOffset, programEnd)),
        valid: programEnd - programOffset === PROGRAM_ID_LENGTH,
        warnings: [FIELD_WARN_PATH_NOT_VERIFIED],
      });
    }
    return true;
  }

  pushApduBody(data, offset + 1, sink, 'lontalk-nm-body', 'LonTalk · Network Management Body');
  return name === undefined;
}

function pushApduBody(
  data: Uint8Array,
  offset: number,
  sink: FieldSink,
  id: string,
  name: string,
): void {
  if (offset >= data.length) return;
  pushField(sink, {
    id,
    name,
    offset,
    length: data.length - offset,
    rawBytes: data.slice(offset),
    rawValue: hexBytes(data.slice(offset)),
    valid: true,
    warnings: [FIELD_WARN_BODY_NOT_DECODED],
  });
}

/**
 * NV yükünü kullanıcının BİLDİRDİĞİ SNVT tipiyle ölçekler. Tip seçilmemişse
 * hiçbir şey basılmaz — ham değer zaten yukarıda var. Uzunluk uymuyorsa
 * çevrim YAPILMAZ: uydurma bir mühendislik değeri basmak yerine uyarılır.
 */
function decodeNvPayload(
  payload: Uint8Array,
  payloadOffset: number,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  options: LonTalkDecodeOptions,
): void {
  if (options.nvPayloadType === SNVT_RAW) return;
  const type = findSnvtType(options.nvPayloadType);
  if (type === undefined) return;

  if (payload.length !== type.size) {
    pushField(sink, {
      id: 'lontalk-nv-scaled',
      name: `LonTalk · NV · ${type.name} (declared by user)`,
      offset: payloadOffset,
      length: payload.length,
      rawBytes: payload,
      rawValue: hexBytes(payload),
      physicalValue: `not scaled — ${type.name} is ${String(type.size)} B, payload is ${String(payload.length)} B`,
      valid: false,
      warnings: [FIELD_WARN_NV_PAYLOAD_LENGTH_MISMATCH],
    });
    warnings.push(
      toProtocolWarning(
        'nvPayloadLengthMismatch',
        WARN_NV_PAYLOAD_LENGTH_MISMATCH,
        payloadOffset,
        payload.length,
      ),
    );
    return;
  }

  const rawValue = readSnvtRawValue(payload, type);
  if (rawValue === undefined) return;
  const scaled = applySnvtScale(rawValue, type);
  pushField(sink, {
    id: 'lontalk-nv-scaled',
    name: `LonTalk · NV · ${type.name} (declared by user)`,
    offset: payloadOffset,
    length: payload.length,
    rawBytes: payload,
    rawValue,
    physicalValue: scaled,
    // Ölçek LonMark tarafından YAYIMLANMIŞTIR; birim gerçek fiziksel birimdir.
    ...(type.unit === undefined ? {} : { unit: type.unit }),
    valid: true,
    warnings: [FIELD_WARN_NV_TYPE_NOT_ON_WIRE],
  });
}
