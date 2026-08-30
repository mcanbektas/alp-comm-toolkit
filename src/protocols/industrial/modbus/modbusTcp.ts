/**
 * Modbus TCP taşıma katmanı — MBAP başlığı + PDU (spec §3.3 "Modbus TCP").
 *
 * İLK SORU, PEŞİNEN: **CRC YOKTUR.** RTU'dan gelen okuyucu burada CRC arar ve
 * bulamayınca "eksik yazılmış" sanır. Spec §3.3 bunu açıkça söylüyor: "RTU CRC yok —
 * bütünlük TCP/IP stack'ine bırakılır". TCP'nin kendi checksum'ı ve yeniden iletimi
 * bozuk baytı zaten elemekte; uygulama katmanında ikinci bir CRC taşımak boşuna.
 * Dolayısıyla bu dosyada `crc-mismatch` hatası ÜRETİLMEZ ve üretilmemelidir.
 *
 * MBAP (7 byte) + PDU:
 *   offset 0..1  Transaction ID   (big-endian; yanıt eşleştirmesi ZAMANA GÖRE DEĞİL
 *                                  buna göredir — spec §3.3, çoklu outstanding request)
 *   offset 2..3  Protocol ID      (Modbus için 0)
 *   offset 4..5  Length           (bkz. aşağıdaki tuzak)
 *   offset 6     Unit ID
 *   offset 7     Function Code    ┐ PDU
 *   offset 8..   PDU gövdesi      ┘
 *
 * TUZAK — LENGTH NEYİ SAYAR: `Length` kendisinden SONRAKİ baytları, yani Unit ID'den
 * itibaren sonuna kadar sayar. Unit ID DAHİL, kendisi ve önündeki 4 byte HARİÇ. Spec
 * örneği bunu sabitliyor: `00 01|00 00|00 06|01|03 00 00 00 02` → Len=6 = Unit ID(1) +
 * Function(1) + Data(4); toplam çerçeve 6 + 6 = 12 byte. Bu yüzden toplam uzunluk
 * `LENGTH_FIELD_EXCLUDED_BYTES + length`tir; "başlık + length" diye toplanırsa çerçeve
 * bir byte kısa/uzun kesilir ve sonraki ADU'nun hizası kayar.
 *
 * TUZAK — 1 TCP OKUMASI ≠ 1 MESAJ (spec §3.3 "TCP stream problemi"): tek payload'da
 * birden çok ADU olabilir. Bu yüzden `parseModbusTcp` verilen tamponun TAMAMINI değil
 * YALNIZ İLK ADU'yu çözer ve `consumedBytes` ile tükettiği baytı bildirir; çağıran
 * kalanla yeniden çağırarak akışı boşaltır. Tamponda ADU'nun tamamı yoksa
 * `consumedBytes: 0` + `recoverable: true` döner: "daha çok veri bekle".
 *
 * OFSET TABANI: `decodePdu` alan ofsetlerini PDU GÖVDESİNE göre 0'dan verir; burada
 * hepsine `PDU_BODY_OFFSET` (=8) eklenir, çünkü byte-viewer ham ADU üzerinde vurgular.
 *
 * HATA ile UYARI METNİ FARKLI KAYNAKTAN gelir; asimetri types.ts'in kendi asimetrisidir
 * (hata kodu KAPALI union, uyarı kodu AÇIK string):
 *   - `ProtocolError.message` → spec §42'nin İngilizce tanı metni, VERİDİR. Kullanıcıya
 *     gösterilen çevrilmiş etiket `error.code`dan üretilir (arayüz tarafında kapalı
 *     union için tam bir kod→anahtar tablosu var), bu yüzden burada çeviri anahtarı
 *     taşımak gereksiz ve arayüzde ham anahtar basılmasına yol açar.
 *   - `ProtocolWarning.code`/`message` → ÇEVİRİ ANAHTARI. Uyarı kodları açık uçlu
 *     olduğu için arayüzde kod→anahtar tablosu yoktur; anahtar uyarının kendisiyle
 *     yolculuk etmek zorunda. `modbusPdu` de uyarılarını anahtar olarak veriyor,
 *     buradan geçenler aynen korunur.
 */

