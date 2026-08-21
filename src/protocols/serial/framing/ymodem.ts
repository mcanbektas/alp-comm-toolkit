/**
 * YMODEM — `xmodemCore.ts`nin (bu dalga, PAYLAŞILAN çekirdek — XMODEM de
 * kullanıyor) ÜSTÜNDE ince ProtocolPlugin sarmalı. Blok yapısı XMODEM ile
 * BİREBİR AYNI (Header/Block/~Block/Data/Checksum-CRC) — motor
 * PAYLAŞILIYOR, yalnız Block 0'ın YORUMU farklı: dosya adı/boyutu taşıyan
 * bir metadata bloğu (spec `02-framing-protokolleri.md` satır 261-262).
 *
 * **Block 0 encoding — dar/güvenilir alt küme, gerisi HAM:** spec dosya
 * adını (NUL'e kadar ASCII) ve onu izleyen ilk alanı (boşluk/NUL'e kadar
 * ASCII decimal — dosya boyutu) NET veriyor, ama mtime/mode/serial
 * alanlarının genişliğini/tabanını (octal mi decimal mi) hiç vermiyor —
 * gerçek YMODEM implementasyonları arasında da bu alanlar tutarsız
 * (bazı gönderenler yalnız filename+size gönderir). Bu yüzden filename+
 * filesize ÇÖZÜLÜR, ondan sonrası "metadata-remainder" olarak HAM bırakılır
 * — ezberden mtime/mode formatı uydurmak yanlış değer basma riski taşır
 * (KISS Persistence formülü/PPP LCP 12+ kodlarının aynı disiplini,
 * dalga 10b). Boş dosya adı (Block 0'ın ilk baytı 0x00) — batch'in
 * bitişini işaretleyen standart terminatör, AYRICA adlanır.
 *
 * Framing motoruna (Faz 6) hiç UĞRAMAZ — `xmodemCore.ts`nin dosya başında
 * aynı gerekçe. Batch/oturum durumu (kaç dosya, hangi sırada) bu motorun
 * işi DEĞİL — `ProtocolParser.parse()` tek bir bloğu, saf/stateless çözer
 * (PPP'nin LCP oturum takibini ERTELEMESİYLE aynı disiplin, dalga 10b).
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { encodeXmodemBlock, hexByte, hexString, hexWord, parseXmodemFrame } from './xmodemCore';

const PROTOCOL_ID = 'ymodem';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'YMODEM';

const TRANSLATION_KEY_PREFIX = 'protocol.ymodem';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_UNKNOWN_HEADER = `${TRANSLATION_KEY_PREFIX}.error.unknownHeader`;
const ERROR_BAD_TRAILER_LENGTH = `${TRANSLATION_KEY_PREFIX}.error.badTrailerLength`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_COMPLEMENT_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.complementMismatch`;
const ERROR_CHECKSUM_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.checksumMismatch`;
const ERROR_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.crcMismatch`;

function findByte(data: Uint8Array, target: number, from: number): number {
  for (let i = from; i < data.length; i += 1) {
    if (data[i] === target) return i;
  }
  return -1;
}

function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

interface BlockZeroMetadata {
  readonly isTerminator: boolean;
  readonly filename: string;
  readonly filesizeText?: string;
  readonly filesizeBytes?: number;
  readonly filenameEnd: number;
  readonly filesizeStart: number;
  readonly filesizeEnd: number;
  readonly remainderStart: number;
}

/** Spec satır 261-262 — filename(NUL) + filesize(boşluk/NUL'e kadar ASCII decimal), gerisi ham. */
function parseBlockZeroMetadata(data: Uint8Array): BlockZeroMetadata {
  const nul1 = findByte(data, 0x00, 0);
  const filenameEnd = nul1 === -1 ? data.length : nul1;
  if (filenameEnd === 0) {
    return { isTerminator: true, filename: '', filenameEnd: 0, filesizeStart: 0, filesizeEnd: 0, remainderStart: nul1 === -1 ? 0 : nul1 + 1 };
  }

  const filename = latin1(data.slice(0, filenameEnd));
  if (nul1 === -1) {
    return { isTerminator: false, filename, filenameEnd, filesizeStart: data.length, filesizeEnd: data.length, remainderStart: data.length };
  }

  const filesizeStart = nul1 + 1;
  let filesizeEnd = filesizeStart;
  while (filesizeEnd < data.length) {
    const byte = data[filesizeEnd];
    if (byte === undefined || byte === 0x20 || byte === 0x00) break;
    filesizeEnd += 1;
  }
  const filesizeText = latin1(data.slice(filesizeStart, filesizeEnd));
  const filesizeBytes = /^[0-9]+$/.test(filesizeText) ? Number.parseInt(filesizeText, 10) : undefined;

  return {
    isTerminator: false,
    filename,
    filenameEnd,
    filesizeStart,
    filesizeEnd,
    filesizeText: filesizeText.length > 0 ? filesizeText : undefined,
    filesizeBytes,
    remainderStart: filesizeEnd,
  };
}

