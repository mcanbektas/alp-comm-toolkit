/**
 * Şemadan bağımsız, sıfır bağımlılıklı bir TypeScript ayrıştırıcısı üretir —
 * spec §9.5'in "TypeScript parser" çıktısı.
 *
 * Üretilen şey METİNdir: uygulama bu kodu ASLA çalıştırmaz (spec §41 `eval` ve
 * dinamik kod çalıştırma yasağı). Kullanıcı metni kopyalar, kendi projesine
 * yapıştırır; bu yüzden çıktının tek bir dosyada, hiçbir paket kurmadan
 * derlenebilir olması şart.
 *
 * ## Üretilen kodun uyacağı kısıtlar
 *
 * Hedef proje `strict` + `noUncheckedIndexedAccess` ile koşuyor olabilir. Bu
 * yüzden üretilen kod `any` ya da `@ts-ignore` içermez ve ham indeks erişimi
 * (`bytes[i]`) yalnız `undefined` guard'ıyla birlikte kullanılır. Sayısal
 * okumalar `DataView` üzerinden yapılır — `DataView` hem sınır denetimini
 * kendisi yapar hem de `noUncheckedIndexedAccess` sorununu doğurmaz.
 *
 * ## Neden düz (straight-line) kod, neden tablo yorumlayıcısı değil
 *
 * Şemayı çalışma zamanında gezen genel bir yorumlayıcı üretmek daha kısa olurdu
 * ama okunamaz olurdu: kullanıcı bu dosyayı kendi projesinde ELLE okuyup
 * uyarlayacak. Her alan için bir `const` satırı üretmek, üretilen kodu
 * protokolün okunabilir bir tarifi hâline getirir.
 *
 * ## Çözülemeyen şema referanslarında davranış
 *
 * `lengthFrom`, `condition.field` ve `repeatCount.fromField` başka bir alanın
 * DEĞERİNE bakar. Referans edilen alan henüz okunmamışsa ya da bir döngü/koşul
 * bloğunun içinde kalıp bu kapsamda görünmüyorsa üretici DERLENMEYEN kod
 * yazamaz; o durumda güvenli bir geri düşüş seçer ve satırın üstüne Türkçe bir
 * yorum bırakır:
 *   - `lengthFrom`   → kalan baytların tamamı,
 *   - `condition`    → alan koşulsuz okunur,
 *   - `repeatCount`  → dizi çerçeve sonuna kadar okunur.
 * Bu üç durum da şema doğrulamasının zaten hata verdiği hâllerdir; üretim
 * durmaz, ama sessiz de kalmaz.
 *
 * ## Determinizm
 *
 * Aynı şema her zaman bayt bayt aynı metni üretir: tarih, rastgele kimlik ya da
 * `Map`/`Set` gezinme sırasına bağlı çıktı yok. Enum tabloları sayısal anahtara
 * göre SIRALANIR — nesne anahtar sırası şemadan gelen JSON'a bağlı kalmasın.
 */

import { isSimpleChecksumAlgorithm } from '../checksums/algorithmCatalogue';
import type { SimpleChecksumAlgorithm } from '../checksums/algorithmCatalogue';
import { CRC_CATALOGUE } from '../checksums/crcCatalogue';
import type { CrcParams } from '../checksums/crcEngine';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import {
  bannerFor,
  fieldByteLength,
  isAggregateField,
  toIdentifier,
  toUniqueIdentifiers,
  typeScriptTypeFor,
} from './codegenSupport';
import { DEFAULT_INDENT } from './types';
import type { CodegenOptions, GeneratedArtifact } from './types';

/** Üretilen dosyada sabit adlı üç yerel: alan adları bunlara çakışmasın. */
const FRAME_PARAMETER = 'data';
const VIEW_LOCAL = 'view';
const CURSOR_LOCAL = 'cursor';

/**
 * Yerel adların KAÇINACAĞI sözcükler. Anahtar sözcük kaçınması destek
 * katmanında bilerek yok (`toIdentifier` "class"ı aynen döndürür); hedef dile
 * özgü liste burada. Ad tutulmuşsa `toUniqueIdentifiers` mantığıyla `_2` eki
 * gelir — yani `class` alanı `class_2` yereline iner, arayüz özelliği ise
 * `class` kalır (nesne özelliği anahtar sözcük olabilir, yerel olamaz).
 */
const RESERVED_WORDS: readonly string[] = [
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  // Üretilen kodun kullandığı global'ler: gölgelenirse kod bozulur.
  'BigInt',
  'DataView',
  'Error',
  'Infinity',
  'NaN',
  'Number',
  'String',
  'TextDecoder',
  'Uint8Array',
  'undefined',
];

/** Yardımcı işlev adları — yerellerden önce rezerve edilir. */
const HELPER_NAMES = [
  'ensureAvailable',
  'readUint24',
  'readInt24',
  'readUnsignedNumber',
  'readBits',
  'decodeFloat16',
  'decodeAscii',
  'decodeUtf8',
  'decodeBcd',
  'computeXor8',
  'computeSum8',
  'computeLrc',
  'computeNmeaXor',
  'computeFletcher16',
  'computeFletcher32',
  'computeAdler32',
  'reflectBits',
  'computeCrc',
] as const;

type HelperName = (typeof HELPER_NAMES)[number];

/** Yardımcının kendisinden önce yazılması gereken diğer yardımcılar. */
const HELPER_DEPENDENCIES: Readonly<Record<HelperName, readonly HelperName[]>> = {
  ensureAvailable: [],
  readUint24: [],
  readInt24: ['readUint24'],
  readUnsignedNumber: [],
  readBits: [],
  decodeFloat16: [],
  decodeAscii: [],
  decodeUtf8: [],
  decodeBcd: [],
  computeXor8: [],
  computeSum8: [],
  computeLrc: ['computeSum8'],
  // NMEA'nın XOR'u sayısal olarak XOR8'in aynısı; ayrı yardımcı YAZILMAZ, aynı
  // gövde iki adla üretilseydi okuyan iki farklı hesap sanırdı.
  computeNmeaXor: ['computeXor8'],
  computeFletcher16: [],
  computeFletcher32: [],
  computeAdler32: [],
  reflectBits: [],
  computeCrc: ['reflectBits'],
};

/** Yardımcı gövdelerinde hata sınıfının adı için yer tutucu. */
const ERROR_CLASS_TOKEN = '__ERROR_CLASS__';

/**
 * Yardımcı kaynakları İKİ BOŞLUK girintiyle yazılır; çıktıya konmadan önce
 * {@link reindent} ile kullanıcının seçtiği girintiye çevrilir. Böylece burada
 * okunabilir kalırlar.
 */
