/**
 * ICMP (RFC 792) — IPv4'ün ayrılmaz parçası, control/error reporting. Girdi TEK
 * bir ICMP mesajıdır (IPv4 sarmalayıcısı YOK — `ipv4.ts`teki karar 1'in aynısı,
 * motorlar zincir KURMAZ).
 *
 * ── TİP KÜMESİ DAR TUTULDU (spec 08-ag-ethernet.md:158-169) ─────────────────
 * Spec bu dört tipi ayrıntılı anlatır: Echo Reply(0)/Request(8), Destination
 * Unreachable(3), Time Exceeded(11). `ipv4.ts`teki `PROTOCOL_NAMES` deseninin
 * aynısı: kümede olmayan bir Type `valid:false` + "tanınmayan" uyarısıyla
 * gösterilir, ayrıca hata BASILMAZ (frame yine `valid:true` kalır — bilinmeyen
 * tip yapısal bir kusur değildir).
 *
 * ── CHECKSUM: TAM DOĞRULANIR, PSEUDO-HEADER İSTEMEZ ─────────────────────────
 * ICMP checksum'ı (RFC 792 §Checksum) MESAJIN TAMAMINI (header+data) kapsar ve
 * IPv4 başlık checksum'ı gibi pseudo-header istemez — `ipv4.ts`teki "TAM
 * DOĞRULANIR" durumunun emsali, UDP'deki pseudo-header eksikliği burada YOK.
 *
 * ── "ECHO RTT EŞLEŞTİRME", "ORIGINAL DATAGRAM CORRELATE" ÇOK-PAKET İŞİDİR ───
 * Spec bu ikisini "Toolkit ... üretebilir" diye tarif eder — tek çerçeve
 * çözücüsünün değil, bir analyzer/correlator'ın işi (spec 08-ag-ethernet.md:161-
 * 167). Bu dosya yalnız TEK mesajı alan alanına ayırır; eşleştirme/RTT/hop
 * analizi katalogdaki ayrı bir araçtır (`ipv4.ts`teki fragment reassembly
 * kararının aynı sınırı).
 */

import { computeInternetChecksumWithFieldZeroed, verifyInternetChecksum } from '@/protocol-core/checksums/internetChecksum';
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

const PROTOCOL_ID = 'icmp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ICMP';

/** Type(1B) + Code(1B) + Checksum(2B) + tip-özel 4 bayt (Echo'da Identifier+
 * Sequence, hata mesajlarında Unused) — HER tip için ortak asgari uzunluk. */
const MIN_HEADER_LENGTH = 8;

const TYPE_OFFSET = 0;
const CODE_OFFSET = 1;
const CHECKSUM_OFFSET = 2;
const REST_OFFSET = 4;
const IDENTIFIER_OFFSET = 4;
const SEQUENCE_OFFSET = 6;
const DATA_OFFSET = 8;

const WORD_LENGTH = 2;
const REST_LENGTH = 4;

const HEX_RADIX = 16;
const HEX_DIGITS_16BIT = 4;

const TYPE_ECHO_REPLY = 0;
const TYPE_DESTINATION_UNREACHABLE = 3;
const TYPE_ECHO_REQUEST = 8;
const TYPE_TIME_EXCEEDED = 11;

/** Dar tutulan tip kümesi (dosya başı) — spec'in ayrıntılı anlattığı 4 tip. */
const TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [TYPE_ECHO_REPLY, 'Echo Reply'],
  [TYPE_DESTINATION_UNREACHABLE, 'Destination Unreachable'],
  [TYPE_ECHO_REQUEST, 'Echo Request'],
  [TYPE_TIME_EXCEEDED, 'Time Exceeded'],
]);

/** RFC 792 — Destination Unreachable Code alanı. */
const UNREACHABLE_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Net Unreachable'],
  [1, 'Host Unreachable'],
  [2, 'Protocol Unreachable'],
  [3, 'Port Unreachable'],
  [4, 'Fragmentation Needed and DF Set'],
  [5, 'Source Route Failed'],
]);

