/**
 * IEC 60870-5-104 — TCP üstü telecontrol/SCADA protokolü. Girdi HAM bir APDU
 * (Application Protocol Data Unit): APCI (6 bayt sabit: start + length + 4
 * kontrol baytı) + I-format'ta ardından gelen ASDU. `doip.ts`/`modbusTcp.ts`
 * emsali: bu motor TAMPONDAKİ TEK BİR APDU'yu çözer ve `consumedBytes` ile
 * tükettiği baytı bildirir (spec brief-faz10-dalga5.md madde 5: "MBAP
 * emsalindeki tutarlılık kontrolü") — APDU Length kendi kendini tanımladığı
 * için modbusTcp'nin ADU-dilimleme felsefesi burada da doğru model: bir TCP
 * okumasında birden çok APDU olabilir, çağıran kalanla yeniden çağırır.
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * IEC 60870-5-104'ün resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki APCI
 * alan düzenleri (start baytı, length semantiği, I/S/U format ayrımı, 15-bit
 * sequence kodlaması, U-format fonksiyon baytları) ÜÇ bağımsız kamuya açık
 * ikincil kaynaktan ÇAPRAZ TEYİTLE alındı:
 *   1. Wireshark'ın `packet-iec104.c` dissector'ının alenen yayımlanan
 *      `APCI_START`(0x68)/`APCI_LEN`(6)/`APDU_MAX_LEN`(253) sabitleri ve
 *      I/S/U format ayrımının alt 2 bitten yapıldığı kod yolu —
 *      https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-iec104.c
 *   2. `viduq/iec104-cheat-sheet` — kamuya açık IEC-104 tanıtım/özet
 *      dokümanı: APCI'nin I/S/U format baytları bit bit dökümü, sequence
 *      number'ların 15 bit + 1 bit kaydırmalı kodlanışı —
 *      https://github.com/viduq/iec104-cheat-sheet
 *   3. `lib60870` (mz-automation, GPLv3 — yalnız dokümante edilmiş sabitler
 *      referans alındı, KOD KOPYALANMADI): `cs104_connection.c`nin
 *      STARTDT_ACT(0x07)/STARTDT_CON(0x0B)/STOPDT_ACT(0x13)/STOPDT_CON(0x23)/
 *      TESTFR_ACT(0x43)/TESTFR_CON(0x83) sabitleri —
 *      https://github.com/mz-automation/lib60870
 * İki kaynağın da aynı sayıyı aynı adla verdiği alanlar adlandırıldı; ASDU
 * tarafının (Type ID/COT tabloları, element genişlikleri) kendi kaynak
 * disclosure'ı `iec104Asdu.ts` dosya başındadır — tekrar edilmedi.
 *
 * ── KAPSAM ÇİZGİSİ (Karar 6/§29 "ilk aşama") ────────────────────────────────
 * Sequence BEKLENTİ takibi (hangi N(S)/N(R) değerinin sıradaki olduğu, kayıp
 * ACK tespiti) parser'a KONMAZ — çok çerçeve/oturum ister, analyzer işi (spec
 * 9377-9425, DNP3 transport reassembly'nin aynı sınırı). Bu motor yalnız TEK
 * bir APDU'daki sequence sayılarını ALAN olarak gösterir.
 *
 * ── APCI UZUNLUK TUZAĞI ──────────────────────────────────────────────────────
 * `Length` baytı KENDİSİNİ ve `start` baytını SAYMAZ; yalnız kendisinden
 * SONRAKİ baytları (4 kontrol baytı + ASDU) sayar — off-by-one klasiği
 * (modbusTcp'nin MBAP Length'i, DNP3'ün Length'i ile aynı aile). Toplam
 * çerçeve uzunluğu her zaman `2 + Length`'tir.
 */

import { decodeAsdu } from './iec104Asdu';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
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

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'iec-60870-5-104';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IEC 60870-5-104';

