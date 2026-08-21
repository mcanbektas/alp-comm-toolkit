/**
 * COBS (Consistent Overhead Byte Stuffing) — `protocol-core/framing/cobs.ts`nin
 * ÜSTÜNDE ince bir `ProtocolPlugin` sarmalı. Çerçeveleme motoru (`cobsExtractor`/
 * `encodeCobs`/`decodeCobs`, Faz 6) zaten kesiyor VE kod-baytlarını çözüyor/
 * kodluyor — burada YENİ bir decode algoritması YOK, yalnız sonucu
 * `ParsedField`a çeviriyoruz + her kod baytının kendi konumunu (extractor'ın
 * döndürmediği, yalnız GÖSTERİM amaçlı bir ayrıntı) ayrıca işaretliyoruz. Bu
 * yürüyüş `cobsExtractor`in ZATEN doğruladığı bir sonucun üstünde çalışır —
 * kendi doğrulamasını TEKRARLAMAZ.
 *
 * SLIP'in aksine COBS'ta "opsiyonel öncü delimiter" sözleşmesi YOK
 * (`cobs.ts`nin kendi yorumu) — bu yüzden burada `leading-*` alanı yok.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { COBS_DELIMITER, cobsExtractor, encodeCobsFrame } from '@/protocol-core/framing/cobs';
import { mapFramingError } from './framingErrorMapping';

const PROTOCOL_ID = 'cobs';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'COBS';

const TRANSLATION_KEY_PREFIX = 'protocol.cobs';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** `cobs.ts`nin kendi (dışa aktarılmayan) sabiti — spec satır 141-146: 0xFF kodu "blok tam doldu, zero eklenmez" demektir. */
const MAX_BLOCK_LENGTH = 0xff;

/**
 * Her kod baytının konumunu ve taşıdığı blok uzunluğunu işaretler —
 * `cobsExtractor` yalnız ÇÖZÜLMÜŞ payload'ı döndürür, kod baytlarının
 * KONUMUNU söylemez. Yalnız `status: 'complete'` sonrasında çağrılır (girdi
 * zaten doğrulanmış), bu yüzden `encoded[i]` burada güvenle okunabilir —
 * yine de `noUncheckedIndexedAccess` disiplini korunur.
 */
function findCodeByteEvents(encoded: Uint8Array): ParsedField[] {
  const events: ParsedField[] = [];
  let i = 0;
  let blockIndex = 0;
  while (i < encoded.length) {
    const blockCode = encoded[i];
    if (blockCode === undefined) break;
    const dataLength = blockCode - 1;
    const isOverflowBlock = blockCode === MAX_BLOCK_LENGTH;
    const hasImplicitZeroAfter = !isOverflowBlock && i + blockCode < encoded.length;

    events.push({
      id: `code-byte-${blockIndex}`,
      name: 'Code Byte',
      offset: i,
      length: 1,
      rawBytes: encoded.slice(i, i + 1),
      rawValue: blockCode,
      physicalValue: isOverflowBlock
        ? `${dataLength} data bytes (overflow block, no zero removed)`
        : hasImplicitZeroAfter
          ? `${dataLength} data bytes, zero restored after`
          : `${dataLength} data bytes`,
      valid: true,
      warnings: [],
    });

    i += blockCode;
    blockIndex += 1;
  }
  return events;
}

function parseCobsFrame(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = context?.maxFrameLength ?? data.length;
  const result = cobsExtractor.extract(data, { maxFrameLength });

  if (result.status === 'incomplete') {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_NO_DELIMITER, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (result.status === 'error') {
    const mapped = mapFramingError(result.error);
    return {
      success: false,
      error: { code: mapped.code, message: mapped.message, offset: mapped.offset },
      consumedBytes: result.consumedBytes,
      recoverable: result.recoverable,
    };
  }

  // result.status === 'complete'
  const delimiterIndex = result.consumedBytes - 1;
  const encoded = data.subarray(0, delimiterIndex);

  const fields: ParsedField[] = [...findCodeByteEvents(encoded)];

  fields.push({
    id: 'payload',
    name: 'Decoded Payload',
    offset: 0,
    length: encoded.length,
    rawBytes: data.slice(0, delimiterIndex),
    rawValue: hexString(result.frame),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'delimiter',
    name: 'Delimiter (0x00)',
    offset: delimiterIndex,
    length: 1,
    rawBytes: data.slice(delimiterIndex, delimiterIndex + 1),
    rawValue: '0x00',
    valid: true,
    warnings: [],
  });

  const warnings: ProtocolWarning[] = [];
  if (result.consumedBytes < data.length) {
    const trailingOffset = result.consumedBytes;
    fields.push({
      id: 'trailing-bytes',
      name: 'Trailing Bytes (after frame)',
      offset: trailingOffset,
      length: data.length - trailingOffset,
      rawBytes: data.slice(trailingOffset),
      rawValue: hexString(data.slice(trailingOffset)),
      valid: true,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
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
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export const cobsParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseCobsFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'zero-in-middle',
    // Faz 6'nın kendi doğrulanmış fixture'ı (cobs.test.ts, spec satır 139).
    name: `${TRANSLATION_KEY_PREFIX}.example.zeroInMiddle.name`,
    bytes: Uint8Array.from([0x03, 0x11, 0x22, 0x02, 0x33, COBS_DELIMITER]),
    description: `${TRANSLATION_KEY_PREFIX}.example.zeroInMiddle.description`,
    expectedValid: true,
  },
  {
    id: 'single-zero',
    // spec satır 140 — en küçük olası girdi: tek bir 0x00 baytı.
    name: `${TRANSLATION_KEY_PREFIX}.example.singleZero.name`,
    bytes: Uint8Array.from([0x01, 0x01, COBS_DELIMITER]),
    description: `${TRANSLATION_KEY_PREFIX}.example.singleZero.description`,
    expectedValid: true,
  },
  {
    id: 'no-zero-bytes',
    name: `${TRANSLATION_KEY_PREFIX}.example.noZeroBytes.name`,
    bytes: encodeCobsFrame(Uint8Array.from([0x01, 0x02, 0x03])),
    description: `${TRANSLATION_KEY_PREFIX}.example.noZeroBytes.description`,
    expectedValid: true,
  },
];

export const cobsPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: cobsParser,
  encoder: { encode: encodeCobsFrame },
  documentation: {
    // COBS'un RFC'si yok (Cheshire & Baker, IEEE/ACM ToN 1999) — doğrulanmış,
    // kalıcı bir URL elde yok, uydurulmadı (bkz. dosya başı disiplini).
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
