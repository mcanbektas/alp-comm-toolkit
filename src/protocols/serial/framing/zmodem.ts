/**
 * ZMODEM — `zmodemCore.ts`nin (bu dalga, PAYLAŞILAN olmayan — ZMODEM'in
 * kendi çekirdeği, XMODEM/YMODEM'in çekirdeğiyle wire seviyesinde HİÇBİR
 * ortak yanı yok, dosya başı gerekçesi) ÜSTÜNDE ince ProtocolPlugin sarmalı.
 *
 * Decode sekmesi TEK bir header, varsa onu izleyen TEK bir subpacket alır
 * — session/batch takibi (kaç dosya, ZRINIT/ZFILE/ZDATA sırası) bu motorun
 * işi DEĞİL (`ProtocolParser.parse()` saf/stateless kalır — kullanıcının
 * kendi kararıyla ZMODEM'i XMODEM/YMODEM'den AYIRAN karar zaten bu
 * disiplini içeriyordu, PPP'nin (dalga 10b) LCP oturum takibini
 * ERTELEMESİYLE aynı disiplin).
 */

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
import {
  ZCRCE,
  ZCRCW,
  encodeZmodemHeader,
  encodeZmodemSubpacket,
  hexByte,
  hexDword,
  hexString,
  hexWord,
  parseZmodemFrame,
} from './zmodemCore';
import type { ZmodemHeaderForm, ZmodemParseFailureReason } from './zmodemCore';

const PROTOCOL_ID = 'zmodem';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ZMODEM';

const TRANSLATION_KEY_PREFIX = 'protocol.zmodem';

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_HEADER_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.headerCrcMismatch`;
const ERROR_SUBPACKET_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.subpacketCrcMismatch`;
const WARNING_INCOMPLETE_SUBPACKET = `${TRANSLATION_KEY_PREFIX}.warning.incompleteSubpacket`;

const FAILURE_MESSAGE_KEYS: Readonly<Record<ZmodemParseFailureReason, string>> = {
  empty: `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`,
  'no-zdle': `${TRANSLATION_KEY_PREFIX}.error.noZdle`,
  'unsupported-header-type': `${TRANSLATION_KEY_PREFIX}.error.unsupportedHeaderType`,
  'unknown-header-type': `${TRANSLATION_KEY_PREFIX}.error.unknownHeaderType`,
  'truncated-frame': `${TRANSLATION_KEY_PREFIX}.error.truncatedFrame`,
  'invalid-escape': `${TRANSLATION_KEY_PREFIX}.error.invalidEscape`,
  'invalid-hex-digit': `${TRANSLATION_KEY_PREFIX}.error.invalidHexDigit`,
  'unknown-frame-type': `${TRANSLATION_KEY_PREFIX}.error.unknownFrameType`,
};

/** `ZmodemParseFailureReason` (zengin, zmodemCore'a özel) → sabit `ProtocolErrorCode` birleşimi (xmodem.ts/ymodem.ts'in reason-eşleme desenindeki aynı köprü rolü). */
function mapFailureReason(reason: ZmodemParseFailureReason): ProtocolErrorCode {
  switch (reason) {
    case 'empty':
      return 'truncated-frame';
    case 'no-zdle':
      return 'start-delimiter-not-found';
    case 'unsupported-header-type':
    case 'unknown-header-type':
    case 'invalid-escape':
      return 'unsupported-encoding';
    case 'truncated-frame':
      return 'truncated-frame';
    case 'invalid-hex-digit':
      return 'invalid-hex-input';
    case 'unknown-frame-type':
      return 'unsupported-function-code';
  }
}

const HEADER_FORM_LABELS: Readonly<Record<ZmodemHeaderForm, string>> = {
  binary16: 'ZBIN — Binary Header (16-bit CRC)',
  hex16: 'ZHEX — Hex Header (16-bit CRC)',
  binary32: 'ZBIN32 — Binary Header (32-bit CRC)',
};

function findByte(data: Uint8Array, target: number, from: number): number {
  for (let idx = from; idx < data.length; idx += 1) {
    if (data[idx] === target) return idx;
  }
  return -1;
}

function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

