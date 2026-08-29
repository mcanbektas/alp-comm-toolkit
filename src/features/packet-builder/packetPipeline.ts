/**
 * Packet Builder motoru — spec §10'un saf TypeScript çekirdeği. Burada React
 * yok; bileşen yalnız bu modülün döndürdüğünü gösterir (spec §6'nın zorunlu
 * mimari maddesi).
 *
 * ## Sıra neden kritik: önce kodla, SONRA istifle
 *
 * `encodeWithSchema` checksum/CRC'yi HAM çerçeve üzerinde hesaplar. Post
 * processing (byte/bit stuffing, COBS, SLIP) ise yalnız bir TAŞIMA katmanıdır:
 * karşı taraf çerçeveyi önce ters çevirir (destuff/decode), sonra checksum'u
 * doğrular. Checksum istiflenmiş baytlar üzerinden hesaplansaydı alıcı
 * doğrulayamazdı — istifleme ekleri her iki tarafta aynı olmak zorunda değil
 * (COBS blok kodları veri içeriğine bağlı, kaçış baytları kurala bağlı). Bu
 * yüzden `buildPacket` iki adımı asla birleştirmez ve `rawFrame`i sonuçta
 * ayrıca döndürür: kullanıcı checksum'un neyin üzerinde hesaplandığını
 * görebilmeli.
 *
 * ## Hangi post-processing neyi sarar
 *
 * - **byteStuffing / bitStuffing**: şemanın KENDİ start/end baytlarını benzersiz
 *   tutmak içindir; bu yüzden yalnız çerçevenin İÇİNE uygulanır, delimiter'lar
 *   dokunulmadan kalır. Delimiter da kaçışlansaydı çerçeve sınırı kaybolurdu.
 * - **COBS / SLIP**: kendi delimiter'ını taşıyan tam bir bağlantı katmanıdır;
 *   şema çerçevesinin TAMAMI onların yükü olur ve kendi sonlandırıcılarını
 *   eklerler.
 *
 * ## Güvenlik
 *
 * Rastgele değer üreteci DIŞARIDAN gelir (`random: () => number`) — hem test
 * deterministik olsun hem de "kullanıcı formülü" gibi bir dinamik kod yolu
 * açılmasın. Spec §41 `eval`i ve dinamik kod çalıştırmayı yasaklıyor; bu
 * modülde ifade yorumlayıcısı YOK, yalnız bildirimsel alan tanımları var.
 */

import { toPhysicalValue } from '../../protocol-core/buffers/physicalValue';
import { encodeWithSchema } from '../../protocol-core/encoding/schemaEncoder';
import type {
  EncodeFieldValue,
  EncodeIssue,
  EncodeIssueCode,
  EncodeResult,
  EncodeValues,
} from '../../protocol-core/encoding/schemaEncoder';
import { stuffBits } from '../../protocol-core/framing/bitStuffing';
import { encodeCobsFrame } from '../../protocol-core/framing/cobs';
import { escapeBytes } from '../../protocol-core/framing/escaping';
import type { EscapeRule } from '../../protocol-core/framing/escaping';
import { encodeSlip } from '../../protocol-core/framing/slip';
import { fieldTypeInfo, isCompositeField, isDerivedField } from '../../protocol-core/schemas/fieldTypes';
import type { FieldType } from '../../protocol-core/schemas/fieldTypes';
import type { ProtocolFieldSchema, ProtocolSchema } from '../../protocol-core/schemas/protocolSchema';

// --- Sabitler -------------------------------------------------------------

/** PPP / async-HDLC'nin kaçış baytı; şema kendi kuralını vermezse varsayılan. */
const DEFAULT_ESCAPE_BYTE = 0x7d;

/**
 * Kaçışlanan bayt escape'ten sonra bu maske ile XOR'lanır (PPP §4.2 üslubu).
 * İkame tablosu yerine maske seçildi: kullanıcı tanımlı bir bayt kümesi için
 * ikame tablosu kurmak, her bayt için ayrıca "yerine ne geçecek" sorusunu
 * sormayı gerektirirdi; XOR maskesi kendi kendine tersinirdir.
 */
const ESCAPE_XOR_MASK = 0x20;

