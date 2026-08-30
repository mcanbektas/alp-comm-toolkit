/**
 * Modbus ASCII taşıma katmanı — çerçeveleme, LRC ve hex çözümü. Function code
 * çözümü BURADA YOKTUR: o `modbusPdu.ts`te yaşar (spec §3.3 "RTU/ASCII aynı
 * function-code application modelini paylaşır, yalnız framing farklıdır").
 *
 * Çerçeve (spec §3.3): `:ADDRESS FUNCTION DATA LRC CR LF`, başlangıç `:` = 0x3A,
 * bitiş `CR LF` = 0D 0A. Telde her BAYT İKİ ASCII HEX KARAKTERİDİR.
 *
 * TUZAK — OFSET TABANI: `ParsedField.offset` HAM ASCII AKIŞINA göre verilir,
 * çözülmüş baytlara göre DEĞİL. Sebebi ByteViewer'dır: ekranda bağlantıdan gelen
 * ham baytlar (`3A 30 31 30 33 …`) duruyor, bölgeler onunla hizalanmazsa kullanıcı
 * yanlış yeri vurgulanmış görür. Çevrim tek satırdır ve tek yerde yapılır
 * (`wireOffsetForDecodedIndex`):
 *
 *   çözülmüş bayt i  →  ham ofset 1 + i*2, ham uzunluk 2
 *   çözülmüş bayt 0  = Slave Address  → ham 1..2
 *   çözülmüş bayt 1  = Function Code  → ham 3..4
 *   PDU gövdesi k    = çözülmüş 2 + k → ham 5 + k*2
 *
 * `decodePdu` gövdeye göre 0-tabanlı ofset döndürür; burada ×2 + 5 ile ham akışa
 * taşınır. Alanların `rawBytes` değeri de bilerek HAM ASCII karakterleridir —
 * `offset`/`length` ham akışı gösterirken `rawBytes` çözülmüş baytları taşısaydı
 * `length !== rawBytes.length` olur ve alan kendi içinde tutarsız kalırdı. Sayısal
 * değer kaybolmaz: `rawValue`/`physicalValue` çözülmüş sayıyı taşır, spec'in
 * istediği "DECODED BYTES" görünümü ise `rawFrame.metadata.decodedBytes`tedir.
 *
 * HATA SIRASI (spec §3.3 hata listesi: Invalid Hex Character, Odd Number Of Hex
 * Digits, Missing Colon, Missing CR, Missing LF, Invalid LRC): geçersiz hex
 * karakteri sonlandırıcıdan ÖNCE bakılır. Spec'in kendi örneği bunu zorunlu kılıyor —
 * `:0103GG00` girdisinde (CR LF yok) beklenen mesaj "'G' is not a hexadecimal
 * character"dır; önce sonlandırıcıya baksaydık "Missing LF" der ve 'G'yi hiç
 * göremezdik.
 *
 * LRC uyuşmazlığı ÇÖZÜMÜ DURDURMAZ: alanlar sonuna kadar çözülür, çerçeve
 * `valid: false` işaretlenir ve hata listesine `checksum-mismatch` eklenir. Bu
 * yüzden bozuk LRC `success: false` DÖNMEZ — `success: false` dalında `fields`
 * alanı yoktur ve kullanıcı bozuk bir çerçevede tam da alanları görmek ister
 * (spec §47 "hatalı veride uygulamayı çökertme").
 *
 * `consumedBytes` her dalda doludur ve akış katmanının resenkronizasyonunu sürer:
 * 0 dönmek "daha çok veri bekle" demektir (yarım çerçeve), pozitif dönmek "bu kadarını
 * at ve yeniden dene". Hiçbir hata dalı 0'dan büyük ilerleme gerektiği hâlde 0
 * döndürmez; aksi hâlde çağıran sonsuz döngüye girer.
 */

import { lrcChecksum } from '@/protocol-core/checksums/lrc';
import { encodeModbusAsciiFrame } from './modbusEncoders';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import { decodePdu, getFunctionCodeInfo, isExceptionResponse } from './modbusPdu';
import type { PduRole } from './modbusPdu';

const COLON = 0x3a;
const CARRIAGE_RETURN = 0x0d;
const LINE_FEED = 0x0a;

