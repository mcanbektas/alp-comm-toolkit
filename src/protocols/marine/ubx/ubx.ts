/**
 * u-blox UBX — GNSS alıcılarının kendi bayt akışı: Sync + Class/ID + LE Length +
 * Payload + Checksum çözümü (brief-faz10-dalga3.md, 3c).
 *
 * GİRDİ NE UART/USB/SPI/I²C ÜZERİNDEN GELEN HAM UBX BAYT DİZİSİDİR. NMEA ve RTCM
 * aynı GNSS portundan multipleksli gelebilir (spec 5563) — bu motor akış
 * ayrıştırmaz, TEK bir UBX çerçevesini alır (LIN/DoIP emsali: akış durumu
 * `protocol-core/streams` katmanının işi, parser saf kalır).
 *
 * ── KAYNAK UYARISI ────────────────────────────────────────────────────────────
 * `docs/spec/` UBX için yalnız çerçeve İSKELETİNİ ve TEK somut bayt dizisini
 * veriyor: `B5 62 0A 06 00 00 10 3A` (spec ~5355, u-blox `ubxlib` örnek
 * loglarından alıntı). Checksum ALGORİTMASI spec'te YOK — "Fletcher" UBX
 * bağlamında hiç geçmiyor, kapsam bile "sürüme göre, UI'da belirtilsin" diyor
 * (5401-5415). Aşağıdaki checksum fonksiyonu ve Class tablosu DIŞ KAYNAKTIR:
 * u-blox'un kamuya açık arayüz açıklama kılavuzlarında (interface description)
 * yıllardır sabit kalan iki parça — 8-bit çift-akümülatör checksum ve üst
 * seviye Class kısaltmaları (NAV/RXM/CFG/ACK/INF/MON/UPD/TIM/ESF/MGA/LOG/SEC/
 * HNR). Class/ID NUMARA TABLOSU ve NAV-PVT gibi mesajların payload İÇİ alan
 * düzeni spec'te YOK ve burada da YAZILMAZ — yalnız isim örnekleri var
 * (spec "Class: NAV, ID: PVT → UBX-NAV-PVT" örneğini veriyor, sayısal tablo
 * vermiyor). Bu yüzden yalnız CLASS baytı adlandırılır; ID baytı HAM kalır.
 *
 * ── ÇEKİRDEK TUZAK: FLETCHER-16 DEĞİL ────────────────────────────────────────
 * UBX checksum'ı 8-bit iki akümülatörün MOD 256 toplamıdır. `fletcher.ts`teki
 * `fletcher16` ise MOD 255 çalışır (Fletcher'ın adil dağılım özelliği bu
 * asimetrik mod'a dayanır). İkisi ÇOĞU girdide aynı sonucu verir, bazı
 * girdilerde SESSİZCE farklı sonuç üretir — bu yüzden `fletcher16` burada
 * KULLANILMADI, `computeUbxChecksum` bağımsız, küçük bir fonksiyondur.
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • Payload İÇERİĞİ: NAV-PVT gibi mesajların alan düzeni u-blox'un versiyona
 *   göre değişen, lisanslı/versiyonlu arayüz kılavuzuna bağlıdır — burada
 *   HAM bırakılır, `payloadNeedsDatabase` uyarısıyla.
 * • UBX/NMEA/RTCM stream ayrıştırması (spec "Multi-Protocol Stream Detector"):
 *   bu, akış katmanının işi; bu dosya tek çerçeve alır.
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

/** Katalogdaki kanonik kayıt `marine-navigation/gnss-corrections/gnss-ubx` — id
 * KASTEN `ubx` DEĞİL `gnss-ubx` (registry anahtarıyla `plugin.id` birebir
 * eşleşmeli, `index.test.ts` bunu doğrular). */
const PROTOCOL_ID = 'gnss-ubx';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'UBX';

const SYNC_BYTE_1 = 0xb5;
const SYNC_BYTE_2 = 0x62;
const SYNC_LENGTH = 2;
const CLASS_OFFSET = 2;
const ID_OFFSET = 3;
const LENGTH_OFFSET = 4;
const LENGTH_FIELD_LENGTH = 2;
/** Sync(2) + Class(1) + ID(1) + Length(2) — checksum kapsamı BURADAN başlar. */
const HEADER_LENGTH = 6;
const PAYLOAD_OFFSET = HEADER_LENGTH;
const CHECKSUM_LENGTH = 2;
/** Sıfır payload'lı en kısa geçerli çerçeve: header + CK_A + CK_B. */
const MIN_FRAME_LENGTH = HEADER_LENGTH + CHECKSUM_LENGTH;

const CHECKSUM_BYTE_MASK = 0xff;
const LENGTH_LOW_BYTE_MASK = 0xff;
const LENGTH_HIGH_BYTE_SHIFT = 8;

const HEX_RADIX = 16;
const HEX_DIGITS_BYTE = 2;