/**
 * Sınırı bildirilmemiş ondalıklı alanlar için rastgeleleme aralığı. IEEE-754'ün
 * kendi aralığı (±3.4e38) bir formda anlamsız değerler üretir, üstelik float16
 * için 65504'ü aşınca Infinity'ye yuvarlanır. ±1000 üç float genişliğinde de
 * güvenli ve okunur.
 */
const DEFAULT_FLOAT_LIMIT = 1000;

/** `random()`in 53 bitlik çözünürlüğü — tamsayı seçiminde ölçek olarak kullanılır. */
const RANDOM_PRECISION_BITS = 53n;

/** 1'e en yakın, 1'den küçük çift duyarlıklı sayı. */
const MAX_UNIT = 0.9999999999999999;

const BITS_PER_BYTE = 8;

const EMPTY_BYTES = new Uint8Array(0);

const SAFE_INTEGER_LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

/** BCD basamak tabanı — bir bayt iki ondalık basamak taşır. */
const BCD_DIGITS_PER_BYTE = 2n;

// --- Dışa açılan tipler ---------------------------------------------------

/**
 * `'plugin'` DIŞINDAKİ dallar şemayı okur ve senkron çalışır; `'plugin'` ise
 * çerçeveyi bir plugin encoder'ına sarar (spec §7 `ProtocolEncoder`in `payload`
 * ailesi, bkz. `protocols/encoderCatalog.ts`).
 */
export type PostProcessing = 'none' | 'byteStuffing' | 'bitStuffing' | 'cobs' | 'slip' | 'plugin';

interface BuiltInPostProcessingOptions {
  readonly postProcessing: Exclude<PostProcessing, 'plugin'>;
  /** `byteStuffing` için kaçış baytı; verilmezse 0x7D. */
  readonly escapeByte?: number;
  /** Kaçışlanacak baytlar; verilmezse şemanın start/end baytları. */
  readonly escapedBytes?: readonly number[];
}

/**
 * Encoder FONKSİYON olarak alınır, `pluginId` olarak değil.
 *
 * Registry lazy (`protocols/index.ts`): kimlikten motora inmek `await`
 * gerektirir, oysa bu modül saf ve senkron — her tuş vuruşunda çağrılıyor.
 * Yüklemeyi çağıran katman yapar, buraya yüklenmiş fonksiyon iner. Aynı
 * gerekçe `random`da da geçerli (dosya başı "Güvenlik").
 */
interface PluginPostProcessingOptions {
  readonly postProcessing: 'plugin';
  readonly frameEncoder: (payload: Uint8Array) => Uint8Array;
}

/**
 * Ayrık birlik: `'plugin'` seçilip encoder'ın verilmediği durum TEMSİL
 * EDİLEMEZ. Çalışma zamanında "encoder yok" dalı yazmak, o dalın sessizce
 * çerçevelenmemiş bayt döndürmesi riskini açardı.
 */
export type PacketBuildOptions = BuiltInPostProcessingOptions | PluginPostProcessingOptions;

export interface PacketIssue {
  /** Sorunun bağlı olduğu alan yolu; çerçeve genelindeyse `null`. */
  readonly fieldId: string | null;
  readonly messageKey: string;
  readonly params?: Record<string, string>;
}

export interface PacketBuildResult {
  readonly ok: boolean;
  /** Post-processing UYGULANMADAN önceki çerçeve — checksum bunun üzerinde. */
  readonly rawFrame: Uint8Array | null;
  /** Kabloya çıkacak hâl; `postProcessing: 'none'` ise `rawFrame`in aynısı. */
  readonly framedBytes: Uint8Array | null;
  readonly issues: readonly PacketIssue[];
}

export interface BuilderFieldDescriptor {
  /** Şemadaki alan kimliği — dizi öğelerinde TEKRAR EDER, benzersiz olan `path`tir. */
  readonly id: string;
  /** `EncodeValues` anahtarı: `header.deviceAddress`, `items[0].v`. */
  readonly path: string;
  readonly name: string;
  readonly type: FieldType;
  /** Değeri hesaplanır (checksum/crc/uzunluk); form salt-okunur gösterir. */
  readonly derived: boolean;
  readonly enumValues: ReadonlyMap<string, string> | null;
  readonly unit: string | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly scale: number | null;
  readonly calibrationOffset: number | null;
}

