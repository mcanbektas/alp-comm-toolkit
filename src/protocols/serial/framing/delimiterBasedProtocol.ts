/**
 * Delimiter-Based Protocol — Faz 10 dalga 10e, 4 "jenerik" sayfanın
 * dördüncüsü ve TEK istisnası: diğer üçünün (`customBinaryProtocol.ts`
 * dosya başına bkz.) AKSİNE `ProtocolFramingSchema`nın 5 türünden hiçbiri
 * "delimiter collision + escape" kavramını ifade edemiyor (`type`
 * `startEnd` olsa bile bir `EscapeRule` TAŞIMIYOR) — bu yüzden bu sayfa
 * TEK BAŞINA Faz 6'nın 15 yöntemlik framing motoruna uğruyor. Katalog
 * kaydının kendi notu zaten bunu öngörmüştü ("Kaynak escape dönüşümünü
 * kasıtlı olarak açık bırakıyor").
 *
 * **Motor YENİDEN YAZILMADI — `protocol-core/framing/hdlcFraming.ts`
 * (Faz 6) AYNEN kullanıldı:** `hdlcFlagExtractor`/`HDLC_ESCAPE_RULE`/
 * `encodeHdlcFlagFrame`, PPP'nin (dalga 10b) de kullandığı TAM AYNI
 * mekanizma (Flag=0x7E, Escape=0x7D, XOR=0x20) — spec özetinin kendi
 * "Escape Örneği"yle (`02-framing-protokolleri.md:85-86`) birebir aynı
 * sayılar: `01 7E 02 → 01 7D 5E 02`.
 *
 * **Checksum/CRC bilerek YOK** — `custom-binary-protocol`/`length-based-
 * protocol` zaten bunu gösteriyor; bu sayfanın kendine özgü katkısı
 * yalnız delimiter-collision + escape mekaniği (`hdlc-flag`in kendi
 * dosya başı notu: FCS protokol katmanının işi, çerçeveleme motorunun
 * değil).
 */

import { HDLC_ESCAPE_RULE, HDLC_FLAG, encodeHdlcFlagFrame, hdlcFlagExtractor } from '@/protocol-core/framing/hdlcFraming';
import { mapFramingError } from './framingErrorMapping';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
} from '@/protocol-core/types';
import { createRawFrame } from '@/protocol-core/types';

const PROTOCOL_ID = 'delimiter-based-protocol';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Delimiter-Based Protocol';

const TRANSLATION_KEY_PREFIX = 'protocol.delimiterBasedProtocol';

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_INCOMPLETE = `${TRANSLATION_KEY_PREFIX}.error.incomplete`;

