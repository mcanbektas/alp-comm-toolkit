/**
 * Şemadan C başlık dosyası (`.h`) üretir — spec §9.5'in "C struct" çıktısı.
 *
 * Üretilen metin DERLENEBİLİR ama uygulama onu ASLA çalıştırmaz (spec §41
 * `eval` ve dinamik kod çalıştırma yasağı): kullanıcı kopyalar ya da indirir,
 * derlemeyi kendi projesinde yapar. Bu yüzden burada üretilen şey bir modül
 * değil, yalnız METİNdir.
 *
 * ## Bu üreticinin dört ayırıcı kararı
 *
 * 1. **`__attribute__((packed))` KONULMAZ.** Şema TEL üzerindeki düzeni tarif
 *    eder, C struct BELLEK düzenini; ikisi aynı şey değildir. `packed`
 *    taşınabilir değil (MSVC'de karşılığı `#pragma pack`) ve hizalanmamış
 *    erişim ARM/RISC-V'de tuzak (trap) üretir. Struct'ın üstüne dolgu uyarısı
 *    yazılır; çerçeve doğrudan struct'a `memcpy` edilmez, ayrıştırıcı kullanılır.
 * 2. **C bit-field kullanılmaz.** `unsigned x : 3;` yerleşimi (bit sırası,
 *    dolgu, birim taşması) standartta derleyiciye bırakılmıştır — aynı kaynak
 *    iki derleyicide farklı tel düzeni verir. Bunun yerine saklama tipi + maske
 *    ve kaydırma makroları üretilir.
 * 3. **Enum alanının struct üyesi enum TİPİ değil, sabit genişlikli tamsayıdır.**
 *    C'de enum'un alt tipi implementasyona bağlı; tel genişliğini garanti eden
 *    tek şey `uint8_t`/`uint16_t`… Üretilen `typedef enum` yalnız SABİT adlarını
 *    verir, karşılaştırma için kullanılır.
 * 4. **Dinamik uzunluklu alanlar işaretçidir.** Uzunluğu çalışma zamanında belli
 *    olan alanın struct içinde sabit yeri olamaz; işaretçi çerçeve tamponuna
 *    bakar (sıfır kopya), uzunluk `lengthFrom`daki alandan okunur.
 *
 * Çıktı DETERMİNİSTİKtir: tarih, rastgele kimlik ya da gezinme sırasına bağlı
 * bir şey yazılmaz — aynı şema her zaman bayt bayt aynı metni verir.
 */

import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import {
  bannerFor,
  cDeclaration,
  cTypeFor,
  fieldByteLength,
  indentLines,
  toIdentifier,
  toUniqueIdentifiers,
} from './codegenSupport';
import type { CodegenOptions, GeneratedArtifact } from './types';
import { DEFAULT_INDENT } from './types';

/**
 * C ve C++ ayrılmış sözcükleri. `toIdentifier` bilerek kaçınma yapmaz — hangi
 * sözcüğün ayrılmış olduğu hedef dile göre değişir, karar üreticinindir.
 *
 * C++ sözcükleri de listede: üretilen başlık çoğu gömülü projede `extern "C"`
 * ile bir C++ birimine de dahil ediliyor ve `class` adlı bir alan orada
 * derlenmez.
 */
const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'alignas',
  'alignof',
  'auto',
  'bool',
  'break',
  'case',
  'char',
  'class',
  'const',
  'constexpr',
  'continue',
  'default',
  'delete',
  'do',
  'double',
  'else',
  'enum',
  'extern',
  'false',
  'float',
  'for',
  'goto',
  'if',
  'inline',
  'int',
  'long',
  'namespace',
  'new',
  'nullptr',
  'operator',
  'private',
  'protected',
  'public',
  'register',
  'restrict',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'static_assert',
  'struct',
  'switch',
  'template',
  'this',
  'thread_local',
  'throw',
  'true',
  'try',
  'typedef',
  'typeof',
  'union',
  'unsigned',
  'using',
  'virtual',
  'void',
  'volatile',
  'while',
]);