// --- Çeviri anahtarları ---------------------------------------------------

/**
 * Kodlayıcının sorun kodları → çeviri anahtarı. Anahtar düz noktalı string
 * olmalı, bu yüzden kebab-case kodlar camelCase'e çevriliyor; şablonla anahtar
 * üretmek yerine tam literal taşıyan sabit tablo kuruldu.
 */
const ISSUE_MESSAGE_KEYS: Readonly<Record<EncodeIssueCode, string>> = {
  'missing-value': 'builder.issue.missingValue',
  'value-out-of-range': 'builder.issue.valueOutOfRange',
  'invalid-value': 'builder.issue.invalidValue',
  'unknown-enum-label': 'builder.issue.unknownEnumLabel',
  'length-mismatch': 'builder.issue.lengthMismatch',
  'exceeds-maximum-frame-length': 'builder.issue.exceedsMaximumFrameLength',
};

const ENCODE_FAILED_KEY = 'builder.error.encodeFailed';
const POST_PROCESSING_FAILED_KEY = 'builder.error.postProcessingFailed';
const BIT_PADDING_KEY = 'builder.warning.bitPadding';

// --- Şema gezinme ---------------------------------------------------------

interface WalkedField {
  readonly field: ProtocolFieldSchema;
  readonly path: string;
}

/**
 * Dizi alanının kaç kez tekrarlanacağı. `repeatCount` başka bir alandan
 * geliyorsa sayı ancak DEĞERLER bilindiğinde belli olur; şemadan üretilen form
 * iskeletini boş bırakmamak için tek öğe gösterilir.
 */
function arrayIterations(field: ProtocolFieldSchema): number {
  if (field.type !== 'array') {
    return 1;
  }
  const repeat = field.repeatCount;
  if (typeof repeat === 'number') {
    return Math.max(0, repeat);
  }
  return 1;
}

/**
 * Yaprak alanları `EncodeValues` anahtar biçimiyle AYNI yolla toplar
 * (`schemaEncoder.collectPieces` ile birebir): iç içe yapı `header.a`, dizi
 * öğesi `items[0].v`. İki taraf ayrışırsa form yazdığı değeri kodlayıcıya
 * geçiremez, bu yüzden biçim burada tek yerde tutulur.
 */
function walkLeafFields(
  fields: readonly ProtocolFieldSchema[],
  namespace: string,
  output: WalkedField[],
): void {
  for (const field of fields) {
    const path = namespace === '' ? field.id : `${namespace}.${field.id}`;

    if (isCompositeField(field.type)) {
      const iterations = arrayIterations(field);
      for (let index = 0; index < iterations; index += 1) {
        const elementNamespace = field.type === 'array' ? `${path}[${index}]` : path;
        walkLeafFields(field.fields ?? [], elementNamespace, output);
      }
      continue;
    }

    output.push({ field, path });
  }
}

function leafFieldsOf(schema: ProtocolSchema): readonly WalkedField[] {
  const output: WalkedField[] = [];
  walkLeafFields(schema.fields, '', output);
  return output;
}

/** Başka bir alanın uzunluğunu taşıyan alan kimlikleri. */
function collectLengthTargets(fields: readonly ProtocolFieldSchema[], targets: Set<string>): void {
  for (const field of fields) {
    if (field.lengthFrom !== undefined) {
      targets.add(field.lengthFrom);
    }
    if (field.fields !== undefined) {
      collectLengthTargets(field.fields, targets);
    }
  }
}

function lengthTargetsOf(schema: ProtocolSchema): ReadonlySet<string> {
  const targets = new Set<string>();
  collectLengthTargets(schema.fields, targets);
  return targets;
}

/**
 * Değeri kullanıcıdan DEĞİL, kodlayıcıdan gelen alanlar. Üç kaynak var ve üçü
 * de `encodeWithSchema` tarafından üzerine yazılır: checksum/crc tipleri,
 * anlamsal `length` tipi ve `lengthFrom` ile hedef gösterilmiş alanlar
 * (spec §9.6'daki `payloadLength` bunlardan sonuncusudur — tipi `uint8`dir ama
 * değeri hesaplanır).
 */
