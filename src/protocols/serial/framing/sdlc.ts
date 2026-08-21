/**
 * SDLC (IBM Synchronous Data Link Control) — `hdlcCore.ts`nin (bu dalga,
 * PAYLAŞILAN çekirdek — HDLC de kullanıyor) ÜSTÜNDE ince ProtocolPlugin
 * sarmalı. Çerçeve şekli HDLC ile BİREBİR AYNI (Flag/Address/Control/
 * Information/FCS) — spec'in kendi notu (`02-framing-protokolleri.md`
 * satır 177-189): SDLC yalnız KAVRAMSAL olarak farklı, istasyon adresini
 * primary/secondary polling modelinin bir parçası sayar. Bu yüzden `hdlc.ts`
 * ile aynı çekirdeği (framing + Control field I/S/U + FCS) paylaşıyor,
 * yalnız Address alanının adı/yorumu "Station Address" olarak değişiyor.
 *
 * SDLC'nin kendi RFC/ISO numarası YOK — IBM'in tarihsel iç dokümantasyonu
 * (spec kaynağı "IBM AIX SDLC dokümantasyonu" diyor), doğrulanmış kalıcı
 * bir genel-erişim URL elde edilemedi, uydurulmadı (COBS'un `references`
 * eksikliğiyle aynı disiplin, dalga 10a).
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
import {
  byteAt,
  decodeControlByte,
  encodeHdlcSyncFrame,
  hdlcSyncExtractor,
  hexByte,
  hexString,
  hexWord,
  validateHdlcFcs,
} from './hdlcCore';
import { mapFramingError } from './framingErrorMapping';

const PROTOCOL_ID = 'sdlc';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SDLC';

const TRANSLATION_KEY_PREFIX = 'protocol.sdlc';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.tooShort`;
const ERROR_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.fcsMismatch`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

/** Station Address(1) + Control(1) + FCS(2) — Information boş olabilir, bu dördü olamaz. */
const MIN_CONTENT_LENGTH = 4;
const BROADCAST_ADDRESS = 0xff;

function frameFormatLabel(format: 'i-format' | 's-format' | 'u-format'): string {
  return format === 'i-format' ? 'I-format' : format === 's-format' ? 'S-format' : 'U-format';
}