/** Telde bir bayt iki hex karakteridir — dosyanın tamamındaki ×2'lerin kaynağı budur. */
const WIRE_CHARS_PER_BYTE = 2;
/** ':' tek karakterdir; hex gövdesi hemen ondan sonra başlar. */
const FIRST_HEX_INDEX = 1;
/** CR + LF. */
const TERMINATOR_LENGTH = 2;
/** Çözülmüş dizide adres 0, function code 1, PDU gövdesi 2'den başlar. */
const ADDRESS_DECODED_INDEX = 0;
const FUNCTION_DECODED_INDEX = 1;
const BODY_DECODED_START = 2;
/** En kısa geçerli çerçeve: adres + function code + LRC. Veri alanı boş olabilir. */
const MIN_DECODED_LENGTH = 3;

/**
 * Exception yanıtında function code'un 0x80 biti setlenir; adlandırma için alt 7 bit
 * okunur. Maske `modbusPdu.ts`te de var ama DIŞA AÇILMIYOR (PDU sözleşmesine alan
 * eklemek yasak); iki satırlık sabiti kopyalamak, sözleşmeyi genişletmekten ucuzdur.
 */
const ORIGINAL_FUNCTION_MASK = 0x7f;

const NIBBLE_BITS = 4;
const DECIMAL_TEN = 10;
const CHAR_DIGIT_ZERO = 0x30;
const CHAR_DIGIT_NINE = 0x39;
const CHAR_UPPER_A = 0x41;
const CHAR_UPPER_F = 0x46;
const CHAR_LOWER_A = 0x61;
const CHAR_LOWER_F = 0x66;

/**
 * Serial Line Protocol and Implementation Guide V1.02 (spec'in seri hat için
 * gösterdiği normatif referans): 0 broadcast, 1–247 tekil cihaz, 248–255 AYRILMIŞ.
 * Ayrılmış aralık hata değildir — çalışan kurulumlar vardır — ama sessizce geçilirse
 * kullanıcı yanlış adresli bir master'ı günlerce arar.
 */
const BROADCAST_ADDRESS = 0;
const MAX_INDIVIDUAL_ADDRESS = 247;

/**
 * Görünen her metin çeviri anahtarıdır (CLAUDE.md). Anahtarlar TAM LİTERAL yazılır:
 * şablonla üretilseydi ne grep ile bulunurdu ne de sözlükten düşünce fark edilirdi.
 *
 * Anahtarların hiçbirinde YER TUTUCU YOKTUR. Değişkenler (kaçıncı bayt, hangi karakter,
 * alınan/hesaplanan LRC) `ProtocolError.details` içinde makine-okunur olarak taşınır ve
 * arayüzde ayrı <span>'lerde basılır — sözlükte olmayan bir yer tutucuyla `t(key, vars)`
 * çağrısı çalışma zamanında fırlatır.
 */
const ERROR_MISSING_COLON = 'protocol.modbus.ascii.error.missingColon';
const ERROR_INVALID_HEX_CHARACTER = 'protocol.modbus.ascii.error.invalidHexCharacter';
const ERROR_ODD_HEX_DIGIT_COUNT = 'protocol.modbus.ascii.error.oddHexDigitCount';
const ERROR_MISSING_CARRIAGE_RETURN = 'protocol.modbus.ascii.error.missingCarriageReturn';
const ERROR_MISSING_LINE_FEED = 'protocol.modbus.ascii.error.missingLineFeed';
const ERROR_FRAME_TOO_SHORT = 'protocol.modbus.ascii.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.modbus.ascii.error.frameTooLong';
const ERROR_LRC_MISMATCH = 'protocol.modbus.ascii.error.lrcMismatch';
const ERROR_PARSER_CANCELLED = 'protocol.modbus.ascii.error.parserCancelled';

const WARN_LRC_MISMATCH = 'protocol.modbus.ascii.warning.lrcMismatch';
const WARN_RESERVED_SLAVE_ADDRESS = 'protocol.modbus.ascii.warning.reservedSlaveAddress';

const EXAMPLE_REQUEST_DESCRIPTION =
  'protocol.modbus.ascii.example.readHoldingRegistersRequest.description';
const EXAMPLE_RESPONSE_DESCRIPTION =
  'protocol.modbus.ascii.example.readHoldingRegistersResponse.description';
