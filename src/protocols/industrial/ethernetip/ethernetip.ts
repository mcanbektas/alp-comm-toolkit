/**
 * EtherNet/IP — ODVA'nın standart TCP/IP/UDP üzerinde CIP taşıma zarfı.
 *
 * Faz 10, dalga 13d. Encapsulation başlığı + Common Packet Format (CPF) BU
 * dosyada; CIP mesajının kendisi (Service/Path/Status) `cipCore.ts`e
 * DEVREDİLİR — brief'in "CIP çekirdek motoru önce yazılıp iki taşıyıcı onu
 * tüketir" isteğinin EtherNet/IP ayağı (`cipCore.ts` dosya başına bakınız,
 * kaynak/kapsam notları orada tekrar edilmez).
 *
 * ── KAYNAK UYARISI ───────────────────────────────────────────────────────────
 * ODVA'nın EtherNet/IP Adaptation of CIP (Volume 2) ÜCRETLİdir ve bu depoda
 * YOK. Aşağıdaki alan yerleşimleri İKİ bağımsız kamuya açık kaynaktan ÇAPRAZ
 * TEYİTLE alındı:
 *   O = OpENer (`source/src/enet_encap/encap.h`) — `EncapsulationData` struct
 *       alan SIRASI (command_code → data_length → session_handle → status →
 *       sender_context → options) ve `ENCAPSULATION_HEADER_LENGTH = 24`.
 *       https://github.com/EIPStackGroup/OpENer
 *   W = Wireshark `epan/dissectors/packet-enip.c` (GPL-2.0, bağımsız
 *       implementasyon) — `encap_cmd_vals` (komut kodları), `encap_status_vals`
 *       (encapsulation status kodları), `cpf_type_vals` (CPF item tipi id'leri).
 *       https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-enip.c
 *   Ayrıca SendRRData/SendUnitData'nın "Interface Handle(4) + Timeout(2) +
 *   CPF" gövdesi ve Connected Data Item'ın CIP mesajından ÖNCE bir Sequence
 *   Count(2) taşıdığı, digitalpetri/ethernet-ip (Apache-2.0, bağımsız Java/
 *   Scala implementasyonu) `SendRRData.java`/`SendUnitData.java` ile teyitli.
 *   https://github.com/digitalpetri/ethernet-ip
 *
 * Çakışma bulunmadı; hepsi aynı 8 komut kodunda, aynı CPF tipi id'lerinde
 * ve aynı 24 baytlık başlık uzunluğunda örtüşüyor.
 *
 * ── TEL BİÇİMİ ÖZETİ (hepsi LITTLE-ENDIAN, brief'in beklentisiyle uyumlu) ────
 * Encapsulation Header (24 bayt SABİT): Command(2) + Length(2) + Session
 * Handle(4) + Status(4) + Sender Context(8, opak) + Options(4).
 * SendRRData/SendUnitData'nın command-specific data'sı: Interface Handle(4,
 * "0 olmalı") + Timeout(2, SendUnitData'da "0 olmalı") + CPF (Item Count(2) +
 * {Type ID(2), Length(2), Data(Length)} dizisi — Item Count SendRRData'da
 * TİPİK OLARAK 2 (bir Address Item + bir Data Item), ama alan genel CPF
 * yürüyücüsüyle sayıya BAKMADAN okunur.
 *
 * ── KAPSAM — neyin çözüldüğü, neyin HAM bırakıldığı ─────────────────────────
 * ÇÖZÜLÜR: Encapsulation başlığının TAMAMI (8 komut + 8 status kodu
 * adlandırılır); RegisterSession'ın Protocol Version/Options Flags'i;
 * SendRRData/SendUnitData'nın Interface Handle/Timeout/CPF Item Count'u; CPF
 * item'larının Type/Length'i; Connected/Unconnected Data Item'ların İÇİNDEKİ
 * CIP mesajı `decodeCipMessage`ye devredilerek TAM çözülür (Connected Data
 * Item'da önce Sequence Count ayrılır); Connected Address Item'ın Connection
 * ID'si.
 * HAM BIRAKILIR (bilerek): ListServices/ListIdentity/ListInterfaces'in
 * command-specific gövdesi (kendi CPF-benzeri ama farklı iç yapıları var,
 * bu dalganın odağı Session+CIP+Explicit/Implicit Messaging — brief'in
 * araç listesi); Socket Address Info / Sequenced Address / List Services
 * Response CPF item'larının içeriği (ad çözülür, gövde ham kalır — OPC UA'nın
 * "69 servisin gövdesi ham" kapsam kararıyla AYNI disiplin).
 *
 * ── decodeOptions GEREKMİYOR ─────────────────────────────────────────────────
 * Komut kodu command-specific data'nın biçimini SEÇER, CPF item tipi kendi
 * içeriğini SEÇER, CIP Service baytının 7. biti istek/yanıtı SEÇER — hepsi
 * çerçevenin kendisinden okunur (brief'in "önce çerçeveden çıkarılabilir mi
 * kontrol et" talimatı; 12f'nin WebSocket MASK-biti dersi).
 */

