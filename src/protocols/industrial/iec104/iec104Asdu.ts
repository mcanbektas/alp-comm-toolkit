/**
 * IEC 60870-5-104 ASDU (Application Service Data Unit) çözüm çekirdeği.
 *
 * BİLEREK `iec104.ts`den (APCI) AYRI bir modülde: ASDU alan sırası — Type
 * Identification, Variable Structure Qualifier, Cause of Transmission, Common
 * Address, Information Object'ler — IEC 60870-5-101'in seri profiliyle de
 * ORTAKTIR; yalnız Common Address/Information Object Address genişlikleri
 * 101'de profile-bağımlıdır (brief-faz10-dalga5.md Karar 3: "kullanıcı
 * tarafından seçilebilmeli veya project profile'dan", spec 9241-9251). 101 bu
 * dalgada YAZILMIYOR (katalogda `planned` kalıyor) ama ileride aynı çekirdeği
 * `widths` parametresiyle çağırabilir — bu yüzden genişlikler burada sabit
 * gömülmedi, `AsduWidths` ile parametreleştirildi (varsayılan: 104 profili).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * IEC 60870-5-104'ün resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki Type
 * Identification / Cause of Transmission tabloları ve information element
 * genişlikleri ÜÇ bağımsız kamuya açık ikincil kaynaktan ÇAPRAZ TEYİTLE
 * alındı:
 *   1. Wireshark'ın `packet-iec104.c` dissector'ının alenen yayımlanan
 *      `asdu_types[]` (Type ID) ve `causetx_types[]` (COT) value_string
 *      tabloları, ve `get_NVA`/`get_SVA`/`get_FLT`/`get_SCO`/`get_DCO`/
 *      `get_RCO`/`get_QOI`/`get_QCC`/CP24Time2a/CP56Time2a fonksiyonlarındaki
 *      ofset artışları (element genişlikleri) —
 *      https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-iec104.c
 *   2. `viduq/iec104-cheat-sheet` — kamuya açık IEC-104 tanıtım/özet
 *      dokümanı, aynı Type ID/COT kümesini bağımsızca doğruluyor —
 *      https://github.com/viduq/iec104-cheat-sheet
 *   3. Genel IEC 60870-5-104 birincil alan genişlikleri (CP56Time2a=7 bayt,
 *      SIQ/DIQ=1 bayt) çok sayıda bağımsız uygulama dokümanında (Beckhoff
 *      TwinCAT IEC60870 dokümantasyonu, arama sonuçlarındaki bağımsız
 *      referans sayfaları) tutarlı biçimde tekrarlanıyor.
 * Yalnız İKİ kaynakta da AYNI adla/genişlikte geçen alanlar adlandırıldı/
 * genişliği bilinir sayıldı; GPL'li projelerden (varsa) KOD alınmadı, yalnız
 * format bilgisi kullanıldı. Teyit edilemeyen bir alanı TAHMİN ETMEK yerine
 * (spec 7259'un "tahmin ederek üretme" emri, DNP3 emsali) ham bırakıldı —
 * bkz. aşağıda `ELEMENT_WIDTH_TABLE`'ın neden dar tutulduğuna dair not.
 *
 * ── ELEMENT GENİŞLİK TABLOSU NEDEN DAR (tuzak) ──────────────────────────────
 * `count` (VSQ'nun alt 7 biti) 1'den büyükse ASDU birden çok Information
 * Object taşır ve bir sonraki objenin nerede başladığını bulmak için BU
 * objenin toplam genişliğini (IOA + element) bilmek GEREKİR. Genişliği
 * teyitsiz bir tip için "tahmin ederek" yürümek, ikinci objenin alanlarını
 * YANLIŞ konumda gösterir — sessiz-yanlış decode, motorun en tehlikeli hatası
 * (mavlink.ts `crcNeedsDialect` emsali: doğrulanamayan alan ham + uyarı,
 * mismatch/yanlış hizalama asla basılmaz). Bu yüzden `ELEMENT_WIDTH_TABLE`
 * yalnız İKİ kaynakta da AÇIKÇA doğrulanmış genişlikleri taşır; `count > 1` ve
 * tip bu tabloda YOKSA motor teslim olur, TÜM Information Object'leri TEK ham
 * blok basar (`WARN_MULTIPLE_OBJECTS_UNKNOWN_WIDTH`) — DNP3'ün blok-sınırı-
 * aşan-alan tuzağıyla (`WARN_HEADER_SPANS_BLOCK_BOUNDARY`) aynı dürüstlük.
 * `count === 1` durumunda bu risk YOKTUR: tek obje olduğu için "kalan tüm
 * bayt" güvenle o objenin elemanı sayılabilir, genişlik bilgisi gerekmez.
 *
 * ── TAM ÇÖZÜLEN TEK ELEMENT: SIQ (M_SP_NA_1) ────────────────────────────────
 * Brief madde 3 "yalnız çift-teyitli birkaç basit tip" çizgisi gereği yalnız
 * M_SP_NA_1'in SIQ baytı bit bit çözülür (SPI + BL/SB/NT/IV kalite bitleri,
 * her iki kaynakta da aynı bit sırasıyla doğrulandı). Diğer tüm tipler HAM
 * "Information Element" bloğu olarak gösterilir — genişlikleri biliniyor
 * olsa bile (ör. M_ME_NC_1) içerik yorumlanmaz, yalnız yürüyüş için kullanılır.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

const HEX_RADIX = 16;

const WARN_UNKNOWN_TYPE_ID = 'protocol.iec104.warning.unknownTypeId';
const WARN_UNKNOWN_CAUSE_OF_TRANSMISSION = 'protocol.iec104.warning.unknownCauseOfTransmission';
const WARN_INFORMATION_ELEMENT_NEEDS_TYPE_DECODE =
  'protocol.iec104.warning.informationElementNeedsTypeDecode';
const WARN_MULTIPLE_OBJECTS_UNKNOWN_WIDTH = 'protocol.iec104.warning.multipleObjectsUnknownWidth';

const ERROR_ASDU_TRUNCATED = 'protocol.iec104.error.asduTruncated';

/** VSQ (Variable Structure Qualifier) — SQ biti + 7-bit nesne sayısı. */
const VSQ_BIT_SQ = 0x80;
const VSQ_MASK_COUNT = 0x7f;