/** Boş bileşik alan için yer tutucu üye adı (C'de boş struct standart değil). */
const EMPTY_STRUCT_MEMBER = 'reserved_placeholder';

const PADDING_WARNING = [
  '/*',
  ' * DİKKAT — bu struct DOLGU (padding) içerebilir.',
  ' *',
  ' * Şema TEL üzerindeki düzeni tarif eder, aşağıdaki struct ise BELLEK düzenini;',
  ' * derleyici alanları hizalamak için aralarına bayt ekleyebilir ve `sizeof`',
  ' * çerçeve uzunluğundan büyük çıkabilir. Çerçeveyi doğrudan bu struct\'a',
  ' * kopyalamayın (`memcpy`/`reinterpret_cast` YOK) — üretilen ayrıştırıcıyı',
  ' * kullanın; o her alanı bayt sırasına uyarak tek tek yerleştirir.',
  ' *',
  ' * `__attribute__((packed))` bilerek konulmadı: taşınabilir değildir ve',
  ' * hizalanmamış erişim bazı mimarilerde tuzak (trap) üretir.',
  ' */',
].join('\n');

const NESTED_STRUCT_NOTE =
  '/* Dolgu (padding) uyarısı için dosyanın sonundaki ana struct\'a bakın. */';

/** Aynı ad uzayında ikinci kez istenen adı `_2`, `_3` … ile ayırır. */
interface NameScope {
  claim(base: string): string;
}

function createNameScope(): NameScope {
  const used = new Set<string>();
  return {
    claim(base: string): string {
      let candidate = base;
      let counter = 2;
      while (used.has(candidate)) {
        candidate = `${base}_${counter}`;
        counter += 1;
      }
      used.add(candidate);
      return candidate;
    },
  };
}

function escapeReserved(identifier: string): string {
  return RESERVED_WORDS.has(identifier) ? `${identifier}_` : identifier;
}

/**
 * Tip adı parçası. `toIdentifier` hiç harf kalmayan adlarda pascal biçimde bile
 * küçük harfli `field` döndürür; tip adının ortasında kalmasın diye baş harf
 * burada büyütülür.
 */
function typeNamePart(name: string): string {
  const pascal = toIdentifier(name, 'pascal');
  return pascal.charAt(0).toUpperCase() + pascal.slice(1);
}

/** `AlpSensorProtocolHeader` → `ALP_SENSOR_PROTOCOL_HEADER`. */
function macroPrefixOf(typeName: string): string {
  return toIdentifier(typeName, 'snake').toUpperCase();
}

interface GeneratorContext {
  readonly indent: string;
  /** Dosya genelinde tek: struct ve enum adları aynı ad uzayını paylaşır. */
  readonly typeNames: NameScope;
  /** Dosya genelinde tek: önişlemci makrolarının kapsamı yoktur. */
  readonly macroNames: NameScope;
  /** Üretilen bloklar, dosyadaki sırayla (iç içe tipler kendinden önce). */
  readonly blocks: string[];
  readonly maximumFrameLength: number;
  needsStdBool: boolean;
  needsStdDef: boolean;
}

/**
 * Bileşik alanın sabit bayt boyu; içinde dinamik uzunluklu ya da bit alanı
 * varsa `null`.
 *
 * Bit alanı görünce `null` dönmesi bilinçli: aynı baytı paylaşan iki bit alanı
 * ayrı ayrı sayılsa eleman boyu OLDUĞUNDAN BÜYÜK çıkar, bu da aşağıdaki üst
 * sınırı olduğundan KÜÇÜK hesaplatır — yani tampon yetmez. Emin olunamayan
 * durumda güvenli tarafa düşülür.
 */
