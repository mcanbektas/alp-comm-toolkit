/**
 * Şemadan protokol dokümanı üretir — spec §9.5'in "Markdown documentation"
 * çıktısı.
 *
 * **Üretilen doküman İNGİLİZCEdir.** Arayüz metni değil, kullanıcının dışarıya
 * (müşteri, tedarikçi, donanım ekibi) vereceği bir ESERdir; çeviri sözlüğünden
 * geçmez, bu yüzden burada gömülü İngilizce dizgeler kural dışı değildir.
 *
 * Üretilen şey METİNdir; uygulama onu çalıştırmaz (spec §41 `eval` yasağı) ve
 * doküman üretimi hiçbir kodlayıcı/çözümleyici çağırmaz — modül saf kalır.
 * Aynı şema her zaman bayt bayt aynı metni verir: tarih, rastgelelik, nesne
 * gezinme sırasına bağlı çıktı yok (enum değerleri sayısal sıralanır).
 */

import type { FieldValueKind } from '@/protocol-core/schemas/fieldTypes';
import { fieldTypeInfo } from '@/protocol-core/schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import type { FlatField } from './codegenSupport';
import { bannerFor, fieldByteLength, flattenLeafFields, indentLines, toIdentifier } from './codegenSupport';
import type { CodegenOptions, GeneratedArtifact } from './types';
import { DEFAULT_INDENT } from './types';

/** Değeri olmayan tablo hücresi; boş bırakmak satırı okunmaz yapıyor. */
const EMPTY_CELL = '-';

/**
 * Bayt sırası yalnız çok baytlı SAYISAL alanlarda anlamlıdır. Metin/bayt
 * dizilerinde bayt sırası diye bir şey yok; `bitField` ise bayt sırasını değil
 * `bitOrder`u kullanır.
 */
const ENDIAN_RELEVANT_KINDS: ReadonlySet<FieldValueKind> = new Set<FieldValueKind>([
  'integer',
  'float',
  'enum',
  'timestamp',
  'derived',
]);

/** Çizimde bir baytın en dar/en geniş hâli ve çizilmeye değer en uzun çerçeve. */
const MINIMUM_BYTE_WIDTH = 4;
const MAXIMUM_BYTE_WIDTH = 16;
const MAXIMUM_LAYOUT_BYTES = 64;

/** Örnek çerçeve dökümünde satır başına bayt (klasik hex dump genişliği). */
const HEX_DUMP_COLUMNS = 16;

/**
 * Markdown tablosunda ham `|` hücreyi böler; satır sonu da tabloyu kapatır.
 * Kaçış kod aralığı (`` ` ``) İÇİNDE de gerekir: GFM tabloyu satır içi
 * ayrıştırmadan ÖNCE bölüyor.
 */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function codeCell(value: string): string {
  return `\`${escapeCell(value)}\``;
}

