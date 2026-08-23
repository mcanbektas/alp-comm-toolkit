/**
 * CC-Link (klasik, CLPA) — RS-485 üstünde master/slave fabrika otomasyonu
 * veri yolu. ≤10 Mbit/s, ≤64 istasyon, ≤1200 m.
 *
 * Faz 10, dalga 13g. `classic-fieldbus` ailesinin ikinci kaydı.
 *
 * ── KAYNAK ARAŞTIRMASININ SONUCU: TELGRAF BİÇİMİ KAMUYA AÇIK DEĞİL ─────────
 * Bu dosyanın İLK adımı "yeterli halka açık wire-format kaynağı var mı"
 * sorusuydu (brief-faz10-dalga13.md, mimari bulgu 1) ve cevap HAYIR:
 *   • Wireshark'ta CC-Link dissector'ı YOK (`epan/dissectors/CMakeLists.txt`
 *     1826 dissector'ın hiçbiri CC-Link değil — bu oturumda tarandı).
 *   • CLPA'nın veri bağı spec'i (CC-Link protocol, IEC 61158 Type 18)
 *     ÜYELİK/ÜCRET arkasında; `docs/spec/ozet/03-endustriyel.md:89-93` de
 *     "exact telegram alanları CLPA spec paketinden (tahmin edilmez)" diyor.
 *   • Kamuya açık kaynaklar yalnız "HDLC tabanlı çerçeveleme" düzeyinde
 *     kalıyor (Keyence'ın alan ağı tanıtımı, Wikipedia) — SD/ED değerleri,
 *     adres alanı genişliği, FCS polinomu HİÇBİR YERDE yazmıyor.
 *   • Bulunan tek "CC-Link çerçevesi" iddiası (`erikwang2013/
 *     industrial-protocols-cclink`, PHP) UYDURMA: StationNo(1)+Flags(1)+
 *     Len(1)+Data+CRC-16/XMODEM diye bir yapı hiçbir CLPA belgesinde yok,
 *     "Flags" baytı tamamen icat. KULLANILMADI.
 * Tahmin edilmiş bir alan tablosu, ham bırakılmış bir bloktan ÇOK DAHA
 * KÖTÜDÜR — kullanıcı yanlış veriye güvenir ve sahada geç fark eder.
 *
 * ── BUNUN YERİNE ÇÖZÜLEN ŞEY: DÖNGÜSEL LINK CİHAZI GÖRÜNTÜSÜ ──────────────
 * CC-Link'in kullanıcıya görünen yüzü telgraf değil **link cihazı alanıdır**:
 * uzak giriş RX, uzak çıkış RY, uzak yazmaç RWr/RWw. Bir istasyonun bu
 * alanının BOYU ve yerleşimi KAMUYA AÇIK ve İKİ BAĞIMSIZ KAYNAKTA TEYİTLİDİR:
 *   P = **Pro-face (Schneider Electric) GP-Pro EX Device/PLC Connection
 *       Manual — CC-Link Intelligent Device Driver**. "Number of Connectable
 *       Units" formülleri 4×4'lük link nokta tablosunun TAMAMINI veriyor:
 *       RX/RY için `a×32 + a2×32 + a4×64 + a8×128 / b×64 + b2×96 + b4×192 +
 *       b8×384 / c×96 + c2×160 + c4×320 + c8×640 / d×128 + d2×224 + d4×448 +
 *       d8×896`, RWw/RWr için `a×4 + a2×8 + a4×16 + a8×32 / …` (a=1 istasyon
 *       işgal, b=2, c=3, d=4; alt indis = genişletilmiş çevrim çarpanı).
 *       https://www.pro-face.com/otasuke/files/manual/gpproex/v2_2/device/data/mitcclnk.pdf
 *   M = **Mitsubishi Electric EMU4-VA2 Energy Measuring Unit Programming
 *       Manual (CC-Link), LEN160603** — bağımsız bir cihaz belgesi; tablonun
 *       bir satırını doğrudan doğruluyor: "Number of occupied stations:
 *       1 station (Expanded cyclic setting: Octuplet)" → RX/RY 128 nokta,
 *       "Remote register (RWw, RWr) 32 points each". P'nin a8=128 / a8×32
 *       satırıyla BİREBİR.
 *       https://dl.mitsubishielectric.com/dl/fa/document/manual/ems/len160603/len160603.pdf
 *
 * ── GİRDİ SÖZLEŞMESİ — DİKKAT, TELGRAF DEĞİL ───────────────────────────────
 * Girdi, **tek bir slave istasyonun döngüsel veri görüntüsüdür**: önce bit
 * alanı (RX ya da RY), sonra yazmaç alanı (RWr ya da RWw). Bir CC-Link
 * analizöründen dışa aktarılan ya da master'ın tampon belleğinden okunan
 * biçim budur. RS-485 telgrafının kendisi (preamble, sınırlayıcılar, adres,
 * FCS) BU MOTORUN GİRDİSİ DEĞİLDİR ve yukarıdaki gerekçeyle çözülmez.
 *
 * ── decodeOptions: AÇILDI, ÜÇ KANAL — HEPSİ GERÇEKTEN ÇERÇEVE DIŞI ────────
 * 12f'nin kuralı: kanal yalnız çerçeveden GERÇEKTEN çıkarılamayan parametre
 * için açılır. Üçü de bu tanıma uyar; hiçbiri bayt dizisinin içinde YOKTUR:
 *  1. **Yön** — aynı baytlar master→slave yönünde RY+RWw, slave→master
 *     yönünde RX+RWr'dir. Görüntünün kendisi yönü söylemez.
 *  2. **İşgal edilen istasyon sayısı (1-4)** — ağ parametresinde ayarlanır.
 *  3. **Genişletilmiş çevrim ayarı (×1/×2/×4/×8)** — Ver.2 özelliği, yine ağ
 *     parametresinde. ×1 aynı zamanda Ver.1 uyumlu istasyonun ayarıdır.
 * Bu üçü olmadan görüntünün NEREDE bitip nerede başladığı bilinemez; tahmin
 * etmek uydurmak olurdu.
 *
 * ── BAYT SIRASI ────────────────────────────────────────────────────────────
 * Link cihazı alanı 16 bitlik kelimelerden oluşur ve Mitsubishi tampon
 * belleği LITTLE-ENDIAN'dır: RX0000 ilk baytın en düşük anlamlı bitidir,
 * RWr kelimesinin alt baytı önce gelir. İki kaynak: SLMP Reference Manual
 * (SH(NA)-080956ENG — "binary code, lower byte first") ve rt-labs `c-link`
 * CCIEFB yığınının `cl_rx_t`/`cl_rwr_t` yerleşimi. Yine de tek bir dışa
 * aktarma aracı kelimeleri ters sırada yazabileceği için bu varsayım
 * `WARN_WORD_ORDER_ASSUMPTION` ile SÖYLENİR.
 *
 * ── STATUS: 'partial' — GEREKÇE (iec-61850 GOOSE-only emsali) ─────────────
 * Kaydın vaadi "10 Mbit/s'e kadar 64 istasyonla uzak giriş/çıkış/yazmaç
 * alışverişi". Bu motor ALIŞVERİŞİN İÇERİĞİNİ (RX/RY/RWr/RWw) çözer ama
 * TELGRAFI çözmez, çünkü telgraf biçimi kamuya açık değildir. Bu bilinçli ve
 * kaynağı belgelenmiş bir kapsam kısıtıdır; rozet bu yüzden `ready` değil
 * `partial` ve katalog özeti neyin çözülüp neyin çözülmediğini AÇIKÇA yazar.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ────────────────────────────────────
 *  • **RS-485 telgrafı**: yukarıdaki gerekçe. Kaynak bulunursa ayrı iş.
 *  • **Transient (geçici) iletim**: kendi mesaj biçimi var, o da kapalı.
 *  • **Cihaz profili anlamı**: RX0 "hazır", RWw2 "ayar değeri" gibi anlamlar
 *     CSP+/cihaz kılavuzundan gelir, alandan değil — nokta ADLANDIRILIR ama
 *     ANLAMLANDIRILMAZ (`sercosIii.ts`in IDN sözlüğü kararının aynısı).
 *  • **Ağ genelindeki adres**: RX0000'ın master tampon belleğinde hangi
 *     adrese düştüğü istasyon atamasına bağlıdır; burada indeksler istasyonun
 *     KENDİ görüntüsüne görelidir.
 *  • **CC-Link/LT, CC-Link Safety, CC-Link IE**: ayrı kayıtlar/teller.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'cc-link';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CC-Link';

const OPTION_DIRECTION = 'direction';
const OPTION_OCCUPIED_STATIONS = 'occupiedStations';
const OPTION_EXTENDED_CYCLIC = 'extendedCyclic';

const DIRECTION_SLAVE_TO_MASTER = 'slave-to-master';
const DIRECTION_MASTER_TO_SLAVE = 'master-to-slave';

const CYCLIC_X1 = 'x1';
const CYCLIC_X2 = 'x2';
const CYCLIC_X4 = 'x4';
const CYCLIC_X8 = 'x8';

const MIN_OCCUPIED_STATIONS = 1;
const MAX_OCCUPIED_STATIONS = 4;

const BITS_PER_WORD = 16;
const BYTES_PER_WORD = 2;
const HEX_RADIX = 16;

/**
 * Bir alan (bit ya da yazmaç) için ayrıntılı satır ÜST SINIRI. En büyük
 * konfigürasyon (4 istasyon × ×8) 896 bit = 56 kelime ve 128 yazmaç üretir;
 * tablo 184 satıra çıkardı. Ötesi TEK PARÇA ham basılır ve uyarı verilir —
 * `sercosIii.ts`in `MAX_DETAILED_DEVICES` sınırının aynı deseni.
 */