interface ZfilePathnameInfo {
  readonly filename: string;
  readonly filenameEnd: number;
  readonly filesizeText?: string;
  readonly filesizeBytes?: number;
  readonly filesizeStart: number;
  readonly filesizeEnd: number;
  readonly remainderStart: number;
}

/** ZFILE'ın subpacket içeriği — spec §13 "ZMODEM sends the SAME file information... that YMODEM Batch sends in its block 0" — ymodem.ts'in `parseBlockZeroMetadata`iyle AYNI dar/güvenilir alt küme disiplini (dosya self-contained kalsın diye burada AYRICA yazıldı, import edilmedi — xmodemCore/hdlcCore'un hex yardımcılarını her dosyanın kendi tekrarlamasıyla aynı konvansiyon). */
function parseZfilePathname(data: Uint8Array): ZfilePathnameInfo {
  const nul1 = findByte(data, 0x00, 0);
  const filenameEnd = nul1 === -1 ? data.length : nul1;
  const filename = latin1(data.slice(0, filenameEnd));
  if (nul1 === -1) {
    return { filename, filenameEnd, filesizeStart: data.length, filesizeEnd: data.length, remainderStart: data.length };
  }
  const filesizeStart = nul1 + 1;
  let filesizeEnd = filesizeStart;
  while (filesizeEnd < data.length) {
    const byte = data[filesizeEnd];
    if (byte === undefined || byte === 0x20 || byte === 0x00) break;
    filesizeEnd += 1;
  }
  const filesizeText = latin1(data.slice(filesizeStart, filesizeEnd));
  const filesizeBytes = /^[0-9]+$/.test(filesizeText) ? Number.parseInt(filesizeText, 10) : undefined;
  return {
    filename,
    filenameEnd,
    filesizeStart,
    filesizeEnd,
    filesizeText: filesizeText.length > 0 ? filesizeText : undefined,
    filesizeBytes,
    remainderStart: filesizeEnd,
  };
}