function staticCompositeSize(fields: readonly ProtocolFieldSchema[]): number | null {
  let total = 0;
  for (const field of fields) {
    if (field.type === 'structure') {
      const inner = staticCompositeSize(field.fields ?? []);
      if (inner === null) {
        return null;
      }
      total += inner;
      continue;
    }
    if (field.type === 'array') {
      const inner = staticCompositeSize(field.fields ?? []);
      if (inner === null || typeof field.repeatCount !== 'number') {
        return null;
      }
      total += inner * field.repeatCount;
      continue;
    }
    if (field.type === 'bitField') {
      return null;
    }
    const length = fieldByteLength(field);
    if (length === null) {
      return null;
    }
    total += length;
  }
  return total;
}

/**
 * Dinamik dizinin C'de yer ayrılacak ÜST SINIRI. Tekrar sayısı çalışma
 * zamanında geldiği için sabit bir dizi boyu gerekir; sınır çerçeve
 * bütçesinden türetilir: bir çerçeveye en fazla `maximumFrameLength / eleman
 * boyu` eleman sığar. Eleman boyu hesaplanamıyorsa her elemanın en az 1 bayt
 * olduğu gerçeğine düşülür — kaba ama aşılamayan bir sınır.
 */
function maximumElementCount(field: ProtocolFieldSchema, maximumFrameLength: number): number {
  const elementSize = staticCompositeSize(field.fields ?? []);
  if (elementSize !== null && elementSize > 0) {
    return Math.max(1, Math.floor(maximumFrameLength / elementSize));
  }
  return Math.max(1, maximumFrameLength);
}

/** `0xF0u` / `0x0000FF00ull` — 32 biti aşan maskede sonek `ull` olmalı. */
function formatMask(mask: bigint, byteLength: number): string {
  const digits = mask.toString(16).toUpperCase().padStart(Math.max(2, byteLength * 2), '0');
  return `0x${digits}${mask > 0xffffffffn ? 'ull' : 'u'}`;
}

/**
 * Tek satırlık C yorumu. Metin ŞEMADAN gelir, yani kullanıcı yazmıştır: içinde
 * geçen yorum kapatma dizisi (yıldız + eğik çizgi) yorumu erkenden kapatıp
 * kalanını koda çevirirdi, satır sonu ise yorumu ikiye bölerdi. İkisi de burada
 * etkisizleştirilir.
 */
function commentLine(text: string): string {
  const safe = text
    .replaceAll(/\s*[\r\n]+\s*/g, ' ')
    .replaceAll('*/', '* /')
    // İç içe yorum açma dizisi C'de hata değil ama derleyici uyarır (-Wcomment).
    .replaceAll('/*', '/ *');
  return `/* ${safe} */`;
}

interface BitFieldGeometry {
  readonly bitOffset: number;
  readonly bitLength: number;
  /** Bitleri taşıyan kelimenin bayt genişliği. */
  readonly containerBytes: number;
}

/** `cTypeFor` ile aynı varsayım: genişlik verilmemişse tek bit. */
function bitFieldGeometry(field: ProtocolFieldSchema): BitFieldGeometry {
  const bitOffset = field.bitOffset ?? 0;
  const bitLength = field.bitLength ?? 1;
  return {
    bitOffset,
    bitLength,
    containerBytes: fieldByteLength(field) ?? Math.ceil((bitOffset + bitLength) / 8),
  };
}

/** Alanın genişliğini insan diline çevirir; yorum satırlarında kullanılır. */
function widthNote(field: ProtocolFieldSchema): string {
  if (field.type === 'bitField') {
    // Bit alanında "kaç bayt" yanıltıcı olur: struct üyesi ÇIKARILMIŞ değeri
    // tutar, kelime genişliğini değil.
    const { bitOffset, bitLength, containerBytes } = bitFieldGeometry(field);
    return `bit ${bitOffset} konumundan ${bitLength} bit (${containerBytes} baytlık kelimenin içinde)`;
  }
  if (field.lengthFrom !== undefined) {
    return `uzunluk "${field.lengthFrom}" alanının değerinden gelir`;
  }
  const length = fieldByteLength(field);
  if (length === null) {
    return 'uzunluk şemada belirsiz';
  }
  return `${length} bayt`;
}

