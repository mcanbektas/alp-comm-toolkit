/**
 * KISS (TAPR/AX.25 TNC arayüz protokolü) — `protocol-core/framing/slip.ts`nin
 * (Faz 6) ÜSTÜNDE ince bir `ProtocolPlugin` sarmalı. Çerçeveleme baytları
 * SLIP'le BİREBİR AYNI (FEND=0xC0/FESC=0xDB/TFEND=0xDC/TFESC=0xDD) — motor
 * TEKRAR YAZILMADI, `slipExtractor`/`encodeSlip` doğrudan kullanılıyor.
 * KISS'in KENDİ yeni işi: çözülmüş içeriğin ilk baytı (Type Indicator —
 * yüksek yarım bayt port, düşük yarım bayt komut) adlanır; geri kalanı v1'de
 * HAM kalır — Data Frame'in taşıdığı AX.25 paketi bu dalgada hiç çözülmez
 * (brief-faz10-dalga10.md, 10b: "AX.25 hiç yok, v1 ham kalabilir"), katalogun
 * "AX.25 Chain Decode" aracı kasıtlı olarak ERTELENDİ (COBS'un kendi
 * "COBS + CRC Pipeline" ertelemesiyle aynı disiplin, cobs.ts satır 236-237).
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { SLIP_END, SLIP_ESCAPE_RULE, encodeSlip, slipExtractor } from '@/protocol-core/framing/slip';
import { mapFramingError } from './framingErrorMapping';

const PROTOCOL_ID = 'kiss';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'KISS';

const TRANSLATION_KEY_PREFIX = 'protocol.kiss';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;
const WARN_UNKNOWN_COMMAND = `${TRANSLATION_KEY_PREFIX}.warning.unknownCommand`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

function hexByte(byte: number): string {
  return `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
}

function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** TAPR KISS spec — düşük yarım bayt komut adları (yüksek yarım bayt = port numarası). */
const KISS_COMMAND_NAMES: Readonly<Record<number, string>> = {
  0: 'Data Frame',
  1: 'TXDELAY',
  2: 'Persistence (P)',
  3: 'SlotTime',
  4: 'TXtail',
  5: 'FullDuplex',
  6: 'SetHardware',
};

/** Tüm bayt 0xFF — port/komut yarım baytlarına AYRIŞTIRILMAZ, spec'in kendi ayrı sentinel'i. */
const KISS_RETURN_BYTE = 0xff;

/** 10ms birimi taşıyan komutlar (TAPR spec) — TXDELAY/SlotTime/TXtail. */
const TEN_MS_UNIT_COMMANDS = new Set([1, 3, 4]);

interface DecodedPosition {
  readonly wireOffset: number;
  readonly wireLength: number;
}

/**
 * Kaçarılmış (escaped) her tel baytını, çözülmüş `result.frame`deki hangi
 * bayta karşılık geldiğine eşler — `slipExtractor` yalnız çözülmüş içeriği
 * döndürür, hangi çözülmüş baytın hangi tel konumundan geldiğini söylemez.
 * `status: 'complete'` sonrası çağrılır (kaçış zaten doğrulanmış). Tek bir
 * `findEscapeEvents` olayına değil, Type Indicator/Payload gibi BİRDEN ÇOK
 * baytlık alanların tel konumuna da ihtiyaç var — bu tablo herhangi bir
 * çözülmüş bayt ARALIĞINI tel konumuna çevirmeyi sağlar (bkz. `buildField`).
 */
function mapDecodedPositions(wireContent: Uint8Array, escapeByte: number): DecodedPosition[] {
  const positions: DecodedPosition[] = [];
  let i = 0;
  while (i < wireContent.length) {
    if (wireContent[i] === escapeByte && i + 1 < wireContent.length) {
      positions.push({ wireOffset: i, wireLength: 2 });
      i += 2;
    } else {
      positions.push({ wireOffset: i, wireLength: 1 });
      i += 1;
    }
  }
  return positions;
}

/** Çözülmüş bayt aralığı `[startIndex, endIndex)`i wireContent-GÖRELİ konuma çevirir. */
function decodedRangeToWire(
  positions: DecodedPosition[],
  startIndex: number,
  endIndex: number,
): { relativeOffset: number; length: number } {
  const first = positions[startIndex];
  if (first === undefined) return { relativeOffset: 0, length: 0 };
  const last = positions[endIndex - 1];
  if (last === undefined) return { relativeOffset: first.wireOffset, length: 0 };
  return { relativeOffset: first.wireOffset, length: last.wireOffset + last.wireLength - first.wireOffset };
}