function parseZmodem(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }

  const result = parseZmodemFrame(data);
  if (!result.ok) {
    return {
      success: false,
      error: { code: mapFailureReason(result.reason), message: FAILURE_MESSAGE_KEYS[result.reason], offset: result.offset, length: 1 },
      consumedBytes: 0,
      recoverable: result.reason === 'truncated-frame' || result.reason === 'empty',
    };
  }

  const { frame } = result;
  const { header, subpacket } = frame;
  const fields: ParsedField[] = [];
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  let valid = true;

  fields.push({
    id: 'header-form',
    name: 'Header Form',
    offset: header.segments.preamble.offset,
    length: header.segments.preamble.length,
    rawBytes: data.slice(header.segments.preamble.offset, header.segments.preamble.offset + header.segments.preamble.length),
    rawValue: hexByte(data[header.segments.preamble.offset + header.segments.preamble.length - 1] ?? 0),
    physicalValue: HEADER_FORM_LABELS[header.form],
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'frame-type',
    name: 'Frame Type',
    offset: header.segments.frameType.offset,
    length: header.segments.frameType.length,
    rawBytes: data.slice(header.segments.frameType.offset, header.segments.frameType.offset + header.segments.frameType.length),
    rawValue: hexByte(header.frameType),
    physicalValue: header.frameTypeName,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'header-data',
    name: 'Header Data (ZP0-ZP3 / ZF0-ZF3)',
    offset: header.segments.headerData.offset,
    length: header.segments.headerData.length,
    rawBytes: data.slice(header.segments.headerData.offset, header.segments.headerData.offset + header.segments.headerData.length),
    rawValue: hexString(header.headerData),
    physicalValue: header.interpretation,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'header-crc',
    name: header.crcWidth === 16 ? 'CRC-16' : 'CRC-32',
    offset: header.segments.crc.offset,
    length: header.segments.crc.length,
    rawBytes: data.slice(header.segments.crc.offset, header.segments.crc.offset + header.segments.crc.length),
    rawValue: header.crcWidth === 16 ? hexWord(header.crcReceived) : hexDword(header.crcReceived),
    physicalValue: header.crcValid
      ? `PASS (${header.crcWidth === 16 ? hexWord(header.crcCalculated) : hexDword(header.crcCalculated)})`
      : `FAIL (${header.crcWidth === 16 ? hexWord(header.crcCalculated) : hexDword(header.crcCalculated)})`,
    valid: header.crcValid,
    warnings: [],
  });
  if (!header.crcValid) {
    valid = false;
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_HEADER_CRC_MISMATCH,
      offset: header.segments.crc.offset,
      length: header.segments.crc.length,
      details: { received: header.crcReceived, calculated: header.crcCalculated },
    });
  }

  if (subpacket !== undefined) {
    const subpacketOffset = header.wireLength;

    if (header.frameType === 4 && subpacket.data.length > 0) {
      // ZFILE — bkz. `parseZfilePathname` dosya başı notu.
      const pathname = parseZfilePathname(subpacket.data);
      fields.push({
        id: 'filename',
        name: 'Filename',
        offset: subpacketOffset,
        length: pathname.filenameEnd,
        rawBytes: subpacket.data.slice(0, pathname.filenameEnd),
        rawValue: pathname.filename,
        valid: true,
        warnings: [],
      });
      if (pathname.filesizeText !== undefined) {
        fields.push({
          id: 'filesize',
          name: 'Filesize',
          offset: subpacketOffset + pathname.filesizeStart,
          length: pathname.filesizeEnd - pathname.filesizeStart,
          rawBytes: subpacket.data.slice(pathname.filesizeStart, pathname.filesizeEnd),
          rawValue: pathname.filesizeText,
          physicalValue: pathname.filesizeBytes,
          unit: pathname.filesizeBytes === undefined ? undefined : 'B',
          valid: true,
          warnings: [],
        });
      }
      if (pathname.remainderStart < subpacket.data.length) {
        const remainder = subpacket.data.slice(pathname.remainderStart);
        fields.push({
          id: 'metadata-remainder',
          name: 'Metadata Remainder',
          offset: subpacketOffset + pathname.remainderStart,
          length: remainder.length,
          rawBytes: remainder,
          rawValue: hexString(remainder),
          physicalValue: '(raw — mtime/mode/serial encoding not standardized, not decoded)',
          valid: true,
          warnings: [],
        });
      }
    } else {
      fields.push({
        id: 'subpacket-data',
        name: 'Subpacket Data',
        offset: subpacketOffset,
        length: subpacket.dataWireLength,
        rawBytes: subpacket.data,
        rawValue: hexString(subpacket.data),
        physicalValue: `${subpacket.data.length} bytes`,
        valid: true,
        warnings: [],
      });
    }

    if (subpacket.terminator !== undefined) {
      const terminatorOffset = subpacketOffset + subpacket.dataWireLength;
      fields.push({
        id: 'subpacket-terminator',
        name: 'Subpacket Terminator',
        offset: terminatorOffset,
        length: subpacket.terminatorWireLength,
        rawBytes: data.slice(terminatorOffset, terminatorOffset + subpacket.terminatorWireLength),
        rawValue: hexByte(subpacket.terminator),
        physicalValue: subpacket.terminatorName,
        valid: true,
        warnings: [],
      });
    }

    if (subpacket.complete && subpacket.crcReceived !== undefined && subpacket.crcCalculated !== undefined) {
      const crcOffset = subpacketOffset + subpacket.dataWireLength + subpacket.terminatorWireLength;
      const crcValid = subpacket.crcValid ?? false;
      fields.push({
        id: 'subpacket-crc',
        name: subpacket.crcWidth === 16 ? 'CRC-16' : 'CRC-32',
        offset: crcOffset,
        length: subpacket.crcWireLength,
        rawBytes: data.slice(crcOffset, crcOffset + subpacket.crcWireLength),
        rawValue: subpacket.crcWidth === 16 ? hexWord(subpacket.crcReceived) : hexDword(subpacket.crcReceived),
        physicalValue: crcValid
          ? `PASS (${subpacket.crcWidth === 16 ? hexWord(subpacket.crcCalculated) : hexDword(subpacket.crcCalculated)})`
          : `FAIL (${subpacket.crcWidth === 16 ? hexWord(subpacket.crcCalculated) : hexDword(subpacket.crcCalculated)})`,
        valid: crcValid,
        warnings: [],
      });
      if (!crcValid) {
        valid = false;
        errors.push({
          code: 'crc-mismatch',
          message: ERROR_SUBPACKET_CRC_MISMATCH,
          offset: crcOffset,
          length: subpacket.crcWireLength,
          details: { received: subpacket.crcReceived, calculated: subpacket.crcCalculated },
        });
      }
    } else if (!subpacket.complete) {
      // HDLC'nin (dalga 10c) yapısal olarak tamamlanmış çerçeveden sonra kalan
      // baytları hata değil uyarı sayma toleransıyla aynı disiplin — eksik
      // subpacket header'ı GEÇERSİZ kılmaz, kullanıcı kısmi bir girdi yapıştırmış olabilir.
      warnings.push({ code: 'incomplete-subpacket', message: WARNING_INCOMPLETE_SUBPACKET, offset: subpacketOffset });
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const parsedFrame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid,
    errors,
    warnings,
  };

  return { success: true, frame: parsedFrame, consumedBytes: frame.consumedBytes };
}

