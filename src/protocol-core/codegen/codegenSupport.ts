/**
 * Altı kod üreticisinin ortak zemini: ad temizleme, tip eşlemeleri, girinti,
 * başlık ve şema düzleştirme. Burada üretici YOK — yalnız hepsinin dayandığı
 * saf yardımcılar.
 *
 * Neden ortak katman: aynı şemadan üretilen C struct'ı, C ayrıştırıcısı ve
 * Markdown dokümanı AYNI alan adlarını ve AYNI genişlikleri göstermek zorunda.
 * Her üretici kendi ad temizleyicisini yazsaydı, doküman `payload_length`
 * derken struct `payloadLen` derdi ve iki çıktı sessizce ayrışırdı.
 *
 * Buradaki her işlev SAF ve DETERMİNİSTİKtir: tarih, rastgelelik, global durum
 * yok. Üretilen metnin bayt bayt tekrarlanabilir olması testlerin ve
 * kullanıcının sürüm kontrolünün ön şartı.
 */

// Checksum genişliği doğrudan `checksumWidthBytes`ten değil, `staticFieldLength`
// üzerinden gelir: uzunluk kuralı tek yerde kalsın, iki hesap ayrışmasın.
import { fieldTypeInfo, isCompositeField, requiresBigInt } from '@/protocol-core/schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { staticFieldLength } from '@/protocol-core/validation/schemaValidation';

/** Üretilen tanımlayıcıların yazım biçimi. */
export type IdentifierStyle = 'snake' | 'camel' | 'pascal';

/** Başlığın hangi dilin yorum söz dizimiyle yazılacağı. */
export type CommentStyle = 'c' | 'hash' | 'markdown';

export type PythonType = 'int' | 'float' | 'bool' | 'str' | 'bytes';

export type TypeScriptType = 'number' | 'bigint' | 'boolean' | 'string' | 'Uint8Array';

/**
 * Türkçe harfler ASCII'ye indirgenir: üretilen C/Python tanımlayıcılarında
 * ASCII dışı karakter taşınamaz (C99 kimlikleri derleyiciye bağlı, Python 3
 * izin verse de araç zinciri her yerde uyumlu değil).
 *
 * `ı → i` ve `İ → I` bilerek asimetrik: Türkçe'nin noktalı/noktasız ayrımını
 * ASCII'de korumanın yolu yok, en yakın karşılık seçildi.
 */
const TURKISH_TRANSLITERATION: Readonly<Record<string, string>> = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  İ: 'I',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
  â: 'a',
  Â: 'A',
  î: 'i',
  Î: 'I',
  û: 'u',
  Û: 'U',
};

/** Hiçbir harf kalmadığında kullanılacak ad. */
const FALLBACK_IDENTIFIER = 'field';

function transliterate(value: string): string {
  let result = '';
  // Kod noktası bazında gez: `for..of` vekil çiftleri bölmez.
  for (const character of value) {
    result += TURKISH_TRANSLITERATION[character] ?? character;
  }
  return result;
}

/**
 * Adı kelimelere ayırır. İki ayırıcı vardır: alfasayısal olmayan her karakter
 * ve büyük/küçük harf sınırı. İkincisi olmadan `payloadLength` tek kelime
 * sayılır ve snake_case çıktısı `payloadlength` olurdu.
 */