const HEX_RADIX = 16;
function hexByte(byte: number): string {
  return `0x${byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}
function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')).join(' ');
}

const MAX_FRAME_LENGTH = 256;

/**
 * `wireContent` (bayrak baytları HARİÇ, HALA kaçışlı tel içeriği) içinde
 * kaç bayt kaçışlandığını, tel konumlarıyla birlikte bulur. `hdlcFlagExtractor`
 * çözülmüş (unescaped) içeriği döndürüyor (SLIP/COBS/PPP'nin ortak deseni,
 * `02-framing-protokolleri.md` keşfi) — "nerede kaçış oldu" göstermek için
 * HAM tel içeriğine ayrıca bakmak gerekiyor (PPP'nin (dalga 10b)
 * `findEscapeEvents`iyle AYNI ihtiyaç, kapsam küçük olduğu için burada
 * kendi başına yeten küçük bir kopyası yazıldı — dosyalar arası paylaşım
 * yok, xmodemCore/hdlcCore'un hex yardımcılarıyla aynı konvansiyon).
 */
function locateEscapeEvents(wireContent: Uint8Array): readonly number[] {
  const wireOffsets: number[] = [];
  for (let index = 0; index < wireContent.length; index += 1) {
    if (wireContent[index] === HDLC_ESCAPE_RULE.escapeByte) wireOffsets.push(index);
  }
  return wireOffsets;
}

function parseDelimiterBasedFrame(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }

  const result = hdlcFlagExtractor.extract(data, { maxFrameLength: MAX_FRAME_LENGTH });

  if (result.status === 'incomplete') {
    return { success: false, error: { code: 'truncated-frame', message: ERROR_INCOMPLETE }, consumedBytes: 0, recoverable: true };
  }
  if (result.status === 'error') {
    const mapped = mapFramingError(result.error);
    return { success: false, error: mapped, consumedBytes: result.consumedBytes, recoverable: result.recoverable };
  }

  const fields: ParsedField[] = [];
  const wireContent = data.slice(1, result.consumedBytes - 1);
  const escapeWireOffsets = locateEscapeEvents(wireContent);

  fields.push({
    id: 'flag-start',
    name: 'Flag (Start)',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: hexByte(HDLC_FLAG),
    physicalValue: 'HDLC_FLAG — frame start delimiter',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'payload',
    name: 'Payload (unescaped)',
    offset: 1,
    length: wireContent.length,
    rawBytes: wireContent,
    rawValue: hexString(result.frame),
    physicalValue: `${result.frame.length} bytes (decoded), ${escapeWireOffsets.length} escape sequence(s) on the wire`,
    valid: true,
    warnings: [],
  });

  escapeWireOffsets.forEach((wireOffset, index) => {
    const escapedByte = wireContent[wireOffset + 1];
    fields.push({
      id: `escape-event-${index}`,
      name: 'Escape Event',
      offset: 1 + wireOffset,
      length: 2,
      rawBytes: wireContent.slice(wireOffset, wireOffset + 2),
      rawValue: hexString(wireContent.slice(wireOffset, wireOffset + 2)),
      physicalValue:
        escapedByte === undefined
          ? undefined
          : `wire 0x7D 0x${escapedByte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')} → decoded 0x${(escapedByte ^ (HDLC_ESCAPE_RULE.xorMask ?? 0)).toString(HEX_RADIX).toUpperCase().padStart(2, '0')} (delimiter collision resolved)`,
      valid: true,
      warnings: [],
    });
  });

  fields.push({
    id: 'flag-end',
    name: 'Flag (End)',
    offset: result.consumedBytes - 1,
    length: 1,
    rawBytes: data.slice(result.consumedBytes - 1, result.consumedBytes),
    rawValue: hexByte(HDLC_FLAG),
    physicalValue: 'HDLC_FLAG — frame end delimiter',
    valid: true,
    warnings: [],
  });

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
    valid: true,
    errors: [],
    warnings: [],
  };

  return { success: true, frame: parsedFrame, consumedBytes: result.consumedBytes };
}

export const delimiterBasedProtocolParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0 && data[0] === HDLC_FLAG;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseDelimiterBasedFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

/** `01 7E 02` — spec özetinin kendi "Escape Örneği" (satır 85-86): payload içindeki 0x7E, flag baytıyla ÇAKIŞIYOR (delimiter collision), kaçışlanması ZORUNLU. */
const COLLIDING_PAYLOAD = Uint8Array.from([0x01, 0x7e, 0x02]);
const VALID_FRAME = encodeHdlcFlagFrame(COLLIDING_PAYLOAD);

/** Kapanış bayrağı YOK — akış ortasında kesilmiş çerçeve. */
const INCOMPLETE_FRAME = Uint8Array.from([HDLC_FLAG, 0x01, 0x7d, 0x5e, 0x02]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'collision-escaped',
    name: `${TRANSLATION_KEY_PREFIX}.example.collisionEscaped.name`,
    bytes: VALID_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.collisionEscaped.description`,
    expectedValid: true,
  },
  {
    id: 'missing-end-flag',
    name: `${TRANSLATION_KEY_PREFIX}.example.missingEndFlag.name`,
    bytes: INCOMPLETE_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.missingEndFlag.description`,
    expectedValid: false,
  },
];

export const delimiterBasedProtocolPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: delimiterBasedProtocolParser,
  encoder: { encode: encodeHdlcFlagFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
