/**
 * PMBus — SMBus iskeleti + komut yorumu. Faz 10 dalga 11i (sıralama önerisi #8).
 *
 * Paket iskeleti `smbusCore.ts`ten gelir (smbus.ts ile PAYLAŞILAN çekirdek):
 * PMBus spec özetinin kendi tanımı "SMBus tabanlı command protocol"dür, yani
 * adresleme/repeated-START/PEC aynıdır. Bu dosyanın EKLEDİĞİ tek şey komut
 * kodunun ve veri baytlarının ANLAMI.
 *
 * ── Motor tekrar yazılmadı ──────────────────────────────────────────────────
 * Linear11/Linear16 çözümü `protocol-core/timing/pmbus.ts`te (Faz 5) zaten
 * vardı ve `PmbusLinearTool` üzerinden koşuyordu. Bu dalgada aynı motora
 * DIRECT formatı (`decodeDirect`/`encodeDirect`/`parseDirectCoefficients`) ve
 * VOUT_MODE çözümü eklendi — gerekçe ve kaynak o dosyanın içinde.
 *
 * ── Bayt sırası ─────────────────────────────────────────────────────────────
 * PMBus iki baytlık veriyi DÜŞÜK BAYT ÖNCE gönderir (spec Part II §7.6,
 * "standard PMBus data format transmission rules of low byte first"). Word
 * birleştirme bu yüzden `low | high << 8`; I²C/SPI sayfalarındaki büyük-uçlu
 * adres birleştirmesiyle KARIŞTIRILMAMALI.
 *
 * ── Uydurulmayan şey: ULINEAR16 üssü ────────────────────────────────────────
 * VOUT_COMMAND/READ_VOUT gibi çıkış-gerilimi komutlarının üssü çerçevede
 * TAŞINMAZ; VOUT_MODE komutundan ayrıca bilinir (§8.4.1.1). Parser API'sinin
 * konfigürasyon kanalı yok (`parse(data, context)` yalnız timestamp/direction/
 * channel/signal taşır — dalga 11d'de sabitlenen gerçek), dolayısıyla tek bir
 * yakalamadan üs BİLİNEMEZ. Bu durumda ham word gösterilir ve alanın fiziksel
 * değeri "VOUT_MODE gerekli" der; varsayılan bir üs UYDURULMAZ. Aynı disiplin
 * zinciri: 1-Wire endianness → RS-232 gerilim aralığı → 4–20 mA arıza eşikleri
 * → LIN break asgarisi → burası.
 *
 * ── Spec özetinin KENDİ örneği tutarsız (1-Wire ROM ID emsali) ──────────────
 * Özet, "Raw: 0x1234, Format: Linear16, Exponent: …, Physical: 12.04 V" diyor.
 * 12.04 / 0x1234 (=4660) = 0.002584…, bu bir 2 kuvveti DEĞİL — yani hiçbir
 * tamsayı üs bu üçlüyü doğrulamıyor. Örnek gerçek bir cihaz okuması değil,
 * düzyazı illüstrasyonudur ve FIXTURE OLARAK KULLANILMADI (1-Wire'ın CRC
 * tutmayan ROM ID örneğiyle aynı karar). Kalıcı test `pmbus.test.ts` içinde.
 * Buna karşılık özetin STATUS_WORD örneği (0x0840) tutarlıdır ve örnek
 * çerçeve olarak KULLANILDI: alt bayt 0x40 → OFF, üst bayt 0x08 → PG_STATUS#.
 *
 * ── KAPSAM DIŞI ─────────────────────────────────────────────────────────────
 * - **Cihaz-başına komut haritası** (`definitions:['vendor-map']`): hangi
 *   komutun hangi formatta döndüğü üreticiye aittir (§7.1). `pmbusCommands.ts`
 *   yalnız VARSAYILAN formatı taşır.
 * - **VID ve IEEE-754 Half Precision mod çözümü**: VOUT_MODE bunları AYIRT
 *   eder (mod adı gösterilir) ama veri baytları çözülmez — VID kod tabloları
 *   (Table 3) üreticiye özel, IEEE-half için `calculators`ta zaten ayrı bir
 *   araç var (`ieee754-float16`).
 * - **PAGE/OPERATION/ON_OFF_CONFIG bit alanları**: spec özeti yalnız adlarını
 *   sayıyor, bit anlamlarını vermiyor — `format:'raw'` olarak bırakıldı.
 */

