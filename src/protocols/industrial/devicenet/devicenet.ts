/**
 * DeviceNet — CAN veri-bağı üzerinde CIP.
 *
 * Faz 10, dalga 13d. `cip-can-based` ailesinin ikinci taşıyıcısı: CIP nesne
 * modeli AYNI (`cipCore.ts`, dosya başı orada), ama burada taşıyıcı Ethernet
 * DEĞİL CAN'dir. CAN veri-bağı motoru İKİNCİ KEZ YAZILMADI —
 * `canopen.ts:57`in `automotive/can/canClassic`i PAYLAŞMA emsali BİREBİR
 * izlendi (brief-faz10-dalga13.md'nin 1. brief-düzeltmesi, "cross-domain
 * paylaşım emsali VAR" bulgusu).
 *
 * ── KAYNAK UYARISI ───────────────────────────────────────────────────────────
 * ODVA'nın DeviceNet Adaptation of CIP (Volume 3) ÜCRETLİdir ve bu depoda
 * YOK. 11-bit CAN identifier'ının Message Group'lara bölünmesi aşağıdaki
 * kamuya açık ikincil kaynaklardan alındı; her biri BAĞIMSIZ yazılmış genel
 * DeviceNet tanıtım/eğitim sayfası (ODVA'nın kendi Volume 3'ünün YERİNE
 * geçmez, ama Group 1/Group 2 sınırları için birbirinden bağımsız İKİ
 * kaynakta AYNI sayısal aralıkta örtüşüyor):
 *   - element14 Community "Tech Spotlight: DeviceNet Protocol"
 *     https://community.element14.com/learn/learning-center/the-tech-connection/w/documents/4655/tech-spotlight-devicenet-protocol
 *   - Grokipedia "DeviceNet" özet sayfası
 *     https://grokipedia.com/page/DeviceNet
 *   - embien.com "A Comprehensive Guide to the ODVA DeviceNet Protocol"
 *     https://www.embien.com/industrial-insights/a-comprehensive-guide-to-odva-devicenet-protocol
 * Üçü de AYNI bit yerleşimini veriyor: **Group 1** = CAN ID bit10=0 (aralık
 * `0x000-0x3FF`), Message ID bit9-6 (4 bit), MAC ID bit5-0 (6 bit — aritmetik
 * olarak tutarlı: 1+4+6=11 bit, 15×64+63=0x3FF). **Group 2** = bit10=1,
 * bit9=0 (aralık `0x400-0x5FF`), Message ID bit8-6 (3 bit), MAC ID bit5-0
 * (2+3+6=11 bit, aralık BİREBİR `0x400-0x5FF` ile örtüşüyor). MAC ID (Node
 * Address) her iki grupta da 0-63 aralığında 6 bit — Wikipedia "DeviceNet"
 * makalesiyle de teyitli ("node address … by 0–63").
 *
 * ── TUZAK: GRUP FARKLI ALAN GENİŞLİĞİ (brief'in 12e GetBulk dersiyle aynı
 *    sınıf: "aynı bitler, farklı grup, başka anlam") ─────────────────────────
 * Group 1'in Message ID alanı 4 bit, Group 2/3'ünki 3 bittir — grup ÖNCE
 * bit10/bit9'dan belirlenmeden Message ID'yi sabit genişlikte okumak YANLIŞ
 * sonuç üretir. `decodeDeviceNetIdentity` bu yüzden İKİ AŞAMALI: önce grup,
 * sonra grubun genişliğine göre Message ID/MAC ID.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA, dürüstçe) ────────────────────────────
 * **Group 3 ile Group 4'ün kesin sınırı çözülmedi.** Kaynaklar bit10=1,bit9=1
 * (aralık `0x600-0x7FF`) için "Group 3 mesajlar için kullanılır… Group 4
 * ileride kullanılmak üzere ayrılmıştır" diyor ama Group 3'ün numeric
 * üst sınırını ve Group 4'ün (Duplicate MAC ID Check gibi) SABİT kimliklerini
 * veren İKİNCİ bağımsız kaynak bulunamadı — bu yüzden `0x600-0x7FF` TEK bir
 * "Group 3/4" etiketiyle gösterilir, Message ID/MAC ID aynı 3+6 bit
 * biçimiyle (Group 2 ile aynı genişlik, yalnız taban ofseti farklı) HAM
 * SAYI olarak basılır, isim ATANMAZ.
 * **Message ID'nin SAYISAL DEĞERİNİN anlamı** (ör. "bu Poll Command mı yoksa
 * Bit-Strobe Response mı") da adlandırılmadı — bu, CANopen'ın PDO içeriğini
 * EDS'e bırakmasıyla AYNI sınır: Predefined Master/Slave Connection Set
 * tablosu ODVA'nın ücretli spec'indedir, dar/çelişkili ikincil kaynaklarla
 * uydurulmadı.
 * **Fragmentation Protocol** (>8 baytlık CIP mesajları için DeviceNet'in
 * kendi parçalama başlığı) uygulanmadı — dar kapsam, tek CAN çerçevesi
 * (≤8 bayt payload) sınırı içinde kalınır.
 *
 * ── PAYLOAD: decodeOptions GEREKÇESİ ────────────────────────────────────────
 * Yukarıdaki kapsam dışı notu nedeniyle, bir DeviceNet payload'ının I/O
 * verisi mi yoksa CIP Explicit Message mi taşıdığı bu motorun sahip olduğu
 * kaynaklarla ÇERÇEVEDEN GÜVENİLİR biçimde çıkarılamıyor (Predefined Master/
 * Slave Connection Set tablosu olmadan Message ID'nin sayısal değeri tek
 * başına yeterli değil). Bu, 12f'nin WebSocket MASK-biti dersinin TERSİ:
 * orada kanal GEREKSİZDİ çünkü ayrım çerçevenin içindeydi; burada ayrım
 * GERÇEKTEN çerçeveden çıkarılamıyor (kullanıcı sistem bağlamından bilir) —
 * `iec-60870-5-101`in link adresi genişliği kanalıyla AYNI gerekçe sınıfı.
 * Varsayılan HAM (`raw`): kullanıcı payload'ın explicit mesaj olduğunu
 * bildiğinde `cip-explicit`e çevirip AYNI `cipCore.ts`yi tüketebilir.
 */

