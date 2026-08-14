/**
 * `ParsedField` → `ByteRegion` köprüsü. `types.ts`in söz verdiği tek yönlü
 * bağımlılık burada gerçekleşir: adaptör hem `protocol-core`u hem viewer'ı
 * tanır, viewer `protocol-core`u TANIMAZ. Sözleşmelerden biri değişirse yalnız
 * bu dosya kırılır.
 *
 * Değişmezler (testlerle çivilenmiştir):
 *
 * 1. **KAPSAYICI ÖNCE, YAPRAK SONRA.** `layout.ts` çakışan bölgelerde listede
 *    SONRA geleni kazandırır. Bu yüzden çıktı (ofset artan → uzunluk azalan →
 *    kimlik derinliği artan) sıralanır: kaba bir `payload` bölgesinin üstüne
 *    onu detaylandıran alt alanlar yazılır, tersi olsaydı üst alan alt alanları
 *    görünmez kılardı.
 * 2. **Geçersiz alan renk değil hata vurgusu alır.** `valid === false` →
 *    `invalid: true`; ByteViewer o bölgeyi `bg-danger-soft … decoration-wavy`
 *    ile çizer ve `colorIndex`i kullanmaz. Renk yine de atanır: renk ROOT
 *    kimliğine bağlıdır, geçerlilik ise çerçeveden çerçeveye değişir — geçersiz
 *    elemanı renk sırasından atlamak, aynı dizinin elemanlarını çerçeveye göre
 *    farklı renklere düşürürdü.
 * 3. **Renk yaprağa aittir.** Kapsayıcı bölgeler `colorIndex` almaz; onların
 *    görünen tek kısmı yaprakların örtmediği boşluktur ve viewer'ın otomatik
 *    sayacı orayı boyar. Yaprakların rengi kimliğin dizi indeksinden
 *    arındırılmış kökünden gelir: `items[0].v` ile `items[1].v` AYNI renktedir,
 *    yoksa tekrarlı yapı ekranda gökkuşağına döner.
 * 4. **Bit alanı bayt çözünürlüğüne yuvarlanır** (`ParsedField.offset/length`
 *    zaten bayt cinsindendir). Aynı baytı paylaşan iki bit alanı ekranda AYNI
 *    aralığı gösterir; ayırt edici tek şey addır, bu yüzden bit aralığı ada
 *    eklenir ("Ready [b4]"). Bit bilgisi `ParsedField`te yoktur (spec §7
 *    sözleşmesi kapalıdır), şemadan `collectSchemaBitRanges` ile toplanıp
 *    `options.bitRanges` ile verilir.
 * 5. **Uzunluğu 0 olan alan ÜRETİLMEZ.** `normalizeRegions` onu sessizce elerdi
 *    ama renk sayacı çoktan ilerlemiş olurdu; eleme burada, sayaçtan ÖNCE olur.
 */

import { SERIES_COLOR_COUNT } from './layout';
import type { ByteRegion, SeriesColorIndex } from './types';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type { ParsedField, ParsedFrame, ProtocolError } from '@/protocol-core/types';

/** Bir alanın bayt aralığı içindeki bit penceresi; `ParsedField` bunu taşımaz. */
export interface FieldBitRange {
  readonly bitOffset: number;
  readonly bitLength: number;
}

export interface ParsedFieldRegionOptions {
  /**
   * Renk döngüsünün başlangıç indeksi. Aynı ekranda iki çerçeve yan yana
   * çiziliyorsa ikincisine kaydırma vererek renklerin körü körüne tekrarı
   * kırılır. Tamsayı değilse ya da negatifse 0..3'e sarılır.
   */
  readonly colorSeed?: number;
  /** Bit alanı adlarına "[b4]" / "[b0..b3]" eki. Varsayılan `true`. */
  readonly showBitRange?: boolean;
  /**
   * Alan kimliği → bit penceresi. Anahtar hem TAM kimlik (`items[0].flags`) hem
   * de dizi indekslerinden arındırılmış kök (`items.flags`) olabilir; kök
   * anahtar dizinin bütün elemanlarını tek kayıtla karşılar.
   */
  readonly bitRanges?: ReadonlyMap<string, FieldBitRange>;
}

/**
 * `SeriesColorIndex` bir literal birleşimi olduğu için sayıdan tipe geçiş tek
 * yerde, bu tablodan yapılır — `as` ile daraltmak `SERIES_COLOR_COUNT`
 * değişince sessizce yanlış tip üretirdi.
 */
const COLOR_CYCLE: readonly SeriesColorIndex[] = [0, 1, 2, 3];