/** COT baytı — T (test) ve P/N (negatif onay) bayrakları + 6-bit neden kodu. */
const COT_BIT_TEST = 0x80;
const COT_BIT_NEGATIVE = 0x40;
const COT_MASK_CAUSE = 0x3f;

/** SIQ (Single-point Information Qualifier) bit konumları — iki kaynakta da aynı sıra. */
const SIQ_BIT_SPI = 0x01;
const SIQ_BIT_BL = 0x10;
const SIQ_BIT_SB = 0x20;
const SIQ_BIT_NT = 0x40;
const SIQ_BIT_IV = 0x80;

/** M_SP_NA_1'in Type ID'si — SIQ tam çözümünün tek istisnası (dosya başı not). */
const TYPE_ID_SINGLE_POINT_INFORMATION = 1;

/**
 * Type Identification — dar, ÇİFT kaynak teyitli küme (dosya başı kaynak
 * uyarısı). Mnemonik + kısa açıklama; protokol terimi, veridir, çevrilmez.
 */
const TYPE_ID_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'M_SP_NA_1 — Single-point information'],
  [3, 'M_DP_NA_1 — Double-point information'],
  [9, 'M_ME_NA_1 — Measured value, normalized value'],
  [11, 'M_ME_NB_1 — Measured value, scaled value'],
  [13, 'M_ME_NC_1 — Measured value, short floating point number'],
  [15, 'M_IT_NA_1 — Integrated totals'],
  [30, 'M_SP_TB_1 — Single-point information with time tag CP56Time2a'],
  [31, 'M_DP_TB_1 — Double-point information with time tag CP56Time2a'],
  [34, 'M_ME_TD_1 — Measured value, normalized value with time tag CP56Time2a'],
  [35, 'M_ME_TE_1 — Measured value, scaled value with time tag CP56Time2a'],
  [36, 'M_ME_TF_1 — Measured value, short floating point number with time tag CP56Time2a'],
  [45, 'C_SC_NA_1 — Single command'],
  [46, 'C_DC_NA_1 — Double command'],
  [47, 'C_RC_NA_1 — Regulating step command'],
  [100, 'C_IC_NA_1 — Interrogation command'],
  [101, 'C_CI_NA_1 — Counter interrogation command'],
  [103, 'C_CS_NA_1 — Clock synchronization command'],
]);