import { decodeCipMessage } from '../cip/cipCore';
import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../../automotive/can/canFrame';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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

const PROTOCOL_ID = 'devicenet';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DeviceNet';

const MAC_ID_MASK = 0x3f;
const GROUP_1_MAX_ID = 0x3ff;
const GROUP_2_MAX_ID = 0x5ff;
const GROUP_1_MESSAGE_ID_MASK = 0x0f;
const GROUP_23_MESSAGE_ID_MASK = 0x07;

export type DeviceNetGroup = 'group-1' | 'group-2' | 'group-3-or-4';

const GROUP_LABELS: Readonly<Record<DeviceNetGroup, string>> = {
  'group-1': 'Group 1',
  'group-2': 'Group 2',
  'group-3-or-4': 'Group 3/4',
};

function resolveGroup(canId: number): DeviceNetGroup {
  if (canId <= GROUP_1_MAX_ID) return 'group-1';
  if (canId <= GROUP_2_MAX_ID) return 'group-2';
  return 'group-3-or-4';
}

function resolveMessageId(canId: number, group: DeviceNetGroup): number {
  const mask = group === 'group-1' ? GROUP_1_MESSAGE_ID_MASK : GROUP_23_MESSAGE_ID_MASK;
  return (canId >>> 6) & mask;
}

function resolveMacId(canId: number): number {
  return canId & MAC_ID_MASK;
}

