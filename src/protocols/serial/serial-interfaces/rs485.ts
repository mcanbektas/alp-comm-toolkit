/**
 * RS-485 — balanced differential multipoint arayüz. Faz 10 dalga 11d (sıralama
 * önerisi #4'ün ilk yarısı, `docs/brief-faz10-dalga11.md`). Framing motoruna
 * (Faz 6) hiç uğramaz.
 *
 * ── Spec'in ısrarla vurguladığı ayrım ──────────────────────────────────────
 * **RS-485 ≠ Modbus.** Doğru zincir: `Modbus RTU → UART → RS-485 Transceiver →
 * A/B Differential Bus` (`01-fiziksel-arayuzler.md:133`). Bu decode bu yüzden
 * taşınan baytların İÇERİĞİNİ yorumlamaz — adres/fonksiyon kodu/CRC gibi alanlar
 * üst katmanın işidir ve katalog kaydındaki `related` bağlantıları (modbus-rtu,
 * modbus-ascii, bacnet-mstp, profibus-dp) kullanıcıyı oraya gönderir.
 *
 * ── Decode ne gösterir ─────────────────────────────────────────────────────
 * 1. Her bayt bir UART karakteri olarak hat seviyelerine açılır
 *    (`uartLineCore.ts`, 8N1 varsayımı ve gerekçesi orada).
 * 2. Frame metadata'sı DE penceresini bit-süresi cinsinden verir
 *    (`karakter sayısı × karakter başına bit`) — spec'in "DE penceresi TX
 *    süresince aktif" tarifinin bayt akışından hesaplanabilen tek karşılığı.
 *    Saniyeye çevirmek baud ister: `uart-timing` hesaplayıcısı bunu zaten
 *    yapıyor, burada TEKRAR YAZILMADI.
 * 3. **Echo şüphesi:** half-duplex'te sürücü kendi gönderdiğini kendi
 *    receiver'ında geri okur; spec'in "Entegrasyon problemleri" listesi bunu
 *    ayrıca sayıyor ("echo'nun response sanılması"). Yakalanan dizi çift
 *    uzunlukta ve iki yarısı BİREBİR aynıysa frame seviyesinde uyarı basılır ve
 *    ikinci yarı `Echo · Character n` olarak ayrı alanlara ayrılır.
 *    **Yanlış pozitif kabul edildi ve dokümante edildi:** master'ın aynı
 *    çerçeveyi iki kez göndermesi de aynı deseni üretir — bu yüzden hata değil
 *    UYARI, ve alanlar yine de eksiksiz gösterilir. Eşik: her yarı en az 2 bayt
 *    (`01 01` gibi kısa dizilerde tesadüf oranı yüksek).
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Termination / bias / unit load / propagation delay:** motoru
 *   `protocol-core/timing/rs485.ts`te (Faz 5) ZATEN var ve `rs485-timing`
 *   hesaplayıcısında çalışıyor — katalog kaydına `calculatorIds` eklendi,
 *   formüller burada tekrarlanmadı.
 * - **DE/RE zamanlaması, turnaround ölçümü, collision:** GPIO ve bus zamanlama
 *   sinyalleri; yakalanmış baytlarda karşılığı yok (TX Register Empty ↔
 *   Transmission Complete ayrımı dahil). Katalogun `tools` listesindeki
 *   "DE/RE Timing"/"Collision/Turnaround Analyzer" bu decode'un vaadi DEĞİL
 *   (onewire.ts/i2c.ts'in aspirasyonel tools-listesi disipliniyle aynı).
 * - **A/B polarite tespiti:** yakalanan bayt zaten çözülmüş logic seviyesidir;
 *   ters polarite bayt akışında değil, çözülemeyen çöp veride görünür.
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
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  UART_8N1,
  bitsPerCharacter,
  buildCharacterFields,
  differentialLines,
} from './uartLineCore';

const PROTOCOL_ID = 'rs-485';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RS-485';

const MIN_FRAME_LENGTH = 1;
const CONFIG_LABEL = '8N1';
/** Echo şüphesi için her yarının taşıması gereken en az bayt (dosya başı gerekçe). */
const MIN_ECHO_HALF_LENGTH = 2;

const ERROR_EMPTY_FRAME = 'protocol.rs485.error.emptyFrame';
const ERROR_ABORTED = 'protocol.rs485.error.aborted';
const WARNING_ECHO_SUSPECTED = 'protocol.rs485.warning.echoSuspected';
const SUMMARY_TRANSMISSION = 'protocol.rs485.summary.transmission';
const SUMMARY_ECHO = 'protocol.rs485.summary.echo';