/** RFC 792 — Time Exceeded Code alanı. */
const TIME_EXCEEDED_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'TTL Exceeded in Transit'],
  [1, 'Fragment Reassembly Time Exceeded'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.icmp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.icmp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.icmp.error.aborted';
const ERROR_CHECKSUM_MISMATCH = 'protocol.icmp.error.checksumMismatch';

const WARN_UNKNOWN_TYPE = 'protocol.icmp.warning.unknownType';
const WARN_UNKNOWN_CODE = 'protocol.icmp.warning.unknownCode';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHex16(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_16BIT, '0')}`;
}

interface IcmpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIcmpFrame(data: Uint8Array, options: IcmpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_HEADER_LENGTH) {
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

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const typeValue = byteAt(data, TYPE_OFFSET);
  const typeName = TYPE_NAMES.get(typeValue);
  const typeField: ParsedField = {
    id: 'type',
    name: 'Type',
    offset: TYPE_OFFSET,
    length: 1,
    rawBytes: data.slice(TYPE_OFFSET, TYPE_OFFSET + 1),
    rawValue: typeValue,
    valid: typeName !== undefined,
    warnings: [],
  };
  if (typeName !== undefined) typeField.physicalValue = typeName;
  else {
    typeField.warnings = [WARN_UNKNOWN_TYPE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_TYPE));
  }
  fields.push(typeField);

  const codeValue = byteAt(data, CODE_OFFSET);
  const codeNames =
    typeValue === TYPE_DESTINATION_UNREACHABLE
      ? UNREACHABLE_CODE_NAMES
      : typeValue === TYPE_TIME_EXCEEDED
        ? TIME_EXCEEDED_CODE_NAMES
        : undefined;
  const codeName = codeNames?.get(codeValue);
  const codeField: ParsedField = {
    id: 'code',
    name: 'Code',
    offset: CODE_OFFSET,
    length: 1,
    rawBytes: data.slice(CODE_OFFSET, CODE_OFFSET + 1),
    rawValue: codeValue,
    valid: true,
    warnings: [],
  };
  if (codeName !== undefined) {
    codeField.physicalValue = codeName;
  } else if (codeNames !== undefined) {
    // Bilinen bir tip ama kodu dar kümenin dışında (ör. Destination Unreachable
    // Code 9/10/13 gibi RFC 1122 ek kodları) — tip geçerli kalır, yalnız kod
    // adlandırılamaz.
    codeField.warnings = [WARN_UNKNOWN_CODE];
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CODE));
  }
  fields.push(codeField);

  const receivedChecksum = readUint16BE(data, CHECKSUM_OFFSET);
  const checksumValid = verifyInternetChecksum(data);
  const checksumField: ParsedField = {
    id: 'checksum',
    name: 'Checksum',
    offset: CHECKSUM_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + WORD_LENGTH),
    rawValue: receivedChecksum,
    valid: checksumValid,
    warnings: [],
  };
  if (checksumValid) {
    checksumField.physicalValue = 'Valid';
  } else {
    const computedChecksum = computeInternetChecksumWithFieldZeroed(data, CHECKSUM_OFFSET, WORD_LENGTH);
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: CHECKSUM_OFFSET,
      length: WORD_LENGTH,
      details: { received: formatHex16(receivedChecksum), computed: formatHex16(computedChecksum) },
    });
  }
  fields.push(checksumField);

  if (typeValue === TYPE_ECHO_REPLY || typeValue === TYPE_ECHO_REQUEST) {
    fields.push({
      id: 'identifier',
      name: 'Identifier',
      offset: IDENTIFIER_OFFSET,
      length: WORD_LENGTH,
      rawBytes: data.slice(IDENTIFIER_OFFSET, IDENTIFIER_OFFSET + WORD_LENGTH),
      rawValue: readUint16BE(data, IDENTIFIER_OFFSET),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'sequence-number',
      name: 'Sequence Number',
      offset: SEQUENCE_OFFSET,
      length: WORD_LENGTH,
      rawBytes: data.slice(SEQUENCE_OFFSET, SEQUENCE_OFFSET + WORD_LENGTH),
      rawValue: readUint16BE(data, SEQUENCE_OFFSET),
      valid: true,
      warnings: [],
    });
    const echoData = data.slice(DATA_OFFSET);
    if (echoData.length > 0) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: DATA_OFFSET,
        length: echoData.length,
        rawBytes: echoData,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else if (typeValue === TYPE_DESTINATION_UNREACHABLE || typeValue === TYPE_TIME_EXCEEDED) {
    fields.push({
      id: 'unused',
      name: 'Unused',
      offset: REST_OFFSET,
      length: REST_LENGTH,
      rawBytes: data.slice(REST_OFFSET, REST_OFFSET + REST_LENGTH),
      valid: true,
      warnings: [],
    });
    const originalDatagram = data.slice(DATA_OFFSET);
    if (originalDatagram.length > 0) {
      fields.push({
        id: 'original-datagram',
        name: 'Original Datagram',
        offset: DATA_OFFSET,
        length: originalDatagram.length,
        rawBytes: originalDatagram,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else {
    // Tanınmayan tip: gövde çözülmez, ham bırakılır (dosya başı, ipv4.ts'teki
    // "tanınmayan protokol" deseninin aynısı).
    const messageBody = data.slice(REST_OFFSET);
    if (messageBody.length > 0) {
      fields.push({
        id: 'message-body',
        name: 'Message Body',
        offset: REST_OFFSET,
        length: messageBody.length,
        rawBytes: messageBody,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

export function parseIcmp(data: Uint8Array): ParseResult {
  return parseIcmpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): IcmpParseOptions {
  const options: IcmpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const icmpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk. ICMP'nin ayırt edici bir magic byte'ı yok
   * (udp.ts/tcp.ts'in aynı sınırı) — auto-detection uzunluğa dayanır. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIcmpFrame(data, readContextOptions(context));
  },
};

function icmpHeader(fields: {
  type: number;
  code: number;
  checksum: number;
  restOfHeader: readonly [number, number, number, number];
}): number[] {
  return [
    fields.type,
    fields.code,
    (fields.checksum >>> 8) & 0xff,
    fields.checksum & 0xff,
    ...fields.restOfHeader,
  ];
}

/**
 * Örnek çerçeveler. Checksum'lar bağımsız hesaplandı (görev betiği, Node) —
 * `verifyInternetChecksum` bu değerlerle `true` döner.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'echo-request',
    name: 'protocol.icmp.example.echoRequest.name',
    // Type=8, Code=0, Id=0x0001, Seq=0x0001, 4 bayt veri — checksum bağımsız
    // hesaplandı: 0x5A60.
    bytes: Uint8Array.from([
      ...icmpHeader({ type: 8, code: 0, checksum: 0x5a60, restOfHeader: [0x00, 0x01, 0x00, 0x01] }),
      0xde, 0xad, 0xbe, 0xef,
    ]),
    description: 'protocol.icmp.example.echoRequest.description',
    expectedValid: true,
  },
  {
    id: 'echo-reply',
    name: 'protocol.icmp.example.echoReply.name',
    // Type=0, Code=0, aynı Id/Seq/veri — checksum bağımsız hesaplandı: 0x6260.
    bytes: Uint8Array.from([
      ...icmpHeader({ type: 0, code: 0, checksum: 0x6260, restOfHeader: [0x00, 0x01, 0x00, 0x01] }),
      0xde, 0xad, 0xbe, 0xef,
    ]),
    description: 'protocol.icmp.example.echoReply.description',
    expectedValid: true,
  },
  {
    id: 'destination-unreachable-port',
    name: 'protocol.icmp.example.destinationUnreachablePort.name',
    // Type=3, Code=3 (Port Unreachable), original datagram olarak 8 bayt —
    // checksum bağımsız hesaplandı: 0xB7E0.
    bytes: Uint8Array.from([
      ...icmpHeader({ type: 3, code: 3, checksum: 0xb7e0, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
      0x45, 0x00, 0x00, 0x1c, 0x00, 0x00, 0x00, 0x00,
    ]),
    description: 'protocol.icmp.example.destinationUnreachablePort.description',
    expectedValid: true,
  },
  {
    id: 'time-exceeded-ttl',
    name: 'protocol.icmp.example.timeExceededTtl.name',
    // Type=11, Code=0 (TTL Exceeded in Transit) — checksum bağımsız hesaplandı: 0xF4FF.
    bytes: Uint8Array.from(
      icmpHeader({ type: 11, code: 0, checksum: 0xf4ff, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
    ),
    description: 'protocol.icmp.example.timeExceededTtl.description',
    expectedValid: true,
  },
  {
    id: 'checksum-fail',
    name: 'protocol.icmp.example.checksumFail.name',
    // Checksum bilerek 0x0000 yazıldı; gerçek değer 0x5A5F'dir (Echo Request, aynı gövde).
    bytes: Uint8Array.from([
      ...icmpHeader({ type: 8, code: 0, checksum: 0x0000, restOfHeader: [0x00, 0x02, 0x00, 0x01] }),
      0xde, 0xad, 0xbe, 0xef,
    ]),
    description: 'protocol.icmp.example.checksumFail.description',
    expectedValid: false,
  },
  {
    id: 'unknown-type',
    name: 'protocol.icmp.example.unknownType.name',
    // Type=30 (RFC 6918'de "Deprecated" ilan edilmiş eski Traceroute) dar
    // kümenin dışında — checksum bağımsız hesaplandı: 0xE1FF.
    bytes: Uint8Array.from(
      icmpHeader({ type: 30, code: 0, checksum: 0xe1ff, restOfHeader: [0x00, 0x00, 0x00, 0x00] }),
    ),
    description: 'protocol.icmp.example.unknownType.description',
    expectedValid: true,
  },
];

export const icmpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: icmpParser,
  documentation: {
    summary: 'protocol.icmp.documentation.summary',
    layer: 'network',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
