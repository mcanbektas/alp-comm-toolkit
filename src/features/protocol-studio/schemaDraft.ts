/**
 * Custom Protocol Studio'nun DÜZENLEME modeli — şemanın kendisi değil, taslağı.
 *
 * ## Neden şemayı doğrudan düzenlemiyoruz
 *
 * İki ayrı sebep, ikisi de tek başına yeterli:
 *
 * 1. `ProtocolSchema`/`ProtocolFieldSchema`'nın HER alanı `readonly` ve zod ile
 *    doğrulanıyor. Doğrulanmış şema bir SONUÇtur; her tuş vuruşunda geçerli
 *    kalması beklenemez.
 * 2. Form alanı kullanıcı yazarken ARA DURUM tutar: `"1."`, `"-"`, `"0x"`,
 *    `""`. Bunların hiçbiri `number` ile temsil edilemez. Sayı tipine erken
 *    çevirmek, kullanıcının yazdığını altından çekmek demektir (`"-"` → 0 →
 *    ekranda "0" belirir).
 *
 * Bu yüzden düzenleme boyunca ayrı, mutable, STRING tabanlı bir taslak tutulur;
 * şema yalnız `draftToSchema` ile, istendiği anda üretilir.
 *
 * ## Kimlik: `draftId` ile `id` ayrı şeylerdir
 *
 * `id` kullanıcının verdiği, şemaya YAZILAN alan kimliğidir ve kullanıcı onu
 * istediği an değiştirir. `draftId` ise yalnız düzenleme oturumu boyunca yaşar,
 * şemaya yazılmaz ve DEĞİŞMEZ. React `key`'i ve "seçili alan" durumu buna
 * bağlanır — `id` üzerinden bağlansaydı kullanıcı kimliği düzelttiği anda
 * seçim kaybolur, açık ağaç düğümleri kapanırdı.
 *
 * ## Sayı metni
 *
 * Tam sayı alanları `0x` önekli onaltılık girdiyi de kabul eder (bayt
 * değerleri, komut kodları sahada onaltılık yazılır). Şemaya her zaman ONDALIK
 * yazılır; `enumValues` anahtarının zod deseni (`/^-?\d+$/`) zaten onaltılığı
 * reddeder ve iki gösterimi karıştırmak enum eşleşmesini sessizce kaçırırdı.
 */

