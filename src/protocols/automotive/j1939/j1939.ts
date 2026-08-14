/**
 * SAE J1939 — 29-bit Classical CAN identifier'ının uygulama katmanı çözümü.
 *
 * J1939 ayrı bir TEL BİÇİMİ DEĞİLDİR: taşıyıcısı CAN 2.0B'dir ve girdisi aynı
 * SocketCAN `struct can_frame` kaydıdır (bkz. `canFrame.ts` dosya başı). Bu
 * dosyanın kattığı tek şey, identifier'ın 29 bitinin J1939 anlamına çevrilmesi.
 *
 * ── IDENTIFIER KIRILIMI (spec §3.4, birebir) ────────────────────────────────
 *   28        26 25 24 23        16 15         8 7          0
 *   +-----------+--+--+------------+------------+------------+
 *   | Priority  |R |DP|     PF     |     PS     |     SA     |
 *   +-----------+--+--+------------+------------+------------+
 *
 * TUZAK — SPEC'İN MODELİ "R", "EDP" DEĞİL: 25. bit spec'te **Reserved (R)**
 * olarak adlandırılıyor ve PGN formülü `DP << 16` ile bunu yansıtıyor. Güncel
 * SAE modelinde bu bit EDP'dir ve sayfa seçimi `(EDP << 17) | (DP << 16)`
 * olur. Spec'in verdiği model BİLEREK korunuyor: §43 fixture'ı bu modele göre
 * doğrulanmış ve modeli tek taraflı "düzeltmek" fixture'ı geçersiz kılardı.
 *
 * TUZAK — PS'İN ANLAMI PF'E BAĞLIDIR: PF < 240 ise (PDU1) PS bir HEDEF
 * ADRESTİR ve PGN hesabında SIFIRLANIR; PF ≥ 240 ise (PDU2) PS bir GROUP
 * EXTENSION'dır ve PGN'e GİRER. Ayrım yapılmazsa hedefli her mesajın PGN'i
 * hedef adres kadar kayar — aynı mesaj her alıcı için başka bir PGN gibi görünür.
 *
 * TUZAK — LITTLE-ENDIAN'IN İYİ YAN ETKİSİ: SocketCAN `can_id`i little-endian
 * tuttuğu için J1939'un dört alanı TEMİZ BAYT SINIRLARINA düşer:
 *   bayt 0 → SA · bayt 1 → PS · bayt 2 → PF · bayt 3 → Priority + R + DP
 * Bu yüzden byte-viewer'da her alan kendi baytını vurgular, bit maskesi
 * göstermek gerekmez.
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • SPN çözümü: spec SPN alan tanımlarını VERMİYOR ve gerekçesini yazıyor —
 *   J1939DA lisanslıdır, "decoder derinliği açık kaynakla tam kurulamaz".
 *   Tanım dosyasından beslenen çözüm DBC dalgasının (3b) işidir.
 * • Transport Protocol oturumu (BAM/RTS/CTS yeniden birleştirme): tek çerçeve
 *   parser'ı çok çerçeveli durum tutamaz; oturum kurmak analyzer katmanının işi.
 *   Burada yalnız çerçevenin bir TP mesajı OLDUĞU tanınır.
 * • PGN İSİMLERİ: spec tek bir PGN adı bile vermiyor. Uydurmak, spec'in açıkça
 *   uyardığı "yanlış kesinlik"tir; aşağıdaki tablo yalnız J1939-21'in YAPISAL
 *   (içerik değil, taşıma) PGN'lerini adlandırır.
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

import { buildCanClassicFrame } from '../can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  formatHex,
  readUint32Le,
} from '../can/canFrame';

const PROTOCOL_ID = 'j1939';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'J1939';

/** PDU1/PDU2 eşiği: PF'in 240 ve üstü yayın (group extension) demektir. */
export const PDU2_FORMAT_THRESHOLD = 240;

/** Bayt konumları — little-endian `can_id` sayesinde her alan kendi baytında. */
const SA_OFFSET = 0;
const PS_OFFSET = 1;
const PF_OFFSET = 2;
const PRIORITY_BYTE_OFFSET = 3;
/** PGN, DP + PF + PS baytlarını kapsar (bayt 1'den bayt 3'e). */
const PGN_FIELD_OFFSET = 1;
const PGN_FIELD_LENGTH = 3;
const DLC_OFFSET = 4;

const PRIORITY_SHIFT = 26;
const PRIORITY_MASK = 0x7;
const RESERVED_SHIFT = 25;
const DATA_PAGE_SHIFT = 24;
const SINGLE_BIT_MASK = 0x1;
const PF_SHIFT = 16;
const PS_SHIFT = 8;
const BYTE_MASK = 0xff;
const DATA_PAGE_PGN_SHIFT = 16;