import { decodeCipMessage } from '../cip/cipCore';
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

const PROTOCOL_ID = 'ethernet-ip';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'EtherNet/IP';

const HEADER_LENGTH = 24;
const SENDER_CONTEXT_LENGTH = 8;

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function readUint32Le(data: Uint8Array, offset: number): number {
  const value =
    byteAt(data, offset) |
    (byteAt(data, offset + 1) << 8) |
    (byteAt(data, offset + 2) << 16) |
    (byteAt(data, offset + 3) << 24);
  return value >>> 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function pushRawField(
  fields: ParsedField[],
  id: string,
  name: string,
  data: Uint8Array,
  offset: number,
  length: number,
): void {
  if (length <= 0) return;
  fields.push({
    id,
    name,
    offset,
    length,
    rawBytes: data.slice(offset, offset + length),
    unit: 'B',
    valid: true,
    warnings: [],
  });
}

// ── Encapsulation komut/status tabloları (O+W çapraz teyitli) ───────────────

const CMD_NOP = 0x0000;
const CMD_LIST_SERVICES = 0x0004;
const CMD_LIST_IDENTITY = 0x0063;
const CMD_LIST_INTERFACES = 0x0064;
const CMD_REGISTER_SESSION = 0x0065;
const CMD_UNREGISTER_SESSION = 0x0066;
const CMD_SEND_RR_DATA = 0x006f;
const CMD_SEND_UNIT_DATA = 0x0070;

const ENCAP_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [CMD_NOP, 'NOP'],
  [CMD_LIST_SERVICES, 'List Services'],
  [CMD_LIST_IDENTITY, 'List Identity'],
  [CMD_LIST_INTERFACES, 'List Interfaces'],
  [CMD_REGISTER_SESSION, 'Register Session'],
  [CMD_UNREGISTER_SESSION, 'UnRegister Session'],
  [CMD_SEND_RR_DATA, 'Send RR Data'],
  [CMD_SEND_UNIT_DATA, 'Send Unit Data'],
]);

const ENCAP_STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0000, 'Success'],
  [0x0001, 'Invalid Command'],
  [0x0002, 'No Memory Resources'],
  [0x0003, 'Incorrect Data'],
  [0x0064, 'Invalid Session Handle'],
  [0x0065, 'Invalid Length'],
  [0x0069, 'Unsupported Protocol Revision'],
  [0x006a, 'Encapsulated CIP Service Not Allowed On This Port'],
]);

// ── CPF (Common Packet Format) item tipleri — W ile teyitli ─────────────────

const CPF_ITEM_NULL = 0x0000;
const CPF_ITEM_CONNECTED_ADDRESS = 0x00a1;
const CPF_ITEM_CONNECTED_DATA = 0x00b1;
const CPF_ITEM_UNCONNECTED_DATA = 0x00b2;
const CPF_ITEM_LIST_SERVICES_RESPONSE = 0x0100;
const CPF_ITEM_SOCKADDR_INFO_OT = 0x8000;
const CPF_ITEM_SOCKADDR_INFO_TO = 0x8001;
const CPF_ITEM_SEQUENCED_ADDRESS = 0x8002;

const CPF_ITEM_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [CPF_ITEM_NULL, 'Null Address Item'],
  [CPF_ITEM_CONNECTED_ADDRESS, 'Connected Address Item'],
  [CPF_ITEM_CONNECTED_DATA, 'Connected Data Item'],
  [CPF_ITEM_UNCONNECTED_DATA, 'Unconnected Data Item'],
  [CPF_ITEM_LIST_SERVICES_RESPONSE, 'List Services Response'],
  [CPF_ITEM_SOCKADDR_INFO_OT, 'Socket Address Info O->T'],
  [CPF_ITEM_SOCKADDR_INFO_TO, 'Socket Address Info T->O'],
  [CPF_ITEM_SEQUENCED_ADDRESS, 'Sequenced Address Item'],
]);