import type { ChecksumAlgorithm } from '@/protocol-core/checksums/algorithmCatalogue';
import type { BitOrder } from '@/protocol-core/decoding/bitCursor';
import type { Endianness } from '@/protocol-core/encoding/ieee754';
import type { FieldType } from '@/protocol-core/schemas/fieldTypes';
import { fieldTypeInfo } from '@/protocol-core/schemas/fieldTypes';
import type {
  ProtocolFieldSchema,
  ProtocolFramingSchema,
  ProtocolSchema,
} from '@/protocol-core/schemas/protocolSchema';
import { parseProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

export type FramingType = ProtocolFramingSchema['type'];

/**
 * Seçim kutusunun kaynağı. Record olarak yazıldı: `protocolSchema.ts`'e yeni
 * bir framing tipi eklenirse burada DERLEME HATASI çıkar; düz bir dizi olsaydı
 * liste sessizce eksik kalırdı.
 */
const FRAMING_TYPE_PRESENCE: Readonly<Record<FramingType, true>> = {
  startEnd: true,
  startOnly: true,
  fixedLength: true,
  lengthField: true,
  none: true,
};

export function isFramingType(value: string): value is FramingType {
  return Object.prototype.hasOwnProperty.call(FRAMING_TYPE_PRESENCE, value);
}

export const FRAMING_TYPES: readonly FramingType[] =
  Object.keys(FRAMING_TYPE_PRESENCE).filter(isFramingType);

/**
 * Enum satırı. Şemada `Record<string, string>` olarak duruyor ama düzenlerken
 * SIRA ve satır kimliği gerekir: kullanıcı anahtarı düzeltirken (`"1"` → `"16"`)
 * record anahtarı değişir, React girdiyi yeniden kurar ve odak kaybolur.
 */
export interface EnumEntryDraft {
  /** Yalnız React `key`'i için; şemaya yazılmaz. */
  entryId: string;
  key: string;
  label: string;
}

export interface CoverageDraft {
  startField: string;
  endField: string;
}

export interface ConditionDraft {
  field: string;
  /** Tam sayı metni. */
  equals: string;
}

/** `repeatCount` şemada `number | { fromField }`; formda üçüncü hâl "yok"tur. */
export interface RepeatCountDraft {
  mode: 'none' | 'fixed' | 'fromField';
  /** `mode === 'fixed'` iken kullanılır. */
  count: string;
  /** `mode === 'fromField'` iken kullanılır. */
  fromField: string;
}

/** `defaultValue` şemada `number | string`; hangisi olduğu metinden anlaşılamaz. */
export type DefaultValueKind = 'number' | 'text';

export interface FieldDraft {
  /** Düzenleme oturumu boyunca değişmeyen kimlik. Şemaya YAZILMAZ. */
  draftId: string;

  id: string;
  name: string;
  type: FieldType;
  description: string;

  offset: string;
  length: string;
  lengthFrom: string;

  /** `null` = kullanıcı seçmedi, şemaya yazılmaz. Tip zaten işareti ima eder. */
  signed: boolean | null;
  /** `''` = seçilmedi. */
  endianness: Endianness | '';
  bitOrder: BitOrder | '';
  bitOffset: string;
  bitLength: string;
  bitMask: string;

  scale: string;
  calibrationOffset: string;
  unit: string;
  minimum: string;
  maximum: string;

  enumValues: EnumEntryDraft[];

  algorithm: ChecksumAlgorithm | '';
  coverage: CoverageDraft;

  condition: ConditionDraft;
  repeatCount: RepeatCountDraft;
  /** `structure`/`array` iç alanları. Boş dizi = iç alan yok. */
  fields: FieldDraft[];

  defaultValue: string;
  defaultValueKind: DefaultValueKind;
  color: string;
  documentation: string;
}

export interface FramingDraft {
  type: FramingType;
  startBytes: string[];
  endBytes: string[];
  maximumFrameLength: string;
}

export interface SchemaDraft {
  name: string;
  version: string;
  description: string;
  framing: FramingDraft;
  defaultEndianness: Endianness | '';
  fields: FieldDraft[];
}

/**
 * Ekranın `t()` ile çevireceği anahtarların TAM listesi. Ham teknik metin
 * üretilmez: sorunun kendisi anahtar + parametredir, cümleyi sözlük kurar.
 */
export const DRAFT_MESSAGE_KEYS = [
  'studio.draft.nameRequired',
  'studio.draft.versionRequired',
  'studio.draft.maximumFrameLengthRequired',
  'studio.draft.fieldsRequired',
  'studio.draft.fieldIdRequired',
  'studio.draft.fieldNameRequired',
  'studio.draft.integerInvalid',
  'studio.draft.numberInvalid',
  'studio.draft.byteRange',
  'studio.draft.enumKeyInvalid',
  'studio.draft.enumKeyDuplicate',
  'studio.draft.enumLabelRequired',
  'studio.draft.coverageIncomplete',
  'studio.draft.conditionIncomplete',
  'studio.draft.repeatFieldRequired',
  'studio.draft.schemaRejected',
] as const;

export type DraftMessageKey = (typeof DRAFT_MESSAGE_KEYS)[number];

export interface DraftIssue {
  /** Sorunun ait olduğu alan taslağı; şema düzeyindeki sorunlarda `null`. */
  readonly draftId: string | null;
  /** Kök taslaktan itibaren noktalı yol, ör. `fields.1.enumValues.16`. */
  readonly field: string;
  readonly messageKey: DraftMessageKey;
  readonly params?: Readonly<Record<string, string>>;
}

export interface DraftConversionResult {
  /** Tek bir sorun bile varsa `null` — yarım şema üretmek sessiz hatadır. */
  readonly schema: ProtocolSchema | null;
  readonly issues: readonly DraftIssue[];
}

// --- Kimlik üretimi ------------------------------------------------------

/**
 * `crypto.randomUUID` bilerek kullanılmıyor: testlerin ürettiği kimlikler
 * deterministik olmalı, yoksa taslak anlık görüntüsü karşılaştırılamaz.
 * Sayaç modül ömrü boyunca artar; aynı oturumda iki kez aynı kimlik çıkmaz.
 */
let identityCounter = 0;

function nextIdentity(prefix: string): string {
  identityCounter += 1;
  return `${prefix}-${identityCounter}`;
}

/** YALNIZ TEST İÇİN. Üretim kodunda çağrılırsa kimlikler çakışır. */
export function resetDraftIdCounter(): void {
  identityCounter = 0;
}

// --- Sayı metni çözümleme ------------------------------------------------

const DECIMAL_INTEGER = /^[+-]?\d+$/;
const HEX_INTEGER = /^([+-]?)0[xX]([0-9a-fA-F]+)$/;
const DECIMAL_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Tam sayı metnini çözer; onaltılık `0x` önekini kabul eder.
 *
 * `Number()` tek başına kullanılamaz: `Number('')` ve `Number(' ')` 0 döner,
 * `Number('Infinity')` sonsuz, `Number('-0x10')` ise NaN. Bu yüzden önce desen,
 * sonra dönüşüm.
 */
function parseIntegerText(text: string): number | null {
  const trimmed = text.trim();
  if (DECIMAL_INTEGER.test(trimmed)) {
    const value = Number(trimmed);
    return Number.isSafeInteger(value) ? value : null;
  }
  const hex = HEX_INTEGER.exec(trimmed);
  if (hex === null) {
    return null;
  }
  const digits = hex[2];
  if (digits === undefined) {
    return null;
  }
  const magnitude = Number.parseInt(digits, 16);
  if (!Number.isSafeInteger(magnitude)) {
    return null;
  }
  return hex[1] === '-' ? -magnitude : magnitude;
}

function parseNumberText(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL_NUMBER.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// --- Taslak kurucular ----------------------------------------------------

export function createEmptyDraft(): SchemaDraft {
  return {
    name: '',
    // Sürüm zorunlu; boş bırakmak yerine makul bir başlangıç veriyoruz.
    version: '1.0',
    description: '',
    framing: {
      type: 'startEnd',
      startBytes: [],
      endBytes: [],
      maximumFrameLength: '256',
    },
    defaultEndianness: '',
    fields: [],
  };
}

/**
 * Yeni alan taslağı. `length` tipin kendi genişliğinden gelir; genişliği
 * olmayan tiplerde (`ascii`, `rawBytes`, `enum`…) boş kalır — uzunluğu
 * kullanıcı ya da `lengthFrom` verecek.
 */
export function createFieldDraft(type: FieldType = 'uint8'): FieldDraft {
  const draftId = nextIdentity('fd');
  const info = fieldTypeInfo(type);
  // Varsayılan `id`/`name` draftId'nin sayısından türetilir: benzersizdir ve
  // kullanıcı ilk gördüğünde hangi alan olduğunu ayırt eder.
  const ordinal = draftId.slice('fd-'.length);
  return {
    draftId,
    id: `field${ordinal}`,
    name: `Field ${ordinal}`,
    type,
    description: '',
    offset: '',
    length: info.byteLength === undefined ? '' : String(info.byteLength),
    lengthFrom: '',
    signed: null,
    endianness: '',
    bitOrder: '',
    bitOffset: '',
    bitLength: '',
    bitMask: '',
    scale: '',
    calibrationOffset: '',
    unit: '',
    minimum: '',
    maximum: '',
    enumValues: [],
    algorithm: '',
    coverage: { startField: '', endField: '' },
    condition: { field: '', equals: '' },
    repeatCount: { mode: 'none', count: '', fromField: '' },
    fields: [],
    defaultValue: '',
    defaultValueKind: 'text',
    color: '',
    documentation: '',
  };
}

export function createEnumEntryDraft(key = '', label = ''): EnumEntryDraft {
  return { entryId: nextIdentity('en'), key, label };
}

// --- Taslak → şema -------------------------------------------------------

function makeIssue(
  draftId: string | null,
  field: string,
  messageKey: DraftMessageKey,
  params?: Readonly<Record<string, string>>,
): DraftIssue {
  return params === undefined
    ? { draftId, field, messageKey }
    : { draftId, field, messageKey, params };
}

interface ConversionContext {
  readonly issues: DraftIssue[];
}

/** Boş metin = "kullanıcı doldurmadı" = şemada anahtar yok. */
function optionalText(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function integerOrIssue(
  text: string,
  draftId: string | null,
  path: string,
  context: ConversionContext,
): number | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  const value = parseIntegerText(text);
  if (value === null) {
    context.issues.push(
      makeIssue(draftId, path, 'studio.draft.integerInvalid', { value: text }),
    );
    return undefined;
  }
  return value;
}

function numberOrIssue(
  text: string,
  draftId: string | null,
  path: string,
  context: ConversionContext,
): number | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  const value = parseNumberText(text);
  if (value === null) {
    context.issues.push(
      makeIssue(draftId, path, 'studio.draft.numberInvalid', { value: text }),
    );
    return undefined;
  }
  return value;
}

function assign(target: Record<string, unknown>, key: string, value: unknown): void {
  // `undefined` değerli anahtar YAZILMAZ: zod opsiyoneli kabul etse de JSON
  // dışa aktarımında `"offset": null` gibi bir artık bırakırdı.
  if (value !== undefined) {
    target[key] = value;
  }
}

/**
 * Bayt listesi. Tamamen boş satırlar ATLANIR — kullanıcı "bayt ekle" deyip
 * henüz yazmamış olabilir; bu bir hata değil, yarım bir satırdır.
 */
function convertByteList(
  values: readonly string[],
  path: string,
  context: ConversionContext,
): number[] | undefined {
  const bytes: number[] = [];
  for (const [index, text] of values.entries()) {
    if (text.trim() === '') {
      continue;
    }
    const value = parseIntegerText(text);
    if (value === null) {
      context.issues.push(
        makeIssue(null, `${path}.${index}`, 'studio.draft.integerInvalid', { value: text }),
      );
      continue;
    }
    if (value < 0 || value > 255) {
      context.issues.push(
        makeIssue(null, `${path}.${index}`, 'studio.draft.byteRange', { value: text }),
      );
      continue;
    }
    bytes.push(value);
  }
  return bytes.length === 0 ? undefined : bytes;
}

function convertEnumValues(
  field: FieldDraft,
  path: string,
  context: ConversionContext,
): Record<string, string> | undefined {
  const record: Record<string, string> = {};
  for (const entry of field.enumValues) {
    const key = entry.key.trim();
    if (key === '' && entry.label.trim() === '') {
      // Henüz doldurulmamış satır.
      continue;
    }
    const numeric = parseIntegerText(key);
    if (numeric === null) {
      context.issues.push(
        makeIssue(field.draftId, `${path}.enumValues`, 'studio.draft.enumKeyInvalid', {
          key: entry.key,
        }),
      );
      continue;
    }
    // Şemada anahtar ONDALIK metindir; `0x10` girildiyse burada `16` olur.
    const normalized = String(numeric);
    if (Object.prototype.hasOwnProperty.call(record, normalized)) {
      context.issues.push(
        makeIssue(field.draftId, `${path}.enumValues.${normalized}`, 'studio.draft.enumKeyDuplicate', {
          key: normalized,
        }),
      );
      continue;
    }
    if (entry.label.trim() === '') {
      context.issues.push(
        makeIssue(field.draftId, `${path}.enumValues.${normalized}`, 'studio.draft.enumLabelRequired', {
          key: normalized,
        }),
      );
      continue;
    }
    record[normalized] = entry.label;
  }
  return Object.keys(record).length === 0 ? undefined : record;
}

function convertRepeatCount(
  field: FieldDraft,
  path: string,
  context: ConversionContext,
): number | { fromField: string } | undefined {
  switch (field.repeatCount.mode) {
    case 'none':
      return undefined;
    case 'fixed':
      return integerOrIssue(
        field.repeatCount.count,
        field.draftId,
        `${path}.repeatCount`,
        context,
      );
    case 'fromField': {
      const fromField = field.repeatCount.fromField.trim();
      if (fromField === '') {
        context.issues.push(
          makeIssue(field.draftId, `${path}.repeatCount`, 'studio.draft.repeatFieldRequired'),
        );
        return undefined;
      }
      return { fromField };
    }
  }
}

function convertFieldDraft(
  field: FieldDraft,
  path: string,
  context: ConversionContext,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  const id = field.id.trim();
  if (id === '') {
    context.issues.push(makeIssue(field.draftId, `${path}.id`, 'studio.draft.fieldIdRequired'));
  } else {
    output.id = id;
  }

  const name = field.name.trim();
  if (name === '') {
    context.issues.push(makeIssue(field.draftId, `${path}.name`, 'studio.draft.fieldNameRequired'));
  } else {
    output.name = name;
  }

  output.type = field.type;

  assign(output, 'description', optionalText(field.description));
  assign(output, 'offset', integerOrIssue(field.offset, field.draftId, `${path}.offset`, context));
  assign(output, 'length', integerOrIssue(field.length, field.draftId, `${path}.length`, context));
  assign(output, 'lengthFrom', optionalText(field.lengthFrom.trim()));

  if (field.signed !== null) {
    output.signed = field.signed;
  }
  assign(output, 'endianness', optionalText(field.endianness));
  assign(output, 'bitOrder', optionalText(field.bitOrder));
  assign(
    output,
    'bitOffset',
    integerOrIssue(field.bitOffset, field.draftId, `${path}.bitOffset`, context),
  );
  assign(
    output,
    'bitLength',
    integerOrIssue(field.bitLength, field.draftId, `${path}.bitLength`, context),
  );
  assign(output, 'bitMask', integerOrIssue(field.bitMask, field.draftId, `${path}.bitMask`, context));

  assign(output, 'scale', numberOrIssue(field.scale, field.draftId, `${path}.scale`, context));
  assign(
    output,
    'calibrationOffset',
    numberOrIssue(field.calibrationOffset, field.draftId, `${path}.calibrationOffset`, context),
  );
  assign(output, 'unit', optionalText(field.unit));
  assign(output, 'minimum', numberOrIssue(field.minimum, field.draftId, `${path}.minimum`, context));
  assign(output, 'maximum', numberOrIssue(field.maximum, field.draftId, `${path}.maximum`, context));

  assign(output, 'enumValues', convertEnumValues(field, path, context));
  assign(output, 'algorithm', optionalText(field.algorithm));

  const startField = field.coverage.startField.trim();
  const endField = field.coverage.endField.trim();
  if (startField !== '' && endField !== '') {
    output.coverage = { startField, endField };
  } else if (startField !== '' || endField !== '') {
    // Yarım kapsam sessizce düşürülemez: checksum yanlış aralığı hesaplardı.
    context.issues.push(
      makeIssue(field.draftId, `${path}.coverage`, 'studio.draft.coverageIncomplete'),
    );
  }

  const conditionField = field.condition.field.trim();
  const equalsText = field.condition.equals.trim();
  if (conditionField !== '' && equalsText !== '') {
    const equals = integerOrIssue(equalsText, field.draftId, `${path}.condition.equals`, context);
    if (equals !== undefined) {
      output.condition = { field: conditionField, equals };
    }
  } else if (conditionField !== '' || equalsText !== '') {
    context.issues.push(
      makeIssue(field.draftId, `${path}.condition`, 'studio.draft.conditionIncomplete'),
    );
  }

  assign(output, 'repeatCount', convertRepeatCount(field, path, context));

  if (field.fields.length > 0) {
    output.fields = field.fields.map((child, index) =>
      convertFieldDraft(child, `${path}.fields.${index}`, context),
    );
  }

  if (field.defaultValue !== '') {
    if (field.defaultValueKind === 'number') {
      assign(
        output,
        'defaultValue',
        numberOrIssue(field.defaultValue, field.draftId, `${path}.defaultValue`, context),
      );
    } else {
      output.defaultValue = field.defaultValue;
    }
  }

  assign(output, 'color', integerOrIssue(field.color, field.draftId, `${path}.color`, context));
  assign(output, 'documentation', optionalText(field.documentation));

  return output;
}

/**
 * zod yolunu (`fields.1.fields.0.length`) taslak kimliğine çevirir; ekran
 * sorunu doğru satırda gösterebilsin diye. Yol alan İNDEKSİ taşır, kimlik
 * değil — taslak ile şema alan sıraları birebir aynı olduğu için indeks
 * güvenle izlenebilir.
 */
function draftIdForSchemaPath(draft: SchemaDraft, path: string): string | null {
  const segments = path.split('.');
  let list: readonly FieldDraft[] = draft.fields;
  let draftId: string | null = null;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] !== 'fields') {
      continue;
    }
    const raw = segments[index + 1];
    if (raw === undefined || !DECIMAL_INTEGER.test(raw)) {
      break;
    }
    const child = list[Number(raw)];
    if (child === undefined) {
      break;
    }
    draftId = child.draftId;
    list = child.fields;
    index += 1;
  }
  return draftId;
}

