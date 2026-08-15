/**
 * ISO 14230-2 (KWP2000, Keyword Protocol 2000) — Format byte + adres + uzunluk +
 * SID + veri + checksum zarfının çözümü.
 *
 * GİRDİ HAM KWP2000 MESAJ BAYTIDIR: `FMT [TGT] [SRC] [LEN] SID veri… CHECKSUM`.
 * K-Line'ın fiziksel katmanı (5-baud/fast init, hat zamanlaması) bir bayt akışı
 * DEĞİLDİR — decoder'a HİÇ girmez (K-Line kararı, brief-faz10-dalga2.md: motor
 * ALMAZ, `planned` kalır). UDS'e evrilen SID uzayı burada AD LANDIRILMAZ — bazı
 * düşük kodlar (0x10/0x11/0x14/0x3E) UDS ile örtüşse de bazıları tamamen ayrışır
 * (KWP `0x13`/UDS `0x19`, KWP `0x21`/UDS `0x22`) ve UDS tablosunu buraya taşımak
 * uydurma olurdu (brief-faz10-dalga2b.md). SID HAM kalır, `serviceNeedsTable`
 * uyarısıyla — DoIP'in "UDS sayfasında çözülür" deseninin aynısı.
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * Bu deponun `docs/spec/` dosyası KWP2000 için bayt düzeyinde SIFIR veri içeriyor
 * (brief-faz10-dalga2.md: format byte anlamı, checksum algoritması, fast-init
 * süreleri, servis tablosu — hiçbiri yok). Aşağıdaki FMT baytı bit düzeni ve
 * checksum algoritması DIŞ KAYNAKTIR: freediag projesinin yol testinden geçmiş
 * çözümleyici kaynağı (`diag_l2_iso14230.c`, `diag_iso14230.h`), Wikipedia
 * KWP2000 maddesi ve bağımsız ikinci kaynaklarla çapraz doğrulandı
 * (brief-faz10-dalga2b.md doğrulama turu — DoIP'teki üç-kaynak yöntemiyle aynı
 * titizlikte). CARB mode (FMT bit7-6 = `01`) freediag'ın kendisi REDDEDİYOR —
 * ISO 14230'un parçası değil, burada da hata değil UYARI olarak işlenir.
 *
 * ── FMT BAYTI (bit düzeyinde) ────────────────────────────────────────────────
 * Bit 5-0: veri uzunluğu (SID+parametreler, header ve checksum HARİÇ), 0-63.
 *   0 ise hemen ardından (TGT/SRC varsa onlardan sonra) ayrı bir LEN baytı gelir.
 * Bit 7-6: adres kipi — `00` adres yok, `10` fiziksel, `11` fonksiyonel (ikisinde
 *   de TGT/SRC üretilir), `01` CARB (ISO 14230 dışı, en iyi çaba: adres baytı
 *   YOK varsayılır, UYARI basılır — DoIP'in "unknown payload type" deseniyle
 *   aynı ton). Dördüncü değer bu yüzden tabloya YAZILMAZ: `enumField` onu
 *   otomatik "bilinmeyen" yoluna düşürür.
 *
 * ── CHECKSUM (KAYNAK UYARISI, LIN emsali) ────────────────────────────────────
 * Checksum baytı hariç TÜM önceki baytların (FMT…veri) 8-bit toplamı mod 256.
 * Motor hesaplar, test bağımsız ikinci hesapla doğrular (LIN checksum emsali).
 * Tutmazsa `checksum-mismatch` — bu motorda İLK KEZ gerçek bir kullanım alanı
 * buluyor (DoIP'te hiç kullanılmamıştı).
 *
 * ── UZUNLUK TUTARLILIĞI ───────────────────────────────────────────────────────
 * Deklare edilen uzunluk (FMT biti ya da ayrı LEN baytı) ile SID+veri'nin
 * gerçek bayt sayısı DoIP'in payload-length alanı gibi karşılaştırılır; tutmazsa
 * hata değil UYARI (frame yine checksum'a kadar konumsal olarak dilimlenir,
 * deklare edilen uzunluğa güvenilmez — bozuk bir uzunluk alanı yüzünden
 * checksum'ın yanlış yerden okunmasını engeller).
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

const PROTOCOL_ID = 'iso-14230';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'ISO 14230 (KWP2000)';

/** FMT + SID + CHECKSUM — adressiz, FMT-içi uzunluklu en kısa geçerli mesaj. */
const MIN_FRAME_LENGTH = 3;
/** FMT(1) + TGT/SRC(2) + LEN(1) + SID+veri(255, ayrı LEN baytıyla) + CHECKSUM(1). */
const MAX_FRAME_LENGTH = 260;