const MAX_DETAILED_WORDS = 32;

/**
 * Link nokta tablosu (P'nin bağlanabilir birim formüllerinden birebir;
 * bir satırı M ile çapraz teyitli). Anahtar: işgal edilen istasyon sayısı,
 * sonra genişletilmiş çevrim çarpanı.
 */
interface LinkPoints {
  /** RX ya da RY nokta sayısı (bit). */
  readonly bitPoints: number;
  /** RWr ya da RWw yazmaç sayısı (16-bit kelime). */
  readonly wordPoints: number;
}

const LINK_POINT_TABLE: ReadonlyMap<number, ReadonlyMap<string, LinkPoints>> = new Map([
  [
    1,
    new Map([
      [CYCLIC_X1, { bitPoints: 32, wordPoints: 4 }],
      [CYCLIC_X2, { bitPoints: 32, wordPoints: 8 }],
      [CYCLIC_X4, { bitPoints: 64, wordPoints: 16 }],
      [CYCLIC_X8, { bitPoints: 128, wordPoints: 32 }],
    ]),
  ],
  [
    2,
    new Map([
      [CYCLIC_X1, { bitPoints: 64, wordPoints: 8 }],
      [CYCLIC_X2, { bitPoints: 96, wordPoints: 16 }],
      [CYCLIC_X4, { bitPoints: 192, wordPoints: 32 }],
      [CYCLIC_X8, { bitPoints: 384, wordPoints: 64 }],
    ]),
  ],
  [
    3,
    new Map([
      [CYCLIC_X1, { bitPoints: 96, wordPoints: 12 }],
      [CYCLIC_X2, { bitPoints: 160, wordPoints: 24 }],
      [CYCLIC_X4, { bitPoints: 320, wordPoints: 48 }],
      [CYCLIC_X8, { bitPoints: 640, wordPoints: 96 }],
    ]),
  ],
  [
    4,
    new Map([
      [CYCLIC_X1, { bitPoints: 128, wordPoints: 16 }],
      [CYCLIC_X2, { bitPoints: 224, wordPoints: 32 }],
      [CYCLIC_X4, { bitPoints: 448, wordPoints: 64 }],
      [CYCLIC_X8, { bitPoints: 896, wordPoints: 128 }],
    ]),
  ],
]);

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_DIRECTION,
    label: 'protocol.ccLink.option.direction',
    kind: 'select',
    defaultValue: DIRECTION_SLAVE_TO_MASTER,
    description: 'protocol.ccLink.option.direction.description',
    choices: [
      { value: DIRECTION_SLAVE_TO_MASTER, label: 'protocol.ccLink.option.direction.slaveToMaster' },
      { value: DIRECTION_MASTER_TO_SLAVE, label: 'protocol.ccLink.option.direction.masterToSlave' },
    ],
  },
  {
    id: OPTION_OCCUPIED_STATIONS,
    label: 'protocol.ccLink.option.occupiedStations',
    kind: 'number',
    min: MIN_OCCUPIED_STATIONS,
    max: MAX_OCCUPIED_STATIONS,
    defaultValue: 1,
    description: 'protocol.ccLink.option.occupiedStations.description',
  },
  {
    id: OPTION_EXTENDED_CYCLIC,
    label: 'protocol.ccLink.option.extendedCyclic',
    kind: 'select',
    defaultValue: CYCLIC_X1,
    description: 'protocol.ccLink.option.extendedCyclic.description',
    choices: [
      { value: CYCLIC_X1, label: 'protocol.ccLink.option.extendedCyclic.x1' },
      { value: CYCLIC_X2, label: 'protocol.ccLink.option.extendedCyclic.x2' },
      { value: CYCLIC_X4, label: 'protocol.ccLink.option.extendedCyclic.x4' },
      { value: CYCLIC_X8, label: 'protocol.ccLink.option.extendedCyclic.x8' },
    ],
  },
];