export function draftToSchema(draft: SchemaDraft): DraftConversionResult {
  const context: ConversionContext = { issues: [] };
  const candidate: Record<string, unknown> = {};

  const name = draft.name.trim();
  if (name === '') {
    context.issues.push(makeIssue(null, 'name', 'studio.draft.nameRequired'));
  } else {
    candidate.name = name;
  }

  const version = draft.version.trim();
  if (version === '') {
    context.issues.push(makeIssue(null, 'version', 'studio.draft.versionRequired'));
  } else {
    candidate.version = version;
  }

  assign(candidate, 'description', optionalText(draft.description));
  assign(candidate, 'defaultEndianness', optionalText(draft.defaultEndianness));

  const framing: Record<string, unknown> = { type: draft.framing.type };
  assign(
    framing,
    'startBytes',
    convertByteList(draft.framing.startBytes, 'framing.startBytes', context),
  );
  assign(framing, 'endBytes', convertByteList(draft.framing.endBytes, 'framing.endBytes', context));
  if (draft.framing.maximumFrameLength.trim() === '') {
    context.issues.push(
      makeIssue(null, 'framing.maximumFrameLength', 'studio.draft.maximumFrameLengthRequired'),
    );
  } else {
    assign(
      framing,
      'maximumFrameLength',
      integerOrIssue(
        draft.framing.maximumFrameLength,
        null,
        'framing.maximumFrameLength',
        context,
      ),
    );
  }
  candidate.framing = framing;

  if (draft.fields.length === 0) {
    context.issues.push(makeIssue(null, 'fields', 'studio.draft.fieldsRequired'));
  } else {
    candidate.fields = draft.fields.map((field, index) =>
      convertFieldDraft(field, `fields.${index}`, context),
    );
  }

  if (context.issues.length > 0) {
    return { schema: null, issues: context.issues };
  }

  // Son söz zod'un: taslak katmanı BİÇİMİ kurar, aralık/enum kısıtlarını
  // tek kaynak olan doğrulayıcı söyler. Aynı kuralı iki yerde yazmak,
  // ikisinin zamanla ayrışması demektir.
  const parsed = parseProtocolSchema(candidate);
  if (parsed.success) {
    return { schema: parsed.schema, issues: [] };
  }
  return {
    schema: null,
    issues: parsed.issues.map((issue) =>
      makeIssue(draftIdForSchemaPath(draft, issue.path), issue.path, 'studio.draft.schemaRejected', {
        path: issue.path,
        // Ham zod metni yalnız YARDIMCI ayrıntıdır; cümleyi sözlük kurar.
        detail: issue.message,
      }),
    ),
  };
}