const START_BYTE = 0x68;
/** APCI: Start(1) + Length(1) + Control(4) = 6 bayt, HER ZAMAN sabit. */
const APCI_LENGTH = 6;
/** Length'in KENDİSİ ve start baytı hariç saydığı asgari içerik: 4 kontrol baytı. */
const MIN_CONTENT_LENGTH = 4;
/** Wireshark `APDU_MAX_LEN` — üstü hata değil, kuşkulu (WARN_OVERSIZED_LENGTH). */
const MAX_CONTENT_LENGTH = 253;

const HEX_RADIX = 16;

/** Control Field 1'in alt 2 biti — format ayrımı (dosya başı kaynak uyarısı). */
const FRAME_TYPE_MASK = 0x03;
const FRAME_TYPE_S_VALUE = 0x01;
const FRAME_TYPE_U_VALUE = 0x03;
/** U-format fonksiyon bitleri, alt 2 bit (format işareti) HARİÇ. */
const U_FUNCTION_MASK = 0xfc;

const ERROR_FRAME_TOO_SHORT = 'protocol.iec104.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.iec104.error.frameTooLong';
const ERROR_ABORTED = 'protocol.iec104.error.aborted';
const ERROR_CONTENT_LENGTH_TOO_SMALL = 'protocol.iec104.error.contentLengthTooSmall';
const ERROR_LENGTH_MISMATCH = 'protocol.iec104.error.lengthMismatch';
const ERROR_START_BYTE_INVALID = 'protocol.iec104.error.startByteInvalid';

const WARN_OVERSIZED_LENGTH = 'protocol.iec104.warning.oversizedLength';
const WARN_UNKNOWN_U_FORMAT_FUNCTION = 'protocol.iec104.warning.unknownUFormatFunction';

const SUMMARY_U_FORMAT = 'protocol.iec104.summary.uFormat';
const SUMMARY_S_FORMAT = 'protocol.iec104.summary.sFormat';
const SUMMARY_I_FORMAT = 'protocol.iec104.summary.iFormat';

/**
 * U-format fonksiyon baytları — CF1 & 0xFC anahtarlı. Üç kaynak da (dosya
 * başı) AYNI altı hex değeri veriyor: lib60870'in STARTDT/STOPDT/TESTFR
 * sabitleri ile Wireshark/cheat-sheet'in bit-pozisyon açıklaması birebir
 * örtüşüyor (0x07=0x03|0x04 → STARTDT act, vb.).
 */
const U_FORMAT_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0x04, 'STARTDT act'],
  [0x08, 'STARTDT con'],
  [0x10, 'STOPDT act'],
  [0x20, 'STOPDT con'],
  [0x40, 'TESTFR act'],
  [0x80, 'TESTFR con'],
]);

type FrameFormat = 'i-format' | 's-format' | 'u-format';

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

/**
 * 15-bit sequence number — CF çiftinin (lowByte, highByte) 1 bit sağa
 * kaydırılmasıyla elde edilir: bit0 (lowByte'ın en düşük biti) format/reserved
 * işaretidir, geri kalan 15 bit sıra numarasıdır (dosya başı kaynak uyarısı).
 */
function readSequenceNumber15(lowByte: number, highByte: number): number {
  return ((highByte << 8) | lowByte) >>> 1;
}

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  if (init.offset !== undefined) error.offset = init.offset;
  if (init.length !== undefined) error.length = init.length;
  if (init.details !== undefined) error.details = init.details;
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

