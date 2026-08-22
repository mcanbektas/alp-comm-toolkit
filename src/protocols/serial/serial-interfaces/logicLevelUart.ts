/**
 * TTL UART ve CMOS UART — UART çerçevesinin belirli bir logic seviyesi
 * ailesiyle taşınması. Faz 10 dalga 11f (sıralama önerisi #5'in ikinci yarısı).
 *
 * ── Neden TEK dosya, iki eklenti ───────────────────────────────────────────
 * İkisinin de tel biçimi UART'ın KENDİSİ: spec özeti TTL UART için "ayrı bir
 * frame protokolü değil" diyor (`01-fiziksel-arayuzler.md:175`), CMOS UART
 * bölümü de aynı çerçevenin farklı besleme seviyelerinde taşınmasını anlatıyor
 * (`:187`). Bayt akışında ikisini ayıran hiçbir iz YOK — ayrım tamamen
 * elektrikseldir. `canClassic.ts` (CAN 2.0A/2.0B) ve `ethernet.ts` (Ethernet II
 * / IEEE 802.3 / VLAN) emsali: aynı çözümleyici, ayrı katalog kimlikleri.
 *
 * Decode bu yüzden `uartLineCore.ts`in karakter açılımından ibarettir; UART
 * sayfasının satır sonu eki BURAYA TAŞINMADI (o, ASCII konsol trafiğine dair
 * bir yorum; TTL/CMOS sayfalarının konusu seviye uyumu).
 *
 * ── Bu iki sayfanın ASIL motoru decode değil ───────────────────────────────
 * Kaynağın bu iki bölümü baştan sona logic seviyesi uyumluluğudur:
 *   - HIGH: `VOH_min > VIH_min`, LOW: `VOL_max < VIL_max` (`:177-183`)
 *   - CMOS'ta her yön AYRI değerlendirilir; spec örneği `A→B: PASS`,
 *     `B→A: FAIL (B VOH=1.8V, A VIH=2.0V)` (`:189`)
 *   - **Kullanıcıya yalnız 3.3V/5V seçtirip karar verilmesi açıkça YANLIŞ
 *     sayılır** — karar datasheet'teki VIH/VIL/VOH/VOL, Absolute Maximum ve
 *     5V-tolerant değerlerine bağlıdır.
 * Motor `protocol-core/timing/logicLevels.ts`te, arayüzü `logic-level-compat`
 * hesaplayıcısında; iki katalog kaydına da `calculatorIds` ile bağlandı.
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Gerilim/dalga formu görünümü:** yakalanmış baytlarda seviye bilgisi yok;
 *   toolkit yalnız bayt çözer (RS-232'nin gerilim aralığı boşluğuyla aynı karar).
 * - **Hazır "3.3V CMOS / 5V TTL" profilleri:** kaynağın açıkça reddettiği
 *   kestirme; hesaplayıcı dört eşiği datasheet'ten ister.
 * - **Seviye çevirici (level translator) seçimi:** parça önerisi kaynağın
 *   kapsamında yok.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
} from '@/protocol-core/types';

import { UART_8N1, bitsPerCharacter, buildCharacterFields, formatAsciiText } from './uartLineCore';

const MIN_FRAME_LENGTH = 1;
const CONFIG_LABEL = '8N1';

export type LogicLevelUartFrameMetadata = {
  characterCount: number;
  bitsPerCharacter: number;
  totalBitTimes: number;
  configLabel: string;
  asciiText: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface LogicLevelUartVariant {
  protocolId: string;
  displayName: string;
  /** Çeviri anahtarı öneki, ör. `protocol.ttlUart`. */
  translationPrefix: string;
}

