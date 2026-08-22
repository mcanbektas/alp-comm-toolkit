/**
 * SMBus — transaction türü + PEC çözümü. Faz 10 dalga 11i (sıralama önerisi #8,
 * `brief-faz10-dalga11.md:126`). İskelet `smbusCore.ts`te (pmbus.ts ile
 * PAYLAŞILIR); bu dosya iskeleti alan tablosuna ve örnek çerçevelere çevirir.
 *
 * Katalogda `layer:'data-link'` olan TEK interfaces-framing kaydı bu — I²C'nin
 * elektriksel katmanının üstünde kapalı bir transaction kümesi tanımladığı için
 * (brief tablosu, `:80`).
 *
 * Spec özetinin PEC panelinden istediği beş alanın hepsi karşılanıyor:
 * Packet Bytes (hex viewer), PEC Input Coverage (`pecCoverage` metadata +
 * PEC alanının açıklaması), Calculated PEC, Received PEC, PASS/FAIL
 * (PEC alanının `valid` bayrağı ve uyarı).
 *
 * `timing/i2c.ts` (Faz 5) elektriksel temeli zaten hesaplıyor — SMBus kaydına
 * `calculatorIds:['i2c-timing']` eklendi, motor TEKRAR YAZILMADI. Timeout /
 * clock-LOW izleme KAPSAM DIŞI (gerekçe `smbusCore.ts` dosya başında).
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
  computeSmbusPec,
  formatAddress,
  formatHexByte,
  splitSmbusTransaction,
  type SmbusStructure,
  type SmbusTransactionKind,
} from './smbusCore';

const PROTOCOL_ID = 'smbus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SMBus';

const MIN_FRAME_LENGTH = 1;

const ERROR_EMPTY_FRAME = 'protocol.smbus.error.emptyFrame';
const ERROR_ABORTED = 'protocol.smbus.error.aborted';
const WARNING_PEC_INFERRED = 'protocol.smbus.warning.pecInferred';
const WARNING_AMBIGUOUS = 'protocol.smbus.warning.ambiguousShape';
const WARNING_UNKNOWN_SHAPE = 'protocol.smbus.warning.unknownShape';

/** Transaction adları spec özetinin KENDİ listesindeki yazımlar — veri, çeviriye girmez. */
const TRANSACTION_NAMES: Record<SmbusTransactionKind, string> = {
  'quick-command': 'Quick Command',
  'send-byte': 'Send Byte',
  'receive-byte': 'Receive Byte',
  'write-byte': 'Write Byte',
  'read-byte': 'Read Byte',
  'write-word': 'Write Word',
  'read-word': 'Read Word',
  'process-call': 'Process Call',
  'block-write': 'Block Write',
  'block-read': 'Block Read',
  'block-write-block-read': 'Block Write-Block Read Process Call',
  unknown: 'Unrecognised',
};

export function transactionName(kind: SmbusTransactionKind): string {
  return TRANSACTION_NAMES[kind];
}

export type SmbusFrameMetadata = {
  address7bit: number;
  kind: SmbusTransactionKind;
  transactionName: string;
  commandCode?: number;
  pecPresent: boolean;
  pecValid: boolean;
  pecCoverageBytes: number;
  pecCalculated: string;
  pecReceived?: string;
  alternativeKinds: readonly string[];
};

interface SmbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function dataField(
  id: string,
  name: string,
  bytes: Uint8Array,
  offset: number,
): ParsedField {
  return {
    id,
    name,
    offset,
    length: bytes.length,
    rawBytes: bytes,
    unit: 'B',
    valid: true,
    warnings: [],
  };
}

/**
 * İskeletten alan tablosu kurar. Ofsetler PEC ÇIKARILMIŞ gövdeye göre
 * hesaplanır ama PEC baytı da kendi alanıyla tabloda görünür — hex viewer'ın
 * renklendirmesi çerçevenin tamamını kapsasın diye.
 */
export function buildSmbusFields(structure: SmbusStructure): ParsedField[] {
  const fields: ParsedField[] = [];
  const { body, pec } = structure;

  fields.push({
    id: 'address',
    name: 'Address',
    offset: 0,
    length: 1,
    rawBytes: body.slice(0, 1),
    rawValue: structure.addressByte,
    physicalValue: formatAddress(structure.addressByte),
    valid: true,
    warnings: [],
  });

  if (structure.commandCode !== undefined) {
    fields.push({
      id: 'command',
      name: 'Command Code',
      offset: 1,
      length: 1,
      rawBytes: body.slice(1, 2),
      rawValue: structure.commandCode,
      physicalValue: formatHexByte(structure.commandCode),
      valid: true,
      warnings: [],
    });
  }

  const writeOffset = structure.commandCode === undefined ? 1 : 2;
  if (structure.writeData.length > 0) {
    fields.push(dataField('writeData', 'Write Data', structure.writeData, writeOffset));
  }

  if (structure.repeatedStartOffset !== undefined) {
    const offset = structure.repeatedStartOffset;
    fields.push({
      id: 'repeatedAddress',
      name: 'Repeated START · Address',
      offset,
      length: 1,
      rawBytes: body.slice(offset, offset + 1),
      rawValue: body[offset] ?? 0,
      physicalValue: formatAddress(body[offset] ?? 0),
      valid: true,
      warnings: [],
    });
    if (structure.readData.length > 0) {
      fields.push(dataField('readData', 'Read Data', structure.readData, offset + 1));
    }
  }

  if (pec.present) {
    const offset = body.length;
    fields.push({
      id: 'pec',
      name: 'PEC',
      offset,
      length: 1,
      rawBytes: Uint8Array.from([pec.received ?? 0]),
      rawValue: pec.received ?? 0,
      // Spec'in PEC panelinden istediği "Calculated / Received / Coverage" üçlüsü.
      physicalValue: `PASS · ${formatHexByte(pec.calculated)} · ${pec.coverageBytes} B`,
      valid: true,
      warnings: [],
    });
  }

  return fields;
}