import { bytesToNumber } from '@/protocol-core/buffers/endianness';
import { encodeModbusTcpFrame } from './modbusEncoders';
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
  RawFrameInit,
} from '@/protocol-core/types';

import { decodePdu, getFunctionCodeInfo, isExceptionResponse } from './modbusPdu';
import type { PduRole } from './modbusPdu';

/** MBAP başlığı: Transaction ID(2) + Protocol ID(2) + Length(2) + Unit ID(1). */
const MBAP_HEADER_LENGTH = 7;

const TRANSACTION_ID_OFFSET = 0;
const PROTOCOL_ID_OFFSET = 2;
const LENGTH_OFFSET = 4;
const UNIT_ID_OFFSET = 6;
const FUNCTION_CODE_OFFSET = 7;
/** PDU gövdesi function code'dan sonra başlar: 7 byte MBAP + 1 byte function code. */
const PDU_BODY_OFFSET = 8;

const WORD_BYTE_LENGTH = 2;
const SINGLE_BYTE_LENGTH = 1;

/** Modbus TCP'nin Protocol ID'si sabittir; başka değer başka bir protokolü işaret eder. */
const MODBUS_PROTOCOL_ID = 0;

/** Length alanının SAYMADIĞI baytlar: Transaction ID(2) + Protocol ID(2) + Length(2). */
const LENGTH_FIELD_EXCLUDED_BYTES = 6;

/** Length en az Unit ID(1) + Function Code(1) sayar; altı yapısal olarak imkânsızdır. */
const MIN_LENGTH_FIELD_VALUE = 2;

/**
 * V1.1b3 PDU'yu 253 byte ile sınırlar; Unit ID ile birlikte Length en çok 254 olur
 * (toplam ADU 260 byte). Üstü YASAK DEĞİL ama şüphelidir — gateway'ler bazen daha
 * uzun taşır, bu yüzden hata değil uyarı üretilir.
 */
const MAX_LENGTH_FIELD_VALUE = 254;

/** Çözülebilir en kısa ADU: MBAP + function code. Altında function code bile okunamaz. */
const MIN_ADU_LENGTH = MBAP_HEADER_LENGTH + SINGLE_BYTE_LENGTH;

/**
 * Exception yanıtında orijinal function code alt 7 bittedir. `modbusPdu` bu maskeyi
 * dışa açmıyor (modül-içi sabiti), bu yüzden burada tekrar tanımlandı — tek satırlık
 * bir bit maskesi için sözleşmeye alan eklemek doğru takas değil.
 */
const ORIGINAL_FUNCTION_CODE_MASK = 0x7f;

/**
 * Tanı metinleri ÇEVİRİ DEĞİL VERİDİR (bkz. dosya başındaki hata/uyarı asimetrisi):
 * ilki spec §42'nin hata mesajı listesinden BİREBİR alınmıştır. Sayı GÖMÜLMEZ — hangi
 * uzunluğun beklendiği `error.details` içinde yapısal olarak taşınır, metin sabit kalır.
 *
 * Aşağıdaki uyarı dizgeleri ise ÇEVİRİ ANAHTARIDIR ve TAM LİTERAL yazılır: şablonla
 * üretilseydi ne grep ile bulunur ne de sözlükten düşünce fark edilirdi. Yer tutucu
 * yoktur — sözlükte olmayan yer tutucuyla `t(key, vars)` çağrısı çalışma zamanında
 * fırlatır; sayılar alan değerlerinde durur ve arayüzde ayrı <span>'lerde basılır.
 */
const ERROR_TEXT_LENGTH_MISMATCH = 'Frame length does not match the length field';
const ERROR_TEXT_TRUNCATED_FRAME = 'Frame is shorter than the MBAP header and function code';
const ERROR_TEXT_FRAME_TOO_LONG = 'Frame length exceeds the configured maximum frame length';
const ERROR_TEXT_PARSE_ABORTED = 'Parsing was aborted by the caller';

const WARN_UNEXPECTED_PROTOCOL_ID = 'protocol.modbus.tcp.warning.unexpectedProtocolId';
const WARN_OVERSIZED_LENGTH = 'protocol.modbus.tcp.warning.oversizedLength';