const ERROR_HEADER_TRUNCATED = 'protocol.ubx.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.ubx.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ubx.error.aborted';
const ERROR_INVALID_SYNC = 'protocol.ubx.error.invalidSync';
const ERROR_TRUNCATED_PAYLOAD = 'protocol.ubx.error.truncatedPayload';
const ERROR_CHECKSUM_MISMATCH = 'protocol.ubx.error.checksumMismatch';

const WARN_UNKNOWN_CLASS = 'protocol.ubx.warning.unknownClass';
const WARN_PAYLOAD_NEEDS_DATABASE = 'protocol.ubx.warning.payloadNeedsDatabase';
const WARN_TRAILING_BYTES = 'protocol.ubx.warning.trailingBytes';

const SUMMARY_FRAME = 'protocol.ubx.summary.frame';

/**
 * Dar yapısal Class kümesi (dosya başı KAYNAK UYARISI): u-blox arayüz
 * kılavuzlarının kamuya açık, sürümler arası sabit kalan üst seviye Class
 * kısaltmaları. Class İÇİNDEKİ ID'lerin (ör. NAV-PVT) numara tablosu spec'te
 * yok, burada da eklenmez — yalnız bu bir seviye üst.
 */
const UBX_CLASSES: ReadonlyMap<number, string> = new Map([
  [0x01, 'NAV'],
  [0x02, 'RXM'],
  [0x04, 'INF'],
  [0x05, 'ACK'],
  [0x06, 'CFG'],
  [0x09, 'UPD'],
  [0x0a, 'MON'],
  [0x0d, 'TIM'],
  [0x10, 'ESF'],
  [0x13, 'MGA'],
  [0x21, 'LOG'],
  [0x27, 'SEC'],
  [0x28, 'HNR'],
]);

export type UbxFrameMetadata = {
  classByte: number;
  className: string | undefined;
  messageId: number;
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

function formatByteString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_BYTE, '0'),
  ).join(' ');
}

/**
 * UBX checksum'ı (dosya başı KAYNAK UYARISI): 8-bit iki akümülatör, MOD 256 —
 * `fletcher16`in MOD 255'i DEĞİL. `bytes` çağıranın verdiği kapsamdır (Class'tan
 * payload sonuna kadar, sync HARİÇ); bu fonksiyon kapsam seçmez, yalnız toplar.
 */
function computeUbxChecksum(bytes: Uint8Array): { ckA: number; ckB: number } {
  let ckA = 0;
  let ckB = 0;
  for (const byte of bytes) {
    ckA = (ckA + byte) & CHECKSUM_BYTE_MASK;
    ckB = (ckB + ckA) & CHECKSUM_BYTE_MASK;
  }
  return { ckA, ckB };
}

interface UbxParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseUbxFrame(data: Uint8Array, options: UbxParseOptions): ParseResult {
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