function parseSmbusFrame(data: Uint8Array, options: SmbusParseOptions): ParseResult {
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

  const structure = splitSmbusTransaction(data);
  const fields = buildSmbusFields(structure);
  const warnings: ProtocolWarning[] = [];

  // PEC "var" kararı CRC tutmasından ÇIKARILDI (1/256 yanlış pozitif) — gizlenmez.
  if (structure.pec.present) {
    warnings.push({
      code: 'pec-inferred',
      message: WARNING_PEC_INFERRED,
      offset: structure.body.length,
      length: 1,
    });
  }
  if (structure.alternativeKinds.length > 0) {
    warnings.push({ code: 'ambiguous-shape', message: WARNING_AMBIGUOUS, offset: 0, length: structure.body.length });
  }
  if (structure.kind === 'unknown') {
    warnings.push({ code: 'unknown-shape', message: WARNING_UNKNOWN_SHAPE, offset: 0, length: structure.body.length });
  }

  const metadata: SmbusFrameMetadata = {
    address7bit: structure.address7bit,
    kind: structure.kind,
    transactionName: transactionName(structure.kind),
    ...(structure.commandCode === undefined ? {} : { commandCode: structure.commandCode }),
    pecPresent: structure.pec.present,
    pecValid: structure.pec.present,
    pecCoverageBytes: structure.pec.coverageBytes,
    pecCalculated: formatHexByte(structure.pec.calculated),
    ...(structure.pec.received === undefined
      ? {}
      : { pecReceived: formatHexByte(structure.pec.received) }),
    alternativeKinds: structure.alternativeKinds.map(transactionName),
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

export function parseSmbus(data: Uint8Array): ParseResult {
  return parseSmbusFrame(data, {});
}

export const smbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** I²C gibi bayt seviyesinde ayırt edici imzası yok — yalnız boş olmadığı kontrol edilir. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: SmbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseSmbusFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. `read-word` spec özetinin KENDİ örneğinin bayt karşılığı
 * (`S, SlaveAddr+W, ACK, Command, ACK, Sr, SlaveAddr+R, ACK, DataLow, ACK,
 * DataHigh, NACK, P` — adres 0x5A, komut 0x8B seçildi; spec adres/komut sayısı
 * VERMİYOR, bu ikisi temsilî). PEC baytları `computeSmbusPec` ile BAĞIMSIZCA
 * hesaplandı (1-Wire ROM CRC'sindeki disiplin: elle uydurulmuş sağlama yok).
 */
const READ_WORD_BODY = Uint8Array.from([0xb4, 0x8b, 0xb5, 0xf3, 0x19]);
const BLOCK_READ_BODY = Uint8Array.from([0xb4, 0x44, 0xb5, 0x04, 0xde, 0xad, 0xbe, 0xef]);

function withPec(body: Uint8Array): Uint8Array {
  return Uint8Array.from([...body, computeSmbusPec(body)]);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-word-pec',
    name: 'protocol.smbus.example.readWordPec.name',
    bytes: withPec(READ_WORD_BODY),
    description: 'protocol.smbus.example.readWordPec.description',
    expectedValid: true,
  },
  {
    id: 'write-byte',
    name: 'protocol.smbus.example.writeByte.name',
    // PEC YOK: aynı iskeletin PEC'siz biçimi (SMBus §6.5 her protokolü iki
    // biçimde tanımlar) — panel "hesaplanan PEC" sütununu yine gösterir.
    bytes: Uint8Array.from([0xb4, 0x00, 0x01]),
    description: 'protocol.smbus.example.writeByte.description',
    expectedValid: true,
  },
  {
    id: 'quick-command',
    name: 'protocol.smbus.example.quickCommand.name',
    bytes: Uint8Array.from([0xb4]),
    description: 'protocol.smbus.example.quickCommand.description',
    expectedValid: true,
  },
  {
    id: 'block-read-pec',
    name: 'protocol.smbus.example.blockReadPec.name',
    bytes: withPec(BLOCK_READ_BODY),
    description: 'protocol.smbus.example.blockReadPec.description',
    expectedValid: true,
  },
];

export const smbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: smbusParser,
  documentation: {
    summary: 'protocol.smbus.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
