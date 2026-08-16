/**
 * M-Bus (EN 13757, kablolu Meter-Bus) — utility metering (ısı/su/gaz/elektrik)
 * seri hat protokolü. Girdi HAM bir M-Bus telgrafıdır: dört çerçeve sınıfından
 * biri (Single Character/Short/Control/Long), ilk bayta göre dallanır
 * (canClassic.ts'in magic-byte dallanması emsali — TEK parser, dört çerçeve
 * şekli).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * EN 13757'nin resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki çerçeve
 * sınıfları, C/A/CI alan düzenleri ve checksum kapsamı İKİ bağımsız kamuya
 * açık ikincil kaynaktan ÇAPRAZ TEYİTLE alındı (DIF/VIF/Fixed-Header
 * kaynakları için `mbusVariableData.ts` dosya başına bakınız — tekrar
 * edilmedi):
 *   1. **libmbus** (rSCADA/Robert Johansson, GPLv2 — yalnız `mbus-protocol.h`nin
 *      alenen yayımlanan sabitleri referans alındı, KOD KOPYALANMADI):
 *      https://github.com/rscada/libmbus/blob/master/mbus/mbus-protocol.h
 *      (`MBUS_FRAME_ACK_START=0xE5`, `MBUS_FRAME_SHORT_START=0x10`,
 *      `MBUS_FRAME_CONTROL_START`/`MBUS_FRAME_LONG_START=0x68`,
 *      `MBUS_FRAME_STOP=0x16`; `MBUS_CONTROL_MASK_SND_NKE=0x40`,
 *      `_SND_UD=0x53`, `_REQ_UD2=0x5B`, `_RSP_UD=0x08`; `MBUS_CONTROL_MASK_FCB
 *      =0x20`, `_FCV=0x10`; `MBUS_ADDRESS_NETWORK_LAYER=0xFD`,
 *      `_BROADCAST_REPLY=0xFE`, `_BROADCAST_NOREPLY=0xFF`;
 *      `MBUS_CONTROL_INFO_*` — CI tablosu).
 *   2. **m-bus.com "The M-Bus: A Documentation"** (orijinal, kamuya açık M-Bus
 *      dokümantasyonu):
 *      https://m-bus.com/documentation-wired/05-data-link-layer
 *      https://m-bus.com/documentation-wired/06-application-layer
 *      (Fig. 13 dört çerçeve sınıfı tablosu; Fig. 14 C Field bit yerleşimi;
 *      "Check Sum … arithmetical sum … without taking carry digits into
 *      account" — `sum8Checksum` budur; adres 0/253/254/255 anlamları,
 *      5.3 ve 5.5 bölümleri; CI-Field tablo 4).
 *   Wireshark'ın M-Bus dissector'ı ARANDI, epan/dissectors/ dizininde
 *   mbus/wmbus içeren dosya YOK (GitHub API, 2026-08-16) — üçüncü kaynak
 *   olarak kullanılamadı.
 * İki kaynağın da aynı sabiti aynı adla verdiği alanlar adlandırıldı (çerçeve
 * start/stop baytları, C field fonksiyon kodları SND_NKE/SND_UD/REQ_UD2/
 * RSP_UD, CI field tablosu, A field'ın 0/253/254/255 özel değerleri).
 * Teyit edilemeyen alan HAM bırakıldı.
 *
 * ── ÇERÇEVE SINIFLARI VE CHECKSUM KAPSAMI ────────────────────────────────────
 * - Single Character (`0xE5`, 1 bayt): tek başına ACK, alan yok.
 * - Short Frame (`0x10` start): Start+C+A+Checksum+Stop, sabit 5 bayt.
 *   Checksum = `sum8Checksum([C, A])` (start/stop HARİÇ).
 * - Control Frame (`0x68` start, L=3): Start+L+L+Start+C+A+CI+Checksum+Stop,
 *   sabit 9 bayt. İki L kopyası AYNI olmalı.
 * - Long Frame (`0x68` start, L>3): Control Frame + CI'den sonra `L-3` baytlık
 *   user data. Checksum = `sum8Checksum([C, A, CI, ...UserData])` — yani
 *   `data.slice(4, 4+L)`, tam `L` bayt (start/L/L/start/stop HARİÇ).
 * L alanı KENDİSİNİ, iki start baytını, checksum'u ve stop baytını SAYMAZ —
 * yalnız C+A+CI+UserData'yı sayar (dosya başı, brief tuzağı).
 *
 * ── DEĞİŞKEN VERİ YAPISI (CI=0x72) ───────────────────────────────────────────
 * Long Frame'de CI=0x72 (Variable Data Respond, Mode 1) ise user data
 * `mbusVariableData.ts`teki `decodeVariableData`ya devredilir (Fixed Data
 * Header + DIF/DIFE/VIF/VIFE/DATA zinciri). Diğer tüm CI değerleri (adlı ya da
 * ADLANDIRILMAMIŞ) için user data HAM gösterilir — Fixed Data Structure
 * (CI=0x73/0x77) dahil, bu dalganın kapsamı yalnız 0x72 yoludur (brief madde 9).
 *
 * ── ŞİFRELİ İÇERİK (Karar 8) ─────────────────────────────────────────────────
 * Bu motor KABLOLU M-Bus'tır; wireless M-Bus'taki gibi payload şifrelemesi
 * genelde YOKTUR. Yine de Status baytı ya da üretici-özel blok şifreli/
 * tanınmayan bir yapı taşıyorsa bu motor HİÇBİR ŞEKİLDE çözmeye çalışmaz —
 * zaten "Manufacturer Specific Data" bloğu her zaman ham + uyarı olarak kalır.
 */

