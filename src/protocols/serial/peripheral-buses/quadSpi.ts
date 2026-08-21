/**
 * Quad SPI (QSPI) — Command/Address/Data faz decode. Faz 10 dalga 11b,
 * sıralama önerisi #2. `qspiCore.ts`nin (bu dalga, octal-spi ile PAYLAŞILAN
 * çekirdek) üstünde ince sarmal — adres/dummy kapsam kararları orada.
 *
 * `timing/spi.ts`teki `qspiThroughput` zaten yazılı ve `SpiTimingTool`
 * (`calc.id 'spi-timing'`) üzerinden çalışıyor — bu dosya yalnız DECODE
 * ekliyor, motor tekrar yazılmadı.
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

const PROTOCOL_ID = 'quad-spi';
const PROTOCOL_DISPLAY_NAME = 'Quad SPI';

const MIN_FRAME_LENGTH = 1;

const ERROR_EMPTY_FRAME = 'protocol.quadSpi.error.emptyFrame';
const ERROR_ABORTED = 'protocol.quadSpi.error.aborted';
const SUMMARY_TRANSACTION = 'protocol.quadSpi.summary.transaction';

export type QuadSpiFrameMetadata = {
  command: number;
  address: number | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface QuadSpiParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseQuadSpiFrame(data: Uint8Array, options: QuadSpiParseOptions): ParseResult {
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
  // kendi eksik baytları gösterilir).
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
  const metadata: QuadSpiFrameMetadata = {
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

export function parseQuadSpi(data: Uint8Array): ParseResult {
  return parseQuadSpiFrame(data, {});
}

export const quadSpiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: QuadSpiParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseQuadSpiFrame(data, options);
  },
};

/** "flash-fast-read" spec özetinin KENDİ örneği (`01-fiziksel-arayuzler.md:240`) birebir. */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'flash-fast-read',
    name: 'protocol.quadSpi.example.flashFastRead.name',
    // Spec'in kendi örneği: Command 0xEB (Fast Read Quad I/O), Address 0x001234, + temsili 4 bayt data.
    bytes: Uint8Array.from([0xeb, 0x00, 0x12, 0x34, 0xde, 0xad, 0xbe, 0xef]),
    description: 'protocol.quadSpi.example.flashFastRead.description',
    expectedValid: true,
  },
  {
    id: 'command-only',
    name: 'protocol.quadSpi.example.commandOnly.name',
    // Yalnız komut baytı — Address/Data hiç yok (ör. Write Enable 0x06 gibi adressiz komutlar).
    bytes: Uint8Array.from([0x06]),
    description: 'protocol.quadSpi.example.commandOnly.description',
    expectedValid: true,
  },
];

export const quadSpiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: quadSpiParser,
  documentation: {
    summary: 'protocol.quadSpi.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
