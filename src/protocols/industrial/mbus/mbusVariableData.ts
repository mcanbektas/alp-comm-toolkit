/**
 * M-Bus Variable Data Structure (CI = 0x72, Mode 1/LSByte-first) çözüm çekirdeği.
 *
 * BİLEREK `mbus.ts`den (çerçeve sınıfları) AYRI bir modülde: burası yalnız CI=0x72
 * yolunun taşıdığı user data'yı çözer — Fixed Data Header (12 bayt) + DIF/DIFE/
 * VIF/VIFE/DATA kayıt zinciri (iec104Asdu.ts'nin ASDU çekirdeğiyle aynı ayrım
 * gerekçesi: `mbus.ts` çerçeve/checksum kararları verir, bu dosya yalnız bu tek
 * CI yolunun kayıt yürüyüşünü bilir).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * EN 13757'nin resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki alan
 * düzenleri, bit yerleşimleri ve dar kod kümeleri İKİ bağımsız kamuya açık
 * ikincil kaynaktan ÇAPRAZ TEYİTLE alındı:
 *   1. **libmbus** (rSCADA/Robert Johansson, GPLv2 — yalnız `mbus-protocol.h`/
 *      `mbus-protocol.c`nin alenen yayımlanan sabit tabloları ve yorum satırları
 *      referans alındı, KOD KOPYALANMADI):
 *      https://github.com/rscada/libmbus/blob/master/mbus/mbus-protocol.h
 *      https://github.com/rscada/libmbus/blob/master/mbus/mbus-protocol.c
 *   2. **m-bus.com "The M-Bus: A Documentation"** (orijinal, kamuya açık M-Bus
 *      dokümantasyonu — "late 1990s" notu taşır, EN 13757'nin ATASI, kamuya açık):
 *      https://m-bus.com/documentation-wired/06-application-layer
 *      https://m-bus.com/documentation-wired/08-appendix
 *   Not: Wireshark'ın M-Bus dissector'ı bu turda ARANDI — `epan/dissectors/`
 *   dizininde `mbus`/`wmbus`/`m-bus` içeren HİÇBİR dosya YOK (GitHub API ile
 *   doğrulandı, 2026-08-16). Üçüncü kaynak olarak KULLANILAMADI; çapraz teyit
 *   yalnız yukarıdaki iki kaynaktan.
 * İki kaynağın da AYNI numarayı AYNI adla/genişlikte verdiği alanlar
 * adlandırıldı (Medium, Data Field Code tablosu, CI-Field tablosu, Manufacturer
 * 5-bit harf formülü — worked example'la da doğrulandı: `24 40 01 07` →
 * `0x4024` → PAD, hem m-bus.com hem libmbus'ın `mbus_data_manufacturer_encode`
 * formülüyle bağımsız hesaplanınca birebir tutuyor). Teyit edilemeyen ya da
 * kaynaklar ÇAKIŞAN alanlar HAM bırakıldı — özellikle:
 *   - DIF'in "Function Field" biti (Instantaneous/Maximum/Minimum/Error state):
 *     m-bus.com bunu net tablolar, ama libmbus'ın `MBUS_DATA_RECORD_DIF_MASK_MIN
 *     = 0x10` sabiti m-bus.com'un "01b = Maximum" eşlemesiyle ÇAKIŞIYOR (0x10,
 *     bit alanında 01 desenine karşılık gelir). Çakışan bir alanı "muhtemelen
 *     doğrudur" diye adlandırmak uydurma yasağını (CLAUDE.md, Karar 2) ihlal
 *     eder — bu yüzden Function Field HAM (0-3) kalır, isim VERİLMEZ.
 *   - Medium 0x10-0x15: m-bus.com "Reserved" der, libmbus bu aralığa isim verir
 *     (Irrigation/Water Logger/…) — çakışma, HAM kalır. 0x1A ve üstü yalnız
 *     libmbus'ta var (tek kaynak) — o da HAM kalır.
 *
 * ── DAR KAPSAM (brief madde 9) ──────────────────────────────────────────────
 * VIF dar adlandırması yalnız yaygın ana birimler: Energy (Wh/J), Volume (m³),
 * Mass (kg), Power (W), Flow/Return Temperature (°C) — hepsi m-bus.com Ek
 * 8.4.4(a) tablosunun "10^n" formülüyle kendi içinde tutarlı (formül × range
 * sütunu çarpraz kontrol edildi) VE libmbus'ın `mbus_vib_unit_lookup`
 * fonksiyonunda AYNI VIF kod aralığı/birim eşlemesiyle yeniden üretiliyor
 * (örn. `case 0x10: … "Volume (%sm3)"`). VIFE uzantıları (FB/FD tabloları) ve
 * VIF=0x7C (takip eden ASCII string) bu dalgaya GİRMEZ — ham + uyarı.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

const HEX_RADIX = 16;

/** Fixed Data Header: Ident(4)+Manufacturer(2)+Version(1)+Medium(1)+AccessNo(1)+Status(1)+Signature(2) = 12 bayt. */
const FIXED_HEADER_LENGTH = 12;