function parseYmodem(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }

  const result = parseXmodemFrame(data);
  if (!result.ok) {
    if (result.reason === 'empty') {
      return {
        success: false,
        error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
        consumedBytes: 0,
        recoverable: true,
      };
    }
    if (result.reason === 'unknown-header') {
      return {
        success: false,
        error: { code: 'unsupported-encoding', message: ERROR_UNKNOWN_HEADER, offset: 0, length: 1 },
        consumedBytes: 0,
        recoverable: false,
      };
    }
    return {
      success: false,
      error: { code: 'length-mismatch', message: ERROR_BAD_TRAILER_LENGTH, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  let valid = true;

  const { frame: xmodemFrame } = result;
  if (xmodemFrame.kind === 'control') {
    fields.push({
      id: 'control',
      name: 'Control Byte',
      offset: 0,
      length: 1,
      rawBytes: data,
      rawValue: hexByte(xmodemFrame.byte),
      physicalValue: xmodemFrame.name,
      valid: true,
      warnings: [],
    });
  } else {
    fields.push({
      id: 'header',
      name: 'Header',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: hexByte(xmodemFrame.header),
      physicalValue: xmodemFrame.dataLength === 128 ? 'SOH — 128-byte block' : 'STX — 1024-byte block (YMODEM-1K)',
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'block-number',
      name: 'Block Number',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: xmodemFrame.block,
      physicalValue: xmodemFrame.block === 0 ? 'Block 0 — batch metadata' : undefined,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'block-complement',
      name: 'Block Number Complement (~Block)',
      offset: 2,
      length: 1,
      rawBytes: data.slice(2, 3),
      rawValue: hexByte(xmodemFrame.blockComplement),
      physicalValue: xmodemFrame.complementValid ? 'valid' : `MISMATCH — expected ${hexByte(xmodemFrame.block ^ 0xff)}`,
      valid: xmodemFrame.complementValid,
      warnings: xmodemFrame.complementValid ? [] : [ERROR_COMPLEMENT_MISMATCH],
    });
    if (!xmodemFrame.complementValid) {
      valid = false;
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_COMPLEMENT_MISMATCH,
        offset: 2,
        length: 1,
        details: { block: xmodemFrame.block, complement: xmodemFrame.blockComplement },
      });
    }

    if (xmodemFrame.block === 0) {
      const metadata = parseBlockZeroMetadata(xmodemFrame.data);
      if (metadata.isTerminator) {
        fields.push({
          id: 'batch-terminator',
          name: 'Batch Terminator',
          offset: 3,
          length: xmodemFrame.dataLength,
          rawBytes: xmodemFrame.data,
          rawValue: hexString(xmodemFrame.data.slice(0, 8)),
          physicalValue: 'Empty filename — end of batch (no more files)',
          valid: true,
          warnings: [],
        });
      } else {
        fields.push({
          id: 'filename',
          name: 'Filename',
          offset: 3,
          length: metadata.filenameEnd,
          rawBytes: xmodemFrame.data.slice(0, metadata.filenameEnd),
          rawValue: metadata.filename,
          valid: true,
          warnings: [],
        });
        if (metadata.filesizeText !== undefined) {
          fields.push({
            id: 'filesize',
            name: 'Filesize',
            offset: 3 + metadata.filesizeStart,
            length: metadata.filesizeEnd - metadata.filesizeStart,
            rawBytes: xmodemFrame.data.slice(metadata.filesizeStart, metadata.filesizeEnd),
            rawValue: metadata.filesizeText,
            physicalValue: metadata.filesizeBytes,
            unit: metadata.filesizeBytes === undefined ? undefined : 'B',
            valid: true,
            warnings: [],
          });
        }
        if (metadata.remainderStart < xmodemFrame.dataLength) {
          const remainder = xmodemFrame.data.slice(metadata.remainderStart);
          fields.push({
            id: 'metadata-remainder',
            name: 'Metadata Remainder',
            offset: 3 + metadata.remainderStart,
            length: remainder.length,
            rawBytes: remainder,
            rawValue: hexString(remainder),
            physicalValue: '(raw — mtime/mode/serial encoding not standardized, not decoded)',
            valid: true,
            warnings: [],
          });
        }
      }
    } else {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: 3,
        length: xmodemFrame.dataLength,
        rawBytes: xmodemFrame.data,
        rawValue: hexString(xmodemFrame.data),
        physicalValue: `${xmodemFrame.dataLength} bytes`,
        valid: true,
        warnings: [],
      });
    }

    const trailerOffset = 3 + xmodemFrame.dataLength;
    if (xmodemFrame.mode === 'checksum') {
      fields.push({
        id: 'checksum',
        name: 'Checksum',
        offset: trailerOffset,
        length: 1,
        rawBytes: xmodemFrame.trailer,
        rawValue: hexByte(xmodemFrame.received),
        physicalValue: xmodemFrame.integrityValid ? `PASS (${hexByte(xmodemFrame.calculated)})` : `FAIL (${hexByte(xmodemFrame.calculated)})`,
        valid: xmodemFrame.integrityValid,
        warnings: [],
      });
      if (!xmodemFrame.integrityValid) {
        valid = false;
        errors.push({
          code: 'checksum-mismatch',
          message: ERROR_CHECKSUM_MISMATCH,
          offset: trailerOffset,
          length: 1,
          details: { received: xmodemFrame.received, calculated: xmodemFrame.calculated },
        });
      }
    } else {
      fields.push({
        id: 'crc',
        name: 'CRC-16',
        offset: trailerOffset,
        length: 2,
        rawBytes: xmodemFrame.trailer,
        rawValue: hexWord(xmodemFrame.received),
        physicalValue: xmodemFrame.integrityValid ? `PASS (${hexWord(xmodemFrame.calculated)})` : `FAIL (${hexWord(xmodemFrame.calculated)})`,
        valid: xmodemFrame.integrityValid,
        warnings: [],
      });
      if (!xmodemFrame.integrityValid) {
        valid = false;
        errors.push({
          code: 'crc-mismatch',
          message: ERROR_CRC_MISMATCH,
          offset: trailerOffset,
          length: 2,
          details: { received: xmodemFrame.received, calculated: xmodemFrame.calculated },
        });
      }
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export const ymodemParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseYmodem(data, context);
  },
};

