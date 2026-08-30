/**
 * NMEA 2000 — CAN tabanlı gemi içi ağın 29-bit identifier çözümü.
 *
 * NMEA 2000, IEC 61162-3'ün fiziksel/taşıma katmanıdır ve spec §14701'in 29-bit
 * identifier tablosu J1939'un §3.4 tablosuyla BİREBİR AYNIDIR (spec 14701 = 38503).
 * Bu yüzden identifier matematiği burada YENİDEN YAZILMAZ: `decodeJ1939Identifier`
 * doğrudan içe aktarılır. Girdi de aynı taşıyıcıdır — SocketCAN `struct can_frame`
 * (bkz. `canFrame.ts` dosya başı, J1939'un da kullandığı düzen).
 *
 * ── J1939'DAN FARKI: PGN ADI/NUMARA TABLOSU HİÇ YOK ─────────────────────────
 * J1939 sayfası en azından J1939-21'in YAPISAL PGN'lerini (Request, TP.CM, TP.DT,
 * Address Claimed) adlandırabiliyordu — o tablo lisanssız, taşıma katmanının kendi
 * belgesinden geliyordu. NMEA 2000 için böyle bir çıpa YOK: spec kapsam tablosu
 * "PGN isim/numara tablosu YOK, LİSANSLI — tek somut PGN bile geçmiyor" diyor
 * (14667). Bu yüzden burada PGN alanı HER ZAMAN ham numara olarak kalır, hiçbir
 * PGN'e isim atanmaz ve her çözümde `pgnNeedsDatabase` uyarısı basılır.
 *
 * ── FAST PACKET: BİRLEŞTİRME YOK, TANIMA DA İDDİALI DEĞİL ───────────────────
 * Spec Fast Packet'i yalnız kavramsal çerçeve listesi olarak veriyor (14742-14762);
 * seq/counter/total-length'in bayt0/bayt1'deki KODLAMASINI vermiyor. Hangi PGN'in
 * fast-packet olduğu da NMEA 2000 PGN veritabanına bağlı — tek bir CAN çerçevesinden
 * bu bilinemez (klasik CAN'de payload zaten en çok 8 bayt, yani bir fast-packet
 * parçası ile tam bir tek-çerçeve mesajı BAYTA BAKARAK ayırt edilemez). Bu yüzden:
 *   • bayt0/bayt1'e seq/length anlamı YAKIŞTIRILMAZ — payload tamamen ham kalır,
 *   • payload varsa `fastPacketUnknown` uyarısı basılır ("tam anlam çok parçalı
 *     oturum + PGN veritabanı ister"). J1939'un `transportSession` uyarısıyla TON
 *     olarak benzer ama SEBEBİ farklıdır: orada bilinen bir TP.CM/TP.DT mesajı
 *     çok-çerçeveli olduğu için oturum ister, burada HERHANGİ bir PGN veritabana
 *     bağlı olarak fast-packet olabileceği için oturum+DB ister. Bu yüzden ayrı
 *     bir anahtar kullanılıyor, `transportSession` yeniden kullanılmıyor.
 *
 * ── J1939 AYRIMI: OTOMATİK KESİN KARAR VERİLMEZ ──────────────────────────────
 * Identifier düzeni J1939 ile birebir aynı olduğu için TEK bir 29-bit çerçeveden
 * "bu kesinlikle NMEA 2000'dir" denemez (spec 15877, CAN 2.0B'nin
 * `suggestHigherLayers` uyarısının aynı şartı). Bu yüzden her çözümde
 * `possibleJ1939` uyarısı basılır — CAN 2.0B'nin `higherLayerCandidates`
 * uyarısıyla aynı tonda ama kendi anahtarıyla, çünkü burada aday tek (J1939),
 * orada aday kümesi geniştir (J1939/NMEA 2000/ISO-TP/CANopen/OEM).
 *
 * ── DURUM: 'ready' ───────────────────────────────────────────────────────────
 * Çerçeve düzeyi (identifier → Priority/PGN/Source/Destination) TAM ve doğrulanmış
 * formülle çözülüyor — J1939 sayfası da SPN'siz aynı gerekçeyle 'ready' etiketini
 * taşıyor. PGN içeriğinin adlandırılamaması (lisanslı DB) durumu 'partial'e
 * düşürmez; J1939 emsali burada da geçerli.
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

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  formatHex,
  readUint32Le,
} from '../../automotive/can/canFrame';
import { decodeJ1939Identifier, encodeJ1939Frame } from '../../automotive/j1939/j1939';

const PROTOCOL_ID = 'nmea-2000';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'NMEA 2000';

/** Bayt konumları — little-endian `can_id` sayesinde her alan kendi baytında (J1939 emsali). */
const SA_OFFSET = 0;
const PS_OFFSET = 1;
const PF_OFFSET = 2;
const PRIORITY_BYTE_OFFSET = 3;
/** PGN, DP + PF + PS baytlarını kapsar (bayt 1'den bayt 3'e). */
const PGN_FIELD_OFFSET = 1;
const PGN_FIELD_LENGTH = 3;
const DLC_OFFSET = 4;

