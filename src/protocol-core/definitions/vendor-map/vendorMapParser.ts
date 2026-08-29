/**
 * Üretici kayıt haritası ayrıştırıcısı — CSV ve JSON.
 *
 * ── AYRIŞTIRICI ÖLMEZ ───────────────────────────────────────────────────────
 * Üreticinin tablosu elle düzenlenmiş bir elektronik tablodur: boş satır,
 * birleştirilmiş başlık, "N/A" yazan hücre, virgüllü açıklama metni normaldir.
 * Bozuk BİR satır bütün haritayı düşürmez — o satır atlanır, sorun listeye
 * yazılır ve kalan girdiler kullanılabilir kalır (`edsParser`ın aynı
 * sözleşmesi). Hiç girdi çıkmazsa ayrıştırma başarısızdır.
 *
 * ── SÜTUN SIRASI DAYATILMAZ ─────────────────────────────────────────────────
 * Kullanıcının elindeki tablo bizim sıramıza göre dizilmiş olmaz. Başlık
 * satırı okunur ve sütunlar ADLARINDAN eşlenir; eşanlamlılar kabul edilir
 * (`address`/`register`/`adres`…), çünkü tablolar hem İngilizce hem Türkçe
 * geliyor ve kullanıcıyı sütun adı düzeltmeye zorlamak, aracı kullanmamak için
 * yeterli bir sebep.
 *
 * ── CSV BİR "SPLIT" DEĞİLDİR ────────────────────────────────────────────────
 * Açıklama sütununda virgül olması kural dışı değil, KURAL: "Voltage, phase A".
 * Bu yüzden satır tırnak-farkındalıklı okunur (RFC 4180: çift tırnak içinde
 * virgül veri, `""` kaçış). Naif `split(',')` bu tabloların çoğunu sessizce
 * kaydırırdı — en kötü hata sınıfı, çünkü sonuç dolu ve yanlış görünür.
 */

import type {
  VendorMap,
  VendorMapAddressSpace,
  VendorMapBit,
  VendorMapEntry,
  VendorMapIssue,
  VendorMapParseResult,
  VendorMapValueType,
  VendorMapWordOrder,
} from './vendorMapTypes';

const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;

/** Sütun adı eşanlamlıları; hepsi küçük harfe indirilip boşluk/alt çizgi atılarak karşılaştırılır. */
const COLUMN_ALIASES: Readonly<Record<string, readonly string[]>> = {
  address: ['address', 'adres', 'register', 'reg', 'offset', 'code', 'kod', 'komut', 'command'],
  name: ['name', 'ad', 'isim', 'parameter', 'parametre', 'label', 'tag'],
  type: ['type', 'tip', 'datatype', 'veritipi', 'format'],
  space: ['space', 'addressspace', 'uzay', 'table', 'tablo', 'area'],
  length: ['length', 'uzunluk', 'len', 'size', 'count', 'registers', 'words'],
  scale: ['scale', 'olcek', 'ölçek', 'gain', 'factor', 'multiplier'],
  offset: ['valueoffset', 'offsetvalue', 'bias', 'kayma'],
  unit: ['unit', 'birim', 'units'],
  access: ['access', 'erisim', 'erişim', 'rw', 'readwrite'],
  wordOrder: ['wordorder', 'byteorder', 'siralama', 'sıralama', 'endian', 'endianness'],
  enumValues: ['enum', 'enumvalues', 'values', 'degerler', 'değerler', 'mapping'],
  bits: ['bits', 'bitler', 'bitfield', 'bitmap'],
  description: ['description', 'aciklama', 'açıklama', 'comment', 'note', 'notes'],
};

type ColumnKey = keyof typeof COLUMN_ALIASES;

