/**
 * UART — asenkron seri çerçeveleme. Faz 10 dalga 11e (sıralama önerisi #5'in
 * ilk yarısı, `docs/brief-faz10-dalga11.md`). Framing motoruna (Faz 6) hiç
 * uğramaz: UART'ın çerçevesi karakterin KENDİSİDİR (Start · veri · [parity] ·
 * Stop), paket sınırı üst katmanın işidir.
 *
 * ── UART bu katalogda neyin merkezi ────────────────────────────────────────
 * Spec özeti (`01-fiziksel-arayuzler.md:78`) ısrarla ayırır: **UART kendi
 * başına bir gerilim seviyesi/kablo standardı değildir** — aynı bit akışı
 * 1.8V/3.3V CMOS, 5V TTL, RS-232, RS-422 ya da RS-485 üzerinden taşınabilir.
 * Bu yüzden karakter açılımı ortak çekirdekte (`uartLineCore.ts`, dalga 11d)
 * durur; bu dosya UART sayfasının kendi ekini yapar.
 *
 * Fixture spec'in KENDİ bit görünümü örneği (`:88`): 0x53 = 0b01010011,
 * LSB-first aktarımla `Start D0..D7 Stop = 0 1 1 0 0 1 0 1 0 1`.
 *
 * ── UART sayfasının eki: satır sonu + ASCII ────────────────────────────────
 * Spec'in Config paneli "Line Ending (None/CR/LF/CRLF)" içerir ve entegrasyon
 * hataları arasında "CR/LF uyuşmazlığı" ayrıca sayılır; canlı görünüm örneği
 * de tam olarak bunu gösterir (`:91`): `48 65 6C 6C 6F 0D 0A` → `Hello\r\n`.
 * Bu yüzden yakalamanın SONUNDAKİ CR / LF / CRLF baytları ayrı bir `Line
 * Ending` alanına toplanır, ASCII karşılığı da metadata'ya yazılır.
 *
 * Satır sonu baytları da birer UART karakteridir: hat üzerinde geçen süre
 * (`totalBitTimes`) TÜM baytları sayar, `Character n` alanları ise yalnız
 * satır sonundan önceki yükü açar. Ayrım bilinçli — alan tablosu "veri" ile
 * "satır sonlandırıcı"yı karıştırmasın diye.
 *
 * ── 8N1 varsayımı ──────────────────────────────────────────────────────────
 * `ProtocolParser.parse` konfigürasyon kanalı taşımıyor. Sayfanın Zamanlama
 * sekmesindeki `uart-timing` hesaplayıcısı (Faz 5, `timing/uart.ts`) baud,
 * veri biti, parity, stop biti, oversampling ve baud hatasını ZATEN
 * hesaplıyor — bu dosya onu tekrar yazmaz, katalog kaydına `calculatorIds`
 * eklendi.
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Parity/Framing/Overrun/Noise/Break hataları:** hepsi bit-seviyesinde ya
 *   da donanım durum bayrağında görünür (framing error = stop bitinin beklenen
 *   yerde 1 olmaması). Yakalanmış BAYT dizisinde izleri yok; parity biti bile
 *   bayta girmez. Katalogun `tools` listesindeki "Error Analyzer" bu decode'un
 *   vaadi değildir.
 * - **Baud/oversampling/bit zamanı:** `uart-timing` hesaplayıcısında.
 * - **Flow control (RTS/CTS), bit order dışı konfigürasyonlar:** bayt akışında
 *   karşılığı yok.
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
  formatAsciiText,
} from './uartLineCore';

const PROTOCOL_ID = 'uart';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'UART';

const MIN_FRAME_LENGTH = 1;
const CONFIG_LABEL = '8N1';
const CR = 0x0d;
const LF = 0x0a;

const ERROR_EMPTY_FRAME = 'protocol.uart.error.emptyFrame';
const ERROR_ABORTED = 'protocol.uart.error.aborted';
const SUMMARY_TRANSMISSION = 'protocol.uart.summary.transmission';

export type UartLineEnding = 'none' | 'cr' | 'lf' | 'crlf';

/** Yalnız yakalamanın SONU incelenir — ortadaki CR/LF veri sayılır. */
function detectLineEnding(data: Uint8Array): UartLineEnding {
  const last = data[data.length - 1];
  if (last === LF) {
    return data.length >= 2 && data[data.length - 2] === CR ? 'crlf' : 'lf';
  }
  if (last === CR) return 'cr';
  return 'none';
}