/** Katalogdaki kayıt id'si ile birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'modbus-tcp';
const DISPLAY_NAME = 'Modbus TCP';

/** `RawFrame.metadata` anahtarları — bağlantı katmanının kendi anahtarlarıyla çakışmasın. */
const METADATA_SUMMARY_KEY = 'modbusSummaryKey';
const METADATA_SUMMARY_PARAMS = 'modbusSummaryParams';
const METADATA_ROLE = 'modbusRole';

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  /** false ise akış bu protokol için terk edilir; true ise veri beklenir/kaydırılır. */
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  // Opsiyoneller yalnız doluysa yazılır (exactOptionalPropertyTypes'a hazırlık).
  if (init.offset !== undefined) {
    error.offset = init.offset;
  }
  if (init.length !== undefined) {
    error.length = init.length;
  }
  if (init.details !== undefined) {
    error.details = init.details;
  }
  // consumedBytes daima 0: hatalı ADU'nun sınırı bilinmiyorsa kaç byte atılacağı da
  // bilinmiyordur; uydurma bir ilerletme sonraki ADU'nun hizasını bozar.
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

function readWord(data: Uint8Array, offset: number): number {
  return bytesToNumber(data.slice(offset, offset + WORD_BYTE_LENGTH), 'big');
}

function createWordField(
  data: Uint8Array,
  offset: number,
  id: string,
  name: string,
): { readonly field: ParsedField; readonly value: number } {
  const rawBytes = data.slice(offset, offset + WORD_BYTE_LENGTH);
  const value = bytesToNumber(rawBytes, 'big');
  return {
    field: {
      id,
      name,
      offset,
      length: WORD_BYTE_LENGTH,
      rawBytes,
      rawValue: value,
      valid: true,
      warnings: [],
    },
    value,
  };
}

function createByteField(
  data: Uint8Array,
  offset: number,
  id: string,
  name: string,
): { readonly field: ParsedField; readonly value: number } {
  const rawBytes = data.slice(offset, offset + SINGLE_BYTE_LENGTH);
  // noUncheckedIndexedAccess: sınır çağıran tarafından garanti edilse de tip `number | undefined`.
  const value = rawBytes[0] ?? 0;
  return {
    field: {
      id,
      name,
      offset,
      length: SINGLE_BYTE_LENGTH,
      rawBytes,
      rawValue: value,
      valid: true,
      warnings: [],
    },
    value,
  };
}

function createWarning(key: string, offset: number, length: number): ProtocolWarning {
  return { code: key, message: key, offset, length };
}

/**
 * Tek çerçeveden yön ÇIKARILAMAZ: aynı function code hem istekte hem yanıtta geçer ve
 * ayrım ancak Transaction ID eşleştirmesiyle yapılır (spec §3.3) — o da analyzer'ın işi.
 * Bu yüzden çağıran söylemediyse 'request' varsayılır; tek istisna exception bitidir,
 * çünkü 0x80 yalnız yanıtta bulunur. Çağıran AÇIKÇA 'request' derse sezgi devreye
 * girmez: o durumda `decodePdu`'nun "istekte exception biti" uyarısı istenen çıktıdır.
 */
function resolveRole(functionCode: number, role: PduRole | undefined): PduRole {
  if (role !== undefined) {
    return role;
  }
  return isExceptionResponse(functionCode) ? 'response' : 'request';
}

function readRoleFromContext(context: ParseContext | undefined): PduRole | undefined {
  const role = context?.options?.role;
  return role === 'request' || role === 'response' ? role : undefined;
}

function buildRawFrameInit(context: ParseContext | undefined, metadata: Record<string, unknown>): RawFrameInit {
  const init: RawFrameInit = { metadata };
  if (context?.timestamp !== undefined) {
    init.timestamp = context.timestamp;
  }
  if (context?.direction !== undefined) {
    init.direction = context.direction;
  }
  if (context?.channel !== undefined) {
    init.channel = context.channel;
  }
  return init;
}