export const ERROR_EMPTY_INPUT = 'protocol.ccLink.error.emptyInput';
export const ERROR_FRAME_TOO_LONG = 'protocol.ccLink.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.ccLink.error.aborted';
export const ERROR_IMAGE_TRUNCATED = 'protocol.ccLink.error.imageTruncated';

export const WARN_LINK_LAYER_NOT_PUBLIC = 'protocol.ccLink.warning.linkLayerNotPublic';
export const WARN_WORD_ORDER_ASSUMPTION = 'protocol.ccLink.warning.wordOrderAssumption';
export const WARN_POINT_MEANING_FROM_DEVICE_PROFILE =
  'protocol.ccLink.warning.pointMeaningFromDeviceProfile';
export const WARN_DETAIL_LIMIT = 'protocol.ccLink.warning.detailLimit';
export const WARN_TRAILING_BYTES = 'protocol.ccLink.warning.trailingBytes';
export const WARN_EXTENDED_CYCLIC_IS_VER2 = 'protocol.ccLink.warning.extendedCyclicIsVer2';

const SUMMARY_IMAGE = 'protocol.ccLink.summary.image';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Link cihazı kelimeleri LITTLE-ENDIAN'dır (dosya başı, bayt sırası). */
function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function formatHex(value: number, digits: number): string {
  return `${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }
}

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  if (init.offset !== undefined) error.offset = init.offset;
  if (init.length !== undefined) error.length = init.length;
  if (init.details !== undefined) error.details = init.details;
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

export type CcLinkFrameMetadata = {
  direction: 'slave-to-master' | 'master-to-slave';
  occupiedStations: number;
  extendedCyclic: string;
  bitPoints: number;
  wordPoints: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface CcLinkParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

/** Panelden gelen değerler METİNdir; sınır dışına çıkan varsayılana döner. */
function readDirection(options: Record<string, unknown> | undefined): string {
  return options?.[OPTION_DIRECTION] === DIRECTION_MASTER_TO_SLAVE
    ? DIRECTION_MASTER_TO_SLAVE
    : DIRECTION_SLAVE_TO_MASTER;
}

function readOccupiedStations(options: Record<string, unknown> | undefined): number {
  const raw = options?.[OPTION_OCCUPIED_STATIONS];
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) return MIN_OCCUPIED_STATIONS;
  const rounded = Math.round(value);
  if (rounded < MIN_OCCUPIED_STATIONS) return MIN_OCCUPIED_STATIONS;
  if (rounded > MAX_OCCUPIED_STATIONS) return MAX_OCCUPIED_STATIONS;
  return rounded;
}

function readExtendedCyclic(options: Record<string, unknown> | undefined): string {
  const raw = options?.[OPTION_EXTENDED_CYCLIC];
  if (raw === CYCLIC_X2 || raw === CYCLIC_X4 || raw === CYCLIC_X8) return raw;
  return CYCLIC_X1;
}

function lookupLinkPoints(occupiedStations: number, extendedCyclic: string): LinkPoints {
  const row = LINK_POINT_TABLE.get(occupiedStations);
  // Seçenekler zaten sınırlandığı için bu dallar ölü; yine de guard yazılır
  // (`noUncheckedIndexedAccess` disiplini, CLAUDE.md).
  const points = row?.get(extendedCyclic);
  return points ?? { bitPoints: 32, wordPoints: 4 };
}

/** `x4` → `×4`; etiket protokol verisidir, çeviriye girmez. */
function formatMultiplier(extendedCyclic: string): string {
  return `×${extendedCyclic.slice(1)}`;
}

interface AreaNames {
  readonly bitName: string;
  readonly wordName: string;
}

function areaNames(direction: string): AreaNames {
  return direction === DIRECTION_MASTER_TO_SLAVE
    ? { bitName: 'RY', wordName: 'RWw' }
    : { bitName: 'RX', wordName: 'RWr' };
}

/**
 * Bir 16 bitlik link cihazı kelimesi. Nokta indeksleri istasyonun KENDİ
 * görüntüsüne görelidir (ağ genelindeki adres istasyon atamasına bağlı,
 * dosya başı) ve Mitsubishi'nin onaltılık nokta numaralandırması kullanılır.
 */
function pushBitWord(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly prefix: string;
    readonly wordIndex: number;
    readonly offset: number;
    readonly pointsInWord: number;
    readonly warnings: readonly string[];
  },
): void {
  const value = readUint16Le(data, init.offset);
  const firstPoint = init.wordIndex * BITS_PER_WORD;
  const lastPoint = firstPoint + init.pointsInWord - 1;
  const on: string[] = [];
  for (let bit = 0; bit < init.pointsInWord; bit += 1) {
    if ((value & (1 << bit)) !== 0) {
      on.push(`${init.prefix}${formatHex(firstPoint + bit, 4)}`);
    }
  }
  fields.push({
    id: `${init.prefix.toLowerCase()}-word-${init.offset}`,
    name: `${init.prefix}${formatHex(lastPoint, 4)}-${init.prefix}${formatHex(firstPoint, 4)}`,
    offset: init.offset,
    length: BYTES_PER_WORD,
    rawBytes: data.slice(init.offset, init.offset + BYTES_PER_WORD),
    rawValue: value,
    // Kapalı kelimeyi "—" ile basmak, boş hücreden daha okunur.
    physicalValue: on.length === 0 ? '—' : on.join(' · '),
    valid: true,
    warnings: [...init.warnings],
  });
}

function pushRegister(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly prefix: string;
    readonly registerIndex: number;
    readonly offset: number;
    readonly warnings: readonly string[];
  },
): void {
  const value = readUint16Le(data, init.offset);
  fields.push({
    id: `${init.prefix.toLowerCase()}-${init.registerIndex}`,
    name: `${init.prefix}${formatHex(init.registerIndex, 1)}`,
    offset: init.offset,
    length: BYTES_PER_WORD,
    rawBytes: data.slice(init.offset, init.offset + BYTES_PER_WORD),
    rawValue: value,
    physicalValue: `0x${formatHex(value, 4)}`,
    valid: true,
    warnings: [...init.warnings],
  });
}

function pushRawBlock(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly length: number;
    readonly warnings: readonly string[];
  },
): void {
  if (init.length <= 0) return;
  fields.push({
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    unit: 'B',
    valid: true,
    warnings: [...init.warnings],
  });
}

function parseCcLinkImage(data: Uint8Array, options: CcLinkParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_ABORTED, recoverable: false });
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return fail({
      code: 'frame-too-long',
      message: ERROR_FRAME_TOO_LONG,
      recoverable: false,
      offset: options.maxFrameLength,
      length: data.length - options.maxFrameLength,
      details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
    });
  }

  if (data.length === 0) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_EMPTY_INPUT,
      recoverable: true,
      offset: 0,
      length: 0,
    });
  }

  const direction = readDirection(options.options);
  const occupiedStations = readOccupiedStations(options.options);
  const extendedCyclic = readExtendedCyclic(options.options);
  const points = lookupLinkPoints(occupiedStations, extendedCyclic);
  const names = areaNames(direction);

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];

  // Bu üç uyarı HER çözümde basılır: kullanıcı neyi görmediğini bilmelidir.
  warnings.push(WARN_LINK_LAYER_NOT_PUBLIC);
  warnings.push(WARN_WORD_ORDER_ASSUMPTION);
  warnings.push(WARN_POINT_MEANING_FROM_DEVICE_PROFILE);
  if (extendedCyclic !== CYCLIC_X1) warnings.push(WARN_EXTENDED_CYCLIC_IS_VER2);

  const bitWordCount = Math.ceil(points.bitPoints / BITS_PER_WORD);
  const bitAreaBytes = bitWordCount * BYTES_PER_WORD;
  const wordAreaBytes = points.wordPoints * BYTES_PER_WORD;
  const expectedBytes = bitAreaBytes + wordAreaBytes;

  if (data.length < expectedBytes) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_IMAGE_TRUNCATED,
      offset: data.length,
      length: expectedBytes - data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: expectedBytes,
        bitPoints: points.bitPoints,
        wordPoints: points.wordPoints,
      },
    });
  }

  const detailWarnings: string[] = [];
  if (bitWordCount > MAX_DETAILED_WORDS || points.wordPoints > MAX_DETAILED_WORDS) {
    warnings.push(WARN_DETAIL_LIMIT);
    detailWarnings.push(WARN_DETAIL_LIMIT);
  }

  // ── Bit alanı (RX ya da RY) ──
  const detailedBitWords = Math.min(bitWordCount, MAX_DETAILED_WORDS);
  let cursor = 0;
  for (let index = 0; index < detailedBitWords; index += 1) {
    if (cursor + BYTES_PER_WORD > data.length) break;
    const remainingPoints = points.bitPoints - index * BITS_PER_WORD;
    pushBitWord(fields, data, {
      prefix: names.bitName,
      wordIndex: index,
      offset: cursor,
      pointsInWord: Math.min(BITS_PER_WORD, remainingPoints),
      warnings: [WARN_POINT_MEANING_FROM_DEVICE_PROFILE],
    });
    cursor += BYTES_PER_WORD;
  }
  if (bitWordCount > detailedBitWords) {
    const remainderBytes = Math.min(
      (bitWordCount - detailedBitWords) * BYTES_PER_WORD,
      Math.max(0, data.length - cursor),
    );
    pushRawBlock(fields, data, {
      id: `${names.bitName.toLowerCase()}-remainder-${cursor}`,
      name: `${names.bitName} (remaining points)`,
      offset: cursor,
      length: remainderBytes,
      warnings: detailWarnings,
    });
    cursor += remainderBytes;
  }

  // ── Yazmaç alanı (RWr ya da RWw) ──
  const registerStart = Math.min(bitAreaBytes, data.length);
  cursor = registerStart;
  const detailedRegisters = Math.min(points.wordPoints, MAX_DETAILED_WORDS);
  for (let index = 0; index < detailedRegisters; index += 1) {
    if (cursor + BYTES_PER_WORD > data.length) break;
    pushRegister(fields, data, {
      prefix: names.wordName,
      registerIndex: index,
      offset: cursor,
      warnings: [WARN_POINT_MEANING_FROM_DEVICE_PROFILE],
    });
    cursor += BYTES_PER_WORD;
  }
  if (points.wordPoints > detailedRegisters) {
    const remainderBytes = Math.min(
      (points.wordPoints - detailedRegisters) * BYTES_PER_WORD,
      Math.max(0, data.length - cursor),
    );
    pushRawBlock(fields, data, {
      id: `${names.wordName.toLowerCase()}-remainder-${cursor}`,
      name: `${names.wordName} (remaining registers)`,
      offset: cursor,
      length: remainderBytes,
      warnings: detailWarnings,
    });
    cursor += remainderBytes;
  }

  // ── Fazla baytlar: uydurulmuş bir alan yerine ham blok + uyarı ──
  if (data.length > expectedBytes) {
    warnings.push(WARN_TRAILING_BYTES);
    pushRawBlock(fields, data, {
      id: `trailing-${expectedBytes}`,
      name: 'Trailing Bytes',
      offset: expectedBytes,
      length: data.length - expectedBytes,
      warnings: [WARN_TRAILING_BYTES],
    });
  }

  const summaryParams: Record<string, string> = {
    area: `${names.bitName}/${names.wordName}`,
    stations: `${occupiedStations}`,
    multiplier: formatMultiplier(extendedCyclic),
    bitPoints: `${points.bitPoints}`,
    wordPoints: `${points.wordPoints}`,
  };

  const metadata: CcLinkFrameMetadata = {
    direction: direction === DIRECTION_MASTER_TO_SLAVE ? 'master-to-slave' : 'slave-to-master',
    occupiedStations,
    extendedCyclic,
    bitPoints: points.bitPoints,
    wordPoints: points.wordPoints,
    summaryKey: SUMMARY_IMAGE,
    summaryParams,
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings: warnings.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseCcLink(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseCcLinkImage(data, options === undefined ? {} : { options });
}

export const ccLinkParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Girdi bir link cihazı görüntüsüdür: sihirli bayt YOKTUR, dolayısıyla
   * içerikten tanınamaz. Yapılabilecek tek dürüst ön eleme, kelime hizası
   * ve asgari boy (Ver.1'in en küçük konfigürasyonu: 32 bit + 4 yazmaç).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length % BYTES_PER_WORD !== 0) return false;
    return data.length >= 4 + 8;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: CcLinkParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseCcLinkImage(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Hepsi VARSAYILAN seçeneklere (slave→master, 1 istasyon, ×1) göre boyutlanır:
// 32 bit RX (4 bayt) + 4 RWr yazmaç (8 bayt) = 12 bayt. Diğer konfigürasyonlar
// panelin seçenek formundan denenir — örnek listesi seçenek taşıyamaz.
// DEĞERLER SENTETİKtir; YAPI (nokta sayıları) iki kaynakta teyitlidir.

function word(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'remote-device-typical',
    name: 'protocol.ccLink.example.remoteDeviceTypical.name',
    // RX0000, RX0002 ve RX0011 açık; RWr0=25.0 (250), RWr1=0x1234.
    bytes: Uint8Array.from([
      ...word(0x0005),
      ...word(0x0002),
      ...word(250),
      ...word(0x1234),
      ...word(0x0000),
      ...word(0xffff),
    ]),
    description: 'protocol.ccLink.example.remoteDeviceTypical.description',
    expectedValid: true,
  },
  {
    id: 'remote-device-all-off',
    name: 'protocol.ccLink.example.remoteDeviceAllOff.name',
    bytes: Uint8Array.from(new Array<number>(12).fill(0x00)),
    description: 'protocol.ccLink.example.remoteDeviceAllOff.description',
    expectedValid: true,
  },
  {
    id: 'remote-device-all-on',
    name: 'protocol.ccLink.example.remoteDeviceAllOn.name',
    bytes: Uint8Array.from(new Array<number>(12).fill(0xff)),
    description: 'protocol.ccLink.example.remoteDeviceAllOn.description',
    expectedValid: true,
  },
  {
    id: 'image-truncated',
    name: 'protocol.ccLink.example.imageTruncated.name',
    // 8 bayt: varsayılan konfigürasyon 12 bayt bekler → kesik görüntü hatası.
    bytes: Uint8Array.from([...word(0x0001), ...word(0x0000), ...word(100), ...word(0x0abc)]),
    description: 'protocol.ccLink.example.imageTruncated.description',
    expectedValid: false,
  },
  {
    id: 'image-trailing-bytes',
    name: 'protocol.ccLink.example.imageTrailingBytes.name',
    // 16 bayt: 12'si beklenen görüntü, 4'ü fazla → uydurulmuş alan YOK, ham blok.
    bytes: Uint8Array.from([
      ...word(0x0100),
      ...word(0x0000),
      ...word(1),
      ...word(2),
      ...word(3),
      ...word(4),
      ...word(0xdead),
      ...word(0xbeef),
    ]),
    description: 'protocol.ccLink.example.imageTrailingBytes.description',
    expectedValid: true,
  },
];

export const ccLinkPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: ccLinkParser,
  documentation: {
    summary: 'protocol.ccLink.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'Pro-face (Schneider Electric) GP-Pro EX Device/PLC Connection Manual — CC-Link Intelligent Device Driver (link point table)',
        url: 'https://www.pro-face.com/otasuke/files/manual/gpproex/v2_2/device/data/mitcclnk.pdf',
      },
      {
        title:
          'Mitsubishi Electric EMU4-VA2 Energy Measuring Unit Programming Manual (CC-Link), LEN160603',
        url: 'https://dl.mitsubishielectric.com/dl/fa/document/manual/ems/len160603/len160603.pdf',
      },
      {
        title: 'CC-Link Partner Association — CC-Link network technology overview',
        url: 'https://www.cc-link.org/en/cclink/index.html',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
