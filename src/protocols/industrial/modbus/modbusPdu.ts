/**
 * Modbus PDU (Protocol Data Unit) çözümü — RTU, ASCII ve TCP'nin ORTAK beyni.
 *
 * Spec §3.3 üç taşımayı da aynı uygulama modeline bağlar: "RTU/ASCII aynı function-code
 * application modelini paylaşır, yalnız framing farklıdır" ve "Modbus RTU/ASCII/TCP aynı
 * function-code modelini paylaşır — decoder mantığı üçü arasında ortaklaştırılabilir".
 * Bu yüzden function code çözümü ÜÇ parser'da tekrar edilmez, yalnız burada yaşar;
 * taşıma katmanları adres/CRC/LRC/MBAP gibi kendi başlıklarını çözüp gövdeyi buraya verir.
 *
 * TUZAK — OFSET TABANI: buradaki her `ParsedField.offset` PDU GÖVDESİNE göre 0-tabanlıdır.
 * Gövde, function code'dan SONRAKİ ilk byte'tır; function code alanının kendisi burada
 * ÜRETİLMEZ (onu üreten taşıma katmanıdır, çünkü ofseti taşımaya göre değişir). Taşıma
 * katmanı bu ofsetlere kendi başlık uzunluğunu EKLEMEK ZORUNDADIR:
 *   RTU   → +2 (Address, Function)
 *   ASCII → çözülmüş byte dizisinde +2; ham wire (hex karakter) ofseti ayrıca ×2 + 1'dir
 *   TCP   → +8 (7 byte MBAP + Function)
 * Eklenmezse byte-viewer yanlış byte'ı vurgular; kullanıcı da yanlış register'ı okur.
 *
 * Girdi doğrulaması burada HATA ÜRETMEZ: kısa/bozuk gövde uyarıya çevrilir ve kısmi alan
 * listesi döner (spec §47 "hatalı veride uygulamayı çökertme"). Spec §42'nin
 * "Unsupported function code" HATASI da burada üretilmez — bilinmeyen kod yalnız uyarıdır,
 * hataya çevirmek taşıma katmanının kararıdır.
 */

import { bytesToNumber } from '@/protocol-core/buffers/endianness';
import type { ParsedField } from '@/protocol-core/types';

/** Modbus tel üzerinde big-endian'dır: adres/register alanları 2 byte, yüksek byte önce. */
const WORD_BYTE_LENGTH = 2;
/** Byte Count, MEI Type ve Exception Code — üçü de tek byte'lık sayısal alanlardır. */
const SINGLE_BYTE_FIELD_LENGTH = 1;

/** Exception yanıtı = orijinal function code | 0x80 (spec §3.3 "Exception response"). */
const EXCEPTION_FLAG = 0x80;
const ORIGINAL_FUNCTION_MASK = 0x7f;

/** Write Single Coil'in tel değerleri ikili değildir: yalnız bu iki sabit geçerlidir. */
const COIL_ON_VALUE = 0xff00;
const COIL_OFF_VALUE = 0x0000;
const COIL_ON_LABEL = 'ON';
const COIL_OFF_LABEL = 'OFF';

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
const HEX_DIGITS_PER_WORD = 4;

/**
 * Özet ve uyarı dizgeleri ÇEVİRİ ANAHTARIDIR, düz metin değil: görünen hiçbir metin koda
 * gömülmez (CLAUDE.md). Anahtarlar tam literal yazılır — şablonla üretilseydi ne grep ile
 * bulunur ne de sözlükten düşünce fark edilirdi.
 *
 * `summaryParams` değerleri anahtar metnine GÖMÜLMEZ: bu anahtarların hiçbirinde yer
 * tutucu yoktur, sayıları arayüz ayrı <span>'lerde basar. Sözlükte olmayan yer tutucuyla
 * `t(key, vars)` çağrısı çalışma zamanında fırlatır — bu yüzden anahtar metni sabit kalır.
 */
const WARN_TRUNCATED_BODY = 'protocol.modbus.pdu.warning.truncatedBody';
const WARN_TRUNCATED_FIELD = 'protocol.modbus.pdu.warning.truncatedField';
const WARN_EMPTY_BODY = 'protocol.modbus.pdu.warning.emptyBody';
const WARN_BYTE_COUNT_MISMATCH = 'protocol.modbus.pdu.warning.byteCountMismatch';
const WARN_ODD_REGISTER_BYTE_COUNT = 'protocol.modbus.pdu.warning.oddRegisterByteCount';
const WARN_TRAILING_BYTES = 'protocol.modbus.pdu.warning.trailingBytes';
const WARN_ZERO_QUANTITY = 'protocol.modbus.pdu.warning.zeroQuantity';
const WARN_UNKNOWN_FUNCTION_CODE = 'protocol.modbus.pdu.warning.unknownFunctionCode';
const WARN_ILLEGAL_COIL_VALUE = 'protocol.modbus.pdu.warning.illegalCoilValue';
const WARN_MISSING_EXCEPTION_CODE = 'protocol.modbus.pdu.warning.missingExceptionCode';
const WARN_UNKNOWN_EXCEPTION_CODE = 'protocol.modbus.pdu.warning.unknownExceptionCode';
const WARN_EXCEPTION_BIT_IN_REQUEST = 'protocol.modbus.pdu.warning.exceptionBitInRequest';