/** Kimlikteki dizi indeksleri: `items[12].v` → `items.v`. */
const ARRAY_INDEX_PATTERN = /\[\d+\]/g;

/** Ad uzayı ayırıcıları; kimlik derinliği bunların sayısından çıkar. */
const NAMESPACE_SEPARATORS = /[.[]/g;

function colorAt(counter: number): SeriesColorIndex {
  const slot = ((counter % SERIES_COLOR_COUNT) + SERIES_COLOR_COUNT) % SERIES_COLOR_COUNT;
  return COLOR_CYCLE[slot] ?? 0;
}

function normalizeSeed(colorSeed: number | undefined): number {
  if (colorSeed === undefined || !Number.isInteger(colorSeed)) return 0;
  return ((colorSeed % SERIES_COLOR_COUNT) + SERIES_COLOR_COUNT) % SERIES_COLOR_COUNT;
}

/** Dizi elemanlarını tek kökte toplar; renk ve bit araması bu kökle yapılır. */
export function toRootFieldId(id: string): string {
  return id.replace(ARRAY_INDEX_PATTERN, '');
}

/** `a.b[0].c` → 3. Aynı bayt aralığını paylaşan alanlarda kapsayanı sığ olandır. */
function idDepth(id: string): number {
  return 1 + (id.match(NAMESPACE_SEPARATORS)?.length ?? 0);
}

/** Çizilemeyecek geometri; `normalizeRegions` ile aynı ölçüt, ama renkten önce. */
function isDrawable(field: ParsedField): boolean {
  return (
    Number.isInteger(field.offset) &&
    field.offset >= 0 &&
    Number.isInteger(field.length) &&
    field.length > 0
  );
}

function toRegionName(
  field: ParsedField,
  bitRange: FieldBitRange | undefined,
  showBitRange: boolean,
): string {
  const base = field.name.trim() === '' ? field.id : field.name;
  if (!showBitRange || bitRange === undefined) return base;
  const first = bitRange.bitOffset;
  // Uzunluk 0 gelirse tek bit varsayılır; "b4..b3" gibi ters aralık yazmak
  // okuyanı yanıltır.
  const last = first + Math.max(bitRange.bitLength, 1) - 1;
  return first === last ? `${base} [b${first}]` : `${base} [b${first}..b${last}]`;
}

interface Candidate {
  readonly field: ParsedField;
  readonly start: number;
  readonly end: number;
  readonly depth: number;
  /** Giriş sırası — eşit anahtarlarda sıralamanın kararlılığına güvenilmez. */
  readonly order: number;
  /** Kendi aralığında başka bir alanı barındırıyor mu; kapsayıcıya renk verilmez. */
  hasChild: boolean;
}

/**
 * Kapsama ölçütü. Aralıklar eşitse KİMLİK DERİNLİĞİ karar verir: `header` ile
 * `header.flags` aynı baytları kaplayabilir, o zaman sığ olan kapsayıcıdır.
 * Aynı aralık + aynı derinlik (bir baytı paylaşan iki bit alanı) kapsama
 * DEĞİLDİR — ikisi de yapraktır, ikisi de renk alır.
 */
function contains(outer: Candidate, inner: Candidate): boolean {
  if (outer.start > inner.start || outer.end < inner.end) return false;
  if (outer.end - outer.start > inner.end - inner.start) return true;
  return outer.depth < inner.depth;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.start !== b.start) return a.start - b.start;
  if (a.end !== b.end) return b.end - a.end;
  if (a.depth !== b.depth) return a.depth - b.depth;
  return a.order - b.order;
}

/**
 * Kapsayıcıları işaretler. Sıralı liste üzerinde yığınla tek geçiş: yığında
 * yalnız hâlâ "açık" (bitişi imlecin ilerisinde) aralıklar durur, adayı
 * kapsayan EN İÇTEKİ aralık işaretlenir. Kardeş aralıklar kısmen örtüşürse
 * (bozuk şema) hiçbiri kapsayıcı sayılmaz — yanlış kapsama, bir yaprağı
 * renksiz bırakırdı.
 */
function markContainers(sorted: readonly Candidate[]): void {
  const open: Candidate[] = [];

  for (const candidate of sorted) {
    let top = open[open.length - 1];
    while (top !== undefined && top.end <= candidate.start) {
      open.pop();
      top = open[open.length - 1];
    }

    for (let index = open.length - 1; index >= 0; index -= 1) {
      const outer = open[index];
      if (outer !== undefined && contains(outer, candidate)) {
        outer.hasChild = true;
        break;
      }
    }

    open.push(candidate);
  }
}

/**
 * Düz `ParsedField` listesini çizilebilir bölgelere çevirir.
 *
 * Giriş sırası KORUNMAZ: çıktı kapsama sırasına dizilir (bkz. dosya başı, 1).
 */