/** Alanın üstüne yazılacak yorum satırları (her not kendi satırında). */
function leafNotes(field: ProtocolFieldSchema, cType: string): string[] {
  const notes = [`${field.name} — ${field.type}, ${widthNote(field)}.`];

  if (field.description !== undefined && field.description !== '') {
    notes.push(field.description);
  }
  if (field.type === 'checksum' || field.type === 'crc') {
    const algorithm = field.algorithm === undefined ? 'şemada algoritma yok' : field.algorithm;
    notes.push(`Otomatik hesaplanır (${algorithm}) — elle doldurmayın.`);
  }
  if (field.type === 'length') {
    notes.push('Otomatik hesaplanır (çerçeve uzunluğu) — elle doldurmayın.');
  }
  if (cType.endsWith('*')) {
    notes.push('Çerçeve tamponuna bakar (sıfır kopya); tampon yaşarken geçerlidir.');
  }
  if (field.type === 'padding' || field.type === 'reserved') {
    notes.push('Yalnız yer tutar; içeriği anlamlı değildir.');
  }
  if (field.condition !== undefined) {
    notes.push(
      `Yalnız "${field.condition.field}" alanı ${field.condition.equals} iken çözümlenir.`,
    );
  }
  if (field.unit !== undefined && field.unit !== '') {
    notes.push(`Birim: ${field.unit}.`);
  }
  if (field.scale !== undefined || field.calibrationOffset !== undefined) {
    notes.push(
      `Fiziksel değer = ham × ${field.scale ?? 1} + ${field.calibrationOffset ?? 0}.`,
    );
  }
  return notes;
}

interface EnumEmission {
  readonly block: string;
  readonly typeName: string;
}

/**
 * Alanın `enumValues` tablosundan `typedef enum` üretir. Sıra ŞEMANIN nesne
 * anahtar sırası değil, SAYISAL sıradır: JavaScript nesne anahtarlarını
 * tamsayı/metin ayrımına göre farklı sıralar, çıktının buna bağlı olması
 * determinizmi kırardı.
 */
function emitEnum(
  field: ProtocolFieldSchema,
  values: Readonly<Record<string, string>>,
  parentTypeName: string,
  ctx: GeneratorContext,
): EnumEmission | null {
  // Şema doğrulayıcısı anahtarın ondalık sayı METNİ olmasını şart koşar; yine de
  // elle kurulmuş bir şema gelebilir. Sayıya çevrilemeyen anahtar C'de geçerli
  // bir sabit değeri veremez, atlanır — ve atlandığı yorumda söylenir.
  const numericKeys = Object.keys(values).filter((key) => /^-?\d+$/.test(key));
  if (numericKeys.length === 0) {
    // C'de en az bir sabit taşımayan enum geçersiz.
    return null;
  }
  const skipped = Object.keys(values).length - numericKeys.length;
  const sortedKeys = numericKeys.sort((left, right) => {
    const difference = BigInt(left) - BigInt(right);
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  });

  const typeName = ctx.typeNames.claim(`${parentTypeName}${typeNamePart(field.name)}`);
  const prefix = macroPrefixOf(typeName);

  const labels = sortedKeys.map((key) => values[key] ?? key);
  const suffixes = toUniqueIdentifiers(labels, 'snake');

  const constants: string[] = [];
  let index = 0;
  for (const key of sortedKeys) {
    // İki dizi aynı uzunlukta üretildi; `??` yalnız noUncheckedIndexedAccess içindir.
    const suffix = suffixes[index] ?? toIdentifier(key, 'snake');
    index += 1;
    const constantName = ctx.macroNames.claim(`${prefix}_${suffix.toUpperCase()}`);
    // Anahtar ondalık METİNdir; `BigInt` ile normalleştirilir — "016" aynen
    // yazılsaydı C onu SEKİZLİK sabit sayardı (= 14).
    constants.push(`${constantName} = ${BigInt(key).toString()}`);
  }
  // Atlanan anahtarın notu enum GÖVDESİNE değil üstüne yazılır: gövdenin sonuna
  // konsa son sabitten sonra virgül kalırdı ve sondaki virgül C89'da geçersiz.
  const skippedNote =
    skipped > 0
      ? [commentLine(`${skipped} anahtar ondalık sayı olmadığı için atlandı.`)]
      : [];

  const body = constants.join(',\n');
  const block = [
    commentLine(`${field.name} alanının şemada tanımlı değerleri.`),
    commentLine(
      "C'de enum'un alt tipi derleyiciye bağlıdır; struct üyesi bu yüzden tel genişliğini korur, bu sabitler yalnız karşılaştırma içindir.",
    ),
    ...skippedNote,
    'typedef enum {',
    indentLines(body, ctx.indent),
    `} ${typeName};`,
  ].join('\n');

  return { block, typeName };
}

