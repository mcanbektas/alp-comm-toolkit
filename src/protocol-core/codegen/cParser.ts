/**
 * Şemadan C99 ayrıştırıcı kaynağı üretir — spec §9.5 "Code Generation".
 *
 * Üretilen şey METİNdir ve uygulama onu ASLA çalıştırmaz (spec §41 `eval` ve
 * dinamik kod çalıştırma yasağı): kullanıcı kopyalar, kendi gömülü projesinde
 * derler. Bu yüzden çıktı gömülü hedefin kısıtlarına uyar:
 *
 * - `malloc` yok, VLA yok, özyineleme yok — yığın kullanımı derleme zamanında bellidir.
 * - Dinamik uzunluklu alanlar KOPYALANMAZ; struct alanı çerçeve tamponuna bakan
 *   bir işaretçidir (sıfır kopya). İşaretçi, tampon yaşadığı sürece geçerlidir.
 * - CRC tablosuz, bit bit hesaplanır: 512 baytlık tablo küçük bir MCU'da
 *   çıktının kendisinden pahalıya gelir.
 *
 * Üretilen `.c` dosyası, C struct üreticisinin başlığını (`<ad>.h`) içerir;
 * tanımlayıcılar iki üreticide de `codegenSupport`tan geldiği için aynıdır.
 *
 * Fonksiyon SAFtır: aynı şema her zaman bayt bayt aynı metni verir (tarih,
 * rastgele kimlik, koleksiyon gezinme sırasına bağlı çıktı yok).
 */

import { CRC_CATALOGUE, type CrcAlgorithmId } from '../checksums/crcCatalogue';
import type { ProtocolFieldSchema, ProtocolSchema } from '../schemas/protocolSchema';
import {
  bannerFor,
  cTypeFor,
  fieldByteLength,
  isAggregateField,
  toIdentifier,
  toUniqueIdentifiers,
} from './codegenSupport';
import { DEFAULT_INDENT, type CodegenOptions, type GeneratedArtifact } from './types';

/** Alan başına yazılmadıysa şemanın varsayılanı, o da yoksa big-endian. */
type FieldEndianness = NonNullable<ProtocolFieldSchema['endianness']>;

type ChecksumAlgorithmName = NonNullable<ProtocolFieldSchema['algorithm']>;

/**
 * C/C++ ayrılmış sözcükleri — `cStruct.ts`teki listenin AYNISI.
 *
 * Kopya bilinçli: iki üretici de aynı üye adına varmak ZORUNDA (ayrıştırıcı
 * struct'a yazıyor), ama üreticiler birbirini import etmemeli — biri diğerinin
 * iç yardımcılarına bağlanırsa barrel bunları dışa sızdırır. Liste değişirse
 * ikisi birden değişmeli; ayrık düşerlerse `char_` alanına `char` diye yazan bir
 * ayrıştırıcı üretilir ve derlenmez.
 */
const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'char', 'class', 'const',
  'constexpr', 'continue', 'default', 'delete', 'do', 'double', 'else', 'enum',
  'extern', 'false', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
  'namespace', 'new', 'nullptr', 'operator', 'private', 'protected', 'public',
  'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static',
  'static_assert', 'struct', 'switch', 'template', 'this', 'thread_local',
  'throw', 'true', 'try', 'typedef', 'typeof', 'union', 'unsigned', 'using',
  'virtual', 'void', 'volatile', 'while',
]);

function escapeReserved(identifier: string): string {
  return RESERVED_WORDS.has(identifier) ? `${identifier}_` : identifier;
}

/**
 * Tip adı parçası — `cStruct.ts` ile aynı kural. `toIdentifier` hiç harf
 * kalmayan adlarda pascal biçimde bile küçük harfli `field` döndürür; tip adının
 * ortasında kalmasın diye baş harf burada büyütülür.
 */
function typeNamePart(name: string): string {
  const pascal = toIdentifier(name, 'pascal');
  return pascal.charAt(0).toUpperCase() + pascal.slice(1);
}

/** `AlpSensorProtocolHeader` → `ALP_SENSOR_PROTOCOL_HEADER`. */
function macroPrefixOf(typeName: string): string {
  return toIdentifier(typeName, 'snake').toUpperCase();
}

interface ErrorCodeSpec {
  readonly suffix: string;
  readonly value: number;
  readonly comment: string;
}

/**
 * Dönüş sözleşmesi: 0 başarı, negatif hata. Beş kodun tamamı her zaman
 * tanımlanır — şema o dalı üretmese bile çağıranın `switch`i sabit kalsın,
 * şema değişince sayısal değerler kaymasın.
 */
const ERROR_CODES: readonly ErrorCodeSpec[] = [
  { suffix: 'ERR_TOO_SHORT', value: -1, comment: 'Çerçeve şemadaki asgari uzunluktan kısa' },
  { suffix: 'ERR_BAD_START', value: -2, comment: 'Başlangıç imzası tutmadı' },
  { suffix: 'ERR_BAD_END', value: -3, comment: 'Bitiş imzası tutmadı' },
  {
    suffix: 'ERR_LENGTH_MISMATCH',
    value: -4,
    comment: 'Uzunluk alanı çerçevenin gerçek boyuyla çelişiyor',
  },
  { suffix: 'ERR_CHECKSUM', value: -5, comment: 'Checksum/CRC doğrulaması başarısız' },
];

/** Satırlar girintisiz toplanır, girinti render sırasında verilir. */
interface EmittedLine {
  readonly depth: number;
  readonly text: string;
}

class CodeBuffer {
  private readonly entries: EmittedLine[] = [];

  line(depth: number, text: string): void {
    this.entries.push({ depth, text });
  }

  blank(): void {
    this.entries.push({ depth: 0, text: '' });
  }

  /** Blok açılışından ya da başka bir boşluktan hemen sonra boş satır açmaz. */
  blankUnlessFresh(): void {
    const last = this.entries[this.entries.length - 1];
    if (last === undefined || last.text === '' || last.text.endsWith('{')) {
      return;
    }
    this.blank();
  }

  /** Boş satır girintilenmez: sonda boşluk = diff gürültüsü. */
  render(indent: string): string {
    return this.entries
      .map((entry) => (entry.text === '' ? '' : `${indent.repeat(entry.depth)}${entry.text}`))
      .join('\n');
  }
}

/**
 * Yerel değişken adı dağıtıcısı. Şemadaki iki alan aynı tanımlayıcıya inebilir
 * ve `data`/`length`/`out`/`offset` zaten fonksiyon imzasında tutulu — çakışan
 * bir yerel bildirim üretilen kodu derlenmez yapardı.
 */