const SUMMARY_EXCEPTION_RESPONSE = 'protocol.modbus.pdu.summary.exceptionResponse';
const SUMMARY_UNKNOWN_FUNCTION_CODE = 'protocol.modbus.pdu.summary.unknownFunctionCode';

/** Aynı PDU hem istek hem yanıt olarak çözülür; hangisi olduğunu çağıran bilir. */
export type PduRole = 'request' | 'response';

/**
 * Modbus'un dört veri tipi (+ adressiz taşıma servisleri için `none`). Ayrım kozmetik
 * değildir: dokümantasyon adresinin tabanı buradan gelir (bkz. `describeAddress`).
 */
export type ModbusAddressSpace =
  | 'coil'
  | 'discrete-input'
  | 'input-register'
  | 'holding-register'
  | 'none';

/**
 * Gövde şekli — function code tablosunun istek/yanıt sütunları. String bir "açıklama"
 * değil, decoder'ın switch'lediği ETİKETTİR: tablo süslemek için değil, çözümü sürmek
 * için vardır, böylece şekil bilgisi tek yerde kalır.
 */
export type ModbusBodyShape =
  | 'start-address-quantity'
  | 'address-value'
  | 'byte-count-data'
  | 'start-address-quantity-byte-count-data'
  | 'mask-write'
  | 'read-write-multiple-request'
  | 'mei-header-data';

export interface ModbusFunctionCodeInfo {
  readonly code: number;
  /** Protokol terimi — VERİDİR, çevrilmez (CLAUDE.md: protokol adları sözlüğe girmez). */
  readonly name: string;
  readonly requestShape: ModbusBodyShape;
  readonly responseShape: ModbusBodyShape;
  readonly addressSpace: ModbusAddressSpace;
  readonly summaryKey: string;
}

export interface ModbusExceptionCodeInfo {
  readonly code: number;
  /** Protokol terimi — veridir; spec §3.3 örneği "Illegal Data Address" bu tablodandır. */
  readonly name: string;
}

export interface PduDecodeResult {
  readonly fields: readonly ParsedField[];
  readonly warnings: readonly string[];
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
}

/**
 * Modbus'un en sinsi yeri: TELDE adres 0-tabanlı, DOKÜMANTASYONDA/PLC ekranında
 * 1-tabanlı ve veri tipine göre bloklanmıştır (coil 00001+, discrete input 10001+,
 * input register 30001+, holding register 40001+). Aynı `00 00` teli, holding register
 * okumasında "40001" demektir. İkisi tek alanda birleştirilirse kullanıcı bir eksik ya da
 * 40000 fazla register okur — bu yüzden alan adları BİLEREK `wire…` / `documentation…`
 * ön ekleriyle ayrılmıştır ve hiçbir yerde "address" diye tek başına geçmez.
 */
export interface AddressDescription {
  readonly addressSpace: ModbusAddressSpace;
  /** Protokol terimi (Coil / Discrete Input / …) — veridir, çevrilmez. */
  readonly entityLabel: string;
  readonly quantity: number;
  /** Telde giden 0-tabanlı adres. */
  readonly wireStartAddress: number;
  /** Aralığın son telde giden adresi; quantity 0 ise başlangıca eşittir (boş aralık). */
  readonly wireEndAddress: number;
  /** Veri tipinin dokümantasyon tabanı: 1, 10001, 30001 ya da 40001. */
  readonly documentationBase: number;
  readonly documentationStartAddress: number;
  readonly documentationEndAddress: number;
}

/**
 * Spec §16 "Modbus ailesi" ONBİR function code sayar; liste birebir odur — ne eklendi ne
 * çıkarıldı. Gövde şekilleri Modbus Application Protocol V1.1b3'e göredir (spec'in
 * normatif referansı: "application function codes için V1.1b3").
 *
 * 0x16 (22) Mask Write Register ve 0x17 (23) Read/Write Multiple Registers ONALTILIKTIR;
 * ondalık 16/17 sanılırsa Write Multiple Coils/Registers ile karışır.
 */