/**
 * Bit alanı için maske/kaydırma makroları. C bit-field'ı yerine bunlar
 * üretilir; sebebi dosya başındaki 2 numaralı karar.
 */
function emitBitFieldMacros(
  field: ProtocolFieldSchema,
  identifier: string,
  macroPrefix: string,
  ctx: GeneratorContext,
): string {
  const { bitOffset, bitLength, containerBytes } = bitFieldGeometry(field);
  const mask = ((1n << BigInt(bitLength)) - 1n) << BigInt(bitOffset);

  const base = `${macroPrefix}_${identifier.toUpperCase()}`;
  const offsetMacro = ctx.macroNames.claim(`${base}_BIT_OFFSET`);
  const lengthMacro = ctx.macroNames.claim(`${base}_BIT_LENGTH`);
  const maskMacro = ctx.macroNames.claim(`${base}_MASK`);

  const orderNote =
    field.bitOrder === undefined
      ? 'Bit numaralandırması şemanın varsayılan bit sırasına göredir.'
      : `Bit numaralandırması "${field.bitOrder}" sırasına göredir.`;

  return [
    commentLine(`${field.name} bit alanı — ${containerBytes} baytlık kelimenin içinde.`),
    commentLine(
      'C bit-field kullanılmadı: yerleşimi (bit sırası, dolgu, birim taşması) derleyiciye bağlıdır ve tel düzenini garanti etmez.',
    ),
    commentLine(`Değeri çıkarmak için: (raw & ${maskMacro}) >> ${offsetMacro}. ${orderNote}`),
    `#define ${offsetMacro} ${bitOffset}u`,
    `#define ${lengthMacro} ${bitLength}u`,
    `#define ${maskMacro} ${formatMask(mask, containerBytes)}`,
  ].join('\n');
}

interface MemberContext {
  readonly typeName: string;
  readonly macroPrefix: string;
  /** Üye adlarının kapsamı; `_count` yoldaşları da buradan istenir. */
  readonly scope: NameScope;
  /** Bu struct'tan hemen önce yazılacak enum/makro blokları. */
  readonly localBlocks: string[];
}

function arrayMemberLines(
  field: ProtocolFieldSchema,
  identifier: string,
  member: MemberContext,
  ctx: GeneratorContext,
): string[] {
  const elementTypeName = ctx.typeNames.claim(
    `${member.typeName}${typeNamePart(field.name)}Entry`,
  );
  // Eleman struct'ı bu struct'tan ÖNCE tanımlanmalı: C'de eksik tip üye olamaz.
  emitStructBlocks(field.fields ?? [], elementTypeName, ctx, false);

  const fixedCount = typeof field.repeatCount === 'number' ? field.repeatCount : null;
  if (fixedCount !== null && fixedCount > 0) {
    return [
      commentLine(`${field.name} — sabit ${fixedCount} elemanlı dizi.`),
      `${elementTypeName} ${identifier}[${fixedCount}];`,
    ];
  }

  const bound = maximumElementCount(field, ctx.maximumFrameLength);
  const maxMacro = ctx.macroNames.claim(
    `${member.macroPrefix}_${identifier.toUpperCase()}_MAX_COUNT`,
  );
  const source =
    typeof field.repeatCount === 'object'
      ? `eleman sayısı "${field.repeatCount.fromField}" alanından gelir`
      : 'şemada tekrar sayısı yok, sayı çalışma zamanında belli olur';

  member.localBlocks.push(
    [
      commentLine(`${field.name} dizisinin üst sınırı — ${source}.`),
      commentLine(
        `Dinamik sayıda eleman C'de sabit yer kaplayamaz; sınır çerçeve bütçesinden türetildi (en büyük çerçeve ${ctx.maximumFrameLength} bayt).`,
      ),
      `#define ${maxMacro} ${bound}`,
    ].join('\n'),
  );

  const countIdentifier = member.scope.claim(`${identifier}_count`);
  return [
    commentLine(`${field.name} — ${source}.`),
    commentLine(`Gerçek eleman sayısı ${countIdentifier} alanındadır; fazlası okunmamalı.`),
    `${elementTypeName} ${identifier}[${maxMacro}];`,
    `uint16_t ${countIdentifier};`,
  ];
}

