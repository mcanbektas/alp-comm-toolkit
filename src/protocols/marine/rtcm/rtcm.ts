/**
 * RTCM (10403.x) — GNSS düzeltme çerçevesi: 0xD3 preamble + 6-bit reserved +
 * 10-bit length + payload + CRC-24Q (brief-faz10-dalga3.md, 3c).
 *
 * GİRDİ NTRIP/seri akıştan gelen HAM RTCM3 bayt dizisidir. UBX ile aynı GNSS
 * portunda multiplekslenebilir (spec 5563) — bu motor akış ayrıştırmaz, TEK
 * çerçeve alır (`ubx.ts` ile aynı sınır).
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * `docs/spec/` RTCM çerçeve İSKELETİNİ (Preamble/Length/Message Type/Station
 * ID/Payload/CRC State) ve GNSS kategori kümesini (Reference Station, GPS,
 * GLONASS, Galileo, BeiDou, MSM, Antenna, Station Information, SSR) veriyor,
 * ayrıca örnek mesaj numaraları sayıyor (1005, 1077, 1087, 1097, 1127, 1230 —
 * spec ~5490-5503). Ama CRC-24Q'nun exact polinomu/init'i ve mesaj ADI/alan
 * tabloları BİLEREK verilmiyor: "resmi RTCM implementation profile'a bağlı
 * sabit tutulmalı" (spec ~5547), mesaj tabloları lisanslı (spec ~5447).
 *
 * Bu yüzden:
 * • 6-bit reserved + 10-bit length `protocol-core/decoding/bitCursor`in
 *   `readBitsAsNumber`ıyla okunur (bayt sınırı tanımayan tek dış kaynaklı yapı).
 * • CRC-24Q, `crcCatalogue.ts`e AYRI eklenen `CRC24_Q` girdisiyle hesaplanır —
 *   dış kaynak: RTCM SC-104 / ITU-T H.224 / Qualcomm'un kamuya açık, yaygın
 *   yayınlanmış CRC-24Q parametreleri (bkz. `crcCatalogue.ts` dosya notu).
 *   `crcCatalogue.ts:107`teki mevcut `CRC24` (OpenPGP, init 0xB704CE) BAŞKA BİR
 *   tüketicinin doğrusu olabileceği için DEĞİŞTİRİLMEDİ.
 * • Mesaj numarası (payload'ın ilk 12 biti, `readBitsAsNumber`) HER ZAMAN
 *   çözülür — bu yapısal, lisanssız bir işlem. Ama numaranın KATEGORİSİ yalnız
 *   spec'in AÇIKÇA verdiği altı numara + spec'in AÇIKÇA verdiği kategori
 *   kelimeleriyle eşlenir (`RTCM_MESSAGE_CATEGORIES`); mesaj ADI (1005'in
 *   insan-okur karşılığı gibi) hiçbir yerde YAZILMAZ — lisanslı RTCM mesaj
 *   tablosunun parçası (karar turu, brief-faz10-dalga3.md).
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • Mesaj numarası dışındaki TÜM payload alanları (Station ID, gözlemler, MSM
 *   hücreleri, SSR düzeltmeleri …): resmi RTCM 10403 revizyonuna bağlı, HAM
 *   bırakılır, `payloadNeedsDatabase` uyarısıyla.
 * • NTRIP taşıması: bu, RTCM'in VERİ BİÇİMİ olduğu akışın kendisi değil —
 *   katalog notu bunu ayrıca belirtiyor, parser'a girmez.
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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

const PROTOCOL_ID = 'rtcm';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RTCM';

const PREAMBLE_BYTE = 0xd3;
/** Preamble(1) + [6-bit reserved | 10-bit length](2) — bit alanları bayt 1-2'de. */
const HEADER_LENGTH = 3;
const PAYLOAD_OFFSET = HEADER_LENGTH;
const CRC_LENGTH = 3;
/** Sıfır payload'lı en kısa geçerli çerçeve: header + CRC. */
const MIN_FRAME_LENGTH = HEADER_LENGTH + CRC_LENGTH;

