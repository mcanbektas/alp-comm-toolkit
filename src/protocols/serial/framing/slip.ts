/**
 * SLIP (RFC 1055) — `protocol-core/framing/slip.ts`nin ÜSTÜNDE ince bir
 * `ProtocolPlugin` sarmalı. Çerçeveleme motoru (`slipExtractor`/`encodeSlip`,
 * Faz 6) zaten kesiyor VE kaçış çözüyor/kodluyor — burada YENİ bir decode
 * algoritması YOK, yalnız sonucu `ParsedField`a çeviriyoruz + kaçış
 * olaylarının kendi bayt konumlarını (extractor'ın döndürmediği, yalnız
 * GÖSTERİM amaçlı bir ayrıntı) ayrıca işaretliyoruz. Bu yürüyüş
 * `slipExtractor`in ZATEN doğruladığı bir sonucun üstünde çalışır — kendi
 * doğrulamasını TEKRARLAMAZ.
 *
 * RFC 1055'in kendi uyarısı (satır 127) korunur: SLIP'in kendisi adres/tip/
 * CRC/sıra TAŞIMAZ — "çerçeve nerede bitiyor" sorusuna cevap verir yalnızca,
 * bütünlük iddiası yok.
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
import { SLIP_END, SLIP_ESCAPE_RULE, encodeSlip, slipExtractor } from '@/protocol-core/framing/slip';
import { mapFramingError } from './framingErrorMapping';

const PROTOCOL_ID = 'slip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SLIP';

const TRANSLATION_KEY_PREFIX = 'protocol.slip';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

function hexByte(byte: number): string {
  return `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
}

function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * `SLIP_ESCAPE_RULE.substitutions`in TERSİ — "bu kaçış çifti neye çözülür"
 * sorusu için. `substitutions` genel `EscapeRule` tipinde OPSİYONEL (HDLC/PPP
 * gibi `xorMask` tabanlı kurallar onu taşımaz) ama SLIP'in KENDİ kuralı
 * (`slip.ts`) her zaman verir — boş harita, `substitutions` gerçekten
 * tanımsızsa (asla olmamalı, yalnız tip güvenliği için) sessiz bir no-op'tur.
 */
const REVERSE_SUBSTITUTIONS = new Map(
  [...(SLIP_ESCAPE_RULE.substitutions?.entries() ?? [])].map(([original, substitute]) => [substitute, original]),
);

/**
 * Kaçış olaylarının bayt konumlarını işaretler — `slipExtractor` yalnız
 * ÇÖZÜLMÜŞ payload'ı döndürür, HANGİ konumda kaçış olduğunu söylemez. Bu
 * yürüyüş yalnız `status: 'complete'` sonrasında çağrılır, bu yüzden her
 * `escapeByte` ardından geçerli bir ikame bayt GELDİĞİ varsayılabilir
 * (`slipExtractor` zaten doğruladı) — yine de `noUncheckedIndexedAccess`
 * disiplini korunur.
 */
function findEscapeEvents(wireContent: Uint8Array, wireOffset: number): ParsedField[] {
  const events: ParsedField[] = [];
  const escapeByte = SLIP_ESCAPE_RULE.escapeByte;
  let i = 0;
  let index = 0;
  while (i < wireContent.length) {
    const current = wireContent[i];
    if (current === escapeByte) {
      const next = wireContent[i + 1];
      const decoded = next === undefined ? undefined : REVERSE_SUBSTITUTIONS.get(next);
      if (next !== undefined && decoded !== undefined) {
        events.push({
          id: `escape-event-${index}`,
          name: 'Escape Sequence',
          offset: wireOffset + i,
          length: 2,
          rawBytes: wireContent.slice(i, i + 2),
          rawValue: `${hexByte(escapeByte)} ${hexByte(next)}`,
          physicalValue: hexByte(decoded),
          valid: true,
          warnings: [],
        });
        index += 1;
        i += 2;
        continue;
      }
    }
    i += 1;
  }
  return events;
}

function parseSlipFrame(data: Uint8Array, context?: ParseContext): ParseResult {
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
  const result = slipExtractor.extract(data, { maxFrameLength });

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
  const searchStart = data[0] === SLIP_END ? 1 : 0;
  const delimiterIndex = result.consumedBytes - 1;
  const wireContent = data.subarray(searchStart, delimiterIndex);

  const fields: ParsedField[] = [];

  if (searchStart === 1) {
    fields.push({
      id: 'leading-end',
      name: 'Leading END (optional line-noise flush)',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: 'END',
      valid: true,
      warnings: [],
    });
  }

  fields.push(...findEscapeEvents(wireContent, searchStart));

  fields.push({
    id: 'payload',
    name: 'Decoded Payload',
    offset: searchStart,
    length: wireContent.length,
    rawBytes: data.slice(searchStart, delimiterIndex),
    rawValue: hexString(result.frame),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'trailing-end',
    name: 'Trailing END',
    offset: delimiterIndex,
    length: 1,
    rawBytes: data.slice(delimiterIndex, delimiterIndex + 1),
    rawValue: 'END',
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

export const slipParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSlipFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'escaped-payload',
    // Faz 6'nın kendi doğrulanmış fixture'ı (slip.test.ts) — hem END hem ESC
    // kaçışını AYNI çerçevede gösterir.
    name: `${TRANSLATION_KEY_PREFIX}.example.escapedPayload.name`,
    bytes: Uint8Array.from([0x45, 0x00, 0xdb, 0xdc, 0x11, 0xdb, 0xdd, 0x22, 0xc0]),
    description: `${TRANSLATION_KEY_PREFIX}.example.escapedPayload.description`,
    expectedValid: true,
  },
  {
    id: 'leading-end-marker',
    // slip.test.ts'in "baştaki opsiyonel END" fixture'ı — RFC 1055 hat temizliği.
    name: `${TRANSLATION_KEY_PREFIX}.example.leadingEndMarker.name`,
    bytes: Uint8Array.from([SLIP_END, 0x01, 0x02, SLIP_END]),
    description: `${TRANSLATION_KEY_PREFIX}.example.leadingEndMarker.description`,
    expectedValid: true,
  },
  {
    id: 'no-escaping',
    name: `${TRANSLATION_KEY_PREFIX}.example.noEscaping.name`,
    bytes: encodeSlip(Uint8Array.from([0x01, 0x02, 0x03])),
    description: `${TRANSLATION_KEY_PREFIX}.example.noEscaping.description`,
    expectedValid: true,
  },
];

export const slipPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: slipParser,
  encoder: { encode: encodeSlip },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [{ title: 'RFC 1055 — A Nonstandard for Transmission of IP Datagrams over Serial Lines: SLIP', url: 'https://www.rfc-editor.org/rfc/rfc1055' }],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
