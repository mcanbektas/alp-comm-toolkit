/**
 * Şemadan Python 3 ayrıştırıcı üretir — spec §9.5'in "Python parser" çıktısı.
 *
 * Üretilen şey METİNdir; uygulama bunu ASLA çalıştırmaz (spec §41 `eval` ve
 * dinamik kod çalıştırma yasağı). Kullanıcı çıktıyı kopyalar ya da indirir,
 * kendi projesinde derler/koşar. Bu yüzden burada "doğru çalışan kod" değil,
 * "doğru okunan ve doğru derlenen metin" üretmek hedeftir.
 *
 * ## Neden bu biçim
 *
 * - **`@dataclass` + saf fonksiyon**: üretilen ayrıştırıcı bir sınıf hiyerarşisi
 *   değil, `parse(data) -> <Sınıf>` biçiminde tek girişli saf bir işlev. Böylece
 *   kullanıcı çıktıyı kendi akışına gömerken durum yönetmek zorunda kalmaz.
 * - **İç içe yapı = ayrı fonksiyon**: her `structure`/`array` için
 *   `_parse_x(data, offset) -> tuple[X, int]` üretilir. İmleci (offset) döndürmek
 *   zorunlu, çünkü dinamik uzunluklu bir alandan sonraki alanın konumu ancak
 *   çalışma zamanında bilinir.
 * - **`from __future__ import annotations`**: `tuple[X, int]` ve `list[X]` gibi
 *   açıklamalar Python 3.9 öncesinde çalışma zamanında hata verir; `annotations`
 *   ile açıklamalar METİN olarak kalır ve çıktı 3.7'den itibaren çalışır.
 *   `dataclasses` da açıklamayı değerlendirmez, yalnız `ClassVar`/`InitVar`
 *   metnine bakar — bu yüzden bu düzen güvenlidir.
 *
 * ## Bilinçli sınırlar
 *
 * - `lengthFrom`, `condition` ve `repeatCount` referansları YALNIZ aynı kapsamda
 *   (aynı üretilen fonksiyonda) çözülür. Dış kapsamdaki bir alana bakan referans
 *   ayrı bir fonksiyonun yerel değişkenine bakmak olurdu; bu durumda üretim
 *   durmaz, çıktıya UYARI yorumu ve makul bir geri düşüş yazılır.
 * - Checksum kapsamı (`coverage`) yalnız checksum alanının KARDEŞLERİ arasında
 *   aranır; dizi içindeki bir alana bakan kapsam doğrulanamaz (dizide her yineleme
 *   ofseti ezerdi), o durumda doğrulama üretilmez ve sebebi yoruma yazılır.
 * - Satır uzunluğu 100 sınırı, makul uzunluktaki alan adları için geçerlidir:
 *   imza ve çağrı satırları sarmalanır ama tek bir tanımlayıcı 100 karakteri
 *   aşarsa bölünemez.
 */

import {
  CHECKSUM_ALGORITHMS,
  isSimpleChecksumAlgorithm,
} from '@/protocol-core/checksums/algorithmCatalogue';
import type {
  ChecksumAlgorithm,
  SimpleChecksumAlgorithm,
} from '@/protocol-core/checksums/algorithmCatalogue';
import { CRC_CATALOGUE } from '@/protocol-core/checksums/crcCatalogue';
import type { CrcParams } from '@/protocol-core/checksums/crcEngine';
import type { FieldType } from '@/protocol-core/schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import {
  bannerFor,
  fieldByteLength,
  indentLines,
  isAggregateField,
  pythonTypeFor,
  toIdentifier,
  toUniqueIdentifiers,
} from './codegenSupport';
import type { CodegenOptions, GeneratedArtifact } from './types';

/**
 * PEP 8 girintisi DÖRT boşluktur; ortak `DEFAULT_INDENT` (iki boşluk) Python'da
 * yanlış olur. Kullanıcı `options.indent` verirse ona uyulur — çıktının kendi
 * projesinin biçimlendiricisiyle uyuşması ondan daha önemli.
 */
const PYTHON_INDENT = '    ';

/** PEP 8'in "79" tavsiyesi yerine yaygın modern sınır; görev metni de bunu istiyor. */
const MAX_LINE_LENGTH = 100;

const BITS_PER_BYTE = 8;

/**
 * Ayrılmış sözcükler. `toIdentifier` bunlardan kaçınmaz (hedef dil onun işi
 * değil); `class` adlı bir alan burada `class_` olur.
 */
const PYTHON_KEYWORDS: ReadonlySet<string> = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

/**
 * Üretilen fonksiyonun içinde ADI TUTULU olan isimler: parametreler ve üretilen
 * kodun çağırdığı yerleşikler. Alan adı bunlardan biriyse yerel değişken
 * `data_2` olur — sınıf ÖZNİTELİĞİ ise `data` kalır, çünkü öznitelik `self.`
 * altında yaşar ve hiçbir şeyi gölgelemez. İki ad uzayı bilerek ayrı tutuluyor.
 */
const RESERVED_LOCALS: readonly string[] = [
  'bool',
  'bytes',
  'data',
  'enum',
  'float',
  'int',
  'len',
  'offset',
  'range',
  'result',
  'str',
  'struct',
  'sum',
];

/** `struct` biçim karakteri olan tipler; gerisi `int.from_bytes`/dilim ile okunur. */
const STRUCT_FORMATS: Readonly<Partial<Record<FieldType, string>>> = {
  uint8: 'B',
  int8: 'b',
  uint16: 'H',
  int16: 'h',
  uint32: 'I',
  int32: 'i',
  uint64: 'Q',
  int64: 'q',
  float16: 'e',
  float32: 'f',
  float64: 'd',
  boolean: '?',
  unixTimestamp: 'I',
  dateTime: 'Q',
};

const STRUCT_SIZES: Readonly<Record<string, number>> = {
  B: 1,
  b: 1,
  '?': 1,
  H: 2,
  h: 2,
  e: 2,
  I: 4,
  i: 4,
  f: 4,
  Q: 8,
  q: 8,
  d: 8,
};

/** Genişliği ne şemadan ne tipten okunabilen alanlarda son çare. */
const FALLBACK_BYTE_LENGTH = 1;

// --- Ad üretimi ---------------------------------------------------------

type Allocator = (base: string) => string;

