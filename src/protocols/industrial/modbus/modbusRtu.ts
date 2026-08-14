/**
 * Modbus RTU taşıma katmanı — seri hatta binary encoding (spec §3.3 "Modbus RTU").
 *
 * ADU: `ADDRESS | FUNCTION | DATA | CRC LOW | CRC HIGH`. Function code çözümü BURADA
 * YOKTUR; üç Modbus taşıması aynı uygulama modelini paylaştığı için o iş `modbusPdu.ts`
 * içinde tek yerde yaşar. Bu dosyanın işi yalnız çerçeve: adres, CRC ve PDU gövdesinin
 * çerçeve içindeki yeri.
 *
 * TUZAK — OFSET TABANI: `decodePdu` ofsetleri PDU GÖVDESİNE göre 0-tabanlıdır (gövde =
 * function code'dan sonrası). RTU başlığı iki byte olduğu için buradaki her PDU alanının
 * ofsetine `RTU_PDU_BODY_OFFSET` eklenir; eklenmezse byte-viewer yanlış byte'ı vurgular.
 *
 * TUZAK — CRC KAPSAMI VE SIRASI: CRC-16/MODBUS, ADRESTEN PDU'NUN SON BYTE'INA KADAR
 * hesaplanır; CRC'nin kendi iki byte'ı kapsam DIŞINDADIR. Telde önce CRC LOW, sonra CRC
 * HIGH gider — yani saklanan alan LITTLE-ENDIAN'dır, oysa Modbus'un bütün veri alanları
 * big-endian'dır. İki kuralın aynı çerçevede zıt olması standardın kendisidir.
 *
 * TUZAK — ÇERÇEVE SINIRI: RTU'da başlangıç/bitiş sınırlayıcısı YOKTUR, sınır 3.5 karakterlik
 * sessizliktir (spec §3.3 "Framing delimiter değil timing'dir"). Bu yüzden `parse` verilen
 * dizinin TAM BİR ÇERÇEVE olduğunu varsayar: içeriğe bakarak nerede bittiğini bulamaz,
 * bulmaya çalışmak da uydurma olurdu. Akıştan çerçeve kesmek zamanlama katmanının işidir.
 *
 * Bozuk CRC HATA'dır ama çerçeve yine de ALAN ALAN çözülür (`success: true`,
 * `frame.valid: false`): kullanıcı neyin bozulduğunu ancak alanları görürse anlar
 * (spec §47 "hatalı veride uygulamayı çökertme").
 */

import {
  computeChecksum,
  readStoredChecksum,
} from '@/protocol-core/checksums/algorithmCatalogue';
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

import { decodePdu, getFunctionCodeInfo, isExceptionResponse } from './modbusPdu';
import type { PduRole } from './modbusPdu';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda: bağ bu string. */
const PROTOCOL_ID = 'modbus-rtu';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md "protokol adları veridir"). */
const PROTOCOL_DISPLAY_NAME = 'Modbus RTU';

const RTU_ADDRESS_OFFSET = 0;
const RTU_FUNCTION_CODE_OFFSET = 1;
/** PDU gövdesinin çerçeve içindeki başlangıcı = `decodePdu` ofsetlerine eklenecek taban. */
const RTU_PDU_BODY_OFFSET = 2;
const RTU_CRC_LENGTH = 2;
const SINGLE_BYTE_FIELD_LENGTH = 1;

/**
 * En kısa anlamlı çerçeve: adres + function code + CRC. PDU gövdesi boş olabilir
 * (gövdesiz istek yoktur ama bozuk hattan gelen dört byte yine de çözülüp gösterilir).
 */
export const MODBUS_RTU_MIN_FRAME_LENGTH = 4;
/**
 * Serial Line Implementation Guide V1.02: RTU ADU en çok 256 byte (253 byte PDU + adres +
 * iki byte CRC). Sınır spec §41'in "maximum frame length uygula" maddesinin RTU karşılığıdır.
 */
export const MODBUS_RTU_MAX_FRAME_LENGTH = 256;

/** Yayın adresi: yalnız istekte görülür, hiçbir cihaz bu adresle yanıt vermez. */
const BROADCAST_ADDRESS = 0;
/** 1–247 tekil cihaz; 248–255 standartta ayrılmıştır. */
const MAX_INDIVIDUAL_ADDRESS = 247;