const TTL_UART: LogicLevelUartVariant = {
  protocolId: 'ttl-uart',
  /** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
  displayName: 'TTL UART',
  translationPrefix: 'protocol.ttlUart',
};

const CMOS_UART: LogicLevelUartVariant = {
  protocolId: 'cmos-uart',
  displayName: 'CMOS UART',
  translationPrefix: 'protocol.cmosUart',
};

interface LogicLevelUartParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseVariantFrame(
  variant: LogicLevelUartVariant,
  data: Uint8Array,
  options: LogicLevelUartParseOptions,
): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: `${variant.translationPrefix}.error.aborted` },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: `${variant.translationPrefix}.error.emptyFrame`,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields = buildCharacterFields(data, UART_8N1);
  const perCharacter = bitsPerCharacter(UART_8N1);

  const metadata: LogicLevelUartFrameMetadata = {
    characterCount: data.length,
    bitsPerCharacter: perCharacter,
    totalBitTimes: data.length * perCharacter,
    configLabel: CONFIG_LABEL,
    asciiText: formatAsciiText(data),
    summaryKey: `${variant.translationPrefix}.summary.transmission`,
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
    protocol: variant.protocolId,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: true,
    errors: [],
    warnings: [],
  };

  return { success: true, frame, consumedBytes: data.length };
}

function createParser(variant: LogicLevelUartVariant): ProtocolParser {
  return {
    protocolId: variant.protocolId,
    displayName: variant.displayName,

    /** Logic seviyesi ailesinin bayt seviyesinde imzası YOK — boş olmayan her arabellek çözülür. */
    canParse(data: Uint8Array): boolean {
      return data.length >= MIN_FRAME_LENGTH;
    },

    parse(data: Uint8Array, context?: ParseContext): ParseResult {
      const options: LogicLevelUartParseOptions = {};
      if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
      if (context?.direction !== undefined) options.direction = context.direction;
      if (context?.channel !== undefined) options.channel = context.channel;
      if (context?.signal !== undefined) options.signal = context.signal;
      return parseVariantFrame(variant, data, options);
    },
  };
}

function createExamples(variant: LogicLevelUartVariant): ExampleFrame[] {
  return [
    {
      id: 'debug-console',
      name: `${variant.translationPrefix}.example.debugConsole.name`,
      // "OK\r\n" — TTL/CMOS UART'ın en yaygın kullanımı (debug konsolu, modem yanıtı).
      bytes: Uint8Array.from([0x4f, 0x4b, 0x0d, 0x0a]),
      description: `${variant.translationPrefix}.example.debugConsole.description`,
      expectedValid: true,
    },
    {
      id: 'single-character',
      name: `${variant.translationPrefix}.example.singleCharacter.name`,
      // 0x41='A' — spec'in bit görünümü örneğinin baytı; hattın en yalın hâli.
      bytes: Uint8Array.from([0x41]),
      description: `${variant.translationPrefix}.example.singleCharacter.description`,
      expectedValid: true,
    },
  ];
}

export const ttlUartParser: ProtocolParser = createParser(TTL_UART);
export const cmosUartParser: ProtocolParser = createParser(CMOS_UART);

export function parseTtlUart(data: Uint8Array): ParseResult {
  return parseVariantFrame(TTL_UART, data, {});
}

export function parseCmosUart(data: Uint8Array): ParseResult {
  return parseVariantFrame(CMOS_UART, data, {});
}

export const ttlUartPlugin: ProtocolPlugin = {
  id: TTL_UART.protocolId,
  name: TTL_UART.displayName,
  category: 'interfaces-framing',
  parser: ttlUartParser,
  documentation: {
    summary: `${TTL_UART.translationPrefix}.documentation.summary`,
    layer: 'physical',
  },
  exampleFrames: createExamples(TTL_UART),
};

export const cmosUartPlugin: ProtocolPlugin = {
  id: CMOS_UART.protocolId,
  name: CMOS_UART.displayName,
  category: 'interfaces-framing',
  parser: cmosUartParser,
  documentation: {
    summary: `${CMOS_UART.translationPrefix}.documentation.summary`,
    layer: 'physical',
  },
  exampleFrames: createExamples(CMOS_UART),
};