// --- Şema → taslak -------------------------------------------------------

function numberText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function repeatCountToDraft(value: ProtocolFieldSchema['repeatCount']): RepeatCountDraft {
  if (value === undefined) {
    return { mode: 'none', count: '', fromField: '' };
  }
  if (typeof value === 'number') {
    return { mode: 'fixed', count: String(value), fromField: '' };
  }
  return { mode: 'fromField', count: '', fromField: value.fromField };
}

function fieldSchemaToDraft(field: ProtocolFieldSchema): FieldDraft {
  return {
    draftId: nextIdentity('fd'),
    id: field.id,
    name: field.name,
    type: field.type,
    description: field.description ?? '',
    offset: numberText(field.offset),
    length: numberText(field.length),
    lengthFrom: field.lengthFrom ?? '',
    signed: field.signed ?? null,
    endianness: field.endianness ?? '',
    bitOrder: field.bitOrder ?? '',
    bitOffset: numberText(field.bitOffset),
    bitLength: numberText(field.bitLength),
    bitMask: numberText(field.bitMask),
    scale: numberText(field.scale),
    calibrationOffset: numberText(field.calibrationOffset),
    unit: field.unit ?? '',
    minimum: numberText(field.minimum),
    maximum: numberText(field.maximum),
    enumValues:
      field.enumValues === undefined
        ? []
        : Object.entries(field.enumValues).map(([key, label]) => createEnumEntryDraft(key, label)),
    algorithm: field.algorithm ?? '',
    coverage: {
      startField: field.coverage?.startField ?? '',
      endField: field.coverage?.endField ?? '',
    },
    condition: {
      field: field.condition?.field ?? '',
      equals: numberText(field.condition?.equals),
    },
    repeatCount: repeatCountToDraft(field.repeatCount),
    fields: field.fields === undefined ? [] : field.fields.map(fieldSchemaToDraft),
    defaultValue: field.defaultValue === undefined ? '' : String(field.defaultValue),
    defaultValueKind: typeof field.defaultValue === 'number' ? 'number' : 'text',
    color: numberText(field.color),
    documentation: field.documentation ?? '',
  };
}