/**
 * Çakışmasız ad dağıtıcısı. `toUniqueIdentifiers` kardeş alan adlarını zaten
 * teklileştiriyor; bu dağıtıcı ONUN ÜSTÜNE binen çakışmaları çözer: ayrılmış
 * sözcük kaçışının doğurduğu yeni ad (`class` → `class_`) ve türetilmiş adların
 * (özellik, işaretçi değişkeni) alan adlarıyla karşılaşması.
 */
function createAllocator(reserved: readonly string[]): Allocator {
  const used = new Set<string>(reserved);
  return (base: string): string => {
    const safe = PYTHON_KEYWORDS.has(base) ? `${base}_` : base;
    let candidate = safe;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${safe}_${counter}`;
      counter += 1;
    }
    used.add(candidate);
    return candidate;
  };
}

// --- Metin yardımcıları -------------------------------------------------

/** Yorum/docstring'e girecek metinde satır sonu olamaz. */
function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function wrapText(text: string, width: number): string[] {
  const words = singleLine(text).split(' ').filter((word) => word !== '');
  if (words.length === 0) {
    return [''];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current === '') {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`;
  }
  lines.push(current);
  return lines;
}

/**
 * Docstring bloğu. Tek satıra sığıyorsa `"""metin"""`, sığmıyorsa açılış ve
 * kapanış tırnakları ayrı satırda — ikisi de PEP 257'ye uygun.
 */
function docstringBlock(text: string, availableWidth: number): string[] {
  const width = Math.max(availableWidth - 6, 20);
  const wrapped = wrapText(text, width);
  const first = wrapped[0] ?? '';
  if (wrapped.length === 1) {
    return [`"""${first}"""`];
  }
  return ['"""', ...wrapped, '"""'];
}

function commentBlock(text: string, availableWidth: number): string[] {
  return wrapText(text, Math.max(availableWidth - 2, 20)).map((line) => `# ${line}`);
}

/**
 * Fonksiyon imzası. 100 karaktere sığmayan imza parametre başına bir satıra
 * açılır (black'in "magic trailing comma" biçimi).
 */
function functionSignature(
  name: string,
  parameters: readonly string[],
  returnType: string,
  indent: string,
): string[] {
  const oneLine = `def ${name}(${parameters.join(', ')}) -> ${returnType}:`;
  if (oneLine.length <= MAX_LINE_LENGTH) {
    return [oneLine];
  }
  return [
    `def ${name}(`,
    ...parameters.map((parameter) => `${indent}${parameter},`),
    `) -> ${returnType}:`,
  ];
}

function pythonBool(value: boolean): string {
  return value ? 'True' : 'False';
}