function hexByte(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function pluralBytes(count: number): string {
  return `${count} ${count === 1 ? 'byte' : 'bytes'}`;
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function tableHeader(columns: readonly string[]): string[] {
  return [tableRow(columns), tableRow(columns.map(() => '---'))];
}

interface FieldRow {
  readonly entry: FlatField;
  /** Çerçeve başından bayt konumu; hesaplanamıyorsa `null`. */
  readonly offset: number | null;
  readonly byteLength: number | null;
  /** Alan bir `array` kapsamının içinde mi — tekrar ettiği için konumu sabit değil. */
  readonly repeats: boolean;
}

/**
 * Yaprak alanları belgeye girecek satırlara çevirir ve ofsetleri yürütür.
 *
 * Şemada `offset` ZORUNLU değil (spec §9.6'da `checksum` alanı taşımıyor):
 * verilmeyen alan bir öncekinin bittiği yerden başlar. İmleç bir kez kaybolursa
 * (dinamik uzunluk, dizi tekrarı) sonraki alanların konumu da bilinemez —
 * uydurulmuş bir ofset yazmaktansa hücre boş bırakılır.
 */
function buildRows(schema: ProtocolSchema): readonly FieldRow[] {
  const rows: FieldRow[] = [];
  // Çerçeve başlangıç baytları alan değildir ama bayt konumlarını kaydırır:
  // §9.6 şemasında ilk alanın ofseti 1'dir, çünkü 0'da `AA` vardır.
  let cursor: number | null = schema.framing.startBytes?.length ?? 0;

  for (const entry of flattenLeafFields(schema)) {
    const repeats = entry.path.includes('[]');
    const byteLength = fieldByteLength(entry.field);
    const declared = entry.field.offset;

    let offset: number | null;
    if (declared !== undefined) {
      offset = declared;
    } else if (repeats || cursor === null) {
      offset = null;
    } else {
      offset = cursor;
    }

    rows.push({ entry, offset, byteLength, repeats });

    if (offset === null || byteLength === null || repeats) {
      cursor = null;
    } else {
      cursor = offset + byteLength;
    }
  }
  return rows;
}

function endiannessCell(field: ProtocolFieldSchema, schema: ProtocolSchema, byteLength: number | null): string {
  const info = fieldTypeInfo(field.type);
  if (!ENDIAN_RELEVANT_KINDS.has(info.kind)) {
    return EMPTY_CELL;
  }
  if (byteLength !== null && byteLength <= 1) {
    return EMPTY_CELL;
  }
  return field.endianness ?? schema.defaultEndianness ?? 'big';
}

function lengthCell(field: ProtocolFieldSchema, byteLength: number | null): string {
  if (field.type === 'bitField' && field.bitLength !== undefined) {
    // Bit alanının ölçüsü bayt değil BİT; bayta yuvarlanmış hâli yanıltıcı olur.
    return `${field.bitLength} bit${field.bitLength === 1 ? '' : 's'}`;
  }
  if (field.lengthFrom !== undefined) {
    return `from ${codeCell(field.lengthFrom)}`;
  }
  return byteLength === null ? EMPTY_CELL : pluralBytes(byteLength);
}

/** Fiziksel değer = ham × scale + calibrationOffset (spec §9.2). */
function scaleCell(field: ProtocolFieldSchema): string {
  const { scale, calibrationOffset } = field;
  if (scale === undefined && calibrationOffset === undefined) {
    return EMPTY_CELL;
  }
  // Ölçek yazılmamışsa formüldeki çarpan 1'dir; kalibrasyon sabiti tek başına
  // anlamlı olsun diye 1 açıkça basılır.
  const factor = scale ?? 1;
  return calibrationOffset === undefined
    ? String(factor)
    : `${String(factor)} (offset ${String(calibrationOffset)})`;
}

function renderTitle(schema: ProtocolSchema): string {
  const lines = [`# ${escapeInline(schema.name)}`, '', `**Version:** ${escapeInline(schema.version)}`];
  if (schema.description !== undefined && schema.description !== '') {
    lines.push('', schema.description);
  }
  return lines.join('\n');
}

/** Başlık satırında tabloyu bozacak bir şey yok ama satır sonu başlığı böler. */
function escapeInline(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

function byteListCell(bytes: readonly number[] | undefined): string {
  if (bytes === undefined || bytes.length === 0) {
    return EMPTY_CELL;
  }
  return codeCell(bytes.map((byte) => `0x${hexByte(byte)}`).join(' '));
}

function renderFraming(schema: ProtocolSchema): string {
  const { framing } = schema;
  return [
    '## Framing',
    '',
    ...tableHeader(['Property', 'Value']),
    tableRow(['Type', codeCell(framing.type)]),
    tableRow(['Start bytes', byteListCell(framing.startBytes)]),
    tableRow(['End bytes', byteListCell(framing.endBytes)]),
    tableRow(['Maximum frame length', pluralBytes(framing.maximumFrameLength)]),
  ].join('\n');
}

const FIELD_COLUMNS = [
  'Offset',
  'Name',
  'Type',
  'Length',
  'Endianness',
  'Scale',
  'Unit',
  'Description',
] as const;

function renderFields(rows: readonly FieldRow[], schema: ProtocolSchema): string {
  const lines = ['## Fields', ''];
  if (rows.length === 0) {
    // Doğrulamanın `empty-composite` hatası: şemada alan var ama hiçbiri yaprak.
    lines.push('_This schema defines no leaf fields._');
    return lines.join('\n');
  }

  lines.push(...tableHeader(FIELD_COLUMNS));
  for (const row of rows) {
    const { field } = row.entry;
    lines.push(
      tableRow([
        row.offset === null ? EMPTY_CELL : String(row.offset),
        // Ad hücresi YOLdur: iç içe alan `header.deviceAddress` diye görünür ve
        // üretilen C/Python/TS ayrıştırıcılarındaki erişim yoluyla birebir eşleşir.
        codeCell(row.entry.path),
        codeCell(field.type),
        lengthCell(field, row.byteLength),
        endiannessCell(field, schema, row.byteLength),
        scaleCell(field),
        field.unit === undefined ? EMPTY_CELL : escapeCell(field.unit),
        // Açıklama yoksa insan okunur ad düşer: yol kimliklerden kurulduğu için
        // "Device Address" bilgisi başka hiçbir sütunda görünmüyor.
        escapeCell(field.description ?? field.name),
      ]),
    );
  }

  if (rows.some((row) => row.repeats)) {
    lines.push(
      '',
      'Paths containing `[]` belong to an `array` field: they are listed once but repeat at run time, so their offsets are not fixed.',
    );
  }
  return lines.join('\n');
}

function formatEnumValue(key: string): string {
  const numeric = Number(key);
  if (!Number.isInteger(numeric) || numeric < 0) {
    // Şema anahtarı ondalık metin olmak zorunda; negatif değerin onaltılığı
    // (ikiye tümleyen genişliği bilinmeden) anlamsız olur.
    return key;
  }
  return `${numeric} (0x${numeric.toString(16).toUpperCase()})`;
}

function renderEnumSection(row: FieldRow): string | null {
  const values = row.entry.field.enumValues;
  if (values === undefined) {
    return null;
  }
  const keys = Object.keys(values);
  if (keys.length === 0) {
    return null;
  }
  // Nesne anahtar sırası JS'te tamsayı benzeri anahtarlarda artan, negatiflerde
  // EKLEME sırasıdır. Çıktı deterministik olsun diye sıra burada zorlanır.
  const sorted = [...keys].sort((left, right) => {
    const difference = Number(left) - Number(right);
    if (difference !== 0 && Number.isFinite(difference)) {
      return difference;
    }
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const lines = [`### ${codeCell(row.entry.path)} values`, '', ...tableHeader(['Value', 'Name'])];
  for (const key of sorted) {
    lines.push(tableRow([escapeCell(formatEnumValue(key)), escapeCell(values[key] ?? '')]));
  }
  return lines.join('\n');
}

function renderChecksum(rows: readonly FieldRow[], indent: string): string {
  const checksums = rows.filter(
    (row) => row.entry.field.type === 'checksum' || row.entry.field.type === 'crc',
  );
  const lines = ['## Checksum', ''];
  if (checksums.length === 0) {
    lines.push('This protocol defines no checksum or CRC field.');
    return lines.join('\n');
  }

  for (const row of checksums) {
    const { field } = row.entry;
    const coverage =
      field.coverage === undefined
        ? 'not specified'
        : `${codeCell(field.coverage.startField)} .. ${codeCell(field.coverage.endField)}`;
    const details = [
      `- Algorithm: ${field.algorithm === undefined ? 'not specified' : codeCell(field.algorithm)}`,
      `- Coverage: ${coverage}`,
      `- Width: ${row.byteLength === null ? 'unknown' : pluralBytes(row.byteLength)}`,
    ].join('\n');
    lines.push(`- ${codeCell(row.entry.path)}`, indentLines(details, indent));
  }
  return lines.join('\n');
}

interface LayoutSegment {
  readonly label: string;
  readonly start: number;
  readonly length: number;
}

/**
 * Çerçevenin bayt haritası; çizilemiyorsa `null`.
 *
 * Çizilemediği durumlar: dinamik uzunluk (`lengthFrom`), dizi tekrarı, koşullu
 * alan, hesaplanamayan ofset ve ÇAKIŞAN ofsetler. Sonuncusu doğrulamanın hata
 * saydığı bir durum; yanlış bir çizim basmaktansa "değişken" notu daha dürüst.
 */
function buildLayout(schema: ProtocolSchema, rows: readonly FieldRow[]): LayoutSegment[] | null {
  const segments: LayoutSegment[] = [];
  let cursor = 0;

  const startBytes = schema.framing.startBytes;
  if (startBytes !== undefined && startBytes.length > 0) {
    segments.push({ label: 'start', start: 0, length: startBytes.length });
    cursor = startBytes.length;
  }

  for (const row of rows) {
    if (row.repeats || row.entry.field.condition !== undefined) {
      return null;
    }
    if (row.offset === null || row.byteLength === null) {
      return null;
    }
    if (row.byteLength === 0) {
      // Sıfır baytlık alan (ör. `length: 0` dolgu) haritada yer kaplamaz.
      continue;
    }
    if (row.offset < cursor) {
      return null;
    }
    if (row.offset > cursor) {
      segments.push({ label: '(gap)', start: cursor, length: row.offset - cursor });
    }
    segments.push({ label: row.entry.field.id, start: row.offset, length: row.byteLength });
    cursor = row.offset + row.byteLength;
  }

  const endBytes = schema.framing.endBytes;
  if (endBytes !== undefined && endBytes.length > 0) {
    segments.push({ label: 'end', start: cursor, length: endBytes.length });
  }
  return segments.length === 0 ? null : segments;
}

function fitText(text: string, width: number): string {
  // ASCII çizimde kısaltma işareti '~': üç nokta bir hücrenin yarısını yerdi.
  return text.length <= width ? text : `${text.slice(0, Math.max(width - 1, 0))}~`;
}

function centerText(text: string, width: number): string {
  const fitted = fitText(text, width);
  const left = Math.floor((width - fitted.length) / 2);
  return `${' '.repeat(left)}${fitted}${' '.repeat(width - fitted.length - left)}`;
}

function rangeText(segment: LayoutSegment): string {
  return segment.length === 1
    ? String(segment.start)
    : `${segment.start}-${segment.start + segment.length - 1}`;
}

/**
 * Bayt haritasını ASCII kutulara çizer.
 *
 * Her BAYT aynı genişliktedir — çizimin taşıdığı bilgi budur: iki baytlık alan
 * gözle iki kat geniş görünür. Bayt genişliği en uzun etikete göre seçilir
 * (`n` baytlık hücrenin iç genişliği `n * W + (n - 1)`, birleşen kutu kenarları
 * da içeriğe katılır), böylece kısaltmaya çoğu şemada hiç gerek kalmaz.
 */
function renderLayoutDrawing(segments: readonly LayoutSegment[]): string {
  let byteWidth = MINIMUM_BYTE_WIDTH;
  for (const segment of segments) {
    const needed = Math.max(segment.label.length, rangeText(segment).length) + 2;
    const perByte = Math.ceil((needed - (segment.length - 1)) / segment.length);
    if (perByte > byteWidth) {
      byteWidth = perByte;
    }
  }
  byteWidth = Math.min(byteWidth, MAXIMUM_BYTE_WIDTH);

  const innerWidth = (segment: LayoutSegment): number => segment.length * byteWidth + (segment.length - 1);
  const border = `+${segments.map((segment) => '-'.repeat(innerWidth(segment))).join('+')}+`;
  const indexRow = `|${segments.map((segment) => centerText(rangeText(segment), innerWidth(segment))).join('|')}|`;
  const labelRow = `|${segments.map((segment) => centerText(segment.label, innerWidth(segment))).join('|')}|`;
  return [border, indexRow, border, labelRow, border].join('\n');
}

const VARIABLE_LAYOUT_NOTE =
  'This protocol has a **variable length** frame: at least one field is sized at run time (`lengthFrom`), repeats inside an `array`, or is conditional. A byte-by-byte map would only describe one particular frame, so none is drawn.';

function renderByteLayout(schema: ProtocolSchema, rows: readonly FieldRow[]): string {
  const lines = ['## Byte layout', ''];
  const segments = buildLayout(schema, rows);
  if (segments === null) {
    lines.push(VARIABLE_LAYOUT_NOTE);
    return lines.join('\n');
  }

  const totalBytes = segments.reduce((sum, segment) => sum + segment.length, 0);
  lines.push(`Total frame length: ${pluralBytes(totalBytes)}.`, '');
  if (totalBytes > MAXIMUM_LAYOUT_BYTES) {
    // Çizim tek satıra sığmayınca okunurluğu kalmıyor; tablo zaten ofsetleri veriyor.
    lines.push(
      `The frame is longer than ${String(MAXIMUM_LAYOUT_BYTES)} bytes, so the byte map is omitted; see the offset column above.`,
    );
    return lines.join('\n');
  }
  lines.push('```text', renderLayoutDrawing(segments), '```');
  return lines.join('\n');
}

function renderExampleFrame(frame: Uint8Array | undefined): string | null {
  if (frame === undefined || frame.length === 0) {
    return null;
  }
  const lines = ['## Example frame', '', `${pluralBytes(frame.length)}:`, '', '```text'];
  for (let start = 0; start < frame.length; start += HEX_DUMP_COLUMNS) {
    const chunk = Array.from(frame.slice(start, start + HEX_DUMP_COLUMNS), hexByte).join(' ');
    lines.push(`${start.toString(16).toUpperCase().padStart(4, '0')}: ${chunk}`);
  }
  lines.push('```');
  return lines.join('\n');
}

/**
 * Şemayı paylaşılabilir bir protokol dokümanına çevirir.
 *
 * Örnek çerçeve ŞEMADAN türetilmez; yalnız `options.exampleFrame` verilirse
 * basılır (bkz. {@link CodegenOptions.exampleFrame}).
 */
export function generateMarkdownDoc(
  schema: ProtocolSchema,
  options: CodegenOptions = {},
): GeneratedArtifact {
  // Markdown'da iç liste EN AZ iki boşluk ister; boş girinti alt maddeleri üst
  // maddenin metnine yapıştırır, o yüzden boş değer varsayılana düşer.
  const indent = options.indent === undefined || options.indent === '' ? DEFAULT_INDENT : options.indent;
  const rows = buildRows(schema);

  const sections: string[] = [];
  if (options.banner !== false) {
    sections.push(bannerFor('markdown', schema.name));
  }
  sections.push(renderTitle(schema), renderFraming(schema), renderFields(rows, schema));
  for (const row of rows) {
    const enumSection = renderEnumSection(row);
    if (enumSection !== null) {
      sections.push(enumSection);
    }
  }
  sections.push(renderChecksum(rows, indent), renderByteLayout(schema, rows));
  const example = renderExampleFrame(options.exampleFrame);
  if (example !== null) {
    sections.push(example);
  }

  return {
    id: 'markdown-doc',
    language: 'markdown',
    fileName: `${toIdentifier(schema.name, 'snake')}.md`,
    // Bölümler arasında bir boş satır, dosya sonunda tek satır sonu.
    code: `${sections.join('\n\n')}\n`,
  };
}
