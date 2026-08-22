/**
 * Microwire — parametrik komut/adres/veri çözümü. Faz 10, dalga 11 (#11).
 *
 * ── Bu dosya neden ötekilerden farklı ─────────────────────────────────────
 * Katalogdaki öteki 171 kaydın parser'ı baytlardan ÇERÇEVEYİ okur. Microwire'da
 * çerçevenin şekli baytların içinde YOKTUR: spec (`… Platformu.md:2383`)
 * "cihaz datasheet'indeki Clock edge / Command length / Address length / Word
 * organization bilgilerine göre transaction oluşturmalıdır" diyor. Aynı dört
 * bayt, 93xx46 x8 profiliyle "READ 0x2A" çıkar, x16 profiliyle bambaşka bir
 * şey. Tahmin etmek uydurmaktır.
 *
 * Bu yüzden dalga 11'de paylaşılan bir kanal açıldı: `ProtocolPlugin.
 * decodeOptions` (bkz. `protocol-core/types.ts`) çerçeveden çıkarılamayan
 * parametreleri VERİ olarak bildirir, `DecodePanel` ondan bir form basar,
 * değerler `ParseContext.options` üzerinden buraya iner. `ParseContext.options`
 * ilk günden tipte vardı ama hiçbir ekran doldurmuyordu; Microwire onu
 * kaçınılmaz kıldı. Aynı kanal PMBus'ın VOUT_MODE üssü ve quad-spi'ın dummy
 * cycle sayısı için de açık duruyor (o işler bu dalganın konusu değil).
 *
 * ── Profil mi, serbest sayılar mı ─────────────────────────────────────────
 * `profile` şıkkı bir preset seçerse ÜÇ SAYI ALANI YOK SAYILIR ve preset'in
 * değerleri kullanılır — bu sessiz bir davranış değil, çözümlenen alan
 * tablosunun ilk satırı yürürlükteki profili adıyla ve kaynağıyla basar.
 * `custom` seçilirse üç sayı doğrudan geçerlidir; 93xx66 gibi tablosu
 * doğrulanmamış aileler bu yoldan kullanılır (bkz. `timing/microwire.ts`
 * dosya başındaki "UYDURULMAYAN ŞEY" notu).
 *
 * ── Motor burada DEĞİL ────────────────────────────────────────────────────
 * Bit çözümü, komut kümesi ve clock-cycle formülü `protocol-core/timing/
 * microwire.ts`te; kaynak doğrulaması (Microchip DS20001749K + DS21794F, iki
 * bağımsız datasheet, sekiz clock sayısıyla çapraz sınanmış) orada yazılı. Bu
 * dosya yalnız katalog kaydını, seçenek bildirimini ve alan tablosunu kurar —
 * i2c.ts/smbus.ts ile aynı iş bölümü.
 *
 * ── KAPSAM DIŞI (gerekçeli) ───────────────────────────────────────────────
 * - **Çerçevede yön yok.** READ'de veri sözcüğünü SLAVE (DO hattı), WRITE'ta
 *   MASTER (DI hattı) sürer. `RawFrame.direction` tek alandır ve tüm çerçeveye
 *   uygulanır; iki hatlı bir yakalamayı modellemez. 1-Wire'ın READ ROM /
 *   MATCH ROM kararının birebir aynısı: decode açısından ikisi de aynı bit
 *   dizisidir, yön alan tablosunda ADIYLA yazılır (`Data (DO)` / `Data (DI)`).
 * - **Katalogun `tools` listesi** ("EEPROM Transaction View", "Timing Diagram")
 *   bu motorun karşılığı DEĞİL; karşılanan yalnız Command/Opcode/Address/Data
 *   Decoder ile Read/Write Transaction (onewire.ts'in aspirasyonel
 *   tools-listesi disiplini).
 */

import {
  MICROWIRE_CUSTOM_PROFILE_ID,
  MICROWIRE_PROFILE_PRESETS,
  decodeMicrowire,
  microwireClockCycles,
} from '@/protocol-core/timing/microwire';
import type { MicrowireCommand, MicrowireProfile } from '@/protocol-core/timing/microwire';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'microwire';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Microwire';

const HEX_RADIX = 16;
const BITS_PER_BYTE = 8;
const MIN_FRAME_LENGTH = 1;