const HELPER_SOURCES: Readonly<Record<HelperName, string>> = {
  ensureAvailable: `/** Okumadan önce sınır denetimi: DataView'in RangeError'ı yerine anlamlı hata. */
function ensureAvailable(data: Uint8Array, cursor: number, needed: number): void {
  if (cursor + needed > data.length) {
    throw new ${ERROR_CLASS_TOKEN}(
      'Çerçeve beklenenden kısa: ' +
        String(cursor + needed) +
        ' bayt gerekiyor, ' +
        String(data.length) +
        ' bayt var',
    );
  }
}`,
  readUint24: `/** 24 bit tamsayı: DataView'de karşılığı yok, üç bayt elle birleştirilir. */
function readUint24(view: DataView, byteOffset: number, littleEndian: boolean): number {
  const first = view.getUint8(byteOffset);
  const second = view.getUint8(byteOffset + 1);
  const third = view.getUint8(byteOffset + 2);
  return littleEndian
    ? first + second * 256 + third * 65536
    : first * 65536 + second * 256 + third;
}`,
  readInt24: `/** İşaretli 24 bit: üst bit 1 ise değer 2^24 çıkarılarak negatife taşınır. */
function readInt24(view: DataView, byteOffset: number, littleEndian: boolean): number {
  const raw = readUint24(view, byteOffset, littleEndian);
  return raw >= 0x800000 ? raw - 0x1000000 : raw;
}`,
  readUnsignedNumber: `/**
 * Genişliği şemadan gelen işaretsiz tamsayı — enum, adres, komut, uzunluk ve
 * checksum alanları için. Kaydırma yerine çarpma kullanılır: JavaScript'in
 * bitwise operatörleri işlenenlerini 32 bite indirger, 5 baytlık bir alan
 * kaydırmayla sessizce bozulurdu. 7 bayttan geniş alanlarda 2^53 sınırı aşılır;
 * o genişlikte alan gerekiyorsa şemada uint64 kullanın.
 */
function readUnsignedNumber(
  data: Uint8Array,
  start: number,
  length: number,
  littleEndian: boolean,
): number {
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = data[start + (littleEndian ? length - 1 - index : index)];
    if (byte === undefined) {
      throw new ${ERROR_CLASS_TOKEN}('Tamsayı alanı çerçevenin dışına taşıyor');
    }
    value = value * 256 + byte;
  }
  return value;
}`,
  readBits: `/**
 * Bayt sınırı tanımayan bit alanı. \`msbFirst\` ise bit 0 baytın EN ANLAMLI
 * bitidir; aksi hâlde en az anlamlı bitten sayılır.
 */
function readBits(
  data: Uint8Array,
  start: number,
  bitOffset: number,
  bitLength: number,
  msbFirst: boolean,
): number {
  let value = 0;
  for (let index = 0; index < bitLength; index += 1) {
    const absolute = bitOffset + index;
    const byte = data[start + Math.floor(absolute / 8)];
    if (byte === undefined) {
      throw new ${ERROR_CLASS_TOKEN}('Bit alanı çerçevenin dışına taşıyor');
    }
    const shift = msbFirst ? 7 - (absolute % 8) : absolute % 8;
    const bit = (byte >> shift) & 1;
    value = msbFirst ? value * 2 + bit : value + bit * 2 ** index;
  }
  return value;
}`,
  decodeFloat16: `/**
 * IEEE-754 yarım kayan nokta. DataView'de \`getFloat16\` yok; 16 bit elle
 * çözülür: 1 işaret + 5 üs + 10 mantis, üs sapması 15.
 */
function decodeFloat16(view: DataView, byteOffset: number, littleEndian: boolean): number {
  const bits = view.getUint16(byteOffset, littleEndian);
  const sign = (bits & 0x8000) === 0 ? 1 : -1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;
  if (exponent === 0) {
    // Subnormal: gizli bit yok, üs sabit -14.
    return sign * fraction * 2 ** -24;
  }
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : NaN;
  }
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}`,
  decodeAscii: `/**
 * ASCII metin. Dolgu baytları KIRPILMAZ: sabit uzunluklu metin alanları çoğu
 * protokolde NUL ile doldurulur ama kırpmak veriyi sessizce değiştirmek olur.
 */
function decodeAscii(data: Uint8Array, start: number, length: number): string {
  let text = '';
  for (const byte of data.subarray(start, start + length)) {
    text += String.fromCharCode(byte);
  }
  return text;
}`,
  decodeUtf8: `/** TextDecoder tarayıcıda ve Node 11+ üzerinde yerleşiktir; paket gerekmez. */
function decodeUtf8(data: Uint8Array, start: number, length: number): string {
  return new TextDecoder('utf-8').decode(data.subarray(start, start + length));
}`,
  decodeBcd: `/** Paketli BCD: her bayt iki ondalık basamak taşır, üst yarı önce gelir. */
function decodeBcd(data: Uint8Array, start: number, length: number): number {
  let value = 0;
  for (const byte of data.subarray(start, start + length)) {
    value = value * 100 + (byte >> 4) * 10 + (byte & 0x0f);
  }
  return value;
}`,
  computeXor8: `/** Tüm baytların XOR'u. */
function computeXor8(bytes: Uint8Array): number {
  let result = 0;
  for (const byte of bytes) {
    result ^= byte;
  }
  return result;
}`,
  computeSum8: `/** Baytların toplamı, 8 bite kırpılmış. */
function computeSum8(bytes: Uint8Array): number {
  let sum = 0;
  for (const byte of bytes) {
    sum += byte;
  }
  return sum % 256;
}`,
  computeLrc: `/** Modbus ASCII LRC: bayt toplamının 8 bitlik two's complement'i. */
function computeLrc(bytes: Uint8Array): number {
  return (256 - computeSum8(bytes)) % 256;
}`,
  computeNmeaXor: `/**
 * NMEA 0183 checksum'ı: \`$\` ve \`*\` ARASINDAKİ baytların XOR'u. Sınırlayıcılar
 * kapsama girmez — hangi baytların kapsandığı şemadaki \`coverage\` ile belirlenir,
 * bu yüzden hesap XOR8'in aynısıdır.
 */
function computeNmeaXor(bytes: Uint8Array): number {
  return computeXor8(bytes);
}`,
  computeFletcher16: `/**
 * Fletcher-16. Modülüs 255'tir (256 DEĞİL): Fletcher'ın dağılım özelliği bu
 * asimetrik mod'a dayanır, yuvarlak sayıya çevirmek checksum'ı bozar.
 */
function computeFletcher16(bytes: Uint8Array): number {
  let sum1 = 0;
  let sum2 = 0;
  for (const byte of bytes) {
    sum1 = (sum1 + byte) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return (sum2 << 8) | sum1;
}`,
  computeFletcher32: `/**
 * Fletcher-32: 16 bitlik kelimeler üzerinde, üst bayt önce. Tek sayıda baytta
 * son kelimenin alt baytı 0 ile doldurulur.
 *
 * Sonuç \`sum2 * 65536 + sum1\` ile birleştirilir, \`<<\` ile DEĞİL: \`<<\`
 * işleneni 32 bit İŞARETLİ tamsayıya çevirir ve sum2'nin üst biti 1 olduğunda
 * negatif sonuç üretirdi.
 */
function computeFletcher32(bytes: Uint8Array): number {
  let sum1 = 0;
  let sum2 = 0;
  for (let index = 0; index < bytes.length; index += 2) {
    const high = bytes[index] ?? 0;
    const low = index + 1 < bytes.length ? (bytes[index + 1] ?? 0) : 0;
    sum1 = (sum1 + ((high << 8) | low)) % 65535;
    sum2 = (sum2 + sum1) % 65535;
  }
  return sum2 * 65536 + sum1;
}`,
  computeAdler32: `/**
 * Adler-32 (zlib). Fletcher'dan iki farkı: \`a\` 1'den başlar (tamamı sıfır veri
 * boş veriden ayrışsın diye) ve modülüs 16 bite sığan en büyük ASAL olan
 * 65521'dir.
 */
function computeAdler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return b * 65536 + a;
}`,
  reflectBits: `/** Değerin alt \`width\` bitini ters çevirir; refin/refout için. */
function reflectBits(value: bigint, width: number): bigint {
  let remaining = value;
  let reflected = 0n;
  for (let index = 0; index < width; index += 1) {
    reflected = (reflected << 1n) | (remaining & 1n);
    remaining >>= 1n;
  }
  return reflected;
}`,
  computeCrc: `interface CrcParameters {
  readonly width: number;
  readonly poly: bigint;
  readonly init: bigint;
  readonly refin: boolean;
  readonly refout: boolean;
  readonly xorout: bigint;
}

/**
 * Bit bazlı parametrik CRC. Gelen bit register'ın üst bitiyle karşılaştırılır,
 * register kaydırılır, gerekirse polinom XOR'lanır. Bu yol register
 * genişliğinden bağımsızdır: 4 bitten 64 bite kadar tek kod yolu.
 *
 * \`bigint\` kullanılıyor çünkü JavaScript'in bitwise operatörleri 32 bitte
 * kesiyor; CRC-32'de bile işaret biti sorun çıkarır.
 */
function computeCrc(bytes: Uint8Array, parameters: CrcParameters): bigint {
  const topBit = 1n << BigInt(parameters.width - 1);
  const mask = (1n << BigInt(parameters.width)) - 1n;
  let register = parameters.init & mask;
  for (const byte of bytes) {
    const inputByte = parameters.refin ? reflectBits(BigInt(byte), 8) : BigInt(byte);
    for (let bitIndex = 7; bitIndex >= 0; bitIndex -= 1) {
      const inputBit = (inputByte >> BigInt(bitIndex)) & 1n;
      const topBitWasSet = (register & topBit) !== 0n ? 1n : 0n;
      register = (register << 1n) & mask;
      if ((topBitWasSet ^ inputBit) === 1n) {
        register ^= parameters.poly;
      }
    }
  }
  const reflected = parameters.refout ? reflectBits(register, parameters.width) : register;
  return (reflected ^ parameters.xorout) & mask;
}`,
};