const HEX_DIGITS_BYTE = 2;
const HEX_DIGITS_PGN = 4;

/** Yayın hedefi: bu adrese gönderilen PDU1 mesajı belirli bir düğüme değil herkesedir. */
const GLOBAL_DESTINATION_ADDRESS = 0xff;
/** J1939-21: 254 "null address" (adres talebi başarısız), 255 yayın. */
const NULL_SOURCE_ADDRESS = 0xfe;

const ERROR_FRAME_TOO_SHORT = 'protocol.j1939.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.j1939.error.frameTooLong';
const ERROR_NOT_EXTENDED = 'protocol.j1939.error.notExtended';
const ERROR_ABORTED = 'protocol.j1939.error.aborted';

const WARN_RESERVED_BIT_SET = 'protocol.j1939.warning.reservedBitSet';
const WARN_NULL_SOURCE_ADDRESS = 'protocol.j1939.warning.nullSourceAddress';
const WARN_REMOTE_FRAME = 'protocol.j1939.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.j1939.warning.truncatedPayload';
const WARN_SPN_NEEDS_DATABASE = 'protocol.j1939.warning.spnNeedsDatabase';
const WARN_TRANSPORT_SESSION = 'protocol.j1939.warning.transportSession';

const SUMMARY_PDU1 = 'protocol.j1939.summary.pdu1';
const SUMMARY_PDU2 = 'protocol.j1939.summary.pdu2';

/**
 * YALNIZ YAPISAL PGN'ler — J1939-21'in taşıma/ağ yönetimi mesajları. Bunlar
 * ARAÇ VERİSİ TAŞIMAZ, protokolün kendi işleyişidir; bu yüzden adlandırmak
 * lisanslı J1939DA içeriğine dokunmaz.
 *
 * ⚠️ Spec bu numaraları VERMİYOR (yalnız "BAM, RTS, CTS, DT, EndOfMsgAck,
 * Abort" mesaj tiplerini ve "Address claim", "Request PGN" özelliklerini
 * sayıyor). Numaralar J1939-21'dendir. İçerik PGN'leri (motor devri, sıcaklık…)
 * BİLEREK YOK: onlar J1939DA'dır ve tanım dosyası olmadan adlandırılamaz.
 */
export const J1939_STRUCTURAL_PGNS: ReadonlyMap<number, string> = new Map([
  [59904, 'Request'],
  [60160, 'TP.DT'],
  [60416, 'TP.CM'],
  [60928, 'Address Claimed'],
]);

/** Çözümlenmiş J1939 identifier'ı — arayüz ve testler bunun üzerinden konuşur. */
export interface J1939Identifier {
  readonly priority: number;
  readonly reserved: number;
  readonly dataPage: number;
  readonly pduFormat: number;
  readonly pduSpecific: number;
  readonly sourceAddress: number;
  readonly pgn: number;
  /** PDU1 hedeflidir (PS = destination), PDU2 yayındır (PS = group extension). */
  readonly pduFormatType: 'PDU1' | 'PDU2';
  /** Yalnız PDU1'de anlamlıdır; PDU2'de `undefined`. */
  readonly destinationAddress: number | undefined;
}

/**
 * 29-bit identifier'ı J1939 alanlarına ayırır ve PGN'i spec'in formülüyle
 * hesaplar. Saf fonksiyon: çerçeveden bağımsız olarak da çağrılabilir
 * (hesap araçları ve testler bunu kullanır).
 */
export function decodeJ1939Identifier(extendedId: number): J1939Identifier {
  const id = extendedId >>> 0;
  const priority = (id >>> PRIORITY_SHIFT) & PRIORITY_MASK;
  const reserved = (id >>> RESERVED_SHIFT) & SINGLE_BIT_MASK;
  const dataPage = (id >>> DATA_PAGE_SHIFT) & SINGLE_BIT_MASK;
  const pduFormat = (id >>> PF_SHIFT) & BYTE_MASK;
  const pduSpecific = (id >>> PS_SHIFT) & BYTE_MASK;
  const sourceAddress = id & BYTE_MASK;

  const isPdu2 = pduFormat >= PDU2_FORMAT_THRESHOLD;
  // Spec §18: PDU1'de PS hedef adrestir ve PGN'den DÜŞÜLÜR; PDU2'de group
  // extension olarak PGN'e girer.
  const pgn = isPdu2
    ? (dataPage << DATA_PAGE_PGN_SHIFT) | (pduFormat << PS_SHIFT) | pduSpecific
    : (dataPage << DATA_PAGE_PGN_SHIFT) | (pduFormat << PS_SHIFT);

  return {
    priority,
    reserved,
    dataPage,
    pduFormat,
    pduSpecific,
    sourceAddress,
    pgn,
    pduFormatType: isPdu2 ? 'PDU2' : 'PDU1',
    destinationAddress: isPdu2 ? undefined : pduSpecific,
  };
}