/**
 * Element genişliği (IOA HARİÇ, bayt) — yalnız `count > 1` yürüyüşü için
 * kullanılır (dosya başı "neden dar" notu). `1` (M_SP_NA_1) ayrıca tam bit
 * çözümü de alır (bkz. `decodeInformationElement`), gerisi genişlik bilinse
 * bile HAM kalır.
 */
const ELEMENT_WIDTH_TABLE: ReadonlyMap<number, number> = new Map([
  [1, 1], // SIQ
  [3, 1], // DIQ
  [9, 3], // NVA(2) + QDS(1)
  [11, 3], // SVA(2) + QDS(1)
  [13, 5], // FLT(4) + QDS(1)
  [30, 8], // SIQ(1) + CP56Time2a(7)
  [31, 8], // DIQ(1) + CP56Time2a(7)
  [34, 10], // NVA(2) + QDS(1) + CP56Time2a(7)
  [35, 10], // SVA(2) + QDS(1) + CP56Time2a(7)
  [36, 12], // FLT(4) + QDS(1) + CP56Time2a(7)
  [45, 1], // SCO
  [46, 1], // DCO
  [47, 1], // RCO
  [100, 1], // QOI
  [101, 1], // QCC
  [103, 7], // CP56Time2a
]);

/** Cause of Transmission — dar, ÇİFT kaynak teyitli küme (dosya başı kaynak uyarısı). */
const COT_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Periodic/cyclic'],
  [2, 'Background scan'],
  [3, 'Spontaneous'],
  [4, 'Initialized'],
  [5, 'Request'],
  [6, 'Activation'],
  [7, 'Activation confirmation'],
  [8, 'Deactivation'],
  [9, 'Deactivation confirmation'],
  [10, 'Activation termination'],
  [11, 'Return info caused by a remote command'],
  [12, 'Return info caused by a local command'],
  [13, 'File transfer'],
  [20, 'Interrogated by general interrogation'],
  [37, 'Requested by general counter request'],
  [44, 'Unknown type identification'],
  [45, 'Unknown cause of transmission'],
  [46, 'Unknown common address of ASDU'],
  [47, 'Unknown information object address'],
]);

/** 104 profili sabit genişlikleri (spec/kaynaklar: CA=2, IOA=3, ikisi de LE). */
export interface AsduWidths {
  readonly commonAddressLength: number;
  readonly informationObjectAddressLength: number;
}

export const IEC104_ASDU_WIDTHS: AsduWidths = {
  commonAddressLength: 2,
  informationObjectAddressLength: 3,
};