import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';
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

import { decodeVariableData } from './mbusVariableData';

const PROTOCOL_ID = 'm-bus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'M-Bus';

const HEX_RADIX = 16;

const SINGLE_CHARACTER_ACK = 0xe5;
const SHORT_FRAME_START = 0x10;
const LONG_FRAME_START = 0x68; // Control ve Long frame AYNI start baytını paylaşır — L alanına göre ayrılır.
const FRAME_STOP = 0x16;

const SHORT_FRAME_LENGTH = 5;
/** Start(1)+L(1)+L(1)+Start(1) — L'nin kendisi okunmadan önce asgari okunabilir bölüm. */
const LONG_FRAME_HEADER_MIN = 4;
/** Control Frame'in user-data'sız L değeri (C+A+CI = 3 bayt) — L=3 Control, L>3 Long ayrımı. */
const CONTROL_FRAME_USER_DATA_LENGTH = 3;

const CI_VARIABLE_DATA_MODE1 = 0x72;

const ERROR_EMPTY_FRAME = 'protocol.mbus.error.emptyFrame';
const ERROR_UNRECOGNIZED_FRAME_CLASS = 'protocol.mbus.error.unrecognizedFrameClass';
const ERROR_FRAME_TOO_LONG = 'protocol.mbus.error.frameTooLong';
const ERROR_ABORTED = 'protocol.mbus.error.aborted';
const ERROR_SHORT_FRAME_TRUNCATED = 'protocol.mbus.error.shortFrameTruncated';
const ERROR_LONG_FRAME_HEADER_TRUNCATED = 'protocol.mbus.error.longFrameHeaderTruncated';
const ERROR_LENGTH_COPIES_MISMATCH = 'protocol.mbus.error.lengthCopiesMismatch';
const ERROR_SECOND_START_INVALID = 'protocol.mbus.error.secondStartInvalid';
const ERROR_STOP_BYTE_INVALID = 'protocol.mbus.error.stopByteInvalid';
const ERROR_CHECKSUM_MISMATCH = 'protocol.mbus.error.checksumMismatch';
const ERROR_BODY_TRUNCATED = 'protocol.mbus.error.bodyTruncated';

