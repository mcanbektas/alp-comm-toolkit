/**
 * I²C — register transaction decode. Faz 10 dalga 11c (sıralama önerisi #3,
 * Peripheral Buses ailesinde 1-Wire/SPI'dan sonraki üye). Framing motoruna
 * (Faz 6) hiç uğramaz — SPI/1-Wire gibi kendi sabit-şekilli transaction'ı var.
 *
 * `timing/i2c.ts`teki `calculateI2cTransferTime`/`encodeI2c7BitAddress`/
 * `calculateI2cRiseTime` zaten yazılı ve `I2cTimingTool` (`calc.id
 * 'i2c-timing'`) üzerinden çalışıyor — bu dosya yalnız DECODE ekliyor, motor
 * TEKRAR YAZILMADI (katalog kaydına `calculatorIds` eklendi).
 *
 * ── Kapsam kararı: 4 transaction şekli, spec'in kendi örneklerine sadık ────
 * Spec özeti (`01-fiziksel-arayuzler.md:264-284`) START/STOP/ACK'i BİT-seviyeli
 * elektriksel sinyal olarak tarif eder (9. clock'ta receiver ACK/NACK verir);
 * bu toolkit yalnız YAKALANMIŞ bayt dizisini çözer (spi.ts'nin CS/dummy-cycle
 * disipliniyle aynı) — ACK/NACK ayrı bir alan/bayt olarak YOK, her adres/data
 * baytının ACK aldığı VARSAYILIR; NACK'in transaction sonunu işaretlemesi
 * (spec'in Read örneğindeki son NACK) decode'a yansımaz.
 *
 * Dört şekil, ilk baytın R/W bitine ve (varsa) üçüncü baytın adres+R/W
 * eşleşmesine bakılarak ayrılır:
 *   1. **Address-only** (1 bayt) — bus scan/probe (spec'in "0x1E ACK→
 *      Magnetometer?" örneği).
 *   2. **Write** (Address+W ile başlar, repeated-start YOK) — ikinci bayt
 *      "Register/Command" olarak yorumlanır (I2C'nin KENDİSİ register diye
 *      bir kavram tanımlamaz — EEPROM/sensör cihazlarında yaygın üst-katman
 *      konvansiyonu, spec'in kendi register-read örneği de bunu kullanıyor),
 *      kalanı Data.
 *   3. **Read** (Address+R ile DOĞRUDAN başlar, repeated-start yok) — register
 *      kavramı yok, ikinci bayttan itibaren hepsi Data (SMBus "Receive Byte"
 *      tarzı senaryoya benzer).
 *   4. **Register-read with repeated START** (spec'in ANA örneği,
 *      `01-fiziksel-arayuzler.md:274`: `S,D0,A,75,A,Sr,D1,A,71,N,P`) — 3. bayt
 *      1. bayıtla AYNI 7-bit adresi taşıyor VE R/W biti Read ise repeated
 *      START kabul edilir: Address+W, Register, Address+R (repeated), Data.
 * Yanlış pozitif riski (rastgele bir write transaction'ın 3. baytı tesadüfen
 * aynı adres+Read paternine uyması) kabul edilebilir düzeyde düşük — spi.ts'nin
 * "tek sabit konvansiyon seç, sapma varsa dokümante et" disipliniyle aynı karar.
 *
 * ── KAPSAM DIŞI (gerekçeli) ─────────────────────────────────────────────────
 * - **10-bit addressing** — spec kaynağında (`01-fiziksel-arayuzler.md`) HİÇ
 *   geçmiyor, yalnız 7-bit belgelenmiş.
 * - **ACK/NACK, Clock Stretching, Arbitration** — bit-seviyeli elektriksel
 *   sinyal/zamanlama; ne bu dosyada ne `timing/i2c.ts`te motoru var. Katalogun
 *   `tools` listesindeki "Clock Stretch Analyzer"/"Arbitration Analyzer"/
 *   "Bus Utilization" bu motorun karşılığı DEĞİL (onewire.ts'nin aspirasyonel
 *   tools-listesi disipliniyle aynı).
 * - **`'live'` tab** katalogdan ÇIKARILDI — `connection/` yalnız serial+mock
 *   destekliyor (`ByteSourceKind = 'web-serial' | 'simulated'`), I2C köprü
 *   cihazı bugün yok (kullanıcı onayı, brief-faz10-dalga11.md Açık Soru #2).
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'i2c';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'I²C';

const HEX_RADIX = 16;
const MIN_FRAME_LENGTH = 1;
const READ_WRITE_BIT = 0x01;
const ADDRESS_7BIT_SHIFT = 1;

const ERROR_EMPTY_FRAME = 'protocol.i2c.error.emptyFrame';
const ERROR_ABORTED = 'protocol.i2c.error.aborted';

const SUMMARY_PROBE = 'protocol.i2c.summary.probe';
const SUMMARY_WRITE = 'protocol.i2c.summary.write';
const SUMMARY_READ = 'protocol.i2c.summary.read';
const SUMMARY_REGISTER_READ = 'protocol.i2c.summary.registerRead';

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function address7Bit(addressByte: number): number {
  return addressByte >> ADDRESS_7BIT_SHIFT;
}

function isReadAddress(addressByte: number): boolean {
  return (addressByte & READ_WRITE_BIT) !== 0;
}

/** Spec'in "KESİNLİKLE 7-bit/8-bit ayrımını göster" isteği (`01-fiziksel-arayuzler.md:268`). */
function formatAddress(addressByte: number): string {
  const direction = isReadAddress(addressByte) ? 'Read' : 'Write';
  return `${direction} · 7-bit ${formatHexByte(address7Bit(addressByte))} (${formatHexByte(addressByte)})`;
}