export interface AsduSummary {
  readonly typeId: number | undefined;
  readonly typeIdLabel: string | undefined;
  readonly causeOfTransmission: number | undefined;
  readonly causeOfTransmissionLabel: string | undefined;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** Aynı uyarı bir nesne döngüsünde birden çok kez tetiklenebilir — tekilleştir. */
function pushWarningOnce(warnings: ProtocolWarning[], key: string): void {
  if (warnings.some((warning) => warning.code === key)) return;
  warnings.push(toProtocolWarning(key));
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** `width` bayt küçük-uçlu okuma (dnp3.ts `readUintLe` ile aynı desen). */
function readUintLe(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(data, offset + index);
  }
  return value;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function pushBitField(
  fields: ParsedField[],
  id: string,
  name: string,
  offset: number,
  rawBytes: Uint8Array,
  value: number,
): void {
  fields.push({ id, name, offset, length: 1, rawBytes, rawValue: value, valid: true, warnings: [] });
}

/** SIQ baytını SPI + BL/SB/NT/IV kalite bitlerine çözer (dosya başı, tek tam çözülen element). */
function decodeSiq(
  elementBytes: Uint8Array,
  offset: number,
  idSuffix: string,
  fields: ParsedField[],
): void {
  const byte = byteAt(elementBytes, 0);
  const raw = elementBytes.slice(0, 1);
  pushBitField(fields, `siq-spi${idSuffix}`, 'SPI', offset, raw, (byte & SIQ_BIT_SPI) !== 0 ? 1 : 0);
  pushBitField(fields, `siq-bl${idSuffix}`, 'BL (Blocked)', offset, raw, (byte & SIQ_BIT_BL) !== 0 ? 1 : 0);
  pushBitField(
    fields,
    `siq-sb${idSuffix}`,
    'SB (Substituted)',
    offset,
    raw,
    (byte & SIQ_BIT_SB) !== 0 ? 1 : 0,
  );
  pushBitField(
    fields,
    `siq-nt${idSuffix}`,
    'NT (Not Topical)',
    offset,
    raw,
    (byte & SIQ_BIT_NT) !== 0 ? 1 : 0,
  );
  pushBitField(fields, `siq-iv${idSuffix}`, 'IV (Invalid)', offset, raw, (byte & SIQ_BIT_IV) !== 0 ? 1 : 0);
}

function decodeInformationElement(
  typeId: number,
  elementBytes: Uint8Array,
  offset: number,
  idSuffix: string,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  if (elementBytes.length === 0) return;
  if (typeId === TYPE_ID_SINGLE_POINT_INFORMATION) {
    decodeSiq(elementBytes, offset, idSuffix, fields);
    return;
  }
  fields.push({
    id: `information-element${idSuffix}`,
    name: idSuffix === '' ? 'Information Element' : `Information Element (${idSuffix.slice(1)})`,
    offset,
    length: elementBytes.length,
    rawBytes: elementBytes,
    unit: 'B',
    valid: true,
    warnings: [WARN_INFORMATION_ELEMENT_NEEDS_TYPE_DECODE],
  });
  pushWarningOnce(warnings, WARN_INFORMATION_ELEMENT_NEEDS_TYPE_DECODE);
}

function pushIoaField(
  fields: ParsedField[],
  offset: number,
  ioaBytes: Uint8Array,
  idSuffix: string,
): void {
  fields.push({
    id: `information-object-address${idSuffix}`,
    name: idSuffix === '' ? 'Information Object Address' : `Information Object Address (${idSuffix.slice(1)})`,
    offset,
    length: ioaBytes.length,
    rawBytes: ioaBytes,
    rawValue: readUintLe(ioaBytes, 0, ioaBytes.length),
    valid: true,
    warnings: [],
  });
}

/**
 * ASDU'yu çözer. `data` YALNIZ ASDU baytlarıdır (Type ID'den başlar); `baseOffset`
 * bu baytların ORİJİNAL çerçevedeki konumudur (byte-viewer/hata ofsetleri için) —
 * doip.ts'nin `payloadOffset` deseniyle aynı: alanlar doğrudan `fields`/`warnings`/
 * `errors`e PUSH edilir, çağıran bunları yeniden ofsetlemek ZORUNDA DEĞİLDİR.
 */
export function decodeAsdu(
  data: Uint8Array,
  baseOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  widths: AsduWidths = IEC104_ASDU_WIDTHS,
): AsduSummary {
  const empty: AsduSummary = {
    typeId: undefined,
    typeIdLabel: undefined,
    causeOfTransmission: undefined,
    causeOfTransmissionLabel: undefined,
  };

  const minimumLength = 1 + 1 + 2 + widths.commonAddressLength;
  if (data.length < minimumLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ASDU_TRUNCATED,
      offset: baseOffset,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: minimumLength },
    });
    return empty;
  }

  let pos = 0;

  const typeId = byteAt(data, pos);
  const typeIdLabel = TYPE_ID_NAMES.get(typeId);
  const typeIdField: ParsedField = {
    id: 'type-id',
    name: 'Type Identification',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: typeId,
    valid: typeIdLabel !== undefined,
    warnings: [],
  };
  if (typeIdLabel !== undefined) {
    typeIdField.physicalValue = typeIdLabel;
  } else {
    typeIdField.warnings.push(WARN_UNKNOWN_TYPE_ID);
    pushWarningOnce(warnings, WARN_UNKNOWN_TYPE_ID);
  }
  fields.push(typeIdField);
  pos += 1;

  const vsqByte = byteAt(data, pos);
  const sq = (vsqByte & VSQ_BIT_SQ) !== 0;
  const count = vsqByte & VSQ_MASK_COUNT;
  const vsqBytes = data.slice(pos, pos + 1);
  fields.push({
    id: 'sq',
    name: 'SQ',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: vsqBytes,
    rawValue: sq ? 1 : 0,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'number-of-objects',
    name: 'Number of Objects',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: vsqBytes,
    rawValue: count,
    valid: true,
    warnings: [],
  });
  pos += 1;

  const causeByte = byteAt(data, pos);
  const test = (causeByte & COT_BIT_TEST) !== 0;
  const negative = (causeByte & COT_BIT_NEGATIVE) !== 0;
  const cause = causeByte & COT_MASK_CAUSE;
  const causeLabel = COT_NAMES.get(cause);
  const causeRawBytes = data.slice(pos, pos + 1);
  pushBitField(fields, 'test', 'T (Test)', baseOffset + pos, causeRawBytes, test ? 1 : 0);
  pushBitField(fields, 'negative-confirm', 'P/N (Negative Confirm)', baseOffset + pos, causeRawBytes, negative ? 1 : 0);
  const causeField: ParsedField = {
    id: 'cause-of-transmission',
    name: 'Cause of Transmission',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: causeRawBytes,
    rawValue: cause,
    valid: causeLabel !== undefined,
    warnings: [],
  };
  if (causeLabel !== undefined) {
    causeField.physicalValue = causeLabel;
  } else {
    causeField.warnings.push(WARN_UNKNOWN_CAUSE_OF_TRANSMISSION);
    pushWarningOnce(warnings, WARN_UNKNOWN_CAUSE_OF_TRANSMISSION);
  }
  fields.push(causeField);
  pos += 1;

  const originatorAddress = byteAt(data, pos);
  fields.push({
    id: 'originator-address',
    name: 'Originator Address',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: originatorAddress,
    valid: true,
    warnings: [],
  });
  pos += 1;

  const commonAddressBytes = data.slice(pos, pos + widths.commonAddressLength);
  const commonAddress = readUintLe(commonAddressBytes, 0, widths.commonAddressLength);
  fields.push({
    id: 'common-address',
    name: 'Common Address',
    offset: baseOffset + pos,
    length: widths.commonAddressLength,
    rawBytes: commonAddressBytes,
    rawValue: commonAddress,
    valid: true,
    warnings: [],
  });
  pos += widths.commonAddressLength;

  const summary: AsduSummary = {
    typeId,
    typeIdLabel,
    causeOfTransmission: cause,
    causeOfTransmissionLabel: causeLabel,
  };

  decodeInformationObjects(data, pos, baseOffset, typeId, sq, count, widths, fields, warnings, errors);

  return summary;
}