/** Exception biti (0x80) atıldığında geriye kalan gerçek function code. */
const FUNCTION_CODE_MASK = 0x7f;

/** Okuma isteğinin gövdesi tam dört byte'tır: start address + quantity. */
const READ_REQUEST_BODY_LENGTH = 4;
/** Çoklu yazma YANITININ gövdesi de dört byte'tır: start address + quantity yankısı. */
const WRITE_MULTIPLE_RESPONSE_BODY_LENGTH = 4;

/** Rol çıkarımında adı geçen function code'lar — sihirli sayı bırakmamak için. */
const FUNCTION_READ_COILS = 0x01;
const FUNCTION_READ_DISCRETE_INPUTS = 0x02;
const FUNCTION_READ_HOLDING_REGISTERS = 0x03;
const FUNCTION_READ_INPUT_REGISTERS = 0x04;
const FUNCTION_WRITE_MULTIPLE_COILS = 0x0f;
const FUNCTION_WRITE_MULTIPLE_REGISTERS = 0x10;
const FUNCTION_READ_WRITE_MULTIPLE_REGISTERS = 0x17;

/**
 * Hata ve uyarı dizgeleri ÇEVİRİ ANAHTARIDIR, düz metin değil: görünen hiçbir metin koda
 * gömülmez (CLAUDE.md). Anahtarlar tam literal yazılır — şablonla üretilseydi ne grep ile
 * bulunur ne de sözlükten düşünce fark edilirdi. Hiçbirinde yer tutucu yoktur; sayılar
 * (alınan/hesaplanan CRC) `details` ve `metadata` üzerinden ayrı basılır.
 */
const ERROR_CRC_MISMATCH = 'protocol.modbus.rtu.error.crcMismatch';
const ERROR_FRAME_TOO_SHORT = 'protocol.modbus.rtu.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.modbus.rtu.error.frameTooLong';
const ERROR_UNSUPPORTED_FUNCTION_CODE = 'protocol.modbus.rtu.error.unsupportedFunctionCode';
const ERROR_ABORTED = 'protocol.modbus.rtu.error.aborted';

const WARN_ROLE_INFERRED_REQUEST = 'protocol.modbus.rtu.warning.roleInferredRequest';
const WARN_ROLE_INFERRED_RESPONSE = 'protocol.modbus.rtu.warning.roleInferredResponse';
const WARN_BROADCAST_ADDRESS = 'protocol.modbus.rtu.warning.broadcastAddress';
const WARN_RESERVED_SLAVE_ADDRESS = 'protocol.modbus.rtu.warning.reservedSlaveAddress';

/**
 * Çerçeve seviyesinde taşınan ek bilgi. `ParsedFrame`de özet alanı YOKTUR ve sözleşmeye
 * alan eklenmez (spec §7); PDU'nun ürettiği özet anahtarı ile spec §3.3'ün istediği CRC
 * görünümü (Received / Calculated / Coverage / PASS-FAIL) bu yüzden `RawFrame.metadata`
 * üzerinden taşınır.
 *
 * `interface` DEĞİL `type`: `RawFrame.metadata` alanı `Record<string, unknown>` ve
 * TypeScript arayüzleri örtük indeks imzası taşımadığı için oraya atanamazdı.
 */
export type ModbusRtuFrameMetadata = {
  /** Çerçevenin istek mi yanıt mı sayıldığı — alan çözümü buna göre yapıldı. */
  role: PduRole;
  /** true ise rol çağıran tarafından verilmedi, içerikten tahmin edildi. */
  roleInferred: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
  /** Telde gelen CRC (little-endian okunmuş). */
  crcReceived: number;
  /** Aynı kapsam üzerinden hesaplanan CRC — ikisi yan yana gösterilir. */
  crcCalculated: number;
  /** CRC'nin kapsadığı byte sayısı: adresten PDU sonuna, CRC'nin kendisi hariç. */
  crcCoverageLength: number;
};