export const MODBUS_FUNCTION_CODES: readonly ModbusFunctionCodeInfo[] = [
  {
    code: 0x01,
    name: 'Read Coils',
    requestShape: 'start-address-quantity',
    responseShape: 'byte-count-data',
    addressSpace: 'coil',
    summaryKey: 'protocol.modbus.pdu.summary.readCoils',
  },
  {
    code: 0x02,
    name: 'Read Discrete Inputs',
    requestShape: 'start-address-quantity',
    responseShape: 'byte-count-data',
    addressSpace: 'discrete-input',
    summaryKey: 'protocol.modbus.pdu.summary.readDiscreteInputs',
  },
  {
    code: 0x03,
    name: 'Read Holding Registers',
    requestShape: 'start-address-quantity',
    responseShape: 'byte-count-data',
    addressSpace: 'holding-register',
    summaryKey: 'protocol.modbus.pdu.summary.readHoldingRegisters',
  },
  {
    code: 0x04,
    name: 'Read Input Registers',
    requestShape: 'start-address-quantity',
    responseShape: 'byte-count-data',
    addressSpace: 'input-register',
    summaryKey: 'protocol.modbus.pdu.summary.readInputRegisters',
  },
  {
    code: 0x05,
    name: 'Write Single Coil',
    requestShape: 'address-value',
    // Yanıt isteğin AYNISIDIR (echo); ayrı bir şekil değil, aynı iki word.
    responseShape: 'address-value',
    addressSpace: 'coil',
    summaryKey: 'protocol.modbus.pdu.summary.writeSingleCoil',
  },
  {
    code: 0x06,
    name: 'Write Single Register',
    requestShape: 'address-value',
    responseShape: 'address-value',
    addressSpace: 'holding-register',
    summaryKey: 'protocol.modbus.pdu.summary.writeSingleRegister',
  },
  {
    code: 0x0f,
    name: 'Write Multiple Coils',
    requestShape: 'start-address-quantity-byte-count-data',
    // Yanıt veriyi geri döndürmez, yalnız neyin yazıldığını doğrular.
    responseShape: 'start-address-quantity',
    addressSpace: 'coil',
    summaryKey: 'protocol.modbus.pdu.summary.writeMultipleCoils',
  },
  {
    code: 0x10,
    name: 'Write Multiple Registers',
    requestShape: 'start-address-quantity-byte-count-data',
    responseShape: 'start-address-quantity',
    addressSpace: 'holding-register',
    summaryKey: 'protocol.modbus.pdu.summary.writeMultipleRegisters',
  },
  {
    code: 0x16,
    name: 'Mask Write Register',
    requestShape: 'mask-write',
    responseShape: 'mask-write',
    addressSpace: 'holding-register',
    summaryKey: 'protocol.modbus.pdu.summary.maskWriteRegister',
  },
  {
    code: 0x17,
    name: 'Read/Write Multiple Registers',
    requestShape: 'read-write-multiple-request',
    // Yanıt yalnız OKUNAN register'ları taşır — yazılanlar geri gelmez.
    responseShape: 'byte-count-data',
    addressSpace: 'holding-register',
    summaryKey: 'protocol.modbus.pdu.summary.readWriteMultipleRegisters',
  },
  {
    code: 0x2b,
    name: 'Encapsulated Interface Transport',
    // MEI Type'tan sonrası taşınan alt protokole aittir (ör. Device Identification);
    // burada ham bırakılır, çözümü ayrı bir motorun işidir.
    requestShape: 'mei-header-data',
    responseShape: 'mei-header-data',
    addressSpace: 'none',
    summaryKey: 'protocol.modbus.pdu.summary.encapsulatedInterfaceTransport',
  },
];

/**
 * Spec özeti exception tablosunu saymaz, yalnız §3.3'te bir örnek adlandırır
 * ("Illegal Data Address"). Tam tablo spec'in normatif referansı olan Modbus Application
 * Protocol V1.1b3'ün exception listesidir. 0x07 ve 0x09 O TABLODA YOKTUR — buradaki
 * boşluk unutulmuş kayıt değil, standardın kendisidir; "tamamlamak" için doldurulmaz.
 */
export const MODBUS_EXCEPTION_CODES: readonly ModbusExceptionCodeInfo[] = [
  { code: 0x01, name: 'Illegal Function' },
  { code: 0x02, name: 'Illegal Data Address' },
  { code: 0x03, name: 'Illegal Data Value' },
  { code: 0x04, name: 'Server Device Failure' },
  { code: 0x05, name: 'Acknowledge' },
  { code: 0x06, name: 'Server Device Busy' },
  { code: 0x08, name: 'Memory Parity Error' },
  { code: 0x0a, name: 'Gateway Path Unavailable' },
  { code: 0x0b, name: 'Gateway Target Device Failed To Respond' },
];