export const zmodemParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseZmodem(data, context);
  },
};

/** Verilen baytları bir ZDATA header+subpacket çerçevesine sarar — XMODEM/YMODEM/HDLC'nin "jenerik payload → protokolün kendi veri çerçevesi" encoder deseniyle aynı rol. */
function encodeZmodemDataFrame(payload: Uint8Array): Uint8Array {
  const header = encodeZmodemHeader(10 /* ZDATA */, new Uint8Array(4), 'binary16');
  const subpacket = encodeZmodemSubpacket(payload, ZCRCW, 16);
  return Uint8Array.from([...header, ...subpacket]);
}

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'zrqinit-hex',
    // ZRQINIT, HEX form — en yaygın oturum-başlatma header'ı, escape yok, insan-okunur.
    name: `${TRANSLATION_KEY_PREFIX}.example.zrqinitHex.name`,
    bytes: encodeZmodemHeader(0, new Uint8Array(4), 'hex16'),
    description: `${TRANSLATION_KEY_PREFIX}.example.zrqinitHex.description`,
    expectedValid: true,
  },
  {
    id: 'zrinit-binary',
    // ZRINIT, binary16 — ZF0=0x23 (CANFDX|CANOVIO|CANFC32), buffer=0 (unlimited).
    name: `${TRANSLATION_KEY_PREFIX}.example.zrinitBinary.name`,
    bytes: encodeZmodemHeader(1, Uint8Array.from([0x00, 0x00, 0x00, 0x23]), 'binary16'),
    description: `${TRANSLATION_KEY_PREFIX}.example.zrinitBinary.description`,
    expectedValid: true,
  },
  {
    id: 'zfile-with-subpacket',
    // ZFILE header + subpacket (filename+filesize, ZCRCW) — spec §13, YMODEM Block 0 ile aynı iç format.
    name: `${TRANSLATION_KEY_PREFIX}.example.zfileWithSubpacket.name`,
    bytes: (() => {
      const header = encodeZmodemHeader(4, new Uint8Array(4), 'binary16');
      const filenameBytes = Array.from('firmware.bin', (char) => char.charCodeAt(0));
      const sizeBytes = Array.from('32768', (char) => char.charCodeAt(0));
      const subpacketData = Uint8Array.from([...filenameBytes, 0x00, ...sizeBytes]);
      const subpacket = encodeZmodemSubpacket(subpacketData, ZCRCW, 16);
      return Uint8Array.from([...header, ...subpacket]);
    })(),
    description: `${TRANSLATION_KEY_PREFIX}.example.zfileWithSubpacket.description`,
    expectedValid: true,
  },
  {
    id: 'zdata-binary32',
    // ZDATA header (binary32, Position=5242880) + subpacket (ZCRCE) — CANFC32 oturumu.
    name: `${TRANSLATION_KEY_PREFIX}.example.zdataBinary32.name`,
    bytes: (() => {
      const header = encodeZmodemHeader(10, Uint8Array.from([0x00, 0x00, 0x50, 0x00]), 'binary32');
      const subpacket = encodeZmodemSubpacket(new Uint8Array(16).fill(0x42), ZCRCE, 32);
      return Uint8Array.from([...header, ...subpacket]);
    })(),
    description: `${TRANSLATION_KEY_PREFIX}.example.zdataBinary32.description`,
    expectedValid: true,
  },
];

export const zmodemPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: zmodemParser,
  encoder: { encode: encodeZmodemDataFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
