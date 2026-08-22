/**
 * RS-422 — balanced differential seri arayüz. Faz 10 dalga 11d (sıralama
 * önerisi #4'ün ikinci yarısı, `docs/brief-faz10-dalga11.md`). Framing motoruna
 * (Faz 6) hiç uğramaz: RS-422 bir çerçeveleme protokolü DEĞİL, UART
 * karakterlerini taşıyan elektriksel katmandır.
 *
 * ── Decode ne gösterir ─────────────────────────────────────────────────────
 * Yakalanan her bayt bir UART karakteri olarak hat seviyelerine açılır
 * (`uartLineCore.ts`): `0x41 'A' · 0 10000010 1` = Start(0) · D0..D7 LSB-first ·
 * Stop(1). Spec özetinin RS-232 bölümündeki bit görünümü örneği
 * (`01-fiziksel-arayuzler.md:117`) bunun birebir kaynağıdır — UART çerçevesi
 * fiziksel katmana göre DEĞİŞMEZ ("fiziksel RS-232 katmanı UART frame'ini
 * değiştirmez", aynı dosya), bu yüzden aynı açılım RS-422 için de geçerli.
 *
 * Diferansiyel karşılık (`V_AB`, logic 1 → `+`) frame metadata'sına yazılır,
 * alan tablosuna DEĞİL: hat bitlerinin birebir eşleniği olduğu için tabloda
 * ikinci kez göstermek aynı bilgiyi tekrar etmek olurdu. Spec'in istediği
 * dört kanallı dalga formu (UART Bit / TX+ / TX− / Vdiff) elektriksel sinyal
 * görünümüdür — bu toolkit yalnız yakalanmış BAYTLARI çözer, KAPSAM DIŞI.
 *
 * ── 8N1 varsayımı ──────────────────────────────────────────────────────────
 * `ProtocolParser.parse` konfigürasyon kanalı taşımıyor (baud/parity/stop
 * girilemiyor); sayfa 8N1 varsayar ve bunu dokümantasyonunda yazar. Parity ve
 * 2 stop biti çekirdekte hazır ve test edilmiş — #5 (uart/rs-232/ttl-uart/
 * cmos-uart, kendi Configuration aracı olan sayfalar) devralacak.
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Termination / propagation hesapları:** matematiği RS-485'inkiyle aynı
 *   ruhta (`protocol-core/timing/rs485.ts`, Faz 5) ama motor RS-485 adıyla
 *   yayınlanmış. Katalogda RS-422 kaydına `rs485-timing` BİLEREK eklenmedi —
 *   RS-422 sayfasında "RS-485 Timing" başlıklı bir araç göstermek kullanıcıyı
 *   yanıltır (brief'in "paylaşılmıyor" saptaması). RS-422'nin kendi
 *   termination aracı ayrı bir iş.
 * - **Driver/receiver sayısı (TI örneğindeki 1 driver → 10 receiver):** topoloji
 *   girdisi, bayt akışında karşılığı yok.
 * - **Full/half duplex ayrımı:** RS-422 full-duplex dört tel; yakalanan tek
 *   yönlü bayt akışında görünür bir izi yok, yalnız dokümantasyonda yazılı.
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
  differentialLines,
} from './uartLineCore';

const PROTOCOL_ID = 'rs-422';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RS-422';

const MIN_FRAME_LENGTH = 1;
const CONFIG_LABEL = '8N1';

const ERROR_EMPTY_FRAME = 'protocol.rs422.error.emptyFrame';
const ERROR_ABORTED = 'protocol.rs422.error.aborted';
const SUMMARY_TRANSMISSION = 'protocol.rs422.summary.transmission';

export type Rs422FrameMetadata = {
  characterCount: number;
  bitsPerCharacter: number;
  /** DE penceresi/aktarım uzunluğu bit-süresi cinsinden; saniyeye çevirmek baud ister (uart-timing). */
  totalBitTimes: number;
  configLabel: string;
  /** Açılan karakterlerin V_AB dizisi (logic 1 → `+`). */
  differentialLines: string[];
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Rs422ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseRs422Frame(data: Uint8Array, options: Rs422ParseOptions): ParseResult {
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

  const fields: ParsedField[] = buildCharacterFields(data, UART_8N1);
  const perCharacter = bitsPerCharacter(UART_8N1);

  const metadata: Rs422FrameMetadata = {
    characterCount: data.length,
    bitsPerCharacter: perCharacter,
    totalBitTimes: data.length * perCharacter,
    configLabel: CONFIG_LABEL,
    differentialLines: differentialLines(data, UART_8N1),
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

export function parseRs422(data: Uint8Array): ParseResult {
  return parseRs422Frame(data, {});
}

export const rs422Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Elektriksel katmanın bayt seviyesinde imzası YOK — boş olmayan her arabellek çözülür. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Rs422ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseRs422Frame(data, options);
  },
};

/**
 * Örnekler — 'single-character' spec özetinin KENDİ bit görünümü örneğinin
 * baytı (0x41='A', `01-fiziksel-arayuzler.md:117`); 'multi-character' aynı
 * açılımın çok karakterli hâlini gösteren temsili bir yük (spec RS-422 için
 * somut bayt örneği vermiyor — kaynaklı olmadığı açıklamasında yazılı).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'single-character',
    name: 'protocol.rs422.example.singleCharacter.name',
    bytes: Uint8Array.from([0x41]),
    description: 'protocol.rs422.example.singleCharacter.description',
    expectedValid: true,
  },
  {
    id: 'multi-character',
    name: 'protocol.rs422.example.multiCharacter.name',
    // "OK\r\n" — basılabilir iki karakter + iki kontrol baytı, ASCII sütununun
    // yalnız basılabilir aralıkta dolduğunu da gösterir.
    bytes: Uint8Array.from([0x4f, 0x4b, 0x0d, 0x0a]),
    description: 'protocol.rs422.example.multiCharacter.description',
    expectedValid: true,
  },
];

export const rs422Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: rs422Parser,
  documentation: {
    summary: 'protocol.rs422.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