function isAutoComputed(field: ProtocolFieldSchema, lengthTargets: ReadonlySet<string>): boolean {
  return isDerivedField(field.type) || field.type === 'length' || lengthTargets.has(field.id);
}

// --- Bayt yardımcıları ----------------------------------------------------

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}

interface FrameSegments {
  readonly prefix: Uint8Array;
  readonly body: Uint8Array;
  readonly suffix: Uint8Array;
}

/** Çerçeveyi [start | gövde | end] diye ayırır — `encodeWithSchema`nın yerleşimiyle aynı. */
function splitFrame(schema: ProtocolSchema, frame: Uint8Array): FrameSegments {
  const prefixLength = schema.framing.startBytes?.length ?? 0;
  const suffixLength = schema.framing.type === 'startEnd' ? (schema.framing.endBytes?.length ?? 0) : 0;

  if (prefixLength + suffixLength > frame.length) {
    // Savunma: çerçeve delimiter'lardan kısaysa bölmek anlamsız olurdu.
    return { prefix: EMPTY_BYTES, body: frame, suffix: EMPTY_BYTES };
  }

  return {
    prefix: frame.subarray(0, prefixLength),
    body: frame.subarray(prefixLength, frame.length - suffixLength),
    suffix: frame.subarray(frame.length - suffixLength),
  };
}

function escapeRuleFor(schema: ProtocolSchema, options: BuiltInPostProcessingOptions): EscapeRule {
  const declared =
    options.escapedBytes ?? [
      ...(schema.framing.startBytes ?? []),
      ...(schema.framing.type === 'startEnd' ? (schema.framing.endBytes ?? []) : []),
    ];
  return {
    escapeByte: options.escapeByte ?? DEFAULT_ESCAPE_BYTE,
    specialBytes: new Set(declared),
    xorMask: ESCAPE_XOR_MASK,
  };
}

function applyPostProcessing(
  schema: ProtocolSchema,
  rawFrame: Uint8Array,
  options: PacketBuildOptions,
  issues: PacketIssue[],
): Uint8Array {
  switch (options.postProcessing) {
    case 'none':
      return rawFrame;

    case 'byteStuffing': {
      const segments = splitFrame(schema, rawFrame);
      const escaped = escapeBytes(segments.body, escapeRuleFor(schema, options));
      return concatBytes([segments.prefix, escaped, segments.suffix]);
    }

    case 'bitStuffing': {
      const segments = splitFrame(schema, rawFrame);
      const stream = stuffBits(segments.body);
      const remainder = stream.bitLength % BITS_PER_BYTE;
      if (remainder !== 0) {
        // İstiflenmiş akış bayt sınırında bitmiyor; `PacketBuildResult` yalnız
        // bayt taşıdığı için son bayt sıfırla dolduruldu. Sessizce yapmak,
        // kabloya çıkan bit sayısını kullanıcıdan gizlemek olurdu.
        issues.push({
          fieldId: null,
          messageKey: BIT_PADDING_KEY,
          params: { bits: String(BITS_PER_BYTE - remainder) },
        });
      }
      return concatBytes([segments.prefix, stream.bytes, segments.suffix]);
    }

    case 'cobs':
      return encodeCobsFrame(rawFrame);

    case 'slip':
      return encodeSlip(rawFrame);

    case 'plugin':
      // Zarf çerçevenin TAMAMINI sarar — COBS/SLIP dallarıyla aynı kural:
      // checksum ham çerçeve üzerinde hesaplandı, taşıma katmanı onun üstüne
      // biner. Encoder fırlatırsa `buildPacket` yakalar ve paket ÜRETİLMEZ.
      return options.frameEncoder(rawFrame);
  }
}

// --- buildPacket ----------------------------------------------------------

function toPacketIssue(issue: EncodeIssue): PacketIssue {
  return {
    // Kodlayıcı çerçeve genelindeki sorunlarda boş kimlik yazar; `null` bunu
    // "alana bağlı değil" diye açıkça söyler.
    fieldId: issue.fieldId === '' ? null : issue.fieldId,
    messageKey: ISSUE_MESSAGE_KEYS[issue.code],
    params: { detail: issue.message },
  };
}