/**
 * `ProtocolWarning.code` ile `message` aynı çeviri anahtarını taşır. Kasıtlı: anahtar
 * zaten benzersiz ve kararlı bir makine kimliğidir; ona paralel ikinci bir kod kümesi
 * uydurmak, ikisinin sessizce ayrışabileceği bir yer açardı. `message` çeviri anahtarıdır
 * çünkü metin burada üretilemez (protocol-core i18n bilmez, worker içinde de koşar).
 */
function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** Uzunluk kontrolünden sonra bile `noUncheckedIndexedAccess` guard ister. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Yanıt gövdesi kendini tarif eder: ilk byte, ardından gelen veri byte'larının sayısıdır. */
function hasByteCountShape(body: Uint8Array): boolean {
  const byteCount = body[0];
  return byteCount !== undefined && byteCount === body.length - SINGLE_BYTE_FIELD_LENGTH;
}

/**
 * İstek/yanıt ayrımı Modbus'ta TELDE TAŞINMAZ; aynı function code iki yönde de aynı byte'tır.
 * Ayrım ancak gövde şeklinden çıkarılabilir, bu yüzden burada verilen karar bir TAHMİNDİR
 * ve çağıran onu uyarı olarak kullanıcıya bildirir.
 *
 * `unitAddress` verilirse yayın adresi kestirmesi kullanılır: 0 adresine hiçbir cihaz
 * yanıt vermez, dolayısıyla o çerçeve istektir. Adres taşımayan Modbus TCP de bu yüzden
 * parametreyi boş bırakabilir.
 *
 * Bilinçli kabul edilen belirsizlik: dört byte'lık bir gövde hem okuma isteği hem de üç
 * byte veri taşıyan bir coil yanıtı olabilir. İstek seçilir — RTU hattında okuma isteği
 * kıyaslanamayacak kadar sık ve karar kullanıcıya uyarıyla bildiriliyor.
 */
export function inferModbusRole(
  functionCode: number,
  body: Uint8Array,
  unitAddress?: number,
): PduRole {
  if (isExceptionResponse(functionCode)) {
    return 'response';
  }
  if (unitAddress === BROADCAST_ADDRESS) {
    return 'request';
  }

  const info = getFunctionCodeInfo(functionCode);
  if (info === undefined) {
    return 'request';
  }

  switch (info.code) {
    case FUNCTION_READ_COILS:
    case FUNCTION_READ_DISCRETE_INPUTS:
    case FUNCTION_READ_HOLDING_REGISTERS:
    case FUNCTION_READ_INPUT_REGISTERS:
      // İstek gövdesi tam dört byte; yanıt gövdesi byte count + veri. Dört byte'lık
      // gövdede istek kazanır (yukarıdaki belirsizlik notu).
      if (body.length === READ_REQUEST_BODY_LENGTH) {
        return 'request';
      }
      return hasByteCountShape(body) ? 'response' : 'request';
    case FUNCTION_READ_WRITE_MULTIPLE_REGISTERS:
      // İsteği en az dokuz byte; yanıtı byte count + okunan register'lar. Dört byte'lık
      // çakışma yok, bu yüzden tek ölçüt gövdenin kendini tarif etmesi.
      return hasByteCountShape(body) ? 'response' : 'request';
    case FUNCTION_WRITE_MULTIPLE_COILS:
    case FUNCTION_WRITE_MULTIPLE_REGISTERS:
      // Yanıt yalnız start address + quantity yankılar; istek ayrıca byte count + veri taşır.
      return body.length === WRITE_MULTIPLE_RESPONSE_BODY_LENGTH ? 'response' : 'request';
    default:
      // 0x05, 0x06, 0x16, 0x2B: istek ve yanıt AYNI şekildedir, telde ayırt edilemez.
      return 'request';
  }
}

function buildAddressField(data: Uint8Array): ParsedField {
  const address = byteAt(data, RTU_ADDRESS_OFFSET);
  const warnings: string[] = [];
  if (address === BROADCAST_ADDRESS) {
    warnings.push(WARN_BROADCAST_ADDRESS);
  }
  const reserved = address > MAX_INDIVIDUAL_ADDRESS;
  if (reserved) {
    warnings.push(WARN_RESERVED_SLAVE_ADDRESS);
  }
  return {
    id: 'slave-address',
    name: 'Slave Address',
    offset: RTU_ADDRESS_OFFSET,
    length: SINGLE_BYTE_FIELD_LENGTH,
    rawBytes: data.slice(RTU_ADDRESS_OFFSET, RTU_ADDRESS_OFFSET + SINGLE_BYTE_FIELD_LENGTH),
    rawValue: address,
    valid: !reserved,
    warnings,
  };
}