const FUNCTION_CODE_INDEX: ReadonlyMap<number, ModbusFunctionCodeInfo> = new Map(
  MODBUS_FUNCTION_CODES.map((info) => [info.code, info]),
);

const EXCEPTION_CODE_INDEX: ReadonlyMap<number, ModbusExceptionCodeInfo> = new Map(
  MODBUS_EXCEPTION_CODES.map((info) => [info.code, info]),
);

export function getFunctionCodeInfo(functionCode: number): ModbusFunctionCodeInfo | undefined {
  return FUNCTION_CODE_INDEX.get(functionCode);
}

export function getExceptionCodeInfo(exceptionCode: number): ModbusExceptionCodeInfo | undefined {
  return EXCEPTION_CODE_INDEX.get(exceptionCode);
}

/** Dokümantasyon adresinin veri tipine göre tabanı (coil 00001, holding 40001 …). */
const DOCUMENTATION_BASES: Record<ModbusAddressSpace, number> = {
  coil: 1,
  'discrete-input': 10001,
  'input-register': 30001,
  'holding-register': 40001,
  // Adressiz servislerde (MEI) blok yoktur; yalnız 1-tabanlı sayıma düşülür.
  none: 1,
};

const ENTITY_LABELS: Record<ModbusAddressSpace, string> = {
  coil: 'Coil',
  'discrete-input': 'Discrete Input',
  'input-register': 'Input Register',
  'holding-register': 'Holding Register',
  none: 'Data',
};

/**
 * Bit tabanlı veri alanlarının adı. Register verisi tek tek `Register N` alanlarına
 * bölündüğü için burada yalnız bit blokları ve adressiz gövde karşılık bulur.
 */
const DATA_FIELD_NAMES: Record<ModbusAddressSpace, string> = {
  coil: 'Coil Status',
  'discrete-input': 'Input Status',
  'input-register': 'Register Value',
  'holding-register': 'Register Value',
  none: 'Data',
};

/** 0x80 biti set ise bu bir exception yanıtıdır; orijinal kod alt 7 bitte durur. */
export function isExceptionResponse(functionCode: number): boolean {
  return (functionCode & EXCEPTION_FLAG) !== 0;
}

function assertUnreachable(value: never): never {
  throw new Error(`Unhandled Modbus body shape: ${String(value)}`);
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, '0')}`;
}

function formatHexWord(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_WORD, '0')}`;
}

function isBitAddressSpace(addressSpace: ModbusAddressSpace): boolean {
  return addressSpace === 'coil' || addressSpace === 'discrete-input';
}

/**
 * Adres çevrimi. Function code'dan veri tipi türetilir: aynı `00 00` teli FC 0x01'de
 * coil 00001, FC 0x03'te holding register 40001'dir. Bilinmeyen function code'da veri
 * tipi `none` olur ve yalnız 1-tabanlı sayıma düşülür — uydurma bir blok seçilmez.
 */
export function describeAddress(
  startAddress: number,
  quantity: number,
  functionCode: number,
): AddressDescription {
  if (!Number.isInteger(startAddress) || startAddress < 0) {
    throw new RangeError(`startAddress must be a non-negative integer, got ${startAddress}`);
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`quantity must be a non-negative integer, got ${quantity}`);
  }

  const addressSpace = getFunctionCodeInfo(functionCode)?.addressSpace ?? 'none';
  const documentationBase = DOCUMENTATION_BASES[addressSpace];
  // quantity 0 aralığı boştur; son adresi başlangıcın bir altına düşürmek yerine
  // başlangıca eşitliyoruz, aksi hâlde negatif/ters aralık ekrana basılır.
  const span = quantity > 0 ? quantity - 1 : 0;

  return {
    addressSpace,
    entityLabel: ENTITY_LABELS[addressSpace],
    quantity,
    wireStartAddress: startAddress,
    wireEndAddress: startAddress + span,
    documentationBase,
    documentationStartAddress: startAddress + documentationBase,
    documentationEndAddress: startAddress + span + documentationBase,
  };
}

/** Gövde çözümünün biriktirici durumu; `decodePdu` dışına sızmaz. */
interface DecodeState {
  offset: number;
  truncated: boolean;
  readonly fields: ParsedField[];
  readonly warnings: string[];
  readonly params: Record<string, string>;
}

interface WordRead {
  readonly field: ParsedField;
  /** Gövde kısa kaldıysa `undefined` — çağıran bu durumda hesap yapmaz. */
  readonly value: number | undefined;
}