const RESERVED_BIT_POSITION = 8; // 2. bayt (offset 1) başı
const RESERVED_BIT_LENGTH = 6;
const LENGTH_BIT_POSITION = RESERVED_BIT_POSITION + RESERVED_BIT_LENGTH; // 14
const LENGTH_BIT_LENGTH = 10;
const LENGTH_FIELD_BYTE_LENGTH = 2; // reserved+length'in kapladığı bayt aralığı

const MESSAGE_NUMBER_BIT_LENGTH = 12;
const MESSAGE_NUMBER_BYTE_LENGTH = 2; // 12 bit, bayt çözünürlüğüne yuvarlanmış

const HEX_RADIX = 16;
const HEX_DIGITS_BYTE = 2;
const HEX_DIGITS_UINT24 = 6;

const ERROR_HEADER_TRUNCATED = 'protocol.rtcm.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.rtcm.error.frameTooLong';
const ERROR_ABORTED = 'protocol.rtcm.error.aborted';
const ERROR_INVALID_PREAMBLE = 'protocol.rtcm.error.invalidPreamble';
const ERROR_TRUNCATED_PAYLOAD = 'protocol.rtcm.error.truncatedPayload';
const ERROR_CRC_MISMATCH = 'protocol.rtcm.error.crcMismatch';

const WARN_RESERVED_BIT_SET = 'protocol.rtcm.warning.reservedBitSet';
const WARN_PAYLOAD_NEEDS_DATABASE = 'protocol.rtcm.warning.payloadNeedsDatabase';
const WARN_MESSAGE_NUMBER_UNAVAILABLE = 'protocol.rtcm.warning.messageNumberUnavailable';
const WARN_MESSAGE_CATEGORY_UNKNOWN = 'protocol.rtcm.warning.messageCategoryUnknown';
const WARN_TRAILING_BYTES = 'protocol.rtcm.warning.trailingBytes';

const SUMMARY_FRAME = 'protocol.rtcm.summary.frame';

/**
 * Yalnız spec'in AÇIKÇA verdiği mesaj numaraları (~5490-5503) + AÇIKÇA verdiği
 * "GNSS kategorileri" kelimeleri eşlenir (karar turu, brief-faz10-dalga3.md).
 * Mesaj ADI (1005'in "Stationary RTK Reference Station ARP" gibi insan-okur
 * karşılığı, 1077'nin "GPS MSM7" gibi tam açılımı) YAZILMAZ — lisanslı RTCM
 * mesaj tablosunun parçası. Listede olmayan her numara "kategori belirsiz"
 * uyarısıyla ham gösterilir; aralık TAHMİNİ (ör. "10xx GPS'tir") YAPILMAZ,
 * çünkü aralıkların kendisi de lisanslı tablonun parçası.
 */
const RTCM_MESSAGE_CATEGORIES: ReadonlyMap<number, string> = new Map([
  [1005, 'Reference Station'],
  [1077, 'MSM'],
  [1087, 'MSM'],
  [1097, 'MSM'],
  [1127, 'MSM'],
  [1230, 'GLONASS'],
]);