/** `encodeXmodemBlock`in tek-parametreli `ProtocolEncoder` şekline sarmalı — Block 1 (dosya verisi), CRC modu. */
function encodeYmodemDataBlock(data: Uint8Array): Uint8Array {
  return encodeXmodemBlock(1, data, 'crc');
}

function encodeBlockZero(filename: string, filesize: number, dataLength: 128 | 1024): Uint8Array {
  const header = Uint8Array.from([
    ...Array.from(filename, (char) => char.charCodeAt(0)),
    0x00,
    ...Array.from(String(filesize), (char) => char.charCodeAt(0)),
  ]);
  const padded = new Uint8Array(dataLength);
  padded.set(header.slice(0, dataLength));
  return padded;
}

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'block-zero-metadata',
    // Block 0 — dosya adı + boyut, CRC modu.
    name: `${TRANSLATION_KEY_PREFIX}.example.blockZeroMetadata.name`,
    bytes: encodeXmodemBlock(0, encodeBlockZero('firmware.bin', 32768, 128), 'crc'),
    description: `${TRANSLATION_KEY_PREFIX}.example.blockZeroMetadata.description`,
    expectedValid: true,
  },
  {
    id: 'batch-terminator',
    // Block 0, boş dosya adı — batch'in bitişi.
    name: `${TRANSLATION_KEY_PREFIX}.example.batchTerminator.name`,
    bytes: encodeXmodemBlock(0, new Uint8Array(128), 'crc'),
    description: `${TRANSLATION_KEY_PREFIX}.example.batchTerminator.description`,
    expectedValid: true,
  },
  {
    id: 'data-block',
    // Block 1 — normal dosya verisi, XMODEM'in kendisiyle aynı yapı.
    name: `${TRANSLATION_KEY_PREFIX}.example.dataBlock.name`,
    bytes: encodeXmodemBlock(1, new Uint8Array(128).fill(0xaa), 'crc'),
    description: `${TRANSLATION_KEY_PREFIX}.example.dataBlock.description`,
    expectedValid: true,
  },
];

export const ymodemPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: ymodemParser,
  encoder: { encode: encodeYmodemDataBlock },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
