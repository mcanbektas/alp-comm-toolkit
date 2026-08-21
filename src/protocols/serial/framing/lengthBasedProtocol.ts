/**
 * Length-Based Protocol — Faz 10 dalga 10e, 4 "jenerik" sayfanın ikincisi
 * (bkz. `customBinaryProtocol.ts` dosya başı — aynı karar: `schema.framing`
 * `parseWithSchema`nın zaten desteklediği türlerden biri (`'lengthField'`)
 * kullanıyor, 15 yöntemlik framing motoruna hiç uğranmaz).
 *
 * **Şema, `customBinaryProtocol`den BİLEREK farklı kurgulandı** — start
 * baytı YOK, çerçeve SAF olarak uzunluk alanından türer (spec özeti
 * `02-framing-protokolleri.md:93-108`in kendi tanımı: "Frame uzunluğu header
 * içindeki bir alandan belirlenir"). LENGTH alanı 2 bayt BÜYÜK-UÇLU seçildi
 * (spec özeti satır 102'nin kendi vurgusu: "Length endianness açıkça
 * tanımlanmalıdır" — tek baytlık bir uzunlukla bu ayrım hiç görünmezdi).
 *
 * Spec özeti sembolik bir örnek veriyor (`AA 55 05 10 20 30 40 50 CRC`,
 * CRC hesaplanmamış) — XMODEM/PPP/ZMODEM'in aynı disipliniyle (uydurmadan,
 * bağımsız hesapla) kendi fixture'ımız kuruldu, spec'in sembolik örneği
 * DEĞİL.
 */

import { encodeWithSchema } from '@/protocol-core/encoding/schemaEncoder';
import type { EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { createSchemaParser } from '@/protocol-core/decoding/schemaParser';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type { ExampleFrame, ProtocolPlugin } from '@/protocol-core/types';

const PROTOCOL_ID = 'length-based-protocol';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Length-Based Protocol';

const TRANSLATION_KEY_PREFIX = 'protocol.lengthBasedProtocol';

/** Checksum kapsamı yalnız PAYLOAD — LENGTH alanı kasıtlı dışarıda (kendi bütünlüğünü frame-too-long/truncated-frame korur, checksum'a ihtiyacı yok). */
export const LENGTH_BASED_PROTOCOL_SCHEMA: ProtocolSchema = {
  name: 'Length-Based Protocol Example',
  version: '1.0',
  framing: {
    type: 'lengthField',
    maximumFrameLength: 64,
  },
  fields: [
    { id: 'length', name: 'Length', type: 'length', offset: 0, length: 2, endianness: 'big' },
    { id: 'payload', name: 'Payload', type: 'rawBytes', lengthFrom: 'length' },
    {
      id: 'checksum',
      name: 'Checksum',
      type: 'checksum',
      algorithm: 'xor8',
      coverage: { startField: 'payload', endField: 'payload' },
    },
  ],
};

export const lengthBasedProtocolParser = createSchemaParser(LENGTH_BASED_PROTOCOL_SCHEMA);

function encodeLengthBasedFrame(values: EncodeValues): Uint8Array {
  const result = encodeWithSchema(LENGTH_BASED_PROTOCOL_SCHEMA, values);
  if (!result.success) {
    throw new Error(`encodeLengthBasedFrame: ${result.issues.map((issue) => issue.message).join('; ')}`);
  }
  return result.bytes;
}

// ── Örnekler ───────────────────────────────────────────────────────────

/** LENGTH=0x0004 (BE) + PAYLOAD(AA BB CC DD) + CHECKSUM — bağımsız hesap: XOR8(AA,BB,CC,DD) = 0x00. */
const VALID_FRAME = Uint8Array.from([0x00, 0x04, 0xaa, 0xbb, 0xcc, 0xdd, 0x00]);

/** LENGTH=0x03E8 (1000, BE) ama tel yalnız 3 bayt taşıyor — declared length gerçek veriyle tutarsız. */
const OVERSIZED_LENGTH_FRAME = Uint8Array.from([0x03, 0xe8, 0xaa]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-frame',
    name: `${TRANSLATION_KEY_PREFIX}.example.validFrame.name`,
    bytes: VALID_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.validFrame.description`,
    expectedValid: true,
  },
  {
    id: 'oversized-length',
    name: `${TRANSLATION_KEY_PREFIX}.example.oversizedLength.name`,
    bytes: OVERSIZED_LENGTH_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.oversizedLength.description`,
    expectedValid: false,
  },
];

export const lengthBasedProtocolPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: lengthBasedProtocolParser,
  encoder: { encode: encodeLengthBasedFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