interface FieldContext {
  readonly wireContent: Uint8Array;
  readonly positions: DecodedPosition[];
  readonly searchStart: number;
}

function buildField(
  ctx: FieldContext,
  id: string,
  name: string,
  startIndex: number,
  endIndex: number,
  rawValue: ParsedField['rawValue'],
  extra: { physicalValue?: ParsedField['physicalValue']; warnings?: string[]; valid?: boolean } = {},
): ParsedField {
  const range = decodedRangeToWire(ctx.positions, startIndex, endIndex);
  const field: ParsedField = {
    id,
    name,
    offset: ctx.searchStart + range.relativeOffset,
    length: range.length,
    rawBytes: ctx.wireContent.slice(range.relativeOffset, range.relativeOffset + range.length),
    rawValue,
    valid: extra.valid ?? true,
    warnings: extra.warnings ?? [],
  };
  if (extra.physicalValue !== undefined) field.physicalValue = extra.physicalValue;
  return field;
}

/**
 * `SLIP_ESCAPE_RULE.substitutions`in TERSİ — slip.ts'teki `findEscapeEvents`ın
 * BİREBİR AYNISI (KISS SLIP'in kendi kuralını kullanıyor). Ayrı dosyada
 * tekrarlanması cobs.ts/slip.ts'in kendi kendine yeten dosya konvansiyonuyla
 * tutarlı — motor PAYLAŞILIYOR (`slipExtractor`), gösterim yardımcı
 * fonksiyonu PAYLAŞILMIYOR.
 */
const REVERSE_SUBSTITUTIONS = new Map(
  [...(SLIP_ESCAPE_RULE.substitutions?.entries() ?? [])].map(([original, substitute]) => [substitute, original]),
);

function findEscapeEvents(wireContent: Uint8Array, wireOffset: number): ParsedField[] {
  const events: ParsedField[] = [];
  const escapeByte = SLIP_ESCAPE_RULE.escapeByte;
  let i = 0;
  let index = 0;
  while (i < wireContent.length) {
    const current = wireContent[i];
    if (current === escapeByte) {
      const next = wireContent[i + 1];
      const decoded = next === undefined ? undefined : REVERSE_SUBSTITUTIONS.get(next);
      if (next !== undefined && decoded !== undefined) {
        events.push({
          id: `escape-event-${index}`,
          name: 'Escape Sequence',
          offset: wireOffset + i,
          length: 2,
          rawBytes: wireContent.slice(i, i + 2),
          rawValue: `${hexByte(escapeByte)} ${hexByte(next)}`,
          physicalValue: hexByte(decoded),
          valid: true,
          warnings: [],
        });
        index += 1;
        i += 2;
        continue;
      }
    }
    i += 1;
  }
  return events;
}

function describeTypeIndicator(byte: number): { name: string; warnings: string[] } {
  if (byte === KISS_RETURN_BYTE) {
    return { name: 'Return (exit KISS mode)', warnings: [] };
  }
  const port = (byte >> 4) & 0x0f;
  const command = byte & 0x0f;
  const commandName = KISS_COMMAND_NAMES[command];
  if (commandName === undefined) {
    return { name: `Port ${port} — Reserved/Unknown Command (${command})`, warnings: [WARN_UNKNOWN_COMMAND] };
  }
  return { name: `Port ${port} — ${commandName}`, warnings: [] };
}

function describePayload(command: number, payload: Uint8Array): string {
  if (command === 0) {
    return `AX.25 frame payload, ${payload.length} bytes (raw — not decoded by this engine)`;
  }
  if (TEN_MS_UNIT_COMMANDS.has(command) && payload.length === 1) {
    const value = payload[0] ?? 0;
    return `${value * 10} ms (raw value ${value} × 10ms unit)`;
  }
  if (command === 2) {
    return `Persistence parameter, raw byte ${hexString(payload)} (0-255, TNC-specific probability mapping)`;
  }
  if (command === 5 && payload.length === 1) {
    return (payload[0] ?? 0) === 0 ? 'Half Duplex (0)' : `Full Duplex (${payload[0]})`;
  }
  if (command === 6) {
    return `Hardware-specific data, ${payload.length} bytes (opaque — TNC vendor defined)`;
  }
  return `${payload.length} bytes (raw)`;
}

