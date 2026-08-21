/**
 * ASCII Protocol — Faz 10 dalga 10e, 4 "jenerik" sayfanın üçüncüsü (bkz.
 * `customBinaryProtocol.ts` dosya başı — aynı karar: `schema.framing`
 * `parseWithSchema`nın zaten desteklediği türlerden biri (`'none'`, start/end
 * baytı yok) kullanıyor, 15 yöntemlik framing motoruna hiç uğranmaz).
 *
 * **Fixture, spec özetinin KENDİ örneği:** `02-framing-protokolleri.md:57`
 * — `TEMP,25.3,40.2\r\n`. Alan tipleri `ascii` (metin ARALIĞI) kadar sınırlı;
 * `FIELD_TYPES`te virgülle ayrılmış DEĞİŞKEN genişlikli bir sayısal alanı
 * ("25.3" → 25.3 float) OKUYAN bir tip YOK (`fieldTypes.ts`nin kendi 3 grup
 * ayrımı: sabit genişlik / şemadan gelen genişlik / anlamsal tamsayı —
 * "virgüle kadar oku" hiçbirine girmiyor). Bu yüzden `parameters` alanı HAM
 * METİN olarak kalır — spec özetinin "Numeric Field Parser" vaadi bu
 * şemada ÇÖZÜLMEDİ, uydurulmadı (ZFILE'ın ZF0-2 option baytlarını ham
 * bırakmasıyla aynı disiplin, dalga 10d/2).
 */

import { encodeWithSchema } from '@/protocol-core/encoding/schemaEncoder';
import type { EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { createSchemaParser } from '@/protocol-core/decoding/schemaParser';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type { ExampleFrame, ProtocolPlugin } from '@/protocol-core/types';

const PROTOCOL_ID = 'ascii-protocol';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ASCII Protocol';

const TRANSLATION_KEY_PREFIX = 'protocol.asciiProtocol';

/** `command`in TİPİ `'ascii'` — `FIELD_TYPES`teki `'command'` rolü yalnız TAMSAYI komut kodları için (fieldTypes.ts:15-18), ASCII sözcük için yanlış tip olurdu. */
export const ASCII_PROTOCOL_SCHEMA: ProtocolSchema = {
  name: 'ASCII Protocol Example',
  version: '1.0',
  framing: {
    type: 'none',
    maximumFrameLength: 32,
  },
  fields: [
    { id: 'command', name: 'Command', type: 'ascii', offset: 0, length: 4 },
    { id: 'parameters', name: 'Parameters', type: 'ascii', offset: 4, length: 10 },
    { id: 'lineEnding', name: 'Line Ending (CR LF)', type: 'delimiter', offset: 14, length: 2 },
  ],
};

export const asciiProtocolParser = createSchemaParser(ASCII_PROTOCOL_SCHEMA);

function encodeAsciiFrame(values: EncodeValues): Uint8Array {
  const result = encodeWithSchema(ASCII_PROTOCOL_SCHEMA, values);
  if (!result.success) {
    throw new Error(`encodeAsciiFrame: ${result.issues.map((issue) => issue.message).join('; ')}`);
  }
  return result.bytes;
}

// ── Örnekler ───────────────────────────────────────────────────────────

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

/** `TEMP,25.3,40.2\r\n` — spec özeti satır 57'nin kendi örneği. */
const VALID_FRAME = Uint8Array.from(ascii('TEMP,25.3,40.2\r\n'));

/** Aynı satır, CRLF KESİLMİŞ — spec özetinin "ASCII Parser Sorunları" listesindeki "Missing CR"/"Missing LF" durumunu gösterir. */
const MISSING_LINE_ENDING_FRAME = Uint8Array.from(ascii('TEMP,25.3,40.2'));

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'temperature-reading',
    name: `${TRANSLATION_KEY_PREFIX}.example.temperatureReading.name`,
    bytes: VALID_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.temperatureReading.description`,
    expectedValid: true,
  },
  {
    id: 'missing-line-ending',
    name: `${TRANSLATION_KEY_PREFIX}.example.missingLineEnding.name`,
    bytes: MISSING_LINE_ENDING_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.missingLineEnding.description`,
    expectedValid: false,
  },
];

export const asciiProtocolPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: asciiProtocolParser,
  encoder: { encode: encodeAsciiFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