export function parsedFieldsToRegions(
  fields: readonly ParsedField[],
  options: ParsedFieldRegionOptions = {},
): ByteRegion[] {
  const showBitRange = options.showBitRange ?? true;
  const bitRanges = options.bitRanges;

  const candidates: Candidate[] = [];
  let order = 0;
  for (const field of fields) {
    if (!isDrawable(field)) continue;
    candidates.push({
      field,
      start: field.offset,
      end: field.offset + field.length,
      depth: idDepth(field.id),
      order,
      hasChild: false,
    });
    order += 1;
  }

  const sorted = [...candidates].sort(compareCandidates);
  markContainers(sorted);

  // Renk sayacı bayt sırasında ilerler: ekranda soldan sağa okunan sıra,
  // giriş listesinin sırası değil.
  const colorByRoot = new Map<string, SeriesColorIndex>();
  let colorCounter = normalizeSeed(options.colorSeed);
  const regions: ByteRegion[] = [];

  for (const candidate of sorted) {
    const { field } = candidate;
    const rootId = toRootFieldId(field.id);
    const bitRange = bitRanges?.get(field.id) ?? bitRanges?.get(rootId);

    let colorIndex: SeriesColorIndex | undefined;
    if (!candidate.hasChild) {
      const existing = colorByRoot.get(rootId);
      if (existing === undefined) {
        colorIndex = colorAt(colorCounter);
        colorByRoot.set(rootId, colorIndex);
        colorCounter += 1;
      } else {
        colorIndex = existing;
      }
    }

    regions.push({
      id: field.id,
      name: toRegionName(field, bitRange, showBitRange),
      offset: candidate.start,
      length: candidate.end - candidate.start,
      ...(colorIndex === undefined ? {} : { colorIndex }),
      ...(field.valid ? {} : { invalid: true }),
    });
  }

  return regions;
}

/** Hata aralığı ile bölge kesişiyor mu; ofsetsiz hata bir alana bağlanamaz. */
function errorHitsRegion(error: ProtocolError, region: ByteRegion): boolean {
  if (error.offset === undefined || !Number.isInteger(error.offset)) return false;
  // Uzunluksuz hata tek bayt sayılır: "şu ofsette bir şey ters" bilgisi bile
  // kullanıcıyı doğru bölgeye götürür.
  const errorEnd = error.offset + Math.max(error.length ?? 1, 1);
  return region.offset < errorEnd && error.offset < region.offset + region.length;
}

/**
 * Çerçeve düzeyi hataları da işleyen sarmalayıcı. Alan `valid: true` görünse
 * bile onu kesen bir hata varsa bölge geçersiz işaretlenir: hata alanın
 * kendisinde değil, kapsamında ya da uzunluk tutarlılığında olabilir
 * (`length-mismatch`, `truncated-frame`) ve o durumda alanın kendi bayrağı
 * temizdir.
 */
export function parsedFrameToRegions(
  frame: ParsedFrame,
  options: ParsedFieldRegionOptions = {},
): ByteRegion[] {
  const regions = parsedFieldsToRegions(frame.fields, options);
  if (frame.errors.length === 0) return regions;

  return regions.map((region) => {
    if (region.invalid === true) return region;
    const hit = frame.errors.some((error) => errorHitsRegion(error, region));
    return hit ? { ...region, invalid: true } : region;
  });
}

function collectBitRangesInto(
  fields: readonly ProtocolFieldSchema[],
  namespace: string,
  into: Map<string, FieldBitRange>,
): void {
  for (const field of fields) {
    const qualifiedId = namespace === '' ? field.id : `${namespace}.${field.id}`;
    if (field.fields !== undefined && field.fields.length > 0) {
      // Dizi elemanları indekssiz toplanır: şema tek tanım verir, çerçeve N
      // eleman üretir ve hepsi aynı bit penceresini paylaşır.
      collectBitRangesInto(field.fields, qualifiedId, into);
      continue;
    }
    if (field.bitLength === undefined) continue;
    into.set(qualifiedId, { bitOffset: field.bitOffset ?? 0, bitLength: field.bitLength });
  }
}

/**
 * Şemadaki bit pencerelerini `options.bitRanges` için toplar. Anahtarlar dizi
 * indeksi TAŞIMAZ (`samples.flags`); adaptör tam kimliği bulamazsa köke düşer.
 */
export function collectSchemaBitRanges(schema: ProtocolSchema): Map<string, FieldBitRange> {
  const ranges = new Map<string, FieldBitRange>();
  collectBitRangesInto(schema.fields, '', ranges);
  return ranges;
}