const ADDRESS_MODE_SHIFT = 6;
const ADDRESS_MODE_MASK = 0b11;
const LENGTH_MASK = 0b111111;
const ADDRESS_MODE_NO_ADDRESS = 0b00;
const ADDRESS_MODE_PHYSICAL = 0b10;
const ADDRESS_MODE_FUNCTIONAL = 0b11;

const HEX_RADIX = 16;
const HEX_DIGITS_BYTE = 2;
const CHECKSUM_MASK = 0xff;

const ERROR_FRAME_TOO_SHORT = 'protocol.iso14230.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.iso14230.error.frameTooLong';
const ERROR_ABORTED = 'protocol.iso14230.error.aborted';
const ERROR_ADDRESS_BYTES_TRUNCATED = 'protocol.iso14230.error.addressBytesTruncated';
const ERROR_LENGTH_BYTE_TRUNCATED = 'protocol.iso14230.error.lengthByteTruncated';
const ERROR_SERVICE_DATA_TRUNCATED = 'protocol.iso14230.error.serviceDataTruncated';
const ERROR_CHECKSUM_MISMATCH = 'protocol.iso14230.error.checksumMismatch';

const WARN_UNKNOWN_ADDRESS_MODE = 'protocol.iso14230.warning.unknownAddressMode';
const WARN_SERVICE_NEEDS_TABLE = 'protocol.iso14230.warning.serviceNeedsTable';
const WARN_LENGTH_MISMATCH = 'protocol.iso14230.warning.lengthMismatch';

const SUMMARY_FRAME = 'protocol.iso14230.summary.frame';

/** Adres kipi adları — protokol terimi, veridir, çevrilmez (CLAUDE.md). CARB
 * (`01`) bilerek tabloya YAZILMAZ: `enumField` onu "bilinmeyen" yoluna düşürür. */
const ADDRESS_MODE_LABELS: ReadonlyMap<number, string> = new Map([
  [ADDRESS_MODE_NO_ADDRESS, 'No Address'],
  [ADDRESS_MODE_PHYSICAL, 'Physical'],
  [ADDRESS_MODE_FUNCTIONAL, 'Functional'],
]);

export type Iso14230AddressMode = 'no-address' | 'physical' | 'functional' | 'unknown';