function parseSdlcFrame(data: Uint8Array, context?: ParseContext): ParseResult {
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
  const result = hdlcSyncExtractor.extract(data, { maxFrameLength });

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

  // result.status === 'complete' — content = Station Address+Control+
  // Information+FCS (flag'ler HARİÇ, `hdlcSyncExtractor`in varsayılanı).
  const content = result.frame;
  if (content.length < MIN_CONTENT_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 1, length: content.length },
      consumedBytes: result.consumedBytes,
      recoverable: true,
    };
  }

  const stationAddress = byteAt(content, 0);
  const control = byteAt(content, 1);
  const informationBytes = content.slice(2, content.length - 2);
  const fcsBytes = content.slice(content.length - 2);
  const coveredForFcs = content.slice(0, content.length - 2);

  const fields: ParsedField[] = [];

  fields.push({
    id: 'flag-start',
    name: 'Flag',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: 'FLAG',
    valid: true,
    warnings: [],
  });

  const stationAddressField: ParsedField = {
    id: 'station-address',
    name: 'Station Address',
    offset: 1,
    length: 1,
    rawBytes: content.slice(0, 1),
    rawValue: hexByte(stationAddress),
    valid: true,
    warnings: [],
  };
  if (stationAddress === BROADCAST_ADDRESS) {
    stationAddressField.physicalValue = 'All-Stations (broadcast)';
  }
  fields.push(stationAddressField);

  const cf = decodeControlByte(control);
  fields.push({
    id: 'control',
    name: 'Control',
    offset: 2,
    length: 1,
    rawBytes: content.slice(1, 2),
    rawValue: hexByte(control),
    physicalValue: frameFormatLabel(cf.format),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'poll-final',
    name: 'Poll/Final',
    offset: 2,
    length: 1,
    rawBytes: content.slice(1, 2),
    rawValue: cf.pollFinal ? 1 : 0,
    valid: true,
    warnings: [],
  });
  if (cf.format === 'i-format') {
    fields.push({
      id: 'send-sequence-number',
      name: 'Send Sequence Number N(S)',
      offset: 2,
      length: 1,
      rawBytes: content.slice(1, 2),
      rawValue: cf.sendSequenceNumber ?? 0,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'receive-sequence-number',
      name: 'Receive Sequence Number N(R)',
      offset: 2,
      length: 1,
      rawBytes: content.slice(1, 2),
      rawValue: cf.receiveSequenceNumber ?? 0,
      valid: true,
      warnings: [],
    });
  } else if (cf.format === 's-format') {
    fields.push({
      id: 'supervisory-type',
      name: 'Supervisory Type',
      offset: 2,
      length: 1,
      rawBytes: content.slice(1, 2),
      rawValue: cf.supervisoryType ?? '',
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'receive-sequence-number',
      name: 'Receive Sequence Number N(R)',
      offset: 2,
      length: 1,
      rawBytes: content.slice(1, 2),
      rawValue: cf.receiveSequenceNumber ?? 0,
      valid: true,
      warnings: [],
    });
  }

  if (informationBytes.length > 0) {
    fields.push({
      id: 'information',
      name: 'Information',
      offset: 3,
      length: informationBytes.length,
      rawBytes: informationBytes,
      rawValue: hexString(informationBytes),
      valid: true,
      warnings: [],
    });
  }

  const fcs = validateHdlcFcs(coveredForFcs, fcsBytes);
  const fcsOffset = 1 + content.length - 2;
  fields.push({
    id: 'fcs',
    name: 'FCS',
    offset: fcsOffset,
    length: 2,
    rawBytes: fcsBytes,
    rawValue: hexWord(fcs.received),
    physicalValue: fcs.valid ? `PASS (${hexWord(fcs.calculated)})` : `FAIL (${hexWord(fcs.calculated)})`,
    valid: fcs.valid,
    warnings: [],
  });

  const flagEndOffset = content.length + 1;
  fields.push({
    id: 'flag-end',
    name: 'Flag',
    offset: flagEndOffset,
    length: 1,
    rawBytes: data.slice(flagEndOffset, flagEndOffset + 1),
    rawValue: 'FLAG',
    valid: true,
    warnings: [],
  });

  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  if (!fcs.valid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_FCS_MISMATCH,
      offset: fcsOffset,
      length: 2,
      details: { received: fcs.received, calculated: fcs.calculated },
    });
  }

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
    valid: fcs.valid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export const sdlcParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSdlcFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────
// FCS motorun KENDİSİYLE (`encodeHdlcSyncFrame` → `computeNamedCrc`)
// hesaplanır — bkz. hdlcCore.ts dosya başı disiplini.

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'i-frame',
    // Station Address=0x04, Control=0x42 → I-format, N(S)=1, P/F=0, N(R)=2.
    name: `${TRANSLATION_KEY_PREFIX}.example.iFrame.name`,
    bytes: encodeHdlcSyncFrame(Uint8Array.from([0x04, 0x42, 0xaa, 0xbb])),
    description: `${TRANSLATION_KEY_PREFIX}.example.iFrame.description`,
    expectedValid: true,
  },
  {
    id: 'poll',
    // Station Address=0xFF (broadcast), Control=0x71 → S-format RR, P/F=1 (poll).
    name: `${TRANSLATION_KEY_PREFIX}.example.poll.name`,
    bytes: encodeHdlcSyncFrame(Uint8Array.from([0xff, 0x71])),
    description: `${TRANSLATION_KEY_PREFIX}.example.poll.description`,
    expectedValid: true,
  },
  {
    id: 'u-frame',
    // Station Address=0x05, Control=0x03 → U-format, M-bit'ler=0, P/F=0.
    name: `${TRANSLATION_KEY_PREFIX}.example.uFrame.name`,
    bytes: encodeHdlcSyncFrame(Uint8Array.from([0x05, 0x03])),
    description: `${TRANSLATION_KEY_PREFIX}.example.uFrame.description`,
    expectedValid: true,
  },
];

export const sdlcPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: sdlcParser,
  encoder: { encode: encodeHdlcSyncFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
