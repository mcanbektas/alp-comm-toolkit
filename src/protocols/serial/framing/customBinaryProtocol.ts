/**
 * Custom Binary Protocol — Faz 10 dalga 10e. `interfaces-framing/
 * framing-stream-protocols`nin son 4 "jenerik" kaydından biri: tek bir sabit
 * spec'i olan protokol DEĞİL, kullanıcı tanımlı bir SINIF (katalog kaydının
 * `definitions: ['custom-schema']`u). Karar (kullanıcı, 2026-08-21): şu 4
 * sayfa `ProtocolFramingSchema`yı (Protocol Studio/Packet Builder/Projects'in
 * de üstünde durduğu, spec §9.6'nın "AYNEN" kilitli tipi) GENİŞLETMEZ —
 * `parseWithSchema`nın zaten desteklediği 5 framing türünden biri yetiyorsa
 * (bu sayfada `'startEnd'`) doğrudan kullanılır, 15 yöntemlik framing
 * motoruna hiç uğranmaz.
 *
 * **Şema/çerçeve YENİDEN TASARLANMADI — `specFixture.ts`ten AYNEN alındı:**
 * `SPEC_SENSOR_PROTOCOL`/`SPEC_SENSOR_FRAME`, spec §8.3 (canlı mesaj), §9.6
 * ("AYNEN" işaretli şema JSON'u) ve §43 (kabul fixture'ı) arasında ÇAPRAZ
 * DOĞRULANMIŞ tek kaynak — Protocol Studio'nun kendi varsayılan örneği de bu.
 * `ProtocolPage.tsx`nin motor'u OLMAYAN protokoller için gösterdiği geçici
 * `SAMPLE_FRAME_BYTES` placeholder'ı da AYNI çerçeve — bu plugin devreye
 * girince o geçici yol artık bu protokolü hiç görmeyecek (dosyanın kendi
 * yorumu: "motoru olan protokol bu sabiti hiç görmez").
 */

import { encodeWithSchema } from '@/protocol-core/encoding/schemaEncoder';
import type { EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { createSchemaParser } from '@/protocol-core/decoding/schemaParser';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import type { ExampleFrame, ProtocolPlugin } from '@/protocol-core/types';

const PROTOCOL_ID = 'custom-binary-protocol';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Custom Binary Protocol';

const TRANSLATION_KEY_PREFIX = 'protocol.customBinaryProtocol';

export const customBinaryProtocolParser = createSchemaParser(SPEC_SENSOR_PROTOCOL);

function encodeCustomBinaryFrame(values: EncodeValues): Uint8Array {
  const result = encodeWithSchema(SPEC_SENSOR_PROTOCOL, values);
  if (!result.success) {
    throw new Error(`encodeCustomBinaryFrame: ${result.issues.map((issue) => issue.message).join('; ')}`);
  }
  return result.bytes;
}

// ── Örnekler ───────────────────────────────────────────────────────────

/** `DecodePanel.test.tsx`teki bozuk-checksum çerçevesiyle AYNI bayt (0x4F→0x50) — ayrı bir değer uydurmak yerine var olan doğrulanmış vektör tekrar kullanıldı. */
const CORRUPTED_CHECKSUM_FRAME = Uint8Array.from(SPEC_SENSOR_FRAME);
CORRUPTED_CHECKSUM_FRAME[7] = 0x50;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'sensor-data',
    // Spec §43'ün kabul çerçevesi — Address=5, Command=Sensor Data, Payload=34 12 7F, Checksum PASS.
    name: `${TRANSLATION_KEY_PREFIX}.example.sensorData.name`,
    bytes: SPEC_SENSOR_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.sensorData.description`,
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    // Aynı çerçeve, yalnız checksum baytı bozuk (0x4F → 0x50).
    name: `${TRANSLATION_KEY_PREFIX}.example.checksumMismatch.name`,
    bytes: CORRUPTED_CHECKSUM_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.checksumMismatch.description`,
    expectedValid: false,
  },
];

export const customBinaryProtocolPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: customBinaryProtocolParser,
  encoder: { encode: encodeCustomBinaryFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
