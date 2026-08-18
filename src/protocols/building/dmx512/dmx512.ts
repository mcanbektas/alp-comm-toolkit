/**
 * DMX512 (ANSI E1.11, ESTA — DMX512-A) — bir DMX universe çerçevesinin START
 * CODE + slot dizisi çözümü. `src/protocols/building/` dizinini AÇAN ilk
 * motor (brief-faz10-dalga6.md, 6a).
 *
 * ── GİRDİ: START CODE'TAN BAŞLAYAN BAYT DİZİSİ, BREAK/MAB BAYT DEĞİL ────────
 * (lin.ts dosya başı "NEDEN BREAK BİR BAYT DEĞİL" ile AYNI gerekçe.) Bir DMX
 * çerçevesinin fiziksel zaman çizelgesi BREAK → Mark After Break (MAB) →
 * START CODE → Slot 1..N → sıradaki BREAK'tir (bu depo
 * `docs/spec/…Platformu.md` satır 23668-23714). BREAK ve MAB, UART baytı
 * DEĞİLDİR — bit-genişliği ölçümüyle algılanan, baud hızının dışında fiziksel
 * hat olaylarıdır (CAN'in SOF/CRC-15/ACK'ini `canFrame.ts`nin, LIN Sync
 * Break'ini `lin.ts`nin modellememesiyle AYNI gerekçe). Hiçbir DMX alıcısı
 * BREAK/MAB'ı uygulamaya "bayt" olarak vermez. Bu yüzden modellenen bayt
 * dizisi START CODE'tan (bayt 0) başlar: `[Start Code, Slot 1, Slot 2, ...,
 * Slot N]`. Break/MAB süresi ve refresh rate ÖLÇÜMÜ ayrı bir sinyal/timing
 * analizidir (spec'in kendi ayrımı — "Toolkit pulse/serial capture varsa Break
 * Duration/MAB Duration/Frame Duration/Refresh Rate ölçmelidir" satır
 * 23698-23712), katalogda `timing` sekmesi planned kalır — bu motora hiç
 * girmez.
 *
 * ── KAYNAK UYARISI (Karar 2 — DMX ailesi KAMU, tek resmi kaynak yeter) ──────
 * ANSI E1.11 (DMX512-A) ESTA'nın kamuya AÇIK, ücretsiz TSP yayınıdır; bu
 * deponun kendi kopyası `docs/spec/…Platformu.md` satır 23608-23857'dedir
 * (Universe = Start Code + ≤512 slot; tam packette maksimum ~44 Hz; her slot
 * 8-bit, 0-255). Start Code 0x00 ("DMX Level Data" — standart lighting) spec
 * METNİNİN KENDİSİNDE adlandırılır (satır 23841-23847). "Alternate START
 * Code" değerleri spec metninde YALNIZ "ESTA public Alternate Start Code
 * database tutmaktadır" diye anılır (satır 23837) — sayısal liste VERMEZ. Bu
 * dosyadaki üç alternatif değer bu yüzden İKİNCİL kaynaktan alındı (Karar 2:
 * DMX ailesinde tek kaynak yeterli — resmi ESTA TSP PDF'i bu oturumda ağdan
 * indirildi ama metne dönüştürülemedi/okunamadı; onun yerine erişilen kamuya
 * açık ikincil sayfa kullanıldı, 2026-08-18 tarihinde doğrudan taranarak):
 *   • 0x17 — Text Packet
 *   • 0xCC — RDM (Remote Device Management, ANSI E1.20 ekosistemi)
 *   • 0xCF — System Information Packet
 * Kaynak: https://www.erg.abdn.ac.uk/users/gorry/eg3576/start-codes.html
 * (kendisi de PLASA/ESTA Control Protocols Working Group TSP'sini kaynak
 * gösteriyor). Bu dört değerin DIŞINDAKİ her start code HAM + uyarıyla
 * gösterilir — spec'in kendi verdiği/erişilebilen listeyle sınırlı kalınır,
 * uydurma yok.
 *
 * ── SLOT OFSETİ: KAYMA TUZAĞI ────────────────────────────────────────────────
 * Bayt 0 = Start Code; Slot 1 = bayt 1, Slot N = bayt N. UI'da "Slot 1" HER
 * ZAMAN ham tampondaki 2. bayttır — slot numarası ile bayt indeksi arasında
 * sabit +1'lik bir kayma vardır, karıştırılmaz.
 *
 * ── 512 SLOT TAVANI: HATA DEĞİL UYARI ────────────────────────────────────────
 * ANSI E1.11 universe'ı en çok 512 slotla sınırlar ama bunu aşan bir çerçeve
 * BOZUK sayılmaz — motor sınırı aşan çerçeveyi de sonuna kadar çözer, yalnız
 * `slotCountExceedsMaximum` uyarısı basar: telden okunan hiçbir bayt motorun
 * kendi kuralı yüzünden atılmaz.
 *
 * ── BÜYÜK SLOT LİSTESİ: ÖZET GÖSTERİM (100 bin satır kuralının ruhu) ────────
 * `DecodePanel`in alan tablosu SANALLAŞTIRILMAMIŞ (`frame.fields.map` doğrudan
 * `<tr>` basar, bkz. `DecodePanel.tsx` — `VirtualizedTable` başka bir
 * bileşen, decode alan tablosunda KULLANILMIYOR). 512 ayrı `ParsedField`
 * üretmek 512 ayrı DOM satırı demektir. Bu yüzden yalnız ilk
 * `SLOT_PREVIEW_COUNT` slot ayrı alan olur; kalanı TEK bir ham blok alanına
 * (`slot-data`) toplanır — Modbus PDU'nun `pushRegisterFields`/`pushRawBlock`
 * ikiliğiyle aynı ayrım ilkesi (küçük/word-oriented kümede tek tek alan,
 * büyük/homojen blokta tek ham alan). Modbus'ta register sayısı PDU sınırı
 * yüzünden asla ~123'ü aşmaz — DMX'te TAM universe (512 slot) alışılmış,
 * gündelik bir çerçevedir, bu yüzden özetleme burada gerçek bir zorunluluk,
 * Modbus'ta yalnız simetrik bir tasarım emsali.
 *
 * ── FIXTURE PERSONALITY / 16-BİT BİRLEŞTİRME YOK (mavlink `crcNeedsDialect` tonu) ──
 * Slot değeri HER ZAMAN ham 8-bit sayıdır (0-255); hangi slotun "Red", "Pan
 * Coarse" ya da "Strobe" olduğu bir fixture personality PROFİLİNE bağlıdır
 * (katalog `definitions: ['custom-schema']`, bu dalgada planned) — profilsiz
 * kanal anlamı UYDURULMAZ. Aynı gerekçeyle iki slotu `Coarse×256+Fine`
 * formülüyle birleştirme de bu motorda YAPILMAZ: hangi iki slotun bir 16-bit
 * çift olduğu yine profile bağlıdır, tek çerçeveden telden okunamaz.
 *
 * ── CHECKSUM YOK ─────────────────────────────────────────────────────────────
 * DMX512'de checksum/CRC alanı yoktur; `valid` YALNIZ yapısal kontrolden
 * (asgari uzunluk) gelir — doğrulama/PASS rozeti basılmaz.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'dmx512';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DMX512';

/** Yalnız Start Code baytı bile geçerli bir minimal çerçevedir (0 slot). */
const MIN_FRAME_LENGTH = 1;
const MAX_STANDARD_SLOTS = 512;
/**
 * `canParse`in ucuz ön eleme penceresi. DMX'in gerçek bir magic baytı YOK —
 * her start code (0x00-0xFF) geçerli olabilir (dosya başı kaynak uyarısı) —
 * bu yüzden tek kıstas uzunluktur. `parse` bunun ötesini HATA saymaz (dosya
 * başı "512 slot tavanı" notu); bu sabit yalnız auto-detection'ın ucuz
 * filtresini sınırlar.
 */