export type J1939FrameMetadata = {
  priority: number;
  pgn: number;
  pduFormatType: 'PDU1' | 'PDU2';
  sourceAddress: number;
  destinationAddress: number | undefined;
  payloadLength: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

interface J1939ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseJ1939Frame(data: Uint8Array, options: J1939ParseOptions): ParseResult {
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
    // J1939 TANIMI GEREĞİ 29-bit identifier'a dayanır; 11 bitten PGN çıkarılamaz.
    // Yine de `success: true` döner ve CAN ID/DLC/veri alanları gösterilir
    // (spec §47): kullanıcı neyin yanlış olduğunu ancak çerçeveyi görürse anlar.
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_NOT_EXTENDED,
      offset: 0,
      length: 4,
      details: { canId: formatHex(identity.id, 3), requiredFormat: 'extended' },
    });
  }

  const j1939 =
    identity.extended === true ? decodeJ1939Identifier(identity.id) : undefined;

  if (j1939 !== undefined) {
    fields.push({
      id: 'priority',
      name: 'Priority',
      offset: PRIORITY_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PRIORITY_BYTE_OFFSET, PRIORITY_BYTE_OFFSET + 1),
      rawValue: j1939.priority,
      valid: true,
      warnings: [],
    });

    const reservedField: ParsedField = {
      id: 'reserved',
      name: 'Reserved',
      offset: PRIORITY_BYTE_OFFSET,
      length: 1,
      rawBytes: data.slice(PRIORITY_BYTE_OFFSET, PRIORITY_BYTE_OFFSET + 1),
      rawValue: j1939.reserved,
      valid: j1939.reserved === 0,
      warnings: [],
    };
    if (j1939.reserved !== 0) {
      // Spec'in modelinde bu bit ayrılmıştır. Set olması ya güncel EDP
      // semantiğinin kullanıldığını ya da identifier'ın bozuk olduğunu gösterir.
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
      rawValue: j1939.dataPage,
      valid: true,
      warnings: [],
    });

    fields.push({
      id: 'pdu-format',
      name: 'PDU Format',
      offset: PF_OFFSET,
      length: 1,
      rawBytes: data.slice(PF_OFFSET, PF_OFFSET + 1),
      rawValue: j1939.pduFormat,
      // PDU1/PDU2 ayrımı bu alandan TÜRETİLİR; kullanıcının eşiği ezberlemesi
      // gerekmesin diye sonucu alanın kendisi söyler.
      physicalValue: j1939.pduFormatType,
      valid: true,
      warnings: [],
    });

    fields.push({
      id: 'pdu-specific',
      name: j1939.pduFormatType === 'PDU1' ? 'Destination Address' : 'Group Extension',
      offset: PS_OFFSET,
      length: 1,
      rawBytes: data.slice(PS_OFFSET, PS_OFFSET + 1),
      rawValue: j1939.pduSpecific,
      ...(j1939.destinationAddress === GLOBAL_DESTINATION_ADDRESS
        ? { physicalValue: 'Global' }
        : {}),
      valid: true,
      warnings: [],
    });

    const pgnField: ParsedField = {
      id: 'pgn',
      name: 'PGN',
      offset: PGN_FIELD_OFFSET,
      length: PGN_FIELD_LENGTH,
      rawBytes: data.slice(PGN_FIELD_OFFSET, PGN_FIELD_OFFSET + PGN_FIELD_LENGTH),
      rawValue: j1939.pgn,
      valid: true,
      warnings: [],
    };
    const structuralName = J1939_STRUCTURAL_PGNS.get(j1939.pgn);
    if (structuralName !== undefined) {
      // Protokol terimi — veridir, çevrilmez.
      pgnField.physicalValue = structuralName;
      warnings.push(toProtocolWarning(WARN_TRANSPORT_SESSION));
    }
    fields.push(pgnField);

    const sourceField: ParsedField = {
      id: 'source-address',
      name: 'Source Address',
      offset: SA_OFFSET,
      length: 1,
      rawBytes: data.slice(SA_OFFSET, SA_OFFSET + 1),
      rawValue: j1939.sourceAddress,
      valid: true,
      warnings: [],
    };
    if (j1939.sourceAddress === NULL_SOURCE_ADDRESS) {
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
    if (j1939 !== undefined && J1939_STRUCTURAL_PGNS.get(j1939.pgn) === undefined) {
      // Payload'ın SPN'lere ayrılması lisanslı J1939DA gerektirir; ham gösterip
      // sebebini söylemek, uydurma alan adları basmaktan doğrudur.
      warnings.push(toProtocolWarning(WARN_SPN_NEEDS_DATABASE));
    }
  }

  const summaryParams: Record<string, string> = {
    canId: formatHex(identity.id, 8),
    payloadLength: String(payloadLength),
  };
  if (j1939 !== undefined) {
    summaryParams.pgn = String(j1939.pgn);
    summaryParams.pgnHex = formatHex(j1939.pgn, HEX_DIGITS_PGN);
    summaryParams.priority = String(j1939.priority);
    summaryParams.sourceAddress = formatHex(j1939.sourceAddress, HEX_DIGITS_BYTE);
    if (j1939.destinationAddress !== undefined) {
      summaryParams.destinationAddress = formatHex(j1939.destinationAddress, HEX_DIGITS_BYTE);
    }
  }

  const metadata: J1939FrameMetadata = {
    priority: j1939?.priority ?? 0,
    pgn: j1939?.pgn ?? 0,
    pduFormatType: j1939?.pduFormatType ?? 'PDU2',
    sourceAddress: j1939?.sourceAddress ?? 0,
    destinationAddress: j1939?.destinationAddress,
    payloadLength,
    summaryKey: j1939?.pduFormatType === 'PDU1' ? SUMMARY_PDU1 : SUMMARY_PDU2,
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

export function parseJ1939(data: Uint8Array): ParseResult {
  return parseJ1939Frame(data, {});
}

export const j1939Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * UCUZ ön eleme (spec §7): uzunluk aralığı + extended bayrağı. Extended
   * OLMAYAN çerçeve burada elenir çünkü J1939 tanımı gereği 29-bit'tir —
   * otomatik tanımada her base çerçeveyi J1939 adayı saymak gürültü olurdu.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
      return false;
    }
    return decodeCanId(readUint32Le(data, 0)).extended;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: J1939ParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseJ1939Frame(data, options);
  },
};