import {
  decodeDirect,
  decodeLinear11,
  decodeLinear11Parts,
  decodeVoutMode,
  parseDirectCoefficients,
  type DirectCoefficients,
} from '@/protocol-core/timing/pmbus';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  computeSmbusPec,
  formatAddress,
  formatHexByte,
  splitSmbusTransaction,
  type SmbusStructure,
} from './smbusCore';
import {
  decodeStatusBits,
  findPmbusCommand,
  STATUS_BYTE_BITS,
  STATUS_WORD_HIGH_BITS,
  type PmbusCommand,
} from './pmbusCommands';

const PROTOCOL_ID = 'pmbus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PMBus';

const MIN_FRAME_LENGTH = 2;
const WORD_BYTE_COUNT = 2;
const COEFFICIENT_BYTE_COUNT = 5;

const ERROR_TOO_SHORT = 'protocol.pmbus.error.tooShort';
const ERROR_ABORTED = 'protocol.pmbus.error.aborted';
const WARNING_UNKNOWN_COMMAND = 'protocol.pmbus.warning.unknownCommand';
const WARNING_VOUT_MODE_REQUIRED = 'protocol.pmbus.warning.voutModeRequired';
const WARNING_FAULT_SET = 'protocol.pmbus.warning.faultSet';
const WARNING_PEC_INFERRED = 'protocol.pmbus.warning.pecInferred';

/** Düşük bayt önce (§7.6). */
function readWordLowFirst(bytes: Uint8Array): number {
  return (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8);
}