const CAN_PARSE_MAX_LENGTH = MIN_FRAME_LENGTH + MAX_STANDARD_SLOTS;
/** İlk bu kadar slot ayrı `ParsedField` olur; kalanı tek özet alana toplanır (dosya başı). */
const SLOT_PREVIEW_COUNT = 16;

const HEX_RADIX = 16;

/** Dar ad kümesi — dosya başı kaynak uyarısı, bu dördün dışına ÇIKILMAZ. */
const START_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'DMX Level Data (Standard Lighting)'],
  [0x17, 'Text Packet'],
  [0xcc, 'RDM (Remote Device Management)'],
  [0xcf, 'System Information Packet'],
]);

const ERROR_FRAME_TOO_SHORT = 'protocol.dmx512.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.dmx512.error.frameTooLong';
const ERROR_ABORTED = 'protocol.dmx512.error.aborted';

const WARN_UNRECOGNIZED_START_CODE = 'protocol.dmx512.warning.unrecognizedStartCode';
const WARN_SLOT_COUNT_EXCEEDS_MAXIMUM = 'protocol.dmx512.warning.slotCountExceedsMaximum';

const SUMMARY_FRAME = 'protocol.dmx512.summary.frame';

export type Dmx512FrameMetadata = {
  startCode: number;
  slotCount: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

interface Dmx512ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDmx512Frame(data: Uint8Array, options: Dmx512ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  // Yapısal hata yalnız yukarıdaki iki ParseFailure yolunda: checksum yok, bu
  // yüzden başarıyla kurulan her çerçeve `errors: []` ile `valid: true` döner
  // (dosya başı "Checksum yok" notu — "valid" yalnız yapısal kontrolden gelir).
  const errors: ProtocolError[] = [];

  // --- Start Code (bayt 0) ---
  const startCode = byteAt(data, 0);
  const startCodeName = START_CODE_NAMES.get(startCode);
  const startCodeField: ParsedField = {
    id: 'start-code',
    name: 'Start Code',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: startCode,
    valid: startCodeName !== undefined,
    warnings: [],
  };
  if (startCodeName !== undefined) {
    startCodeField.physicalValue = startCodeName;
  } else {
    startCodeField.warnings.push(WARN_UNRECOGNIZED_START_CODE);
    warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_START_CODE));
  }
  fields.push(startCodeField);

  // --- Slotlar (bayt 1..N) — dosya başı ofset tuzağı: slot K = bayt K ---
  const slotCount = data.length - MIN_FRAME_LENGTH;
  const slotCountExceedsMaximum = slotCount > MAX_STANDARD_SLOTS;
  if (slotCountExceedsMaximum) {
    warnings.push(toProtocolWarning(WARN_SLOT_COUNT_EXCEEDS_MAXIMUM));
  }

  const previewCount = Math.min(slotCount, SLOT_PREVIEW_COUNT);
  for (let index = 0; index < previewCount; index += 1) {
    const slotNumber = index + 1;
    const slotOffset = MIN_FRAME_LENGTH + index;
    fields.push({
      id: `slot-${String(slotNumber)}`,
      name: `Slot ${String(slotNumber)}`,
      offset: slotOffset,
      length: 1,
      rawBytes: data.slice(slotOffset, slotOffset + 1),
      rawValue: byteAt(data, slotOffset),
      valid: true,
      warnings: [],
    });
  }

  if (slotCount > previewCount) {
    // Kalan slotlar tek özet alanda toplanır (dosya başı "büyük slot listesi" notu).
    const remainderOffset = MIN_FRAME_LENGTH + previewCount;
    const remainderLength = slotCount - previewCount;
    const remainderField: ParsedField = {
      id: 'slot-data',
      name: `Slots ${String(previewCount + 1)}-${String(slotCount)}`,
      offset: remainderOffset,
      length: remainderLength,
      rawBytes: data.slice(remainderOffset, remainderOffset + remainderLength),
      unit: 'B',
      valid: true,
      warnings: [],
    };
    if (slotCountExceedsMaximum) {
      remainderField.warnings.push(WARN_SLOT_COUNT_EXCEEDS_MAXIMUM);
    }
    fields.push(remainderField);
  }

  const summaryParams: Record<string, string> = {
    startCode: startCodeName ?? formatHexByte(startCode),
    slotCount: String(slotCount),
  };

  const metadata: Dmx512FrameMetadata = {
    startCode,
    slotCount,
    summaryKey: SUMMARY_FRAME,
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
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseDmx512(data: Uint8Array): ParseResult {
  return parseDmx512Frame(data, {});
}

export const dmx512Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — yalnız uzunluk penceresi (dosya başı: DMX'in magic baytı
   * yok, her start code geçerli olabilir; auto-detection'da bu protokol
   * doğası gereği zayıf bir imza taşır).
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && data.length <= CAN_PARSE_MAX_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Dmx512ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseDmx512Frame(data, options);
  },
};