function pythonHex(value: bigint, bitWidth?: number): string {
  const digits = bitWidth === undefined ? 1 : Math.ceil(bitWidth / 4);
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/**
 * Sayıyı Python değişmezine çevirir. Tam sayılara `.0` eklenir: `scale = 2`
 * verildiğinde çıktının tam sayı bölmesi gibi okunmaması, fiziksel değerin her
 * zaman `float` olması için.
 */
function pythonNumber(value: number): string {
  const text = String(value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

// --- Şema okuma ---------------------------------------------------------

function byteOrderOf(field: ProtocolFieldSchema, schema: ProtocolSchema): 'big' | 'little' {
  // Alan kendi sırasını yazmadıysa şemanın varsayılanı, o da yoksa big-endian
  // (ağ sırası) — `protocolSchema.ts` bu varsayılanı belgeliyor.
  return field.endianness ?? schema.defaultEndianness ?? 'big';
}

function structPrefix(field: ProtocolFieldSchema, schema: ProtocolSchema): string {
  return byteOrderOf(field, schema) === 'little' ? '<' : '>';
}

function byteOrderLiteral(field: ProtocolFieldSchema, schema: ProtocolSchema): string {
  return `"${byteOrderOf(field, schema)}"`;
}

/**
 * Alanın CRC parametreleri; basit checksum'larda ve `none`'da `undefined`.
 * Daraltma `isSimpleChecksumAlgorithm` ile yapılıyor — `as` dönüşümü kullanmadan
 * `CRC_CATALOGUE` anahtarına inmenin tek tip-güvenli yolu bu, ve katalog
 * büyüdüğünde elle bakımı gereken bir `case` listesi bırakmaz.
 */
function crcParamsFor(algorithm: ChecksumAlgorithm): CrcParams | undefined {
  if (algorithm === 'none' || isSimpleChecksumAlgorithm(algorithm)) {
    return undefined;
  }
  return CRC_CATALOGUE[algorithm];
}

/** Basit algoritmanın üretilen modüldeki yardımcı adı. Sabit tablo, şablon değil. */
const SIMPLE_HELPER_NAMES: Readonly<Record<SimpleChecksumAlgorithm, string>> = {
  xor8: '_xor8',
  sum8: '_sum8',
  lrc: '_lrc',
  nmeaXor: '_nmea_xor',
  fletcher16: '_fletcher16',
  fletcher32: '_fletcher32',
  adler32: '_adler32',
};

/** Bit alanının kapsadığı bayt sayısı; `bitLength` yoksa 1 bit varsayılır. */
function bitFieldGeometry(field: ProtocolFieldSchema): {
  readonly bitOffset: number;
  readonly bitLength: number;
  readonly byteLength: number;
} {
  const bitOffset = field.bitOffset ?? 0;
  const bitLength = field.bitLength ?? 1;
  return {
    bitOffset,
    bitLength,
    byteLength: Math.ceil((bitOffset + bitLength) / BITS_PER_BYTE),
  };
}

// --- Plan ---------------------------------------------------------------

interface EnumEntry {
  readonly memberName: string;
  readonly value: string;
}

interface EnumPlan {
  readonly className: string;
  readonly fieldName: string;
  readonly entries: readonly EnumEntry[];
}

interface PhysicalProperty {
  readonly kind: 'physical';
  readonly name: string;
  readonly expression: string;
  readonly doc: string;
}

interface LabelProperty {
  readonly kind: 'label';
  readonly name: string;
  readonly attribute: string;
  readonly enumClass: string;
  readonly doc: string;
}

type PropertyPlan = PhysicalProperty | LabelProperty;

interface AttributePlan {
  readonly field: ProtocolFieldSchema;
  /** Dataclass özniteliği (`self.<attribute>`). */
  readonly attribute: string;
  /** Ayrıştırma fonksiyonundaki yerel değişken. */
  readonly local: string;
  readonly annotation: string;
  /** `structure`/`array` alanının iç sınıfı. */
  readonly child?: ClassPlan;
  /** Dizi döngüsünde tek elemanı tutan yerel değişken. */
  readonly elementLocal?: string;
  readonly enumClass?: string;
  /** Checksum kapsamı bu alandan BAŞLIYORSA konumu tutan yerel değişken. */
  readonly startMarker?: string;
  /** Checksum kapsamı bu alanda BİTİYORSA bitiş konumunu tutan yerel değişken. */
  readonly endMarker?: string;
  /** Checksum doğrulamasının beklenen değeri için yerel değişken. */
  readonly expectedLocal?: string;
}

interface ClassPlan {
  readonly className: string;
  readonly functionName: string;
  readonly doc: string;
  readonly attributes: readonly AttributePlan[];
  readonly properties: readonly PropertyPlan[];
  /**
   * Dizi elemanının içinde miyiz: öyleyse şemadaki MUTLAK `offset` değerleri
   * yok sayılır, konum imleçten yürür. Her yineleme aynı mutlak ofsete atlasaydı
   * dizi tek elemanı tekrar tekrar okurdu.
   */
  readonly withinArray: boolean;
  /** Aynı kapsamdaki alan kimliği → yerel değişken. */
  readonly localByFieldId: ReadonlyMap<string, string>;
}

/** Hangi yardımcı fonksiyonların üretileceği; kullanılmayan yazılmaz. */
interface HelperUsage {
  bcd: boolean;
  crc: boolean;
  /**
   * Kullanılan basit (CRC olmayan) algoritmalar. Algoritma başına ayrı bir
   * `boolean` yerine küme: katalog büyüdükçe alan eklemek gerekmesin ve
   * "eklendi ama yazılmadı" hâli olmasın. Yazım sırası kümenin gezinme
   * sırasından DEĞİL, `CHECKSUM_ALGORITHMS`ten alınır — çıktı deterministik.
   */
  readonly simple: Set<SimpleChecksumAlgorithm>;
}

interface PlanContext {
  readonly schema: ProtocolSchema;
  readonly allocateModuleName: Allocator;
  readonly enums: EnumPlan[];
  readonly helpers: HelperUsage;
  readonly errorClass: string;
}

/** Enum üyeleri sayısal değere göre sıralanır — nesne anahtar sırasına güvenilmez. */
function planEnum(
  field: ProtocolFieldSchema,
  className: string,
): EnumPlan | undefined {
  const values = field.enumValues;
  if (values === undefined) {
    return undefined;
  }
  const pairs = Object.entries(values)
    .map(([key, label]) => ({ key, label, numeric: Number(key) }))
    .sort((left, right) => left.numeric - right.numeric);
  if (pairs.length === 0) {
    return undefined;
  }
  // Üye adları BÜYÜK harf: `Enum` sınıfında `name` ve `value` adlı üye tanımlamak
  // TypeError verir, büyük harfe çevirmek bu tuzağı tümüyle kapatır.
  const memberNames = toUniqueIdentifiers(
    pairs.map((pair) => pair.label),
    'snake',
  ).map((name) => name.toUpperCase());
  const entries: EnumEntry[] = [];
  for (const [index, pair] of pairs.entries()) {
    entries.push({ memberName: memberNames[index] ?? `VALUE_${index}`, value: pair.key });
  }
  return { className, fieldName: singleLine(field.name), entries };
}

function planPhysicalProperty(
  field: ProtocolFieldSchema,
  attribute: string,
  propertyName: string,
): PhysicalProperty | undefined {
  const scale = field.scale;
  const calibration = field.calibrationOffset;
  if (scale === undefined && calibration === undefined) {
    return undefined;
  }
  if ((scale !== undefined && !Number.isFinite(scale)) ||
    (calibration !== undefined && !Number.isFinite(calibration))) {
    // NaN/Infinity Python'da `nan`/`inf` diye yazılırdı; şema hatasını sessizce
    // çalışan koda çevirmektense özellik hiç üretilmez.
    return undefined;
  }

  let expression = `self.${attribute}`;
  const parts: string[] = [];
  if (scale !== undefined && scale !== 1) {
    expression = `${expression} * ${pythonNumber(scale)}`;
    parts.push(`× ${pythonNumber(scale)}`);
  }
  if (calibration !== undefined && calibration !== 0) {
    const sign = calibration < 0 ? '-' : '+';
    const magnitude = pythonNumber(Math.abs(calibration));
    expression = `${expression} ${sign} ${magnitude}`;
    parts.push(`${sign} ${magnitude}`);
  }
  if (parts.length === 0) {
    // `scale: 1` + `calibrationOffset: 0`: dönüşüm yok ama kullanıcı fiziksel
    // değeri açıkça istemiş; `float()` en azından tipi sabitler.
    expression = `float(${expression})`;
  }
  const unit = field.unit === undefined ? '' : ` (${singleLine(field.unit)})`;
  return {
    kind: 'physical',
    name: propertyName,
    expression,
    doc: `Fiziksel değer${unit}: ham ${parts.join(' ')}`.trim(),
  };
}

function annotationFor(field: ProtocolFieldSchema, base: string): string {
  // Koşullu alan çerçevede HİÇ bulunmayabilir; `None` bunu tip düzeyinde söyler.
  return field.condition === undefined ? base : `Optional[${base}]`;
}

/**
 * İç içe bir `structure`ın alanlarını DIŞ kapsamdan erişilebilir yollar olarak
 * kaydeder: `header.item_count`.
 *
 * Buna neden gerek var: "sayaç başlıkta, dizi dışarıda" en yaygın protokol
 * düzeni ve `repeatCount.fromField` iç alanın kimliğini gösteriyor. İç yapı ayrı
 * bir fonksiyonda çözümlendiği için o fonksiyonun YEREL değişkeni dışarıdan
 * görünmez — ama çözümlenmiş NESNE görünür, referans onun üstünden bağlanır.
 *
 * `array` içine girilmez: dizinin her yinelemesi ayrı bir nesnedir, tek bir
 * yolla gösterilemez.
 */
function registerNestedPaths(
  child: ClassPlan,
  prefix: string,
  target: Map<string, string>,
): void {
  for (const attribute of child.attributes) {
    const path = `${prefix}.${attribute.attribute}`;
    if (!target.has(attribute.field.id)) {
      target.set(attribute.field.id, path);
    }
    if (attribute.child !== undefined && attribute.field.type !== 'array') {
      registerNestedPaths(attribute.child, path, target);
    }
  }
}

/**
 * Bir kapsamın (kök şema, `structure` ya da dizi elemanı) sınıf planını kurar.
 * Ad dağıtımı burada bitirilir: gövde üretimi yalnız hazır adları dizer.
 */
function planClass(
  fields: readonly ProtocolFieldSchema[],
  className: string,
  functionName: string,
  doc: string,
  withinArray: boolean,
  context: PlanContext,
): ClassPlan {
  const attributeAllocator = createAllocator([]);
  const localAllocator = createAllocator(RESERVED_LOCALS);

  const baseNames = toUniqueIdentifiers(
    fields.map((field) => field.name),
    'snake',
  );
  const attributes: string[] = [];
  const locals: string[] = [];
  const localByFieldId = new Map<string, string>();
  for (const [index, field] of fields.entries()) {
    const base = baseNames[index] ?? toIdentifier(field.name, 'snake');
    const attribute = attributeAllocator(base);
    const local = localAllocator(base);
    attributes.push(attribute);
    locals.push(local);
    if (!localByFieldId.has(field.id)) {
      localByFieldId.set(field.id, local);
    }
  }

  // Kapsam işaretçileri: yalnız bir kardeş checksum'ın kapsamına giren alanlar
  // için üretilir, yoksa her alanın önüne ölü değişken yazılırdı.
  const coverageStarts = new Set<string>();
  const coverageEnds = new Set<string>();
  for (const field of fields) {
    const coverage = field.coverage;
    if (coverage === undefined) {
      continue;
    }
    coverageStarts.add(coverage.startField);
    coverageEnds.add(coverage.endField);
  }

  const plans: AttributePlan[] = [];
  for (const [index, field] of fields.entries()) {
    const attribute = attributes[index] ?? 'field';
    const local = locals[index] ?? 'value';

    let child: ClassPlan | undefined;
    let elementLocal: string | undefined;
    let annotation: string;

    if (isAggregateField(field)) {
      const isArray = field.type === 'array';
      const childClassName = context.allocateModuleName(
        `${toIdentifier(field.name, 'pascal')}${isArray ? 'Entry' : ''}`,
      );
      const childFunctionName = context.allocateModuleName(
        `_parse_${toIdentifier(field.name, 'snake')}${isArray ? '_entry' : ''}`,
      );
      child = planClass(
        field.fields ?? [],
        childClassName,
        childFunctionName,
        isArray
          ? `${singleLine(field.name)} dizisinin tek elemanı.`
          : `${singleLine(field.name)} yapısının alanları.`,
        withinArray || isArray,
        context,
      );
      elementLocal = isArray ? localAllocator(`${local}_entry`) : undefined;
      annotation = annotationFor(field, isArray ? `list[${childClassName}]` : childClassName);
      if (!isArray) {
        registerNestedPaths(child, local, localByFieldId);
      }
    } else {
      annotation = annotationFor(field, pythonTypeFor(field));
    }

    let enumClass: string | undefined;
    if (field.type === 'enum' && field.enumValues !== undefined) {
      const candidate = context.allocateModuleName(toIdentifier(field.name, 'pascal'));
      const enumPlan = planEnum(field, candidate);
      if (enumPlan !== undefined) {
        context.enums.push(enumPlan);
        enumClass = candidate;
      }
    }

    if (field.type === 'bcd') {
      context.helpers.bcd = true;
    }

    let expectedLocal: string | undefined;
    if (field.coverage !== undefined && field.algorithm !== undefined) {
      const params = crcParamsFor(field.algorithm);
      if (params !== undefined) {
        context.helpers.crc = true;
      } else if (isSimpleChecksumAlgorithm(field.algorithm)) {
        context.helpers.simple.add(field.algorithm);
      }
      if (field.algorithm !== 'none') {
        expectedLocal = localAllocator(`${local}_expected`);
      }
    }

    plans.push({
      field,
      attribute,
      local,
      annotation,
      ...(child === undefined ? {} : { child }),
      ...(elementLocal === undefined ? {} : { elementLocal }),
      ...(enumClass === undefined ? {} : { enumClass }),
      ...(coverageStarts.has(field.id) ? { startMarker: localAllocator(`${local}_start`) } : {}),
      ...(coverageEnds.has(field.id) ? { endMarker: localAllocator(`${local}_end`) } : {}),
      ...(expectedLocal === undefined ? {} : { expectedLocal }),
    });
  }

  // Özellik adları TÜM öznitelikler dağıtıldıktan sonra alınır: `x` alanının
  // `physical_x` özelliği, sonradan gelen "physical x" adlı bir alanla
  // çakışmasın (sıra tersine olsaydı özellik alanı ezerdi).
  const properties: PropertyPlan[] = [];
  for (const plan of plans) {
    const pythonType = isAggregateField(plan.field) ? 'composite' : pythonTypeFor(plan.field);
    if (pythonType === 'int' || pythonType === 'float') {
      const physical = planPhysicalProperty(
        plan.field,
        plan.attribute,
        attributeAllocator(`physical_${plan.attribute}`),
      );
      if (physical !== undefined) {
        properties.push(physical);
      }
    }
    if (plan.enumClass !== undefined) {
      properties.push({
        kind: 'label',
        name: attributeAllocator(`${plan.attribute}_label`),
        attribute: plan.attribute,
        enumClass: plan.enumClass,
        doc: `${singleLine(plan.field.name)} alanının enum etiketi; tanımsız değerde None.`,
      });
    }
  }

  return { className, functionName, doc, attributes: plans, properties, withinArray, localByFieldId };
}

// --- Uzunluk ve okuma ---------------------------------------------------

interface LengthExpression {
  readonly expression: string;
  /** Çıktıya yazılacak uyarı yorumu; şema çözülemeyen bir referans taşıyorsa. */
  readonly warning?: string;
}

function lengthExpressionFor(
  field: ProtocolFieldSchema,
  plan: ClassPlan,
  fallback: number,
): LengthExpression {
  if (field.lengthFrom !== undefined) {
    const source = plan.localByFieldId.get(field.lengthFrom);
    if (source !== undefined) {
      return { expression: source };
    }
    return {
      expression: 'len(data) - offset',
      warning: `UYARI: "${field.lengthFrom}" alanı bu kapsamda yok; uzunluk çerçeve sonuna kadar alındı.`,
    };
  }
  const staticLength = fieldByteLength(field);
  if (staticLength === null) {
    return {
      expression: String(fallback),
      warning: `UYARI: "${singleLine(field.name)}" alanının uzunluğu şemadan okunamadı; ${fallback} bayt varsayıldı.`,
    };
  }
  return { expression: String(staticLength) };
}

/** `offset + <uzunluk>` — sabit uzunlukta gereksiz parantez üretmemek için ayrı. */
function endOffsetExpression(length: string): string {
  return `offset + ${length}`;
}

function emitLeafRead(
  attributePlan: AttributePlan,
  plan: ClassPlan,
  context: PlanContext,
  indent: string,
): string[] {
  const { field, local } = attributePlan;
  const { schema } = context;
  const lines: string[] = [];

  const format = STRUCT_FORMATS[field.type];
  if (format !== undefined) {
    const size = STRUCT_SIZES[format] ?? FALLBACK_BYTE_LENGTH;
    lines.push(
      `_require(data, offset, ${size})`,
      `${local} = struct.unpack_from("${structPrefix(field, schema)}${format}", data, offset)[0]`,
      `offset += ${size}`,
    );
    return lines;
  }

  if (field.type === 'bitField') {
    const geometry = bitFieldGeometry(field);
    const rawLocal = `${local}_bits`;
    const mask = pythonHex((1n << BigInt(geometry.bitLength)) - 1n);
    // `msb-first`te bit 0 ilk baytın EN YÜKSEK bitidir: kapsanan baytlar
    // big-endian tek sayıya toplanır ve alan SAĞA kaydırılır. `lsb-first`te bit 0
    // ilk baytın en düşük bitidir; little-endian toplamada kaydırma doğrudan
    // `bitOffset` olur. Sıra yanlış seçilirse hata değil, YANLIŞ DEĞER çıkar.
    const lsbFirst = field.bitOrder === 'lsb-first';
    const shift = lsbFirst
      ? geometry.bitOffset
      : geometry.byteLength * BITS_PER_BYTE - geometry.bitOffset - geometry.bitLength;
    lines.push(
      `_require(data, offset, ${geometry.byteLength})`,
      `${rawLocal} = int.from_bytes(` +
        `data[offset:${endOffsetExpression(String(geometry.byteLength))}], ` +
        `"${lsbFirst ? 'little' : 'big'}")`,
      shift === 0 ? `${local} = ${rawLocal} & ${mask}` : `${local} = (${rawLocal} >> ${shift}) & ${mask}`,
      `offset += ${geometry.byteLength}`,
    );
    return lines;
  }

  const length = lengthExpressionFor(field, plan, FALLBACK_BYTE_LENGTH);
  if (length.warning !== undefined) {
    lines.push(...commentBlock(length.warning, MAX_LINE_LENGTH - indent.length));
  }
  const slice = `data[offset:${endOffsetExpression(length.expression)}]`;
  lines.push(`_require(data, offset, ${length.expression})`);

  switch (field.type) {
    case 'uint24':
    case 'int24':
      lines.push(
        `${local} = int.from_bytes(${slice}, ${byteOrderLiteral(field, schema)}, signed=${pythonBool(
          field.type === 'int24',
        )})`,
      );
      break;
    case 'ascii':
    case 'utf8':
      // `errors="replace"`: tek bozuk bayt yüzünden tüm çerçeveyi düşürmek,
      // hat analizinde işe yaramaz — ham baytlar zaten çerçevede duruyor.
      lines.push(
        `${local} = ${slice}.decode("${field.type === 'ascii' ? 'ascii' : 'utf-8'}", errors="replace")`,
      );
      break;
    case 'bcd':
      lines.push(`${local} = _decode_bcd(${slice})`);
      break;
    case 'rawBytes':
    case 'padding':
    case 'reserved':
    case 'delimiter':
      // `bytes(...)`: dilim `bytearray`/`memoryview` girdisinde kendi tipini
      // korur, tip açıklaması ise `bytes` diyor.
      lines.push(`${local} = bytes(${slice})`);
      break;
    default:
      // enum/command/address/length/sequenceCounter/checksum/crc: genişlik
      // şemadan gelir ve 8 baytı aşabilir; `int.from_bytes` her genişlikte çalışır.
      lines.push(`${local} = int.from_bytes(${slice}, ${byteOrderLiteral(field, schema)})`);
      break;
  }
  lines.push(`offset += ${length.expression}`);
  return lines;
}

function emitCompositeRead(
  attributePlan: AttributePlan,
  plan: ClassPlan,
  indent: string,
): string[] {
  const child = attributePlan.child;
  if (child === undefined) {
    return [];
  }
  const { field, local } = attributePlan;
  if (field.type !== 'array') {
    return [`${local}, offset = ${child.functionName}(data, offset)`];
  }

  const element = attributePlan.elementLocal ?? `${local}_entry`;
  const lines: string[] = [`${local} = []`];
  const repeat = field.repeatCount;
  let countExpression = '0';
  if (typeof repeat === 'number') {
    countExpression = String(repeat);
  } else if (repeat !== undefined) {
    const source = plan.localByFieldId.get(repeat.fromField);
    if (source === undefined) {
      lines.push(
        ...commentBlock(
          `UYARI: "${repeat.fromField}" alanı bu kapsamda yok; tekrar sayısı 0 varsayıldı.`,
          MAX_LINE_LENGTH - indent.length,
        ),
      );
    } else {
      countExpression = source;
    }
  } else {
    lines.push(
      ...commentBlock(
        `UYARI: "${singleLine(field.name)}" dizisi tekrar sayısı taşımıyor; 0 varsayıldı.`,
        MAX_LINE_LENGTH - indent.length,
      ),
    );
  }
  const body = [
    `${element}, offset = ${child.functionName}(data, offset)`,
    `${local}.append(${element})`,
  ].join('\n');
  lines.push(`for _ in range(${countExpression}):`, indentLines(body, indent));
  return lines;
}

function emitChecksumVerification(
  attributePlan: AttributePlan,
  plan: ClassPlan,
  context: PlanContext,
  indent: string,
): string[] {
  const { field, local, expectedLocal } = attributePlan;
  const width = MAX_LINE_LENGTH - indent.length;
  const algorithm = field.algorithm;
  if (algorithm === undefined || algorithm === 'none') {
    return commentBlock(
      `"${singleLine(field.name)}" alanı için algoritma yok; doğrulama üretilmedi.`,
      width,
    );
  }
  const coverage = field.coverage;
  if (coverage === undefined || expectedLocal === undefined) {
    return commentBlock(
      `"${singleLine(field.name)}" alanı kapsam ("coverage") taşımıyor; doğrulama üretilmedi.`,
      width,
    );
  }

  const startPlan = plan.attributes.find((entry) => entry.field.id === coverage.startField);
  const endPlan = plan.attributes.find((entry) => entry.field.id === coverage.endField);
  const start = startPlan?.startMarker;
  const end = endPlan?.endMarker;
  if (start === undefined || end === undefined) {
    return commentBlock(
      `"${singleLine(field.name)}" kapsamı bu fonksiyonun dışındaki alanlara bakıyor; doğrulama üretilmedi.`,
      width,
    );
  }

  const covered = `data[${start}:${end}]`;
  const lines: string[] = [];
  const params = crcParamsFor(algorithm);
  if (params === undefined) {
    if (!isSimpleChecksumAlgorithm(algorithm)) {
      // `none` yukarıda elendi, CRC'lerin parametresi var: buraya yalnız
      // katalogda olup burada karşılığı YAZILMAMIŞ bir algoritma düşebilir.
      // Sessizce atlamak yerine üretilen dosyada görünür bir not bırakılır.
      return commentBlock(
        `"${singleLine(field.name)}" alanının "${algorithm}" algoritması bu üreticide DESTEKLENMİYOR; doğrulama üretilmedi.`,
        width,
      );
    }
    const helper = SIMPLE_HELPER_NAMES[algorithm];
    lines.push(`${expectedLocal} = ${helper}(${covered})`);
  } else {
    lines.push(
      `${expectedLocal} = _crc(`,
      `${indent}${covered},`,
      `${indent}${params.width},`,
      `${indent}${pythonHex(params.poly, params.width)},`,
      `${indent}${pythonHex(params.init, params.width)},`,
      `${indent}${pythonBool(params.refin)},`,
      `${indent}${pythonBool(params.refout)},`,
      `${indent}${pythonHex(params.xorout, params.width)},`,
      ')',
    );
  }
  const message = `f"checksum uyuşmuyor: 0x{${expectedLocal}:X} != 0x{${local}:X}"`;
  lines.push(
    `if ${local} != ${expectedLocal}:`,
    indentLines(
      [`raise ${context.errorClass}(`, indentLines(message, indent), ')'].join('\n'),
      indent,
    ),
  );
  return lines;
}

function emitAttributeRead(
  attributePlan: AttributePlan,
  plan: ClassPlan,
  context: PlanContext,
  indent: string,
): string[] {
  const { field, local } = attributePlan;
  const lines: string[] = [];

  if (field.offset !== undefined && !plan.withinArray) {
    // Şemadaki `offset` çerçeve BAŞINDAN mutlak konumdur; imleç oraya taşınır.
    // İşaretçiden ÖNCE gelmeli, yoksa kapsam yanlış bayttan başlar.
    lines.push(`offset = ${field.offset}`);
  }
  if (attributePlan.startMarker !== undefined) {
    lines.push(`${attributePlan.startMarker} = offset`);
  }

  const core = isAggregateField(field)
    ? emitCompositeRead(attributePlan, plan, indent)
    : emitLeafRead(attributePlan, plan, context, indent);

  const condition = field.condition;
  if (condition === undefined) {
    lines.push(...core);
  } else {
    const source = plan.localByFieldId.get(condition.field);
    if (source === undefined) {
      lines.push(
        ...commentBlock(
          `UYARI: "${condition.field}" alanı bu kapsamda yok; koşul yok sayıldı.`,
          MAX_LINE_LENGTH - indent.length,
        ),
        ...core,
      );
    } else {
      lines.push(
        `${local} = None`,
        `if ${source} == ${condition.equals}:`,
        indentLines(core.join('\n'), indent),
      );
    }
  }

  if (field.type === 'checksum' || field.type === 'crc') {
    lines.push(...emitChecksumVerification(attributePlan, plan, context, indent));
  }
  if (attributePlan.endMarker !== undefined) {
    lines.push(`${attributePlan.endMarker} = offset`);
  }
  return lines;
}

// --- Bölüm üreticileri --------------------------------------------------

function emitDataclass(plan: ClassPlan, indent: string): string {
  const bodyWidth = MAX_LINE_LENGTH - indent.length;
  const body: string[] = [...docstringBlock(plan.doc, bodyWidth)];
  if (plan.attributes.length > 0) {
    body.push('');
  }
  for (const attribute of plan.attributes) {
    const unit = attribute.field.unit === undefined ? '' : ` (${singleLine(attribute.field.unit)})`;
    body.push(
      ...commentBlock(`${singleLine(attribute.field.name)}${unit}`, bodyWidth),
      `${attribute.attribute}: ${attribute.annotation}`,
    );
  }
  for (const property of plan.properties) {
    const innerWidth = MAX_LINE_LENGTH - indent.length * 2;
    const propertyBody =
      property.kind === 'physical'
        ? [...docstringBlock(property.doc, innerWidth), `return ${property.expression}`]
        : [
            ...docstringBlock(property.doc, innerWidth),
            'try:',
            indentLines(`return ${property.enumClass}(self.${property.attribute}).name`, indent),
            'except ValueError:',
            indentLines('return None', indent),
          ];
    const returnType = property.kind === 'physical' ? 'float' : 'Optional[str]';
    body.push(
      '',
      '@property',
      ...functionSignature(property.name, ['self'], returnType, indent),
      indentLines(propertyBody.join('\n'), indent),
    );
  }
  return ['@dataclass', `class ${plan.className}:`, indentLines(body.join('\n'), indent)].join('\n');
}

function emitEnumClass(plan: EnumPlan, indent: string): string {
  const body: string[] = [
    ...docstringBlock(
      `${plan.fieldName} alanının şemada tanımlı değerleri.`,
      MAX_LINE_LENGTH - indent.length,
    ),
    '',
    ...plan.entries.map((entry) => `${entry.memberName} = ${entry.value}`),
  ];
  return [`class ${plan.className}(enum.IntEnum):`, indentLines(body.join('\n'), indent)].join('\n');
}

function emitParseFunction(plan: ClassPlan, context: PlanContext, indent: string): string {
  const body: string[] = [
    ...docstringBlock(
      `${plan.doc} İmleci ilerletir ve yeni konumu geri verir.`,
      MAX_LINE_LENGTH - indent.length,
    ),
  ];
  for (const attribute of plan.attributes) {
    body.push(...emitAttributeRead(attribute, plan, context, indent));
  }

  if (plan.attributes.length === 0) {
    body.push(`return ${plan.className}(), offset`);
  } else {
    body.push(
      'return (',
      indentLines(`${plan.className}(`, indent),
      ...plan.attributes.map((attribute) =>
        indentLines(`${attribute.attribute}=${attribute.local},`, indent, 2),
      ),
      indentLines('),', indent),
      indentLines('offset,', indent),
      ')',
    );
  }

  return [
    ...functionSignature(
      plan.functionName,
      ['data: bytes', 'offset: int'],
      `tuple[${plan.className}, int]`,
      indent,
    ),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

function emitErrorClass(name: string, schemaName: string, indent: string): string {
  const body = docstringBlock(
    `${schemaName} çerçevesi çözümlenemediğinde yükseltilir.`,
    MAX_LINE_LENGTH - indent.length,
  );
  return [`class ${name}(ValueError):`, indentLines(body.join('\n'), indent)].join('\n');
}

function emitRequireHelper(errorClass: string, indent: string): string {
  const body = [
    ...docstringBlock(
      'Çerçeve sınırını aşan okuma sessizce kısa dizi döndürmesin.',
      MAX_LINE_LENGTH - indent.length,
    ),
    'if length < 0 or offset + length > len(data):',
    indentLines(
      [
        `raise ${errorClass}(`,
        indentLines('f"{offset + length} bayt gerekiyor ama çerçeve {len(data)} bayt"', indent),
        ')',
      ].join('\n'),
      indent,
    ),
  ];
  return [
    ...functionSignature('_require', ['data: bytes', 'offset: int', 'length: int'], 'None', indent),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

function emitBcdHelper(errorClass: string, indent: string): string {
  const body = [
    ...docstringBlock(
      'Paketli ikili kodlu ondalık: her bayt iki basamak taşır, üst yarım önce gelir.',
      MAX_LINE_LENGTH - indent.length,
    ),
    'value = 0',
    'for byte in chunk:',
    indentLines(
      [
        'high = byte >> 4',
        'low = byte & 0x0F',
        'if high > 9 or low > 9:',
        indentLines(
          [`raise ${errorClass}(`, indentLines('f"geçersiz BCD baytı: 0x{byte:02X}"', indent), ')'].join(
            '\n',
          ),
          indent,
        ),
        'value = value * 100 + high * 10 + low',
      ].join('\n'),
      indent,
    ),
    'return value',
  ];
  return [
    ...functionSignature('_decode_bcd', ['chunk: bytes'], 'int', indent),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

function emitReflectHelper(indent: string): string {
  const body = [
    ...docstringBlock('Değerin alt `width` bitini ters çevirir.', MAX_LINE_LENGTH - indent.length),
    'result = 0',
    'remaining = value',
    'for _ in range(width):',
    indentLines(['result = (result << 1) | (remaining & 1)', 'remaining >>= 1'].join('\n'), indent),
    'return result',
  ];
  return [
    ...functionSignature('_reflect', ['value: int', 'width: int'], 'int', indent),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

/**
 * Jenerik bit-bit CRC. Tablo üretmiyor: tablo yalnız genişliği 8'in katı olan
 * varyantlarda kolay, bu üretici ise 4 bitten 64 bite kadar her katalog girdisini
 * aynı gövdeyle karşılamak zorunda.
 */
function emitCrcHelper(indent: string): string {
  const body = [
    ...docstringBlock(
      'Ross Williams modeliyle parametrik CRC; her genişlik aynı yoldan geçer.',
      MAX_LINE_LENGTH - indent.length,
    ),
    'mask = (1 << width) - 1',
    'top_bit = 1 << (width - 1)',
    'register = init & mask',
    'for byte in payload:',
    indentLines(
      [
        'current = _reflect(byte, 8) if refin else byte',
        'for bit_index in range(7, -1, -1):',
        indentLines(
          [
            'input_bit = (current >> bit_index) & 1',
            'top_was_set = 1 if register & top_bit else 0',
            'register = (register << 1) & mask',
            'if top_was_set ^ input_bit:',
            indentLines('register ^= poly', indent),
          ].join('\n'),
          indent,
        ),
      ].join('\n'),
      indent,
    ),
    'if refout:',
    indentLines('register = _reflect(register, width)', indent),
    'return (register ^ xorout) & mask',
  ];
  return [
    ...functionSignature(
      '_crc',
      [
        'payload: bytes',
        'width: int',
        'poly: int',
        'init: int',
        'refin: bool',
        'refout: bool',
        'xorout: int',
      ],
      'int',
      indent,
    ),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

function emitSimpleChecksumHelper(
  name: string,
  doc: string,
  bodyLines: readonly string[],
  indent: string,
): string {
  const body = [...docstringBlock(doc, MAX_LINE_LENGTH - indent.length), ...bodyLines];
  return [
    ...functionSignature(name, ['payload: bytes'], 'int', indent),
    indentLines(body.join('\n'), indent),
  ].join('\n');
}

interface SimpleChecksumSource {
  readonly doc: string;
  readonly body: readonly string[];
}

/**
 * Basit algoritmaların Python gövdesi. `Record` olduğu için katalogda yeni bir
 * basit algoritma belirdiğinde BURASI DERLENMEZ — üreticinin sessizce eksik
 * kalmasının önü kapalı.
 *
 * Sabitler (255 / 65535 / 65521) TS motorundakilerle aynı olmak zorunda; ikisi
 * ayrışırsa üretilen ayrıştırıcı uygulamanın kendi doğrulamasıyla çelişir.
 */
function simpleChecksumSource(
  algorithm: SimpleChecksumAlgorithm,
  indent: string,
): SimpleChecksumSource {
  const sources: Readonly<Record<SimpleChecksumAlgorithm, SimpleChecksumSource>> = {
    xor8: {
      doc: "Tüm baytların XOR'u; sıra bağımsızdır.",
      body: ['result = 0', 'for byte in payload:', indentLines('result ^= byte', indent), 'return result'],
    },
    sum8: {
      doc: 'Baytların toplamı, 8 bite taşarsa kırpılır.',
      body: [
        'total = 0',
        'for byte in payload:',
        indentLines('total = (total + byte) & 0xFF', indent),
        'return total',
      ],
    },
    lrc: {
      doc: "Modbus ASCII LRC: bayt toplamının 8 bitlik two's complement'i.",
      body: [
        'total = 0',
        'for byte in payload:',
        indentLines('total = (total + byte) & 0xFF', indent),
        'return (256 - total) & 0xFF',
      ],
    },
    nmeaXor: {
      doc: 'NMEA 0183 checksum: "$" ile "*" ARASINDAKİ baytların XOR\'u. Sınırlayıcılar kapsama girmediği için hesap XOR8 ile aynıdır.',
      body: ['result = 0', 'for byte in payload:', indentLines('result ^= byte', indent), 'return result'],
    },
    fletcher16: {
      doc: 'Fletcher-16. Modülüs 255 (256 DEĞİL): dağılım özelliği bu asimetrik mod\'a dayanır.',
      body: [
        'sum1 = 0',
        'sum2 = 0',
        'for byte in payload:',
        indentLines(['sum1 = (sum1 + byte) % 255', 'sum2 = (sum2 + sum1) % 255'].join('\n'), indent),
        'return (sum2 << 8) | sum1',
      ],
    },
    fletcher32: {
      doc: 'Fletcher-32: 16 bitlik kelimeler, üst bayt önce. Tek sayıda baytta son kelimenin alt baytı 0 ile doldurulur.',
      body: [
        'sum1 = 0',
        'sum2 = 0',
        'for index in range(0, len(payload), 2):',
        indentLines(
          [
            'high = payload[index]',
            'low = payload[index + 1] if index + 1 < len(payload) else 0',
            'sum1 = (sum1 + ((high << 8) | low)) % 65535',
            'sum2 = (sum2 + sum1) % 65535',
          ].join('\n'),
          indent,
        ),
        'return (sum2 << 16) | sum1',
      ],
    },
    adler32: {
      doc: "Adler-32 (zlib). \"a\" 1'den başlar ve modülüs 16 bite sığan en büyük ASAL olan 65521'dir.",
      body: [
        'a = 1',
        'b = 0',
        'for byte in payload:',
        indentLines(['a = (a + byte) % 65521', 'b = (b + a) % 65521'].join('\n'), indent),
        'return (b << 16) | a',
      ],
    },
  };
  return sources[algorithm];
}

function collectPlans(plan: ClassPlan, accumulator: ClassPlan[]): void {
  // Post-order: iç sınıflar dışarıdakinden ÖNCE tanımlanır. Çalışma zamanında
  // şart değil (açıklamalar metin, çağrılar modül yüklendikten sonra) ama
  // okuyan için doğal sıra bu.
  for (const attribute of plan.attributes) {
    if (attribute.child !== undefined) {
      collectPlans(attribute.child, accumulator);
    }
  }
  accumulator.push(plan);
}

/**
 * Şemadan Python 3 ayrıştırıcısı üretir.
 *
 * Saf ve deterministik: aynı şema her zaman bayt bayt aynı metni verir. Üretim
 * tarihi, rastgele kimlik, `Map` gezinme sırasına bağlı çıktı YOK.
 */
export function generatePythonParser(
  schema: ProtocolSchema,
  options?: CodegenOptions,
): GeneratedArtifact {
  const indent = options?.indent ?? PYTHON_INDENT;
  const withBanner = options?.banner ?? true;

  const allocateModuleName = createAllocator(['parse', 'struct', 'enum', 'dataclass', 'Optional']);
  const rootClassName = allocateModuleName(toIdentifier(schema.name, 'pascal'));
  const errorClass = allocateModuleName(`${rootClassName}ParseError`);
  const rootFunctionName = allocateModuleName(`_parse_${toIdentifier(schema.name, 'snake')}`);

  const helpers: HelperUsage = {
    bcd: false,
    crc: false,
    simple: new Set<SimpleChecksumAlgorithm>(),
  };
  const enums: EnumPlan[] = [];
  const context: PlanContext = { schema, allocateModuleName, enums, helpers, errorClass };

  const rootPlan = planClass(
    schema.fields,
    rootClassName,
    rootFunctionName,
    `${singleLine(schema.name)} ${singleLine(schema.version)} çerçevesinin çözümlenmiş alanları.`,
    false,
    context,
  );

  const imports = [
    'from __future__ import annotations',
    '',
    ...(enums.length > 0 ? ['import enum'] : []),
    'import struct',
    'from dataclasses import dataclass',
    'from typing import Optional',
  ].join('\n');

  const definitions: string[] = [emitErrorClass(errorClass, singleLine(schema.name), indent)];
  for (const enumPlan of enums) {
    definitions.push(emitEnumClass(enumPlan, indent));
  }

  const classPlans: ClassPlan[] = [];
  collectPlans(rootPlan, classPlans);
  for (const plan of classPlans) {
    definitions.push(emitDataclass(plan, indent));
  }

  definitions.push(emitRequireHelper(errorClass, indent));
  if (helpers.bcd) {
    definitions.push(emitBcdHelper(errorClass, indent));
  }
  if (helpers.crc) {
    definitions.push(emitReflectHelper(indent), emitCrcHelper(indent));
  }
  // Sıra kümeden değil katalogdan: aynı şema her zaman aynı metni versin.
  for (const algorithm of CHECKSUM_ALGORITHMS) {
    if (!isSimpleChecksumAlgorithm(algorithm) || !helpers.simple.has(algorithm)) {
      continue;
    }
    const source = simpleChecksumSource(algorithm, indent);
    definitions.push(
      emitSimpleChecksumHelper(SIMPLE_HELPER_NAMES[algorithm], source.doc, source.body, indent),
    );
  }

  for (const plan of classPlans) {
    definitions.push(emitParseFunction(plan, context, indent));
  }

  const parseBody = [
    ...docstringBlock(
      `Çerçevenin TAMAMINI (framing baytları dahil) çözümler; şemadaki ofsetler çerçeve başına göredir.`,
      MAX_LINE_LENGTH - indent.length,
    ),
    `result, _ = ${rootFunctionName}(data, 0)`,
    'return result',
  ];
  definitions.push(
    [
      ...functionSignature('parse', ['data: bytes'], rootClassName, indent),
      indentLines(parseBody.join('\n'), indent),
    ].join('\n'),
  );

  const head = [...(withBanner ? [bannerFor('hash', schema.name)] : []), imports].join('\n\n');
  const code = `${head}\n\n\n${definitions.join('\n\n\n')}\n`;

  return {
    id: 'python-parser',
    language: 'python',
    fileName: `${toIdentifier(schema.name, 'snake')}_parser.py`,
    code,
  };
}
