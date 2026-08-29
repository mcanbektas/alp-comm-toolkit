/**
 * Kaydedilmiş paket şablonundan çerçeve üretimi — Packet Builder ile Test
 * Automation'ın ORTAK sınırı.
 *
 * ## Neden ayrı bir modül
 *
 * Şablon `PacketTemplate` olarak store'da METİN değerlerle durur; çerçeveye
 * çevirmek için şemayı çözmek, alanları çıkarmak ve metni `EncodeValues`a
 * dönüştürmek gerekir — yani `usePacketBuilder`ın yaptığı işin aynısı. Test
 * Automation koşucusu bunu bir React hook'undan çağıramaz. Mantık burada saf
 * ve senkron duruyor; iki taraf da aynı fonksiyonu çağırıyor, dolayısıyla
 * "Builder'da gördüğüm paket, testin gönderdiğinden farklı" sınıfı bir hata
 * yapısal olarak mümkün değil.
 *
 * ## Şema adı neden karşılaştırılıyor
 *
 * Şablon `schemaName` taşır ama şemanın KENDİSİNİ taşımaz (`projectFile.ts`).
 * Store'daki şema o günden beri değişmiş olabilir; alan kimlikleri artık
 * tutmuyorsa şablonun değerleri sessizce yok sayılır ve kabloya sıfırlarla
 * dolu bir çerçeve çıkardı. Ad tutmuyorsa üretim REDDEDİLİR — yanlış çerçeve
 * göndermektense hiç göndermemek doğru davranıştır.
 */

import type { PacketTemplate } from '@/features/projects/projectFile';
import { parseProtocolSchemaJson } from '@/protocol-core/schemas/protocolSchema';

import { toEncodeValues } from './formValues';
import { buildPacket, describeBuilderFields } from './packetPipeline';

export type TemplateFrameFailure =
  | 'template-not-found'
  | 'invalid-schema'
  | 'schema-mismatch'
  | 'invalid-values'
  | 'encode-failed';

export type TemplateFrameResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly reason: TemplateFrameFailure; readonly detail?: string };

/**
 * Şablonu çerçeveye çevirir.
 *
 * Post-processing UYGULANMAZ: şablon yalnız alan değerlerini taşır, taşıma
 * zarfı Builder'ın ekran durumudur ve şablona kaydedilmez. Zarf isteyen
 * senaryo `plugin-frame` kaynağını kullanır.
 */
export function encodeTemplateFrame(
  templateId: string,
  templates: readonly PacketTemplate[],
  schemaJson: string,
): TemplateFrameResult {
  const template = templates.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    return { ok: false, reason: 'template-not-found', detail: templateId };
  }

  const parsed = parseProtocolSchemaJson(schemaJson);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid-schema' };
  }

  if (parsed.schema.name !== template.schemaName) {
    return { ok: false, reason: 'schema-mismatch', detail: template.schemaName };
  }

  const fields = describeBuilderFields(parsed.schema);
  const { encodeValues, issues } = toEncodeValues(fields, template.values);
  if (issues.length > 0) {
    return { ok: false, reason: 'invalid-values', detail: issues.map((issue) => issue.fieldId).join(', ') };
  }

  const result = buildPacket(parsed.schema, encodeValues, { postProcessing: 'none' });
  if (result.framedBytes === null) {
    return { ok: false, reason: 'encode-failed', detail: result.issues.map((issue) => issue.messageKey).join(', ') };
  }

  return { ok: true, bytes: result.framedBytes };
}