/** Yalnız 512 tavanını göstermek için ek slot sayısı — spec sınırının dışına 9 slot taşırır. */
const EXAMPLE_OVERSIZED_SLOT_COUNT = MAX_STANDARD_SLOTS + 9;

/** 512 slotluk tam universe — deterministik dolgu (slot K değeri K mod 256); fixture verisi değil, yalnız gösterim amaçlı. */
function buildFullUniverseSlots(): number[] {
  const slots: number[] = [];
  for (let slotNumber = 1; slotNumber <= MAX_STANDARD_SLOTS; slotNumber += 1) {
    slots.push(slotNumber % 256);
  }
  return slots;
}

/** 512'yi aşan bir universe — yalnız `slotCountExceedsMaximum` uyarı yolunu göstermek için dolgu. */
function buildOversizedSlots(): number[] {
  const slots: number[] = [];
  for (let slotNumber = 1; slotNumber <= EXAMPLE_OVERSIZED_SLOT_COUNT; slotNumber += 1) {
    slots.push(0x01);
  }
  return slots;
}

/**
 * Örnek çerçeveler. RGB+Dimmer değerleri spec'in KENDİ örneğidir (dosya başı,
 * `docs/spec/…Platformu.md` satır 23726-23752: Red=255, Green=128, Blue=0,
 * Dimmer=200) — uydurulmadı. Geri kalan slot verileri (512'lik universe, aşım
 * örneği) yalnız gösterim amaçlı deterministik dolgudur; DMX'te checksum
 * olmadığı için LIN/DNP3'teki gibi "motordan bağımsız hesapla kanıtlama"
 * şartı yoktur (dosya başı, "Checksum yok" notu).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'standard-lighting-basic',
    name: 'protocol.dmx512.example.standardLightingBasic.name',
    // Start Code 0x00 + spec'in kendi RGB fixture örneği: Red/Green/Blue/Dimmer.
    bytes: Uint8Array.from([0x00, 0xff, 0x80, 0x00, 0xc8]),
    description: 'protocol.dmx512.example.standardLightingBasic.description',
    expectedValid: true,
  },
  {
    id: 'full-512-slot-universe',
    name: 'protocol.dmx512.example.full512SlotUniverse.name',
    bytes: Uint8Array.from([0x00, ...buildFullUniverseSlots()]),
    description: 'protocol.dmx512.example.full512SlotUniverse.description',
    expectedValid: true,
  },
  {
    id: 'oversized-slot-count',
    name: 'protocol.dmx512.example.oversizedSlotCount.name',
    bytes: Uint8Array.from([0x00, ...buildOversizedSlots()]),
    description: 'protocol.dmx512.example.oversizedSlotCount.description',
    expectedValid: true,
  },
  {
    id: 'unrecognized-start-code',
    name: 'protocol.dmx512.example.unrecognizedStartCode.name',
    bytes: Uint8Array.from([0x01, 0x10, 0x20, 0x30]),
    description: 'protocol.dmx512.example.unrecognizedStartCode.description',
    expectedValid: true,
  },
  {
    id: 'recognized-alternate-start-code',
    name: 'protocol.dmx512.example.recognizedAlternateStartCode.name',
    // 0xCC = RDM (dosya başı kaynak uyarısı) — start code alanının 0x00 dışında da adlandığını gösterir.
    bytes: Uint8Array.from([0xcc, 0x01, 0x02, 0x03]),
    description: 'protocol.dmx512.example.recognizedAlternateStartCode.description',
    expectedValid: true,
  },
  {
    id: 'minimal-start-code-only',
    name: 'protocol.dmx512.example.minimalStartCodeOnly.name',
    // Yalnız Start Code, hiç slot yok — geçerli minimal çerçeve (dosya başı).
    bytes: Uint8Array.from([0x00]),
    description: 'protocol.dmx512.example.minimalStartCodeOnly.description',
    expectedValid: true,
  },
];

export const dmx512Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: dmx512Parser,
  documentation: {
    summary: 'protocol.dmx512.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'ANSI E1.11 (DMX512-A), ESTA TSP — resmi yayın (kamu)',
        url: 'https://tsp.esta.org/tsp/documents/docs/ANSI-ESTA_E1-11_2008R2018.pdf',
      },
      {
        title: 'DMX512 Frame Start Codes — Alternate Start Code özeti (0x17/0xCC/0xCF)',
        url: 'https://www.erg.abdn.ac.uk/users/gorry/eg3576/start-codes.html',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