function createNameAllocator(reserved: readonly string[]): (base: string) => string {
  const used = new Set<string>(reserved);
  return (base: string): string => {
    let candidate = base;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }
    used.add(candidate);
    return candidate;
  };
}

function hexByte(value: number): string {
  return `0x${(value & 0xff).toString(16).toUpperCase().padStart(2, '0')}u`;
}

/** `crc`/maske sabitleri için genişliğe göre sıfır dolgulu onaltılık. */
function hexOfWidth(value: bigint, widthBits: number): string {
  const digits = Math.max(1, Math.ceil(widthBits / 4));
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/**
 * C kayan nokta sabiti. `float` sonekli yazılır: soneksiz sabit `double`dır ve
 * her çarpımda gereksiz bir dönüşüm doğurur (FPU'suz MCU'da pahalı).
 */
function cFloatLiteral(value: number): string {
  const text = Number.isInteger(value) ? `${value}.0` : String(value);
  return `${text}f`;
}

function unsignedTypeForBytes(byteLength: number): string {
  const bits = byteLength <= 1 ? 8 : byteLength <= 2 ? 16 : byteLength <= 4 ? 32 : 64;
  return `uint${bits}_t`;
}

/** `uint16_t` → 16. Tanınmayan tipte 32'ye düşer (üretim durmasın). */
function storageBitsOf(cType: string): number {
  const match = /^u?int(\d+)_t$/.exec(cType);
  if (match === null) {
    return 32;
  }
  const bits = Number.parseInt(match[1] ?? '32', 10);
  return Number.isNaN(bits) ? 32 : bits;
}

/**
 * `byteLength` baytı `type` içinde birleştiren ifade — DIŞ dönüşüm olmadan;
 * çağıran zaten hedef tipe çevirir, burada da çevirmek `(uint16_t)(uint16_t)`
 * gibi çift dönüşüm üretirdi.
 *
 * Little ve big ayrı KOD YOLU değil, aynı döngünün ters indekslenmesidir:
 * üretilen kaynakta çalışma zamanı dalı kalmasın, bayt sırası derleme zamanında
 * sabitlensin.
 */
function byteAssembly(type: string, byteLength: number, endianness: FieldEndianness): string {
  if (byteLength <= 1) {
    return 'data[offset]';
  }
  const terms: string[] = [];
  for (let index = 0; index < byteLength; index += 1) {
    const shift = endianness === 'big' ? 8 * (byteLength - 1 - index) : 8 * index;
    const access = index === 0 ? 'data[offset]' : `data[offset + ${index}u]`;
    terms.push(shift === 0 ? `(${type})${access}` : `((${type})${access} << ${shift})`);
  }
  return `(${terms.join(' | ')})`;
}

interface HelperRequest {
  readonly algorithm: ChecksumAlgorithmName;
}

interface GeneratorContext {
  readonly buffer: CodeBuffer;
  /** Üretilen tüm dosya kapsamlı adların öneki (`alp_sensor_protocol`). */
  readonly prefix: string;
  /** Makro öneki (`ALP_SENSOR_PROTOCOL`). */
  readonly macroPrefix: string;
  readonly allocate: (base: string) => string;
  /** Fonksiyonun başına yazılacak yerel bildirimler. */
  readonly locals: string[];
  /** Alan kimliği → `out->header.item_count` gibi erişim ifadesi. */
  readonly accessPaths: Map<string, string>;
  /** Alan kimliği → o alan ÇÖZÜMLENMEDEN ÖNCE yazılacak imleç saklama satırları. */
  readonly coverageStarts: Map<string, string[]>;
  /** Alan kimliği → o alan çözümlendikten SONRA yazılacak satırlar. */
  readonly coverageEnds: Map<string, string[]>;
  /** Checksum alanı kimliği → doğrulamada kullanılacak kapsam değişkenleri. */
  readonly coverageVars: Map<string, { readonly start: string; readonly end: string }>;
  readonly helpers: HelperRequest[];
  readonly defaultEndianness: FieldEndianness;
}

function collectFieldIds(fields: readonly ProtocolFieldSchema[], into: Set<string>): void {
  for (const field of fields) {
    into.add(field.id);
    if (field.fields !== undefined) {
      collectFieldIds(field.fields, into);
    }
  }
}

function forEachField(
  fields: readonly ProtocolFieldSchema[],
  visit: (field: ProtocolFieldSchema) => void,
): void {
  for (const field of fields) {
    visit(field);
    if (field.fields !== undefined) {
      forEachField(field.fields, visit);
    }
  }
}

/**
 * Şemanın statik iskeletinin kapladığı en küçük bayt sayısı. Dinamik uzunluklu
 * alanlar 0 sayılır — bu sınır BİLEREK iyimserdir: fazla büyük bir sınır geçerli
 * çerçeveyi reddeder, küçüğü ise yalnız hatayı alan bazındaki sınır denetimine
 * erteler.
 */
function layoutEnd(fields: readonly ProtocolFieldSchema[], start: number): number {
  let cursor = start;
  for (const field of fields) {
    if (field.offset !== undefined) {
      cursor = field.offset;
    }
    if (isAggregateField(field)) {
      const children = field.fields ?? [];
      const elementEnd = layoutEnd(children, cursor);
      const elementSize = Math.max(0, elementEnd - cursor);
      // Tekrar sayısı başka bir alandan geliyorsa çalışma zamanında bellidir;
      // asgari uzunluğa katkısı 0 kabul edilir.
      const repeats = field.type === 'array' ? (typeof field.repeatCount === 'number' ? field.repeatCount : 0) : 1;
      cursor += elementSize * repeats;
      continue;
    }
    cursor += fieldByteLength(field) ?? 0;
  }
  return cursor;
}

function minimumFrameLength(schema: ProtocolSchema): number {
  const startLength = schema.framing.startBytes?.length ?? 0;
  const endLength = schema.framing.endBytes?.length ?? 0;
  const bodyEnd = layoutEnd(schema.fields, startLength);
  return Math.max(bodyEnd, startLength) + endLength;
}

/** Şemanın kullandığı checksum algoritmalarının C karşılığını üretir. */
function emitChecksumHelpers(ctx: GeneratorContext): void {
  const reflections = new Set<number>();
  for (const helper of ctx.helpers) {
    const params = CRC_CATALOGUE[helper.algorithm as CrcAlgorithmId] as
      | (typeof CRC_CATALOGUE)[CrcAlgorithmId]
      | undefined;
    if (params === undefined) {
      continue;
    }
    if (params.refin) {
      reflections.add(8);
    }
    if (params.refout) {
      reflections.add(params.width);
    }
  }

  // Set'in kendi gezinme sırasına GÜVENİLMEZ: çıktı deterministik olmalı.
  for (const width of [8, 16, 32, 64]) {
    if (!reflections.has(width)) {
      continue;
    }
    const type = `uint${width}_t`;
    ctx.buffer.line(0, `/* ${width} bitlik değerin bit sırasını ters çevirir (CRC refin/refout). */`);
    ctx.buffer.line(0, `static ${type} ${ctx.prefix}_reflect${width}(${type} value)`);
    ctx.buffer.line(0, '{');
    ctx.buffer.line(1, `${type} result = 0u;`);
    ctx.buffer.line(1, `for (unsigned bit = 0u; bit < ${width}u; bit++) {`);
    ctx.buffer.line(2, `if ((value & (${type})((${type})1u << bit)) != 0u) {`);
    ctx.buffer.line(3, `result = (${type})(result | (${type})((${type})1u << (${width - 1}u - bit)));`);
    ctx.buffer.line(2, '}');
    ctx.buffer.line(1, '}');
    ctx.buffer.line(1, 'return result;');
    ctx.buffer.line(0, '}');
    ctx.buffer.blank();
  }

  for (const helper of ctx.helpers) {
    emitChecksumHelper(ctx, helper.algorithm);
    ctx.buffer.blank();
  }
}

function checksumHelperName(prefix: string, algorithm: ChecksumAlgorithmName): string {
  return `${prefix}_${algorithm.toLowerCase()}`;
}

/** Algoritmanın C karşılığı; genişlik 8/16/32 bit olabilir. */
function checksumResultType(algorithm: ChecksumAlgorithmName): string {
  const params = CRC_CATALOGUE[algorithm as CrcAlgorithmId] as
    | (typeof CRC_CATALOGUE)[CrcAlgorithmId]
    | undefined;
  if (params === undefined) {
    return 'uint8_t';
  }
  return unsignedTypeForBytes(Math.ceil(params.width / 8));
}

function emitChecksumHelper(ctx: GeneratorContext, algorithm: ChecksumAlgorithmName): void {
  const name = checksumHelperName(ctx.prefix, algorithm);
  const { buffer } = ctx;

  if (algorithm === 'xor8') {
    buffer.line(0, '/* XOR8: kapsanan baytların bit bazında dışlayan-veya toplamı. */');
    buffer.line(0, `static uint8_t ${name}(const uint8_t *data, size_t length)`);
    buffer.line(0, '{');
    buffer.line(1, 'uint8_t result = 0u;');
    buffer.line(1, 'for (size_t index = 0u; index < length; index++) {');
    buffer.line(2, 'result = (uint8_t)(result ^ data[index]);');
    buffer.line(1, '}');
    buffer.line(1, 'return result;');
    buffer.line(0, '}');
    return;
  }

  if (algorithm === 'sum8') {
    buffer.line(0, '/* SUM8: baytların toplamı, mod 256 (uint8_t taşması kırpmayı kendisi yapar). */');
    buffer.line(0, `static uint8_t ${name}(const uint8_t *data, size_t length)`);
    buffer.line(0, '{');
    buffer.line(1, 'uint8_t result = 0u;');
    buffer.line(1, 'for (size_t index = 0u; index < length; index++) {');
    buffer.line(2, 'result = (uint8_t)(result + data[index]);');
    buffer.line(1, '}');
    buffer.line(1, 'return result;');
    buffer.line(0, '}');
    return;
  }

  if (algorithm === 'lrc') {
    buffer.line(0, '/* LRC (Modbus ASCII): bayt toplamının 8 bitlik two\'s complement\'i. */');
    buffer.line(0, `static uint8_t ${name}(const uint8_t *data, size_t length)`);
    buffer.line(0, '{');
    buffer.line(1, 'uint8_t sum = 0u;');
    buffer.line(1, 'for (size_t index = 0u; index < length; index++) {');
    buffer.line(2, 'sum = (uint8_t)(sum + data[index]);');
    buffer.line(1, '}');
    buffer.line(1, '/* Toplam 0 iken sonuç da 0 olmalı; uint8_t taşması bunu ayrı dal olmadan verir. */');
    buffer.line(1, 'return (uint8_t)(0u - (unsigned)sum);');
    buffer.line(0, '}');
    return;
  }

  const params = CRC_CATALOGUE[algorithm as CrcAlgorithmId] as
    | (typeof CRC_CATALOGUE)[CrcAlgorithmId]
    | undefined;
  if (params === undefined || (params.width !== 8 && params.width !== 16 && params.width !== 32)) {
    buffer.line(0, `/* ${algorithm}: bu üreticide DESTEKLENMİYOR (katalogda yok ya da genişliği`);
    buffer.line(0, '   8/16/32 bit değil); doğrulama atlandı, checksum alanı yalnız okunur. */');
    return;
  }

  const { width } = params;
  const type = `uint${width}_t`;
  const topBit = hexOfWidth(1n << BigInt(width - 1), width);
  buffer.line(
    0,
    `/* ${algorithm} — reveng "Catalogue of parametrised CRC algorithms" değerleri: poly=${hexOfWidth(params.poly, width)}`,
  );
  buffer.line(
    0,
    `   init=${hexOfWidth(params.init, width)} refin=${String(params.refin)} refout=${String(params.refout)} xorout=${hexOfWidth(params.xorout, width)}.`,
  );
  buffer.line(0, '   Tablo YOK: 256 girişlik tablo küçük bir MCU\'da kodun kendisinden pahalıdır;');
  buffer.line(0, '   bit bit döngü sabit yer kaplar. */');
  buffer.line(0, `static ${type} ${name}(const uint8_t *data, size_t length)`);
  buffer.line(0, '{');
  buffer.line(1, `${type} crc = ${hexOfWidth(params.init, width)}u;`);
  buffer.line(1, 'for (size_t index = 0u; index < length; index++) {');
  buffer.line(2, 'uint8_t current = data[index];');
  if (params.refin) {
    buffer.line(2, `current = ${ctx.prefix}_reflect8(current); /* refin */`);
  }
  if (width === 8) {
    buffer.line(2, `crc = (${type})(crc ^ current);`);
  } else {
    buffer.line(2, `crc = (${type})(crc ^ ((${type})current << ${width - 8}));`);
  }
  buffer.line(2, 'for (unsigned bit = 0u; bit < 8u; bit++) {');
  buffer.line(3, `if ((crc & ${topBit}u) != 0u) {`);
  buffer.line(4, `crc = (${type})((${type})(crc << 1) ^ ${hexOfWidth(params.poly, width)}u);`);
  buffer.line(3, '} else {');
  buffer.line(4, `crc = (${type})(crc << 1);`);
  buffer.line(3, '}');
  buffer.line(2, '}');
  buffer.line(1, '}');
  if (params.refout) {
    buffer.line(1, `crc = ${ctx.prefix}_reflect${width}(crc); /* refout */`);
  }
  buffer.line(1, `return (${type})(crc ^ ${hexOfWidth(params.xorout, width)}u);`);
  buffer.line(0, '}');
}

function endiannessOf(ctx: GeneratorContext, field: ProtocolFieldSchema): FieldEndianness {
  return field.endianness ?? ctx.defaultEndianness;
}

function emitBoundsCheck(
  ctx: GeneratorContext,
  depth: number,
  sizeExpression: string,
  errorSuffix: string,
): void {
  ctx.buffer.line(depth, `if (offset + ${sizeExpression} > length) {`);
  ctx.buffer.line(depth + 1, `return ${ctx.macroPrefix}_${errorSuffix};`);
  ctx.buffer.line(depth, '}');
}

/** Alanın başlığı: kimlik, ad, tip ve varsa birim — okunan kodun tek referansı. */
function fieldHeadline(field: ProtocolFieldSchema): string {
  const byteLength = fieldByteLength(field);
  const parts: string[] = [field.type];
  if (byteLength !== null) {
    parts.push(`${byteLength} bayt`);
  } else if (field.lengthFrom !== undefined) {
    parts.push(`uzunluk: \`${field.lengthFrom}\``);
  }
  if (field.unit !== undefined) {
    parts.push(field.unit);
  }
  return `/* ${field.id} — ${field.name} (${parts.join(', ')}) */`;
}

/** Zor tiplerde sessiz atlama YASAK: ne yapılmadığı üretilen kaynakta yazar. */
const DEFERRED_DECODING: Partial<Record<ProtocolFieldSchema['type'], string>> = {
  bcd: 'BCD paketli ondalık: her bayt iki basamak taşır. Sayıya çevirme çağırana bırakıldı.',
  utf8: 'UTF-8 ham bayt olarak alındı; çok baytlı kod noktalarının çözümlenmesi çağırana bırakıldı.',
  dateTime: '64 bit ham zaman damgası; takvim/dilim çözümlemesi çağırana bırakıldı.',
  unixTimestamp: 'Epoch saniyesi ham alındı; yerel saate çevirme çağırana bırakıldı.',
  float16: 'Yarım kayan noktanın C99 karşılığı yok; HAM 16 bit saklandı, çözümleme çağırana bırakıldı.',
};

function emitDeferredNote(ctx: GeneratorContext, field: ProtocolFieldSchema, depth: number): void {
  const note = DEFERRED_DECODING[field.type];
  if (note !== undefined) {
    ctx.buffer.line(depth, `/* ${note} */`);
  }
}

/**
 * `scale`/`calibrationOffset` varsa fiziksel değerin FORMÜLÜ (spec §9.2).
 *
 * Atama değil YORUM üretilir: üretilen başlıkta fiziksel değer için ayrı bir üye
 * yok (C struct üreticisi de formülü yalnız yorumda gösteriyor, çünkü `float`
 * kopyası hem yeri hem de tel üzerinde karşılığı olmayan bir alanı büyütürdü).
 * Var olmayan bir üyeye atama üretmek ayrıştırıcıyı derlenmez yapardı; ham değer
 * struct'ta, formül gözün önünde durur.
 */
function emitPhysicalValue(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  target: string,
  depth: number,
): void {
  const { scale, calibrationOffset } = field;
  if (scale === undefined && calibrationOffset === undefined) {
    return;
  }
  if (
    (scale !== undefined && !Number.isFinite(scale)) ||
    (calibrationOffset !== undefined && !Number.isFinite(calibrationOffset))
  ) {
    ctx.buffer.line(depth, '/* Ölçek/kalibrasyon sabiti sonlu bir sayı değil; formül yazılmadı. */');
    return;
  }
  let expression = `(float)${target}`;
  if (scale !== undefined) {
    expression += ` * ${cFloatLiteral(scale)}`;
  }
  if (calibrationOffset !== undefined && calibrationOffset !== 0) {
    expression +=
      calibrationOffset < 0
        ? ` - ${cFloatLiteral(Math.abs(calibrationOffset))}`
        : ` + ${cFloatLiteral(calibrationOffset)}`;
  }
  ctx.buffer.line(depth, '/* Fiziksel değer (spec §9.2) — struct HAM değeri tutar, dönüşüm çağıranın:');
  ctx.buffer.line(depth, `     ${expression} */`);
}

function emitEnumTable(ctx: GeneratorContext, field: ProtocolFieldSchema, depth: number): void {
  const values = field.enumValues;
  if (values === undefined) {
    return;
  }
  // Kayıt gezinme sırasına güvenilmez; sayısal sıra deterministiktir.
  const keys = Object.keys(values).sort((left, right) => Number(left) - Number(right));
  if (keys.length === 0) {
    return;
  }
  ctx.buffer.line(depth, '/* Tanımlı değerler:');
  for (const key of keys) {
    ctx.buffer.line(depth, `     ${key} = ${values[key] ?? ''}`);
  }
  ctx.buffer.line(depth, '   Ada çevirme sunum katmanının işi; burada ham sayı saklanır. */');
}

/** Bit alanı: bayt sınırı tanımaz, imleç KAPSANAN bayt sayısı kadar ilerler. */
function emitBitField(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  target: string,
  depth: number,
): void {
  const bitLength = field.bitLength ?? 1;
  const bitOffset = field.bitOffset ?? 0;
  const covering = Math.ceil((bitOffset + bitLength) / 8);
  const { buffer } = ctx;

  if (covering > 8) {
    buffer.line(depth, '/* Bit alanı 64 biti aşıyor; C99\'da tek tamsayıya sığmaz —');
    buffer.line(depth, '   çözümleme çağırana bırakıldı, imleç yalnız ilerletildi. */');
    buffer.line(depth, `offset += ${covering}u;`);
    return;
  }

  const rawType = unsignedTypeForBytes(covering);
  const storage = cTypeFor(field);
  const order = field.bitOrder ?? 'msb-first';
  const shift = order === 'msb-first' ? covering * 8 - bitOffset - bitLength : bitOffset;
  const mask = (1n << BigInt(bitLength)) - 1n;
  const maskLiteral = `${hexOfWidth(mask, bitLength)}${bitLength > 32 ? 'ULL' : 'u'}`;

  buffer.line(
    depth,
    `/* Bit ${bitOffset}'ten başlayan ${bitLength} bit, ${order}. Aynı baytı paylaşan bit alanları`,
  );
  buffer.line(depth, '   şemada AYNI `offset`i taşımalı; imleç kapsanan bayt kadar ilerler. */');
  emitBoundsCheck(ctx, depth, `${covering}u`, 'ERR_TOO_SHORT');
  buffer.line(depth, '{');
  // Bit numaralandırması bayt sırasından bağımsızdır: kapsanan baytlar her zaman
  // ağırlıklı sıraya göre birleştirilir, yoksa "bit 12" iki farklı bit olurdu.
  buffer.line(depth + 1, `${rawType} raw = (${rawType})${byteAssembly(rawType, covering, 'big')};`);
  buffer.line(
    depth + 1,
    `${target} = (${storage})((raw >> ${shift}) & ${maskLiteral});`,
  );
  buffer.line(depth, '}');
  buffer.line(depth, `offset += ${covering}u;`);
}

function emitLeafField(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  ident: string,
  prefix: string,
  depth: number,
): void {
  const { buffer } = ctx;
  const target = `${prefix}${ident}`;
  const cType = cTypeFor(field);
  const byteLength = fieldByteLength(field);

  if (field.type === 'bitField') {
    emitBitField(ctx, field, target, depth);
    return;
  }

  // --- Dinamik uzunluk: işaretçi, sıfır kopya ---
  if (cType.endsWith('*')) {
    const sizeVariable = ctx.allocate(`${ident}_size`);
    ctx.locals.push(`size_t ${sizeVariable} = 0u;`);
    const source = field.lengthFrom === undefined ? undefined : ctx.accessPaths.get(field.lengthFrom);
    if (source === undefined) {
      buffer.line(
        depth,
        `/* Uzunluk kaynağı (\`${field.lengthFrom ?? 'yok'}\`) bu alandan ÖNCE çözümlenmiyor;`,
      );
      buffer.line(depth, '   doğrulama bunu hata sayar. Uzunluk 0 kabul edildi. */');
      buffer.line(depth, `${sizeVariable} = 0u;`);
    } else {
      buffer.line(depth, `${sizeVariable} = (size_t)${source};`);
    }
    // Kendi uzunluk alanıyla çelişen çerçeve TOO_SHORT değildir: iskelet yerinde,
    // beyan edilen uzunluk tutmuyor.
    emitBoundsCheck(ctx, depth, sizeVariable, 'ERR_LENGTH_MISMATCH');
    buffer.line(depth, '/* Sıfır kopya: alan çerçeve tamponuna bakar, tampon yaşadıkça geçerlidir.');
    buffer.line(depth, '   `const` niteleyicisi bilerek düşürülüyor — ayrıştırıcı tampona YAZMAZ.');
    buffer.line(depth, `   Bayt sayısı için \`${field.lengthFrom ?? 'uzunluk'}\` alanını okuyun. */`);
    buffer.line(depth, `${target} = (uint8_t *)&data[offset];`);
    buffer.line(depth, `offset += ${sizeVariable};`);
    return;
  }

  // --- Sabit uzunluklu bayt/metin dizisi ---
  const arrayMatch = /^(.*)\[(\d+)\]$/.exec(cType);
  if (arrayMatch !== null) {
    const count = arrayMatch[2] ?? '0';
    emitBoundsCheck(ctx, depth, `${count}u`, 'ERR_TOO_SHORT');
    if ((arrayMatch[1] ?? '') === 'char') {
      buffer.line(depth, '/* NUL sonlandırma YOK: dizi tam bu kadar bayt taşır, sınırı çağıran koyar. */');
    }
    buffer.line(depth, `memcpy(${target}, &data[offset], ${count}u);`);
    buffer.line(depth, `offset += ${count}u;`);
    return;
  }

  // --- boolean ---
  if (cType === 'bool') {
    emitBoundsCheck(ctx, depth, '1u', 'ERR_TOO_SHORT');
    buffer.line(depth, `${target} = (data[offset] != 0u);`);
    buffer.line(depth, 'offset += 1u;');
    emitPhysicalValue(ctx, field, target, depth);
    return;
  }

  // --- IEEE-754 ---
  if (cType === 'float' || cType === 'double') {
    const width = cType === 'float' ? 4 : 8;
    const rawType = unsignedTypeForBytes(width);
    emitBoundsCheck(ctx, depth, `${width}u`, 'ERR_TOO_SHORT');
    buffer.line(depth, '{');
    buffer.line(
      depth + 1,
      `${rawType} raw = (${rawType})${byteAssembly(rawType, width, endiannessOf(ctx, field))};`,
    );
    buffer.line(depth + 1, `${cType} value;`);
    buffer.line(depth + 1, '/* Tür cambazlığı (union/işaretçi dönüşümü) yerine memcpy: strict aliasing');
    buffer.line(depth + 1, '   kuralını çiğnemez, derleyici tek yükleme komutuna indirger. */');
    buffer.line(depth + 1, 'memcpy(&value, &raw, sizeof(value));');
    buffer.line(depth + 1, `${target} = value;`);
    buffer.line(depth, '}');
    buffer.line(depth, `offset += ${width}u;`);
    emitPhysicalValue(ctx, field, target, depth);
    return;
  }

  // --- Tamsayı ---
  const storageBits = storageBitsOf(cType);
  const readLength = byteLength ?? storageBits / 8;
  if (byteLength === null) {
    buffer.line(depth, `/* Şemada uzunluk yok; tipin genişliği (${readLength} bayt) varsayıldı. */`);
  }
  const signed = cType.startsWith('int');
  const rawType = unsignedTypeForBytes(readLength);
  emitBoundsCheck(ctx, depth, `${readLength}u`, 'ERR_TOO_SHORT');
  const assembly = byteAssembly(rawType, readLength, endiannessOf(ctx, field));

  if (signed && readLength * 8 < storageBits) {
    // uint24 → int32 gibi: kablodaki genişlik C tipinden dar, işaret biti elle
    // yukarı taşınmalı; yoksa negatif değer dev bir pozitife dönüşür.
    const signBit = hexOfWidth(1n << BigInt(readLength * 8 - 1), readLength * 8);
    const extension = hexOfWidth(
      ((1n << BigInt(storageBits)) - 1n) ^ ((1n << BigInt(readLength * 8)) - 1n),
      storageBits,
    );
    const wideType = unsignedTypeForBytes(storageBits / 8);
    buffer.line(depth, '{');
    buffer.line(depth + 1, `${wideType} raw = (${wideType})${assembly};`);
    buffer.line(depth + 1, `/* İşaret genişletmesi: ${readLength * 8} bitlik değer ${storageBits} bite taşınıyor. */`);
    buffer.line(depth + 1, `if ((raw & ${signBit}u) != 0u) {`);
    buffer.line(depth + 2, `raw |= ${extension}u;`);
    buffer.line(depth + 1, '}');
    buffer.line(depth + 1, `${target} = (${cType})raw;`);
    buffer.line(depth, '}');
  } else {
    buffer.line(depth, `${target} = (${cType})${assembly};`);
  }
  buffer.line(depth, `offset += ${readLength}u;`);
  emitPhysicalValue(ctx, field, target, depth);
}

/** Checksum/CRC alanının doğrulaması — kapsam alanları çözümlenmiş olmalı. */
function emitChecksumVerification(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  target: string,
  depth: number,
): void {
  const { buffer } = ctx;
  const algorithm = field.algorithm;
  if (algorithm === undefined || algorithm === 'none') {
    buffer.line(depth, '/* Algoritma tanımlı değil; doğrulama atlandı, ham değer saklandı. */');
    return;
  }
  const vars = ctx.coverageVars.get(field.id);
  if (vars === undefined) {
    buffer.line(
      depth,
      '/* Kapsam (coverage) çözümlenemedi; doğrulama atlandı, ham değer saklandı. */',
    );
    return;
  }
  const supported =
    algorithm === 'xor8' ||
    algorithm === 'sum8' ||
    algorithm === 'lrc' ||
    CRC_CATALOGUE[algorithm as CrcAlgorithmId] !== undefined;
  if (!supported) {
    buffer.line(depth, `/* ${algorithm} bu üreticide DESTEKLENMİYOR; doğrulama atlandı. */`);
    return;
  }
  const resultType =
    algorithm === 'xor8' || algorithm === 'sum8' || algorithm === 'lrc'
      ? 'uint8_t'
      : checksumResultType(algorithm);
  // Şema alanlara geriye giden `offset` verebilir; ters ya da taşan bir aralık
  // size_t çıkarmasında dev bir uzunluğa dönüşür ve tampon dışını okuturdu.
  buffer.line(depth, `if (${vars.end} < ${vars.start} || ${vars.end} > length) {`);
  buffer.line(depth + 1, `return ${ctx.macroPrefix}_ERR_LENGTH_MISMATCH;`);
  buffer.line(depth, '}');
  buffer.line(depth, '{');
  buffer.line(
    depth + 1,
    `${resultType} expected = ${checksumHelperName(ctx.prefix, algorithm)}(&data[${vars.start}], ${vars.end} - ${vars.start});`,
  );
  buffer.line(depth + 1, `if (expected != ${target}) {`);
  buffer.line(depth + 2, `return ${ctx.macroPrefix}_ERR_CHECKSUM;`);
  buffer.line(depth + 1, '}');
  buffer.line(depth, '}');
}

/**
 * Bir struct kapsamı: üye adlarının ad uzayı ve o kapsamın tip adı.
 *
 * Tip adı gerekiyor çünkü C struct üreticisi dizi kapasitesi makrosunu
 * (`<TİP>_<ÜYE>_MAX_COUNT`) kapsam tip adından türetiyor; ayrıştırıcı taşma
 * denetiminde AYNI makroya başvurmalı.
 */
interface ScopeContext {
  readonly typeName: string;
  readonly claim: (base: string) => string;
}

function emitFieldList(
  ctx: GeneratorContext,
  fields: readonly ProtocolFieldSchema[],
  prefix: string,
  depth: number,
  typeName: string,
): void {
  // Adlandırma C struct üreticisiyle BİREBİR aynı sırayla yapılmalı: önce
  // kapsamın tüm alan adları (toplu, çakışanlar `_2`), sonra üretim sırasında
  // eklenen `_count` üyeleri. Sıra kayarsa iki dosya farklı üye adına varır.
  const scope: ScopeContext = { typeName, claim: createNameAllocator([]) };
  const identifiers = toUniqueIdentifiers(
    fields.map((field) => field.name),
    'snake',
  ).map((unique) => scope.claim(escapeReserved(unique)));

  for (const [index, field] of fields.entries()) {
    const ident = identifiers[index] ?? `field_${index}`;
    emitField(ctx, field, ident, prefix, depth, scope);
  }
}

function emitField(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  ident: string,
  prefix: string,
  depth: number,
  scope: ScopeContext,
): void {
  const { buffer } = ctx;
  buffer.blankUnlessFresh();

  // Kapsam sınırları KOŞULUN DIŞINDA yazılır: koşullu bir alan atlandığında
  // atanmamış bir `..._coverage_end` sıfır kalır ve `end - start` size_t'te
  // taşarak checksum'ı tampon dışına okuturdu.
  for (const line of ctx.coverageStarts.get(field.id) ?? []) {
    // Alan mutlak konum veriyorsa kapsam da oradan başlar; imleç henüz oraya
    // atlamadı (atlama koşulun içinde).
    buffer.line(depth, field.offset === undefined ? line : line.replace('= offset;', `= ${field.offset}u;`));
  }

  let bodyDepth = depth;
  const condition = field.condition;
  if (condition !== undefined) {
    const conditionPath = ctx.accessPaths.get(condition.field);
    if (conditionPath === undefined) {
      buffer.line(depth, `/* Koşul alanı \`${condition.field}\` bulunamadı; alan koşulsuz çözümlendi. */`);
    } else {
      buffer.line(depth, `/* Koşullu alan: yalnız \`${condition.field}\` == ${condition.equals} iken çözümlenir. */`);
      buffer.line(depth, `if (${conditionPath} == ${condition.equals}) {`);
      bodyDepth = depth + 1;
    }
  }

  // Başlık ve tablolar gövdeden ÖNCE: okuyan önce alanın ne olduğunu görsün,
  // sonra imleç oynatmasını.
  buffer.line(bodyDepth, fieldHeadline(field));
  emitEnumTable(ctx, field, bodyDepth);
  emitDeferredNote(ctx, field, bodyDepth);

  if (field.offset !== undefined) {
    buffer.line(bodyDepth, `offset = ${field.offset}u; /* şemadaki mutlak konum */`);
  }

  const target = `${prefix}${ident}`;
  if (isAggregateField(field)) {
    emitAggregateField(ctx, field, ident, prefix, bodyDepth, scope);
  } else {
    emitLeafField(ctx, field, ident, prefix, bodyDepth);
    ctx.accessPaths.set(field.id, target);
  }

  // Doğrulama koşulun İÇİNDE kalır: çözümlenmemiş bir checksum alanı `memset`
  // yüzünden sıfırdır, onu hesapla karşılaştırmak sahte hata üretirdi.
  if (field.type === 'checksum' || field.type === 'crc') {
    emitChecksumVerification(ctx, field, target, bodyDepth);
  }

  if (bodyDepth !== depth) {
    buffer.line(depth, '}');
  }

  // Kapsam sonu koşulun dışında: alan atlandıysa imleç zaten oynamadı, doğru
  // değer yine bu noktadaki imleçtir.
  for (const line of ctx.coverageEnds.get(field.id) ?? []) {
    buffer.line(depth, line);
  }
}

function emitAggregateField(
  ctx: GeneratorContext,
  field: ProtocolFieldSchema,
  ident: string,
  prefix: string,
  depth: number,
  scope: ScopeContext,
): void {
  const { buffer } = ctx;
  const children = field.fields ?? [];

  if (field.type === 'structure') {
    if (children.length === 0) {
      buffer.line(depth, '/* İç alan yok; doğrulama bunu `empty-composite` sayar. */');
      return;
    }
    // İç yapının tip adı C struct üreticisindeki kuralla aynı türetilir.
    emitFieldList(
      ctx,
      children,
      `${prefix}${ident}.`,
      depth,
      `${scope.typeName}${typeNamePart(field.name)}`,
    );
    return;
  }

  // --- array ---
  if (children.length === 0) {
    buffer.line(depth, '/* İç alan yok; doğrulama bunu `empty-composite` sayar. */');
    return;
  }
  const repeatCount = field.repeatCount;
  const fixedCount = typeof repeatCount === 'number' && repeatCount > 0 ? repeatCount : null;
  const elementTypeName = `${scope.typeName}${typeNamePart(field.name)}Entry`;
  const indexVariable = ctx.allocate(`${ident}_index`);
  buffer.line(depth, '{');

  let boundExpression: string;
  if (fixedCount !== null) {
    // Sabit tekrarda başlıktaki dizi tam bu boyda; taşma denetimi gereksiz.
    boundExpression = `${fixedCount}u`;
  } else {
    const totalVariable = ctx.allocate(`${ident}_total`);
    const countMember = scope.claim(`${ident}_count`);
    const capacityMacro = `${macroPrefixOf(scope.typeName)}_${ident.toUpperCase()}_MAX_COUNT`;
    // `RepeatCount` birleşik tip; sayı dalı yukarıda ayrıldı, burada yalnız
    // "başka alandan gelen sayı" ya da "hiç verilmemiş" kalıyor.
    const fromField = typeof repeatCount === 'object' ? repeatCount.fromField : undefined;
    const source = fromField === undefined ? undefined : ctx.accessPaths.get(fromField);

    if (fromField === undefined && repeatCount === undefined) {
      buffer.line(depth + 1, '/* Şemada tekrar sayısı yok; tek eleman varsayıldı. */');
      buffer.line(depth + 1, `size_t ${totalVariable} = 1u;`);
    } else if (fromField === undefined) {
      buffer.line(depth + 1, `/* Şemadaki tekrar sayısı ${String(repeatCount)}; eleman okunmadı. */`);
      buffer.line(depth + 1, `size_t ${totalVariable} = 0u;`);
    } else if (source === undefined) {
      buffer.line(
        depth + 1,
        `/* Tekrar sayısı kaynağı \`${fromField}\` bu alandan önce çözümlenmiyor;`,
      );
      buffer.line(depth + 1, '   doğrulama bunu hata sayar. Sayı 0 kabul edildi. */');
      buffer.line(depth + 1, `size_t ${totalVariable} = 0u;`);
    } else {
      buffer.line(depth + 1, `size_t ${totalVariable} = (size_t)${source};`);
    }
    // Başlıktaki dizi SABİT kapasitelidir (dinamik sayı C'de sabit yer kaplayamaz).
    // Taşan çerçeveyi reddetmek, komşu üyelerin üzerine yazmaktan iyidir.
    buffer.line(depth + 1, `if (${totalVariable} > ${capacityMacro}) {`);
    buffer.line(depth + 2, `return ${ctx.macroPrefix}_ERR_LENGTH_MISMATCH;`);
    buffer.line(depth + 1, '}');
    buffer.line(depth + 1, `${prefix}${countMember} = (uint16_t)${totalVariable};`);
    boundExpression = totalVariable;
  }

  buffer.line(
    depth + 1,
    `for (size_t ${indexVariable} = 0u; ${indexVariable} < ${boundExpression}; ${indexVariable}++) {`,
  );
  emitFieldList(ctx, children, `${prefix}${ident}[${indexVariable}].`, depth + 2, elementTypeName);
  buffer.line(depth + 1, '}');
  buffer.line(depth, '}');
}

/** Çerçeveleme imzaları ve uzunluk sınırları — alanlardan ÖNCE denetlenir. */
function emitFraming(ctx: GeneratorContext, schema: ProtocolSchema): void {
  const { buffer } = ctx;
  const { framing } = schema;
  const startBytes = framing.startBytes ?? [];
  const endBytes = framing.endBytes ?? [];
  const minimum = minimumFrameLength(schema);

  buffer.line(1, '/* --- Çerçeveleme --- */');
  if (minimum > 0) {
    buffer.line(1, `/* Şemanın statik iskeleti en az ${minimum} bayt yer kaplar. */`);
    buffer.line(1, `if (length < ${minimum}u) {`);
    buffer.line(2, `return ${ctx.macroPrefix}_ERR_TOO_SHORT;`);
    buffer.line(1, '}');
  }
  buffer.line(1, '/* Azami çerçeve uzunluğu şemadan; aşan çerçeve bu protokole ait değildir. */');
  buffer.line(1, `if (length > ${framing.maximumFrameLength}u) {`);
  buffer.line(2, `return ${ctx.macroPrefix}_ERR_LENGTH_MISMATCH;`);
  buffer.line(1, '}');

  for (const [index, byte] of startBytes.entries()) {
    buffer.line(1, `if (data[${index}] != ${hexByte(byte)}) {`);
    buffer.line(2, `return ${ctx.macroPrefix}_ERR_BAD_START;`);
    buffer.line(1, '}');
  }
  for (const [index, byte] of endBytes.entries()) {
    // Bitiş imzası çerçevenin SONUNDAN sayılır: aradaki alanlar dinamik olabilir.
    const distance = endBytes.length - index;
    buffer.line(1, `if (data[length - ${distance}u] != ${hexByte(byte)}) {`);
    buffer.line(2, `return ${ctx.macroPrefix}_ERR_BAD_END;`);
    buffer.line(1, '}');
  }
  if (startBytes.length > 0) {
    buffer.line(1, `offset = ${startBytes.length}u; /* başlangıç imzasından sonra */`);
  }
}

/**
 * Şemadan C99 ayrıştırıcı üretir. Girdi yalnız okunur, çıktı saf metindir;
 * aynı şema her zaman aynı baytları verir.
 */
export function generateCParser(
  schema: ProtocolSchema,
  options?: CodegenOptions,
): GeneratedArtifact {
  const indent = options?.indent ?? DEFAULT_INDENT;
  const withBanner = options?.banner ?? true;
  const prefix = toIdentifier(schema.name, 'snake');
  const macroPrefix = prefix.toUpperCase();
  // Kök tip adı C struct üreticisininkiyle aynı kuraldan gelmeli: ayrıştırıcı
  // o başlıktaki tipi imzasında kullanıyor.
  const structName = typeNamePart(schema.name);
  const parseFunction = `${prefix}_parse`;

  const allocate = createNameAllocator(['data', 'length', 'out', 'offset', 'raw', 'value', 'index', 'bit']);
  const ctx: GeneratorContext = {
    buffer: new CodeBuffer(),
    prefix,
    macroPrefix,
    allocate,
    locals: [],
    accessPaths: new Map<string, string>(),
    coverageStarts: new Map<string, string[]>(),
    coverageEnds: new Map<string, string[]>(),
    coverageVars: new Map<string, { readonly start: string; readonly end: string }>(),
    helpers: [],
    defaultEndianness: schema.defaultEndianness ?? 'big',
  };

  // --- Kapsam değişkenleri ve checksum yardımcıları önden planlanır ---
  const knownIds = new Set<string>();
  collectFieldIds(schema.fields, knownIds);
  forEachField(schema.fields, (field) => {
    if (field.type !== 'checksum' && field.type !== 'crc') {
      return;
    }
    const algorithm = field.algorithm;
    if (algorithm !== undefined && algorithm !== 'none') {
      const alreadyRequested = ctx.helpers.some((helper) => helper.algorithm === algorithm);
      if (!alreadyRequested) {
        ctx.helpers.push({ algorithm });
      }
    }
    const coverage = field.coverage;
    if (
      coverage === undefined ||
      !knownIds.has(coverage.startField) ||
      !knownIds.has(coverage.endField)
    ) {
      return;
    }
    const identifier = toIdentifier(field.name, 'snake');
    const startVariable = allocate(`${identifier}_coverage_start`);
    const endVariable = allocate(`${identifier}_coverage_end`);
    ctx.locals.push(`size_t ${startVariable} = 0u;`);
    ctx.locals.push(`size_t ${endVariable} = 0u;`);
    ctx.coverageVars.set(field.id, { start: startVariable, end: endVariable });

    const starts = ctx.coverageStarts.get(coverage.startField) ?? [];
    starts.push(`${startVariable} = offset; /* checksum kapsamı başlangıcı */`);
    ctx.coverageStarts.set(coverage.startField, starts);

    const ends = ctx.coverageEnds.get(coverage.endField) ?? [];
    ends.push(`${endVariable} = offset; /* checksum kapsamı sonu */`);
    ctx.coverageEnds.set(coverage.endField, ends);
  });

  // --- Gövde önce üretilir: yerel bildirimler üretim sırasında birikir ---
  const body = new CodeBuffer();
  const bodyContext: GeneratorContext = { ...ctx, buffer: body };
  emitFraming(bodyContext, schema);
  emitFieldList(bodyContext, schema.fields, 'out->', 1, structName);

  // --- Dosya ---
  const file = new CodeBuffer();
  if (withBanner) {
    for (const line of bannerFor('c', schema.name).split('\n')) {
      file.line(0, line);
    }
    file.blank();
  }
  file.line(0, '/* Bu kaynak ÜRETİLEN METİNdir; ALP Comm Toolkit onu çalıştırmaz (spec §41).');
  file.line(0, '   Kendi gömülü projenize kopyalayıp derleyin: C99, `malloc` yok, VLA yok. */');
  file.blank();
  file.line(0, `#include "${prefix}.h" /* struct tanımı + <stdint.h>/<stdbool.h> */`);
  file.line(0, '#include <string.h> /* memcpy, memset, size_t */');
  file.blank();
  file.line(0, '/* Dönüş değeri: 0 başarı, negatif hata. */');
  for (const code of ERROR_CODES) {
    file.line(0, `#define ${macroPrefix}_${code.suffix} (${code.value}) /* ${code.comment} */`);
  }
  file.blank();

  const helperBuffer = new CodeBuffer();
  emitChecksumHelpers({ ...ctx, buffer: helperBuffer });
  const helperText = helperBuffer.render(indent);
  if (helperText.trim() !== '') {
    for (const line of helperText.split('\n')) {
      file.line(0, line);
    }
  }

  file.line(0, '/* Çerçeveyi çözümler. `data` en az `length` bayt geçerli olmalıdır;');
  file.line(0, '   `out` sıfırlanır, sonra alanlar sırayla yazılır. */');
  file.line(
    0,
    `int ${parseFunction}(const uint8_t *data, size_t length, ${structName} *out)`,
  );
  file.line(0, '{');
  file.line(1, 'size_t offset = 0u;');
  for (const local of ctx.locals) {
    file.line(1, local);
  }
  file.blank();
  file.line(1, '/* Çözümlenmeyen koşullu alanlar çağırana çöp göstermesin. */');
  file.line(1, 'memset(out, 0, sizeof(*out));');
  file.blank();
  for (const line of body.render(indent).split('\n')) {
    // Gövde kendi girintisini taşıdığı için burada 0 derinlikte eklenir.
    file.line(0, line);
  }
  file.blank();
  file.line(1, 'return 0;');
  file.line(0, '}');

  return {
    id: 'c-parser',
    language: 'c',
    fileName: `${prefix}_parser.c`,
    code: `${file.render(indent)}\n`,
  };
}