/**
 * Örnek çerçeveler. İlk örnek spec §43'ün DOĞRULANMIŞ fixture'ıdır
 * (`0x18F00401` → Priority 6, PGN 61444, Source Address 1); kalanlar PDU1/PDU2
 * ayrımını, yapısal PGN tanımayı ve hata yolunu gösterir. Adlar/açıklamalar
 * çeviri anahtarı, baytlar veridir.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'pdu2-broadcast',
    name: 'protocol.j1939.example.pdu2Broadcast.name',
    // Spec §43: 0x18F00401 → Priority 6, PGN 61444, Source address 1.
    // PF = 0xF0 = 240 ≥ 240 → PDU2, PS = 0x04 group extension olarak PGN'e girer.
    bytes: buildCanClassicFrame(
      0x18f00401,
      [0xff, 0xff, 0xff, 0x68, 0x13, 0xff, 0xff, 0xff],
      { extended: true },
    ),
    description: 'protocol.j1939.example.pdu2Broadcast.description',
    expectedValid: true,
  },
  {
    id: 'pdu1-destination-specific',
    name: 'protocol.j1939.example.pdu1DestinationSpecific.name',
    // PF = 0xEF = 239 < 240 → PDU1: PS (0x2A = 42) HEDEF ADRESTİR ve PGN'den
    // düşülür → PGN 61184, kaynak 0x0B = 11.
    bytes: buildCanClassicFrame(0x18ef2a0b, [0x01, 0x02, 0x03, 0x04], { extended: true }),
    description: 'protocol.j1939.example.pdu1DestinationSpecific.description',
    expectedValid: true,
  },
  {
    id: 'address-claimed',
    name: 'protocol.j1939.example.addressClaimed.name',
    // PGN 60928 (0xEE00): yapısal mesaj, hedef 0xFF = yayın.
    bytes: buildCanClassicFrame(
      0x18eeff00,
      [0x00, 0x00, 0x40, 0x00, 0x00, 0x81, 0x00, 0x20],
      { extended: true },
    ),
    description: 'protocol.j1939.example.addressClaimed.description',
    expectedValid: true,
  },
  {
    id: 'transport-data-transfer',
    name: 'protocol.j1939.example.transportDataTransfer.name',
    // PGN 60160 (0xEB00) = TP.DT: çok paketli aktarımın veri paketi.
    bytes: buildCanClassicFrame(
      0x1cebff00,
      [0x01, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77],
      { extended: true },
    ),
    description: 'protocol.j1939.example.transportDataTransfer.description',
    expectedValid: true,
  },
  {
    id: 'base-frame-rejected',
    name: 'protocol.j1939.example.baseFrameRejected.name',
    // 11-bit identifier: J1939 çözülemez, hata basılır ama çerçeve gösterilir.
    bytes: buildCanClassicFrame(0x123, [0xaa, 0xbb, 0xcc, 0xdd]),
    description: 'protocol.j1939.example.baseFrameRejected.description',
    expectedValid: false,
  },
];

export const j1939Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: j1939Parser,
  documentation: {
    summary: 'protocol.j1939.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