const OPTION_PAYLOAD_INTERPRETATION = 'payloadInterpretation';
const PAYLOAD_RAW = 'raw';
const PAYLOAD_CIP_EXPLICIT = 'cip-explicit';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_PAYLOAD_INTERPRETATION,
    label: 'protocol.devicenet.option.payloadInterpretation',
    kind: 'select',
    defaultValue: PAYLOAD_RAW,
    description: 'protocol.devicenet.option.payloadInterpretation.description',
    choices: [
      { value: PAYLOAD_RAW, label: 'protocol.devicenet.option.payloadInterpretation.raw' },
      {
        value: PAYLOAD_CIP_EXPLICIT,
        label: 'protocol.devicenet.option.payloadInterpretation.cipExplicit',
      },
    ],
  },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.devicenet.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.devicenet.error.frameTooLong';
const ERROR_ABORTED = 'protocol.devicenet.error.aborted';
const ERROR_EXTENDED_NOT_SUPPORTED = 'protocol.devicenet.error.extendedNotSupported';

const WARN_TRUNCATED_PAYLOAD = 'protocol.devicenet.warning.truncatedPayload';

const SUMMARY_PREFIX = 'protocol.devicenet.summary.';

/** Çeviri anahtarı segmentlerinde tire olamaz (canopen.ts'teki AYNI kural). */
const GROUP_SUMMARY_KEY_SUFFIXES: Readonly<Record<DeviceNetGroup, string>> = {
  'group-1': 'group1',
  'group-2': 'group2',
  'group-3-or-4': 'group3Or4',
};

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

export type DeviceNetFrameMetadata = {
  group: DeviceNetGroup;
  messageId: number;
  macId: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface DeviceNetParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  payloadInterpretation: string;
}

function resolveParseOptions(context: ParseContext | undefined): DeviceNetParseOptions {
  const raw = context?.options?.[OPTION_PAYLOAD_INTERPRETATION];
  const payloadInterpretation = raw === PAYLOAD_CIP_EXPLICIT ? PAYLOAD_CIP_EXPLICIT : PAYLOAD_RAW;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    payloadInterpretation,
  };
}

function parseDeviceNetFrame(data: Uint8Array, options: DeviceNetParseOptions): ParseResult {
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

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: 0,
    length: 4,
    rawBytes: data.slice(0, 4),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: !identity.extended,
    warnings: [],
  });

  const declaredLength = byteAt(data, 4);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, 8, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (payloadLength < Math.min(declaredLength, 8)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  let group: DeviceNetGroup = 'group-1';
  let messageId = -1;
  let macId = -1;

  if (identity.extended) {
    // DeviceNet Predefined Master/Slave Connection Set yalnız BASE (11-bit)
    // identifier tanımlar (CANopen'ın aynı kısıtıyla AYNI gerekçe).
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_EXTENDED_NOT_SUPPORTED,
      offset: 0,
      length: 4,
      details: { canId: identity.id },
    });
  } else {
    group = resolveGroup(identity.id);
    messageId = resolveMessageId(identity.id, group);
    macId = resolveMacId(identity.id);

    fields.push({
      id: 'group',
      name: 'Message Group',
      offset: 0,
      length: 2,
      rawBytes: data.slice(0, 2),
      rawValue: identity.id,
      physicalValue: GROUP_LABELS[group],
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'message-id',
      name: 'Message ID',
      offset: 0,
      length: 2,
      rawBytes: data.slice(0, 2),
      rawValue: messageId,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'mac-id',
      name: 'MAC ID',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: macId,
      valid: true,
      warnings: [],
    });

    if (payloadLength > 0) {
      if (options.payloadInterpretation === PAYLOAD_CIP_EXPLICIT) {
        decodeCipMessage(
          data,
          CAN_HEADER_LENGTH,
          CAN_HEADER_LENGTH + payloadLength,
          fields,
          warnings,
          errors,
          'cip-',
        );
      } else {
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
      }
    }
  }

  const summaryParams: Record<string, string> = {
    canId: identity.id.toString(16).toUpperCase(),
    payloadLength: String(payloadLength),
  };
  if (!identity.extended) {
    summaryParams.macId = String(macId);
    summaryParams.messageId = String(messageId);
  }

  const metadata: DeviceNetFrameMetadata = {
    group,
    messageId,
    macId,
    summaryKey: `${SUMMARY_PREFIX}${identity.extended ? 'extendedRejected' : GROUP_SUMMARY_KEY_SUFFIXES[group]}`,
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

export function parseDeviceNet(data: Uint8Array): ParseResult {
  return parseDeviceNetFrame(data, { payloadInterpretation: PAYLOAD_RAW });
}

export const deviceNetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: yalnız uzunluk aralığı + base identifier. CANopen'ın
   * aksine DeviceNet'in HER 11-bit değeri bir gruba düşer (reserved bir
   * function code kümesi yok), bu yüzden ID bazlı ek eleme YAPILMAZ.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < CAN_HEADER_LENGTH || data.length > CAN_CLASSIC_FRAME_LENGTH) {
      return false;
    }
    return !decodeCanId(readUint32Le(data, 0)).extended;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseDeviceNetFrame(data, resolveParseOptions(context));
  },
};