/**
 * Function code alanını taşıma katmanı basar (PDU çözücü basmaz), çünkü ofseti taşımaya
 * göre değişir. `physicalValue` kodun semantik karşılığıdır: exception yanıtında 0x80 biti
 * atılmış ASIL fonksiyonun adı yazılır — kullanıcı 0x83'ün hangi isteğin yanıtı olduğunu
 * ancak böyle görür.
 */
function buildFunctionCodeField(data: Uint8Array): ParsedField {
  const functionCode = byteAt(data, RTU_FUNCTION_CODE_OFFSET);
  const info = getFunctionCodeInfo(functionCode & FUNCTION_CODE_MASK);
  const field: ParsedField = {
    id: 'function-code',
    name: 'Function Code',
    offset: RTU_FUNCTION_CODE_OFFSET,
    length: SINGLE_BYTE_FIELD_LENGTH,
    rawBytes: data.slice(
      RTU_FUNCTION_CODE_OFFSET,
      RTU_FUNCTION_CODE_OFFSET + SINGLE_BYTE_FIELD_LENGTH,
    ),
    rawValue: functionCode,
    valid: info !== undefined,
    warnings: [],
  };
  if (info !== undefined) {
    field.physicalValue = info.name;
  }
  return field;
}

/** PDU alanlarının ofsetini çerçeve tabanına taşır. Kopya üretir: girdi alanları bozulmaz. */
function shiftFields(fields: readonly ParsedField[], delta: number): ParsedField[] {
  return fields.map((field) => ({ ...field, offset: field.offset + delta }));
}

interface CrcOutcome {
  readonly field: ParsedField;
  readonly received: number;
  readonly calculated: number;
  readonly coverageLength: number;
  readonly matches: boolean;
}

function checkCrc(data: Uint8Array): CrcOutcome {
  const crcOffset = data.length - RTU_CRC_LENGTH;
  // Kapsam: adresten PDU'nun son byte'ına kadar; CRC'nin kendi iki byte'ı HARİÇ.
  const covered = data.subarray(0, crcOffset);
  // `computeChecksum` yalnız 'none' için undefined döner; sabit algoritma verildiği için
  // bu dal ölüdür, ama tip guard'ı olmadan derlenmez.
  const calculated = Number(computeChecksum(covered, 'CRC16_MODBUS') ?? 0n);
  const crcBytes = data.slice(crcOffset);
  // Telde CRC LOW önce gider: saklanan alan little-endian'dır (veri alanları big-endian olsa da).
  const received = Number(readStoredChecksum(crcBytes, 'little'));
  const matches = received === calculated;
  return {
    field: {
      id: 'crc',
      name: 'CRC',
      offset: crcOffset,
      length: RTU_CRC_LENGTH,
      rawBytes: crcBytes,
      rawValue: received,
      // Spec §3.3 CRC görünümü alınan ve hesaplanan değeri YAN YANA ister; hesaplanan
      // değerin alandaki tek anlamlı karşılığı budur.
      physicalValue: calculated,
      valid: matches,
      warnings: [],
    },
    received,
    calculated,
    coverageLength: covered.length,
    matches,
  };
}

