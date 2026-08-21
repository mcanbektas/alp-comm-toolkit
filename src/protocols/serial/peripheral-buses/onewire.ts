/**
 * 1-Wire (Dallas/Maxim) — tek data hattı üzerinde ROM Command + 64-bit ROM ID
 * (Family Code + Serial Number + CRC-8/MAXIM) çözümü. Peripheral Buses
 * ailesinin İLK üyesi (brief-faz10-dalga11.md sıralama önerisi #1 — CRC hazır,
 * en düşük risk).
 *
 * ── KAYNAK DOĞRULAMASI (2026-08-22 taranarak, kod kopyalanmadı, yalnız
 * sabit/format referansı) ──────────────────────────────────────────────────
 * ROM komut baytları İKİ bağımsız kaynaktan çapraz teyitli:
 *   1. Microchip AN3320 "1.2 ROM Function Commands" (resmi yarı iletken app
 *      notu): READ ROM=33H, SKIP ROM=CCH, MATCH ROM=55H, SEARCH ROM=F0H,
 *      OVERDRIVE SKIP ROM=3CH, OVERDRIVE MATCH ROM=69H. Aynı kaynak ROM ID'yi
 *      "8-bit family code + 48-bit serial number + ilk 56 bitten hesaplanan
 *      8-bit CRC" olarak tanımlıyor (bu dosyadaki CRC_COVERAGE_LENGTH=7'nin
 *      dayanağı).
 *   2. esp-open-rtos `onewire.c` (SuperHouse, GitHub): `SELECT_ROM 0x55`,
 *      `SKIP_ROM 0xcc`, `SEARCH 0xf0` — Microchip tablosuyla bağımsızca örtüşüyor.
 * Spec özetinin "asgari" dediği 4 komuta (READ/MATCH/SKIP/SEARCH ROM) ek
 * olarak Overdrive çiftini de (yalnız Microchip'te doğrulandı, ikinci kaynak
 * bu ikisini içermiyor) ekliyoruz — spec'in "asgari" ifadesi zaten bir alt
 * küme olduğunu işaret ediyordu.
 *
 * ── BULGU: spec özetinin KENDİ örneği CRC'yi SAĞLAMIYOR ────────────────────
 * `01-fiziksel-arayuzler.md`teki `28 FF 64 1D 91 16 03 5C` örneği bağımsızca
 * hesaplandı: CRC8_MAXIM(28 FF 64 1D 91 16 03) = 0xC4, spec'in yazdığı 0x5C
 * DEĞİL (residue yöntemiyle ikinci kontrol: 8 baytın tamamı üzerinden hesap
 * 0x00 değil 0xD3 veriyor). Algoritmanın kendisi doğru — repo'nun kendi
 * `crcEngine.test.ts`teki doğrulanmış check-value'su (`"123456789"` → 0xA1)
 * bu motorla birebir üretildi. Yani spec'in ROM ID örneği GERÇEK bir cihaz
 * okuması değil, düzyazı illüstrasyonu — fixture olarak KULLANILMADI, kendi
 * baytlarımız aşağıda `computeNamedCrc` ile bağımsızca hesaplanarak inşa
 * edildi (bacnetmstp.ts'nin "hiç fixture yok, elle inşa edildi" disipliniyle
 * aynı).
 *
 * ── TUZAK: READ ROM'un ROM ID'si elektriksel olarak SLAVE'İN cevabıdır ─────
 * Gerçek 1-Wire hattında READ ROM (0x33) komutundan sonra 8 baytı MASTER
 * değil SLAVE gönderir (yön değişir); MATCH ROM'da (0x55) ise 8 baytı yine
 * MASTER yazar. Bu ayrım `RawFrame.direction`in işi (tek alan, tüm çerçeveye
 * uygulanır) — bu parser YAKALANMIŞ bayt dizisini çözer, elektriksel yön
 * değişimini modellemez. Bu yüzden READ ROM ve MATCH ROM (+ Overdrive Match)
 * decode açısından AYNI şekilde ele alınır: komut baytını 8 baytlık ROM ID
 * izler.
 *
 * ── KAPSAM DIŞI (gerekçeli) ─────────────────────────────────────────────────
 * - **Serial Number tek sayıya BİRLEŞTİRİLMEZ.** İç bayt sırası (endianness)
 *   ne spec özetinde ne de yukarıdaki iki kaynakta belirtiliyor — yalnız ham
 *   6 bayt gösterilir, `rawValue` uydurulmadı (RS-232'nin voltaj aralığını
 *   spec'in kasıtlı basitleştirmesiyle aynı disiplin).
 * - **Search ROM'un Bit/Complement/Branch/Discrepancy ağacı YOK.** Yalnız
 *   komut baytı tanınır; çok-cihaz keşif algoritması bit-seviyeli, çok-turlu
 *   bir state machine gerektirir — brief-faz10-dalga11.md sıralamasında bu
 *   dalgadan çok daha zor bir iş olarak ayrıca işaretli.
 * - **Function Command + Data (cihaza özel, ör. DS18B20 Convert T/Scratchpad)
 *   YOK.** `01-fiziksel-arayuzler.md` yalnız ROM-seviyesi komutları tarif
 *   ediyor, cihaz-özel komut kümesi spec'in kapsamı dışı.
 * - Katalogdaki `tools` listesi (Reset Pulse/Presence Pulse/Search ROM
 *   Tree/Device Tree/Scratchpad View/Read-Write Slot/Parasite Power
 *   Analyzer/Timing Analyzer) bu motorun KARŞILIĞI DEĞİL — yalnız "ROM
 *   Commands" + "64-bit ROM ID Decoder" karşılanıyor (COBS'un 10a'daki
 *   aspirasyonel tools-listesi emsaliyle aynı disiplin).
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'one-wire';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = '1-Wire';

const HEX_RADIX = 16;

const COMMAND_OFFSET = 0;
const FAMILY_CODE_OFFSET = 1;
const SERIAL_NUMBER_OFFSET = 2;
const SERIAL_NUMBER_LENGTH = 6;
const CRC_OFFSET = 8;
/** Family Code(1) + Serial Number(6) — CRC "ilk 56 bitten" hesaplanır (Microchip AN3320). */
const CRC_COVERAGE_LENGTH = 7;
/** Yalnız ROM Command baytı — Skip/Search/Overdrive Skip ROM'da çerçeve burada biter. */
const MIN_FRAME_LENGTH = 1;
/** Command(1) + Family(1) + Serial(6) + CRC(1) — Read/Match/Overdrive Match ROM. */
const ROM_ID_FRAME_LENGTH = 9;