/**
 * İçe aktarma yönü. Şemada olmayan her opsiyonel alan boş metne düşer; bu
 * yüzden `draftToSchema(schemaToDraft(x))` yeniden `x` üretir — boş metin
 * "anahtar yok" demektir.
 *
 * Tek kayıp: şemada AÇIKÇA boş verilmiş `startBytes: []` geri dönüşte
 * `undefined` olur. Boş dizi ile hiç olmaması çerçeveleme açısından aynı
 * anlama geldiğinden bu bilerek göze alındı.
 */
export function schemaToDraft(schema: ProtocolSchema): SchemaDraft {
  return {
    name: schema.name,
    version: schema.version,
    description: schema.description ?? '',
    framing: {
      type: schema.framing.type,
      startBytes: (schema.framing.startBytes ?? []).map((byte) => String(byte)),
      endBytes: (schema.framing.endBytes ?? []).map((byte) => String(byte)),
      maximumFrameLength: String(schema.framing.maximumFrameLength),
    },
    defaultEndianness: schema.defaultEndianness ?? '',
    fields: schema.fields.map(fieldSchemaToDraft),
  };
}

// --- Mutasyon yardımcıları ----------------------------------------------
//
// Hepsi YENİ nesne döner ve DEĞİŞMEYEN alt ağaçların kimliğini korur:
// React `memo` yalnız referans değiştiğinde yeniden çizsin diye. Bir işlem
// hedefini bulamazsa taslak OLDUĞU GİBİ döner (`===` ile aynı nesne), böylece
// çağıran gereksiz bir durum güncellemesi tetiklemez.