function splitWords(name: string): string[] {
  const words: string[] = [];
  for (const chunk of transliterate(name).split(/[^A-Za-z0-9]+/)) {
    if (chunk === '') {
      continue;
    }
    const parts = chunk
      // Kısaltmadan sonra gelen kelime: `HTTPServer` → `HTTP Server`.
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // Olağan camelCase sınırı: `payloadLength` → `payload Length`.
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Rakamdan sonra ancak GERÇEK bir kelime başlıyorsa bölünür:
      // `crc16Value` → `crc16 Value`, ama `3D` bölünmez (yalnız büyük harf,
      // kelime değil) — yoksa `3D Position` `_3_d_position` olurdu.
      .replace(/([0-9])([A-Z][a-z])/g, '$1 $2')
      .split(' ');
    for (const part of parts) {
      if (part !== '') {
        words.push(part);
      }
    }
  }
  return words;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Şemadaki serbest metin adı, hedef dilde geçerli bir tanımlayıcıya çevirir.
 *
 * **Anahtar sözcük kaçınması YOKTUR:** `class`, `int`, `return` gibi bir ad
 * aynen döner. Hangi sözcüğün ayrılmış olduğu hedef dile göre değişir; kararı
 * üreticiler verir (genelde sonuna `_` eklenir).
 */
export function toIdentifier(name: string, style: IdentifierStyle): string {
  const words = splitWords(name);
  if (words.length === 0) {
    // Ad tamamen simgelerden ibaretse ("---", "??") elde kelime kalmaz.
    return FALLBACK_IDENTIFIER;
  }

  let identifier: string;
  switch (style) {
    case 'snake':
      identifier = words.map((word) => word.toLowerCase()).join('_');
      break;
    case 'camel': {
      const [first, ...rest] = words;
      identifier = (first ?? '').toLowerCase() + rest.map(capitalize).join('');
      break;
    }
    case 'pascal':
      identifier = words.map(capitalize).join('');
      break;
  }

  // Hiçbir dilde tanımlayıcı rakamla başlayamaz.
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier;
}

/**
 * Adları tanımlayıcıya çevirir ve ÇAKIŞMALARI çözer: ikinci `value` `value_2`,
 * üçüncüsü `value_3` olur.
 *
 * Şema iki alana aynı adı verebilir (kimlikleri farklı olduğu için doğrulama
 * buna itiraz etmez) ve farklı adlar aynı tanımlayıcıya indirgenebilir
 * ("Sıcaklık" ile "Sicaklik" gibi). Üretilen struct alanı ya da Python
 * özniteliği çakışırsa çıktı derlenmez; çakışma burada, tek yerde çözülür.
 *
 * Dönen dizi girdiyle AYNI SIRADA ve aynı uzunluktadır; üreticiler alan
 * listesiyle indeks indeks eşleştirebilir.
 */
export function toUniqueIdentifiers(
  names: readonly string[],
  style: IdentifierStyle,
): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const base = toIdentifier(name, style);
    let candidate = base;
    let counter = 2;
    // Sayaçlı ad da tutulmuş olabilir (şemada zaten "Value 2" varsa) — boşta
    // bir ad bulunana kadar artır.
    while (used.has(candidate)) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}

/** İç alan taşıyan tipler: kod üretiminde döngü/iç struct gerektirir. */
export function isAggregateField(field: ProtocolFieldSchema): boolean {
  return isCompositeField(field.type);
}

function aggregateRejection(field: ProtocolFieldSchema, caller: string): Error {
  return new Error(
    `${caller}: "${field.id}" alanı ${field.type} tipinde; bileşik alanlar için önce isAggregateField ile ayıklayın`,
  );
}

/**
 * Alanın statik bayt uzunluğu; `lengthFrom` ile dinamikse `null`.
 *
 * `staticFieldLength` `undefined` döner; burada `null`a çevrilmesi bilinçli —
 * "hesaplanamadı" ile "alan yok" ayrımı üretici kodunda `?? ` ile sessizce
 * kaybolmasın diye.
 */
export function fieldByteLength(field: ProtocolFieldSchema): number | null {
  return staticFieldLength(field) ?? null;
}

/** `<stdint.h>` genişliği: 1→8, 2→16, 3-4→32, 5-8→64 bit. */
function cIntegerType(byteLength: number, signed: boolean): string {
  const bits = byteLength <= 1 ? 8 : byteLength <= 2 ? 16 : byteLength <= 4 ? 32 : 64;
  return `${signed ? 'int' : 'uint'}${bits}_t`;
}

/**
 * Sabit uzunluklu alanlar dizi, dinamik uzunluklular İŞARETÇİ olur: uzunluğu
 * çalışma zamanında belli olan bir alanın struct içinde sabit yeri olamaz.
 * Üretilen ayrıştırıcı işaretçiyi çerçeve tamponuna yöneltir (sıfır kopya),
 * uzunluk `lengthFrom`daki alandan okunur.
 */
function cArrayType(element: string, field: ProtocolFieldSchema): string {
  const length = fieldByteLength(field);
  // C'de sıfır elemanlı dizi standart değil; o durumda da işaretçi yazılır.
  return length === null || length <= 0 ? `${element}*` : `${element}[${length}]`;
}

/** Anlamsal tamsayılar (enum/address/length/checksum…): genişlik şemadan gelir. */
function cStorageIntegerType(field: ProtocolFieldSchema): string {
  const length = fieldByteLength(field);
  if (length === null || length <= 0) {
    // Doğrulama bunu zaten hata sayar (`missing-length` / `missing-algorithm`);
    // üretim yine de durmasın diye en yaygın genişliğe düşülür.
    return 'uint32_t';
  }
  if (length > 8) {
    // 8 bayttan geniş bir "adres" ya da "komut" tamsayı değil, bayt dizisidir.
    return `uint8_t[${length}]`;
  }
  return cIntegerType(length, false);
}