function memberLines(
  field: ProtocolFieldSchema,
  identifier: string,
  member: MemberContext,
  ctx: GeneratorContext,
): string[] {
  if (field.type === 'array') {
    return arrayMemberLines(field, identifier, member, ctx);
  }

  if (field.type === 'structure') {
    const childTypeName = ctx.typeNames.claim(`${member.typeName}${typeNamePart(field.name)}`);
    emitStructBlocks(field.fields ?? [], childTypeName, ctx, false);
    return [commentLine(`${field.name} — iç yapı.`), `${childTypeName} ${identifier};`];
  }

  const cType = cTypeFor(field);
  if (cType === 'bool') {
    ctx.needsStdBool = true;
  }
  if (cType.endsWith('*')) {
    // İşaretçi üyeler yokken `NULL` ile işaretlenir; `NULL` <stddef.h>'ten gelir.
    ctx.needsStdDef = true;
  }

  const notes = leafNotes(field, cType);

  if (field.type === 'enum') {
    const values = field.enumValues;
    if (values === undefined) {
      notes.push('Şemada değer tablosu yok; sabit üretilmedi.');
    } else {
      const emission = emitEnum(field, values, member.typeName, ctx);
      if (emission === null) {
        notes.push('Şemada değer tablosu boş; sabit üretilmedi.');
      } else {
        member.localBlocks.push(emission.block);
        notes.push(`Değerler ${emission.typeName} sabitleriyle karşılaştırılır.`);
      }
    }
  }

  if (field.type === 'bitField') {
    member.localBlocks.push(emitBitFieldMacros(field, identifier, member.macroPrefix, ctx));
    notes.push('Ham kelimeden maske/kaydırma makrolarıyla çıkarılır.');
  }

  return [...notes.map(commentLine), `${cDeclaration(cType, identifier)};`];
}

/**
 * Bir kapsamın (kök şema, `structure` ya da dizi elemanı) tiplerini üretir ve
 * {@link GeneratorContext.blocks}a ekler.
 *
 * Sıra ÖNEMLİ: önce iç tipler, sonra bu kapsamın enum/makro blokları, en sonra
 * struct'ın kendisi. C'de bir tip kullanılmadan önce tanımlanmış olmalı.
 */
