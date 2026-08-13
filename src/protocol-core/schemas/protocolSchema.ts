/**
 * Kullanıcı tanımlı protokol şeması — spec §9.6'daki JSON biçiminin tip
 * karşılığı ve zod doğrulayıcısı.
 *
 * ## Biçim spec'ten nerede AYNEN alındı, nerede genişletildi
 *
 * §9.6'nın örneği "AYNEN" işaretli, dolayısıyla oradaki anahtar adları
 * DEĞİŞTİRİLEMEZ: `name`, `version`, `framing.{type,startBytes,endBytes,
 * maximumFrameLength}`, `fields[].{id,name,type,offset,length,lengthFrom,
 * enumValues,algorithm,coverage.{startField,endField}}`.
 *
 * §9.1 ise `array`, `structure`, "Conditional field", "Repeat count" gibi
 * yetenekleri ADIYLA sayıyor ama §9.6 örneğinde bunların söz dizimi yok.
 * Aşağıdaki anahtarlar o boşluğu dolduran GENİŞLETMEdir ve README'nin
 * "Protocol Definition Format" bölümünde belgelenir:
 * `fields` (iç içe yapı), `repeatCount`, `condition`, `bitOffset`/`bitLength`,
 * `bitOrder`, `defaultValue`, `color`.
 *
 * ## `offset` adının iki anlamı
 *
 * Spec §9.1 "Offset"i iki ayrı şey için kullanıyor: çerçevedeki bayt konumu ve
 * fiziksel değer formülündeki kalibrasyon sabiti. §9.6'nın teli `offset`i BAYT
 * KONUMU için kullandığından o ad korundu; kalibrasyon sabiti ayrı bir adla,
 * `calibrationOffset` ile taşınır. Aynı adı iki anlama vermek, spec'in kendi
 * "dikkat çekenler" bölümünde de risk olarak işaretlenmiş.
 *
 * ## Güvenlik
 *
 * Şema VERİDİR, kod değildir. Spec §41 `eval`i ve dinamik kod çalıştırmayı
 * yasaklıyor; bu yüzden koşullar ve uzunluk bağımlılıkları serbest ifade değil,
 * bildirimsel alan referanslarıdır. Şemadan üretilen C/Python/TS ayrıştırıcıları
 * kullanıcının kopyalayacağı METİN çıktılarıdır — uygulama onları çalıştırmaz.
 */

import { z } from 'zod';

import { CHECKSUM_ALGORITHMS } from '../checksums/algorithmCatalogue';
// Bu iki tipin KANONİK tanımı başka modüllerde; burada yeniden tanımlamak
// toplu dışa aktarımda ad çakışması yaratır ve iki tanım zamanla ayrışır.
import type { BitOrder } from '../decoding/bitCursor';
import type { Endianness } from '../encoding/ieee754';
import { FIELD_TYPES } from './fieldTypes';

/** Koşullu alan: yalnız başka bir alan belirli bir değerdeyse çözümlenir. */
export interface FieldCondition {
  readonly field: string;
  readonly equals: number;
}

/** Checksum kapsamı — bayt ofseti değil, ALAN KİMLİĞİ aralığı (spec §9.6). */
export interface ChecksumCoverage {
  readonly startField: string;
  readonly endField: string;
}

/** Sabit sayı ya da başka bir alanın değerinden gelen tekrar sayısı. */
export type RepeatCount = number | { readonly fromField: string };

export interface ProtocolFieldSchema {
  readonly id: string;
  readonly name: string;
  readonly type: (typeof FIELD_TYPES)[number];
  readonly description?: string;

  /**
   * Çerçeve başından itibaren BAYT KONUMU. Verilmezse alan, kendinden önceki
   * alanın bittiği yerden başlar — dinamik uzunluklu bir alandan sonra gelen
   * alanın konumu zaten önceden bilinemez (spec §9.6'da `checksum` alanının
   * `offset` taşımamasının sebebi budur).
   */
  readonly offset?: number;
  readonly length?: number;
  /** Uzunluğu bu kimlikteki alanın DEĞERİNDEN alır. */
  readonly lengthFrom?: string;

  readonly signed?: boolean;
  readonly endianness?: Endianness;
  readonly bitOrder?: BitOrder;
  /** `bitField` için: alanın başladığı bit (bayt sınırını aşabilir). */
  readonly bitOffset?: number;
  readonly bitLength?: number;
  readonly bitMask?: number;

  /** Fiziksel değer = ham × scale + calibrationOffset (spec §9.2). */
  readonly scale?: number;
  readonly calibrationOffset?: number;
  readonly unit?: string;
  readonly minimum?: number;
  readonly maximum?: number;

  /** Anahtarlar ondalık sayı METNİdir (spec §9.6: `"16": "Sensor Data"`). */
  readonly enumValues?: Readonly<Record<string, string>>;

  /** `checksum`/`crc` alanları için. */
  readonly algorithm?: (typeof CHECKSUM_ALGORITHMS)[number];
  readonly coverage?: ChecksumCoverage;