const OPTION_PROFILE = 'profile';
const OPTION_OPCODE_BITS = 'opcodeBits';
const OPTION_ADDRESS_BITS = 'addressBits';
const OPTION_WORD_BITS = 'wordBits';

/** `custom` profilinde serbest sayıların kabul edildiği aralık. */
const OPCODE_BITS_MIN = 1;
const OPCODE_BITS_MAX = 8;
const ADDRESS_BITS_MIN = 1;
const ADDRESS_BITS_MAX = 16;
const WORD_BITS_MIN = 4;
const WORD_BITS_MAX = 32;

const DEFAULT_PRESET_ID = '93xx46-x16';

const ERROR_EMPTY_FRAME = 'protocol.microwire.error.emptyFrame';
const ERROR_NO_START_BIT = 'protocol.microwire.error.noStartBit';
const ERROR_TRUNCATED = 'protocol.microwire.error.truncated';

const WARNING_TRAILING_BITS = 'protocol.microwire.warning.trailingBits';
const WARNING_LEADING_IDLE = 'protocol.microwire.warning.leadingIdle';
const WARNING_ADDRESS_DONT_CARE = 'protocol.microwire.warning.addressDontCare';

/**
 * Panelin basacağı form. `profile` dışındaki üç alan YALNIZ `custom` seçiliyken
 * geçerlidir — bu bilgi alan açıklamasında yazılı, ayrıca çözüm tablosunun ilk
 * satırında yürürlükteki profil adıyla görünür.
 */
const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_PROFILE,
    label: 'protocol.microwire.option.profile',
    kind: 'select',
    defaultValue: DEFAULT_PRESET_ID,
    description: 'protocol.microwire.option.profile.description',
    choices: [
      ...MICROWIRE_PROFILE_PRESETS.map((preset) => ({
        value: preset.id,
        // Etiket cihaz ailesinin ADI — protokol verisi, çeviriye girmez.
        label: preset.label,
      })),
      { value: MICROWIRE_CUSTOM_PROFILE_ID, label: 'protocol.microwire.option.profile.custom' },
    ],
  },
  {
    id: OPTION_OPCODE_BITS,
    label: 'protocol.microwire.option.opcodeBits',
    kind: 'number',
    defaultValue: 2,
    min: OPCODE_BITS_MIN,
    max: OPCODE_BITS_MAX,
    description: 'protocol.microwire.option.customOnly',
  },
  {
    id: OPTION_ADDRESS_BITS,
    label: 'protocol.microwire.option.addressBits',
    kind: 'number',
    defaultValue: 6,
    min: ADDRESS_BITS_MIN,
    max: ADDRESS_BITS_MAX,
    description: 'protocol.microwire.option.customOnly',
  },
  {
    id: OPTION_WORD_BITS,
    label: 'protocol.microwire.option.wordBits',
    kind: 'number',
    defaultValue: 16,
    min: WORD_BITS_MIN,
    max: WORD_BITS_MAX,
    description: 'protocol.microwire.option.customOnly',
  },
];