function addWarning(state: DecodeState, key: string): void {
  // Aynı uyarı birden çok alandan tetiklenebilir; kullanıcıya bir kez gösterilir.
  if (!state.warnings.includes(key)) {
    state.warnings.push(key);
  }
}

function createTruncatedField(
  id: string,
  name: string,
  body: Uint8Array,
  offset: number,
): ParsedField {
  const available = body.slice(Math.min(offset, body.length));
  return {
    id,
    name,
    offset,
    length: available.length,
    rawBytes: available,
    valid: false,
    warnings: [WARN_TRUNCATED_FIELD],
  };
}

function markTruncated(state: DecodeState, body: Uint8Array, id: string, name: string): ParsedField {
  const field = createTruncatedField(id, name, body, state.offset);
  state.fields.push(field);
  state.offset = body.length;
  state.truncated = true;
  addWarning(state, WARN_TRUNCATED_BODY);
  return field;
}

/**
 * 16-bit big-endian alan okur. `addressSpace` verilirse `physicalValue` DOKÜMANTASYON
 * adresi olur: `rawValue` telde giden 0-tabanlı sayı, `physicalValue` kullanıcının PLC
 * dokümanında göreceği numara (spec §9.2'nin ham/mühendislik ayrımı burada adres için
 * kullanılır — kullanıcı iki sayıyı yan yana görmezse yanlış register'ı okur).
 */
function pushWord(
  state: DecodeState,
  body: Uint8Array,
  id: string,
  name: string,
  addressSpace: ModbusAddressSpace = 'none',
): WordRead {
  if (state.offset + WORD_BYTE_LENGTH > body.length) {
    return { field: markTruncated(state, body, id, name), value: undefined };
  }

  const rawBytes = body.slice(state.offset, state.offset + WORD_BYTE_LENGTH);
  const value = bytesToNumber(rawBytes, 'big');
  const field: ParsedField = {
    id,
    name,
    offset: state.offset,
    length: WORD_BYTE_LENGTH,
    rawBytes,
    rawValue: value,
    valid: true,
    warnings: [],
  };
  if (addressSpace !== 'none') {
    field.physicalValue = value + DOCUMENTATION_BASES[addressSpace];
  }
  state.fields.push(field);
  state.offset += WORD_BYTE_LENGTH;
  return { field, value };
}

function pushByte(
  state: DecodeState,
  body: Uint8Array,
  id: string,
  name: string,
): WordRead {
  if (state.offset + SINGLE_BYTE_FIELD_LENGTH > body.length) {
    return { field: markTruncated(state, body, id, name), value: undefined };
  }

  const rawBytes = body.slice(state.offset, state.offset + SINGLE_BYTE_FIELD_LENGTH);
  // noUncheckedIndexedAccess: sınır kontrolü yapılmış olsa da tip `number | undefined`.
  const value = rawBytes[0] ?? 0;
  const field: ParsedField = {
    id,
    name,
    offset: state.offset,
    length: SINGLE_BYTE_FIELD_LENGTH,
    rawBytes,
    rawValue: value,
    valid: true,
    warnings: [],
  };
  state.fields.push(field);
  state.offset += SINGLE_BYTE_FIELD_LENGTH;
  return { field, value };
}

/** Sayısal anlamı olmayan ham blok (bit-paketli coil verisi, MEI gövdesi …). */
function pushRawBlock(
  state: DecodeState,
  body: Uint8Array,
  id: string,
  name: string,
  length: number,
): ParsedField {
  const rawBytes = body.slice(state.offset, state.offset + length);
  const field: ParsedField = {
    id,
    name,
    offset: state.offset,
    length: rawBytes.length,
    rawBytes,
    valid: true,
    warnings: [],
  };
  state.fields.push(field);
  state.offset += rawBytes.length;
  return field;
}

/**
 * Register verisini tek tek alanlara böler. Spec §3.3'ün yanıt örneği bunu birebir
 * istiyor: `01 03 04 00 64 00 C8` → "Register 0: 0x0064 = 100, Register 1: 0x00C8 = 200".
 * Alan adındaki indeks veridir (protokol terimi + sıra numarası), çeviri sözlüğüne girmez.
 *
 * Coil/discrete input verisi BİLEREK bölünmez: bit-paketli veride kaç bitin anlamlı
 * olduğu isteğin quantity alanındadır, PDU'nun kendisinde değil. Burada tek frame'e
 * bakılır, istek/yanıt eşleştirmesi taşıma/analyzer katmanının işidir.
 */