const VALUE_TYPES: Readonly<Record<string, VendorMapValueType>> = {
  uint16: 'uint16',
  u16: 'uint16',
  word: 'uint16',
  unsigned16: 'uint16',
  int16: 'int16',
  s16: 'int16',
  signed16: 'int16',
  uint32: 'uint32',
  u32: 'uint32',
  dword: 'uint32',
  unsigned32: 'uint32',
  int32: 'int32',
  s32: 'int32',
  signed32: 'int32',
  float32: 'float32',
  float: 'float32',
  real: 'float32',
  ieee754: 'float32',
  bool: 'bool',
  boolean: 'bool',
  bit: 'bool',
  coil: 'bool',
  bitfield: 'bitfield',
  bitmap: 'bitfield',
  status: 'bitfield',
  enum: 'enum',
  ascii: 'ascii',
  string: 'ascii',
  text: 'ascii',
  raw: 'raw',
  bytes: 'raw',
};

const ADDRESS_SPACES: Readonly<Record<string, VendorMapAddressSpace>> = {
  coil: 'coil',
  coils: 'coil',
  '0x': 'coil',
  discreteinput: 'discrete-input',
  discrete: 'discrete-input',
  di: 'discrete-input',
  inputregister: 'input-register',
  input: 'input-register',
  ir: 'input-register',
  holdingregister: 'holding-register',
  holding: 'holding-register',
  hr: 'holding-register',
  command: 'command',
  komut: 'command',
  tlv: 'command',
  datagram: 'command',
};

const WORD_ORDERS: Readonly<Record<string, VendorMapWordOrder>> = {
  highfirst: 'high-first',
  bigendian: 'high-first',
  be: 'high-first',
  msw: 'high-first',
  abcd: 'high-first',
  lowfirst: 'low-first',
  littleendian: 'low-first',
  le: 'low-first',
  lsw: 'low-first',
  cdab: 'low-first',
};

/** Karşılaştırma anahtarı: küçük harf, boşluk/alt çizgi/tire yok. */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s_\-./]/g, '');
}

/**
 * RFC 4180 satır okuyucu. Tırnak içindeki virgül ve `""` kaçışı korunur;
 * ayrıca noktalı virgül de ayraç sayılır — Türkçe yerelde Excel varsayılan
 * olarak `;` yazıyor ve o dosyalar `,` beklendiğinde tek sütun olarak okunup
 * "harita boş" sanılıyordu.
 */
export function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        current += char ?? '';
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === separator) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char ?? '';
  }
  cells.push(current.trim());
  return cells;
}