const HEX_DIGITS_BYTE = 2;
const HEX_DIGITS_PGN = 4;

/** Yayın hedefi: bu adrese gönderilen PDU1 mesajı belirli bir düğüme değil herkesedir. */
const GLOBAL_DESTINATION_ADDRESS = 0xff;
/** ISO 11783/J1939 ile paylaşılan ağ yönetimi kuralı: 254 "null address". */
const NULL_SOURCE_ADDRESS = 0xfe;

const ERROR_FRAME_TOO_SHORT = 'protocol.nmea.2000.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.nmea.2000.error.frameTooLong';
const ERROR_NOT_EXTENDED = 'protocol.nmea.2000.error.notExtended';
const ERROR_ABORTED = 'protocol.nmea.2000.error.aborted';

const WARN_RESERVED_BIT_SET = 'protocol.nmea.2000.warning.reservedBitSet';
const WARN_NULL_SOURCE_ADDRESS = 'protocol.nmea.2000.warning.nullSourceAddress';
const WARN_REMOTE_FRAME = 'protocol.nmea.2000.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.nmea.2000.warning.truncatedPayload';
const WARN_PGN_NEEDS_DATABASE = 'protocol.nmea.2000.warning.pgnNeedsDatabase';
const WARN_FAST_PACKET_UNKNOWN = 'protocol.nmea.2000.warning.fastPacketUnknown';
const WARN_POSSIBLE_J1939 = 'protocol.nmea.2000.warning.possibleJ1939';

const SUMMARY_PDU1 = 'protocol.nmea.2000.summary.pdu1';
const SUMMARY_PDU2 = 'protocol.nmea.2000.summary.pdu2';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