function parseKissFrame(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = context?.maxFrameLength ?? data.length;
  const result = slipExtractor.extract(data, { maxFrameLength });

  if (result.status === 'incomplete') {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_NO_DELIMITER, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (result.status === 'error') {
    const mapped = mapFramingError(result.error);
    return {
      success: false,
      error: { code: mapped.code, message: mapped.message, offset: mapped.offset },
      consumedBytes: result.consumedBytes,
      recoverable: result.recoverable,
    };
  }

  // result.status === 'complete' — motor boş çerçeveyi (art arda iki FEND)
  // zaten 'error' olarak reddediyor (escapedDelimiterFraming.ts:65-75), bu
  // yüzden decoded.length burada her zaman >= 1.
  const searchStart = data[0] === SLIP_END ? 1 : 0;
  const delimiterIndex = result.consumedBytes - 1;
  const wireContent = data.subarray(searchStart, delimiterIndex);
  const decoded = result.frame;
  const positions = mapDecodedPositions(wireContent, SLIP_ESCAPE_RULE.escapeByte);
  const ctx: FieldContext = { wireContent, positions, searchStart };

  const fields: ParsedField[] = [];

  if (searchStart === 1) {
    fields.push({
      id: 'leading-fend',
      name: 'Leading FEND (optional flush)',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: 'FEND',
      valid: true,
      warnings: [],
    });
  }

  fields.push(...findEscapeEvents(wireContent, searchStart));

  const warnings: ProtocolWarning[] = [];
  const typeByte = decoded[0];
  // noUncheckedIndexedAccess: yukarıdaki motor garantisi yüzünden decoded[0]
  // pratikte HER ZAMAN tanımlı — yine de tip disiplinini koru.
  if (typeByte !== undefined) {
    const described = describeTypeIndicator(typeByte);
    fields.push(
      buildField(ctx, 'type-indicator', 'Type Indicator (Port/Command)', 0, 1, hexByte(typeByte), {
        physicalValue: described.name,
        warnings: described.warnings,
      }),
    );
    for (const warningCode of described.warnings) warnings.push(toProtocolWarning(warningCode));

    if (decoded.length > 1) {
      const payload = decoded.slice(1);
      const command = typeByte === KISS_RETURN_BYTE ? -1 : typeByte & 0x0f;
      fields.push(
        buildField(ctx, 'payload', 'Payload', 1, decoded.length, hexString(payload), {
          physicalValue: describePayload(command, payload),
        }),
      );
    }
  }

  fields.push({
    id: 'trailing-fend',
    name: 'Trailing FEND',
    offset: delimiterIndex,
    length: 1,
    rawBytes: data.slice(delimiterIndex, delimiterIndex + 1),
    rawValue: 'FEND',
    valid: true,
    warnings: [],
  });

  if (result.consumedBytes < data.length) {
    const trailingOffset = result.consumedBytes;
    fields.push({
      id: 'trailing-bytes',
      name: 'Trailing Bytes (after frame)',
      offset: trailingOffset,
      length: data.length - trailingOffset,
      rawBytes: data.slice(trailingOffset),
      rawValue: hexString(data.slice(trailingOffset)),
      valid: true,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
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
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export const kissParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseKissFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'data-frame',
    name: `${TRANSLATION_KEY_PREFIX}.example.dataFrame.name`,
    bytes: encodeSlip(Uint8Array.from([0x00, 0x11, 0x22, 0x33])),
    description: `${TRANSLATION_KEY_PREFIX}.example.dataFrame.description`,
    expectedValid: true,
  },
  {
    id: 'txdelay-command',
    name: `${TRANSLATION_KEY_PREFIX}.example.txdelayCommand.name`,
    bytes: encodeSlip(Uint8Array.from([0x01, 0x32])),
    description: `${TRANSLATION_KEY_PREFIX}.example.txdelayCommand.description`,
    expectedValid: true,
  },
  {
    id: 'escaped-data-frame',
    // escaping.test.ts:51'in DOĞRULANMIŞ KISS fixture'ı (11 C0 22 DB 33), Type
    // Indicator'ın (0x00) önüne eklendi — kaçış motoru SLIP'le BİREBİR aynı.
    name: `${TRANSLATION_KEY_PREFIX}.example.escapedDataFrame.name`,
    bytes: encodeSlip(Uint8Array.from([0x00, 0x11, 0xc0, 0x22, 0xdb, 0x33])),
    description: `${TRANSLATION_KEY_PREFIX}.example.escapedDataFrame.description`,
    expectedValid: true,
  },
];

export const kissPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: kissParser,
  encoder: { encode: encodeSlip },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [
      { title: 'The KISS TNC: A simple Host-to-TNC communications protocol', url: 'https://www.ax25.net/kiss.aspx' },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