/** İki boşlukla yazılmış kaynağı hedef girintiye çevirir. */
function reindent(source: string, indent: string): string {
  if (indent === '  ') {
    return source;
  }
  return source
    .split('\n')
    .map((line) => {
      const match = /^( +)/.exec(line);
      if (match === null) {
        return line;
      }
      const spaces = match[1] ?? '';
      return indent.repeat(Math.floor(spaces.length / 2)) + line.slice(spaces.length);
    })
    .join('\n');
}

/** Yorum içine giren serbest metin: blok yorumu erken kapatmasın, satır bölünmesin. */
function commentText(value: string): string {
  return value.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ').trim();
}

/** Üretilen kodda tek tırnaklı dize değişmezi. */
function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

/**
 * Sayıyı üretilen koda yazar. `-0`, `Infinity` ve `NaN` geçerli TypeScript
 * değişmezi değildir ya da anlamsızdır; şemadan böyle bir değer gelirse 0'a
 * düşülür — üretilen kodun derlenmesi kullanıcının şema hatasına kurban gitmesin.
 */
function numberLiteral(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Object.is(value, -0) ? '0' : String(value);
}

interface NameRegistry {
  readonly used: Set<string>;
}

/** Tutulmuş adlara `_2`, `_3` ekleyerek boşta bir ad döndürür. */
function takeName(registry: NameRegistry, base: string): string {
  let candidate = base;
  let counter = 2;
  while (registry.used.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  registry.used.add(candidate);
  return candidate;
}

interface PlannedEnum {
  readonly constName: string;
  readonly typeName: string;
  readonly labelName: string;
  readonly entries: readonly (readonly [string, string])[];
}

interface PlannedField {
  readonly field: ProtocolFieldSchema;
  /** Bildirim sırası; referanslar yalnız DAHA ERKEN bir alana bakabilir. */
  readonly order: number;
  /** Kapsayan döngü/koşul bloklarının kimlikleri, en dıştan içe. */
  readonly blockChain: readonly string[];
  readonly property: string;
  readonly local: string;
  readonly tsType: string;
  readonly optional: boolean;
  readonly byteLengthLocal: string | null;
  readonly physicalProperty: string | null;
  readonly physicalLocal: string | null;
  readonly coverageStartLocal: string | null;
  readonly coverageEndLocal: string | null;
  readonly enumeration: PlannedEnum | null;
  readonly child: PlannedScope | null;
  readonly countLocal: string | null;
  readonly indexLocal: string | null;
  readonly elementStartLocal: string | null;
  /**
   * Dizi biriktiricisinin adı. Koşullu dizide yerelin kendisi `let` ile
   * bildirildiği için biriktirici AYRI bir addır; koşulsuzda ikisi aynıdır.
   */
  readonly listLocal: string | null;
}

interface PlannedScope {
  readonly interfaceName: string;
  /** Arayüzün başına yazılacak açıklama. */
  readonly title: string;
  readonly fields: readonly PlannedField[];
}

interface PlanState {
  readonly registry: NameRegistry;
  readonly byId: Map<string, PlannedField>;
  readonly coverageStarts: Set<string>;
  readonly coverageEnds: Set<string>;
  readonly scopes: PlannedScope[];
  order: number;
}

/** `checksum`/`crc` alanı `none` algoritmasıyla hiç bayt kaplamaz — hiç üretilmez. */
function isSkippedField(field: ProtocolFieldSchema): boolean {
  return (
    (field.type === 'checksum' || field.type === 'crc') && field.algorithm === 'none'
  );
}

function collectCoverage(
  fields: readonly ProtocolFieldSchema[],
  starts: Set<string>,
  ends: Set<string>,
): void {
  for (const field of fields) {
    if (field.coverage !== undefined) {
      starts.add(field.coverage.startField);
      ends.add(field.coverage.endField);
    }
    if (field.fields !== undefined) {
      collectCoverage(field.fields, starts, ends);
    }
  }
}

function hasScale(field: ProtocolFieldSchema): boolean {
  return field.scale !== undefined || field.calibrationOffset !== undefined;
}

/** Ölçekli alanın ham tipi sayısal olmalı; metin/bayt alanında fiziksel değer yok. */
function supportsPhysicalValue(field: ProtocolFieldSchema): boolean {
  if (isAggregateField(field) || !hasScale(field)) {
    return false;
  }
  const tsType = typeScriptTypeFor(field);
  return tsType === 'number' || tsType === 'bigint';
}

function enumEntriesOf(field: ProtocolFieldSchema): readonly (readonly [string, string])[] {
  const values = field.enumValues;
  if (values === undefined) {
    return [];
  }
  // Sayısal anahtara göre sıralanır: JSON'daki yazım sırası çıktıyı belirlemesin.
  return Object.entries(values)
    .map(([key, label]): readonly [string, string] => [key, label])
    .sort((left, right) => Number(left[0]) - Number(right[0]));
}

function planScope(
  fields: readonly ProtocolFieldSchema[],
  interfaceName: string,
  title: string,
  blockChain: readonly string[],
  rootPascal: string,
  state: PlanState,
): PlannedScope {
  const visible = fields.filter((field) => !isSkippedField(field));

  // Aynı kapsamdaki adlar TOPLU çevrilir: çakışanlar `_2` alır ve ham/fiziksel
  // adlar birbirini ezmez.
  const rawNames = [
    ...visible.map((field) => field.name),
    ...visible.filter(supportsPhysicalValue).map((field) => `Physical ${field.name}`),
  ];
  const identifiers = toUniqueIdentifiers(rawNames, 'camel');
  const physicalIdentifiers = identifiers.slice(visible.length);

  const planned: PlannedField[] = [];
  let physicalIndex = 0;

  for (const [index, field] of visible.entries()) {
    const property = identifiers[index] ?? 'field';
    const local = takeName(state.registry, property);
    const optional = field.condition !== undefined;
    const chain = optional ? [...blockChain, `cond:${field.id}`] : blockChain;

    let physicalProperty: string | null = null;
    let physicalLocal: string | null = null;
    if (supportsPhysicalValue(field)) {
      physicalProperty = physicalIdentifiers[physicalIndex] ?? 'physicalValue';
      physicalLocal = takeName(state.registry, physicalProperty);
      physicalIndex += 1;
    }

    let child: PlannedScope | null = null;
    let countLocal: string | null = null;
    let indexLocal: string | null = null;
    let elementStartLocal: string | null = null;
    let listLocal: string | null = null;
    let tsType: string;

    if (isAggregateField(field)) {
      const isArray = field.type === 'array';
      const childName = takeName(
        state.registry,
        `${rootPascal}${toIdentifier(field.name, 'pascal')}${isArray ? 'Item' : ''}`,
      );
      const childChain = isArray ? [...chain, `array:${field.id}`] : chain;
      child = planScope(
        field.fields ?? [],
        childName,
        field.name,
        childChain,
        rootPascal,
        state,
      );
      tsType = isArray ? `readonly ${childName}[]` : childName;
      if (isArray) {
        countLocal = takeName(state.registry, `${property}Count`);
        indexLocal = takeName(state.registry, `${property}Index`);
        elementStartLocal = takeName(state.registry, `${property}ElementStart`);
        listLocal = optional ? takeName(state.registry, `${property}Buffer`) : local;
      }
    } else {
      tsType = typeScriptTypeFor(field);
    }

    const needsByteLengthLocal = !isAggregateField(field) && field.lengthFrom !== undefined;

    const enumeration =
      field.type === 'enum' && enumEntriesOf(field).length > 0
        ? {
            constName: takeName(state.registry, `${toIdentifier(field.name, 'pascal')}Values`),
            typeName: takeName(state.registry, `${toIdentifier(field.name, 'pascal')}Value`),
            labelName: takeName(state.registry, `${property}Label`),
            entries: enumEntriesOf(field),
          }
        : null;

    const entry: PlannedField = {
      field,
      order: state.order,
      blockChain: chain,
      property,
      local,
      tsType,
      optional,
      byteLengthLocal: needsByteLengthLocal
        ? takeName(state.registry, `${property}ByteLength`)
        : null,
      physicalProperty,
      physicalLocal,
      coverageStartLocal: state.coverageStarts.has(field.id)
        ? takeName(state.registry, `${property}CoverageStart`)
        : null,
      coverageEndLocal: state.coverageEnds.has(field.id)
        ? takeName(state.registry, `${property}CoverageEnd`)
        : null,
      enumeration,
      child,
      countLocal,
      indexLocal,
      elementStartLocal,
      listLocal,
    };
    state.order += 1;
    // Kimlik çakışması doğrulamanın hatası; ilk tanım kazanır ki referanslar
    // hep daha ERKEN bir alana baksın.
    if (!state.byId.has(field.id)) {
      state.byId.set(field.id, entry);
    }
    planned.push(entry);
  }

  const scope: PlannedScope = { interfaceName, title, fields: planned };
  state.scopes.push(scope);
  return scope;
}

interface EmitState {
  readonly helpers: Set<HelperName>;
  usesView: boolean;
}

interface EmitContext {
  readonly schema: ProtocolSchema;
  readonly indent: string;
  readonly errorClass: string;
  readonly byId: ReadonlyMap<string, PlannedField>;
  readonly state: EmitState;
}

function useHelper(context: EmitContext, helper: HelperName): void {
  context.state.helpers.add(helper);
}

function line(out: string[], indent: string, depth: number, text: string): void {
  out.push(text === '' ? '' : `${indent.repeat(depth)}${text}`);
}

/** Referans edilen alan bu kapsamda ve bu satırdan ÖNCE tanımlı mı. */
function isVisibleFrom(
  target: PlannedField,
  currentChain: readonly string[],
  currentOrder: number,
): boolean {
  if (target.order >= currentOrder || target.blockChain.length > currentChain.length) {
    return false;
  }
  for (const [index, block] of target.blockChain.entries()) {
    if (currentChain[index] !== block) {
      return false;
    }
  }
  return true;
}

function resolveReference(
  context: EmitContext,
  id: string,
  currentChain: readonly string[],
  currentOrder: number,
): PlannedField | null {
  const target = context.byId.get(id);
  if (target === undefined || !isVisibleFrom(target, currentChain, currentOrder)) {
    return null;
  }
  return target;
}

/** Yerelin sayı olarak okunacak hâli: `bigint` daraltılır, koşullu alan `?? 0` alır. */
function numericReference(target: PlannedField): string {
  const base = target.optional ? `(${target.local} ?? 0)` : target.local;
  return target.tsType === 'bigint' ? `Number(${base})` : base;
}

function isLittleEndian(schema: ProtocolSchema, field: ProtocolFieldSchema): boolean {
  return (field.endianness ?? schema.defaultEndianness ?? 'big') === 'little';
}

interface LeafRead {
  /** Okumadan önce yazılacak bildirimler (dinamik uzunluk gibi). */
  readonly prelude: readonly string[];
  readonly expression: string;
  /** İmlecin ilerleyeceği bayt sayısı — sabit ya da bir yerel adı. */
  readonly advance: string;
}

/** Anlamsal tamsayı ailesinde genişlik bilinmiyorsa C üreticisiyle aynı düşüş. */
const FALLBACK_INTEGER_WIDTH = 4;

/**
 * Uzunluğu şemadan gelen alanlarda (metin, ham bayt, BCD) bayt sayısını çözer.
 * `lengthFrom` görünmüyorsa kalan baytların tamamı alınır — üretilen kod
 * derlenmeye devam etsin, ama satırın üstünde neden yazsın.
 */
function resolveDynamicLength(
  context: EmitContext,
  planned: PlannedField,
  prelude: string[],
): string {
  const { field } = planned;
  if (field.lengthFrom !== undefined && planned.byteLengthLocal !== null) {
    const target = resolveReference(
      context,
      field.lengthFrom,
      planned.blockChain,
      planned.order,
    );
    if (target === null) {
      prelude.push(
        `// Uzunluk alanı "${commentText(field.lengthFrom)}" bu kapsamda görünmüyor; kalan baytlar alındı.`,
      );
      prelude.push(
        `const ${planned.byteLengthLocal} = ${FRAME_PARAMETER}.length - ${CURSOR_LOCAL};`,
      );
    } else {
      prelude.push(`const ${planned.byteLengthLocal} = ${numericReference(target)};`);
    }
    return planned.byteLengthLocal;
  }
  return numberLiteral(fieldByteLength(field) ?? 0);
}

/**
 * Basit algoritmanın hangi yardımcıyı çağıracağı. Sabit tablo: ad şablonla
 * (`compute${...}`) üretilseydi `HelperName` birleşimiyle bağı kopar, katalogda
 * yeni bir algoritma belirdiğinde derleyici uyarmaz olurdu.
 */
const SIMPLE_CHECKSUM_HELPERS: Readonly<Record<SimpleChecksumAlgorithm, HelperName>> = {
  xor8: 'computeXor8',
  sum8: 'computeSum8',
  lrc: 'computeLrc',
  nmeaXor: 'computeNmeaXor',
  fletcher16: 'computeFletcher16',
  fletcher32: 'computeFletcher32',
  adler32: 'computeAdler32',
};

/**
 * Üretilen ayrıştırıcı checksum alanını `readUnsignedNumber` ile `number` okur;
 * o yardımcı 2^53'ten büyük değeri sessizce yuvarlar. 48 bitten geniş bir CRC
 * (katalogda CRC64) için karşılaştırma bu yüzden ÜRETİLMEZ — üretilseydi
 * doğrulama rastgele başarısız olur, kullanıcı hatayı kendi protokolünde
 * arardı.
 */
const MAX_VERIFIABLE_CRC_WIDTH_BITS = 48;

/** Katalogdaki değerler `0x8005n` gibi, register genişliğine göre sıfır dolgulu yazılır. */
function crcHexLiteral(value: bigint, width: number): string {
  return `0x${value.toString(16).padStart(Math.ceil(width / 4), '0')}n`;
}

/** CRC parametre nesnesinin satırları; çağıran girintiyi kendi verir. */
function crcParameterLines(params: CrcParams): readonly string[] {
  return [
    `width: ${params.width},`,
    `poly: ${crcHexLiteral(params.poly, params.width)},`,
    `init: ${crcHexLiteral(params.init, params.width)},`,
    `refin: ${params.refin},`,
    `refout: ${params.refout},`,
    `xorout: ${crcHexLiteral(params.xorout, params.width)},`,
  ];
}

/** Bir yaprak alanın okuma ifadesi. */
function leafRead(context: EmitContext, planned: PlannedField): LeafRead {
  const { field } = planned;
  const prelude: string[] = [];
  const little = isLittleEndian(context.schema, field);
  const littleText = little ? 'true' : 'false';
  const cursor = CURSOR_LOCAL;
  const view = VIEW_LOCAL;

  const dataView = (expression: string, advance: number): LeafRead => {
    context.state.usesView = true;
    return { prelude, expression, advance: String(advance) };
  };

  switch (field.type) {
    case 'uint8':
      return dataView(`${view}.getUint8(${cursor})`, 1);
    case 'int8':
      return dataView(`${view}.getInt8(${cursor})`, 1);
    case 'uint16':
      return dataView(`${view}.getUint16(${cursor}, ${littleText})`, 2);
    case 'int16':
      return dataView(`${view}.getInt16(${cursor}, ${littleText})`, 2);
    case 'uint24':
      useHelper(context, 'readUint24');
      return dataView(`readUint24(${view}, ${cursor}, ${littleText})`, 3);
    case 'int24':
      useHelper(context, 'readInt24');
      return dataView(`readInt24(${view}, ${cursor}, ${littleText})`, 3);
    case 'uint32':
      return dataView(`${view}.getUint32(${cursor}, ${littleText})`, 4);
    case 'int32':
      return dataView(`${view}.getInt32(${cursor}, ${littleText})`, 4);
    case 'uint64':
      return dataView(`${view}.getBigUint64(${cursor}, ${littleText})`, 8);
    case 'int64':
      return dataView(`${view}.getBigInt64(${cursor}, ${littleText})`, 8);
    case 'float16':
      useHelper(context, 'decodeFloat16');
      return dataView(`decodeFloat16(${view}, ${cursor}, ${littleText})`, 2);
    case 'float32':
      return dataView(`${view}.getFloat32(${cursor}, ${littleText})`, 4);
    case 'float64':
      return dataView(`${view}.getFloat64(${cursor}, ${littleText})`, 8);
    case 'boolean':
      return dataView(`${view}.getUint8(${cursor}) !== 0`, 1);
    case 'unixTimestamp':
      return dataView(`${view}.getUint32(${cursor}, ${littleText})`, 4);
    case 'dateTime':
      return dataView(`${view}.getBigUint64(${cursor}, ${littleText})`, 8);
    case 'bitField': {
      useHelper(context, 'readBits');
      const bitOffset = field.bitOffset ?? 0;
      const bitLength = field.bitLength ?? 1;
      const msbFirst = (field.bitOrder ?? 'msb-first') === 'msb-first';
      return {
        prelude,
        expression: `readBits(${FRAME_PARAMETER}, ${cursor}, ${bitOffset}, ${bitLength}, ${msbFirst})`,
        advance: String(Math.ceil((bitOffset + bitLength) / 8)),
      };
    }
    case 'ascii': {
      useHelper(context, 'decodeAscii');
      const length = resolveDynamicLength(context, planned, prelude);
      return {
        prelude,
        expression: `decodeAscii(${FRAME_PARAMETER}, ${cursor}, ${length})`,
        advance: length,
      };
    }
    case 'utf8': {
      useHelper(context, 'decodeUtf8');
      const length = resolveDynamicLength(context, planned, prelude);
      return {
        prelude,
        expression: `decodeUtf8(${FRAME_PARAMETER}, ${cursor}, ${length})`,
        advance: length,
      };
    }
    case 'bcd': {
      useHelper(context, 'decodeBcd');
      const length = resolveDynamicLength(context, planned, prelude);
      return {
        prelude,
        expression: `decodeBcd(${FRAME_PARAMETER}, ${cursor}, ${length})`,
        advance: length,
      };
    }
    case 'rawBytes':
    case 'padding':
    case 'reserved':
    case 'delimiter': {
      const length = resolveDynamicLength(context, planned, prelude);
      // `slice` KOPYALAR: `subarray` çerçeve tamponuna bakardı ve çağıran
      // tamponu yeniden kullanırsa alan sessizce değişirdi.
      return {
        prelude,
        expression: `${FRAME_PARAMETER}.slice(${cursor}, ${cursor} + ${length})`,
        advance: length,
      };
    }
    case 'enum':
    case 'length':
    case 'sequenceCounter':
    case 'address':
    case 'command':
    case 'checksum':
    case 'crc': {
      useHelper(context, 'readUnsignedNumber');
      const width = fieldByteLength(field);
      const resolved = width === null || width <= 0 ? FALLBACK_INTEGER_WIDTH : width;
      if (width === null || width <= 0) {
        prelude.push(
          `// Şemada genişlik yok; C üreticisiyle aynı düşüşle ${FALLBACK_INTEGER_WIDTH} bayt varsayıldı.`,
        );
      }
      return {
        prelude,
        expression: `readUnsignedNumber(${FRAME_PARAMETER}, ${cursor}, ${resolved}, ${littleText})`,
        advance: String(resolved),
      };
    }
    case 'array':
    case 'structure':
      // Bileşik alanlar buraya gelmez; `emitScope` onları ayrı yolda işler.
      throw new Error(`leafRead: "${field.id}" bileşik alan`);
  }
}

/** Checksum/CRC alanından sonra yazılan doğrulama bloğu. */
function emitChecksumVerification(
  context: EmitContext,
  planned: PlannedField,
  out: string[],
  depth: number,
): void {
  const { field } = planned;
  const { indent, errorClass } = context;
  const algorithm = field.algorithm;
  const coverage = field.coverage;
  if (algorithm === undefined || algorithm === 'none' || coverage === undefined) {
    return;
  }
  if (planned.optional) {
    // Koşullu checksum yereli `number | undefined`; karşılaştırma derlenmez.
    line(out, indent, depth, '// Koşullu checksum alanı için doğrulama üretilmedi.');
    return;
  }
  const start = resolveReference(context, coverage.startField, planned.blockChain, planned.order);
  const end = resolveReference(context, coverage.endField, planned.blockChain, planned.order);
  if (
    start === null ||
    end === null ||
    start.coverageStartLocal === null ||
    end.coverageEndLocal === null
  ) {
    line(
      out,
      indent,
      depth,
      '// Kapsam alanları bu kapsamda görünmüyor; doğrulama üretilemedi.',
    );
    return;
  }

  const covered = `${FRAME_PARAMETER}.subarray(${start.coverageStartLocal}, ${end.coverageEndLocal})`;
  const computedLocal = `${planned.local}Computed`;

  if (isSimpleChecksumAlgorithm(algorithm)) {
    const helper = SIMPLE_CHECKSUM_HELPERS[algorithm];
    useHelper(context, helper);
    line(out, indent, depth, `const ${computedLocal} = ${helper}(${covered});`);
    line(out, indent, depth, `if (${computedLocal} !== ${planned.local}) {`);
  } else {
    const crcParams = CRC_CATALOGUE[algorithm];
    if (crcParams.width > MAX_VERIFIABLE_CRC_WIDTH_BITS) {
      line(
        out,
        indent,
        depth,
        `// ${algorithm} ${crcParams.width} bit: alan \`number\` okunuyor ve 2^53'ü aşıyor,`,
      );
      line(out, indent, depth, '// karşılaştırma sessizce yanlış olurdu; doğrulama üretilmedi.');
      return;
    }
    useHelper(context, 'computeCrc');
    line(out, indent, depth, `const ${computedLocal} = computeCrc(${covered}, {`);
    for (const parameterLine of crcParameterLines(crcParams)) {
      line(out, indent, depth + 1, parameterLine);
    }
    line(out, indent, depth, '});');
    line(out, indent, depth, `if (${computedLocal} !== BigInt(${planned.local})) {`);
  }
  line(
    out,
    indent,
    depth + 1,
    `throw new ${errorClass}(`,
  );
  line(
    out,
    indent,
    depth + 2,
    `${quote(`${commentText(field.name)} uyuşmuyor: hesaplanan `)} +`,
  );
  line(out, indent, depth + 3, `String(${computedLocal}) +`);
  line(out, indent, depth + 3, `${quote(', çerçevede ')} +`);
  line(out, indent, depth + 3, `String(${planned.local}),`);
  line(out, indent, depth + 1, ');');
  line(out, indent, depth, '}');
}

function emitPhysicalValue(planned: PlannedField, out: string[], indent: string, depth: number, assign: boolean): void {
  if (planned.physicalLocal === null) {
    return;
  }
  const scale = planned.field.scale ?? 1;
  const offset = planned.field.calibrationOffset ?? 0;
  const raw = planned.tsType === 'bigint' ? `Number(${planned.local})` : planned.local;
  const scaled = scale === 1 ? raw : `${raw} * ${numberLiteral(scale)}`;
  const expression =
    offset === 0
      ? scaled
      : `${scaled} ${offset < 0 ? '-' : '+'} ${numberLiteral(Math.abs(offset))}`;
  const keyword = assign ? '' : 'const ';
  line(out, indent, depth, `${keyword}${planned.physicalLocal} = ${expression};`);
}

/** Nesne değişmezi satırları; `prefix` ilk satırın başına yazılır. */
function emitObjectLiteral(
  scope: PlannedScope,
  out: string[],
  indent: string,
  depth: number,
  prefix: string,
  suffix: string,
): void {
  line(out, indent, depth, `${prefix}{`);
  for (const planned of scope.fields) {
    line(out, indent, depth + 1, `${planned.property}: ${planned.local},`);
    if (planned.physicalProperty !== null && planned.physicalLocal !== null) {
      line(out, indent, depth + 1, `${planned.physicalProperty}: ${planned.physicalLocal},`);
    }
  }
  line(out, indent, depth, `}${suffix}`);
}

/**
 * Bir dizinin kaç eleman okuyacağını bilmiyorsak, dizinin ARDINDAN gelen sabit
 * uzunluklu alanların toplamı kadar bayt geride durmak gerekir; yoksa döngü
 * checksum'ı da yutar. Hesap yalnız sabit uzunluklarla yapılır: içinde dinamik
 * bir alan varsa `null` döner ve üretici geri durmayı bilemediğini yazar.
 */
function staticTailLength(fields: readonly ProtocolFieldSchema[]): number | null {
  let total = 0;
  for (const field of fields) {
    if (isSkippedField(field)) {
      continue;
    }
    if (isAggregateField(field)) {
      const inner = staticTailLength(field.fields ?? []);
      const repeat = typeof field.repeatCount === 'number' ? field.repeatCount : null;
      if (inner === null || repeat === null) {
        return null;
      }
      total += inner * repeat;
      continue;
    }
    const length = fieldByteLength(field);
    if (length === null) {
      return null;
    }
    total += length;
  }
  return total;
}

function emitScope(
  context: EmitContext,
  scope: PlannedScope,
  siblingsAfter: ReadonlyMap<string, readonly ProtocolFieldSchema[]>,
  out: string[],
  depth: number,
  insideArray: boolean,
): void {
  const { indent, errorClass } = context;

  for (const [fieldIndex, planned] of scope.fields.entries()) {
    const { field } = planned;

    // Alanlar arasında boş satır: üretilen gövde protokolün okunabilir tarifi olsun.
    if (fieldIndex > 0) {
      out.push('');
    }

    if (field.offset !== undefined) {
      if (insideArray) {
        line(out, indent, depth, `// Dizi elemanında mutlak ofset yok sayılır: ${field.offset}`);
      } else {
        line(out, indent, depth, `${CURSOR_LOCAL} = ${field.offset};`);
      }
    }

    if (planned.coverageStartLocal !== null) {
      line(out, indent, depth, `const ${planned.coverageStartLocal} = ${CURSOR_LOCAL};`);
    }

    // --- Koşul ---
    let bodyDepth = depth;
    if (planned.optional && field.condition !== undefined) {
      const target = resolveReference(
        context,
        field.condition.field,
        planned.blockChain.slice(0, -1),
        planned.order,
      );
      line(out, indent, depth, `let ${planned.local}: ${planned.tsType} | undefined;`);
      if (planned.physicalLocal !== null) {
        line(out, indent, depth, `let ${planned.physicalLocal}: number | undefined;`);
      }
      if (target === null) {
        line(
          out,
          indent,
          depth,
          `// Koşul alanı "${commentText(field.condition.field)}" bu kapsamda görünmüyor; alan koşulsuz okunuyor.`,
        );
        line(out, indent, depth, '{');
      } else {
        line(
          out,
          indent,
          depth,
          `if (${numericReference(target)} === ${numberLiteral(field.condition.equals)}) {`,
        );
      }
      bodyDepth = depth + 1;
    }

    const declaration = planned.optional ? `${planned.local} =` : `const ${planned.local} =`;

    if (planned.child !== null && field.type === 'structure') {
      emitScope(context, planned.child, siblingsAfter, out, bodyDepth, insideArray);
      const prefix = planned.optional
        ? `${planned.local} = `
        : `const ${planned.local}: ${planned.child.interfaceName} = `;
      emitObjectLiteral(planned.child, out, indent, bodyDepth, prefix, ';');
    } else if (planned.child !== null && field.type === 'array') {
      const elementType = planned.child.interfaceName;
      const listName = planned.listLocal ?? planned.local;
      line(out, indent, bodyDepth, `const ${listName}: ${elementType}[] = [];`);

      const repeat = field.repeatCount;
      let unbounded = false;
      if (typeof repeat === 'number') {
        line(out, indent, bodyDepth, `const ${planned.countLocal ?? 'count'} = ${repeat};`);
      } else if (repeat !== undefined) {
        const target = resolveReference(
          context,
          repeat.fromField,
          planned.blockChain,
          planned.order,
        );
        if (target === null) {
          line(
            out,
            indent,
            bodyDepth,
            `// Tekrar sayısı alanı "${commentText(repeat.fromField)}" bu kapsamda görünmüyor.`,
          );
          unbounded = true;
        } else {
          line(
            out,
            indent,
            bodyDepth,
            `const ${planned.countLocal ?? 'count'} = ${numericReference(target)};`,
          );
        }
      } else {
        unbounded = true;
      }

      if (unbounded) {
        const tail = staticTailLength(siblingsAfter.get(field.id) ?? []);
        const endBytes = context.schema.framing.endBytes?.length ?? 0;
        const guard = tail === null ? 0 : tail + (insideArray ? 0 : endBytes);
        if (tail === null) {
          line(
            out,
            indent,
            bodyDepth,
            '// Diziden sonraki alanların uzunluğu sabit değil; geri durulacak bayt hesaplanamadı.',
          );
        }
        line(out, indent, bodyDepth, '// Tekrar sayısı bilinmiyor: dizi kalan baytlar bitene kadar okunur.');
        line(
          out,
          indent,
          bodyDepth,
          `while (${CURSOR_LOCAL} < ${FRAME_PARAMETER}.length - ${guard}) {`,
        );
        line(
          out,
          indent,
          bodyDepth + 1,
          `const ${planned.elementStartLocal ?? 'elementStart'} = ${CURSOR_LOCAL};`,
        );
      } else {
        const indexName = planned.indexLocal ?? 'index';
        line(
          out,
          indent,
          bodyDepth,
          `for (let ${indexName} = 0; ${indexName} < ${planned.countLocal ?? 'count'}; ${indexName} += 1) {`,
        );
      }

      emitScope(context, planned.child, siblingsAfter, out, bodyDepth + 1, true);
      emitObjectLiteral(
        planned.child,
        out,
        indent,
        bodyDepth + 1,
        `${listName}.push(`,
        ');',
      );

      if (unbounded) {
        const startName = planned.elementStartLocal ?? 'elementStart';
        line(out, indent, bodyDepth + 1, `if (${CURSOR_LOCAL} <= ${startName}) {`);
        line(
          out,
          indent,
          bodyDepth + 2,
          `throw new ${errorClass}(${quote('Dizi elemanı hiç bayt tüketmedi; şema sonsuz döngüye giriyor')});`,
        );
        line(out, indent, bodyDepth + 1, '}');
      }
      line(out, indent, bodyDepth, '}');
      if (planned.optional) {
        line(out, indent, bodyDepth, `${planned.local} = ${listName};`);
      }
    } else {
      const read = leafRead(context, planned);
      for (const preludeLine of read.prelude) {
        line(out, indent, bodyDepth, preludeLine);
      }
      useHelper(context, 'ensureAvailable');
      line(
        out,
        indent,
        bodyDepth,
        `ensureAvailable(${FRAME_PARAMETER}, ${CURSOR_LOCAL}, ${read.advance});`,
      );
      line(out, indent, bodyDepth, `${declaration} ${read.expression};`);
      line(out, indent, bodyDepth, `${CURSOR_LOCAL} += ${read.advance};`);
      emitPhysicalValue(planned, out, indent, bodyDepth, planned.optional);
    }

    if (planned.optional) {
      line(out, indent, depth, '}');
    }

    if (planned.coverageEndLocal !== null) {
      line(out, indent, depth, `const ${planned.coverageEndLocal} = ${CURSOR_LOCAL};`);
    }

    if (field.type === 'checksum' || field.type === 'crc') {
      emitChecksumVerification(context, planned, out, depth);
    }
  }
}

/** Her bileşik alanın ARDINDAN gelen kardeşleri: dizi geri durma payı için. */
function collectSiblingsAfter(
  fields: readonly ProtocolFieldSchema[],
  target: Map<string, readonly ProtocolFieldSchema[]>,
): void {
  for (const [index, field] of fields.entries()) {
    if (isAggregateField(field)) {
      target.set(field.id, fields.slice(index + 1));
      collectSiblingsAfter(field.fields ?? [], target);
    }
  }
}

function emitInterface(scope: PlannedScope, indent: string, out: string[]): void {
  out.push(`/** ${commentText(scope.title)} */`);
  out.push(`export interface ${scope.interfaceName} {`);
  if (scope.fields.length === 0) {
    out.push(`${indent}// Şemada bu kapsam için iç alan tanımlanmamış.`);
  }
  for (const planned of scope.fields) {
    const { field } = planned;
    const parts = [commentText(field.name)];
    if (field.description !== undefined) {
      parts.push(commentText(field.description));
    }
    if (field.unit !== undefined) {
      parts.push(`Birim: ${commentText(field.unit)}`);
    }
    out.push(`${indent}/** ${parts.join(' — ')} */`);
    out.push(
      `${indent}readonly ${planned.property}${planned.optional ? '?' : ''}: ${planned.tsType};`,
    );
    if (planned.physicalProperty !== null) {
      out.push(
        `${indent}/** Fiziksel değer: ham × ölçek + kalibrasyon sabiti. */`,
      );
      out.push(
        `${indent}readonly ${planned.physicalProperty}${planned.optional ? '?' : ''}: number;`,
      );
    }
  }
  out.push('}');
}

function emitEnum(planned: PlannedField, indent: string, out: string[]): void {
  const enumeration = planned.enumeration;
  if (enumeration === null) {
    return;
  }
  out.push(`/** ${commentText(planned.field.name)} değer tablosu. */`);
  out.push(`export const ${enumeration.constName} = {`);
  for (const [key, label] of enumeration.entries) {
    // Anahtar TIRNAKLI: negatif değerler tırnaksız yazılamaz.
    out.push(`${indent}${quote(key)}: ${quote(label)},`);
  }
  out.push('} as const;');
  out.push('');
  out.push(
    `export type ${enumeration.typeName} = (typeof ${enumeration.constName})[keyof typeof ${enumeration.constName}];`,
  );
  out.push('');
  out.push(`/** Ham değerin adı; tabloda yoksa \`undefined\`. */`);
  out.push(`export function ${enumeration.labelName}(value: number): string | undefined {`);
  // `Record<string, string>` ara değişkeni bilerek: doğrudan indekslemek
  // `keyof typeof` daraltması gerektirir, o da tabloda olmayan değerde yalan söyler.
  out.push(`${indent}const table: Readonly<Record<string, string>> = ${enumeration.constName};`);
  out.push(`${indent}return table[String(value)];`);
  out.push('}');
}

function collectEnums(scope: PlannedScope, into: PlannedField[]): void {
  for (const planned of scope.fields) {
    if (planned.enumeration !== null) {
      into.push(planned);
    }
    if (planned.child !== null) {
      collectEnums(planned.child, into);
    }
  }
}

/**
 * Şemadan bağımsız bir TypeScript ayrıştırıcısı üretir.
 *
 * Dönen `code` derlenebilir TypeScript METNİdir; bu paket onu çalıştırmaz.
 */
export function generateTypeScriptParser(
  schema: ProtocolSchema,
  options: CodegenOptions = {},
): GeneratedArtifact {
  const indent = options.indent ?? DEFAULT_INDENT;
  const registry: NameRegistry = {
    used: new Set<string>([
      FRAME_PARAMETER,
      VIEW_LOCAL,
      CURSOR_LOCAL,
      ...RESERVED_WORDS,
      ...HELPER_NAMES,
      'CrcParameters',
    ]),
  };

  const rootPascal = toIdentifier(schema.name, 'pascal');
  const rootCamel = toIdentifier(schema.name, 'camel');
  const interfaceName = takeName(registry, rootPascal);
  const errorClass = takeName(registry, `${interfaceName}ParseError`);
  const parseFunction = takeName(registry, `parse${interfaceName}`);

  const coverageStarts = new Set<string>();
  const coverageEnds = new Set<string>();
  collectCoverage(schema.fields, coverageStarts, coverageEnds);

  const planState: PlanState = {
    registry,
    byId: new Map<string, PlannedField>(),
    coverageStarts,
    coverageEnds,
    scopes: [],
    order: 0,
  };
  const rootScope = planScope(
    schema.fields,
    interfaceName,
    `${schema.name} — sürüm ${schema.version}`,
    [],
    interfaceName,
    planState,
  );

  const emitState: EmitState = { helpers: new Set<HelperName>(), usesView: false };
  const context: EmitContext = {
    schema,
    indent,
    errorClass,
    byId: planState.byId,
    state: emitState,
  };

  const siblingsAfter = new Map<string, readonly ProtocolFieldSchema[]>();
  collectSiblingsAfter(schema.fields, siblingsAfter);

  // Gövde ÖNCE üretilir: hangi yardımcıların yazılacağı ancak üretim bitince belli.
  const body: string[] = [];
  emitScope(context, rootScope, siblingsAfter, body, 1, false);

  const framing = schema.framing;
  const startBytes = framing.startBytes ?? [];
  const endBytes = framing.endBytes ?? [];
  const checksFraming = framing.type === 'startEnd' || framing.type === 'startOnly';

  const preamble: string[] = [];
  line(preamble, indent, 1, `if (${FRAME_PARAMETER}.length > ${framing.maximumFrameLength}) {`);
  line(
    preamble,
    indent,
    2,
    `throw new ${errorClass}(${quote(`Çerçeve azami uzunluğu aşıyor: ${framing.maximumFrameLength} bayt`)});`,
  );
  line(preamble, indent, 1, '}');
  if (checksFraming && startBytes.length > 0) {
    line(preamble, indent, 1, `const expectedStart = [${startBytes.join(', ')}];`);
    line(preamble, indent, 1, 'for (const [index, expected] of expectedStart.entries()) {');
    // Ham indeks erişimi `undefined` dönebilir; guard bilerek yazılıyor.
    line(preamble, indent, 2, `const actual = ${FRAME_PARAMETER}[index];`);
    line(preamble, indent, 2, 'if (actual !== expected) {');
    line(
      preamble,
      indent,
      3,
      `throw new ${errorClass}(${quote('Çerçeve başlangıç baytları uyuşmuyor')});`,
    );
    line(preamble, indent, 2, '}');
    line(preamble, indent, 1, '}');
  }
  if (framing.type === 'startEnd' && endBytes.length > 0) {
    line(preamble, indent, 1, `const expectedEnd = [${endBytes.join(', ')}];`);
    line(preamble, indent, 1, 'for (const [index, expected] of expectedEnd.entries()) {');
    line(
      preamble,
      indent,
      2,
      `const actual = ${FRAME_PARAMETER}[${FRAME_PARAMETER}.length - expectedEnd.length + index];`,
    );
    line(preamble, indent, 2, 'if (actual !== expected) {');
    line(
      preamble,
      indent,
      3,
      `throw new ${errorClass}(${quote('Çerçeve bitiş baytları uyuşmuyor')});`,
    );
    line(preamble, indent, 2, '}');
    line(preamble, indent, 1, '}');
  }
  if (emitState.usesView) {
    line(
      preamble,
      indent,
      1,
      `const ${VIEW_LOCAL} = new DataView(${FRAME_PARAMETER}.buffer, ${FRAME_PARAMETER}.byteOffset, ${FRAME_PARAMETER}.byteLength);`,
    );
  }
  line(preamble, indent, 1, `let ${CURSOR_LOCAL} = 0;`);

  // --- Parçaları birleştir ---
  const sections: string[] = [];

  if (options.banner !== false) {
    sections.push(bannerFor('c', schema.name));
  }
  sections.push(
    [
      '/*',
      ' * Bu ayrıştırıcı ŞEMADAN ÜRETİLMİŞ METİNdir; ALP Comm Toolkit onu',
      ' * çalıştırmaz. Dosya bağımsızdır: hiçbir paket kurmadan derlenir ve',
      ' * `strict` + `noUncheckedIndexedAccess` altında geçerlidir.',
      ' */',
    ].join('\n'),
  );

  const errorLines: string[] = [];
  errorLines.push('/** Çerçeve şemaya uymadığında atılır. */');
  errorLines.push(`export class ${errorClass} extends Error {`);
  errorLines.push(`${indent}constructor(message: string) {`);
  errorLines.push(`${indent.repeat(2)}super(message);`);
  errorLines.push(`${indent.repeat(2)}this.name = ${quote(errorClass)};`);
  errorLines.push(`${indent}}`);
  errorLines.push('}');
  sections.push(errorLines.join('\n'));

  const enumFields: PlannedField[] = [];
  collectEnums(rootScope, enumFields);
  for (const planned of enumFields) {
    const enumLines: string[] = [];
    emitEnum(planned, indent, enumLines);
    sections.push(enumLines.join('\n'));
  }

  // Arayüzler: iç kapsamlar önce, kök en sonda (okuma sırası içten dışa).
  for (const scope of planState.scopes) {
    const interfaceLines: string[] = [];
    emitInterface(scope, indent, interfaceLines);
    sections.push(interfaceLines.join('\n'));
  }

  // Bağımlılıkları kapat: `readInt24` `readUint24`siz derlenmez.
  const helperNames = new Set<HelperName>(emitState.helpers);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const helper of HELPER_NAMES) {
      if (!helperNames.has(helper)) {
        continue;
      }
      for (const dependency of HELPER_DEPENDENCIES[helper]) {
        if (!helperNames.has(dependency)) {
          helperNames.add(dependency);
          expanded = true;
        }
      }
    }
  }
  // Sabit liste üzerinden gezilir: `Set` sırası çıktıyı belirlemesin.
  for (const helper of HELPER_NAMES) {
    if (helperNames.has(helper)) {
      sections.push(
        reindent(HELPER_SOURCES[helper].replaceAll(ERROR_CLASS_TOKEN, errorClass), indent),
      );
    }
  }

  const parseLines: string[] = [];
  parseLines.push(`/** Çerçeveyi çözümler; şema tutmuyorsa ${errorClass} atar. */`);
  parseLines.push(
    `export function ${parseFunction}(${FRAME_PARAMETER}: Uint8Array): ${interfaceName} {`,
  );
  parseLines.push(...preamble);
  parseLines.push('');
  parseLines.push(...body);
  parseLines.push('');
  const returnLines: string[] = [];
  emitObjectLiteral(rootScope, returnLines, indent, 1, 'return ', ';');
  parseLines.push(...returnLines);
  parseLines.push('}');
  sections.push(parseLines.join('\n'));

  return {
    id: 'typescript-parser',
    language: 'typescript',
    fileName: `${rootCamel}Parser.ts`,
    code: `${sections.join('\n\n')}\n`,
  };
}