function pushRegisterFields(state: DecodeState, body: Uint8Array, dataLength: number): void {
  const registerCount = Math.floor(dataLength / WORD_BYTE_LENGTH);
  for (let index = 0; index < registerCount; index++) {
    pushWord(state, body, `register-${index}`, `Register ${index}`);
  }
  state.params.registerCount = String(registerCount);
}

function pushByteCountAndData(
  state: DecodeState,
  body: Uint8Array,
  addressSpace: ModbusAddressSpace,
  byteCountId: string,
  byteCountName: string,
  dataId: string,
): void {
  const byteCount = pushByte(state, body, byteCountId, byteCountName);
  if (byteCount.value === undefined) {
    return;
  }
  state.params.byteCount = String(byteCount.value);

  const available = body.length - state.offset;
  let dataLength = byteCount.value;
  if (dataLength > available) {
    // Byte count gövdede olmayan veriyi vaat ediyor: alanı geçersiz işaretle, elde olanı çöz.
    byteCount.field.valid = false;
    byteCount.field.warnings.push(WARN_BYTE_COUNT_MISMATCH);
    addWarning(state, WARN_BYTE_COUNT_MISMATCH);
    addWarning(state, WARN_TRUNCATED_BODY);
    state.truncated = true;
    dataLength = available;
  }

  if (dataLength <= 0) {
    return;
  }

  if (isBitAddressSpace(addressSpace)) {
    pushRawBlock(state, body, dataId, DATA_FIELD_NAMES[addressSpace], dataLength);
    return;
  }

  if (dataLength % WORD_BYTE_LENGTH !== 0) {
    addWarning(state, WARN_ODD_REGISTER_BYTE_COUNT);
  }
  pushRegisterFields(state, body, dataLength);
}

function recordAddressRange(
  state: DecodeState,
  functionCode: number,
  startAddress: number | undefined,
  quantity: number | undefined,
  startParamName: string,
  quantityParamName: string,
  documentationStartParamName: string,
  documentationEndParamName: string,
): void {
  if (startAddress !== undefined) {
    state.params[startParamName] = String(startAddress);
  }
  if (quantity !== undefined) {
    state.params[quantityParamName] = String(quantity);
    if (quantity === 0) {
      addWarning(state, WARN_ZERO_QUANTITY);
    }
  }
  if (startAddress === undefined || quantity === undefined) {
    return;
  }
  const description = describeAddress(startAddress, quantity, functionCode);
  state.params[documentationStartParamName] = String(description.documentationStartAddress);
  state.params[documentationEndParamName] = String(description.documentationEndAddress);
}

function decodeStartAddressQuantity(
  state: DecodeState,
  body: Uint8Array,
  info: ModbusFunctionCodeInfo,
): void {
  const start = pushWord(state, body, 'start-address', 'Start Address', info.addressSpace);
  if (state.truncated) {
    return;
  }
  const quantity = pushWord(state, body, 'quantity', 'Quantity');
  recordAddressRange(
    state,
    info.code,
    start.value,
    quantity.value,
    'startAddress',
    'quantity',
    'documentationStartAddress',
    'documentationEndAddress',
  );
}

function decodeAddressValue(
  state: DecodeState,
  body: Uint8Array,
  info: ModbusFunctionCodeInfo,
): void {
  const isCoil = isBitAddressSpace(info.addressSpace);
  const address = pushWord(
    state,
    body,
    isCoil ? 'output-address' : 'register-address',
    isCoil ? 'Output Address' : 'Register Address',
    info.addressSpace,
  );
  if (state.truncated) {
    return;
  }
  const value = pushWord(
    state,
    body,
    isCoil ? 'output-value' : 'register-value',
    isCoil ? 'Output Value' : 'Register Value',
  );

  if (address.value !== undefined) {
    state.params.address = String(address.value);
    state.params.documentationAddress = String(
      describeAddress(address.value, 1, info.code).documentationStartAddress,
    );
  }
  if (value.value === undefined) {
    return;
  }
  state.params.value = String(value.value);

  if (!isCoil) {
    return;
  }
  // V1.1b3: coil değeri ikili DEĞİL, iki sabittir. 0x0001 yazan bir master coil'i
  // açmaz — bunu uyarı olarak göstermezsek kullanıcı "yazdım ama çalışmadı" der.
  if (value.value === COIL_ON_VALUE) {
    value.field.physicalValue = COIL_ON_LABEL;
  } else if (value.value === COIL_OFF_VALUE) {
    value.field.physicalValue = COIL_OFF_LABEL;
  } else {
    value.field.valid = false;
    value.field.warnings.push(WARN_ILLEGAL_COIL_VALUE);
    addWarning(state, WARN_ILLEGAL_COIL_VALUE);
  }
}