/** DIFE/VIFE zincirlerinde EN 13757'nin kendi bildirdiği azami sayı (m-bus.com 6.3.2: "maximum of ten DIFE") — sonsuz döngü koruması. */
const MAX_EXTENSION_BYTES = 10;
/** Kayıt döngüsü için savunma amaçlı üst sınır — doğal olarak `pos` her turda ilerlediği için asla dolmaz, yine de sonsuz döngü koruması olarak tutuluyor. */
const MAX_RECORDS = 500;

const ERROR_FIXED_HEADER_TRUNCATED = 'protocol.mbus.error.fixedHeaderTruncated';
const ERROR_RECORD_TRUNCATED = 'protocol.mbus.error.recordTruncated';

const WARN_INVALID_BCD = 'protocol.mbus.warning.invalidBcd';
const WARN_MANUFACTURER_SPECIFIC_BLOCK = 'protocol.mbus.warning.manufacturerSpecificBlock';
const WARN_SPECIAL_FUNCTION_DIF = 'protocol.mbus.warning.specialFunctionDif';
const WARN_UNSUPPORTED_VIF_STRING = 'protocol.mbus.warning.unsupportedVifString';
const WARN_UNKNOWN_LVAR_LENGTH = 'protocol.mbus.warning.unknownLvarLength';
const WARN_VIFE_NOT_DECODED = 'protocol.mbus.warning.vifeNotDecoded';
const WARN_UNKNOWN_MEDIUM = 'protocol.mbus.warning.unknownMedium';
const WARN_UNNAMED_VIF = 'protocol.mbus.warning.unnamedVif';

/**
 * Ölçülen ortam (Medium) — dar küme: yalnız İKİ kaynağın da ÇAKIŞMADAN aynı adı
 * verdiği kodlar (0x00-0x0F, 0x16-0x19). 0x10-0x15 kaynaklar arasında çakışıyor,
 * 0x1A+ yalnız libmbus'ta var — ikisi de HAM bırakıldı (dosya başı notu).
 */
const MEDIUM_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Other'],
  [0x01, 'Oil'],
  [0x02, 'Electricity'],
  [0x03, 'Gas'],
  [0x04, 'Heat (Outlet)'],
  [0x05, 'Steam'],
  [0x06, 'Hot Water'],
  [0x07, 'Water'],
  [0x08, 'Heat Cost Allocator'],
  [0x09, 'Compressed Air'],
  [0x0a, 'Cooling Load Meter (Outlet)'],
  [0x0b, 'Cooling Load Meter (Inlet)'],
  [0x0c, 'Heat (Inlet)'],
  [0x0d, 'Heat/Cooling Load Meter'],
  [0x0e, 'Bus/System'],
  [0x0f, 'Unknown Medium'],
  [0x16, 'Cold Water'],
  [0x17, 'Dual Water'],
  [0x18, 'Pressure'],
  [0x19, 'A/D Converter'],
]);

/**
 * Data Field Code (DIF alt nibble) — dar küme, TÜM 16 kod iki kaynakta da
 * bire bir aynı tablo (m-bus.com Ek 8.4.2 ile libmbus'ın `mbus-protocol.c`
 * başındaki yorum bloğu KELİMESİ KELİMESİNE örtüşüyor). 0xF ayrı yolda
 * (Special Functions — kayıt zincirini bitirir), burada YOK.
 */
const DATA_FIELD_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0, 'No Data'],
  [0x1, '8 Bit Integer'],
  [0x2, '16 Bit Integer'],
  [0x3, '24 Bit Integer'],
  [0x4, '32 Bit Integer'],
  [0x5, '32 Bit Real'],
  [0x6, '48 Bit Integer'],
  [0x7, '64 Bit Integer'],
  [0x8, 'Selection for Readout'],
  [0x9, '2 Digit BCD'],
  [0xa, '4 Digit BCD'],
  [0xb, '6 Digit BCD'],
  [0xc, '8 Digit BCD'],
  [0xd, 'Variable Length'],
  [0xe, '12 Digit BCD'],
]);