export type Nmea2000FrameMetadata = {
  priority: number;
  pgn: number;
  pduFormatType: 'PDU1' | 'PDU2';
  sourceAddress: number;
  destinationAddress: number | undefined;
  payloadLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface Nmea2000ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseNmea2000Frame(data: Uint8Array, options: Nmea2000ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
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

  const maxFrameLength = options.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, 8, availableAfterHeader);

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: 0,
    length: 4,
    rawBytes: data.slice(0, 4),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: identity.extended,
    warnings: [],
  });

  if (!identity.extended) {
    // NMEA 2000 da J1939 gibi 29-bit identifier'a dayanır; 11 bitten PGN çıkarılamaz.
    // Yine de `success: true` döner ve CAN ID/DLC/veri gösterilir (spec §47).
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_NOT_EXTENDED,
      offset: 0,
      length: 4,
      details: { canId: formatHex(identity.id, 3), requiredFormat: 'extended' },
    });
  }

  const identifier =
    identity.extended === true ? decodeJ1939Identifier(identity.id) : undefined;

  if (identifier !== undefined) {
    fields.push({
      id: 'priority',
      name: 'Priority',
      offset: PRIORITY_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PRIORITY_BYTE_OFFSET, PRIORITY_BYTE_OFFSET + 1),
      rawValue: identifier.priority,
      valid: true,
      warnings: [],
    });

    const reservedField: ParsedField = {
      id: 'reserved',
      name: 'Reserved',
      offset: PRIORITY_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PRIORITY_BYTE_OFFSET, PRIORITY_BYTE_OFFSET + 1),
      rawValue: identifier.reserved,
      valid: identifier.reserved === 0,
      warnings: [],
    };
    if (identifier.reserved !== 0) {
      reservedField.warnings.push(WARN_RESERVED_BIT_SET);
      warnings.push(toProtocolWarning(WARN_RESERVED_BIT_SET));
    }
    fields.push(reservedField);

    fields.push({
      id: 'data-page',
      name: 'Data Page',
      offset: PRIORITY_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PRIORITY_BYTE_OFFSET, PRIORITY_BYTE_OFFSET + 1),
      rawValue: identifier.dataPage,
      valid: true,
      warnings: [],
    });

    fields.push({
      id: 'pdu-format',
      name: 'PDU Format',
      offset: PF_OFFSET,
      length: 1,
      rawBytes: data.slice(PF_OFFSET, PF_OFFSET + 1),
      rawValue: identifier.pduFormat,
      physicalValue: identifier.pduFormatType,
      valid: true,
      warnings: [],
    });

    fields.push({
      id: 'pdu-specific',
      name: identifier.pduFormatType === 'PDU1' ? 'Destination Address' : 'Group Extension',
      offset: PS_OFFSET,
      length: 1,
      rawBytes: data.slice(PS_OFFSET, PS_OFFSET + 1),
      rawValue: identifier.pduSpecific,
      ...(identifier.destinationAddress === GLOBAL_DESTINATION_ADDRESS
        ? { physicalValue: 'Global' }
        : {}),
      valid: true,
      warnings: [],
    });

    fields.push({
      id: 'pgn',
      name: 'PGN',
      offset: PGN_FIELD_OFFSET,
      length: PGN_FIELD_LENGTH,
      rawBytes: data.slice(PGN_FIELD_OFFSET, PGN_FIELD_OFFSET + PGN_FIELD_LENGTH),
      rawValue: identifier.pgn,
      // J1939'un aksine burada isim atanacak yapısal bir tablo bile yok — PGN
      // HER ZAMAN ham numara kalır (dosya başı kaynak uyarısı).
      valid: true,
      warnings: [],
    });
    warnings.push(toProtocolWarning(WARN_PGN_NEEDS_DATABASE));
    warnings.push(toProtocolWarning(WARN_POSSIBLE_J1939));

    const sourceField: ParsedField = {
      id: 'source-address',
      name: 'Source Address',
      offset: SA_OFFSET,
      length: 1,
      rawBytes: data.slice(SA_OFFSET, SA_OFFSET + 1),
      rawValue: identifier.sourceAddress,
      valid: true,
      warnings: [],
    };
    if (identifier.sourceAddress === NULL_SOURCE_ADDRESS) {
      sourceField.physicalValue = 'Null Address';
      sourceField.warnings.push(WARN_NULL_SOURCE_ADDRESS);
      warnings.push(toProtocolWarning(WARN_NULL_SOURCE_ADDRESS));
    }
    fields.push(sourceField);
  }

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (identity.remote) {
    warnings.push(toProtocolWarning(WARN_REMOTE_FRAME));
  }
  if (payloadLength < Math.min(declaredLength, 8)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  if (payloadLength > 0) {
    fields.push({
      id: 'data',
      name: 'Data',
      offset: CAN_HEADER_LENGTH,
      length: payloadLength,
      rawBytes: data.slice(CAN_HEADER_LENGTH, CAN_HEADER_LENGTH + payloadLength),
      unit: 'B',
      valid: true,
      warnings: [],
    });
    if (identifier !== undefined) {
      // Fast Packet birleştirme burada YAPILMAZ ve tek çerçeveden tanınmaya da
      // ÇALIŞILMAZ — dosya başı kaynak uyarısı.
      warnings.push(toProtocolWarning(WARN_FAST_PACKET_UNKNOWN));
    }
  }

  const summaryParams: Record<string, string> = {
    canId: formatHex(identity.id, 8),
    payloadLength: String(payloadLength),
  };
  if (identifier !== undefined) {
    summaryParams.pgn = String(identifier.pgn);
    summaryParams.pgnHex = formatHex(identifier.pgn, HEX_DIGITS_PGN);
    summaryParams.priority = String(identifier.priority);
    summaryParams.sourceAddress = formatHex(identifier.sourceAddress, HEX_DIGITS_BYTE);
    if (identifier.destinationAddress !== undefined) {
      summaryParams.destinationAddress = formatHex(identifier.destinationAddress, HEX_DIGITS_BYTE);
    }
  }

  const metadata: Nmea2000FrameMetadata = {
    priority: identifier?.priority ?? 0,
    pgn: identifier?.pgn ?? 0,
    pduFormatType: identifier?.pduFormatType ?? 'PDU2',
    sourceAddress: identifier?.sourceAddress ?? 0,
    destinationAddress: identifier?.destinationAddress,
    payloadLength,
    summaryKey: identifier?.pduFormatType === 'PDU1' ? SUMMARY_PDU1 : SUMMARY_PDU2,
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

export function parseNmea2000(data: Uint8Array): ParseResult {
  return parseNmea2000Frame(data, {});
}

export const nmea2000Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme (spec §7): uzunluk aralığı + extended bayrağı. NMEA 2000
   * identifier düzeni J1939 ile AYNI olduğu için bu ön eleme de aynı sonucu
   * verir — ayrım çerçeve düzeyinde yapılamaz (dosya başı "J1939 ayrımı").
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
      return false;
    }
    return decodeCanId(readUint32Le(data, 0)).extended;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: Nmea2000ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseNmea2000Frame(data, options);
  },
};