/**
 * Information Object'leri (IOA + element) yürür. `count === 1` HER ZAMAN
 * güvenlidir (dosya başı not); `count > 1` yalnız tip `ELEMENT_WIDTH_TABLE`'da
 * varsa yürünür, yoksa TÜMÜ tek ham blok olarak teslim alınır.
 */
function decodeInformationObjects(
  data: Uint8Array,
  startPos: number,
  baseOffset: number,
  typeId: number,
  sq: boolean,
  count: number,
  widths: AsduWidths,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): void {
  const ioaWidth = widths.informationObjectAddressLength;
  let pos = startPos;

  if (count === 0) return;

  if (count === 1) {
    if (data.length - pos < ioaWidth) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ASDU_TRUNCATED,
        offset: baseOffset + pos,
        length: data.length - pos,
      });
      return;
    }
    const ioaBytes = data.slice(pos, pos + ioaWidth);
    pushIoaField(fields, baseOffset + pos, ioaBytes, '');
    pos += ioaWidth;
    // Tek obje: kalan HER ŞEY bu objenin elemanıdır — genişlik bilinmese de güvenli.
    const elementBytes = data.slice(pos);
    decodeInformationElement(typeId, elementBytes, baseOffset + pos, '', fields, warnings);
    return;
  }

  const elementWidth = ELEMENT_WIDTH_TABLE.get(typeId);
  if (elementWidth === undefined) {
    const remainder = data.slice(startPos);
    if (remainder.length === 0) return;
    fields.push({
      id: 'information-objects',
      name: 'Information Objects',
      offset: baseOffset + startPos,
      length: remainder.length,
      rawBytes: remainder,
      unit: 'B',
      valid: true,
      warnings: [WARN_MULTIPLE_OBJECTS_UNKNOWN_WIDTH],
    });
    pushWarningOnce(warnings, WARN_MULTIPLE_OBJECTS_UNKNOWN_WIDTH);
    return;
  }

  if (sq) {
    // SQ=1: TEK IOA + `count` ardışık element (dosya başı, spec 9241-9251 emsali).
    if (data.length - pos < ioaWidth) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ASDU_TRUNCATED,
        offset: baseOffset + pos,
        length: data.length - pos,
      });
      return;
    }
    const ioaBytes = data.slice(pos, pos + ioaWidth);
    pushIoaField(fields, baseOffset + pos, ioaBytes, '');
    pos += ioaWidth;

    for (let index = 0; index < count; index += 1) {
      if (data.length - pos < elementWidth) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_ASDU_TRUNCATED,
          offset: baseOffset + pos,
          length: data.length - pos,
          details: { objectIndex: index },
        });
        return;
      }
      const elementBytes = data.slice(pos, pos + elementWidth);
      decodeInformationElement(typeId, elementBytes, baseOffset + pos, `-${String(index)}`, fields, warnings);
      pos += elementWidth;
    }
    return;
  }

  // SQ=0: `count` kez tekrar eden (IOA + element) çifti.
  for (let index = 0; index < count; index += 1) {
    if (data.length - pos < ioaWidth) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ASDU_TRUNCATED,
        offset: baseOffset + pos,
        length: data.length - pos,
        details: { objectIndex: index },
      });
      return;
    }
    const ioaBytes = data.slice(pos, pos + ioaWidth);
    const suffix = `-${String(index)}`;
    pushIoaField(fields, baseOffset + pos, ioaBytes, suffix);
    pos += ioaWidth;

    if (data.length - pos < elementWidth) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ASDU_TRUNCATED,
        offset: baseOffset + pos,
        length: data.length - pos,
        details: { objectIndex: index },
      });
      return;
    }
    const elementBytes = data.slice(pos, pos + elementWidth);
    decodeInformationElement(typeId, elementBytes, baseOffset + pos, suffix, fields, warnings);
    pos += elementWidth;
  }
}

/** UI/test tarafında Type ID adlarına erişim gerekebilir (ör. örnek açıklaması). */
export function getTypeIdLabel(typeId: number): string | undefined {
  return TYPE_ID_NAMES.get(typeId);
}

/** UI/test tarafında COT adlarına erişim gerekebilir. */
export function getCauseOfTransmissionLabel(cause: number): string | undefined {
  return COT_NAMES.get(cause);
}

export { formatHexByte as formatIec104HexByte };