function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Şema + değerlerden kabloya çıkacak paketi üretir.
 *
 * `ok` yalnız KODLAMA ya da post-processing çuvalladığında `false` olur.
 * `encodeWithSchema` `success: true` derken bile sorun listesi dolu olabilir
 * (`length-mismatch` engelleyici değildir, kodlayıcı değeri kırpar ya da
 * olduğu gibi yazar); bunlar uyarı olarak taşınır — paket üretildiği hâlde
 * "başarısız" demek, kullanıcıyı elindeki geçerli çerçeveden mahrum bırakırdı.
 */
export function buildPacket(
  schema: ProtocolSchema,
  values: EncodeValues,
  options: PacketBuildOptions,
): PacketBuildResult {
  let encoded: EncodeResult;
  try {
    encoded = encodeWithSchema(schema, values);
  } catch (cause) {
    // Kodlayıcı bazı yollarda FIRLATIR (ör. negatif değerle BCD); form her tuş
    // vuruşunda çağırdığı için istisna ekrana kaçmamalı, sorun listesine iner.
    return {
      ok: false,
      rawFrame: null,
      framedBytes: null,
      issues: [{ fieldId: null, messageKey: ENCODE_FAILED_KEY, params: { detail: describeError(cause) } }],
    };
  }

  const issues: PacketIssue[] = encoded.issues.map(toPacketIssue);

  if (!encoded.success) {
    return { ok: false, rawFrame: null, framedBytes: null, issues };
  }

  return finishFrame(schema, encoded.bytes, issues, options);
}

/**
 * Ham çerçeveye post-processing uygular ve sonucu paketler — üretim yolundan
 * BAĞIMSIZ olan kısım. İki üretici (şema ve plugin encoder) buraya iner;
 * kopyalanan bir `try/catch` iki yolun hata davranışını sessizce ayrıştırırdı.
 */
function finishFrame(
  schema: ProtocolSchema,
  rawFrame: Uint8Array,
  issues: readonly PacketIssue[],
  options: PacketBuildOptions,
): PacketBuildResult {
  const carried = [...issues];

  let framedBytes: Uint8Array;
  try {
    framedBytes = applyPostProcessing(schema, rawFrame, options, carried);
  } catch (cause) {
    return {
      ok: false,
      rawFrame,
      framedBytes: null,
      issues: [
        ...carried,
        { fieldId: null, messageKey: POST_PROCESSING_FAILED_KEY, params: { detail: describeError(cause) } },
      ],
    };
  }

  return { ok: true, rawFrame, framedBytes, issues: carried };
}

/**
 * Aynı boru hattı, ama çerçeveyi şema yerine bir PLUGIN ENCODER'ı üretir
 * (spec §7 `ProtocolEncoder`in `values` ailesi).
 *
 * `schema` yine gerekiyor ama yalnız post-processing yerleşimi için: bayt
 * doldurma çerçevenin start/end baytlarını dokunulmadan bırakmak zorunda ve
 * bunu ancak şemadan bilir. Çerçevenin İÇERİĞİNE burada şema karışmaz.
 *
 * Sorun listesi tek parçadır: `values` ailesindeki encoder'lar `EncodeIssue`
 * DÖNDÜRMEZ, başarısızlıkta FIRLATIRLAR (`asciiProtocol.ts:47`). Bu yüzden
 * hata tek bir çerçeve sorununa iner; alan bazlı ayrıntı üretmek, olmayan bir
 * bilgiyi uydurmak olurdu.
 */
export function buildPacketWithEncoder(
  schema: ProtocolSchema,
  encode: (values: EncodeValues) => Uint8Array,
  values: EncodeValues,
  options: PacketBuildOptions,
): PacketBuildResult {
  let rawFrame: Uint8Array;
  try {
    rawFrame = encode(values);
  } catch (cause) {
    return {
      ok: false,
      rawFrame: null,
      framedBytes: null,
      issues: [{ fieldId: null, messageKey: ENCODE_FAILED_KEY, params: { detail: describeError(cause) } }],
    };
  }

  return finishFrame(schema, rawFrame, [], options);
}

