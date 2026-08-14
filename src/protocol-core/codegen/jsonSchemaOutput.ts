/**
 * Şemayı spec §9.6'nın **"AYNEN" işaretli** JSON biçimine geri yazan üretici
 * (spec §9.5 "Code Generation" → JSON Schema).
 *
 * ## Neden `JSON.stringify(schema, null, 2)` değil
 *
 * Üç ayrı sebep, üçü de biçimi bozardı:
 *
 * 1. **Anahtar sırası.** `JSON.stringify` nesnenin kendi anahtar sırasını
 *    yazar; o sıra şemayı kimin ürettiğine göre değişir (elle yazılmış obje,
 *    zod çıktısı, düzenleyicinin `{...field, length: 2}` ile ürettiği kopya).
 *    §9.6 "AYNEN" işaretli olduğundan sıra ÇIKTININ sözleşmesidir, bu yüzden
 *    her nesne aşağıda elle, sabit sırada kuruluyor.
 * 2. **Bayt dizileri.** `JSON.stringify` girintili modda diziyi satırlara
 *    böler; §9.6 ise `"startBytes": [170]` diye TEK SATIR yazıyor.
 * 3. **`enumValues` sırası.** Nesne anahtarları JS'te "tam sayı benzeri önce,
 *    artan" kuralıyla gezilir; negatif anahtarlar ekleme sırasında kalır.
 *    Çıktı deterministik olsun diye sayısal olarak sıralanıyor.
 *
 * ## Genişletme anahtarları nereye yazılır
 *
 * §9.6'da olmayan alanlar (`description`, `scale`, `condition`, iç içe
 * `fields`, …) her nesnede spec anahtarlarının **ardına** yazılır. Böylece
 * §9.6'nın anahtar dizisi hiç bölünmez: yalnız spec anahtarları taşıyan bir
 * şema için çıktı §9.6 ile bayt bayt aynı olur, genişletme kullanan şemada da
 * sıra deterministik kalır.
 *
 * Çıktı METİNdir; uygulama onu çalıştırmaz (spec §41 `eval` yasağı). Buradaki
 * metin `parseProtocolSchemaJson` ile geri okunabilir — gidiş-dönüş kayıpsızdır.
 */

import type {
  ProtocolFieldSchema,
  ProtocolFramingSchema,
  ProtocolSchema,
} from '@/protocol-core/schemas/protocolSchema';

import { toIdentifier } from './codegenSupport';
import { DEFAULT_INDENT } from './types';
import type { CodegenOptions, GeneratedArtifact } from './types';

/**
 * Yazılacak JSON'un ara gösterimi. `object` girdileri DİZİdir, çünkü anahtar
 * sırası burada korunması gereken bilgi; `Record` kullanmak onu kaybederdi.
 */
type JsonNode =
  | { readonly kind: 'scalar'; readonly text: string }
  /** Sayı dizisi: §9.6 bunları tek satır yazar (`[170]`). */
  | { readonly kind: 'numberRow'; readonly values: readonly number[] }
  | { readonly kind: 'object'; readonly entries: readonly JsonEntry[] }
  | { readonly kind: 'list'; readonly items: readonly JsonNode[] };

interface JsonEntry {
  readonly key: string;
  readonly node: JsonNode;
}

function stringNode(value: string): JsonNode {
  // Kaçışları elle yazmak yerine JSON.stringify: tırnak, ters bölü, satır sonu
  // ve UTF-16 vekil çiftleri tek yerde doğru kaçar.
  return { kind: 'scalar', text: JSON.stringify(value) };
}

/**
 * JSON'da `Infinity`/`NaN` yoktur; `JSON.stringify` onları sessizce `null`a
 * çevirir ve o metin kendi doğrulayıcımızdan geri geçmez (`null` bir sayı
 * değil). Temsil edilemeyen sayıda üretimi durdurmak yerine anahtarı hiç
 * yazmıyoruz — gidiş-dönüş bozulmasın diye.
 */
function numberNode(value: number): JsonNode | undefined {
  return Number.isFinite(value) ? { kind: 'scalar', text: JSON.stringify(value) } : undefined;
}

function booleanNode(value: boolean): JsonNode {
  return { kind: 'scalar', text: value ? 'true' : 'false' };
}

function stringEntry(key: string, value: string | undefined): JsonEntry | undefined {
  return value === undefined ? undefined : { key, node: stringNode(value) };
}

function numberEntry(key: string, value: number | undefined): JsonEntry | undefined {
  if (value === undefined) {
    return undefined;
  }
  const node = numberNode(value);
  return node === undefined ? undefined : { key, node };
}

function booleanEntry(key: string, value: boolean | undefined): JsonEntry | undefined {
  return value === undefined ? undefined : { key, node: booleanNode(value) };
}

function numberRowEntry(key: string, values: readonly number[] | undefined): JsonEntry | undefined {
  return values === undefined ? undefined : { key, node: { kind: 'numberRow', values } };
}

function nodeEntry(key: string, node: JsonNode | undefined): JsonEntry | undefined {
  return node === undefined ? undefined : { key, node };
}

/** `undefined` girdileri düşer — böylece "verilmemiş alan yazılmaz" kuralı tek yerde. */
function objectNode(entries: readonly (JsonEntry | undefined)[]): JsonNode {
  return {
    kind: 'object',
    entries: entries.filter((entry): entry is JsonEntry => entry !== undefined),
  };
}