const ROM_COMMAND_READ = 0x33;
const ROM_COMMAND_MATCH = 0x55;
const ROM_COMMAND_SKIP = 0xcc;
const ROM_COMMAND_SEARCH = 0xf0;
const ROM_COMMAND_OVERDRIVE_SKIP = 0x3c;
const ROM_COMMAND_OVERDRIVE_MATCH = 0x69;

/** Dosya başı kaynak doğrulaması — Microchip AN3320 + esp-open-rtos onewire.c. */
const ROM_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [ROM_COMMAND_READ, 'Read ROM'],
  [ROM_COMMAND_MATCH, 'Match ROM'],
  [ROM_COMMAND_SKIP, 'Skip ROM'],
  [ROM_COMMAND_SEARCH, 'Search ROM'],
  [ROM_COMMAND_OVERDRIVE_SKIP, 'Overdrive Skip ROM'],
  [ROM_COMMAND_OVERDRIVE_MATCH, 'Overdrive Match ROM'],
]);

/** Bu üç komuttan sonra 8 baytlık ROM ID izler (dosya başı READ ROM yön tuzağı notu). */
const ROM_ID_COMMANDS: ReadonlySet<number> = new Set([
  ROM_COMMAND_READ,
  ROM_COMMAND_MATCH,
  ROM_COMMAND_OVERDRIVE_MATCH,
]);

const ERROR_EMPTY_FRAME = 'protocol.oneWire.error.emptyFrame';
const ERROR_ROM_ID_TRUNCATED = 'protocol.oneWire.error.romIdTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.oneWire.error.frameTooLong';
const ERROR_ABORTED = 'protocol.oneWire.error.aborted';
const ERROR_CRC_MISMATCH = 'protocol.oneWire.error.crcMismatch';

const WARN_UNKNOWN_ROM_COMMAND = 'protocol.oneWire.warning.unknownRomCommand';

const SUMMARY_COMMAND_ONLY = 'protocol.oneWire.summary.commandOnly';
const SUMMARY_ROM_ID = 'protocol.oneWire.summary.romId';
const SUMMARY_UNKNOWN_COMMAND = 'protocol.oneWire.summary.unknownCommand';