function formatHexWord(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Ondalık gösterimi 6 anlamlı basamakla sınırlar — 12.000000000000002 basmaz. */
function formatNumber(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

export type PmbusFrameMetadata = {
  address7bit: number;
  transactionKind: string;
  commandCode?: string;
  commandName?: string;
  dataFormat?: string;
  physicalValue?: string;
  statusBits?: readonly string[];
  pecPresent: boolean;
};

interface PmbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

interface DataInterpretation {
  fields: ParsedField[];
  warnings: ProtocolWarning[];
  physicalValue?: string;
  statusBits?: string[];
}

/** Linear11: `X = Y × 2^N` (§7.3). Alan metni bit görünümünü de taşır. */
function interpretLinear11(
  bytes: Uint8Array,
  offset: number,
  command: PmbusCommand,
): DataInterpretation {
  const word = readWordLowFirst(bytes);
  const { mantissa, exponent } = decodeLinear11Parts(word);
  const value = decodeLinear11(word);
  const unit = command.unit === undefined ? '' : ` ${command.unit}`;
  const physicalValue = `${formatNumber(value)}${unit}`;

  return {
    fields: [
      {
        id: 'data',
        name: `${command.name} · Linear11`,
        offset,
        length: bytes.length,
        rawBytes: bytes,
        rawValue: word,
        // Spec özetinin istediği bit görünümü: exponent | mantissa ayrımı.
        physicalValue: `${physicalValue} · ${formatHexWord(word)} · N=${exponent}, Y=${mantissa}`,
        ...(command.unit === undefined ? {} : { unit: command.unit }),
        valid: true,
        warnings: [],
      },
    ],
    warnings: [],
    physicalValue,
  };
}

/** ULINEAR16: mantissa çerçevede, üs VOUT_MODE'da — üs uydurulmaz. */
function interpretUlinear16(
  bytes: Uint8Array,
  offset: number,
  command: PmbusCommand,
): DataInterpretation {
  const mantissa = readWordLowFirst(bytes);

  return {
    fields: [
      {
        id: 'data',
        name: `${command.name} · ULINEAR16`,
        offset,
        length: bytes.length,
        rawBytes: bytes,
        rawValue: mantissa,
        physicalValue: `${formatHexWord(mantissa)} · mantissa ${mantissa}`,
        valid: true,
        warnings: [],
      },
    ],
    warnings: [
      { code: 'vout-mode-required', message: WARNING_VOUT_MODE_REQUIRED, offset, length: bytes.length },
    ],
  };
}

function interpretVoutMode(bytes: Uint8Array, offset: number): DataInterpretation {
  const parts = decodeVoutMode(bytes[0] ?? 0);
  const exponentText = parts.exponent === undefined ? '' : ` · exponent ${parts.exponent}`;
  const relativeText = parts.relative ? 'Relative' : 'Absolute';
  const physicalValue = `${parts.mode.toUpperCase()} · ${relativeText}${exponentText}`;

  return {
    fields: [
      {
        id: 'data',
        name: 'VOUT_MODE',
        offset,
        length: 1,
        rawBytes: bytes.slice(0, 1),
        rawValue: bytes[0] ?? 0,
        physicalValue,
        valid: true,
        warnings: [],
      },
    ],
    warnings: [],
    physicalValue,
  };
}

function interpretStatus(
  bytes: Uint8Array,
  offset: number,
  command: PmbusCommand,
): DataInterpretation {
  const isWord = command.format === 'status-word';
  const low = bytes[0] ?? 0;
  const fields: ParsedField[] = [];
  const lowBits = decodeStatusBits(low, STATUS_BYTE_BITS);

  fields.push({
    id: 'statusLow',
    name: isWord ? 'STATUS_WORD · Low (= STATUS_BYTE)' : 'STATUS_BYTE',
    offset,
    length: 1,
    rawBytes: bytes.slice(0, 1),
    rawValue: low,
    physicalValue: lowBits.length > 0 ? lowBits.join(' · ') : 'no fault',
    valid: true,
    warnings: [],
  });

  const allBits = [...lowBits];
  if (isWord) {
    const high = bytes[1] ?? 0;
    const highBits = decodeStatusBits(high, STATUS_WORD_HIGH_BITS);
    allBits.unshift(...highBits);
    fields.push({
      id: 'statusHigh',
      name: 'STATUS_WORD · High',
      offset: offset + 1,
      length: 1,
      rawBytes: bytes.slice(1, 2),
      rawValue: high,
      physicalValue: highBits.length > 0 ? highBits.join(' · ') : 'no fault',
      valid: true,
      warnings: [],
    });
  }

  return {
    fields,
    warnings:
      allBits.length > 0
        ? [{ code: 'fault-set', message: WARNING_FAULT_SET, offset, length: bytes.length }]
        : [],
    physicalValue: allBits.length > 0 ? allBits.join(' · ') : 'no fault',
    statusBits: allBits,
  };
}

/** COEFFICIENTS (30h) okuma yanıtı: m alt, m üst, b alt, b üst, R (§14.1). */
function interpretCoefficients(bytes: Uint8Array, offset: number): DataInterpretation {
  let coefficients: DirectCoefficients | undefined;
  try {
    coefficients = parseDirectCoefficients(bytes.slice(0, COEFFICIENT_BYTE_COUNT));
  } catch {
    coefficients = undefined;
  }

  const physicalValue =
    coefficients === undefined
      ? undefined
      : `m=${coefficients.m}, b=${coefficients.b}, R=${coefficients.r}`;

  return {
    fields: [
      {
        id: 'data',
        name: 'COEFFICIENTS · m, b, R',
        offset,
        length: bytes.length,
        rawBytes: bytes,
        ...(physicalValue === undefined ? {} : { physicalValue }),
        valid: coefficients !== undefined,
        warnings: [],
      },
    ],
    warnings: [],
    ...(physicalValue === undefined ? {} : { physicalValue }),
  };
}

function interpretRaw(bytes: Uint8Array, offset: number, name: string): DataInterpretation {
  return {
    fields: [
      {
        id: 'data',
        name,
        offset,
        length: bytes.length,
        rawBytes: bytes,
        unit: 'B',
        valid: true,
        warnings: [],
      },
    ],
    warnings: [],
  };
}

/**
 * Komutun VARSAYILAN formatına göre veri baytlarını yorumlar. Bayt sayısı
 * beklenenle uyuşmuyorsa (kısmi yakalama, farklı cihaz haritası) ham gösterime
 * düşülür — kısa diziyi zorla çözüp uydurma değer üretmez.
 */
function interpretData(
  bytes: Uint8Array,
  offset: number,
  command: PmbusCommand | undefined,
): DataInterpretation {
  if (bytes.length === 0) return { fields: [], warnings: [] };
  if (command === undefined) return interpretRaw(bytes, offset, 'Data');

  switch (command.format) {
    case 'linear11':
      return bytes.length === WORD_BYTE_COUNT
        ? interpretLinear11(bytes, offset, command)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'ulinear16':
      return bytes.length === WORD_BYTE_COUNT
        ? interpretUlinear16(bytes, offset, command)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'vout-mode':
      return bytes.length === 1
        ? interpretVoutMode(bytes, offset)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'status-byte':
      return bytes.length === 1
        ? interpretStatus(bytes, offset, command)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'status-word':
      return bytes.length === WORD_BYTE_COUNT
        ? interpretStatus(bytes, offset, command)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'coefficients':
      return bytes.length === COEFFICIENT_BYTE_COUNT
        ? interpretCoefficients(bytes, offset)
        : interpretRaw(bytes, offset, `${command.name} · Data`);
    case 'raw':
      return interpretRaw(bytes, offset, `${command.name} · Data`);
  }
}

/**
 * Blok yanıtlarının başındaki byte-count'u ayırır. COEFFICIENTS gibi Block
 * Write-Block Read Process Call komutlarında okuma tarafı `[count, …veri]`
 * gelir; sayaç veri DEĞİLDİR ve formata sokulmaz.
 */
function stripBlockCount(structure: SmbusStructure, payload: Uint8Array): {
  count?: number;
  data: Uint8Array;
} {
  const isBlock = structure.kind === 'block-read' || structure.kind === 'block-write-block-read';
  if (!isBlock || payload.length === 0) return { data: payload };
  return { count: payload[0] ?? 0, data: payload.slice(1) };
}

function parsePmbusFrame(data: Uint8Array, options: PmbusParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  // PMBus'ta komut kodu ZORUNLU — en az adres + komut baytı gerekir
  // (Quick Command PMBus komut kümesinde yok, SMBus sayfasının işi).
  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const structure = splitSmbusTransaction(data);
  const command =
    structure.commandCode === undefined ? undefined : findPmbusCommand(structure.commandCode);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];

  fields.push({
    id: 'address',
    name: 'Address',
    offset: 0,
    length: 1,
    rawBytes: structure.body.slice(0, 1),
    rawValue: structure.addressByte,
    physicalValue: formatAddress(structure.addressByte),
    valid: true,
    warnings: [],
  });

  if (structure.commandCode !== undefined) {
    fields.push({
      id: 'command',
      name: 'Command Code',
      offset: 1,
      length: 1,
      rawBytes: structure.body.slice(1, 2),
      rawValue: structure.commandCode,
      physicalValue:
        command === undefined
          ? formatHexByte(structure.commandCode)
          : `${command.name} (${formatHexByte(structure.commandCode)})`,
      valid: true,
      warnings: [],
    });
    if (command === undefined) {
      warnings.push({
        code: 'unknown-command',
        message: WARNING_UNKNOWN_COMMAND,
        offset: 1,
        length: 1,
      });
    }
  }

  // Yön dönmüşse veri okuma tarafındadır; dönmemişse yazma tarafında.
  const payloadOffset =
    structure.repeatedStartOffset === undefined ? 2 : structure.repeatedStartOffset + 1;
  const payload =
    structure.repeatedStartOffset === undefined ? structure.writeData : structure.readData;

  if (structure.repeatedStartOffset !== undefined) {
    const offset = structure.repeatedStartOffset;
    fields.push({
      id: 'repeatedAddress',
      name: 'Repeated START · Address',
      offset,
      length: 1,
      rawBytes: structure.body.slice(offset, offset + 1),
      rawValue: structure.body[offset] ?? 0,
      physicalValue: formatAddress(structure.body[offset] ?? 0),
      valid: true,
      warnings: [],
    });
    // Block Write-Block Read'de yazma tarafındaki baytlar da gösterilmeli.
    if (structure.writeData.length > 0) {
      fields.push({
        id: 'writeData',
        name: 'Write Data',
        offset: 2,
        length: structure.writeData.length,
        rawBytes: structure.writeData,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  }

  const { count, data: payloadData } = stripBlockCount(structure, payload);
  if (count !== undefined) {
    fields.push({
      id: 'blockCount',
      name: 'Byte Count',
      offset: payloadOffset,
      length: 1,
      rawBytes: Uint8Array.from([count]),
      rawValue: count,
      physicalValue: `${count} B`,
      valid: true,
      warnings: [],
    });
  }

  const interpretation = interpretData(
    payloadData,
    payloadOffset + (count === undefined ? 0 : 1),
    command,
  );
  fields.push(...interpretation.fields);
  warnings.push(...interpretation.warnings);

  if (structure.pec.present) {
    fields.push({
      id: 'pec',
      name: 'PEC',
      offset: structure.body.length,
      length: 1,
      rawBytes: Uint8Array.from([structure.pec.received ?? 0]),
      rawValue: structure.pec.received ?? 0,
      physicalValue: `PASS · ${formatHexByte(structure.pec.calculated)} · ${structure.pec.coverageBytes} B`,
      valid: true,
      warnings: [],
    });
    warnings.push({
      code: 'pec-inferred',
      message: WARNING_PEC_INFERRED,
      offset: structure.body.length,
      length: 1,
    });
  }

  const metadata: PmbusFrameMetadata = {
    address7bit: structure.address7bit,
    transactionKind: structure.kind,
    ...(structure.commandCode === undefined
      ? {}
      : { commandCode: formatHexByte(structure.commandCode) }),
    ...(command === undefined ? {} : { commandName: command.name, dataFormat: command.format }),
    ...(interpretation.physicalValue === undefined
      ? {}
      : { physicalValue: interpretation.physicalValue }),
    ...(interpretation.statusBits === undefined ? {} : { statusBits: interpretation.statusBits }),
    pecPresent: structure.pec.present,
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
    // Alanlar üretim sırasına göre değil OFSET sırasına göre listelenir: Block
    // Write-Block Read'de yazma tarafı (ofset 2) repeated START'tan (ofset 5)
    // SONRA üretiliyor ve tablo ofsetleri 0,1,5,2,… diye basıyordu. Tarayıcı
    // turunda görüldü — hiçbir birim test alan SIRASINI sınamıyordu.
    fields: [...fields].sort((left, right) => left.offset - right.offset),
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parsePmbus(data: Uint8Array): ParseResult {
  return parsePmbusFrame(data, {});
}

/**
 * DIRECT formatlı bir okumanın fiziksel karşılığı. Çerçevede katsayı
 * TAŞINMADIĞI için parser bunu kendiliğinden yapamaz (COEFFICIENTS ayrı bir
 * transaction'dır) — katsayıları elinde olan çağıran/araç kullanır.
 */
export function decodeDirectReading(
  bytes: Uint8Array,
  coefficients: DirectCoefficients,
): number {
  return decodeDirect(readWordLowFirst(bytes), coefficients);
}

export const pmbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Adres + komut baytı asgarisi; PMBus'ın bayt seviyesinde başka imzası yok. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: PmbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parsePmbusFrame(data, options);
  },
};

const ADDR_W = 0xb4;
const ADDR_R = 0xb5;

function withPec(body: number[]): Uint8Array {
  return Uint8Array.from([...body, computeSmbusPec(Uint8Array.from(body))]);
}

/**
 * Örnek çerçeveler. Adres 0x5A (bayt 0xB4/0xB5) TEMSİLÎDİR — spec ne PMBus ne
 * SMBus bölümünde somut bir cihaz adresi vermiyor. Komut kodları Table 31'den,
 * STATUS_WORD değeri (0x0840) spec ÖZETİNİN kendi örneğinden, PEC baytları
 * `computeSmbusPec` ile hesaplanmıştır (uydurulmuş sağlama yok).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-vin',
    name: 'protocol.pmbus.example.readVin.name',
    // READ_VIN (88h) Read Word: Linear11 word 0xD300 → N=-6, Y=768 → 12 V.
    // Düşük bayt önce: 0x00, 0xD3.
    bytes: withPec([ADDR_W, 0x88, ADDR_R, 0x00, 0xd3]),
    description: 'protocol.pmbus.example.readVin.description',
    expectedValid: true,
  },
  {
    id: 'status-word',
    name: 'protocol.pmbus.example.statusWord.name',
    // STATUS_WORD (79h) = 0x0840 (spec özetinin KENDİ örneği): alt 0x40 → OFF,
    // üst 0x08 → PG_STATUS#. Düşük bayt önce: 0x40, 0x08.
    bytes: withPec([ADDR_W, 0x79, ADDR_R, 0x40, 0x08]),
    description: 'protocol.pmbus.example.statusWord.description',
    expectedValid: true,
  },
  {
    id: 'vout-mode',
    name: 'protocol.pmbus.example.voutMode.name',
    // VOUT_MODE (20h) Read Byte = 0x17 → mod bitleri 00b (ULINEAR16),
    // parametre 10111b = -9 (exponent).
    bytes: Uint8Array.from([ADDR_W, 0x20, ADDR_R, 0x17]),
    description: 'protocol.pmbus.example.voutMode.description',
    expectedValid: true,
  },
  {
    id: 'coefficients',
    name: 'protocol.pmbus.example.coefficients.name',
    // COEFFICIENTS (30h) Block Write-Block Read Process Call: yazma tarafı
    // [count=2, komut 8Bh, 01h(READ)], okuma tarafı [count=5, m=1, b=-100, R=3].
    bytes: withPec([ADDR_W, 0x30, 0x02, 0x8b, 0x01, ADDR_R, 0x05, 0x01, 0x00, 0x9c, 0xff, 0x03]),
    description: 'protocol.pmbus.example.coefficients.description',
    expectedValid: true,
  },
];

export const pmbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: pmbusParser,
  documentation: {
    summary: 'protocol.pmbus.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