interface RtuParseOptions {
  role?: PduRole;
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseRtuFrame(data: Uint8Array, options: RtuParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil: fırlatmak yerine kodla döner (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MODBUS_RTU_MIN_FRAME_LENGTH) {
    // `consumedBytes: 0` + `recoverable: true` = "daha çok veri bekle"; byte atmak,
    // hattaki bir sonraki çerçevenin başını da yutardı.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? MODBUS_RTU_MAX_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
    // Buffer ayrılmadan durulur (spec §41). `recoverable: false`: RTU'da uzunluk alanı
    // yoktur, yani kaydırıp yeniden denemek kör bir arama olurdu.
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

  const address = byteAt(data, RTU_ADDRESS_OFFSET);
  const functionCode = byteAt(data, RTU_FUNCTION_CODE_OFFSET);
  const body = data.slice(RTU_PDU_BODY_OFFSET, data.length - RTU_CRC_LENGTH);

  const roleInferred = options.role === undefined;
  const role = options.role ?? inferModbusRole(functionCode, body, address);

  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  if (roleInferred) {
    warnings.push(
      toProtocolWarning(
        role === 'request' ? WARN_ROLE_INFERRED_REQUEST : WARN_ROLE_INFERRED_RESPONSE,
      ),
    );
  }

  const decoded = decodePdu(functionCode, body, role);
  for (const key of decoded.warnings) {
    warnings.push(toProtocolWarning(key));
  }

  const crc = checkCrc(data);
  if (!crc.matches) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_CRC_MISMATCH,
      offset: crc.field.offset,
      length: RTU_CRC_LENGTH,
      // Spec §3.3'ün CRC hata görünümü: Received / Calculated / Difference.
      details: {
        received: crc.received,
        calculated: crc.calculated,
        difference: crc.received ^ crc.calculated,
        coverageLength: crc.coverageLength,
      },
    });
  }

  // Bilinmeyen function code spec §42'nin adlandırdığı hatadır ("Unsupported function
  // code") ve kararı taşıma katmanı verir — `decodePdu` yalnız uyarır. Hata sayılması
  // çerçeveyi gizlemez: alanlar yine dolu döner, ham gövde tek blok olarak gösterilir.
  if (getFunctionCodeInfo(functionCode & FUNCTION_CODE_MASK) === undefined) {
    errors.push({
      code: 'unsupported-function-code',
      message: ERROR_UNSUPPORTED_FUNCTION_CODE,
      offset: RTU_FUNCTION_CODE_OFFSET,
      length: SINGLE_BYTE_FIELD_LENGTH,
      details: { functionCode },
    });
  }

  const metadata: ModbusRtuFrameMetadata = {
    role,
    roleInferred,
    summaryKey: decoded.summaryKey,
    summaryParams: decoded.summaryParams,
    crcReceived: crc.received,
    crcCalculated: crc.calculated,
    crcCoverageLength: crc.coverageLength,
  };

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
    fields: [
      buildAddressField(data),
      buildFunctionCodeField(data),
      ...shiftFields(decoded.fields, RTU_PDU_BODY_OFFSET),
      crc.field,
    ],
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/**
 * Tek bir RTU çerçevesini çözer. `role` verilmezse gövde şeklinden tahmin edilir ve
 * tahmin çerçeve uyarısı olarak bildirilir.
 *
 * `data` TAM BİR ÇERÇEVE olmalıdır (bkz. dosya başındaki çerçeve sınırı tuzağı).
 */
export function parseModbusRtu(data: Uint8Array, role?: PduRole): ParseResult {
  return parseRtuFrame(data, role === undefined ? {} : { role });
}

/** `context.options.role` serbest `unknown`tır; daraltmadan kullanılamaz. */
function readRoleOption(options: Record<string, unknown> | undefined): PduRole | undefined {
  const role = options?.['role'];
  return role === 'request' || role === 'response' ? role : undefined;
}

export const modbusRtuParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * UCUZ olmak zorunda: otomatik tanımada 172 parser'a sırayla soruluyor (spec §7).
   * Bu yüzden yalnız uzunluk aralığı ve TEK bir byte okunur — CRC hesabı burada YAPILMAZ,
   * yoksa her aday protokol için bütün çerçeve taranırdı. Bilinmeyen function code da
   * elenmez: eleseydi "unsupported function code" yolu otomatik tanımada hiç görünmezdi.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MODBUS_RTU_MIN_FRAME_LENGTH || data.length > MODBUS_RTU_MAX_FRAME_LENGTH) {
      return false;
    }
    const functionCode = data[RTU_FUNCTION_CODE_OFFSET];
    if (functionCode === undefined) {
      return false;
    }
    // 0x00 hiçbir Modbus function code'u değildir; exception biti atıldığında da sıfır
    // kalıyorsa çerçeve Modbus olamaz.
    return (functionCode & FUNCTION_CODE_MASK) !== 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: RtuParseOptions = {};
    const role = readRoleOption(context?.options);
    if (role !== undefined) {
      options.role = role;
    }
    if (context?.timestamp !== undefined) {
      options.timestamp = context.timestamp;
    }
    if (context?.direction !== undefined) {
      options.direction = context.direction;
    }
    if (context?.channel !== undefined) {
      options.channel = context.channel;
    }
    if (context?.maxFrameLength !== undefined) {
      options.maxFrameLength = context.maxFrameLength;
    }
    if (context?.signal !== undefined) {
      options.signal = context.signal;
    }
    return parseRtuFrame(data, options);
  },
};

