/**
 * ISO 9141-2 — sabit 3 baytlık header + veri + checksum zarfının çözümü.
 *
 * GİRDİ HAM ISO 9141-2 MESAJ BAYTIDIR: `0x68 0x6A SRC veri… CHECKSUM`. K-Line'ın
 * fiziksel katmanı (5-baud init, key bytes, hat zamanlaması) bir bayt akışı
 * DEĞİLDİR — decoder'a HİÇ girmez (K-Line kararı, brief-faz10-dalga2.md: motor
 * ALMAZ, `planned` kalır; init bir bayt akışı değil hat olayıdır). Veri bölümü
 * (SAE J1979 Mode+PID modeli) HAM kalır — mevcut `obd-ii` motoru bu içeriği
 * zaten çözüyor, zincir parser seviyesinde KURULMAZ (dalga 1 kararının aynısı,
 * DoIP'in UDS payload'ı gibi).
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * Bu deponun `docs/spec/` dosyası ISO 9141 için bayt düzeyinde SIFIR veri
 * içeriyor (brief-faz10-dalga2.md: `0x08 0x08` / `0x94 0x94` hiç geçmiyor).
 * Aşağıdaki header/checksum düzeni DIŞ KAYNAKTIR: freediag projesinin yol
 * testinden geçmiş çözümleyici kaynağı (`diag_l2_iso9141.c`), Wikipedia ISO 9141
 * maddesi ve bağımsız ikinci kaynaklarla çapraz doğrulandı (brief-faz10-dalga2b.md
 * doğrulama turu). Header'ın ilk iki baytı (`0x68`, `0x6A`) freediag kaynağında
 * `//defined by spec` yorumuyla SABİT görünüyor ama farklı bir değer görülmesi
 * spec ihlali sayılmaz — UYARI basılır, hata basılmaz (DoIP'in "unknown payload
 * type" deseniyle aynı ton). Source Address (3. bayt) freediag'da TEKNİK OLARAK
 * DEĞİŞKEN bir alan (`dp->srcaddr`) — `0xF1` yalnız SAE'nin "harici test cihazı"
 * KONVANSİYONU, bu baytta sabitlik varsayılmaz, uyarı da üretilmez.
 *
 * ── CHECKSUM (KAYNAK UYARISI, LIN emsali) ────────────────────────────────────
 * Checksum baytı hariç TÜM önceki baytların (header+veri) 8-bit toplamı mod 256
 * — ISO 14230 ile AYNI algoritma (`iso14230.ts`). Motor hesaplar, test bağımsız
 * ikinci hesapla doğrular. Tutmazsa `checksum-mismatch`.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'iso-9141';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ISO 9141';

const HEADER_LENGTH = 3;
/** Header(3) + Checksum(1) — veri baytı olmayan en kısa geçerli mesaj. */
const MIN_FRAME_LENGTH = HEADER_LENGTH + 1;
/** Header(3) + 255 veri baytı (Mode+PID+parametreler için gerçekçi üst sınır) + Checksum(1). */
const MAX_FRAME_LENGTH = HEADER_LENGTH + 255 + 1;

const CHECKSUM_MASK = 0xff;
/** freediag kaynağında `//defined by spec` — dosya başı kaynak uyarısı. */
const EXPECTED_FORMAT_BYTE = 0x68;
const EXPECTED_TARGET_ADDRESS_BYTE = 0x6a;

const ERROR_FRAME_TOO_SHORT = 'protocol.iso9141.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.iso9141.error.frameTooLong';
const ERROR_ABORTED = 'protocol.iso9141.error.aborted';
const ERROR_CHECKSUM_MISMATCH = 'protocol.iso9141.error.checksumMismatch';

const WARN_UNEXPECTED_FORMAT_BYTE = 'protocol.iso9141.warning.unexpectedFormatByte';
const WARN_UNEXPECTED_TARGET_ADDRESS = 'protocol.iso9141.warning.unexpectedTargetAddress';
const WARN_DATA_NEEDS_OBD_PAGE = 'protocol.iso9141.warning.dataNeedsObdPage';

const SUMMARY_FRAME = 'protocol.iso9141.summary.frame';

export type Iso9141FrameMetadata = {
  sourceAddress: number;
  dataLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Checksum baytı hariç tüm baytların 8-bit toplamı mod 256 (ISO 14230 ile aynı algoritma). */
function computeIso9141Checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (const value of bytes) sum += value;
  return sum & CHECKSUM_MASK;
}