function enumValuesNode(enumValues: Readonly<Record<string, string>>): JsonNode {
  // Anahtarlar ondalık sayı METNİdir (§9.6: `"16": "Sensor Data"`), o yüzden
  // sözlük değil SAYISAL sıra doğru olan: "9" < "10". Eşitlikte (ör. "01" ile
  // "1") metin sırası ayırıyor ki gezinme sırasına bağlı çıktı kalmasın.
  const entries = Object.entries(enumValues).sort(
    ([left], [right]) => Number(left) - Number(right) || (left < right ? -1 : left > right ? 1 : 0),
  );
  return objectNode(entries.map(([key, label]) => stringEntry(key, label)));
}

function framingNode(framing: ProtocolFramingSchema): JsonNode {
  return objectNode([
    stringEntry('type', framing.type),
    numberRowEntry('startBytes', framing.startBytes),
    numberRowEntry('endBytes', framing.endBytes),
    numberEntry('maximumFrameLength', framing.maximumFrameLength),
  ]);
}

function fieldNode(field: ProtocolFieldSchema): JsonNode {
  const { condition, repeatCount, fields, defaultValue } = field;
  return objectNode([
    // — §9.6'nın anahtarları, §9.6'nın sırasıyla —
    stringEntry('id', field.id),
    stringEntry('name', field.name),
    stringEntry('type', field.type),
    numberEntry('offset', field.offset),
    numberEntry('length', field.length),
    stringEntry('lengthFrom', field.lengthFrom),
    nodeEntry('enumValues', field.enumValues === undefined ? undefined : enumValuesNode(field.enumValues)),
    stringEntry('algorithm', field.algorithm),
    nodeEntry(
      'coverage',
      field.coverage === undefined
        ? undefined
        : objectNode([
            stringEntry('startField', field.coverage.startField),
            stringEntry('endField', field.coverage.endField),
          ]),
    ),
    // — genişletmeler —
    stringEntry('description', field.description),
    booleanEntry('signed', field.signed),
    stringEntry('endianness', field.endianness),
    stringEntry('bitOrder', field.bitOrder),
    numberEntry('bitOffset', field.bitOffset),
    numberEntry('bitLength', field.bitLength),
    numberEntry('bitMask', field.bitMask),
    numberEntry('scale', field.scale),
    numberEntry('calibrationOffset', field.calibrationOffset),
    stringEntry('unit', field.unit),
    numberEntry('minimum', field.minimum),
    numberEntry('maximum', field.maximum),
    nodeEntry(
      'condition',
      condition === undefined
        ? undefined
        : objectNode([stringEntry('field', condition.field), numberEntry('equals', condition.equals)]),
    ),
    nodeEntry(
      'repeatCount',
      repeatCount === undefined
        ? undefined
        : typeof repeatCount === 'number'
          ? numberNode(repeatCount)
          : objectNode([stringEntry('fromField', repeatCount.fromField)]),
    ),
    // `structure`/`array` iç alanları: aynı sıra kuralı özyinelemeli uygulanır.
    nodeEntry('fields', fields === undefined ? undefined : { kind: 'list', items: fields.map(fieldNode) }),
    nodeEntry(
      'defaultValue',
      defaultValue === undefined
        ? undefined
        : typeof defaultValue === 'number'
          ? numberNode(defaultValue)
          : stringNode(defaultValue),
    ),
    numberEntry('color', field.color),
    stringEntry('documentation', field.documentation),
  ]);
}

function schemaNode(schema: ProtocolSchema): JsonNode {
  return objectNode([
    stringEntry('name', schema.name),
    stringEntry('version', schema.version),
    nodeEntry('framing', framingNode(schema.framing)),
    nodeEntry('fields', { kind: 'list', items: schema.fields.map(fieldNode) }),
    // — genişletmeler —
    stringEntry('description', schema.description),
    stringEntry('defaultEndianness', schema.defaultEndianness),
  ]);
}

function render(node: JsonNode, indent: string, depth: number): string {
  switch (node.kind) {
    case 'scalar':
      return node.text;
    case 'numberRow':
      return `[${node.values.join(', ')}]`;
    case 'object': {
      if (node.entries.length === 0) {
        return '{}';
      }
      const inner = indent.repeat(depth + 1);
      const body = node.entries
        .map((entry) => `${inner}${JSON.stringify(entry.key)}: ${render(entry.node, indent, depth + 1)}`)
        .join(',\n');
      return `{\n${body}\n${indent.repeat(depth)}}`;
    }
    case 'list': {
      if (node.items.length === 0) {
        return '[]';
      }
      const inner = indent.repeat(depth + 1);
      const body = node.items.map((item) => `${inner}${render(item, indent, depth + 1)}`).join(',\n');
      return `[\n${body}\n${indent.repeat(depth)}]`;
    }
  }
}

/**
 * Şemayı §9.6 biçiminde JSON metnine çevirir.
 *
 * `options.banner` bilerek YOK SAYILIR: JSON'da yorum söz dizimi yoktur ve
 * başlığı `$comment` gibi bir anahtara koymak §9.6'nın "AYNEN" biçimini
 * bozardı. Girinti `options.indent` ile değişir; varsayılan iki boşluk, yani
 * spec'in yazdığı biçim.
 *
 * Metin sonda satır sonu BIRAKMAZ — §9.6'nın gövdesiyle birebir kalsın diye;
 * dosyaya yazan taraf gerekiyorsa kendi `\n`ini ekler.
 */
export function generateJsonSchemaOutput(
  schema: ProtocolSchema,
  options?: CodegenOptions,
): GeneratedArtifact {
  return {
    id: 'json-schema',
    language: 'json',
    fileName: `${toIdentifier(schema.name, 'snake')}.protocol.json`,
    code: render(schemaNode(schema), options?.indent ?? DEFAULT_INDENT, 0),
  };
}