// --- describeBuilderFields ------------------------------------------------

function toEnumMap(field: ProtocolFieldSchema): ReadonlyMap<string, string> | null {
  if (field.enumValues === undefined) {
    return null;
  }
  return new Map(Object.entries(field.enumValues));
}

/**
 * Formun hangi girdileri göstereceğini belirler. Yalnız YAPRAK alanlar döner;
 * `structure`/`array` kapsayıcılarının kendi değeri yoktur, iç içe olma bilgisi
 * `path`te taşınır.
 *
 * Hesaplanan alanlar (checksum/crc/uzunluk) listeden ÇIKARILMAZ: spec §10 bu
 * alanların değerini de gösteriyor, yalnız düzenlenmesine izin vermiyor —
 * `derived: true` formun onları salt-okunur göstermesi içindir.
 */
export function describeBuilderFields(schema: ProtocolSchema): readonly BuilderFieldDescriptor[] {
  const lengthTargets = lengthTargetsOf(schema);

  return leafFieldsOf(schema).map(({ field, path }) => ({
    id: field.id,
    path,
    name: field.name,
    type: field.type,
    derived: isAutoComputed(field, lengthTargets),
    enumValues: toEnumMap(field),
    unit: field.unit ?? null,
    minimum: field.minimum ?? null,
    maximum: field.maximum ?? null,
    scale: field.scale ?? null,
    calibrationOffset: field.calibrationOffset ?? null,
  }));
}

// --- Sayısal aralık çözümü ------------------------------------------------

type NumericRange =
  | { readonly kind: 'integer'; readonly minimum: bigint; readonly maximum: bigint }
  | { readonly kind: 'float'; readonly minimum: number; readonly maximum: number };

function fieldWidthBytes(field: ProtocolFieldSchema): number {
  return field.length ?? fieldTypeInfo(field.type).byteLength ?? 1;
}

/** Tipin kendi ham sınırları — şemadaki `minimum`/`maximum` bunun üstüne biner. */
function rawIntegerBounds(field: ProtocolFieldSchema): { readonly min: bigint; readonly max: bigint } {
  const info = fieldTypeInfo(field.type);

  if (info.kind === 'bits') {
    const bits = BigInt(field.bitLength ?? 1);
    return { min: 0n, max: (1n << bits) - 1n };
  }

  if (field.type === 'bcd') {
    // BCD'de bir bayt iki ONDALIK basamak taşır: 2 baytlık alan 0..9999.
    // İkilik aralığı kullanmak, kodlanamayacak değer üretirdi.
    const digits = BigInt(fieldWidthBytes(field)) * BCD_DIGITS_PER_BYTE;
    return { min: 0n, max: 10n ** digits - 1n };
  }

  const bits = BigInt(fieldWidthBytes(field) * BITS_PER_BYTE);
  const signed = field.signed ?? info.signed ?? false;
  if (signed) {
    const half = 1n << (bits - 1n);
    return { min: -half, max: half - 1n };
  }
  return { min: 0n, max: (1n << bits) - 1n };
}

/**
 * Alanın DEĞER uzayındaki aralığı; sayısal olmayan alanlarda `null`.
 *
 * `scale`/`calibrationOffset` taşıyan tamsayı alanları ondalık sayılır: kullanıcı
 * ve `EncodeValues` FİZİKSEL değeri taşır (ham değeri kodlayıcı hesaplar), ve
 * fiziksel değer `0.1` ölçekle pekâlâ kesirli olur.
 *
 * `enum` ve `boolean` bilerek dışarıda: birinin aralığı etiket tablosu, diğerinin
 * iki durumu var; ikisi de "sayısal alan" muamelesi görürse form anlamsız
 * değerler üretir.
 */