/**
 * Alanın C99 karşılığı. `<stdint.h>` ve `bool` için `<stdbool.h>` gerekir.
 *
 * Dizi tipleri `char[8]` / `uint8_t[3]` biçiminde döner — C bildiriminde köşeli
 * parantez ADdan sonra gelir, bildirim satırını {@link cDeclaration} kurar.
 *
 * Bileşik alanlarda ATAR: iç struct adını ve dizi tekrarını üretici bilir.
 */
export function cTypeFor(field: ProtocolFieldSchema): string {
  switch (field.type) {
    case 'uint8':
      return 'uint8_t';
    case 'int8':
      return 'int8_t';
    case 'uint16':
      return 'uint16_t';
    case 'int16':
      return 'int16_t';
    // 24 bitin C'de karşılığı yok; bir üst genişliğe taşınır, kablodaki 3 bayt
    // ayrıştırıcıda kaydırmayla doldurulur (işaret genişletmesi dahil).
    case 'uint24':
      return 'uint32_t';
    case 'int24':
      return 'int32_t';
    case 'uint32':
      return 'uint32_t';
    case 'int32':
      return 'int32_t';
    case 'uint64':
      return 'uint64_t';
    case 'int64':
      return 'int64_t';
    // float16'nın yerleşik C tipi yok (`_Float16` C23 ve derleyiciye bağlı);
    // HAM yarım kayan nokta 16 bit olarak taşınır, dönüşüm ayrıştırıcının işi.
    case 'float16':
      return 'uint16_t';
    case 'float32':
      return 'float';
    case 'float64':
      return 'double';
    case 'boolean':
      return 'bool';
    case 'unixTimestamp':
      return 'uint32_t';
    case 'dateTime':
      return 'uint64_t';
    // Bit alanı bayt sınırı tanımaz; genişlik BİT cinsindendir.
    case 'bitField':
      return cIntegerType(Math.ceil((field.bitLength ?? 1) / 8), false);
    case 'ascii':
    case 'utf8':
      return cArrayType('char', field);
    case 'rawBytes':
    case 'padding':
    case 'reserved':
    case 'delimiter':
    // BCD paketli ondalıktır: her bayt iki basamak taşır, sayıya çevirmek
    // ayrıştırıcının işi; struct ham baytları tutar.
    case 'bcd':
      return cArrayType('uint8_t', field);
    case 'enum':
    case 'command':
    case 'address':
    case 'length':
    case 'sequenceCounter':
    case 'checksum':
    case 'crc':
      return cStorageIntegerType(field);
    case 'array':
    case 'structure':
      throw aggregateRejection(field, 'cTypeFor');
  }
}

/**
 * `cTypeFor` çıktısını bildirim satırına çevirir: `uint8_t[3]` + `payload`
 * → `uint8_t payload[3]`. Dizi soneki C'de addan SONRA yazılır, tipe
 * yapıştırılamaz.
 */
export function cDeclaration(cType: string, identifier: string): string {
  const match = /^(.*)(\[\d+\])$/.exec(cType);
  if (match === null) {
    return `${cType} ${identifier}`;
  }
  const base = match[1] ?? cType;
  const suffix = match[2] ?? '';
  return `${base} ${identifier}${suffix}`;
}

/**
 * Alanın Python karşılığı (tip ipucu).
 *
 * float16 burada `float`, C'de `uint16_t` — ayrım bilinçli: Python `struct`
 * modülü yarım kayanı `'e'` biçimiyle doğrudan çözer, C'de yerleşik tip yok.
 */
export function pythonTypeFor(field: ProtocolFieldSchema): PythonType {
  const info = fieldTypeInfo(field.type);
  switch (info.kind) {
    case 'integer':
    case 'bits':
    case 'enum':
    // Zaman damgası ham tamsayı taşınır; `datetime`a çevirmek sunum katmanının
    // işi (dilim/çözünürlük kararı üreticiye ait değil).
    case 'timestamp':
    // checksum/crc hesaplanmış tamsayıdır.
    case 'derived':
      return 'int';
    case 'float':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'text':
      return 'str';
    case 'bytes':
      return 'bytes';
    case 'composite':
      throw aggregateRejection(field, 'pythonTypeFor');
  }
}