const EXAMPLE_EXCEPTION_DESCRIPTION = 'protocol.modbus.ascii.example.exceptionResponse.description';
const EXAMPLE_INVALID_HEX_DESCRIPTION =
  'protocol.modbus.ascii.example.invalidHexCharacter.description';
const EXAMPLE_LRC_MISMATCH_DESCRIPTION = 'protocol.modbus.ascii.example.lrcMismatch.description';

/**
 * Alan adları İngilizce protokol terimidir = VERİDİR, çeviri sözlüğüne girmez —
 * spec §3.3 çerçeve kırılımını bu sözcüklerle sayıyor (Colon, Address, Function,
 * Data, LRC, CR, LF) ve `modbusPdu.ts` de alan adlarını aynı gerekçeyle İngilizce
 * bırakır. Spec CR ile LF'i ayrı satırda sayar; burada TEK bölge olarak veriliyor,
 * çünkü ByteViewer'da iki ayrı 1 baytlık bölge sonlandırıcıyı okunmaz hâle getirir.
 */
const FIELD_NAME_START_DELIMITER = 'Colon';
const FIELD_NAME_SLAVE_ADDRESS = 'Slave Address';
const FIELD_NAME_FUNCTION_CODE = 'Function Code';
const FIELD_NAME_LRC = 'LRC';
const FIELD_NAME_END_DELIMITER = 'CR LF';
const BROADCAST_LABEL = 'Broadcast';

const PROTOCOL_ID = 'modbus-ascii';
const PROTOCOL_DISPLAY_NAME = 'Modbus ASCII';

/** Ham ASCII akışındaki ofset: ':' atlanır, her çözülmüş bayt iki karakter yer kaplar. */
function wireOffsetForDecodedIndex(decodedIndex: number): number {
  return FIRST_HEX_INDEX + decodedIndex * WIRE_CHARS_PER_BYTE;
}

/**
 * Tek hex karakterinin sayısal değeri; hex değilse `undefined`.
 * Modbus ASCII telde BÜYÜK harf üretir, ama okuyan taraf küçük harfi de kabul eder:
 * sahadaki dönüştürücülerin bir kısmı küçük harf basıyor ve reddetmek çözülebilir bir
 * çerçeveyi çöpe atmak olurdu.
 */
function hexNibble(charCode: number): number | undefined {
  if (charCode >= CHAR_DIGIT_ZERO && charCode <= CHAR_DIGIT_NINE) {
    return charCode - CHAR_DIGIT_ZERO;
  }
  if (charCode >= CHAR_UPPER_A && charCode <= CHAR_UPPER_F) {
    return charCode - CHAR_UPPER_A + DECIMAL_TEN;
  }
  if (charCode >= CHAR_LOWER_A && charCode <= CHAR_LOWER_F) {
    return charCode - CHAR_LOWER_A + DECIMAL_TEN;
  }
  return undefined;
}