const ERROR_ABORTED = 'protocol.ethernetip.error.aborted';
const ERROR_HEADER_TRUNCATED = 'protocol.ethernetip.error.headerTruncated';
const ERROR_FRAME_TOO_LONG = 'protocol.ethernetip.error.frameTooLong';
const ERROR_CPF_ITEM_TRUNCATED = 'protocol.ethernetip.error.cpfItemTruncated';
const ERROR_CPF_HEADER_TRUNCATED = 'protocol.ethernetip.error.cpfHeaderTruncated';

const WARN_UNKNOWN_COMMAND = 'protocol.ethernetip.warning.unknownCommand';
const WARN_UNKNOWN_STATUS = 'protocol.ethernetip.warning.unknownStatus';
const WARN_LENGTH_MISMATCH = 'protocol.ethernetip.warning.lengthMismatch';
const WARN_UNHANDLED_COMMAND_DATA = 'protocol.ethernetip.warning.unhandledCommandData';

const SUMMARY_PREFIX = 'protocol.ethernetip.summary.';

export type EthernetIpFrameMetadata = {
  command: number;
  commandName: string | undefined;
  summaryKey: string;
};

interface EthernetIpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** CPF item'larını yürür; Connected/Unconnected Data Item'ları `cipCore`ye devreder. */
function decodeCpf(
  data: Uint8Array,
  offset: number,
  cpfEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  fieldIdPrefix: string,
): void {
  if (offset + 2 > cpfEnd) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CPF_HEADER_TRUNCATED,
      offset,
      length: cpfEnd - offset,
    });
    return;
  }

  const itemCount = readUint16Le(data, offset);
  fields.push({
    id: `${fieldIdPrefix}item-count`,
    name: 'Item Count',
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: itemCount,
    valid: true,
    warnings: [],
  });

  let cursor = offset + 2;
  for (let index = 0; index < itemCount && cursor < cpfEnd; index += 1) {
    if (cursor + 4 > cpfEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_CPF_ITEM_TRUNCATED,
        offset: cursor,
        length: cpfEnd - cursor,
      });
      return;
    }

    const itemPrefix = `${fieldIdPrefix}item-${String(index + 1)}-`;
    const typeId = readUint16Le(data, cursor);
    const typeName = CPF_ITEM_TYPE_NAMES.get(typeId);
    fields.push({
      id: `${itemPrefix}type`,
      name: 'Item Type',
      offset: cursor,
      length: 2,
      rawBytes: data.slice(cursor, cursor + 2),
      rawValue: typeId,
      ...(typeName === undefined ? {} : { physicalValue: typeName }),
      valid: true,
      warnings: [],
    });

    const declaredLength = readUint16Le(data, cursor + 2);
    fields.push({
      id: `${itemPrefix}length`,
      name: 'Item Length',
      offset: cursor + 2,
      length: 2,
      rawBytes: data.slice(cursor + 2, cursor + 4),
      rawValue: declaredLength,
      unit: 'B',
      valid: true,
      warnings: [],
    });

    const itemDataStart = cursor + 4;
    const itemDataEnd = itemDataStart + declaredLength;
    if (itemDataEnd > cpfEnd) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_CPF_ITEM_TRUNCATED,
        offset: itemDataStart,
        length: cpfEnd - itemDataStart,
        details: { declaredLength, availableBytes: cpfEnd - itemDataStart },
      });
      return;
    }

    if (typeId === CPF_ITEM_CONNECTED_ADDRESS && declaredLength >= 4) {
      fields.push({
        id: `${itemPrefix}connection-id`,
        name: 'Connection ID',
        offset: itemDataStart,
        length: 4,
        rawBytes: data.slice(itemDataStart, itemDataStart + 4),
        rawValue: readUint32Le(data, itemDataStart),
        valid: true,
        warnings: [],
      });
    } else if (typeId === CPF_ITEM_UNCONNECTED_DATA && declaredLength > 0) {
      decodeCipMessage(data, itemDataStart, itemDataEnd, fields, warnings, errors, `${itemPrefix}cip-`);
    } else if (typeId === CPF_ITEM_CONNECTED_DATA && declaredLength >= 2) {
      // Connected Data Item: CIP mesajından ÖNCE 2 baytlık Sequence Count
      // gelir (dosya başı kaynak uyarısı) — atlanmazsa Service baytı yanlış okunur.
      fields.push({
        id: `${itemPrefix}sequence-count`,
        name: 'Sequence Count',
        offset: itemDataStart,
        length: 2,
        rawBytes: data.slice(itemDataStart, itemDataStart + 2),
        rawValue: readUint16Le(data, itemDataStart),
        valid: true,
        warnings: [],
      });
      decodeCipMessage(
        data,
        itemDataStart + 2,
        itemDataEnd,
        fields,
        warnings,
        errors,
        `${itemPrefix}cip-`,
      );
    } else if (declaredLength > 0) {
      // Sockaddr Info / Sequenced Address / List Services Response / Null vb.
      // — dosya başı KAPSAM notu: ad çözülür, gövde ham kalır.
      pushRawField(fields, `${itemPrefix}data`, 'Item Data', data, itemDataStart, declaredLength);
    }

    cursor = itemDataEnd;
  }
}