/**
 * Tampondaki İLK Modbus TCP ADU'sunu çözer.
 *
 * `role` verilmezse function code'dan sezilir (bkz. `resolveRole`). `context` yalnız
 * kaydetme/iptal ayrıntıları içindir; verilmeden çağrılmak geçerli kullanımdır (spec §7).
 *
 * Fırlatmaz. Eksik veri ve tutarsız uzunluk `success: false` ile döner; çözülebilen ama
 * kuşkulu çerçeveler (Protocol ID ≠ 0, bozuk PDU gövdesi) `success: true` + uyarı +
 * `frame.valid = false` ile döner — kısmi çözüm kullanıcıya gösterilir (spec §47).
 */
export function parseModbusTcp(
  data: Uint8Array,
  role?: PduRole,
  context?: ParseContext,
): ParseResult {
  // İptal beklenen bir sonuçtur, hata değil: exception fırlatmak yerine sonuç döner (spec §41).
  if (context?.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_TEXT_PARSE_ABORTED, recoverable: false });
  }

  if (data.length < MIN_ADU_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_TEXT_TRUNCATED_FRAME,
      // Akıştan geliyorsa eksik olan yalnız zamandır; tampon büyüyünce aynı veri çözülür.
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: MIN_ADU_LENGTH },
    });
  }

  const declaredLength = readWord(data, LENGTH_OFFSET);
  const frameLength = LENGTH_FIELD_EXCLUDED_BYTES + declaredLength;

  if (declaredLength < MIN_LENGTH_FIELD_VALUE) {
    // Unit ID + Function Code'a bile yetmeyen uzunluk hiçbir veri eklenerek düzelmez.
    // TCP'de resenkronize olunacak bir başlangıç damgası da yok (RTU'nun sessiz aralığı,
    // ASCII'nin ':' karakteri gibi) — bu yüzden akış bu protokol için terk edilir.
    return fail({
      code: 'length-mismatch',
      message: ERROR_TEXT_LENGTH_MISMATCH,
      recoverable: false,
      offset: LENGTH_OFFSET,
      length: WORD_BYTE_LENGTH,
      details: { declaredLength, minimumLength: MIN_LENGTH_FIELD_VALUE },
    });
  }

  if (context?.maxFrameLength !== undefined && frameLength > context.maxFrameLength) {
    // Spec §41: bozuk uzunluk alanı yüzünden gigabyte'lık tampon ayırma. Buffer AYRILMADAN
    // önce durulur; veri kopyalanmaz.
    return fail({
      code: 'frame-too-long',
      message: ERROR_TEXT_FRAME_TOO_LONG,
      recoverable: false,
      offset: LENGTH_OFFSET,
      length: WORD_BYTE_LENGTH,
      details: { frameLength, maxFrameLength: context.maxFrameLength },
    });
  }

  if (data.length < frameLength) {
    return fail({
      code: 'length-mismatch',
      message: ERROR_TEXT_LENGTH_MISMATCH,
      // Bir ADU birden çok TCP segmentine bölünmüş olabilir (spec §3.3): kalanı bekle.
      recoverable: true,
      offset: LENGTH_OFFSET,
      length: WORD_BYTE_LENGTH,
      details: { declaredLength, expectedFrameLength: frameLength, availableBytes: data.length },
    });
  }

  // Fazlası sonraki ADU'ya aittir: tampon değil, YALNIZ bu çerçeve kesilir.
  const adu = data.slice(0, frameLength);
  const warnings: ProtocolWarning[] = [];

  const transactionId = createWordField(adu, TRANSACTION_ID_OFFSET, 'transaction-id', 'Transaction ID');
  const protocolId = createWordField(adu, PROTOCOL_ID_OFFSET, 'protocol-id', 'Protocol ID');
  const lengthField = createWordField(adu, LENGTH_OFFSET, 'length', 'Length');
  // rawValue Unit ID'den itibaren sayan tel değeri, physicalValue toplam ADU uzunluğu:
  // kullanıcının byte sayarken aradığı sayı ikincisidir, ama ilki telde gidendir.
  lengthField.field.physicalValue = frameLength;

  if (protocolId.value !== MODBUS_PROTOCOL_ID) {
    // Hata değil: aynı port üzerinde başka bir protokol kapsülleniyor olabilir. Çerçeveyi
    // yine de Modbus gibi çözüp kullanıcıya göstermek, sessizce reddetmekten yararlıdır.
    protocolId.field.valid = false;
    protocolId.field.warnings.push(WARN_UNEXPECTED_PROTOCOL_ID);
    warnings.push(createWarning(WARN_UNEXPECTED_PROTOCOL_ID, PROTOCOL_ID_OFFSET, WORD_BYTE_LENGTH));
  }

  if (declaredLength > MAX_LENGTH_FIELD_VALUE) {
    lengthField.field.warnings.push(WARN_OVERSIZED_LENGTH);
    warnings.push(createWarning(WARN_OVERSIZED_LENGTH, LENGTH_OFFSET, WORD_BYTE_LENGTH));
  }

  const unitId = createByteField(adu, UNIT_ID_OFFSET, 'unit-id', 'Unit ID');
  const functionCode = createByteField(adu, FUNCTION_CODE_OFFSET, 'function-code', 'Function Code');

  const effectiveRole = resolveRole(functionCode.value, role);
  const isException = isExceptionResponse(functionCode.value);
  const originalFunctionCode = isException
    ? functionCode.value & ORIGINAL_FUNCTION_CODE_MASK
    : functionCode.value;
  const functionInfo = getFunctionCodeInfo(originalFunctionCode);
  if (functionInfo !== undefined) {
    // Exception yanıtında da ADI basılır: kullanıcı hangi isteğin reddedildiğini görür.
    // Reddedilmiş olduğu bilgisi `exception-code` alanında ve özet anahtarındadır.
    functionCode.field.physicalValue = functionInfo.name;
  }

  const body = adu.slice(PDU_BODY_OFFSET);
  const decoded = decodePdu(functionCode.value, body, effectiveRole);

  const fields: ParsedField[] = [
    transactionId.field,
    protocolId.field,
    lengthField.field,
    unitId.field,
    functionCode.field,
  ];
  for (const field of decoded.fields) {
    // PDU ofsetleri gövdeye göre 0-tabanlı; ham ADU'ya taşınıyor. Alanlar `decodePdu`
    // içinde yeni üretildiği için kopyalamak zorunlu değil ama mutasyon yerine kopya
    // üretmek çağrının saf kalmasını görünür kılıyor.
    fields.push({ ...field, offset: field.offset + PDU_BODY_OFFSET });
  }

  for (const key of decoded.warnings) {
    // PDU uyarılarının ofseti yoktur: hangi alandan geldikleri alanın kendi
    // `warnings` listesinde durur, çerçeve seviyesinde tekrarlanmaz.
    warnings.push({ code: key, message: key });
  }

  const metadata: Record<string, unknown> = {
    [METADATA_SUMMARY_KEY]: decoded.summaryKey,
    [METADATA_SUMMARY_PARAMS]: decoded.summaryParams,
    [METADATA_ROLE]: effectiveRole,
  };
  const rawFrame = createRawFrame(adu, buildRawFrameInit(context, metadata));

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    // TCP'de doğrulanacak bir checksum olmadığı için geçerlilik ölçütü YAPISAL
    // tutarlılıktır: tek bir uyarı bile "bu çerçeve temiz değil" demektir.
    valid: warnings.length === 0,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: frameLength };
}

