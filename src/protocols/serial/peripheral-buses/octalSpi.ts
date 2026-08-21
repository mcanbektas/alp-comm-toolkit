/**
 * Octal SPI (OSPI) — Command/Address/Data faz decode. Faz 10 dalga 11b,
 * sıralama önerisi #2. `qspiCore.ts`nin (quad-spi ile PAYLAŞILAN çekirdek)
 * üstünde ince sarmal — adres/dummy kapsam kararları orada.
 *
 * ── SDR/DDR ve DQS decode'a GİRMEZ ──────────────────────────────────────────
 * Spec özeti (`01-fiziksel-arayuzler.md:250-256`) SDR/DDR'ı ve DQS data
 * strobe'unu tarif ediyor ama bunlar ELEKTRİKSEL/zamanlama kavramları (kaç
 * clock kenarında veri taşındığı, strobe hizası) — `timing/spi.ts`teki
 * `ospiThroughput` bunu zaten hesaplıyor (SDR: `R=8f`, DDR: `R=16f`), ama bu
 * motoru okuyan bir UI hesaplayıcısı henüz YOK (`SpiTimingTool` yalnız
 * `qspiThroughput`u okuyor — bilinen, dokümante edilmiş bir boşluk, COBS'un
 * kendi tools listesinin eksik kalmasıyla aynı emsal). Bu dosyanın decode'u
 * quad-spi'yle AYNI Command+Address+Data yapısını çözer, SDR/DDR ayrımı
 * baytlarda görünmez (ikisi de aynı mantıksal veriyi taşır, yalnız hızları
 * farklıdır).
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
  QSPI_ADDRESS_LENGTH,
  byteAt,
  formatHexAddress24,
  formatHexByte,
  readAddress24BE,
  splitCommandAddressPayload,
} from './qspiCore';

const PROTOCOL_ID = 'octal-spi';
const PROTOCOL_DISPLAY_NAME = 'Octal SPI';

const MIN_FRAME_LENGTH = 1;

const ERROR_EMPTY_FRAME = 'protocol.octalSpi.error.emptyFrame';
const ERROR_ABORTED = 'protocol.octalSpi.error.aborted';
const SUMMARY_TRANSACTION = 'protocol.octalSpi.summary.transaction';

export type OctalSpiFrameMetadata = {
  command: number;
  address: number | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface OctalSpiParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseOctalSpiFrame(data: Uint8Array, options: OctalSpiParseOptions): ParseResult {
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

  const { command, address, payload } = splitCommandAddressPayload(data, QSPI_ADDRESS_LENGTH);
  const fields: ParsedField[] = [];

  const commandByte = byteAt(command, 0);
  fields.push({
    id: 'command',
    name: 'Command',
    offset: 0,
    length: 1,
    rawBytes: command,
    rawValue: commandByte,
    physicalValue: formatHexByte(commandByte),
    valid: true,
    warnings: [],
  });

  let addressValue: number | undefined;
  const addressComplete = address.length === QSPI_ADDRESS_LENGTH;
  if (addressComplete) {
    addressValue = readAddress24BE(address);
    fields.push({
      id: 'address',
      name: 'Address',
      offset: 1,
      length: QSPI_ADDRESS_LENGTH,
      rawBytes: address,
      rawValue: addressValue,
      physicalValue: formatHexAddress24(addressValue),
      valid: true,
      warnings: [],
    });
  }

  // Adres 3 bayttan kısaysa (kısmi capture) o baytlar Data'ya düşer — hiçbir
  // bayt sessizce kaybolmaz (address tamsa asıl payload, değilse adresin
  // kendi eksik baytları gösterilir; bkz. quadSpi.ts aynı düzeltme).
  const trailingBytes = addressComplete ? payload : address;
  const trailingOffset = addressComplete ? 1 + QSPI_ADDRESS_LENGTH : 1;
  if (trailingBytes.length > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: trailingOffset,
      length: trailingBytes.length,
      rawBytes: trailingBytes,
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const summaryParams: Record<string, string> = { command: formatHexByte(commandByte) };
  if (addressValue !== undefined) {
    summaryParams['address'] = formatHexAddress24(addressValue);
  }
  const metadata: OctalSpiFrameMetadata = {
    command: commandByte,
    address: addressValue,
    summaryKey: SUMMARY_TRANSACTION,
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

export function parseOctalSpi(data: Uint8Array): ParseResult {
  return parseOctalSpiFrame(data, {});
}

export const octalSpiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: OctalSpiParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseOctalSpiFrame(data, options);
  },
};

/**
 * "flash-read" — spec'in Octal SPI için somut bir opcode örneği YOK (Quad
 * SPI'nin 0xEB'sinin aksine); Command baytı bu yüzden İLLÜSTRATİF seçildi
 * (0x0C, Quad SPI'nin 0xEB'sinin 4-byte-address ailesindeki genel kalıbına
 * benzer bir "fast read" opcode'u — dosya başı disiplin notuyla tutarlı,
 * gerçek bir üretici datasheet'inden alınmadı, bu yüzden bağımsız
 * doğrulanmadı olarak işaretli).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'flash-read',
    name: 'protocol.octalSpi.example.flashRead.name',
    bytes: Uint8Array.from([0x0c, 0x00, 0x00, 0x00, 0xca, 0xfe, 0xba, 0xbe]),
    description: 'protocol.octalSpi.example.flashRead.description',
    expectedValid: true,
  },
  {
    id: 'command-only',
    name: 'protocol.octalSpi.example.commandOnly.name',
    bytes: Uint8Array.from([0x06]),
    description: 'protocol.octalSpi.example.commandOnly.description',
    expectedValid: true,
  },
];

export const octalSpiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: octalSpiParser,
  documentation: {
    summary: 'protocol.octalSpi.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