/** Sabit-genişlikli kodların bayt uzunluğu (0xD/LVAR ve 0xF/Special ayrı ele alınır, burada YOK). */
const DATA_FIELD_LENGTHS: ReadonlyMap<number, number> = new Map([
  [0x0, 0],
  [0x1, 1],
  [0x2, 2],
  [0x3, 3],
  [0x4, 4],
  [0x5, 4],
  [0x6, 6],
  [0x7, 8],
  [0x8, 0],
  [0x9, 1],
  [0xa, 2],
  [0xb, 3],
  [0xc, 4],
  [0xe, 6],
]);

/** DIF Special Function kodları (alt nibble 0xF) — kayıt zincirini bitirir (m-bus.com 6.3.3). */
const DIF_MANUFACTURER_SPECIFIC = 0x0f;
const DIF_MANUFACTURER_SPECIFIC_MORE = 0x1f;

interface VifDefinition {
  readonly minCode: number;
  readonly maxCode: number;
  readonly name: string;
  readonly unit: string;
  /** `code`nin düşük bitlerinden (n) 10 tabanlı üs — değer = ham × 10^üs. */
  readonly exponent: (code: number) => number;
}

/**
 * Dar VIF tablosu — yalnız yaygın ana birimler (dosya başı "Dar Kapsam" notu).
 * VIF'in kendi uzantı biti (0x80) burada YOK, `code` her zaman 7-bit değerdir.
 */
const NAMED_VIF_TABLE: readonly VifDefinition[] = [
  { minCode: 0x00, maxCode: 0x07, name: 'Energy', unit: 'Wh', exponent: (c) => (c & 0x07) - 3 },
  { minCode: 0x08, maxCode: 0x0f, name: 'Energy', unit: 'J', exponent: (c) => c & 0x07 },
  { minCode: 0x10, maxCode: 0x17, name: 'Volume', unit: 'm³', exponent: (c) => (c & 0x07) - 6 },
  { minCode: 0x18, maxCode: 0x1f, name: 'Mass', unit: 'kg', exponent: (c) => (c & 0x07) - 3 },
  { minCode: 0x28, maxCode: 0x2f, name: 'Power', unit: 'W', exponent: (c) => (c & 0x07) - 3 },
  { minCode: 0x58, maxCode: 0x5b, name: 'Flow Temperature', unit: '°C', exponent: (c) => (c & 0x03) - 3 },
  { minCode: 0x5c, maxCode: 0x5f, name: 'Return Temperature', unit: '°C', exponent: (c) => (c & 0x03) - 3 },
];

/** VIF=0x7C: "VIF in following string" — ardından gelen uzunluk-önekli ASCII birim adı bu dalgada ÇÖZÜLMEZ. */
const VIF_CODE_FOLLOWING_STRING = 0x7c;

function findVifDefinition(code: number): VifDefinition | undefined {
  return NAMED_VIF_TABLE.find((def) => code >= def.minCode && code <= def.maxCode);
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function pushWarningOnce(warnings: ProtocolWarning[], key: string): void {
  if (warnings.some((warning) => warning.code === key)) return;
  warnings.push(toProtocolWarning(key));
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function readUintLe(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(data, offset + index);
  }
  return value;
}

/** `width` (1-4) baytlık iki'nin tümleyeni işaretli tamsayı, küçük-uçlu. */
function readIntLe(data: Uint8Array, offset: number, width: number): number {
  const unsigned = readUintLe(data, offset, width);
  const signBitValue = 2 ** (width * 8 - 1);
  return unsigned >= signBitValue ? unsigned - signBitValue * 2 : unsigned;
}

/** `width` (6/8) baytlık iki'nin tümleyeni işaretli tamsayı — 32-bit sınırını aştığı için BigInt. */
function readBigIntLe(data: Uint8Array, offset: number, width: number): bigint {
  let value = 0n;
  for (let index = width - 1; index >= 0; index -= 1) {
    value = value * 256n + BigInt(byteAt(data, offset + index));
  }
  const signBitValue = 1n << BigInt(width * 8 - 1);
  return value >= signBitValue ? value - signBitValue * 2n : value;
}

/** 32-bit IEEE-754 float, küçük-uçlu — `bytes` TAM 4 bayt olmalı (`.slice()` sonucu, kendi tamponu). */
function readFloat32Le(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
}

interface BcdResult {
  readonly valid: boolean;
  readonly digits: string;
}

/**
 * Paketlenmiş BCD, küçük-uçlu bayt sırası — nibble sırası m-bus.com'un kendi
 * worked example'ıyla teyitli (dosya başı notu, `mbus.test.ts` bağımsızca
 * doğrular): `78 56 34 12` → "12345678" (bayt3'ten bayt0'a, her baytta üst
 * nibble önce). Nibble 0xA-0xF görülürse (spec'in tanımladığı BCD dışı) alan
 * GEÇERSİZ sayılır — sessizce yanlış ondalık basmak yerine dürüstçe pes eder.
 */
function decodeBcd(bytes: Uint8Array): BcdResult {
  let digits = '';
  let valid = true;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    const byte = byteAt(bytes, index);
    const high = (byte >> 4) & 0x0f;
    const low = byte & 0x0f;
    if (high > 9 || low > 9) valid = false;
    digits += String(high) + String(low);
  }
  return { valid, digits };
}