export const modbusTcpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: DISPLAY_NAME,

  /**
   * UCUZ ön eleme (spec §7: 172 parser'a sırayla sorulur). Yalnız iki şey bakılır:
   * function code'a yetecek uzunluk ve Protocol ID = 0. Length alanının tutarlılığı
   * BİLEREK kontrol edilmez — yarım gelmiş bir ADU da Modbus TCP'dir, `parse` onu
   * "daha çok veri bekle" diye ayırt eder. CRC zaten yok, bakılacak bir şey de yok.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_ADU_LENGTH) {
      return false;
    }
    const high = data[PROTOCOL_ID_OFFSET];
    const low = data[PROTOCOL_ID_OFFSET + 1];
    // noUncheckedIndexedAccess: uzunluk kontrolü geçilmiş olsa da tip `number | undefined`.
    if (high === undefined || low === undefined) {
      return false;
    }
    // Slice/`readWord` yerine elle birleştirme: canParse 172 parser için sırayla koşar,
    // her çağrıda iki baytlık bir dizi ayırmak bedava değil.
    return ((high << 8) | low) === MODBUS_PROTOCOL_ID;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseModbusTcp(data, readRoleFromContext(context), context);
  },
};

/**
 * Örnek çerçeveler (spec §42 madde 4 "örnek veri" + §43 fixture'ları aynı kaynaktan).
 *
 * 1. numaralı çerçeve spec §3.3'te birebir yazılıdır. 2. ve 3. çerçeveler spec'in RTU
 * bölümündeki DOĞRULANMIŞ PDU'ların MBAP'a sarılmasıyla üretildi; çevrim şudur:
 *   RTU  `01 03 04 00 64 00 C8 BA 7A`  → Address=01, PDU=`03 04 00 64 00 C8`, CRC atılır
 *   TCP  Length = 1 (Unit ID) + 6 (PDU) = 7 → `00 01 00 00 00 07 01 03 04 00 64 00 C8`
 * Yani RTU'nun ADDRESS baytı Unit ID olur, CRC düşer, başa TID+PID+Length eklenir.
 * Transaction ID uydurmadır (istek/yanıtın eşleşmesi için ikisinde de 0x0001 seçildi);
 * geri kalan her bayt spec'ten gelir.
 *
 * Adlar protokol terimidir (veri, çeviriye girmez); açıklamalar spec §3.3'ün kendi alan
 * gösterimidir (`TID=1, PID=0, Len=6 …`) — düz metin cümle kurulmadı, çevrilecek bir
 * ifade yok.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-holding-registers-request',
    name: 'Read Holding Registers Request',
    bytes: new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x02]),
    description: 'TID=1, PID=0, Len=6, UID=1, FC=0x03, Start=0, Qty=2 (40001-40002)',
  },
  {
    id: 'read-holding-registers-response',
    name: 'Read Holding Registers Response',
    bytes: new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x07, 0x01, 0x03, 0x04, 0x00, 0x64, 0x00, 0xc8,
    ]),
    description: 'TID=1, PID=0, Len=7, UID=1, FC=0x03, ByteCount=4, Reg0=100, Reg1=200',
  },
  {
    id: 'illegal-data-address-exception',
    name: 'Read Holding Registers Exception',
    bytes: new Uint8Array([0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x01, 0x83, 0x02]),
    description: 'TID=2, PID=0, Len=3, UID=1, FC=0x83, Exception=0x02 Illegal Data Address',
  },
  {
    id: 'write-single-register-request',
    name: 'Write Single Register Request',
    bytes: new Uint8Array([0x00, 0x0a, 0x00, 0x00, 0x00, 0x06, 0x11, 0x06, 0x00, 0x01, 0x00, 0x03]),
    description: 'TID=10, PID=0, Len=6, UID=17, FC=0x06, Address=1 (40002), Value=3',
  },
  {
    id: 'length-field-mismatch',
    name: 'Length Field Mismatch',
    bytes: new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x09, 0x01, 0x03, 0x00, 0x00, 0x00, 0x02]),
    description: 'Len=9, wire=12 byte (expected 15) — length-mismatch',
    expectedValid: false,
  },
];

export const modbusTcpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: DISPLAY_NAME,
  category: 'industrial-automation',
  parser: modbusTcpParser,
  // Girdi: adres/unit baytı + PDU (bkz. `modbusEncoders.ts` dosya başı).
  encoder: { encode: encodeModbusTcpFrame },
  documentation: {
    // Katalogdaki `modbus-tcp` kaydının özetiyle aynı cümle: iki yerde ayrışmasın diye
    // birebir kopyalandı (katalog verisi İngilizce tutulur, çeviriye girmez).
    summary:
      'Modbus PDUs wrapped in an MBAP header on TCP/IP, where responses are matched by transaction ID and integrity is delegated to the TCP stack.',
    layer: 'application',
    references: [
      {
        title: 'Modbus Messaging on TCP/IP Implementation Guide V1.0b',
        url: 'https://www.modbus.org/docs/Modbus_Messaging_Implementation_Guide_V1_0b.pdf',
      },
      {
        title: 'Modbus Application Protocol V1.1b3',
        url: 'https://www.modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