function decodeStartAddressQuantityByteCountData(
  state: DecodeState,
  body: Uint8Array,
  info: ModbusFunctionCodeInfo,
): void {
  decodeStartAddressQuantity(state, body, info);
  if (state.truncated) {
    return;
  }
  pushByteCountAndData(state, body, info.addressSpace, 'byte-count', 'Byte Count', 'data');
}

function decodeMaskWrite(state: DecodeState, body: Uint8Array, info: ModbusFunctionCodeInfo): void {
  const address = pushWord(
    state,
    body,
    'reference-address',
    'Reference Address',
    info.addressSpace,
  );
  if (state.truncated) {
    return;
  }
  const andMask = pushWord(state, body, 'and-mask', 'And Mask');
  if (state.truncated) {
    return;
  }
  const orMask = pushWord(state, body, 'or-mask', 'Or Mask');

  if (address.value !== undefined) {
    state.params.address = String(address.value);
    state.params.documentationAddress = String(
      describeAddress(address.value, 1, info.code).documentationStartAddress,
    );
  }
  // Maskeler ondalık okunmaz; bit deseni olarak anlamlıdır, bu yüzden hex basılır.
  if (andMask.value !== undefined) {
    state.params.andMask = formatHexWord(andMask.value);
  }
  if (orMask.value !== undefined) {
    state.params.orMask = formatHexWord(orMask.value);
  }
}

function decodeReadWriteMultipleRequest(
  state: DecodeState,
  body: Uint8Array,
  info: ModbusFunctionCodeInfo,
): void {
  const readStart = pushWord(
    state,
    body,
    'read-start-address',
    'Read Start Address',
    info.addressSpace,
  );
  if (state.truncated) {
    return;
  }
  const readQuantity = pushWord(state, body, 'read-quantity', 'Read Quantity');
  if (state.truncated) {
    return;
  }
  const writeStart = pushWord(
    state,
    body,
    'write-start-address',
    'Write Start Address',
    info.addressSpace,
  );
  if (state.truncated) {
    return;
  }
  const writeQuantity = pushWord(state, body, 'write-quantity', 'Write Quantity');

  recordAddressRange(
    state,
    info.code,
    readStart.value,
    readQuantity.value,
    'readStartAddress',
    'readQuantity',
    'readDocumentationStartAddress',
    'readDocumentationEndAddress',
  );
  recordAddressRange(
    state,
    info.code,
    writeStart.value,
    writeQuantity.value,
    'writeStartAddress',
    'writeQuantity',
    'writeDocumentationStartAddress',
    'writeDocumentationEndAddress',
  );

  if (state.truncated) {
    return;
  }
  pushByteCountAndData(
    state,
    body,
    info.addressSpace,
    'write-byte-count',
    'Write Byte Count',
    'write-data',
  );
}

function decodeMeiHeaderData(state: DecodeState, body: Uint8Array): void {
  const meiType = pushByte(state, body, 'mei-type', 'MEI Type');
  if (meiType.value === undefined) {
    return;
  }
  state.params.meiType = formatHexByte(meiType.value);

  const remaining = body.length - state.offset;
  if (remaining > 0) {
    pushRawBlock(state, body, 'mei-data', 'MEI Data', remaining);
  }
}

function decodeShape(
  state: DecodeState,
  body: Uint8Array,
  shape: ModbusBodyShape,
  info: ModbusFunctionCodeInfo,
): void {
  switch (shape) {
    case 'start-address-quantity':
      decodeStartAddressQuantity(state, body, info);
      return;
    case 'address-value':
      decodeAddressValue(state, body, info);
      return;
    case 'byte-count-data':
      pushByteCountAndData(state, body, info.addressSpace, 'byte-count', 'Byte Count', 'data');
      return;
    case 'start-address-quantity-byte-count-data':
      decodeStartAddressQuantityByteCountData(state, body, info);
      return;
    case 'mask-write':
      decodeMaskWrite(state, body, info);
      return;
    case 'read-write-multiple-request':
      decodeReadWriteMultipleRequest(state, body, info);
      return;
    case 'mei-header-data':
      decodeMeiHeaderData(state, body);
      return;
    default:
      return assertUnreachable(shape);
  }
}

/** Şekil tamamlandıktan sonra artan byte'lar: gizlenmez, ayrı alan olarak gösterilir. */
function pushTrailingBytes(state: DecodeState, body: Uint8Array): void {
  if (state.truncated || state.offset >= body.length) {
    return;
  }
  const field = pushRawBlock(
    state,
    body,
    'trailing-data',
    'Trailing Data',
    body.length - state.offset,
  );
  field.valid = false;
  field.warnings.push(WARN_TRAILING_BYTES);
  addWarning(state, WARN_TRAILING_BYTES);
}