function toProtocolWarning(key: string, offset?: number, length?: number): ProtocolWarning {
  const warning: ProtocolWarning = { code: key, message: key };
  if (offset !== undefined) warning.offset = offset;
  if (length !== undefined) warning.length = length;
  return warning;
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export type OneWireFrameMetadata = {
  command: number;
  commandLabel: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface OneWireParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseOneWireFrame(data: Uint8Array, options: OneWireParseOptions): ParseResult {
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
        message: ERROR_EMPTY_FRAME,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const command = byteAt(data, COMMAND_OFFSET);
  const commandLabel = ROM_COMMAND_NAMES.get(command);
  const expectsRomId = ROM_ID_COMMANDS.has(command);
  const totalRequired = expectsRomId ? ROM_ID_FRAME_LENGTH : MIN_FRAME_LENGTH;

  if (options.maxFrameLength !== undefined && totalRequired > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: totalRequired - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: totalRequired },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (expectsRomId && data.length < totalRequired) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_ROM_ID_TRUNCATED,
        offset: MIN_FRAME_LENGTH,
        length: ROM_ID_FRAME_LENGTH - MIN_FRAME_LENGTH,
        details: { availableBytes: data.length, requiredBytes: totalRequired },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  // Fazlası sonraki çerçeveye aittir: tampon değil, YALNIZ bu çerçeve dilimlenir (bacnetmstp.ts emsali).
  const frameBytes = data.slice(0, totalRequired);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const commandField: ParsedField = {
    id: 'romCommand',
    name: 'ROM Command',
    offset: COMMAND_OFFSET,
    length: 1,
    rawBytes: frameBytes.slice(COMMAND_OFFSET, COMMAND_OFFSET + 1),
    rawValue: command,
    valid: commandLabel !== undefined,
    warnings: [],
  };
  if (commandLabel !== undefined) {
    commandField.physicalValue = commandLabel;
  } else {
    commandField.warnings.push(WARN_UNKNOWN_ROM_COMMAND);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_ROM_COMMAND, COMMAND_OFFSET, 1));
  }
  fields.push(commandField);

  let summaryKey: string;
  const summaryParams: Record<string, string> = {};
  const commandParam = commandLabel ?? formatHexByte(command);

  if (expectsRomId) {
    const familyCode = byteAt(frameBytes, FAMILY_CODE_OFFSET);
    fields.push({
      id: 'familyCode',
      name: 'Family Code',
      offset: FAMILY_CODE_OFFSET,
      length: 1,
      rawBytes: frameBytes.slice(FAMILY_CODE_OFFSET, FAMILY_CODE_OFFSET + 1),
      rawValue: familyCode,
      physicalValue: formatHexByte(familyCode),
      valid: true,
      warnings: [],
    });

    // Serial Number BİLEREK tek sayıya birleştirilmez — dosya başı endianness tuzağı notu.
    fields.push({
      id: 'serialNumber',
      name: 'Serial Number',
      offset: SERIAL_NUMBER_OFFSET,
      length: SERIAL_NUMBER_LENGTH,
      rawBytes: frameBytes.slice(SERIAL_NUMBER_OFFSET, SERIAL_NUMBER_OFFSET + SERIAL_NUMBER_LENGTH),
      valid: true,
      warnings: [],
    });

    const receivedCrc = byteAt(frameBytes, CRC_OFFSET);
    const calculatedCrc = Number(
      computeNamedCrc(
        frameBytes.slice(FAMILY_CODE_OFFSET, FAMILY_CODE_OFFSET + CRC_COVERAGE_LENGTH),
        'CRC8_MAXIM',
      ),
    );
    const crcValid = receivedCrc === calculatedCrc;
    fields.push({
      id: 'crc',
      name: 'CRC',
      offset: CRC_OFFSET,
      length: 1,
      rawBytes: frameBytes.slice(CRC_OFFSET, CRC_OFFSET + 1),
      rawValue: receivedCrc,
      physicalValue: formatHexByte(calculatedCrc),
      valid: crcValid,
      warnings: [],
    });
    if (!crcValid) {
      // CRC yanlış olsa da yapısal çözüm (Family/Serial dahil) yine gösterilir — bacnetmstp.ts'nin
      // Header CRC emsali: alan valid:false + frame-level hata, ParseFailure DEĞİL.
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_CRC_MISMATCH,
        offset: CRC_OFFSET,
        length: 1,
        details: { received: receivedCrc, calculated: calculatedCrc },
      });
    }

    summaryKey = SUMMARY_ROM_ID;
    summaryParams['command'] = commandParam;
    summaryParams['family'] = formatHexByte(familyCode);
  } else if (commandLabel !== undefined) {
    summaryKey = SUMMARY_COMMAND_ONLY;
    summaryParams['command'] = commandParam;
  } else {
    summaryKey = SUMMARY_UNKNOWN_COMMAND;
    summaryParams['command'] = commandParam;
  }

  const metadata: OneWireFrameMetadata = { command, commandLabel, summaryKey, summaryParams };

  const rawFrame = createRawFrame(frameBytes, {
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

  return { success: true, frame, consumedBytes: totalRequired };
}

export function parseOneWire(data: Uint8Array): ParseResult {
  return parseOneWireFrame(data, {});
}

export const oneWireParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız komut baytı bilinen 6 kod kümesinde mi. Tam doğrulama (CRC) burada yapılmaz. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    return ROM_COMMAND_NAMES.has(byteAt(data, COMMAND_OFFSET));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: OneWireParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseOneWireFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — hepsi ELLE inşa edildi (spec'in kendi ROM ID örneği CRC'yi
 * sağlamıyor, dosya başı bulgu notu). Family Code 0x28 gerçek/doğrulanabilir
 * bir değer (DS18B20 ailesi, Microchip/Maxim dokümantasyonunda yaygın), Serial
 * Number baytları TEMSİLİDİR. CRC baytları `computeNamedCrc` ile hesaplandı,
 * `onewire.test.ts`te motordan BAĞIMSIZ ikinci bir hesapla kanıtlanır
 * (bacnetmstp.ts'nin UBX 3c emsali).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-rom',
    name: 'protocol.oneWire.example.readRom.name',
    // Read ROM + Family 0x28 (DS18B20) + temsili seri no + bağımsız hesaplanmış CRC.
    bytes: Uint8Array.from([0x33, 0x28, 0x00, 0x00, 0x01, 0x9a, 0xb3, 0x7f, 0x3d]),
    description: 'protocol.oneWire.example.readRom.description',
    expectedValid: true,
  },
  {
    id: 'match-rom',
    name: 'protocol.oneWire.example.matchRom.name',
    // Match ROM + farklı temsili seri no + bağımsız hesaplanmış CRC.
    bytes: Uint8Array.from([0x55, 0x28, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0x1e]),
    description: 'protocol.oneWire.example.matchRom.description',
    expectedValid: true,
  },
  {
    id: 'skip-rom',
    name: 'protocol.oneWire.example.skipRom.name',
    // Yalnız komut baytı — ROM ID hiç yok (broadcast addressing).
    bytes: Uint8Array.from([0xcc]),
    description: 'protocol.oneWire.example.skipRom.description',
    expectedValid: true,
  },
  {
    id: 'search-rom',
    name: 'protocol.oneWire.example.searchRom.name',
    // Komut tanınır ama asıl bit-seviyeli arama ağacı bu motorun KAPSAMI DIŞI (dosya başı not).
    bytes: Uint8Array.from([0xf0]),
    description: 'protocol.oneWire.example.searchRom.description',
    expectedValid: true,
  },
  {
    id: 'overdrive-skip-rom',
    name: 'protocol.oneWire.example.overdriveSkipRom.name',
    // Overdrive ailesinin ROM-ID'siz üyesi — yalnız Microchip AN3320'de doğrulandı.
    bytes: Uint8Array.from([0x3c]),
    description: 'protocol.oneWire.example.overdriveSkipRom.description',
    expectedValid: true,
  },
  {
    id: 'bad-crc',
    name: 'protocol.oneWire.example.badCrc.name',
    // "read-rom" ile AYNI gövde, yalnız CRC baytı bilerek bozuldu (0x3D → 0xC2) — hata yolu.
    bytes: Uint8Array.from([0x33, 0x28, 0x00, 0x00, 0x01, 0x9a, 0xb3, 0x7f, 0xc2]),
    description: 'protocol.oneWire.example.badCrc.description',
    expectedValid: false,
  },
  {
    id: 'unknown-command',
    name: 'protocol.oneWire.example.unknownCommand.name',
    // 0xAA altı bilinen ROM komutundan biri DEĞİL — yalnız uyarı yolu.
    bytes: Uint8Array.from([0xaa]),
    description: 'protocol.oneWire.example.unknownCommand.description',
    expectedValid: true,
  },
];

export const oneWirePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: oneWireParser,
  documentation: {
    summary: 'protocol.oneWire.documentation.summary',
    layer: 'physical',
    references: [
      {
        title: 'Microchip AN3320, "1.2 ROM Function Commands" (yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://onlinedocs.microchip.com/oxy/GUID-1618003F-992B-4E48-9411-5E5D5D952C06-en-US-3/GUID-3112FF8D-CB1D-4D36-BDEE-43348D1C9822.html',
      },
      {
        title: 'esp-open-rtos onewire.c (SuperHouse, GitHub — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/SuperHouse/esp-open-rtos/blob/master/extras/onewire/onewire.c',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