const WARN_UNKNOWN_C_FUNCTION = 'protocol.mbus.warning.unknownCFunction';
const WARN_UNKNOWN_CI = 'protocol.mbus.warning.unknownCi';
const WARN_CI_DATA_NOT_DECODED = 'protocol.mbus.warning.ciDataNotDecoded';
const WARN_TRAILING_BYTES = 'protocol.mbus.warning.trailingBytes';

const SUMMARY_SINGLE_CHARACTER = 'protocol.mbus.summary.singleCharacter';
const SUMMARY_SHORT_FRAME = 'protocol.mbus.summary.shortFrame';
const SUMMARY_CONTROL_FRAME = 'protocol.mbus.summary.controlFrame';
const SUMMARY_LONG_FRAME = 'protocol.mbus.summary.longFrame';

type FrameClass = 'single-character' | 'short-frame' | 'control-frame' | 'long-frame';

/**
 * C Field fonksiyon kodları (F3-F0 nibble'ı, bit3-0) — DIR bitine (bit6) göre
 * İKİ AYRI küme (m-bus.com Fig. 14 "Calling Direction"/"Reply Direction"
 * satırları, DNP3'ün PRM'ye göre link fonksiyon ayrımıyla aynı desen).
 */
const C_FIELD_CALLING_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0, 'SND_NKE'],
  [0x3, 'SND_UD'],
  [0xb, 'REQ_UD2'],
]);

const C_FIELD_REPLY_NAMES: ReadonlyMap<number, string> = new Map([[0x8, 'RSP_UD']]);

/** CI Field — dar küme, iki kaynakta da çakışmadan aynı adı taşıyan kodlar (dosya başı notu). */
const CI_FIELD_NAMES: ReadonlyMap<number, string> = new Map([
  [0x50, 'Application Reset'],
  [0x51, 'Data Send (Mode 1)'],
  [0x52, 'Selection of Slaves (Mode 1)'],
  [0x54, 'Synchronize Action'],
  [0x55, 'Data Send (Mode 2)'],
  [0x56, 'Selection of Slaves (Mode 2)'],
  [0x70, 'Report of General Application Errors'],
  [0x71, 'Report of Alarm Status'],
  [CI_VARIABLE_DATA_MODE1, 'Variable Data Respond (Mode 1)'],
  [0x73, 'Fixed Data Respond (Mode 1)'],
  [0x76, 'Variable Data Respond (Mode 2)'],
  [0x77, 'Fixed Data Respond (Mode 2)'],
]);

/** A Field'ın özel değerleri — dar küme, iki kaynakta da AYNI anlam (dosya başı notu). Diğer tüm adresler sıradan sayısal adrestir, ADLANDIRILMAZ. */
const ADDRESS_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Unconfigured (Factory Default)'],
  [0xfd, 'Network Layer Addressing'],
  [0xfe, 'Test Address (Broadcast, Replies)'],
  [0xff, 'Broadcast (No Reply)'],
]);

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
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

interface CFieldDecodeResult {
  readonly isCalling: boolean;
  readonly functionCode: number;
  readonly functionName: string | undefined;
}

/**
 * C Field'ı bit bit çözer (DIR + FCB/ACD + FCV/DFC + fonksiyon nibble'ı) —
 * Short/Control/Long frame'in ÜÇÜ de aynı C Field yapısını taşır, tek yerde.
 */