export type Iec104FrameMetadata = {
  frameFormat: FrameFormat;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Iec104ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIec104Frame(data: Uint8Array, options: Iec104ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_ABORTED, recoverable: false });
  }

  if (data.length < APCI_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: APCI_LENGTH },
    });
  }

  const declaredContentLength = byteAt(data, 1);

  // Length, kendisinden SONRAKİ baytları sayar (dosya başı); 4 kontrol baytı
  // her zaman vardır, bunun altı yapısal olarak imkânsızdır (modbusTcp'nin
  // MIN_LENGTH_FIELD_VALUE guard'ıyla aynı desen) — kaydırma yok, akış terk edilir.
  if (declaredContentLength < MIN_CONTENT_LENGTH) {
    return fail({
      code: 'value-out-of-range',
      message: ERROR_CONTENT_LENGTH_TOO_SMALL,
      recoverable: false,
      offset: 1,
      length: 1,
      details: { declaredContentLength, minimum: MIN_CONTENT_LENGTH },
    });
  }

  const totalFrameLength = APCI_LENGTH - MIN_CONTENT_LENGTH + declaredContentLength;

  if (options.maxFrameLength !== undefined && totalFrameLength > options.maxFrameLength) {
    return fail({
      code: 'frame-too-long',
      message: ERROR_FRAME_TOO_LONG,
      recoverable: false,
      offset: options.maxFrameLength,
      length: totalFrameLength - options.maxFrameLength,
      details: { maxFrameLength: options.maxFrameLength, frameLength: totalFrameLength },
    });
  }

  if (data.length < totalFrameLength) {
    // TCP'de bir okuma birden çok APDU taşıyabileceği gibi bir APDU birden
    // çok okumaya da bölünmüş olabilir (modbusTcp emsali) — kalanı bekle.
    return fail({
      code: 'length-mismatch',
      message: ERROR_LENGTH_MISMATCH,
      recoverable: true,
      offset: 1,
      length: 1,
      details: { declaredContentLength, expectedFrameLength: totalFrameLength, availableBytes: data.length },
    });
  }

  // Fazlası sonraki APDU'ya aittir: tampon değil, YALNIZ bu çerçeve dilimlenir.
  const adu = data.slice(0, totalFrameLength);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const startByte = byteAt(adu, 0);
  const startValid = startByte === START_BYTE;
  fields.push({
    id: 'start-byte',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: adu.slice(0, 1),
    rawValue: formatHexByte(startByte),
    valid: startValid,
    warnings: startValid ? [] : [ERROR_START_BYTE_INVALID],
  });
  if (!startValid) {
    // DNP3 emsali: start baytı yanlış olsa da APCI'nin geri kalanı hâlâ sabit
    // ofsetlerdedir — motor teslim olmaz, kısmi/tam çözümü yine gösterir.
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_START_BYTE_INVALID,
      offset: 0,
      length: 1,
    });
  }

  const lengthField: ParsedField = {
    id: 'length',
    name: 'Length',
    offset: 1,
    length: 1,
    rawBytes: adu.slice(1, 2),
    rawValue: declaredContentLength,
    physicalValue: totalFrameLength,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  if (declaredContentLength > MAX_CONTENT_LENGTH) {
    lengthField.warnings.push(WARN_OVERSIZED_LENGTH);
    warnings.push(toProtocolWarning(WARN_OVERSIZED_LENGTH));
  }
  fields.push(lengthField);

  const cf1 = byteAt(adu, 2);
  const cf2 = byteAt(adu, 3);
  const cf3 = byteAt(adu, 4);
  const cf4 = byteAt(adu, 5);

  const isFrameTypeS = (cf1 & FRAME_TYPE_MASK) === FRAME_TYPE_S_VALUE;
  const isFrameTypeU = (cf1 & FRAME_TYPE_MASK) === FRAME_TYPE_U_VALUE;
  const frameFormat: FrameFormat = isFrameTypeU ? 'u-format' : isFrameTypeS ? 's-format' : 'i-format';
  const frameFormatLabel =
    frameFormat === 'u-format' ? 'U-format' : frameFormat === 's-format' ? 'S-format' : 'I-format';

  fields.push({
    id: 'frame-format',
    name: 'Frame Format',
    offset: 2,
    length: 1,
    rawBytes: adu.slice(2, 3),
    rawValue: cf1,
    physicalValue: frameFormatLabel,
    valid: true,
    warnings: [],
  });

  let summaryKey: string;
  const summaryParams: Record<string, string> = {};

  if (frameFormat === 'i-format') {
    const sendSequenceNumber = readSequenceNumber15(cf1, cf2);
    const receiveSequenceNumber = readSequenceNumber15(cf3, cf4);
    fields.push({
      id: 'send-sequence-number',
      name: 'Send Sequence Number N(S)',
      offset: 2,
      length: 2,
      rawBytes: adu.slice(2, 4),
      rawValue: sendSequenceNumber,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'receive-sequence-number',
      name: 'Receive Sequence Number N(R)',
      offset: 4,
      length: 2,
      rawBytes: adu.slice(4, 6),
      rawValue: receiveSequenceNumber,
      valid: true,
      warnings: [],
    });

    const asduBytes = adu.slice(APCI_LENGTH);
    const asduSummary = decodeAsdu(asduBytes, APCI_LENGTH, fields, warnings, errors);
    summaryKey = SUMMARY_I_FORMAT;
    summaryParams['typeId'] =
      asduSummary.typeIdLabel ??
      (asduSummary.typeId === undefined ? '' : formatHexByte(asduSummary.typeId));
    summaryParams['cause'] =
      asduSummary.causeOfTransmissionLabel ??
      (asduSummary.causeOfTransmission === undefined ? '' : String(asduSummary.causeOfTransmission));
  } else if (frameFormat === 's-format') {
    const receiveSequenceNumber = readSequenceNumber15(cf3, cf4);
    fields.push({
      id: 'reserved',
      name: 'Reserved',
      offset: 3,
      length: 1,
      rawBytes: adu.slice(3, 4),
      unit: 'B',
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'receive-sequence-number',
      name: 'Receive Sequence Number N(R)',
      offset: 4,
      length: 2,
      rawBytes: adu.slice(4, 6),
      rawValue: receiveSequenceNumber,
      valid: true,
      warnings: [],
    });
    summaryKey = SUMMARY_S_FORMAT;
    summaryParams['receiveSequenceNumber'] = String(receiveSequenceNumber);
  } else {
    const functionBits = cf1 & U_FUNCTION_MASK;
    const functionName = U_FORMAT_FUNCTION_NAMES.get(functionBits);
    const functionField: ParsedField = {
      id: 'u-format-function',
      name: 'U-Format Function',
      offset: 2,
      length: 1,
      rawBytes: adu.slice(2, 3),
      rawValue: functionBits,
      valid: functionName !== undefined,
      warnings: [],
    };
    if (functionName !== undefined) {
      functionField.physicalValue = functionName;
    } else {
      functionField.warnings.push(WARN_UNKNOWN_U_FORMAT_FUNCTION);
      warnings.push(toProtocolWarning(WARN_UNKNOWN_U_FORMAT_FUNCTION));
    }
    fields.push(functionField);
    fields.push({
      id: 'reserved',
      name: 'Reserved',
      offset: 3,
      length: 3,
      rawBytes: adu.slice(3, 6),
      unit: 'B',
      valid: true,
      warnings: [],
    });
    summaryKey = SUMMARY_U_FORMAT;
    summaryParams['function'] = functionName ?? formatHexByte(functionBits);
  }

  const metadata: Iec104FrameMetadata = { frameFormat, summaryKey, summaryParams };

  const rawFrame = createRawFrame(adu, {
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

  return { success: true, frame, consumedBytes: totalFrameLength };
}

export function parseIec104(data: Uint8Array): ParseResult {
  return parseIec104Frame(data, {});
}

export const iec104Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari APCI uzunluğu + start baytı. Length tutarlılığı burada DOĞRULANMAZ. */
  canParse(data: Uint8Array): boolean {
    if (data.length < APCI_LENGTH) return false;
    return byteAt(data, 0) === START_BYTE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Iec104ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseIec104Frame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi (§43'te bu dalga için fixture YOK,
 * dosya başı disiplin notu). Sequence sayıları/uzunluklar `iec104.test.ts`
 * içinde bağımsız aritmetikle ayrıca doğrulanıyor (DNP3/UBX emsali).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'u-format-startdt-act',
    name: 'protocol.iec104.example.uFormatStartdtAct.name',
    // En kısa mutlu yol: yalnız APCI, CF1=0x07 → STARTDT act.
    bytes: Uint8Array.from([0x68, 0x04, 0x07, 0x00, 0x00, 0x00]),
    description: 'protocol.iec104.example.uFormatStartdtAct.description',
    expectedValid: true,
  },
  {
    id: 's-format-ack',
    name: 'protocol.iec104.example.sFormatAck.name',
    // S-format, N(R)=3 (CF3=0x06,CF4=0x00 → (0x0006)>>>1=3).
    bytes: Uint8Array.from([0x68, 0x04, 0x01, 0x00, 0x06, 0x00]),
    description: 'protocol.iec104.example.sFormatAck.description',
    expectedValid: true,
  },
  {
    id: 'i-format-single-object-spontaneous',
    name: 'protocol.iec104.example.iFormatSingleObjectSpontaneous.name',
    // N(S)=0,N(R)=0; ASDU: M_SP_NA_1, SQ=0/count=1, COT=spontaneous(3), CA=1,
    // IOA=1, SIQ=0x01 (SPI=ON, kalite bitleri temiz).
    bytes: Uint8Array.from([
      0x68, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01,
    ]),
    description: 'protocol.iec104.example.iFormatSingleObjectSpontaneous.description',
    expectedValid: true,
  },
  {
    id: 'i-format-sequential-objects',
    name: 'protocol.iec104.example.iFormatSequentialObjects.name',
    // N(S)=1,N(R)=0; ASDU: M_SP_NA_1, SQ=1/count=3, COT=periodic(1), CA=1,
    // tek IOA=1, ardışık 3 SIQ elemanı (ON/OFF/ON+IV).
    bytes: Uint8Array.from([
      0x68, 0x10, 0x02, 0x00, 0x00, 0x00, 0x01, 0x83, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00,
      0x81,
    ]),
    description: 'protocol.iec104.example.iFormatSequentialObjects.description',
    expectedValid: true,
  },
  {
    id: 'i-format-interrogation-command',
    name: 'protocol.iec104.example.iFormatInterrogationCommand.name',
    // N(S)=2,N(R)=1; ASDU: C_IC_NA_1, SQ=0/count=1, COT=activation(6), CA=1,
    // IOA=0 (genel sorgulama), QOI=20 (ham element, tip çözümü yok).
    bytes: Uint8Array.from([
      0x68, 0x0e, 0x04, 0x00, 0x02, 0x00, 0x64, 0x01, 0x06, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x14,
    ]),
    description: 'protocol.iec104.example.iFormatInterrogationCommand.description',
    expectedValid: true,
  },
  {
    id: 'i-format-unknown-type-id',
    name: 'protocol.iec104.example.iFormatUnknownTypeId.name',
    // Type ID 200 dar kümede yok — uyarı yolu, frame yine de valid=true.
    bytes: Uint8Array.from([
      0x68, 0x0e, 0x06, 0x00, 0x02, 0x00, 0xc8, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xaa,
    ]),
    description: 'protocol.iec104.example.iFormatUnknownTypeId.description',
    expectedValid: true,
  },
  {
    id: 'start-byte-invalid',
    name: 'protocol.iec104.example.startByteInvalid.name',
    // u-format-startdt-act ile AYNI gövde, start baytı kasten 0x67.
    bytes: Uint8Array.from([0x67, 0x04, 0x07, 0x00, 0x00, 0x00]),
    description: 'protocol.iec104.example.startByteInvalid.description',
    expectedValid: false,
  },
  {
    id: 'length-mismatch',
    name: 'protocol.iec104.example.lengthMismatch.name',
    // Length=10 → toplam 12 bayt vaat eder, tampon yalnız 6 bayt — ParseFailure.
    bytes: Uint8Array.from([0x68, 0x0a, 0x07, 0x00, 0x00, 0x00]),
    description: 'protocol.iec104.example.lengthMismatch.description',
    expectedValid: false,
  },
];

export const iec104Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: iec104Parser,
  documentation: {
    summary: 'protocol.iec104.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'Wireshark IEC 60870-5-104 dissector (packet-iec104.c) field reference',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-iec104.c',
      },
      {
        title: 'iec104-cheat-sheet (viduq)',
        url: 'https://github.com/viduq/iec104-cheat-sheet',
      },
      {
        title: 'lib60870 (mz-automation, GPLv3 — documentation reference only)',
        url: 'https://github.com/mz-automation/lib60870',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