/**
 * Örnek çerçeveler spec §42 madde 4'ün "örnek veri"si ve §43'ün fixture'ıdır: arayüzdeki
 * "örnek yükle" ile testler AYNI byte dizisini kullanır. CRC değerleri uydurulmadı —
 * `modbusRtu.test.ts` her örneği gerçek motorla çözüp `expectedValid` ile karşılaştırır.
 *
 * Adlar ve açıklamalar çeviri anahtarıdır (görünen metin koda gömülmez); byte dizileri
 * veridir. Tüketici bu dizileri DEĞİŞTİRMEMELİ — plugin nesnesi tekildir, paylaşılır.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-holding-registers-request',
    name: 'protocol.modbus.rtu.example.readHoldingRegistersRequest.name',
    // 01 03 00 00 00 02 C4 0B — spec §43 fixture'ı ve §3.3'ün istek örneği.
    bytes: Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]),
    description: 'protocol.modbus.rtu.example.readHoldingRegistersRequest.description',
    expectedValid: true,
  },
  {
    id: 'read-holding-registers-response',
    name: 'protocol.modbus.rtu.example.readHoldingRegistersResponse.name',
    // 01 03 04 00 64 00 C8 BA 7A — spec §3.3: ByteCount=4, Reg0=100, Reg1=200.
    bytes: Uint8Array.from([0x01, 0x03, 0x04, 0x00, 0x64, 0x00, 0xc8, 0xba, 0x7a]),
    description: 'protocol.modbus.rtu.example.readHoldingRegistersResponse.description',
    expectedValid: true,
  },
  {
    id: 'exception-response',
    name: 'protocol.modbus.rtu.example.exceptionResponse.name',
    // 01 83 02 C0 F1 — spec §3.3'ün exception örneği: FC=0x03 → Illegal Data Address.
    bytes: Uint8Array.from([0x01, 0x83, 0x02, 0xc0, 0xf1]),
    description: 'protocol.modbus.rtu.example.exceptionResponse.description',
    expectedValid: true,
  },
  {
    id: 'write-multiple-coils-request',
    name: 'protocol.modbus.rtu.example.writeMultipleCoilsRequest.name',
    // 11 0F 00 13 00 0A 02 CD 01 BF 0B — Modbus Application Protocol V1.1b3'ün
    // Write Multiple Coils örneği (slave 17, 10 coil, start 0x0013).
    bytes: Uint8Array.from([
      0x11, 0x0f, 0x00, 0x13, 0x00, 0x0a, 0x02, 0xcd, 0x01, 0xbf, 0x0b,
    ]),
    description: 'protocol.modbus.rtu.example.writeMultipleCoilsRequest.description',
    expectedValid: true,
  },
  {
    id: 'crc-mismatch',
    name: 'protocol.modbus.rtu.example.crcMismatch.name',
    // 01 03 00 00 00 02 C5 0B — spec §3.3'ün CRC hata örneği birebir:
    // Received=0x0BC5, Calculated=0x0BC4, Difference=0x0001.
    bytes: Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc5, 0x0b]),
    description: 'protocol.modbus.rtu.example.crcMismatch.description',
    expectedValid: false,
  },
];

export const modbusRtuPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: modbusRtuParser,
  documentation: {
    summary: 'protocol.modbus.rtu.documentation.summary',
    // Katalogdaki kayıtla aynı sözcük: seri çerçeveleme + function-code uygulaması.
    layer: 'multi-layer',
    references: [
      {
        title: 'Modbus Application Protocol V1.1b3',
        url: 'https://modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf',
      },
      {
        title: 'Modbus over Serial Line Specification and Implementation Guide V1.02',
        url: 'https://modbus.org/docs/Modbus_over_serial_line_V1_02.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
