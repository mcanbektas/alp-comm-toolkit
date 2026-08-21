/**
 * XMODEM — `xmodemCore.ts`nin (bu dalga, PAYLAŞILAN çekirdek — YMODEM de
 * kullanıyor) ÜSTÜNDE ince ProtocolPlugin sarmalı. Blok yapısı/checksum-CRC
 * ayrımı/kontrol baytlarının NEDEN böyle çözüldüğü `xmodemCore.ts`nin dosya
 * başında. Framing motoruna (Faz 6) hiç UĞRAMAZ — orada çağrı YOK.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { encodeXmodemBlock, hexByte, hexString, hexWord, parseXmodemFrame } from './xmodemCore';

const PROTOCOL_ID = 'xmodem';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'XMODEM';

const TRANSLATION_KEY_PREFIX = 'protocol.xmodem';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_UNKNOWN_HEADER = `${TRANSLATION_KEY_PREFIX}.error.unknownHeader`;
const ERROR_BAD_TRAILER_LENGTH = `${TRANSLATION_KEY_PREFIX}.error.badTrailerLength`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_COMPLEMENT_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.complementMismatch`;
const ERROR_CHECKSUM_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.checksumMismatch`;
const ERROR_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.crcMismatch`;

function parseXmodem(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }

  const result = parseXmodemFrame(data);
  if (!result.ok) {
    if (result.reason === 'empty') {
      return {
        success: false,
        error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
        consumedBytes: 0,
        recoverable: true,
      };
    }
    if (result.reason === 'unknown-header') {
      return {
        success: false,
        error: { code: 'unsupported-encoding', message: ERROR_UNKNOWN_HEADER, offset: 0, length: 1 },
        consumedBytes: 0,
        recoverable: false,
      };
    }
    return {
      success: false,
      error: { code: 'length-mismatch', message: ERROR_BAD_TRAILER_LENGTH, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  let valid = true;

  const { frame: xmodemFrame } = result;
  if (xmodemFrame.kind === 'control') {
    fields.push({
      id: 'control',
      name: 'Control Byte',
      offset: 0,
      length: 1,
      rawBytes: data,
      rawValue: hexByte(xmodemFrame.byte),
      physicalValue: xmodemFrame.name,
      valid: true,
      warnings: [],
    });
  } else {
    fields.push({
      id: 'header',
      name: 'Header',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: hexByte(xmodemFrame.header),
      physicalValue: xmodemFrame.dataLength === 128 ? 'SOH — 128-byte block' : 'STX — 1024-byte block (XMODEM-1K)',
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'block-number',
      name: 'Block Number',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: xmodemFrame.block,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'block-complement',
      name: 'Block Number Complement (~Block)',
      offset: 2,
      length: 1,
      rawBytes: data.slice(2, 3),
      rawValue: hexByte(xmodemFrame.blockComplement),
      physicalValue: xmodemFrame.complementValid ? 'valid' : `MISMATCH — expected ${hexByte(xmodemFrame.block ^ 0xff)}`,
      valid: xmodemFrame.complementValid,
      warnings: xmodemFrame.complementValid ? [] : [ERROR_COMPLEMENT_MISMATCH],
    });
    if (!xmodemFrame.complementValid) {
      valid = false;
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_COMPLEMENT_MISMATCH,
        offset: 2,
        length: 1,
        details: { block: xmodemFrame.block, complement: xmodemFrame.blockComplement },
      });
    }

    fields.push({
      id: 'data',
      name: 'Data',
      offset: 3,
      length: xmodemFrame.dataLength,
      rawBytes: xmodemFrame.data,
      rawValue: hexString(xmodemFrame.data),
      physicalValue: `${xmodemFrame.dataLength} bytes`,
      valid: true,
      warnings: [],
    });

    const trailerOffset = 3 + xmodemFrame.dataLength;
    if (xmodemFrame.mode === 'checksum') {
      fields.push({
        id: 'checksum',
        name: 'Checksum',
        offset: trailerOffset,
        length: 1,
        rawBytes: xmodemFrame.trailer,
        rawValue: hexByte(xmodemFrame.received),
        physicalValue: xmodemFrame.integrityValid ? `PASS (${hexByte(xmodemFrame.calculated)})` : `FAIL (${hexByte(xmodemFrame.calculated)})`,
        valid: xmodemFrame.integrityValid,
        warnings: [],
      });
      if (!xmodemFrame.integrityValid) {
        valid = false;
        errors.push({
          code: 'checksum-mismatch',
          message: ERROR_CHECKSUM_MISMATCH,
          offset: trailerOffset,
          length: 1,
          details: { received: xmodemFrame.received, calculated: xmodemFrame.calculated },
        });
      }
    } else {
      fields.push({
        id: 'crc',
        name: 'CRC-16',
        offset: trailerOffset,
        length: 2,
        rawBytes: xmodemFrame.trailer,
        rawValue: hexWord(xmodemFrame.received),
        physicalValue: xmodemFrame.integrityValid ? `PASS (${hexWord(xmodemFrame.calculated)})` : `FAIL (${hexWord(xmodemFrame.calculated)})`,
        valid: xmodemFrame.integrityValid,
        warnings: [],
      });
      if (!xmodemFrame.integrityValid) {
        valid = false;
        errors.push({
          code: 'crc-mismatch',
          message: ERROR_CRC_MISMATCH,
          offset: trailerOffset,
          length: 2,
          details: { received: xmodemFrame.received, calculated: xmodemFrame.calculated },
        });
      }
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

/** `encodeXmodemBlock`in tek-parametreli `ProtocolEncoder` şekline sarmalı — Block 1, CRC modu varsayılan (checksum modu `xmodemCore.ts`ten doğrudan erişilebilir). */
function encodeXmodemDataBlock(data: Uint8Array): Uint8Array {
  return encodeXmodemBlock(1, data, 'crc');
}

export const xmodemParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseXmodem(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

function repeatingPayload(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_unused, index) => index % 256);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'checksum-block',
    // 128-bayt blok, checksum modu (SUM-8) — Block 1.
    name: `${TRANSLATION_KEY_PREFIX}.example.checksumBlock.name`,
    bytes: encodeXmodemBlock(1, repeatingPayload(128), 'checksum'),
    description: `${TRANSLATION_KEY_PREFIX}.example.checksumBlock.description`,
    expectedValid: true,
  },
  {
    id: 'crc-block-1k',
    // 1024-bayt blok (XMODEM-1K), CRC-16 modu — Block 2.
    name: `${TRANSLATION_KEY_PREFIX}.example.crcBlock1k.name`,
    bytes: encodeXmodemBlock(2, repeatingPayload(1024), 'crc'),
    description: `${TRANSLATION_KEY_PREFIX}.example.crcBlock1k.description`,
    expectedValid: true,
  },
  {
    id: 'eot',
    name: `${TRANSLATION_KEY_PREFIX}.example.eot.name`,
    bytes: Uint8Array.from([0x04]),
    description: `${TRANSLATION_KEY_PREFIX}.example.eot.description`,
    expectedValid: true,
  },
];

export const xmodemPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: xmodemParser,
  encoder: { encode: encodeXmodemDataBlock },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