function parseEthernetIpFrame(data: Uint8Array, options: EthernetIpParseOptions): ParseResult {
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

  const maxFrameLength = options.maxFrameLength ?? 4096;
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const command = readUint16Le(data, 0);
  const commandName = ENCAP_COMMAND_NAMES.get(command);
  fields.push({
    id: 'command',
    name: 'Command',
    offset: 0,
    length: 2,
    rawBytes: data.slice(0, 2),
    rawValue: command,
    ...(commandName === undefined ? {} : { physicalValue: commandName }),
    valid: true,
    warnings: commandName === undefined ? [WARN_UNKNOWN_COMMAND] : [],
  });
  if (commandName === undefined) warnings.push(toProtocolWarning(WARN_UNKNOWN_COMMAND));

  const declaredLength = readUint16Le(data, 2);
  const actualBodyLength = data.length - HEADER_LENGTH;
  fields.push({
    id: 'length',
    name: 'Length',
    offset: 2,
    length: 2,
    rawBytes: data.slice(2, 4),
    rawValue: declaredLength,
    unit: 'B',
    valid: declaredLength === actualBodyLength,
    warnings: declaredLength === actualBodyLength ? [] : [WARN_LENGTH_MISMATCH],
  });
  if (declaredLength !== actualBodyLength) warnings.push(toProtocolWarning(WARN_LENGTH_MISMATCH));

  fields.push({
    id: 'session-handle',
    name: 'Session Handle',
    offset: 4,
    length: 4,
    rawBytes: data.slice(4, 8),
    rawValue: readUint32Le(data, 4),
    valid: true,
    warnings: [],
  });

  const status = readUint32Le(data, 8);
  const statusName = ENCAP_STATUS_NAMES.get(status);
  fields.push({
    id: 'status',
    name: 'Status',
    offset: 8,
    length: 4,
    rawBytes: data.slice(8, 12),
    rawValue: status,
    ...(statusName === undefined ? {} : { physicalValue: statusName }),
    valid: true,
    warnings: statusName === undefined && status !== 0 ? [WARN_UNKNOWN_STATUS] : [],
  });
  if (statusName === undefined && status !== 0) warnings.push(toProtocolWarning(WARN_UNKNOWN_STATUS));

  fields.push({
    id: 'sender-context',
    name: 'Sender Context',
    offset: 12,
    length: SENDER_CONTEXT_LENGTH,
    rawBytes: data.slice(12, 12 + SENDER_CONTEXT_LENGTH),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'options',
    name: 'Options',
    offset: 20,
    length: 4,
    rawBytes: data.slice(20, 24),
    rawValue: readUint32Le(data, 20),
    valid: true,
    warnings: [],
  });

  const bodyStart = HEADER_LENGTH;
  const bodyEnd = data.length;

  if (command === CMD_REGISTER_SESSION && bodyEnd - bodyStart >= 4) {
    fields.push({
      id: 'protocol-version',
      name: 'Protocol Version',
      offset: bodyStart,
      length: 2,
      rawBytes: data.slice(bodyStart, bodyStart + 2),
      rawValue: readUint16Le(data, bodyStart),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: 'options-flags',
      name: 'Options Flags',
      offset: bodyStart + 2,
      length: 2,
      rawBytes: data.slice(bodyStart + 2, bodyStart + 4),
      rawValue: readUint16Le(data, bodyStart + 2),
      valid: true,
      warnings: [],
    });
  } else if (command === CMD_SEND_RR_DATA || command === CMD_SEND_UNIT_DATA) {
    if (bodyEnd - bodyStart >= 6) {
      fields.push({
        id: 'interface-handle',
        name: 'Interface Handle',
        offset: bodyStart,
        length: 4,
        rawBytes: data.slice(bodyStart, bodyStart + 4),
        rawValue: readUint32Le(data, bodyStart),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: 'timeout',
        name: 'Timeout',
        offset: bodyStart + 4,
        length: 2,
        rawBytes: data.slice(bodyStart + 4, bodyStart + 6),
        rawValue: readUint16Le(data, bodyStart + 4),
        unit: 's',
        valid: true,
        warnings: [],
      });
      decodeCpf(data, bodyStart + 6, bodyEnd, fields, warnings, errors, 'cpf-');
    } else if (bodyEnd - bodyStart > 0) {
      pushRawField(fields, 'command-data', 'Command-Specific Data', data, bodyStart, bodyEnd - bodyStart);
      warnings.push(toProtocolWarning(WARN_UNHANDLED_COMMAND_DATA));
    }
  } else if (bodyEnd - bodyStart > 0) {
    // NOP / ListServices / ListIdentity / ListInterfaces / UnRegisterSession
    // ve tanınmayan komutlar — dosya başı KAPSAM notu: ham blok.
    pushRawField(fields, 'command-data', 'Command-Specific Data', data, bodyStart, bodyEnd - bodyStart);
    if (command !== CMD_UNREGISTER_SESSION && command !== CMD_NOP) {
      warnings.push(toProtocolWarning(WARN_UNHANDLED_COMMAND_DATA));
    }
  }

  const metadata: EthernetIpFrameMetadata = {
    command,
    commandName,
    summaryKey: `${SUMMARY_PREFIX}${commandName === undefined ? 'unknown' : 'known'}`,
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

export function parseEthernetIp(data: Uint8Array): ParseResult {
  return parseEthernetIpFrame(data, {});
}

export const ethernetIpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: tam başlık uzunluğu + tanınan komut kodu. */
  canParse(data: Uint8Array): boolean {
    if (data.length < HEADER_LENGTH) return false;
    return ENCAP_COMMAND_NAMES.has(readUint16Le(data, 0));
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: EthernetIpParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseEthernetIpFrame(data, options);
  },
};

/** `session_handle`/`sender_context` gibi opak alanları elle yazmak yerine burada kurulur. */
function buildHeader(
  command: number,
  bodyLength: number,
  sessionHandle: number,
  status: number,
): number[] {
  const header: number[] = [];
  header.push(command & 0xff, (command >>> 8) & 0xff);
  header.push(bodyLength & 0xff, (bodyLength >>> 8) & 0xff);
  header.push(
    sessionHandle & 0xff,
    (sessionHandle >>> 8) & 0xff,
    (sessionHandle >>> 16) & 0xff,
    (sessionHandle >>> 24) & 0xff,
  );
  header.push(status & 0xff, (status >>> 8) & 0xff, (status >>> 16) & 0xff, (status >>> 24) & 0xff);
  header.push(0, 0, 0, 0, 0, 0, 0, 0); // Sender Context — örneklerde kullanılmıyor.
  header.push(0, 0, 0, 0); // Options.
  return header;
}

function buildFrame(command: number, sessionHandle: number, status: number, body: readonly number[]): Uint8Array {
  return Uint8Array.from([...buildHeader(command, body.length, sessionHandle, status), ...body]);
}

/**
 * Örnek çerçeveler ELLE inşa edildi (ODVA spec'i bu depoda yok — `cipCore.ts`
 * dosya başındaki disiplin). `sendRrDataGetAttributeSingle` CIP çekirdeğinin
 * GERÇEKTEN tüketildiğini kanıtlar: CPF Unconnected Data Item'ın içinde
 * `cip.ts`teki BİREBİR aynı Get_Attribute_Single isteği taşınır.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'register-session-request',
    name: 'protocol.ethernetip.example.registerSessionRequest.name',
    // Protocol Version=1, Options Flags=0.
    bytes: buildFrame(CMD_REGISTER_SESSION, 0x00000000, 0x00000000, [0x01, 0x00, 0x00, 0x00]),
    description: 'protocol.ethernetip.example.registerSessionRequest.description',
    expectedValid: true,
  },
  {
    id: 'register-session-response',
    name: 'protocol.ethernetip.example.registerSessionResponse.name',
    bytes: buildFrame(CMD_REGISTER_SESSION, 0x12345678, 0x00000000, [0x01, 0x00, 0x00, 0x00]),
    description: 'protocol.ethernetip.example.registerSessionResponse.description',
    expectedValid: true,
  },
  {
    id: 'send-rr-data-get-attribute-single',
    name: 'protocol.ethernetip.example.sendRrDataGetAttributeSingle.name',
    // Interface Handle=0, Timeout=0, CPF: Item Count=2 → Null Address Item
    // (tip 0x0000, uzunluk 0) + Unconnected Data Item (tip 0x00B2) içinde
    // Get_Attribute_Single(0x0E) Class=1/Instance=1/Attribute=1 isteği.
    bytes: buildFrame(CMD_SEND_RR_DATA, 0x12345678, 0x00000000, [
      0x00, 0x00, 0x00, 0x00, // Interface Handle
      0x00, 0x00, // Timeout
      0x02, 0x00, // Item Count = 2
      0x00, 0x00, 0x00, 0x00, // Null Address Item: type=0x0000, length=0
      0xb2, 0x00, 0x06, 0x00, // Unconnected Data Item: type=0x00B2, length=6
      0x0e, 0x03, 0x20, 0x01, 0x24, 0x01, // Get_Attribute_Single, Class=1, Instance=1
    ]),
    description: 'protocol.ethernetip.example.sendRrDataGetAttributeSingle.description',
    expectedValid: true,
  },
  {
    id: 'send-unit-data-connected-response',
    name: 'protocol.ethernetip.example.sendUnitDataConnectedResponse.name',
    // Connected Address Item (Connection ID=0x11223344) + Connected Data
    // Item: Sequence Count=1 + CIP yanıtı (Reply=0x8E, Status=Success, Data=0x0001).
    bytes: buildFrame(CMD_SEND_UNIT_DATA, 0x12345678, 0x00000000, [
      0x00, 0x00, 0x00, 0x00, // Interface Handle
      0x00, 0x00, // Timeout
      0x02, 0x00, // Item Count = 2
      0xa1, 0x00, 0x04, 0x00, 0x44, 0x33, 0x22, 0x11, // Connected Address Item, Connection ID
      0xb1, 0x00, 0x08, 0x00, // Connected Data Item, length=8
      0x01, 0x00, // Sequence Count = 1
      0x8e, 0x00, 0x00, 0x00, 0x01, 0x00, // CIP yanıtı: Reply, Reserved, Status, AddlSize, Data
    ]),
    description: 'protocol.ethernetip.example.sendUnitDataConnectedResponse.description',
    expectedValid: true,
  },
  {
    id: 'unregister-session',
    name: 'protocol.ethernetip.example.unregisterSession.name',
    bytes: buildFrame(CMD_UNREGISTER_SESSION, 0x12345678, 0x00000000, []),
    description: 'protocol.ethernetip.example.unregisterSession.description',
    expectedValid: true,
  },
  {
    id: 'send-rr-data-cpf-item-truncated',
    name: 'protocol.ethernetip.example.sendRrDataCpfItemTruncated.name',
    // Unconnected Data Item uzunluğu 6 vaat ediyor ama yalnız 2 bayt veri var.
    bytes: buildFrame(CMD_SEND_RR_DATA, 0x12345678, 0x00000000, [
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00,
      0x02, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0xb2, 0x00, 0x06, 0x00,
      0x0e, 0x00,
    ]),
    description: 'protocol.ethernetip.example.sendRrDataCpfItemTruncated.description',
    expectedValid: false,
  },
];

export const ethernetIpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: ethernetIpParser,
  documentation: {
    summary: 'protocol.ethernetip.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'OpENer — Open Source EtherNet/IP(TM) Adapter Stack (enet_encap/encap.h, cpf.h)',
        url: 'https://github.com/EIPStackGroup/OpENer',
      },
      {
        title: 'Wireshark EtherNet/IP dissector (epan/dissectors/packet-enip.c) — encap_cmd_vals / cpf_type_vals',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-enip.c',
      },
      {
        title: 'digitalpetri/ethernet-ip — independent Java/Scala EtherNet/IP client (SendRRData/SendUnitData framing)',
        url: 'https://github.com/digitalpetri/ethernet-ip',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