  readonly condition?: FieldCondition;
  readonly repeatCount?: RepeatCount;
  /** `structure` ve `array` için iç alanlar. */
  readonly fields?: readonly ProtocolFieldSchema[];

  readonly defaultValue?: number | string;
  /** Bayt görüntüleyicideki renk kuşağı (0..3). */
  readonly color?: number;
  readonly documentation?: string;
}

export interface ProtocolFramingSchema {
  readonly type: 'startEnd' | 'startOnly' | 'fixedLength' | 'lengthField' | 'none';
  readonly startBytes?: readonly number[];
  readonly endBytes?: readonly number[];
  readonly maximumFrameLength: number;
}

export interface ProtocolSchema {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  /** Alan başına yazılmadıysa geçerli olan bayt sırası. Verilmezse big-endian. */
  readonly defaultEndianness?: Endianness;
  readonly framing: ProtocolFramingSchema;
  readonly fields: readonly ProtocolFieldSchema[];
}

const byteValue = z.number().int().min(0).max(255);

const conditionSchema = z.object({
  field: z.string().min(1),
  equals: z.number().int(),
});

const coverageSchema = z.object({
  startField: z.string().min(1),
  endField: z.string().min(1),
});

const repeatCountSchema = z.union([
  z.number().int().min(0),
  z.object({ fromField: z.string().min(1) }),
]);

/**
 * `z.lazy` şart: `structure`/`array` alanları kendi tiplerini içerir. Dönüş
 * tipi elle yazılmalı, yoksa TypeScript özyinelemeli çıkarımda tükenir.
 */
const fieldSchema: z.ZodType<ProtocolFieldSchema> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    description: z.string().optional(),

    offset: z.number().int().min(0).optional(),
    length: z.number().int().min(0).optional(),
    lengthFrom: z.string().min(1).optional(),

    signed: z.boolean().optional(),
    endianness: z.enum(['big', 'little']).optional(),
    bitOrder: z.enum(['msb-first', 'lsb-first']).optional(),
    bitOffset: z.number().int().min(0).optional(),
    bitLength: z.number().int().min(1).optional(),
    bitMask: z.number().int().min(0).optional(),

    scale: z.number().optional(),
    calibrationOffset: z.number().optional(),
    unit: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),

    // Anahtar ondalık sayı metni olmalı; "0x10" ya da "abc" kabul edilmez —
    // §9.6 örneği ondalık kullanıyor ve iki gösterimi karıştırmak enum
    // eşleşmesini sessizce kaçırırdı.
    enumValues: z.record(z.string().regex(/^-?\d+$/), z.string()).optional(),

    algorithm: z.enum(CHECKSUM_ALGORITHMS).optional(),
    coverage: coverageSchema.optional(),

    condition: conditionSchema.optional(),
    repeatCount: repeatCountSchema.optional(),
    fields: z.array(fieldSchema).optional(),

    defaultValue: z.union([z.number(), z.string()]).optional(),
    color: z.number().int().min(0).max(3).optional(),
    documentation: z.string().optional(),
  }),
);

const framingSchema = z.object({
  type: z.enum(['startEnd', 'startOnly', 'fixedLength', 'lengthField', 'none']),
  startBytes: z.array(byteValue).optional(),
  endBytes: z.array(byteValue).optional(),
  maximumFrameLength: z.number().int().min(1),
});

export const protocolSchemaValidator: z.ZodType<ProtocolSchema> = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  defaultEndianness: z.enum(['big', 'little']).optional(),
  framing: framingSchema,
  fields: z.array(fieldSchema).min(1),
});

export interface SchemaParseIssue {
  /** Nokta ile ayrılmış yol, ör. `fields.2.length`. */
  readonly path: string;
  readonly message: string;
}

export type SchemaParseResult =
  | { readonly success: true; readonly schema: ProtocolSchema }
  | { readonly success: false; readonly issues: readonly SchemaParseIssue[] };

/**
 * Güvenilmeyen JSON'u şemaya çevirir. **İçeriğe güvenmez**: dosya kullanıcıdan
 * ya da paylaşılan bir projeden gelir (spec §40 "Import sırasında: Schema
 * validation, Version check, Migration, Error handling").
 *
 * Bu yalnız BİÇİM doğrulamasıdır; alanlar arası tutarlılık (döngüsel uzunluk
 * referansı, geçersiz kapsam kimliği, çakışan ofset) `validation/` katmanının
 * işidir — biri "JSON doğru şekilli mi", diğeri "protokol anlamlı mı" sorusunu
 * yanıtlar ve ikisi ayrı ayrı raporlanmalı.
 */
export function parseProtocolSchema(input: unknown): SchemaParseResult {
  const result = protocolSchemaValidator.safeParse(input);
  if (result.success) {
    return { success: true, schema: result.data };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/** JSON metnini çözer ve doğrular; bozuk JSON da bir doğrulama sorunudur. */
export function parseProtocolSchemaJson(text: string): SchemaParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch (cause) {
    return {
      success: false,
      issues: [{ path: '', message: cause instanceof Error ? cause.message : String(cause) }],
    };
  }
  return parseProtocolSchema(decoded);
}