const LINE_ENDING_LENGTH: Record<UartLineEnding, number> = { none: 0, cr: 1, lf: 1, crlf: 2 };
const LINE_ENDING_LABEL: Record<UartLineEnding, string> = {
  none: '—',
  cr: 'CR (0x0D)',
  lf: 'LF (0x0A)',
  crlf: 'CRLF (0x0D 0x0A)',
};

export type UartFrameMetadata = {
  /** Yakalamadaki TÜM baytlar — satır sonu dahil, hat süresi bunun üzerinden. */
  characterCount: number;
  /** Satır sonu çıkarıldıktan sonra kalan yük baytı sayısı. */
  payloadCharacterCount: number;
  bitsPerCharacter: number;
  totalBitTimes: number;
  configLabel: string;
  lineEnding: UartLineEnding;
  /** Yükün ASCII karşılığı; basılamayan bayt `.` olur. */
  asciiText: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface UartParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseUartFrame(data: Uint8Array, options: UartParseOptions): ParseResult {
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

  const lineEnding = detectLineEnding(data);
  const endingLength = LINE_ENDING_LENGTH[lineEnding];
  const payload = data.slice(0, data.length - endingLength);

  const fields: ParsedField[] = buildCharacterFields(payload, UART_8N1);
  if (endingLength > 0) {
    fields.push({
      id: 'lineEnding',
      name: 'Line Ending',
      offset: payload.length,
      length: endingLength,
      rawBytes: data.slice(payload.length),
      physicalValue: LINE_ENDING_LABEL[lineEnding],
      valid: true,
      warnings: [],
    });
  }

  const perCharacter = bitsPerCharacter(UART_8N1);
  const metadata: UartFrameMetadata = {
    characterCount: data.length,
    payloadCharacterCount: payload.length,
    bitsPerCharacter: perCharacter,
    totalBitTimes: data.length * perCharacter,
    configLabel: CONFIG_LABEL,
    lineEnding,
    asciiText: formatAsciiText(payload),
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

export function parseUart(data: Uint8Array): ParseResult {
  return parseUartFrame(data, {});
}

export const uartParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** UART'ın bayt seviyesinde imzası YOK — boş olmayan her arabellek çözülür. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: UartParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseUartFrame(data, options);
  },
};

/**
 * Örnekler — ikisi de spec özetinin KENDİ örnekleri: 'bit-view' UART bölümünün
 * bit görünümü baytı (0x53, `:88`), 'hello-crlf' canlı görünüm satırı
 * (`48 65 6C 6C 6F 0D 0A`, `:91`). 'binary-payload' satır sonu OLMAYAN ve
 * basılamayan baytlardan oluşan karşıt örnek (ASCII sütununun ne zaman boş
 * kaldığını gösterir).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'hello-crlf',
    name: 'protocol.uart.example.helloCrlf.name',
    bytes: Uint8Array.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0d, 0x0a]),
    description: 'protocol.uart.example.helloCrlf.description',
    expectedValid: true,
  },
  {
    id: 'bit-view',
    name: 'protocol.uart.example.bitView.name',
    bytes: Uint8Array.from([0x53]),
    description: 'protocol.uart.example.bitView.description',
    expectedValid: true,
  },
  {
    id: 'binary-payload',
    name: 'protocol.uart.example.binaryPayload.name',
    bytes: Uint8Array.from([0x00, 0xff, 0x55]),
    description: 'protocol.uart.example.binaryPayload.description',
    expectedValid: true,
  },
];

export const uartPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: uartParser,
  documentation: {
    summary: 'protocol.uart.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