function decodeCField(
  rawBytes: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): CFieldDecodeResult {
  const byte = byteAt(rawBytes, 0);
  const isCalling = (byte & 0x40) !== 0;
  const bit5 = (byte & 0x20) !== 0;
  const bit4 = (byte & 0x10) !== 0;
  const functionCode = byte & 0x0f;

  pushBitField(fields, 'c-field-dir', 'DIR', offset, rawBytes, isCalling ? 1 : 0);
  pushBitField(fields, 'c-field-bit5', isCalling ? 'FCB' : 'ACD', offset, rawBytes, bit5 ? 1 : 0);
  pushBitField(fields, 'c-field-bit4', isCalling ? 'FCV' : 'DFC', offset, rawBytes, bit4 ? 1 : 0);

  const functionNames = isCalling ? C_FIELD_CALLING_NAMES : C_FIELD_REPLY_NAMES;
  const functionName = functionNames.get(functionCode);
  const functionField: ParsedField = {
    id: 'c-field-function',
    name: 'Function Code',
    offset,
    length: 1,
    rawBytes,
    rawValue: functionCode,
    valid: functionName !== undefined,
    warnings: [],
  };
  if (functionName !== undefined) {
    functionField.physicalValue = functionName;
  } else {
    functionField.warnings.push(WARN_UNKNOWN_C_FUNCTION);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_C_FUNCTION));
  }
  fields.push(functionField);

  return { isCalling, functionCode, functionName };
}

function decodeAField(rawBytes: Uint8Array, offset: number, fields: ParsedField[]): number {
  const address = byteAt(rawBytes, 0);
  const addressField: ParsedField = {
    id: 'a-field',
    name: 'Address',
    offset,
    length: 1,
    rawBytes,
    rawValue: address,
    valid: true,
    warnings: [],
  };
  const addressName = ADDRESS_NAMES.get(address);
  if (addressName !== undefined) addressField.physicalValue = addressName;
  fields.push(addressField);
  return address;
}

interface CiFieldDecodeResult {
  readonly ciByte: number;
  readonly ciName: string | undefined;
}

function decodeCiField(
  rawBytes: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): CiFieldDecodeResult {
  const ciByte = byteAt(rawBytes, 0);
  const ciName = CI_FIELD_NAMES.get(ciByte);
  const ciField: ParsedField = {
    id: 'ci-field',
    name: 'CI Field',
    offset,
    length: 1,
    rawBytes,
    rawValue: formatHexByte(ciByte),
    valid: ciName !== undefined,
    warnings: [],
  };
  if (ciName !== undefined) {
    ciField.physicalValue = ciName;
  } else {
    ciField.warnings.push(WARN_UNKNOWN_CI);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CI));
  }
  fields.push(ciField);
  return { ciByte, ciName };
}

interface MbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