/**
 * Manufacturer alanının 3-harfli EN 61107 kodu — 16-bit değeri 5'er bitlik üç
 * gruba böler, her grup `+64` ile ASCII büyük harfe döner (dosya başı formül +
 * worked example: `0x4024` → P/A/D). `((code >> shift) & 0x1F) + 64` deseni.
 */
function decodeManufacturerCode(value: number): string {
  const letter = (shift: number): string => String.fromCharCode(((value >> shift) & 0x1f) + 64);
  return `${letter(10)}${letter(5)}${letter(0)}`;
}

export interface MbusVariableDataSummary {
  readonly manufacturerCode: string | undefined;
  readonly mediumLabel: string | undefined;
  readonly recordCount: number;
}

/**
 * CI=0x72 (Variable Data Respond, Mode 1) yolunun user data'sını çözer: Fixed
 * Data Header + DIF/DIFE/VIF/VIFE/DATA kayıt zinciri. `data` YALNIZ bu user
 * data baytlarıdır (CI'dan hemen sonrası); `baseOffset` bunun ORİJİNAL
 * çerçevedeki konumu (iec104Asdu.ts'nin `baseOffset` deseniyle aynı — alanlar
 * doğrudan `fields`/`warnings`/`errors`e PUSH edilir).
 */
export function decodeVariableData(
  data: Uint8Array,
  baseOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): MbusVariableDataSummary {
  const empty: MbusVariableDataSummary = {
    manufacturerCode: undefined,
    mediumLabel: undefined,
    recordCount: 0,
  };

  if (data.length < FIXED_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_FIXED_HEADER_TRUNCATED,
      offset: baseOffset,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: FIXED_HEADER_LENGTH },
    });
    return empty;
  }

  let pos = 0;

  const identBytes = data.slice(pos, pos + 4);
  const identBcd = decodeBcd(identBytes);
  const identField: ParsedField = {
    id: 'fixed-header-identification-number',
    name: 'Identification Number',
    offset: baseOffset + pos,
    length: 4,
    rawBytes: identBytes,
    valid: identBcd.valid,
    warnings: identBcd.valid ? [] : [WARN_INVALID_BCD],
  };
  if (identBcd.valid) {
    identField.rawValue = identBcd.digits;
  } else {
    pushWarningOnce(warnings, WARN_INVALID_BCD);
  }
  fields.push(identField);
  pos += 4;

  const manufacturerRaw = readUintLe(data, pos, 2);
  const manufacturerCode = decodeManufacturerCode(manufacturerRaw);
  fields.push({
    id: 'fixed-header-manufacturer',
    name: 'Manufacturer',
    offset: baseOffset + pos,
    length: 2,
    rawBytes: data.slice(pos, pos + 2),
    rawValue: manufacturerRaw,
    physicalValue: manufacturerCode,
    valid: true,
    warnings: [],
  });
  pos += 2;

  fields.push({
    id: 'fixed-header-version',
    name: 'Version',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;

  const mediumByte = byteAt(data, pos);
  const mediumLabel = MEDIUM_NAMES.get(mediumByte);
  const mediumField: ParsedField = {
    id: 'fixed-header-medium',
    name: 'Medium',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: mediumByte,
    valid: mediumLabel !== undefined,
    warnings: [],
  };
  if (mediumLabel !== undefined) {
    mediumField.physicalValue = mediumLabel;
  } else {
    mediumField.warnings.push(WARN_UNKNOWN_MEDIUM);
    pushWarningOnce(warnings, WARN_UNKNOWN_MEDIUM);
  }
  fields.push(mediumField);
  pos += 1;

  fields.push({
    id: 'fixed-header-access-number',
    name: 'Access Number',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;

  fields.push({
    id: 'fixed-header-status',
    name: 'Status',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: byteAt(data, pos),
    valid: true,
    warnings: [],
  });
  pos += 1;

  fields.push({
    id: 'fixed-header-signature',
    name: 'Signature',
    offset: baseOffset + pos,
    length: 2,
    rawBytes: data.slice(pos, pos + 2),
    rawValue: readUintLe(data, pos, 2),
    unit: 'B',
    valid: true,
    warnings: [],
  });
  pos += 2;

  let recordIndex = 0;

  while (pos < data.length && recordIndex < MAX_RECORDS) {
    const dif = byteAt(data, pos);
    const difOffset = baseOffset + pos;

    if ((dif & 0x0f) === 0x0f) {
      // Special Functions (0x0F/0x1F/…): m-bus.com 6.3.3 — bu noktadan sonrası
      // manufacturer-specific'tir, dar kayıt zincirinin ÇÖZEBİLECEĞİ bir alan
      // değil. Kalanı tek ham blok olarak teslim al (DNP3/iec104 dürüstlük emsali).
      const remainder = data.slice(pos);
      const isKnownManufacturerBlock =
        dif === DIF_MANUFACTURER_SPECIFIC || dif === DIF_MANUFACTURER_SPECIFIC_MORE;
      const specialLabel = isKnownManufacturerBlock
        ? dif === DIF_MANUFACTURER_SPECIFIC
          ? 'Manufacturer Specific Data'
          : 'Manufacturer Specific Data (More Records Follow)'
        : 'Special Function Data';
      const warnKey = isKnownManufacturerBlock ? WARN_MANUFACTURER_SPECIFIC_BLOCK : WARN_SPECIAL_FUNCTION_DIF;
      fields.push({
        id: `mfg-data-${String(recordIndex)}`,
        name: specialLabel,
        offset: difOffset,
        length: remainder.length,
        rawBytes: remainder,
        unit: 'B',
        valid: true,
        warnings: [warnKey],
      });
      pushWarningOnce(warnings, warnKey);
      return { manufacturerCode, mediumLabel, recordCount: recordIndex };
    }

    const extensionBit = (dif & 0x80) !== 0;
    const storageLsb = (dif >> 6) & 0x01;
    const functionField = (dif >> 4) & 0x03;
    const dataFieldCode = dif & 0x0f;
    const dataFieldName = DATA_FIELD_CODE_NAMES.get(dataFieldCode);

    const difField: ParsedField = {
      id: `dif-${String(recordIndex)}`,
      name: 'DIF',
      offset: difOffset,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: formatHexByte(dif),
      valid: dataFieldName !== undefined,
      warnings: [],
    };
    if (dataFieldName !== undefined) difField.physicalValue = dataFieldName;
    fields.push(difField);
    fields.push({
      id: `dif-${String(recordIndex)}-extension`,
      name: 'DIF Extension Bit',
      offset: difOffset,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: extensionBit ? 1 : 0,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `dif-${String(recordIndex)}-storage-lsb`,
      name: 'Storage Number (LSB)',
      offset: difOffset,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: storageLsb,
      valid: true,
      warnings: [],
    });
    // Function Field bilerek ADLANDIRILMADI — dosya başı kaynak çakışması notu.
    fields.push({
      id: `dif-${String(recordIndex)}-function`,
      name: 'Function Field',
      offset: difOffset,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: functionField,
      valid: true,
      warnings: [],
    });
    pos += 1;

    let difeCount = 0;
    let moreDife = extensionBit;
    while (moreDife) {
      if (difeCount >= MAX_EXTENSION_BYTES) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: baseOffset + pos,
          length: data.length - pos,
          details: { reason: 'dife-limit-exceeded', recordIndex },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }
      if (pos >= data.length) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: baseOffset + pos,
          length: 0,
          details: { recordIndex, field: 'dife' },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }
      const dife = byteAt(data, pos);
      fields.push({
        id: `dife-${String(recordIndex)}-${String(difeCount)}`,
        name: `DIFE (${String(difeCount + 1)})`,
        offset: baseOffset + pos,
        length: 1,
        rawBytes: data.slice(pos, pos + 1),
        rawValue: formatHexByte(dife),
        valid: true,
        warnings: [],
      });
      moreDife = (dife & 0x80) !== 0;
      pos += 1;
      difeCount += 1;
    }

    if (pos >= data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_RECORD_TRUNCATED,
        offset: baseOffset + pos,
        length: 0,
        details: { recordIndex, field: 'vif' },
      });
      return { manufacturerCode, mediumLabel, recordCount: recordIndex };
    }

    const vifByte = byteAt(data, pos);
    const vifOffset = baseOffset + pos;
    const vifExtensionBit = (vifByte & 0x80) !== 0;
    const vifCode = vifByte & 0x7f;

    if (vifCode === VIF_CODE_FOLLOWING_STRING) {
      // VIF=0x7C: gerçek birim adı ardından gelen uzunluk-önekli ASCII string'te
      // — bu zincir bu dalgada ÇÖZÜLMEZ (dosya başı notu). Hizalama tahmin
      // ETMEDEN kalanı ham teslim et.
      const remainder = data.slice(pos);
      fields.push({
        id: `vif-${String(recordIndex)}-unsupported-string`,
        name: 'VIF (custom unit string, unsupported)',
        offset: vifOffset,
        length: remainder.length,
        rawBytes: remainder,
        unit: 'B',
        valid: true,
        warnings: [WARN_UNSUPPORTED_VIF_STRING],
      });
      pushWarningOnce(warnings, WARN_UNSUPPORTED_VIF_STRING);
      return { manufacturerCode, mediumLabel, recordCount: recordIndex };
    }

    const vifDefinition = findVifDefinition(vifCode);
    const vifField: ParsedField = {
      id: `vif-${String(recordIndex)}`,
      name: 'VIF',
      offset: vifOffset,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: formatHexByte(vifByte),
      valid: vifDefinition !== undefined,
      warnings: [],
    };
    if (vifDefinition !== undefined) {
      vifField.physicalValue = `${vifDefinition.name} (${vifDefinition.unit})`;
    } else {
      vifField.warnings.push(WARN_UNNAMED_VIF);
      pushWarningOnce(warnings, WARN_UNNAMED_VIF);
    }
    fields.push(vifField);
    pos += 1;

    let vifeCount = 0;
    let moreVife = vifExtensionBit;
    while (moreVife) {
      if (vifeCount >= MAX_EXTENSION_BYTES) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: baseOffset + pos,
          length: data.length - pos,
          details: { reason: 'vife-limit-exceeded', recordIndex },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }
      if (pos >= data.length) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: baseOffset + pos,
          length: 0,
          details: { recordIndex, field: 'vife' },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }
      const vife = byteAt(data, pos);
      fields.push({
        id: `vife-${String(recordIndex)}-${String(vifeCount)}`,
        name: `VIFE (${String(vifeCount + 1)})`,
        offset: baseOffset + pos,
        length: 1,
        rawBytes: data.slice(pos, pos + 1),
        rawValue: formatHexByte(vife),
        valid: true,
        warnings: [WARN_VIFE_NOT_DECODED],
      });
      pushWarningOnce(warnings, WARN_VIFE_NOT_DECODED);
      moreVife = (vife & 0x80) !== 0;
      pos += 1;
      vifeCount += 1;
    }

    // --- DATA ---
    const dataOffset = baseOffset + pos;

    if (dataFieldCode === 0xd) {
      // Variable Length (LVAR) — m-bus.com Ek 8.4.3: uzunluk ÖNCE 1 bayt olarak
      // gelir, gerçek uzunluk LVAR değerinin ARALIĞINA göre değişir.
      if (pos >= data.length) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: dataOffset,
          length: 0,
          details: { recordIndex, field: 'lvar' },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }
      const lvar = byteAt(data, pos);
      const lvarOffset = baseOffset + pos;
      pos += 1;

      let lvarLength: number | undefined;
      if (lvar <= 0xbf) lvarLength = lvar;
      else if (lvar <= 0xcf) lvarLength = lvar - 0xc0;
      else if (lvar <= 0xdf) lvarLength = lvar - 0xd0;
      else if (lvar <= 0xef) lvarLength = lvar - 0xe0;
      else if (lvar <= 0xfa) lvarLength = lvar - 0xf0;

      if (lvarLength === undefined) {
        // LVAR = 0xFB..0xFF: EN 13757 kendisi "Reserved" der (m-bus.com Ek
        // 8.4.3) — gerçek uzunluk BİLİNEMEZ, hizalama tahmin ETMEDEN pes et.
        const remainder = data.slice(lvarOffset - baseOffset);
        fields.push({
          id: `data-${String(recordIndex)}-lvar-unknown`,
          name: 'Variable Length (unknown, reserved LVAR)',
          offset: lvarOffset,
          length: remainder.length,
          rawBytes: remainder,
          unit: 'B',
          valid: true,
          warnings: [WARN_UNKNOWN_LVAR_LENGTH],
        });
        pushWarningOnce(warnings, WARN_UNKNOWN_LVAR_LENGTH);
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }

      if (data.length - pos < lvarLength) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: baseOffset + pos,
          length: data.length - pos,
          details: { recordIndex, field: 'lvar-data', declaredLength: lvarLength },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }

      const lvarBytes = data.slice(pos, pos + lvarLength);
      const isAscii = lvar <= 0xbf;
      const dataField: ParsedField = {
        id: `data-${String(recordIndex)}`,
        name: 'Data',
        offset: baseOffset + pos,
        length: lvarLength,
        rawBytes: lvarBytes,
        valid: true,
        warnings: isAscii ? [] : [],
      };
      if (isAscii) {
        let text = '';
        for (const byte of lvarBytes) text += String.fromCharCode(byte);
        dataField.rawValue = text;
      } else {
        dataField.unit = 'B';
      }
      fields.push(dataField);
      pos += lvarLength;
    } else {
      const dataLength = DATA_FIELD_LENGTHS.get(dataFieldCode) ?? 0;
      if (data.length - pos < dataLength) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_RECORD_TRUNCATED,
          offset: dataOffset,
          length: data.length - pos,
          details: { recordIndex, field: 'data', declaredLength: dataLength },
        });
        return { manufacturerCode, mediumLabel, recordCount: recordIndex };
      }

      if (dataLength > 0) {
        const dataBytes = data.slice(pos, pos + dataLength);
        const dataField: ParsedField = {
          id: `data-${String(recordIndex)}`,
          name: 'Data',
          offset: dataOffset,
          length: dataLength,
          rawBytes: dataBytes,
          valid: true,
          warnings: [],
        };

        let numericValue: number | bigint | undefined;
        if (dataFieldCode >= 0x1 && dataFieldCode <= 0x4) {
          numericValue = readIntLe(dataBytes, 0, dataLength);
        } else if (dataFieldCode === 0x5) {
          numericValue = readFloat32Le(dataBytes);
        } else if (dataFieldCode === 0x6 || dataFieldCode === 0x7) {
          numericValue = readBigIntLe(dataBytes, 0, dataLength);
        } else if (
          dataFieldCode === 0x9 ||
          dataFieldCode === 0xa ||
          dataFieldCode === 0xb ||
          dataFieldCode === 0xc ||
          dataFieldCode === 0xe
        ) {
          const bcd = decodeBcd(dataBytes);
          if (bcd.valid) {
            numericValue = Number(bcd.digits);
          } else {
            dataField.valid = false;
            dataField.warnings.push(WARN_INVALID_BCD);
            pushWarningOnce(warnings, WARN_INVALID_BCD);
          }
        }

        if (numericValue !== undefined) {
          dataField.rawValue = numericValue;
          if (vifDefinition !== undefined && typeof numericValue !== 'bigint') {
            dataField.physicalValue = numericValue * 10 ** vifDefinition.exponent(vifCode);
            dataField.unit = vifDefinition.unit;
          } else if (vifDefinition !== undefined) {
            // 48/64-bit BigInt değerler için ölçek uygulamak güvenli değil
            // (Number'a döküm hassasiyet kaybeder) — ham BigInt + birim gösterilir,
            // ölçekli physicalValue basılmaz (yanlış hassasiyet iddiası olurdu).
            dataField.unit = vifDefinition.unit;
          }
        }

        fields.push(dataField);
      }
      pos += dataLength;
    }

    recordIndex += 1;
  }

  return { manufacturerCode, mediumLabel, recordCount: recordIndex };
}