/**
 * Örnek çerçeveler. Hiçbiri gerçek bir NMEA 2000 PGN'inin İÇERİĞİNİ iddia etmez
 * (dosya başı: PGN isim/numara tablosu lisanslı) — yalnız identifier matematiğini
 * ve uyarı yollarını gösterirler. Adlar/açıklamalar çeviri anahtarı, baytlar veridir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'shared-j1939-fixture',
    name: 'protocol.nmea.2000.example.sharedJ1939Fixture.name',
    // J1939 §43 fixture'ının BİREBİR aynısı: identifier formülü ortak olduğu için
    // (spec 14701 = 38503) burada da Priority 6, PGN 61444, Source Address 1 çıkar.
    bytes: buildCanClassicFrame(
      0x18f00401,
      [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff],
      { extended: true },
    ),
    description: 'protocol.nmea.2000.example.sharedJ1939Fixture.description',
    expectedValid: true,
  },
  {
    id: 'single-frame-candidate',
    name: 'protocol.nmea.2000.example.singleFrameCandidate.name',
    // PF = 0xF2 = 242 ≥ 240 → PDU2, kısa (4 bayt) payload: tek çerçeveye sığıyor.
    bytes: buildCanClassicFrame(0x0cf20517, [0x00, 0x01, 0x02, 0x03], { extended: true }),
    description: 'protocol.nmea.2000.example.singleFrameCandidate.description',
    expectedValid: true,
  },
  {
    id: 'fast-packet-candidate',
    name: 'protocol.nmea.2000.example.fastPacketCandidate.name',
    // PF = 0xF5 = 245 ≥ 240 → PDU2, TAM 8 baytlık payload: tek başına bir
    // fast-packet parçası mı tam mesaj mı ayırt edilemez (dosya başı).
    bytes: buildCanClassicFrame(
      0x19f50a05,
      [0x00, 0x2a, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06],
      { extended: true },
    ),
    description: 'protocol.nmea.2000.example.fastPacketCandidate.description',
    expectedValid: true,
  },
  {
    id: 'wide-pgn-range',
    name: 'protocol.nmea.2000.example.widePgnRange.name',
    // Data Page 1: PGN 65536 ve üstü genişletilmiş aralığa düşer, yine tanınmaz.
    bytes: buildCanClassicFrame(0x09ffff01, [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff], {
      extended: true,
    }),
    description: 'protocol.nmea.2000.example.widePgnRange.description',
    expectedValid: true,
  },
  {
    id: 'pdu1-destination-specific',
    name: 'protocol.nmea.2000.example.pdu1DestinationSpecific.name',
    // PF = 0xEA = 234 < 240 → PDU1: PS (0x10) HEDEF ADRESTİR ve PGN'den düşülür.
    bytes: buildCanClassicFrame(0x14ea1022, [0x11, 0x22, 0x33], { extended: true }),
    description: 'protocol.nmea.2000.example.pdu1DestinationSpecific.description',
    expectedValid: true,
  },
  {
    id: 'base-frame-rejected',
    name: 'protocol.nmea.2000.example.baseFrameRejected.name',
    // 11-bit identifier: NMEA 2000 çözülemez, hata basılır ama çerçeve gösterilir.
    bytes: buildCanClassicFrame(0x321, [0xaa, 0xbb]),
    description: 'protocol.nmea.2000.example.baseFrameRejected.description',
    expectedValid: false,
  },
];

export const nmea2000Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: nmea2000Parser,
  /**
   * Encoder J1939'unkinin KENDİSİDİR, kopyası değil. NMEA 2000 identifier'ı
   * J1939-21'in identifier'ıdır (çözücü de bu dosyada `decodeJ1939Identifier`i
   * çağırıyor); ikinci bir üretici yazmak aynı biti iki yerde tanımlamak
   * olurdu. Farkı PGN'lerin ANLAMI taşır, tel biçimi değil.
   *
   * Girdi: öncelik + PGN + hedef + kaynak + veri (`encodeJ1939Frame`).
   */
  encoder: { encode: encodeJ1939Frame },
  documentation: {
    summary: 'protocol.nmea.2000.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