interface FailureOptions {
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function failure(
  code: ProtocolErrorCode,
  messageKey: string,
  consumedBytes: number,
  recoverable: boolean,
  options: FailureOptions = {},
): ParseResult {
  const error: ProtocolError = { code, message: messageKey };
  if (options.offset !== undefined) {
    error.offset = options.offset;
  }
  if (options.length !== undefined) {
    error.length = options.length;
  }
  if (options.details !== undefined) {
    error.details = options.details;
  }
  return { success: false, error, consumedBytes, recoverable };
}

/**
 * Doğrulanmış hex çiftlerini çözer. Çağrılmadan ÖNCE her karakter `hexNibble` ile
 * denetlenmiştir; buradaki `?? 0` yalnız `noUncheckedIndexedAccess` daralmasıdır,
 * çalışma zamanında erişilmez. Fırlatmak yerine 0'a düşmek bilinçli: parser hiçbir
 * girdide çökmemeli (spec §47).
 */
function decodeHexPairs(wire: Uint8Array, start: number, pairCount: number): Uint8Array {
  const decoded = new Uint8Array(pairCount);
  for (let index = 0; index < pairCount; index++) {
    const cursor = start + index * WIRE_CHARS_PER_BYTE;
    const high = hexNibble(wire[cursor] ?? 0) ?? 0;
    const low = hexNibble(wire[cursor + 1] ?? 0) ?? 0;
    decoded[index] = (high << NIBBLE_BITS) | low;
  }
  return decoded;
}

/** Ham akıştan tek bölge okuyan alan üreticisi; `length === rawBytes.length` değişmezini korur. */
function createWireField(
  wire: Uint8Array,
  id: string,
  name: string,
  offset: number,
  length: number,
): ParsedField {
  return {
    id,
    name,
    offset,
    length,
    rawBytes: wire.slice(offset, offset + length),
    valid: true,
    warnings: [],
  };
}

/**
 * PDU alanını gövde ofsetinden ham ASCII ofsetine taşır. `rawValue`/`physicalValue`
 * kopyalanır (çözülmüş sayı), `rawBytes` ise ham karakterlerle yeniden okunur.
 */
function toWireField(field: ParsedField, wire: Uint8Array): ParsedField {
  const offset = wireOffsetForDecodedIndex(BODY_DECODED_START + field.offset);
  const length = field.length * WIRE_CHARS_PER_BYTE;
  const mapped: ParsedField = {
    id: field.id,
    name: field.name,
    offset,
    length,
    rawBytes: wire.slice(offset, offset + length),
    valid: field.valid,
    // Kopyalanır, paylaşılmaz: çağıran diziyi değiştirirse PDU sonucunu bozmasın.
    warnings: [...field.warnings],
  };
  if (field.rawValue !== undefined) {
    mapped.rawValue = field.rawValue;
  }
  if (field.physicalValue !== undefined) {
    mapped.physicalValue = field.physicalValue;
  }
  if (field.unit !== undefined) {
    mapped.unit = field.unit;
  }
  return mapped;
}

/**
 * Ham baytlardan Modbus ASCII çerçevesi çözer.
 *
 * `role` verilmezse function code'un exception bitine bakılarak çıkarılır: 0x80 set ise
 * yanıt, değilse istek. Tel üzerinde yön bilgisi YOKTUR (aynı çerçeve biçimi iki yönde de
 * geçerlidir), bu yüzden çıkarım bir tahmindir — çağıran bilgi sahibiyse `role`'ü açıkça
 * versin. Açıkça 'request' verilirse exception bitli çerçeve uyarı üretir, çünkü o durumda
 * çağıran yönü bildiğini iddia etmiştir ve iddiası veriyle çelişir.
 */
export function parseModbusAscii(data: Uint8Array, role?: PduRole): ParseResult {
  if (data.length === 0 || data[0] !== COLON) {
    // Akışın başındaki çöp atılır: bir sonraki ':' bulunursa oraya kadar tüketilir,
    // hiç yoksa tamamı. İkisi de ilerleme sağlar — 0 dönmek burada sonsuz döngüdür.
    const nextColon = data.indexOf(COLON, 1);
    const consumed = data.length === 0 ? 0 : nextColon === -1 ? data.length : nextColon;
    return failure('start-delimiter-not-found', ERROR_MISSING_COLON, consumed, true, { offset: 0 });
  }

  const lineFeedIndex = data.indexOf(LINE_FEED, FIRST_HEX_INDEX);
  const hasLineFeed = lineFeedIndex !== -1;
  // CR yalnız LF'in HEMEN ÖNÜNDEYSE sonlandırıcının parçasıdır; başka yerdeki CR
  // sonlandırıcı sayılmaz (o zaman "eksik CR" hatası doğar).
  const carriageReturnIndex = hasLineFeed
    ? lineFeedIndex > FIRST_HEX_INDEX && data[lineFeedIndex - 1] === CARRIAGE_RETURN
      ? lineFeedIndex - 1
      : -1
    : data.indexOf(CARRIAGE_RETURN, FIRST_HEX_INDEX);
  /**
   * Hex bölgesi ':' ile sonlandırıcı arasıdır. LF henüz gelmemiş ama CR gelmişse bölge
   * YİNE CR'de biter: aksi hâlde yarım alınmış geçerli bir çerçevenin (`…FA\r`) CR'i
   * "geçersiz hex karakteri" sanılır ve akış katmanı sağlam veriyi çöpe atardı.
   */
  const hexEnd =
    carriageReturnIndex !== -1 ? carriageReturnIndex : hasLineFeed ? lineFeedIndex : data.length;

  for (let index = FIRST_HEX_INDEX; index < hexEnd; index++) {
    const charCode = data[index];
    if (charCode === undefined || hexNibble(charCode) === undefined) {
      // Sonlandırıcı bulunduysa bozuk çerçevenin tamamı atılır; bulunmadıysa hatalı
      // karaktere kadar ilerlenir ki çağıran oradan sonraki ':' ile resenkronize olsun.
      const consumed = hasLineFeed ? lineFeedIndex + 1 : index;
      return failure('invalid-hex-input', ERROR_INVALID_HEX_CHARACTER, consumed, true, {
        offset: index,
        length: 1,
        details: {
          character: charCode === undefined ? '' : String.fromCharCode(charCode),
          characterCode: charCode ?? 0,
        },
      });
    }
  }

  if (!hasLineFeed) {
    // Yarım çerçeve: 0 tüketmek "daha çok veri bekle" demektir. Veri hiç gelmezse
    // bu bir zaman aşımıdır ve kararı akış katmanı verir (spec §3.3 "Timeout").
    return failure('truncated-frame', ERROR_MISSING_LINE_FEED, 0, true, { offset: data.length });
  }
  if (carriageReturnIndex === -1) {
    return failure('truncated-frame', ERROR_MISSING_CARRIAGE_RETURN, lineFeedIndex + 1, true, {
      offset: lineFeedIndex,
      length: 1,
    });
  }

  const hexDigitCount = hexEnd - FIRST_HEX_INDEX;
  if (hexDigitCount % WIRE_CHARS_PER_BYTE !== 0) {
    return failure('invalid-hex-input', ERROR_ODD_HEX_DIGIT_COUNT, lineFeedIndex + 1, true, {
      offset: FIRST_HEX_INDEX,
      length: hexDigitCount,
      details: { hexDigitCount },
    });
  }

  const decodedLength = hexDigitCount / WIRE_CHARS_PER_BYTE;
  if (decodedLength < MIN_DECODED_LENGTH) {
    return failure('length-mismatch', ERROR_FRAME_TOO_SHORT, lineFeedIndex + 1, true, {
      offset: FIRST_HEX_INDEX,
      length: hexDigitCount,
      details: { decodedLength, minimumDecodedLength: MIN_DECODED_LENGTH },
    });
  }

  const frameLength = lineFeedIndex + 1;
  const wire = data.slice(0, frameLength);
  const decoded = decodeHexPairs(data, FIRST_HEX_INDEX, decodedLength);
  const slaveAddress = decoded[ADDRESS_DECODED_INDEX] ?? 0;
  const functionCode = decoded[FUNCTION_DECODED_INDEX] ?? 0;
  const lrcDecodedIndex = decodedLength - 1;
  const receivedLrc = decoded[lrcDecodedIndex] ?? 0;
  // LRC kapsamı LRC baytının KENDİSİ HARİÇ her şeydir: adres + function code + veri.
  const coverage = decoded.subarray(0, lrcDecodedIndex);
  const calculatedLrc = lrcChecksum(coverage);
  const lrcMatches = calculatedLrc === receivedLrc;

  const body = decoded.slice(BODY_DECODED_START, lrcDecodedIndex);
  const effectiveRole: PduRole =
    role ?? (isExceptionResponse(functionCode) ? 'response' : 'request');
  const pdu = decodePdu(functionCode, body, effectiveRole);

  const fields: ParsedField[] = [];
  fields.push(createWireField(wire, 'start-delimiter', FIELD_NAME_START_DELIMITER, 0, 1));

  const addressField = createWireField(
    wire,
    'slave-address',
    FIELD_NAME_SLAVE_ADDRESS,
    wireOffsetForDecodedIndex(ADDRESS_DECODED_INDEX),
    WIRE_CHARS_PER_BYTE,
  );
  addressField.rawValue = slaveAddress;
  const warnings: ProtocolWarning[] = [];
  if (slaveAddress === BROADCAST_ADDRESS) {
    // Protokol terimi = veri; sayının yanında anlamı da görünmezse kullanıcı 0'ı
    // "adressiz/bozuk" sanır.
    addressField.physicalValue = BROADCAST_LABEL;
  } else if (slaveAddress > MAX_INDIVIDUAL_ADDRESS) {
    addressField.warnings.push(WARN_RESERVED_SLAVE_ADDRESS);
    warnings.push({
      code: WARN_RESERVED_SLAVE_ADDRESS,
      message: WARN_RESERVED_SLAVE_ADDRESS,
      offset: addressField.offset,
      length: addressField.length,
    });
  }
  fields.push(addressField);

  const functionField = createWireField(
    wire,
    'function-code',
    FIELD_NAME_FUNCTION_CODE,
    wireOffsetForDecodedIndex(FUNCTION_DECODED_INDEX),
    WIRE_CHARS_PER_BYTE,
  );
  functionField.rawValue = functionCode;
  // Exception yanıtında 0x80 soyulup ORİJİNAL fonksiyonun adı basılır: 0x83'ün yanında
  // "Read Holding Registers" görmek doğrudur, çünkü exception o isteğe verilmiş yanıttır.
  // Yanıtın exception olduğu ham değerden (0x83) ve PDU'nun `exception-code` alanından
  // okunur; bu alan adı onların yerini almaz.
  const functionInfo = getFunctionCodeInfo(
    isExceptionResponse(functionCode) ? functionCode & ORIGINAL_FUNCTION_MASK : functionCode,
  );
  if (functionInfo !== undefined) {
    functionField.physicalValue = functionInfo.name;
  }
  fields.push(functionField);

  for (const field of pdu.fields) {
    fields.push(toWireField(field, wire));
  }

  const lrcField = createWireField(
    wire,
    'lrc',
    FIELD_NAME_LRC,
    wireOffsetForDecodedIndex(lrcDecodedIndex),
    WIRE_CHARS_PER_BYTE,
  );
  lrcField.rawValue = receivedLrc;
  lrcField.valid = lrcMatches;
  if (!lrcMatches) {
    lrcField.warnings.push(WARN_LRC_MISMATCH);
  }
  fields.push(lrcField);

  fields.push(
    createWireField(
      wire,
      'end-delimiter',
      FIELD_NAME_END_DELIMITER,
      lineFeedIndex - 1,
      TERMINATOR_LENGTH,
    ),
  );

  // PDU uyarıları zaten çeviri anahtarıdır; `code` ile `message` bilerek aynı anahtardır —
  // anahtar hem makine-okunur ayrımı hem gösterilecek metni tek başına taşıyor.
  for (const key of pdu.warnings) {
    warnings.push({ code: key, message: key });
  }

  const errors: ProtocolError[] = [];
  if (!lrcMatches) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_LRC_MISMATCH,
      offset: lrcField.offset,
      length: lrcField.length,
      // Spec §3.3 "LRC Received / Calculated / Coverage / PASS-FAIL" ekranının verisi.
      details: {
        received: receivedLrc,
        calculated: calculatedLrc,
        coverageOffset: FIRST_HEX_INDEX,
        coverageLength: lrcDecodedIndex * WIRE_CHARS_PER_BYTE,
      },
    });
  }

  /**
   * `ParsedFrame` sözleşmesinde özet/çözülmüş bayt alanı YOKTUR ve sözleşme
   * değiştirilemez (172 protokolün ortak zemini). Taşımaya özgü ek bilgi bu yüzden
   * `rawFrame.metadata` üzerinden gider: spec §3.3'ün istediği üç görünümden
   * "DECODED BYTES" ve LRC panosu buradan beslenir.
   */
  const rawFrame = createRawFrame(wire, {
    metadata: {
      decodedBytes: decoded,
      role: effectiveRole,
      slaveAddress,
      functionCode,
      lrcReceived: receivedLrc,
      lrcCalculated: calculatedLrc,
      lrcCoverageOffset: FIRST_HEX_INDEX,
      lrcCoverageLength: lrcDecodedIndex * WIRE_CHARS_PER_BYTE,
      summaryKey: pdu.summaryKey,
      summaryParams: pdu.summaryParams,
    },
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

  return { success: true, frame, consumedBytes: frameLength };
}

/**
 * Çözülmüş yükten (adres + function code + veri) ham ASCII çerçevesi üretir: LRC
 * hesaplanır, hex BÜYÜK harf yazılır, başa ':' sona CR LF eklenir. Katalogdaki
 * "Builder" aracının çekirdeği ve testteki gidiş-dönüş doğrulamasının aracı budur —
 * örnek çerçevelerin elle yazılmış LRC'si bununla karşılaştırılır, böylece örnek ile
 * algoritma birbirinden kayamaz.
 */
export function buildModbusAsciiFrame(payload: Uint8Array): Uint8Array {
  const lrc = lrcChecksum(payload);
  const frame = new Uint8Array(
    FIRST_HEX_INDEX + (payload.length + 1) * WIRE_CHARS_PER_BYTE + TERMINATOR_LENGTH,
  );
  frame[0] = COLON;
  let cursor = FIRST_HEX_INDEX;
  // Yükün ardından LRC de aynı hex biçiminde yazılır; tek döngü için sona eklenir.
  for (const value of [...payload, lrc]) {
    const text = value.toString(16).toUpperCase().padStart(WIRE_CHARS_PER_BYTE, '0');
    frame[cursor] = text.charCodeAt(0);
    frame[cursor + 1] = text.charCodeAt(1);
    cursor += WIRE_CHARS_PER_BYTE;
  }
  frame[cursor] = CARRIAGE_RETURN;
  frame[cursor + 1] = LINE_FEED;
  return frame;
}

/** Wire ASCII metnini bayta çevirir. Örnek çerçeveler spec'teki gibi okunur yazılsın diye var. */
function wireTextToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

/** `ParseContext.options.role` serbest `unknown`tır; yalnız iki değer kabul edilir. */
function resolveRole(context: ParseContext | undefined): PduRole | undefined {
  const role = context?.options?.role;
  if (role === 'request' || role === 'response') {
    return role;
  }
  return undefined;
}

/**
 * Bağlamdaki kimlik/zaman bilgisini çözülmüş çerçeveye geçirir. `parseModbusAscii`
 * imzası bilerek `(data, role)` olarak sabittir (tek çerçevelik hesap araçları bağlam
 * kurmak zorunda kalmasın); bağlam alanları bu yüzden sonradan yazılır.
 */
function applyContext(frame: ParsedFrame, context: ParseContext): void {
  if (context.timestamp !== undefined) {
    frame.rawFrame.timestamp = context.timestamp;
    frame.timestamp = context.timestamp;
  }
  if (context.direction !== undefined) {
    frame.rawFrame.direction = context.direction;
  }
  if (context.channel !== undefined) {
    frame.rawFrame.channel = context.channel;
  }
}

export const modbusAsciiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Auto-detection 172 parser'a sırayla sorar: burada YALNIZ ilk bayta bakılır.
   * LRC'ye, uzunluğa ya da sonlandırıcıya bakmak bu adımı akış boyu O(n) yapardı ve
   * yarım gelen (henüz CR LF'i olmayan) geçerli bir çerçeveyi eler.
   */
  canParse(data: Uint8Array): boolean {
    return data.length > 0 && data[0] === COLON;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    if (context?.signal?.aborted === true) {
      // İptal beklenen bir sonuçtur, hata değil: fırlatmak yerine kod döner (spec §41).
      return failure('parser-timeout', ERROR_PARSER_CANCELLED, 0, false);
    }

    const maxFrameLength = context?.maxFrameLength;
    if (
      maxFrameLength !== undefined &&
      data.length > maxFrameLength &&
      data.subarray(0, maxFrameLength).indexOf(LINE_FEED) === -1
    ) {
      // Sonlandırıcısı olmayan sınırsız bir akış buffer'ı büyütmesin: sınıra kadarı atılır.
      return failure('frame-too-long', ERROR_FRAME_TOO_LONG, maxFrameLength, true, {
        offset: 0,
        length: maxFrameLength,
        details: { maxFrameLength },
      });
    }

    const result = parseModbusAscii(data, resolveRole(context));
    if (result.success && context !== undefined) {
      applyContext(result.frame, context);
    }
    return result;
  },
};

/**
 * ÖRNEK ÇERÇEVELER — hepsinin LRC'si elle doğrulandı, testte de `lrcChecksum` ile
 * yeniden hesaplanıp karşılaştırılıyor.
 *
 * 1) İstek `:010300000002FA\r\n` — spec §3.3'te BİREBİR bu dizgeyle yazılı
 *    ("WIRE ASCII: :010300000002FA\r\n"). Doğrulama: 01+03+00+00+00+02 = 0x06,
 *    two's complement 0x100 − 0x06 = 0xFA. ✔
 *
 * 2) Yanıt `:010304006400C8CC\r\n` — spec ASCII biçimini VERMİYOR; RTU yanıtı
 *    `01 03 04 00 64 00 C8 BA 7A` (spec §3.3 fixture) buraya adım adım çevrildi:
 *      a. RTU'nun son iki baytı CRC'dir (BA 7A) ve ASCII'de KULLANILMAZ — atılır.
 *         Kalan yük: 01 03 04 00 64 00 C8.
 *      b. LRC = yükün 8-bit toplamının two's complement'i:
 *         0x01+0x03 = 0x04 → +0x04 = 0x08 → +0x00 = 0x08 → +0x64 = 0x6C
 *         → +0x00 = 0x6C → +0xC8 = 0x134; alt bayt 0x34; 0x100 − 0x34 = 0xCC.
 *      c. Her bayt iki büyük harf hex karakteri: "01" "03" "04" "00" "64" "00" "C8"
 *         → "010304006400C8", ardından LRC "CC".
 *      d. Başa ':' sona CR LF: `:010304006400C8CC\r\n` (19 bayt).
 *
 * 3) Exception `:0183027A\r\n` — spec §3.3'ün exception örneği "FC=0x03 → Illegal Data
 *    Address" ASCII'ye aynı yöntemle çevrildi: exception yanıtında function code
 *    0x03 | 0x80 = 0x83, exception code 0x02 (Illegal Data Address). Yük 01 83 02;
 *    0x01+0x83 = 0x84, +0x02 = 0x86; LRC = 0x100 − 0x86 = 0x7A.
 *
 * 4) `:0103GG00` — spec'in HATA örneği, aynen alındı ("'G' is not a hexadecimal
 *    character"). Sonlandırıcısı da yok; bilerek düzeltilmedi, spec ne yazdıysa o.
 *
 * 5) `:010300000002FB\r\n` — (1)'in LRC'si bir eksiltilmiş hâli. Alınan 0xFB,
 *    hesaplanan 0xFA: LRC panosunun FAIL yolunu ve "alanlar yine de çözülür"
 *    davranışını gösterir.
 */
export const MODBUS_ASCII_EXAMPLE_FRAMES: readonly ExampleFrame[] = [
  {
    id: 'read-holding-registers-request',
    name: 'Read Holding Registers Request',
    bytes: wireTextToBytes(':010300000002FA\r\n'),
    description: EXAMPLE_REQUEST_DESCRIPTION,
    expectedValid: true,
  },
  {
    id: 'read-holding-registers-response',
    name: 'Read Holding Registers Response',
    bytes: wireTextToBytes(':010304006400C8CC\r\n'),
    description: EXAMPLE_RESPONSE_DESCRIPTION,
    expectedValid: true,
  },
  {
    id: 'exception-response',
    name: 'Illegal Data Address Exception',
    bytes: wireTextToBytes(':0183027A\r\n'),
    description: EXAMPLE_EXCEPTION_DESCRIPTION,
    expectedValid: true,
  },
  {
    id: 'invalid-hex-character',
    name: 'Invalid Hex Character',
    bytes: wireTextToBytes(':0103GG00'),
    description: EXAMPLE_INVALID_HEX_DESCRIPTION,
    expectedValid: false,
  },
  {
    id: 'lrc-mismatch',
    name: 'LRC Mismatch',
    bytes: wireTextToBytes(':010300000002FB\r\n'),
    description: EXAMPLE_LRC_MISMATCH_DESCRIPTION,
    expectedValid: false,
  },
];

export const modbusAsciiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: modbusAsciiParser,
  // Girdi: adres/unit baytı + PDU (bkz. `modbusEncoders.ts` dosya başı).
  encoder: { encode: encodeModbusAsciiFrame },
  documentation: {
    summary: 'protocol.modbus.ascii.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Modbus Application Protocol V1.1b3',
        url: 'https://www.modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf',
      },
      {
        title: 'Modbus over Serial Line Specification and Implementation Guide V1.02',
        url: 'https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf',
      },
    ],
  },
  exampleFrames: [...MODBUS_ASCII_EXAMPLE_FRAMES],
};