function emitStructBlocks(
  fields: readonly ProtocolFieldSchema[],
  typeName: string,
  ctx: GeneratorContext,
  isRoot: boolean,
): void {
  const scope = createNameScope();
  const identifiers: string[] = [];
  // Adları TOPLU çevir: iki alan aynı ada ("Sıcaklık" / "Sicaklik") inebilir ve
  // çakışan üye adı taşıyan struct derlenmez.
  for (const unique of toUniqueIdentifiers(
    fields.map((field) => field.name),
    'snake',
  )) {
    identifiers.push(scope.claim(escapeReserved(unique)));
  }

  const member: MemberContext = {
    typeName,
    macroPrefix: macroPrefixOf(typeName),
    scope,
    localBlocks: [],
  };

  const groups: string[] = [];
  let index = 0;
  for (const field of fields) {
    // İki dizi aynı uzunlukta üretildi; `??` yalnız noUncheckedIndexedAccess içindir.
    const identifier = identifiers[index] ?? escapeReserved(toIdentifier(field.name, 'snake'));
    index += 1;
    groups.push(memberLines(field, identifier, member, ctx).join('\n'));
  }

  const body =
    groups.length === 0
      ? [
          commentLine(
            "Şemada iç alan tanımlı değil (doğrulamada `empty-composite`); C'de boş struct standart olmadığından yer tutucu konuldu.",
          ),
          `uint8_t ${EMPTY_STRUCT_MEMBER};`,
        ].join('\n')
      : groups.join('\n\n');

  const block = [
    isRoot ? PADDING_WARNING : NESTED_STRUCT_NOTE,
    'typedef struct {',
    indentLines(body, ctx.indent),
    `} ${typeName};`,
  ].join('\n');

  ctx.blocks.push(...member.localBlocks, block);
}

/**
 * Şemanın C başlık karşılığını üretir.
 *
 * Saftır: aynı şema + aynı seçenekler her zaman aynı metni verir.
 */
export function generateCStruct(
  schema: ProtocolSchema,
  options?: CodegenOptions,
): GeneratedArtifact {
  const indent = options?.indent ?? DEFAULT_INDENT;
  const snakeName = toIdentifier(schema.name, 'snake');

  const typeNames = createNameScope();
  const macroNames = createNameScope();

  // Önek koşulsuz: "ALP Sensor Protocol" için nöbetçi ALP_ALP_SENSOR_PROTOCOL_H
  // olur. Tekrar göze batıyor ama kural tek ve istisnasız kalsın — adın ALP ile
  // başlayıp başlamadığına bakan bir özel durum, iki şemanın aynı nöbetçiye
  // inmesine yol açabilirdi.
  const guard = macroNames.claim(`ALP_${snakeName.toUpperCase()}_H`);

  const rootTypeName = typeNames.claim(typeNamePart(schema.name));
  const rootMacroPrefix = macroPrefixOf(rootTypeName);
  const frameLengthMacro = macroNames.claim(`${rootMacroPrefix}_MAX_FRAME_LENGTH`);

  const ctx: GeneratorContext = {
    indent,
    typeNames,
    macroNames,
    blocks: [],
    maximumFrameLength: schema.framing.maximumFrameLength,
    needsStdBool: false,
    needsStdDef: false,
  };

  // Önce üret: hangi başlıkların gerekeceği (bool, NULL) ancak alanlar
  // gezildikten sonra bilinir.
  emitStructBlocks(schema.fields, rootTypeName, ctx, true);

  const includes: string[] = [];
  if (ctx.needsStdBool) {
    includes.push('#include <stdbool.h>');
  }
  if (ctx.needsStdDef) {
    includes.push('#include <stddef.h>');
  }
  includes.push('#include <stdint.h>');

  const description =
    schema.description === undefined || schema.description === ''
      ? []
      : [` * ${schema.description}`];
  const infoBlock = [
    [
      '/*',
      ` * Protokol: ${schema.name} (sürüm ${schema.version})`,
      ...description,
      ` * Çerçeveleme: ${schema.framing.type} · en büyük çerçeve ${schema.framing.maximumFrameLength} bayt`,
      ' */',
    ].join('\n'),
    `#define ${frameLengthMacro} ${schema.framing.maximumFrameLength}`,
  ].join('\n');

  const parts: string[] = [];
  if (options?.banner ?? true) {
    parts.push(bannerFor('c', schema.name));
  }
  parts.push(`#ifndef ${guard}\n#define ${guard}`);
  parts.push(includes.join('\n'));
  parts.push(infoBlock);
  parts.push(...ctx.blocks);
  parts.push(`#endif /* ${guard} */`);

  return {
    id: 'c-struct',
    language: 'c',
    fileName: `${snakeName}.h`,
    // Sonda tek satır sonu: POSIX metin dosyası kuralı, diff gürültüsünü keser.
    code: `${parts.join('\n\n')}\n`,
  };
}