/** Spec'in ana örneği (`01-fiziksel-arayuzler.md:274`): 3. bayt 1. bayıtla AYNI 7-bit adresi taşıyor + Read ise repeated START. */
function hasRepeatedStart(data: Uint8Array): boolean {
  if (data.length < 3) return false;
  const first = byteAt(data, 0);
  const third = byteAt(data, 2);
  return !isReadAddress(first) && isReadAddress(third) && address7Bit(first) === address7Bit(third);
}

export type I2cFrameMetadata = {
  address7bit: number;
  isRead: boolean;
  hasRepeatedStart: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface I2cParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseI2cFrame(data: Uint8Array, options: I2cParseOptions): ParseResult {
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

  const fields: ParsedField[] = [];
  const addressByte = byteAt(data, 0);
  const isRead = isReadAddress(addressByte);
  const repeatedStart = hasRepeatedStart(data);

  fields.push({
    id: 'address',
    name: 'Address',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: addressByte,
    physicalValue: formatAddress(addressByte),
    valid: true,
    warnings: [],
  });

  let summaryKey: string;
  const summaryParams: Record<string, string> = { address: formatHexByte(address7Bit(addressByte)) };

  if (data.length === MIN_FRAME_LENGTH) {
    // Format 1: Address-only (bus scan/probe) — spec "0x1E ACK→Magnetometer?" örneği.
    summaryKey = SUMMARY_PROBE;
  } else if (repeatedStart) {
    // Format 4: Register-read with repeated START — spec'in ANA örneği.
    fields.push({
      id: 'register',
      name: 'Register',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: byteAt(data, 1),
      physicalValue: formatHexByte(byteAt(data, 1)),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'repeatedAddress',
      name: 'Repeated START · Address',
      offset: 2,
      length: 1,
      rawBytes: data.slice(2, 3),
      rawValue: byteAt(data, 2),
      physicalValue: formatAddress(byteAt(data, 2)),
      valid: true,
      warnings: [],
    });
    if (data.length > 3) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: 3,
        length: data.length - 3,
        rawBytes: data.slice(3),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
    summaryKey = SUMMARY_REGISTER_READ;
    summaryParams['register'] = formatHexByte(byteAt(data, 1));
  } else if (!isRead) {
    // Format 2: Write — ilk data baytı Register/Command (dosya başı kapsam kararı).
    fields.push({
      id: 'register',
      name: 'Register',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: byteAt(data, 1),
      physicalValue: formatHexByte(byteAt(data, 1)),
      valid: true,
      warnings: [],
    });
    if (data.length > 2) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: 2,
        length: data.length - 2,
        rawBytes: data.slice(2),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
    summaryKey = SUMMARY_WRITE;
    summaryParams['register'] = formatHexByte(byteAt(data, 1));
  } else {
    // Format 3: Read (repeated-start yok, doğrudan Address+R) — register kavramı yok.
    fields.push({
      id: 'data',
      name: 'Data',
      offset: 1,
      length: data.length - 1,
      rawBytes: data.slice(1),
      unit: 'B',
      valid: true,
      warnings: [],
    });
    summaryKey = SUMMARY_READ;
  }

  const metadata: I2cFrameMetadata = {
    address7bit: address7Bit(addressByte),
    isRead,
    hasRepeatedStart: repeatedStart,
    summaryKey,
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
    valid: true,
    errors: [],
    warnings: [],
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseI2c(data: Uint8Array): ParseResult {
  return parseI2cFrame(data, {});
}

export const i2cParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** I2C'nin bayt seviyesinde ayırt edici bir imzası YOK (SPI gibi) — yalnız boş olmadığını kontrol eder. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: I2cParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseI2cFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — 'register-read' spec özetinin KENDİ örneği
 * (`01-fiziksel-arayuzler.md:274`) birebir; 'bus-probe' spec'in magnetometer
 * örneği (0x1E, `:284`); diğerleri simetriyle kurulmuş (spi.ts disiplini,
 * spec write/read-only örneği vermiyor).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'register-read',
    name: 'protocol.i2c.example.registerRead.name',
    // Spec'in ANA örneği: Addr 0x68+W(0xD0), Reg 0x75, Repeated START Addr+R(0xD1), Data 0x71.
    bytes: Uint8Array.from([0xd0, 0x75, 0xd1, 0x71]),
    description: 'protocol.i2c.example.registerRead.description',
    expectedValid: true,
  },
  {
    id: 'register-write',
    name: 'protocol.i2c.example.registerWrite.name',
    // register-read ile simetrik: repeated-start yok, register sonrası doğrudan yazılan veri.
    bytes: Uint8Array.from([0xd0, 0x75, 0xab]),
    description: 'protocol.i2c.example.registerWrite.description',
    expectedValid: true,
  },
  {
    id: 'read-only',
    name: 'protocol.i2c.example.readOnly.name',
    // Repeated-start YOK, doğrudan Address+R — SMBus "Receive Byte" tarzı senaryoya benzer.
    bytes: Uint8Array.from([0xd1, 0x71]),
    description: 'protocol.i2c.example.readOnly.description',
    expectedValid: true,
  },
  {
    id: 'bus-probe',
    name: 'protocol.i2c.example.busProbe.name',
    // Spec'in bus scan örneği: 0x1E (Magnetometer?), Write yönünde probe.
    bytes: Uint8Array.from([0x3c]),
    description: 'protocol.i2c.example.busProbe.description',
    expectedValid: true,
  },
];

export const i2cPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: i2cParser,
  documentation: {
    summary: 'protocol.i2c.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