/**
 * Örnek çerçeveler `buildCanClassicFrame`den kurulur (canopen.ts emsali) —
 * `can_id`in little-endian sırası tek yerde yaşasın diye elle hex yazılmaz.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'group-1-poll-response-node-5',
    name: 'protocol.devicenet.example.group1PollResponseNode5.name',
    // CAN ID 0x145 = (Message ID 5 << 6) | MAC ID 5 → Group 1, dört bit Message ID.
    bytes: buildCanClassicFrame(0x145, [0x37, 0x12, 0xdc, 0x05]),
    description: 'protocol.devicenet.example.group1PollResponseNode5.description',
    expectedValid: true,
  },
  {
    id: 'group-2-message-node-10',
    name: 'protocol.devicenet.example.group2MessageNode10.name',
    // CAN ID 0x4CA = 0x400 | (Message ID 3 << 6) | MAC ID 10 → Group 2, üç bit Message ID.
    bytes: buildCanClassicFrame(0x4ca, [0x01]),
    description: 'protocol.devicenet.example.group2MessageNode10.description',
    expectedValid: true,
  },
  {
    id: 'group-3-or-4-unnamed',
    name: 'protocol.devicenet.example.group3Or4Unnamed.name',
    // CAN ID 0x6C1 = 0x600 | (Message ID 3 << 6) | MAC ID 1 — dosya başı notu:
    // Group 3/4 sınırı adlandırılmadı, ham sayı gösterilir.
    bytes: buildCanClassicFrame(0x6c1, [0xaa]),
    description: 'protocol.devicenet.example.group3Or4Unnamed.description',
    expectedValid: true,
  },
  {
    id: 'explicit-message-get-attribute-single',
    name: 'protocol.devicenet.example.explicitMessageGetAttributeSingle.name',
    // Group 2, MAC ID 1, payload'da HAM bir Get_Attribute_Single isteği
    // (`payloadInterpretation=cip-explicit` seçilince cipCore ile çözülür).
    bytes: buildCanClassicFrame(0x441, [0x0e, 0x02, 0x20, 0x01, 0x24, 0x01]),
    description: 'protocol.devicenet.example.explicitMessageGetAttributeSingle.description',
    expectedValid: true,
  },
  {
    id: 'extended-identifier-rejected',
    name: 'protocol.devicenet.example.extendedIdentifierRejected.name',
    bytes: buildCanClassicFrame(0x18f00401, [0x00], { extended: true }),
    description: 'protocol.devicenet.example.extendedIdentifierRejected.description',
    expectedValid: false,
  },
];

export const deviceNetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: deviceNetParser,
  documentation: {
    summary: 'protocol.devicenet.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'element14 Community — Tech Spotlight: DeviceNet Protocol',
        url: 'https://community.element14.com/learn/learning-center/the-tech-connection/w/documents/4655/tech-spotlight-devicenet-protocol',
      },
      {
        title: 'embien.com — A Comprehensive Guide to the ODVA DeviceNet Protocol',
        url: 'https://www.embien.com/industrial-insights/a-comprehensive-guide-to-odva-devicenet-protocol',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