/**
 * Yakalanan dizinin iki yarısı birebir aynı mı — half-duplex sürücü echo'sunun
 * bayt seviyesindeki tek izi. Tek uzunlukta ya da yarısı 2 bayttan kısa
 * dizilerde hiç denenmez.
 */
function isEchoSuspected(data: Uint8Array): boolean {
  if (data.length % 2 !== 0) return false;
  const half = data.length / 2;
  if (half < MIN_ECHO_HALF_LENGTH) return false;
  for (let index = 0; index < half; index += 1) {
    if (data[index] !== data[half + index]) return false;
  }
  return true;
}

export type Rs485FrameMetadata = {
  characterCount: number;
  bitsPerCharacter: number;
  /** DE penceresi bit-süresi cinsinden; saniyeye çevirmek baud ister (uart-timing). */
  totalBitTimes: number;
  configLabel: string;
  echoSuspected: boolean;
  /** Açılan karakterlerin V_AB dizisi (logic 1 → `+`). */
  differentialLines: string[];
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Rs485ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseRs485Frame(data: Uint8Array, options: Rs485ParseOptions): ParseResult {
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

  const echoSuspected = isEchoSuspected(data);
  const warnings: ProtocolWarning[] = [];
  let fields: ParsedField[];

  if (echoSuspected) {
    const half = data.length / 2;
    fields = [
      ...buildCharacterFields(data.slice(0, half), UART_8N1, { namePrefix: 'TX · ' }),
      ...buildCharacterFields(data.slice(half), UART_8N1, {
        idPrefix: 'echo',
        namePrefix: 'Echo · ',
        baseOffset: half,
      }),
    ];
    warnings.push({
      code: 'echo-suspected',
      message: WARNING_ECHO_SUSPECTED,
      offset: half,
      length: half,
    });
  } else {
    fields = buildCharacterFields(data, UART_8N1);
  }

  const perCharacter = bitsPerCharacter(UART_8N1);
  /** Echo, sürücünün kendi penceresinin dışında okunur — DE penceresi yalnız TX yarısıdır. */
  const transmittedCharacters = echoSuspected ? data.length / 2 : data.length;

  const metadata: Rs485FrameMetadata = {
    characterCount: data.length,
    bitsPerCharacter: perCharacter,
    totalBitTimes: transmittedCharacters * perCharacter,
    configLabel: CONFIG_LABEL,
    echoSuspected,
    differentialLines: differentialLines(data, UART_8N1),
    summaryKey: echoSuspected ? SUMMARY_ECHO : SUMMARY_TRANSMISSION,
    summaryParams: {
      characters: String(transmittedCharacters),
      bitTimes: String(transmittedCharacters * perCharacter),
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
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseRs485(data: Uint8Array): ParseResult {
  return parseRs485Frame(data, {});
}

export const rs485Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Elektriksel katmanın bayt seviyesinde imzası YOK — boş olmayan her arabellek çözülür. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Rs485ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseRs485Frame(data, options);
  },
};

/**
 * Örnekler — 'modbus-rtu-frame' spec özetinin KENDİ bus görünümü örneği
 * (`01-fiziksel-arayuzler.md:161`: `UART TX: 01 03 00 00 00 02 C4 0B`);
 * 'half-duplex-echo' aynı çerçevenin iki kez göründüğü hâli (echo uyarısını
 * gösterir); 'single-character' hat açılımının en yalın hâli (0x41='A',
 * spec'in bit görünümü örneğinin baytı).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'modbus-rtu-frame',
    name: 'protocol.rs485.example.modbusRtu.name',
    bytes: Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]),
    description: 'protocol.rs485.example.modbusRtu.description',
    expectedValid: true,
  },
  {
    id: 'half-duplex-echo',
    name: 'protocol.rs485.example.halfDuplexEcho.name',
    bytes: Uint8Array.from([
      0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b, 0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4,
      0x0b,
    ]),
    description: 'protocol.rs485.example.halfDuplexEcho.description',
    expectedValid: true,
  },
  {
    id: 'single-character',
    name: 'protocol.rs485.example.singleCharacter.name',
    bytes: Uint8Array.from([0x41]),
    description: 'protocol.rs485.example.singleCharacter.description',
    expectedValid: true,
  },
];

export const rs485Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: rs485Parser,
  documentation: {
    summary: 'protocol.rs485.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