/** Ayraç tahmini: başlık satırında hangisi daha çok sütun üretiyorsa o. */
function detectSeparator(headerLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = splitCsvLine(headerLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Adres hem `0x40001` hem `40001` hem `40001 (0x9C41)` biçiminde geliyor.
 * Parantezli ikinci gösterim yok sayılır: ilk sayı esastır, çünkü tablonun
 * kendi sıralaması ona göre.
 */
export function parseAddress(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const hex = /^0x([0-9a-f]+)/i.exec(trimmed);
  if (hex?.[1] !== undefined) return Number.parseInt(hex[1], HEX_RADIX);
  const decimal = /^(\d+)/.exec(trimmed);
  if (decimal?.[1] !== undefined) return Number.parseInt(decimal[1], DECIMAL_RADIX);
  return null;
}

/** Ondalık ayracı virgül olan tablolar var ("0,1"); nokta ile aynı sayı sayılır. */
function parseNumber(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** `16=Sensor Data;32=Set Output` → sözlük. Ayraç `;` ya da `|`. */
function parseEnumValues(text: string): Readonly<Record<string, string>> | undefined {
  const pairs = text
    .split(/[;|]/)
    .map((pair) => pair.trim())
    .filter((pair) => pair !== '');
  if (pairs.length === 0) return undefined;

  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const match = /^([^=:]+)[=:](.*)$/.exec(pair);
    if (match?.[1] === undefined || match[2] === undefined) continue;
    const key = parseAddress(match[1]);
    if (key === null) continue;
    out[String(key)] = match[2].trim();
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/** `0=Ready;3=Fault` biçimi bit listesi için de kullanılır. */
function parseBits(text: string): readonly VendorMapBit[] | undefined {
  const values = parseEnumValues(text);
  if (values === undefined) return undefined;
  return Object.entries(values)
    .map(([bit, name]) => ({ bit: Number(bit), name }))
    .sort((left, right) => left.bit - right.bit);
}

function parseAccess(text: string): VendorMapEntry['access'] | undefined {
  const key = normalizeKey(text);
  if (key === 'r' || key === 'ro' || key === 'read' || key === 'readonly') return 'r';
  if (key === 'w' || key === 'wo' || key === 'write' || key === 'writeonly') return 'w';
  if (key === 'rw' || key === 'readwrite') return 'rw';
  return undefined;
}

interface HeaderMap {
  readonly columns: ReadonlyMap<ColumnKey, number>;
  readonly separator: string;
}

function readHeader(line: string): HeaderMap | null {
  const separator = detectSeparator(line);
  const cells = splitCsvLine(line, separator);
  const columns = new Map<ColumnKey, number>();

  for (const [index, cell] of cells.entries()) {
    const key = normalizeKey(cell);
    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, string[]][]) {
      if (columns.has(column)) continue;
      if (aliases.includes(key)) columns.set(column, index);
    }
  }

  // Adres ve ad olmadan tablo bir kayıt haritası değildir; tip eksikse
  // `uint16` varsayılır (Modbus tablolarının çoğu tipi yazmaz).
  return columns.has('address') && columns.has('name') ? { columns, separator } : null;
}

function cellAt(cells: readonly string[], columns: HeaderMap['columns'], key: ColumnKey): string {
  const index = columns.get(key);
  return index === undefined ? '' : (cells[index] ?? '');
}

/**
 * `# device: ACME 3000` gibi yorum satırları başlıktan ÖNCE gelir ve harita
 * üstbilgisini taşır. Zorunlu değil; yoksa cihaz adı dosyadan bilinemez ve
 * çağıran (panel) dosya adını kullanır.
 */
function parseHeaderComment(line: string): { key: string; value: string } | null {
  const match = /^[#;]\s*([\w-]+)\s*[:=]\s*(.+)$/.exec(line.trim());
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return { key: normalizeKey(match[1]), value: match[2].trim() };
}

export function parseVendorMapCsv(text: string): VendorMapParseResult {
  const issues: VendorMapIssue[] = [];
  const lines = text.split(/\r?\n/);
  const entries: VendorMapEntry[] = [];
  const seen = new Set<string>();

  let header: HeaderMap | null = null;
  let device = '';
  let vendor: string | undefined;
  let revision: string | undefined;
  let defaultWordOrder: VendorMapWordOrder = 'high-first';

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith('#') || line.startsWith(';')) {
      const comment = parseHeaderComment(line);
      if (comment === null) continue;
      if (comment.key === 'device' || comment.key === 'cihaz') device = comment.value;
      else if (comment.key === 'vendor' || comment.key === 'uretici') vendor = comment.value;
      else if (comment.key === 'revision' || comment.key === 'revizyon') revision = comment.value;
      else if (comment.key === 'wordorder' || comment.key === 'byteorder') {
        defaultWordOrder = WORD_ORDERS[normalizeKey(comment.value)] ?? defaultWordOrder;
      }
      continue;
    }

    if (header === null) {
      header = readHeader(line);
      if (header === null) {
        issues.push({ line: lineNumber, messageKey: 'definition.vendorMap.issue.headerNotFound', text: line });
      }
      continue;
    }

    const cells = splitCsvLine(line, header.separator);
    const address = parseAddress(cellAt(cells, header.columns, 'address'));
    const name = cellAt(cells, header.columns, 'name');

    if (address === null || name === '') {
      issues.push({ line: lineNumber, messageKey: 'definition.vendorMap.issue.rowSkipped', text: line });
      continue;
    }

    const typeText = normalizeKey(cellAt(cells, header.columns, 'type'));
    // Tip yazılmamışsa `uint16`: Modbus tablolarının çoğu tek register'lık
    // işaretsiz değeri "varsayılan" sayıp sütunu hiç doldurmuyor.
    const type: VendorMapValueType = typeText === '' ? 'uint16' : (VALUE_TYPES[typeText] ?? 'raw');
    if (typeText !== '' && VALUE_TYPES[typeText] === undefined) {
      issues.push({
        line: lineNumber,
        messageKey: 'definition.vendorMap.issue.unknownType',
        text: cellAt(cells, header.columns, 'type'),
      });
    }

    const spaceText = normalizeKey(cellAt(cells, header.columns, 'space'));
    const space: VendorMapAddressSpace =
      spaceText === '' ? 'unspecified' : (ADDRESS_SPACES[spaceText] ?? 'unspecified');

    const entry: VendorMapEntry = {
      address,
      name,
      type,
      space,
      ...optional('length', parseNumber(cellAt(cells, header.columns, 'length'))),
      ...optional('scale', parseNumber(cellAt(cells, header.columns, 'scale'))),
      ...optional('offset', parseNumber(cellAt(cells, header.columns, 'offset'))),
      ...optional('unit', emptyToUndefined(cellAt(cells, header.columns, 'unit'))),
      ...optional('access', parseAccess(cellAt(cells, header.columns, 'access'))),
      ...optional('wordOrder', WORD_ORDERS[normalizeKey(cellAt(cells, header.columns, 'wordOrder'))]),
      ...optional('enumValues', parseEnumValues(cellAt(cells, header.columns, 'enumValues'))),
      ...optional('bits', parseBits(cellAt(cells, header.columns, 'bits'))),
      ...optional('description', emptyToUndefined(cellAt(cells, header.columns, 'description'))),
    };

    // Aynı adres iki kez yazılmışsa İLK tanım geçerli: ikincisi genelde
    // kopyala-yapıştır artığı ve sessizce üzerine yazmak, kullanıcının
    // gördüğü tabloyla panelin gösterdiğini ayrıştırır.
    const key = `${entry.space}:${String(entry.address)}`;
    if (seen.has(key)) {
      issues.push({ line: lineNumber, messageKey: 'definition.vendorMap.issue.duplicateAddress', text: line });
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  if (header === null) {
    issues.push({ line: 0, messageKey: 'definition.vendorMap.issue.headerNotFound' });
    return { success: false, issues };
  }
  if (entries.length === 0) {
    issues.push({ line: 0, messageKey: 'definition.vendorMap.issue.noEntries' });
    return { success: false, issues };
  }

  return {
    success: true,
    map: {
      device,
      ...optional('vendor', vendor),
      ...optional('revision', revision),
      defaultWordOrder,
      entries,
    },
    issues,
  };
}

/** `exactOptionalPropertyTypes` olmasa da alanı `undefined` ile doldurmuyoruz: tabloda yazmayan şey modelde de YOK. */
function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function emptyToUndefined(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * JSON girişi: panelin kendi dışa aktarımı ve başka araçlardan gelen haritalar.
 * Doğrulama ELLE yapılır (zod ile değil): `schemas/protocolSchema.ts`in aksine
 * burada model küçük ve düz, ama girdi GÜVENİLMEZ — her alan tek tek okunur ve
 * tanınmayan değer sessizce düşürülmez, sorun listesine yazılır.
 */
export function parseVendorMapJson(text: string): VendorMapParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch (cause) {
    return {
      success: false,
      issues: [
        {
          line: 0,
          messageKey: 'definition.vendorMap.issue.invalidJson',
          text: cause instanceof Error ? cause.message : String(cause),
        },
      ],
    };
  }

  if (typeof decoded !== 'object' || decoded === null) {
    return { success: false, issues: [{ line: 0, messageKey: 'definition.vendorMap.issue.invalidJson' }] };
  }

  const source = decoded as Record<string, unknown>;
  const rawEntries = Array.isArray(source['entries']) ? source['entries'] : [];
  const issues: VendorMapIssue[] = [];
  const entries: VendorMapEntry[] = [];

  for (const [index, rawEntry] of rawEntries.entries()) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      issues.push({ line: index + 1, messageKey: 'definition.vendorMap.issue.rowSkipped' });
      continue;
    }
    const record = rawEntry as Record<string, unknown>;
    const address =
      typeof record['address'] === 'number'
        ? record['address']
        : typeof record['address'] === 'string'
          ? parseAddress(record['address'])
          : null;
    const name = typeof record['name'] === 'string' ? record['name'] : '';
    if (address === null || name === '') {
      issues.push({ line: index + 1, messageKey: 'definition.vendorMap.issue.rowSkipped' });
      continue;
    }

    const typeText = typeof record['type'] === 'string' ? normalizeKey(record['type']) : '';
    const type: VendorMapValueType = typeText === '' ? 'uint16' : (VALUE_TYPES[typeText] ?? 'raw');
    const spaceText = typeof record['space'] === 'string' ? normalizeKey(record['space']) : '';
    const space: VendorMapAddressSpace =
      spaceText === '' ? 'unspecified' : (ADDRESS_SPACES[spaceText] ?? 'unspecified');

    entries.push({
      address,
      name,
      type,
      space,
      ...optional('length', typeof record['length'] === 'number' ? record['length'] : undefined),
      ...optional('scale', typeof record['scale'] === 'number' ? record['scale'] : undefined),
      ...optional('offset', typeof record['offset'] === 'number' ? record['offset'] : undefined),
      ...optional('unit', typeof record['unit'] === 'string' ? record['unit'] : undefined),
      ...optional(
        'access',
        typeof record['access'] === 'string' ? parseAccess(record['access']) : undefined,
      ),
      ...optional(
        'wordOrder',
        typeof record['wordOrder'] === 'string' ? WORD_ORDERS[normalizeKey(record['wordOrder'])] : undefined,
      ),
      ...optional(
        'enumValues',
        typeof record['enumValues'] === 'object' && record['enumValues'] !== null
          ? (record['enumValues'] as Record<string, string>)
          : undefined,
      ),
      ...optional('bits', Array.isArray(record['bits']) ? (record['bits'] as VendorMapBit[]) : undefined),
      ...optional(
        'description',
        typeof record['description'] === 'string' ? record['description'] : undefined,
      ),
    });
  }

  if (entries.length === 0) {
    issues.push({ line: 0, messageKey: 'definition.vendorMap.issue.noEntries' });
    return { success: false, issues };
  }

  const wordOrderText = typeof source['defaultWordOrder'] === 'string' ? source['defaultWordOrder'] : '';
  const map: VendorMap = {
    device: typeof source['device'] === 'string' ? source['device'] : '',
    ...optional('vendor', typeof source['vendor'] === 'string' ? source['vendor'] : undefined),
    ...optional('revision', typeof source['revision'] === 'string' ? source['revision'] : undefined),
    defaultWordOrder: WORD_ORDERS[normalizeKey(wordOrderText)] ?? 'high-first',
    entries,
  };
  return { success: true, map, issues };
}

/**
 * Biçim İÇERİKTEN seçilir, dosya adından değil: kullanıcı `.txt` uzantılı bir
 * CSV ya da `.map` uzantılı bir JSON verebilir ve uzantıya bakan bir seçim
 * onları "bozuk dosya" diye reddederdi.
 */
export function parseVendorMap(text: string): VendorMapParseResult {
  return text.trimStart().startsWith('{') ? parseVendorMapJson(text) : parseVendorMapCsv(text);
}