function findInList(fields: readonly FieldDraft[], draftId: string): FieldDraft | null {
  for (const field of fields) {
    if (field.draftId === draftId) {
      return field;
    }
    const nested = findInList(field.fields, draftId);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

export function findFieldDraft(draft: SchemaDraft, draftId: string): FieldDraft | null {
  return findInList(draft.fields, draftId);
}

type ListUpdater = (list: readonly FieldDraft[]) => FieldDraft[] | null;

/** `parentDraftId` alanının ÇOCUK listesini değiştirir. Bulunamazsa `null`. */
function replaceChildList(
  fields: readonly FieldDraft[],
  parentDraftId: string,
  updater: ListUpdater,
): FieldDraft[] | null {
  let changed = false;
  const next = fields.map((field) => {
    if (changed) {
      return field;
    }
    if (field.draftId === parentDraftId) {
      const updated = updater(field.fields);
      if (updated === null) {
        return field;
      }
      changed = true;
      return { ...field, fields: updated };
    }
    const nested = replaceChildList(field.fields, parentDraftId, updater);
    if (nested === null) {
      return field;
    }
    changed = true;
    return { ...field, fields: nested };
  });
  return changed ? next : null;
}

/** `draftId`'yi İÇEREN listeyi değiştirir (kökte de olabilir). */
function replaceOwningList(
  fields: readonly FieldDraft[],
  draftId: string,
  updater: (list: readonly FieldDraft[], index: number) => FieldDraft[] | null,
): FieldDraft[] | null {
  const index = fields.findIndex((field) => field.draftId === draftId);
  if (index >= 0) {
    return updater(fields, index);
  }
  let changed = false;
  const next = fields.map((field) => {
    if (changed) {
      return field;
    }
    const nested = replaceOwningList(field.fields, draftId, updater);
    if (nested === null) {
      return field;
    }
    changed = true;
    return { ...field, fields: nested };
  });
  return changed ? next : null;
}

function withRootFields(draft: SchemaDraft, fields: FieldDraft[] | null): SchemaDraft {
  return fields === null ? draft : { ...draft, fields };
}

export function addField(
  draft: SchemaDraft,
  parentDraftId: string | null,
  field: FieldDraft,
): SchemaDraft {
  const append: ListUpdater = (list) => [...list, field];
  if (parentDraftId === null) {
    return withRootFields(draft, append(draft.fields));
  }
  return withRootFields(draft, replaceChildList(draft.fields, parentDraftId, append));
}

export function removeField(draft: SchemaDraft, draftId: string): SchemaDraft {
  return withRootFields(
    draft,
    replaceOwningList(draft.fields, draftId, (list, index) => [
      ...list.slice(0, index),
      ...list.slice(index + 1),
    ]),
  );
}

export function updateField(
  draft: SchemaDraft,
  draftId: string,
  patch: Partial<FieldDraft>,
): SchemaDraft {
  return withRootFields(
    draft,
    replaceOwningList(draft.fields, draftId, (list, index) => {
      const current = list[index];
      if (current === undefined) {
        return null;
      }
      const next = [...list];
      // `draftId` yamalanamaz: kimlik değişirse seçim ve React `key`'i kopar.
      next[index] = { ...current, ...patch, draftId: current.draftId };
      return next;
    }),
  );
}

/**
 * Liste içi taşıma. `fromIndex` liste dışındaysa hiçbir şey yapılmaz;
 * `toIndex` ise listeye KIRPILIR — sürükle-bırak arayüzü sınırın bir tık
 * ötesini rapor edebilir ve bunun için işlemi düşürmek kullanıcıya "tutmadı"
 * gibi görünürdü.
 */
export function moveField(
  draft: SchemaDraft,
  parentDraftId: string | null,
  fromIndex: number,
  toIndex: number,
): SchemaDraft {
  const reorder: ListUpdater = (list) => {
    if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= list.length) {
      return null;
    }
    const target = Math.min(Math.max(Math.trunc(toIndex), 0), list.length - 1);
    if (target === fromIndex) {
      return null;
    }
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) {
      return null;
    }
    next.splice(target, 0, moved);
    return next;
  };
  if (parentDraftId === null) {
    return withRootFields(draft, reorder(draft.fields));
  }
  return withRootFields(draft, replaceChildList(draft.fields, parentDraftId, reorder));
}