export type MbusFrameMetadata = {
  frameClass: FrameClass;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function detectFrameClass(data: Uint8Array): FrameClass | undefined {
  const first = byteAt(data, 0);
  // Uzunluk 1'den fazlaysa dahi ACK olarak tanınır — fazlası `parseSingleCharacter`de
  // "Trailing Data" olarak işaretlenir (dnp3.ts'nin trailing-bytes deseniyle aynı).
  if (first === SINGLE_CHARACTER_ACK) return 'single-character';
  if (first === SHORT_FRAME_START) return 'short-frame';
  if (first === LONG_FRAME_START) {
    // L henüz okunmadıysa Control/Long ayrımı belli değil — çağıran L'yi okuyup karar verir.
    return 'long-frame';
  }
  return undefined;
}

function parseSingleCharacter(data: Uint8Array, options: MbusParseOptions): ParseResult {
  const fields: ParsedField[] = [
    {
      id: 'ack',
      name: 'Acknowledgement',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: formatHexByte(SINGLE_CHARACTER_ACK),
      physicalValue: 'ACK',
      valid: true,
      warnings: [],
    },
  ];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  if (data.length > 1) {
    const trailing = data.slice(1);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: 1,
      length: trailing.length,
      rawBytes: trailing,
      unit: 'B',
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  const metadata: MbusFrameMetadata = {
    frameClass: 'single-character',
    summaryKey: SUMMARY_SINGLE_CHARACTER,
    summaryParams: {},
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: data.length };
}

function parseShortFrame(data: Uint8Array, options: MbusParseOptions): ParseResult {
  if (data.length < SHORT_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_SHORT_FRAME_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: SHORT_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'start-byte',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: formatHexByte(SHORT_FRAME_START),
    valid: true,
    warnings: [],
  });

  const cResult = decodeCField(data.slice(1, 2), 1, fields, warnings);
  const address = decodeAField(data.slice(2, 3), 2, fields);

  const checksumCovered = data.slice(1, 3); // C + A
  const checksumCalculated = sum8Checksum(checksumCovered);
  const checksumReceived = byteAt(data, 3);
  const checksumValid = checksumReceived === checksumCalculated;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: 3,
    length: 1,
    rawBytes: data.slice(3, 4),
    rawValue: checksumReceived,
    physicalValue: checksumCalculated,
    valid: checksumValid,
    warnings: checksumValid ? [] : [ERROR_CHECKSUM_MISMATCH],
  });
  if (!checksumValid) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: 3,
      length: 1,
      details: { received: checksumReceived, calculated: checksumCalculated },
    });
  }

  const stopByte = byteAt(data, 4);
  const stopValid = stopByte === FRAME_STOP;
  fields.push({
    id: 'stop-byte',
    name: 'Stop Byte',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: formatHexByte(stopByte),
    valid: stopValid,
    warnings: stopValid ? [] : [ERROR_STOP_BYTE_INVALID],
  });
  if (!stopValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_STOP_BYTE_INVALID,
      offset: 4,
      length: 1,
      details: { received: stopByte, expected: FRAME_STOP },
    });
  }

  if (data.length > SHORT_FRAME_LENGTH) {
    const trailing = data.slice(SHORT_FRAME_LENGTH);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: SHORT_FRAME_LENGTH,
      length: trailing.length,
      rawBytes: trailing,
      unit: 'B',
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  const metadata: MbusFrameMetadata = {
    frameClass: 'short-frame',
    summaryKey: SUMMARY_SHORT_FRAME,
    summaryParams: {
      function: cResult.functionName ?? formatHexByte(cResult.functionCode),
      address: String(address),
    },
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: data.length };
}