export type RtcmFrameMetadata = {
  messageNumber: number | undefined;
  category: string | undefined;
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

function formatHexUint24(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_UINT24, '0')}`;
}

interface RtcmParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseRtcmFrame(data: Uint8Array, options: RtcmParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
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

  const preamble = byteAt(data, 0);
  const preambleValid = preamble === PREAMBLE_BYTE;
  fields.push({
    id: 'preamble',
    name: 'Preamble',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: preamble,
    valid: preambleValid,
    warnings: [],
  });
  if (!preambleValid) {
    // canParse zaten eler; doğrudan parse() çağrısına karşı savunma katmanı
    // (ubx.ts'in geçersiz sync'i / doip'in inverse-version'ı ile aynı desen).
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_PREAMBLE,
      offset: 0,
      length: 1,
      details: { preamble: formatHexByte(preamble) },
    });
  }

  // 6-bit reserved + 10-bit length aynı iki baytı paylaşır — bitCursor'la okunur.
  const reserved = readBitsAsNumber(data, RESERVED_BIT_POSITION, RESERVED_BIT_LENGTH);
  const reservedField: ParsedField = {
    id: 'reserved',
    name: 'Reserved',
    offset: 1,
    length: 1,
    rawBytes: data.slice(1, 2),
    rawValue: reserved,
    valid: true,
    warnings: [],
  };
  if (reserved !== 0) {
    reservedField.warnings.push(WARN_RESERVED_BIT_SET);
    warnings.push(toProtocolWarning(WARN_RESERVED_BIT_SET));
  }
  fields.push(reservedField);

  const declaredLength = readBitsAsNumber(data, LENGTH_BIT_POSITION, LENGTH_BIT_LENGTH);
  fields.push({
    id: 'length',
    name: 'Length',
    offset: 1,
    length: LENGTH_FIELD_BYTE_LENGTH,
    rawBytes: data.slice(1, 1 + LENGTH_FIELD_BYTE_LENGTH),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const totalFrameLength = HEADER_LENGTH + declaredLength + CRC_LENGTH;
  let messageNumber: number | undefined;
  let category: string | undefined;

  if (data.length < totalFrameLength) {
    // DoIP'in `requireBytes` deseni: payload/CRC eksikse ötesi üretilmez, ama
    // preamble/reserved/length yine gösterilir — kısmi çözüm (spec §47).
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TRUNCATED_PAYLOAD,
      offset: PAYLOAD_OFFSET,
      length: totalFrameLength - data.length,
      details: { declaredLength, availableAfterHeader: data.length - HEADER_LENGTH },
    });
  } else {
    const payload = data.slice(PAYLOAD_OFFSET, PAYLOAD_OFFSET + declaredLength);
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: PAYLOAD_OFFSET,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [WARN_PAYLOAD_NEEDS_DATABASE],
      });
      warnings.push(toProtocolWarning(WARN_PAYLOAD_NEEDS_DATABASE));

      if (payload.length * 8 >= MESSAGE_NUMBER_BIT_LENGTH) {
        messageNumber = readBitsAsNumber(payload, 0, MESSAGE_NUMBER_BIT_LENGTH);
        category = RTCM_MESSAGE_CATEGORIES.get(messageNumber);
        const messageNumberField: ParsedField = {
          id: 'message-number',
          name: 'Message Number',
          offset: PAYLOAD_OFFSET,
          length: MESSAGE_NUMBER_BYTE_LENGTH,
          rawBytes: payload.slice(0, MESSAGE_NUMBER_BYTE_LENGTH),
          rawValue: messageNumber,
          valid: category !== undefined,
          warnings: [],
        };
        if (category !== undefined) {
          messageNumberField.physicalValue = category;
        } else {
          messageNumberField.warnings.push(WARN_MESSAGE_CATEGORY_UNKNOWN);
          warnings.push(toProtocolWarning(WARN_MESSAGE_CATEGORY_UNKNOWN));
        }
        fields.push(messageNumberField);
      } else {
        warnings.push(toProtocolWarning(WARN_MESSAGE_NUMBER_UNAVAILABLE));
      }
    }

    const crcOffset = PAYLOAD_OFFSET + declaredLength;
    // Üç bayt birleştirme 24 bitte kalır (azami 0xFFFFFF < 2^31); DoIP'in
    // 32-bit `readUint32BE`sindeki işaret taşması BURADA oluşmaz, `>>> 0`
    // gerekmez — ama CRC hesabının kendisi `crcEngine`in bigint aritmetiğiyle
    // yapılır, JS'in 32-bit bitwise sınırına hiç girmez (bkz. crcCatalogue.ts).
    const receivedCrc =
      (byteAt(data, crcOffset) << 16) | (byteAt(data, crcOffset + 1) << 8) | byteAt(data, crcOffset + 2);
    const computedCrc = Number(computeNamedCrc(data.slice(0, crcOffset), 'CRC24_Q'));
    const crcValid = receivedCrc === computedCrc;
    const crcField: ParsedField = {
      id: 'crc',
      name: 'CRC-24Q',
      offset: crcOffset,
      length: CRC_LENGTH,
      rawBytes: data.slice(crcOffset, crcOffset + CRC_LENGTH),
      rawValue: receivedCrc,
      valid: crcValid,
      warnings: [],
    };
    if (crcValid) {
      crcField.physicalValue = 'Valid';
    } else {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_CRC_MISMATCH,
        offset: crcOffset,
        length: CRC_LENGTH,
        details: {
          received: formatHexUint24(receivedCrc),
          computed: formatHexUint24(computedCrc),
        },
      });
    }
    fields.push(crcField);

    const trailingOffset = crcOffset + CRC_LENGTH;
    if (data.length > trailingOffset) {
      const trailing = data.slice(trailingOffset);
      fields.push({
        id: 'trailing-data',
        name: 'Trailing Data',
        offset: trailingOffset,
        length: trailing.length,
        rawBytes: trailing,
        valid: false,
        warnings: [WARN_TRAILING_BYTES],
      });
      warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
    }
  }

  const summaryParams: Record<string, string> = {
    messageNumber: messageNumber === undefined ? '' : String(messageNumber),
    category: category ?? '',
  };

  const metadata: RtcmFrameMetadata = {
    messageNumber,
    category,
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

export function parseRtcm(data: Uint8Array): ParseResult {
  return parseRtcmFrame(data, {});
}

export const rtcmParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + sabit 0xD3 preamble. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    return byteAt(data, 0) === PREAMBLE_BYTE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: RtcmParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseRtcmFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. Spec RTCM için hiçbir bayt dizisi vermiyor (dosya başı) —
 * hepsi elle inşa edildi: mesaj numarası payload'ın ilk 12 bitine yerleştirildi,
 * kalan baytlar sıfır dolgu (zaten adlandırılmıyor), CRC-24Q motorla hesaplandı
 * ve `rtcm.test.ts`te bağımsız ikinci bir CRC hesabıyla çapraz doğrulanıyor.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'reference-station',
    name: 'protocol.rtcm.example.referenceStation.name',
    // Mesaj numarası 1005 → spec'in "Reference Station" kategorisi.
    bytes: new Uint8Array([0xd3, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x27]),
    description: 'protocol.rtcm.example.referenceStation.description',
    expectedValid: true,
  },
  {
    id: 'unclassified-message-number',
    name: 'protocol.rtcm.example.unclassifiedMessageNumber.name',
    // Mesaj numarası 4095: 12-bit aralığın üst ucu, kategori tablosunda yok.
    bytes: new Uint8Array([0xd3, 0x00, 0x05, 0xff, 0xf0, 0x00, 0x00, 0x00, 0xef, 0xd5, 0x68]),
    description: 'protocol.rtcm.example.unclassifiedMessageNumber.description',
    expectedValid: true,
  },
  {
    id: 'crc-mismatch',
    name: 'protocol.rtcm.example.crcMismatch.name',
    // "reference-station" ile AYNI gövde, son CRC baytı bilerek bozuldu (0x27 → 0x00).
    bytes: new Uint8Array([0xd3, 0x00, 0x05, 0x3e, 0xd0, 0x00, 0x00, 0x00, 0x99, 0x6e, 0x00]),
    description: 'protocol.rtcm.example.crcMismatch.description',
    expectedValid: false,
  },
];

export const rtcmPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: rtcmParser,
  documentation: {
    summary: 'protocol.rtcm.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