function collectFieldIds(fields: readonly FieldDraft[], used: Set<string>): void {
  for (const field of fields) {
    used.add(field.id.trim());
    collectFieldIds(field.fields, used);
  }
}

function uniqueFieldId(base: string, used: Set<string>): string {
  const seed = base.trim() === '' ? 'field' : base.trim();
  let candidate = `${seed}Copy`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${seed}Copy${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Derin kopya. Sığ kopya yeterli DEĞİL: taslak mutable olduğundan kopyanın
 * `coverage`/`enumValues`/`fields` nesneleri paylaşılsaydı kopyayı düzenlemek
 * aslını da değiştirirdi.
 */
function cloneWithFreshIds(field: FieldDraft, used: Set<string>): FieldDraft {
  const id = uniqueFieldId(field.id, used);
  used.add(id);
  return {
    ...field,
    draftId: nextIdentity('fd'),
    id,
    coverage: { ...field.coverage },
    condition: { ...field.condition },
    repeatCount: { ...field.repeatCount },
    enumValues: field.enumValues.map((entry) => createEnumEntryDraft(entry.key, entry.label)),
    fields: field.fields.map((child) => cloneWithFreshIds(child, used)),
  };
}

/** Kopyayı aslının HEMEN ARDINA koyar — listenin sonuna atmak sırayı bozar. */
export function duplicateField(draft: SchemaDraft, draftId: string): SchemaDraft {
  const original = findFieldDraft(draft, draftId);
  if (original === null) {
    return draft;
  }
  const used = new Set<string>();
  collectFieldIds(draft.fields, used);
  const copy = cloneWithFreshIds(original, used);
  return withRootFields(
    draft,
    replaceOwningList(draft.fields, draftId, (list, index) => [
      ...list.slice(0, index + 1),
      copy,
      ...list.slice(index + 1),
    ]),
  );
}