function formatHex(value: number, bitLength: number): string {
  const digits = Math.max(1, Math.ceil(bitLength / 4));
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function formatBinary(value: number, bitLength: number): string {
  return `0b${value.toString(2).padStart(bitLength, '0')}`;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

interface ResolvedProfile {
  readonly profile: MicrowireProfile;
  /** Alan tablosunda basılan insan-okur ad — preset etiketi ya da serbest değerler. */
  readonly label: string;
  /** Preset'in kaynak belgesi; `custom`'da `undefined` (kaynak kullanıcının datasheet'i). */
  readonly source?: string;
}

/**
 * Seçenekleri yürürlükteki profile çevirir. Tanınmayan/eksik seçenek varsayılan
 * preset'e düşer — panel her tuş vuruşunda `parse` çağırıyor, yarım girdi
 * yüzünden çözümün tamamen kaybolması kullanıcıyı ekranda kör bırakırdı.
 */
function resolveProfile(options: Record<string, unknown> | undefined): ResolvedProfile {
  const requestedId = typeof options?.[OPTION_PROFILE] === 'string' ? options[OPTION_PROFILE] : DEFAULT_PRESET_ID;

  if (requestedId !== MICROWIRE_CUSTOM_PROFILE_ID) {
    const preset =
      MICROWIRE_PROFILE_PRESETS.find((candidate) => candidate.id === requestedId) ??
      MICROWIRE_PROFILE_PRESETS.find((candidate) => candidate.id === DEFAULT_PRESET_ID);
    if (preset !== undefined) {
      return { profile: preset, label: preset.label, source: preset.source };
    }
  }

  const opcodeBits = clampInteger(options?.[OPTION_OPCODE_BITS], OPCODE_BITS_MIN, OPCODE_BITS_MAX, 2);
  const addressBits = clampInteger(options?.[OPTION_ADDRESS_BITS], ADDRESS_BITS_MIN, ADDRESS_BITS_MAX, 6);
  const wordBits = clampInteger(options?.[OPTION_WORD_BITS], WORD_BITS_MIN, WORD_BITS_MAX, 16);

  return {
    profile: { opcodeBits, addressBits, wordBits },
    label: `Custom — opcode ${String(opcodeBits)} bit · address ${String(addressBits)} bit · word ${String(wordBits)} bit`,
  };
}

/**
 * Bit aralığını KAPSAYAN bayt aralığı. Çerçeve bit hizalı (25/18/27/20 clock),
 * `ParsedField.offset`/`length` ise bayt cinsinden — byte-viewer bölgeleri bayt
 * çizer. Alanın gerçek bit yeri `name` içinde açıkça yazılır ki kullanıcı
 * bayt kutusunun neden birden fazla alanı kapsadığını görebilsin.
 */
function byteSpan(bitOffset: number, bitLength: number): { offset: number; length: number } {
  const firstByte = Math.floor(bitOffset / BITS_PER_BYTE);
  const lastByte = Math.floor((bitOffset + bitLength - 1) / BITS_PER_BYTE);
  return { offset: firstByte, length: lastByte - firstByte + 1 };
}

const FIELD_NAMES: Record<'startBit' | 'opcode' | 'address' | 'data', string> = {
  startBit: 'Start Bit',
  opcode: 'Opcode',
  address: 'Address',
  data: 'Data',
};

interface MicrowireParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  options?: Record<string, unknown>;
}

interface MicrowireFrameMetadata extends Record<string, unknown> {
  readonly command: MicrowireCommand;
  readonly profileLabel: string;
  readonly clockCycles: number;
}

function parseMicrowireFrame(data: Uint8Array, parseOptions: MicrowireParseOptions): ParseResult {
  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_EMPTY_FRAME,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const resolved = resolveProfile(parseOptions.options);
  const outcome = decodeMicrowire(data, resolved.profile);

  if (!outcome.ok) {
    const failure = outcome.failure;
    return {
      success: false,
      error:
        failure.kind === 'no-start-bit'
          ? {
              code: 'start-delimiter-not-found',
              message: ERROR_NO_START_BIT,
              offset: 0,
              length: data.length,
            }
          : {
              code: 'truncated-frame',
              message: ERROR_TRUNCATED,
              offset: 0,
              length: data.length,
              details: {
                requiredBits: failure.requiredBits,
                availableBits: failure.availableBits,
                profile: resolved.label,
              },
            },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const decoded = outcome.result;
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];

  // İlk satır YÜRÜRLÜKTEKİ PROFİL: kullanıcı hangi sayılarla çözüldüğünü
  // tahmin etmek zorunda kalmasın. Preset seçiliyken üç sayı alanının yok
  // sayıldığı ancak burada görünür.
  fields.push({
    id: 'profile',
    name: 'Profile',
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    rawValue: resolved.label,
    ...(resolved.source === undefined ? {} : { physicalValue: resolved.source }),
    valid: true,
    warnings: [],
  });

  for (const field of decoded.fields) {
    const span = byteSpan(field.bitOffset, field.bitLength);
    const isDataField = field.id === 'data';
    const directionSuffix =
      isDataField && decoded.command === 'READ'
        ? ' (DO — slave sürer)'
        : isDataField
          ? ' (DI — master sürer)'
          : '';
    fields.push({
      id: field.id,
      name: `${FIELD_NAMES[field.id]}${directionSuffix} · bit ${String(field.bitOffset)}–${String(field.bitOffset + field.bitLength - 1)}`,
      offset: span.offset,
      length: span.length,
      rawBytes: data.slice(span.offset, span.offset + span.length),
      rawValue: formatBinary(field.value, field.bitLength),
      physicalValue:
        field.id === 'opcode'
          ? decoded.command
          : field.id === 'startBit'
            ? '1'
            : formatHex(field.value, field.bitLength),
      // `unit` YOK: panel birimi fiziksel değerin yanına basıyor ve "EWEN bit"
      // çıkıyordu. Bit olan alanın GENİŞLİĞİ, değeri değil — genişlik zaten
      // alan adında yazılı. (Tarayıcı turunda yakalandı; hiçbir birim test
      // hücrenin bileşik metnine bakmıyordu.)
      valid: true,
      warnings: [],
    });
  }

  const significantBits = resolved.profile.significantAddressBits ?? resolved.profile.addressBits;
  if (significantBits < resolved.profile.addressBits) {
    warnings.push({
      code: 'address-dont-care',
      message: WARNING_ADDRESS_DONT_CARE,
    });
  }

  if (decoded.leadingIdleBits > 0) {
    warnings.push({ code: 'leading-idle-bits', message: WARNING_LEADING_IDLE });
  }

  // Artan bitler beklenen durumdur (25 clock 4 bayta sığmaz) ama SESSİZ
  // geçilmez: fazlalık bir sonraki transaction'ın başı da olabilir.
  if (decoded.trailingBits > 0) {
    warnings.push({ code: 'trailing-bits', message: WARNING_TRAILING_BITS });
  }

  const metadata: MicrowireFrameMetadata = {
    command: decoded.command,
    profileLabel: resolved.label,
    clockCycles: microwireClockCycles(resolved.profile, decoded.command),
  };

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseMicrowire(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseMicrowireFrame(data, options === undefined ? {} : { options });
}

export const microwireParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Microwire'ın bayt seviyesinde ayırt edici imzası YOK (i2c/spi gibi) —
   * dahası şekli profile bağlı olduğu için ön eleme yapılamaz bile. Yalnız boş
   * olmadığına bakılır; auto-detection bu protokolü ayırt edemez, bu bilinen
   * ve kabul edilen sınırdır.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: MicrowireParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.options !== undefined) options.options = context.options;
    return parseMicrowireFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi VARSAYILAN profille (93xx46 x16, DS20001749K Tablo
 * 1-3) çözülür. Bit dizileri datasheet'in komut satırlarından elle kuruldu,
 * bayta tamamlanırken kalan bitler sıfırlandı (25 clock 4 bayta sığmaz).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-word',
    name: 'protocol.microwire.example.readWord.name',
    // SB=1, opcode=10 (READ), A5–A0=0x0A, D15–D0=0xBEEF → 25 bit, 4 bayta sıfır dolgu.
    // 1 10 001010 1011111011101111 → 1100 0101 0101 1111 0111 0111 1000 0000
    bytes: Uint8Array.from([0xc5, 0x5f, 0x77, 0x80]),
    description: 'protocol.microwire.example.readWord.description',
    expectedValid: true,
  },
  {
    id: 'write-word',
    name: 'protocol.microwire.example.writeWord.name',
    // SB=1, opcode=01 (WRITE), A5–A0=0x3F, D15–D0=0x1234.
    // 1 01 111111 0001001000110100 → 1011 1111 1000 1001 0001 1010 0000 0000
    bytes: Uint8Array.from([0xbf, 0x89, 0x1a, 0x00]),
    description: 'protocol.microwire.example.writeWord.description',
    expectedValid: true,
  },
  {
    id: 'erase',
    name: 'protocol.microwire.example.erase.name',
    // SB=1, opcode=11 (ERASE), A5–A0=0x05 → 9 bit.
    // 1 11 000101 → 1110 0010 1000 0000
    bytes: Uint8Array.from([0xe2, 0x80]),
    description: 'protocol.microwire.example.erase.description',
    expectedValid: true,
  },
  {
    id: 'ewen',
    name: 'protocol.microwire.example.ewen.name',
    // SB=1, opcode=00, adres üst iki biti 11 → EWEN. Alt dört bit don't-care.
    // 1 00 110000 → 1001 1000 0000 0000
    bytes: Uint8Array.from([0x98, 0x00]),
    description: 'protocol.microwire.example.ewen.description',
    expectedValid: true,
  },
];

export const microwirePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: microwireParser,
  decodeOptions: DECODE_OPTIONS,
  documentation: {
    summary: 'protocol.microwire.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