export type Iso14230FrameMetadata = {
  addressMode: Iso14230AddressMode;
  sid: number | undefined;
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
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_BYTE, '0')}`;
}

/** Checksum baytı hariç tüm baytların 8-bit toplamı mod 256 (dosya başı kaynak uyarısı). */
function computeIso14230Checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (const value of bytes) sum += value;
  return sum & CHECKSUM_MASK;
}

function hasAddressBytes(addressMode: number): boolean {
  return addressMode === ADDRESS_MODE_PHYSICAL || addressMode === ADDRESS_MODE_FUNCTIONAL;
}

function addressModeKind(addressMode: number): Iso14230AddressMode {
  if (addressMode === ADDRESS_MODE_NO_ADDRESS) return 'no-address';
  if (addressMode === ADDRESS_MODE_PHYSICAL) return 'physical';
  if (addressMode === ADDRESS_MODE_FUNCTIONAL) return 'functional';
  return 'unknown';
}

interface Iso14230ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIso14230Frame(data: Uint8Array, options: Iso14230ParseOptions): ParseResult {
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

  const fmtByte = byteAt(data, 0);
  const addressMode = (fmtByte >>> ADDRESS_MODE_SHIFT) & ADDRESS_MODE_MASK;
  const lengthBits = fmtByte & LENGTH_MASK;

  const addressModeLabel = ADDRESS_MODE_LABELS.get(addressMode);
  const fmtField: ParsedField = {
    id: 'fmt',
    name: 'Format Byte',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: fmtByte,
    valid: addressModeLabel !== undefined,
    warnings: [],
  };
  if (addressModeLabel !== undefined) {
    fmtField.physicalValue = addressModeLabel;
  } else {
    // CARB mode (ya da ISO 14230 dışı başka bir bit deseni) — hata değil UYARI,
    // en iyi çaba ile adres baytı YOK varsayılır (dosya başı kaynak uyarısı).
    fmtField.warnings.push(WARN_UNKNOWN_ADDRESS_MODE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_ADDRESS_MODE));
  }
  fields.push(fmtField);

  let cursor = 1;
  let declaredLength = lengthBits;

  const withAddressBytes = hasAddressBytes(addressMode);
  if (withAddressBytes) {
    if (data.length - cursor < 2) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_ADDRESS_BYTES_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
      });
      return finishFrame(data, fields, warnings, errors, options, addressMode, undefined);
    }
    fields.push({
      id: 'target-address',
      name: 'Target Address',
      offset: cursor,
      length: 1,
      rawBytes: data.slice(cursor, cursor + 1),
      rawValue: byteAt(data, cursor),
      valid: true,
      warnings: [],
    });
    cursor += 1;
    fields.push({
      id: 'source-address',
      name: 'Source Address',
      offset: cursor,
      length: 1,
      rawBytes: data.slice(cursor, cursor + 1),
      rawValue: byteAt(data, cursor),
      valid: true,
      warnings: [],
    });
    cursor += 1;
  }

  if (lengthBits === 0) {
    if (data.length - cursor < 1) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_LENGTH_BYTE_TRUNCATED,
        offset: cursor,
        length: data.length - cursor,
      });
      return finishFrame(data, fields, warnings, errors, options, addressMode, undefined);
    }
    declaredLength = byteAt(data, cursor);
    fields.push({
      id: 'length',
      name: 'Length',
      offset: cursor,
      length: 1,
      rawBytes: data.slice(cursor, cursor + 1),
      rawValue: declaredLength,
      unit: 'B',
      valid: true,
      warnings: [],
    });
    cursor += 1;
  }

  // SID + checksum için en az iki bayt kalmalı.
  if (data.length - cursor < 2) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_SERVICE_DATA_TRUNCATED,
      offset: cursor,
      length: data.length - cursor,
    });
    return finishFrame(data, fields, warnings, errors, options, addressMode, undefined);
  }

  const sidOffset = cursor;
  const sidByte = byteAt(data, sidOffset);
  fields.push({
    id: 'sid',
    name: 'Service ID',
    offset: sidOffset,
    length: 1,
    rawBytes: data.slice(sidOffset, sidOffset + 1),
    rawValue: sidByte,
    valid: true,
    warnings: [WARN_SERVICE_NEEDS_TABLE],
  });
  warnings.push(toProtocolWarning(WARN_SERVICE_NEEDS_TABLE));
  cursor += 1;

  const checksumOffset = data.length - 1;
  const dataLength = checksumOffset - cursor;
  if (dataLength > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: cursor,
      length: dataLength,
      rawBytes: data.slice(cursor, checksumOffset),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  // Uzunluk tutarlılığı: deklare edilen (FMT biti ya da ayrı LEN baytı) ile
  // gerçek SID+veri bayt sayısı DoIP'in payload-length alanı gibi karşılaştırılır.
  const actualServiceLength = checksumOffset - sidOffset;
  if (declaredLength !== actualServiceLength) {
    warnings.push(toProtocolWarning(WARN_LENGTH_MISMATCH));
  }

  const checksumByte = byteAt(data, checksumOffset);
  const computedChecksum = computeIso14230Checksum(data.slice(0, checksumOffset));
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

  return finishFrame(data, fields, warnings, errors, options, addressMode, sidByte);
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: Iso14230ParseOptions,
  addressMode: number,
  sid: number | undefined,
): ParseResult {
  const summaryParams: Record<string, string> = {};
  if (sid !== undefined) {
    summaryParams['sid'] = formatHexByte(sid);
  }

  const metadata: Iso14230FrameMetadata = {
    addressMode: addressModeKind(addressMode),
    sid,
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

export function parseIso14230(data: Uint8Array): ParseResult {
  return parseIso14230Frame(data, {});
}

export const iso14230Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız uzunluk aralığı. FMT baytının dört bit7-6 deseni de
   * (CARB dahil, en iyi çaba) parse edilebilir olduğu için ayırt edici bir
   * sabit sync baytı yok — DoIP'in inverse-version tutarlılığı gibi ikinci bir
   * ucuz doğrulama burada mevcut değil. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && data.length <= MAX_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Iso14230ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseIso14230Frame(data, options);
  },
};

/**
 * Örnek çerçeveler. Spec bu dalga için hiçbir bayt örneği vermiyor (dosya başı
 * kaynak uyarısı) — hepsi freediag'ın alan düzenine göre elle inşa edildi ve
 * checksum motorun kendi fonksiyonuyla hesaplandı (bağımsız ikinci hesap testte,
 * LIN emsali). İki uzunluk taşıma yolu (FMT-içi / ayrı LEN baytı) ayrı ayrı
 * örneklenir — brief'in açık şartı.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'physical-inline-length',
    name: 'protocol.iso14230.example.physicalInlineLength.name',
    // FMT 0x83: fiziksel adresleme + FMT-içi uzunluk (SID+2 veri = 3).
    bytes: new Uint8Array([0x83, 0x10, 0xf1, 0x21, 0x00, 0x0c, 0xb1]),
    description: 'protocol.iso14230.example.physicalInlineLength.description',
    expectedValid: true,
  },
  {
    id: 'functional-separate-length',
    name: 'protocol.iso14230.example.functionalSeparateLength.name',
    // FMT 0xC0: fonksiyonel adresleme + uzunluk 0, ayrı LEN baytı (0x04).
    bytes: new Uint8Array([0xc0, 0x33, 0xf1, 0x04, 0x14, 0xff, 0x00, 0x00, 0xfb]),
    description: 'protocol.iso14230.example.functionalSeparateLength.description',
    expectedValid: true,
  },
  {
    id: 'no-address',
    name: 'protocol.iso14230.example.noAddress.name',
    // FMT 0x02: adres baytı yok, FMT-içi uzunluk (SID+1 veri = 2).
    bytes: new Uint8Array([0x02, 0x10, 0x81, 0x93]),
    description: 'protocol.iso14230.example.noAddress.description',
    expectedValid: true,
  },
  {
    id: 'carb-mode-warning',
    name: 'protocol.iso14230.example.carbModeWarning.name',
    // FMT 0x42: bit7-6 = 01 (CARB) — ISO 14230 dışı, uyarı basar ama çözer.
    bytes: new Uint8Array([0x42, 0x11, 0x01, 0x54]),
    description: 'protocol.iso14230.example.carbModeWarning.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.iso14230.example.checksumMismatch.name',
    // physical-inline-length ile aynı gövde, checksum baytı bilerek bozuldu.
    bytes: new Uint8Array([0x83, 0x10, 0xf1, 0x21, 0x00, 0x0c, 0x00]),
    description: 'protocol.iso14230.example.checksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'service-data-truncated',
    name: 'protocol.iso14230.example.serviceDataTruncated.name',
    // FMT fiziksel adresleme istiyor; Target/Source okunur ama Service ID ve
    // Checksum için mesajda hiç bayt kalmaz (3 bayt yalnız FMT+TGT+SRC'yi taşır).
    bytes: new Uint8Array([0x83, 0x10, 0xf1]),
    description: 'protocol.iso14230.example.serviceDataTruncated.description',
    expectedValid: false,
  },
];

export const iso14230Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: iso14230Parser,
  documentation: {
    summary: 'protocol.iso14230.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
