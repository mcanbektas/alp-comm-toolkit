/**
 * RS-232 — tek uçlu (single-ended) bipolar gerilim katmanı. Faz 10 dalga 11e
 * (sıralama önerisi #5'in ikinci üyesi). Framing motoruna (Faz 6) hiç uğramaz.
 *
 * ── Spec'in ısrarla vurguladığı ayrım ──────────────────────────────────────
 * **UART ≠ RS-232** (`01-fiziksel-arayuzler.md:99`): biri çerçeveleme, öteki
 * elektriksel katman. Tipik zincir `MCU UART (3.3V) → MAX3232 → RS-232 →
 * PC/PLC/Instrument`. Fiziksel RS-232 katmanı UART çerçevesini DEĞİŞTİRMEZ —
 * bu yüzden karakter açılımı ortak çekirdekten gelir (`uartLineCore.ts`).
 *
 * ── Bu sayfanın eki: mark/space polaritesi ─────────────────────────────────
 * RS-232'nin UART'tan farkı hat polaritesidir: **Mark → logic 1 → negatif hat
 * gerilimi, Space → logic 0 → pozitif** (`:101`). UART idle'ı logic 1 olduğu
 * için RS-232 TX hattı boştayken negatiftir ("logic inversion"). Alan
 * tablosunda her karakterin UART hattı VE RS-232 mark/space karşılığı yan yana
 * basılır — spec'in "UART Side ve RS-232 Side dalga formunu yan yana
 * göstermeli" isteğinin bayt seviyesindeki karşılığı.
 *
 * Fixture spec'in KENDİ örneği (`:109`): 9600 8N1, Data=0x41='A' →
 * `Start D0..D7 Stop = 0 1 0 0 0 0 0 1 0 1`.
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Gerçek gerilim aralığı (±3V…±15V):** spec ÖZETİNDE yok. Polarite adı
 *   üretilir, sayı uydurulmaz (brief'in "Signal View kapsamı BELİRSİZ"
 *   saptaması; 1-Wire'da Serial Number endianness'ının bırakıldığı gibi).
 * - **DTE/DCE, null modem, DB9 pinout, RTS/CTS handshake:** hepsi kablolama/
 *   konfigürasyon yardımcısı; yakalanmış bayt dizisinde izi yok. Katalogun
 *   `tools` listesindeki "DTE/DCE Analyzer"/"Null-Modem Helper" bu decode'un
 *   vaadi değildir.
 * - **Baud/karakter süresi:** `uart-timing` hesaplayıcısında (Faz 5), katalog
 *   kaydına `calculatorIds` olarak eklendi.
 * - **Satır sonu (CR/LF) ayrımı:** UART sayfasının eki; RS-232 sayfası
 *   elektriksel katmana odaklanır, aynı ayrımı ikinci kez yapmaz.
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

import {
  UART_8N1,
  bitsPerCharacter,
  buildCharacterFields,
  describeCharacter,
  expandUartCharacter,
  formatMarkSpaceLine,
} from './uartLineCore';
import type { UartLineConfig } from './uartLineCore';

const PROTOCOL_ID = 'rs-232';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RS-232';

const MIN_FRAME_LENGTH = 1;
const CONFIG_LABEL = '8N1';

const ERROR_EMPTY_FRAME = 'protocol.rs232.error.emptyFrame';
const ERROR_ABORTED = 'protocol.rs232.error.aborted';
const SUMMARY_TRANSMISSION = 'protocol.rs232.summary.transmission';

/** `0x41 'A' · 0 10000010 1 · SMSSSSSMSM` — UART hattı + RS-232 mark/space karşılığı. */
function describeRs232Character(byte: number, config: UartLineConfig): string {
  const markSpace = formatMarkSpaceLine(expandUartCharacter(byte, config).levels);
  return `${describeCharacter(byte, config)} · ${markSpace}`;
}

export type Rs232FrameMetadata = {
  characterCount: number;
  bitsPerCharacter: number;
  totalBitTimes: number;
  configLabel: string;
  /** Açılan karakterlerin mark/space dizisi (logic 1 → `M`, negatif hat). */
  markSpaceLines: string[];
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Rs232ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseRs232Frame(data: Uint8Array, options: Rs232ParseOptions): ParseResult {
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

  const fields: ParsedField[] = buildCharacterFields(data, UART_8N1, {
    describe: describeRs232Character,
  });
  const perCharacter = bitsPerCharacter(UART_8N1);

  const metadata: Rs232FrameMetadata = {
    characterCount: data.length,
    bitsPerCharacter: perCharacter,
    totalBitTimes: data.length * perCharacter,
    configLabel: CONFIG_LABEL,
    markSpaceLines: Array.from(data, (byte) =>
      formatMarkSpaceLine(expandUartCharacter(byte, UART_8N1).levels),
    ),
    summaryKey: SUMMARY_TRANSMISSION,
    summaryParams: {
      characters: String(data.length),
      bitTimes: String(data.length * perCharacter),
    },
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

export function parseRs232(data: Uint8Array): ParseResult {
  return parseRs232Frame(data, {});
}

export const rs232Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Elektriksel katmanın bayt seviyesinde imzası YOK — boş olmayan her arabellek çözülür. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Rs232ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseRs232Frame(data, options);
  },
};

/**
 * Örnekler — 'spec-character' spec özetinin KENDİ 9600 8N1 örneği (0x41='A',
 * `:109`); 'two-characters' aynı açılımın ardışık iki karakterdeki hâli
 * (spec çok karakterli RS-232 örneği vermiyor, temsili).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'spec-character',
    name: 'protocol.rs232.example.specCharacter.name',
    bytes: Uint8Array.from([0x41]),
    description: 'protocol.rs232.example.specCharacter.description',
    expectedValid: true,
  },
  {
    id: 'two-characters',
    name: 'protocol.rs232.example.twoCharacters.name',
    bytes: Uint8Array.from([0x48, 0x69]),
    description: 'protocol.rs232.example.twoCharacters.description',
    expectedValid: true,
  },
];

export const rs232Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: rs232Parser,
  documentation: {
    summary: 'protocol.rs232.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