function numericRangeOf(field: ProtocolFieldSchema): NumericRange | null {
  const info = fieldTypeInfo(field.type);
  const numeric =
    info.kind === 'integer' || info.kind === 'float' || info.kind === 'timestamp' || info.kind === 'bits';
  if (!numeric) {
    return null;
  }

  const declaredMinimum = Number.isFinite(field.minimum) ? field.minimum : undefined;
  const declaredMaximum = Number.isFinite(field.maximum) ? field.maximum : undefined;
  const scaled = field.scale !== undefined || field.calibrationOffset !== undefined;

  if (info.kind === 'float' || scaled) {
    let low: number;
    let high: number;
    if (info.kind === 'float') {
      low = -DEFAULT_FLOAT_LIMIT;
      high = DEFAULT_FLOAT_LIMIT;
    } else {
      const raw = rawIntegerBounds(field);
      const scale = field.scale ?? 1;
      const offset = field.calibrationOffset ?? 0;
      const first = toPhysicalValue(Number(raw.min), scale, offset);
      const second = toPhysicalValue(Number(raw.max), scale, offset);
      // Negatif `scale` sınırları ters çevirir.
      low = Math.min(first, second);
      high = Math.max(first, second);
    }
    const minimum = declaredMinimum ?? low;
    const maximum = declaredMaximum ?? high;
    return { kind: 'float', minimum: Math.min(minimum, maximum), maximum: Math.max(minimum, maximum) };
  }

  const raw = rawIntegerBounds(field);
  let minimum = raw.min;
  let maximum = raw.max;
  if (declaredMinimum !== undefined) {
    const declared = BigInt(Math.ceil(declaredMinimum));
    if (declared > minimum) {
      minimum = declared;
    }
  }
  if (declaredMaximum !== undefined) {
    const declared = BigInt(Math.floor(declaredMaximum));
    if (declared < maximum) {
      maximum = declared;
    }
  }
  if (minimum > maximum) {
    // Çelişik sınır bildirimi: tek bir noktaya çökertilir, aralık boş kalmaz.
    minimum = maximum;
  }
  return { kind: 'integer', minimum, maximum };
}

/**
 * Tamsayıyı `number` ya da `bigint` olarak paketler. 2^53 üstü değerler
 * `number`a çevrilirse sessizce yuvarlanır (spec §47: gerekli yerde BigInt).
 */
function packInteger(value: bigint): number | bigint {
  return value > SAFE_INTEGER_LIMIT || value < -SAFE_INTEGER_LIMIT ? value : Number(value);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), MAX_UNIT);
}

/** Değeri tamsayıya çevirir; çevrilemiyorsa `undefined`. */
function toBigIntValue(value: EncodeFieldValue | undefined): bigint | undefined {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? BigInt(Math.round(value)) : undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 1n : 0n;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^-?\d+$/.test(trimmed) ? BigInt(trimmed) : undefined;
  }
  return undefined;
}

function toNumberValue(value: EncodeFieldValue | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return value.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return undefined;
}