function finish(state: DecodeState, summaryKey: string): PduDecodeResult {
  return {
    fields: state.fields,
    warnings: state.warnings,
    summaryKey,
    summaryParams: state.params,
  };
}

function decodeExceptionPdu(
  functionCode: number,
  body: Uint8Array,
  role: PduRole,
): PduDecodeResult {
  const originalFunctionCode = functionCode & ORIGINAL_FUNCTION_MASK;
  const originalInfo = getFunctionCodeInfo(originalFunctionCode);
  const state: DecodeState = {
    offset: 0,
    truncated: false,
    fields: [],
    warnings: [],
    params: {
      functionCode: formatHexByte(functionCode),
      originalFunctionCode: formatHexByte(originalFunctionCode),
    },
  };
  if (originalInfo !== undefined) {
    state.params.originalFunctionName = originalInfo.name;
  }
  if (role === 'request') {
    // İstek PDU'sunda 0x80 biti olamaz: ya yön etiketi yanlış ya da frame bozuk.
    addWarning(state, WARN_EXCEPTION_BIT_IN_REQUEST);
  }

  if (body.length < SINGLE_BYTE_FIELD_LENGTH) {
    addWarning(state, WARN_MISSING_EXCEPTION_CODE);
    return finish(state, SUMMARY_EXCEPTION_RESPONSE);
  }

  const exceptionCode = pushByte(state, body, 'exception-code', 'Exception Code');
  if (exceptionCode.value !== undefined) {
    const exceptionInfo = getExceptionCodeInfo(exceptionCode.value);
    state.params.exceptionCode = formatHexByte(exceptionCode.value);
    if (exceptionInfo === undefined) {
      exceptionCode.field.warnings.push(WARN_UNKNOWN_EXCEPTION_CODE);
      addWarning(state, WARN_UNKNOWN_EXCEPTION_CODE);
    } else {
      // Semantik açıklama spec §3.3'ün istediği yerde duruyor: ham kodun yanında.
      exceptionCode.field.physicalValue = exceptionInfo.name;
      state.params.exceptionName = exceptionInfo.name;
    }
  }

  pushTrailingBytes(state, body);
  return finish(state, SUMMARY_EXCEPTION_RESPONSE);
}

/**
 * Bilinmeyen function code HATA DEĞİLDİR: gövde tek ham alan olarak gösterilir, uyarı
 * eklenir. Spec §42'nin "Unsupported function code" hatasını üretmek taşıma katmanının
 * kararıdır — burada kısmi çözüm döndürmek, kullanıcının byte'ları yine de görmesini sağlar.
 */
function decodeUnknownPdu(functionCode: number, body: Uint8Array): PduDecodeResult {
  const state: DecodeState = {
    offset: 0,
    truncated: false,
    fields: [],
    warnings: [],
    params: {
      functionCode: formatHexByte(functionCode),
      bodyLength: String(body.length),
    },
  };
  addWarning(state, WARN_UNKNOWN_FUNCTION_CODE);
  if (body.length > 0) {
    pushRawBlock(state, body, 'raw-body', 'Data', body.length);
  } else {
    addWarning(state, WARN_EMPTY_BODY);
  }
  return finish(state, SUMMARY_UNKNOWN_FUNCTION_CODE);
}

/**
 * PDU gövdesini çözer. `body` function code'dan SONRAKİ byte'lardır; function code ayrı
 * parametredir çünkü taşıma katmanı onu zaten kendi ofsetiyle alan olarak basmıştır.
 *
 * Fırlatmaz: bozuk gövde uyarı + kısmi alan listesi olarak döner.
 */
export function decodePdu(
  functionCode: number,
  body: Uint8Array,
  role: PduRole,
): PduDecodeResult {
  if (isExceptionResponse(functionCode)) {
    return decodeExceptionPdu(functionCode, body, role);
  }

  const info = getFunctionCodeInfo(functionCode);
  if (info === undefined) {
    return decodeUnknownPdu(functionCode, body);
  }

  const state: DecodeState = {
    offset: 0,
    truncated: false,
    fields: [],
    warnings: [],
    params: {
      functionCode: formatHexByte(functionCode),
      functionName: info.name,
    },
  };

  if (body.length === 0) {
    // Boş gövdede sıfır uzunluklu alan üretmek byte-viewer'da hayalet satır olur.
    addWarning(state, WARN_EMPTY_BODY);
    return finish(state, info.summaryKey);
  }

  decodeShape(state, body, role === 'request' ? info.requestShape : info.responseShape, info);
  pushTrailingBytes(state, body);
  return finish(state, info.summaryKey);
}
