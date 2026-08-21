/**
 * SPI — register transaction decode. Faz 10 dalga 11b, sıralama önerisi #2
 * (spi+quad-spi+octal-spi). Framing motoruna (Faz 6) hiç uğramaz — CS ile
 * çerçevelenen tek transaction'lık bir yapı, delimiter/length kavramı yok.
 *
 * ── Kapsam kararı: Command baytının bit7'si R/W̄, 1 sabit Dummy bayt ──────
 * Spec özeti (`01-fiziksel-arayuzler.md:226,228`) İKİ bağımsız örnek veriyor,
 * ikisi de AYNI şekli paylaşıyor: `Command = registerAddress | 0x80` (okuma),
 * ardından TAM 1 dummy bayt, ardından dönen veri (`IMU register 0x75, read
 * bit=bit7` örneği: Command 0xF5 → dummy → RX 0x71). Bu toolkit'in SEÇTİĞİ
 * sabit konvansiyon budur — gerçek cihazlarda R/W̄ bitinin konumu/anlamı ve
 * dummy bayt sayısı DEĞİŞEBİLİR (bazı cihazlarda 0, bazılarında 2+); spec
 * yalnız bu tek örneği verdiği için ondan sapılmadı, uydurulmadı.
 *
 * `timing/spi.ts`teki `resolveSpiMode`/`calculateSpiTransferTime`/
 * `calculateSpiTransactionTiming` zaten yazılı ve `SpiTimingTool` (`calc.id
 * 'spi-timing'`) üzerinden çalışıyor — bu dosya yalnız DECODE'u ekliyor, motor
 * TEKRAR YAZILMADI (katalog kaydına `calculatorIds` eklendi).
 *
 * Full-duplex (MOSI+MISO eşzamanlı) TEK `bytes` dizisine indirgeniyor: her
 * fazın ANLAMLI yönü gösteriliyor (Command/Dummy = gönderilen, okuma
 * durumunda Data = alınan, yazma durumunda Data = gönderilen) — karşı hattın
 * o an "don't care" olan baytları hiç temsil edilmiyor. Bu, spec'in kendi
 * düzyazı anlatımıyla (`Sekans: CS LOW → TX 0xF5 → TX 0x00 (dummy) → RX dummy
 * → RX 0x71 → CS HIGH`) birebir aynı mantık.
 *
 * SPI'de CRC/bütünlük kontrolü YOK (bacnetmstp/one-wire'ın aksine) — bu
 * yüzden hata yolu yalnız "boş girdi" ile sınırlı, checksum-mismatch gibi bir
 * kavram burada anlamsız.
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

const PROTOCOL_ID = 'spi';
const PROTOCOL_DISPLAY_NAME = 'SPI';

const HEX_RADIX = 16;
const MIN_FRAME_LENGTH = 1;
const READ_WRITE_BIT = 0x80;
const REGISTER_ADDRESS_MASK = 0x7f;

const ERROR_EMPTY_FRAME = 'protocol.spi.error.emptyFrame';
const ERROR_ABORTED = 'protocol.spi.error.aborted';
const SUMMARY_READ = 'protocol.spi.summary.read';
const SUMMARY_WRITE = 'protocol.spi.summary.write';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export type SpiFrameMetadata = {
  isRead: boolean;
  registerAddress: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface SpiParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseSpiFrame(data: Uint8Array, options: SpiParseOptions): ParseResult {
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

  const commandByte = byteAt(data, 0);
  const isRead = (commandByte & READ_WRITE_BIT) !== 0;
  const registerAddress = commandByte & REGISTER_ADDRESS_MASK;

  fields.push({
    id: 'command',
    name: 'Command',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: commandByte,
    physicalValue: `${isRead ? 'Read' : 'Write'} · Register ${formatHexByte(registerAddress)}`,
    valid: true,
    warnings: [],
  });

  // Dosya başı kapsam kararı: okuma sırasında TAM 1 dummy bayt izler.
  const dummyPresent = isRead && data.length >= 2;
  const dataOffset = dummyPresent ? 2 : 1;

  if (dummyPresent) {
    fields.push({
      id: 'dummy',
      name: 'Dummy',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: byteAt(data, 1),
      valid: true,
      warnings: [],
    });
  }

  if (data.length > dataOffset) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: dataOffset,
      length: data.length - dataOffset,
      rawBytes: data.slice(dataOffset),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const summaryKey = isRead ? SUMMARY_READ : SUMMARY_WRITE;
  const summaryParams: Record<string, string> = { register: formatHexByte(registerAddress) };
  const metadata: SpiFrameMetadata = { isRead, registerAddress, summaryKey, summaryParams };

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

export function parseSpi(data: Uint8Array): ParseResult {
  return parseSpiFrame(data, {});
}

export const spiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** SPI'nin bayt seviyesinde ayırt edici bir imzası YOK (delimiter/preamble kavramı yok) — yalnız boş olmadığını kontrol eder. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: SpiParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseSpiFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — "register-read" spec özetinin KENDİ IMU örneği
 * (`01-fiziksel-arayuzler.md:228`) birebir; diğerleri simetriyle kurulmuş
 * (spec write örneği vermiyor, dosya başı disiplin notu).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'register-read',
    name: 'protocol.spi.example.registerRead.name',
    // Spec'in kendi IMU örneği: register 0x75, Command=0xF5, dummy, RX 0x71.
    bytes: Uint8Array.from([0xf5, 0x00, 0x71]),
    description: 'protocol.spi.example.registerRead.description',
    expectedValid: true,
  },
  {
    id: 'register-write',
    name: 'protocol.spi.example.registerWrite.name',
    // register-read ile simetrik: bit7=0 (write), dummy YOK, veri doğrudan izler.
    bytes: Uint8Array.from([0x75, 0xab]),
    description: 'protocol.spi.example.registerWrite.description',
    expectedValid: true,
  },
  {
    id: 'multi-byte-read',
    name: 'protocol.spi.example.multiByteRead.name',
    // Aynı register, 4 baytlık burst read — Data alanının birden çok baytı taşıdığını gösterir.
    bytes: Uint8Array.from([0xf5, 0x00, 0x71, 0x1a, 0x00, 0x42]),
    description: 'protocol.spi.example.multiByteRead.description',
    expectedValid: true,
  },
];

export const spiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: spiParser,
  documentation: {
    summary: 'protocol.spi.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