function parseControlOrLongFrame(data: Uint8Array, options: MbusParseOptions): ParseResult {
  if (data.length < LONG_FRAME_HEADER_MIN) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_LONG_FRAME_HEADER_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: LONG_FRAME_HEADER_MIN },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'start-byte-1',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: formatHexByte(LONG_FRAME_START),
    valid: true,
    warnings: [],
  });

  const length1 = byteAt(data, 1);
  const length2 = byteAt(data, 2);
  const lengthsMatch = length1 === length2;
  fields.push({
    id: 'length-1',
    name: 'Length (1st copy)',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: length1,
    unit: 'B',
    valid: lengthsMatch,
    warnings: lengthsMatch ? [] : [ERROR_LENGTH_COPIES_MISMATCH],
  });
  fields.push({
    id: 'length-2',
    name: 'Length (2nd copy)',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: length2,
    unit: 'B',
    valid: lengthsMatch,
    warnings: lengthsMatch ? [] : [ERROR_LENGTH_COPIES_MISMATCH],
  });
  if (!lengthsMatch) {
    // Hangi L kullanılacak belirsiz: 1. kopya baz alınır ama hata basılır —
    // DNP3'ün "bozuk blok CRC'sinde de yürüyüşe devam et" dürüstlüğüyle aynı çizgi.
    errors.push({
      code: 'length-mismatch',
      message: ERROR_LENGTH_COPIES_MISMATCH,
      offset: 1,
      length: 2,
      details: { firstCopy: length1, secondCopy: length2 },
    });
  }
  const length = length1;

  const secondStart = byteAt(data, 3);
  const secondStartValid = secondStart === LONG_FRAME_START;
  fields.push({
    id: 'start-byte-2',
    name: 'Start Byte (2nd)',
    offset: 3,
    length: 1,
    rawBytes: data.slice(3, 4),
    rawValue: formatHexByte(secondStart),
    valid: secondStartValid,
    warnings: secondStartValid ? [] : [ERROR_SECOND_START_INVALID],
  });
  if (!secondStartValid) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_SECOND_START_INVALID,
      offset: 3,
      length: 1,
    });
  }

  const isControlFrame = length === CONTROL_FRAME_USER_DATA_LENGTH;
  const totalFrameLength = length + 6;

  if (options.maxFrameLength !== undefined && totalFrameLength > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: totalFrameLength - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: totalFrameLength },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const bodyAvailable = data.length >= totalFrameLength;
  if (!bodyAvailable) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BODY_TRUNCATED,
      offset: 4,
      length: data.length - 4,
      details: { declaredLength: length, expectedFrameLength: totalFrameLength, availableBytes: data.length },
    });
  }

  let cResult: CFieldDecodeResult | undefined;
  let address: number | undefined;
  let ciResult: CiFieldDecodeResult | undefined;
  let recordCount: number | undefined;

  if (data.length > 4) cResult = decodeCField(data.slice(4, 5), 4, fields, warnings);
  if (data.length > 5) address = decodeAField(data.slice(5, 6), 5, fields);
  if (data.length > 6) ciResult = decodeCiField(data.slice(6, 7), 6, fields, warnings);

  if (!isControlFrame && data.length > 7 && ciResult !== undefined) {
    const userDataEnd = Math.min(data.length, 7 + (length - CONTROL_FRAME_USER_DATA_LENGTH));
    const userData = data.slice(7, userDataEnd);
    if (ciResult.ciByte === CI_VARIABLE_DATA_MODE1) {
      const summary = decodeVariableData(userData, 7, fields, warnings, errors);
      recordCount = summary.recordCount;
    } else {
      const warnKey = ciResult.ciName !== undefined ? WARN_CI_DATA_NOT_DECODED : undefined;
      fields.push({
        id: 'user-data',
        name: 'User Data',
        offset: 7,
        length: userData.length,
        rawBytes: userData,
        unit: 'B',
        valid: true,
        warnings: warnKey === undefined ? [] : [warnKey],
      });
      if (warnKey !== undefined) warnings.push(toProtocolWarning(warnKey));
    }
  }

  if (bodyAvailable) {
    const checksumOffset = 4 + length;
    const stopOffset = checksumOffset + 1;
    const checksumCovered = data.slice(4, checksumOffset); // C + A + CI + UserData, tam `length` bayt
    const checksumCalculated = sum8Checksum(checksumCovered);
    const checksumReceived = byteAt(data, checksumOffset);
    const checksumValid = checksumReceived === checksumCalculated;
    fields.push({
      id: 'checksum',
      name: 'Checksum',
      offset: checksumOffset,
      length: 1,
      rawBytes: data.slice(checksumOffset, checksumOffset + 1),
      rawValue: checksumReceived,
      physicalValue: checksumCalculated,
      valid: checksumValid,
      warnings: checksumValid ? [] : [ERROR_CHECKSUM_MISMATCH],
    });
    if (!checksumValid) {
      errors.push({
        code: 'checksum-mismatch',
        message: ERROR_CHECKSUM_MISMATCH,
        offset: checksumOffset,
        length: 1,
        details: { received: checksumReceived, calculated: checksumCalculated },
      });
    }

    const stopByte = byteAt(data, stopOffset);
    const stopValid = stopByte === FRAME_STOP;
    fields.push({
      id: 'stop-byte',
      name: 'Stop Byte',
      offset: stopOffset,
      length: 1,
      rawBytes: data.slice(stopOffset, stopOffset + 1),
      rawValue: formatHexByte(stopByte),
      valid: stopValid,
      warnings: stopValid ? [] : [ERROR_STOP_BYTE_INVALID],
    });
    if (!stopValid) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_STOP_BYTE_INVALID,
        offset: stopOffset,
        length: 1,
        details: { received: stopByte, expected: FRAME_STOP },
      });
    }

    if (data.length > totalFrameLength) {
      const trailing = data.slice(totalFrameLength);
      fields.push({
        id: 'trailing-data',
        name: 'Trailing Data',
        offset: totalFrameLength,
        length: trailing.length,
        rawBytes: trailing,
        unit: 'B',
        valid: false,
        warnings: [WARN_TRAILING_BYTES],
      });
      warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
    }
  }

  const summaryParams: Record<string, string> = {
    function: cResult?.functionName ?? (cResult === undefined ? '' : formatHexByte(cResult.functionCode)),
    address: address === undefined ? '' : String(address),
  };
  let summaryKey: string;
  if (isControlFrame) {
    summaryKey = SUMMARY_CONTROL_FRAME;
  } else {
    summaryKey = SUMMARY_LONG_FRAME;
    if (ciResult?.ciName !== undefined) summaryParams['ci'] = ciResult.ciName;
    if (recordCount !== undefined) summaryParams['recordCount'] = String(recordCount);
  }

  const metadata: MbusFrameMetadata = {
    frameClass: isControlFrame ? 'control-frame' : 'long-frame',
    summaryKey,
    summaryParams,
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: data.length };
}

