/**
 * Form METNİ ↔ `EncodeValues` dönüşümü — Packet Builder'ın saf sınır katmanı.
 *
 * `usePacketBuilder`dan ÇIKARILDI çünkü ikinci bir tüketicisi oldu: Test
 * Automation kaydedilmiş bir paket şablonunu çerçeveye çevirirken aynı
 * dönüşüme ihtiyaç duyuyor (`packetTemplates.ts`) ve bir React hook'unun
 * içinden çağrılamaz. Mantık DEĞİŞMEDİ, yalnız yer değiştirdi.
 *
 * Neden metin: kullanıcı "1.", "-" ya da boş girdi yazarken ara durum
 * kaybolmamalı. Sayıya çevirme tek bir sınırda, `buildPacket` çağrısından
 * hemen önce yapılır; çevrilemeyen değer İSTİSNA DEĞİL, sorun listesine düşen
 * bir kayıttır — form her tuş vuruşunda yeniden kodladığı için tek bir istisna
 * ekranı komple düşürürdü.
 */

import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import type { EncodeFieldValue, EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { fieldTypeInfo } from '@/protocol-core/schemas/fieldTypes';

import type { BuilderFieldDescriptor, PacketIssue } from './packetPipeline';

const INVALID_HEX_KEY = 'builder.error.invalidHex';
const INVALID_VALUE_KEY = 'builder.issue.invalidValue';

const SAFE_INTEGER_LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

/** Sayısal olmayan (kapsayıcı) alanların formda karşılığı yoktur. */
export function isFormField(field: BuilderFieldDescriptor): boolean {
  if (field.derived) {
    return false;
  }
  const kind = fieldTypeInfo(field.type).kind;
  return kind !== 'composite' && kind !== 'derived';
}

function clampToBounds(value: number, minimum: number | null, maximum: number | null): number {
  if (minimum !== null && value < minimum) return minimum;
  if (maximum !== null && value > maximum) return maximum;
  return value;
}

/**
 * Form açılış değerleri. Boş bırakmak yerine anlamlı bir başlangıç yazılıyor:
 * boş formda `buildPacket` de çalışır ama kullanıcı "neden hiçbir şey
 * göremiyorum" sorusuyla karşılaşır. Enum ilk anahtarına, boolean kapalıya,
 * sayısal alan sınır içindeki 0'a düşer.
 */
export function initialValues(fields: readonly BuilderFieldDescriptor[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    if (!isFormField(field)) {
      continue;
    }
    const kind = fieldTypeInfo(field.type).kind;

    if (kind === 'enum') {
      const firstKey = field.enumValues === null ? undefined : [...field.enumValues.keys()][0];
      values[field.path] = firstKey ?? '0';
      continue;
    }
    if (kind === 'boolean') {
      values[field.path] = 'false';
      continue;
    }
    if (kind === 'text' || kind === 'bytes') {
      values[field.path] = '';
      continue;
    }
    values[field.path] = String(clampToBounds(0, field.minimum, field.maximum));
  }

  return values;
}

/** Motorun döndürdüğü değeri forma yazılabilir metne çevirir. */
export function toText(value: EncodeFieldValue | undefined): string {
  if (value === undefined) return '';
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Sayısal metni değere çevirir; çevrilemiyorsa `undefined`.
 *
 * 2^53 üstü tamsayılar `bigint` olarak geçirilir (spec §47) — `Number`a
 * çevrilseydi uint64 bir alanda değer SESSİZCE yuvarlanırdı. Ölçekli alanlar
 * bunun dışında: `schemaEncoder` ölçeği yalnız `number` değerlere uygular,
 * `bigint` geçirmek kalibrasyonu atlardı.
 */
function toNumericValue(field: BuilderFieldDescriptor, text: string): number | bigint | undefined {
  const trimmed = text.trim();
  const unscaled = field.scale === null && field.calibrationOffset === null;

  if (unscaled && /^-?\d+$/.test(trimmed)) {
    const wide = BigInt(trimmed);
    if (wide > SAFE_INTEGER_LIMIT || wide < -SAFE_INTEGER_LIMIT) {
      return wide;
    }
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export interface ConversionResult {
  readonly encodeValues: EncodeValues;
  readonly issues: readonly PacketIssue[];
}

/**
 * Metin formu `EncodeValues`a çevirir. Çevrilemeyen alan kodlayıcıya HİÇ
 * geçirilmez ve yerine bir sorun üretilir: bozuk metni geçirmek kodlayıcının
 * kendi hata mesajını (yerelleştirilemez, ham) ekrana taşırdı.
 */
export function toEncodeValues(
  fields: readonly BuilderFieldDescriptor[],
  values: Readonly<Record<string, string>>,
): ConversionResult {
  const encodeValues: Record<string, EncodeFieldValue> = {};
  const issues: PacketIssue[] = [];

  for (const field of fields) {
    if (!isFormField(field)) {
      continue;
    }
    const text = values[field.path];
    if (text === undefined) {
      continue;
    }
    const kind = fieldTypeInfo(field.type).kind;

    if (kind === 'boolean') {
      encodeValues[field.path] = text === 'true';
      continue;
    }

    if (kind === 'text') {
      encodeValues[field.path] = text;
      continue;
    }

    if (kind === 'bytes') {
      try {
        encodeValues[field.path] = hexToBytes(text);
      } catch {
        // `hexToBytes` tek hane / alfabe dışı karakterde fırlatır; sınır katmanı burası.
        issues.push({ fieldId: field.path, messageKey: INVALID_HEX_KEY });
      }
      continue;
    }

    if (kind === 'enum') {
      // Form enum ANAHTARINI tutar; kullanıcı etiket yazdıysa kodlayıcı çözer
      // ve bilinmeyen etiket için kendi sorununu üretir.
      const numeric = Number(text);
      encodeValues[field.path] = text.trim() !== '' && Number.isFinite(numeric) ? numeric : text;
      continue;
    }

    // integer | float | bits | timestamp
    if (text.trim() === '') {
      // Boş alan bir HATA değil: kodlayıcı 0 yazar. Sorun üretmek, kullanıcı
      // alanı silip yeniden yazarken her tuşta kırmızı uyarı demek olurdu.
      continue;
    }
    const numeric = toNumericValue(field, text);
    if (numeric === undefined) {
      issues.push({ fieldId: field.path, messageKey: INVALID_VALUE_KEY, params: { detail: text } });
      continue;
    }
    encodeValues[field.path] = numeric;
  }

  return { encodeValues, issues };
}