interface Iso9141ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIso9141Frame(data: Uint8Array, options: Iso9141ParseOptions): ParseResult {
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
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const formatByte = byteAt(data, 0);
  const formatValid = formatByte === EXPECTED_FORMAT_BYTE;
  const formatField: ParsedField = {
    id: 'format',
    name: 'Format Byte',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: formatByte,
    valid: formatValid,
    warnings: [],
  };
  if (!formatValid) {
    // Spec-dışı değer — hata değil UYARI (dosya başı kaynak uyarısı), ham gösterilip devam edilir.
    formatField.warnings.push(WARN_UNEXPECTED_FORMAT_BYTE);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_FORMAT_BYTE));
  }
  fields.push(formatField);

  const targetAddressByte = byteAt(data, 1);
  const targetAddressValid = targetAddressByte === EXPECTED_TARGET_ADDRESS_BYTE;
  const targetAddressField: ParsedField = {
    id: 'target-address',
    name: 'Target Address',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: targetAddressByte,
    valid: targetAddressValid,
    warnings: [],
  };
  if (!targetAddressValid) {
    targetAddressField.warnings.push(WARN_UNEXPECTED_TARGET_ADDRESS);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_TARGET_ADDRESS));
  }
  fields.push(targetAddressField);

  const sourceAddressByte = byteAt(data, 2);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: sourceAddressByte,
    valid: true,
    warnings: [],
  });

  const checksumOffset = data.length - 1;
  const dataLength = checksumOffset - HEADER_LENGTH;
  if (dataLength > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: HEADER_LENGTH,
      length: dataLength,
      rawBytes: data.slice(HEADER_LENGTH, checksumOffset),
      unit: 'B',
      valid: true,
      // Mode+PID (SAE J1979) ham kalır — çözümü obd-ii sayfasının işi (dosya başı).
      warnings: [WARN_DATA_NEEDS_OBD_PAGE],
    });
    warnings.push(toProtocolWarning(WARN_DATA_NEEDS_OBD_PAGE));
  }

  const checksumByte = byteAt(data, checksumOffset);
  const computedChecksum = computeIso9141Checksum(data.slice(0, checksumOffset));
  const checksumValid = computedChecksum === checksumByte;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: checksumOffset,
    length: 1,
    rawBytes: data.slice(checksumOffset, checksumOffset + 1),
    rawValue: checksumByte,
    physicalValue: computedChecksum,
    valid: checksumValid,
    warnings: [],
  });
  if (!checksumValid) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: checksumOffset,
      length: 1,
      details: { computedChecksum, checksumByte },
    });
  }

  const summaryParams: Record<string, string> = {
    sourceAddress: formatHexByte(sourceAddressByte),
  };

  const metadata: Iso9141FrameMetadata = {
    sourceAddress: sourceAddressByte,
    dataLength,
    summaryKey: SUMMARY_FRAME,
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
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseIso9141(data: Uint8Array): ParseResult {
  return parseIso9141Frame(data, {});
}

export const iso9141Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: uzunluk aralığı. Header baytları spec-dışı olsa bile UYARI ile
   * çözülmeye devam ettiği için (dosya başı) burada sert bir sabit-bayt eleme
   * yapılmaz — LIN'in Sync baytı gibi HATA'ya çeviren bir ayırt edici yok. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && data.length <= MAX_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Iso9141ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseIso9141Frame(data, options);
  },
};

/**
 * Örnek çerçeveler. Spec bu dalga için hiçbir bayt örneği vermiyor (dosya başı
 * kaynak uyarısı) — hepsi freediag'ın alan düzenine göre elle inşa edildi ve
 * checksum motorun kendi fonksiyonuyla hesaplandı (bağımsız ikinci hesap testte,
 * LIN emsali).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'standard-header',
    name: 'protocol.iso9141.example.standardHeader.name',
    // 0x68/0x6A standart header, SRC 0xF1 (SAE konvansiyonu). Veri: Mode 0x41 PID 0x0C (RPM).
    bytes: new Uint8Array([0x68, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x22]),
    description: 'protocol.iso9141.example.standardHeader.description',
    expectedValid: true,
  },
  {
    id: 'unexpected-format-byte',
    name: 'protocol.iso9141.example.unexpectedFormatByte.name',
    // İlk header baytı 0x68 değil — uyarı basar ama ham gösterip çözmeye devam eder.
    bytes: new Uint8Array([0x48, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x02]),
    description: 'protocol.iso9141.example.unexpectedFormatByte.description',
    expectedValid: true,
  },
  {
    id: 'unexpected-target-address',
    name: 'protocol.iso9141.example.unexpectedTargetAddress.name',
    // İkinci header baytı 0x6A değil — uyarı basar ama ham gösterip çözmeye devam eder.
    bytes: new Uint8Array([0x68, 0x48, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0x00]),
    description: 'protocol.iso9141.example.unexpectedTargetAddress.description',
    expectedValid: true,
  },
  {
    id: 'zero-data',
    name: 'protocol.iso9141.example.zeroData.name',
    // Veri baytı yok: yalnız header + checksum, minimum uzunluk sınırı.
    bytes: new Uint8Array([0x68, 0x6a, 0xf1, 0xc3]),
    description: 'protocol.iso9141.example.zeroData.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.iso9141.example.checksumMismatch.name',
    // standard-header ile aynı gövde, checksum baytı bilerek bozuldu.
    bytes: new Uint8Array([0x68, 0x6a, 0xf1, 0x41, 0x0c, 0x1a, 0xf8, 0xff]),
    description: 'protocol.iso9141.example.checksumMismatch.description',
    expectedValid: false,
  },
];

export const iso9141Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: iso9141Parser,
  documentation: {
    summary: 'protocol.iso9141.documentation.summary',
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