function clampBigInt(value: bigint, minimum: bigint, maximum: bigint): bigint {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

// --- nextSequenceValues ---------------------------------------------------

/**
 * `sequenceCounter` alanlarını sayaçla doldurur (spec §10 "Otomatik sequence
 * number artırma"). Sayaç alanın genişliğine göre SARMALANIR: uint8 bir alan
 * 256'da sıfırlanır, çünkü kodlayıcı aralığı aşan değeri hata sayardı ve peş
 * peşe paket gönderen kullanıcı 256. pakette duvara toslardı.
 *
 * Şemada `sequenceCounter` yoksa girdi nesnesi AYNEN döner — çağıran referans
 * eşitliğine bakarak gereksiz yeniden çizimden kaçınabilir.
 */
export function nextSequenceValues(
  schema: ProtocolSchema,
  values: EncodeValues,
  counter: number,
): EncodeValues {
  if (!Number.isFinite(counter)) {
    return values;
  }

  const updates: Record<string, EncodeFieldValue> = {};
  for (const { field, path } of leafFieldsOf(schema)) {
    if (field.type !== 'sequenceCounter') {
      continue;
    }
    const modulus = 1n << BigInt(fieldWidthBytes(field) * BITS_PER_BYTE);
    const raw = BigInt(Math.trunc(counter));
    // Negatif sayaç da sarmalanır: JS'in `%` işlemi işareti koruduğu için
    // iki adımlı normalleştirme şart.
    const wrapped = ((raw % modulus) + modulus) % modulus;
    updates[path] = packInteger(wrapped);
  }

  if (Object.keys(updates).length === 0) {
    return values;
  }
  return { ...values, ...updates };
}

// --- randomizeValues ------------------------------------------------------

function randomIntegerIn(minimum: bigint, maximum: bigint, random: () => number): bigint {
  const span = maximum - minimum + 1n;
  if (span <= 1n) {
    return minimum;
  }
  // `random()` 53 bit taşır; aralık daha genişse (uint64) tamsayı çarpımıyla
  // ölçeklenir — Number'a çevirip çarpmak üst bitleri yuvarlardı.
  const scale = 1n << RANDOM_PRECISION_BITS;
  const ticks = BigInt(Math.floor(clampUnit(random()) * Number(scale)));
  return clampBigInt(minimum + (ticks * span) / scale, minimum, maximum);
}

/**
 * Türetilmemiş sayısal alanlara aralık içinde rastgele değer yazar (spec §10
 * "Random değer üretimi"). Üreteç DIŞARIDAN gelir: test deterministik olsun ve
 * "kullanıcı formülü" gibi bir dinamik kod yolu açılmasın (spec §41).
 *
 * Hesaplanan alanlara (checksum/crc/uzunluk) dokunulmaz — kodlayıcı zaten
 * üzerine yazar, yazılsaydı kullanıcıya "rastgele checksum" yalanı söylenirdi.
 */
export function randomizeValues(
  schema: ProtocolSchema,
  values: EncodeValues,
  random: () => number,
): EncodeValues {
  const lengthTargets = lengthTargetsOf(schema);
  const updates: Record<string, EncodeFieldValue> = {};

  for (const { field, path } of leafFieldsOf(schema)) {
    if (isAutoComputed(field, lengthTargets)) {
      continue;
    }
    const range = numericRangeOf(field);
    if (range === null) {
      continue;
    }
    if (range.kind === 'integer') {
      updates[path] = packInteger(randomIntegerIn(range.minimum, range.maximum, random));
      continue;
    }
    const picked = range.minimum + clampUnit(random()) * (range.maximum - range.minimum);
    updates[path] = clampNumber(picked, range.minimum, range.maximum);
  }

  if (Object.keys(updates).length === 0) {
    return values;
  }
  return { ...values, ...updates };
}

// --- stepFieldValue -------------------------------------------------------

/**
 * Tek alanı `delta` kadar artırır/azaltır (spec §10 "Alan artırma / Alan
 * azaltma"), sınırlara KIRPAR. Kırpmak yerine sarmalamak da bir seçenekti;
 * artırma düğmesi kullanıcının niyetini "bir sonraki değer" diye taşır ve
 * azami değerde sıfıra düşmek sürpriz olurdu — sarmalama yalnız otomatik
 * sequence sayacına özgüdür.
 *
 * Bilinmeyen yol, hesaplanan alan ve sayısal olmayan alan girdiyi AYNEN
 * döndürür: form bu üçünde artırma düğmesini zaten göstermez, motor da sessizce
 * anlamsız bir değer yazmaz.
 */
export function stepFieldValue(
  schema: ProtocolSchema,
  values: EncodeValues,
  fieldPath: string,
  delta: number,
): EncodeValues {
  if (!Number.isFinite(delta)) {
    return values;
  }

  const target = leafFieldsOf(schema).find((leaf) => leaf.path === fieldPath);
  if (target === undefined) {
    return values;
  }
  if (isAutoComputed(target.field, lengthTargetsOf(schema))) {
    return values;
  }

  const range = numericRangeOf(target.field);
  if (range === null) {
    return values;
  }

  const current = values[fieldPath];

  if (range.kind === 'integer') {
    const base = toBigIntValue(current) ?? clampBigInt(0n, range.minimum, range.maximum);
    const next = clampBigInt(base + BigInt(Math.round(delta)), range.minimum, range.maximum);
    return { ...values, [fieldPath]: packInteger(next) };
  }

  const base = toNumberValue(current) ?? clampNumber(0, range.minimum, range.maximum);
  const next = clampNumber(base + delta, range.minimum, range.maximum);
  return { ...values, [fieldPath]: next };
}