/** Alanın TypeScript karşılığı. 53 biti aşan tipler `bigint` okunur (spec §47). */
export function typeScriptTypeFor(field: ProtocolFieldSchema): TypeScriptType {
  if (requiresBigInt(field.type)) {
    // uint64/int64/dateTime: `number` sessizce yuvarlar.
    return 'bigint';
  }
  const info = fieldTypeInfo(field.type);
  switch (info.kind) {
    case 'integer':
    case 'bits':
    case 'enum':
    case 'timestamp':
    case 'derived':
    case 'float':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'text':
      return 'string';
    case 'bytes':
      return 'Uint8Array';
    case 'composite':
      throw aggregateRejection(field, 'typeScriptTypeFor');
  }
}

/**
 * Metnin her satırını girintiler. BOŞ satır girintilenmez — sonda boşluk
 * bırakmak çoğu biçimlendiricinin/linter'ın hatası ve diff gürültüsü.
 */
export function indentLines(text: string, indent: string, times = 1): string {
  if (times <= 0) {
    return text;
  }
  const prefix = indent.repeat(times);
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `${prefix}${line}`))
    .join('\n');
}

const BANNER_LINES = [
  'Bu dosya ALP Comm Toolkit tarafından üretildi — elle düzenlemeyin.',
  'Değişiklikleri protokol şemasında yapın ve çıktıyı yeniden üretin.',
] as const;

/**
 * Üretilen dosyanın baş yorumu. Sondaki satır sonu YOK; birleştirmeyi çağıran
 * yapar.
 *
 * **Tarih yazılmaz.** Üretim zamanı damgalansaydı aynı şema her seferinde
 * farklı metin üretir, testler kırılır ve kullanıcının sürüm kontrolü her
 * üretimde sahte değişiklik görürdü.
 */
export function bannerFor(commentStyle: CommentStyle, schemaName: string): string {
  const lines = [...BANNER_LINES, `Protokol: ${schemaName}`];
  switch (commentStyle) {
    case 'c':
      return ['/*', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');
    case 'hash':
      return lines.map((line) => `# ${line}`).join('\n');
    case 'markdown':
      return ['<!--', ...lines.map((line) => `  ${line}`), '-->'].join('\n');
  }
}

export interface FlatField {
  /** `schemaParser`ın ad uzayı biçimi: `header.deviceAddress`, `items[].value`. */
  readonly path: string;
  readonly field: ProtocolFieldSchema;
  /** Kaç bileşik alanın içinde; en dıştaki alanlar 0. */
  readonly depth: number;
  /** En dıştan içe doğru kapsayan bileşik alanların kimlikleri. */
  readonly parentIds: readonly string[];
}

function collectLeafFields(
  fields: readonly ProtocolFieldSchema[],
  namespace: string,
  depth: number,
  parentIds: readonly string[],
  accumulator: FlatField[],
): void {
  for (const field of fields) {
    const path = namespace === '' ? field.id : `${namespace}.${field.id}`;
    if (isAggregateField(field)) {
      // Dizide `schemaParser` çalışma zamanında `items[0]`, `items[1]` üretir;
      // burada indeks YOK, `items[]` var: kod üretiminde tekrar bir DÖNGÜdür,
      // düz listede her yineleme ayrı satır olmamalı.
      const childNamespace = field.type === 'array' ? `${path}[]` : path;
      collectLeafFields(
        field.fields ?? [],
        childNamespace,
        depth + 1,
        [...parentIds, field.id],
        accumulator,
      );
      continue;
    }
    accumulator.push({ path, field, depth, parentIds });
  }
}

/**
 * İç içe `structure`/`array` alanlarını gezerek YAPRAK alanları düz listeye
 * açar; sıra çerçevedeki çözümleme sırasıdır.
 *
 * Bileşik alanların KENDİSİ listeye girmez — taşıdıkları değer yok, yalnız
 * kapsam kurarlar; kapsam bilgisi `path`/`parentIds`e taşınır. İç alanı
 * olmayan bileşik alan (doğrulamada `empty-composite` hatası) hiçbir yaprak
 * üretmez, üretici sessizce boş kapsam görür.
 */
export function flattenLeafFields(schema: ProtocolSchema): readonly FlatField[] {
  const accumulator: FlatField[] = [];
  collectLeafFields(schema.fields, '', 0, [], accumulator);
  return accumulator;
}