  const syncValid = byteAt(data, 0) === SYNC_BYTE_1 && byteAt(data, 1) === SYNC_BYTE_2;
  fields.push({
    id: 'sync',
    name: 'Sync',
    offset: 0,
    length: SYNC_LENGTH,
    rawBytes: data.slice(0, SYNC_LENGTH),
    rawValue: formatByteString(data.slice(0, SYNC_LENGTH)),
    valid: syncValid,
    warnings: [],
  });
  if (!syncValid) {
    // canParse zaten sync'i eler; buraya yalnız parse() doğrudan çağrıldığında
    // düşülür (DoIP'in inverse-version kontrolüyle aynı savunma katmanı).
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_SYNC,
      offset: 0,
      length: SYNC_LENGTH,
    });
  }

  const classByte = byteAt(data, CLASS_OFFSET);
  const className = UBX_CLASSES.get(classByte);
  const classField: ParsedField = {
    id: 'class',
    name: 'Class',
    offset: CLASS_OFFSET,
    length: 1,
    rawBytes: data.slice(CLASS_OFFSET, CLASS_OFFSET + 1),
    rawValue: classByte,
    valid: className !== undefined,
    warnings: [],
  };
  if (className !== undefined) {
    classField.physicalValue = className;
  } else {
    classField.warnings.push(WARN_UNKNOWN_CLASS);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_CLASS));
  }
  fields.push(classField);

  // ID sayısal tablosu spec'te de dış kaynakta da YOK (dosya başı) — ham kalır.
  const idByte = byteAt(data, ID_OFFSET);
  fields.push({
    id: 'message-id',
    name: 'Message ID',
    offset: ID_OFFSET,
    length: 1,
    rawBytes: data.slice(ID_OFFSET, ID_OFFSET + 1),
    rawValue: idByte,
    valid: true,
    warnings: [],
  });

  const declaredLength =
    byteAt(data, LENGTH_OFFSET) |
    ((byteAt(data, LENGTH_OFFSET + 1) & LENGTH_LOW_BYTE_MASK) << LENGTH_HIGH_BYTE_SHIFT);
  fields.push({
    id: 'length',
    name: 'Length',
    offset: LENGTH_OFFSET,
    length: LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(LENGTH_OFFSET, LENGTH_OFFSET + LENGTH_FIELD_LENGTH),
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const totalFrameLength = HEADER_LENGTH + declaredLength + CHECKSUM_LENGTH;

  if (data.length < totalFrameLength) {
    // DoIP'in `requireBytes` deseni: payload/checksum eksikse alan üretilmez,
    // ama sync/class/id/length yine gösterilir — kısmi çözüm (spec §47).
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
    }

    const checksumOffset = PAYLOAD_OFFSET + declaredLength;
    const receivedCkA = byteAt(data, checksumOffset);
    const receivedCkB = byteAt(data, checksumOffset + 1);
    // Kapsam: Class'tan payload sonuna kadar, sync HARİÇ (dosya başı notu).
    const { ckA: computedCkA, ckB: computedCkB } = computeUbxChecksum(
      data.slice(CLASS_OFFSET, checksumOffset),
    );
    const checksumValid = receivedCkA === computedCkA && receivedCkB === computedCkB;
    const checksumField: ParsedField = {
      id: 'checksum',
      name: 'Checksum',
      offset: checksumOffset,
      length: CHECKSUM_LENGTH,
      rawBytes: data.slice(checksumOffset, checksumOffset + CHECKSUM_LENGTH),
      rawValue: formatByteString(data.slice(checksumOffset, checksumOffset + CHECKSUM_LENGTH)),
      valid: checksumValid,
      warnings: [],
    };
    if (checksumValid) {
      checksumField.physicalValue = 'Valid';
    } else {
      errors.push({
        code: 'checksum-mismatch',
        message: ERROR_CHECKSUM_MISMATCH,
        offset: checksumOffset,
        length: CHECKSUM_LENGTH,
        details: {
          receivedCkA: formatHexByte(receivedCkA),
          receivedCkB: formatHexByte(receivedCkB),
          computedCkA: formatHexByte(computedCkA),
          computedCkB: formatHexByte(computedCkB),
        },
      });
    }
    fields.push(checksumField);

    const trailingOffset = checksumOffset + CHECKSUM_LENGTH;
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
    class: className ?? formatHexByte(classByte),
    id: formatHexByte(idByte),
  };

  const metadata: UbxFrameMetadata = {
    classByte,
    className,
    messageId: idByte,
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

export function parseUbx(data: Uint8Array): ParseResult {
  return parseUbxFrame(data, {});
}

export const ubxParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + iki sabit sync baytı. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    return byteAt(data, 0) === SYNC_BYTE_1 && byteAt(data, 1) === SYNC_BYTE_2;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: UbxParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseUbxFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. İlki spec'in TEK somut UBX bayt dizisi (dosya başı); diğerleri
 * motorla (checksum formülüyle) elle hesaplandı, uydurulmadı — hesap
 * `ubx.test.ts`te bağımsız ikinci bir uygulamayla çapraz doğrulanıyor.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'mon-ver-poll',
    name: 'protocol.ubx.example.monVerPoll.name',
    // Spec ~5355: B5 62 0A 06 00 00 10 3A — Class 0x0A (MON), ID 0x06, boş payload.
    bytes: new Uint8Array([0xb5, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x3a]),
    description: 'protocol.ubx.example.monVerPoll.description',
    expectedValid: true,
  },
  {
    id: 'payload-needs-database',
    name: 'protocol.ubx.example.payloadNeedsDatabase.name',
    // Class 0x01 (NAV), ID 0x07 ham; dört baytlık payload adlandırılmadan gösterilir.
    bytes: new Uint8Array([
      0xb5, 0x62, 0x01, 0x07, 0x04, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x44, 0x3b,
    ]),
    description: 'protocol.ubx.example.payloadNeedsDatabase.description',
    expectedValid: true,
  },
  {
    id: 'unknown-class',
    name: 'protocol.ubx.example.unknownClass.name',
    // Class 0x99 dar kümede yok — uyarı basılır ama çerçeve yine geçerli sayılır.
    bytes: new Uint8Array([0xb5, 0x62, 0x99, 0x01, 0x00, 0x00, 0x9a, 0x67]),
    description: 'protocol.ubx.example.unknownClass.description',
    expectedValid: true,
  },
  {
    id: 'checksum-mismatch',
    name: 'protocol.ubx.example.checksumMismatch.name',
    // Spec fixture'ının bozuk hâli: CK_B 0x3A yerine 0x00.
    bytes: new Uint8Array([0xb5, 0x62, 0x0a, 0x06, 0x00, 0x00, 0x10, 0x00]),
    description: 'protocol.ubx.example.checksumMismatch.description',
    expectedValid: false,
  },
];

export const ubxPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: ubxParser,
  documentation: {
    summary: 'protocol.ubx.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