function parseMbusFrame(data: Uint8Array, options: MbusParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const frameClass = detectFrameClass(data);
  if (frameClass === undefined) {
    return {
      success: false,
      error: {
        code: 'start-delimiter-not-found',
        message: ERROR_UNRECOGNIZED_FRAME_CLASS,
        offset: 0,
        length: 1,
        details: { firstByte: byteAt(data, 0) },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (frameClass === 'single-character') return parseSingleCharacter(data, options);
  if (frameClass === 'short-frame') return parseShortFrame(data, options);
  return parseControlOrLongFrame(data, options);
}

export function parseMbus(data: Uint8Array): ParseResult {
  return parseMbusFrame(data, {});
}

export const mbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız ilk bayt kontrol edilir. Checksum burada DOĞRULANMAZ. */
  canParse(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    return detectFrameClass(data) !== undefined;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: MbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseMbusFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi, checksum'ları `sum8Checksum`ın
 * KENDİSİYLE bağımsız hesaplanıp `mbus.test.ts` içinde ayrıca doğrulanıyor
 * (DNP3/UBX emsali, dosya başı fixture uydurma yasağı notu). Volume kaydı
 * (12565 → 12.565 m³) m-bus.com'un 6.3.2'deki worked example'ıyla AYNI DIF/VIF/
 * veri baytlarını taşır (kaynağı burada anılan gerçek referans değer).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'single-character-ack',
    name: 'protocol.mbus.example.singleCharacterAck.name',
    bytes: Uint8Array.from([0xe5]),
    description: 'protocol.mbus.example.singleCharacterAck.description',
    expectedValid: true,
  },
  {
    id: 'short-frame-req-ud2',
    name: 'protocol.mbus.example.shortFrameReqUd2.name',
    // C=0x5B (calling, FCV=1, F=0xB → REQ_UD2), A=0x01, Checksum=sum8([0x5B,0x01])=0x5C.
    bytes: Uint8Array.from([0x10, 0x5b, 0x01, 0x5c, 0x16]),
    description: 'protocol.mbus.example.shortFrameReqUd2.description',
    expectedValid: true,
  },
  {
    id: 'control-frame-snd-nke',
    name: 'protocol.mbus.example.controlFrameSndNke.name',
    // L=3 (Control Frame): C=0x40 (calling, F=0 → SND_NKE), A=0x05, CI=0x00 (bu
    // senaryoda anlamsız/tanınmayan — Control Frame yapısal olarak CI taşımak
    // ZORUNDADIR, SND_NKE'nin kendisi CI semantiği taşımaz), Checksum=
    // sum8([0x40,0x05,0x00])=0x45.
    bytes: Uint8Array.from([0x68, 0x03, 0x03, 0x68, 0x40, 0x05, 0x00, 0x45, 0x16]),
    description: 'protocol.mbus.example.controlFrameSndNke.description',
    expectedValid: true,
  },
  {
    id: 'long-frame-rsp-ud-variable-data',
    name: 'protocol.mbus.example.longFrameRspUdVariableData.name',
    // C=0x08 (RSP_UD), A=0x01, CI=0x72 (variable data, mode 1). Fixed header:
    // Ident=12345678 (BCD LE), Manufacturer=KAM (0x2C2D LE), Version=0x01,
    // Medium=0x04 (Heat/Outlet), AccessNo=0x2A, Status=0x00, Signature=0x0000.
    // 3 kayıt: Energy 123456 Wh (DIF=0x04 32-bit int, VIF=0x03 exp=0),
    // Volume 12565→12.565 m³ (DIF=0x03 24-bit int, VIF=0x13 exp=-3 — m-bus.com
    // 6.3.2 worked example'ıyla AYNI baytlar: "03 13 15 31 00"), Flow
    // Temperature 235→23.5°C (DIF=0x02 16-bit int, VIF=0x5A exp=-1).
    // Checksum = sum8(C..son data baytı) — mbus.test.ts'te bağımsız doğrulanır.
    bytes: Uint8Array.from([
      0x68, 0x1e, 0x1e, 0x68, 0x08, 0x01, 0x72, 0x78, 0x56, 0x34, 0x12, 0x2d, 0x2c, 0x01, 0x04, 0x2a,
      0x00, 0x00, 0x00, 0x04, 0x03, 0x40, 0xe2, 0x01, 0x00, 0x03, 0x13, 0x15, 0x31, 0x00, 0x02, 0x5a,
      0xeb, 0x00, 0xe4, 0x16,
    ]),
    description: 'protocol.mbus.example.longFrameRspUdVariableData.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.mbus.example.checksumMismatch.name',
    // short-frame-req-ud2 ile AYNI gövde, checksum baytı kasten 0x00.
    bytes: Uint8Array.from([0x10, 0x5b, 0x01, 0x00, 0x16]),
    description: 'protocol.mbus.example.checksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'length-copies-mismatch',
    name: 'protocol.mbus.example.lengthCopiesMismatch.name',
    // control-frame-snd-nke ile AYNI gövde, ikinci L kopyası kasten 0x04.
    bytes: Uint8Array.from([0x68, 0x03, 0x04, 0x68, 0x40, 0x05, 0x00, 0x45, 0x16]),
    description: 'protocol.mbus.example.lengthCopiesMismatch.description',
    expectedValid: false,
  },
  {
    id: 'unrecognized-ci',
    name: 'protocol.mbus.example.unrecognizedCi.name',
    // C=0x08 (RSP_UD), A=0x01, CI=0x99 (dar kümede yok) + 4 baytlık ham user
    // data. Checksum=sum8([0x08,0x01,0x99,0xAA,0xBB,0xCC,0xDD])=0x... (testte doğrulanır).
    bytes: Uint8Array.from([0x68, 0x07, 0x07, 0x68, 0x08, 0x01, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xb0, 0x16]),
    description: 'protocol.mbus.example.unrecognizedCi.description',
    expectedValid: true,
  },
];

export const mbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: mbusParser,
  documentation: {
    summary: 'protocol.mbus.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'libmbus documentation (rSCADA, GPLv2 — documentation reference only)',
        url: 'https://github.com/rscada/libmbus',
      },
      {
        title: 'The M-Bus: A Documentation (m-bus.com, public wired M-Bus specification)',
        url: 'https://m-bus.com/documentation-wired/05-data-link-layer',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
